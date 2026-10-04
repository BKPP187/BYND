const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { root } = require('./helpers/harness.cjs');
const api = { baseUrl: 'https://api.minimax.io', apiKey: 'private-test-key' };
function harness(data, status = 200) {
    const calls = [], context = vm.createContext({ window: {}, URL, setTimeout, clearTimeout,
        normalizeMiniMaxBaseUrl: value => String(value || 'https://api.minimax.io').replace(/\/+$/, ''),
        fetch: async (url, options) => { calls.push({ url, options }); return new Response(typeof data === 'string' ? data : JSON.stringify(data), { status }); }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'apps/settings/minimax-voices.js'), 'utf8'), context);
    return { picker: context.window.ByndMiniMaxVoices, calls };
}
test('MiniMax voice list reads all account categories without speech synthesis and preserves regional/proxy roots', async () => {
    const h = harness({ system_voice: [{ voice_id: 'Chinese (Mandarin)_Gentleman', voice_name: 'Gentleman', description: ['A calm male voice.'] }, { voice_id: 'English_CalmWoman', voice_name: 'Calm Woman' }], voice_cloning: [{ voice_id: 'clone-b' }], voice_generation: [{ voice_id: 'design-a', voice_name: 'Designed' }], base_resp: { status_code: 0 } });
    const voices = await h.picker.request(api);
    assert.equal(h.calls[0].url, 'https://api.minimax.io/v1/get_voice');
    assert.equal(h.calls[0].options.headers.Authorization, 'Bearer private-test-key');
    assert.deepEqual(JSON.parse(h.calls[0].options.body), { voice_type: 'all' });
    assert.equal(h.calls[0].options.method, 'POST');
    assert.equal(voices[0].name, '温润绅士'); assert.equal(voices[0].gender, 'male'); assert.equal(voices[0].language, 'zh');
    assert.equal(voices[1].gender, 'female'); assert.equal(voices[1].language, 'en');
    assert.equal(voices[2].type, 'voice_cloning'); assert.equal(voices[2].gender, '');
    assert.equal(voices[3].type, 'voice_generation');
    assert.equal(h.picker.endpoint({ ...api, baseUrl: 'https://relay.invalid/service/v1/t2a_v2?old=1', voiceGroupId: 'group/+ 1' }), 'https://relay.invalid/service/v1/get_voice?GroupId=group%2F%2B+1');
    assert.equal(h.picker.endpoint({ ...api, baseUrl: 'https://api.minimaxi.com/v1/' }), 'https://api.minimaxi.com/v1/get_voice');
    assert.equal(h.picker.endpoint({ ...api, baseUrl: 'https://api.minimax.cn/' }), 'https://api.minimax.cn/v1/get_voice');
    assert.ok(!h.calls[0].url.includes(api.apiKey));
});
test('MiniMax authentication, business errors and malformed lists fail rather than report an empty success', async () => {
    const h = harness({ system_voice: [] });
    await assert.rejects(h.picker.request({ ...api, apiKey: '' }), /API Key/); assert.equal(h.calls.length, 0);
    for (const [data, status, pattern] of [[{}, 401, /Key 无效/], [{ base_resp: { status_code: 1004, status_msg: 'invalid private-test-key' } }, 200, /1004/], [{ base_resp: { status_code: 0 } }, 200, /无效列表/], [{ system_voice: {}, voice_cloning: [] }, 200, /无效列表/], ['<html>bad proxy</html>', 200, /无效数据/]]) {
        const rejected = harness(data, status);
        await assert.rejects(rejected.picker.request(api), error => { assert.match(error.message, pattern); assert.ok(!error.message.includes(api.apiKey)); return true; });
    }
    await assert.rejects(h.picker.request({ ...api, baseUrl: 'file:///tmp/' }), /http/);
    await assert.rejects(h.picker.request({ ...api, baseUrl: 'https://user:password@example.invalid' }), /http/);
});
test('MiniMax empty lists are valid, IDs are deduplicated, and documented starter IDs remain selectable offline', async () => {
    assert.equal((await harness({ system_voice: [] }).picker.request(api)).length, 0);
    const h = harness({ system_voice: [{ voice_id: 'a' }, null, { voice_id: '' }], voice_cloning: [{ voice_id: 'a' }, { voice_id: 'b' }] });
    assert.deepEqual(Array.from(await h.picker.request(api), item => item.id), ['a', 'b']);
    assert.ok(h.picker.starters.some(voice => voice.id === 'Chinese (Mandarin)_Gentleman'));
    assert.ok(h.picker.models.includes('speech-2.8-turbo'));
});
test('MiniMax save failures preserve the editor and do not signal success', () => {
    for (const failure of ['false', 'throw', 'success']) {
        const result = { innerHTML: '' }, state = { close: 0, render: 0 };
        const context = vm.createContext({ window: {}, document: { getElementById: () => result },
            normalizeVoiceApiData: value => value, getApiVoiceConfigFromModal: () => ({ ...api, enabled: true, voiceModel: 'speech-2.8-turbo', voiceId: 'Chinese (Mandarin)_Gentleman' }),
            getApiData: () => ({}), normalizeVoiceDefaultProvider: () => 'minimax',
            saveApiData: () => { if (failure === 'throw') throw new Error('quota full'); return failure !== 'false'; },
            closeApiVoiceModal: () => state.close++, renderApiList: () => state.render++
        });
        vm.runInContext(fs.readFileSync(path.join(root, 'apps/settings/api-test-modal.js'), 'utf8'), context);
        assert.equal(context.saveApiVoiceSettings(), failure === 'success');
        assert.equal(state.close, failure === 'success' ? 1 : 0); assert.equal(state.render, failure === 'success' ? 1 : 0);
        if (failure !== 'success') assert.match(result.innerHTML, /保存失败.*保留/);
    }
});

test('MiniMax preview signatures separate accounts, models, voices and sound parameters without changing saved configuration', () => {
    const h = harness({ system_voice: [] }), saved = { ...api, enabled: false, voiceModel: 'speech-2.8-turbo', voiceId: 'global' };
    const preview = h.picker.previewConfig(saved, 'role-voice', 'speech-2.8-hd');
    assert.equal(preview.enabled, true); assert.equal(preview.voiceId, 'role-voice'); assert.equal(preview.voiceModel, 'speech-2.8-hd');
    assert.equal(saved.enabled, false); assert.equal(saved.voiceId, 'global');
    for (const [key, value] of Object.entries({ apiKey: 'other-account', baseUrl: 'https://api.minimax.cn', voiceGroupId: 'other-group', voiceModel: 'speech-2.6-hd', voiceId: 'another-voice', voiceSpeed: '1.2', voiceVolume: '2', voicePitch: '1', voiceFormat: 'wav', voiceEndpoint: 'https://relay.invalid/generate' })) {
        assert.notEqual(h.picker.previewKey(preview), h.picker.previewKey({ ...preview, [key]: value }), key);
    }
});

test('MiniMax insufficient balance and permission errors retain service evidence and hide credentials', async () => {
    const context = vm.createContext({ window: {}, AbortSignal, fetch: async () => new Response(JSON.stringify({ base_resp: { status_code: 1008, status_msg: 'insufficient balance' } }), { status: 200 }), isApiVoiceEnabled: () => true });
    vm.runInContext(fs.readFileSync(path.join(root, 'apps/settings/api-test-modal.js'), 'utf8'), context);
    const configured = { ...api, enabled: true, voiceModel: 'speech-2.8-turbo', voiceId: 'voice-a' };
    await assert.rejects(context.requestMiniMaxVoiceAudio('测试', configured), /余额不足.*HTTP 200.*1008.*insufficient balance/);
    assert.match(context.getMiniMaxVoiceRequestError({ status: 402 }, { message: 'insufficient_balance private-test-key' }, api).message, /余额不足.*HTTP 402/);
    assert.ok(!context.getMiniMaxVoiceRequestError({ status: 401 }, { base_resp: { status_code: 1004, status_msg: api.apiKey } }, api).message.includes(api.apiKey));
    assert.match(context.getMiniMaxVoiceRequestError({ status: 200 }, { baseResp: { statusCode: 2042, statusMsg: 'denied' } }, api).message, /无权使用这个音色.*2042/);
});
