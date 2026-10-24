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
            monochrome: ['#91a18c', '#71866f', '#f4f1e8', '#b1bdc7'],
            cottage: ['#a9c08f', '#86a46f', '#e9b3bd', '#f1d58f'],
            caramel: ['#a9b38a', '#869b6d', '#d98b5f', '#f0c36f'],
            skylight: ['#a8c9a9', '#7fae94', '#a9d3e8', '#f5e6a8'],
            mint: ['#a5ccae', '#7db592', '#f0b9c9', '#fff1b8'],
            // Strong looks get their own planting, not just a tint.
            guofeng: ['#7d9a62', '#587a4c', '#e8a0a8', '#e5c46e'],
            nordic: ['#b3bfa3', '#8a9a7b', '#f4f1ea', '#c9c4b8'],
            retro: ['#9fb878', '#6f9a58', '#e9a23c', '#d4563c']
        };
        const [grass, leaf, flower, secondary] = tones[config.id] || tones.garden;
        return { id: config.id || 'garden', look: config.look || '', wood: config.wood || '#aa9070', trim: config.trim || '#f1ede0', cushion: config.fabric || '#e8e5d7', paving: config.trim || '#f1ede0', grass, leaf, flower, secondary };
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
    // Look-specific landscaping built from a few merged primitives.
    function dress(root, materials, palette, plan) {
        const look = palette.look; if (!look) return;
        const T = ByndHomeEngine, y0 = plan.y, mats = {};
        const mat = (type, color) => mats[type + color] ||= materials.get(type, color);
        const put = (geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) => {
            const m = new T.Mesh(geometry, material); m.position.set(x, y0 + y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; root.add(m); return m;
        };
        const cyl = (rt, rb, h, seg = 12) => new T.CylinderGeometry(rt, rb, h, seg), bx = (w, h, d) => new T.BoxGeometry(w, h, d);
        const group = name => { const g = new T.Group(); g.name = name; root.add(g); return g; };
        if (look === 'guofeng') {
            const stone = mat('matte_ceramic', '#9a9a92'), dark = mat('soft_wood', '#4c3124'), tile = mat('matte_ceramic', '#4a4d52'), red = mat('soft_wood', '#a8433a');
            // Tiled hip roof over the pergola with up-turned eaves and a red ridge.
            const roof = group('garden-pergola-roof'), cx = -1.8, cz = 6.05;
            for (const side of [-1, 1]) {
                const slab = new T.Mesh(bx(4.1, .09, 1.35), tile); slab.position.set(cx, y0 + 2.78, cz + side * .62); slab.rotation.x = -side * .42; slab.castShadow = true; roof.add(slab);
                const eave = new T.Mesh(bx(4.1, .07, .3), tile); eave.position.set(cx, y0 + 2.5 - (side > 0 ? 0 : 0) + .08, cz + side * 1.2); eave.rotation.x = -side * .2; eave.castShadow = true; roof.add(eave);
            }
            const ridge = new T.Mesh(bx(4.2, .12, .12), red); ridge.position.set(cx, y0 + 3.04, cz); roof.add(ridge);
            for (const side of [-1, 1]) { const end = new T.Mesh(cyl(.07, .07, .16, 8), red); end.rotation.z = Math.PI / 2; end.position.set(cx + side * 2.1, y0 + 3.08, cz); roof.add(end); }
            for (const px of [-3.35, -.25]) for (const pz of [5.35, 6.75]) put(cyl(.075, .075, 2.35, 12), red, px, 1.23, pz);
            // Moon gate between two low garden walls.
            const gate = group('garden-moon-gate'); gate.position.set(2.0, y0, 9.35);
            const ring = new T.Mesh(new T.TorusGeometry(.95, .09, 8, 40), stone); ring.position.y = 1.0; ring.castShadow = true; gate.add(ring);
            for (const side of [-1, 1]) { const wall = new T.Mesh(bx(1.1, 1.05, .22), mat('milky_plastic', '#efe7d6')); wall.position.set(side * 1.55, .52, 0); wall.castShadow = true; gate.add(wall); const cap = new T.Mesh(bx(1.18, .08, .28), tile); cap.position.set(side * 1.55, 1.08, 0); gate.add(cap); }
            // Stone lanterns, a koi pond and bamboo.
            for (const [x, z] of [[-5.1, 6.9], [5.2, 8.3], [1.2, 4.7]]) {
                const g = group('garden-stone-lantern'); g.position.set(x, y0, z);
                for (const [geo, py] of [[cyl(.14, .17, .1), .05], [cyl(.06, .06, .38, 8), .29], [cyl(.16, .16, .08, 6), .52]]) { const m = new T.Mesh(geo, stone); m.position.y = py; m.castShadow = true; g.add(m); }
                const glow = materials.glow('#ffd9a0', .3), light = new T.Mesh(cyl(.09, .09, .16, 6), glow); light.position.y = .64; light.userData.luminousMaterial = glow; g.add(light);
                const hat = new T.Mesh(new T.ConeGeometry(.24, .16, 6), stone); hat.position.y = .79; hat.castShadow = true; g.add(hat);
            }
            const pond = group('garden-koi-pond'); pond.position.set(1.2, y0, 7.1);
            const rim = new T.Mesh(cyl(.95, 1.0, .09, 28), stone); rim.position.y = .06; pond.add(rim);
            const water = new T.Mesh(cyl(.84, .84, .02, 28), new T.MeshStandardMaterial({ color: '#4f7f8c', roughness: .15, metalness: .1 })); water.position.y = .105; water.userData.ownedMaterial = water.material; pond.add(water);
            for (const [kx, kz, kc] of [[-.3, .2, '#e8693b'], [.35, -.25, '#f4efe3'], [.1, .45, '#e0a13a']]) { const fish = new T.Mesh(new T.SphereGeometry(.09, 8, 6), mat('cream_fabric', kc)); fish.scale.set(1, .35, 2.2); fish.position.set(kx, .13, kz); fish.rotation.y = kx * 5; pond.add(fish); }
            for (const [px, pz] of [[-6.4, 7.6], [6.4, 6.4], [-6.3, 8.4]]) for (let i = 0; i < 6; i++) {
                const a = i * 2.1, h = 1.7 + (i % 3) * .35, bxp = px + Math.sin(a) * .22, bzp = pz + Math.cos(a) * .22;
                put(cyl(.025, .03, h, 6), mat('sage', '#7d9a5a'), bxp, h / 2, bzp);
                for (let k = 1; k < 4; k++) put(new T.SphereGeometry(.13, 6, 4), mat('sage', '#6c8c4e'), bxp + Math.sin(k + i) * .08, h * k / 4 + .2, bzp, 0, 0, 0).scale.set(1, .25, .4);
            }
        } else if (look === 'nordic') {
            const gravel = mat('matte_ceramic', '#e8e5de'), concrete = mat('matte_ceramic', '#b9b8b2'), birch = mat('milky_plastic', '#f1eee6'), mark = mat('soft_wood', '#2f3337'), leaf = mat('sage', '#a8b89a');
            // Pale gravel court with concrete stepping slabs.
            put(bx(5.2, .035, 3.2), gravel, -1.5, .07, 6.1);
            for (let i = 0; i < 5; i++) put(bx(.9, .05, .9), concrete, -4.1 + i * 0, .1, 4.0 + i * .85);
            // Birch trees and tall grasses.
            for (const [x, z, h] of [[-6.0, 6.3, 3.0], [6.0, 6.5, 3.4], [5.7, 8.4, 2.7], [-6.2, 8.4, 3.1]]) {
                put(cyl(.07, .1, h, 8), birch, x, h / 2, z);
                for (let i = 0; i < 5; i++) put(bx(.15, .025, .02), mark, x + .06, .6 + i * .5, z + .03, 0, i);
                for (let i = 0; i < 4; i++) put(new T.SphereGeometry(.5 - i * .06, 8, 6), leaf, x + Math.sin(i * 2) * .25, h - .2 + i * .22, z + Math.cos(i * 2) * .25).scale.set(1, .7, 1);
            }
            for (const [x, z] of [[-1.6, 8.0], [2.5, 8.4], [-5.2, 9.2]]) {
                put(cyl(.3, .26, .4, 18), concrete, x, .27, z);
                for (let i = 0; i < 10; i++) { const a = i * .63; put(bx(.02, .6, .02), mat('sage', '#c9c6a2'), x + Math.cos(a) * .16, .75, z + Math.sin(a) * .16, Math.sin(a) * .35, 0, -Math.cos(a) * .35); }
            }
            // Low black fire bowl with a log stack.
            put(cyl(.32, .2, .22, 18), mark, -3.2, .22, 8.6);
            for (let i = 0; i < 4; i++) put(cyl(.05, .05, .8, 8), mat('soft_wood', '#8a6a4a'), 4.3, .12 + (i > 1 ? .09 : 0) , 5.1 - (i % 2) * .1 - (i > 1 ? -.05 : 0), 0, 0, Math.PI / 2);
        } else if (look === 'retro') {
            const brick = mat('matte_ceramic', '#a8553d'), white = mat('milky_plastic', '#f3eee4'), yellow = mat('soft_wood', '#e3b23c'), dark = mat('soft_wood', '#3a2a22');
            // Red brick patio in a herringbone-ish grid.
            for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) put(bx(.46, .04, .22), mat('matte_ceramic', (i + j) % 3 ? '#a8553d' : '#92472f'), -3.1 + i * .48 + (j % 2) * .12, .08, 7.9 + j * .24);
            // White picket fence along the road side.
            const fence = group('garden-picket-fence');
            for (let i = 0; i < 22; i++) { const x = -5.6 + i * .52; const pick = new T.Mesh(bx(.09, .62, .03), white); pick.position.set(x, y0 + .34, 3.95); pick.castShadow = true; fence.add(pick); const tip = new T.Mesh(new T.ConeGeometry(.05, .08, 4), white); tip.position.set(x, y0 + .69, 3.95); tip.rotation.y = Math.PI / 4; fence.add(tip); }
            for (const y of [.22, .48]) { const rail = new T.Mesh(bx(11.5, .05, .04), white); rail.position.set(0, y0 + y, 3.93); fence.add(rail); }
            // Adirondack chairs, a grill, and Edison string lights.
            for (const x of [.5, 1.3]) { const c = group('garden-adirondack'); c.position.set(x, y0, 7.6); c.rotation.y = Math.PI * .1;
                const part = (s, p, rx = 0) => { const m = new T.Mesh(bx(...s), yellow); m.position.set(...p); m.rotation.x = rx; m.castShadow = true; c.add(m); };
                part([.55, .05, .5], [0, .28, 0], -.12); part([.55, .6, .05], [0, .56, -.26], -.35); part([.06, .22, .5], [-.3, .38, 0]); part([.06, .22, .5], [.3, .38, 0]); }
            put(cyl(.3, .26, .22, 18), dark, -4.9, .66, 8.1); put(cyl(.025, .025, .5, 6), dark, -4.9, .3, 8.1);
            const glow = materials.glow('#ffd88a', .6), string = group('garden-string-lights'); string.userData.luminousMaterial = glow;
            const anchors = [[-3.35, 2.36, 5.35], [4.8, 2.7, 4.5], [-5, 1.0, 9.65], [5, 1.0, 9.65], [-.25, 2.36, 6.75]];
            const link = (a, b) => { for (let i = 0; i <= 14; i++) { const t = i / 14, sag = Math.sin(t * Math.PI) * .28; const bulb = new T.Mesh(new T.SphereGeometry(.035, 6, 5), glow); bulb.position.set(a[0] + (b[0] - a[0]) * t, y0 + a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t); string.add(bulb); } };
            link(anchors[0], anchors[4]); link(anchors[0], anchors[1]); link(anchors[2], anchors[3]);
            for (const [x, h, z] of [[4.8, 2.7, 4.5]]) put(cyl(.04, .05, h, 8), dark, x, h / 2, z);
        }
    }
    H.Garden = { populate, blocks, placements, palette, dress };
})(window.ByndHome3D);
