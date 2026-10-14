(function (H) {
    'use strict';
    const get = id => H.catalogs.roomCatalog.rooms.find(room => room.id === id);
    const available = (room, home) => !!room && (room.open || (!window.__byndSingleRoom && H.Villa?.includes(room.id)) || (home?.openRooms || []).includes(room.id));
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
        const seated = ['Sit', 'Use Phone', 'Read', 'Watch', 'Use Computer', 'Game', 'Work', 'Hug', 'Play Music', 'Bathe', 'Use Toilet'].includes(action) || (item.variant==='dining'&&['Eat','Drink'].includes(action));
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
            offset = [0, support.seatHeight + .045, .20]; rotation = r + Math.PI / 2;
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
        const hygiene=H.Hygiene?.station(item,action);
        if(hygiene){offset=[...hygiene.offset];if(item.type==='mirror')offset[1]=-(placement.position[1]-(placement.floorY||0));rotation=r+(hygiene.faceBack?Math.PI:0);}
        return { seatId: seated && ['sofa', 'chair'].includes(item.type) ? placement.id : undefined, floorY: placement.floorY || 0, hygiene: hygiene ? { action, hand: hygiene.hand && transform(hygiene.hand) } : null, cooking, placementId: placement.id, furnitureType: item.type, headBoundary: lying && ['bed', 'sofa'].includes(item.type) ? -(item.type === 'bed' ? item.footprint[1] : item.footprint[0]) / 2 + .24 : undefined, pillowOffset: item.type === 'bed' ? -item.footprint[1] * .33 : undefined, quiltSurface: support.quiltSurface === undefined ? undefined : placement.position[1] + support.quiltSurface, restSurface: support.restSurface === undefined ? undefined : placement.position[1] + support.restSurface, pillowSurface: support.pillowSurface === undefined ? undefined : placement.position[1] + support.pillowSurface, x: placement.position[0] + offset[0] * Math.cos(r) + offset[2] * Math.sin(r), y: placement.position[1] + offset[1] + (seated || lying ? 0 : .07), z: placement.position[2] - offset[0] * Math.sin(r) + offset[2] * Math.cos(r), rotation, lying, seated, poseWidth, poseLength, headOffset, headLift, seatFront };
    }
    function approaches(placement, radius = .18) {
        const item = H.Furniture.get(placement.furnitureId), r = placement.rotation || 0;
        const gap = Math.max(.45, radius + .12);
        return [[0, item.footprint[1] / 2 + gap], [-item.footprint[0] * .65, item.footprint[1] / 2 + gap], [item.footprint[0] * .65, item.footprint[1] / 2 + gap], [-item.footprint[0] / 2 - gap, 0], [item.footprint[0] / 2 + gap, 0]].map(([x, z]) => ({ x: placement.position[0] + x * Math.cos(r) + z * Math.sin(r), z: placement.position[2] - x * Math.sin(r) + z * Math.cos(r) }));
    }
    function useRow(rows, row, action) {
        if(row.item.type==='mirror'&&action==='Groom')return rows.find(parent=>parent.area===row.area&&parent.item.type==='vanity'&&Math.hypot(parent.placement.position[0]-row.placement.position[0],parent.placement.position[2]-row.placement.position[2])<1.2)||row;
        if (row.item.type !== 'computer' || !['Game', 'Work', 'Use Computer'].includes(action)) return row;
        return rows.find(parent => parent.area === row.area && parent.item.type === 'desk' && parent.item.actions.includes(action) &&
            row.placement.position[1] > parent.placement.position[1] + .2 &&
            Math.abs(row.placement.position[0] - parent.placement.position[0]) <= parent.item.footprint[0] / 2 &&
            Math.abs(row.placement.position[2] - parent.placement.position[2]) <= parent.item.footprint[1] / 2);
    }
    function seatConflict(candidate, other) {
        if (!other) return false;
        const id = candidate.seatId || candidate.placementId, occupiedId = other.seatId || other.placementId;
        return id === occupiedId && (candidate.lying || other.lying || Math.hypot(candidate.x - other.x, candidate.z - other.z) < .45);
    }
    function watchSeat(rows, row, who, reserved) {
        const r = row.placement.rotation || 0;
        row.model?.updateMatrixWorld(true);
        const screen = row.model?.getObjectByName('television-screen');
        const target = screen ? screen.getWorldPosition(new ByndHomeEngine.Vector3()).toArray() : [row.placement.position[0], row.placement.position[1] + .36, row.placement.position[2]];
        const seats = [];
        for (const seat of rows.filter(s => s.area === row.area && ['sofa', 'chair'].includes(s.item.type))) {
            for (const slot of seat.item.positions.length > 1 ? [who, who === 'user' ? 'char' : 'user'] : [who]) {
                const a = { ...anchor(seat.placement, 'Sit', slot, seat.item), seatId: seat.placement.id, placementId: row.placement.id, gazeTarget: target, watchingTV: true };
                const dx = target[0] - a.x, dz = target[2] - a.z, distance = Math.hypot(dx, dz);
                // A screen is watched from its front, from an actual seat facing
                // broadly toward it. Keep the pelvis and legs in the seat frame.
                const face = (-dx * Math.sin(r) - dz * Math.cos(r)) / distance;
                const forward = (dx * Math.sin(a.rotation) + dz * Math.cos(a.rotation)) / distance;
                if (distance < .6 || distance > 6 || face < .2 || forward < .25 || reserved.some(other => seatConflict(a, other))) continue;
                seats.push({ anchor: a, score: distance + (seat.item.type === 'sofa' ? 0 : 3) + (slot === who ? 0 : .1) });
            }
        }
        seats.sort((a, b) => a.score - b.score); return seats[0]?.anchor || null;
    }
    function anchorInRoom(rows, row, action, who, reserved = []) {
        if (row.item.type === 'television' && action === 'Watch') return watchSeat(rows, row, who, reserved);
        if (action === 'Watch' && ['sofa', 'chair'].includes(row.item.type)) {
            const televisions = rows.filter(r => r.area === row.area && r.item.type === 'television');
            for (const tv of televisions) { const seat = watchSeat([row], tv, who, reserved); if (seat) return seat; }
            return null;
        }
        const result = anchor(row.placement, action, who, row.item);
        if (!result.seated || !(row.item.type === 'desk' || row.item.variant === 'dining')) return result;
        const seats = rows.filter(seat => seat.area === row.area && seat.item.type === 'chair' && seat.placement.position[1] < (row.placement.floorY || 0) + .2).filter(seat => {
            const dx = row.placement.position[0] - seat.placement.position[0], dz = row.placement.position[2] - seat.placement.position[2], distance = Math.hypot(dx, dz), r = seat.placement.rotation || 0;
            return distance < 1.8 && distance > .1 && (dx * Math.sin(r) + dz * Math.cos(r)) / distance > .5;
        }).map(seat => ({ seat, anchor: anchor(seat.placement, 'Sit', who, seat.item) })).sort((a, b) => Math.hypot(a.anchor.x - result.x, a.anchor.z - result.z) - Math.hypot(b.anchor.x - result.x, b.anchor.z - result.z));
        let preferred = result;
        // Adjacent seats share the same table edge. Never move a character off
        // a real chair to manufacture a closer couple pose in a saved layout.
        if (row.item.variant === 'dining' && !seats.some(s => Math.hypot(s.anchor.x - result.x, s.anchor.z - result.z) < .55)) {
            const p = row.placement.position, r = row.placement.rotation || 0, z = (result.x - p[0]) * Math.sin(r) + (result.z - p[2]) * Math.cos(r);
            const otherEdge = { x: result.x - 2 * z * Math.sin(r), z: result.z - 2 * z * Math.cos(r) };
            if (seats.some(s => Math.hypot(s.anchor.x - otherEdge.x, s.anchor.z - otherEdge.z) < .55)) preferred = otherEdge;
        }
        seats.sort((a, b) => Math.hypot(a.anchor.x - preferred.x, a.anchor.z - preferred.z) - Math.hypot(b.anchor.x - preferred.x, b.anchor.z - preferred.z));
        const chosen = seats[0];
        if (!chosen || Math.hypot(chosen.anchor.x - preferred.x, chosen.anchor.z - preferred.z) > .55) return null;
        let meal;
        if (row.item.variant === 'dining') {
            const [w, d] = row.item.footprint, p = row.placement.position, r = row.placement.rotation || 0, dx = chosen.anchor.x - p[0], dz = chosen.anchor.z - p[2];
            const x = Math.sign(dx * Math.cos(r) - dz * Math.sin(r) || 1) * w * .21, z = Math.sign(dx * Math.sin(r) + dz * Math.cos(r) || 1) * d * .29;
            meal = { plate: [p[0] + x * Math.cos(r) + z * Math.sin(r), p[1] + (row.item.height || .78) + .058, p[2] - x * Math.sin(r) + z * Math.cos(r)] };
        }
        return { ...chosen.anchor, meal, placementId: row.placement.id, furnitureType: row.item.type, seatId: chosen.seat.placement.id };
    }
    function sharedActions(item) {
        const choices = item.type === 'bed' ? { Sleep: '一起睡觉', Lie: '一起躺一会儿' } : item.type === 'sofa' ? { Sit: '并肩坐坐', Read: '一起看书', Watch: '一起看电视', 'Use Phone': '一起坐着看手机' } : item.type === 'television' ? { Watch: '一起看电视' } : item.variant === 'dining' ? { Eat: '一起吃饭', Drink: '一起喝点东西' } : {};
        return Object.fromEntries(Object.entries(choices).filter(([action]) => item.actions.includes(action)));
    }
    function sharedAnchors(rows, requested, action) {
        if (!sharedActions(requested.item)[action]) throw Error('这件家具适合单人使用。');
        const row = useRow(rows, requested, action);
        const first = anchorInRoom(rows, row, action, 'user', []), second = first && anchorInRoom(rows, row, action, 'char', [first]);
        const sharedBed = row.item.type === 'bed' && first?.lying && second?.lying;
        if (!first || !second || Math.hypot(first.x-second.x,first.z-second.z) < .45 || (!sharedBed && seatConflict(first,second))) throw Error('这里还没有两个可用的位置，先留出双人座位再一起使用。');
        return { row, anchors: [first,second] };
    }
    H.Rooms = { get, available, placements, shell, anchor, approaches, useRow, anchorInRoom, seatConflict, sharedActions, sharedAnchors };
})(window.ByndHome3D);
