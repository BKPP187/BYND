'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { root } = require('./helpers/harness.cjs');
const api = { baseUrl: 'https://example.invalid/relay/v1', apiKey: 'example-key' };
const voice = { voice_id: 'voice-one', name: '中文女声', category: 'cloned', preview_url: 'https://example.invalid/preview.mp3' };
function harness(respond = () => new Response(JSON.stringify({ voices: [voice], has_more: false }))) {
    const requests = [];
    const context = vm.createContext({ window: {}, URL, AbortController, setTimeout, clearTimeout,
        fetch: async (url, options) => { requests.push({ url, options }); return respond(url, options); },
        normalizeElevenLabsBaseUrl: value => value.replace(/\/+$/, '')
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'apps/settings/elevenlabs-voices.js'), 'utf8'), context);
    return { voices: context.window.ByndElevenLabsVoices, requests };
}

test('voice pricing badges use explicit tier/free-user metadata and never infer free access from category or preview', async () => {
    const h = harness(() => new Response(JSON.stringify({ voices: [
        { ...voice, voice_id: 'paid', sharing: { free_users_allowed: false }, available_for_tiers: ['creator', 'enterprise'] },
        { ...voice, voice_id: 'free', sharing: { free_users_allowed: true } },
        { ...voice, voice_id: 'unknown', category: 'premade', available_for_tiers: [] },
        { ...voice, voice_id: 'restricted', sharing: { free_users_allowed: true }, available_for_tiers: ['creator'] }
    ], has_more: false })));
    const data = await h.voices.request(api);
    assert.equal(data.voices[0].access.paid, true);
    assert.equal(data.voices[0].access.freeAllowed, false);
    assert.equal(data.voices[1].access.freeAllowed, true);
    assert.equal(data.voices[2].access.freeAllowed, false);
    assert.equal(data.voices[2].access.paid, false);
    assert.equal(data.voices[3].access.paid, true);
    assert.equal(data.voices[0].preview, voice.preview_url, 'paid voices can still have public previews');
});

test('community API access requires a paid plan even when sharing allows free users', async () => {
    const h = harness(() => new Response(JSON.stringify({ voices: [
        { ...voice, category: 'professional', is_owner: false, sharing: { free_users_allowed: true }, available_for_tiers: ['free', 'creator'] },
        { ...voice, category: 'professional', sharing: { free_users_allowed: true, original_voice_id: 'source-id' } },
        { ...voice, category: 'professional', sharing: { free_users_allowed: true, enabled_in_library: true } },
        { ...voice, category: 'professional', is_owner: true, sharing: { free_users_allowed: true, enabled_in_library: true } },
        { ...voice, category: 'professional', sharing: { free_users_allowed: true } },
        { ...voice, category: 'premade', available_for_tiers: ['free'] },
        { ...voice, category: 'cloned', is_owner: false, sharing: { free_users_allowed: true, original_voice_id: 'workspace-instant-clone' } }
    ], has_more: false })));
    const { voices } = await h.voices.request(api);
    for (const index of [0, 1, 2]) {
        assert.equal(voices[index].access.library, true);
        assert.equal(voices[index].access.paid, true);
        assert.equal(voices[index].access.freeAllowed, false);
    }
    for (const index of [3, 4]) {
        assert.equal(voices[index].access.library, false, 'an owned or unidentified clone is not assumed to be a library copy');
        assert.equal(voices[index].access.freeAllowed, false, 'sharing flags cannot verify API access for professional clones');
    }
    assert.equal(voices[5].access.paid, false);
    assert.equal(voices[5].access.premade, true);
    assert.equal(voices[6].access.library, false, 'workspace instant clones are not public library professional clones');
    const community = await h.voices.request(api, { type: 'community' });
    assert.equal(community.voices[4].access.library, true, 'the community search identifies a library voice without ownership metadata');
    assert.equal(community.voices[5].access.library, false, 'premade voices remain built-in if included by the server');
});
test('voice search authenticates GET requests and preserves relay prefixes, search and pagination', async () => {
    const h = harness(() => new Response(JSON.stringify({ voices: [voice], has_more: true, next_page_token: 'page/+ 2' })));
    const result = await h.voices.request(api, { search: '温柔 & 中文', type: 'personal', gender: 'male', language: 'zh', token: 'page/+ 1' });
    const request = h.requests[0], url = new URL(request.url);
    assert.equal(url.pathname, '/relay/v2/voices');
    assert.equal(url.searchParams.get('search'), '温柔 & 中文');
    assert.equal(url.searchParams.get('voice_type'), 'personal');
    assert.equal(url.searchParams.get('gender'), 'male');
    assert.equal(url.searchParams.get('language'), 'zh');
    assert.equal(url.searchParams.get('next_page_token'), 'page/+ 1');
    assert.equal(request.options.method, 'GET');
    assert.equal(request.options.headers['xi-api-key'], api.apiKey);
    assert.equal(request.options.body, undefined);
    assert.ok(!request.url.includes(api.apiKey));
    assert.equal(result.voices[0].id, voice.voice_id);
    assert.equal(result.voices[0].preview, voice.preview_url);
    assert.equal(result.token, 'page/+ 2');
    assert.equal(h.voices.endpoint({ baseUrl: 'https://example.invalid/v2/' }).split('?')[0], 'https://example.invalid/v2/voices');
    assert.equal(new URL(h.voices.endpoint(api, { gender: 'female' })).searchParams.get('gender'), 'female');
    assert.equal(new URL(h.voices.endpoint(api, { gender: '' })).searchParams.has('gender'), false);
    assert.equal(new URL(h.voices.endpoint(api, { language: '' })).searchParams.has('language'), false);
});
test('a missing key makes no request, and HTTP errors and invalid pages never become empty successes', async () => {
    const h = harness();
    await assert.rejects(h.voices.request({ ...api, apiKey: '' }), /API Key/);
    assert.equal(h.requests.length, 0);
    for (const [status, body, expected] of [
        [401, {}, /API Key 无效/], [403, {}, /Voices 读取权限/], [429, {}, /请求过于频繁/],
        [200, {}, /无效/], [200, { voices: [], has_more: true }, /分页/]
    ]) {
        await assert.rejects(harness(() => new Response(JSON.stringify(body), { status })).voices.request(api), expected);
    }
    await assert.rejects(harness(() => new Response('<html>proxy error</html>')).voices.request(api), /无效数据/);
});
test('unsupported preview schemes are disabled; verified language previews can be used', async () => {
    const h = harness(() => new Response(JSON.stringify({ voices: [
        { ...voice, preview_url: 'javascript:alert(1)' },
        { ...voice, preview_url: '', verified_languages: [{ preview_url: 'https://example.invalid/zh.mp3' }] },
        { ...voice, preview_url: 'https://user:password@example.invalid/a.mp3' }
    ], has_more: false })));
    const result = await h.voices.request(api);
    assert.equal(result.voices[0].preview, '');
    assert.equal(result.voices[1].preview, 'https://example.invalid/zh.mp3');
    assert.equal(result.voices[2].preview, '');
});
test('closing or replacing a voice search aborts its network request', async () => {
    const h = harness((url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const controller = new AbortController();
    const pending = h.voices.request(api, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
    assert.equal(h.requests[0].options.signal.aborted, true);
});

test('filtered voices prefer the requested language sample and display readable gender and language labels', async () => {
    const h = harness(() => new Response(JSON.stringify({ voices: [{ ...voice, labels: { gender: 'male', language: 'zh' }, verified_languages: [
        { language: 'en', preview_url: 'https://example.invalid/en.mp3' },
        { language: 'zh', preview_url: 'https://example.invalid/zh.mp3' }
    ] }], has_more: false })));
    const chinese = await h.voices.request(api, { language: 'zh' });
    assert.equal(chinese.voices[0].preview, 'https://example.invalid/zh.mp3');
    assert.deepEqual(Array.from(chinese.voices[0].labels), ['男声', '中文']);
    const english = await h.voices.request(api, { language: 'en' });
    assert.equal(english.voices[0].preview, 'https://example.invalid/en.mp3');
});
