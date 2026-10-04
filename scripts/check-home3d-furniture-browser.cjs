'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.resolve(__dirname, '../artifacts/home3d-furniture');
async function main() {
    fs.mkdirSync(output, { recursive: true });
    const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { rooms: [], designs: [], errors: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        page.on('pageerror', error => report.errors.push(error.message));
        const ready = () => page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
        await page.goto('http://127.0.0.1:' + server.address().port + '/room'); await ready();
        await page.evaluate(() => { document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top', '59px'); document.querySelector('.home3d-notice').hidden = true; });
        // Actual mobile rooms, including both new kitchen and original placements.
        for (const room of ['living_room', 'bedroom', 'kitchen']) {
            await page.evaluate(async room => { if (room === 'kitchen') ByndHome3D.Build.expand(room); await ByndHome3D.UI.loadRoom(room); }, room); await ready();
            await page.waitForTimeout(500);
            const rows = await page.evaluate(() => ByndHome3D.runtime.furniture().map(row => ({ id: row.item.id, design: row.model.userData.furnitureDesign, meshes: row.model.children.length })));
            assert.ok(rows.some(row => row.design === 'cozy-reference-v1'));
            report.rooms.push({ room, furniture: rows, stats: await page.evaluate(() => ByndHome3D.runtime.stats()) });
            await page.screenshot({ path: path.join(output, room + '-390.png') });
        }
        // Render a physical furniture gallery with the same materials and lights.
        // No texture screenshot or CSS-scaled room is used by the application.
        const designs = await page.evaluate(() => {
            const H = ByndHome3D, T = ByndHomeEngine, materials = H.Materials.create('cream');
            const rows = H.catalogs.furnitureCatalog.items.filter(H.FurnitureVisuals.handles).map(data => {
                const item = H.Furniture.get(data.id), model = H.FurnitureVisuals.create(item, materials), bounds = new T.Box3().setFromObject(model);
                const result = { id: item.id, meshes: model.children.length, triangles: model.children.reduce((sum, n) => sum + n.geometry.attributes.position.count / 3, 0), min: bounds.min.toArray(), max: bounds.max.toArray() };
                H.Shapes.disposeGeometry(model); return result;
            }); materials.dispose(); return rows;
        });
        assert.ok(designs.every(row => row.meshes <= 10 && row.triangles < 10000)); report.designs = designs;
        for (const style of ['cream', 'european']) {
            await page.evaluate(async style => {
                const H = ByndHome3D;
                H.State.withHome(home => {
                    const room = H.Rooms.get('living_room');
                    home.layouts.living_room = { removed: room.furniture.map(p => p.id), items: {} };
                    const rows = [
                        ['sofa', style + '_sofa', [-.15, 0, -1.5], 0],
                        ['coffee', style + '_table', [0, 0, .05], 0],
                        ['chair', style + '_chair', [1.75, 0, .7], -.7],
                        ['fireplace', style + '_fireplace', [-2.6, 0, -.5], Math.PI / 2],
                        ['books', 'bookcase_01', [-2.5, 0, -1.9], 0],
                        ['plant', style + '_plant', [2.4, 0, -1.9], 0],
                        ['lamp', style + '_lamp', [1.65, 0, -1.6], 0]
                    ];
                    for (const [id, furnitureId, position, rotation] of rows) home.layouts.living_room.items[id] = { id, furnitureId, position, rotation };
                    home.layouts.living_room.removed = room.furniture.map(p => p.id).filter(id => !rows.some(row => row[0] === id));
                    home.activity = { room: 'living_room', target: 'sofa', action: 'Read', reason: '坐在窗边读书', until: Date.now() + 600000 };
                }); await H.UI.loadRoom('living_room');
            }, style); await ready(); await page.waitForTimeout(500);
            await page.screenshot({ path: path.join(output, style + '-390.png') });
            await page.setViewportSize({ width: 1000, height: 900 }); await page.waitForTimeout(400);
            await page.screenshot({ path: path.join(output, style + '-wide.png') });
            await page.setViewportSize({ width: 390, height: 844 });
        }
        // The new catalog follows existing atomic placement and failure behavior.
        const saved = await page.evaluate(() => {
            const H = ByndHome3D, draft = { id: 'new-sideboard', furnitureId: 'european_sideboard', position: [1.7, 0, 2.1], rotation: 0 };
            H.Build.commit('living_room', draft); const before = localStorage.getItem(H.State.key), write = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key, value) { if (key === H.State.key) throw Error('quota'); return write.call(this, key, value); };
            let error = ''; try { H.Build.commit('living_room', { ...draft, rotation: Math.PI }); } catch (e) { error = e.message; } finally { Storage.prototype.setItem = write; }
            return { error, unchanged: before === localStorage.getItem(H.State.key), row: H.State.home().layouts.living_room.items[draft.id] };
        });
        assert.match(saved.error, /没有保存成功/); assert.equal(saved.unchanged, true); assert.equal(saved.row.rotation, 0); report.failedSave = saved;
        await page.reload(); await ready();
        assert.ok(await page.evaluate(() => ByndHome3D.runtime.furniture().some(row => row.item.id === 'european_sideboard')), 'placement survives reload');
        await page.evaluate(() => ByndHome3D.close()); assert.equal(await page.locator('canvas').count(), 0); assert.deepEqual(report.errors, []);
        fs.writeFileSync(path.join(output, 'review.json'), JSON.stringify(report, null, 2));
        console.log('Furniture browser checks passed:', designs.length, 'original designs; mobile rooms, placement persistence, failed save, disposal.');
    } finally { await browser.close(); server.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
