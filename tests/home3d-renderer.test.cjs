'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function harness() {
    const storage = new Map(), localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
    const window = { ByndHome3D: {} }, context = vm.createContext({ window, localStorage, console, AbortController, document: { createElement: () => ({ width: 1, height: 1, getContext: () => ({ drawImage() {} }) }) } });
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/vendor/home3d/engine.js'), 'utf8'), context);
    for (const name of ['render-quality', 'room-camera', 'render-assets']) vm.runInContext(fs.readFileSync(path.join(root, 'apps/home3d', name + '.js'), 'utf8'), context);
    return { H: window.ByndHome3D, T: context.ByndHomeEngine, localStorage, context };
}
test('high-DPI quality strategies cap actual buffer pixels, DPR and hardware dimensions', () => {
    const { H } = harness(), Q = H.RenderQuality;
    for (const profile of Object.values(Q.presets)) for (const [width, height, dpr] of [[390, 700, 3.5], [1440, 2800, 4], [4000, 1200, 3]]) {
        const ratio = Q.ratio(profile, width, height, dpr, 1, 4096);
        assert.ok(ratio <= profile.maxDpr && ratio <= dpr);
        assert.ok(width * height * ratio * ratio <= profile.maxPixels + .01);
        assert.ok(width * ratio <= 4096 && height * ratio <= 4096);
    }
    assert.equal(Q.deviceTier({ software: true, memory: 16, cores: 16, highGpu: true, maxTextureSize: 16384 }), 'smooth');
    assert.equal(Q.deviceTier({ memory: 2, cores: 8 }), 'smooth');
    assert.equal(Q.deviceTier({ memory: 8, cores: 8, highGpu: true, maxTextureSize: 8192 }), 'ultra');
    assert.equal(Q.deviceTier({}), 'balanced', 'missing hints are not a high-end promise');
});
test('sustained slow frames lower quality in every mode, recovery is delayed and pauses reset evidence', () => {
    const { H } = harness(), Q = H.RenderQuality;
    for (const mode of ['auto', 'balanced', 'ultra']) {
        const c = Q.controller(mode, {}); let changed = 0;
        for (let time = 0; time <= 45000; time += 50) if (c.observe({ time, interval: 50, cpuMs: 25, gpuMs: 28 })) changed++;
        assert.ok(changed > 0); assert.equal(c.current().tier, 'smooth');
        c.reset(); assert.equal(c.observe({ time: 100000, interval: 10000, cpuMs: 0 }), false);
        assert.equal(c.setMode('balanced').renderScale, 1);
        assert.throws(() => c.setMode('unknown'));
    }
    const c = Q.controller('balanced');
    for (let time = 0; time <= 5000; time += 40) c.observe({ time, interval: 40, cpuMs: 25 });
    const reduced = c.current().renderScale;
    for (let time = 5040; time <= 13000; time += 16.7) c.observe({ time, interval: 16.7, cpuMs: 2 });
    assert.equal(c.current().renderScale, reduced, 'brief recovery must not bounce resolution');
    const recovering = Q.controller('ultra');
    for (let time = 0; time <= 45000; time += 50) recovering.observe({ time, interval: 50, cpuMs: 25 });
    for (let time = 45050; time < 300000; time += 34) recovering.observe({ time, interval: 1000 / recovering.current().fps, cpuMs: 2, gpuMs: 2 });
    assert.equal(recovering.current().tier, 'ultra', 'manual mode recovers toward its chosen ceiling after sustained healthy frames');
    assert.equal(recovering.current().renderScale, 1);
});
test('failed graphics preference writes preserve durable selection and report failure', () => {
    const { H, localStorage } = harness(), Q = H.RenderQuality;
    assert.equal(Q.preference(), 'auto'); Q.save('balanced');
    localStorage.setItem = () => { throw Error('quota'); };
    assert.throws(() => Q.save('ultra'), /没有保存成功/); assert.equal(Q.preference(), 'balanced');
    assert.throws(() => Q.save('unknown'), /不支持/);
});
test('room camera crops narrow phones, pans in world coordinates, smooths pinch zoom and retains rotation API', () => {
    const { H, T } = harness(), camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 70), view = H.RoomCamera.create(camera, T);
    view.resize(390, 690); view.step(0, true);
    assert.ok(camera.right - camera.left < 4, 'room is not fit into an entire miniature');
    const initial = view.stats(); view.pan(100, 80); assert.notEqual(view.stats().desired.x, initial.x); view.step(.02);
    assert.notEqual(view.stats().x, initial.x); assert.notEqual(view.stats().x, view.stats().desired.x, 'pan is damped');
    view.zoom(2); view.step(.01); assert.ok(view.stats().zoom > 1 && view.stats().zoom < 2);
    view.zoom(Infinity); view.step(1, true); assert.equal(view.stats().zoom, 2);
    view.rotate(30, 10); view.step(1, true); assert.notEqual(view.stats().yaw, initial.yaw);
    view.pan(100000, 100000); assert.ok(Math.abs(view.stats().desired.x) <= 3.3 && Math.abs(view.stats().desired.z) <= 2.8);
    view.reset(true); assert.equal(view.stats().zoom, 1); assert.equal(view.stats().x, initial.x);
});
test('shared texture budgets preserve color space, mipmaps and hero priority without upscaling', () => {
    const { H, T } = harness(), renderer = { capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 4 } }, manager = H.RenderAssets.create(T, renderer), scene = new T.Scene();
    const hero = new T.Texture({ width: 2048, height: 2048 }), normal = new T.Texture({ width: 2048, height: 2048 });
    const actor = new T.Mesh(new T.PlaneGeometry(), new T.MeshStandardMaterial({ map: hero, normalMap: normal })); actor.userData.actor = 'char'; scene.add(actor);
    for (let i = 0; i < 4; i++) scene.add(new T.Mesh(new T.PlaneGeometry(), new T.MeshStandardMaterial({ map: new T.Texture({ width: 2048, height: 2048 }) })));
    scene.add(new T.Mesh(new T.PlaneGeometry(), new T.MeshStandardMaterial({ map: hero })));
    const result = manager.apply(scene, H.RenderQuality.presets.smooth);
    assert.equal(result.textures, 6, 'shared hero map counted once'); assert.ok(result.textureBytes <= result.budgetBytes);
    assert.equal(hero.image.width, 2048, 'hero survives non-hero reductions'); assert.equal(hero.colorSpace, T.SRGBColorSpace);
    assert.equal(normal.colorSpace, T.NoColorSpace); assert.equal(hero.generateMipmaps, true); assert.equal(hero.minFilter, T.LinearMipmapLinearFilter); assert.equal(hero.anisotropy, 2);
    manager.apply(scene, H.RenderQuality.presets.ultra); assert.equal(hero.image.width, 2048, '4K allowance does not inflate a 2K source'); assert.equal(hero.anisotropy, 4);
    let releases = 0; const furnitureMap = scene.children[1].material.map;
    furnitureMap.addEventListener('dispose', () => releases++);
    manager.apply(scene, H.RenderQuality.presets.smooth); assert.equal(furnitureMap.image.width, 1024);
    manager.apply(scene, H.RenderQuality.presets.balanced); assert.equal(furnitureMap.image.width, 2048);
    assert.equal(releases, 2, 'dimension changes release immutable GPU allocation before reupload');
});

test('mapped PBR assets retain shared maps and LOD geometry is released once when leaving the room', () => {
    const { H, T, context } = harness();
    H.catalogs = { materialPresets: { themes: { cream: { colors: {} } }, presets: {} } };
    vm.runInContext(fs.readFileSync(path.join(root, 'apps/home3d/materials.js'), 'utf8'), context);
    const map = new T.Texture({ width: 2048, height: 2048 }), normal = new T.Texture({ width: 1024, height: 1024 }), roughness = new T.Texture({ width: 1024, height: 1024 });
    const original = new T.MeshStandardMaterial({ map, normalMap: normal, roughnessMap: roughness, roughness: .6 });
    const scene = new T.Scene(), group = new T.Group(); scene.add(group);
    const a = new T.Mesh(new T.PlaneGeometry(), original), b = new T.Mesh(new T.PlaneGeometry(), original); group.add(a, b);
    const materials = H.Materials.create('cream'); materials.apply(group, { type: 'sofa', materials: ['cream_fabric'] });
    assert.notEqual(a.material, original); assert.equal(a.material, b.material);
    assert.equal(a.material.map, map); assert.equal(a.material.normalMap, normal); assert.equal(a.material.roughnessMap, roughness); assert.equal(a.material.roughness, .6);
    const sphere = H.Shapes.sphere(group, [.1, .1, .1], [0, 0, 0], a.material), [high, low] = sphere.userData.renderLods;
    const manager = H.RenderAssets.create(T, { capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 8 } });
    manager.apply(scene, H.RenderQuality.presets.balanced);
    const camera = new T.OrthographicCamera(-1, 1, 1, -1), profile = H.RenderQuality.presets.balanced;
    manager.lod(camera, 100, profile); assert.equal(sphere.geometry, low);
    manager.lod(camera, 200, profile); assert.equal(sphere.geometry, low, 'hysteresis prevents flicker at ten pixels');
    manager.lod(camera, 300, profile); assert.equal(sphere.geometry, high);
    manager.lod(camera, 200, profile); assert.equal(sphere.geometry, high);
    const counts = new Map();
    for (const resource of [high, low, map, normal, roughness, a.material]) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) || 0) + 1));
    H.Shapes.disposeGeometry(group); for (const resource of [high, low, map, normal, roughness, a.material]) assert.equal(counts.get(resource), 1);
    assert.equal(group.parent, null); manager.dispose(); materials.dispose();
});

test('different texture priorities do not mutate a shared GLTF image source', () => {
    const { H, T } = harness(), scene = new T.Scene();
    const hero = new T.Texture({ width: 2048, height: 2048 }), furniture = hero.clone(); assert.equal(hero.source, furniture.source);
    const actor = new T.Mesh(new T.PlaneGeometry(), new T.MeshStandardMaterial({ map: hero })); actor.userData.actor = 'char'; scene.add(actor);
    scene.add(new T.Mesh(new T.PlaneGeometry(), new T.MeshStandardMaterial({ map: furniture })));
    const manager = H.RenderAssets.create(T, { capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 8 } });
    manager.apply(scene, H.RenderQuality.presets.smooth);
    assert.equal(hero.image.width, 2048); assert.equal(furniture.image.width, 1024); assert.notEqual(hero.source, furniture.source);
    manager.apply(scene, H.RenderQuality.presets.balanced); assert.equal(furniture.image.width, 2048);
});

test('GPU timing never reads unfinished results, discards disjoint samples and releases pending queries', () => {
    const { H } = harness(); let available = false, disjoint = false, next = 0, reads = 0, disposed = 0;
    const gl = { QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2, getExtension: () => ({ TIME_ELAPSED_EXT: 3, GPU_DISJOINT_EXT: 4 }), createQuery: () => ++next, beginQuery() {}, endQuery() {}, deleteQuery() { disposed++; }, getParameter: () => disjoint, getQueryParameter(q, field) { if (field === 1) return available; reads++; return 6000000; } };
    const timer = H.RenderQuality.gpuTimer(gl);
    for (let i = 0; i < 8; i++) { timer.begin(); timer.end(); }
    assert.equal(next, 3); assert.equal(timer.read(), null); assert.equal(reads, 0);
    available = true; assert.equal(timer.read(), 6); assert.equal(disposed, 1);
    disjoint = true; assert.equal(timer.read(), null); assert.equal(disposed, 3);
    timer.begin(); timer.dispose(); assert.equal(disposed, 4);
});
