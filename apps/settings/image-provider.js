// 生图服务：中转站 API（OpenAI 兼容 /images）与 NovelAI 并列，按用途分别选择。
const IMAGE_ROUTE_FEATURES = [
    { key: 'comic', label: '漫画', hint: '漫画之家的分镜与成品' },
    { key: 'chat', label: '聊天图片', hint: '角色自拍、视频通话画面' }
];

function getNovelAiImageSettings(data = getApiData()) {
    return normalizeNovelAiImageSettings(data.novelAiImageApi);
}

function normalizeImageRoutePreferences(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    const routes = {};
    IMAGE_ROUTE_FEATURES.forEach(feature => {
        if (raw[feature.key] === 'api' || raw[feature.key] === 'novelai') routes[feature.key] = raw[feature.key];
    });
    return routes;
}

// Returns which provider a feature will really use. A preferred provider that is not
// configured falls back to the other configured one instead of failing silently.
function getImageRouteForFeature(feature = 'chat', data = getApiData()) {
    const routes = normalizeImageRoutePreferences(data.imageRoutes);
    const nai = normalizeNovelAiImageSettings(data.novelAiImageApi);
    const naiReady = nai.enabled && !!nai.token;
    const imageApi = (data.apis || []).find(api => api.id === data.imageDefaultId && api.imageModel)
        || (data.apis || []).find(api => api.imageModel) || null;
    const preferred = routes[feature] || (feature === 'comic' && naiReady ? 'novelai' : 'api');
    const naiRoute = () => ({ provider: 'novelai', settings: nai, preferred, label: `NovelAI · ${getNovelAiModelMeta(nai.model).label}` });
    const apiRoute = () => ({ provider: 'api', api: imageApi, preferred, label: `${imageApi.name || '中转站'} · ${imageApi.imageModel}` });
    if (preferred === 'novelai' && naiReady) return naiRoute();
    if (imageApi) return apiRoute();
    if (naiReady) return naiRoute();
    return { provider: '', preferred, label: '未配置生图服务' };
}

function setImageRoute(feature, provider) {
    if (!IMAGE_ROUTE_FEATURES.some(item => item.key === feature) || !['api', 'novelai'].includes(provider)) return;
    const data = getApiData();
    if (provider === 'novelai' && !isNovelAiImageReady(data.novelAiImageApi)) {
        openNovelAiImageModal();
        return;
    }
    if (provider === 'api' && !(data.apis || []).some(api => api.imageModel)) {
        alert('还没有配置中转站生图模型：编辑一个 API，测试后在“生图模型”里选择。');
        return;
    }
    data.imageRoutes = { ...normalizeImageRoutePreferences(data.imageRoutes), [feature]: provider };
    saveApiData(data);
    renderApiList();
}

function renderImageServiceCard(data = getApiData()) {
    const nai = normalizeNovelAiImageSettings(data.novelAiImageApi);
    const naiReady = nai.enabled && !!nai.token;
    const apiReady = (data.apis || []).some(api => api.imageModel);
    const model = getNovelAiModelMeta(nai.model);
    const usageRows = IMAGE_ROUTE_FEATURES.map(feature => {
        const route = getImageRouteForFeature(feature.key, data);
        const option = (provider, label, ready) => `<button type="button" class="${route.provider === provider ? 'active' : ''}" ${ready ? '' : 'data-missing="1"'} onclick="setImageRoute('${feature.key}', '${provider}')">${label}</button>`;
        return `
            <div class="api-image-usage-row">
                <span><b>${feature.label}</b><em>${escapeHtml(route.provider ? route.label : '未配置')}</em></span>
                <div class="api-image-usage-switch">
                    ${option('api', '中转站', apiReady)}
                    ${option('novelai', 'NovelAI', naiReady)}
                </div>
            </div>
        `;
    }).join('');
    return `
            <div class="api-route-card image-service">
                <i class="ri-palette-line"></i>
                <span>生图服务</span>
                <div class="api-voice-choice-grid">
                    <div class="api-voice-route novelai ${naiReady ? 'ready' : ''}">
                        <div class="api-voice-route-main">
                            <strong>NovelAI</strong>
                            <b>${naiReady ? escapeHtml(model.label) : '未配置'}</b>
                            <em>${naiReady ? `${nai.opusFree ? 'Opus 免费档' : '按 Anlas 计费'} · ${nai.steps} 步` : '二次元生图，可画成人内容'}</em>
                        </div>
                        <div class="api-voice-route-actions">
                            <button type="button" onclick="openNovelAiImageModal()">${naiReady ? '编辑' : '配置'}</button>
                        </div>
                    </div>
                    <div class="api-image-usage">${usageRows}</div>
                </div>
            </div>
    `;
}

function setNovelAiModalValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value ?? '';
}

function readNovelAiModalValue(id) {
    const el = document.getElementById(id);
    if (!el) return undefined;
    return el.type === 'checkbox' ? el.checked : el.value;
}

function fillNovelAiImageModal(settings = getNovelAiImageSettings()) {
    const modelSelect = document.getElementById('api-nai-model');
    if (modelSelect && !modelSelect.options.length) {
        modelSelect.innerHTML = NOVELAI_IMAGE_MODELS.map(model => `<option value="${model.id}">${escapeHtml(model.label)}</option>`).join('');
    }
    const samplerSelect = document.getElementById('api-nai-sampler');
    if (samplerSelect && !samplerSelect.options.length) {
        samplerSelect.innerHTML = NOVELAI_SAMPLERS.map(sampler => `<option value="${sampler}">${sampler}</option>`).join('');
    }
    const scheduleSelect = document.getElementById('api-nai-schedule');
    if (scheduleSelect && !scheduleSelect.options.length) {
        scheduleSelect.innerHTML = NOVELAI_NOISE_SCHEDULES.map(schedule => `<option value="${schedule}">${schedule}</option>`).join('');
    }
    setNovelAiModalValue('api-nai-enabled', settings.enabled);
    setNovelAiModalValue('api-nai-token', settings.token);
    setNovelAiModalValue('api-nai-model', settings.model);
    setNovelAiModalValue('api-nai-sampler', settings.sampler);
    setNovelAiModalValue('api-nai-schedule', settings.noiseSchedule);
    setNovelAiModalValue('api-nai-steps', settings.steps);
    setNovelAiModalValue('api-nai-scale', settings.scale);
    setNovelAiModalValue('api-nai-rescale', settings.cfgRescale);
    setNovelAiModalValue('api-nai-uc', settings.ucPreset);
    setNovelAiModalValue('api-nai-quality', settings.qualityTags);
    setNovelAiModalValue('api-nai-opus-free', settings.opusFree);
    setNovelAiModalValue('api-nai-variety', settings.varietyBoost);
    setNovelAiModalValue('api-nai-negative', settings.negative);
}

function readNovelAiImageModal() {
    const previous = getNovelAiImageSettings();
    return normalizeNovelAiImageSettings({
        ...previous,
        enabled: readNovelAiModalValue('api-nai-enabled'),
        token: String(readNovelAiModalValue('api-nai-token') || '').replace(/^Bearer\s+/i, '').trim(),
        model: readNovelAiModalValue('api-nai-model'),
        sampler: readNovelAiModalValue('api-nai-sampler'),
        noiseSchedule: readNovelAiModalValue('api-nai-schedule'),
        steps: readNovelAiModalValue('api-nai-steps'),
        scale: readNovelAiModalValue('api-nai-scale'),
        cfgRescale: readNovelAiModalValue('api-nai-rescale'),
        ucPreset: readNovelAiModalValue('api-nai-uc'),
        qualityTags: readNovelAiModalValue('api-nai-quality'),
        opusFree: readNovelAiModalValue('api-nai-opus-free'),
        varietyBoost: readNovelAiModalValue('api-nai-variety'),
        negative: readNovelAiModalValue('api-nai-negative')
    });
}

function openNovelAiImageModal() {
    const modal = document.getElementById('api-novelai-image-modal');
    if (!modal) return;
    const result = document.getElementById('api-nai-test-result');
    if (result) result.innerHTML = '';
    fillNovelAiImageModal();
    modal.classList.remove('hidden');
}

function closeNovelAiImageModal() {
    document.getElementById('api-novelai-image-modal')?.classList.add('hidden');
}

function saveNovelAiImageSettingsFromModal() {
    const settings = readNovelAiImageModal();
    const data = getApiData();
    const firstSetup = !isNovelAiImageReady(data.novelAiImageApi);
    data.novelAiImageApi = settings;
    // The first working token makes NovelAI the comic default; chat pictures keep their route.
    if (firstSetup && settings.enabled && settings.token && !normalizeImageRoutePreferences(data.imageRoutes).comic) {
        data.imageRoutes = { ...normalizeImageRoutePreferences(data.imageRoutes), comic: 'novelai' };
    }
    try {
        saveApiData(data);
    } catch (error) {
        const result = document.getElementById('api-nai-test-result');
        if (result) result.innerHTML = `<span style="color:#be123c;">保存失败：${escapeHtml(error.message || '存储空间不足')}</span>`;
        return;
    }
    closeNovelAiImageModal();
    renderApiList();
}

async function testNovelAiImageFromModal() {
    const result = document.getElementById('api-nai-test-result');
    if (!result) return;
    result.innerHTML = '<span style="color:#6d6470;">正在连接 NovelAI…</span>';
    const status = await testNovelAiImageConnection(readNovelAiImageModal());
    if (!status.ok) {
        result.innerHTML = `<span style="color:#be123c;">${escapeHtml(status.error || '连接失败')}</span>`;
        return;
    }
    result.innerHTML = `<span style="color:#047857;">✓ ${escapeHtml(status.summary)}</span>${status.notes.length ? `<br><span style="color:#6d6470;">${status.notes.map(escapeHtml).join('；')}</span>` : ''}`;
}
