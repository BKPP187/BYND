const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

class FakeFileReader {
    readAsDataURL(blob) {
        blob.arrayBuffer().then(buffer => {
            this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
            this.onload?.();
        }, error => this.onerror?.(error));
    }
}

function naiContext(extra = {}) {
    const context = vm.createContext({
        window: {}, console, Blob, Response, Uint8Array, Uint32Array, DataView, JSON, Math, Date, Number, String, Array, Object, Promise, Error, Set, Map,
        AbortController, DecompressionStream, FileReader: FakeFileReader, crypto: globalThis.crypto,
        // Waits shorter than a minute run at once; the long request timeout never fires.
        setTimeout: (fn, ms) => { if (ms < 60000) queueMicrotask(fn); return 1; },
        clearTimeout: () => {},
        ...extra
    });
    vm.runInContext(read('core/api/novelai.js'), context);
    return context;
}

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);
function zip(data, method) {
    const body = method === 8 ? zlib.deflateRawSync(data) : data;
    const name = Buffer.from('image_0.png');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(method, 10);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
    const offset = local.length + name.length + body.length;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
    end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([local, name, body, central, name, end]);
}

test('V4.5 payload matches NovelAI multi-character format with quality tags and UC preset', () => {
    const { buildNovelAiImagePayload } = naiContext();
    const payload = buildNovelAiImagePayload({
        prompt: '1boy, 1girl, rain, night', negative: 'extra fingers', seed: 7, width: 832, height: 1216,
        characters: [{ prompt: 'boy, black hair, source#hug', x: 0.3, y: 0.5 }, { prompt: 'girl, target#hug', x: 0.7, y: 0.5 }]
    }, { token: 'pst-x', model: 'nai-diffusion-4-5-full' });
    assert.equal(payload.model, 'nai-diffusion-4-5-full');
    assert.equal(payload.action, 'generate');
    assert.equal(payload.input, '1boy, 1girl, rain, night, location, very aesthetic, masterpiece, no text');
    const p = payload.parameters;
    assert.equal(p.params_version, 3);
    assert.equal(p.n_samples, 1);
    assert.equal(p.steps, 28);
    assert.equal(p.seed, 7);
    assert.equal(p.extra_noise_seed, 7);
    assert.match(p.negative_prompt, /^lowres, artistic error, film grain/);
    assert.match(p.negative_prompt, /extra fingers$/);
    assert.equal(p.v4_prompt.caption.base_caption, payload.input);
    assert.deepEqual(JSON.parse(JSON.stringify(p.v4_prompt.caption.char_captions)), [
        { char_caption: 'boy, black hair, source#hug', centers: [{ x: 0.3, y: 0.5 }] },
        { char_caption: 'girl, target#hug', centers: [{ x: 0.7, y: 0.5 }] }
    ]);
    assert.equal(p.v4_prompt.use_coords, true);
    assert.equal(p.v4_negative_prompt.caption.char_captions.length, 2);
    assert.equal(p.v4_negative_prompt.use_coords, false);
    assert.equal(p.skip_cfg_above_sigma, undefined, 'Variety+ stays off unless enabled');
});

test('Opus free mode keeps generations inside the Anlas-free limits', () => {
    const { buildNovelAiImagePayload, fitNovelAiImageSize } = naiContext();
    const free = buildNovelAiImagePayload({ prompt: 'x', width: 1536, height: 1536 }, { token: 't', steps: 40, opusFree: true }).parameters;
    assert.ok(free.width * free.height <= 1024 * 1024);
    assert.equal(free.width % 64, 0);
    assert.equal(free.steps, 28);
    const paid = buildNovelAiImagePayload({ prompt: 'x', width: 1536, height: 1536 }, { token: 't', steps: 40, opusFree: false }).parameters;
    assert.equal(paid.width, 1536);
    assert.equal(paid.steps, 40);
    const tall = fitNovelAiImageSize(704, 1472, true);
    assert.deepEqual([tall.width, tall.height], [704, 1472]);
});

test('V5 uses params version 4; V3 folds characters into one prompt', () => {
    const { buildNovelAiImagePayload } = naiContext();
    assert.equal(buildNovelAiImagePayload({ prompt: 'x' }, { model: 'nai-diffusion-5-full' }).parameters.params_version, 4);
    const v3 = buildNovelAiImagePayload({ prompt: '2girls', characters: [{ prompt: 'girl, red hair' }] }, { model: 'nai-diffusion-3', qualityTags: false });
    assert.equal(v3.input, '2girls, girl, red hair');
    assert.equal(v3.parameters.v4_prompt, undefined);
});

test('type-specific drops remove preset negatives such as negative space for wallpapers', () => {
    const { buildNovelAiImagePayload } = naiContext();
    const payload = buildNovelAiImagePayload({ prompt: 'scenery', dropNegative: ['negative space'] }, {});
    assert.doesNotMatch(payload.parameters.negative_prompt, /negative space/);
    assert.match(payload.parameters.negative_prompt, /blank page/);
});

test('the image archive reader accepts stored and deflated PNG entries and rejects junk', async () => {
    const { readNovelAiImageArchive } = naiContext();
    assert.deepEqual(Buffer.from(await readNovelAiImageArchive(zip(png, 0))), png);
    assert.deepEqual(Buffer.from(await readNovelAiImageArchive(zip(png, 8))), png);
    assert.deepEqual(Buffer.from(await readNovelAiImageArchive(png)), png);
    await assert.rejects(readNovelAiImageArchive(Buffer.from('<html>error</html>'.padEnd(40, ' '))), /不是图片压缩包/);
    await assert.rejects(readNovelAiImageArchive(zip(Buffer.from('not a png at all, sorry'), 0)), /没有可用图片/);
});

test('generation retries a busy account once and returns a PNG data URL', async () => {
    const calls = [];
    const responses = [
        new Response('{"statusCode":429,"message":"Concurrent generation is locked"}', { status: 429 }),
        new Response(zip(png, 8), { status: 200 })
    ];
    const context = naiContext({ fetch: async (url, init) => { calls.push({ url, init }); return responses.shift(); } });
    const result = await context.callNovelAiImageGeneration({ prompt: '1girl', width: 832, height: 1216 }, { settings: { token: 'pst-secret-token-123' } });
    assert.equal(result.ok, true);
    assert.match(result.url, /^data:image\/png;base64,/);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://image.novelai.net/ai/generate-image');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer pst-secret-token-123');
    assert.equal(JSON.parse(calls[0].init.body).parameters.width, 832);
});

test('generation failures explain the cause without leaking the token', async () => {
    const context = naiContext({ fetch: async () => new Response('{"statusCode":401,"message":"bad token pst-secret-token-123"}', { status: 401 }) });
    const result = await context.callNovelAiImageGeneration({ prompt: 'x' }, { settings: { token: 'pst-secret-token-123' } });
    assert.equal(result.ok, false);
    assert.match(result.error, /Token 无效或已过期/);
    assert.doesNotMatch(result.error, /pst-secret-token-123/);
    const missing = await naiContext().callNovelAiImageGeneration({ prompt: 'x' }, { settings: {} });
    assert.match(missing.error, /还没有填写 NovelAI Token/);
    const quota = await naiContext({ fetch: async () => new Response('{"message":"not enough Anlas"}', { status: 402 }) }).callNovelAiImageGeneration({ prompt: 'x' }, { settings: { token: 't' } });
    assert.match(quota.error, /Anlas 余额不足/);
});

test('connection test reads tier, Anlas and the free-generation rule', async () => {
    const context = naiContext({ fetch: async (url, init) => {
        assert.equal(url, 'https://image.novelai.net/user/subscription');
        assert.equal(init.headers.Authorization, 'Bearer pst-abc');
        return new Response(JSON.stringify({ tier: 3, active: true, trainingStepsLeft: { fixedTrainingStepsLeft: 1000, purchasedTrainingSteps: 50 } }), { status: 200 });
    } });
    const status = await context.testNovelAiImageConnection({ token: 'pst-abc' });
    assert.equal(status.ok, true);
    assert.equal(status.summary, '订阅有效 · Opus · Anlas 1050');
    assert.match(status.notes[0], /Opus 免费档/);
});

function routeContext(data, extra = {}) {
    const context = naiContext({ alert() {}, ...extra });
    let saved = null;
    Object.assign(context, {
        getApiData: () => JSON.parse(JSON.stringify(saved || data)),
        saveApiData: next => { saved = next; },
        renderApiList() {},
        escapeHtml: value => String(value),
        document: { getElementById: () => null }
    });
    vm.runInContext(read('apps/settings/image-provider.js'), context);
    return { context, saved: () => saved };
}

test('image routes pick NovelAI for comics and the relay for chat pictures by default', () => {
    const relay = { id: 'a', name: '中转', imageModel: 'gpt-image-1' };
    const both = routeContext({ apis: [relay], imageDefaultId: 'a', novelAiImageApi: { token: 'pst-1' } }).context;
    assert.equal(both.getImageRouteForFeature('comic').provider, 'novelai');
    assert.equal(both.getImageRouteForFeature('comic').label, 'NovelAI · V4.5 Full');
    assert.equal(both.getImageRouteForFeature('chat').provider, 'api');
    const chosen = routeContext({ apis: [relay], imageDefaultId: 'a', novelAiImageApi: { token: 'pst-1' }, imageRoutes: { comic: 'api', chat: 'novelai' } }).context;
    assert.equal(chosen.getImageRouteForFeature('comic').provider, 'api');
    assert.equal(chosen.getImageRouteForFeature('chat').provider, 'novelai');
    // A preferred provider that is not configured falls back to the configured one.
    const onlyNai = routeContext({ apis: [], novelAiImageApi: { token: 'pst-1' }, imageRoutes: { chat: 'api' } }).context;
    assert.equal(onlyNai.getImageRouteForFeature('chat').provider, 'novelai');
    const disabled = routeContext({ apis: [], novelAiImageApi: { token: 'pst-1', enabled: false } }).context;
    assert.equal(disabled.getImageRouteForFeature('comic').provider, '');
});

test('choosing a route that is not configured does not save it', () => {
    let opened = 0;
    const setup = routeContext({ apis: [], novelAiImageApi: {} });
    setup.context.openNovelAiImageModal = () => { opened++; };
    setup.context.setImageRoute('comic', 'novelai');
    assert.equal(opened, 1);
    assert.equal(setup.saved(), null);
    const ready = routeContext({ apis: [{ id: 'a', imageModel: 'm' }], novelAiImageApi: { token: 'pst-1' } });
    ready.context.setImageRoute('chat', 'novelai');
    assert.equal(ready.saved().imageRoutes.chat, 'novelai');
});

test('chat pictures convert descriptions to tags before calling NovelAI; pet edits stay on the relay', async () => {
    const calls = [];
    const context = vm.createContext({
        window: {}, console, AbortSignal,
        getImageRouteForFeature: () => ({ provider: 'novelai', settings: { token: 'pst-1' } }),
        convertTextToNovelAiPrompt: async text => { calls.push(['convert', text]); return { ok: true, prompt: '1girl, selfie', characters: [{ prompt: 'girl, smile' }] }; },
        callNovelAiImageGeneration: async (input, options) => { calls.push(['nai', input, options.usageFeature]); return { ok: true, url: 'data:image/png;base64,AA' }; },
        getDefaultImageApi: () => null
    });
    vm.runInContext(read('core/api/image-generation.js'), context);
    const result = await context.callWechatImageGenerationApi('她在海边自拍', { size: '1024x1536' });
    assert.equal(result.ok, true);
    assert.equal(calls[0][0], 'convert');
    assert.equal(calls[1][1].width, 832);
    assert.equal(calls[1][1].height, 1216);
    assert.equal(calls[1][2], 'image');
    const pet = await context.callWechatImageGenerationApi('sprite', { editOnly: true, referenceImage: 'data:image/png;base64,AA' });
    assert.equal(pet.ok, false);
    assert.equal(pet.error, '未配置生图 API');
    assert.equal(calls.length, 2, 'editing a reference picture never goes to NovelAI');
});

test('the NovelAI settings modal and scripts are wired into the page', () => {
    const html = read('index.html');
    assert.match(html, /id="api-novelai-image-modal"/);
    for (const id of ['api-nai-token', 'api-nai-model', 'api-nai-sampler', 'api-nai-steps', 'api-nai-scale', 'api-nai-uc', 'api-nai-opus-free', 'api-nai-test-result']) assert.match(html, new RegExp(`id="${id}"`));
    const scripts = [...html.matchAll(/<script\s+src="([^"?]+)/g)].map(match => match[1]);
    assert.ok(scripts.indexOf('core/api/novelai.js') >= 0 && scripts.indexOf('core/api/novelai.js') < scripts.indexOf('core/api/image-generation.js'));
    assert.ok(scripts.indexOf('apps/settings/image-provider.js') > scripts.indexOf('apps/settings/api-test.js'));
    assert.match(read('apps/settings/api-list.js'), /renderImageServiceCard\(data\)/);
});
