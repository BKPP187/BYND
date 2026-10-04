const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { root, deferred } = require('./helpers/harness.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
class Node {
    constructor() { this.isConnected = true; this.children = []; this.attributes = {}; this._text = ''; }
    set textContent(value) { this._text = value; this.children = []; }
    get textContent() { return this._text + this.children.map(node => node.textContent).join(''); }
    append(node) { this.children.push(node); node.parent = this; }
    setAttribute(key, value) { this.attributes[key] = value; }
    remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
}
function harness(type = 'voiceCall') {
    const state = { requests: [], players: [], failPlay: false, failure: '', disabled: false, global: true, pending: null };
    class Audio {
        constructor() { this.paused = true; state.players.push(this); }
        play() { if (state.failPlay) return Promise.reject(Object.assign(new Error('gesture'), { name: 'NotAllowedError' })); this.paused = false; return Promise.resolve(); }
        pause() { this.paused = true; }
        load() {}
        removeAttribute() { this.src = ''; }
    }
    const char = { id: 'a', chatConfig: {} }, call = { id: 1, charId: 'a', type, acceptedAt: 1, ended: false, lines: [] };
    const globalApi = { provider: 'local', enabled: true, endpoint: 'http://localhost:9880/tts', voiceId: 'global', apiKey: 'secret-call-key' };
    const context = vm.createContext({ window: { myCharacters: [char], _wechatActiveCall: call }, document: { createElement: () => new Node() }, Audio, setTimeout, clearTimeout, AbortController,
        getCharacterVoiceBinding: char => char.chatConfig?.voiceBinding || null,
        isCharacterVoiceConfigured: () => !state.disabled,
        getCharacterVoiceApi: char => ({ ...globalApi, ...char.chatConfig.voiceBinding }), getDefaultVoiceApi: () => state.global ? globalApi : null,
        requestVoiceAudioWithConfig: async (text, api, char, options) => { state.requests.push({ text, api, char, signal: options.signal }); if (state.pending) return state.pending.promise; if (state.failure) throw new Error(state.failure); return { audioUrl: `data:audio/wav;base64,${text}`, duration: 2 }; }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'apps/wechat/chat/call-audio.js'), 'utf8'), context);
    return { state, context, char, call, player: context.window.ByndWechatCallAudio, globalApi };
}
test('voice and video calls use enabled global TTS, with role-specific voices taking priority', async () => {
    for (const type of ['voiceCall', 'videoCall']) {
        const h = harness(type), item = new Node(); h.char.chatConfig.voiceBinding = { provider: 'local', voiceId: 'role-a', voiceModel: 'custom-model' };
        const task = h.player.enqueue(h.call, '接电话。', item); await tick();
        assert.equal(h.state.requests[0].api.voiceId, 'role-a'); assert.equal(h.state.requests[0].api.voiceModel, 'custom-model'); assert.equal(h.state.requests[0].char.id, 'a');
        assert.equal(item.attributes['data-voice-state'], 'playing'); h.state.players[0].onended(); await task;
        assert.equal(item.attributes['data-voice-state'], 'played'); assert.equal(h.globalApi.voiceId, 'global');
        h.char.chatConfig.voiceBinding = null; const globalTask = h.player.enqueue(h.call, '全局声音。', new Node()); await tick(); assert.equal(h.state.requests.at(-1).api.voiceId, 'global'); h.state.players[0].onended(); await globalTask;
    }
});
test('spoken parts queue in order, duplicate jobs cannot charge twice, and queued work stops on hangup', async () => {
    const h = harness(), first = new Node(), second = new Node();
    const a = h.player.enqueue(h.call, '第一句。', first), b = h.player.enqueue(h.call, '第二句。', second);
    assert.equal(h.player.enqueue(h.call, '第一句。', first), a);
    await tick(); assert.equal(h.state.requests.length, 1); h.state.players[0].onended(); await tick(); assert.equal(h.state.requests.length, 2); assert.equal(h.state.requests[1].text, '第二句。');
    h.player.enqueue(h.call, '不能再收费。', new Node()); h.call.ended = true; h.player.stop(h.call);
    await Promise.all([a, b, h.player.drain(h.call)]); assert.equal(h.state.requests.length, 2); assert.equal(h.state.players[0].paused, true);
});
test('hanging up aborts pending generation, ignores late audio, and cannot start the next queued request', async () => {
    const h = harness(), pending = deferred(); h.state.pending = pending;
    const job = h.player.enqueue(h.call, '正在生成。', new Node()); h.player.enqueue(h.call, '下一句。', new Node()); await tick();
    h.call.ended = true; h.player.stop(h.call); assert.equal(h.state.requests[0].signal.aborted, true);
    pending.resolve({ audioUrl: 'data:audio/wav;base64,late' }); await job; await h.player.drain(h.call);
    assert.equal(h.state.players[0].paused, true); assert.equal(h.state.requests.length, 1);
});
test('autoplay denial has a clickable cached retry that does not generate or charge again', async () => {
    const h = harness(), item = new Node(); h.state.failPlay = true;
    await h.player.enqueue(h.call, '已生成声音。', item);
    assert.match(item.textContent, /点击播放声音/); assert.equal(item.attributes['data-voice-state'], 'failed');
    h.state.failPlay = false; item.children[0].children[0].onclick(); await tick();
    assert.equal(h.state.requests.length, 1); assert.equal(h.state.players[0].paused, false); h.state.players[0].onended(); await h.player.drain(h.call);
});
test('generation failures are visible and sanitized, and explicit retries do not overlap', async () => {
    const h = harness(), item = new Node(); h.state.failure = 'insufficient balance secret-call-key';
    await h.player.enqueue(h.call, '不会假装播放。', item);
    assert.match(item.textContent, /声音播放失败.*insufficient balance/); assert.ok(!item.textContent.includes('secret-call-key')); assert.match(item.textContent, /重试生成声音（计费）/);
    h.state.failure = ''; const retry = item.children[0].children[0]; retry.onclick(); retry.onclick(); await tick(); assert.equal(h.state.requests.length, 2); h.state.players[0].onended(); await h.player.drain(h.call);
});
test('disabled or absent TTS never falls back to a different voice, and unaccepted calls never synthesize', async () => {
    const h = harness(), item = new Node(); h.char.chatConfig.voiceBinding = { provider: 'local', voiceId: 'role' }; h.state.disabled = true;
    await h.player.enqueue(h.call, '配置不完整。', item); assert.match(item.textContent, /配置不完整/); assert.equal(h.state.requests.length, 0);
    h.char.chatConfig.voiceBinding = null; h.state.global = false; await h.player.enqueue(h.call, '没有配置。', new Node()); assert.equal(h.state.requests.length, 0);
    h.state.global = true; h.call.acceptedAt = null; await h.player.enqueue(h.call, '我拒绝。', new Node()); assert.equal(h.state.requests.length, 0);
});
test('switching calls stops the previous speaker even when the previous call object is still alive', async () => {
    const h = harness(), item = new Node(), job = h.player.enqueue(h.call, '旧通话。', item); await tick();
    const next = { ...h.call, id: 2 }; h.context.window._wechatActiveCall = next; h.player.prepare(next);
    await job; assert.equal(h.state.players[0].paused, true); assert.equal(h.state.players.length, 2);
});
test('voice and video indicators show speech with TTS and clear after completion, failure or hangup', async () => {
    for (const type of ['voiceCall', 'videoCall']) {
        const h = harness(type), indicator = new Node(); indicator.dataset = {};
        indicator.classList = { toggle: (name, hidden) => { indicator.hidden = hidden; } };
        h.context.document.getElementById = id => id === 'wc-call-typing' ? indicator : null;
        vm.runInContext(fs.readFileSync(path.join(root, 'apps/wechat/chat/calls.js'), 'utf8'), h.context);
        h.context.setWechatCallTyping(true);
        assert.equal(indicator.textContent, '对方正在说话…'); assert.equal(indicator.hidden, false);
        h.context.setWechatCallTyping(false);
        const first = h.player.enqueue(h.call, '通话声音。', new Node()); await tick();
        assert.equal(indicator.hidden, false); assert.equal(indicator.textContent, '对方正在说话…');
        h.context.setWechatCallTyping(false); assert.equal(indicator.hidden, false);
        h.state.players[0].onended(); await first; assert.equal(indicator.hidden, true);
        h.state.failPlay = true; await h.player.enqueue(h.call, '播放失败。', new Node()); assert.equal(indicator.hidden, true);
        h.state.failPlay = false;
        const second = h.player.enqueue(h.call, '挂断停止。', new Node()); await tick();
        h.call.ended = true; h.player.stop(h.call); await second; assert.equal(indicator.hidden, true);
        h.call.ended = false; h.state.global = false; h.context.setWechatCallTyping(true);
        assert.equal(indicator.textContent, '对方正在输入中......');
    }
});

test('call cancellation signals reach every TTS provider adapter', async () => {
    const context = vm.createContext({ window: {} });
    vm.runInContext(fs.readFileSync(path.join(root, 'apps/settings/api-test-modal.js'), 'utf8'), context);
    for (const [provider, name] of [['local', 'requestLocalVoiceAudio'], ['openai', 'requestOpenAiVoiceAudio'], ['fish-audio', 'requestFishAudioVoiceAudio'], ['elevenlabs', 'requestElevenLabsVoiceAudio'], ['minimax', 'requestMiniMaxVoiceAudio']]) {
        const controller = new AbortController(); let supplied;
        context[name] = async (text, api, options) => { supplied = options.signal; return { audioUrl: 'data:audio/wav;base64,test' }; };
        await context.requestVoiceAudioWithConfig('测试。', { provider }, null, { signal: controller.signal }); assert.equal(supplied, controller.signal, provider);
    }
});
