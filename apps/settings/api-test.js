// 10. 核心测试逻辑 — 一次请求返回连接状态+模型列表
function normalizeSettingsApiBaseUrl(value) {
    const original = String(value || '').trim().replace(/\/+$/, '');
    try {
        const url = new URL(original);
        if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) return original;
        url.pathname = url.pathname.replace(/\/(?:chat\/completions|images\/(?:generations|edits)|models)\/?$/, '').replace(/\/+$/, '');
        // This provider documents its image API separately from its chat site.
        if (url.origin === 'https://img.pipiwangcom.com' && ['', '/', '/v1', '/api', '/api/v1'].includes(url.pathname)) {
            url.pathname = '/api/v1';
        }
        return url.href.replace(/\/+$/, '');
    } catch (_) {
        return original;
    }
}

function getSettingsApiBaseCandidates(value) {
    const base = normalizeSettingsApiBaseUrl(value);
    const url = new URL(base);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('请填写完整的 http 或 https 站点地址，不要包含账号、查询参数或页面锚点');
    if (isByndProxiedApiBaseUrl(base) || base === 'https://img.pipiwangcom.com/api/v1') return [base];
    const path = url.pathname.replace(/\/+$/, '');
    let paths;
    if (/\/api\/v1$/.test(path)) {
        const prefix = path.slice(0, -7);
        paths = [path, prefix + '/v1', prefix, prefix + '/api'];
    } else if (/\/v1$/.test(path)) {
        const prefix = path.slice(0, -3);
        paths = [path, prefix + '/api/v1', prefix, prefix + '/api'];
    } else {
        paths = [path, path + '/v1', path + '/api/v1'];
    }
    return [...new Set(paths.map(item => url.origin + item))];
}

async function doTestApi(baseUrl, apiKey) {
    let candidates;
    try {
        candidates = getSettingsApiBaseCandidates(baseUrl);
    } catch (_) {
        return { ok: false, error: '请填写完整的 http 或 https 站点地址，不要包含账号、查询参数或页面锚点', models: [] };
    }
    let firstFailure;
    for (const candidate of candidates) {
        const result = await testApiModelsAtBaseUrl(candidate, apiKey, candidate !== 'https://img.pipiwangcom.com/api/v1');
        if (candidate === 'https://img.pipiwangcom.com/api/v1') {
            // /models is session-protected on this image-only service. Its
            // documented model IDs are configuration hints, never proof that
            // the user's bearer key works. Do not create a billable image here.
            return {
                ok: false, detected: true, baseUrl: candidate, imageOnly: true,
                models: ['image-1', 'image-2'], chatModel: '',
                error: '已识别生图配置；未验证 Key 和实际生成，请保存后生成图片确认。'
            };
        }
        if (result.ok) return { ...result, baseUrl: candidate };
        firstFailure = firstFailure || result;
        if (result.status === 429) return result;
    }
    return { ...firstFailure, error: `${firstFailure.error}（已检查常见接口路径）` };
}

async function testApiModelsAtBaseUrl(baseUrl, apiKey, testChat = true) {
    baseUrl = baseUrl.replace(/\/+$/, '');
    const requestBaseUrl = resolveByndApiBaseUrl(baseUrl);

    const headers = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    // 尝试 /models 接口
    try {
        const resp = await fetch(requestBaseUrl + '/models', {
            method: 'GET',
            headers: headers,
            redirect: 'error',
            signal: AbortSignal.timeout(6000)
        });
        if (resp.ok) {
            let models = [];
            try {
                const rawText = await resp.text();
                const json = parseSettingsApiJsonResponseText(rawText);
                if (!Array.isArray(json.data)) throw new Error('missing model list');
                models = json.data.map(m => m && (m.id || m.name)).filter(m => typeof m === 'string' && m.trim()).sort();
                if (json.data.length && !models.length) throw new Error('invalid model list');
            } catch (parseErr) {
                return { ok: false, error: '此地址未返回有效模型列表，可按站点文档手动填写模型', models: [] };
            }
            const count = models.length;
            if (count === 0) return { ok: true, detail: '', models: models };
            if (!testChat) return { ok: true, models, chatModel: '' };

            const probe = await probeChatModels(requestBaseUrl, apiKey, models);
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
        if (resp.status === 401) return { ok: false, status: 401, error: '接口要求身份验证或 API Key 无效 (401)', models: [] };
        if (resp.status === 403) return { ok: false, status: 403, error: '没有权限或访问受限 (403)', models: [] };
        return { ok: false, status: resp.status, error: `HTTP ${resp.status}`, models: [] };
    } catch (e) {
        const msg = (e.name === 'AbortError' || e.name === 'TimeoutError' || e.message === 'The operation was aborted') ? '连接超时' : (e.message || '无法连接');
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
                redirect: 'error',
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
                try { window.ByndUsageLedger?.record({ feature: 'other', provider: baseUrl, apiName: 'API 测试', model, usage: json.usage || null, input: 6, output: 1, ok: true, ticket: null, source: null }); } catch (_) {}
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
    return String(str ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
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
    const fishAudioVoiceApi = normalizeFishAudioVoiceApiData(data.fishAudioVoiceApi);
    const elevenLabsVoiceApi = normalizeElevenLabsVoiceApiData(data.elevenLabsVoiceApi);
    const localVoiceApi = normalizeLocalVoiceApiData(data.localVoiceApi);
    const provider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, voiceApi, localVoiceApi, openAiVoiceApi, elevenLabsVoiceApi, fishAudioVoiceApi);
    if (provider === 'local' && isLocalVoiceEnabled(localVoiceApi)) return localVoiceApi;
    if (provider === 'minimax' && isApiVoiceEnabled(voiceApi)) return voiceApi;
    if (provider === 'openai' && isOpenAiVoiceEnabled(openAiVoiceApi)) return openAiVoiceApi;
    if (provider === 'fish-audio' && isFishAudioVoiceEnabled(fishAudioVoiceApi)) return fishAudioVoiceApi;
    if (provider === 'elevenlabs' && isElevenLabsVoiceEnabled(elevenLabsVoiceApi)) return elevenLabsVoiceApi;
    if (isApiVoiceEnabled(voiceApi)) return voiceApi;
    if (isOpenAiVoiceEnabled(openAiVoiceApi)) return openAiVoiceApi;
    if (isFishAudioVoiceEnabled(fishAudioVoiceApi)) return fishAudioVoiceApi;
    if (isElevenLabsVoiceEnabled(elevenLabsVoiceApi)) return elevenLabsVoiceApi;
    if (isLocalVoiceEnabled(localVoiceApi)) return localVoiceApi;
    return null;
}

