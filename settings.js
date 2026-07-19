// --- ⚙️ settings.js: 设置 App (API 连接管理 + 字体设置) ---

const API_STORAGE_KEY = 'my_api_data';
const FONT_STORAGE_KEY = 'my_font_data';
const DEFAULT_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
let fontApplyToken = 0;

const FONT_PRESETS = [
    { id: 'system', name: '系统默认', family: DEFAULT_FONT_FAMILY, sample: '你好' },
    { id: 'serif', name: '衬线体', family: '"Noto Serif SC", "Songti SC", "SimSun", serif', sample: '你好' },
    { id: 'mono', name: '等宽体', family: '"JetBrains Mono", "Fira Code", "Consolas", monospace', sample: 'Code' },
    { id: 'rounded', name: '圆体', family: '"Yuanti SC", "HYYuanLiTiW", "Microsoft YaHei", sans-serif', sample: '你好' },
    { id: 'kai', name: '楷体', family: '"Kaiti SC", "STKaiti", "KaiTi", serif', sample: '你好' },
    { id: 'cursive', name: '手写体', family: '"Dancing Script", "Segoe Script", cursive', sample: 'Hello' },
];

// 1. 初始化
function initSettings() {
    renderApiList();
    renderPresetList();
    initFontSettings();
    if (typeof renderProactiveNotifySettings === 'function') renderProactiveNotifySettings();
}

// 2. 读取数据
function getApiData() {
    try {
        const raw = localStorage.getItem(API_STORAGE_KEY);
        if (raw) return normalizeApiData(JSON.parse(raw));
    } catch (e) { console.error(e); }
    return normalizeApiData({ apis: [], defaultId: null, imageDefaultId: null });
}

function saveApiData(data) {
    localStorage.setItem(API_STORAGE_KEY, JSON.stringify(normalizeApiData(data)));
}

function normalizeApiData(data) {
    data = data && typeof data === 'object' ? data : {};
    const apis = Array.isArray(data.apis) ? data.apis : [];
    const firstChatApi = apis.find(api => api && api.id && api.model);
    let defaultId = data.defaultId || (firstChatApi && firstChatApi.id) || null;
    if (defaultId && !apis.some(api => api.id === defaultId && api.model)) {
        defaultId = firstChatApi ? firstChatApi.id : null;
    }
    const firstImageApi = apis.find(api => api && api.id && api.imageModel);
    let imageDefaultId = data.imageDefaultId || data.imageApiId || (firstImageApi && firstImageApi.id) || null;
    if (imageDefaultId && !apis.some(api => api.id === imageDefaultId && api.imageModel)) {
        imageDefaultId = firstImageApi ? firstImageApi.id : null;
    }
    const voiceApi = normalizeVoiceApiData(data.voiceApi || data.minimaxVoiceApi || {});
    const openAiVoiceApi = normalizeOpenAiVoiceApiData(data.openAiVoiceApi || data.openaiVoiceApi || {});
    const elevenLabsVoiceApi = normalizeElevenLabsVoiceApiData(data.elevenLabsVoiceApi || data.elevenlabsVoiceApi || {});
    const localVoiceApi = normalizeLocalVoiceApiData(data.localVoiceApi || data.localTtsApi || {});
    return {
        ...data,
        apis,
        defaultId,
        imageDefaultId,
        voiceApi,
        openAiVoiceApi,
        elevenLabsVoiceApi,
        localVoiceApi,
        voiceDefaultProvider: normalizeVoiceDefaultProvider(
            data.voiceDefaultProvider,
            voiceApi,
            localVoiceApi,
            openAiVoiceApi,
            elevenLabsVoiceApi
        )
    };
}

function normalizeVoiceApiData(api) {
    api = api && typeof api === 'object' ? api : {};
    return {
        provider: 'minimax',
        enabled: !!api.enabled,
        name: api.name || 'MiniMax 语音',
        baseUrl: api.baseUrl || 'https://api.minimax.io',
        apiKey: api.apiKey || '',
        voiceModel: api.voiceModel || api.model || 'speech-2.8-turbo',
        voiceId: api.voiceId || '',
        voiceEndpoint: api.voiceEndpoint || '',
        voiceGroupId: api.voiceGroupId || '',
        voiceSpeed: api.voiceSpeed || '1',
        voiceVolume: api.voiceVolume || '1',
        voicePitch: api.voicePitch || '0',
        voiceFormat: api.voiceFormat || 'mp3',
        _status: api._status || ''
    };
}

function isApiVoiceEnabled(api) {
    const provider = api?.voiceProvider || api?.provider;
    return !!(
        api
        && provider === 'minimax'
        && api.enabled !== false
        && String(api.voiceModel || api.model || '').trim()
        && String(api.voiceId || '').trim()
    );
}

function getApiVoiceSummary(api) {
    const provider = api?.voiceProvider || api?.provider;
    if (!api || provider !== 'minimax') return '';
    const model = String(api.voiceModel || api.model || '').trim() || 'MiniMax';
    const voice = String(api.voiceId || '').trim();
    return voice ? `${model} · ${voice}` : `${model} · 未填音色`;
}

function normalizeOpenAiVoiceApiData(api) {
    api = api && typeof api === 'object' ? api : {};
    return {
        provider: 'openai',
        enabled: !!api.enabled,
        name: api.name || 'OpenAI TTS',
        baseUrl: api.baseUrl || 'https://api.openai.com/v1',
        apiKey: api.apiKey || '',
        voiceModel: api.voiceModel || api.model || 'gpt-4o-mini-tts',
        voiceId: api.voiceId || api.voice || 'alloy',
        voiceEndpoint: api.voiceEndpoint || '',
        voiceFormat: api.voiceFormat || api.format || 'mp3',
        instructions: api.instructions || '',
        _status: api._status || ''
    };
}

function isOpenAiVoiceEnabled(api) {
    const provider = api?.voiceProvider || api?.provider;
    return !!(
        api
        && provider === 'openai'
        && api.enabled !== false
        && String(api.apiKey || '').trim()
        && String(api.voiceModel || api.model || '').trim()
        && String(api.voiceId || api.voice || '').trim()
    );
}

function getOpenAiVoiceSummary(api) {
    if (!api) return '';
    const model = String(api.voiceModel || api.model || '').trim() || 'OpenAI';
    const voice = String(api.voiceId || api.voice || '').trim() || 'alloy';
    return `${model} · ${voice}`;
}

function normalizeElevenLabsVoiceApiData(api) {
    api = api && typeof api === 'object' ? api : {};
    return {
        provider: 'elevenlabs',
        enabled: !!api.enabled,
        name: api.name || 'ElevenLabs',
        baseUrl: api.baseUrl || 'https://api.elevenlabs.io',
        apiKey: api.apiKey || '',
        voiceModel: api.voiceModel || api.model || 'eleven_multilingual_v2',
        voiceId: api.voiceId || api.voice || '',
        voiceEndpoint: api.voiceEndpoint || '',
        voiceFormat: api.voiceFormat || api.format || 'mp3',
        stability: api.stability || '0.5',
        similarityBoost: api.similarityBoost || api.similarity_boost || '0.75',
        style: api.style || '0',
        useSpeakerBoost: api.useSpeakerBoost !== false,
        _status: api._status || ''
    };
}

function isElevenLabsVoiceEnabled(api) {
    const provider = api?.voiceProvider || api?.provider;
    return !!(
        api
        && provider === 'elevenlabs'
        && api.enabled !== false
        && String(api.apiKey || '').trim()
        && String(api.voiceId || api.voice || '').trim()
    );
}

function getElevenLabsVoiceSummary(api) {
    if (!api) return '';
    const model = String(api.voiceModel || api.model || '').trim() || 'ElevenLabs';
    const voice = String(api.voiceId || api.voice || '').trim();
    return voice ? `${model} · ${voice}` : `${model} · 未填音色`;
}

function normalizeLocalVoiceApiData(api) {
    api = api && typeof api === 'object' ? api : {};
    return {
        provider: 'local',
        enabled: !!api.enabled,
        name: api.name || '本地 TTS',
        endpoint: api.endpoint || api.voiceEndpoint || api.baseUrl || '',
        apiKey: api.apiKey || '',
        voiceModel: api.voiceModel || api.model || '',
        voiceId: api.voiceId || api.voice || '',
        voiceFormat: api.voiceFormat || api.format || 'wav',
        _status: api._status || ''
    };
}

function isLocalVoiceEnabled(api) {
    const provider = api?.voiceProvider || api?.provider;
    return !!(
        api
        && provider === 'local'
        && api.enabled !== false
        && String(api.endpoint || api.voiceEndpoint || '').trim()
    );
}

function getVoiceEndpointHost(endpoint) {
    const raw = String(endpoint || '').trim();
    if (!raw) return '未填接口';
    try {
        const url = new URL(raw, window.location.href);
        return url.host || raw;
    } catch (e) {
        return raw.replace(/^https?:\/\//i, '').split('/')[0] || raw;
    }
}

function getLocalVoiceSummary(api) {
    if (!api) return '';
    const host = getVoiceEndpointHost(api.endpoint || api.voiceEndpoint);
    const parts = [api.voiceModel, api.voiceId].map(v => String(v || '').trim()).filter(Boolean);
    return parts.length ? `${parts.join(' · ')} · ${host}` : host;
}

function normalizeVoiceDefaultProvider(provider, minimaxApi, localApi, openAiApi, elevenLabsApi) {
    const saved = ['minimax', 'openai', 'elevenlabs', 'local'].includes(provider) ? provider : '';
    if (saved === 'local' && isLocalVoiceEnabled(localApi)) return 'local';
    if (saved === 'minimax' && isApiVoiceEnabled(minimaxApi)) return 'minimax';
    if (saved === 'openai' && isOpenAiVoiceEnabled(openAiApi)) return 'openai';
    if (saved === 'elevenlabs' && isElevenLabsVoiceEnabled(elevenLabsApi)) return 'elevenlabs';
    if (isApiVoiceEnabled(minimaxApi)) return 'minimax';
    if (isOpenAiVoiceEnabled(openAiApi)) return 'openai';
    if (isElevenLabsVoiceEnabled(elevenLabsApi)) return 'elevenlabs';
    if (isLocalVoiceEnabled(localApi)) return 'local';
    return saved || 'minimax';
}

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
    const elevenLabsVoiceApi = normalizeElevenLabsVoiceApiData(data.elevenLabsVoiceApi);
    const localVoiceApi = normalizeLocalVoiceApiData(data.localVoiceApi);
    const voiceReady = isApiVoiceEnabled(voiceApi);
    const openAiVoiceReady = isOpenAiVoiceEnabled(openAiVoiceApi);
    const elevenLabsVoiceReady = isElevenLabsVoiceEnabled(elevenLabsVoiceApi);
    const localVoiceReady = isLocalVoiceEnabled(localVoiceApi);
    const voiceDefaultProvider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, voiceApi, localVoiceApi, openAiVoiceApi, elevenLabsVoiceApi);
    panel.innerHTML = `
        <div class="api-route-head">
            <div>
                <strong>API 工作台</strong>
                <span>聊天和生图走中转站 API；语音可以选 MiniMax 官方或本地 TTS，互不混用。</span>
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
                <span>生图 API</span>
                ${renderApiRoutePicker('image', imageApi, data.apis.filter(api => api.imageModel), data.imageDefaultId)}
            </div>
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

// 4. 打开编辑弹窗
function openApiModal(editId) {
    const modal = document.getElementById('api-edit-modal');
    const titleEl = document.getElementById('api-modal-title');
    const resultEl = document.getElementById('api-test-result');
    resultEl.innerHTML = '';

    if (editId) {
        // 编辑模式
        const data = getApiData();
        const api = data.apis.find(a => a.id === editId);
        if (!api) return;
        titleEl.textContent = '编辑 API';
        document.getElementById('api-edit-id').value = api.id;
        document.getElementById('api-edit-name').value = api.name || '';
        document.getElementById('api-edit-url').value = api.baseUrl || '';
        document.getElementById('api-edit-key').value = api.apiKey || '';
        // 模型：先恢复为 select，显示已保存的值
        restoreModelSelect();
        restoreImageModelSelect();
        const modelEl = document.getElementById('api-edit-model');
        modelEl.dataset.savedModel = api.model || '';
        if (api.model) {
            modelEl.innerHTML = `<option value="">不在这个 API 使用聊天</option><option value="${escapeHtml(api.model)}" selected>${escapeHtml(api.model)}</option><option value="__refresh_hint" disabled>重新测试可刷新列表</option>`;
            modelEl.disabled = false;
            modelEl.style.color = '#5a4a52';
            modelEl.style.background = '#faf5f0';
            modelEl.style.cursor = 'pointer';
            const hintEl = document.getElementById('api-model-hint');
            if (hintEl) hintEl.textContent = '重新测试可刷新列表';
        } else {
            modelEl.innerHTML = '<option value="" selected>不在这个 API 使用聊天</option><option value="__refresh_hint" disabled>重新测试可刷新列表</option>';
            modelEl.disabled = false;
            modelEl.style.color = '#5a4a52';
            modelEl.style.background = '#faf5f0';
            modelEl.style.cursor = 'pointer';
            const hintEl = document.getElementById('api-model-hint');
            if (hintEl) hintEl.textContent = '当前不用于聊天，重新测试可刷新列表';
        }
        const imageModelEl = document.getElementById('api-edit-image-model');
        imageModelEl.dataset.savedModel = api.imageModel || '';
        if (api.imageModel) {
            imageModelEl.innerHTML = `<option value="${escapeHtml(api.imageModel)}" selected>${escapeHtml(api.imageModel)}</option><option value="" disabled>重新测试可刷新列表</option>`;
            imageModelEl.disabled = false;
            imageModelEl.style.color = '#5a4a52';
            imageModelEl.style.background = '#faf5f0';
            imageModelEl.style.cursor = 'pointer';
            const hintEl = document.getElementById('api-image-model-hint');
            if (hintEl) hintEl.textContent = '重新测试可刷新列表';
        }
    } else {
        // 新增模式
        titleEl.textContent = '添加 API';
        document.getElementById('api-edit-id').value = '';
        document.getElementById('api-edit-name').value = '';
        document.getElementById('api-edit-url').value = '';
        document.getElementById('api-edit-key').value = '';
        restoreModelSelect();
        restoreImageModelSelect();
        const modelEl2 = document.getElementById('api-edit-model');
        modelEl2.dataset.savedModel = '';
        modelEl2.innerHTML = '<option value="">请先点测试按钮</option>';
        modelEl2.disabled = true;
        modelEl2.style.color = '#999';
        modelEl2.style.background = '#f0ebe6';
        modelEl2.style.cursor = 'not-allowed';
        const hintEl2 = document.getElementById('api-model-hint');
        if (hintEl2) hintEl2.textContent = '先测试连接再选~';
        const imageModelEl2 = document.getElementById('api-edit-image-model');
        imageModelEl2.dataset.savedModel = '';
        imageModelEl2.innerHTML = '<option value="">请先点测试按钮</option>';
        imageModelEl2.disabled = true;
        imageModelEl2.style.color = '#999';
        imageModelEl2.style.background = '#f0ebe6';
        imageModelEl2.style.cursor = 'not-allowed';
        const imageHintEl2 = document.getElementById('api-image-model-hint');
        if (imageHintEl2) imageHintEl2.textContent = '测试后从下拉列表选择';
    }

    modal.classList.remove('hidden');
    refreshApiModelPickers();
}

function closeApiModal() {
    closeApiFloatingPickers();
    document.getElementById('api-edit-modal').classList.add('hidden');
}

// 5. 保存 API
function saveApi() {
    const id = document.getElementById('api-edit-id').value;
    const name = document.getElementById('api-edit-name').value.trim();
    const baseUrl = document.getElementById('api-edit-url').value.trim();
    const apiKey = document.getElementById('api-edit-key').value.trim();
    const modelEl = document.getElementById('api-edit-model');
    const model = (modelEl.value || '').trim();
    const imageModelEl = document.getElementById('api-edit-image-model');
    const imageModel = (imageModelEl?.value || '').trim();

    if (!name) { alert('请填写名称'); return; }
    if (!baseUrl) { alert('请填写 Base URL'); return; }

    const data = getApiData();

    if (id) {
        // 更新
        const idx = data.apis.findIndex(a => a.id === id);
        if (idx >= 0) {
            data.apis[idx] = { ...data.apis[idx], name, baseUrl, apiKey, model, imageModel };
        }
    } else {
        // 新增
        const newApi = {
            id: 'api_' + Date.now(),
            name, baseUrl, apiKey, model, imageModel
        };
        data.apis.push(newApi);
        // 第一个可聊天 API 自动设为默认
        if (newApi.model && !data.defaultId) {
            data.defaultId = newApi.id;
        }
        if (newApi.imageModel && !data.imageDefaultId) data.imageDefaultId = newApi.id;
    }

    saveApiData(data);
    closeApiModal();
    renderApiList();
}

// 6. 删除 API
function deleteApi(apiId) {
    if (!confirm('确定删除这个 API 吗？')) return;

    const data = getApiData();
    data.apis = data.apis.filter(a => a.id !== apiId);
    if (data.defaultId === apiId) {
        const nextChatApi = data.apis.find(api => api.model);
        data.defaultId = nextChatApi ? nextChatApi.id : null;
    }
    if (data.imageDefaultId === apiId) {
        const nextImageApi = data.apis.find(api => api.imageModel);
        data.imageDefaultId = nextImageApi ? nextImageApi.id : null;
    }
    saveApiData(data);
    renderApiList();
}

// 7. 设为默认
function setDefaultApi(apiId) {
    const data = getApiData();
    const api = data.apis.find(a => a.id === apiId);
    if (!api || !api.model) {
        alert('这个 API 当前没有聊天模型。请先编辑它选择聊天模型，或者取消“不在这个 API 使用聊天”。');
        renderApiList();
        return;
    }
    data.defaultId = apiId;
    saveApiData(data);
    renderApiList();
}

function setDefaultImageApi(apiId) {
    const data = getApiData();
    const api = data.apis.find(a => a.id === apiId);
    if (!api || !api.imageModel) {
        alert('这个 API 还没有选择生图模型。请先编辑它，测试后从“生图模型”下拉里选一个，或者单独添加生图 API。');
        renderApiList();
        return;
    }
    data.imageDefaultId = apiId;
    saveApiData(data);
    renderApiList();
}

// 8. 测试 API（从列表）
async function testApiById(apiId) {
    const data = getApiData();
    const api = data.apis.find(a => a.id === apiId);
    if (!api) return;

    // 更新状态灯为 testing
    const card = document.querySelector(`.api-card[data-id="${apiId}"] .api-status-dot`);
    if (card) { card.className = 'api-status-dot testing'; }

    let result = await doTestApi(api.baseUrl, api.apiKey);
    if (!result.ok && isApiVoiceEnabled(api)) {
        result = await testMiniMaxVoiceApi(api);
    }

    // 更新状态
    const apiIdx = data.apis.findIndex(a => a.id === apiId);
    if (apiIdx >= 0) {
        data.apis[apiIdx]._status = result.ok ? 'online' : 'offline';
        saveApiData(data);
    }
    renderApiList();
}

// 9. 测试 API（从弹窗）— 一次请求同时拿模型列表
async function testApiFromModal() {
    const baseUrl = document.getElementById('api-edit-url').value.trim();
    const apiKey = document.getElementById('api-edit-key').value.trim();
    const resultEl = document.getElementById('api-test-result');
    let selectEl = document.getElementById('api-edit-model');
    let imageSelectEl = document.getElementById('api-edit-image-model');
    const hintEl = document.getElementById('api-model-hint');
    const imageHintEl = document.getElementById('api-image-model-hint');

    if (!baseUrl) {
        resultEl.innerHTML = '<span style="color:#f87171;">请先填写 Base URL</span>';
        return;
    }

    resultEl.innerHTML = '<span style="color:#fbbf24;">⏳ 测试中...</span>';
    restoreModelSelect();
    restoreImageModelSelect();
    selectEl = document.getElementById('api-edit-model');
    imageSelectEl = document.getElementById('api-edit-image-model');
    selectEl.disabled = true;
    selectEl.innerHTML = '<option value="">拉取中...</option>';
    selectEl.style.cursor = 'wait';
    imageSelectEl.disabled = true;
    imageSelectEl.innerHTML = '<option value="">拉取中...</option>';
    imageSelectEl.style.cursor = 'wait';
    refreshApiModelPickers();

    const result = await doTestApi(baseUrl, apiKey);

    if (result.ok) {
        resultEl.innerHTML = `<span style="color:#66d9a0;">✅ 连接成功！${result.detail || ''}</span>`;

        const models = result.models || [];
        if (models.length > 0) {
            const editingExistingApi = !!document.getElementById('api-edit-id').value;
            const prevModel = editingExistingApi
                ? (selectEl.dataset.savedModel || '')
                : (selectEl.dataset.savedModel || result.chatModel || '');
            selectEl.innerHTML = [
                `<option value="" ${prevModel ? '' : 'selected'}>不在这个 API 使用聊天</option>`,
                ...models.map(m => `<option value="${escapeHtml(m)}" ${m === prevModel ? 'selected' : ''}>${escapeHtml(m)}</option>`)
            ].join('');
            selectEl.disabled = false;
            selectEl.style.background = '#faf5f0';
            selectEl.style.color = '#5a4a52';
            selectEl.style.cursor = 'pointer';
            if (hintEl) hintEl.textContent = result.chatModel ? `${models.length} 个模型可选` : '未测到聊天能力，可只做生图 API';
            fillImageModelSelect(models);
            refreshApiModelPickers();
        } else {
            selectEl.innerHTML = '<option value="">未获取到模型列表</option>';
            if (hintEl) hintEl.textContent = '获取模型列表失败，可手动输入';
            convertModelToInput();
            convertImageModelToInput();
        }
    } else {
        resultEl.innerHTML = `<span style="color:#f87171;">❌ ${result.error || '连接失败'}</span>`;
        selectEl.innerHTML = '<option value="">连接失败</option>';
        selectEl.disabled = true;
        selectEl.style.cursor = 'not-allowed';
        imageSelectEl.innerHTML = '<option value="">连接失败</option>';
        imageSelectEl.disabled = true;
        imageSelectEl.style.cursor = 'not-allowed';
        if (imageHintEl) imageHintEl.textContent = '这个站点暂时不可用';
        refreshApiModelPickers();
    }
}

function getImageModelCandidates(models) {
    const list = Array.isArray(models) ? models.filter(Boolean) : [];
    const imageLike = list.filter(m => /(image|gpt-image|imagen|flux|dall|dall-e|stable|sdxl|sd-|seedream|jimeng|kolors|hidream|recraft|ideogram|qwen-image|wan)/i.test(m));
    return [...imageLike, ...list.filter(m => !imageLike.includes(m))];
}

function parseSettingsApiJsonResponseText(rawText) {
    const text = String(rawText || '').replace(/^\uFEFF/, '').trim();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (_) {
        const parsed = parseSettingsApiSseJsonText(text);
        if (parsed) return parsed;
        throw new Error('API 返回格式无法解析');
    }
}

function parseSettingsApiSseJsonText(text) {
    if (!/^\s*data\s*:/m.test(text)) return null;
    const events = [];
    let current = [];
    String(text || '').split(/\r?\n/).forEach(line => {
        if (/^\s*$/.test(line)) {
            if (current.length) {
                events.push(current.join('\n'));
                current = [];
            }
            return;
        }
        const match = line.match(/^\s*data\s*:\s?(.*)$/);
        if (match) current.push(match[1]);
    });
    if (current.length) events.push(current.join('\n'));

    const chunks = events.map(item => String(item || '').trim())
        .filter(item => item && item !== '[DONE]')
        .map(item => {
            try { return JSON.parse(item); } catch (_) { return null; }
        })
        .filter(Boolean);
    if (!chunks.length) return null;
    const content = chunks.map(chunk => {
        const choice = chunk?.choices?.[0] || {};
        return choice.delta?.content || choice.message?.content || choice.text || chunk.text || chunk.output_text || '';
    }).filter(Boolean).join('');
    if (content) {
        return {
            ...chunks[chunks.length - 1],
            choices: [{ message: { content } }]
        };
    }
    return chunks[chunks.length - 1] || chunks[0];
}

function fillImageModelSelect(models) {
    const imageSelectEl = document.getElementById('api-edit-image-model');
    if (!imageSelectEl) return;
    const imageHintEl = document.getElementById('api-image-model-hint');
    const sorted = getImageModelCandidates(models);
    const prevModel = imageSelectEl.dataset.savedModel || '';
    if (!sorted.length) {
        convertImageModelToInput();
        if (imageHintEl) imageHintEl.textContent = '没有模型列表，可手动输入或另加生图 API';
        return;
    }
    const hasImageLike = sorted.some(m => /(image|gpt-image|imagen|flux|dall|dall-e|stable|sdxl|sd-|seedream|jimeng|kolors|hidream|recraft|ideogram|qwen-image|wan)/i.test(m));
    imageSelectEl.innerHTML = [
        '<option value="">不在这个 API 使用生图</option>',
        ...sorted.map(m => `<option value="${escapeHtml(m)}" ${m === prevModel ? 'selected' : ''}>${escapeHtml(m)}</option>`)
    ].join('');
    imageSelectEl.disabled = false;
    imageSelectEl.style.background = '#faf5f0';
    imageSelectEl.style.color = '#5a4a52';
    imageSelectEl.style.cursor = 'pointer';
    if (imageHintEl) imageHintEl.textContent = hasImageLike ? '已把疑似生图模型排在前面' : '未识别到明显生图模型，可另加生图 API';
    refreshApiModelPickers();
}

function getApiVoiceConfigFromModal() {
    return {
        provider: 'minimax',
        enabled: !!document.getElementById('api-voice-enabled')?.checked,
        name: (document.getElementById('api-voice-name')?.value || '').trim() || 'MiniMax 语音',
        baseUrl: (document.getElementById('api-voice-url')?.value || '').trim(),
        apiKey: (document.getElementById('api-voice-key')?.value || '').trim(),
        voiceModel: (document.getElementById('api-voice-model')?.value || '').trim(),
        voiceId: (document.getElementById('api-voice-id')?.value || '').trim(),
        voiceEndpoint: (document.getElementById('api-voice-endpoint')?.value || '').trim(),
        voiceGroupId: (document.getElementById('api-voice-group-id')?.value || '').trim(),
        voiceSpeed: (document.getElementById('api-voice-speed')?.value || '').trim(),
        voiceVolume: (document.getElementById('api-voice-volume')?.value || '').trim(),
        voicePitch: (document.getElementById('api-voice-pitch')?.value || '').trim(),
        voiceFormat: (document.getElementById('api-voice-format')?.value || '').trim()
    };
}

function getApiOpenAiVoiceConfigFromModal() {
    return {
        provider: 'openai',
        enabled: !!document.getElementById('api-openai-voice-enabled')?.checked,
        name: (document.getElementById('api-openai-voice-name')?.value || '').trim() || 'OpenAI TTS',
        baseUrl: (document.getElementById('api-openai-voice-url')?.value || '').trim(),
        apiKey: (document.getElementById('api-openai-voice-key')?.value || '').trim(),
        voiceModel: (document.getElementById('api-openai-voice-model')?.value || '').trim(),
        voiceId: (document.getElementById('api-openai-voice-id')?.value || '').trim(),
        voiceEndpoint: (document.getElementById('api-openai-voice-endpoint')?.value || '').trim(),
        voiceFormat: (document.getElementById('api-openai-voice-format')?.value || '').trim() || 'mp3',
        instructions: (document.getElementById('api-openai-voice-instructions')?.value || '').trim()
    };
}

function getApiElevenLabsVoiceConfigFromModal() {
    return {
        provider: 'elevenlabs',
        enabled: !!document.getElementById('api-elevenlabs-voice-enabled')?.checked,
        name: (document.getElementById('api-elevenlabs-voice-name')?.value || '').trim() || 'ElevenLabs',
        baseUrl: (document.getElementById('api-elevenlabs-voice-url')?.value || '').trim(),
        apiKey: (document.getElementById('api-elevenlabs-voice-key')?.value || '').trim(),
        voiceModel: (document.getElementById('api-elevenlabs-voice-model')?.value || '').trim(),
        voiceId: (document.getElementById('api-elevenlabs-voice-id')?.value || '').trim(),
        voiceEndpoint: (document.getElementById('api-elevenlabs-voice-endpoint')?.value || '').trim(),
        voiceFormat: (document.getElementById('api-elevenlabs-voice-format')?.value || '').trim() || 'mp3',
        stability: (document.getElementById('api-elevenlabs-voice-stability')?.value || '').trim(),
        similarityBoost: (document.getElementById('api-elevenlabs-voice-similarity')?.value || '').trim(),
        style: (document.getElementById('api-elevenlabs-voice-style')?.value || '').trim(),
        useSpeakerBoost: !!document.getElementById('api-elevenlabs-voice-boost')?.checked
    };
}

function getApiLocalVoiceConfigFromModal() {
    return {
        provider: 'local',
        enabled: !!document.getElementById('api-local-voice-enabled')?.checked,
        name: (document.getElementById('api-local-voice-name')?.value || '').trim() || '本地 TTS',
        endpoint: (document.getElementById('api-local-voice-endpoint')?.value || '').trim(),
        apiKey: (document.getElementById('api-local-voice-key')?.value || '').trim(),
        voiceModel: (document.getElementById('api-local-voice-model')?.value || '').trim(),
        voiceId: (document.getElementById('api-local-voice-id')?.value || '').trim(),
        voiceFormat: (document.getElementById('api-local-voice-format')?.value || '').trim() || 'wav'
    };
}

function normalizeMiniMaxBaseUrl(baseUrl) {
    const base = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return 'https://api.minimax.io';
    return base;
}

function buildMiniMaxVoiceEndpoint(api) {
    const explicit = String(api?.voiceEndpoint || '').trim();
    let endpoint = explicit || '';
    if (!endpoint) {
        const base = normalizeMiniMaxBaseUrl(api?.baseUrl);
        endpoint = /\/t2a_v2$/i.test(base) ? base : (/\/v1$/i.test(base) ? `${base}/t2a_v2` : `${base}/v1/t2a_v2`);
    }
    const groupId = String(api?.voiceGroupId || '').trim();
    if (!groupId) return endpoint;
    const join = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${join}GroupId=${encodeURIComponent(groupId)}`;
}

function normalizeOpenAiBaseUrl(baseUrl) {
    const base = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return 'https://api.openai.com/v1';
    return base;
}

function buildOpenAiVoiceEndpoint(api) {
    const explicit = String(api?.voiceEndpoint || '').trim();
    if (explicit) return explicit;
    const base = normalizeOpenAiBaseUrl(api?.baseUrl);
    return /\/audio\/speech$/i.test(base) ? base : (/\/v1$/i.test(base) ? `${base}/audio/speech` : `${base}/v1/audio/speech`);
}

function normalizeElevenLabsBaseUrl(baseUrl) {
    const base = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return 'https://api.elevenlabs.io';
    return base;
}

function buildElevenLabsVoiceEndpoint(api) {
    const explicit = String(api?.voiceEndpoint || '').trim();
    if (explicit) return explicit;
    const base = normalizeElevenLabsBaseUrl(api?.baseUrl);
    const voiceId = encodeURIComponent(String(api?.voiceId || api?.voice || '').trim());
    const root = /\/v1$/i.test(base) ? base : `${base}/v1`;
    return `${root}/text-to-speech/${voiceId}`;
}

function getMiniMaxAudioMime(format) {
    const normalized = String(format || 'mp3').toLowerCase();
    if (normalized === 'opus') return 'audio/ogg';
    if (normalized === 'aac') return 'audio/aac';
    if (normalized === 'flac') return 'audio/flac';
    if (normalized === 'webm') return 'audio/webm';
    if (normalized === 'wav') return 'audio/wav';
    if (normalized === 'pcm') return 'audio/L16';
    return 'audio/mpeg';
}

function clampMiniMaxNumber(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
}

function decodeMiniMaxAudioData(audio, format) {
    const raw = String(audio || '').trim();
    if (!raw) throw new Error('MiniMax 没有返回音频数据');
    if (/^data:audio\//i.test(raw)) return raw;
    const mime = getMiniMaxAudioMime(format);
    const compact = raw.replace(/\s+/g, '');
    if (/^[0-9a-fA-F]+$/.test(compact) && compact.length % 2 === 0) {
        const bytes = new Uint8Array(compact.length / 2);
        for (let i = 0; i < compact.length; i += 2) {
            bytes[i / 2] = parseInt(compact.slice(i, i + 2), 16);
        }
        return `data:${mime};base64,${bytesToBase64(bytes)}`;
    }
    return `data:${mime};base64,${compact}`;
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('音频读取失败'));
        reader.readAsDataURL(blob);
    });
}

async function requestMiniMaxVoiceAudio(text, apiConfig) {
    const api = apiConfig || normalizeVoiceApiData(getApiData().voiceApi);
    const content = String(text || '').trim();
    if (!content) throw new Error('语音文本为空');
    if (!isApiVoiceEnabled(api)) throw new Error('还没有配置可用的 MiniMax 语音 API');
    if (!api.apiKey) throw new Error('MiniMax 语音需要 API Key');

    const format = api.voiceFormat || 'mp3';
    const resp = await fetch(buildMiniMaxVoiceEndpoint(api), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${api.apiKey}`
        },
        body: JSON.stringify({
            model: api.voiceModel || api.model,
            text: content,
            stream: false,
            language_boost: 'auto',
            output_format: 'hex',
            voice_setting: {
                voice_id: api.voiceId,
                speed: clampMiniMaxNumber(api.voiceSpeed, 1, 0.5, 2),
                vol: clampMiniMaxNumber(api.voiceVolume, 1, 0, 10),
                pitch: clampMiniMaxNumber(api.voicePitch, 0, -12, 12)
            },
            audio_setting: {
                sample_rate: 32000,
                bitrate: 128000,
                format,
                channel: 1
            }
        }),
        signal: AbortSignal.timeout(30000)
    });

    const rawText = await resp.text();
    let json = {};
    try { json = rawText ? JSON.parse(rawText) : {}; } catch (e) {}
    if (!resp.ok) {
        const detail = json?.base_resp?.status_msg || json?.message || json?.error?.message || rawText || `HTTP ${resp.status}`;
        throw new Error(String(detail).slice(0, 180));
    }
    const code = json?.base_resp?.status_code ?? json?.baseResp?.statusCode ?? 0;
    if (code && Number(code) !== 0) {
        throw new Error(json?.base_resp?.status_msg || json?.baseResp?.statusMsg || `MiniMax status ${code}`);
    }
    const audio = json?.data?.audio || json?.data?.audio_content || json?.audio || '';
    const audioUrl = decodeMiniMaxAudioData(audio, format);
    const rawLength = Number(json?.extra_info?.audio_length || json?.extra_info?.audioLength || 0);
    const duration = rawLength > 1000 ? Math.round(rawLength / 1000) : Math.round(rawLength || estimateTextAudioDuration(content));
    return {
        audioUrl,
        mimeType: getMiniMaxAudioMime(format),
        duration: Math.max(1, Math.min(5999, duration)),
        raw: json
    };
}

async function requestOpenAiVoiceAudio(text, apiConfig) {
    const api = normalizeOpenAiVoiceApiData(apiConfig);
    const content = String(text || '').trim();
    if (!content) throw new Error('语音文本为空');
    if (!isOpenAiVoiceEnabled(api)) throw new Error('还没有配置可用的 OpenAI TTS');

    const format = api.voiceFormat || 'mp3';
    const body = {
        model: api.voiceModel || api.model,
        voice: api.voiceId || api.voice || 'alloy',
        input: content,
        response_format: format
    };
    if (api.instructions) body.instructions = api.instructions;

    const resp = await fetch(buildOpenAiVoiceEndpoint(api), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${api.apiKey}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
    });

    const contentType = resp.headers.get('content-type') || '';
    if (/^(audio\/|application\/octet-stream)/i.test(contentType)) {
        if (!resp.ok) throw new Error(`OpenAI TTS HTTP ${resp.status}`);
        const blob = await resp.blob();
        return {
            audioUrl: await blobToDataUrl(blob),
            mimeType: blob.type || contentType.split(';')[0] || getMiniMaxAudioMime(format),
            duration: estimateTextAudioDuration(content),
            raw: null
        };
    }

    const rawText = await resp.text();
    let json = {};
    try { json = rawText ? JSON.parse(rawText) : {}; } catch (e) {}
    if (!resp.ok) {
        const detail = json?.error?.message || json?.message || rawText || `HTTP ${resp.status}`;
        throw new Error(String(detail).slice(0, 180));
    }
    const audio = json?.data?.audio || json?.audio || json?.audio_base64 || json?.audioBase64 || '';
    const audioUrl = json?.audio_url || json?.audioUrl || json?.url || json?.data?.url || '';
    if (audioUrl) return { audioUrl, mimeType: getMiniMaxAudioMime(format), duration: estimateTextAudioDuration(content), raw: json };
    if (!audio) throw new Error('OpenAI TTS 没有返回音频数据');
    return {
        audioUrl: decodeMiniMaxAudioData(audio, format),
        mimeType: getMiniMaxAudioMime(format),
        duration: estimateTextAudioDuration(content),
        raw: json
    };
}

async function requestElevenLabsVoiceAudio(text, apiConfig) {
    const api = normalizeElevenLabsVoiceApiData(apiConfig);
    const content = String(text || '').trim();
    if (!content) throw new Error('语音文本为空');
    if (!isElevenLabsVoiceEnabled(api)) throw new Error('还没有配置可用的 ElevenLabs');

    const format = api.voiceFormat || 'mp3';
    const resp = await fetch(buildElevenLabsVoiceEndpoint(api), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg, audio/*, application/json',
            'xi-api-key': api.apiKey
        },
        body: JSON.stringify({
            text: content,
            model_id: api.voiceModel || api.model || 'eleven_multilingual_v2',
            voice_settings: {
                stability: clampMiniMaxNumber(api.stability, 0.5, 0, 1),
                similarity_boost: clampMiniMaxNumber(api.similarityBoost, 0.75, 0, 1),
                style: clampMiniMaxNumber(api.style, 0, 0, 1),
                use_speaker_boost: api.useSpeakerBoost !== false
            }
        }),
        signal: AbortSignal.timeout(30000)
    });

    const contentType = resp.headers.get('content-type') || '';
    if (/^(audio\/|application\/octet-stream)/i.test(contentType)) {
        if (!resp.ok) throw new Error(`ElevenLabs HTTP ${resp.status}`);
        const blob = await resp.blob();
        return {
            audioUrl: await blobToDataUrl(blob),
            mimeType: blob.type || contentType.split(';')[0] || getMiniMaxAudioMime(format),
            duration: estimateTextAudioDuration(content),
            raw: null
        };
    }

    const rawText = await resp.text();
    let json = {};
    try { json = rawText ? JSON.parse(rawText) : {}; } catch (e) {}
    if (!resp.ok) {
        const detail = json?.detail?.message || json?.message || json?.error?.message || rawText || `HTTP ${resp.status}`;
        throw new Error(String(detail).slice(0, 180));
    }
    const audioUrl = json?.audio_url || json?.audioUrl || json?.url || json?.data?.url || json?.data?.audio_url || '';
    if (audioUrl) return { audioUrl, mimeType: getMiniMaxAudioMime(format), duration: estimateTextAudioDuration(content), raw: json };
    const audio = json?.audio || json?.audio_base64 || json?.audioBase64 || json?.data?.audio || json?.data?.audio_base64 || '';
    if (!audio) throw new Error('ElevenLabs 没有返回音频数据');
    return {
        audioUrl: decodeMiniMaxAudioData(audio, format),
        mimeType: getMiniMaxAudioMime(format),
        duration: estimateTextAudioDuration(content),
        raw: json
    };
}

async function requestLocalVoiceAudio(text, apiConfig) {
    const api = normalizeLocalVoiceApiData(apiConfig);
    const content = String(text || '').trim();
    if (!content) throw new Error('语音文本为空');
    if (!isLocalVoiceEnabled(api)) throw new Error('还没有配置可用的本地 TTS 接口');

    const format = api.voiceFormat || 'wav';
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, audio/*'
    };
    if (api.apiKey) headers.Authorization = `Bearer ${api.apiKey}`;

    const resp = await fetch(api.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            text: content,
            input: content,
            model: api.voiceModel || '',
            voice: api.voiceId || '',
            voice_id: api.voiceId || '',
            format,
            response_format: format,
            voice_setting: { voice_id: api.voiceId || '' },
            audio_setting: { format }
        }),
        signal: AbortSignal.timeout(30000)
    });

    const contentType = resp.headers.get('content-type') || '';
    if (/^(audio\/|application\/octet-stream)/i.test(contentType)) {
        if (!resp.ok) throw new Error(`本地 TTS HTTP ${resp.status}`);
        const blob = await resp.blob();
        return {
            audioUrl: await blobToDataUrl(blob),
            mimeType: blob.type || contentType.split(';')[0] || getMiniMaxAudioMime(format),
            duration: estimateTextAudioDuration(content),
            raw: null
        };
    }

    const rawText = await resp.text();
    let json = {};
    try { json = rawText ? JSON.parse(rawText) : {}; } catch (e) {}
    if (!resp.ok) {
        const detail = json?.message || json?.error?.message || json?.error || rawText || `HTTP ${resp.status}`;
        throw new Error(String(detail).slice(0, 180));
    }

    const audioUrl = json?.data?.audio_url || json?.data?.audioUrl || json?.audio_url || json?.audioUrl || json?.url || json?.data?.url || '';
    if (audioUrl) {
        return {
            audioUrl,
            mimeType: getMiniMaxAudioMime(format),
            duration: Number(json?.duration || json?.data?.duration || 0) || estimateTextAudioDuration(content),
            raw: json
        };
    }

    const audio = json?.data?.audio || json?.data?.audio_base64 || json?.data?.audioBase64 || json?.audio || json?.audio_base64 || json?.audioBase64 || '';
    if (!audio) throw new Error('本地 TTS 没有返回音频数据');
    return {
        audioUrl: decodeMiniMaxAudioData(audio, format),
        mimeType: getMiniMaxAudioMime(format),
        duration: Number(json?.duration || json?.data?.duration || 0) || estimateTextAudioDuration(content),
        raw: json
    };
}

async function requestDefaultVoiceAudio(text) {
    const api = getDefaultVoiceApi();
    if (!api) throw new Error('还没有配置可用的语音 API');
    const provider = api.provider || api.voiceProvider;
    if (provider === 'local') return requestLocalVoiceAudio(text, api);
    if (provider === 'openai') return requestOpenAiVoiceAudio(text, api);
    if (provider === 'elevenlabs') return requestElevenLabsVoiceAudio(text, api);
    return requestMiniMaxVoiceAudio(text, api);
}

function estimateTextAudioDuration(text) {
    const cjk = (String(text || '').match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
    const ascii = String(text || '').replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ');
    const words = (ascii.match(/[A-Za-z0-9]+/g) || []).length;
    return Math.max(1, Math.ceil((cjk + words * 2) / 4));
}

async function testMiniMaxVoiceApi(api) {
    try {
        await requestMiniMaxVoiceAudio('你好，这是 MiniMax 语音测试。', api);
        return { ok: true, detail: '(MiniMax 语音可用)', models: [], chatModel: '' };
    } catch (e) {
        return { ok: false, error: `MiniMax 语音失败：${e.message || e}`, models: [] };
    }
}

async function testOpenAiVoiceApi(api) {
    try {
        await requestOpenAiVoiceAudio('你好，这是 OpenAI 语音测试。', api);
        return { ok: true, detail: '(OpenAI TTS 可用)', models: [], chatModel: '' };
    } catch (e) {
        return { ok: false, error: `OpenAI TTS 失败：${e.message || e}`, models: [] };
    }
}

async function testElevenLabsVoiceApi(api) {
    try {
        await requestElevenLabsVoiceAudio('你好，这是 ElevenLabs 语音测试。', api);
        return { ok: true, detail: '(ElevenLabs 可用)', models: [], chatModel: '' };
    } catch (e) {
        return { ok: false, error: `ElevenLabs 失败：${e.message || e}`, models: [] };
    }
}

async function testLocalVoiceApi(api) {
    try {
        await requestLocalVoiceAudio('你好，这是本地语音测试。', api);
        return { ok: true, detail: '(本地 TTS 可用)', models: [], chatModel: '' };
    } catch (e) {
        return { ok: false, error: `本地 TTS 失败：${e.message || e}`, models: [] };
    }
}

async function testVoiceApiFromModal() {
    const resultEl = document.getElementById('api-voice-test-result') || document.getElementById('api-test-result');
    const api = getApiVoiceConfigFromModal();
    if (!resultEl) return;
    if (!api.baseUrl) {
        resultEl.innerHTML = '<span style="color:#f87171;">请先填写 Base URL</span>';
        return;
    }
    const testApi = { ...api, enabled: true };
    if (!isApiVoiceEnabled(testApi)) {
        resultEl.innerHTML = '<span style="color:#f87171;">请先填写模型和音色 ID</span>';
        return;
    }
    resultEl.innerHTML = '<span style="color:#fbbf24;">⏳ 正在请求 MiniMax 语音...</span>';
    try {
        const result = await requestMiniMaxVoiceAudio('你好，这是 MiniMax 语音测试。', testApi);
        resultEl.innerHTML = '<span style="color:#66d9a0;">✅ MiniMax 语音可用，已试听测试音频</span>';
        const audio = new Audio(result.audioUrl);
        audio.play().catch(() => {});
    } catch (e) {
        resultEl.innerHTML = `<span style="color:#f87171;">❌ ${escapeHtml(e.message || 'MiniMax 语音测试失败')}</span>`;
    }
}

async function testOpenAiVoiceApiFromModal() {
    const resultEl = document.getElementById('api-openai-voice-test-result');
    const api = getApiOpenAiVoiceConfigFromModal();
    if (!resultEl) return;
    if (!api.baseUrl && !api.voiceEndpoint) {
        resultEl.innerHTML = '<span style="color:#f87171;">请先填写 OpenAI Base URL</span>';
        return;
    }
    const testApi = { ...api, enabled: true };
    if (!isOpenAiVoiceEnabled(testApi)) {
        resultEl.innerHTML = '<span style="color:#f87171;">请先填写 API Key、模型和音色</span>';
        return;
    }
    resultEl.innerHTML = '<span style="color:#fbbf24;">⏳ 正在请求 OpenAI TTS...</span>';
    try {
        const result = await requestOpenAiVoiceAudio('你好，这是 OpenAI 语音测试。', testApi);
        resultEl.innerHTML = '<span style="color:#66d9a0;">✅ OpenAI TTS 可用，已试听测试音频</span>';
        const audio = new Audio(result.audioUrl);
        audio.play().catch(() => {});
    } catch (e) {
        resultEl.innerHTML = `<span style="color:#f87171;">❌ ${escapeHtml(e.message || 'OpenAI TTS 测试失败')}</span>`;
    }
}

async function testElevenLabsVoiceApiFromModal() {
    const resultEl = document.getElementById('api-elevenlabs-voice-test-result');
    const api = getApiElevenLabsVoiceConfigFromModal();
    if (!resultEl) return;
    if (!api.baseUrl && !api.voiceEndpoint) {
        resultEl.innerHTML = '<span style="color:#f87171;">请先填写 ElevenLabs Base URL</span>';
        return;
    }
    const testApi = { ...api, enabled: true };
    if (!isElevenLabsVoiceEnabled(testApi)) {
        resultEl.innerHTML = '<span style="color:#f87171;">请先填写 API Key 和 Voice ID</span>';
        return;
    }
    resultEl.innerHTML = '<span style="color:#fbbf24;">⏳ 正在请求 ElevenLabs...</span>';
    try {
        const result = await requestElevenLabsVoiceAudio('你好，这是 ElevenLabs 语音测试。', testApi);
        resultEl.innerHTML = '<span style="color:#66d9a0;">✅ ElevenLabs 可用，已试听测试音频</span>';
        const audio = new Audio(result.audioUrl);
        audio.play().catch(() => {});
    } catch (e) {
        resultEl.innerHTML = `<span style="color:#f87171;">❌ ${escapeHtml(e.message || 'ElevenLabs 测试失败')}</span>`;
    }
}

async function testLocalVoiceApiFromModal() {
    const resultEl = document.getElementById('api-local-voice-test-result');
    const api = getApiLocalVoiceConfigFromModal();
    if (!resultEl) return;
    if (!api.endpoint) {
        resultEl.innerHTML = '<span style="color:#f87171;">请先填写本地 HTTP Endpoint</span>';
        return;
    }
    const testApi = { ...api, enabled: true };
    resultEl.innerHTML = '<span style="color:#fbbf24;">⏳ 正在请求本地 TTS...</span>';
    try {
        const result = await requestLocalVoiceAudio('你好，这是本地语音测试。', testApi);
        resultEl.innerHTML = '<span style="color:#66d9a0;">✅ 本地 TTS 可用，已试听测试音频</span>';
        const audio = new Audio(result.audioUrl);
        audio.play().catch(() => {});
    } catch (e) {
        resultEl.innerHTML = `<span style="color:#f87171;">❌ ${escapeHtml(e.message || '本地 TTS 测试失败')}</span>`;
    }
}

function saveApiVoiceSettings() {
    const resultEl = document.getElementById('api-voice-test-result');
    const voiceApi = normalizeVoiceApiData(getApiVoiceConfigFromModal());
    if (voiceApi.enabled) {
        if (!voiceApi.baseUrl) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写 MiniMax 官方 Base URL</span>';
            return;
        }
        if (!voiceApi.apiKey) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写 MiniMax API Key</span>';
            return;
        }
        if (!voiceApi.voiceModel || !voiceApi.voiceId) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写语音模型和音色 ID</span>';
            return;
        }
    }
    const data = getApiData();
    data.voiceApi = voiceApi;
    data.voiceDefaultProvider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, voiceApi, data.localVoiceApi, data.openAiVoiceApi, data.elevenLabsVoiceApi);
    saveApiData(data);
    closeApiVoiceModal();
    renderApiList();
}

function saveApiOpenAiVoiceSettings() {
    const resultEl = document.getElementById('api-openai-voice-test-result');
    const openAiVoiceApi = normalizeOpenAiVoiceApiData(getApiOpenAiVoiceConfigFromModal());
    if (openAiVoiceApi.enabled) {
        if (!openAiVoiceApi.baseUrl && !openAiVoiceApi.voiceEndpoint) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写 OpenAI Base URL</span>';
            return;
        }
        if (!openAiVoiceApi.apiKey) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写 OpenAI API Key</span>';
            return;
        }
        if (!openAiVoiceApi.voiceModel || !openAiVoiceApi.voiceId) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写模型和音色</span>';
            return;
        }
    }
    const data = getApiData();
    data.openAiVoiceApi = openAiVoiceApi;
    data.voiceDefaultProvider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, data.voiceApi, data.localVoiceApi, openAiVoiceApi, data.elevenLabsVoiceApi);
    saveApiData(data);
    closeApiOpenAiVoiceModal();
    renderApiList();
}

function saveApiElevenLabsVoiceSettings() {
    const resultEl = document.getElementById('api-elevenlabs-voice-test-result');
    const elevenLabsVoiceApi = normalizeElevenLabsVoiceApiData(getApiElevenLabsVoiceConfigFromModal());
    if (elevenLabsVoiceApi.enabled) {
        if (!elevenLabsVoiceApi.baseUrl && !elevenLabsVoiceApi.voiceEndpoint) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写 ElevenLabs Base URL</span>';
            return;
        }
        if (!elevenLabsVoiceApi.apiKey) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写 ElevenLabs API Key</span>';
            return;
        }
        if (!elevenLabsVoiceApi.voiceId) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写 Voice ID</span>';
            return;
        }
    }
    const data = getApiData();
    data.elevenLabsVoiceApi = elevenLabsVoiceApi;
    data.voiceDefaultProvider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, data.voiceApi, data.localVoiceApi, data.openAiVoiceApi, elevenLabsVoiceApi);
    saveApiData(data);
    closeApiElevenLabsVoiceModal();
    renderApiList();
}

function saveApiLocalVoiceSettings() {
    const resultEl = document.getElementById('api-local-voice-test-result');
    const localVoiceApi = normalizeLocalVoiceApiData(getApiLocalVoiceConfigFromModal());
    if (localVoiceApi.enabled && !localVoiceApi.endpoint) {
        if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写本地 HTTP Endpoint</span>';
        return;
    }
    const data = getApiData();
    data.localVoiceApi = localVoiceApi;
    data.voiceDefaultProvider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, data.voiceApi, localVoiceApi, data.openAiVoiceApi, data.elevenLabsVoiceApi);
    saveApiData(data);
    closeApiLocalVoiceModal();
    renderApiList();
}

function setDefaultVoiceProvider(provider) {
    const data = getApiData();
    const voiceApi = normalizeVoiceApiData(data.voiceApi);
    const openAiVoiceApi = normalizeOpenAiVoiceApiData(data.openAiVoiceApi);
    const elevenLabsVoiceApi = normalizeElevenLabsVoiceApiData(data.elevenLabsVoiceApi);
    const localVoiceApi = normalizeLocalVoiceApiData(data.localVoiceApi);
    if (provider === 'minimax' && !isApiVoiceEnabled(voiceApi)) {
        alert('MiniMax 语音还没有配置完整。');
        renderApiList();
        return;
    }
    if (provider === 'openai' && !isOpenAiVoiceEnabled(openAiVoiceApi)) {
        alert('OpenAI TTS 还没有配置完整。');
        renderApiList();
        return;
    }
    if (provider === 'elevenlabs' && !isElevenLabsVoiceEnabled(elevenLabsVoiceApi)) {
        alert('ElevenLabs 还没有配置完整。');
        renderApiList();
        return;
    }
    if (provider === 'local' && !isLocalVoiceEnabled(localVoiceApi)) {
        alert('本地 TTS 还没有配置可用 Endpoint。');
        renderApiList();
        return;
    }
    data.voiceDefaultProvider = provider;
    saveApiData(data);
    renderApiList();
}

// 降级：模型选择框变成输入框
function convertModelToInput() {
    const selectEl = document.getElementById('api-edit-model');
    if (!selectEl || selectEl.tagName === 'INPUT') return;
    removeApiModelPicker('api-edit-model');
    const parent = selectEl.parentNode;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'api-edit-model';
    input.placeholder = '手动输入模型名';
    input.style.cssText = 'width:100%; background:#faf5f0; border:1px solid rgba(248,164,184,0.2); border-radius:14px; padding:10px; font-size:14px; color:#5a4a52; outline:none;';
    input.value = selectEl.dataset.savedModel || '';
    parent.replaceChild(input, selectEl);
}

function convertImageModelToInput() {
    const selectEl = document.getElementById('api-edit-image-model');
    if (!selectEl || selectEl.tagName === 'INPUT') return;
    removeApiModelPicker('api-edit-image-model');
    const parent = selectEl.parentNode;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'api-edit-image-model';
    input.placeholder = '手动输入生图模型名，或留空后另加生图 API';
    input.style.cssText = 'width:100%; background:#faf5f0; border:1px solid rgba(248,164,184,0.2); border-radius:14px; padding:10px; font-size:14px; color:#5a4a52; outline:none;';
    input.value = selectEl.dataset.savedModel || '';
    parent.replaceChild(input, selectEl);
}

function isNvidiaApiBaseUrl(baseUrl) {
    return /(^|\/\/|\.)(nvidia\.com|integrate\.api\.nvidia\.com)(\/|$)/i.test(String(baseUrl || ''));
}

function getApiProxyHint(baseUrl) {
    if (isNvidiaApiBaseUrl(baseUrl)) {
        return 'NVIDIA 接口通常不允许浏览器静态网页直连。请走 BYND AI Proxy Worker：Worker 不保存 key；网页 Base URL 填 Worker 地址，API Key 继续填用户自己的 NVIDIA key。';
    }
    return '这个接口可能不允许浏览器直连。请换成支持 CORS 的 OpenAI 兼容中转站，或走 BYND AI Proxy Worker。';
}

// 10. 核心测试逻辑 — 一次请求返回连接状态+模型列表
async function doTestApi(baseUrl, apiKey) {
    baseUrl = baseUrl.replace(/\/+$/, '');

    const headers = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    // 尝试 /models 接口
    try {
        const resp = await fetch(baseUrl + '/models', {
            method: 'GET',
            headers: headers,
            signal: AbortSignal.timeout(10000)
        });
        if (resp.ok) {
            let models = [];
            try {
                const rawText = await resp.text();
                const json = parseSettingsApiJsonResponseText(rawText);
                if (json.data && Array.isArray(json.data)) {
                    models = json.data.map(m => m.id || m.name || '').filter(Boolean).sort();
                }
            } catch (parseErr) { /* JSON 解析失败，但连接是通的 */ }
            const count = models.length;
            if (count === 0) return { ok: true, detail: '', models: models };

            const probe = await probeChatModels(baseUrl, apiKey, models);
            if (probe.ok) {
                const sortedModels = [probe.model, ...models.filter(m => m !== probe.model)];
                return { ok: true, detail: `(${count} 个模型，可聊天: ${probe.model})`, models: sortedModels, chatModel: probe.model };
            }
            const imageCandidates = getImageModelCandidates(models);
            const hasImageLike = imageCandidates.some(m => /(image|gpt-image|imagen|flux|dall|dall-e|stable|sdxl|sd-|seedream|jimeng|kolors|hidream|recraft|ideogram|qwen-image|wan)/i.test(m));
            if (hasImageLike) {
                return { ok: true, detail: `(${count} 个模型，未测到聊天模型，可作为生图 API)`, models: imageCandidates, chatModel: '' };
            }
            return { ok: true, detail: `(${count} 个模型，聊天探测未通过，可手动选择)`, models: models, chatModel: '' };
        }
        if (resp.status === 401) return { ok: false, error: 'API Key 无效 (401)', models: [] };
        if (resp.status === 403) return { ok: false, error: '没有权限 (403)', models: [] };
        return { ok: false, error: `HTTP ${resp.status}`, models: [] };
    } catch (e) {
        const msg = (e.name === 'AbortError' || e.message === 'The operation was aborted') ? '连接超时' : (e.message || '无法连接');
        const corsLike = /failed to fetch|network|load failed|无法连接|fetch/i.test(msg);
        return { ok: false, error: corsLike ? `${msg}。${getApiProxyHint(baseUrl)}` : msg, models: [] };
    }
}

async function probeChatModels(baseUrl, apiKey, models) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const candidates = models
        .filter(m => !/(embed|embedding|tts|audio|whisper|image|video|moderation|rerank|vision)/i.test(m))
        .slice(0, 8);

    if (candidates.length === 0) {
        return { ok: false, error: '没有可测试的聊天模型' };
    }

    let lastError = '';
    for (const model of candidates) {
        try {
            const resp = await fetch(baseUrl + '/chat/completions', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: 'Reply exactly OK.' }],
                    max_tokens: 8,
                    temperature: 0
                }),
                signal: AbortSignal.timeout(15000)
            });

            if (resp.ok) {
                const rawText = await resp.text().catch(() => '');
                const json = rawText ? parseSettingsApiJsonResponseText(rawText) : {};
                const content = json.choices?.[0]?.message?.content || '';
                if (content.trim()) return { ok: true, model };
                lastError = `${model}: 空响应`;
            } else {
                const errText = await resp.text().catch(() => '');
                let detail = errText;
                try {
                    const errJson = parseSettingsApiJsonResponseText(errText);
                    detail = errJson.error?.message || errJson.message || errText;
                } catch (_) {}
                lastError = `${model}: HTTP ${resp.status} ${String(detail).slice(0, 80)}`;
            }
        } catch (e) {
            const msg = (e.name === 'AbortError' || e.message === 'The operation was aborted') ? '超时' : (e.message || '请求失败');
            lastError = `${model}: ${msg}`;
        }
    }

    return { ok: false, error: lastError || '聊天测试失败' };
}

// 恢复模型选择为 select（如果之前被降级成 input）
function restoreModelSelect() {
    const el = document.getElementById('api-edit-model');
    if (el && el.tagName === 'INPUT') {
        const parent = el.parentNode;
        const select = document.createElement('select');
        select.id = 'api-edit-model';
        select.style.cssText = 'width:100%; background:#f0ebe6; border:1px solid rgba(248,164,184,0.2); border-radius:14px; padding:10px; font-size:14px; color:#999; outline:none; appearance:none; -webkit-appearance:none; cursor:not-allowed;';
        select.disabled = true;
        select.innerHTML = '<option value="">请先点测试按钮</option>';
        parent.replaceChild(select, el);
    }
}

function restoreImageModelSelect() {
    const el = document.getElementById('api-edit-image-model');
    if (el && el.tagName === 'INPUT') {
        const parent = el.parentNode;
        const select = document.createElement('select');
        select.id = 'api-edit-image-model';
        select.style.cssText = 'width:100%; background:#f0ebe6; border:1px solid rgba(248,164,184,0.2); border-radius:14px; padding:10px; font-size:14px; color:#999; outline:none; appearance:none; -webkit-appearance:none; cursor:not-allowed;';
        select.disabled = true;
        select.dataset.savedModel = el.value || '';
        select.innerHTML = '<option value="">请先点测试按钮</option>';
        parent.replaceChild(select, el);
    }
}

// 工具函数
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 获取当前默认 API（供其他模块调用）
function getDefaultApi() {
    const data = getApiData();
    if (!data.defaultId || !data.apis.length) return null;
    return data.apis.find(a => a.id === data.defaultId && a.model) || data.apis.find(a => a.model) || null;
}

function getDefaultImageApi() {
    const data = getApiData();
    if (!data.apis.length) return null;
    if (data.imageDefaultId) {
        const selected = data.apis.find(a => a.id === data.imageDefaultId);
        if (selected && selected.imageModel) return selected;
    }
    return data.apis.find(a => a.imageModel) || null;
}

function getDefaultVoiceApi() {
    const data = getApiData();
    const voiceApi = normalizeVoiceApiData(data.voiceApi);
    const openAiVoiceApi = normalizeOpenAiVoiceApiData(data.openAiVoiceApi);
    const elevenLabsVoiceApi = normalizeElevenLabsVoiceApiData(data.elevenLabsVoiceApi);
    const localVoiceApi = normalizeLocalVoiceApiData(data.localVoiceApi);
    const provider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, voiceApi, localVoiceApi, openAiVoiceApi, elevenLabsVoiceApi);
    if (provider === 'local' && isLocalVoiceEnabled(localVoiceApi)) return localVoiceApi;
    if (provider === 'minimax' && isApiVoiceEnabled(voiceApi)) return voiceApi;
    if (provider === 'openai' && isOpenAiVoiceEnabled(openAiVoiceApi)) return openAiVoiceApi;
    if (provider === 'elevenlabs' && isElevenLabsVoiceEnabled(elevenLabsVoiceApi)) return elevenLabsVoiceApi;
    if (isApiVoiceEnabled(voiceApi)) return voiceApi;
    if (isOpenAiVoiceEnabled(openAiVoiceApi)) return openAiVoiceApi;
    if (isElevenLabsVoiceEnabled(elevenLabsVoiceApi)) return elevenLabsVoiceApi;
    if (isLocalVoiceEnabled(localVoiceApi)) return localVoiceApi;
    return null;
}

// ========== 预设管理 ==========

const PRESET_STORAGE_KEY = 'my_presets_data';

function getPresetData() {
    try {
        const raw = localStorage.getItem(PRESET_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { presets: [], activeId: null };
}

function savePresetData(data) {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(data));
}

function getActivePreset() {
    const data = getPresetData();
    if (!data.activeId) return null;
    return data.presets.find(p => p.id === data.activeId) || null;
}

function importPresetFile(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            const preset = parsePromptPreset(json, file.name);
            if (!preset) {
                alert('无法识别预设格式');
                return;
            }

            const data = getPresetData();
            const existing = data.presets.findIndex(p => p.name === preset.name);
            if (existing >= 0) {
                if (!confirm(`已存在同名预设「${preset.name}」，覆盖吗？`)) return;
                data.presets[existing] = preset;
            } else {
                data.presets.push(preset);
            }
            data.activeId = preset.id;
            savePresetData(data);
            renderPresetList();
            alert(`预设「${preset.name}」导入成功！`);
        } catch (err) {
            alert('预设解析失败: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function openManualPresetCreator() {
    let editor = document.getElementById('manual-preset-editor');
    if (!editor) {
        editor = document.createElement('div');
        editor.id = 'manual-preset-editor';
        editor.className = 'manual-preset-editor';
        const container = document.getElementById('preset-list-container');
        if (container && container.parentElement) container.parentElement.insertBefore(editor, container);
    }
    editor.innerHTML = `
        <div class="manual-preset-head">
            <div>
                <strong>手动新建预设</strong>
                <span>会保存为一个启用的 system prompt，可继续展开编辑。</span>
            </div>
            <button type="button" onclick="closeManualPresetCreator()"><i class="ri-close-line"></i></button>
        </div>
        <input id="manual-preset-name" class="manual-preset-input" placeholder="预设名称">
        <textarea id="manual-preset-content" class="manual-preset-textarea" placeholder="把你的预设内容写在这里。支持 {{char}}、{{user}}、{{datetime}}、{{description}} 等变量。" rows="9"></textarea>
        <div class="manual-preset-actions">
            <button type="button" class="subtle" onclick="closeManualPresetCreator()">取消</button>
            <button type="button" onclick="saveManualPreset()">保存预设</button>
        </div>
    `;
    editor.classList.remove('hidden');
    setTimeout(() => document.getElementById('manual-preset-name')?.focus(), 0);
}

function closeManualPresetCreator() {
    const editor = document.getElementById('manual-preset-editor');
    if (editor) editor.classList.add('hidden');
}

function saveManualPreset() {
    const name = (document.getElementById('manual-preset-name')?.value || '').trim();
    const content = (document.getElementById('manual-preset-content')?.value || '').trim();
    if (!content) {
        alert('先写预设内容');
        return;
    }
    const data = getPresetData();
    const preset = {
        id: 'preset_manual_' + Date.now(),
        name: name || `手动预设 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
        prompts: [{
            name: 'Main',
            role: 'system',
            content,
            identifier: 'manual_main',
            enabled: true
        }],
        temperature: 0.8,
        max_tokens: 1800,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
    };
    data.presets = Array.isArray(data.presets) ? data.presets : [];
    data.presets.unshift(preset);
    data.activeId = preset.id;
    savePresetData(data);
    window._expandedPresetId = preset.id;
    window._expandedPromptKey = preset.id + '_0';
    closeManualPresetCreator();
    renderPresetList();
}

function parsePromptPreset(json, filename) {
    const name = json.name || filename.replace(/\.json$/i, '') || '未命名预设';

    // prompt_order 存放真实启用状态（兼容多种旧格式）
    let orderMap = {};
    if (Array.isArray(json.prompt_order)) {
        const first = json.prompt_order[0];
        if (first && Array.isArray(first.order)) {
            first.order.forEach(o => { if (o.identifier) orderMap[o.identifier] = o.enabled !== false; });
        } else if (first && first.identifier) {
            json.prompt_order.forEach(o => { if (o.identifier) orderMap[o.identifier] = o.enabled !== false; });
        }
    }
    const hasOrder = Object.keys(orderMap).length > 0;

    let prompts = [];
    if (Array.isArray(json.prompts)) {
        prompts = json.prompts
            .filter(p => p.content && p.content.trim())
            .map(p => {
                const id = p.identifier || '';
                const enabled = (hasOrder && id in orderMap) ? orderMap[id] : (p.enabled !== false);
                return {
                    name: p.name || p.identifier || 'prompt',
                    role: p.role || 'system',
                    content: p.content,
                    identifier: id,
                    enabled: enabled
                };
            });
    }

    if (prompts.length === 0 && json.main_prompt) {
        prompts.push({ name: 'Main', role: 'system', content: json.main_prompt, identifier: 'main', enabled: true });
        if (json.jailbreak_prompt) {
            prompts.push({ name: 'Jailbreak', role: 'system', content: json.jailbreak_prompt, identifier: 'jailbreak', enabled: true });
        }
        if (json.nsfw_prompt) {
            prompts.push({ name: 'NSFW', role: 'system', content: json.nsfw_prompt, identifier: 'nsfw', enabled: true });
        }
    }

    return {
        id: 'preset_' + Date.now(),
        name: name,
        prompts: prompts,
        temperature: json.temperature ?? 0.8,
        max_tokens: json.max_tokens || json.openai_max_tokens || 1000,
        top_p: json.top_p ?? 1,
        frequency_penalty: json.frequency_penalty ?? 0,
        presence_penalty: json.presence_penalty ?? 0
    };
}

function renderPresetList() {
    const container = document.getElementById('preset-list-container');
    if (!container) return;

    const data = getPresetData();

    if (!data.presets || data.presets.length === 0) {
        container.innerHTML = `
            <div class="set-empty">
                <i class="ri-file-list-3-line"></i>
                还没有预设哦～<br>导入一个预设试试
            </div>
        `;
        return;
    }

    container.innerHTML = data.presets.map(p => {
        const isActive = p.id === data.activeId;
        const enabledCount = p.prompts.filter(pr => pr.enabled).length;
        const totalCount = p.prompts.length;
        const isExpanded = window._expandedPresetId === p.id;

        let promptsHtml = '';
        if (isExpanded) {
            promptsHtml = `<div class="preset-prompts-list">
                <div class="preset-params">
                    <span>temp: ${p.temperature}</span>
                    <span>max_tokens: ${p.max_tokens}</span>
                    <span>top_p: ${p.top_p}</span>
                    ${p.frequency_penalty ? `<span>freq: ${p.frequency_penalty}</span>` : ''}
                    ${p.presence_penalty ? `<span>pres: ${p.presence_penalty}</span>` : ''}
                </div>
                ${p.prompts.map((pr, i) => `
                    <div class="preset-prompt-item ${pr.enabled ? '' : 'disabled'}">
                        <div class="preset-prompt-header" onclick="togglePromptExpand('${p.id}', ${i})">
                            <label class="preset-toggle" onclick="event.stopPropagation()">
                                <input type="checkbox" ${pr.enabled ? 'checked' : ''} onchange="togglePromptEnabled('${p.id}', ${i}, this.checked)">
                                <span class="preset-toggle-slider"></span>
                            </label>
                            <span class="preset-prompt-name">${escapeHtml(pr.name)}</span>
                            <span class="preset-prompt-role">${pr.role}</span>
                            <i class="ri-delete-bin-6-line preset-prompt-del" onclick="event.stopPropagation(); deletePromptItem('${p.id}', ${i})" title="删除"></i>
                            <i class="ri-arrow-${window._expandedPromptKey === p.id+'_'+i ? 'up' : 'down'}-s-line"></i>
                        </div>
                        ${window._expandedPromptKey === p.id+'_'+i ? `
                            <div class="preset-prompt-content">
                                <textarea onchange="editPromptContent('${p.id}', ${i}, this.value)">${escapeHtml(pr.content)}</textarea>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>`;
        }

        return `
            <div class="preset-card ${isActive ? 'active' : ''}" data-id="${p.id}">
                <div class="preset-card-header" onclick="togglePresetExpand('${p.id}')">
                    <div class="preset-card-left">
                        <i class="ri-arrow-${isExpanded ? 'up' : 'down'}-s-line preset-chevron"></i>
                        <div class="preset-card-info">
                            <div class="preset-card-name">
                                ${isActive ? '<span style="color:#f8a4b8;margin-right:4px;">♛</span>' : ''}
                                ${escapeHtml(p.name)}
                            </div>
                            <div class="preset-card-meta">${enabledCount}/${totalCount} prompts · temp ${p.temperature}</div>
                        </div>
                    </div>
                    <div class="preset-card-actions" onclick="event.stopPropagation()">
                        <i class="ri-star-${isActive ? 'fill' : 'line'}" title="${isActive ? '取消启用' : '启用'}" onclick="setActivePreset('${p.id}')" style="${isActive ? 'color:#f8a4b8;' : 'color:#999;'}"></i>
                        <i class="ri-delete-bin-6-line" title="删除" onclick="deletePreset('${p.id}')" style="color:#999;"></i>
                    </div>
                </div>
                ${promptsHtml}
            </div>
        `;
    }).join('');
}

window._expandedPresetId = null;
window._expandedPromptKey = null;

function togglePresetExpand(presetId) {
    window._expandedPresetId = (window._expandedPresetId === presetId) ? null : presetId;
    window._expandedPromptKey = null;
    renderPresetList();
}

function togglePromptExpand(presetId, promptIdx) {
    const key = presetId + '_' + promptIdx;
    window._expandedPromptKey = (window._expandedPromptKey === key) ? null : key;
    renderPresetList();
}

function togglePromptEnabled(presetId, promptIdx, enabled) {
    const data = getPresetData();
    const preset = data.presets.find(p => p.id === presetId);
    if (!preset) return;
    preset.prompts[promptIdx].enabled = enabled;
    savePresetData(data);
    renderPresetList();
}

function editPromptContent(presetId, promptIdx, newContent) {
    const data = getPresetData();
    const preset = data.presets.find(p => p.id === presetId);
    if (!preset) return;
    preset.prompts[promptIdx].content = newContent;
    savePresetData(data);
}

function deletePromptItem(presetId, promptIdx) {
    if (!confirm('删除这条 prompt 吗？')) return;
    const data = getPresetData();
    const preset = data.presets.find(p => p.id === presetId);
    if (!preset) return;
    preset.prompts.splice(promptIdx, 1);
    savePresetData(data);
    window._expandedPromptKey = null;
    renderPresetList();
}

function setActivePreset(presetId) {
    const data = getPresetData();
    data.activeId = (data.activeId === presetId) ? null : presetId;
    savePresetData(data);
    renderPresetList();
}

function deletePreset(presetId) {
    if (!confirm('确定删除这个预设吗？')) return;
    const data = getPresetData();
    data.presets = data.presets.filter(p => p.id !== presetId);
    if (data.activeId === presetId) data.activeId = null;
    savePresetData(data);
    renderPresetList();
}

// ========== 数据管理（导出 / 导入 / 清理缓存） ==========

const APP_VERSION = 'v1.1.582';
const MONITOR_PET_BACKUP_DB_NAME = 'bynd_monitor_pet_assets_v1';
const MONITOR_PET_BACKUP_DB_STORE = 'assets';
const ALL_DATA_KEYS = [
    'my_characters_data',
    'my_characters_data_meta',
    'my_api_data',
    'my_global_regex_scripts',
    'my_font_data',
    'my_user_profile',
    'my_theme_data',
    'my_sticker_packs',
    'my_bubble_presets',
    'my_presets_data',
    'wechat_user_persona_library_v1',
    'wechat_memory_store',
    'bynd_money_records_v1',
    'desktop_layout_v2',
    'desktop_folders',
    'desktop_sticky_notes_v1',
    'desktop_status_widget_prefs_v1',
    'desktop_lovely_widget_prefs_v1',
    'desktop_status_weather_v1',
    'desktop_status_steps_v1',
    'bynd_coread_library_v1',
    'bynd_coread_reader_settings_v1',
    'bynd_coread_reader_wallpaper_v1',
    'bynd_coread_progress_v1',
    'bynd_coread_daily_v1',
    'bynd_coread_daily_participants_v1',
    'bynd_coread_sources_v1',
    'bynd_coread_sources_version_v1',
    'bynd_monitor_active_tool_v1',
    'bynd_monitor_pet_library_v1',
    'bynd_monitor_active_pet_v1',
    'bynd_monitor_pet_float_pos_v1',
    'bynd_monitor_pet_bound_char_v1',
    'desktop_default_princess_deleted_v1',
    'desktop_default_lovely_deleted_v1'
];

function parseBackupLocalStorageValue(raw) {
    try {
        return { value: JSON.parse(raw), raw: false };
    } catch (_) {
        return { value: raw, raw: true };
    }
}

function stringifyBackupLocalStorageValue(value, raw = false) {
    if (raw && typeof value === 'string') return value;
    return JSON.stringify(value);
}

function openBackupObjectStore(dbName, storeName, mode = 'readonly') {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(storeName)) {
                req.result.createObjectStore(storeName);
            }
        };
        req.onsuccess = () => {
            try {
                const db = req.result;
                const tx = db.transaction(storeName, mode);
                resolve({ db, tx, store: tx.objectStore(storeName) });
            } catch (e) {
                try { req.result.close(); } catch (_) {}
                reject(e);
            }
        };
        req.onerror = () => reject(req.error);
    });
}

async function exportMonitorPetAssetsForBackup() {
    const { db, tx, store } = await openBackupObjectStore(MONITOR_PET_BACKUP_DB_NAME, MONITOR_PET_BACKUP_DB_STORE, 'readonly');
    try {
        const keysReq = store.getAllKeys();
        const valuesReq = store.getAll();
        const keys = await new Promise((resolve, reject) => {
            keysReq.onsuccess = () => resolve(keysReq.result || []);
            keysReq.onerror = () => reject(keysReq.error);
        });
        const values = await new Promise((resolve, reject) => {
            valuesReq.onsuccess = () => resolve(valuesReq.result || []);
            valuesReq.onerror = () => reject(valuesReq.error);
        });
        const entries = {};
        keys.forEach((key, index) => {
            const value = values[index];
            if (value) entries[String(key)] = value;
        });
        await new Promise(resolve => {
            tx.oncomplete = resolve;
            tx.onerror = resolve;
            tx.onabort = resolve;
        });
        return entries;
    } finally {
        db.close();
    }
}

async function importMonitorPetAssetsFromBackup(entries) {
    if (!entries || typeof entries !== 'object') return;
    const { db, tx, store } = await openBackupObjectStore(MONITOR_PET_BACKUP_DB_NAME, MONITOR_PET_BACKUP_DB_STORE, 'readwrite');
    try {
        store.clear();
        for (const [key, value] of Object.entries(entries)) {
            if (value) store.put(value, key);
        }
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

// 导出所有数据
async function exportAllData() {
    const exportData = { _version: APP_VERSION, _exportTime: new Date().toISOString() };
    const rawLocalStorageKeys = [];

    // localStorage 数据
    ALL_DATA_KEYS.forEach(key => {
        try {
            const raw = localStorage.getItem(key);
            if (raw !== null) {
                const parsed = parseBackupLocalStorageValue(raw);
                exportData[key] = parsed.value;
                if (parsed.raw) rawLocalStorageKeys.push(key);
            }
        } catch (e) { console.warn('导出跳过 ' + key, e); }
    });
    if (rawLocalStorageKeys.length) exportData._rawLocalStorageKeys = rawLocalStorageKeys;

    // 角色完整数据可能已迁到 IndexedDB，导出时用完整数据覆盖轻量索引。
    try {
        if (typeof loadWechatCharactersFromIndexedDb === 'function') {
            const record = await loadWechatCharactersFromIndexedDb().catch(() => null);
            if (record && Array.isArray(record.characters) && record.characters.length) {
                exportData.my_characters_data = record.characters;
                exportData._wechatCharactersIndexedDb = { updatedAt: record.updatedAt || Date.now() };
            }
        }
    } catch (e) { console.warn('导出 IndexedDB 角色数据跳过', e); }

    // IndexedDB 字体文件
    try {
        const fontStore = getFontStore();
        const fileFonts = fontStore.fonts.filter(f => f.type === 'file');
        if (fileFonts.length > 0) {
            exportData._fontBlobs = {};
            for (const f of fileFonts) {
                const blob = await loadFontBlob(f.id).catch(() => null);
                if (blob) exportData._fontBlobs[f.id] = blob;
            }
        }
    } catch (e) { console.warn('导出字体文件跳过', e); }

    // IndexedDB 桌宠素材包
    try {
        const monitorPetAssets = await exportMonitorPetAssetsForBackup();
        if (monitorPetAssets && Object.keys(monitorPetAssets).length) {
            exportData._monitorPetAssets = monitorPetAssets;
        }
    } catch (e) { console.warn('导出桌宠素材跳过', e); }

    // 下载
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_OS备份_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    alert('导出成功！');
}

// 导入数据
async function importAllData(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data._version && !data.my_characters_data && !data.my_api_data) {
            alert('这不是有效的备份文件');
            return;
        }

        if (!confirm('导入将覆盖当前所有数据，确定继续吗？')) return;

        // 恢复 localStorage。角色数据单独处理，避免大备份再次撑爆 localStorage。
        const rawLocalStorageKeys = Array.isArray(data._rawLocalStorageKeys) ? data._rawLocalStorageKeys : [];
        ALL_DATA_KEYS.forEach(key => {
            if (key === 'my_characters_data' || key === 'my_characters_data_meta') return;
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                localStorage.setItem(key, stringifyBackupLocalStorageValue(data[key], rawLocalStorageKeys.includes(key)));
            }
        });

        if (Array.isArray(data.my_characters_data)) {
            const updatedAt = data._wechatCharactersIndexedDb?.updatedAt || Date.now();
            if (typeof saveWechatImportedCharactersData === 'function') {
                await saveWechatImportedCharactersData(data.my_characters_data, updatedAt);
            } else {
                localStorage.setItem('my_characters_data', JSON.stringify(data.my_characters_data));
            }
        } else if (data.my_characters_data) {
            localStorage.setItem('my_characters_data', JSON.stringify(data.my_characters_data));
        }

        // 恢复 IndexedDB 字体文件
        if (data._fontBlobs) {
            for (const [fontId, blob] of Object.entries(data._fontBlobs)) {
                await saveFontBlob(fontId, blob).catch(() => {});
            }
        }

        // 恢复 IndexedDB 桌宠素材包
        if (data._monitorPetAssets) {
            await importMonitorPetAssetsFromBackup(data._monitorPetAssets).catch(() => {});
        }

        alert('导入成功！页面即将刷新...');
        location.reload();
    } catch (e) {
        alert('导入失败: ' + e.message);
    }
}

// 清理无效缓存
async function clearInvalidCache() {
    let cleaned = 0;

    // 1. 清理 localStorage 中非本应用的数据
    const validPrefixes = ['my_', 'XuexiFontDB'];
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!ALL_DATA_KEYS.includes(key) && !validPrefixes.some(p => key.startsWith(p))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => { localStorage.removeItem(key); cleaned++; });

    // 2. 清理 IndexedDB 中孤立的字体文件（元数据已删除但 blob 还在）
    try {
        const fontStore = getFontStore();
        const validFontIds = fontStore.fonts.map(f => f.id);
        const db = await openFontDB();
        const tx = db.transaction(FONT_DB_STORE, 'readwrite');
        const store = tx.objectStore(FONT_DB_STORE);
        const allKeys = await new Promise((resolve, reject) => {
            const req = store.getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        for (const key of allKeys) {
            if (!validFontIds.includes(key)) {
                store.delete(key);
                cleaned++;
            }
        }
    } catch (e) { console.warn('清理 IndexedDB 跳过', e); }

    // 3. 清理角色数据中空的聊天记录和无效引用
    try {
        const raw = localStorage.getItem('my_characters_data');
        if (raw) {
            const chars = JSON.parse(raw);
            let modified = false;
            chars.forEach(char => {
                // 清理空 history
                if (char.history && char.history.length === 0) delete char.history;
                // 清理空 worldBook/regex
                if (char.worldBook && char.worldBook.length === 0) { delete char.worldBook; modified = true; }
                if (char.regex && char.regex.length === 0) { delete char.regex; modified = true; }
            });
        }
    } catch (e) {}

    // 4. 计算存储用量
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        totalSize += (localStorage.getItem(key) || '').length;
    }
    const sizeKB = (totalSize * 2 / 1024).toFixed(1); // UTF-16

    alert(`清理完成！\n清除了 ${cleaned} 项无效数据\n当前 localStorage 用量：${sizeKB} KB`);
}

// ========== 字体设置（下拉列表 + IndexedDB 存储） ==========

// localStorage 存元数据: { fonts: [{id, name, type, url?}], activeId }
// IndexedDB 存字体二进制: key=fontId, value=dataUrl

const FONT_DB_NAME = 'XuexiFontDB';
const FONT_DB_STORE = 'fonts';
const FONT_MAX_BYTES = 50 * 1024 * 1024;
const FONT_FETCH_TIMEOUT_MS = 300000;
const FONT_PROXY_FALLBACK = 'https://bynd-push.myluckylxy.workers.dev/font-proxy';
const FONT_EXTENSIONS = ['.ttf', '.woff', '.woff2', '.otf', '.ttc'];

function openFontDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(FONT_DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(FONT_DB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveFontBlob(fontId, dataUrl) {
    const db = await openFontDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(FONT_DB_STORE, 'readwrite');
        tx.objectStore(FONT_DB_STORE).put(dataUrl, fontId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function loadFontBlob(fontId) {
    const db = await openFontDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(FONT_DB_STORE, 'readonly');
        const req = tx.objectStore(FONT_DB_STORE).get(fontId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function deleteFontBlob(fontId) {
    const db = await openFontDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(FONT_DB_STORE, 'readwrite');
        tx.objectStore(FONT_DB_STORE).delete(fontId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function getFontStore() {
    try {
        const raw = localStorage.getItem(FONT_STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data.fonts) return data;
        }
    } catch (e) { console.error(e); }
    return { fonts: [], activeId: null };
}

function saveFontStore(store) {
    localStorage.setItem(FONT_STORAGE_KEY, JSON.stringify(store));
}

function getUserFontFamily(fontId) {
    return `"UserFont_${fontId}", ${DEFAULT_FONT_FAMILY}`;
}

function ensureGlobalFontOverride() {
    let style = document.getElementById('app-font-global-override');
    if (!style) {
        style = document.createElement('style');
        style.id = 'app-font-global-override';
        document.head.appendChild(style);
    }
    style.textContent = `
html, body {
    font-family: var(--app-font-family) !important;
}
body,
body button,
body input,
body textarea,
body select,
body option,
body *:not(i):not([class^="ri-"]):not([class*=" ri-"]):not(svg):not(path) {
    font-family: var(--app-font-family) !important;
}
[class^="ri-"],
[class*=" ri-"],
[class^="ri-"]::before,
[class*=" ri-"]::before {
    font-family: remixicon !important;
}`;
}

function setAppFontFamily(family) {
    document.documentElement.style.setProperty('--app-font-family', family || DEFAULT_FONT_FAMILY);
    ensureGlobalFontOverride();
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function isLocalHostForFontProxy(host) {
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function getFontProxyBase() {
    try {
        const host = location.hostname || '';
        if ((location.protocol === 'http:' || location.protocol === 'https:') && !isLocalHostForFontProxy(host)) {
            return `${location.origin}/font-proxy`;
        }
    } catch (e) {}
    return FONT_PROXY_FALLBACK;
}

function getFontFetchCandidates(url) {
    const cleanUrl = String(url || '').trim();
    const candidates = [];
    const proxyBase = getFontProxyBase();
    const proxyUrl = proxyBase ? `${proxyBase}?url=${encodeURIComponent(cleanUrl)}` : '';
    if (shouldPreferFontProxy(cleanUrl)) return proxyUrl ? [proxyUrl] : [cleanUrl];
    candidates.push(cleanUrl);
    if (proxyUrl) candidates.push(proxyUrl);
    return candidates.filter(Boolean);
}

function shouldPreferFontProxy(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === 'files.catbox.moe' || host === 'litter.catbox.moe';
    } catch (e) {
        return false;
    }
}

function getRemoteFontCssUrl(url) {
    const cleanUrl = assertRemoteFontUrl(url);
    if (shouldPreferFontProxy(cleanUrl)) {
        const proxyBase = getFontProxyBase();
        if (proxyBase) return `${proxyBase}?url=${encodeURIComponent(cleanUrl)}`;
    }
    return cleanUrl;
}

function assertRemoteFontUrl(url) {
    let parsed = null;
    try {
        parsed = new URL(String(url || '').trim());
    } catch (e) {
        throw new Error('字体链接格式不对');
    }
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('只支持 http/https 字体链接');
    const lowerPath = parsed.pathname.toLowerCase();
    if (!FONT_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) {
        throw new Error('字体链接必须是 .ttf / .woff / .woff2 / .otf / .ttc 文件');
    }
    return parsed.toString();
}

async function fetchRemoteFontBlob(url) {
    const cleanUrl = assertRemoteFontUrl(url);
    let lastError = null;
    for (const target of getFontFetchCandidates(cleanUrl)) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FONT_FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(target, {
                mode: 'cors',
                credentials: 'omit',
                cache: 'force-cache',
                signal: controller.signal
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const length = Number(response.headers.get('content-length') || 0);
            if (length > FONT_MAX_BYTES) throw new Error('字体文件过大');
            const blob = await response.blob();
            await assertFontBlob(blob);
            return blob;
        } catch (err) {
            lastError = err;
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError || new Error('字体下载失败');
}

async function assertFontBlob(blob) {
    if (!blob || !blob.size) throw new Error('字体文件为空');
    if (blob.size > FONT_MAX_BYTES) throw new Error('字体文件过大');
    if (blob.size < 128) throw new Error('链接返回的不是字体文件');
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const text = String.fromCharCode(...head);
    const isFont = text === 'OTTO'
        || text === 'wOFF'
        || text === 'wOF2'
        || text === 'ttcf'
        || (head[0] === 0x00 && head[1] === 0x01 && head[2] === 0x00 && head[3] === 0x00)
        || text === 'true'
        || text === 'typ1';
    if (!isFont) throw new Error('链接返回的不是字体文件');
}

function formatFontLoadError(err) {
    const message = err?.message || String(err || '字体加载失败');
    if (/HTTP 404/.test(message)) return '字体链接不存在或已经失效';
    if (/AbortError|aborted|timeout|timed out/i.test(message)) return '字体下载超时，请稍后再试';
    if (/Failed to fetch|NetworkError|Load failed|CORS/i.test(message)) return '字体链接被跨域限制，已尝试代理但仍然失败';
    return message;
}

async function cacheRemoteFont(font) {
    if (!font?.url) return null;
    const blob = await fetchRemoteFontBlob(font.url);
    const dataUrl = await blobToDataUrl(blob);
    await saveFontBlob(font.id, dataUrl);
    return dataUrl;
}

async function applyCustomFont(font, options = {}) {
    if (!font) return false;
    const token = ++fontApplyToken;
    try {
        let source = await loadFontBlob(font.id).catch(() => null);
        if (token !== fontApplyToken) return false;

        if (!source && font.type === 'url') {
            registerFontFace(font.id, `url("${getRemoteFontCssUrl(font.url)}")`);
            setAppFontFamily(getUserFontFamily(font.id));
            if (document.fonts?.load) {
                document.fonts.load(`16px "UserFont_${font.id}"`).catch(() => null);
            }
            updateFontPreview(font);
            return true;
        }

        if (!source && font.type !== 'url') {
            updateFontPreview(font);
            return false;
        }

        registerFontFace(font.id, source);
        setAppFontFamily(getUserFontFamily(font.id));
        if (document.fonts?.load) {
            document.fonts.load(`16px "UserFont_${font.id}"`).catch(() => null);
        }
        updateFontPreview(font);
        return true;
    } catch (err) {
        console.warn('字体加载失败', err);
        if (token === fontApplyToken && options.notify !== false) {
            alert(`字体「${font.name || '自定义字体'}」加载失败：${formatFontLoadError(err)}`);
        }
        return false;
    }
}

// 初始化
function initFontSettings() {
    renderFontDropdown();
    restoreActiveFont();
}

// 渲染下拉列表
function renderFontDropdown() {
    const select = document.getElementById('font-select');
    if (!select) return;

    const store = getFontStore();
    let html = '<option value="">系统默认</option>';

    // 预设字体分组
    html += '<optgroup label="内置字体">';
    FONT_PRESETS.forEach(p => {
        if (p.id === 'system') return;
        html += `<option value="preset_${p.id}">${p.name}</option>`;
    });
    html += '</optgroup>';

    // 用户字体分组
    if (store.fonts.length > 0) {
        html += '<optgroup label="我的字体">';
        store.fonts.forEach(f => {
            html += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
        });
        html += '</optgroup>';
    }

    select.innerHTML = html;
    select.value = store.activeId || '';
}

// 下拉选择字体
function selectFontFromDropdown(value) {
    const store = getFontStore();
    removeAllCustomFontFaces();

    if (!value) {
        fontApplyToken += 1;
        store.activeId = null;
        saveFontStore(store);
        setAppFontFamily(DEFAULT_FONT_FAMILY);
        updateFontPreview(null);
        return;
    }

    if (value.startsWith('preset_')) {
        const presetId = value.replace('preset_', '');
        const preset = FONT_PRESETS.find(p => p.id === presetId);
        if (!preset) return;
        fontApplyToken += 1;
        store.activeId = value;
        saveFontStore(store);
        setAppFontFamily(preset.family);
        updateFontPreview({ name: preset.name, family: preset.family });
        return;
    }

    // 用户自定义字体
    const font = store.fonts.find(f => f.id === value);
    if (!font) return;
    store.activeId = value;
    saveFontStore(store);
    applyCustomFont(font);
}

// 处理本地字体上传
function handleFontFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const validTypes = ['.ttf', '.woff', '.woff2', '.otf'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(ext)) {
        alert('不支持的字体格式，请上传 .ttf/.woff/.woff2/.otf 文件');
        input.value = '';
        return;
    }

    const defaultName = file.name.replace(/\.[^.]+$/, '');
    const name = prompt('给这个字体起个名字吧～', defaultName);
    if (!name) { input.value = ''; return; }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const dataUrl = e.target.result;
        const fontId = 'font_' + Date.now();

        // 存到 IndexedDB
        try {
            await saveFontBlob(fontId, dataUrl);
        } catch (err) {
            alert('字体存储失败: ' + err.message);
            return;
        }

        // 元数据存 localStorage
        const store = getFontStore();
        store.fonts.push({ id: fontId, name: name.trim(), type: 'file' });
        store.activeId = fontId;
        saveFontStore(store);

        // 注册并应用
        registerFontFace(fontId, dataUrl);
        setAppFontFamily(getUserFontFamily(fontId));
        renderFontDropdown();
        updateFontPreview({ name: name.trim() });
    };
    reader.readAsDataURL(file);
    input.value = '';
}

// 从 URL 添加字体
async function addFontFromUrl() {
    const urlInput = document.getElementById('font-url-input');
    const url = (urlInput ? urlInput.value : '').trim();
    if (!url) { alert('请输入字体文件链接'); return; }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('请输入有效的 http/https 链接');
        return;
    }

    const defaultName = url.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '') || '远程字体';
    const name = prompt('给这个字体起个名字吧～', defaultName);
    if (!name) return;

    const fontId = 'font_' + Date.now();
    try {
        assertRemoteFontUrl(url);
    } catch (err) {
        alert(`字体导入失败：${formatFontLoadError(err)}`);
        return;
    }
    const font = { id: fontId, name: name.trim(), type: 'url', url: url };

    const store = getFontStore();
    store.fonts = store.fonts.filter(item => item.url !== url);
    store.fonts.push(font);
    store.activeId = fontId;
    saveFontStore(store);

    renderFontDropdown();
    applyCustomFont(font);
    if (urlInput) urlInput.value = '';
}

function parseFontBatchLine(line) {
    const text = String(line || '').trim();
    if (!text) return null;
    const urlMatch = text.match(/https?:\/\/\S+/i);
    if (!urlMatch) return null;
    const url = urlMatch[0].replace(/[，,。；;]+$/, '');
    const left = text.slice(0, urlMatch.index).replace(/[—\-–|:：\s]+$/g, '').trim();
    const fileName = url.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '') || '远程字体';
    return {
        name: (left || fileName).slice(0, 32),
        url
    };
}

function setFontBatchStatus(text, tone = '') {
    const el = document.getElementById('font-batch-status');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.tone = tone || '';
}

function setFontBatchBusy(busy) {
    const btn = document.getElementById('font-batch-import-btn');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? '导入中...' : '批量添加';
}

function yieldToBrowser() {
    return new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
}

async function importFontsBatch() {
    const input = document.getElementById('font-batch-input');
    const text = input ? input.value : '';
    const items = String(text || '')
        .split(/\n+/)
        .map(parseFontBatchLine)
        .filter(Boolean);
    if (!items.length) {
        alert('没有识别到字体链接。格式示例：奶兔小小莓——https://files.catbox.moe/m8x7m7.ttf');
        return;
    }

    setFontBatchBusy(true);
    setFontBatchStatus(`正在解析 ${items.length} 个字体链接...`, 'busy');
    await yieldToBrowser();

    const store = getFontStore();
    const existingUrls = new Set((store.fonts || []).filter(font => font.type === 'url').map(font => font.url));
    const queued = [];
    let skipped = 0;
    let invalid = 0;

    for (const [index, item] of items.entries()) {
        if (!item.url.startsWith('http://') && !item.url.startsWith('https://')) {
            skipped += 1;
            continue;
        }
        try {
            assertRemoteFontUrl(item.url);
        } catch (err) {
            invalid += 1;
            continue;
        }
        if (existingUrls.has(item.url)) {
            skipped += 1;
            continue;
        }
        const fontId = 'font_' + Date.now() + '_' + index;
        const font = { id: fontId, name: item.name, type: 'url', url: item.url };
        existingUrls.add(item.url);
        queued.push(font);
    }

    if (!queued.length) {
        setFontBatchBusy(false);
        setFontBatchStatus(`没有新的字体可导入，已跳过 ${skipped} 条，格式无效 ${invalid} 条。`, 'warn');
        return;
    }

    queued.forEach(font => {
        store.fonts.push(font);
    });
    const firstFont = queued[0];
    if (firstFont) {
        store.activeId = firstFont.id;
        applyCustomFont(firstFont);
    }
    saveFontStore(store);
    renderFontDropdown();
    if (input) input.value = '';
    setFontBatchBusy(false);

    const parts = [`已导入 ${queued.length} 个字体`];
    if (skipped) parts.push(`${skipped} 个跳过`);
    if (invalid) parts.push(`${invalid} 个格式无效`);
    parts.push('大字体会在首次选择时加载');
    setFontBatchStatus(parts.join('，'), invalid ? 'warn' : 'done');
}

// 删除下拉中当前选中的自定义字体
function deleteSelectedFont() {
    const select = document.getElementById('font-select');
    if (!select) return;
    const fontId = select.value;
    if (!fontId || fontId.startsWith('preset_')) {
        alert('只能删除自定义字体哦～');
        return;
    }

    const store = getFontStore();
    const font = store.fonts.find(f => f.id === fontId);
    if (!font) return;
    if (!confirm(`删除字体「${font.name}」吗？`)) return;

    store.fonts = store.fonts.filter(f => f.id !== fontId);
    if (store.activeId === fontId) {
        fontApplyToken += 1;
        store.activeId = null;
        removeAllCustomFontFaces();
        setAppFontFamily(DEFAULT_FONT_FAMILY);
        updateFontPreview(null);
    }
    saveFontStore(store);

    // 删 IndexedDB
    deleteFontBlob(fontId).catch(() => {});

    renderFontDropdown();
}

// 重置为系统默认
function resetFont() {
    const store = getFontStore();
    store.activeId = null;
    saveFontStore(store);
    fontApplyToken += 1;
    removeAllCustomFontFaces();
    setAppFontFamily(DEFAULT_FONT_FAMILY);
    renderFontDropdown();
    updateFontPreview(null);
    const urlInput = document.getElementById('font-url-input');
    if (urlInput) urlInput.value = '';
}

// 更新预览框
function updateFontPreview(font) {
    const previewText = document.getElementById('font-preview-text');
    const previewLabel = document.getElementById('font-preview-label');
    if (previewText) {
        previewText.style.fontFamily = font ? (font.family || getUserFontFamily(font.id)) : DEFAULT_FONT_FAMILY;
        previewText.style.transition = 'opacity 0.2s';
        previewText.style.opacity = '0.3';
        setTimeout(() => { previewText.style.opacity = '1'; }, 50);
    }
    if (previewLabel) {
        previewLabel.textContent = '当前：' + (font ? font.name : '系统默认字体');
    }
}

// @font-face 管理
function registerFontFace(fontId, src) {
    const existing = document.getElementById('ff-' + fontId);
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = 'ff-' + fontId;
    const srcValue = src.startsWith('url(') ? src : `url("${src}")`;
    style.textContent = `@font-face { font-family: "UserFont_${fontId}"; src: ${srcValue}; font-display: swap; }`;
    document.head.appendChild(style);
}

function removeAllCustomFontFaces() {
    document.querySelectorAll('style[id^="ff-"]').forEach(el => el.remove());
}

// 页面加载时恢复当前字体
async function restoreActiveFont() {
    const store = getFontStore();
    if (!store.activeId) return;

    if (store.activeId.startsWith('preset_')) {
        const presetId = store.activeId.replace('preset_', '');
        const preset = FONT_PRESETS.find(p => p.id === presetId);
        if (preset) {
            setAppFontFamily(preset.family);
            updateFontPreview({ name: preset.name, family: preset.family });
        }
        return;
    }

    const font = store.fonts.find(f => f.id === store.activeId);
    if (!font) return;
    await applyCustomFont(font, { notify: false });
}

// 立即恢复（预设字体可以同步恢复，自定义字体异步）
(function restoreFontOnLoad() {
    const store = getFontStore();
    if (!store.activeId) return;
    if (store.activeId.startsWith('preset_')) {
        const presetId = store.activeId.replace('preset_', '');
        const preset = FONT_PRESETS.find(p => p.id === presetId);
        if (preset) setAppFontFamily(preset.family);
    } else {
        ensureGlobalFontOverride();
    }
    // 自定义字体在 restoreActiveFont() 中异步恢复
})();
