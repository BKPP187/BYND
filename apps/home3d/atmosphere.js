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
        for (let i = 0; i < 7; i++) box([windowWidth + .06, .037, .08], [x, top - i * .045, z + .09]);
        box([.008, .60, .008], [x + windowWidth / 2 - .08, top - .48, z + .11], wood);
        // Pleated linen uses one static mesh per side, with no cloth simulation.
        const cloth = materials.get('cream_fabric', config.trim).clone(); cloth.side = T.DoubleSide;
        for (const side of [-1, 1]) {
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
        root.userData.atmosphere.batches = root.children.length;
        return root;
    }
    function update(groups, lighting, mode, walls = 'cutaway') {
        for (const group of groups) {
            const a = group.userData.atmosphere; if (!a) continue;
            group.visible = walls !== 'hidden' || mode === 'first';
            a.glass.color.set(lighting.night ? '#5a6c80' : '#ffffff'); a.glass.emissiveIntensity = lighting.night ? .035 : .28;
            a.daylight.visible = lighting.daylight > .05; a.daylight.material.opacity = lighting.daylight * .40;
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
