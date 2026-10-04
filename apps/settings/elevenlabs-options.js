// Account metadata stays in memory; character bindings contain no credentials.
(function () {
    const panels = new Map();
    let popup = null, recent = null, usageSerial = 0;
    const esc = value => escapeHtml(String(value)).replace(/"/g, '&quot;');
    const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
    const scope = api => JSON.stringify([normalizeElevenLabsBaseUrl(api.baseUrl), api.apiKey || '']);

    async function read(api, path) {
        if (!String(api.apiKey || '').trim()) throw new Error('请先配置 API Key');
        const root = normalizeElevenLabsBaseUrl(api.baseUrl).replace(/\/v[12]$/i, '');
        const url = new URL(`${root}${path}`);
        if (!/^https?:$/.test(url.protocol)) throw new Error('Base URL 必须是 http 或 https 地址');
        const response = await fetch(url.href, { headers: { Accept: 'application/json', 'xi-api-key': api.apiKey }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(({ 401: 'API Key 无效或已过期', 403: '读取权限不足，请检查 API Key 的 Models / User / History 权限', 404: '当前服务不支持此接口', 429: '请求过于频繁，请稍后重试' })[response.status] || `读取失败（HTTP ${response.status}）`);
        return response.json();
    }

    function closeMenu(focus = false) {
        if (!popup) return;
        const { layer, trigger, onClose } = popup;
        popup = null;
        onClose?.();
        layer.remove(); trigger.setAttribute('aria-expanded', 'false');
        if (focus && trigger.isConnected) trigger.focus({ preventScroll: true });
    }

    function openMenu(select, trigger) {
        closeMenu();
        const phone = select.closest('.phone-container');
        if (!phone || select.disabled) return;
        const layer = document.createElement('div');
        layer.className = `elevenlabs-select-overlay${select.closest('.minimax-voice-picker') ? ' minimax-select-overlay' : select.closest('.fish-voice-picker') ? ' fish-select-overlay' : ''}`;
        const box = document.createElement('div');
        box.className = 'elevenlabs-select-sheet'; box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', select.getAttribute('aria-label') || '选择选项');
        box.setAttribute('aria-modal', 'true');
        const header = document.createElement('div'); header.className = 'elevenlabs-select-heading';
        const title = document.createElement('strong'); title.textContent = box.getAttribute('aria-label');
        const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = '关闭';
        dismiss.onclick = () => closeMenu(true); header.append(title, dismiss); box.append(header);
        const preview = window.ByndMiniMaxVoices?.forPicker(select.dataset.minimaxPreview);
        let previewNote = null;
        if (preview) {
            previewNote = document.createElement('div'); previewNote.className = 'minimax-preview-note'; previewNote.setAttribute('role', 'status'); previewNote.setAttribute('aria-live', 'polite');
            previewNote.textContent = '试听短句会计费；本次页面内重播缓存不重新生成。'; box.append(previewNote);
        }
        const list = document.createElement('div'); list.className = 'elevenlabs-select-list'; list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', title.textContent);
        for (const option of select.options) {
            const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'option');
            button.textContent = option.textContent; button.disabled = option.disabled;
            button.setAttribute('aria-selected', String(option.value === select.value));
            button.onclick = () => { select.value = option.value; select.dispatchEvent(new Event('change', { bubbles: true })); syncSelect(select); closeMenu(true); };
            if (preview && option.value && !option.disabled) {
                const row = document.createElement('div'); row.className = 'minimax-select-row';
                const listen = document.createElement('button'); listen.type = 'button'; listen.className = 'minimax-voice-listen';
                listen.textContent = preview.previewLabel(option.value); listen.setAttribute('aria-label', `试听 ${option.textContent}`); listen.setAttribute('aria-pressed', 'false');
                listen.onclick = () => preview.preview(option.value, listen, previewNote);
                row.append(button, listen); list.append(row);
            } else list.append(button);
        }
        box.append(list); layer.append(box); phone.append(layer);
        popup = { layer, trigger, onClose: preview ? () => preview.stopPreview() : null }; trigger.setAttribute('aria-expanded', 'true');
        layer.onclick = event => { if (event.target === layer) closeMenu(true); };
        layer.onkeydown = event => {
            const buttons = [...box.querySelectorAll('button:not(:disabled)')];
            const index = buttons.indexOf(document.activeElement);
            if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); }
            else if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Tab'].includes(event.key)) {
                event.preventDefault();
                const next = event.key === 'Home' ? 1 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1) + buttons.length) % buttons.length;
                buttons[next]?.focus();
            }
        };
        const selected = list.querySelector('[aria-selected="true"]:not(:disabled)') || list.querySelector('button:not(:disabled)') || dismiss;
        selected.focus({ preventScroll: true }); selected.scrollIntoView({ block: 'nearest' });
    }

    function syncSelect(select) {
        const trigger = select.nextElementSibling;
        if (!trigger?.classList.contains('elevenlabs-select-trigger')) return;
        trigger.textContent = select.selectedOptions[0]?.textContent || '请选择'; trigger.disabled = select.disabled;
    }

    function enhance(root) {
        root?.querySelectorAll('select').forEach(select => {
            if (!select.classList.contains('elevenlabs-select-native')) {
                const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'elevenlabs-select-trigger';
                trigger.id = `${select.id}-trigger`; trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false');
                trigger.setAttribute('aria-label', select.getAttribute('aria-label') || select.closest('label')?.querySelector('span')?.textContent || '选择选项');
                select.classList.add('elevenlabs-select-native'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
                select.after(trigger); trigger.onclick = () => openMenu(select, trigger);
                select.addEventListener('change', () => syncSelect(select));
                new MutationObserver(() => syncSelect(select)).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
            }
            syncSelect(select);
        });
    }

    const help = '<details class="elevenlabs-advanced"><summary>计费与额度说明</summary><p>Free 套餐不能通过 API 生成社区音色库的声音，即使官网能用、音色允许免费用户或样音能试听，也不能据此认定聊天语音可生成。可先在音色分类选择内置音色，为不同角色分别选声音；社区音色需要有权限的付费套餐。已保存到“我的音色”的社区声音仍受此限制。</p><a href="https://elevenlabs.io/docs/eleven-creative/voices/voice-library" target="_blank" rel="noopener noreferrer">查看官方社区音色 API 限制</a><p>生成聊天语音、通话语音和“测试语音”都会消耗 ElevenLabs 额度；加载列表、播放已有样音不发起新的语音生成。按输入字符和模型费率计费，中文、标点也属于输入文本；重新生成会再次计费。</p><p>这里的“剩余积分”来自订阅接口（旧字段仍叫 characters），是本期包含额度减已用量，不等于官网 ElevenAPI 的美元充值余额。充值余额、超额扣款、税费及优惠以账户账单为准。模型不同，积分消耗不同；模型信息中的倍率仅供参考，单次用量优先核对对应生成记录。</p><p>官网 API 价格按每 1,000 字符标价，并可能随套餐、音色和限时活动变化。例如 100 字符的美元费用为页面单价 × 0.1；页面的 Business 起始价格不代表你的实际账单。美元与积分不能固定换算。</p><p>2026-10-04 官方 API 页面参考价：v4、v3、v2 Multilingual 的常规起始价为 $0.08 / 1,000 字符，v4 Turbo、v3 Conversational 为 $0.04 / 1,000 字符。页面另有限时优惠，请以当前账户价格为准。例如按 $0.08 的单价生成 100 字符，参考费用约 $0.008；这不是你的实际扣款凭证。</p><p>单次用量仅在接口提供生成标识且能读取对应历史记录时显示为已核对；代理未透传标识、历史未同步或权限不足时会显示无法核对，不把全账户前后差值当成这一条的消耗。</p><a href="https://elevenlabs.io/pricing/api" target="_blank" rel="noopener noreferrer">查看官方最新模型价格</a></details>';

    function ensure(prefix, inputId, config) {
        if (panels.has(prefix)) return panels.get(prefix);
        const picker = document.getElementById(prefix === 'api-elevenlabs-' ? 'api-elevenlabs-voices-list' : 'wcs-elevenlabs-picker');
        const anchor = prefix === 'api-elevenlabs-' ? picker?.closest('.elevenlabs-voices') : picker;
        if (!anchor) return null;
        const panel = document.createElement('div'); panel.className = 'elevenlabs-account';
        panel.innerHTML = `<div class="elevenlabs-voices-heading"><strong>语音模型</strong><button type="button" data-model-load>刷新模型</button></div><select id="${prefix}models-select" aria-label="选择语音模型"></select><div data-model-status class="elevenlabs-voices-status" role="status"></div><div class="elevenlabs-voices-heading"><strong>账户额度</strong><button type="button" data-account-load>刷新额度</button></div><div data-account-status class="elevenlabs-voices-status" role="status">尚未读取</div><div data-usage-status class="elevenlabs-voices-status" role="status"></div>${help}`;
        if (prefix === 'api-elevenlabs-') anchor.before(panel); else anchor.prepend(panel);
        const state = { prefix, inputId, config, panel, models: [], serial: 0, accountSerial: 0, active: false };
        panels.set(prefix, state);
        panel.querySelector('[data-model-load]').onclick = () => loadModels(state);
        panel.querySelector('[data-account-load]').onclick = () => loadAccount(state);
        panel.querySelector('select').onchange = event => { document.getElementById(inputId).value = event.target.value; modelInfo(state); };
        document.getElementById(inputId).addEventListener('input', () => renderModels(state));
        renderModels(state); enhance(panel); return state;
    }

    function modelInfo(state) {
        const value = document.getElementById(state.inputId).value.trim();
        const model = state.models.find(item => item.model_id === value);
        const info = state.panel.querySelector('[data-model-status]');
        if (!model) { info.textContent = value ? '当前模型已保留；刷新列表后可选择其他模型。' : '使用全局 TTS 模型'; return; }
        const languages = Array.isArray(model.languages) ? model.languages : [];
        info.textContent = [languages.length ? (languages.some(item => item.language_id === 'zh') ? '支持中文' : '语言列表未包含中文') : '', model.requires_alpha_access ? '需要测试资格' : '', number(model.token_cost_factor) ? `积分倍率 ${model.token_cost_factor}（参考）` : '', number(model.maximum_text_length_per_request) ? `单次上限 ${model.maximum_text_length_per_request} 字符` : '', String(model.description || '')].filter(Boolean).join(' · ');
    }

    function renderModels(state) {
        const select = state.panel.querySelector('select');
        const value = document.getElementById(state.inputId).value.trim();
        select.innerHTML = (state.prefix === 'wcs-elevenlabs-' ? '<option value="">跟随全局 TTS 模型</option>' : '')
            + (value && !state.models.some(model => model.model_id === value) ? `<option value="${esc(value)}">${esc(value)}（当前模型）</option>` : '')
            + state.models.map(model => `<option value="${esc(model.model_id)}">${esc(model.name || model.model_id)}</option>`).join('');
        if (!select.options.length) select.innerHTML = '<option value="">请先加载模型</option>';
        select.value = value; syncSelect(select); modelInfo(state);
    }

    async function loadModels(state) {
        const api = state.config(), account = scope(api), serial = ++state.serial;
        const button = state.panel.querySelector('[data-model-load]'); button.disabled = true;
        const status = state.panel.querySelector('[data-model-status]'); status.textContent = '正在读取模型…';
        try {
            const data = await read(api, '/v1/models');
            if (serial !== state.serial || !state.active || account !== scope(state.config())) return;
            if (!Array.isArray(data)) throw new Error('模型接口返回了无效列表');
            state.models = data.filter(item => item && typeof item.model_id === 'string' && item.model_id.trim() && item.can_do_text_to_speech === true);
            renderModels(state);
            if (!state.models.length) status.textContent = '当前接口未返回文字转语音模型，可保留当前模型或在高级设置填写。';
        } catch (error) { if (serial === state.serial && state.active && account === scope(state.config())) status.textContent = `模型加载失败：${error.name === 'TimeoutError' ? '请求超时' : '请检查连接、接口和 Models 读取权限'}；当前模型已保留。`; }
        finally { if (serial === state.serial) button.disabled = false; }
    }

    async function loadAccount(state) {
        const api = state.config(), account = scope(api), serial = ++state.accountSerial;
        const button = state.panel.querySelector('[data-account-load]'); button.disabled = true;
        const status = state.panel.querySelector('[data-account-status]'); status.textContent = '正在读取账户额度…';
        try {
            const data = await read(api, '/v1/user/subscription');
            if (serial !== state.accountSerial || !state.active || account !== scope(state.config())) return;
            if (!number(data.character_count) || !number(data.character_limit)) throw new Error('额度接口缺少有效用量');
            window.ByndElevenLabsVoices?.notifyTier(api, data.tier);
            const reset = number(data.next_character_count_reset_unix) && data.next_character_count_reset_unix > 0 ? ` · 重置 ${new Date(data.next_character_count_reset_unix * 1000).toLocaleDateString()}` : '';
            status.textContent = `本期剩余积分 ${Math.max(0, data.character_limit - data.character_count).toLocaleString()} · 已用 ${data.character_count.toLocaleString()} / ${data.character_limit.toLocaleString()} · ${String(data.tier || '当前套餐')}${reset}（刚刚读取，非美元余额）`;
        } catch (_) { if (serial === state.accountSerial && state.active && account === scope(state.config())) status.textContent = '额度读取失败：请检查连接与 User 读取权限；美元充值余额请在官网账单查看。'; }
        finally { if (serial === state.accountSerial) button.disabled = false; }
    }

    function renderUsage() {
        panels.forEach(state => {
            state.panel.querySelector('[data-usage-status]').textContent = recent && recent.scope === scope(state.config()) ? recent.message : '本次会话尚无语音生成用量记录';
        });
    }

    // Match a specific generation. Account-wide deltas would miscount concurrent calls.
    async function record(api, headers) {
        const serial = ++usageSerial, account = scope(api);
        const historyId = headers.get('history-item-id');
        const requestId = headers.get('request-id') || headers.get('x-request-id');
        recent = { scope: account, message: '最近一次语音已生成 · 用量正在核对…' }; renderUsage();
        try {
            if (!historyId && !requestId) throw new Error('未返回生成标识');
            const data = await read(api, historyId ? `/v1/history/${encodeURIComponent(historyId)}` : `/v1/history?page_size=100&source=TTS&voice_id=${encodeURIComponent(api.voiceId || '')}`);
            const item = historyId ? (data.history_item_id === historyId ? data : null) : data.history?.find(item => item.request_id === requestId);
            if (!item || !number(item.character_count_change_from) || !number(item.character_count_change_to) || item.character_count_change_to < item.character_count_change_from) throw new Error('未找到有效用量');
            if (serial !== usageSerial) return;
            recent.message = `最近一次语音消耗 ${item.character_count_change_to - item.character_count_change_from} 积分（已核对生成记录） · ${new Date().toLocaleTimeString()}`;
        } catch (_) { if (serial === usageSerial) recent.message = '最近一次语音已生成 · 单次用量无法核对，请查看官网历史记录（需 History 读取权限及生成标识）'; }
        if (serial !== usageSerial) return;
        renderUsage();
        panels.forEach(state => { if (state.active && account === scope(state.config())) loadAccount(state); });
    }

    function open(prefix, inputId, config) {
        const state = ensure(prefix, inputId, config); if (!state) return;
        state.active = true; state.models = []; renderModels(state); renderUsage();
        enhance(prefix === 'api-elevenlabs-' ? document.getElementById('api-elevenlabs-voice-modal') : document.getElementById('wcs-elevenlabs-picker'));
        if (config().apiKey) { loadModels(state); loadAccount(state); }
    }

    function close(prefix) {
        closeMenu();
        const state = panels.get(prefix); if (!state) return;
        state.active = false; state.serial++; state.accountSerial++;
        state.panel.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }

    function invalidate(prefix) {
        closeMenu(); const state = panels.get(prefix); if (!state) return;
        state.serial++; state.accountSerial++; state.models = []; renderModels(state); renderUsage();
        state.panel.querySelector('[data-account-status]').textContent = '账户配置已变化，请刷新额度';
        state.panel.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }

    window.ByndElevenLabsOptions = { open, close, invalidate, enhance, closeMenu, record, read };
})();
