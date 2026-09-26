const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function setup(){const c=vm.createContext({window:{},DEFAULT_AVATAR:'avatar.png',getWechatCharAvatarSource:()=> 'avatar.png',wcEscapeHtml:v=>String(v??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),wcEscapeAttr:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),getWechatCharDisplayName:()=> '角色',shouldWechatAiPhoneShowGames:()=>true});for(const f of ['catalog.js','brand-screens.js','native-apps.js','system-apps.js','home.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps/char-phone',f),'utf8'),c);return c;}
test('phone registry has exactly 30 unique apps, all extra templates render and drill into content',()=>{const c=setup();const apps=c.getWechatAiPhoneAllApps();assert.equal(apps.length,30);assert.equal(new Set(apps.map(a=>a.key)).size,30);for(const app of apps.filter(a=>a.template)){const snap={appData:{[app.key]:{items:[{title:'测试标题',body:'<script>unsafe</script>',amount:'¥20'}]}}};const html=c.renderCharPhoneTemplate(app.key,snap,{});assert.ok(html.includes('测试标题'),app.key);assert.ok(!html.includes('<script>'));assert.ok(html.includes('openCharPhoneItem'));c.window._charPhoneDetail={key:app.key,index:0};assert.ok(c.renderCharPhoneTemplate(app.key,snap,{}).includes('closeCharPhoneItem'));c.window._charPhoneDetail=null;}});
test('model-selected apps support world-specific names while preserving chat and settings',()=>{const c=setup();const data=c.normalizeCharPhoneApps({installedApps:['memo','memo','bank','unknown'],deviceName:'传音玉简',appData:{bank:{name:'灵石库',items:[{title:'灵石进账',body:'宗门俸禄',image:'javascript:bad'}]}}});assert.deepEqual(Array.from(data.installedApps),['memo','bank']);assert.equal(data.appData.bank.items[0].image,'');const apps=c.getWechatAiPhoneApps({},data);assert.equal(apps.find(a=>a.key==='bank').label,'灵石库');assert.ok(apps.some(a=>a.key==='chat'));assert.ok(apps.some(a=>a.key==='settings'));assert.ok(!apps.some(a=>a.key==='stocks'));});
test('incomplete new-app generation preserves valid data and marks missing apps',()=>{const c=setup();const partial=c.normalizeCharPhoneApps({installedApps:['bank','mail'],appData:{mail:{items:[{title:'邮件',body:'正文'}]}}});assert.deepEqual(Array.from(partial.appSyncMissing),['bank']);assert.equal(partial.appData.mail.items.length,1);assert.throws(()=>c.normalizeCharPhoneApps({installedApps:['unknown']}),/有效/);assert.equal(c.normalizeCharPhoneApps({}).installedApps,undefined);assert.equal(c.getWechatAiPhoneApps({},{}).length,30);});
test('catalog is requested in the same persona-aware phone request and loaded by the real page',()=>{const root=path.join(__dirname,'..');const sync=fs.readFileSync(path.join(root,'apps/char-phone/sync.js'),'utf8');assert.match(sync,/\$\{charPhoneCatalogPrompt\(\)\}/);assert.match(sync,/\.\.\.normalizeCharPhoneApps\(/);assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/apps\/char-phone\/catalog.js/);const c=setup();assert.match(c.charPhoneCatalogPrompt(),/世界书/);assert.match(c.charPhoneCatalogPrompt(),/私人银行/);});

test('phone normalization reuses saved app data and accepts model app labels',()=>{const c=setup();const old={appData:{bank:{name:'私人银行',items:[{title:'已保存资产',body:'旧明细'}]}}};const data=c.normalizeCharPhoneApps({installedApps:['私人银行','Instagram'],appData:{Instagram:{items:[{title:'新动态'}]}}},old);assert.deepEqual(Array.from(data.installedApps),['bank','instagram']);assert.equal(data.appData.bank.items[0].title,'已保存资产');assert.equal(data.appSyncMissing.length,0);});

test('unselected legacy apps do not block completion and missing selected apps request repair',()=>{const c=setup();c.stripWechatPromptText=v=>String(v||'');c.formatWechatAiPhoneMoneyText=v=>String(v||'');const source=fs.readFileSync(path.join(__dirname,'../apps/char-phone/sync.js'),'utf8');vm.runInContext(source.slice(source.indexOf('function getWechatAiPhoneSnapshotGapSummary('),source.indexOf('function isWechatAiPhoneSparseSnapshot(')),c);const partial=c.normalizeCharPhoneApps({installedApps:['mail','bank'],appData:{mail:{items:[{title:'已生成邮件'}]}}});assert.match(c.getWechatAiPhoneSnapshotGapSummary(partial,{includeDiary:false}),/私人银行/);const complete=c.normalizeCharPhoneApps({installedApps:['mail'],appData:{mail:{items:[{title:'邮件'}]}}});assert.equal(c.getWechatAiPhoneSnapshotGapSummary(complete,{includeDiary:false}),'');});

test('new app layouts retain navigation and meaningful empty content without duplicating tabs',()=>{const c=setup();for(const app of c.getWechatAiPhoneAllApps().filter(a=>a.template)){const html=c.renderCharPhoneTemplate(app.key,{appData:{}},{});assert.equal((html.match(/<nav /g)||[]).length,1,app.key);assert.ok(html.includes('cp-scroll'),app.key);assert.ok(html.includes('cp-brand-empty'),app.key);assert.ok(!html.includes('cp-tabs'),app.key);}});

test('social metadata survives normalization and X separates following from private messages',()=>{
 const c=setup();const data=c.normalizeCharPhoneApps({installedApps:['x'],appData:{x:{items:[{title:'推荐帖',section:0,handle:'@writer',likes:128,verified:true},{title:'关注帖',section:1},{title:'私信内容',section:2}]}}});
 assert.equal(data.appData.x.items[0].likes,'128');assert.equal(data.appData.x.items[0].verified,'true');
 c.window._charPhoneSections={x:1};let html=c.renderCharPhoneX(data,{});assert.ok(html.includes('关注帖'));assert.ok(!html.includes('推荐帖'));assert.ok(!html.includes('私信内容'));
 c.window._charPhoneBrandViews={x:'messages'};html=c.renderCharPhoneX(data,{});assert.ok(html.includes('私信内容'));assert.ok(!html.includes('关注帖'));
});

test('empty failed-generation screens expose failure rather than a success message or fabricated balance',()=>{
 const c=setup();for(const app of c.getWechatAiPhoneAllApps().filter(a=>a.template)){const html=c.renderCharPhoneTemplate(app.key,{syncError:'HTTP 429',appData:{}},{});assert.match(html,/同步未完成/);assert.ok(!html.includes('同步成功'));}
 c.window._charPhoneBrandViews={alipay:'wealth'};assert.ok(c.renderCharPhoneAlipay({appData:{}},{}).includes('—'));
});

test('booking and market details retain structured values safely and scroll long content',()=>{
 const c=setup();c.window._charPhoneDetail={key:'hotels',index:0};const html=c.renderCharPhoneTemplate('hotels',{appData:{hotels:{items:[{title:'入住',checkIn:'10月1日',checkOut:'10月3日',body:'<img onerror="bad">'}]}}},{});
 assert.ok(html.includes('10月1日'));assert.ok(html.includes('10月3日'));assert.ok(html.includes('cp-scroll'));assert.ok(!html.includes('<img onerror'));
});

test('home swipe advances both directions, respects boundaries and ignores vertical scrolling',()=>{
 const c=setup();const source=fs.readFileSync(path.join(__dirname,'../apps/char-phone/screens.js'),'utf8');vm.runInContext(source.slice(source.indexOf('function bindCharPhoneHomeSwipe(')),c);
 const listeners={};let captured=false;const pager={clientWidth:300,scrollLeft:0,classList:{add(){},remove(){}},addEventListener:(t,f)=>listeners[t]=f,setPointerCapture(){captured=true;},hasPointerCapture:()=>captured,releasePointerCapture(){captured=false;},querySelectorAll:()=>[{},{}],scrollTo({left}){this.scrollLeft=left;}};c.bindCharPhoneHomeSwipe(pager);
 const event=(type,x,y=0)=>({type,clientX:x,clientY:y,pointerId:1,isPrimary:true,pointerType:'touch',preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;}});
 const swipe=(from,to)=>{listeners.pointerdown(event('pointerdown',from));listeners.pointermove(event('pointermove',to));listeners.pointerup(event('pointerup',to));};
 swipe(250,100);assert.equal(pager.scrollLeft,300);swipe(250,100);assert.equal(pager.scrollLeft,300);swipe(50,200);assert.equal(pager.scrollLeft,0);
 const click=event('click',0);listeners.click(click);assert.ok(click.prevented&&click.stopped);
 listeners.pointerdown(event('pointerdown',150,0));listeners.pointermove(event('pointermove',152,100));listeners.pointerup(event('pointerup',152,100));assert.equal(pager.scrollLeft,0);
 listeners.pointerdown(event('pointerdown',250));listeners.pointermove(event('pointermove',100));listeners.pointercancel(event('pointercancel',100));assert.equal(pager.scrollLeft,0);
});
