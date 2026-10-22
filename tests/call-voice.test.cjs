const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { memoryStorage } = require('./helpers/harness.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// A fake page: timers run only when flushed, and window events are real EventTarget events.
function harness({ android = null, apis = [] } = {}) {
    const timers = [];
    const target = new EventTarget();
    const elements = {};
    const element = id => (elements[id] ||= { id, value: '', textContent: '', dataset: {}, classList: { set: new Set(['hidden']), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, toggle(c, on) { (on ?? !this.set.has(c)) ? this.set.add(c) : this.set.delete(c); }, contains(c) { return this.set.has(c); } } });
    const sent = [];
    const window = {
        addEventListener: (...args) => target.addEventListener(...args),
        removeEventListener: (...args) => target.removeEventListener(...args),
        dispatchEvent: event => target.dispatchEvent(event),
        ByndAndroid: android, myCharacters: [{ id: 'c1', name: '商桓', avatar: 'assets/a.png' }]
    };
    const context = vm.createContext({
        window, localStorage: memoryStorage(), console, Date, Math, JSON, Promise, Set, Map, WeakMap, Error, CustomEvent, Event, EventTarget, AbortController,
        document: { getElementById: element, activeElement: null },
        navigator: {},
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        clearTimeout: id => { if (timers[id - 1]) timers[id - 1].fn = null; },
        getApiData: () => ({ apis, defaultId: apis[0]?.id || null }),
        getWechatCharDisplayName: char => char.name,
        sendWechatCallMessage: async (text, options = {}) => { sent.push(options.nudge ? { nudge: options.attempt, seconds: options.silentSeconds } : text); return true; }
    });
    context.window.setWechatCallFloatSpeaking = () => {};
    vm.runInContext(read('apps/wechat/chat/call-audio.js'), context);
    vm.runInContext(read('apps/wechat/chat/call-voice.js'), context);
    const flush = async (maxMs = Infinity) => {
        for (let i = 0; i < 20; i++) {
            const due = timers.map((t, index) => ({ t, index })).filter(({ t }) => t.fn && t.ms <= maxMs);
            if (!due.length) break;
            for (const { t } of due) { const fn = t.fn; t.fn = null; await fn(); }
            await new Promise(resolve => setImmediate(resolve));
        }
    };
    return { context, window, voice: window.ByndCallVoice, sent, timers, flush, elements };
}

const nativeBridge = () => {
    const calls = [];
    return { calls, speechAvailable: () => true, speechStart: lang => calls.push(['start', lang]), speechStop: () => calls.push(['stop']), callOverlayStart: json => calls.push(['overlay', JSON.parse(json)]), callOverlayStop: () => calls.push(['overlay-stop']) };
};

test('settings default to on, auto engine and 8 seconds, and clamp bad input', () => {
    const { voice } = harness();
    const settings = voice.read();
    assert.equal(settings.enabled, true);
    assert.equal(settings.engine, 'auto');
    assert.equal(settings.silenceSeconds, 8);
    const saved = voice.write({ engine: 'nonsense', silenceSeconds: 1, model: '  ' });
    assert.equal(saved.engine, 'auto');
    assert.equal(saved.silenceSeconds, 3);
    assert.equal(saved.model, 'whisper-1');
    assert.equal(voice.write({ silenceSeconds: 999 }).silenceSeconds, 60);
});

test('engine choice: system recognizer first, API transcription as the fallback', () => {
    assert.equal(harness({ android: nativeBridge() }).voice.pickEngine(), 'native');
    const noSystem = harness({ apis: [{ id: 'a', baseUrl: 'https://x/v1', apiKey: 'k' }] });
    assert.equal(noSystem.voice.pickEngine(), null, 'no microphone recorder in this fake page');
    assert.equal(harness({ android: nativeBridge() }).voice.pickEngine({ engine: 'api', apiId: '' }), null);
});

test('the character hearing its own voice is not mistaken for the user', () => {
    const { voice } = harness();
    assert.equal(voice.isEcho('我今天加班到很晚', '我今天加班到很晚，你吃饭了吗？'), true);
    assert.equal(voice.isEcho('今天加般到很晚', '我今天加班到很晚，你吃饭了吗？'), true, 'one misheard character is still echo');
    assert.equal(voice.isEcho('等一下我有话说', '我今天加班到很晚，你吃饭了吗？'), false);
    assert.equal(voice.isEcho('好', ''), false);
});

test('follow-ups back off: 8s, 16s, 32s', () => {
    const { voice } = harness();
    const settings = voice.read();
    assert.deepEqual([0, 1, 2].map(n => voice.nudgeDelayMs(settings, n)), [8000, 16000, 32000]);
});

async function liveCall(h) {
    const call = { id: 1, type: 'voiceCall', charId: 'c1', acceptedAt: Date.now(), lines: [], ended: false };
    h.window._wechatActiveCall = call;
    await h.voice.start(call);
    return call;
}

test('native recognizer: words become a call message, the overlay starts, and hang-up stops both', async () => {
    const android = nativeBridge();
    const h = harness({ android });
    const call = await liveCall(h);
    assert.deepEqual(android.calls[0][0], 'overlay');
    assert.equal(android.calls[0][1].name, '商桓');
    assert.equal(android.calls[0][1].avatar, 'assets/a.png');
    assert.deepEqual(android.calls[1], ['start', 'zh-CN']);
    assert.equal(h.voice.isListening(call), true);
    h.voice.onNative({ type: 'begin' });
    h.voice.onNative({ type: 'final', text: '你在干嘛' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.sent, ['你在干嘛']);
    h.voice.onNative({ type: 'end' });
    await h.flush(200);
    assert.deepEqual(android.calls.at(-1), ['start', 'zh-CN'], 'listening resumes after each phrase');
    h.voice.stop();
    assert.deepEqual(android.calls.slice(-2), [['stop'], ['overlay-stop']]);
});

test('silence makes the character speak up, at most three times, and the user talking resets it', async () => {
    const h = harness({ android: nativeBridge() });
    await liveCall(h);
    await h.flush(8000);
    assert.deepEqual(h.sent, [{ nudge: 1, seconds: 8 }]);
    h.window.dispatchEvent(new CustomEvent('bynd:call-reply-settled', { detail: { callId: 1 } }));
    await h.flush(16000);
    await h.flush(32000);
    h.window.dispatchEvent(new CustomEvent('bynd:call-reply-settled', { detail: { callId: 1 } }));
    await h.flush(Infinity);
    h.window.dispatchEvent(new CustomEvent('bynd:call-reply-settled', { detail: { callId: 1 } }));
    await h.flush(Infinity);
    assert.equal(h.sent.filter(item => item.nudge).length, 3, 'stops after three unanswered follow-ups');
    h.voice.onNative({ type: 'final', text: '在呢' });
    await new Promise(resolve => setImmediate(resolve));
    h.window.dispatchEvent(new CustomEvent('bynd:call-reply-settled', { detail: { callId: 1 } }));
    await h.flush(8000);
    assert.deepEqual(h.sent.at(-1), { nudge: 1, seconds: 8 }, 'an answer resets the count');
});

test('muting stops listening and unmuting resumes it', async () => {
    const android = nativeBridge();
    const h = harness({ android });
    const call = await liveCall(h);
    await h.voice.setMuted(call, true);
    assert.equal(h.voice.isListening(call), false);
    assert.deepEqual(android.calls.at(-1), ['stop']);
    await h.voice.setMuted(call, false);
    assert.deepEqual(android.calls.at(-1), ['start', 'zh-CN']);
});

test('a fatal recognizer error with no fallback tells the user they can type', async () => {
    const h = harness({ android: nativeBridge() });
    await liveCall(h);
    await h.voice.onNative({ type: 'error', text: '这台手机没有系统语音识别服务', fatal: true });
    assert.match(h.elements['wc-call-listen-text'].textContent, /没有系统语音识别服务.*可以继续打字/);
});

test('barge-in stops the character mid-sentence, drops queued sentences, and later speech still plays', async () => {
    const h = harness();
    const played = [];
    class FakeAudio { play() { played.push(this.src); FakeAudio.last = this; return Promise.resolve(); } pause() {} load() {} removeAttribute() {} }
    h.context.Audio = FakeAudio;
    h.context.getDefaultVoiceApi = () => ({ id: 'tts' });
    h.context.requestVoiceAudioWithConfig = async text => ({ audioUrl: 'audio:' + text, duration: 1 });
    vm.runInContext(read('apps/wechat/chat/call-audio.js'), h.context);
    const audio = h.window.ByndWechatCallAudio;
    const call = { id: 7, charId: 'c1', acceptedAt: 1, ended: false };
    h.window._wechatActiveCall = call;
    const speaking = [];
    h.window.addEventListener('bynd:call-speaking', event => speaking.push(event.detail.speaking));
    void audio.enqueue(call, '第一句很长的话');
    void audio.enqueue(call, '第二句');
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(played.filter(src => src.startsWith('audio:')), ['audio:第一句很长的话']);
    assert.equal(audio.isSpeaking(call), true);
    assert.equal(audio.currentText(call), '第一句很长的话');
    assert.equal(audio.interrupt(call), true);
    assert.equal(audio.isSpeaking(call), false);
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(played.includes('audio:第二句'), false, 'queued sentences are dropped');
    void audio.enqueue(call, '新的一句');
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(played.at(-1), 'audio:新的一句', 'the call can still speak after an interruption');
    assert.deepEqual(speaking.slice(0, 2), [true, false]);
});

test('call screen wiring: minimize pill, live voice start/stop and nudge replies', () => {
    const calls = read('apps/wechat/chat/calls.js');
    assert.match(calls, /onclick="minimizeWechatCall\(\)"/);
    assert.match(calls, /if \(call\.videoProvider !== 'vivix'\) void window\.ByndCallVoice\?\.start\(call\);/);
    assert.match(calls, /window\.ByndCallVoice\?\.stop\(\);/);
    assert.match(calls, /if \(result\.cancelled\) return;/);
    assert.match(calls, /用户已经 \$\{seconds\} 秒没有说话/);
    assert.match(read('scripts/source-layout.cjs'), /'apps\/wechat\/chat\/call-voice\.js'/);
    assert.match(read('index.html'), /id="bynd-call-voice-settings"/);
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    assert.match(manifest, /android\.permission\.RECORD_AUDIO/);
    assert.match(manifest, /android:name="\.CallOverlayService"/);
});
