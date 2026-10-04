'use strict';
// Extract genuine feet from the user-authorized Tripo barefoot model, preserving UVs.
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
async function main() {
    const { NodeIO } = require(path.join(root, 'artifacts/home3d-tools/node_modules/@gltf-transform/core'));
    const { MeshoptSimplifier: S } = require(path.join(root, 'artifacts/home3d-tools/node_modules/meshoptimizer'));
    const sharp = require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
    const source = path.join(root, 'artifacts/home3d-models/silver-red-v1/barefoot-v1/character.glb'), bytes = fs.readFileSync(source);
    const hash = b => createHash('sha256').update(b).digest('hex');
    if (hash(bytes) !== 'a01229b3deb5ea8f92e32b34393493d941e3822e3862fdac887875451dfafd3e') throw Error('Barefoot source changed.');
    const io = new NodeIO(), doc = await io.readBinary(bytes), primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0], scene = doc.getRoot().listScenes()[0];
    const positions = primitive.getAttribute('POSITION').getArray(), normals = primitive.getAttribute('NORMAL').getArray(), uv = primitive.getAttribute('TEXCOORD_0').getArray(), triangles = primitive.getIndices().getArray(), material = primitive.getMaterial(), buffer = doc.getRoot().listBuffers()[0];
    await S.ready;
    scene.listChildren().forEach(node => { scene.removeChild(node); node.dispose(); });
    const metrics = [];
    for (const side of [-1, 1]) {
        const indices = [], bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
        const canonical = i => [-positions[i * 3 + 2] * 1.55, (positions[i * 3 + 1] + .5) * 1.55, positions[i * 3] * 1.55];
        for (let i = 0; i < triangles.length; i += 3) {
            const points = [0, 1, 2].map(k => canonical(triangles[i + k]));
            if (points.every(p => p[1] < .255 && p[0] * side > 0)) indices.push(triangles[i], triangles[i + 1], triangles[i + 2]);
        }
        for (const i of new Set(indices)) { const [x, y, z] = canonical(i); if (y < .10) { bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x); bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z); } }
        const centerX = (bounds.minX + bounds.maxX) / 2, scale = .215 / (bounds.maxZ - bounds.minZ);
        const remap = new Map(), compact = [], attributes = [];
        for (const i of indices) { if (!remap.has(i)) { remap.set(i, remap.size); compact.push(i); } }
        const p = new Float32Array(compact.length * 3), n = new Float32Array(p.length), t = new Float32Array(compact.length * 2);
        compact.forEach((i, j) => {
            const [x, y, z] = canonical(i);
            p.set([(x - centerX) * scale, y * scale - .0775, (z - bounds.minZ) * scale - .046], j * 3);
            n.set([-normals[i * 3 + 2], normals[i * 3 + 1], normals[i * 3]], j * 3); t.set([uv[i * 2], uv[i * 2 + 1]], j * 2);
            attributes.push(...n.subarray(j * 3, j * 3 + 3), ...t.subarray(j * 2, j * 2 + 2));
        });
        const raw = new Uint32Array(indices.map(i => remap.get(i)));
        const [reduced] = S.simplifyWithAttributes(raw, p, 3, new Float32Array(attributes), 5, [.35, .35, .35, .4, .4], null, 18000, .003, ['LockBorder']);
        const surviving = new Map(); for (const i of reduced) if (!surviving.has(i)) surviving.set(i, surviving.size);
        const packedP = new Float32Array(surviving.size * 3), packedN = new Float32Array(packedP.length), packedUV = new Float32Array(surviving.size * 2);
        for (const [i, j] of surviving) { packedP.set(p.subarray(i * 3, i * 3 + 3), j * 3); packedN.set(n.subarray(i * 3, i * 3 + 3), j * 3); packedUV.set(t.subarray(i * 2, i * 2 + 2), j * 2); }
        const finalIndices = new Uint32Array(Array.from(reduced, i => surviving.get(i)));
        const mesh = doc.createMesh('barefoot-' + (side < 0 ? 'left' : 'right')), part = doc.createPrimitive();
        part.setIndices(doc.createAccessor().setType('SCALAR').setArray(finalIndices).setBuffer(buffer));
        for (const [semantic, type, array] of [['POSITION', 'VEC3', packedP], ['NORMAL', 'VEC3', packedN], ['TEXCOORD_0', 'VEC2', packedUV]]) part.setAttribute(semantic, doc.createAccessor().setType(type).setArray(array).setBuffer(buffer));
        part.setMaterial(material); mesh.addPrimitive(part); scene.addChild(doc.createNode(mesh.getName()).setMesh(mesh));
        metrics.push({ side, triangles: reduced.length / 3, length: .215, sourceFootLength: bounds.maxZ - bounds.minZ, scale });
    }
    // The original full-character primitive is not part of the shipped foot asset.
    primitive.getIndices().dispose(); primitive.listAttributes().forEach(a => a.dispose()); primitive.dispose();
    doc.getRoot().listMeshes().filter(mesh => !mesh.getName().startsWith('barefoot-')).forEach(mesh => mesh.dispose());
    for (const texture of doc.getRoot().listTextures()) {
        const color = texture === material.getBaseColorTexture();
        const pipeline = sharp(Buffer.from(texture.getImage())).resize({ width: color ? 2048 : 512, height: color ? 2048 : 512, fit: 'inside', withoutEnlargement: true });
        texture.setImage(await (color ? pipeline.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }) : pipeline.png()).toBuffer()); texture.setMimeType(color ? 'image/jpeg' : 'image/png');
    }
    const packed = Buffer.from(await io.writeBinary(doc)), report = await require('./check-home3d-character-model.cjs').inspect(packed);
    if (!report.ok) throw Error('Foot model validation failed.');
    const output = path.join(root, 'assets/home3d/characters/silver-red-v1/barefeet.glb');
    fs.writeFileSync(output, packed); fs.writeFileSync(output + '.js', "window.ByndHome3D.CharacterModels.registerBuffer('barefeet','" + packed.toString('base64') + "','silver-red-v1');\n");
    fs.writeFileSync(path.join(root, 'assets/home3d/characters/silver-red-v1/barefeet-manifest.json'), JSON.stringify({ sourceHash: hash(bytes), source: 'User-authorized Tripo barefoot generation; feet extracted from actual mesh', bytes: packed.length, sha256: hash(packed), metrics }, null, 2));
    console.log(JSON.stringify({ bytes: packed.length, metrics }));
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
