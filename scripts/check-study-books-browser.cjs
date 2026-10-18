'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.BYND_PLAYWRIGHT||'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/study-books');
fs.mkdirSync(output,{recursive:true});
const sources=['新冠疫情中泰500词.pdf','基础泰语 · 第一册.pdf','泰语日常会话.doc','旅行常用语.docx','五十音与常用单词.pdf'];
const cards=sources.flatMap((sourceFile,book)=>Array.from({length:book===0?392:17},(_,i)=>({
    id:`shelf_${book}_${i}`,source:sourceFile.endsWith('.pdf')?'pdf':'word',sourceFile,sourcePage:Math.floor(i/20)+1,createdAt:1700000000000+book*1000+i,
    lines:book===4?{ja:['こんにちは','ありがとう','おはよう'][i%3],cn:['你好','谢谢','早上好'][i%3]}:{th:['โรคติดต่อ','ไข้หวัดใหญ่','ขอบคุณ','สวัสดี'][i%4],cn:['传染病','流感','谢谢','你好'][i%4]},note:i===0?'扫描识别，请核对文字':''
})));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:375,height:844}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const boot=async()=>{
  await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ByndStudy);
  await page.evaluate(async()=>{await byndStylesReady;unlockPhone();document.documentElement.classList.add('mobile-runtime');openApp('study');ByndStudy.setTab('words');ByndStudy.setLearningView('book');});
 };
 try{
  await boot();
  await page.evaluate(cards=>{localStorage.setItem('bynd_study_cards_v1',JSON.stringify(cards));localStorage.setItem('bynd_study_languages_v1',JSON.stringify([{id:'cn',label:'中文'},{id:'th',label:'ไทย'},{id:'ja',label:'日本語'}]));ByndStudy.render();},cards);
  const original=await page.evaluate(()=>localStorage.getItem('bynd_study_cards_v1'));
  assert.equal(await page.locator('[data-study-book]').count(),5);
  assert.equal(await page.locator('[data-book-card]').count(),0,'library never mounts hundreds of entry cards');
  await page.screenshot({path:path.join(output,'shelf-375.png'),animations:'disabled'});
  for(const width of [320,375,430,834]) {
   await page.setViewportSize({width,height:width===834?1112:844});
   assert.equal(await page.evaluate(()=>{const app=document.getElementById('app-study-window');return app.scrollWidth>app.clientWidth;}),false);
   const columns=await page.locator('.study-books-grid').evaluate(grid=>getComputedStyle(grid).gridTemplateColumns.split(' ').length);
   assert.equal(columns,width===834?4:2,`${width}px shelf columns`);
   if(width===320||width===834)await page.screenshot({path:path.join(output,`shelf-${width}.png`),animations:'disabled'});
  }
  await page.setViewportSize({width:375,height:844});
  const bookId=await page.evaluate(()=>ByndStudy.fileBookId('新冠疫情中泰500词.pdf'));
  await page.locator(`[data-study-book="${bookId}"]`).click();
  assert.equal(await page.locator('[data-book-card]').count(),8);
  assert.match(await page.locator('.study-page-turner').innerText(),/第 1 \/ 49 页/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('bynd_study_cards_v1')),original,'opening legacy books leaves data untouched');
  await page.screenshot({path:path.join(output,'inside-375.png'),animations:'disabled'});
  await page.getByRole('button',{name:'下一页',exact:true}).click();
  assert.match(await page.locator('.study-page-turner').innerText(),/第 2 \/ 49 页/);
  await page.evaluate(()=>ByndStudy.closeBook());
  await page.getByRole('button',{name:/新建词本/}).click();
  await page.locator('#study-book-title-input').fill('我的随身词本');
  await page.getByRole('button',{name:'鼠尾草封面',exact:true}).click();
  await page.getByRole('button',{name:'创建词本',exact:true}).click();
  assert.match(await page.locator('.study-book-heading h2').innerText(),/我的随身词本/);
  const customId=await page.evaluate(()=>ByndStudy.getStudyBooks().find(book=>book.title==='我的随身词本').id);
  await boot();
  assert.equal(await page.locator('[data-study-book]').count(),6,'new empty book persists after reload');
  await page.locator(`[data-study-book="${customId}"]`).click();
  await page.getByRole('button',{name:'设置词本',exact:true}).click();
  await page.locator('#study-book-title-input').fill('模拟失败的新名字');
  await page.evaluate(()=>{
   const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){if(key==='bynd_study_books_v1')throw new Error('模拟空间不足');return original.call(this,key,value);};
   try{ByndStudy.saveNotebook();}finally{Storage.prototype.setItem=original;}
  });
  assert.match(await page.locator('.study-status').innerText(),/词本没有保存.*模拟空间不足/);
  assert.equal(await page.locator('.study-book-heading h2').innerText(),'我的随身词本');
  await page.evaluate(()=>{ByndStudy.cancelNotebookEdit();ByndStudy.closeBook();});
  for(const safe of [47,59])for(const parent of [false,true]){
   await page.setViewportSize({width:320,height:844});
   const bounds=await page.evaluate(({safe,parent})=>{
    const phone=document.querySelector('.phone-container');phone.style.setProperty('--bynd-header-safe-top',parent?'0px':safe+'px');phone.style.setProperty('height',(844-(parent?safe:0))+'px','important');document.body.style.setProperty('padding-top',parent?safe+'px':'0px','important');
    const app=document.getElementById('app-study-window'),head=app.querySelector('.study-topbar').getBoundingClientRect(),button=app.querySelector('.study-topbar button').getBoundingClientRect(),content=app.querySelector('.study-content').getBoundingClientRect();return{top:button.top,bottom:head.bottom,content:content.top,overflow:app.scrollWidth>app.clientWidth};
   },{safe,parent});
   assert.ok(bounds.top>=safe);assert.ok(bounds.content>=bounds.bottom);assert.equal(bounds.overflow,false);
   await page.screenshot({path:path.join(output,`safe-${safe}-${parent?'parent':'header'}.png`),animations:'disabled'});
  }
  assert.deepEqual(errors,[]);
  console.log('Notebook shelf, legacy grouping, pagination, persistence, save failures and phone/tablet safe areas passed. Screenshots: '+output);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
