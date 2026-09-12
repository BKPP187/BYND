const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection, deferred } = require('./helpers/harness.cjs');

const apiSource = fs.readFileSync(path.join(root, 'chat-api.js'), 'utf8');
const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const response = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const errorResponse = (status, message, code = '', headers = {}) => response(status, { error: { message, code } }, headers);
const validSnapshot = () => ({ valid: true, updatedAt: 1800000000000, fields: { miniDiary: '已有的小日记', thoughts: '已有的想法' } });
const successResponse = snapshot => response(200, { choices: [{ message: { content: JSON.stringify(snapshot) }, finish_reason: 'stop' }] });

function harness() {
    const state = { now: 1800000000000, requests: [], saves: 0, notices: [], api: { baseUrl: 'https://example.invalid/v1', model: 'test' }, respond: () => successResponse(validSnapshot()) };
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [state.now])); }
        static now() { return state.now; }
    }
    const modal = { innerHTML: '' };
    const context = vm.createContext({
        Date: Clock, Response, Promise, Map, setTimeout, clearTimeout,
        AbortSignal: { timeout: () => undefined },
        window: { myCharacters: [] },
        console: { log() {}, warn() {}, error() {} },
        document: { getElementById: id => id === 'wc-ai-status-overlay' ? modal : null },
        getDefaultApi: () => state.api,
        fetch: async (url, options) => {
            state.requests.push({ url, options });
            return state.respond();
        },
        getWechatAiStatusSnapshot: char => char?.chatConfig?.aiStatusSnapshot || null,
        getWechatChatUserProfile: () => ({}),
        buildWechatIdentityContextPrompt: () => '', buildWechatPresetPromptForStatus: () => '',
        buildWechatRegexPromptForStatus: () => '', getWechatUserMomentsPromptForStatus: () => '',
        buildWechatPreviousAiStatusPrompt: () => '', buildWechatWorldBookPrompt: () => '',
        getWechatCharacterPersonaText: () => '', buildWechatRecentHistoryForPrompt: () => '',
        stripWechatPromptText: value => String(value),
        parseWechatJsonObject: value => { try { return JSON.parse(value); } catch { return null; } },
        normalizeWechatAiStatusSnapshot: value => value?.valid ? value : null,
        saveCharactersToStorage: () => { state.saves += 1; return Promise.resolve(true); },
        getWechatCharDisplayName: char => char.name,
        wcEscapeHtml: escapeHtml,
        quoteWechatJsString: value => `'${value}'`,
        formatWechatSnapshotTime: () => '12:00', getWechatStatusSerial: () => '1',
        getWechatStatusFieldDisplay: (snapshot, item) => snapshot.fields[item.key] || '已有状态',
        sanitizeWechatAiStatusFieldValue: value => String(value || ''),
        ensureWechatAiStatusOverlay: () => modal,
        showWechatToast: text => state.notices.push(text),
        setWechatBusyState() {}, syncWechatCurrentChatTitleState() {},
        renderChatList() {}, refreshChatView() {},
        createMessageTimestamp: () => state.now,
        splitWechatAiResponseSegments: content => [content],
        isWechatAiMetaLeakContent: () => false,
        markPendingUserPaymentsCollected: () => false,
        shouldRetryWechatImageDirectiveResponse: () => false,
        appendWechatAiMessageParts: () => 0
    });
    vm.runInContext(apiSource, context);
    for (const [start, end] of [
        ['const WECHAT_AI_STATUS_AUTO_REFRESH_COOLDOWN_MS', 'const WECHAT_HISTORY_REPAIR_SCHEMA_VERSION'],
        ['const WECHAT_AI_STATUS_FIELDS', '// --- 气泡CSS预设系统 ---'],
        ['function isWechatApiRateLimitError(', 'async function triggerAiAfterMessage('],
        ['async function triggerAiAfterMessage(', 'function resizeWechatMessageInput('],
        ['function isWechatAutoStatusSnapshotReason(', 'function buildWechatIdentityContextPrompt('],
        ['async function requestWechatAiStatusSnapshot(', 'function ensureWechatAiStatusOverlay('],
        ['function renderWechatAiStatusTicket(', 'function getWechatAiStatusHistory('],
        ['function refreshWechatAiStatusTicket(', 'function closeWechatAiStatusTicket(']
    ]) vm.runInContext(sourceSection('wechat.js', start, end), context);
    context.buildMessages = () => [];
    const char = { id: 'status-test', name: '测试角色', chatConfig: {}, history: [] };
    context.window.myCharacters.push(char);
    return { context, state, char, modal };
}

test('queued work rechecks its dispatch guard and cancels before selecting or calling the API', async () => {
    const { context, state } = harness();
    const held = deferred(); state.respond = () => held.promise;
    const first = context.callChatApi([], { background: true });
    let valid = true;
    const second = context.callChatApi([], { background: true, canSend: () => valid });
    valid = false; held.resolve(successResponse(validSnapshot()));
    await first;
    const cancelled = await second;
    assert.equal(cancelled.cancelled, true);
    assert.equal(cancelled.errorSource, 'client');
    assert.equal(state.requests.length, 1);
});

test('status requests carry the current time and the contact gap after a long absence', async () => {
    const h = harness();
    h.char.history = [
        { isMe: true, timestamp: h.state.now - 59 * 86400000, type: 'text', content: '一会儿见' },
        { isMe: false, timestamp: h.state.now - 59 * 86400000 + 60000, type: 'text', content: '在门口等你' },
        { isMe: true, timestamp: h.state.now, type: 'text', content: '最近好吗' }
    ];
    await h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'manual_refresh', force: true });
    assert.equal(h.state.requests.length, 1);
    const messages = JSON.parse(h.state.requests[0].options.body).messages;
    assert.match(messages[0].content, /当前时间锚点/);
    assert.match(messages[0].content, /1个月29天/);
    assert.match(messages[0].content, /旧场景/);
});

test('billing failures are distinct from temporary limits, including HTTP 429 insufficient_quota', async () => {
    const h = harness();
    for (const text of ['insufficient_quota', 'API 额度不足 (429)', '余额不足', 'billing_hard_limit_reached']) {
        assert.equal(h.context.isChatApiQuotaErrorText(text), true, text);
        assert.equal(h.context.isWechatApiRateLimitError(text), false, text);
    }
    assert.equal(h.context.isChatApiRateLimitResponse(429), true);
    assert.equal(h.context.isChatApiQuotaErrorText('quota exceeded for requests per minute'), false);
    h.state.respond = () => errorResponse(429, 'Account quota unavailable', 'insufficient_quota');
    const result = await h.context.callChatApi([{ role: 'user', content: 'test' }]);
    assert.equal(result.quotaExceeded, true);
    assert.equal(result.rateLimited, false);
    assert.equal(result.retryAfterMs, 0);
    assert.equal(h.context.getChatApiRateLimitPauseRemainingMs(), 0);
    assert.match(result.error, /额度不足/);
    assert.doesNotMatch(result.error, /暂停自动请求|分钟/);
});

test('Retry-After honors explicit seconds and dates without inventing a minimum or fallback delay', () => {
    const h = harness();
    const retry = value => h.context.getChatApiRateLimitRetryMs({ headers: new Headers({ 'retry-after': value }) });
    assert.equal(retry('90'), 90000);
    assert.equal(retry('3600'), 3600000, 'long provider limits must not be shortened');
    assert.equal(retry(new Date(h.state.now + 120000).toUTCString()), 120000);
    assert.equal(retry('0'), 0);
    assert.equal(retry('0.5'), 500);
    assert.equal(retry('invalid'), 0);
    assert.equal(retry(new Date(h.state.now - 120000).toUTCString()), 0);
    assert.equal(h.context.getChatApiRateLimitRetryMs(null), 0);
});

test('HTTP errors containing 429 or rate-limit wording do not create a local pause', async () => {
    for (const message of ['Invalid max_tokens value 429', 'Invalid rate limit setting', '请求频繁检查失败', '空内容字段无效']) {
        const h = harness();
        h.state.respond = () => errorResponse(400, message, 'invalid_request_error');
        const result = await h.context.callChatApi([]);
        assert.equal(result.httpStatus, 400);
        assert.equal(result.errorSource, 'provider');
        assert.equal(result.rateLimited, false);
        assert.equal(h.context.isWechatApiRateLimitError(result), false);
        assert.equal(h.context.isWechatApiRateLimitError(result.error), false);
        assert.equal(h.context.getChatApiRateLimitPauseRemainingMs(), 0);
        await h.context.callChatApi([], { background: true });
        assert.equal(h.state.requests.length, 2, message);
    }
});

test('a real limit without Retry-After is reported without making up a pause', async () => {
    for (const [status, code] of [[429, ''], [503, 'rate_limit_exceeded'], [400, 'too_many_requests']]) {
        const h = harness();
        h.state.respond = () => errorResponse(status, 'Too many requests', code);
        const first = await h.context.callChatApi([]);
        assert.equal(first.rateLimited, true);
        assert.equal(first.httpStatus, status);
        assert.equal(first.errorCode, code);
        assert.equal(first.retryAfterMs, 0);
        assert.equal(h.context.getChatApiRateLimitPauseRemainingMs(), 0);
        assert.doesNotMatch(first.error, /暂停|分钟/);
        await h.context.callChatApi([], { background: true });
        assert.equal(h.state.requests.length, 2);
    }
});

test('deferred queued work is a local deferral and does not extend the provider deadline', async () => {
    const h = harness();
    h.state.respond = () => errorResponse(429, 'Too many requests', 'rate_limit_exceeded', { 'retry-after': '45' });
    const first = await h.context.callChatApi([], { background: true });
    assert.equal(first.retryAfterMs, 45000);
    assert.equal(h.context.isWechatBackgroundApiPaused(), true);
    h.state.now += 10000;
    const blocked = await h.context.callChatApi([], { background: true });
    assert.equal(blocked.retryAfterMs, 35000);
    assert.equal(blocked.errorSource, 'client');
    assert.equal(blocked.deferred, true);
    assert.equal(blocked.rateLimited, false);
    assert.match(blocked.error, /请求未发送/);
    assert.equal(h.state.requests.length, 1);
    assert.equal(h.context.getChatApiRateLimitPauseRemainingMs(), 35000);
    h.state.now += 35001;
    assert.equal(h.context.isWechatBackgroundApiPaused(), false);
    await h.context.callChatApi([], { background: true });
    assert.equal(h.state.requests.length, 2);
});

test('provider deadlines are isolated by endpoint, model, and API key', async () => {
    const h = harness();
    const original = { ...h.state.api, apiKey: 'test-key-a' };
    h.state.api = original;
    h.state.respond = () => errorResponse(429, 'Too many requests', '', { 'retry-after': '45' });
    await h.context.callChatApi([]);
    h.state.respond = () => successResponse(validSnapshot());
    for (const changed of [{ baseUrl: 'https://other.invalid/v1' }, { model: 'other' }, { apiKey: 'test-key-b' }]) {
        h.state.api = { ...original, ...changed };
        assert.equal(h.context.isWechatAiRateLimitPaused(), false);
        assert.equal((await h.context.callChatApi([], { background: true })).ok, true);
    }
    h.state.api = original;
    assert.equal(h.context.isWechatAiRateLimitPaused(), true);
    assert.equal((await h.context.callChatApi([], { background: true })).deferred, true);
    assert.equal(h.state.requests.length, 4);
});

test('automatic status waits for the provider, while an explicit manual retry can recover immediately', async () => {
    const h = harness();
    h.state.respond = () => errorResponse(429, 'Too many requests', '', { 'retry-after': '45' });
    await h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'after_reply' });
    assert.equal(h.char.chatConfig.aiStatusRetryAt, undefined);
    assert.equal(h.state.requests.length, 1, 'rate-limit failures must not trigger a repair request');
    h.state.now += 10000;
    assert.equal(h.context.getWechatChatApiPauseRemainingMs(), 35000);
    await h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'after_reply' });
    assert.equal(h.state.requests.length, 1);
    h.state.respond = () => successResponse(validSnapshot());
    const result = await h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'manual_refresh', force: true });
    assert.equal(result.valid, true);
    assert.equal(h.state.requests.length, 2);
    assert.equal(h.char.chatConfig.aiStatusError, '');
    assert.equal(h.context.getWechatChatApiPauseRemainingMs(), 0);
});

test('legacy global and saved pauses cannot block chat or the manual refresh button', async () => {
    const h = harness();
    for (const key of ['_chatApiRateLimitPausedUntil', '_wechatAiRateLimitPausedUntil', '_wechatBackgroundApiPausedUntil']) {
        h.context.window[key] = h.state.now + 8 * 60000;
    }
    h.char.chatConfig.aiStatusRetryAt = h.state.now + 8 * 60000;
    assert.equal(h.context.isWechatAiRateLimitPaused(), false);
    assert.equal(h.context.isWechatBackgroundApiPaused(), false);
    assert.equal((await h.context.callChatApi([], { background: true })).ok, true);
    h.context.refreshWechatAiStatusTicket(h.char.id);
    await h.context.window._wechatAiStatusGenerating.get(h.char.id);
    assert.equal(h.state.requests.length, 2);
    assert.equal(h.char.chatConfig.aiStatusSnapshot.valid, true);
    assert.equal(h.state.notices.length, 0);
});

test('chat displays the actual provider error on the original request and both repair paths', async () => {
    for (const firstContent of [null, '', 'invisible response']) {
        const h = harness();
        h.context.window.currentChatCharId = h.char.id;
        h.state.respond = () => firstContent !== null && h.state.requests.length === 1
            ? response(200, { choices: [{ message: { content: firstContent }, finish_reason: 'stop' }] })
            : errorResponse(429, 'Provider request count exceeded', 'rate_limit_exceeded');
        await h.context.triggerAiAfterMessage(h.char, null);
        assert.equal(h.state.requests.length, firstContent === null ? 1 : 2);
        assert.match(h.state.notices[0], /API 错误 \(429\): Provider request count exceeded/);
        assert.doesNotMatch(h.state.notices[0], /自动回复已短暂停止/);
        assert.equal(h.context.window._wechatAiBusy, false);
        assert.equal(h.context.getWechatChatApiPauseRemainingMs(), 0);
    }
});

test('ordinary chat errors retain HTTP detail without starting a retry or pause', async () => {
    const h = harness();
    h.context.window.currentChatCharId = h.char.id;
    h.state.respond = () => errorResponse(400, '空内容 max_tokens 429');
    await h.context.triggerAiAfterMessage(h.char, null);
    assert.equal(h.state.requests.length, 1);
    assert.match(h.char.history[0].content, /API 错误 \(400\): 空内容 max_tokens 429/);
    assert.equal(h.state.notices.length, 0);
    assert.equal(h.context.window._wechatAiBusy, false);
    assert.equal(h.context.isWechatAiRateLimitPaused(), false);
});

test('a failed empty-response repair preserves its HTTP error instead of hiding it as empty content', async () => {
    const h = harness();
    h.state.respond = () => h.state.requests.length === 1
        ? response(200, { choices: [{ message: { content: '' }, finish_reason: 'length' }] })
        : errorResponse(400, 'Invalid max_tokens value 429');
    const result = await h.context.callChatApi([]);
    assert.equal(h.state.requests.length, 2);
    assert.equal(result.httpStatus, 400);
    assert.match(result.error, /Invalid max_tokens value 429/);
});

test('quota and network failures make one status request and preserve the last complete snapshot', async () => {
    for (const respond of [
        () => errorResponse(429, 'Check your billing details', 'insufficient_quota'),
        () => { throw new Error('Failed to fetch'); }
    ]) {
        const h = harness();
        const previous = validSnapshot();
        h.char.chatConfig.aiStatusSnapshot = previous;
        h.state.respond = respond;
        await h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'manual_refresh', force: true });
        assert.equal(h.state.requests.length, 1);
        assert.equal(h.char.chatConfig.aiStatusSnapshot, previous);
        assert.ok(h.char.chatConfig.aiStatusError);
        assert.equal(h.context.getWechatChatApiPauseRemainingMs(), 0);
        assert.doesNotMatch(h.char.chatConfig.aiStatusError, /5 分钟|频繁/);
    }
});

test('an incomplete successful status response gets at most one repair request', async () => {
    const h = harness();
    h.state.respond = () => successResponse(h.state.requests.length === 1 ? { incomplete: true } : validSnapshot());
    const result = await h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'after_reply' });
    assert.equal(result.valid, true);
    assert.equal(h.state.requests.length, 2);
    const broken = harness();
    broken.state.respond = () => successResponse({ incomplete: true });
    await broken.context.requestWechatAiStatusSnapshot(broken.char, { reason: 'after_reply' });
    assert.equal(broken.state.requests.length, 2);
    assert.match(broken.char.chatConfig.aiStatusError, /JSON 不完整/);
});

test('overlapping automatic and manual status refreshes share one request and one saved snapshot', async () => {
    const h = harness();
    const pending = deferred();
    h.state.respond = () => pending.promise;
    const first = h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'after_reply' });
    const second = h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'manual_refresh', force: true });
    await Promise.resolve();
    assert.equal(h.state.requests.length, 1);
    pending.resolve(successResponse(validSnapshot()));
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a, b);
    assert.equal(h.char.chatConfig.aiStatusHistory.length, 1);
    assert.equal(h.state.saves, 1);
    assert.equal(h.context.window._wechatAiStatusGenerating.size, 0);
});

test('status failures show a separate notice and a usable refresh action instead of replacing the diary', () => {
    const h = harness();
    h.char.chatConfig.aiStatusError = 'API 额度不足 (429): insufficient_quota';
    h.context.renderWechatAiStatusTicket(h.char);
    assert.match(h.modal.innerHTML, /wc-ai-status-sync[\s\S]*API 额度不足 \(429\): insufficient_quota/);
    assert.match(h.modal.innerHTML, /onclick="refreshWechatAiStatusTicket/);
    const guestbook = h.modal.innerHTML.match(/class="wc-ai-status-guestbook">([\s\S]*?)<\/div>/)[1];
    assert.doesNotMatch(guestbook, /配额|限流|5 分钟/);
    h.char.chatConfig.aiStatusSnapshot = validSnapshot();
    h.context.renderWechatAiStatusTicket(h.char);
    assert.match(h.modal.innerHTML, /已有的小日记/);
});

test('provider errors redact the current API key and render HTML as text', async () => {
    const h = harness();
    h.state.api.apiKey = 'test-private-key';
    h.state.respond = () => errorResponse(400, 'Invalid key test-private-key <img src=x onerror=alert(1)>');
    await h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'manual_refresh', force: true });
    assert.doesNotMatch(h.char.chatConfig.aiStatusError, /test-private-key/);
    assert.match(h.char.chatConfig.aiStatusError, /已隐藏/);
    h.context.renderWechatAiStatusTicket(h.char);
    assert.match(h.modal.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(h.modal.innerHTML, /<img src=x/);
});
