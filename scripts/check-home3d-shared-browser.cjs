'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./check-home3d-renderer-browser.cjs');
async function main(){
 const {chromium}=require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const out=path.resolve('artifacts/home3d-shared');fs.mkdirSync(out,{recursive:true});const report={errors:[],actions:[],themes:[],toolbars:[]};
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});page.on('pageerror',e=>report.errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/room?villa=1');
  await page.waitForFunction(()=>ByndHome3D.runtime?.stats().actors.length===2&&!document.querySelector('.home3d-scene.is-loading'),{},{timeout:90000});
  await page.evaluate(()=>{const H=ByndHome3D,tick=H.Animation.tick,update=H.SleepPair.update;H.Animation.tick=(a,t,dt,r)=>tick(a,t,dt*(a.who==='user'?16:10),r);H.SleepPair.update=(f,a,c)=>{window.sharedActors=a;update(f,a,c);};H.runtime.setQuality('smooth');H.State.withHome(h=>{h.consentHug=true;h.relationship='恋人';});});
  await page.waitForFunction(()=>window.sharedActors?.length===2);
  async function perform(id,action){
   if(!report.actions.length){
    const points=await page.evaluate(id=>{const H=ByndHome3D,T=ByndHomeEngine,row=H.runtime.getFurniture(id);H.runtime.camera.focus(row.placement.position[0],row.placement.position[2]);H.runtime.camera.step(1,true);const box=new T.Box3().setFromObject(row.model),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),r=document.querySelector('#home3d-scene canvas').getBoundingClientRect();return [[0,0,0],[.34,0,.30],[-.34,0,.30],[0,-.2,.34],[.34,0,-.30]].map(([x,y,z])=>{const p=center.clone().add(new T.Vector3(size.x*x,size.y*y,size.z*z)).project(H.runtime.camera.active());return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};});},id);
    for(const point of points){await page.mouse.click(point.x,point.y);if(await page.locator('.home3d-modal:not([hidden]) [data-action="furniture-together"]').count())break;if(await page.locator('.home3d-modal:not([hidden]) [data-action="dismiss"]').count())await page.locator('.home3d-modal:not([hidden]) [data-action="dismiss"]').click();}
    const menu=page.locator('.home3d-modal:not([hidden])');await menu.locator('[data-action="furniture-together"]').first().waitFor({state:'visible'});report.menu=await menu.locator('[data-action="furniture-together"]').allTextContents();assert.ok(report.menu.includes('一起看书'));await page.screenshot({path:path.join(out,'shared-menu.png')});await menu.locator('[data-action="furniture-together"][data-behavior="'+action+'"]').click();
   }else await page.evaluate(async({id,action})=>{const H=ByndHome3D;await H.Interactions.perform(id,action,true);const row=H.runtime.getFurniture(id);if(row){H.runtime.camera.focus(row.placement.position[0],row.placement.position[2]);H.runtime.camera.step(1,true);}},{id,action});
   try{await page.waitForFunction(action=>{const h=ByndHome3D.State.home();return ['user','char'].every(w=>h.executions[w]?.phase==='acting'&&h.executions[w]?.action===action);},action,{timeout:120000});}
   catch(e){console.log(JSON.stringify(await page.evaluate(()=>({stats:ByndHome3D.runtime.stats(),executions:ByndHome3D.State.home().executions,notice:document.querySelector('.home3d-notice').textContent,actors:sharedActors.map(a=>({who:a.who,path:a.path,destination:a.destination,shared:a.sharedInteraction}))})),null,2));throw e;}
   const details=await page.evaluate(()=>({executions:ByndHome3D.State.home().executions,actors:sharedActors.map(a=>({who:a.who,action:a.action,anchor:a.anchor,shared:a.sharedInteraction})),level:ByndHome3D.runtime.stats().villa.level}));
   assert.equal(details.executions.user.startedAt,details.executions.char.startedAt);assert.ok(details.actors.every(a=>a.shared&&a.action===action));report.actions.push({id,action,...details});
   await page.evaluate(id=>{const H=ByndHome3D,row=H.runtime.getFurniture(id);H.runtime.camera.focus(row.placement.position[0],row.placement.position[2]);H.runtime.camera.step(1,true);},id);
   await page.screenshot({path:path.join(out,action.replaceAll(' ','-')+'.png')});
  }
  await perform('living_room__sofa','Read');
  assert.equal(await page.evaluate(()=>ByndHome3D.runtime.stopAction()),true);
  assert.ok(await page.evaluate(()=>sharedActors.every(a=>!a.sharedInteraction&&a.action==='Idle')));
  await perform('living_room__tv','Watch');
  await perform('dining_room__dining-table','Eat');
  await page.waitForFunction(()=>sharedActors.every(a=>a.mealPair),{},{timeout:30000});report.mealPair=true;
  // Both climb the stairs, then use separate sides of the same bed.
  await page.evaluate(()=>ByndHome3D.runtime.browseFloor(1));
  await perform('bedroom__bed','Sleep');assert.equal(report.actions.at(-1).level,1);
  await page.waitForFunction(()=>sharedActors.every(a=>a.sleepPair),{},{timeout:30000});report.sleepPair=true;
  assert.equal(await page.evaluate(()=>ByndHome3D.runtime.stopAction()),true);
  await page.evaluate(()=>ByndHome3D.runtime.navigate('living_room'));
  await page.waitForFunction(()=>ByndHome3D.runtime.stats().villa.level===0&&!ByndHome3D.runtime.stats().villa.transitioning&&!document.querySelector('.home3d-scene.is-loading'),{},{timeout:90000});
  assert.equal(await page.evaluate(()=>ByndHome3D.runtime.stats().actors.find(a=>a.who==='char').visible),false);
  await perform('living_room__sofa','Sit');report.fetchedPartner=true;
  await page.evaluate(()=>ByndHome3D.runtime.stopAction());
  const blocked=await page.evaluate(async()=>{const H=ByndHome3D,n=H.State.home().moments.length,path=H.Animation.path;let person=0;H.Animation.path=(...args)=>++person===1?path(...args):[];try{await H.Interactions.perform('living_room__sofa','Read',true);}finally{H.Animation.path=path;}return{before:n,after:H.State.home().moments.length,executions:H.State.home().executions,walking:sharedActors.some(a=>a.path.length)};});
  assert.equal(blocked.before,blocked.after);assert.equal(blocked.walking,false);assert.ok(Object.values(blocked.executions).every(e=>e.phase==='blocked'));report.blocked=blocked;
  // Cancellation before arrival stops both without a phantom use.
  const cancel=await page.evaluate(async()=>{const H=ByndHome3D,n=H.State.home().moments.length;await H.Interactions.perform('living_room__sofa','Read',true);H.Interactions.cancel();return {before:n,after:H.State.home().moments.length,actors:sharedActors.map(a=>({path:a.path.length,shared:a.sharedInteraction})),executions:H.State.home().executions};});
  assert.equal(cancel.before,cancel.after);assert.ok(cancel.actors.every(a=>!a.path&&!a.shared));assert.ok(Object.values(cancel.executions).every(e=>e.phase==='cancelled'));report.cancel=cancel;
  // Persistence failure during arrival cannot leave either participant acting.
  await page.evaluate(async()=>{const H=ByndHome3D;await H.Interactions.perform('living_room__sofa','Read',true);window.sharedSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===H.State.key)throw Error('quota');return sharedSet.call(this,k,v);};});
  await page.waitForFunction(()=>document.querySelector('.home3d-notice').textContent.includes('没有保存成功'),{},{timeout:60000});
  assert.ok(await page.evaluate(()=>sharedActors.every(a=>a.action==='Idle'&&!a.sharedInteraction)));
  await page.evaluate(()=>{Storage.prototype.setItem=sharedSet;ByndHome3D.Interactions.cancel();ByndHome3D.UI.notice('保存重试检查已完成');});report.failedArrivalSave=true;
  // Theme refresh checks actual instanced plants and shell, not only the stored preset.
  for(const theme of ['pink','monochrome']){
   await page.evaluate(async theme=>{const H=ByndHome3D;H.Interiors.applyAll({preset:theme},true);await H.UI.loadRoom('garden',{rebuild:true});H.runtime.camera.focus(0,7.2);H.runtime.camera.step(1,true);},theme);
   const colors=await page.evaluate(()=>{let parent=ByndHome3D.runtime.worldFurniture()[0].model;while(parent.parent&&!parent.parent.isScene)parent=parent.parent;const sets=[];parent.traverse(n=>{if(n.userData.gardenPalette)sets.push({name:n.name,palette:n.userData.gardenPalette});});return sets;});
   assert.ok(colors.length>=2);assert.ok(colors.every(c=>c.palette.id===theme));report.themes.push({theme,colors});await page.screenshot({path:path.join(out,'garden-'+theme+'.png')});
  }
  assert.notEqual(report.themes[0].colors[0].palette.grass,report.themes[1].colors[0].palette.grass);
  report.showers=[];
  for(const model of ['bunny-blue-v1','silver-red-v1']){
   await page.evaluate(async model=>{const H=ByndHome3D;H.State.withHome(home=>{home.activity={room:'bathroom',action:'Idle',target:'',until:Date.now()+600000};});await H.UI.loadRoom('bathroom',{rebuild:true});if(model==='bunny-blue-v1')await H.Interactions.perform('bathroom__shower','Shower');else H.runtime.setCharActivity({room:'bathroom',target:'shower',action:'Shower',source:'local'},true);},model);
   await page.waitForFunction(model=>sharedActors.find(a=>a.modelId===model)?.action==='Shower',model,{timeout:60000});
   const details=await page.evaluate(model=>{const H=ByndHome3D,a=sharedActors.find(a=>a.modelId===model),c=a.hygieneCycle,robe=a.body.getObjectByName('bath-robe');H.runtime.camera.focus(a.root.position.x,a.root.position.z);H.runtime.camera.rotate((H.runtime.camera.stats().desired.yaw-Math.PI)/.007,0);H.runtime.camera.step(1,true);return{reach:c.reachError,frames:c.frames.length,motion:Math.max(...c.frames.map(f=>f[0].angleTo(c.frames[0][0]))),robe:robe.getObjectByName('robe-shaped-cloth')?.visible,belt:!!robe.getObjectByName('robe-waist-belt')};},model);
   assert.ok(details.reach<.025&&details.motion>.04);assert.equal(details.frames,16);assert.ok(details.robe&&details.belt);report.showers.push({model,...details});await page.screenshot({path:path.join(out,'shower-'+model+'.png')});
   await page.evaluate(()=>ByndHome3D.runtime.stopAction());
  }
  for(const width of [320,390,700])for(const safe of [47,59])for(const parent of [false,true]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(({safe,parent})=>{const win=document.querySelector('#demo-window');win.style.paddingTop=parent?safe+'px':'0';win.style.boxSizing='border-box';document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top',(parent?0:safe)+'px');},{safe,parent});
   const boxes=await page.evaluate(()=>({buttons:[...document.querySelectorAll('.home3d-quick-actions>button')].map(b=>{const r=b.getBoundingClientRect();return{x:r.x,w:r.width,bottom:r.bottom};}),top:document.querySelector('.home3d-header button').getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth}));
   assert.equal(boxes.buttons.length,5);assert.ok(Math.max(...boxes.buttons.map(b=>b.w))-Math.min(...boxes.buttons.map(b=>b.w))<1);assert.equal(boxes.overflow,false);assert.ok(boxes.top>=safe&&boxes.top<safe+10);assert.ok(boxes.buttons.every(b=>b.bottom<=844));report.toolbars.push({width,safe,parent,...boxes});
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'toolbar-390.png')});
  assert.deepEqual(report.errors,[]);
 }catch(error){await page.screenshot({path:path.join(out,'failure.png')});throw error;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
 console.log('Shared interactions, theme propagation and toolbar checks passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
