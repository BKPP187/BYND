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
    const fishAudioVoiceApi = normalizeFishAudioVoiceApiData(data.fishAudioVoiceApi || data.fishVoiceApi || {});
    const elevenLabsVoiceApi = normalizeElevenLabsVoiceApiData(data.elevenLabsVoiceApi || data.elevenlabsVoiceApi || {});
    const localVoiceApi = normalizeLocalVoiceApiData(data.localVoiceApi || data.localTtsApi || {});
    return {
        ...data,
        apis,
        defaultId,
        imageDefaultId,
        voiceApi,
        openAiVoiceApi,
        fishAudioVoiceApi,
        elevenLabsVoiceApi,
        localVoiceApi,
        voiceDefaultProvider: normalizeVoiceDefaultProvider(
            data.voiceDefaultProvider,
            voiceApi,
            localVoiceApi,
            openAiVoiceApi,
            elevenLabsVoiceApi,
            fishAudioVoiceApi
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

function normalizeFishAudioVoiceApiData(api) {
    api = api && typeof api === 'object' ? api : {};
    const format = String(api.voiceFormat || api.format || 'mp3').toLowerCase();
    return {
        provider: 'fish-audio',
        enabled: !!api.enabled,
        name: api.name || 'Fish Audio',
        baseUrl: api.baseUrl || 'https://api.fish.audio/compat/v1',
        apiKey: api.apiKey || '',
        voiceModel: api.voiceModel || api.model || 'fish-audio/s2.1-pro-free',
        voiceId: api.voiceId || api.voice || api.referenceId || '',
        voiceEndpoint: api.voiceEndpoint || api.endpoint || '',
        voiceFormat: ['mp3', 'wav', 'opus'].includes(format) ? format : 'mp3',
        voiceSpeed: api.voiceSpeed || api.speed || '1',
        _status: api._status || ''
    };
}

function isFishAudioVoiceEnabled(api) {
    const provider = api?.voiceProvider || api?.provider;
    return !!(
        api
        && provider === 'fish-audio'
        && api.enabled !== false
        && String(api.apiKey || '').trim()
        && String(api.voiceModel || api.model || '').trim()
    );
}

function getFishAudioVoiceSummary(api) {
    if (!api) return '';
    const model = String(api.voiceModel || api.model || '').trim() || 'Fish Audio';
    const voice = String(api.voiceId || api.voice || api.referenceId || '').trim();
    return voice ? `${model} · ${voice}` : `${model} · 默认声线`;
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

function normalizeVoiceDefaultProvider(provider, minimaxApi, localApi, openAiApi, elevenLabsApi, fishAudioApi) {
    const saved = ['minimax', 'openai', 'fish-audio', 'elevenlabs', 'local'].includes(provider) ? provider : '';
    if (saved === 'local' && isLocalVoiceEnabled(localApi)) return 'local';
    if (saved === 'minimax' && isApiVoiceEnabled(minimaxApi)) return 'minimax';
    if (saved === 'openai' && isOpenAiVoiceEnabled(openAiApi)) return 'openai';
    if (saved === 'fish-audio' && isFishAudioVoiceEnabled(fishAudioApi)) return 'fish-audio';
    if (saved === 'elevenlabs' && isElevenLabsVoiceEnabled(elevenLabsApi)) return 'elevenlabs';
    if (isApiVoiceEnabled(minimaxApi)) return 'minimax';
    if (isOpenAiVoiceEnabled(openAiApi)) return 'openai';
    if (isFishAudioVoiceEnabled(fishAudioApi)) return 'fish-audio';
    if (isElevenLabsVoiceEnabled(elevenLabsApi)) return 'elevenlabs';
    if (isLocalVoiceEnabled(localApi)) return 'local';
    return saved || 'minimax';
}

