'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.qa-screenshots/char-phone-desktop');
fs.mkdirSync(output,{recursive:true});
const photo='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'assets/characters/builtin/wenjinbei-cover.jpg')).toString('base64');
const avatar='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'assets/characters/builtin/wenjinbei.jpg')).toString('base64');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const report={layouts:[],errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:375,height:844},isMobile:true,hasTouch:true});
  await page.addInitScript(({version,photo,avatar})=>{
   localStorage.setItem('bynd_lastSeenVersion',version);localStorage.setItem('bynd_builtin_library_seen_v1','1');
   localStorage.setItem('my_characters_data',JSON.stringify([{id:'phone-browser',name:'温今北',description:'年轻建筑师，寡言，喜欢黑白摄影和海边，与你亲近。',avatar,history:[{type:'image',isMe:true,imageUrl:photo,content:photo,timestamp:10,description:'用户发送的照片：一幅海岸画面'},{type:'text',isMe:false,content:'这张照片我喜欢。',timestamp:11}],chatConfig:{aiPhoneSnapshot:{generatedBy:'api',installedApps:['chat','memo','schedule','album','music','mail','browser','settings'],updatedAt:Date.now(),memos:[{title:'周末去看海',content:'带相机，等你一起。'}],appData:{music:{items:[{title:'晚风',artist:'留在播放列表里'}]},album:{items:[]}},homeDesign:{theme:'light',layout:'collage',quote:'把日子过成喜欢的样子',photoIds:['chat-photo-10-0'],savedPhotoIds:['chat-photo-10-0'],lockPhotoId:'chat-photo-10-0'}}}}]));
  },{version:require('./bump-version.cjs').currentVersion(),photo,avatar});
  await page.route('https://**/*',route=>route.abort());page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__byndCoreReady && typeof openWechatAiPhone==='function');
  await page.evaluate(async()=>{
   await window.__byndCoreReady;await window.byndStylesReady;unlockPhone();ByndBuiltinLibrary?.close();document.getElementById('bynd-version-letter')?.remove();
   document.documentElement.classList.add('mobile-runtime');openApp('wechat');
   window.myCharacters[0].chatConfig.aiPhoneSnapshot.schemaVersion=WECHAT_AI_PHONE_SCHEMA_VERSION;
   window._phoneRequests=[];window._phoneResponseFailure=false;
   shouldAutoSyncWechatAiPhone=()=>false;scheduleWechatAiPhoneDiaryFollowUp=()=>false;
   isWechatBackgroundApiPaused=()=>false;isWechatAiRateLimitPaused=()=>false;
   callChatApi=async(messages,options)=>{
    window._phoneRequests.push({messages,options});
    if(window._phoneResponseFailure)return {ok:false,error:'测试 HTTP 503'};
    if(messages[0].content.includes('本人手机的数据生成器'))return {ok:true,content:JSON.stringify({
     installedApps:['chat','memo','schedule','album','music','mail','browser','settings'],
     memos:[{title:'周末去看海',content:'带上相机，等你一起去海边。',meta:'今天'},{title:'给你留的唱片',content:'放在书柜第二层，等你过来一起听。',meta:'今天'}],
     scheduleRecords:[{time:'16:00',title:'去海边散步',meta:'今天'}],browser:[{title:'海边日落时间',detail:'查好日落时间，带你去看晚霞。',meta:'今天'}],
     appData:{album:{items:[{title:'海边旧照',body:'以前拍的海岸'}]},music:{items:[{title:'晚风',artist:'喜欢的一张唱片'}]},mail:{items:[{title:'收到一封信',body:'朋友寄来的近况。'}]}},
     homeDesign:{theme:'dark',layout:'minimal',quote:'留一张给你',photoIds:['chat-photo-10-0'],savedPhotoIds:['chat-photo-10-0'],lockPhotoId:'chat-photo-10-0'}
    })};
    if(messages[0].content.includes('自己的小手机，只返回 JSON'))return {ok:true,content:JSON.stringify({homeDesign:{theme:'dark',layout:'editorial',quote:'你镜头里的世界',photoIds:['chat-photo-10-0'],savedPhotoIds:['chat-photo-10-0'],wallpaperPrompt:'黑白海岸',lockWallpaperPrompt:'月亮',iconPrompts:{memo:'简洁白色纸页'}}})};
    return {ok:true,content:'在看我的手机？|||那张照片，我留着了。'};
   };
   openWechatAiPhone('phone-browser');
  });
  await page.waitForSelector('.cp-message-island.is-expanded');
  assert.equal(await page.evaluate(()=>window._phoneRequests.length),1);
  assert.ok(await page.locator('.cp-message-island').textContent().then(t=>t.includes('在看我的手机')));
  assert.equal(await page.evaluate(()=>window.myCharacters[0].history.filter(m=>m.content==='在看我的手机？').length),1);
  await page.locator('.cp-island-actions button[aria-label="收起消息"]').click();
  await page.locator('.wc-ai-phone-grid button[aria-label="备忘录"]').click();
  await page.waitForFunction(()=>window._phoneRequests.length===2);
  await page.waitForSelector('.cp-message-island.is-expanded');
  assert.ok(await page.evaluate(()=>window._phoneRequests[1].messages[1].content.includes('周末去看海')));
  assert.ok(await page.locator('.wc-ai-phone-app-body').textContent().then(t=>t.includes('周末去看海')));
  await page.evaluate(()=>switchWechatAiPhoneTab('home'));
  await page.evaluate(async()=>{await generateCharPhoneAppearance();});
  assert.equal(await page.evaluate(()=>window.myCharacters[0].chatConfig.aiPhoneSavedChatPhotos.length),1);
  assert.equal(await page.evaluate(()=>getCharPhoneAlbumItems(window.myCharacters[0])[0].image.startsWith('data:image/jpeg')),true);
  await page.evaluate(async()=>{const char=window.myCharacters[0];await requestWechatAiPhoneSnapshot(char,{force:true});});
  assert.equal(await page.evaluate(()=>window.myCharacters[0].chatConfig.aiPhoneSnapshot.homeDesign.layout),'minimal');
  assert.equal(await page.evaluate(()=>window.myCharacters[0].chatConfig.aiPhoneSavedChatPhotos.length),1);
  await page.evaluate(()=>{clearTimeout(window._charPhoneIslandTimer);window._charPhoneIsland=null;refreshCharPhoneMessageIsland();});
  for(const width of [320,375,430])for(const safe of [47,59])for(const owner of ['parent','header'])for(const layout of ['collage','minimal','editorial']){
   await page.setViewportSize({width,height:844});
   await page.evaluate(({safe,owner,layout})=>{
    document.body.style.paddingTop=owner==='parent'?safe+'px':'0';
    const phone=document.querySelector('.phone-container');phone.style.setProperty('--bynd-header-safe-top',owner==='header'?safe+'px':'0px');phone.style.height=owner==='parent'?`calc(100dvh - ${safe}px)`:'100dvh';
    const char=window.myCharacters[0];char.chatConfig.aiPhoneSnapshot.homeDesign.layout=layout;char.chatConfig.aiPhoneSnapshot.homeDesign.theme=layout==='minimal'?'dark':layout==='editorial'?'warm':'light';renderWechatAiPhone(char);
   },{safe,owner,layout});
   const bounds=await page.evaluate(()=>{
    const phone=document.querySelector('.cp-fullscreen').getBoundingClientRect(),host=document.querySelector('.phone-container').getBoundingClientRect();
    const status=document.querySelector('.wc-ai-phone-status').getBoundingClientRect(),close=document.querySelector('.wc-ai-phone-home-top button').getBoundingClientRect();
    const pager=document.querySelector('.cp-home-page'),dock=document.querySelector('.wc-ai-phone-dock').getBoundingClientRect();
    const apps=[...pager.querySelectorAll('.wc-ai-phone-app-icon')];
    return {phone:{width:phone.width,height:phone.height},host:{width:host.width,height:host.height},statusTop:status.top,closeTop:close.top,dockBottom:dock.bottom,pageWidth:pager.clientWidth,pageScroll:pager.scrollWidth,appBottom:Math.max(...apps.map(app=>app.getBoundingClientRect().bottom)),pageBottom:pager.getBoundingClientRect().bottom};
   });
   assert.ok(Math.abs(bounds.phone.width-bounds.host.width)<1 && Math.abs(bounds.phone.height-bounds.host.height)<1,JSON.stringify(bounds));
   assert.ok(bounds.statusTop>=safe+10 && bounds.statusTop<=safe+15,JSON.stringify({safe,owner,bounds}));assert.ok(bounds.closeTop>=safe+50 && bounds.closeTop<safe+70);
   assert.ok(bounds.pageScroll<=bounds.pageWidth+1 && bounds.dockBottom<=844,JSON.stringify(bounds));report.layouts.push({width,safe,owner,layout,bounds});
   assert.ok(bounds.appBottom<=bounds.pageBottom+1,'first-page apps are visible: '+JSON.stringify({width,safe,owner,layout,bounds}));
   assert.equal(await page.locator('.wc-ai-phone-dock .wc-ai-phone-app-icon').count(),4,'dock has four functional entries');
   assert.equal(await page.locator('.cp-desktop-primary .wc-ai-phone-app-icon').count(),4,'apps are interleaved alongside photos');
   assert.equal(await page.locator('#wc-ai-phone-overlay [onclick*="Tab(\'library\')"]').count(),0,'all-app library shortcut stays hidden');
   assert.ok(await page.locator('.cp-desktop-photo').first().evaluate(node=>parseFloat(getComputedStyle(node).height)<=150),'photos stay at widget scale');
   if(width===375 && safe===59 && owner==='header')await page.screenshot({path:path.join(output,`desktop-${layout}-375.png`),animations:'disabled'});
  }
  for (const layout of ['collage','minimal','editorial']) {
   const calendar = await page.evaluate(layout=>{
    const OriginalDate=window.Date;
    window.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[2026,7,1,13,30]));}};
    try {
     const char=window.myCharacters[0];char.chatConfig.aiPhoneSnapshot.homeDesign.layout=layout;renderWechatAiPhone(char);
     const widget=document.querySelector('.cp-desktop-calendar'),days=[...widget.querySelectorAll('.cp-desktop-calendar-month>div>b')];
     return {days:days.length,bottom:Math.max(...days.map(day=>day.getBoundingClientRect().bottom)),widgetBottom:widget.getBoundingClientRect().bottom};
    }finally{window.Date=OriginalDate;renderWechatAiPhone(window.myCharacters[0]);}
   },layout);
   assert.equal(calendar.days,37);assert.ok(calendar.bottom<calendar.widgetBottom-3,'six-week calendar stays visible: '+JSON.stringify({layout,calendar}));
  }
  await page.evaluate(()=>{const snapshot=window.myCharacters[0].chatConfig.aiPhoneSnapshot;window._phoneFullAppList=snapshot.installedApps;snapshot.installedApps=['chat','memo','album','settings'];renderWechatAiPhone(window.myCharacters[0]);});
  assert.equal(await page.locator('.wc-ai-phone-dock .wc-ai-phone-app-icon').count(),3,'sparse phones show only their own apps');
  assert.equal(await page.locator('.cp-desktop-primary .wc-ai-phone-app-icon').count(),3,'no extra apps are added to fill empty slots');
  assert.equal(await page.locator('.cp-desktop-record').count(),1,'sparse phones use a photo widget rather than empty app slots');
  await page.screenshot({path:path.join(output,'sparse-430.png'),animations:'disabled'});
  await page.evaluate(()=>{window.myCharacters[0].chatConfig.aiPhoneSnapshot.installedApps=window._phoneFullAppList;renderWechatAiPhone(window.myCharacters[0]);});
  await page.evaluate(()=>switchWechatAiPhoneTab('lock'));await page.screenshot({path:path.join(output,'lock-430.png'),animations:'disabled'});
  await page.locator('.cp-lock-unlock').click();assert.equal(await page.evaluate(()=>window._wechatAiPhoneTab),'home');
  const beforeClose=await page.evaluate(()=>window._phoneRequests.length);await page.evaluate(()=>closeWechatAiPhone());
  await page.waitForFunction(()=>window._charPhoneClockTimer===null && !document.getElementById('wc-ai-phone-overlay'));
  await page.waitForFunction(()=>!window._wechatAiPhoneContactReplyGenerating.size);
  const count=await page.evaluate(()=>window._phoneRequests.length);assert.ok(count<=beforeClose+1,'close batches only unseen visits');
  await page.evaluate(()=>{window._phoneResponseFailure=true;openWechatAiPhone('phone-browser');});await page.waitForTimeout(1400);
  assert.equal(await page.locator('.cp-message-island.is-expanded').count(),0);
  assert.ok(await page.evaluate(()=>window.myCharacters[0].chatConfig.aiPhoneContactReplies.pending.length>0));
  await page.evaluate(()=>{window._phoneResponseFailure=false;retryCharPhoneLiveMessages();});await page.waitForSelector('.cp-message-island.is-expanded');
  await page.waitForFunction(()=>!document.getElementById('wc-toast')?.classList.contains('show'));
  await page.screenshot({path:path.join(output,'island-430.png'),animations:'disabled'});
  await page.evaluate(()=>{
   window.myCharacters.push({id:'pending-phone',name:'尚未生成的角色',avatar:window.myCharacters[0].avatar,history:[],chatConfig:{}});
   openWechatAiPhone('pending-phone');
  });
  assert.equal(await page.locator('#wc-ai-phone-overlay .wc-ai-phone-app-icon').count(),0,'before generation no app icons are visible');
  assert.equal(await page.locator('#wc-ai-phone-overlay .wc-ai-phone-dock').count(),0,'empty dock stays hidden');
  await page.evaluate(()=>switchWechatAiPhoneTab('library'));
  assert.equal(await page.evaluate(()=>window._wechatAiPhoneTab),'home','old library entry returns to the desktop');
  assert.equal(await page.locator('#wc-ai-phone-overlay .cp-library').count(),0);
  await page.screenshot({path:path.join(output,'before-generation-430.png'),animations:'disabled'});
  await page.evaluate(()=>{
   const char=window.myCharacters.find(c=>c.id==='pending-phone');
   char.chatConfig.aiPhoneSnapshot={schemaVersion:WECHAT_AI_PHONE_SCHEMA_VERSION,generatedBy:'error',syncError:'测试 HTTP 503',appSelectionMissing:true};renderWechatAiPhone(char);
  });
  assert.equal(await page.locator('#wc-ai-phone-overlay .wc-ai-phone-app-icon').count(),0,'failed first generation does not reveal default apps');
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({layouts:report.layouts.length,errors:report.errors,screenshots:output}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
