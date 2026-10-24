(function (H) {
    'use strict';
    function create(camera, T) {
        const overview = mode => ['exterior', 'dollhouse'].includes(mode);
        const orbit = camera, perspective = new T.PerspectiveCamera(65, 1, .04, 70);
        let mode = 'isometric', subject = null, saved = null, overviewBounds = null, lookYaw = 0, lookPitch = -.08, distance = 2.6, goalYaw = 0, goalPitch = -.08, velYaw = 0, velPitch = 0, lastTurn = 0, coastYaw = 0, coastPitch = 0;
        // Blend between viewpoints: the previous camera pose fades into the new one.
        const fromPos = new T.Vector3(), fromQuat = new T.Quaternion(), toQuat = new T.Quaternion(), tmp = new T.Vector3();
        let fromFov = 65, shift = 1, shiftFrom = false;
        const origin = { x: 0, y: .85, z: -.25, yaw: .68, pitch: .62, zoom: 1 }, state = { ...origin }, desired = { ...origin };
        let width = 1, height = 1, roomSize = [6.6, 5.6];
        const ease = t => t * t * (3 - 2 * t);
        function blendPose() {
            if (!shiftFrom || shift >= 1) return;
            const k = ease(shift); camera.updateMatrixWorld(true); toQuat.copy(camera.quaternion);
            tmp.copy(camera.position); camera.position.lerpVectors(fromPos, tmp, k);
            camera.quaternion.slerpQuaternions(fromQuat, toQuat, k); camera.fov = fromFov + (camera.fov - fromFov) * k;
        }
        function remember() { shiftFrom = camera.isPerspectiveCamera === true; if (!shiftFrom) return; fromPos.copy(camera.position); fromQuat.copy(camera.quaternion); fromFov = camera.fov; shift = 0; }
        function apply() {
            if (mode === 'first' || mode === 'third') {
                camera = perspective; camera.aspect = width / height;
                if (subject) {
                    const yaw = subject.yaw + lookYaw, direction = new T.Vector3(Math.sin(yaw)*Math.cos(lookPitch), Math.sin(lookPitch), Math.cos(yaw)*Math.cos(lookPitch));
                    const eye = new T.Vector3(subject.eye.x, subject.eye.y + .09, subject.eye.z);
                    if (mode === 'first') { camera.position.copy(eye); camera.lookAt(eye.clone().add(direction)); }
                    else { camera.position.copy(eye).addScaledVector(direction,-distance); camera.position.y += .6; camera.lookAt(eye); }
                }
                blendPose();camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return;
            }
            if (mode === 'interior') {
                camera = perspective; camera.aspect = width / height;
                const yaw = state.yaw - .86, pitch = .09 + (state.pitch - .62) * .45, radius = 3.1 / state.zoom;
                const target = new T.Vector3(state.x - .4, state.y + .32, state.z - .35);
                camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * radius, target.y + Math.sin(pitch) * radius, target.z + Math.cos(yaw) * Math.cos(pitch) * radius);
                camera.lookAt(target); blendPose(); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); return;
            }
            camera = orbit;
            if (overview(mode) && overviewBounds) {
                const size = overviewBounds.getSize(new T.Vector3()), projectedW = Math.abs(Math.cos(state.yaw))*size.x + Math.abs(Math.sin(state.yaw))*size.z;
                const projectedH = Math.sin(state.pitch)*(Math.abs(Math.sin(state.yaw))*size.x+Math.abs(Math.cos(state.yaw))*size.z)+Math.cos(state.pitch)*size.y;
                const fit = Math.min(6.7*width/height/(projectedW*1.12),6.7/(projectedH*1.12));
                state.zoom = fit * desired.zoom;
            }
            const halfH = 3.35 / state.zoom, halfW = halfH * width / height;
            camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
            camera.position.set(state.x + Math.sin(state.yaw) * Math.cos(state.pitch) * 16, state.y + Math.sin(state.pitch) * 16, state.z + Math.cos(state.yaw) * Math.cos(state.pitch) * 16);
            camera.lookAt(state.x, state.y, state.z); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        }
        function resize(w, h) { width = Math.max(1, w); height = Math.max(1, h); apply(); }
        function step(dt, immediate = false) {
            const blend = immediate ? 1 : 1 - Math.exp(-Math.max(0, dt) * 14); let moving = false;
            if (mode === 'first' || mode === 'third') {
                // Release coasting: the last drag speed fades out instead of stopping dead.
                const now = Date.now();
                if (coastYaw || coastPitch) { const fade = Math.exp(-Math.max(0, dt) * 5); goalYaw += coastYaw * dt * 60; goalPitch = Math.max(-1.1, Math.min(.9, goalPitch + coastPitch * dt * 60)); coastYaw *= fade; coastPitch *= fade; if (Math.abs(coastYaw) < .0004) coastYaw = 0; if (Math.abs(coastPitch) < .0004) coastPitch = 0; }
                const look = immediate ? 1 : 1 - Math.exp(-Math.max(0, dt) * 20), dy = goalYaw - lookYaw, dp = goalPitch - lookPitch;
                if (Math.abs(dy) > .0003 || Math.abs(dp) > .0003) moving = true;
                lookYaw += dy * look; lookPitch += dp * look; void now;
                if (coastYaw || coastPitch) moving = true;
            }
            if (shift < 1) { shift = immediate ? 1 : Math.min(1, shift + Math.max(0, dt) / .55); moving = true; }
            for (const key of Object.keys(state)) { if(overview(mode)&&key==='zoom')continue; const difference = desired[key] - state[key]; if (Math.abs(difference) > .0001) moving = true; state[key] += difference * blend; }
            apply(); return moving;
        }
        function pan(dx, dy) {
            if(['interior','first','third','exterior','dollhouse'].includes(mode)){rotate(dx,dy);return;}
            const right = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
            const sx = -dx * (camera.right - camera.left) / width, sy = dy * (camera.top - camera.bottom) / height;
            desired.x = Math.max(-roomSize[0] / 2, Math.min(roomSize[0] / 2, desired.x + right.x * sx + up.x * sy));
            desired.z = Math.max(-roomSize[1] / 2, Math.min(roomSize[1] / 2, desired.z + right.z * sx + up.z * sy));
        }
        function zoom(factor) { if (!Number.isFinite(factor) || factor <= 0) return; if(mode==='first'){perspective.fov=Math.max(45,Math.min(85,perspective.fov/factor));apply();return;}if(mode==='third'){distance=Math.max(.6,Math.min(4,distance/factor));return;}desired.zoom = Math.max(mode==='interior'?.9:.5, Math.min(mode==='interior'?1.8:3.5, desired.zoom * factor)); }
        function rotate(dx, dy) { if(mode==='first'||mode==='third'){const ay=-dx*.0062,ap=dy*.0048;goalYaw+=ay;goalPitch=Math.max(-1.1,Math.min(.9,goalPitch+ap));velYaw=velYaw*.5+ay*.5;velPitch=velPitch*.5+ap*.5;lastTurn=Date.now();coastYaw=coastPitch=0;return;}desired.yaw = Math.max(overview(mode)?-Math.PI:-.18, Math.min(overview(mode)?Math.PI:1.48, desired.yaw - dx * .007)); desired.pitch = Math.max(.38, Math.min(.98, desired.pitch + dy * .003)); }
        function reset(immediate = false) { if(mode==='first'||mode==='third'){goalYaw=0;goalPitch=-.08;coastYaw=coastPitch=0;distance=2.6;perspective.fov=65;}else if(overview(mode)){desired.zoom=1;desired.yaw=.68;desired.pitch=.62;}else Object.assign(desired, origin); if (immediate) step(0, true); }
        function room(size, center) { roomSize = [...size]; Object.assign(origin, { x: center?.x || 0, y: (center?.y || 0) + .85, z: center?.z ?? -.25 }); reset(); }
        function focus(x, z) { desired.x = Math.max(-roomSize[0] / 2, Math.min(roomSize[0] / 2, x)); desired.z = Math.max(-roomSize[1] / 2, Math.min(roomSize[1] / 2, z)); if(mode==='interior'&&saved){saved.x=desired.x;saved.z=desired.z;} }
        function viewpoint(next, bounds) {
            if(!['interior','isometric','first','third','exterior','dollhouse'].includes(next))throw Error('未知视角。');
            if(mode==='isometric'&&next!=='isometric')saved={...desired};
            remember();
            mode=next;camera=['interior','first','third'].includes(mode)?perspective:orbit;perspective.fov=mode==='interior'?58:65;
            if(mode==='isometric'&&saved){Object.assign(desired,saved);Object.assign(state,saved);saved=null;}
            if(overview(mode)){overviewBounds=bounds;const center=bounds.getCenter(new T.Vector3());Object.assign(desired,{x:center.x,y:center.y,z:center.z,zoom:1,yaw:.68,pitch:.62});Object.assign(state,desired);}
            lookYaw=mode==='first'&&subject?.lookAt?Math.atan2(subject.lookAt.x-subject.eye.x,subject.lookAt.z-subject.eye.z)-subject.yaw:0;lookPitch=-.08;goalYaw=lookYaw;goalPitch=lookPitch;coastYaw=coastPitch=0;apply();return camera;
        }
        function release() { if ((mode === 'first' || mode === 'third') && Date.now() - lastTurn < 90) { coastYaw = velYaw; coastPitch = velPitch; } velYaw = velPitch = 0; }
        function snapshot() { return { origin: { ...origin }, state: { ...state }, desired: { ...desired }, roomSize: [...roomSize] }; }
        function restore(value) { mode='isometric';camera=orbit;saved=null;Object.assign(origin,value.origin);Object.assign(state,value.state);Object.assign(desired,value.desired);roomSize=[...value.roomSize];apply();return camera; }
        return { resize, step, pan, zoom, rotate, release, reset, room, focus, viewpoint, snapshot, restore, follow: value => {subject=value;}, active:()=>camera, stats: () => ({ ...state, mode, perspective:camera.isPerspectiveCamera===true, eye:camera.position.toArray(), desired: { ...desired }, frustum: { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom }, rotationReady: true }) };
    }
    H.RoomCamera = { create };
})(window.ByndHome3D);
