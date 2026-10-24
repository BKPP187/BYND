/* 2.5D 小屋 · one room as an isometric diorama: floor slab, two back walls, window, rug,
   furniture solids in painter's order, two portrait dolls and a day/night layer.
   Pan with one finger, pinch or wheel to zoom, tap furniture / people / floor. */
(function (H) {
    'use strict';
    const A = H.Art, { P, K } = A;
    const C = A.S * Math.cos(Math.PI / 6), N = A.S * .5, V = A.S;
    const WALL_H = 2.75, SLAB = .22, T = .14, DOLL_H = 1.42;
    const OUTDOOR = new Set(['balcony', 'terrace', 'greenhouse']);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const rd = v => Math.round(v * 10) / 10;
    const poly = list => A.pts(list);

    function interior(room, home) {
        const it = H.catalogs.materialPresets.interiors, saved = home?.interiors?.[room.id] || {};
        const id = saved.preset || it.defaultPreset || it.defaults?.[room.id] || 'garden', preset = it.presets[id] || it.presets.garden;
        const wall = it.walls[saved.wall || preset.wall] || it.walls.limewash, floor = it.floors[saved.floor || preset.floor] || it.floors.pale_parquet;
        // A touch warmer than the 3D textures: flat illustration needs more colour to read.
        const warm = (c, t, to = '#f6dfc4') => A.mix(c, to, t);
        return { ...preset, id, wall: { ...wall, base: warm(wall.base, wall.pattern === 'plaster' ? .6 : .4, '#fcebcf'), ink: warm(wall.ink, .2), secondary: warm(wall.secondary, .25, '#f7d9d0') }, floor: { ...floor, base: warm(floor.base, .22, '#e7c39a'), ink: warm(floor.ink, .2, '#c99d72'), secondary: warm(floor.secondary, .2, '#ecd0aa') }, trim: preset.trim ? A.mix(preset.trim, '#fff8ee', .3) : undefined, furniture: saved.furniture || {} };
    }
    function timeOfDay(now = new Date()) {
        const h = now.getHours() + now.getMinutes() / 60;
        if (h >= 6.5 && h < 16.5) return 'day';
        if (h >= 16.5 && h < 19) return 'dusk';
        if (h >= 5.5 && h < 6.5) return 'dawn';
        return 'night';
    }

    // ---------- patterns in plane space (meters) ----------
    function wallPattern(id, wall, matrix) {
        const b = wall.base, ink = wall.ink, sec = wall.secondary;
        const head = '<pattern id="' + id + '" patternUnits="userSpaceOnUse" patternTransform="matrix(' + matrix + ')" ';
        switch (wall.pattern) {
            case 'stripe': return head + 'width="0.32" height="1"><rect width="0.32" height="1" fill="' + b + '"/><rect x="0.02" width="0.07" height="1" fill="' + ink + '" opacity=".55"/><rect x="0.12" width="0.012" height="1" fill="' + sec + '" opacity=".35"/></pattern>';
            case 'brick': return head + 'width="0.5" height="0.18"><rect width="0.5" height="0.18" fill="' + sec + '"/><rect x="0.006" y="0.006" width="0.238" height="0.078" rx="0.012" fill="' + b + '"/><rect x="0.256" y="0.006" width="0.238" height="0.078" rx="0.012" fill="' + A.mix(b, ink, .35) + '"/><rect x="-0.119" y="0.096" width="0.238" height="0.078" rx="0.012" fill="' + A.mix(b, ink, .2) + '"/><rect x="0.131" y="0.096" width="0.238" height="0.078" rx="0.012" fill="' + b + '"/><rect x="0.381" y="0.096" width="0.238" height="0.078" rx="0.012" fill="' + A.mix(b, ink, .45) + '"/></pattern>';
            case 'floral': case 'pastel_flower': {
                const stripe = wall.pattern === 'pastel_flower' ? '<rect x="0.0" width="0.11" height="0.6" fill="' + ink + '" opacity=".7"/>' : '';
                const flower = (x, y, c) => [0, 72, 144, 216, 288].map(a => '<circle cx="' + rd3(x + Math.cos(a * Math.PI / 180) * .022) + '" cy="' + rd3(y + Math.sin(a * Math.PI / 180) * .022) + '" r="0.016" fill="' + c + '"/>').join('') + '<circle cx="' + x + '" cy="' + y + '" r="0.01" fill="#f6e7b8"/>';
                return head + 'width="0.44" height="0.6"><rect width="0.44" height="0.6" fill="' + b + '"/>' + stripe + flower(.27, .14, sec) + flower(.38, .45, wall.pattern === 'pastel_flower' ? sec : ink) + '<path d="M0.27 0.17 q0.03 0.08 -0.01 0.14 M0.38 0.48 q-0.04 0.06 0 0.1" stroke="' + (wall.pattern === 'pastel_flower' ? '#a9cdb8' : ink) + '" stroke-width="0.008" fill="none" opacity=".7"/></pattern>';
            }
            case 'damask': return head + 'width="0.4" height="0.52"><rect width="0.4" height="0.52" fill="' + b + '"/><path d="M0.2 0.06 C0.27 0.16 0.3 0.2 0.2 0.32 C0.1 0.2 0.13 0.16 0.2 0.06 Z" fill="' + ink + '" opacity=".55"/><circle cx="0" cy="0.42" r="0.02" fill="' + sec + '" opacity=".45"/><circle cx="0.4" cy="0.42" r="0.02" fill="' + sec + '" opacity=".45"/></pattern>';
            case 'wood': return head + 'width="0.24" height="1"><rect width="0.24" height="1" fill="' + b + '"/><rect width="0.008" height="1" fill="' + ink + '"/><rect x="0.1" width="0.004" height="1" fill="' + sec + '" opacity=".35"/></pattern>';
            default: return head + 'width="1.6" height="1.2"><rect width="1.6" height="1.2" fill="' + b + '"/><ellipse cx="0.4" cy="0.3" rx="0.5" ry="0.22" fill="' + sec + '" opacity=".22"/><ellipse cx="1.2" cy="0.85" rx="0.55" ry="0.25" fill="' + ink + '" opacity=".1"/></pattern>';
        }
    }
    const rd3 = v => Math.round(v * 1000) / 1000;
    function floorPattern(id, floor, matrix, outdoor) {
        const b = floor.base, ink = floor.ink, sec = floor.secondary;
        const head = '<pattern id="' + id + '" patternUnits="userSpaceOnUse" patternTransform="matrix(' + matrix + ')" ';
        if (outdoor) return head + 'width="1.2" height="0.16"><rect width="1.2" height="0.16" fill="#c9a983"/><rect y="0.15" width="1.2" height="0.01" fill="#a98a66"/><rect x="0.7" width="0.008" height="0.16" fill="#a98a66"/></pattern>';
        switch (floor.pattern) {
            case 'checker': return head + 'width="0.9" height="0.9"><rect width="0.9" height="0.9" fill="' + sec + '"/><rect width="0.45" height="0.45" fill="' + ink + '"/><rect x="0.45" y="0.45" width="0.45" height="0.45" fill="' + ink + '"/><path d="M0 0 H0.9 M0 0.45 H0.9 M0 0 V0.9 M0.45 0 V0.9" stroke="#ffffff" stroke-width="0.008" opacity=".5"/></pattern>';
            case 'marble': return head + 'width="1.8" height="1.8"><rect width="1.8" height="1.8" fill="' + b + '"/><path d="M0 0.4 C0.4 0.3 0.6 0.8 1.1 0.6 S1.6 1.1 1.8 1.0 M0.2 1.5 C0.6 1.2 0.9 1.6 1.3 1.4" stroke="' + ink + '" stroke-width="0.012" fill="none" opacity=".5"/><path d="M0 0 H1.8 M0 0.9 H1.8 M0 0 V1.8 M0.9 0 V1.8" stroke="' + sec + '" stroke-width="0.01"/></pattern>';
            case 'tatami': return head + 'width="1.8" height="0.9"><rect width="1.8" height="0.9" fill="' + b + '"/><rect x="0.02" y="0.02" width="1.76" height="0.86" fill="none" stroke="' + ink + '" stroke-width="0.04"/><path d="M0.1 0.15 H1.7 M0.1 0.3 H1.7 M0.1 0.45 H1.7 M0.1 0.6 H1.7 M0.1 0.75 H1.7" stroke="' + sec + '" stroke-width="0.006" opacity=".6"/></pattern>';
            case 'herringbone': return head + 'width="0.4" height="0.4"><rect width="0.4" height="0.4" fill="' + b + '"/><path d="M0 0.1 L0.2 0.3 L0.4 0.1 M0 0.3 L0.2 0.5 L0.4 0.3 M0 -0.1 L0.2 0.1 L0.4 -0.1" stroke="' + ink + '" stroke-width="0.01" fill="none"/><path d="M0.2 0.1 V0.3" stroke="' + sec + '" stroke-width="0.006"/></pattern>';
            default: return head + 'width="1.2" height="0.36"><rect width="1.2" height="0.36" fill="' + b + '"/><rect y="0.18" width="1.2" height="0.18" fill="' + sec + '" opacity=".55"/><path d="M0 0.0 H1.2 M0 0.18 H1.2 M0.35 0 V0.18 M0.95 0.18 V0.36" stroke="' + ink + '" stroke-width="0.008"/></pattern>';
        }
    }

    function defs(cfg, tod, outdoor) {
        const W = cfg.W, D = cfg.D, wall = cfg.interior.wall, floor = cfg.interior.floor;
        const back = [C, N, 0, -V, rd(D / 2 * C), rd(-D / 2 * N)].join(' '), left = [-C, N, 0, -V, rd(-W / 2 * C), rd(-W / 2 * N)].join(' '), ground = [C, N, -C, N, 0, 0].join(' ');
        const sky = { day: ['#bfe1f2', '#eef7f6'], dawn: ['#f4c9b7', '#fbe8d6'], dusk: ['#f2b48e', '#f9d9b9'], night: ['#26304f', '#3d4870'] }[tod];
        const fabric = cfg.interior.fabric || '#efe7dc';
        return '<defs>' +
            '<linearGradient id="h25-vshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#3b2a2c" stop-opacity=".1"/></linearGradient>' +
            '<linearGradient id="h25-cylshade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#3b2a2c" stop-opacity=".22"/></linearGradient>' +
            '<radialGradient id="h25-ballshade" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#3b2a2c" stop-opacity=".2"/></radialGradient>' +
            '<linearGradient id="h25-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + (tod === 'night' ? '#7fb2d9' : '#55707f') + '"/><stop offset=".55" stop-color="#34424e"/><stop offset="1" stop-color="#28333d"/></linearGradient>' +
            '<linearGradient id="h25-mirror" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4fafb"/><stop offset=".4" stop-color="#d4e7ec"/><stop offset=".5" stop-color="#f1f8f9"/><stop offset="1" stop-color="#bcd6dd"/></linearGradient>' +
            '<linearGradient id="h25-water" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9eff3"/><stop offset="1" stop-color="#a7d4e0"/></linearGradient>' +
            '<linearGradient id="h25-photo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d9cf"/><stop offset=".6" stop-color="#f3e7d6"/><stop offset=".61" stop-color="#b9cfa5"/><stop offset="1" stop-color="#9dbb8c"/></linearGradient>' +
            '<linearGradient id="h25-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky[0] + '"/><stop offset="1" stop-color="' + sky[1] + '"/></linearGradient>' +
            '<radialGradient id="h25-lampglow"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".75"/><stop offset=".45" stop-color="#ffd38a" stop-opacity=".25"/><stop offset="1" stop-color="#ffd38a" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="h25-sunglow"><stop offset="0" stop-color="#fff6dc" stop-opacity=".55"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient>' +
            '<filter id="h25-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>' +
            '<filter id="h25-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>' +
            wallPattern('h25-wall-back', wall, back) + wallPattern('h25-wall-left', wall, left) + floorPattern('h25-floor', floor, ground, outdoor) +
            '<pattern id="h25-curtain" patternUnits="userSpaceOnUse" patternTransform="matrix(' + back + ')" width="0.12" height="1"><rect width="0.12" height="1" fill="' + fabric + '"/><rect width="0.05" height="1" fill="#fff" opacity=".28"/><rect x="0.09" width="0.03" height="1" fill="#5b4141" opacity=".08"/></pattern>' +
            '<pattern id="h25-curtain-left" patternUnits="userSpaceOnUse" patternTransform="matrix(' + left + ')" width="0.12" height="1"><rect width="0.12" height="1" fill="' + fabric + '"/><rect width="0.05" height="1" fill="#fff" opacity=".22"/><rect x="0.09" width="0.03" height="1" fill="#5b4141" opacity=".1"/></pattern>' +
            '</defs>';
    }

    // ---------- window placement ----------
    function chooseWindow(cfg, owners) {
        const { W, D } = cfg, width = 1.3;
        const blocked = (axis, c) => owners.some(bb => axis === 'back'
            ? bb[2] < -D / 2 + .75 && (bb[1] > .8 || bb[4] > 1.6) && bb[0] < c + width / 2 + .32 && bb[3] > c - width / 2 - .32
            : bb[0] < -W / 2 + .75 && (bb[1] > .8 || bb[4] > 1.6) && bb[2] < c + width / 2 + .32 && bb[5] > c - width / 2 - .32);
        for (const c of [W / 2 - 1.35, 0.6, -0.6, -W / 2 + 1.5]) if (!blocked('back', c)) return { wall: 'back', c, width };
        for (const c of [D / 2 - 1.4, 0, -D / 2 + 1.5]) if (!blocked('left', c)) return { wall: 'left', c, width };
        return null;
    }
    function windowSvg(win, cfg, tod) {
        if (!win) return { wall: '', floor: '' };
        const { W, D } = cfg, y0 = 1.02, y1 = 2.3, a = win.c - win.width / 2, b = win.c + win.width / 2;
        const at = win.wall === 'back' ? (u, y, out = 0) => [u, y, -D / 2 + out] : (u, y, out = 0) => [-W / 2 + out, y, u];
        const trim = cfg.interior.trim || '#f6f1e8', glassId = 'url(#h25-sky)';
        const quad = (u0, v0, u1, v1, out = 0) => poly([at(u0, v0, out), at(u1, v0, out), at(u1, v1, out), at(u0, v1, out)]);
        let s = '<g class="h25-window">';
        s += '<polygon points="' + quad(a - .07, y0 - .07, b + .07, y1 + .07, .002) + '" fill="' + trim + '"/>';
        s += '<polygon points="' + quad(a, y0, b, y1, .004) + '" fill="' + glassId + '"/>';
        if (tod === 'night') {
            const moon = P(...at(b - .32, y1 - .3, .005));
            s += '<circle cx="' + rd(moon[0]) + '" cy="' + rd(moon[1]) + '" r="11" fill="#fdf2c9" opacity=".95"/>';
            for (const [u, v] of [[a + .25, y1 - .2], [a + .5, y1 - .45], [b - .55, y1 - .62]]) { const q = P(...at(u, v, .005)); s += '<circle cx="' + rd(q[0]) + '" cy="' + rd(q[1]) + '" r="2.2" fill="#fff" opacity=".85"/>'; }
        } else {
            for (const [u, v, r] of [[a + .3, y1 - .35, 15], [a + .48, y1 - .32, 12]]) { const q = P(...at(u, v, .005)); s += '<ellipse cx="' + rd(q[0]) + '" cy="' + rd(q[1]) + '" rx="' + r * 1.6 + '" ry="' + r * .7 + '" fill="#fff" opacity=".75"/>'; }
            const hill = [at(a, y0 + .18, .005), at(a + .45, y0 + .34, .005), at(b - .3, y0 + .22, .005), at(b, y0 + .3, .005), at(b, y0, .005), at(a, y0, .005)];
            s += '<polygon points="' + poly(hill) + '" fill="' + (tod === 'day' ? '#b8d2a6' : '#d9b79a') + '" opacity=".8"/>';
        }
        s += '<polygon points="' + quad(win.c - .025, y0, win.c + .025, y1, .006) + '" fill="' + trim + '"/>';
        s += '<polygon points="' + quad(a, (y0 + y1) / 2 - .02, b, (y0 + y1) / 2 + .02, .006) + '" fill="' + trim + '"/>';
        const pat = win.wall === 'back' ? 'url(#h25-curtain)' : 'url(#h25-curtain-left)';
        s += '<polygon points="' + poly([at(a - .36, y1 + .2, .01), at(a + .1, y1 + .2, .01), at(a - .04, 1.55, .01), at(a + .02, y0 - .12, .01), at(a - .36, y0 - .12, .01)]) + '" fill="' + pat + '"/>';
        s += '<polygon points="' + poly([at(b + .36, y1 + .2, .01), at(b - .1, y1 + .2, .01), at(b + .04, 1.55, .01), at(b - .02, y0 - .12, .01), at(b + .36, y0 - .12, .01)]) + '" fill="' + pat + '"/>';
        const r0 = P(...at(a - .45, y1 + .24, .02)), r1 = P(...at(b + .45, y1 + .24, .02));
        s += '<line x1="' + rd(r0[0]) + '" y1="' + rd(r0[1]) + '" x2="' + rd(r1[0]) + '" y2="' + rd(r1[1]) + '" stroke="#c9a774" stroke-width="3" stroke-linecap="round"/>';
        s += '<polygon points="' + quad(a - .1, y0 - .1, b + .1, y0 - .04, .05) + '" fill="' + A.light(trim, .2) + '"/>';
        s += '</g>';
        let floor = '';
        if (tod !== 'night') {
            const sun = win.wall === 'back'
                ? [[a + .2, 0, -D / 2 + .25], [b + .2, 0, -D / 2 + .25], [b + 1.1, 0, -D / 2 + 2.4], [a + 1.1, 0, -D / 2 + 2.4]]
                : [[-W / 2 + .25, 0, a + .2], [-W / 2 + .25, 0, b + .2], [-W / 2 + 2.4, 0, b + 1.1], [-W / 2 + 2.4, 0, a + 1.1]];
            floor = '<polygon class="h25-sun" points="' + poly(sun) + '" fill="' + (tod === 'day' ? '#fff8e6' : '#ffd9b0') + '" opacity="' + (tod === 'day' ? .42 : .34) + '" filter="url(#h25-blur)"/>';
        }
        return { wall: s, floor };
    }

    function rugFor(cfg, rows) {
        const pick = rows.find(r => r.item.type === 'table' && r.item.variant !== 'dining' && r.placement.position[1] < .1)
            || rows.find(r => r.item.variant === 'dining') || rows.find(r => r.item.type === 'bed') || rows.find(r => r.item.type === 'chair' && r.placement.position[1] < .1);
        if (!pick) return '';
        const e = H.Build.extent(pick.placement), item = pick.item;
        let w = e.width + 1.2, d = e.depth + 1.0, x = e.x, z = e.z;
        if (item.type === 'bed') { w = e.width + .9; d = e.depth * .78; z = e.z + e.depth * .2; }
        if (item.type === 'chair') { w = 1.7; d = 1.5; }
        if (item.type === 'table' && item.variant !== 'dining') { w = Math.max(2.4, e.width + 1.3); d = Math.max(1.7, e.depth + 1.1); }
        const accent = A.mix(cfg.interior.accent || '#a9c7ba', '#eeb9b6', .45), base = A.light(accent, .5), x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, inset = .12;
        return '<g class="h25-rug"><polygon points="' + poly([[x0, .004, z0], [x1, .004, z0], [x1, .004, z1], [x0, .004, z1]]) + '" fill="' + base + '" stroke="' + base + '" stroke-width="10" stroke-linejoin="round"/>' +
            '<polygon points="' + poly([[x0 + inset, .006, z0 + inset], [x1 - inset, .006, z0 + inset], [x1 - inset, .006, z1 - inset], [x0 + inset, .006, z1 - inset]]) + '" fill="none" stroke="' + A.light(accent, .15) + '" stroke-width="3.2" stroke-linejoin="round"/>' +
            '<polygon points="' + poly([[x0 + .26, .006, z0 + .26], [x1 - .26, .006, z0 + .26], [x1 - .26, .006, z1 - .26], [x0 + .26, .006, z1 - .26]]) + '" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="5 6" stroke-linejoin="round"/></g>';
    }

    function shell(cfg, tod, outdoor) {
        const { W, D } = cfg, wh = outdoor ? 1.0 : WALL_H, it = cfg.interior, trim = it.trim || '#f4efe6';
        const slabTop = A.light(it.floor.base, .1), slabSide = A.dark(it.floor.base, .12);
        let s = '';
        // Slab
        s += '<polygon points="' + poly([[-W / 2 - T, 0, D / 2], [W / 2, 0, D / 2], [W / 2, -SLAB, D / 2], [-W / 2 - T, -SLAB, D / 2]]) + '" fill="' + slabSide + '"/>';
        s += '<polygon points="' + poly([[W / 2, 0, -D / 2 - T], [W / 2, 0, D / 2], [W / 2, -SLAB, D / 2], [W / 2, -SLAB, -D / 2 - T]]) + '" fill="' + A.dark(slabSide, .14) + '"/>';
        s += '<polygon points="' + poly([[-W / 2 - T, 0, D / 2], [W / 2, 0, D / 2], [W / 2, 0, D / 2 + .012], [-W / 2 - T, 0, D / 2 + .012]]) + '" fill="' + slabTop + '"/>';
        // Floor
        s += '<polygon class="h25-floor" points="' + poly([[-W / 2, 0, -D / 2], [W / 2, 0, -D / 2], [W / 2, 0, D / 2], [-W / 2, 0, D / 2]]) + '" fill="url(#h25-floor)"/>';
        // Walls (inner faces, caps, cut ends)
        const backWall = poly([[-W / 2, 0, -D / 2], [W / 2, 0, -D / 2], [W / 2, wh, -D / 2], [-W / 2, wh, -D / 2]]);
        const leftWall = poly([[-W / 2, 0, -D / 2], [-W / 2, 0, D / 2], [-W / 2, wh, D / 2], [-W / 2, wh, -D / 2]]);
        let walls = '<polygon points="' + backWall + '" fill="' + (outdoor ? '#efe3d2' : 'url(#h25-wall-back)') + '"/>';
        walls += '<polygon points="' + leftWall + '" fill="' + (outdoor ? '#e6d8c4' : 'url(#h25-wall-left)') + '"/>';
        walls += '<polygon points="' + leftWall + '" fill="#3b2a2c" opacity=".07"/>';
        // Soft corner shading where the walls meet
        walls += '<polygon points="' + poly([[-W / 2, 0, -D / 2], [-W / 2 + .7, 0, -D / 2], [-W / 2 + .7, wh, -D / 2], [-W / 2, wh, -D / 2]]) + '" fill="#3b2a2c" opacity=".05"/>';
        walls += '<polygon points="' + poly([[-W / 2, 0, -D / 2], [W / 2, 0, -D / 2], [W / 2, .5, -D / 2], [-W / 2, .5, -D / 2]]) + '" fill="#3b2a2c" opacity=".035"/>';
        if (outdoor) {
            for (let x = -W / 2 + .25; x < W / 2; x += .32) walls += '<line x1="' + rd(P(x, .05, -D / 2 + .01)[0]) + '" y1="' + rd(P(x, .05, -D / 2 + .01)[1]) + '" x2="' + rd(P(x, wh - .08, -D / 2 + .01)[0]) + '" y2="' + rd(P(x, wh - .08, -D / 2 + .01)[1]) + '" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>';
        }
        // Wainscot panel on plain walls: warmer, more lived-in.
        if (!outdoor && !['brick', 'wood'].includes(it.wall.pattern)) {
            const panel = A.mix(trim, it.wall.base, .35), rail = A.light(trim, .25);
            walls += '<polygon points="' + poly([[-W / 2, 0, -D / 2 + .012], [W / 2, 0, -D / 2 + .012], [W / 2, .92, -D / 2 + .012], [-W / 2, .92, -D / 2 + .012]]) + '" fill="' + panel + '"/>';
            walls += '<polygon points="' + poly([[-W / 2 + .012, 0, -D / 2], [-W / 2 + .012, 0, D / 2], [-W / 2 + .012, .92, D / 2], [-W / 2 + .012, .92, -D / 2]]) + '" fill="' + A.dark(panel, .07) + '"/>';
            for (let x = -W / 2 + .55; x < W / 2 - .2; x += .62) walls += '<polygon points="' + poly([[x - .24, .2, -D / 2 + .014], [x + .24, .2, -D / 2 + .014], [x + .24, .76, -D / 2 + .014], [x - .24, .76, -D / 2 + .014]]) + '" fill="none" stroke="' + A.dark(panel, .1) + '" stroke-width="1.4" opacity=".55"/>';
            for (let z = -D / 2 + .55; z < D / 2 - .2; z += .62) walls += '<polygon points="' + poly([[-W / 2 + .014, .2, z - .24], [-W / 2 + .014, .2, z + .24], [-W / 2 + .014, .76, z + .24], [-W / 2 + .014, .76, z - .24]]) + '" fill="none" stroke="' + A.dark(panel, .16) + '" stroke-width="1.4" opacity=".5"/>';
            walls += '<polygon points="' + poly([[-W / 2, .9, -D / 2 + .016], [W / 2, .9, -D / 2 + .016], [W / 2, .96, -D / 2 + .016], [-W / 2, .96, -D / 2 + .016]]) + '" fill="' + rail + '"/>';
            walls += '<polygon points="' + poly([[-W / 2 + .016, .9, -D / 2], [-W / 2 + .016, .9, D / 2], [-W / 2 + .016, .96, D / 2], [-W / 2 + .016, .96, -D / 2]]) + '" fill="' + A.dark(rail, .08) + '"/>';
        }
        // Baseboards
        walls += '<polygon points="' + poly([[-W / 2, 0, -D / 2 + .02], [W / 2, 0, -D / 2 + .02], [W / 2, .1, -D / 2 + .02], [-W / 2, .1, -D / 2 + .02]]) + '" fill="' + trim + '"/>';
        walls += '<polygon points="' + poly([[-W / 2 + .02, 0, -D / 2], [-W / 2 + .02, 0, D / 2], [-W / 2 + .02, .1, D / 2], [-W / 2 + .02, .1, -D / 2]]) + '" fill="' + A.dark(trim, .08) + '"/>';
        // Crown
        if (!outdoor) {
            walls += '<polygon points="' + poly([[-W / 2, wh - .07, -D / 2 + .01], [W / 2, wh - .07, -D / 2 + .01], [W / 2, wh, -D / 2 + .01], [-W / 2, wh, -D / 2 + .01]]) + '" fill="' + trim + '"/>';
            walls += '<polygon points="' + poly([[-W / 2 + .01, wh - .07, -D / 2], [-W / 2 + .01, wh - .07, D / 2], [-W / 2 + .01, wh, D / 2], [-W / 2 + .01, wh, -D / 2]]) + '" fill="' + A.dark(trim, .06) + '"/>';
        }
        // Caps and cut ends (dollhouse slice)
        const cap = A.light(trim, .3), cut = A.dark(it.wall.base, .22);
        walls += '<polygon points="' + poly([[-W / 2 - T, wh, -D / 2 - T], [W / 2, wh, -D / 2 - T], [W / 2, wh, -D / 2], [-W / 2, wh, -D / 2], [-W / 2, wh, D / 2], [-W / 2 - T, wh, D / 2]]) + '" fill="' + cap + '"/>';
        walls += '<polygon points="' + poly([[W / 2, -SLAB, -D / 2 - T], [W / 2, -SLAB, -D / 2], [W / 2, wh, -D / 2], [W / 2, wh, -D / 2 - T]]) + '" fill="' + A.dark(cut, .12) + '"/>';
        walls += '<polygon points="' + poly([[-W / 2 - T, -SLAB, D / 2], [-W / 2, -SLAB, D / 2], [-W / 2, wh, D / 2], [-W / 2 - T, wh, D / 2]]) + '" fill="' + cut + '"/>';
        return { floor: s, walls };
    }

    // ---------- doll sprites ----------
    const DOLLS = {
        user: { stand: 'assets/home3d/illustrated/doll-user-v1.png', sleep: 'assets/home3d/illustrated/doll-user-sleep-v1.png', ratio: 232 / 440 },
        char: { stand: 'assets/home3d/illustrated/doll-char-v1.png', sleep: 'assets/home3d/illustrated/doll-char-sleep-v1.png', ratio: 213 / 440 }
    };

    function mount(container, options = {}) {
        let cfg = null, staticPrims = [], owners = new Map(), lights = [], disposed = false, raf = 0, last = 0;
        let zoom = 1, tx = 0, ty = 0, base = 1, vb = [0, 0, 1, 1];
        const actors = { user: null, char: null };
        container.innerHTML = '<div class="h25-stage"><div class="h25-canvas"><svg class="h25-svg" xmlns="http://www.w3.org/2000/svg"></svg><div class="h25-overlay"></div></div></div>';
        const stage = container.querySelector('.h25-stage'), world = container.querySelector('.h25-canvas'), svg = container.querySelector('svg'), overlay = container.querySelector('.h25-overlay');
        let objectsLayer = null, actorLayerDirty = true;

        function setTransform() {
            const sw = stage.clientWidth, sh = stage.clientHeight, cw = vb[2] * base * zoom, ch = vb[3] * base * zoom;
            const minX = Math.min(0, sw - cw - 24), maxX = Math.max(sw - cw, 24), minY = Math.min(0, sh - ch - 24), maxY = Math.max(sh - ch, 24);
            if (cw <= sw) tx = (sw - cw) / 2; else tx = Math.max(minX, Math.min(maxX > 0 ? 24 : maxX, tx));
            if (ch <= sh) ty = (sh - ch) / 2; else ty = Math.max(minY, Math.min(24, ty));
            world.style.transform = 'translate3d(' + rd(tx) + 'px,' + rd(ty) + 'px,0) scale(' + (zoom).toFixed(4) + ')';
            overlay.style.setProperty('--h25-unzoom', (1 / zoom).toFixed(4));
        }
        function fit() {
            const sw = stage.clientWidth || 360, sh = stage.clientHeight || 600;
            base = Math.min((sw - 16) / vb[2], (sh - 16) / vb[3]);
            svg.setAttribute('width', rd(vb[2] * base)); svg.setAttribute('height', rd(vb[3] * base)); svg.style.width = rd(vb[2] * base) + 'px'; svg.style.height = rd(vb[3] * base) + 'px';
            world.style.width = rd(vb[2] * base) + 'px'; world.style.height = rd(vb[3] * base) + 'px';
        }
        const toPx = (X, Y) => [(X - vb[0]) * base, (Y - vb[1]) * base];
        function focus(X, Y, z = zoom) {
            zoom = Math.max(1, Math.min(2.6, z));
            const [px, py] = toPx(X, Y);
            tx = stage.clientWidth / 2 - px * zoom; ty = stage.clientHeight * .52 - py * zoom; setTransform();
        }

        function render(roomId, home, extra = {}) {
            const room = H.Rooms.get(roomId), [W, D] = room.size, outdoor = OUTDOOR.has(room.id), tod = extra.tod || timeOfDay();
            cfg = { W, D, room, interior: interior(room, home), outdoor, tod };
            const rows = H.Rooms.placements(room, home).map(placement => ({ placement, item: H.Furniture.get(placement.furnitureId) })).filter(r => r.item);
            const photo = extra.photo || '';
            staticPrims = []; owners = new Map(); lights = [];
            for (const row of rows) {
                const style = cfg.interior.furniture?.[row.placement.id] || row.item.style;
                const list = A.furniture(row.placement, row.item, style, cfg.interior, { photo });
                for (const prim of list) {
                    if (prim.kind === 'light') { lights.push(prim); continue; }
                    prim.row = row;
                    staticPrims.push(prim);
                    if (prim.kind !== 'shadow') { const bb = owners.get(row.placement.id); owners.set(row.placement.id, bb ? [Math.min(bb[0], prim.b[0]), Math.min(bb[1], prim.b[1]), Math.min(bb[2], prim.b[2]), Math.max(bb[3], prim.b[3]), Math.max(bb[4], prim.b[4]), Math.max(bb[5], prim.b[5])] : prim.b.slice()); }
                }
            }
            cfg.rows = rows;
            const shadows = staticPrims.filter(p => p.kind === 'shadow'), solids = A.sort(staticPrims.filter(p => p.kind !== 'shadow'));
            cfg.solids = solids;
            const wh = outdoor ? 1 : WALL_H;
            const corners = [[-W / 2 - T, wh, -D / 2 - T], [W / 2, -SLAB, D / 2], [-W / 2 - T, -SLAB, D / 2], [W / 2, -SLAB, -D / 2 - T], [W / 2, wh, -D / 2 - T], [-W / 2 - T, wh, D / 2]].map(q => P(...q));
            const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
            vb = [Math.min(...xs) - 30, Math.min(...ys) - 60, Math.max(...xs) - Math.min(...xs) + 60, Math.max(...ys) - Math.min(...ys) + 100];
            svg.setAttribute('viewBox', vb.map(rd).join(' '));
            const sh = shell(cfg, tod, outdoor), win = outdoor ? null : chooseWindow(cfg, [...owners.values()]), ws = windowSvg(win, cfg, tod);
            cfg.window = win;
            let night = '';
            if (tod === 'night' || tod === 'dusk' || tod === 'dawn') {
                const tint = tod === 'night' ? ['#2c3566', .3] : tod === 'dusk' ? ['#f08a4b', .1] : ['#e7a2a0', .08];
                night += '<rect class="h25-tint" x="' + vb[0] + '" y="' + vb[1] + '" width="' + vb[2] + '" height="' + vb[3] + '" fill="' + tint[0] + '" opacity="' + tint[1] + '" style="mix-blend-mode:multiply"/>';
                if (tod === 'night') { const [cx, cy] = P(0, 1.2, 0); night += '<ellipse cx="' + rd(cx) + '" cy="' + rd(cy) + '" rx="430" ry="290" fill="url(#h25-lampglow)" opacity=".42" style="mix-blend-mode:screen"/>'; }
                if (tod !== 'day') for (const l of lights) { const [x, y] = P(...l.at), r = 140 * l.warmth + 60; night += '<circle class="h25-lamplight" cx="' + rd(x) + '" cy="' + rd(y) + '" r="' + rd(r) + '" fill="url(#h25-lampglow)" style="mix-blend-mode:screen"/>'; }
            }
            svg.innerHTML = defs(cfg, tod, outdoor) +
                '<g class="h25-bg">' + sh.floor + rugFor(cfg, rows) + ws.floor + sh.walls + ws.wall + '</g>' +
                '<g class="h25-shadows" filter="url(#h25-blur)" fill="#4a3434">' + shadows.map(A.shadowOf).join('') + '</g>' +
                '<g class="h25-objects">' + solids.map(A.svgOf).join('') + '</g>' +
                '<g class="h25-night" pointer-events="none">' + night + '</g>';
            objectsLayer = svg.querySelector('.h25-objects');
            // Remember each solid's element so actors can be slotted between them.
            const els = [...objectsLayer.children];
            solids.forEach((p, i) => { p.el = els[i]; });
            for (const who of ['user', 'char']) if (actors[who]) { actors[who].el = null; actors[who].slot = -2; }
            fit(); actorLayerDirty = true;
            return cfg;
        }

        // ---------- actors ----------
        function actorEl(who) {
            const a = actors[who];
            if (a.el && a.el.isConnected) return a.el;
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'h25-actor'); g.setAttribute('data-actor', who);
            g.innerHTML = '<g class="h25-actor-at"><ellipse class="h25-actor-shadow" cx="0" cy="0" rx="30" ry="10" fill="#4a3434" opacity=".2"/><g class="h25-actor-motion"><g class="h25-actor-pose"><clipPath id="h25-clip-' + who + '"><rect/></clipPath><g clip-path="url(#h25-clip-' + who + ')"><image preserveAspectRatio="xMidYMax meet"/></g></g></g></g><g class="h25-actor-cover"></g>';
            a.el = g; a.slot = -2; return g;
        }
        function setSprite(who, sprite) { if (actors[who]) { actors[who].sprite = sprite; drawActor(who); } }
        function ensureActor(who, sprite) {
            if (!actors[who]) actors[who] = { who, x: 0, z: 0, y: 0, pose: 'stand', path: [], facing: 1, sprite, visible: false, slot: -2, mood: '' };
            if (sprite) actors[who].sprite = sprite;
            return actors[who];
        }
        function spriteFor(a) {
            const s = a.sprite || {}, fallback = DOLLS[a.who];
            const sleep = a.pose === 'lie' && a.sleeping;
            return { href: sleep ? (s.sleep || (s.custom ? s.stand : fallback.sleep)) : (s.stand || fallback.stand), ratio: s.ratio || fallback.ratio };
        }
        function bbox(a) {
            if (a.pose === 'lie') { const top = (a.lieTop ?? .68) + .06; return [a.x - .45, top, a.z - .45, a.x + .45, top + .02, a.z + .45]; }
            if (a.pose === 'sit') return [a.x - .17, a.y + .01, a.z - .14, a.x + .17, a.y + .8, a.z + .14];
            return [a.x - .17, 0, a.z - .14, a.x + .17, DOLL_H, a.z + .14];
        }
        function drawActor(who) {
            const a = actors[who]; if (!a || !objectsLayer) return;
            const g = actorEl(who);
            if (!a.visible) { g.remove(); return; }
            if (a.sprite?.model && H.Sprites25 && drawModel(a, g)) { slotActor(a); return; }
            const sp = spriteFor(a), h = DOLL_H * V, w = h * sp.ratio;
            const img = g.querySelector('image'), rect = g.querySelector('clipPath rect'), pose = g.querySelector('.h25-actor-pose'), motion = g.querySelector('.h25-actor-motion'), shadow = g.querySelector('.h25-actor-shadow'), cover = g.querySelector('.h25-actor-cover');
            if (img.getAttribute('href') !== sp.href) img.setAttribute('href', sp.href);
            img.setAttribute('width', rd(w)); img.setAttribute('height', rd(h));
            let X, Y, transform = '', cx = -w / 2, cy = -h, clipH = h + 40, clipY = -h - 30;
            cover.innerHTML = '';
            if (a.pose === 'sit') {
                const keep = a.depthKeep || .8;
                [X, Y] = P(a.x, a.y, a.z); cy = -h * keep; clipY = cy - 30; clipH = h * keep + 26;
                shadow.setAttribute('opacity', '0');
            } else if (a.pose === 'lie') {
                [X, Y] = a.lieScreen; cx = -w / 2; cy = -h / 2; clipY = -h / 2 - 30; clipH = h + 60;
                transform = 'rotate(' + rd(a.angle) + ') scale(.92)';
                shadow.setAttribute('opacity', '0');
                if (a.cover?.length) cover.innerHTML = a.cover.map(A.svgOf).join('');
            } else {
                [X, Y] = P(a.x, 0, a.z); shadow.setAttribute('opacity', '.2');
                if (a.facing < 0) transform = 'scale(-1,1)';
                if (a.lean) transform += ' rotate(' + a.lean + ')';
            }
            img.setAttribute('x', rd(cx)); img.setAttribute('y', rd(cy));
            rect.setAttribute('x', rd(cx - 30)); rect.setAttribute('y', rd(clipY)); rect.setAttribute('width', rd(w + 60)); rect.setAttribute('height', rd(clipH));
            pose.setAttribute('transform', transform);
            g.querySelector('.h25-actor-at').setAttribute('transform', 'translate(' + rd(X) + ',' + rd(Y) + ')');
            motion.setAttribute('class', 'h25-actor-motion' + (a.path.length ? ' is-walking' : a.pose === 'lie' ? ' is-resting' : ' is-idle') + (a.mood ? ' is-' + a.mood : ''));
            a.screen = [X, Y, h, a.pose];
            slotActor(a);
        }

        // ---------- poses rendered from the packaged 3D models ----------
        const quarter = r => ((Math.round((r || 0) / (Math.PI / 2)) % 4) + 4) % 4;
        const eighth = r => ((Math.round((r || 0) / (Math.PI / 4)) % 8) + 8) % 8;
        const SIT_TAG = { Read: 'read', 'Use Phone': 'phone', Work: 'work', Game: 'work', 'Use Computer': 'work', Eat: 'work', Drink: 'work' };
        function modelPose(a) {
            const who = a.who, anchor = a.anchor;
            if (a.pose === 'lie' && a.row) {
                const bed = a.row.item.type === 'bed';
                return { name: who + '-' + (bed ? 'bed' : 'sofabed') + '-' + (a.sleeping ? 'sleep' : 'lie') + '-r' + quarter(a.row.placement.rotation) * 2, at: anchor, lift: bed ? -.42 : 0 };
            }
            if (a.pose === 'sit' && anchor) {
                const sofa = anchor.furnitureType === 'sofa' ? 'sofa' : 'chair';
                let tag = SIT_TAG[a.action] || 'sit';
                if (sofa === 'sofa' && tag === 'work') tag = 'phone';
                if (sofa === 'chair' && tag === 'phone') tag = 'work';
                if (a.action === 'Bathe') return { name: who + '-chair-sit-r' + quarter(anchor.rotation) * 2, at: { ...anchor, y: anchor.y }, lift: .12, clip: (a.row?.placement.position[1] || 0) + .58 };
                return { name: who + '-' + sofa + '-' + tag + '-r' + quarter(anchor.rotation) * 2, at: anchor, lift: anchor.furnitureType === 'bed' ? -.38 : 0 };
            }
            if (a.path.length) return { name: who + '-walk' + (Math.floor(performance.now() / 150) % 4) + '-r' + eighth(a.dir), at: { x: a.x, y: .07, z: a.z }, lift: 0 };
            if (a.action === 'Cook' && anchor) return { name: who + '-cook-r' + quarter(anchor.rotation) * 2, at: { x: a.x, y: .07, z: a.z }, lift: 0 };
            return { name: who + '-idle-r' + eighth(a.dir ?? .7), at: { x: a.x, y: .07, z: a.z }, lift: 0 };
        }
        function drawModel(a, g) {
            const pick = modelPose(a), meta = H.Sprites25.sprites[pick.name];
            if (!meta) return false;
            const u = H.Sprites25.unitsPerPx, [w, h, ox, oy, ax, ay, az] = meta;
            const [X, Y] = P(pick.at.x - ax, pick.at.y - ay + pick.lift, pick.at.z - az);
            const img = g.querySelector('image'), rect = g.querySelector('clipPath rect'), pose = g.querySelector('.h25-actor-pose'), motion = g.querySelector('.h25-actor-motion'), shadow = g.querySelector('.h25-actor-shadow'), cover = g.querySelector('.h25-actor-cover');
            const href = H.Sprites25.base + pick.name + '.webp';
            if (img.getAttribute('href') !== href) img.setAttribute('href', href);
            img.setAttribute('width', rd(w * u)); img.setAttribute('height', rd(h * u));
            img.setAttribute('x', rd(-ox * u)); img.setAttribute('y', rd(-oy * u));
            let clipBottom = h * u + 40;
            if (pick.clip !== undefined) clipBottom = P(pick.at.x, pick.clip, pick.at.z)[1] - Y;
            rect.setAttribute('x', rd(-ox * u - 20)); rect.setAttribute('y', rd(-oy * u - 20)); rect.setAttribute('width', rd(w * u + 40)); rect.setAttribute('height', rd(clipBottom + oy * u + 20));
            pose.setAttribute('transform', a.lean && a.pose === 'stand' ? 'rotate(' + a.lean + ')' : '');
            shadow.setAttribute('opacity', a.pose === 'stand' ? '.2' : '0');
            shadow.setAttribute('rx', '24'); shadow.setAttribute('ry', '9');
            cover.innerHTML = a.pose === 'lie' && a.cover?.length ? a.cover.map(A.svgOf).join('') : '';
            g.querySelector('.h25-actor-at').setAttribute('transform', 'translate(' + rd(X) + ',' + rd(Y) + ')');
            motion.setAttribute('class', 'h25-actor-motion is-model' + (a.mood ? ' is-' + a.mood : ''));
            a.screen = [X, Y, h * u, a.pose];
            a.top = [X + (w / 2 - ox) * u, Y - oy * u + (a.pose === 'lie' ? h * u * .25 : 0)];
            return true;
        }
        // Place the doll between the solids that must stay behind and in front of it.
        function slotActor(a) {
            const g = a.el, bb = bbox(a), sb = A.screenBox(bb); sb[1] -= DOLL_H * V * .9;
            let after = -1;
            const solids = cfg.solids;
            for (let i = 0; i < solids.length; i++) {
                const s = solids[i];
                if (!A.overlap(sb, A.screenBox(s.b))) continue;
                const ab = A.behind(bb, s.b), ba = A.behind(s.b, bb);
                if (ab && !ba) continue;
                if ((ba && !ab) || (!ab && !ba && A.depth(s.b) <= A.depth(bb))) after = i;
            }
            const other = actors[a.who === 'user' ? 'char' : 'user'];
            if (a.slot === after && g.isConnected && !actorLayerDirty) return;
            a.slot = after;
            const anchor = solids[after + 1]?.el || null;
            objectsLayer.insertBefore(g, anchor && anchor.isConnected ? anchor : null);
            // Two dolls in the same gap: the nearer one goes last.
            if (other?.el?.isConnected && other.slot === after) {
                const mine = A.depth(bb), theirs = A.depth(bbox(other));
                if ((mine > theirs) !== (g.compareDocumentPosition(other.el) & Node.DOCUMENT_POSITION_PRECEDING ? true : false)) {
                    if (mine > theirs) objectsLayer.insertBefore(g, other.el.nextSibling); else objectsLayer.insertBefore(g, other.el);
                }
            }
        }

        // ---------- poses from furniture ----------
        function rowById(id) { return cfg?.rows.find(r => r.placement.id === id); }
        function obstacles(ignore) {
            return cfg.rows.filter(r => r.placement.position[1] < .2 && !['frame', 'prop', 'keepsake', 'mirror'].includes(r.item.type) && r.placement.id !== ignore).map(r => H.Build.extent(r.placement));
        }
        function lieOn(a, row, action) {
            const item = row.item, pl = row.placement, turns = ((Math.round((pl.rotation || 0) / (Math.PI / 2)) % 4) + 4) % 4;
            const cs = [1, 0, -1, 0][turns], sn = [0, 1, 0, -1][turns], [px, py, pz] = pl.position;
            const world = (x, z) => [px + x * cs + z * sn, pz - x * sn + z * cs];
            const [w, d] = item.footprint;
            let head, foot, top;
            if (item.type === 'bed') {
                const side = a.who === 'user' ? w * .22 : -w * .22;
                head = world(side, -d / 2 + .16); foot = world(side, -d / 2 + 1.5); top = py + .76;
                a.cover = A.furniture(pl, item, cfg.interior.furniture?.[pl.id] || item.style, cfg.interior).filter(p => p.opts?.cover);
            } else {
                const dir = a.who === 'user' ? 1 : -1;
                head = world(dir * (w / 2 - .42), -d / 2 + .55); foot = world(-dir * (w / 2 - .5), -d / 2 + .6); top = py + .5;
                a.cover = [];
            }
            const hs = P(head[0], top, head[1]), fs = P(foot[0], top, foot[1]);
            const dx = hs[0] - fs[0], dy = hs[1] - fs[1];
            a.angle = Math.atan2(dx, -dy) * 180 / Math.PI;
            const len = DOLL_H * V * .92, mid = .5;
            // Centre the sprite so its head rests on the pillow end.
            const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
            const hx = hs[0], hy = hs[1];
            const cxS = hx - ux * len * mid, cyS = hy - uy * len * mid;
            a.lieScreen = [cxS, cyS]; a.lieTop = top;
            a.x = (head[0] + foot[0]) / 2; a.z = (head[1] + foot[1]) / 2;
            a.pose = 'lie'; a.sleeping = action === 'Sleep';
        }
        function settle(who, row, action) {
            const a = actors[who];
            let anchor = null;
            const other = actors[who === 'user' ? 'char' : 'user'];
            const reserved = other?.visible && other.pose === 'sit' ? [{ x: other.x, z: other.z, seatId: other.seatId, placementId: other.seatId }] : [];
            try { anchor = H.Rooms.anchorInRoom(cfg.rows.map(r => ({ ...r, area: cfg.room.id })), { ...row, area: cfg.room.id }, action, who, reserved); } catch (_) { anchor = null; }
            anchor ||= H.Rooms.anchor(row.placement, action, who, row.item);
            a.seatId = anchor.seatId || anchor.placementId;
            a.path = []; a.lean = 0; a.action = action; a.anchor = anchor; a.row = row;
            if (anchor.lying || ['Sleep', 'Lie'].includes(action) && ['bed', 'sofa'].includes(row.item.type)) { if (!anchor.lying) a.anchor = H.Rooms.anchor(row.placement, action, who, row.item); lieOn(a, row, action); drawActor(who); return; }
            a.x = anchor.x; a.z = anchor.z;
            if (anchor.seated || ['Bathe'].includes(action)) {
                a.pose = 'sit'; a.y = action === 'Bathe' ? row.placement.position[1] + .48 : anchor.y; a.depthKeep = action === 'Bathe' ? .5 : .8;
            } else { a.pose = 'stand'; a.y = 0; }
            drawActor(who);
        }

        function standPoint(a) {
            const obs = obstacles(), size = [cfg.W, cfg.D];
            const p = { x: a.x, z: a.z };
            if (H.Animation.clear(p, obs, size, .2)) return p;
            return H.Animation.nearest(p, obs, size, .2) || { x: 0, z: cfg.D / 2 - .6 };
        }
        function place(who, opts) {
            const a = ensureActor(who, opts.sprite); a.visible = opts.visible !== false; a.path = []; a.mood = opts.mood || '';
            if (opts.row) settle(who, opts.row, opts.action);
            else { a.pose = 'stand'; a.action = 'Idle'; a.anchor = null; a.x = opts.x; a.z = opts.z; a.y = 0; if (Number.isFinite(opts.dir)) a.dir = opts.dir; drawActor(who); }
        }
        function walkTo(who, goal, arrive) {
            const a = actors[who]; if (!a) return false;
            const start = a.pose === 'stand' ? { x: a.x, z: a.z } : standPoint(a);
            const obs = obstacles(), size = [cfg.W, cfg.D];
            let end = goal.row ? H.Animation.approach(start, goal.row.placement, obs, size, .2) : H.Animation.nearest({ x: goal.x, z: goal.z }, obs, size, .2);
            if (!end) return false;
            const route = H.Animation.path(start, end, obs, size, .2);
            if (!route.length && Math.hypot(start.x - end.x, start.z - end.z) > .05) return false;
            a.pose = 'stand'; a.action = 'Idle'; a.anchor = null; a.x = start.x; a.z = start.z; a.y = 0; a.lean = 0;
            a.path = route.length ? route : [end]; a.arrive = arrive; a.mood = '';
            drawActor(who); kick(); return true;
        }
        function kick() { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(step); } }
        function step(now) {
            raf = 0; if (disposed) return;
            const dt = Math.min(.05, (now - last) / 1000); last = now;
            let moving = false;
            for (const who of ['user', 'char']) {
                const a = actors[who]; if (!a?.path.length) continue;
                moving = true;
                const goal = a.path[0], dx = goal.x - a.x, dz = goal.z - a.z, dist = Math.hypot(dx, dz), move = dt * 1.15;
                const sdx = (dx - dz) * C; if (Math.abs(sdx) > .5) a.facing = sdx < 0 ? -1 : 1;
                if (dist > .001) a.dir = Math.atan2(dx, dz);
                if (dist <= move) { a.x = goal.x; a.z = goal.z; a.path.shift(); }
                else { a.x += dx / dist * move; a.z += dz / dist * move; }
                if (!a.path.length) { const done = a.arrive; a.arrive = null; drawActor(who); if (done) done(); }
                else drawActor(who);
            }
            options.onFrame?.();
            if (moving) raf = requestAnimationFrame(step);
        }
        function hide(who) { const a = actors[who]; if (!a) return; a.visible = false; a.path = []; a.arrive = null; drawActor(who); }
        function stop(who) { const a = actors[who]; if (a) { a.path = []; a.arrive = null; drawActor(who); } }

        // ---------- input ----------
        const pointers = new Map(); let gesture = null, tapCandidate = null;
        stage.addEventListener('pointerdown', e => {
            stage.setPointerCapture?.(e.pointerId);
            pointers.set(e.pointerId, [e.clientX, e.clientY]);
            if (pointers.size === 1) { gesture = { x: e.clientX, y: e.clientY, tx, ty }; tapCandidate = { x: e.clientX, y: e.clientY, target: e.target, at: performance.now() }; }
            else if (pointers.size === 2) { const [p, q] = [...pointers.values()]; gesture = { pinch: Math.hypot(p[0] - q[0], p[1] - q[1]), zoom, mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], tx, ty }; tapCandidate = null; }
        });
        stage.addEventListener('pointermove', e => {
            if (!pointers.has(e.pointerId)) return;
            pointers.set(e.pointerId, [e.clientX, e.clientY]);
            if (!gesture) return;
            if (gesture.pinch && pointers.size === 2) {
                const [p, q] = [...pointers.values()], dist = Math.hypot(p[0] - q[0], p[1] - q[1]);
                const next = Math.max(1, Math.min(2.6, gesture.zoom * dist / gesture.pinch)), rect = stage.getBoundingClientRect();
                const mx = gesture.mid[0] - rect.left, my = gesture.mid[1] - rect.top;
                tx = mx - (mx - gesture.tx) * next / gesture.zoom; ty = my - (my - gesture.ty) * next / gesture.zoom; zoom = next; setTransform();
            } else if (!gesture.pinch) {
                const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
                if (tapCandidate && Math.hypot(dx, dy) > 8) tapCandidate = null;
                if (!tapCandidate) { tx = gesture.tx + dx; ty = gesture.ty + dy; setTransform(); }
            }
        });
        const end = e => {
            pointers.delete(e.pointerId);
            if (pointers.size === 1) { const [p] = [...pointers.values()]; gesture = { x: p[0], y: p[1], tx, ty }; return; }
            if (pointers.size) return;
            gesture = null;
            if (tapCandidate && e.type === 'pointerup') { const t = tapCandidate; tapCandidate = null; tap(t, e); }
        };
        stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
        stage.addEventListener('wheel', e => {
            e.preventDefault();
            const rect = stage.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const next = Math.max(1, Math.min(2.6, zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
            tx = mx - (mx - tx) * next / zoom; ty = my - (my - ty) * next / zoom; zoom = next; setTransform();
        }, { passive: false });
        function tap(t, e) {
            const target = document.elementFromPoint(e.clientX, e.clientY) || t.target;
            const actor = target?.closest?.('[data-actor]');
            if (actor) { options.onActor?.(actor.getAttribute('data-actor')); return; }
            const item = target?.closest?.('[data-id]');
            if (item) { const row = rowById(item.getAttribute('data-id')); if (row) { options.onFurniture?.(row); return; } }
            // Floor: invert the projection at y = 0.
            const rect = world.getBoundingClientRect(), X = (e.clientX - rect.left) / (base * zoom) + vb[0], Y = (e.clientY - rect.top) / (base * zoom) + vb[1];
            const x = (X / C + Y / N) / 2, z = (Y / N - X / C) / 2;
            if (Math.abs(x) < cfg.W / 2 && Math.abs(z) < cfg.D / 2) options.onFloor?.({ x, z });
        }
        const resize = () => { if (!cfg) return; const keep = zoom; fit(); zoom = keep; setTransform(); };
        window.addEventListener('resize', resize);

        // Screen position for HTML bubbles (relative to the stage).
        function screenOf(who) {
            const a = actors[who]; if (!a?.visible || !a.screen) return null;
            const [X, Y, h, pose] = a.screen, lift = pose === 'sit' ? h * (a.depthKeep || .8) : pose === 'lie' ? h * .55 : h;
            const [px, py] = a.sprite?.model && a.top ? toPx(a.top[0], a.top[1] + 4) : toPx(X, Y - lift);
            return [px * zoom + tx, py * zoom + ty];
        }
        function dispose() { disposed = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); container.innerHTML = ''; }

        return {
            render, place, walkTo, settle: (who, row, action) => { const a = ensureActor(who); a.visible = true; settle(who, row, action); }, hide, stop, setSprite, ensureActor,
            actor: who => actors[who], row: rowById, rows: () => cfg?.rows || [], config: () => cfg, screenOf, focus, focusActor(who, z) { const a = actors[who]; if (!a?.screen) return focus(P(0, 0, 0)[0], P(0, .6, 0)[1], z); focus(a.screen[0], a.screen[1] - 60, z); }, fitAll() { zoom = 1; setTransform(); },
            setMood(who, mood) { const a = actors[who]; if (a) { a.mood = mood; drawActor(who); } },
            lean(who, deg) { const a = actors[who]; if (a) { a.lean = deg; drawActor(who); } },
            obstacles, standPoint, dispose, stage, overlay, zoom: () => zoom
        };
    }

    H.Room25 = { mount, timeOfDay, interior, DOLLS, OUTDOOR, esc };
})(window.ByndHome3D);
