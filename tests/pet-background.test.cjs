const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection, deferred } = require('./helpers/harness.cjs');

const originalUrl = 'data:image/png;base64,b3JpZ2luYWw=';
function harness({ transparent = false, protocol = 'https:', mode = 'success' } = {}) {
    const width = 24, height = 32, pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        pixels.set(y < height / 2 ? [25, 30, 40, 255] : [255, 255, 255, 255], offset);
        if (transparent && (!x || !y || x === width - 1 || y === height - 1)) pixels[offset + 3] = 0;
    }
    const state = { mode, requests: [], workers: [], revoked: [], timers: new Map(), exports: [], started: deferred(), status: 0 };
    class AssetUrl extends URL {
        static createObjectURL() { return 'blob:test/' + (state.workers.length + 1); }
        static revokeObjectURL(url) { state.revoked.push(url); }
    }
    function canvas() {
        const node = { width: 0, height: 0, pixels: new Uint8ClampedArray() };
        const allocate = () => { if (node.pixels.length !== node.width * node.height * 4) node.pixels = new Uint8ClampedArray(node.width * node.height * 4); };
        node.getContext = () => ({
            drawImage(source, dx, dy, w = source.naturalWidth || source.width, h = source.naturalHeight || source.height) {
                allocate();
                const sw = source.naturalWidth || source.width, sh = source.naturalHeight || source.height;
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                    const from = (Math.min(sh - 1, Math.floor(y * sh / h)) * sw + Math.min(sw - 1, Math.floor(x * sw / w))) * 4;
                    node.pixels.set(source.pixels.subarray(from, from + 4), ((dy + y) * node.width + dx + x) * 4);
                }
            },
            getImageData() { allocate(); return { data: new Uint8ClampedArray(node.pixels) }; },
            createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
            putImageData(image) { allocate(); node.pixels.set(image.data); },
            clearRect() { allocate(); node.pixels.fill(0); }
        });
        node.toDataURL = type => { state.exports.push({ type, width: node.width, height: node.height, pixels: new Uint8ClampedArray(node.pixels) }); return 'data:image/png;base64,cHJvY2Vzc2Vk'; };
        return node;
    }
    class LocalWorker {
        constructor(url) {
            if (state.mode === 'construct-error') throw new Error('worker unavailable');
            this.url = url; this.terminated = false; state.workers.push(this);
        }
        postMessage(data, transfers) {
            state.started.resolve();
            assert.equal(transfers.length, 4);
            assert.equal(data.input.byteLength, 3 * 320 * 320 * 4);
            if (state.mode === 'post-error') throw new Error('transfer unavailable');
            if (state.mode === 'timeout') return;
            queueMicrotask(() => {
                if (state.mode === 'worker-error') return this.onerror();
                if (state.mode === 'model-error') return this.onmessage({ data: { error: 'model failed' } });
                const mask = new Float32Array(320 * 320);
                for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) mask[y * 320 + x] = state.mode === 'invalid-mask' ? NaN : x > 31 && x < 288 && y > 31 && y < 288 ? .98 : .02;
                this.onmessage({ data: { progress: '正在保留人物…' } });
                this.onmessage({ data: { mask: mask.buffer } });
            });
        }
        terminate() { this.terminated = true; }
    }
    class FileRequest {
        open(method, url) { this.url = url; assert.equal(method, 'GET'); }
        send() {
            state.requests.push({url:this.url,transport:'xhr'});
            this.status = state.status; this.response = state.emptyFile ? new ArrayBuffer(0) : new ArrayBuffer(8);
            queueMicrotask(() => state.fileError ? this.onerror() : this.onload());
        }
    }
    let timerId = 0;
    const context = vm.createContext({
        Blob, URL: AssetUrl, AbortSignal, Worker: LocalWorker, XMLHttpRequest: FileRequest,
        console: { warn() {} },
        Image: class { set src(url) { this.url = url; this.naturalWidth = width; this.naturalHeight = height; this.pixels = pixels; queueMicrotask(() => this.onload()); } },
        document: { baseURI: protocol === 'file:' ? 'file:///android_asset/www/index.html' : 'https://bynd.test/index.html', createElement: tag => { assert.equal(tag,'canvas'); return canvas(); } },
        fetch: async url => { state.requests.push({url,transport:'fetch'}); return { ok: !state.resourceFailure, arrayBuffer: async () => new ArrayBuffer(8) }; },
        setTimeout: (fn, delay) => { state.timers.set(++timerId,{fn,delay}); return timerId; },
        clearTimeout: id => state.timers.delete(id)
    });
    context.window = context;
    vm.runInContext(sourceSection('modules/monitor/character-pet.js', 'function analyzeAlpha(', 'function imagePrompt('), context);
    context.ByndCharacterPet = { analyzeAlpha: context.analyzeAlpha };
    context.ByndPetStudio = { sourceData: async source => source };
    vm.runInContext(fs.readFileSync(path.join(root,'modules/monitor/pet-background.js'),'utf8'), context);
    return { state, B:context.ByndPetBackground, pixels, width, height };
}

test('local matting preserves full dimensions and every RGB pixel, including white clothing', async () => {
    const h = harness(), progress = [];
    const result = await h.B.remove(originalUrl, text => progress.push(text));
    assert.equal(result.transparent, true);
    assert.equal(result.width, h.width); assert.equal(result.height, h.height);
    assert.equal(h.state.exports[0].type, 'image/png');
    const output = h.state.exports[0].pixels;
    for (let i = 0; i < output.length; i += 4) assert.deepEqual(Array.from(output.subarray(i,i+3)), Array.from(h.pixels.subarray(i,i+3)));
    assert.equal(output[3], 0);
    assert.equal(output[((h.height - 8) * h.width + 12) * 4 + 3], 255);
    assert.ok(progress.length >= 3);
    assert.equal(h.state.workers.length, 1);
    assert.equal(h.state.workers[0].terminated, true);
    assert.equal(h.state.revoked.length, 1);
    assert.equal(h.state.timers.size, 0);
    assert.equal(h.state.requests.length, 4);
    assert.ok(h.state.requests.every(request => new URL(request.url).origin === 'https://bynd.test'));
});

test('a genuine transparent PNG keeps its exact bytes and bypasses model loading', async () => {
    const h = harness({transparent:true});
    const result = await h.B.remove(originalUrl);
    assert.equal(result.url, originalUrl);
    assert.equal(result.width, h.width); assert.equal(result.height, h.height);
    assert.equal(h.state.requests.length, 0);
    assert.equal(h.state.workers.length, 0);
    assert.equal(h.state.exports.length, 0);
});

for (const mode of ['construct-error','post-error','worker-error','model-error','invalid-mask','timeout']) {
    test(`local processing releases its worker/URL after ${mode} and permits a retry`, async () => {
        const h = harness({mode});
        const pending = h.B.remove(originalUrl);
        const rejected = assert.rejects(pending);
        if (mode === 'timeout') {
            await h.state.started.promise;
            const [id,timer] = [...h.state.timers][0];
            assert.equal(timer.delay, 90000);
            h.state.timers.delete(id); timer.fn();
        }
        await rejected;
        assert.ok(h.state.workers.every(worker=>worker.terminated));
        assert.equal(h.state.revoked.length, 1);
        assert.equal(h.state.exports.length, 0);
        assert.equal(h.state.timers.size, 0);
        h.state.mode = 'success';
        assert.equal((await h.B.remove(originalUrl)).transparent, true);
        assert.ok(h.state.workers.every(worker=>worker.terminated));
    });
}

test('two matting requests run serially without keeping two inference workers alive', async () => {
    const h = harness({mode:'timeout'});
    const first = h.B.remove(originalUrl), second = h.B.remove(originalUrl);
    const rejected = assert.rejects(first);
    await h.state.started.promise;
    assert.equal(h.state.workers.length, 1);
    h.state.mode = 'success';
    h.state.workers[0].onerror();
    await rejected;
    assert.equal((await second).transparent, true);
    assert.equal(h.state.workers.length, 2);
    assert.ok(h.state.workers.every(worker=>worker.terminated));
});

test('packaged Android resources use file XHR with status 0 and no web requests', async () => {
    const h = harness({protocol:'file:'});
    assert.equal((await h.B.remove(originalUrl)).transparent, true);
    assert.equal(h.state.requests.length, 4);
    assert.ok(h.state.requests.every(request=>request.transport === 'xhr' && request.url.startsWith('file:///android_asset/www/') && !request.url.includes('?')));
});

for (const settings of [{status:404},{emptyFile:true},{fileError:true}]) {
    test(`missing or unreadable packaged assets fail without producing a PNG: ${JSON.stringify(settings)}`, async () => {
        const h = harness({protocol:'file:'}); Object.assign(h.state,settings);
        await assert.rejects(h.B.remove(originalUrl), /去背景资源读取失败/);
        assert.equal(h.state.exports.length, 0);
        assert.equal(h.state.workers.length, 0);
    });
}

test('failed HTTP resources leave the source intact and can be loaded on retry', async () => {
    const h = harness(); h.state.resourceFailure = true;
    await assert.rejects(h.B.remove(originalUrl), /资源加载失败/);
    assert.equal(h.state.workers.length, 0);
    assert.equal(h.state.exports.length, 0);
    h.state.resourceFailure = false;
    assert.equal((await h.B.remove(originalUrl)).transparent, true);
});

test('empty, flat, incomplete and nonfinite predictions are never accepted as alpha masks', () => {
    const h = harness();
    for (const mask of [new Float32Array(),new Float32Array(320*320).fill(1),new Float32Array(320*320).fill(NaN),new Float32Array(320*320).fill(Infinity)]) assert.throws(()=>h.B.alphaPixels(mask));
});
