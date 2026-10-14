const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { clone, deferred, storageHarness, addBackupModule } = require('./helpers/harness.cjs');

function setup() {
    const char = {id:'desktop',name:'陈安',description:'建筑师，喜欢黑白摄影',history:[
        {type:'image',isMe:true,imageUrl:'data:image/png;base64,PHOTO',timestamp:10,description:'用户发来的海边照片'},
        {type:'image_stack',isMe:true,images:['https://images.example/a.png','https://images.example/b.png'],timestamp:20},
        {type:'image',isMe:false,imageUrl:'https://images.example/ai.png',timestamp:30}
    ],chatConfig:{aiPhoneSnapshot:{installedApps:['chat','memo','settings'],homeDesign:{theme:'light',layout:'collage',quote:'旧桌面'}}}};
    const state = {requests:[],saves:0,notices:[],response:()=>({ok:true,content:JSON.stringify({homeDesign:{theme:'dark',layout:'editorial',quote:'海边见',savedPhotoIds:['chat-photo-10-0'],photoIds:['chat-photo-10-0'],wallpaperPhotoId:'chat-photo-10-0',wallpaperPrompt:'黑白海岸',lockWallpaperPrompt:'月亮',iconPrompts:{memo:'纸张'}}})}),save:()=>true,image:()=>({ok:true,url:'https://images.example/generated.png'}),flushes:0};
    let timerId=0;const timers=new Map();
    const c=vm.createContext({window:{myCharacters:[char],_wechatAiPhoneOpenCharId:char.id},Date,Math,Map,Set,Promise,console:{warn(){}},queueMicrotask,
        document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]},
        setTimeout:f=>{timers.set(++timerId,f);return timerId;},clearTimeout:id=>timers.delete(id),setInterval:()=>++timerId,clearInterval(){},
        wcEscapeHtml:v=>String(v||'').replaceAll('<','&lt;').replaceAll('>','&gt;'),wcEscapeAttr:v=>String(v||'').replaceAll('"','&quot;'),
        getWechatCharDisplayName:c=>c.name,getWechatCharAvatarSource:()=>'',DEFAULT_AVATAR:'',renderWechatAiPhone(){},
        getWechatCharacterPersonaText:c=>c.description,buildWechatWorldBookPrompt:()=> '现代都市',buildWechatRecentHistoryForPrompt:()=> '海边见',
        parseWechatJsonObject:content=>{try{return JSON.parse(content);}catch{return null;}},
        saveCharactersToStorage:async()=>{state.saves++;return state.save(state.saves);},showWechatToast:text=>state.notices.push(text),
        callChatApi:async(messages,options)=>{state.requests.push({messages:clone(messages),options});return state.response();},
        callWechatImageGenerationApi:async(prompt,options)=>{state.requests.push({prompt,options});return state.image(state.requests.length);},
        getWechatAiPhoneContactReplyStore:ch=>ch.chatConfig.aiPhoneContactReplies ||= {pending:[],events:[]},
        flushWechatAiPhoneContactReplyReactions:()=>{state.flushes++;return true;}
    });
    for(const file of ['catalog','desktop','home','photos','viewing'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps/char-phone',file+'.js'),'utf8'),c);
    const fireDwell=async()=>{const id=c.window._charPhoneViewing.timer;timers.get(id)?.();timers.delete(id);await new Promise(setImmediate);};
    return {c,char,state,timers,fireDwell};
}

test('desktop selects only real received photos, validates bounded layouts and keeps saved photos after chat deletion',()=>{
    const {c,char}=setup();assert.equal(c.getCharPhonePhotoCandidates(char).length,3);
    const design=c.normalizeCharPhoneHomeDesign({theme:'evil',layout:'<script>',quote:'<img>',photoIds:['fake','chat-photo-10-0','chat-photo-10-0'],wallpaperPhotoId:'fake',savedPhotoIds:['chat-photo-20-1'],iconPrompts:{unknown:'bad',memo:'paper'}},char);
    assert.equal(design.theme,'light');assert.equal(design.layout,'collage');assert.deepEqual(clone(design.photoIds),['chat-photo-10-0']);assert.equal(design.wallpaperPhotoId,'');assert.deepEqual(clone(design.iconPrompts),{memo:'paper'});
    char.chatConfig.aiPhoneSavedChatPhotos=c.collectCharPhoneDesignPhotos(char,design);char.history=[];
    assert.equal(c.getCharPhoneDesktopPhoto(char,'chat-photo-10-0'),'data:image/png;base64,PHOTO');
    assert.equal(c.getCharPhoneAlbumItems(char).length,2);
    assert.notEqual(c.charPhonePhotoKey(c.getCharPhoneAlbumItems(char)[0]),c.charPhonePhotoKey(c.getCharPhoneAlbumItems(char)[1]));
});

test('appearance requests contain persona and world context, deduplicate clicks, persist chosen photos and expose album',async()=>{
    const {c,char,state}=setup(),gate=deferred();state.response=()=>gate.promise;
    const first=c.generateCharPhoneAppearance(),second=c.generateCharPhoneAppearance();await new Promise(setImmediate);assert.equal(state.requests.length,1);
    assert.match(state.requests[0].messages[1].content,/建筑师|现代都市/);assert.match(state.requests[0].messages[0].content,/chat-photo-10-0/);
    assert.doesNotMatch(state.requests[0].messages[0].content,/data:image\/png;base64/);
    gate.resolve({ok:true,content:JSON.stringify({homeDesign:{theme:'dark',layout:'minimal',photoIds:['chat-photo-10-0']}})});
    assert.equal(await first,true);assert.equal(await second,true);assert.equal(state.saves,1);
    assert.equal(char.chatConfig.aiPhoneSnapshot.homeDesign.theme,'dark');
    assert.ok(c.getWechatAiPhoneApps(char,char.chatConfig.aiPhoneSnapshot).some(app=>app.key==='album'));
    assert.equal(c.getWechatAiPhoneDesktopSettings(char).photos[0],'data:image/png;base64,PHOTO');
});

test('provider, malformed design, and storage failures preserve prior design and saved photos',async()=>{
    for(const failure of ['api','json','shape','save','throw']){
        const {c,char,state}=setup(),before=clone(char.chatConfig);
        if(failure==='api')state.response=()=>({ok:false,error:'HTTP 503'});
        if(failure==='json')state.response=()=>({ok:true,content:'bad JSON'});
        if(failure==='shape')state.response=()=>({ok:true,content:'{"homeDesign":[]}'});
        if(failure==='save')state.save=()=>false;
        if(failure==='throw')state.save=()=>{throw new Error('存储不可用');};
        assert.equal(await c.generateCharPhoneAppearance(),false,failure);assert.deepEqual(clone(char.chatConfig),before,failure);assert.ok(state.notices.length);assert.equal(c.window._charPhoneDesignJobs.size,0);
    }
});

test('generated wallpaper, lock wallpaper and icons use configured image route and invalidate stale assets',async()=>{
    const {c,char,state}=setup();await c.generateCharPhoneAppearance();state.requests=[];
    assert.equal(await c.generateCharPhoneAppearanceAssets(),true);assert.equal(state.requests.length,3);
    assert.equal(state.requests[0].options.size,'1024x1536');assert.equal(state.requests[2].options.size,'1024x1024');assert.ok(state.requests.every(r=>r.options.feature==='chat'&&r.options.usageChar===char));
    const settings=c.getWechatAiPhoneDesktopSettings(char);assert.equal(settings.lockWallpaper,'https://images.example/generated.png');assert.equal(settings.icons.memo,'https://images.example/generated.png');
    char.chatConfig.aiPhoneSnapshot.homeDesign.iconPrompts.memo='new';assert.equal(c.getWechatAiPhoneDesktopSettings(char).icons.memo,undefined);
    char.chatConfig.aiPhoneHomeSettings={wallpaper:'https://images.example/manual.png',icons:{memo:'https://images.example/manual-icon.png'}};
    assert.equal(c.getWechatAiPhoneDesktopSettings(char).wallpaper,'https://images.example/manual.png');assert.equal(c.getWechatAiPhoneDesktopSettings(char).icons.memo,'https://images.example/manual-icon.png');
});

test('image provider failure and save rejection preserve existing assets and retain each completed slot',async()=>{
    for(const failure of ['api','invalid','save','partial']){
        const {c,char,state}=setup();await c.generateCharPhoneAppearance();
        char.chatConfig.aiPhoneDesktopAssets={wallpaper:'https://images.example/old.png'};const before=clone(char.chatConfig.aiPhoneDesktopAssets);state.requests=[];state.saves=0;
        if(failure==='api')state.image=()=>({ok:false,error:'HTTP 429'});
        if(failure==='invalid')state.image=()=>({ok:true,url:'javascript:bad()'});
        if(failure==='save')state.save=()=>false;
        if(failure==='partial')state.image=n=>n===2?{ok:false,error:'HTTP 503'}:{ok:true,url:'https://images.example/first.png'};
        assert.equal(await c.generateCharPhoneAppearanceAssets(),false,failure);
        if(failure==='partial')assert.equal(char.chatConfig.aiPhoneDesktopAssets.wallpaper,'https://images.example/first.png');else assert.deepEqual(clone(char.chatConfig.aiPhoneDesktopAssets),before);
        assert.ok(c.window._charPhoneDesignErrors.get(char.id));
    }
});

test('live browsing batches rapid taps, keeps cumulative context and does not repeat sent visits on closing',async()=>{
    const {c,char,state,fireDwell}=setup();c.beginCharPhoneViewing(char);
    c.recordCharPhoneViewing(char,'memo','备忘录','一起看海');c.recordCharPhoneViewing(char,'album','相册','海边照片');c.recordCharPhoneViewing(char,'album','相册','海边照片');
    assert.equal(c.window._charPhoneViewing.visits.length,3);await fireDwell();
    const store=char.chatConfig.aiPhoneContactReplies;assert.equal(store.pending.length,1);assert.equal(store.pending[0].phase,'live');assert.equal(state.flushes,1);
    c.recordCharPhoneViewing(char,'music','音乐','晚风');await fireDwell();assert.equal(store.pending[1].visits.length,1);
    assert.match(c.buildCharPhoneViewingContext(char),/海边照片/);assert.match(c.buildCharPhoneViewingContext(char),/晚风/);
    assert.equal(c.finishCharPhoneViewing(char),null);assert.equal(store.pending.length,2);
});

test('failed live viewing persistence keeps one retryable event and does not dispatch a response',async()=>{
    const {c,char,state,fireDwell}=setup();state.save=()=>false;c.beginCharPhoneViewing(char);await fireDwell();
    assert.equal(state.flushes,0);assert.equal(char.chatConfig.aiPhoneContactReplies.pending.length,1);
    assert.equal(c.finishCharPhoneViewing(char),null);state.save=()=>true;
    assert.equal(await c.persistCharPhoneViewingAndReact(char),true);assert.equal(state.flushes,1);assert.equal(char.chatConfig.aiPhoneContactReplies.pending.length,1);
});

test('a queued live event reports browsing only while that exact session is still open',()=>{
    const {c,char}=setup();const source=fs.readFileSync(path.join(__dirname,'../apps/char-phone/reactions.js'),'utf8');
    vm.runInContext(source.slice(0,source.indexOf('function buildWechatAiPhoneContactReplyMessages(')),c);
    c.beginCharPhoneViewing(char);const event=c.enqueueCharPhoneViewing(char,c.window._charPhoneViewing,'live');
    assert.match(c.buildWechatAiPhoneContactReplyReactionPrompt(char,[event]),/用户正在查看/);
    c.finishCharPhoneViewing(char);assert.match(c.buildWechatAiPhoneContactReplyReactionPrompt(char,[event]),/用户已结束查看/);
    c.beginCharPhoneViewing(char);assert.match(c.buildWechatAiPhoneContactReplyReactionPrompt(char,[event]),/用户已结束查看/);
});

test('switching characters closes and persists the previous session and invalidates stale island responses',async()=>{
    const {c,char,state}=setup();c.beginCharPhoneViewing(char);const old=c.window._charPhoneViewing;
    const other={id:'other',chatConfig:{}};c.window.myCharacters.push(other);c.beginCharPhoneViewing(other);await new Promise(setImmediate);
    assert.equal(char.chatConfig.aiPhoneContactReplies.pending.length,1);assert.equal(c.window._charPhoneViewing.charId,'other');
    c.showCharPhoneMessageIsland(char,[{content:'旧回复'}],[{phase:'live',sessionId:old.sessionId}]);assert.equal(c.window._charPhoneIsland,undefined);assert.equal(state.flushes,1);
});

test('character phone assets and retained chat photos survive reload and full backup without inflating local index',async()=>{
    const source=[{id:'phone',name:'角色',history:[],chatConfig:{aiPhoneSavedChatPhotos:[{id:'p',image:'data:image/png;base64,'+'A'.repeat(2500000)}],aiPhoneDesktopAssets:{wallpaper:'data:image/png;base64,WALL'},aiPhoneSnapshot:{homeDesign:{theme:'dark',layout:'minimal'}}}}];
    const h=storageHarness({local:[]});addBackupModule(h);await h.context.loadCharactersFromStorage();h.context.window.myCharacters=source;assert.equal(await h.context.saveCharactersToStorage(),true);
    const compact=JSON.parse(h.localStorage.getItem('my_characters_data'))[0].chatConfig;assert.equal(compact.aiPhoneSavedChatPhotos,undefined);assert.equal(compact.aiPhoneDesktopAssets,undefined);
    const backup=await h.context.buildByndBackupData();assert.deepEqual(clone(backup.my_characters_data[0].chatConfig),source[0].chatConfig);
    const reload=storageHarness({local:JSON.parse(h.localStorage.getItem('my_characters_data')),meta:JSON.parse(h.localStorage.getItem('my_characters_data_meta')),record:h.state.record});await reload.context.loadCharactersFromStorage();assert.deepEqual(clone(reload.context.window.myCharacters[0].chatConfig),source[0].chatConfig);
});
