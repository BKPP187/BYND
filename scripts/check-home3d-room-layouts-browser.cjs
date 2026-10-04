'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const output = path.resolve('artifacts/home3d-renderer/room-layouts-v1');
async function main() {
    const { chromium } = require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r)); fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { rooms: [], errors: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        page.on('pageerror', e => report.errors.push(e.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/room?action=Lie');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading') && ByndHome3D.runtime.stats().actors.find(a => a.who === 'char')?.action === 'Lie');
        await page.evaluate(() => {
            const H = ByndHome3D, update = H.SleepPair.update;
            H.SleepPair.update = (f, a, c) => { window.layoutActors = a; update(f, a, c); };
            H.runtime.setQuality('balanced'); H.runtime.camera.focus(-.2, -1.35); H.runtime.zoom(Math.log(1.8));
        });
        await page.waitForFunction(() => window.layoutActors && ByndHome3D.runtime.stats().camera.zoom > 1.79);
        report.sofa = await page.evaluate(() => {
            const H = ByndHome3D, actor = layoutActors.find(a => a.who === 'char'), row = H.runtime.furniture().find(f => f.placement.id === 'sofa');
            return { torso: H.SleepPair.bounds(actor, row.model, .50, .74), head: H.SleepPair.bounds(actor, row.model, .80, 1), support: H.Furniture.support(row.item), pose: H.CharacterModels.geometry(actor) };
        });
        await page.screenshot({ path: path.join(output, 'sofa-rest-close.png') });
        assert.ok(report.sofa.torso.min.y >= .615 && report.sofa.torso.min.y < .65, 'back touches seat: ' + report.sofa.torso.min.y);
        assert.ok(report.sofa.head.min.y >= report.sofa.support.pillowSurface - .005 && report.sofa.head.min.y < report.sofa.support.pillowSurface + .025, 'head touches pillow: ' + report.sofa.head.min.y);
        for (const [room, target, action] of [['game_room', 'desk', 'Game'], ['bedroom', 'bed', 'Sleep'], ['kitchen', 'stove', 'Cook'], ['dining_room', 'dining-table', 'Eat']]) {
            await page.evaluate(async ({ room, target, action }) => {
                const H = ByndHome3D;
                H.State.withHome(h => { h.activity = { room, target, action, source: 'local', until: Date.now() + 600000 }; });
                await H.UI.loadRoom(room); H.runtime.setQuality('balanced');
                document.querySelector('.home3d-notice').hidden = true;
            }, { room, target, action });
            await page.waitForFunction(({ room, action }) => ByndHome3D.runtime.stats().room === room && ByndHome3D.runtime.stats().actors.find(a => a.who === 'char')?.action === action && !document.querySelector('.home3d-scene.is-loading'), { room, action });
            const state = await page.evaluate(() => {
                const H = ByndHome3D, T = ByndHomeEngine, rows = H.runtime.furniture(), actor = layoutActors.find(a => a.who === 'char');
                const monitor = rows.find(r => r.item.type === 'computer');
                let facing = null;
                if (monitor) { const direction = new T.Vector3(0, 0, 1).transformDirection(monitor.model.matrixWorld), delta = actor.root.position.clone().sub(monitor.model.position); delta.y = 0; facing = direction.dot(delta.normalize()); }
                return { stats: H.runtime.stats(), anchor: actor.anchor, monitorFacing: facing, furniture: rows.map(r => ({ id: r.placement.id, type: r.item.type, name: r.item.name })), overflow: document.documentElement.scrollWidth > innerWidth, header: document.querySelector('.home3d-header button').getBoundingClientRect().top };
            });
            assert.equal(state.overflow, false); assert.ok(state.stats.resolution.pixelRatio <= 2); assert.equal(state.stats.actors.find(a => a.who === 'char').pose.bodyScale.y, 1);
            if (room === 'game_room') { assert.ok(state.monitorFacing > .8); assert.ok(state.anchor.seatId); assert.ok(!state.furniture.some(r => r.type === 'television')); }
            if (room === 'bedroom') assert.equal(state.stats.actors.find(a => a.who === 'char').pose.eyesClosed, true);
            if (room === 'kitchen') {
                assert.equal(state.anchor.rotation, Math.PI);
                report.cooking = await page.evaluate(() => {
                    const actor = layoutActors.find(a => a.who === 'char'), cycle = actor.cookCycle;
                    return { visible: actor.cookTool?.visible, mode: cycle?.mode, handError: cycle?.maxError, holdError: cycle?.maxHoldError, tipError: cycle?.tipError, steam: ByndHome3D.runtime.furniture().find(r => r.item.type === 'stove').model.getObjectByName('cooking-steam')?.visible };
                });
                assert.equal(report.cooking.visible, true); assert.equal(report.cooking.mode, 'stir');
                assert.ok(report.cooking.handError < .012 && report.cooking.holdError < .012 && Math.abs(report.cooking.tipError) < .012);
                assert.equal(report.cooking.steam, true);
            }
            if (room === 'dining_room') assert.ok(state.anchor.seatId && state.anchor.seated);
            await page.screenshot({ path: path.join(output, room + '-390.png') });
            await page.setViewportSize({ width: 320, height: 740 });
            for (const safe of [47, 59]) for (const parent of [false, true]) {
                await page.evaluate(({ safe, parent }) => { const win = document.querySelector('#demo-window'); win.style.paddingTop = parent ? safe + 'px' : '0px'; win.style.boxSizing = 'border-box'; document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top', (parent ? 0 : safe) + 'px'); }, { safe, parent });
                const box = await page.locator('.home3d-header button').first().boundingBox(); assert.ok(box.y >= safe && box.y < safe + 10, 'safe area');
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            }
            await page.screenshot({ path: path.join(output, room + '-320.png') });
            await page.setViewportSize({ width: 390, height: 844 });
            await page.evaluate(() => { document.querySelector('#demo-window').style.paddingTop = '0'; document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top', '0px'); });
            report.rooms.push(state);
        }
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.interact('dining-table', 'Eat')), true);
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.every(a => a.action === 'Eat'), {}, { timeout: 30000 });
        await page.screenshot({ path: path.join(output, 'dining-together.png') });
        await page.evaluate(async () => {
            const H = ByndHome3D;
            H.State.withHome(home => { home.layouts ||= {}; home.layouts.dining_room = { items: { 'chair-center': { id: 'chair-center', furnitureId: 'cream_chair', position: [0, 0, .95], rotation: Math.PI } }, removed: ['chair-front-left', 'chair-front-right', 'chair-back-left', 'chair-back-right'] }; });
            await H.UI.loadRoom('dining_room');
        });
        const seatBusy = await page.evaluate(() => { try { ByndHome3D.runtime.interact('dining-table', 'Eat'); return ''; } catch (e) { return e.message; } });
        assert.match(seatBusy, /椅子Ta正在用/);
        await page.evaluate(async () => { ByndHome3D.Build.remove('dining_room', 'chair-center'); await ByndHome3D.UI.loadRoom('dining_room'); });
        const seatMissing = await page.evaluate(() => { try { ByndHome3D.runtime.interact('dining-table', 'Eat'); return ''; } catch (e) { return e.message; } });
        assert.match(seatMissing, /摆好.*椅子/); report.seatFailures = { seatBusy, seatMissing };
        await page.evaluate(async () => {
            const H = ByndHome3D; H.Interiors.apply('game_room', { preset: 'pink' }, true);
            H.State.withHome(h => { h.activity = { room: 'game_room', target: 'computer', action: 'Game', until: Date.now() + 600000 }; }); await H.UI.loadRoom('game_room');
            const T = ByndHomeEngine, materials = H.Materials.create('cream'), shell = H.Rooms.shell(H.Rooms.get('game_room'), materials, H.State.home());
            window.gameHasMirror = !!shell.getObjectByName('wall-mirror'); H.Shapes.disposeGeometry(shell);
        });
        assert.equal(await page.evaluate(() => window.gameHasMirror), false);
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').pose.kind), 'seated');
        await page.screenshot({ path: path.join(output, 'gaming-pink.png') });
        assert.deepEqual(report.errors, []);
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('Room layouts passed: sofa contact, workstation direction/chair, bedroom sleep, cooking, two dining seats, 320px safe areas and no gaming mirror.');
    } finally { await browser.close(); server.close(); }
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
