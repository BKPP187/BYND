'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..'), directory = path.join(root, 'assets/home3d/characters/silver-red-v1');
const femaleDirectory = path.join(root, 'assets/home3d/characters/bunny-blue-v1');
function harness() {
    const context = vm.createContext({ window: { ByndHome3D: {} }, console, performance, AbortController });
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/vendor/home3d/engine.js'), 'utf8'), context);
    for (const file of ['data/catalogs', 'materials', 'cooking', 'furniture-visuals', 'furniture', 'rooms', 'characters', 'animation', 'expressions', 'character-models', 'sleep-pair']) vm.runInContext(fs.readFileSync(path.join(root, 'apps/home3d', file + '.js'), 'utf8'), context);
    return { H: context.window.ByndHome3D, T: context.ByndHomeEngine };
}
function model(T, modelDirectory = directory) {
    const bytes = fs.readFileSync(path.join(modelDirectory, 'far.glb')), jsonSize = bytes.readUInt32LE(12), data = JSON.parse(bytes.subarray(20, 20 + jsonSize));
    const binary = bytes.subarray(20 + jsonSize + 8), primitive = data.meshes[0].primitives[0], geometry = new T.BufferGeometry();
    const read = i => {
        const a = data.accessors[i], b = data.bufferViews[a.bufferView], offset = (b.byteOffset || 0) + (a.byteOffset || 0), size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
        const constructor = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType], result = new constructor(a.count * size), bytesPerValue = constructor.BYTES_PER_ELEMENT;
        const readValue = { 5126: 'readFloatLE', 5125: 'readUInt32LE', 5123: 'readUInt16LE', 5121: 'readUInt8' }[a.componentType], stride = b.byteStride || size * bytesPerValue;
        for (let vertex = 0; vertex < a.count; vertex++) for (let component = 0; component < size; component++) result[vertex * size + component] = binary[readValue](offset + vertex * stride + component * bytesPerValue);
        return result;
    };
    for (const [semantic, attribute, size] of [['POSITION', 'position', 3], ['NORMAL', 'normal', 3], ['TEXCOORD_0', 'uv', 2]]) geometry.setAttribute(attribute, new T.BufferAttribute(read(primitive.attributes[semantic]), size));
    geometry.setIndex(new T.BufferAttribute(read(primitive.indices), 1));
    const scene = new T.Group();
    if (!data.skins?.length) { scene.add(new T.Mesh(geometry, new T.MeshStandardMaterial())); return { scene }; }
    geometry.setAttribute('skinIndex', new T.BufferAttribute(read(primitive.attributes.JOINTS_0), 4)); geometry.setAttribute('skinWeight', new T.BufferAttribute(read(primitive.attributes.WEIGHTS_0), 4));
    const skin = data.skins[0], nodes = data.nodes.map((node, i) => skin.joints.includes(i) ? new T.Bone() : node.mesh !== undefined ? new T.SkinnedMesh(geometry, new T.MeshStandardMaterial()) : new T.Group());
    data.nodes.forEach((node, i) => { nodes[i].name = node.name || ''; if (node.translation) nodes[i].position.fromArray(node.translation); if (node.rotation) nodes[i].quaternion.fromArray(node.rotation); if (node.scale) nodes[i].scale.fromArray(node.scale); for (const child of node.children || []) nodes[i].add(nodes[child]); });
    for (const i of data.scenes[data.scene || 0].nodes) scene.add(nodes[i]); scene.updateMatrixWorld(true);
    const matrices = read(skin.inverseBindMatrices), skeleton = new T.Skeleton(skin.joints.map(i => nodes[i]), skin.joints.map((_, i) => new T.Matrix4().fromArray(matrices, i * 16)));
    nodes.find(n => n.isSkinnedMesh).bind(skeleton, new T.Matrix4()); return { scene };
}

test('cooking grips contact rotated pans and boards without stretching either character', () => {
    for (const id of ['silver-red-v1', 'bunny-blue-v1']) for (const furnitureId of ['cream_stove', 'cream_prep_counter', 'cream_kitchen_island']) for (const rotation of [0, Math.PI / 2, Math.PI]) {
        const { H, T } = harness(), actor = { root: new T.Group(), who: 'char', modelId: id, action: 'Cook', visual: 'model3d', eyes: [], path: [], startedAt: 0 };
        Object.assign(actor, H.CharacterModels.rig(model(T, path.join(root, 'assets/home3d/characters', id)), actor)); actor.root.add(actor.modelRoot);
        const anchor = H.Rooms.anchor({ id: 'cook', furnitureId, position: [1, 0, 2], rotation }, 'Cook', 'char');
        H.CharacterModels.pose(actor, 'Cook', anchor);
        assert.ok(actor.cookCycle.maxError < .012, id + ' tool hand reaches station');
        assert.ok(actor.cookCycle.maxHoldError < .012, id + ' support hand reaches handle or board');
        assert.equal(actor.cookTool.userData.mode, furnitureId === 'cream_stove' ? 'stir' : 'chop');
        for (const time of [0, 325, 650, 975, 1300, 1950]) {
            H.Animation.tick(actor, time, .016, false);
            assert.ok(Math.abs(actor.cookCycle.tipError) < .012, 'tool tip contacts food');
            assert.equal(actor.body.scale.y, 1);
        }
        H.Animation.tick(actor, 2000, .016, true); assert.equal(actor.cookTool.visible, true);
        H.CharacterModels.pose(actor, 'Idle'); assert.equal(actor.cookTool.visible, false); assert.equal(actor.cookCycle, null);
        H.Shapes.disposeGeometry(actor.root);
    }
});

test('female packages preserve 23 joints, exact offline buffers and bounded mobile LODs', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(femaleDirectory, 'manifest.json')));
    assert.equal(manifest.id, 'bunny-blue-v1');
    for (const level of manifest.levels) {
        const bytes = fs.readFileSync(path.join(femaleDirectory, level.name + '.glb')), d = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), level.sha256); assert.equal(bytes.length, level.bytes);
        assert.equal(d.skins[0].joints.length, 23); assert.ok(d.meshes[0].primitives[0].attributes.JOINTS_0 !== undefined); assert.ok(d.meshes[0].primitives[0].attributes.WEIGHTS_0 !== undefined);
        assert.ok(level.triangles <= { far: 18000, middle: 45000, near: 100000 }[level.name]); assert.ok(level.colorSize <= 2048, 'no artificial upscale of original 2K color');
        let registered; vm.runInNewContext(fs.readFileSync(path.join(femaleDirectory, level.name + '.glb.js'), 'utf8'), { window: { ByndHome3D: { CharacterModels: { registerBuffer(name, encoded, id) { assert.equal(name, level.name); assert.equal(id, 'bunny-blue-v1'); registered = Buffer.from(encoded, 'base64'); } } } } }); assert.ok(registered.equals(bytes));
    }
});

test('female uses source skin weights and measured anatomy, with book grips and feet on bedding', () => {
    const { H, T } = harness(), actor = { root: new T.Group(), who: 'user', modelId: 'bunny-blue-v1', action: 'Idle', visual: 'model3d', eyes: [], path: [] };
    const source = model(T, femaleDirectory), originalWeights = source.scene.children[0].children.find(n => n.isSkinnedMesh).geometry.attributes.skinWeight.array.slice();
    Object.assign(actor, H.CharacterModels.rig(source, actor)); actor.root.add(actor.modelRoot);
    assert.equal(actor.rigSource, 'tripo-mixamo'); assert.equal(actor.skeleton.bones.length, 23);
    const preservedWeights = actor.meshes[0].geometry.attributes.skinWeight.array;
    assert.equal(preservedWeights.length, originalWeights.length);
    for (let i = 0; i < originalWeights.length; i++) assert.equal(preservedWeights[i], originalWeights[i], 'source skin weight preserved at ' + i);
    const mesh = actor.meshes[0], weight = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < weight.count; i++) assert.ok(Math.abs(weight.getX(i) + weight.getY(i) + weight.getZ(i) + weight.getW(i) - 1) < .0001);
    H.CharacterModels.pose(actor, 'Idle'); mesh.computeBoundingBox(); const size = mesh.boundingBox.getSize(new T.Vector3()); assert.ok(size.y > 1.5 && size.z > .6, 'actual volumetric female mesh');
    const placement = { id: 'seat', furnitureId: 'cream_sofa', position: [0, 0, 0], rotation: 0 }, seat = H.Rooms.anchor(placement, 'Read', 'user');
    H.CharacterModels.pose(actor, 'Read', seat); assert.equal(actor.book.visible, true); assert.ok(actor.grips.every(samples => samples.length === 24));
    const book = actor.book.getWorldPosition(new T.Vector3()); assert.ok(book.y > seat.y + .08, 'book clears seat: ' + book.y + ' vs ' + seat.y); assert.ok(actor.book.position.z > .2, 'book stays in front of clothing');
    const bed = H.Rooms.anchor({ ...placement, furnitureId: 'cream_bed' }, 'Sleep', 'user'); H.CharacterModels.pose(actor, 'Sleep', bed);
    assert.ok(actor.boots.every(mesh => !mesh.visible)); assert.ok(actor.socks.every(group => group.visible)); assert.equal(actor.book.visible, false);
    const point = new T.Vector3();
    for (const group of actor.socks) {
        let min = Infinity; const sock = group.children[0], positions = sock.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) min = Math.min(min, point.fromBufferAttribute(positions, i).applyMatrix4(sock.matrixWorld).y);
        assert.ok(Math.abs(min - bed.quiltSurface - .006) < .003, 'each sock contacts bedding: ' + min);
    }
    H.CharacterModels.pose(actor, 'Idle'); assert.ok(actor.boots.every(mesh => mesh.visible)); assert.ok(actor.socks.every(group => !group.visible)); assert.ok(actor.skeleton.bones.every(b => b.rotation.x === 0 && b.rotation.y === 0 && b.rotation.z === 0));
    actor.root.position.set(0, 0, 0); actor.root.rotation.set(0, 0, 0); H.CharacterModels.pose(actor, 'Walk'); actor.path = [{ x: 4, z: 0 }];
    for (let frame = 0; frame < 12; frame++) {
        H.Animation.tick(actor, actor.startedAt + frame * 90, .016, false); actor.root.updateMatrixWorld(true); actor.skeleton.update();
        let sole = Infinity;
        for (const boot of actor.boots) for (const i of new Set(boot.geometry.index.array)) { boot.getVertexPosition(i, point); sole = Math.min(sole, point.applyMatrix4(boot.matrixWorld).y); }
        assert.ok(sole > -.035 && sole < .11, 'female stance shoe remains near the floor: ' + sole);
        assert.equal(actor.body.scale.y, 1); assert.equal(actor.book.visible, false);
    }
    H.Shapes.disposeGeometry(actor.root);
});

test('default female selection respects custom portraits and explicit portrait preference', () => {
    const { H } = harness(); assert.equal(H.CharacterModels.modelId({}, 'user'), 'bunny-blue-v1');
    assert.equal(H.CharacterModels.selected({ portrait: { url: 'custom' } }, 'user'), false);
    assert.equal(H.CharacterModels.selected({ modelId: 'portrait' }, 'user'), false);
    assert.equal(H.CharacterModels.selected({ modelId: 'bunny-blue-v1', portrait: { url: 'custom' } }, 'user'), true);
});
test('runtime packages retain reviewed geometry, embedded PBR and exact offline byte mirrors', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json')));
    for (const level of manifest.levels) {
        const bytes = fs.readFileSync(path.join(directory, level.name + '.glb')); assert.equal(bytes.length, level.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), level.sha256);
        const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12))); assert.equal(data.accessors[data.meshes[0].primitives[0].indices].count / 3, level.triangles);
        assert.equal(data.images.length, 3); assert.ok(data.materials[0].normalTexture); assert.ok(data.materials[0].pbrMetallicRoughness.baseColorTexture);
        let registered; vm.runInNewContext(fs.readFileSync(path.join(directory, level.name + '.glb.js'), 'utf8'), { window: { ByndHome3D: { CharacterModels: { registerBuffer(name, encoded) { assert.equal(name, level.name); registered = Buffer.from(encoded, 'base64'); } } } } }); assert.ok(registered.equals(bytes));
    }
});
test('actual male vertices receive normalized weights, retain depth, bend at seats and face the bed pillow', () => {
    const { H, T } = harness(), actor = { root: new T.Group(), action: 'Idle' }, rig = H.CharacterModels.rig(model(T), actor); Object.assign(actor, rig); actor.root.add(rig.modelRoot);
    const mesh = rig.meshes[0], weights = mesh.geometry.attributes.skinWeight, indices = mesh.geometry.attributes.skinIndex;
    for (let i = 0; i < weights.count; i++) { assert.ok(Math.abs(weights.getX(i) + weights.getY(i) - 1) < .00001); assert.ok(indices.getX(i) < rig.skeleton.bones.length && indices.getY(i) < rig.skeleton.bones.length); }
    H.CharacterModels.pose(actor, 'Idle'); mesh.computeBoundingBox(); assert.ok(mesh.boundingBox.getSize(new T.Vector3()).y > 1.3); assert.ok(mesh.boundingBox.getSize(new T.Vector3()).z > .2);
    H.CharacterModels.pose(actor, 'Sit', { x: 0, y: .62, z: 0, seated: true, seatFront: .45 });
    const seat = H.CharacterModels.geometry(actor); assert.equal(seat.kind, 'seated'); assert.ok(seat.head.y > 1); assert.ok(seat.feet.z > .3 && seat.feet.y > 0);
    let seatedSole = Infinity; const solePoint = new T.Vector3();
    for (const boot of actor.boots) for (const i of new Set(boot.geometry.index.array)) { boot.getVertexPosition(i, solePoint); seatedSole = Math.min(seatedSole, solePoint.applyMatrix4(boot.matrixWorld).y); }
    assert.ok(seatedSole >= -.01 && seatedSole < .04, 'seated soles reach the floor');
    const thighPoint = new T.Vector3();
    for (const i of new Set(mesh.geometry.index.array)) {
        const restY = mesh.geometry.attributes.position.getY(i) / 1.55;
        if (restY < .25 || restY > .45 || Math.abs(mesh.geometry.attributes.position.getX(i)) > 1.55 * .12) continue;
        mesh.getVertexPosition(i, thighPoint); thighPoint.applyMatrix4(mesh.matrixWorld);
        if (thighPoint.y < .58) assert.ok(thighPoint.z > .45, 'descending leg remains in front of cushion');
    }
    H.CharacterModels.pose(actor, 'Sleep', { x: 0, y: .89, z: 0, lying: true, poseLength: 1.7, headOffset: -1.1, headLift: .17 });
    const bed = H.CharacterModels.geometry(actor); assert.ok(bed.head.z < bed.feet.z - 1); assert.ok(bed.head.y > .89); assert.equal(bed.eyesClosed, true, 'reviewed closed-lid material is enabled');
    rig.skeleton.computeBoneTexture(); let disposed = 0; rig.skeleton.boneTexture.addEventListener('dispose', () => disposed++);
    H.Shapes.disposeGeometry(actor.root); assert.equal(disposed, 1);
});
test('explicit saved portraits remain selected unless the user chooses the packaged 3D model', () => {
    const { H } = harness();
    assert.equal(H.CharacterModels.selected({}), true); assert.equal(H.CharacterModels.selected({ portrait: { url: 'saved' } }), false);
    assert.equal(H.CharacterModels.selected({ modelId: 'portrait' }), false); assert.equal(H.CharacterModels.selected({ portrait: {}, modelId: 'silver-red-v1' }), true);
});

test('bedding contacts follow the rendered interior style rather than the catalog default', () => {
    const { H } = harness(), placement = { id: 'bed', furnitureId: 'japanese_bed', position: [0, .1, 0], rotation: 0 };
    const original = H.Furniture.get('japanese_bed'), rendered = { ...original, style: 'rose', interiorPalette: { fabric: '#d9c6bf' } };
    const raw = H.Rooms.anchor(placement, 'Sleep'), actual = H.Rooms.anchor(placement, 'Sleep', 'char', rendered), support = H.Furniture.support(rendered);
    assert.notEqual(raw.restSurface, actual.restSurface);
    assert.equal(actual.restSurface, .1 + support.restSurface); assert.equal(actual.pillowSurface, .1 + support.pillowSurface);
});

test('sleep keeps mesh volume, clears bedding, removes boots and restores the standing rig', () => {
    const { H, T } = harness(), actor = { root: new T.Group(), eyes: [], path: [], visual: 'model3d' };
    Object.assign(actor, H.CharacterModels.rig(model(T), actor)); actor.root.add(actor.modelRoot);
    const mesh = actor.meshes[0], point = new T.Vector3();
    // Inspect actual skin-deformed, indexed vertices, excluding the removed boots.
    function regionBounds(low, high) {
        const bounds = new T.Box3();
        for (const i of new Set(mesh.geometry.index.array)) {
            const y = mesh.geometry.attributes.position.getY(i) / 1.55;
            if (y < low || y >= high) continue;
            mesh.getVertexPosition(i, point); bounds.expandByPoint(point.applyMatrix4(mesh.matrixWorld));
        }
        return bounds;
    }
    H.CharacterModels.pose(actor, 'Idle'); const headSize = regionBounds(.8, 1.01).getSize(new T.Vector3());
    for (const style of Object.keys(H.catalogs.furnitureCatalog.styles)) {
        const item = H.Furniture.get(style + '_bed'), placement = { id: 'bed', furnitureId: item.id, position: [0, .1, 0], rotation: 0 };
        const anchor = H.Rooms.anchor(placement, 'Sleep'); H.CharacterModels.pose(actor, 'Sleep', anchor);
        H.Animation.tick(actor, 1200, .016, false); actor.root.updateMatrixWorld(true); actor.skeleton.update();
        assert.equal(actor.boots.every(b => !b.visible), true); assert.equal(actor.socks.every(s => s.visible), true); assert.equal(actor.bootPile.visible, true);
        assert.deepEqual([actor.body.scale.x, actor.body.scale.y, actor.body.scale.z], [1, 1, 1]);
        const torso = regionBounds(.5, .72), head = regionBounds(.8, 1.01), size = head.getSize(new T.Vector3());
        assert.ok(torso.min.y >= anchor.restSurface, style + ' torso above bedding');
        assert.ok(torso.min.y - anchor.restSurface < .04, style + ' no whole-body hover');
        assert.ok(head.min.y >= anchor.pillowSurface - .005, style + ' head above pillow');
        assert.ok(Math.abs(size.x - headSize.x) < .008 && Math.abs(size.y - headSize.z) < .008 && Math.abs(size.z - headSize.y) < .008, style + ' head keeps 3D volume');
        const feet = new T.Box3().setFromObject(actor.socks[0]);
        assert.ok(feet.min.y >= anchor.quiltSurface - .015 && feet.min.y <= anchor.quiltSurface + .025, style + ' sock contact: ' + JSON.stringify({foot:feet.min,anchor,body:actor.body.position,leg:actor.legs[0].rotation.x,footPosition:actor.knees[0].children[0].getWorldPosition(new T.Vector3())}));
        const removed = actor.bootPile.children[0], boots = new T.Box3();
        for (const i of new Set(removed.geometry.index.array)) boots.expandByPoint(point.fromBufferAttribute(removed.geometry.attributes.position, i).applyMatrix4(removed.matrixWorld));
        assert.ok(boots.min.y >= .004 && boots.min.y <= .008, style + ' removed boots on floor');
    }
    H.CharacterModels.pose(actor, 'Idle');
    assert.equal(actor.boots.every(b => b.visible), true); assert.equal(actor.socks.every(s => !s.visible), true); assert.equal(actor.bootPile.visible, false);
    actor.skeleton.bones.forEach((b, i) => { assert.ok(b.position.distanceTo(actor.restPositions[i]) < .000001); assert.ok(b.rotation.x === 0 && b.rotation.y === 0 && b.rotation.z === 0); });
    H.Shapes.disposeGeometry(actor.root);
});

test('reading props track both hands above the lap and walking bends knees without dragging the book', () => {
    const { H, T } = harness(), actor = { root: new T.Group(), eyes: [], path: [], visual: 'model3d' };
    Object.assign(actor, H.CharacterModels.rig(model(T), actor)); actor.root.add(actor.modelRoot);
    H.CharacterModels.pose(actor, 'Read', { x: 0, y: .62, z: 0, seated: true, seatFront: .45 });
    H.Animation.tick(actor, 1000, .016, false); actor.root.updateMatrixWorld(true);
    const book = new T.Box3().setFromObject(actor.book), hands = actor.grips.map(samples => {
        const center = new T.Vector3(), point = new T.Vector3();
        for (const sample of samples) { sample.mesh.getVertexPosition(sample.index, point); center.add(point.applyMatrix4(sample.mesh.matrixWorld)); }
        return center.divideScalar(samples.length);
    });
    assert.ok(book.min.y > .66, 'pages above lap rather than intersecting trousers: ' + book.min.y);
    assert.ok(book.getCenter(new T.Vector3()).distanceTo(hands[0].add(hands[1]).multiplyScalar(.5)) < .035, 'book follows grip');
    actor.root.position.set(0, .07, 0); H.CharacterModels.pose(actor, 'Walk'); actor.startedAt = 0; actor.path = [{ x: 0, z: 3 }];
    const samples = [];
    for (let frame = 0; frame < 12; frame++) {
        H.Animation.tick(actor, frame * 90, .016, false); actor.root.updateMatrixWorld(true); actor.skeleton.update();
        assert.equal(actor.book.visible, false); assert.equal(actor.phone.visible, false); assert.equal(actor.cup.visible, false);
        if (Math.abs(Math.cos(frame * 90 * .0058)) > .1) assert.ok(actor.knees.some(b => b.rotation.x > .04), 'swing knee flexes');
        const bottoms = actor.boots.map(boot => {
            let min = Infinity; const point = new T.Vector3();
            for (const i of new Set(boot.geometry.index.array)) { boot.getVertexPosition(i, point); min = Math.min(min, point.applyMatrix4(boot.matrixWorld).y); }
            return min;
        });
        const floor = Math.min(...bottoms); assert.ok(floor > -.015 && floor < .095, 'stance boot contacts floor: ' + floor);
        assert.deepEqual([actor.body.scale.x, actor.body.scale.y, actor.body.scale.z], [1, 1, 1]); samples.push(actor.legs[0].rotation.x);
    }
    assert.ok(Math.max(...samples) - Math.min(...samples) > .4, 'full stride covered');
    H.CharacterModels.pose(actor, 'Idle'); assert.equal(actor.book.visible, false); assert.ok(actor.knees.every(b => b.rotation.x === 0));
    H.Shapes.disposeGeometry(actor.root);
});

 test('reviewed sleep expressions restore on waking and crowns clear rotated bed headboards',()=>{
    const {H,T}=harness();
    for(const who of ['char','user']) {
        const id=who==='user'?'bunny-blue-v1':'silver-red-v1',actor={modelId:id,who,root:new T.Group(),eyes:[],path:[],visual:'model3d'};
        Object.assign(actor,H.CharacterModels.rig(model(T,who==='user'?femaleDirectory:directory),actor));actor.root.add(actor.modelRoot);
        for(const rotation of [0,Math.PI/2,Math.PI]) {
            const item=H.Furniture.get('cream_bed'),anchor=H.Rooms.anchor({id:'bed',furnitureId:item.id,position:[1,.1,-1],rotation},'Sleep',who,item);
            H.CharacterModels.pose(actor,'Sleep',anchor);const v=new T.Vector3();let rear=Infinity;
            for(const mesh of actor.meshes)for(const i of new Set(mesh.geometry.index.array)){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);rear=Math.min(rear,actor.root.worldToLocal(v).z);}
            assert.ok(rear>=anchor.headBoundary-.002);assert.equal(H.CharacterModels.geometry(actor).eyesClosed,true);
        }
        H.CharacterModels.pose(actor,'Idle');assert.equal(H.CharacterModels.geometry(actor).eyesClosed,false);
        H.Shapes.disposeGeometry(actor.root);
    }
 });

 test('barefoot asset has exact offline bytes and bounded mobile textures',()=>{
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'barefeet-manifest.json'),'utf8')),bytes=fs.readFileSync(path.join(directory,'barefeet.glb'));
    let mirrored;vm.runInNewContext(fs.readFileSync(path.join(directory,'barefeet.glb.js'),'utf8'),{window:{ByndHome3D:{CharacterModels:{registerBuffer(level,encoded,id){assert.equal(level,'barefeet');assert.equal(id,'silver-red-v1');mirrored=Buffer.from(encoded,'base64')}}}}});
    assert.deepEqual(bytes,mirrored);assert.ok(bytes.length<1.6e6);assert.ok(JSON.stringify(manifest).includes('a01229b3deb5ea8f92e32b34393493d941e3822e3862fdac887875451dfafd3e'));
 });

 test('shared sleep leans toward a partner, keeps bone lengths and restores solo sleep on leaving or disabling hugs',()=>{
    const {H,T}=harness(),item=H.Furniture.get('cream_bed'),actors=['char','user'].map(who=>{
        const actor={who,modelId:who==='user'?'bunny-blue-v1':'silver-red-v1',root:new T.Group(),eyes:[],path:[],visual:'model3d',level:'far'};
        Object.assign(actor,H.CharacterModels.rig(model(T,who==='user'?femaleDirectory:directory),actor));actor.root.add(actor.modelRoot);return actor;
    });
    for(const rotation of [0,Math.PI/2,Math.PI]) {
        const placement={id:'bed',furnitureId:item.id,position:[1,.1,-1],rotation},bed=new T.Group();bed.position.set(...placement.position);bed.rotation.y=rotation;
        const rows=[{model:bed,item,placement}];
        actors.forEach(a=>H.CharacterModels.pose(a,'Sleep',H.Rooms.anchor(placement,'Sleep',a.who,item)));
        const lengths=actors.map(a=>a.skeleton.bones.map(b=>b.position.length()));
        H.SleepPair.update(rows,actors,true);
        actors.forEach((a,i)=>{
            assert.equal(a.sleepPair.partner,actors[1-i].who);assert.equal(H.CharacterModels.geometry(a).eyesClosed,true);
            assert.deepEqual([a.body.scale.x,a.body.scale.y,a.body.scale.z],[1,1,1]);
            const torso=H.SleepPair.bounds(a,bed,.50,.74);
            assert.ok(torso.min.y>=a.anchor.restSurface-placement.position[1]-.005,'torso stays above mattress');
            a.skeleton.bones.forEach((bone,n)=>assert.ok(Math.abs(bone.position.length()-lengths[i][n])<1e-6,'joint length stays unchanged'));
            const facing=new T.Vector3(0,0,1).applyQuaternion(a.head.getWorldQuaternion(new T.Quaternion())).applyQuaternion(bed.getWorldQuaternion(new T.Quaternion()).invert());
            assert.ok(i===0?facing.x>.25:facing.x<-.25,'turn toward partner');
        });
        assert.ok(actors[0].sleepPair.reachError<.04,'palm reaches near shoulder: '+actors[0].sleepPair.reachError);
        const left=H.SleepPair.bounds(actors[0],bed,.75,1),right=H.SleepPair.bounds(actors[1],bed,.72,1);
        assert.ok(right.min.x-left.max.x>=.01,'hair envelopes stay separate');
        const key=bed.userData.sleepPairKey;H.SleepPair.update(rows,actors,true);assert.equal(bed.userData.sleepPairKey,key,'cached pose does not rerun each frame');
        H.CharacterModels.pose(actors[1],'Walk');H.SleepPair.update(rows,actors,true);
        assert.equal(actors[0].sleepPair,null);assert.equal(actors[1].action,'Walk');assert.equal(actors[0].action,'Sleep');
        assert.ok(actors[0].root.position.distanceTo(new T.Vector3(actors[0].anchor.x,actors[0].anchor.y,actors[0].anchor.z))<1e-6);
        H.CharacterModels.pose(actors[1],'Sleep',H.Rooms.anchor(placement,'Sleep','user',item));H.SleepPair.update(rows,actors,true);
        H.SleepPair.update(rows,actors,false);assert.ok(actors.every(a=>a.sleepPair===null&&a.action==='Sleep'));
    }
    actors.forEach(a=>H.Shapes.disposeGeometry(a.root));
 });
