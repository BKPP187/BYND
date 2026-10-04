'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../systems/character-events/events.js'), 'utf8');
const DAY = 86400000, now = 1791000000000;
const clone = v => JSON.parse(JSON.stringify(v));
function harness() {
    const data = new Map(), errors = [], requests = [];
    let saveOK = true, storageFail = false, decision = { version: 1, action: 'none', events: [] }, imageOK = true, generateImage = null, clockNow = now;
    const intervals = [], listeners = new Map();
    const c = { id: 'c1', name: '南桓', description: '话少但细心', history: [{ type: 'text', isMe: true, timestamp: now - 10 * DAY, content: '周末再聊' }], chatConfig: {} };
    const window = { myCharacters: [c], _wechatCharactersStorageState: { status: 'ready' }, dispatchEvent() {}, addEventListener(type, fn) { listeners.set(type, fn); }, ByndEventInbox: { status: e => errors.push(e), announce() {}, render() {} } };
    const document = { visibilityState: 'visible', addEventListener(type, fn) { listeners.set(type, fn); } };
    class Clock extends Date { static now() { return clockNow; } }
    const ctx = { window, document, setInterval: fn => intervals.push(fn), Date: Clock, URL, CustomEvent: class {}, console: { warn() {} }, localStorage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => { if (storageFail) throw new Error('quota'); data.set(k, v); } },
        callChatApi: async (messages, options) => { requests.push({ messages, options }); return typeof decision === 'function' ? decision() : { ok: true, content: JSON.stringify(decision) }; },
        saveCharactersToStorage: async () => saveOK,
        callWechatImageGenerationApi: async () => generateImage ? generateImage() : imageOK ? { ok: true, url: 'https://example.test/generated.png' } : { ok: false, error: 'image service failed' } };
    vm.runInNewContext(source, ctx);
    const api = window.ByndCharacterEvents;
    const seed = fn => { const s = api.read(); fn(s); data.set(api.storageKey, JSON.stringify(s)); };
    const eligible = () => { api.recordInteractions([c]); seed(s => { s.lastActiveAt = now - 7 * DAY; }); api.captureReturn(now); };
    const event = (type = 'letter', extra = {}) => ({ type, charId: 'c1', title: '一封来信', body: '今天看见了新叶子', ...extra });
    return { api, c, window, document, intervals, data, errors, requests, seed, eligible, event, advance(ms) { clockNow += ms; }, image(fn) { generateImage = fn; }, failStorage(v = true) { storageFail = v; }, failSave(v = true) { saveOK = !v; }, failImage() { imageOK = false; }, decision(v) { decision = v; }, act(type = 'letter', extra) { decision = { version: 1, action: 'act', events: [event(type, extra)] }; } };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('initialization never promotes a queued or failed character snapshot to an effective interaction', async () => {
    const h = harness(); h.window._wechatCharactersLatestSnapshot = { characters: [h.c] };
    await h.api.init(); await settle();
    assert.deepEqual(clone(h.api.read().characters), {});
    const saved = harness(); saved.window._wechatCharactersPersistedSnapshot = { characters: [saved.c] };
    await saved.api.init(); await settle();
    assert.equal(saved.api.read().characters.c1.lastInteractionAt, saved.c.history[0].timestamp);
    assert.equal(saved.requests.length, 0);
});

test('initialization can recover after characters finish loading or baseline storage fails', async () => {
    for (const mode of ['loading', 'quota']) {
        const h = harness();
        if (mode === 'loading') h.window._wechatCharactersStorageState.status = 'loading';
        else h.failStorage();
        await h.api.init(); assert.equal(h.intervals.length, 0);
        h.window._wechatCharactersStorageState.status = 'ready'; h.failStorage(false);
        await h.api.init(); await h.api.init();
        assert.equal(h.api.read().lastActiveAt, now); assert.equal(h.intervals.length, 1);
    }
});

test('visible session retries failed decisions after cooldown without requiring another return', async () => {
    const h = harness(); h.eligible(); h.decision(() => ({ ok: false, error: 'HTTP 503' }));
    await h.api.init(); await settle(); assert.equal(h.requests.length, 1);
    h.act(); h.intervals[0](); await settle(); assert.equal(h.requests.length, 1);
    h.advance(31 * 60000); h.document.visibilityState = 'hidden'; h.intervals[0](); await settle(); assert.equal(h.requests.length, 1);
    h.document.visibilityState = 'visible'; h.intervals[0](); await settle();
    assert.equal(h.requests.length, 2); assert.equal(h.api.read().events[0].delivery, 'delivered');
});

test('generated image is dispatched to the current character object after an async reload', async () => {
    const h = harness(); h.act('album', { imagePrompt: '窗边的新叶子' }); h.eligible();
    h.image(() => { h.window.myCharacters = [clone(h.c)]; return { ok: true, url: 'https://example.test/generated.png' }; });
    await h.api.processPending();
    assert.equal(h.window.myCharacters[0].chatConfig.generatedImages?.length, 1);
    assert.equal(h.c.chatConfig.generatedImages, undefined);
    assert.equal(h.api.read().events[0].delivery, 'delivered');
});

test('receipt failure after chat save retries the outbox without duplicating the saved message', async () => {
    const h = harness(); h.act('message'); h.eligible();
    const setItem = h.data.set.bind(h.data);
    let rejected = false;
    h.data.set = (key, value) => {
        if (!rejected && key === h.api.storageKey && JSON.parse(value).events.some(e => e.delivery === 'delivered')) {
            rejected = true; throw new Error('receipt quota');
        }
        return setItem(key, value);
    };
    await h.api.processPending();
    const e = h.api.read().events[0]; assert.equal(e.delivery, 'failed');
    assert.equal(h.c.history.filter(m => m.eventId === e.id).length, 1);
    await h.api.retryDelivery(e.id);
    assert.equal(h.api.eventById(e.id).delivery, 'delivered'); assert.equal(h.requests.length, 1);
    assert.equal(h.c.history.filter(m => m.eventId === e.id).length, 1);
});
test('new install, greetings, groups and invalid timestamps never establish effective interaction', async () => {
    const h = harness(); h.c.history = [{ isMe: false, timestamp: now - 20 * DAY, content: '你好' }];
    h.api.recordInteractions([h.c, { ...h.c, id: 'g', isGroupChat: true, history: [{ isMe: true, content: 'x', timestamp: now - DAY }] }]);
    h.seed(s => { s.lastActiveAt = now - 30 * DAY; }); h.api.captureReturn(now); await h.api.processPending();
    assert.equal(h.requests.length, 0); assert.deepEqual(clone(h.api.read().characters), {});
    h.c.history = [{ isMe: true, content: 'x', timestamp: now + DAY }, { isMe: true, content: 'x' }]; h.api.recordInteractions([h.c]);
    assert.deepEqual(clone(h.api.read().characters), {});
});
test('first upgrade creates a baseline without retroactively generating a story', async () => {
    const h = harness(); h.api.recordInteractions([h.c]); h.api.captureReturn(now); await h.api.processPending();
    assert.equal(h.requests.length, 0); assert.equal(h.api.read().lastActiveAt, now);
});
test('silence consumes the absence once; reload and concurrent calls cannot duplicate requests', async () => {
    const h = harness(); h.eligible();
    await Promise.all([h.api.processPending(), h.api.processPending()]);
    h.api.captureReturn(now); await h.api.processPending();
    assert.equal(h.requests.length, 1); assert.equal(h.api.read().events.length, 0); assert.equal(h.api.read().characters.c1.pending, null);
    const sent = JSON.parse(h.requests[0].messages[1].content); assert.equal(sent.environment.offlineDays, 7); assert.equal(sent.character.persona, h.c.description);
    assert.match(h.requests[0].messages[0].content, /允许保持沉默/);
});
test('same absence can yield different carriers chosen by the agent, never a day mapping', async () => {
    for (const type of ['letter', 'note', 'diary', 'widget', 'newspaper', 'notification', 'doodle', 'bottle']) {
        const h = harness(); h.act(type, type === 'bottle' ? { words: ['想说的话'] } : type === 'doodle' ? { strokes: [{ color: '#333333', points: [[1, 2], [30, 50]] }] } : {}); h.eligible();
        await h.api.processPending(); const e = h.api.read().events[0]; assert.equal(e.type, type); assert.equal(e.delivery, 'delivered'); assert.equal(e.unread, true);
    }
});
test('Jev silence costs no chat generation; unavailable or uncertain Jev returns to Agent', async () => {
    const h = harness(); h.window.ByndJev = { available: scope => scope === 'autonomousEvent', choose: async () => 'none' }; h.eligible();
    await h.api.processPending(); assert.equal(h.requests.length, 0);
    const next = harness(); next.window.ByndJev = { available: () => true, choose: async () => null }; next.eligible(); await next.api.processPending(); assert.equal(next.requests.length, 1);
});
test('malformed decisions, foreign characters, executable URLs and invalid drawings are rejected atomically', () => {
    const h = harness();
    for (const e of [h.event('unknown'), h.event('letter', { charId: 'someone' }), h.event('letter', { imageUrl: 'javascript:alert(1)' }), h.event('doodle', { strokes: [{ color: '#fff', points: [[1, 2], [3, 4]] }] }), h.event('doodle', { strokes: [{ points: [[1, 2], [301, 4]] }] }), h.event('bottle', { words: [] })]) {
        assert.throws(() => h.api.parseDecision({ version: 1, action: 'act', events: [e] }, 'c1'));
    }
    assert.throws(() => h.api.parseDecision('{"version":1', 'c1'));
    assert.throws(() => h.api.parseDecision({ version: 1, action: 'none', events: [h.event()] }, 'c1'));
    assert.equal(h.api.read().events.length, 0);
});
test('network errors retain pending decision and respect cooldown; manual retry can finish', async () => {
    const h = harness(); h.eligible(); h.decision(() => ({ ok: false, error: 'HTTP 503' })); await h.api.processPending();
    assert.match(h.api.read().characters.c1.lastError, /503/); await h.api.processPending(); assert.equal(h.requests.length, 1);
    h.act(); await h.api.processPending(true); assert.equal(h.api.read().events[0].delivery, 'delivered'); assert.equal(h.requests.length, 2);
});
test('failed initial persistence spends no request and preserves previous records', async () => {
    const h = harness(); h.eligible(); const before = h.data.get(h.api.storageKey); h.failStorage(); await h.api.processPending();
    assert.equal(h.requests.length, 0); assert.equal(h.data.get(h.api.storageKey), before);
});
test('message dispatch failure rolls back chat and retries existing outbox without generating again', async () => {
    const h = harness(); h.act('message'); h.eligible(); h.failSave(); await h.api.processPending();
    const e = h.api.read().events[0]; assert.equal(e.delivery, 'failed'); assert.equal(h.c.history.length, 1);
    h.failSave(false); await h.api.retryDelivery(e.id); await h.api.retryDelivery(e.id);
    assert.equal(h.c.history.filter(m => m.eventId === e.id).length, 1); assert.equal(h.requests.length, 1); assert.equal(h.api.eventById(e.id).delivery, 'delivered');
});
test('album images enter generated album only after save; image failure remains retryable', async () => {
    const h = harness(); h.act('album', { imageUrl: 'https://example.test/pic.png' }); h.eligible(); h.failSave(); await h.api.processPending();
    assert.equal(h.c.chatConfig.generatedImages.length, 0); h.failSave(false); await h.api.retryDelivery(h.api.read().events[0].id); assert.equal(h.c.chatConfig.generatedImages.length, 1);
    const broken = harness(); broken.act('album', { imagePrompt: '窗边的新叶子' }); broken.eligible(); broken.failImage(); await broken.api.processPending();
    assert.equal(broken.api.read().events[0].delivery, 'failed'); assert.match(broken.api.read().events[0].deliveryError, /image service/);
});
test('new interaction, disabling or deleting a character invalidates late decisions', async () => {
    for (const mode of ['contact', 'disable', 'delete']) {
        const h = harness(); h.eligible(); h.decision(() => {
            if (mode === 'contact') { h.c.history.push({ isMe: true, type: 'text', timestamp: now, content: '回来了' }); h.api.recordInteractions([h.c]); }
            if (mode === 'disable') h.api.configure({ enabled: false });
            if (mode === 'delete') h.window.myCharacters = [];
            return { ok: true, content: JSON.stringify({ version: 1, action: 'act', events: [h.event()] }) };
        });
        await h.api.processPending(); assert.equal(h.api.read().events.length, 0, mode);
    }
});
test('import validates all entries before writing, deduplicates and survives export round-trip', async () => {
    const h = harness(); h.act(); h.eligible(); await h.api.processPending(); const exported = h.api.exportEvents();
    const target = harness(); assert.equal(target.api.importEvents(exported), 1); assert.equal(target.api.importEvents(exported), 0);
    await target.api.retryDelivery(target.api.read().events[0].id); assert.equal(target.requests.length, 0);
    const bad = JSON.parse(exported); bad.events.push({ ...bad.events[0], id: 'bad', charId: 'unknown' }); const before = target.data.get(target.api.storageKey);
    assert.throws(() => target.api.importEvents(JSON.stringify(bad))); assert.equal(target.data.get(target.api.storageKey), before);
    target.failStorage(); assert.throws(() => target.api.importEvents(exported), /quota/); assert.throws(() => target.api.markRead(target.api.read().events[0].id), /quota/);
    assert.equal(target.api.read().events[0].unread, true);
});
test('corrupt records are never silently reset by settings or export', () => {
    const h = harness(); h.data.set(h.api.storageKey, '{bad'); assert.throws(() => h.api.configure({ enabled: false }), /损坏/); assert.throws(() => h.api.exportEvents(), /损坏/); assert.equal(h.data.get(h.api.storageKey), '{bad');
});
