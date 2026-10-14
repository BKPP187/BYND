// Diagnostics are constructed from allowlisted metadata. Never retain arbitrary
// messages, URLs, headers, bodies, stack traces, model names or character data.
(function () {
    'use strict';
    const KEY = 'bynd_diagnostics_v1';
    const LIMIT = 80;
    const providers = ['openai', 'anthropic', 'google', 'deepseek', 'nvidia', 'minimax', 'elevenlabs', 'fish', 'novelai', 'tripo', 'local', 'custom', 'unknown'];
    const modules = ['chat', 'image', 'voice', 'models', 'mcp', 'storage', 'settings', 'wechat', 'home3d', 'comic', 'coreading', 'runtime', 'network', 'diagnostics'];
    const stages = ['configuration', 'request', 'http', 'response', 'parse', 'stream', 'save', 'export', 'send', 'runtime'];
    const codes = ['http_error', 'network_error', 'timeout', 'cancelled', 'invalid_response', 'empty_response', 'missing_api', 'missing_model', 'storage_error', 'runtime_error', 'export_error', 'send_error'];
    const errorTypes = ['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'QuotaExceededError', 'SecurityError', 'AbortError', 'TimeoutError'];
    const pick = (list, value, fallback) => list.includes(value) ? value : fallback;
    function cleanRecord(item) {
        const at = Number(item?.at);
        const status = Number(item?.httpStatus);
        return {
            at: Number.isFinite(at) && at > 0 && at <= Date.now() ? new Date(at).toISOString() : new Date().toISOString(),
            module: pick(modules, item?.module, 'runtime'),
            stage: pick(stages, item?.stage, 'runtime'),
            provider: pick(providers, item?.provider, 'unknown'),
            httpStatus: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
            code: pick(codes, item?.code, 'runtime_error'),
            errorType: pick(errorTypes, item?.errorType, 'unknown')
        };
    }
    let records = [];
    let persistenceAvailable = true;
    try {
        const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
        if (Array.isArray(stored)) records = stored.slice(-LIMIT).map(item => cleanRecord({ ...item, at: Date.parse(item?.at) }));
    } catch (_) { persistenceAvailable = false; }

    function record(metadata) {
        // Only cleanRecord's fixed fields ever reach memory or localStorage.
        try {
            records.push(cleanRecord({ ...metadata, at: Date.now() }));
            records = records.slice(-LIMIT);
            try { localStorage.setItem(KEY, JSON.stringify(records)); persistenceAvailable = true; }
            catch (_) { persistenceAvailable = false; }
        } catch (_) { /* Diagnostics must not break the original operation. */ }
    }
    function providerOf(baseUrl) {
        try {
            const host = new URL(baseUrl).hostname.toLowerCase();
            if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return 'local';
            const domains = { openai: ['openai.com'], anthropic: ['anthropic.com'], google: ['googleapis.com'], deepseek: ['deepseek.com'], nvidia: ['nvidia.com'], minimax: ['minimax.io', 'minimax.chat'], elevenlabs: ['elevenlabs.io'], fish: ['fish.audio'], novelai: ['novelai.net'], tripo: ['tripo3d.ai'] };
            for (const [provider, list] of Object.entries(domains)) if (list.some(domain => host === domain || host.endsWith('.' + domain))) return provider;
            return 'custom'; // Custom hostnames may contain account IDs or credentials.
        } catch (_) { return 'unknown'; }
    }
    function moduleOf(url) {
        try {
            const route = new URL(url, window.location?.href).pathname;
            if (/\/chat\/completions|\/messages$|:generateContent|:streamGenerateContent/.test(route)) return 'chat';
            if (/\/images\/|\/ai\/generate-image|\/tripo\//.test(route)) return 'image';
            if (/\/audio\/|\/text-to-speech|\/tts|\/voices|\/speech/.test(route)) return 'voice';
            if (/\/models(?:\/|$)/.test(route)) return 'models';
            if (/\/mcp(?:\/|$)/.test(route)) return 'mcp';
        } catch (_) {}
        return 'network';
    }
    function codeOf(error) {
        if (error?.name === 'TimeoutError') return 'timeout';
        if (error?.name === 'AbortError') return 'cancelled';
        if (error?.name === 'QuotaExceededError') return 'storage_error';
        if (error?.name === 'SyntaxError') return 'invalid_response';
        return 'runtime_error';
    }
    function errorModule(error, filename = '') {
        // Inspect a source location only to select a fixed module name. Paths and
        // full stacks are never retained, including filenames with URL tokens.
        const source = (String(filename) + '\n' + String(error?.stack || '')).replaceAll('\\', '/');
        for (const [module, route] of [
            ['storage', '/core/storage/'], ['chat', '/core/api/chat-api.js'],
            ['image', '/core/api/image-generation.js'], ['image', '/core/api/novelai.js'],
            ['mcp', '/core/api/mcp.js'], ['diagnostics', '/core/diagnostics/'],
            ['settings', '/apps/settings/'], ['wechat', '/apps/wechat/'],
            ['home3d', '/apps/home3d/'], ['comic', '/apps/comic/'], ['coreading', '/apps/coreading/']
        ]) if (source.includes(route)) return module;
        return 'runtime';
    }
    function environment() {
        const nav = window.navigator || {};
        const ua = String(nav.userAgent || '');
        return {
            os: /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && nav.maxTouchPoints > 1) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'unknown',
            browser: /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome/WebView' : /Safari\//.test(ua) ? 'Safari' : 'unknown',
            runtime: window.location?.protocol === 'file:' && window.ByndAndroid ? 'android-webview' : window.location?.protocol === 'bynd-app:' ? 'ios-webview' : window.Capacitor?.isNativePlatform?.() ? 'native' : 'web',
            online: typeof nav.onLine === 'boolean' ? nav.onLine : null,
            viewport: { width: Math.max(0, Math.min(10000, Number(window.innerWidth) || 0)), height: Math.max(0, Math.min(10000, Number(window.innerHeight) || 0)) }
        };
    }
    function build() {
        const configured = [];
        try {
            const data = JSON.parse(localStorage.getItem('my_api_data') || '{}');
            for (const api of Array.isArray(data.apis) ? data.apis : []) {
                configured.push({ provider: providerOf(api?.baseUrl), chatConfigured: !!api?.model, imageConfigured: !!api?.imageModel, selectedForChat: !!api?.id && api.id === data.defaultId, selectedForImage: !!api?.id && api.id === data.imageDefaultId });
            }
            for (const [field, provider] of [['voiceApi', 'minimax'], ['openAiVoiceApi', 'openai'], ['fishAudioVoiceApi', 'fish'], ['elevenLabsVoiceApi', 'elevenlabs'], ['localVoiceApi', 'local']]) {
                if (data[field]?.enabled) configured.push({ provider, voiceConfigured: !!(data[field].voiceModel || data[field].model) });
            }
        } catch (_) { record({ module: 'settings', stage: 'configuration', code: 'invalid_response' }); }
        return {
            format: 'BYND_REDACTED_DIAGNOSTICS', schemaVersion: 1,
            appVersion: typeof APP_VERSION === 'string' && /^v\d+\.\d+\.\d+$/.test(APP_VERSION) ? APP_VERSION : 'unknown',
            exportedAt: new Date().toISOString(), environment: environment(), providers: configured.slice(0, 40),
            collection: { maxErrors: LIMIT, persistenceAvailable, rawMessagesCollected: false, requestBodiesCollected: false, secretsCollected: false, customProviderHostsCollected: false },
            recentErrors: records.map(item => cleanRecord({ ...item, at: Date.parse(item.at) }))
        };
    }
    function status(text, failed = false) {
        const node = document.getElementById('bynd-diagnostics-status');
        if (node) { node.textContent = text; node.dataset.error = String(failed); }
    }
    function preview() {
        try {
            const node = document.getElementById('bynd-diagnostics-preview');
            if (node) node.textContent = JSON.stringify(build(), null, 2);
        } catch (_) { status('诊断包生成失败，请重试。', true); }
    }
    function render() {
        const select = document.getElementById('bynd-diagnostics-character');
        if (!select) return;
        const previous = select.value;
        select.replaceChildren();
        const empty = document.createElement('option');
        empty.value = ''; empty.textContent = '选择协助排查的角色'; select.appendChild(empty);
        for (const char of window.myCharacters || []) {
            if (!char?.id || char.isGroupChat) continue;
            const option = document.createElement('option');
            option.value = String(char.id); option.textContent = char.chatConfig?.nickname || char.name || '角色';
            select.appendChild(option);
        }
        select.value = previous;
    }
    let exporting = false;
    async function exportPackage() {
        if (exporting) return false;
        exporting = true;
        let url, anchor;
        const button = document.getElementById('bynd-diagnostics-export');
        if (button) button.disabled = true;
        try {
            const pack = build();
            const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
            const filename = `BYND-diagnostics-${pack.appVersion}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            // Reuse the native JSON writer: blob anchors cannot save in Android's
            // WebView. Its promise resolves only after the OS confirms writing.
            const nativeExport = window.exportByndBackupThroughAndroid?.(blob, filename);
            if (nativeExport) {
                status('请选择诊断包保存位置…');
                await nativeExport;
                status('诊断包已保存到所选位置。');
                return true;
            }
            url = URL.createObjectURL(blob);
            anchor = document.createElement('a'); anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor); anchor.click();
            status('已发起诊断包下载，请在下载列表确认文件。');
            return true;
        } catch (_) {
            record({ module: 'diagnostics', stage: 'export', code: 'export_error' });
            status('诊断包导出失败，请重试或检查下载权限。', true); return false;
        } finally {
            anchor?.remove();
            if (url) setTimeout(() => URL.revokeObjectURL(url), 30000);
            exporting = false;
            if (button) button.disabled = false;
        }
    }
    let sending = false;
    async function sendToCharacter() {
        if (sending) return false;
        const id = document.getElementById('bynd-diagnostics-character')?.value;
        const char = (window.myCharacters || []).find(item => String(item.id) === id && !item.isGroupChat);
        if (!char) { status('请先选择一个角色。', true); return false; }
        if (typeof window.saveCharactersToStorage !== 'function' || typeof window.openApp !== 'function' || typeof window.openChat !== 'function') {
            status('角色聊天尚未准备好，未发送。', true); return false;
        }
        sending = true;
        let message, saved = false;
        try {
            const pack = build();
            message = { type: 'text', isMe: true, timestamp: Date.now(), content: '请帮我排查 BYND 的故障。下面是我主动分享的脱敏诊断包，只有技术元数据，没有聊天、密钥或原始报错。请区分已知事实和猜测，解释失败阶段，给出简单、可撤销的操作建议；你尚未获得自动修改设置或代码的权限，不要声称已修复。网络请求失败时也可能无法收到你的回复。\n' + JSON.stringify(pack, null, 2) };
            if (!Array.isArray(char.history)) char.history = [];
            char.history.push(message);
            if (await window.saveCharactersToStorage() !== true) throw new Error('save_failed');
            saved = true;
            window.openApp('wechat'); window.openChat(char.id);
            window.renderChatList?.(); window.refreshChatView?.(char);
            status('诊断包已保存到所选角色的聊天，点闪光按钮请它分析。');
            window.showWechatToast?.('诊断包已发送，点闪光按钮请角色分析');
            return true;
        } catch (_) {
            if (!saved && message) { const index = char.history.indexOf(message); if (index >= 0) char.history.splice(index, 1); }
            record({ module: 'diagnostics', stage: 'send', code: 'send_error' });
            status(saved ? '诊断包已保存，但打开聊天失败，请从聊天列表进入。' : '诊断包未能保存到聊天，未发送，请重试。', true);
            return false;
        } finally { sending = false; }
    }
    window.ByndDiagnostics = { record, providerOf, codeOf, build, preview, render, exportPackage, sendToCharacter };

    // Observe only status metadata. Do not read responses or alter retry/abort semantics.
    if (typeof window.fetch === 'function') {
        const original = window.fetch;
        window.fetch = async function (...args) {
            let provider = 'unknown', module = 'network';
            try { const url = typeof args[0] === 'string' || args[0] instanceof URL ? String(args[0]) : args[0]?.url; provider = providerOf(url); module = moduleOf(url); } catch (_) {}
            try {
                const response = await original.apply(this, args);
                if (!response.ok) record({ module, provider, stage: 'http', httpStatus: response.status, code: 'http_error' });
                return response;
            } catch (error) {
                const code = codeOf(error);
                record({ module, provider, stage: 'request', code: code === 'runtime_error' ? 'network_error' : code, errorType: error?.name });
                throw error;
            }
        };
    }
    window.addEventListener('error', event => {
        record({ module: errorModule(event.error, event.filename), stage: 'runtime', code: codeOf(event.error), errorType: event.error?.name });
    });
    window.addEventListener('unhandledrejection', event => {
        record({ module: errorModule(event.reason), stage: 'runtime', code: codeOf(event.reason), errorType: event.reason?.name });
    });
    // Console callers may pass private text. Inspect only Error.name and emit enums.
    for (const level of ['error', 'warn']) {
        const original = window.console?.[level];
        if (typeof original !== 'function') continue;
        window.console[level] = function (...args) {
            const error = args.find(item => item instanceof Error);
            const code = codeOf(error);
            record({ module: code === 'storage_error' ? 'storage' : errorModule(error), stage: code === 'storage_error' ? 'save' : 'runtime', code, errorType: error?.name });
            return original.apply(this, args);
        };
    }
})();
