const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, memoryStorage } = require('./helpers/harness.cjs');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function letterHarness(entries = {}, { readError = false, writeError = false, version = '1.1.10' } = {}) {
    const storage = memoryStorage(entries), nodes = [];
    const node = () => ({ children: [], inert: false, isConnected: true, events: {}, appendChild(child) { this.children.push(child); child.parent = this; }, setAttribute() {}, focus() {}, addEventListener(name, cb) { this.events[name] = cb; }, remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.isConnected = false; } });
    const phone = node();
    const document = { activeElement: null, querySelector: () => phone, createElement: () => { const n = node(); nodes.push(n); return n; }, getElementById: id => nodes.find(n => n.id === id && n.isConnected) || null };
    if (readError) storage.getItem = () => { throw Error('blocked'); };
    if (writeError) storage.setItem = () => { throw Error('full'); };
    const context = vm.createContext({ window: {}, document, localStorage: storage, APP_VERSION: `v${version}`, console: { warn() {} } });
    context.window.ByndReleases = [{ version, date: '2026-09-27', announce: true, intro: '真实更新', new: ['一个已实现的功能'], improved: [], fixed: [] }];
    vm.runInContext(source('apps/settings/version-letter.js'), context);
    return { api: context.window.ByndVersionLetter, storage, phone, nodes };
}

test('version letters compare numeric components and ignore equal/older/invalid versions', () => {
    const { api } = letterHarness();
    assert.equal(api.compareVersions('1.1.10', '1.1.9'), 1);
    assert.equal(api.compareVersions('v2.0.0', '1.90.999'), 1);
    assert.equal(api.compareVersions('1.1.10', '1.1.10'), 0);
    assert.equal(api.compareVersions('junk', '1.1.10'), null);
    assert.equal(api.pendingRelease('1.1.9', '1.1.10'), null);
    assert.equal(api.pendingRelease('1.1.10', '1.1.10'), null);
});

test('important upgrade is displayed once and acknowledged on display even without tapping', () => {
    const h = letterHarness({ bynd_lastSeenVersion: '1.1.9' });
    assert.equal(h.api.init(), true);
    assert.equal(h.storage.getItem(h.api.storageKey), '1.1.10');
    assert.equal(h.api.init(), false);
    const restarted = letterHarness({ bynd_lastSeenVersion: h.storage.getItem(h.api.storageKey) });
    assert.equal(restarted.api.init(), false);
});

test('fresh installs establish a quiet baseline; legacy installs see the first real upgrade', () => {
    const fresh = letterHarness();
    assert.equal(fresh.api.init(), false);
    assert.equal(fresh.storage.getItem(fresh.api.storageKey), '1.1.10');
    const legacy = letterHarness({ my_api_data: '{}' }, { version: '1.1.705' });
    assert.equal(legacy.api.init(), true);
    assert.equal(legacy.storage.getItem(legacy.api.storageKey), '1.1.705');
});

test('silent patches stay quiet, skipped feature updates remain discoverable and future releases are hidden', () => {
    const { api } = letterHarness();
    const releases = [{ version: '1.1.10', announce: true }, { version: '1.1.11', announce: false }, { version: '2.0.0', announce: true }];
    assert.equal(api.pendingRelease('1.1.11', '1.1.10', releases), null);
    assert.equal(api.pendingRelease('1.1.11', '1.1.9', releases).version, '1.1.10');
    assert.deepEqual(plain(api.releasedNotes('1.1.11', releases)).map(row => row.version), ['1.1.11', '1.1.10']);
});

test('storage errors neither claim a persisted read nor force a popup every startup', () => {
    const blocked = letterHarness({}, { readError: true });
    assert.equal(blocked.api.init(), false);
    const full = letterHarness({ bynd_lastSeenVersion: '1.1.9' }, { writeError: true });
    assert.equal(full.api.init(), true);
    assert.equal(full.storage.getItem(full.api.storageKey), '1.1.9');
    assert.ok(full.nodes.some(node => /未能保存已读版本/.test(node.textContent || '')));
    assert.equal(full.api.init(), false);
    const downgrade = letterHarness({ bynd_lastSeenVersion: '2.0.0' });
    downgrade.api.init();
    assert.equal(downgrade.storage.getItem(downgrade.api.storageKey), '2.0.0');
});

function experienceHarness() {
    let time = new Date('2026-09-27T10:00:00+08:00').getTime(), timer;
    const events = {}, storage = memoryStorage();
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [time])); } static now() { return time; } }
    const document = { hidden: false, getElementById: () => null, addEventListener: (name, cb) => { events[name] = cb; } };
    const context = vm.createContext({ window: { addEventListener() {}, ByndStudy: { tutor: () => ({ id: 'a' }), primaryTarget: () => ({ label: '日语' }) }, ByndVersionLetter: { releasedNotes: () => [{ version: '1.1.10', features: ['study'] }] } }, document, localStorage: storage, Date: Clock, console: { warn() {} }, setInterval: cb => { timer = cb; } });
    vm.runInContext(source('systems/experience/experience.js'), context);
    const api = context.window.ByndExperience; api.init();
    return { api, storage, document, advance(ms, active = true) { time += ms; if (active) events.pointerdown(); timer(); } };
}

test('47 active study minutes are real, character-scoped, and exclude idle/background time', () => {
    const h = experienceHarness(); h.api.opened('study');
    for (let i = 0; i < 188; i++) h.advance(15000);
    h.document.hidden = true; h.advance(600000, false);
    h.api.closed('study');
    assert.match(h.api.prompt({ id: 'a' }), /约 47 分钟/);
    assert.equal(h.api.prompt({ id: 'b' }), '');
    assert.equal(h.api.prompt({ id: 'a', isGroupChat: true }), '');
    const idle = experienceHarness(); idle.api.opened('study');
    for (let i = 0; i < 100; i++) idle.advance(15000, false);
    idle.api.closed('study');
    assert.ok(JSON.parse(idle.storage.getItem(idle.api.keys.traces))[0].seconds < 90);
});

test('progress belongs to its character and a cleared chat no longer receives old activity', () => {
    const h = experienceHarness();
    h.api.checkpoint('comic', 'a', '停在第三话第 4 格');
    assert.match(h.api.prompt({ id: 'a' }), /第三话第 4 格/);
    assert.equal(h.api.prompt({ id: 'b' }), '');
    assert.equal(h.api.prompt({ id: 'a', chatConfig: { memoryResetAt: Date.now() + 86400000 } }), '');
    h.api.discover('study');
    assert.equal(JSON.parse(h.storage.getItem(h.api.keys.discoveries))['study@1.1.10'], true);
    h.storage.setItem = () => { throw Error('full'); };
    assert.equal(h.api.checkpoint('comic', 'a', '没有保存的第5格'), false);
    assert.doesNotMatch(h.api.prompt({ id: 'a' }), /没有保存的第5格/);
});

function clearHarness() {
    const char = { id: 'a', history: [{ id: 'old', content: '旧消息' }], lastMsg: '旧消息', unreadCount: 1, chatConfig: { userTitle: '宝宝', fontSize: 14 } };
    let memory = { chars: { a: { segments: [{ id: 'old-memory' }], longTerm: [], compressed: [], meta: {} }, b: { segments: [{ id: 'other' }] } } }, undo, fail = false;
    const notices = [];
    const context = vm.createContext({ window: { myCharacters: [char], ByndUndo: { offer: action => { undo = action; } }, showWechatToast: text => notices.push(text) }, getWechatMemoryStore: () => plain(memory), saveWechatMemoryStore: value => { memory = plain(value); }, resetWechatChatDerivedContext: value => { delete memory.chars.a; value.chatConfig.userTitle = ''; value.chatConfig.memoryResetAt = Date.now(); value.unreadCount = 0; }, saveCharactersToStorage: async () => !fail, refreshChatView() {}, renderChatList() {}, closeChatSettings() {}, console: { error() {} } });
    vm.runInContext(source('ui/components/chat-clear.js'), context);
    return { char, api: context.window.ByndChatClear, notices, setFail: value => { fail = value; }, memory: () => memory, undo: () => undo.undo() };
}

test('chat clear Undo restores scoped memories and preserves messages/settings added afterward', async () => {
    const h = clearHarness();
    assert.equal(await h.api.clear(h.char), true);
    h.char.history.push({ id: 'new', content: '新消息' }); h.char.lastMsg = '新消息'; h.char.chatConfig.fontSize = 18;
    assert.equal(await h.undo(), true);
    assert.deepEqual(plain(h.char.history).map(item => item.id), ['old', 'new']);
    assert.equal(h.char.chatConfig.fontSize, 18);
    assert.equal(h.char.chatConfig.userTitle, '宝宝');
    assert.equal(h.char.lastMsg, '新消息');
    assert.equal(h.memory().chars.b.segments[0].id, 'other');
    assert.equal(h.memory().chars.a.segments[0].id, 'old-memory');
});

test('failed chat clear or Undo keeps the correct visible state and allows retry', async () => {
    const h = clearHarness(); h.setFail(true);
    assert.equal(await h.api.clear(h.char), false);
    assert.equal(h.char.history[0].id, 'old');
    assert.equal(h.char.chatConfig.userTitle, '宝宝');
    assert.match(h.notices[0], /清空失败/);
    h.setFail(false); assert.equal(await h.api.clear(h.char), true);
    h.setFail(true); await assert.rejects(h.undo(), /恢复未能保存/);
    assert.equal(h.char.history.length, 0);
    h.setFail(false); assert.equal(await h.undo(), true);
    assert.equal(h.char.history[0].id, 'old');
});
