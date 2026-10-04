(function (H) {
    'use strict';
    function defaultProfile(who) {
        return { skin: '#f0d1b6', hair: who === 'user' ? '#795b49' : '#554a40', eyes: '#453a35', shirt: who === 'user' ? '#dcae9d' : '#aaba9d', pants: '#e8d9be', hairStyle: who === 'user' ? 'bob' : 'short', accessory: 'none' };
    }
    function validateProfile(raw, strict = false) {
        const next = { ...defaultProfile('char') };
        for (const key of ['skin', 'hair', 'eyes', 'shirt', 'pants']) {
            if (/^#[0-9a-f]{6}$/i.test(raw?.[key] || '')) next[key] = raw[key];
            else if (strict) throw new Error('外观参数缺少有效的' + key + '颜色，原形象已保留。');
        }
        if (['short', 'bob', 'long', 'bun'].includes(raw?.hairStyle)) next.hairStyle = raw.hairStyle;
        else if (strict) throw new Error('模型返回了不支持的发型，原形象已保留。');
        if (['none', 'glasses', 'bow'].includes(raw?.accessory)) next.accessory = raw.accessory;
        return next;
    }
    function create(profile, materials, who) {
        const T = ByndHomeEngine, S = H.Shapes, p = validateProfile(profile), root = new T.Group(), body = new T.Group(); root.add(body);
        const skin = materials.get('milky_plastic', p.skin), hair = materials.get('cream_fabric', p.hair), eyes = materials.get('milky_plastic', p.eyes);
        const shirt = materials.get('cream_fabric', p.shirt), pants = materials.get('cream_fabric', p.pants), shoe = materials.get('milky_plastic', '#f8efdc');
        const torso = S.rounded(body, [0.43, 0.44, 0.3], [0, 0.63, 0], shirt, 0.13);
        S.rounded(body, [0.38, 0.2, 0.29], [0, 0.39, 0], pants, 0.09);
        const head = new T.Group(); head.position.set(0, 1.08, 0); body.add(head);
        head.scale.setScalar(0.8);
        S.sphere(head, [0.33, 0.34, 0.3], [0, 0, 0], skin);
        // The hair cap is a hemisphere, so the doll's face remains visible from every angle.
        const cap = new T.Mesh(new T.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.47), hair); cap.scale.set(0.345, 0.355, 0.31); cap.position.y = 0.01; cap.castShadow = true; head.add(cap);
        for (let i = 0; i < 4; i++) { const fringe = S.sphere(head, [0.105, 0.12 + (i % 2) * 0.025, 0.075], [-0.19 + i * 0.125, 0.18, 0.24], hair); fringe.rotation.z = 0.2; }
        if (p.hairStyle !== 'short') {
            const length = p.hairStyle === 'long' ? 0.47 : 0.24;
            for (const x of [-0.29, 0.29]) S.sphere(head, [0.1, length, 0.16], [x, -length * 0.35, -0.025], hair);
            if (p.hairStyle === 'long') S.sphere(head, [0.3, 0.42, 0.13], [0, -0.19, -0.23], hair);
            if (p.hairStyle === 'bun') S.sphere(head, [0.18, 0.17, 0.16], [0, 0.33, -0.17], hair);
        }
        const eyeMeshes = [];
        for (const x of [-0.115, 0.115]) {
            S.sphere(head, [0.07, 0.08, 0.07], [x * 2.7, -0.015, 0], skin);
            const eye = S.sphere(head, [0.037, 0.048, 0.018], [x, 0.015, 0.282], eyes); eyeMeshes.push(eye);
            S.sphere(head, [0.011, 0.013, 0.008], [x - 0.009, 0.028, 0.298], shoe);
            S.sphere(head, [0.065, 0.031, 0.012], [x * 1.64, -0.06, 0.246], materials.get('rose', '#e3a99c'));
        }
        S.sphere(head, [0.03, 0.023, 0.018], [0, -0.025, 0.3], skin);
        const smile = new T.Mesh(new T.TorusGeometry(0.043, 0.007, 5, 12, Math.PI), eyes); smile.position.set(0, -0.085, 0.286); smile.rotation.z = Math.PI; head.add(smile);
        if (p.accessory === 'glasses') {
            for (const x of [-0.115, 0.115]) { const rim = new T.Mesh(new T.TorusGeometry(0.074, 0.008, 6, 20), materials.get('warm_metal')); rim.position.set(x, 0.015, 0.307); head.add(rim); }
            S.rounded(head, [0.07, 0.012, 0.012], [0, 0.015, 0.308], materials.get('warm_metal'), 0.004);
        }
        if (p.accessory === 'bow') for (const x of [-0.06, 0.06]) { const bow = S.sphere(head, [0.07, 0.05, 0.04], [0.22 + x, 0.25, 0.18], materials.get('rose')); bow.rotation.z = x < 0 ? -0.4 : 0.4; }
        const arms = [], legs = [];
        for (const side of [-1, 1]) {
            const arm = new T.Group(); arm.position.set(side * 0.245, 0.78, 0); body.add(arm);
            S.rounded(arm, [0.145, 0.22, 0.15], [0, -0.08, 0], shirt, 0.06);
            S.sphere(arm, [0.07, 0.11, 0.075], [0, -0.235, 0], skin); arms.push(arm);
            const leg = new T.Group(); leg.position.set(side * 0.105, 0.4, 0); body.add(leg);
            S.rounded(leg, [0.15, 0.27, 0.17], [0, -0.14, 0], pants, 0.06);
            S.rounded(leg, [0.17, 0.11, 0.25], [0, -0.325, 0.04], shoe, 0.055); legs.push(leg);
        }
        const phone = S.rounded(arms[1], [0.13, 0.22, 0.025], [0, -0.28, 0.035], materials.get('milky_plastic', '#b9bfa9'), 0.018);
        S.rounded(phone, [0.102, 0.165, 0.008], [0, 0, 0.018], materials.get('screen'), 0.008); phone.visible = false;
        const book = S.rounded(body, [0.32, 0.22, 0.06], [0, 0.52, 0.25], materials.get('rose'), 0.015); book.rotation.x = -0.8; book.visible = false;
        const cup = S.sphere(body, [0.09, 0.105, 0.09], [0.17, 0.78, 0.25], materials.get('pastel_ceramic')); cup.visible = false;
        root.userData.actor = who;
        return { who, root, body, torso, head, arms, legs, eyes: eyeMeshes, phone, book, cup, action: 'Idle', path: [], destination: null, anchor: null, startedAt: 0 };
    }
    async function createPortrait(portrait, who) {
        const T = ByndHomeEngine, root = new T.Group(), body = new T.Group(); root.add(body);
        const valid = portrait?.transparent && /^data:image\/png;base64,/.test(portrait.url || '') && portrait.url.length <= 950000 && Number.isFinite(portrait.width) && portrait.width > 0 && Number.isFinite(portrait.height) && portrait.height > 0;
        const image = valid ? portrait : await H.Portraits.initial(who);
        const texture = await new T.TextureLoader().loadAsync(image.url); texture.colorSpace = T.SRGBColorSpace;
        let sleepTexture = null;
        if (!valid) {
            try {
                const sleeping = await H.Portraits.initial(who, 'sleep');
                sleepTexture = await new T.TextureLoader().loadAsync(sleeping.url); sleepTexture.colorSpace = T.SRGBColorSpace;
            } catch (error) { texture.dispose(); throw error; }
        }
        const material = new T.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.025, depthWrite: false, toneMapped: false });
        const sprite = new T.Sprite(material); sprite.center.set(0.5, 0); sprite.scale.set(1.48 * image.width / image.height, 1.48, 1);
        sprite.userData.ownedTexture = texture; sprite.userData.ownedMaterial = material; body.add(sprite);
        // A Sprite ignores its parent's orientation. Furniture poses instead use
        // world-space planes: upright at a seat, horizontal along a mattress.
        const poseMaterial = new T.MeshBasicMaterial({ map: texture, alphaTest: 0.025, side: T.DoubleSide, toneMapped: false });
        const surface = new T.Mesh(new T.PlaneGeometry(1, 1, 1, 20), poseMaterial); surface.visible = false;
        surface.userData.ownedMaterial = poseMaterial; body.add(surface);
        if (sleepTexture) surface.userData.ownedTexture = sleepTexture;
        const head = new T.Group(); body.add(head);
        const groups = () => [new T.Group(), new T.Group()];
        root.userData.actor = who;
        return { who, root, body, head, arms: groups(), legs: groups(), eyes: [], phone: new T.Group(), book: new T.Group(), cup: new T.Group(), sprite, surface, sleepTexture, spriteMaterial: material, portraitWidth: sprite.scale.x, visual: 'portrait', action: 'Idle', path: [], destination: null, anchor: null, startedAt: 0 };
    }
    function pose(actor, action, anchor) {
        if (actor.visual === 'model3d') { H.CharacterModels.pose(actor, action, anchor); return; }
        actor.action = action; actor.anchor = anchor || null; actor.startedAt = performance.now();
        actor.body.rotation.set(0, 0, 0); actor.body.position.set(0, 0, 0); actor.head.rotation.set(0, 0, 0);
        actor.body.scale.set(1, 1, 1);
        actor.arms.forEach(arm => arm.rotation.set(0, 0, 0)); actor.legs.forEach(leg => leg.rotation.set(0, 0, 0));
        actor.phone.visible = action === 'Use Phone'; actor.book.visible = action === 'Read'; actor.cup.visible = ['Drink', 'Eat'].includes(action);
        if (actor.sprite) {
            const seated = anchor?.seated && !anchor.lying;
            actor.spriteMaterial.map.offset.set(0, 0);
            actor.spriteMaterial.map.repeat.set(1, 1);
            actor.spriteMaterial.rotation = 0;
            actor.surface.material.map = action === 'Sleep' && actor.sleepTexture ? actor.sleepTexture : actor.spriteMaterial.map;
            actor.sprite.visible = !seated && !anchor?.lying;
            actor.surface.visible = !!(seated || anchor?.lying);
            actor.surface.rotation.set(0, 0, 0);
            const vertices = actor.surface.geometry.attributes.position;
            const uv = actor.surface.geometry.attributes.uv;
            for (let i = 0; i < vertices.count; i++) vertices.setXYZ(i, uv.getX(i) - .5, uv.getY(i) - .5, 0);
            vertices.needsUpdate = true;
            if (seated) {
                const width = Math.min(actor.portraitWidth, anchor.poseWidth || actor.portraitWidth);
                actor.seatedHeight = 1.48 * width / actor.portraitWidth;
                actor.surface.scale.set(1, 1, 1); actor.surface.position.set(0, .018, 0);
                actor.seatedWidth = width;
                seatedSurface(actor, 0);
            } else if (anchor?.lying) {
                const ratio = actor.portraitWidth / 1.48, width = Math.min((anchor.poseLength || 1.7) * ratio, anchor.poseWidth || 1), length = width / ratio;
                actor.surface.scale.set(width, length, 1); actor.surface.rotation.x = -Math.PI / 2;
                actor.surface.position.set(0, 0, (anchor.headOffset ?? -length / 2) + length / 2);
                // The head rests on the raised pillow; the torso slopes down under
                // the duvet. Top texture UV always maps toward furniture local -Z.
                const positions = actor.surface.geometry.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const uvY = positions.getY(i) + .5, lift = Math.max(0, Math.min(1, (uvY - .28) / .12));
                    positions.setZ(i, lift * (anchor.headLift || 0));
                }
                positions.needsUpdate = true;
            }
            actor.surface.geometry.computeBoundingSphere();
        }
        if (anchor) {
            actor.root.position.set(anchor.x, anchor.y, anchor.z); actor.root.rotation.y = anchor.rotation || 0;
            if (anchor.seated) actor.legs.forEach(leg => { leg.rotation.x = -Math.PI / 2; });
            if (anchor.lying && !actor.sprite) { actor.body.rotation.x = -Math.PI / 2; actor.body.position.set(0, 0.16, 0); }
        }
        if (['Use Phone', 'Read', 'Game', 'Work', 'Use Computer', 'Drink', 'Eat'].includes(action)) { actor.arms.forEach(arm => { arm.rotation.x = -0.95; }); actor.head.rotation.x = 0.1; }
        if (action === 'Hug') actor.arms.forEach((arm, i) => { arm.rotation.x = -1.1; arm.rotation.z = i ? 0.42 : -0.42; });
        if (['Wave', 'Happy'].includes(action)) { actor.arms[1].rotation.z = -2.25; }
    }
    function seatedSurface(actor, yaw) {
        const positions = actor.surface.geometry.attributes.position, uv = actor.surface.geometry.attributes.uv;
        const height = actor.seatedHeight, front = actor.anchor.seatFront || .14;
        const drop = Math.min(height * .25, Math.max(.12, actor.anchor.y - .09));
        // One UV surface joins torso -> lap -> knees -> shins. Rotating only the
        // torso used to leave a furniture-sized gap between two separate images.
        // Blend the lap into the furniture frame so the feet stay beyond its edge.
        const turn = Math.atan(Math.tan(yaw));
        for (let i = 0; i < positions.count; i++) {
            const v = uv.getY(i), x = (uv.getX(i) - .5) * actor.seatedWidth;
            const bend = Math.max(0, Math.min(1, (v - .25) / .10));
            const angle = turn * bend;
            const y = v >= .35 ? (v - .35) * height : v >= .25 ? 0 : (v / .25 - 1) * drop;
            const z = v >= .35 ? 0 : v >= .25 ? (1 - bend) * front : front;
            positions.setXYZ(i, x * Math.cos(angle), y, z - x * Math.sin(angle));
        }
        positions.needsUpdate = true; actor.surface.geometry.computeBoundingSphere();
    }
    function faceCamera(actor, camera) {
        if (!actor.surface?.visible || actor.anchor?.lying) return;
        const direction = actor.cameraDirection || (actor.cameraDirection = new ByndHomeEngine.Vector3()); camera.getWorldDirection(direction);
        const yaw = Math.atan2(-direction.x, -direction.z) - actor.root.rotation.y;
        seatedSurface(actor, yaw);
    }
    function geometry(actor) {
        if (actor.visual === 'model3d') return H.CharacterModels.geometry(actor);
        if (!actor.surface?.visible) return { kind: 'standing' };
        const T = ByndHomeEngine; actor.root.updateWorldMatrix(true, true);
        const point = (mesh, y, z = 0) => { const p = mesh.localToWorld(new T.Vector3(0, y, z)); return { x: p.x, y: p.y, z: p.z }; };
        const seated = actor.anchor?.seated && !actor.anchor.lying;
        const drop = seated ? Math.min(actor.seatedHeight * .25, Math.max(.12, actor.anchor.y - .09)) : 0;
        return { kind: actor.anchor?.lying ? 'lying' : 'seated', eyesClosed: actor.action === 'Sleep' && !!actor.sleepTexture, head: point(actor.surface, seated ? actor.seatedHeight * .65 : .5, actor.anchor?.lying ? actor.anchor.headLift || 0 : 0), feet: point(actor.surface, seated ? -drop : -.5, seated ? actor.anchor.seatFront || .14 : 0), depthTest: actor.surface.material.depthTest, width: seated ? actor.seatedWidth : actor.surface.scale.x, length: seated ? actor.seatedHeight : actor.surface.scale.y };
    }
    H.Characters = { create, createPortrait, pose, faceCamera, geometry, defaultProfile, validateProfile };
})(window.ByndHome3D);
