(function (H) {
    'use strict';
    const byteCache = new Map();
    const pendingBuffers = new Map(), scriptReceivers = new Map();
    let cachedBytes = 0;
    function get(id) {
        const item = H.catalogs.furnitureCatalog.items.find(item => item.id === id);
        if (!item) return null;
        const definition = H.catalogs.furnitureCatalog.types?.[item.type] || {};
        return { ...definition, ...item, actions: item.actions || definition.actions || [], positions: item.positions || definition.positions || [] };
    }
    // This contract is shared by the geometry and character anchors. Seat heights
    // are the top of the cushion, never an arbitrary character-root subtraction.
    function support(item) {
        if (item.type === 'bed') { const h = item.seatHeight ?? .65; return { baseHeight: h, seatHeight: h + .35, sleepHeight: h + .24 }; }
        if (['sofa', 'chair'].includes(item.type)) return { seatHeight: .62, seatDepth: .20, seatFront: item.footprint[1] / 2 + .025 };
        return { seatHeight: item.positions?.[0]?.[1] || .45, seatDepth: item.positions?.[0]?.[2] || .08, seatFront: item.footprint[1] / 2 + .02 };
    }
    function readBuffer(url) {
        if (location.protocol !== 'file:') return fetch(url).then(response => { if (!response.ok) throw new Error('家具资源读取失败：' + response.status); return response.arrayBuffer(); });
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest(); xhr.open('GET', url); xhr.responseType = 'arraybuffer'; xhr.timeout = 20000;
            xhr.onload = () => xhr.response?.byteLength && (xhr.status === 0 || xhr.status === 200) ? resolve(xhr.response) : reject(new Error('本地家具资源无法读取。'));
            xhr.onerror = xhr.ontimeout = () => reject(new Error('家具读取失败，请重新进入小屋。')); xhr.send();
        });
    }
    async function buffer(model) {
        if (byteCache.has(model)) { const cached = byteCache.get(model); byteCache.delete(model); byteCache.set(model, cached); return cached; }
        if (pendingBuffers.has(model)) return pendingBuffers.get(model);
        const pending = (async () => {
            // Ordinary file:// pages cannot XHR sibling files. Classic scripts can
            // load the same reviewed bytes without relaxing browser security.
            const result = location.protocol === 'file:' ? await scriptBuffer(model) : await readBuffer('assets/home3d/furniture/' + model);
            const header = new DataView(result);
            if (result.byteLength < 20 || header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== result.byteLength) throw new Error('家具模型资源损坏，请重新获取完整的小屋资源。');
            byteCache.set(model, result); cachedBytes += result.byteLength;
            while (cachedBytes > 3 * 1024 * 1024 && byteCache.size > 1) { const key = byteCache.keys().next().value; cachedBytes -= byteCache.get(key).byteLength; byteCache.delete(key); }
            return result;
        })();
        pendingBuffers.set(model, pending);
        try { return await pending; } finally { pendingBuffers.delete(model); }
    }
    function scriptBuffer(model) {
        if (!/^[a-zA-Z0-9_-]+\.glb$/.test(model)) return Promise.reject(new Error('家具资源名称无效。'));
        return new Promise((resolve, reject) => {
            const node = document.createElement('script'); let timer;
            const finish = (error, bytes) => {
                clearTimeout(timer); scriptReceivers.delete(model); node.onload = node.onerror = null; node.remove();
                if (error) reject(error); else resolve(bytes);
            };
            scriptReceivers.set(model, encoded => {
                try { const raw = atob(encoded), bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i); finish(null, bytes.buffer); }
                catch (_) { finish(new Error('本地家具数据损坏，请重新获取完整的小屋资源。')); }
            });
            const version = document.querySelector('script[src*="home3d/home3d.js"]')?.src.split('?')[1] || '';
            node.src = 'assets/home3d/furniture/' + model + '.js' + (version ? '?' + version : '');
            node.onerror = () => finish(new Error('本地家具资源缺失，请确认 assets/home3d/furniture 文件夹完整。'));
            node.onload = () => { if (scriptReceivers.has(model)) finish(new Error('本地家具数据不完整。')); };
            timer = setTimeout(() => finish(new Error('本地家具加载超时，请重试。')), 20000);
            document.head.appendChild(node);
        });
    }
    function registerBuffer(model, encoded) { scriptReceivers.get(model)?.(encoded); }
    function frame(materials) {
        const T = ByndHomeEngine, root = new T.Group(), S = H.Shapes;
        S.rounded(root, [0.72, 0.62, 0.095], [0, 0.31, 0], materials.get('soft_wood'), 0.05);
        S.rounded(root, [0.6, 0.5, 0.025], [0, 0.31, 0.055], materials.get('paper'), 0.02);
        // Two little hand-made hearts are visible until a real shared photo is chosen.
        const heart = new T.Shape(); heart.moveTo(0, 0); heart.bezierCurveTo(-0.22, 0.15, -0.22, 0.35, 0, 0.22); heart.bezierCurveTo(0.22, 0.35, 0.22, 0.15, 0, 0);
        const mesh = new T.Mesh(new T.ShapeGeometry(heart), materials.get('rose')); mesh.position.set(0, 0.17, 0.073); root.add(mesh); return root;
    }
    function star(materials) {
        const T = ByndHomeEngine, shape = new T.Shape();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.08 : 0.17, a = Math.PI / 2 + i * Math.PI / 5, x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) shape.lineTo(x, y); else shape.moveTo(x, y); }
        shape.closePath(); const root = new T.Group();
        const mesh = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.025, bevelThickness: 0.025 }), materials.get('pastel_ceramic', '#ead1a0'));
        mesh.position.set(0, 0.22, 0); mesh.castShadow = true; root.add(mesh);
        H.Shapes.rounded(root, [0.35, 0.09, 0.25], [0, 0.04, 0.04], materials.get('soft_wood')); return root;
    }
    async function load(item, materials) {
        if (item.procedural || ['bed', 'sofa', 'chair'].includes(item.type) || ['nightstand_01', 'table_lamp_01'].includes(item.id)) return H.FurnitureVisuals.create(item, materials);
        if (!item.model) return item.type === 'frame' ? frame(materials) : star(materials);
        const T = ByndHomeEngine;
        const gltf = await new T.GLTFLoader().parseAsync(await buffer(item.model), '');
        const model = gltf.scene, root = new T.Group();
        // Normalize the imported pack's units and pivot; dimensions are catalog-owned.
        const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
        const scale = item.width / Math.max(size.x, 0.0001);
        model.scale.multiplyScalar(scale);
        if (item.type === 'bed') model.scale.z *= item.footprint[1] / Math.max(size.z * scale, 0.0001);
        if (item.height) model.scale.y *= item.height / Math.max(size.y * scale, 0.0001);
        model.position.set(-center.x * model.scale.x, -bounds.min.y * model.scale.y, -center.z * model.scale.z);
        if (['television', 'computer'].includes(item.type)) { const pivot = new T.Group(); pivot.add(model); pivot.rotation.y = Math.PI; root.add(pivot); }
        else root.add(model);
        if (materials.disposed()) {
            root.traverse(node => { for (const m of (Array.isArray(node.material) ? node.material : [node.material])) { for (const value of Object.values(m || {})) if (value?.isTexture) value.dispose(); m?.dispose(); } });
            H.Shapes.disposeGeometry(root); throw new Error('房间已离开。');
        }
        materials.apply(root, item);
        if (item.type === 'table') {
            for (const x of [-0.34, 0.34]) {
                const cup = new T.Mesh(new T.CylinderGeometry(0.075, 0.06, 0.14, 18), materials.get(x < 0 ? 'rose' : 'sage'));
                cup.position.set(x, 0.5, 0.06); cup.castShadow = true; root.add(cup);
                const tea = new T.Mesh(new T.CylinderGeometry(0.062, 0.062, 0.006, 18), materials.get('soft_wood', '#92704e')); tea.position.set(x, 0.573, 0.06); root.add(tea);
                const handle = new T.Mesh(new T.TorusGeometry(0.048, 0.013, 6, 16), materials.get(x < 0 ? 'rose' : 'sage')); handle.position.set(x + 0.079, 0.5, 0.06); root.add(handle);
            }
            H.Shapes.sphere(root, [0.085, 0.12, 0.085], [0, 0.5, -0.12], materials.get('pastel_ceramic'));
            H.Shapes.rounded(root, [0.018, 0.18, 0.018], [0, 0.67, -0.12], materials.get('sage'), 0.006);
            for (const [x, z] of [[-0.04, 0], [0.04, 0], [0, -0.04], [0, 0.04]]) H.Shapes.sphere(root, [0.045, 0.032, 0.045], [x, 0.77, -0.12 + z], materials.get('rose'));
            H.Shapes.sphere(root, [0.028, 0.025, 0.028], [0, 0.79, -0.12], materials.get('paper'));
        }
        return root;
    }
    async function setPhoto(root, url, guard) {
        if (!url || !/^(data:image\/|https?:\/\/)/.test(url)) return;
        const T = ByndHomeEngine;
        const texture = await new T.TextureLoader().loadAsync(url);
        if (guard && !guard()) { texture.dispose(); return; }
        texture.colorSpace = T.SRGBColorSpace;
        // Cover-crop rather than stretching portrait photos across the frame.
        const image = texture.image, ratio = image.width / image.height, target = 0.6 / 0.5;
        if (ratio > target) { texture.repeat.x = target / ratio; texture.offset.x = (1 - texture.repeat.x) / 2; }
        else { texture.repeat.y = ratio / target; texture.offset.y = (1 - texture.repeat.y) / 2; }
        const material = new T.MeshBasicMaterial({ map: texture });
        const imagePlane = new T.Mesh(new T.PlaneGeometry(0.59, 0.49), material); imagePlane.position.set(0, 0.31, 0.074);
        imagePlane.userData.ownedTexture = texture; imagePlane.userData.ownedMaterial = material; root.add(imagePlane);
    }
    H.Furniture = { get, support, load, readBuffer, setPhoto, registerBuffer, cacheInfo: () => ({ models: byteCache.size, bytes: cachedBytes }) };
})(window.ByndHome3D);
