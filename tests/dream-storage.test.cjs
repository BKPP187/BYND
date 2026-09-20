const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { fakeIndexedDb } = require('./helpers/fake-indexeddb.cjs');
const { storageHarness, addBackupModule } = require('./helpers/harness.cjs');

const source = fs.readFileSync('script.js', 'utf8');
const moduleSource = source.slice(
    source.indexOf('// --- Dream Vault / 盗梦空间 ---'),
    source.indexOf('// --- BYND Monitor / 内部监控剧情入口 ---')
);
const recordsKey = 'bynd_dream_records_v1';
const bigImage = 'data:image/png;base64,' + 'A'.repeat(200000);
const payload = {
    title: '雨停之前', summary: '一次还没有说完的告别。', intent: '想问对方是否愿意多留一会儿。',
    openingScene: '窗缝里有细小的风声。', charAction: '“雨还没停。”',
    choices: ['留在原地', '先走'], imagePrompt: 'a quiet room after rain'
};
const flush = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 8; i++) await flush(); };

function element(id) {
    const classes = new Set();
    const el = {
        id, innerHTML: '', textContent: '', dataset: {}, src: '', disabled: false,
        classList: {
            add: name => classes.add(name), remove: name => classes.delete(name),
            contains: name => classes.has(name), toggle: (name, force) => { force ? classes.add(name) : classes.delete(name); }
        },
        classes,
        img: null,
        querySelector: selector => selector === 'img' ? el.img : null,
        querySelectorAll: () => []
    };
    return el;
}

function setup({ capacity: initialCapacity = Infinity, image = bigImage } = {}) {
    let capacity = initialCapacity;
    const store = new Map();
    const usage = () => [...store.values()].reduce((sum, value) => sum + value.length, 0);
    const localStorage = {
        getItem: key => store.get(key) ?? null,
        removeItem: key => store.delete(key),
        setItem(key, value) {
            const next = usage() - (store.get(key) || '').length + String(value).length;
            if (next > capacity) {
                const error = new Error(`Failed to execute 'setItem' on 'Storage': Setting the value of '${key}' exceeded the quota.`);
                error.name = 'QuotaExceededError';
                throw error;
            }
            store.set(key, String(value));
        }
    };
    const elements = new Map(['dream-status', 'dream-preview-status', 'dream-session-status', 'dream-preview-content', 'dream-list', 'dream-preview-view', 'dream-preview-media']
        .map(id => [id, element(id)]));
    elements.get('dream-preview-view').classList.add('hidden');
    const media = elements.get('dream-preview-media');
    media.img = { src: '' };
    Object.defineProperty(elements.get('dream-preview-content'), 'innerHTML', {
        set(html) {
            this.html = html;
            const match = /class="dream-preview-media([^"]*)"[^>]*>\s*<img src="([^"]*)"/.exec(html);
            media.classes.clear();
            if (match) { match[1].trim().split(/\s+/).filter(Boolean).forEach(name => media.classes.add(name)); media.img.src = match[2]; }
        },
        get() { return this.html || ''; }
    });
    const idb = fakeIndexedDb();
    const char = { id: 'writer', name: '林舟', description: '克制。', avatar: 'data:image/png;base64,AVATAR' };
    const context = vm.createContext({
        URL, console: { warn() {}, log() {}, error() {} }, confirm: () => true, setImmediate, setTimeout,
        indexedDB: idb.indexedDB,
        document: { getElementById: id => elements.get(id) || null, querySelectorAll: () => [] },
        localStorage,
        musicEscapeAttr: value => String(value || '').replace(/"/g, '&quot;'),
        musicEscapeHtml: value => String(value || ''),
        getWechatSortedChatCharacters: () => [char],
        getWechatChatUserProfile: () => ({ name: '许宁' }),
        buildWechatIdentityContextPrompt: () => 'IDENTITY',
        getWechatCharacterPersonaText: () => 'PERSONA',
        buildWechatMemoryPrompt: () => 'MEMORY',
        buildWechatRecentHistoryForPrompt: () => 'RECENT',
        callChatApi: async () => ({ ok: true, content: JSON.stringify(payload) }),
        callWechatImageGenerationApi: async () => image ? { ok: true, url: image } : { ok: false, error: 'no image' },
        window: { location: { href: 'http://localhost/' }, myCharacters: [char] }
    });
    vm.runInContext(moduleSource, context);
    const images = () => idb.read('bynd_dream_images_v1', 'images');
    return { context, store, localStorage, elements, media, idb, images, char, usage, setCapacity: value => { capacity = value; } };
}

test('generated dream images are stored in IndexedDB and records stay small', async () => {
    const { context: c, store, images, elements } = setup();
    await c.generateDreamRecord();
    const [record] = c.getDreamRecords();
    assert.ok(record, 'the record is saved');
    assert.equal(record.imageUrl, undefined, 'no inline image in localStorage');
    assert.equal(record.avatar, undefined, 'no copied avatar in localStorage');
    assert.match(record.imageKey, /^dream_img_dream_/);
    assert.equal(images().get(record.imageKey), bigImage);
    assert.ok(store.get(recordsKey).length < 2000, `record must be compact, got ${store.get(recordsKey).length}`);
    assert.equal(elements.get('dream-status').dataset.tone, '');
    assert.match(elements.get('dream-preview-content').innerHTML, /dream-preview-media/);
});

test('the preview loads the stored image asynchronously and never overwrites a newer preview', async () => {
    const { context: c, media, images } = setup();
    await c.generateDreamRecord();
    const [record] = c.getDreamRecords();
    vm.runInContext('dreamImageCache.clear()', c);
    c.openDreamPreview(record.id);
    assert.ok(media.classes.has('avatar-only') && media.classes.has('loading'), 'avatar shown while the image loads');
    await settle();
    assert.equal(media.img.src, bigImage);
    assert.ok(!media.classes.has('loading') && !media.classes.has('avatar-only'));
    vm.runInContext('dreamImageCache.clear()', c);
    images().set(record.imageKey, 'data:image/png;base64,LATER');
    c.openDreamPreview(record.id);
    vm.runInContext("dreamPreviewRecordId = 'other'", c);
    await settle();
    assert.notEqual(media.img.src, 'data:image/png;base64,LATER', 'a stale load must not touch another preview');
});

test('a full localStorage is recovered by moving legacy inline images out before saving the new dream', async () => {
    const { context: c, store, images, elements, usage, setCapacity } = setup();
    const legacy = [
        { ...payload, id: 'old_a', charId: 'writer', createdAt: 1, imageUrl: 'data:image/png;base64,' + 'B'.repeat(120000), avatar: 'data:image/png;base64,AVATAR' },
        { ...payload, id: 'old_b', charId: 'writer', createdAt: 2, imageUrl: 'data:image/png;base64,' + 'C'.repeat(120000) }
    ];
    store.set(recordsKey, JSON.stringify(legacy));
    assert.ok(usage() > 240000);
    setCapacity(usage() + 200);
    await c.generateDreamRecord();
    const records = c.getDreamRecords();
    assert.equal(records.length, 3, 'the new dream is saved after recovery');
    assert.equal(records[0].imageKey, `dream_img_${records[0].id}`);
    assert.equal(images().get(records[0].imageKey), bigImage);
    for (const id of ['old_a', 'old_b']) {
        const record = records.find(item => item.id === id);
        assert.equal(record.imageUrl, undefined, `${id} inline image moved out`);
        assert.equal(record.avatar, undefined);
        assert.equal(images().get(record.imageKey), legacy.find(item => item.id === id).imageUrl, `${id} image preserved in IndexedDB`);
    }
    assert.ok(usage() < 5000, `localStorage should be nearly empty, got ${usage()}`);
    assert.equal(elements.get('dream-status').dataset.tone, '');
});

test('when nothing can be freed the failure is reported honestly and no orphan image remains', async () => {
    const { context: c, store, images, elements } = setup({ capacity: 500 });
    store.set(recordsKey, JSON.stringify([{ ...payload, id: 'keep', charId: 'writer', createdAt: 1 }].map(r => ({ ...r, summary: 'x'.repeat(300) }))));
    await c.generateDreamRecord();
    assert.equal(c.getDreamRecords().length, 1, 'the unsaved dream is not pretended to exist');
    assert.equal(c.getDreamRecords()[0].id, 'keep');
    assert.equal(images().size, 0, 'the image written before the failed record save is removed again');
    assert.equal(elements.get('dream-status').dataset.tone, 'error');
    assert.match(elements.get('dream-status').textContent, /存储空间不足/);
    assert.equal(vm.runInContext('dreamPreviewRecordId', c), '');
});

test('an IndexedDB failure keeps the dream text and explains that only the image was lost', async () => {
    const { context: c, idb, elements } = setup();
    idb.failures.write = new Error('disk full');
    await c.generateDreamRecord();
    const [record] = c.getDreamRecords();
    assert.ok(record);
    assert.equal(record.imageKey, '');
    assert.match(record.imageError, /梦境图未能保存到本机/);
    assert.equal(elements.get('dream-status').dataset.tone, '');
});

test('legacy inline images are migrated on open and a failed migration keeps them inline', async () => {
    const { context: c, store, images, idb } = setup();
    const inline = 'data:image/png;base64,' + 'D'.repeat(1000);
    store.set(recordsKey, JSON.stringify([{ ...payload, id: 'old', charId: 'writer', imageUrl: inline, avatar: 'data:image/png;base64,AVATAR' }]));
    idb.failures.write = new Error('locked');
    c.initDreamApp();
    await settle();
    assert.equal(c.getDreamRecords()[0].imageUrl, inline, 'a failed move never strips the picture');
    assert.equal(images().size, 0);
    idb.failures.write = null;
    c.initDreamApp();
    await settle();
    const [record] = c.getDreamRecords();
    assert.equal(record.imageUrl, undefined);
    assert.equal(record.avatar, undefined);
    assert.equal(images().get(record.imageKey), inline);
    assert.equal(await c.resolveDreamRecordImage(record), inline);
});

test('deleting a dream and trimming the archive also remove their stored images', async () => {
    const { context: c, images, store } = setup();
    await c.generateDreamRecord();
    const [record] = c.getDreamRecords();
    c.deleteDreamRecord(record.id);
    await settle();
    assert.equal(c.getDreamRecords().length, 0);
    assert.equal(images().has(record.imageKey), false);
    const many = Array.from({ length: 81 }, (_, index) => ({ ...payload, id: `r${index}`, charId: 'writer', createdAt: index, imageKey: `dream_img_r${index}` }));
    for (const item of many) images().set(item.imageKey, 'data:image/png;base64,X');
    c.saveDreamRecords(many);
    await settle();
    assert.equal(JSON.parse(store.get(recordsKey)).length, 80);
    assert.equal(images().has('dream_img_r80'), false, 'the record beyond the limit loses its image too');
    assert.equal(images().has('dream_img_r0'), true);
});

test('records of removed characters still render with an initial avatar', async () => {
    const { context: c, store, elements } = setup();
    store.set(recordsKey, JSON.stringify([{ ...payload, id: 'gone', charId: 'missing', charName: '远方', createdAt: 1 }]));
    c.renderDreamList();
    assert.match(elements.get('dream-list').innerHTML, /data:image\/svg\+xml,/);
    assert.match(decodeURIComponent(elements.get('dream-list').innerHTML), />远</);
    c.openDreamPreview('gone');
    assert.match(elements.get('dream-preview-content').innerHTML, /data:image\/svg\+xml,/);
});

test('backups include dream images from IndexedDB and imports restore them', async () => {
    const h = addBackupModule(storageHarness({ local: [], entries: { [recordsKey]: JSON.stringify([{ id: 'a', imageKey: 'dream_img_a', title: 't' }]) } }));
    const idb = fakeIndexedDb();
    h.context.indexedDB = idb.indexedDB;
    const seed = await new Promise((resolve, reject) => {
        const req = idb.indexedDB.open('bynd_dream_images_v1', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('images');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    await new Promise(resolve => { const tx = seed.transaction('images', 'readwrite'); tx.objectStore('images').put(bigImage, 'dream_img_a'); tx.oncomplete = resolve; });
    const backup = await h.context.buildByndBackupData();
    assert.deepEqual(JSON.parse(JSON.stringify(backup._dreamImages)), { dream_img_a: bigImage });
    assert.equal(backup._backupWarnings, undefined);
    const target = addBackupModule(storageHarness());
    const targetDb = fakeIndexedDb();
    target.context.indexedDB = targetDb.indexedDB;
    target.context.confirm = () => true;
    target.context.location = { reload() {} };
    await target.context.importAllData({ value: 'file', files: [{ text: async () => JSON.stringify(backup) }] });
    assert.equal(targetDb.read('bynd_dream_images_v1', 'images').get('dream_img_a'), bigImage);
    assert.equal(target.localStorage.getItem(recordsKey), JSON.stringify([{ id: 'a', imageKey: 'dream_img_a', title: 't' }]));
});
