'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.BYND_PLAYWRIGHT||'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.qa-screenshots/memory-dashboard');fs.mkdirSync(output,{recursive:true});
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{const file=fs.statSync(f).isDirectory()?path.join(f,'index.html'):f;res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).on('error',()=>res.end()).pipe(res);}catch{res.writeHead(404).end();}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:375,height:844},isMobile:true,hasTouch:true});
 const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>{localStorage.setItem('bynd_builtin_library_seen_v1','1');localStorage.setItem('bynd_lastSeenVersion','1.1.796');});
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__byndCoreReady&&typeof openChat==='function');
  await page.evaluate(async()=>{
   await window.__byndCoreReady;await window.byndStylesReady;unlockPhone();ByndBuiltinLibrary?.close();document.documentElement.classList.add('mobile-runtime');
   const avatar='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#d5ebe5"/><circle cx="40" cy="31" r="15" fill="#718c7b"/><path d="M12 80v-8a28 28 0 0 1 56 0v8" fill="#718c7b"/></svg>');
   window.myCharacters=[{id:'memory-ui-proof',name:'江闻远',avatar,chatConfig:{},history:[]}];openApp('wechat');openChat('memory-ui-proof');
   window.seedMemoryUiProof=count=>{const topics=['午餐约定','一起看电影','下雨的那天','第一次见面','旅行计划','日常碎片','生日礼物','阅读偏好'];saveWechatMemoryStore({chars:{'memory-ui-proof':{segments:topics.slice(0,count).map((topic,i)=>({id:`proof-${i}`,title:topic,topic,content:i===0?'周五午餐一起去吃粤菜。':i===1?'周末一起看那部收藏已久的电影。':`${topic}中值得记住的小事。`,enabled:true}))}}});window._wechatMemoryTier='galaxy';openWechatMemoryManager();};seedMemoryUiProof(2);
  });
  await page.addStyleTag({content:'.wc-compose-card { animation:none!important; } .tapfx-layer { display:none!important; }'});
  for(const width of [320,375,430])for(const safe of [47,59])for(const parentReserved of [false,true]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(({safe,parentReserved})=>{document.body.style.paddingTop=parentReserved?`${safe}px`:'0px';const phone=document.querySelector('.phone-container');phone.style.height=`${844-(parentReserved?safe:0)}px`;phone.style.setProperty('--bynd-header-safe-top',parentReserved?'0px':`${safe}px`);},{safe,parentReserved});
   const boxes=await page.locator('#wc-memory-manager').evaluate(host=>{const card=host.querySelector('.wc-memory-card'),close=host.querySelector('.wc-memory-close').getBoundingClientRect(),footer=host.querySelector('.wc-compose-footer').getBoundingClientRect(),sky=host.querySelector('.wc-memory-sky').getBoundingClientRect();return{bg:getComputedStyle(card).backgroundColor,overflow:card.scrollWidth-card.clientWidth,closeTop:close.top,footerBottom:footer.bottom,clipped:[...host.querySelectorAll('.wc-memory-star')].some(el=>{const b=el.getBoundingClientRect();return b.left<sky.left||b.right>sky.right||b.top<sky.top||b.bottom>sky.bottom;})};});
   assert.equal(boxes.bg,'rgb(253, 254, 253)');assert(boxes.overflow<=1);assert(boxes.closeTop>=safe);assert(boxes.footerBottom<=844);assert.equal(boxes.clipped,false);
   for(const id of ['galaxy','segment','long','compressed'])assert(await page.locator(`#wc-memory-tab-${id}`).isVisible());
   if(safe===47&&parentReserved)await page.screenshot({path:path.join(output,`memory-${width}.png`)});
  }
  checks.push('浅色面板、底部分类和星点布局通过 320/375/430px 及 47/59px 两种安全区预留方式');
  await page.setViewportSize({width:375,height:844});
  const circles=await page.locator('#wc-memory-manager').evaluate(host=>{const left=host.querySelector('.wc-memory-header-mark').getBoundingClientRect(),right=getComputedStyle(host.querySelector('.wc-memory-close'),'::before');return {leftWidth:left.width,leftHeight:left.height,rightWidth:parseFloat(right.width),rightHeight:parseFloat(right.height),scrollbar:getComputedStyle(host.querySelector('.wc-memory-body')).scrollbarWidth,webkit:getComputedStyle(host.querySelector('.wc-memory-body'),'::-webkit-scrollbar').display};});
  assert.equal(circles.leftWidth,circles.rightWidth);assert.equal(circles.leftHeight,circles.rightHeight);assert.equal(circles.scrollbar,'none');assert.equal(circles.webkit,'none');
  const body=page.locator('.wc-memory-body');await body.hover();await page.mouse.wheel(0,450);await page.waitForFunction(()=>document.querySelector('.wc-memory-body').scrollTop>0);await body.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.querySelector('.wc-memory-body').scrollTop>0);await body.evaluate(el=>el.scrollTop=0);checks.push('左右圆圈同为 32px；隐藏滚动条后滚轮和键盘仍能滚动');
  await body.evaluate(el=>el.blur());
  const themeIds=await page.evaluate(()=>WECHAT_UI_THEMES.map(theme=>theme.id));
  for(const id of themeIds){
   await page.evaluate(id=>selectWechatUiTheme(id),id);
   const styled=await page.locator('#wc-memory-manager').evaluate(host=>{const card=host.querySelector('.wc-memory-card'),root=document.getElementById('app-wechat-window');return {theme:host.dataset.uiTheme,accent:host.style.getPropertyValue('--wc-theme-accent'),rootAccent:getComputedStyle(root).getPropertyValue('--wc-theme-accent').trim(),bg:getComputedStyle(card).backgroundColor,radius:getComputedStyle(card).borderRadius,overflow:card.scrollWidth-card.clientWidth};});
   assert.equal(styled.theme,id);assert.equal(styled.accent,styled.rootAccent);assert(styled.overflow<=1);
   if(id==='pixel'){assert.equal(styled.bg,'rgb(195, 195, 197)');assert.equal(styled.radius,'3px');}
   if(id==='couple')assert.equal(styled.bg,'rgba(255, 255, 255, 0.52)');
   if(['bynd','pixel','couple','qq','claude'].includes(id)){await page.evaluate(()=>document.querySelectorAll('.wc-toast').forEach(el=>el.remove()));await page.screenshot({path:path.join(output,`theme-${id}.png`)});}
  }
  await page.evaluate(()=>selectWechatUiTheme('pixel'));await page.locator('#wc-memory-add-btn').click();await page.locator('#wc-memory-content').fill('主题切换时保留草稿');await page.evaluate(()=>selectWechatUiTheme('couple'));assert.equal(await page.locator('#wc-memory-content').inputValue(),'主题切换时保留草稿');await page.evaluate(()=>selectWechatUiTheme('bynd'));await page.locator('#wc-memory-tab-galaxy').click();checks.push(`${themeIds.length} 个微信主题实时同步，切换主题保留编辑草稿`);
  await page.setViewportSize({width:375,height:844});await page.evaluate(()=>seedMemoryUiProof(8));
  assert.equal(await page.locator('.wc-memory-star').count(),8);
  const overlap=await page.locator('.wc-memory-sky').evaluate(sky=>{const rects=[...sky.querySelectorAll('.wc-memory-star,.wc-memory-galaxy-center')].map(el=>el.getBoundingClientRect());return rects.some((a,i)=>rects.slice(i+1).some(b=>Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1));});assert.equal(overlap,false);
  await page.screenshot({path:path.join(output,'memory-eight.png')});checks.push('八个记忆节点与中央头像互不覆盖');
  await page.locator('.wc-memory-star').first().click();assert.equal(await page.locator('#wc-memory-title').inputValue(),'午餐约定');assert(await page.locator('#wc-memory-save-btn').isVisible());assert.equal(await page.locator('#wc-memory-tab-segment').getAttribute('aria-pressed'),'true');
  await page.locator('#wc-memory-content').fill('修改后的午餐约定');await page.locator('#wc-memory-save-btn').click();assert.equal(await page.evaluate(()=>getWechatMemoryStore().chars['memory-ui-proof'].segments[0].content),'修改后的午餐约定');checks.push('点击节点进入对应分类，编辑保存仍有效');
  await page.locator('#wc-memory-tab-galaxy').click();await page.locator('#wc-memory-add-btn').click();await page.locator('#wc-memory-title').fill('新约定');await page.locator('#wc-memory-content').fill('保存失败时保留的草稿');
  const failed=await page.evaluate(()=>{const before=localStorage.getItem(WECHAT_MEMORY_STORAGE_KEY),original=Storage.prototype.setItem;try{Storage.prototype.setItem=function(k,v){if(k===WECHAT_MEMORY_STORAGE_KEY)throw Error('quota');return original.call(this,k,v);};return{ok:saveWechatMemoryFromEditor(),same:before===localStorage.getItem(WECHAT_MEMORY_STORAGE_KEY)};}finally{Storage.prototype.setItem=original;}});
  assert.deepEqual(failed,{ok:false,same:true});assert.equal(await page.locator('#wc-memory-content').inputValue(),'保存失败时保留的草稿');assert.match(await page.locator('#wc-memory-editor-error').innerText(),/保存失败/);checks.push('保存失败显示错误、保留草稿且不改已有数据');
  await page.locator('#wc-memory-save-btn').click();assert.equal(await page.locator('#wc-memory-content').inputValue(),'');assert.equal(await page.locator('#wc-memory-editor-error').isVisible(),false);
  await page.evaluate(()=>{window._memoryProofExtraction=requestWechatMemoryExtraction;requestWechatMemoryExtraction=async()=>{throw Error('offline');};});await page.locator('#wc-memory-extract-btn').click();assert.equal(await page.locator('#wc-memory-extract-btn').isEnabled(),true);assert.match(await page.locator('.wc-toast').last().innerText(),/记忆整理失败/);await page.evaluate(()=>requestWechatMemoryExtraction=window._memoryProofExtraction);checks.push('整理失败显示提示并恢复按钮');
  await page.locator('#wc-memory-tab-long').click();assert.equal(await page.locator('#wc-memory-tab-long').getAttribute('aria-pressed'),'true');await page.locator('#wc-memory-tab-compressed').click();assert.equal(await page.locator('#wc-memory-tab-compressed').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>{saveWechatMemoryStore({chars:{'memory-ui-proof':{graph:{facts:[{id:'fact-proof',subject:'User',predicate:'喜欢',object:'粤菜',topic:'饮食偏好',enabled:true}]}}}});window._wechatMemoryTier='galaxy';renderWechatMemoryManager();});
  assert.equal(await page.locator('.wc-memory-star').count(),1);assert.equal(await page.locator('.wc-memory-galaxy-center small').innerText(),'1 条事实');await page.locator('.wc-memory-star').click();assert.equal(await page.evaluate(()=>document.activeElement.dataset.factId),'fact-proof');checks.push('仅有原子事实时显示正确数量，点击星点定位事实卡');
  await page.evaluate(()=>seedMemoryUiProof(0));assert.match(await page.locator('.wc-memory-sky-empty').innerText(),/第一条回忆/);assert(await page.locator('#wc-memory-add-btn').isVisible());await page.screenshot({path:path.join(output,'memory-empty.png')});checks.push('长期/压缩分类和空记忆入口有效');
  await page.locator('.wc-memory-close').click();assert(await page.locator('#wc-memory-manager').evaluate(el=>el.classList.contains('hidden')));
  await page.evaluate(()=>{document.getElementById('wc-memory-manager').remove();selectWechatUiTheme('pixel');openWechatMemoryManager();});assert.equal(await page.locator('#wc-memory-manager').getAttribute('data-ui-theme'),'pixel');
  const themeFailure=await page.evaluate(()=>{const original=Storage.prototype.setItem;try{Storage.prototype.setItem=function(k,v){if(k===WECHAT_UI_THEME_STORAGE_KEY)throw Error('quota');return original.call(this,k,v);};return {ok:selectWechatUiTheme('couple'),modal:document.getElementById('wc-memory-manager').dataset.uiTheme,root:document.getElementById('app-wechat-window').dataset.uiTheme,saved:getWechatUiThemeId()};}finally{Storage.prototype.setItem=original;}});assert.deepEqual(themeFailure,{ok:false,modal:'pixel',root:'pixel',saved:'pixel'});checks.push('重新打开拾忆继承当前主题；主题保存失败时两边均保留原主题');
  await page.locator('.wc-memory-close').click();assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
