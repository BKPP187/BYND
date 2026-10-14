'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
async function main() {
    const { chromium } = require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const output = path.resolve('artifacts/home3d-renderer/reading-tv'); fs.mkdirSync(output, { recursive: true });
    const report = { errors: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        page.on('pageerror', e => report.errors.push(e.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/room?villa=1');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'), {}, { timeout: 60000 });
        await page.evaluate(() => {
            const H = ByndHome3D, update = H.SleepPair.update, tick = H.Animation.tick;
            H.SleepPair.update = (f, a, c) => { window.reviewActors = a; update(f, a, c); };
            H.Animation.tick = (a, t, dt, r) => tick(a, t, dt * 8, r);
            H.runtime.setQuality('balanced'); H.runtime.camera.focus(-4.7, -.55); H.runtime.zoom(Math.log(1.55));
        });
        await page.waitForFunction(() => window.reviewActors?.every(a => !a.released));
        report.reading = await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char'));
        assert.ok(report.reading.pose.gaze.alignment > .97); assert.equal(report.reading.pose.gaze.kind, 'book');
        await page.screenshot({ path: path.join(output, 'reading.png') });
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.interact('tv', 'Watch')), true);
        await page.waitForFunction(() => reviewActors.find(a => a.who === 'user').action === 'Watch', {}, { timeout: 60000 });
        const watch = () => page.evaluate(() => {
            const H = ByndHome3D, T = ByndHomeEngine, a = reviewActors.find(a => a.who === 'user'), seat = H.runtime.worldFurniture().find(r => r.placement.id === a.anchor.seatId), tv = H.runtime.worldFurniture().find(r => r.placement.id === a.anchor.placementId).model.userData.television;
            return { anchor: a.anchor, hips: seat.model.worldToLocal(a.hips.getWorldPosition(new T.Vector3())).toArray(), gaze: a.gaze, screen: { playing: tv.playing, frames: tv.frames, width: tv.texture.image.width, height: tv.texture.image.height }, resolution: H.runtime.stats().resolution };
        });
        report.watching = await watch(); assert.equal(report.watching.anchor.furnitureType, 'sofa');
        assert.ok(Math.abs(report.watching.hips[2] - .28) < .04); assert.ok(report.watching.gaze.alignment > .97);
        assert.equal(report.watching.screen.playing, true); assert.equal(report.watching.screen.width, 512);
        await page.waitForTimeout(650); assert.ok((await watch()).screen.frames > report.watching.screen.frames);
        await page.evaluate(() => { ByndHome3D.runtime.camera.focus(-5.5, -.3); ByndHome3D.runtime.zoom(Math.log(1 / 1.55)); });
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(output, 'watching-tv.png') });
        await page.evaluate(() => ByndHome3D.runtime.setCharActivity({ room: 'living_room', target: 'sofa', action: 'Watch' }, true));
        report.couple = await page.evaluate(() => reviewActors.map(a => ({ who: a.who, action: a.action, anchor: a.anchor, gaze: a.gaze })));
        assert.ok(report.couple.every(a => a.action === 'Watch' && a.gaze.alignment > .97));
        assert.equal(report.couple[0].anchor.seatId, report.couple[1].anchor.seatId); assert.ok(Math.abs(report.couple[0].anchor.x - report.couple[1].anchor.x) > .45);
        await page.screenshot({ path: path.join(output, 'couple-tv.png') });
        // No suitable seat and a blocked approach must fail without a success callback.
        report.failures = await page.evaluate(() => {
            const H = ByndHome3D, rows = H.runtime.worldFurniture(), seats = rows.filter(r => r.area === 'living_room' && ['sofa', 'chair'].includes(r.item.type));
            const saved = seats.map(r => r.item.type); seats.forEach(r => { r.item = { ...r.item, type: 'prop' }; });
            let missing = ''; try { H.runtime.interact('tv', 'Watch'); } catch (e) { missing = e.message; }
            seats.forEach((r, i) => { r.item = { ...r.item, type: saved[i] }; });
            const approach = H.Animation.approach; H.Animation.approach = () => null; let finish = false;
            const blocked = H.runtime.interact('tv', 'Watch', () => { finish = true; }); H.Animation.approach = approach;
            return { missing, blocked, finish };
        });
        assert.match(report.failures.missing, /座位/); assert.equal(report.failures.blocked, false); assert.equal(report.failures.finish, false);
        await page.evaluate(() => { ByndHome3D.runtime.setCharActivity({ room: 'living_room', action: 'Idle' }, true); ByndHome3D.runtime.emote('Idle'); });
        await page.waitForFunction(()=>!ByndHome3D.runtime.worldFurniture().find(r=>r.item.type==='television').model.userData.television.playing,{}, {timeout:60000});
        report.off = await page.evaluate(() => { const tv = ByndHome3D.runtime.worldFurniture().find(r => r.item.type === 'television').model.userData.television; return { playing: tv.playing, frames: tv.frames }; });
        assert.equal(report.off.playing, false); await page.waitForTimeout(450);
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.worldFurniture().find(r => r.item.type === 'television').model.userData.television.frames), report.off.frames);
        await page.setViewportSize({ width: 320, height: 740 });
        await page.evaluate(() => ByndHome3D.runtime.setCharActivity({ room: 'living_room', target: 'tv', action: 'Watch' }, true));
        await page.waitForTimeout(300); await page.screenshot({ path: path.join(output, 'tv-320.png') });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        report.disposal = await page.evaluate(() => { const tv = ByndHome3D.runtime.worldFurniture().find(r => r.item.type === 'television').model.userData.television, result = { texture: 0, material: 0 }; tv.texture.addEventListener('dispose', () => result.texture++); tv.screen.material.addEventListener('dispose', () => result.material++); ByndHome3D.close(); return result; });
        assert.deepEqual(report.disposal, { texture: 1, material: 1 }); assert.deepEqual(report.errors, []);
        console.log('Reading/TV browser checks passed: gaze, actual sofa, shared seats, animated screen, failure paths, 320px and resource disposal.');
    } finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); await new Promise(r => server.close(r)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
