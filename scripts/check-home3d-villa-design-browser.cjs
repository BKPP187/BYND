'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./check-home3d-renderer-browser.cjs');
async function main(){
 const {chromium}=require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const output=path.resolve('artifacts/home3d-renderer/villa-design');fs.mkdirSync(output,{recursive:true});const report={errors:[],hours:[],safeAreas:[]};
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,timezoneId:'Asia/Shanghai'}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{const NativeDate=Date;window.testTime=new NativeDate(2026,9,7,12,0,0).getTime();window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[window.testTime]));}static now(){return window.testTime;}};});
  await page.goto('http://127.0.0.1:'+server.address().port+'/room?villa=1');
  await page.waitForFunction(()=>ByndHome3D.runtime?.stats().actors.length===2&&!document.querySelector('.home3d-scene.is-loading'),{},{timeout:90000});
  await page.evaluate(()=>{const H=ByndHome3D,u=H.SleepPair.update;H.SleepPair.update=(f,a,c)=>{window.designActors=a;u(f,a,c);};H.runtime.setQuality('smooth');});
  await page.waitForFunction(()=>window.designActors?.every(a=>!a.released));
  const state=()=>page.evaluate(()=>ByndHome3D.runtime.stats());
  report.props=await page.evaluate(()=>{const H=ByndHome3D,rows=H.runtime.worldFurniture().filter(r=>r.area==='living_room'),bear=rows.find(r=>r.local.id==='bear'),tv=rows.find(r=>r.local.id==='tv');return{radio:rows.some(r=>r.local.id==='radio'),bearYaw:bear.placement.rotation,tvYaw:tv.placement.rotation,ceiling:bear.model.parent.children.filter(g=>g.name.startsWith('villa-area-')).flatMap(g=>g.children).filter(g=>g.userData.ceilingLamp).length,garden:bear.model.parent.getObjectByName('garden-kenney-nature').userData.gardenAssets};});
  assert.equal(report.props.radio,false);assert.equal(report.props.bearYaw,report.props.tvYaw);assert.ok(report.props.ceiling>=4);assert.ok(report.props.garden.instances>150&&report.props.garden.batches<=10);
  const baseline=await page.evaluate(()=>({home:localStorage.getItem(ByndHome3D.State.key),actors:designActors.map(a=>({who:a.who,position:a.root.position.toArray(),action:a.action})),room:ByndHome3D.runtime.stats().room}));
  await page.locator('[data-action="view-floor"][data-floor-direction="1"]').click();
  await page.waitForFunction(()=>ByndHome3D.runtime.stats().villa.viewedLevel===1&&!ByndHome3D.runtime.stats().villa.inspecting,{},{timeout:90000});
  report.survey=await state();assert.equal(report.survey.villa.level,0);assert.equal(report.survey.room,baseline.room);assert.ok(report.survey.villa.surveyFurniture>20);
  assert.equal(await page.evaluate(()=>localStorage.getItem(ByndHome3D.State.key)),baseline.home);
  const after=await page.evaluate(()=>designActors.map(a=>({who:a.who,position:a.root.position.toArray(),action:a.action})));assert.deepEqual(after,baseline.actors);
  assert.equal(await page.locator('[data-action="view-floor"][data-floor-direction="1"]').isDisabled(),true);
  assert.equal(await page.evaluate(()=>ByndHome3D.runtime.walkTo({x:0,z:0})),false);
  assert.match(await page.evaluate(()=>{try{ByndHome3D.runtime.interact('tv','Watch');}catch(e){return e.message;}}),/返回人物/);
  await page.screenshot({path:path.join(output,'second-floor-survey.png')});
  await page.locator('[data-action="view-floor"][data-floor-direction="-1"]').click();assert.equal((await state()).villa.browsing,false);
  // Failed staging keeps the visible floor, actor poses and save intact.
  report.failure=await page.evaluate(async()=>{const H=ByndHome3D,load=H.FloorView.load;H.FloorView.load=()=>Promise.reject(Error('模拟模型读取失败'));let error='';try{await H.runtime.browseFloor(1);}catch(e){error=e.message;}H.FloorView.load=load;return{error,stats:H.runtime.stats(),save:localStorage.getItem(H.State.key)};});
  assert.equal(report.failure.error,'模拟模型读取失败');assert.equal(report.failure.stats.villa.viewedLevel,0);assert.equal(report.failure.stats.villa.inspecting,false);assert.equal(report.failure.save,baseline.home);
  await page.evaluate(()=>{ByndHome3D.runtime.camera.focus(1.0,7.0);ByndHome3D.runtime.zoom(Math.log(.85));});await page.waitForTimeout(800);
  await page.screenshot({path:path.join(output,'garden-day.png')});
  for(const hour of [6,12,18,23]){
   await page.evaluate(hour=>{window.testTime=new Date(2026,9,7,hour,0,0).getTime();},hour);
   await page.waitForFunction(h=>Math.abs(ByndHome3D.runtime.stats().lighting.hour-h)<.01,hour,{timeout:30000});
   const s=await state();assert.ok(s.lighting.pointLights<=s.quality.lights);report.hours.push(s.lighting);
   await page.screenshot({path:path.join(output,'garden-'+hour+'.png')});
  }
  assert.ok(report.hours[1].sunIntensity>report.hours[3].sunIntensity);assert.ok(report.hours[3].lamps>.8);assert.equal(report.hours[3].night,true);
  await page.evaluate(()=>{window.testTime=new Date(2026,9,7,16,0,0).getTime();});
  await page.locator('[data-action="view-menu"]').click();await page.locator('[data-view="exterior"]').click();
  await page.waitForFunction(()=>ByndHome3D.runtime.stats().camera.mode==='exterior'&&ByndHome3D.runtime.stats().renderedView==='exterior',{},{timeout:90000});
  report.exterior=await state();assert.equal(report.exterior.villa.architecture.design,'botanical-cottage-v1');assert.ok(report.exterior.calls<260);
  await page.screenshot({path:path.join(output,'whole-villa-day.png')});
  await page.evaluate(()=>{window.testTime=new Date(2026,9,7,22,0,0).getTime();});await page.waitForFunction(()=>ByndHome3D.runtime.stats().lighting.night);
  await page.screenshot({path:path.join(output,'whole-villa-night.png')});
  await page.locator('[data-action="view-menu"]').click();await page.locator('[data-view="dollhouse"]').click();
  await page.waitForFunction(()=>ByndHome3D.runtime.stats().camera.mode==='dollhouse'&&ByndHome3D.runtime.stats().renderedView==='dollhouse',{},{timeout:90000});report.dollhouse=await state();assert.ok(report.dollhouse.calls<340);
  await page.screenshot({path:path.join(output,'whole-villa-cutaway.png')});
  await page.locator('[data-action="return-person"]').click();assert.equal((await state()).villa.browsing,false);
  await page.setViewportSize({width:320,height:740});
  for(const safe of [47,59])for(const parent of [false,true]){
   await page.evaluate(({safe,parent})=>{const p=document.querySelector('#demo-window');p.style.paddingTop=parent?safe+'px':'0';p.style.boxSizing='border-box';document.querySelector('#home3d-root').style.setProperty('--bynd-header-safe-top',(parent?0:safe)+'px');},{safe,parent});
   const box=await page.locator('.home3d-header [data-action="back"]').boundingBox(),up=await page.locator('[data-floor-direction="1"]').boundingBox();assert.ok(box.y>=safe);assert.ok(up.x>=0&&up.x+up.width<=320);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.safeAreas.push({safe,parent,box,up});
  }
  await page.screenshot({path:path.join(output,'controls-320.png')});assert.deepEqual(report.errors,[]);
  await page.evaluate(()=>ByndHome3D.close());assert.equal(await page.locator('canvas').count(),0);
  console.log('Villa design browser passed: prop placement, nature assets, nonmoving floor survey, atomic failed survey, 24h lighting, roof/exterior/cutaway, mobile safe areas and disposal.');
 }finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
