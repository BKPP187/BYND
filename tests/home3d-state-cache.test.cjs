'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { memoryStorage } = require('./helpers/harness.cjs');
const root = path.resolve(__dirname, '..');
function harness() {
    const localStorage = memoryStorage(), listeners = {};
    const window = { ByndHome3D: {}, myCharacters: [{ id: 'a', name: 'A', history: [], chatConfig: {} }, { id: 'b', name: 'B', history: [], chatConfig: {} }], addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); } };
    const context = vm.createContext({ window, localStorage, Date, console, performance });
    for (const name of ['data/catalogs', 'characters', 'state', 'bridge', 'furniture', 'rooms']) vm.runInContext(fs.readFileSync(path.join(root, 'apps/home3d', name + '.js'), 'utf8'), context);
    const H = window.ByndHome3D; H.State.bind('a');
    return { H, localStorage, listeners, context };
}
function countParses(context, run) {
    const json = vm.runInContext('JSON', context), original = json.parse; let calls = 0;
    json.parse = function (...args) { calls++; return original.apply(this, args); };
    try { run(); } finally { json.parse = original; }
    return calls;
}
test('state reads come from an in-memory cache and updates never re-parse the save', () => {
    const { H, context } = harness();
    assert.equal(countParses(context, () => { for (let i = 0; i < 50; i++) { H.State.home(); H.State.peekHome(); H.State.load(); } }), 0);
    assert.equal(countParses(context, () => H.State.withHome(home => { home.room = 'bedroom'; })), 0);
    assert.equal(H.State.peekHome().room, 'bedroom');
});
test('load() copies are isolated from the cache; peekHome() is the shared read-only view', () => {
    const { H } = harness();
    const copy = H.State.home(); copy.room = 'kitchen'; copy.moments.push({ id: 'x' });
    assert.equal(H.State.home().room, 'living_room'); assert.equal(H.State.home().moments.length, 0);
    assert.equal(H.State.peekHome(), H.State.peekHome(), 'hot path returns the same object without copying');
});
test('external writes, storage events and failed writes keep the cache consistent', () => {
    const { H, localStorage, listeners } = harness();
    const data = H.State.load(); data.homes.a.room = 'bedroom'; localStorage.setItem(H.State.key, JSON.stringify(data));
    assert.equal(H.State.home().room, 'bedroom', 'a direct storage write is noticed by load()');
    const other = H.State.load(); other.homes.a.room = 'kitchen'; localStorage.values.set(H.State.key, JSON.stringify(other));
    listeners.storage.forEach(fn => fn({ key: H.State.key }));
    assert.equal(H.State.peekHome().room, 'kitchen', 'a storage event invalidates the hot-path cache');
    const before = localStorage.getItem(H.State.key), set = localStorage.setItem;
    localStorage.setItem = () => { throw Error('quota'); };
    assert.throws(() => H.State.withHome(home => { home.room = 'garden'; }), /没有保存成功/);
    localStorage.setItem = set;
    assert.equal(H.State.peekHome().room, 'kitchen'); assert.equal(localStorage.getItem(H.State.key), before);
});
test('corrupt saves fail once per raw string and peekHome() returns null instead of throwing', () => {
    const { H, localStorage, context } = harness();
    localStorage.setItem(H.State.key, '{broken');
    assert.throws(() => H.State.load(), /无法读取/);
    assert.equal(countParses(context, () => { for (let i = 0; i < 10; i++) assert.throws(() => H.State.load(), /无法读取/); }), 0);
    assert.equal(H.State.peekHome(), null);
});
test('stale catalog references are dropped per item, arrays are normalized, moment ids are unique', () => {
    const { H, localStorage } = harness();
    const data = H.State.load(), home = data.homes.a;
    home.openRooms = ['bathroom', 'retired_room']; home.visits = null; home.keepsakes = 'oops'; home.moments = [{ id: 'moment_1', at: 1 }, { id: 'moment_1', at: 1 }, 'bad'];
    home.modelId = 'retired-model';
    home.layouts = { living_room: { removed: [], items: { keep: { id: 'keep', furnitureId: 'cream_chair', position: [0, 0, 0], rotation: 0 }, gone: { id: 'gone', furnitureId: 'retired_furniture', position: [1, 0, 0], rotation: 0 } } }, retired_room: { removed: [], items: {} } };
    home.interiors = { retired_room: { preset: 'garden' }, living_room: { preset: 'garden', wall: 'retired_wall', furniture: { sofa: 'retired_style' } } };
    const raw = JSON.stringify(data); localStorage.setItem(H.State.key, raw);
    const repaired = H.State.home();
    assert.deepEqual([...repaired.openRooms], ['bathroom']);
    assert.deepEqual([...repaired.visits], []); assert.deepEqual([...repaired.keepsakes], []);
    assert.equal(repaired.moments.length, 2); assert.notEqual(repaired.moments[0].id, repaired.moments[1].id);
    assert.equal(repaired.modelId, undefined);
    assert.deepEqual(Object.keys(repaired.layouts), ['living_room']); assert.deepEqual(Object.keys(repaired.layouts.living_room.items), ['keep']);
    assert.deepEqual(Object.keys(repaired.interiors), ['living_room']); assert.equal(repaired.interiors.living_room.wall, undefined);
    assert.deepEqual({ ...repaired.interiors.living_room.furniture }, {});
    assert.equal(localStorage.getItem(H.State.key), raw, 'repair happens in memory; the raw save is only rewritten by the next real update');
    H.State.visit(); assert.equal(JSON.parse(localStorage.getItem(H.State.key)).homes.a.layouts.living_room.items.gone, undefined);
});
test('moments recorded in the same millisecond get unique ids', () => {
    const { H } = harness();
    H.State.moment('Hug', 'one', 'interaction', 1000); H.State.moment('Read', 'two', 'interaction', 1000);
    H.State.withHome(home => { home.moments.push({ id: home.moments[0].id, at: 1000, action: 'Sit', text: 'three' }); });
    const ids = H.State.home().moments.map(row => row.id);
    assert.equal(new Set(ids).size, ids.length);
});
