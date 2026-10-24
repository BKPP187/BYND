const assert = require('node:assert/strict');
const test = require('node:test');
const { clone, storageHarness, addBackupModule } = require('./helpers/harness.cjs');

const before = [{ id: 'old', name: '旧角色', history: [] }];
const imported = [{ id: 'new', name: '新角色', history: [] }];

async function ready(entries = {}) {
    const h = addBackupModule(storageHarness({ record: { characters: clone(before), updatedAt: 100 }, entries }));
    await h.context.loadCharactersFromStorage();
    h.context.confirm = () => true;
    h.reloads = 0;
    h.context.location = { reload() { h.reloads += 1; } };
    return h;
}
const importBackup = (h, data) => h.context.importAllData({ value: 'file', files: [{ text: async () => JSON.stringify(data) }] });

test('a character write failure restores the settings that were already written', async () => {
    const h = await ready({ my_api_data: '{"host":"keep"}' });
    // IndexedDB failures alone fall back to localStorage; fail the whole character save.
    h.state.writeError = new Error('IndexedDB unavailable');
    const setItem = h.localStorage.setItem.bind(h.localStorage);
    h.localStorage.setItem = (key, value) => {
        if (key === 'my_characters_data') { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; }
        setItem(key, value);
    };
    await importBackup(h, { _version: 'v1', my_api_data: { host: 'replace' }, bynd_new_feature_v1: 'x', my_characters_data: imported });
    assert.equal(h.localStorage.getItem('my_api_data'), '{"host":"keep"}');
    assert.equal(h.localStorage.getItem('bynd_new_feature_v1'), null, 'keys that did not exist are removed again');
    assert.equal(h.reloads, 0);
    assert.match(h.notices.at(-1), /导入失败/);
    assert.match(h.notices.at(-1), /已恢复到导入前/);
});

test('a later asset failure puts the previous characters and settings back', async () => {
    const h = await ready({ my_api_data: '{"host":"keep"}' });
    h.context.exportDreamImagesForBackup = async () => ({ old_img: 'data:old' });
    let restoredDreams = null;
    h.context.importDreamImagesFromBackup = async entries => {
        if (entries.new_img) throw new Error('dream store full');
        restoredDreams = entries;
    };
    await importBackup(h, { _version: 'v1', my_api_data: { host: 'replace' }, my_characters_data: imported, _dreamImages: { new_img: 'data:new' } });
    assert.equal(h.reloads, 0);
    assert.equal(h.localStorage.getItem('my_api_data'), '{"host":"keep"}');
    assert.deepEqual(clone(h.state.record.characters).map(c => c.id), ['old']);
    assert.deepEqual(clone(restoredDreams), { old_img: 'data:old' });
    assert.match(h.notices.at(-1), /导入失败.*dream store full/);
    assert.doesNotMatch(h.notices.at(-1), /成功/);
});

test('a rollback that cannot complete says so instead of claiming recovery', async () => {
    const h = await ready({ my_api_data: '{"host":"keep"}' });
    const setItem = h.localStorage.setItem.bind(h.localStorage);
    let failRestore = false;
    h.localStorage.setItem = (key, value) => {
        if (key === 'bynd_second_v1') { failRestore = true; throw new Error('quota exceeded'); }
        if (failRestore && key === 'my_api_data') throw new Error('still full');
        setItem(key, value);
    };
    await importBackup(h, { _version: 'v1', my_api_data: { host: 'replace' }, bynd_second_v1: 'y' });
    assert.match(h.notices.at(-1), /导入失败.*quota exceeded/);
    assert.match(h.notices.at(-1), /未能恢复/);
});

test('a successful import still writes everything and reloads', async () => {
    const h = await ready({ my_api_data: '{"host":"keep"}' });
    await importBackup(h, { _version: 'v1', my_api_data: { host: 'replace' }, my_characters_data: imported });
    assert.equal(h.reloads, 1);
    assert.equal(h.localStorage.getItem('my_api_data'), '{"host":"replace"}');
    assert.deepEqual(clone(h.state.record.characters).map(c => c.id), ['new']);
});
