'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/home3d-models/bunny-blue-v1');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
async function main() {
    const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { errors: [], poses: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
        page.on('pageerror', error => report.errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/room');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading') || document.querySelector('.home3d-scene-error')?.hidden === false);
        const initialFailure = await page.locator('.home3d-scene-error').innerText(); if (initialFailure) throw Error(initialFailure);
        assert.deepEqual(await page.evaluate(() => ByndHome3D.runtime.stats().actors.map(a => a.pose.modelId)), ['bunny-blue-v1', 'silver-red-v1']);
        await page.evaluate(() => { ByndHome3D.runtime.setQuality('balanced'); ByndHome3D.runtime.camera.focus(1.15, 1.5); ByndHome3D.runtime.zoom(Math.log(2.7)); });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'user').pose.level === 'near');
        await page.screenshot({ path: path.join(output, 'female-in-room.png') });
        report.room = await page.evaluate(() => ByndHome3D.runtime.stats());
        // Failed writes must not select a model or replace an existing portrait.
        await page.locator('[data-action="settings"]').click();
        await page.evaluate(() => { window.originalWrite = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === 'bynd_home3d_v1') throw Error('quota'); return window.originalWrite.call(this, key, value); }; });
        await page.locator('#home3d-user-model').selectOption('portrait');
        assert.equal(await page.locator('#home3d-user-model').inputValue(), 'bunny-blue-v1');
        assert.match(await page.locator('.home3d-notice').innerText(), /没有保存成功/);
        await page.evaluate(() => { Storage.prototype.setItem = window.originalWrite; });
        await page.locator('#home3d-user-model').selectOption('portrait');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.find(a => a.who === 'user')?.visual === 'portrait' && !document.querySelector('.home3d-scene.is-loading'));
        await page.locator('#home3d-user-model').selectOption('bunny-blue-v1');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.find(a => a.who === 'user')?.pose.modelId === 'bunny-blue-v1' && !document.querySelector('.home3d-scene.is-loading'));
        // Separate actual runtime rig render, with the same furniture and anchors.
        await page.evaluate(async () => {
            document.getElementById('home3d-root').style.display = 'none'; ByndHome3D.close();
            const T = ByndHomeEngine, H = ByndHome3D, girl = await H.CharacterModels.create('user', { tier: 'balanced' });
            const scene = new T.Scene(); scene.background = new T.Color('#faf8f4'); scene.add(girl.root);
            scene.add(new T.HemisphereLight('#fff8eb', '#b8bfcb', 2));
            const key = new T.DirectionalLight('#ffffff', 2.5); key.position.set(-3, 6, 5); scene.add(key);
            const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1.5); renderer.setSize(390, 844); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
            renderer.domElement.style.position = 'fixed'; renderer.domElement.style.inset = '0'; document.body.append(renderer.domElement);
            const camera = new T.OrthographicCamera(-1, 1, 2.15, -2.15, .01, 50);
            const materials = H.Materials.create('cream'), sofa = H.Furniture.get('cream_sofa'), bed = H.Furniture.get('cream_bed');
            const ground = new T.Mesh(new T.PlaneGeometry(12, 12), new T.MeshStandardMaterial({ color: '#eee6db' })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.015; scene.add(ground);
            const objects = { sofa: await H.Furniture.load(sofa, materials), bed: await H.Furniture.load(bed, materials) }; Object.values(objects).forEach(object => scene.add(object));
            window.femaleReview = { girl, scene, renderer, camera, objects };
            window.renderFemale = kind => {
                const r = femaleReview; r.objects.sofa.visible = ['Sit', 'Read'].includes(kind); r.objects.bed.visible = kind === 'Sleep';
                const item = kind === 'Sleep' ? bed : sofa, anchor = ['Sit', 'Read', 'Sleep'].includes(kind) ? H.Rooms.anchor({ id: 'review', furnitureId: item.id, position: [0, 0, 0], rotation: 0 }, kind, 'user', item) : null;
                r.girl.root.position.set(0, 0, 0); H.CharacterModels.pose(r.girl, kind, anchor);
                const focus = kind === 'Sleep' ? .95 : kind === 'face' ? 1.24 : .95, extent = kind === 'face' ? .23 : kind === 'Sleep' ? .95 : .68;
                r.camera.left = -extent; r.camera.right = extent; r.camera.top = extent * 844 / 390; r.camera.bottom = -r.camera.top;
                r.camera.position.set(2.4, focus + (kind === 'Sleep' ? 3 : .3), 5); r.camera.lookAt(0, focus, 0); r.camera.updateProjectionMatrix();
                r.renderer.render(r.scene, r.camera); return { ...H.CharacterModels.geometry(r.girl), gripSamples: r.girl.grips.map(s => s.length), book: r.girl.book.position.toArray(), bookVisible: r.girl.book.visible };
            };
        });
        for (const pose of ['Idle', 'face', 'Sit', 'Read', 'Sleep']) {
            report.poses.push({ pose, geometry: await page.evaluate(pose => renderFemale(pose), pose) });
            await page.screenshot({ path: path.join(output, 'female-' + pose.toLowerCase() + '.png') });
        }
        assert.deepEqual(report.errors, []);
        fs.writeFileSync(path.join(output, 'runtime-review.json'), JSON.stringify(report, null, 2));
        console.log('Female real 3D room, close LOD, model switching and failed save checks passed.');
    } finally { await browser.close(); server.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
