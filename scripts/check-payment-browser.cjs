'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { start } = require('./license-dev-server.cjs');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/payments/sandbox-browser');
const merchant = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), provider = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
async function main() {
    fs.mkdirSync(output, { recursive: true });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-sandbox-browser-')), originalFetch = global.fetch;
    const sandbox = { ALIPAY_SANDBOX_APP_ID: '9021000000000001', ALIPAY_SANDBOX_SELLER_ID: '2088000000000001',
        ALIPAY_SANDBOX_PRIVATE_KEY: merchant.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
        ALIPAY_SANDBOX_PUBLIC_KEY: provider.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') };
    let service, browser, providerState = 'WAIT_BUYER_PAY', failQuery = false, mismatchedAmount = false;
    const checks = [], errors = []; let queryCount = 0;
    global.fetch = async (address, request) => {
        if (String(address) !== 'https://openapi-sandbox.dl.alipaydev.com/gateway.do') return originalFetch(address, request);
        queryCount++; if (failQuery) throw Error('simulated connection failure');
        const parameters = Object.fromEntries(new URLSearchParams(request.body)), { canonical } = await import('../workers/license/alipay-sandbox.mjs');
        assert.equal(crypto.verify('RSA-SHA256', Buffer.from(canonical(parameters)), merchant.publicKey, Buffer.from(parameters.sign, 'base64')), true);
        const orderNo = JSON.parse(parameters.biz_content).out_trade_no;
        const result = JSON.stringify({ code: '10000', out_trade_no: orderNo, trade_no: 'TRADE_' + orderNo, total_amount: mismatchedAmount ? '0.01' : '13.88', trade_status: providerState });
        const sign = crypto.sign('RSA-SHA256', Buffer.from(result), provider.privateKey).toString('base64');
        return new Response('{"alipay_trade_query_response":' + result + ',"sign":' + JSON.stringify(sign) + '}');
    };
    try {
        service = await start({ port: 0, directory, sandbox }); browser = await chromium.launch({ channel: 'msedge', headless: true });
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(service.origin + '/checkout.html?paid=true&trade_status=TRADE_SUCCESS');
        await page.getByText('先登录并验证测试账号的邮箱，再回到这里。', { exact: true }).waitFor();
        assert.equal(await page.locator('#payment-start').isDisabled(), true); assert.equal(queryCount, 0);
        checks.push('sandbox requires an authenticated account and ignores success URL fields');
        await page.locator('#payment-login').click();
        const password = crypto.randomBytes(24).toString('base64url') + '沙箱测试';
        await page.locator('#account-name').fill('测试小草'); await page.locator('#account-email').fill('sandbox-browser@example.invalid');
        await page.locator('#account-password').fill(password); await page.locator('#account-confirm').fill(password); await page.locator('#account-submit').click();
        await page.waitForFunction(() => document.getElementById('account-status').textContent.includes('本机测试模式'));
        const mail = (await service.env.ACCOUNT_DEV_MAIL.read())[0]; assert.equal(mail.purpose, 'register');
        await page.goto(mail.link); await page.locator('#account-submit').click();
        await page.waitForFunction(() => document.getElementById('account-status').textContent.includes('邮箱验证成功'));
        await page.locator('#account-email').fill('sandbox-browser@example.invalid'); await page.locator('#account-password').fill(password); await page.locator('#account-submit').click();
        await page.locator('#account-home').waitFor({ state: 'visible' });
        await page.goto(service.origin + '/checkout.html');
        await page.getByRole('button', { name: '创建 ¥13.88 测试订单', exact: true }).waitFor();
        let lost = false;
        await page.route('**/payment/v1/orders', async route => {
            if (route.request().method() === 'POST' && !lost) { lost = true; await route.fetch(); await route.abort(); }
            else await route.continue();
        });
        await page.locator('#payment-start').click(); await page.waitForFunction(() => document.getElementById('payment-status').textContent.includes('网络连接失败'));
        assert.equal(service.env.DB.database.prepare('SELECT count(*) AS n FROM sandbox_payment_orders').get().n, 1);
        await page.locator('#payment-start').click(); await page.locator('#payment-cashier').waitFor({ state: 'visible' });
        assert.equal(service.env.DB.database.prepare('SELECT count(*) AS n FROM sandbox_payment_orders').get().n, 1);
        checks.push('real registration, mailbox verification and retry preserve one account-bound order');
        const paymentUrl = await page.locator('#payment-cashier').getAttribute('href'); assert.equal(new URL(paymentUrl).hostname, 'openapi-sandbox.dl.alipaydev.com');
        const popupEvent = page.waitForEvent('popup');
        await context.route('https://openapi-sandbox.dl.alipaydev.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Simulated cashier navigation only</title><p>No payment performed</p>' }));
        await page.locator('#payment-cashier').click(); const popup = await popupEvent; await popup.waitForLoadState(); await popup.close();
        await page.bringToFront();
        await page.locator('#payment-check').waitFor({ state: 'visible' }); await page.locator('#payment-check').click();
        await page.waitForFunction(() => document.getElementById('payment-status').textContent.includes('尚未确认付款'));
        assert.equal(service.env.DB.database.prepare('SELECT count(*) AS n FROM licenses').get().n, 0);
        checks.push('opening the cashier and immediately returning never earns a license');
        failQuery = true; await page.locator('#payment-check').click();
        await page.waitForFunction(() => document.getElementById('payment-status').textContent.includes('未能确认支付宝'));
        assert.equal(await page.locator('#payment-license').isHidden(), true); failQuery = false;
        providerState = 'TRADE_SUCCESS'; mismatchedAmount = true; await page.locator('#payment-check').click();
        await page.waitForFunction(() => document.getElementById('payment-status').textContent.includes('交易信息与订单不符'));
        assert.equal(service.env.DB.database.prepare('SELECT count(*) AS n FROM licenses').get().n, 0); mismatchedAmount = false;
        checks.push('provider failure and incorrect amount show errors and no activation code');
        await page.locator('#payment-check').click(); await page.locator('#payment-license').waitFor({ state: 'visible' });
        const activation = await page.locator('#payment-code').inputValue(); assert.match(activation, /^BYND(?:-[0-9A-F]{4}){8}$/);
        await page.reload(); await page.locator('#payment-license').waitFor({ state: 'visible' }); assert.equal(await page.locator('#payment-code').inputValue(), activation);
        assert.equal(service.env.DB.database.prepare('SELECT count(*) AS n FROM licenses').get().n, 1);
        checks.push('verified simulated payment issues once and survives reload through account ownership');
        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 844 });
            for (const safe of [47, 59]) for (const parent of [false, true]) {
                await page.evaluate(({ safe, parent }) => { document.documentElement.style.setProperty('--safe-top', safe + 'px'); document.body.classList.toggle('safe-area-from-parent', parent); }, { safe, parent });
                const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, top: document.querySelector('.wordmark').getBoundingClientRect().top + scrollY }));
                assert.ok(dimensions.scroll <= width); assert.ok(dimensions.top >= safe && dimensions.top < safe + 40);
                await page.screenshot({ path: path.join(output, `paid-${width}-safe${safe}-${parent ? 'parent' : 'header'}.png`), fullPage: true });
            }
        }
        await page.goto(service.origin + '/account.html'); await page.locator('#account-home').waitFor({ state: 'visible' });
        await page.locator('#my-license-list').getByRole('button', { name: '查看激活码' }).click();
        assert.equal(await page.locator('#my-license-list textarea').inputValue(), activation);
        await page.locator('#account-logout').click(); await page.goto(service.origin + '/checkout.html');
        await page.getByText('先登录并验证测试账号的邮箱，再回到这里。', { exact: true }).waitFor();
        assert.equal(await page.locator('#payment-code').inputValue(), '');
        checks.push('account page owns the same license and logout clears the private code');
        assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, queryCount, javascriptErrors: errors, provider: 'RSA-signed deterministic simulator; no real charge' }, null, 2));
        console.log(JSON.stringify({ checks, queryCount, javascriptErrors: errors }));
    } finally { global.fetch = originalFetch; if (browser) await browser.close(); if (service) await service.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
