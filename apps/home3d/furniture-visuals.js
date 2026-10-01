(function (H) {
    'use strict';
    function create(item, materials) {
        const T = ByndHomeEngine, root = new T.Group(), S = H.Shapes;
        const style = H.catalogs.furnitureCatalog.styles[item.style], [w, d] = item.footprint;
        const wood = materials.get('soft_wood', style.wood), fabric = materials.get('cream_fabric', style.fabric), accent = materials.get('cream_fabric', style.accent), white = materials.get('paper'), metal = materials.get('warm_metal', '#ccb482');
        const box = (size, pos, mat = wood, radius = .05) => S.rounded(root, size, pos, mat, radius);
        const ball = (size, pos, mat = accent) => S.sphere(root, size, pos, mat);
        const legs = (height, x = w / 2 - .12, z = d / 2 - .12) => { for (const px of [-x, x]) for (const pz of [-z, z]) box([.09, height, .09], [px, height / 2, pz]); };
        if (item.type === 'bed') {
            const h = H.Furniture.support(item).baseHeight;
            const quilt = item.style === 'cream' ? materials.get('cream_fabric', '#e5c5bf') : fabric;
            const throwMat = materials.woven(item.style === 'cream' ? '#bca7ba' : style.accent, 'knit');
            legs(Math.max(.12, h - .3)); box([w, .28, d], [0, h - .2, 0], quilt, .13);
            box([w - .1, .24, d - .08], [0, h, 0], white, .11);
            // Soft, separate upholstered panels replace the hard footboard. The
            // headboard and pillow side are always local -Z for every bed style.
            const headHeight = item.style === 'japanese' ? .45 : 1.05;
            box([w, headHeight, .18], [0, h + .34, -d / 2 + .04], item.style === 'japanese' || item.style === 'chinese' ? wood : quilt, .09);
            if (!['japanese', 'chinese'].includes(item.style)) for (const x of [-w * .32, 0, w * .32]) {
                box([w * .31, headHeight - .09, .16], [x, h + .36, -d / 2 + .15], quilt, .08);
                ball([.023, .023, .014], [x, h + .44, -d / 2 + .239], throwMat);
            }
            for (const x of [-w * .23, w * .23]) {
                const pillow = box([w * .42, .22, d * .21], [x, h + .27, -d * .34], white, .105); pillow.rotation.z = x < 0 ? -.035 : .035;
                box([w * .42 - .04, .015, d * .21 - .04], [x, h + .383, -d * .34], materials.woven('#f5e9dc', 'stripe'), .007);
            }
            box([w - .05, .25, d * .65], [0, h + .2, d * .145], quilt, .12);
            box([w - .12, .105, .29], [0, h + .337, -d * .13], white, .05);
            // A knitted throw falls over the foot of the bed instead of a flat
            // painted rectangle; seam and fringe remain actual small geometry.
            box([w + .03, .05, d * .25], [0, h + .35, d * .335], throwMat, .025);
            box([w + .03, .27, .05], [0, h + .23, d * .467], throwMat, .025);
            for (let i = 0; i < 14; i++) box([.023, .10, .025], [-w * .47 + i * w * .072, h + .055, d * .471], throwMat, .008);
            if (item.style === 'european') { ball([w * .35, .34, .07], [0, h + .55, -d / 2], accent); for (const x of [-w / 2, w / 2]) ball([.1, .1, .1], [x, h + .67, -d / 2], metal); }
            if (item.style === 'chinese') {
                for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) box([.085, 2.3, .085], [x, 1.15, z]);
                box([w + .15, .12, d + .1], [0, 2.25, 0]);
                for (const x of [-w / 2, w / 2]) box([.07, .95, d * .28], [x, 1.72, -d * .35], fabric, .025);
            }
        } else if (item.type === 'sofa' || item.type === 'chair') {
            const seatFabric = item.type === 'chair' && item.style === 'cream' ? materials.get('cream_fabric', '#b4c1ae') : fabric;
            legs(.35); box([w, .23, d], [0, .4, 0], wood);
            const cushionTop = item.type === 'sofa' ? H.Furniture.support(item).seatHeight : .615;
            const seats = item.type === 'sofa' ? 2 : 1;
            for (let i = 0; i < seats; i++) box([(w - .36) / seats - .025, .19, d - .24], [(i - (seats - 1) / 2) * (w - .36) / seats, cushionTop - .095, .06], seatFabric, .085);
            box([w, .55, .17], [0, .85, -d / 2 + .08], seatFabric, .07);
            for (const x of [-w / 2 + .09, w / 2 - .09]) box([.18, .38, d], [x, .68, 0], item.style === 'japanese' ? wood : seatFabric, .06);
            if (item.type === 'sofa') {
                // Pillows stay behind the declared seat, rather than intersecting
                // the character's hips or covering the middle of the torso.
                for (const x of [-w * .30, w * .30]) { const cushion = box([.36, .36, .13], [x, .84, -d * .27], accent, .065); cushion.rotation.z = x < 0 ? .16 : -.16; }
                box([.29, .025, d * .82], [-w / 2 + .09, .885, .04], materials.woven(style.accent, 'knit'), .012);
                box([.035, .35, d * .8], [-w / 2 - .012, .70, .04], materials.woven(style.accent, 'knit'), .015);
            }
        } else if (['desk', 'table', 'stove', 'piano'].includes(item.type)) {
            const h = item.type === 'table' ? (item.style === 'japanese' ? .28 : .46) : .82;
            legs(h - .09); box([w, .12, d], [0, h, 0]);
            if (item.type === 'desk') { box([.38, .35, d * .8], [w * .28, h - .23, 0]); box([.28, .035, .23], [-.2, h + .09, -.05], accent); box([.045, .2, .045], [-.2, h + .18, -.05], metal); }
            if (item.type === 'table') for (const x of [-.26, .26]) { ball([.075, .095, .075], [x, h + .13, 0], white); ball([.06, .01, .06], [x, h + .22, 0], wood); }
            if (item.type === 'piano') {
                box([w, .56, d * .7], [0, 1.05, -.05], accent); box([w * .9, .045, .23], [0, .89, d / 2], white, .008);
                for (let i = 0; i < 12; i++) { const x = -w * .42 + i * w * .075; box([.008, .01, .22], [x, .92, d / 2], wood, .002); if (i % 3 !== 0) box([.04, .04, .12], [x + .025, .94, d / 2 - .06], materials.get('screen'), .006); }
            }
            if (item.type === 'stove') { box([w, .68, d], [0, .38, 0], fabric); for (const x of [-.25, .25]) ball([.19, .018, .19], [x, .9, 0], metal); box([w * .7, .38, .02], [0, .4, d / 2 + .02], materials.get('screen')); box([.4, .04, .04], [0, .62, d / 2 + .04], metal); }
        } else if (item.type === 'cabinet') {
            if (item.id === 'nightstand_01') {
                const pedestal = new T.Mesh(new T.CylinderGeometry(w * .22, w * .30, .57, 32), wood); pedestal.position.y = .32; pedestal.castShadow = pedestal.receiveShadow = true; root.add(pedestal);
                const top = new T.Mesh(new T.CylinderGeometry(w / 2, w / 2, .08, 40), white); top.position.y = .64; top.castShadow = top.receiveShadow = true; root.add(top);
                box([.18, .035, .22], [-.13, .697, .09], accent, .009); box([.17, .015, .20], [-.13, .724, .09], white, .004);
            } else { legs(.18); box([w, 1, d], [0, .66, 0]); for (const x of [-w * .24, w * .24]) { box([w * .45, .83, .05], [x, .66, d / 2], fabric); ball([.035, .035, .035], [x * .3, .65, d / 2 + .05], metal); } }
        } else if (item.type === 'lamp') {
            const table = item.id === 'table_lamp_01', h = table ? .46 : 1.43, radius = table ? .19 : .26;
            ball([radius * .8, .035, radius * .8], [0, .035, 0], wood); box([.04, h - .15, .04], [0, (h - .15) / 2, 0], metal);
            const shade = new T.Mesh(new T.CylinderGeometry(radius * .62, radius, table ? .24 : .32, 32), materials.glow('#f9e4c3', materials.night ? .6 : .15)); shade.position.y = h; shade.castShadow = true; root.add(shade);
            root.userData.lampHeight = h;
            if (item.style === 'japanese' || item.style === 'chinese') { box([.42, .53, .42], [0, 1.37, 0], white, .05); for (const x of [-.2, .2]) box([.025, .53, .45], [x, 1.37, 0]); }
        } else if (item.type === 'plant') {
            ball([.24, .25, .24], [0, .23, 0], fabric); box([.025, .6, .025], [0, .62, 0], accent); for (let i = 0; i < 5; i++) { const a = i * 2.4; ball([.15, .06, .1], [Math.cos(a) * .12, .53 + i * .075, Math.sin(a) * .12], accent); }
        } else if (item.type === 'tub') {
            box([w, .52, d], [0, .28, 0], fabric, .16); box([w - .16, .025, d - .16], [0, .56, 0], materials.get('milky_plastic', '#b7dfe4'), .14);
            for (const x of [-w / 2 + .07, w / 2 - .07]) box([.14, .16, d], [x, .57, 0], white, .06);
            for (const z of [-d / 2 + .07, d / 2 - .07]) box([w, .16, .14], [0, .57, z], white, .06);
            box([.04, .34, .04], [w / 2 - .2, .72, -d / 2], metal); box([.04, .04, .22], [w / 2 - .2, .89, -d / 2 + .09], metal);
            for (let i = 0; i < 5; i++) ball([.06, .06, .06], [Math.sin(i) * .4, .61, Math.cos(i) * .25], white);
        }
        root.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
        return root;
    }
    H.FurnitureVisuals = { create };
})(window.ByndHome3D);
