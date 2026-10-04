// Audio belongs to this game session, never to chat or the global music player.
(function () {
    'use strict';
    const SETTINGS_KEY = 'bynd_wolfcha_audio_v1';
    const defaults = { narrator: false, ambience: false, volume: 0.25 };
    let settings = { ...defaults };
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
        if (saved && typeof saved === 'object') settings = {
            narrator: saved.narrator === true,
            ambience: saved.ambience === true,
            volume: Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : defaults.volume
        };
    } catch (_) { /* Corrupt preferences fall back to quiet defaults. */ }

    let panelOpen = false;
    let armed = false;
    let generation = 0;
    let utterance = null;
    let nativeSpeaking = false;
    let nativeTimer = null;
    let cancelVoiceWait = null;
    let fxContext = null;
    let fxMaster = null;
    const bellClips = new Set();
    let speechActive = false;
    let lastNarration = '';
    let lastPhase = '';
    let lastSeat = '';
    let status = '声音默认关闭，按需开启。';

    const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    function visible() {
        return !document.hidden && document.getElementById('app-game-window')?.classList.contains('active')
            && typeof getActiveGame === 'function' && getActiveGame() === 'wolfcha';
    }
    function notice(text, failed = false) {
        status = text;
        document.querySelectorAll('[data-wolfcha-audio-status]').forEach(el => { el.textContent = text; });
        if (failed && typeof showWechatToast === 'function') showWechatToast(text);
    }
    function refresh() { if (visible() && typeof renderGameApp === 'function') renderGameApp(); }
    function duck(active) {
        speechActive = active;
        bellClips.forEach(audio => { audio.volume = settings.volume * (active ? 0.08 : 0.4); });
        if (fxContext && fxMaster) fxMaster.gain.setTargetAtTime(settings.volume * (active ? 0.2 : 1), fxContext.currentTime, 0.18);
    }
    function stopSpeech(silent = false) {
        generation++;
        clearTimeout(nativeTimer);
        nativeTimer = null;
        cancelVoiceWait?.();
        if (utterance) { utterance.onstart = null; utterance.onend = null; utterance.onerror = null; window.speechSynthesis?.cancel(); utterance = null; }
        if (nativeSpeaking) { try { window.ByndAndroid?.stopTts?.(); } catch (_) {} nativeSpeaking = false; }
        duck(false);
        if (!silent) notice('旁白已停止。');
    }
    function stopAmbience() {
        bellClips.forEach(audio => { audio.onended = null; audio.onerror = null; audio.pause(); audio.removeAttribute?.('src'); audio.load?.(); });
        bellClips.clear();
        const context = fxContext;
        fxContext = null;
        fxMaster = null;
        if (context && context.state !== 'closed') Promise.resolve(context.close()).catch(() => {});
    }
    function stop() {
        armed = false;
        stopSpeech(true);
        stopAmbience();
        lastNarration = ''; lastPhase = ''; lastSeat = '';
    }

    async function ensureAmbience() {
        if (!armed || !settings.ambience || !visible()) return null;
        let requestedContext = fxContext;
        try {
            if (!fxContext) {
                const Context = window.AudioContext || window.webkitAudioContext;
                if (!Context) throw new Error('当前设备不支持氛围音');
                fxContext = new Context();
                requestedContext = fxContext;
                fxMaster = fxContext.createGain();
                fxMaster.gain.value = settings.volume * (speechActive ? 0.2 : 1);
                fxMaster.connect(fxContext.destination);
                // A quiet, filtered wind bed, generated locally without media downloads.
                const buffer = fxContext.createBuffer(1, fxContext.sampleRate * 3, fxContext.sampleRate);
                const samples = buffer.getChannelData(0);
                for (let index = 0; index < samples.length; index++) samples[index] = (Math.random() * 2 - 1) * 0.1;
                const wind = fxContext.createBufferSource();
                wind.buffer = buffer; wind.loop = true;
                const filter = fxContext.createBiquadFilter();
                filter.type = 'lowpass'; filter.frequency.value = 420;
                wind.connect(filter); filter.connect(fxMaster); wind.start();
            }
            const context = fxContext;
            if (context.state === 'suspended') await context.resume();
            if (context !== fxContext || !armed || !settings.ambience || !visible()) return null;
            if (context.state !== 'running') throw new Error('请再次点击声音，允许播放氛围音');
            return context;
        } catch (error) {
            if (requestedContext !== fxContext) return null;
            stopAmbience();
            notice('氛围音未能播放：' + (error.message || '设备不可用'), true);
            return null;
        }
    }
    async function cue(kind) {
        const context = await ensureAmbience();
        if (!context || !fxMaster) return;
        if (kind !== 'card' && typeof Audio === 'function') {
            const audio = new Audio('assets/games/wolfcha/audio/bell-ding.wav');
            audio.volume = settings.volume * (speechActive ? 0.08 : 0.4);
            audio.playbackRate = kind === 'night' ? 0.72 : 1;
            audio.preservesPitch = false;
            bellClips.add(audio);
            let failed = false;
            const fallback = () => {
                if (failed) return;
                failed = true;
                bellClips.delete(audio); audio.pause();
                if (context !== fxContext || !settings.ambience || !visible()) return;
                notice('钟声素材未能播放，已改用本地合成钟声。');
                synthesizeCue(context, kind);
            };
            audio.onended = () => { bellClips.delete(audio); };
            audio.onerror = fallback;
            try {
                await audio.play();
                if (context !== fxContext || !settings.ambience || !visible()) { audio.pause(); bellClips.delete(audio); }
            } catch (_) { fallback(); }
            return;
        }
        synthesizeCue(context, kind);
    }
    function synthesizeCue(context, kind) {
        if (context !== fxContext || !fxMaster) return;
        const frequencies = kind === 'card' ? [720] : kind === 'night' ? [146.8, 293.6] : [220, 440, 659.3];
        frequencies.forEach((frequency, index) => {
            const tone = context.createOscillator();
            const envelope = context.createGain();
            const start = context.currentTime + index * 0.11;
            const length = kind === 'card' ? 0.1 : 1.8;
            tone.type = 'sine'; tone.frequency.value = frequency;
            envelope.gain.setValueAtTime(0.0001, start);
            envelope.gain.exponentialRampToValueAtTime(kind === 'card' ? 0.08 : 0.12 / (index + 1), start + 0.012);
            envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
            tone.connect(envelope); envelope.connect(fxMaster);
            tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
            tone.start(start); tone.stop(start + length + 0.02);
        });
    }
    function activate() {
        if (!visible()) return;
        armed = true;
        if (settings.ambience) void ensureAmbience();
    }
    function narratorFor(state) {
        const logs = Array.isArray(state?.log) ? state.log : [];
        for (let index = logs.length - 1; index >= 0; index--) {
            const entry = normalizeWolfchaLogEntry(logs[index]);
            if (entry.type === 'narrator') return {
                text: getWolfchaPublicLogText(entry, state),
                key: JSON.stringify([state.day, state.phase, index, entry.text, entry.playerId || ''])
            };
        }
        return null;
    }
    function loadSystemVoices() {
        const synth = window.speechSynthesis;
        const voices = synth.getVoices();
        if (voices.length || typeof synth.addEventListener !== 'function') return Promise.resolve(voices);
        return new Promise(resolve => {
            let timer;
            const finish = () => {
                clearTimeout(timer);
                synth.removeEventListener('voiceschanged', finish);
                cancelVoiceWait = null;
                resolve(synth.getVoices());
            };
            cancelVoiceWait = finish;
            synth.addEventListener('voiceschanged', finish);
            timer = setTimeout(finish, 1200);
        });
    }
    async function speak(text) {
        if (!text || !visible()) return false;
        stopSpeech(true);
        const ticket = generation;
        const valid = () => ticket === generation && visible();
        const done = () => { if (valid()) { duck(false); notice('旁白播放完毕。'); } };
        try {
            duck(true);
            if (typeof window.ByndAndroid?.speakText === 'function') {
                const raw = window.ByndAndroid.speakText(text, 'zh-CN', 0.9);
                const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (result?.status !== 'queued') {
                    throw new Error(result?.status === 'missing-data' ? '请在手机系统中安装中文语音包'
                        : result?.status === 'not-supported' ? '系统语音不支持中文' : '系统语音正在初始化，请稍后重试');
                }
                nativeSpeaking = true;
                notice('旁白已交给系统播放');
                // The native bridge has no completion callback; never claim estimated completion.
                nativeTimer = setTimeout(() => { if (valid()) duck(false); }, Math.min(120000, Math.max(2500, text.length * 300)));
                return true;
            }
            if (!window.speechSynthesis || typeof SpeechSynthesisUtterance !== 'function') throw new Error('当前设备没有可用的系统语音');
            notice('正在加载系统中文音色…');
            const voices = await loadSystemVoices();
            if (!valid()) return false;
            const chinese = voices.filter(voice => /^zh([_-]|$)/i.test(voice.lang));
            if (!chinese.length) throw new Error('系统里没有中文音色，请安装中文语音包后重试');
            utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN'; utterance.rate = 0.9; utterance.pitch = 0.85;
            utterance.voice = chinese.find(voice => /^zh[-_]CN$/i.test(voice.lang)) || chinese[0];
            utterance.onstart = () => { if (valid()) notice('旁白播放中 · 系统语音'); };
            utterance.onend = () => { if (valid()) { utterance = null; done(); } };
            utterance.onerror = event => {
                if (!valid()) return false;
                stopSpeech(true);
                notice('系统旁白未能播放：' + (event.error === 'not-allowed' ? '请点击朗读重试' : event.error || '语音不可用'), true);
            };
            window.speechSynthesis.speak(utterance);
            return true;
        } catch (error) {
            if (ticket === generation && visible()) { stopSpeech(true); notice('旁白未能播放：' + (error.message || '请重试'), true); }
            return false;
        }
    }
    function playNarrator() {
        activate();
        const state = typeof getGameState === 'function' ? getGameState() : null;
        const narration = narratorFor(state);
        if (!narration?.text) { notice('当前还没有旁白。'); return Promise.resolve(false); }
        lastNarration = narration.key;
        return speak(narration.text);
    }
    function observe(state) {
        const narration = narratorFor(state);
        const changed = narration && narration.key !== lastNarration;
        const phase = String(state?.phase || '');
        if (armed && settings.ambience && visible()) {
            if (phase !== lastPhase) void cue(phase === 'night' ? 'night' : 'day');
            else if (lastSeat && state.selectedId !== lastSeat) void cue('card');
        }
        lastPhase = phase; lastSeat = state?.selectedId || '';
        if (changed) {
            lastNarration = narration.key;
            if (settings.narrator && armed && visible()) void speak(narration.text);
        }
    }
    function configure(key, value) {
        if (!Object.hasOwn(defaults, key)) return false;
        const next = { ...settings, [key]: value };
        next.narrator = next.narrator === true; next.ambience = next.ambience === true;
        next.volume = Math.max(0, Math.min(1, Number(next.volume) || 0));
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); }
        catch (_) { notice('声音设置未保存，请重试。', true); refresh(); return false; }
        settings = next;
        activate();
        if (key === 'narrator' && !settings.narrator) stopSpeech(true);
        if (!settings.ambience) stopAmbience(); else duck(speechActive);
        notice('旁白使用系统自带中文语音；氛围音可单独开启。');
        refresh();
        if (key === 'narrator' && settings.narrator) void playNarrator();
        if (key === 'ambience' && settings.ambience) void cue('day');
        return true;
    }
    function renderControls() {
        if (!panelOpen) return '';
        return `<section id="wolfcha-sound-panel" class="wolfcha-sound-panel" aria-label="牌局声音">
            <label class="wolfcha-sound-row">自动读旁白<input type="checkbox" ${settings.narrator ? 'checked' : ''} onchange="WolfchaAudio.configure('narrator',this.checked)"></label>
            <label class="wolfcha-sound-row">风声、钟声与选牌音<input type="checkbox" ${settings.ambience ? 'checked' : ''} onchange="WolfchaAudio.configure('ambience',this.checked)"></label>
            <label class="wolfcha-sound-row">氛围音量<input type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}" onchange="WolfchaAudio.configure('volume',Number(this.value)/100)"></label>
            <p>旁白使用系统自带中文音色，无需接口配置。朗读时氛围音自动减弱。</p>
            <div class="wolfcha-sound-buttons"><button type="button" onclick="WolfchaAudio.playNarrator()">试听旁白</button><button type="button" onclick="WolfchaAudio.stopSpeech()">停止旁白</button></div>
            <p role="status" aria-live="polite" data-wolfcha-audio-status>${escape(status)}</p>
        </section>`;
    }

    window.WolfchaAudio = {
        get panelOpen() { return panelOpen; },
        get settings() { return { ...settings }; },
        get status() { return status; },
        togglePanel() { panelOpen = !panelOpen; activate(); refresh(); },
        renderControls, configure, playNarrator, observe, stopSpeech, stop,
        resetNarration() { stopSpeech(true); lastNarration = ''; lastPhase = ''; lastSeat = ''; }
    };
    document.addEventListener('click', event => {
        if (event.target?.closest?.('#app-game-window button, #app-game-window input, #app-game-window select')) activate();
    }, true);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    window.addEventListener?.('pagehide', stop);
})();
