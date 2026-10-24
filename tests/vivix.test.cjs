'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { memoryStorage, storageHarness, addBackupModule } = require('./helpers/harness.cjs');
const source = fs.readFileSync(path.resolve(__dirname, '../core/api/vivix.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const config = { apiKey: 'personal-test-key', voiceId: 'voice-test', prepareScene: false };
function harness(fetch = async () => { throw new Error('unexpected request'); }) {
    const localStorage = memoryStorage();
    const fields = Object.fromEntries(['url','key','voice','model','resolution','scene','provider','sound','sound-note','voice-field','status','test','voices','retry-close'].map(id => ['vivix-' + id, { value: '', checked: true, dataset: {}, children: [], classList: { add() {}, remove() {}, toggle() {} }, replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); } }]));
    const call = { ended: false, lines: [], videoProvider: 'vivix' };
    const window = { _wechatActiveCall: call };
    const context = vm.createContext({ window, localStorage, document: { getElementById: id => fields[id], createElement: () => ({}) },
        URL, AbortController, TypeError, setTimeout, clearTimeout, fetch, crypto: globalThis.crypto, atob, btoa, Uint8Array,
        refreshWechatCallControls() {}, setWechatCallStatus(text) { call.status = text; },
        buildMessages: () => [], callChatApi: async () => ({ ok: true, content: '{"speech":"在这里。","action":"走到窗边"}' }),
        addWechatCallLine: (role, content) => call.lines.push({ role, content }), getChatApiCurrentTimeContext: () => ({ text: '夜晚 23:00' }) });
    vm.runInContext(source, context);
    const api = window.ByndVivix; api.renderSettings();
    return { api, fields, call, context, localStorage, window };
}
test('Vivix configuration defaults to no key; save/clear errors preserve secrets and never show success', () => {
    const h = harness(); assert.equal(h.api.read().apiKey, ''); h.api.write(config);
    const previous = h.localStorage.getItem(h.api.storageKey);
    h.fields['vivix-key'].value = 'another-key';
    h.localStorage.setItem = () => { throw new Error('quota'); }; h.api.saveSettings();
    assert.equal(h.fields['vivix-status'].dataset.error, 'true'); assert.equal(h.localStorage.getItem(h.api.storageKey), previous);
    h.localStorage.removeItem = () => { throw new Error('denied'); }; h.api.clearSettings();
    assert.match(h.fields['vivix-status'].textContent, /清除失败/);
    for (const baseUrl of ['http://example.org', 'https://user:key@example.org', 'https://example.org?key=123', 'https://api.vivix.ai/v1']) assert.throws(() => h.api.normalize({ baseUrl }));
    h.localStorage = memoryStorage();
});

function broadcastHarness() {
    const calls = [], events = {}, sent = [], state = { destroyed: 0, muted: [], hold: false };
    const h = harness(async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith('/close')) return { ok: true, status: 200, json: async () => ({ code: 0, data: { status: 'closing' } }) };
        if (state.hold) await new Promise(resolve => { state.release = resolve; });
        return { ok: true, status: 200, json: async () => ({ code: 0, data: { session_id: 'broadcast-session', control: { url: 'wss://fixture.invalid', client_secret: 'control-secret' }, delivery: { media: { trtc: { sdk_app_id: 1, user_id: 'viewer', publisher_user_id: 'host', user_sig: 'fixture', room_id: 'room' } } } } }) };
    });
    h.api.write(config);
    h.context.WebSocket = class {
        constructor() { state.ws = this; queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
        send(json) { const item = JSON.parse(json); sent.push(item); queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ type: 'response.done', request_event_id: item.event_id, response: { status: 'completed' } }) })); }
        close() { this.readyState = 3; this.onclose?.(); }
    };
    h.window.TRTC = { TYPE: { SCENE_RTC: 'rtc' }, EVENT: { ERROR: 'error', AUTOPLAY_FAILED: 'blocked', REMOTE_VIDEO_AVAILABLE: 'remote', FIRST_VIDEO_FRAME: 'frame' }, create: () => ({
        on(type, handler) { events[type] = handler; }, async enterRoom(value) { state.room = value; events.remote({ userId: 'host', streamType: 'main' }); },
        async startRemoteVideo(value) { state.view = value.view; }, async muteRemoteAudio(_, muted) { state.muted.push(muted); },
        async exitRoom() { state.exited = true; }, destroy() { state.destroyed++; }
    }) };
    return { ...h, calls, events, sent, state, char: { name: '主播', description: '音乐人', chatConfig: { imageReference: 'https://fixture.invalid/ref.jpg' } } };
}

test('broadcast waits for an actual frame, stays separate from calls, directs one session, and never captures viewer devices', async () => {
    const h = broadcastHarness(), controller = new AbortController(); let ready = false, blocked = 0;
    const work = h.api.openBroadcast(h.char, { scene: '琴房排练', view: 'live-view', signal: controller.signal, onBlocked: () => blocked++ }).then(value => { ready = true; return value; });
    await tick(); assert.equal(ready, false); assert.equal(h.state.view, 'live-view');
    assert.equal(h.state.room.autoReceiveVideo, false); assert.equal(h.call.vivix, undefined);
    const body = JSON.parse(h.calls[0].options.body); assert.equal(body.conversation.input_audio_transcription.enabled, false);
    h.events.blocked({ resume: async () => { h.state.resumed = true; } }); assert.equal(blocked, 1);
    h.events.frame({ userId: 'host' }); const stream = await work;
    await stream.perform({ speech: '先听副歌。', action: '翻开琴谱' }); await stream.perform({ speech: '你点的这首我记得。' });
    assert.equal(h.calls.filter(row => row.url.endsWith('/sessions')).length, 1); assert.equal(h.sent.length, 2);
    assert.equal(h.sent[0].response.script.vocal.text, '先听副歌。');
    await stream.resume(); await stream.sound(true); assert.equal(h.state.resumed, true); assert.equal(h.state.muted.at(-1), false);
    await stream.close(); assert.equal(h.state.destroyed, 1); assert.equal(h.calls.filter(row => row.url.endsWith('/close')).length, 1);
    assert.equal(h.window._wechatActiveCall, h.call);
});

test('broadcast transport failure closes its paid session and reports one redacted failure for image fallback', async () => {
    const h = broadcastHarness(), errors = [];
    const work = h.api.openBroadcast(h.char, { scene: '排练', view: 'live-view', onFailure: error => errors.push(error.message) }); await tick();
    h.events.frame({ userId: 'host' }); await work;
    h.events.error(); h.events.error(); await tick();
    assert.equal(errors.length, 1); assert.doesNotMatch(errors[0], /personal-test-key|control-secret/);
    assert.equal(h.state.destroyed, 1); assert.equal(h.calls.filter(row => row.url.endsWith('/close')).length, 1);
});

test('leaving before a broadcast create completes rejects readiness and closes the late session without mounting RTC', async () => {
    const h = broadcastHarness(), controller = new AbortController(); h.state.hold = true;
    const work = h.api.openBroadcast(h.char, { scene: '排练', view: 'live-view', signal: controller.signal });
    const rejection = assert.rejects(work, /离开直播间/); await tick(); controller.abort(); await rejection;
    h.state.release(); await tick();
    assert.equal(h.state.room, undefined); assert.equal(h.calls.filter(row => row.url.endsWith('/close')).length, 1);
});
test('invalid stored JSON is retained; character preflight requires reference and excludes group calls', () => {
    const h = harness(); h.localStorage.setItem(h.api.storageKey, '{broken'); assert.throws(() => h.api.read(), /原数据已保留/);
    assert.equal(h.localStorage.getItem(h.api.storageKey), '{broken'); h.api.write(config);
    assert.throws(() => h.api.preflight({ chatConfig: {} }), /参考图/);
    assert.throws(() => h.api.preflight({ isGroupChat: true, chatConfig: { imageReference: 'https://cdn.example/a.jpg' } }), /单个角色/);
    assert.equal(h.api.selected({ chatConfig: {} }), true);
    assert.equal(h.api.selected({ chatConfig: { videoCallProvider: 'vivix' } }), true);
});
test('global Vivix defaults apply to inherited roles, explicit role choices win, and no-key users keep ordinary calls', () => {
    const h = harness();
    assert.equal(h.api.selected({ chatConfig: {} }), false);
    h.localStorage.setItem(h.api.storageKey, JSON.stringify(config));
    assert.equal(h.api.selected({ chatConfig: {} }), true, 'previously saved Vivix settings are an opt-in');
    assert.equal(h.api.selected({ chatConfig: { videoCallProvider: 'inherit' } }), true);
    assert.equal(h.api.selected({ chatConfig: { videoCallProvider: 'ordinary' } }), false);
    assert.equal(h.api.selected({ isGroupChat: true, chatConfig: {} }), false);
    h.api.write({ ...config, defaultProvider: 'ordinary' });
    assert.equal(h.api.selected({ chatConfig: {} }), false);
    assert.equal(h.api.selected({ chatConfig: { videoCallProvider: 'vivix' } }), true);
    h.api.renderSettings(); assert.equal(h.fields['vivix-provider'].value, 'ordinary');
    h.fields['vivix-provider'].value = 'vivix'; h.api.saveSettings();
    assert.equal(h.api.read().defaultProvider, 'vivix');
    h.localStorage.setItem(h.api.storageKey, '{broken');
    assert.equal(h.api.selected({ chatConfig: {} }), true);
    assert.throws(() => h.api.preflight({ chatConfig: { imageReference: 'ref' } }), /设置损坏/);
});
test('connection test only reads voices; HTTP/business/JSON/network errors never become success or reveal keys', async () => {
    for (const result of [ { ok: false, status: 401 }, { ok: false, status: 404 }, { ok: true, status: 200, json: async () => ({ code: 7, message: config.apiKey }) },
        { ok: true, status: 200, json: async () => ({ code: 0, data: {} }) }, { ok: true, status: 200, json: async () => { throw new Error(config.apiKey); } } ]) {
        const h = harness(async () => result); h.fields['vivix-key'].value = config.apiKey; await h.api.testSettings();
        assert.equal(h.fields['vivix-status'].dataset.error, 'true'); assert.doesNotMatch(h.fields['vivix-status'].textContent, /personal-test-key/);
    }
    const requests = [], h = harness(async (url, options) => { requests.push({ url, options }); return { ok: true, status: 200, json: async () => ({ code: 0, data: { voices: [] } }) }; });
    h.fields['vivix-key'].value = config.apiKey; await h.api.testSettings();
    assert.equal(requests[0].url, h.api.relay + '/v1/voices'); assert.equal(requests[0].options.method, 'GET');
    assert.equal(h.localStorage.getItem(h.api.storageKey), null); assert.match(h.fields['vivix-status'].textContent, /连接成功/);
    await assert.rejects(harness(async () => { throw new TypeError('network'); }).api.request(h.api.normalize(config), '/v1/voices'), /网络/);
});
test('sound settings persist, role overrides win, and external TTS must be configured before creating a session', () => {
    const h = harness(), char = { chatConfig: { imageReference: 'https://cdn.example/a.png' } };
    h.api.write({ ...config, soundSource: 'tts' }); h.api.renderSettings();
    assert.equal(h.fields['vivix-sound'].value, 'tts'); assert.equal(h.api.soundSource(char), 'tts');
    assert.throws(() => h.api.preflight(char), /配置角色或默认 TTS/);
    h.window.ByndWechatCallAudio = { apiForChar: () => ({ provider: 'minimax', apiKey: 'tts-key', voiceId: 'role-voice' }) };
    assert.equal(h.api.preflight(char).ttsApi.voiceId, 'role-voice');
    char.chatConfig.vivixSoundSource = 'vivix'; char.chatConfig.vivixVoiceId = 'vivix-role-voice';
    assert.equal(h.api.preflight(char).voiceId, 'vivix-role-voice');
    char.chatConfig.vivixSoundSource = 'silent';
    assert.equal(h.api.preflight(char).soundSource, 'silent');
    h.fields['vivix-sound'].value = 'silent'; h.api.saveSettings(); assert.equal(h.api.read().soundSource, 'silent');
    const body = h.api.sessionBody(char, h.api.preflight(char), 'https://cdn.example/a.png', 'scene');
    assert.equal(body.pipeline_config.tts_config, undefined);
});
test('all queried voices are selectable independently of the current ID, with manual IDs and saved selection retained', async () => {
    const h = harness(async () => ({ ok: true, status: 200, json: async () => ({ code: 0, data: { voices: [
        { voice_id: 'first-voice', name: '音色一' }, { voice_id: 'second-voice', name: '音色二' }
    ] } }) }));
    h.fields['vivix-key'].value = config.apiKey;
    await h.api.testSettings();
    const list = h.fields['vivix-voices'];
    assert.equal(list.disabled, false);
    assert.equal(list.children.length, 15);
    assert.deepEqual(list.children.slice(-2).map(item => item.value), ['first-voice', 'second-voice']);
    list.value = 'second-voice'; h.api.selectVoice();
    assert.equal(h.fields['vivix-voice'].value, 'second-voice');
    assert.equal(h.localStorage.getItem(h.api.storageKey), null, 'selection still requires saving');
    h.api.saveSettings(); h.api.renderSettings();
    assert.equal(h.api.read().voiceId, 'second-voice'); assert.equal(list.value, 'second-voice');
    h.fields['vivix-voice'].value = 'custom-voice'; h.api.changed(); h.api.saveSettings(); h.api.renderSettings();
    assert.equal(h.api.read().voiceId, 'custom-voice'); assert.equal(list.value, '');
    assert.equal(list.children.length, 15, 'manual input never filters out provider voices');
    h.fields['vivix-key'].value = 'different-account'; h.api.changed();
    assert.equal(list.disabled, true); assert.equal(list.children.length, 1);
});
test('late voice queries cannot overwrite edited credentials, and failed refreshes disable old choices without changing the ID', async () => {
    let release, fail = false;
    const h = harness(async () => {
        if (fail) return { status: 401, ok: false };
        await new Promise(resolve => release = resolve);
        return { ok: true, status: 200, json: async () => ({ code: 0, data: { voices: [{ voice_id: 'old-account-voice' }] } }) };
    });
    h.fields['vivix-key'].value = config.apiKey;
    const pending = h.api.testSettings(); await tick();
    h.fields['vivix-key'].value = 'different-account'; h.api.changed(); release(); await pending;
    assert.equal(h.fields['vivix-voices'].disabled, true);
    assert.equal(h.fields['vivix-voices'].children.length, 1);
    assert.doesNotMatch(h.fields['vivix-status'].textContent, /连接成功/);
    const before = h.fields['vivix-voice'].value;
    fail = true; await h.api.testSettings();
    assert.equal(h.fields['vivix-voices'].disabled, true);
    assert.equal(h.fields['vivix-voice'].value, before);
    assert.equal(h.fields['vivix-status'].dataset.error, 'true');
});
test('official built-in voices expose gender and style while opaque account voices never get a guessed gender', async () => {
    const h = harness(async () => ({ ok: true, status: 200, json: async () => ({ code: 0, data: { voices: [
        { voice_id: 'voice_fixture_one', name: 'Prod Verify Dual Region 0826' },
        { voice_id: 'voice_fixture_two', name: 'AlleBrean-4du9-clone-20261009', gender: 'male' },
        { voice_id: 'longanhuan_v3.6', name: 'duplicate built-in' }
    ] } }) }));
    h.fields['vivix-key'].value = config.apiKey; await h.api.testSettings();
    const options = h.fields['vivix-voices'].children;
    assert.match(options.find(item => item.value === 'longanhuan_v3.6')?.textContent || '', /女声.*活泼/);
    assert.match(options.find(item => item.value === 'longchuanshu_v3.6')?.textContent || '', /男声.*四川/);
    assert.match(options.find(item => item.value === 'loongjohn')?.textContent || '', /男声.*英语/);
    assert.match(options.find(item => item.value === 'voice_fixture_one').textContent, /性别未提供/);
    assert.match(options.find(item => item.value === 'voice_fixture_two').textContent, /男声/);
    assert.equal(options.filter(item => item.value === 'longanhuan_v3.6').length, 1);
    assert.equal(options.some(item => /voice_fixture/.test(item.textContent)), false, 'opaque IDs stay in the manual ID field');
    h.fields['vivix-voices'].value = 'longchuanshu_v3.6'; h.api.selectVoice(); h.api.saveSettings();
    const selected = h.api.read(); assert.equal(selected.voiceId, 'longchuanshu_v3.6');
    const body = h.api.sessionBody({}, selected, 'https://fixture.invalid/ref.png', '场景');
    assert.equal(body.pipeline_config.tts_config.tts_voice_id, 'longchuanshu_v3.6');
});
function scriptedSound(source) {
    const h = harness(), events = [];
    h.call.charId = 'peer'; h.window.myCharacters = [{ id: 'peer' }];
    const state = h.call.vivix = { config: { ...h.api.normalize(config), soundSource: source, ttsApi: { apiKey: 'secret-tts-key' } },
        controller: new AbortController(), ready: true, queue: Promise.resolve(), ws: { readyState: 1, send: json => events.push(JSON.parse(json)) } };
    return { ...h, state, events };
}
test('external TTS becomes exactly one audio script on the current socket; no Vivix speech fallback or credentials', async () => {
    const h = scriptedSound('tts'), requests = [];
    h.context.requestVoiceAudioWithConfig = async (text, api, char, options) => {
        requests.push({ text, api, char, options }); return { audioUrl: 'data:audio/wav;base64,' + Buffer.from('RIFF0000WAVEfmt ').toString('base64') };
    };
    const task = h.api.perform(h.call, { speech: '这次使用我的声音', action: '转头' }); await tick();
    assert.equal(requests.length, 1); assert.equal(requests[0].char.id, 'peer');
    const vocal = h.events[0].response.script.vocal;
    assert.equal(vocal.type, 'audio'); assert.equal(vocal.mime_type, 'audio/wav');
    assert.equal(vocal.text, undefined); assert.equal(vocal.url, undefined);
    assert.doesNotMatch(JSON.stringify(h.events), /secret-tts-key/);
    h.state.waiter.resolve(); await task;
});
test('TTS balance/format failures send no response, hide credentials, and a deliberate retry generates only once', async () => {
    const h = scriptedSound('tts'); let count = 0;
    h.context.requestVoiceAudioWithConfig = async () => { count++; throw new Error('secret-tts-key insufficient balance'); };
    await assert.rejects(h.api.perform(h.call, { speech: '你好' }), error => /insufficient balance/.test(error.message) && !/secret-tts-key/.test(error.message));
    assert.equal(h.events.length, 0);
    h.context.requestVoiceAudioWithConfig = async () => { count++; return { audioUrl: 'data:audio/aac;base64,//EAAA==' }; };
    await assert.rejects(h.api.perform(h.call, { speech: '你好' }), /WAV 或 MP3/); assert.equal(h.events.length, 0);
    h.context.requestVoiceAudioWithConfig = async () => { count++; return { audioUrl: 'data:audio/mpeg;base64,' + Buffer.from('ID3mock-audio').toString('base64') }; };
    const retry = h.api.perform(h.call, { speech: '你好' }); await tick(); assert.equal(count, 3);
    assert.equal(h.events[0].response.script.vocal.mime_type, 'audio/mpeg'); h.state.waiter.resolve(); await retry;
});
test('hangup aborts external TTS and late generated audio cannot reach Vivix', async () => {
    const h = scriptedSound('tts'); let complete, signal;
    h.context.requestVoiceAudioWithConfig = (text, api, char, options) => { signal = options.signal; return new Promise(resolve => complete = resolve); };
    const task = h.api.perform(h.call, { speech: '迟到的声音' }); await tick();
    h.call.ended = true; h.state.stopped = true; h.state.controller.abort(); assert.equal(signal.aborted, true);
    complete({ audioUrl: 'data:audio/wav;base64,' + Buffer.from('RIFF0000WAVEfmt ').toString('base64') });
    await assert.rejects(task, /通话已结束/); assert.equal(h.events.length, 0);
});
test('silent calls render actions without vocal output or any TTS request', async () => {
    const h = scriptedSound('silent'); h.context.requestVoiceAudioWithConfig = () => { throw new Error('must not generate'); };
    const task = h.api.perform(h.call, { speech: '只显示这句台词' }); await tick();
    assert.equal(h.events[0].response.script.vocal, undefined); assert.ok(h.events[0].response.script.visual.prompt);
    h.state.waiter.resolve(); await task;
});
test('create uses documented media type, manual BYND direction, bounded lifetime and scene from recent character history', () => {
    const h = harness(), char = { description: '医生', scenario: '医院值班室', history: [{ content: '穿着白大褂，刚结束值班', isMe: false }] };
    assert.match(h.api.context(char), /夜晚 23:00.*\n角色场景：医院值班室/);
    const body = h.api.sessionBody(char, h.api.normalize(config), 'https://cdn.example/ref.png', '夜晚的值班室，白大褂');
    assert.equal(body.avatars[0].visual.source_images[0].media_type, 'image/png');
    assert.equal(body.conversation.turn_detection.type, 'manual'); assert.equal(body.delivery.media.transport, 'trtc');
    assert.equal(body.recording_mode, 'off'); assert.equal(body.auto_close.disconnected_timeout_seconds, 60);
    assert.equal(body.max_duration_seconds, 1200); assert.equal(body.pipeline_config.tts_config.tts_voice_id, 'voice-test');
});
test('scene extraction sends text-only identity, memory and recent plot without normal chat tools or image payloads', () => {
    const h = harness();
    h.context.buildMessages = () => { throw new Error('normal chat must not be built'); };
    h.context.buildChatApiCoreIdentityAnchor = () => '医生，角色世界书中的医院工作设定';
    h.context.buildMemoryAnchor = () => '角色记忆：今天值夜班';
    const messages = h.api.sceneMessages({ name: '医生', scenario: '医院', chatConfig: { signature: '疲惫' }, history: [
        { type: 'image', content: 'data:image/png;base64,secret-image-bytes' },
        { type: 'text', content: '他刚走到值班室窗边', isMe: false },
        { type: 'text', content: 'hidden internal data', internalEvent: true }
    ] }, '我刚从值班室走进走廊');
    assert.ok(messages.every(message => typeof message.content === 'string'));
    assert.match(messages[1].content, /医院工作设定.*\n角色记忆：[\s\S]*今天值夜班[\s\S]*值班室窗边/);
    assert.doesNotMatch(JSON.stringify(messages), /secret-image-bytes|hidden internal data/);
    assert.ok(messages[1].content.endsWith('角色本次通话开场（最新）：我刚从值班室走进走廊'));
});
test('scene failures retain redacted provider details once, disable readiness and never create a Vivix session', async () => {
    for (const response of [
        { ok: false, error: 'API 错误 (401): invalid key chat-secret' },
        { ok: false, error: 'API 额度不足 (429): insufficient quota' },
        { ok: false, timedOut: true, error: '请求超时（90秒）' },
        { ok: true, content: '普通回复而不是 JSON' },
        { ok: true, content: '{"scene":"医院"}', finishReason: 'length' },
        { ok: true, content: '{"scene":{"invalid":"医院"}}' }
    ]) {
        let calls = 0, request;
        const h = harness(async () => { calls++; throw new Error('must not create session'); });
        h.api.write(config); h.window.TRTC = {};
        h.context.getDefaultApi = () => ({ apiKey: 'chat-secret', model: 'chat-model' });
        h.context.callChatApi = async (messages, options) => { request = { messages, options }; return response; };
        h.fields['wc-call-ai-portrait-status'] = {};
        await h.api.start(h.call, { chatConfig: { imageReference: 'https://cdn.example/ref.png' } });
        assert.equal(calls, 0); assert.equal(h.call.vivix.failed, true); assert.equal(h.call.vivix.stopped, true);
        assert.equal(h.call.vivix.ready, false); assert.equal(h.call.muted, true);
        assert.equal(h.call.lines.length, 1);
        assert.doesNotMatch(h.call.lines[0].content, /chat-secret|personal-test-key/);
        assert.equal(h.fields['wc-call-ai-portrait-status'].textContent, 'AI 视频未连接');
        if (!response.ok) assert.match(h.call.lines[0].content, new RegExp(response.error.split(':')[0].replace(/[()]/g, '\\$&')));
        assert.equal(request.options.skipStatusValidationRetry, true); assert.equal(request.options.skipLengthContinuation, true);
        assert.equal(request.options.presetOverride, null); assert.equal(request.options.stream, false);
        assert.equal(request.options.apiOverride.model, 'chat-model');
    }
});
test('opening image failures preserve the image provider reason and never start or silently fall back to a paid session', async () => {
    for (const failure of [
        { ok: false, error: '未配置生图 API' },
        { ok: false, status: 429, error: '生图额度不足 image-secret' },
        { ok: false, status: 404, error: '服务不支持参考图编辑' },
        { ok: false, error: '等待生图结果超时' },
        { ok: true },
        new Error('图片连接失败 image-secret personal-test-key')
    ]) {
        let requests = 0, images = 0;
        const h = harness(async () => { requests++; throw new Error('must not create session'); });
        h.api.write({ ...config, prepareScene: true }); h.window.TRTC = {};
        h.context.getDefaultImageApi = () => ({ apiKey: 'image-secret' });
        h.context.callChatApi = async () => ({ ok: true, content: '{"scene":"房间窗边"}' });
        h.context.callWechatImageGenerationApi = async () => { images++; if (failure instanceof Error) throw failure; return failure; };
        await h.api.start(h.call, { chatConfig: { imageReference: 'https://fixture.invalid/ref.png' } });
        const text = h.call.lines[0]?.content || '';
        assert.match(text, /开场场景生成失败/);
        assert.match(text, failure.ok ? /未返回.*图片/ : new RegExp((failure.error || failure.message).split(' ')[0]));
        if (failure.status) assert.match(text, new RegExp(String(failure.status)));
        assert.match(text, /未创建 Vivix 会话/); assert.match(text, /原参考图/);
        assert.doesNotMatch(text, /image-secret|personal-test-key/);
        assert.equal(requests, 0); assert.equal(images, 1); assert.equal(h.call.lines.length, 1);
        assert.equal(h.call.vivix.failed, true); assert.equal(h.call.vivix.ready, false);
    }
});
test('unconnected microphone explains the failure; permissions do not falsely enable a mic, and successful toggles publish audio', async () => {
    const h = harness(); h.call.muted = true; h.call.vivix = { failed: true, stopped: true };
    await h.api.toggleControl(h.call, 'mute'); assert.match(h.call.lines[0].content, /先修正/);
    let on = 0, off = 0;
    h.call.vivix = { ready: true, rtc: { startLocalAudio: async () => { throw new Error('denied'); }, stopLocalAudio: async () => off++ } };
    await h.api.toggleControl(h.call, 'mute'); assert.equal(h.call.muted, true); assert.match(h.call.lines.at(-1).content, /浏览器权限/);
    h.call.vivix.rtc.startLocalAudio = async () => on++;
    await h.api.toggleControl(h.call, 'mute'); assert.equal(h.call.muted, false); assert.equal(on, 1);
    await h.api.toggleControl(h.call, 'mute'); assert.equal(h.call.muted, true); assert.equal(off, 1);
});
test('microphone permission resolving after hangup releases the captured RTC track', async () => {
    const h = harness(); let grant, mic = false, stopped = 0;
    h.call.muted = true;
    h.call.vivix = { ready: true, controller: new AbortController(), rtc: {
        startLocalAudio: () => new Promise(resolve => grant = () => { mic = true; resolve(); }),
        stopLocalAudio: async () => { mic = false; stopped++; }, exitRoom: async () => {}, destroy() {}
    } };
    const task = h.api.toggleControl(h.call, 'mute'); await tick();
    h.call.ended = true; await h.api.stop(h.call); assert.equal(h.call.vivix.rtc, null);
    grant(); await task; assert.equal(mic, false); assert.equal(stopped, 1); assert.equal(h.call.muted, true);
});
test('missing relay hidden by a failed CORS preflight is detected with a credential-free GET', async () => {
    const calls = [];
    const h = harness(async (url, options) => {
        calls.push({ url, options });
        if (options.headers.Authorization) throw new TypeError('Failed to fetch');
        return { status: 404 };
    });
    h.api.write(config);
    await assert.rejects(h.api.request(h.api.normalize(config), '/v1/voices'), /转发服务尚未上线/);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].options.method, 'GET');
    assert.equal(calls[1].options.headers.Authorization, undefined);
    assert.equal(h.api.read().apiKey, config.apiKey);
    let fetchCount = 0;
    const custom = harness(async () => { fetchCount++; throw new TypeError('network'); });
    await assert.rejects(custom.api.request(custom.api.normalize({ ...config, baseUrl: 'https://my-relay.example' }), '/v1/voices'), /网络/);
    assert.equal(fetchCount, 1, 'custom providers never probe the official relay');
});
test('speech and movement reuse the current socket, await completion, and queue more than one request locally', async () => {
    const h = harness(); const events = [];
    const state = h.call.vivix = { ready: true, queue: Promise.resolve(), ws: { readyState: 1, send: json => events.push(JSON.parse(json)) } };
    const a = h.api.perform(h.call, { speech: '你好', action: '转头' });
    const b = h.api.perform(h.call, { speech: '过来' });
    const c = h.api.perform(h.call, { action: '拿起杯子' });
    await tick(); assert.equal(events.length, 1); assert.equal(events[0].response.script.vocal.text, '你好');
    assert.equal(events[0].response.script.visual.prompt, '转头'); state.waiter.resolve(); await a; await tick();
    assert.equal(events.length, 2); state.waiter.resolve(); await b; await tick(); state.waiter.resolve(); await c;
    assert.equal(events.length, 3); assert.ok(events.every(event => event.type === 'response.create'));
    assert.ok(events.every(event => event.response.scheduling_policy === 'after_current_response'));
});
test('render failure is surfaced and never advances the saved scene; late reply after hangup produces no script', async () => {
    const h = harness(); const events = [];
    const state = h.call.vivix = { scene: '值班室', ready: true, queue: Promise.resolve(), ws: { readyState: 1, send: json => events.push(JSON.parse(json)) } };
    const task = h.api.reply(h.call, {}, '看窗外'); await tick(); state.waiter.reject(new Error('upstream failed'));
    await assert.rejects(task, /upstream failed/); assert.equal(state.scene, '值班室');
    assert.equal(h.call.lines.some(line => line.role === 'action'), false);
    let resolve; h.context.callChatApi = () => new Promise(r => resolve = r);
    const late = h.api.reply(h.call, {}, '再说一句'); await tick(); h.call.ended = true;
    resolve({ ok: true, content: '{"speech":"迟到","action":"走动"}' }); await late;
    assert.equal(events.length, 1);
});
test('video replies recover one formatting failure without replaying speech or losing role context', async () => {
    const h = harness(), requests = [], events = [];
    h.context.buildMessages = () => [{ role: 'system', content: '保留角色记忆；微信正文用 ||| 分段' }];
    h.context.callChatApi = async (messages, options) => {
        requests.push({ messages, options });
        return { ok: true, content: requests.length === 1 ? '我就在窗边。' : '{"speech":"我就在窗边。","action":"转头","scene":"","endCall":false}' };
    };
    const state = h.call.vivix = { scene: '值班室', ready: true, queue: Promise.resolve(), ws: { readyState: 1, send: json => events.push(JSON.parse(json)) } };
    h.call.lines.push({ role: 'user', content: '啥地方呀' });
    const task = h.api.reply(h.call, {}, '啥地方呀');
    // Attach a handler before yielding so the original failure is reported by the assertion.
    task.catch(() => {}); await tick();
    assert.equal(requests.length, 2, 'a non-JSON response needs exactly one format repair');
    assert.equal(requests[0].options.presetOverride, null);
    assert.match(requests[0].messages[0].content, /保留角色记忆/);
    assert.equal(requests[0].messages.at(-1).role, 'system');
    assert.match(requests[1].messages.at(-1).content, /JSON/);
    assert.equal(events.length, 1); assert.equal(events[0].response.script.vocal.text, '我就在窗边。');
    state.waiter.resolve(); await task;
    assert.equal(h.call.lines.filter(row => row.role === 'assistant').length, 1);
});
test('wrapped video JSON is accepted while ambiguous objects and broken JSON stay invalid', () => {
    const h = harness();
    assert.equal(h.api.parseJson('好的，回复如下：\n```json\n{"speech":"看到你了","action":"拿起 {杯子}"}\n```').speech, '看到你了');
    assert.equal(h.api.parseJson('<content>{"speech":"你好"}</content>').speech, '你好');
    for (const text of ['普通回复', '{"speech":"截断', '[]', 'null', '{"speech":"a"}\n{"speech":"b"}']) assert.throws(() => h.api.parseJson(text));
});
test('format repair failure stays visible and never sends malformed speech to Vivix', async () => {
    for (const second of [{ ok: true, content: '仍然不是 JSON' }, { ok: false, error: 'API 错误 (429): 限流' }]) {
        const h = harness(); let requests = 0, sent = 0;
        h.context.callChatApi = async () => ++requests === 1 ? { ok: true, content: '普通文字' } : second;
        h.call.vivix = { scene: '值班室', ready: true, queue: Promise.resolve(), ws: { readyState: 1, send: () => sent++ } };
        await assert.rejects(h.api.reply(h.call, {}, '你好'), second.ok ? /角色回复失败.*JSON/ : /429/);
        assert.equal(requests, 2); assert.equal(sent, 0); assert.equal(h.call.lines.length, 0);
    }
});
test('hangup releases local tracks/control and requests closure; closure failure remains retryable', async () => {
    let fail = true; const requests = [], h = harness(async (url, options) => { requests.push({ url, options }); return { ok: !fail, status: fail ? 500 : 200, json: async () => ({ code: fail ? 1 : 0, data: { status: 'closing' } }) }; });
    let destroyed = 0, exited = 0, closed = 0;
    h.call.vivix = { config: h.api.normalize(config), sessionId: 'session-test', controller: new AbortController(), ready: true, ws: { close: () => closed++ }, rtc: { exitRoom: async () => exited++, destroy: () => destroyed++ } };
    await h.api.stop(h.call); assert.equal(closed, 1); assert.equal(exited, 1); assert.equal(destroyed, 1);
    assert.match(h.fields['vivix-status'].textContent, /未确认/); fail = false; await h.api.retryClose();
    assert.equal(requests.length, 2); assert.equal(requests[1].url, h.api.relay + '/v1/realtime-avatar/sessions/session-test/close');
    assert.equal(h.call.vivix.remoteClosed, true);
});
test('Vivix key is excluded from backup export and cannot be restored by importing an injected private key', async () => {
    const h = storageHarness(); addBackupModule(h);
    h.localStorage.setItem('bynd_vivix_private_v1', JSON.stringify(config));
    assert.equal(h.context.getBackupLocalStorageKeys().includes('bynd_vivix_private_v1'), false);
    const backupSource = fs.readFileSync(path.resolve(__dirname, '../core/storage/backup.js'), 'utf8');
    assert.match(backupSource, /key !== 'bynd_vivix_private_v1'/);
    const before = h.localStorage.getItem('bynd_vivix_private_v1');
    h.context.confirm = () => true; h.context.location = { reload() {} };
    await h.context.importAllData({ value: 'backup', files: [{ text: async () => JSON.stringify({ _version: 'test', bynd_vivix_private_v1: { apiKey: 'injected' } }) }] });
    assert.equal(h.localStorage.getItem('bynd_vivix_private_v1'), before);
    assert.match(h.notices.at(-1), /导入成功/);
    h.localStorage.setItem = () => { throw new Error('storage quota exceeded'); };
    await h.context.importAllData({ value: 'backup', files: [{ text: async () => JSON.stringify({ _version: 'test', bynd_fixture_setting: 'changed' }) }] });
    assert.match(h.notices.at(-1), /导入失败/);
});

const workerModule = import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.resolve(__dirname, '../workers/bynd-push-worker.js'))).toString('base64'));
test('Vivix relay only accepts pinned paths and methods, rejects foreign origins, and forwards credentials without storing them', async () => {
    const { default: worker } = await workerModule, original = globalThis.fetch, requests = [];
    globalThis.fetch = async (url, options) => { requests.push({ url, options }); return new Response('{"code":0,"data":{"voices":[]}}', { headers: { 'Content-Type': 'application/json' } }); };
    const base = 'https://bynd.ccwu.cc/mcp/relay/vivix', headers = { Origin: 'https://bynd.ccwu.cc', Authorization: 'Bearer ' + config.apiKey, 'Content-Type': 'application/json' };
    try {
        assert.equal((await worker.fetch(new Request(base + '/v1/voices', { headers }), {})).status, 200);
        assert.equal(requests[0].url, 'https://api.vivix.ai/v1/voices'); assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer ' + config.apiKey);
        for (const path of ['/v1/characters','/v1/realtime-avatar/sessions/x','/v1/voices?url=https://evil.test']) assert.equal((await worker.fetch(new Request(base + path, { headers }), {})).status, 404);
        assert.equal((await worker.fetch(new Request(base + '/v1/voices', { headers: { ...headers, Origin: 'https://evil.test' } }), {})).status, 403);
        assert.equal((await worker.fetch(new Request(base + '/v1/voices'), {})).status, 401);
        assert.equal(requests.length, 1);
    } finally { globalThis.fetch = original; }
});
test('temporary local image upload authenticates, enforces image bytes and expiry, and never persists the API key', async () => {
    const { default: worker } = await workerModule, original = globalThis.fetch; const kv = new Map();
    const env = { BYND_PUSH: { get: async key => JSON.parse(kv.get(key) || 'null'), put: async (key, value, options) => { assert.equal(options.expirationTtl, 1200); kv.set(key, value); } } };
    const base = 'https://bynd.ccwu.cc/mcp/relay/vivix', headers = { Authorization: 'Bearer ' + config.apiKey, 'Content-Type': 'application/json' };
    const upload = image => worker.fetch(new Request(base + '/images', { method: 'POST', headers, body: JSON.stringify({ image }) }), env);
    globalThis.fetch = async () => new Response('{"code":0,"data":{"voices":[]}}');
    try {
        assert.equal((await upload('data:image/png;base64,' + Buffer.from('not-png').toString('base64'))).status, 400);
        const png = 'data:image/png;base64,' + Buffer.from('\x89PNG\r\n\x1a\n', 'binary').toString('base64');
        const response = await upload(png); assert.equal(response.status, 200);
        const imageUrl = (await response.json()).data.url;
        assert.doesNotMatch([...kv.values()].join(''), /personal-test-key/);
        assert.equal((await worker.fetch(new Request(imageUrl), env)).headers.get('Content-Type'), 'image/png');
        const key = [...kv.keys()][0], image = JSON.parse(kv.get(key)); image.expiresAt = 0; kv.set(key, JSON.stringify(image));
        assert.equal((await worker.fetch(new Request(imageUrl), env)).status, 404);
        globalThis.fetch = async () => new Response('{}', { status: 401 }); assert.equal((await upload(png)).status, 401);
    } finally { globalThis.fetch = original; }
});
