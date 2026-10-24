const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..'), copy = value => JSON.parse(JSON.stringify(value));
function harness(saved) {
    const data = new Map(saved || []), state = { calls: [], writes: [], saves: [], failStore: false, failCharacters: false, responses: [], now: 1800000000000 };
    class Clock extends Date { static now() { return state.now; } }
    const context = vm.createContext({ console, Date: Clock, setTimeout, clearTimeout,
        WECHAT_VIDEO_STORAGE_KEY: 'video', WECHAT_LIVE_STORAGE_KEY: 'live', DEFAULT_AVATAR: 'default.webp',
        document: { getElementById: () => null, querySelector: () => null },
        myCharacters: [{ id: 'lin', name: '林舟', description: '温和的书店老板，喜欢推理小说', chatConfig: {}, worldBook: [{ content: '许青是林舟的同事，常来书店帮忙，活泼。' }, { content: '不可用的秘密设定', enabled: false }], history: [{ type: 'text', isMe: true, content: '今天要在店里直播选新书吗？', timestamp: 1 }, { type: 'text', isMe: false, content: '会呀，我刚整理好书架，打算和大家介绍新书。', timestamp: 2 }] }],
        readWechatStore: (key, fallback) => data.has(key) ? copy(data.get(key)) : copy(fallback),
        writeWechatStore: (key, value) => { if (state.failStore || state.rejectWrite?.(key, value)) throw new Error('存储写入失败'); data.set(key, copy(value)); state.writes.push({ key, value: copy(value) }); },
        saveCharactersToStorage: async () => { if (state.failCharacters) return false; state.saves.push(copy(context.myCharacters)); return true; },
        callChatApi: async (messages, options) => {
            state.calls.push({ messages, options });
            if (state.respond) return state.respond(messages, options);
            const result = state.responses.shift();
            return result?.ok === false ? result : { ok: true, content: JSON.stringify(result) };
        },
        wcEscapeHtml: text => String(text).replace(/[<>&"']/g, value => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[value]),
        getChatApiUserProfile: () => ({ name: '小满', bio: '不应泄漏的隐私' }),
        getWechatCharDisplayName: char => char.name,
        createMessageTimestamp: () => ++state.now,
        formatWechatRelativeTime: () => '刚刚',
        renderChatList() {}, refreshChatView() {}, openWechatFeatureScreen(title, html) { state.screen = { title, html }; }
    }); context.window = context;
    for (const file of ['apps/wechat/moments/discover-story.js', 'apps/wechat/moments/channels.js', 'apps/wechat/moments/live.js', 'systems/agent-runtime/decider.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    const video = { needed: true, videos: [{ author: { charId: 'lin' }, title: '书店新书到了', description: '下班前整理一下书架。', scenes: [{ caption: '先从这本推理小说说起。', visual: '靠窗的书架和新到的书' }, { caption: '这一页不剧透，你们自己看。', visual: '翻开封面' }], comments: [{ actor: { name: '许青', persona: '活泼的同事', sourceEntryIndexes: [0] }, text: '这本我先借走了！' }] }] };
    const live = { needed: true, title: '来书店聊聊新书', category: '访谈', caption: '林舟坐在书架旁，打开了直播。', lines: [{ actor: { charId: 'lin' }, text: '晚上好，今天聊新书。' }], choices: ['先看推理小说', '看看窗边书架'] };
    return { context, state, data, D: context.ByndDiscoverStory, C: context.ByndChannels, L: context.ByndLive, source: context.myCharacters[0], video, live };
}
const makeVideo = async h => { h.state.responses.push(h.video); assert.equal(await h.C.publish('lin'), true); return h.C.state().videos.at(-1); };
const makeLive = async h => { h.state.responses.push(h.live); assert.equal(await h.L.publish('lin'), true); return h.L.state().rooms.at(-1); };
const response = (caption = '林舟按照你的选择拿出一本书。') => ({ caption, lines: [{ actor: { charId: 'lin' }, text: '你说的这本我记得，来看看。' }, { actor: { name: '许青', sourceEntryIndexes: [0] }, text: '我也想看看！' }], choices: ['读简介', '换一本书'], privateMessage: '' });

test('perspectives contain user, filter worlds, persist real user identity and give only the visited character knowledge', async () => {
    const h = harness(); await makeVideo(h);
    h.context.myCharacters.push({ id: 'other', name: '另一个世界', history: [], worldBook: [] });
    assert.equal(await h.C.setPerspective('lin'), true);
    h.C.open(); assert.match(h.state.screen.html, /林舟的视角/); assert.match(h.state.screen.html, /TA 知道你来过/);
    assert.equal(h.C.state().activity[0].actor.name, '小满'); assert.equal(h.state.calls.length, 1, 'visits do not consume an API call');
    assert.match(h.D.chatPrompt(h.source), /小满来看了林舟/);
    assert.equal(h.D.chatPrompt(h.context.myCharacters[1]), '');
    const restored = harness([...h.data]); restored.C.open(); assert.match(restored.state.screen.html, /林舟的视角/);
    await h.C.setPerspective('other'); h.C.open(); assert.doesNotMatch(h.state.screen.html, /书店新书到了/);
    await h.C.setPerspective('user'); h.C.open(); assert.match(h.state.screen.html, /我的视角/); assert.match(h.state.screen.html, /书店新书到了/);
    h.state.failStore = true; assert.equal(await h.C.setPerspective('lin'), false); assert.equal(h.C.state().perspective, 'user');
});

test('role perspective owns its works, hides self-follow and writes comments as the role; clicking a comment is the reply control', async () => {
    const h = harness(), video = await makeVideo(h); await h.C.setPerspective('lin'); h.C.open();
    assert.doesNotMatch(h.state.screen.html, /data-ds-action="follow"/);
    h.context.commentWechatVideo(video.id);
    assert.match(h.state.screen.html, /写评论 · 林舟/);
    assert.match(h.state.screen.html, /<button type="button" class="wc-ds-comment-row" data-ds-action="reply"/);
    assert.doesNotMatch(h.state.screen.html, />回复<\/button>/);
    h.state.responses.push({ replies: [{ actor: { name: '许青', sourceEntryIndexes: [0] }, text: '林舟，你总算回我了。' }], privateMessage: '不应作为角色对用户的私聊' });
    await h.C.submit('comment', video.id, '我帮你把那本书留下。');
    const comment = h.C.state().comments[video.id][0];
    assert.equal(comment.actor.charId, 'lin'); assert.equal(comment.user, false); assert.equal(comment.name, '林舟');
    assert.equal(h.source.history.filter(row => row.discoverEventId).length, 0);
    assert.match(h.D.chatPrompt(h.source), /charId 对应角色本人/);
});

test('each perspective has separate likes, favourites and follows, and legacy maps still belong to user', async () => {
    const h = harness(), video = await makeVideo(h);
    h.state.responses.push({ replies: [], privateMessage: '' }); await h.C.toggleLike(video.id); await h.C.toggle('follows', video.author.key);
    await h.C.setPerspective('lin');
    assert.equal(h.D.account(h.C.state(), h.D.characterActor(h.source)).likes[video.id], undefined);
    h.state.responses.push({ replies: [], privateMessage: '不能发给user' }); await h.C.toggleLike(video.id); await h.C.toggle('favs', video.id);
    assert.equal(await h.C.toggle('follows', video.author.key), false, 'roles cannot follow themselves through the exported API either');
    assert.equal(h.C.state().accounts['char:lin'].likes[video.id], true); assert.equal(h.C.state().likes[video.id], true);
    await h.C.toggleLike(video.id); assert.equal(h.C.state().likes[video.id], true); assert.equal(h.C.state().accounts['char:lin'].likes[video.id], false);
    assert.equal(h.C.state().favs[video.id], undefined); assert.equal(h.C.state().accounts['char:lin'].favs[video.id], true);
    const restored = harness([...h.data]); assert.equal(restored.C.state().accounts['char:lin'].favs[video.id], true); assert.equal(restored.C.state().follows[video.author.key], true);
    assert.equal(h.source.history.filter(row => row.discoverEventId).length, 0);
    h.state.failStore = true; assert.equal(await h.C.toggle('favs', video.id), false); assert.equal(h.C.state().accounts['char:lin'].favs[video.id], true);
});

test('pending comments keep the initiating role after switching to user and retrying, without relabelling old user data', async () => {
    const h = harness(), video = await makeVideo(h); await h.C.setPerspective('lin');
    h.state.responses.push({ ok: false, error: '离线' }); await h.C.submit('comment', video.id, '许青，替你留好了。');
    const event = h.C.state().events.at(-1);
    await h.C.setPerspective('user');
    h.state.responses.push({ replies: [{ actor: { name: '许青', sourceEntryIndexes: [0] }, text: '收到，谢谢林舟。' }], privateMessage: '不会误投给用户' });
    assert.equal(await h.C.perform(event.id), true);
    assert.equal(JSON.parse(h.state.calls.at(-1).messages[1].content).task.interactionActor.charId, 'lin');
    assert.equal(h.C.state().comments[video.id].filter(row => row.submitted).length, 1);
    assert.equal(h.C.state().comments[video.id][0].actor.charId, 'lin'); assert.equal(h.C.state().outbox.length, 0);
});

test('role publishes role-owned works, while user mine feed excludes them', async () => {
    const h = harness(); await h.C.setPerspective('lin');
    h.state.responses.push({ replies: [{ actor: { name: '许青', sourceEntryIndexes: [0] }, text: '老板，记得给新书贴标签。' }], likes: [], privateMessage: '' });
    assert.equal(await h.C.post('今天店里新来一摞推理小说。', 'lin'), true);
    const video = h.C.state().videos[0]; assert.equal(video.author.charId, 'lin'); assert.equal(video.author.user, undefined);
    assert.equal(h.C.state().events[0].kind, 'account-post'); h.C.open(); assert.match(h.state.screen.html, /今天店里新来/);
    await h.C.setPerspective('user'); h.C.open(); assert.doesNotMatch(h.state.screen.html, /今天店里新来/);
});

test('role shares and watches with another role without adding forged user chat messages', async () => {
    const h = harness(), video = await makeVideo(h);
    h.context.myCharacters.push({ id: 'friend', name: '周岚', description: '另一家书店的朋友', chatConfig: { npcSourceCharId: 'lin' }, worldBook: [], history: [] });
    await h.C.setPerspective('lin');
    assert.equal(await h.C.share(video.id, 'friend'), true); assert.equal(h.C.state().shares[0].actor.charId, 'lin'); assert.equal(h.C.state().outbox.length, 0);
    h.state.responses.push({ reply: '林舟，这本我也看过。' }); assert.equal(await h.C.startWatch(video.id, 'friend'), true);
    const watch = Object.values(h.C.state().watches)[0]; assert.equal(watch.initiator.charId, 'lin'); assert.equal(watch.messages[0].actor.charId, 'lin'); assert.equal(watch.messages[1].actor.charId, 'friend');
    assert.equal(h.C.state().outbox.length, 0); assert.equal(h.source.history.filter(row => row.discoverEventId).length, 0);
    h.state.responses.push({ reply: '下次我们店里也办一期分享。' }); await h.C.submit('watch-end', video.id, '这次先看到这里。');
    assert.equal(h.C.state().outbox.length, 0); assert.match(h.D.chatPrompt(h.context.myCharacters[1]), /这次先看到这里/);
});

test('role can invite user without fabricating a user reply; the user can join the same shared session in their own perspective', async () => {
    const h = harness(), video = await makeVideo(h); await h.C.setPerspective('lin');
    const before = h.state.calls.length; assert.equal(await h.C.startWatch(video.id, 'user'), true);
    const watch = Object.values(h.C.state().watches)[0]; assert.equal(watch.messages.length, 1); assert.equal(h.state.calls.length, before);
    assert.equal(h.source.history.at(-1).isMe, false);
    await h.C.setPerspective('user'); assert.equal(await h.C.startWatch(video.id, 'lin'), true);
    h.state.responses.push({ reply: '小满，你想看哪一页？' }); await h.C.submit('watch-message', video.id, '我来了，这个封面真好看。');
    assert.equal(h.C.state().watches[watch.id].messages[1].actor.user, true);
    assert.equal(h.C.state().watches[watch.id].messages[2].actor.charId, 'lin');
});

test('likes, unlikes, follows and submitted comments survive for ordinary chat even when no private follow-up is generated; favourites remain private', async () => {
    const h = harness(), video = await makeVideo(h);
    h.state.responses.push({ replies: [], privateMessage: '' }); await h.C.toggleLike(video.id);
    assert.equal(h.C.state().events.at(-1).actor.name, '小满'); assert.match(h.C.state().events.at(-1).text, /小满点赞/);
    await h.C.toggleLike(video.id); await h.C.toggle('follows', video.author.key); await h.C.toggle('favs', video.id);
    h.state.responses.push({ ok: false, error: '网络断开' }); await h.C.submit('comment', video.id, '给我留这本书');
    assert.equal(h.C.state().comments[video.id][0].text, '给我留这本书', 'public comment is saved before waiting for a model reply');
    const prompt = harness([...h.data]).D.chatPrompt(h.source);
    assert.match(prompt, /取消了点赞/); assert.match(prompt, /关注了作者/); assert.match(prompt, /给我留这本书/);
    assert.doesNotMatch(prompt, /"kind":"fav/); assert.equal(h.source.history.filter(row => row.discoverEventId).length, 0);
    const before = h.C.state().activity.length;
    h.state.failStore = true; await h.C.toggleLike(video.id); assert.equal(h.C.state().activity.length, before);
});

test('user perspective publishes user works; NPC reactions retry without duplicate posts or forged user lines', async () => {
    const h = harness(); await h.C.setPerspective('user');
    h.state.responses.push({ ok: false, error: '暂时离线' }); assert.equal(await h.C.post('今天在窗边读完一本书。', 'lin'), false);
    const video = h.C.state().videos[0], event = h.C.state().events[0];
    assert.equal(video.author.key, 'user'); assert.equal(video.author.name, '小满'); assert.equal(video.author.charId, undefined);
    assert.equal(event.status, 'error'); assert.match(h.D.chatPrompt(h.source), /今天在窗边读完/);
    h.state.responses.push({ replies: [{ actor: { charId: 'lin' }, text: '那本结局你猜到了吗？' }, { actor: { name: '许青', sourceEntryIndexes: [0] }, text: '我看完了，忍住不剧透！' }], likes: [{ charId: 'lin' }], privateMessage: '' });
    assert.equal(await h.C.perform(event.id), true); assert.equal(h.C.state().videos.length, 1);
    assert.equal(h.C.state().comments[video.id].length, 2); assert.equal(h.C.state().videos[0].reactions[0].name, '林舟');
    const task = JSON.parse(h.state.calls.at(-1).messages[1].content).task;
    assert.equal(task.interactionActor.name, '小满'); assert.equal(task.work.author.user, true);
    assert.equal(await h.C.perform(event.id), false); assert.equal(h.C.state().comments[video.id].length, 2);
    h.state.failStore = true; assert.equal(await h.C.post('不能假装已经发布', 'lin'), false); assert.equal(h.C.state().videos.length, 1);
});

test('role and NPC public life continues in existing threads without impersonating user or crossing worlds', async () => {
    const h = harness(), video = await makeVideo(h);
    h.state.responses.push({ needed: false, interactions: [{ videoId: video.id, actor: { name: '许青', sourceEntryIndexes: [0] }, text: '林舟，今晚我负责收店。', replyTo: '林舟', like: true }] });
    assert.equal(await h.C.publish('lin', { background: true }), true);
    assert.equal(h.C.state().videos.length, 1); assert.equal(h.C.state().comments[video.id][0].actor.name, '许青');
    assert.equal(h.C.state().comments[video.id][0].replyTo, '林舟'); assert.match(h.D.chatPrompt(h.source), /今晚我负责收店/);
    for (const raw of [{ videoId: 'unrelated-world', actor: { charId: 'lin' }, text: '越界' }, { videoId: video.id, actor: { user: true, name: '小满' }, text: '冒充用户' }]) {
        h.state.responses.push({ needed: false, interactions: [raw] }); assert.equal(await h.C.publish('lin'), false);
        assert.equal(h.C.state().comments[video.id].length, 1);
    }
});

test('forwarded cards become recipient knowledge only after delivery; retry does not duplicate the card or notify unrelated characters', async () => {
    const h = harness(), video = await makeVideo(h);
    h.context.myCharacters.push({ id: 'recipient', name: '收件人', history: [], chatConfig: {}, worldBook: [] });
    const recipient = h.context.myCharacters[1]; h.state.failCharacters = true;
    assert.equal(await h.C.share(video.id, recipient.id), false); assert.equal(recipient.history.length, 0);
    assert.equal(h.D.chatPrompt(recipient), '');
    assert.equal(await h.C.share(video.id, recipient.id), false); assert.equal(h.C.state().outbox.length, 1, 'retrying the forwarding screen reuses the pending delivery');
    h.state.failCharacters = false; assert.equal(await h.D.deliver('video'), true);
    assert.equal(recipient.history.length, 1); assert.match(h.D.chatPrompt(recipient), /转发了这条作品给收件人/);
    assert.doesNotMatch(h.D.chatPrompt(h.source), /转发了这条作品给收件人/);
    await h.D.deliver('video'); assert.equal(recipient.history.length, 1);
});

test('public works use persona and enabled world entries, retain scenes and NPC comments, and do not regenerate on open', async () => {
    const h = harness(), video = await makeVideo(h);
    assert.equal(video.author.name, '林舟'); assert.equal(video.scenes.length, 2); assert.equal(video.comments[0].actor.name, '许青');
    const prompt = h.state.calls[0].messages[1].content;
    assert.match(prompt, /温和的书店老板/); assert.match(prompt, /许青/); assert.doesNotMatch(prompt, /不可用的秘密设定|不应泄漏的隐私/);
    h.C.open(); h.C.open(); assert.equal(h.state.calls.length, 1);
    const restored = harness([...h.data]); assert.equal(restored.C.state().videos[0].id, video.id);
    assert.equal(h.state.calls[0].options.skipLengthContinuation, true);
});

test('negative publication, malformed model output, API failure and failed storage preserve all previous works', async () => {
    const h = harness(); await makeVideo(h);
    for (const result of [{ needed: false }, { needed: true, videos: [{ title: '坏作品', scenes: [] }] }, { ok: false, error: '断网了' }]) {
        h.state.responses.push(result); assert.equal(await h.C.publish('lin'), false); assert.equal(h.C.state().videos.length, 1);
    }
    h.state.failStore = true; h.state.responses.push({ ...h.video, videos: [{ ...h.video.videos[0], title: '不能保存的新作品' }] });
    assert.equal(await h.C.publish('lin'), false); assert.equal(h.C.state().videos.length, 1);
});

test('unknown contacts and invalid/disabled NPC world references are rejected', async () => {
    for (const actor of [{ charId: 'stranger' }, { name: '陌生人', sourceEntryIndexes: [1] }, { name: '无来源' }]) {
        const h = harness(); h.video.videos[0].comments[0].actor = actor;
        h.state.responses.push(h.video); assert.equal(await h.C.publish('lin'), false); assert.equal(h.C.state().videos.length, 0);
    }
});

test('comments persist a retryable event, render one user comment and reply, and recover after API failure', async () => {
    const h = harness(), video = await makeVideo(h);
    h.state.responses.push({ ok: false, error: '评论请求失败' });
    assert.equal(await h.C.submit('comment', video.id, '可以推荐一本不吓人的推理吗？'), false);
    let event = h.C.state().events.at(-1); assert.equal(event.status, 'error'); assert.match(event.error, /失败/);
    h.state.responses.push({ replies: [{ actor: { charId: 'lin' }, text: '给你挑一本轻松的。' }], privateMessage: '' });
    assert.equal(await h.C.perform(event.id), true);
    const comments = h.C.state().comments[video.id]; assert.equal(comments.length, 2); assert.equal(comments[0].user, true); assert.equal(comments[1].actor.name, '林舟');
    assert.equal(await h.C.perform(event.id), false); assert.equal(h.C.state().comments[video.id].length, 2);
});

test('likes can naturally produce one private follow-up, unlike does not duplicate it, and follows/favourites persist', async () => {
    const h = harness(), video = await makeVideo(h);
    h.state.responses.push({ replies: [], privateMessage: '刚刚看到你点赞啦，下次来店里给你看那本。' });
    assert.equal(await h.C.toggleLike(video.id), true);
    assert.equal(h.source.history.filter(msg => msg.discoverEventId).length, 1);
    await h.C.toggleLike(video.id); await h.C.toggleLike(video.id);
    assert.equal(h.state.calls.length, 2); assert.equal(h.source.history.filter(msg => msg.discoverEventId).length, 1);
    await h.C.toggle('follows', video.author.key); await h.C.toggle('favs', video.id);
    const restored = harness([...h.data]); assert.equal(restored.C.state().follows[video.author.key], true); assert.equal(restored.C.state().favs[video.id], true);
});

test('user actions must save before requesting AI, with no false success on local write failure', async () => {
    const h = harness(), video = await makeVideo(h); h.state.failStore = true;
    assert.equal(await h.C.submit('comment', video.id, '这本怎么样？'), false);
    assert.equal(h.state.calls.length, 1); assert.equal(h.C.state().events.length, 0);
    assert.equal(await h.C.toggle('favs', video.id), false); assert.equal(h.C.state().favs[video.id], undefined);
});

test('watch together invites, reacts to scene progression and user input, resumes and ends with shared chat context', async () => {
    const h = harness(), video = await makeVideo(h);
    h.state.responses.push({ reply: '一起看，我给你说说这一页。' });
    assert.equal(await h.C.startWatch(video.id, 'lin'), true);
    let watch = Object.values(h.C.state().watches)[0]; assert.equal(watch.messages.length, 2);
    assert.equal(h.source.history.filter(msg => msg.type === 'share_card').length, 1);
    h.state.responses.push({ reply: '下一幕拿出的书就是你喜欢的。' });
    assert.equal(await h.C.submit('watch-next', video.id, '下一幕吧', 1), true);
    h.state.responses.push({ reply: '我也觉得这个镜头很有意思。' });
    assert.equal(await h.C.submit('watch-message', video.id, '这本封面好看'), true);
    watch = Object.values(h.C.state().watches)[0]; assert.equal(watch.sceneIndex, 1); assert.equal(watch.messages.length, 6);
    const restored = harness([...h.data]); assert.equal(Object.values(restored.C.state().watches)[0].messages.length, 6);
    h.state.responses.push({ reply: '好，等你下次来一起挑。', privateMessage: '刚一起看的那本，我帮你留一份。' });
    assert.equal(await h.C.submit('watch-end', video.id, '先看到这里'), true);
    assert.equal(Object.values(h.C.state().watches)[0].status, 'ended');
    assert.match(h.source.history.at(-1).content, /帮你留/);
});

test('live actions actually change the scene, preserve NPC dialogue, choices and song requests, then send a closing follow-up', async () => {
    const h = harness(), room = await makeLive(h);
    h.state.responses.push(response('林舟看见你进来，朝镜头挥手。'));
    assert.equal(await h.L.enter(room.id), true);
    h.state.responses.push(response('林舟念出你的弹幕，拿起那本推理。'));
    assert.equal(await h.L.submit(room.id, 'danmaku', '我想看那本推理'), true);
    h.state.responses.push(response('林舟答应点歌，轻声哼了一小段自己编的旋律。'));
    assert.equal(await h.L.submit(room.id, 'song', '唱一段轻松的歌吧'), true);
    let current = h.L.state().rooms[0];
    h.state.responses.push(response('林舟翻开简介。'));
    assert.equal(await h.L.submit(room.id, 'choice', '', current.choices[0].id, current.version), true);
    current = h.L.state().rooms[0]; assert.match(current.caption, /简介/); assert.ok(current.lines.some(line => line.actor?.name === '许青'));
    assert.equal(current.log[2].kind, 'song'); assert.equal(current.log[3].text, '读简介');
    h.state.responses.push({ ...response('林舟关掉镜头，和大家道别。'), privateMessage: '刚才你点的歌，下次单独给你唱。' });
    assert.equal(await h.L.submit(room.id, 'end', '先下播吧'), true);
    assert.equal(h.L.state().rooms[0].status, 'ended'); assert.match(h.source.history.at(-1).content, /你点的歌/);
    assert.equal(await h.L.submit(room.id, 'danmaku', '迟来的消息'), false);
});

test('live failures block later actions until retry or cancellation; stale choices and multiple in-flight requests never overwrite scenes', async () => {
    const h = harness(), room = await makeLive(h);
    h.state.responses.push({ ok: false, error: '断网了' });
    assert.equal(await h.L.submit(room.id, 'danmaku', '你好呀'), false);
    const event = h.L.state().events[0]; assert.equal(event.status, 'error');
    assert.equal(await h.L.submit(room.id, 'song', '点歌'), false);
    h.state.responses.push(response()); assert.equal(await h.L.perform(event.id), true);
    assert.equal(await h.L.submit(room.id, 'choice', '', 'choice_0', 0), false);
    let finish; h.state.respond = () => new Promise(resolve => { finish = resolve; });
    const work = h.L.submit(room.id, 'danmaku', '继续说说');
    while (!finish) await Promise.resolve();
    assert.equal(h.L.submit(room.id, 'song', '同时点歌'), work);
    assert.equal(await h.L.cancel(h.L.state().events.at(-1).id), false);
    finish({ ok: true, content: JSON.stringify(response('只回应第一条')) }); assert.equal(await work, true);
    assert.equal(h.L.state().rooms[0].caption, '只回应第一条');
});

test('ending persists an outbox; character save failure leaves no ghost message and explicit retry sends only once', async () => {
    const h = harness(), room = await makeLive(h); h.state.failCharacters = true;
    h.state.responses.push({ ...response('收播了'), privateMessage: '待会微信聊' });
    assert.equal(await h.L.submit(room.id, 'end', '结束啦'), true);
    assert.equal(h.source.history.filter(msg => msg.discoverEventId).length, 0);
    assert.equal(h.L.state().outbox[0].status, 'pending'); assert.match(h.D.failure('delivery:live'), /保存/);
    h.state.failCharacters = false;
    assert.equal(await h.D.deliver('live'), true); assert.equal(await h.D.deliver('live'), true);
    assert.equal(h.source.history.filter(msg => msg.discoverEventId).length, 1);
});

test('outbox confirmation failures recover after reload without duplicate private messages', async () => {
    const h = harness(), room = await makeLive(h);
    h.state.rejectWrite = (key, value) => key === 'live' && value.outbox?.some(row => row.status === 'sent');
    h.state.responses.push({ ...response('结束'), privateMessage: '谢谢你来看我' });
    await h.L.submit(room.id, 'end', '结束');
    assert.equal(h.source.history.filter(msg => msg.discoverEventId).length, 1);
    const restored = harness([...h.data]); restored.context.myCharacters = copy(h.context.myCharacters);
    await restored.D.deliver('live');
    assert.equal(restored.source.history.filter(msg => msg.discoverEventId).length, 0, 'old harness reference is separate');
    assert.equal(restored.context.myCharacters[0].history.filter(msg => msg.discoverEventId).length, 1);
    assert.equal(restored.L.state().outbox[0].status, 'sent');
});

test('deleted or blacklisted characters discard late responses and do not receive outbox messages', async () => {
    for (const change of ['delete', 'blacklist']) {
        const h = harness(); let finish; h.state.respond = () => new Promise(resolve => { finish = resolve; });
        const work = h.C.publish('lin'); while (!finish) await Promise.resolve();
        if (change === 'delete') h.context.myCharacters = []; else h.source.chatConfig.blacklisted = true;
        finish({ ok: true, content: JSON.stringify(h.video) });
        assert.equal(await work, false); assert.equal(h.C.state().videos.length, 0);
    }
});

test('legacy videos, comments, likes and categorized rooms survive migration and use the existing backup keys', () => {
    const h = harness([['video', { videos: [{ id: 'old', author: '旧作者', title: '旧作品', frames: ['old.png'] }], likes: { old: true }, comments: { old: ['旧评论'] } }], ['live', { rooms: { 美食: [{ id: 'old-room', title: '旧直播', host: '旧主播', lines: ['晚上好'] }] } }]]);
    assert.equal(h.C.state().videos[0].title, '旧作品'); assert.equal(h.C.state().likes.old, true); assert.equal(h.C.state().comments.old[0], '旧评论');
    assert.equal(h.L.state().rooms[0].category, '美食'); h.C.open(); h.L.open(); assert.equal(h.state.calls.length, 0);
    const backup = fs.readFileSync(path.join(root, 'core/storage/backup.js'), 'utf8'); assert.match(backup, /'wechat_video_state'/); assert.match(backup, /'wechat_live_state'/);
});

test('Agent/JEV verdicts gate background publishing, with a once-per-turn cooldown and no UI timer', async () => {
    const h = harness(), turn = h.D.capture(h.source);
    assert.match(h.context.ByndDecider.replyInstructions(h.source), /channel.*live/);
    for (const verdict of [false, null, 'true']) assert.equal(await h.D.consider(h.source, { verdict, route: 'agent', kind: 'video', turn }), false);
    h.state.responses.push(h.video);
    assert.equal(await h.D.consider(h.source, { verdict: true, route: 'agent', kind: 'video', turn }), true);
    assert.equal(await h.D.consider(h.source, { verdict: true, route: 'agent', kind: 'video', turn }), false);
    h.context.ByndJev = { available: () => true, ask: async () => ({ channel: { confident: true, value: true }, live: { confident: false, value: true } }) };
    const result = await h.context.ByndDecider.afterReply(h.source); assert.equal(result.channel, true); assert.equal(result.live, null);
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'apps/wechat/moments/discover-story.js'), 'utf8'), /setInterval|setTimeout/);
    h.source.chatConfig.npcSourceCharId = 'parent-character';
    assert.equal(h.D.canPublish(h.source), true, 'accepted NPC contacts can publish their own works and streams');
});

test('real chat after-reply pipeline selectively publishes for Agent and confident JEV decisions', async () => {
    for (const [verdict, textOnly] of [[true, false], [false, false], [true, true]]) {
        const h = harness();
        Object.assign(h.context, { shouldDeferWechatMemoryAfterReply: () => false, requestWechatAiStatusSnapshot: async () => {}, scheduleWechatMemoryExtraction() {}, considerWechatCharMomentAfterReply() {} });
        vm.runInContext(fs.readFileSync(path.join(root, 'core/api/ai-reply.js'), 'utf8'), h.context);
        h.state.responses.push(h.video);
        let work;
        const consider = h.D.consider;
        h.D.consider = (...args) => (work = consider(...args));
        await h.context.runWechatTurnFollowUps(h.source, { textOnly, replyDecisions: { status: false, memory: false, moment: false, channel: verdict, live: false } });
        if (work) await work;
        assert.equal(h.C.state().videos.length, verdict && !textOnly ? 1 : 0);
    }
});

test('video and live deliveries to the same character serialize; one failed save cannot persist a ghost from another delivery', async () => {
    const h = harness();
    h.D.change('video', s => h.D.outbox(s, 'v1', 'lin', [{ type: 'text', isMe: false, content: '视频号回访' }]));
    h.D.change('live', s => h.D.outbox(s, 'l1', 'lin', [{ type: 'text', isMe: false, content: '直播回访' }]));
    let finish, calls = 0;
    h.context.saveCharactersToStorage = () => { calls++; return calls === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(true); };
    const video = h.D.deliver('video'), live = h.D.deliver('live');
    while (!finish) await Promise.resolve();
    assert.equal(h.source.history.filter(msg => msg.discoverEventId).length, 1);
    finish(false); assert.equal(await video, false); assert.equal(await live, true);
    assert.deepEqual(h.source.history.filter(msg => msg.discoverEventId).map(msg => msg.content), ['直播回访']);
    assert.equal(await h.D.deliver('video'), true);
    assert.equal(h.source.history.filter(msg => msg.discoverEventId).length, 2);
    assert.equal(h.source.unreadCount, 2);
});

test('new private follow-ups arriving during a delivery are drained before it completes', async () => {
    const h = harness();
    h.D.change('video', s => h.D.outbox(s, 'first', 'lin', [{ type: 'text', isMe: false, content: '第一条' }]));
    let finish, count = 0;
    h.context.saveCharactersToStorage = () => ++count === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(true);
    const work = h.D.deliver('video'); while (!finish) await Promise.resolve();
    h.D.change('video', s => h.D.outbox(s, 'second', 'lin', [{ type: 'text', isMe: false, content: '第二条' }]));
    const another = h.D.deliver('video'); finish(true);
    assert.equal(await work, true); assert.equal(await another, true);
    assert.ok(h.C.state().outbox.every(item => item.status === 'sent'));
    assert.equal(h.source.history.filter(msg => msg.discoverEventId).length, 2);
});
