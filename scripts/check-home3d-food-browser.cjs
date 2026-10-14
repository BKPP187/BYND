'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const output = path.resolve('artifacts/home3d-renderer/food');
async function main() {
    const { chromium } = require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r)); fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { menus: [], failures: [], errors: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        page.setDefaultTimeout(45000); page.on('pageerror', e => report.errors.push(e.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/room?room=dining_room');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
        await page.evaluate(() => { const H = ByndHome3D; H.runtime.camera.focus(0, -.15); H.runtime.zoom(Math.log(1.7)); });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().camera.zoom > 1.69);
        const state = () => page.evaluate(() => {
            const H = ByndHome3D, group = H.runtime.furniture().find(r => r.item.variant === 'dining').model.getObjectByName('meal-foods'), foods = [], resources = new Set(); let triangles = 0;
            group.traverse(n => { if (n.userData.food) foods.push(n.userData.food); if (n.isMesh) { triangles += (n.geometry.index?.count || n.geometry.attributes.position.count) / 3; resources.add(n.geometry); if (!n.material.isMeshStandardMaterial) throw Error('Food lost its PBR material'); for (const m of n.userData.ownedMaterials || []) if (!m.dispose) throw Error('Cloning lost material ownership'); } });
            return { saved: H.State.home().mealId, id: group.userData.mealId, uuid: group.uuid, foods, triangles, resources: resources.size };
        });
        const openTable = async () => {
            await page.waitForFunction(() => {
                const H = ByndHome3D, rect = document.querySelector('.home3d-scene canvas').getBoundingClientRect(), s = H.runtime.stats();
                return Math.abs(s.resolution.cssWidth - rect.width) < 1 && Math.abs(s.camera.frustum.right / s.camera.frustum.top - rect.width / rect.height) < .001;
            });
            const point = await page.evaluate(() => {
                const H = ByndHome3D, T = ByndHomeEngine, s = H.runtime.stats().camera, f = s.frustum, c = new T.OrthographicCamera(f.left, f.right, f.top, f.bottom, .1, 70);
                c.position.set(s.x + Math.sin(s.yaw) * Math.cos(s.pitch) * 16, s.y + Math.sin(s.pitch) * 16, s.z + Math.cos(s.yaw) * Math.cos(s.pitch) * 16); c.lookAt(s.x, s.y, s.z); c.updateMatrixWorld(true);
                const p = new T.Vector3(0, .79, -.15).project(c), rect = document.querySelector('.home3d-scene canvas').getBoundingClientRect();
                return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
            });
            await page.mouse.click(point.x, point.y); await page.locator('#home3d-meal').waitFor();
        };
        for (const id of ['breakfast', 'supper', 'sushi', 'tea']) {
            await openTable(); await page.locator('#home3d-meal').selectOption(id);
            await page.waitForFunction(id => ByndHome3D.State.home().mealId === id && !document.querySelector('#home3d-meal').disabled, id);
            await page.locator('.home3d-sheet-head button').click();
            const meal = await state(); assert.equal(meal.id, id); assert.ok(meal.triangles < 7000 && meal.resources <= 6);
            report.menus.push(meal); await page.screenshot({ path: path.join(output, id + '.png') });
        }
        const before = await state(); await openTable();
        await page.evaluate(() => { const H = ByndHome3D; window.originalFoodBuffer = H.Furniture.modelBuffer; H.Furniture.modelBuffer = () => Promise.reject(Error('missing food fixture')); });
        await page.locator('#home3d-meal').selectOption('breakfast');
        await page.waitForFunction(() => !document.querySelector('#home3d-meal').disabled && document.querySelector('#home3d-meal').value === 'tea');
        assert.deepEqual(await state(), before); assert.match(await page.locator('.home3d-notice').innerText(), /没有加载成功/); report.failures.push('missing resource retains previous meal');
        await page.evaluate(() => { ByndHome3D.Furniture.modelBuffer = originalFoodBuffer; window.originalStorageSet = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === ByndHome3D.State.key) throw Error('disk full fixture'); return originalStorageSet.call(this, key, value); }; });
        await page.locator('#home3d-meal').selectOption('sushi');
        await page.waitForFunction(() => !document.querySelector('#home3d-meal').disabled && document.querySelector('#home3d-meal').value === 'tea');
        assert.deepEqual(await state(), before); assert.match(await page.locator('.home3d-notice').innerText(), /没有保存成功/); report.failures.push('failed save retains previous meal and selection');
        await page.evaluate(() => { Storage.prototype.setItem = originalStorageSet; }); await page.locator('.home3d-sheet-head button').click();
        await page.evaluate(async () => { const H = ByndHome3D; await H.UI.loadRoom('kitchen'); });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().room === 'kitchen' && !document.querySelector('.home3d-scene.is-loading'));
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.furniture().find(r => r.item.type === 'stove').model.getObjectByName('meal-foods').userData.mealId), 'tea');
        await page.evaluate(async () => {
            const H = ByndHome3D, create = H.Foods.create; let first = true;
            H.Foods.create = async (...args) => { if (first) { first = false; await new Promise(r => { window.resumeMeal = r; }); } return create(...args); };
            window.pendingMeal = H.runtime.chooseMeal('sushi').then(() => 'unexpected success', e => e.message);
            await H.UI.loadRoom('living_room'); H.Foods.create = create; resumeMeal(); window.raceResult = await pendingMeal;
        });
        assert.match(await page.evaluate(() => raceResult), /已切换/); assert.equal(await page.evaluate(() => ByndHome3D.State.home().mealId), 'tea'); report.failures.push('room switch discards staged meal');
        await page.evaluate(async () => { await ByndHome3D.UI.loadRoom('dining_room'); });
        assert.equal((await state()).id, 'tea');
        await page.setViewportSize({ width: 320, height: 740 }); await openTable();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: path.join(output, 'menu-320.png') });
        await page.evaluate(() => ByndHome3D.runtime.dispose()); assert.deepEqual(report.errors, []);
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('Food browser passed: four actual meals, 16 CC0 models, real menu, failed resource/save preservation, room race, disposal and narrow mobile layout.');
    } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
