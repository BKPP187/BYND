'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./check-home3d-renderer-browser.cjs');
async function main(){
 const {chromium}=require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const output=path.resolve('artifacts/home3d-renderer/view-modes');fs.mkdirSync(output,{recursive:true});const report={errors:[],views:[],safeAreas:[]};
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});page.on('pageerror',e=>report.errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>ByndHome3D.runtime?.stats().actors.length===2&&!document.querySelector('.home3d-scene.is-loading'),{},{timeout:60000});
  const url=room=>'http://127.0.0.1:'+server.address().port+'/room?villa=1&room='+room;
  await page.goto(url('living_room'));await ready();
  await page.evaluate(()=>{const update=ByndHome3D.SleepPair.update;ByndHome3D.SleepPair.update=(f,a,c)=>{window.viewActors=a;update(f,a,c);};ByndHome3D.runtime.setQuality('smooth');});
  await page.waitForFunction(()=>window.viewActors?.length===2);
  report.seat=await page.evaluate(()=>{
   const H=ByndHome3D,T=ByndHomeEngine,a=viewActors.find(a=>a.who==='char'),row=H.runtime.worldFurniture().find(r=>r.placement.id===a.anchor.placementId),hips=a.hips.getWorldPosition(new T.Vector3());
   return{hips:row.model.worldToLocal(hips).toArray(),knee:row.model.worldToLocal(a.knees[0].getWorldPosition(new T.Vector3())).toArray(),front:row.item.footprint[1]/2,surface:H.Furniture.support(row.item).seatHeight,pose:H.Characters.geometry(a)};
  });
  assert.ok(Math.abs(report.seat.hips[2]-.28)<.04,'pelvis stays inside sofa cushion');assert.ok(report.seat.knee[2]>report.seat.front-.05,'knees clear the sofa front');assert.ok(Math.abs(report.seat.hips[1]-.11-report.seat.surface)<.025,'underside contacts cushion instead of burying hip joint');
  await page.screenshot({path:path.join(output,'sofa-seated.png')});
  const walls=async mode=>{await page.locator('[data-action="view-menu"]').click();await page.locator('[data-wall="'+mode+'"]').click();await page.waitForFunction(m=>ByndHome3D.runtime.stats().villa.walls===m,mode);await page.waitForTimeout(180);return page.evaluate(()=>ByndHome3D.runtime.stats().villa.wallMeshes);};
  const cutaway=await walls('cutaway'),full=await walls('full'),hidden=await walls('hidden');assert.ok(full>cutaway);assert.equal(hidden,0);report.walls={cutaway,full,hidden};
  await page.screenshot({path:path.join(output,'walls-hidden.png')});await walls('cutaway');
  for(const mode of ['first','third','exterior','isometric']){
   await page.locator('[data-action="view-menu"]').click();await page.locator('[data-view="'+mode+'"]').click();await page.waitForTimeout(700);
   const s=await page.evaluate(()=>ByndHome3D.runtime.stats());assert.equal(s.camera.mode,mode);assert.equal(s.camera.perspective,['first','third'].includes(mode));assert.equal(s.villa.exterior,mode==='exterior');report.views.push(s);
   assert.ok(s.resolution.width<=390*3&&s.resolution.width>=390);assert.ok(s.calls<260,'bounded visible draw calls '+s.calls);
   await page.screenshot({path:path.join(output,mode+'.png')});
  }
  const before=await page.evaluate(()=>ByndHome3D.runtime.stats());const restored=report.views.at(-1);assert.equal(before.villa.generation,restored.villa.generation);assert.equal(before.room,'living_room');
  assert.equal(await page.evaluate(()=>ByndHome3D.runtime.interact('sofa','Sit')),true);
  await page.waitForFunction(()=>ByndHome3D.runtime.stats().actors.find(a=>a.who==='user').action==='Sit',{}, {timeout:60000});
  report.femaleSeat=await page.evaluate(()=>{const a=viewActors.find(a=>a.who==='user'),row=ByndHome3D.runtime.worldFurniture().find(r=>r.placement.id===a.anchor.placementId),T=ByndHomeEngine;return{hips:row.model.worldToLocal(a.hips.getWorldPosition(new T.Vector3())).toArray(),knee:row.model.worldToLocal(a.knees[0].getWorldPosition(new T.Vector3())).toArray(),front:row.item.footprint[1]/2};});
  assert.ok(report.femaleSeat.knee[2]>report.femaleSeat.front-.05);assert.ok(Math.abs(report.femaleSeat.hips[2]-.28)<.04);await page.screenshot({path:path.join(output,'sofa-two-seated.png')});
  await page.goto(url('garden'));await ready();await page.evaluate(()=>{ByndHome3D.runtime.camera.focus(3.3,6.25);});await page.waitForTimeout(700);await page.screenshot({path:path.join(output,'garden-swing.png')});
  await page.goto(url('bathroom'));await ready();report.bathroom=await page.evaluate(()=>ByndHome3D.runtime.furniture().map(r=>r.item.type));for(const type of ['shower','toilet','vanity','mirror','tub'])assert.ok(report.bathroom.includes(type));
  await page.screenshot({path:path.join(output,'bathroom.png')});
  await page.evaluate(()=>ByndHome3D.runtime.camera.focus(6.0,-6.4));await page.waitForTimeout(700);await page.screenshot({path:path.join(output,'shower-close.png')});
  await page.setViewportSize({width:320,height:740});
  for(const safe of [47,59])for(const parent of [false,true]){
   await page.evaluate(({safe,parent})=>{const p=document.querySelector('#demo-window');p.style.paddingTop=parent?safe+'px':'0';p.style.boxSizing='border-box';document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top',(parent?0:safe)+'px');},{safe,parent});
   await page.locator('[data-action="view-menu"]').click();const box=await page.locator('[data-view="first"]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=320);assert.ok(box.y>=safe);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   report.safeAreas.push({safe,parent,box});await page.locator('[data-view="third"]').click();
  }
  await page.screenshot({path:path.join(output,'third-320.png')});assert.deepEqual(report.errors,[]);
  console.log('View modes passed: sofa pelvis contact, three wall modes, perspective cameras, whole villa, bathroom fixtures and safe areas.');
 }finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
