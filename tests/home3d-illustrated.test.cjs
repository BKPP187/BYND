'use strict';
// 2.5D illustrated home: drawing kit, depth order, loader and wiring.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function load() {
    const store = {};
    const ctx = { console, Math, JSON, Date, Number, String, Array, Object, Set, Map, setTimeout, clearTimeout, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, document: { querySelector: () => null } };
    ctx.window = ctx; vm.createContext(ctx);
    ctx.ByndHome3D = { session: 1 };
    ctx.myCharacters = [{ id: 'c1', name: '阿澈' }];
    for (const file of ['apps/home3d/data/catalogs.js', ...['furniture', 'rooms', 'villa', 'animation', 'build', 'characters', 'state', 'bridge', 'life-context', 'living', 'actions', 'illustrated/art'].map(n => 'apps/home3d/' + n + '.js')]) vm.runInContext(read(file), ctx, { filename: file });
    return ctx.ByndHome3D;
}

test('every catalog furniture type has an illustration with finite solids', () => {
    const H = load();
    for (const item of H.catalogs.furnitureCatalog.items) {
        for (const rotation of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
            const full = H.Furniture.get(item.id);
            const prims = H.Art.furniture({ id: 'p', furnitureId: item.id, position: [0.3, item.type === 'frame' ? 1.8 : 0, -0.4], rotation }, full, item.style, null, {});
            const solids = prims.filter(p => !['shadow', 'light'].includes(p.kind));
            assert.ok(solids.length > 0, item.id + ' draws nothing');
            for (const p of solids) {
                assert.ok(p.b.every(Number.isFinite), item.id + ' has a non-finite bound');
                assert.ok(p.b[0] <= p.b[3] && p.b[1] <= p.b[4] && p.b[2] <= p.b[5], item.id + ' has an inverted bound');
                const svg = H.Art.svgOf(p);
                assert.ok(svg.length > 0 && !/NaN|undefined|Infinity/.test(svg), item.id + ' renders invalid SVG: ' + svg.slice(0, 120));
            }
        }
    }
});

test('painter order keeps every overlapping pair in front-to-back order', () => {
    const H = load();
    H.State.bind('c1', {});
    const home = H.State.home();
    for (const room of H.catalogs.roomCatalog.rooms.filter(r => r.furniture.length)) {
        const prims = H.Rooms.placements(room, home).flatMap(pl => H.Art.furniture(pl, H.Furniture.get(pl.furnitureId), null, null, {})).filter(p => !['shadow', 'light'].includes(p.kind));
        const order = H.Art.sort(prims);
        assert.equal(order.length, prims.length, room.id + ' lost solids while sorting');
        const index = new Map(order.map((p, i) => [p, i]));
        let violations = 0;
        for (let i = 0; i < prims.length; i++) for (let j = 0; j < prims.length; j++) {
            if (i === j) continue;
            const a = prims[i], b = prims[j];
            if (!H.Art.overlap(H.Art.screenBox(a.b), H.Art.screenBox(b.b))) continue;
            if (H.Art.behind(a.b, b.b) && !H.Art.behind(b.b, a.b) && index.get(a) > index.get(b)) violations++;
        }
        assert.equal(violations, 0, room.id + ' has depth-order violations');
    }
});

test('the home opens in the illustrated view by default and keeps 3D reachable', () => {
    const loader = read('apps/home3d/home3d.js');
    assert.match(loader, /function ensure25\(\)/);
    assert.match(loader, /'illustrated\/art', 'illustrated\/sprites', 'illustrated\/room', 'illustrated\/ui'/);
    assert.match(loader, /bynd_home_view_v1'\) === '3d' \? '3d' : 'illustrated'/);
    assert.doesNotMatch(loader.slice(loader.indexOf('function ensure25'), loader.indexOf('const preferredView')), /engine\.js/, 'the 2.5D view must not load the WebGL engine');
    assert.match(read('apps/home3d/ui.js'), /data-action="to-illustrated"/);
    assert.match(read('apps/home3d/illustrated/ui.js'), /data-act="to-3d"/);
});

test('illustrated actions write the same receipts the chat prompt reads', () => {
    const ui = read('apps/home3d/illustrated/ui.js');
    for (const call of ["H.Actions.begin('char'", "H.Actions.begin('user'", 'H.Actions.beginGroup(', 'H.Actions.transitionGroup(', 'H.Living.advance(', 'H.Rooms.sharedAnchors(']) assert.ok(ui.includes(call), 'missing ' + call);
});

test('illustrated styles and sprites are packaged', () => {
    assert.match(read('ui/theme/style.css'), /apps\/home3d\/illustrated\/illustrated\.css/);
    assert.match(read('scripts/source-layout.cjs'), /'apps\/home3d\/illustrated\/illustrated\.css'/);
    for (const who of ['user', 'char']) for (const pose of ['', '-sleep']) {
        const file = path.join(root, 'assets/home3d/illustrated/doll-' + who + pose + '-v1.png');
        const bytes = fs.readFileSync(file);
        assert.equal(bytes.readUInt32BE(0), 0x89504e47, file + ' is not a PNG');
        assert.ok(bytes.length < 260000, file + ' should stay small for phones');
    }
    // The scene SVG must not inherit the 1em icon size from #home3d-root svg.
    assert.match(read('apps/home3d/illustrated/room.js'), /svg\.style\.width = /);
});

test('every pose the room can ask for has a sprite rendered from the 3D figures', () => {
    const ctx = { window: {} }; ctx.window.ByndHome3D = {}; vm.createContext(ctx);
    vm.runInContext(read('apps/home3d/illustrated/sprites.js'), ctx);
    const S = ctx.window.ByndHome3D.Sprites25, names = [];
    for (const who of ['user', 'char']) {
        for (let k = 0; k < 8; k++) { names.push(who + '-idle-r' + k); for (let f = 0; f < 4; f++) names.push(who + '-walk' + f + '-r' + k); }
        for (const r of [0, 2, 4, 6]) {
            names.push(who + '-cook-r' + r);
            for (const t of ['sit', 'read', 'phone']) names.push(who + '-sofa-' + t + '-r' + r);
            for (const t of ['sit', 'read', 'work']) names.push(who + '-chair-' + t + '-r' + r);
            for (const t of ['sleep', 'lie']) names.push(who + '-bed-' + t + '-r' + r, who + '-sofabed-' + t + '-r' + r);
        }
    }
    assert.ok(S.unitsPerPx > 0);
    for (const name of names) {
        const meta = S.sprites[name];
        assert.ok(meta && meta.length === 7 && meta.every(Number.isFinite), 'missing sprite meta ' + name);
        const bytes = fs.readFileSync(path.join(root, S.base, name + '.webp'));
        assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', name + ' is not WebP');
    }
    // Default figures follow the 3D house rule: portrait only when chosen.
    assert.match(read('apps/home3d/illustrated/ui.js'), /person\?\.modelId === 'portrait' \|\| \(!person\?\.modelId && p\)/);
});
