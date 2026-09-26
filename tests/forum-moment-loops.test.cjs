const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const worldSource = read('systems/living-world/living-world.js');
const wechat = read('wechat.js');
const chatApi = read('core/api/chat-api.js');
const comic = read('apps/comic/comic.js');
const fn = (source, name) => {
    const from = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    assert.ok(from >= 0, `missing function ${name}`);
    return source.slice(from, source.indexOf('\n}\n', from) + 3);
};
const section = (source, start, end) => {
    const from = source.indexOf(start); const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `missing section ${start}`);
    return source.slice(from, to);
};
const flush = async (rounds = 6) => { for (let index = 0; index < rounds; index++) await new Promise(resolve => setImmediate(resolve)); };

function worldHarness(initial = {}, options = {}) {
    const key = 'bynd_living_world_v1';
    const values = new Map([[key, JSON.stringify({ communities:[{ id:'lounge', name:'广场', description:'聊天' }], posts:[{ id:'post_1', authorId:'user', communityId:'lounge', title:'你好', body:'', createdAt:Date.now() }], viewerId:'user', ...initial })]]);
    const fields = { 'living-world-root':{ innerHTML:'', querySelector:() => null, querySelectorAll:() => [] } };
    const listeners = {}; const rootClasses = new Set(); const toasts = []; const canvases = []; const comicCalls = [];
    let quota = false;
    fields['lw-toast'] = { hidden:true, set textContent(value) { toasts.push(String(value)); } };
    const element = () => ({ append() {}, set textContent(text) { this.text = String(text); }, get innerHTML() { return String(this.text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); } });
    const canvas = () => { const box = { width:0, height:0, getContext:() => ({ fillRect() {}, drawImage() {} }), toDataURL:(type, quality) => { canvases.push({ width:box.width, height:box.height, type, quality }); return options.dataUrl ? options.dataUrl(box) : `data:image/jpeg;base64,${'A'.repeat(2000)}`; } }; return box; };
    const image = options.image || { width:4000, height:3000 };
    const context = vm.createContext({
        window:{ myCharacters:[{ id:'friend', name:'朋友', avatar:'' }], getUserProfile:() => ({ name:'我' }), addEventListener:(type, listener) => { (listeners[type] ||= []).push(listener); }, dispatchEvent:event => (listeners[event.type] || []).forEach(listener => listener(event)), ByndComic:{ fromSource:(...args) => comicCalls.push(args) } },
        document:{ hidden:false, getElementById:id => fields[id] || null, querySelector:selector => fields[selector] || null, querySelectorAll:() => [], createElement:tag => tag === 'canvas' ? canvas() : element(), documentElement:{ classList:{ add:name => rootClasses.add(name), remove:name => rootClasses.delete(name), toggle:(name, on) => { if (on) rootClasses.add(name); else rootClasses.delete(name); }, contains:name => rootClasses.has(name) } } },
        localStorage:{ getItem:name => values.get(name) || null, setItem:(name, value) => { if (quota && name === key) { const error = new Error('The quota has been exceeded.'); error.name = 'QuotaExceededError'; throw error; } values.set(name, value); }, removeItem:name => values.delete(name) },
        FileReader:class { readAsDataURL(file) { this.result = `data:${file.type};base64,BBBB`; setImmediate(() => this.onload()); } },
        Image:class { constructor() { this.width = image.width; this.height = image.height; } set src(value) { this.source = value; setImmediate(() => this.onload()); } },
        console:{ error() {}, warn() {} }, Date, Math, JSON, Set, Map, Object, String, Number, Array, Promise, setImmediate,
        CustomEvent:class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
        setTimeout:() => 0, clearTimeout() {}, AbortController, URL, fetch:async () => { throw Error('network unavailable'); }
    });
    vm.runInContext(worldSource, context);
    return { api:context.window.LivingWorld, window:context.window, fields, values, toasts, canvases, comicCalls, rootClasses, saved:() => JSON.parse(values.get(key)), quota:value => { quota = value; }, setTime:timestamp => { context.Date = class extends Date { static now() { return timestamp; } }; } };
}
const hiddenForum = { classList:{ contains:name => name === 'hidden' } };

test('an author reply saved in the background records its actor and flags the closed forum icon', async () => {
    const old = Date.now() - 3600000;
    const h = worldHarness({ posts:[{ id:'post_friend', authorId:'char:friend', communityId:'lounge', title:'夜话', body:'内容', commentCount:1, createdAt:old - 1000 }], comments:[{ id:'user_reply', postId:'post_friend', authorId:'user', body:'你好', createdAt:old }], events:[{ id:'reply_event', type:'forum_reply', actorId:'user', targetId:'post_friend', visibility:'public', metadata:{ commentId:'user_reply' }, createdAt:old }], knowledge:{ 'char:friend':[{ eventId:'reply_event', knownAt:old }] }, forumSettings:{ replyMode:'app' } });
    await h.api.init();
    h.fields['app-living-world-window'] = hiddenForum;
    h.window.callChatApi = async () => ({ ok:true, content:JSON.stringify({ action:'reply', body:'我看见你的留言了。' }) });
    await h.api.maybeRunInteraction();
    const reply = h.saved().comments.find(item => item.authorId === 'char:friend');
    const event = h.saved().events.find(item => item.type === 'forum_reply' && item.metadata?.commentId === reply.id);
    assert.equal(event.actorId, 'char:friend');
    assert.equal(event.targetId, 'post_friend');
    assert.equal(event.visibility, 'public');
    assert.ok(h.rootClasses.has('lw-forum-unread'));
    assert.equal(h.values.get('bynd_living_world_unread_v1'), '1');
    await h.api.init();
    assert.ok(!h.rootClasses.has('lw-forum-unread'));
    assert.equal(h.values.get('bynd_living_world_unread_v1'), undefined);
});

test('previously saved malformed author-reply events are repaired once on load', async () => {
    const h = worldHarness({ posts:[{ id:'post_friend', authorId:'char:friend', communityId:'lounge', title:'夜话', body:'内容', createdAt:Date.now() }], comments:[{ id:'old_answer', postId:'post_friend', authorId:'char:friend', body:'之前的回复', createdAt:Date.now() }], events:[{ id:'broken_event', type:'forum_reply', actorId:'post_friend', targetId:{ commentId:'old_answer', excerpt:'之前的回复', generated:true }, metadata:'public', visibility:'private', createdAt:Date.now() }] });
    await h.api.init();
    const repaired = h.saved().events.find(item => item.id === 'broken_event');
    assert.equal(repaired.actorId, 'char:friend');
    assert.equal(repaired.targetId, 'post_friend');
    assert.equal(repaired.visibility, 'public');
    assert.equal(repaired.metadata.commentId, 'old_answer');
    assert.equal(h.saved().migration.forumReplyEventsRepaired, true);
});

test('private chat history is bounded, stays deduplicated, and is removed when the chat is cleared', async () => {
    const events = Array.from({ length:350 }, (_, index) => ({ id:`chat_${index}`, type:'private_chat', actorId:'user', targetId:'char:friend', visibility:'private', metadata:{ sourceKey:`key_${index}`, excerpt:`第${index}句`, privateTo:['char:friend','user'] }, createdAt:Date.now() - (400 - index) * 1000 }));
    const forumEvent = { id:'post_event', type:'forum_post', actorId:'user', targetId:'post_1', visibility:'public', createdAt:Date.now() };
    const rows = [...events, forumEvent].map(item => ({ eventId:item.id, knownAt:item.createdAt }));
    const h = worldHarness({ events:[...events, forumEvent], knowledge:{ user:rows, 'char:friend':rows.slice(0, 350) } });
    await h.api.init();
    let world = h.saved();
    const chats = world.events.filter(item => item.type === 'private_chat');
    assert.equal(chats.length, 300);
    assert.equal(chats[0].id, 'chat_50');
    assert.ok(world.knowledge.user.every(row => world.events.some(item => item.id === row.eventId)));
    assert.equal(world.knowledge['char:friend'].length, 300);
    const char = h.window.myCharacters[0];
    assert.equal(h.api.recordPrivateChatMessage(char, { isMe:true, content:'新的一句', timestamp:99 }), true);
    assert.equal(h.api.recordPrivateChatMessage(char, { isMe:true, content:'新的一句', timestamp:99 }), false);
    world = h.saved();
    assert.equal(world.events.filter(item => item.type === 'private_chat').length, 300);
    assert.ok(world.events.some(item => item.metadata?.excerpt === '新的一句'));
    assert.equal(h.api.clearPrivateChatEvents(char), true);
    world = h.saved();
    assert.equal(world.events.filter(item => item.type === 'private_chat').length, 0);
    assert.ok(world.events.some(item => item.id === 'post_event'));
    assert.ok(world.knowledge.user.every(row => !String(row.eventId).startsWith('chat_')));
    assert.match(fn(wechat, 'resetWechatChatDerivedContext'), /LivingWorld\?\.clearPrivateChatEvents\?\.\(char\)/);
});

test('picked forum images are compressed to a bounded JPEG and oversized results are refused with a clear message', async () => {
    const h = worldHarness();
    await h.api.init();
    h.api.pickImage({ files:[{ type:'image/png', size:5 * 1024 * 1024 }], value:'picked' });
    await flush();
    assert.deepEqual({ width:h.canvases[0].width, height:h.canvases[0].height, type:h.canvases[0].type }, { width:1280, height:960, type:'image/jpeg' });
    Object.assign(h.fields, { 'lw-post-title':{ value:'图' }, 'lw-post-community':{ value:'lounge' } });
    h.api.createPost({ preventDefault() {} });
    assert.match(h.saved().posts[0].imageUrl, /^data:image\/jpeg;base64,/);

    const huge = worldHarness({}, { dataUrl:() => `data:image/jpeg;base64,${'A'.repeat(800000)}` });
    await huge.api.init();
    huge.api.pickImage({ files:[{ type:'image/jpeg', size:3 * 1024 * 1024 }], value:'picked' });
    await flush();
    assert.ok(huge.toasts.some(text => /压缩后仍然过大/.test(text)));
    Object.assign(huge.fields, { 'lw-post-title':{ value:'无图' }, 'lw-post-community':{ value:'lounge' } });
    huge.api.createPost({ preventDefault() {} });
    assert.equal(huge.saved().posts[0].imageUrl, '');

    huge.quota(true);
    huge.fields['lw-post-title'].value = '放不下';
    huge.api.createPost({ preventDefault() {} });
    assert.ok(huge.toasts.some(text => /存储空间已满/.test(text)));
});

test('a failed scheduled world step retries after a short doubling backoff and shows why it failed', async () => {
    const start = Date.now();
    const h = worldHarness({ migration:{ apiGenerated:true }, lastSimulatedAt:start - 2 * 86400000, forumSettings:{ refreshMode:'interval', intervalHours:12, profileMode:'economy', lastAttemptAt:0 } });
    let calls = 0;
    h.window.callChatApi = async () => { calls++; return { ok:false, rateLimited:true, error:'API 错误 (429): Too Many Requests' }; };
    h.setTime(start);
    await h.api.init(); await flush();
    assert.equal(calls, 1);
    let settings = h.saved().forumSettings;
    assert.equal(settings.autoFailureCount, 1);
    assert.equal(settings.autoRetryAt, start + 10 * 60000);
    assert.match(settings.lastAutoFailure.reason, /429/);
    h.setTime(start + 5 * 60000);
    await h.api.init(); await flush();
    assert.equal(calls, 1);
    h.setTime(start + 11 * 60000);
    await h.api.init(); await flush();
    assert.equal(calls, 2);
    settings = h.saved().forumSettings;
    assert.equal(settings.autoFailureCount, 2);
    assert.equal(settings.autoRetryAt, start + 31 * 60000);
    h.api.setTab('settings');
    assert.match(h.fields['living-world-root'].innerHTML, /上次自动推进失败：API 错误 \(429\)/);
    h.window.callChatApi = async () => { calls++; return { ok:true, content:JSON.stringify({ actorId:'char:friend', action:'silence', sourceEventIds:[] }) }; };
    h.setTime(start + 32 * 60000);
    await h.api.init(); await flush();
    assert.equal(calls, 3);
    settings = h.saved().forumSettings;
    assert.equal(settings.autoFailureCount, 0);
    assert.equal(settings.lastAutoFailure, null);
});

test('drawing a forum post as a comic resolves the character id and lets NPC posts choose a character', async () => {
    const h = worldHarness({ npcs:[{ id:'npc_ivy', type:'npc', name:'艾薇', summary:'喜欢拍照' }], posts:[{ id:'post_char', authorId:'char:friend', communityId:'lounge', title:'角色帖', body:'正文', createdAt:Date.now() }, { id:'post_npc', authorId:'npc_ivy', communityId:'lounge', title:'路人帖', body:'正文', createdAt:Date.now() }] });
    await h.api.init();
    h.api.openPost('post_char'); h.api.comicCurrentPost();
    h.api.openPost('post_npc'); h.api.comicCurrentPost();
    assert.deepEqual(h.comicCalls.map(call => call[1]), ['friend', '']);
    assert.match(comic, /const needsChar = !!source && !sourceChar && !prefill\.charId;/);
    assert.match(comic, /const charId = needsChar \? '' :/);
    assert.match(comic, /\$\{draft\.needsChar \? '<p class="ct-warn">这段内容来自论坛或梦境，请选择要画的角色。<\/p>' : ''\}/);
});

test('a world step can add one promotion once enough posts passed the configured gap', async () => {
    const posts = Array.from({ length:16 }, (_, index) => ({ id:`post_${index}`, authorId:'char:friend', communityId:'lounge', title:`帖子 ${index}`, body:'正文', createdAt:Date.now() - index * 1000 }));
    const promotion = { sponsor:'街角咖啡', headline:'秋季新品', body:'桂花拿铁上市', detail:'本周社区成员第二杯半价。', cta:'看看', targetCommunityIds:['lounge'] };
    const decision = JSON.stringify({ actorId:'npc_ivy', action:'silence', sourceEventIds:[], promotion });
    const h = worldHarness({ npcs:[{ id:'npc_ivy', type:'npc', name:'艾薇' }], posts, migration:{ apiGenerated:true } });
    await h.api.init();
    let prompt = '';
    h.window.callChatApi = async messages => { prompt = messages[1].content; return { ok:true, content:decision }; };
    await h.api.advanceWorld({ actorId:'npc_ivy' });
    assert.match(prompt, /"promotion"/);
    assert.equal(h.saved().promotions.length, 1);
    assert.equal(h.saved().promotions[0].sponsor, '街角咖啡');

    const off = worldHarness({ npcs:[{ id:'npc_ivy', type:'npc', name:'艾薇' }], posts, migration:{ apiGenerated:true }, forumSettings:{ promotionsEnabled:false } });
    await off.api.init();
    off.window.callChatApi = async messages => { prompt = messages[1].content; return { ok:true, content:decision }; };
    await off.api.advanceWorld({ actorId:'npc_ivy' });
    assert.doesNotMatch(prompt, /"promotion"/);
    assert.equal(off.saved().promotions.length, 0);
});

function momentQueueHarness(posts, chars, api) {
    let store = { posts };
    const calls = []; const timers = [];
    const context = vm.createContext({
        window:{ myCharacters:chars }, Date, Math, JSON, Set, String, Number, Array, Object, Promise,
        console:{ warn() {} }, DEFAULT_AVATAR:'avatar', WECHAT_MOMENTS_STORAGE_KEY:'moments',
        readWechatStore:() => JSON.parse(JSON.stringify(store)),
        writeWechatStore:(_, next) => { store = JSON.parse(JSON.stringify(next)); },
        callChatApi:async (messages, options) => { calls.push(options); return api(options, calls.length); },
        parseWechatJsonObject:value => { try { return JSON.parse(value); } catch (_) { return null; } },
        cleanWechatVisibleContent:value => String(value || ''), stripWechatPromptText:value => String(value || ''),
        getWechatCharDisplayName:char => char.name, getUserProfile:() => ({ name:'我' }),
        buildWechatWorldBookPrompt:() => '', buildWechatRecentHistoryForPrompt:() => '',
        formatWechatRelativeTime:() => '刚刚', createMessageTimestamp:() => Date.now(),
        saveCharactersToStorage:() => true, renderWechatMoments() {}, refreshChatView() {}, renderChatList() {},
        document:{ getElementById:() => null },
        setTimeout:callback => { timers.push(callback); return timers.length; }
    });
    vm.runInContext(section(wechat, 'function getWechatMomentStore', 'function openWechatMoments'), context);
    return { context, calls, store:() => store, setStore:next => { store = next; }, runTimers:() => timers.splice(0).forEach(callback => callback()) };
}
const commentTask = (id, charId, extra = {}) => ({ id, charId, type:'comment', dueAt:0, done:false, ...extra });

test('a moment job merges only its own result into the latest store', async () => {
    let release; const gate = new Promise(resolve => { release = resolve; });
    const h = momentQueueHarness([{ id:'post_a', text:'晚霞', comments:[], pending:[commentTask('t_a','c1')] }, { id:'post_b', text:'旧动态', comments:[], pending:[] }], [{ id:'c1', name:'阿林' }], async () => { await gate; return { ok:true, content:JSON.stringify({ action:'comment', text:'看起来很好' }) }; });
    h.context.queueWechatMomentCommentGeneration('post_a', 't_a');
    await flush();
    const edited = h.store();
    edited.posts = edited.posts.filter(post => post.id !== 'post_b');
    edited.posts.push({ id:'post_c', text:'新动态', comments:[], pending:[] });
    h.setStore(edited);
    release(); await flush();
    const ids = h.store().posts.map(post => post.id);
    assert.deepEqual(ids, ['post_a', 'post_c']);
    assert.equal(h.store().posts[0].comments[0].text, '看起来很好');
    assert.equal(h.store().posts[0].pending[0].done, true);

    let releaseAsk; const askGate = new Promise(resolve => { releaseAsk = resolve; });
    const char = { id:'c1', name:'阿林', history:[] };
    const deleted = momentQueueHarness([{ id:'post_a', text:'晚霞', comments:[], pending:[{ ...commentTask('t_a','c1'), type:'ask' }] }], [char], async () => { await askGate; return { ok:true, content:JSON.stringify({ action:'ask', text:'今天去哪里看的晚霞呀？' }) }; });
    deleted.context.queueWechatMomentAskGeneration('post_a', 't_a');
    await flush();
    deleted.setStore({ posts:[] });
    releaseAsk(); await flush();
    assert.deepEqual(deleted.store().posts, []);
    assert.equal(char.history.length, 0);
});

test('the moment queue sends one background request at a time and backs off failures', async () => {
    const chars = [{ id:'c1', name:'一' }, { id:'c2', name:'二' }, { id:'c3', name:'三' }, { id:'group', name:'群', isGroupChat:true }];
    const h = momentQueueHarness([{ id:'post_a', text:'你好', comments:[], pending:[commentTask('t1','c1'), commentTask('t2','c2'), commentTask('t3','c3'), commentTask('tg','group')] }], chars, async () => ({ ok:false, rateLimited:true, retryAfterMs:0, error:'API 错误 (429)' }));
    const before = Date.now();
    h.context.processWechatMomentQueue();
    await flush();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].background, true);
    assert.equal(h.calls[0].usageFeature, 'moment');
    const tasks = () => Object.fromEntries(h.store().posts[0].pending.map(task => [task.id, task]));
    assert.equal(tasks().tg.done, true);
    assert.equal(tasks().t1.attempts, 1);
    assert.equal(tasks().t1.generating, false);
    assert.ok(tasks().t1.dueAt >= before + 5 * 60000);
    for (let round = 0; round < 4; round++) { h.runTimers(); await flush(); }
    assert.equal(h.calls.length, 3);
    assert.ok(['t1','t2','t3'].every(id => tasks()[id].attempts === 1 && !tasks()[id].done));

    const capped = momentQueueHarness([{ id:'post_a', text:'你好', comments:[], pending:[commentTask('t1','c1',{ attempts:3 })] }], chars, async () => ({ ok:false, error:'API 错误 (500)' }));
    capped.context.processWechatMomentQueue(); await flush();
    assert.equal(capped.store().posts[0].pending[0].done, true);
    assert.equal(capped.store().posts[0].pending[0].failed, true);

    const deferred = momentQueueHarness([{ id:'post_a', text:'你好', comments:[], pending:[commentTask('t1','c1')] }], chars, async () => ({ ok:false, deferred:true, retryAfterMs:120000, error:'等待限流' }));
    const deferredAt = Date.now();
    deferred.context.processWechatMomentQueue(); await flush();
    const task = deferred.store().posts[0].pending[0];
    assert.equal(task.done, false);
    assert.equal(Number(task.attempts || 0), 0);
    assert.ok(task.dueAt >= deferredAt + 120000);

    const post = { id:'post_new', text:'今天怎么办？' };
    h.context.scheduleWechatMomentEngagement(post);
    assert.ok(post.pending.every(item => item.charId !== 'group'));
    assert.equal(post.pending.length, 3);
});

test('character-authored moments are never treated as the user’s own', () => {
    const posts = [{ id:'mom_user', text:'我的旧动态', createdAt:1000 }, { id:'mom_char_1', charId:'c1', userName:'阿林', text:'角色新动态', source:'ai_moment', createdAt:2000 }];
    const anchorContext = vm.createContext({ localStorage:{ getItem:() => JSON.stringify({ posts }) }, WECHAT_MOMENTS_STORAGE_KEY:'moments', formatChatApiDateTime:() => '今天', truncateChatAnchorText:value => String(value), console });
    vm.runInContext(fn(chatApi, 'buildUserMomentsAnchor'), anchorContext);
    const anchor = anchorContext.buildUserMomentsAnchor();
    assert.match(anchor, /我的旧动态/);
    assert.doesNotMatch(anchor, /角色新动态/);

    let store = JSON.parse(JSON.stringify({ posts }));
    const inputs = { 'wc-moment-text':{ value:'用户改写' }, 'wc-moment-visibility-value':{ value:'public' } };
    const publishContext = vm.createContext({ window:{ _wechatEditingMomentId:'mom_char_1', _wechatMomentDraftImages:[] }, document:{ getElementById:id => inputs[id] || null }, getUserProfile:() => ({ name:'我' }), getWechatMomentStore:() => store, saveWechatMomentStore:next => { store = next; }, scheduleWechatMomentEngagement() {}, renderWechatMoments() {}, DEFAULT_AVATAR:'avatar', Date });
    vm.runInContext(fn(wechat, 'publishWechatMoment'), publishContext);
    publishContext.publishWechatMoment();
    const charPost = store.posts.find(post => post.id === 'mom_char_1');
    assert.equal(charPost.text, '角色新动态');
    assert.equal(charPost.userName, '阿林');

    const renderContext = vm.createContext({ quoteWechatJsString:value => JSON.stringify(value), wcEscapeHtml:value => String(value), formatWechatRelativeTime:() => '刚刚', renderWechatMomentMedia:() => '', renderWechatMomentComment:() => '', DEFAULT_AVATAR:'avatar' });
    vm.runInContext(fn(wechat, 'renderWechatMomentPost'), renderContext);
    assert.doesNotMatch(renderContext.renderWechatMomentPost(posts[1]), /editWechatMoment/);
    assert.match(renderContext.renderWechatMomentPost(posts[0]), /editWechatMoment/);

    const page = { innerHTML:'' };
    const meContext = vm.createContext({ wcEscapeHtml:value => String(value), DEFAULT_AVATAR:'avatar', getWechatCssUrl:value => `url(${value})`, getWechatXPeople:() => [], getWechatMomentStore:() => ({ posts }), formatWechatRelativeTime:() => '刚刚', loadWechatXRealtimeNews() {}, Date, Number, Math });
    vm.runInContext(fn(wechat, 'renderXMePage'), meContext);
    meContext.renderXMePage(page, { name:'我' });
    assert.match(page.innerHTML, /我的旧动态/);
    assert.doesNotMatch(page.innerHTML, /角色新动态/);
});

test('the moment store is the single source for character moments, with one-time migration and synced deletes', () => {
    let store = { posts:[{ id:'mom_char_ai', charId:'c1', source:'ai_moment', text:'AI 动态', createdAt:1000 }] };
    const char = { id:'c1', name:'阿林', chatConfig:{ aiMoments:[{ id:'aim_old', text:'旧的设置动态', source:'manual_moment', createdAt:500 }, { id:'mom_char_deleted', text:'已删掉的', source:'ai_moment', createdAt:600 }, { id:'mom_char_ai', text:'AI 动态', source:'ai_moment', createdAt:1000 }] } };
    const fields = { 'wcs-ai-moment-text':{ value:'' }, 'wcs-ai-moment-list':{ innerHTML:'' } };
    const context = vm.createContext({ window:{ myCharacters:[char] }, document:{ getElementById:id => fields[id] || null }, getWechatMomentStore:() => store, saveWechatMomentStore:next => { store = next; }, getCurrentChatChar:() => char, getWechatCharDisplayName:item => item.name, pickWechatCharMomentCover:() => '', saveCharactersToStorage:() => true, wcEscapeHtml:value => String(value), quoteWechatJsString:value => JSON.stringify(value), isWechatMomentsScreenOpen:() => false, renderWechatMoments() {}, confirm:() => true, DEFAULT_AVATAR:'avatar', Date, Math, Number, String, Set, Array });
    ['getWechatCharMoments','buildWechatCharMomentPost','getWechatCharMomentPosts','renderWechatAiMomentsEditor','addWechatAiMomentFromSettings','deleteWechatAiMoment','deleteWechatMoment'].forEach(name => vm.runInContext(fn(wechat, name), context));
    const moments = context.getWechatCharMoments(char);
    assert.deepEqual(moments.map(item => item.id), ['mom_char_ai', 'aim_old']);
    assert.equal(store.posts.find(post => post.id === 'aim_old').charId, 'c1');
    assert.ok(!store.posts.some(post => post.id === 'mom_char_deleted'));
    assert.equal(char.chatConfig.aiMomentsMigrated, true);
    context.getWechatCharMoments(char);
    assert.equal(store.posts.filter(post => post.id === 'aim_old').length, 1);

    fields['wcs-ai-moment-text'].value = '设置里写的新动态';
    context.addWechatAiMomentFromSettings();
    const added = store.posts.find(post => post.text === '设置里写的新动态');
    assert.equal(added.charId, 'c1');
    assert.equal(added.source, 'manual_moment');
    assert.equal(char.chatConfig.aiMoments.length, 3);
    assert.match(fields['wcs-ai-moment-list'].innerHTML, /设置里写的新动态/);

    context.deleteWechatAiMoment('aim_old');
    assert.ok(!store.posts.some(post => post.id === 'aim_old'));
    assert.ok(!char.chatConfig.aiMoments.some(item => item.id === 'aim_old'));
    context.deleteWechatMoment('mom_char_ai');
    assert.ok(!store.posts.some(post => post.id === 'mom_char_ai'));
    assert.ok(!char.chatConfig.aiMoments.some(item => item.id === 'mom_char_ai'));
});
