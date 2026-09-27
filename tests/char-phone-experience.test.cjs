const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {clone,deferred}=require('./helpers/harness.cjs');
function setup() {
 const char={id:'experience',name:'陈安',description:'建筑师，喜欢海边',chatConfig:{aiPhoneSnapshot:{appData:{album:{items:[{title:'海边',body:'灰色海浪和礁石'}]}}}}};
 const state={saves:0,requests:[],save:()=>true,image:async()=>({ok:true,url:'data:image/png;base64,YWJj'}),renders:0};
 const c=vm.createContext({window:{myCharacters:[char],_wechatAiPhoneOpenCharId:char.id},Date,Math,Map,Promise,console,queueMicrotask,
 wcEscapeHtml:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),wcEscapeAttr:v=>String(v??'').replaceAll('"','&quot;'),
 getWechatCharDisplayName:()=>char.name,getWechatAiPhoneHomeAvatar:()=>'',getWechatCharAvatarSource:()=>'',DEFAULT_AVATAR:'',
 renderWechatAiPhone:()=>state.renders++,getWechatCharacterPersonaText:()=>char.description,buildWechatWorldBookPrompt:()=> '现代都市',
 saveCharactersToStorage:async()=>{state.saves++;return state.save();},callWechatImageGenerationApi:async(p,o)=>{state.requests.push({prompt:p,options:o});return state.image();},
 charPhoneBrandEmpty:()=>'<p>空内容</p>',renderWechatAiPhoneChatRows:()=>'',getWechatAiPhoneContactReplyStore:ch=>ch.chatConfig.aiPhoneContactReplies ||= {pending:[],events:[]}
 });
 for(const f of ['viewing','photos','mail','catalog','home','native-apps','system-apps'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps/char-phone',f+'.js'),'utf8'),c);
 return {char,state,c};
}
test('WeChat discovery renders independent Moments and Channels without jumping to other apps',()=>{
 const {c,char}=setup();c.window._charPhoneNativeViews={chat:'discover'};
 let html=c.renderCharPhoneSystemApp('chat',{},char,false);
 assert.match(html,/setCharPhoneNativeView\('chat','moments'\)/);assert.match(html,/setCharPhoneNativeView\('chat','channels'\)/);
 assert.doesNotMatch(html,/switchWechatAiPhoneTab\('(?:weibo|douyin)'\)/);
 const snap=c.normalizeCharPhoneApps({appData:{chat:{moments:[{title:'海边散步',body:'看夕阳',author:'陈安'}],channels:[{title:'建筑影像',body:'石材建筑'}]},weibo:{items:[{title:'微博独立内容'}]},douyin:{items:[{title:'抖音独立内容'}]}}});
 for(const view of ['moments','channels']){c.window._charPhoneNativeViews.chat=view;html=c.renderCharPhoneSystemApp('chat',snap,char,false);assert.match(html,new RegExp(view==='moments'?'海边散步':'建筑影像'));assert.doesNotMatch(html,/微博独立内容|抖音独立内容/);}
 const next=c.normalizeCharPhoneApps({installedApps:['chat'],appData:{}},snap);assert.equal(next.appData.chat.moments[0].title,'海边散步');
});
test('view sessions record only the current character, deduplicate rerenders and preserve context after closing',()=>{
 const {c,char}=setup();c.beginCharPhoneViewing(char);c.recordCharPhoneViewing(char,'mail','邮箱','读了海边来信');c.recordCharPhoneViewing(char,'mail','邮箱','读了海边来信');c.recordCharPhoneViewing({id:'other'},'bank','银行','另一角色');
 const event=c.finishCharPhoneViewing(char);assert.equal(event.visits.length,2);assert.equal(event.type,'view');assert.equal(char.chatConfig.aiPhoneContactReplies.pending.length,1);assert.equal(c.finishCharPhoneViewing(char),null);
 assert.match(c.buildCharPhoneViewingContext(char),/读了海边来信/);assert.doesNotMatch(c.buildCharPhoneViewingContext({chatConfig:{}}),/来信/);
 c.beginCharPhoneViewing(char);assert.equal(c.finishCharPhoneViewing(char).visits.length,1);
});
test('closing viewing persists even when reactions are paused and never requests a reaction after failed saving',async()=>{
 const {c,char,state}=setup();let reactions=0;c.flushWechatAiPhoneContactReplyReactions=()=>{reactions++;return false;};
 c.beginCharPhoneViewing(char);c.finishCharPhoneViewing(char);
 assert.equal(await c.persistCharPhoneViewingAndReact(char),false);assert.equal(state.saves,1);assert.equal(reactions,1);assert.equal(char.chatConfig.aiPhoneContactReplies.pending.length,1);
 state.save=()=>false;assert.equal(await c.persistCharPhoneViewingAndReact(char),false);assert.equal(reactions,1);assert.equal(char.chatConfig.aiPhoneContactReplies.pending.length,1);
});
test('visiting all thirty apps keeps the early and late viewed records in the character context',()=>{
 const {c,char}=setup();c.beginCharPhoneViewing(char);
 for(let n=0;n<30;n++)c.recordCharPhoneViewing(char,'app'+n,'应用'+n,'内容编号'+n+'：'+ '正文'.repeat(1000));
 const event=c.finishCharPhoneViewing(char),prompt=c.buildCharPhoneViewingContext(char);
 assert.equal(event.visits.length,31);assert.match(prompt,/内容编号0：/);assert.match(prompt,/内容编号29：/);assert.ok(prompt.length<13000);
});
test('the real phone close action finishes the viewing session, saves it and dispatches the reaction',async()=>{
 const {c,char,state}=setup();let reactions=0;
 Object.assign(c,{document:{getElementById:()=>null},clearTimeout(){},resetCharPhoneClock(){},closeWechatAiPhoneErrorPrompt(){},closeWechatAiPhoneHomeEditor(){},closeWechatAiPhoneIconEditor(){},flushWechatAiPhoneContactReplyReactions:current=>{assert.equal(current.id,char.id);reactions++;return true;}});
 const source=fs.readFileSync(path.join(__dirname,'../apps/char-phone/reactions.js'),'utf8');vm.runInContext(source.slice(source.indexOf('function closeWechatAiPhone() {')),c);
 c.beginCharPhoneViewing(char);c.recordCharPhoneViewing(char,'memo','备忘录','周末约定');
 assert.equal(await c.closeWechatAiPhone(),true);assert.equal(state.saves,1);assert.equal(reactions,1);assert.equal(c.window._wechatAiPhoneOpenCharId,'');assert.equal(c.window._charPhoneViewing,null);
 assert.equal(char.chatConfig.aiPhoneContactReplies.events[0].visits[1].content,'周末约定');
});
test('photo generation uses configured chat image routing and coalesces duplicate clicks',async()=>{
 const {c,char,state}=setup(),gate=deferred();state.image=()=>gate.promise;
 const first=c.generateCharPhonePhoto(0),second=c.generateCharPhonePhoto(0);await new Promise(setImmediate);assert.equal(state.requests.length,1);assert.equal(state.requests[0].options.feature,'chat');assert.match(state.requests[0].prompt,/建筑师|现代都市/);
 gate.resolve({ok:true,url:'https://images.example/generated.png'});assert.equal(await first,true);assert.equal(await second,true);assert.equal(state.saves,1);assert.equal(c.charPhonePhotoState(char,char.chatConfig.aiPhoneSnapshot.appData.album.items[0]).url,'https://images.example/generated.png');
});
test('photo provider failure, invalid image and failed save preserve the old photo and expose an error',async()=>{
 for(const failure of ['provider','image','save']){
  const {c,char,state}=setup(),item=char.chatConfig.aiPhoneSnapshot.appData.album.items[0],key=c.charPhonePhotoKey(item);char.chatConfig.aiPhonePhotos={[key]:{url:'https://images.example/old.png'}};
  if(failure==='provider')state.image=async()=>({ok:false,error:'HTTP 429'});if(failure==='image')state.image=async()=>({ok:true,url:'javascript:bad'});if(failure==='save')state.save=()=>false;
  assert.equal(await c.generateCharPhonePhoto(0),false);assert.equal(char.chatConfig.aiPhonePhotos[key].url,'https://images.example/old.png');assert.ok(c.charPhonePhotoState(char,item).error);assert.equal(c.window._charPhonePhotoJobs.size,0);
 }
});
test('mail postcards and full letter detail preserve paragraph text safely',()=>{
 const {c,char}=setup();const body='第一段：海边的风。\n\n第二段：期待回信。\n<script>bad()</script>';
 const snap=c.normalizeCharPhoneApps({installedApps:['mail'],appData:{mail:{items:[{title:'一封海边来信',body,author:'林然',recipient:'陈安'}]}}});
 let html=c.renderCharPhoneTemplate('mail',snap,char);assert.match(html,/cp-postcard-entry/);assert.match(html,/cp-postage/);assert.doesNotMatch(html,/<script>/);
 c.window._charPhoneDetail={key:'mail',index:0};html=c.renderCharPhoneTemplate('mail',snap,char);assert.match(html,/cp-writing-paper/);assert.match(html,/第一段：海边的风。\n\n第二段/);assert.match(html,/&lt;script&gt;/);
});
