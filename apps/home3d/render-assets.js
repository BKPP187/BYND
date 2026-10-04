(function (H) {
    'use strict';
    const colorMaps = new Set(['map', 'emissiveMap']), slots = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'alphaMap'];
    function create(T, renderer) {
        const originals = new WeakMap(), lodMeshes = new Set(); let report = { textureBytes: 0, budgetBytes: 0, textures: 0, lodMeshes: 0 };
        function apply(scene, profile) {
            const maps = new Map(); lodMeshes.clear();
            scene.traverse(node => {
                if (node.userData?.renderLods) lodMeshes.add(node);
                let parent = node, hero = false;
                while (parent) { if (parent.userData?.actor || parent.userData?.texturePriority === 'hero') hero = true; parent = parent.parent; }
                for (const material of Array.isArray(node.material) ? node.material : [node.material]) for (const slot of slots) {
                    const texture = material?.[slot]; if (!texture?.isTexture || texture.isCompressedTexture || texture.isCubeTexture) continue;
                    const previous = maps.get(texture); maps.set(texture, { texture, color: colorMaps.has(slot) || previous?.color, hero: hero || previous?.hero });
                }
            });
            const entries = [...maps.values()].sort((a, b) => Number(b.hero) - Number(a.hero)), budget = profile.textureMiB * 1024 * 1024;
            for (const entry of entries) {
                const texture = entry.texture, image = originals.get(texture) || texture.image;
                if (!image?.width || !image?.height) continue;
                originals.set(texture, image);
                const cap = Math.min(renderer.capabilities.maxTextureSize, entry.hero ? profile.heroTextureSize : profile.textureSize);
                entry.source = image; entry.scale = Math.min(1, cap / Math.max(image.width, image.height));
                entry.bytes = image.width * image.height * entry.scale * entry.scale * 4 * 4 / 3;
            }
            let total = entries.reduce((sum, item) => sum + (item.bytes || 0), 0);
            // Shared maps count once; reduce non-hero maps first, never upscale a source.
            for (const hero of [false, true]) for (let pass = 0; total > budget && pass < 5; pass++) for (const entry of entries) {
                if (entry.hero !== hero || !entry.source || Math.max(entry.source.width, entry.source.height) * entry.scale <= 128) continue;
                total -= entry.bytes * .75; entry.scale /= 2; entry.bytes /= 4; if (total <= budget) break;
            }
            for (const entry of entries) {
                if (!entry.source) continue;
                const texture = entry.texture, w = Math.max(1, Math.floor(entry.source.width * entry.scale)), h = Math.max(1, Math.floor(entry.source.height * entry.scale));
                const changed = texture.image?.width !== w || texture.image?.height !== h;
                if (changed) {
                    let image = entry.source;
                    if (entry.scale !== 1) { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('设备无法准备家具贴图。'); ctx.drawImage(entry.source, 0, 0, w, h); image = canvas; }
                    // WebGL storage dimensions are immutable after upload. Release
                    // the old allocation before the next upload at another size.
                    // Cloned GLTF textures can share a Source but have distinct UVs
                    // or priorities. Detach it so resizing one does not resize peers.
                    texture.dispose(); texture.source = new T.Source(image);
                }
                const colorSpace = entry.color ? T.SRGBColorSpace : T.NoColorSpace, anisotropy = Math.min(profile.anisotropy, renderer.capabilities.getMaxAnisotropy());
                if (changed || texture.colorSpace !== colorSpace || texture.anisotropy !== anisotropy || !texture.generateMipmaps) {
                    texture.colorSpace = colorSpace; texture.anisotropy = anisotropy; texture.generateMipmaps = true; texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter; texture.needsUpdate = true;
                }
            }
            report = { textureBytes: Math.ceil(total), budgetBytes: budget, textures: entries.length, lodMeshes: lodMeshes.size };
            return { ...report };
        }
        function lod(camera, height, profile) {
            const scale = new T.Vector3();
            for (const mesh of lodMeshes) {
                const levels = mesh.userData.renderLods, radius = mesh.userData.renderRadius || .1;
                mesh.getWorldScale(scale);
                const pixels = radius * Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)) * height / (camera.top - camera.bottom) / profile.lodBias;
                const old = mesh.userData.renderLodLevel || 0, level = old === 0 ? (pixels < 8 ? 1 : 0) : (pixels > 12 ? 0 : 1);
                mesh.userData.renderLodLevel = level; mesh.geometry = levels[level];
            }
        }
        return { apply, lod, stats: () => ({ ...report }), dispose: () => lodMeshes.clear() };
    }
    H.RenderAssets = { create };
})(window.ByndHome3D);
