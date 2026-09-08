const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection } = require('./helpers/harness.cjs');

const apiSource = fs.readFileSync(path.join(root, 'chat-api.js'), 'utf8');
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-08T12:00:00Z').getTime();

function harness() {
    const state = { now: NOW, requests: [], fail: false };
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [state.now])); }
        static now() { return state.now; }
    }
    const context = vm.createContext({
        Date: Clock, Intl, Map, Promise, Response, setTimeout, clearTimeout,
        AbortSignal: { timeout: () => undefined },
        window: {}, console: { log() {}, warn() {}, error() {} },
        getUserProfile: () => ({ name: '用户' }),
        getWechatChatUserProfile: () => ({ name: '用户' }),
        getWechatCharDisplayName: char => char.name,
        getDefaultApi: () => ({ baseUrl: 'https://example.invalid/v1', model: 'test' }),
        stripWechatPromptText: (value, limit) => String(value || '').slice(0, limit),
        isWechatRegexPayloadMessage: msg => !!msg?.regexPayload || msg?.type === 'regex_payload',
        isWechatSpecialMessage: () => false,
        getWechatAiStatusSnapshot: char => char.chatConfig?.aiStatusSnapshot || null,
        sanitizeWechatAiStatusFieldValue: value => String(value || ''),
        isWechatStatusPlaceholderValue: value => !value,
        fetch: async (url, options) => {
            state.requests.push(JSON.parse(options.body));
            return state.fail
                ? new Response(JSON.stringify({ error: { message: 'Temporary outage' } }), { status: 503 })
                : new Response(JSON.stringify({ choices: [{ message: { content: '好久不见，最近怎么样？' }, finish_reason: 'stop' }] }));
        }
    });
    vm.runInContext(apiSource, context);
    vm.runInContext(sourceSection('wechat.js', 'function createMessageTimestamp(', 'function getWechatHistoryVersionKey('), context);
    vm.runInContext(sourceSection('wechat.js', 'function getWechatMessagePromptContent(', 'function cleanWechatJsonCandidate('), context);
    vm.runInContext('const WECHAT_AI_STATUS_FIELDS = [{ key: "action" }];', context);
    vm.runInContext(sourceSection('wechat.js', 'function buildWechatPreviousAiStatusPrompt(', 'function buildWechatWorldBookPrompt('), context);
    const char = { id: 'time-test', name: '测试角色', description: '说话自然，记得用户喜欢茶。', chatConfig: { timeMode: 'real' }, history: [] };
    return { context, state, char };
}

function message(isMe, timestamp, content = isMe ? '你好' : '我在门口等你', extra = {}) {
    return { isMe, timestamp, type: 'text', content, ...extra };
}

function oldConversation(h) {
    h.char.history = [
        message(true, NOW - 59 * DAY, '我过一会儿来'),
        message(false, NOW - 59 * DAY + 60000)
    ];
}

const timePrompt = h => h.context.buildCurrentTimeAnchor(h.char);

test('a new user message preserves a 59-day absence instead of resetting it to just now', () => {
    const h = harness();
    oldConversation(h);
    h.char.history.push(message(true, NOW));
    const prompt = timePrompt(h);
    assert.match(prompt, /59天|1个月29天/);
    assert.match(prompt, /本次联系|本次恢复联系/);
    assert.match(prompt, /旧场景|历史场景/);
    assert.match(prompt, /长期记忆|稳定关系/);
    assert.match(prompt, /2026年9月8日/);
});

test('multiple pending messages and a subsequent reply retain the same contact boundary', () => {
    const h = harness();
    oldConversation(h);
    h.char.history.push(message(true, NOW - 120000), message(true, NOW - 60000));
    assert.match(timePrompt(h), /58天|1个月28天/);
    h.char.history.push(message(false, NOW - 30000, '好久不见'), message(true, NOW, '最近好吗'));
    assert.match(timePrompt(h), /58天|1个月28天/);
    assert.match(timePrompt(h), /不要.*反复|不必.*反复/);
});

test('assistant background messages and internal events do not count as the user returning', () => {
    const h = harness();
    oldConversation(h);
    h.char.history.push(
        message(false, NOW - 60000, '今天有点想你', { background: true }),
        message(true, NOW - 30000, '状态刷新', { hiddenFromChat: true }),
        message(true, NOW - 20000, '监控事件', { monitorEvent: true }),
        message(true, NOW - 10000, '系统通知', { type: 'system_notice' }),
        message(true, NOW - 5000, '内部活动', { type: 'user_event' })
    );
    assert.match(timePrompt(h), /59天|1个月29天/);
    assert.doesNotMatch(h.context.buildWechatRecentHistoryForPrompt(h.char), /状态刷新|监控事件|系统通知|内部活动/);
    h.char.history.push(message(true, NOW));
    assert.match(timePrompt(h), /59天|1个月29天/);
});

test('ordinary continuous chat does not invent a long absence or a reunion', () => {
    const h = harness();
    h.char.history = [message(true, NOW - 120000), message(false, NOW - 60000), message(true, NOW)];
    assert.doesNotMatch(timePrompt(h), /本次恢复联系前|两次联系相隔|未联系了/);
});

test('virtual time does not compare the fictional date with real storage timestamps', () => {
    const h = harness();
    oldConversation(h);
    h.char.chatConfig = { timeMode: 'virtual', virtualTime: '2035-02-14T10:30:00' };
    h.char.history.push(message(true, NOW));
    const prompt = timePrompt(h);
    assert.match(prompt, /2035年2月14日/);
    assert.match(prompt, /虚拟时间/);
    assert.doesNotMatch(prompt, /59天|1个月29天|本次恢复联系前|上一次可见聊天时间/);
    const payload = h.context.buildMessages(h.char, h.char.history);
    assert.doesNotMatch(JSON.stringify(payload), /2026年7月|2026年9月/);
});

test('outgoing history carries dates, preserves images and quotes, and leaves stored chat untouched', () => {
    const h = harness();
    oldConversation(h);
    h.char.history.push(message(true, NOW, '看这张照片', {
        type: 'image', imageUrl: 'data:image/png;base64,dGVzdA==', caption: '看这张照片',
        replyTo: { text: '我在门口等你', sender: h.char.name }
    }));
    const before = JSON.stringify(h.char.history);
    const messages = h.context.buildMessages(h.char, h.char.history);
    const historicalReply = messages.find(item => item.role === 'assistant');
    assert.match(historicalReply.content, /消息时间.*2026年7月/);
    const latest = messages.findLast(item => item.role === 'user');
    assert.ok(Array.isArray(latest.content));
    assert.equal(latest.content.find(part => part.type === 'image_url').image_url.url, 'data:image/png;base64,dGVzdA==');
    const text = latest.content.find(part => part.type === 'text').text;
    assert.match(text, /引用测试角色/);
    assert.match(text, /消息时间.*2026年9月8日/);
    assert.match(text, /59天|1个月29天/);
    assert.equal(JSON.stringify(h.char.history), before);
});

test('a history limit cannot erase the contact gap, and a supplied history is authoritative', () => {
    const h = harness();
    oldConversation(h);
    const selected = [...h.char.history, message(true, NOW)];
    h.char.history = [message(true, NOW, '其他分支')];
    const messages = h.context.buildMessages(h.char, selected, 1);
    assert.match(JSON.stringify(messages), /59天|1个月29天/);
    assert.equal(messages.filter(item => item.role === 'user' || item.role === 'assistant').length, 1);
});

test('status and other secondary prompts receive dated history and a dated previous snapshot', () => {
    const h = harness();
    oldConversation(h);
    const recent = h.context.buildWechatRecentHistoryForPrompt(h.char);
    assert.match(recent, /消息时间.*2026年7月/);
    h.char.chatConfig.aiStatusSnapshot = { updatedAt: NOW - 59 * DAY, fields: { action: '在门口等用户' } };
    const snapshot = h.context.buildWechatPreviousAiStatusPrompt(h.char);
    assert.match(snapshot, /2026年7月/);
    assert.match(snapshot, /历史状态|当时状态/);
});

test('unknown, invalid, future and repaired timestamps cannot fabricate a contact date', () => {
    for (const timestamp of [undefined, 'invalid', NOW + DAY]) {
        const h = harness();
        h.char.history = [message(true, timestamp), message(false, timestamp)];
        assert.match(timePrompt(h), /时间不详|时间未知|无法确认/);
        assert.doesNotMatch(timePrompt(h), /本次恢复联系前|两次联系相隔/);
    }
    const h = harness();
    const imported = { isMe: true, content: '旧导入记录', type: 'text' };
    h.context.ensureMessageTimestamp(imported);
    h.char.history = [imported];
    assert.match(timePrompt(h), /时间不详|时间未知|无法确认/);
});

test('a provider failure and retry send the same absence context without rewriting history', async () => {
    const h = harness();
    oldConversation(h);
    h.char.history.push(message(true, NOW));
    const before = JSON.stringify(h.char.history);
    h.state.fail = true;
    const failed = await h.context.callChatApi(h.context.buildMessages(h.char, h.char.history));
    assert.equal(failed.ok, false);
    h.state.fail = false;
    const retried = await h.context.callChatApi(h.context.buildMessages(h.char, h.char.history));
    assert.equal(retried.ok, true);
    assert.equal(h.state.requests.length, 2);
    for (const request of h.state.requests) assert.match(JSON.stringify(request.messages), /59天|1个月29天/);
    assert.equal(JSON.stringify(h.char.history), before);
});

test('legacy ISO, numeric-string and Unix-second timestamps retain their actual contact dates', () => {
    for (const value of [new Date(NOW - 59 * DAY).toISOString(), String(NOW - 59 * DAY), (NOW - 59 * DAY) / 1000]) {
        const h = harness();
        h.char.history = [message(true, value), message(true, NOW)];
        assert.match(timePrompt(h), /59天|1个月29天/);
    }
    const h = harness();
    h.char.history = [message(true, 'invalid', '旧消息', { createdAt: NOW - 59 * DAY }), message(true, NOW)];
    assert.match(timePrompt(h), /59天|1个月29天/);
});

test('a short overnight pause keeps the real calendar date without replaying an earlier reunion', () => {
    const h = harness();
    oldConversation(h);
    h.char.history.push(message(true, NOW - DAY), message(false, NOW - DAY + 60000), message(true, NOW));
    assert.match(timePrompt(h), /两次联系相隔约1天/);
    assert.doesNotMatch(timePrompt(h), /59天|1个月29天/);
    assert.match(timePrompt(h), /正常连续聊天应自然衔接/);
});
