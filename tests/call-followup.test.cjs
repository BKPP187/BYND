const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { sourceSection, deferred } = require('./helpers/harness.cjs');

function harness() {
    const char = { id: 'peer', name: '角色', history: [] };
    const state = { requests: [], queued: [], toasts: [], saves: 0, appended: 0 };
    const context = vm.createContext({
        window: { myCharacters: [char], currentChatCharId: char.id },
        console: { warn() {} }, Date, AbortController, clearInterval,
        document: { getElementById: () => null },
        createMessageTimestamp: () => Date.now(),
        saveCharactersToStorage: async () => { state.saves++; return true; },
        syncWechatMessageDescription: msg => msg,
        getWechatCharDisplayName: char => char.name,
        DEFAULT_AVATAR: 'avatar',
        refreshChatView() {}, renderChatList() {}, setWechatBusyState() {},
        syncWechatCurrentChatTitleState() {}, setWechatCallTyping() {}, stopWechatCallCameraStream() {},
        queueWechatAutoReplyToChar: (...args) => state.queued.push(args),
        buildMessages: (char, history, limit = 30) => [
            { role: 'system', content: '人设世界书'.repeat(3000) },
            ...history.slice(-limit).map(msg => ({ role: msg.isMe ? 'user' : 'assistant', content: msg.content || '通话记录' }))
        ],
        prepareChatApiPromptText: (text, limit) => text.slice(0, limit),
        callChatApi: async (messages, options) => {
            state.requests.push({ messages, options });
            return state.respond ? state.respond() : { ok: true, content: '刚才怎么挂了？' };
        },
        isWechatApiRateLimitError: result => !!result.rateLimited,
        showWechatToast: text => state.toasts.push(text),
        consumeWechatAvatarDirective: (char, content) => ({ content }),
        splitWechatAiResponseSegments: text => [text], isWechatAiMetaLeakContent: () => false,
        appendWechatAiMessageParts: (char, el, text, options) => {
            assert.equal(options.textOnly, true);
            state.appended++;
            char.history.push({ type: 'text', isMe: false, content: text });
            return 1;
        },
        markPendingUserPaymentsCollected: () => false,
        showWechatDesktopMessageIsland() {}, runWechatTurnFollowUps() {},
        buildWechatAgentInstructions: () => { throw new Error('post-call replies must not include tool instructions'); }
    });
    vm.runInContext(sourceSection('apps/wechat/chat/calls.js', 'function getWechatCallLabel(', 'function getWechatCallIcon('), context);
    vm.runInContext(sourceSection('apps/wechat/chat/calls.js', 'function addWechatCallRecord(', 'function openWechatCallPortraitPreview('), context);
    context.getWechatCallParticipants = () => [];
    context.formatWechatDuration = seconds => `${seconds}秒`;
    vm.runInContext(sourceSection('apps/wechat/chat/streaming.js', 'function linkWechatUsageLedgerSource(', 'function resizeWechatMessageInput('), context);
    const call = {
        id: 'call-1', charId: char.id, type: 'voiceCall', direction: 'outgoing',
        acceptedAt: Date.now() - 1000, startedAt: Date.now() - 1000,
        lines: [{ role: 'user', content: '我先去忙了' }, { role: 'assistant', content: '等你回来' }],
        requestController: new AbortController()
    };
    context.window._wechatActiveCall = call;
    return { context, char, state, call };
}

test('user hangup cancels the old request and queues exactly one text follow-up with call context', () => {
    const h = harness();
    h.context.endWechatCall();
    h.context.endWechatCall();
    assert.equal(h.call.requestController.signal.aborted, true);
    assert.equal(h.context.window._wechatActiveCall, null);
    assert.equal(h.state.queued.length, 1);
    assert.equal(h.state.queued[0][2].replyToCallId, h.call.id);
    assert.equal(h.state.queued[0][2].textOnly, true);
    const event = h.char.history.find(msg => msg.eventKind === 'user_ended_call');
    assert.equal(event.hiddenFromChat, true);
    assert.equal(event.callTranscript[0].content, '我先去忙了');
});

test('unconnected cancellation and character hangup do not queue a user-hangup reply', () => {
    for (const connected of [false, true]) {
        const h = harness();
        if (!connected) h.call.acceptedAt = null;
        h.context.endWechatCall(connected ? '对方已挂断' : '已结束');
        assert.equal(h.call.requestController.signal.aborted, true);
        assert.equal(h.state.queued.length, 0);
    }
});

test('post-call timeout retries a smaller text request, preserves history and saves only the reply', async () => {
    const h = harness();
    h.char.history = Array.from({ length: 20 }, (_, i) => ({ type: 'text', content: `聊天${i}`, isMe: true }));
    h.char.history.push({ type: 'image', isMe: true, content: 'data:image/png;base64,large', description: '窗边照片' });
    h.context.endWechatCall();
    const before = JSON.stringify(h.char.history);
    h.state.respond = () => h.state.requests.length === 1
        ? { ok: false, timedOut: true, error: '超时' } : { ok: true, content: '忙完再找我。' };
    await h.context.triggerAiAfterMessage(h.char, null, h.state.queued[0][2]);
    assert.equal(h.state.requests.length, 2);
    assert.ok(JSON.stringify(h.state.requests[1].messages).length < JSON.stringify(h.state.requests[0].messages).length);
    assert.match(JSON.stringify(h.state.requests[1].messages), /我先去忙了/);
    assert.doesNotMatch(JSON.stringify(h.state.requests[0].messages), /data:image/);
    assert.equal(JSON.stringify(h.char.history.slice(0, -1)), before);
    assert.equal(h.state.appended, 1);
    assert.equal(h.char.history.at(-1).apiError, undefined);
    assert.equal(h.context.window._wechatAiBusy, false);
});

test('a second timeout or provider failure remains an explicit error with no extra retries', async () => {
    for (const mode of ['timeout', 'provider', 'retry-provider']) {
        const h = harness(); h.context.endWechatCall();
        h.state.respond = () => mode === 'timeout' || (mode === 'retry-provider' && h.state.requests.length === 1)
            ? { ok: false, timedOut: true, error: '超时' }
            : { ok: false, httpStatus: 500, error: 'API 错误 (500)' };
        await h.context.triggerAiAfterMessage(h.char, null, h.state.queued[0][2]);
        assert.equal(h.state.requests.length, mode === 'provider' ? 1 : 2);
        assert.equal(h.state.appended, 0);
        assert.equal(h.char.history.at(-1).apiError, true);
        assert.match(h.char.history.at(-1).content, mode === 'timeout' ? /已缩短上下文重试一次/ : /500/);
        assert.equal(h.context.window._wechatAiBusy, false);
    }
});

test('late call results cannot append a reply after hangup', async () => {
    const h = harness();
    vm.runInContext(sourceSection('apps/wechat/chat/calls.js', 'async function sendWechatCallMessage(', 'function addWechatCallRecord('), h.context);
    const pending = deferred();
    h.state.respond = () => pending.promise;
    const input = { value: '等一下', disabled: false };
    h.context.document.getElementById = id => id === 'wc-call-input' ? input : null;
    h.context.getWechatActiveCallChar = () => h.char;
    h.context.addWechatCallLine = (role, content) => h.call.lines.push({ role, content });
    h.context.scrollWechatCallLogToBottom = () => {};
    h.context.setWechatCallStatus = () => {};
    const sending = h.context.sendWechatCallMessage();
    h.context.endWechatCall();
    pending.resolve({ ok: true, content: '不能留下的过期回复' });
    await sending;
    assert.equal(h.call.lines.at(-1).content, '等一下');
    assert.equal(h.state.queued.length, 1);
});
