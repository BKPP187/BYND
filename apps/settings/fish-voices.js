// Fish's /model catalog contains voice references, separate from the TTS engine model.
(function () {
    const esc = value => escapeHtml(String(value));
    const attr = value => esc(value).replace(/"/g, '&quot;');
    const base = value => String(value || 'https://api.fish.audio/compat/v1').trim().replace(/\/+$/, '');
    const scope = api => JSON.stringify([base(api.baseUrl), api.apiKey || '']);
    const previewText = '你好，很高兴认识你。今天过得怎么样？';
    const cache = new Map();
    function endpoint(api, { query = '', source = '', language = '', page = 1 } = {}) {
        const url = new URL(base(api.baseUrl));
        if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error('Base URL 必须是 http 或 https 地址');
        url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/audio\/speech$/i, '').replace(/\/compat\/v1$/i, '').replace(/\/v1$/i, '') + '/model';
        url.search = ''; url.hash = '';
        url.searchParams.set('page_size', '20'); url.searchParams.set('page_number', String(page));
        url.searchParams.set('sort_by', 'score');
        if (query.trim()) url.searchParams.set('title', query.trim());
        if (source === 'mine') url.searchParams.set('self', 'true');
        if (language) url.searchParams.set('language', language);
        return url.href;
    }
    function sampleUrl(value) {
        try { const url = new URL(value); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : ''; } catch (_) { return ''; }
    }
    function errorText(error, api) {
        let message = String(error?.message || '请求失败');
        if (api.apiKey) message = message.split(api.apiKey).join('[已隐藏]');
        if (/Failed to fetch|NetworkError/i.test(message)) message = '无法连接，请检查网络、Base URL，以及代理是否支持 Fish 音色列表';
        return message.slice(0, 180);
    }
    async function request(api, filters, signal) {
        if (!String(api.apiKey || '').trim()) throw new Error('请先填写 Fish Audio API Key');
        const response = await fetch(endpoint(api, filters), { headers: { Accept: 'application/json', Authorization: `Bearer ${api.apiKey}` }, signal });
        let data;
        try { data = await response.json(); } catch (_) { throw new Error(`音色接口返回了无效数据（HTTP ${response.status}）`); }
        if (!response.ok || data?.error || data?.message) throw new Error(errorText(new Error(`音色加载失败（HTTP ${response.status}）：${data?.message || data?.error?.message || '请检查连接与读取权限'}`), api));
        if (!Array.isArray(data?.items) || !Number.isFinite(data.total) || data.total < 0) throw new Error('音色接口返回了无效列表');
        const seen = new Set();
        const voices = data.items.filter(item => item && typeof item._id === 'string' && item._id.trim() && !item.dmca_taken_down && (!item.state || item.state === 'trained')).map(item => ({
            id: item._id.trim(), name: String(item.title || item._id), description: String(item.description || ''),
            tags: Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string') : [],
            languages: Array.isArray(item.languages) ? item.languages.filter(lang => typeof lang === 'string') : [],
            sample: (Array.isArray(item.samples) ? item.samples : []).map(sample => sampleUrl(sample?.audio)).find(Boolean) || ''
        })).filter(voice => { if (seen.has(voice.id)) return false; seen.add(voice.id); return true; });
        return { voices, more: typeof data.has_more === 'boolean' ? data.has_more : data.items.length === 20 && filters.page * 20 < data.total, total: data.total };
    }
    function createPicker({ rootId, voiceId, modelId, config, role = false }) {
        const state = { active: false, voices: [], page: 0, more: false, serial: 0, controller: null, timer: null, scope: '', filter: '', previewSerial: 0, preview: null };
        const root = () => document.getElementById(rootId), el = suffix => document.getElementById(`${rootId}-${suffix}`), input = id => document.getElementById(id);
        const filters = () => ({ query: el('search').value, source: el('source').value, language: el('language').value });
        const signature = api => JSON.stringify([scope(api), api.voiceModel, api.voiceId, api.voiceEndpoint || '', api.voiceFormat || 'mp3', api.voiceSpeed ?? '1']);
        const previewConfig = id => ({ ...config(), enabled: true, provider: 'fish-audio', voiceId: id, voiceModel: input(modelId).value.trim() || config().voiceModel || 'fish-audio/s2.1-pro-free' });
        function ensure() {
            if (!root() || el('search')) return;
            root().innerHTML = `<div class="fish-voice-heading"><strong>${role ? '选择这个角色的声音' : '选择声音'}</strong><button type="button" id="${rootId}-load">加载音色</button></div>
                <input type="search" id="${rootId}-search" placeholder="搜索 Fish Audio 声音名称" aria-label="搜索 Fish Audio 音色">
                <div class="fish-voice-filters"><select id="${rootId}-source" aria-label="Fish 音色来源"><option value="">公开音色</option><option value="mine">我的音色</option></select><select id="${rootId}-language" aria-label="Fish 音色语言"><option value="">全部语言</option><option value="zh">中文</option><option value="en">英语</option><option value="ja">日语</option><option value="ko">韩语</option></select></div>
                <div id="${rootId}-selected" class="fish-voice-selected"></div><button type="button" id="${rootId}-default">${role ? '使用全局声音' : '使用接口默认声音'}</button>
                <div id="${rootId}-status" class="fish-voice-status" role="status" aria-live="polite"></div><div id="${rootId}-preview-status" class="fish-voice-status" role="status" aria-live="polite"></div>
                <small>样音试听不生成新语音；“试听（计费）”、聊天与测试会消耗账户额度。</small>
                <div id="${rootId}-list" class="fish-voice-list"></div><button type="button" id="${rootId}-more" hidden>加载更多</button>`;
            el('load').onclick = () => load(); el('more').onclick = () => load(true);
            el('search').oninput = () => { cancelList(); clearTimeout(state.timer); state.timer = setTimeout(() => load(), 350); };
            el('search').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); clearTimeout(state.timer); load(); } };
            ['source', 'language'].forEach(key => el(key).onchange = () => { clearTimeout(state.timer); load(); });
            el('default').onclick = () => { stopPreview(); input(voiceId).value = ''; input(voiceId).dataset.voiceName = ''; render(); };
            input(voiceId).addEventListener('input', () => { stopPreview(); input(voiceId).dataset.voiceName = ''; render(); });
            input(modelId).addEventListener('input', stopPreview);
            if (!role) ['endpoint', 'speed', 'format'].forEach(key => input(`api-fish-voice-${key}`)?.addEventListener('input', stopPreview));
            window.ByndElevenLabsOptions?.enhance(root());
        }
        function status(message, error = false, preview = false) { const node = el(preview ? 'preview-status' : 'status'); if (node) { node.textContent = message; node.dataset.error = String(error); } }
        function render() {
            if (!el('list')) return;
            const selected = input(voiceId).value.trim(), chosen = state.voices.find(voice => voice.id === selected);
            el('selected').textContent = selected ? `已选：${chosen?.name || input(voiceId).dataset.voiceName || selected}` : role ? '当前跟随全局声音；选用下方声音可为角色单独设置。' : '当前使用接口默认声音；可搜索并选用下方声音。';
            el('list').innerHTML = state.voices.map(voice => `<article class="fish-voice-card${selected === voice.id ? ' is-selected' : ''}"><strong>${esc(voice.name)}</strong><span>${esc([...voice.languages, ...voice.tags].join(' · '))}</span><p>${esc(voice.description)}</p><div><button type="button" data-preview="${attr(voice.id)}">${voice.sample ? '试听样音' : cache.has(signature(previewConfig(voice.id))) ? '试听（缓存）' : '试听（计费）'}</button><button type="button" data-select="${attr(voice.id)}">${selected === voice.id ? '已选' : '选用'}</button></div></article>`).join('');
            el('list').querySelectorAll('[data-select]').forEach(button => button.onclick = () => { const voice = state.voices.find(item => item.id === button.dataset.select); if (!voice) return; stopPreview(); input(voiceId).value = voice.id; input(voiceId).dataset.voiceName = voice.name; render(); });
            el('list').querySelectorAll('[data-preview]').forEach(button => { button.onclick = () => preview(button.dataset.preview); if (state.preview?.id === button.dataset.preview) { button.textContent = state.preview.audio ? '停止试听' : state.preview.loadingLabel; button.setAttribute('aria-pressed', 'true'); } });
            el('more').hidden = !state.more;
        }
        function cancelList() { state.serial++; state.controller?.abort(); state.controller = null; if (el('load')) { el('load').disabled = false; el('more').disabled = false; } }
        async function load(more = false) {
            if (!state.active) return;
            cancelList(); stopPreview();
            const api = config(), account = scope(api), filter = JSON.stringify(filters());
            if (account !== state.scope) { invalidate(); state.active = true; }
            const append = more && filter === state.filter, page = append ? state.page + 1 : 1;
            if (!append && filter !== state.filter) { state.voices = []; state.more = false; render(); }
            const serial = ++state.serial, controller = new AbortController(); state.controller = controller;
            const timer = setTimeout(() => controller.abort(), 15000);
            el('load').disabled = true; el('more').disabled = true; status('正在搜索音色…');
            try {
                const result = await request(api, { ...filters(), page }, controller.signal);
                if (serial !== state.serial || !state.active || account !== scope(config()) || filter !== JSON.stringify(filters())) return;
                const seen = new Set(); state.voices = [...(append ? state.voices : []), ...result.voices].filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
                state.page = page; state.more = result.more; state.filter = filter;
                status(state.voices.length ? `已加载 ${state.voices.length} 个音色${result.more ? '，可继续加载' : ''}。` : '没有匹配的音色，试试其他名称、来源或语言。'); render();
            } catch (error) { if (serial === state.serial && state.active) status(`${error.name === 'AbortError' ? '音色读取超时，请重试' : errorText(error, api)}；当前已选声音保留，可在高级设置使用手填 ID。`, true); }
            finally { clearTimeout(timer); if (serial === state.serial) { state.controller = null; el('load').disabled = false; el('more').disabled = false; } }
        }
        function stopPreview() {
            state.previewSerial++; const current = state.preview; state.preview = null;
            if (current) { clearTimeout(current.timer); current.controller.abort(); if (current.audio) { current.audio.onended = null; current.audio.onerror = null; current.audio.pause(); current.audio.removeAttribute('src'); current.audio.load(); } }
            render();
        }
        async function preview(id) {
            const voice = state.voices.find(item => item.id === id); if (!voice) return;
            if (state.preview?.id === id) { stopPreview(); status('已停止试听。', false, true); return; }
            window.ByndMiniMaxVoices?.stopAll(); window.ByndFishVoices?.stopAll();
            const api = previewConfig(id), key = signature(api), serial = ++state.previewSerial, controller = new AbortController();
            if (!voice.sample && !api.apiKey) { status('请先填写 Fish Audio API Key。', true, true); return; }
            const current = { id, controller, audio: null, timer: null, loadingLabel: voice.sample || cache.has(key) ? '加载样音… 点击取消' : '生成中… 点击取消' }; state.preview = current; render();
            status(voice.sample ? '正在播放已有样音，不生成新语音。' : cache.has(key) ? '重播缓存，不重新生成。' : '正在生成试听短句（计费）…', false, true);
            try {
                let url = voice.sample || cache.get(key);
                if (!url) {
                    current.timer = setTimeout(() => controller.abort(), 30000);
                    const result = await requestFishAudioVoiceAudio(previewText, api, { signal: controller.signal }); url = result?.audioUrl; clearTimeout(current.timer);
                }
                if (serial !== state.previewSerial || !state.active) return;
                if (key !== signature(previewConfig(id))) { stopPreview(); status('参数已改变，请重新试听。', false, true); return; }
                if (!url) throw new Error('试听接口没有返回音频');
                if (!voice.sample) { cache.set(key, url); if (cache.size > 12) cache.delete(cache.keys().next().value); }
                const audio = new Audio(url); current.audio = audio;
                audio.onended = () => { if (state.preview === current) { stopPreview(); status('试听结束。', false, true); } };
                audio.onerror = () => { if (state.preview === current) { cache.delete(key); stopPreview(); status('样音播放失败，请检查网络或音频格式后重试。', true, true); } };
                await audio.play(); if (serial === state.previewSerial) render();
            } catch (error) { if (serial === state.previewSerial) { stopPreview(); status(error.name === 'NotAllowedError' ? '请再点一次试听播放；已生成样音会复用缓存。' : `试听失败：${error.name === 'AbortError' ? '生成超时' : errorText(error, api)}`, true, true); } }
            finally { clearTimeout(current.timer); }
        }
        function close() { state.active = false; clearTimeout(state.timer); cancelList(); stopPreview(); window.ByndElevenLabsOptions?.closeMenu(); }
        function invalidate() {
            if (!root()) return;
            close(); const account = scope(config());
            if (account !== state.scope) for (const key of cache.keys()) if (JSON.parse(key)[0] === state.scope) cache.delete(key);
            state.scope = account; state.voices = []; state.page = 0; state.more = false; state.filter = ''; ensure(); render(); status('填写 API Key 后可搜索公开音色或我的音色。'); status('', false, true);
        }
        function open() { invalidate(); state.active = true; el('search').value = ''; el('source').value = ''; el('language').value = ''; window.ByndElevenLabsOptions?.enhance(root()); if (config().apiKey) load(); }
        function refresh() { const active = state.active; invalidate(); state.active = active; }
        return { open, close, invalidate, refresh, load, stopPreview };
    }
    const settings = createPicker({ rootId: 'api-fish-picker', voiceId: 'api-fish-voice-id', modelId: 'api-fish-voice-model', config: () => getApiFishAudioVoiceConfigFromModal() });
    const character = createPicker({ rootId: 'wcs-fish-picker', voiceId: 'wcs-char-voice-id', modelId: 'wcs-char-voice-model', config: () => getVoiceApiByProvider('fish-audio') || {}, role: true });
    window.ByndFishVoices = { ...settings, character, request, endpoint, sampleUrl, stopAll() { settings.stopPreview(); character.stopPreview(); } };
})();
