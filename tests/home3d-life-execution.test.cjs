'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { memoryStorage } = require('./helpers/harness.cjs');
function harness() {
    let time = new Date(2026, 9, 12, 13, 0).getTime();
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [time])); } static now() { return time; } }
    const storage = memoryStorage(), window = { ByndHome3D: { session: 1 }, myCharacters: [{ id: 'a', name: 'A', history: [] }, { id: 'b', name: 'B', history: [] }] };
    const context = vm.createContext({ window, localStorage: storage, Date: Clock, console, performance });
    for (const name of ['data/catalogs', 'characters', 'state', 'bridge', 'furniture', 'rooms', 'animation', 'build', 'life-context', 'living', 'actions', 'interactions']) vm.runInContext(fs.readFileSync(path.resolve('apps/home3d', name + '.js'), 'utf8'), context);
    const H = window.ByndHome3D; H.State.bind('a');
    return { H, storage, window, context, now: () => time, advance: ms => time += ms, plain: x => JSON.parse(JSON.stringify(x)), ctx: () => ({ charId: 'a', personality: '', events: [], history: [] }) };
}
const read = { room: 'living_room', target: 'sofa', action: 'Read', source: 'local' };
test('queued and walking intentions are not actual furniture use; arrival is recorded exactly once', () => {
    const { H } = harness(), token = H.Actions.begin('char', read);
    assert.equal(H.State.home().moments.length, 0);
    assert.equal(H.Actions.transition(token, 'walking'), true);
    assert.equal(H.State.home().objectState, undefined);
    assert.equal(H.Actions.transition(token, 'acting'), true);
    assert.equal(H.Actions.transition(token, 'acting'), false);
    assert.equal(H.State.home().objectState['living_room:sofa'].uses, 1);
    assert.equal(H.State.home().moments.length, 1);
    H.Actions.end('char', 'finished'); assert.equal(H.Actions.transition(token, 'acting'), false);
    assert.equal(H.State.home().executions.char.phase, 'finished');
});
test('replacement, cancellation, role switch and session switch invalidate stale arrivals', () => {
    for (const mode of ['replace', 'cancel', 'role', 'session']) {
        const { H } = harness(), old = H.Actions.begin('char', read); H.Actions.transition(old, 'walking');
        if (mode === 'replace') H.Actions.begin('char', { ...read, action: 'Sit' });
        if (mode === 'cancel') H.Actions.end('char');
        if (mode === 'role') H.State.bind('b');
        if (mode === 'session') H.session++;
        assert.equal(H.Actions.transition(old, 'acting'), false, mode);
        assert.equal(H.State.load().homes.a.moments.length, 0);
        assert.equal(H.State.home().moments.length, 0);
    }
});
test('blocked action never restores needs online; a confirmed action does, including partial intervals', () => {
    const x = harness(), { H } = x;
    H.State.withHome(home => { home.needs = { energy: 50, comfort: 50 }; });
    const token = H.Actions.begin('char', { ...read, action: 'Sleep' }); H.Actions.transition(token, 'walking');
    x.advance(60000); H.Living.advance(x.ctx(), x.now(), true);
    assert.ok(H.State.home().needs.energy < 50);
    H.Actions.transition(token, 'blocked', '没有通道'); x.advance(60000); H.Living.advance(x.ctx(), x.now(), true);
    assert.ok(H.State.home().needs.energy < 49.94); assert.equal(H.State.home().moments.length, 0);
    const next = H.Actions.begin('char', { ...read, action: 'Sleep' }); H.Actions.transition(next, 'walking');
    x.advance(30000); H.Actions.transition(next, 'acting'); const atArrival = H.State.home().needs.energy;
    x.advance(60000); H.Living.advance(x.ctx(), x.now(), true);
    assert.ok(Math.abs(H.State.home().needs.energy - atArrival - .45) < 1e-8);
    H.Actions.end('char'); x.advance(30000); H.Living.advance(x.ctx(), x.now(), true);
    assert.ok(Math.abs(H.State.home().needs.energy - atArrival - .415) < 1e-8);
});
test('failed receipt save retains durable data and does not consume the arrival', () => {
    const { H, storage } = harness(), token = H.Actions.begin('char', read); H.Actions.transition(token, 'walking');
    const before = storage.getItem(H.State.key), set = storage.setItem;
    storage.setItem = () => { throw Error('quota'); };
    assert.throws(() => H.Actions.transition(token, 'acting'), /没有保存成功/);
    assert.equal(storage.getItem(H.State.key), before);
    storage.setItem = set; assert.equal(H.Actions.transition(token, 'acting'), true);
    assert.equal(H.State.home().moments.length, 1);
});
test('restoring the same confirmed pose does not count a second furniture use', () => {
    const { H } = harness(), token = H.Actions.begin('char', read); H.Actions.transition(token, 'acting');
    const restore = H.Actions.begin('char', read, { restore: true }); H.Actions.transition(restore, 'acting');
    assert.equal(H.State.home().objectState['living_room:sofa'].uses, 1);
    for (let i = 0; i < 100; i++) H.Actions.begin('char', read);
    assert.ok(H.State.home().actionReceipts.length <= 80);
});
test('cleanup after closing a session cancels only its owning character record', () => {
    const { H } = harness(); H.Actions.begin('user', read); H.State.bind('b'); H.session++;
    H.Actions.end('user'); assert.equal(H.State.load().homes.a.executions.user.phase, 'cancelled');
    assert.equal(H.State.home().executions, undefined);
});
test('confirmed preferences are per character, affect available hobbies, and preserve ongoing actions', () => {
    const x = harness(), { H } = x, values = H.LifeContext.preferences(H.State.home()); values.Read = 'like'; values.Game = 'avoid';
    H.LifeContext.save(values, 'a');
    assert.equal(H.LifeContext.choose(H.State.home(), 'Game', x.now()).action, 'Read');
    const activity = { ...read, action: 'Sit', until: x.now() + 60000 };
    H.State.withHome(home => { home.activity = activity; });
    assert.equal(H.Living.plan(H.State.home(), x.ctx(), x.now()).action, 'Sit');
    H.State.bind('b'); assert.equal(H.LifeContext.preferences(H.State.home()).Read, 'auto');
    assert.throws(() => H.LifeContext.save(values, 'a'), /已切换/);
});
test('preference hints require confirmation and negative sentences are not assumed likes', () => {
    const { H } = harness();
    const hints = H.LifeContext.suggestions({ personality: '喜欢阅读。讨厌游戏。', worldBook: '热爱园艺；不喜欢做饭' });
    assert.equal(hints.Read, 'like'); assert.equal(hints.Care, 'like'); assert.equal(hints.Game, 'auto'); assert.equal(hints.Cook, 'auto');
    assert.equal(H.LifeContext.preferences(H.State.home()).Read, 'auto');
});
test('preferences save failure is atomic and does not claim confirmation', () => {
    const { H, storage } = harness(), before = storage.getItem(H.State.key);
    storage.setItem = () => { throw Error('quota'); };
    assert.throws(() => H.LifeContext.save(H.LifeContext.preferences(H.State.home()), 'a'), /没有保存成功/);
    assert.equal(storage.getItem(H.State.key), before);
});
test('local inbox is scoped, consumes stable IDs once and bounds entries and receipts', () => {
    const x = harness(), { H } = x;
    const context = { ...x.ctx(), history: [{ id: 'm1', text: '喜欢看书', at: x.now() - 1000 }], phone: { usageRecords: [{ id: 'p1', text: '刚刚看了日历', at: x.now() - 500 }] }, eventRecords: [{ id: 'e1', at: x.now() - 1500, text: '今天有会议' }] };
    H.Living.advance(context, x.now()); H.Living.advance(context, x.now());
    assert.equal(H.State.home().lifeInbox.entries.length, 3); assert.ok(H.State.home().lifeInbox.entries.every(row => row.charId === 'a' && row.consumedAt === x.now()));
    const before = H.State.home().lifeInbox.entries[0].consumedAt;
    for (let i = 0; i < 260; i++) {
        x.advance(1); H.State.withHome(home => H.LifeContext.sync(home, { ...x.ctx(), history: [{ id: 'next' + i, at: x.now(), text: '新的聊天' }] }, x.now()));
    }
    assert.equal(H.State.home().lifeInbox.entries.length, 60); assert.ok(H.State.home().lifeInbox.seen.length <= 240);
    H.State.withHome(home => H.LifeContext.sync(home, context, x.now())); assert.equal(H.State.home().lifeInbox.entries.some(row => row.id === 'chat:m1'), false);
    assert.ok(before < x.now()); H.State.bind('b'); assert.equal(H.State.home().lifeInbox, undefined);
    assert.throws(() => H.Living.advance(context, x.now()), /已切换/);
});
test('inbox rejects future and expired data, keeps source cursors independent, and retries failed persistence', () => {
    const x = harness(), { H, storage } = x;
    const context = { ...x.ctx(), history: [{ id: 'future', at: x.now() + 1, text: '未来' }, { id: 'old', at: x.now() - 4 * 86400000, text: '过期' }, { id: 'valid', at: x.now(), text: '今天' }] };
    const set = storage.setItem, before = storage.getItem(H.State.key); storage.setItem = () => { throw Error('quota'); };
    assert.throws(() => H.Living.advance(context, x.now()), /没有保存成功/); assert.equal(storage.getItem(H.State.key), before);
    storage.setItem = set; H.Living.advance(context, x.now());
    assert.equal(H.State.home().lifeInbox.entries.length, 1);
    H.Living.advance({ ...x.ctx(), eventRecords: [{ id: 'world1', at: x.now() - 20000, text: '较早的可知事件' }] }, x.now());
    assert.equal(H.State.home().lifeInbox.entries.length, 2);
});
test('shared prompt distinguishes intentions, blocked receipts and simulated activity', () => {
    const { H } = harness(), token = H.Actions.begin('char', read); H.Actions.transition(token, 'blocked', '座位有人');
    const prompt = H.Living.prompt({ id: 'a' }); assert.match(prompt, /activity只是计划/); assert.match(prompt, /"phase":"blocked"/); assert.match(prompt, /座位有人/);
    assert.equal(H.Living.prompt({ id: 'missing' }), '');
});

test('long hidden intervals use bounded simulation while online blocked actions remain unfulfilled', () => {
    const x = harness(), { H } = x;
    H.State.withHome(home => { home.activity = { ...read, until: x.now() + 3600000 }; });
    const token = H.Actions.begin('char', read); H.Actions.transition(token, 'blocked', '无通道');
    x.advance(10 * 60000); H.Living.advance(x.ctx(), x.now(), true);
    assert.equal(H.State.home().lastLifeAt, x.now()); assert.equal(H.State.home().executions.char.phase, 'blocked');
    assert.equal(H.State.home().moments.some(row => row.source === 'autonomous'), false);
});

test('AI plans include confirmed preferences and receipts; changes during the request reject the old result', async () => {
    for (const change of ['preferences', 'manual']) {
        const x = harness(), { H } = x; x.context.callChatApi = async () => {};
        const token = H.Actions.begin('char', read); H.Actions.transition(token, 'blocked', '座位有人');
        H.LifeContext.save({ ...H.LifeContext.preferences(H.State.home()), Read: 'like' }, 'a');
        let resolve, input;
        H.Bridge.request = messages => { input = JSON.parse(messages[1].content); return new Promise(done => { resolve = done; }); };
        const request = H.Living.decide();
        assert.equal(input.preferences.Read, 'like'); assert.equal(input.execution.phase, 'blocked');
        if (change === 'preferences') H.LifeContext.save({ ...H.LifeContext.preferences(H.State.home()), Care: 'like' }, 'a');
        else H.Actions.begin('user', read);
        resolve({ ok: true, content: JSON.stringify(read) });
        await assert.rejects(request, /旧计划没有保存/);
        assert.equal(H.State.home().activity, null);
    }
});

test('invalid imported execution or inbox data fails readably without modifying the save', () => {
    for (const fields of [{ executions: { char: { phase: 'invented' } } }, { actionReceipts: {} }, { lifeInbox: { entries: ['bad'], seen: [] } }, { preferences: { Read: 'invented' } }]) {
        const { H, storage } = harness(), data = H.State.load(); Object.assign(data.homes.a, fields);
        const raw = JSON.stringify(data); storage.setItem(H.State.key, raw);
        assert.throws(() => H.State.load(), /原存档已保留/); assert.equal(storage.getItem(H.State.key), raw);
    }
});

test('offscreen arrangements remain identified as simulated and cancellation clears their active status', () => {
    const { H } = harness(); H.Actions.begin('char', read, { simulated: true });
    assert.match(H.Actions.status(H.State.home()), /本地模拟/); assert.equal(H.State.home().moments.length, 0);
    H.Actions.end('char'); assert.equal(H.Actions.status(H.State.home()), '正在休息');
});


test('shared arrivals and save failures are atomic for both participants', () => {
    const { H, storage } = harness(), pair = H.Actions.beginGroup(['user','char'].map(actor => ({ ...read, actor, source: 'interaction' })));
    assert.equal(pair[0].groupId,pair[1].groupId);
    assert.equal(H.Actions.transitionGroup(pair,'walking'),true);
    const before=storage.getItem(H.State.key), set=storage.setItem;
    storage.setItem=()=>{throw Error('quota');};
    assert.throws(()=>H.Actions.transitionGroup(pair,'acting'),/没有保存成功/);
    assert.equal(storage.getItem(H.State.key),before);
    assert.equal(H.State.home().executions.user.phase,'walking');
    assert.equal(H.State.home().executions.char.phase,'walking');
    storage.setItem=set;assert.equal(H.Actions.transitionGroup(pair,'acting'),true);
    assert.equal(H.State.home().executions.user.startedAt,H.State.home().executions.char.startedAt);
    assert.ok(H.State.home().moments.every(row=>row.source==='interaction'));
    assert.equal(H.Actions.transitionGroup(pair,'finished'),true);
});
test('one stale participant rejects the entire shared arrival and group creation failure preserves both old records', () => {
    const { H, storage }=harness(), pair=H.Actions.beginGroup(['user','char'].map(actor=>({...read,actor})));
    H.Actions.transitionGroup(pair,'walking');H.Actions.end('char');
    assert.equal(H.Actions.transitionGroup(pair,'acting'),false);
    assert.equal(H.State.home().executions.user.phase,'walking');assert.equal(H.State.home().moments.length,0);
    const before=storage.getItem(H.State.key),set=storage.setItem;
    storage.setItem=()=>{throw Error('quota');};
    assert.throws(()=>H.Actions.beginGroup(['user','char'].map(actor=>({...read,actor}))),/没有保存成功/);
    assert.equal(storage.getItem(H.State.key),before);storage.setItem=set;
    assert.equal(H.Actions.transition(pair[0],'cancelled'),true);
});
test('shared furniture resolves real distinct seats and does not offer private fixtures as group activities', () => {
    const { H }=harness(),rows=room=>H.Rooms.placements(H.Rooms.get(room),H.State.home()).map(placement=>({placement,item:H.Furniture.get(placement.furnitureId),area:room}));
    for(const [room,type,action]of [['living_room','sofa','Read'],['bedroom','bed','Sleep'],['dining_room','table','Eat']]){
        const furniture=rows(room),row=furniture.find(r=>r.item.type===type&&H.Rooms.sharedActions(r.item)[action]);assert.ok(row,room);
        const pair=H.Rooms.sharedAnchors(furniture,row,action);assert.ok(Math.hypot(pair.anchors[0].x-pair.anchors[1].x,pair.anchors[0].z-pair.anchors[1].z)>=.45);
        if(room==='dining_room')assert.notEqual(pair.anchors[0].seatId,pair.anchors[1].seatId);
    }
    for(const row of rows('bathroom')) assert.equal(Object.keys(H.Rooms.sharedActions(row.item)).length,0);
    const dining=rows('dining_room'),table=dining.find(r=>r.item.variant==='dining');
    assert.throws(()=>H.Rooms.sharedAnchors(dining.filter(r=>r.item.type!=='chair'),table,'Eat'),/两个可用/);
});
test('online life updates do not replace a shared invitation or ongoing action, and resume after it ends', () => {
    const x=harness(),{H}=x;H.State.withHome(h=>{h.activity={...read,until:x.now()-1};});
    const pair=H.Actions.beginGroup(['user','char'].map(actor=>({...read,actor})));
    H.Actions.transitionGroup(pair,'walking');const before=JSON.stringify(H.State.home().activity);
    x.advance(60000);H.Living.advance(x.ctx(),x.now(),true);assert.equal(JSON.stringify(H.State.home().activity),before);
    H.Actions.transitionGroup(pair,'acting');
    for(let i=0;i<12;i++){x.advance(60000);H.Living.advance(x.ctx(),x.now(),true);}
    assert.equal(H.State.home().activity.action,'Read');assert.equal(H.State.home().executions.char.phase,'acting');
    H.Actions.transitionGroup(pair,'finished');assert.equal(H.State.home().activity.action,'Idle');
    x.advance(120000);H.Living.advance(x.ctx(),x.now(),true);assert.ok(H.State.home().activity.until>x.now());
});
