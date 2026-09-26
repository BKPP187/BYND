// NovelAI image generation. image.novelai.net answers CORS for any origin, so the
// browser talks to it directly with the user's own persistent token (never a relay).
// Request shape follows NovelAI's own client: https://docs.novelai.net/en/image
const NOVELAI_IMAGE_ENDPOINT = 'https://image.novelai.net/ai/generate-image';
const NOVELAI_SUBSCRIPTION_ENDPOINT = 'https://image.novelai.net/user/subscription';
const NOVELAI_OPUS_FREE_MAX_PIXELS = 1024 * 1024;
const NOVELAI_OPUS_FREE_MAX_STEPS = 28;
// NovelAI runs one generation per account at a time; space requests like its client does.
const NOVELAI_REQUEST_GAP_MS = 2000;
const NOVELAI_REQUEST_TIMEOUT_MS = 180000;

// Undesired-content presets, copied from https://docs.novelai.net/en/image/undesiredcontent
const NOVELAI_UC_PRESETS = {
    v45Full: {
        heavy: 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page',
        light: 'lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page',
        human: 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy'
    },
    v45Curated: {
        heavy: 'blurry, lowres, upscaled, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, negative space, blank page',
        light: 'blurry, lowres, upscaled, artistic error, scan artifacts, jpeg artifacts, logo, too many watermarks, negative space, blank page',
        human: 'blurry, lowres, upscaled, artistic error, film grain, scan artifacts, bad anatomy, bad hands, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, @_@, mismatched pupils, glowing eyes, negative space, blank page'
    },
    v4Full: {
        heavy: 'blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, multiple views, logo, too many watermarks',
        light: 'blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing',
        human: 'blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, multiple views, logo, too many watermarks, bad anatomy, bad hands'
    },
    v4Curated: {
        heavy: 'blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, logo, dated, signature, multiple views, gigantic breasts',
        light: 'blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing, logo, dated, signature',
        human: 'blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, logo, dated, signature, multiple views, bad anatomy, bad hands'
    },
    v3: {
        heavy: 'lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, extra digits, artistic error, username, scan, [abstract]',
        light: 'lowres, jpeg artifacts, worst quality, watermark, blurry, very displeasing',
        human: 'lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, extra digits, artistic error, username, scan, [abstract], bad anatomy, bad hands, @_@, mismatched pupils, heart-shaped pupils, glowing eyes'
    }
};

// Quality tags are what NovelAI's "Add Quality Tags" toggle appends per model
// (https://docs.novelai.net/en/image/qualitytags). V5 has no published list yet,
// so it reuses the matching V4.5 family.
const NOVELAI_IMAGE_MODELS = [
    { id: 'nai-diffusion-4-5-full', label: 'V4.5 Full', version: 4.5, quality: 'location, very aesthetic, masterpiece, no text', uc: 'v45Full', skipCfg: 58 },
    { id: 'nai-diffusion-4-5-curated', label: 'V4.5 Curated', version: 4.5, quality: 'location, masterpiece, no text, -0.8::feet::, rating:general', uc: 'v45Curated', skipCfg: 58 },
    { id: 'nai-diffusion-5-full', label: 'V5 Full', version: 5, quality: 'very aesthetic, masterpiece, no text', uc: 'v45Full', skipCfg: 0 },
    { id: 'nai-diffusion-5-curated', label: 'V5 Curated', version: 5, quality: 'masterpiece, no text', uc: 'v45Curated', skipCfg: 0 },
    { id: 'nai-diffusion-4-full', label: 'V4 Full', version: 4, quality: 'no text, best quality, very aesthetic, absurdres', uc: 'v4Full', skipCfg: 19 },
    { id: 'nai-diffusion-4-curated-preview', label: 'V4 Curated', version: 4, quality: 'rating:general, amazing quality, very aesthetic, absurdres', uc: 'v4Curated', skipCfg: 19 },
    { id: 'nai-diffusion-3', label: 'Anime V3', version: 3, quality: 'best quality, amazing quality, very aesthetic, absurdres', uc: 'v3', skipCfg: 0 }
];
const NOVELAI_SAMPLERS = ['k_euler_ancestral', 'k_euler', 'k_dpmpp_2s_ancestral', 'k_dpmpp_2m_sde', 'k_dpmpp_2m', 'k_dpmpp_sde'];
const NOVELAI_NOISE_SCHEDULES = ['karras', 'exponential', 'polyexponential', 'native'];
const NOVELAI_UC_PRESET_KEYS = ['heavy', 'light', 'human', 'none'];
const NOVELAI_TIER_NAMES = ['Paper（试用）', 'Tablet', 'Scroll', 'Opus'];

function getNovelAiModelMeta(modelId) {
    return NOVELAI_IMAGE_MODELS.find(model => model.id === modelId) || NOVELAI_IMAGE_MODELS[0];
}

function normalizeNovelAiImageSettings(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    const number = (value, min, max, fallback) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
    };
    return {
        enabled: raw.enabled !== false,
        name: String(raw.name || 'NovelAI').slice(0, 40),
        token: String(raw.token || '').trim(),
        model: getNovelAiModelMeta(raw.model).id,
        sampler: NOVELAI_SAMPLERS.includes(raw.sampler) ? raw.sampler : 'k_euler_ancestral',
        noiseSchedule: NOVELAI_NOISE_SCHEDULES.includes(raw.noiseSchedule) ? raw.noiseSchedule : 'karras',
        steps: Math.round(number(raw.steps, 1, 50, 28)),
        scale: Math.round(number(raw.scale, 0, 10, 5) * 10) / 10,
        cfgRescale: Math.round(number(raw.cfgRescale, 0, 1, 0) * 100) / 100,
        qualityTags: raw.qualityTags !== false,
        ucPreset: NOVELAI_UC_PRESET_KEYS.includes(raw.ucPreset) ? raw.ucPreset : 'heavy',
        negative: String(raw.negative || '').slice(0, 2000),
        opusFree: raw.opusFree !== false,
        varietyBoost: !!raw.varietyBoost
    };
}

function isNovelAiImageReady(settings) {
    const normalized = normalizeNovelAiImageSettings(settings);
    return normalized.enabled && !!normalized.token;
}

function joinNovelAiTags(...parts) {
    const seen = new Set();
    const tags = [];
    parts.flat().forEach(part => String(part || '').split(',').forEach(tag => {
        const clean = tag.replace(/\s+/g, ' ').trim();
        const key = clean.toLowerCase();
        if (!clean || seen.has(key)) return;
        seen.add(key);
        tags.push(clean);
    }));
    return tags.join(', ');
}

function removeNovelAiTags(text, drop = []) {
    const blocked = new Set((drop || []).map(tag => String(tag || '').trim().toLowerCase()).filter(Boolean));
    if (!blocked.size) return text;
    return String(text || '').split(',').map(tag => tag.trim()).filter(tag => tag && !blocked.has(tag.toLowerCase())).join(', ');
}

// Sizes must be multiples of 64. Opus subscribers generate for free at up to
// 1024x1024 pixels and 28 steps, so the free mode scales larger requests down.
function fitNovelAiImageSize(width, height, opusFree = true) {
    let w = Math.max(64, Math.round((Number(width) || 832) / 64) * 64);
    let h = Math.max(64, Math.round((Number(height) || 1216) / 64) * 64);
    w = Math.min(w, 2048);
    h = Math.min(h, 2048);
    if (opusFree && w * h > NOVELAI_OPUS_FREE_MAX_PIXELS) {
        const scale = Math.sqrt(NOVELAI_OPUS_FREE_MAX_PIXELS / (w * h));
        w = Math.max(64, Math.floor(w * scale / 64) * 64);
        h = Math.max(64, Math.floor(h * scale / 64) * 64);
        while (w * h > NOVELAI_OPUS_FREE_MAX_PIXELS) {
            if (w >= h) w -= 64;
            else h -= 64;
        }
    }
    return { width: w, height: h };
}

function randomNovelAiSeed() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        return crypto.getRandomValues(new Uint32Array(1))[0] % 4294967295;
    }
    return Math.floor(Math.random() * 4294967295);
}

// input: { prompt, negative, characters: [{ prompt, negative, x, y }], width, height, seed, dropNegative }
function buildNovelAiImagePayload(input = {}, rawSettings = {}) {
    const settings = normalizeNovelAiImageSettings(rawSettings);
    const model = getNovelAiModelMeta(settings.model);
    const size = fitNovelAiImageSize(input.width, input.height, settings.opusFree);
    const steps = settings.opusFree ? Math.min(settings.steps, NOVELAI_OPUS_FREE_MAX_STEPS) : settings.steps;
    const seed = Number.isInteger(input.seed) && input.seed >= 0 ? input.seed % 4294967295 : randomNovelAiSeed();
    const clamp01 = value => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.round(Math.min(0.9, Math.max(0.1, parsed)) * 10) / 10 : 0.5;
    };
    const characters = (Array.isArray(input.characters) ? input.characters : [])
        .filter(item => item && String(item.prompt || '').trim())
        .slice(0, 6)
        .map(item => ({
            prompt: joinNovelAiTags(item.prompt),
            negative: joinNovelAiTags(item.negative),
            center: { x: clamp01(item.x), y: clamp01(item.y) },
            positioned: Number.isFinite(Number(item.x)) || Number.isFinite(Number(item.y))
        }));
    const quality = settings.qualityTags ? model.quality : '';
    const presetUc = settings.ucPreset === 'none' ? '' : (NOVELAI_UC_PRESETS[model.uc] || NOVELAI_UC_PRESETS.v45Full)[settings.ucPreset];
    const negative = joinNovelAiTags(removeNovelAiTags(presetUc, input.dropNegative), settings.negative, input.negative);
    const base = model.version >= 4
        ? joinNovelAiTags(input.prompt, quality)
        : joinNovelAiTags(input.prompt, characters.map(item => item.prompt), quality);
    const parameters = {
        params_version: model.version >= 5 ? 4 : 3,
        width: size.width,
        height: size.height,
        scale: settings.scale,
        sampler: settings.sampler,
        steps,
        n_samples: 1,
        seed,
        extra_noise_seed: seed,
        negative_prompt: negative,
        cfg_rescale: settings.cfgRescale,
        noise_schedule: settings.noiseSchedule,
        prefer_brownian: true,
        legacy: false,
        legacy_v3_extend: false
    };
    if (settings.varietyBoost && model.skipCfg) parameters.skip_cfg_above_sigma = model.skipCfg;
    if (model.version >= 4) {
        const useCoords = characters.length > 1 && characters.some(item => item.positioned);
        Object.assign(parameters, {
            add_original_image: true,
            legacy_uc: false,
            v4_prompt: {
                caption: {
                    base_caption: base,
                    char_captions: characters.map(item => ({ char_caption: item.prompt, centers: [item.center] }))
                },
                use_coords: useCoords,
                use_order: true,
                legacy_uc: false
            },
            v4_negative_prompt: {
                caption: {
                    base_caption: negative,
                    char_captions: characters.map(item => ({ char_caption: item.negative, centers: [item.center] }))
                },
                use_coords: false,
                use_order: false,
                legacy_uc: false
            }
        });
    }
    return { input: base, model: model.id, action: 'generate', parameters };
}

function maskNovelAiSecret(text, token = '') {
    let message = String(text || '');
    if (token) message = message.split(token).join('[Token 已隐藏]');
    return message.replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [已隐藏]').replace(/\bpst-[A-Za-z0-9_-]{6,}/g, '[Token 已隐藏]');
}

function describeNovelAiError(status, rawText = '', token = '') {
    let detail = String(rawText || '');
    try {
        const parsed = JSON.parse(detail);
        detail = parsed?.message || parsed?.error || detail;
    } catch (_) {}
    detail = maskNovelAiSecret(detail, token).replace(/\s+/g, ' ').trim().slice(0, 240);
    const suffix = detail ? `（${detail}）` : '';
    if (status === 401) return `NovelAI Token 无效或已过期，请到 NovelAI 账户设置重新复制 Persistent API Token${suffix}`;
    if (status === 402) return `NovelAI 需要有效订阅，或 Anlas 余额不足以支付这次生成${suffix}`;
    if (status === 403) return `当前 NovelAI 账户不能使用这个模型或参数${suffix}`;
    if (status === 429) return `NovelAI 正在处理同一账户的另一张图，或请求太频繁，自动等待后仍未成功${suffix}`;
    if (status === 400 || status === 422) return `NovelAI 拒绝了这次请求参数${suffix}`;
    if (status >= 500) return `NovelAI 服务暂时出错（HTTP ${status}）${suffix}`;
    return `NovelAI 生图失败（HTTP ${status}）${suffix}`;
}

function describeNovelAiNetworkError(error) {
    const text = String(error?.message || error || '');
    if (error?.name === 'AbortError' && error?.byndCancelled) return '已取消生成';
    if (/abort|timeout|timed out/i.test(text) || error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        return '等待 NovelAI 返回图片超时，这张图没有保存。请检查网络后重试。';
    }
    return '连接 NovelAI 失败：请检查网络或代理能否打开 novelai.net。';
}

async function inflateNovelAiRaw(bytes) {
    if (typeof DecompressionStream !== 'function') throw new Error('当前浏览器无法解压 NovelAI 返回的图片，请更新系统浏览器组件');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function isNovelAiPng(bytes) {
    return bytes && bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

// NovelAI answers with a ZIP holding one PNG. Only stored and deflate entries exist.
async function readNovelAiImageArchive(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (isNovelAiPng(bytes)) return bytes;
    if (bytes.length < 30) throw new Error('NovelAI 返回的图片数据不完整');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== 0x04034b50) throw new Error('NovelAI 返回的不是图片压缩包');
    let method = view.getUint16(8, true);
    let compressedSize = view.getUint32(18, true);
    const flags = view.getUint16(6, true);
    let dataStart = 30 + view.getUint16(26, true) + view.getUint16(28, true);
    if ((flags & 0x08) || !compressedSize) {
        // Sizes live in the central directory when the local header defers them.
        let end = -1;
        for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
            if (view.getUint32(index, true) === 0x06054b50) { end = index; break; }
        }
        if (end < 0) throw new Error('NovelAI 返回的压缩包缺少目录');
        const central = view.getUint32(end + 16, true);
        if (view.getUint32(central, true) !== 0x02014b50) throw new Error('NovelAI 返回的压缩包目录损坏');
        method = view.getUint16(central + 10, true);
        compressedSize = view.getUint32(central + 20, true);
        const localOffset = view.getUint32(central + 42, true);
        dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    }
    const data = bytes.subarray(dataStart, dataStart + compressedSize);
    if (data.length !== compressedSize) throw new Error('NovelAI 返回的图片数据被截断');
    let image;
    if (method === 0) image = data;
    else if (method === 8) image = await inflateNovelAiRaw(data);
    else throw new Error('NovelAI 返回了无法识别的压缩格式');
    if (!isNovelAiPng(image) && !(image[0] === 0xff && image[1] === 0xd8)) throw new Error('NovelAI 压缩包里没有可用图片');
    return image;
}

function novelAiBytesToDataUrl(bytes) {
    const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg' : 'image/png';
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('NovelAI 图片读取失败'));
        reader.readAsDataURL(new Blob([bytes], { type: mime }));
    });
}

let novelAiRequestChain = Promise.resolve();
let novelAiNextRequestAt = 0;
function enqueueNovelAiRequest(task) {
    const run = novelAiRequestChain.then(async () => {
        const wait = novelAiNextRequestAt - Date.now();
        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
        try {
            return await task();
        } finally {
            novelAiNextRequestAt = Date.now() + NOVELAI_REQUEST_GAP_MS;
        }
    });
    novelAiRequestChain = run.catch(() => {});
    return run;
}

function getNovelAiRetryDelayMs(response) {
    const header = response?.headers?.get?.('Retry-After') || '';
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(60000, Math.max(NOVELAI_REQUEST_GAP_MS, seconds * 1000));
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.min(60000, Math.max(NOVELAI_REQUEST_GAP_MS, date - Date.now()));
    return 6000;
}

function createNovelAiSignal(signal, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), timeoutMs);
    const onAbort = () => controller.abort(Object.assign(new Error('cancelled'), { name: 'AbortError', byndCancelled: true }));
    if (signal) {
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
    }
    return {
        signal: controller.signal,
        done() {
            clearTimeout(timer);
            if (signal) signal.removeEventListener('abort', onAbort);
        }
    };
}

function getNovelAiImageSettingsFromStore() {
    if (typeof getNovelAiImageSettings === 'function') return getNovelAiImageSettings();
    return normalizeNovelAiImageSettings({});
}

async function callNovelAiImageGeneration(input = {}, options = {}) {
    const settings = normalizeNovelAiImageSettings(options.settings || getNovelAiImageSettingsFromStore());
    if (!settings.token) return { ok: false, error: '还没有填写 NovelAI Token：设置 → API → 生图 → NovelAI' };
    const payload = buildNovelAiImagePayload(input, settings);
    const startedAt = Date.now();
    const result = await enqueueNovelAiRequest(async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
            if (options.signal?.aborted) return { ok: false, cancelled: true, error: '已取消生成' };
            const guard = createNovelAiSignal(options.signal, Number(options.timeoutMs) || NOVELAI_REQUEST_TIMEOUT_MS);
            try {
                const response = await fetch(NOVELAI_IMAGE_ENDPOINT, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: guard.signal
                });
                if (response.status === 429 && attempt < 2) {
                    await response.text().catch(() => '');
                    guard.done();
                    if (typeof options.onProgress === 'function') options.onProgress('NovelAI 正忙，稍等后自动重试…');
                    await new Promise(resolve => setTimeout(resolve, getNovelAiRetryDelayMs(response)));
                    continue;
                }
                if (!response.ok) {
                    const text = await response.text().catch(() => '');
                    return { ok: false, status: response.status, error: describeNovelAiError(response.status, text, settings.token) };
                }
                const image = await readNovelAiImageArchive(await response.arrayBuffer());
                return {
                    ok: true,
                    url: await novelAiBytesToDataUrl(image),
                    seed: payload.parameters.seed,
                    model: payload.model,
                    width: payload.parameters.width,
                    height: payload.parameters.height,
                    prompt: payload.input
                };
            } catch (error) {
                if (options.signal?.aborted) return { ok: false, cancelled: true, error: '已取消生成' };
                return { ok: false, error: /NovelAI|浏览器|压缩|图片/.test(error?.message || '') ? error.message : describeNovelAiNetworkError(error) };
            } finally {
                guard.done();
            }
        }
        return { ok: false, status: 429, error: describeNovelAiError(429) };
    });
    try {
        window.ByndUsageLedger?.record({
            at: Date.now(), feature: options.usageFeature || 'image', provider: 'NovelAI', apiName: settings.name || 'NovelAI', model: payload.model,
            charId: options.usageChar?.id ?? '', charName: options.usageChar && typeof getWechatCharDisplayName === 'function' ? getWechatCharDisplayName(options.usageChar) : '',
            usage: null, estimated: true, ok: !!result.ok, error: result.ok ? '' : String(result.error || ''),
            durationMs: Date.now() - startedAt, ticket: null, source: null
        });
    } catch (_) {}
    return result;
}

async function testNovelAiImageConnection(rawSettings) {
    const settings = normalizeNovelAiImageSettings(rawSettings);
    if (!settings.token) return { ok: false, error: '请先填写 NovelAI Token' };
    const guard = createNovelAiSignal(null, 20000);
    try {
        const response = await fetch(NOVELAI_SUBSCRIPTION_ENDPOINT, { headers: { Authorization: `Bearer ${settings.token}` }, signal: guard.signal });
        const text = await response.text().catch(() => '');
        if (!response.ok) return { ok: false, status: response.status, error: describeNovelAiError(response.status, text, settings.token) };
        let data = {};
        try { data = JSON.parse(text) || {}; } catch (_) {}
        const tier = Number.isInteger(data.tier) ? data.tier : -1;
        const steps = data.trainingStepsLeft || {};
        const anlas = Number(steps.fixedTrainingStepsLeft || 0) + Number(steps.purchasedTrainingSteps || 0);
        const model = getNovelAiModelMeta(settings.model);
        const usage = data.usage && typeof data.usage === 'object' ? data.usage : null;
        const notes = [];
        if (!data.active) notes.push('订阅未激活，生成会消耗 Anlas');
        else if (tier === 3 && settings.opusFree) notes.push(`Opus 免费档：≤1024×1024、≤${NOVELAI_OPUS_FREE_MAX_STEPS} 步不消耗 Anlas`);
        if (model.version >= 5 && usage && Number.isFinite(Number(usage.percent))) notes.push(`V5 本期剩余 ${Number(usage.percent)}%`);
        return {
            ok: true,
            active: !!data.active,
            tier,
            tierName: NOVELAI_TIER_NAMES[tier] || '未知档位',
            anlas,
            summary: `${data.active ? '订阅有效' : '未订阅'} · ${NOVELAI_TIER_NAMES[tier] || '未知档位'} · Anlas ${anlas}`,
            notes
        };
    } catch (error) {
        return { ok: false, error: describeNovelAiNetworkError(error) };
    } finally {
        guard.done();
    }
}

// Chat pictures arrive as Chinese natural-language prompts. NovelAI's tokenizer
// only reads English/Japanese well, so one background request rewrites them into
// tags. Background mode waits for the chat relay's quiet gap (no request bursts).
async function convertTextToNovelAiPrompt(text, options = {}) {
    if (typeof callChatApi !== 'function') return { ok: false, error: '需要先配置聊天 API 才能把描述转成 NovelAI 标签' };
    const result = await callChatApi([
        {
            role: 'system',
            content: [
                'You convert a picture request into NovelAI Diffusion V4.5 prompts. Reply with JSON only:',
                '{"prompt":"base tags: subject count tags (1boy, 1girl, 2girls...), setting, time, lighting, camera angle, framing, art style","characters":[{"prompt":"one person: boy/girl/other, hair, eyes, body, outfit, expression, pose, action tags with source#/target#/mutual# for interactions","x":0.5,"y":0.5}],"negative":"extra undesired tags or empty"}',
                'Use English Danbooru-style tags, comma separated, no sentences longer than a short clause. Keep every appearance detail from the character sheet (hair colour, eye colour, outfit, accessories) so the person stays recognisable.',
                'One entry in "characters" per visible person, max 4. Omit characters for scenery-only pictures. Never add text, captions, speech bubbles, watermarks or UI.'
            ].join('\n')
        },
        { role: 'user', content: String(text || '').slice(0, 7000) }
    ], {
        max_tokens: 900,
        temperature: 0.4,
        background: true,
        usageFeature: options.usageFeature || 'image-prompt',
        usageChar: options.usageChar
    });
    if (!result?.ok) return { ok: false, error: result?.error || '无法把画面描述转换为 NovelAI 标签' };
    const clean = String(result.content || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    let parsed = null;
    try { parsed = JSON.parse(clean); } catch (_) {
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try { parsed = JSON.parse(clean.slice(start, end + 1)); } catch (_) {}
        }
    }
    if (!parsed || !String(parsed.prompt || '').trim()) return { ok: false, error: '模型没有返回可用的 NovelAI 标签' };
    return {
        ok: true,
        prompt: String(parsed.prompt).slice(0, 1600),
        negative: String(parsed.negative || '').slice(0, 600),
        characters: (Array.isArray(parsed.characters) ? parsed.characters : []).slice(0, 4).map(item => ({
            prompt: String(item?.prompt || '').slice(0, 900),
            x: item?.x,
            y: item?.y
        })).filter(item => item.prompt.trim())
    };
}

if (typeof window !== 'undefined') {
    window.ByndNovelAi = {
        models: NOVELAI_IMAGE_MODELS,
        samplers: NOVELAI_SAMPLERS,
        noiseSchedules: NOVELAI_NOISE_SCHEDULES,
        normalize: normalizeNovelAiImageSettings,
        buildPayload: buildNovelAiImagePayload,
        fitSize: fitNovelAiImageSize,
        generate: callNovelAiImageGeneration,
        test: testNovelAiImageConnection,
        readArchive: readNovelAiImageArchive,
        convertText: convertTextToNovelAiPrompt,
        joinTags: joinNovelAiTags
    };
}
