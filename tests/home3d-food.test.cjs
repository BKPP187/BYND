'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
test('food models preserve reviewed CC0 provenance, offline bytes and bounded mobile geometry', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/home3d/food-manifest.json')));
    assert.equal(manifest.license, 'CC0-1.0'); assert.ok(manifest.commercialUse && manifest.modificationAllowed);
    assert.match(fs.readFileSync(path.join(root, manifest.licenseFile), 'utf8'), /commercial purposes/);
    assert.equal(manifest.assets.length, 16); let total = 0;
    for (const asset of manifest.assets) {
        const bytes = fs.readFileSync(path.join(root, 'assets/home3d/furniture', asset.file)); total += bytes.length;
        assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256); assert.equal(bytes.length, asset.bytes);
        assert.ok(asset.triangles < 800);
        const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
        assert.ok(doc.meshes.length === 1 && doc.meshes[0].primitives.length === 1);
        assert.ok(doc.images.every(image => image.bufferView !== undefined && !image.uri));
        assert.ok(doc.buffers.every(buffer => !buffer.uri));
        let mirror; vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/home3d/furniture', asset.file + '.js'), 'utf8'), { window: { ByndHome3D: { Furniture: { registerBuffer(name, encoded) { assert.equal(name, asset.file); mirror = Buffer.from(encoded, 'base64'); } } } } });
        assert.deepEqual(mirror, bytes);
    }
    assert.ok(total < 600000, 'all 16 model packages stay below 600KB');
    const context = vm.createContext({ window: { ByndHome3D: {} } }); vm.runInContext(fs.readFileSync(path.join(root, 'apps/home3d/foods.js'), 'utf8'), context);
    const F = context.window.ByndHome3D.Foods;
    assert.equal(Object.keys(F.menus).length, 4);
    for (const menu of Object.values(F.menus)) for (const id of menu.foods) assert.ok(manifest.assets.some(a => a.id === id));
    const now = new Date(2026, 9, 12, 8).getTime(), pinned = {}; F.remember(pinned, 'sushi', now);
    assert.equal(F.selected(pinned, 8, now), 'sushi'); assert.equal(F.selected(pinned, 19, now), 'supper', 'a chosen dish holds for that meal only');
    assert.equal(F.selected(pinned, 8, now + 86400000), 'breakfast', 'and not on the next day'); assert.equal(F.selected({ mealId: 'sushi' }, 8), 'breakfast', 'undated legacy picks expire'); assert.equal(F.selected({}, 8), 'breakfast'); assert.equal(F.selected({}, 19), 'supper');
    assert.equal(F.selected({ mealId: '__proto__' }, 8), 'breakfast');
});
