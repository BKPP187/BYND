'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const output = path.resolve('artifacts/home3d-renderer/dining');
async function main() {
    const { chromium } = require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r)); fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { poses: [], errors: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        page.on('pageerror', e => report.errors.push(e.message));
        page.on('console', message => { if (/Shader Error|VALIDATE_STATUS|Error compiling/.test(message.text())) report.errors.push(message.text()); });
        await page.goto('http://127.0.0.1:' + server.address().port + '/room?room=dining_room');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.find(a => a.who === 'char')?.action === 'Eat' && !document.querySelector('.home3d-scene.is-loading'));
        await page.evaluate(() => {
            const H = ByndHome3D, update = H.SleepPair.update, tick = H.Animation.tick;
            H.SleepPair.update = (f, a, c) => { window.mealActors = a; update(f, a, c); };
            window.mealPhase = 0;
            window.mealView = (yaw, pitch) => { const camera = H.runtime.camera, current = camera.stats().desired; camera.rotate((current.yaw - yaw) / .007, (pitch - current.pitch) / .003); };
            const mealUpdate = H.Dining.update; H.Dining.update = (f, a, t, allowed, reduced) => { mealUpdate(f, a, 10000 + mealPhase * 10400, allowed, reduced); a.forEach(actor => { if (actor.mealPair) actor.mealPair.startedAt = 10000; }); mealUpdate(f, a, 10000 + mealPhase * 10400, allowed, reduced); };
            H.Animation.tick = (actor, time, dt, reduced) => tick(actor, ['Eat', 'Drink'].includes(actor.action) ? actor.startedAt + mealPhase * 5200 : time, dt, reduced);
            H.runtime.setQuality('balanced'); H.runtime.camera.focus(0, -.15); H.runtime.zoom(Math.log(1.55)); document.querySelector('.home3d-notice').hidden = true;
        });
        await page.waitForFunction(() => window.mealActors && ByndHome3D.runtime.stats().camera.zoom > 1.54);
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.interact('dining-table', 'Eat')), true);
        await page.waitForFunction(() => mealActors.every(a => a.action === 'Eat' && !a.loading), {}, { timeout: 45000 });
        const sample = async name => {
            const state = await page.evaluate(() => {
                const T = ByndHomeEngine;
                return mealActors.map(actor => {
                    const cycle = actor.diningCycle, prop = cycle.eating ? actor.eatTool : actor.cup;
                    const chair = ByndHome3D.runtime.furniture().find(r => r.placement.id === actor.anchor.seatId), hip = actor.hips.getWorldPosition(new T.Vector3()), localHip = chair.model.worldToLocal(hip.clone());
                    const hit = new T.Raycaster(new T.Vector3(hip.x, 2, hip.z), new T.Vector3(0, -1, 0)).intersectObject(chair.model, true)[0];
                    const partner = mealActors.find(a => a.who !== actor.who);
                    const end = cycle.eating ? prop.localToWorld(new T.Vector3(0, prop.userData.length, 0)) : prop.localToWorld(new T.Vector3(-.064, .045, -.049));
                    const lips = ByndHome3D.Dining.mouth(actor), partnerLips = ByndHome3D.Dining.mouth(partner);
                    return { who: actor.who, action: actor.action, level: actor.level, seat: actor.anchor.seatId, handError: cycle.maxError, attached: cycle.gripError, tipError: end.distanceTo(cycle.tip), lipDistance: end.distanceTo(cycle.partner ? partnerLips : lips), faceGap: lips.distanceTo(partnerLips), gaze: new T.Vector3(0, 0, 1).applyQuaternion(actor.head.getWorldQuaternion(new T.Quaternion())).dot(partnerLips.clone().sub(lips).normalize()), expressions: actor.expressions.map(e => ({ open: e.mouth.value, smile: e.smile.value, blink: e.blink.value })), pair: actor.mealPair, hip: localHip.toArray(), seatGap: hip.y - hit?.point.y, tip: end.toArray(), visible: prop.visible, cupVisible: actor.cup.visible, spoonVisible: actor.eatTool.visible, closedHands: actor.meshes.every(m => m.morphTargetInfluences[2] === 1) };
                });
            });
            for (const pose of state) { assert.ok(pose.handError < .015 && pose.attached < .001, JSON.stringify(pose)); assert.ok(pose.closedHands); assert.ok(Math.abs(pose.hip[0]) < .02 && pose.hip[2] >= -.15 && pose.hip[2] < .275 && Math.abs(pose.seatGap) < .015, 'body is supported by the actual cushion: ' + JSON.stringify(pose)); if (!pose.pair) assert.ok(pose.visible); if (pose.action === 'Eat') { assert.equal(pose.cupVisible, false); assert.ok(pose.tipError < .015); if (pose.pair) assert.equal(pose.visible, pose.pair.feeding); } if (['feed-char', 'feed-user', 'drink-together', 'drink-face-close'].includes(name) && (!pose.pair || pose.pair.feeding)) assert.ok(pose.lipDistance < .028, 'prop reaches lips: ' + JSON.stringify(pose)); }
            assert.notEqual(state[0].seat, state[1].seat); report.poses.push({ name, state }); await page.screenshot({ path: path.join(output, name + '.png') });
        };
        await page.waitForFunction(() => mealActors.every(a => a.mealPair));
        await sample('eat-together');
        await page.evaluate(() => { window.mealPhase = .10; });
        await page.waitForFunction(() => mealActors.every(a => a.mealPair.approach > .8));
        await sample('feed-approach');
        assert.ok(report.poses.at(-1).state.every(a => a.faceGap < .42 && a.expressions.every(e => e.open === 0)), 'approach before accepting food');
        for (const [phase, name, who] of [[.25, 'feed-char', 'char'], [.75, 'feed-user', 'user']]) {
            await page.evaluate(phase => { window.mealPhase = phase; }, phase);
            await page.waitForFunction(who => mealActors.find(a => a.who === who).mealPair.feeding && mealActors.find(a => a.who === who).diningCycle.tip.distanceTo(ByndHome3D.Dining.mouth(mealActors.find(a => a.who !== who))) < .028, who);
            await sample(name);
            assert.ok(report.poses.at(-1).state.every(a => a.faceGap < .38 && a.gaze > .85 && a.expressions.every(e => a.pair.feeding ? e.open === 0 : e.open > .95)));
        }
        await page.evaluate(() => { window.mealPhase = .35; });
        await page.waitForFunction(() => mealActors.every(a => a.expressions.every(e => e.smile.value > .5 && e.mouth.value === 0)));
        await sample('feed-after-bite');
        // Near LOD and two viewpoints expose both receiving faces.
        await page.evaluate(() => { const H = ByndHome3D; H.runtime.camera.focus(0, -.9); mealView(-.18, .38); H.runtime.zoom(Math.log(2.8 / H.runtime.stats().camera.zoom)); window.mealPhase = .25; });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().camera.zoom > 2.79 && ByndHome3D.runtime.stats().camera.yaw < -.17 && ByndHome3D.runtime.stats().camera.pitch < .39 && mealActors.every(a => !a.loading && a.mealPair) && mealActors.find(a => a.who === 'char').diningCycle.tip.distanceTo(ByndHome3D.Dining.mouth(mealActors.find(a => a.who === 'user'))) < .028);
        await sample('feed-char-face-close');
        await page.evaluate(() => { window.mealPhase = .75; mealView(1.48, .38); });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().camera.yaw > 1.47 && mealActors.find(a => a.who === 'user').mealPair.feeding && mealActors.find(a => a.who === 'char').expressions.every(e => e.mouth.value > .95));
        await sample('feed-user-face-close');
        await page.evaluate(() => { const H = ByndHome3D; H.runtime.camera.focus(0, -.15); mealView(.68, .62); H.runtime.zoom(Math.log(1.55 / H.runtime.stats().camera.zoom)); });
        await page.evaluate(() => { window.mealPhase = .5; });
        await page.evaluate(() => {
            const H = ByndHome3D;
            for (const actor of mealActors) H.Characters.pose(actor, 'Drink', actor.anchor);
        });
        await page.waitForFunction(() => mealActors.every(a => a.action === 'Drink' && a.cup.visible && a.cup.localToWorld(new ByndHomeEngine.Vector3(-.064, .045, -.049)).distanceTo(ByndHome3D.Dining.mouth(a)) < .028));
        await sample('drink-together');
        await page.evaluate(() => { const H = ByndHome3D, user = mealActors.find(a => a.who === 'user'); H.runtime.camera.focus(user.anchor.x, user.anchor.z); H.runtime.zoom(Math.log(2.8 / H.runtime.stats().camera.zoom)); });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().camera.zoom > 2.79 && !mealActors.find(a => a.who === 'user').loading);
        await page.waitForFunction(() => mealActors.every(a => a.cup.localToWorld(new ByndHomeEngine.Vector3(-.064, .045, -.049)).distanceTo(ByndHome3D.Dining.mouth(a)) < .028));
        await sample('drink-face-close');
        await page.evaluate(() => { window.mealPhase = 0; });
        await page.screenshot({ path: path.join(output, 'drink-rest.png') });
        await page.evaluate(() => { const H = ByndHome3D; H.runtime.emote('Idle'); H.runtime.setCharActivity({ room: 'dining_room', action: 'Idle' }, true); });
        await page.waitForFunction(() => mealActors.every(a => !a.cup.visible && !a.eatTool.visible && a.meshes.every(m => m.morphTargetInfluences[2] === 0)));
        await page.setViewportSize({ width: 320, height: 740 });
        for (const safe of [47, 59]) for (const parent of [false, true]) {
            await page.evaluate(({ safe, parent }) => { document.querySelector('#demo-window').style.paddingTop = parent ? safe + 'px' : '0'; document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top', (parent ? 0 : safe) + 'px'); }, { safe, parent });
            const box = await page.locator('.home3d-header button').first().boundingBox(); assert.ok(box.y >= safe && box.y < safe + 10); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        }
        await page.screenshot({ path: path.join(output, 'dining-320.png') });
        assert.deepEqual(report.errors, []); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('Dining browser passed: two real seats, real mugs/spoons, both hand grips, food lift, LOD and restore, mobile safe areas.');
    } finally { await browser.close(); server.close(); }
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
