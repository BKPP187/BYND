(function (H) {
    'use strict';
    function create(themeId) {
        const T = ByndHomeEngine, data = H.catalogs.materialPresets;
        const theme = data.themes[themeId] || data.themes.cream;
        const cache = new Map(), textures = new Map();
        let dead = false;
        function texture(kind) {
            if (textures.has(kind)) return textures.get(kind);
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
            const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(64, 64);
            for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
                const i = (y * 64 + x) * 4;
                const grain = kind === 'wood' ? Math.sin(y * 1.25 + Math.sin(x * 0.16) * 0.5) * 18 : ((x % 3 === 0 ? 1 : -1) + (y % 3 === 0 ? 1 : -1)) * 18;
                pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 128 + grain;
                pixels.data[i + 3] = 255;
            }
            ctx.putImageData(pixels, 0, 0);
            const map = new T.CanvasTexture(canvas); map.wrapS = map.wrapT = T.RepeatWrapping; map.repeat.set(kind === 'wood' ? 2 : 5, kind === 'wood' ? 2 : 5);
            textures.set(kind, map); return map;
        }
        function get(id, color) {
            const key = id + ':' + (color || ''); if (cache.has(key)) return cache.get(key);
            const preset = data.presets[id] || data.presets.milky_plastic;
            const material = new T.MeshStandardMaterial({ color: color || theme.colors[id] || preset.color, roughness: preset.roughness, metalness: preset.metalness, transparent: !!preset.opacity, opacity: preset.opacity || 1, emissive: preset.emissive || '#000000', emissiveIntensity: preset.emissiveIntensity || 0 });
            if (preset.bump) { material.bumpMap = texture(preset.bump); material.bumpScale = preset.bump === 'wood' ? 0.008 : 0.006; }
            cache.set(key, material); return material;
        }
        function role(original, item, index) {
            const name = String(original?.name || '').toLowerCase();
            if (['television', 'computer'].includes(item.type) && /metaldark|metalmedium|screen/.test(name)) return 'screen';
            if (item.type === 'plant' && /wood/.test(name)) return 'pastel_ceramic';
            if (/glass/.test(name)) return 'soft_glass';
            if (/screen|display/.test(name)) return 'screen';
            if (/metal|leg|grey|black/.test(name)) return /leg/.test(name) && item.type === 'sofa' ? 'soft_wood' : 'warm_metal';
            if (/wood|brown/.test(name)) return 'soft_wood';
            if (/cover[135]|comforterlight/.test(name)) return 'sage';
            if (/cover[246]|comforter/.test(name)) return 'rose';
            if (/pages/.test(name)) return 'paper';
            if (/mattress|pillow|sofa|fabric|cushion/.test(name)) return item.type === 'chair' ? 'sage' : 'cream_fabric';
            if (item.type === 'plant') {
                const c = original?.color;
                return c && c.g > c.r * 1.15 ? 'sage' : 'pastel_ceramic';
            }
            if (['television', 'computer'].includes(item.type)) {
                const c = original?.color; return c && Math.max(c.r, c.g, c.b) < 0.18 ? 'screen' : 'milky_plastic';
            }
            return item.materials[index % item.materials.length];
        }
        function apply(root, item) {
            const originals = new Set();
            root.traverse(node => {
                if (!node.isMesh) return;
                const list = Array.isArray(node.material) ? node.material : [node.material];
                const replacements = list.map((original, i) => { originals.add(original); return get(role(original, item, i)); });
                node.material = Array.isArray(node.material) ? replacements : replacements[0];
                node.castShadow = true; node.receiveShadow = true;
            });
            originals.forEach(material => { for (const value of Object.values(material || {})) if (value?.isTexture) value.dispose(); material?.dispose(); });
        }
        function dispose() { dead = true; cache.forEach(material => material.dispose()); textures.forEach(map => map.dispose()); cache.clear(); textures.clear(); }
        return { get, apply, theme, dispose, disposed: () => dead };
    }
    H.Materials = { create };
    H.Shapes = {
        rounded(parent, size, position, material, radius = 0.06) {
            const T = ByndHomeEngine, geometry = new T.RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(n => n / 2)));
            const mesh = new T.Mesh(geometry, material); mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
        },
        sphere(parent, size, position, material) {
            const T = ByndHomeEngine, mesh = new T.Mesh(new T.SphereGeometry(1, 20, 14), material);
            mesh.scale.set(...size); mesh.position.set(...position); mesh.castShadow = true; parent.add(mesh); return mesh;
        },
        disposeGeometry(root) {
            const disposed = new Set(); root?.traverse(node => { if (node.geometry && !disposed.has(node.geometry)) { disposed.add(node.geometry); node.geometry.dispose(); } if (node.userData.ownedTexture) node.userData.ownedTexture.dispose(); if (node.userData.ownedMaterial) node.userData.ownedMaterial.dispose(); });
            root?.removeFromParent();
        }
    };
})(window.ByndHome3D);
