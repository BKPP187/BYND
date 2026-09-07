const assert = require('node:assert/strict');
const test = require('node:test');
const { clone, deferred, storageHarness, addBackupModule } = require('./helpers/harness.cjs');

const old = [{ id: 'role', name: '角色', history: [{ content: '旧消息' }] }];
const latest = [{ id: 'role', name: '角色', history: [{ content: '新消息' }] }];

test('loading promotes a newer full local snapshot into IndexedDB', async () => {
    const h = storageHarness({ local: latest, meta: { mode: 'full', updatedAt: 200 }, record: { characters: old, updatedAt: 100 } });
    await h.context.loadCharactersFromStorage();
    assert.deepEqual(clone(h.context.window.myCharacters), latest);
    assert.deepEqual(h.state.record, { characters: latest, updatedAt: 200 });
});

test('a newer empty local list remains empty on reload and export', async () => {
    const h = addBackupModule(storageHarness({ local: [], meta: { mode: 'full', updatedAt: 200 }, record: { characters: old, updatedAt: 100 } }));
    await h.context.loadCharactersFromStorage();
    const backup = await h.context.buildByndBackupData();
    assert.deepEqual(clone(h.context.window.myCharacters), []);
    assert.deepEqual(clone(backup.my_characters_data), []);
    assert.deepEqual(h.state.record.characters, []);
});

test('a newer empty IndexedDB list replaces an older full local list', async () => {
    const h = storageHarness({ local: old, meta: { mode: 'full', updatedAt: 100 }, record: { characters: [], updatedAt: 200 } });
    await h.context.loadCharactersFromStorage();
    assert.deepEqual(clone(h.context.window.myCharacters), []);
});

test('equal timestamps and legacy full local data prefer the local copy', async () => {
    for (const updatedAt of [200, undefined]) {
        const h = storageHarness({ local: latest, meta: { mode: 'full', updatedAt }, record: { characters: old, updatedAt: 200 } });
        await h.context.loadCharactersFromStorage();
        assert.deepEqual(clone(h.context.window.myCharacters), latest);
    }
});

test('compact local indexes are never applied to live characters before hydration', async () => {
    const h = storageHarness({ local: [{ id: 'role', __indexedDbBacked: true, history: [] }], meta: { mode: 'indexeddb', updatedAt: 100 } });
    const gate = deferred();
    h.context.loadWechatCharactersFromIndexedDb = () => gate.promise;
    const loading = h.context.loadCharactersFromStorage();
    assert.deepEqual(clone(h.context.window.myCharacters), []);
    assert.equal(await h.context.saveCharactersToStorage(), false);
    assert.equal(h.state.writes.length, 0);
    gate.resolve({ characters: latest, updatedAt: 100 });
    await loading;
    assert.deepEqual(clone(h.context.window.myCharacters), latest);
});

test('missing, stale, failed or compact IndexedDB data cannot be exported as a full backup', async () => {
    for (const failure of ['missing', 'stale', 'failed', 'compact']) {
        const h = addBackupModule(storageHarness({ local: [{ id: 'role', __indexedDbBacked: true }], meta: { mode: 'indexeddb', updatedAt: 200 } }));
        if (failure === 'stale') h.state.record = { characters: old, updatedAt: 100 };
        if (failure === 'failed') h.state.readError = new Error('database offline');
        if (failure === 'compact') h.state.record = { characters: [{ id: 'role', __indexedDbBacked: true }], updatedAt: 200 };
        let downloads = 0;
        h.context.document.createElement = () => ({ click() { downloads++; } });
        await h.context.loadCharactersFromStorage();
        assert.equal(h.context.window._wechatCharactersStorageState.status, 'error', failure);
        assert.equal(await h.context.saveCharactersToStorage(), false, failure);
        assert.equal(await h.context.exportAllData(), false, failure);
        assert.equal(downloads, 0, failure);
        assert.equal(h.state.writes.length, 0, failure);
        assert.deepEqual(h.localStorage.removals, [], failure);
        assert.ok(!h.notices.some(message => message === '导出成功！'), failure);
    }
});

test('corrupt or null local data does not silently become an empty character list', async () => {
    for (const raw of ['null', '{broken', '{"characters":[]}', '[null]', '[[]]']) {
        const h = storageHarness();
        h.localStorage.setItem('my_characters_data', raw);
        await h.context.loadCharactersFromStorage();
        assert.equal(h.context.window._wechatCharactersStorageState.status, 'error');
        assert.equal(h.localStorage.getItem('my_characters_data'), raw);
    }
});

test('malformed IndexedDB records do not become a writable empty installation', async () => {
    for (const record of [{ characters: [null], updatedAt: 100 }, { characters: 'broken' }, {}]) {
        const h = storageHarness({ record });
        await h.context.loadCharactersFromStorage();
        assert.equal(h.context.window._wechatCharactersStorageState.status, 'error');
        assert.equal(await h.context.saveCharactersToStorage(), false);
        assert.equal(h.state.writes.length, 0);
    }
});

test('metadata and IndexedDB failure cannot report a successful save', async () => {
    const h = storageHarness({ local: old, meta: { mode: 'full', updatedAt: 100 }, record: { characters: old, updatedAt: 100 } });
    await h.context.loadCharactersFromStorage();
    const setItem = h.localStorage.setItem.bind(h.localStorage);
    h.localStorage.setItem = (key, value) => {
        if (key === 'my_characters_data_meta') throw new Error('metadata unavailable');
        setItem(key, value);
    };
    h.state.writeError = new Error('database unavailable');
    h.context.window.myCharacters[0].history.push({ content: 'new' });
    assert.equal(await h.context.saveCharactersToStorage(), false);
});

test('complete local data still loads when IndexedDB is unavailable', async () => {
    const h = storageHarness({ local: latest, meta: { mode: 'full', updatedAt: 200 } });
    h.state.readError = h.state.writeError = new Error('database offline');
    await h.context.loadCharactersFromStorage();
    assert.equal(h.context.window._wechatCharactersStorageState.status, 'ready');
    assert.deepEqual(clone(h.context.window.myCharacters), latest);
});

test('queued snapshots detach nested history and save in order', async () => {
    const h = storageHarness({ local: old, meta: { mode: 'full', updatedAt: 100 }, record: { characters: old, updatedAt: 100 } });
    await h.context.loadCharactersFromStorage();
    const gate = deferred();
    const writes = [];
    h.context.persistWechatCharactersSnapshot = async data => {
        if (!writes.length) { writes.push(data); await gate.promise; }
        else writes.push(data);
        return true;
    };
    const first = h.context.saveCharactersToStorage();
    h.context.window.myCharacters[0].history.push({ content: 'later' });
    h.context.window.myCharacters[0].chatConfig = { nickname: 'later' };
    const second = h.context.saveCharactersToStorage();
    gate.resolve();
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(writes[0][0].history.length, 1);
    assert.equal(writes[1][0].history.length, 2);
    assert.equal(writes[0][0].chatConfig.nickname, undefined);
});

test('backup waits for a pending save and exports the newest snapshot', async () => {
    const h = addBackupModule(storageHarness({ local: old, meta: { mode: 'full', updatedAt: 100 }, record: { characters: old, updatedAt: 100 } }));
    await h.context.loadCharactersFromStorage();
    const gate = deferred();
    const persist = h.context.persistWechatCharactersSnapshot;
    h.context.persistWechatCharactersSnapshot = async (...args) => { await gate.promise; return persist(...args); };
    h.context.window.myCharacters[0].history.push({ content: '刚发送的消息' });
    h.context.saveCharactersToStorage();
    let completed = false;
    const backup = h.context.buildByndBackupData().then(value => { completed = true; return value; });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(completed, false);
    gate.resolve();
    assert.equal((await backup).my_characters_data[0].history.at(-1).content, '刚发送的消息');
});

test('failed persistence returns false while a complete in-memory snapshot can be backed up', async () => {
    const h = addBackupModule(storageHarness({ local: old, meta: { mode: 'full', updatedAt: 100 }, record: { characters: old, updatedAt: 100 } }));
    await h.context.loadCharactersFromStorage();
    h.context.window.myCharacters[0].history.push({ content: '未保存的新消息' });
    h.context.persistWechatCharactersSnapshot = async () => { throw new Error('quota'); };
    h.state.writeError = new Error('quota');
    assert.equal(await h.context.saveCharactersToStorage(), false);
    assert.equal((await h.context.buildByndBackupData()).my_characters_data[0].history.at(-1).content, '未保存的新消息');
});

test('importing an empty full backup clears both character stores', async () => {
    const h = storageHarness({ local: old, meta: { mode: 'full', updatedAt: 100 }, record: { characters: old, updatedAt: 100 } });
    await h.context.saveWechatImportedCharactersData([]);
    assert.deepEqual(JSON.parse(h.localStorage.getItem('my_characters_data')), []);
    assert.deepEqual(h.state.record.characters, []);
    await h.context.loadCharactersFromStorage();
    assert.deepEqual(clone(h.context.window.myCharacters), []);
});

test('import rejects an incomplete index before changing any application settings', async () => {
    const h = addBackupModule(storageHarness({ entries: { my_api_data: '{"host":"keep"}' } }));
    h.context.confirm = () => true;
    h.context.location = { reload() { throw new Error('must not reload'); } };
    const input = { value: 'file', files: [{ text: async () => JSON.stringify({ _version: 'v1', my_api_data: { host: 'replace' }, my_characters_data: [{ id: 'role', __indexedDbBacked: true }] }) }] };
    await h.context.importAllData(input);
    assert.equal(h.localStorage.getItem('my_api_data'), '{"host":"keep"}');
    assert.equal(h.state.writes.length, 0);
    assert.match(h.notices.at(-1), /导入失败/);
});

test('large-data fallback preserves the previous local snapshot if the compact index cannot be written', async () => {
    const h = storageHarness({ local: old, meta: { mode: 'full', updatedAt: 100 } });
    const setItem = h.localStorage.setItem.bind(h.localStorage);
    h.localStorage.setItem = (key, value) => {
        if (key === 'my_characters_data') { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; }
        setItem(key, value);
    };
    assert.equal(await h.context.persistWechatCharactersSnapshot(latest, 200), true);
    assert.deepEqual(h.state.record.characters, latest);
    assert.deepEqual(JSON.parse(h.localStorage.getItem('my_characters_data')), old);
    assert.deepEqual(h.localStorage.removals, []);
    await h.context.loadCharactersFromStorage();
    assert.deepEqual(clone(h.context.window.myCharacters), latest);
});

test('cache cleanup retains business, unknown, third-party and malformed font data', async () => {
    const entries = {
        bynd_music_favorites_v1: '[1]', bynd_music_playlists_v1: '[2]',
        bynd_chat_album_v1: '[3]', bynd_github_mcp_config_v1: '{"endpoint":"test"}',
        my_characters_data: '[]', my_font_data: '{broken',
        bynd_cache_unknown_business: 'keep', third_party: 'keep',
        wechat_x_realtime_news_cache_v4: '{"items":[]}'
    };
    const h = addBackupModule(storageHarness({ entries }));
    h.context.openFontDB = () => { throw new Error('cache cleanup must not touch imported assets'); };
    await h.context.clearInvalidCache();
    for (const [key, value] of Object.entries(entries)) {
        assert.equal(h.localStorage.getItem(key), key === 'wechat_x_realtime_news_cache_v4' ? null : value, key);
    }
    assert.deepEqual(h.localStorage.removals, ['wechat_x_realtime_news_cache_v4']);
});

test('backup and import preserve dynamically added app keys and raw string values', async () => {
    const entries = { bynd_future_feature_v1: 'raw-string', wechat_future_feature_v1: '{"enabled":true}', desktop_future_v1: '23', unrelated_site: 'private' };
    const h = addBackupModule(storageHarness({ local: [], entries }));
    const backup = await h.context.buildByndBackupData();
    assert.equal(backup.unrelated_site, undefined);
    const target = addBackupModule(storageHarness());
    let reloaded = false;
    target.context.confirm = () => true;
    target.context.location = { reload() { reloaded = true; } };
    await target.context.importAllData({ value: 'file', files: [{ text: async () => JSON.stringify(backup) }] });
    assert.equal(reloaded, true);
    for (const [key, value] of Object.entries(entries)) {
        assert.equal(target.localStorage.getItem(key), key === 'unrelated_site' ? null : value, key);
    }
});
