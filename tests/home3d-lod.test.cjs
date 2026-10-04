'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const LOD = require('../apps/home3d/character-lod.js');
const { protectedVertices, sourceContract, main } = require('../scripts/optimize-home3d-character.cjs');
test('close zoom selects near detail and hysteresis prevents threshold flicker', () => {
    assert.equal(LOD.select(800), 'near'); assert.equal(LOD.select(300), 'middle'); assert.equal(LOD.select(120), 'far');
    let current = 'middle';
    for (const pixels of [490, 502, 480, 525, 505]) { current = LOD.select(pixels, current); assert.equal(current, 'middle'); }
    assert.equal(LOD.select(600, current), 'near'); assert.equal(LOD.select(470, 'near'), 'near');
    assert.equal(LOD.select(350, 'near'), 'middle'); assert.equal(LOD.select(100, 'near'), 'far');
    assert.equal(LOD.select(900, 'far'), 'near'); assert.equal(LOD.select(Infinity, 'far'), 'near');
    for (const bad of [NaN, -1, '500']) assert.throws(() => LOD.select(bad), /无效/);
    assert.throws(() => LOD.select(100, 'unknown'), /未知/);
});
test('orthographic zoom changes projected size even when camera distance stays fixed', () => {
    const context = { AbortController }; require('node:vm').runInNewContext(fs.readFileSync(path.resolve(__dirname, '../assets/vendor/home3d/engine.js'), 'utf8'), context);
    const T = context.ByndHomeEngine;
    const box = new T.Box3(new T.Vector3(-.5, 0, -.5), new T.Vector3(.5, 1.8, .5));
    const camera = new T.OrthographicCamera(-3, 3, 3, -3, .01, 100); camera.position.set(0, 1, 7); camera.lookAt(0, 1, 0);
    const far = LOD.projectedHeight(box, camera, 600, T); assert.ok(Math.abs(far - 180) < .01);
    camera.zoom = 4; camera.updateProjectionMatrix();
    const near = LOD.projectedHeight(box, camera, 600, T); assert.ok(Math.abs(near / far - 4) < .001); assert.equal(LOD.select(near), 'near');
    assert.throws(() => LOD.projectedHeight(box, camera, 0, T), /无法/);
    const perspective = new T.PerspectiveCamera(45, 1, .01, 100); perspective.position.set(0, 1, 0); perspective.lookAt(0, 1, -1);
    assert.equal(LOD.projectedHeight(box, perspective, 600, T), Infinity);
});
test('near protection keeps face and hands, with separate far simplification', () => {
    const points = new Float32Array([.05, .3, 0, 0, -.1, .2, 0, -.3, 0]);
    assert.deepEqual([...protectedVertices(points, 'face-and-hands')], [1, 1, 0]);
    assert.deepEqual([...protectedVertices(points, 'face')], [1, 0, 0]);
    assert.deepEqual([...protectedVertices(points, 'none')], [0, 0, 0]);
});
test('offline preparation rejects unexpected inputs without overwriting the source or prior output', async () => {
    const fixture = path.resolve(__dirname, '../assets/home3d/furniture/q-Sofa.glb');
    const before = fs.readFileSync(fixture);
    assert.throws(() => sourceContract(Buffer.from('not a model')), /glTF/);
    await assert.rejects(main([fixture, path.dirname(fixture)]), /already exists/);
    const output = path.resolve(__dirname, '../artifacts/unexpected-character-never-written');
    await assert.rejects(main([fixture, output]), /silver-red-v1 only/);
    assert.equal(fs.existsSync(output), false); assert.deepEqual(fs.readFileSync(fixture), before);
});
