const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, deferred } = require('./helpers/harness.cjs');

function harness(respond = () => new Response('{}', { status: 404 })) {
    const requests = [], elements = new Map();
    for (const id of ['api-edit-id', 'api-edit-name', 'api-edit-url', 'api-edit-key', 'api-edit-model', 'api-edit-image-model', 'api-test-result', 'api-model-hint', 'api-image-model-hint']) {
        elements.set(id, { value: '', dataset: {}, style: {}, innerHTML: '', textContent: '', tagName: 'SELECT' });
    }
    const context = vm.createContext({
        URL, Response, AbortSignal, window: {}, console,
        document: { getElementById: id => elements.get(id) },
        fetch: async (url, options) => { requests.push({ url, options }); return respond(url, options); }
    });
    for (const file of ['api-test-modal.js', 'api-test.js', 'api-edit.js', 'api-test-list.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'apps/settings', file), 'utf8'), context);
    }
    context.restoreModelSelect = context.restoreImageModelSelect = context.refreshApiModelPickers = () => {};
    context.convertModelToInput = context.convertImageModelToInput = () => {};
    context.escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    return { context, requests, elements };
}
const models = list => new Response(JSON.stringify({ data: list.map(id => ({ id })) }));

test('model discovery finishes after listing models without waiting for chat inference', async () => {
    const h = harness((url, options) => options.method === 'GET' ? models(['auto', 'dmodel', 'kmodel'])
        : new Response('{"error":{"message":"model unavailable"}}', { status: 400 }));
    const result = await h.context.doTestApi('http://127.0.0.1:8317/v1', 'test-key');
    assert.equal(result.ok, true);
    assert.equal(h.requests.length, 1, 'Listing models must not wait for a sequence of generated chat replies');
    assert.ok(h.requests.every(request => request.options.method === 'GET'));
    assert.deepEqual(Array.from(result.models), ['auto', 'dmodel', 'kmodel']);
    assert.equal(result.chatVerified, false);
    assert.equal(result.chatModel, '', 'Listing a model is not proof of its chat capability');
});

test('modal immediately offers all listed models without claiming verified chat or image generation', async () => {
    const h = harness(() => models(['auto', 'kmodel', 'image-model']));
    h.elements.get('api-edit-url').value = 'http://127.0.0.1:8317/v1';
    await h.context.testApiFromModal();
    assert.equal(h.requests.length, 1);
    assert.equal(h.elements.get('api-edit-model').disabled, false);
    assert.match(h.elements.get('api-edit-model').innerHTML, /auto/);
    assert.match(h.elements.get('api-edit-model').innerHTML, /kmodel/);
    assert.match(h.elements.get('api-test-result').innerHTML, /聊天和生图尚未实测/);
    assert.doesNotMatch(h.elements.get('api-model-hint').textContent, /未测到聊天能力/);
});

test('a pasted /v1 on the image-only provider resolves its documented /api/v1 without claiming generation or key validation', async () => {
    const h = harness(() => new Response('{"detail":"未登录"}', { status: 401 }));
    const result = await h.context.doTestApi('https://img.pipiwangcom.com/v1', 'test-key');
    assert.equal(result.baseUrl, 'https://img.pipiwangcom.com/api/v1');
    assert.equal(result.ok, false);
    assert.equal(result.detected, true);
    assert.equal(result.imageOnly, true);
    assert.deepEqual(Array.from(result.models), ['image-1', 'image-2']);
    assert.match(result.error, /未验证/);
    assert.equal(h.requests.length, 1);
    assert.ok(h.requests.every(item => item.options.method === 'GET'));
});

test('discovery retries common paths on the same origin and returns the verified base for saving', async () => {
    const h = harness(url => url === 'https://provider.example/api/v1/models' ? models(['image-model']) : new Response('{}', { status: 404 }));
    const result = await h.context.doTestApi('https://provider.example/v1/', 'test-key');
    assert.equal(result.ok, true);
    assert.equal(result.baseUrl, 'https://provider.example/api/v1');
    assert.equal(h.requests.length, 2);
    assert.ok(h.requests.every(item => item.options.redirect === 'error'));
});

test('website HTML and arbitrary JSON never count as a successful API connection', async () => {
    for (const body of ['<!doctype html><title>Login</title>', '{"ok":true}']) {
        const h = harness(() => new Response(body));
        const result = await h.context.doTestApi('https://provider.example/v1', 'test-key');
        assert.equal(result.ok, false);
        assert.equal(result.detected, undefined);
        assert.ok(h.requests.length <= 4);
    }
});

test('invalid keys, rate limits and network failures remain failures', async () => {
    for (const status of [401, 403, 429]) {
        const h = harness(() => new Response('{}', { status }));
        const result = await h.context.doTestApi('https://provider.example/v1', 'test-key');
        assert.equal(result.ok, false);
        assert.match(result.error, new RegExp(String(status)));
        if (status === 429) assert.equal(h.requests.length, 1);
    }
    const h = harness(() => { throw new TypeError('Failed to fetch'); });
    assert.equal((await h.context.doTestApi('https://provider.example/v1', '')).ok, false);
});

test('normalization accepts full endpoint URLs and preserves custom prefixes and distinct hosts', () => {
    const h = harness();
    assert.equal(h.context.normalizeSettingsApiBaseUrl('https://provider.example/gateway/v1/images/generations/'), 'https://provider.example/gateway/v1');
    assert.equal(h.context.normalizeSettingsApiBaseUrl('https://img.pipiwangcom.com/'), 'https://img.pipiwangcom.com/api/v1');
    assert.equal(h.context.normalizeSettingsApiBaseUrl('https://img.pipiwangcom.com/api/v1/images/edits'), 'https://img.pipiwangcom.com/api/v1');
    assert.equal(h.context.normalizeSettingsApiBaseUrl('https://ai.pipiwangcom.com/v1'), 'https://ai.pipiwangcom.com/v1');
    assert.equal(h.context.normalizeSettingsApiBaseUrl('https://img.pipiwangcom.com/custom/v2'), 'https://img.pipiwangcom.com/custom/v2');
});

test('root URLs find /v1 and custom prefixes are retained during fallback', async () => {
    for (const prefix of ['', '/gateway']) {
        const base = 'https://provider.example' + prefix;
        const h = harness(url => url === base + '/v1/models' ? models([]) : new Response('{}', { status: 404 }));
        const result = await h.context.doTestApi(base, 'test-key');
        assert.equal(result.baseUrl, base + '/v1');
        assert.equal(result.ok, true);
        assert.ok(h.requests.every(item => item.url.startsWith(base + '/')));
    }
});

test('a local proxy root discovers /v1 and an invalid client key is not masked by the first 404', async () => {
    const h = harness(url => url === 'http://127.0.0.1:8317/v1/models'
        ? new Response('{}', { status: 401 }) : new Response('{}', { status: 404 }));
    const result = await h.context.doTestApi('http://127.0.0.1:8317', 'invalid-test-key');
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.match(result.error, /API Key.*401/);
    assert.equal(result.attempts.find(a => a.status === 401).baseUrl, 'http://127.0.0.1:8317/v1');
    h.elements.get('api-edit-url').value = 'http://127.0.0.1:8317';
    h.elements.get('api-edit-key').value = 'invalid-test-key';
    await h.context.testApiFromModal();
    assert.match(h.elements.get('api-test-result').innerHTML, /401/);
    assert.match(h.elements.get('api-test-result').innerHTML, /http:\/\/127\.0\.0\.1:8317\/v1\/models/);
    assert.doesNotMatch(h.elements.get('api-test-result').innerHTML, /invalid-test-key/);
    assert.equal(h.elements.get('api-edit-url').value, 'http://127.0.0.1:8317', 'Failed probes do not rewrite the saved URL');
});

test('a root 404 does not conceal a later network error and a later success still wins', async () => {
    for (const mode of ['network', 'success']) {
        const h = harness(url => {
            if (url.endsWith('/v1/models') && !url.endsWith('/api/v1/models')) {
                if (mode === 'network') throw new TypeError('Failed to fetch');
                return models([]);
            }
            return new Response('{}', { status: 404 });
        });
        const result = await h.context.doTestApi('http://127.0.0.1:8317', 'test-key');
        if (mode === 'network') {
            assert.equal(result.ok, false);
            assert.match(result.error, /Failed to fetch/);
        } else {
            assert.equal(result.ok, true);
            assert.equal(result.baseUrl, 'http://127.0.0.1:8317/v1');
        }
    }
});

test('invalid URLs are rejected before any credential-bearing request', async () => {
    for (const url of ['file:///v1', 'https://user:pass@provider.example/v1', 'https://provider.example/v1?token=secret', 'not a URL']) {
        const h = harness();
        assert.equal((await h.context.doTestApi(url, 'test-key')).ok, false);
        assert.equal(h.requests.length, 0);
    }
});

test('pinned proxy failures do not probe unrelated upstream paths', async () => {
    const h = harness();
    assert.equal((await h.context.doTestApi('https://l0veyou.com/v1', 'test-key')).ok, false);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].url, 'https://bynd.ccwu.cc/mcp/relay/l0veyou/v1/models');
});

test('modal fills the discovered URL and image models while showing an unverified warning', async () => {
    const h = harness(() => new Response('{}', { status: 401 }));
    h.elements.get('api-edit-url').value = 'https://img.pipiwangcom.com/v1';
    await h.context.testApiFromModal();
    assert.equal(h.elements.get('api-edit-url').value, 'https://img.pipiwangcom.com/api/v1');
    assert.match(h.elements.get('api-edit-image-model').innerHTML, /image-1/);
    assert.match(h.elements.get('api-test-result').innerHTML, /未验证/);
    assert.doesNotMatch(h.elements.get('api-test-result').innerHTML, /连接成功/);
});

test('image-only discovery never sends a chat probe even if the model endpoint starts returning chat models', async () => {
    const h = harness(() => models(['grok-chat']));
    assert.equal((await h.context.doTestApi('https://img.pipiwangcom.com/v1', 'test-key')).detected, true);
    assert.equal(h.requests.length, 1);
    assert.ok(h.requests.every(item => item.options.method === 'GET'));
});

test('list testing persists the corrected path and distinguishes unverified image configuration', async () => {
    const h = harness(() => new Response('{}', { status: 401 }));
    let data = { apis: [{ id: 'pipi', baseUrl: 'https://img.pipiwangcom.com/v1', apiKey: 'test-key' }] };
    h.context.document.querySelectorAll = () => [];
    h.context.getApiData = () => structuredClone(data);
    h.context.saveApiData = next => { data = next; };
    h.context.isApiVoiceEnabled = () => false;
    h.context.renderApiList = () => {};
    await h.context.testApiById('pipi');
    assert.equal(data.apis[0].baseUrl, 'https://img.pipiwangcom.com/api/v1');
    assert.equal(data.apis[0]._status, 'unverified');
});

test('pending test results never overwrite a changed URL or key', async () => {
    for (const field of ['api-edit-url', 'api-edit-key']) {
        const gate = deferred();
        const h = harness(() => gate.promise);
        h.elements.get('api-edit-url').value = 'https://provider.example/v1';
        const pending = h.context.testApiFromModal();
        h.elements.get(field).value = 'changed';
        gate.resolve(models([]));
        await pending;
        assert.equal(h.elements.get(field).value, 'changed');
        assert.doesNotMatch(h.elements.get('api-test-result').innerHTML, /连接成功/);
    }
});

test('saving normalizes a known image endpoint and storage failures leave the editor open', () => {
    const h = harness();
    h.elements.get('api-edit-url').value = 'https://img.pipiwangcom.com/v1';
    h.elements.get('api-edit-name').value = '皮皮';
    h.elements.get('api-edit-image-model').value = 'image-1';
    h.context.getApiData = () => ({ apis: [] });
    let saved, closed = false;
    h.context.saveApiData = data => { saved = data; };
    h.context.closeApiModal = () => { closed = true; };
    h.context.renderApiList = () => {};
    h.context.saveApi();
    assert.equal(saved.apis[0].baseUrl, 'https://img.pipiwangcom.com/api/v1');
    assert.equal(saved.imageDefaultId, saved.apis[0].id);
    assert.equal(closed, true);
    closed = false;
    h.context.saveApiData = () => { throw new Error('storage full'); };
    assert.equal(h.context.saveApi(), false);
    assert.equal(closed, false);
    assert.match(h.elements.get('api-test-result').innerHTML, /保存失败.*storage full/);
});

function imageHarness(respond) {
    const h = harness(respond);
    vm.runInContext(fs.readFileSync(path.join(root, 'core/api/image-generation.js'), 'utf8'), h.context);
    h.context.getDefaultImageApi = () => ({ baseUrl: 'https://img.pipiwangcom.com/v1', imageModel: 'image-1', apiKey: 'test-key' });
    return h;
}

test('actual generation also corrects an existing saved /v1 without resending a failed image request', async () => {
    const h = imageHarness(() => new Response(JSON.stringify({ data: [{ url: 'https://images.example/proof.png' }] })));
    assert.equal((await h.context.callWechatImageGenerationApi('blue circle')).ok, true);
    assert.equal(h.requests[0].url, 'https://img.pipiwangcom.com/api/v1/images/generations');
    assert.equal(h.requests.length, 1);
});

test('a long connection loss reports elapsed time and retains diagnostic details without an automatic paid retry', async () => {
    let now = 0;
    const h = imageHarness(() => { now = 127300; throw new TypeError('Failed to fetch'); });
    h.context.Date = { now: () => now };
    const result = await h.context.callWechatImageGenerationApi('blue circle');
    assert.equal(result.ok, false);
    assert.match(result.error, /127.*秒/);
    assert.match(result.error, /任务记录/);
    assert.equal(result.details.path, '/images/generations');
    assert.equal(result.details.elapsedMs, 127300);
    assert.equal(h.requests.length, 1);
});

test('network failures while reading a successful response are preserved instead of becoming empty-image parsing errors', async () => {
    const h = imageHarness(() => ({ ok: true, status: 200, headers: new Headers(), text: async () => { throw new TypeError('NetworkError while reading body'); } }));
    const result = await h.context.callWechatImageGenerationApi('blue circle');
    assert.equal(result.ok, false);
    assert.match(result.details.message, /NetworkError/);
    assert.doesNotMatch(result.error, /返回.*空|格式无法解析/);
    assert.equal(h.requests.length, 1);
});
