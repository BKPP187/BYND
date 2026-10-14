(function (H) {
    'use strict';
    const clamp = x => Math.max(0, Math.min(1, x)), smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
    function sample(date = new Date()) {
        const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600, angle = (hour - 6) / 24 * Math.PI * 2;
        const altitude = Math.sin(angle), daylight = smooth((altitude + .08) / .37), twilight = 1 - smooth(Math.abs(altitude) / .38);
        const sun = [-Math.cos(angle) * 10, Math.max(1.6, Math.abs(altitude) * 12), 4.5];
        const night = daylight < .12;
        return { hour, daylight, twilight, night, sun, phase: night ? '月夜' : twilight > .5 ? hour < 12 ? '晨光' : '黄昏' : '白昼', clock: String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0'), sky: night ? '#a7b6c5' : twilight > .5 ? '#dbbeab' : '#dbe7ce', sunlight: night ? '#b7cef1' : twilight > .5 ? '#ffd4a0' : '#fff8e9', sunIntensity: .42 + daylight * 1.85, ambientIntensity: .9 + daylight * .72, lamps: 1 - smooth((daylight - .12) / .72) };
    }
    function fixture(materials, small = false) {
        const T = ByndHomeEngine, root = new T.Group(); root.name = 'ceiling-pendant';
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
        lights.ambient.color.set(state.night ? '#cfdaec' : '#fff6df'); lights.ambient.groundColor.set(state.night ? '#827e9c' : '#c5b69c'); lights.ambient.intensity = state.ambientIntensity;
        lights.fill.intensity = .17 + daylight * .48; lights.fill.color.set(state.night ? '#c4cfee' : '#f4ded6');
        // Keep rooms readable at midnight, with a warm indoor ambient fallback
        // even on the smooth tier where extra point lights are disabled.
        lights.ambient.color.lerp(new T.Color('#ffe6c5'), state.lamps * .28);
        renderer.toneMappingExposure = .92 + daylight * .11;
        scene.background.copy(new T.Color(skyBase)).lerp(new T.Color(state.sky), .72); ground.color.copy(scene.background);
        for (const material of luminous) { material.emissiveIntensity = .08 + state.lamps * 1.15; material.emissive.set(state.night?'#ffdaa6':'#fff0ce'); }
    }
    H.Daylight = { sample, fixture, apply };
})(window.ByndHome3D);
