'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { memoryStorage } = require('./helpers/harness.cjs');
const root = path.resolve(__dirname, '..');
function harness(extra = {}) {
    const localStorage = memoryStorage();
    const window = { ByndHome3D: {}, myCharacters: [{ id: 'a', name: 'A', history: [], chatConfig: {} }, { id: 'b', name: 'B', history: [], chatConfig: {} }] };
    const context = vm.createContext({ window, localStorage, Date, console, performance, ...extra });
    for (const name of ['data/catalogs', 'characters', 'state', 'bridge', 'furniture', 'rooms', 'living', 'animation']) vm.runInContext(fs.readFileSync(path.join(root, 'apps/home3d', name + '.js'), 'utf8'), context);
    const H = window.ByndHome3D;
    H.State.bind('a', { avatar: H.Characters.defaultProfile('user') });
    return { H, localStorage, context, window };
}
test('home save failures are atomic and leave the durable home unchanged', () => {
    const { H, localStorage } = harness();
    const before = localStorage.getItem(H.State.key);
    localStorage.setItem = () => { throw new Error('quota'); };
    assert.throws(() => H.State.moment('Hug', 'a memory'), /没有保存成功/);
    assert.equal(localStorage.getItem(H.State.key), before);
    assert.equal(H.State.home().moments.length, 0);
});
test('corrupt or future imported saves are preserved and never overwritten', () => {
    const { H, localStorage } = harness();
    for (const raw of ['{broken', '{"version":2,"homes":{}}']) {
        localStorage.setItem(H.State.key, raw);
        assert.throws(() => H.State.bind('b'), /存档/);
        assert.equal(localStorage.getItem(H.State.key), raw);
    }
});
test('binding another character keeps separate rooms, photographs and memories', () => {
    const { H } = harness();
    H.State.keepMemory({ id: 'm1', title: '第一次见面', content: '一起看雨' });
    H.State.withHome(home => { home.room = 'bedroom'; home.photo = { url: 'data:image/jpeg;base64,AA' }; });
    H.State.bind('b');
    assert.equal(H.State.home().keepsakes.length, 0);
    assert.equal(H.State.home().room, 'living_room');
    H.State.bind('a');
    assert.equal(H.State.home().keepsakes.length, 1);
    assert.equal(H.State.home().room, 'bedroom');
    assert.ok(H.State.home().photo.url);
    H.State.keepMemory({ id: 'm1', content: '重复记忆' });
    assert.equal(H.State.home().keepsakes.length, 1);
});
test('night, fatigue, personality and Living World produce compatible furniture actions', () => {
    const { H } = harness();
    const ctx = { personality: '', history: [], phone: {}, events: [] }, home = H.State.home();
    assert.equal(H.Living.plan(home, ctx, new Date(2026, 8, 27, 2).getTime()).action, 'Sleep');
    const noon = new Date(2026, 8, 27, 12, 16).getTime();
    assert.equal(H.Living.plan(home, { ...ctx, history: [{ isMe: true, text: '加班好累', at: noon }] }, noon).action, 'Lie');
    assert.equal(H.Living.plan(home, { ...ctx, events: [{ text: '今天有会议' }] }, noon).action, 'Work');
    assert.equal(H.Living.plan(home, { ...ctx, personality: '喜欢游戏' }, noon).action, 'Game');
    for (let hour = 0; hour < 24; hour++) {
        const decision = H.Living.plan(home, ctx, new Date(2026, 8, 27, hour, 16).getTime());
        assert.doesNotThrow(() => H.Living.validateDecision(decision));
    }
});
test('AI cannot choose unknown models, locked rooms, impossible interactions or occupied slots', () => {
    const { H } = harness();
    for (const raw of [
        { room: 'kitchen', target: 'sofa', action: 'Sit' },
        { room: 'living_room', target: 'plant', action: 'Sleep' },
        { room: 'living_room', target: 'sofa', action: 'Sit', placement: { furnitureId: 'unknown', slot: 'window_side' } },
        { room: 'living_room', target: 'sofa', action: 'Sit', placement: { furnitureId: 'plant_01', slot: 'window_side' } }
    ]) assert.throws(() => H.Living.validateDecision(raw));
});
test('a recent character-generated phone activity overrides a stale home plan immediately', () => {
    const { H } = harness(), now = new Date(2026, 8, 27, 16, 8).getTime();
    const home = H.State.home(); home.activity = { action: 'Read', room: 'living_room', target: 'sofa', until: now + 600000 };
    const ctx = { personality: '', history: [], events: [], phone: { updatedAt: now - 1000, usageRecords: [{ title: '游戏', detail: '此刻正在和朋友开黑', meta: '8分钟' }] } };
    const plan = H.Living.plan(home, ctx, now);
    assert.equal(plan.action, 'Game'); assert.equal(plan.room, 'game_room');
    home.activity = plan;
    assert.equal(H.Living.plan(home, ctx, now + 1000), plan, 'same phone snapshot keeps the current plan stable');
});
test('historical screen-time totals and user viewing do not invent current character actions', () => {
    const { H } = harness(), now = new Date(2026, 8, 27, 16, 8).getTime();
    const home = H.State.home(); home.activity = { action: 'Read', room: 'living_room', target: 'sofa', until: now + 600000 };
    const ctx = { personality: '', history: [], events: [], phone: { updatedAt: now, usageRecords: [{ title: '游戏', detail: '今日累计使用', meta: '60分钟' }] }, viewing: { app: 'games', at: now } };
    assert.equal(H.Living.plan(home, ctx, now), home.activity);
    ctx.phone.usageRecords = [{ title: '游戏', detail: '正在玩', timestamp: now - 3600000 }];
    assert.equal(H.Living.plan(home, ctx, now), home.activity);
});
test('API failures and malformed decisions preserve the old activity and furniture', async () => {
    for (const response of [{ ok: false, error: 'HTTP 429' }, { ok: true, content: 'not json' }, { ok: true, content: '{"action":"Sleep","room":"living_room","target":"plant"}' }]) {
        const { H, context } = harness();
        const before = JSON.stringify(H.State.home());
        context.callChatApi = async () => response;
        await assert.rejects(H.Living.decide());
        assert.equal(JSON.stringify(H.State.home()), before);
    }
});
test('429 without Retry-After stops all home requests until the fallback cooldown expires', async () => {
    let now = Date.now(), calls = 0;
    class Clock extends Date { static now() { return now; } }
    const { H, context } = harness({ Date: Clock });
    const before = JSON.stringify(H.State.load());
    context.callChatApi = async (_, options) => { calls++; assert.equal(options.respectRateLimitPause, true); return { ok: false, httpStatus: 429, rateLimited: true, error: 'rate limit exceeded' }; };
    await assert.rejects(H.Bridge.inferAvatar('reference'), error => error.rateLimited && error.retryAfterMs === 60000 && !error.deferred);
    await assert.rejects(H.Living.decide(), error => error.deferred && error.retryAfterMs === 60000);
    now += 59999;
    await assert.rejects(H.Bridge.inferAvatar('reference'), error => error.retryAfterMs === 1);
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(H.State.load()), before);
    now++;
    context.callChatApi = async () => { calls++; return { ok: true, content: JSON.stringify(H.Characters.defaultProfile('user')) }; };
    await H.Bridge.inferAvatar('reference');
    assert.equal(calls, 2);
});
test('home honors Retry-After and shared pauses without blocking a different provider', async () => {
    let now = Date.now(), shared = 0, calls = 0;
    class Clock extends Date { static now() { return now; } }
    const api = { baseUrl: 'https://example.invalid', model: 'vision', apiKey: 'fixture' };
    const { H, context } = harness({ Date: Clock, getDefaultApi: () => api, getChatApiRateLimitPauseRemainingMs: () => shared, setChatApiRateLimitPause: ms => { assert.equal(ms, 123000); } });
    context.callChatApi = async () => { calls++; return { ok: false, rateLimited: true, retryAfterMs: 123000 }; };
    await assert.rejects(H.Bridge.inferAvatar('reference'), error => error.retryAfterMs === 123000);
    now += 60000;
    assert.equal(H.Bridge.cooldownRemaining(), 63000);
    api.model = 'other-vision';
    assert.equal(H.Bridge.cooldownRemaining(), 0);
    shared = 8000;
    await assert.rejects(H.Living.decide(), error => error.deferred && error.retryAfterMs === 8000);
    assert.equal(calls, 1);
});
test('quota failures retain their cause and do not pretend a timed retry will resolve them', async () => {
    const { H, context } = harness();
    context.callChatApi = async () => ({ ok: false, httpStatus: 429, quotaExceeded: true, error: 'API 额度不足 (429)' });
    await assert.rejects(H.Bridge.inferAvatar('reference'), error => error.quotaExceeded && /额度不足/.test(error.message));
    assert.equal(H.Bridge.cooldownRemaining(), 0);
});
test('in-flight home requests reject duplicates and release the lock after transport failure', async () => {
    const { H, context } = harness();
    let reject, calls = 0;
    context.callChatApi = () => { calls++; return new Promise((_, fail) => { reject = fail; }); };
    const pending = H.Bridge.inferAvatar('reference');
    assert.equal(H.Bridge.requestBusy(), true);
    await assert.rejects(H.Living.decide(), error => error.deferred);
    assert.equal(calls, 1);
    reject(new Error('network failed'));
    await assert.rejects(pending, /network failed/);
    assert.equal(H.Bridge.requestBusy(), false);
    context.callChatApi = async () => ({ ok: true, content: JSON.stringify(H.Characters.defaultProfile('user')) });
    await H.Bridge.inferAvatar('reference');
});
test('a delayed decision cannot be written to a different character', async () => {
    const { H, context } = harness();
    let reply;
    context.callChatApi = () => new Promise(resolve => { reply = resolve; });
    const pending = H.Living.decide(); H.State.bind('b');
    reply({ ok: true, content: '{"action":"Read","room":"living_room","target":"sofa","reason":"读一会儿"}' });
    await assert.rejects(pending, /已切换/);
    assert.equal(H.State.home().activity, null);
    H.State.bind('a'); assert.equal(H.State.home().activity, null);
});
test('reference-based avatar parsing rejects invalid parameters and failed visual APIs', async () => {
    const { H, context } = harness();
    context.callChatApi = async () => ({ ok: false, error: 'vision unavailable' });
    await assert.rejects(H.Bridge.inferAvatar('data:image/png;base64,AA'), /vision unavailable/);
    context.callChatApi = async () => ({ ok: true, content: '{"hairStyle":"long","hair":"#112233"}' });
    await assert.rejects(H.Bridge.inferAvatar('data:image/png;base64,AA'), /缺少/);
    const profile = H.Characters.defaultProfile('user');
    context.callChatApi = async () => ({ ok: true, content: JSON.stringify(profile) });
    assert.deepEqual(JSON.parse(JSON.stringify(await H.Bridge.inferAvatar('data:image/png;base64,AA'))), JSON.parse(JSON.stringify(profile)));
});
test('avatar replies accept explanation, fences and wrappers while retaining strict field validation', async () => {
    const { H, context } = harness();
    const profile = H.Characters.defaultProfile('user'), json = JSON.stringify(profile);
    for (const content of [json, ' \n```JSON\n' + json + '\n``` ', '下面是参考图提取结果：\n```json\n' + json + '\n```\n请查看。', JSON.stringify({ profile, description: 'brace { and escaped quote " are data' }), '<think>' + JSON.stringify({ ...profile, hair: '#112233' }) + '</think>\n' + json]) {
        context.callChatApi = async (_, options) => {
            assert.ok(options.max_tokens >= 2000);
            assert.equal(options.skipLengthContinuation, true);
            assert.equal(options.skipEmptyLengthRetry, true);
            return { ok: true, content };
        };
        assert.equal(JSON.stringify(await H.Bridge.inferAvatar('reference')), json);
    }
    assert.throws(() => H.Bridge.parseAvatarResponse('说明\n' + json.slice(0, -1), 'length'), /截断/);
    assert.throws(() => H.Bridge.parseAvatarResponse(JSON.stringify({ ...profile, hair: 'white' })), /有效/);
    assert.throws(() => H.Bridge.parseAvatarResponse(json + '\n' + JSON.stringify({ ...profile, hair: '#112233' })), /多个不同/);
    assert.throws(() => H.Bridge.parseAvatarResponse('人物有白头发，我无法输出JSON'), /支持看图/);
});
test('navigation avoids furniture and rejects enclosed destinations', () => {
    const { H } = harness();
    const obstacles = [{ x: 0, z: 0, width: 1.5, depth: 1.5 }];
    const route = H.Animation.path({ x: -2, z: 0 }, { x: 2, z: 0 }, obstacles);
    assert.ok(route.length);
    for (const p of route) assert.ok(Math.abs(p.x) >= .93 || Math.abs(p.z) >= .93);
    assert.equal(H.Animation.path({ x: -2, z: -2 }, { x: 0, z: 0 }, [{ x: 0, z: 0, width: 4, depth: 4 }]).length, 0);
});
test('all room geometry is local, licensed, self-contained GLB with canonical catalog mirrors', () => {
    const { H } = harness();
    const canonical = Object.fromEntries(['furniture-catalog', 'room-catalog', 'material-presets'].map(name => [name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), JSON.parse(fs.readFileSync(path.join(root, 'apps/home3d/data', name + '.json'), 'utf8'))]));
    assert.deepEqual(JSON.parse(JSON.stringify(H.catalogs)), canonical);
    assert.equal(H.catalogs.roomCatalog.rooms.filter(room => room.open).length, 3);
    assert.equal(H.catalogs.roomCatalog.rooms.length, 9);
    for (const item of H.catalogs.furnitureCatalog.items) {
        const license = H.catalogs.furnitureCatalog.sources[item.source];
        assert.ok(license?.commercialUse && license?.modificationAllowed);
        if (!item.model) continue;
        const bytes = fs.readFileSync(path.join(root, 'assets/home3d/furniture', item.model));
        let registered;
        vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/home3d/furniture', item.model + '.js'), 'utf8'), { window: { ByndHome3D: { Furniture: { registerBuffer(model, encoded) { assert.equal(model, item.model); registered = Buffer.from(encoded, 'base64'); } } } } });
        assert.deepEqual(registered, bytes, 'file:// resources preserve the exact reviewed GLB bytes');
        assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
        assert.equal(bytes.readUInt32LE(8), bytes.length);
        const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
        assert.ok(!json.buffers.some(buffer => buffer.uri), 'no missing external buffers');
    }
});
