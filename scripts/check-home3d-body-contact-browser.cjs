'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/home3d-renderer/body-contact-v1');
async function main() {
    const { chromium } = require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { errors: [], actors: [] }; fs.mkdirSync(output, { recursive: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
        await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
        page.on('pageerror', e => report.errors.push(e.message));
        page.on('console', e => { if (e.type() === 'error') report.errors.push(e.text()); });
        await page.goto('http://127.0.0.1:' + server.address().port + '/room?pose=sleep&close=1');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
        await page.waitForFunction(() => ByndHome3D.runtime.stats().camera.zoom > 2.19);
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.every(a => ['middle','near'].includes(a.pose.level)));
        report.room = await page.evaluate(() => ByndHome3D.runtime.stats());
        assert.equal(report.room.actors.find(a => a.who === 'char').pose.eyesClosed, true);
        assert.equal(report.room.actors.find(a => a.who === 'char').pose.footAsset, 'tripo-barefoot');
        await page.screenshot({ path: path.join(output, 'actual-bedroom-390.png') });
        assert.equal(await page.evaluate(()=>ByndHome3D.runtime.interact('bed','Sleep')),true);
        await page.waitForFunction(()=>ByndHome3D.runtime.stats().actors.every(a=>a.pose.kind==='lying'),{},{timeout:30000});
        await page.waitForFunction(()=>ByndHome3D.runtime.furniture().find(f=>f.placement.id==='bed').model.getObjectByName('sleep-quilt').userData.bedding.sleepers===2);
        await page.evaluate(()=>ByndHome3D.runtime.camera.focus(.05,-1.55));
        await page.screenshot({path:path.join(output,'actual-two-sleepers-390.png')});
        report.twoSleepers=await page.evaluate(()=>ByndHome3D.runtime.stats());
        assert.equal(await page.evaluate(()=>ByndHome3D.runtime.interact('bed','Sit')),true);
        await page.evaluate(()=>ByndHome3D.runtime.setCharActivity({room:'bedroom',action:'Idle'},true));
        await page.waitForFunction(()=>ByndHome3D.runtime.stats().actors.every(a=>a.action!=='Sleep') && ByndHome3D.runtime.furniture().find(f=>f.placement.id==='bed').model.getObjectByName('sleep-quilt').userData.bedding.sleepers===0);
        const awake=await page.evaluate(()=>{
            const q=ByndHome3D.runtime.furniture().find(f=>f.placement.id==='bed').model.getObjectByName('sleep-quilt'),p=q.geometry.attributes.position,b=q.userData.bedding;
            let min=Infinity,max=-Infinity;for(let i=0;i<b.count;i++){min=Math.min(min,p.getY(i));max=Math.max(max,p.getY(i));}
            return {range:max-min,stats:ByndHome3D.runtime.stats()};
        });
        assert.ok(awake.range<.20);assert.ok(awake.stats.actors.every(a=>!a.pose.shoesOff&&!a.pose.eyesClosed));report.awake=awake;
        await page.screenshot({path:path.join(output,'actual-wake-390.png')});
        await page.evaluate(() => {
            ByndHome3D.close(); document.getElementById('home3d-root').style.display = 'none';
            const T = ByndHomeEngine, H = ByndHome3D, scene = new T.Scene(); scene.background = new T.Color('#f8f5ef');
            scene.add(new T.HemisphereLight('#fff8eb', '#bbc2cc', 2)); const key = new T.DirectionalLight('#fff', 2.5); key.position.set(-3, 6, 5); scene.add(key);
            const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(390, 844); renderer.setPixelRatio(1.5); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
            renderer.domElement.style.position = 'fixed'; renderer.domElement.style.inset = '0'; document.body.appendChild(renderer.domElement);
            window.contactReview = { scene, renderer, camera: new T.OrthographicCamera(-.2, .2, .43, -.43, .01, 50) };
            window.contactRender = (action, view) => {
                const r = contactReview, actor = r.actor, T = ByndHomeEngine, H = ByndHome3D;
                actor.root.position.set(0, 0, 0); actor.root.rotation.set(0, 0, 0);
                const item = H.Furniture.get('cream_bed'), anchor = view.startsWith('feet') || view.startsWith('body') ? H.Rooms.anchor({ id: 'bed', furnitureId: item.id, position: [0, 0, 0], rotation: 0 }, action, actor.who, item) : null;
                H.CharacterModels.pose(actor, action, anchor);
                r.bed.visible = view.startsWith('body'); r.bed.getObjectByName('sleep-quilt').visible = view !== 'body-uncovered';
                H.Bedding.update([{model:r.bed, placement:{id:'bed'}}],[actor]);
                const eyeY = actor.who === 'user' ? 1.24 : 1.33, focus = view === 'face' ? new T.Vector3(0, eyeY, .08) : view.startsWith('feet') ? actor.knees[0].children[0].getWorldPosition(new T.Vector3()).add(new T.Vector3(.1, .02, .08)) : new T.Vector3(0, 1.05, -.15);
                const extent = view === 'face' ? .15 : view.startsWith('feet') ? .28 : 1.05;
                r.camera.left = -extent; r.camera.right = extent; r.camera.top = extent * 844 / 390; r.camera.bottom = -r.camera.top;
                r.camera.position.copy(focus).add(view === 'face' ? new T.Vector3(0, .08, 4) : view === 'feet-side' ? new T.Vector3(4, 1, .15) : view === 'feet-top' ? new T.Vector3(0, 4, .2) : new T.Vector3(2.3, 3, 5)); r.camera.lookAt(focus); r.camera.updateProjectionMatrix(); r.renderer.render(r.scene, r.camera);
                const stats = H.CharacterModels.geometry(actor); stats.bedding = r.bed.getObjectByName('sleep-quilt').userData.bedding; stats.headPosition=actor.head.getWorldPosition(new T.Vector3()).toArray();
                const v = new T.Vector3(); let hull = 0, rear = Infinity;
                for (const mesh of actor.meshes) for (const i of new Set(mesh.geometry.index.array)) {
                    mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld);
                    if (!anchor) hull = Math.max(hull, Math.hypot(v.x - actor.root.position.x, v.z - actor.root.position.z));
                    else rear = Math.min(rear, actor.root.worldToLocal(v).z);
                }
                stats.hullRadius = hull; stats.rear = rear;
                if (anchor) {
                    const p = new T.Vector3(); let torsoMin = Infinity, headMin = Infinity;
                    for (const mesh of actor.meshes) for (const i of new Set(mesh.geometry.index.array)) {
                        const y = mesh.geometry.attributes.position.getY(i) / actor.modelHeight;
                        if (y < .5) continue;
                        mesh.getVertexPosition(i, p); p.applyMatrix4(mesh.matrixWorld);
                        if (y < .72) torsoMin = Math.min(torsoMin, p.y);
                        if (y >= .8) headMin = Math.min(headMin, p.y);
                    }
                    const ankleJoins = actor.socks.map((group, side) => {
                        const mesh = group.children[0], pos=mesh.geometry.attributes.position, seam=new T.Box3(), rim=new T.Box3(), v=new T.Vector3();
                        for(const sample of actor.ankleSeams[side]) {sample.mesh.getVertexPosition(sample.index,v);v.applyMatrix4(sample.mesh.matrixWorld);group.worldToLocal(v);seam.expandByPoint(v);}
                        for(const i of mesh.userData.ankleRim) rim.expandByPoint(v.fromBufferAttribute(pos,i));
                        const center=seam.getCenter(new T.Vector3());
                        return {legTop:seam.max.y,footTop:rim.min.y,offset:rim.getCenter(new T.Vector3()).distanceTo(new T.Vector3(center.x,rim.min.y,center.z)),skinOnly:mesh.userData.ankleJoin.skinOnly};
                    });
                    if (view === 'body') {
                        const quilt = r.bed.getObjectByName('sleep-quilt'), original = quilt.raycast;
                        quilt.raycast = T.Mesh.prototype.raycast;
                        const ray = new T.Raycaster(), faces = [], covered = [], v = new T.Vector3(), rest = new T.Vector3();
                        const eyeY = actor.who === 'user' ? .766 : .858, front = actor.who === 'user' ? .07 : .026;
                        for (const mesh of actor.meshes) {
                            const drawn = [...new Set(mesh.geometry.index.array)], stride = Math.max(1, Math.floor(drawn.length / 5000));
                            for (let n = 0; n < drawn.length; n += stride) {
                                const i = drawn[n]; rest.fromBufferAttribute(mesh.geometry.attributes.position, i).divideScalar(actor.modelHeight);
                                mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld);
                                if (Math.abs(rest.y - eyeY) < .014 && Math.abs(rest.x) < .07 && rest.z > front) {
                                    ray.set(r.camera.position, v.clone().sub(r.camera.position).normalize());
                                    faces.push(!ray.intersectObject(quilt, false).some(hit => hit.distance < r.camera.position.distanceTo(v) - .005));
                                }
                                const local = quilt.worldToLocal(v.clone()), b = quilt.userData.bedding;
                                if (rest.y > .12 && rest.y < .6 && local.z > b.neckCuts[0] + .13 && local.z < b.z1 - .12 && Math.abs(local.x) < b.x1 - .15) {
                                    ray.set(v.clone().add(new T.Vector3(0, 2, 0)), new T.Vector3(0, -1, 0));
                                    covered.push(ray.intersectObject(quilt, false).some(hit => hit.distance < 2 - .01));
                                }
                            }
                        }
                        quilt.raycast = original;
                        stats.coverage = { bodySamples: covered.length, covered: covered.filter(Boolean).length, eyeSamples: faces.length, eyesVisible: faces.filter(Boolean).length };
                    }
                    stats.measured = { ankleJoins, torsoMin, headMin, feetMin: actor.socks.map(group => {
                        const mesh=group.children[0], v=new T.Vector3();let min=Infinity;
                        for(const i of new Set(mesh.geometry.index.array)){v.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld);min=Math.min(min,v.y);}return min;
                    }), joins: actor.socks.map(s=>s.children[0].userData.ankleJoin), anchor };
                }
                return stats;
            };
        });
        await page.evaluate(async () => { const H = ByndHome3D; contactReview.bed = await H.Furniture.load(H.Furniture.get('cream_bed'), H.Materials.create('cream')); contactReview.scene.add(contactReview.bed); contactReview.bed.visible = false; });
        for (const who of ['char', 'user']) {
            await page.evaluate(async who => {
                const r = contactReview; if (r.actor) { r.actor.released = true; ByndHome3D.Shapes.disposeGeometry(r.actor.root); }
                r.actor = await ByndHome3D.CharacterModels.create(who, { tier: 'balanced' }); r.scene.add(r.actor.root);
                r.camera.left = -.15; r.camera.right = .15; r.camera.top = .15 * 844 / 390; r.camera.bottom = -r.camera.top; r.camera.updateProjectionMatrix();
                ByndHome3D.CharacterModels.update(r.actor, r.camera, 844, { tier: 'balanced', renderScale: 1 }, () => {});
            }, who);
            await page.waitForFunction(() => contactReview.actor.level === 'near' && !contactReview.actor.loading);
            const walkHull = await page.evaluate(() => {
                const r=contactReview,a=r.actor,T=ByndHomeEngine,H=ByndHome3D;
                H.CharacterModels.pose(a,'Walk'); a.root.position.set(0,.07,0);a.root.rotation.set(0,0,0);a.startedAt=0;a.path=[{x:0,z:100}];
                const v=new T.Vector3();let radius=0;
                for(let frame=0;frame<12;frame++) {
                    H.Animation.tick(a,frame*90,.016,false);a.root.updateMatrixWorld(true);a.skeleton.update();
                    for(const m of a.meshes) for(const i of new Set(m.geometry.index.array)) {m.getVertexPosition(i,v);v.applyMatrix4(m.matrixWorld);radius=Math.max(radius,Math.hypot(v.x-a.root.position.x,v.z-a.root.position.z));}
                }
                a.path=[];a.destination=null;return radius;
            });
            report.actors.push({ who, walkHull });
            assert.ok(walkHull <= (who === 'user' ? .52 : .38) - .01, 'measured gait fits navigation hull');
            for (const [action, view] of [['Idle', 'face'], ['Sleep', 'face'], ['Sleep', 'feet'], ['Sleep', 'feet-side'], ['Sleep', 'feet-top'], ['Sleep', 'body'], ['Sleep','body-uncovered']]) {
                const stats = await page.evaluate(({ action, view }) => contactRender(action, view), { action, view });
                if (action === 'Sleep') assert.equal(stats.eyesClosed, true); else assert.equal(stats.eyesClosed, false);
                if (stats.coverage) {
                    const c=stats.coverage; assert.ok(c.bodySamples > 30 && c.covered / c.bodySamples > .99,who+' blanket clips body: '+JSON.stringify(c));
                    assert.ok(c.eyeSamples > 0 && c.eyesVisible / c.eyeSamples > .95,who+' blanket hides face: '+JSON.stringify(c));
                }
                if (stats.measured) {
                    const m = stats.measured;
                    for(const join of m.ankleJoins) {
                        assert.equal(join.skinOnly,true);assert.ok(join.footTop >= join.legTop+.015,who+' ankle must overlap the actual leg opening: '+JSON.stringify(join));
                        assert.ok(join.offset < .025,who+' ankle center must meet the leg');
                        if(who==='char') assert.ok(join.footTop < .105,'male ankle should be short, not stretched to boot height');
                    }
                    assert.ok(m.torsoMin >= m.anchor.restSurface - .008, who + ' torso clips bed: ' + JSON.stringify(m));
                    assert.ok(m.headMin >= m.anchor.pillowSurface - .008, who + ' head clips pillow: ' + JSON.stringify(m));
                    assert.ok(m.feetMin.every(y => y >= m.anchor.quiltSurface - .015), who + ' feet clip quilt: ' + JSON.stringify(m));
                    assert.ok(stats.rear >= m.anchor.headBoundary - .002, who + ' crown/ears clip headboard');
                }
                report.actors.push({ who, action, view, stats });
                await page.screenshot({ path: path.join(output, who + '-' + action.toLowerCase() + '-' + view + '.png') });
            }
        }
        for(const who of ['char','user']) for(const tier of ['smooth','balanced']) {
            await page.evaluate(async ({who,tier})=>{
                const r=contactReview; r.actor.released=true;ByndHome3D.Shapes.disposeGeometry(r.actor.root);
                r.actor=await ByndHome3D.CharacterModels.create(who,{tier});r.scene.add(r.actor.root);
            },{who,tier});
            const stats=await page.evaluate(()=>contactRender('Sleep','feet-side'));
            for(const join of stats.measured.ankleJoins) {
                assert.ok(join.footTop>=join.legTop+.015,who+' '+stats.level+' ankle detached');assert.ok(join.offset<.025);
            }
            assert.ok(stats.measured.feetMin.every(y=>Math.abs(y-stats.measured.anchor.quiltSurface)<.016));
            report.actors.push({who,action:'Sleep',view:'feet-side',level:stats.level,stats});
            await page.screenshot({path:path.join(output,who+'-'+stats.level+'-sleep-feet-side.png')});
        }
        assert.deepEqual(report.errors, []); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        console.log('Actual far/middle/near ankle continuity, barefoot skin, sleep contact, expressions and mobile side/top renders passed.');
    } finally { await browser.close(); server.close(); }
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
