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
        convertModelToInput();
        convertImageModelToInput();
        if (hintEl) hintEl.textContent = '连接失败，可核对文档后手动填写模型';
        if (imageHintEl) imageHintEl.textContent = '连接失败，可手动填写生图模型后保存';
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

function getApiFishAudioVoiceConfigFromModal() {
    return {
        provider: 'fish-audio',
        enabled: !!document.getElementById('api-fish-voice-enabled')?.checked,
        name: (document.getElementById('api-fish-voice-name')?.value || '').trim() || 'Fish Audio',
        baseUrl: (document.getElementById('api-fish-voice-url')?.value || '').trim(),
        apiKey: (document.getElementById('api-fish-voice-key')?.value || '').trim(),
        voiceModel: (document.getElementById('api-fish-voice-model')?.value || '').trim(),
        voiceId: (document.getElementById('api-fish-voice-id')?.value || '').trim(),
        voiceEndpoint: (document.getElementById('api-fish-voice-endpoint')?.value || '').trim(),
        voiceFormat: (document.getElementById('api-fish-voice-format')?.value || '').trim() || 'mp3',
        voiceSpeed: (document.getElementById('api-fish-voice-speed')?.value || '').trim() || '1'
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

function buildFishAudioVoiceEndpoint(api) {
    const explicit = String(api?.voiceEndpoint || '').trim();
    if (explicit) return explicit;
    const base = String(api?.baseUrl || 'https://api.fish.audio/compat/v1').trim().replace(/\/+$/, '');
    return /\/audio\/speech$/i.test(base) ? base : `${base}/audio/speech`;
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

async function requestFishAudioVoiceAudio(text, apiConfig) {
    const api = normalizeFishAudioVoiceApiData(apiConfig);
    const content = String(text || '').trim();
    if (!content) throw new Error('语音文本为空');
    if (!isFishAudioVoiceEnabled(api)) throw new Error('还没有配置可用的 Fish Audio');

    const format = api.voiceFormat || 'mp3';
    const resp = await fetch(buildFishAudioVoiceEndpoint(api), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'audio/*',
            'Authorization': `Bearer ${api.apiKey}`
        },
        body: JSON.stringify({
            model: api.voiceModel,
            input: content,
            voice: api.voiceId || '',
            response_format: format,
            speed: clampMiniMaxNumber(api.voiceSpeed, 1, 0.5, 2)
        }),
        signal: AbortSignal.timeout(30000)
    });

    const contentType = resp.headers.get('content-type') || '';
    if (resp.ok && /^(audio\/|application\/octet-stream)/i.test(contentType)) {
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
    const errorValue = json?.error;
    const detail = json?.error?.message
        || json?.message
        || json?.detail?.message
        || json?.detail
        || (typeof errorValue === 'string' ? errorValue : '')
        || rawText
        || resp.statusText
        || '请求失败';
    const status = json?.status || json?.error?.status || resp.status;
    if (!resp.ok || errorValue || json?.message) {
        throw new Error(`Fish Audio ${status}: ${String(detail).slice(0, 180)}`);
    }
    throw new Error(`Fish Audio ${status}: 接口没有返回音频数据`);
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
    return requestVoiceAudioWithConfig(text, api);
}

function normalizeCharacterVoiceBinding(binding) {
    const source = binding && typeof binding === 'object' ? binding : {};
    const provider = ['minimax', 'openai', 'fish-audio', 'elevenlabs', 'local'].includes(source.provider)
        ? source.provider
        : '';
    if (!provider) return null;
    return {
        provider,
        voiceModel: String(source.voiceModel || source.model || '').trim().slice(0, 160),
        voiceId: String(source.voiceId || source.voice || source.referenceId || '').trim().slice(0, 240)
    };
}

function getCharacterVoiceBinding(char) {
    return normalizeCharacterVoiceBinding(char?.chatConfig?.voiceBinding);
}

function getVoiceApiByProvider(provider) {
    const data = getApiData();
    if (provider === 'minimax') return normalizeVoiceApiData(data.voiceApi);
    if (provider === 'openai') return normalizeOpenAiVoiceApiData(data.openAiVoiceApi);
    if (provider === 'fish-audio') return normalizeFishAudioVoiceApiData(data.fishAudioVoiceApi);
    if (provider === 'elevenlabs') return normalizeElevenLabsVoiceApiData(data.elevenLabsVoiceApi);
    if (provider === 'local') return normalizeLocalVoiceApiData(data.localVoiceApi);
    return null;
}

function getCharacterVoiceApi(char) {
    const binding = getCharacterVoiceBinding(char);
    if (!binding) return null;
    const savedApi = getVoiceApiByProvider(binding.provider);
    if (!savedApi) return null;
    const api = { ...savedApi, provider: binding.provider };
    if (binding.voiceModel) api.voiceModel = binding.voiceModel;
    if (binding.voiceId) api.voiceId = binding.voiceId;
    return api;
}

async function requestVoiceAudioWithConfig(text, api, char = null) {
    if (!api) throw new Error('还没有配置可用的语音 API');
    const provider = api.provider || api.voiceProvider;
    const startedAt = Date.now();
    // TTS services bill characters, not tokens; the ledger keeps the request with zero estimated tokens.
    const recordUsage = (ok, error = '') => {
        try {
            window.ByndUsageLedger?.record({
                feature: 'voice', provider: api.baseUrl || api.endpoint || (provider === 'minimax' || !provider ? 'https://api.minimax.io' : ''),
                apiName: api.name || provider || 'minimax', model: api.voiceModel || api.model || '',
                charId: char?.id ?? '', charName: char ? (char.chatConfig?.nickname || char.name || '') : '',
                input: 0, output: 0, estimated: true, ok, error, durationMs: Date.now() - startedAt, ticket: null, source: null
            });
        } catch (_) {}
    };
    try {
        const result = await (provider === 'local' ? requestLocalVoiceAudio(text, api)
            : provider === 'openai' ? requestOpenAiVoiceAudio(text, api)
                : provider === 'fish-audio' ? requestFishAudioVoiceAudio(text, api)
                    : provider === 'elevenlabs' ? requestElevenLabsVoiceAudio(text, api)
                        : requestMiniMaxVoiceAudio(text, api));
        recordUsage(true);
        return result;
    } catch (error) {
        recordUsage(false, error?.message || '语音请求失败');
        throw error;
    }
}

async function requestCharacterVoiceAudio(text, char) {
    const binding = getCharacterVoiceBinding(char);
    if (!binding) throw new Error('这个角色还没有绑定付费音色');
    const api = getCharacterVoiceApi(char);
    if (!api) throw new Error('请先在设置 → TTS 配置对应的语音服务');
    return requestVoiceAudioWithConfig(text, api, char);
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

async function testFishAudioVoiceApi(api) {
    try {
        await requestFishAudioVoiceAudio('你好，这是 Fish Audio 语音测试。', api);
        return { ok: true, detail: '(Fish Audio 可用)', models: [], chatModel: '' };
    } catch (e) {
        return { ok: false, error: `Fish Audio 失败：${e.message || e}`, models: [] };
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

async function testFishAudioVoiceApiFromModal() {
    const resultEl = document.getElementById('api-fish-voice-test-result');
    const api = getApiFishAudioVoiceConfigFromModal();
    if (!resultEl) return;
    if (!api.baseUrl && !api.voiceEndpoint) {
        resultEl.innerHTML = '<span style="color:#f87171;">请先填写 Fish Audio Base URL</span>';
        return;
    }
    const testApi = { ...api, enabled: true };
    if (!isFishAudioVoiceEnabled(testApi)) {
        resultEl.innerHTML = '<span style="color:#f87171;">请先填写 API Key 和模型</span>';
        return;
    }
    resultEl.innerHTML = '<span style="color:#fbbf24;">正在请求 Fish Audio...</span>';
    try {
        const result = await requestFishAudioVoiceAudio('你好，这是 Fish Audio 语音测试。', testApi);
        resultEl.innerHTML = '<span style="color:#66d9a0;">Fish Audio 可用，已试听测试音频</span>';
        const audio = new Audio(result.audioUrl);
        audio.play().catch(() => {});
    } catch (e) {
        resultEl.innerHTML = `<span style="color:#f87171;">${escapeHtml(e.message || 'Fish Audio 测试失败')}</span>`;
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
    data.voiceDefaultProvider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, voiceApi, data.localVoiceApi, data.openAiVoiceApi, data.elevenLabsVoiceApi, data.fishAudioVoiceApi);
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
    data.voiceDefaultProvider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, data.voiceApi, data.localVoiceApi, openAiVoiceApi, data.elevenLabsVoiceApi, data.fishAudioVoiceApi);
    saveApiData(data);
    closeApiOpenAiVoiceModal();
    renderApiList();
}

function saveApiFishAudioVoiceSettings() {
    const resultEl = document.getElementById('api-fish-voice-test-result');
    const fishAudioVoiceApi = normalizeFishAudioVoiceApiData(getApiFishAudioVoiceConfigFromModal());
    if (fishAudioVoiceApi.enabled) {
        if (!fishAudioVoiceApi.baseUrl && !fishAudioVoiceApi.voiceEndpoint) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写 Fish Audio Base URL</span>';
            return;
        }
        if (!fishAudioVoiceApi.apiKey) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写 Fish Audio API Key</span>';
            return;
        }
        if (!fishAudioVoiceApi.voiceModel) {
            if (resultEl) resultEl.innerHTML = '<span style="color:#f87171;">请填写 Fish Audio 模型</span>';
            return;
        }
    }
    const data = getApiData();
    data.fishAudioVoiceApi = fishAudioVoiceApi;
    data.voiceDefaultProvider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, data.voiceApi, data.localVoiceApi, data.openAiVoiceApi, data.elevenLabsVoiceApi, fishAudioVoiceApi);
    saveApiData(data);
    closeApiFishAudioVoiceModal();
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
    data.voiceDefaultProvider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, data.voiceApi, data.localVoiceApi, data.openAiVoiceApi, elevenLabsVoiceApi, data.fishAudioVoiceApi);
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
    data.voiceDefaultProvider = normalizeVoiceDefaultProvider(data.voiceDefaultProvider, data.voiceApi, localVoiceApi, data.openAiVoiceApi, data.elevenLabsVoiceApi, data.fishAudioVoiceApi);
    saveApiData(data);
    closeApiLocalVoiceModal();
    renderApiList();
}

function setDefaultVoiceProvider(provider) {
    const data = getApiData();
    const voiceApi = normalizeVoiceApiData(data.voiceApi);
    const openAiVoiceApi = normalizeOpenAiVoiceApiData(data.openAiVoiceApi);
    const fishAudioVoiceApi = normalizeFishAudioVoiceApiData(data.fishAudioVoiceApi);
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
    if (provider === 'fish-audio' && !isFishAudioVoiceEnabled(fishAudioVoiceApi)) {
        alert('Fish Audio 还没有配置完整。');
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

// Sites that refuse browser requests (no CORS) but that BYND proxies through
// its own Worker. The user keeps typing the official Base URL; requests are
// silently routed to the pinned proxy, which never stores keys.
// Every relay is reached on BYND's own domain (bynd.ccwu.cc/mcp/relay/*, see workers/DEPLOY.md),
// from the website and the APK alike.
const BYND_RELAY_ORIGIN = 'https://bynd.ccwu.cc';
const BYND_PINNED_API_PROXIES = [
    { id: 'wisart', hostname: 'wisart.kuaileshifu.com', proxyPath: '/mcp/relay/wisart/v1' },
    { id: 'l0veyou', hostname: 'l0veyou.com', proxyPath: '/mcp/relay/l0veyou/v1' }
];

function getByndPinnedApiProxy(baseUrl) {
    try {
        const url = new URL(String(baseUrl || '').trim());
        if (url.protocol !== 'https:' || url.port || url.search || url.hash || !/^\/v1\/?$/.test(url.pathname)) return null;
        const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
        return BYND_PINNED_API_PROXIES.find(item => item.hostname === hostname) || null;
    } catch (error) {
        return null;
    }
}

function isWisartApiBaseUrl(baseUrl) {
    return getByndPinnedApiProxy(baseUrl)?.id === 'wisart';
}

function isByndProxiedApiBaseUrl(baseUrl) {
    return !!getByndPinnedApiProxy(baseUrl);
}

function resolveByndApiBaseUrl(baseUrl) {
    const original = String(baseUrl || '').trim().replace(/\/+$/, '');
    const proxy = getByndPinnedApiProxy(original);
    if (!proxy) return original;
    return `${BYND_RELAY_ORIGIN}${proxy.proxyPath}`;
}
window.isWisartApiBaseUrl = isWisartApiBaseUrl;
window.isByndProxiedApiBaseUrl = isByndProxiedApiBaseUrl;
window.resolveByndApiBaseUrl = resolveByndApiBaseUrl;

function getApiProxyHint(baseUrl) {
    const pinnedProxy = getByndPinnedApiProxy(baseUrl);
    if (pinnedProxy) {
        return `BYND 已自动通过固定代理连接 ${pinnedProxy.hostname}；请确认 Worker 已部署、API Key 有效，并重试。`;
    }
    if (isNvidiaApiBaseUrl(baseUrl)) {
        return 'NVIDIA 接口通常不允许浏览器静态网页直连。请走 BYND AI Proxy Worker：Worker 不保存 key；网页 Base URL 填 Worker 地址，API Key 继续填用户自己的 NVIDIA key。';
    }
    return '这个接口可能不允许浏览器直连。请换成支持 CORS 的 OpenAI 兼容中转站，或走 BYND AI Proxy Worker。';
}

