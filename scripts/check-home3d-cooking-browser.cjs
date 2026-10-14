'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const output = path.resolve('artifacts/home3d-renderer/cooking');
async function main() {
    const { chromium } = require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { poses: [], errors: [] }; fs.mkdirSync(output, { recursive: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        page.on('pageerror', e => report.errors.push(e.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/room?room=kitchen');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.find(a => a.who === 'char')?.action === 'Cook' && !document.querySelector('.home3d-scene.is-loading'));
        await page.evaluate(() => {
            const H = ByndHome3D, update = H.SleepPair.update;
            H.SleepPair.update = (f, a, c) => { window.cookActors = a; update(f, a, c); };
            H.runtime.setQuality('balanced'); H.runtime.camera.focus(-1.1, -1.65); H.runtime.zoom(Math.log(2.3));
            document.querySelector('.home3d-notice').hidden = true;
        });
        await page.waitForFunction(() => window.cookActors && ByndHome3D.runtime.stats().camera.zoom > 2.29);
        const sample = async (who, name) => {
            await page.waitForFunction(who => !cookActors.find(a => a.who === who).loading, who);
            const pose = await page.evaluate(who => {
                const H = ByndHome3D, T = ByndHomeEngine, actor = cookActors.find(a => a.who === who), cycle = actor.cookCycle;
                const grip = H.Cooking.hand(actor, cycle.side), tool = actor.cookTool;
                const end = tool.localToWorld(new T.Vector3(0, tool.userData.length, 0));
                const row = H.runtime.furniture().find(r => r.placement.id === actor.anchor.placementId), point = new T.Vector3(); let clearance = Infinity;
                for (const mesh of actor.meshes) for (const index of new Set(mesh.geometry.index.array)) {
                    mesh.getVertexPosition(index, point); point.applyMatrix4(mesh.matrixWorld); row.model.worldToLocal(point);
                    if (point.y > .18 && point.y < .85 && Math.abs(point.x) < row.item.footprint[0] / 2) clearance = Math.min(clearance, point.z - row.item.footprint[1] / 2);
                }
                return { who, mode: cycle.mode, handError: cycle.maxError, supportError: cycle.maxHoldError, tipError: end.distanceTo(cycle.tip), attached: tool.getWorldPosition(new T.Vector3()).distanceTo(grip), clearance, visible: tool.visible, source: actor.level, steam: H.runtime.furniture().find(r => r.item.type === 'stove').model.getObjectByName('cooking-steam').visible, position: end.toArray() };
            }, who);
            assert.ok(pose.handError < .012 && pose.supportError < .012, JSON.stringify(pose));
            assert.ok(pose.attached < .001 && pose.tipError < .012, JSON.stringify(pose)); assert.equal(pose.visible, true);
            assert.ok(pose.clearance > 0, 'outfit outside cupboard: ' + JSON.stringify(pose));
            report.poses.push({ name, ...pose }); await page.screenshot({ path: path.join(output, name + '.png') }); return pose;
        };
        const first = await sample('char', 'male-stir'); assert.equal(first.steam, true);
        report.busy = await page.evaluate(() => { try { ByndHome3D.runtime.interact('stove', 'Cook'); return ''; } catch (e) { return e.message; } });
        assert.match(report.busy, /Ta正在用/);
        await page.evaluate(() => {
            const H = ByndHome3D; H.State.withHome(h => { h.activity = { room: 'living_room', action: 'Idle', until: Date.now() + 600000 }; });
            H.runtime.setCharActivity(H.State.home().activity, true);
            window.cookingFinished = false;
            if (!H.runtime.interact('stove', 'Cook', () => { window.cookingFinished = true; })) throw new Error('Stove path blocked');
        });
        await page.waitForFunction(() => window.cookingFinished && cookActors.find(a => a.who === 'user').action === 'Cook', {}, { timeout: 45000 });
        await sample('user', 'female-stir');
        await page.evaluate(() => ByndHome3D.runtime.setQuality('smooth'));
        await page.waitForFunction(() => !ByndHome3D.runtime.furniture().find(r => r.item.type === 'stove').model.getObjectByName('cooking-steam').visible);
        await sample('user', 'female-smooth');
        await page.evaluate(() => {
            const H = ByndHome3D; H.runtime.setQuality('balanced'); H.runtime.emote('Idle');
            H.State.withHome(h => { h.activity = { room: 'kitchen', target: 'prep', action: 'Cook', until: Date.now() + 600000 }; });
            H.runtime.setCharActivity(H.State.home().activity, true); H.runtime.camera.focus(1.9, -1.65);
        });
        await page.waitForFunction(() => cookActors.find(a => a.who === 'char').cookCycle?.mode === 'chop');
        const prep = await sample('char', 'male-chop'); assert.equal(prep.steam, false);
        await page.evaluate(() => {
            const H = ByndHome3D; H.State.withHome(h => { h.activity = { room: 'living_room', action: 'Idle', until: Date.now() + 600000 }; });
            H.runtime.setCharActivity(H.State.home().activity, true); window.cookingFinished = false;
            if (!H.runtime.interact('prep', 'Cook', () => { window.cookingFinished = true; })) throw new Error('Prep path blocked');
        });
        await page.waitForFunction(() => window.cookingFinished && cookActors.find(a => a.who === 'user').cookCycle?.mode === 'chop', {}, { timeout: 45000 });
        await sample('user', 'female-chop');
        await page.setViewportSize({ width: 320, height: 740 });
        for (const safe of [47, 59]) for (const parent of [false, true]) {
            await page.evaluate(({ safe, parent }) => { document.querySelector('#demo-window').style.paddingTop = parent ? safe + 'px' : '0px'; document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top', (parent ? 0 : safe) + 'px'); }, { safe, parent });
            const box = await page.locator('.home3d-header button').first().boundingBox(); assert.ok(box.y >= safe && box.y < safe + 10);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        }
        await page.screenshot({ path: path.join(output, 'chop-320-safe59.png') });
        assert.deepEqual(report.errors, []); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        console.log('Cooking browser passed: both characters grip actual cookware, occupied stove rejects, prep uses knife, smooth disables steam, mobile safe areas.');
    } finally { await browser.close(); server.close(); }
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
