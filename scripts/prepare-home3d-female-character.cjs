'use strict';
// Offline only. This profile belongs to the inspected bunny-blue-v1 source.
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const { sourceContract, optimizeLevel } = require('./optimize-home3d-character.cjs');
const root = path.resolve(__dirname, '..'), sourceHash = 'c22f9662806156539fb143380f18649cabf8917f5de881e7e77cee511de6e684';
function protectedVertices(positions, protection) {
    const locks = new Uint8Array(positions.length / 3);
    for (let i = 0; i < locks.length; i++) {
        const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
        // Native +X front, Y-up, total height 1 including ears. Preserve facial
        // geometry and hands; UV/normal error constraints protect hair/dress.
        const face = x > .065 && y > .18 && y < .27 && Math.abs(z) < .065;
        const hands = y > -.15 && y < -.06 && Math.abs(z) > .24;
        if (protection !== 'none' && (face || (protection === 'face-and-hands' && hands))) locks[i] = 1;
    }
    return locks;
}
async function main() {
    const input = path.join(root, 'artifacts/home3d-models/bunny-blue-v1/character.glb'), directory = path.join(root, 'artifacts/home3d-models/bunny-blue-v1/lod-v2');
    const bytes = fs.readFileSync(input), hash = b => createHash('sha256').update(b).digest('hex');
    if (hash(bytes) !== sourceHash) throw Error('Female source changed; original preserved.');
    if (fs.existsSync(directory)) throw Error('Female LOD outputs already exist; review them instead of overwriting.');
    sourceContract(bytes);
    const dependencies = path.join(root, 'artifacts/home3d-tools/node_modules');
    const api = { ...require(path.join(dependencies, '@gltf-transform/core')), ...require(path.join(dependencies, 'meshoptimizer')), protectedVertices };
    await api.MeshoptSimplifier.ready;
    const levels = [
        { name: 'near', triangles: 100000, error: .003, protect: 'face-and-hands', flags: [] },
        { name: 'middle', triangles: 45000, error: .008, protect: 'face', flags: [] },
        { name: 'far', triangles: 18000, error: .014, protect: 'none', flags: ['Permissive'] }
    ], results = [];
    for (const level of levels) { results.push(await optimizeLevel(bytes, level, api)); console.log(level.name, results.at(-1).metrics.triangles); }
    if (hash(fs.readFileSync(input)) !== sourceHash) throw Error('Source changed during processing.');
    fs.mkdirSync(directory);
    for (const result of results) {
        fs.writeFileSync(path.join(directory, result.metrics.name + '.glb'), result.output, { flag: 'wx' });
        fs.writeFileSync(path.join(directory, result.metrics.name + '-intake.json'), JSON.stringify(result.intake, null, 2), { flag: 'wx' });
    }
    fs.writeFileSync(path.join(directory, 'lod-manifest.json'), JSON.stringify({ version: 1, sourceHash, orientation: { forward: '+X', up: '+Y' }, sourceTriangles: 1469638, levels: results.map(r => r.metrics) }, null, 2), { flag: 'wx' });
    console.log('Static LODs are for review only. Package the validated rig with prepare-home3d-rigged-character.cjs.');
}
module.exports = { main, protectedVertices };
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
