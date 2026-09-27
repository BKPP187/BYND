/* Rebuild the reviewed local geometry and the offline renderer. No network models are used. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const toolsRoot = path.resolve(process.argv[2] || path.join(root, 'artifacts/home3d-tools'));
const source = process.argv[3] || 'C:/Users/l/Downloads/3d家具';
async function main() {
    const THREE = await import(pathToFileURL(path.join(toolsRoot, 'node_modules/three/build/three.module.js')));
    const { FBXLoader } = await import(pathToFileURL(path.join(toolsRoot, 'node_modules/three/examples/jsm/loaders/FBXLoader.js')));
    const { GLTFExporter } = await import(pathToFileURL(path.join(toolsRoot, 'node_modules/three/examples/jsm/exporters/GLTFExporter.js')));
    const { mergeGeometries } = await import(pathToFileURL(path.join(toolsRoot, 'node_modules/three/examples/jsm/utils/BufferGeometryUtils.js')));
    const { build } = require(path.join(toolsRoot, 'node_modules/esbuild'));
    global.FileReader = class {
        readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
        readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(result).toString('base64'); this.onloadend?.(); }); }
    };
    const dest = path.join(root, 'assets/home3d/furniture');
    fs.mkdirSync(dest, { recursive: true });
    fs.mkdirSync(path.join(root, 'assets/home3d/licenses'), { recursive: true });
    const quaternius = ['Sofa', 'BedDouble', 'Desk', 'NightStand', 'Bookcase_Books', 'OfficeChair'];
    for (const name of quaternius) {
        const file = path.join(source, 'FBX-20260926T073204Z-1-001/FBX', name + '.fbx');
        const data = fs.readFileSync(file);
        const model = new FBXLoader().parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
        const bounds = new THREE.Box3().setFromObject(model);
        console.log(name, bounds.getSize(new THREE.Vector3()).toArray(), [...new Set(model.children.flatMap(c => c.material ? (Array.isArray(c.material) ? c.material : [c.material]).map(m => m.name) : []))]);
        // FBX contains hundreds of tiny meshes. Bake transforms and merge by material;
        // keep actual material slots so fabric, wood, metal and book covers remain distinct.
        model.updateMatrixWorld(true);
        const batches = new Map();
        model.traverse(node => {
            if (!node.isMesh) return;
            const geometry = (node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone()).applyMatrix4(node.matrixWorld);
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: geometry.getAttribute('position').count, materialIndex: 0 }];
            for (const group of groups) {
                const material = materials[group.materialIndex || 0], key = material.name + ':' + material.color.getHexString();
                const slice = new THREE.BufferGeometry();
                for (const attribute of ['position', 'normal', 'uv']) {
                    const sourceAttribute = geometry.getAttribute(attribute);
                    if (sourceAttribute) slice.setAttribute(attribute, new THREE.Float32BufferAttribute(sourceAttribute.array.slice(group.start * sourceAttribute.itemSize, (group.start + group.count) * sourceAttribute.itemSize), sourceAttribute.itemSize));
                    else if (attribute === 'uv') slice.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(group.count * 2), 2));
                }
                if (!slice.getAttribute('normal')) slice.computeVertexNormals();
                if (!batches.has(key)) batches.set(key, { material, geometries: [] });
                batches.get(key).geometries.push(slice);
            }
            geometry.dispose();
        });
        const optimized = new THREE.Group();
        for (const { material, geometries } of batches.values()) {
            const merged = mergeGeometries(geometries, false);
            if (!merged) throw new Error('Could not merge ' + name);
            optimized.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ name: material.name, color: material.color, roughness: 0.8 })));
        }
        const glb = await new GLTFExporter().parseAsync(optimized, { binary: true, onlyVisible: true });
        fs.writeFileSync(path.join(dest, 'q-' + name + '.glb'), Buffer.from(glb));
    }
    const kenney = ['loungeChair', 'tableCoffee', 'televisionVintage', 'cabinetTelevision', 'rugRound', 'pillow', 'plantSmall1', 'pottedPlant', 'lampRoundFloor', 'lampRoundTable', 'computerScreen', 'computerKeyboard', 'radio', 'bear', 'books', 'laptop'];
    for (const name of kenney) fs.copyFileSync(path.join(source, 'kenney_furniture-kit/Models/GLTF format', name + '.glb'), path.join(dest, 'k-' + name + '.glb'));
    fs.copyFileSync(path.join(source, 'kenney_furniture-kit/License.txt'), path.join(root, 'assets/home3d/licenses/Kenney-CC0.txt'));
    const vendorDir = path.join(root, 'assets/vendor/home3d');
    fs.mkdirSync(vendorDir, { recursive: true });
    fs.copyFileSync(path.join(toolsRoot, 'node_modules/three/LICENSE'), path.join(vendorDir, 'THREE-LICENSE.txt'));
    await build({ stdin: { contents: "export * from 'three'; export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; export { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';", resolveDir: toolsRoot }, bundle: true, minify: true, format: 'iife', globalName: 'ByndHomeEngine', target: ['chrome90', 'safari15'], outfile: path.join(vendorDir, 'engine.js'), legalComments: 'eof' });
    // JSON is canonical. A classic-script mirror also supports Android's file:// origin.
    const catalogs = Object.fromEntries(['furniture-catalog', 'room-catalog', 'material-presets'].map(name => [name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), JSON.parse(fs.readFileSync(path.join(root, 'apps/home3d/data', name + '.json'), 'utf8'))]));
    fs.writeFileSync(path.join(root, 'apps/home3d/data/catalogs.js'), 'window.ByndHome3D.catalogs = ' + JSON.stringify(catalogs) + ';\n');
    const manifest = fs.readdirSync(dest).filter(file => file.endsWith('.glb')).map(file => {
        const sourceId = file.startsWith('q-') ? 'quaternius' : 'kenney';
        const provenance = catalogs.furnitureCatalog.sources[sourceId];
        const bytes = fs.readFileSync(path.join(dest, file));
        return { file, sourceId, originalFile: file.slice(2, -4) + (sourceId === 'quaternius' ? '.fbx' : '.glb'), ...provenance, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), processing: sourceId === 'quaternius' ? 'FBX to GLB; baked transforms; material-preserving mesh merge; runtime rounded upholstery and BYND material presets' : 'Original GLB geometry; runtime BYND material presets' };
    });
    fs.writeFileSync(path.join(root, 'assets/home3d/asset-manifest.json'), JSON.stringify({ reviewedAt: '2026-09-27', assets: manifest }, null, 2) + '\n');
    require('./prepare-home3d-file-resources.cjs').prepare(dest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
