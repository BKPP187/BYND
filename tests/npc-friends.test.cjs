const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));

function harness() {
    const state = { time: 1800000000000, calls: [], saves: [], fail: false, notices: [] };
    class Clock extends Date { static now() { return state.time; } }
    const context = vm.createContext({ console, Date: Clock,
        document: { getElementById: () => null, querySelectorAll: () => [] },
        myCharacters: [{ id: 'lin', name: '林舟', description: '书店老板',
            history: [{ type: 'text', isMe: true, content: '想请许青帮我查一下新书，可以让她微信联系我吗？', timestamp: 100 }, { type: 'text', isMe: false, content: '好，我把你的微信推给许青，让她加你聊新书。', timestamp: 101 }],
            chatConfig: {}, worldBook: [{ comment: '书店同事', content: '店员许青帮林舟经营书店。', enabled: true }, { content: '禁用秘密', enabled: false }] }],
        saveCharactersToStorage: async () => { if (state.fail) return false; state.saves.push(clone(context.myCharacters)); return true; },
        getChatApiUserProfile: () => ({ name: '小满', bio: '无关私密资料' }),
        wcEscapeHtml: value => String(value).replace(/[<>&"']/g, value => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[value]),
        callChatApi: async (messages, options) => { state.calls.push({ messages, options }); return state.response || { ok: true, content: JSON.stringify(state.data) }; },
        parseWechatJsonObject: JSON.parse, createMessageTimestamp: () => state.time,
        showWechatToast: value => state.notices.push(value), renderChatList() {}, renderContacts() {},
        shouldDeferWechatMemoryAfterReply: () => false,
        requestWechatAiStatusSnapshot: async () => {}, scheduleWechatMemoryExtraction() {}, considerWechatCharMomentAfterReply() {}
    });
    context.window = context;
    for (const file of ['apps/wechat/character/generator.js', 'apps/wechat/contacts/npc-friends.js', 'systems/agent-runtime/decider.js', 'systems/agent-runtime/agent-tools.js', 'core/api/ai-reply.js']) vm.runInContext(read(file), context);
    state.data = { needed: true, card: { name: '许青', description: '林舟的书店同事，开朗，喜欢推理小说。', firstMessage: '你好，林舟说你想查一下新书。', worldBook: [{ keys: ['书店'], comment: '工作', content: '在林舟的书店工作。' }] }, relationship: '林舟的书店同事', reason: '你好，我是许青，林舟说你想查一下新书，我来和你对接。', sourceEntryIndexes: [0], sourceMessageIndexes: [1], storyEvidence: '我把你的微信推给许青' };
    return { context, state, api: context.ByndNpcFriends, source: context.myCharacters[0] };
}
const generate = (h, verdict = true, route = 'agent') => h.api.consider(h.source, { verdict, route, turn: h.api.captureTurn(h.source) });
const nextTurn = h => { h.source.history.push({ type: 'text', isMe: true, content: '请让同事联系我。', timestamp: ++h.state.time }, { type: 'text', isMe: false, content: '我把你的微信推给许青，让她联系你。', timestamp: ++h.state.time }); h.state.data.sourceMessageIndexes = [h.source.history.length - 1]; };

const portrait = 'data:image/webp;base64,' + fs.readFileSync(path.join(root, 'assets/avatars/npc-default-star-v1.webp')).toString('base64');
function enableImages(h, provider = 'api') {
    h.state.images = [];
    h.context.getImageRouteForFeature = () => provider === 'novelai' ? { provider, settings: { enabled: true, token: 'fixture' } } : { provider, api: { baseUrl: 'https://fixture.invalid', imageModel: 'image-test' } };
    h.context.loadWechatAvatarForVision = async src => src;
    h.context.callWechatImageGenerationApi = async (prompt, options) => { h.state.images.push({ prompt, options }); return { ok: true, url: portrait }; };
}

test('six bundled defaults are stable, distinct and saved with the contact without an image API', async () => {
    const h = harness();
    assert.equal(h.api.defaultAvatars.length, 6);
    assert.equal(new Set(Array.from({ length: 100 }, (_, i) => h.api.defaultAvatarFor('npc_' + i))).size, 6);
    for (const file of h.api.defaultAvatars) assert.ok(fs.statSync(path.join(root, file)).size > 0);
    h.context.callWechatImageGenerationApi = () => { throw new Error('must not fall back to a text API'); };
    h.context.getDefaultImageApi = () => null;
    await generate(h);
    const request = h.api.rows()[0].request;
    assert.equal(request.avatar, h.api.defaultAvatarFor(request.id));
    await h.api.ensureAvatar(request.id);
    assert.equal(await h.api.resolve(request.id, 'accept'), true);
    const contact = h.context.myCharacters[1];
    assert.equal(contact.avatar, request.avatar);
    assert.equal(contact._smallAvatar, request.avatar);
    assert.equal(contact.avatarGallery[0], request.avatar);
});

test('configured API and NovelAI portraits use the NPC persona and persist only a local image', async () => {
    for (const provider of ['api', 'novelai']) {
        const h = harness(); enableImages(h, provider);
        await generate(h);
        const id = h.api.rows()[0].request.id;
        await h.api.ensureAvatar(id);
        assert.equal(h.api.rows()[0].request.avatarState, 'ready');
        assert.equal(h.api.rows()[0].request.avatar, portrait);
        assert.equal(h.state.images.length, 1);
        assert.match(h.state.images[0].prompt, /许青.*|林舟的书店同事/);
        assert.match(h.state.images[0].prompt, /喜欢推理小说/);
        assert.equal(h.state.images[0].options.feature, 'chat');
        await h.api.resolve(id, 'accept');
        await h.api.ensureContactAvatar(h.context.myCharacters[1]);
        assert.equal(h.context.myCharacters[1].avatar, portrait);
        assert.equal(h.state.images.length, 1);
        const saved = h.state.saves.at(-1);
        assert.equal(saved[1].avatar, portrait);
        const restored = harness(); restored.context.myCharacters = clone(saved);
        assert.equal(restored.api.rows()[0].request.avatar, portrait);
        assert.equal(restored.context.myCharacters[1].avatar, portrait);
    }
});

test('portrait jobs deduplicate and finish on contacts accepted during generation', async () => {
    const h = harness(); await generate(h); enableImages(h);
    let finish;
    h.context.callWechatImageGenerationApi = () => new Promise(resolve => { finish = resolve; });
    const id = h.api.rows()[0].request.id;
    const work = h.api.ensureAvatar(id);
    assert.equal(h.api.ensureAvatar(id), work);
    while (!finish) await Promise.resolve();
    assert.equal(await h.api.resolve(id, 'accept'), true);
    assert.ok(h.api.defaultAvatars.includes(h.context.myCharacters[1].avatar));
    finish({ ok: true, url: portrait });
    assert.equal(await work, true);
    assert.equal(h.context.myCharacters[1].avatar, portrait);
    assert.equal(h.context.myCharacters[1]._smallAvatar, portrait);
    assert.equal(h.context.myCharacters[1].avatarGallery.length, 1);
});

test('generation, download, invalid image and decoding failures retain the default; only explicit retry reruns', async () => {
    for (const kind of ['api', 'url', 'download', 'decode']) {
        const h = harness(); await generate(h); enableImages(h);
        const id = h.api.rows()[0].request.id;
        const before = h.api.rows()[0].request.avatar;
        const good = h.context.callWechatImageGenerationApi;
        let calls = 0;
        h.context.callWechatImageGenerationApi = async () => {
            calls++;
            if (kind === 'api') return { ok: false, error: '生图失败' };
            return { ok: true, url: kind === 'url' ? 'javascript:alert(1)' : kind === 'download' ? 'https://fixture.invalid/avatar.png' : portrait };
        };
        h.context.AbortSignal = AbortSignal;
        h.context.fetch = async () => ({ ok: false });
        if (kind === 'decode') h.context.loadWechatAvatarForVision = async () => '';
        assert.equal(await h.api.ensureAvatar(id), false, kind);
        assert.equal(h.api.rows()[0].request.avatarState, 'error', kind);
        assert.equal(h.api.rows()[0].request.avatar, before, kind);
        await h.api.ensureAvatar(id);
        assert.equal(calls, 1, 'no automatic error loop');
        h.context.callWechatImageGenerationApi = good;
        h.context.loadWechatAvatarForVision = async src => src;
        assert.equal(await h.api.ensureAvatar(id, { retry: true }), true, kind);
        assert.equal(h.api.rows()[0].request.avatarState, 'ready');
    }
});

test('failed portrait persistence rolls back contact data and can be explicitly retried', async () => {
    const h = harness(); await generate(h);
    const id = h.api.rows()[0].request.id;
    await h.api.resolve(id, 'accept'); enableImages(h);
    const before = h.context.myCharacters[1].avatar;
    h.context.callWechatImageGenerationApi = async () => { h.state.fail = true; return { ok: true, url: portrait }; };
    assert.equal(await h.api.ensureAvatar(id), false);
    assert.equal(h.context.myCharacters[1].avatar, before);
    assert.notEqual(h.api.rows()[0].request.avatarState, 'ready');
    h.state.fail = false;
    h.context.callWechatImageGenerationApi = async () => ({ ok: true, url: portrait });
    assert.equal(await h.api.ensureAvatar(id, { retry: true }), true);
    assert.equal(h.context.myCharacters[1].avatar, portrait);
});

test('legacy contacts get a default and user custom avatars survive an in-flight portrait', async () => {
    const h = harness(); await generate(h);
    const id = h.api.rows()[0].request.id;
    await h.api.resolve(id, 'accept');
    const contact = h.context.myCharacters[1];
    delete contact.avatar; delete h.api.rows()[0].request.avatar;
    await h.api.ensureContactAvatar(contact);
    assert.equal(contact.avatar, h.api.defaultAvatarFor(id));
    enableImages(h); let finish;
    h.context.callWechatImageGenerationApi = () => new Promise(resolve => { finish = resolve; });
    const work = h.api.ensureAvatar(id);
    while (!finish) await Promise.resolve();
    contact.avatar = 'assets/custom-user-avatar.webp';
    finish({ ok: true, url: portrait }); await work;
    assert.equal(contact.avatar, 'assets/custom-user-avatar.webp');
    assert.equal(await h.api.ensureContactAvatar(contact), false);
});

test('rejecting or deleting a request while its portrait is running never creates a contact', async () => {
    for (const kind of ['reject', 'delete']) {
        const h = harness(); await generate(h); enableImages(h); let finish;
        h.context.callWechatImageGenerationApi = () => new Promise(resolve => { finish = resolve; });
        const id = h.api.rows()[0].request.id;
        const work = h.api.ensureAvatar(id);
        while (!finish) await Promise.resolve();
        if (kind === 'reject') await h.api.resolve(id, 'reject');
        else h.context.myCharacters = [];
        finish({ ok: true, url: portrait });
        assert.equal(await work, false);
        assert.equal(h.context.myCharacters.length, kind === 'reject' ? 1 : 0);
        if (kind === 'reject') assert.equal(h.api.rows()[0].request.status, 'rejected');
    }
});

test('only an affirmative Agent/JEV turn verdict can generate a story-based request', async () => {
    const h = harness();
    for (const verdict of [false, null, 'true']) assert.equal(await generate(h, verdict), false);
    assert.equal(await h.api.consider(h.source, { route: 'agent', turn: h.api.captureTurn(h.source) }), false);
    assert.equal(await generate(h, true, 'timer'), false);
    assert.equal(await h.api.consider(h.source, { verdict: true, route: 'agent' }), false);
    assert.equal(h.state.calls.length, 0);
    assert.equal(await generate(h), true);
    assert.equal(h.context.myCharacters.length, 1);
    assert.equal(h.api.pendingCount(), 1);
    const prompt = h.state.calls[0].messages.find(row => row.role === 'user').content;
    assert.match(prompt, /书店同事/);
    assert.match(prompt, /想请许青帮我查一下新书/);
    assert.doesNotMatch(prompt, /禁用秘密|无关私密资料/);
    assert.equal(h.state.calls[0].options.background, true);
    assert.equal(h.api.rows()[0].request.decisionRoute, 'agent');
    assert.equal(h.state.saves.at(-1)[0].chatConfig.worldNpcFriends.requests[0].card.name, '许青');
});

test('the actual hidden Agent verdict/parser and after-reply pipeline create requests only for true', async () => {
    for (const verdict of [false, true]) {
        const h = harness();
        assert.match(h.context.buildWechatAgentInstructions(h.source), /npcFriend/);
        const result = await h.context.consumeWechatAgentResponse(h.source, '我来安排。<bynd_decide>' + JSON.stringify({ status: false, memory: false, moment: false, npcFriend: verdict }) + '</bynd_decide>');
        assert.equal(result.content, '我来安排。');
        assert.equal(result.decisions.npcFriend, verdict);
        let work;
        const original = h.api.consider;
        h.api.consider = (...args) => (work = original(...args));
        await h.context.runWechatTurnFollowUps(h.source, { replyDecisions: result.decisions });
        if (work) await work;
        assert.equal(h.api.pendingCount(), verdict ? 1 : 0);
        assert.equal(h.state.calls.length, verdict ? 1 : 0);
    }
});

test('JEV gets the same story question in its turn request and only confident true proceeds', async () => {
    for (const [value, confident] of [[true, true], [false, true], [true, false]]) {
        const h = harness();
        let questionCount = 0;
        h.context.ByndJev = {
            available: scope => scope === 'turn',
            ask: async (scope, state, questions) => {
                questionCount++;
                assert.equal(scope, 'turn');
                assert.match(questions.npcFriend.instructions, /specific chat storyline/);
                assert.equal(state.npcFriend.worldTree.length, 1);
                return { status: { value: false, confident: true }, memory: { value: false, confident: true }, moment: { value: false, confident: true }, npcFriend: { value, confident } };
            }
        };
        assert.equal(h.context.ByndDecider.replyInstructions(h.source), '');
        let work;
        const original = h.api.consider;
        h.api.consider = (...args) => (work = original(...args));
        await h.context.runWechatTurnFollowUps(h.source);
        if (work) await work;
        assert.equal(questionCount, 1);
        assert.equal(h.api.pendingCount(), value && confident ? 1 : 0);
        if (value && confident) assert.equal(h.api.rows()[0].request.decisionRoute, 'jev');
    }
});

test('a model may veto an unnecessary request even after a positive turn verdict', async () => {
    const h = harness(); h.state.data = { needed: false };
    assert.equal(await generate(h), false);
    assert.equal(h.api.rows().length, 0);
    assert.equal(h.state.notices.length, 0);
    assert.equal(h.source.chatConfig.worldNpcFriends.lastError, '');
    assert.equal(await generate(h), false, 'the same completed turn is never retried');
    assert.equal(h.state.calls.length, 1);
});

test('acceptance preserves persona and opening, then creates exactly one ordinary contact', async () => {
    const h = harness(); await generate(h);
    const id = h.api.rows()[0].request.id;
    assert.equal(await h.api.resolve(id, 'accept'), true);
    assert.equal(await h.api.resolve(id, 'accept'), false);
    const contact = h.context.myCharacters[1];
    assert.equal(contact.name, '许青');
    assert.equal(contact.chatConfig.npcSourceCharId, 'lin');
    assert.equal(contact.history[0].content, h.state.data.card.firstMessage);
    assert.equal(contact.history[0].isMe, false);
    assert.equal(contact.isGroupNpc, undefined);
    assert.equal(h.api.rows().length, 1);
    assert.equal(h.api.rows()[0].request.contactId, contact.id);
    assert.equal(h.state.saves.at(-1).length, 2);
});

test('NPC opening slash separators create independent bubbles without breaking URLs or literal slashes', () => {
    const h = harness();
    const text = '前两天聚餐时听他提起要找我拿份材料/留几张内场通行证给你，顺手把你的联系方式推给我了。';
    assert.deepEqual(Array.from(h.api.splitOpening(text)), ['前两天聚餐时听他提起要找我拿份材料', '留几张内场通行证给你，顺手把你的联系方式推给我了。']);
    assert.deepEqual(Array.from(h.api.splitOpening('你好／我是许青//有事微信找我。')), ['你好', '我是许青', '有事微信找我。']);
    for (const literal of ['链接 https://example.com/a/b?x=1', '2026/10/17 见，进度 1/2。', '文件 assets/avatars/default.webp', '代码 `a/b`', '```js\na/b\n```']) {
        assert.deepEqual(Array.from(h.api.splitOpening(literal)), [literal]);
    }
    assert.deepEqual(Array.from(h.api.splitOpening('你好/链接 https://example.com/a/b?x=1')), ['你好', '链接 https://example.com/a/b?x=1']);
});

test('NPC openings become separate saved messages, preserving text, explicit separators and timestamps', async () => {
    const h = harness();
    const text = '上官小姐你好啊！通过得挺快嘛。我是谢昭南，就江闻远那块木头的发小。前两天聚餐时听他提起要找我拿份材料/留几张内场通行证给你，顺手把你的联系方式推给我了。在燕京有什么想玩的或者需要帮忙的尽管提，我这儿管够！';
    const parts = Array.from(h.api.splitOpening(text));
    assert.ok(parts.length >= 3);
    assert.equal(parts.join(''), text.replace('/', ''));
    assert.deepEqual(Array.from(h.api.splitOpening(parts.join('\n\n'))), parts);
    assert.deepEqual(Array.from(h.api.splitOpening('你好，刚通过啦。')), ['你好，刚通过啦。']);
    assert.deepEqual(Array.from(h.api.splitOpening('你好。\n\n我是许青。')), ['你好。', '我是许青。']);
    assert.deepEqual(Array.from(h.api.splitOpening('你好。|||我是许青。')), ['你好。', '我是许青。']);
    const link = '链接 https://example.com/a?x=1';
    assert.deepEqual(Array.from(h.api.splitOpening(link)), [link]);
    h.state.data.card.firstMessage = text;
    await generate(h);
    assert.equal(h.api.rows()[0].request.card.firstMessage, text, 'the request keeps the original opening');
    // Older pending requests also become actual independent messages on acceptance.
    h.api.rows()[0].request.card.firstMessage = text;
    h.context.createMessageTimestamp = () => ++h.state.time;
    await h.api.resolve(h.api.rows()[0].request.id, 'accept');
    const contact = h.context.myCharacters[1];
    assert.deepEqual(Array.from(contact.history, row => row.content), parts);
    assert.equal(new Set(contact.history.map(row => row.timestamp)).size, parts.length);
    assert.equal(contact.first_mes, text);
    assert.equal(contact.lastMsg, parts.at(-1));
});

test('legacy already-segmented opening records split middle slashes without touching history or later chat', () => {
    const h = harness();
    const parts = ['上官小姐你好啊！通过得挺快嘛。我是谢昭南，就江闻远那块木头的发小。', '前两天聚餐时听他提起要找我拿份材料/留几张内场通行证给你，顺手把你的联系方式推给我了。', '在燕京有什么想玩的或者需要帮忙的尽管提，我这儿管够！'];
    const char = { chatConfig: { npcFriendRequestId: 'legacy' }, first_mes: parts.join(''), history: parts.map(content => ({ type: 'text', isMe: false, content })) };
    const before = clone(char.history);
    assert.deepEqual(Array.from(h.api.openingPartsForMessage(char, char.history[1], 1)), ['前两天聚餐时听他提起要找我拿份材料', '留几张内场通行证给你，顺手把你的联系方式推给我了。']);
    assert.deepEqual(char.history, before);
    char.history.push({ type: 'text', isMe: true, content: '你好！' }, { type: 'text', isMe: false, content: '开场之后/正常聊天' });
    assert.equal(h.api.openingPartsForMessage(char, char.history[4], 4), null);
    char.chatConfig = {};
    assert.equal(h.api.openingPartsForMessage(char, char.history[1], 1), null);
});

test('accept/reject failures retain pending requests and never leave ghost contacts', async () => {
    for (const action of ['accept', 'reject']) {
        const h = harness(); await generate(h);
        const id = h.api.rows()[0].request.id;
        h.state.fail = true;
        assert.equal(await h.api.resolve(id, action), false);
        assert.equal(h.context.myCharacters.length, 1);
        assert.equal(h.api.rows()[0].request.status, 'pending');
        h.state.fail = false;
        assert.equal(await h.api.resolve(id, action), true);
    }
});

test('rejected and existing names cannot send duplicate requests in later plot turns', async () => {
    const h = harness(); await generate(h);
    await h.api.resolve(h.api.rows()[0].request.id, 'reject');
    nextTurn(h);
    h.state.data.card.name = '许 青';
    assert.equal(await generate(h), false);
    assert.equal(h.api.rows().length, 1);
    assert.equal(h.api.rows()[0].request.status, 'rejected');
    assert.match(h.source.chatConfig.worldNpcFriends.lastError, /重复/);
});

test('failed API/schema/plot evidence never create requests or announce success', async () => {
    for (const kind of ['api', 'json', 'reference', 'persona', 'reason', 'opening', 'evidence', 'message', 'needed']) {
        const h = harness();
        if (kind === 'api') h.state.response = { ok: false, error: '网络断开' };
        if (kind === 'json') h.state.response = { ok: true, content: '无法生成' };
        if (kind === 'reference') h.state.data.sourceEntryIndexes = [8];
        if (kind === 'persona') h.state.data.card.description = '';
        if (kind === 'reason') h.state.data.reason = '';
        if (kind === 'opening') h.state.data.card.firstMessage = '';
        if (kind === 'evidence') h.state.data.storyEvidence = '虚构的剧情依据';
        if (kind === 'message') h.state.data.sourceMessageIndexes = [99];
        if (kind === 'needed') delete h.state.data.needed;
        assert.equal(await generate(h), false, kind);
        assert.equal(h.api.pendingCount(), 0, kind);
        assert.equal(h.context.myCharacters.length, 1, kind);
        assert.equal(h.state.notices.length, 0, kind);
        assert.ok(h.source.chatConfig.worldNpcFriends.lastError, kind);
        assert.equal(await generate(h), false, 'failed turn cannot automatically loop');
    }
});

test('storage must work before API dispatch and saving the result must succeed before notification', async () => {
    const h = harness(); h.state.fail = true;
    assert.equal(await generate(h), false);
    assert.equal(h.state.calls.length, 0);
    assert.equal(h.source.chatConfig.worldNpcFriends, undefined);
    const other = harness();
    other.context.callChatApi = async () => { other.state.fail = true; return { ok: true, content: JSON.stringify(other.state.data) }; };
    assert.equal(await generate(other), false);
    assert.equal(other.api.pendingCount(), 0);
    assert.equal(other.state.notices.length, 0);
});

test('empty, blacklisted, generated and group sources are excluded; no completed chat means no request', async () => {
    for (const kind of ['empty', 'blacklisted', 'generated', 'group', 'nochat', 'unfinished']) {
        const h = harness();
        if (kind === 'empty') h.source.worldBook = [];
        if (kind === 'blacklisted') h.source.chatConfig.blacklisted = true;
        if (kind === 'generated') h.source.chatConfig.npcSourceCharId = 'other';
        if (kind === 'group') h.source.isGroupChat = true;
        if (kind === 'nochat') h.source.history = [];
        if (kind === 'unfinished') h.source.history.pop();
        assert.equal(await generate(h), false, kind);
        assert.equal(h.state.calls.length, 0, kind);
    }
});

test('in-flight work is deduplicated and discarded if chat or world book changes', async () => {
    for (const change of ['world', 'chat', 'deleted']) {
        const h = harness(); let finish;
        h.context.callChatApi = () => new Promise(resolve => { finish = resolve; });
        const work = generate(h);
        while (!finish) await Promise.resolve();
        assert.equal(await generate(h), false);
        if (change === 'world') h.source.worldBook[0].content = '已更改的世界';
        if (change === 'chat') nextTurn(h);
        if (change === 'deleted') h.context.myCharacters = [];
        finish({ ok: true, content: JSON.stringify(h.state.data) });
        assert.equal(await work, false, change);
        assert.equal(h.api.pendingCount(), 0);
    }
});

test('requests and story provenance survive the existing backup serializer and restoration', async () => {
    const h = harness(); await generate(h);
    Object.assign(h.context, { normalizeWechatCharacterAvatarData() {}, getWechatCharAvatarSource: () => '', isWechatRealAvatarSource: () => true });
    vm.runInContext(read('core/storage/characters.js'), h.context);
    const saved = clone(h.context.serializeWechatCharacterForStorage(h.source));
    const restored = harness(); restored.context.myCharacters = [saved];
    assert.equal(restored.api.rows()[0].request.storyEvidence, h.state.data.storyEvidence);
    assert.equal(await restored.api.resolve(restored.api.rows()[0].request.id, 'accept'), true);
    assert.equal(restored.context.myCharacters[1].name, '许青');
});

test('there is no plus-menu/manual/timed generation path and the contacts entry remains', () => {
    assert.doesNotMatch(read('apps/wechat/ui/render.js'), /NPC 好友申请|data-npc-friend-count/);
    assert.doesNotMatch(read('core/navigation/router.js'), /ByndNpcFriends/);
    assert.doesNotMatch(read('apps/wechat/contacts/npc-friends.js'), /setInterval|setTimeout|data-npc-action="generate"|wc-npc-controls|nextAttemptAt/);
    assert.match(read('apps/wechat/contacts/tabs.js'), /ByndNpcFriends\.entryHtml\(\)/);
});
