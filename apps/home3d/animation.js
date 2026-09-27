(function (H) {
    'use strict';
    // A small navigation grid prevents wandering through solid furniture.
    function path(start, end, obstacles, size = [6.6, 5.6]) {
        const step = 0.28, cols = Math.floor((size[0] - 0.5) / step), rows = Math.floor((size[1] - 0.5) / step);
        const cell = point => [Math.max(0, Math.min(cols - 1, Math.round((point.x + size[0] / 2 - 0.25) / step))), Math.max(0, Math.min(rows - 1, Math.round((point.z + size[1] / 2 - 0.25) / step)))];
        const point = ([x, z]) => ({ x: x * step - size[0] / 2 + 0.25, z: z * step - size[1] / 2 + 0.25 });
        const key = ([x, z]) => x + ':' + z;
        const a = cell(start), b = cell(end), blocked = c => {
            if (key(c) === key(a) || key(c) === key(b)) return false;
            const p = point(c);
            return obstacles.some(o => Math.abs(p.x - o.x) < o.width / 2 + 0.18 && Math.abs(p.z - o.z) < o.depth / 2 + 0.18);
        };
        const queue = [a], seen = new Set([key(a)]), prev = new Map();
        for (let i = 0; i < queue.length; i++) {
            const c = queue[i]; if (key(c) === key(b)) {
                const result = []; let cursor = b;
                while (key(cursor) !== key(a)) { result.unshift(point(cursor)); cursor = prev.get(key(cursor)); }
                result.push({ x: end.x, z: end.z }); return result;
            }
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const n = [c[0] + dx, c[1] + dz];
                if (n[0] < 0 || n[1] < 0 || n[0] >= cols || n[1] >= rows || seen.has(key(n)) || blocked(n)) continue;
                seen.add(key(n)); prev.set(key(n), c); queue.push(n);
            }
        }
        return [];
    }
    function walk(actor, destination, obstacles, size, finish) {
        const route = path(actor.root.position, destination, obstacles, size);
        if (!route.length && Math.hypot(actor.root.position.x - destination.x, actor.root.position.z - destination.z) > 0.4) return false;
        H.Characters.pose(actor, 'Walk'); actor.path = route; actor.destination = { ...destination, finish }; return true;
    }
    function tick(actor, time, dt, reduced) {
        const t = time * 0.001;
        if (actor.path.length) {
            const goal = actor.path[0], dx = goal.x - actor.root.position.x, dz = goal.z - actor.root.position.z, distance = Math.hypot(dx, dz), move = dt * 1.2;
            actor.root.rotation.y = Math.atan2(dx, dz);
            if (distance <= move) { actor.root.position.x = goal.x; actor.root.position.z = goal.z; actor.path.shift(); }
            else { actor.root.position.x += dx / distance * move; actor.root.position.z += dz / distance * move; }
            actor.legs[0].rotation.x = Math.sin(t * 9) * 0.52; actor.legs[1].rotation.x = -Math.sin(t * 9) * 0.52;
            actor.arms[0].rotation.x = -Math.sin(t * 9) * 0.35; actor.arms[1].rotation.x = Math.sin(t * 9) * 0.35;
            actor.body.position.y = reduced ? 0 : Math.abs(Math.sin(t * 9)) * 0.025;
            if (!actor.path.length) { const destination = actor.destination; actor.destination = null; H.Characters.pose(actor, destination?.action || 'Idle', destination?.anchor); destination?.finish?.(); }
        } else if (!reduced) {
            const sleeping = actor.action === 'Sleep';
            actor.body.scale.y = 1 + Math.sin(t * (sleeping ? 1.7 : 2.2)) * 0.012;
            actor.head.rotation.z = Math.sin(t * 0.75) * (sleeping ? 0.008 : 0.022);
            if (['Wave', 'Happy'].includes(actor.action)) actor.arms[1].rotation.x = Math.sin(t * 7) * 0.3;
            if (['Game', 'Work', 'Use Computer'].includes(actor.action)) actor.arms.forEach((arm, i) => { arm.rotation.x = -0.95 + Math.sin(t * 7 + i) * 0.08; });
        }
        const blink = actor.action === 'Sleep' || (!reduced && (t + (actor.who === 'user' ? 1.3 : 0)) % 5 < 0.14);
        actor.eyes.forEach(eye => { eye.scale.y = blink ? 0.006 : 0.048; });
    }
    H.Animation = { path, walk, tick };
})(window.ByndHome3D);
