'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { memoryStorage, storageHarness, addBackupModule } = require('./helpers/harness.cjs');
const source = fs.readFileSync(path.resolve(__dirname, '../apps/settings/tripo.js'), 'utf8');
function harness(fetch = async () => { throw new Error('unexpected fetch'); }) {
    const localStorage = memoryStorage();
    const fields = Object.fromEntries(['url', 'key', 'show', 'status', 'test'].map(key => ['tripo-' + key, { value: '', textContent: '', type: 'password', dataset: {}, setAttribute() {} }]));
    const window = {};
    vm.runInNewContext(source, { window, localStorage, document: { getElementById: id => fields[id] }, URL, AbortController, setTimeout, clearTimeout, fetch, TypeError });
    const api = window.ByndTripo;
    api.renderSettings();
    return { api, localStorage, fields, status: fields['tripo-status'] };
}
const draft = { baseUrl: 'https://openapi.tripo3d.ai/v3', apiKey: 'example-personal-key' };

test('Tripo settings have no default key and commit device secrets only after a successful save', () => {
    const h = harness();
    assert.equal(h.api.read().apiKey, '');
    assert.equal(h.fields['tripo-key'].type, 'password');
    h.api.write(draft);
    const before = h.localStorage.getItem(h.api.storageKey);
    h.fields['tripo-key'].value = 'another-example-key';
    h.localStorage.setItem = () => { throw new Error('quota'); };
    h.api.saveSettings();
    assert.equal(h.status.dataset.error, 'true');
    assert.match(h.status.textContent, /保存失败/);
    assert.equal(h.localStorage.getItem(h.api.storageKey), before);
    h.localStorage.removeItem = () => { throw new Error('blocked'); };
    h.api.clearSettings();
    assert.match(h.status.textContent, /清除失败/);
    assert.equal(h.localStorage.getItem(h.api.storageKey), before);
});

test('corrupt saved Tripo config is retained; unsafe URLs fail before credentials are sent', async () => {
    const h = harness();
    h.localStorage.setItem(h.api.storageKey, '{broken');
    assert.throws(() => h.api.read(), /原数据已保留/);
    for (const baseUrl of ['http://example.com/v3', 'https://user:password@example.com/v3', 'https://example.com/v3?key=secret', 'https://example.com/v3#secret', 'https://api.tripo3d.ai/v2/openapi'])
        await assert.rejects(h.api.testConnection({ ...draft, baseUrl }));
    assert.equal(h.localStorage.getItem(h.api.storageKey), '{broken');
});

test('Tripo tests query balance through the pinned relay without saving or creating tasks', async () => {
    const requests = [];
    const h = harness(async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ code: 0, data: { balance: 0 } }) }; });
    const result = await h.api.testConnection(draft);
    assert.equal(result.balance, 0);
    assert.equal(requests[0].url, 'https://bynd.ccwu.cc/mcp/relay/tripo/v3/account/balance');
    assert.equal(requests[0].options.method, 'GET');
    assert.equal(requests[0].options.headers.Authorization, 'Bearer ' + draft.apiKey);
    assert.equal(requests[0].options.redirect, 'error');
    assert.equal(h.localStorage.getItem(h.api.storageKey), null);
});

test('Tripo HTTP, business, malformed balance, JSON, network and timeout failures never report success or expose keys', async () => {
    const cases = [
        async () => ({ ok: false, status: 401 }), async () => ({ ok: false, status: 404 }),
        async () => ({ ok: true, json: async () => ({ code: 2010, message: draft.apiKey }) }),
        async () => ({ ok: true, json: async () => ({ code: 0, data: { balance: '200' } }) }),
        async () => ({ ok: true, json: async () => { throw new Error(draft.apiKey); } }),
        async () => { throw new TypeError('fetch failed'); },
        async () => { const error = new Error('timeout'); error.name = 'AbortError'; throw error; },
        async () => { throw new Error('echo ' + draft.apiKey); }
    ];
    for (const fetch of cases) {
        const h = harness(fetch);
        h.fields['tripo-key'].value = draft.apiKey;
        await h.api.testSettings();
        assert.equal(h.status.dataset.error, 'true');
        assert.equal(h.status.textContent.includes(draft.apiKey), false);
        assert.equal(h.fields['tripo-test'].disabled, false);
        assert.equal(h.localStorage.getItem(h.api.storageKey), null);
    }
});

test('a failed CORS preflight is diagnosed through a keyless probe when the relay is missing', async () => {
    const calls = [];
    const h = harness(async (url, options) => {
        calls.push({ url, options });
        if (calls.length === 1) throw new TypeError('Failed to fetch');
        return { status: 404 };
    });
    h.fields['tripo-key'].value = draft.apiKey;
    await h.api.testSettings();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].options.headers.Authorization, undefined);
    assert.equal(h.status.dataset.error, 'true');
    assert.match(h.status.textContent, /连接服务尚未上线/);
    assert.equal(h.status.textContent.includes(draft.apiKey), false);
});

test('an authenticated zero balance directs users to check their trial wallet without denying trial credits', async () => {
    const h = harness(async () => ({ ok: true, json: async () => ({ code: 0, data: { balance: 0 } }) }));
    h.fields['tripo-key'].value = draft.apiKey;
    await h.api.testSettings();
    assert.equal(h.status.dataset.error, 'false');
    assert.match(h.status.textContent, /连接成功.*余额 0.*Billing.*免费试用/);
    assert.doesNotMatch(h.status.textContent, /暂无生成额度/);
});

test('a late balance response cannot overwrite edited or cleared settings status', async () => {
    let resolve;
    const h = harness(() => new Promise(done => { resolve = done; }));
    h.fields['tripo-key'].value = draft.apiKey;
    const pending = h.api.testSettings();
    h.api.clearSettings();
    resolve({ ok: true, json: async () => ({ code: 0, data: { balance: 10 } }) });
    await pending;
    assert.match(h.status.textContent, /已清除/);
    assert.equal(h.fields['tripo-key'].value, '');
});

test('Tripo secrets are excluded from backup and cannot be replaced through import', async () => {
    const key = 'bynd_tripo_private_v1', original = JSON.stringify(draft);
    const h = addBackupModule(storageHarness({ local: [], entries: { [key]: original } }));
    const backup = await h.context.buildByndBackupData();
    assert.equal(Object.hasOwn(backup, key), false);
    assert.equal(JSON.stringify(backup).includes(draft.apiKey), false);
    h.context.confirm = () => true;
    h.context.location = { reload() {} };
    await h.context.importAllData({ value: 'file', files: [{ text: async () => JSON.stringify({ _version: 'test', [key]: { apiKey: 'imported-key' } }) }] });
    assert.equal(h.localStorage.getItem(key), original);
});
