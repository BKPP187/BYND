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
    const state = { now: 1800000000000, requests: [], saves: 0, notices: [], respond: () => successResponse(validSnapshot()) };
    class Clock extends Date { static now() { return state.now; } }
    const modal = { innerHTML: '' };
    const context = vm.createContext({
        Date: Clock, Response, Promise, Map, setTimeout, clearTimeout,
        AbortSignal: { timeout: () => undefined },
        window: { myCharacters: [] },
        console: { log() {}, warn() {}, error() {} },
        document: { getElementById: id => id === 'wc-ai-status-overlay' ? modal : null },
        getDefaultApi: () => ({ baseUrl: 'https://example.invalid/v1', model: 'test' }),
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
        showWechatToast: text => state.notices.push(text)
    });
    vm.runInContext(apiSource, context);
    for (const [start, end] of [
        ['const WECHAT_BACKGROUND_API_PAUSE_MS', 'const WECHAT_HISTORY_REPAIR_SCHEMA_VERSION'],
        ['const WECHAT_AI_STATUS_FIELDS', '// --- 气泡CSS预设系统 ---'],
        ['function isWechatApiRateLimitError(', 'async function triggerAiAfterMessage('],
        ['function isWechatAutoStatusSnapshotReason(', 'function buildWechatIdentityContextPrompt('],
        ['async function requestWechatAiStatusSnapshot(', 'function ensureWechatAiStatusOverlay('],
        ['function getWechatAiStatusFriendlyErrorText(', 'function getWechatAiStatusHistory('],
        ['function refreshWechatAiStatusTicket(', 'function closeWechatAiStatusTicket(']
    ]) vm.runInContext(sourceSection('wechat.js', start, end), context);
    const char = { id: 'status-test', name: '测试角色', chatConfig: {}, history: [] };
    context.window.myCharacters.push(char);
    return { context, state, char, modal };
}

test('billing failures are distinct from temporary limits, including HTTP 429 insufficient_quota', async () => {
    const h = harness();
    for (const text of ['insufficient_quota', 'API 额度不足 (429)', '余额不足', 'billing_hard_limit_reached']) {
        assert.equal(h.context.isChatApiQuotaErrorText(text), true, text);
        assert.equal(h.context.isWechatApiRateLimitError(text), false, text);
    }
    assert.equal(h.context.isChatApiRateLimitErrorText('API 错误 (429): quota exceeded for requests per minute'), true);
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

test('Retry-After honors seconds and dates without turning milliseconds into minutes', () => {
    const h = harness();
    const retry = value => h.context.getChatApiRateLimitRetryMs({ headers: new Headers({ 'retry-after': value }) });
    assert.equal(retry('90'), 90000);
    assert.equal(retry('3600'), 3600000, 'long provider limits must not be shortened');
    assert.equal(retry(new Date(h.state.now + 120000).toUTCString()), 120000);
    assert.equal(retry('0'), 30000, 'immediate retry guidance still keeps the local minimum pause');
    assert.equal(h.context.getChatApiRateLimitRetryMs(null, 'retry after 500 ms'), 30000);
    assert.equal(h.context.getChatApiRateLimitRetryMs(null, 'retry after 2 minutes'), 120000);
});

test('blocked queued work reuses the original cooldown deadline instead of adding another pause', async () => {
    const h = harness();
    h.state.respond = () => errorResponse(429, 'Too many requests', 'rate_limit_exceeded', { 'retry-after': '45' });
    const first = await h.context.callChatApi([], { background: true });
    assert.equal(first.retryAfterMs, 45000);
    h.context.setWechatAiRateLimitPause(first.error);
    const deadline = h.state.now + 45000;
    assert.equal(h.context.window._wechatBackgroundApiPausedUntil, deadline);
    h.state.now += 10000;
    const blocked = await h.context.callChatApi([], { background: true });
    h.context.pauseWechatBackgroundApiIfRateLimited(blocked.error);
    h.context.setWechatAiRateLimitPause(blocked.error);
    assert.equal(blocked.retryAfterMs, 35000);
    assert.equal(h.state.requests.length, 1);
    assert.equal(h.context.window._wechatBackgroundApiPausedUntil, deadline);
    assert.equal(h.context.window._wechatAiRateLimitPausedUntil, deadline);
});

test('status generation waits for the real limit, persists its deadline, and can recover after it expires', async () => {
    const h = harness();
    h.state.respond = () => errorResponse(429, 'Too many requests', '', { 'retry-after': '45' });
    await h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'after_reply' });
    const deadline = h.state.now + 45000;
    assert.equal(h.char.chatConfig.aiStatusRetryAt, deadline);
    assert.equal(h.state.requests.length, 1, 'rate-limit failures must not trigger a repair request');
    h.state.now += 10000;
    assert.match(h.context.getWechatAiStatusFriendlyErrorText(h.char.chatConfig.aiStatusError, h.char), /35 秒/);
    await h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'manual_refresh', force: true });
    assert.equal(h.state.requests.length, 1, 'manual refresh must also respect the provider cooldown');
    delete h.context.window._chatApiRateLimitPausedUntil;
    delete h.context.window._wechatBackgroundApiPausedUntil;
    assert.equal(h.context.getWechatAiStatusRetryRemainingMs(h.char), 35000, 'saved cooldown survives a page reload');
    h.state.now = deadline + 1;
    assert.match(h.context.getWechatAiStatusFriendlyErrorText(h.char.chatConfig.aiStatusError, h.char), /现在可以重试/);
    h.state.respond = () => successResponse(validSnapshot());
    const result = await h.context.requestWechatAiStatusSnapshot(h.char, { reason: 'manual_refresh', force: true });
    assert.equal(result.valid, true);
    assert.equal(h.state.requests.length, 2);
    assert.equal(h.char.chatConfig.aiStatusError, '');
    assert.equal(h.char.chatConfig.aiStatusRetryAt, 0);
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
        assert.equal(h.context.getWechatAiStatusRetryRemainingMs(h.char), 0);
        assert.doesNotMatch(h.context.getWechatAiStatusFriendlyErrorText(h.char.chatConfig.aiStatusError, h.char), /5 分钟|频繁/);
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
    assert.match(h.modal.innerHTML, /wc-ai-status-sync[\s\S]*接口余额或配额不足/);
    assert.match(h.modal.innerHTML, /onclick="refreshWechatAiStatusTicket/);
    const guestbook = h.modal.innerHTML.match(/class="wc-ai-status-guestbook">([\s\S]*?)<\/div>/)[1];
    assert.doesNotMatch(guestbook, /配额|限流|5 分钟/);
    h.char.chatConfig.aiStatusSnapshot = validSnapshot();
    h.context.renderWechatAiStatusTicket(h.char);
    assert.match(h.modal.innerHTML, /已有的小日记/);
    h.char.chatConfig.aiStatusRetryAt = h.state.now + 60000;
    h.context.refreshWechatAiStatusTicket(h.char.id);
    assert.equal(h.state.requests.length, 0);
    assert.match(h.state.notices[0], /1 分钟/);
});
