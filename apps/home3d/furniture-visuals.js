(function (H) {
    'use strict';
    const detailedTypes = ['bed', 'sofa', 'chair', 'desk', 'table', 'cabinet', 'bookcase', 'lamp', 'plant', 'stove', 'sink', 'fridge', 'fireplace', 'wardrobe', 'television', 'computer'];
    function handles(item) { return item.type === 'stove' || ['bear_01', 'gamepad_01', 'game_speaker_01', 'keyboard_01', 'kitchen_spice_shelf'].includes(item.id) || (['cream', 'european', 'modern', 'botanical', 'rose', 'pink', 'monochrome'].includes(item.style) || item.interiorPalette) && detailedTypes.includes(item.type); }
    // Original geometry inspired by the supplied miniature interiors. Dimensions
    // and seat/support heights remain catalog-owned, including existing saves.
    function cozy(item, materials) {
        const T = ByndHomeEngine, root = new T.Group(), [w, d] = item.footprint;
        const classic = item.style === 'european', pink = item.style === 'pink', botanical = item.style === 'botanical', loft = item.style === 'rose', modern = ['modern', 'monochrome'].includes(item.style);
        const palette = item.interiorPalette || H.catalogs.furnitureCatalog.styles[item.style] || {};
        const wood = materials.get('soft_wood', palette.wood || (classic ? '#644735' : '#b89b78'));
        const ivory = materials.get('milky_plastic', palette.trim || '#eee9dc'), fabric = materials.get('cream_fabric', palette.fabric || (classic ? '#e5d7bf' : '#e8e5d7'));
        const sage = materials.get('milky_plastic', palette.accent || '#a9c7ba'), accent = materials.woven(palette.accent || (classic ? '#ab9580' : '#aebeaa'), 'stripe');
        const brass = materials.get('warm_metal', '#b69a62'), dark = materials.get('screen', '#343730');
        const parts = [];
        function mesh(geometry, pos, mat) { const node = new T.Mesh(geometry, mat); node.position.set(...pos); root.add(node); parts.push(node); return node; }
        function box(size, pos, mat = wood, r = .015) { return mesh(r ? new T.RoundedBoxGeometry(...size, 1, Math.min(r, ...size.map(n => n / 2))) : new T.BoxGeometry(...size), pos, mat); }
        function ellipsoid(size, pos, mat = fabric) { const node = mesh(new T.SphereGeometry(1, 16, 10), pos, mat); node.scale.set(...size); return node; }
        function cylinder(top, bottom, h, pos, mat = wood, segments = 20) { return mesh(new T.CylinderGeometry(top, bottom, h, segments), pos, mat); }
        function curve(points, radius, mat = wood) { return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 12, radius, 6, false), [0, 0, 0], mat); }
        function legs(h, x = w / 2 - .09, z = d / 2 - .09) {
            for (const px of [-x, x]) for (const pz of [-z, z]) {
                if (classic) curve([[px, h, pz], [px, h * .7, pz], [px * 1.035, h * .28, pz * 1.035], [px, .04, pz]], .038);
                else cylinder(modern ? .023 : .045, modern ? .023 : .029, h, [px, h / 2, pz], modern ? materials.get('warm_metal', '#545b51') : wood);
            }
        }
        function panel(x, y, z, pw, ph, mat = ivory) {
            box([pw, ph, .045], [x, y, z], mat);
            for (const xx of [x - pw / 2 + .04, x + pw / 2 - .04]) box([.025, ph - .075, .018], [xx, y, z + .032], mat, .004);
            for (const yy of [y - ph / 2 + .04, y + ph / 2 - .04]) box([pw - .075, .025, .018], [x, yy, z + .032], mat, .004);
        }
        function knob(x, y, z) { ellipsoid([.022, .022, .018], [x, y, z], brass); }
        function pull(x, y, z, span = .12) {
            for (const xx of [x - span / 2, x + span / 2]) box([.013, .013, .025], [xx, y, z], brass, .004);
            box([span + .012, .015, .015], [x, y, z + .019], brass, .006);
        }
        function crest(x, y, z, span) {
            for (const side of [-1, 1]) curve([[x, y, z], [x + side * span * .2, y + .055, z], [x + side * span * .4, y + .025, z], [x + side * span * .5, y + .06, z]], .013, brass);
            ellipsoid([.033, .047, .013], [x, y + .035, z], brass);
        }
        function tuft(x, y, z, span, height) {
            const seam = materials.get('cream_fabric', palette.accent || '#c9b99f');
            for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
                const xx = x - span * .4 + col * span * .2, yy = y + (row - .5) * height * .4;
                for (const side of [-1, 1]) curve([[xx - span * .095, yy + side * height * .19, z], [xx, yy, z + .004], [xx + span * .095, yy - side * height * .19, z]], .003, seam);
                ellipsoid([.013, .013, .008], [xx, yy, z + .012], seam);
            }
        }
        function pillow(x, y, z, size, color) {
            const node = box([size, size * .9, .13], [x, y, z], materials.woven(color, 'gingham'), .06);
            node.rotation.z = x < 0 ? -.13 : .13; node.rotation.x = -.13;
        }
        function flower(x, y, z, scale = 1) {
            cylinder(.055 * scale, .037 * scale, .13 * scale, [x, y + .065 * scale, z], ivory);
            for (let i = 0; i < 3; i++) {
                const xx = x + Math.sin(i * 2.4) * .046 * scale, zz = z + Math.cos(i * 2.4) * .046 * scale;
                box([.009, .19 * scale, .009], [xx, y + .20 * scale, zz], materials.get('sage', '#70875b'), 0);
                ellipsoid([.045 * scale, .035 * scale, .045 * scale], [xx, y + .30 * scale, zz], fabric);
            }
        }
        function books(x, y, z, count, scale = 1) {
            const colors = modern ? ['#727982', '#e6e1d8', '#a59b8c'] : ['#a9b6a1', '#d7bfaa', '#879a9a', '#ede6d7', '#bfa99a'];
            for (let i = 0; i < count; i++) {
                const height = (.17 + (i % 3) * .025) * scale, xx = x + i * .07 * scale;
                const spine = item.style === 'monochrome' ? [fabric, wood, ivory, sage][i % 4] : materials.get('cream_fabric', colors[i % colors.length]);
                box([.055 * scale, height, .13 * scale], [xx, y + height / 2, z], spine, .003);
                box([.038 * scale, .012 * scale, .008], [xx, y + height * .78, z + .07 * scale], brass, 0);
            }
        }
        function cup(x, y, z) {
            cylinder(.057, .045, .10, [x, y + .05, z], ivory);
            cylinder(.047, .047, .004, [x, y + .102, z], materials.get('soft_wood', '#80634d'));
            const handle = mesh(new T.TorusGeometry(.034, .008, 6, 12), [x + .058, y + .05, z], ivory); handle.rotation.y = 0;
        }
        if (item.type === 'sofa' || item.type === 'chair') {
            const sofa = item.type === 'sofa', lounge = sofa || w > .8 || classic, top = H.Furniture.support(item).seatHeight;
            legs(top - .26); box([w - .06, modern ? .10 : .18, d - .06], [0, top - (modern ? .21 : .19), 0]);
            const seatMat = !sofa && !classic ? materials.get('cream_fabric', palette.accent || '#b8c7b6') : fabric;
            const arm = lounge ? modern ? .09 : .15 : .06, seats = sofa ? 2 : 1, sw = (w - arm * 2 - .04) / seats;
            for (let i = 0; i < seats; i++) {
                const x = (i - (seats - 1) / 2) * sw;
                box([sw - .022, .18, d - .22], [x, top - .09, .035], seatMat, .065);
                box([sw - .022, .46, .17], [x, top + .23, -d / 2 + .115], seatMat, .065);
            }
            if (classic || pink || loft) {
                curve([[-w / 2 + .04, top + .38, -d / 2 + .04], [-w * .25, top + .50, -d / 2 + .04], [0, top + (pink ? .70 : .59), -d / 2 + .04], [w * .25, top + .50, -d / 2 + .04], [w / 2 - .04, top + .38, -d / 2 + .04]], .044, pink || loft ? ivory : wood);
                tuft(0, top + .23, -d / 2 + .205, w - .38, .43);
            } else if (!modern) box([w, .07, .10], [0, top + .49, -d / 2 + .04], wood, .035);
            if (botanical) {
                for (let i = 0; i < 17; i++) box([.045, .44, .035], [-w * .44 + i * w * .055, top + .20, -d / 2 + .013], wood, .007);
                box([w - .07, .03, .04], [0, top - .23, d / 2 - .045], wood);
                for (let i = 0; i < 17; i++) box([.035, .20, .025], [-w * .44 + i * w * .055, top - .13, d / 2 - .045], wood, .003);
            }
            if (classic) { crest(0, top + .59, -d / 2 + .08, w * .35); box([w - .07, .025, .027], [0, top - .235, d / 2 - .024], brass, .008); }
            for (const side of [-1, 1]) {
                const x = side * (w / 2 - arm / 2);
                if (lounge) {
                    box([arm, .32, d - .03], [x, top + .07, 0], seatMat, .065);
                    if (classic || pink || loft) {
                        box([.04, .28, d - .09], [side * (w / 2 - .015), top + .045, 0], wood, .018);
                        const roll = cylinder(arm * .62, arm * .62, d - .05, [x, top + .23, 0], seatMat); roll.rotation.x = Math.PI / 2;
                        const scroll = mesh(new T.TorusGeometry(.055, .012, 6, 16), [x, top + .23, d / 2 + .002], pink || loft ? ivory : brass); scroll.rotation.z = side * .25;
                    }
                } else {
                    cylinder(.021, .021, .49, [x, top + .15, -d / 2 + .04]);
                    box([.04, .045, d * .72], [x, top + .18, -.06], wood);
                }
            }
            if (sofa) {
                // The horizontal head cushion shares its surface with Rooms.anchor.
                box([.50, .04, .40], [-w / 2 + .45, top + .02, .20], fabric, .045);
                pillow(-w * .31, top + .24, -d * .24, .34, palette.accent || '#bac9b8');
                pillow(w * .31, top + .24, -d * .24, .32, palette.fabric || '#d6bdab');
                box([.28, .022, d * .74], [-w / 2 + .08, top + .25, .04], accent);
                box([.022, .38, d * .74], [-w / 2 + .007, top + .05, .04], accent);
                for (let i = 0; i < 6; i++) box([.012, .08, .012], [-w / 2 + .006, top - .16, -d * .23 + i * d * .095], accent, .004);
            }
        } else if (item.type === 'bed') {
            const h = H.Furniture.support(item).baseHeight, quilt = materials.woven(palette.fabric || (classic ? '#d9ccb5' : '#d2d9c9'), 'stripe');
            legs(h - .23); box([w, .20, d], [0, h - .16, 0], wood, .045);
            box([w - .08, .36, d - .09], [0, h + .17, 0], fabric, .085);
            if (botanical) {
                for (let i = 0; i < 13; i++) box([.055, .77, .055], [-w * .45 + i * w * .075, h + .34, -d / 2 + .08], wood, .01);
                for (const y of [h - .02, h + .70]) box([w, .07, .07], [0, y, -d / 2 + .08], wood, .012);
            } else if (modern) box([w, .62, .11], [0, h + .24, -d / 2 + .03], fabric, .035);
            else {
                box([w, .82, .13], [0, h + .34, -d / 2 + .025], pink ? ivory : wood, .065);
                for (const x of [-w * .235, w * .235]) box([w * .455, .62, .10], [x, h + .35, -d / 2 + .13], fabric, .085);
                if (pink || loft) { tuft(0, h + .37, -d / 2 + .194, w - .18, .56); crest(0, h + .78, -d / 2 + .12, w * .35); }
            }
            if (classic) {
                curve([[-w / 2 + .05, h + .68, -d / 2 + .11], [-w * .22, h + .76, -d / 2 + .11], [0, h + .83, -d / 2 + .11], [w * .22, h + .76, -d / 2 + .11], [w / 2 - .05, h + .68, -d / 2 + .11]], .024, brass);
                crest(0, h + .81, -d / 2 + .12, .43);
                for (let row = 0; row < 2; row++) for (let col = 0; col < 7; col++) knob(-w * .38 + col * w * .125, h + .27 + row * .20, -d / 2 + .194);
            }
            for (const x of [-w * .23, w * .23]) {
                const p = box([w * .40, .12, d * .22], [x, h + .30, -d * .33], fabric, .05); p.rotation.x = -.10;
                // Keep decorative cushions beside the sleeping lanes, rather
                // than occupying the exact place where a sleeper's head rests.
                pillow(Math.sign(x) * w * .42, h + .41, -d * .43, .33, classic ? '#bba68a' : '#bbc5b1');
            }
            if (!H.Bedding) box([w - .06, .23, d * .66], [0, h + .205, d * .145], quilt, .075);
            if (!H.Bedding) box([w - .1, .075, .18], [0, h + .325, -d * .15], fabric, .035);
            if (!H.Bedding) box([w + .015, .03, d * .25], [0, h + .337, d * .335], accent);
            if (!H.Bedding) box([w + .015, .25, .03], [0, h + .22, d * .464], accent);
            if (!H.Bedding) for (let i = 0; i < 16; i++) box([.016, .075, .016], [-w * .46 + i * w * .061, h + .062, d * .465], accent, .003);
            box([w - .1, .065, .04], [0, h - .21, d / 2 + .005], classic ? brass : ivory);
        } else if (item.type === 'table' || item.type === 'desk') {
            const desk = item.type === 'desk', dining = item.variant === 'dining', h = item.height || (desk ? .82 : dining ? .78 : .46);
            if (!desk && !dining && (modern || pink || loft)) {
                const top = cylinder(.5, .5, .07, [0, h - .035, 0], modern ? ivory : sage, 48); top.scale.set(w, 1, d);
                cylinder(.08, .13, h - .07, [0, (h - .07) / 2, 0], modern ? wood : ivory);
                const base = cylinder(.30, .34, .035, [0, .025, 0], modern ? wood : ivory); base.scale.set(Math.min(w, 1), 1, Math.min(d, 1));
            } else {
                legs(h - .09); box([w, .08, d], [0, h - .04, 0], classic || botanical ? wood : ivory, .035);
                box([w - .10, .10, d - .10], [0, h - .12, 0]);
            }
            if (!desk) {
                if (!dining && !modern && !pink && !loft) box([w - .18, .04, d - .18], [0, .15, 0], wood);
                if (botanical) for (let i = 0; i < 9; i++) box([.025, .009, d - .03], [-w * .43 + i * w * .107, h + .005, 0], ivory, .002);
                else if (!modern) box([w * .3, .009, d * .80], [0, h + .006, 0], accent, .004);
                cup(-w * .25, h + .005, d * .12); cup(w * .25, h + .005, -d * .12);
                flower(0, h + .015, -d * .12, .75);
                if (dining) {
                    for (const x of [-w * .27, w * .27]) for (const z of [-d * .29, d * .29]) {
                        box([.37, .007, .31], [x, h + .006, z], accent, .018);
                        cylinder(.125, .115, .018, [x, h + .019, z], ivory);
                        cylinder(.09, .09, .008, [x, h + .032, z], fabric);
                        ellipsoid([.052, .026, .042], [x, h + .058, z], wood);
                        box([.05, .009, .17], [x + .165, h + .015, z], fabric, .006);
                        box([.012, .012, .14], [x - .165, h + .018, z], brass, .003);
                    }
                    cylinder(.13, .09, .06, [0, h + .04, d * .2], ivory);
                    for (const x of [-.05, .05]) ellipsoid([.045, .045, .045], [x, h + .09, d * .2], sage);
                }
            } else {
                const pw = Math.min(.43, w * .3), x = w / 2 - pw / 2 - .09;
                box([pw, .44, d - .12], [x, h - .32, 0], ivory);
                for (let i = 0; i < 3; i++) { panel(x, h - .17 - i * .135, d / 2 - .045, pw - .035, .12); pull(x, h - .17 - i * .135, d / 2 + .005, .09); }
                // Desktop remains clear for separately supported computers/keyboards.
                books(-w * .35, h, -d * .28, 3, .75);
            }
            if (classic) crest(0, h - .13, d / 2 - .035, w * .24);
        } else if (['cabinet', 'bookcase', 'wardrobe'].includes(item.type)) {
            const bedside = item.id === 'nightstand_01', shelf = item.type === 'bookcase', wardrobe = item.type === 'wardrobe';
            const h = item.height || (shelf ? 1.85 : wardrobe ? 2.12 : 1.16), body = classic || botanical ? wood : ivory;
            legs(.12); box([w, .07, d], [0, .14, 0], body); box([w + .015, .07, d + .015], [0, h - .035, 0], wood, .025);
            if (!shelf || !botanical && !modern) box([w - .08, h - .22, .035], [0, h / 2 + .04, -d / 2 + .02], body);
            for (const x of [-w / 2 + .035, w / 2 - .035]) box([.07, h - .22, d], [x, h / 2 + .04, 0], body);
            if (shelf) {
                for (let i = 0; i < 4; i++) {
                    const y = .20 + i * (h - .26) / 4;
                    box([w - .1, .035, d - .03], [0, y, 0], body);
                    books(-w * .37, y + .02, .045, i % 2 ? 5 : 4, 1.05);
                    if (i % 2 === 0) flower(w * .29, y + .02, .025, .72);
                }
                if (classic || pink || loft) {
                    for (const side of [-1, 1]) {
                        const x = side * w * .25;
                        for (const xx of [x - w * .22, x + w * .22]) box([.035, h - .26, .045], [xx, h / 2 + .03, d / 2 + .004], body, .003);
                        for (const yy of [.20, h - .15]) box([w * .46, .035, .045], [x, yy, d / 2 + .004], body, .003);
                        for (const yy of [h * .36, h * .61]) box([w * .44, .025, .03], [x, yy, d / 2 + .004], body, .003);
                        knob(x - side * w * .15, h * .43, d / 2 + .028);
                    }
                    curve([[-w / 2, h - .09, d / 2], [-w * .3, h + .04, d / 2], [0, h + .12, d / 2], [w * .3, h + .04, d / 2], [w / 2, h - .09, d / 2]], .025, body);
                }
            } else if (item.variant === 'prep') {
                box([w - .12, h - .22, d - .10], [0, h / 2 + .04, 0], sage);
                for (const x of [-w * .235, w * .235]) { panel(x, h / 2 + .03, d / 2 - .01, w * .46, h - .25, sage); pull(x, h - .24, d / 2 + .04); }
                box([.46, .025, .26], [-w * .15, h + .014, d * .30], wood, .03);
                for (let i = 0; i < 3; i++) ellipsoid([.035, .018, .055], [-w * .15 + (i - 1) * .085, h + .041, d * .30], sage);
                cylinder(.10, .075, .10, [w * .32, h + .06, -.05], ivory);
                for (const x of [w * .32 - .035, w * .32 + .035]) ellipsoid([.04, .04, .04], [x, h + .125, -.05], materials.get('pastel_ceramic', '#dcab85'));
            } else if (bedside || item.variant === 'sideboard') {
                const count = bedside ? 2 : 3, dh = (h - .24) / count;
                for (let i = 0; i < count; i++) { const y = .17 + dh * (i + .5); panel(0, y, d / 2 - .01, w - .12, dh - .02, body); pull(0, y, d / 2 + .04); }
                if (bedside) { box([.16, .025, .21], [-w * .22, h + .013, .06], accent); box([.15, .012, .20], [-w * .22, h + .032, .06], fabric); }
            } else {
                for (const side of [-1, 1]) {
                    const x = side * w * .235;
                    panel(x, h / 2 + .035, d / 2 - .01, w * .46, h - .25, body);
                    pull(x - side * w * .13, h * .50, d / 2 + .04, wardrobe ? .035 : .09);
                    if (classic && wardrobe) panel(x, h * .66, d / 2 + .026, w * .33, h * .41, fabric);
                }
                if (!wardrobe && item.id !== 'tv_cabinet_01') flower(w * .29, h, -.03, .8);
            }
            if (classic) crest(0, h - .045, d / 2 + .013, w * .28);
        } else if (item.type === 'computer') {
            const casing = materials.get('milky_plastic', '#a9b6ab'), screen = materials.get('screen', '#182732');
            box([.27, .025, .18], [0, .014, -.015], casing);
            box([.055, .17, .055], [0, .10, -.025], casing);
            box([w, .43, .055], [0, .35, -.025], casing, .025);
            box([w - .065, .355, .012], [0, .36, .010], screen, .014);
            box([w - .10, .024, .005], [0, .201, .019], sage, .002);
            box([w * .38, .22, .005], [-w * .18, .38, .019], materials.get('milky_plastic', '#738a89'), .007);
            box([w * .33, .012, .006], [-w * .18, .466, .023], ivory, .002);
            for (let i = 0; i < 3; i++) box([w * .22, .018, .006], [w * .25, .43 - i * .055, .021], sage, .004);
            root.userData.screenNormal = [0, 0, 1];
        } else if (item.id === 'keyboard_01') {
            box([w, .025, d], [0, .013, 0], ivory, .012);
            for (let row = 0; row < 4; row++) for (let col = 0; col < 12; col++) box([.042, .012, .035], [-w * .43 + col * .050, .032, -d * .31 + row * .043], row === 0 ? sage : fabric, 0);
            box([.22, .012, .021], [0, .032, d * .40], sage, 0);
        } else if (item.id === 'kitchen_spice_shelf') {
            for (const y of [.10, .43]) {
                box([w, .035, d], [0, y, 0], wood, .008);
                for (const x of [-w * .42, w * .42]) box([.026, .16, .18], [x, y - .04, -.02], brass, .005);
            }
            for (const x of [-.56, -.38, -.20]) { cylinder(.047, .047, .13, [x, .515, 0], fabric); cylinder(.051, .051, .017, [x, .587, 0], wood); }
            cup(.31, .45, -.005); cup(.54, .45, -.005);
            for (let i = 0; i < 4; i++) cylinder(.10, .10, .018, [.40, .13 + i * .020, 0], ivory);
            cylinder(.07, .065, .085, [-.45, .16, 0], sage);
            box([w - .1, .014, .014], [0, .025, .025], brass, .004);
        } else if (item.id === 'bear_01') {
            const plush = materials.get('cream_fabric', '#c5a582');
            ellipsoid([.095, .11, .075], [0, .13, 0], plush);
            ellipsoid([.09, .085, .075], [0, .275, 0], plush);
            for (const side of [-1, 1]) {
                ellipsoid([.032, .035, .027], [side * .067, .33, 0], plush);
                ellipsoid([.036, .061, .04], [side * .11, .14, 0], plush);
                ellipsoid([.047, .033, .059], [side * .055, .035, .044], plush);
                ellipsoid([.009, .009, .005], [side * .035, .29, .069], dark);
            }
            ellipsoid([.050, .035, .029], [0, .255, .067], fabric);
            ellipsoid([.012, .009, .007], [0, .267, .095], dark);
            ellipsoid([.056, .07, .012], [0, .14, .07], fabric);
        } else if (item.id === 'gamepad_01') {
            box([.26, .046, .13], [0, .054, 0], ivory, .025);
            for (const side of [-1, 1]) {
                ellipsoid([.045, .035, .071], [side * .095, .042, .025], ivory);
                cylinder(.018, .018, .023, [side * .047, .082, .016], dark, 12);
            }
            box([.050, .009, .017], [-.085, .084, -.026], dark, .003);
            box([.017, .009, .050], [-.085, .084, -.026], dark, .003);
            for (const [x, z] of [[.075, -.05], [.092, -.034], [.075, -.018], [.058, -.034]]) cylinder(.006, .006, .008, [x, .083, z], sage, 8);
        } else if (item.id === 'game_speaker_01') {
            box([w, .26, d], [0, .13, 0], ivory, .012);
            box([w - .025, .235, .008], [0, .13, d / 2 + .003], dark, .009);
            for (const [y, radius] of [[.08, .047], [.19, .025]]) {
                const driver = cylinder(radius, radius, .012, [0, y, d / 2 + .013], sage); driver.rotation.x = Math.PI / 2;
            }
        } else if (item.type === 'television') {
            const caseMat = modern ? materials.get('milky_plastic', '#303236') : wood, black = materials.get('milky_plastic', '#13171d');
            const sw = modern ? w * .92 : w * .73, sh = modern ? .51 : .43;
            box([w, sh + .10, modern ? .10 : d * .73], [0, .12 + sh / 2, 0], caseMat, .035);
            box([sw + .06, sh + .025, .025], [modern ? 0 : -w * .08, .12 + sh / 2, modern ? .063 : d * .375], black, .025);
            // Local +Z is the viewing face, matching sofa/table orientation.
            box([sw, sh - .03, .009], [modern ? 0 : -w * .08, .12 + sh / 2, modern ? .081 : d * .40], materials.get('milky_plastic', '#202731'), .028);
            if (!modern) for (const y of [.24, .39]) { const dial = cylinder(.031, .031, .025, [w * .37, y, d * .39], brass); dial.rotation.x = Math.PI / 2; }
            for (const x of [-w * .3, w * .3]) box([.07, .095, .22], [x, .055, 0], black);
            root.userData.screenNormal = [0, 0, 1];
        } else if (item.type === 'lamp') {
            const table = item.id === 'table_lamp_01', h = table ? .46 : 1.48, radius = Math.min(w * .47, table ? .18 : .25);
            cylinder(radius * .55, radius * .65, .035, [0, .018, 0]);
            cylinder(.018, .024, h - .12, [0, (h - .12) / 2 + .025], brass);
            if (classic) { ellipsoid([.055, .085, .055], [0, h * .43, 0], wood); cylinder(.062, .05, .025, [0, h * .37, 0], brass); }
            const shade = cylinder(radius * .60, radius, table ? .20 : .30, [0, h - .02, 0], materials.glow('#f2e6ce', materials.night ? .6 : .08), 32);
            for (const y of [h - (table ? .12 : .17), h + (table ? .08 : .13)]) {
                const r = y < h ? radius : radius * .6, ring = mesh(new T.TorusGeometry(r, .008, 6, 32), [0, y, 0], classic ? brass : ivory); ring.rotation.x = Math.PI / 2;
            }
            if (classic) for (let i = 0; i < 12; i++) {
                const a = i * Math.PI / 6;
                curve([[Math.cos(a) * radius, h - (table ? .12 : .17), Math.sin(a) * radius], [Math.cos(a) * radius * .8, h - .02, Math.sin(a) * radius * .8], [Math.cos(a) * radius * .6, h + (table ? .08 : .13), Math.sin(a) * radius * .6]], .004, brass);
            }
            shade.userData.shade = true; root.userData.lampHeight = h;
        } else if (item.type === 'plant') {
            const r = w * .23, greens = ['#768d63', '#92a579', '#b0bd91'].map(color => materials.get('sage', color));
            cylinder(r, r * .72, .27, [0, .15, 0], classic ? ivory : materials.get('pastel_ceramic', '#d4c3a5'));
            cylinder(r * 1.06, r * 1.06, .035, [0, .28, 0], ivory); cylinder(r * .94, r * .94, .013, [0, .30, 0], wood);
            for (let stem = 0; stem < 3; stem++) {
                const angle = stem * 2.4, x = Math.cos(angle) * w * .08, z = Math.sin(angle) * d * .08;
                curve([[x * .2, .29, z * .2], [x, .65, z], [x * .7, 1.08 - stem * .1, z * .7]], .009, greens[0]);
                for (let i = 0; i < 5; i++) {
                    const a = angle + i * 2.4, spread = w * (.13 + (i % 2) * .04), y = .50 + i * .105 - stem * .04;
                    const leaf = ellipsoid([w * .135, .026, w * .06], [x + Math.cos(a) * spread, y, z + Math.sin(a) * spread], greens[(stem + i) % 3]); leaf.rotation.y = -a; leaf.rotation.z = Math.cos(a) * .35;
                }
            }
        } else if (item.type === 'stove' || item.type === 'sink') {
            const sink = item.type === 'sink', h = .88, top = materials.get('soft_wood', '#a78c74');
            box([w - .06, .10, d - .06], [0, .05, 0], wood);
            if (sink) {
                box([w, .08, d], [0, .12, 0], sage);
                box([w, .72, .06], [0, .44, -d / 2 + .03], sage);
                for (const side of [-1, 1]) box([.06, .72, d], [side * (w / 2 - .03), .44, 0], sage);
            } else box([w, .72, d], [0, .44, 0], sage);
            for (const side of [-1, 1]) {
                const pw = sink ? w * .46 : w * .22, x = sink ? side * w * .24 : side * w * .365;
                panel(x, .40, d / 2 + .008, pw, .53, sage); pull(x, .59, d / 2 + .06, .08);
            }
            if (sink) {
                // Open basin: counter rails surround an actual recessed cavity.
                const bw = w * .43, bd = d * .55;
                for (const side of [-1, 1]) box([(w - bw) / 2, .08, d], [side * (w + bw) / 4, h - .04, 0], top);
                for (const side of [-1, 1]) box([bw, .08, (d - bd) / 2], [0, h - .04, side * (d + bd) / 4], top);
                box([bw, .045, bd], [0, h - .17, 0], ivory);
                for (const side of [-1, 1]) { box([.035, .14, bd], [side * bw / 2, h - .1, 0], ivory); box([bw, .14, .035], [0, h - .1, side * bd / 2], ivory); }
                cylinder(.022, .022, .012, [0, h - .14, 0], brass);
                curve([[0, h, -d * .35], [0, h + .25, -d * .35], [0, h + .28, -d * .13], [0, h + .19, -d * .1]], .018, brass);
                flower(-w * .33, h, -d * .13, .7);
            } else {
                box([w, .08, d], [0, h - .04, 0], top, .025);
                box([w * .59, .02, d * .77], [0, h + .01, -.035], dark);
                for (const x of [-w * .16, w * .16]) for (const z of [-d * .23, d * .13]) {
                    const ring = mesh(new T.TorusGeometry(.08, .012, 6, 16), [x, h + .028, z], brass); ring.rotation.x = Math.PI / 2;
                }
                box([w * .44, .39, .03], [0, .40, d / 2 + .025], dark); box([w * .36, .28, .008], [0, .39, d / 2 + .046], materials.get('milky_plastic', '#51594f'));
                pull(0, .59, d / 2 + .051, w * .32);
                for (const x of [-.16, 0, .16]) knob(x, .75, d / 2 + .033);
                const px = -w * .16, pz = -d * .23;
                cylinder(.115, .095, .16, [px, h + .115, pz], ivory);
                cylinder(.12, .12, .025, [px, h + .205, pz], sage);
                ellipsoid([.025, .017, .025], [px, h + .235, pz], wood);
                for (const side of [-1, 1]) box([.065, .020, .034], [px + side * .135, h + .16, pz], brass, .008);
                const panZ = d * .13, pan = materials.get('warm_metal', '#3c4543');
                const profile = [[0, 0], [.125, 0], [.15, .015], [.165, .072], [.153, .082], [.137, .034], [0, .034]].map(v => new T.Vector2(...v));
                mesh(new T.LatheGeometry(profile, 32), [px, h + .033, panZ], pan);
                box([.04, .025, .20], [px, h + .10, panZ + .205], wood, .010);
                for (let i = 0; i < 6; i++) {
                    const angle = i * Math.PI / 3, x = px + Math.cos(angle) * .08, z = panZ + Math.sin(angle) * .08;
                    ellipsoid([.025, .015, .020], [x, h + .082, z], i % 2 ? sage : materials.get('pastel_ceramic', '#e5a36e'));
                }
                root.userData.cookingStation = H.Cooking?.station(item);
            }
        } else if (item.type === 'fridge') {
            const h = item.height || 1.74;
            box([w, h, d], [0, h / 2, 0], ivory, .07);
            panel(0, h * .76, d / 2 + .008, w - .045, h * .43, sage); panel(0, h * .26, d / 2 + .008, w - .045, h * .53, sage);
            for (const y of [h * .66, h * .43]) pull(w * .28, y, d / 2 + .065, .025);
            box([.10, .14, .008], [-w * .21, h * .68, d / 2 + .042], accent, .002);
        } else if (item.type === 'fireplace') {
            const h = item.height || 1.28;
            box([w, .07, d], [0, .035, 0], ivory); box([w, h - .15, .10], [0, h / 2, -d / 2 + .05], ivory);
            box([w * .60, h * .58, .012], [0, h * .31, -d / 2 + .11], dark);
            for (const side of [-1, 1]) {
                box([w * .20, h - .14, d * .83], [side * w * .4, h / 2, 0], ivory);
                panel(side * w * .4, h * .48, d * .415, w * .13, h * .58, ivory);
            }
            box([w, h * .22, d * .84], [0, h * .85, 0], ivory); box([w + .04, .08, d + .025], [0, h - .04, 0], ivory);
            box([w * .59, .018, .018], [0, h * .67, d * .425], brass, .004);
            if (classic) crest(0, h * .84, d * .43, w * .29);
            for (const side of [-1, 1]) { const log = cylinder(.055, .055, w * .42, [0, .15, side * d * .12], wood, 12); log.rotation.z = Math.PI / 2; log.rotation.y = side * .22; }
            for (let i = 0; i < 3; i++) ellipsoid([.055, .12 + (i % 2) * .05, .045], [(i - 1) * .095, .28, .015], materials.glow(i % 2 ? '#e6a154' : '#d9803e', .7));
            flower(w * .30, h, 0, .85);
            for (const x of [-w * .30, -w * .19]) { cylinder(.035, .045, .045, [x, h + .025, 0], brass); cylinder(.015, .015, .22, [x, h + .14, 0], fabric); }
        }
        // Bake static furniture by material. Intricate trim doesn't mean hundreds
        // of draw calls, and each placement still has one pickable editable root.
        root.updateMatrixWorld(true);
        const batches = new Map();
        for (const node of parts) {
            const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld), flat = geometry.index ? geometry.toNonIndexed() : geometry;
            if (flat !== geometry) geometry.dispose();
            if (!batches.has(node.material)) batches.set(node.material, []);
            batches.get(node.material).push(flat); node.geometry.dispose(); root.remove(node);
        }
        for (const [mat, list] of batches) {
            const geometry = new T.BufferGeometry();
            for (const attribute of ['position', 'normal', 'uv']) {
                const size = attribute === 'uv' ? 2 : 3, length = list.reduce((sum, g) => sum + g.getAttribute(attribute).array.length, 0), array = new Float32Array(length);
                let offset = 0; for (const g of list) { array.set(g.getAttribute(attribute).array, offset); offset += g.getAttribute(attribute).array.length; }
                geometry.setAttribute(attribute, new T.BufferAttribute(array, size));
            }
            list.forEach(g => g.dispose()); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
            const node = new T.Mesh(geometry, mat); node.castShadow = node.receiveShadow = true; root.add(node);
        }
        root.userData.furnitureDesign = 'cozy-reference-v1'; root.userData.style = item.style; root.userData.interiorDesign = palette.id || item.style;
        if (item.type === 'bed' && H.Bedding) root.add(H.Bedding.create(item, materials));
        if (item.type === 'stove' && H.Cooking) root.add(H.Cooking.steam(item));
        return root;
    }
    function create(item, materials) {
        if (handles(item)) return cozy(item, materials);
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
            box([w - .1, .46, d - .08], [0, h + .15, 0], white, .11);
            // Soft, separate upholstered panels replace the hard footboard. The
            // headboard and pillow side are always local -Z for every bed style.
            const headHeight = item.style === 'japanese' ? .45 : 1.05;
            box([w, headHeight, .18], [0, h + .34, -d / 2 + .04], item.style === 'japanese' || item.style === 'chinese' ? wood : quilt, .09);
            if (!['japanese', 'chinese'].includes(item.style)) for (const x of [-w * .32, 0, w * .32]) {
                box([w * .31, headHeight - .09, .16], [x, h + .36, -d / 2 + .15], quilt, .08);
                ball([.023, .023, .014], [x, h + .44, -d / 2 + .239], throwMat);
            }
            for (const x of [-w * .23, w * .23]) {
                const pillow = box([w * .42, .16, d * .21], [x, h + .32, -d * .34], white, .075); pillow.rotation.z = x < 0 ? -.035 : .035;
                box([w * .42 - .04, .015, d * .21 - .04], [x, h + .405, -d * .34], materials.woven('#f5e9dc', 'stripe'), .007);
            }
            if (!H.Bedding) box([w - .05, .25, d * .65], [0, h + .2, d * .145], quilt, .12);
            if (!H.Bedding) box([w - .12, .105, .29], [0, h + .337, -d * .13], white, .05);
            // A knitted throw falls over the foot of the bed instead of a flat
            // painted rectangle; seam and fringe remain actual small geometry.
            if (!H.Bedding) box([w + .03, .05, d * .25], [0, h + .35, d * .335], throwMat, .025);
            if (!H.Bedding) box([w + .03, .27, .05], [0, h + .23, d * .467], throwMat, .025);
            if (!H.Bedding) for (let i = 0; i < 14; i++) box([.023, .10, .025], [-w * .47 + i * w * .072, h + .055, d * .471], throwMat, .008);
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
                box([.50, .04, .40], [-w / 2 + .45, .64, .20], fabric, .045);
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
        if (item.type === 'bed' && H.Bedding) root.add(H.Bedding.create(item, materials));
        return root;
    }
    H.FurnitureVisuals = { create, handles };
})(window.ByndHome3D);
