'use strict';
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
async function main() {
    const tools = path.resolve(process.argv[3] || 'artifacts/home3d-tools/node_modules');
    const { NodeIO } = require(path.join(tools, '@gltf-transform/core'));
    const { flatten, join, weld } = require(path.join(tools, '@gltf-transform/functions'));
    const io = new NodeIO().registerExtensions(require(path.join(tools, '@gltf-transform/extensions')).ALL_EXTENSIONS);
    const names = ['croissant', 'pancakes', 'egg-cooked', 'salad', 'sushi-salmon', 'maki-vegetable', 'rice-ball', 'dim-sum', 'meat-cooked', 'broccoli', 'carrot', 'cake', 'strawberry', 'bowl-soup', 'sandwich', 'waffle'];
    const source = path.resolve(process.argv[2] || 'artifacts/food-kit/source'), dest = path.resolve('assets/home3d/furniture'), assets = [];
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    for (const name of names) {
        const file = 'food-' + name + '.glb', input = path.join(source, 'Models/GLB format', name + '.glb');
        const original = fs.readFileSync(input), doc = await io.read(input);
        // Preserve the authored topology/palette; bake transforms and merge the
        // pack's static submeshes into one draw call without adding polygons.
        await doc.transform(flatten(), join(), weld());
        for (const material of doc.getRoot().listMaterials()) material.setRoughnessFactor(.78).setMetallicFactor(0).setDoubleSided(false);
        await io.write(path.join(dest, file), doc);
        const bytes = fs.readFileSync(path.join(dest, file)); let triangles = 0;
        for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) triangles += (primitive.getIndices()?.getCount() || primitive.getAttribute('POSITION').getCount()) / 3;
        assets.push({ id: name, file, originalFile: name + '.glb', originalSha256: hash(original), sha256: hash(bytes), bytes: bytes.length, triangles, processing: 'Embedded original palette texture; baked transforms and merged material batches; preserved geometry and UVs; matte PBR material' });
        // Only rewrite the selected foods, preserving other windows' asset work.
        fs.writeFileSync(path.join(dest, file + '.js'), 'window.ByndHome3D.Furniture.registerBuffer(' + JSON.stringify(file) + ',' + JSON.stringify(bytes.toString('base64')) + ');\n');
        console.log(name, bytes.length, triangles);
    }
    fs.copyFileSync(path.join(source, 'License.txt'), 'assets/home3d/licenses/Kenney-Food-CC0.txt');
    fs.writeFileSync('assets/home3d/food-manifest.json', JSON.stringify({ source: 'Kenney Food Kit 2.0', sourceUrl: 'https://kenney.nl/assets/food-kit', downloadUrl: 'https://kenney.nl/media/pages/assets/food-kit/83086fa91c-1719418518/kenney_food-kit.zip', license: 'CC0-1.0', licenseFile: 'assets/home3d/licenses/Kenney-Food-CC0.txt', commercialUse: true, modificationAllowed: true, assets }, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
