const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function sourceSection(file, start, end) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `${file}: source boundaries must exist`);
    return source.slice(from, to);
}

function memoryStorage(entries = {}) {
    const values = new Map(Object.entries(entries));
    const writes = [];
    const removals = [];
    return {
        values, writes, removals,
        get length() { return values.size; },
        key: index => Array.from(values.keys())[index] ?? null,
        getItem: key => values.get(key) ?? null,
        setItem(key, value) { values.set(key, String(value)); writes.push([key, String(value)]); },
        removeItem(key) { values.delete(key); removals.push(key); }
    };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function storageHarness({ local, meta, record = null, entries = {} } = {}) {
    const localStorage = memoryStorage(entries);
    if (local !== undefined) localStorage.setItem('my_characters_data', JSON.stringify(local));
    if (meta !== undefined) localStorage.setItem('my_characters_data_meta', JSON.stringify(meta));
    const notices = [];
    const state = { record: clone(record), writes: [], readError: null, writeError: null };
    const context = vm.createContext({
        window: { myCharacters: [] }, localStorage, URL, Blob,
        console: { log() {}, warn() {}, error() {} },
        document: { getElementById: () => null },
        alert: message => notices.push(message),
        showWechatToast: message => notices.push(message),
        normalizeWechatCharacterAvatarData: char => char,
        getWechatCharAvatarSource: char => char?.avatar || '',
        getWechatFirstRealAvatarSource: (...sources) => sources.find(Boolean) || '',
        isWechatRealAvatarSource: value => typeof value === 'string' && !!value,
        applyWechatUiTheme() {}, renderChatList() {}, getCurrentChatChar: () => null
    });
    vm.runInContext(`
        const WECHAT_CHARACTERS_STORAGE_KEY = 'my_characters_data';
        const WECHAT_CHARACTERS_META_KEY = 'my_characters_data_meta';
        const WECHAT_CHARACTERS_DB_NAME = 'XuexiCharactersDB';
        const WECHAT_CHARACTERS_DB_STORE = 'characters';
        const WECHAT_CHARACTERS_DB_KEY = 'full';
        ${sourceSection('wechat.js', '// --- D. 本地存储：角色数据持久化 ---', '// --- 📑 微信 Tab 切换 ---')}
    `, context);
    context.loadWechatCharactersFromIndexedDb = async () => {
        if (state.readError) throw state.readError;
        return clone(state.record);
    };
    context.saveWechatCharactersToIndexedDb = async (characters, updatedAt) => {
        if (state.writeError) throw state.writeError;
        state.record = clone({ characters, updatedAt });
        state.writes.push(clone(state.record));
        return clone(state.record);
    };
    return { context, localStorage, state, notices };
}

function addBackupModule(harness) {
    const { context } = harness;
    vm.runInContext(sourceSection('settings.js', 'const APP_VERSION =', '// ========== 字体设置'), context);
    context.getFontStore = () => ({ fonts: [] });
    context.exportMonitorPetAssetsForBackup = async () => ({});
    return harness;
}

module.exports = { root, clone, sourceSection, memoryStorage, deferred, storageHarness, addBackupModule };
