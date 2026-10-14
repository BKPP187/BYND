'use strict';
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
async function main() {
    const tools = path.resolve('artifacts/home3d-tools/node_modules'), { NodeIO } = require(path.join(tools, '@gltf-transform/core'));
    const { flatten, join, weld } = require(path.join(tools, '@gltf-transform/functions'));
    const io = new NodeIO().registerExtensions(require(path.join(tools, '@gltf-transform/extensions')).ALL_EXTENSIONS);
    const source = path.resolve(process.argv[2] || 'artifacts/nature-kit/source'), dest = path.resolve('assets/home3d/furniture'), assets = [];
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    for (const name of ['tree_oak', 'tree_small', 'plant_bushDetailed', 'grass_leafsLarge', 'flower_purpleA', 'flower_yellowA']) {
        const input = path.join(source, 'Models/GLTF format', name + '.glb'), file = 'garden-' + name + '.glb', original = fs.readFileSync(input), doc = await io.read(input);
        await doc.transform(flatten(), join(), weld());
        for (const material of doc.getRoot().listMaterials()) material.setRoughnessFactor(.9).setMetallicFactor(0);
        await io.write(path.join(dest, file), doc); const bytes = fs.readFileSync(path.join(dest, file));
        let triangles = 0; for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) triangles += (p.getIndices()?.getCount() || p.getAttribute('POSITION').getCount()) / 3;
        assets.push({ id: name, file, originalSha256: hash(original), sha256: hash(bytes), bytes: bytes.length, triangles });
        fs.writeFileSync(path.join(dest, file + '.js'), 'window.ByndHome3D.Furniture.registerBuffer(' + JSON.stringify(file) + ',' + JSON.stringify(bytes.toString('base64')) + ');\n');
        console.log(name, bytes.length, triangles);
    }
    fs.copyFileSync(path.join(source, 'License.txt'), 'assets/home3d/licenses/Kenney-Nature-CC0.txt');
    fs.writeFileSync('assets/home3d/garden-manifest.json', JSON.stringify({ source: 'Kenney Nature Kit', sourceUrl: 'https://kenney.nl/assets/nature-kit', downloadUrl: 'https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip', license: 'CC0-1.0', licenseFile: 'assets/home3d/licenses/Kenney-Nature-CC0.txt', processing: 'Baked transforms, merged primitives, retained palette/UVs and authored topology; matte PBR; repeated placements use GPU instancing.', assets }, null, 2) + '\n');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
