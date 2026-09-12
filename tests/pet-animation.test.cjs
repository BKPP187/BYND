const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root } = require('./helpers/harness.cjs');

function harness() {
    const context = vm.createContext({ window: { myCharacters: [] }, document: { addEventListener() {} }, console, Uint8Array, Uint8ClampedArray, ArrayBuffer, setTimeout, clearTimeout });
    for (const file of ['assets/vendor/gifenc.js', 'assets/vendor/omggif.js', 'modules/monitor/character-pet.js', 'modules/monitor/pet-animation.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    return context.window;
}
function frame(offset = 0) {
    const pixels = new Uint8ClampedArray(32 * 32 * 4);
    for (let y = 8; y < 24; y++) for (let x = 8 + offset; x < 20 + offset; x++) pixels.set([140, 170, 105, 255], (y * 32 + x) * 4);
    return pixels;
}

test('GIF encoding writes real, distinct transparent frames with timing and disposal', () => {
    const { ByndPetAnimation: A, ByndGifReader: R } = harness();
    const bytes = A.encodeFrames([frame(0), frame(1), frame(2), frame(1)], 32, 32, 240);
    assert.equal(Buffer.from(bytes.slice(0, 6)).toString(), 'GIF89a');
    const decoded = A.decodeGif(bytes);
    assert.equal(decoded.width, 32); assert.equal(decoded.height, 32);
    assert.equal(decoded.frames, 4); assert.equal(decoded.durationMs, 960);
    assert.equal(decoded.first[3], 0);
    assert.equal(decoded.first[(10 * 32 + 10) * 4 + 3], 255);
    const reader = new R.GifReader(bytes);
    assert.equal(reader.loopCount(), 0);
    const frames = [];
    for (let i = 0; i < 4; i++) {
        assert.equal(reader.frameInfo(i).disposal, 2);
        assert.equal(reader.frameInfo(i).delay, 24);
        const pixels = new Uint8ClampedArray(32 * 32 * 4); reader.decodeAndBlitFrameRGBA(i, pixels); frames.push(pixels);
    }
    assert.notDeepEqual(frames[0], frames[1]);
});

test('GIF generation rejects static copies, empty frames, opaque frames and invalid dimensions', () => {
    const { ByndPetAnimation: A } = harness();
    assert.throws(() => A.encodeFrames([frame(), frame()], 32, 32), /完全相同/);
    assert.throws(() => A.encodeFrames([frame(), new Uint8ClampedArray(32 * 32 * 4)], 32, 32), /每一帧/);
    const opaque = frame(1); for (let i = 3; i < opaque.length; i += 4) opaque[i] = 255;
    assert.throws(() => A.encodeFrames([frame(), opaque], 32, 32), /透明背景/);
    assert.throws(() => A.encodeFrames([frame(), frame(1)], 8192, 8192), /尺寸/);
});

test('GIF upload validation checks every frame and rejects opaque or oversized animations', () => {
    const { ByndPetAnimation: A, ByndGifEncoder: E } = harness();
    const gif = E.GIFEncoder();
    const palette = [[0, 0, 0], [120, 160, 90]];
    const first = new Uint8Array(32 * 32);
    for (let y = 8; y < 24; y++) for (let x = 8; x < 20; x++) first[y * 32 + x] = 1;
    gif.writeFrame(first, 32, 32, { palette, transparent: true, transparentIndex: 0, delay: 240, dispose: 2 });
    gif.writeFrame(new Uint8Array(32 * 32).fill(1), 32, 32, { palette, delay: 240, dispose: 2 });
    gif.finish();
    assert.throws(() => A.decodeGif(gif.bytes()), /第 2 帧/);
    const valid = A.encodeFrames([frame(), frame(1)], 32, 32);
    const oversized = new Uint8Array(valid); oversized[6] = 0; oversized[7] = 16;
    assert.throws(() => A.decodeGif(oversized), /边长/);
    assert.throws(() => A.decodeGif(new Uint8Array([1, 2, 3])), /GIF/i);
});

test('matte selection avoids existing character colors, including small opaque details', () => {
    const { ByndPetAnimation: A } = harness();
    const pixels = frame();
    pixels.set([0, 255, 0, 255], (9 * 32 + 9) * 4);
    assert.notDeepEqual(Array.from(A.chooseMatte(pixels)), [0, 255, 0]);
    const colorful = new Uint8ClampedArray([0, 255, 0, 255, 255, 0, 255, 255, 0, 255, 255, 255, 255, 255, 0, 255, 0, 0, 255, 255, 255, 0, 0, 255]);
    assert.equal(A.chooseMatte(colorful), null);
});

test('opaque keyed frames become transparent without removing white hair, dark clothes or enclosed prop gaps', () => {
    const { ByndPetAnimation: A, ByndCharacterPet: C } = harness();
    const pixels = new Uint8ClampedArray(32 * 32 * 4);
    for (let at = 0; at < pixels.length; at += 4) pixels.set([0, 255, 0, 255], at);
    for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) pixels.set(y < 12 ? [255, 255, 255, 255] : [16, 16, 16, 255], (y * 32 + x) * 4);
    pixels.set([0, 255, 0, 255], (18 * 32 + 18) * 4); // A gap enclosed by the arm/prop.
    pixels.set([4, 195, 4, 255], (16 * 32 + 7) * 4); // A 25% opaque edge of a dark sleeve.
    pixels.set([128, 128, 128, 255], (15 * 32 + 8) * 4); // A gray sleeve edge must stay opaque gray.
    const before = pixels.slice();
    const result = A.framePixels(pixels, 32, 32, [0, 255, 0], 0).pixels;
    assert.equal(C.analyzeAlpha(result, 32, 32).transparent, true);
    assert.equal(result[3], 0);
    assert.equal(result[(18 * 32 + 18) * 4 + 3], 0);
    assert.deepEqual(Array.from(result.slice((10 * 32 + 10) * 4, (10 * 32 + 10) * 4 + 4)), [255, 255, 255, 255]);
    assert.deepEqual(Array.from(result.slice((16 * 32 + 10) * 4, (16 * 32 + 10) * 4 + 4)), [16, 16, 16, 255]);
    assert.deepEqual(Array.from(result.slice((16 * 32 + 7) * 4, (16 * 32 + 7) * 4 + 4)), [16, 16, 16, 64]);
    assert.deepEqual(Array.from(result.slice((15 * 32 + 8) * 4, (15 * 32 + 8) * 4 + 4)), [128, 128, 128, 255]);
    assert.deepEqual(pixels, before);
});

test('background processing rejects missing subjects, unknown backgrounds and subjects cut at a cell boundary', () => {
    const { ByndPetAnimation: A } = harness();
    const flat = new Uint8ClampedArray(32 * 32 * 4);
    for (let at = 0; at < flat.length; at += 4) flat.set([0, 255, 0, 255], at);
    assert.throws(() => A.framePixels(flat, 32, 32, [0, 255, 0], 0), error => error.animationCode === 'empty');
    for (let at = 0; at < flat.length; at += 4) flat.set([240, 240, 240, 255], at);
    assert.throws(() => A.framePixels(flat, 32, 32, [0, 255, 0], 1), error => error.animationCode === 'background' && /第 2 格/.test(error.message));
    const cut = frame();
    for (let x = 10; x < 14; x++) cut.set([20, 20, 20, 255], x * 4);
    assert.throws(() => A.framePixels(cut, 32, 32, [0, 255, 0], 0), error => error.animationCode === 'layout');
    assert.deepEqual(Array.from(A.framePixels(frame(), 32, 32, [0, 255, 0], 0).pixels), Array.from(frame()));
});

test('matte processing restores light foreground colors along a two-pixel antialiased edge', () => {
    const { ByndPetAnimation: A } = harness();
    const key = [255, 0, 255], hair = [239, 224, 197];
    const pixels = new Uint8ClampedArray(32 * 32 * 4);
    for (let at = 0; at < pixels.length; at += 4) pixels.set([...key, 255], at);
    for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) pixels.set([...hair, 255], (y * 32 + x) * 4);
    for (const [x, alpha] of [[6, 0.25], [7, 0.75]]) pixels.set([...hair.map((value, channel) => Math.round(value * alpha + key[channel] * (1 - alpha))), 255], (16 * 32 + x) * 4);
    const result = A.framePixels(pixels, 32, 32, key, 0).pixels;
    for (const [x, alpha] of [[6, 64], [7, 191]]) {
        const at = (16 * 32 + x) * 4;
        assert.ok(Math.abs(result[at + 3] - alpha) <= 1);
        for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(result[at + channel] - hair[channel]) <= 2);
    }
});
