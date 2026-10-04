const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { root, sourceSection, deferred, storageHarness } = require('./helpers/harness.cjs');
function harness() {
    const api = { provider: 'elevenlabs', enabled: true, apiKey: 'secret-key', baseUrl: 'https://api.elevenlabs.io', voiceId: 'global-a', voiceModel: 'eleven_multilingual_v2', voiceEndpoint: 'https://relay.invalid/v1/text-to-speech/global-a?format=mp3' };
    const state = { requests: [], status: 200, error: { status: 'paid_plan_required', message: 'Paid plan required secret-key' }, saved: true, notices: [], refreshes: 0 };
    const context = vm.createContext({ window: { currentChatCharId: 'b' }, console: { warn() {} }, URL, AbortSignal,
        normalizeElevenLabsVoiceApiData: value => ({ ...value, provider: 'elevenlabs' }), isElevenLabsVoiceEnabled: value => !!value.apiKey && !!value.voiceId && value.enabled,
        saveCharactersToStorage: async () => state.saved, refreshChatView: () => state.refreshes++, renderChatList() {}, showWechatToast: text => state.notices.push(text),
        fetch: async (url, options) => { state.requests.push({ url, body: JSON.parse(options.body) }); return new Response(JSON.stringify(state.status === 200 ? { audio_url: 'https://audio.invalid/generated.mp3' } : { detail: state.error }), { status: state.status }); }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'apps/settings/api-test-modal.js'), 'utf8'), context);
    context.getVoiceApiByProvider = () => api;
    vm.runInContext(sourceSection('apps/wechat/ui/bubble-menu.js', 'function normalizeWechatCharacterVoiceBinding', 'function appendWechatAiMessageParts'), context);
    const a = { id: 'a', chatConfig: { voiceBinding: { provider: 'elevenlabs', voiceId: 'global-a' } }, history: [] };
    const b = { id: 'b', chatConfig: { voiceBinding: { provider: 'elevenlabs', voiceId: 'different-b', voiceModel: 'eleven_v3' } }, history: [] };
    const message = char => { const msg = { type: 'voice', isMe: false, transcript: '收到，这是测试语音', duration: 5 }; char.history.push(msg); return msg; };
    context.getCurrentChatChar = () => b;
    return { api, state, context, a, b, message };
}
test('automatic chat speech uses each character voice even with a saved global-voice endpoint', async () => {
    const h = harness(), first = h.message(h.a), second = h.message(h.b);
    await h.context.queueWechatCharacterVoiceAudio(h.a, first);
    await h.context.queueWechatCharacterVoiceAudio(h.b, second);
    assert.equal(new URL(h.state.requests[0].url).pathname, '/v1/text-to-speech/global-a');
    assert.equal(new URL(h.state.requests[1].url).pathname, '/v1/text-to-speech/different-b');
    assert.equal(new URL(h.state.requests[1].url).search, '?format=mp3');
    assert.equal(h.state.requests[1].body.model_id, 'eleven_v3');
    assert.ok(first.audioUrl && second.audioUrl);
    assert.equal(second.voiceAudioState, undefined);
    assert.equal(h.api.voiceId, 'global-a');
});
test('a rejected character voice displays a sanitized failure; explicit retry uses the current role selection', async () => {
    const h = harness(), msg = h.message(h.b); h.state.status = 402;
    await h.context.queueWechatCharacterVoiceAudio(h.b, msg);
    assert.equal(msg.audioUrl, undefined);
    assert.equal(msg.voiceAudioState, 'failed');
    assert.match(msg.voiceAudioError, /付费套餐/);
    assert.ok(!JSON.stringify(msg).includes('secret-key'));
    assert.match(h.state.notices[0], /语音生成失败/);
    h.state.status = 200; h.b.chatConfig.voiceBinding.voiceId = 'new-b';
    await h.context.retryWechatCharacterVoiceAudio(0);
    assert.equal(new URL(h.state.requests[1].url).pathname, '/v1/text-to-speech/new-b');
    assert.ok(msg.audioUrl);
    assert.equal(msg.voiceAudioState, undefined);
});
test('storage failures roll back synthesized audio and cannot display success', async () => {
    const h = harness(), msg = h.message(h.b); h.state.saved = false;
    await h.context.queueWechatCharacterVoiceAudio(h.b, msg);
    assert.equal(msg.audioUrl, undefined);
    assert.equal(msg.duration, 5);
    assert.equal(msg.voiceAudioState, 'failed');
    assert.match(msg.voiceAudioError, /保存/);
    h.state.saved = true;
    await h.context.retryWechatCharacterVoiceAudio(0);
    assert.ok(msg.audioUrl);
});

test('Free API library rejection is distinguished from exhausted credits and preserves the server reason', async () => {
    const h = harness(), msg = h.message(h.b); h.state.status = 402;
    h.state.error = { type: 'payment_required', code: 'subscription_required', message: 'Free users cannot use library voices via the API. secret-key' };
    await h.context.queueWechatCharacterVoiceAudio(h.b, msg);
    assert.match(msg.voiceAudioError, /Free 套餐不能通过 API 生成社区音色/);
    assert.match(msg.voiceAudioError, /内置音色/);
    assert.match(msg.voiceAudioError, /subscription_required/);
    assert.match(msg.voiceAudioError, /Free users cannot use library voices/);
    assert.ok(!msg.voiceAudioError.includes('secret-key'));
    const credits = h.context.getElevenLabsVoiceRequestError({ status: 402 }, { detail: { type: 'payment_required', code: 'insufficient_credits', message: 'Insufficient credits' } }, h.api);
    assert.match(credits.message, /积分不足/);
    assert.doesNotMatch(credits.message, /社区音色|需.*付费套餐/);
    const unknown = h.context.getElevenLabsVoiceRequestError({ status: 402 }, { detail: { type: 'payment_required', message: 'Account requires payment' } }, h.api);
    assert.match(unknown.message, /Account requires payment/);
    assert.doesNotMatch(unknown.message, /社区音色/);
});
test('pending voice synthesis cannot be double-submitted and deleted messages cannot be restored', async () => {
    const h = harness(), msg = h.message(h.b), pending = deferred();
    h.context.requestCharacterVoiceAudio = () => pending.promise;
    const task = h.context.queueWechatCharacterVoiceAudio(h.b, msg);
    assert.equal(msg.voiceAudioState, 'pending');
    assert.equal(h.context.queueWechatCharacterVoiceAudio(h.b, msg), undefined);
    await Promise.resolve(); h.b.history = []; pending.resolve({ audioUrl: 'https://audio.invalid/late' }); await task;
    assert.equal(msg.audioUrl, undefined);
});
test('unconfigured role TTS leaves a plain transcript voice without requesting audio or creating failure controls', async () => {
    for (const missing of ['binding', 'key', 'enabled', 'voice']) {
        const h = harness(), msg = h.message(h.b);
        if (missing === 'binding') h.b.chatConfig.voiceBinding = null;
        if (missing === 'key') h.api.apiKey = '';
        if (missing === 'enabled') h.api.enabled = false;
        if (missing === 'voice') h.b.chatConfig.voiceBinding.voiceId = '';
        assert.equal(h.context.isCharacterVoiceConfigured(h.b), false, missing);
        await h.context.queueWechatCharacterVoiceAudio(h.b, msg);
        assert.equal(h.state.requests.length, 0, missing);
        assert.equal(msg.voiceAudioState, undefined, missing);
        assert.equal(msg.transcript, '收到，这是测试语音');
    }
});
test('ElevenLabs endpoint templates resolve encoded role IDs while custom relay endpoints remain intact', () => {
    const h = harness();
    assert.equal(h.context.buildElevenLabsVoiceEndpoint({ voiceEndpoint: 'https://relay.invalid/text-to-speech/{voice_id}?x=1', voiceId: 'id/+b' }), 'https://relay.invalid/text-to-speech/id%2F%2Bb?x=1');
    assert.equal(h.context.buildElevenLabsVoiceEndpoint({ voiceEndpoint: 'https://relay.invalid/custom/speech', voiceId: 'b' }), 'https://relay.invalid/custom/speech');
});
test('pending speech is not saved as an endless spinner, while sanitized failure details survive reload', async () => {
    const h = storageHarness({ local: [] }); await h.context.loadCharactersFromStorage();
    h.context.window.myCharacters = [{ id: 'b', name: 'b测试员', history: [
        { type: 'voice', isMe: false, transcript: '正在生成', voiceAudioState: 'pending' },
        { type: 'voice', isMe: false, transcript: '生成失败', voiceAudioState: 'failed', voiceAudioError: '此音色需要付费套餐' }
    ] }];
    assert.equal(await h.context.saveCharactersToStorage(), true);
    const stored = h.state.record.characters[0].history;
    assert.equal(stored[0].voiceAudioState, undefined);
    assert.equal(stored[1].voiceAudioState, 'failed');
    assert.match(stored[1].voiceAudioError, /付费套餐/);
    assert.equal(h.context.window.myCharacters[0].history[0].voiceAudioState, 'pending');
});
