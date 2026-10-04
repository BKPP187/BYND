const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { root } = require('./helpers/harness.cjs');
const api = { baseUrl: 'https://api.fish.audio/compat/v1', apiKey: 'private-fish-key' };
function harness(data, status = 200) {
    const calls = [], context = vm.createContext({ window: {}, URL, setTimeout, clearTimeout,
        fetch: async (url, options) => { calls.push({ url, options }); return new Response(typeof data === 'string' ? data : JSON.stringify(data), { status }); }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'apps/settings/fish-voices.js'), 'utf8'), context);
    return { picker: context.window.ByndFishVoices, calls };
}
test('Fish searches the documented model catalog and paginates without synthesizing speech', async () => {
    const h = harness({ total: 21, has_more: true, items: [{ _id: 'voice-a', title: '温柔男声', state: 'trained', samples: [{ audio: 'https://samples.invalid/a.mp3' }] }, { _id: 'voice-a' }, { _id: 'removed', dmca_taken_down: true }, { _id: 'training', state: 'training' }] });
    const result = await h.picker.request(api, { query: '温柔 + 男声', source: 'mine', language: 'zh', page: 2 });
    const url = new URL(h.calls[0].url);
    assert.equal(url.pathname, '/model'); assert.equal(url.searchParams.get('title'), '温柔 + 男声');
    assert.equal(url.searchParams.get('self'), 'true'); assert.equal(url.searchParams.get('language'), 'zh'); assert.equal(url.searchParams.get('page_number'), '2');
    assert.equal(h.calls[0].options.headers.Authorization, 'Bearer private-fish-key'); assert.equal(h.calls[0].options.body, undefined);
    assert.deepEqual(Array.from(result.voices, voice => voice.id), ['voice-a']); assert.equal(result.more, true);
    assert.equal(result.voices[0].sample, 'https://samples.invalid/a.mp3');
    assert.equal(new URL(h.picker.endpoint({ ...api, baseUrl: 'https://relay.invalid/fish/compat/v1/audio/speech' })).pathname, '/fish/model');
});
test('Fish rejects broken catalogs and unsafe sample URLs, and never exposes keys in errors', async () => {
    for (const [data, status] of [[{ items: [], total: 0, message: api.apiKey }, 401], [{ items: {} }, 200], ['<html>', 200]]) await assert.rejects(harness(data, status).picker.request(api, { page: 1 }), error => !error.message.includes(api.apiKey));
    const h = harness({ items: [], total: 0 });
    await assert.rejects(h.picker.request({ ...api, apiKey: '' }, {}), /API Key/); assert.equal(h.calls.length, 0);
    for (const url of ['javascript:alert(1)', 'file:///a', 'https://user:secret@example.invalid/a', '/relative/audio.mp3']) assert.equal(h.picker.sampleUrl(url), '');
    await assert.rejects(h.picker.request({ ...api, baseUrl: 'file:///tmp' }, {}), /http/);
    assert.equal((await h.picker.request(api, { page: 1 })).voices.length, 0);
});
test('Fish save failures leave the modal open and preserve the draft', () => {
    for (const failure of ['false', 'throw', 'success']) {
        const result = { innerHTML: '' }, state = { close: 0, render: 0 };
        const context = vm.createContext({ window: {}, document: { getElementById: () => result }, normalizeFishAudioVoiceApiData: value => value,
            getApiFishAudioVoiceConfigFromModal: () => ({ ...api, enabled: true, voiceModel: 'fish-audio/s2.1-pro-free', voiceId: 'voice-a' }), getApiData: () => ({}), normalizeVoiceDefaultProvider: () => 'fish-audio',
            saveApiData: () => { if (failure === 'throw') throw new Error('full'); return failure !== 'false'; }, closeApiFishAudioVoiceModal: () => state.close++, renderApiList: () => state.render++
        });
        vm.runInContext(fs.readFileSync(path.join(root, 'apps/settings/api-test-modal.js'), 'utf8'), context);
        context.getApiFishAudioVoiceConfigFromModal = () => ({ ...api, enabled: true, voiceModel: 'fish-audio/s2.1-pro-free', voiceId: 'voice-a' });
        assert.equal(context.saveApiFishAudioVoiceSettings(), failure === 'success'); assert.equal(state.close, failure === 'success' ? 1 : 0); assert.equal(state.render, state.close);
        if (failure !== 'success') assert.match(result.innerHTML, /保存失败.*保留/);
    }
});
