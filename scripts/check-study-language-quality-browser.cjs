'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.BYND_PLAYWRIGHT||'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/study-language-quality');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:375,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ByndStudyLanguageGuides&&window.ByndStudyReading);
  await page.evaluate(async()=>{await byndStylesReady;unlockPhone();document.documentElement.classList.add('mobile-runtime');openApp('study');localStorage.setItem('bynd_study_cards_v1',JSON.stringify([{id:'disease',lines:{th:'โรคติดต่อ',cn:'传染病'},pronunciations:{th:{text:'rok tit to',forText:'โรคติดต่อ'}}}]));ByndStudy.openBook('collection');window.__voiceCalls=[];window.ByndAndroid={stopTts(){},speakText(text,code){window.__voiceCalls.push({text,code});return {status:'queued'};}};});
  const original=await page.evaluate(()=>localStorage.getItem('bynd_study_cards_v1'));
  assert.match(await page.locator('.study-entry-reading').innerText(),/rôok dtìt dtɔ̀ɔ/);
  assert.match(await page.locator('.study-thai-pronunciation > summary').innerText(),/3降 \/ 2低 \/ 2低/);
  for(const width of [320,375]){await page.setViewportSize({width,height:844});await page.screenshot({path:path.join(output,`thai-${width}.png`),animations:'disabled'});}
  await page.locator('.study-thai-pronunciation > summary').click();assert.doesNotMatch(await page.locator('.study-thai-pronunciation').innerText(),/แม่ →|ม้า →/);assert.match(await page.locator('.study-thai-ipa').innerText(),/tɔː˨˩/);
  assert.equal(await page.locator('.study-thai-breakdown > li').count(),3);assert.match(await page.locator('.study-thai-tone-reason').first().innerText(),/ร.*低辅音.*长元音/);
  await page.locator('.study-line-speak').first().click();assert.deepEqual(await page.evaluate(()=>window.__voiceCalls.at(-1)),{text:'โรคติดต่อ',code:'th-TH'});
  await page.locator('.study-thai-pronunciation').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'thai-tone-details.png'),animations:'disabled'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('bynd_study_cards_v1')),original);
  await page.evaluate(()=>{ByndStudy.setLearningView('cards');ByndStudy.setFoundationLang('th');});assert.match(await page.locator('.study-learn-reading').innerText(),/dtɔ̀ɔ/);assert.equal(await page.locator('.study-thai-pronunciation').count(),1);
  await page.evaluate(()=>{saveStudyCards([{id:'disease',lines:{th:'โรคติดต่อ',cn:'传染病'}},{id:'thanks',lines:{th:'ขอบคุณ',cn:'谢谢'}},{id:'danger',lines:{th:'โรคติดต่ออันตราย',cn:'危险传染病'}},{id:'typo',lines:{th:'โรคติตต่ออันตราย',cn:'待校对'},source:'pdf'}]);ByndStudy.openBook('collection');});
  assert.equal(await page.locator('.study-thai-reference').count(),1,'general help appears once instead of per word');
  for(const id of ['disease','thanks','danger','typo']){
   const panel=page.locator(`[data-book-card="${id}"] .study-thai-pronunciation`);await panel.locator(':scope > summary').click();const text=await panel.innerText();assert.doesNotMatch(text,/แม่ →|ม้า →/);
   if(id==='thanks'){await panel.getByText('发音动作',{exact:true}).first().click();assert.match(await panel.innerText(),/送气.*双唇闭住/s);}
   if(id==='danger')assert.equal(await panel.locator('.study-thai-breakdown > li').count(),6);
   if(id==='typo'){assert.match(text,/โรคติตต่ออันตราย.*暂缺.*完整读音/s);assert.equal(await panel.locator('.study-thai-ipa').count(),0);assert.equal(await panel.locator('.study-thai-breakdown').count(),0);}
   await panel.evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(output,`word-${id}-375.png`),animations:'disabled'});
  }
  await page.setViewportSize({width:320,height:844});await page.locator('[data-book-card="disease"] .study-thai-pronunciation').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(output,'word-disease-320.png'),animations:'disabled'});
  assert.equal(await page.evaluate(()=>{const app=document.getElementById('app-study-window');return app.scrollWidth>app.clientWidth;}),false);
  await page.locator('[data-book-card="typo"]').getByRole('button',{name:'校对此词 / 补充读音',exact:true}).click();assert.equal(await page.locator('[data-study-lang="th"]').inputValue(),'โรคติตต่ออันตราย');await page.evaluate(()=>ByndStudy.cancelEdit());
  const typo=page.locator('[data-book-card="typo"] .study-thai-pronunciation');await typo.locator('summary').click();
  assert.match(await typo.locator('.study-thai-candidate-reading').first().innerText(),/rôok dtìt dtɔ̀ɔ/);
  for(const width of [320,375]){
   await page.setViewportSize({width,height:844});await typo.evaluate(el=>el.scrollIntoView({block:'start'}));
   assert.equal(await page.evaluate(()=>{const app=document.getElementById('app-study-window');return app.scrollWidth>app.clientWidth;}),false);
   await page.screenshot({path:path.join(output,`inline-candidate-${width}.png`),animations:'disabled'});
  }
  await typo.getByRole('button',{name:'采用此词并补齐读音',exact:true}).first().click();
  assert.equal(await page.evaluate(()=>getStudyCards().find(c=>c.id==='typo').lines.th),'โรคติดต่ออันตราย');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ByndStudyReading);await page.evaluate(async()=>{await byndStylesReady;unlockPhone();document.documentElement.classList.add('mobile-runtime');openApp('study');ByndStudy.openBook('collection');window.__voiceCalls=[];window.ByndAndroid={stopTts(){},speakText(text,code){window.__voiceCalls.push({text,code});return{status:'queued'};}};});
  assert.match(await page.locator('[data-book-card="typo"] .study-entry-reading').innerText(),/rôok dtìt dtɔ̀ɔ/);
  await page.evaluate(()=>{saveStudyCards([...getStudyCards(),...['เซลล์เชื้อเพลิง','ปรากฏการณ์โฟโตอิเล็กทริก','ยาต้านเชื้อมาเลเรีย'].map((th,i)=>({id:'expanded_'+i,bookId:'expanded',bookTitle:'读音覆盖检查',lines:{th,cn:['燃料电池','光电效应','抗疟疾药'][i]}}))]);ByndStudy.openBook('expanded');});
  assert.equal(await page.locator('.study-entry-reading').count(),3);assert.match(await page.locator('.study-entry-reading').first().innerText(),/seel /);
  assert.doesNotMatch(await page.locator('.study-book-paper').innerText(),/本词拼读待补充|词库暂未匹配/);
  await page.screenshot({path:path.join(output,'expanded-readings-375.png'),animations:'disabled'});
  const report={scope:'Curated content, locale routing and UI checks; no live model grammar evaluation and no native-speaker audio review.',languages:[],thai:{text:'rôok dtìt dtɔ̀ɔ',actualTones:[3,2,2],speechUsesOriginal:true}};
  for(const id of ['en','ko','it','fr','de','es']){
   await page.evaluate(id=>{ByndStudy.closeBook();ByndStudy.setLearningView('guide');ByndStudy.setFoundationLang(id);},id);
   await page.locator('.study-language-guide summary').click();
   const samples=await page.evaluate(id=>{const guide=ByndStudyLanguageGuides.get(id);return{label:guide.label,code:guide.code,samples:guide.pronunciation,grammar:guide.grammar,sources:guide.sources};},id);
   for(let index=0;index<samples.samples.length;index++){
    await page.getByRole('button',{name:`朗读${samples.label}对照 ${index+1}`,exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.__voiceCalls.at(-1)),{text:samples.samples[index].speech,code:samples.code});
   }
   assert.equal(await page.locator('.study-language-sources a').count(),samples.sources.length);
   for(const width of [320,375]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(()=>{const app=document.getElementById('app-study-window');return app.scrollWidth>app.clientWidth;}),false);
    await page.evaluate(()=>document.getElementById('study-content').scrollTop=0);
    if(['en','ko','it'].includes(id))await page.screenshot({path:path.join(output,`${id}-${width}.png`),animations:'disabled'});
   }
   report.languages.push({id,...samples,checked:'curated content visible; original-text/locale routing passed'});
  }
  await page.evaluate(()=>{ByndStudy.setFoundationLang('it');ByndStudy.setLearningView('cards');ByndStudy.setCardKind('sentence');});assert.match(await page.locator('.study-learn-front').innerText(),/Sto imparando l'italiano/);
  for(const safe of [47,59])for(const parent of [true,false]){
   await page.setViewportSize({width:320,height:844});
   const position=await page.evaluate(({safe,parent})=>{const phone=document.querySelector('.phone-container');phone.style.setProperty('--bynd-header-safe-top',parent?'0px':safe+'px');phone.style.setProperty('height',(844-(parent?safe:0))+'px','important');document.body.style.setProperty('padding-top',parent?safe+'px':'0px','important');const app=document.getElementById('app-study-window');return{buttonTop:app.querySelector('.study-topbar button').getBoundingClientRect().top,headerBottom:app.querySelector('.study-topbar').getBoundingClientRect().bottom,contentTop:app.querySelector('.study-content').getBoundingClientRect().top,overflow:app.scrollWidth>app.clientWidth};},{safe,parent});
   assert.ok(position.buttonTop>=safe);assert.ok(position.contentTop>=position.headerBottom);assert.equal(position.overflow,false);
   await page.screenshot({path:path.join(output,`safe-${safe}-${parent?'parent':'header'}.png`),animations:'disabled'});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(`Thai phonetics and ${report.languages.length} language guides passed; actual speech text/locale, mobile layouts, safe areas. Report: ${path.join(output,'report.json')}`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
