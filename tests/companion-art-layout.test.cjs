const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {sourceSection} = require('./helpers/harness.cjs');

test('saved layouts adapt from narrow phones to wide phones and back without enlarging app icons', () => {
    const c=vm.createContext({});
    vm.runInContext(sourceSection('script.js','function projectDesktopLayoutRect(', 'function clampDesktopLayoutRect('),c);
    const rect={id:'widget-photo-1',left:20,top:420,width:320,height:180,canvasWidth:360};
    const wide=c.projectDesktopLayoutRect(rect,440);
    assert.ok(Math.abs(wide.left-(440-wide.width)/2)<0.01);
    const back=c.projectDesktopLayoutRect(wide,360);
    assert.ok(Math.abs(back.left-20)<0.01);
    assert.ok(Math.abs(back.width-320)<0.01);
    assert.equal(c.projectDesktopLayoutRect({...rect,id:'app-wechat',width:64},440).width,64);
    assert.equal(c.inferDesktopLegacyCanvasWidth([rect],440),360);
    assert.equal(c.inferDesktopLegacyCanvasWidth([{id:'app-wechat',left:20,width:64}],440),440);
});

test('avatar instructions accept whitespace and never leak invalid indices to chat', () => {
    const c=vm.createContext({});
    vm.runInContext(sourceSection('wechat.js','function consumeWechatAvatarDirective(', 'async function triggerAiAfterMessage('),c);
    const char={avatar:'A',avatarGallery:['A','B','C']};
    const result=c.consumeWechatAvatarDirective(char,'哼。|||[换头像： 3 ]');
    assert.equal(char.avatar,'C');
    assert.equal(result.changed,true);
    assert.equal(result.content,'哼。|||');
    assert.equal(c.consumeWechatAvatarDirective(char,'[换头像:900]').content,'');
    assert.equal(char.avatar,'C');
    assert.equal(c.consumeWechatAvatarDirective(char,'别烦我【换头像：2】').content,'别烦我');
    assert.equal(char.avatar,'B');
});

test('background instructions switch the chat background from the gallery and never leak to chat', () => {
    const c=vm.createContext({});
    vm.runInContext(sourceSection('wechat.js','function consumeWechatAvatarDirective(', 'async function triggerAiAfterMessage('),c);
    const char={avatar:'A',avatarGallery:['A'],chatConfig:{chatBgImage:'X',chatBgGallery:['X','Y']}};
    const result=c.consumeWechatAvatarDirective(char,'到家了。|||[换背景： 2 ]');
    assert.equal(char.chatConfig.chatBgImage,'Y');
    assert.equal(result.backgroundChanged,true);
    assert.equal(result.changed,true);
    assert.equal(result.content,'到家了。|||');
    assert.equal(c.consumeWechatAvatarDirective(char,'[换背景:9]').content,'');
    assert.equal(char.chatConfig.chatBgImage,'Y');
    assert.equal(c.consumeWechatAvatarDirective({avatar:'A',avatarGallery:['A']},'嗯 [换背景:1]').content,'嗯');
});

test('sticker prompt includes late packs and contextual matches within a bounded candidate list', () => {
    const all=Array.from({length:70},(_,i)=>({name:'贴纸'+i,packName:'第一包',url:'a'+i,source:'pack'}));
    all.push({name:'抱抱',packName:'后面的包',url:'hug',source:'pack',aliases:['安慰']});
    const c=vm.createContext({getWechatAvailableStickers:()=>all,normalizeWechatStickerUrl:()=>''});
    vm.runInContext(sourceSection('wechat.js','function scoreWechatStickerMatch(', 'function buildBoltpStickerList('),c);
    const prompt=c.buildWechatStickerPrompt({id:'a',history:[{content:'想要抱抱'}]});
    assert.match(prompt,/抱抱.*后面的包/);
    assert.match(prompt,/主动使用/);
    assert.ok((prompt.match(/\n- /g)||[]).length<=41);
    assert.equal(c.findWechatStickerForAi({},'安慰').url,'hug');
});

test('user imports join the AI sticker pool immediately, keep aliases, and never report a failed save as success', () => {
    let saved={packs:[{id:'user-pack',name:'用户导入',stickers:[]}]};
    let fail=false;
    const c=vm.createContext({window:{},getStickerPacks:()=>JSON.parse(JSON.stringify(saved)),getEditableStickerPacks:data=>data.packs,
        isWechatBuiltinStickerPackId:()=>false,refreshStickerSurfaces(){},
        saveStickerPacks:data=>{if(fail)throw new Error('QuotaExceededError');saved=JSON.parse(JSON.stringify(data));}});
    vm.runInContext(sourceSection('wechat.js','function appendWechatStickersToPack(', 'function ensureWechatNamedStickerPack('),c);
    vm.runInContext(sourceSection('wechat.js','function getAllWechatStickers(', 'function getWechatWorldBookStickerEntries('),c);
    const image={id:'mine',name:'专属抱抱',aliases:['贴贴'],url:'data:image/png;base64,USER'};
    assert.equal(c.appendWechatStickersToPack('user-pack',[image]),true);
    assert.equal(c.getAllWechatStickers()[0].name,'专属抱抱');
    assert.equal(c.getAllWechatStickers()[0].aliases[0],'贴贴');
    assert.equal(c.getAllWechatStickers()[0].url,image.url);
    fail=true;
    assert.throws(()=>c.appendWechatStickersToPack('user-pack',[{...image,id:'two',url:'data:image/png;base64,NEW'}]),/QuotaExceededError/);
    assert.equal(c.getAllWechatStickers().length,1);
});
