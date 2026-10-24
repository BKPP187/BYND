(function (H) {
    'use strict';
    const clamp = x => Math.max(0, Math.min(1, x)), smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
    function sample(date = new Date()) {
        const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600, angle = (hour - 6) / 24 * Math.PI * 2;
        const altitude = Math.sin(angle), daylight = smooth((altitude + .08) / .37), twilight = 1 - smooth(Math.abs(altitude) / .38);
        const sun = [-Math.cos(angle) * 9, Math.max(2.2, Math.abs(altitude) * 8), 5.5];
        const night = daylight < .12;
        return { hour, daylight, twilight, night, sun, phase: night ? '月夜' : twilight > .5 ? hour < 12 ? '晨光' : '黄昏' : '白昼', clock: String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0'), sky: night ? '#4d5877' : twilight > .5 ? '#dbbeab' : '#dbe7ce', sunlight: night ? '#b7cef1' : twilight > .5 ? '#ffc483' : '#ffeccc', sunIntensity: .42 + daylight * 2.45, ambientIntensity: .82 + daylight * .5, lamps: 1 - smooth((daylight - .12) / .72) };
    }
    function fixture(materials, small = false, look = '') {
        const T = ByndHomeEngine, root = new T.Group(); root.name = 'ceiling-pendant';
        if (look && !small) {
            // Each full-home look gets its own ceiling light silhouette.
            const glow = materials.glow(look === 'guofeng' ? '#e65a44' : '#fff0cb', look === 'guofeng' ? .4 : .3);
            const mesh = (g, m, y) => { const n = new T.Mesh(g, m); n.position.y = y; root.add(n); return n; };
            if (look === 'guofeng') {
                const wood = materials.get('soft_wood', '#4c3124'), gold = materials.get('warm_metal', '#c9a256'), red = materials.get('cream_fabric', '#a8433a');
                mesh(new T.CylinderGeometry(.01, .01, .34, 6), gold, -.17);
                mesh(new T.CylinderGeometry(.16, .16, .05, 6), wood, -.36);
                const body = mesh(new T.CylinderGeometry(.21, .21, .36, 6, 1), glow, -.56); body.rotation.y = Math.PI / 6;
                for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const post = mesh(new T.BoxGeometry(.025, .42, .025), wood, -.56); post.position.x = Math.cos(a) * .21; post.position.z = Math.sin(a) * .21; }
                mesh(new T.CylinderGeometry(.24, .2, .05, 6), wood, -.77);
                mesh(new T.CylinderGeometry(.012, .035, .18, 8), red, -.89);
            } else if (look === 'nordic') {
                const black = materials.get('warm_metal', '#2a2c2f');
                mesh(new T.CylinderGeometry(.008, .008, .5, 6), black, -.25);
                const dome = mesh(new T.SphereGeometry(.24, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), black, -.56); dome.material = black.clone(); dome.material.side = T.DoubleSide; dome.userData.ownedMaterial = dome.material;
                mesh(new T.CircleGeometry(.22, 24), glow, -.565).rotation.x = Math.PI / 2;
            } else {
                const brass = materials.get('warm_metal', '#c9a256');
                mesh(new T.CylinderGeometry(.01, .01, .22, 6), brass, -.11);
                mesh(new T.CylinderGeometry(.06, .08, .06, 12), brass, -.25);
                const globe = mesh(new T.SphereGeometry(.2, 20, 14), glow, -.46); globe.scale.y = .9;
                for (const a of [0, 2.1, 4.2]) { const arm = mesh(new T.CylinderGeometry(.008, .008, .34, 6), brass, -.32); arm.rotation.z = 1.1; arm.rotation.y = a; }
            }
            root.userData.ceilingLamp = true; root.userData.luminousMaterial = glow;
            return root;
        }
        const metal = materials.get('warm_metal', '#ad926d'), cream = materials.get('milky_plastic', '#eee8d8'), glow = materials.glow('#fff0cb', .25);
        H.Shapes.rounded(root, [.12, .025, .12], [0, 0, 0], metal, .015);
        const stem = new T.Mesh(new T.CylinderGeometry(.012, .012, .30, 8), metal); stem.position.y = -.15; root.add(stem);
        const shade = new T.Mesh(new T.CylinderGeometry(small ? .12 : .18, small ? .22 : .34, .19, 24, 1, true), cream); shade.position.y = -.39; root.add(shade);
        const diffuser = new T.Mesh(new T.CylinderGeometry(small ? .215 : .335, small ? .215 : .335, .02, 24), glow); diffuser.position.y = -.485; root.add(diffuser);
        root.userData.ceilingLamp = true; root.userData.luminousMaterial = glow;
        return root;
    }
    function apply(state, lights, renderer, scene, ground, skyBase, luminous) {
        const T = ByndHomeEngine, daylight = state.daylight;
        lights.sun.color.set(state.sunlight); lights.sun.intensity = state.sunIntensity;
        lights.ambient.color.set(state.night ? '#a9b4d6' : '#fff4e6'); lights.ambient.groundColor.set(state.night ? '#827e9c' : '#b9a890'); lights.ambient.intensity = state.ambientIntensity * (state.night ? .62 : .72);
        // A cool fill against the warm sun gives depth instead of a flat wash.
        lights.fill.intensity = .17 + daylight * .42; lights.fill.color.set(state.night ? '#c4cfee' : '#d9def4');
        // Keep rooms readable at midnight, with a warm indoor ambient fallback
        // even on the smooth tier where extra point lights are disabled.
        lights.ambient.color.lerp(new T.Color('#ffd9ad'), state.lamps * .45);
        // Bright, airy daytime like a dollhouse build; nights stay calm.
        renderer.toneMappingExposure = (state.night ? .92 : .98) + daylight * .14;
        scene.background.copy(new T.Color(skyBase)).lerp(new T.Color(state.sky), state.night ? .9 : .3); ground.color.copy(scene.background);
        for (const material of luminous) { material.emissiveIntensity = .08 + state.lamps * 1.15; material.emissive.set(state.night?'#ffdaa6':'#fff0ce'); }
    }
    H.Daylight = { sample, fixture, apply };
})(window.ByndHome3D);
