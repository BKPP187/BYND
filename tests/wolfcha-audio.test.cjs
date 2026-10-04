const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, memoryStorage, deferred } = require('./helpers/harness.cjs');
const source = fs.readFileSync(path.join(root, 'apps/games/wolfcha-audio.js'), 'utf8');

function harness() {
    const state = { active: true, mode: 'wolfcha', log: [], spoken: [], canceled: 0, notices: [], audios: [], contexts: [], native: [], stoppedNative: 0 };
    let game = { phase: 'day', day: 1, selectedId: 'user', log: [{ type: 'narrator', text: '天亮了。', name: '旁白' }] };
    const listeners = {};
    const localStorage = memoryStorage();
    const param = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
    const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param() });
    class Context {
        constructor() { this.state = 'running'; this.sampleRate = 100; this.currentTime = 0; this.destination = {}; state.contexts.push(this); }
        createGain() { return node(); }
        createBiquadFilter() { return node(); }
        createOscillator() { return node(); }
        createBufferSource() { return node(); }
        createBuffer() { return { getChannelData: () => new Float32Array(300) }; }
        resume() { this.state = 'running'; return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
    }
    class Audio {
        constructor(url) { this.url = url; this.paused = false; state.audios.push(this); }
        play() { return state.playError ? Promise.reject(state.playError) : Promise.resolve(); }
        pause() { this.paused = true; }
        removeAttribute() {}
        load() {}
    }
    const synth = {
        getVoices: () => state.voices || [{ lang: 'zh-CN', name: '中文' }],
        speak: utterance => state.spoken.push(utterance), cancel: () => { state.canceled++; }
    };
    const document = {
        hidden: false, querySelectorAll: () => [],
        getElementById: () => ({ classList: { contains: () => state.active } }),
        addEventListener: (name, listener) => { listeners[name] = listener; }
    };
    const context = vm.createContext({
        window: { speechSynthesis: synth, AudioContext: Context, addEventListener: (name, listener) => { listeners[name] = listener; } },
        document, localStorage, Audio, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
        getActiveGame: () => state.mode, getGameState: () => game,
        normalizeWolfchaLogEntry: entry => typeof entry === 'string' ? { type: 'narrator', text: entry } : entry,
        getWolfchaPublicLogText: entry => entry.text.replace(/身份是 狼人。/g, '身份已封存。'),
        renderGameApp: () => context.window.WolfchaAudio.observe(game),
        getDefaultVoiceApi: () => state.api || null,
        requestDefaultVoiceAudio: text => { state.log.push(text); return state.apiResult; },
        showWechatToast: text => state.notices.push(text), setTimeout, clearTimeout, console
    });
    vm.runInContext(source, context);
    return { A: context.window.WolfchaAudio, state, document, localStorage, listeners, context,
        game: () => game, setGame: next => { game = next; } };
}

test('narration is opt-in, sanitized, and never replays on seat changes or rerenders', async () => {
    const h = harness();
    h.A.observe(h.game());
    assert.equal(h.state.spoken.length, 0);
    h.A.configure('narrator', true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.state.spoken.length, 1);
    assert.equal(h.state.spoken[0].lang, 'zh-CN');
    h.A.observe(h.game());
    h.game().selectedId = 'other'; h.A.observe(h.game());
    assert.equal(h.state.spoken.length, 1);
    h.game().log.push({ type: 'narrator', text: '身份是 狼人。' }); h.A.observe(h.game());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.state.spoken.at(-1).text, '身份已封存。');
    h.A.stop();
    assert.ok(h.state.canceled >= 1);
});

test('voice errors, absent Chinese voices, and storage errors remain explicit', async () => {
    const h = harness();
    h.localStorage.setItem = () => { throw new Error('满了'); };
    assert.equal(h.A.configure('narrator', true), false);
    assert.equal(h.A.settings.narrator, false);
    assert.equal(h.state.spoken.length, 0);
    assert.match(h.A.status, /未保存/);
    h.state.voices = [{ lang: 'en-US' }];
    assert.equal(await h.A.playNarrator(), false);
    assert.match(h.A.status, /没有中文/);
    h.state.voices = [{ lang: 'zh-CN' }];
    await h.A.playNarrator();
    h.state.spoken.at(-1).onerror({ error: 'not-allowed' });
    assert.match(h.A.status, /点击朗读/);
});

test('system narration never calls a configured or character TTS API', async () => {
    const h = harness();
    const forbidden = () => { throw new Error('TTS API must not be called'); };
    h.context.getDefaultVoiceApi = forbidden;
    h.context.requestDefaultVoiceAudio = forbidden;
    h.context.requestCharacterVoiceAudio = forbidden;
    assert.equal(h.A.configure('source', 'api'), false);
    assert.equal(await h.A.playNarrator(), true);
    assert.equal(h.state.spoken.length, 1);
    assert.equal(h.state.audios.length, 0);
    h.A.stop();
});

test('late system voice discovery is canceled on exit; older callbacks cannot report completion', async () => {
    const h = harness();
    const synth = h.context.window.speechSynthesis;
    const events = new Map();
    synth.addEventListener = (name, fn) => events.set(name, fn);
    synth.removeEventListener = name => events.delete(name);
    h.state.voices = [];
    const pending = h.A.playNarrator();
    assert.ok(events.has('voiceschanged'));
    h.A.stop();
    h.state.voices = [{ lang: 'zh-CN' }];
    assert.equal(await pending, false);
    assert.equal(events.size, 0);
    assert.equal(h.state.spoken.length, 0);
    await h.A.playNarrator();
    const oldDone = h.state.spoken.at(-1).onend;
    await h.A.playNarrator();
    oldDone();
    assert.doesNotMatch(h.A.status, /播放完毕/);
    h.state.spoken.at(-1).onend();
    assert.match(h.A.status, /播放完毕/);
});

test('CC0 bell errors fall back explicitly and leaving stops sampled audio', async () => {
    const h = harness();
    h.state.playError = new Error('asset missing');
    h.A.configure('ambience', true);
    await new Promise(resolve => setImmediate(resolve));
    assert.match(h.A.status, /素材未能播放/);
    assert.equal(h.state.audios[0].paused, true);
    h.state.playError = null;
    h.game().phase = 'night'; h.A.observe(h.game());
    await new Promise(resolve => setImmediate(resolve));
    const bell = h.state.audios.at(-1);
    assert.match(bell.url, /bell-ding.wav$/);
    assert.equal(bell.playbackRate, 0.72);
    h.A.stop();
    assert.equal(bell.paused, true);
});

test('native TTS reports missing data and stops only speech owned by this game', async () => {
    const h = harness();
    h.context.window.ByndAndroid = {
        speakText: (...args) => { h.state.native.push(args); return JSON.stringify({ status: h.state.nativeStatus || 'queued' }); },
        stopTts: () => { h.state.stoppedNative++; }
    };
    h.A.stop(); assert.equal(h.state.stoppedNative, 0);
    h.state.nativeStatus = 'missing-data';
    assert.equal(await h.A.playNarrator(), false);
    assert.match(h.A.status, /安装中文语音包/);
    h.state.nativeStatus = 'queued';
    assert.equal(await h.A.playNarrator(), true);
    assert.match(h.A.status, /交给系统/);
    assert.equal(h.state.native.at(-1)[1], 'zh-CN');
    h.A.stop(); assert.equal(h.state.stoppedNative, 1);
});

test('wind and cues close on leaving the page, hidden tabs stay quiet', async () => {
    const h = harness();
    assert.equal(h.state.contexts.length, 0);
    h.A.configure('ambience', true);
    await Promise.resolve();
    assert.equal(h.state.contexts.length, 1);
    h.document.hidden = true; h.listeners.visibilitychange();
    assert.equal(h.state.contexts[0].state, 'closed');
    h.A.observe(h.game());
    assert.equal(h.state.contexts.length, 1);
    assert.equal(h.state.spoken.length, 0);
    h.document.hidden = false;
    h.A.configure('ambience', true);
    assert.equal(h.state.contexts.length, 2);
    h.listeners.pagehide();
    assert.equal(h.state.contexts[1].state, 'closed');
});
