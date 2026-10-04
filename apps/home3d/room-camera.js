(function (H) {
    'use strict';
    function create(camera, T) {
        const origin = { x: 0, y: .85, z: -.25, yaw: .68, pitch: .62, zoom: 1 }, state = { ...origin }, desired = { ...origin };
        let width = 1, height = 1, roomSize = [6.6, 5.6];
        function apply() {
            const halfH = 3.35 / state.zoom, halfW = halfH * width / height;
            camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
            camera.position.set(state.x + Math.sin(state.yaw) * Math.cos(state.pitch) * 16, state.y + Math.sin(state.pitch) * 16, state.z + Math.cos(state.yaw) * Math.cos(state.pitch) * 16);
            camera.lookAt(state.x, state.y, state.z); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        }
        function resize(w, h) { width = Math.max(1, w); height = Math.max(1, h); apply(); }
        function step(dt, immediate = false) {
            const blend = immediate ? 1 : 1 - Math.exp(-Math.max(0, dt) * 14); let moving = false;
            for (const key of Object.keys(state)) { const difference = desired[key] - state[key]; if (Math.abs(difference) > .0001) moving = true; state[key] += difference * blend; }
            apply(); return moving;
        }
        function pan(dx, dy) {
            const right = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
            const sx = -dx * (camera.right - camera.left) / width, sy = dy * (camera.top - camera.bottom) / height;
            desired.x = Math.max(-roomSize[0] / 2, Math.min(roomSize[0] / 2, desired.x + right.x * sx + up.x * sy));
            desired.z = Math.max(-roomSize[1] / 2, Math.min(roomSize[1] / 2, desired.z + right.z * sx + up.z * sy));
        }
        function zoom(factor) { if (!Number.isFinite(factor) || factor <= 0) return; desired.zoom = Math.max(.5, Math.min(3.5, desired.zoom * factor)); }
        function rotate(dx, dy) { desired.yaw = Math.max(-.18, Math.min(1.48, desired.yaw - dx * .007)); desired.pitch = Math.max(.38, Math.min(.98, desired.pitch + dy * .003)); }
        function reset(immediate = false) { Object.assign(desired, origin); if (immediate) step(0, true); }
        function room(size) { roomSize = [...size]; reset(); }
        function focus(x, z) { desired.x = Math.max(-roomSize[0] / 2, Math.min(roomSize[0] / 2, x)); desired.z = Math.max(-roomSize[1] / 2, Math.min(roomSize[1] / 2, z)); }
        return { resize, step, pan, zoom, rotate, reset, room, focus, stats: () => ({ ...state, desired: { ...desired }, frustum: { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom }, rotationReady: true }) };
    }
    H.RoomCamera = { create };
})(window.ByndHome3D);
