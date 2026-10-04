'use strict';
// Offline only. Retain the reviewed rig, weights, UVs and textures in every LOD.
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const { optimizeLevel } = require('./optimize-home3d-character.cjs');
const { inspect, readDocument } = require('./check-home3d-character-model.cjs');
const root = path.resolve(__dirname, '..'), expectedHash = 'de0a9ff095896b577bb3ea0effb0fd76723bfc875620168bd03cc9647667c50a';
function extraAttributes(primitive) {
    const indices = primitive.getAttribute('JOINTS_0').getArray(), weights = primitive.getAttribute('WEIGHTS_0').getArray(), width = 23, values = new Float32Array(indices.length / 4 * width);
    for (let i = 0; i < indices.length / 4; i++) for (let k = 0; k < 4; k++) values[i * width + indices[i * 4 + k]] += weights[i * 4 + k];
    return { width, values, weights: new Array(width).fill(.35) };
}
async function main() {
    const input = path.join(root, 'artifacts/home3d-models/bunny-blue-v1/rig-v1/character.glb'), output = path.join(root, 'artifacts/home3d-models/bunny-blue-v1/rig-v1/lod-v1'), bytes = fs.readFileSync(input);
    const hash = b => createHash('sha256').update(b).digest('hex'), d = readDocument(bytes), source = await inspect(bytes, { requireRig: true });
    if (hash(bytes) !== expectedHash || !source.ok || source.model.joints !== 23 || d.meshes.length !== 1 || d.meshes[0].primitives.length !== 1) throw Error('Reviewed female rig source changed.');
    if (fs.existsSync(output)) throw Error('Rig LODs already exist; previous outputs preserved.');
    const dependencies = path.join(root, 'artifacts/home3d-tools/node_modules');
    // Rig output has the same +X face and ground-centred Y coordinates as the
    // original, but now Y spans 0..1. Adjust the protected regions accordingly.
    const protectedVertices = (positions, protection) => {
        const locks = new Uint8Array(positions.length / 3);
        for (let i = 0; i < locks.length; i++) {
            const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
            if (protection !== 'none' && x > .065 && y > .68 && y < .77 && Math.abs(z) < .065) locks[i] = 1;
        }
        return locks;
    };
    const api = { ...require(path.join(dependencies, '@gltf-transform/core')), ...require(path.join(dependencies, 'meshoptimizer')), protectedVertices, extraAttributes };
    await api.MeshoptSimplifier.ready;
    const levels = [
        { name: 'near', triangles: 100000, error: .003, protect: 'face', flags: [] },
        { name: 'middle', triangles: 45000, error: .009, protect: 'face', flags: [] },
        { name: 'far', triangles: 18000, error: .018, protect: 'none', flags: ['Permissive'] }
    ], results = [];
    for (const level of levels) {
        const result = await optimizeLevel(bytes, level, api), report = await inspect(result.output, { requireRig: true });
        if (!report.ok || report.model.joints !== 23) throw Error('LOD lost the skin contract.');
        if (result.metrics.triangles > level.triangles * 1.05) throw Error('LOD exceeds the mobile geometry budget.');
        results.push(result); console.log(level.name, result.metrics.triangles);
    }
    fs.mkdirSync(output);
    for (const result of results) { fs.writeFileSync(path.join(output, result.metrics.name + '.glb'), result.output, { flag: 'wx' }); fs.writeFileSync(path.join(output, result.metrics.name + '-intake.json'), JSON.stringify(result.intake, null, 2), { flag: 'wx' }); }
    fs.writeFileSync(path.join(output, 'lod-manifest.json'), JSON.stringify({ version: 1, sourceHash: expectedHash, orientation: { forward: '+X', up: '+Y' }, weightsPreserved: true, levels: results.map(r => r.metrics) }, null, 2), { flag: 'wx' });
    await require('./prepare-home3d-runtime-character.cjs').main(['bunny-blue-v1', 'rig-v1/lod-v1']);
}
module.exports = { main, extraAttributes };
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
