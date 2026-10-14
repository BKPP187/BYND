'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./check-home3d-renderer-browser.cjs');
async function main(){
 const {chromium}=require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const out=path.resolve('artifacts/home3d-renderer/whole-home');fs.mkdirSync(out,{recursive:true});const report={errors:[],walks:[],safeAreas:[]};
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/room?villa=1');
  await page.waitForFunction(()=>ByndHome3D.runtime?.stats().actors.length===2&&!document.querySelector('.home3d-scene.is-loading'),{},{timeout:90000});
  const before=await page.evaluate(()=>JSON.stringify(ByndHome3D.State.home().layouts));
  await page.locator('[data-action="build"]').click();await page.locator('[data-action="build-interiors"]').click();
  assert.equal(await page.locator('[data-scope="all"]').getAttribute('aria-pressed'),'true');
  await page.screenshot({path:path.join(out,'whole-home-style-menu.png')});
  await page.locator('[data-interior="palace"]').click();
  await page.waitForFunction(()=>ByndHome3D.Interiors.uniform()==='palace'&&!document.querySelector('.home3d-scene.is-loading')&&document.querySelector('.home3d-sheet-notice')?.textContent.includes('全屋装修已统一'),{},{timeout:90000});
  report.all=await page.evaluate(()=>({rooms:ByndHome3D.catalogs.roomCatalog.rooms.map(r=>({room:r.id,preset:ByndHome3D.Interiors.resolve(r,ByndHome3D.State.home()).id})),visible:ByndHome3D.runtime.worldFurniture().filter(r=>r.item.type==='sofa').map(r=>({area:r.area,style:r.item.style}))}));
  assert.ok(report.all.rooms.every(r=>r.preset==='palace'));assert.ok(report.all.visible.every(r=>r.style==='european'));assert.equal(await page.evaluate(()=>JSON.stringify(ByndHome3D.State.home().layouts)),before);
  await page.locator('[data-scope="room"]').click();await page.locator('[data-interior="pink"]').click();
  await page.waitForFunction(()=>ByndHome3D.Interiors.resolve(ByndHome3D.Rooms.get('living_room'),ByndHome3D.State.home()).id==='pink'&&!document.querySelector('.home3d-scene.is-loading'),{},{timeout:90000});
  assert.equal(await page.evaluate(()=>ByndHome3D.Interiors.resolve(ByndHome3D.Rooms.get('bedroom'),ByndHome3D.State.home()).id),'palace');report.singleRoom=true;
  await page.locator('[data-scope="all"]').click();
  const raw=await page.evaluate(()=>localStorage.getItem(ByndHome3D.State.key));
  await page.evaluate(()=>{window.wholeHomeSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===ByndHome3D.State.key)throw Error('quota');return wholeHomeSet.call(this,k,v);};});
  await page.locator('[data-interior="garden"]').click();
  await page.locator('.home3d-sheet-notice').filter({hasText:'没有保存成功'}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem(ByndHome3D.State.key)),raw);assert.equal(await page.locator('.home3d-sheet-notice').filter({hasText:'已统一'}).count(),0);
  await page.evaluate(()=>{Storage.prototype.setItem=wholeHomeSet;});report.failedSave=true;
  await page.locator('[data-action="dismiss"]').click();await page.locator('[data-action="build-done"]').click();
  await page.evaluate(()=>{const H=ByndHome3D,tick=H.Animation.tick,update=H.SleepPair.update,destination=H.Animation.destination;H.Animation.destination=(...args)=>{const result=destination(...args);window.walkTapTrace={requested:args[1],result};return result;};H.Animation.tick=(a,t,dt,r)=>tick(a,t,dt*8,r);H.SleepPair.update=(f,a,c)=>{window.wholeHomeActors=a;update(f,a,c);};H.runtime.setQuality('smooth');});
  await page.waitForFunction(()=>window.wholeHomeActors?.every(a=>!a.released));
  await page.evaluate(()=>{const H=ByndHome3D;H.runtime.camera.rotate(H.runtime.camera.stats().desired.yaw/.007,0);H.runtime.camera.step(1,true);});
  const targets=await page.evaluate(()=>{const H=ByndHome3D,T=ByndHomeEngine,row=H.runtime.worldFurniture().find(r=>r.placement.id==='living_room__sofa'),e=H.Build.extent(row.placement),box=new T.Box3().setFromObject(row.model);return[1,-1].map(sign=>({x:sign>0?Math.max(e.x+e.width/2,box.max.x)+.32:Math.min(e.x-e.width/2,box.min.x)-.32,z:Math.max(e.z+e.depth/2,box.max.z)+.32}));});
  for(const target of targets){
   const start=await page.evaluate(()=>({x:wholeHomeActors.find(a=>a.who==='user').root.position.x,z:wholeHomeActors.find(a=>a.who==='user').root.position.z}));
   const point=await page.evaluate(p=>{const H=ByndHome3D,T=ByndHomeEngine;H.runtime.camera.focus(p.x,p.z);H.runtime.camera.step(1,true);document.querySelector('.home3d-notice').hidden=true;const r=document.querySelector('#home3d-scene canvas').getBoundingClientRect(),v=new T.Vector3(p.x,.056,p.z).project(H.runtime.camera.active());return{x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2};},target);
   await page.mouse.click(point.x,point.y);
   try{await page.waitForFunction(s=>{const a=ByndHome3D.runtime.stats().actors.find(a=>a.who==='user');return a.action==='Idle'&&a.path===0&&Math.hypot(a.position.x-s.x,a.position.z-s.z)>.1;},start,{timeout:45000});}catch(e){console.log(JSON.stringify(await page.evaluate(()=>({stats:ByndHome3D.runtime.stats(),notice:document.querySelector('.home3d-notice').textContent,modal:document.querySelector('.home3d-modal').hidden})),null,2));await page.screenshot({path:path.join(out,'walk-failure.png')});throw e;}
   const state=await page.evaluate(()=>({actor:ByndHome3D.runtime.stats().actors.find(a=>a.who==='user'),notice:document.querySelector('.home3d-notice').hidden?'':document.querySelector('.home3d-notice').textContent}));
   console.log(JSON.stringify({target,point,...state,trace:await page.evaluate(()=>window.walkTapTrace)},null,2));assert.ok(Math.hypot(state.actor.position.x-target.x,state.actor.position.z-target.z)<=.66);assert.equal(state.notice,'');report.walks.push({target,...state});
  }
  await page.screenshot({path:path.join(out,'walk-near-furniture.png')});
  await page.evaluate(()=>ByndHome3D.UI.showInteriors());
  for(const safe of [47,59])for(const parent of [false,true]){
   await page.setViewportSize({width:320,height:740});await page.evaluate(({safe,parent})=>{const win=document.querySelector('#demo-window');win.style.paddingTop=parent?safe+'px':'0px';win.style.boxSizing='border-box';document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top',(parent?0:safe)+'px');},{safe,parent});
   const layout=await page.evaluate(()=>{const header=document.querySelector('.home3d-header button').getBoundingClientRect(),scope=document.querySelector('[data-scope="all"]').getBoundingClientRect(),sheet=document.querySelector('.home3d-sheet').getBoundingClientRect();return{top:header.top,scopeTop:scope.top,scopeRight:scope.right,sheetTop:sheet.top,overflow:document.documentElement.scrollWidth>innerWidth};});assert.ok(layout.top>=safe&&layout.sheetTop>=safe&&layout.scopeRight<=320);assert.equal(layout.overflow,false);report.safeAreas.push({safe,parent,...layout});
  }
  await page.screenshot({path:path.join(out,'whole-home-320-safe59.png')});
  await page.evaluate(()=>{window.wholeHomeLoad=ByndHome3D.Furniture.load;ByndHome3D.Furniture.load=async function(item,...args){if(item.type==='sofa')throw Error('fixture load failure');return wholeHomeLoad(item,...args);};});
  await page.locator('[data-interior="natural"]').click();await page.locator('.home3d-sheet-notice').filter({hasText:'部分家具没能加载'}).waitFor({timeout:90000});
  assert.equal(await page.locator('.home3d-sheet-notice').filter({hasText:'已统一'}).count(),0);await page.evaluate(()=>{ByndHome3D.Furniture.load=wholeHomeLoad;});await page.locator('[data-action="dismiss"]').click();await page.locator('.home3d-scene-error [data-action="retry"]').click();
  await page.waitForFunction(()=>!document.querySelector('.home3d-scene.is-loading')&&document.querySelector('.home3d-scene-error').hidden,{},{timeout:90000});report.failedRenderRecovered=true;
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
