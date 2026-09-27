const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { memoryStorage, sourceSection } = require('./helpers/harness.cjs');

function setup({ native = false } = {}) {
    const storage = memoryStorage(), sent = [], posts = [], logs = [];
    const char = { id: 'one', name: '测试角色', description: '嘴硬，不爱直接表达关心', history: [] };
    const window = { myCharacters: [char], currentChatCharId: char.id, location: { protocol: native ? 'bynd-app:' : 'https:', hostname: native ? 'app' : 'localhost' }, crypto: require('node:crypto').webcrypto,
        buildMessages: () => [{ role: 'system', content: char.description }],
        callChatApi: async (messages, options) => { sent.push({ messages, options }); return { ok: true, content: JSON.stringify({ remind: true, text: '最近别太逞强。有什么需要就说一声。' }) }; },
        saveCharactersToStorage: async () => true,
        ByndJev: { available: () => false },
        refreshChatView: () => {}, renderChatList: () => {}
    };
    if (native) window.webkit = { messageHandlers: { byndHealth: { postMessage: payload => posts.push(payload) } } };
    const context = vm.createContext({ window, localStorage: storage, document: { visibilityState: 'visible', addEventListener: () => {}, getElementById: () => ({ classList: { contains: () => true } }) },
        Date, Math, console: { warn: (...args) => logs.push(args) }, setTimeout: (...args) => { const timer = setTimeout(...args); timer.unref(); return timer; }, clearTimeout, setInterval: () => 0 });
    for (const file of ['systems/life-state/life-state.js', 'systems/life-state/native-health.js', 'apps/moon/moon.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
    const moon = window.ByndMoon, life = window.ByndLifeState, bridge = window.ByndNativeHealth;
    const now = Date.now(), today = life.localDate(now);
    const shifted = days => new Date(Date.parse(today + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
    const due = () => { moon.saveRecord({ start: shifted(-26) }); moon.settings({ cycleLength: 28, leadDays: 3 }); moon.setGrant(char, { level: 'overview', remind: true }); };
    const record = (values = { steps: 4567 }) => ({ date: today, observedAt: new Date(now - 1000).toISOString(), values });
    const reply = (data, ok = true, index = posts.length - 1) => bridge.onReply({ id: posts[index].id, ok, data, error: '原生读取失败' });
    return { context, window, storage, char, moon, life, bridge, now, today, shifted, due, sent, posts, record, reply, logs };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('moon never fabricates a 28-day cycle, auto-estimation needs sufficient consistent history', () => {
    const { moon, shifted } = setup();
    moon.saveRecord({ start: shifted(-26) });
    assert.equal(moon.forecast().phase, 'unknown');
    moon.clear();
    for (const days of [-110, -82, -54, -26]) moon.saveRecord({ start: shifted(days) });
    assert.equal(moon.forecast().phase, 'upcoming');
    assert.equal(moon.forecast().method, '最近记录估算');
    moon.saveRecord({ start: shifted(-5) });
    assert.equal(moon.forecast().phase, 'later');
    moon.clear();
    for (const days of [-130, -100, -45, -20]) moon.saveRecord({ start: shifted(days) });
    assert.equal(moon.forecast().phase, 'unknown');
});

test('period authorization is separate per character and granularity, groups and paused state deny', () => {
    const { moon, life, char, due, shifted } = setup(); due();
    assert.match(moon.prompt(char), /具体日期未授权/);
    assert.doesNotMatch(moon.prompt(char), /\d{4}-\d\d-\d\d/);
    assert.equal(moon.prompt({ id: 'two' }), '');
    assert.equal(moon.prompt({ ...char, isGroupChat: true }), '');
    assert.equal(life.prompt(char), '');
    moon.setGrant(char, { level: 'dates', remind: false });
    assert.match(moon.prompt(char), new RegExp(shifted(-26)));
    assert.equal(moon.candidate(char), null);
    moon.settings({ paused: true }); assert.equal(moon.prompt(char), '');
});

test('past estimates do not roll forward or diagnose late periods; records validate atomically', () => {
    const { moon, shifted, char, storage } = setup();
    moon.saveRecord({ start: shifted(-40), end: shifted(-35) }); moon.settings({ cycleLength: 28 });
    moon.setGrant(char, { level: 'dates', remind: true });
    assert.equal(moon.forecast().phase, 'past-estimate'); assert.equal(moon.prompt(char), '');
    const before = storage.getItem(moon.storageKey);
    for (const record of [{ start: shifted(1) }, { start: '2026-02-30' }, { start: shifted(-39) }, { start: shifted(-10), end: shifted(-11) }]) assert.throws(() => moon.saveRecord(record));
    assert.equal(storage.getItem(moon.storageKey), before);
    assert.throws(() => moon.settings({ cycleLength: 9 }));
    assert.throws(() => moon.settings({ leadDays: 8 }));
});

test('actual flow days require manual confirmation and never populate forecast by themselves', () => {
    const { moon, shifted } = setup();
    moon.replaceNativeDays([shifted(-4), shifted(-3), shifted(-3)]);
    assert.equal(moon.read().nativeDays.length, 2);
    assert.equal(moon.read().records.length, 0);
    assert.equal(moon.forecast().phase, 'unknown');
    assert.throws(() => moon.replaceNativeDays([shifted(1)]));
});

test('moon delivers a persona decision once, keeps raw dates out of overview requests and chat metadata', async () => {
    const { moon, char, due, sent, shifted } = setup(); due();
    const result = await moon.maybeRemind(char, { requireOpen: true });
    assert.equal(result.ok, true); assert.equal(char.history.length, 1);
    assert.equal(sent[0].options.privateUsage, true);
    assert.match(JSON.stringify(sent[0].messages), /嘴硬/);
    assert.doesNotMatch(JSON.stringify(sent[0].messages), /\d{4}-\d\d-\d\d/);
    assert.doesNotMatch(char.history[0].moonReminderKey, new RegExp(shifted(-26)));
    assert.equal((await moon.maybeRemind(char, { force: true })).skipped, true);
    assert.equal(sent.length, 1); assert.match(moon.audit()[0].reason, /已提醒/);
});

test('configured Jev denial or uncertainty prevents generation; private scopes receive no raw dates', async () => {
    const { moon, char, window, due, sent } = setup(); due();
    window.ByndJev = { available: scope => scope === 'cycleCompanion', ask: async (scope, state, questions, meta) => {
        assert.equal(meta.private, true); assert.doesNotMatch(JSON.stringify(state), /\d{4}-\d\d-\d\d/);
        assert.match(state.character.persona, /嘴硬/);
        return { appropriate: { value: true, confident: false } };
    } };
    assert.equal((await moon.maybeRemind(char)).skipped, true);
    assert.equal(sent.length, 0); assert.equal(char.history.length, 0);
    window.ByndJev.ask = async () => null;
    assert.equal((await moon.maybeRemind(char, { force: true })).skipped, true);
});

test('API and character-storage failures never create a receipt or saved chat message', async () => {
    const { moon, char, window, due } = setup(); due();
    window.callChatApi = async () => ({ ok: false, error: '网络错误' });
    assert.match((await moon.maybeRemind(char)).error, /网络错误/);
    assert.equal(char.history.length, 0); assert.equal(Object.keys(moon.read().delivered).length, 0);
    window.callChatApi = async () => ({ ok: true, content: '{"remind":true,"text":"最近别太逞强。"}' });
    window.saveCharactersToStorage = async () => false;
    assert.match((await moon.maybeRemind(char, { force: true })).error, /保存失败/);
    assert.equal(char.history.length, 0); assert.equal(Object.keys(moon.read().delivered).length, 0);
    assert.match(moon.audit()[0].reason, /失败/);
});

test('revocation or changing chats/history while generation is pending cancels delivery', async () => {
    for (const mutation of ['revoke', 'history', 'chat']) {
        const { moon, char, window, due } = setup(); due();
        let release;
        window.callChatApi = () => new Promise(resolve => { release = resolve; });
        const pending = moon.maybeRemind(char, { requireOpen: true }); await flush();
        if (mutation === 'revoke') moon.setGrant(char, { level: 'off', remind: false });
        if (mutation === 'history') char.history.push({ isMe: true, content: '现在不想聊' });
        if (mutation === 'chat') window.currentChatCharId = 'two';
        release({ ok: true, content: '{"remind":true,"text":"最近别逞强。"}' });
        assert.equal((await pending).cancelled, true);
        assert.equal(char.history.filter(message => !message.isMe).length, 0);
    }
});

test('concurrent checks serialize, malformed decisions and optional final review cannot send', async () => {
    const { moon, char, window, due } = setup(); due();
    let release;
    window.callChatApi = () => new Promise(resolve => { release = resolve; });
    const first = moon.maybeRemind(char); await flush();
    assert.equal((await moon.maybeRemind(char, { force: true })).skipped, true);
    release({ ok: true, content: 'invalid json' }); assert.match((await first).error, /有效/);
    window.callChatApi = async () => ({ ok: true, content: '{"remind":true,"text":"最近别逞强。"}' });
    window.ByndJev = { available: scope => scope === 'cycleReview', ask: async () => ({ acceptable: { value: false, confident: true } }) };
    assert.match((await moon.maybeRemind(char, { force: true })).error, /自查未通过/);
    assert.equal(char.history.length, 0);
});

test('save receipt failure still deduplicates from saved chat without misreporting failed delivery', async () => {
    const { moon, char, storage, window, due } = setup(); due();
    const original = storage.setItem;
    window.saveCharactersToStorage = async () => { storage.setItem = () => { throw new Error('quota'); }; return true; };
    const result = await moon.maybeRemind(char);
    assert.equal(result.delivered, true); assert.match(result.warning, /回执保存失败/);
    storage.setItem = original;
    assert.equal((await moon.maybeRemind(char, { force: true })).skipped, true);
    assert.match(moon.audit()[0].reason, /已提醒/);
    assert.match(moon.audit()[0].error, /回执保存失败/);
});

test('output self-check rejects invented exact dates for overview and medical claims', () => {
    const { moon } = setup();
    for (const text of ['明天就来了', '2026-09-28 快到了', '还有三天就到了', '下周二就来', '你肯定很疼', '预计 9 月 28 日', '你怀孕了', '一定会来', '必须吃药', 'HealthKit 告诉我你现在很痛']) assert.equal(moon.reviewText(text, { level: 'overview' }), false, text);
    assert.equal(moon.reviewText('最近留点时间休息吧。', { level: 'overview' }), true);
});

test('native health bridge is unavailable on ordinary websites even if they define a fake handler', async () => {
    const { bridge, window } = setup({ native: true });
    window.location = { protocol: 'https:', hostname: 'app' };
    assert.equal(bridge.available(), false);
    await assert.rejects(bridge.request('read', ['steps']), /原生版本/);
});

test('native authorization completion does not grant characters access and empty reads clear old snapshots only', async () => {
    const { bridge, life, char, posts, reply, record, storage } = setup({ native: true });
    life.importSummary({ version: 1, records: [{ ...record({ energy: 'low' }), source: 'manual' }] });
    life.replaceNativeSummary({ version: 1, records: [record()] });
    const job = bridge.connect(['steps']); assert.equal(posts[0].action, 'authorize');
    reply({ authorizationCompleted: true }); await flush();
    assert.equal(posts[1].action, 'read');
    assert.equal(life.read().nativeRecords.length, 0);
    reply({ version: 1, records: [], flowDays: [] });
    assert.equal((await job).empty, true);
    assert.equal(life.read().records.length, 1); assert.equal(life.prompt(char), '');
    assert.equal(JSON.parse(storage.getItem(bridge.storageKey)).connected, true);
});

test('native reads validate before writing and preserve category consent and manual data', async () => {
    const { bridge, life, moon, char, storage, record, posts, reply } = setup({ native: true });
    storage.setItem(bridge.storageKey, JSON.stringify({ connected: true, types: ['steps'] }));
    life.setGrant(char, { enabled: true, fields: { steps: 'detail' } });
    const job = bridge.sync(); reply({ version: 1, records: [record()], flowDays: [] });
    assert.equal((await job).count, 1); assert.match(life.prompt(char), /4567/);
    assert.equal(moon.read().records.length, 0);
    const unauthorized = bridge.sync(); reply({ version: 1, records: [record({ mood: 'good' })], flowDays: [] });
    await assert.rejects(unauthorized, /未选择/); assert.equal(life.read().nativeRecords.length, 0);
    const invalid = bridge.sync(); reply({ version: 1, records: [record({ steps: -3 })], flowDays: [] });
    await assert.rejects(invalid, /整数/); assert.equal(life.read().nativeRecords.length, 0);
    assert.equal(posts.length, 3);
});

test('native read failure and late callback after disconnect cannot restore old health data', async () => {
    const { bridge, life, storage, record, reply } = setup({ native: true });
    storage.setItem(bridge.storageKey, JSON.stringify({ connected: true, types: ['steps'] }));
    life.replaceNativeSummary({ version: 1, records: [record()] });
    const failed = bridge.sync(); reply(null, false);
    await assert.rejects(failed, /原生读取失败/); assert.equal(life.read().nativeRecords.length, 0);
    const late = bridge.sync(); bridge.disconnect(); reply({ version: 1, records: [record()], flowDays: [] });
    await assert.rejects(late, /取消/); assert.equal(life.read().nativeRecords.length, 0);
    reply({ version: 1, records: [record()], flowDays: [] }); // replay is ignored
    assert.equal(life.read().nativeRecords.length, 0);
});

test('health storage write failure is surfaced and imported files cannot masquerade as native sources', async () => {
    const { bridge, life, char, storage, record, reply } = setup({ native: true });
    life.importSummary({ version: 1, records: [{ ...record(), source: 'healthkit' }] });
    life.setGrant(char, { enabled: true, fields: { steps: 'detail' } });
    assert.match(life.prompt(char), /导入文件/);
    storage.setItem(bridge.storageKey, JSON.stringify({ connected: true, types: ['steps'] }));
    const job = bridge.sync();
    storage.setItem = () => { throw new Error('disk full'); };
    reply({ version: 1, records: [record()], flowDays: [] });
    await assert.rejects(job, /disk full/);
});

test('all three private stores are excluded from ordinary backups and imported character identities require new consent', () => {
    const { context, storage, life, moon, bridge } = setup();
    for (const key of [life.storageKey, moon.storageKey, bridge.storageKey, 'bynd_theme_v1']) storage.setItem(key, '{}');
    vm.runInContext(`const ALL_DATA_KEYS = []; const APP_STORAGE_KEY_PREFIXES = ['bynd_']; ${sourceSection('core/storage/backup.js', 'function isByndStorageKey(', 'function parseBackupLocalStorageValue(')}`, context);
    const keys = context.getBackupLocalStorageKeys();
    assert.ok(keys.includes('bynd_theme_v1'));
    for (const key of [life.storageKey, moon.storageKey, bridge.storageKey]) assert.equal(keys.includes(key), false);
    assert.match(fs.readFileSync('core/storage/backup.js', 'utf8'), /ByndMoon\.revokeAll\(\)/);
});

test('API usage previews redact injected health and period references without altering actual request', () => {
    const { context, window, life, moon, char, due, record } = setup(); due();
    moon.setGrant(char, { level: 'dates', remind: true });
    life.importSummary({ version: 1, records: [{ ...record(), source: 'manual' }] });
    life.setGrant(char, { enabled: true, fields: { steps: 'detail' } });
    vm.runInContext(fs.readFileSync('systems/usage/api-ticket.js', 'utf8'), context);
    const content = ['原有角色提示', life.prompt(char), moon.prompt(char), '其他提示仍存在'].join('\n');
    const ticket = window.ByndApiTicket.snapshot([{ role: 'system', content }]);
    assert.match(content, /4567/); assert.doesNotMatch(JSON.stringify(ticket.rows), /4567|\d{4}-\d\d-\d\d/);
    assert.match(ticket.rows[0].preview, /其他提示仍存在/);
    const hidden = window.ByndApiTicket.snapshot([{ role: 'system', content: 'private' }], { privateContext: true });
    assert.doesNotMatch(hidden.rows[0].preview, /private/); assert.ok(hidden.inputEstimate > 0);
});


test('successful chat save followed by renderer failure reports delivery with a visible audit warning', async () => {
    const { moon, char, window, due } = setup(); due();
    window.refreshChatView = () => { throw new Error('render failed'); };
    const result = await moon.maybeRemind(char);
    assert.equal(result.delivered, true); assert.match(result.warning, /界面更新失败/);
    assert.equal(char.history.length, 1); assert.match(moon.audit()[0].error, /render failed/);
});


test('malformed persisted native snapshots fail closed without breaking the chat prompt', () => {
    const { life, moon, char, storage, due } = setup(); due();
    storage.setItem(life.storageKey, JSON.stringify({ version: 1, records: [], nativeRecords: [null], grants: { one: { enabled: true, fields: { steps: 'detail' } } } }));
    assert.equal(life.prompt(char), '');
    storage.setItem(moon.storageKey, JSON.stringify({ ...moon.read(), grants: 'corrupt' }));
    assert.equal(moon.prompt(char), '');
});
