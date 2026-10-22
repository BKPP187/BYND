// Live voice for ordinary voice/video calls: keep listening, let the user talk over the character
// (barge-in), and let the character pick the conversation back up after a silence.
// Speech recognition: Android system recognizer (APK) or the browser's, falling back to an
// OpenAI-compatible /audio/transcriptions API. Audio never leaves the device except to that API.
(function () {
    'use strict';

    const SETTINGS_KEY = 'bynd_call_voice_v1';
    const ENGINES = ['auto', 'system', 'api'];
    const defaults = () => ({ enabled: true, engine: 'auto', apiId: '', model: 'whisper-1', silenceSeconds: 8, maxNudges: 3 });
    const clampSeconds = value => Math.min(60, Math.max(3, Math.round(Number(value) || 8)));
    const clampNudges = value => Math.min(5, Math.max(0, Math.round(Number(value ?? 3))));

    function read() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
            if (!saved || typeof saved !== 'object') return defaults();
            return {
                enabled: saved.enabled !== false,
                engine: ENGINES.includes(saved.engine) ? saved.engine : 'auto',
                apiId: String(saved.apiId || ''),
                model: String(saved.model || 'whisper-1').trim().slice(0, 80) || 'whisper-1',
                silenceSeconds: clampSeconds(saved.silenceSeconds),
                maxNudges: clampNudges(saved.maxNudges)
            };
        } catch (_) { return defaults(); }
    }

    function write(config) {
        const next = {
            enabled: config.enabled !== false,
            engine: ENGINES.includes(config.engine) ? config.engine : 'auto',
            apiId: String(config.apiId || ''),
            model: String(config.model || 'whisper-1').trim().slice(0, 80) || 'whisper-1',
            silenceSeconds: clampSeconds(config.silenceSeconds),
            maxNudges: clampNudges(config.maxNudges)
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        return next;
    }

    // ---------- Text helpers ----------
    const normalize = text => String(text || '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');

    // True when what the microphone heard is just the character's own voice coming back from the speaker.
    function isEcho(heard, spoken) {
        const a = normalize(heard), b = normalize(spoken);
        if (!a) return true;
        if (!b) return false;
        if (b.includes(a)) return true;
        // Mostly-overlapping partial results (recognizers mishear a character or two).
        let hits = 0;
        for (const ch of new Set(a)) if (b.includes(ch)) hits += 1;
        return a.length >= 4 && hits / new Set(a).size >= 0.85;
    }

    // Delay before the n-th unprompted follow-up: 8s, 16s, 32s… so a quiet user is not talked at.
    function nudgeDelayMs(settings, attempt) {
        return clampSeconds(settings.silenceSeconds) * 1000 * Math.pow(2, Math.max(0, attempt));
    }

    // ---------- Engine selection ----------
    const nativeBridge = () => (window.ByndAndroid && typeof window.ByndAndroid.speechStart === 'function') ? window.ByndAndroid : null;
    function nativeAvailable() {
        const bridge = nativeBridge();
        try { return !!bridge && (typeof bridge.speechAvailable !== 'function' || String(bridge.speechAvailable()) === 'true'); } catch (_) { return false; }
    }
    const WebRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
    function transcriptionApi(settings = read()) {
        if (typeof getApiData !== 'function') return null;
        const data = getApiData();
        const api = data.apis.find(item => item.id === settings.apiId) || data.apis.find(item => item.id === data.defaultId);
        return api && api.baseUrl && api.apiKey ? api : null;
    }
    const recorderAvailable = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && (window.AudioContext || window.webkitAudioContext));

    function pickEngine(settings = read()) {
        const system = nativeAvailable() ? 'native' : (WebRecognition() ? 'web' : null);
        const api = recorderAvailable() && transcriptionApi(settings) ? 'api' : null;
        if (settings.engine === 'system') return system;
        if (settings.engine === 'api') return api;
        return system || api;
    }

    // ---------- Session ----------
    let session = null;

    function wantsLiveVoice(call) {
        const settings = read();
        return !!call && settings.enabled && call.videoProvider !== 'vivix' && !!pickEngine(settings);
    }

    function isListening(call) {
        return !!session && session.call === call && !session.muted && !!session.engine;
    }

    function audio() { return window.ByndWechatCallAudio || null; }
    const live = s => !!s && s === session && !s.call.ended && window._wechatActiveCall === s.call;

    function setListenUi(s, text, state = 'listening') {
        const box = document.getElementById('wc-call-listen');
        const label = document.getElementById('wc-call-listen-text');
        if (!box || !label) return;
        const show = live(s);
        box.classList.toggle('hidden', !show);
        box.dataset.state = state;
        label.textContent = text;
    }

    function refreshUi(call) {
        const s = session;
        if (!s || s.call !== call) return;
        if (s.muted) setListenUi(s, '麦克风已关闭', 'muted');
        else if (s.engine) setListenUi(s, s.hearing ? `听到：${s.hearing}` : '正在听…', s.hearing ? 'hearing' : 'listening');
        try { window.setWechatCallFloatSpeaking?.(audio()?.isSpeaking(call)); } catch (_) {}
    }

    function clearSilence(s) {
        if (s?.silenceTimer) { clearTimeout(s.silenceTimer); s.silenceTimer = null; }
    }

    // Arm the follow-up timer once both sides are quiet.
    function armSilence(s) {
        clearSilence(s);
        if (!live(s) || s.userSpeaking) return;
        const settings = read();
        if (s.nudges >= settings.maxNudges) return;
        if (s.call.busy || audio()?.isBusy?.(s.call)) return;
        // Someone typing a message is not silent.
        const typing = () => { const input = document.getElementById('wc-call-input'); return !!input && (!!input.value.trim() || document.activeElement === input); };
        s.silenceTimer = setTimeout(() => {
            s.silenceTimer = null;
            if (!live(s) || s.userSpeaking || s.call.busy || audio()?.isBusy?.(s.call)) return;
            if (typing()) { armSilence(s); return; }
            const delay = nudgeDelayMs(settings, s.nudges);
            s.nudges += 1;
            void sendWechatCallMessage(null, { nudge: true, silentSeconds: delay / 1000, attempt: s.nudges });
        }, nudgeDelayMs(settings, s.nudges));
    }

    // The user started talking: stop the character mid-sentence and drop the pending reply.
    function bargeIn(s) {
        if (!live(s)) return;
        clearSilence(s);
        s.nudges = 0;
        const interrupted = audio()?.interrupt?.(s.call);
        if (s.call.busy) s.call.requestController?.abort();
        if (interrupted) s.interruptedAt = Date.now();
        refreshUi(s.call);
    }

    async function deliver(s, text) {
        if (!live(s)) return;
        const clean = String(text || '').trim();
        s.hearing = '';
        s.userSpeaking = false;
        if (!clean) { refreshUi(s.call); armSilence(s); return; }
        // Ignore the character's own words picked up by the microphone.
        if (Date.now() - (s.lastSpokenAt || 0) < 4000 && isEcho(clean, s.lastSpokenText)) { refreshUi(s.call); armSilence(s); return; }
        bargeIn(s);
        // A reply that was cancelled for this barge-in needs a moment to release the call.
        for (let waited = 0; s.call.busy && waited < 3000; waited += 50) await new Promise(resolve => setTimeout(resolve, 50));
        if (!live(s)) return;
        s.nudges = 0;
        refreshUi(s.call);
        await sendWechatCallMessage(clean);
    }

    function onSpeechStart(s) {
        if (!live(s) || s.muted) return;
        s.userSpeaking = true;
        clearSilence(s);
        // A recognizer "speech start" while the character talks may be its own echo; wait for words (see onPartial).
        if (!audio()?.isSpeaking(s.call) || s.engine === 'api') bargeIn(s);
    }

    function onPartial(s, text) {
        if (!live(s) || s.muted) return;
        const spoken = audio()?.currentText(s.call) || '';
        if (spoken && isEcho(text, spoken)) return;
        s.userSpeaking = true;
        s.hearing = String(text || '').slice(-30);
        if (spoken && normalize(text).length >= 2) bargeIn(s);
        refreshUi(s.call);
    }

    // ---------- Android system recognizer ----------
    function startNative(s) {
        const bridge = nativeBridge();
        try { bridge.speechStart('zh-CN'); return true; } catch (_) { return false; }
    }
    function stopNative() { try { nativeBridge()?.speechStop(); } catch (_) {} }

    // Called by MainActivity: { type: begin|partial|final|end|error, text, fatal }
    function onNative(event) {
        const s = session;
        if (!s || s.engine !== 'native' || !event) return;
        if (event.type === 'begin') onSpeechStart(s);
        else if (event.type === 'partial') onPartial(s, event.text);
        else if (event.type === 'final') void deliver(s, event.text);
        else if (event.type === 'end' || event.type === 'error') {
            if (s.userSpeaking && event.type === 'end') { s.userSpeaking = false; armSilence(s); }
            if (event.fatal) return switchToFallback(s, event.text || '系统语音识别不可用');
            // Single-utterance recognizers stop after each phrase; keep the line open.
            if (live(s) && !s.muted) setTimeout(() => { if (live(s) && !s.muted && s.engine === 'native') startNative(s); }, event.type === 'error' ? 600 : 150);
        }
    }

    // ---------- Browser SpeechRecognition ----------
    function startWeb(s) {
        const Recognition = WebRecognition();
        if (!Recognition) return false;
        const recognition = new Recognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onspeechstart = () => onSpeechStart(s);
        recognition.onresult = event => {
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const result = event.results[i];
                const text = result[0]?.transcript || '';
                if (result.isFinal) void deliver(s, text); else onPartial(s, text);
            }
        };
        recognition.onerror = event => {
            if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) switchToFallback(s, event.error === 'audio-capture' ? '没有可用的麦克风' : '浏览器没有允许使用麦克风');
        };
        recognition.onend = () => {
            if (s.userSpeaking) { s.userSpeaking = false; armSilence(s); }
            if (live(s) && !s.muted && s.engine === 'web' && s.recognition === recognition) {
                try { recognition.start(); } catch (_) {}
            }
        };
        s.recognition = recognition;
        try { recognition.start(); return true; } catch (_) { return false; }
    }
    function stopWeb(s) {
        const recognition = s.recognition;
        s.recognition = null;
        try { recognition?.abort(); } catch (_) {}
    }

    // ---------- Microphone + voice activity detection + transcription API ----------
    const VAD = { frameMs: 50, startFrames: 3, endMs: 800, maxMs: 30000, minMs: 350, threshold: 0.018, speakingThreshold: 0.045 };

    async function startApi(s) {
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        } catch (error) {
            s.engine = null;
            setListenUi(s, error?.name === 'NotAllowedError' ? '没有麦克风权限，可以继续打字' : '麦克风打不开，可以继续打字', 'error');
            return false;
        }
        if (!live(s)) { stream.getTracks().forEach(track => track.stop()); return false; }
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const context = new AudioCtx();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => window.MediaRecorder.isTypeSupported?.(type)) || '';
        const mic = { stream, context, analyser, buffer, mime, loud: 0, quietSince: 0, recorder: null, chunks: [], startedAt: 0 };
        s.mic = mic;
        mic.timer = setInterval(() => vadTick(s), VAD.frameMs);
        return true;
    }

    function rms(mic) {
        mic.analyser.getFloatTimeDomainData(mic.buffer);
        let sum = 0;
        for (let i = 0; i < mic.buffer.length; i += 1) sum += mic.buffer[i] * mic.buffer[i];
        return Math.sqrt(sum / mic.buffer.length);
    }

    function vadTick(s) {
        const mic = s.mic;
        if (!mic || !live(s)) return;
        if (s.muted) return;
        const level = rms(mic);
        // The speaker is on while the character talks; demand a louder voice to count as barge-in.
        const threshold = audio()?.isSpeaking(s.call) ? VAD.speakingThreshold : VAD.threshold;
        const now = Date.now();
        if (!mic.recorder) {
            mic.loud = level > threshold ? mic.loud + 1 : 0;
            if (mic.loud >= VAD.startFrames) beginUtterance(s, now);
            return;
        }
        if (level > VAD.threshold) mic.quietSince = 0;
        else if (!mic.quietSince) mic.quietSince = now;
        if ((mic.quietSince && now - mic.quietSince > VAD.endMs) || now - mic.startedAt > VAD.maxMs) endUtterance(s);
    }

    function beginUtterance(s, now) {
        const mic = s.mic;
        try {
            mic.recorder = new MediaRecorder(mic.stream, mic.mime ? { mimeType: mic.mime } : undefined);
        } catch (_) { mic.recorder = null; return; }
        mic.chunks = [];
        mic.startedAt = now;
        mic.quietSince = 0;
        mic.recorder.ondataavailable = event => { if (event.data?.size) mic.chunks.push(event.data); };
        mic.recorder.start(250);
        onSpeechStart(s);
        s.hearing = '';
        setListenUi(s, '在听你说…', 'hearing');
    }

    function endUtterance(s) {
        const mic = s.mic;
        const recorder = mic?.recorder;
        if (!recorder) return;
        mic.recorder = null;
        mic.loud = 0;
        const duration = Date.now() - mic.startedAt;
        recorder.onstop = () => {
            const blob = new Blob(mic.chunks, { type: recorder.mimeType || mic.mime || 'audio/webm' });
            mic.chunks = [];
            if (duration < VAD.minMs || !blob.size) { s.userSpeaking = false; refreshUi(s.call); armSilence(s); return; }
            setListenUi(s, '正在识别…', 'busy');
            transcribe(blob).then(text => deliver(s, text)).catch(error => {
                s.userSpeaking = false;
                if (live(s)) setListenUi(s, `没听清：${String(error?.message || error).slice(0, 40)}`, 'error');
                setTimeout(() => refreshUi(s.call), 2500);
                armSilence(s);
            });
        };
        try { recorder.stop(); } catch (_) {}
    }

    async function transcribe(blob, settings = read()) {
        const api = transcriptionApi(settings);
        if (!api) throw new Error('没有可用的转写接口');
        const base = String(api.baseUrl).replace(/\/+$/, '');
        const url = (typeof resolveByndApiBaseUrl === 'function' ? resolveByndApiBaseUrl(base) : base) + '/audio/transcriptions';
        const extension = /mp4/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
        const form = new FormData();
        form.append('file', blob, `speech.${extension}`);
        form.append('model', settings.model || 'whisper-1');
        form.append('language', 'zh');
        form.append('response_format', 'json');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${api.apiKey}` }, body: form, signal: controller.signal });
            const raw = await response.text();
            let data = null;
            try { data = JSON.parse(raw); } catch (_) {}
            if (!response.ok) throw new Error(`HTTP ${response.status}${data?.error?.message ? ' ' + data.error.message : ''}`.slice(0, 120));
            const text = typeof data?.text === 'string' ? data.text : (typeof raw === 'string' && !data ? raw : '');
            try { window.ByndUsageLedger?.record?.({ feature: 'call-voice', provider: (typeof URL === 'function' ? new URL(base).host : ''), apiName: api.name || '', model: settings.model, usage: data?.usage || null, ok: true, ticket: null, source: null }); } catch (_) {}
            return text.trim();
        } catch (error) {
            throw error?.name === 'AbortError' ? new Error('识别超时') : error;
        } finally { clearTimeout(timer); }
    }

    function stopApi(s) {
        const mic = s.mic;
        s.mic = null;
        if (!mic) return;
        clearInterval(mic.timer);
        try { mic.recorder?.stop(); } catch (_) {}
        mic.stream.getTracks().forEach(track => track.stop());
        try { mic.context.close(); } catch (_) {}
    }

    // ---------- Lifecycle ----------
    async function startEngine(s) {
        if (s.engine === 'native') return startNative(s);
        if (s.engine === 'web') return startWeb(s);
        if (s.engine === 'api') return startApi(s);
        return false;
    }

    function stopEngine(s) {
        if (s.engine === 'native') stopNative();
        if (s.engine === 'web') stopWeb(s);
        if (s.engine === 'api') stopApi(s);
    }

    async function switchToFallback(s, reason) {
        if (!live(s)) return;
        stopEngine(s);
        const settings = read();
        const canApi = s.engine !== 'api' && settings.engine !== 'system' && recorderAvailable() && transcriptionApi(settings);
        s.engine = canApi ? 'api' : null;
        if (s.engine && await startEngine(s)) { refreshUi(s.call); return; }
        s.engine = null;
        setListenUi(s, `${reason}，可以继续打字`, 'error');
    }

    async function start(call) {
        stop();
        const settings = read();
        if (!call || call.ended || !settings.enabled || call.videoProvider === 'vivix') return false;
        const engine = pickEngine(settings);
        const s = { call, engine, muted: !!call.muted, nudges: 0, userSpeaking: false, hearing: '', silenceTimer: null, lastSpokenText: '', lastSpokenAt: 0 };
        session = s;
        s.onSpeaking = event => {
            if (!live(s) || event.detail?.callId !== s.call.id) return;
            const speaking = !!event.detail.speaking;
            if (speaking) { clearSilence(s); s.lastSpokenText = audio()?.currentText(s.call) || s.lastSpokenText; }
            else s.lastSpokenAt = Date.now();
            refreshUi(s.call);
        };
        s.onIdle = event => { if (live(s) && event.detail?.callId === s.call.id) armSilence(s); };
        s.onSettled = event => { if (live(s) && event.detail?.callId === s.call.id) setTimeout(() => armSilence(s), 50); };
        s.onUserLine = event => { if (live(s) && event.detail?.callId === s.call.id) { s.nudges = 0; clearSilence(s); } };
        window.addEventListener('bynd:call-speaking', s.onSpeaking);
        window.addEventListener('bynd:call-audio-idle', s.onIdle);
        window.addEventListener('bynd:call-reply-settled', s.onSettled);
        window.addEventListener('bynd:call-user-line', s.onUserLine);
        startNativeOverlay(call);
        if (!engine) {
            setListenUi(s, '没有可用的语音识别，可在 设置 → 语音 配置；也可以打字', 'error');
            armSilence(s);
            return false;
        }
        const ok = s.muted ? true : await startEngine(s);
        if (!ok && live(s)) await switchToFallback(s, '语音识别启动失败');
        refreshUi(call);
        armSilence(s);
        return live(s) && !!s.engine;
    }

    function stop() {
        const s = session;
        if (!s) return;
        session = null;
        clearSilence(s);
        stopEngine(s);
        window.removeEventListener('bynd:call-speaking', s.onSpeaking);
        window.removeEventListener('bynd:call-audio-idle', s.onIdle);
        window.removeEventListener('bynd:call-reply-settled', s.onSettled);
        window.removeEventListener('bynd:call-user-line', s.onUserLine);
        document.getElementById('wc-call-listen')?.classList.add('hidden');
        stopNativeOverlay();
    }

    async function setMuted(call, muted) {
        const s = session;
        if (!s || s.call !== call) return;
        s.muted = !!muted;
        if (s.muted) { stopEngine(s); s.userSpeaking = false; s.hearing = ''; }
        else if (s.engine && !(await startEngine(s))) await switchToFallback(s, '语音识别启动失败');
        refreshUi(call);
    }

    // ---------- Android floating call window (shown only while BYND is in the background) ----------
    function overlayAvatar(char) {
        const src = String(char?.avatar || '');
        if (/^data:image\//.test(src) && src.length < 1500000) return src;
        if (src && !/^(?:https?:|blob:)/.test(src)) return src.replace(/^\.?\//, '');
        return '';
    }
    function startNativeOverlay(call) {
        const bridge = window.ByndAndroid;
        if (!bridge || typeof bridge.callOverlayStart !== 'function') return;
        const char = window.myCharacters?.find(item => item.id === call.charId);
        try {
            bridge.callOverlayStart(JSON.stringify({
                name: typeof getWechatCharDisplayName === 'function' && char ? getWechatCharDisplayName(char) : (char?.name || '通话'),
                kind: call.type === 'videoCall' ? 'video' : 'voice',
                acceptedAt: call.acceptedAt || Date.now(),
                avatar: overlayAvatar(char)
            }));
        } catch (_) {}
    }
    function stopNativeOverlay() {
        try { window.ByndAndroid?.callOverlayStop?.(); } catch (_) {}
    }

    // ---------- Settings (设置 → 语音) ----------
    function renderSettings() {
        const root = document.getElementById('bynd-call-voice-settings');
        if (!root) return;
        const settings = read();
        root.querySelector('#call-voice-enabled').checked = settings.enabled;
        root.querySelector('#call-voice-engine').value = settings.engine;
        root.querySelector('#call-voice-model').value = settings.model;
        root.querySelector('#call-voice-silence').value = String(settings.silenceSeconds);
        const select = root.querySelector('#call-voice-api');
        const apis = typeof getApiData === 'function' ? getApiData().apis.filter(api => api.baseUrl && api.apiKey) : [];
        select.replaceChildren(...[{ id: '', name: '跟随默认聊天接口' }, ...apis].map(api => {
            const option = document.createElement('option');
            option.value = api.id;
            option.textContent = api.name || api.baseUrl || api.id;
            return option;
        }));
        select.value = apis.some(api => api.id === settings.apiId) ? settings.apiId : '';
        const engine = pickEngine(settings);
        const status = root.querySelector('#call-voice-status');
        status.textContent = !settings.enabled ? '已关闭：通话中只用打字。'
            : engine === 'native' ? '本机：使用手机系统语音识别。'
            : engine === 'web' ? '本机：使用浏览器语音识别。'
            : engine === 'api' ? '本机：没有系统识别，改用接口转写（每句话计费一次）。'
            : '本机没有系统语音识别，也还没有可用的转写接口。';
    }

    function saveSettings() {
        const root = document.getElementById('bynd-call-voice-settings');
        if (!root) return;
        const status = root.querySelector('#call-voice-status');
        try {
            write({
                enabled: root.querySelector('#call-voice-enabled').checked,
                engine: root.querySelector('#call-voice-engine').value,
                apiId: root.querySelector('#call-voice-api').value,
                model: root.querySelector('#call-voice-model').value,
                silenceSeconds: root.querySelector('#call-voice-silence').value
            });
            renderSettings();
            status.textContent = `已保存。${status.textContent}`;
        } catch (error) {
            status.textContent = `保存失败：${error.message}`;
        }
    }

    window.ByndCallVoice = {
        read, write, start, stop, setMuted, isListening, wantsLiveVoice, refreshUi, onNative,
        renderSettings, saveSettings, pickEngine, transcribe,
        // exposed for tests
        isEcho, nudgeDelayMs, storageKey: SETTINGS_KEY
    };
})();
