(function (H) {
    'use strict';
    const get = id => H.catalogs.roomCatalog.rooms.find(room => room.id === id);
    function placements(room, home) {
        const items = room.furniture.map(item => ({ rotation: 0, ...item }));
        for (const choice of home.placements || []) {
            const slot = room.slots?.[choice.slot], item = H.Furniture.get(choice.furnitureId);
            if (choice.room === room.id && slot && item && slot.types.includes(item.type) && item.width <= slot.width) items.push({ id: 'choice_' + choice.slot, furnitureId: item.id, position: slot.position, rotation: 0, reason: choice.reason });
        }
        return items;
    }
    function shell(room, materials) {
        const T = ByndHomeEngine, group = new T.Group(), S = H.Shapes, theme = materials.theme;
        const [w, d] = room.size;
        S.rounded(group, [w + 0.34, 0.38, d + 0.34], [0, -0.22, 0], materials.get('sage', '#b4b4a0'), 0.16);
        S.rounded(group, [w, 0.16, d], [0, -0.035, 0], materials.get('soft_wood', theme.floor), 0.06);
        const plankGeometry = new T.BoxGeometry(w / 14 - 0.018, 0.015, d - 0.04), planks = new T.InstancedMesh(plankGeometry, materials.get('soft_wood', theme.floor), 14), transform = new T.Object3D();
        for (let i = 0; i < 14; i++) { transform.position.set(-w / 2 + (i + 0.5) * w / 14, 0.054, 0); transform.updateMatrix(); planks.setMatrixAt(i, transform.matrix); }
        planks.receiveShadow = true; group.add(planks);
        S.rounded(group, [w + 0.15, 2.8, 0.16], [0, 1.4, -d / 2], materials.get('milky_plastic', theme.wall), 0.08);
        S.rounded(group, [0.16, 2.8, d], [-w / 2, 1.4, 0], materials.get('milky_plastic', theme.wall), 0.08);
        S.rounded(group, [w, 0.12, 0.13], [0, 0.12, -d / 2 + 0.1], materials.get('soft_wood', '#dbc5a8'));
        S.rounded(group, [0.13, 0.12, d], [-w / 2 + 0.1, 0.12, 0], materials.get('soft_wood', '#dbc5a8'));
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
    function anchor(placement, action, actor = 'char') {
        const item = H.Furniture.get(placement.furnitureId), index = actor === 'user' && item.positions.length > 1 ? 1 : 0;
        let offset = item.positions[index] || [0, 0, 0.85];
        const r = placement.rotation || 0;
        const seated = ['Sit', 'Use Phone', 'Read', 'Watch', 'Use Computer', 'Game', 'Work', 'Hug'].includes(action);
        const lying = ['Sleep', 'Lie'].includes(action);
        if (item.type === 'bed') offset = [offset[0], 0.73, offset[2]];
        if (item.type === 'sofa' && lying) offset = [0.48, 0.6, 0.05];
        if (action === 'Hug') offset = [actor === 'user' ? 0.23 : -0.23, item.type === 'bed' ? 0.73 : 0.54, 0.25];
        return { x: placement.position[0] + offset[0] * Math.cos(r) + offset[2] * Math.sin(r), y: placement.position[1] + offset[1] - (seated ? 0.46 : 0), z: placement.position[2] - offset[0] * Math.sin(r) + offset[2] * Math.cos(r), rotation: r + (item.type === 'desk' ? Math.PI : item.type === 'sofa' && lying ? Math.PI / 2 : 0), lying, seated };
    }
    H.Rooms = { get, placements, shell, anchor };
})(window.ByndHome3D);
