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
        const errors = [], writes = []; page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
        await page.goto(service.origin + '/shop.html');
        await page.waitForFunction(() => document.getElementById('shop-status').textContent.length > 0);
        assert.equal(await page.locator('.price-row strong').innerText(), '¥13.88');
        assert.equal(await page.locator('.purchase-button').isDisabled(), true);
        await page.locator('a[href="checkout.html"]').click();
        await page.locator('.payment-art>img').evaluate(image => image.decode());
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
            assert.equal(await page.getByRole('button', { name: '尚未开售', exact: true }).isDisabled(), true);
            assert.equal(await page.locator('.payment-slot img, .payment-slot canvas, .payment-slot a').count(), 0, 'Closed sale must not expose a payable collection code');
            assert.equal(service.env.DB.database.prepare('SELECT count(*) AS n FROM licenses').get().n, 0);
        }
        assert.deepEqual(writes, [], 'Returning from a payment app must not claim or issue a license');
        const unauthorized = await context.request.post(service.origin + '/admin/v1/licenses', { data: { requestId: crypto.randomUUID(), paid: true } });
        assert.equal(unauthorized.status(), 401, 'Customer input cannot invoke administrator issuance');
        assert.equal(service.env.DB.database.prepare('SELECT count(*) AS n FROM licenses').get().n, 0);
        assert.deepEqual(errors, []);
        const staged = path.join(root, '.bynd-distribution-web/assets/website');
        if (fs.existsSync(staged)) assert.equal(fs.readdirSync(staged).some(name => /alipay|framed-preview|original/.test(name)), false, 'Personal QR must stay out of deployment assets');
        const result = { closedSale: true, noPaymentCodePublished: true, clientReturnCannotGrant: true, unauthorizedIssuanceRejected: true, narrowSafeAreaCases: 8, javascriptErrors: errors };
        fs.writeFileSync(path.join(output, 'browser-check.json'), JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result));
    } finally { if (browser) await browser.close(); if (service) await service.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
