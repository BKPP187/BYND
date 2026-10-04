(function (H) {
    'use strict';
    const cols = 36, rows = 42;
    function create(item, materials) {
        const T = ByndHomeEngine, [width, depth] = item.footprint, h = H.Furniture.support(item).baseHeight;
        const palette = item.interiorPalette || H.catalogs.furnitureCatalog.styles[item.style] || {};
        const material = materials.woven(palette.fabric || '#e5d7ce', 'stripe').clone();
        const geometry = new T.BufferGeometry(), count = (cols + 1) * (rows + 1), positions = new Float32Array(count * 6), uv = new Float32Array(count * 4), indices = [];
        const quilt = new T.Mesh(geometry, material), x0 = -width / 2 - .08, x1 = width / 2 + .08, z0 = -depth * .205, z1 = depth / 2 + .025;
        for (let layer = 0; layer < 2; layer++) for (let z = 0; z <= rows; z++) for (let x = 0; x <= cols; x++) {
            const i = layer * count + z * (cols + 1) + x;
            positions[i * 3] = x0 + (x1 - x0) * x / cols; positions[i * 3 + 2] = z0 + (z1 - z0) * z / rows;
            uv[i * 2] = x / cols * 2; uv[i * 2 + 1] = z / rows * 2;
        }
        for (let layer = 0; layer < 2; layer++) for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
            const a = layer * count + z * (cols + 1) + x, b = a + 1, c = a + cols + 1, d = c + 1;
            indices.push(...(layer ? [a, b, c, b, d, c] : [a, c, b, b, c, d]));
        }
        const perimeter = [];
        for (let x = 0; x <= cols; x++) perimeter.push(x);
        for (let z = 1; z <= rows; z++) perimeter.push(z * (cols + 1) + cols);
        for (let x = cols - 1; x >= 0; x--) perimeter.push(rows * (cols + 1) + x);
        for (let z = rows - 1; z > 0; z--) perimeter.push(z * (cols + 1));
        for (let i = 0; i < perimeter.length; i++) { const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length]; indices.push(a, b, a + count, b, b + count, a + count); }
        geometry.setAttribute('position', new T.BufferAttribute(positions, 3)); geometry.setAttribute('uv', new T.BufferAttribute(uv, 2)); geometry.setIndex(indices);
        quilt.castShadow = quilt.receiveShadow = true; quilt.raycast = () => {};
        quilt.name = 'sleep-quilt'; quilt.userData.ownedMaterial = material;
        quilt.userData.bedding = { count, x0, x1, z0, restZ0: z0, z1, h, surface: H.Furniture.support(item).mattressSurface, key: null, sleepers: 0 };
        fit(quilt, []); return quilt;
    }
    function fit(quilt, sleepers) {
        const T = ByndHomeEngine, b = quilt.userData.bedding, geometry = quilt.geometry, positions = geometry.attributes.position, field = new Float32Array(b.count);
        field.fill(b.surface + .025); quilt.updateWorldMatrix(true, false);
        const point = new T.Vector3();
        b.neckCuts = sleepers.map(actor=>{
            actor.root.updateMatrixWorld(true);actor.skeleton?.update();
            return actor.arms?.length ? quilt.worldToLocal(actor.arms[0].getWorldPosition(point)).z + (actor.modelId === 'bunny-blue-v1' ? .18 : .025) : b.restZ0;
        });
        const shared=sleepers.length===2&&sleepers.every(actor=>actor.sleepPair);
        b.z0=shared?Math.max(b.restZ0,...b.neckCuts):b.restZ0;
        const dx = (b.x1 - b.x0) / cols, dz = (b.z1 - b.z0) / rows;
        let neckCut = -Infinity;
        const stamp = p => {
            if (p.x < b.x0 + .04 || p.x > b.x1 - .04 || p.z < Math.max(b.z0, neckCut) || p.z > b.z1 - .035) return;
            const x = Math.floor((p.x - b.x0) / dx), z = Math.floor((p.z - b.z0) / dz);
            // Four enclosing samples clear the body by 10 mm below the 35 mm
            // quilt. Only a short, steep falloff bridges the empty space beside it.
            for(let iz=Math.max(0,z-1);iz<=Math.min(rows,z+2);iz++)for(let ix=Math.max(0,x-1);ix<=Math.min(cols,x+2);ix++) {
                if(b.z0+iz*dz<neckCut)continue;
                const falloff=Math.max(0,Math.hypot((ix-x-.5)*dx,(iz-z-.5)*dz)-Math.hypot(dx,dz))*1.8;
                const i=iz*(cols+1)+ix;field[i]=Math.max(field[i],p.y+.045-falloff);
            }
        };
        for (const [sleeperIndex, actor] of sleepers.entries()) {
            actor.root.updateMatrixWorld(true); actor.skeleton?.update();
            neckCut = shared ? b.z0 : b.neckCuts[sleeperIndex];
            const exposedArmBones=new Set(),arms=actor.sleepPair ? actor.arms : [];
            for(const arm of arms)actor.skeleton.bones.forEach((bone,i)=>{let joint=bone;while(joint&&joint!==arm)joint=joint.parent;if(joint===arm)exposedArmBones.add(i);});
            for (const mesh of [...(actor.meshes || []), ...(actor.socks || []).flatMap(group => group.children)]) {
                for (const i of new Set(mesh.geometry.index.array)) {
                    if (mesh.isSkinnedMesh) mesh.getVertexPosition(i, point); else point.fromBufferAttribute(mesh.geometry.attributes.position, i);
                    point.applyMatrix4(mesh.matrixWorld); quilt.worldToLocal(point);
                    if (mesh.isSkinnedMesh && actor.sleepPair) {
                        const ids=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
                        let armWeight=0;for(const method of ['getX','getY','getZ','getW']) if(exposedArmBones.has(ids[method](i)))armWeight+=weights[method](i);
                        if(armWeight>.45&&point.z<neckCut+.10)continue;
                    }
                    stamp(point);
                }
            }
            if (!actor.meshes?.length) {
                const center = quilt.worldToLocal(actor.root.getWorldPosition(point));
                for (let z = -.25; z < .75; z += .06) for (let x = -.18; x <= .18; x += .06) stamp(new T.Vector3(center.x + x, b.h + .4, center.z + z));
            }
        }
        // Max-preserving smoothing cannot push the cloth back into a sleeper.
        const smooth = field.slice();
        for (let z = 1; z < rows; z++) for (let x = 1; x < cols; x++) {
            let total = 0; for (let iz = z - 1; iz <= z + 1; iz++) for (let ix = x - 1; ix <= x + 1; ix++) total += field[iz * (cols + 1) + ix];
            const i = z * (cols + 1) + x; smooth[i] = Math.max(field[i], total / 9);
        }
        for (let z = 0; z <= rows; z++) for (let x = 0; x <= cols; x++) {
            const i = z * (cols + 1) + x, edge = Math.min(x, cols - x), foot = rows - z;
            const drape = edge === 0 || foot === 0 ? .17 : edge === 1 || foot === 1 ? .055 : 0;
            const folds = Math.sin(x * .72 + z * .18) * .004 + Math.sin(z * .62) * .003;
            const y = smooth[i] - drape + folds;
            positions.setY(i, y); positions.setY(i + b.count, y - .035);
            positions.setZ(i,b.z0+z*dz);positions.setZ(i+b.count,b.z0+z*dz);
        }
        positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); b.sleepers = sleepers.length;
    }
    function update(furniture, actors) {
        for (const row of furniture) {
            const quilt = row.model.getObjectByName('sleep-quilt'); if (!quilt) continue;
            const sleepers = actors.filter(a => a.root.visible && a.action === 'Sleep' && a.anchor?.placementId === row.placement.id);
            const key = sleepers.map(a => [a.who, a.modelId, a.level, a.startedAt, a.sleepPair?.partner].join(':')).join('|');
            if (key !== quilt.userData.bedding.key) { fit(quilt, sleepers); quilt.userData.bedding.key = key; }
        }
    }
    H.Bedding = { create, fit, update };
})(window.ByndHome3D);
