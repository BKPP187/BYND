(function (H) {
    'use strict';
    function create(host, options) {
        const T = ByndHomeEngine, materials = H.Materials.create(options.theme), scene = new T.Scene(), theme = materials.theme;
        scene.background = new T.Color(theme.background);
        const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
        const quality = H.RenderQuality.controller(H.RenderQuality.preference(), H.RenderQuality.detect(renderer)), assetQuality = H.RenderAssets.create(T, renderer), gpuTimer = H.RenderQuality.gpuTimer(renderer.getContext());
        let profile = quality.current(), lastShadow = 0, lastAssets = 0, lampLights = [], contextUnavailable = false, lastLighting = -Infinity, lighting = H.Daylight.sample(), skyBase = theme.background;
        const gl = renderer.getContext(), viewportLimits = gl.getParameter(gl.MAX_VIEWPORT_DIMS), bufferLimit = Math.min(renderer.capabilities.maxTextureSize, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), viewportLimits[0], viewportLimits[1]);
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = theme.exposure * 0.86;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.domElement.setAttribute('aria-label', '实时3D小屋，拖动探索，双指缩放，点击家具互动'); renderer.domElement.tabIndex = 0;
        host.appendChild(renderer.domElement);
        let camera = new T.OrthographicCamera(-6, 6, 6, -6, 0.1, 70);
        const view = H.RoomCamera.create(camera, T);
        let disposed = false, roomGroup = null, room = null, generation = 0, mealGeneration = 0, actors = [], furniture = [], raf = 0, lastTime = 0, lastPaint = 0, nextPaint = 0;
        let villa = null, stairs = null, changingFloor = false, failedArea = '', cutawayWalls = [], wallFinishes = [], doors = [], wallMode = 'cutaway', exteriorGroup = null;
        let inspection = null, viewedLevel = null, surveyToken = 0, surveySaved = null, inspecting = false, cutawayGroup = null, viewToken = 0, renderedView = '', wholeFloor = null, wholeActors = null;
        const overview = () => ['exterior','dollhouse'].includes(view.stats().mode);
        const surveying = () => viewedLevel !== null || inspecting || view.stats().mode === 'dollhouse';
        const navigationSize = () => villa?.size || room.size;
        const floorY = () => villa?.y || 0;
        const offset = id => villa?.nodes.find(n => n.id === id) || { x: 0, z: 0 };
        const worldPosition = p => villa ? H.Villa.translate(villa, room.id, p) : [...p];
        const selectableRows = () => view.stats().mode === 'dollhouse' ? [...(wholeFloor?.rows || []), ...(inspection?.rows || [])] : viewedLevel !== null ? inspection?.rows || [] : furniture;
        const findRow = id => furniture.find(r => r.placement.id === id || (r.area === room?.id && r.local.id === id));
        const getFurniture = id => selectableRows().find(r => r.placement.id === id || (r.area === room?.id && r.local.id === id));
        function focusArea(id, save = true) {
            if (!villa || room.id === id) return;
            const n = villa.nodes.find(n => n.id === id); if (!n) return;
            if (save) options.onArea?.(id); // Persistence must succeed before UI reports arrival.
            room = n.room; failedArea = ''; if(!overview()&&!surveying())view.focus(n.x, n.z); roomGroup.userData.interior = H.Interiors.resolve(room, H.State.home());
        }
        function select(id) {
            if (changingFloor) return;
            const row = getFurniture(id);
            if (row && villa) {
                if (buildMode && row.area !== room.id) { focusBuildArea(row.area); options.onBuildArea?.(row.area); }
                options.onSelect(buildMode ? row.local.id : row.placement.id); return;
            }
            options.onSelect(id);
        }
        const pointers = new Map(); let pinchDistance = null;
        let buildMode = false, draft = null, preview = null, marker = null, draftToken = 0;
        const groundMaterial = new T.MeshBasicMaterial({ color: theme.background });
        groundMaterial.toneMapped = false;
        const ground = new T.Mesh(new T.PlaneGeometry(100, 100), groundMaterial); ground.userData.ownedMaterial = groundMaterial; ground.rotation.x = -Math.PI / 2; ground.position.y = -0.435; scene.add(ground);
        const ambient = new T.HemisphereLight('#fff8eb', '#c6b7a7', 1.65); scene.add(ambient);
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
            if(view.stats().mode==='dollhouse')for(const group of [inspection?.group,wholeFloor?.group])group?.traverse(n=>{if(n.isMesh)n.castShadow=profile.tier!=='smooth';});
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
            const groups = view.stats().mode === 'dollhouse' ? [wholeFloor?.group, inspection?.group, wholeActors] : viewedLevel !== null ? [inspection?.group] : [roomGroup];
            return ray.intersectObjects(groups.filter(Boolean), true).filter(hit=>{for(let n=hit.object;n;n=n.parent)if(!n.visible)return false;return true;});
        }
        function down(event) {
            const pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragged: false, rotate: event.altKey || event.button === 2 };
            pointers.set(event.pointerId, pointer);
            renderer.domElement.setPointerCapture(event.pointerId);
            if (pointers.size > 1) { pointers.forEach(p => { p.dragged = true; }); pinchDistance = null; return; }
            if (buildMode && !draft) for (const hit of pick(event)) {
                let node = hit.object; while (node && !node.userData.furniture) node = node.parent;
                if (node?.userData.furniture && !String(node.userData.furniture).startsWith('memory-')) { select(node.userData.furniture); break; }
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
            if(view.stats().mode === 'exterior') { options.onNotice('这是整栋外观，切到整栋剖面或房间视角后点家具互动。'); return; }
            if(inspecting)return;
            if (buildMode) { if (draft) moveDraft(event.clientX, event.clientY); return; }
            const rect = renderer.domElement.getBoundingClientRect(); mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(mouse, camera);
            for (const hit of pick(event)) {
                let node = hit.object; while (node && !node.userData.furniture && !node.userData.actor && !node.userData.floor && !node.userData.stairs && !node.userData.door) node = node.parent;
                if (node?.userData.furniture) { select(node.userData.furniture); return; }
                if (surveying()) continue;
                // Hinged door leaves can project over a large patch of floor.
                // Ground taps still target that floor; proximity opens the door.
                if(node?.userData.door)continue;
                if (node?.userData.stairs) { navigate(villa.level ? 'stair_hall' : 'landing'); return; }
                if (node?.userData.actor) { options.onActor(node.userData.actor); return; }
                if (node?.userData.floor) { if(hit.face?.normal.clone().transformDirection(hit.object.matrixWorld).y>.7){walkUser({ x: hit.point.x, y: 0, z: hit.point.z, action: 'Idle' });return;}continue; }
                if(hit.object.userData.villaWall||hit.object.userData.wallFinish)return;
            }
        }
        const cancel = event => { if (event?.pointerId !== undefined) pointers.delete(event.pointerId); else pointers.clear(); pinchDistance = null; };
        const wheel = event => { event.preventDefault(); view.zoom(Math.exp(-event.deltaY * .0015)); };
        renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', cancel); renderer.domElement.addEventListener('wheel', wheel, { passive: false });
        const key = event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); if (event.altKey) view.rotate(event.key === 'ArrowLeft' ? 16 : -16, 0); else view.pan(event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0, event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0); } };
        renderer.domElement.addEventListener('keydown', key);
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        function updateLighting(time) {
            if(time-lastLighting<1000)return;lastLighting=time;lighting=H.Daylight.sample();
            const luminous=new Set(),sources=[];scene.updateMatrixWorld(true);
            scene.traverse(node=>{
                if(node.userData.luminousMaterial)luminous.add(node.userData.luminousMaterial);
                if(!node.userData.ceilingLamp&&node.userData.lampHeight===undefined)return;
                for(let p=node;p;p=p.parent)if(!p.visible)return;
                const position=node.getWorldPosition(new T.Vector3());position.y+=node.userData.ceilingLamp?-.5:node.userData.lampHeight;sources.push(position);
            });
            H.Daylight.apply(lighting,{sun,ambient,fill},renderer,scene,groundMaterial,skyBase,luminous);
            const c=view.stats(),base=overview()?3.2:(viewedLevel??villa?.level??0)*3.2;
            sun.position.set(c.x+lighting.sun[0],base+lighting.sun[1],c.z+lighting.sun[2]);sun.target.position.set(c.x,base,c.z);sun.target.updateMatrixWorld();
            const extent=overview()?12:6;sun.shadow.camera.left=-extent;sun.shadow.camera.right=extent;sun.shadow.camera.top=extent;sun.shadow.camera.bottom=-extent;sun.shadow.camera.updateProjectionMatrix();
            sources.sort((a,b)=>Math.hypot(a.x-c.x,a.z-c.z)-Math.hypot(b.x-c.x,b.z-c.z));
            lampLights.forEach((light,i)=>{light.visible=i<profile.lights&&!!sources[i];if(sources[i])light.position.copy(sources[i]);light.intensity=.35+lighting.lamps*4.1;});
            renderer.shadowMap.needsUpdate=true;options.onLighting?.(lighting);
        }
        function tick(time) {
            if (disposed) return; raf = requestAnimationFrame(tick);
            if (document.hidden || !host.isConnected || !host.clientHeight || contextUnavailable) { lastTime = time; lastPaint = 0; nextPaint = 0; quality.reset(); return; }
            const interval = 1000 / profile.fps; if (time + .5 < nextPaint) return;
            nextPaint = Math.max(time, nextPaint + interval);
            const frameStart = performance.now(), paintInterval = lastPaint ? time - lastPaint : interval;
            const dt = Math.min((time - (lastTime || time)) / 1000, 0.08); lastTime = time; lastPaint = time;
            view.step(Math.min(paintInterval / 1000, .25), !!reduced); assetQuality.lod(camera, host.clientHeight, profile);
            actors.forEach(actor => { if (!buildMode) H.Animation.tick(actor, time, dt, reduced); H.Characters.faceCamera(actor, camera); if (actor.visual === 'model3d') H.CharacterModels.update(actor, camera, host.clientHeight, profile, options.onNotice); });
            if (villa && !buildMode) {
                const user = actors.find(a => a.who === 'user'), area = user && H.Villa.nodeAt(villa, user.root.position);
                if (user?.path.length && !user.onStairs) user.root.position.y = floorY() + .07;
                if (area && user && !user.onStairs && user.area !== area.id) {
                    user.area = area.id;
                    if (failedArea !== area.id) try { focusArea(area.id); } catch (e) { failedArea = area.id; options.onNotice(e.message); }
                }
                const c = view.stats();
                // The physical partition remains in navigation; only the upper
                // wall is cut away when it stands in front of the camera target.
                const effective = view.stats().mode === 'first' ? 'full' : wallMode;
                [...wallFinishes,...(inspection?.finishes||[])].forEach(mesh => { mesh.visible = effective !== 'hidden'; });
                [...cutawayWalls,...(inspection?.walls||[])].forEach(mesh => { const w = mesh.userData.villaWall; mesh.visible = effective === 'full' || effective === 'cutaway' && w.cutaway && (w.axis !== 'z' || w.z <= c.z + .15); });
                [...furniture,...(inspection?.rows||[])].filter(r => ['frame','mirror'].includes(r.item.type) && r.placement.position[1] > (r.placement.floorY||0) + 1).forEach(r => { r.model.visible = effective !== 'hidden' && (effective === 'full' || r.placement.position[2] <= c.z + .15); });
                H.Villa.updateDoors(doors,actors,dt,reduced);
                if(inspection)H.Villa.updateDoors(inspection.doors,[],dt,reduced);
            }
            const home = H.State.home();
            H.SleepPair.update(furniture, actors, home.consentHug !== false);
            H.Dining.update(furniture, actors, time, home.consentHug !== false && ['亲近', '恋人'].includes(home.relationship), reduced || buildMode);
            H.Bedding.update(furniture, actors);
            H.Cooking.update(furniture, actors, time, profile, reduced || buildMode);
            H.Hygiene?.update(furniture, actors, time, profile, reduced || buildMode);
            H.Television.update(furniture, actors, time, profile, reduced || buildMode || overview() || surveying(), options.onNotice);
            updateLighting(time);
            if (time - lastAssets > 1500 || actors.some(a => a.needsAssetQuality)) { assetQuality.apply(scene, profile); actors.forEach(a => { a.needsAssetQuality = false; }); lastAssets = time; }
            if (time - lastShadow > 1000 / profile.shadowFps) { renderer.shadowMap.needsUpdate = true; lastShadow = time; }
            if (dust.visible) { dust.rotation.y = Math.sin(time * .00003) * .2; dust.position.y = Math.sin(time * .0004) * .035; }
            const user=actors.find(a=>a.who==='user'), mode=view.stats().mode;
            if(user && ['first','third'].includes(mode)){
                const head=H.Characters.geometry(user).head || {x:user.root.position.x,y:user.root.position.y+1.35,z:user.root.position.z};
                view.follow({eye:head,yaw:user.root.rotation.y,lookAt:offset(room.id)});view.step(dt,!!reduced);camera=view.active();
                if(mode==='third'){
                    const target=new T.Vector3(head.x,head.y+.09,head.z),vector=camera.position.clone().sub(target),length=vector.length();
                    ray.set(target,vector.normalize());ray.far=length;
                    const hit=ray.intersectObjects(cutawayWalls.filter(m=>m.geometry?.type==='RoundedBoxGeometry'),false)[0];
                    if(hit){camera.position.copy(target).addScaledVector(vector,Math.max(.12,hit.distance-.12));camera.lookAt(target);camera.updateMatrixWorld(true);}ray.far=Infinity;
                }
            }
            const hideSelf=user&&mode==='first',visible=user?.root.visible;if(hideSelf)user.root.visible=false;
            gpuTimer.begin(); renderer.render(scene, camera); renderedView=view.stats().mode; gpuTimer.end();
            if(hideSelf)user.root.visible=visible;
            if (!host.classList.contains('is-loading') && quality.observe({ time, interval: paintInterval, cpuMs: performance.now() - frameStart, gpuMs: gpuTimer.read() })) applyQuality();
        }
        applyQuality(); raf = requestAnimationFrame(tick);
        function obstacles() {
            return furniture.filter(row => row.placement.position[1] < floorY() + 0.2 && !['frame', 'prop', 'keepsake'].includes(row.item.type)).map(row => {
                const e = H.Build.extent(row.placement), box = new T.Box3().setFromObject(row.model);
                const minX = Math.min(e.x - e.width / 2, box.min.x), maxX = Math.max(e.x + e.width / 2, box.max.x), minZ = Math.min(e.z - e.depth / 2, box.min.z), maxZ = Math.max(e.z + e.depth / 2, box.max.z);
                return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ };
            }).concat(villa ? H.Villa.blocks(villa) : []);
        }
        function worldEntry(areaId, local) {
            return { local, area: areaId, placement: villa ? { ...local, id: areaId + '__' + local.id, floorY: floorY(), position: H.Villa.translate(villa, areaId, local.position) } : local };
        }
        function renderedItem(local, area, home) { const raw = H.Furniture.get(local.furnitureId); return raw && H.Interiors.furniture(raw, local, H.Rooms.get(area), home); }
        async function createRow(entry, home, alive) {
            const { placement, local, area } = entry, item = renderedItem(local, area, home);
            if (!item) throw Object.assign(new Error('家具型号无效。'), { label: placement.furnitureId });
            let model;
            try { model = await H.Furniture.load(item, materials); } catch (error) { error.label = item.name; throw error; }
            if (H.Foods.supports(item)) {
                try { H.Foods.attach(model, await H.Foods.create(item, H.Foods.selected(home))); }
                catch (error) { if (alive()) options.onNotice(error.message); }
            }
            if (!alive()) { H.Shapes.disposeGeometry(model); return null; }
            model.position.set(...placement.position); model.rotation.y = placement.rotation || 0; model.userData.furniture = placement.id;
            if (item.type === 'frame' && home.photo?.url) H.Furniture.setPhoto(model, home.photo.url, alive).catch(() => options.onNotice('相框照片暂时加载失败，可重新选择照片。'));
            return { placement, local, area, item, model };
        }
        async function addKeepsakes(home, token) {
            const count = Math.min(home.keepsakes.length, 6), stars = [];
            for (let i = 0; i < count; i++) {
                const star = await H.Furniture.load(H.Furniture.get('memory_01'), materials);
                if (disposed || token !== generation) { H.Shapes.disposeGeometry(star); stars.forEach(s => H.Shapes.disposeGeometry(s)); return false; }
                star.position.fromArray(worldPosition([-1.08 + i * .36, .15, 2.25])); star.userData.furniture = 'memory-' + i; stars.push(star);
            }
            roomGroup?.children.filter(child => String(child.userData.furniture || '').startsWith('memory-')).forEach(child => { child.removeFromParent(); H.Shapes.disposeGeometry(child); });
            stars.forEach(star => roomGroup.add(star));
            return true;
        }
        // Furniture that changed under someone ends only that person's use of it.
        function releaseFurniture(ids) {
            for (const actor of actors) {
                const anchor = actor.destination?.anchor || actor.anchor;
                if (!anchor || !(ids.has(anchor.placementId) || ids.has(anchor.seatId))) continue;
                try {
                    if (actor.who === 'user') H.Interactions?.cancel('cancelled', '家具已经挪动');
                    else { actor.sharedInteraction = false; H.Actions?.end('char', 'cancelled', '家具已经挪动'); }
                } catch (error) { options.onNotice(error.message, true); }
                actor.path = []; actor.destination = null; standUp(actor);
            }
        }
        function settleActors() {
            const blocks = obstacles(), size = navigationSize();
            for (const actor of actors) {
                if (!actor.root.visible || actor.anchor || actor.onStairs) continue;
                const radius = actor.navigationRadius || .18;
                if (H.Animation.clear(actor.root.position, blocks, size, radius)) continue;
                const p = H.Animation.nearest(actor.root.position, blocks, size, radius);
                if (p) { actor.path = []; actor.destination = null; actor.root.position.set(p.x, actor.root.position.y, p.z); }
            }
        }
        // Applies one area's saved layout to the live scene: adds, replaces, moves
        // and removes only the furniture that differs, keeping camera and actors.
        async function syncArea(areaId = room?.id) {
            if (disposed || !roomGroup || !room) return false;
            const node = villa ? villa.nodes.find(n => n.id === areaId) : room.id === areaId ? { id: areaId, room } : null;
            if (!node) return false;
            const home = H.State.home(), token = generation, alive = () => !disposed && token === generation;
            const saved = H.Rooms.placements(node.room, home), live = furniture.filter(r => r.area === areaId), stale = [], moved = [], added = [];
            for (const row of live) {
                const next = saved.find(p => p.id === row.local.id);
                if (!next) { stale.push(row); continue; }
                const item = renderedItem(next, areaId, home), samePlace = next.position.every((v, i) => Math.abs(v - row.local.position[i]) < 1e-9) && Math.abs((next.rotation || 0) - (row.local.rotation || 0)) < 1e-9;
                const sameLook = item && item.id === row.item.id && item.style === row.item.style && (item.interiorPalette?.id || '') === (row.item.interiorPalette?.id || '') && (item.interiorPalette?.wood || '') === (row.item.interiorPalette?.wood || '');
                if (sameLook && samePlace) continue;
                if (sameLook) moved.push([row, next]); else { stale.push(row); added.push(next); }
            }
            for (const p of saved) if (!live.some(r => r.local.id === p.id)) added.push(p);
            if (!stale.length && !moved.length && !added.length) return { added: 0, removed: 0, moved: 0 };
            const created = [];
            try {
                for (const local of added) { const row = await createRow(worldEntry(areaId, local), home, alive); if (row) created.push(row); }
            } catch (error) { created.forEach(r => H.Shapes.disposeGeometry(r.model)); throw new Error('家具没能加载：' + (error.label || error.message) + '。已保存，可以重新进入小屋查看。'); }
            if (!alive()) { created.forEach(r => H.Shapes.disposeGeometry(r.model)); return false; }
            releaseFurniture(new Set([...stale, ...moved.map(m => m[0])].map(r => r.placement.id)));
            for (const row of stale) { row.model.removeFromParent(); H.Shapes.disposeGeometry(row.model); }
            furniture = furniture.filter(r => !stale.includes(r));
            for (const [row, next] of moved) { const entry = worldEntry(areaId, next); row.local = next; row.placement = entry.placement; row.model.position.set(...entry.placement.position); row.model.rotation.y = entry.placement.rotation || 0; }
            for (const row of created) { roomGroup.add(row.model); furniture.push(row); }
            settleActors(); applyQuality(); renderer.shadowMap.needsUpdate = true;
            return { added: created.length, removed: stale.length, moved: moved.length };
        }
        async function syncKeepsakes() { if (disposed || !roomGroup) return false; const ok = await addKeepsakes(H.State.home(), generation); if (ok) applyQuality(); return ok; }
        async function refreshPhoto() {
            const url = H.State.home()?.photo?.url, token = generation; if (!url || disposed) return false;
            await Promise.all(furniture.filter(r => r.item.type === 'frame').map(r => H.Furniture.setPhoto(r.model, url, () => !disposed && token === generation)));
            return true;
        }
        // Decoration can look at any room on the current floor without moving the avatar.
        function focusBuildArea(id) {
            if (!buildMode) return false;
            if (!villa) return room?.id === id;
            const n = villa.nodes.find(n => n.id === id); if (!n) return false;
            if (room.id !== id) { clearDraft(); options.onDraft?.(null); }
            room = n.room; failedArea = ''; view.focus(n.x, n.z); roomGroup.userData.interior = H.Interiors.resolve(room, H.State.home());
            return true;
        }
        function viewCenter() { const s = view.stats(), o = offset(room.id); return { x: s.x - o.x, z: s.z - o.z }; }
        async function load(roomId, home, userProfile, activity, stairEntry = false) {
            if(!stairEntry)H.Interactions?.cancel();
            viewToken++;
            clearInspection();
            if(overview())setViewpoint('isometric');
            H.Shapes.disposeGeometry(exteriorGroup);exteriorGroup=null;
            H.Shapes.disposeGeometry(cutawayGroup);cutawayGroup=null;
            const token = ++generation, previousRoom = room?.id; room = H.Rooms.get(roomId);
            if (!H.Rooms.available(room, home)) throw new Error('这个房间还在准备中。');
            villa = options.villa && H.Villa ? H.Villa.plan(roomId) : null; stairs = null; changingFloor = false; failedArea = ''; cutawayWalls = [];wallFinishes=[];doors=[];
            if (previousRoom !== roomId || villa) view.room(navigationSize(), { ...offset(roomId), y: floorY() }); quality.reset(); lampLights.forEach(l=>l.removeFromParent());lampLights = [];
            clearDraft();
            actors.forEach(actor => { actor.released = true; }); H.Shapes.disposeGeometry(roomGroup); roomGroup = new T.Group(); scene.add(roomGroup); actors = []; furniture = [];
            materials.clearSurfaces();
            const config = H.Interiors.resolve(room, home);
            skyBase=config.background; lastLighting=-Infinity;
            const targetGroup = roomGroup, nodes = villa?.nodes || [{ id: room.id, room }];
            for (const node of nodes) {
                const shell = villa ? H.Villa.shell(node, villa, materials, home) : H.Rooms.shell(room, materials, home);
                if (villa) shell.traverse(mesh => { if (mesh.userData.villaWall) cutawayWalls.push(mesh);if(mesh.userData.wallFinish)wallFinishes.push(mesh);if(mesh.userData.door)doors.push(mesh); });
                targetGroup.userData.interior = shell.userData.interior; targetGroup.add(shell);
            }
            if (villa) { stairs = H.Villa.staircase(villa, materials); targetGroup.add(stairs.group); }
            if(villa&&!villa.level)await H.Garden.populate(targetGroup,materials,()=>!disposed&&token===generation,home);
            if(disposed||token!==generation)return false;
            const placements = nodes.flatMap(n => H.Rooms.placements(n.room, home).map(local => worldEntry(n.id, local)));
            // Only three GLBs decode concurrently; the previous room's geometry is released first.
            let cursor = 0; const failures = [], alive = () => !disposed && token === generation;
            const worker = async () => {
                while (cursor < placements.length && alive()) {
                    const entry = placements[cursor++];
                    try {
                        const row = await createRow(entry, home, alive);
                        if (row) { targetGroup.add(row.model); furniture.push(row); }
                    } catch (error) { failures.push(error.label || entry.placement.furnitureId); console.warn('小屋家具加载失败', entry.placement.furnitureId, error.message); }
                }
            };
            await Promise.all([worker(), worker(), worker()]);
            if (disposed || token !== generation) return false;
            // Only two furniture lights per room; decorations and materials can
            // glow without adding an unbounded number of dynamic lights on phones.
            for(let i=0;i<2;i++){const light=new T.PointLight('#ffd7a5',1,5,2);scene.add(light);lampLights.push(light);}
            for (const who of ['user', 'char']) {
                const person = who === 'user' ? H.State.load().user : home, portrait = person.portrait;
                const actor = H.CharacterModels.selected(person, who) ? await H.CharacterModels.create(who, profile, H.CharacterModels.modelId(person, who)) : await H.Characters.createPortrait(portrait, who);
                if (disposed || token !== generation) { H.Shapes.disposeGeometry(actor.root); return false; }
                const area = who === 'char' && villa?.nodes.some(n => n.id === activity.room) ? activity.room : roomId, origin = offset(area);
                actor.area = area;
                actor.root.position.set(origin.x + (who === 'user' ? 1.25 : -.8), floorY() + .07, origin.z + 1.6);
                const invitation = H.Interactions?.paired();
                if (stairEntry && stairs && (who === 'user' || invitation?.travelWithPartner)) {
                    actor.root.position.set(stairs.entry.x + (invitation?.travelWithPartner ? (who === 'user' ? -.3 : .3) : 0), floorY() + .07, stairs.entry.z);
                    actor.area = roomId;
                }
                targetGroup.add(actor.root);
                const spawn = H.Animation.nearest(actor.root.position, obstacles(), navigationSize(), actor.navigationRadius || .18);
                if (!spawn) { H.Shapes.disposeGeometry(actor.root); throw Error('房间没有足够的人物活动空间，请先挪动家具。'); }
                actor.root.position.set(spawn.x, floorY() + .07, spawn.z);
                if (materials.night && actor.spriteMaterial) for (const material of [actor.spriteMaterial, actor.surface.material]) material.color.set('#dcd3d4');
                if (who === 'char' && activity.room !== roomId && !villa?.nodes.some(n => n.id === activity.room) && !invitation?.travelWithPartner) actor.root.visible = false;
                if (invitation && actor.root.visible) actor.sharedInteraction = true;
                actors.push(actor);
            }
            setCharActivity(activity, true);
            if (!await addKeepsakes(home, token)) return false;
            applyQuality(); quality.reset(); options.onView?.();
            if (failures.length) throw new Error('部分家具没能加载：' + failures.join('、') + '。可以重试进入。');
            return true;
        }
        function setCharActivity(activity, immediate = false) {
            const actor = actors.find(a => a.who === 'char'); if (!actor) return;
            if (actor.sharedInteraction || H.Interactions?.paired()) return;
            const current = H.State.home()?.executions?.char;
            // Extending the same plan must not make a seated character stand up and
            // walk back to the same seat, or count another use every scheduler tick.
            if (!immediate && actor.root.visible && actor.action === activity.action && current?.phase === 'acting' && current.room === activity.room && current.target === (activity.target || '')) return;
            if (!immediate && actor.action === 'Hug' && actors.some(a => a.who === 'user' && a.action === 'Hug')) return;
            const sceneGeneration = generation;
            let receipt;
            const report = (phase, reason = '') => {
                if (disposed || sceneGeneration !== generation) return false;
                try {
                    const saved = !receipt || H.Actions.transition(receipt, phase, reason);
                    H.UI?.updateStatus(); return saved;
                } catch (error) {
                    actor.path = []; actor.destination = null;
                    H.Characters.pose(actor, 'Idle'); options.onNotice(error.message, true);
                    return false;
                }
            };
            const blocked = reason => { actor.path = []; actor.destination = null; standUp(actor); report('blocked', reason); options.onNotice(reason); };
            const visible = activity.room === room?.id || !!villa?.nodes.some(n => n.id === activity.room);
            try { receipt = H.Actions?.begin('char', activity, { restore: immediate, simulated: !visible }); }
            catch (error) { options.onNotice(error.message, true); return; }
            actor.root.visible = activity.room === room?.id || !!villa?.nodes.some(n => n.id === activity.room);
            actor.area = activity.room;
            if (!actor.root.visible) { actor.path = []; actor.destination = null; H.UI?.updateStatus(); return; }
            if (activity.action === 'Walk' || activity.action === 'Idle') {
                if (!standUp(actor)) { blocked('Ta身边没有可以起身的空地。'); return; } actor.path = []; actor.destination = null;
                if (activity.action === 'Idle') { H.Characters.pose(actor, 'Idle'); report('acting'); return; }
                if (!report('walking')) return;
                const seed = activity.wanderSeed || 0;
                for (let i = 0; i < 16; i++) {
                    const origin = offset(activity.room), angle = (seed + i) * 2.4, end = { x: origin.x + Math.cos(angle) * 1.9, z: origin.z + .5 + Math.sin(angle) * 1.35, action: 'Idle' };
                    if (H.Animation.walk(actor, end, obstacles(), navigationSize(), () => report('finished'))) return;
                }
                blocked('Ta暂时找不到通畅的散步路线。'); return;
            }
            const requested = furniture.find(row => row.area === activity.room && row.local.id === activity.target);
            const target = requested && H.Rooms.useRow(furniture, requested, activity.action);
            if (!target) { blocked('想用的家具已经移动或移除，Ta先休息一会儿。'); return; }
            if (occupied(target, activity.action, actors.find(a => a.who === 'user'))) { blocked('这个位置你正在用，Ta在旁边等一会儿。'); return; }
            const anchor = H.Rooms.anchorInRoom(furniture, target, activity.action, 'char', reservations(actor));
            if (!anchor) { blocked(anchorError(target, activity.action)); return; }
            if (seatTaken(anchor, actors.find(a => a.who === 'user'))) { blocked('这张椅子你正在用，Ta在旁边等一会儿。'); return; }
            if (immediate) { H.Characters.pose(actor, activity.action, anchor); report('acting'); }
            else if (report('walking') && !goTo(actor, target, activity.action, anchor, () => report('acting'))) blocked('Ta想用' + target.item.name + '，但前面的路被挡住了。可以在装修里挪一挪。');
        }
        function goTo(actor, row, action, anchor, finish) {
            actor.path = []; actor.destination = null;
            // Approach from the front, then settle into the declared usable position.
            // First stand up in front of the occupied furniture, so pathfinding starts on the floor.
            if (!standUp(actor)) return false;
            const seat = anchor?.seatId && furniture.find(r => r.placement.id === anchor.seatId);
            const approach = H.Animation.approach(actor.root.position, (seat || row).placement, obstacles(), navigationSize(), actor.navigationRadius || .18);
            if (!approach) return false;
            const end = { ...approach, action, anchor };
            return H.Animation.walk(actor, end, obstacles(), navigationSize(), finish);
        }
        function standUp(actor) {
            const radius = actor.navigationRadius || .18, blocks = obstacles();
            if (actor.anchor) {
                const old = furniture.find(item => item.placement.id === (actor.anchor.seatId || actor.anchor.placementId)) || furniture.find(item => {
                    const p = H.Rooms.anchor(item.placement, actor.action, actor.who, item.item); return Math.hypot(p.x - actor.root.position.x, p.z - actor.root.position.z) < 0.4;
                });
                if (old) {
                    const p = H.Rooms.approaches(old.placement, radius).find(p => H.Animation.clear(p, blocks, navigationSize(), radius));
                    if (!p) return false;
                    actor.root.position.set(p.x, floorY() + .07, p.z);
                }
            }
            const p = H.Animation.nearest(actor.root.position, blocks, navigationSize(), radius); if (!p) return false;
            H.Characters.pose(actor, 'Idle'); actor.root.position.set(p.x, floorY() + .07, p.z); return true;
        }
        function walkUser(point) {
            if(surveying()||overview())return false;
            if (changingFloor) return false;
            const actor = actors.find(a => a.who === 'user'); if (!actor) return false;
            if(!Number.isFinite(point.x)||!Number.isFinite(point.z))return false;
            if (!standUp(actor)) return false;
            const blocks=obstacles(),size=navigationSize(),radius=actor.navigationRadius||.18;
            const target=H.Animation.destination(actor.root.position,point,blocks,size,radius);
            if(!target){options.onNotice('这条路被家具或墙挡住了，请换一处空地，或在装修里留出通道。');return false;}
            H.Interactions?.cancel();actor.path=[];actor.destination=null;
            return H.Animation.walk(actor,{...point,...target},blocks,size);
        }
        function navigate(id, interaction = false) {
            if (!interaction) H.Interactions?.cancel();
            if (!villa || changingFloor || buildMode) return false;
            if(overview()||surveying())setViewpoint('isometric');
            const targetLevel = H.Villa.floorOf(id); if (targetLevel < 0) return false;
            if (targetLevel !== villa.level) {
                const invitation = interaction && H.Interactions?.paired(), token = generation;
                const party = actors.filter(a => a.who === 'user' || (invitation?.travelWithPartner && a.root.visible));
                if (!party.length || party.some(a => !standUp(a))) return false;
                const blocks = obstacles(), size = navigationSize(), entries = party.map((a,i) => ({...stairs.entry,x:stairs.entry.x+(party.length>1?(i===0?-.3:.3):0)}));
                if (party.some((a,i) => !H.Animation.path(a.root.position,entries[i],blocks,size,a.navigationRadius||.18).length)) {
                    options.onNotice('楼梯前的路被挡住了，请先挪开家具。'); return false;
                }
                let ready = 0, arrived = 0;
                party.forEach((actor,i) => {
                    if (invitation) actor.sharedInteraction = true;
                    H.Animation.walk(actor, {...entries[i],action:'Idle'},blocks,size,() => {
                        if (disposed || token !== generation || (invitation && H.Interactions?.paired() !== invitation)) return;
                        if (++ready !== party.length) return;
                        changingFloor = true;
                        party.forEach((traveler,n) => {
                            traveler.onStairs = true; H.Characters.pose(traveler,'Walk');
                            traveler.path = stairs.path.slice(1).map(p => ({...p,x:p.x+entries[n].x-stairs.entry.x}));
                            traveler.destination = {action:'Idle',finish:() => {
                                if (disposed || token !== generation) return;
                                traveler.onStairs = false;
                                if (++arrived !== party.length) return;
                                Promise.resolve(options.onFloor?.(targetLevel?'landing':'stair_hall',id)).catch(e => {
                                    changingFloor = false;
                                    try { H.Interactions?.cancel('blocked',e.message); } catch (_) { /* Report the original error. */ }
                                    if (!disposed && token === generation) party.forEach(a => { a.root.position.set(stairs.entry.x,stairs.entry.y,stairs.entry.z); H.Characters.pose(a,'Idle'); });
                                    options.onNotice(e.message,true);
                                });
                            }};
                        });
                    });
                });
                return true;
            }
            const node = villa.nodes.find(n => n.id === id), actor = actors.find(a => a.who === 'user');
            if (!node || !actor || !standUp(actor)) return false;
            const radius = actor.navigationRadius || .18, candidates = [[0, 1.7], [0, 0], [2.2, .7], [-2.2, .7], [2.2, 1.6], [-2.2, 1.6], [0, -1.6]];
            for (const [x, z] of candidates) {
                const free = H.Animation.nearest({ x: node.x + x, z: node.z + z }, obstacles(), navigationSize(), radius);
                if (!free || H.Villa.nodeAt(villa, free)?.id !== id) continue;
                const end = { ...free, action: 'Idle' };
                if (H.Animation.walk(actor, end, obstacles(), navigationSize(), () => { try { focusArea(id); } catch (e) { options.onNotice(e.message); } })) return true;
            }
            options.onNotice('这间房的门口被挡住了，请在装修里留出通道。'); return false;
        }
        function interact(id, action, finish) {
            if(surveying()||overview())throw Error('先返回人物所在楼层，再与家具互动。');
            if (changingFloor) return false;
            const requested = findRow(id), user = actors.find(a => a.who === 'user');
            if (!requested || !user || !requested.item.actions.includes(action)) return false;
            const row = H.Rooms.useRow(furniture, requested, action);
            if (!row) throw new Error('先把电脑放在可使用的书桌上，再使用它。');
            const home = H.State.home(), char = actors.find(a => a.who === 'char');
            if (occupied(row, action, char)) throw new Error('这个位置Ta正在用，可以先去旁边陪着。');
            if (action === 'Hug' && (!home.consentHug || !char?.root.visible || char.action === 'Sleep')) throw new Error('先等对方醒来，或在小屋设置中允许拥抱。');
            const anchor = H.Rooms.anchorInRoom(furniture, row, action, 'user', reservations(user));
            if (!anchor) throw new Error(anchorError(row, action));
            if (seatTaken(anchor, char)) throw new Error('这张椅子Ta正在用，先换一张椅子吧。');
            if (action === 'Hug') {
                const charAnchor = H.Rooms.anchor(row.placement, 'Hug', 'char', row.item);
                const done = () => {
                    try { H.Actions?.end('char', 'finished', '正在陪你拥抱'); } catch (error) { options.onNotice(error.message, true); return; }
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
        function cancelShared() {
            for (const actor of actors) if (actor.sharedInteraction) {
                actor.sharedInteraction = false;
                if (actor.onStairs) continue;
                actor.path = []; actor.destination = null; standUp(actor);
            }
        }
        function interactPair(id, action, finish) {
            if (surveying() || overview() || changingFloor) return false;
            const requested = findRow(id), party = ['user','char'].map(who => actors.find(a => a.who === who));
            if (!requested || party.some(a => !a?.root.visible)) throw Error('先和Ta来到同一层，再一起使用。');
            const shared = H.Rooms.sharedAnchors(furniture, requested, action);
            if (!shared) throw Error('这里需要两个合适的位置，请给彼此留出座位。');
            const blocks = obstacles(), size = navigationSize(), routes = [], token = generation;
            // Validate both approaches before either person starts walking.
            for (const [i, actor] of party.entries()) {
                if (!standUp(actor)) throw Error('家具旁没有起身空间，请先留出通道。');
                const anchor = shared.anchors[i], seat = furniture.find(r => r.placement.id === anchor.seatId) || shared.row;
                const radius = actor.navigationRadius || .18;
                const approach = H.Rooms.approaches(seat.placement, radius)
                    .sort((a,b) => Math.hypot(a.x-anchor.x,a.z-anchor.z)-Math.hypot(b.x-anchor.x,b.z-anchor.z))
                    .find(p => routes.every(r => Math.hypot(r.x-p.x,r.z-p.z) > .65) && H.Animation.path(actor.root.position,p,blocks,size,radius).length);
                if (!approach) throw Error('其中一个位置走不过去，请给家具两边留出通道。');
                routes.push(approach);
            }
            let arrived = 0;
            party.forEach((actor,i) => {
                actor.sharedInteraction = true; actor.path = []; actor.destination = null;
                H.Animation.walk(actor, {...routes[i],action:'Idle'},blocks,size,() => {
                    if (disposed || token !== generation || !party.every(a => a.sharedInteraction)) return;
                    if (++arrived !== party.length) return;
                    party.forEach((a,n) => { a.area = shared.row.area; H.Characters.pose(a,action,shared.anchors[n]); });
                    if (finish?.() === false) cancelShared();
                });
            });
            return true;
        }
        function occupied(row, action, actor) {
            const anchor = actor?.destination?.anchor || actor?.anchor;
            if (!actor?.root.visible || !anchor || action === 'Hug' || row.item.type === 'television') return false;
            if ((anchor.seatId || anchor.placementId) !== row.placement.id && anchor.placementId !== row.placement.id) return false;
            // A couch can host two seated people, but lying down uses its full
            // width. Reserve destinations as well as completed poses.
            return row.item.positions.length === 1 || (row.item.type === 'sofa' && (anchor.lying || ['Lie', 'Sleep'].includes(action)));
        }
        function seatTaken(anchor, actor) {
            return !!anchor.seatId && !!actor?.root.visible && H.Rooms.seatConflict(anchor, actor.destination?.anchor || actor.anchor);
        }
        function reservations(actor) { return actors.filter(a => a !== actor && a.root.visible).map(a => a.destination?.anchor || a.anchor).filter(Boolean); }
        function anchorError(row, action) { return action === 'Watch' ? '电视前没有可用的座位，请留出朝向屏幕的沙发或椅子。' : '先在桌前摆好朝向桌面的椅子，再使用它。'; }
        function emote(action) {
            if (changingFloor) return;
            H.Interactions?.cancel();
            const user = actors.find(a => a.who === 'user'); if (!user) return;
            user.path = []; H.Characters.pose(user, action, user.anchor);
            const char = actors.find(a => a.who === 'char');
            if (char?.root.visible && char.action !== 'Sleep') { char.head.rotation.y = 0.3; }
        }
        function resetCamera() { view.reset(); if (villa && view.stats().mode==='isometric') { const n = viewedLevel===null?offset(room.id):inspection?.plan.nodes[0];if(n)view.focus(n.x,n.z); } }
        function setWalls(mode) { if(!['full','hidden','cutaway'].includes(mode))throw Error('未知墙体模式。');wallMode=mode;renderer.shadowMap.needsUpdate=true; }
        function clearInspection(restore=true) {
            if(wholeFloor&&view.stats().mode==='dollhouse')camera=view.viewpoint('isometric');
            surveyToken++;inspecting=false;viewedLevel=null;H.Shapes.disposeGeometry(inspection?.group);inspection=null;
            if(wholeActors){for(const actor of actors)if(actor.root.parent===wholeActors)roomGroup?.add(actor.root);wholeActors.removeFromParent();wholeActors=null;}
            H.Shapes.disposeGeometry(wholeFloor?.group);wholeFloor=null;
            if(restore&&surveySaved)camera=view.restore(surveySaved);surveySaved=null;
            if(roomGroup)roomGroup.visible=view.stats().mode!=='exterior';if(cutawayGroup)cutawayGroup.visible=false;lastLighting=-Infinity;
        }
        async function inspectionFor(level) {
            if(inspection?.plan.level===level)return inspection;
            const token=++surveyToken,gen=generation;inspecting=true;options.onView?.();
            try{
                const staged=await H.FloorView.load(level,materials,H.State.home(),()=>!disposed&&token===surveyToken&&gen===generation);
                if(disposed||token!==surveyToken||gen!==generation){H.Shapes.disposeGeometry(staged.group);throw Error('楼层查看已取消。');}
                H.Shapes.disposeGeometry(inspection?.group);inspection=staged;scene.add(staged.group);staged.group.visible=false;assetQuality.apply(staged.group,profile);return staged;
            }finally{if(token===surveyToken){inspecting=false;options.onView?.();}}
        }
        async function browseFloor(delta) {
            if(!villa||changingFloor||buildMode||inspecting)throw Error('先结束装修或楼梯行走，再查看楼层。');
            const level=(viewedLevel??villa.level)+delta;if(!Number.isInteger(level)||level<0||level>=H.Villa.levelCount)return false;
            if(overview())await setViewpoint('isometric');
            if(level===villa.level){clearInspection();applyQuality();options.onView?.();return true;}
            const staged=await inspectionFor(level);
            if(!surveySaved){if(view.stats().mode!=='isometric')camera=view.viewpoint('isometric');surveySaved=view.snapshot();}
            viewedLevel=level;roomGroup.visible=false;staged.group.visible=true;view.room(staged.plan.size,{...staged.plan.nodes[0],y:staged.plan.y});view.step(0,true);camera=view.active();lastLighting=-Infinity;applyQuality();options.onView?.();return true;
        }
        async function setViewpoint(mode) {
            if(changingFloor||buildMode)throw Error('先完成楼梯行走或结束装修，再切换视角。');
            if(!['isometric','first','third','exterior','dollhouse'].includes(mode))throw Error('未知视角。');
            const modeToken=++viewToken;
            clearInspection();
            const user=actors.find(a=>a.who==='user');if(user)view.follow({eye:H.Characters.geometry(user).head,yaw:user.root.rotation.y,lookAt:offset(room.id)});
            if(mode==='exterior'){
                if(!villa)throw Error('整栋外观仅在别墅中使用。');
                if(!exteriorGroup){const staged=H.Architecture.exterior(materials,H.State.home()),gen=generation;staged.visible=false;try{await H.Garden.populate(staged,materials,()=>!disposed&&gen===generation&&modeToken===viewToken,H.State.home());}catch(e){H.Shapes.disposeGeometry(staged);throw e;}if(disposed||gen!==generation||modeToken!==viewToken){H.Shapes.disposeGeometry(staged);throw Error('视角切换已取消。');}exteriorGroup=staged;scene.add(staged);assetQuality.apply(staged,profile);}
                camera=view.viewpoint(mode,new T.Box3().setFromObject(exteriorGroup));roomGroup.visible=false;exteriorGroup.visible=true;
            }else if(mode==='dollhouse'){
                if(!villa)throw Error('整栋剖面仅在别墅中使用。');
                const staged=await inspectionFor(villa.level?0:1);
                if(modeToken!==viewToken||disposed)throw Error('视角切换已取消。');
                const gen=generation;let current;
                try{current=await H.FloorView.load(villa.level,materials,H.State.home(),()=>!disposed&&gen===generation&&modeToken===viewToken);}catch(e){if(!disposed&&modeToken===viewToken)clearInspection();throw e;}
                if(modeToken!==viewToken||disposed){H.Shapes.disposeGeometry(current.group);throw Error('视角切换已取消。');}
                H.FloorView.cutaway(staged);H.FloorView.cutaway(current);wholeFloor=current;scene.add(current.group);
                if(!cutawayGroup){cutawayGroup=H.Architecture.exterior(materials,H.State.home(),true);scene.add(cutawayGroup);}
                if(exteriorGroup)exteriorGroup.visible=false;roomGroup.visible=false;staged.group.visible=true;cutawayGroup.visible=true;
                wholeActors=new T.Group();scene.add(wholeActors);for(const actor of actors)wholeActors.add(actor.root);
                const bounds=new T.Box3().setFromObject(cutawayGroup);bounds.union(new T.Box3().setFromObject(current.group));bounds.union(new T.Box3().setFromObject(staged.group));
                camera=view.viewpoint(mode,bounds);
            }else{camera=view.viewpoint(mode);if(roomGroup)roomGroup.visible=true;if(exteriorGroup)exteriorGroup.visible=false;}
            lastLighting=-Infinity;renderer.shadowMap.needsUpdate=true;applyQuality();options.onView?.();return mode;
        }
        function clearDraft() {
            draftToken++; H.Shapes.disposeGeometry(preview); H.Shapes.disposeGeometry(marker); preview = null; marker = null; draft = null;
            furniture.forEach(row => { row.model.visible = true; });
        }
        function refreshDraft() {
            if (!draft) return;
            preview?.position.set(...worldPosition(draft.position)); if (preview) preview.rotation.y = draft.rotation;
            const e = H.Build.extent(draft);
            if (marker) { marker.position.fromArray(worldPosition([e.x, .1, e.z])); marker.scale.set(e.width + .08, e.depth + .08, 1); }
            let error = ''; try { H.Build.validate(room, H.State.home(), draft); } catch (failure) { error = failure.message; }
            if (marker) marker.material = materials.get('milky_plastic', error ? '#df8f9c' : '#b2d8b1');
            options.onDraft?.({ ...draft, valid: !error, error });
        }
        async function beginDraft(placement) {
            clearDraft(); const token = draftToken, item = H.Furniture.get(placement.furnitureId);
            if (!buildMode || !item) return false;
            draft = { ...placement, position: [...placement.position], rotation: placement.rotation || 0 };
            const original = findRow(draft.id);
            if (original) { original.model.visible = false; const children = H.Build.supported(room, H.State.home(), original.local); for (const row of furniture) if (row.area === room.id && children.some(p => p.id === row.local.id)) row.model.visible = false; }
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
            const point = ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -(draft.position[1] + floorY())), new T.Vector3());
            if (!point) return;
            const origin = offset(room.id);
            draft.position[0] = Math.round((point.x - origin.x) / .1) * .1; draft.position[2] = Math.round((point.z - origin.z) / .1) * .1; refreshDraft();
        }
        function nudgeDraft(dx, dz, relative = false) {
            if (draft && relative) {
                // Screen right/up follow the camera, snapped to the room grid axis closest to that direction.
                const yaw = view.stats().yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw), step = Math.hypot(dx, dz), wx = c * dx + s * dz, wz = -s * dx + c * dz;
                if (Math.abs(wx) >= Math.abs(wz)) { dx = Math.sign(wx) * step; dz = 0; } else { dz = Math.sign(wz) * step; dx = 0; }
            }
            if (draft) { draft.position[0] = Math.round((draft.position[0] + dx) * 10) / 10; draft.position[2] = Math.round((draft.position[2] + dz) * 10) / 10; refreshDraft(); } }
        function rotateDraft() { if (draft) { draft.rotation = (draft.rotation + Math.PI / 2) % (Math.PI * 2); refreshDraft(); } }
        function setBuild(value) { if(value && (view.stats().mode!=='isometric'||surveying()))setViewpoint('isometric');clearDraft();
            if (!value && buildMode && villa && room && room.id !== H.State.home()?.room) { const n = villa.nodes.find(n => n.id === H.State.home().room); if (n) { room = n.room; view.focus(n.x, n.z); roomGroup.userData.interior = H.Interiors.resolve(room, H.State.home()); } }
            buildMode = !!value; renderer.domElement.setAttribute('aria-label', buildMode ? '装修房间，拖动家具移动，双指缩放，使用底部按钮旋转和确认' : '实时3D小屋，拖动探索，双指缩放，点击家具互动'); }
        function dispose() {
            try { H.Interactions?.cancel(); H.Actions?.end('char', 'cancelled', '已离开当前画面'); }
            catch (error) { options.onNotice(error.message, true); }
            if (disposed) return; disposed = true; generation++; viewToken++;cancelAnimationFrame(raf); observer.disconnect();
            clearInspection(false);H.Shapes.disposeGeometry(cutawayGroup);lampLights.forEach(l=>l.removeFromParent());
            clearDraft();
            actors.forEach(actor => { actor.released = true; }); gpuTimer.dispose(); assetQuality.dispose(); H.Shapes.disposeGeometry(roomGroup); H.Shapes.disposeGeometry(exteriorGroup); H.Shapes.disposeGeometry(ground); materials.dispose(); sun.shadow.dispose(); dustGeometry.dispose(); dust.material.dispose();
            renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); scene.clear(); roomGroup = null; actors = []; furniture = []; lampLights = []; pointers.clear();
        }
        const contextLost = event => { if (disposed) return; event.preventDefault(); contextUnavailable = true; cancel(); options.onNotice('3D 显示暂时中断，点重试重新进入小屋。'); H.UI?.showSceneError('设备暂时释放了3D画面，请重试。'); };
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        async function chooseMeal(id) {
            if (!Object.hasOwn(H.Foods.menus, id)) throw Error('餐点选项无效。');
            const token = generation, mealToken = ++mealGeneration, charId = H.State.load().activeCharId, staged = [];
            try {
                for (const row of furniture.filter(r => H.Foods.supports(r.item))) staged.push({ row, group: await H.Foods.create(row.item, id) });
                if (disposed || token !== generation || mealToken !== mealGeneration) throw Error('房间或餐点已切换，请在当前房间重新选择。');
                H.State.withHome((home, data) => { if (data.activeCharId !== charId) throw Error('同住角色已切换，这次餐点没有保存。'); home.mealId = id; });
            } catch (error) { staged.forEach(({ group }) => H.Shapes.disposeGeometry(group)); throw error; }
            for (const { row, group } of staged) H.Shapes.disposeGeometry(H.Foods.attach(row.model, group));
            actors.forEach(a => a.eatTool?.getObjectByName('spoon-food').material.color.set(H.Foods.menus[id].bite));
            applyQuality(); return true;
        }
        function setQuality(mode) { H.RenderQuality.save(mode); quality.setMode(mode); applyQuality(); }
        return { load, syncArea, syncKeepsakes, refreshPhoto, focusBuildArea, viewCenter, dispose, navigate, getFurniture, cancelInteraction: () => { const user = actors.find(a => a.who === 'user'); if (user && !user.onStairs) { if (user.path.length && user.action === 'Walk') H.Characters.pose(user, 'Idle'); user.path = []; user.destination = null; } }, stopAction: () => { if(changingFloor)return false; const user=actors.find(a=>a.who==='user'); if(!user)return false; user.path=[];user.destination=null; const stood = standUp(user); H.Interactions?.cancel(stood ? 'finished' : 'blocked', stood ? '已主动结束动作' : '家具旁没有起身空间'); return stood; }, browseFloor, setWalls, setViewpoint, walkTo: walkUser, canNavigate: id => !!villa?.nodes.some(n => n.id === id), interact, interactPair, cancelShared, emote, resetCamera, setCharActivity, setBuild, beginDraft, moveDraft, nudgeDraft, rotateDraft, clearDraft, setQuality, chooseMeal, camera: view, draft: () => draft ? JSON.parse(JSON.stringify(draft)) : null, project: (x, z, world = false) => { const p = new T.Vector3(...(world ? [x, floorY(), z] : worldPosition([x, 0, z]))).project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 }; }, furniture: () => furniture.filter(r => !villa || r.area === room.id).map(r => villa ? { ...r, placement: r.local } : r), worldFurniture: () => furniture, zoom: delta => view.zoom(Math.exp(delta)), stats: () => ({ ...renderer.info.memory, renderedView, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, quality: quality.current(), texturesBudget: assetQuality.stats(), resolution: { cssWidth: host.clientWidth, cssHeight: host.clientHeight, width: renderer.domElement.width, height: renderer.domElement.height, pixelRatio: renderer.getPixelRatio(), antialias: !!renderer.getContext().getContextAttributes()?.antialias }, camera: view.stats(), lighting: { ...lighting, pointLights: lampLights.filter(l=>l.visible).length }, buildMode, actors: actors.map(a => ({ who: a.who, action: a.action, visible: a.root.visible, visual: a.visual, position: { x: a.root.position.x, y: a.root.position.y, z: a.root.position.z }, pose: H.Characters.geometry(a), path: a.path.length })), room: room?.id, villa: villa ? { level: villa.level, viewedLevel: viewedLevel ?? villa.level, levels: H.Villa.levelCount, browsing: surveying(), inspecting, surveyFurniture: inspection?.rows.length || 0, architecture: exteriorGroup?.userData.architecture || null, areas: villa.nodes.map(n => n.id), transitioning: changingFloor, generation, walls:wallMode, wallMeshes:wallFinishes.filter(m=>m.visible).length, doors:doors.map(d=>({name:d.name,angle:d.userData.door.angle})), exterior:view.stats().mode==='exterior' } : null }) };
    }
    H.Scene = { create };
})(window.ByndHome3D);
