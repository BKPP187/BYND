const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../core/diagnostics/diagnostics.js'), 'utf8');
const chatSource = fs.readFileSync(path.join(__dirname, '../core/api/chat-api.js'), 'utf8');

function harness(seed = {}) {
    const store = new Map(Object.entries(seed));
    const nodes = new Map();
    const state = { saves: 0, opened: 0, clicks: 0, removed: 0, revoked: 0, saved: true, blockStore: false, failDownload: false, reply: new Response('{}'), events: {} };
    nodes.set('bynd-diagnostics-status', { textContent: '', dataset: {} });
    nodes.set('bynd-diagnostics-character', { value: 'char1' });
    const context = vm.createContext({
        URL: class extends URL {
            static createObjectURL(blob) { if (state.failDownload) throw new Error('download blocked'); state.blob = blob; return 'blob:test'; }
            static revokeObjectURL() { state.revoked++; }
        },
        Blob, Response, Error, DOMException, setTimeout: callback => { callback(); },
        localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => { if (state.blockStore) throw new DOMException('private contents', 'QuotaExceededError'); store.set(key, value); } },
        document: { getElementById: id => nodes.get(id), createElement: () => ({ click: () => { state.clicks++; }, remove: () => { state.removed++; } }), body: { appendChild() {} } },
        navigator: { userAgent: 'Mozilla iPhone secret-device-name Safari/605.1', onLine: true },
        innerWidth: 375, innerHeight: 844, location: { href: 'https://private-host.example/path?key=secret' },
        console: { error() {}, warn() {}, log() {} },
        addEventListener: (type, listener) => { state.events[type] = listener; },
        fetch: async (...args) => { state.fetchArgs = args; if (state.reject) throw state.reject; return state.reply; },
        myCharacters: [{ id: 'char1', name: 'private-character-name', history: [] }],
        saveCharactersToStorage: async () => { state.saves++; if (state.saveError) throw state.saveError; return state.saved; },
        openApp: () => { state.opened++; }, openChat: () => { if (state.openError) throw new Error('open failed'); },
        APP_VERSION: 'v1.2.3'
    });
    context.window = context;
    vm.runInContext(source, context);
    return { context, api: context.ByndDiagnostics, state, store, nodes };
}

test('diagnostic export allowlists all fields, rejecting secrets and private content even in corrupted logs', () => {
    const sensitive = ['arbitrary-secret-key', 'private-chat-text', 'private-character-name', 'secret-device-name', 'private-host'];
    const { api, context, store } = harness({
        my_api_data: JSON.stringify({ defaultId: 'arbitrary-secret-key', apis: [{ id: 'arbitrary-secret-key', name: 'private-chat-text', apiKey: 'arbitrary-secret-key', model: 'private-chat-text', baseUrl: 'https://arbitrary-secret-key:password@private-host.example/tenant/private-chat-text?api_key=arbitrary-secret-key' }], voiceApi: { enabled: true, apiKey: 'arbitrary-secret-key', instructions: 'private-chat-text', model: 'private-chat-text' } }),
        my_characters_data: 'private-chat-text',
        bynd_diagnostics_v1: JSON.stringify([{ at: '2026-01-01T00:00:00.000Z', provider: 'arbitrary-secret-key', module: 'private-chat-text', stage: 'private-chat-text', code: 'private-chat-text', httpStatus: 'arbitrary-secret-key', message: 'private-chat-text', stack: 'arbitrary-secret-key', body: { messages: 'private-chat-text' } }])
    });
    api.record({ provider: 'openai', module: 'chat', stage: 'http', code: 'http_error', httpStatus: 401, message: 'private-chat-text', apiKey: 'arbitrary-secret-key' });
    context.console.error('private-chat-text', new Error('arbitrary-secret-key'));
    context.console.warn({ Authorization: 'Bearer arbitrary-secret-key', content: 'private-chat-text' });
    const pack = api.build();
    const output = JSON.stringify(pack) + store.get('bynd_diagnostics_v1');
    for (const secret of sensitive) assert.equal(output.includes(secret), false, secret);
    assert.equal(pack.providers[0].provider, 'custom');
    assert.equal(pack.providers[0].selectedForChat, true);
    assert.equal(pack.environment.os, 'iOS');
    assert.equal(pack.recentErrors[1].httpStatus, 401);
    assert.equal(pack.appVersion, 'v1.2.3');
});

test('runtime errors identify a fixed module and error class without retaining paths, stacks or messages', () => {
    const { api, state, context } = harness();
    const error = new Error('private-chat-text');
    error.name = 'ReferenceError'; error.stack = 'private-chat-text at https://private-host/apps/home3d/ui.js?key=secret-key:15:3';
    state.events.error({ error, filename: 'https://private-host/apps/home3d/ui.js?key=secret-key' });
    assert.equal(api.build().recentErrors.at(-1).module, 'home3d');
    assert.equal(api.build().recentErrors.at(-1).errorType, 'ReferenceError');
    state.events.unhandledrejection({ reason: { name: 'secret-key', stack: 'private-chat-text' } });
    assert.equal(api.build().recentErrors.at(-1).errorType, 'unknown');
    context.console.warn(error);
    assert.equal(api.build().recentErrors.at(-1).module, 'home3d');
    for (const text of ['private-chat-text', 'private-host', 'secret-key']) assert.equal(JSON.stringify(api.build()).includes(text), false);
});

test('fetch metadata records HTTP and network errors without consuming bodies or changing requests/rejections', async () => {
    const { context, api, state } = harness();
    state.reply = new Response('{"content":"private-chat-text","key":"secret-key"}', { status: 429 });
    const options = { headers: { authorization: 'Bearer secret-key' }, body: 'private-chat-text', method: 'POST' };
    const result = await context.fetch('https://api.openai.com/v1/chat/completions?key=secret-key', options);
    assert.equal(result, state.reply); assert.equal(result.bodyUsed, false); assert.equal(state.fetchArgs[1], options);
    assert.equal(api.build().recentErrors.at(-1).httpStatus, 429);
    assert.equal(api.build().recentErrors.at(-1).module, 'chat');
    assert.equal(api.build().recentErrors.at(-1).provider, 'openai');
    state.reject = new Error('private-chat-text secret-key');
    await assert.rejects(context.fetch('https://secret-key.example/audio/speech'), error => error === state.reject);
    assert.equal(api.build().recentErrors.at(-1).code, 'network_error');
    assert.equal(JSON.stringify(api.build()).includes('secret-key'), false);
});

test('error buffer is bounded, persists safely, and still works when storage is unavailable', () => {
    const { api, state, store } = harness();
    for (let i = 0; i < 120; i++) api.record({ module: 'voice', stage: 'http', code: 'http_error', httpStatus: 503 });
    assert.equal(api.build().recentErrors.length, 80);
    assert.equal(harness({ bynd_diagnostics_v1: store.get('bynd_diagnostics_v1') }).api.build().recentErrors.length, 80);
    state.blockStore = true;
    assert.doesNotThrow(() => api.record({ module: 'storage', stage: 'save', code: 'storage_error' }));
    assert.equal(api.build().collection.persistenceAvailable, false);
    assert.equal(api.build().recentErrors.at(-1).module, 'storage');
});

test('download reports failures without success, removes anchor and emits a usable JSON package', async () => {
    const { api, state, nodes } = harness();
    state.failDownload = true;
    assert.equal(await api.exportPackage(), false);
    assert.equal(nodes.get('bynd-diagnostics-status').dataset.error, 'true');
    assert.equal(state.clicks, 0);
    state.failDownload = false;
    assert.equal(await api.exportPackage(), true);
    assert.equal(state.clicks, 1); assert.equal(state.removed, 1); assert.equal(state.revoked, 1);
    assert.equal(JSON.parse(await state.blob.text()).format, 'BYND_REDACTED_DIAGNOSTICS');
    assert.match(nodes.get('bynd-diagnostics-status').textContent, /发起.*下载/);
});

test('sending to selected character waits for persistence and rolls back on both false and rejected saves', async () => {
    const { api, context, state, nodes } = harness();
    state.saved = false;
    assert.equal(await api.sendToCharacter(), false);
    assert.equal(context.myCharacters[0].history.length, 0); assert.equal(state.opened, 0);
    assert.equal(nodes.get('bynd-diagnostics-status').dataset.error, 'true');
    state.saveError = new Error('storage failed secret-key');
    assert.equal(await api.sendToCharacter(), false);
    assert.equal(context.myCharacters[0].history.length, 0);
    state.saveError = null; state.saved = true;
    assert.equal(await api.sendToCharacter(), true);
    assert.equal(context.myCharacters[0].history.length, 1); assert.equal(state.opened, 1);
    assert.match(context.myCharacters[0].history[0].content, /尚未获得自动修改/);
    assert.equal(context.myCharacters[0].history[0].content.includes('private-character-name'), false);
    state.openError = true;
    assert.equal(await api.sendToCharacter(), false);
    assert.equal(context.myCharacters[0].history.length, 2, 'persisted message must survive navigation failure');
    assert.match(nodes.get('bynd-diagnostics-status').textContent, /已保存.*打开聊天失败/);
});

test('Android export waits for native write acknowledgement and reports cancellation without falling back to a fake download', async () => {
    const { api, context, state, nodes } = harness();
    context.location = { protocol: 'file:', pathname: '/android_asset/www/index.html' };
    context.ByndAndroid = {};
    assert.equal(api.build().environment.runtime, 'android-webview');
    let finish, fail;
    context.exportByndBackupThroughAndroid = (blob, filename) => {
        assert.match(filename, /^BYND-diagnostics-v1.2.3-.*\.json$/);
        state.blob = blob;
        return new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    };
    const cancelled = api.exportPackage();
    assert.match(nodes.get('bynd-diagnostics-status').textContent, /请选择/);
    assert.equal(await api.exportPackage(), false);
    fail(new Error('native write cancelled secret-key'));
    assert.equal(await cancelled, false);
    assert.equal(state.clicks, 0);
    assert.equal(nodes.get('bynd-diagnostics-status').dataset.error, 'true');
    const successful = api.exportPackage();
    finish(); assert.equal(await successful, true);
    assert.match(nodes.get('bynd-diagnostics-status').textContent, /已保存/);
    assert.equal(state.clicks, 0);
    assert.equal(JSON.stringify(api.build()).includes('secret-key'), false);
});

test('sharing refuses absent or group recipients and suppresses duplicate taps during save', async () => {
    const { api, context, state, nodes } = harness();
    nodes.get('bynd-diagnostics-character').value = '';
    assert.equal(await api.sendToCharacter(), false); assert.equal(state.saves, 0);
    nodes.get('bynd-diagnostics-character').value = 'char1'; context.myCharacters[0].isGroupChat = true;
    assert.equal(await api.sendToCharacter(), false); assert.equal(state.saves, 0);
    context.myCharacters[0].isGroupChat = false;
    let settle;
    context.saveCharactersToStorage = () => new Promise(resolve => { settle = resolve; });
    const pending = api.sendToCharacter();
    assert.equal(await api.sendToCharacter(), false);
    settle(true); assert.equal(await pending, true);
    assert.equal(context.myCharacters[0].history.length, 1);
});

test('chat API records missing config, bad JSON, empty response, and retains HTTP status at parse failures', async () => {
    const { context, api, state } = harness();
    context.AbortSignal = { timeout: () => undefined };
    context.getDefaultApi = () => state.chatApi;
    context.setTimeout = setTimeout; context.clearTimeout = clearTimeout;
    vm.runInContext(chatSource, context);
    assert.equal((await context.callChatApi([])).ok, false);
    assert.equal(api.build().recentErrors.at(-1).code, 'missing_api');
    state.chatApi = { baseUrl: 'https://api.openai.com/v1', apiKey: 'secret-key' };
    assert.equal((await context.callChatApi([])).ok, false);
    assert.equal(api.build().recentErrors.at(-1).code, 'missing_model');
    state.chatApi.model = 'model'; state.reply = new Response('private-chat-text secret-key', { status: 200 });
    assert.equal((await context.callChatApi([])).ok, false);
    assert.equal(api.build().recentErrors.at(-1).stage, 'parse');
    assert.equal(api.build().recentErrors.at(-1).httpStatus, 200);
    state.reply = new Response('{"choices":[{"message":{"content":""}}]}');
    assert.equal((await context.callChatApi([])).ok, false);
    assert.equal(api.build().recentErrors.at(-1).code, 'empty_response');
    assert.equal(JSON.stringify(api.build()).includes('secret-key'), false);
});
