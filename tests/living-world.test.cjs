const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('modules/living-world/living-world.js');

test('Living World has a local canonical store and does not generate feeds per perspective switch', () => {
    assert.match(source, /const STORAGE_KEY = 'bynd_living_world_v1'/);
    assert.match(source, /relationships: \{\}, socialLinks: \[\], knowledge: \{\}, traces: \{\}, events: \[\], notifications: \{\}, views: \{\}/);
    assert.match(source, /function setViewer\(id\).*?next\.viewerId = id/s);
    assert.match(source, /切换只重排本地可见内容，不会重新生成论坛/);
    assert.match(source, /function feed\(\).*?isVisible\(post, world\.viewerId\).*?scorePost/s);
});

test('Living World rejects invalid AI JSON before it can mutate canonical state', () => {
    assert.match(source, /function parseJsonBatch\(content\)/);
    assert.match(source, /function validateBatch\(batch\)/);
    assert.match(source, /const valid = validateBatch\(parseJsonBatch\(result\.content\)\)/);
    assert.match(source, /background: true, backgroundPriority: -1, stream: false/);
    assert.match(source, /catch \(error\) \{ console\.warn\('Living World AI batch rejected'/);
});

test('Living World starts empty and accepts generated content through a validated API batch', () => {
    assert.doesNotMatch(source, /const SEED_(NPCS|POSTS)/);
    assert.doesNotMatch(source, /const COMMUNITIES\s*=/);
    assert.match(source, /migration: \{ apiGenerated: false \}/);
    assert.match(source, /所有内容、社区和 NPC 必须由你生成/);
    assert.match(source, /社区、成员和帖子都会由当前 API 生成/);
    assert.match(source, /next\.migration = \{ \.\.\.next\.migration, apiGenerated: true \}/);
});

test('Living World keeps the mobile header quiet and makes the feed the first-screen subject', () => {
    const css = read('modules/living-world/living-world.css');
    assert.match(source, /class="lw-search-pill"/);
    assert.match(source, /<span>搜索<\/span>/);
    assert.match(source, /\['home','主页'/);
    assert.match(source, /\['create','创建'/);
    assert.match(source, /\['notifications','收件箱'/);
    assert.match(source, /\['profile','你'/);
    assert.match(source, /function renderChat\(\)/);
    assert.match(source, /function shareToCharacterChat\(charId\).*?window\.openApp\('wechat'\).*?window\.openChat\(charId\)/s);
    assert.match(source, /function menuGo\(tab\) \{ menuOpen = false; setTab\(tab\); \}/);
    assert.match(css, /\.lw-topbar \{[^}]*safe-area-inset-top/);
    assert.match(css, /\.lw-nav \{[^}]*safe-area-inset-bottom/);
});

test('perspective switching lives in My and keeps the user on that tab', () => {
    assert.match(source, /class="lw-profile-title" type="button" onclick="LivingWorld.togglePerspective\(true\)"/);
    assert.match(source, /const stayInProfile = activeTab === 'profile'/);
    assert.match(source, /activeTab = stayInProfile \? 'profile' : 'home'/);
    assert.match(source, /activePostId = stayInProfile \? id : ''/);
});

test('My hides a chat character persona from the current-view profile', () => {
    assert.match(source, /const publicSummary = loadState\(\)\.profileEdits\[id\]\?\.summary \|\| who\.summary \|\| \(npc \? npc\.summary \|\| '' : ''\)/);
    assert.match(source, /\$\{publicSummary \? `<p class="lw-profile-summary"/);
});

test('My has functional post, comment, media, and saved tabs', () => {
    assert.match(source, /class="lw-profile-identity"/);
    assert.match(source, /class="lw-profile-section lw-profile-posts"/);
    assert.match(source, /function setProfileTab\(tab\)/);
    assert.match(source, /if \(profileTab === 'media'\)/);
    assert.match(source, /if \(profileTab === 'saved'\)/);
});

test('a profile saved tab belongs to its owner, not the current viewer', async () => {
    const h = forumHarness({ posts: [{ id:'post_friend', authorId:'char:friend', communityId:'lounge', title:'朋友的帖子', body:'内容', bookmarkedBy:['user'], createdAt:Date.now() }] });
    h.fields['living-world-root'] = { innerHTML:'', querySelector:() => null, querySelectorAll:() => [] };
    await h.api.init();
    h.api.openProfile('char:friend');
    h.api.setProfileTab('saved');
    assert.match(h.fields['living-world-root'].innerHTML, /还没有收藏的帖子/);
    assert.doesNotMatch(h.fields['living-world-root'].innerHTML, /朋友的帖子/);
    h.api.openProfile('user');
    h.api.setProfileTab('saved');
    assert.match(h.fields['living-world-root'].innerHTML, /朋友的帖子/);
});

test('forum post search sits immediately beside its menu', () => {
    assert.match(source, /aria-label="搜索本帖评论"[^<]*<i class="ri-search-line"><\/i><\/button><button[^>]*aria-label="帖子菜单"/);
});

test('opening a shared character chat dismisses stale settings overlays', () => {
    const wechat = read('wechat.js');
    assert.match(wechat, /function openChat\(charId\)[\s\S]*?settingsPanel\.classList\.remove\('active'\)[\s\S]*?settingsPanel\.style\.display = 'none'/);
    assert.match(wechat, /function openChat\(charId\)[\s\S]*?featureScreen\.classList\.add\('hidden'\)/);
});

function forumHarness(initial = {}) {
    const key = 'bynd_living_world_v1';
    const values = new Map([[key, JSON.stringify({ communities: [{ id: 'lounge', name: '广场', description: '聊天' }], posts: [{ id: 'post_1', authorId: 'user', communityId: 'lounge', title: '你好', body: '', likes: 0, likedBy: [], createdAt: Date.now() }], viewerId: 'user', ...initial })]]);
    const fields = {};
    const dispatched = [];
    let failSave = false;
    const context = vm.createContext({
        window: { myCharacters: [{ id: 'friend', name: '朋友', avatar: '' }], getUserProfile: () => ({ name: '我' }), dispatchEvent: event => dispatched.push(event.detail) },
        document: { getElementById: id => fields[id] || null, querySelector: selector => fields[selector] || null, createElement: () => { let value = ''; return { set textContent(text) { value = String(text); }, get innerHTML() { return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); } }; } },
        localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => { if (failSave) throw Error('quota'); values.set(key, value); } },
        console: { error() {}, warn() {} }, Date, Math, JSON, Set, Object, String, Number, Array, CustomEvent: class { constructor(_, options) { this.detail = options.detail; } },
        setTimeout, clearTimeout, AbortController, URL, fetch: async () => { throw Error('network unavailable'); }
    });
    vm.runInContext(source, context);
    return { api: context.window.LivingWorld, window: context.window, fields, dispatched, saved: () => JSON.parse(values.get(key)), fail: value => { failSave = value; }, setFetch: fn => { context.fetch = fn; }, setTime: timestamp => { context.Date = class extends Date { static now() { return timestamp; } }; } };
}

test('forum private messages stay in forum storage and failed saves do not claim success', async () => {
    const h = forumHarness();
    await h.api.init();
    h.api.openThread('char:friend');
    h.fields['lw-message-input'] = { value: '私信内容' };
    h.api.sendMessage({ preventDefault() {} });
    assert.equal(h.saved().messages.length, 1);
    assert.equal(h.saved().messages[0].toId, 'char:friend');
    h.fail(true);
    h.fields['lw-message-input'].value = '不能保存';
    h.api.sendMessage({ preventDefault() {} });
    assert.equal(h.saved().messages.length, 1);
});

test('private message AI replies save once, and API failure leaves a retryable sent message', async () => {
    const h = forumHarness();
    await h.api.init();
    h.api.openThread('char:friend');
    h.fields['lw-message-input'] = { value: '你好' };
    h.window.callChatApi = async () => ({ ok: false, error: '接口暂时不可用' });
    h.api.sendMessage({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.saved().messages.length, 1);
    h.window.callChatApi = async () => ({ ok: true, content: '你好，很高兴见到你。' });
    h.api.retryDirectReply();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.saved().messages.length, 2);
    assert.equal(h.saved().messages[1].replyTo, h.saved().messages[0].id);
    h.api.retryDirectReply();
    assert.equal(h.saved().messages.length, 2);
});

test('two quick private messages both receive replies without duplicate requests', async () => {
    const h = forumHarness();
    await h.api.init();
    h.api.openThread('char:friend');
    h.fields['lw-message-input'] = { value: '第一条' };
    let resolveFirst;
    let calls = 0;
    h.window.callChatApi = async () => {
        calls += 1;
        if (calls === 1) return new Promise(resolve => { resolveFirst = resolve; });
        return { ok: true, content: '第二次回复' };
    };
    h.api.sendMessage({ preventDefault() {} });
    h.fields['lw-message-input'].value = '第二条';
    h.api.sendMessage({ preventDefault() {} });
    assert.equal(h.saved().messages.length, 2);
    resolveFirst({ ok: true, content: '第一次回复' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 2);
    assert.equal(h.saved().messages.length, 4);
    assert.equal(new Set(h.saved().messages.filter(item => item.replyTo).map(item => item.replyTo)).size, 2);
});

test('forum votes and title-only posts persist through the same canonical store', async () => {
    const h = forumHarness();
    await h.api.init();
    h.api.vote('post_1', 1);
    assert.equal(h.saved().posts[0].votes.user, 1);
    h.api.vote('post_1', -1);
    assert.equal(h.saved().posts[0].votes.user, -1);
    h.fields['lw-post-title'] = { value: '新帖子' };
    h.fields['lw-post-body'] = { value: '' };
    h.fields['lw-post-community'] = { value: 'lounge' };
    h.api.createPost({ preventDefault() {} });
    assert.equal(h.saved().posts[0].title, '新帖子');
    assert.equal(h.saved().posts[0].body, '');
});

test('post and comment arrows show total voters, while the comment bubble remains a reply count', async () => {
    const h = forumHarness({ comments:[{ id:'comment_1', postId:'post_1', authorId:'char:friend', body:'你好', createdAt:Date.now() }], posts:[{ id:'post_1', authorId:'char:friend', communityId:'lounge', title:'投票', body:'内容', commentCount:1, likes:0, createdAt:Date.now() }] });
    h.fields['living-world-root'] = { innerHTML:'', querySelector:() => null, querySelectorAll:() => [] };
    await h.api.init();
    h.api.openPost('post_1');
    h.api.vote('post_1',-1);
    h.api.voteComment('comment_1',-1);
    const html = h.fields['living-world-root'].innerHTML;
    assert.match(html, /lw-vote-pill[\s\S]*?<b>1<\/b>/);
    assert.match(html, /lw-comment-actions[\s\S]*?<span>1<\/span>/);
    assert.match(html, /ri-chat-3-line"><\/i> 1/);
    h.api.vote('post_1',-1);
    h.api.voteComment('comment_1',-1);
    assert.match(h.fields['living-world-root'].innerHTML, /lw-vote-pill[\s\S]*?<b>0<\/b>/);
});

test('a recent user reply can prompt the post author once and produces a nested response', async () => {
    const fourteenHoursAgo = Date.now() - 14 * 3600000;
    const h = forumHarness({ posts:[{ id:'post_friend', authorId:'char:friend', communityId:'lounge', title:'雨后听茶', body:'今晚下雨了', commentCount:1, createdAt:fourteenHoursAgo - 60000 }], comments:[{ id:'user_reply', postId:'post_friend', authorId:'user', body:'晚安', createdAt:fourteenHoursAgo }], events:[{ id:'reply_event', type:'forum_reply', actorId:'user', targetId:'post_friend', visibility:'public', metadata:{ commentId:'user_reply', excerpt:'晚安' }, createdAt:fourteenHoursAgo }], knowledge:{ 'char:friend':[{ eventId:'reply_event', knownAt:fourteenHoursAgo, kind:'notification' }] } });
    await h.api.init();
    assert.equal(h.saved().interactionQueue.length,1);
    h.fields['app-living-world-window'] = { classList:{ contains:() => false } };
    let prompt = '';
    h.window.callChatApi = async messages => { prompt = messages[1].content; return { ok:true, content:JSON.stringify({ action:'reply', body:'看到你的留言了，愿你今天平安。' }) }; };
    await h.api.maybeRunInteraction();
    assert.match(prompt,/雨后听茶/);
    assert.equal(h.saved().comments.length,2);
    assert.equal(h.saved().comments[1].parentCommentId,'user_reply');
    assert.equal(h.saved().posts[0].commentCount,2);
    assert.equal(h.saved().interactionQueue.length,0);
    assert.ok(h.saved().notifications.user.some(item => item.postId === 'post_friend'));
    await h.api.maybeRunInteraction();
    assert.equal(h.saved().comments.length,2);
});

test('a character may stay silent; an API failure never fabricates a reply', async () => {
    const old = Date.now() - 3600000;
    const base = { posts:[{ id:'post_friend', authorId:'char:friend', communityId:'lounge', title:'夜话', body:'内容', commentCount:1, createdAt:old - 1000 }], comments:[{ id:'user_reply', postId:'post_friend', authorId:'user', body:'你好', createdAt:old }], events:[{ id:'reply_event', type:'forum_reply', actorId:'user', targetId:'post_friend', visibility:'public', metadata:{ commentId:'user_reply' }, createdAt:old }], knowledge:{ 'char:friend':[{ eventId:'reply_event', knownAt:old }] } };
    const silent = forumHarness(base);
    await silent.api.init();
    silent.fields['app-living-world-window'] = { classList:{ contains:() => false } };
    silent.window.callChatApi = async () => ({ ok:true, content:'{"action":"silence"}' });
    await silent.api.maybeRunInteraction();
    assert.equal(silent.saved().comments.length,1);
    assert.ok(silent.saved().interactionHandled.includes('user_reply'));
    const failed = forumHarness(base);
    await failed.api.init();
    failed.fields['app-living-world-window'] = { classList:{ contains:() => false } };
    failed.window.callChatApi = async () => ({ ok:false, error:'offline' });
    await failed.api.maybeRunInteraction();
    assert.equal(failed.saved().comments.length,1);
    assert.equal(failed.saved().interactionQueue[0].attempts,1);
});

test('a fourteen-hour-old goodnight comment cannot receive a present-tense goodnight reply at 09:26', async () => {
    const morning = new Date(2026,8,24,9,26).getTime();
    const commentAt = morning - 14 * 3600000;
    const base = { posts:[{ id:'post_friend', authorId:'char:friend', communityId:'lounge', title:'雨后听茶', body:'各位晚安。', commentCount:1, createdAt:commentAt - 60000 }], comments:[{ id:'user_reply', postId:'post_friend', authorId:'user', body:'晚安', createdAt:commentAt }], events:[{ id:'reply_event', type:'forum_reply', actorId:'user', targetId:'post_friend', visibility:'public', metadata:{ commentId:'user_reply' }, createdAt:commentAt }], knowledge:{ 'char:friend':[{ eventId:'reply_event', knownAt:commentAt }] } };
    const stale = forumHarness(base);
    stale.setTime(morning);
    await stale.api.init();
    stale.fields['app-living-world-window'] = { classList:{ contains:() => false } };
    let prompt = '';
    stale.window.callChatApi = async messages => { prompt = messages[1].content; return { ok:true, content:JSON.stringify({ action:'reply', body:'晚安。怎么还没睡？夜里凉记得盖被子。' }) }; };
    await stale.api.maybeRunInteraction();
    assert.match(prompt,/14 小时 0 分钟/);
    assert.match(prompt,/不能把旧问候当成刚说的/);
    assert.equal(stale.saved().comments.length,1);
    assert.equal(stale.saved().agentDecisions.at(-1).action,'silence');
    const timely = forumHarness(base);
    timely.setTime(morning);
    await timely.api.init();
    timely.fields['app-living-world-window'] = { classList:{ contains:() => false } };
    timely.window.callChatApi = async () => ({ ok:true, content:JSON.stringify({ action:'reply', body:'昨晚没来得及看到，今早才读到。希望你今天顺利。' }) });
    await timely.api.maybeRunInteraction();
    assert.equal(timely.saved().comments.length,2);
    assert.match(timely.saved().comments[1].body,/今早才读到/);
});

test('reply modes migrate the old switch and save a consumer-selected calling mode', async () => {
    const oldOff = forumHarness({ forumSettings:{ replyReactionsEnabled:false } });
    await oldOff.api.init();
    assert.equal(oldOff.saved().forumSettings.replyMode,'off');
    const h = forumHarness();
    await h.api.init();
    assert.equal(h.saved().forumSettings.replyMode,'forum');
    h.fields['lw-refresh-mode'] = { value:'manual' };
    h.fields['lw-refresh-hours'] = { value:'12' };
    h.fields['lw-profile-mode'] = { value:'economy' };
    h.fields['input[name="lw-reply-mode"]:checked'] = { value:'app' };
    h.api.saveForumSettings();
    assert.equal(h.saved().forumSettings.replyMode,'app');
    assert.equal(h.saved().forumSettings.replyReactionsEnabled,true);
    h.fields['input[name="lw-reply-mode"]:checked'].value = 'off';
    h.api.saveForumSettings();
    assert.equal(h.saved().forumSettings.replyMode,'off');
    assert.equal(h.saved().forumSettings.replyReactionsEnabled,false);
});

test('turning automatic replies off cancels pending API work without deleting comments', async () => {
    const h = forumHarness({ comments:[{ id:'comment_pending', postId:'post_1', authorId:'user', body:'留个言', createdAt:Date.now() }], interactionQueue:[{ id:'reaction_pending', actorId:'char:friend', postId:'post_1', commentId:'comment_pending', eventId:'event_pending', dueAt:Date.now() + 60000, attempts:0 }] });
    await h.api.init();
    h.fields['lw-refresh-mode'] = { value:'manual' };
    h.fields['lw-refresh-hours'] = { value:'12' };
    h.fields['lw-profile-mode'] = { value:'economy' };
    h.fields['input[name="lw-reply-mode"]:checked'] = { value:'off' };
    h.api.saveForumSettings();
    assert.equal(h.saved().interactionQueue.length,0);
    assert.ok(h.saved().interactionHandled.includes('comment_pending'));
    assert.equal(h.saved().comments.length,1);
});

test('app reply mode considers a due comment outside the forum; forum and off modes do not', async () => {
    const old = Date.now() - 3600000;
    const base = { posts:[{ id:'post_friend', authorId:'char:friend', communityId:'lounge', title:'夜话', body:'内容', commentCount:1, createdAt:old - 1000 }], comments:[{ id:'user_reply', postId:'post_friend', authorId:'user', body:'你好', createdAt:old }], events:[{ id:'reply_event', type:'forum_reply', actorId:'user', targetId:'post_friend', visibility:'public', metadata:{ commentId:'user_reply' }, createdAt:old }], knowledge:{ 'char:friend':[{ eventId:'reply_event', knownAt:old }] } };
    const forum = forumHarness({ ...base, forumSettings:{ replyMode:'forum' } });
    await forum.api.init();
    forum.fields['app-living-world-window'] = { classList:{ contains:() => true } };
    let calls = 0;
    forum.window.callChatApi = async () => { calls += 1; return { ok:true, content:'{"action":"silence"}' }; };
    await forum.api.maybeRunInteraction();
    assert.equal(calls,0);
    const app = forumHarness({ ...base, forumSettings:{ replyMode:'app' } });
    await app.api.init();
    app.fields['app-living-world-window'] = { classList:{ contains:() => true } };
    app.window.callChatApi = async () => { calls += 1; return { ok:true, content:'{"action":"reply","body":"我看见你的留言了。"}' }; };
    await app.api.maybeRunInteraction();
    assert.equal(calls,1);
    assert.equal(app.saved().comments.length,2);
    const off = forumHarness({ ...base, forumSettings:{ replyMode:'off' } });
    await off.api.init();
    off.fields['app-living-world-window'] = { classList:{ contains:() => false } };
    off.window.callChatApi = async () => { calls += 1; return { ok:true, content:'{"action":"reply","body":"不会调用"}' }; };
    await off.api.maybeRunInteraction();
    assert.equal(calls,1);
    assert.equal(off.saved().interactionQueue.length,0);
});

test('forum profile edits save independently and failed saves keep the editor open', async () => {
    const h = forumHarness();
    await h.api.init();
    h.api.setTab('profile');
    h.fields['lw-profile-name'] = { value: '论坛昵称' };
    h.fields['lw-profile-summary'] = { value: '新简介' };
    h.fields['lw-profile-avatar-url'] = { value: '' };
    h.api.saveProfile({ preventDefault() {} });
    assert.equal(h.saved().profileEdits.user.name, '论坛昵称');
    assert.equal(h.saved().profileEdits.user.summary, '新简介');
    h.fail(true);
    h.fields['lw-profile-name'].value = '未保存';
    h.api.saveProfile({ preventDefault() {} });
    assert.equal(h.saved().profileEdits.user.name, '论坛昵称');
});

test('poll votes can change and a failed post save leaves the previous feed intact', async () => {
    const h = forumHarness();
    await h.api.init();
    h.fields['lw-post-title'] = { value: '喜欢哪个选项？' };
    h.fields['lw-post-body'] = { value: '' };
    h.fields['lw-post-community'] = { value: 'lounge' };
    h.fields['lw-poll-fields'] = { hidden: false, querySelectorAll: () => [{ value: '甲' }, { value: '乙' }] };
    h.api.createPost({ preventDefault() {} });
    const post = h.saved().posts[0];
    assert.equal(post.poll.options.length, 2);
    h.api.votePoll(post.id, post.poll.options[0].id);
    h.api.votePoll(post.id, post.poll.options[1].id);
    assert.deepEqual(h.saved().posts[0].poll.options.map(item => item.voters.length), [0, 1]);
    h.fail(true);
    h.fields['lw-post-title'].value = '不能保存';
    h.api.createPost({ preventDefault() {} });
    assert.equal(h.saved().posts.length, 2);
});

test('Living World records asymmetric relationships, source-validated knowledge, and account traces', () => {
    assert.match(source, /function applyRelationshipDelta\(next, fromId, toId, deltas, reasonEventId\)/);
    assert.match(source, /function grantKnowledge\(next, recipientId, event, sourceId/);
    assert.match(source, /function recordTrace\(next, charId, action, risk/);
    assert.match(source, /forum_access_detected/);
    assert.match(source, /function recordForumAction\(next, type, apparentActorId/);
    assert.match(source, /const knownIds = new Set\(safeList\(world\.knowledge\[charId\]\)/);
});

test('Living World can promote a sufficiently known generated NPC into a saved contact', () => {
    assert.match(source, /function canPromoteNpc\(npc\)/);
    assert.match(source, /async function promoteNpc\(npcId\)/);
    assert.match(source, /await window\.saveCharactersToStorage\(\)/);
    assert.match(source, /target\.contactCharId = contactId/);
    assert.match(source, /promoteNpc/);
});

test('Living World is an app, uses safe areas, and is included in backup state', () => {
    const html = read('index.html');
    const css = read('modules/living-world/living-world.css');
    const settings = read('settings.js');
    assert.match(html, /data-app-id="living-world"/);
    assert.match(html, /id="app-living-world-window"/);
    assert.match(css, /safe-area-inset-top/);
    assert.match(css, /safe-area-inset-bottom/);
    assert.match(settings, /'bynd_living_world_v1'/);
});

test('private chat becomes a party-scoped world event only after persistence', async () => {
    const h = forumHarness();
    await h.api.init();
    const char = h.window.myCharacters[0];
    assert.equal(h.api.recordPrivateChatMessage(char, { isMe: true, content: '只告诉你的秘密', timestamp: 1234 }), true);
    const event = h.saved().events.find(item => item.type === 'private_chat');
    assert.equal(event.visibility, 'private');
    assert.deepEqual(event.metadata.privateTo, ['char:friend', 'user']);
    assert.ok(h.saved().knowledge['char:friend'].some(item => item.eventId === event.id));
    assert.equal(h.api.recordPrivateChatMessage(char, { isMe: true, content: '只告诉你的秘密', timestamp: 1234 }), false);
    h.fail(true);
    assert.throws(() => h.api.recordPrivateChatMessage(char, { isMe: true, content: '未保存的话', timestamp: 5678 }), /保存失败/);
    assert.equal(h.saved().events.filter(item => item.type === 'private_chat').length, 1);
    assert.equal(h.dispatched.filter(item => item.type === 'private_chat').length, 1);
});

test('batch prompt excludes private chats and rejects invalid references atomically', async () => {
    const h = forumHarness();
    await h.api.init();
    h.api.recordPrivateChatMessage(h.window.myCharacters[0], { isMe: true, content: '不能泄露的私聊文本', timestamp: 12 });
    let prompt = '';
    h.window.callChatApi = async messages => {
        prompt = messages.at(-1).content;
        return { ok: true, content: JSON.stringify({ newNPCs: [{ id: 'npc_ivy', name: '艾薇', summary: '摄影爱好者', originCharId: 'friend' }], newPosts: [{ authorId: 'user', communityId: 'lounge', title: '冒充用户', body: '不允许' }] }) };
    };
    const before = h.saved();
    await h.api.generate();
    assert.doesNotMatch(prompt, /不能泄露的私聊文本|private_chat/);
    assert.equal(h.saved().npcs.length, before.npcs.length);
    assert.equal(h.saved().posts.length, before.posts.length);
    h.window.callChatApi = async () => ({ ok: true, content: JSON.stringify({ newNPCs: [{ id: 'npc_ivy', name: '艾薇', summary: '摄影爱好者', style: '简短平实', originCharId: 'friend' }], newPosts: [{ authorId: 'npc_ivy', communityId: 'lounge', title: '拍到了雨后的街', body: '今天光线很好。' }] }) });
    await h.api.generate();
    assert.equal(h.saved().npcs[0].id, 'npc_ivy');
    assert.equal(h.saved().posts[0].authorId, 'npc_ivy');
});

test('an NPC needs user interaction for contact promotion and retains one forum identity', async () => {
    const h = forumHarness({
        npcs: [{ id: 'npc_ivy', type: 'npc', name: '艾薇', summary: '摄影爱好者', tier: 'ephemeral' }],
        messages: [1, 2, 3, 4].map(index => ({ id: `dm_${index}`, fromId: 'user', toId: 'npc_ivy', body: `你好 ${index}`, createdAt: Date.now() }))
    });
    h.window.saveCharactersToStorage = async () => true;
    await h.api.init();
    assert.equal(h.saved().npcs[0].tier, 'persistent');
    await h.api.promoteNpc('npc_ivy');
    assert.equal(h.saved().npcs[0].contactCharId, 'living_world_npc_ivy');
    assert.equal(h.saved().accounts.npc_ivy.type, 'char');
    assert.equal(h.saved().accounts['char:living_world_npc_ivy'], undefined);
});

test('known forum events keep a readable trace after deleting their original post', async () => {
    const h = forumHarness({
        posts: [{ id: 'post_char', authorId: 'char:friend', communityId: 'lounge', title: '这件事发生过', body: '某个重要的约定', createdAt: Date.now() }],
        events: [{ id: 'event_char', type: 'forum_post', actorId: 'char:friend', targetId: 'post_char', metadata: { title: '这件事发生过', excerpt: '某个重要的约定' }, visibility: 'public', createdAt: Date.now() }],
        knowledge: { 'char:friend': [{ eventId: 'event_char', sourceId: 'char:friend', kind: 'authored', knownAt: Date.now() }] }
    });
    await h.api.init();
    h.api.setViewer('char:friend');
    h.window.confirm = () => true;
    h.api.deletePost('post_char');
    assert.equal(!!h.saved().posts.find(item => item.id === 'post_char')?.deletedAt, true);
    assert.match(h.api.getRelevantEventsForChar(h.window.myCharacters[0], 5), /这件事发生过/);
});

test('blocking a member survives account refresh and hides their feed', async () => {
    const h = forumHarness({ posts: [{ id: 'post_friend', authorId: 'char:friend', communityId: 'lounge', title: '不再可见', body: '内容', createdAt: Date.now() }] });
    await h.api.init();
    h.api.toggleBlock('char:friend');
    assert.deepEqual(h.saved().accounts.user.blocked, ['char:friend']);
    await h.api.init();
    assert.deepEqual(h.saved().accounts.user.blocked, ['char:friend']);
    h.api.openPost('post_friend');
    assert.ok(!h.saved().views.user?.includes('post_friend'));
    h.api.toggleBlock('char:friend');
    assert.deepEqual(h.saved().accounts.user.blocked, []);
});

test('WeChat status and memory extraction consume only character-scoped forum context', () => {
    const wechat = read('wechat.js');
    const chatApi = read('chat-api.js');
    assert.match(chatApi, /window\.getLivingWorldRelevantEventsForChar\(char, 4\)/);
    assert.match(wechat, /window\.getLivingWorldRelevantEventsForChar\(char, 3\)/);
    assert.match(wechat, /window\.getLivingWorldMemoryCandidatesForChar\(char, bucket\.meta\?\.lastExtractedAt \|\| 0\)/);
    assert.match(wechat, /saved !== false && !char\.isGroupChat && window\.LivingWorld\?\.recordPrivateChatMessage/);
});

test('a DM sent through a character perspective is recorded as impersonation, not that character knowledge', async () => {
    const h = forumHarness({ npcs: [{ id: 'npc_ivy', type: 'npc', name: '艾薇', summary: '摄影爱好者' }] });
    await h.api.init();
    h.api.setViewer('char:friend');
    h.api.openThread('npc_ivy');
    h.fields['lw-message-input'] = { value: '借用身份发的私信' };
    h.window.callChatApi = async () => ({ ok: false, error: '暂不回复' });
    h.api.sendMessage({ preventDefault() {} });
    const world = h.saved();
    const sentEvent = world.events.find(item => item.type === 'forum_dm');
    assert.ok(sentEvent);
    assert.equal(world.knowledge['char:friend']?.some(item => item.eventId === sentEvent.id) || false, false);
    assert.ok(world.knowledge.npc_ivy.some(item => item.eventId === sentEvent.id));
    assert.ok(world.events.some(item => item.type === 'forum_impersonation' && item.metadata.action === 'forum_dm'));
});

test('forum refresh is manual by default and settings persist validated cost controls', async () => {
    const h = forumHarness();
    await h.api.init();
    assert.equal(h.saved().forumSettings.refreshMode, 'manual');
    assert.equal(h.saved().forumSettings.profileMode, 'economy');
    h.fields['lw-refresh-mode'] = { value: 'smart' };
    h.fields['lw-refresh-hours'] = { value: '6' };
    h.fields['lw-profile-mode'] = { value: 'full' };
    h.api.saveForumSettings();
    assert.equal(h.saved().forumSettings.refreshMode, 'smart');
    assert.equal(h.saved().forumSettings.intervalHours, 6);
    assert.ok(h.saved().forumSettings.nextSmartAt > Date.now());
    h.fields['lw-refresh-mode'].value = 'invalid';
    h.api.saveForumSettings();
    assert.equal(h.saved().forumSettings.refreshMode, 'smart');
});

test('AI profile changes and author deletion preserve a visible tombstone and canonical events', async () => {
    const h = forumHarness({
        npcs: [{ id: 'npc_ivy', type: 'npc', name: '艾薇', summary: '原签名' }],
        posts: [{ id: 'post_ivy', authorId: 'npc_ivy', communityId: 'lounge', title: '旧帖子', body: '原内容', generated: true, createdAt: Date.now() }]
    });
    await h.api.init();
    h.window.callChatApi = async () => ({ ok: true, content: JSON.stringify({
        profileUpdates: [{ id: 'npc_ivy', name: '夜雨', username: '@night_rain', summary: '今天想安静一会儿', mood: '低落', avatarPrompt: '雨夜的头像' }],
        deletePosts: [{ postId: 'post_ivy', authorId: 'npc_ivy' }]
    }) });
    await h.api.generate();
    const world = h.saved();
    assert.equal(world.npcs[0].name, '夜雨');
    assert.equal(world.npcs[0].mood, '低落');
    assert.ok(world.posts[0].deletedAt);
    assert.ok(world.events.some(event => event.type === 'forum_delete' && event.targetId === 'post_ivy'));
    assert.equal(world.profilePrompts.npc_ivy, '雨夜的头像');
    assert.equal(world.npcs[0].generatedAvatar, undefined);
});

test('unsupported AI relationship claims reject the entire batch without manufacturing social knowledge', async () => {
    const h = forumHarness({ npcs: [{ id: 'npc_ivy', type: 'npc', name: '艾薇', summary: '摄影' }, { id: 'npc_c', type: 'npc', name: '小陈', summary: '同学' }] });
    await h.api.init();
    h.window.callChatApi = async () => ({ ok: true, content: JSON.stringify({ socialLinks: [{ fromId: 'npc_ivy', toId: 'npc_c', kind: 'met', sourceEventId: 'made_up' }] }) });
    await h.api.generate();
    assert.equal(h.saved().socialLinks.length, 0);
    assert.equal(h.saved().lastSimulatedAt, 0);
});

test('relationship projection hides directed edges without viewer evidence', async () => {
    const event = { id: 'event_known', type: 'forum_reply', actorId: 'char:friend', targetId: 'post_1', visibility: 'public', createdAt: Date.now() };
    const h = forumHarness({
        npcs: [{ id: 'npc_ivy', type: 'npc', name: '艾薇' }, { id: 'npc_c', type: 'npc', name: '小陈' }],
        events: [event],
        socialLinks: [
            { fromId: 'char:friend', toId: 'npc_ivy', kind: 'met', sourceEventId: 'event_known' },
            { fromId: 'npc_ivy', toId: 'npc_c', kind: 'heard', sourceEventId: 'event_unknown' }
        ],
        knowledge: { user: [{ eventId: 'event_known', sourceId: 'char:friend', kind: 'read' }] }
    });
    await h.api.init();
    assert.deepEqual(Array.from(h.api.getVisibleSocialLinks(), link => `${link.fromId}>${link.toId}`), ['char:friend>npc_ivy']);
    h.api.setViewer('char:friend');
    assert.deepEqual(Array.from(h.api.getVisibleSocialLinks(), link => `${link.fromId}>${link.toId}`), ['char:friend>npc_ivy']);
});

test('relationship graph keeps full names and a one-way follow on its directed edge', async () => {
    const followedAt = Date.now() - 3600000;
    const h = forumHarness({ npcs:[{ id:'npc_wen', name:'温今北', type:'npc' }], follows:{ user:['npc_wen'] }, events:[{ id:'follow_event', type:'forum_follow', actorId:'user', targetId:'npc_wen', visibility:'public', createdAt:followedAt }], knowledge:{ user:[{ eventId:'follow_event', knownAt:followedAt }] } });
    h.window.getUserProfile = () => ({ name:'上官落' });
    h.fields['living-world-root'] = { innerHTML:'', querySelector:() => null, querySelectorAll:() => [] };
    await h.api.init();
    h.api.setTab('relationships');
    const pair = h.api.getRelationshipGraph()[0];
    assert.equal(pair.records[0].fromId,'user');
    assert.equal(pair.records[0].toId,'npc_wen');
    assert.equal(Number(pair.forward) + Number(pair.backward),1);
    assert.match(h.fields['living-world-root'].innerHTML, /class="lw-relation-name"[^>]*>上官落<\/text>/);
    assert.match(h.fields['living-world-root'].innerHTML, /class="lw-relation-name"[^>]*>温今北<\/text>/);
    assert.match(h.fields['living-world-root'].innerHTML, /关注/);
    assert.doesNotMatch(h.fields['living-world-root'].innerHTML, /双向已知/);
});

test('mutual evidenced links render two arrowheads and open a grounded relationship card', async () => {
    const firstAt = Date.now() - 2 * 3600000;
    const secondAt = Date.now() - 10 * 60000;
    const h = forumHarness({ npcs:[{ id:'npc_wen', name:'温今北', type:'npc' }], events:[{ id:'event_a', type:'forum_reply', actorId:'user', targetId:'post_1', visibility:'public', createdAt:firstAt },{ id:'event_b', type:'forum_reply', actorId:'npc_wen', targetId:'post_1', visibility:'public', createdAt:secondAt }], socialLinks:[{ fromId:'user', toId:'npc_wen', kind:'met', sourceEventId:'event_a' },{ fromId:'npc_wen', toId:'user', kind:'met', sourceEventId:'event_b' }], knowledge:{ user:[{ eventId:'event_a' },{ eventId:'event_b' }], npc_wen:[{ eventId:'event_a' },{ eventId:'event_b' }] }, relationships:{ 'user>npc_wen':{ familiarity:7, trust:2, history:[{ eventId:'event_a', changedAt:firstAt }] }, 'npc_wen>user':{ familiarity:2, guardedness:6, history:[{ eventId:'event_b', changedAt:secondAt }] } } });
    h.window.getUserProfile = () => ({ name:'上官落' });
    h.fields['living-world-root'] = { innerHTML:'', querySelector:() => null, querySelectorAll:() => [] };
    await h.api.init();
    h.api.setTab('relationships');
    const pair = h.api.getRelationshipGraph().find(row => row.a === 'npc_wen' && row.b === 'user');
    assert.equal(pair.forward,true);
    assert.equal(pair.backward,true);
    assert.match(h.fields['living-world-root'].innerHTML, /marker-start="url\(#lw-arrowhead\)"/);
    assert.match(h.fields['living-world-root'].innerHTML, /marker-end="url\(#lw-arrowhead\)"/);
    h.api.openRelation('user','npc_wen');
    const card = h.fields['living-world-root'].innerHTML;
    assert.match(card,/双向已知/);
    assert.match(card,/共同事件<\/small><b>2<\/b>/);
    assert.doesNotMatch(card,/印象：熟悉|印象：有过接触/);
    assert.match(card,/印象（推测）：/);
    h.api.back();
    assert.doesNotMatch(h.fields['living-world-root'].innerHTML, /class="lw-relation-card"/);
});

test('relationship impressions use each persona and visible evidence instead of numeric familiarity labels', async () => {
    const h = forumHarness({ npcs:[{ id:'npc_wen', name:'温今北', type:'npc', style:'谨慎克制' }], events:[{ id:'event_a', type:'forum_reply', actorId:'user', targetId:'post_1', visibility:'public', createdAt:Date.now() }], socialLinks:[{ fromId:'user', toId:'npc_wen', kind:'met', sourceEventId:'event_a' },{ fromId:'npc_wen', toId:'user', kind:'met', sourceEventId:'event_a' }], knowledge:{ user:[{ eventId:'event_a' }], npc_wen:[{ eventId:'event_a' }] }, relationships:{ 'user>npc_wen':{ familiarity:12 }, 'npc_wen>user':{ familiarity:12 } } });
    let prompt = '';
    h.window.callChatApi = async messages => { prompt = messages[1].content; return { ok:true, content:JSON.stringify({ aToB:'对此人保持礼貌，但尚未形成明确判断', bToA:'觉得对方的留言值得再看一眼，仍保持距离' }) }; };
    h.fields['living-world-root'] = { innerHTML:'', querySelector:() => null, querySelectorAll:() => [] };
    await h.api.init();
    h.api.setTab('relationships');
    h.api.openRelation('user','npc_wen');
    await new Promise(resolve => setTimeout(resolve,0));
    assert.match(prompt,/谨慎克制/);
    assert.match(prompt,/event_a|认识/);
    assert.match(h.fields['living-world-root'].innerHTML,/对此人保持礼貌，但尚未形成明确判断/);
    assert.match(h.fields['living-world-root'].innerHTML,/觉得对方的留言值得再看一眼，仍保持距离/);
    assert.doesNotMatch(h.fields['living-world-root'].innerHTML,/印象（推测）：熟悉/);
});

test('relationship impression API failure never turns a familiarity score into a claimed feeling', async () => {
    const h = forumHarness({ npcs:[{ id:'npc_wen', name:'温今北' }], events:[{ id:'met', type:'forum_reply', actorId:'user', targetId:'post_1', visibility:'public', createdAt:Date.now() }], socialLinks:[{ fromId:'user', toId:'npc_wen', kind:'met', sourceEventId:'met' }], knowledge:{ user:[{ eventId:'met' }] }, relationships:{ 'user>npc_wen':{ familiarity:50, trust:50 } } });
    h.window.callChatApi = async () => ({ ok:false, error:'offline' });
    h.fields['living-world-root'] = { innerHTML:'', querySelector:() => null, querySelectorAll:() => [] };
    await h.api.init();
    h.api.setTab('relationships');
    h.api.openRelation('user','npc_wen');
    await new Promise(resolve => setTimeout(resolve,0));
    assert.match(h.fields['living-world-root'].innerHTML,/暂时无法生成人设印象/);
    assert.match(h.fields['living-world-root'].innerHTML,/重新整理印象/);
    assert.doesNotMatch(h.fields['living-world-root'].innerHTML,/印象（推测）：熟悉|印象（推测）：信任/);
});

test('full-profile image failures keep AI text but never save a fake avatar; next real image can persist', async () => {
    const h = forumHarness({ npcs: [{ id: 'npc_ivy', type: 'npc', name: '艾薇', summary: '原签名' }] });
    await h.api.init();
    h.fields['lw-refresh-mode'] = { value: 'manual' };
    h.fields['lw-refresh-hours'] = { value: '12' };
    h.fields['lw-profile-mode'] = { value: 'full' };
    h.api.saveForumSettings();
    let images = 0;
    h.window.callWechatImageGenerationApi = async () => { images++; return { ok: false, error: '图像服务不可用' }; };
    h.window.callChatApi = async () => ({ ok: true, content: JSON.stringify({ profileUpdates: [{ id: 'npc_ivy', name: '雨夜', username: '@rain_ivy', summary: '心情不太好', avatarPrompt: '雨夜的画面' }] }) });
    await h.api.generate();
    assert.equal(h.saved().npcs[0].summary, '心情不太好');
    assert.equal(h.saved().npcs[0].generatedAvatar, undefined);
    assert.equal(images, 1);
    h.window.callWechatImageGenerationApi = async () => { images++; return { ok: true, url: 'https://example.test/new-avatar.png' }; };
    h.window.callChatApi = async () => ({ ok: true, content: JSON.stringify({ profileUpdates: [{ id: 'npc_ivy', name: '天晴', username: '@sun_ivy', summary: '好多了', avatarPrompt: '晴天的画面' }] }) });
    await h.api.generate();
    assert.equal(h.saved().npcs[0].generatedAvatar, 'https://example.test/new-avatar.png');
    assert.equal(images, 2);
});

test('scheduled interval failures record an attempt and do not immediately consume another API call', async () => {
    const initial = { migration: { apiGenerated: true }, lastSimulatedAt: Date.now() - 2 * 86400000, forumSettings: { refreshMode: 'interval', intervalHours: 3, profileMode: 'economy', lastAttemptAt: 0 } };
    const h = forumHarness(initial);
    let calls = 0;
    h.window.callChatApi = async () => { calls++; return { ok: false, error: '暂时不可用' }; };
    await h.api.init();
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(calls, 1);
    assert.ok(h.saved().forumSettings.lastAttemptAt > 0);
    assert.equal(h.saved().lastSimulatedAt, initial.lastSimulatedAt);
    const reopened = forumHarness(h.saved());
    reopened.window.callChatApi = async () => { calls++; return { ok: false, error: '暂时不可用' }; };
    await reopened.api.init();
    assert.equal(calls, 1);
});

test('replying to a comment preserves its parent and a failed save does not add a ghost reply', async () => {
    const h = forumHarness({ comments: [{ id: 'parent_1', postId: 'post_1', authorId: 'char:friend', body: '第一层', createdAt: Date.now() }] });
    await h.api.init();
    h.api.openPost('post_1');
    h.api.replyToComment('parent_1');
    h.fields['lw-reply'] = { value: '第二层' };
    h.api.reply({ preventDefault() {} }, 'post_1');
    assert.equal(h.saved().comments.at(-1).parentCommentId, 'parent_1');
    assert.equal(h.saved().posts[0].commentCount, 1);
    h.fail(true);
    h.fields['lw-reply'].value = '不能保存';
    h.api.reply({ preventDefault() {} }, 'post_1');
    assert.equal(h.saved().comments.length, 2);
});

test('real news comments stay in BYND, and sharing a news item fills a forum DM draft', async () => {
    const news = { id: 'news_1', title: '真实新闻标题', url: 'https://example.org/story', source: 'example.org', provider: 'GDELT', publishedAt: Date.now() };
    const h = forumHarness({ newsItems: [news], newsFetchedAt: Date.now() });
    await h.api.init();
    h.api.openNews('news_1');
    h.fields['lw-news-comment'] = { value: '在论坛里的看法' };
    h.api.commentNews({ preventDefault() {} });
    assert.equal(h.saved().newsComments[0].body, '在论坛里的看法');
    assert.ok(h.saved().events.some(event => event.type === 'forum_news_reply'));
    h.api.shareNews('news_1');
    h.fields['lw-message-input'] = { value: '', focus() {} };
    h.api.shareToForumDm('char:friend');
    assert.match(h.fields['lw-message-input'].value, /真实新闻标题/);
    assert.equal(h.saved().messages.length, 0);
});

test('Hacker News articles fetch a real source excerpt and retain failure state when unavailable', async () => {
    const news = { id:'news_hn', title:'Source story', url:'https://example.org/story', source:'Hacker News', provider:'Hacker News', publishedAt:Date.now() };
    const h = forumHarness({ newsItems:[news], newsFetchedAt:Date.now() });
    const requested = [];
    h.setFetch(async (url, options) => {
        requested.push({ url, accept:options.headers.Accept });
        return { ok:true, json:async () => ({ data:{ content:'A verified excerpt from the original story.' } }) };
    });
    await h.api.init();
    h.api.openNews('news_hn');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(requested[0].url, 'https://r.jina.ai/https://example.org/story');
    assert.equal(requested[0].accept, 'application/json');
    assert.equal(h.saved().newsItems[0].content, 'A verified excerpt from the original story.');

    const failed = forumHarness({ newsItems:[news], newsFetchedAt:Date.now() });
    failed.setFetch(async () => { throw Error('network unavailable'); });
    await failed.api.init();
    failed.api.openNews('news_hn');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(failed.saved().newsItems[0].content, undefined);
});

test('AI public profiles can change social nickname and follower count without inventing follower edges', async () => {
    const h = forumHarness({ npcs:[{ id:'npc_ivy', type:'npc', name:'艾薇', username:'@ivy', summary:'摄影' }], follows:{ user:['npc_ivy'] } });
    h.fields['living-world-root'] = { innerHTML:'', querySelector:() => null, querySelectorAll:() => [] };
    await h.api.init();
    h.window.callChatApi = async () => ({ ok:true, content:JSON.stringify({ profileUpdates:[{ id:'npc_ivy', name:'夜雨', username:'@night_ivy', summary:'在雨里走走', followerCount:8 }] }) });
    await h.api.generate();
    assert.equal(h.saved().npcs[0].username, '@night_ivy');
    assert.equal(h.saved().npcs[0].followerCount, 8);
    assert.deepEqual(Array.from(h.saved().follows.user), ['npc_ivy']);
    h.api.openProfile('npc_ivy');
    assert.match(h.fields['living-world-root'].innerHTML, /@night_ivy · 8 位粉丝/);
});

test('AI cannot report fewer followers than the known follow relationships', async () => {
    const h = forumHarness({ npcs:[{ id:'npc_ivy', type:'npc', name:'艾薇', summary:'摄影' }], follows:{ user:['npc_ivy'] } });
    await h.api.init();
    h.window.callChatApi = async () => ({ ok:true, content:JSON.stringify({ profileUpdates:[{ id:'npc_ivy', name:'夜雨', username:'@night_ivy', summary:'雨中', followerCount:0 }] }) });
    await h.api.generate();
    assert.equal(h.saved().npcs[0].name, '艾薇');
    assert.equal(h.saved().lastSimulatedAt, 0);
});

test('AI-generated promotions use community targeting and can be switched off without deleting history', async () => {
    const h = forumHarness();
    await h.api.init();
    h.window.callChatApi = async () => ({ ok: true, content: JSON.stringify({ newPromotions: [{ sponsor:'世界内诊所', headline:'梦境咨询', body:'一段推广文案', detail:'点击了解这个社区里的咨询', cta:'了解详情', targetCommunityIds:['lounge'], privateFor:'user' }] }) });
    await h.api.generate();
    assert.equal(h.saved().promotions.length, 1);
    assert.equal(h.saved().promotions[0].privateFor, 'user');
    h.fields['lw-refresh-mode'] = { value:'manual' };
    h.fields['lw-refresh-hours'] = { value:'12' };
    h.fields['lw-profile-mode'] = { value:'economy' };
    h.fields['lw-promotion-enabled'] = { value:'no' };
    h.fields['lw-promotion-min'] = { value:'8' };
    h.fields['lw-promotion-max'] = { value:'15' };
    h.api.saveForumSettings();
    assert.equal(h.saved().forumSettings.promotionsEnabled, false);
    assert.equal(h.saved().promotions.length, 1);
});

test('a character can edit its public @handle without changing the user profile', async () => {
    const h = forumHarness();
    await h.api.init();
    h.api.setViewer('char:friend');
    h.api.openProfile('char:friend');
    h.fields['lw-profile-name'] = { value:'朋友' };
    h.fields['lw-profile-username'] = { value:'@new_friend' };
    h.fields['lw-profile-summary'] = { value:'新的公开签名' };
    h.api.saveProfile({ preventDefault() {} });
    assert.equal(h.saved().profileEdits['char:friend'].username, '@new_friend');
    assert.equal(h.saved().profileEdits.user, undefined);
    h.fail(true);
    h.fields['lw-profile-username'].value = '@another_name';
    h.api.saveProfile({ preventDefault() {} });
    assert.equal(h.saved().profileEdits['char:friend'].username, '@new_friend');
});

test('news fetch persists verified URLs, falls back to Hacker News, and keeps old data on failure', async () => {
    const h = forumHarness();
    await h.api.init();
    h.setFetch(async url => {
        if (url.includes('gdeltproject')) return { ok:false, status:429 };
        if (url.endsWith('/topstories.json')) return { ok:true, json:async () => [123] };
        return { ok:true, json:async () => ({ id:123, type:'story', title:'一个公开资讯', url:'https://example.org/story', time:Math.floor(Date.now()/1000) }) };
    });
    await h.api.fetchRealNews();
    assert.equal(h.saved().newsItems.length, 1);
    assert.equal(h.saved().newsItems[0].provider, 'Hacker News');
    const reopened = forumHarness({ ...h.saved(), newsFetchedAt:0 });
    await reopened.api.init();
    reopened.setFetch(async () => { throw Error('offline'); });
    await reopened.api.fetchRealNews();
    assert.equal(reopened.saved().newsItems.length, 1);
});

test('AMA persists a bounded lifespan and refuses interactions after expiry', async () => {
    const h = forumHarness();
    await h.api.init();
    h.fields['lw-post-title'] = { value:'限时问答' };
    h.fields['lw-post-body'] = { value:'来聊聊' };
    h.fields['lw-post-community'] = { value:'lounge' };
    h.fields['lw-ama-button'] = { classList:{ contains:() => true } };
    h.fields['lw-ama-duration'] = { value:'4' };
    h.fields['lw-ama-start-mode'] = { value:'now' };
    h.api.createPost({ preventDefault() {} });
    const post = h.saved().posts[0];
    assert.equal(post.ama, true);
    assert.equal(post.expiresAt - post.amaStartsAt, 4 * 3600000);
    const expired = forumHarness({ posts:[{ ...post, expiresAt:Date.now()-1 }] });
    await expired.api.init();
    expired.api.vote(post.id, 1);
    assert.equal(expired.saved().posts[0].votes?.user, undefined);
});

test('AMA uses an in-app option sheet without resetting form values', async () => {
    const h = forumHarness();
    await h.api.init();
    h.fields['lw-ama-picker'] = { hidden:true, dataset:{}, innerHTML:'' };
    h.fields['lw-ama-start-mode'] = { value:'now' };
    h.fields['lw-ama-start-label'] = { textContent:'立即开始' };
    h.fields['lw-ama-start-at'] = { hidden:true, value:'' };
    h.fields['lw-ama-duration'] = { value:'4' };
    h.fields['lw-ama-duration-label'] = { textContent:'4 小时' };
    h.fields['lw-post-title'] = { value:'正在写的标题' };
    h.api.openAmaPicker('duration');
    assert.equal(h.fields['lw-ama-picker'].hidden, false);
    assert.match(h.fields['lw-ama-picker'].innerHTML, /12 小时/);
    h.api.selectAmaOption('12');
    assert.equal(h.fields['lw-ama-duration'].value, '12');
    assert.equal(h.fields['lw-ama-duration-label'].textContent, '12 小时');
    assert.equal(h.fields['lw-ama-picker'].hidden, true);
    h.api.openAmaPicker('start');
    h.api.selectAmaOption('later');
    assert.equal(h.fields['lw-ama-start-mode'].value, 'later');
    assert.equal(h.fields['lw-ama-start-at'].hidden, false);
    assert.match(h.fields['lw-ama-start-at'].value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.equal(h.fields['lw-post-title'].value, '正在写的标题');
    assert.doesNotMatch(source,/lw-ama-duration"[^>]*<option/);
});

test('public profile refresh button keeps its action but omits API cost copy', () => {
    assert.match(source,/onclick="LivingWorld\.refreshProfile\('\$\{escapeAttr\(id\)\}'\)"[^>]*>更新公开资料<\/button>/);
    assert.doesNotMatch(source,/更新公开资料 · 消耗 API/);
});

test('post action menu persists follow, award and hide, then restores visibility', async () => {
    const h = forumHarness();
    await h.api.init();
    h.api.openPost('post_1');
    h.api.togglePostActions();
    h.api.followCurrentPost();
    assert.deepEqual(h.saved().postFollows.user, ['post_1']);
    h.api.awardCurrentPost();
    assert.equal(h.saved().awards.length, 1);
    h.api.hideCurrentPost();
    assert.deepEqual(h.saved().hiddenPosts.user, ['post_1']);
    h.api.restoreHiddenPost('post_1');
    assert.deepEqual(h.saved().hiddenPosts.user, []);
});

test('real article text and English-to-Chinese translation are cached without inventing content', async () => {
    const news = { id:'news_1', title:'World news', description:'A short summary', url:'https://example.org/story', source:'example.org', provider:'FreeNews', publishedAt:Date.now() };
    const h = forumHarness({ newsItems:[news], newsFetchedAt:Date.now() });
    await h.api.init();
    h.setFetch(async url => ({ ok:true, json:async () => String(url).includes('/article?') ? { text:'Verified article content from the publisher.' } : { responseStatus:200, responseData:{ translatedText:'来自来源的中文译文' } } }));
    h.api.openNews('news_1');
    await new Promise(resolve => setTimeout(resolve,0));
    assert.match(h.saved().newsItems[0].content, /Verified article content/);
    await h.api.translateNews('news_1');
    assert.equal(h.saved().newsItems[0].translatedTitle, '来自来源的中文译文');
    assert.equal(h.saved().newsItems[0].translatedContent, '来自来源的中文译文');
});

test('failed article and translation requests keep the source item unchanged', async () => {
    const news = { id:'news_1', title:'World news', url:'https://example.org/story', source:'example.org', provider:'FreeNews', publishedAt:Date.now() };
    const h = forumHarness({ newsItems:[news], newsFetchedAt:Date.now() });
    await h.api.init();
    h.setFetch(async () => { throw Error('offline'); });
    h.api.openNews('news_1');
    await new Promise(resolve => setTimeout(resolve,0));
    await h.api.translateNews('news_1');
    assert.equal(h.saved().newsItems[0].content, undefined);
    assert.equal(h.saved().newsItems[0].translatedTitle, undefined);
    assert.equal(h.saved().newsComments.length, 0);
});

test('copy post link uses an internal post URI, never the small-phone website URL', async () => {
    const h = forumHarness();
    let copied = '';
    h.window.navigator = { clipboard:{ writeText:async value => { copied = value; } } };
    await h.api.init();
    h.api.openPostLink('bynd://forum/post/post_1');
    h.api.copyPostLink();
    await new Promise(resolve => setTimeout(resolve,0));
    assert.equal(copied, 'bynd://forum/post/post_1');
    assert.doesNotMatch(copied, /file:|https?:/);
    h.api.sharePost('post_1');
    h.fields['lw-message-input'] = { value:'', focus() {} };
    h.api.shareToForumDm('char:friend');
    assert.match(h.fields['lw-message-input'].value, /bynd:\/\/forum\/post\/post_1/);
});

test('chat can resolve a local forum link into a safe post preview', async () => {
    const h = forumHarness();
    await h.api.init();
    const preview = h.api.getPostPreview('bynd://forum/post/post_1');
    assert.equal(preview.title, '你好');
    assert.equal(preview.community, '广场');
    assert.equal(preview.link, 'bynd://forum/post/post_1');
    assert.equal(h.api.getPostPreview('https://example.org/post/post_1'), null);
    assert.equal(h.api.getPostPreview('bynd://forum/post/missing'), null);
});

test('a character chat remembers its own recent post without claiming the user has seen it', async () => {
    const h = forumHarness({ posts:[{ id:'char_post', authorId:'char:friend', communityId:'lounge', title:'胃不舒服的夜晚', body:'今晚吃了太辣的东西，胃有点疼。', generated:true, createdAt:Date.now() }] });
    await h.api.init();
    const context = h.api.getRelevantEventsForChar(h.window.myCharacters[0]);
    assert.match(context,/胃不舒服的夜晚/);
    assert.match(context,/吃了太辣的东西/);
    assert.match(context,/或许刷到了帖子/);
    assert.match(context,/不要断言对方确实看过/);
});

test('actor-driven refresh can choose silence while retaining only encountered knowledge', async () => {
    const h = forumHarness({ npcs:[{ id:'npc_ivy', type:'npc', name:'艾薇', summary:'喜欢拍照' }], events:[{ id:'event_post', type:'forum_post', actorId:'user', targetId:'post_1', visibility:'public', createdAt:Date.now() }], migration:{ apiGenerated:true } });
    await h.api.init();
    let prompt = '';
    h.window.callChatApi = async messages => { prompt = messages[1].content; return { ok:true, content:JSON.stringify({ actorId:'npc_ivy', action:'silence', sourceEventIds:[] }) }; };
    await h.api.advanceWorld({ actorId:'npc_ivy' });
    const world = h.saved();
    assert.match(prompt, /encounteredPosts/);
    assert.equal(world.posts.length, 1);
    assert.equal(world.agentDecisions.at(-1).action, 'silence');
    assert.equal(world.agentStates.npc_ivy.actionCounts.silence, 1);
    assert.ok(world.knowledge.npc_ivy.some(row => row.eventId === 'event_post'));
});

test('actor reply is grounded in a post it saw and changes the shared world once', async () => {
    const h = forumHarness({ npcs:[{ id:'npc_ivy', type:'npc', name:'艾薇', summary:'喜欢拍照' }], events:[{ id:'event_post', type:'forum_post', actorId:'user', targetId:'post_1', visibility:'public', createdAt:Date.now() }], migration:{ apiGenerated:true } });
    await h.api.init();
    h.window.callChatApi = async () => ({ ok:true, content:JSON.stringify({ actorId:'npc_ivy', action:'reply', targetPostId:'post_1', body:'我也想听后续。', sourceEventIds:['event_post'] }) });
    await h.api.advanceWorld({ actorId:'npc_ivy' });
    const world = h.saved();
    assert.equal(world.comments.length, 1);
    assert.equal(world.comments[0].authorId, 'npc_ivy');
    assert.equal(world.posts[0].commentCount, 1);
    assert.ok(world.notifications.user.some(note => note.postId === 'post_1'));
    assert.equal(world.agentStates.npc_ivy.communityCounts.lounge, 1);
    assert.ok(world.events.some(event => event.type === 'forum_reply' && event.actorId === 'npc_ivy'));
});

test('actor cannot cite an unknown event, and persistence failure cannot add a ghost action', async () => {
    const h = forumHarness({ npcs:[{ id:'npc_ivy', type:'npc', name:'艾薇', summary:'喜欢拍照' }], migration:{ apiGenerated:true } });
    await h.api.init();
    h.window.callChatApi = async () => ({ ok:true, content:JSON.stringify({ actorId:'npc_ivy', action:'post', communityId:'lounge', title:'新故事', body:'今天的事', sourceEventIds:['private_unknown'] }) });
    await h.api.advanceWorld({ actorId:'npc_ivy' });
    assert.equal(h.saved().posts.length, 1);
    assert.equal(h.saved().agentDecisions.length, 0);
    h.window.callChatApi = async () => ({ ok:true, content:JSON.stringify({ actorId:'npc_ivy', action:'post', communityId:'lounge', title:'新故事', body:'今天的事', sourceEventIds:[] }) });
    h.fail(true);
    await h.api.advanceWorld({ actorId:'npc_ivy' });
    assert.equal(h.saved().posts.length, 1);
    assert.equal(h.saved().agentDecisions.length, 0);
});

test('actor may remember a private chat but cannot quote it into a public post', async () => {
    const privateText = '这段只有我们两人知道的私密约定不能公开';
    const h = forumHarness({
        npcs:[{ id:'npc_ivy', type:'npc', name:'艾薇' }],
        events:[{ id:'private_chat_1', type:'private_chat', actorId:'user', targetId:'npc_ivy', visibility:'private', metadata:{ excerpt:privateText, privateTo:['npc_ivy','user'] }, createdAt:Date.now() }],
        knowledge:{ npc_ivy:[{ eventId:'private_chat_1', knownAt:Date.now(), kind:'participant' }] },
        migration:{ apiGenerated:true }
    });
    await h.api.init();
    let prompt = '';
    h.window.callChatApi = async messages => { prompt = messages[1].content; return { ok:true, content:JSON.stringify({ actorId:'npc_ivy', action:'post', communityId:'lounge', title:'今天', body:privateText, sourceEventIds:['private_chat_1'] }) }; };
    await h.api.advanceWorld({ actorId:'npc_ivy' });
    assert.match(prompt, /private_chat_1/);
    assert.equal(h.saved().posts.length, 1);
    assert.equal(h.saved().agentDecisions.length, 0);
});
