// Call sounds stay in memory; records contain neither audio nor credentials.
(function () {
    const states = new WeakMap();
    let active = null;
    const live = call => call && !call.ended && call.acceptedAt && window._wechatActiveCall === call;
    function apiForChar(char) {
        if (typeof getCharacterVoiceBinding === 'function' && getCharacterVoiceBinding(char)) {
            if (!isCharacterVoiceConfigured(char)) throw new Error('这个角色的 TTS 未启用或配置不完整，请检查角色声音与对应服务');
            return getCharacterVoiceApi(char);
        }
        return typeof getDefaultVoiceApi === 'function' ? getDefaultVoiceApi() : null;
    }
    function isEnabled(call) {
        if (call?.videoProvider === 'vivix') return false;
        const char = window.myCharacters?.find(candidate => candidate.id === call?.charId);
        try { return !!char && !!apiForChar(char); } catch (_) { return false; }
    }
    function setSpeaking(state, speaking) {
        const changed = state.speaking !== speaking;
        state.speaking = speaking;
        if (!speaking) state.currentText = '';
        // Live voice listens for this to time barge-in and silence.
        if (changed) try { window.dispatchEvent(new CustomEvent('bynd:call-speaking', { detail: { callId: state.call?.id, speaking } })); } catch (_) {}
        if (window._wechatActiveCall !== state.call || typeof setWechatCallTyping !== 'function') return;
        const pending = document.getElementById('wc-call-typing')?.dataset.replyPending === 'true';
        setWechatCallTyping(pending && !state.call.ended);
    }
    function prepare(call) {
        if (!call || call.ended) return null;
        if (active && active.call !== call) stop(active.call);
        let state = states.get(call);
        if (!state) {
            state = { call, audio: new Audio(), tail: Promise.resolve(), stopped: false, speaking: false, controller: null, finish: null, jobs: new WeakMap(), generation: 0, currentText: '', queued: 0 };
            states.set(call, state);
        }
        active = state;
        return state;
    }
    // Reuse the element primed in the call/accept gesture for mobile autoplay.
    function unlock(call) {
        const state = prepare(call);
        if (!state || state.stopped || state.controller || state.finish) return;
        state.audio.src = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQIAAAAAAA==';
        try { Promise.resolve(state.audio.play()).catch(() => {}); } catch (_) {}
    }
    function notice(job, message, label = '') {
        if (!job.item?.isConnected) return;
        if (!job.notice) { job.notice = document.createElement('div'); job.notice.className = 'wc-call-voice-status'; job.item.append(job.notice); }
        job.notice.textContent = message;
        if (label) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'wc-call-voice-action'; button.textContent = label;
            button.onclick = () => { if (!job.pending && live(job.call)) schedule(job); };
            job.notice.append(button);
        }
    }
    function reason(error, api) {
        let value = String(error?.message || '语音请求失败');
        if (api?.apiKey) value = value.split(api.apiKey).join('[已隐藏]');
        if (/Failed to fetch|NetworkError/i.test(value)) value = '无法连接语音服务，请检查网络和接口地址';
        return value.slice(0, 200);
    }
    function play(state, job) {
        const audio = state.audio;
        return new Promise((resolve, reject) => {
            let settled = false, timer;
            const finish = error => {
                if (settled) return;
                settled = true; clearTimeout(timer); audio.onended = null; audio.onerror = null; state.finish = null;
                setSpeaking(state, false);
                if (error) { audio.pause(); reject(error); } else resolve();
            };
            state.finish = () => { audio.pause(); finish(); };
            audio.onended = () => finish();
            audio.onerror = () => { job.audioUrl = ''; finish(new Error('音频播放失败，请检查网络或音频格式')); };
            audio.src = job.audioUrl; audio.volume = 1;
            timer = setTimeout(() => finish(new Error('语音播放超时，请重试')), Math.min(600000, Math.max(60000, (Number(job.duration) || 30) * 1000 + 30000)));
            try {
                Promise.resolve(audio.play()).then(() => {
                    if (!live(job.call) || state.stopped) { state.finish?.(); return; }
                    if (!settled) { state.currentText = job.text; setSpeaking(state, true); job.item?.setAttribute('data-voice-state', 'playing'); notice(job, '正在说话…'); }
                }, finish);
            } catch (error) { finish(error); }
        });
    }
    const stale = (state, job) => !live(job.call) || state.stopped || job.generation !== state.generation;
    async function run(state, job) {
        if (stale(state, job)) { job.pending = false; if (job.generation !== state.generation) { job.item?.setAttribute('data-voice-state', 'interrupted'); job.notice?.remove(); } return; }
        try {
            if (job.configurationError) throw job.configurationError;
            if (!job.audioUrl) {
                notice(job, '正在生成声音…'); job.item?.setAttribute('data-voice-state', 'pending');
                const controller = new AbortController(); state.controller = controller;
                const timer = setTimeout(() => controller.abort(), 30000);
                let result;
                try { result = await requestVoiceAudioWithConfig(job.text, job.api, job.char, { signal: controller.signal }); }
                finally { clearTimeout(timer); if (state.controller === controller) state.controller = null; }
                if (stale(state, job)) return;
                if (!result?.audioUrl) throw new Error('语音服务没有返回音频');
                job.audioUrl = result.audioUrl; job.duration = result.duration;
            }
            if (stale(state, job)) return;
            await play(state, job);
            if (stale(state, job)) return;
            job.item?.setAttribute('data-voice-state', 'played'); job.notice?.remove(); job.notice = null;
        } catch (error) {
            if (stale(state, job)) return;
            job.item?.setAttribute('data-voice-state', 'failed');
            notice(job, error.name === 'NotAllowedError' ? '浏览器需要点击才能播放，声音已生成。' : `声音播放失败：${error.name === 'AbortError' ? '生成超时，请重试' : reason(error, job.api)}`, job.configurationError ? '' : job.audioUrl ? '点击播放声音' : '重试生成声音（计费）');
        } finally { job.pending = false; }
    }
    function schedule(job) {
        const state = states.get(job.call);
        if (!state || state.stopped || job.pending || !live(job.call)) return Promise.resolve();
        job.pending = true; job.item?.setAttribute('data-voice-state', 'queued'); notice(job, '等待声音…');
        state.queued += 1;
        state.tail = state.tail.then(() => run(state, job)).finally(() => {
            if (job.generation === state.generation) state.queued = Math.max(0, state.queued - 1);
            if (!state.queued && !state.speaking) try { window.dispatchEvent(new CustomEvent('bynd:call-audio-idle', { detail: { callId: state.call?.id } })); } catch (_) {}
        });
        return state.tail;
    }
    function enqueue(call, text, item) {
        if (call?.videoProvider === 'vivix') return Promise.resolve();
        if (!live(call) || !String(text || '').trim()) return Promise.resolve();
        const state = prepare(call); if (!state || state.stopped) return Promise.resolve();
        if (item && state.jobs.has(item)) return state.jobs.get(item).promise;
        const char = window.myCharacters?.find(candidate => candidate.id === call.charId);
        if (!char) return Promise.resolve();
        let api = null, configurationError = null;
        try { api = apiForChar(char); } catch (error) { configurationError = error; }
        if (!api && !configurationError) return Promise.resolve();
        const job = { call, char, api: api ? { ...api } : null, text: String(text).trim(), item, configurationError, audioUrl: '', pending: false, notice: null, generation: state.generation };
        job.promise = schedule(job); if (item) state.jobs.set(item, job);
        return job.promise;
    }
    function stop(call) {
        const state = states.get(call); if (!state) return;
        state.stopped = true; state.controller?.abort(); state.controller = null;
        setSpeaking(state, false);
        state.finish?.(); state.audio.pause(); state.audio.removeAttribute('src'); state.audio.load();
        if (active === state) active = null;
    }
    // Barge-in: cut the current sentence and drop queued ones, but keep the call's audio usable.
    function interrupt(call) {
        const state = states.get(call); if (!state || state.stopped) return false;
        const wasActive = state.speaking || !!state.controller;
        state.generation += 1;
        state.controller?.abort(); state.controller = null;
        state.finish?.();
        setSpeaking(state, false);
        state.tail = Promise.resolve();
        state.queued = 0;
        return wasActive;
    }
    window.ByndWechatCallAudio = { prepare, unlock, enqueue, stop, interrupt, apiForChar, isEnabled,
        isSpeaking: call => !!call && !!live(call) && !!states.get(call)?.speaking,
        currentText: call => (call && states.get(call)?.currentText) || '',
        isBusy: call => { const state = call && states.get(call); return !!state && !state.stopped && (state.speaking || !!state.controller || state.queued > 0); },
        drain: call => states.get(call)?.tail || Promise.resolve() };
})();

// Incoming calls use a local ringtone, independently of paid speech providers.
(function () {
    let context, pending = null, timer = null, lastPulse = -Infinity;
    const nodes = new Set();
    const waiting = call => call && !call.ended && !call.acceptedAt && window._wechatIncomingCall === call;
    function pulse() {
        if (!waiting(pending)) { stop(); return; }
        if (!context || context.state !== 'running' || context.currentTime - lastPulse < 1) return;
        lastPulse = context.currentTime;
        for (const offset of [0, 0.45]) for (const frequency of [440, 480]) {
            const oscillator = context.createOscillator(), gain = context.createGain();
            const node = { oscillator, gain }; nodes.add(node);
            oscillator.type = 'sine'; oscillator.frequency.value = frequency;
            const start = context.currentTime + offset;
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.055, start + 0.025);
            gain.gain.setValueAtTime(0.055, start + 0.25);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
            oscillator.connect(gain); gain.connect(context.destination);
            oscillator.onended = () => { nodes.delete(node); oscillator.disconnect(); gain.disconnect(); };
            oscillator.start(start); oscillator.stop(start + 0.34);
        }
    }
    function unlock() {
        try {
            const Context = window.AudioContext || window.webkitAudioContext;
            if (!Context) return;
            if (!context || context.state === 'closed') context = new Context();
            if (context.state === 'suspended') {
                context.resume().then(() => { if (waiting(pending)) pulse(); }).catch(() => {});
            } else if (waiting(pending)) pulse();
        } catch (_) { /* A later user gesture retries mobile audio permission. */ }
    }
    function start(call) {
        if (!waiting(call)) return;
        stop(); pending = call; lastPulse = -Infinity;
        unlock(); timer = setInterval(() => { try { pulse(); } catch (_) { stop(); } }, 2400);
    }
    function stop(call) {
        if (call && pending !== call) return;
        clearInterval(timer); timer = null; pending = null;
        for (const { oscillator, gain } of nodes) {
            try { gain.gain.cancelScheduledValues(context.currentTime); gain.gain.setValueAtTime(0, context.currentTime); oscillator.stop(); } catch (_) {}
            oscillator.disconnect(); gain.disconnect();
        }
        nodes.clear();
    }
    // Prime in a real gesture before the asynchronous role response arrives.
    document.addEventListener?.('pointerdown', unlock, { capture: true, passive: true });
    document.addEventListener?.('keydown', unlock, { capture: true });
    window.ByndWechatCallRingtone = { start, stop, unlock,
        isRinging: call => pending === call && waiting(call),
        isAudible: call => pending === call && waiting(call) && context?.state === 'running' && nodes.size > 0 };
})();
