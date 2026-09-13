const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root } = require('./helpers/harness.cjs');

function pixels(width, height, cellX, cellY, mode = 'checker') {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const j = (y * width + x) * 4;
        const tile = mode === 'solid' ? 0 : mode === 'noise' ? ((x * 31 + y * 97 + x * y) % 23) / 23 : (Math.floor(x / cellX) + (mode === 'stripes' ? 0 : Math.floor(y / cellY))) % 2;
        const value = 252 - tile * 20 + ((x * 7 + y * 3) % 3);
        data[j] = data[j + 1] = data[j + 2] = value;
        data[j + 3] = mode === 'transparent' ? 0 : 255;
        if (x > width * .22 && x < width * .78 && y > height * .15 && y < height * .85) {
            data[j] = 120; data[j + 1] = 94; data[j + 2] = 160; data[j + 3] = 255;
        }
    }
    return data;
}

function harness() {
    const context = vm.createContext({ window: {} });
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/pet-proportions.js'), 'utf8'), context);
    return { context, proportions: context.window.ByndPetProportions };
}

for (const [cellX, cellY, ratio] of [[16, 12, 3 / 4], [12, 16, 4 / 3], [24, 16, 2 / 3], [16, 24, 3 / 2], [34, 25.5, 3 / 4], [32, 18, 9 / 16]]) {
    test(`legacy checkerboard detects unequal scaling ${cellX}:${cellY}`, () => {
        const { proportions } = harness();
        const result = proportions.detect(pixels(1024, 1024, cellX, cellY), 1024, 1024);
        assert.ok(result);
        assert.equal(result.ratio, ratio);
        assert.ok(result.regions >= 2);
    });
}

test('unreadable corners can be corroborated by separate checkerboard regions along the edges', () => {
    const { proportions } = harness();
    const data = pixels(1024, 1024, 17, 12.75);
    for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
        if (y >= 155 && y < 869) continue;
        const i = (y * 1024 + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 245;
    }
    const result = proportions.detect(data, 1024, 1024);
    assert.equal(result?.ratio, .75);
    assert.ok(result.regions >= 2);
});

for (const mode of ['checker', 'solid', 'stripes', 'noise', 'transparent']) {
    test(`do not stretch a normal square or infer proportions from ${mode}`, () => {
        const { proportions } = harness();
        assert.equal(proportions.detect(pixels(512, 512, 16, mode === 'checker' ? 16 : 12, mode), 512, 512), null);
    });
}

test('native portrait images stay untouched, even with a decorative rectangular pattern', () => {
    const { proportions } = harness();
    assert.equal(proportions.detect(pixels(384, 512, 16, 12), 384, 512), null);
});

test('correction changes both the PNG canvas and metadata, retaining the whole subject', async () => {
    const { proportions, context } = harness();
    const draws = [];
    context.Image = class {
        naturalWidth = 512; naturalHeight = 512;
        set src(value) { this.url = value; queueMicrotask(() => this.onload()); }
    };
    const canvas = {
        width: 0, height: 0,
        getContext: () => ({ drawImage: (...args) => draws.push(args), getImageData: () => ({ data: pixels(512, 512, 16, 12) }) }),
        toDataURL: () => `png:${canvas.width}x${canvas.height}`
    };
    context.document = { createElement: () => canvas };
    const corrected = await proportions.correct('data:image/png;base64,legacy');
    assert.equal(corrected.width, 512); assert.equal(corrected.height, 683);
    assert.equal(corrected.url, 'png:512x683');
    assert.equal(draws.length, 2);
    assert.deepEqual(draws[1].slice(1), [0, 0, 512, 683], 'correct the full image without cropping its margins');
});
