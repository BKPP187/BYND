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
    for (const name of ['data/catalogs', 'characters', 'state', 'bridge', 'furniture', 'rooms', 'living', 'animation', 'build']) vm.runInContext(fs.readFileSync(path.join(root, 'apps/home3d', name + '.js'), 'utf8'), context);
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

test('kitchen and dining actions use reachable facilities and retain explicit local provenance', () => {
    const { H } = harness(), home = H.State.home(), context = { personality: '', history: [], events: [] }, actions = new Set();
    for (let minute = 0; minute < 60; minute += 2) {
        const activity = H.Living.plan(home, context, new Date(2026, 9, 4, 12, minute).getTime());
        if (!['Cook', 'Eat'].includes(activity.action)) continue;
        actions.add(activity.action); assert.equal(activity.source, 'local');
        assert.equal(activity.room, activity.action === 'Cook' ? 'kitchen' : 'dining_room');
        assert.ok(H.Living.usable(home, activity));
    }
    assert.deepEqual([...actions].sort(), ['Cook', 'Eat']);
});

test('computer interactions use their supporting desk and tables require a real facing chair', () => {
    const { H } = harness(), rowsFor = id => H.Rooms.placements(H.Rooms.get(id), H.State.home()).map(placement => ({ placement, item: H.Furniture.get(placement.furnitureId) }));
    const game = rowsFor('game_room'), computer = game.find(r => r.item.type === 'computer'), desk = H.Rooms.useRow(game, computer, 'Game');
    assert.equal(desk.item.type, 'desk');
    const gamer = H.Rooms.anchorInRoom(game, desk, 'Game', 'char'); assert.ok(gamer?.seated && gamer.seatId);
    assert.equal(H.Rooms.anchorInRoom(game.filter(r => r.item.type !== 'chair'), desk, 'Game', 'char'), null);
    assert.equal(H.Rooms.useRow(game.filter(r => r.item.type !== 'desk'), computer, 'Game'), undefined);
    const dining = rowsFor('dining_room'), table = dining.find(r => r.item.variant === 'dining');
    const a = H.Rooms.anchorInRoom(dining, table, 'Eat', 'char'), b = H.Rooms.anchorInRoom(dining, table, 'Eat', 'user');
    assert.ok(a?.seated && b?.seated); assert.notEqual(a.seatId, b.seatId);
    assert.equal(a.y, .62); assert.equal(b.y, .62);
    assert.equal(H.Rooms.anchorInRoom(dining.filter(r => r.item.type !== 'chair'), table, 'Eat', 'char'), null);
    const saved = { ...H.State.home(), layouts: { game_room: { items: { tv: { id: 'tv', furnitureId: 'tv_01', position: [-2, .75, 0], rotation: Math.PI / 2 } }, removed: [] } } };
    assert.ok(H.Rooms.placements(H.Rooms.get('game_room'), saved).some(r => r.id === 'tv'), 'saved custom furniture remains');
    assert.ok(!game.some(r => r.item.type === 'television'), 'fresh game room uses the desktop');
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

test('walking clearance covers both avatar widths and every swept segment at furniture corners', () => {
    const { H } = harness(), obstacles = [{ x: 0, z: 0, width: 1.5, depth: 1.5 }], size = [6.6, 5.6];
    for (const radius of [.38, .52]) {
        const start = { x: -2, z: -.07 }, end = { x: 2, z: .09 };
        const route = [start, ...H.Animation.path(start, end, obstacles, size, radius)];
        assert.ok(route.length > 2);
        for (let i = 1; i < route.length; i++) {
            const a = route[i - 1], b = route[i];
            for (let step = 0; step <= 20; step++) {
                const p = { x: a.x + (b.x - a.x) * step / 20, z: a.z + (b.z - a.z) * step / 20 };
                assert.ok(Math.abs(p.x) >= .75 + radius || Math.abs(p.z) >= .75 + radius, 'avatar hull must not overlap furniture');
            }
        }
        assert.equal(H.Animation.path(start, { x: .8, z: 0 }, obstacles, size, radius).length, 0);
        assert.equal(H.Animation.segmentClear({ x: -1.5, z: .8 }, { x: .8, z: -1.5 }, obstacles, size, radius), false);
    }
    // A corridor that fits the male hull can be too narrow for the skirt/hair hull.
    const narrow = [{ x: -1.9, z: 0, width: 3, depth: 5.6 }, { x: 1.9, z: 0, width: 3, depth: 5.6 }];
    assert.equal(H.Animation.clear({ x: 0, z: 0 }, narrow, size, .38), true);
    assert.equal(H.Animation.clear({ x: 0, z: 0 }, narrow, size, .52), false);
});
test('all room geometry is local, licensed, self-contained GLB with canonical catalog mirrors', () => {
    const { H } = harness();
    const canonical = Object.fromEntries(['furniture-catalog', 'room-catalog', 'material-presets'].map(name => [name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), JSON.parse(fs.readFileSync(path.join(root, 'apps/home3d/data', name + '.json'), 'utf8'))]));
    assert.deepEqual(JSON.parse(JSON.stringify(H.catalogs)), canonical);
    assert.equal(H.catalogs.roomCatalog.rooms.filter(room => room.open).length, 5);
    assert.equal(H.catalogs.roomCatalog.rooms.length, 10);
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

function emptyRoom(H, id = 'living_room') {
    H.State.withHome(home => { home.layouts[id] = { items: {}, removed: H.Rooms.get(id).furniture.map(p => p.id) }; });
}
const placement = (id, furnitureId, x = 0, z = -1, rotation = 0) => ({ id, furnitureId, position: [x, 0, z], rotation });

test('five complete furniture series share functional definitions but have independent visuals', () => {
    const { H } = harness();
    for (const type of ['bed', 'sofa', 'desk', 'chair', 'table', 'lamp', 'cabinet', 'plant', 'piano', 'stove', 'tub']) {
        const variants = ['cream', 'european', 'japanese', 'modern', 'chinese'].map(style => H.Furniture.get(style + '_' + type));
        assert.equal(variants.length, 5);
        for (const item of variants) {
            assert.ok(item.procedural);
            assert.deepEqual(item.actions, H.catalogs.furnitureCatalog.types[type].actions);
            assert.deepEqual(item.positions, H.catalogs.furnitureCatalog.types[type].positions);
        }
    }
});

test('free placements persist rotation, can move and delete, and remain per-character', () => {
    const { H } = harness(); emptyRoom(H);
    H.Build.commit('living_room', placement('placed_bed', 'japanese_bed'));
    H.Build.commit('living_room', placement('placed_bed', 'japanese_bed', -.7, 0, Math.PI / 2));
    const saved = H.Rooms.placements(H.Rooms.get('living_room'), H.State.home());
    assert.equal(saved.length, 1); assert.equal(saved[0].rotation, Math.PI / 2);
    H.State.bind('b'); assert.equal(H.State.home().layouts.living_room, undefined);
    H.State.bind('a'); H.Build.remove('living_room', 'placed_bed');
    assert.equal(H.Rooms.placements(H.Rooms.get('living_room'), H.State.home()).length, 0);
});

test('collision, rotated footprints, invalid IDs and blocked approaches reject before saving', () => {
    const { H, localStorage } = harness(); emptyRoom(H);
    H.Build.commit('living_room', placement('bed', 'cream_bed'));
    const before = localStorage.getItem(H.State.key);
    for (const draft of [placement('bad', 'cream_bed'), placement('bad', 'cream_bed', 2.5, 1, Math.PI / 2), placement('__proto__', 'cream_plant', 2, 1), { ...placement('bad', 'cream_plant'), position: [NaN, 0, 0] }]) assert.throws(() => H.Build.commit('living_room', draft));
    assert.equal(localStorage.getItem(H.State.key), before);
});

test('moving original furniture preserves supported items and a quota failure keeps the preview unsaved', () => {
    const { H, localStorage } = harness();
    // Remove everything except the TV and its cabinet, to isolate support semantics.
    H.State.withHome(home => { home.layouts.living_room = { items: {}, removed: H.Rooms.get('living_room').furniture.filter(p => !['tv', 'tv-cabinet'].includes(p.id)).map(p => p.id) }; });
    H.Build.commit('living_room', placement('tv-cabinet', 'tv_cabinet_01', 0, -1));
    const rows = H.Rooms.placements(H.Rooms.get('living_room'), H.State.home());
    const tv = rows.find(p => p.id === 'tv'); assert.equal(tv.position[0], 0); assert.equal(tv.position[2], -1);
    const before = localStorage.getItem(H.State.key); localStorage.setItem = () => { throw Error('quota'); };
    assert.throws(() => H.Build.commit('living_room', placement('placed_plant', 'cream_plant', 2, 1)), /没有保存成功/);
    assert.equal(localStorage.getItem(H.State.key), before);
});

test('expansion enables real rooms and living facilities only for that character', () => {
    const { H } = harness();
    assert.equal(H.Rooms.available(H.Rooms.get('bathroom'), H.State.home()), false);
    H.Build.expand('bathroom');
    assert.equal(H.Rooms.available(H.Rooms.get('bathroom'), H.State.home()), true);
    const activities = Array.from({ length: 12 }, (_, minute) => H.Living.plan(H.State.home(), { history: [], personality: '', events: [] }, new Date(2026, 8, 27, 21, minute * 2).getTime()));
    const bath = activities.find(p => p.action === 'Bathe');
    assert.ok(bath, 'an available tub enables autonomous bathing during the evening'); assert.equal(bath.room, 'bathroom');
    H.State.bind('b'); assert.equal(H.Rooms.available(H.Rooms.get('bathroom'), H.State.home()), false);
});

test('plans use installed furniture and invalidated AI plans cannot use a removed bed or desk', () => {
    const { H } = harness(), night = new Date(2026, 8, 27, 1).getTime();
    H.Build.remove('bedroom', 'bed');
    H.State.withHome(home => { home.activity = { action: 'Sleep', room: 'bedroom', target: 'bed', until: night + 600000 }; });
    const next = H.Living.plan(H.State.home(), { history: [], events: [] }, night);
    assert.notEqual(next.action, 'Sleep'); assert.ok(H.Living.usable(H.State.home(), next));
    H.Build.remove('game_room', 'desk');
    assert.throws(() => H.Living.validateDecision({ action: 'Work', room: 'game_room', target: 'desk' }));
    emptyRoom(H); H.Build.commit('living_room', placement('mydesk', 'chinese_desk'));
    const work = H.Living.plan(H.State.home(), { history: [], events: ['学习工作'], personality: '' }, new Date(2026, 8, 27, 10).getTime());
    assert.equal(work.action, 'Work'); assert.equal(work.target, 'mydesk'); assert.equal(work.room, 'living_room');
});

test('offline catch-up is bounded, idempotent, atomic and distinguished from shared interactions', () => {
    const { H, localStorage } = harness(), now = new Date(2026, 8, 27, 18).getTime();
    H.State.withHome(home => { home.lastLifeAt = now - 3 * 86400000; home.activity = null; });
    H.Living.advance({ history: [], events: [], personality: '喜欢阅读' }, now);
    const home = H.State.home(); assert.ok(home.moments.length > 0 && home.moments.length <= 48);
    assert.ok(home.moments.every(row => row.source === 'simulation' && row.at >= now - 86400000 && row.at <= now));
    H.Living.advance({ history: [], events: [], personality: '喜欢阅读' }, now + 1000);
    assert.equal(H.State.home().moments.length, home.moments.length);
    const before = localStorage.getItem(H.State.key); localStorage.setItem = () => { throw Error('quota'); };
    assert.throws(() => H.Living.advance({ history: [], events: [] }, now + 900000), /没有保存成功/);
    assert.equal(localStorage.getItem(H.State.key), before);
});

test('invalid imported layouts never overwrite storage and private home context stays scoped', () => {
    const { H, localStorage } = harness(); H.State.moment('Read', '只有A知道的日子');
    assert.match(H.Living.prompt({ id: 'a' }), /只有A知道/); assert.equal(H.Living.prompt({ id: 'b' }), '');
    const data = H.State.load(); data.homes.a.layouts.living_room = { removed: [], items: { broken: { id: 'broken', furnitureId: 'unknown', position: [0, 0, 0], rotation: 0 } } };
    const raw = JSON.stringify(data); localStorage.setItem(H.State.key, raw);
    assert.throws(() => H.State.visit(), /家具存档/); assert.equal(localStorage.getItem(H.State.key), raw);
});

test('the navigation grid includes the narrow corridor at the right edge of the initial room', () => {
    const { H } = harness(), home = H.State.home(), room = H.Rooms.get('living_room');
    const layout = H.Rooms.placements(room, home), sofa = layout.find(p => p.id === 'sofa');
    const obstacles = layout.filter(p => p.position[1] < .2 && !['frame', 'prop', 'keepsake'].includes(H.Furniture.get(p.furnitureId).type)).map(H.Build.extent);
    const end = H.Animation.approach({ x: 2.9, z: 2.4 }, sofa, obstacles, room.size);
    assert.ok(end, 'the default sofa must be reachable');
    const route = H.Animation.path({ x: 2.9, z: 2.3 }, { x: 2.9, z: -2.3 }, [{ x: -.2, z: 0, width: 5.4, depth: 3.2 }], room.size);
    assert.ok(route.length && route.some(point => point.x > 2.68), 'route uses the edge corridor');
    assert.ok(route.every(p => Math.abs(p.x) <= 3.05 && Math.abs(p.z) <= 2.55));
});

test('a delayed AI plan cannot restore furniture removed while its request was pending', async () => {
    const { H, context } = harness(); let reply;
    context.callChatApi = () => new Promise(resolve => { reply = resolve; });
    const pending = H.Living.decide(); H.Build.remove('living_room', 'sofa');
    const before = JSON.stringify(H.State.home());
    reply({ ok: true, content: '{"action":"Read","room":"living_room","target":"sofa","reason":"看书"}' });
    await assert.rejects(pending, /家具/); assert.equal(JSON.stringify(H.State.home()), before);
});

 test('wide avatars can reach the sofa through a clear corridor narrower than the old grid',()=>{
    const {H}=harness(),size=[6.6,5.6],radius=.52;
    const obstacles=[{x:0,z:-1.55,width:2.7,depth:1.16},{x:0,z:.52,width:1.35,depth:.65}];
    const start={x:1.8,z:1.8},end={x:0,z:-.38},route=H.Animation.path(start,end,obstacles,size,radius);
    assert.ok(route.length>0);let previous=start;
    for(const point of route){assert.ok(H.Animation.segmentClear(previous,point,obstacles,size,radius));previous=point;}
    assert.equal(H.Animation.path({x:0,z:.52},end,obstacles,size,radius).length,0,'blocked starting positions have no exemption');
 });
