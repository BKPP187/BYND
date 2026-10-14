(function (H) {
    'use strict';
    function boxDistance(point, obstacle) {
        return Math.hypot(Math.max(0,Math.abs(point.x-obstacle.x)-obstacle.width/2),Math.max(0,Math.abs(point.z-obstacle.z)-obstacle.depth/2));
    }
    function clear(point, obstacles, size = [6.6, 5.6], radius = .18) {
        if (size.regions) for (let i = -1; i < 8; i++) {
            const a = i * Math.PI / 4, x = point.x + (i < 0 ? 0 : Math.cos(a) * radius), z = point.z + (i < 0 ? 0 : Math.sin(a) * radius);
            if (!size.regions.some(r => Math.abs(x - r.x) <= r.width / 2 + .11 && Math.abs(z - r.z) <= r.depth / 2 + .11)) return false;
        }
        return Number.isFinite(point.x) && Number.isFinite(point.z) && Math.abs(point.x) <= size[0] / 2 - radius - .06 && Math.abs(point.z) <= size[1] / 2 - radius - .06 && !obstacles.some(o => boxDistance(point,o) < radius);
    }
    function segmentClear(a, b, obstacles, size, radius) {
        if (!clear(a, obstacles, size, radius) || !clear(b, obstacles, size, radius)) return false;
        if (size.regions) {
            const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .12);
            for (let i = 1; i < count; i++) if (!clear({ x: a.x + (b.x - a.x) * i / count, z: a.z + (b.z - a.z) * i / count }, [], size, radius)) return false;
        }
        return !obstacles.some(o => {
            let low = 0, high = 1;
            let intersects=true;
            for (const [axis, half] of [['x', o.width / 2], ['z', o.depth / 2]]) {
                const delta = b[axis] - a[axis], min = o[axis] - half, max = o[axis] + half;
                if (Math.abs(delta) < 1e-9) { if (a[axis] < min || a[axis] > max) intersects=false; }
                else { const t1 = (min - a[axis]) / delta, t2 = (max - a[axis]) / delta; low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2)); if (low > high) intersects=false; }
            }
            if(intersects&&high>=0&&low<=1)return true;
            // Exact capsule vs rectangle distance: the centre segment may miss
            // the rectangle while the avatar's circular hull clips a corner.
            if(boxDistance(a,o)<radius||boxDistance(b,o)<radius)return true;
            const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
            for(const x of [o.x-o.width/2,o.x+o.width/2])for(const z of [o.z-o.depth/2,o.z+o.depth/2]){
                const t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/length)):0;
                if(Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<radius)return true;
            }
            return false;
        });
    }
    function nearest(point, obstacles, size, radius = .18) {
        if (clear(point, obstacles, size, radius)) return { x: point.x, z: point.z };
        if (size.regions) {
            // Start near the intended room, avoiding a whole-floor sort for a
            // blocked spawn or chair exit. Search only each new ring perimeter.
            for (let ring = 1; ring <= Math.ceil(Math.max(...size) / .14); ring++) {
                const candidates = [];
                for (let i = -ring; i <= ring; i++) for (const [dx,dz] of [[i,-ring],[i,ring],[-ring,i],[ring,i]]) {
                    const p = { x: point.x + dx * .14, z: point.z + dz * .14 };
                    if (clear(p, obstacles, size, radius)) candidates.push(p);
                }
                if (candidates.length) return candidates.sort((a,b) => Math.hypot(a.x-point.x,a.z-point.z)-Math.hypot(b.x-point.x,b.z-point.z))[0];
            }
            return null;
        }
        const candidates = [];
        for (let x = -size[0] / 2 + radius + .07; x <= size[0] / 2 - radius - .06; x += .14) for (let z = -size[1] / 2 + radius + .07; z <= size[1] / 2 - radius - .06; z += .14) {
            const p = { x, z }; if (clear(p, obstacles, size, radius)) candidates.push(p);
        }
        candidates.sort((a, b) => Math.hypot(a.x - point.x, a.z - point.z) - Math.hypot(b.x - point.x, b.z - point.z));
        return candidates[0] || null;
    }
    // Validate full swept segments, including precise off-grid endpoints. Neither
    // the destination cell nor the start cell gets a furniture-collision exemption.
    function path(start, end, obstacles, size = [6.6, 5.6], radius = .18) {
        if (!clear(start, obstacles, size, radius) || !clear(end, obstacles, size, radius)) return [];
        if (segmentClear(start, end, obstacles, size, radius)) return [{ x: end.x, z: end.z }];
        const step = 0.14, cols = Math.ceil((size[0] - 0.5) / step) + 1, rows = Math.ceil((size[1] - 0.5) / step) + 1;
        const cell = point => [Math.max(0, Math.min(cols - 1, Math.round((point.x + size[0] / 2 - 0.25) / step))), Math.max(0, Math.min(rows - 1, Math.round((point.z + size[1] / 2 - 0.25) / step)))];
        const point = ([x, z]) => ({ x: Math.min(size[0] / 2 - .25, x * step - size[0] / 2 + 0.25), z: Math.min(size[1] / 2 - .25, z * step - size[1] / 2 + 0.25) });
        const key = ([x, z]) => x + ':' + z;
        const connect = p => {
            const [x, z] = cell(p), choices = [];
            for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
                const c = [x + dx, z + dz];
                if (c[0] >= 0 && c[1] >= 0 && c[0] < cols && c[1] < rows && segmentClear(p, point(c), obstacles, size, radius)) choices.push(c);
            }
            choices.sort((a, b) => Math.hypot(point(a).x - p.x, point(a).z - p.z) - Math.hypot(point(b).x - p.x, point(b).z - p.z)); return choices[0];
        };
        const a = connect(start), b = connect(end); if (!a || !b) return [];
        const queue = [a], seen = new Set([key(a)]), prev = new Map();
        for (let i = 0; i < queue.length; i++) {
            const c = queue[i]; if (key(c) === key(b)) {
                const result = []; let cursor = b;
                while (key(cursor) !== key(a)) { result.unshift(point(cursor)); cursor = prev.get(key(cursor)); }
                result.unshift(point(a)); result.push({ x: end.x, z: end.z });
                // Remove grid zigzags only when the complete avatar sweep fits.
                const smooth = []; let from = start, next = 0;
                while (next < result.length) {
                    let farthest = next;
                    for (let j = next + 1; j < result.length; j++) if (segmentClear(from, result[j], obstacles, size, radius)) farthest = j;
                    smooth.push(result[farthest]); from = result[farthest]; next = farthest + 1;
                }
                return smooth;
            }
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const n = [c[0] + dx, c[1] + dz];
                if (n[0] < 0 || n[1] < 0 || n[0] >= cols || n[1] >= rows || seen.has(key(n)) || !segmentClear(point(c), point(n), obstacles, size, radius)) continue;
                seen.add(key(n)); prev.set(key(n), c); queue.push(n);
            }
        }
        return [];
    }
    function walk(actor, destination, obstacles, size, finish) {
        const radius = actor.navigationRadius || .18, route = path(actor.root.position, destination, obstacles, size, radius);
        if (!route.length) return false;
        H.Characters.pose(actor, 'Walk'); actor.path = route; actor.destination = { ...destination, finish }; return true;
    }
    function destination(start, requested, obstacles, size, radius = .18, maxShift = .65) {
        if(!Number.isFinite(requested.x)||!Number.isFinite(requested.z))return null;
        const region=size.regions?.find(r=>Math.abs(requested.x-r.x)<=r.width/2&&Math.abs(requested.z-r.z)<=r.depth/2);
        if(size.regions&&!region)return null;
        const sameRegion=p=>!region||(Math.abs(p.x-region.x)<=region.width/2&&Math.abs(p.z-region.z)<=region.depth/2);
        if(clear(requested,obstacles,size,radius))return path(start,requested,obstacles,size,radius).length?{x:requested.x,z:requested.z}:null;
        const candidates=[];
        for(let ring=.13;ring<=maxShift+.001;ring+=.13)for(let i=0;i<24;i++){const angle=i*Math.PI/12;candidates.push({x:requested.x+Math.cos(angle)*ring,z:requested.z+Math.sin(angle)*ring});}
        const attempted=[];
        for(const candidate of candidates)if(sameRegion(candidate)&&clear(candidate,obstacles,size,radius)){
            if(attempted.some(p=>Math.hypot(p.x-candidate.x,p.z-candidate.z)<.20))continue;
            if(attempted.length>=8)break;attempted.push(candidate);
            if(path(start,candidate,obstacles,size,radius).length)return candidate;
        }
        return null;
    }
    function approach(start, placement, obstacles, size, radius = .18) {
        return H.Rooms.approaches(placement, radius).find(end => clear(end, obstacles, size, radius) && path(start, end, obstacles, size, radius).length);
    }
    function tick(actor, time, dt, reduced) {
        const t = time * 0.001;
        if (actor.path.length) {
            const model = actor.visual === 'model3d', goal = actor.path[0], dx = goal.x - actor.root.position.x, dz = goal.z - actor.root.position.z, distance = Math.hypot(dx, dz), move = dt * (model ? .78 : 1.2);
            const direction = Math.atan2(dx, dz);
            actor.root.rotation.y = model ? actor.root.rotation.y + Math.atan2(Math.sin(direction - actor.root.rotation.y), Math.cos(direction - actor.root.rotation.y)) * (1 - Math.exp(-dt * 14)) : direction;
            if (distance <= move) { actor.root.position.x = goal.x; actor.root.position.z = goal.z; actor.path.shift(); }
            else { actor.root.position.x += dx / distance * move; actor.root.position.z += dz / distance * move; }
            if (Number.isFinite(goal.y)) actor.root.position.y += (goal.y - actor.root.position.y) * Math.min(1, move / Math.max(distance, .0001));
            if (model) {
                const phase = (time - actor.startedAt) * .0058, swing = Math.sin(phase);
                actor.book.visible = actor.phone.visible = actor.cup.visible = false;
                actor.legs.forEach((leg, i) => {
                    const angle = phase + i * Math.PI; leg.rotation.x = Math.sin(angle) * .28;
                    actor.knees[i].rotation.x = Math.max(0, -Math.cos(angle)) * .55;
                    actor.knees[i].children[0].rotation.x = -leg.rotation.x - actor.knees[i].rotation.x;
                    actor.arms[i].rotation.x = -Math.sin(angle) * .18; actor.arms[i].rotation.z = i ? -.10 : .10;
                });
                // The straight stance leg supports the body. No whole-avatar
                // scaling and no bouncing both feet above the floor each step.
                actor.body.position.y = -(actor.modelHeight || 1.55) * .45 * (1 - Math.cos(swing * .28));
            } else {
                actor.legs[0].rotation.x = Math.sin(t * 9) * 0.52; actor.legs[1].rotation.x = -Math.sin(t * 9) * 0.52;
                actor.arms[0].rotation.x = -Math.sin(t * 9) * 0.35; actor.arms[1].rotation.x = Math.sin(t * 9) * 0.35;
                actor.body.position.y = reduced ? 0 : Math.abs(Math.sin(t * 9)) * 0.025;
            }
            if (!actor.path.length) { const destination = actor.destination; actor.destination = null; H.Characters.pose(actor, destination?.action || 'Idle', destination?.anchor); destination?.finish?.(); }
        } else if (!reduced) {
            const sleeping = actor.action === 'Sleep';
            actor.body.scale.y = actor.visual === 'model3d' ? 1 : 1 + Math.sin(t * (sleeping ? 1.7 : 2.2)) * 0.012;
            actor.head.rotation.z = Math.sin(t * 0.75) * (sleeping ? 0.008 : 0.022);
            if (['Wave', 'Happy'].includes(actor.action)) actor.arms[1].rotation.x = Math.sin(t * 7) * 0.3;
            if (['Game', 'Work', 'Use Computer'].includes(actor.action)) actor.arms.forEach((arm, i) => { arm.rotation.x = -0.95 + Math.sin(t * 7 + i) * 0.08; });
            if (actor.action === 'Cook' && actor.visual !== 'model3d') actor.arms.forEach((arm, i) => { arm.rotation.x = -.55 + Math.sin(t * 2.5 + i) * .06; });
        }
        const blink = actor.action === 'Sleep' || (!reduced && (t + (actor.who === 'user' ? 1.3 : 0)) % 5 < 0.14);
        actor.eyes.forEach(eye => { eye.scale.y = blink ? 0.006 : 0.048; });
        if (actor.visual === 'model3d') { H.Cooking?.animate(actor, time, reduced); H.Dining?.animate(actor, time, reduced); H.Hygiene?.animate(actor, time, reduced); H.CharacterModels.updateProps(actor); }
    }
    H.Animation = { path, walk, tick, approach, clear, nearest, destination, segmentClear };
})(window.ByndHome3D);
