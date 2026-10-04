(function (H) {
    'use strict';
    function create(host, options) {
        const T = ByndHomeEngine, materials = H.Materials.create(options.theme), scene = new T.Scene(), theme = materials.theme;
        scene.background = new T.Color(theme.background);
        const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
        const quality = H.RenderQuality.controller(H.RenderQuality.preference(), H.RenderQuality.detect(renderer)), assetQuality = H.RenderAssets.create(T, renderer), gpuTimer = H.RenderQuality.gpuTimer(renderer.getContext());
        let profile = quality.current(), lastShadow = 0, lastAssets = 0, lampLights = [], contextUnavailable = false;
        const gl = renderer.getContext(), viewportLimits = gl.getParameter(gl.MAX_VIEWPORT_DIMS), bufferLimit = Math.min(renderer.capabilities.maxTextureSize, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), viewportLimits[0], viewportLimits[1]);
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = theme.exposure * 0.86;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.domElement.setAttribute('aria-label', '实时3D小屋，拖动探索，双指缩放，点击家具互动'); renderer.domElement.tabIndex = 0;
        host.appendChild(renderer.domElement);
        const camera = new T.OrthographicCamera(-6, 6, 6, -6, 0.1, 70);
        const view = H.RoomCamera.create(camera, T);
        let disposed = false, roomGroup = null, room = null, generation = 0, actors = [], furniture = [], raf = 0, lastTime = 0, lastPaint = 0, nextPaint = 0;
        const pointers = new Map(); let pinchDistance = null;
        let buildMode = false, draft = null, preview = null, marker = null, draftToken = 0;
        const groundMaterial = new T.MeshBasicMaterial({ color: theme.background });
        groundMaterial.toneMapped = false;
        const ground = new T.Mesh(new T.PlaneGeometry(100, 100), groundMaterial); ground.userData.ownedMaterial = groundMaterial; ground.rotation.x = -Math.PI / 2; ground.position.y = -0.435; scene.add(ground);
        scene.add(new T.HemisphereLight(options.theme === 'night' ? '#b6c6e3' : '#fff8eb', '#c6b7a7', options.theme === 'night' ? .65 : 1.65));
        const sun = new T.DirectionalLight(options.theme === 'night' ? '#c5d6ef' : theme.light, options.theme === 'night' ? .8 : 2.3); sun.position.set(-3, 8, 6); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -6; sun.shadow.camera.right = 6; sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6; sun.shadow.normalBias = 0.035; sun.shadow.bias = -0.0002; sun.shadow.radius = 3; scene.add(sun);
        const fill = new T.DirectionalLight('#f4ded6', options.theme === 'night' ? .35 : .65); fill.position.set(6, 4, -2); scene.add(fill);
        const dustPositions = new Float32Array(12 * 3), dustGeometry = new T.BufferGeometry();
        for (let i = 0; i < 12; i++) { dustPositions[i * 3] = Math.sin(i * 2.4) * 2.4; dustPositions[i * 3 + 1] = .5 + (i % 5) * .37; dustPositions[i * 3 + 2] = Math.cos(i * 2.4) * 2; }
        dustGeometry.setAttribute('position', new T.BufferAttribute(dustPositions, 3));
        const dust = new T.Points(dustGeometry, new T.PointsMaterial({ color: '#fff3d3', size: .025, transparent: true, opacity: .3, depthWrite: false })); scene.add(dust);
        function applyQuality() {
            profile = quality.current();
            if (sun.shadow.mapSize.x !== profile.shadowSize) { sun.shadow.map?.dispose(); sun.shadow.map = null; sun.shadow.mapSize.set(profile.shadowSize, profile.shadowSize); }
            renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
            fill.visible = profile.tier !== 'smooth'; lampLights.forEach((light, index) => { light.visible = index < profile.lights; });
            dust.visible = !reduced && profile.particles > 0; dustGeometry.setDrawRange(0, profile.particles);
            assetQuality.apply(scene, profile); resize(); options.onQuality?.(profile);
        }
        function resize() {
            if (disposed) return;
            const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
            const ratio = H.RenderQuality.ratio(profile, width, height, window.devicePixelRatio || 1, profile.renderScale, bufferLimit);
            if (Math.abs(renderer.getPixelRatio() - ratio) > .001) renderer.setPixelRatio(ratio);
            renderer.setSize(width, height, false); view.resize(width, height);
        }
        const observer = new ResizeObserver(resize); observer.observe(host);
        const ray = new T.Raycaster(), mouse = new T.Vector2();
        function pick(event) {
            const rect = renderer.domElement.getBoundingClientRect(); mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(mouse, camera);
            return ray.intersectObjects(roomGroup?.children || [], true);
        }
        function down(event) {
            const pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragged: false, rotate: event.altKey || event.button === 2 };
            pointers.set(event.pointerId, pointer);
            renderer.domElement.setPointerCapture(event.pointerId);
            if (pointers.size > 1) { pointers.forEach(p => { p.dragged = true; }); pinchDistance = null; return; }
            if (buildMode && !draft) for (const hit of pick(event)) {
                let node = hit.object; while (node && !node.userData.furniture) node = node.parent;
                if (node?.userData.furniture && !String(node.userData.furniture).startsWith('memory-')) { options.onSelect(node.userData.furniture); break; }
            }
            if (buildMode && draft) moveDraft(event.clientX, event.clientY);
        }
        function move(event) {
            const pointer = pointers.get(event.pointerId); if (!pointer) return;
            const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y; pointer.x = event.clientX; pointer.y = event.clientY;
            if (pointers.size > 1) {
                const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinchDistance && distance > 0) view.zoom(distance / pinchDistance);
                pinchDistance = distance; return;
            }
            if (buildMode && draft) { moveDraft(event.clientX, event.clientY); pointer.dragged = true; return; }
            if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 7) pointer.dragged = true;
            if (pointer.dragged) { if (pointer.rotate) view.rotate(dx, dy); else view.pan(dx, dy); }
        }
        function up(event) {
            const current = pointers.get(event.pointerId); pointers.delete(event.pointerId); pinchDistance = null;
            if (!current || current.dragged || disposed) return;
            if (buildMode) { if (draft) moveDraft(event.clientX, event.clientY); return; }
            const rect = renderer.domElement.getBoundingClientRect(); mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(mouse, camera);
            for (const hit of ray.intersectObjects(roomGroup?.children || [], true)) {
                let node = hit.object; while (node && !node.userData.furniture && !node.userData.actor && !node.userData.floor) node = node.parent;
                if (node?.userData.furniture) { options.onSelect(node.userData.furniture); return; }
                if (node?.userData.actor) { options.onActor(node.userData.actor); return; }
                if (node?.userData.floor) { walkUser({ x: hit.point.x, y: 0, z: hit.point.z, action: 'Idle' }); return; }
            }
        }
        const cancel = event => { if (event?.pointerId !== undefined) pointers.delete(event.pointerId); else pointers.clear(); pinchDistance = null; };
        const wheel = event => { event.preventDefault(); view.zoom(Math.exp(-event.deltaY * .0015)); };
        renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', cancel); renderer.domElement.addEventListener('wheel', wheel, { passive: false });
        const key = event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); if (event.altKey) view.rotate(event.key === 'ArrowLeft' ? 16 : -16, 0); else view.pan(event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0, event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0); } };
        renderer.domElement.addEventListener('keydown', key);
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        function tick(time) {
            if (disposed) return; raf = requestAnimationFrame(tick);
            if (document.hidden || !host.isConnected || !host.clientHeight || contextUnavailable) { lastTime = time; lastPaint = 0; nextPaint = 0; quality.reset(); return; }
            const interval = 1000 / profile.fps; if (time + .5 < nextPaint) return;
            nextPaint = Math.max(time, nextPaint + interval);
            const frameStart = performance.now(), paintInterval = lastPaint ? time - lastPaint : interval;
            const dt = Math.min((time - (lastTime || time)) / 1000, 0.08); lastTime = time; lastPaint = time;
            view.step(Math.min(paintInterval / 1000, .25), !!reduced); assetQuality.lod(camera, host.clientHeight, profile);
            actors.forEach(actor => { if (!buildMode) H.Animation.tick(actor, time, dt, reduced); H.Characters.faceCamera(actor, camera); if (actor.visual === 'model3d') H.CharacterModels.update(actor, camera, host.clientHeight, profile, options.onNotice); });
            H.SleepPair.update(furniture, actors, H.State.home().consentHug !== false);
            H.Bedding.update(furniture, actors);
            H.Cooking.update(furniture, actors, time, profile, reduced || buildMode);
            if (time - lastAssets > 1500 || actors.some(a => a.needsAssetQuality)) { assetQuality.apply(scene, profile); actors.forEach(a => { a.needsAssetQuality = false; }); lastAssets = time; }
            if (time - lastShadow > 1000 / profile.shadowFps) { renderer.shadowMap.needsUpdate = true; lastShadow = time; }
            if (dust.visible) { dust.rotation.y = Math.sin(time * .00003) * .2; dust.position.y = Math.sin(time * .0004) * .035; }
            gpuTimer.begin(); renderer.render(scene, camera); gpuTimer.end();
            if (!host.classList.contains('is-loading') && quality.observe({ time, interval: paintInterval, cpuMs: performance.now() - frameStart, gpuMs: gpuTimer.read() })) applyQuality();
        }
        applyQuality(); raf = requestAnimationFrame(tick);
        function obstacles() {
            return furniture.filter(row => row.placement.position[1] < 0.2 && !['frame', 'prop', 'keepsake'].includes(row.item.type)).map(row => {
                const e = H.Build.extent(row.placement), box = new T.Box3().setFromObject(row.model);
                const minX = Math.min(e.x - e.width / 2, box.min.x), maxX = Math.max(e.x + e.width / 2, box.max.x), minZ = Math.min(e.z - e.depth / 2, box.min.z), maxZ = Math.max(e.z + e.depth / 2, box.max.z);
                return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ };
            });
        }
        async function load(roomId, home, userProfile, activity) {
            const token = ++generation, previousRoom = room?.id; room = H.Rooms.get(roomId);
            if (!H.Rooms.available(room, home)) throw new Error('这个房间还在准备中。');
            if (previousRoom !== roomId) view.room(room.size); quality.reset(); lampLights = [];
            clearDraft();
            actors.forEach(actor => { actor.released = true; }); H.Shapes.disposeGeometry(roomGroup); roomGroup = new T.Group(); scene.add(roomGroup); actors = []; furniture = [];
            materials.clearSurfaces();
            const config = H.Interiors.resolve(room, home);
            scene.background.set(materials.night ? theme.background : config.background); groundMaterial.color.copy(scene.background);
            const targetGroup = roomGroup, shell = H.Rooms.shell(room, materials, home); shell.userData.floor = true; targetGroup.userData.interior = shell.userData.interior; targetGroup.add(shell);
            const placements = H.Rooms.placements(room, home);
            // Only three GLBs decode concurrently; the previous room's geometry is released first.
            let cursor = 0; const failures = [];
            const worker = async () => {
                while (cursor < placements.length && !disposed && token === generation) {
                    const placement = placements[cursor++], rawItem = H.Furniture.get(placement.furnitureId), item = rawItem && H.Interiors.furniture(rawItem, placement, room, home);
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
                light.position.set(row.placement.position[0], row.placement.position[1] + height, row.placement.position[2]); targetGroup.add(light); lampLights.push(light);
            }
            for (const who of ['user', 'char']) {
                const person = who === 'user' ? H.State.load().user : home, portrait = person.portrait;
                const actor = H.CharacterModels.selected(person, who) ? await H.CharacterModels.create(who, profile, H.CharacterModels.modelId(person, who)) : await H.Characters.createPortrait(portrait, who);
                if (disposed || token !== generation) { H.Shapes.disposeGeometry(actor.root); return false; }
                actor.root.position.set(who === 'user' ? 1.25 : -0.8, 0.07, 1.6); targetGroup.add(actor.root);
                const spawn = H.Animation.nearest(actor.root.position, obstacles(), room.size, actor.navigationRadius || .18);
                if (!spawn) { H.Shapes.disposeGeometry(actor.root); throw Error('房间没有足够的人物活动空间，请先挪动家具。'); }
                actor.root.position.set(spawn.x, .07, spawn.z);
                if (materials.night && actor.spriteMaterial) for (const material of [actor.spriteMaterial, actor.surface.material]) material.color.set('#dcd3d4');
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
            applyQuality(); quality.reset();
            if (failures.length) throw new Error('部分家具没能加载：' + failures.join('、') + '。可以重试进入。');
            return true;
        }
        function setCharActivity(activity, immediate = false) {
            const actor = actors.find(a => a.who === 'char'); if (!actor) return;
            actor.root.visible = activity.room === room?.id;
            if (!actor.root.visible) return;
            if (activity.action === 'Walk' || activity.action === 'Idle') {
                if (!standUp(actor)) return; actor.path = []; actor.destination = null;
                if (activity.action === 'Idle') { H.Characters.pose(actor, 'Idle'); return; }
                const seed = activity.wanderSeed || 0;
                for (let i = 0; i < 16; i++) {
                    const angle = (seed + i) * 2.4, end = { x: Math.cos(angle) * 1.9, z: .5 + Math.sin(angle) * 1.35, action: 'Idle' };
                    if (H.Animation.walk(actor, end, obstacles(), room.size)) return;
                }
                H.Characters.pose(actor, 'Idle'); return;
            }
            const requested = furniture.find(row => row.placement.id === activity.target);
            const target = requested && H.Rooms.useRow(furniture, requested, activity.action);
            if (!target) { H.Characters.pose(actor, 'Idle'); return; }
            if (occupied(target, activity.action, actors.find(a => a.who === 'user'))) { if (!standUp(actor)) return; actor.path = []; actor.destination = null; options.onNotice('这个位置你正在用，Ta在旁边等一会儿。'); return; }
            const anchor = H.Rooms.anchorInRoom(furniture, target, activity.action, 'char');
            if (!anchor) { H.Characters.pose(actor, 'Idle'); options.onNotice('先在桌前摆好朝向桌面的椅子，再使用它。'); return; }
            if (seatTaken(anchor, actors.find(a => a.who === 'user'))) { if (standUp(actor)) { actor.path = []; actor.destination = null; } options.onNotice('这张椅子你正在用，Ta在旁边等一会儿。'); return; }
            if (immediate) H.Characters.pose(actor, activity.action, anchor);
            else if (!goTo(actor, target, activity.action, anchor)) { options.onNotice('Ta想用' + target.item.name + '，但前面的路被挡住了。可以在装修里挪一挪。'); }
        }
        function goTo(actor, row, action, anchor, finish) {
            actor.path = []; actor.destination = null;
            // Approach from the front, then settle into the declared usable position.
            // First stand up in front of the occupied furniture, so pathfinding starts on the floor.
            if (!standUp(actor)) return false;
            const approach = H.Animation.approach(actor.root.position, row.placement, obstacles(), room.size, actor.navigationRadius || .18);
            if (!approach) return false;
            const end = { ...approach, action, anchor };
            return H.Animation.walk(actor, end, obstacles(), room.size, finish);
        }
        function standUp(actor) {
            const radius = actor.navigationRadius || .18, blocks = obstacles();
            if (actor.anchor) {
                const old = furniture.find(item => {
                    const p = H.Rooms.anchor(item.placement, actor.action, actor.who, item.item); return Math.hypot(p.x - actor.root.position.x, p.z - actor.root.position.z) < 0.4;
                });
                if (old) {
                    const p = H.Rooms.approaches(old.placement, radius).find(p => H.Animation.clear(p, blocks, room.size, radius));
                    if (!p) return false;
                    actor.root.position.set(p.x, .07, p.z);
                }
            }
            const p = H.Animation.nearest(actor.root.position, blocks, room.size, radius); if (!p) return false;
            H.Characters.pose(actor, 'Idle'); actor.root.position.set(p.x, .07, p.z); return true;
        }
        function walkUser(point) {
            const actor = actors.find(a => a.who === 'user'); if (!actor) return false;
            if (!H.Animation.clear(point, obstacles(), room.size, actor.navigationRadius || .18)) { options.onNotice('这里没有足够的走动空间，点旁边的空地走过去吧。'); return false; }
            if (!standUp(actor)) return false;
            actor.path = []; return H.Animation.walk(actor, point, obstacles(), room.size);
        }
        function interact(id, action, finish) {
            const requested = furniture.find(f => f.placement.id === id), user = actors.find(a => a.who === 'user');
            if (!requested || !user || !requested.item.actions.includes(action)) return false;
            const row = H.Rooms.useRow(furniture, requested, action);
            if (!row) throw new Error('先把电脑放在可使用的书桌上，再使用它。');
            const home = H.State.home(), char = actors.find(a => a.who === 'char');
            if (occupied(row, action, char)) throw new Error('这个位置Ta正在用，可以先去旁边陪着。');
            if (action === 'Hug' && (!home.consentHug || !char?.root.visible || char.action === 'Sleep')) throw new Error('先等对方醒来，或在小屋设置中允许拥抱。');
            const anchor = H.Rooms.anchorInRoom(furniture, row, action, 'user');
            if (!anchor) throw new Error('先在桌前摆好朝向桌面的椅子，再使用它。');
            if (seatTaken(anchor, char)) throw new Error('这张椅子Ta正在用，先换一张椅子吧。');
            if (action === 'Hug') {
                const charAnchor = H.Rooms.anchor(row.placement, 'Hug', 'char', row.item);
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
        function seatTaken(anchor, actor) {
            return !!anchor.seatId && !!actor?.root.visible && (actor.anchor?.seatId === anchor.seatId || actor.destination?.anchor?.seatId === anchor.seatId);
        }
        function emote(action) {
            const user = actors.find(a => a.who === 'user'); if (!user) return;
            user.path = []; H.Characters.pose(user, action, user.anchor);
            const char = actors.find(a => a.who === 'char');
            if (char?.root.visible && char.action !== 'Sleep') { char.head.rotation.y = 0.3; }
        }
        function resetCamera() { view.reset(); }
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
            marker = new T.Mesh(new T.PlaneGeometry(1, 1), materials.get('milky_plastic', '#b2d8b1')); marker.rotation.x = -Math.PI / 2; roomGroup.add(marker); applyQuality(); refreshDraft(); return true;
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
        function setBuild(value) { clearDraft(); buildMode = !!value; renderer.domElement.setAttribute('aria-label', buildMode ? '装修房间，拖动家具移动，双指缩放，使用底部按钮旋转和确认' : '实时3D小屋，拖动探索，双指缩放，点击家具互动'); }
        function dispose() {
            if (disposed) return; disposed = true; generation++; cancelAnimationFrame(raf); observer.disconnect();
            clearDraft();
            actors.forEach(actor => { actor.released = true; }); gpuTimer.dispose(); assetQuality.dispose(); H.Shapes.disposeGeometry(roomGroup); H.Shapes.disposeGeometry(ground); materials.dispose(); sun.shadow.dispose(); dustGeometry.dispose(); dust.material.dispose();
            renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); scene.clear(); roomGroup = null; actors = []; furniture = []; lampLights = []; pointers.clear();
        }
        const contextLost = event => { if (disposed) return; event.preventDefault(); contextUnavailable = true; cancel(); options.onNotice('3D 显示暂时中断，点重试重新进入小屋。'); H.UI?.showSceneError('设备暂时释放了3D画面，请重试。'); };
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        function setQuality(mode) { H.RenderQuality.save(mode); quality.setMode(mode); applyQuality(); }
        return { load, dispose, interact, emote, resetCamera, setCharActivity, setBuild, beginDraft, moveDraft, nudgeDraft, rotateDraft, clearDraft, setQuality, camera: view, draft: () => draft ? JSON.parse(JSON.stringify(draft)) : null, project: (x, z) => { const p = new T.Vector3(x, 0, z).project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 }; }, furniture: () => furniture, zoom: delta => view.zoom(Math.exp(delta)), stats: () => ({ ...renderer.info.memory, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, quality: quality.current(), texturesBudget: assetQuality.stats(), resolution: { cssWidth: host.clientWidth, cssHeight: host.clientHeight, width: renderer.domElement.width, height: renderer.domElement.height, pixelRatio: renderer.getPixelRatio(), antialias: !!renderer.getContext().getContextAttributes()?.antialias }, camera: view.stats(), buildMode, actors: actors.map(a => ({ who: a.who, action: a.action, visible: a.root.visible, visual: a.visual, position: { x: a.root.position.x, y: a.root.position.y, z: a.root.position.z }, pose: H.Characters.geometry(a), path: a.path.length })), room: room?.id }) };
    }
    H.Scene = { create };
})(window.ByndHome3D);
