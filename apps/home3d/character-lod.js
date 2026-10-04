(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ByndHomeCharacterLOD = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
    'use strict';
    const levels = Object.freeze([
        Object.freeze({ name: 'near', minPixels: 500 }),
        Object.freeze({ name: 'middle', minPixels: 220 }),
        Object.freeze({ name: 'far', minPixels: 0 })
    ]);
    function select(pixels, current = null) {
        if (typeof pixels !== 'number' || Number.isNaN(pixels) || pixels < 0) throw new Error('角色投影高度无效。');
        const previous = levels.findIndex(level => level.name === current);
        if (current !== null && previous < 0) throw new Error('未知的角色细节档位。');
        if (previous < 0) return levels.find(level => pixels >= level.minPixels).name;
        // A 12% deadband prevents alternating downloads near a threshold.
        for (let index = 0; index < previous; index++) if (pixels >= levels[index].minPixels * 1.12) return levels[index].name;
        if (pixels >= levels[previous].minPixels * .88) return levels[previous].name;
        for (let index = previous + 1; index < levels.length; index++) if (pixels >= levels[index].minPixels * .88) return levels[index].name;
        return 'far';
    }
    function projectedHeight(box, camera, viewportHeight, T) {
        if (!Number.isFinite(viewportHeight) || viewportHeight <= 0 || box.isEmpty()) throw new Error('无法计算角色在画面中的大小。');
        camera.updateMatrixWorld(true);
        const forward = camera.getWorldDirection(new T.Vector3()), origin = camera.getWorldPosition(new T.Vector3());
        let min = Infinity, max = -Infinity;
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            const point = new T.Vector3(x, y, z);
            // When the camera enters the bounds, use maximum detail instead of an invalid projection.
            if (camera.isPerspectiveCamera && point.clone().sub(origin).dot(forward) <= camera.near) return Infinity;
            point.project(camera);
            if (!Number.isFinite(point.y)) throw new Error('角色投影计算失败。');
            min = Math.min(min, point.y); max = Math.max(max, point.y);
        }
        return Math.max(0, (max - min) * viewportHeight / 2);
    }
    return { levels, select, projectedHeight };
});
