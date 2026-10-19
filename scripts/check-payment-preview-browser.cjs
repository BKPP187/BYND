'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const { start } = require('./license-dev-server.cjs');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/payments');
async function main() {
    fs.mkdirSync(output, { recursive: true });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-checkout-preview-'));
    let service, browser;
    try {
        service = await start({ port: 0, directory });
        browser = await chromium.launch({ channel: 'msedge', headless: true });
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
        const errors = [], writes = [], retiredRequests = []; page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
            if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url());
            if (/^\/(payment\/v1\/|(?:license|admin)\/v1\/pay\/afdian\/)/.test(new URL(request.url()).pathname)) retiredRequests.push(request.url());
        });
        await page.goto(service.origin + '/shop.html');
        await page.waitForFunction(() => document.getElementById('shop-status').textContent.length > 0);
        assert.equal(await page.locator('.price-row strong').innerText(), '¥13.88');
        assert.equal(await page.locator('.purchase-button').getAttribute('href'), 'checkout.html');
        await page.locator('.purchase-button').click();
        await page.locator('.payment-art>img').evaluate(image => image.decode());
        await page.locator('.qq-code img').evaluate(image => image.decode());
        await page.screenshot({ path: path.join(output, 'checkout-mobile.png'), fullPage: true });
        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 844 });
            for (const safe of [47, 59]) for (const parent of [false, true]) {
                await page.evaluate(({ safe, parent }) => {
                    document.documentElement.style.setProperty('--safe-top', safe + 'px');
                    document.body.classList.toggle('safe-area-from-parent', parent);
                    scrollTo({ top: 0, behavior: 'instant' });
                }, { safe, parent });
                const bounds = await page.evaluate(() => ({
                    width: innerWidth, scroll: document.documentElement.scrollWidth,
                    top: document.querySelector('.site-header .wordmark').getBoundingClientRect().top,
                    header: document.querySelector('.site-header').getBoundingClientRect().bottom
                }));
                assert.ok(bounds.scroll <= bounds.width, 'Checkout must fit a narrow phone');
                assert.ok(bounds.top >= safe, 'Header must clear the native status bar');
                assert.ok(bounds.header < safe + 100, 'Header must reserve the safe area only once');
                await page.screenshot({ path: path.join(output, `checkout-${width}-safe${safe}-${parent ? 'parent' : 'header'}.png`), fullPage: true });
            }
        }
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.evaluate(() => { document.documentElement.style.removeProperty('--safe-top'); document.body.classList.remove('safe-area-from-parent'); });
        await page.screenshot({ path: path.join(output, 'checkout-desktop.png'), fullPage: true });
        for (const query of ['?paid=true&amount=13.88', '?trade_status=TRADE_SUCCESS&success=1#paid']) {
            await page.goto(service.origin + '/checkout.html' + query);
            await page.evaluate(() => {
                dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'));
                dispatchEvent(new PopStateEvent('popstate')); dispatchEvent(new HashChangeEvent('hashchange'));
            });
            assert.equal(await page.locator('#qq-number').inputValue(), '3648068162');
            assert.equal(await page.locator('#payment-cashier, #payment-code, #afdian-payment').count(), 0);
            assert.equal(await page.locator('.qq-code').getAttribute('href'), 'assets/contact/bynd-qq-contact-ca44cdaaaaa9.png');
            assert.equal(service.env.DB.database.prepare('SELECT count(*) AS n FROM licenses').get().n, 0);
        }
        assert.deepEqual(writes, [], 'Returning from a payment app must not claim or issue a license');
        assert.deepEqual(retiredRequests, [], 'Checkout must never call retired payment endpoints');
        await page.goto(service.origin + '/checkout.html#refund-policy');
        await page.waitForFunction(() => document.getElementById('refund-policy').open);
        assert.equal(await page.locator('#payment-cashier, #payment-code').count(), 0);
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedQQ = value; } } });
        });
        await page.locator('#qq-copy').click();
        await page.waitForFunction(() => document.getElementById('qq-status').textContent.includes('已复制'));
        assert.equal(await page.evaluate(() => window.copiedQQ), '3648068162');
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } });
        });
        await page.locator('#qq-copy').click();
        await page.waitForFunction(() => document.getElementById('qq-status').textContent.includes('无法自动复制'));
        assert.equal(await page.evaluate(() => { const input = document.getElementById('qq-number'); return input.selectionEnd - input.selectionStart; }), 10);
        await page.route('**/distribution/v1/store', route => route.abort());
        await page.goto(service.origin + '/shop.html');
        await page.waitForFunction(() => document.getElementById('shop-status').textContent.includes('暂时无法读取'));
        await page.locator('.purchase-button').click();
        await page.locator('#qq-number').waitFor();
        assert.equal(await page.locator('#qq-number').inputValue(), '3648068162', 'Contact stays available during backend outages');
        const unauthorized = await context.request.post(service.origin + '/admin/v1/licenses', { data: { requestId: crypto.randomUUID(), paid: true } });
        assert.equal(unauthorized.status(), 401, 'Customer input cannot invoke administrator issuance');
        assert.equal(service.env.DB.database.prepare('SELECT count(*) AS n FROM licenses').get().n, 0);
        assert.deepEqual(errors, []);
        const staged = path.join(root, '.bynd-distribution-web/assets/website');
        if (fs.existsSync(staged)) assert.equal(fs.readdirSync(staged).some(name => /alipay|framed-preview|original|^(payment|afdian)\.js$/.test(name)), false, 'Retired clients and collection codes must stay out of deployment assets');
        const result = { qqContact: '3648068162', originalContactImage: true, copySuccessAndFailure: true, contactWorksDuringOutage: true, noRetiredPaymentRequests: true, refundAnchorOpens: true, clientReturnCannotGrant: true, unauthorizedIssuanceRejected: true, narrowSafeAreaCases: 8, javascriptErrors: errors };
        fs.writeFileSync(path.join(output, 'browser-check.json'), JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result));
    } finally { if (browser) await browser.close(); if (service) await service.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
