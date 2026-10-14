(function (H) {
    'use strict';
    // Local room saves stay local; only the displayed floor uses world coordinates.
    const levels = [
        [['living_room', -4.1, .8], ['dining_room', 3.9, .8], ['kitchen', 3.9, -5], ['stair_hall', -4.1, -5], ['hallway', -.1, -2.1], ['garden', -.1, 7.1]],
        [['bedroom', -4.1, .8], ['game_room', 3.9, .8], ['bathroom', 3.9, -5], ['landing', -4.1, -5], ['upper_hallway', -.1, -2.1], ['balcony', -4.1, 5.2], ['greenhouse', 3.9, 5.2], ['terrace', -.1, 8.4]]
    ];
    const links = [
        [['living_room', 'hallway', -.8, 2.6, 'x'], ['dining_room', 'hallway', .6, 2.6, 'x'], ['kitchen', 'hallway', .6, -3.1, 'x'], ['stair_hall', 'hallway', -.8, -3.1, 'x'], ['living_room', 'garden', -4.1, 3.6, 'z'], ['dining_room', 'garden', 3.9, 3.6, 'z']],
        [['bedroom', 'upper_hallway', -.8, 2.6, 'x'], ['game_room', 'upper_hallway', .6, 2.6, 'x'], ['bathroom', 'upper_hallway', .6, -3.1, 'x'], ['landing', 'upper_hallway', -.8, -3.1, 'x'], ['bedroom', 'balcony', -3, 3.6, 'z'], ['game_room', 'greenhouse', 1.4, 3.6, 'z'], ['balcony', 'terrace', -3, 6.8, 'z'], ['greenhouse', 'terrace', 3.9, 6.8, 'z']]
    ];
    const floorOf = id => levels.findIndex(rows => rows.some(r => r[0] === id));
    function plan(id) {
        const level = floorOf(id); if (level < 0) return null;
        const nodes = levels[level].map(([id, x, z]) => ({ id, x, z, room: H.Rooms.get(id), width: H.Rooms.get(id).size[0], depth: H.Rooms.get(id).size[1] }));
        const doors = links[level].map(([a, b, x, z, axis]) => ({ a, b, x, z, axis, width: 1.75 }));
        const size = [16.4, 23]; size.regions = nodes; size.villa = true;
        const result = { level, y: level * 3.2, nodes, doors, size, walls: [] };
        for (const node of nodes) for (const side of ['left', 'right', 'back', 'front']) {
            const axis = ['left', 'right'].includes(side) ? 'x' : 'z', span = axis === 'x' ? node.depth : node.width;
            const coordinate = axis === 'x' ? node.x + (side === 'left' ? -1 : 1) * node.width / 2 : node.z + (side === 'back' ? -1 : 1) * node.depth / 2;
            const center = axis === 'x' ? node.z : node.x;
            const gaps = doors.filter(d => [d.a, d.b].includes(node.id) && d.axis === axis && Math.abs(d[axis] - coordinate) < .25).map(d => [d[axis === 'x' ? 'z' : 'x'] - d.width / 2, d[axis === 'x' ? 'z' : 'x'] + d.width / 2]).sort((a, b) => a[0] - b[0]);
            // Garden/terrace have open boundaries where the internal passage ends.
            if (['garden', 'terrace'].includes(node.id) && side === 'back') gaps.push([-.8, .6]);
            gaps.sort((a,b) => a[0] - b[0]); let from = center - span / 2;
            for (const [a, b] of [...gaps, [center + span / 2, center + span / 2]]) {
                const end = Math.min(a, center + span / 2);
                if (end - from > .02) result.walls.push({ room: node.id, side, axis, x: axis === 'x' ? coordinate : (from + end) / 2, z: axis === 'z' ? coordinate : (from + end) / 2, width: axis === 'x' ? .09 : end - from, depth: axis === 'z' ? .09 : end - from });
                from = Math.max(from, b);
            }
        }
        return result;
    }
    function nodeAt(plan, point) {
        return plan?.nodes.find(n => Math.abs(point.x - n.x) <= n.width / 2 + .01 && Math.abs(point.z - n.z) <= n.depth / 2 + .01);
    }
    function translate(plan, roomId, p, world = true) {
        const n = plan.nodes.find(n => n.id === roomId), sign = world ? 1 : -1;
        return [p[0] + n.x * sign, p[1] + plan.y * sign, p[2] + n.z * sign];
    }
    function blocks(plan) {
        const beds = plan.level ? [[1.6, 5.9], [6.2, 5.9], [-6.4, 5.75], [-5.8, 8.4], [5.8, 8.4]] : [[-5.8, 8.7], [.7, 8.7], [5.8, 8.7]];
        return [...plan.walls.map(w => ({ x: w.x, z: w.z, width: w.width, depth: w.depth })), { x: -5.15, z: -5.1, width: 2.85, depth: 3.0 }, ...beds.map(([x,z]) => ({ x, z, width: 1.75, depth: .8 })), ...(plan.level ? [] : [{ x: 3.3, z: 6.25, width: 2.45, depth: 1.2 }, ...(H.Garden?.blocks() || [])])];
    }
    function instanceStatic(root) {
        const T = ByndHomeEngine, groups = new Map();
        for (const mesh of root.children) {
            if (!mesh.isMesh || mesh.isInstancedMesh || mesh.userData.floor || mesh.userData.villaWall || mesh.material.transparent || mesh.geometry.type !== 'RoundedBoxGeometry') continue;
            const key = mesh.material.uuid + JSON.stringify(mesh.geometry.parameters) + JSON.stringify(mesh.userData.wallFinish || null);
            if (!groups.has(key)) groups.set(key, []); groups.get(key).push(mesh);
        }
        for (const meshes of groups.values()) if (meshes.length >= 3) {
            const batch = new T.InstancedMesh(meshes[0].geometry, meshes[0].material, meshes.length);
            if(meshes[0].userData.wallFinish)batch.userData.wallFinish=meshes[0].userData.wallFinish;
            if(meshes[0].userData.luminousMaterial)batch.userData.luminousMaterial=meshes[0].userData.luminousMaterial;
            meshes.forEach((mesh,i) => { mesh.updateMatrix(); batch.setMatrixAt(i,mesh.matrix); mesh.removeFromParent(); if (i) mesh.geometry.dispose(); });
            batch.castShadow = batch.receiveShadow = true; batch.computeBoundingSphere(); root.add(batch);
        }
    }
    function staircase(plan, materials) {
        const T = ByndHomeEngine, group = new T.Group(), wood = materials.get('soft_wood', '#b49a77'), trim = materials.get('milky_plastic', '#f1e9da');
        group.name = 'villa-real-staircase'; group.userData.stairs = true;
        const part = (size, pos, mat = wood) => H.Shapes.rounded(group, size, pos, mat, .012);
        if (plan.level) {
            // Keep the lower landing/shaft as part of the stair core. Loading
            // only the upper floor must not expose the outside background
            // through the stairwell in place of the downstairs walls/floor.
            part([6.6,.18,5.6],[-4.1,-.034,-5]);
            part([6.6,3.2,.09],[-4.1,1.65,-7.8],trim);
            part([.09,3.2,5.6],[-7.4,1.65,-5],trim);
        }
        const path = [{ x: -5.85, y: .07, z: -2.9 }];
        for (let flight = 0; flight < 2; flight++) for (let step = 0; step < 10; step++) {
            const x = flight ? -4.45 : -5.85, z = flight ? -6.1 + (step + .5) * .25 : -3.6 - (step + .5) * .25, y = (flight * 10 + step + 1) * .16;
            part([1.16, .16, .25], [x, y - .08, z]);
            part([1.18, .035, .27], [x, y + .008, z], trim);
            path.push({ x, y: y + .07, z });
        }
        // Insert the halfway landing in traversal order, rather than cutting
        // diagonally through the gap between two flights.
        path.splice(11, 0, { x: -5.85, y: 1.67, z: -6.4 }, { x: -4.45, y: 1.67, z: -6.4 });
        path.push({ x: -4.45, y: 3.27, z: -2.9 });
        part([2.6, .16, .65], [-5.15, 1.52, -6.4]);
        for (const x of [-6.5, -3.8]) {
            for (let i = 0; i < 10; i++) { const y = x < -5 ? (i + 1) * .16 : (20 - i) * .16; part([.035, .9, .035], [x, y + .47, -3.6 - (i + .5) * .25], trim); }
            const rail = part([.055, .055, 2.95], [x, (x < -5 ? .8 : 2.4) + .97, -4.85]); rail.rotation.x = x < -5 ? Math.atan(.64) : -Math.atan(.64);
        }
        instanceStatic(group);
        return { group, path: plan.level ? path.slice().reverse() : path, entry: plan.level ? path.at(-1) : path[0], exit: plan.level ? path[0] : path.at(-1) };
    }
    function shell(node, plan, materials, home) {
        const T = ByndHomeEngine, root = new T.Group(), config = H.Interiors.resolve(node.room, home), outdoor = ['garden', 'balcony', 'terrace', 'greenhouse'].includes(node.id);
        root.name = 'villa-area-' + node.id; root.userData.area = node.id; root.userData.interior = { preset: config.id, wall: config.wall, floor: config.floor };
        const trim = materials.get('milky_plastic', config.trim), wood = materials.get('soft_wood', config.wood);
        const box = (size, pos, mat = trim) => H.Shapes.rounded(root, size, pos, mat, .012);
        const garden = H.Garden?.palette(config) || { grass: '#a9bf91', leaf: '#88a671', trim: '#c2d3a4' };
        root.userData.gardenPalette = outdoor ? garden : null;
        const floor = new T.Mesh(new T.PlaneGeometry(node.width, node.depth), node.id === 'garden' ? materials.surface({pattern:'grass',base:garden.grass,ink:garden.leaf,secondary:garden.trim},node.width,node.depth,'floor') : materials.surface(H.Interiors.data().floors[config.floor], node.width, node.depth, 'floor'));
        floor.rotation.x = -Math.PI / 2; floor.position.set(node.x, plan.y + .056, node.z); floor.receiveShadow = true; floor.userData.floor = true; floor.userData.area = node.id;
        if (node.id !== 'landing') { root.add(floor); box([node.width, .18, node.depth], [node.x, plan.y - .055, node.z], wood); }
        else {
            floor.geometry.dispose();
            // Preserve an actual stairwell hole in the upper slab.
            for (const [w, d, x, z] of [[.8, 5.6, -7, -5], [2.9, 5.6, -2.25, -5], [2.9, 1, -5.15, -7.3], [2.9, 1.3, -5.15, -2.85]]) {
                const slab = new T.Mesh(new T.BoxGeometry(w, .18, d), floor.material); slab.position.set(x, plan.y - .034, z); slab.receiveShadow = true; slab.userData.floor = true; slab.userData.area = node.id; root.add(slab);
            }
            for (const x of [-6.6, -3.7]) {
                for (let i = 0; i < 6; i++) box([.04, .85, .04], [x, plan.y + .5, -6.8 + i * .55], wood);
                box([.055, .055, 3.3], [x, plan.y + .94, -5.15], wood);
            }
        }
        for (const w of plan.walls.filter(w => w.room === node.id)) {
            const inward = ['right','front'].includes(w.side) ? -1 : 1;
            const outside = w.side === 'left' && node.x < -1 || w.side === 'back' && node.z < -3;
            const height = outdoor ? .18 : 2.8;
            const wall = box([w.width, height, w.depth], [w.x, plan.y + height / 2 + .05, w.z]);
            const finish = mesh => { mesh.userData.wallFinish = { axis: w.axis, x: w.x, z: w.z, side: w.side }; return mesh; };
            finish(wall);
            if (outdoor && node.id !== 'greenhouse') {
                const span = w.axis === 'x' ? w.depth : w.width, count = Math.max(1, Math.floor(span / .32));
                for (let i=0;i<=count;i++) {
                    const along=-span/2+i*span/count;
                    finish(box([.055,.65,.055],[w.x+(w.axis==='z'?along:0),plan.y+.51,w.z+(w.axis==='x'?along:0)]));
                }
                for(const h of [.35,.79])finish(box([w.axis==='x'?.065:w.width,.05,w.axis==='z'?.065:w.depth],[w.x,plan.y+h,w.z],wood));
            }
            if (height > 1) {
                wall.userData.villaWall = { axis: w.axis, x: w.x, z: w.z, cutaway: outside || w.side === 'back' && !node.id.includes('hall') && node.id !== 'landing' };
                const plane = new T.Mesh(new T.PlaneGeometry(w.axis === 'x' ? w.depth : w.width, height - .12), materials.surface(H.Interiors.data().walls[config.wall], w.axis === 'x' ? w.depth : w.width, height - .12));
                plane.position.set(w.x + (w.axis === 'x' ? .051 * inward : 0), plan.y + height / 2 + .06, w.z + (w.axis === 'z' ? .051 * inward : 0)); plane.rotation.y = w.axis === 'x' ? inward * Math.PI / 2 : inward < 0 ? Math.PI : 0; plane.userData.villaWall = wall.userData.villaWall; finish(plane); root.add(plane);
                // Shared cream wainscoting gives every connected room the same
                // finish, with the wallpaper above the protective lower panels.
                finish(box([w.axis === 'x' ? .045 : w.width, .74, w.axis === 'z' ? .045 : w.depth], [w.x + (w.axis === 'x' ? .057 * inward : 0), plan.y + .43, w.z + (w.axis === 'z' ? .057 * inward : 0)]));
                finish(box([w.axis === 'x' ? .065 : w.width, .035, w.axis === 'z' ? .065 : w.depth], [w.x + (w.axis === 'x' ? .063 * inward : 0), plan.y + .82, w.z + (w.axis === 'z' ? .063 * inward : 0)]));
            }
            const cap = finish(box([w.width + .015, .04, w.depth + .015], [w.x, plan.y + height + .06, w.z], wood)); if (height > 1) cap.userData.villaWall = wall.userData.villaWall;
        }
        if (!outdoor && node.x < -1) {
            const before = root.children.length;
            const x = node.x - node.width / 2 + .07, z = node.z + 1.1;
            const sky = materials.get('matte_ceramic', '#d7e3dc');
            box([.035, 1.05, 1.35], [x, plan.y + 1.75, z], sky);
            for (const side of [-1,1]) box([.07, 1.16, .06], [x + .025, plan.y + 1.75, z + side * .7], wood);
            for (const y of [1.2,1.75,2.3]) box([.07, .045, 1.44], [x + .025, plan.y + y, z]);
            box([.07, 1.13, .035], [x + .025, plan.y + 1.75, z]);
            box([.22, .07, 1.54], [x + .08, plan.y + 1.18, z], wood);
            root.children.slice(before).forEach(mesh => { mesh.userData.wallFinish = { axis: 'x', x, z, side: 'left' }; mesh.userData.villaWall = { axis: 'x', x, z, cutaway: true }; });
        }
        for (const door of plan.doors.filter(d => d.a === node.id)) {
            root.add(doorway(door, plan.y, materials, config));
        }
        if (!outdoor && !node.id.includes('hall') && node.id !== 'landing') {
            const rug = new T.Mesh(new T.PlaneGeometry(3.5, 2.35), materials.surface({ pattern: config.rug, base: config.trim, ink: config.accent, secondary: config.fabric }, 3.5, 2.35, 'rug'));
            rug.rotation.x = -Math.PI / 2; rug.position.set(node.x, plan.y + .071, node.z + .5); rug.receiveShadow = true; root.add(rug);
        }
        if (['garden', 'greenhouse', 'terrace', 'balcony'].includes(node.id)) outdoors(root, node, plan, materials, config);
        if (!outdoor && H.Daylight) { const fixture=H.Daylight.fixture(materials,node.id.includes('hall')||node.id==='landing'); fixture.position.set(node.x,plan.y+2.78,node.z);root.add(fixture); }
        instanceStatic(root);
        return root;
    }
    function outdoors(root, node, plan, materials, config) {
        const palette = H.Garden?.palette(config) || { wood: '#af9471', trim: '#eee9dc', cushion: '#abbfa3', paving: '#d6cbb1', flower: '#deb0b7', secondary: '#efcc8c', leaf: '#779772' };
        const T = ByndHomeEngine, wood = materials.get('soft_wood', palette.wood), trim = materials.get('milky_plastic', palette.trim);
        const box = (size, pos, mat = wood) => H.Shapes.rounded(root, size, pos, mat, .012);
        if (node.id === 'garden') {
            for (let i = 0; i < 13; i++) box([.65, .035, .38], [-4.1 + Math.sin(i * .38) * 1.2, .078, 3.9 + i * .39], trim);
            for (const x of [-5.8, .7, 5.8]) flowerbed(root, [x, plan.y, 8.7], materials, palette);
            const pergola=new T.Group();pergola.name='garden-pergola';root.add(pergola);
            const part=(s,p,m=wood)=>H.Shapes.rounded(pergola,s,p,m,.018);
            part([3.4,.065,1.75],[-1.8,.085,6.05],materials.get('matte_ceramic',palette.paving));
            for(const x of [-3.35,-.25])for(const z of [5.35,6.75])part([.12,2.35,.12],[x,1.23,z]);
            for(const x of [-3.35,-.25])part([.18,.14,1.8],[x,2.36,6.05]);
            for(let i=0;i<9;i++)part([.10,.12,1.9],[-3.4+i*.40,2.42,6.05]);
            part([2.1,.12,.62],[-1.8,.56,5.75]);
            for(const x of [-2.7,-.9])for(const z of [5.52,5.98])part([.07,.48,.07],[x,.30,z]);
            for(let i=0;i<3;i++)part([2.1,.09,.065],[-1.8,.76+i*.12,5.47]);
            part([1.94,.06,.55],[-1.8,.65,5.76],materials.get('cream_fabric',palette.cushion));
            for (const [x,z] of [[-4.8,4.6],[4.75,4.5],[-5,9.65],[5,9.65]]) {
                box([.065,.65,.065],[x,.40,z],wood);
                const lantern=box([.15,.18,.15],[x,.79,z],materials.glow('#ffedc6',.25));lantern.userData.luminousMaterial=lantern.material;
                box([.22,.045,.22],[x,.91,z]);
            }
            const swing = new T.Group(); swing.name = 'garden-swing'; swing.position.set(3.3, .056, 6.25); swing.userData.gardenSwing = true; root.add(swing);
            for (const x of [-1.05, 1.05]) for (const z of [-.45, .45]) { const leg = H.Shapes.rounded(swing, [.12, 2.28, .12], [x, 1.08, z], wood, .02); leg.rotation.x = z < 0 ? .4 : -.4; leg.name = 'swing-a-frame-leg'; }
            H.Shapes.rounded(swing, [2.45, .14, .16], [0, 2.16, 0], wood, .03);
            for (const x of [-1.05,1.05]) H.Shapes.rounded(swing,[.1,.09,1.25],[x,.65,0],wood,.02);
            const seat = new T.Group(); seat.name = 'swing-bench'; swing.add(seat);
            const seatPart = (s,p,m=wood) => H.Shapes.rounded(seat,s,p,m,.018);
            seatPart([1.65,.11,.64],[0,.69,0]);
            for (const x of [-.76,.76]) { seatPart([.075,.50,.07],[x,.94,-.28]); seatPart([.08,.06,.60],[x,1.03,0]); }
            for (let i=0;i<3;i++) seatPart([1.65,.10,.065],[0,.84+i*.13,-.28]);
            seatPart([1.47,.09,.52],[0,.79,.015],materials.get('cream_fabric',palette.cushion));
            for (const x of [-.72,.72]) for (const z of [-.25,.25]) {
                const rope = new T.Mesh(new T.TubeGeometry(new T.LineCurve3(new T.Vector3(x,2.12,0),new T.Vector3(x,.74,z)),1,.015,6,false),materials.get('warm_metal','#887b60'));
                rope.name='swing-suspension';rope.castShadow=true; swing.add(rope);
            }
        }
        if (node.id === 'greenhouse') {
            const glass = new T.MeshStandardMaterial({ color: '#dce9de', transparent: true, opacity: .14, roughness: .25, depthWrite: false, side: T.DoubleSide });
            root.userData.ownedMaterial = glass;
            for (const wall of plan.walls.filter(w => w.room === node.id && w.side === 'back')) {
                const pane = new T.Mesh(new T.PlaneGeometry(wall.width, 2.3), glass); pane.position.set(wall.x, plan.y + 1.3, wall.z + .08); root.add(pane);
                for (let x = wall.x - wall.width / 2; x <= wall.x + wall.width / 2 + .01; x += 1.2) box([.045, 2.5, .045], [x, plan.y + 1.3, wall.z + .08], trim);
                box([wall.width, .06, .06], [wall.x, plan.y + 2.55, wall.z + .08], trim);
            }
            // The roof shows the glasshouse structure without closing the
            // cutaway frontage or placing a glass panel across the doorway.
            const roof = new T.Mesh(new T.PlaneGeometry(node.width, node.depth), glass); roof.rotation.x = -Math.PI / 2; roof.position.set(node.x, plan.y + 2.6, node.z); root.add(roof);
            for (const x of [node.x - node.width / 2, node.x, node.x + node.width / 2]) box([.035, .035, node.depth], [x, plan.y + 2.62, node.z], trim);
            for (const x of [node.x - 2.3, node.x + 2.3]) flowerbed(root, [x, plan.y, node.z + .7], materials, palette);
        }
        if (node.id === 'terrace') for (const x of [-5.8, 5.8]) flowerbed(root, [x, plan.y, node.z], materials, palette);
        if (node.id === 'balcony') flowerbed(root, [node.x - 2.3, plan.y, node.z + .55], materials, palette);
    }
    function flowerbed(root, position, materials, palette) {
        const T = ByndHomeEngine, soil = materials.get('matte_ceramic', '#796448');
        H.Shapes.rounded(root, [1.75, .25, .8], [position[0], position[1] + .16, position[2]], materials.get('soft_wood', palette.wood), .025);
        H.Shapes.rounded(root, [1.60, .035, .66], [position[0], position[1] + .3, position[2]], soil, .01);
        const stems = new T.InstancedMesh(new T.CylinderGeometry(.012, .012, .38, 5), materials.get('matte_ceramic', '#658266'), 18), leaves = new T.InstancedMesh(new T.SphereGeometry(1, 7, 5), materials.get('matte_ceramic', palette.leaf), 36), petals = new T.InstancedMesh(new T.SphereGeometry(.06, 7, 5), materials.get('matte_ceramic', '#f6e1d6'), 90), center = new T.InstancedMesh(new T.SphereGeometry(.028, 7, 5), materials.get('matte_ceramic', '#ebc982'), 18), m = new T.Object3D(), colors = [palette.trim,palette.flower,palette.secondary].map(c=>new T.Color(c));
        for (let i = 0; i < 18; i++) {
            const x = position[0] - .65 + (i % 6) * .26, z = position[2] - .22 + Math.floor(i / 6) * .22, y = position[1] + .68;
            m.position.set(x, y - .19, z); m.scale.set(1, 1, 1); m.updateMatrix(); stems.setMatrixAt(i, m.matrix);
            for (const side of [-1,1]) { m.position.set(x + side * .065, y - .16 + side * .04, z); m.scale.set(.10,.018,.035); m.rotation.z=side*.35; m.updateMatrix(); leaves.setMatrixAt(i*2+(side+1)/2,m.matrix); } m.rotation.z=0;m.scale.set(1,1,1);
            m.position.set(x, y, z); m.updateMatrix(); center.setMatrixAt(i, m.matrix);
            for (let j = 0; j < 5; j++) { const a = j * Math.PI * 2 / 5; m.position.set(x + Math.cos(a) * .05, y + .015, z + Math.sin(a) * .05); m.scale.set(.8, .45, .8); m.updateMatrix(); petals.setMatrixAt(i * 5 + j, m.matrix); petals.setColorAt(i*5+j,colors[i%3]); }
        }
        root.add(stems, leaves, petals, center); stems.castShadow = petals.castShadow = leaves.castShadow = true;
    }
    function doorStyle(door) {
        const rooms = [door.a, door.b];
        if (rooms.includes('bathroom')) return 'frosted';
        if (rooms.every(id => ['balcony', 'terrace', 'greenhouse'].includes(id))) return 'passage';
        if (rooms.some(id => ['garden', 'balcony', 'greenhouse'].includes(id))) return 'glazed';
        if (rooms.includes('kitchen')) return 'cafe';
        if (rooms.some(id => ['bedroom', 'game_room'].includes(id))) return 'panel';
        return 'passage';
    }
    function doorway(door, y, materials, palette = {}) {
        const T=ByndHomeEngine, root=new T.Group(), wood=materials.get('soft_wood',palette.wood||'#aa9070'), cream=materials.get('milky_plastic',palette.trim||'#eee9dc'), metal=materials.get('warm_metal','#b69a62');
        root.name='villa-door-'+door.a+'-'+door.b; root.position.set(door.x,y+.05,door.z); root.rotation.y=door.axis==='x'?Math.PI/2:0;
        const style = doorStyle(door);
        root.userData.door={...door,angle:0,style};root.userData.wallFinish={axis:door.axis,x:door.x,z:door.z,side:'door'};
        const box=(g,s,p,m=wood)=>H.Shapes.rounded(g,s,p,m,.008), width=door.width/2-.045;
        for(const sign of [-1,1])box(root,[.065,2.25,.12],[sign*door.width/2,1.125,0],cream);
        box(root,[door.width+.08,.07,.12],[0,2.28,0],cream);
        if (style === 'passage') {
            // Open circulation, with the moulding entirely above the clear headroom.
            const curve = new T.CatmullRomCurve3([new T.Vector3(-door.width/2,2.20,0),new T.Vector3(-door.width*.32,2.37,0),new T.Vector3(0,2.43,0),new T.Vector3(door.width*.32,2.37,0),new T.Vector3(door.width/2,2.20,0)]);
            const arch = new T.Mesh(new T.TubeGeometry(curve,20,.045,6,false),cream);root.add(arch);return root;
        }
        const glass = new T.MeshStandardMaterial({color:style==='frosted'?'#d1ded8':'#c4ded8',roughness:style==='frosted'?.9:.22,transparent:true,opacity:style==='frosted'?.82:.26,depthWrite:false,side:T.DoubleSide});
        root.userData.ownedMaterial = glass;
        if (style === 'frosted') box(root,[door.width*2,.045,.055],[0,2.34,0],metal);
        for(const sign of [-1,1]){
            const hinge=new T.Group();hinge.name='door-hinge';hinge.position.x=sign*(door.width/2-.04);hinge.userData.sign=sign;root.add(hinge);
            hinge.userData.restX=hinge.position.x;
            const template = H.DoorGeometry?.[style === 'panel' ? 'panel' : style === 'glazed' ? 'glazed' : ''];
            if (template) {
                const leaf = new T.Group();leaf.scale.set(-sign*width/.4293,2.16/.981182,1);leaf.position.y=.02;hinge.add(leaf);
                for (const part of template) {
                    const geometry = new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(part.position,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(part.normal,3));geometry.setIndex(part.index);
                    const mat=part.material==='glass'?glass:part.material==='metal'?metal:style==='glazed'?cream:wood;
                    const mesh=new T.Mesh(geometry,mat);mesh.castShadow=part.material!=='glass';mesh.receiveShadow=true;leaf.add(mesh);
                }
            } else {
                const height=style==='cafe'?1.34:2.16, bottom=style==='cafe'?.27:.02, cx=-sign*width/2;
                for(const dx of [-1,1])box(hinge,[.055,height,.06],[cx+dx*(width-.055)/2,bottom+height/2,0],cream);
                for(const h of [bottom+.03,bottom+height-.03])box(hinge,[width,.06,.06],[cx,h,0],cream);
                if(style==='frosted'){
                    box(hinge,[width-.10,height-.13,.018],[cx,bottom+height/2,0],glass);
                    for(let i=0;i<5;i++)box(hinge,[width-.1,.014,.024],[cx,.4+i*.27,0],cream);
                } else for(let i=0;i<8;i++)box(hinge,[width-.08,.085,.04],[cx,bottom+.17+i*.135,0],wood);
                for(const z of [-.055,.055])box(hinge,[.025,.17,.025],[-sign*(width-.12),1.03,z],metal);
            }
        }
        return root;
    }
    function updateDoors(doors, actors, dt, reduced) {
        for(const root of doors){
            const d=root.userData.door, near=actors.some(a=>a.root.visible&&Math.hypot(a.root.position.x-d.x,a.root.position.z-d.z)<2.4);
            const target=near?Math.PI*.51:0;d.angle+=(target-d.angle)*(reduced?1:1-Math.exp(-dt*12));
            root.children.filter(c=>c.name==='door-hinge').forEach(c=>{
                if(d.style==='frosted') c.position.x=c.userData.restX+c.userData.sign*(d.width/2-.035)*d.angle/(Math.PI*.51);
                else c.rotation.y=(d.style==='glazed'?1:-1)*c.userData.sign*d.angle;
            });
        }
    }
    function exterior(materials, home) {
        const T=ByndHomeEngine, root=new T.Group(), trim=materials.get('milky_plastic','#eee9dc'),wood=materials.get('soft_wood','#aa9070'), roofMat=materials.get('matte_ceramic','#8b9b8a');
        root.name='villa-exterior'; const box=(s,p,m=trim)=>H.Shapes.rounded(root,s,p,m,.015);
        box([15.2,.24,11.9],[-.1,-.06,-2]);
        for(let level=0;level<2;level++){
            const y=level*3.2;
            // Exterior-only shell keeps hidden indoor furniture and characters
            // out of the draw budget when both storeys and roof are visible.
            for(const x of [-7.4,7.2])box([.18,3.2,11.6],[x,y+1.6,-2.1]);
            box([14.6,3.2,.18],[-.1,y+1.6,-7.8]);
            box([14.6,3.2,.18],[-.1,y+1.6,3.6]);
            for(const x of [-4.1,3.9]){
                for(const xx of [x-.94,x+.94])box([.08,2.45,.19],[xx,y+1.23,3.68],wood);
                box([1.88,.07,.19],[x,y+2.46,3.68],wood);
                box([1.80,2.35,.045],[x,y+1.22,3.68],materials.get('soft_glass','#c3d8d0'));
                box([.065,2.35,.08],[x,y+1.22,3.73],wood);
            }
            for(const x of [-7.51,7.31]) for(const z of [-5,.8]){
                box([.03,1.30,1.60],[x,y+1.78,z],materials.get('soft_glass','#bfd5d5'));
                for(const zz of [z-.85,z+.85])box([.06,1.4,.07],[x,y+1.78,zz],wood);
                for(const yy of [1.06,1.78,2.5])box([.07,.055,1.77],[x,y+yy,z],wood);
            }
            box([14.9,.16,11.9],[-.1,y+3.12,-2.1],wood);
        }
        const geom=new T.BufferGeometry(), vertices=[];
        const face=(a,b,c)=>vertices.push(...a,...b,...c);
        const a=[-7.7,6.4,-8.1],b=[7.5,6.4,-8.1],c=[7.5,6.4,3.95],d=[-7.7,6.4,3.95],e=[-.1,8.35,-8.1],f=[-.1,8.35,3.95];
        face(a,d,e);face(d,f,e);face(e,f,b);face(f,c,b);face(a,e,b);face(d,c,f);
        geom.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geom.computeVertexNormals();
        const roof=new T.Mesh(geom,roofMat);roof.name='villa-pitched-roof';roof.castShadow=true;root.add(roof);
        const lower=plan('living_room'), upper=plan('bedroom');
        for(const p of [lower,upper])for(const n of p.nodes.filter(n=>['garden','balcony','terrace','greenhouse'].includes(n.id)))root.add(shell(n,p,materials,home));
        instanceStatic(root);return root;
    }
    H.Villa = { floorOf, plan, nodeAt, translate, blocks, shell, staircase, doorway, doorStyle, updateDoors, exterior, levelCount: levels.length, levelRoom: level => levels[level]?.[0]?.[0], includes: id => floorOf(id) >= 0 };
})(window.ByndHome3D);
