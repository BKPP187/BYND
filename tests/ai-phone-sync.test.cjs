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
const letterBody = '你说最近想找个安静的地方坐坐，我记得这件事。今天下班经过河边，看到茶馆的窗户都打开了，里面的人不多。我想我们可以找一个都有空的下午过去，不用急着决定哪一天，等你把手里的事情忙完再说。\n我会先把这周的工作整理好，再把地址发给你。你喜欢靠窗的位置，我也觉得那里光线很好，带一本读到一半的书就够了。至于晚上吃什么，到时候再一起商量，我想听听你最近有没有发现新的小店。';
const letters = () => [
    { title: '河畔午后', subtitle: '茶馆窗边的一点想法', meta: '下班路上', salutation: '小林：', greeting: '今天过得好吗？', body: letterBody, closing: '祝你', wish: '一切顺利！', signature: '陈安', date: '2026年9月9日' },
    { title: '窗边的光', subtitle: '周末书店的约定', meta: '九月的周三', salutation: '小林：', greeting: '你好！', body: letterBody.replace('河边', '街角').replace('茶馆', '书店'), closing: '此致', wish: '敬礼！', signature: '陈安', date: '2026年9月9日' }
];
const phoneResponse = extra => ({ ok: true, content: JSON.stringify({ memos: [{ title: '新的备忘录' }], diaryLetters: letters(), ...extra }) });

function harness(savedChar) {
    const char = clone(savedChar) || { id: 'phone-test', name: '测试角色', history: [], chatConfig: {} };
    const state = { requests: [], saves: 0, savedChar: null, statusBusy: false, renders: 0, saveResult: () => true, respond: async () => phoneResponse() };
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
        cleanWechatVisibleContent: value => String(value || ''),
        normalizeWechatAiPhoneSnapshot: raw => savedPhone({ ...raw, diaryLetters: context.getWechatAiPhoneDiaryLetters(raw), updatedAt: now }),
        renderWechatAiPhone: () => { state.renders += 1; },
        closeWechatAiPhoneErrorPrompt() {}, openWechatAiPhoneErrorPrompt() {}, flushWechatAiPhoneContactReplyReactions() {},
        closeWechatAiPhoneHomeEditor() {}, closeWechatAiPhoneIconEditor() {},
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
        return state.respond(messages, options);
    };
    vm.runInContext(`const WECHAT_AI_PHONE_SCHEMA_VERSION = '${schema}';`, context);
    vm.runInContext(sourceSection('wechat.js', 'function stripWechatPromptText(', 'function formatWechatSnapshotTime('), context);
    vm.runInContext(sourceSection('wechat.js', 'function cleanWechatAiPhoneBlockText(', 'function normalizeWechatAiPhoneMemoList('), context);
    vm.runInContext(sourceSection('wechat.js', 'function cleanWechatJsonCandidate(', 'function isWechatAiStatusSnapshotComplete('), context);
    vm.runInContext(sourceSection('wechat.js', 'function isWechatAiPhoneDiaryPlaceholder(', 'function renderWechatAiPhoneDiaryMailbox('), context);
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
    pending.resolve(phoneResponse({ memos: [] }));
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
    pending.resolve(phoneResponse());
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

test('complete letters survive common punctuation, date and paragraph formats without losing text', () => {
    const h = harness();
    for (const body of [letterBody, letterBody.split('\n'), letterBody.replaceAll('\n', '\\n'), letterBody.replaceAll('\n', '<br>'), letterBody.replaceAll('\n', '')]) {
        const raw = { ...letters()[0], salutation: '小林', greeting: '今天过得好吗?', wish: '一切顺利!', date: '2026-09-09', body };
        const result = h.context.normalizeWechatAiPhoneDiaryLetterList([raw]);
        assert.equal(result.length, 1);
        assert.equal(result[0].salutation, '小林：');
        assert.equal(result[0].greeting, '今天过得好吗？');
        assert.equal(result[0].date, '2026年9月9日');
        assert.equal(result[0].body.replaceAll('\n', ''), letterBody.replaceAll('\n', ''));
        assert.ok(result[0].body.split('\n').length >= 2);
        assert.equal(result[0].signature, raw.signature);
    }
    const longer = { ...letters()[0], body: `${letterBody}\n${letterBody}\n${letterBody}` };
    assert.equal(h.context.normalizeWechatAiPhoneDiaryLetterList([longer])[0].body, longer.body);
});

test('letter normalization still rejects missing content, placeholders and impossible dates', () => {
    const h = harness();
    for (const key of ['salutation', 'greeting', 'body', 'signature', 'date']) {
        const raw = letters()[0];
        delete raw[key];
        assert.equal(h.context.normalizeWechatAiPhoneDiaryLetterList([raw]).length, 0, key);
    }
    for (const extra of [{ closing: '', wish: '' }, { body: '待补充' }, { body: '我想你了。' }, { date: '2026-02-30' }, { signature: '未填写' }]) {
        assert.equal(h.context.normalizeWechatAiPhoneDiaryLetterList([{ ...letters()[0], ...extra }]).length, 0);
    }
});

test('nonempty letter aliases and wrapped responses are read even when diaryLetters is empty', () => {
    const h = harness();
    for (const raw of [letters(), { letters: letters() }, { diaryLetters: [], letters: letters() }, { phoneData: { '信件': letters() } }, { data: { mailbox: letters() } }]) {
        assert.equal(h.context.getWechatAiPhoneDiaryLetters(raw).length, 2);
    }
});

test('manual diary sync updates only letters and preserves the full-phone turn and settings', async () => {
    const h = harness();
    h.char.chatConfig.aiPhoneSnapshot = savedPhone({ diaryLetters: [], wallet: '余额 80 元', chats: [{ name: '同事', text: '已有聊天' }], syncTurnKey: 'existing-turn', diarySyncError: '上次失败' });
    h.context.withWechatAiPhoneRealUserChat = snapshot => ({ ...snapshot, chats: [{ name: '不应由日记更新的聊天' }] });
    h.char.chatConfig.aiPhoneHomeSettings = { wallpaper: 'data:image/png;base64,wallpaper', icons: { memo: 'data:image/png;base64,icon' } };
    const before = clone(h.char.chatConfig);
    h.state.respond = async () => phoneResponse({ wallet: '不应该改写余额', memos: [{ title: '不应该改写备忘录' }] });
    const result = await h.context.regenerateWechatAiPhoneDiary(h.char.id);
    assert.equal(h.state.requests.length, 1);
    assert.match(h.state.requests[0].messages[0].content, /只生成.*两封正式中文书信/);
    assert.equal(result.diaryLetters.length, 2);
    assert.equal(result.diarySyncError, undefined);
    assert.equal(result.syncTurnKey, before.aiPhoneSnapshot.syncTurnKey);
    assert.equal(result.updatedAt, before.aiPhoneSnapshot.updatedAt);
    assert.equal(result.wallet, before.aiPhoneSnapshot.wallet);
    assert.deepEqual(clone(result.chats), before.aiPhoneSnapshot.chats);
    assert.deepEqual(clone(result.memos), before.aiPhoneSnapshot.memos);
    assert.deepEqual(clone(h.char.chatConfig.aiPhoneHomeSettings), before.aiPhoneHomeSettings);
    assert.equal(h.state.savedChar.chatConfig.aiPhoneSnapshot.diaryLetters.length, 2);
});

test('full-phone sync repairs missing letters with a diary-only request', async () => {
    const h = harness();
    h.state.respond = async () => h.state.requests.length === 1 ? phoneResponse({ diaryLetters: [] }) : phoneResponse();
    const result = await h.context.requestWechatAiPhoneSnapshot(h.char, { force: true });
    assert.equal(h.state.requests.length, 2);
    assert.match(h.state.requests[0].messages[0].content, /本人手机的数据生成器/);
    assert.match(h.state.requests[1].messages[0].content, /只生成.*两封正式中文书信/);
    assert.equal(result.diaryLetters.length, 2);
    assert.equal(result.diarySyncError, undefined);
    assert.equal(result.memos[0].title, '新的备忘录');
});

test('a malformed diary response gets one bounded repair, then keeps the cached letters on failure', async () => {
    const h = harness();
    h.char.chatConfig.aiPhoneSnapshot = savedPhone({ diaryLetters: letters(), diaryUpdatedAt: now - 1000 });
    const before = clone(h.char.chatConfig.aiPhoneSnapshot);
    h.state.respond = async () => ({ ok: true, content: 'not JSON' });
    const result = await h.context.regenerateWechatAiPhoneDiary(h.char.id);
    assert.equal(h.state.requests.length, 2);
    assert.deepEqual(clone(result.diaryLetters), before.diaryLetters);
    assert.equal(result.diaryUpdatedAt, before.diaryUpdatedAt);
    assert.match(result.diarySyncError, /JSON/);
    assert.equal(h.context.window._wechatAiPhoneGenerating.size, 0);
    h.open();
    await h.finish();
    assert.equal(h.state.requests.length, 2, 'opening must not repeatedly consume quota');
    h.state.respond = async () => phoneResponse();
    const retried = await h.context.regenerateWechatAiPhoneDiary(h.char.id);
    assert.equal(h.state.requests.length, 3);
    assert.equal(retried.diarySyncError, undefined);
    assert.equal(retried.diaryUpdatedAt, now);
});

test('a diary formatting retry can recover two complete letters', async () => {
    const h = harness();
    h.state.respond = async () => h.state.requests.length === 1 ? phoneResponse({ diaryLetters: [letters()[0]] }) : phoneResponse();
    const result = await h.context.regenerateWechatAiPhoneDiary(h.char.id);
    assert.equal(h.state.requests.length, 2);
    assert.equal(result.diaryLetters.length, 2);
    assert.equal(result.diarySyncError, undefined);
});

test('a partial full-phone update retains cached letters and records diary API failure', async () => {
    const h = harness();
    h.char.chatConfig.aiPhoneSnapshot = savedPhone({ diaryLetters: letters() });
    const before = clone(h.char.chatConfig.aiPhoneSnapshot);
    h.state.respond = async () => h.state.requests.length === 1 ? phoneResponse({ diaryLetters: [] }) : ({ ok: false, error: 'API 错误 (429)' });
    const result = await h.context.requestWechatAiPhoneSnapshot(h.char, { force: true });
    assert.equal(h.state.requests.length, 2, 'API failures must not trigger blind diary retries');
    assert.deepEqual(clone(result.diaryLetters), before.diaryLetters);
    assert.equal(result.memos[0].title, '新的备忘录');
    assert.match(result.diarySyncError, /429/);
    assert.equal(h.state.savedChar.chatConfig.aiPhoneSnapshot.diarySyncError, result.diarySyncError);
});

test('diary storage failures stop API use or restore the previously saved letters', async () => {
    for (const failureAt of [1, 2]) {
        const h = harness();
        h.char.chatConfig.aiPhoneSnapshot = savedPhone({ diaryLetters: letters(), diaryUpdatedAt: now - 1000, syncTurnKey: 'saved-turn' });
        const before = clone(h.char.chatConfig.aiPhoneSnapshot);
        h.state.saveResult = count => count !== failureAt;
        h.state.respond = async () => phoneResponse({ diaryLetters: letters().map(letter => ({ ...letter, title: `新${letter.title}` })) });
        const result = await h.context.regenerateWechatAiPhoneDiary(h.char.id);
        assert.equal(h.state.requests.length, failureAt === 1 ? 0 : 1);
        assert.deepEqual(clone(result.diaryLetters), before.diaryLetters);
        assert.equal(result.diaryUpdatedAt, before.diaryUpdatedAt);
        assert.equal(result.syncTurnKey, before.syncTurnKey);
        assert.match(result.diarySyncError, /保存/);
        assert.equal(h.context.window._wechatAiPhoneGenerating.size, 0);
    }
});

test('repeated diary clicks share the pending request without consuming a newer chat turn', async () => {
    const h = harness();
    h.char.chatConfig.aiPhoneSnapshot = savedPhone({ diaryLetters: [], syncTurnKey: 'saved-turn' });
    const pending = deferred();
    h.state.respond = () => pending.promise;
    const first = h.context.regenerateWechatAiPhoneDiary(h.char.id);
    await Promise.resolve();
    await Promise.resolve();
    const second = h.context.regenerateWechatAiPhoneDiary(h.char.id);
    h.char.history = [message(true, now - 100), message(false, now - 50)];
    pending.resolve(phoneResponse());
    await Promise.all([first, second]);
    assert.equal(h.state.requests.length, 1);
    assert.equal(h.char.chatConfig.aiPhoneSnapshot.syncTurnKey, 'saved-turn');
    assert.equal(h.context.shouldAutoSyncWechatAiPhone(h.char), true);
});

test('diary sync uses the production parser for quoted and nested model responses', async () => {
    const h = harness();
    const rows = letters().map(letter => ({ ...letter, subtitle: '', meta: '', body: letter.body.replace('安静', '“安静”') }));
    h.state.respond = async () => ({ ok: true, content: JSON.stringify({ data: { result: { diary_letters: rows } } }) });
    const result = await h.context.regenerateWechatAiPhoneDiary(h.char.id);
    assert.equal(h.state.requests.length, 1);
    assert.equal(result.diaryLetters.length, 2);
    assert.equal(result.diaryLetters[0].body, rows[0].body);
    assert.equal(result.diarySyncError, undefined);
    assert.equal(h.state.savedChar.chatConfig.aiPhoneSnapshot.diaryLetters[0].body, rows[0].body);
});

test('a bounded repair completes the remaining letter without discarding the first response', async () => {
    const h = harness();
    h.state.respond = async () => phoneResponse({ diaryLetters: [letters()[h.state.requests.length - 1]] });
    const result = await h.context.regenerateWechatAiPhoneDiary(h.char.id);
    assert.equal(h.state.requests.length, 2);
    assert.equal(result.diaryLetters.length, 2);
    assert.match(h.state.requests[1].messages.at(-1).content, /剩余 1 封/);
    assert.equal(result.diarySyncError, undefined);
});

test('a complete letter from the full phone response survives the diary repair', async () => {
    const h = harness();
    h.state.respond = async () => phoneResponse({ diaryLetters: [letters()[h.state.requests.length - 1]] });
    const result = await h.context.requestWechatAiPhoneSnapshot(h.char, { force: true });
    assert.equal(h.state.requests.length, 2);
    assert.equal(result.diaryLetters.length, 2);
    assert.equal(result.diarySyncError, undefined);
});

test('partial diary responses remain readable and failure details survive reload', async () => {
    const h = harness();
    const bad = { ...letters()[1], signature: '' };
    h.state.respond = async () => phoneResponse({ diaryLetters: [letters()[0], bad] });
    const result = await h.context.regenerateWechatAiPhoneDiary(h.char.id);
    assert.equal(h.state.requests.length, 2);
    assert.equal(result.diaryLetters.length, 1);
    assert.match(result.diarySyncError, /署名/);
    assert.match(h.state.requests[1].messages.at(-1).content, /署名/);
    assert.equal(result.diarySyncDiagnostics.responses.length, 2);
    assert.equal(result.diarySyncDiagnostics.responses[1].candidateCount, 2);
    assert.equal(result.diarySyncDiagnostics.responses[1].acceptedCount, 1);
    const reloaded = harness(h.state.savedChar);
    reloaded.open();
    await reloaded.finish();
    assert.equal(reloaded.state.requests.length, 0);
    assert.equal(reloaded.char.chatConfig.aiPhoneSnapshot.diaryLetters.length, 1);
    assert.match(reloaded.char.chatConfig.aiPhoneSnapshot.diarySyncError, /署名/);
    await reloaded.context.regenerateWechatAiPhoneDiary(reloaded.char.id);
    assert.equal(reloaded.char.chatConfig.aiPhoneSnapshot.diarySyncDiagnostics, undefined);
});

test('a provider failure during repair preserves fresh and previously saved complete letters', async () => {
    const h = harness();
    h.char.chatConfig.aiPhoneSnapshot = savedPhone({ diaryLetters: letters(), diaryUpdatedAt: now - 1000 });
    const fresh = { ...letters()[0], title: '新的来信', body: letterBody.replace('河边', '公园') };
    h.state.respond = async () => h.state.requests.length === 1 ? phoneResponse({ diaryLetters: [fresh] }) : ({ ok: false, error: 'API 错误 (429)' });
    const result = await h.context.regenerateWechatAiPhoneDiary(h.char.id);
    assert.equal(h.state.requests.length, 2);
    assert.equal(result.diaryLetters.length, 3);
    assert.equal(result.diaryLetters[0].body, fresh.body);
    assert.deepEqual(clone(result.diaryLetters.slice(1)), letters());
    assert.match(result.diarySyncError, /429/);
});

test('saving a partial diary failure cannot replace cached letters when storage rejects it', async () => {
    const h = harness();
    h.char.chatConfig.aiPhoneSnapshot = savedPhone({ diaryLetters: letters(), diaryUpdatedAt: now - 1000 });
    const before = clone(h.char.chatConfig.aiPhoneSnapshot);
    h.state.saveResult = count => count !== 2;
    h.state.respond = async () => phoneResponse({ diaryLetters: [{ ...letters()[0], body: letterBody.replace('河边', '公园') }] });
    const result = await h.context.regenerateWechatAiPhoneDiary(h.char.id);
    assert.deepEqual(clone(result.diaryLetters), before.diaryLetters);
    assert.equal(result.diaryUpdatedAt, before.diaryUpdatedAt);
    assert.equal(result.diarySyncDiagnostics, undefined);
    assert.match(result.diarySyncError, /保存/);
});
