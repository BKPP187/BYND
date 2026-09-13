const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root } = require('./helpers/harness.cjs');

function harness(width, height, transparent = true) {
    const canvases = [];
    class DecodedImage {
        constructor() { this.naturalWidth = width; this.naturalHeight = height; }
        set src(value) { this.url = value; queueMicrotask(() => this.onload()); }
    }
    const context = vm.createContext({
        Blob, Image: DecodedImage,
        document: {
            createElement(tag) {
                assert.equal(tag, 'canvas');
                const canvas = { width: 0, height: 0, draws: [],
                    getContext: () => ({ drawImage: (...args) => canvas.draws.push(args), getImageData: () => ({ data: [] }) }),
                    toDataURL: mime => `${mime}:${canvas.width}x${canvas.height}`
                };
                canvases.push(canvas); return canvas;
            }
        },
        window: { addEventListener() {}, ByndCharacterPet: {
            analyzeAlpha: () => ({ transparent, coverage: 0.4, empty: false, bounds: { left: 20, top: 40, right: 400, bottom: 600 } })
        } }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/pet-studio.js'), 'utf8'), context);
    return { inspect: context.window.ByndPetStudio.inspectImage, canvases };
}

for (const [width, height] of [[1086, 1448], [1080, 1920], [1920, 1080], [1024, 1024]]) {
    for (const transparent of [true, false]) {
        test(`PNG ${width}x${height}, alpha=${transparent}: inspection preserves original bytes and dimensions`, async () => {
            const { inspect, canvases } = harness(width, height, transparent);
            const original = 'data:image/png;base64,b3JpZ2luYWwtYnl0ZXM=';
            const result = await inspect(original);
            assert.equal(result.url, original);
            assert.equal(result.width, width);
            assert.equal(result.height, height);
            assert.equal(result.transparent, transparent);
            assert.equal(canvases.length, 1, 'inspection must not reframe transparent images onto a square');
            assert.ok(Math.max(canvases[0].width, canvases[0].height) <= 1536, 'only the analysis copy is reduced');
        });
    }
}

test('non-PNG candidates are converted at their original dimensions without subject cropping', async () => {
    const { inspect, canvases } = harness(1200, 2000, false);
    const result = await inspect('data:image/jpeg;base64,dGVzdA==');
    assert.equal(result.url, 'image/png:1200x2000');
    assert.equal(result.width, 1200); assert.equal(result.height, 2000);
    assert.equal(canvases[0].draws.at(-1).length, 3, 'conversion draws the whole original at (0,0)');
});

test('identity reference optimization keeps its aspect ratio independently of candidate export', async () => {
    const { inspect } = harness(1080, 1920);
    const result = await inspect('data:image/png;base64,dGVzdA==', true);
    assert.equal(result.width, 900); assert.equal(result.height, 1600);
    assert.equal(result.kind, 'reference');
});
