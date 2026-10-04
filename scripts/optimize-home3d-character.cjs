'use strict';
// Offline static-model preparation. It neither calls Tripo nor alters the source GLB.
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const { inspect, readDocument } = require('./check-home3d-character-model.cjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const LEVELS = [
    { name: 'near', triangles: 180000, error: .002, protect: 'face-and-hands', minPixels: 500, flags: [] },
    { name: 'middle', triangles: 70000, error: .006, protect: 'face', minPixels: 220, flags: [] },
    { name: 'far', triangles: 25000, error: .012, protect: 'none', minPixels: 0, flags: ['Permissive'] }
];
function dependencies() {
    const base = path.resolve(__dirname, '../artifacts/home3d-tools/node_modules');
    return { ...require(path.join(base, '@gltf-transform/core')), ...require(path.join(base, 'meshoptimizer')) };
}
function sourceContract(bytes) {
    const d = readDocument(bytes), p = d.meshes?.[0]?.primitives?.[0];
    if (d.skins?.length || d.animations?.length || d.meshes?.length !== 1 || d.meshes[0].primitives.length !== 1 || p.targets?.length)
        throw new Error('This tool accepts one static primitive only; rigged or animated models need a separate preparation pass.');
    if ((p.mode ?? 4) !== 4 || p.indices === undefined || !['POSITION', 'NORMAL', 'TEXCOORD_0'].every(key => p.attributes?.[key] !== undefined))
        throw new Error('Expected indexed triangles with positions, normals and texture coordinates.');
    if (d.extensionsRequired?.length || d.extensionsUsed?.length)
        throw new Error('Extended models require an explicitly configured reader; source preserved.');
    return d;
}
function protectedVertices(positions, protection) {
    const locks = new Uint8Array(positions.length / 3);
    // The reviewed silver-red-v1 mesh faces +X, is Y-up, and spans Y=-.5..+.5.
    // These regions are model-specific; never silently reuse them for another character.
    for (let i = 0; i < locks.length; i++) {
        const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
        const face = x > .035 && y > .265 && y < .39 && Math.abs(z) < .075;
        const hand = y > -.22 && y < -.035 && Math.abs(z) > .165;
        if (protection !== 'none' && (face || (protection === 'face-and-hands' && hand))) locks[i] = 1;
    }
    return locks;
}
async function optimizeLevel(bytes, level, api) {
    const { NodeIO, MeshoptSimplifier: S } = api;
    const io = new NodeIO(), doc = await io.readBinary(new Uint8Array(bytes));
    const primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    const oldIndices = primitive.getIndices(), oldAttributes = primitive.listAttributes();
    const positions = primitive.getAttribute('POSITION').getArray();
    const normals = primitive.getAttribute('NORMAL').getArray(), uv = primitive.getAttribute('TEXCOORD_0').getArray();
    const extra = api.extraAttributes?.(primitive), width = 5 + (extra?.width || 0);
    const attributes = new Float32Array(oldIndices.getCount() ? positions.length / 3 * width : 0);
    for (let i = 0; i < positions.length / 3; i++) { attributes.set([normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2], uv[i * 2], uv[i * 2 + 1]], i * width); if (extra) attributes.set(extra.values.subarray(i * extra.width, (i + 1) * extra.width), i * width + 5); }
    const locks = (api.protectedVertices || protectedVertices)(positions, level.protect);
    const [indices, error] = S.simplifyWithAttributes(new Uint32Array(oldIndices.getArray()), positions, 3, attributes, width,
        [.15, .15, .15, .5, .5, ...(extra?.weights || [])], locks, Math.min(level.triangles * 3, oldIndices.getCount()), level.error, level.flags);
    if (!indices.length || indices.length % 3 || indices.length > oldIndices.getCount()) throw new Error('Simplifier returned invalid triangle data.');
    // compactMesh mutates indices and returns an old-to-new vertex mapping.
    const [remap, count] = S.compactMesh(indices), buffer = doc.getRoot().listBuffers()[0];
    for (const semantic of primitive.listSemantics()) {
        const old = primitive.getAttribute(semantic), source = old.getArray(), width = old.getElementSize();
        const compact = new source.constructor(count * width);
        for (let i = 0; i < remap.length; i++) if (remap[i] !== 0xffffffff) compact.set(source.subarray(i * width, (i + 1) * width), remap[i] * width);
        primitive.setAttribute(semantic, doc.createAccessor().setType(old.getType()).setNormalized(old.getNormalized()).setArray(compact).setBuffer(buffer));
    }
    primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
    oldIndices.dispose(); for (const attribute of oldAttributes) attribute.dispose();
    const output = Buffer.from(await io.writeBinary(doc)), intake = await inspect(output);
    if (!intake.ok) throw new Error('Optimized model failed GLB validation: ' + intake.errors.join('; '));
    return { output, intake, metrics: { ...level, triangles: indices.length / 3, vertices: count, error,
        lockedVertices: locks.reduce((sum, value) => sum + value, 0), bytes: output.length, sha256: hash(output) } };
}
async function main(args = process.argv.slice(2)) {
    if (args.length !== 2) throw new Error('Usage: node scripts/optimize-home3d-character.cjs <silver-red-v1.glb> <new-output-directory>');
    const source = path.resolve(args[0]), directory = path.resolve(args[1]), bytes = fs.readFileSync(source);
    if (fs.existsSync(directory)) throw new Error('Output directory already exists; previous models will not be overwritten.');
    // This protection mask is authorized only for the exact reviewed male input.
    const sourceHash = hash(bytes);
    if (sourceHash !== 'dfb18586efa20ab5ea9eefb4ccf73a342ccf766685b3f9125a39efb8679b3589') throw new Error('This protection profile belongs to silver-red-v1 only.');
    sourceContract(bytes);
    const api = dependencies(); await api.MeshoptSimplifier.ready;
    const result = [];
    for (const level of LEVELS) {
        console.log('Preparing ' + level.name + ' locally...');
        result.push(await optimizeLevel(bytes, level, api));
        console.log(JSON.stringify(result.at(-1).metrics));
    }
    if (hash(fs.readFileSync(source)) !== sourceHash) throw new Error('Source changed during preparation; output not saved.');
    fs.mkdirSync(directory, { recursive: true });
    for (const item of result) {
        fs.writeFileSync(path.join(directory, item.metrics.name + '.glb'), item.output, { flag: 'wx' });
        fs.writeFileSync(path.join(directory, item.metrics.name + '-intake.json'), JSON.stringify(item.intake, null, 2), { flag: 'wx' });
    }
    fs.writeFileSync(path.join(directory, 'lod-manifest.json'), JSON.stringify({ version: 1, sourceHash, createdAt: new Date().toISOString(),
        stage: 'static-lods-for-appearance-review', sourceBytes: bytes.length, sourceTriangles: 1397535,
        orientation: { forward: '+X', up: '+Y' }, textures: 'Original embedded images preserved',
        selection: 'Projected character height in CSS pixels, with hysteresis; thresholds need device profiling',
        levels: result.map(item => item.metrics), reviewRequired: ['Close-up face, hair and hands', 'Rigging and deformation', 'Furniture contact', 'Physical mobile performance'] }, null, 2), { flag: 'wx' });
}
module.exports = { sourceContract, protectedVertices, LEVELS, optimizeLevel, main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
