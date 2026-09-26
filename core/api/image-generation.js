function parseWechatApiJsonResponseText(rawText) {
    const text = String(rawText || '').replace(/^\uFEFF/, '').trim();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (_) {
        const parsed = parseWechatApiSseJsonText(text);
        if (parsed) return parsed;
        throw new Error('API 返回格式无法解析');
    }
}

function parseWechatApiSseJsonText(text) {
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
    return chunks.find(chunk => chunk?.data || chunk?.url || chunk?.image_url || chunk?.b64_json || chunk?.images || chunk?.output)
        || chunks[chunks.length - 1]
        || chunks[0];
}

function getWechatNovelAiSizeFromOption(size) {
    const match = String(size || '').match(/^(\d+)\s*x\s*(\d+)$/i);
    const ratio = match ? Number(match[1]) / Number(match[2]) : 1;
    if (ratio < 0.9) return { width: 832, height: 1216 };
    if (ratio > 1.1) return { width: 1216, height: 832 };
    return { width: 1024, height: 1024 };
}

// NovelAI cannot edit a reference picture, so it draws from tags. Callers that
// already hold tags pass options.novelAi; plain descriptions are converted first.
async function callWechatNovelAiImage(prompt, options, settings) {
    let input = options.novelAi || null;
    if (!input) {
        if (typeof options.onProgress === 'function') options.onProgress('正在把画面描述整理成 NovelAI 标签…');
        const converted = await convertTextToNovelAiPrompt(prompt, { usageChar: options.usageChar });
        if (!converted.ok) return { ok: false, error: converted.error };
        input = converted;
    }
    const size = options.novelAiSize || getWechatNovelAiSizeFromOption(options.size);
    return callNovelAiImageGeneration({ ...input, width: input.width || size.width, height: input.height || size.height }, {
        settings,
        signal: options.signal,
        onProgress: options.onProgress,
        usageChar: options.usageChar,
        usageFeature: options.feature === 'comic' ? 'comic' : 'image'
    });
}

async function callWechatImageGenerationApi(prompt, options = {}) {
    const route = typeof getImageRouteForFeature === 'function' ? getImageRouteForFeature(options.feature || 'chat') : null;
    if (route?.provider === 'novelai' && !options.editOnly && typeof callNovelAiImageGeneration === 'function') {
        return callWechatNovelAiImage(prompt, options, route.settings);
    }
    const api = typeof getDefaultImageApi === 'function'
        ? getDefaultImageApi()
        : (typeof getDefaultApi === 'function' ? getDefaultApi() : null);
    if (!api || !api.baseUrl) return { ok: false, error: '未配置生图 API' };
    const configuredBaseUrl = api.baseUrl.replace(/\/+$/, '');
    const baseUrl = typeof resolveByndApiBaseUrl === 'function'
        ? resolveByndApiBaseUrl(configuredBaseUrl)
        : configuredBaseUrl;
    const jsonHeaders = { 'Content-Type': 'application/json' };
    if (api.apiKey) jsonHeaders.Authorization = `Bearer ${api.apiKey}`;
    const formHeaders = {};
    if (api.apiKey) formHeaders.Authorization = `Bearer ${api.apiKey}`;
    const imageModel = String(api.imageModel || '').trim();
    if (!imageModel) {
        return { ok: false, error: '当前默认生图 API 没有选择生图模型。请在设置里测试 API 后从生图模型下拉选择，或单独添加一个生图 API。' };
    }
    const referenceImage = String(options.referenceImage || '').trim();
    const referenceImages = [referenceImage, ...(Array.isArray(options.additionalReferences) ? options.additionalReferences : [])]
        .map(value => String(value || '').trim()).filter(Boolean).slice(0, 3);
    if (options.requireReference && !referenceImage) return { ok: false, error: '这次生成必须提供角色参考图，请先上传图片。' };
    const imageTimeoutMs = Math.max(60000, Number(options.timeoutMs) || 180000);
    let imageUsage = null;
    let imageRequestStartedAt = Date.now();
    const recordImageUsage = result => {
        const at = Date.now();
        try {
            window.ByndUsageLedger?.record({
                at, feature: 'image', provider: configuredBaseUrl, apiName: api.name || '', model: imageModel,
                charId: options.usageChar?.id ?? '', charName: options.usageChar ? getWechatCharDisplayName(options.usageChar) : '',
                usage: imageUsage, estimated: !imageUsage, ok: !!result?.ok, error: result?.ok ? '' : String(result?.error || ''),
                durationMs: at - imageRequestStartedAt, ticket: null, source: null
            });
        } catch (_) {}
        imageUsage = null;
        imageRequestStartedAt = Date.now();
        return result;
    };
    const enhancedPrompt = [
        String(prompt || '').trim(),
        referenceImage ? (options.referenceStyle === 'identity'
            ? '第一张参考图锁定角色身份与辨识特征，画风按本次任务转换；其余参考图的用途以任务说明为准，不能把风格示例中的人物身份复制给当前角色。'
            : '参考图是最高优先级的外观与画风来源：必须保持参考图中的角色脸型、发型发色、眼睛、年龄感、气质、配色和整体辨识度。如果参考图是动漫、插画、头像或二次元风格，必须保持同类画风，不要真人化。') : ''
    ].filter(Boolean).join('\n');
    const buildBody = includeReference => {
        const body = {
            model: imageModel,
            prompt: enhancedPrompt,
            size: options.size || '1024x1024',
            response_format: 'b64_json'
        };
        if (options.background === 'transparent') body.background = 'transparent';
        if (options.outputFormat === 'png') body.output_format = 'png';
        if (includeReference && referenceImage) {
            body.image = referenceImage;
            body.image_url = referenceImage;
            body.reference_image = referenceImage;
            body.reference_image_url = referenceImage;
            body.reference_images = [referenceImage];
            body.images = [referenceImage];
        }
        return body;
    };
    const parseImageResponse = async (resp, path) => recordImageUsage(await parseImageResponseBody(resp, path));
    const parseImageResponseBody = async (resp, path) => {
        const rawText = await resp.text().catch(() => '');
        const failure = raw => {
            const reason = getWechatImageApiErrorDetails(raw || resp.statusText || '图片生成失败', api.apiKey);
            return { ok: false, status: resp.status, error: normalizeWechatImageApiError(reason.message, resp.status), details: { ...reason, status: resp.status, model: imageModel, path, requestId: resp.headers.get('x-request-id') || '' } };
        };
        if (!resp.ok) return failure(rawText);
        let json = null;
        try {
            json = parseWechatApiJsonResponseText(rawText);
        } catch (e) {
            return failure('图片接口返回格式无法解析，请使用直接返回图片的生图接口。');
        }
        if (!json || typeof json !== 'object') return failure('图片接口返回格式无法解析');
        imageUsage = json.usage && typeof json.usage === 'object' ? json.usage : null;
        if (json.error) return failure(rawText);
        const imageUrl = value => {
            if (typeof value !== 'string' || !value.trim()) return '';
            const text = value.trim();
            if (/^(?:https?:\/\/|data:image\/(?:png|jpe?g|webp);base64,)/i.test(text)) return text;
            const encoded = text.replace(/\s+/g, '');
            return /^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ? `data:image/${json.output_format === 'jpeg' ? 'jpeg' : json.output_format === 'webp' ? 'webp' : 'png'};base64,${encoded}` : '';
        };
        const success = value => { const url = imageUrl(value); return url ? { ok: true, url } : failure('生图服务返回的图片地址或编码无效。'); };
        const first = json.data && json.data[0];
        if (first?.url || first?.b64_json) return success(first.url || first.b64_json);
        if (json.url || json.image_url || json.b64_json) return success(json.url || json.image_url || json.b64_json);
        if (typeof json.image === 'string' && /^(https?:|data:image)/i.test(json.image)) return success(json.image);
        if (Array.isArray(json.images) && json.images.length) {
            const img = json.images[0];
            if (typeof img === 'string') return success(img);
            if (img?.url || img?.image_url || img?.b64_json) return success(img.url || img.image_url || img.b64_json);
        }
        if (json.output && Array.isArray(json.output)) {
            const imageOutput = json.output.find(item => item && (item.result || item.image_url || item.b64_json));
            if (imageOutput) return success(imageOutput.result || imageOutput.image_url || imageOutput.b64_json);
        }
        return failure('图片接口没有返回图片。若服务返回的是异步任务，需要使用能直接返回图片的生图接口。');
    };
    try {
        let editError = '';
        let lastEditResult = null;
        if (referenceImage && (options.editOnly || shouldWechatUseImageEditEndpoint(baseUrl, imageModel))) {
            let editOptions = { ...options, referenceImages };
            let jsonEdit = false;
            // Retry only explicit request-validation failures. Keep the model,
            // endpoint and every identity reference; share one total time limit.
            const editSignal = AbortSignal.timeout(imageTimeoutMs);
            for (let attempt = 0; attempt < 4; attempt++) {
                const body = jsonEdit
                    ? JSON.stringify(buildWechatImageEditJsonBody(imageModel, enhancedPrompt, referenceImages, editOptions))
                    : await buildWechatImageEditFormData(imageModel, enhancedPrompt, referenceImage, editOptions);
                if (!body) {
                    editError = '参考图无法作为图片文件上传，请重新选择 PNG、JPG 或 WebP。';
                    break;
                }
                try {
                    const editResp = await fetch(baseUrl + '/images/edits', {
                        method: 'POST',
                        headers: jsonEdit ? jsonHeaders : formHeaders,
                        body,
                        signal: editSignal
                    });
                    const editResult = await parseImageResponse(editResp, '/images/edits');
                    if (editResult.ok) return editResult;
                    lastEditResult = editResult;
                    editError = editResult.error || '参考图编辑接口失败';
                    const compatibility = options.allowEditCompatibility && getWechatImageEditCompatibility(editResult, editOptions, jsonEdit);
                    if (!compatibility || attempt === 3) break;
                    if (compatibility === 'json') jsonEdit = true;
                    else editOptions = { ...editOptions, [compatibility]: undefined };
                    if (typeof options.onProgress === 'function') options.onProgress(compatibility === 'background' ? '当前服务不接受透明背景参数，正在保留角色参考图重试…' : '正在适配当前生图服务，角色参考图保持不变…');
                } catch (e) {
                    editError = normalizeWechatImageApiError(e && e.message ? e.message : '参考图编辑接口失败');
                    lastEditResult = { ok: false, error: editError, details: { model: imageModel, path: '/images/edits', message: editError } };
                    break;
                }
            }
        }
        // Character pets must never silently downgrade to a text-only generation request.
        if (options.editOnly) return lastEditResult || { ok: false, error: editError || '当前生图服务不支持角色参考图编辑，请在生图设置中选择支持图生图的模型或服务。' };
        const resp = await fetch(baseUrl + '/images/generations', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(buildBody(!!referenceImage)),
            signal: AbortSignal.timeout(imageTimeoutMs)
        });
        const result = await parseImageResponse(resp, '/images/generations');
        if (!result.ok && referenceImage && isWechatImageReferenceRetryable(result) && !options.requireReference) {
            const retry = await fetch(baseUrl + '/images/generations', {
                method: 'POST',
                headers: jsonHeaders,
                body: JSON.stringify(buildBody(false)),
                signal: AbortSignal.timeout(imageTimeoutMs)
            });
            return parseImageResponse(retry, '/images/generations');
        }
        if (!result.ok && editError) {
            result.error = `${result.error || '图片生成失败'}；参考图 edits 路径也失败：${editError}`;
        }
        return result;
    } catch (e) {
        return recordImageUsage({ ok: false, error: normalizeWechatImageApiError(e && e.message ? e.message : '图片生成失败') });
    }
}

function buildWechatImageEditJsonBody(model, prompt, references, options) {
    // Official JSON edits schema: https://developers.openai.com/api/reference/resources/images/methods/edit
    const body = { model, prompt, images: references.map(image_url => ({ image_url })) };
    if (options.size) body.size = options.size;
    if (options.background === 'transparent') body.background = 'transparent';
    if (options.outputFormat === 'png') body.output_format = 'png';
    return body;
}

function getWechatImageEditCompatibility(result, options, jsonEdit) {
    if (![400, 415, 422].includes(result.status)) return '';
    const detail = result.details || {};
    const text = [detail.param, detail.code, detail.message || result.error].join(' ');
    if (/content[_ ]policy|safety|moderation|quota|billing|api.?key|authentication|unauthorized|rate.?limit|审核|安全策略|余额|额度/i.test(text)) return '';
    const rejected = /unsupported|not.?supported|does not support|not allowed|unknown|unrecognized|unexpected|extra[_ ](?:field|input)|invalid|must be|only support|不支持|不接受|未知|无效|只支持/i.test(text);
    if (rejected && options.background && /background|transparent|透明|背景参数/i.test(text)) return 'background';
    if (rejected && options.outputFormat && /output[_ -]?format|输出格式/i.test(text)) return 'outputFormat';
    if (!jsonEdit && (result.status === 415 || /multipart|content[_ -]?type|application\/json|json (?:body|object)|images?.{0,40}(?:required|must be|missing|field)|(?:required|missing).{0,30}\bimages?\b|请求.{0,8}格式/i.test(text))) return 'json';
    return '';
}

function getWechatImageApiErrorDetails(error, apiKey = '') {
    let payload;
    try { payload = typeof error === 'string' ? JSON.parse(error) : error; } catch (_) { payload = null; }
    const detail = payload?.error && typeof payload.error === 'object' ? payload.error : payload;
    const validation = Array.isArray(detail?.detail) ? detail.detail.map(item => [Array.isArray(item?.loc) ? item.loc.join('.') : '', item?.msg || ''].filter(Boolean).join(': ')).join('; ') : '';
    let message = String(detail?.message || validation || detail?.detail || (typeof payload?.error === 'string' ? payload.error : '') || error || '图片生成失败');
    if (apiKey) message = message.split(String(apiKey)).join('[密钥已隐藏]');
    message = message.replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [已隐藏]').replace(/\bsk-[a-z0-9_-]{6,}/gi, '[密钥已隐藏]').replace(/data:image\/[^\s"'<>]+/gi, '[图片数据]').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
    return { message, code: typeof detail?.code === 'string' ? detail.code.slice(0, 100) : '', param: typeof detail?.param === 'string' ? detail.param.slice(0, 100) : '' };
}

function isWechatImageReferenceRetryable(result) {
    if (!result || result.ok) return false;
    const status = Number(result.status || 0);
    const error = String(result.error || '');
    return [400, 415, 422, 500].includes(status)
        || /参考图|图生图|reference|image|multipart|form|format/i.test(error);
}

function shouldWechatUseImageEditEndpoint(baseUrl, imageModel) {
    const model = String(imageModel || '').toLowerCase();
    const host = (() => {
        try { return new URL(baseUrl).host.toLowerCase(); } catch (e) { return String(baseUrl || '').toLowerCase(); }
    })();
    return /(^|[-_/])(gpt-image|chatgpt-image|dall-e-2)/i.test(model) || /api\.openai\.com|openai/i.test(host);
}

async function buildWechatImageEditFormData(imageModel, prompt, referenceImage, options = {}) {
    const references = Array.isArray(options.referenceImages) && options.referenceImages.length ? options.referenceImages : [referenceImage];
    const blobs = await Promise.all(references.map(getWechatReferenceImageBlob));
    if (blobs.some(blob => !blob)) return null;
    const form = new FormData();
    form.append('model', imageModel);
    form.append('prompt', prompt);
    blobs.forEach((blob, index) => form.append(blobs.length > 1 ? 'image[]' : 'image', blob, `character-reference-${index + 1}.${blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'}`));
    if (options.size) form.append('size', options.size);
    // https://developers.openai.com/api/docs/guides/image-generation
    if (options.background === 'transparent') form.append('background', 'transparent');
    if (options.outputFormat === 'png') form.append('output_format', 'png');
    return form;
}

async function getWechatReferenceImageBlob(referenceImage) {
    const source = String(referenceImage || '').trim();
    if (!source) return null;
    if (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(source)) {
        const resp = await fetch(source);
        return resp.ok ? resp.blob() : null;
    }
    return null;
}

function normalizeWechatImageApiError(error, status = 0) {
    const text = getWechatImageApiErrorDetails(error).message;
    if (/Failed to fetch|NetworkError|Load failed/i.test(text)) {
        return '未能读取生图结果：网络连接失败，或浏览器拦截了服务返回。请检查生图地址、网络和跨域／代理设置。';
    }
    if (/abort|timeout|timed out/i.test(text)) return '等待生图结果超时，本次尚未收到可用图片。请检查生图服务的任务状态或网络后再重试。';
    if (status === 401 || status === 403 || /invalid api key|unauthorized|forbidden|incorrect api key/i.test(text)) {
        return '生图 API Key 无效或没有生图权限，请检查 Key、额度和该模型权限。';
    }
    if (status === 429) return '生图服务暂时限流或额度不足：' + text;
    if (status === 404 || status === 405) return '当前生图接口不可用，请检查生图设置中的地址及图生图支持情况。服务返回：' + text;
    if ([400, 415, 422].includes(status)) {
        if (/background|transparent|output[_ -]?format|透明|背景参数|输出格式/i.test(text)) return '生图服务不接受当前输出设置：' + text;
        return '生图服务拒绝了这次请求：' + text;
    }
    return status >= 500 ? `生图服务暂时出错（HTTP ${status}）：${text}` : text;
}

function getWechatImageReferenceForChar(char) {
    const config = (char && char.chatConfig) || {};
    const reference = String(config.imageReference || '').trim();
    if (reference) return reference;
    const avatar = String((char && char.avatar) || '').trim();
    if (avatar && avatar !== DEFAULT_AVATAR) return avatar;
    return '';
}

function normalizeWechatImagePromptSource(value, maxLength = 1400) {
    const text = cleanWechatVisibleContent(value)
        .replace(/\r\n/g, '\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim();
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength)}\n...` : text;
}

function getWechatImageAppearanceHints(text, maxLength = 1600) {
    const source = normalizeWechatImagePromptSource(text, 6000);
    if (!source) return '';
    const appearancePattern = /(外貌|外观|长相|样貌|容貌|脸|五官|眼|瞳|发型|发色|头发|刘海|肤色|身高|体型|身材|服装|穿着|衣服|制服|裙|配饰|耳朵|尾巴|翅膀|角|纹身|气质|画风|appearance|looks?|face|eyes?|hair|skin|height|body|figure|outfit|clothes|dress|uniform|style)/i;
    const lines = source
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean);
    const hits = lines.filter(line => appearancePattern.test(line));
    const picked = (hits.length ? hits : lines).slice(0, hits.length ? 18 : 10).join('\n');
    return picked.length > maxLength ? `${picked.slice(0, maxLength)}\n...` : picked;
}

function buildWechatCharacterImageSourceText(char) {
    if (!char) return '';
    const parts = [];
    const pushPart = (label, value, limit = 1400) => {
        const text = normalizeWechatImagePromptSource(value, limit);
        if (text) parts.push(`【${label}】\n${text}`);
    };
    pushPart('角色卡', char.description, 2800);
    pushPart('开场白', char.first_mes_original || char.first_mes, 900);
    const worldBookEntries = Array.isArray(char.worldBook) ? char.worldBook : [];
    const worldBookText = worldBookEntries
        .filter(entry => entry && entry.enabled !== false)
        .map(entry => {
            const key = entry.name || entry.title || entry.key || entry.keys || '世界书';
            const content = entry.content || entry.text || entry.entry || entry.value || entry.comment || '';
            return normalizeWechatImagePromptSource(`${key}：${content}`, 520);
        })
        .filter(Boolean)
        .filter(line => /外貌|外观|长相|样貌|眼|发|服装|穿着|身体|气质|appearance|hair|eye|face|outfit|style/i.test(line))
        .slice(0, 8)
        .join('\n');
    pushPart('世界书外观线索', worldBookText, 1800);
    const config = char.chatConfig || {};
    pushPart('角色公开签名/气质', config.signature || config.profileBio, 500);
    return parts.join('\n\n').slice(0, 5200);
}

function buildWechatCharacterImagePrompt(char, prompt, caption = '') {
    const config = (char && char.chatConfig) || {};
    const displayName = char ? getWechatCharDisplayName(char) : '角色';
    const rawPrompt = String(prompt || caption || '角色自拍').trim();
    const characterImageSource = buildWechatCharacterImageSourceText(char);
    const appearanceHints = getWechatImageAppearanceHints(characterImageSource, 1800);
    const wantsLiveAction = /(?:真人|现实|三次元|写实真人|真实人像|真人照片|现实照片|现实自拍|live\s*action|photorealistic human)/i.test(rawPrompt);
    return [
        `任务：生成一张${displayName}在微信聊天里发给用户的图片/照片。`,
        `这张图必须画的是角色本人，不是泛泛的路人、网图、真人帅哥、他人照片或聊天截图。`,
        `用户/剧情要求：${rawPrompt}`,
        `角色显示名：${displayName}`,
        config.signature ? `角色公开签名/气质：${config.signature}` : '',
        appearanceHints ? `角色卡外观重点：\n${appearanceHints}` : '',
        characterImageSource ? `角色卡/人设原文：\n${characterImageSource}` : '',
        `参考图规则：如果提供了参考图，参考图优先级高于所有文字描述。必须保持参考图里的同一张脸、发型发色、刘海/眼睛特征、肤色、年龄感、气质、服饰倾向、配色和整体辨识度，只允许改变姿势、表情、光线、构图和场景。`,
        wantsLiveAction
            ? `用户明确要求真人/现实风格时，才可以把参考图转成写实真人，但仍必须保留参考图的脸部结构、发型、五官气质和辨识度。`
            : `如果参考图是动漫、插画、头像、半身人设图或二次元风格，必须保持二次元/插画画风，不要真人化，不要生成三次元真人照片。`,
        `画面要求：像角色在微信里发来的新图片，主体清楚，构图自然，符合当前聊天语境。`,
        `禁止：文字水印、聊天气泡、界面截图、扭曲手指、换脸、换发型、换角色、生成与参考图无关的真人。`
    ].filter(Boolean).join('\n');
}

async function resolveWechatAiGeneratedImage(char, msg) {
    if (!char || !msg || msg.type !== 'image' || !msg.imagePending) return;
    msg.imageResolving = true;
    const activity = typeof beginWechatToolActivity === 'function' ? beginWechatToolActivity(char, 'image', '生成图片', msg.imagePrompt || msg.description || '角色照片', msg.timestamp) : null;
    let completed = false;
    let outcome = '';
    try {
        if (typeof getWechatAgentPreferences === 'function' && !getWechatAgentPreferences(char).allowImages) throw new Error('该角色的生成图片权限已关闭');
        const reference = getWechatImageReferenceForChar(char);
        const prompt = buildWechatCharacterImagePrompt(char, msg.imagePrompt || msg.description || '微信聊天照片', msg.description || '');
        const result = await callWechatImageGenerationApi(prompt, {
            usageChar: char,
            referenceImage: reference,
            size: msg.imageSize || '1024x1024',
            requireReference: !!reference
        });
        if (!(window.myCharacters || []).includes(char)) throw new Error('角色已移除，未保存图片');
        if (!result?.ok || !result.url) throw new Error(result?.error || '图片生成失败');
        if (typeof result.url !== 'string' || !/^(?:https?:\/\/|data:image\/)/i.test(result.url)) throw new Error('图片接口返回的图片地址格式不正确');
        msg.content = result.url;
        msg.imageUrl = result.url;
        msg.imagePending = false;
        msg.imageError = '';
        delete msg.imageResolving;
        delete msg.imageSaveError;
        if (await saveCharactersToStorage() === false) throw new Error('图片已生成，但保存失败；请重新打开相册重试保存，再关闭页面。');
        if (typeof window.recordWechatGeneratedImageToAlbum === 'function') await window.recordWechatGeneratedImageToAlbum(char, msg);
        completed = true;
        outcome = '图片已保存到聊天和相册';
    } catch (error) {
        msg.imagePending = false;
        outcome = error.message || '图片生成或保存失败';
        if (!msg.imageUrl) msg.imageError = outcome;
        else { msg.imageSaveError = outcome; window._chatAlbumSaveError = outcome; }
        if (typeof showWechatToast === 'function') showWechatToast(outcome);
    } finally {
        delete msg.imageResolving;
        if (activity) await finishWechatToolActivity(char, activity, completed, outcome);
        if (window.currentChatCharId === char.id) refreshChatView(char);
        renderChatList();
    }
}

