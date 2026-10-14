'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { verify, decodeModelMirror, portraitBundles } = require('../scripts/check-android-asset-dedup.cjs');
const { resources } = require('../scripts/prepare-pet-background-file-resources.cjs');

test('APK-retained model scripts register the exact reviewed source bytes', () => {
    const result = verify();
    assert.ok(result.modelsVerified >= 31);
    assert.equal(result.backgroundResourcesVerified, 4);
    assert.equal(result.portraitsVerified, 6);
});

test('APK mirror validation rejects missing registration, invalid data and wrong model routing', () => {
    const name = 'assets/home3d/furniture/chair.glb.js';
    assert.throws(() => decodeModelMirror(name, ''), /Missing or duplicate/);
    assert.throws(() => decodeModelMirror(name, 'window.ByndHome3D.Furniture.registerBuffer("chair.glb", "!!!");'), /Invalid model encoding/);
    assert.throws(() => decodeModelMirror(name, 'window.ByndHome3D.Furniture.registerBuffer("other.glb", "Z2xURg==");'), /Wrong model registration/);
});

test('APK staging rejects stale or missing assets and any retained resource pair', t => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-apk-dedup-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    const source = path.join(temp, 'source'), staged = path.join(temp, 'staged');
    const model = 'assets/home3d/furniture/chair.glb', bytes = Buffer.from('glTF reviewed test bytes');
    const mirror = 'window.ByndHome3D.Furniture.registerBuffer("chair.glb", "' + bytes.toString('base64') + '");';
    const write = (dir, relative, data) => { const file = path.join(dir, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
    write(source, model, bytes); write(source, model + '.js', mirror); write(staged, model + '.js', mirror);
    for (const resource of resources) { write(source, resource, 'source bytes'); write(source, resource + '.js', 'preview mirror'); write(staged, resource, 'source bytes'); }
    for (const bundle of portraitBundles) {
        const image = Buffer.from('reviewed image bytes'), directory = 'assets/home3d/characters/';
        const script = 'window.ByndHome3D.' + bundle.key + ' = ' + JSON.stringify({ user: 'data:image/png;base64,' + image.toString('base64'), char: 'data:image/png;base64,' + image.toString('base64') }) + ';';
        for (const who of ['user', 'char']) write(source, directory + bundle[who], image);
        write(source, directory + bundle.script, script); write(staged, directory + bundle.script, script);
    }
    assert.equal(verify(source, staged).modelsVerified, 1);
    const portrait = 'assets/home3d/characters/' + portraitBundles[0].user;
    write(staged, portrait, 'duplicate'); assert.throws(() => verify(source, staged), /Duplicate APK portrait/); fs.unlinkSync(path.join(staged, portrait));
    write(source, portrait, 'stale'); assert.throws(() => verify(source, staged), /Stale portrait bundle/); write(source, portrait, 'reviewed image bytes');
    fs.unlinkSync(path.join(source, model + '.js')); assert.throws(() => verify(source, staged), /ENOENT/);
    write(source, model + '.js', mirror);
    fs.unlinkSync(path.join(staged, model + '.js')); assert.throws(() => verify(source, staged), /ENOENT/);
    write(staged, model + '.js', mirror);
    write(staged, 'assets/vendor/new-runtime/engine.wasm', 'binary'); write(staged, 'assets/vendor/new-runtime/engine.wasm.js', 'mirror');
    assert.throws(() => verify(source, staged), /Duplicate APK resource pair/);
    fs.unlinkSync(path.join(staged, 'assets/vendor/new-runtime/engine.wasm.js'));
    write(source, model + '.js', mirror.replace(bytes.toString('base64'), Buffer.from('stale').toString('base64')));
    assert.throws(() => verify(source, staged), /Stale model mirror/);
    write(source, model + '.js', mirror);
    write(staged, model, bytes); assert.throws(() => verify(source, staged), /Duplicate APK model/); fs.unlinkSync(path.join(staged, model));
    write(staged, resources[0] + '.js', 'preview mirror'); assert.throws(() => verify(source, staged), /Duplicate APK background/); fs.unlinkSync(path.join(staged, resources[0] + '.js'));
    write(staged, resources[0], 'stale'); assert.throws(() => verify(source, staged), /Stale APK background/);
    fs.unlinkSync(path.join(staged, resources[0])); assert.throws(() => verify(source, staged), /ENOENT/);
});
