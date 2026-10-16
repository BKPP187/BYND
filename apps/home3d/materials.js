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
        function woven(color, pattern = 'knit') {
            const key = 'woven:' + pattern + ':' + color; if (cache.has(key)) return cache.get(key);
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 128);
            if (pattern === 'gingham') {
                ctx.fillStyle = '#ffffff55'; for (let i = 0; i < 128; i += 32) { ctx.fillRect(i, 0, 16, 128); ctx.fillRect(0, i, 128, 16); }
            } else if (pattern === 'stripe') {
                ctx.fillStyle = '#ffffff44'; for (let i = 0; i < 128; i += 16) ctx.fillRect(i, 0, 5, 128);
            } else {
                ctx.strokeStyle = '#ffffff32'; ctx.lineWidth = 1;
                for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 6); ctx.lineTo(x + 8, y); ctx.stroke(); }
            }
            const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace; textures.set(key, map);
            const material = new T.MeshStandardMaterial({ map, roughness: .96, bumpMap: texture('fabric'), bumpScale: .004 });
            cache.set(key, material); return material;
        }
        function glow(color, intensity = .7) {
            const key = 'glow:' + color + ':' + intensity; if (cache.has(key)) return cache.get(key);
            const material = new T.MeshStandardMaterial({ color, roughness: .8, emissive: color, emissiveIntensity: intensity }); cache.set(key, material); return material;
        }
        // Painted surfaces share one 1024² canvas + Source per finish and kind
        // class. Each size only adds a lightweight Texture (own repeat) on that
        // Source; WebGL keeps one GPU upload per Source, and disposing one
        // Texture releases the upload only when no other Texture uses it.
        const sources = new Map();
        function surfaceSource(finish, kind) {
            const key = 'surface-source:' + JSON.stringify(finish) + ':' + (kind === 'rug' || kind === 'art' ? kind : 'tiled');
            if (!sources.has(key)) {
                const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
                H.Interiors.paint(canvas, finish);
                sources.set(key, { canvas, source: new T.Source(canvas) });
            }
            return sources.get(key);
        }
        function surfaceTexture(finish, kind, repeatX, repeatY) {
            const shared = surfaceSource(finish, kind), map = new T.CanvasTexture(shared.canvas);
            map.source = shared.source; map.colorSpace = T.SRGBColorSpace; map.wrapS = map.wrapT = T.RepeatWrapping;
            if (repeatX !== undefined) map.repeat.set(repeatX, repeatY);
            return map;
        }
        const surfaceTile = (finish, kind) => kind === 'floor' ? ['parquet', 'herringbone'].includes(finish.pattern) ? 4.8 : 2.4 : 1.6;
        const surfaceRoughness = (finish, kind) => kind === 'floor' && finish.pattern === 'marble' ? .45 : .9;
        function surface(finish, width, height, kind = 'wall') {
            const tiled = kind !== 'rug' && kind !== 'art', tile = surfaceTile(finish, kind);
            // Rugs and art stretch once regardless of size, so they share one material.
            const key = 'surface:' + JSON.stringify(finish) + ':' + kind + (tiled ? ':' + width + ':' + height : '');
            if (cache.has(key)) return cache.get(key);
            const map = tiled ? surfaceTexture(finish, kind, width / tile, height / tile) : surfaceTexture(finish, kind);
            textures.set(key, map);
            const material = new T.MeshStandardMaterial({ map, roughness: surfaceRoughness(finish, kind) });
            cache.set(key, material); return material;
        }
        // One material per finish+kind for geometry whose UVs are in metres
        // (see H.Shapes.metricUV). Lets every wall/floor of a finish batch together.
        function tiled(finish, kind = 'wall') {
            const key = 'surface:' + JSON.stringify(finish) + ':' + kind + ':metric';
            if (cache.has(key)) return cache.get(key);
            const tile = surfaceTile(finish, kind), map = surfaceTexture(finish, kind, 1 / tile, 1 / tile);
            textures.set(key, map);
            const material = new T.MeshStandardMaterial({ map, roughness: surfaceRoughness(finish, kind) });
            material.userData.metricUV = true; cache.set(key, material); return material;
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
            const originals = new Set(), retainedTextures = new Set(), mapped = new Map();
            root.traverse(node => {
                if (!node.isMesh) return;
                const list = Array.isArray(node.material) ? node.material : [node.material];
                const replacements = list.map((original, i) => {
                    originals.add(original);
                    // A textured PBR asset must retain its base color, normal and
                    // roughness maps. Solid-color legacy packs still use our palette.
                    if (original?.isMeshStandardMaterial && (item.keepMaterials || Object.values(original).some(value => value?.isTexture))) {
                        if (!mapped.has(original)) mapped.set(original, original.clone());
                        const replacement = mapped.get(original);
                        node.userData.ownedMaterials = [...(node.userData.ownedMaterials || []), replacement];
                        const maps = Object.values(replacement).filter(value => value?.isTexture);
                        node.userData.ownedTextures = [...(node.userData.ownedTextures || []), ...maps]; maps.forEach(map => retainedTextures.add(map));
                        return replacement;
                    }
                    return get(role(original, item, i));
                });
                node.material = Array.isArray(node.material) ? replacements : replacements[0];
                node.castShadow = true; node.receiveShadow = true;
            });
            originals.forEach(material => { for (const value of Object.values(material || {})) if (value?.isTexture && !retainedTextures.has(value)) value.dispose(); material?.dispose(); });
        }
        function clearSurfaces() {
            for (const [key, material] of cache) if (key.startsWith('surface:')) { material.dispose(); cache.delete(key); }
            for (const [key, map] of textures) if (key.startsWith('surface:')) { map.dispose(); textures.delete(key); }
            sources.clear();
        }
        function dispose() { dead = true; cache.forEach(material => material.dispose()); textures.forEach(map => map.dispose()); cache.clear(); textures.clear(); sources.clear(); }
        return { get, woven, glow, surface, tiled, clearSurfaces, surfaceSources: () => sources.size, apply, theme, night: themeId === 'night', dispose, disposed: () => dead };
    }
    H.Materials = { create };
    H.Shapes = {
        rounded(parent, size, position, material, radius = 0.06) {
            const T = ByndHomeEngine, geometry = new T.RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(n => n / 2)));
            const mesh = new T.Mesh(geometry, material); mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
        },
        sphere(parent, size, position, material) {
            const T = ByndHomeEngine, mesh = new T.Mesh(new T.SphereGeometry(1, 20, 14), material);
            mesh.scale.set(...size); mesh.position.set(...position); mesh.castShadow = true;
            mesh.userData.renderLods = [mesh.geometry, new T.SphereGeometry(1, 8, 6)]; mesh.userData.renderRadius = 1;
            parent.add(mesh); return mesh;
        },
        // Rescale 0..1 UVs to metres so a metric tiled() material repeats at the
        // same physical size on every wall or floor length.
        metricUV(geometry, width, height) {
            const uv = geometry.attributes.uv; if (!uv) return geometry;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width, uv.getY(i) * height);
            uv.needsUpdate = true; return geometry;
        },
        disposeGeometry(root) {
            const disposed = new Set(); root?.traverse(node => {
                const resources = [node.geometry, ...(node.userData.renderLods || []), node.userData.ownedTexture, node.userData.ownedMaterial, node.userData.ownedSkeleton, ...(node.userData.ownedTextures || []), ...(node.userData.ownedMaterials || [])];
                for (const resource of resources) if (resource && !disposed.has(resource)) { disposed.add(resource); resource.dispose(); }
            });
            root?.removeFromParent();
        }
    };
})(window.ByndHome3D);
