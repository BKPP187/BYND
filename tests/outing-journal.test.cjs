const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function harness() {
    const values = new Map();
    const char = { id: 'a', name: '江闻远', history: [], chatConfig: {} };
    let memories = { chars: {} };
    const events = { replies: 0, requests: 0, clears: 0 };
    const ctx = vm.createContext({
        window: { myCharacters: [char] },
        document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
        localStorage: { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) },
        navigator: { geolocation: { clearWatch() { events.clears++; } } },
        setTimeout, clearTimeout, AbortController, URLSearchParams, console,
        saveCharactersToStorage: async () => true,
        queueWechatAutoReplyToChar() { events.replies++; },
        getWechatMemoryStore: () => JSON.parse(JSON.stringify(memories)),
        getWechatMemoryBucket: (s, id) => s.chars[id] ||= { segments: [], longTerm: [] },
        saveWechatMemoryStore: s => { memories = s; },
        callChatApi: async () => { events.requests++; return { ok: true, content: JSON.stringify({ comment: '这里的阳光很好，想把这一刻留下来。', keepPhoto: true }) }; },
        fetch: async () => ({ ok: true, json: async () => ({ elements: [] }) })
    });
    for (const name of ['outing', 'map', 'journal']) vm.runInContext(fs.readFileSync(path.join(root, `apps/outing/${name}.js`), 'utf8'), ctx);
    vm.runInContext('renderOutingApp = () => {}; renderOutingJournal = () => {}; renderOutingMap = () => {}; renderOutingNearby = () => {};', ctx);
    const trip = { id: 'trip', charId: 'a', charName: char.name, startedAt: Date.now(), entries: [], points: [] };
    ctx.saveOutingState({ active: true, charId: 'a', journey: trip, trips: [] });
    const add = (kind = 'photo') => {
        const s = ctx.getOutingState(); s.journey.entries.push({ id: 'entry', kind, text: kind === 'photo' ? '出门照片' : '咖啡', image: kind === 'photo' ? 'data:image/jpeg;base64,PHOTO' : undefined, createdAt: Date.now() }); ctx.saveOutingState(s);
    };
    return { ctx, values, char, events, add, memory: () => memories, entry: () => ctx.getOutingState().journey.entries[0] };
}
test('photo reaction is genuine, persists to chat and memory, and char alone decides to collect it', async () => {
    const h = harness(); h.add();
    assert.equal(await h.ctx.syncOutingEntry('trip', 'entry'), true);
    assert.equal(h.entry().synced, true);
    assert.equal(h.char.history.length, 2);
    assert.equal(h.char.history[0].isMe, true); assert.equal(h.char.history[1].isMe, false);
    assert.match(h.memory().chars.a.segments[0].content, /阳光很好/);
    assert.equal(h.char.chatConfig.outingPhotos.length, 1);
    assert.equal(h.char.chatConfig.outingPhotos[0].image, h.entry().image);
    assert.equal(h.events.replies, 0, 'photo has one dedicated reply, not another queued chat reply');
    await h.ctx.syncOutingEntry('trip', 'entry');
    assert.equal(h.events.requests, 1); assert.equal(h.char.history.length, 2); assert.equal(h.char.chatConfig.outingPhotos.length, 1);
});
test('failed or rejected chat storage rolls back the unsaved message and is retryable', async () => {
    for (const fail of [async () => false, async () => { throw new Error('disk'); }]) {
        const h = harness(); h.add(); h.ctx.saveCharactersToStorage = fail;
        assert.equal(await h.ctx.syncOutingEntry('trip', 'entry'), false);
        assert.equal(h.char.history.length, 0); assert.equal(h.events.requests, 0); assert.equal(h.entry().synced, undefined);
        assert.ok(h.entry().syncError); assert.ok(h.entry().image);
        h.ctx.saveCharactersToStorage = async () => true;
        assert.equal(await h.ctx.syncOutingEntry('trip', 'entry'), true); assert.equal(h.char.history.length, 2);
    }
});
test('memory quota failure preserves the photo, never claims success, and retry does not duplicate delivery', async () => {
    const h = harness(); h.add(); const save = h.ctx.saveWechatMemoryStore;
    h.ctx.saveWechatMemoryStore = () => { throw new Error('memory quota'); };
    assert.equal(await h.ctx.syncOutingEntry('trip', 'entry'), false);
    assert.equal(h.events.requests, 0); assert.equal(h.char.history.length, 1); assert.match(h.entry().syncError, /quota/);
    h.ctx.saveWechatMemoryStore = save;
    assert.equal(await h.ctx.syncOutingEntry('trip', 'entry'), true); assert.equal(h.char.history.length, 2);
});
test('API failures and malformed output leave a recoverable record without fabricated comments or collection', async () => {
    for (const reply of [{ ok: false, error: 'offline' }, { ok: true, content: 'not json' }, { ok: true, content: '{"comment":"hi","keepPhoto":"true"}' }]) {
        const h = harness(); h.add(); h.ctx.callChatApi = async () => reply;
        assert.equal(await h.ctx.syncOutingEntry('trip', 'entry'), false); assert.equal(h.entry().comment, undefined);
        assert.equal(h.char.chatConfig.outingPhotos, undefined); assert.equal(h.char.history.length, 1);
        assert.ok(h.memory().chars.a.segments.length); assert.ok(h.entry().syncError);
    }
});
test('declining collection writes the comment to memory without putting user photos in BYND album', async () => {
    const h = harness(); h.add(); h.ctx.callChatApi = async () => ({ ok: true, content: '{"comment":"小店不错。","keepPhoto":false}' });
    assert.equal(await h.ctx.syncOutingEntry('trip', 'entry'), true);
    assert.equal(h.char.chatConfig.outingPhotos, undefined); assert.equal(h.values.get('bynd_chat_album_v1'), undefined);
});
test('album save failure preserves the generated reply and retries only collection', async () => {
    const h = harness(); h.add(); let saves = 0;
    h.ctx.saveCharactersToStorage = async () => ++saves !== 3;
    assert.equal(await h.ctx.syncOutingEntry('trip', 'entry'), false);
    assert.equal(h.entry().commentSent, true); assert.equal(h.entry().albumSaved, undefined); assert.equal(h.char.chatConfig.outingPhotos.length, 0);
    assert.equal(await h.ctx.syncOutingEntry('trip', 'entry'), true); assert.equal(h.events.requests, 1); assert.equal(h.char.history.length, 2);
});
test('in-flight comments remain attached to the archived trip and original char after another trip starts', async () => {
    const h = harness(); h.add(); let resolve;
    h.ctx.callChatApi = () => new Promise(r => { resolve = r; });
    const job = h.ctx.syncOutingEntry('trip', 'entry');
    while (!resolve) await new Promise(r => setImmediate(r));
    const state = h.ctx.getOutingState(); state.trips.push(state.journey); state.journey = { id: 'next', charId: 'b', entries: [], points: [] }; state.charId = 'b'; h.ctx.saveOutingState(state);
    resolve({ ok: true, content: '{"comment":"留在这一页。","keepPhoto":true}' });
    assert.equal(await job, true); assert.equal(h.ctx.getOutingState().trips[0].entries[0].comment, '留在这一页。');
    assert.equal(h.ctx.getOutingState().journey.entries.length, 0); assert.equal(h.char.chatConfig.outingPhotos.length, 1);
});
test('nearby locations come from real query results, and empty/error results never invent destinations', async () => {
    const h = harness(); const state = h.ctx.getOutingState(); state.currentPoint = { lat: 31.23, lng: 121.47 }; h.ctx.saveOutingState(state);
    let body;
    h.ctx.fetch = async (url, args) => { body = args.body.get('data'); return { ok: true, json: async () => ({ elements: [{ id: 1, type: 'node', lat: 31.231, lon: 121.47, tags: { name: '真实咖啡', amenity: 'cafe' } }, { id: 2, type: 'way', center: { lat: 31.232, lon: 121.47 }, tags: { name: '小公园', leisure: 'park' } }] }) }; };
    await h.ctx.loadOutingNearby(true);
    assert.match(body, /around:1500,31.23,121.47/); assert.equal(h.ctx.getOutingState().nearby.places.length, 2);
    assert.match(h.char.history[0].content, /真实咖啡/); assert.match(h.char.history[0].content, /不是已经到访/);
    h.ctx.fetch = async () => ({ ok: false, status: 503 }); await h.ctx.loadOutingNearby(true);
    assert.match(vm.runInContext('outingNearbyError', h.ctx), /503/); assert.equal(h.ctx.getOutingState().nearby.places.length, 2);
});
test('invalid GPS and corrupt saved state cannot overwrite existing records', () => {
    const h = harness(); const before = h.values.get('bynd_outing_date_state_v1');
    h.ctx.handleOutingPosition({ coords: { latitude: NaN, longitude: 0 } }); assert.equal(h.values.get('bynd_outing_date_state_v1'), before);
    h.values.set('bynd_outing_date_state_v1', 'broken'); assert.throws(() => h.ctx.getOutingState(), /无法读取/); assert.equal(h.values.get('bynd_outing_date_state_v1'), 'broken');
});
test('collected photos survive replacement of generated phone snapshots and cannot be regenerated', async () => {
    const h = harness(); h.add(); await h.ctx.syncOutingEntry('trip', 'entry');
    Object.assign(h.ctx, { wcEscapeHtml: String, wcEscapeAttr: String });
    vm.runInContext(fs.readFileSync(path.join(root, 'apps/char-phone/photos.js'), 'utf8'), h.ctx);
    h.char.chatConfig.aiPhoneSnapshot = { appData: { album: { items: [{ title: 'generated' }] } } };
    assert.equal(h.ctx.getCharPhoneAlbumItems(h.char).length, 2);
    assert.match(h.ctx.renderCharPhonePhotoDetail(h.ctx.getCharPhoneAlbumItems(h.char)[0], 0, h.char), /真实照片/);
    h.ctx.window._wechatAiPhoneOpenCharId = 'a'; assert.equal(await h.ctx.generateCharPhonePhoto(0), false);
});
test('outing state stays included in the full backup allowlist', () => {
    assert.match(fs.readFileSync(path.join(root, 'core/storage/backup.js'), 'utf8'), /'bynd_outing_date_state_v1'/);
});
test('collected real photos persist in the full character database and backup, keeping the local index small', async () => {
    const { storageHarness, addBackupModule, clone } = require('./helpers/harness.cjs');
    const h = addBackupModule(storageHarness({ local: [] }));
    await h.context.loadCharactersFromStorage();
    const image = 'data:image/jpeg;base64,' + 'P'.repeat(2500000);
    const photo = { outingEntryId: 'trip-photo', image, title: '一起出门', body: '留在这一页' };
    h.context.window.myCharacters = [{ id: 'a', name: '同行角色', history: [], chatConfig: { outingPhotos: [photo] } }];
    const state = { trips: [{ id: 'trip', entries: [{ id: 'trip-photo', image, comment: photo.body }] }] };
    h.localStorage.setItem('bynd_outing_date_state_v1', JSON.stringify(state));
    assert.equal(await h.context.saveCharactersToStorage(), true);
    assert.equal(JSON.parse(h.localStorage.getItem('my_characters_data'))[0].chatConfig.outingPhotos, undefined);
    const backup = await h.context.buildByndBackupData();
    assert.deepEqual(clone(backup.my_characters_data[0].chatConfig.outingPhotos), [photo]);
    assert.deepEqual(clone(backup.bynd_outing_date_state_v1), state);
    const loaded = storageHarness({ local: JSON.parse(h.localStorage.getItem('my_characters_data')), meta: JSON.parse(h.localStorage.getItem('my_characters_data_meta')), record: h.state.record });
    await loaded.context.loadCharactersFromStorage();
    assert.equal(loaded.context.window.myCharacters[0].chatConfig.outingPhotos[0].image, image);
});
