'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const { execFileSync } = require('node:child_process');
const output = path.resolve('artifacts/home3d-cozy');
async function main() {
    const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    fs.mkdirSync(output, { recursive: true });
    const baseline = process.argv.includes('--baseline'), server = createServer();
    if (baseline) {
        // Read the original tracked runtime without changing the working tree.
        const routes = new Map();
        for (const name of ['home3d', 'room-camera', 'character-models', 'scene', 'portraits', 'materials', 'daylight', 'ui', 'data/catalogs']) {
            const file = 'apps/home3d/' + name + '.js'; routes.set('/' + file, execFileSync('git', ['show', 'HEAD:' + file], { maxBuffer: 8 * 1024 * 1024 }));
        }
        const [serve] = server.listeners('request'); server.removeAllListeners('request');
        server.on('request', (req, res) => { const data = routes.get(new URL(req.url, 'http://localhost').pathname); if (!data) return serve(req, res); res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(data); });
    }
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { errors: [], layouts: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        page.on('pageerror', e => report.errors.push(e.message));
        await page.addInitScript(() => {
            window.homeMeasures = { longTasks: [] };
            new PerformanceObserver(list => list.getEntries().forEach(e => homeMeasures.longTasks.push({ start: e.startTime, duration: e.duration }))).observe({ type: 'longtask', buffered: true });
        });
        await page.goto('http://127.0.0.1:' + server.address().port + '/room?villa=1');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'), null, { timeout: 120000 });
        report.readyMs = await page.evaluate(() => performance.now());
        await page.waitForFunction(() => ByndHome3D.runtime.stats().quality.measurements.fps > 0, null, { timeout: 20000 });
        report.initial = await page.evaluate(() => ({ stats: ByndHome3D.runtime.stats(), resources: performance.getEntriesByType('resource').map(r => ({ name: r.name.split('/').pop(), bytes: r.decodedBodySize, ms: r.duration })), ...homeMeasures }));
        await page.screenshot({ path: path.join(output, baseline ? 'before.png' : 'living-room.png') });
        fs.writeFileSync(path.join(output, baseline ? 'baseline.json' : 'report.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify({ readyMs: report.readyMs, calls: report.initial.stats.calls, triangles: report.initial.stats.triangles, frame: report.initial.stats.quality.measurements, bytes: report.initial.resources.reduce((s, r) => s + r.bytes, 0), longTasks: report.initial.longTasks.length }));
        if (baseline) return;
        assert.ok(!report.initial.resources.some(r => /initial-(sleep-)?portraits/.test(r.name)), '3D entry must not download unused portrait byte mirrors');
        assert.ok(!report.initial.resources.some(r => /^(middle|near)\.glb/.test(r.name)), 'smooth entry keeps its model budget even from close indoor cameras');
        assert.ok(report.initial.stats.calls < 220, 'indoor rendering must stay below 220 draw calls on the automatic smooth tier');
        assert.equal(report.initial.stats.camera.mode, 'interior'); assert.equal(report.initial.stats.camera.perspective, true);
        await page.locator('[data-action="settings"]').click();
        await page.waitForFunction(() => [...document.querySelectorAll('.home3d-portrait-preview img')].every(i => i.complete && i.naturalWidth > 0));
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('.home3d-portrait-preview img')].every(i => /^data:image\/png/.test(i.src))), true, 'settings previews use the retained APK byte mirrors');
        await page.locator('.home3d-modal [data-action="dismiss"]').click();
        await page.evaluate(() => {
            const update = ByndHome3D.Atmosphere.update;
            ByndHome3D.Atmosphere.update = (groups, ...args) => { window.cozyGroups = groups; update(groups, ...args); };
        });
        for (const width of [320, 390, 430]) for (const safe of [47, 59]) for (const parent of [false, true]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, parent }) => {
                const win = document.querySelector('#demo-window'); win.style.paddingTop = parent ? safe + 'px' : '0px'; win.style.boxSizing = 'border-box';
                document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top', (parent ? 0 : safe) + 'px');
            }, { safe, parent });
            await page.waitForFunction(() => {
                const box = document.querySelector('.home3d-scene').getBoundingClientRect(), r = ByndHome3D.runtime.stats().resolution;
                return Math.abs(r.width - box.width * r.pixelRatio) <= 1 && Math.abs(r.height - box.height * r.pixelRatio) <= 1;
            });
            const layout = await page.evaluate(() => ({ top: document.querySelector('.home3d-header button').getBoundingClientRect().top, overflow: document.documentElement.scrollWidth > innerWidth, camera: ByndHome3D.runtime.stats().camera }));
            assert.ok(layout.top >= safe && layout.top < safe + 10); assert.equal(layout.overflow, false); report.layouts.push({ width, safe, parent, ...layout });
            if (width === 320 && safe === 59) await page.screenshot({ path: path.join(output, 'safe-320-' + (parent ? 'parent' : 'header') + '.png') });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => { document.querySelector('#demo-window').style.paddingTop = '0px'; document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top', '0px'); });
        for (const mode of ['first', 'third', 'isometric', 'interior']) {
            await page.evaluate(mode => ByndHome3D.runtime.setViewpoint(mode), mode);
            await page.waitForFunction(mode => ByndHome3D.runtime.stats().renderedView === mode, mode);
            assert.equal(await page.evaluate(() => cozyGroups.filter(g => g.userData.atmosphere).every(g => g.userData.atmosphere.ceiling.visible)), mode !== 'isometric');
        }
        await page.evaluate(() => ByndHome3D.runtime.setWalls('hidden'));
        await page.waitForFunction(() => cozyGroups.filter(g => g.userData.atmosphere).every(g => !g.visible));
        await page.evaluate(() => ByndHome3D.runtime.setWalls('cutaway'));
        await page.waitForFunction(() => cozyGroups.filter(g => g.userData.atmosphere).every(g => g.visible));
        await page.evaluate(async () => {
            const H = ByndHome3D; H.State.withHome(h => { h.room = 'game_room'; h.activity = { room: 'game_room', target: 'desk', action: 'Game', until: Date.now() + 600000 }; });
            await H.UI.loadRoom('game_room', { rebuild: true, throwOnError: true });
        });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().renderedView === 'interior' && ByndHome3D.runtime.stats().room === 'game_room');
        await page.screenshot({ path: path.join(output, 'game-room.png') }); report.gameRoom = await page.evaluate(() => ByndHome3D.runtime.stats());
        await page.evaluate(() => { const H = ByndHome3D, sample = H.Daylight.sample; window.cozyDaylight = sample; H.Daylight.sample = () => sample(new Date(2026, 9, 17, 23)); return H.runtime.setViewpoint('interior'); });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().lighting.night && cozyGroups.filter(g => g.userData.atmosphere).every(g => !g.userData.atmosphere.daylight.visible));
        await page.screenshot({ path: path.join(output, 'game-room-night.png') }); report.night = await page.evaluate(() => ByndHome3D.runtime.stats().lighting);
        await page.evaluate(() => { ByndHome3D.Daylight.sample = cozyDaylight; });
        // Lazy resources must surface failures and allow retry; a failed request
        // must never poison the shared script/portrait caches.
        await page.route('**/initial-portraits.js', route => route.abort());
        report.lazyFailure = await page.evaluate(async () => { try { await ByndHome3D.Portraits.initial('user'); return ''; } catch (e) { return e.message; } });
        assert.match(report.lazyFailure, /没能加载/); await page.unroute('**/initial-portraits.js');
        report.lazyRetry = await page.evaluate(async () => { const images = await Promise.all([ByndHome3D.Portraits.initial('user'), ByndHome3D.Portraits.initial('char')]); return images.every(i => i.transparent && /^data:image\/png/.test(i.url)); });
        assert.equal(report.lazyRetry, true);
        report.failedCharacter = await page.evaluate(async () => {
            const H = ByndHome3D, create = H.CharacterModels.create; let disposed = 0, message = '';
            H.CharacterModels.create = async (who, ...args) => {
                if (who === 'char') throw Error('模拟人物读取失败');
                const actor = await create(who, ...args); actor.root.traverse(n => { n.geometry?.addEventListener('dispose', () => disposed++); }); return actor;
            };
            try { await H.UI.loadRoom('game_room', { rebuild: true, throwOnError: true }); } catch (e) { message = e.message; } finally { H.CharacterModels.create = create; }
            return { message, disposed, errorVisible: !document.querySelector('.home3d-scene-error').hidden };
        });
        assert.match(report.failedCharacter.message, /模拟人物读取失败/); assert.ok(report.failedCharacter.disposed > 0); assert.equal(report.failedCharacter.errorVisible, true);
        await page.evaluate(() => ByndHome3D.UI.loadRoom('game_room', { rebuild: true, throwOnError: true }));
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.length), 2);
        assert.deepEqual(report.errors, []);
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    } finally { await browser.close(); await new Promise(r => server.close(r)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
