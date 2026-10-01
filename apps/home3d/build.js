(function (H) {
    'use strict';
    const clone = value => JSON.parse(JSON.stringify(value));
    function extent(placement) {
        const item = H.Furniture.get(placement.furnitureId), r = placement.rotation || 0;
        return { x: placement.position[0], z: placement.position[2], width: Math.abs(Math.cos(r)) * item.footprint[0] + Math.abs(Math.sin(r)) * item.footprint[1], depth: Math.abs(Math.cos(r)) * item.footprint[1] + Math.abs(Math.sin(r)) * item.footprint[0] };
    }
    function supported(room, home, placement) {
        const e = extent(placement);
        return H.Rooms.placements(room, home).filter(p => p.id !== placement.id && p.position[1] > placement.position[1] + 0.2 && Math.abs(p.position[0] - e.x) < e.width / 2 && Math.abs(p.position[2] - e.z) < e.depth / 2 && !['frame'].includes(H.Furniture.get(p.furnitureId)?.type));
    }
    function validate(room, home, draft) {
        const item = H.Furniture.get(draft?.furnitureId);
        if (!room || !H.Rooms.available(room, home) || !item || !Array.isArray(draft.position) || draft.position.length !== 3 || !draft.position.every(Number.isFinite) || !Number.isFinite(draft.rotation)) throw new Error('家具位置无效，这次装修没有保存。');
        if (draft.position[1] < 0 || draft.position[1] > 2.5) throw new Error('家具高度超出了房间。');
        const e = extent(draft);
        if (Math.abs(e.x) + e.width / 2 > room.size[0] / 2 - 0.12 || Math.abs(e.z) + e.depth / 2 > room.size[1] / 2 - 0.12) throw new Error('家具要完整放在房间里。');
        const original = H.Rooms.placements(room, home).find(p => p.id === draft.id), children = original ? supported(room, home, original).map(p => p.id) : [];
        const all = H.Rooms.placements(room, home).filter(p => p.id !== draft.id && !children.includes(p.id));
        if (all.some(p => {
            if (Math.abs(p.position[1] - draft.position[1]) > 0.2) return false;
            const other = extent(p);
            return Math.abs(e.x - other.x) < (e.width + other.width) / 2 + 0.04 && Math.abs(e.z - other.z) < (e.depth + other.depth) / 2 + 0.04;
        })) throw new Error('这里已有家具，换一块空地试试。');
        // Every usable object needs at least one floor approach connected to the door.
        const layout = [...all, draft], obstacles = layout.filter(p => p.position[1] < 0.2 && !['prop', 'frame', 'keepsake'].includes(H.Furniture.get(p.furnitureId).type)).map(extent);
        for (const p of layout.filter(p => p.position[1] < 0.2 && H.Furniture.get(p.furnitureId).positions.length)) {
            if (!H.Animation.approach({ x: room.size[0] / 2 - .4, z: room.size[1] / 2 - .4 }, p, obstacles, room.size)) throw new Error('请给' + H.Furniture.get(p.furnitureId).name + '旁边留出走动和使用的空间。');
        }
        return clone(draft);
    }
    function write(home, roomId, placement) {
        home.layouts ||= {};
        home.layouts[roomId] ||= { items: {}, removed: [] };
        const layout = home.layouts[roomId];
        layout.items[placement.id] = clone(placement);
        layout.removed = layout.removed.filter(id => id !== placement.id);
    }
    function commit(roomId, draft, charId = H.State.load().activeCharId) {
        if (!draft?.id || !/^[\w-]{1,100}$/.test(draft.id) || ['__proto__', 'constructor', 'prototype'].includes(draft.id)) throw new Error('家具标识无效。');
        return H.State.withHome((home, data) => {
            if (data.activeCharId !== charId) throw new Error('同住角色已切换，装修没有保存。');
            const room = H.Rooms.get(roomId), placement = validate(room, home, draft);
            if (H.Rooms.placements(room, home).length >= 60 && !H.Rooms.placements(room, home).some(p => p.id === draft.id)) throw new Error('房间里已有很多家具，先收起几件再添加吧。');
            const original = H.Rooms.placements(room, home).find(p => p.id === placement.id);
            if (original) {
                const delta = placement.rotation - (original.rotation || 0), c = Math.cos(delta), s = Math.sin(delta);
                for (const child of supported(room, home, original)) {
                    const dx = child.position[0] - original.position[0], dz = child.position[2] - original.position[2];
                    write(home, roomId, { ...child, position: [placement.position[0] + dx * c + dz * s, child.position[1] + placement.position[1] - original.position[1], placement.position[2] - dx * s + dz * c], rotation: (child.rotation || 0) + delta });
                }
            }
            write(home, roomId, placement); home.activity = null;
            home.moments.push({ id: 'build_' + Date.now(), at: Date.now(), action: 'Furniture', text: '在' + room.name + (original ? '重新摆好了' : '添了一件') + H.Furniture.get(placement.furnitureId).name, source: 'build' });
            home.moments = home.moments.slice(-300);
        });
    }
    function remove(roomId, id) {
        return H.State.withHome(home => {
            const room = H.Rooms.get(roomId), original = room && H.Rooms.placements(room, home).find(p => p.id === id);
            if (!original) throw new Error('这件家具已不在房间中。');
            const rows = [original, ...supported(room, home, original)];
            home.layouts ||= {}; home.layouts[roomId] ||= { items: {}, removed: [] };
            const layout = home.layouts[roomId];
            for (const row of rows) { delete layout.items[row.id]; if (!layout.removed.includes(row.id)) layout.removed.push(row.id); }
            home.activity = null;
        });
    }
    function expand(roomId) {
        return H.State.withHome(home => {
            const room = H.Rooms.get(roomId);
            if (!room?.expandable || !room.size) throw new Error('这个房间暂时不能扩建。');
            home.openRooms ||= []; if (home.openRooms.includes(roomId)) return;
            home.openRooms.push(roomId);
            home.moments.push({ id: 'room_' + Date.now(), at: Date.now(), action: 'Room', text: '家里多了一间' + room.name, source: 'build' });
            home.moments = home.moments.slice(-300);
        });
    }
    H.Build = { extent, validate, commit, remove, expand, supported };
})(window.ByndHome3D);
