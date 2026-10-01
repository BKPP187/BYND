(function (H) {
    'use strict';
    function create(host, options) {
        const T = ByndHomeEngine, materials = H.Materials.create(options.theme), scene = new T.Scene(), theme = materials.theme;
        scene.background = new T.Color(theme.background);
        const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = theme.exposure * 0.86;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.domElement.setAttribute('aria-label', '两个人的3D小屋，可拖动旋转，点击家具互动'); renderer.domElement.tabIndex = 0;
        host.appendChild(renderer.domElement);
        const camera = new T.OrthographicCamera(-6, 6, 6, -6, 0.1, 70);
        let yaw = 0.68, pitch = 0.62, zoom = 1, disposed = false, roomGroup = null, room = null, generation = 0, actors = [], furniture = [], raf = 0, lastTime = 0, lastPaint = 0;
        let pointer = null;
        let buildMode = false, draft = null, preview = null, marker = null, draftToken = 0;
        const groundMaterial = new T.MeshBasicMaterial({ color: theme.background });
        groundMaterial.toneMapped = false;
        const ground = new T.Mesh(new T.PlaneGeometry(100, 100), groundMaterial); ground.userData.ownedMaterial = groundMaterial; ground.rotation.x = -Math.PI / 2; ground.position.y = -0.435; scene.add(ground);
        scene.add(new T.HemisphereLight(options.theme === 'night' ? '#b6c6e3' : '#fff8eb', '#c6b7a7', options.theme === 'night' ? .65 : 1.65));
        const sun = new T.DirectionalLight(options.theme === 'night' ? '#c5d6ef' : theme.light, options.theme === 'night' ? .8 : 2.3); sun.position.set(-3, 8, 6); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -6; sun.shadow.camera.right = 6; sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6; sun.shadow.normalBias = 0.035; sun.shadow.bias = -0.0002; sun.shadow.radius = 3; scene.add(sun);
        const fill = new T.DirectionalLight('#f4ded6', options.theme === 'night' ? .35 : .65); fill.position.set(6, 4, -2); scene.add(fill);
        function resize() {
            if (disposed) return;
            const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight), aspect = width / height;
            // Fit the miniature across narrow phones as well as landscape viewports.
            const halfW = 4.85 / zoom, halfH = Math.max(3.7, halfW / aspect);
            camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
            if (aspect > 1.4) { camera.top = 4 / zoom; camera.bottom = -4 / zoom; camera.left = -4 * aspect / zoom; camera.right = 4 * aspect / zoom; }
            camera.updateProjectionMatrix(); renderer.setSize(width, height, false); positionCamera();
        }
        function positionCamera() { camera.position.set(Math.sin(yaw) * Math.cos(pitch) * 16, Math.sin(pitch) * 16 + 0.6, Math.cos(yaw) * Math.cos(pitch) * 16); camera.lookAt(0, 0.8, 0); }
        const observer = new ResizeObserver(resize); observer.observe(host);
        const ray = new T.Raycaster(), mouse = new T.Vector2();
        function pick(event) {
            const rect = renderer.domElement.getBoundingClientRect(); mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(mouse, camera);
            return ray.intersectObjects(roomGroup?.children || [], true);
        }
        function down(event) {
            if (event.isPrimary === false) return;
            pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragged: false };
            renderer.domElement.setPointerCapture(event.pointerId);
            if (buildMode && !draft) for (const hit of pick(event)) {
                let node = hit.object; while (node && !node.userData.furniture) node = node.parent;
                if (node?.userData.furniture && !String(node.userData.furniture).startsWith('memory-')) { options.onSelect(node.userData.furniture); break; }
            }
            if (buildMode && draft) moveDraft(event.clientX, event.clientY);
        }
        function move(event) {
            if (!pointer || pointer.id !== event.pointerId) return;
            if (buildMode && draft) { moveDraft(event.clientX, event.clientY); pointer.dragged = true; return; }
            if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 7) pointer.dragged = true;
            if (pointer.dragged) { yaw = Math.max(-0.18, Math.min(1.48, yaw - (event.clientX - pointer.x) * 0.007)); pitch = Math.max(0.38, Math.min(0.98, pitch + (event.clientY - pointer.y) * 0.003)); positionCamera(); }
            pointer.x = event.clientX; pointer.y = event.clientY;
        }
        function up(event) {
            const current = pointer; pointer = null; if (!current || current.dragged || disposed) return;
            if (buildMode) { if (draft) moveDraft(event.clientX, event.clientY); return; }
            const rect = renderer.domElement.getBoundingClientRect(); mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(mouse, camera);
            for (const hit of ray.intersectObjects(roomGroup?.children || [], true)) {
                let node = hit.object; while (node && !node.userData.furniture && !node.userData.actor && !node.userData.floor) node = node.parent;
                if (node?.userData.furniture) { options.onSelect(node.userData.furniture); return; }
                if (node?.userData.actor) { options.onActor(node.userData.actor); return; }
                if (node?.userData.floor) { walkUser({ x: hit.point.x, y: 0, z: hit.point.z, action: 'Idle' }); return; }
            }
        }
        const cancel = () => { pointer = null; };
        const wheel = event => { event.preventDefault(); zoom = Math.max(0.8, Math.min(1.6, zoom - event.deltaY * 0.001)); resize(); };
        renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', cancel); renderer.domElement.addEventListener('wheel', wheel, { passive: false });
        const key = event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); yaw = Math.max(-0.18, Math.min(1.48, yaw + (event.key === 'ArrowLeft' ? -0.1 : 0.1))); positionCamera(); } };
        renderer.domElement.addEventListener('keydown', key);
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        function tick(time) {
            if (disposed) return; raf = requestAnimationFrame(tick);
            if (document.hidden || !host.isConnected || !host.clientHeight) { lastTime = time; return; }
            if (time - lastPaint < 1000 / 30) return;
            const dt = Math.min((time - (lastTime || time)) / 1000, 0.08); lastTime = time; lastPaint = time;
            actors.forEach(actor => { if (!buildMode) H.Animation.tick(actor, time, dt, reduced); H.Characters.faceCamera(actor, camera); }); renderer.render(scene, camera);
        }
        resize(); raf = requestAnimationFrame(tick);
        function obstacles() {
            return furniture.filter(row => row.placement.position[1] < 0.2 && !['frame', 'prop', 'keepsake'].includes(row.item.type)).map(row => ({ x: row.placement.position[0], z: row.placement.position[2], width: Math.abs(Math.cos(row.placement.rotation)) * row.item.footprint[0] + Math.abs(Math.sin(row.placement.rotation)) * row.item.footprint[1], depth: Math.abs(Math.cos(row.placement.rotation)) * row.item.footprint[1] + Math.abs(Math.sin(row.placement.rotation)) * row.item.footprint[0] }));
        }
        async function load(roomId, home, userProfile, activity) {
            const token = ++generation; room = H.Rooms.get(roomId);
            if (!H.Rooms.available(room, home)) throw new Error('这个房间还在准备中。');
            clearDraft();
            H.Shapes.disposeGeometry(roomGroup); roomGroup = new T.Group(); scene.add(roomGroup); actors = []; furniture = [];
            const targetGroup = roomGroup, shell = H.Rooms.shell(room, materials); shell.userData.floor = true; targetGroup.add(shell);
            const placements = H.Rooms.placements(room, home);
            // Only three GLBs decode concurrently; the previous room's geometry is released first.
            let cursor = 0; const failures = [];
            const worker = async () => {
                while (cursor < placements.length && !disposed && token === generation) {
                    const placement = placements[cursor++], item = H.Furniture.get(placement.furnitureId);
                    if (!item) { failures.push(placement.furnitureId); continue; }
                    try {
                        const model = await H.Furniture.load(item, materials);
                        if (disposed || token !== generation) { H.Shapes.disposeGeometry(model); continue; }
                        model.position.set(...placement.position); model.rotation.y = placement.rotation; model.userData.furniture = placement.id;
                        targetGroup.add(model); furniture.push({ placement, item, model });
                        if (item.type === 'frame' && home.photo?.url) H.Furniture.setPhoto(model, home.photo.url, () => !disposed && token === generation).catch(() => options.onNotice('相框照片暂时加载失败，可重新选择照片。'));
                    } catch (error) { failures.push(item.name); console.warn('小屋家具加载失败', item.id, error.message); }
                }
            };
            await Promise.all([worker(), worker(), worker()]);
            if (disposed || token !== generation) return false;
            // Only two furniture lights per room; decorations and materials can
            // glow without adding an unbounded number of dynamic lights on phones.
            for (const row of furniture.filter(row => row.item.type === 'lamp').slice(0, 2)) {
                const height = row.model.userData.lampHeight ?? new T.Box3().setFromObject(row.model).getSize(new T.Vector3()).y * .82;
                const light = new T.PointLight('#ffd4a1', options.theme === 'night' ? 3.6 : 1.0, 3.8, 2);
                light.position.set(row.placement.position[0], row.placement.position[1] + height, row.placement.position[2]); targetGroup.add(light);
            }
            for (const [who, profile] of [['user', userProfile], ['char', home.charAvatar]]) {
                const portrait = who === 'user' ? H.State.load().user.portrait : home.portrait;
                const actor = await H.Characters.createPortrait(portrait, who);
                if (disposed || token !== generation) { H.Shapes.disposeGeometry(actor.root); return false; }
                actor.root.position.set(who === 'user' ? 1.25 : -0.8, 0.07, 1.6); targetGroup.add(actor.root);
                if (materials.night) for (const material of [actor.spriteMaterial, actor.surface.material]) material.color.set('#dcd3d4');
                if (who === 'char' && activity.room !== roomId) actor.root.visible = false;
                actors.push(actor);
            }
            setCharActivity(activity, true);
            const count = Math.min(home.keepsakes.length, 6);
            for (let i = 0; i < count; i++) {
                const star = await H.Furniture.load(H.Furniture.get('memory_01'), materials);
                if (disposed || token !== generation) { H.Shapes.disposeGeometry(star); return false; }
                star.position.set(-1.08 + i * 0.36, 0.15, 2.25); star.userData.furniture = 'memory-' + i; targetGroup.add(star);
            }
            if (failures.length) throw new Error('部分家具没能加载：' + failures.join('、') + '。可以重试进入。');
            return true;
        }
        function setCharActivity(activity, immediate = false) {
            const actor = actors.find(a => a.who === 'char'); if (!actor) return;
            actor.root.visible = activity.room === room?.id;
            if (!actor.root.visible) return;
            if (activity.action === 'Walk' || activity.action === 'Idle') {
                standUp(actor); actor.path = []; actor.destination = null;
                if (activity.action === 'Idle') { H.Characters.pose(actor, 'Idle'); return; }
                const seed = activity.wanderSeed || 0;
                for (let i = 0; i < 16; i++) {
                    const angle = (seed + i) * 2.4, end = { x: Math.cos(angle) * 1.9, z: .5 + Math.sin(angle) * 1.35, action: 'Idle' };
                    if (!obstacles().some(o => Math.abs(end.x - o.x) < o.width / 2 + .2 && Math.abs(end.z - o.z) < o.depth / 2 + .2) && H.Animation.walk(actor, end, obstacles(), room.size)) return;
                }
                H.Characters.pose(actor, 'Idle'); return;
            }
            const target = furniture.find(row => row.placement.id === activity.target);
            if (!target) { H.Characters.pose(actor, 'Idle'); return; }
            if (occupied(target, activity.action, actors.find(a => a.who === 'user'))) { standUp(actor); actor.path = []; actor.destination = null; H.Characters.pose(actor, 'Idle'); options.onNotice('这个位置你正在用，Ta在旁边等一会儿。'); return; }
            const anchor = H.Rooms.anchor(target.placement, activity.action);
            if (immediate) H.Characters.pose(actor, activity.action, anchor);
            else if (!goTo(actor, target, activity.action, anchor)) { H.Characters.pose(actor, 'Idle'); options.onNotice('Ta想用' + target.item.name + '，但前面的路被挡住了。可以在装修里挪一挪。'); }
        }
        function goTo(actor, row, action, anchor, finish) {
            actor.path = []; actor.destination = null;
            // Approach from the front, then settle into the declared usable position.
            // First stand up in front of the occupied furniture, so pathfinding starts on the floor.
            standUp(actor);
            const approach = H.Animation.approach(actor.root.position, row.placement, obstacles(), room.size);
            if (!approach) return false;
            const end = { ...approach, action, anchor };
            return H.Animation.walk(actor, end, obstacles(), room.size, finish);
        }
        function standUp(actor) {
            if (actor.anchor) {
                const old = furniture.find(item => {
                    const p = H.Rooms.anchor(item.placement, actor.action, actor.who); return Math.hypot(p.x - actor.root.position.x, p.z - actor.root.position.z) < 0.4;
                });
                if (old) { const p = H.Animation.approach({ x: room.size[0] / 2 - .4, z: room.size[1] / 2 - .4 }, old.placement, obstacles(), room.size); if (p) actor.root.position.set(p.x, .07, p.z); }
            }
            actor.root.position.y = 0.07;
        }
        function walkUser(point) {
            const actor = actors.find(a => a.who === 'user'); if (!actor) return false;
            if (Math.abs(point.x) > room.size[0] / 2 - 0.25 || Math.abs(point.z) > room.size[1] / 2 - 0.25) return false;
            if (obstacles().some(o => Math.abs(point.x - o.x) < o.width / 2 + 0.18 && Math.abs(point.z - o.z) < o.depth / 2 + 0.18)) { options.onNotice('这里放着家具，点旁边的空地走过去吧。'); return false; }
            standUp(actor); actor.path = []; return H.Animation.walk(actor, point, obstacles(), room.size);
        }
        function interact(id, action, finish) {
            const row = furniture.find(f => f.placement.id === id), user = actors.find(a => a.who === 'user');
            if (!row || !user || !row.item.actions.includes(action)) return false;
            const home = H.State.home(), char = actors.find(a => a.who === 'char');
            if (occupied(row, action, char)) throw new Error('这个位置Ta正在用，可以先去旁边陪着。');
            if (action === 'Hug' && (!home.consentHug || !char?.root.visible || char.action === 'Sleep')) throw new Error('先等对方醒来，或在小屋设置中允许拥抱。');
            const anchor = H.Rooms.anchor(row.placement, action, 'user');
            if (action === 'Hug') {
                const charAnchor = H.Rooms.anchor(row.placement, 'Hug', 'char');
                const done = () => {
                    char.path = []; char.destination = null; H.Characters.pose(char, 'Hug', charAnchor);
                    // Portrait feet stay in the furniture frame. Rotating the
                    // whole anchor would swing them back through the seat.
                    if (char.visual !== 'portrait') char.root.rotation.y += Math.PI / 2;
                    if (user.visual !== 'portrait') user.root.rotation.y -= Math.PI / 2;
                    finish?.();
                };
                return goTo(user, row, action, anchor, done);
            }
            return goTo(user, row, action, anchor, finish);
        }
        function occupied(row, action, actor) {
            const anchor = actor?.destination?.anchor || actor?.anchor;
            if (!actor?.root.visible || anchor?.placementId !== row.placement.id || action === 'Hug') return false;
            // A couch can host two seated people, but lying down uses its full
            // width. Reserve destinations as well as completed poses.
            return row.item.positions.length === 1 || (row.item.type === 'sofa' && (anchor.lying || ['Lie', 'Sleep'].includes(action)));
        }
        function emote(action) {
            const user = actors.find(a => a.who === 'user'); if (!user) return;
            user.path = []; H.Characters.pose(user, action, user.anchor);
            const char = actors.find(a => a.who === 'char');
            if (char?.root.visible && char.action !== 'Sleep') { char.head.rotation.y = 0.3; }
        }
        function resetCamera() { yaw = 0.68; pitch = 0.62; zoom = 1; resize(); }
        function clearDraft() {
            draftToken++; H.Shapes.disposeGeometry(preview); H.Shapes.disposeGeometry(marker); preview = null; marker = null; draft = null;
            furniture.forEach(row => { row.model.visible = true; });
        }
        function refreshDraft() {
            if (!draft) return;
            preview?.position.set(...draft.position); if (preview) preview.rotation.y = draft.rotation;
            const e = H.Build.extent(draft);
            if (marker) { marker.position.set(e.x, .1, e.z); marker.scale.set(e.width + .08, e.depth + .08, 1); }
            let error = ''; try { H.Build.validate(room, H.State.home(), draft); } catch (failure) { error = failure.message; }
            if (marker) marker.material = materials.get('milky_plastic', error ? '#df8f9c' : '#b2d8b1');
            options.onDraft?.({ ...draft, valid: !error, error });
        }
        async function beginDraft(placement) {
            clearDraft(); const token = draftToken, item = H.Furniture.get(placement.furnitureId);
            if (!buildMode || !item) return false;
            draft = { ...placement, position: [...placement.position], rotation: placement.rotation || 0 };
            const original = furniture.find(row => row.placement.id === draft.id);
            if (original) { original.model.visible = false; const children = H.Build.supported(room, H.State.home(), original.placement); for (const row of furniture) if (children.some(p => p.id === row.placement.id)) row.model.visible = false; }
            let model;
            try { model = await H.Furniture.load(item, materials); }
            catch (error) { if (token === draftToken) { clearDraft(); options.onDraft?.(null); } throw error; }
            if (disposed || token !== draftToken || !buildMode) { H.Shapes.disposeGeometry(model); return false; }
            preview = model; preview.userData.furniture = draft.id; roomGroup.add(preview);
            marker = new T.Mesh(new T.PlaneGeometry(1, 1), materials.get('milky_plastic', '#b2d8b1')); marker.rotation.x = -Math.PI / 2; roomGroup.add(marker); refreshDraft(); return true;
        }
        function moveDraft(x, y) {
            if (!draft || disposed) return;
            const rect = renderer.domElement.getBoundingClientRect(); if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
            mouse.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1); ray.setFromCamera(mouse, camera);
            const point = ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -draft.position[1]), new T.Vector3());
            if (!point) return;
            draft.position[0] = Math.round(point.x / .1) * .1; draft.position[2] = Math.round(point.z / .1) * .1; refreshDraft();
        }
        function nudgeDraft(dx, dz) { if (draft) { draft.position[0] = Math.round((draft.position[0] + dx) * 10) / 10; draft.position[2] = Math.round((draft.position[2] + dz) * 10) / 10; refreshDraft(); } }
        function rotateDraft() { if (draft) { draft.rotation = (draft.rotation + Math.PI / 2) % (Math.PI * 2); refreshDraft(); } }
        function setBuild(value) { clearDraft(); buildMode = !!value; renderer.domElement.setAttribute('aria-label', buildMode ? '装修房间，拖动家具移动，使用底部按钮旋转和确认' : '两个人的3D小屋，可拖动旋转，点击家具互动'); }
        function dispose() {
            if (disposed) return; disposed = true; generation++; cancelAnimationFrame(raf); observer.disconnect();
            clearDraft();
            H.Shapes.disposeGeometry(roomGroup); H.Shapes.disposeGeometry(ground); materials.dispose(); sun.shadow.dispose();
            renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); actors = []; furniture = [];
        }
        const contextLost = event => { if (disposed) return; event.preventDefault(); options.onNotice('3D 显示暂时中断，点重试重新进入小屋。'); H.UI?.showSceneError('设备暂时释放了3D画面，请重试。'); };
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        return { load, dispose, interact, emote, resetCamera, setCharActivity, setBuild, beginDraft, moveDraft, nudgeDraft, rotateDraft, clearDraft, draft: () => draft ? JSON.parse(JSON.stringify(draft)) : null, project: (x, z) => { const p = new T.Vector3(x, 0, z).project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 }; }, furniture: () => furniture, zoom: delta => { zoom = Math.max(0.8, Math.min(1.6, zoom + delta)); resize(); }, stats: () => ({ ...renderer.info.memory, calls: renderer.info.render.calls, buildMode, actors: actors.map(a => ({ who: a.who, action: a.action, visible: a.root.visible, visual: a.visual, position: { x: a.root.position.x, y: a.root.position.y, z: a.root.position.z }, pose: H.Characters.geometry(a), path: a.path.length })), room: room?.id }) };
    }
    H.Scene = { create };
})(window.ByndHome3D);
