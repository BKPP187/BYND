'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./check-home3d-renderer-browser.cjs');
async function main(){
 const {chromium}=require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const output=path.resolve('artifacts/home3d-renderer/interactions');fs.mkdirSync(output,{recursive:true});const report={errors:[],menus:[],actions:[]};
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/room?villa=1');
  await page.waitForFunction(()=>ByndHome3D.runtime?.stats().actors.length===2&&!document.querySelector('.home3d-scene.is-loading'),{},{timeout:90000});
  await page.evaluate(()=>{const H=ByndHome3D,tick=H.Animation.tick,update=H.SleepPair.update;H.Animation.tick=(a,t,dt,r)=>tick(a,t,dt*12,r);H.SleepPair.update=(f,a,c)=>{window.interactionActors=a;update(f,a,c);};H.runtime.setQuality('smooth');});
  await page.waitForFunction(()=>window.interactionActors?.every(a=>!a.released));
  async function clickFurniture(id){
   const points=await page.evaluate(id=>{const H=ByndHome3D,T=ByndHomeEngine,row=H.runtime.getFurniture(id);if(!row)throw Error('Missing '+id);H.runtime.camera.focus(row.placement.position[0],row.placement.position[2]);H.runtime.camera.step(1,true);const box=row.pickBounds||new T.Box3().setFromObject(row.model),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),r=document.querySelector('#home3d-scene canvas').getBoundingClientRect();return [[0,0,0],[.34,0,.30],[-.34,0,.30],[0,-.2,.34],[.34,0,-.30]].map(([x,y,z])=>{const p=center.clone().add(new T.Vector3(size.x*x,size.y*y,size.z*z)).project(H.runtime.camera.active());return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};});},id);
   for(const point of points){await page.mouse.click(point.x,point.y);if(await page.locator('.home3d-sheet [data-action="furniture-action"][data-id="'+id+'"]').count())break;if(await page.locator('.home3d-modal:not([hidden]) [data-action="dismiss"]').count())await page.locator('.home3d-modal:not([hidden]) [data-action="dismiss"]').click();}
   await page.locator('.home3d-sheet [data-action="furniture-action"][data-id="'+id+'"]').first().waitFor({state:'visible'});console.log('Clicked '+id);
   const actions=await page.locator('.home3d-sheet [data-action="furniture-action"]').allTextContents();report.menus.push({id,actions});return actions;
  }
  await page.locator('[data-action="view-floor"][data-floor-direction="1"]').click();
  await page.waitForFunction(()=>ByndHome3D.runtime.stats().villa.viewedLevel===1&&!ByndHome3D.runtime.stats().villa.inspecting,{},{timeout:90000});
  const saveBefore=await page.evaluate(()=>localStorage.getItem(ByndHome3D.State.key));
  const bedActions=await clickFurniture('bedroom__bed');assert.ok(bedActions.includes('睡觉')&&bedActions.includes('醒着躺一会儿'));
  assert.equal(await page.evaluate(()=>localStorage.getItem(ByndHome3D.State.key)),saveBefore,'opening the furniture menu does not move or save');
  await page.screenshot({path:path.join(output,'bed-actions-phone.png')});
  await page.locator('[data-action="furniture-action"][data-behavior="Lie"]').click();
  await page.waitForFunction(()=>ByndHome3D.runtime.stats().actors.find(a=>a.who==='user')?.action==='Lie',{},{timeout:120000});
  let state=await page.evaluate(()=>ByndHome3D.runtime.stats());assert.equal(state.villa.level,1);assert.equal(state.actors.find(a=>a.who==='user').pose.eyesClosed,false);report.travel={room:state.room,level:state.villa.level};
  await clickFurniture('bedroom__bed');await page.locator('[data-action="furniture-action"][data-behavior="Sleep"]').click();
  await page.waitForFunction(()=>ByndHome3D.runtime.stats().actors.find(a=>a.who==='user')?.pose.eyesClosed,{},{timeout:120000});
  assert.equal(await page.evaluate(()=>ByndHome3D.State.home().objectState['bedroom:bed'].action),'Sleep');report.actions.push('Sleep and Lie');
  await page.evaluate(()=>ByndHome3D.runtime.stopAction());
  const bathroomRows=await page.evaluate(()=>ByndHome3D.runtime.worldFurniture().filter(r=>r.area==='bathroom').map(r=>({id:r.placement.id,type:r.item.type})));
  for(const [type,action]of [['tub','Bathe'],['tub','Shower'],['shower','Shower'],['vanity','Wash Hands'],['vanity','Wash Face'],['toilet','Use Toilet'],['mirror','Groom']]){
   const row=bathroomRows.find(r=>r.type===type);assert.ok(row,'bathroom has '+type);
   await clickFurniture(row.id);
   if(type==='tub')assert.ok(await page.locator('[data-action="furniture-action"][data-behavior="Bathe"]').count()&&await page.locator('[data-action="furniture-action"][data-behavior="Shower"]').count());
   await page.locator('[data-action="furniture-action"][data-behavior="'+action+'"]').click();
   try{await page.waitForFunction(action=>ByndHome3D.runtime.stats().actors.find(a=>a.who==='user')?.action===action,action,{timeout:30000});}catch(error){console.log(JSON.stringify({errors:report.errors,debug:await page.evaluate(()=>({stats:ByndHome3D.runtime.stats(),notice:document.querySelector('.home3d-notice')?.textContent,anchor:interactionActors.find(a=>a.who==='user').anchor,pending:ByndHome3D.Interactions.hasPending()}))},null,2));await page.screenshot({path:path.join(output,'failure.png')});throw error;}
   const details=await page.evaluate(id=>{const H=ByndHome3D,row=H.runtime.getFurniture(id),actor=interactionActors.find(a=>a.who==='user'),effects=row.model.getObjectByName('hygiene-effects');return{action:actor.action,anchor:actor.anchor,water:effects?.getObjectByName('hygiene-water').visible,active:effects?.visible,robe:actor.body.getObjectByName('bath-robe')?.visible,bathMask:actor.expressions.every(e=>e.bath.value===1),shoes:actor.boots.some(b=>b.visible),reach:actor.hygieneCycle?.reachError};},row.id);
   console.log(JSON.stringify({type,...details}));
   if(['Bathe','Shower'].includes(action)){assert.equal(details.robe,true);assert.equal(details.bathMask,true);assert.equal(details.shoes,false);assert.equal(details.water,true);}if(action==='Wash Hands')assert.ok(details.reach<.15,'hands reach actual basin');
   report.actions.push({type,...details});await page.screenshot({path:path.join(output,type+'-'+action.replaceAll(' ','-')+'.png')});
   if(type==='tub'&&action==='Bathe'){await clickFurniture(row.id);await page.locator('[data-action="stop-action"]').click();}else assert.equal(await page.evaluate(()=>ByndHome3D.runtime.stopAction()),true);
   await page.waitForFunction(()=>interactionActors.find(a=>a.who==='user')?.action==='Idle');
   assert.equal(await page.evaluate(()=>interactionActors.find(a=>a.who==='user').expressions.some(e=>e.bath.value)),false);
  }
  await page.evaluate(()=>ByndHome3D.runtime.setViewpoint('dollhouse'));
  const doll=await clickFurniture('bedroom__bed');assert.ok(doll.includes('睡觉'));report.dollhouseClick=true;
  report.safeAreas=[];
  for(const safe of [47,59])for(const parent of [false,true]){
   await page.setViewportSize({width:320,height:740});
   await page.evaluate(({safe,parent})=>{const win=document.querySelector('#demo-window');win.style.paddingTop=parent?safe+'px':'0px';win.style.boxSizing='border-box';document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top',(parent?0:safe)+'px');},{safe,parent});
   const layout=await page.evaluate(()=>{const head=document.querySelector('.home3d-header button').getBoundingClientRect(),sheet=document.querySelector('.home3d-sheet').getBoundingClientRect();return{head:head.top,sheet:{top:sheet.top,left:sheet.left,right:sheet.right,bottom:sheet.bottom},overflow:document.documentElement.scrollWidth>innerWidth};});
   assert.ok(layout.head>=safe&&layout.head<safe+10);assert.ok(layout.sheet.top>=safe&&layout.sheet.left>=0&&layout.sheet.right<=320&&layout.sheet.bottom<=741);assert.equal(layout.overflow,false);report.safeAreas.push({safe,parent,...layout});
  }
  await page.screenshot({path:path.join(output,'furniture-menu-320-safe59.png')});
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
