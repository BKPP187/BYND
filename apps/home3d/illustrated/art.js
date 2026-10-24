/* 2.5D 小屋 · drawing kit.
   A true isometric projection of the same room data the 3D house uses (meters, placements,
   rotations), drawn as soft clay-like SVG solids. No WebGL, no image assets for furniture:
   every piece is built from a few rounded boxes, cylinders and balls in its style palette. */
(function (H) {
    'use strict';
    const S = 100, C = S * Math.cos(Math.PI / 6), N = S * 0.5, V = S, K = S / Math.sqrt(2 / 3);
    const P = (x, y, z) => [(x - z) * C, (x + z) * N - y * V];
    const rd = v => Math.round(v * 10) / 10;
    const pts = list => list.map(([x, y, z]) => P(x, y, z).map(rd).join(',')).join(' ');

    // ---------- colour ----------
    const rgb = c => { let h = String(c || '#cccccc').replace('#', ''); if (h.length === 3) h = h.split('').map(v => v + v).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0); };
    const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
    const light = (c, t) => mix(c, '#fffaf4', t);
    const dark = (c, t) => mix(c, '#4b3a3e', t);
    const outline = c => mix(c, '#5a4244', .42);
    const lum = c => { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

    function palette(styleId, preset) {
        const styles = H.catalogs.furnitureCatalog.styles, base = styles[styleId] || styles.cream;
        const own = preset && preset.furnitureStyle === styleId ? preset : null;
        const wood = own?.wood || base.wood, accent = own?.accent || base.accent;
        let fabric = own?.fabric || base.fabric;
        // Very pale fabrics vanish on pale floors; warm them toward the wood tone.
        if (lum(fabric) > .84) fabric = mix(fabric, mix(wood, accent, .35), .38);
        return {
            wood, fabric, accent,
            trim: own?.trim || base.trim || light(fabric, .55),
            white: '#f8f4ee', cream: '#f1e9dc', metal: '#c9a774', steel: '#c8ccd0', dark: '#4d4848', glass: '#cfe5ec',
            leaf: ['#86a877', '#9dbb8a', '#6f9364', '#b0c99a'], ceramic: lum(accent) > .55 ? accent : light(accent, .35),
            cabinet: lum(wood) < .3 ? wood : (styleId === 'pink' || styleId === 'cream' ? light(wood, .25) : wood)
        };
    }

    // ---------- seeded variety ----------
    function seeded(text) { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }

    // ---------- primitive collection in local furniture space ----------
    // Furniture faces +z locally. Rotation snaps to quarter turns so every solid stays an
    // axis-aligned box in the room, which keeps depth sorting exact.
    function builder(placement, owner) {
        const turns = ((Math.round((placement.rotation || 0) / (Math.PI / 2)) % 4) + 4) % 4;
        const cs = [1, 0, -1, 0][turns], sn = [0, 1, 0, -1][turns];
        const [px, py, pz] = placement.position;
        const world = (x, z) => [px + x * cs + z * sn, pz - x * sn + z * cs];
        const out = [];
        const api = {
            turns,
            box(x0, y0, z0, x1, y1, z1, color, opts = {}) {
                const a = world(x0, z0), b = world(x1, z1);
                out.push({ kind: 'box', owner, color, opts, b: [Math.min(a[0], b[0]), py + y0, Math.min(a[1], b[1]), Math.max(a[0], b[0]), py + y1, Math.max(a[1], b[1])] });
            },
            // Vertical cylinder or frustum (r0 bottom, r1 top).
            cyl(x, z, r0, y0, y1, color, opts = {}) {
                const [wx, wz] = world(x, z), r = Math.max(r0, opts.r1 ?? r0);
                out.push({ kind: 'cyl', owner, color, opts: { ...opts, r0, r1: opts.r1 ?? r0, cx: wx, cz: wz }, b: [wx - r, py + y0, wz - r, wx + r, py + y1, wz + r] });
            },
            ball(x, y, z, r, color, opts = {}) {
                const [wx, wz] = world(x, z);
                out.push({ kind: 'ball', owner, color, opts: { ...opts, r, cx: wx, cy: py + y, cz: wz }, b: [wx - r, py + y - r, wz - r, wx + r, py + y + r, wz + r] });
            },
            // Thin line (antenna, pipes). Treated as a tiny box for sorting.
            line(x0, y0, z0, x1, y1, z1, color, width = 2.4) {
                const a = world(x0, z0), b = world(x1, z1);
                out.push({ kind: 'line', owner, color, opts: { width, a: [a[0], py + y0, a[1]], c: [b[0], py + y1, b[1]] }, b: [Math.min(a[0], b[0]) - .01, py + Math.min(y0, y1), Math.min(a[1], b[1]) - .01, Math.max(a[0], b[0]) + .01, py + Math.max(y0, y1), Math.max(a[1], b[1]) + .01] });
            },
            // Flat picture on the front (+z) face of a thin local box.
            picture(x0, y0, x1, y1, z, href, fallback) {
                const a = world(x0, z), b = world(x1, z);
                out.push({ kind: 'picture', owner, color: fallback, opts: { href, a: [a[0], py + y0, a[1]], c: [b[0], py + y1, b[1]] }, b: [Math.min(a[0], b[0]) - .005, py + y0, Math.min(a[1], b[1]) - .005, Math.max(a[0], b[0]) + .005, py + y1, Math.max(a[1], b[1]) + .005] });
            },
            shadow(w, d, strength = 1) {
                if (py > .05) return;
                const a = world(-w / 2 - .06, -d / 2 - .04), b = world(w / 2 + .06, d / 2 + .1);
                out.push({ kind: 'shadow', owner, strength, b: [Math.min(a[0], b[0]), 0, Math.min(a[1], b[1]), Math.max(a[0], b[0]), 0, Math.max(a[1], b[1])] });
            },
            lightAt(x, y, z, warmth = 1) { const [wx, wz] = world(x, z); out.push({ kind: 'light', owner, at: [wx, py + y, wz], warmth }); }
        };
        return { api, out };
    }

    // ---------- furniture illustrations ----------
    const legs4 = (g, w, d, h, color, inset = .1, r = .035) => {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.cyl(sx * (w / 2 - inset), sz * (d / 2 - inset), r, 0, h, color, { r1: r * 1.1 });
    };
    function sofa(g, item, p, armchair) {
        const [w, d] = item.footprint, arm = armchair ? .17 : .21, fab = p.fabric, back = .26;
        g.shadow(w, d);
        legs4(g, w, d, .1, p.wood, .12);
        g.box(-w / 2, .1, -d / 2, w / 2, .34, d / 2, dark(fab, .06), { round: 6 });
        g.box(-w / 2, .34, -d / 2, w / 2, armchair ? .98 : .9, -d / 2 + back, fab, { round: 9 });
        g.box(-w / 2, .34, -d / 2 + back, -w / 2 + arm, .64, d / 2, fab, { round: 9 });
        g.box(w / 2 - arm, .34, -d / 2 + back, w / 2, .64, d / 2, fab, { round: 9 });
        const inner0 = -w / 2 + arm, inner1 = w / 2 - arm, n = armchair || inner1 - inner0 < 1.2 ? 1 : 2, step = (inner1 - inner0) / n;
        for (let i = 0; i < n; i++) {
            const x0 = inner0 + i * step + .015, x1 = inner0 + (i + 1) * step - .015;
            g.box(x0, .34, -d / 2 + back, x1, .5, d / 2 - .01, light(fab, .1), { round: 10 });
            g.box(x0 + .03, .5, -d / 2 + back, x1 - .03, .84, -d / 2 + back + .16, light(fab, .14), { round: 12 });
        }
        if (!armchair) {
            g.ball(-w / 2 + arm + .2, .64, -d / 2 + back + .26, .14, p.accent);
            g.ball(w / 2 - arm - .2, .63, -d / 2 + back + .26, .13, '#f2c4c4');
        } else g.ball(0, .62, -d / 2 + back + .24, .12, light(p.accent, .2));
    }
    function bed(g, item, p) {
        const [w, d] = item.footprint, wood = p.wood, quilt = p.fabric;
        g.shadow(w, d);
        legs4(g, w, d, .1, dark(wood, .1), .1, .04);
        g.box(-w / 2, .08, -d / 2 + .1, w / 2, .32, d / 2, wood, { round: 6 });
        g.box(-w / 2, .08, -d / 2, w / 2, 1.2, -d / 2 + .1, light(wood, .12), { round: 12 });
        g.box(-w / 2 + .12, .5, -d / 2 + .1, w / 2 - .12, 1.08, -d / 2 + .15, light(p.fabric, .2), { round: 14 });
        g.box(-w / 2 + .05, .32, -d / 2 + .15, w / 2 - .05, .62, -d / 2 + .92, p.white, { round: 8 });
        const pw = (w - .3) / 2;
        for (const i of [0, 1]) g.box(-w / 2 + .12 + i * (pw + .06), .62, -d / 2 + .2, -w / 2 + .12 + i * (pw + .06) + pw, .75, -d / 2 + .56, i ? light(p.accent, .62) : p.white, { round: 16 });
        g.box(-w / 2 - .015, .36, -d / 2 + .92, w / 2 + .015, .8, d / 2 + .015, quilt, { round: 12, cover: true });
        g.box(-w / 2 - .015, .8, -d / 2 + .92, w / 2 + .015, .82, -d / 2 + 1.1, light(quilt, .35), { round: 6, cover: true });
        g.box(-w / 2 - .015, .8, d / 2 - .55, w / 2 + .015, .815, d / 2 - .28, light(p.accent, .25), { round: 4, cover: true });
    }
    function desk(g, item, p) {
        const [w, d] = item.footprint, h = item.height || .78, top = light(p.wood, .12);
        g.shadow(w, d, .7);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box(sx * (w / 2 - .06) - .025, 0, sz * (d / 2 - .06) - .025, sx * (w / 2 - .06) + .025, h - .04, sz * (d / 2 - .06) + .025, dark(p.wood, .08));
        if (w > 1.2) {
            g.box(w / 2 - .5, .06, -d / 2 + .05, w / 2 - .06, h - .04, d / 2 - .04, light(p.wood, .05), { round: 4 });
            for (const y of [.12, .34, .56]) { g.box(w / 2 - .47, y, d / 2 - .04, w / 2 - .09, y + .18, d / 2 - .025, light(p.wood, .16), { round: 3 }); g.ball(w / 2 - .28, y + .09, d / 2 - .01, .018, p.metal); }
        }
        g.box(-w / 2, h - .045, -d / 2, w / 2, h, d / 2, top, { round: 5 });
    }
    function table(g, item, p) {
        const [w, d] = item.footprint, dining = item.variant === 'dining', low = item.style === 'japanese';
        const h = item.height || (dining ? .76 : low ? .34 : .45), top = light(p.wood, .14);
        g.shadow(w, d, .7);
        if (!dining && !low) g.box(-w / 2 + .08, .1, -d / 2 + .08, w / 2 - .08, .13, d / 2 - .08, p.wood, { round: 4 });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.cyl(sx * (w / 2 - .1), sz * (d / 2 - .1), .03, 0, h - .04, dark(p.wood, .05), { r1: .036 });
        g.box(-w / 2, h - .05, -d / 2, w / 2, h, d / 2, top, { round: 8 });
        if (dining) {
            g.box(-w / 2 + .3, h, -.16, w / 2 - .3, h + .006, .16, light(p.accent, .3), { round: 2 });
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.cyl(sx * w * .21, sz * d * .29, .1, h, h + .015, p.white);
            g.cyl(0, 0, .06, h, h + .2, light(p.accent, .5), { r1: .04 });
            g.ball(0, h + .26, 0, .08, '#f2b8b8');
        } else {
            g.cyl(-w * .18, 0, .055, h, h + .1, p.white, { r1: .05 });
            g.box(w * .1, h, -.1, w * .1 + .26, h + .03, .08, light(p.accent, .35), { round: 2 });
        }
    }
    function chair(g, item, p) {
        const [w, d] = item.footprint;
        if (w >= .8) return sofa(g, item, p, true);
        g.shadow(w, d, .6);
        if (item.id === 'chair_01') {
            g.cyl(0, 0, .26, 0, .05, p.dark, { r1: .22 });
            g.cyl(0, 0, .035, .05, .42, p.steel);
            g.box(-w / 2 + .02, .42, -d / 2 + .06, w / 2 - .02, .52, d / 2 - .02, p.accent, { round: 10 });
            g.box(-w / 2 + .05, .5, -d / 2, w / 2 - .05, 1.22, -d / 2 + .12, p.accent, { round: 14 });
            g.box(-w / 2 + .14, .82, -d / 2 + .12, w / 2 - .14, 1.06, -d / 2 + .15, light(p.accent, .5), { round: 8 });
            return;
        }
        const seat = .44;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box(sx * (w / 2 - .09) - .022, 0, sz * (d / 2 - .09) - .022, sx * (w / 2 - .09) + .022, seat, sz * (d / 2 - .09) + .022, dark(p.wood, .06));
        g.box(-w / 2 + .05, seat - .05, -d / 2 + .05, w / 2 - .05, seat, d / 2 - .05, p.wood, { round: 4 });
        g.box(-w / 2 + .07, seat, -d / 2 + .1, w / 2 - .07, seat + .06, d / 2 - .07, light(p.fabric, .05), { round: 8 });
        g.box(-w / 2 + .07, seat, -d / 2 + .05, w / 2 - .07, seat + .5, -d / 2 + .1, p.wood, { round: 8 });
        g.box(-w / 2 + .12, seat + .14, -d / 2 + .1, w / 2 - .12, seat + .44, -d / 2 + .13, light(p.fabric, .12), { round: 8 });
    }
    function lamp(g, item, p) {
        const [w] = item.footprint, glow = light(p.fabric, .5);
        if (w < .45) {
            g.cyl(0, 0, .07, 0, .04, p.metal, { r1: .06 });
            g.cyl(0, 0, .03, .04, .2, light(p.accent, .3), { r1: .025 });
            g.cyl(0, 0, .14, .2, .36, glow, { r1: .09, glow: true });
            g.lightAt(0, .3, 0, .7); return;
        }
        g.shadow(.4, .4, .5);
        g.cyl(0, 0, .17, 0, .04, p.metal, { r1: .15 });
        g.cyl(0, 0, .022, .04, 1.32, p.metal);
        if (item.id === 'lamp_01') { g.ball(0, 1.42, 0, .25, glow, { squash: .62, glow: true }); g.ball(0, 1.6, 0, .03, p.metal); }
        else g.cyl(0, 0, .25, 1.28, 1.62, glow, { r1: .16, glow: true });
        g.lightAt(0, 1.4, 0, 1);
    }
    function cabinet(g, item, p) {
        const [w, d] = item.footprint, id = item.id, variant = item.variant;
        const h = item.height || (id.includes('nightstand') ? .62 : .82), body = variant === 'prep' ? p.trim : p.cabinet;
        g.shadow(w, d, .8);
        g.box(-w / 2 + .04, 0, -d / 2 + .04, w / 2 - .04, .08, d / 2 - .06, dark(body, .25));
        g.box(-w / 2, .08, -d / 2, w / 2, h - .04, d / 2, body, { round: 5 });
        const front = d / 2, inset = .05, face = light(body, .1);
        if (variant === 'prep') {
            g.box(-w / 2 - .02, h - .05, -d / 2 - .02, w / 2 + .02, h, d / 2 + .03, '#f4efe8', { round: 4 });
            const doors = Math.max(1, Math.round(w / .5));
            for (let i = 0; i < doors; i++) { const x0 = -w / 2 + inset + i * (w - 2 * inset) / doors, x1 = x0 + (w - 2 * inset) / doors - .03; g.box(x0, .14, front, x1, h - .12, front + .012, face, { round: 3 }); g.box(x1 - .07, h - .3, front + .012, x1 - .05, h - .18, front + .02, p.metal); }
            if (w > 2) { g.cyl(-.3, 0, .1, h, h + .08, p.white, { r1: .12 }); g.ball(.35, h + .07, -.05, .07, '#e88d6d'); g.ball(.48, h + .06, .06, .06, '#9cc17f'); }
            return;
        }
        g.box(-w / 2 - .015, h - .045, -d / 2 - .015, w / 2 + .015, h, d / 2 + .02, light(body, .16), { round: 4 });
        if (variant === 'sideboard' || id.includes('nightstand')) {
            const rows = id.includes('nightstand') ? 2 : 3, span = (h - .2) / rows;
            for (let i = 0; i < rows; i++) { const y = .13 + i * span; g.box(-w / 2 + inset, y, front, w / 2 - inset, y + span - .04, front + .012, face, { round: 3 }); g.ball(0, y + span / 2 - .02, front + .03, .022, p.metal); }
            if (variant === 'sideboard') { g.cyl(-w * .28, 0, .07, h, h + .26, p.ceramic, { r1: .05 }); g.ball(-w * .28, h + .34, 0, .1, p.leaf[1]); g.box(w * .12, h, -.06, w * .12 + .22, h + .3, -.03, light(p.wood, .3), { round: 3 }); }
            return;
        }
        const doors = w > 1.3 ? 3 : 2;
        for (let i = 0; i < doors; i++) { const x0 = -w / 2 + inset + i * (w - 2 * inset) / doors, x1 = x0 + (w - 2 * inset) / doors - .03; g.box(x0, .14, front, x1, h - .1, front + .012, face, { round: 3 }); g.ball(i < doors / 2 ? x1 - .06 : x0 + .06, h / 2, front + .03, .02, p.metal); }
    }
    function bookcase(g, item, p) {
        const [w, d] = item.footprint, h = item.height || 1.78, wood = p.cabinet, rnd = seeded(item.id + w);
        g.shadow(w, d, .8);
        g.box(-w / 2, 0, -d / 2, w / 2, h, -d / 2 + .04, dark(wood, .12));
        g.box(-w / 2, 0, -d / 2 + .04, -w / 2 + .05, h, d / 2, wood, { round: 3 });
        g.box(w / 2 - .05, 0, -d / 2 + .04, w / 2, h, d / 2, wood, { round: 3 });
        const shelves = 4, gap = (h - .12) / shelves, colors = [p.accent, light(p.accent, .45), '#e7c2b7', '#c9d6c0', '#efe2c7', '#b9c4d4', dark(p.fabric, .1)];
        for (let s = 0; s <= shelves; s++) g.box(-w / 2 + .05, .04 + s * gap, -d / 2 + .04, w / 2 - .05, .08 + s * gap, d / 2, light(wood, .1), { round: 2 });
        for (let s = 0; s < shelves; s++) {
            let x = -w / 2 + .08; const y = .08 + s * gap;
            if (s === 1) { g.cyl(w / 2 - .22, 0, .07, y, y + .13, p.ceramic, { r1: .06 }); g.ball(w / 2 - .22, y + .22, 0, .1, p.leaf[0]); }
            const stop = s === 1 ? w / 2 - .36 : w / 2 - .08;
            while (x < stop - .05) {
                const bw = .05 + rnd() * .05, bh = gap * (.55 + rnd() * .3);
                if (rnd() < .12 && x > -w / 2 + .2) { x += .07; continue; }
                g.box(x, y, -d / 2 + .08, Math.min(x + bw, stop), y + bh, d / 2 - .06, colors[Math.floor(rnd() * colors.length)], { round: 1.5 });
                x += bw + .006;
            }
        }
        g.box(-w / 2 - .02, h, -d / 2, w / 2 + .02, h + .04, d / 2 + .02, light(wood, .16), { round: 3 });
    }
    function plant(g, item, p) {
        const [w] = item.footprint, big = w >= .65, pot = big ? .2 : .16;
        g.shadow(pot * 2.2, pot * 2.2, .7);
        g.cyl(0, 0, pot * .82, 0, big ? .42 : .32, p.ceramic, { r1: pot });
        g.cyl(0, 0, pot * .92, big ? .4 : .3, big ? .43 : .33, dark('#8b6f55', .1));
        const rnd = seeded(item.id), top = big ? 1.25 : .82, count = big ? 9 : 6;
        for (let i = 0; i < count; i++) {
            const a = i / count * Math.PI * 2 + rnd(), rad = (big ? .2 : .12) * (.5 + rnd() * .6), y = (big ? .62 : .46) + (top - (big ? .62 : .46)) * (i / count) * .8 + rnd() * .1;
            g.ball(Math.cos(a) * rad, y, Math.sin(a) * rad, (big ? .17 : .12) * (.75 + rnd() * .5), p.leaf[i % p.leaf.length], { leaf: true });
        }
        if (!big) g.ball(.04, top - .04, .05, .045, '#f3b7c2');
    }
    function tub(g, item, p) {
        const [w, d] = item.footprint, h = .56;
        g.shadow(w, d, .7);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.ball(sx * (w / 2 - .18), .05, sz * (d / 2 - .14), .05, p.metal);
        g.box(-w / 2, .07, -d / 2, w / 2, h, d / 2, p.white, { round: 16 });
        g.box(-w / 2 + .09, h, -d / 2 + .09, w / 2 - .09, h + .004, d / 2 - .09, '#bfe1ea', { round: 14, water: true });
        g.ball(w * .12, h + .03, .1, .07, '#ffffff'); g.ball(w * .2, h + .03, -.08, .05, '#ffffff'); g.ball(-w * .05, h + .02, .16, .045, '#ffffff');
        g.cyl(-w / 2 + .16, -d / 2 + .16, .025, h, h + .22, p.metal); g.box(-w / 2 + .16, h + .19, -d / 2 + .14, -w / 2 + .3, h + .22, -d / 2 + .18, p.metal);
    }
    function shower(g, item, p) {
        const [w, d] = item.footprint, h = item.height || 2.2;
        g.box(-w / 2, 0, -d / 2, w / 2, .08, d / 2, p.white, { round: 6 });
        g.cyl(-w / 2 + .2, -d / 2 + .15, .02, .08, h - .2, p.steel);
        g.cyl(-w / 2 + .32, -d / 2 + .3, .14, h - .3, h - .26, p.steel, { r1: .1 });
        g.box(-w / 2, .08, d / 2 - .02, w / 2, h, d / 2, p.glass, { alpha: .28, round: 2 });
        g.box(w / 2 - .02, .08, -d / 2, w / 2, h, d / 2 - .02, p.glass, { alpha: .28, round: 2 });
        g.box(w / 2 - .03, h - .04, -d / 2, w / 2, h, d / 2, p.steel); g.box(-w / 2, h - .04, d / 2 - .03, w / 2, h, d / 2, p.steel);
    }
    function toilet(g, item, p) {
        const [w, d] = item.footprint;
        g.shadow(w * .8, d * .8, .6);
        g.box(-w / 2 + .04, .36, -d / 2, w / 2 - .04, .82, -d / 2 + .22, p.white, { round: 10 });
        g.box(-w / 2 + .02, .82, -d / 2 - .01, w / 2 - .02, .86, -d / 2 + .24, light(p.accent, .5), { round: 6 });
        g.cyl(0, .05, .17, 0, .4, p.white, { r1: .23 });
        g.cyl(0, .05, .25, .4, .44, light(p.accent, .55));
    }
    function vanity(g, item, p) {
        const [w, d] = item.footprint, h = .84;
        g.shadow(w, d, .7);
        g.box(-w / 2, .08, -d / 2, w / 2, h - .05, d / 2, p.cabinet, { round: 5 });
        for (const i of [0, 1]) g.box(-w / 2 + .06 + i * (w / 2 - .03), .14, d / 2, -w / 2 + .06 + i * (w / 2 - .03) + w / 2 - .09, h - .12, d / 2 + .012, light(p.cabinet, .1), { round: 3 });
        g.box(-w / 2 - .02, h - .05, -d / 2 - .02, w / 2 + .02, h, d / 2 + .02, '#f6f1ea', { round: 4 });
        g.cyl(0, .02, .2, h, h + .004, '#d9e7ea'); g.cyl(0, -d / 2 + .1, .02, h, h + .2, p.metal);
        g.box(-.02, h + .17, -d / 2 + .1, .02, h + .2, -d / 2 + .22, p.metal);
        g.cyl(w * .32, -.05, .04, h, h + .14, light(p.accent, .3)); g.cyl(-w * .34, -.08, .05, h, h + .1, '#f3c8cf');
    }
    function mirror(g, item, p) {
        const [w] = item.footprint, h = item.height || .9;
        g.box(-w / 2, 0, -.05, w / 2, h, .01, p.metal, { round: 18 });
        g.box(-w / 2 + .05, .05, .01, w / 2 - .05, h - .05, .02, '#dcebef', { round: 16, mirror: true });
    }
    function piano(g, item, p) {
        const [w, d] = item.footprint, wood = p.cabinet;
        g.shadow(w, d, .8);
        g.box(-w / 2, 0, -d / 2, w / 2, 1.24, -d / 2 + .32, wood, { round: 6 });
        g.box(-w / 2 - .02, 1.24, -d / 2 - .01, w / 2 + .02, 1.28, -d / 2 + .34, light(wood, .12), { round: 4 });
        for (const sx of [-1, 1]) g.box(sx * (w / 2 - .05) - .04, 0, -d / 2 + .32, sx * (w / 2 - .05) + .04, .76, d / 2 - .05, dark(wood, .04));
        g.box(-w / 2 + .05, .66, -d / 2 + .32, w / 2 - .05, .74, d / 2 - .1, light(wood, .06), { round: 3 });
        g.box(-w / 2 + .1, .74, -d / 2 + .34, w / 2 - .1, .765, -d / 2 + .52, '#fbf8f3', { round: 2 });
        const keys = Math.floor((w - .2) / .055);
        for (let i = 0; i < keys; i++) if ([1, 2, 4, 5, 6].includes(i % 7)) { const x = -w / 2 + .1 + i * .055 - .012; g.box(x, .765, -d / 2 + .34, x + .024, .78, -d / 2 + .44, '#3f3a3a'); }
        g.box(-.18, .9, -d / 2 + .3, .18, 1.12, -d / 2 + .34, '#fdfbf6', { round: 2 });
    }
    function stove(g, item, p) {
        const [w, d] = item.footprint, h = .88, body = p.trim;
        g.shadow(w, d, .8);
        g.box(-w / 2, .06, -d / 2, w / 2, h - .04, d / 2, body, { round: 5 });
        g.box(-w / 2 + .08, .14, d / 2, w / 2 - .08, h - .2, d / 2 + .012, light(body, .08), { round: 3 });
        g.box(-w / 2 + .16, .3, d / 2 + .012, w / 2 - .16, h - .32, d / 2 + .016, '#5c5554', { round: 3 });
        g.box(-w / 2 + .14, h - .28, d / 2 + .016, w / 2 - .14, h - .26, d / 2 + .035, p.metal);
        g.box(-w / 2 - .02, h - .045, -d / 2 - .02, w / 2 + .02, h, d / 2 + .02, '#f4efe8', { round: 4 });
        g.cyl(-w * .22, -.02, .14, h, h + .008, '#55504f'); g.cyl(w * .22, -.02, .14, h, h + .008, '#55504f');
        g.cyl(-w * .22, -.02, .15, h + .008, h + .07, '#3e3a3a', { r1: .16 });
        g.ball(-w * .22 - .05, h + .08, 0, .035, '#e48b6a'); g.ball(-w * .22 + .04, h + .08, -.04, .03, '#9cc17f');
        g.box(-w * .22 + .15, h + .05, -.03, -w * .22 + .38, h + .07, .01, '#3e3a3a');
        g.cyl(w * .22, -.02, .13, h + .008, h + .2, light(p.accent, .2), { r1: .12 });
        g.cyl(w * .22, -.02, .125, h + .2, h + .22, light(p.accent, .4), { r1: .05 });
        for (let i = 0; i < 3; i++) g.ball(-w / 2 + .2 + i * .12, h - .13, d / 2 + .03, .022, p.metal);
    }
    function sink(g, item, p) {
        const [w, d] = item.footprint, h = item.height || .88, body = p.trim;
        g.shadow(w, d, .8);
        g.box(-w / 2, .06, -d / 2, w / 2, h - .04, d / 2, body, { round: 5 });
        for (const i of [0, 1]) g.box(-w / 2 + .06 + i * (w / 2 - .03), .14, d / 2, -w / 2 + .06 + i * (w / 2 - .03) + w / 2 - .09, h - .12, d / 2 + .012, light(body, .08), { round: 3 });
        g.box(-w / 2 - .02, h - .045, -d / 2 - .02, w / 2 + .02, h, d / 2 + .02, '#f4efe8', { round: 4 });
        g.box(-.32, h, -.18, .32, h + .004, .2, '#cfe0e4', { round: 8 });
        g.cyl(0, -d / 2 + .1, .022, h, h + .3, p.metal); g.box(-.02, h + .26, -d / 2 + .08, .02, h + .29, -d / 2 + .26, p.metal);
        g.cyl(w * .38, -.1, .05, h, h + .16, light(p.accent, .3));
    }
    function fridge(g, item, p) {
        const [w, d] = item.footprint, h = item.height || 1.74, body = light(p.accent, .62);
        g.shadow(w, d, .9);
        g.box(-w / 2, .03, -d / 2, w / 2, h, d / 2, body, { round: 9 });
        g.box(-w / 2 + .02, h * .64, d / 2, w / 2 - .02, h * .64 + .02, d / 2 + .006, dark(body, .18));
        g.box(w / 2 - .12, h * .7, d / 2, w / 2 - .09, h * .9, d / 2 + .04, p.metal);
        g.box(w / 2 - .12, h * .36, d / 2, w / 2 - .09, h * .58, d / 2 + .04, p.metal);
        g.box(-w / 2 + .12, h * .78, d / 2, -w / 2 + .26, h * .86, d / 2 + .008, '#f5d9a8', { round: 2 });
    }
    function fireplace(g, item, p) {
        const [w, d] = item.footprint, h = item.height || 1.25, stone = p.trim;
        g.shadow(w, d, .8);
        g.box(-w / 2, 0, -d / 2, w / 2, h - .08, d / 2, stone, { round: 5 });
        g.box(-w / 2 + .28, .06, d / 2, w / 2 - .28, h * .6, d / 2 + .01, '#3d3434', { round: 10 });
        g.box(-w / 2 + .36, .06, d / 2 + .01, w / 2 - .36, .1, d / 2 + .02, dark(p.wood, .2));
        for (const [x, r, c] of [[-.12, .09, '#f2a35c'], [.06, .11, '#f5c06a'], [.16, .07, '#ec8a52']]) g.ball(x, .2, d / 2 + .01, r, c, { flame: true });
        g.lightAt(0, .3, d / 2 + .3, .8);
        g.box(-w / 2 - .06, h - .08, -d / 2 - .02, w / 2 + .06, h, d / 2 + .05, p.wood, { round: 4 });
        g.cyl(-w / 2 + .2, 0, .035, h, h + .16, '#fbf6ec'); g.ball(-w / 2 + .2, h + .19, 0, .02, '#f7c56a', { flame: true });
        g.box(w / 2 - .5, h, -.08, w / 2 - .2, h + .24, -.04, light(p.accent, .4), { round: 3 });
    }
    function wardrobe(g, item, p) {
        const [w, d] = item.footprint, h = item.height || 2.05, body = p.cabinet;
        g.shadow(w, d, .9);
        g.box(-w / 2 + .05, 0, -d / 2 + .05, w / 2 - .05, .08, d / 2 - .05, dark(body, .2));
        g.box(-w / 2, .08, -d / 2, w / 2, h - .06, d / 2, body, { round: 5 });
        for (const i of [0, 1]) { const x0 = i ? .015 : -w / 2 + .06, x1 = i ? w / 2 - .06 : -.015; g.box(x0, .16, d / 2, x1, h - .14, d / 2 + .012, light(body, .1), { round: 3 }); g.box(x0 + .06, .3, d / 2 + .012, x1 - .06, h - .3, d / 2 + .018, light(body, .16), { round: 3 }); g.box(i ? x0 + .04 : x1 - .06, h * .45, d / 2 + .018, i ? x0 + .06 : x1 - .04, h * .58, d / 2 + .045, p.metal); }
        g.box(-w / 2 - .03, h - .06, -d / 2 - .03, w / 2 + .03, h, d / 2 + .03, light(body, .18), { round: 4 });
    }
    function television(g, item, p) {
        const [w, d] = item.footprint, h = .62;
        g.box(-w / 2, 0, -d / 2, w / 2, h, d / 2, '#eee6db', { round: 14 });
        g.box(-w / 2 + .07, .08, d / 2, w / 2 - .26, h - .08, d / 2 + .012, '#3f4e55', { round: 12, screen: true });
        for (const y of [.42, .28]) g.ball(w / 2 - .13, y, d / 2 + .01, .035, p.metal);
        g.box(w / 2 - .2, .1, d / 2, w / 2 - .06, .18, d / 2 + .01, dark('#eee6db', .1));
        g.line(-.05, h, 0, -.28, h + .32, -.05, p.steel, 2.2); g.line(.05, h, 0, .22, h + .34, -.05, p.steel, 2.2);
    }
    function computer(g, item, p) {
        const [w] = item.footprint;
        g.box(-.14, 0, -.12, .14, .02, .05, '#e9e4dc', { round: 4 });
        g.box(-.03, .02, -.08, .03, .16, -.04, '#e9e4dc');
        g.box(-w / 2, .14, -.09, w / 2, .56, -.04, '#efeae2', { round: 6 });
        g.box(-w / 2 + .03, .17, -.04, w / 2 - .03, .53, -.03, '#2f3d4a', { round: 4, screen: true });
    }
    function prop(g, item, p) {
        const [w, d] = item.footprint, h = item.height || .03;
        if (item.id === 'kitchen_spice_shelf') {
            for (const y of [0, .3]) g.box(-w / 2, y, -d / 2, w / 2, y + .03, d / 2, light(p.wood, .1), { round: 2 });
            const jars = ['#e9b37a', '#c7d8a9', '#f2d2c4', '#bcd2dc', '#f1e3b1'];
            for (let i = 0; i < 5; i++) { g.cyl(-w / 2 + .18 + i * .3, 0, .05, .03, .2, jars[i], { r1: .045 }); g.cyl(-w / 2 + .3 + i * .28, 0, .06, .33, .4, p.white); }
            return;
        }
        g.box(-w / 2, 0, -d / 2, w / 2, Math.max(.025, h), d / 2, '#f3efe8', { round: 4 });
        g.box(-w / 2 + .03, Math.max(.025, h), -d / 2 + .03, w / 2 - .03, Math.max(.025, h) + .006, d / 2 - .03, '#e2dbd0', { round: 2 });
    }
    function speaker(g, item, p) {
        const [w, d] = item.footprint, h = item.height || .3, color = item.variant === 'gaming' ? '#efeae2' : p.accent;
        g.box(-w / 2, 0, -d / 2, w / 2, h, d / 2, color, { round: 6 });
        g.ball(0, h * .45, d / 2, Math.min(w, h) * .28, dark(color, .25), { flat: true });
    }
    function keepsake(g, item, p) {
        if (item.variant === 'gamepad') { g.box(-.13, 0, -.07, .13, .04, .07, '#f2eee8', { round: 10 }); g.ball(-.06, .045, 0, .022, '#8fa7c4'); g.ball(.07, .045, -.01, .018, '#e59a9a'); return; }
        if (item.id.startsWith('bear')) {
            const fur = '#dcb795';
            g.ball(0, .11, 0, .11, fur); g.ball(-.08, .05, .07, .04, fur); g.ball(.08, .05, .07, .04, fur);
            g.ball(0, .27, .01, .095, fur); g.ball(-.07, .35, 0, .035, fur); g.ball(.07, .35, 0, .035, fur);
            g.ball(0, .25, .085, .035, '#f2e2cf'); g.ball(0, .14, .1, .03, '#f1b9c0'); return;
        }
        g.ball(0, .2, 0, .12, '#f7d98a', { glow: true }); g.lightAt(0, .2, 0, .4);
    }
    function frame(g, item, p, ctx) {
        const [w] = item.footprint, h = w * .76;
        g.box(-w / 2, 0, -.06, w / 2, h, 0, light(p.wood, .1), { round: 4 });
        g.picture(-w / 2 + .05, .05, w / 2 - .05, h - .05, .003, ctx.photo || '', '#e8d9c7');
    }
    const DRAW = { sofa, bed, desk, table, chair, lamp, cabinet, bookcase, plant, tub, shower, toilet, vanity, mirror, piano, stove, sink, fridge, fireplace, wardrobe, television, computer, prop, speaker, keepsake, frame };

    function furniture(placement, item, styleId, preset, ctx = {}) {
        const { api, out } = builder(placement, placement.id);
        const draw = DRAW[item.type];
        if (draw) draw(api, item, palette(styleId || item.style, preset), ctx);
        return out;
    }

    // ---------- SVG rendering of one primitive ----------
    const attr = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => k + '="' + String(v).replace(/"/g, '&quot;') + '"').join(' ');
    function svgOf(prim) {
        const id = prim.owner ? ' data-id="' + prim.owner + '"' : '';
        const o = prim.opts || {};
        if (prim.kind === 'box') {
            const [x0, y0, z0, x1, y1, z1] = prim.b, c = prim.color, round = o.round ?? 3, alpha = o.alpha;
            const top = pts([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]);
            const left = pts([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]);
            const right = pts([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]);
            const hull = pts([[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z1]]);
            const faceL = o.screen ? 'url(#h25-screen)' : o.mirror ? 'url(#h25-mirror)' : c;
            const sw = Math.min(round, 14) * .8 + .8, line = outline(c);
            const style = alpha !== undefined ? ' fill-opacity="' + alpha + '" stroke-opacity="' + Math.min(1, alpha + .35) + '"' : '';
            const tall = (y1 - y0) > .22 && alpha === undefined;
            return '<g' + id + ' class="h25-solid"' + style + '>' +
                (alpha === undefined ? '<polygon points="' + hull + '" fill="' + line + '" stroke="' + line + '" stroke-width="' + (sw + 2.6).toFixed(1) + '" stroke-linejoin="round"/>' : '') +
                '<polygon points="' + right + '" fill="' + dark(c, .2) + '" stroke="' + dark(c, .2) + '" stroke-width="' + sw.toFixed(1) + '" stroke-linejoin="round"/>' +
                '<polygon points="' + left + '" fill="' + faceL + '" stroke="' + c + '" stroke-width="' + sw.toFixed(1) + '" stroke-linejoin="round"/>' +
                (tall ? '<polygon points="' + left + '" fill="url(#h25-vshade)"/><polygon points="' + right + '" fill="url(#h25-vshade)"/>' : '') +
                '<polygon points="' + top + '" fill="' + (o.water ? 'url(#h25-water)' : light(c, .1)) + '" stroke="' + light(c, alpha !== undefined ? .3 : .3) + '" stroke-width="' + Math.max(1.4, sw * .6).toFixed(1) + '" stroke-linejoin="round"/>' +
                '</g>';
        }
        if (prim.kind === 'cyl') {
            const { cx, cz, r0, r1 } = o, [x0, y0] = prim.b.slice(0, 2), y1 = prim.b[4];
            const [bx, by] = P(cx, y0, cz), [tx, ty] = P(cx, y1, cz);
            const rx0 = r0 * K, ry0 = r0 * K * .577, rx1 = r1 * K, ry1 = r1 * K * .577;
            const c = prim.color, glow = o.glow ? ' class="h25-glow"' : '';
            const body = 'M' + rd(tx - rx1) + ' ' + rd(ty) + ' L' + rd(bx - rx0) + ' ' + rd(by) + ' A' + rd(rx0) + ' ' + rd(ry0) + ' 0 0 0 ' + rd(bx + rx0) + ' ' + rd(by) + ' L' + rd(tx + rx1) + ' ' + rd(ty) + ' Z';
            const line = outline(c);
            return '<g' + id + glow + '><path d="' + body + '" fill="' + c + '" stroke="' + line + '" stroke-width="2.2" stroke-linejoin="round"/><path d="' + body + '" fill="url(#h25-cylshade)"/>' +
                '<ellipse cx="' + rd(tx) + '" cy="' + rd(ty) + '" rx="' + rd(rx1) + '" ry="' + rd(ry1) + '" fill="' + light(c, .18) + '" stroke="' + line + '" stroke-width="1.6"/></g>';
        }
        if (prim.kind === 'ball') {
            const [x, y] = P(o.cx, o.cy, o.cz), rr = o.r * K * .94, ry = rr * (o.squash || 1), c = prim.color;
            const cls = o.glow ? ' class="h25-glow"' : o.flame ? ' class="h25-flame"' : '';
            if (o.flat) return '<ellipse' + id + ' cx="' + rd(x) + '" cy="' + rd(y) + '" rx="' + rd(rr * .7) + '" ry="' + rd(rr) + '" fill="' + c + '"/>';
            return '<g' + id + cls + '><ellipse cx="' + rd(x) + '" cy="' + rd(y) + '" rx="' + rd(rr) + '" ry="' + rd(ry) + '" fill="' + c + '" stroke="' + (o.leaf ? dark(c, .28) : outline(c)) + '" stroke-width="' + (o.glow || o.flame ? 0 : 1.6) + '"/><ellipse cx="' + rd(x) + '" cy="' + rd(y) + '" rx="' + rd(rr) + '" ry="' + rd(ry) + '" fill="url(#h25-ballshade)"/></g>';
        }
        if (prim.kind === 'line') {
            const a = P(...o.a), b = P(...o.c);
            return '<line' + id + ' x1="' + rd(a[0]) + '" y1="' + rd(a[1]) + '" x2="' + rd(b[0]) + '" y2="' + rd(b[1]) + '" stroke="' + prim.color + '" stroke-width="' + o.width + '" stroke-linecap="round"/>';
        }
        if (prim.kind === 'picture') {
            // Map the unit square onto the face parallelogram (x along the face, y up).
            const bl = P(o.a[0], o.a[1], o.a[2]), br = P(o.c[0], o.a[1], o.c[2]), tl = P(o.a[0], o.c[1], o.a[2]);
            const m = [br[0] - bl[0], br[1] - bl[1], tl[0] - bl[0], tl[1] - bl[1], bl[0], bl[1]].map(v => Math.round(v * 100) / 100);
            const poly = [bl, br, [br[0] + m[2], br[1] + m[3]], tl].map(q => q.map(rd).join(',')).join(' ');
            if (!o.href) return '<polygon' + id + ' points="' + poly + '" fill="url(#h25-photo)"/>';
            // Flip y: the image's top row maps to the face's top edge.
            return '<g' + id + '><polygon points="' + poly + '" fill="' + prim.color + '"/><image href="' + o.href.replace(/"/g, '') + '" width="1" height="1" preserveAspectRatio="xMidYMid slice" transform="matrix(' + [m[0], m[1], -m[2], -m[3], m[4] + m[2], m[5] + m[3]].join(' ') + ')"/></g>';
        }
        return '';
    }

    // Shadows go into one blurred layer, so they never need sorting.
    function shadowOf(prim) {
        const [x0, , z0, x1, , z1] = prim.b;
        return '<polygon points="' + pts([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]]) + '" opacity="' + (0.26 * prim.strength).toFixed(3) + '"/>';
    }

    // ---------- painter's order ----------
    // a must be drawn before b when a is entirely on the far side of b along any axis.
    function behind(a, b) {
        const e = 0.0005;
        if (a[3] <= b[0] + e) return true;
        if (a[5] <= b[2] + e) return true;
        if (a[4] <= b[1] + e) return true;
        return false;
    }
    function screenBox(bb) {
        const c = [[bb[0], bb[1], bb[2]], [bb[3], bb[1], bb[2]], [bb[0], bb[1], bb[5]], [bb[3], bb[1], bb[5]], [bb[0], bb[4], bb[2]], [bb[3], bb[4], bb[2]], [bb[0], bb[4], bb[5]], [bb[3], bb[4], bb[5]]].map(q => P(...q));
        return [Math.min(...c.map(q => q[0])), Math.min(...c.map(q => q[1])), Math.max(...c.map(q => q[0])), Math.max(...c.map(q => q[1]))];
    }
    const overlap = (s, t) => s[0] < t[2] && t[0] < s[2] && s[1] < t[3] && t[1] < s[3];
    const depth = bb => (bb[0] + bb[3]) / 2 + (bb[2] + bb[5]) / 2 + (bb[1] + bb[4]) * .5;
    function sort(list) {
        const n = list.length, scr = list.map(p => screenBox(p.b)), edges = Array.from({ length: n }, () => []), indeg = new Array(n).fill(0);
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
            if (!overlap(scr[i], scr[j])) continue;
            const a = list[i].b, b = list[j].b, ab = behind(a, b), ba = behind(b, a);
            // Separated on two axes in opposite directions: they cannot overlap on screen.
            if (ab && !ba) { edges[i].push(j); indeg[j]++; }
            else if (ba && !ab) { edges[j].push(i); indeg[i]++; }
            // Intersecting solids get no hard edge; the depth key orders them.
        }
        const keys = list.map(p => depth(p.b)), done = new Array(n).fill(false), order = [];
        const ready = []; for (let i = 0; i < n; i++) if (!indeg[i]) ready.push(i);
        while (order.length < n) {
            if (!ready.length) { // Break a cycle at the furthest remaining solid.
                let best = -1; for (let i = 0; i < n; i++) if (!done[i] && (best < 0 || keys[i] < keys[best])) best = i;
                ready.push(best); indeg[best] = 0;
            }
            ready.sort((a, b) => keys[b] - keys[a]);
            const i = ready.pop(); if (done[i]) continue;
            done[i] = true; order.push(list[i]);
            for (const j of edges[i]) if (!done[j] && --indeg[j] === 0) ready.push(j);
        }
        return order;
    }

    H.Art = { S, P, K, pts, mix, light, dark, lum, palette, furniture, svgOf, shadowOf, sort, behind, screenBox, overlap, depth, seeded };
})(window.ByndHome3D);
