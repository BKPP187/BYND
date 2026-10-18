'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.BYND_PLAYWRIGHT||'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/study-trace');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:375,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 async function draw(paths){
  const canvas=page.locator('#study-trace-canvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();
  for(const points of paths){if(!points.length)continue;await page.mouse.move(box.x+points[0][0]*box.width,box.y+points[0][1]*box.height);await page.mouse.down();for(const [x,y] of points.slice(1))await page.mouse.move(box.x+x*box.width,box.y+y*box.height);await page.mouse.up();}
 }
 async function switchGlyph(id,index=0){await page.evaluate(({id,index})=>{ByndStudy.setTab('words');ByndStudy.setFoundationLang(id);ByndStudy.setLearningView('trace');ByndStudy.selectFoundationGlyph(index);}, {id,index});}
 const result=()=>page.evaluate(()=>({invalid:document.getElementById('study-trace-canvas').getAttribute('aria-invalid'),feedback:document.getElementById('study-trace-feedback').textContent,progress:localStorage.getItem('bynd_study_trace_v1'),voices:window.__traceVoices.slice()}));
 try{
  await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ByndStudyTrace&&window.ByndStudy);
  await page.evaluate(async()=>{await byndStylesReady;unlockPhone();document.documentElement.classList.add('mobile-runtime');openApp('study');localStorage.setItem('bynd_study_languages_v1',JSON.stringify(['cn','th','ja','en','ko'].map(id=>({id,label:{cn:'中文',th:'ไทย',ja:'日本語',en:'English',ko:'한국어'}[id]}))));
   window.__traceVoices=[];window.ByndAndroid={stopTts(){},speakText(text,code){window.__traceVoices.push({text,code});return{status:'queued'};}};});
  await switchGlyph('th');await page.getByRole('button',{name:'完成描写',exact:true}).click();assert.equal((await result()).voices.length,0);
  await draw([[[.08,.08],[.92,.92]],[[.08,.92],[.92,.08]]]);
  assert.equal((await result()).invalid,'true','lifting the pen immediately marks offshape ink');
  await page.waitForFunction(()=>window.__traceVoices.length===1);
  let r=await result();assert.equal(r.invalid,'true');assert.equal(r.progress,null);assert.deepEqual(r.voices.at(-1),{text:'ก',code:'th-TH'});
  assert.ok(await page.locator('#study-trace-canvas').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let red=0;for(let i=0;i<p.length;i+=4)if(p[i]>160&&p[i+1]<110&&p[i+2]<110&&p[i+3]>128)red++;return red>1000;}));
  for(const width of [320,375]){await page.setViewportSize({width,height:844});await page.locator('.study-trace-panel').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(output,`incorrect-${width}.png`),animations:'disabled'});assert.equal(await page.evaluate(()=>{const a=document.getElementById('app-study-window');return a.scrollWidth>a.clientWidth;}),false);}
  await page.getByRole('button',{name:'清空',exact:true}).click();assert.equal((await result()).invalid,'false');
  // Thai positive fixture: extract a thin centerline from the shown font, then
  // replay it as real pointer gestures. This tests tracing alignment, not OCR.
  const thaiPaths=await page.evaluate(()=>{
   const n=140,c=document.getElementById('study-trace-canvas'),source=ByndStudyTrace.createTemplate('ก',560,getComputedStyle(c).fontFamily).canvas,small=document.createElement('canvas');small.width=small.height=n;
   const ctx=small.getContext('2d');ctx.drawImage(source,0,0,n,n);const rgba=ctx.getImageData(0,0,n,n).data,m=new Uint8Array(n*n);for(let i=0;i<m.length;i++)m[i]=rgba[i*4+3]>64?1:0;
   for(let iteration=0;iteration<100;iteration++){let changed=0;for(let phase=0;phase<2;phase++){const remove=[];for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=y*n+x;if(!m[i])continue;const p=[m[i-n],m[i-n+1],m[i+1],m[i+n+1],m[i+n],m[i+n-1],m[i-1],m[i-n-1]],count=p.reduce((a,b)=>a+b,0);let transitions=0;for(let k=0;k<8;k++)if(!p[k]&&p[(k+1)%8])transitions++;if(count<2||count>6||transitions!==1)continue;if(phase===0?!(p[0]*p[2]*p[4])&&!(p[2]*p[4]*p[6]):!(p[0]*p[2]*p[6])&&!(p[0]*p[4]*p[6]))remove.push(i);}for(const i of remove)m[i]=0;changed+=remove.length;}if(!changed)break;}
   const neighbors=i=>{const x=i%n,y=Math.floor(i/n),out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<n&&y+dy>=0&&y+dy<n&&m[(y+dy)*n+x+dx])out.push((y+dy)*n+x+dx);return out;};
   const visited=new Set(),paths=[],key=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);const walk=(start,next)=>{const points=[start];let previous=start,current=next;visited.add(key(previous,current));while(true){points.push(current);const links=neighbors(current);if(links.length!==2)break;const after=links.find(i=>i!==previous);if(visited.has(key(current,after)))break;visited.add(key(current,after));previous=current;current=after;}paths.push(points.map(i=>[(i%n+.5)/n,(Math.floor(i/n)+.5)/n]));};
   for(let i=0;i<m.length;i++)if(m[i]&&neighbors(i).length!==2)for(const next of neighbors(i))if(!visited.has(key(i,next)))walk(i,next);
   for(let i=0;i<m.length;i++)if(m[i])for(const next of neighbors(i))if(!visited.has(key(i,next)))walk(i,next);
   return paths;
  });
  const half=thaiPaths.map(points=>points.filter(([x])=>x<.52)).filter(points=>points.length>1),beforeHalf=(await result()).voices.length;
  await draw(half);assert.equal((await result()).invalid,'true','a half-written Thai glyph shows feedback without clicking completion');
  await page.waitForFunction(n=>window.__traceVoices.length>n,beforeHalf);assert.match((await result()).feedback,/没写完整/);
  for(const width of [320,375]){await page.setViewportSize({width,height:844});await page.locator('.study-trace-panel').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(output,`automatic-half-thai-${width}.png`),animations:'disabled'});}
  await page.getByRole('button',{name:'清空',exact:true}).click();const beforeFull=(await result()).voices.length;
  await draw(thaiPaths);await page.waitForFunction(n=>window.__traceVoices.length>n,beforeFull);r=await result();assert.equal(r.invalid,'false',r.feedback);assert.equal(r.progress,null,'idle feedback does not prematurely count or clear an unfinished multi-stroke attempt');
  const voiced=r.voices.length;await page.getByRole('button',{name:'完成描写',exact:true}).click();r=await result();assert.equal(JSON.parse(r.progress).th['ก'],1);assert.equal(r.voices.length,voiced,'manual save does not replay the same automatic result');assert.deepEqual(r.voices.at(-1),{text:'ก',code:'th-TH'});
  await page.locator('.study-trace-panel').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(output,'correct-thai-375.png'),animations:'disabled'});
  // A handwritten H uses three ordinary pointer strokes. Bounds and stem
  // centers adapt to the platform font; no assessment function is replaced.
  await switchGlyph('en',7);
  const paths=await page.evaluate(()=>{
   const c=document.getElementById('study-trace-canvas'),t=ByndStudyTrace.createTemplate('H',560,getComputedStyle(c).fontFamily).canvas,p=t.getContext('2d').getImageData(0,0,560,560).data;
   let top=560,bottom=0;for(let y=0;y<560;y++)for(let x=0;x<560;x++)if(p[(y*560+x)*4+3]>128){top=Math.min(top,y);bottom=Math.max(bottom,y);}
   const y=Math.round(top+(bottom-top)*.18),runs=[];let start=-1;
   for(let x=0;x<=560;x++){const on=x<560&&p[(y*560+x)*4+3]>128;if(on&&start<0)start=x;if(!on&&start>=0){runs.push((start+x-1)/2);start=-1;}}
   if(runs.length!==2)throw Error('H stem fixture unavailable');let max=0,ys=[];
   for(let y=Math.round(top+(bottom-top)*.3);y<top+(bottom-top)*.7;y++){let n=0;for(let x=0;x<560;x++)if(p[(y*560+x)*4+3]>128)n++;if(n>max){max=n;ys=[y];}else if(n===max)ys.push(y);}
   const mid=ys.reduce((a,b)=>a+b,0)/ys.length;
   return [[[runs[0]/560,top/560],[runs[0]/560,bottom/560]],[[runs[1]/560,top/560],[runs[1]/560,bottom/560]],[[runs[0]/560,mid/560],[runs[1]/560,mid/560]]];
  });
  await draw(paths);await page.getByRole('button',{name:'完成描写',exact:true}).click();r=await result();assert.equal(r.invalid,'false',r.feedback);assert.equal(JSON.parse(r.progress).en.H,1);assert.deepEqual(r.voices.at(-1),{text:'H',code:'en-US'});
  await page.locator('.study-trace-panel').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(output,'correct-H-375.png'),animations:'disabled'});
  await page.getByRole('button',{name:'再练一次',exact:true}).click();await draw(paths.slice(0,1));await page.getByRole('button',{name:'完成描写',exact:true}).click();r=await result();assert.equal(r.invalid,'true');assert.equal(JSON.parse(r.progress).en.H,1);assert.match(r.feedback,/没写完整/);
  await switchGlyph('ja');assert.equal((await result()).invalid,'false');await draw([[[.1,.1],[.9,.9]]]);
  await page.evaluate(()=>{ByndAndroid.speakText=()=>({status:'missing-data'});});await page.getByRole('button',{name:'完成描写',exact:true}).click();assert.equal((await result()).invalid,'true');assert.match(await page.locator('.study-status').innerText(),/没有安装/);
  await page.evaluate(()=>new Promise(resolve=>{if(speechSynthesis.getVoices().length)return resolve();speechSynthesis.addEventListener('voiceschanged',resolve,{once:true});setTimeout(resolve,1500);}));
  const realAudio=await page.evaluate(()=>({available:speechSynthesis.getVoices().some(v=>v.lang.toLowerCase().startsWith('zh')),events:[]}));
  if(realAudio.available){
   await page.evaluate(()=>{delete window.ByndAndroid;window.__traceRealAudio=[];const Native=window.SpeechSynthesisUtterance;window.SpeechSynthesisUtterance=function(text){const u=new Native(text);for(const type of ['start','end','error'])u.addEventListener(type,e=>window.__traceRealAudio.push({type,text,lang:u.lang,error:e.error||''}));return u;};});
   await switchGlyph('cn');await draw([[[.1,.1],[.9,.9]]]);
   await page.waitForFunction(()=>window.__traceRealAudio.some(e=>e.type==='end'||e.type==='error'),{},{timeout:8000});
   realAudio.events=await page.evaluate(()=>window.__traceRealAudio);assert.ok(realAudio.events.some(e=>e.type==='end'),'installed Chinese voice must finish actual speech after completion');
  }
  for(const safe of [47,59])for(const parent of [true,false]){
   const position=await page.evaluate(({safe,parent})=>{const phone=document.querySelector('.phone-container');phone.style.setProperty('--bynd-header-safe-top',parent?'0px':safe+'px');phone.style.setProperty('height',(844-(parent?safe:0))+'px','important');document.body.style.setProperty('padding-top',parent?safe+'px':'0px','important');const a=document.getElementById('app-study-window');return{top:a.querySelector('.study-topbar button').getBoundingClientRect().top,bottom:a.querySelector('.study-topbar').getBoundingClientRect().bottom,content:a.querySelector('.study-content').getBoundingClientRect().top,overflow:a.scrollWidth>a.clientWidth};},{safe,parent});
   assert.ok(position.top>=safe);assert.ok(position.content>=position.bottom);assert.equal(position.overflow,false);await page.screenshot({path:path.join(output,`safe-${safe}-${parent?'parent':'header'}.png`),animations:'disabled'});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({positive:['actual three-stroke H against the rendered font','Thai font-centerline fixture replayed as pointer gestures'],negative:['Thai offshape X','half-written Thai without clicking completion','partial H','Japanese offshape'],automatic:{penUpFeedback:true,idleMs:950,manualSaveDoesNotReplay:true},speech:'Thai/en locale routing uses a bridge fixture; actual installed Chinese voice is exercised separately below; missing native voice remains visible',realAudio,safeAreas:[47,59],errors},null,2));console.log('Automatic pen-up and idle checks: Thai and H pass; half-written ink turns red without clicking completion; autoplay and missing-voice handling pass; real Chinese voice available='+realAudio.available+'; mobile safe areas pass.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
