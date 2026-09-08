const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection, deferred, clone } = require('./helpers/harness.cjs');

const schema = '20260718-no-hardcoded-phone4';
const now = 1800000000000;
const message = (isMe, timestamp, extra = {}) => ({ type: 'text', isMe, timestamp, content: isMe ? '最近怎么样' : '刚下班', ...extra });
const savedPhone = (extra = {}) => ({ schemaVersion: schema, generatedBy: 'api', updatedAt: now - 1000, memos: [{ title: '已有备忘录' }], ...extra });

function harness(savedChar) {
    const char = clone(savedChar) || { id: 'phone-test', name: '测试角色', history: [], chatConfig: {} };
    const state = { requests: [], saves: 0, savedChar: null, statusBusy: false, renders: 0, saveResult: () => true, respond: async () => ({ ok: true, content: '{"memos":[{"title":"新的备忘录"}]}' }) };
    const timers = new Map();
    const nodes = new Map();
    let nextTimer = 1;
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    const context = vm.createContext({
        Date: Clock, Map, Promise, console: { warn() {}, error() {}, log() {} },
        window: { myCharacters: [char] },
        document: {
            getElementById: id => nodes.get(id) || null,
            createElement: () => ({ setAttribute() {}, remove() { nodes.delete(this.id); } })
        },
        getWechatModalRoot: () => ({ appendChild(node) { nodes.set(node.id, node); } }),
        setTimeout: fn => { const id = nextTimer++; timers.set(id, fn); return id; },
        clearTimeout: id => timers.delete(id),
        isWechatAiRateLimitPaused: () => false,
        isWechatBackgroundApiPaused: () => false,
        isWechatAiStatusGenerationActive: () => state.statusBusy,
        buildWechatAiPhoneFallback: () => ({ schemaVersion: schema, generatedBy: 'local', updatedAt: now, memos: [] }),
        withWechatAiPhoneRealUserChat: snapshot => ({ ...snapshot }),
        getWechatAiStatusSnapshot: () => ({ updatedAt: now + 10000, fields: {} }),
        buildWechatWorldBookPrompt: () => '', getWechatCharacterPersonaText: () => '',
        buildWechatRecentHistoryForPrompt: () => '', buildWechatAiPhoneProxyContinuityContext: () => '',
        getWechatAiPhoneSnapshotGapSummary: () => '',
        stripWechatPromptText: (value, max) => String(value || '').slice(0, max),
        parseWechatJsonObject: value => { try { return JSON.parse(value); } catch { return null; } },
        normalizeWechatAiPhoneSnapshot: raw => savedPhone({ ...raw, updatedAt: now }),
        renderWechatAiPhone: () => { state.renders += 1; },
        closeWechatAiPhoneErrorPrompt() {}, openWechatAiPhoneErrorPrompt() {}, flushWechatAiPhoneContactReplyReactions() {},
        saveCharactersToStorage: async () => {
            state.saves += 1;
            const saved = state.saveResult(state.saves);
            if (saved !== false) state.savedChar = clone(char);
            return saved;
        }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'chat-api.js'), 'utf8'), context);
    context.callChatApi = async (messages, options) => {
        state.requests.push({ messages, options });
        return state.respond();
    };
    vm.runInContext(`const WECHAT_AI_PHONE_SCHEMA_VERSION = '${schema}';`, context);
    vm.runInContext(sourceSection('wechat.js', 'function getWechatAiPhoneRenderSnapshot(', 'function getWechatAiPhoneSyncErrorText('), context);
    vm.runInContext(sourceSection('wechat.js', 'function closeWechatAiPhone() {', '// ========== 微信记忆系统'), context);
    const finish = async () => { await context.window._wechatAiPhoneGenerating?.get(char.id); };
    const open = () => context.openWechatAiPhone(char.id);
    const close = () => context.closeWechatAiPhone();
    return { char, state, context, timers, open, close, finish };
}

test('a new user turn waits for the AI reply, then syncs once across repeated opens and reloads', async () => {
    const h = harness();
    h.char.chatConfig.aiPhoneSnapshot = savedPhone();
    h.char.history.push(message(true, now - 100));
    h.open();
    await h.finish();
    assert.equal(h.state.requests.length, 0);
    h.char.history.push(message(false, now - 50));
    h.open();
    await h.finish();
    assert.equal(h.state.requests.length, 1);
    for (let i = 0; i < 3; i += 1) { h.close(); h.open(); await h.finish(); }
    assert.equal(h.state.requests.length, 1);
    const reloaded = harness(h.state.savedChar);
    reloaded.open();
    await reloaded.finish();
    assert.equal(reloaded.state.requests.length, 0);
});

test('new status snapshots and extra AI messages without a user reply keep the current phone', async () => {
    const h = harness();
    h.char.history = [message(true, now - 100), message(false, now - 50)];
    h.open();
    await h.finish();
    const phone = clone(h.char.chatConfig.aiPhoneSnapshot);
    h.char.history.push(message(false, now - 20), message(false, now - 10, { background: true }));
    h.open();
    await h.finish();
    assert.equal(h.state.requests.length, 1);
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneSnapshot), phone);
    h.char.history.push(message(true, now - 8), message(true, now - 6), message(false, now - 4));
    h.open();
    await h.finish();
    assert.equal(h.state.requests.length, 2);
});

test('legacy saved phones already newer than the completed turn do not incur an upgrade sync', async () => {
    const h = harness();
    h.char.chatConfig.aiPhoneSnapshot = savedPhone({ updatedAt: now - 10 });
    h.char.history = [message(true, now - 100), message(false, now - 50), message(false, now - 5)];
    h.open();
    await h.finish();
    assert.equal(h.state.requests.length, 0);
});

test('inserting an internal history record does not change the already synced user turn', async () => {
    const h = harness();
    h.char.history = [message(true, now - 100), message(false, now - 50)];
    h.open();
    await h.finish();
    h.char.history.unshift(message(false, now - 200, { type: 'system_notice' }));
    h.open();
    await h.finish();
    assert.equal(h.state.requests.length, 1);
});

test('first use without a completed conversation needs manual sync', async () => {
    const h = harness();
    h.char.history = [message(false, now - 100, { content: '角色开场白' })];
    h.open();
    await h.finish();
    assert.equal(h.state.requests.length, 0);
    h.context.regenerateWechatAiPhoneSnapshot(h.char.id);
    await h.finish();
    assert.equal(h.state.requests.length, 1);
    assert.equal(h.char.chatConfig.aiPhoneSnapshot.generatedBy, 'api');
});

test('system activity and chat API errors are not a completed AI reply', async () => {
    for (const extra of [
        { hiddenFromChat: true }, { internalEvent: true }, { monitorEvent: true },
        { type: 'system_notice' }, { type: 'user_event' }, { type: 'regex_payload' },
        { apiError: true }, { content: '\u26a0\ufe0f API 错误 (503)' }
    ]) {
        const h = harness();
        h.char.history = [message(true, now - 100), message(false, now - 50, extra)];
        h.open();
        await h.finish();
        assert.equal(h.state.requests.length, 0, JSON.stringify(extra));
    }
});

test('concurrent open and manual clicks share one request and record the turn before requesting', async () => {
    const h = harness();
    const pending = deferred();
    const started = deferred();
    h.char.history = [message(true, now - 100), message(false, now - 50)];
    h.state.respond = () => { started.resolve(); return pending.promise; };
    h.open();
    await started.promise;
    assert.equal(h.state.requests.length, 1);
    assert.ok(h.state.savedChar.chatConfig.aiPhoneSnapshot.syncTurnKey);
    h.open();
    h.context.regenerateWechatAiPhoneSnapshot(h.char.id);
    assert.equal(h.state.requests.length, 1);
    pending.resolve({ ok: true, content: '{"memos":[]}' });
    await h.finish();
});

test('sync failure preserves cached content and requires manual retry for the same turn', async () => {
    const h = harness();
    h.char.chatConfig.aiPhoneSnapshot = savedPhone();
    h.char.history = [message(true, now - 100), message(false, now - 50)];
    h.state.respond = async () => ({ ok: false, error: 'API 错误 (503)' });
    h.open();
    await h.finish();
    assert.equal(h.char.chatConfig.aiPhoneSnapshot.generatedBy, 'error');
    assert.equal(h.char.chatConfig.aiPhoneSnapshot.memos[0].title, '已有备忘录');
    const reloaded = harness(h.state.savedChar);
    reloaded.open();
    await reloaded.finish();
    assert.equal(reloaded.state.requests.length, 0);
    reloaded.context.regenerateWechatAiPhoneSnapshot(reloaded.char.id);
    await reloaded.finish();
    assert.equal(reloaded.state.requests.length, 1);
    assert.equal(reloaded.char.chatConfig.aiPhoneSnapshot.generatedBy, 'api');
});

test('an in-flight sync does not consume a newer conversation turn', async () => {
    const h = harness();
    const pending = deferred();
    h.char.history = [message(true, now - 100), message(false, now - 50)];
    const firstKey = h.context.getWechatAiPhoneSyncTurn(h.char).key;
    h.state.respond = () => pending.promise;
    h.open();
    await Promise.resolve();
    h.char.history.push(message(true, now - 20), message(false, now - 10));
    pending.resolve({ ok: true, content: '{}' });
    await h.finish();
    assert.equal(h.char.chatConfig.aiPhoneSnapshot.syncTurnKey, firstKey);
    h.open();
    await h.finish();
    assert.equal(h.state.requests.length, 2);
});

test('opening during reply or status generation defers once and closing cancels the deferred sync', async () => {
    for (const busy of ['reply', 'status']) {
        const h = harness();
        h.char.history = [message(true, now - 100), message(false, now - 50)];
        h.context.window._wechatAiBusy = busy === 'reply';
        h.state.statusBusy = busy === 'status';
        h.open();
        h.open();
        assert.equal(h.state.requests.length, 0);
        assert.equal(h.timers.size, 1);
        h.close();
        assert.equal(h.timers.size, 0);
        h.open();
        h.context.window._wechatAiBusy = h.state.statusBusy = false;
        const [id, callback] = h.timers.entries().next().value;
        h.timers.delete(id);
        callback();
        await h.finish();
        assert.equal(h.state.requests.length, 1);
    }
});

test('storage failures stop API use or show an error instead of claiming a saved sync', async () => {
    for (const failureAt of [1, 2]) {
        const h = harness();
        h.char.chatConfig.aiPhoneSnapshot = savedPhone();
        h.char.history = [message(true, now - 100), message(false, now - 50)];
        h.state.saveResult = count => count !== failureAt;
        h.open();
        await h.finish();
        assert.equal(h.state.requests.length, failureAt === 1 ? 0 : 1);
        assert.equal(h.char.chatConfig.aiPhoneSnapshot.generatedBy, 'error');
        assert.match(h.char.chatConfig.aiPhoneSnapshot.syncError, /保存/);
        assert.equal(h.char.chatConfig.aiPhoneSnapshot.memos[0].title, '已有备忘录');
        h.open();
        await h.finish();
        assert.equal(h.state.requests.length, failureAt === 1 ? 0 : 1);
    }
});
