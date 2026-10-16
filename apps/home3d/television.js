(function (H) {
    'use strict';
    // Original, local programme. The texture is allocated once and uploaded
    // only while a seated viewer is watching, at a bounded mobile frame rate.
    function screen(root, width, height, position) {
        const T = ByndHomeEngine, material = new T.MeshBasicMaterial({ color: '#0b1119', toneMapped: false });
        const mesh = new T.Mesh(new T.PlaneGeometry(width, height), material);
        mesh.name = 'television-screen'; mesh.position.fromArray(position);
        mesh.userData.effect = 'screen';
        mesh.userData.ownedMaterial = material; root.add(mesh);
        root.userData.television = { screen: mesh, playing: false, frames: 0, last: -Infinity };
        return mesh;
    }
    function prepare(tv) {
        if (tv.context) return true;
        if (tv.unavailable) return false;
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
        const context = canvas.getContext('2d'); if (!context) { tv.unavailable = true; return false; }
        const T = ByndHomeEngine, texture = new T.CanvasTexture(canvas);
        texture.colorSpace = T.SRGBColorSpace;
        texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter;
        texture.generateMipmaps = true; texture.anisotropy = 1;
        tv.canvas = canvas; tv.context = context; tv.texture = texture; tv.screen.userData.ownedTexture = texture;
        return true;
    }
    // Five local programmes follow the time of day (colours only, same drawing).
    const PROGRAMMES = [
        { id: 'morning', name: '晨间天气', from: 6, to: 10, sky: '#bfe3f2', sun: '#fff1c2' },
        { id: 'nature', name: '小动物纪录片', from: 10, to: 14, sky: '#9cd1eb', sun: '#ffebaf' },
        { id: 'cartoon', name: '午后动画', from: 14, to: 18, sky: '#f4c9a8', sun: '#fff0d0' },
        { id: 'drama', name: '晚间连续剧', from: 18, to: 23, sky: '#6f7fb6', sun: '#f6e2a8' },
        { id: 'night', name: '深夜音乐台', from: 23, to: 30, sky: '#3b4470', sun: '#e8e4ff' }
    ];
    function programmeAt(hour) { const h = hour < 6 ? hour + 24 : hour; return PROGRAMMES.find(p => h >= p.from && h < p.to) || PROGRAMMES[1]; }
    function programme(tv, time) {
        const c = tv.context, t = time * .001, show = programmeAt(new Date().getHours());
        c.fillStyle = show.sky; c.fillRect(0, 0, 512, 256);
        c.fillStyle = show.sun; c.beginPath(); c.arc(415, 48, 23, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff6e6';
        for (let i = 0; i < 3; i++) { const x = ((i * 183 + t * 12) % 610) - 50; c.beginPath(); c.ellipse(x, 52 + i * 15, 38, 12, 0, 0, Math.PI * 2); c.fill(); }
        for (const [color, y, rise] of [['#8dbca0', 180, 65], ['#bfd58c', 223, 44]]) {
            c.fillStyle = color; c.beginPath(); c.moveTo(0, 256); c.lineTo(0, y);
            c.bezierCurveTo(110, y - rise, 175, y + rise, 290, y); c.bezierCurveTo(385, y - rise, 440, y - rise, 512, y + 10); c.lineTo(512, 256); c.fill();
        }
        c.save(); c.translate(255 + Math.sin(t * .7) * 9, 199);
        c.fillStyle = '#f6e5cf'; c.beginPath(); c.ellipse(0, 10, 23, 28, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(0, -17, 22, 0, Math.PI * 2); c.fill();
        for (const x of [-16, 16]) { c.beginPath(); c.moveTo(x - 9, -28); c.lineTo(x, -49); c.lineTo(x + 9, -28); c.fill(); }
        c.fillStyle = '#4f5552'; for (const x of [-8, 8]) { c.beginPath(); c.arc(x, -19, 2.5, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#d48e97'; c.fillRect(-2, -12, 4, 3); c.restore();
        for (let i = 0; i < 3; i++) { const x = 100 + i * 145 + Math.sin(t + i) * 30, y = 95 + Math.cos(t * 1.3 + i) * 17;
            c.fillStyle = ['#f3cb78', '#e8a7c2', '#b5aae3'][i]; c.beginPath(); c.ellipse(x - 4, y, 3 + Math.abs(Math.sin(t * 6)) * 4, 7, -.5, 0, Math.PI * 2); c.ellipse(x + 4, y, 3 + Math.abs(Math.sin(t * 6)) * 4, 7, .5, 0, Math.PI * 2); c.fill(); }
        // The shared texture budget may downsize this CanvasTexture. Continue
        // drawing into that allocation instead of leaving a frozen resized copy.
        if (tv.texture.image !== tv.canvas) {
            const image = tv.texture.image; image.getContext('2d')?.drawImage(tv.canvas, 0, 0, image.width, image.height);
        }
        tv.texture.needsUpdate = true; tv.frames++;
    }
    function update(rows, actors, time, profile, reduced, onNotice) {
        for (const row of rows) {
            const tv = row.model.userData.television; if (!tv) continue;
            const watching = actors.some(a => a.root.visible && a.action === 'Watch' && !a.path.length && a.anchor?.watchingTV && a.anchor.placementId === row.placement.id);
            if (watching && !prepare(tv)) { if (!tv.notified) { tv.notified = true; onNotice?.('设备暂时无法显示电视画面，请重新进入小屋再试。', true); } continue; }
            if (tv.playing !== watching) { tv.playing = watching; tv.screen.material.color.set(watching ? '#ffffff' : '#0b1119'); tv.screen.material.map = watching ? tv.texture : null; tv.screen.material.needsUpdate = true; }
            const fps = profile.tier === 'smooth' ? 4 : profile.tier === 'ultra' ? 8 : 6;
            if (watching && (tv.frames === 0 || !reduced && time - tv.last >= 1000 / fps)) { programme(tv, time); tv.last = time; }
        }
    }
    H.Television = { screen, update, programmeAt, programmes: PROGRAMMES };
})(window.ByndHome3D);
