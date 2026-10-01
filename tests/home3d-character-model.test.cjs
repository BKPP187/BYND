'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readDocument, summarize, inspect } = require('../scripts/check-home3d-character-model.cjs');

function glb(document) {
    const json = Buffer.from(JSON.stringify(document).padEnd(Math.ceil(JSON.stringify(document).length / 4) * 4, ' '));
    const bytes = Buffer.alloc(20 + json.length);
    bytes.writeUInt32LE(0x46546c67, 0);
    bytes.writeUInt32LE(2, 4);
    bytes.writeUInt32LE(bytes.length, 8);
    bytes.writeUInt32LE(json.length, 12);
    bytes.writeUInt32LE(0x4e4f534a, 16);
    json.copy(bytes, 20);
    return bytes;
}

test('model intake rejects an image, truncated GLB and external model resources', () => {
    assert.throws(() => readDocument(Buffer.from('a PNG is not a mesh')), /binary glTF/);
    const bytes = glb({ asset: { version: '2.0' } });
    assert.throws(() => readDocument(bytes.subarray(0, bytes.length - 1)), /length/);
    assert.throws(() => readDocument(glb({ images: [{ uri: 'https://example.com/face.png' }] })), /self-contained/);
    assert.throws(() => readDocument(glb({ buffers: [{ uri: '../private.bin' }] })), /self-contained/);
});

test('unused skeletons and camera animations cannot pass as an animated actor', () => {
    const document = {
        scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }, { name: 'unused-joint' }, { name: 'camera' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ count: 36 }],
        skins: [{ joints: [1] }], animations: [{ name: 'camera-pan', channels: [{ target: { node: 2 } }] }]
    };
    assert.equal(summarize(document).joints, 0);
    assert.equal(summarize(document).boneAnimationCount, 0);
    document.nodes[0].skin = 0;
    assert.equal(summarize(document).joints, 1);
    assert.equal(summarize(document).boneAnimationCount, 0);
});

let available = false;
try { require.resolve('../artifacts/home3d-tools/node_modules/gltf-validator'); available = true; } catch {}
test('official glTF validation distinguishes a static mesh from a rig and fails malformed accessors', { skip: available ? false : 'Install optional offline gltf-validator tool to run this integration check.' }, async () => {
    const file = path.resolve(__dirname, '../assets/home3d/furniture/q-Sofa.glb');
    const bytes = fs.readFileSync(file);
    const staticReport = await inspect(bytes);
    assert.equal(staticReport.ok, true);
    assert.equal(staticReport.stage, 'static-mesh-for-review');
    assert.ok(staticReport.reviewRequired.length);
    const rigReport = await inspect(bytes, { requireRig: true });
    assert.equal(rigReport.ok, false);
    assert.match(rigReport.errors.join(' '), /skeleton/);
    const invalid = await inspect(glb({ asset: { version: '2.0' }, accessors: [{ componentType: 5126, count: -1, type: 'VEC3' }] }));
    assert.equal(invalid.ok, false);
    assert.ok(invalid.validation.issues.numErrors > 0);
    const cli = spawnSync(process.execPath, ['scripts/check-home3d-character-model.cjs', file, '--require-animations'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
    assert.equal(cli.status, 1);
    assert.equal(JSON.parse(cli.stdout).ok, false);
});
