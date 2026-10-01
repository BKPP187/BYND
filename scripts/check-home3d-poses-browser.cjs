'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/home3d-cozy'); fs.mkdirSync(output, { recursive: true });
const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="apps/home3d/home3d.css"><style>html,body{margin:0;height:100%;font-family:Arial,'Microsoft Yahei',sans-serif}.app-window{height:100%;position:relative;box-sizing:border-box}</style></head><body><div class="app-window active"><div id="home3d-root"></div></div><script>window.myCharacters=[{id:'cozy-proof',name:'林间',personality:'喜欢阅读',history:[],chatConfig:{}}];window.closeApp=()=>ByndHome3D.close();window.getLivingWorldRelevantEventsForChar=()=>[];</script><script src="apps/home3d/home3d.js"></script><script>ByndHome3D.open();</script></body></html>`;
const mime = { '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
    const route = req.url.split('?')[0]; if (route === '/__poses__') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fixture); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(route));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': (mime[path.extname(file)] || 'application/octet-stream') + (['.js', '.css', '.json'].includes(path.extname(file)) ? '; charset=utf-8' : '') }); fs.createReadStream(file).pipe(res);
});
(async () => {
    await new Promise(resolve => server.listen(8795, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const errors = [], checks = [];
    page.on('pageerror', e => errors.push(e.message));
    const ready = () => page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
    const load = async (room, action, target, theme = 'cream') => {
        await page.evaluate(async ({ room, action, target, theme }) => {
            const H = ByndHome3D; H.State.withHome(h => { h.theme = theme; h.activity = { room, action, target, reason: action === 'Sleep' ? '在软软的被窝里睡着了' : '给你留了身旁的位置', until: Date.now() + 3600000 }; });
            H.runtime?.dispose(); H.runtime = null; await H.UI.loadRoom(room); document.querySelector('.home3d-notice').hidden = true;
        }, { room, action, target, theme }); await ready();
    };
    const shot = async name => { await page.waitForTimeout(120); await page.screenshot({ path: path.join(output, name + '.png') }); };
    const rotateCamera = async (dx, dy) => {
        const rect = await page.locator('canvas').boundingBox(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(100);
    };
    try {
        await page.goto('http://127.0.0.1:8795/__poses__'); await page.locator('[data-action="enter"]').click(); await ready();
        await load('bedroom', 'Sleep', 'bed');
        await page.evaluate(() => ByndHome3D.runtime.interact('bed', 'Sleep'));
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'user').action === 'Sleep', null, { timeout: 20000 });
        await shot('bedroom-day'); await page.evaluate(() => ByndHome3D.runtime.zoom(.45)); await shot('bedroom-detail');
        await rotateCamera(50, -30); await shot('bedroom-side');
        await load('bedroom', 'Sleep', 'bed', 'night'); await shot('bedroom-night');
        // Head endpoints must stay at the pillow end in furniture local space,
        // including changed bed styles, heights, rotations and camera rotations.
        for (const id of ['bed_cloud_01', 'cream_bed', 'european_bed', 'japanese_bed', 'modern_bed', 'chinese_bed']) for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            await page.evaluate(({ id, rotation }) => {
                const H = ByndHome3D; H.State.withHome(h => { h.layouts.bedroom = { items: { bed: { id: 'bed', furnitureId: id, position: [0, 0, -.4], rotation } }, removed: H.Rooms.get('bedroom').furniture.filter(p => p.id !== 'bed').map(p => p.id) }; });
            }, { id, rotation });
            await load('bedroom', 'Sleep', 'bed');
            const result = await page.evaluate(() => {
                const H = ByndHome3D, a = H.runtime.stats().actors.find(a => a.who === 'char'), row = H.runtime.furniture().find(f => f.placement.id === 'bed'), r = row.placement.rotation, p = row.placement.position;
                const local = v => ({ x: (v.x - p[0]) * Math.cos(r) - (v.z - p[2]) * Math.sin(r), y: v.y - p[1], z: (v.x - p[0]) * Math.sin(r) + (v.z - p[2]) * Math.cos(r) });
                return { head: local(a.pose.head), feet: local(a.pose.feet), pose: a.pose, size: row.item.footprint, support: H.Furniture.support(row.item), geometries: H.runtime.stats().geometries };
            });
            assert.equal(result.pose.kind, 'lying'); assert.equal(result.pose.depthTest, true); assert.equal(result.pose.eyesClosed, true);
            assert.ok(result.head.z < -result.size[1] * .4 && result.feet.z > result.head.z + .8, 'head points toward the pillow instead of screen left');
            assert.ok(result.head.y > result.support.sleepHeight + .15 && result.feet.y >= result.support.sleepHeight - .001, 'head clears the pillow, feet rest above the mattress');
            assert.ok(Math.abs(result.head.x) + result.pose.width / 2 <= result.size[0] / 2 + .001, 'portrait fits its own half of the bed without stretching');
            checks.push({ id, rotation, ...result });
            if (id === 'bed_cloud_01' && rotation === Math.PI / 2) { await rotateCamera(-60, 50); const after = await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').pose); assert.ok(Math.abs(after.head.x - result.pose.head.x) < .001 && Math.abs(after.head.z - result.pose.head.z) < .001, 'rotating the camera cannot rotate a lying character'); await shot('bed-rotated'); }
        }
        await page.evaluate(() => ByndHome3D.State.withHome(h => { delete h.layouts.bedroom; }));
        await load('living_room', 'Read', 'sofa');
        await page.evaluate(() => ByndHome3D.runtime.interact('sofa', 'Sit'));
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'user').action === 'Sit', null, { timeout: 20000 });
        await shot('sofa-together'); await page.evaluate(() => ByndHome3D.runtime.zoom(.45)); await shot('sofa-detail');
        for (const [dx, dy, name] of [[70, -50, 'sofa-left'], [-140, 90, 'sofa-right']]) {
            await rotateCamera(dx, dy); await shot(name);
            const poses = await page.evaluate(() => ByndHome3D.runtime.stats().actors);
            for (const a of poses) { assert.equal(a.pose.kind, 'seated'); assert.ok(a.pose.feet.y >= .07 && a.pose.head.y > 1.3); assert.ok(a.pose.feet.z > a.position.z + .3); assert.equal(a.pose.depthTest, true); }
        }
        await page.evaluate(() => { ByndHome3D.State.withHome(h => { h.consentHug = true; }); ByndHome3D.runtime.interact('sofa', 'Hug'); });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.every(a => a.action === 'Hug'), null, { timeout: 20000 });
        const hugging = await page.evaluate(() => ByndHome3D.runtime.stats().actors); for (const a of hugging) assert.ok(a.pose.feet.z > a.position.z + .3, 'hugging cannot swing feet through the seat');
        const rejectLie = await page.evaluate(() => { try { ByndHome3D.runtime.interact('sofa', 'Lie'); return ''; } catch (error) { return error.message; } }); assert.match(rejectLie, /正在用/);
        await load('living_room', 'Lie', 'sofa');
        const rejectSit = await page.evaluate(() => { try { ByndHome3D.runtime.interact('sofa', 'Sit'); return ''; } catch (error) { return error.message; } }); assert.match(rejectSit, /正在用/);
        await load('living_room', 'Read', 'sofa');
        await page.evaluate(() => { const H = ByndHome3D; H.runtime.interact('sofa', 'Sit'); H.runtime.setCharActivity({ room: 'living_room', target: 'sofa', action: 'Lie' }); });
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').action), 'Idle', 'a destination reserves the sofa before arrival');
        for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            await page.evaluate(rotation => ByndHome3D.State.withHome(h => { h.layouts.living_room = { items: { sofa: { id: 'sofa', furnitureId: 'sofa_cream_01', position: [0, 0, -1.3], rotation } }, removed: ByndHome3D.Rooms.get('living_room').furniture.filter(p => p.id !== 'sofa').map(p => p.id) }; }), rotation);
            await load('living_room', 'Read', 'sofa');
            const result = await page.evaluate(() => {
                const H = ByndHome3D, row = H.runtime.furniture().find(f => f.placement.id === 'sofa'), a = H.runtime.stats().actors.find(a => a.who === 'char'), p = row.placement.position, r = row.placement.rotation;
                return { feetZ: (a.pose.feet.x - p[0]) * Math.sin(r) + (a.pose.feet.z - p[2]) * Math.cos(r), feetY: a.pose.feet.y, depth: row.item.footprint[1] };
            });
            assert.ok(result.feetZ > result.depth / 2 && result.feetY > .07, 'legs stay in front of the cushion after furniture rotation');
            if (rotation === Math.PI / 2) await shot('sofa-rotated');
        }
        await page.evaluate(() => ByndHome3D.State.withHome(h => { delete h.layouts.living_room; }));
        // Returning from a curved lying surface must not leave the seated plane
        // bent. A tall/narrow and a short/wide custom image retain their aspect.
        for (const ratio of [.45, 1.3]) {
            await page.evaluate(ratio => {
                const c = document.createElement('canvas'); c.width = Math.round(256 * ratio); c.height = 256; const ctx = c.getContext('2d'); ctx.fillStyle = '#97b29c'; ctx.fillRect(c.width * .2, 8, c.width * .6, 235);
                ByndHome3D.State.withHome(h => { h.portrait = { url: c.toDataURL(), width: c.width, height: c.height, transparent: true }; });
            }, ratio);
            await load('bedroom', 'Sleep', 'bed');
            const pose = await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').pose);
            assert.ok(Math.abs(pose.width / pose.length - Math.round(256 * ratio) / 256) < .001); assert.ok(pose.head.z < -1.9);
            await page.evaluate(() => ByndHome3D.runtime.setCharActivity({ action: 'Sit', target: 'bed', room: 'bedroom' }, true));
            await page.waitForTimeout(100); assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').pose.kind), 'seated');
        }
        await page.evaluate(() => ByndHome3D.State.withHome(h => { h.portrait = null; })); await load('bedroom', 'Sleep', 'bed');
        // Both supported safe-area ownership conventions, with two iPhone insets.
        for (const inset of [47, 59]) for (const owner of ['header', 'parent']) for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: width === 320 ? 667 : 844 });
            await page.evaluate(({ inset, owner }) => {
                const parent = document.querySelector('.app-window'); parent.style.paddingTop = owner === 'parent' ? inset + 'px' : '0px';
                parent.style.setProperty('--bynd-header-safe-top', owner === 'parent' ? '0px' : inset + 'px');
            }, { inset, owner });
            const layout = await page.evaluate(() => ({ back: document.querySelector('[data-action="back"]').getBoundingClientRect().top, bottom: document.querySelector('.home3d-footer').getBoundingClientRect().bottom, width: document.querySelector('#home3d-root').scrollWidth, world: document.querySelector('.home3d-world').getBoundingClientRect().height }));
            assert.ok(layout.back >= inset && layout.back <= inset + 14, 'exactly one top inset'); assert.ok(layout.width <= width && layout.bottom <= (width === 320 ? 667 : 844) + 1 && layout.world >= 300);
            if (width === 320 || (width === 430 && inset === 59)) await shot(`safe-${width}-${inset}-${owner}`);
        }
        assert.deepEqual(errors, []); await page.evaluate(() => ByndHome3D.close()); assert.equal(await page.locator('canvas').count(), 0);
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ result: 'passed', errors, bedPoses: checks, sofaRotations: 4, safeInsets: [47, 59], safeOwners: ['parent', 'header'], widths: [320, 375, 390, 430], checked: ['rotated-bed-head-at-pillow', 'closed-eye-initial-portraits', 'pillow-clearance', 'seat-height-and-front', 'paired-sofa', 'occupied-sofa-and-reservations', 'camera-independent-lying', 'portrait-aspect', 'lie-to-sit', 'day-night', 'dispose'] }, null, 2));
        console.log('Home pose and cozy-room browser checks passed.');
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
