const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/shop');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(pathToFileURL(path.join(root, 'shop.html')).href);
        await page.locator('.hero-art img').evaluate(img => img.decode());
        assert.equal(await page.locator('.purchase-button').isDisabled(), true);
        assert.equal(await page.locator('.download-row button').isDisabled(), true);
        for (const width of [320, 390, 430, 1280]) {
            await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 });
            for (const safe of [0, 47, 59]) {
                await page.evaluate(top => document.documentElement.style.setProperty('--safe-top', top + 'px'), safe);
                const box = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth, header: document.querySelector('.wordmark').getBoundingClientRect().top }));
                assert.ok(box.scroll <= box.viewport, JSON.stringify({ width, safe, ...box }));
                assert.ok(box.header >= safe, JSON.stringify({ width, safe, ...box }));
            }
            await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '0px'));
            await page.screenshot({ path: path.join(output, `shop-${width}.png`), fullPage: true });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('nav a[href="#get"]').click();
        await page.waitForFunction(() => Math.abs(document.getElementById('get').getBoundingClientRect().top - 30) < 3);
        await page.locator('summary').first().click();
        assert.equal(await page.locator('details').first().getAttribute('open'), '');
        assert.deepEqual(errors, []);
        console.log('Shop checked at 320/390/430/1280px, 0/47/59px safe areas; closed-sale state and navigation verified.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
