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
        const ground = new T.Mesh(new T.PlaneGeometry(100, 100), materials.get('milky_plastic', theme.background)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.435; ground.receiveShadow = true; scene.add(ground);
        scene.add(new T.HemisphereLight('#fff5dc', '#c1ac96', options.theme === 'night' ? 0.8 : 1.4));
        const sun = new T.DirectionalLight(theme.light, options.theme === 'night' ? 1.8 : 2.6); sun.position.set(-3, 8, 6); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -6; sun.shadow.camera.right = 6; sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6; sun.shadow.normalBias = 0.035; sun.shadow.bias = -0.0002; sun.shadow.radius = 3; scene.add(sun);
        const fill = new T.DirectionalLight('#f4d6c5', 0.9); fill.position.set(6, 4, -2); scene.add(fill);
        const lamp = new T.PointLight('#ffcc85', options.theme === 'night' ? 8 : 1.3, 8, 2); lamp.position.set(1.7, 2, -1.8); scene.add(lamp);
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
        function down(event) { if (event.isPrimary === false) return; pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragged: false }; renderer.domElement.setPointerCapture(event.pointerId); }
        function move(event) {
            if (!pointer || pointer.id !== event.pointerId) return;
            if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 7) pointer.dragged = true;
            if (pointer.dragged) { yaw = Math.max(-0.18, Math.min(1.48, yaw - (event.clientX - pointer.x) * 0.007)); pitch = Math.max(0.38, Math.min(0.98, pitch + (event.clientY - pointer.y) * 0.003)); positionCamera(); }
            pointer.x = event.clientX; pointer.y = event.clientY;
        }
        function up(event) {
            const current = pointer; pointer = null; if (!current || current.dragged || disposed) return;
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
            actors.forEach(actor => H.Animation.tick(actor, time, dt, reduced)); renderer.render(scene, camera);
        }
        resize(); raf = requestAnimationFrame(tick);
        function obstacles() {
            return furniture.filter(row => row.placement.position[1] < 0.2 && !['frame', 'prop', 'keepsake'].includes(row.item.type)).map(row => ({ x: row.placement.position[0], z: row.placement.position[2], width: Math.abs(Math.cos(row.placement.rotation)) * row.item.footprint[0] + Math.abs(Math.sin(row.placement.rotation)) * row.item.footprint[1], depth: Math.abs(Math.cos(row.placement.rotation)) * row.item.footprint[1] + Math.abs(Math.sin(row.placement.rotation)) * row.item.footprint[0] }));
        }
        async function load(roomId, home, userProfile, activity) {
            const token = ++generation; room = H.Rooms.get(roomId);
            if (!room?.open) throw new Error('这个房间还在准备中。');
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
            for (const [who, profile] of [['user', userProfile], ['char', home.charAvatar]]) {
                const portrait = who === 'user' ? H.State.load().user.portrait : home.portrait;
                const actor = await H.Characters.createPortrait(portrait, who);
                if (disposed || token !== generation) { H.Shapes.disposeGeometry(actor.root); return false; }
                actor.root.position.set(who === 'user' ? 1.25 : -0.8, 0.07, 1.6); targetGroup.add(actor.root);
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
            const target = furniture.find(row => row.placement.id === activity.target);
            if (!target) { H.Characters.pose(actor, 'Idle'); return; }
            const anchor = H.Rooms.anchor(target.placement, activity.action);
            if (immediate) H.Characters.pose(actor, activity.action, anchor);
            else goTo(actor, target, activity.action, anchor);
        }
        function goTo(actor, row, action, anchor, finish) {
            actor.path = []; actor.destination = null;
            // Approach from the front, then settle into the declared usable position.
            const r = row.placement.rotation || 0, reach = row.item.footprint[1] / 2 + 0.45;
            const end = { x: row.placement.position[0] + Math.sin(r) * reach, z: row.placement.position[2] + Math.cos(r) * reach, action, anchor };
            // First stand up in front of the occupied furniture, so pathfinding starts on the floor.
            standUp(actor);
            return H.Animation.walk(actor, end, obstacles(), room.size, finish);
        }
        function standUp(actor) {
            if (actor.anchor) {
                const old = furniture.find(item => {
                    const p = H.Rooms.anchor(item.placement, actor.action, actor.who); return Math.hypot(p.x - actor.root.position.x, p.z - actor.root.position.z) < 0.4;
                });
                if (old) { const r0 = old.placement.rotation || 0, depth = old.item.footprint[1] / 2 + 0.5; actor.root.position.set(old.placement.position[0] + Math.sin(r0) * depth, 0.07, old.placement.position[2] + Math.cos(r0) * depth); }
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
            if (row.item.positions.length === 1 && char?.root.visible && char.anchor) {
                const position = H.Rooms.anchor(row.placement, char.action);
                if (Math.hypot(position.x - char.root.position.x, position.z - char.root.position.z) < 0.3) throw new Error('这个位置Ta正在用，可以先去旁边陪着。');
            }
            if (action === 'Hug' && (!home.consentHug || !char?.root.visible || char.action === 'Sleep')) throw new Error('先等对方醒来，或在小屋设置中允许拥抱。');
            const anchor = H.Rooms.anchor(row.placement, action, 'user');
            if (action === 'Hug') {
                const charAnchor = H.Rooms.anchor(row.placement, 'Hug', 'char');
                const done = () => { char.path = []; H.Characters.pose(char, 'Hug', charAnchor); char.root.rotation.y += Math.PI / 2; user.root.rotation.y -= Math.PI / 2; finish?.(); };
                return goTo(user, row, action, anchor, done);
            }
            return goTo(user, row, action, anchor, finish);
        }
        function emote(action) {
            const user = actors.find(a => a.who === 'user'); if (!user) return;
            user.path = []; H.Characters.pose(user, action, user.anchor);
            const char = actors.find(a => a.who === 'char');
            if (char?.root.visible && char.action !== 'Sleep') { char.head.rotation.y = 0.3; }
        }
        function resetCamera() { yaw = 0.68; pitch = 0.62; zoom = 1; resize(); }
        function dispose() {
            if (disposed) return; disposed = true; generation++; cancelAnimationFrame(raf); observer.disconnect();
            H.Shapes.disposeGeometry(roomGroup); H.Shapes.disposeGeometry(ground); materials.dispose(); sun.shadow.dispose();
            renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); actors = []; furniture = [];
        }
        const contextLost = event => { if (disposed) return; event.preventDefault(); options.onNotice('3D 显示暂时中断，点重试重新进入小屋。'); H.UI?.showSceneError('设备暂时释放了3D画面，请重试。'); };
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        return { load, dispose, interact, emote, resetCamera, setCharActivity, furniture: () => furniture, zoom: delta => { zoom = Math.max(0.8, Math.min(1.6, zoom + delta)); resize(); }, stats: () => ({ ...renderer.info.memory, calls: renderer.info.render.calls, actors: actors.map(a => ({ who: a.who, action: a.action, visible: a.root.visible, visual: a.visual })), room: room?.id }) };
    }
    H.Scene = { create };
})(window.ByndHome3D);
