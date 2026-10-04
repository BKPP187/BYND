'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/home3d-renderer');
const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/apps/home3d/home3d.css"><style>html,body{margin:0;width:100%;height:100%;font:14px Arial,'Microsoft Yahei',sans-serif}.app-window{height:100%;position:relative}.hidden{display:none}</style></head><body><div class="app-window active" id="demo-window"><div id="home3d-root"></div></div><script>window.myCharacters=[{id:'room-demo',name:'南桓',personality:'温柔，喜欢读书',history:[],chatConfig:{}}];window.closeApp=()=>ByndHome3D.close();window.getLivingWorldRelevantEventsForChar=()=>[];</script><script src="/apps/home3d/home3d.js"></script><script>ByndHome3D.open().then(async()=>{const params=new URLSearchParams(location.search),sleep=params.get('pose')==='sleep',room=params.get('room')||(sleep?'bedroom':'living_room'),defaults={living_room:['sofa','Read'],bedroom:['bed','Sleep'],game_room:['desk','Game'],kitchen:['stove','Cook'],dining_room:['dining-table','Eat']},[target,action]=defaults[room]||defaults.living_room;ByndHome3D.State.bind('room-demo');ByndHome3D.State.withHome((home,data)=>{if(params.get('actor')==='user')data.user.modelId='bunny-blue-v1';home.theme='cream';home.activity={room,target,action:params.get('action')||action,reason:'小屋预览',until:Date.now()+600000};});await ByndHome3D.UI.arrive();if(room!=='living_room')await ByndHome3D.UI.loadRoom(room);if(sleep&&params.get('together')==='1')ByndHome3D.runtime.interact('bed','Sleep');if(params.get('close')==='1'){ByndHome3D.runtime.setQuality('balanced');if(params.get('together')==='1')ByndHome3D.runtime.camera.focus(.05,-1.55);else ByndHome3D.runtime.camera.focus(params.get('actor')==='user'?1.15:sleep?-.5:-.67,params.get('actor')==='user'?1.5:sleep?-1.05:-1.35);ByndHome3D.runtime.zoom(Math.log(2.2));}});</script></body></html>`;
function createServer() {
    return http.createServer((req, res) => {
        const route = new URL(req.url, 'http://localhost').pathname;
        if (route === '/favicon.ico') { res.writeHead(204); res.end(); return; }
        if (route === '/' || route === '/room') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(fixture); return; }
        const file = path.resolve(root, '.' + decodeURIComponent(route));
        if (!/^\/(apps\/home3d\/|assets\/home3d\/|assets\/vendor\/home3d\/)/.test(route) || !file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': ({ '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.glb': 'model/gltf-binary' })[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
    });
}
async function verify(server) {
    const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { layouts: [], modes: [], gestures: [], errors: [] }; fs.mkdirSync(output, { recursive: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/room');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
        await page.evaluate(() => { document.querySelector('.home3d-notice').hidden = true; });
        for (const [width, height] of [[320, 640], [320, 740], [320, 844], [390, 844], [430, 844]]) for (const safe of [47, 59]) for (const parent of [false, true]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(({ safe, parent }) => { const win = document.querySelector('#demo-window'); win.style.paddingTop = parent ? safe + 'px' : '0px'; win.style.boxSizing = 'border-box'; document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top', (parent ? 0 : safe) + 'px'); }, { safe, parent });
            // ResizeObserver is asynchronous, especially during software-rendered shader work.
            // Wait for the real framebuffer to follow layout rather than sampling a stale resize.
            await page.waitForFunction(() => {
                const scene = document.querySelector('.home3d-scene').getBoundingClientRect(), r = ByndHome3D.runtime.stats().resolution;
                return Math.abs(r.width - scene.width * r.pixelRatio) <= 1 && Math.abs(r.height - scene.height * r.pixelRatio) <= 1;
            });
            const layout = await page.evaluate(() => {
                const scene = document.querySelector('.home3d-scene').getBoundingClientRect(), hud = document.querySelector('.home3d-presence').getBoundingClientRect(), tools = document.querySelector('.home3d-view-tools').getBoundingClientRect();
                const chip = document.querySelector('.home3d-room-chip').getBoundingClientRect();
                return { width: innerWidth, height: innerHeight, scene: { width: scene.width, height: scene.height }, blocked: hud.width * hud.height + tools.width * tools.height + chip.width * chip.height, headerTop: document.querySelector('.home3d-header button').getBoundingClientRect().top, overflow: document.documentElement.scrollWidth > innerWidth, stats: ByndHome3D.runtime.stats() };
            });
            const visibleFraction = (layout.scene.width * layout.scene.height - layout.blocked) / (width * (height - safe));
            assert.ok(visibleFraction >= .75 && visibleFraction <= .85, 'unobscured world area: ' + visibleFraction);
            assert.ok(layout.headerTop >= safe && layout.headerTop < safe + 10); assert.equal(layout.overflow, false);
            assert.ok(Math.abs(layout.stats.resolution.width - layout.scene.width * layout.stats.resolution.pixelRatio) <= 1, 'buffer mismatch: ' + JSON.stringify({ width, height, safe, parent, scene: layout.scene, resolution: layout.stats.resolution }));
            assert.ok(layout.stats.resolution.pixelRatio <= 1.25, 'software renderer uses safe automatic tier');
            assert.ok(layout.stats.camera.frustum.right - layout.stats.camera.frustum.left < 5, 'room can crop beyond screen');
            report.layouts.push({ width, height, safe, parent, visibleFraction, ...layout });
            if (width === 390 && safe === 59 && !parent) await page.screenshot({ path: path.join(output, 'room-android-dpr3.png') });
        }
        await page.setViewportSize({ width: 320, height: 640 });
        await page.locator('[data-action="room-menu"]').click();
        await page.locator('.home3d-sheet [data-action="room"][data-room="bedroom"]').click();
        await page.waitForFunction(() => ByndHome3D.runtime.stats().room === 'bedroom' && !document.querySelector('.home3d-scene.is-loading'));
        await page.locator('[data-action="room-menu"]').click();
        await page.locator('.home3d-sheet [data-action="room"][data-room="living_room"]').click();
        await page.waitForFunction(() => ByndHome3D.runtime.stats().room === 'living_room' && !document.querySelector('.home3d-scene.is-loading'));
        const seated = await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char'));
        assert.equal(seated.visual, 'model3d'); assert.equal(seated.pose.skinned, true); assert.equal(seated.pose.kind, 'seated');
        assert.ok(seated.pose.bones >= 10); assert.ok(seated.pose.head.y > seated.position.y + .3); assert.ok(seated.pose.feet.z > seated.position.z + .2); assert.ok(seated.pose.feet.y > 0);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => { ByndHome3D.runtime.setQuality('balanced'); ByndHome3D.runtime.camera.focus(-.67, -1.35); ByndHome3D.runtime.zoom(Math.log(2.7)); });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().camera.zoom > 2.68 && ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').pose.level === 'near');
        await page.screenshot({ path: path.join(output, 'model-reading-close.png') });
        await page.evaluate(async () => { ByndHome3D.State.withHome(h => { h.activity = { action: 'Sleep', target: 'bed', room: 'bedroom', until: Date.now() + 600000 }; }); await ByndHome3D.UI.loadRoom('bedroom'); });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char')?.pose.kind === 'lying');
        const sleeping = await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char'));
        assert.ok(sleeping.pose.head.z < sleeping.pose.feet.z - .8, 'head points toward bed local -Z pillow'); assert.ok(sleeping.pose.head.y > sleeping.position.y);
        assert.equal(sleeping.pose.shoesOff, true); assert.deepEqual(sleeping.pose.bodyScale, { x: 1, y: 1, z: 1 });
        await page.screenshot({ path: path.join(output, 'model-sleep.png') }); report.modelPoses = { seated, sleeping };
        await page.evaluate(() => { ByndHome3D.runtime.camera.focus(-.5, -1.05); ByndHome3D.runtime.zoom(Math.log(2.7)); });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().camera.zoom > 2.68 && ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').pose.level === 'near');
        await page.screenshot({ path: path.join(output, 'model-sleep-close.png') });
        await page.evaluate(async () => { ByndHome3D.State.withHome(h => { h.activity = { action: 'Read', target: 'sofa', room: 'living_room', until: Date.now() + 600000 }; }); await ByndHome3D.UI.loadRoom('living_room'); });
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').pose.shoesOff), false);
        await page.evaluate(() => {
            const H=ByndHome3D,T=ByndHomeEngine,room=H.Rooms.get('living_room');
            const blocks=H.runtime.furniture().filter(r=>r.placement.position[1]<.2&&!['frame','prop','keepsake'].includes(r.item.type)).map(row=>{
                const e=H.Build.extent(row.placement),b=new T.Box3().setFromObject(row.model);
                const x0=Math.min(e.x-e.width/2,b.min.x),x1=Math.max(e.x+e.width/2,b.max.x),z0=Math.min(e.z-e.depth/2,b.min.z),z1=Math.max(e.z+e.depth/2,b.max.z);
                return {x:(x0+x1)/2,z:(z0+z1)/2,width:x1-x0,depth:z1-z0};
            });
            window.walkReview={samples:0,violations:[],active:true};
            function sample(){const review=window.walkReview;if(!review.active)return;
                for(const actor of H.runtime.stats().actors.filter(a=>a.action==='Walk')) {
                    review.samples++;if(!H.Animation.clear(actor.position,blocks,room.size,actor.pose.navigationRadius))review.violations.push(actor.position);
                }
                requestAnimationFrame(sample);
            }requestAnimationFrame(sample);
        });
        await page.evaluate(() => { ByndHome3D.runtime.setCharActivity({ action: 'Walk', room: 'living_room', wanderSeed: 2 }); });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').path > 0);
        await page.screenshot({ path: path.join(output, 'model-walk.png') });
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.find(a=>a.who==='char').action==='Idle');
        await page.evaluate(() => ByndHome3D.Interactions.perform('sofa','Sit'));
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.find(a=>a.who==='user').action==='Sit');
        report.walkClearance=await page.evaluate(()=>{window.walkReview.active=false;return window.walkReview;});
        assert.ok(report.walkClearance.samples>10);assert.deepEqual(report.walkClearance.violations,[]);
        await page.evaluate(() => { ByndHome3D.runtime.setCharActivity({ action: 'Read', target: 'sofa', room: 'living_room' }, true); });
        await page.setViewportSize({ width: 390, height: 844 });
        // Exercise a genuinely uploaded 2K PBR map across quality reallocations.
        await page.evaluate(() => {
            const T = ByndHomeEngine, canvas = document.createElement('canvas'); canvas.width = canvas.height = 2048;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eee0cc'; ctx.fillRect(0, 0, 2048, 2048);
            const map = new T.CanvasTexture(canvas), material = new T.MeshStandardMaterial({ map, roughness: .8 });
            const mesh = new T.Mesh(new T.BoxGeometry(.1, .1, .1), material); mesh.userData.ownedTexture = map; mesh.userData.ownedMaterial = material;
            ByndHome3D.runtime.furniture()[0].model.add(mesh); window.qualityTestMap = map;
        });
        await page.locator('[data-action="settings"]').click();
        for (const mode of ['smooth', 'balanced', 'ultra', 'auto']) {
            await page.locator('#home3d-render-quality').selectOption(mode);
            await page.waitForTimeout(100);
            const stats = await page.evaluate(() => ByndHome3D.runtime.stats());
            assert.equal(stats.quality.mode, mode); assert.ok(stats.resolution.pixelRatio <= stats.quality.maxDpr); assert.ok(stats.resolution.width * stats.resolution.height <= stats.quality.maxPixels);
            assert.ok(stats.texturesBudget.textureBytes <= stats.texturesBudget.budgetBytes); report.modes.push(stats);
            const texture = await page.evaluate(() => { const gl = document.querySelector('.home3d-scene canvas').getContext('webgl2'); return { width: qualityTestMap.image.width, error: gl.getError() }; });
            assert.equal(texture.width, stats.quality.textureSize); assert.equal(texture.error, 0, 'quality texture reallocations remain valid WebGL');
        }
        await page.evaluate(() => { window.originalWrite = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === 'bynd_home3d_render_quality_v1') throw Error('quota'); return window.originalWrite.call(this, key, value); }; });
        await page.locator('#home3d-render-quality').selectOption('ultra');
        assert.match(await page.locator('.home3d-notice').innerText(), /没有保存成功/); assert.equal(await page.locator('#home3d-render-quality').inputValue(), 'auto');
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().quality.mode), 'auto');
        await page.evaluate(() => { Storage.prototype.setItem = window.originalWrite; document.querySelector('.home3d-notice').hidden = true; });
        await page.locator('[data-action="dismiss"]').click();
        const canvas = page.locator('canvas'), rect = await canvas.boundingBox(), x = rect.x + rect.width * .5, y = rect.y + rect.height * .55;
        const before = await page.evaluate(() => ByndHome3D.runtime.stats().camera);
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 8, y: y + i * 3, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(350);
        const panned = await page.evaluate(() => ByndHome3D.runtime.stats().camera); assert.notEqual(panned.x, before.x); assert.equal(panned.yaw, before.yaw, 'default gesture pans instead of rotating');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 35, y, id: 1 }, { x: x + 35, y, id: 2 }] });
        for (let i = 1; i <= 7; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 35 - i * 8, y, id: 1 }, { x: x + 35 + i * 8, y, id: 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(350);
        const pinched = await page.evaluate(() => ByndHome3D.runtime.stats().camera); assert.ok(pinched.zoom > panned.zoom * 1.5);
        report.gestures.push({ before, panned, pinched });
        await page.locator('[data-action="reset-view"]').click(); await page.waitForFunction(() => Math.abs(ByndHome3D.runtime.stats().camera.zoom - 1) < .01);
        await page.locator('[data-action="char"]').first().click(); assert.match(await page.locator('.home3d-sheet-body').innerText(), /共同生活第.*小小纪念/); await page.locator('[data-action="dismiss"]').click();
        await page.locator('[data-action="settings"]').click(); await page.locator('#home3d-render-quality').selectOption('balanced'); await page.locator('[data-action="dismiss"]').click();
        await page.route('**/silver-red-v1/near.glb', route => route.abort());
        await page.evaluate(() => ByndHome3D.runtime.zoom(Math.log(3.5)));
        await page.waitForFunction(() => document.querySelector('.home3d-notice').textContent.includes('人物细节暂时加载失败'));
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').visual), 'model3d');
        await page.unroute('**/silver-red-v1/near.glb');
        await page.evaluate(() => document.querySelector('.home3d-scene canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
        await page.locator('.home3d-scene-error [data-action="retry"]').waitFor({ state: 'visible' });
        await page.locator('.home3d-scene-error [data-action="retry"]').click();
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
        assert.equal(await page.locator('.home3d-scene-error').isVisible(), false); report.contextRecovered = true;
        await page.evaluate(() => ByndHome3D.close());
        await page.goto('http://127.0.0.1:' + server.address().port + '/room?pose=sleep&close=1');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.find(a => a.who === 'char')?.pose.kind === 'lying' && ByndHome3D.runtime.stats().camera.zoom > 2.19 && !document.querySelector('.home3d-scene.is-loading'));
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').pose.shoesOff), true); report.sleepPreview = true;
        await page.evaluate(() => ByndHome3D.close()); assert.equal(await page.locator('canvas').count(), 0); assert.deepEqual(report.errors, []);
        fs.writeFileSync(path.join(output, 'browser-review.json'), JSON.stringify(report, null, 2)); console.log('Room renderer checks passed: real DPR buffer, unobscured area, pan/pinch, modes, failed save and disposal.');
    } finally { await browser.close(); }
}
async function main() {
    const server = createServer(); await new Promise(resolve => server.listen(process.argv.includes('--check') ? 0 : 8797, '127.0.0.1', resolve));
    if (process.argv.includes('--check')) { try { await verify(server); } finally { server.close(); } }
    else console.log('Isolated room demo: http://127.0.0.1:8797/room');
}
module.exports = { createServer, verify };
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
