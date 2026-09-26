// 3. 渲染 API 列表
function renderApiList() {
    const container = document.getElementById('api-list-container');
    if (!container) return;

    const data = getApiData();
    renderApiRoutePanel(data);

    if (!data.apis || data.apis.length === 0) {
        container.innerHTML = `
            <div class="set-empty">
                <i class="ri-cloud-off-line"></i>
                还没有添加 API 哦～<br>点下面的按钮添加一个吧
            </div>
        `;
        return;
    }

    container.innerHTML = data.apis.map(api => {
        const isDefault = api.model && api.id === data.defaultId;
        const isImageDefault = api.imageModel && api.id === data.imageDefaultId;
        const statusClass = api._status || ''; // online / offline / testing / ''
        return `
            <div class="api-card ${isDefault ? 'is-default' : ''} ${isImageDefault ? 'is-image-default' : ''}" data-id="${api.id}">
                <div class="api-status-dot ${statusClass}"></div>
                <div class="api-card-info" onclick="openApiModal('${api.id}')">
                    <div class="api-card-name">
                        ${isDefault ? '<span class="crown">♛</span>' : ''}
                        ${isImageDefault ? '<span class="api-image-badge"><i class="ri-image-2-fill"></i></span>' : ''}
                        ${escapeHtml(api.name || '未命名')}
                    </div>
                    <div class="api-card-url">${escapeHtml(api.baseUrl || '')}</div>
                    <div class="api-card-tags">
                        ${api.model ? `<span class="api-card-model">聊天 ${escapeHtml(api.model)}</span>` : ''}
                        ${api.imageModel ? `<span class="api-card-model image">生图 ${escapeHtml(api.imageModel)}</span>` : ''}
                    </div>
                </div>
                <div class="api-card-actions">
                    <i class="ri-signal-tower-line" title="测试" onclick="testApiById('${api.id}')"></i>
                    <i class="ri-star-${isDefault ? 'fill' : 'line'}" title="设为聊天默认" onclick="setDefaultApi('${api.id}')" style="${isDefault ? 'color:#f8a4b8;' : ''}"></i>
                    <i class="ri-image-${isImageDefault ? 'fill' : 'line'}" title="设为生图默认" onclick="setDefaultImageApi('${api.id}')" style="${isImageDefault ? 'color:#6ea8ff;' : ''}"></i>
                    <i class="ri-delete-bin-6-line del-btn" title="删除" onclick="deleteApi('${api.id}')"></i>
                </div>
            </div>
        `;
    }).join('');
}

function renderApiRoutePanel(data = getApiData()) {
    const panel = document.getElementById('api-route-panel');
    if (!panel) return;
    const chatApis = data.apis.filter(api => api.model);
    const chatApi = chatApis.find(api => api.id === data.defaultId) || null;
    const imageApi = data.apis.find(api => api.id === data.imageDefaultId && api.imageModel) || null;
    const voiceApi = normalizeVoiceApiData(data.voiceApi);
    const openAiVoiceApi = normalizeOpenAiVoiceApiData(data.openAiVoiceApi);
    const fishAudioVoiceApi = normalizeFishAudioVoiceApiData(data.fishAudioVoiceApi);
    const elevenLabsVoiceApi = normalizeElevenLabsVoiceApiData(data.elevenLabsVoiceApi);
    const localVoiceApi = normalizeLocalVoiceApiData(data.localVoiceApi);
    const voiceReady = isApiVoiceEnabled(voiceApi);
    const openAiVoiceReady = isOpenAiVoiceEnabled(openAiVoiceApi);
    const fishAudioVoiceReady = isFishAudioVoiceEnabled(fishAudioVoiceApi);
    const elevenLabsVoiceReady = isElevenLabsVoiceEnabled(elevenLabsVoiceApi);
    const localVoiceReady = isLocalVoiceEnabled(localVoiceApi);
    const voiceDefaultProvider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, voiceApi, localVoiceApi, openAiVoiceApi, elevenLabsVoiceApi, fishAudioVoiceApi);
    const panelHead = `
        <div class="api-route-head">
            <div>
                <strong>API 工作台</strong>
                <span>聊天走中转站 API；生图可用中转站或 NovelAI，按用途分别选择；语音供应商单独配置。</span>
            </div>
            <button type="button" onclick="openApiModal()"><i class="ri-add-line"></i> 添加</button>
        </div>
        <div class="api-route-grid">
            <div class="api-route-card chat">
                <i class="ri-chat-smile-3-line"></i>
                <span>聊天 API</span>
                ${renderApiRoutePicker('chat', chatApi, chatApis, data.defaultId)}
            </div>
            <div class="api-route-card image">
                <i class="ri-image-2-line"></i>
                <span>中转站生图</span>
                ${renderApiRoutePicker('image', imageApi, data.apis.filter(api => api.imageModel), data.imageDefaultId)}
            </div>
            ${typeof renderImageServiceCard === 'function' ? renderImageServiceCard(data) : ''}
    `;
    const voiceCard = `
            <div class="api-route-card voice">
                <i class="ri-volume-up-line"></i>
                <span>语音 API</span>
                <div class="api-voice-choice-grid">
                    ${renderVoiceProviderRoute({
                        provider: 'minimax',
                        title: 'MiniMax',
                        name: voiceApi.enabled ? (voiceApi.name || 'MiniMax 语音') : '未启用',
                        summary: voiceReady ? getApiVoiceSummary(voiceApi) : '官方语音接口',
                        ready: voiceReady,
                        active: voiceDefaultProvider === 'minimax' && voiceReady,
                        editAction: 'openApiVoiceModal()'
                    })}
                    ${renderVoiceProviderRoute({
                        provider: 'openai',
                        title: 'OpenAI',
                        name: openAiVoiceApi.enabled ? (openAiVoiceApi.name || 'OpenAI TTS') : '未启用',
                        summary: openAiVoiceReady ? getOpenAiVoiceSummary(openAiVoiceApi) : '通用内置音色',
                        ready: openAiVoiceReady,
                        active: voiceDefaultProvider === 'openai' && openAiVoiceReady,
                        editAction: 'openApiOpenAiVoiceModal()'
                    })}
                    ${renderVoiceProviderRoute({
                        provider: 'fish-audio',
                        title: 'Fish Audio',
                        name: fishAudioVoiceApi.enabled ? (fishAudioVoiceApi.name || 'Fish Audio') : '未启用',
                        summary: fishAudioVoiceReady ? getFishAudioVoiceSummary(fishAudioVoiceApi) : '官方 OpenAI 兼容接口',
                        ready: fishAudioVoiceReady,
                        active: voiceDefaultProvider === 'fish-audio' && fishAudioVoiceReady,
                        editAction: 'openApiFishAudioVoiceModal()'
                    })}
                    ${renderVoiceProviderRoute({
                        provider: 'elevenlabs',
                        title: 'ElevenLabs',
                        name: elevenLabsVoiceApi.enabled ? (elevenLabsVoiceApi.name || 'ElevenLabs') : '未启用',
                        summary: elevenLabsVoiceReady ? getElevenLabsVoiceSummary(elevenLabsVoiceApi) : '克隆音色/高质量英文',
                        ready: elevenLabsVoiceReady,
                        active: voiceDefaultProvider === 'elevenlabs' && elevenLabsVoiceReady,
                        editAction: 'openApiElevenLabsVoiceModal()'
                    })}
                    ${renderVoiceProviderRoute({
                        provider: 'local',
                        title: '本地 TTS',
                        name: localVoiceApi.enabled ? (localVoiceApi.name || '本地 TTS') : '未启用',
                        summary: localVoiceReady ? getLocalVoiceSummary(localVoiceApi) : '电脑本地 HTTP 接口',
                        ready: localVoiceReady,
                        active: voiceDefaultProvider === 'local' && localVoiceReady,
                        editAction: 'openApiLocalVoiceModal()'
                    })}
                </div>
            </div>
    `;
    // Voice providers live on their own settings tab when that container exists.
    const voicePanel = document.getElementById('api-voice-route-panel');
    if (voicePanel) voicePanel.innerHTML = `<div class="api-route-grid">${voiceCard}</div>`;
    panel.innerHTML = `${panelHead}${voicePanel ? '' : voiceCard}
        </div>
    `;
}

function renderVoiceProviderRoute({ provider, title, name, summary, ready, active, editAction }) {
    return `
        <div class="api-voice-route ${provider} ${ready ? 'ready' : ''} ${active ? 'active' : ''}">
            <div class="api-voice-route-main">
                <strong>${escapeHtml(title)}</strong>
                <b>${escapeHtml(name || title)}</b>
                <em>${escapeHtml(summary || '')}</em>
            </div>
            <div class="api-voice-route-actions">
                ${ready ? `<button type="button" class="api-voice-default-btn" onclick="setDefaultVoiceProvider('${provider}')" ${active ? 'disabled' : ''}>${active ? '默认' : '设默认'}</button>` : ''}
                <button type="button" onclick="${editAction}">${ready ? '编辑' : '配置'}</button>
            </div>
        </div>
    `;
}

function renderApiRoutePicker(type, selectedApi, apis, selectedId) {
    const isImage = type === 'image';
    const isVoice = type === 'voice';
    const emptyText = isVoice ? '先配置 MiniMax 语音' : (isImage ? '先选择生图模型' : '请选择聊天 API');
    const modelText = selectedApi
        ? (isVoice ? (getApiVoiceSummary(selectedApi) || '未选语音模型') : (isImage ? (selectedApi.imageModel || '未选生图模型') : (selectedApi.model || '未选聊天模型')))
        : emptyText;
    const list = Array.isArray(apis) ? apis : [];
    const menu = list.length ? list.map(api => {
        const active = api.id === selectedId;
        const tags = [
            api.model ? `聊天 ${api.model}` : '',
            api.imageModel ? `生图 ${api.imageModel}` : '',
            api.voiceProvider === 'minimax' ? `语音 ${getApiVoiceSummary(api)}` : ''
        ].filter(Boolean).join(' · ') || '未选择模型';
        return `
            <button type="button" class="api-route-option ${active ? 'active' : ''}" onclick="chooseApiRoute('${type}', '${escapeJsString(api.id)}')">
                <span class="api-route-option-dot ${api._status || ''}"></span>
                <span class="api-route-option-main">
                    <b>${escapeHtml(api.name || '未命名')}</b>
                    <em>${escapeHtml(tags)}</em>
                </span>
                ${active ? '<i class="ri-check-line"></i>' : ''}
            </button>
        `;
    }).join('') : `
        <div class="api-route-empty">${isVoice ? '还没有配置 MiniMax 语音。编辑 API，开启 MiniMax 语音并填写模型、音色 ID。' : (isImage ? '还没有配置生图模型。编辑 API，测试后从生图模型下拉里选一个。' : '还没有可用 API。')}</div>
    `;
    return `
        <div class="api-route-picker" data-route-type="${type}">
            <button type="button" class="api-route-trigger" onclick="toggleApiRouteMenu('${type}')">
                <span>
                    <b>${selectedApi ? escapeHtml(selectedApi.name || '未命名') : escapeHtml(emptyText)}</b>
                    <em>${escapeHtml(modelText)}</em>
                </span>
                <i class="ri-arrow-down-s-line"></i>
            </button>
            <div class="api-route-menu">
                ${menu}
            </div>
        </div>
    `;
}

function escapeJsString(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function toggleApiRouteMenu(type) {
    const targetPicker = Array.from(document.querySelectorAll('.api-route-picker'))
        .find(picker => picker.dataset.routeType === type);
    const shouldOpen = !!targetPicker && !targetPicker.classList.contains('open');
    closeApiFloatingPickers();
    if (shouldOpen) targetPicker.classList.add('open');
}

function chooseApiRoute(type, apiId) {
    if (type === 'image') setDefaultImageApi(apiId);
    else setDefaultApi(apiId);
}

function closeApiFloatingPickers() {
    document.querySelectorAll('.api-route-picker.open, .api-model-picker.open').forEach(picker => picker.classList.remove('open'));
    document.getElementById('api-edit-modal')?.classList.remove('api-picker-open');
}

document.addEventListener('click', event => {
    if (event.target.closest('.api-route-picker') || event.target.closest('.api-model-picker')) return;
    closeApiFloatingPickers();
});

function refreshApiModelPickers() {
    renderApiModelPicker('api-edit-model', {
        title: '聊天模型',
        emptyText: '请先点测试按钮',
        disabledText: '测试连接后选择聊天模型',
        noneText: '不在这个 API 使用聊天'
    });
    renderApiModelPicker('api-edit-image-model', {
        title: '生图模型',
        emptyText: '请先点测试按钮',
        disabledText: '测试连接后选择生图模型',
        noneText: '不在这个 API 使用生图'
    });
}

function renderApiModelPicker(selectId, config = {}) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl || selectEl.tagName !== 'SELECT') {
        removeApiModelPicker(selectId);
        return;
    }

    selectEl.classList.add('api-native-hidden');
    let picker = document.querySelector(`.api-model-picker[data-model-picker-for="${selectId}"]`);
    if (!picker) {
        picker = document.createElement('div');
        picker.className = 'api-model-picker';
        picker.dataset.modelPickerFor = selectId;
        selectEl.insertAdjacentElement('afterend', picker);
    }

    const options = Array.from(selectEl.options || []).map(option => ({
        value: option.value,
        text: option.textContent || option.value || config.emptyText || '未选择',
        selected: option.selected,
        disabled: option.disabled
    }));
    const selected = options.find(option => option.selected) || options[0] || null;
    const isDisabled = !!selectEl.disabled;
    const selectedLabel = selected ? selected.text : (config.emptyText || '未选择');
    const selectedDetail = isDisabled
        ? (config.disabledText || selectedLabel)
        : (selected && selected.value ? selected.value : (config.noneText || selectedLabel));
    const availableOptions = options.filter(option => !option.disabled);

    picker.classList.toggle('disabled', isDisabled);
    picker.innerHTML = `
        <button type="button" class="api-model-trigger" onclick="toggleApiModelMenu('${selectId}')" ${isDisabled ? 'disabled' : ''}>
            <span>
                <small>${escapeHtml(config.title || '模型')}</small>
                <b>${escapeHtml(selectedLabel)}</b>
                <em>${escapeHtml(selectedDetail)}</em>
            </span>
            <i class="ri-arrow-down-s-line"></i>
        </button>
        <div class="api-model-menu">
            <div class="api-model-menu-title">${escapeHtml(config.title || '选择模型')}</div>
            ${availableOptions.length ? availableOptions.map(option => `
                <button type="button" class="api-model-option ${option.value === selectEl.value ? 'active' : ''}" onclick="chooseApiModelOption('${selectId}', '${escapeJsString(option.value)}')">
                    <span>
                        <b>${escapeHtml(option.text)}</b>
                        <em>${escapeHtml(option.value || config.noneText || '留空')}</em>
                    </span>
                    ${option.value === selectEl.value ? '<i class="ri-check-line"></i>' : ''}
                </button>
            `).join('') : `<div class="api-route-empty">${escapeHtml(config.disabledText || config.emptyText || '暂无可选模型')}</div>`}
        </div>
    `;
}

function toggleApiModelMenu(selectId) {
    const picker = document.querySelector(`.api-model-picker[data-model-picker-for="${selectId}"]`);
    if (!picker || picker.classList.contains('disabled')) return;
    document.querySelectorAll('.api-route-picker.open').forEach(routePicker => routePicker.classList.remove('open'));
    const willOpen = !picker.classList.contains('open');
    document.querySelectorAll('.api-model-picker').forEach(item => {
        item.classList.toggle('open', item === picker && willOpen);
    });
    document.getElementById('api-edit-modal')?.classList.toggle('api-picker-open', willOpen);
    if (willOpen) {
        setTimeout(() => picker.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
    }
}

function chooseApiModelOption(selectId, value) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl || selectEl.tagName !== 'SELECT') return;
    selectEl.value = value;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    refreshApiModelPickers();
    closeApiFloatingPickers();
}

function removeApiModelPicker(selectId) {
    const picker = document.querySelector(`.api-model-picker[data-model-picker-for="${selectId}"]`);
    if (picker) picker.remove();
    const el = document.getElementById(selectId);
    if (el) el.classList.remove('api-native-hidden');
}

function setApiVoiceModalValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value == null ? '' : String(value);
}

function fillApiVoiceModal(api = getApiData().voiceApi) {
    const voice = normalizeVoiceApiData(api);
    setApiVoiceModalValue('api-voice-enabled', voice.enabled);
    setApiVoiceModalValue('api-voice-name', voice.name);
    setApiVoiceModalValue('api-voice-url', voice.baseUrl);
    setApiVoiceModalValue('api-voice-key', voice.apiKey);
    setApiVoiceModalValue('api-voice-model', voice.voiceModel);
    setApiVoiceModalValue('api-voice-id', voice.voiceId);
    setApiVoiceModalValue('api-voice-endpoint', voice.voiceEndpoint);
    setApiVoiceModalValue('api-voice-group-id', voice.voiceGroupId);
    setApiVoiceModalValue('api-voice-speed', voice.voiceSpeed);
    setApiVoiceModalValue('api-voice-volume', voice.voiceVolume);
    setApiVoiceModalValue('api-voice-pitch', voice.voicePitch);
    setApiVoiceModalValue('api-voice-format', voice.voiceFormat);
}

function openApiVoiceModal() {
    const modal = document.getElementById('api-voice-modal');
    const resultEl = document.getElementById('api-voice-test-result');
    if (!modal) return;
    if (resultEl) resultEl.innerHTML = '';
    fillApiVoiceModal();
    modal.classList.remove('hidden');
}

function closeApiVoiceModal() {
    document.getElementById('api-voice-modal')?.classList.add('hidden');
}

function fillApiOpenAiVoiceModal(api = getApiData().openAiVoiceApi) {
    const voice = normalizeOpenAiVoiceApiData(api);
    setApiVoiceModalValue('api-openai-voice-enabled', voice.enabled);
    setApiVoiceModalValue('api-openai-voice-name', voice.name);
    setApiVoiceModalValue('api-openai-voice-url', voice.baseUrl);
    setApiVoiceModalValue('api-openai-voice-key', voice.apiKey);
    setApiVoiceModalValue('api-openai-voice-model', voice.voiceModel);
    setApiVoiceModalValue('api-openai-voice-id', voice.voiceId);
    setApiVoiceModalValue('api-openai-voice-endpoint', voice.voiceEndpoint);
    setApiVoiceModalValue('api-openai-voice-format', voice.voiceFormat);
    setApiVoiceModalValue('api-openai-voice-instructions', voice.instructions);
}

function openApiOpenAiVoiceModal() {
    const modal = document.getElementById('api-openai-voice-modal');
    const resultEl = document.getElementById('api-openai-voice-test-result');
    if (!modal) return;
    if (resultEl) resultEl.innerHTML = '';
    fillApiOpenAiVoiceModal();
    modal.classList.remove('hidden');
}

function closeApiOpenAiVoiceModal() {
    document.getElementById('api-openai-voice-modal')?.classList.add('hidden');
}

function fillApiFishAudioVoiceModal(api = getApiData().fishAudioVoiceApi) {
    const voice = normalizeFishAudioVoiceApiData(api);
    setApiVoiceModalValue('api-fish-voice-enabled', voice.enabled);
    setApiVoiceModalValue('api-fish-voice-name', voice.name);
    setApiVoiceModalValue('api-fish-voice-url', voice.baseUrl);
    setApiVoiceModalValue('api-fish-voice-key', voice.apiKey);
    setApiVoiceModalValue('api-fish-voice-model', voice.voiceModel);
    setApiVoiceModalValue('api-fish-voice-id', voice.voiceId);
    setApiVoiceModalValue('api-fish-voice-endpoint', voice.voiceEndpoint);
    setApiVoiceModalValue('api-fish-voice-format', voice.voiceFormat);
    setApiVoiceModalValue('api-fish-voice-speed', voice.voiceSpeed);
}

function openApiFishAudioVoiceModal() {
    const modal = document.getElementById('api-fish-voice-modal');
    const resultEl = document.getElementById('api-fish-voice-test-result');
    if (!modal) return;
    if (resultEl) resultEl.innerHTML = '';
    fillApiFishAudioVoiceModal();
    modal.classList.remove('hidden');
}

function closeApiFishAudioVoiceModal() {
    document.getElementById('api-fish-voice-modal')?.classList.add('hidden');
}

function fillApiElevenLabsVoiceModal(api = getApiData().elevenLabsVoiceApi) {
    const voice = normalizeElevenLabsVoiceApiData(api);
    setApiVoiceModalValue('api-elevenlabs-voice-enabled', voice.enabled);
    setApiVoiceModalValue('api-elevenlabs-voice-name', voice.name);
    setApiVoiceModalValue('api-elevenlabs-voice-url', voice.baseUrl);
    setApiVoiceModalValue('api-elevenlabs-voice-key', voice.apiKey);
    setApiVoiceModalValue('api-elevenlabs-voice-model', voice.voiceModel);
    setApiVoiceModalValue('api-elevenlabs-voice-id', voice.voiceId);
    setApiVoiceModalValue('api-elevenlabs-voice-endpoint', voice.voiceEndpoint);
    setApiVoiceModalValue('api-elevenlabs-voice-format', voice.voiceFormat);
    setApiVoiceModalValue('api-elevenlabs-voice-stability', voice.stability);
    setApiVoiceModalValue('api-elevenlabs-voice-similarity', voice.similarityBoost);
    setApiVoiceModalValue('api-elevenlabs-voice-style', voice.style);
    setApiVoiceModalValue('api-elevenlabs-voice-boost', voice.useSpeakerBoost);
}

function openApiElevenLabsVoiceModal() {
    const modal = document.getElementById('api-elevenlabs-voice-modal');
    const resultEl = document.getElementById('api-elevenlabs-voice-test-result');
    if (!modal) return;
    if (resultEl) resultEl.innerHTML = '';
    fillApiElevenLabsVoiceModal();
    modal.classList.remove('hidden');
}

function closeApiElevenLabsVoiceModal() {
    document.getElementById('api-elevenlabs-voice-modal')?.classList.add('hidden');
}

function fillApiLocalVoiceModal(api = getApiData().localVoiceApi) {
    const voice = normalizeLocalVoiceApiData(api);
    setApiVoiceModalValue('api-local-voice-enabled', voice.enabled);
    setApiVoiceModalValue('api-local-voice-name', voice.name);
    setApiVoiceModalValue('api-local-voice-endpoint', voice.endpoint);
    setApiVoiceModalValue('api-local-voice-key', voice.apiKey);
    setApiVoiceModalValue('api-local-voice-model', voice.voiceModel);
    setApiVoiceModalValue('api-local-voice-id', voice.voiceId);
    setApiVoiceModalValue('api-local-voice-format', voice.voiceFormat);
}

function openApiLocalVoiceModal() {
    const modal = document.getElementById('api-local-voice-modal');
    const resultEl = document.getElementById('api-local-voice-test-result');
    if (!modal) return;
    if (resultEl) resultEl.innerHTML = '';
    fillApiLocalVoiceModal();
    modal.classList.remove('hidden');
}

function closeApiLocalVoiceModal() {
    document.getElementById('api-local-voice-modal')?.classList.add('hidden');
}

