(function (H) {
    'use strict';
    const data = () => H.catalogs.materialPresets.interiors;
    function resolve(room, home = {}) {
        const saved = home.interiors?.[room.id] || {}, id = saved.preset || data().defaultPreset || data().defaults[room.id] || 'garden';
        const preset = data().presets[id];
        return { ...preset, id, wall: saved.wall || preset.wall, floor: saved.floor || preset.floor, furniture: saved.furniture };
    }
    function valid(config) {
        return config && typeof config === 'object' && !Array.isArray(config) && Object.hasOwn(data().presets, config.preset) &&
            (!config.wall || Object.hasOwn(data().walls, config.wall)) && (!config.floor || Object.hasOwn(data().floors, config.floor)) &&
            (!config.furniture || typeof config.furniture === 'object' && !Array.isArray(config.furniture) && Object.entries(config.furniture).every(([id, style]) => /^[\w-]{1,100}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id) && Object.hasOwn(H.catalogs.furnitureCatalog.styles, style)));
    }
    function apply(roomId, changes, matchFurniture = false) {
        const room = H.Rooms.get(roomId);
        if (!room || !H.Rooms.available(room, H.State.home())) throw new Error('这个房间还没有开放。');
        return H.State.withHome(home => {
            const current = resolve(room, home), old = home.interiors?.[roomId] || {};
            const next = { preset: current.id, ...old, ...changes };
            if (!home.interiors?.[roomId] && !matchFurniture) {
                next.furniture = Object.fromEntries(room.furniture.filter(p => !home.layouts?.[roomId]?.items?.[p.id]).map(p => [p.id, current.furnitureStyle]));
            }
            if (changes.preset) { delete next.wall; delete next.floor; }
            if (matchFurniture && data().presets[next.preset]) {
                next.furniture = Object.fromEntries(H.Rooms.placements(room, home).map(p => [p.id, data().presets[next.preset].furnitureStyle]));
            }
            if (!valid(next)) throw new Error('墙面或地板方案无效，没有保存。');
            home.interiors ||= {}; home.interiors[roomId] = next;
        });
    }
    function furniture(item, placement, room, home) {
        const config = resolve(room, home);
        // Existing custom furniture keeps its authored look until the user applies
        // a complete set. New pieces added afterwards also retain their own style.
        const original = room.furniture.some(p => p.id === placement.id) && !home.layouts?.[room.id]?.items?.[placement.id];
        const style = config.furniture?.[placement.id] || (!home.interiors?.[room.id] && original ? config.furnitureStyle : null);
        return style ? { ...item, style, interiorPalette: config } : item;
    }
    function paint(canvas, finish) {
        const c = canvas.getContext('2d'), n = canvas.width, s = n / 1024;
        c.scale(s, s); c.fillStyle = finish.base; c.fillRect(0, 0, 1024, 1024);
        const p = finish.pattern, ink = finish.ink, light = finish.secondary;
        const stroke = (color, width, draw) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); draw(); c.stroke(); };
        function leaf(x, y, angle, length, color) {
            c.save(); c.translate(x, y); c.rotate(angle); c.fillStyle = color; c.beginPath(); c.ellipse(0, -length / 2, length * .24, length / 2, .2, 0, Math.PI * 2); c.fill(); c.restore();
        }
        function sprig(x, y, scale, color) {
            c.save(); c.translate(x, y); c.scale(scale, scale);
            stroke(color, 2.2, () => { c.moveTo(0, 28); c.bezierCurveTo(-14, 0, 14, -25, 0, -61); });
            for (let i = 0; i < 4; i++) for (const side of [-1, 1]) leaf(side * 3, 5 - i * 15, side * .85, 23 - i * 2, color);
            c.restore();
        }
        if (p === 'pastel_flower') {
            for (let x = 0; x < 1024; x += 256) {
                c.fillStyle = ink; c.fillRect(x + 24, 0, 56, 1024); c.fillStyle = light; c.fillRect(x + 145, 0, 54, 1024);
                for (let y = 52; y < 1024; y += 128) { sprig(x + 110, y, .6, ink); sprig(x + 227, y + 64, .55, light); }
            }
        } else if (p === 'floral' || p === 'damask') {
            for (let row = -1; row < 9; row++) for (let col = -1; col < 9; col++) {
                const x = col * 128 + (row % 2 ? 64 : 0), y = row * 128;
                if (p === 'floral') {
                    sprig(x, y + 28, .75, ink);
                    for (let i = 0; i < 5; i++) { const a = i * Math.PI * .4; c.fillStyle = light; c.beginPath(); c.ellipse(x + Math.cos(a) * 6, y - 22 + Math.sin(a) * 6, 5, 7, a, 0, Math.PI * 2); c.fill(); }
                    c.fillStyle = '#efe7cb'; c.beginPath(); c.arc(x, y - 22, 3, 0, Math.PI * 2); c.fill();
                } else {
                    for (const side of [-1, 1]) stroke(ink, 2.5, () => { c.moveTo(x, y + 40); c.bezierCurveTo(x + side * 65, y + 15, x + side * 53, y - 37, x + side * 14, y - 25); c.bezierCurveTo(x + side * 3, y - 20, x + side * 7, y - 4, x + side * 18, y - 9); });
                    sprig(x, y + 10, .68, ink);
                }
            }
        } else if (p === 'stripe') {
            c.fillStyle = ink; for (let x = 0; x < 1024; x += 128) { c.fillRect(x, 0, 7, 1024); c.fillRect(x + 14, 0, 2, 1024); }
            for (let x = 62; x < 1024; x += 128) for (let y = 92; y < 1024; y += 192) sprig(x, y, .55, light);
        } else if (p === 'brick') {
            c.fillStyle = light; c.fillRect(0, 0, 1024, 1024);
            for (let row = -1; row < 9; row++) for (let col = -1; col < 5; col++) {
                const x = col * 256 + (row % 2 ? 128 : 0), y = row * 128;
                c.fillStyle = (row + col) % 3 ? finish.base : ink; c.fillRect(x + 6, y + 5, 244, 118);
                c.strokeStyle = '#ffffff28'; c.lineWidth = 3; c.strokeRect(x + 10, y + 9, 236, 108);
            }
        } else if (p === 'parquet' || p === 'herringbone' || p === 'wood') {
            const board = (x, y, width, height, variant) => {
                c.fillStyle = variant % 3 === 0 ? finish.base : variant % 3 === 1 ? light : ink; c.fillRect(x + 1.5, y + 1.5, width - 3, height - 3);
                c.globalAlpha = .17;
                for (let i = 4; i < height; i += 5) stroke(ink, .7, () => { c.moveTo(x + 3, y + i); c.bezierCurveTo(x + width * .35, y + i - 3, x + width * .65, y + i + 4, x + width - 3, y + i); });
                c.globalAlpha = 1;
            };
            if (p === 'wood') for (let row = 0; row < 16; row++) board(0, row * 64, 1024, 64, row);
            else {
                c.save();
                if (p === 'herringbone') {
                    for (let i = -5; i < 10; i++) for (let j = -35; j < 36; j++) {
                        const x = i * 128 + j * 32, y = i * 128 - j * 32;
                        if (x < -160 || x > 1024 || y < -128 || y > 1024) continue;
                        board(x, y, 128, 32, i + j + 100);
                        c.save(); c.translate(x + 160, y); c.rotate(Math.PI / 2); board(0, 0, 128, 32, i + j + 101); c.restore();
                    }
                } else for (let row = -4; row < 13; row++) for (let col = -4; col < 13; col++) {
                    const x = col * 128, y = row * 128;
                    c.save(); c.translate(x + 64, y + 64); c.rotate((row + col) % 2 ? Math.PI / 2 : 0);
                    for (let i = 0; i < 4; i++) board(-64, -64 + i * 32, 128, 32, row + col + i + 30); c.restore();
                }
                c.restore();
            }
        } else if (p === 'checker' || p === 'marble') {
            for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
                c.fillStyle = p === 'checker' && (row + col) % 2 ? ink : finish.base; c.fillRect(col * 256 + 2, row * 256 + 2, 252, 252);
            }
            if (p === 'marble') { c.globalAlpha = .38; for (let i = 0; i < 12; i++) stroke(ink, i % 3 ? 1 : 2.5, () => { const y = i * 91; c.moveTo(0, y); c.bezierCurveTo(380, y + 160, 650, y - 125, 1024, y + 70); }); c.globalAlpha = 1; }
        } else if (['ornate', 'botanical', 'woven', 'diamond', 'rose_garden', 'graphic'].includes(p)) {
            c.strokeStyle = ink; c.lineWidth = 12; c.strokeRect(28, 28, 968, 968); c.lineWidth = 3; c.strokeRect(47, 47, 930, 930);
            if (p === 'ornate') {
                for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; c.save(); c.translate(512, 512); c.rotate(a); sprig(0, -125, 2, ink); c.restore(); }
                for (let i = 0; i < 4; i++) { c.save(); c.translate(512, 512); c.rotate(i * Math.PI / 2); for (let x = -380; x < 400; x += 95) sprig(x, -390, .8, ink); c.restore(); }
                stroke(ink, 5, () => c.arc(512, 512, 73, 0, Math.PI * 2));
            } else if (p === 'botanical') {
                for (let i = 0; i < 4; i++) { c.save(); c.translate(512, 512); c.rotate(i * Math.PI / 2); for (let x = -345; x <= 345; x += 115) sprig(x, -380, 1.1, ink); c.restore(); }
                sprig(512, 620, 3, ink);
            } else if (p === 'rose_garden') {
                for (const side of [-1, 1]) for (let x = 100; x < 1000; x += 85) sprig(x, side < 0 ? 95 : 970, .6, ink);
                for (let i = 0; i < 7; i++) { const x = 390 + i % 3 * 90, y = 450 + Math.floor(i / 3) * 75; sprig(x, y + 115, 1.4, ink); c.fillStyle = '#e9b1c1'; for (let j = 0; j < 6; j++) { c.beginPath(); c.ellipse(x + Math.cos(j) * 18, y + Math.sin(j) * 18, 20, 27, j, 0, Math.PI * 2); c.fill(); } }
            } else if (p === 'graphic') {
                c.fillStyle = ink; c.fillRect(65, 65, 894, 894); c.strokeStyle = '#ececea'; c.lineWidth = 28;
                for (let y = -700; y < 1800; y += 290) { c.beginPath(); c.moveTo(64, y); c.lineTo(960, y + 896); c.stroke(); }
            } else if (p === 'diamond') {
                c.globalAlpha = .5; for (let y = 140; y < 920; y += 150) for (let x = 140; x < 920; x += 150) stroke(ink, 6, () => { c.moveTo(x, y - 40); c.lineTo(x + 40, y); c.lineTo(x, y + 40); c.lineTo(x - 40, y); c.closePath(); }); c.globalAlpha = 1;
            }
            c.globalAlpha = .12; stroke(ink, .8, () => { for (let i = 0; i < 1024; i += 4) { c.moveTo(i, 0); c.lineTo(i, 1024); c.moveTo(0, i); c.lineTo(1024, i); } }); c.globalAlpha = 1;
        } else if (p === 'view') {
            c.fillStyle = '#dceaf0'; c.fillRect(0, 0, 1024, 1024);
            c.fillStyle = '#f4f0df'; c.beginPath(); c.arc(770, 190, 80, 0, Math.PI * 2); c.fill();
            for (let i = 0; i < 16; i++) { const x = i * 85 - 50, y = 640 + Math.sin(i * 1.8) * 125; c.fillStyle = ['#98b9a1', '#b1c8ac', '#7da08b'][i % 3]; c.beginPath(); c.ellipse(x, y, 145, 250, i * .2, 0, Math.PI * 2); c.fill(); }
        } else if (p === 'art') {
            sprig(512, 830, 7, ink); sprig(330, 840, 4, light); sprig(730, 820, 4.5, ink);
        } else {
            c.globalAlpha = .18; for (let y = 0; y < 1024; y += 8) stroke(ink, 2, () => { c.moveTo(0, y); c.bezierCurveTo(280, y + 16, 700, y - 16, 1024, y); }); c.globalAlpha = 1;
        }
    }
    function shell(room, materials, home) {
        const T = ByndHomeEngine, root = new T.Group(), config = resolve(room, home), [w, d] = room.size;
        const modern = ['natural', 'monochrome'].includes(config.id), trim = materials.get('milky_plastic', config.trim), wood = materials.get('soft_wood', config.wood), metal = materials.get('warm_metal', modern ? '#42484d' : '#b7a078');
        const box = (size, pos, mat = trim, radius = .012) => H.Shapes.rounded(root, size, pos, mat, radius);
        const add = (geometry, material, pos) => { const mesh = new T.Mesh(geometry, material); mesh.position.set(...pos); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh; };
        box([w + .27, .32, d + .27], [0, -.17, 0], materials.get('milky_plastic', config.wood), .06);
        box([w, .12, d], [0, -.008, 0], wood, .018);
        const floorMat = materials.surface(data().floors[config.floor], w, d, 'floor');
        const floor = add(new T.PlaneGeometry(w - .03, d - .03), floorMat, [0, .056, 0]); floor.rotation.x = -Math.PI / 2; floor.castShadow = false; floor.userData.finish = config.floor;
        box([w + .13, 2.8, .13], [0, 1.4, -d / 2], trim); box([.13, 2.8, d], [-w / 2, 1.4, 0], trim);
        const back = add(new T.PlaneGeometry(w, 2.7), materials.surface(data().walls[config.wall], w, 2.7), [0, 1.4, -d / 2 + .071]); back.castShadow = false; back.userData.finish = config.wall;
        const left = add(new T.PlaneGeometry(d, 2.7), materials.surface(data().walls[config.wall], d, 2.7), [-w / 2 + .071, 1.4, 0]); left.rotation.y = Math.PI / 2; left.castShadow = false; left.userData.finish = config.wall;
        // Fine moldings and inset wainscot are actual geometry on both walls.
        for (const height of modern ? [.14, 2.79] : [.14, .82, 2.73, 2.79]) {
            const thickness = height < .2 ? .12 : .045;
            box([w, thickness, .075], [0, height, -d / 2 + .10]); box([.075, thickness, d], [-w / 2 + .10, height, 0]);
        }
        if (!modern) { box([w, .65, .019], [0, .46, -d / 2 + .087]); box([.019, .65, d], [-w / 2 + .087, .46, 0]); }
        const rails = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), trim, 80), matrix = new T.Object3D(); let count = 0;
        const rail = (x, y, z, sx, sy, sz) => { matrix.position.set(x, y, z); matrix.scale.set(sx, sy, sz); matrix.updateMatrix(); rails.setMatrixAt(count++, matrix.matrix); };
        for (const wall of modern ? [] : ['back', 'left']) {
            const span = wall === 'back' ? w : d, panels = Math.floor(span / .85), step = span / panels;
            for (let i = 0; i < panels; i++) {
                const center = -span / 2 + step * (i + .5);
                for (const a of [-1, 1]) {
                    if (wall === 'back') { rail(center + a * (step / 2 - .10), .46, -d / 2 + .105, .017, .42, .019); rail(center, .46 + a * .21, -d / 2 + .105, step - .20, .017, .019); }
                    else { rail(-w / 2 + .105, .46, center + a * (step / 2 - .10), .019, .42, .017); rail(-w / 2 + .105, .46 + a * .21, center, .019, .017, step - .20); }
                }
            }
        }
        rails.count = count; rails.receiveShadow = true; root.add(rails);
        const window = new T.Group(); window.position.set(1.65, 1.03, -d / 2 + .10); root.add(window);
        function arch(radius, stem, mat, z, x = 0) {
            const shape = new T.Shape(); shape.moveTo(-radius, 0); shape.lineTo(radius, 0); shape.lineTo(radius, stem); shape.absarc(0, stem, radius, 0, Math.PI, false); shape.closePath();
            const mesh = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .008, bevelThickness: .006 }), mat); mesh.position.set(x, 0, z); mesh.castShadow = true; window.add(mesh);
        }
        const glass = materials.night ? materials.glow('#62768c', .09) : materials.surface({ pattern: 'view', base: '#dceaf0' }, 1, 1, 'art'), frame = modern ? materials.get('warm_metal', '#42484d') : trim;
        if (modern) {
            H.Shapes.rounded(window, [1.46, 1.39, .045], [0, .69, 0], frame, .004);
            H.Shapes.rounded(window, [1.35, 1.28, .025], [0, .69, .045], glass, .004);
        } else if (config.id === 'rose') {
            for (const x of [-.365, .365]) { arch(.36, 1.0, wood, 0, x); arch(.325, 1.0, trim, .038, x); arch(.29, 1.0, glass, .072, x); }
        } else { arch(.73, .70, wood, 0); arch(.675, .70, trim, .038); arch(.62, .70, glass, .072); }
        for (const x of config.id === 'rose' ? [-.365, .365] : [-.31, 0, .31]) {
            const top = modern ? 1.33 : config.id === 'rose' ? 1.29 : .70 + Math.sqrt(.62 * .62 - x * x);
            H.Shapes.rounded(window, [.025, top - .05, .025], [x, (top + .05) / 2, .118], frame, .008);
        }
        for (const y of [.34, .75]) H.Shapes.rounded(window, [1.23, .025, .025], [0, y, .118], frame, .008);
        H.Shapes.rounded(window, [1.75, .045, .04], [0, 1.49, .17], metal, .016);
        H.Shapes.rounded(window, [1.60, .065, .25], [0, -.02, .12], wood, .014);
        if (config.vines) {
            for (const side of [-1, 1]) {
                for (const x of [side * .70, side * .99]) H.Shapes.rounded(window, [.026, 1.35, .045], [x, .69, .15], trim, .004);
                for (let i = 0; i < 15; i++) H.Shapes.rounded(window, [.32, .033, .045], [side * .845, .055 + i * .09, .15], trim, .004);
            }
        } else {
          const cloth = materials.get('cream_fabric', config.id === 'pink' ? '#ebbac8' : config.trim).clone(); cloth.side = T.DoubleSide;
          for (const side of [-1, 1]) {
            const geometry = new T.PlaneGeometry(.36, 1.51, 18, 18), positions = geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const u = (positions.getX(i) + .18) / .36, v = (positions.getY(i) + .755) / 1.51;
                positions.setX(i, positions.getX(i) * (.78 + .25 * Math.abs(v - .4) * 2)); positions.setZ(i, Math.sin(u * Math.PI * 8) * .027 + Math.sin(v * Math.PI) * .035);
            }
            geometry.computeVertexNormals();
            const curtain = new T.Mesh(geometry, cloth); curtain.position.set(side * .76, .735, .22); curtain.castShadow = true; curtain.userData.ownedMaterial = cloth; window.add(curtain);
            H.Shapes.rounded(window, [.28, .035, .08], [side * .75, .55, .235], metal, .01);
          }
        }
        // A coordinated rug under the usable floor area, with woven border detail.
        const rw = room.id === 'kitchen' ? 2.75 : 3.75, rd = room.id === 'bedroom' ? 2.85 : room.id==='dining_room'?3.45:2.45;
        const rugGeometry = config.id === 'rose' ? new T.CircleGeometry(.5, 64) : new T.PlaneGeometry(rw, rd);
        const rug = add(rugGeometry, materials.surface({ pattern: config.rug, base: config.trim, ink: config.accent, secondary: config.fabric }, rw, rd, 'rug'), [0, .073, .55]); rug.rotation.x = -Math.PI / 2; rug.castShadow = false;
        if (config.id === 'rose') rug.scale.set(rw, rd, 1);
        const fringe = new T.InstancedMesh(new T.BoxGeometry(.017, .009, .075), materials.get('cream_fabric', config.trim), 64);
        for (let i = 0; i < 64; i++) { matrix.position.set(-rw / 2 + .04 + i % 32 * (rw - .08) / 31, .074, .55 + (i < 32 ? -1 : 1) * (rd / 2 + .02)); matrix.scale.set(1, 1, 1); matrix.updateMatrix(); fringe.setMatrixAt(i, matrix.matrix); } if (!modern && config.id !== 'rose') root.add(fringe); else fringe.geometry.dispose();
        // Botanical prints and narrow picture shelves create a lived-in wall rhythm.
        if (room.id !== 'kitchen') {
        const printMat = materials.surface({ pattern: 'art', base: '#f0eadd', ink: config.accent, secondary: '#ac9577' }, 1, 1, 'art');
        for (const [x, y, size] of [[-1.45, 1.97, .48], [-2.02, 2.12, .40], [-2.05, 1.62, .32]]) {
            box([size, size * 1.24, .045], [x, y, -d / 2 + .13], config.id === 'palace' ? metal : wood, .012);
            const print = add(new T.PlaneGeometry(size - .075, size * 1.24 - .075), printMat, [x, y, -d / 2 + .159]); print.castShadow = false;
        }
        box([1.08, .04, .17], [-1.65, 1.18, -d / 2 + .16], wood);
        for (let i = 0; i < 4; i++) box([.07, .15 + i * .018, .10], [-2.03 + i * .09, 1.28, -d / 2 + .17], materials.get('cream_fabric', [config.accent, config.fabric, config.wood, config.trim][i]), .003);
        }
        if (['living_room','bedroom','wardrobe'].includes(room.id) && (config.id === 'palace' || config.id === 'pink')) {
            const mirror = new T.Group(); mirror.name = 'wall-mirror'; mirror.position.set(-w / 2 + .17, 1.91, -.45); mirror.rotation.y = Math.PI / 2; root.add(mirror);
            const rim = new T.Mesh(new T.TorusGeometry(.39, .028, 8, 48), config.id === 'palace' ? metal : trim); rim.scale.y = 1.30; mirror.add(rim);
            const pane = new T.Mesh(new T.CircleGeometry(.372, 48), materials.get('warm_metal', '#b9c7ce')); pane.scale.y = 1.30; mirror.add(pane);
            for (const side of [-1, 1]) { const jewel = new T.Mesh(new T.SphereGeometry(.04, 12, 8), config.id === 'palace' ? metal : trim); jewel.position.set(0, side * .52, 0); jewel.scale.set(1, 1.7, .5); mirror.add(jewel); }
            box([.34, .04, 1.02], [-w / 2 + .22, 1.27, -.45], config.id === 'palace' ? wood : trim);
        }
        if (config.vines || config.id === 'garden') {
            const green = materials.get('sage', config.id === 'botanical' ? '#73865d' : '#9aab87');
            const leaves = new T.InstancedMesh(new T.SphereGeometry(1, 10, 6), green, config.vines ? 240 : 48);
            const stems = new T.InstancedMesh(new T.CylinderGeometry(.003, .003, 1, 6), green, config.vines ? 240 : 48), segment = new T.Object3D(), up = new T.Vector3(0, 1, 0); let stemCount = 0;
            let k = 0;
            for (let chain = 0; chain < (config.vines ? 12 : 3); chain++) {
                const x = config.vines ? -w / 2 + .25 + chain * (w - .45) / 11 : .80 + chain * .85, length = config.vines ? 10 + chain % 5 * 2 : 8;
                for (let i = 0; i < length; i++) {
                    const point = new T.Vector3(x + Math.sin(i * 1.7 + chain) * .065, 2.66 - i * .085, -d / 2 + .20), previous = new T.Vector3(x + Math.sin((i - 1) * 1.7 + chain) * .065, 2.66 - (i - 1) * .085, -d / 2 + .20), direction = point.clone().sub(previous);
                    matrix.position.copy(point); matrix.scale.set(.033, .056, .012); matrix.rotation.z = Math.sin(i * 2.4) * .6; matrix.updateMatrix(); leaves.setMatrixAt(k++, matrix.matrix);
                    segment.position.copy(point).add(previous).multiplyScalar(.5); segment.scale.set(1, direction.length(), 1); segment.quaternion.setFromUnitVectors(up, direction.normalize()); segment.updateMatrix(); stems.setMatrixAt(stemCount++, segment.matrix);
                }
            }
            leaves.count = k; leaves.castShadow = true; stems.count = stemCount; root.add(leaves, stems); matrix.rotation.z = 0;
        }
        // Wall lighting stays local and preserves the existing night-light budget.
        for (const x of [-2.6, .52]) {
            box([.095, .17, .025], [x, 1.73, -d / 2 + .13], metal);
            box([.19, .055, .14], [x, 1.78, -d / 2 + .20], trim);
            box([.14, .017, .07], [x, 1.74, -d / 2 + .20], materials.glow('#ffdeb1', .7));
        }
        // Kitchen/bathroom backsplashes deliberately use washable tile geometry.
        if (['kitchen', 'bathroom'].includes(room.id)) {
            const tile = add(new T.PlaneGeometry(w - .22, .44), materials.surface(data().floors.checker_tile, w, .44, 'wall'), [0, 1.08, -d / 2 + .125]); tile.castShadow = false;
        }
        root.userData.interior = { preset: config.id, wall: config.wall, floor: config.floor }; return root;
    }
    H.Interiors = { resolve, valid, apply, furniture, paint, shell, data };
})(window.ByndHome3D);
