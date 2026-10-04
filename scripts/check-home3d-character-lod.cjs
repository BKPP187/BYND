'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { createHash } = require('node:crypto');
const { inspect } = require('./check-home3d-character-model.cjs');
const { protectedVertices } = require('./optimize-home3d-character.cjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function vertexKey(primitive, index) {
    const values = new Float32Array(8); let offset = 0;
    for (const semantic of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
        const attribute = primitive.getAttribute(semantic), size = attribute.getElementSize();
        values.set(attribute.getArray().subarray(index * size, (index + 1) * size), offset); offset += size;
    }
    return Buffer.from(values.buffer).toString('base64');
}
async function main(args = process.argv.slice(2)) {
    if (args.length !== 2) throw new Error('Usage: node scripts/check-home3d-character-lod.cjs <source.glb> <lod-directory>');
    const { NodeIO } = require(path.resolve(__dirname, '../artifacts/home3d-tools/node_modules/@gltf-transform/core'));
    const io = new NodeIO(), sourceBytes = fs.readFileSync(args[0]), directory = path.resolve(args[1]);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'lod-manifest.json'), 'utf8'));
    assert.equal(hash(sourceBytes), manifest.sourceHash, 'Original model changed');
    const original = await io.readBinary(sourceBytes), source = original.getRoot().listMeshes()[0].listPrimitives()[0];
    const imageHashes = original.getRoot().listTextures().map(texture => hash(texture.getImage())).sort();
    const result = { sourcePreserved: true, textureImagesUnchanged: true, levels: [] };
    for (const level of manifest.levels) {
        assert.ok(['near', 'middle', 'far'].includes(level.name), 'Unexpected LOD file');
        const bytes = fs.readFileSync(path.join(directory, level.name + '.glb')); assert.equal(hash(bytes), level.sha256); assert.equal(bytes.length, level.bytes);
        const intake = await inspect(bytes); assert.equal(intake.ok, true); assert.equal(intake.model.joints, 0); assert.equal(intake.model.boneAnimationCount, 0);
        const document = await io.readBinary(bytes), primitive = document.getRoot().listMeshes()[0].listPrimitives()[0];
        assert.deepEqual(document.getRoot().listTextures().map(texture => hash(texture.getImage())).sort(), imageHashes, 'Texture images were changed');
        assert.equal(primitive.getIndices().getCount() / 3, level.triangles); assert.ok(level.triangles < source.getIndices().getCount() / 3);
        const locks = protectedVertices(source.getAttribute('POSITION').getArray(), level.protect), required = new Set();
        for (let i = 0; i < locks.length; i++) if (locks[i]) required.add(vertexKey(source, i));
        const protectedCount = required.size;
        for (let i = 0; i < primitive.getAttribute('POSITION').getCount(); i++) required.delete(vertexKey(primitive, i));
        assert.equal(required.size, 0, 'Protected face/hand attributes are missing');
        result.levels.push({ name: level.name, triangles: level.triangles, bytes: level.bytes, protectedAttributeTuplesPreserved: protectedCount, validationErrors: intake.validation.issues.numErrors });
    }
    assert.equal(hash(fs.readFileSync(args[0])), manifest.sourceHash);
    fs.writeFileSync(path.join(directory, 'preservation-review.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
}
module.exports = { main, vertexKey };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
