'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve(__dirname, '../artifacts/home3d-interiors');
async function main() {
    fs.mkdirSync(out, { recursive: true }); const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { presets: [], errors: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        page.on('pageerror', error => report.errors.push(error.message));
        const ready = () => page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
        await page.goto('http://127.0.0.1:' + server.address().port + '/room'); await ready();
        await page.evaluate(() => { document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top', '59px'); document.querySelector('.home3d-notice').hidden = true; });
        await page.locator('[data-action="build"]').click(); await page.locator('[data-action="build-interiors"]').click();
        assert.equal(await page.locator('[data-action="interior-preset"]').count(), 7);
        await page.screenshot({ path: path.join(out, 'chooser-390.png') });
        for (const id of ['garden', 'palace', 'botanical', 'rose', 'natural', 'pink', 'monochrome']) {
            await page.locator('[data-action="interior-preset"][data-interior="' + id + '"]').click(); await ready();
            assert.equal(await page.locator('[data-interior="' + id + '"]').getAttribute('aria-pressed'), 'true');
            await page.locator('[data-action="dismiss"]').click(); await page.locator('[data-action="build-done"]').click();
            await page.evaluate(() => document.querySelector('.home3d-notice').hidden = true); await page.waitForTimeout(350);
            const record = await page.evaluate(() => ({ config: ByndHome3D.Interiors.resolve(ByndHome3D.Rooms.get('living_room'), ByndHome3D.State.home()), stats: ByndHome3D.runtime.stats() }));
            assert.equal(record.config.id, id); assert.ok(record.stats.texturesBudget.textureBytes <= record.stats.texturesBudget.budgetBytes);
            assert.equal(await page.evaluate(() => { const tv = ByndHome3D.runtime.furniture().find(row => row.placement.id === 'tv'); return tv.model.userData.screenNormal?.join(','); }), '0,0,1');
            report.presets.push(record); await page.screenshot({ path: path.join(out, id + '-390.png') });
            await page.setViewportSize({ width: 1000, height: 900 }); await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, id + '-wide.png') });
            await page.setViewportSize({ width: 390, height: 844 }); await page.locator('[data-action="build"]').click(); await page.locator('[data-action="build-interiors"]').click();
        }
        await page.locator('[data-action="dismiss"]').click();
        await page.locator('[data-build-style]').selectOption('pink');
        await page.waitForFunction(() => [...document.querySelectorAll('.home3d-build-preview img')].every(img => img.complete && img.naturalWidth >= 128));
        assert.equal(await page.locator('.home3d-build-preview img').count(), 8);
        await page.screenshot({ path: path.join(out, 'furniture-picker-390.png') });
        const drawer = await page.evaluate(() => ({ height: document.querySelector('.home3d-build-tray').getBoundingClientRect().height, scene: document.querySelector('.home3d-world').getBoundingClientRect().height }));
        assert.ok(drawer.scene > drawer.height * 1.8, 'room stays the visual focus');
        await page.locator('[data-build-style]').selectOption('monochrome');
        await page.waitForFunction(() => [...document.querySelectorAll('.home3d-build-preview img')].every(img => img.complete && img.naturalWidth >= 128));
        await page.screenshot({ path: path.join(out, 'furniture-picker-monochrome.png') });
        await page.locator('[data-action="build-interiors"]').click();
        await page.locator('#home3d-interior-wall').selectOption('rose_brick'); await page.locator('#home3d-interior-floor').selectOption('tatami');
        await page.locator('[data-action="interior-finishes"]').click(); await ready();
        const before = await page.evaluate(() => localStorage.getItem(ByndHome3D.State.key));
        await page.evaluate(() => { window.originalInteriorWrite = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === ByndHome3D.State.key) throw Error('quota'); return originalInteriorWrite.call(this, key, value); }; });
        await page.locator('[data-interior="palace"]').click(); assert.match(await page.locator('.home3d-notice').innerText(), /没有保存成功/);
        assert.equal(await page.evaluate(() => localStorage.getItem(ByndHome3D.State.key)), before);
        await page.evaluate(() => { Storage.prototype.setItem = originalInteriorWrite; });
        await page.reload(); await ready();
        const persisted = await page.evaluate(() => ByndHome3D.Interiors.resolve(ByndHome3D.Rooms.get('living_room'), ByndHome3D.State.home()));
        assert.equal(persisted.wall, 'rose_brick'); assert.equal(persisted.floor, 'tatami'); report.persisted = persisted;
        await page.setViewportSize({ width: 320, height: 640 }); await page.locator('[data-action="build"]').click(); await page.locator('[data-action="build-interiors"]').click();
        const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, body: document.querySelector('.home3d-sheet-body').getBoundingClientRect().width, width: innerWidth })); assert.equal(layout.overflow, false); assert.ok(layout.body <= 320);
        await page.screenshot({ path: path.join(out, 'chooser-320.png') });
        await page.evaluate(() => ByndHome3D.close()); assert.equal(await page.locator('canvas').count(), 0); assert.deepEqual(report.errors, []);
        fs.writeFileSync(path.join(out, 'review.json'), JSON.stringify(report, null, 2)); console.log('Interior checks passed: seven full sets, independent wall/floor selection, narrow UI, persistence, failed save and disposal.');
    } finally { await browser.close(); server.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
