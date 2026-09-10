const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { sourceSection, clone, deferred } = require('./helpers/harness.cjs');

function harness() {
    const event = { id: 'event-1', contactName: '薛明', contactPreview: '物资已入库。', userReply: 'ok' };
    const char = { id: 'phone', name: '秦彻', history: [{ type: 'text', isMe: true, content: '看看你的手机', timestamp: 1 }], chatConfig: { aiPhoneContactReplies: { pending: [event] } } };
    const state = { requests: [], saves: 0, saved: null, notices: [], renders: 0, clock: 100, paused: false, respond: async () => ({ ok: true, content: '看到你回的消息了。|||这么主动？|||过来，给你奖励。' }), saveResult: () => true };
    const timers = [];
    const context = vm.createContext({
        window: { myCharacters: [char], currentChatCharId: char.id },
        console: { warn() {} },
        setTimeout: callback => timers.push(callback),
        cleanWechatVisibleContent: value => String(value || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim(),
        isWechatStandaloneRichOrRegexSource: () => false,
        hasWechatAiDirectiveSource: () => false,
        getWechatRichCandidateRanges: () => [],
        isWechatAiMetaLeakContent: text => /^(?:思维链|分析过程)/.test(text),
        syncWechatMessageDescription: msg => msg,
        createMessageTimestamp: () => ++state.clock,
        getWechatCharDisplayName: current => current.name,
        isWechatAiRateLimitPaused: () => state.paused,
        isWechatBackgroundApiPaused: () => false,
        callChatApi: async (messages, options) => {
            state.requests.push({ messages: clone(messages), options });
            return state.respond(messages, options);
        },
        saveCharactersToStorage: async () => {
            const result = await state.saveResult(++state.saves);
            if (result !== false) state.saved = clone(char);
            return result;
        },
        renderChatList() {},
        refreshChatView: () => { state.renders += 1; },
        showWechatToast: text => state.notices.push(text)
    });
    for (const [start, end] of [
        ['function getWechatAiPhoneContactReplyStore(', 'function getWechatAiPhoneContactKey('],
        ['function splitWechatSentenceChunks(', 'function isWechatOfflineNarrationSentence('],
        ['function splitWechatAiResponseSegments(', 'function getWechatLastAiBatchStartIndex('],
        ['function buildWechatAiPhoneContactReplyReactionPrompt(', 'function closeWechatAiPhone() {']
    ]) vm.runInContext(sourceSection('wechat.js', start, end), context);
    return { char, event, state, context, timers };
}

test('phone-triggered replies save separate bubbles for message separators and newlines', async () => {
    for (const separator of ['|||', '\n\n', '\n']) {
        const h = harness();
        const parts = ['看到你回的消息了。', '这么主动？', '过来，给你奖励。'];
        h.state.respond = async () => ({ ok: true, content: parts.join(separator) });
        assert.equal(await h.context.triggerWechatAiPhoneContactReplyReaction(h.char, [h.event]), true);
        assert.deepEqual(h.char.history.slice(1).map(msg => msg.content), parts);
        assert.ok(h.char.history.slice(1).every(msg => msg.type === 'text' && !msg.isMe));
        assert.equal(new Set(h.char.history.slice(1).map(msg => msg.timestamp)).size, 3);
        assert.deepEqual(h.state.saved.history.slice(1).map(msg => msg.content), parts);
        assert.equal(h.state.saved.chatConfig.aiPhoneContactReplies.pending.length, 0);
        assert.match(h.state.requests[0].messages[0].content, /多个短气泡/);
    }
});

test('a long unsplit phone reaction uses normal sentence boundaries without losing its words', async () => {
    const h = harness();
    const content = '拿着我的手机替我回消息，这么自觉帮我处理暗点的公务？薛明看到那个“ok”，大概还要想一想我是不是被盗号了。不过，既然你替我省了工作的时间，回头就不用再去问这些细节了。你要的抱和亲，我现在就结给你。等这边的工作处理完，我们再一起去楼下走一会儿，那里的灯光也已经亮起来了。';
    h.state.respond = async () => ({ ok: true, content });
    await h.context.triggerWechatAiPhoneContactReplyReaction(h.char, [h.event]);
    assert.ok(h.char.history.length > 2);
    assert.equal(h.char.history.slice(1).map(msg => msg.content).join(''), content);
});

test('API failures and invisible replies retain the pending event and show an error', async () => {
    for (const response of [{ ok: false, error: 'API 错误 (503)' }, { ok: true, content: '<think>内部分析</think>' }]) {
        const h = harness();
        const history = clone(h.char.history);
        h.state.respond = async () => response;
        assert.equal(await h.context.triggerWechatAiPhoneContactReplyReaction(h.char, [h.event]), false);
        assert.deepEqual(h.char.history, history);
        assert.equal(h.char.chatConfig.aiPhoneContactReplies.pending[0].id, h.event.id);
        assert.equal(h.state.renders, 0);
        assert.match(h.state.notices[0], /回复未完成/);
    }
});

test('storage failures prevent API use or roll back all generated bubbles together', async () => {
    for (const failureAt of [1, 2]) {
        const h = harness();
        const history = clone(h.char.history);
        h.state.saveResult = count => count !== failureAt;
        assert.equal(await h.context.triggerWechatAiPhoneContactReplyReaction(h.char, [h.event]), false);
        assert.equal(h.state.requests.length, failureAt === 1 ? 0 : 1);
        assert.deepEqual(h.char.history, history);
        assert.equal(h.char.chatConfig.aiPhoneContactReplies.pending[0].id, h.event.id);
        assert.match(h.state.notices[0], /保存/);
    }
});

test('a failed reaction save keeps a concurrently added user message and proxy event', async () => {
    const h = harness();
    const lateEvent = { id: 'event-2', contactName: '薛明', userReply: '收到' };
    h.state.saveResult = count => {
        if (count !== 2) return true;
        h.char.history.push({ type: 'text', isMe: true, content: '新消息', timestamp: 900 });
        h.char.chatConfig.aiPhoneContactReplies.pending.push(lateEvent);
        return false;
    };
    await h.context.triggerWechatAiPhoneContactReplyReaction(h.char, [h.event]);
    assert.deepEqual(h.char.history.map(msg => msg.content), ['看看你的手机', '新消息']);
    assert.deepEqual(Array.from(h.char.chatConfig.aiPhoneContactReplies.pending, event => event.id), ['event-1', 'event-2']);
});

test('reopening during a pending reaction does not duplicate it and new events drain afterward', async () => {
    const h = harness();
    const pending = deferred();
    h.state.respond = () => pending.promise;
    assert.equal(h.context.flushWechatAiPhoneContactReplyReactions(h.char), true);
    const first = h.context.window._wechatAiPhoneContactReplyGenerating.get(h.char.id);
    assert.equal(h.context.flushWechatAiPhoneContactReplyReactions(h.char), false);
    h.char.chatConfig.aiPhoneContactReplies.pending.push({ ...h.event, id: 'event-2', userReply: '再检查一下' });
    pending.resolve({ ok: true, content: '第一条。|||第二条。' });
    assert.equal(await first, true);
    assert.equal(h.state.requests.length, 1);
    assert.deepEqual(Array.from(h.char.chatConfig.aiPhoneContactReplies.pending, event => event.id), ['event-2']);
    assert.equal(h.timers.length, 1);
    h.state.respond = async () => ({ ok: true, content: '新事件的回应。|||还有一句。' });
    h.timers.shift()();
    await h.context.window._wechatAiPhoneContactReplyGenerating.get(h.char.id);
    assert.equal(h.state.requests.length, 2);
    assert.equal(h.char.chatConfig.aiPhoneContactReplies.pending.length, 0);
    assert.equal(h.char.history.length, 5);
});

test('failed background reactions stop retries and paused APIs keep pending events untouched', async () => {
    const h = harness();
    h.state.respond = async () => ({ ok: false, error: 'API 错误 (429)' });
    h.context.flushWechatAiPhoneContactReplyReactions(h.char);
    assert.equal(await h.context.window._wechatAiPhoneContactReplyGenerating.get(h.char.id), false);
    assert.equal(h.timers.length, 0);
    assert.equal(h.char.chatConfig.aiPhoneContactReplies.pending.length, 1);
    h.state.paused = true;
    assert.equal(h.context.flushWechatAiPhoneContactReplyReactions(h.char), false);
    assert.equal(h.state.requests.length, 1);
});
