(function (H) {
    'use strict';
    const definitions = {
        'silver-red-v1': { height: 1.55, hips: .5, spine: .63, head: .76, shoulder: .68, armWidth: .145, armLength: .14, thighWidth: .065, knee: .25, ankle: .05, shoeCut: .145 },
        // Measured separately on the female mesh. Total height includes ears;
        // hips, neck and knees must not use the male proportions.
        'bunny-blue-v1': { height: 1.62, hips: .47, spine: .585, head: .67, shoulder: .61, armWidth: .155, armLength: .115, thighWidth: .065, knee: .22, ankle: .045, shoeCut: .10 }
    }, receivers = new Map(), pendingBuffers = new Map();
    function modelId(person, who = 'char') {
        if (person?.modelId === 'portrait' || (!person?.modelId && person?.portrait)) return 'portrait';
        return person?.modelId || (who === 'user' ? 'bunny-blue-v1' : 'silver-red-v1');
    }
    function selected(person, who) { return Object.hasOwn(definitions, modelId(person, who)); }
    function configuration(actor) { const config = definitions[actor.modelId || 'silver-red-v1']; if (!config) throw Error('人物模型无效。'); return { ...config, ...actor.rigMeasurements }; }
    function readRaw(level, id) {
        if (!['far', 'middle', 'near'].includes(level) && !(level === 'barefeet' && id === 'silver-red-v1')) return Promise.reject(new Error('人物细节档位无效。'));
        if (!Object.hasOwn(definitions, id)) return Promise.reject(new Error('人物模型无效。'));
        const base = 'assets/home3d/characters/' + id + '/', key = id + ':' + level;
        if (location.protocol !== 'file:') return fetch(base + level + '.glb').then(r => { if (!r.ok) throw new Error('3D 人物读取失败，请重试。'); return r.arrayBuffer(); });
        return new Promise((resolve, reject) => {
            const node = document.createElement('script'); let settled = false;
            const done = (error, data) => { if (settled) return; settled = true; clearTimeout(timer); if (receivers.get(key) === accept) receivers.delete(key); node.remove(); error ? reject(error) : resolve(data); };
            const timer = setTimeout(() => done(new Error('3D 人物读取超时，请重试。')), 20000);
            const accept = encoded => { try { const raw = atob(encoded), bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i); done(null, bytes.buffer); } catch (_) { done(new Error('3D 人物数据损坏。')); } }; receivers.set(key, accept);
            node.src = base + level + '.glb.js'; node.onerror = () => done(new Error('3D 人物资源缺失。'));
            node.onload = () => { if (receivers.get(key) === accept) done(new Error('3D 人物资源不完整。')); }; document.head.appendChild(node);
        });
    }
    async function read(level, id) {
        const key = id + ':' + level;
        if (pendingBuffers.has(key)) return pendingBuffers.get(key);
        const promise = readRaw(level, id); pendingBuffers.set(key, promise);
        try { return await promise; } finally { if (pendingBuffers.get(key) === promise) pendingBuffers.delete(key); }
    }
    // These starter rigs belong to the two reviewed meshes only. Neither is a
    // generic image-to-animation or production autorigger.
    function sockGeometry(T) {
        // One continuous thin foot/ankle contour, with a narrow heel and rounded
        // toes. No separate sphere sole or cylinder that reads as a shoe cover.
        const rings = [[-.054, .037, .050, .090], [-.041, .048, .053, .100], [-.014, .049, .053, .102], [.011, .041, .036, .073], [.038, .032, .005, .039], [.090, .032, 0, .034], [.152, .034, 0, .035]], segments = 20;
        const vertices = [], indices = [], uv = [];
        rings.forEach(([y, xRadius, z, zRadius], ring) => {
            for (let i = 0; i < segments; i++) { const angle = i / segments * Math.PI * 2; vertices.push(Math.cos(angle) * xRadius, y, z + Math.sin(angle) * zRadius); uv.push(i / segments, ring / (rings.length - 1)); }
        });
        for (let ring = 0; ring < rings.length - 1; ring++) for (let i = 0; i < segments; i++) {
            const a = ring * segments + i, b = ring * segments + (i + 1) % segments, c = a + segments, d = b + segments; indices.push(a, c, b, b, c, d);
        }
        for (let i = 1; i < segments - 1; i++) { indices.push(0, i, i + 1); const end = (rings.length - 1) * segments; indices.push(end, end + i + 1, end + i); }
        const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); return geometry;
    }
    function rig(gltf, actor) {
        const config = configuration(actor), height = config.height, female = actor.modelId === 'bunny-blue-v1';
        const T = ByndHomeEngine, source = gltf.scene;
        source.updateMatrixWorld(true);
        const box = new T.Box3().setFromObject(source), center = box.getCenter(new T.Vector3()), scale = height / box.getSize(new T.Vector3()).y;
        const transform = new T.Matrix4().makeRotationY(-Math.PI / 2).multiply(new T.Matrix4().makeScale(scale, scale, scale)).multiply(new T.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
        const modelRoot = new T.Group(), body = new T.Group(), bootPile = new T.Group(); modelRoot.add(body, bootPile);
        const bones = [], boots = [], socks = [], expressions = [], ankleSeams = [[], []], contact = { bodyBack: 0, sleepBack: 0, headBack: 0 }, bone = (name, position, parent) => { const b = new T.Bone(); b.name = name; b.position.set(...position); (parent || body).add(b); bones.push(b); return b; };
        let nativeSkeleton; source.traverse(node => { if (node.isSkinnedMesh) nativeSkeleton ||= node.skeleton; });
        if (female && !nativeSkeleton) throw Error('女生模型缺少已审核的骨骼绑定。');
        let hips, spine, head;
        const arms = [], legs = [], knees = [];
        if (nativeSkeleton) {
            // Keep the provider's per-vertex weights and every joint. Express
            // their measured rest positions in the game's world-axis basis so
            // the shared procedural actions do not overwrite native rest rotations.
            const positions = nativeSkeleton.bones.map(b => b.getWorldPosition(new T.Vector3()).applyMatrix4(transform));
            nativeSkeleton.bones.forEach(original => { const b = new T.Bone(); b.name = original.name; bones.push(b); });
            nativeSkeleton.bones.forEach((original, i) => {
                const parent = nativeSkeleton.bones.indexOf(original.parent);
                bones[i].position.copy(positions[i]); if (parent >= 0) bones[i].position.sub(positions[parent]);
                (parent >= 0 ? bones[parent] : body).add(bones[i]);
            });
            const joint = suffix => { const b = bones.find(b => ['mixamorig:' + suffix, 'mixamorig' + suffix, 'mixamorig_' + suffix].includes(b.name)); if (!b) throw Error('女生骨骼映射不完整。'); return b; };
            hips = joint('Hips'); spine = joint('Spine2'); head = joint('Head');
            const sides = ['Left', 'Right'].sort((a, b) => positions[bones.indexOf(joint(a + 'Arm'))].x - positions[bones.indexOf(joint(b + 'Arm'))].x);
            for (const side of sides) { arms.push(joint(side + 'Arm')); legs.push(joint(side + 'UpLeg')); knees.push(joint(side + 'Leg')); }
            actor.rigMeasurements = { hips: positions[bones.indexOf(hips)].y / height, knee: positions[bones.indexOf(knees[0])].y / height, ankle: positions[bones.indexOf(knees[0].children[0])].y / height, head: positions[bones.indexOf(head)].y / height };
        } else {
            hips = bone('hips', [0, height * config.hips, 0]); spine = bone('spine', [0, height * (config.spine - config.hips), 0], hips); head = bone('head', [0, height * (config.head - config.spine), 0], spine);
            for (const sign of [-1, 1]) {
            const upper = bone('arm' + sign, [sign * height * config.armWidth, height * (config.shoulder - config.spine), 0], spine);
            bone('forearm' + sign, [sign * height * .045, -height * config.armLength, 0], upper); arms.push(upper);
            const thigh = bone('thigh' + sign, [sign * height * config.thighWidth, 0, 0], hips);
            const knee = bone('knee' + sign, [0, height * (config.knee - config.hips), 0], thigh);
            bone('foot' + sign, [0, height * (config.ankle - config.knee), 0], knee); legs.push(thigh); knees.push(knee);
            }
        }
        body.updateMatrixWorld(true); const skeleton = new T.Skeleton(bones), meshes = [], grips = [[], []];
        const index = b => bones.indexOf(b), smooth = (a, b, y) => { const t = Math.max(0, Math.min(1, (y - a) / (b - a))); return t * t * (3 - 2 * t); };
        source.traverse(node => {
            if (!node.isMesh) return;
            const geometry = node.geometry.clone(); geometry.applyMatrix4(transform.clone().multiply(node.matrixWorld));
            const vertices = geometry.attributes.position, indices = new Uint16Array(vertices.count * 4), weights = new Float32Array(vertices.count * 4);
            if (nativeSkeleton) {
                const point = new T.Vector3(), matrix = transform.clone().multiply(node.matrixWorld);
                for (let i = 0; i < vertices.count; i++) { node.getVertexPosition(i, point); point.applyMatrix4(matrix); vertices.setXYZ(i, point.x, point.y, point.z); }
            }
            for (let i = 0; i < vertices.count; i++) {
                const x = vertices.getX(i) / height, y = vertices.getY(i) / height, side = x < 0 ? 0 : 1;
                if (y > .5 && y < .75) contact.bodyBack = Math.min(contact.bodyBack, vertices.getZ(i));
                if (y >= .75) contact.headBack = Math.min(contact.headBack, vertices.getZ(i));
                if (nativeSkeleton) {
                    const methods = ['getX', 'getY', 'getZ', 'getW'];
                    for (let k = 0; k < 4; k++) { indices[i * 4 + k] = node.geometry.attributes.skinIndex[methods[k]](i); weights[i * 4 + k] = node.geometry.attributes.skinWeight[methods[k]](i); }
                    continue;
                }
                let a = hips, b = spine, blend = smooth(.49, .61, y);
                if (y > .72) { a = spine; b = head; blend = smooth(.72, .78, y); }
                else if (Math.abs(x) > .12 && y > .29 && y < .71) { a = arms[side]; b = a.children[0]; blend = 1 - smooth(.45, .54, y); }
                else if (y < .5) { a = legs[side]; b = knees[side]; blend = 1 - smooth(.21, .31, y); if (y < .1) { a = knees[side]; b = a.children[0]; blend = 1 - smooth(.04, .1, y); } }
                indices[i * 4] = index(a); indices[i * 4 + 1] = index(b); weights[i * 4] = 1 - blend; weights[i * 4 + 1] = blend;
            }
            geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
            // The generated mesh includes boots in one primitive. Partition their
            // triangles once, preserving UVs; never flatten or recolor the body.
            const bodyIndices = [], bootIndices = [], triangles = geometry.index.array, boundary = new Uint8Array(vertices.count);
            for (let i = 0; i < triangles.length; i += 3) {
                const y = (vertices.getY(triangles[i]) + vertices.getY(triangles[i + 1]) + vertices.getY(triangles[i + 2])) / (3 * height);
                const removed = y < config.shoeCut;
                (removed ? bootIndices : bodyIndices).push(triangles[i], triangles[i + 1], triangles[i + 2]);
                for (let j = 0; j < 3; j++) boundary[triangles[i + j]] |= removed ? 1 : 2;
            }
            const bootGeometry = new T.BufferGeometry(); for (const [key, attribute] of Object.entries(geometry.attributes)) bootGeometry.setAttribute(key, attribute);
            geometry.setIndex(bodyIndices); bootGeometry.setIndex(bootIndices);
            const materials = (Array.isArray(node.material) ? node.material : [node.material]).map(m => m.clone());
            materials.forEach(material => { const state = H.Expressions?.bind(material, actor.modelId || 'silver-red-v1', height); if (state) expressions.push(state); });
            const mesh = new T.SkinnedMesh(geometry, Array.isArray(node.material) ? materials : materials[0]); mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true;
            // Picking a 180K animated triangle mesh on a phone is unnecessary.
            // A small actor hull below supplies fast character selection instead.
            mesh.raycast = () => {};
            mesh.userData.ownedMaterials = materials; mesh.userData.ownedTextures = materials.flatMap(m => Object.values(m).filter(v => v?.isTexture));
            mesh.userData.ownedSkeleton = skeleton; body.add(mesh); mesh.bind(skeleton); meshes.push(mesh);
            // Removing tall boots must not turn their height into bare shin.
            // A sleep-only morph lowers the retained hem to the real ankle;
            // waking restores the original outfit and boot junction exactly.
            const ankleY = height * (actor.rigMeasurements?.ankle ?? config.ankle), hemY = ankleY + (female ? .038 : .050), blendTop = height * (config.shoeCut + .10);
            const delta = new Float32Array(vertices.count * 3);
            for (const i of new Set(bodyIndices)) {
                const y = vertices.getY(i); if (y >= blendTop) continue;
                const t = boundary[i] === 3 ? 1 : 1 - smooth(height * config.shoeCut, blendTop, y);
                delta[i * 3 + 1] = boundary[i] === 3 ? hemY - y : (hemY - height * config.shoeCut) * t;
            }
            // Sleep drape only relaxes protruding skirt/back-hair geometry. The
            // torso, face and limbs retain their volume; the awake asset is exact.
            const drape = new Float32Array(vertices.count * 3);
            for (const i of new Set(bodyIndices)) {
                const y = vertices.getY(i) / height, z = vertices.getZ(i);
                const blend = female ? smooth(.28,.36,y) * (1-smooth(.68,.75,y)) : 0;
                const front = .075 + .085*smooth(.54,.68,y);
                const relaxed = Math.max(-.15, Math.min(front,z));
                drape[i*3+2] = (relaxed-z)*blend;
                // Loose skirt and back strands settle inward on a bed. Hands
                // and arms retain their silhouette and articulation.
                let armWeight=0;for(let k=0;k<4;k++){let joint=bones[indices[i*4+k]];while(joint&&!arms.includes(joint))joint=joint.parent;if(joint)armWeight+=weights[i*4+k];}
                const x=vertices.getX(i);
                if(female&&armWeight<.5)drape[i*3]=(Math.max(-.21,Math.min(.21,x))-x)*blend;
                if(y>.5&&y<.75)contact.sleepBack=Math.min(contact.sleepBack,z+drape[i*3+2]);
            }
            geometry.morphTargetsRelative = true;
            geometry.morphAttributes.position = [new T.Float32BufferAttribute(delta,3),new T.Float32BufferAttribute(drape,3)];
            // Recompute the changed cloth normals while retaining authored normals
            // on untouched anatomy and face vertices.
            const relaxedGeometry=geometry.clone(),relaxedPosition=relaxedGeometry.attributes.position;
            for(let i=0;i<vertices.count;i++)relaxedPosition.setXYZ(i,vertices.getX(i)+drape[i*3],vertices.getY(i),vertices.getZ(i)+drape[i*3+2]);
            relaxedGeometry.computeVertexNormals();const normalDelta=new Float32Array(vertices.count*3),restNormal=geometry.attributes.normal;
            for(let i=0;i<vertices.count;i++)if(drape[i*3]||drape[i*3+2])for(let k=0;k<3;k++)normalDelta[i*3+k]=relaxedGeometry.attributes.normal.array[i*3+k]-restNormal.array[i*3+k];
            geometry.morphAttributes.normal=[new T.Float32BufferAttribute(new Float32Array(vertices.count*3),3),new T.Float32BufferAttribute(normalDelta,3)];
            relaxedGeometry.dispose();mesh.updateMorphTargets();
            for (let i = 0; i < boundary.length; i++) if (boundary[i] === 3) ankleSeams[vertices.getX(i) < 0 ? 0 : 1].push({ mesh, index: i });
            for (const [side, sign] of [[0, -1], [1, 1]]) {
                const candidates = [], lower = [];
                const handJoint = nativeSkeleton ? bones.indexOf(arms[side].children[0].children[0]) : -1;
                for (let i = 0; i < vertices.count; i++) {
                    const x = vertices.getX(i) / height, y = vertices.getY(i) / height;
                    const handWeight = nativeSkeleton ? [0, 1, 2, 3].reduce((sum, k) => sum + (indices[i * 4 + k] === handJoint ? weights[i * 4 + k] : 0), 0) : 0;
                    if (nativeSkeleton ? handWeight > .65 : Math.sign(x) === sign && Math.abs(x) > .14 && y > .29 && y < .5) candidates.push(i);
                }
                const bottom = candidates.reduce((min, i) => Math.min(min, vertices.getY(i)), Infinity);
                candidates.forEach(i => { const y = vertices.getY(i); if (y > bottom + .015 && y < bottom + .095) lower.push(i); });
                for (let j = 0; j < Math.min(24, lower.length); j++) grips[side].push({ mesh, index: lower[Math.floor(j * lower.length / Math.min(24, lower.length))] });
            }
            const boot = new T.SkinnedMesh(bootGeometry, mesh.material); boot.frustumCulled = false; boot.castShadow = boot.receiveShadow = true; boot.raycast = () => {}; body.add(boot); boot.bind(skeleton); boots.push(boot);
            const removed = new T.Mesh(bootGeometry, mesh.material); removed.castShadow = removed.receiveShadow = true; removed.raycast = () => {}; bootPile.add(removed);
        });
        source.traverse(node => { node.geometry?.dispose(); for (const m of Array.isArray(node.material) ? node.material : [node.material]) m?.dispose(); }); nativeSkeleton?.dispose();
        const sockMaterial = new T.MeshStandardMaterial({ color: '#d7d5ce', roughness: .98 }), footGeometry = sockGeometry(T);
        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 256;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f0eee6'; ctx.fillRect(0, 0, 128, 256);
            ctx.strokeStyle = '#dedcd3'; ctx.lineWidth = 1;
            for (let x = 0; x < 128; x += 5) for (let y = 0; y < 256; y += 6) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y + 3); ctx.lineTo(x + 4, y); ctx.stroke(); }
            ctx.fillStyle = '#d3d0c5'; ctx.fillRect(0, 0, 128, 3);
            sockMaterial.map = new T.CanvasTexture(canvas); sockMaterial.map.colorSpace = T.SRGBColorSpace;
        }
        contact.footBack = footGeometry.boundingBox.min.z;
        for (const knee of knees) {
            const foot = knee.children[0], group = new T.Group(); foot.add(group); socks.push(group);
            const sock = new T.Mesh(footGeometry, sockMaterial); sock.castShadow = sock.receiveShadow = true; sock.userData.ownedMaterial = sockMaterial; sock.userData.ownedTexture = sockMaterial.map; sock.raycast = () => {}; group.add(sock);
        }
        const pickMaterial = new T.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false });
        const pickHull = new T.Mesh(new T.BoxGeometry(.52, height * .85, .32), pickMaterial); pickHull.position.y = height * .55;
        pickHull.userData.ownedMaterial = pickMaterial;
        pickHull.raycast = function (ray, hits) { if (actor.root.visible) T.Mesh.prototype.raycast.call(this, ray, hits); }; body.add(pickHull);
        const prop = (size, color, position) => {
            const material = new T.MeshStandardMaterial({ color, roughness: .8 }), mesh = new T.Mesh(new T.BoxGeometry(...size), material);
            mesh.position.set(...position); mesh.userData.ownedMaterial = material; mesh.visible = false; body.add(mesh); return mesh;
        };
        const book = new T.Group(); body.add(book); book.visible = false;
        const pageMaterial = new T.MeshStandardMaterial({ color: '#f3eee1', roughness: .9 }), coverMaterial = new T.MeshStandardMaterial({ color: '#a48698', roughness: .85 });
        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 384;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f4efe3'; ctx.fillRect(0, 0, 256, 384);
            ctx.fillStyle = '#746959'; ctx.font = '18px serif'; ctx.fillText('Little days', 32, 48);
            ctx.fillStyle = '#b1a391'; for (let line = 0; line < 15; line++) ctx.fillRect(30, 80 + line * 16, line % 5 === 4 ? 116 : 192, 2);
            pageMaterial.map = new T.CanvasTexture(canvas); pageMaterial.map.colorSpace = T.SRGBColorSpace;
        }
        for (const side of [-1, 1]) {
            for (const [size, y, material] of [[[.165, .012, .21], 0, coverMaterial], [[.15, .018, .19], .016, pageMaterial]]) {
                const part = new T.Mesh(new T.BoxGeometry(...size), material); part.position.set(side * .083, y, 0); part.rotation.z = side * .10; part.castShadow = true; part.userData.ownedMaterial = material; part.userData.ownedTexture = material.map; part.raycast = () => {}; book.add(part);
            }
        }
        const binding = new T.Mesh(new T.BoxGeometry(.014, .025, .21), coverMaterial); binding.position.y = -.002; binding.userData.ownedMaterial = coverMaterial; binding.raycast = () => {}; book.add(binding);
        book.rotation.x = -.25;
        const phone = prop([.085, .15, .018], '#a9b4be', [.17, height * .6, .20]);
        const cup = prop([.085, .10, .085], '#ddd2c2', [.17, height * .6, .25]);
        const restPositions = bones.map(b => b.position.clone());
        return { modelRoot, body, head, arms, legs, knees, hips, skeleton, meshes, book, phone, cup, cookTool: null, cookCycle: null, boots, socks, bootPile, contact, restPositions, grips, expressions, ankleSeams, modelHeight: height, navigationRadius: female ? .52 : .38, rigSource: nativeSkeleton ? 'tripo-mixamo' : 'local-starter' };
    }
    function fitBarefoot(model, mesh, side, female) {
        const T = ByndHomeEngine, geometry = mesh.geometry, positions = geometry.attributes.position;
        const indices = geometry.index.array, skin = [], edge = new Uint8Array(positions.count), scale = female ? .85 : 1;
        // The generated asset includes a male trouser cuff. Keep only genuine
        // foot/ankle skin for both avatars; never attach a second pants segment.
        for (let i = 0; i < indices.length; i += 3) {
            const retained = [indices[i], indices[i + 1], indices[i + 2]].every(v => positions.getY(v) <= .044);
            if (retained) skin.push(indices[i], indices[i + 1], indices[i + 2]);
            for (let j = 0; j < 3; j++) edge[indices[i + j]] |= retained ? 1 : 2;
        }
        geometry.setIndex(skin); geometry.scale(scale, scale, scale);
        model.meshes.forEach(m => { m.morphTargetInfluences[0] = 1; });
        model.modelRoot.updateMatrixWorld(true); model.skeleton.update();
        const ankle = model.socks[side], seam = new T.Box3(), point = new T.Vector3();
        // Derive the joint from the exact edge left after removing this LOD's
        // boots. Bone height alone leaves a gap below the retained trouser hem.
        for (const sample of model.ankleSeams[side]) {
            sample.mesh.getVertexPosition(sample.index, point); point.applyMatrix4(sample.mesh.matrixWorld); ankle.worldToLocal(point); seam.expandByPoint(point);
        }
        if (seam.isEmpty()) throw Error('人物脚踝接缝缺失，不能安装光脚。');
        const upper = new T.Box3(), drawn = new Set(skin);
        for (const i of drawn) if (positions.getY(i) >= .025 * scale) upper.expandByPoint(point.fromBufferAttribute(positions, i));
        if (upper.isEmpty()) throw Error('光脚模型缺少可连接的脚踝。');
        const sourceCenter = upper.getCenter(new T.Vector3()), targetCenter = seam.getCenter(new T.Vector3());
        const base = .010 * scale, top = upper.max.y, targetTop = seam.max.y + .025, originalNormals = geometry.attributes.normal.clone();
        const deformed = new Set();
        // Extend just the ankle into the actual leg opening. Toes, heel, sole,
        // foot length and leg/body scale remain unchanged. The overlap is buried
        // inside the original leg, so it survives bends and camera rotation.
        for (const i of drawn) {
            // Place the whole foot under the opening. Moving only the upper skin
            // sideways bends the ankle into a rod while leaving the toes behind.
            positions.setX(i, positions.getX(i) + targetCenter.x - sourceCenter.x);
            positions.setZ(i, positions.getZ(i) + targetCenter.z - sourceCenter.z);
            const y = positions.getY(i); if (y <= base) continue; deformed.add(i);
            const t = edge[i] === 3 ? 1 : Math.min(1, (y - base) / (top - base));
            positions.setY(i, base + (targetTop - base) * t);
        }
        positions.needsUpdate = true; geometry.computeVertexNormals();
        // Keep the reviewed foot shading below the ankle, and smooth the new
        // ankle across duplicate UV vertices without merging/remapping UVs.
        const normals = geometry.attributes.normal, sums = new Map(), key = i => [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v * 1e5)).join(':');
        for (const i of deformed) { const k = key(i), sum = sums.get(k) || new T.Vector3(); sum.add(point.fromBufferAttribute(normals, i)); sums.set(k, sum); }
        for (const i of drawn) {
            const normal = deformed.has(i) ? sums.get(key(i)).normalize() : point.fromBufferAttribute(originalNormals, i);
            normals.setXYZ(i, normal.x, normal.y, normal.z);
        }
        normals.needsUpdate = true; geometry.computeBoundingSphere(); geometry.computeBoundingBox();
        geometry.boundingBox.makeEmpty();
        for (const i of drawn) geometry.boundingBox.expandByPoint(point.fromBufferAttribute(positions, i));
        mesh.userData.ankleJoin = { overlap: .025, seam: { min: seam.min.toArray(), max: seam.max.toArray() }, top: targetTop, skinOnly: true };
        mesh.userData.ankleRim = [...drawn].filter(i => edge[i] === 3);
        model.meshes.forEach(m => { m.morphTargetInfluences[0] = 0; });
    }
    async function load(level, actor) {
        const T = ByndHomeEngine, bytes = await read(level, actor.modelId), model = rig(await new T.GLTFLoader().parseAsync(bytes, ''), actor);
        try {
            const feet = await new T.GLTFLoader().parseAsync(await read('barefeet', 'silver-red-v1'), '');
            for (const [side, name] of [[0, 'left'], [1, 'right']]) {
                const node = feet.scene.getObjectByName('barefoot-' + name), mesh = node?.isMesh ? node : node?.children.find(child => child.isMesh);
                if (!mesh) throw Error('光脚资源不完整。');
                const group = model.socks[side]; group.children.slice().forEach(child => H.Shapes.disposeGeometry(child)); group.clear();
                mesh.removeFromParent(); mesh.castShadow = mesh.receiveShadow = true; mesh.raycast = () => {};
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                mesh.userData.ownedMaterials = materials; mesh.userData.ownedTextures = materials.flatMap(m => Object.values(m).filter(v => v?.isTexture));
                fitBarefoot(model, mesh, side, actor.modelId === 'bunny-blue-v1');
                group.add(mesh);
                model.contact.footBack = Math.min(model.contact.footBack, mesh.geometry.boundingBox.min.z);
            }
            model.footAsset = 'tripo-barefoot'; return model;
        } catch (error) { H.Shapes.disposeGeometry(model.modelRoot); throw error; }
    }
    function attach(actor, model, level) {
        const previous = actor.modelRoot || actor.body; actor.root.add(model.modelRoot); Object.assign(actor, model, { level });
        H.Shapes.disposeGeometry(previous); pose(actor, actor.action, actor.anchor); actor.needsAssetQuality = true;
    }
    async function create(who, profile, id = who === 'user' ? 'bunny-blue-v1' : 'silver-red-v1') {
        const T = ByndHomeEngine, root = new T.Group(); root.userData.actor = who;
        const actor = { who, root, body: new T.Group(), eyes: [], phone: new T.Group(), book: new T.Group(), cup: new T.Group(), visual: 'model3d', modelId: id, action: 'Idle', path: [], destination: null, anchor: null, startedAt: 0, level: null, loading: false, released: false, failureLevel: null };
        root.add(actor.body);
        attach(actor, await load(profile.tier === 'smooth' ? 'far' : 'middle', actor), profile.tier === 'smooth' ? 'far' : 'middle'); return actor;
    }
    function pose(actor, action, anchor) {
        const config = configuration(actor), height = config.height;
        actor.sleepPair = null; actor.action = action; actor.anchor = anchor || null; actor.startedAt = performance.now();
        actor.expressions?.forEach(expression => { expression.value = action === 'Sleep' ? 1 : 0; });
        actor.body.rotation.set(0, 0, 0); actor.body.position.set(0, 0, 0); actor.body.scale.set(1, 1, 1);
        actor.skeleton.bones.forEach((b, i) => b.position.copy(actor.restPositions[i]));
        actor.skeleton.bones.forEach(b => b.rotation.set(0, 0, 0));
        actor.book.visible = action === 'Read'; actor.phone.visible = action === 'Use Phone'; actor.cup.visible = ['Drink', 'Eat'].includes(action);
        const shoesOff = !!anchor?.lying;
        actor.meshes.forEach(m => { m.morphTargetInfluences[0] = shoesOff ? 1 : 0; m.morphTargetInfluences[1] = shoesOff ? 1 : 0; });
        actor.boots.forEach(mesh => { mesh.visible = !shoesOff; }); actor.socks.forEach(group => { group.visible = shoesOff; }); actor.bootPile.visible = shoesOff;
        if (anchor) {
            actor.root.position.set(anchor.x, anchor.y, anchor.z); actor.root.rotation.y = anchor.rotation || 0;
            if (anchor.lying) {
                actor.body.rotation.x = -Math.PI / 2;
                const surface = anchor.restSurface ?? anchor.y, pillow = anchor.pillowSurface ?? anchor.y + (anchor.headLift || 0);
                // Match actual back-of-body mesh bounds to the bedding surface.
                // Bone origins alone cannot detect a chest or head buried in it.
                const restY = surface - actor.contact.sleepBack + .006;
                // A pillow raises the head independently. Lifting the entire
                // rigid body to clear hair left the legs floating over the quilt.
                actor.head.position.z += Math.max(0, pillow - actor.contact.headBack + .006 - restY);
                const headAligned = (anchor.pillowOffset ?? anchor.headOffset ?? -.8) + height * (actor.modelId === 'bunny-blue-v1' ? .76 : .87);
                // Include the crown/ears, not only the head bone, when clearing
                // the headboard or sofa arm. The body retains its full scale.
                actor.body.position.set(0, restY - anchor.y, Math.max(headAligned, (anchor.headBoundary ?? -Infinity) + height));
                // Let the feet settle onto the quilt through a small hip bend,
                // maintaining bone lengths and the full volume of the mesh.
                const quilt = anchor.quiltSurface ?? surface;
                const gap = Math.max(0, restY + actor.contact.footBack - quilt - .006);
                actor.legs.forEach(b => { b.rotation.x = Math.asin(Math.min(actor.modelId === 'bunny-blue-v1' ? .65 : .2, gap / (height * .45))); });
                actor.arms.forEach((b, i) => { b.rotation.z = i ? -.18 : .18; });
                actor.bootPile.position.set(0, .006 - anchor.y, (anchor.poseLength || 1.7) * .7 + .45);
            }
            else if (anchor.seated) {
                // Shorter characters need a sloped thigh to reach the floor;
                // forcing every seat into a 90-degree knee leaves boots hovering.
                const thigh = height * (config.hips - config.knee), shin = height * config.knee;
                const drop = anchor.y - shin - .012, angle = Math.acos(Math.max(0, Math.min(1, drop / thigh)));
                // Keep the descending thigh beyond the cushion edge, with the
                // back of the pelvis still supported. Knee position alone would
                // leave the upper leg hidden inside the seat volume.
                actor.body.position.set(0, -height * config.hips, Math.max(0, (anchor.seatFront || 0) + (actor.modelId === 'bunny-blue-v1' ? .10 : .04)));
                actor.legs.forEach(b => { b.rotation.x = -angle; }); actor.knees.forEach(b => { b.rotation.x = angle; });
            }
        }
        if (['Read', 'Use Phone', 'Work', 'Use Computer', 'Game', 'Drink', 'Eat'].includes(action)) actor.arms.forEach(b => { b.rotation.x = -.65; });
        if (action === 'Read') actor.arms.forEach((b, i) => { const female = actor.modelId === 'bunny-blue-v1'; b.rotation.x = female ? -.6 : -.32; b.rotation.z = (i ? -1 : 1) * (female ? .9 : .50); b.children[0].rotation.x = female ? -1.4 : -1.55; });
        if (action === 'Cook') actor.arms.forEach((b, i) => { b.rotation.x = -.55; b.rotation.z = i ? -.12 : .12; b.children[0].rotation.x = -.65; });
        if (action === 'Hug') actor.arms.forEach((b, i) => { b.rotation.x = -.9; b.rotation.z = i ? .35 : -.35; });
        if (['Wave', 'Happy'].includes(action)) actor.arms[1].rotation.z = -1.8;
        if (anchor?.lying) settleFeet(actor, (anchor.quiltSurface ?? anchor.restSurface ?? anchor.y) + .006);
        actor.root.updateMatrixWorld(true); actor.skeleton.update(); H.Cooking?.prepare(actor); updateProps(actor);
    }
    function settleFeet(actor, surface) {
        // Solve each measured leg against actual sock vertices. The hair and
        // puffy sleeves can lift the back; a fixed male hip angle leaves feet
        // floating. This bends joints without stretching the body or its legs.
        const T = ByndHomeEngine, point = new T.Vector3();
        for (let side = 0; side < 2; side++) {
            const sock = actor.socks[side].children[0], positions = sock.geometry.attributes.position, indices = new Set(sock.geometry.index.array);
            const sole = angle => {
                actor.legs[side].rotation.x = angle; actor.root.updateMatrixWorld(true);
                let min = Infinity;
                for (const i of indices) { point.fromBufferAttribute(positions, i).applyMatrix4(sock.matrixWorld); min = Math.min(min, point.y); }
                return min;
            };
            let low = 0, high = .9;
            if (sole(low) <= surface) continue;
            if (sole(high) > surface) continue;
            for (let i = 0; i < 12; i++) { const mid = (low + high) / 2; if (sole(mid) > surface) low = mid; else high = mid; }
            sole((low + high) / 2);
        }
    }
    function updateProps(actor) {
        const height = configuration(actor).height;
        if (!actor.book.visible) return;
        actor.root.updateMatrixWorld(true);
        const T = ByndHomeEngine, hands = actor.grips.map((samples, i) => {
            if (!samples.length) return actor.arms[i].children[0].localToWorld(new T.Vector3(0, -height * .17, .025));
            const sum = new T.Vector3(), point = new T.Vector3();
            for (const sample of samples) { sample.mesh.getVertexPosition(sample.index, point); sum.add(point.applyMatrix4(sample.mesh.matrixWorld)); }
            return sum.multiplyScalar(1 / samples.length);
        });
        const grip = actor.body.worldToLocal(hands[0].add(hands[1]).multiplyScalar(.5));
        actor.book.position.copy(grip); actor.book.position.y -= .012;
    }
    function update(actor, camera, viewport, profile, onNotice) {
        if (!actor.root.visible || actor.loading || actor.released) return;
        const pixels = configuration(actor).height * viewport / (camera.top - camera.bottom) * profile.renderScale;
        const level = pixels > (actor.level === 'near' ? 300 : 370) && profile.tier !== 'smooth' ? 'near' : pixels > (actor.level === 'middle' ? 150 : 180) ? 'middle' : 'far';
        if (level === actor.level || level === actor.failureLevel) return;
        actor.loading = true;
        load(level, actor).then(model => {
            if (actor.released || !actor.root.parent) { H.Shapes.disposeGeometry(model.modelRoot); return; }
            attach(actor, model, level); actor.failureLevel = null;
        }).catch(() => { actor.failureLevel = level; if (!actor.released) onNotice('人物细节暂时加载失败，当前 3D 人物已保留。'); }).finally(() => { actor.loading = false; });
    }
    function geometry(actor) {
        actor.root.updateMatrixWorld(true);
        const point = bone => { const p = bone.getWorldPosition(new ByndHomeEngine.Vector3()); return { x: p.x, y: p.y, z: p.z }; };
        return { sleepPair: actor.sleepPair ? { ...actor.sleepPair, hand: actor.sleepPair.arm == null ? null : H.SleepPair.hand(actor, actor.sleepPair.arm).toArray() } : null, kind: actor.anchor?.lying ? 'lying' : actor.anchor?.seated ? 'seated' : 'standing', visual: 'model3d', modelId: actor.modelId || 'silver-red-v1', rigSource: actor.rigSource, skinned: true, bones: actor.skeleton.bones.length, level: actor.level, head: point(actor.head), feet: point(actor.knees[0].children[0]), depthTest: true, eyesClosed: actor.action === 'Sleep' && !!actor.expressions?.length && actor.expressions.every(e => e.value === 1), footAsset: actor.footAsset || 'procedural', navigationRadius: actor.navigationRadius, shoesOff: !actor.boots[0]?.visible, bodyScale: { x: actor.body.scale.x, y: actor.body.scale.y, z: actor.body.scale.z }, contact: { ...actor.contact } };
    }
    H.CharacterModels = { settleFeet, selected, modelId, create, pose, update, updateProps, geometry, rig, registerBuffer: (level, bytes, id = 'silver-red-v1') => receivers.get(id + ':' + level)?.(bytes) };
})(window.ByndHome3D);
