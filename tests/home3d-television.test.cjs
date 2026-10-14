'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function setup(noCanvas = false) {
    let canvases = 0;
    const drawing = Object.fromEntries(['fillRect', 'beginPath', 'arc', 'ellipse', 'fill', 'moveTo', 'lineTo', 'bezierCurveTo', 'save', 'translate', 'restore'].map(name => [name, () => {}]));
    const context = vm.createContext({ window: { ByndHome3D: {} }, console, AbortController, document: { createElement: () => { canvases++; return { width: 0, height: 0, getContext: () => noCanvas ? null : drawing }; } } });
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/vendor/home3d/engine.js'), 'utf8'), context);
    for (const name of ['materials', 'television']) vm.runInContext(fs.readFileSync(path.join(root, 'apps/home3d', name + '.js'), 'utf8'), context);
    const H = context.window.ByndHome3D, T = context.ByndHomeEngine, model = new T.Group();
    H.Television.screen(model, .7, .4, [0, .4, .1]);
    const row = { model, placement: { id: 'tv' } }, actor = { root: new T.Group(), path: [], action: 'Watch', anchor: { placementId: 'tv', watchingTV: true } };
    return { H, row, actor, tv: model.userData.television, canvases: () => canvases };
}
test('television uploads a bounded mipmapped programme only for actual seated viewers and releases its own resources', () => {
    const { H, row, actor, tv, canvases } = setup(), update = (time, reduced = false) => H.Television.update([row], [actor], time, { tier: 'smooth' }, reduced);
    actor.path = [{ x: 0, z: 0 }]; update(0); assert.equal(tv.frames, 0); assert.equal(canvases(), 0);
    actor.path = []; update(0); assert.equal(tv.playing, true); assert.equal(tv.frames, 1); assert.equal(canvases(), 1);
    assert.equal(tv.texture.image.width, 512); assert.equal(tv.texture.image.height, 256); assert.equal(tv.texture.generateMipmaps, true);
    assert.equal(tv.screen.material.toneMapped, false);
    update(100); update(249); assert.equal(tv.frames, 1); update(250); assert.equal(tv.frames, 2); assert.equal(canvases(), 1);
    update(500, true); assert.equal(tv.frames, 2, 'reduced motion holds a still picture');
    actor.root.visible = false; update(800); assert.equal(tv.playing, false); assert.equal(tv.screen.material.map, null);
    update(2000); assert.equal(tv.frames, 2, 'off screen has no texture uploads');
    actor.root.visible = true; actor.action = 'Read'; update(2200); assert.equal(tv.playing, false);
    actor.action = 'Watch'; update(2500); assert.equal(tv.playing, true); assert.equal(canvases(), 1);
    let copied = 0; tv.texture.image = { width: 256, height: 128, getContext: () => ({ drawImage: () => copied++ }) };
    update(2750); assert.equal(copied, 1, 'quality-downsized screen keeps animating'); assert.equal(tv.texture.image.width, 256);
    let textures = 0, materials = 0; tv.texture.addEventListener('dispose', () => textures++); tv.screen.material.addEventListener('dispose', () => materials++);
    H.Shapes.disposeGeometry(row.model); assert.equal(textures, 1); assert.equal(materials, 1);
});
test('unsupported canvas never reports a running television programme', () => {
    const { H, row, actor, tv, canvases } = setup(true); let notices = 0;
    for (const time of [0, 200, 500]) H.Television.update([row], [actor], time, { tier: 'balanced' }, false, () => notices++);
    assert.equal(tv.playing, false); assert.equal(tv.frames, 0); assert.equal(tv.screen.material.map, null);
    assert.equal(notices, 1); assert.equal(canvases(), 1);
});
