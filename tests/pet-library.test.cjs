const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { sourceSection, memoryStorage, deferred } = require('./helpers/harness.cjs');

function harness() {
    const storage = memoryStorage({ bynd_monitor_active_pet_v1:'old', bynd_monitor_pet_enabled_v1:'0' });
    const notices = [], downloads = [], assets = [], floats = [], timers = [];
    const chars = [{id:'a',name:'A',chatConfig:{monitorEnabled:true}}];
    const context = vm.createContext({
        localStorage:storage, myCharacters:chars, console, URL, URLSearchParams, Date, Math,
        navigator:{}, document:{getElementById:()=>null,querySelector:()=>null},
        setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},requestAnimationFrame(){},
        showWechatToast:message=>notices.push(message),
        musicEscapeHtml:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
        musicEscapeAttr:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
    });
    context.window=context;
    const read=code=>vm.runInContext(code,context);
    read(sourceSection('script.js','// --- BYND Monitor / 内部监控剧情入口 ---','// --- BYND Outing / 一起出门 ---'));
    const data='data:image/webp;base64,UklGRg==';
    context.fetchMonitorPetDataUrl=async (url,type)=>{downloads.push([url,type]);return type?data:'data:application/zip;base64,UEs=';};
    context.saveMonitorPetAsset=async (id,value)=>assets.push([id,value]);
    context.syncMonitorPetFloating=()=>floats.push(context.getActiveMonitorPetId());
    context.callChatApi=()=>{throw new Error('Imports must not call a model');};
    read(`monitorPetResults=[normalizeMonitorPet({id:'new',displayName:'New friend',previewUrl:'/preview.webp',posterUrl:'/poster.webp',downloadUrl:'/download.zip',tags:['cute']})];`);
    return {context,read,storage,notices,downloads,assets,floats,timers,chars,data};
}

function assertImportFailed(h,pattern) {
    assert.equal(h.context.getMonitorPetLibrary().length,0);
    assert.equal(h.context.getActiveMonitorPetId(),'old');
    assert.equal(h.context.isMonitorPetEnabled(),false);
    assert.equal(h.notices.length,0);
    assert.equal(h.floats.length,0);
    assert.equal(h.read('monitorPetLibraryAction'),null);
    assert.match(h.read('monitorPetStatus'),pattern);
}

test('one-step community import saves animation and package then enables it without any role or model',async()=>{
    const h=harness();h.chars.length=0;
    assert.equal(await h.context.importAndUseMonitorPet('new'),true);
    assert.equal(h.context.getActiveMonitorPetId(),'new');
    assert.equal(h.context.isMonitorPetEnabled(),true);
    assert.equal(h.context.getMonitorPetLibrary()[0].posterDataUrl,h.data);
    assert.deepEqual(h.downloads,[['https://codex-pets.net/preview.webp','image/'],['https://codex-pets.net/download.zip',undefined]]);
    assert.equal(h.assets[0][0],'new:zip');
    assert.deepEqual(h.floats,['new']);
    assert.match(h.notices[0],/可随时绑定角色/);
    assert.equal(h.timers.length,0);
});

test('import-only adds a collection item while preserving the visible pet, role and watcher configuration',async()=>{
    const h=harness();h.storage.setItem('bynd_monitor_pet_bound_char_v1','a');
    const before=JSON.stringify(h.chars);
    assert.equal(await h.context.downloadMonitorPet('new'),true);
    assert.equal(h.context.getMonitorPetLibrary().length,1);
    assert.equal(h.context.getActiveMonitorPetId(),'old');
    assert.equal(h.context.isMonitorPetEnabled(),false);
    assert.equal(h.storage.getItem('bynd_monitor_pet_bound_char_v1'),'a');
    assert.equal(JSON.stringify(h.chars),before);
    assert.equal(h.floats.length,0);
    assert.match(h.notices[0],/已导入.*我的桌宠/);
});

test('failed preview download can fall back to its poster without downloading a second package',async()=>{
    const h=harness(), calls=[];
    h.context.fetchMonitorPetDataUrl=async (url,type)=>{calls.push(url);if(url.includes('preview'))throw new Error('404');return type?h.data:'zip';};
    assert.equal(await h.context.importAndUseMonitorPet('new'),true);
    assert.deepEqual(calls,['https://codex-pets.net/preview.webp','https://codex-pets.net/poster.webp','https://codex-pets.net/download.zip']);
});

test('a missing image never saves or activates an incomplete community pet',async()=>{
    const h=harness();h.context.fetchMonitorPetDataUrl=async()=>{throw new Error('image unavailable');};
    assert.equal(await h.context.importAndUseMonitorPet('new'),false);
    assertImportFailed(h,/导入失败.*image unavailable/);
});

test('a failed package download leaves the previous pet and collection unchanged',async()=>{
    const h=harness();h.context.fetchMonitorPetDataUrl=async(_,type)=>{if(!type)throw new Error('zip unavailable');return h.data;};
    assert.equal(await h.context.importAndUseMonitorPet('new'),false);
    assertImportFailed(h,/导入失败.*zip unavailable/);
});

test('an aborted asset transaction cannot announce a successful import',async()=>{
    const h=harness();h.context.saveMonitorPetAsset=async()=>{throw new Error('transaction aborted');};
    assert.equal(await h.context.importAndUseMonitorPet('new'),false);
    assertImportFailed(h,/导入失败.*transaction aborted/);
});

test('a collection quota error does not activate the pet or deactivate a character image',async()=>{
    const h=harness(), set=h.storage.setItem;let profileWrites=0;
    h.storage.setItem('bynd_monitor_pet_bound_char_v1','a');
    h.context.ByndCharacterPet={profile:()=>({active:true}),update:async()=>profileWrites++};
    h.storage.setItem=(key,value)=>{if(key==='bynd_monitor_pet_library_v1')throw new Error('quota');set(key,value);};
    assert.equal(await h.context.importAndUseMonitorPet('new'),false);
    assertImportFailed(h,/导入失败.*quota/);
    assert.equal(profileWrites,0);
});

test('if switching fails after import, the saved pet remains available and old preferences are restored',async()=>{
    const h=harness();h.storage.setItem('bynd_monitor_pet_bound_char_v1','a');
    h.context.ByndCharacterPet={profile:()=>({active:true}),update:async()=>{throw new Error('profile save failed');}};
    assert.equal(await h.context.importAndUseMonitorPet('new'),false);
    assert.equal(h.context.getMonitorPetLibrary().length,1);
    assert.equal(h.context.getActiveMonitorPetId(),'old');
    assert.equal(h.context.isMonitorPetEnabled(),false);
    assert.match(h.read('monitorPetStatus'),/素材已导入，但未能启用.*切换未能保存.*profile save failed/);
    assert.equal(h.notices.length,0);
});

test('repeated import and apply clicks cannot interleave selection changes during a pending import',async()=>{
    const h=harness(),gate=deferred();
    h.context.saveMonitorPetLibrary([{id:'old',displayName:'Old'}]);
    h.context.saveMonitorPetAsset=()=>gate.promise;
    const first=h.context.importAndUseMonitorPet('new');
    await Promise.resolve();await Promise.resolve();
    assert.equal(await h.context.importAndUseMonitorPet('new'),false);
    assert.equal(await h.context.applyMonitorPet('old'),false);
    gate.resolve();
    assert.equal(await first,true);
    assert.equal(h.downloads.length,2);
    assert.equal(h.context.getMonitorPetLibrary().length,2);
    assert.equal(h.context.getActiveMonitorPetId(),'new');
    assert.equal(h.read('monitorPetLibraryAction'),null);
});

test('saved community pets can be previewed and enabled offline without repeat downloads',async()=>{
    const h=harness();
    await h.context.downloadMonitorPet('new');
    h.read('monitorPetResults=[]');
    h.context.fetchMonitorPetDataUrl=async()=>{throw new Error('offline');};
    let preview;
    h.context.ByndPetWorkspace={previewPet:pet=>{preview=pet;return true;},petChanged(){},setBusy(){},render(){}};
    h.context.previewMonitorPet('new');
    assert.equal(preview.posterDataUrl,h.data);
    assert.equal(await h.context.applyMonitorPet('new'),true);
    assert.equal(h.context.getActiveMonitorPetId(),'new');
    assert.equal(h.downloads.length,2);
});

test('importing beyond the old collection limit does not silently evict earlier saved pets',()=>{
    const h=harness();
    h.context.saveMonitorPetLibrary(Array.from({length:81},(_,i)=>({id:'pet-'+i,displayName:'Friend '+i})));
    assert.equal(h.context.getMonitorPetLibrary().length,81);
    assert.equal(h.context.getMonitorPetLibrary().at(-1).id,'pet-80');
});

test('saved cards retain preview and show activation state only for the pet actually in use',()=>{
    const h=harness();h.storage.setItem('bynd_monitor_active_pet_v1','new');
    const pet=h.context.normalizeMonitorPet({id:"new'quoted",displayName:'<Friend>',posterDataUrl:h.data,tags:[]});
    const card=h.context.renderMonitorPetCard(pet,true,'',true);
    assert.match(card,/data-monitor-pet-operation="preview"/);
    assert.match(card,/data-monitor-pet-id="new&#39;quoted"/);
    assert.doesNotMatch(card,/onclick="[^\"]*new'quoted/);
    assert.equal(h.context.getMonitorPetActiveLibraryId(),'');
    h.storage.setItem('bynd_monitor_pet_enabled_v1','1');
    assert.equal(h.context.getMonitorPetActiveLibraryId(),'new');
    h.storage.setItem('bynd_monitor_pet_bound_char_v1','a');
    h.context.ByndCharacterPet={profile:()=>({active:true,baseKey:'confirmed-character'})};
    assert.equal(h.context.getMonitorPetActiveLibraryId(),'');
});

test('image downloads reject HTML and empty image responses before recording a usable asset',async()=>{
    const h=harness();
    const original=sourceSection('script.js','async function fetchMonitorPetDataUrl(','async function saveMonitorPetSelection(');
    h.read(original);
    h.context.monitorBlobToDataUrl=async blob=>'data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');
    h.context.fetch=async()=>new Response('<html>unavailable</html>',{headers:{'content-type':'text/html'}});
    await assert.rejects(h.context.fetchMonitorPetDataUrl('/image.webp','image/'),/有效图片/);
    h.context.fetch=async()=>new Response('',{headers:{'content-type':'image/webp'}});
    await assert.rejects(h.context.fetchMonitorPetDataUrl('/image.webp','image/'),/有效图片/);
    h.context.fetch=async()=>new Response('RIFF',{headers:{'content-type':'image/webp'}});
    assert.equal(await h.context.fetchMonitorPetDataUrl('/image.webp','image/'),'data:image/webp;base64,UklGRg==');
});
