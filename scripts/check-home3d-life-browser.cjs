'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/home3d-life');fs.mkdirSync(out,{recursive:true});
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const report={errors:[],safeAreas:[]};
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(version=>{
   localStorage.setItem('bynd_lastSeenVersion',version);localStorage.setItem('bynd_builtin_library_seen_v1','1');
   localStorage.setItem('my_characters_data',JSON.stringify([{id:'home-life-proof',name:'林间',description:'温柔，喜欢阅读',history:[],chatConfig:{aiPhoneSnapshot:{generatedBy:'api',updatedAt:Date.now(),installedApps:['chat','memo','settings'],memos:[{title:'周末',content:'一起逛花市'}]}}}]));
  },require('./bump-version.cjs').currentVersion());
  await page.route('https://**/*',route=>route.abort());
  await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__byndCoreReady&&typeof openWechatAiPhone==='function');
  await page.evaluate(async()=>{
   await window.__byndCoreReady;await window.byndStylesReady;unlockPhone();ByndBuiltinLibrary?.close();document.getElementById('bynd-version-letter')?.remove();document.documentElement.classList.add('mobile-runtime');
   shouldAutoSyncWechatAiPhone=()=>false;scheduleWechatAiPhoneDiaryFollowUp=()=>false;callChatApi=async()=>({ok:true,content:'你慢慢看，我在这里。'});
   openApp('home3d');
  });
  await page.waitForSelector('#home3d-bind-char');
  await page.evaluate(async()=>{ByndHome3D.State.bind('home-life-proof');await ByndHome3D.UI.arrive();window.homeLifeRuntime=ByndHome3D.runtime;});
  await page.waitForFunction(()=>ByndHome3D.runtime?.stats().actors.length===2&&!document.querySelector('.home3d-scene.is-loading'));
  await page.locator('[data-action="journal"]').click();assert.equal(await page.locator('.home3d-sheet h2').textContent(),'生活手记');assert.ok((await page.locator('.home3d-sheet-head').textContent()).includes('在家发生的小事'));
  await page.screenshot({path:path.join(out,'journal-390.png')});await page.locator('[data-action="dismiss"]').click();
  for(let i=0;i<2;i++){
   await page.locator('.home3d-presence [data-action="char"]').first().click();await page.locator('[data-action="phone"]').click();
   await page.locator('#wc-ai-phone-overlay').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>ByndHome3D.runtime===homeLifeRuntime&&document.getElementById('app-home3d-window').classList.contains('active')),true);
   if(!i)await page.screenshot({path:path.join(out,'phone-over-home.png')});
   await page.getByRole('button',{name:'关闭小手机',exact:true}).last().click();await page.locator('#wc-ai-phone-overlay').waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>ByndHome3D.runtime===homeLifeRuntime&&document.getElementById('app-home3d-window').classList.contains('active')&&!document.getElementById('app-wechat-window').classList.contains('active')),true);
  }
  report.phoneReturnsHome=true;await page.screenshot({path:path.join(out,'returned-home.png')});
  await page.locator('[data-action="journal"]').click();
  for(const safe of [47,59])for(const parent of [false,true]){
   await page.setViewportSize({width:320,height:740});await page.evaluate(({safe,parent})=>{const win=document.getElementById('app-home3d-window');win.style.paddingTop=parent?safe+'px':'0';win.style.boxSizing='border-box';document.getElementById('home3d-root').style.setProperty('--bynd-header-safe-top',(parent?0:safe)+'px');},{safe,parent});
   const rect=await page.locator('.home3d-sheet-head button').boundingBox();assert.ok(rect.y>=safe);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.safeAreas.push({safe,parent,closeTop:rect.y});
  }
  await page.screenshot({path:path.join(out,'journal-320-safe59.png')});await page.locator('[data-action="dismiss"]').click();
  // Geometry contact sheet uses exactly the same production doorway factory.
  await page.setViewportSize({width:1100,height:450});
  report.doors=await page.evaluate(()=>{
   const H=ByndHome3D,T=ByndHomeEngine;const host=document.createElement('div');host.id='door-proof';host.style.cssText='position:fixed;inset:0;z-index:99999;background:#f6f2e9';document.body.appendChild(host);
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1.5);renderer.setSize(1100,390);renderer.setClearColor('#f6f2e9');renderer.outputColorSpace=T.SRGBColorSpace;host.appendChild(renderer.domElement);
   const scene=new T.Scene(),camera=new T.OrthographicCamera(-6.3,6.3,2.8,-1.67,.1,100);camera.position.set(0,4,16);camera.lookAt(0,1.2,0);const ambient=new T.HemisphereLight('#ffffff','#b9aa91',2.4);scene.add(ambient);const sun=new T.DirectionalLight('#fff5e2',2.1);sun.position.set(-5,8,6);scene.add(sun);
   const materials=H.Materials.create('cream'),pairs=[['living_room','hallway'],['bedroom','upper_hallway'],['kitchen','hallway'],['bathroom','upper_hallway'],['living_room','garden']];
   const rows=pairs.map(([a,b],i)=>{const door=H.Villa.doorway({a,b,x:(i-2)*2.5,z:0,axis:'z',width:1.75},0,materials);scene.add(door);return{a,b,style:door.userData.door.style};});renderer.render(scene,camera);
   const labels=document.createElement('div');labels.style.cssText='display:flex;text-align:center;font:17px sans-serif;color:#5c5147;padding:0 10px';labels.innerHTML=['开放通道','卧室木门 · Kenney','厨房半高门','浴室磨砂移门','花园玻璃门 · Kenney'].map(t=>'<span style="flex:1">'+t+'</span>').join('');host.appendChild(labels);
   window.disposeDoorProof=()=>{scene.children.forEach(g=>H.Shapes.disposeGeometry(g));materials.dispose();renderer.dispose();host.remove();};return rows;
  });
  assert.equal(new Set(report.doors.map(d=>d.style)).size,5);await page.screenshot({path:path.join(out,'doors.png')});await page.evaluate(()=>{disposeDoorProof();ByndHome3D.close();});
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
