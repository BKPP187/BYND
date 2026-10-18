'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.BYND_PLAYWRIGHT||'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/study-ocr-quality');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:375,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ByndStudyReading&&window.ByndStudy);
  const fixture=JSON.parse(fs.readFileSync(path.join(root,'artifacts/study-import/covid/preview.json'),'utf8'));
  const report=await page.evaluate(async words=>{
   await byndStylesReady;unlockPhone();document.documentElement.classList.add('mobile-runtime');openApp('study');
   localStorage.setItem('bynd_study_languages_v1',JSON.stringify([{id:'cn',label:'中文'},{id:'th',label:'ไทย'}]));
   saveStudyCards(words.map((w,i)=>({id:'ocr_'+i,bookId:'proof_fixture',bookTitle:'新冠疫情中泰500词',lines:{th:w.term,cn:w.meaning},source:'pdf',sourceFile:'新冠疫情中泰500词.pdf',sourcePage:1,createdAt:i+1})));
   ByndStudy.openBook('proof_fixture');
   const readings=words.filter(w=>ByndStudyReading.thai(w.term)).length;
   return{total:words.length,readings,candidates:words.filter(w=>!ByndStudyReading.thai(w.term)&&ByndStudyReading.suggestThai(w.term).length).length};
  },fixture);
  const original=await page.evaluate(()=>localStorage.getItem('bynd_study_cards_v1'));
  await page.getByRole('button',{name:/校对与读音 ·/}).click();
  assert.equal(await page.locator('.study-proofread-row').count(),6);
  assert.equal(await page.evaluate(()=>localStorage.getItem('bynd_study_cards_v1')),original);
  const first=page.locator('.study-proofread-row').first();assert.match(await first.innerText(),/โรคติตต่ออันตราย/);
  const correct=await first.locator('select option').evaluateAll(options=>options.find(o=>o.textContent==='โรคติดต่ออันตราย').value);
  await first.locator('select').selectOption(correct);assert.match(await page.locator('.study-proofread-reading').first().innerText(),/rôok dtìt dtɔ̀ɔ/);
  for(const width of [320,375]){
   await page.setViewportSize({width,height:844});await page.locator('#study-thai-proofreading').evaluate(el=>el.scrollIntoView({block:'start'}));
   assert.equal(await page.evaluate(()=>{const a=document.getElementById('app-study-window');return a.scrollWidth>a.clientWidth;}),false);
   await page.screenshot({path:path.join(output,`proofreading-${width}.png`),animations:'disabled'});
  }
  await page.evaluate(()=>ByndStudy.saveThaiProofreading());
  assert.match(await page.locator('.study-status').innerText(),/已校对 1 条/);
  const saved=await page.evaluate(()=>getStudyCards().find(c=>c.id==='ocr_2'));assert.equal(saved.lines.th,'โรคติดต่ออันตราย');assert.equal(saved.textCorrections[0].from,'โรคติตต่ออันตราย');
  const panel=page.locator('[data-book-card="ocr_2"] .study-thai-pronunciation');await panel.locator('summary').click();assert.equal(await panel.locator('li').count(),6);
  await panel.evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(output,'corrected-word-375.png'),animations:'disabled'});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ByndStudy);await page.evaluate(async()=>{await byndStylesReady;unlockPhone();document.documentElement.classList.add('mobile-runtime');openApp('study');ByndStudy.openBook('proof_fixture');});
  assert.match(await page.locator('[data-book-card="ocr_2"] .study-entry-reading').innerText(),/rôok dtìt dtɔ̀ɔ/);
  // API fixture verifies batching and preview plumbing; it is not a live model accuracy test.
  await page.evaluate(()=>{saveStudyCards([{id:'typo',bookId:'ai_fixture',lines:{th:'โรคระบาค',cn:'流行性传染病'}}]);ByndStudy.openBook('ai_fixture');ByndStudy.openThaiProofreading();window.__proofCalls=[];window.callChatApi=async(messages,options)=>{window.__proofCalls.push({messages,hasSignal:!!options.signal});return{ok:true,content:JSON.stringify({words:[{id:'typo',original:'โรคระบาค',term:'โรคระบาด',ipa:'/roːk̚˥˩.ra˦˥.baːt̚˨˩/'}]})};};});
  await page.getByRole('button',{name:'AI 校对与补音',exact:true}).click();assert.match(await page.locator('.study-status').innerText(),/尚未保存/);
  assert.equal(await page.evaluate(()=>getStudyCards()[0].lines.th),'โรคระบาค');
  await page.getByRole('button',{name:'选中 AI 建议',exact:true}).click();await page.getByRole('button',{name:'应用所选 1 条',exact:true}).click();
  assert.equal(await page.evaluate(()=>getStudyCards()[0].lines.th),'โรคระบาด');assert.equal(await page.evaluate(()=>window.__proofCalls.length),1);
  for(const safe of [47,59])for(const parent of [true,false]){
   await page.setViewportSize({width:320,height:844});
   const position=await page.evaluate(({safe,parent})=>{const phone=document.querySelector('.phone-container');phone.style.setProperty('--bynd-header-safe-top',parent?'0px':safe+'px');phone.style.setProperty('height',(844-(parent?safe:0))+'px','important');document.body.style.setProperty('padding-top',parent?safe+'px':'0px','important');ByndStudy.openThaiProofreading();const app=document.getElementById('app-study-window');return{buttonTop:app.querySelector('.study-topbar button').getBoundingClientRect().top,headerBottom:app.querySelector('.study-topbar').getBoundingClientRect().bottom,contentTop:app.querySelector('.study-content').getBoundingClientRect().top,overflow:app.scrollWidth>app.clientWidth};},{safe,parent});
   assert.ok(position.buttonTop>=safe);assert.ok(position.contentTop>=position.headerBottom);assert.equal(position.overflow,false);
   await page.screenshot({path:path.join(output,`safe-${safe}-${parent?'parent':'header'}.png`),animations:'disabled'});
  }
  assert.deepEqual(errors,[]);report.scope='Actual 394-row OCR fixture; dictionary candidate coverage is not confirmation of correct meaning. AI API is a test fixture, not a live model evaluation.';
  fs.writeFileSync(path.join(output,'proofreading-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
