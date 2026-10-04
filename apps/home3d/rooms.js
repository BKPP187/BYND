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
    function shell(room, materials, home) { return H.Interiors.shell(room, materials, home); }
    function anchor(placement, action, actor = 'char', renderedItem) {
        const item = renderedItem || H.Furniture.get(placement.furnitureId), index = actor === 'user' && item.positions.length > 1 ? 1 : 0;
        let offset = item.positions[index] || [0, 0, 0.85];
        const r = placement.rotation || 0;
        const seated = ['Sit', 'Use Phone', 'Read', 'Watch', 'Use Computer', 'Game', 'Work', 'Hug', 'Play Music', 'Bathe'].includes(action) || (item.variant==='dining'&&['Eat','Drink'].includes(action));
        const lying = ['Sleep', 'Lie'].includes(action);
        const support = H.Furniture.support(item);
        if (action === 'Sleep' && item.type === 'bed') { support.restSurface = support.mattressSurface; support.quiltSurface = support.mattressSurface; }
        let rotation = r + (item.type === 'desk' || ['Cook', 'Care'].includes(action) ? Math.PI : 0), poseWidth, poseLength, headOffset, headLift = 0, seatFront = 0;
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
        if ((item.type==='desk'||item.variant==='dining')&&seated) { offset=[offset[0],support.seatHeight,offset[2]];rotation=r+Math.PI;seatFront=support.seatFront-support.seatDepth; }
        if (item.type === 'table' && item.style === 'japanese') offset = [offset[0], 0, offset[2]];
        if (item.type === 'sofa' && lying) {
            offset = [0, support.seatHeight + .045, support.seatDepth]; rotation = r + Math.PI / 2;
            poseLength = item.footprint[0] - .5; poseWidth = item.footprint[1] * .63;
            headOffset = -poseLength / 2; headLift = .06;
        }
        // Keep each person on their own cushion. Compressing the two portrait
        // roots to +/- .25 made the heads and bodies occupy the same space.
        if (action === 'Hug' && item.type !== 'sofa') offset[0] = actor === 'user' ? .25 : -.25;
        const station = action === 'Cook' && H.Cooking?.station(item);
        // Stand in front of the actual pan/board so both hands can reach it.
        if (station) offset = [station.tip[0] - .025, 0, item.footprint[1] / 2 + .20];
        const transform = (v, point = true) => [(point ? placement.position[0] : 0) + v[0] * Math.cos(r) + v[2] * Math.sin(r), (point ? placement.position[1] : 0) + v[1], (point ? placement.position[2] : 0) - v[0] * Math.sin(r) + v[2] * Math.cos(r)];
        const cooking = station ? { mode: station.mode, tip: transform(station.tip), vector: transform(station.vector, false), hold: transform(station.hold), rotation: r } : null;
        return { cooking, placementId: placement.id, furnitureType: item.type, headBoundary: lying && ['bed', 'sofa'].includes(item.type) ? -(item.type === 'bed' ? item.footprint[1] : item.footprint[0]) / 2 + .24 : undefined, pillowOffset: item.type === 'bed' ? -item.footprint[1] * .33 : undefined, quiltSurface: support.quiltSurface === undefined ? undefined : placement.position[1] + support.quiltSurface, restSurface: support.restSurface === undefined ? undefined : placement.position[1] + support.restSurface, pillowSurface: support.pillowSurface === undefined ? undefined : placement.position[1] + support.pillowSurface, x: placement.position[0] + offset[0] * Math.cos(r) + offset[2] * Math.sin(r), y: placement.position[1] + offset[1] + (seated || lying ? 0 : .07), z: placement.position[2] - offset[0] * Math.sin(r) + offset[2] * Math.cos(r), rotation, lying, seated, poseWidth, poseLength, headOffset, headLift, seatFront };
    }
    function approaches(placement, radius = .18) {
        const item = H.Furniture.get(placement.furnitureId), r = placement.rotation || 0;
        const gap = Math.max(.45, radius + .12);
        return [[0, item.footprint[1] / 2 + gap], [-item.footprint[0] * .65, item.footprint[1] / 2 + gap], [item.footprint[0] * .65, item.footprint[1] / 2 + gap], [-item.footprint[0] / 2 - gap, 0], [item.footprint[0] / 2 + gap, 0]].map(([x, z]) => ({ x: placement.position[0] + x * Math.cos(r) + z * Math.sin(r), z: placement.position[2] - x * Math.sin(r) + z * Math.cos(r) }));
    }
    function useRow(rows, row, action) {
        if (row.item.type !== 'computer' || !['Game', 'Work', 'Use Computer'].includes(action)) return row;
        return rows.find(parent => parent.item.type === 'desk' && parent.item.actions.includes(action) &&
            row.placement.position[1] > parent.placement.position[1] + .2 &&
            Math.abs(row.placement.position[0] - parent.placement.position[0]) <= parent.item.footprint[0] / 2 &&
            Math.abs(row.placement.position[2] - parent.placement.position[2]) <= parent.item.footprint[1] / 2);
    }
    function anchorInRoom(rows, row, action, who) {
        const result = anchor(row.placement, action, who, row.item);
        if (!result.seated || !(row.item.type === 'desk' || row.item.variant === 'dining')) return result;
        const seats = rows.filter(seat => seat.item.type === 'chair' && seat.placement.position[1] < .2).filter(seat => {
            const dx = row.placement.position[0] - seat.placement.position[0], dz = row.placement.position[2] - seat.placement.position[2], distance = Math.hypot(dx, dz), r = seat.placement.rotation || 0;
            return distance < 1.8 && distance > .1 && (dx * Math.sin(r) + dz * Math.cos(r)) / distance > .5;
        }).map(seat => ({ seat, anchor: anchor(seat.placement, 'Sit', who, seat.item) })).sort((a, b) => Math.hypot(a.anchor.x - result.x, a.anchor.z - result.z) - Math.hypot(b.anchor.x - result.x, b.anchor.z - result.z));
        const chosen = seats[0];
        if (!chosen || Math.hypot(chosen.anchor.x - result.x, chosen.anchor.z - result.z) > .55) return null;
        return { ...chosen.anchor, placementId: row.placement.id, furnitureType: row.item.type, seatId: chosen.seat.placement.id };
    }
    H.Rooms = { get, available, placements, shell, anchor, approaches, useRow, anchorInRoom };
})(window.ByndHome3D);
