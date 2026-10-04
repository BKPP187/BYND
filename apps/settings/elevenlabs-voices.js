// ElevenLabs /v2/voices: browse account voices without generating paid test speech.
(function () {
    const attribute = value => escapeHtml(value).replace(/"/g, '&quot;');
    const categoryNames = { premade: '内置', cloned: '克隆', generated: '设计', professional: '专业克隆', high_quality: '高品质' };
    const languageNames = { zh: '中文', en: '英语', ja: '日语', ko: '韩语', fr: '法语', de: '德语', es: '西班牙语', pt: '葡萄牙语', it: '意大利语', ru: '俄语', ar: '阿拉伯语', hi: '印地语' };

    function endpoint(api, options = {}) {
        const root = normalizeElevenLabsBaseUrl(api.baseUrl).replace(/\/v[12]$/i, '');
        const url = new URL(`${root}/v2/voices`);
        if (!/^https?:$/.test(url.protocol)) throw new Error('Base URL 必须是 http 或 https 地址');
        url.searchParams.set('page_size', '20');
        url.searchParams.set('include_total_count', 'false');
        if (options.search) url.searchParams.set('search', options.search);
        if (options.type) url.searchParams.set('voice_type', options.type);
        if (options.gender) url.searchParams.set('gender', options.gender);
        if (options.language) url.searchParams.set('language', options.language);
        if (options.token) url.searchParams.set('next_page_token', options.token);
        return url.href;
    }

    function safePreviewUrl(value) {
        try {
            const url = new URL(value);
            return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
        } catch (_) { return ''; }
    }

    function errorText(error, api) {
        const key = String(api.apiKey || '');
        let text = String(error?.message || error || '请求失败');
        if (key) text = text.split(key).join('[已隐藏]');
        if (/Failed to fetch|NetworkError/i.test(text)) return '无法连接音色接口，请检查网络、Base URL 或代理是否支持音色列表。';
        return text.slice(0, 180);
    }

    function previewUrl(voice, language) {
        const verified = Array.isArray(voice.verified_languages) ? voice.verified_languages : [];
        const matching = language ? verified.find(item => item?.language === language && safePreviewUrl(item.preview_url)) : null;
        return safePreviewUrl(matching?.preview_url) || safePreviewUrl(voice.preview_url) || safePreviewUrl(verified.find(item => item?.preview_url)?.preview_url);
    }

    function labelText(key, value) {
        if (key === 'gender') return ({ male: '男声', female: '女声' })[value] || value;
        if (key === 'language') return languageNames[value] || value;
        return value;
    }

    function access(voice, type = '') {
        const tiers = Array.isArray(voice.available_for_tiers) ? [...new Set(voice.available_for_tiers.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim().toLowerCase()))] : [];
        const free = voice.sharing?.free_users_allowed;
        // Sharing eligibility is not API eligibility: the Voice Library requires a paid API plan.
        // Do not classify an owner's private professional clone as a library copy.
        const professional = voice.category === 'professional' || voice.sharing?.category === 'professional';
        const library = voice.category !== 'premade' && (type === 'community' || (voice.is_owner !== true && !!voice.sharing &&
            (voice.sharing.enabled_in_library === true || (professional && (voice.is_owner === false || !!voice.sharing.original_voice_id)))));
        const paid = library || free === false || (tiers.length > 0 && !tiers.includes('free'));
        const freeAllowed = !paid && !professional && (free === true || tiers.includes('free'));
        return { paid, freeAllowed, tiers, library, premade: voice.category === 'premade' };
    }

    function accessLabel(voice, tier = '') {
        const permission = voice.access;
        if (permission.library) return tier === 'free' ? '社区音色 · API 需付费 · 当前 Free 不可用' : '社区音色 · API 需付费套餐';
        if (permission.paid) return tier === 'free' ? '需付费套餐 · 当前 Free 不可用' : '需付费套餐';
        if (permission.premade) return '内置音色 · 生成扣积分';
        if (permission.freeAllowed) return 'Free 套餐可选 · 生成扣积分';
        return 'API 套餐权限待确认';
    }

    const accountScope = api => JSON.stringify([normalizeElevenLabsBaseUrl(api.baseUrl).replace(/\/v[12]$/i, ''), api.apiKey || '']);

    async function request(api, options = {}) {
        if (!String(api.apiKey || '').trim()) throw new Error('请先填写 ElevenLabs API Key');
        const controller = new AbortController();
        const abort = () => controller.abort();
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted) abort();
        let timedOut = false;
        const timeout = setTimeout(() => { timedOut = true; abort(); }, 20000);
        try {
            const response = await fetch(endpoint(api, options), {
                method: 'GET', headers: { 'Accept': 'application/json', 'xi-api-key': api.apiKey }, signal: controller.signal
            });
            let data;
            try { data = await response.json(); } catch (_) {
                throw new Error(response.ok ? '音色接口返回了无效数据' : `音色加载失败（HTTP ${response.status}）`);
            }
            if (!response.ok) {
                const tips = { 401: 'API Key 无效或已过期', 403: '没有读取音色的权限，请检查 API Key 的 Voices 读取权限', 404: '当前 Base URL 不支持音色列表接口', 429: '请求过于频繁，请稍后重试' };
                const detail = tips[response.status] || data?.detail?.message || data?.message || '请稍后重试';
                throw new Error(`音色加载失败（HTTP ${response.status}）：${detail}`);
            }
            if (!Array.isArray(data?.voices) || (data.has_more && !data.next_page_token)) throw new Error('音色接口返回了无效的列表或分页信息');
            return {
                voices: data.voices.filter(voice => voice && typeof voice.voice_id === 'string' && voice.voice_id.trim()).map(voice => ({
                    id: voice.voice_id, name: String(voice.name || '未命名音色'), description: String(voice.description || ''),
                    category: categoryNames[voice.category] || String(voice.category || ''),
                    access: access(voice, options.type),
                    labels: voice.labels && typeof voice.labels === 'object' ? Object.entries(voice.labels).filter(([, value]) => typeof value === 'string').slice(0, 4).map(([key, value]) => labelText(key, value)) : [],
                    preview: previewUrl(voice, options.language)
                })),
                token: data.has_more ? String(data.next_page_token) : ''
            };
        } catch (error) {
            if (timedOut) throw new Error('音色加载超时，请重试');
            throw error;
        } finally {
            clearTimeout(timeout);
            options.signal?.removeEventListener('abort', abort);
        }
    }

    function createPicker({ prefix, inputId, config, actions }) {
        const state = { voices: [], token: '', scope: '', serial: 0, controller: null, timer: null, audio: null, playing: '', busy: false, tier: '', tierScope: '' };
        const el = name => document.getElementById(`${prefix}${name}`);
        const input = () => document.getElementById(inputId);

        function status(text, error = false) {
            const node = el('voices-status');
            if (node) { node.textContent = text; node.dataset.error = String(error); }
        }

        function stop() {
            const audio = state.audio;
            state.audio = null;
            state.playing = '';
            if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); }
        }

        function cancel() {
            state.serial++;
            state.controller?.abort();
            state.controller = null;
            clearTimeout(state.timer);
            state.busy = false;
            stop();
        }

        function render() {
            const list = el('voices-list');
            const id = input()?.value.trim() || '';
            const name = input()?.dataset.voiceName || '';
            const tier = state.tierScope === accountScope(config()) ? state.tier : '';
            const selectedVoice = state.voices.find(voice => voice.id === id);
            if (el('voices-selected')) el('voices-selected').textContent = id ? `已选：${selectedVoice?.name || name || id} · ${selectedVoice ? accessLabel(selectedVoice, tier) : 'API 套餐权限待确认'}` : '尚未选择音色';
            const selectEl = el('voices-select');
            if (selectEl) {
                selectEl.innerHTML = '<option value="" disabled>请选择音色</option>'
                    + (id && !state.voices.some(voice => voice.id === id) ? `<option value="${attribute(id)}">${escapeHtml(name || id)}（当前已选）</option>` : '')
                    + state.voices.map(voice => `<option value="${attribute(voice.id)}">${escapeHtml(voice.name)} · ${escapeHtml(accessLabel(voice, tier))}</option>`).join('');
                selectEl.value = id;
                selectEl.disabled = !state.voices.length;
            }
            window.ByndElevenLabsOptions?.enhance(prefix === 'api-elevenlabs-' ? document.getElementById('api-elevenlabs-voice-modal') : document.getElementById('wcs-elevenlabs-picker'));
            if (list) list.innerHTML = state.voices.map((voice, index) => {
                const selected = voice.id === id;
                const playing = voice.id === state.playing;
                return `<article class="elevenlabs-voice-item${selected ? ' is-selected' : ''}">
                    <div class="elevenlabs-voice-info"><strong>${escapeHtml(voice.name)}</strong>
                    <span class="elevenlabs-voice-access${voice.access.paid ? ' is-paid' : ''}">${escapeHtml(accessLabel(voice, tier))}</span>
                    ${!voice.access.library && voice.access.tiers.length ? `<span>可用套餐：${escapeHtml(voice.access.tiers.join(' / '))}</span>` : ''}
                    <span>${escapeHtml([voice.category, ...voice.labels].filter(Boolean).join(' · '))}</span>
                    ${voice.description ? `<p>${escapeHtml(voice.description)}</p>` : ''}</div>
                    <div class="elevenlabs-voice-actions"><button type="button" onclick="${actions}.preview(${index})" ${voice.preview ? '' : 'disabled'} aria-label="${attribute(`${playing ? '停止试听' : voice.preview ? '试听' : '无试听'} ${voice.name}`)}">${playing ? '停止' : voice.preview ? '试听' : '无试听'}</button>
                    <button type="button" onclick="${actions}.select(${index})" aria-pressed="${selected}">${selected ? '已选' : '选用'}</button></div>
                </article>`;
            }).join('');
            const more = el('voices-more');
            if (more) { more.hidden = !state.token; more.disabled = state.busy; }
            const load = el('voices-load');
            if (load) { load.disabled = state.busy; load.textContent = state.busy ? '加载中…' : '加载音色'; }
            if (list && !el('voices-cost-note')) {
                const note = document.createElement('p'); note.id = `${prefix}voices-cost-note`; note.className = 'elevenlabs-voices-status';
                note.textContent = '社区音色通过 API 生成需付费套餐。Free 用户可先选内置音色；不同角色可以选不同声音。试听样音不代表生成权限，生成仍扣积分。';
                list.before(note);
            }
        }

        function invalidate() {
            window.ByndElevenLabsOptions?.invalidate(prefix);
            cancel();
            state.voices = []; state.token = ''; state.scope = '';
            status(config().apiKey ? '点击“加载音色”查看当前账号的声音' : prefix === 'api-elevenlabs-' ? '填写 API Key 后加载音色' : '请先在设置 → TTS 配置 ElevenLabs，再回来加载音色');
            render();
        }

        async function load(more = false) {
            clearTimeout(state.timer);
            const api = config();
            const search = el('voices-search')?.value.trim() || '';
            const type = el('voices-type')?.value || '';
            const gender = el('voices-gender')?.value || '';
            const language = el('voices-language')?.value || '';
            const scope = JSON.stringify([api.baseUrl, api.apiKey, search, type, gender, language]);
            if (more && (state.busy || !state.token || scope !== state.scope)) return;
            const token = more ? state.token : '';
            cancel();
            const serial = state.serial;
            state.scope = scope;
            if (!more) { state.voices = []; state.token = ''; }
            state.busy = true;
            state.controller = new AbortController();
            status('正在加载音色…'); render();
            try {
                if (!api.apiKey && prefix !== 'api-elevenlabs-') throw new Error('请先在设置 → TTS 配置 ElevenLabs，再回来加载音色');
                const page = await request(api, { search, type, gender, language, token, signal: state.controller.signal });
                if (serial !== state.serial) return;
                const seen = new Set(state.voices.map(voice => voice.id));
                state.voices.push(...page.voices.filter(voice => { if (seen.has(voice.id)) return false; seen.add(voice.id); return true; }));
                state.token = page.token;
                if (more && page.token === token) { state.token = ''; throw new Error('音色接口重复返回同一页，请重新加载'); }
                status(state.voices.length ? `已加载 ${state.voices.length} 个音色${state.token ? '，可继续加载' : ''}` : '没有找到音色，试试其他关键词或分类');
            } catch (error) {
                if (serial === state.serial) status(errorText(error, api), true);
            } finally {
                if (serial === state.serial) { state.busy = false; state.controller = null; render(); }
            }
        }

        function search() {
            invalidate();
            state.timer = setTimeout(() => load(), 350);
        }

        function select(index) {
            const voice = state.voices[index];
            const field = input();
            if (!voice || !field) return;
            field.value = voice.id;
            field.dataset.voiceName = voice.name;
            render();
        }

        function choose(id) {
            const index = state.voices.findIndex(voice => voice.id === id);
            if (index >= 0) select(index);
        }

        async function preview(index) {
            const voice = state.voices[index];
            if (!voice?.preview) return;
            const wasPlaying = state.playing === voice.id;
            stop();
            if (wasPlaying) { render(); return; }
            const audio = new Audio(voice.preview);
            state.audio = audio; state.playing = voice.id;
            const failed = () => {
                if (state.audio !== audio) return;
                stop(); status('试听播放失败，请检查网络后重试', true); render();
            };
            audio.onended = () => { if (state.audio === audio) { stop(); render(); } };
            audio.onerror = failed;
            render();
            try { await audio.play(); } catch (_) { failed(); }
        }

        function manual() {
            if (input()) input().dataset.voiceName = '';
            render();
        }

        function open() {
            if (el('voices-search')) el('voices-search').value = '';
            if (el('voices-type')) el('voices-type').value = '';
            if (el('voices-gender')) el('voices-gender').value = '';
            if (el('voices-language')) el('voices-language').value = '';
            invalidate();
            window.ByndElevenLabsOptions?.open(prefix, prefix === 'api-elevenlabs-' ? 'api-elevenlabs-voice-model' : 'wcs-char-voice-model', config);
            if (config().apiKey) load();
        }

        function setTier(api, tier) {
            if (accountScope(api) !== accountScope(config())) return;
            state.tier = String(tier || '').toLowerCase(); state.tierScope = accountScope(api); render();
        }
        return { open, close() { cancel(); window.ByndElevenLabsOptions?.close(prefix); }, load, search, select, choose, preview, manual, invalidate, setTier };
    }

    const settings = createPicker({ prefix: 'api-elevenlabs-', inputId: 'api-elevenlabs-voice-id', config: () => getApiElevenLabsVoiceConfigFromModal(), actions: 'ByndElevenLabsVoices' });
    const character = createPicker({ prefix: 'wcs-elevenlabs-', inputId: 'wcs-char-voice-id', config: () => getVoiceApiByProvider('elevenlabs') || {}, actions: 'ByndElevenLabsVoices.character' });
    window.ByndElevenLabsVoices = { ...settings, character, request, endpoint, access,
        notifyTier(api, tier) { settings.setTier(api, tier); character.setTier(api, tier); }
    };
})();
