'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/home3d-build');
fs.mkdirSync(output, { recursive: true });
const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="apps/home3d/home3d.css"><style>html,body{margin:0;height:100%;font-family:Arial,'Microsoft Yahei',sans-serif}.app-window{height:100%;position:relative}#home3d-root{--bynd-header-safe-top:47px}</style></head><body><div class="app-window active"><div id="home3d-root"></div></div><script>window.myCharacters=[{id:'build-proof',name:'林间',personality:'温柔，喜欢阅读、植物和音乐',history:[],chatConfig:{}}];window.closeApp=()=>ByndHome3D.close();window.getLivingWorldRelevantEventsForChar=()=>[];</script><script src="apps/home3d/home3d.js"></script><script>ByndHome3D.open();</script></body></html>`;
const types = { '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json', '.html': 'text/html' };
const server = http.createServer((req, res) => {
    const route = req.url.split('?')[0];
    if (route === '/__home_build__') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fixture); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(route));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + (['.js', '.css', '.html'].includes(path.extname(file)) ? '; charset=utf-8' : '') }); fs.createReadStream(file).pipe(res);
});
(async () => {
    await new Promise(resolve => server.listen(8794, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errors = [], failures = []; page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) failures.push(r.url()); });
    const ready = () => page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
    try {
        await page.goto('http://127.0.0.1:8794/__home_build__'); await page.locator('[data-action="enter"]').click(); await ready();
        await page.evaluate(async () => { ByndHome3D.State.withHome(h => { h.theme = 'cream'; h.activity = { action: 'Read', target: 'sofa', room: 'living_room', reason: '刚翻到喜欢的一页', until: Date.now() + 600000 }; }); ByndHome3D.runtime.dispose(); ByndHome3D.runtime = null; await ByndHome3D.UI.loadRoom('living_room'); document.querySelector('.home3d-notice').hidden = true; });
        await ready(); await page.screenshot({ path: path.join(output, 'life-390.png') });
        await page.locator('[data-action="build"]').click();
        await page.locator('[data-build-style]').selectOption('japanese'); await page.locator('[data-category="装饰"]').click();
        await page.waitForTimeout(150);
        const card = page.locator('[data-furniture="japanese_plant"]'); const from = await card.boundingBox();
        const to = await page.evaluate(() => ByndHome3D.runtime.project(1.8, 1.8));
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 14 }); await page.mouse.up();
        await page.waitForFunction(() => ByndHome3D.runtime.draft()?.furnitureId === 'japanese_plant');
        let draft = await page.evaluate(() => ByndHome3D.runtime.draft());
        assert.ok(Math.abs(draft.position[0] - 1.8) <= .2 && Math.abs(draft.position[2] - 1.8) <= .2, 'pointer drag projects onto the room floor');
        const placedId = draft.id; await page.locator('[data-action="build-rotate"]').click();
        await page.screenshot({ path: path.join(output, 'drag-preview-390.png') });
        await page.locator('[data-action="build-confirm"]').click(); await ready();
        assert.equal(await page.evaluate(id => ByndHome3D.State.home().layouts.living_room.items[id].rotation, placedId), Math.PI / 2);
        // Moving an existing object and canceling must preserve its saved transform.
        await page.evaluate(id => ByndHome3D.BuildUI.edit(id), placedId); await page.locator('[data-action="build-nudge"][data-dx="-0.2"]').click(); await page.locator('[data-action="build-cancel"]').click();
        assert.ok(await page.evaluate(id => Math.abs(ByndHome3D.State.home().layouts.living_room.items[id].position[0] - 1.8) <= .2, placedId));
        await page.evaluate(id => ByndHome3D.BuildUI.edit(id), placedId);
        const original = await page.evaluate(() => localStorage.getItem(ByndHome3D.State.key));
        await page.evaluate(() => { window.homeStorageWrite = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === ByndHome3D.State.key) throw Error('quota fixture'); return window.homeStorageWrite.call(this, key, value); }; });
        await page.locator('[data-action="build-confirm"]').click();
        assert.match(await page.locator('.home3d-notice').textContent(), /没有保存成功/);
        assert.equal(await page.evaluate(() => localStorage.getItem(ByndHome3D.State.key)), original);
        assert.ok(await page.evaluate(() => !!ByndHome3D.runtime.draft()), 'failed save leaves the editable preview');
        await page.evaluate(() => { Storage.prototype.setItem = window.homeStorageWrite; delete window.homeStorageWrite; });
        await page.locator('[data-action="build-remove"]').click(); await ready();
        assert.equal(await page.evaluate(id => ByndHome3D.Rooms.placements(ByndHome3D.Rooms.get('living_room'), ByndHome3D.State.home()).some(p => p.id === id), placedId), false);
        // Initial layout supports additions without needing to remove existing furniture.
        await page.evaluate(() => ByndHome3D.Build.validate(ByndHome3D.Rooms.get('living_room'), ByndHome3D.State.home(), { id: 'proof', furnitureId: 'cream_plant', position: [1.8, 0, 1.8], rotation: 0 }));
        await page.locator('[data-action="build-rooms"]').click(); await page.locator('[data-action="expand-room"][data-room="studio"]').click(); await ready();
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().room), 'studio');
        await page.evaluate(async () => { ByndHome3D.State.withHome(h => { h.activity = { action: 'Play Music', target: 'piano', room: 'studio', reason: '想弹一首轻轻的曲子', until: Date.now() + 600000 }; }); await ByndHome3D.UI.loadRoom('studio'); document.querySelector('.home3d-notice').hidden = true; });
        await ready(); await page.screenshot({ path: path.join(output, 'studio-390.png') });
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').action), 'Play Music');
        await page.locator('[data-action="build"]').click(); await page.locator('[data-build-style]').selectOption('chinese'); await page.locator('[data-category="床"]').click();
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: width === 320 ? 667 : 844 });
            await page.screenshot({ path: path.join(output, 'build-' + width + '.png') });
            const layout = await page.evaluate(() => {
                const header = document.querySelector('.home3d-header').getBoundingClientRect(), back = document.querySelector('[data-action="back"]').getBoundingClientRect(), scene = document.querySelector('.home3d-world').getBoundingClientRect(), tray = document.querySelector('.home3d-build-tray').getBoundingClientRect();
                return { header: header.height, back: back.top, scene: scene.height, tray: tray.bottom, width: document.querySelector('#home3d-root').scrollWidth, viewport: innerWidth, height: innerHeight };
            });
            assert.ok(layout.back >= 47 && layout.header < 120, 'one native top inset'); assert.ok(layout.scene >= 190 && layout.tray <= layout.height + 1 && layout.width <= layout.viewport, 'phone layout remains usable');
        }
        await page.locator('[data-action="build-done"]').click();
        // A new local activity visibly walks toward an installed facility.
        await page.evaluate(async () => { ByndHome3D.State.withHome(h => { h.activity = { action: 'Read', target: 'desk', room: 'studio', reason: '看书', until: Date.now() + 600000 }; }); await ByndHome3D.UI.loadRoom('studio'); ByndHome3D.runtime.setCharActivity({ action: 'Play Music', target: 'piano', room: 'studio' }); });
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').action), 'Walk');
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').action === 'Play Music', { timeout: 20000 });
        for (const [hour, name] of [[10, 'day'], [22, 'night']]) {
            await page.clock.setFixedTime(new Date(2026, 9, 1, hour));
            await page.locator('[data-action="entrance"]').click();
            await page.waitForFunction(() => document.querySelector('.home3d-entry>img')?.complete && document.querySelector('.home3d-entry>img')?.naturalWidth > 0);
            await page.screenshot({ path: path.join(output, 'entrance-' + name + '.png') });
            assert.equal(await page.locator('.home3d-entry>img').getAttribute('src'), 'assets/home3d/entrance/' + name + '.png');
            await page.locator('[data-action="home-enter"]').click(); await ready();
        }
        await page.reload(); await page.locator('[data-action="home-enter"]').click(); await ready();
        assert.ok(await page.evaluate(() => ByndHome3D.State.home().openRooms.includes('studio')));
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().room), 'studio');
        assert.deepEqual(errors, []); assert.deepEqual(failures, []);
        await page.evaluate(() => ByndHome3D.close()); assert.equal(await page.locator('canvas').count(), 0);
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ result: 'passed', errors, failures, widths: [320, 375, 390, 430], verified: ['pointer-drag', 'rotation', 'cancel', 'save-failure', 'delete', 'expansion', 'autonomous-walk', 'day-night', 'reload', 'native-safe-area', 'dispose'] }, null, 2));
        console.log('Home build browser checks passed.');
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
