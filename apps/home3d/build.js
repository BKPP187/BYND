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
    const label = item => String(item?.name || '家具').split(' · ').at(-1);
    const wallMounted = (item, placement) => ['frame', 'mirror'].includes(item?.type) && placement.position[1] >= .5;
    const tableLike = item => ['table', 'desk'].includes(item?.type) || item?.variant === 'dining';
    // A chair may be tucked partly under the table or desk it faces.
    function tucked(chair, table) {
        const a = H.Furniture.get(chair.furnitureId), b = H.Furniture.get(table.furnitureId);
        if (a?.type !== 'chair' || !tableLike(b)) return false;
        const c = extent(chair), t = extent(table), dx = t.x - c.x, dz = t.z - c.z, length = Math.hypot(dx, dz) || 1;
        if (Math.abs(dx) < t.width / 2 && Math.abs(dz) < t.depth / 2) return false;
        const r = chair.rotation || 0;
        if ((Math.sin(r) * dx + Math.cos(r) * dz) / length < .7) return false;
        const overlapX = (c.width + t.width) / 2 - Math.abs(dx), overlapZ = (c.depth + t.depth) / 2 - Math.abs(dz);
        return Math.min(overlapX, overlapZ) <= Math.min(.5, Math.max(c.width, c.depth) * .7);
    }
    function doorStarts(room) {
        if (window.__byndSingleRoom || !H.Villa?.includes(room.id)) return [{ x: room.size[0] / 2 - .4, z: room.size[1] / 2 - .4 }];
        const plan = H.Villa.plan(room.id), node = plan.nodes.find(n => n.id === room.id);
        const starts = plan.doors.filter(d => d.a === room.id || d.b === room.id).map(d => {
            const local = { x: d.x - node.x, z: d.z - node.z }, axis = d.axis, half = room.size[axis === 'x' ? 0 : 1] / 2;
            local[axis] = Math.sign(local[axis] || 1) * Math.max(0, half - .45);
            return local;
        });
        return starts.length ? starts : [{ x: room.size[0] / 2 - .4, z: room.size[1] / 2 - .4 }];
    }
    function validate(room, home, draft) {
        const item = H.Furniture.get(draft?.furnitureId);
        if (!room || !H.Rooms.available(room, home) || !item || !Array.isArray(draft.position) || draft.position.length !== 3 || !draft.position.every(Number.isFinite) || !Number.isFinite(draft.rotation)) throw new Error('家具位置无效。');
        if (draft.position[1] < 0 || draft.position[1] > 2.5) throw new Error('家具高度超出了房间。');
        const e = extent(draft), margin = wallMounted(item, draft) ? 0 : 0.12;
        if (Math.abs(e.x) + e.width / 2 > room.size[0] / 2 - margin + 1e-6 || Math.abs(e.z) + e.depth / 2 > room.size[1] / 2 - margin + 1e-6) throw new Error('家具要完整放在房间里。');
        if (!window.__byndSingleRoom && H.Villa?.includes(room.id) && draft.position[1] < .2 && !['frame', 'prop', 'keepsake'].includes(item.type)) {
            const plan = H.Villa.plan(room.id), node = plan.nodes.find(n => n.id === room.id);
            const blocked = plan.doors.filter(d => d.a === room.id || d.b === room.id).some(d => {
                const width = d.axis === 'x' ? 1.4 : d.width, depth = d.axis === 'z' ? 1.4 : d.width;
                return Math.abs(e.x + node.x - d.x) < (e.width + width) / 2 && Math.abs(e.z + node.z - d.z) < (e.depth + depth) / 2;
            });
            const stairs = ['stair_hall','landing'].includes(room.id) && Math.abs(e.x + node.x + 5.15) < (e.width + 3) / 2 && Math.abs(e.z + node.z + 4.9) < (e.depth + 4.4) / 2;
            if (blocked || stairs) throw new Error('请给门口和楼梯留出通道。');
        }
        const original = H.Rooms.placements(room, home).find(p => p.id === draft.id), children = original ? supported(room, home, original).map(p => p.id) : [];
        const all = H.Rooms.placements(room, home).filter(p => p.id !== draft.id && !children.includes(p.id));
        if (all.some(p => {
            if (Math.abs(p.position[1] - draft.position[1]) > 0.2) return false;
            const other = extent(p);
            if (!(Math.abs(e.x - other.x) < (e.width + other.width) / 2 + 0.04 - 1e-6 && Math.abs(e.z - other.z) < (e.depth + other.depth) / 2 + 0.04 - 1e-6)) return false;
            return !tucked(draft, p) && !tucked(p, draft);
        })) throw new Error('这里已有家具，换一块空地试试。');
        // Every usable object needs at least one floor approach connected to a door of this room.
        const layout = [...all, draft], obstacles = layout.filter(p => p.position[1] < 0.2 && !['prop', 'frame', 'keepsake'].includes(H.Furniture.get(p.furnitureId).type)).map(extent);
        const starts = doorStarts(room), reachable = p => starts.some(start => H.Animation.approach(start, p, obstacles, room.size));
        if (draft.position[1] < 0.2 && item.positions.length && !reachable(draft)) throw new Error('请给' + label(item) + '旁边留出走动和使用的空间。');
        for (const p of all.filter(p => p.position[1] < 0.2 && H.Furniture.get(p.furnitureId).positions.length)) {
            // Only report a newly blocked neighbour; a layout that was already blocked is not this item's fault.
            if (!reachable(p)) {
                const solid = q => q.position[1] < 0.2 && !['prop', 'frame', 'keepsake'].includes(H.Furniture.get(q.furnitureId).type);
                const before = all.concat(original ? [original] : []).filter(solid).map(extent);
                if (starts.some(start => H.Animation.approach(start, p, before, room.size))) throw new Error('放在这里会挡住其他家具的通道。');
            }
        }
        return clone(draft);
    }
    // Nearest valid floor spot to a preferred point, searched in widening rings.
    function findSpot(room, home, draft, preferred = draft.position, limit = 400) {
        const item = H.Furniture.get(draft.furnitureId); if (!room || !item) return null;
        const step = .1, cx = Math.round(preferred[0] / step) * step, cz = Math.round(preferred[2] / step) * step, candidates = [];
        const hx = room.size[0] / 2, hz = room.size[1] / 2;
        for (let x = -hx; x <= hx; x += step) for (let z = -hz; z <= hz; z += step) {
            const px = Math.round(x * 10) / 10, pz = Math.round(z * 10) / 10;
            candidates.push([Math.hypot(px - cx, pz - cz), px, pz]);
        }
        candidates.sort((a, b) => a[0] - b[0]);
        let tried = 0;
        for (const [, x, z] of candidates) {
            const test = { ...draft, position: [x, draft.position[1], z] }, e = extent(test);
            if (Math.abs(e.x) + e.width / 2 > hx - .12 || Math.abs(e.z) + e.depth / 2 > hz - .12) continue;
            if (++tried > limit) break;
            try { return validate(room, home, test); } catch (_) { /* Try the next ring. */ }
        }
        return null;
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
            const room = H.Rooms.get(roomId);
            let placement; try { placement = validate(room, home, draft); } catch (error) { throw new Error(error.message + '这次装修没有保存。'); }
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
    H.Build = { extent, validate, commit, remove, expand, supported, label, doorStarts, tucked, findSpot };
})(window.ByndHome3D);
