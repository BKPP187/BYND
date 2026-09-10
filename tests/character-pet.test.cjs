const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection, deferred } = require('./helpers/harness.cjs');

const png = 'data:image/png;base64,aGVsbG8=';
function harness() {
    const char = { id: 'pet-a', name: '沈清', description: '成年研究员，冷静克制，不喜欢被当成小孩。', worldBook: [{ content: '与用户是刚认识的同事。' }], history: [{ isMe: true, content: '今天辛苦了。', timestamp: 1 }], chatConfig: { characterPet: { active: true, autoReact: true, revision: 'initial', referenceKey: 'reference', baseKey: 'base', rules: '高兴也只轻微微笑。', boundaries: '禁止幼儿化和无依据亲昵。', relationship: '初识同事', states: [{ id: 'quiet_smile', label: '浅笑', emotion: '克制的愉悦', description: '仅嘴角轻微上扬，保持站姿。', when: '受到真诚的感谢且态度愉悦时', enabled: true, assetKey: 'smile', draftKey: '' }] } } };
    const other = { id: 'pet-b', name: '乔乐', description: '活泼直率。', history: [], chatConfig: {} };
    const data = new Map([['reference', { url: png }], ['base', { url: png, transparent: true }], ['smile', { url: png, transparent: true, baseKey: 'base' }]]);
    const timers = new Map();
    const state = { enabled: true, bound: char, saves: [], failSave: false, failAsset: false, calls: [], answer: { ok: true, content: '{"allow":true,"note":"符合克制的表现。"}' } };
    let timerId = 0;
    const context = vm.createContext({
        console: { warn() {}, log() {} }, Blob, FormData, Response, URL, AbortSignal,
        window: { myCharacters: [char, other], dispatchEvent() {}, addEventListener() {} },
        document: { hidden: false, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
        setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
        isMonitorPetEnabled: () => state.enabled, getMonitorPetBoundChar: () => state.bound, getMonitorCharName: c => c.name,
        getMonitorPetCurrentSceneText: () => '用户在 BYND 桌面。', syncMonitorPetFloating() {},
        saveCharactersToStorage: async () => { if (state.failSave) return false; state.saves.push(JSON.parse(JSON.stringify(context.window.myCharacters))); return true; },
        saveMonitorPetAsset: async (key, value) => { if (state.failAsset) throw new Error('database full'); data.set(key, value); },
        openMonitorPetDb: async () => ({ close() {}, transaction: () => ({ objectStore: () => ({ get(key) { const request = {}; queueMicrotask(() => { request.result = data.get(key); request.onsuccess(); }); return request; } }) }) }),
        callChatApi: async (messages, options) => { state.calls.push({ messages, options }); return typeof state.answer === 'function' ? state.answer(messages) : state.answer; },
        wcEscapeHtml: value => String(value).replace(/[<>&"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[char]))
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/character-pet.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'modules/monitor/pet-studio.js'), 'utf8'), context);
    return { context, C: context.window.ByndCharacterPet, studio: context.window.ByndPetStudio, char, other, data, state, timers };
}

test('pet state choices are limited to enabled, confirmed assets with sufficient confidence', () => {
    const { C, char } = harness();
    assert.equal(C.normalizeReaction(char, { state: 'quiet_smile', confidence: 0.9 }).state, 'quiet_smile');
    assert.equal(C.normalizeReaction(char, { state: 'invented_heart', confidence: 1 }).state, 'idle');
    assert.equal(C.normalizeReaction(char, { state: 'quiet_smile', confidence: 0.5 }).state, 'idle');
    char.chatConfig.characterPet.states[0].enabled = false;
    assert.equal(C.normalizeReaction(char, { state: 'quiet_smile', confidence: 1 }).state, 'idle');
    char.chatConfig.characterPet.states[0].enabled = true;
    char.chatConfig.characterPet.states[0].assetKey = '';
    char.chatConfig.characterPet.states[0].draftKey = 'unconfirmed';
    assert.equal(C.normalizeReaction(char, { state: 'quiet_smile', confidence: 1 }).state, 'idle');
});

test('pet metadata and truncated tags never become visible dialogue', () => {
    const { C } = harness();
    const complete = C.extract('谢谢。<bynd_pet>{"state":"quiet_smile","confidence":0.9}</bynd_pet>|||先休息吧。');
    assert.equal(complete.content, '谢谢。|||先休息吧。');
    assert.equal(complete.reaction.state, 'quiet_smile');
    assert.equal(C.extract('谢谢。<bynd_pet>{"state":').content, '谢谢。');
    assert.equal(C.extract('谢谢。<BYND_PET>{oops}</BYND_PET>').content, '谢谢。');
    assert.equal(C.extract('谢谢。<bynd_pet>{"state":').reaction, null);
});

test('character-specific persona, boundaries and relationship reach both generation and independent review', async () => {
    const { C, char, state } = harness();
    const instructions = C.chatInstructions(char);
    assert.match(instructions, /初识同事/);
    assert.match(instructions, /禁止幼儿化/);
    assert.match(instructions, /quiet_smile/);
    await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 0.9 }, '谢谢你的关心。');
    assert.equal(state.calls.length, 1);
    const request = JSON.stringify(state.calls[0].messages);
    assert.match(request, /成年研究员/);
    assert.match(request, /刚认识的同事/);
    assert.match(request, /谢谢你的关心/);
    assert.match(request, /审校器/);
    assert.equal(C.runtime(char).state, 'quiet_smile');
});

test('OOC rejection and failed review keep the pet idle without manufacturing speech', async () => {
    const { C, char, state } = harness();
    state.answer = { ok: true, content: '{"allow":false,"note":"不符合当前关系。"}' };
    assert.equal(await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 1 }, '宝贝抱抱'), false);
    assert.equal(C.runtime(char).state, 'idle');
    assert.equal(C.runtime(char).bubble, '');
    state.answer = { ok: false, error: 'timeout' };
    assert.equal(await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 1 }, '谢谢'), false);
    assert.equal(C.runtime(char).state, 'idle');
});

for (const [label, change] of [
    ['new interaction', h => h.char.history.push({ isMe: true, content: '别这么说。', timestamp: 2 })],
    ['role switch', h => { h.state.bound = h.other; }],
    ['global off', h => { h.state.enabled = false; }],
    ['automatic reactions off', h => { h.char.chatConfig.characterPet.autoReact = false; }],
    ['changed personality', h => { h.char.description = '性格已修改，不会微笑。'; }],
    ['removed character', h => { h.context.window.myCharacters = [h.other]; }]
]) test('an outstanding pet review is discarded after ' + label, async () => {
    const h = harness(); const gate = deferred(); h.state.answer = () => gate.promise;
    const request = h.C.applyChatReaction(h.char, { state: 'quiet_smile', confidence: 0.9 }, '谢谢。');
    change(h); gate.resolve({ ok: true, content: '{"allow":true}' });
    assert.equal(await request, false);
    assert.equal(h.C.runtime(h.char).state, 'idle');
});

test('confirmed emotions expire without another API request and opening/rendering a scene does not query AI', async () => {
    const { C, char, state, timers, context } = harness();
    C.observeScene(); C.observeScene(); C.material(char);
    assert.equal(state.calls.length, 0);
    await C.applyChatReaction(char, { state: 'quiet_smile', confidence: 1, durationSeconds: 1 }, '谢谢。');
    const timer = [...timers.values()].find(item => item.delay === 15000);
    context.getMonitorPetCurrentSceneText = () => '用户切换到了共读页。';
    C.observeScene();
    assert.ok(timer); timer.fn();
    assert.equal(C.runtime(char).state, 'idle');
    assert.equal(state.calls.length, 1);
});

test('saved pet changes roll back on persistence failure, serialize writes and retain other roles', async () => {
    const { C, char, other, state } = harness();
    const before = JSON.stringify(other);
    state.failSave = true;
    await assert.rejects(C.update(char, next => { next.boundaries = 'changed'; }), /保存/);
    assert.equal(C.profile(char).boundaries, '禁止幼儿化和无依据亲昵。');
    state.failSave = false;
    await Promise.all([C.update(char, next => { next.rules = '只点头'; }), C.update(char, next => { next.relationship = '同事'; })]);
    assert.equal(C.profile(char).rules, '只点头');
    assert.equal(C.profile(char).relationship, '同事');
    assert.equal(JSON.stringify(other), before);
});

test('a display failure after persistence does not undo a saved pet configuration', async () => {
    const { C, char, context } = harness();
    context.syncMonitorPetFloating = () => { throw new Error('view failed'); };
    await C.update(char, next => { next.rules = '保持克制'; });
    assert.equal(C.profile(char).rules, '保持克制');
});

test('PNG validation rejects opaque, checkerboard, nearly opaque and empty files', () => {
    const { C } = harness();
    const pixels = new Uint8ClampedArray(40 * 40 * 4);
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
    assert.equal(C.analyzeAlpha(pixels, 40, 40).transparent, false);
    pixels[3] = 0;
    assert.equal(C.analyzeAlpha(pixels, 40, 40).transparent, false);
    pixels.fill(0);
    assert.equal(C.analyzeAlpha(pixels, 40, 40).empty, true);
    for (let y = 5; y < 35; y++) for (let x = 10; x < 30; x++) pixels[(y * 40 + x) * 4 + 3] = 255;
    assert.equal(C.analyzeAlpha(pixels, 40, 40).transparent, true);
});

test('opaque or failed candidate confirmation preserves the chosen mother image and expression set', async () => {
    const { studio, C, char, data, state } = harness();
    data.set('candidate', { url: png, transparent: false });
    char.chatConfig.characterPet.draftBaseKey = 'candidate';
    await assert.rejects(studio.confirmImage(char, 'idle'), /透明/);
    assert.equal(C.profile(char).baseKey, 'base');
    data.set('candidate2', { url: png, transparent: true });
    char.chatConfig.characterPet.draftBaseKey = 'candidate2';
    state.failSave = true;
    await assert.rejects(studio.confirmImage(char, 'idle'), /保存/);
    assert.equal(C.profile(char).baseKey, 'base');
    assert.equal(C.profile(char).states[0].assetKey, 'smile');
    state.failSave = false;
    await studio.confirmImage(char, 'idle');
    assert.equal(C.profile(char).baseKey, 'candidate2');
    assert.equal(C.profile(char).states[0].assetKey, '');
});

test('expression candidates from an older mother image cannot be confirmed', async () => {
    const { studio, char, data, C } = harness();
    data.set('stale', { url: png, transparent: true, baseKey: 'old-base' });
    char.chatConfig.characterPet.states[0].draftKey = 'stale';
    await assert.rejects(studio.confirmImage(char, 'quiet_smile'), /母版/);
    assert.equal(C.profile(char).states[0].assetKey, 'smile');
});

test('image storage failures do not produce usable asset keys', async () => {
    const { C, char, state, data } = harness();
    state.failAsset = true;
    const before = data.size;
    await assert.rejects(C.storeAsset(char, { url: png, transparent: true }), /database full/);
    assert.equal(data.size, before);
});

test('image prompts use only the user identity reference and keep variants anchored to the mother', () => {
    const { C, char } = harness();
    const initial = C.imagePrompt(char);
    assert.match(initial, /第一张图片锁定角色身份/);
    assert.match(initial, /唯一的图片参考/);
    assert.doesNotMatch(initial, /第二张|风格示例人物/);
    assert.match(initial, /Alpha/);
    assert.match(initial, /禁止幼儿化/);
    assert.doesNotMatch(initial, /必须保持同类画风/);
    const variant = C.imagePrompt(char, C.profile(char).states[0]);
    assert.match(variant, /已确认的角色母版/);
    assert.match(variant, /仅嘴角轻微上扬/);
    assert.doesNotMatch(variant, /第二张图片仅参考/);
});

function imageApiHarness(config = {}) {
    const calls = [];
    let response = () => new Response('{"data":[{"b64_json":"aGVsbG8="}]}', { status: 200 });
    const context = vm.createContext({
        Blob, FormData, Response, URL, AbortSignal,
        getDefaultImageApi: () => ({ baseUrl: 'https://images.test/v1', imageModel: 'custom-image', apiKey: 'test-only', ...config }),
        parseWechatApiJsonResponseText: JSON.parse,
        fetch: async (url, options) => {
            if (url.startsWith('data:')) return new Response(new Blob(['test'], { type: 'image/png' }));
            calls.push({ url, options }); return response(calls.length);
        }
    });
    vm.runInContext(sourceSection('wechat.js', 'async function callWechatImageGenerationApi(', 'function getWechatImageReferenceForChar('), context);
    return { context, calls, respond: fn => { response = fn; } };
}

test('pet generation reuses the existing API route and sends identity plus style as multipart edits with transparency', async () => {
    const { context, calls } = imageApiHarness();
    const result = await context.callWechatImageGenerationApi('3D character', { referenceImage: png, additionalReferences: [png], requireReference: true, editOnly: true, referenceStyle: 'identity', background: 'transparent', outputFormat: 'png', size: '1024x1024' });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://images.test/v1/images/edits');
    const form = calls[0].options.body;
    assert.equal(form.getAll('image[]').length, 2);
    assert.equal(form.get('model'), 'custom-image');
    assert.equal(form.get('background'), 'transparent');
    assert.equal(form.get('output_format'), 'png');
    assert.match(form.get('prompt'), /锁定角色身份/);
    assert.doesNotMatch(form.get('prompt'), /必须保持同类画风/);
    assert.equal(calls[0].options.headers['Content-Type'], undefined);
});

test('unsupported strict image editing never retries without the reference or silently changes endpoints', async () => {
    const { context, calls, respond } = imageApiHarness();
    respond(() => new Response('not supported', { status: 404 }));
    const result = await context.callWechatImageGenerationApi('3D character', { referenceImage: png, requireReference: true, editOnly: true });
    assert.equal(result.ok, false);
    assert.equal(calls.length, 1);
    const missing = await context.callWechatImageGenerationApi('3D character', { requireReference: true, editOnly: true });
    assert.equal(missing.ok, false);
    assert.equal(calls.length, 1);
});

test('ordinary chat image generation retains its prior style and compatibility path', async () => {
    const { context, calls } = imageApiHarness();
    assert.equal((await context.callWechatImageGenerationApi('角色照片', { referenceImage: png })).ok, true);
    assert.match(calls[0].url, /images\/generations$/);
    const body = JSON.parse(calls[0].options.body);
    assert.match(body.prompt, /必须保持同类画风/);
    assert.equal(body.background, undefined);
    assert.equal(body.reference_image, png);
});

const petImageOptions = { referenceImage: png, requireReference: true, editOnly: true, allowEditCompatibility: true, referenceStyle: 'identity', background: 'transparent', outputFormat: 'png', size: '1024x1024' };
const imageSuccess = () => new Response('{"data":[{"b64_json":"aGVsbG8="}]}', { status: 200 });
const imageFailure = (status, message, param = '', code = 'invalid_request_error') => new Response(JSON.stringify({ error: { message, param, code } }), { status, headers: { 'x-request-id': 'req-test-123' } });

test('GPT Image 2 keeps transparency when the configured provider accepts it', async () => {
    const { context, calls } = imageApiHarness({ imageModel: 'gpt-image-2' });
    assert.equal((await context.callWechatImageGenerationApi('character', petImageOptions)).ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.body.get('background'), 'transparent');
    assert.equal(calls[0].options.body.get('model'), 'gpt-image-2');
});

test('explicit transparent-parameter rejection retries with the same reference and model', async () => {
    const { context, calls, respond } = imageApiHarness({ imageModel: 'gpt-image-2' });
    const progress = [];
    respond(count => count === 1 ? imageFailure(400, 'gpt-image-2 does not support background=transparent', 'background') : imageSuccess());
    const result = await context.callWechatImageGenerationApi('character on transparent background', { ...petImageOptions, onProgress: text => progress.push(text) });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.url.endsWith('/images/edits') && call.options.body.get('image') instanceof Blob));
    assert.equal(calls[1].options.body.get('model'), 'gpt-image-2');
    assert.equal(calls[1].options.body.get('background'), null);
    assert.equal(calls[1].options.body.get('output_format'), 'png');
    assert.match(calls[1].options.body.get('prompt'), /transparent background/);
    assert.equal(calls[0].options.signal, calls[1].options.signal);
    assert.match(progress[0], /透明背景参数/);
});

test('multipart rejection can use the official JSON edits schema with every reference intact', async () => {
    const { context, calls, respond } = imageApiHarness();
    const other = 'data:image/png;base64,dHdv';
    respond(count => count === 1 ? imageFailure(415, 'Content-Type must be application/json') : imageSuccess());
    assert.equal((await context.callWechatImageGenerationApi('character', { ...petImageOptions, additionalReferences: [other] })).ok, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].url, calls[0].url);
    assert.equal(calls[1].options.headers['Content-Type'], 'application/json');
    const body = JSON.parse(calls[1].options.body);
    assert.deepEqual(body.images, [{ image_url: png }, { image_url: other }]);
    assert.equal(body.model, 'custom-image');
    assert.equal(body.background, 'transparent');
    assert.equal(body.output_format, 'png');
    assert.equal(body.response_format, undefined);
});

test('compatibility attempts are bounded and preserve a single total timeout', async () => {
    const { context, calls, respond } = imageApiHarness();
    respond(count => count === 1 ? imageFailure(400, 'Unsupported background', 'background')
        : count === 2 ? imageFailure(422, 'Unknown output_format', 'output_format')
        : imageFailure(415, 'Use application/json'));
    assert.equal((await context.callWechatImageGenerationApi('character', petImageOptions)).ok, false);
    assert.equal(calls.length, 4);
    assert.ok(calls.every(call => call.options.signal === calls[0].options.signal && call.url.endsWith('/images/edits')));
    const last = JSON.parse(calls[3].options.body);
    assert.equal(last.images[0].image_url, png);
    assert.equal(last.background, undefined);
    assert.equal(last.output_format, undefined);
});

test('JSON validation arrays preserve missing-image details for compatible edit requests', async () => {
    const { context, calls, respond } = imageApiHarness();
    respond(count => count === 1 ? new Response(JSON.stringify({ detail: [{ loc: ['body', 'images'], msg: 'Field required', type: 'missing' }] }), { status: 422 }) : imageSuccess());
    const result = await context.callWechatImageGenerationApi('character', petImageOptions);
    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[1].options.body).images[0].image_url, png);
});

for (const status of [401, 403, 404, 429, 500, 503]) {
    test(`HTTP ${status} never starts another possibly billable pet image request`, async () => {
        const { context, calls, respond } = imageApiHarness();
        respond(() => imageFailure(status, 'background unsupported; multipart image request failed'));
        const result = await context.callWechatImageGenerationApi('character', petImageOptions);
        assert.equal(result.ok, false);
        assert.equal(calls.length, 1);
        assert.equal(result.details.status, status);
        assert.equal(result.details.path, '/images/edits');
        assert.equal(result.details.requestId, 'req-test-123');
    });
}

test('network failures, refusals and empty successful responses never trigger compatibility retries', async () => {
    for (const reply of [() => { throw new Error('Failed to fetch'); }, () => imageFailure(400, 'Image background blocked by safety policy', '', 'content_policy_violation'), () => new Response('{}', { status: 200 })]) {
        const { context, calls, respond } = imageApiHarness();
        respond(reply);
        assert.equal((await context.callWechatImageGenerationApi('character', petImageOptions)).ok, false);
        assert.equal(calls.length, 1);
    }
});

test('provider diagnostics keep the real reason while removing credentials', async () => {
    const secret = 'private-test-credential-123';
    const { context, calls, respond } = imageApiHarness({ apiKey: secret });
    respond(() => imageFailure(400, 'Unsupported background for account ' + secret, 'background'));
    const result = await context.callWechatImageGenerationApi('character', { ...petImageOptions, allowEditCompatibility: false });
    assert.equal(calls.length, 1);
    assert.match(result.error, /输出设置/);
    assert.match(result.details.message, /Unsupported background/);
    assert.equal(result.details.param, 'background');
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.doesNotMatch(result.error, /请重新上传/);
});

test('image results normalize raw base64, existing data URLs and output MIME correctly', async () => {
    for (const [body, expected] of [
        [{ output: [{ type: 'image_generation_call', result: 'aGVsbG8=' }] }, png],
        [{ data: [{ b64_json: png }] }, png],
        [{ output_format: 'webp', b64_json: 'aGVsbG8=' }, 'data:image/webp;base64,aGVsbG8=']
    ]) {
        const { context, respond } = imageApiHarness();
        respond(() => new Response(JSON.stringify(body), { status: 200 }));
        assert.equal((await context.callWechatImageGenerationApi('character', petImageOptions)).url, expected);
    }
});
