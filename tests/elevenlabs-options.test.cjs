const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { root } = require('./helpers/harness.cjs');
function harness(respond) {
    const requests = [];
    const context = vm.createContext({ window: {}, URL, AbortSignal, Date, fetch: async (url, options) => {
        requests.push({ url, options }); return respond(url, options);
    }, normalizeElevenLabsBaseUrl: value => value.replace(/\/+$/, '') });
    vm.runInContext(fs.readFileSync(path.join(root, 'apps/settings/elevenlabs-options.js'), 'utf8'), context);
    return { options: context.window.ByndElevenLabsOptions, requests };
}
const api = { baseUrl: 'https://proxy.invalid/relay/v1', apiKey: 'private-test-key', voiceId: 'voice/+one' };
test('ElevenLabs account reads preserve relay path and never place credentials in URLs', async () => {
    const h = harness(() => new Response(JSON.stringify({ character_count: 100, character_limit: 1000 })));
    const data = await h.options.read(api, '/v1/user/subscription');
    assert.equal(data.character_limit, 1000);
    assert.equal(new URL(h.requests[0].url).pathname, '/relay/v1/user/subscription');
    assert.equal(h.requests[0].options.headers['xi-api-key'], api.apiKey);
    assert.ok(!h.requests[0].url.includes(api.apiKey));
    assert.equal(h.requests[0].options.body, undefined);
});
test('ElevenLabs missing keys, permissions, invalid JSON and unsafe roots fail instead of inventing balances', async () => {
    const h = harness(() => new Response('{}', { status: 403 }));
    await assert.rejects(h.options.read({ ...api, apiKey: '' }, '/v1/models'), /API Key/);
    await assert.rejects(h.options.read({ ...api, baseUrl: 'file:///tmp' }, '/v1/models'), /http/);
    assert.equal(h.requests.length, 0);
    await assert.rejects(h.options.read(api, '/v1/user/subscription'), /权限/);
    const invalid = harness(() => new Response('not-json'));
    await assert.rejects(invalid.options.read(api, '/v1/user/subscription'));
});
test('ElevenLabs usage tracking requires an exact generation ID and billing failures stay optional', async () => {
    const h = harness(() => new Response('{}', { status: 403 }));
    await h.options.record(api, new Headers());
    assert.equal(h.requests.length, 0, 'no identifier means no guess at a latest request');
    await h.options.record(api, new Headers({ 'history-item-id': 'item/+id' }));
    assert.equal(new URL(h.requests[0].url).pathname, '/relay/v1/history/item%2F%2Bid');
    await h.options.record(api, new Headers({ 'request-id': 'request-specific' }));
    assert.equal(new URL(h.requests[1].url).searchParams.get('voice_id'), 'voice/+one');
    assert.equal(new URL(h.requests[1].url).searchParams.get('source'), 'TTS');
});
