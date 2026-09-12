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
