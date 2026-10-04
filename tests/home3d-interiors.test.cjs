'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { memoryStorage } = require('./helpers/harness.cjs');
function setup() {
    const localStorage = memoryStorage(), window = { ByndHome3D: {}, myCharacters: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }, context = vm.createContext({ window, localStorage, Date, console });
    for (const name of ['data/catalogs', 'interiors', 'furniture', 'rooms', 'characters', 'state', 'bridge']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../apps/home3d', name + '.js'), 'utf8'), context);
    const H = window.ByndHome3D; H.State.bind('a'); return { H, localStorage };
}
test('complete interior sets save per room and per character without moving furniture or changing lighting', () => {
    const { H } = setup(), before = JSON.stringify(H.Rooms.placements(H.Rooms.get('living_room'), H.State.home()));
    H.Interiors.apply('living_room', { preset: 'palace' }, true);
    assert.equal(H.Interiors.resolve(H.Rooms.get('living_room'), H.State.home()).floor, 'ivory_marble');
    assert.equal(H.Interiors.resolve(H.Rooms.get('bedroom'), H.State.home()).id, 'garden');
    assert.equal(H.State.home().theme, 'auto');
    assert.equal(JSON.stringify(H.Rooms.placements(H.Rooms.get('living_room'), H.State.home())), before);
    H.State.bind('b'); assert.equal(H.Interiors.resolve(H.Rooms.get('living_room'), H.State.home()).id, 'garden');
    H.State.bind('a'); assert.equal(H.Interiors.resolve(H.Rooms.get('living_room'), H.State.home()).id, 'palace');
});

test('all default rooms share one coordinated interior and saved user choices remain independent', () => {
    const { H } = setup(), home = H.State.home();
    const initial = H.Interiors.resolve(H.Rooms.get('living_room'), home);
    for (const room of H.catalogs.roomCatalog.rooms) {
        const config = H.Interiors.resolve(room, home);
        for (const key of ['id', 'wall', 'floor', 'wood', 'trim', 'accent', 'fabric', 'furnitureStyle']) assert.equal(config[key], initial[key], room.id + ' ' + key);
    }
    H.Interiors.apply('game_room', { preset: 'pink' }, true);
    assert.equal(H.Interiors.resolve(H.Rooms.get('game_room'), H.State.home()).id, 'pink');
    assert.equal(H.Interiors.resolve(H.Rooms.get('bedroom'), H.State.home()).id, initial.id);
});
test('wall/floor customization preserves furniture and reselecting the same kit restores its finishes', () => {
    const { H } = setup(), room = H.Rooms.get('living_room'), sofa = room.furniture.find(p => p.id === 'sofa');
    const first = H.Interiors.furniture(H.Furniture.get(sofa.furnitureId), sofa, room, H.State.home());
    H.Interiors.apply('living_room', { floor: 'tatami' });
    const after = H.Interiors.furniture(H.Furniture.get(sofa.furnitureId), sofa, room, H.State.home());
    assert.equal(after.style, first.style); assert.equal(after.interiorPalette.wood, first.interiorPalette.wood);
    H.Interiors.apply('living_room', { preset: 'botanical' }, true);
    const furniture = JSON.stringify(H.State.home().interiors.living_room.furniture);
    H.Interiors.apply('living_room', { wall: 'rose_brick', floor: 'tatami' });
    assert.equal(H.Interiors.resolve(H.Rooms.get('living_room'), H.State.home()).wall, 'rose_brick');
    assert.equal(JSON.stringify(H.State.home().interiors.living_room.furniture), furniture);
    H.Interiors.apply('living_room', { preset: 'botanical' }, true);
    assert.equal(H.Interiors.resolve(H.Rooms.get('living_room'), H.State.home()).wall, 'linen_stripe');
    assert.equal(H.Interiors.resolve(H.Rooms.get('living_room'), H.State.home()).floor, 'walnut_parquet');
});
test('failed interior writes and invalid finish IDs preserve the old durable home', () => {
    const { H, localStorage } = setup(), before = localStorage.getItem(H.State.key);
    for (const changes of [{ preset: 'constructor' }, { wall: '__proto__' }, { floor: 'missing' }]) {
        assert.throws(() => H.Interiors.apply('living_room', changes, true), /无效/); assert.equal(localStorage.getItem(H.State.key), before);
    }
    localStorage.setItem = () => { throw Error('quota'); };
    assert.throws(() => H.Interiors.apply('living_room', { preset: 'natural' }, true), /没有保存成功/);
    assert.equal(localStorage.getItem(H.State.key), before);
});
test('corrupt imported interior choices never overwrite the raw saved data', () => {
    const { H, localStorage } = setup();
    for (const invalid of [{ preset: 'future-style' }, { preset: 'garden', floor: 'constructor' }, { preset: 'palace', furniture: { sofa: '__proto__' } }, ['garden']]) {
        const data = JSON.parse(localStorage.getItem(H.State.key)); data.homes.a.interiors = { living_room: invalid };
        const raw = JSON.stringify(data); localStorage.setItem(H.State.key, raw);
        assert.throws(() => H.State.load(), /墙面地板存档无效/); assert.equal(localStorage.getItem(H.State.key), raw);
    }
});
test('stored and newly added custom furniture retain their own look until a full kit is applied', () => {
    const { H } = setup(), room = H.Rooms.get('living_room');
    H.State.withHome(home => { home.layouts.living_room = { items: { sofa: { id: 'sofa', furnitureId: 'chinese_sofa', position: [0, 0, -1.5], rotation: 0 } }, removed: [] }; });
    const p = H.Rooms.placements(room, H.State.home()).find(row => row.id === 'sofa'), item = H.Furniture.get(p.furnitureId);
    assert.equal(H.Interiors.furniture(item, p, room, H.State.home()).style, 'chinese');
    H.Interiors.apply('living_room', { preset: 'natural' }, true);
    const styled = H.Interiors.furniture(item, p, room, H.State.home());
    assert.equal(styled.style, 'modern'); assert.deepEqual(styled.footprint, item.footprint);
    assert.equal(H.Interiors.furniture(H.Furniture.get('european_chair'), { id: 'new-chair' }, room, H.State.home()).style, 'european');
});
