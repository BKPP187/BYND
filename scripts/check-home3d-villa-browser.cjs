'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const output = path.resolve('artifacts/home3d-renderer/villa');
async function main() {
    const { chromium } = require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r)); fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { visits: [], errors: [], collisions: [], layouts: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        page.on('pageerror', e => report.errors.push(e.message));
        page.on('console', m => { if (/Shader Error|VALIDATE_STATUS|Error compiling/.test(m.text())) report.errors.push(m.text()); });
        await page.goto('http://127.0.0.1:' + server.address().port + '/room?villa=1');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'), {}, { timeout: 60000 });
        await page.evaluate(() => {
            const H = ByndHome3D, update = H.SleepPair.update, tick = H.Animation.tick;
            H.SleepPair.update = (f,a,c) => { window.villaActors = a; update(f,a,c); };
            // Speed only the test clock. The product retains its usual walking speed.
            window.villaWalkCheck={samples:0,violations:[]}; let collisionRows,blocks,plan;
            H.Animation.tick = (a,t,dt,r) => {
                tick(a,t,dt * 8,r);
                if (a.action!=='Walk'||a.onStairs||a.released) return;
                const rows=H.runtime.worldFurniture();
                if(rows!==collisionRows){
                    collisionRows=rows;plan=H.Villa.plan(H.runtime.stats().room);
                    blocks=rows.filter(row=>row.placement.position[1]<plan.y+.2&&!['frame','prop','keepsake'].includes(row.item.type)).map(row=>{
                        const e=H.Build.extent(row.placement),b=new ByndHomeEngine.Box3().setFromObject(row.model),x0=Math.min(e.x-e.width/2,b.min.x),x1=Math.max(e.x+e.width/2,b.max.x),z0=Math.min(e.z-e.depth/2,b.min.z),z1=Math.max(e.z+e.depth/2,b.max.z);
                        return{x:(x0+x1)/2,z:(z0+z1)/2,width:x1-x0,depth:z1-z0};
                    }).concat(H.Villa.blocks(plan));
                }
                villaWalkCheck.samples++;if(!H.Animation.clear(a.root.position,blocks,plan.size,a.navigationRadius))villaWalkCheck.violations.push({x:a.root.position.x,z:a.root.position.z,room:a.area});
            };
            H.runtime.setQuality('smooth'); document.querySelector('.home3d-notice').hidden = true;
        });
        await page.waitForFunction(() => window.villaActors?.length === 2);
        const state = () => page.evaluate(() => ByndHome3D.runtime.stats());
        const initial = await state(); assert.equal(initial.villa.areas.length, 6);
        await page.screenshot({ path: path.join(output, 'living-default.png') });
        for (const id of ['dining_room', 'kitchen', 'garden', 'stair_hall']) {
            const started = await page.evaluate(id => ByndHome3D.runtime.navigate(id), id);
            assert.equal(started, true, 'reachable ' + id + ': ' + JSON.stringify(await state()));
            await page.waitForFunction(id => ByndHome3D.runtime.stats().room === id && !ByndHome3D.runtime.stats().actors.find(a=>a.who==='user').path, id, { timeout: 60000 });
            const s = await state(); assert.equal(s.villa.generation, initial.villa.generation, 'same floor stays loaded');
            assert.equal(s.actors.find(a=>a.who==='user').position.y, .07); report.visits.push(s);
            await page.screenshot({ path: path.join(output, id + '.png') });
        }
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.navigate('landing')), true);
        await page.waitForFunction(() => ByndHome3D.runtime.stats().villa.level === 1 && !document.querySelector('.home3d-scene.is-loading'), {}, { timeout: 60000 });
        const upper = await state(); assert.equal(upper.villa.areas.length, 8); assert.equal(upper.actors.find(a=>a.who==='user').position.y, 3.27);
        report.visits.push(upper); await page.screenshot({ path: path.join(output, 'landing.png') });
        for (const id of ['bathroom','game_room','greenhouse','terrace','balcony','bedroom']) {
            const started=await page.evaluate(id => ByndHome3D.runtime.navigate(id), id); if(!started)fs.writeFileSync(path.join(output,'blocked.json'),JSON.stringify(await page.evaluate(()=>({floor:ByndHome3D.Villa.plan('game_room'), furniture:ByndHome3D.runtime.worldFurniture().map(r=>({placement:r.placement, footprint:r.item.footprint, bounds:new ByndHomeEngine.Box3().setFromObject(r.model)}))})),null,2)); assert.equal(started,true,'reachable '+id+': '+JSON.stringify(await state()));
            await page.waitForFunction(id => ByndHome3D.runtime.stats().room === id && !ByndHome3D.runtime.stats().actors.find(a=>a.who==='user').path, id, { timeout: 60000 });
            const s = await state(); assert.equal(s.villa.generation, upper.villa.generation); assert.equal(s.actors.find(a=>a.who==='user').position.y, 3.27);
            report.visits.push(s); await page.screenshot({ path: path.join(output, id + '.png') });
        }
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.interact('bed','Sleep')), true);
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.find(a=>a.who==='user').action==='Sleep', {}, { timeout: 60000 });
        const sleep = await state(); assert.ok(sleep.actors.find(a=>a.who==='user').pose.head.y > 3.6); report.sleep = sleep;
        await page.screenshot({ path: path.join(output, 'bedroom-sleep.png') });
        await page.evaluate(async()=>{
            const H=ByndHome3D,p=H.runtime.furniture().find(r=>r.local.id==='armchair').placement;
            H.runtime.setBuild(true);await H.runtime.beginDraft(p);
            const point=H.runtime.project(1.8,1.8);H.runtime.moveDraft(point.x,point.y);
        });
        const draft=await page.evaluate(()=>ByndHome3D.runtime.draft());assert.ok(Math.abs(draft.position[0]-1.8)<.11&&Math.abs(draft.position[2]-1.8)<.11,'upstairs drag projects into saved room coordinates');
        await page.evaluate(()=>{ByndHome3D.runtime.clearDraft();ByndHome3D.runtime.setBuild(false);});
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.navigate('stair_hall')), true);
        await page.waitForFunction(() => ByndHome3D.runtime.stats().villa.level===0 && !document.querySelector('.home3d-scene.is-loading'), {}, { timeout: 60000 });
        report.downstairs = await state(); assert.equal(report.downstairs.actors.find(a=>a.who==='user').position.y,.07);
        // A failed floor save must not claim arrival upstairs or strand the
        // avatar in a permanent transition. Restore a safe stair entry to retry.
        await page.evaluate(()=>{window.villaOriginalWrite=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('quota');};});
        assert.equal(await page.evaluate(()=>ByndHome3D.runtime.navigate('landing')),true);
        await page.waitForFunction(()=>ByndHome3D.runtime.stats().villa.transitioning,{}, {timeout:60000});
        await page.waitForFunction(()=>!ByndHome3D.runtime.stats().villa.transitioning&&!ByndHome3D.runtime.stats().actors.find(a=>a.who==='user').path,{}, {timeout:60000});
        report.failedFloorSave=await state();assert.equal(report.failedFloorSave.villa.level,0);assert.equal(report.failedFloorSave.actors.find(a=>a.who==='user').position.y,.07);
        assert.match(await page.locator('.home3d-notice').innerText(),/没有保存成功/);
        assert.equal(await page.evaluate(()=>ByndHome3D.State.home().room),'stair_hall');
        await page.evaluate(()=>{Storage.prototype.setItem=villaOriginalWrite;document.querySelector('.home3d-notice').hidden=true;});
        await page.setViewportSize({ width: 320, height: 740 });
        for (const safe of [47,59]) for (const parent of [false,true]) {
            await page.evaluate(({safe,parent})=>{ document.querySelector('#demo-window').style.paddingTop=parent?safe+'px':'0'; document.querySelector('#demo-window').style.boxSizing='border-box'; document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top',(parent?0:safe)+'px'); },{safe,parent});
            await page.waitForFunction(()=>{const s=document.querySelector('.home3d-scene').getBoundingClientRect(),r=ByndHome3D.runtime.stats().resolution;return Math.abs(r.width-s.width*r.pixelRatio)<=1&&Math.abs(r.height-s.height*r.pixelRatio)<=1;});
            const box=await page.locator('.home3d-header button').first().boundingBox(); assert.ok(box.y>=safe && box.y<safe+10); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
            const layout=await page.evaluate(safe=>{
                const scene=document.querySelector('.home3d-scene').getBoundingClientRect(),hud=document.querySelector('.home3d-presence').getBoundingClientRect(),tools=document.querySelector('.home3d-view-tools').getBoundingClientRect(),chip=document.querySelector('.home3d-room-chip').getBoundingClientRect(),r=ByndHome3D.runtime.stats().resolution;
                return{fraction:(scene.width*scene.height-hud.width*hud.height-tools.width*tools.height-chip.width*chip.height)/(innerWidth*(innerHeight-safe)),width:r.width,expected:scene.width*r.pixelRatio};
            },safe);
            assert.ok(layout.fraction>=.75 && layout.fraction<=.85,JSON.stringify(layout));assert.ok(Math.abs(layout.width-layout.expected)<=1);report.layouts.push(layout);
        }
        report.collisions=await page.evaluate(()=>villaWalkCheck);assert.ok(report.collisions.samples>100);assert.deepEqual(report.collisions.violations,[]);
        await page.screenshot({path:path.join(output,'villa-320.png')}); assert.deepEqual(report.errors,[]);
        console.log('Villa browser passed: connected floors, every area reachable, physical staircase up/down, upstairs sleep, mobile safe areas.');
    } finally { fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)); await browser.close(); server.close(); }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
