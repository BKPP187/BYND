'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.BYND_PLAYWRIGHT||'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/study-pronunciation');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:375,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixtures=[{id:'greeting',bookId:'practice',lines:{ja:'こんにちは。',th:'สวัสดีค่ะ',cn:'你好。'},note:'扫描识别，请核对文字'},
 {id:'sentence',bookId:'practice',lines:{ja:'今日はまず十分だけ勉強すればいい。',th:'วันนี้เรียนแค่สิบนาทีก็พอ',cn:'今天先学十分钟就好。'},note:'每天学一点。'}];
 const boot=async()=>{await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ByndStudyReading);await page.evaluate(async()=>{await byndStylesReady;unlockPhone();document.documentElement.classList.add('mobile-runtime');openApp('study');ByndStudy.setTab('words');});};
 try{
  await boot();
  await page.evaluate(cards=>{localStorage.setItem('bynd_study_cards_v1',JSON.stringify(cards));localStorage.setItem('bynd_study_books_v1',JSON.stringify([{id:'practice',title:'一起学 · 日语与泰语'}]));ByndStudy.openBook('practice');},fixtures);
  assert.equal(await page.locator('.study-line-speak').count(),6);
  assert.equal(await page.locator('.study-entry-note').count(),1,'only genuine notes remain');
  assert.match(await page.locator('.study-entry-reading').first().innerText(),/sà wàt dii khâʔ/);
  for(const width of [320,375]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>{const a=document.getElementById('app-study-window');return a.scrollWidth>a.clientWidth;}),false);await page.screenshot({path:path.join(output,`multilingual-${width}.png`),animations:'disabled'});}
  // Enumerate and exercise real installed browser voices before replacing anything with a test bridge.
  await page.evaluate(()=>new Promise(resolve=>{if(speechSynthesis.getVoices().length)return resolve();speechSynthesis.addEventListener('voiceschanged',resolve,{once:true});setTimeout(resolve,1500);}));
  const locales=[['中文','zh-CN','你好，今天一起学习。'],['English','en-US','Hello, let us learn together.'],['日本語','ja-JP','こんにちは。一緒に勉強しましょう。'],['한국어','ko-KR','안녕하세요. 같이 공부해요.'],['Français','fr-FR','Bonjour, nous apprenons ensemble.'],['Deutsch','de-DE','Guten Tag, wir lernen zusammen.'],['Español','es-ES','Hola, aprendemos juntos.'],['ไทย','th-TH','สวัสดีค่ะ เรามาเรียนด้วยกัน'],['Português','pt-BR','Olá, vamos aprender juntos.'],['Русский','ru-RU','Привет, давайте учиться вместе.'],['العربية','ar-SA','مرحبا، هيا نتعلم معا.'],['हिन्दी','hi-IN','नमस्ते, हम साथ सीखते हैं।'],['Tiếng Việt','vi-VN','Xin chào, chúng ta cùng học.'],['Bahasa Indonesia','id-ID','Halo, mari belajar bersama.'],['Italiano','it-IT','Ciao, impariamo insieme.']];
  const installed=await page.evaluate(()=>speechSynthesis.getVoices().map(v=>({name:v.name,lang:v.lang,local:v.localService})));
  const report={environment:'Windows / Microsoft Edge, real SpeechSynthesis start/end/error events',installed,results:[]};
  await page.evaluate(()=>{window.__voiceEvents=[];const Original=window.SpeechSynthesisUtterance;window.SpeechSynthesisUtterance=function(text){const u=new Original(text);for(const type of ['start','end','error'])u.addEventListener(type,e=>window.__voiceEvents.push({type,error:e.error||'',text,lang:u.lang}));return u;};});
  for(const [label,code,text]of locales){
   const available=installed.some(v=>v.lang.split('-')[0].toLowerCase()===code.split('-')[0]);
   await page.evaluate(({text,code})=>{speechSynthesis.cancel();window.__voiceEvents=[];let b=document.getElementById('voice-probe');if(!b){b=document.createElement('button');b.id='voice-probe';b.style.cssText='position:fixed;left:0;top:0;z-index:9999999';b.textContent='test';document.body.append(b);}b.onclick=()=>ByndStudy.speak(text,code);},{text,code});
   await page.locator('#voice-probe').click();
   if(available)await page.waitForFunction(()=>window.__voiceEvents.some(e=>['end','error'].includes(e.type)),{},{timeout:8000}).catch(()=>{});
   const events=await page.evaluate(()=>window.__voiceEvents);
   report.results.push({label,code,available,events,result:events.some(e=>e.type==='end')?'completed':events.find(e=>e.type==='error')?.error||(!available?'voice-not-installed':'no-completion-event')});
   fs.writeFileSync(path.join(output,'real-voice-report.json'),JSON.stringify(report,null,2));
  }
  await page.evaluate(()=>{speechSynthesis.cancel();document.getElementById('voice-probe').remove();window.__nativeCalls=[];window.ByndAndroid={speakText(text,code){window.__nativeCalls.push({text,code});return JSON.stringify({status:'queued'});},stopTts(){}};ByndStudy.openBook('practice');});
  for(const language of ['日本語','ไทย','中文'])await page.locator('[data-book-card="greeting"]').getByRole('button',{name:'朗读'+language,exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.__nativeCalls),[{text:'こんにちは。',code:'ja-JP'},{text:'สวัสดีค่ะ',code:'th-TH'},{text:'你好。',code:'zh-CN'}]);
  await page.evaluate(()=>ByndStudy.setLearningView('cards'));
  await page.locator('.study-learn-vote button').first().click();assert.match(await page.locator('.study-learn-card-top').innerText(),/1 \/ 2/);
  assert.equal(await page.evaluate(()=>window.__nativeCalls.at(-1).text),'こんにちは。');
  await page.locator('.study-learn-vote button').last().click();assert.match(await page.locator('.study-learn-card-top').innerText(),/2 \/ 2/);
  await page.getByRole('button',{name:'撤销上次',exact:true}).click();assert.match(await page.locator('.study-learn-card-top').innerText(),/1 \/ 2/);
  await page.screenshot({path:path.join(output,'learning-card.png'),animations:'disabled'});
  await page.evaluate(()=>{ByndStudy.setLearningView('book');ByndStudy.openBook('practice');});
  await page.locator('[data-book-card="greeting"]').getByRole('button',{name:'编辑词句',exact:true}).click();await page.locator('#study-card-reading-th').fill('sa wat di kha (校正)');await page.locator('.study-card-editor').getByRole('button',{name:'保存',exact:true}).click();
  assert.match(await page.locator('[data-book-card="greeting"] .study-entry-reading').innerText(),/校正/);
  await page.evaluate(()=>ByndStudy.closeBook());await page.getByRole('button',{name:'设置词本：一起学 · 日语与泰语',exact:true}).click();
  await page.screenshot({path:path.join(output,'delete-notebook.png'),animations:'disabled'});
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'删除词本',exact:true}).click();assert.equal(await page.evaluate(()=>getStudyCards().length),2);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'删除词本',exact:true}).click();assert.equal(await page.evaluate(()=>getStudyCards().length),0);await boot();assert.equal(await page.locator('[data-study-book]').count(),0,'deleted book stays deleted after reload');
  const realFile=path.join(root,'artifacts/study-import/covid/preview.json');
  if(fs.existsSync(realFile)){
   const rows=JSON.parse(fs.readFileSync(realFile,'utf8'));
   const coverage=await page.evaluate(rows=>{const cards=rows.map((word,i)=>({id:'covid_'+i,bookId:'covid',source:'pdf',lines:{th:word.term,cn:word.meaning},note:'扫描识别，请核对文字'}));localStorage.setItem('bynd_study_cards_v1',JSON.stringify(cards));localStorage.setItem('bynd_study_books_v1',JSON.stringify([{id:'covid',title:'新冠疫情中泰500词'}]));ByndStudy.openBook('covid');return{total:rows.length,withReading:rows.filter(row=>ByndStudyReading.thai(row.term)).length,missing:rows.filter(row=>!ByndStudyReading.thai(row.term)).map(row=>row.term)};},rows);
   fs.writeFileSync(path.join(output,'covid-reading-coverage.json'),JSON.stringify(coverage,null,2));await page.screenshot({path:path.join(output,'covid-readings.png'),animations:'disabled'});console.log('Actual scanned word references: '+coverage.withReading+'/'+coverage.total);
  }
  assert.deepEqual(errors,[]);console.log('Per-language speakers, replay/advance/undo, manual readings, notebook cancellation/deletion/reload passed. Real voice report: '+path.join(output,'real-voice-report.json'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
