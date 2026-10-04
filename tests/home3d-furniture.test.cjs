'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function harness() {
    const context = vm.createContext({ console, AbortController, window: { ByndHome3D: {} } });
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/vendor/home3d/engine.js'), 'utf8'), context);
    for (const name of ['data/catalogs', 'cooking', 'furniture-visuals', 'furniture']) vm.runInContext(fs.readFileSync(path.join(root, 'apps/home3d', name + '.js'), 'utf8'), context);
    const H = context.window.ByndHome3D, T = context.ByndHomeEngine, cache = new Map();
    const materials = {
        get(id, color) { const key = id + color; if (!cache.has(key)) cache.set(key, new T.MeshStandardMaterial({ color: color || '#ffffff' })); return cache.get(key); },
        woven(color) { return this.get('woven', color); }, glow(color) { return this.get('glow', color); }
    };
    return { H, T, materials };
}
test('reference furniture has finite pickable geometry within mobile size and draw-call budgets', async () => {
    const { H, T, materials } = harness();
    for (const data of H.catalogs.furnitureCatalog.items.filter(H.FurnitureVisuals.handles)) {
        const item = H.Furniture.get(data.id), model = await H.Furniture.load(item, materials);
        assert.equal(model.userData.furnitureDesign, 'cozy-reference-v1', item.id);
        assert.ok(model.children.length > 0 && model.children.length <= 10, item.id + ' batches');
        let triangles = 0;
        for (const mesh of model.children) {
            const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal'), uv = mesh.geometry.getAttribute('uv');
            assert.equal(position.count, normal.count); assert.equal(position.count, uv.count);
            assert.ok([...position.array, ...normal.array, ...uv.array].every(Number.isFinite), item.id);
            assert.ok(mesh.userData.effect === 'steam' || mesh.castShadow && mesh.receiveShadow); triangles += position.count / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
        }
        assert.ok(triangles < 10000, item.id + ' polygon budget');
        const bounds = new T.Box3().setFromObject(model);
        assert.ok(bounds.min.y >= -.02, item.id + ' floor pivot');
        assert.ok(bounds.min.x >= -item.footprint[0] / 2 - .10 && bounds.max.x <= item.footprint[0] / 2 + .10, item.id + ' width');
        assert.ok(bounds.min.z >= -item.footprint[1] / 2 - .10 && bounds.max.z <= item.footprint[1] / 2 + .10, item.id + ' depth');
        assert.ok(new T.Raycaster(new T.Vector3(0, 4, 0), new T.Vector3(0, -1, 0)).intersectObject(model, true).length > 0, item.id + ' pickable');
    }
});
test('new upholstered seats retain the actual character support height across widths and styles', () => {
    const { H, T, materials } = harness();
    for (const data of H.catalogs.furnitureCatalog.items.filter(item => H.FurnitureVisuals.handles(item) && ['chair', 'sofa'].includes(item.type))) {
        const item = H.Furniture.get(data.id), support = H.Furniture.support(item), model = H.FurnitureVisuals.create(item, materials);
        model.updateMatrixWorld(true);
        const ray = new T.Raycaster(new T.Vector3(item.type === 'sofa' ? item.footprint[0] * .22 : 0, 4, support.seatDepth), new T.Vector3(0, -1, 0));
        const hit = ray.intersectObject(model, true)[0];
        assert.ok(hit && Math.abs(hit.point.y - support.seatHeight) < .015, item.id + ' actual seat surface');
    }
});
test('kitchen basin is recessed geometry and exported new models need no network bytes', async () => {
    const { H, T, materials } = harness(), sink = await H.Furniture.load(H.Furniture.get('cream_sink'), materials);
    sink.updateMatrixWorld(true);
    const down = x => new T.Raycaster(new T.Vector3(x, 4, 0), new T.Vector3(0, -1, 0)).intersectObject(sink, true)[0].point.y;
    assert.ok(down(.48) - down(.16) > .10, 'sink cavity is below countertop');
    for (const style of ['cream', 'european']) for (const suffix of ['sink', 'fridge', 'dining_table', 'sideboard', 'fireplace', 'wardrobe']) {
        const item = H.Furniture.get(style + '_' + suffix);
        assert.equal(item.source, 'bynd'); assert.equal(item.model, null); assert.ok(item.procedural);
        assert.ok((await H.Furniture.load(item, materials)).children.length);
    }
});

test('sofa rest support has an actual horizontal pillow and monitors face their users', () => {
    const { H, T, materials } = harness();
    for (const data of H.catalogs.furnitureCatalog.items.filter(i => i.type === 'sofa' && H.FurnitureVisuals.handles(i))) {
        const item = H.Furniture.get(data.id), model = H.FurnitureVisuals.create(item, materials); model.updateMatrixWorld(true);
        const hit = new T.Raycaster(new T.Vector3(-item.width / 2 + .45, 3, .20), new T.Vector3(0, -1, 0)).intersectObject(model, true)[0];
        assert.ok(hit && Math.abs(hit.point.y - H.Furniture.support(item).pillowSurface) < .01, item.id + ' pillow support');
    }
    const screen = H.FurnitureVisuals.create(H.Furniture.get('computer_01'), materials); screen.updateMatrixWorld(true);
    const front = new T.Raycaster(new T.Vector3(.05, .36, 2), new T.Vector3(0, 0, -1)).intersectObject(screen, true)[0];
    const back = new T.Raycaster(new T.Vector3(.05, .36, -2), new T.Vector3(0, 0, 1)).intersectObject(screen, true)[0];
    assert.ok(front && back); assert.notEqual(front.object.material, back.object.material);
    assert.equal(front.object.material.color.getHex(), 0x182732);
});

test('complete schemes change model geometry and the television viewing face points into the room', () => {
    const { H, T, materials } = harness(), signatures = new Set();
    for (const style of ['cream', 'european', 'botanical', 'rose', 'pink', 'modern', 'monochrome']) {
        const sofa = H.FurnitureVisuals.create({ ...H.Furniture.get('sofa_cream_01'), style }, materials);
        // Color alone cannot satisfy this: include both geometry and table silhouette.
        const table = H.FurnitureVisuals.create({ ...H.Furniture.get('coffee_01'), style }, materials);
        const signature = [sofa, table].map(root => root.children.map(mesh => [...mesh.geometry.attributes.position.array].map(x => x.toFixed(3)).join(',')).join('|')).join('/');
        // Modern and monochrome deliberately share the same slender structure.
        if (style !== 'monochrome') { assert.ok(!signatures.has(signature), style + ' distinct silhouette'); signatures.add(signature); }
    }
    const tv = H.FurnitureVisuals.create(H.Furniture.get('tv_01'), materials); tv.rotation.y = Math.PI / 2; tv.updateMatrixWorld(true);
    const fromRoom = new T.Raycaster(new T.Vector3(3, .35, .075), new T.Vector3(-1, 0, 0)).intersectObject(tv, true)[0];
    const fromWall = new T.Raycaster(new T.Vector3(-3, .35, .075), new T.Vector3(1, 0, 0)).intersectObject(tv, true)[0];
    assert.ok(fromRoom && fromWall);
    assert.ok(fromRoom.object.material.color.getHex() < 0x303030, 'black viewing face at world +X');
    assert.notEqual(fromRoom.object.material, fromWall.object.material, 'screen is separate from the back casing');
});
