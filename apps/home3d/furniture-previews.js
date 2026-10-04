(function (H) {
    'use strict';
    const cache = new Map(); let session = null;
    function open() {
        if (session) return;
        session = { renderer: null, materials: null, queue: Promise.resolve(), generation: 0, closed: false };
    }
    function close() {
        const old = session; session = null; if (!old) return;
        old.closed = true; old.generation++;
        old.queue.finally(() => { old.materials?.dispose(); old.renderer?.dispose(); old.renderer?.forceContextLoss(); });
    }
    function fill(tray, items) {
        open(); const state = session, generation = ++state.generation;
        for (const item of items) {
            const image = tray.querySelector('[data-preview="' + item.id + '"]');
            if (cache.has(item.id)) { image.src = cache.get(item.id); image.classList.add('is-ready'); continue; }
            state.queue = state.queue.then(async () => {
                if (state.closed || generation !== state.generation) return;
                const T = ByndHomeEngine;
                let model;
                try {
                  if (!state.renderer) {
                    state.renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
                    state.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 3)); state.renderer.setSize(128, 128);
                    state.renderer.outputColorSpace = T.SRGBColorSpace; state.renderer.toneMapping = T.ACESFilmicToneMapping; state.renderer.toneMappingExposure = 1.12;
                    state.materials = H.Materials.create('warm');
                  }
                    model = await H.Furniture.load(item, state.materials);
                    if (state.closed || generation !== state.generation) return;
                    const scene = new T.Scene(); scene.add(model, new T.HemisphereLight('#fff7eb', '#a4aaa0', 2.5));
                    const key = new T.DirectionalLight('#fff6e8', 3); key.position.set(-3, 5, 4); scene.add(key);
                    const bounds = new T.Box3().setFromObject(model), center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
                    const span = Math.max(size.x, size.y, size.z) * 1.38, camera = new T.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, .01, 40);
                    camera.position.copy(center).add(new T.Vector3(3.4, 2.8, 4.2)); camera.lookAt(center);
                    state.renderer.render(scene, camera);
                    const url = state.renderer.domElement.toDataURL('image/png'); cache.set(item.id, url);
                    while (cache.size > 48) cache.delete(cache.keys().next().value);
                    if (image.isConnected) { image.src = url; image.classList.add('is-ready'); }
                } catch (_) {
                    if (image.isConnected) { image.remove(); const card = tray.querySelector('[data-furniture="' + item.id + '"]'); card?.classList.add('preview-unavailable'); }
                } finally { if (model) H.Shapes.disposeGeometry(model); }
            });
        }
    }
    H.FurniturePreviews = { fill, close };
})(window.ByndHome3D);
