'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { memoryStorage } = require('./helpers/harness.cjs');
function harness() {
    let time = new Date(2026, 9, 12, 0, 0).getTime();
    class Clock extends Date { constructor(...a) { super(...(a.length ? a : [time])); } static now() { return time; } }
    const window = { ByndHome3D: { session: 1 }, myCharacters: [{ id: 'a', name: 'A', history: [] }] };
    const context = vm.createContext({ window, localStorage: memoryStorage(), Date: Clock, console, performance });
    for (const n of ['home3d', 'data/catalogs', 'characters', 'state', 'bridge', 'furniture', 'rooms', 'animation', 'build', 'life-context', 'living', 'actions', 'interactions']) vm.runInContext(fs.readFileSync(path.resolve('apps/home3d', n + '.js'), 'utf8'), context);
    const H = window.ByndHome3D; H.State.bind('a');
    H.State.withHome(h => { h.openRooms = H.catalogs.roomCatalog.rooms.filter(r => r.expandable).map(r => r.id); });
    return { H, start: time, set: t => { time = t; } };
}
function day(H, start, ctx) {
    let home = JSON.parse(JSON.stringify(H.State.home())), prev = null, switches = 0, needs = H.Living.normalizeNeeds(home.needs); const seq = [];
    for (let t = 0; t < 86400000; t += 30000) {
        const now = start + t, a = H.Living.plan({ ...home, needs, activity: prev }, ctx, now);
        if (!prev || a.action !== prev.action || a.target !== prev.target) { switches++; seq.push([now, a.action]); }
        needs = H.Living.evolveNeeds(needs, a.action, .5); prev = a;
    }
    return { switches, seq };
}
test('a day follows schedule blocks: few activity changes, no meal or bath flapping, sleep at night', () => {
    const { H, start } = harness(), { switches, seq } = day(H, start, { charId: 'a', personality: '' });
    assert.ok(switches < 80, 'switches ' + switches);
    const baths = seq.filter(([, a]) => ['Bathe', 'Shower'].includes(a)).length; assert.ok(baths <= 1, 'baths ' + baths);
    const lunch = seq.filter(([t, a]) => new Date(t).getHours() === 12 && ['Cook', 'Eat'].includes(a)).length; assert.ok(lunch <= 2, 'lunch switches ' + lunch);
    assert.equal(H.Living.plan(H.State.home(), { charId: 'a' }, start + 3 * 3600000).action, 'Sleep');
    assert.notEqual(H.Living.plan(H.State.home(), { charId: 'a' }, start + 15 * 3600000).action, 'Sleep');
});
test('negated tiredness does not trigger care, real tiredness does', () => {
    const { H, start } = harness(), at = start + 15 * 3600000;
    const negative = H.Living.signals({ history: [{ isMe: true, at: at - 600000, text: '我不累，别担心' }] }, at), positive = H.Living.signals({ history: [{ isMe: true, at: at - 600000, text: '今天好累啊' }] }, at);
    assert.equal(negative.care, null); assert.equal(positive.care?.mood, 'tired');
    const old = H.Living.signals({ history: [{ isMe: true, at: at - 2 * 86400000, text: '好累' }] }, at); assert.equal(old.care, null);
});
test('chronotype comes from persona text and respects negation', () => {
    const { H } = harness();
    assert.equal(H.Living.chronotype({}, { personality: '典型夜猫子，经常熬夜' }), 'owl');
    assert.equal(H.Living.chronotype({}, { personality: '每天早起晨跑' }), 'lark');
    assert.equal(H.Living.chronotype({}, { personality: '从不熬夜' }), 'default');
});
test('offline catch-up is fast, bounded and summarised as a day', () => {
    const { H, start, set } = harness(); set(start + 86400000);
    H.State.withHome(h => { h.lastLifeAt = start; h.moments = []; h.activity = null; });
    H.Living.plan(H.State.home(), { charId: 'a' }, start); // warm the one-off reachability cache
    const t0 = Date.now(); H.Living.advance({ charId: 'a' }, start + 86400000, false); const ms = Date.now() - t0;
    const home = H.State.home(); assert.ok(ms < 500, 'catch-up ' + ms + 'ms');
    assert.ok(home.moments.length >= 4 && home.moments.length <= 15, 'moments ' + home.moments.length);
    assert.match(home.awaySummary.text, /^今天/);
});
test('chat brief stays short and natural', () => {
    const { H, start } = harness(); H.Living.advance({ charId: 'a' }, start + 15 * 3600000, false);
    const brief = H.lifeBrief(H.State.home(), start + 15 * 3600000);
    assert.ok(brief.length > 0 && brief.length <= 600, 'length ' + brief.length); assert.match(brief, /现在/);
    assert.doesNotMatch(brief, /cream_|"needs"|lifeInbox|\d{13}/);
});
test('model JSON replies are parsed through think blocks and code fences', () => {
    const { H } = harness();
    assert.deepEqual(JSON.parse(JSON.stringify(H.Bridge.parseJson('<think>{x}</think>```json\n{"room":"bedroom","reason":"a}b"}\n```'))), { room: 'bedroom', reason: 'a}b' });
});
