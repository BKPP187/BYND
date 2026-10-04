'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function main() {
    const out = path.resolve(__dirname, '../artifacts/home3d-interiors'), server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/room');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
        await page.locator('[data-action="build"]').click(); await page.locator('[data-build-style]').selectOption('pink');
        await page.waitForFunction(() => [...document.querySelectorAll('.home3d-build-preview img')].every(img => img.complete && img.naturalWidth >= 128));
        const cdp = await page.context().newCDPSession(page), shelf = await page.locator('.home3d-build-catalog').boundingBox(), y = shelf.y + 40;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 285, y, id: 1 }] });
        for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 285 - i * 23, y, id: 1 }] }); await page.waitForTimeout(25); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(150);
        assert.ok(await page.locator('.home3d-build-catalog').evaluate(el => el.scrollLeft > 70), 'horizontal touch scrolls furniture shelf');
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.draft()), null, 'scroll does not select furniture');
        await page.locator('.home3d-build-catalog').evaluate(el => el.scrollLeft = 0); await page.waitForTimeout(200);
        await page.locator('[data-furniture="pink_sofa"]').click();
        await page.waitForFunction(() => ByndHome3D.runtime.draft()?.furnitureId === 'pink_sofa'); await page.locator('[data-action="build-cancel"]').click();
        for (const inset of [47, 59]) for (const owner of ['header', 'parent']) {
            await page.setViewportSize({ width: 320, height: 640 });
            await page.evaluate(({ inset, owner }) => { const root = document.querySelector('#home3d-root'); root.style.setProperty('--bynd-header-safe-top', owner === 'header' ? inset + 'px' : '0px'); document.body.style.paddingTop = owner === 'parent' ? inset + 'px' : '0px'; document.body.style.boxSizing = 'border-box'; document.body.style.height = '100vh'; }, { inset, owner });
            await page.waitForTimeout(120);
            const layout = await page.evaluate(() => ({ width: document.querySelector('#home3d-root').scrollWidth, scene: document.querySelector('.home3d-world').getBoundingClientRect().height, back: document.querySelector('[data-action="back"]').getBoundingClientRect().top }));
            assert.ok(layout.width <= 320 && layout.back >= inset && layout.scene >= 250, 'compact picker leaves room usable with safe area');
            await page.screenshot({ path: path.join(out, 'picker-320-' + inset + '-' + owner + '.png') });
        }
        await page.locator('[data-action="build-done"]').click(); await page.evaluate(() => ByndHome3D.close());
        assert.equal(await page.locator('canvas').count(), 0); assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(out, 'picker-review.json'), JSON.stringify({ result: 'passed', gestures: ['native-horizontal-scroll', 'tap-select', 'cancel'], safeArea: ['47/header', '59/header', '47/parent', '59/parent'], errors }, null, 2));
        console.log('Furniture picker passed: actual previews, native touch scrolling, tap/cancel, 320px safe areas and disposal.');
    } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
