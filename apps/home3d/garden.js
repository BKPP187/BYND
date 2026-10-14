(function (H) {
    'use strict';
    const trees = [[-6.45, 5.1, 1], [-6.35, 9.65, .88], [6.2, 9.7, 1], [6.3, 4.9, .84]];
    function palette(config = {}) {
        const tones = {
            garden: ['#a9bf91', '#8fa878', '#deb0b7', '#efcc8c'],
            palace: ['#a5b394', '#829574', '#f3eee4', '#c9af79'],
            botanical: ['#8da57b', '#647f59', '#e7d8ac', '#aeaa84'],
            rose: ['#a7b794', '#8b9e7c', '#cb8d9c', '#edd0ce'],
            natural: ['#99ae86', '#738b66', '#edead7', '#c5b384'],
            pink: ['#b4c9a4', '#91af8d', '#e5a9c3', '#faf0e6'],
            monochrome: ['#91a18c', '#71866f', '#f4f1e8', '#b1bdc7']
        };
        const [grass, leaf, flower, secondary] = tones[config.id] || tones.garden;
        return { id: config.id || 'garden', wood: config.wood || '#aa9070', trim: config.trim || '#f1ede0', cushion: config.fabric || '#e8e5d7', paving: config.trim || '#f1ede0', grass, leaf, flower, secondary };
    }
    const blocks = () => [...trees.map(([x, z]) => ({ x, z, width: .7, depth: .7 })), { x: -1.8, z: 5.75, width: 2.15, depth: .7 }, ...[-3.35, -.25].flatMap(x => [5.35, 6.75].map(z => ({ x, z, width: .16, depth: .16 })))];
    function placements() {
        const bushes = [], grass = [], purple = [], yellow = [], saplings = [[-5.6, 7, .9], [5.85, 7.65, 1.1]];
        for (let i = 0; i < 18; i++) {
            const x = -6.2 + i * .72, z = 10.0 + Math.sin(i * 2.4) * .07;
            bushes.push([x, z, .7 + (i % 3) * .12]);
        }
        for (let side of [-1, 1]) for (let i = 0; i < 9; i++) bushes.push([side * 6.8 - .1, 4.35 + i * .61, .65 + i % 3 * .1]);
        for (let i = 0; i < 84; i++) {
            const side = i % 2 ? -1 : 1, z = 4.4 + (i % 21) * .265, x = side * (5.9 + Math.sin(i * 2.4) * .62) - .1;
            grass.push([x, z, .7 + i % 3 * .12]);
            (i % 3 ? purple : yellow).push([x + .2 * Math.cos(i), z + .11, .85 + i % 3 * .12]);
        }
        return { tree_oak: trees, tree_small: saplings, plant_bushDetailed: bushes, grass_leafsLarge: grass, flower_purpleA: purple, flower_yellowA: yellow };
    }
    async function populate(parent, materials, isCurrent = () => true, home = {}) {
        const T = ByndHomeEngine, group = new T.Group(); group.name = 'garden-kenney-nature';
        const colors = palette(H.Interiors.resolve(H.Rooms.get('garden'), home)); group.userData.gardenPalette = colors;
        const dimensions = { tree_oak: [1.55, 2.65], tree_small: [1.0, 1.6], plant_bushDetailed: [.68, .65], grass_leafsLarge: [.29, .22], flower_purpleA: [.21, .36], flower_yellowA: [.20, .32] };
        const rows = Object.entries(placements()), results = await Promise.allSettled(rows.map(([id]) => H.Furniture.load({ id: 'garden-' + id, model: 'garden-' + id + '.glb', keepMaterials: true, type: 'prop', width: dimensions[id][0], height: dimensions[id][1], footprint: dimensions[id], materials: ['sage'], style: 'cream' }, materials)));
        const models = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        if (results.some(r => r.status === 'rejected') || !isCurrent()) {
            models.forEach(m => H.Shapes.disposeGeometry(m)); throw Error('花园植物暂时没能加载，请重新进入小屋。');
        }
        const transform = new T.Object3D(), matrix = new T.Matrix4();
        results.forEach((result, index) => {
            const model = result.value, [id, places] = rows[index]; model.updateMatrixWorld(true);
            model.traverse(mesh => {
                if (!mesh.isMesh) return;
                // Keep the pack's separate bark, leaf and flower materials;
                // tint only foliage/bark to the home's muted garden palette.
                if (/leaf|grass/i.test(mesh.material.name)) mesh.material.color.set(colors.leaf);
                if(mesh.material.name==='woodBark')mesh.material.color.set(colors.wood);
                if (/flower|petal|purple|yellow/i.test(mesh.material.name)) mesh.material.color.set(id.includes('yellow') ? colors.secondary : colors.flower);
                const batch = new T.InstancedMesh(mesh.geometry, mesh.material, places.length); batch.name = 'garden-' + id;
                batch.userData.ownedMaterials = mesh.userData.ownedMaterials; batch.userData.ownedTextures = mesh.userData.ownedTextures;
                places.forEach(([x, z, scale], i) => {
                    transform.position.set(x, .07, z); transform.scale.setScalar(scale); transform.rotation.y = i * 2.4; transform.updateMatrix();
                    batch.setMatrixAt(i, matrix.multiplyMatrices(transform.matrix, mesh.matrixWorld));
                });
                batch.castShadow = batch.receiveShadow = true; batch.computeBoundingSphere(); group.add(batch);
            });
        });
        group.userData.gardenAssets = { source: 'Kenney Nature Kit (CC0)', instances: rows.reduce((n, r) => n + r[1].length, 0), batches: group.children.length };
        parent.add(group); return group;
    }
    H.Garden = { populate, blocks, placements, palette };
})(window.ByndHome3D);
