// --- ⚙️ settings.js: 设置 App (API 连接管理 + 字体设置) ---

const API_STORAGE_KEY = 'my_api_data';
const FONT_STORAGE_KEY = 'my_font_data';
const DEFAULT_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

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
    return {
        ...data,
        apis,
        defaultId,
        imageDefaultId
    };
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
    if (!data.apis || data.apis.length === 0) {
        panel.innerHTML = '';
        return;
    }
    const chatApis = data.apis.filter(api => api.model);
    const chatApi = chatApis.find(api => api.id === data.defaultId) || null;
    const imageApi = data.apis.find(api => api.id === data.imageDefaultId && api.imageModel) || null;
    panel.innerHTML = `
        <div class="api-route-head">
            <div>
                <strong>API 工作台</strong>
                <span>把聊天和生图拆开管理。一个站支持两种能力就共用；只有聊天模型时，再添加一个生图 API。</span>
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
        </div>
    `;
}

function renderApiRoutePicker(type, selectedApi, apis, selectedId) {
    const isImage = type === 'image';
    const emptyText = isImage ? '先选择生图模型' : '请选择聊天 API';
    const modelText = selectedApi
        ? (isImage ? (selectedApi.imageModel || '未选生图模型') : (selectedApi.model || '未选聊天模型'))
        : emptyText;
    const list = Array.isArray(apis) ? apis : [];
    const menu = list.length ? list.map(api => {
        const active = api.id === selectedId;
        const model = isImage ? api.imageModel : api.model;
        const tags = [
            api.model ? `聊天 ${api.model}` : '',
            api.imageModel ? `生图 ${api.imageModel}` : ''
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
        <div class="api-route-empty">${isImage ? '还没有配置生图模型。编辑 API，测试后从生图模型下拉里选一个。' : '还没有可用 API。'}</div>
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
    closeApiFloatingPickers();
    document.querySelectorAll('.api-route-picker').forEach(picker => {
        picker.classList.toggle('open', picker.dataset.routeType === type && !picker.classList.contains('open'));
    });
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

    const result = await doTestApi(api.baseUrl, api.apiKey);

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
                const json = await resp.json();
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
        return { ok: false, error: msg, models: [] };
    }
}

async function probeChatModels(baseUrl, apiKey, models) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const candidates = models
        .filter(m => !/(embed|embedding|tts|audio|whisper|image|moderation|rerank|vision)/i.test(m))
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
                const json = await resp.json().catch(() => ({}));
                const content = json.choices?.[0]?.message?.content || '';
                if (content.trim()) return { ok: true, model };
                lastError = `${model}: 空响应`;
            } else {
                const errText = await resp.text().catch(() => '');
                let detail = errText;
                try {
                    const errJson = JSON.parse(errText);
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

const APP_VERSION = 'v1.1.57';
const ALL_DATA_KEYS = ['my_characters_data', 'my_api_data', 'my_font_data', 'my_user_profile', 'my_theme_data', 'my_sticker_packs', 'my_bubble_presets', 'my_presets_data', 'bynd_money_records_v1'];

// 导出所有数据
async function exportAllData() {
    const exportData = { _version: APP_VERSION, _exportTime: new Date().toISOString() };

    // localStorage 数据
    ALL_DATA_KEYS.forEach(key => {
        try {
            const raw = localStorage.getItem(key);
            if (raw) exportData[key] = JSON.parse(raw);
        } catch (e) { console.warn('导出跳过 ' + key, e); }
    });

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

        // 恢复 localStorage
        ALL_DATA_KEYS.forEach(key => {
            if (data[key]) {
                localStorage.setItem(key, JSON.stringify(data[key]));
            }
        });

        // 恢复 IndexedDB 字体文件
        if (data._fontBlobs) {
            for (const [fontId, blob] of Object.entries(data._fontBlobs)) {
                await saveFontBlob(fontId, blob).catch(() => {});
            }
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
            const tag = f.type === 'url' ? ' [链接]' : ' [本地]';
            html += `<option value="${f.id}">${escapeHtml(f.name)}${tag}</option>`;
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
        store.activeId = null;
        saveFontStore(store);
        document.documentElement.style.setProperty('--app-font-family', DEFAULT_FONT_FAMILY);
        updateFontPreview(null);
        return;
    }

    if (value.startsWith('preset_')) {
        const presetId = value.replace('preset_', '');
        const preset = FONT_PRESETS.find(p => p.id === presetId);
        if (!preset) return;
        store.activeId = value;
        saveFontStore(store);
        document.documentElement.style.setProperty('--app-font-family', preset.family);
        updateFontPreview({ name: preset.name, family: preset.family });
        return;
    }

    // 用户自定义字体
    const font = store.fonts.find(f => f.id === value);
    if (!font) return;
    store.activeId = value;
    saveFontStore(store);

    if (font.type === 'url') {
        registerFontFace(font.id, `url("${font.url}")`);
        document.documentElement.style.setProperty('--app-font-family', `"UserFont_${font.id}"`);
        updateFontPreview(font);
    } else {
        // 从 IndexedDB 加载
        loadFontBlob(font.id).then(dataUrl => {
            if (dataUrl) {
                registerFontFace(font.id, dataUrl);
                document.documentElement.style.setProperty('--app-font-family', `"UserFont_${font.id}"`);
            }
            updateFontPreview(font);
        });
    }
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
        document.documentElement.style.setProperty('--app-font-family', `"UserFont_${fontId}"`);
        renderFontDropdown();
        updateFontPreview({ name: name.trim() });
    };
    reader.readAsDataURL(file);
    input.value = '';
}

// 从 URL 添加字体
function addFontFromUrl() {
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
    const store = getFontStore();
    store.fonts.push({ id: fontId, name: name.trim(), type: 'url', url: url });
    store.activeId = fontId;
    saveFontStore(store);

    registerFontFace(fontId, `url("${url}")`);
    document.documentElement.style.setProperty('--app-font-family', `"UserFont_${fontId}"`);
    renderFontDropdown();
    updateFontPreview({ name: name.trim() });
    if (urlInput) urlInput.value = '';
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
        store.activeId = null;
        removeAllCustomFontFaces();
        document.documentElement.style.setProperty('--app-font-family', DEFAULT_FONT_FAMILY);
        updateFontPreview(null);
    }
    saveFontStore(store);

    // 删 IndexedDB
    if (font.type === 'file') deleteFontBlob(fontId).catch(() => {});

    renderFontDropdown();
}

// 重置为系统默认
function resetFont() {
    const store = getFontStore();
    store.activeId = null;
    saveFontStore(store);
    removeAllCustomFontFaces();
    document.documentElement.style.setProperty('--app-font-family', DEFAULT_FONT_FAMILY);
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
        previewText.style.fontFamily = font ? (font.family || `"UserFont_${font.id}"`) : DEFAULT_FONT_FAMILY;
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
            document.documentElement.style.setProperty('--app-font-family', preset.family);
            updateFontPreview({ name: preset.name, family: preset.family });
        }
        return;
    }

    const font = store.fonts.find(f => f.id === store.activeId);
    if (!font) return;

    if (font.type === 'url') {
        registerFontFace(font.id, `url("${font.url}")`);
        document.documentElement.style.setProperty('--app-font-family', `"UserFont_${font.id}"`);
    } else {
        const dataUrl = await loadFontBlob(font.id).catch(() => null);
        if (dataUrl) {
            registerFontFace(font.id, dataUrl);
            document.documentElement.style.setProperty('--app-font-family', `"UserFont_${font.id}"`);
        }
    }
    updateFontPreview(font);
}

// 立即恢复（预设字体可以同步恢复，自定义字体异步）
(function restoreFontOnLoad() {
    const store = getFontStore();
    if (!store.activeId) return;
    if (store.activeId.startsWith('preset_')) {
        const presetId = store.activeId.replace('preset_', '');
        const preset = FONT_PRESETS.find(p => p.id === presetId);
        if (preset) document.documentElement.style.setProperty('--app-font-family', preset.family);
    }
    // 自定义字体在 restoreActiveFont() 中异步恢复
})();
