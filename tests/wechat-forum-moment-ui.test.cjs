const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,'..','wechat.js'),'utf8');
const fragment = (start,end) => source.slice(source.indexOf(start),source.indexOf(end));

test('a BYND post link renders a tappable escaped preview instead of a bare URL', () => {
    const context = vm.createContext({
        window:{ LivingWorld:{ getPostPreview:link => ({ link, title:'标题 <script>', community:'日常', author:'小林', excerpt:'正文', deleted:false }) } },
        wcEscapeHtml:value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'),
        wcEscapeAttr:value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')
    });
    vm.runInContext(fragment('function getWechatForumPostPreview','function getWechatLiteActionContent'),context);
    const preview = context.getWechatForumPostPreview('给你看 bynd://forum/post/post_123');
    const html = context.renderWechatForumPostPreview(preview);
    assert.match(html,/class="wc-forum-post-preview/);
    assert.match(html,/LivingWorld\.openPostLink/);
    assert.match(html,/标题 &lt;script&gt;/);
    assert.doesNotMatch(html,/<script>/);
});

test('forum preview is a standalone card, with any accompanying text in a separate bubble', () => {
    const css = fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
    assert.match(source,/class="msg-forum-preview-stack"/);
    assert.match(source,/class="msg-forum-card">\$\{renderWechatForumPostPreview\(forumPreview\)\}/);
    assert.match(source,/\$\{quoteHtml \|\| rawContent \? `<div class="msg-bubble/);
    assert.doesNotMatch(source,/class="msg-bubble[^"`]*has-forum-preview/);
    assert.match(css,/\.msg-forum-card \{ width:100%; min-width:0; \}/);
    assert.doesNotMatch(css,/\.msg-bubble\.has-forum-preview/);
});

test('screen shake uses the same quiet centered notice as poke', () => {
    const context = vm.createContext({
        wcEscapeHtml:value => String(value),
        getWechatChatUserProfile:() => ({ name:'我' }),
        getWechatCharDisplayName:() => '阿林'
    });
    vm.runInContext(fragment('function getWechatLiteActionContent','function buildWechatSpecialBubble'),context);
    const html = context.renderWechatScreenShakeNotice({ isMe:true, content:'你震动了对方的屏幕' },{});
    assert.match(html,/msg-poke-notice msg-shake-notice/);
    assert.match(html,/我震了震“阿林”的屏幕/);
    assert.doesNotMatch(html,/msg-shake-bubble/);
});

function momentHarness(apiResult, saveSucceeds = true) {
    let store = { posts:[] };
    const activity = {};
    let calls = 0;
    const char = { id:'char_1', name:'阿林', description:'喜欢深夜散步', avatar:'', chatConfig:{}, history:Array.from({ length:8 },(_,index) => ({ isMe:index % 2 === 0, type:'text', content:`第 ${index} 句普通聊天` })) };
    const context = vm.createContext({
        window:{ myCharacters:[char] }, Date, Math, JSON, Set, String, Number, Array,
        console:{ warn() {} }, DEFAULT_AVATAR:'avatar', WECHAT_CHAR_MOMENT_ACTIVITY_KEY:'moment_activity',
        getWechatMomentStore:() => store,
        saveWechatMomentStore:next => { store = next; },
        readWechatStore:() => activity,
        writeWechatStore:(_,next) => Object.assign(activity,next),
        callChatApi:async () => { calls++; return apiResult; },
        stripWechatPromptText:value => String(value),
        buildWechatWorldBookPrompt:() => '世界设定',
        getWechatCharDisplayName:person => person.name,
        pickWechatCharMomentCover:() => '',
        saveCharactersToStorage:async () => saveSucceeds,
        isWechatMomentsScreenOpen:() => false,
        renderWechatMoments() {}
    });
    vm.runInContext(fragment('const pendingWechatCharMoments','function findWechatContactByNameOrId'),context);
    return { context,char,store:() => store,calls:() => calls };
}

test('character moments are considered sparingly and a rejected save leaves no visible post', async () => {
    const h = momentHarness({ ok:true, content:JSON.stringify({ post:true, text:'今天傍晚走过旧桥，风把围巾吹乱了。' }) });
    assert.equal(await h.context.considerWechatCharMomentAfterReply(h.char),true);
    assert.equal(h.store().posts.length,1);
    assert.equal(h.char.chatConfig.aiMoments.length,1);
    assert.equal(await h.context.considerWechatCharMomentAfterReply(h.char),false);
    assert.equal(h.calls(),1);

    const failed = momentHarness({ ok:true, content:JSON.stringify({ post:true, text:'今天傍晚走过旧桥，风把围巾吹乱了。' }) },false);
    assert.equal(await failed.context.considerWechatCharMomentAfterReply(failed.char),false);
    assert.equal(failed.store().posts.length,0);
    assert.equal(failed.char.chatConfig.aiMoments.length,0);
});
