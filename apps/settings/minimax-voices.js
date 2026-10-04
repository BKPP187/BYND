// Official voice catalog: /v1/get_voice reads metadata, never generates audio.
(function () {
    const models = ['speech-2.8-turbo', 'speech-2.8-hd', 'speech-2.6-turbo', 'speech-2.6-hd', 'speech-02-turbo', 'speech-02-hd', 'speech-01-turbo', 'speech-01-hd'];
    // Small offline starter list from the official System Voice ID List. Account access is not verified.
    const starters = [
        ['Gentleman', '温润绅士', 'male'], ['Reliable_Executive', '沉稳高管', 'male'],
        ['Unrestrained_Young_Man', '洒脱青年', 'male'], ['Southern_Young_Man', '南方青年', 'male'],
        ['Warm_Girl', '温暖女孩', 'female'], ['Sweet_Lady', '甜美女声', 'female'],
        ['Mature_Woman', '成熟女声', 'female'], ['News_Anchor', '新闻主播', '']
    ].map(([suffix, name, gender]) => ({ id: `Chinese (Mandarin)_${suffix}`, name, gender, language: 'zh', type: 'system', description: '' }));
    const types = { system: '系统音色', voice_cloning: '我的克隆音色', voice_generation: '我的设计音色' };
    const attr = value => escapeHtml(String(value)).replace(/"/g, '&quot;');
    const scope = api => JSON.stringify([normalizeMiniMaxBaseUrl(api.baseUrl), api.apiKey || '', api.voiceGroupId || '']);
    const previewText = '你好，很高兴认识你。今天过得怎么样？';
    const previewCache = new Map();
    function previewConfig(api, voiceId, model = '') {
        return { ...api, enabled: true, provider: 'minimax', voiceId: String(voiceId || '').trim(), voiceModel: model || api.voiceModel || api.model || 'speech-2.8-turbo' };
    }
    const previewKey = api => JSON.stringify([scope(api), api.voiceEndpoint || '', api.voiceModel, api.voiceId, api.voiceSpeed ?? '1', api.voiceVolume ?? '1', api.voicePitch ?? '0', api.voiceFormat || 'mp3', previewText]);

    function endpoint(api) {
        const root = new URL(normalizeMiniMaxBaseUrl(api.baseUrl));
        if (!/^https?:$/.test(root.protocol) || root.username || root.password) throw new Error('Base URL 必须是 http 或 https 地址');
        root.pathname = root.pathname.replace(/\/+$/, '').replace(/\/(?:v1\/)?t2a_v2$/i, '').replace(/\/v1$/i, '') + '/v1/get_voice';
        root.search = ''; root.hash = '';
        if (api.voiceGroupId) root.searchParams.set('GroupId', api.voiceGroupId);
        return root.href;
    }

    function metadata(voice, type) {
        const id = voice.voice_id.trim(), preset = type === 'system' ? starters.find(item => item.id === id) : null;
        const description = Array.isArray(voice.description) ? voice.description.filter(item => typeof item === 'string').join(' · ') : String(voice.description || '');
        const words = `${voice.voice_name || ''} ${description} ${id.replace(/[_-]/g, ' ')}`;
        const gender = preset?.gender || (/\b(female|woman|women|girl|lady)\b|女声|女性/i.test(words) ? 'female' : /\b(male|man|men|boy|gentleman)\b|男声|男性/i.test(words) ? 'male' : '');
        const language = preset?.language || (/^Chinese \(Mandarin\)_/.test(id) ? 'zh' : /^English_/.test(id) ? 'en' : /^Japanese_/.test(id) ? 'ja' : /^Cantonese_/.test(id) ? 'yue' : /^Korean_/.test(id) ? 'ko' : '');
        return { id, name: preset?.name || String(voice.voice_name || id), description, gender, language, type };
    }

    function errorText(error, api) {
        let message = String(error?.message || '请求失败');
        if (api.apiKey) message = message.split(api.apiKey).join('[已隐藏]');
        if (/Failed to fetch|NetworkError/i.test(message)) message = '无法读取账户音色，请检查网络、对应地区的 Base URL 或代理是否支持音色列表';
        return message.slice(0, 180);
    }

    async function request(api, signal) {
        if (!String(api.apiKey || '').trim()) throw new Error('请先填写 MiniMax API Key');
        const response = await fetch(endpoint(api), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.apiKey}` }, body: JSON.stringify({ voice_type: 'all' }), signal });
        let data;
        try { data = await response.json(); } catch (_) { throw new Error(`音色接口返回了无效数据（HTTP ${response.status}）`); }
        const code = data?.base_resp?.status_code;
        if (!response.ok || (code != null && Number(code) !== 0)) {
            const hint = ({ 401: 'API Key 无效，请核对 Key 与 Base URL 所属地区', 403: '没有读取音色的权限', 429: '请求过于频繁，请稍后重试' })[response.status] || data?.base_resp?.status_msg || '请求失败';
            throw new Error(errorText(new Error(`音色加载失败（HTTP ${response.status}${code != null ? ` · ${code}` : ''}）：${hint}`), api));
        }
        const groups = [['system_voice', 'system'], ['voice_cloning', 'voice_cloning'], ['voice_generation', 'voice_generation']];
        if (!groups.some(([key]) => Array.isArray(data?.[key])) || groups.some(([key]) => data[key] != null && !Array.isArray(data[key]))) throw new Error('音色接口返回了无效列表');
        const seen = new Set();
        return groups.flatMap(([key, type]) => (data[key] || []).filter(voice => voice && typeof voice.voice_id === 'string' && voice.voice_id.trim()).map(voice => metadata(voice, type))).filter(voice => { if (seen.has(voice.id)) return false; seen.add(voice.id); return true; });
    }

    function createPicker({ rootId, modelId, voiceId, config, role = false }) {
        const state = { voices: [], active: false, loaded: false, serial: 0, controller: null, scope: '', previewSerial: 0, preview: null, cache: previewCache };
        const el = suffix => document.getElementById(`${rootId}-${suffix}`);
        const input = id => document.getElementById(id);
        const root = () => document.getElementById(rootId);
        function ensure() {
            if (!root() || el('model')) return;
            root().innerHTML = `<label>语音模型<select id="${rootId}-model" aria-label="选择 MiniMax 语音模型"></select></label>
                <div class="minimax-voice-heading"><strong>${role ? '选择这个角色的声音' : '选择声音'}</strong><button type="button" id="${rootId}-load">加载账户音色</button></div>
                <input type="search" id="${rootId}-search" placeholder="搜索声音名称、描述" aria-label="搜索 MiniMax 音色">
                <div class="minimax-voice-filters"><select id="${rootId}-type" aria-label="MiniMax 音色分类"><option value="">全部音色</option><option value="system">系统音色</option><option value="voice_cloning">我的克隆音色</option><option value="voice_generation">我的设计音色</option></select>
                <select id="${rootId}-gender" aria-label="MiniMax 音色性别"><option value="">全部性别</option><option value="male">男声</option><option value="female">女声</option><option value="unknown">未标注</option></select>
                <select id="${rootId}-language" aria-label="MiniMax 音色语言"><option value="">全部语言</option><option value="zh">中文</option><option value="en">英语</option><option value="ja">日语</option><option value="ko">韩语</option><option value="yue">粤语</option><option value="unknown">未标注</option></select></div>
                <select id="${rootId}-voice" data-minimax-preview="${rootId}" aria-label="选择 MiniMax 音色"></select><div id="${rootId}-selected" class="minimax-voice-selected"></div>
                <button type="button" id="${rootId}-preview-selected">试听当前声音（计费）</button><div id="${rootId}-preview-status" class="minimax-voice-status" role="status" aria-live="polite"></div><div id="${rootId}-status" class="minimax-voice-status" role="status" aria-live="polite"></div>
                <small>试听会生成一段短句，按账户费率计费；本次页面内可重播缓存。加载列表不生成语音。</small>`;
            el('load').onclick = load;
            ['search', 'type', 'gender', 'language'].forEach(key => el(key).addEventListener(key === 'search' ? 'input' : 'change', render));
            el('model').onchange = () => { const value = el('model').value; stopPreview(); input(modelId).value = value; render(); };
            el('preview-selected').onclick = () => preview(input(voiceId).value.trim(), el('preview-selected'));
            el('voice').onchange = () => { const voice = state.voices.find(item => item.id === el('voice').value); if (voice) { stopPreview(); input(voiceId).value = voice.id; input(voiceId).dataset.voiceName = voice.name; render(); } };
            input(modelId).addEventListener('input', () => { stopPreview(); render(); });
            input(voiceId).addEventListener('input', () => { stopPreview(); input(voiceId).dataset.voiceName = ''; render(); });
            if (!role) ['speed', 'volume', 'pitch', 'format', 'endpoint'].forEach(key => input(`api-voice-${key}`)?.addEventListener('input', () => { stopPreview(); previewStatus('参数已改变，下次试听会生成新样音。'); }));
        }
        function render() {
            if (!el('voice')) return;
            const model = input(modelId).value.trim(), selected = input(voiceId).value.trim();
            el('model').innerHTML = (role ? '<option value="">跟随全局 TTS 模型</option>' : '') + (model && !models.includes(model) ? `<option value="${attr(model)}">${escapeHtml(model)}（当前模型）</option>` : '') + models.map(id => `<option value="${attr(id)}">${id} · ${id.endsWith('turbo') ? '快速' : '高清'}</option>`).join('');
            el('model').value = model;
            const query = el('search').value.trim().toLowerCase(), type = el('type').value, gender = el('gender').value, language = el('language').value;
            const visible = state.voices.filter(voice => (!query || `${voice.name} ${voice.id} ${voice.description}`.toLowerCase().includes(query)) && (!type || type === voice.type) && (!gender || (gender === 'unknown' ? !voice.gender : gender === voice.gender)) && (!language || (language === 'unknown' ? !voice.language : language === voice.language)));
            const chosen = state.voices.find(voice => voice.id === selected);
            el('voice').innerHTML = '<option value="" disabled>请选择声音</option>' + (selected && !visible.some(voice => voice.id === selected) ? `<option value="${attr(selected)}">${escapeHtml(chosen?.name || input(voiceId).dataset.voiceName || selected)}（当前已选）</option>` : '') + visible.map(voice => `<option value="${attr(voice.id)}">${escapeHtml(voice.name)} · ${types[voice.type]}${voice.gender ? ` · ${voice.gender === 'male' ? '男声' : '女声'}` : ''}</option>`).join('');
            el('voice').value = selected;
            el('selected').textContent = selected ? `已选：${chosen?.name || input(voiceId).dataset.voiceName || selected}${chosen?.description ? ` · ${chosen.description}` : ''}` : visible.length ? '选择声音后，音色 ID 会自动填写。' : '没有匹配的声音，试试其他筛选。';
            const currentKey = previewKey(previewConfig(config(), selected, model));
            el('preview-selected').disabled = !selected;
            el('preview-selected').textContent = state.preview?.key === currentKey ? (state.preview.audio ? '停止试听' : '生成中… 点击取消') : `试听当前声音${state.cache.has(currentKey) ? '（缓存）' : '（计费）'}`;
            window.ByndElevenLabsOptions?.enhance(root());
        }
        function previewLabel(id) { return state.cache.has(previewKey(previewConfig(config(), id, input(modelId).value.trim()))) ? '试听（缓存）' : '试听（计费）'; }
        function previewStatus(message, error = false, node = null) {
            for (const target of [el('preview-status'), node]) if (target?.isConnected) { target.textContent = message; target.dataset.error = String(error); }
        }
        function stopPreview() {
            state.previewSerial++;
            const current = state.preview; state.preview = null;
            if (current) {
                current.controller?.abort(); clearTimeout(current.timer);
                if (current.audio) { current.audio.onended = null; current.audio.onerror = null; current.audio.pause(); current.audio.removeAttribute('src'); current.audio.load(); }
                if (current.button?.isConnected) { current.button.textContent = previewLabel(current.id); current.button.setAttribute('aria-pressed', 'false'); }
            }
            if (el('preview-selected')) render();
        }
        async function preview(id, button, note = null) {
            const api = previewConfig(config(), id, input(modelId).value.trim());
            if (!id || !String(api.apiKey || '').trim()) { previewStatus('请先填写 MiniMax API Key 并选择音色。', true, note); return; }
            const key = previewKey(api);
            if (state.preview?.key === key) { stopPreview(); previewStatus('已停止试听。', false, note); return; }
            window.ByndMiniMaxVoices?.stopAll();
            window.ByndFishVoices?.stopAll();
            const serial = ++state.previewSerial, controller = new AbortController();
            const current = { key, id, controller, button, audio: null, timer: null };
            state.preview = current;
            const cached = state.cache.get(key);
            button.textContent = cached ? '准备播放…' : '生成中… 点击取消'; button.setAttribute('aria-pressed', 'true');
            previewStatus(cached ? '重播已缓存样音，不重新生成。' : `正在生成试听（计费）：“${previewText}”`, false, note);
            let timedOut = false;
            try {
                current.timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
                const result = cached || await requestMiniMaxVoiceAudio(previewText, api, { signal: controller.signal });
                clearTimeout(current.timer);
                if (serial !== state.previewSerial || !state.active) return;
                if (key !== previewKey(previewConfig(config(), id, input(modelId).value.trim()))) { stopPreview(); previewStatus('参数已改变，请重新试听。', false, note); return; }
                if (!result?.audioUrl) throw new Error('试听接口没有返回音频');
                state.cache.set(key, { audioUrl: result.audioUrl });
                if (state.cache.size > 12) state.cache.delete(state.cache.keys().next().value);
                const audio = new Audio(result.audioUrl); current.audio = audio;
                audio.onended = () => { if (state.preview !== current) return; stopPreview(); previewStatus('试听结束；可重播缓存。', false, note); };
                audio.onerror = () => { if (state.preview !== current) return; state.cache.delete(key); stopPreview(); previewStatus('样音播放失败，请检查网络或音频格式后重试。', true, note); };
                await audio.play();
                if (serial !== state.previewSerial) return;
                button.textContent = '停止试听';
                previewStatus(cached ? '正在播放缓存，不重新生成。' : '正在播放；再次试听可复用本次缓存。', false, note);
                render();
            } catch (error) {
                if (serial !== state.previewSerial) return;
                stopPreview();
                previewStatus(error.name === 'NotAllowedError' ? '样音已缓存，请再点一次试听播放，不会重新生成。' : `试听失败：${timedOut ? '生成超时，请重试' : errorText(error, api)}`, true, note);
            } finally { clearTimeout(current.timer); }
        }
        function status(message, error = false) { el('status').textContent = message; el('status').dataset.error = String(error); }
        function close() { stopPreview(); state.active = false; state.serial++; state.controller?.abort(); state.controller = null; window.ByndElevenLabsOptions?.closeMenu(); }
        function invalidate() {
            if (!root()) return;
            close(); const account = scope(config());
            if (account !== state.scope) for (const key of state.cache.keys()) if (JSON.parse(key)[0] === state.scope) state.cache.delete(key);
            state.voices = starters.slice(); state.loaded = false; state.scope = account; ensure(); render();
            previewStatus('');
            status('官方常用中文系统音色（未核验账户）；加载后可选账户返回的完整列表。'); el('load').disabled = false;
        }
        async function load() {
            if (!state.active) return;
            const api = config(), account = scope(api);
            if (account !== state.scope) { state.voices = starters.slice(); state.loaded = false; state.scope = account; }
            state.controller?.abort(); const serial = ++state.serial, controller = new AbortController(); state.controller = controller;
            const timer = setTimeout(() => controller.abort(), 15000);
            el('load').disabled = true; status('正在读取账户音色…'); render();
            try {
                const voices = await request(api, controller.signal);
                if (serial !== state.serial || !state.active || account !== scope(config())) return;
                state.voices = voices; state.loaded = true; status(`账户返回 ${voices.length} 个音色；生成权限与余额以实际请求为准。`); render();
            } catch (error) {
                if (serial === state.serial && state.active && account === scope(config())) status(`${error.name === 'AbortError' ? '音色读取超时，请重试' : errorText(error, api)}。${state.loaded ? '已保留上次列表与选择。' : '仍可选官方常用系统音色，账户权限未核验。'}`, true);
            } finally { clearTimeout(timer); if (serial === state.serial) { el('load').disabled = false; state.controller = null; } }
        }
        function open() { invalidate(); state.active = true; ['search', 'type', 'gender', 'language'].forEach(key => el(key).value = ''); render(); if (config().apiKey) load(); }
        function refresh() { const active = state.active; invalidate(); state.active = active; }
        return { open, close, load, invalidate, refresh, preview, previewLabel, stopPreview };
    }
    const settings = createPicker({ rootId: 'api-minimax-picker', modelId: 'api-voice-model', voiceId: 'api-voice-id', config: () => getApiVoiceConfigFromModal() });
    const character = createPicker({ rootId: 'wcs-minimax-picker', modelId: 'wcs-char-voice-model', voiceId: 'wcs-char-voice-id', config: () => getVoiceApiByProvider('minimax') || {}, role: true });
    window.ByndMiniMaxVoices = { ...settings, character, request, endpoint, starters, models, previewConfig, previewKey,
        stopAll() { settings.stopPreview(); character.stopPreview(); },
        forPicker(id) { return id === 'api-minimax-picker' ? settings : id === 'wcs-minimax-picker' ? character : null; }
    };
})();
