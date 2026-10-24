(function (H) {
    'use strict';
    const outdoor = id => ['garden', 'balcony', 'terrace', 'greenhouse'].includes(id) || id.includes('hall') || id === 'landing';
    // All decoration stays against walls or on its own shelf. It never changes
    // furniture footprints, saved layouts, or the character's navigation space.
    function create(room, materials, config) {
        const T = ByndHomeEngine, root = new T.Group(); root.name = 'home-window-garden';
        if (outdoor(room.id)) return root;
        const parts = [], [w, d] = room.size, desk = ['game_room', 'studio'].includes(room.id);
        const ivory = materials.get('milky_plastic', config.trim), wood = materials.get('soft_wood', config.wood), ceramic = materials.get('pastel_ceramic', '#f6f1e7');
        function add(geometry, material, position, rotation) {
            const mesh = new T.Mesh(geometry, material); mesh.position.set(...position); if (rotation) mesh.rotation.set(...rotation);
            mesh.castShadow = mesh.receiveShadow = true; parts.push(mesh); root.add(mesh); return mesh;
        }
        const box = (size, p, mat = ivory) => add(new T.BoxGeometry(...size), mat, p);
        const x = desk ? 0 : 1.55, z = -d / 2 + .13, windowWidth = desk ? 2.6 : 1.55, bottom = 1.25, top = 2.58;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const c = canvas.getContext('2d'), sky = c.createLinearGradient(0, 0, 0, 256);
        sky.addColorStop(0, '#d6e0df'); sky.addColorStop(.65, '#f3f1df'); sky.addColorStop(1, '#b0bda4'); c.fillStyle = sky; c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 32; i++) { c.fillStyle = ['#9cae95', '#b8c4ac', '#ccd1b7'][i % 3]; c.beginPath(); c.ellipse((i * 73) % 290 - 15, 205 + Math.sin(i * 2.4) * 35, 20, 55, Math.sin(i), 0, Math.PI * 2); c.fill(); }
        const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace;
        const glass = new T.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#f6f4dc', emissiveIntensity: .28, roughness: 1 });
        const pane = add(new T.PlaneGeometry(windowWidth, top - bottom), glass, [x, (bottom + top) / 2, z]); pane.castShadow = false;
        pane.userData.ownedTexture = map; pane.userData.ownedMaterial = glass; pane.userData.windowView = true;
        // The window image and daylight overlay have separate day/night states.
        root.userData.atmosphere = { glass, pane, daylight: null, trim: config.trim, window: [x, bottom, z] };
        const ceilingMaterial = new T.MeshBasicMaterial({ color: config.trim, toneMapped: false });
        const ceiling = new T.Mesh(new T.PlaneGeometry(w, d), ceilingMaterial); ceiling.userData.ownedMaterial = ceilingMaterial;
        ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 2.86; ceiling.receiveShadow = true; ceiling.visible = false;
        root.add(ceiling); root.userData.atmosphere.ceiling = ceiling;
        for (const side of [-1, 1]) box([.055, top - bottom + .13, .09], [x + side * (windowWidth / 2 + .025), (top + bottom) / 2, z + .025]);
        for (const y of [bottom - .04, top + .04]) box([windowWidth + .16, .065, .11], [x, y, z + .04]);
        for (const offset of [-windowWidth / 6, windowWidth / 6]) box([.025, top - bottom, .055], [x + offset, (top + bottom) / 2, z + .04]);
        box([windowWidth, .025, .055], [x, 1.86, z + .04]);
        box([windowWidth + .24, .055, .29], [x, bottom - .09, z + .09], wood);
        // Raised slats leave the green view visible below, with a fine pull cord.
        const look = config.look || '';
        if (!look) for (let i = 0; i < 7; i++) box([windowWidth + .06, .037, .08], [x, top - i * .045, z + .09]);
        box([.008, .60, .008], [x + windowWidth / 2 - .08, top - .48, z + .11], wood);
        // Pleated linen uses one static mesh per side, with no cloth simulation.
        const cloth = materials.get('cream_fabric', look === 'retro' ? config.accent : config.trim).clone(); cloth.side = T.DoubleSide;
        for (const side of (look === 'guofeng' || look === 'nordic') ? [] : [-1, 1]) {
            const g = new T.PlaneGeometry(.28, 1.48, 12, 1), p = g.attributes.position;
            for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + .14) / .28 * Math.PI * 7) * .025);
            g.computeVertexNormals(); const curtain = add(g, cloth, [x + side * (windowWidth / 2 + .18), 1.88, z + .14]); curtain.userData.ownedMaterial = cloth;
        }
        const leafMat = materials.get('sage', '#8f9e83'), paleMat = materials.get('sage', '#bac5a5');
        const leaves = [leafMat, paleMat].map(mat => new T.InstancedMesh(new T.SphereGeometry(1, 7, 4), mat, 160)), matrix = new T.Object3D(), counts = [0, 0];
        function leaf(px, py, pz, size, angle, i) {
            const index = i % 2; if (counts[index] >= 160) return;
            matrix.position.set(px, py, pz); matrix.rotation.set(.25 * Math.sin(i), angle, .6 * Math.sin(i * 2.4)); matrix.scale.set(size * .42, size, size * .09); matrix.updateMatrix(); leaves[index].setMatrixAt(counts[index]++, matrix.matrix);
        }
        function plant(px, py, pz, scale, trailing = false) {
            add(new T.CylinderGeometry(.072 * scale, .052 * scale, .12 * scale, 12), ceramic, [px, py + .06 * scale, pz]);
            for (let branch = 0; branch < 4; branch++) {
                const angle = branch * 2.4, length = (trailing ? .46 : .32) * scale;
                for (let i = 0; i < 7; i++) {
                    const t = i / 6, spread = Math.sin(t * 1.8) * .14 * scale, y = py + .12 * scale + (trailing ? -t * length : t * length);
                    leaf(px + Math.sin(angle) * spread, y, pz + Math.cos(angle) * spread, (.065 - t * .021) * scale, angle, i + branch);
                }
            }
        }
        for (const side of [-1, 1]) plant(x + side * windowWidth * .33, bottom - .06, z + .11, side < 0 ? 1 : 1.3);
        plant(x + windowWidth * .16, bottom - .06, z + .13, 1.55);
        // A high picture shelf and hanging foliage add depth around the window.
        const shelfX = desk ? 0 : -1.55, shelfWidth = desk ? 2.8 : 1.9;
        box([shelfWidth, .045, .23], [shelfX, 2.48, z + .08], wood);
        for (let i = 0; i < 7; i++) box([.065, .16 + i % 3 * .035, .13], [shelfX - shelfWidth * .25 + i * .075, 2.58 + i % 3 * .0175, z + .09], i % 3 ? ivory : paleMat);
        plant(shelfX - shelfWidth * .38, 2.51, z + .11, 1.05, true); plant(shelfX + shelfWidth * .35, 2.51, z + .11, 1.2, true);
        for (let side = 0; side < 2; side++) { const mesh = leaves[side]; mesh.count = counts[side]; mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh); }
        // Style-specific dressing that makes each look recognisable at a glance.
        const glowParts = [];
        const art = (pattern, base, ink, secondary, pw, ph, px, py, frameMat, depth = .03) => {
            box([pw + .06, ph + .06, depth], [px, py, z + .02], frameMat);
            const m = materials.surface({ pattern, base, ink, secondary }, 1, 1, 'art');
            const pic = add(new T.PlaneGeometry(pw, ph), m, [px, py, z + .02 + depth / 2 + .002]); pic.castShadow = false;
        };
        if (look === 'guofeng') {
            const dark = materials.get('soft_wood', config.trim), red = materials.get('cream_fabric', '#a8433a');
            // Moon window: a dark wood board with a round opening and a fret grille.
            const board = new T.Shape(); board.moveTo(-windowWidth / 2 - .1, 0); board.lineTo(windowWidth / 2 + .1, 0); board.lineTo(windowWidth / 2 + .1, top - bottom + .16); board.lineTo(-windowWidth / 2 - .1, top - bottom + .16); board.closePath();
            const r = Math.min(windowWidth, top - bottom) / 2 - .02, hole = new T.Path(); hole.absarc(0, (top - bottom + .16) / 2, r, 0, Math.PI * 2, true); board.holes.push(hole);
            add(new T.ExtrudeGeometry(board, { depth: .05, bevelEnabled: false, curveSegments: 40 }), dark, [x, bottom - .08, z + .06]);
            const ring = add(new T.TorusGeometry(r, .03, 8, 48), dark, [x, bottom - .08 + (top - bottom + .16) / 2, z + .12]);
            const cy = bottom - .08 + (top - bottom + .16) / 2;
            for (let i = -3; i <= 3; i++) { const o = i * r / 3.6, half = Math.sqrt(Math.max(0, r * r - o * o)); box([.022, half * 2, .022], [x + o, cy, z + .11], dark); box([half * 2, .022, .022], [x, cy + o, z + .11], dark); }
            // Hanging scrolls with ink landscapes.
            for (const [px, ph] of [[-1.95, 1.05], [-1.3, .9]]) {
                const py = 1.75; art('scroll', '#f3ead6', '#333', '#999', .42, ph, px, py, materials.get('cream_fabric', '#d8c7a6'), .012);
                for (const yy of [py + ph / 2 + .05, py - ph / 2 - .05]) { const rod = add(new T.CylinderGeometry(.018, .018, .56, 10), dark, [px, yy, z + .05]); rod.rotation.z = Math.PI / 2; }
            }
            // Bamboo by the window.
            add(new T.CylinderGeometry(.13, .1, .3, 14), materials.get('pastel_ceramic', '#3f5f73'), [x + windowWidth / 2 + .45, .2, z + .3]);
            for (let i = 0; i < 5; i++) {
                const bx = x + windowWidth / 2 + .38 + (i % 3) * .06, bz = z + .26 + (i % 2) * .07, hh = 1.4 + i * .18;
                add(new T.CylinderGeometry(.014, .016, hh, 6), materials.get('sage', '#7d9a5a'), [bx, .3 + hh / 2, bz]);
                for (let k = 0; k < 6; k++) leaf(bx + Math.sin(k * 2.1 + i) * .09, .7 + hh * (k / 6), bz + Math.cos(k * 2.1 + i) * .06, .09, k * 1.3 + i, k + i);
            }
            // Red silk lanterns: they glow at night.
            for (const lx of [x - windowWidth / 2 - .55, -w / 2 + .9]) {
                const lantern = new T.Group(); lantern.position.set(lx, 2.12, z + .55); lantern.userData.lampHeight = 0;
                const glowMat = materials.glow('#d8473a', .35), gold = materials.get('warm_metal', '#c9a256');
                const body = new T.Mesh(new T.SphereGeometry(.17, 20, 14), glowMat); body.scale.y = .82; lantern.add(body);
                for (const yy of [.15, -.15]) { const cap = new T.Mesh(new T.CylinderGeometry(.07, .07, .04, 16), gold); cap.position.y = yy; lantern.add(cap); }
                const cord = new T.Mesh(new T.CylinderGeometry(.005, .005, .5, 4), gold); cord.position.y = .42; lantern.add(cord);
                const tassel = new T.Mesh(new T.CylinderGeometry(.012, .03, .16, 8), red); tassel.position.y = -.26; lantern.add(tassel);
                lantern.userData.luminousMaterial = glowMat; lantern.traverse(n => { if (n.isMesh) n.castShadow = true; });
                glowParts.push(lantern);
            }
        } else if (look === 'nordic') {
            const black = materials.get('warm_metal', '#2f3337');
            for (const side of [-1, 1]) box([.03, top - bottom + .1, .05], [x + side * (windowWidth / 2 + .02), (top + bottom) / 2, z + .07], black);
            for (const y of [bottom - .03, top + .03, (top + bottom) / 2]) box([windowWidth + .06, .03, .05], [x, y, z + .07], black);
            box([.02, top - bottom, .04], [x, (top + bottom) / 2, z + .07], black);
            art('abstract', '#f6f3ee', '#d9a68b', '#9fb0a6', .5, .66, -1.95, 1.7, black, .02);
            art('abstract', '#f6f3ee', '#2f3337', '#e3d3bd', .38, .5, -1.3, 1.55, black, .02);
            // Pegboard-style shelf with ceramics.
            box([.9, .025, .18], [-.6, 1.35, z + .1], wood);
            for (let i = 0; i < 4; i++) add(new T.CylinderGeometry(.04 + (i % 2) * .02, .05, .1 + i * .03, 12), materials.get('pastel_ceramic', ['#f2efe9', '#2f3337', '#d8c7b0', '#a9b5ac'][i]), [-.9 + i * .2, 1.36 + (.1 + i * .03) / 2, z + .1]);
        } else if (look === 'retro') {
            // Colourful poster wall.
            const frames = materials.get('soft_wood', '#3a2a22');
            art('poster', '#e7b24a', '#d4563c', '#2f7d78', .44, .6, -2.05, 1.85, frames, .025);
            art('poster', '#2f7d78', '#f1d9a8', '#e7b24a', .36, .46, -1.48, 1.95, frames, .025);
            art('poster', '#d4563c', '#f4e3c2', '#7a5236', .32, .32, -1.48, 1.45, frames, .025);
            // A yellow-framed little mirror and a record shelf.
            const yellow = materials.get('cream_fabric', '#e3b23c');
            add(new T.TorusGeometry(.16, .035, 8, 24), yellow, [-.75, 1.75, z + .05]);
            box([.8, .03, .2], [-.6, 1.2, z + .1], wood);
            for (let i = 0; i < 9; i++) box([.012, .22, .2], [-.95 + i * .045, 1.33, z + .1], materials.get('cream_fabric', ['#2f2b2b', '#d4563c', '#e7b24a', '#2f7d78'][i % 4]));
            // String lights along the top of the back wall.
            const bulbMat = materials.glow('#ffd88a', .6), wire = materials.get('warm_metal', '#3a3a36');
            const string = new T.Group(); string.userData.luminousMaterial = bulbMat;
            const span = w - .6, n = 18;
            for (let i = 0; i <= n; i++) {
                const t = i / n, bx = -w / 2 + .3 + t * span, by = 2.55 - Math.sin(t * Math.PI * 3) ** 2 * .16;
                const bulb = new T.Mesh(new T.SphereGeometry(.025, 8, 6), bulbMat); bulb.position.set(bx, by - .03, z + .1); string.add(bulb);
                if (i < n) { const t2 = (i + 1) / n, bx2 = -w / 2 + .3 + t2 * span, by2 = 2.55 - Math.sin(t2 * Math.PI * 3) ** 2 * .16, len = Math.hypot(bx2 - bx, by2 - by); const seg = new T.Mesh(new T.CylinderGeometry(.003, .003, len, 3), wire); seg.position.set((bx + bx2) / 2, (by + by2) / 2, z + .1); seg.rotation.z = Math.atan2(by2 - by, bx2 - bx) - Math.PI / 2; string.add(seg); }
            }
            const lampNode = new T.Group(); lampNode.position.set(0, 2.45, z + .3); lampNode.userData.lampHeight = 0; string.add(lampNode);
            glowParts.push(string);
        }
        // Static decoration is merged by material: details add vertices rather
        // than a draw call each. Interactive furniture remains independent.
        root.updateMatrixWorld(true); const batches = new Map();
        for (const mesh of parts.filter(m => !m.userData.windowView)) {
            const transformed = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), flat = transformed.index ? transformed.toNonIndexed() : transformed;
            if (flat !== transformed) transformed.dispose();
            if (!batches.has(mesh.material)) batches.set(mesh.material, []); batches.get(mesh.material).push(flat);
            mesh.geometry.dispose(); mesh.removeFromParent();
        }
        for (const [material, list] of batches) {
            const geometry = new T.BufferGeometry();
            for (const name of ['position', 'normal', 'uv']) {
                const size = name === 'uv' ? 2 : 3, array = new Float32Array(list.reduce((n, g) => n + g.attributes[name].array.length, 0));
                let offset = 0; for (const g of list) { array.set(g.attributes[name].array, offset); offset += g.attributes[name].array.length; }
                geometry.setAttribute(name, new T.BufferAttribute(array, size));
            }
            list.forEach(g => g.dispose()); geometry.computeBoundingSphere();
            const mesh = new T.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; if (material === cloth) mesh.userData.ownedMaterial = cloth; root.add(mesh);
        }
        // A cached, feathered window projection supplies broad bounced light
        // without a mobile full-screen post-processing pass or extra lights.
        const lightCanvas = document.createElement('canvas'); lightCanvas.width = lightCanvas.height = 256;
        const lc = lightCanvas.getContext('2d'), falloff = lc.createRadialGradient(128, 128, 20, 128, 128, 125);
        falloff.addColorStop(0, 'rgba(255,246,216,.72)'); falloff.addColorStop(.7, 'rgba(255,246,216,.5)'); falloff.addColorStop(1, 'rgba(255,246,216,0)'); lc.fillStyle = falloff; lc.fillRect(0, 0, 256, 256);
        lc.globalCompositeOperation = 'destination-out'; lc.fillStyle = '#000';
        for (let i = 0; i < 5; i++) lc.fillRect(30 + i * 49, 0, 6, 256);
        lc.fillRect(0, 122, 256, 6);
        for (let i = 0; i < 26; i++) { lc.beginPath(); lc.ellipse((i * 79) % 256, (i * 47) % 256, 5, 13, i * .8, 0, Math.PI * 2); lc.fill(); }
        const lightMap = new T.CanvasTexture(lightCanvas); lightMap.colorSpace = T.SRGBColorSpace;
        const lightMaterial = new T.MeshBasicMaterial({ map: lightMap, transparent: true, opacity: .38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
        const wash = new T.Mesh(new T.PlaneGeometry(Math.min(w - .4, windowWidth * 1.8), 3.5), lightMaterial); wash.rotation.x = -Math.PI / 2; wash.rotation.z = -.28;
        wash.position.set(x - .4, .078, -.45); wash.userData.ownedTexture = lightMap; wash.userData.ownedMaterial = lightMaterial; wash.raycast = () => {}; root.add(wash); root.userData.atmosphere.daylight = wash;
        // Sun shafts: soft additive sheets falling from the window to the floor,
        // with a few slow dust motes inside. Cheap on phones, no post-processing.
        const rayCanvas = document.createElement('canvas'); rayCanvas.width = 256; rayCanvas.height = 64;
        const rc = rayCanvas.getContext('2d'), along = rc.createLinearGradient(0, 0, 256, 0);
        along.addColorStop(0, 'rgba(255,236,196,.0)'); along.addColorStop(.08, 'rgba(255,236,196,.85)'); along.addColorStop(.55, 'rgba(255,228,180,.45)'); along.addColorStop(1, 'rgba(255,228,180,0)');
        rc.fillStyle = along; rc.fillRect(0, 0, 256, 64);
        rc.globalCompositeOperation = 'destination-in'; const across = rc.createLinearGradient(0, 0, 0, 64);
        across.addColorStop(0, 'rgba(0,0,0,0)'); across.addColorStop(.25, 'rgba(0,0,0,1)'); across.addColorStop(.75, 'rgba(0,0,0,1)'); across.addColorStop(1, 'rgba(0,0,0,0)'); rc.fillStyle = across; rc.fillRect(0, 0, 256, 64);
        const rayMap = new T.CanvasTexture(rayCanvas); rayMap.colorSpace = T.SRGBColorSpace;
        const rayMaterial = new T.MeshBasicMaterial({ map: rayMap, transparent: true, opacity: .3, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false });
        const rays = new T.Group(); rays.name = 'sun-shafts'; rays.userData.ownedMaterial = rayMaterial; rays.userData.ownedTexture = rayMap;
        const dir = new T.Vector3(-.18, -.6, .78).normalize(), wallZ = z + .02;
        const sheet = (xk, width) => {
            // A ribbon from the window opening down along the light direction.
            const g = new T.BufferGeometry(), y0 = bottom + .05, y1 = top - .05, t0 = y0 / -dir.y, t1 = y1 / -dir.y;
            const v = [xk, y1, wallZ, xk, y0, wallZ, xk + dir.x * t0 + width, .09, wallZ + dir.z * t0, xk + dir.x * t1 + width, .09, wallZ + dir.z * t1];
            g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 1, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
            const m = new T.Mesh(g, rayMaterial); m.raycast = () => {}; m.renderOrder = 3; rays.add(m);
        };
        for (let k = 0; k < 5; k++) sheet(x - windowWidth / 2 + .12 + k * (windowWidth - .24) / 4, (k % 2 ? .05 : -.04));
        const moteGeometry = new T.BufferGeometry(), motes = new Float32Array(36 * 3);
        for (let i = 0; i < 36; i++) { const t = .3 + (i * .618) % 1 * 2.2; motes[i * 3] = x - windowWidth / 2 + ((i * .37) % 1) * windowWidth + dir.x * t; motes[i * 3 + 1] = Math.max(.25, top - .2 - (i * .29 % 1) * 1.1 + dir.y * t * .4); motes[i * 3 + 2] = wallZ + dir.z * t * .8; }
        moteGeometry.setAttribute('position', new T.BufferAttribute(motes, 3));
        const moteMaterial = new T.PointsMaterial({ color: '#fff1d2', size: .028, transparent: true, opacity: .55, depthWrite: false, blending: T.AdditiveBlending });
        const dust = new T.Points(moteGeometry, moteMaterial); dust.userData.ownedMaterial = moteMaterial; dust.raycast = () => {}; rays.add(dust);
        root.add(rays); root.userData.atmosphere.rays = rays; root.userData.atmosphere.rayMaterial = rayMaterial; root.userData.atmosphere.dust = dust;
        for (const part of glowParts) root.add(part);
        root.userData.atmosphere.batches = root.children.length;
        return root;
    }
    function update(groups, lighting, mode, walls = 'cutaway') {
        for (const group of groups) {
            const a = group.userData.atmosphere; if (!a) continue;
            group.visible = walls !== 'hidden' || mode === 'first';
            a.glass.color.set(lighting.night ? '#5a6c80' : '#ffffff'); a.glass.emissiveIntensity = lighting.night ? .035 : .28;
            a.daylight.visible = lighting.daylight > .05; a.daylight.material.opacity = lighting.daylight * .55;
            if (a.rays) {
                const warm = lighting.twilight > .5;
                a.rays.visible = lighting.daylight > .05 && mode !== 'exterior';
                a.rayMaterial.opacity = lighting.daylight * (warm ? .42 : .3); a.rayMaterial.color.set(warm ? '#ffc98a' : '#fff3dc');
                a.dust.material.opacity = lighting.daylight * .5;
            }
            a.ceiling.visible = ['interior', 'first', 'third'].includes(mode);
            a.ceiling.material.color.set(lighting.night ? '#9c8c75' : a.trim);
        }
    }
    function contacts(rows) {
        const T = ByndHomeEngine, selected = rows.filter(r => r.placement.position[1] < (r.placement.floorY || 0) + .15 && !['frame', 'mirror', 'prop', 'keepsake'].includes(r.item.type));
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
        const c = canvas.getContext('2d'), gradient = c.createRadialGradient(32, 32, 9, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(61,53,40,.28)'); gradient.addColorStop(.65, 'rgba(61,53,40,.13)'); gradient.addColorStop(1, 'rgba(61,53,40,0)'); c.fillStyle = gradient; c.fillRect(0, 0, 64, 64);
        const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
        const material = new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        const mesh = new T.InstancedMesh(new T.PlaneGeometry(1, 1), material, selected.length), matrix = new T.Object3D(); mesh.name = 'furniture-contact-shadows'; mesh.raycast = () => {};
        mesh.userData.ownedMaterial = material; mesh.userData.ownedTexture = texture;
        function sync() {
            selected.forEach((row, i) => {
                matrix.position.set(row.model.position.x, (row.placement.floorY || 0) + .080, row.model.position.z); matrix.rotation.set(-Math.PI / 2, 0, row.model.rotation.y);
                matrix.scale.set(row.item.footprint[0] * 1.16, row.item.footprint[1] * 1.16, 1); matrix.updateMatrix(); mesh.setMatrixAt(i, matrix.matrix);
            });
            mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
        }
        sync(); return { mesh, sync };
    }
    H.Atmosphere = { create, update, contacts };
})(window.ByndHome3D);
