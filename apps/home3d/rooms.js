(function (H) {
    'use strict';
    const get = id => H.catalogs.roomCatalog.rooms.find(room => room.id === id);
    const available = (room, home) => !!room && (room.open || (home?.openRooms || []).includes(room.id));
    function placements(room, home) {
        const items = room.furniture.map(item => ({ rotation: 0, ...item }));
        for (const choice of home.placements || []) {
            const slot = room.slots?.[choice.slot], item = H.Furniture.get(choice.furnitureId);
            if (choice.room === room.id && slot && item && slot.types.includes(item.type) && item.width <= slot.width) items.push({ id: 'choice_' + choice.slot, furnitureId: item.id, position: slot.position, rotation: 0, reason: choice.reason });
        }
        const layout = home.layouts?.[room.id];
        if (!layout) return items;
        const result = items.filter(p => !layout.removed.includes(p.id)).map(p => layout.items[p.id] ? { ...p, ...layout.items[p.id] } : p);
        for (const p of Object.values(layout.items)) if (!result.some(row => row.id === p.id) && !layout.removed.includes(p.id)) result.push({ rotation: 0, ...p });
        return result;
    }
    function shell(room, materials) {
        const T = ByndHomeEngine, group = new T.Group(), S = H.Shapes, theme = materials.theme;
        const [w, d] = room.size;
        S.rounded(group, [w + 0.34, 0.38, d + 0.34], [0, -0.22, 0], materials.get('sage', '#b4b4a0'), 0.16);
        const bedroom = room.id === 'bedroom', floorColor = bedroom ? '#e5d5c3' : theme.floor;
        S.rounded(group, [w, 0.16, d], [0, -0.035, 0], materials.get('soft_wood', floorColor), 0.06);
        const plankGeometry = new T.BoxGeometry(w / 14 - 0.018, 0.015, d - 0.04), planks = new T.InstancedMesh(plankGeometry, materials.get('soft_wood', floorColor), 14), transform = new T.Object3D();
        for (let i = 0; i < 14; i++) { transform.position.set(-w / 2 + (i + 0.5) * w / 14, 0.054, 0); transform.updateMatrix(); planks.setMatrixAt(i, transform.matrix); }
        planks.receiveShadow = true; group.add(planks);
        S.rounded(group, [w + 0.15, 2.8, 0.16], [0, 1.4, -d / 2], materials.get('milky_plastic', bedroom ? '#bda5a4' : theme.wall), 0.08);
        S.rounded(group, [0.16, 2.8, d], [-w / 2, 1.4, 0], materials.get('milky_plastic', bedroom ? '#eee5d9' : theme.wall), 0.08);
        S.rounded(group, [w, 0.12, 0.13], [0, 0.12, -d / 2 + 0.1], materials.get('soft_wood', '#dbc5a8'));
        S.rounded(group, [0.13, 0.12, d], [-w / 2 + 0.1, 0.12, 0], materials.get('soft_wood', '#dbc5a8'));
        if (bedroom) { bedroomDecor(group, room, materials); return group; }
        // Recessed pastel window, rounded muntins and linen curtains.
        S.rounded(group, [1.3, 1.3, 0.06], [1.7, 1.77, -d / 2 + 0.11], materials.get('milky_plastic', '#e2ceaa'), 0.06);
        S.rounded(group, [1.14, 1.13, 0.025], [1.7, 1.77, -d / 2 + 0.15], materials.get('milky_plastic', theme === H.catalogs.materialPresets.themes.night ? '#778a9b' : '#c8dcd3'), 0.035);
        for (const x of [1.12, 1.7, 2.28]) S.rounded(group, [0.045, 1.16, 0.045], [x, 1.77, -d / 2 + 0.18], materials.get('paper'), 0.018);
        S.rounded(group, [1.2, 0.045, 0.045], [1.7, 1.77, -d / 2 + 0.18], materials.get('paper'), 0.018);
        S.rounded(group, [1.5, 0.08, 0.26], [1.7, 1.1, -d / 2 + 0.18], materials.get('soft_wood'));
        for (const x of [0.96, 2.46]) for (let i = 0; i < 3; i++) S.rounded(group, [0.12, 1.45, 0.15], [x + i * 0.075, 1.75, -d / 2 + 0.2], materials.get('cream_fabric'), 0.06);
        // A soft oval rug. Real geometry, no pre-rendered room image.
        const rug = new T.Mesh(new T.CylinderGeometry(1, 1, 0.025, 48), materials.get('cream_fabric', room.id === 'bedroom' ? '#dac3bc' : '#c8ceb2'));
        rug.scale.set(room.id === 'bedroom' ? 2 : 1.65, 1, 1.35); rug.position.set(0, 0.085, room.id === 'game_room' ? 0.5 : 0.55); rug.receiveShadow = true; group.add(rug);
        // Wall pegs, a tiny shelf, and two cups give the shared home a lived-in scale.
        S.rounded(group, [1.15, 0.09, 0.27], [-1.5, 1.33, -d / 2 + 0.15], materials.get('soft_wood'));
        for (let i = 0; i < 3; i++) { const book = S.rounded(group, [0.14, 0.26 + i * 0.035, 0.15], [-1.83 + i * 0.18, 1.48, -d / 2 + 0.18], materials.get(i % 2 ? 'rose' : 'sage'), 0.012); book.rotation.z = i === 2 ? -0.12 : 0; }
        // A teddy clock keeps the miniature playful without adding a texture download.
        const clock = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.055, 32), materials.get('pastel_ceramic', '#e3c2a5')); clock.rotation.z = -Math.PI / 2; clock.position.set(-w / 2 + 0.13, 1.9, 0.65); group.add(clock);
        const face = new T.Mesh(new T.CircleGeometry(0.235, 32), materials.get('paper')); face.rotation.y = Math.PI / 2; face.position.set(-w / 2 + 0.162, 1.9, 0.65); group.add(face);
        for (const z of [0.43, 0.87]) S.sphere(group, [0.06, 0.09, 0.09], [-w / 2 + 0.13, 2.13, z], materials.get('pastel_ceramic', '#e3c2a5'));
        S.rounded(group, [0.02, 0.15, 0.02], [-w / 2 + 0.175, 1.96, 0.65], materials.get('soft_wood'), 0.008);
        S.rounded(group, [0.02, 0.02, 0.12], [-w / 2 + 0.175, 1.9, 0.7], materials.get('soft_wood'), 0.008);
        return group;
    }
    function bedroomDecor(group, room, materials) {
        const T = ByndHomeEngine, S = H.Shapes, [w, d] = room.size;
        const cream = materials.get('paper', '#f8eee0'), rose = materials.get('cream_fabric', '#d7b9b9');
        const box = (size, p, mat = cream, r = .035) => S.rounded(group, size, p, mat, r);
        // A paneled rose wall, light wood trim and an arched reading window.
        const ribs = new T.InstancedMesh(new T.BoxGeometry(.028, 2.65, .022), materials.get('soft_wood', '#ab908f'), 28), matrix = new T.Object3D();
        for (let i = 0; i < 28; i++) { matrix.position.set(-w / 2 + .13 + i * (w - .26) / 27, 1.43, -d / 2 + .092); matrix.updateMatrix(); ribs.setMatrixAt(i, matrix.matrix); }
        ribs.receiveShadow = true; group.add(ribs);
        box([w, .085, .13], [0, 2.74, -d / 2 + .08]); box([.13, .085, d], [-w / 2 + .08, 2.74, 0]);
        const window = new T.Group(); window.position.set(-w / 2 + .12, .66, -.18); window.rotation.y = Math.PI / 2; group.add(window);
        const arch = (radius, stem, mat, z) => {
            const shape = new T.Shape(); shape.moveTo(-radius, 0); shape.lineTo(radius, 0); shape.lineTo(radius, stem); shape.absarc(0, stem, radius, 0, Math.PI, false); shape.lineTo(-radius, 0);
            const mesh = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .045, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .02, bevelThickness: .015 }), mat);
            mesh.position.z = z; window.add(mesh); return mesh;
        };
        arch(.93, 1.0, materials.get('soft_wood', '#c9ad8a'), 0);
        arch(.84, .99, materials.glow(materials.night ? '#536b8a' : '#c4d8d6', .15), .065);
        S.rounded(window, [.035, 1.70, .025], [0, .87, .13], cream, .01);
        S.rounded(window, [1.62, .035, .025], [0, .78, .13], cream, .01);
        S.rounded(window, [2.25, .10, .45], [0, -.015, .17], materials.get('soft_wood', '#d7bca1'), .04);
        // Full-height draped linen with a top rail and small fabric ties.
        S.rounded(window, [2.45, .055, .06], [0, 2.0, .18], materials.get('warm_metal'), .025);
        for (const side of [-1, 1]) {
            for (let i = 0; i < 4; i++) {
                const x = side * (.86 + i * .10);
                S.rounded(window, [.14, 1.93, .15], [x, .96, .20 + (i % 2) * .06], materials.woven('#e7d9ca', 'stripe'), .065);
            }
            S.rounded(window, [.38, .07, .20], [side * 1.0, .67, .24], rose, .035);
        }
        // The window seat is a wall ledge, outside the navigation area.
        for (const x of [-.48, .38]) S.rounded(window, [.52, .20, .35], [x, .15, .20], materials.woven(x < 0 ? '#cfb0b5' : '#b8c5b0', 'gingham'), .09);
        const vine = materials.get('sage', '#94ab90');
        for (let i = 0; i < 7; i++) { const x = -.72 + i * .24, y = 1.12 + Math.sqrt(Math.max(0, .88 * .88 - x * x)); S.sphere(window, [.11, .07, .045], [x, y, .17], vine); }
        // Rectangular woven rug, bound edges and fringe, with space to walk around it.
        box([3.5, .026, 2.55], [0, .08, .35], materials.woven('#d3b3b5', 'knit'), .012);
        for (const z of [-.86, 1.56]) box([3.4, .009, .04], [0, .098, z], cream, .004);
        const fringe = new T.InstancedMesh(new T.BoxGeometry(.028, .012, .12), cream, 36);
        for (let i = 0; i < 36; i++) { matrix.position.set(-1.62 + (i % 18) * .19, .085, i < 18 ? -.99 : 1.69); matrix.updateMatrix(); fringe.setMatrixAt(i, matrix.matrix); } group.add(fringe);
        // One small shelf of personal things above the bedside area.
        box([1.16, .07, .24], [-1.67, 2.15, -d / 2 + .21], materials.get('soft_wood', '#d4b898'));
        for (let i = 0; i < 4; i++) box([.11, .22 + i * .025, .13], [-2.08 + i * .13, 2.31, -d / 2 + .21], materials.get('cream_fabric', ['#c4b1bd', '#ede0cc', '#aebeaa', '#e1bec0'][i]), .006);
        S.sphere(group, [.075, .10, .075], [-1.29, 2.28, -d / 2 + .22], materials.get('pastel_ceramic', '#e8d5bf'));
        for (let i = 0; i < 3; i++) { box([.012, .19, .012], [-1.29 + i * .035, 2.41, -d / 2 + .22], vine, .004); S.sphere(group, [.052, .06, .048], [-1.29 + i * .035, 2.5, -d / 2 + .22], rose); }
        // Small warm sconces create localized light rather than a yellow wash.
        for (const x of [-2.25, 1.95]) {
            box([.13, .22, .04], [x, 1.69, -d / 2 + .14], materials.get('warm_metal'));
            box([.34, .09, .18], [x, 1.73, -d / 2 + .22], cream);
            box([.25, .026, .10], [x, 1.67, -d / 2 + .22], materials.glow('#ffddaa', 1.2), .01);
            group.add(localLight(T, x, 1.61, -d / 2 + .38, materials.night ? 2.2 : .7, 2.8));
        }
    }
    function localLight(T, x, y, z, strength, distance) { const light = new T.PointLight('#ffd4a1', strength, distance, 2); light.position.set(x, y, z); return light; }
    function anchor(placement, action, actor = 'char') {
        const item = H.Furniture.get(placement.furnitureId), index = actor === 'user' && item.positions.length > 1 ? 1 : 0;
        let offset = item.positions[index] || [0, 0, 0.85];
        const r = placement.rotation || 0;
        const seated = ['Sit', 'Use Phone', 'Read', 'Watch', 'Use Computer', 'Game', 'Work', 'Hug', 'Play Music', 'Bathe'].includes(action);
        const lying = ['Sleep', 'Lie'].includes(action);
        const support = H.Furniture.support(item);
        let rotation = r + (item.type === 'desk' ? Math.PI : 0), poseWidth, poseLength, headOffset, headLift = 0, seatFront = 0;
        if (item.type === 'bed') {
            offset = [offset[0], lying ? support.sleepHeight : support.seatHeight, lying ? 0 : item.footprint[1] / 2 - .12];
            poseWidth = item.footprint[0] * .43; poseLength = item.footprint[1] * .76;
            headOffset = -item.footprint[1] * .44; headLift = .17; seatFront = .14;
        }
        if (['sofa', 'chair'].includes(item.type) && seated) {
            offset = [offset[0], support.seatHeight, support.seatDepth];
            poseWidth = item.type === 'sofa' ? item.footprint[0] * .4 : item.footprint[0] * .7;
            seatFront = support.seatFront - support.seatDepth;
        }
        if (item.type === 'table' && item.style === 'japanese') offset = [offset[0], 0, offset[2]];
        if (item.type === 'sofa' && lying) {
            offset = [0, support.seatHeight + .045, support.seatDepth]; rotation = r + Math.PI / 2;
            poseLength = item.footprint[0] - .5; poseWidth = item.footprint[1] * .63;
            headOffset = -poseLength / 2; headLift = .06;
        }
        // Keep each person on their own cushion. Compressing the two portrait
        // roots to +/- .25 made the heads and bodies occupy the same space.
        if (action === 'Hug' && item.type !== 'sofa') offset[0] = actor === 'user' ? .25 : -.25;
        return { placementId: placement.id, x: placement.position[0] + offset[0] * Math.cos(r) + offset[2] * Math.sin(r), y: placement.position[1] + offset[1] + (seated || lying ? 0 : .07), z: placement.position[2] - offset[0] * Math.sin(r) + offset[2] * Math.cos(r), rotation, lying, seated, poseWidth, poseLength, headOffset, headLift, seatFront };
    }
    function approaches(placement) {
        const item = H.Furniture.get(placement.furnitureId), r = placement.rotation || 0;
        return [[0, item.footprint[1] / 2 + .45], [-item.footprint[0] * .65, item.footprint[1] / 2 + .45], [item.footprint[0] * .65, item.footprint[1] / 2 + .45], [-item.footprint[0] / 2 - .45, 0], [item.footprint[0] / 2 + .45, 0]].map(([x, z]) => ({ x: placement.position[0] + x * Math.cos(r) + z * Math.sin(r), z: placement.position[2] - x * Math.sin(r) + z * Math.cos(r) }));
    }
    H.Rooms = { get, available, placements, shell, anchor, approaches };
})(window.ByndHome3D);
