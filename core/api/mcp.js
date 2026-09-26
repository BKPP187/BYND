// --- MCP repository discovery and Remote MCP ---
const GITHUB_MCP_DEFAULT_URL = 'https://api.githubcopilot.com/mcp/';
const GITHUB_MCP_ANDROID_PROXY_URL = 'https://bynd.ccwu.cc/mcp/bridge';
const GITHUB_MCP_PROTOCOL_VERSION = '2025-11-25';
const GITHUB_MCP_CONFIG_KEY = 'bynd_github_mcp_config_v1';
const GITHUB_MCP_TOKEN_KEY = 'bynd_github_mcp_pat_session_v1';
const MCP_TOKEN_STORE_KEY = 'bynd_mcp_tokens_session_v2';
const MCP_DEMO_URL = 'https://bynd.ccwu.cc/mcp/demo';
const GITHUB_MCP_PRESETS = {
    demo: { url: MCP_DEMO_URL, readonly: true },
    default: { url: GITHUB_MCP_DEFAULT_URL, readonly: true },
    readonly: { url: 'https://api.githubcopilot.com/mcp/readonly', readonly: true },
    'all-readonly': { url: 'https://api.githubcopilot.com/mcp/x/all/readonly', readonly: true },
    repos: { url: 'https://api.githubcopilot.com/mcp/x/repos', readonly: true },
    issues: { url: 'https://api.githubcopilot.com/mcp/x/issues', readonly: true },
    pull_requests: { url: 'https://api.githubcopilot.com/mcp/x/pull_requests', readonly: true },
    actions: { url: 'https://api.githubcopilot.com/mcp/x/actions', readonly: true }
};
const githubMcpState = {
    connected: false,
    busy: false,
    requestId: 1,
    sessionId: '',
    serverInfo: null,
    protocolVersion: GITHUB_MCP_PROTOCOL_VERSION,
    tools: [],
    selectedTool: null,
    config: null,
    lastResult: '',
    formTokenScope: ''
};

function loadGitHubMcpConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(GITHUB_MCP_CONFIG_KEY) || '{}');
        return {
            preset: String(saved.preset || 'demo'),
            url: String(saved.url || MCP_DEMO_URL),
            toolsets: String(saved.toolsets || ''),
            readonly: saved.readonly !== false,
            lockdown: saved.lockdown === true
        };
    } catch (_) {
        return { preset: 'demo', url: MCP_DEMO_URL, toolsets: '', readonly: true, lockdown: false };
    }
}

function saveGitHubMcpConfig(config) {
    localStorage.setItem(GITHUB_MCP_CONFIG_KEY, JSON.stringify({
        preset: config.preset,
        url: config.url,
        toolsets: config.toolsets,
        readonly: config.readonly,
        lockdown: config.lockdown
    }));
}

function getMcpTokenScope(serverUrl) {
    try {
        const url = new URL(String(serverUrl || '').trim());
        const hostname = url.hostname.toLowerCase();
        if (hostname === 'api.githubcopilot.com' || /^copilot-api\..+\.ghe\.com$/i.test(hostname)) return `github:${hostname}`;
        return `endpoint:${url.origin}${url.pathname}`;
    } catch (_) {
        return '';
    }
}

function getMcpSessionToken(serverUrl) {
    try {
        const scope = getMcpTokenScope(serverUrl);
        const saved = JSON.parse(sessionStorage.getItem(MCP_TOKEN_STORE_KEY) || '{}');
        if (scope && typeof saved[scope] === 'string') return saved[scope];
        if (scope.startsWith('github:')) return sessionStorage.getItem(GITHUB_MCP_TOKEN_KEY) || '';
    } catch (_) {}
    return '';
}

function setMcpSessionToken(value, serverUrl) {
    try {
        const scope = getMcpTokenScope(serverUrl);
        if (!scope) return;
        const saved = JSON.parse(sessionStorage.getItem(MCP_TOKEN_STORE_KEY) || '{}');
        if (value) saved[scope] = value;
        else delete saved[scope];
        sessionStorage.setItem(MCP_TOKEN_STORE_KEY, JSON.stringify(saved));
        if (scope.startsWith('github:')) {
            if (value) sessionStorage.setItem(GITHUB_MCP_TOKEN_KEY, value);
            else sessionStorage.removeItem(GITHUB_MCP_TOKEN_KEY);
        }
    } catch (_) {}
}

function initMcpApp() {
    const config = githubMcpState.config || loadGitHubMcpConfig();
    githubMcpState.config = config;
    const preset = document.getElementById('mcp-preset-select');
    const url = document.getElementById('mcp-server-url');
    const token = document.getElementById('mcp-token');
    const toolsets = document.getElementById('mcp-toolsets');
    const readonly = document.getElementById('mcp-readonly');
    const lockdown = document.getElementById('mcp-lockdown');
    if (preset) preset.value = GITHUB_MCP_PRESETS[config.preset] ? config.preset : 'custom';
    if (url) url.value = config.url || MCP_DEMO_URL;
    if (toolsets) toolsets.value = config.toolsets || '';
    if (readonly) readonly.checked = config.readonly !== false;
    if (lockdown) lockdown.checked = config.lockdown === true;
    refreshMcpConnectionFormMode({ loadToken: true, force: true });
    renderMcpConnectionState();
    renderMcpTools();
}
window.initMcpApp = initMcpApp;

function applyGitHubMcpPreset(presetId) {
    const preset = GITHUB_MCP_PRESETS[presetId];
    const url = document.getElementById('mcp-server-url');
    const readonly = document.getElementById('mcp-readonly');
    if (preset) {
        if (url) url.value = preset.url;
        if (readonly) readonly.checked = preset.readonly;
    } else if (presetId === 'custom' && url) {
        try {
            if (normalizeMcpServerUrl(url.value).isGitHub) url.value = '';
        } catch (_) {
            url.value = '';
        }
    }
    refreshMcpConnectionFormMode({ loadToken: true, force: presetId === 'custom' });
}
window.applyGitHubMcpPreset = applyGitHubMcpPreset;

function toggleMcpTokenVisibility() {
    const input = document.getElementById('mcp-token');
    const icon = input?.parentElement?.querySelector('button i');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    if (icon) icon.className = input.type === 'password' ? 'ri-eye-line' : 'ri-eye-off-line';
}
window.toggleMcpTokenVisibility = toggleMcpTokenVisibility;

function isPrivateMcpHostname(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host === '::1' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
    if (/^(?:fc|fd|fe8|fe9|fea|feb)[0-9a-f:]*$/i.test(host)) return true;
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
    const match = host.match(/^172\.(\d{1,3})\./);
    if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
    const cgnat = host.match(/^100\.(\d{1,3})\./);
    return !!cgnat && Number(cgnat[1]) >= 64 && Number(cgnat[1]) <= 127;
}

function normalizeMcpServerUrl(value) {
    let url;
    try { url = new URL(String(value || '').trim()); } catch (_) { throw new Error('Server URL 格式不正确'); }
    if (url.username || url.password) throw new Error('Server URL 不能包含用户名或密码');
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'github.com' || hostname === 'www.github.com') {
        throw new Error('GitHub 仓库链接只用于发现配置，不能作为 MCP Server URL');
    }
    const isOfficial = hostname === 'api.githubcopilot.com';
    const isEnterprise = /^copilot-api\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.ghe\.com$/i.test(hostname);
    const isMcpPath = url.pathname === '/mcp' || url.pathname.startsWith('/mcp/');
    const isGitHub = isOfficial || isEnterprise;
    if (isGitHub && (url.protocol !== 'https:' || !isMcpPath)) {
        throw new Error('GitHub Remote MCP 必须使用 HTTPS 的 /mcp 地址');
    }
    if (!isGitHub && url.protocol !== 'https:' && !(url.protocol === 'http:' && isPrivateMcpHostname(hostname))) {
        throw new Error('第三方 MCP 须使用 HTTPS；HTTP 仅允许 localhost 或私有局域网地址');
    }
    url.hash = '';
    return { url: url.toString(), isGitHub, connectionType: isGitHub ? 'github-proxy' : 'direct' };
}

function getGitHubMcpFormConfig() {
    const preset = document.getElementById('mcp-preset-select')?.value || 'custom';
    const normalized = normalizeMcpServerUrl(document.getElementById('mcp-server-url')?.value);
    const token = String(document.getElementById('mcp-token')?.value || '').trim();
    if (normalized.isGitHub && !token) throw new Error('请填写 GitHub Personal Access Token');
    return {
        preset: normalized.isGitHub ? preset : normalized.url === MCP_DEMO_URL ? 'demo' : 'custom',
        url: normalized.url,
        isGitHub: normalized.isGitHub,
        connectionType: normalized.connectionType,
        token,
        toolsets: normalized.isGitHub ? String(document.getElementById('mcp-toolsets')?.value || '').trim() : '',
        readonly: normalized.isGitHub && !!document.getElementById('mcp-readonly')?.checked,
        lockdown: normalized.isGitHub && !!document.getElementById('mcp-lockdown')?.checked
    };
}

function refreshMcpConnectionFormMode(options = {}) {
    const input = document.getElementById('mcp-server-url');
    const token = document.getElementById('mcp-token');
    const preset = document.getElementById('mcp-preset-select');
    const githubOptions = document.getElementById('mcp-github-options');
    const kind = document.getElementById('mcp-connection-kind');
    const icon = document.getElementById('mcp-connection-icon');
    const label = document.getElementById('mcp-token-label');
    const authDetails = document.getElementById('mcp-auth-details');
    const authTitle = document.getElementById('mcp-auth-summary-title');
    const authHint = document.getElementById('mcp-auth-summary-hint');
    const addressHint = document.getElementById('mcp-address-hint-text');
    const securityNote = document.getElementById('mcp-security-note-text');
    let isGitHub = preset?.value !== 'custom';
    let normalized = null;
    try {
        normalized = normalizeMcpServerUrl(input?.value || '');
        isGitHub = normalized.isGitHub;
        if (!isGitHub && preset && !(preset.value === 'demo' && normalized.url === MCP_DEMO_URL)) preset.value = 'custom';
    } catch (_) {
        if (preset?.value === 'custom') isGitHub = false;
    }
    githubOptions?.classList.toggle('hidden', !isGitHub);
    if (kind) kind.textContent = isGitHub ? 'GitHub Remote MCP · 经 BYND 安全代理' : normalized?.url === MCP_DEMO_URL ? 'BYND 示例工具 · 无需密钥' : '第三方 Streamable HTTP · 本机直连';
    if (icon) icon.className = isGitHub ? 'ri-shield-keyhole-line' : 'ri-router-line';
    if (label) label.innerHTML = isGitHub ? 'GitHub Personal Access Token <small>必填</small>' : 'Bearer Token <small>服务器要求时再填</small>';
    if (token) token.placeholder = isGitHub ? 'github_pat_… 或 ghp_…' : '服务器要求时填写 Bearer Token';
    const scope = getMcpTokenScope(normalized?.url || input?.value || '');
    const scopeChanged = !!scope && scope !== githubMcpState.formTokenScope;
    if (token && (options.force || scopeChanged)) {
        token.value = options.loadToken ? getMcpSessionToken(normalized?.url || input?.value || '') : '';
    }
    authDetails?.classList.remove('is-error');
    authDetails?.classList.toggle('is-required', isGitHub);
    if (authTitle) authTitle.textContent = isGitHub ? 'GitHub 认证' : '高级认证';
    if (authHint) authHint.textContent = isGitHub ? 'Personal Access Token 必填' : '服务器要求时再填';
    if (addressHint) addressHint.textContent = isGitHub
        ? 'GitHub 官方 MCP 需要服务地址和 Personal Access Token。'
        : '多数 HTTP MCP 服务只需填写地址，BYND 会自动初始化并读取工具。';
    if (securityNote) securityNote.textContent = isGitHub
        ? 'Token 仅保留在当前会话，不写入日志。'
        : '无需认证时不用填写 Token；凭证只保留在当前会话。';
    if (authDetails) {
        if (isGitHub) authDetails.open = true;
        else if (options.force || scopeChanged) authDetails.open = !!token?.value;
    }
    githubMcpState.formTokenScope = scope;
}

function revealMcpAuthentication(message = '服务器要求认证') {
    const authDetails = document.getElementById('mcp-auth-details');
    const authHint = document.getElementById('mcp-auth-summary-hint');
    authDetails?.classList.add('is-error');
    if (authDetails) authDetails.open = true;
    if (authHint) authHint.textContent = message;
}

function handleMcpServerUrlInput() {
    refreshMcpConnectionFormMode({ loadToken: true });
}
window.handleMcpServerUrlInput = handleMcpServerUrlInput;

function setMcpBusy(busy, label = '') {
    githubMcpState.busy = !!busy;
    const connect = document.getElementById('mcp-connect-btn');
    const call = document.getElementById('mcp-call-btn');
    if (connect) {
        connect.disabled = !!busy;
        connect.querySelector('span').textContent = busy ? (label || '正在连接…') : (githubMcpState.connected ? '重新连接' : '连接并载入工具');
        connect.querySelector('i').className = busy ? 'ri-loader-4-line mcp-spin' : 'ri-plug-line';
    }
    if (call) call.disabled = !!busy;
}

function setMcpStatus(state, text) {
    const pill = document.getElementById('mcp-status-pill');
    const header = document.getElementById('mcp-header-status');
    if (pill) {
        pill.dataset.state = state;
        pill.innerHTML = `<i></i>${desktopEscapeHtml(text)}`;
    }
    if (header) header.textContent = text;
}

function renderMcpConnectionState() {
    const disconnect = document.getElementById('mcp-disconnect-btn');
    const panel = document.getElementById('mcp-tools-panel');
    if (disconnect) disconnect.disabled = !githubMcpState.connected;
    panel?.classList.toggle('hidden', !githubMcpState.connected);
    if (githubMcpState.connected) {
        const name = githubMcpState.serverInfo?.name || 'MCP Server';
        setMcpStatus('connected', `${name} · 已连接`);
    } else if (!githubMcpState.busy) {
        setMcpStatus('idle', '未连接');
    }
    setMcpBusy(githubMcpState.busy);
}

function buildGitHubMcpHeaders(config, includeSession = true, includeProtocol = true) {
    const headers = {
        'Accept': 'application/json, text/event-stream',
        'Content-Type': 'application/json'
    };
    if (config.token) headers['Authorization'] = `Bearer ${config.token}`;
    if (config.isGitHub && includeProtocol) headers['MCP-Protocol-Version'] = githubMcpState.protocolVersion || GITHUB_MCP_PROTOCOL_VERSION;
    if (includeSession && githubMcpState.sessionId) headers['Mcp-Session-Id'] = githubMcpState.sessionId;
    if (config.isGitHub && config.toolsets) headers['X-MCP-Toolsets'] = config.toolsets;
    if (config.isGitHub && config.readonly) headers['X-MCP-Readonly'] = 'true';
    if (config.isGitHub && config.lockdown) headers['X-MCP-Lockdown'] = 'true';
    return headers;
}

function getGitHubMcpProxyUrl(serverUrl) {
    const proxyUrl = window.location.protocol === 'file:'
        ? GITHUB_MCP_ANDROID_PROXY_URL
        : '/mcp/bridge';
    return `${proxyUrl}?url=${encodeURIComponent(serverUrl)}`;
}

async function readMcpEventStream(response, expectedId) {
    if (!response.body?.getReader) {
        const text = await response.text();
        const dataLine = text.split(/\r?\n/).find(line => line.startsWith('data:'));
        return dataLine ? JSON.parse(dataLine.slice(5).trim()) : null;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';
        for (const event of events) {
            const data = event.split(/\r?\n/)
                .filter(line => line.startsWith('data:'))
                .map(line => line.slice(5).trim())
                .join('\n');
            if (!data || data === '[DONE]') continue;
            let message;
            try { message = JSON.parse(data); } catch (_) { continue; }
            if (expectedId == null || message.id === expectedId || message.error) {
                try { await reader.cancel(); } catch (_) {}
                return message;
            }
        }
        if (done) break;
    }
    if (buffer.trim().startsWith('data:')) {
        try { return JSON.parse(buffer.trim().slice(5).trim()); } catch (_) {}
    }
    return null;
}

async function parseGitHubMcpResponse(response, expectedId) {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (response.status === 202 || response.status === 204) return null;
    if (contentType.includes('text/event-stream')) return readMcpEventStream(response, expectedId);
    const text = await response.text();
    if (!text.trim()) return null;
    try { return JSON.parse(text); } catch (_) {
        throw new Error(contentType.includes('text/html')
            ? 'MCP 地址返回了网页而不是协议响应，请检查 Server URL'
            : `服务器返回了无法解析的内容：${text.slice(0, 160)}`);
    }
}

async function sendGitHubMcpPayload(payload, options = {}) {
    const config = githubMcpState.config;
    if (!config) throw new Error('尚未配置 MCP 连接');
    let response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const requestUrl = config.isGitHub ? getGitHubMcpProxyUrl(config.url) : config.url;
    try {
        response = await fetch(requestUrl, {
            method: options.method || 'POST',
            headers: buildGitHubMcpHeaders(config, options.includeSession !== false, options.includeProtocol !== false),
            body: options.method === 'DELETE' ? undefined : JSON.stringify(payload),
            signal: controller.signal
        });
    } catch (error) {
        clearTimeout(timeout);
        if (error?.name === 'AbortError') throw new Error('MCP 请求超时，请检查网络或服务器状态');
        throw new Error(config.isGitHub
            ? `无法访问 MCP 安全代理：${error?.message || '网络连接失败'}`
            : `无法直连 MCP Server：${error?.message || '请确认服务已运行并允许浏览器 CORS 访问'}`);
    }
    try {
        const sessionId = response.headers.get('Mcp-Session-Id');
        if (sessionId) githubMcpState.sessionId = sessionId;
        let parsed = null;
        try {
            parsed = await parseGitHubMcpResponse(response, payload && payload.id);
        } catch (parseError) {
            if (response.ok) throw parseError;
        }
        if (!response.ok) {
            const detail = parsed?.error?.message || parsed?.error || `${response.status} ${response.statusText}`;
            if (response.status === 401 || response.status === 403) {
                if (!config.isGitHub) revealMcpAuthentication(config.token ? 'Token 无效或权限不足' : '此服务需要 Bearer Token');
                throw new Error(config.isGitHub
                    ? 'GitHub Token 无效、权限不足，或该账户未启用远程 MCP'
                    : (config.token ? 'Bearer Token 无效或权限不足' : '此 MCP 服务需要认证，请填写 Bearer Token 后重试'));
            }
            throw new Error(`MCP 请求失败：${detail}`);
        }
        if (parsed?.error) throw new Error(parsed.error.message || JSON.stringify(parsed.error));
        return parsed;
    } catch (error) {
        if (error?.name === 'AbortError') throw new Error('MCP 请求超时，请检查网络或服务器状态');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function callGitHubMcpRpc(method, params = {}, options = {}) {
    const id = githubMcpState.requestId++;
    const response = await sendGitHubMcpPayload({ jsonrpc: '2.0', id, method, params }, options);
    if (!response || response.id !== id) throw new Error(`MCP ${method} 没有返回对应结果`);
    return response.result;
}

async function sendGitHubMcpNotification(method, params = {}) {
    await sendGitHubMcpPayload({ jsonrpc: '2.0', method, params });
}

async function listAllGitHubMcpTools() {
    const tools = [];
    let cursor = '';
    for (let page = 0; page < 8; page++) {
        const result = await callGitHubMcpRpc('tools/list', cursor ? { cursor } : {});
        if (Array.isArray(result?.tools)) tools.push(...result.tools);
        cursor = String(result?.nextCursor || '');
        if (!cursor) break;
    }
    const unique = new Map();
    tools.forEach(tool => { if (tool?.name && !unique.has(tool.name)) unique.set(tool.name, tool); });
    return Array.from(unique.values());
}

async function connectGitHubMcp() {
    if (githubMcpState.busy) return;
    let config;
    try { config = getGitHubMcpFormConfig(); } catch (error) {
        setMcpStatus('error', error.message);
        return;
    }
    githubMcpState.config = config;
    githubMcpState.connected = false;
    githubMcpState.sessionId = '';
    githubMcpState.serverInfo = null;
    githubMcpState.tools = [];
    githubMcpState.selectedTool = null;
    githubMcpState.protocolVersion = GITHUB_MCP_PROTOCOL_VERSION;
    saveGitHubMcpConfig(config);
    setMcpSessionToken(config.token, config.url);
    setMcpBusy(true, '正在初始化…');
    setMcpStatus('connecting', config.isGitHub ? '正在连接 GitHub MCP' : '正在直连 MCP Server');
    closeMcpToolRunner();
    let connectError = '';
    try {
        const initialized = await callGitHubMcpRpc('initialize', {
            protocolVersion: GITHUB_MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'BYND MCP', version: '1.1.704' }
        }, { includeSession: false, includeProtocol: false });
        githubMcpState.protocolVersion = initialized?.protocolVersion || GITHUB_MCP_PROTOCOL_VERSION;
        githubMcpState.serverInfo = initialized?.serverInfo || { name: config.isGitHub ? 'GitHub MCP' : 'MCP Server' };
        await sendGitHubMcpNotification('notifications/initialized', {});
        setMcpBusy(true, '正在读取工具…');
        githubMcpState.tools = await listAllGitHubMcpTools();
        githubMcpState.connected = true;
        renderMcpTools();
        setMcpStatus('connected', `${githubMcpState.serverInfo?.name || 'MCP Server'} · ${githubMcpState.tools.length} 个工具`);
    } catch (error) {
        githubMcpState.connected = false;
        githubMcpState.tools = [];
        githubMcpState.sessionId = '';
        renderMcpTools();
        connectError = error?.message || '连接失败';
    } finally {
        setMcpBusy(false);
        renderMcpConnectionState();
        if (connectError) setMcpStatus('error', connectError);
    }
}
window.connectGitHubMcp = connectGitHubMcp;

async function disconnectGitHubMcp() {
    if (githubMcpState.busy) return;
    const config = githubMcpState.config;
    const hadSession = !!githubMcpState.sessionId;
    try {
        if (config && hadSession) {
            await sendGitHubMcpPayload(null, { method: 'DELETE' });
        }
    } catch (_) {}
    githubMcpState.connected = false;
    githubMcpState.sessionId = '';
    githubMcpState.serverInfo = null;
    githubMcpState.tools = [];
    githubMcpState.selectedTool = null;
    githubMcpState.lastResult = '';
    closeMcpToolRunner();
    renderMcpTools();
    renderMcpConnectionState();
}
window.disconnectGitHubMcp = disconnectGitHubMcp;

function renderMcpTools(filterText = '') {
    const panel = document.getElementById('mcp-tools-panel');
    const list = document.getElementById('mcp-tool-list');
    const count = document.getElementById('mcp-tools-count');
    if (!list || !panel) return;
    panel.classList.toggle('hidden', !githubMcpState.connected);
    const query = String(filterText || '').trim().toLocaleLowerCase();
    const rows = githubMcpState.tools.filter(tool => !query || `${tool.name} ${tool.description || ''}`.toLocaleLowerCase().includes(query));
    if (count) count.textContent = `${rows.length} / ${githubMcpState.tools.length} 个工具`;
    list.innerHTML = '';
    rows.forEach(tool => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mcp-tool-item';
        const required = Array.isArray(tool.inputSchema?.required) ? tool.inputSchema.required.length : 0;
        button.innerHTML = `<span><i class="ri-terminal-box-line"></i></span><div><strong></strong><p></p><em>${required ? `${required} 个必填参数` : '无需必填参数'}</em></div><i class="ri-arrow-right-s-line"></i>`;
        button.querySelector('strong').textContent = tool.name;
        button.querySelector('p').textContent = tool.description || '未提供工具说明';
        button.addEventListener('click', () => selectMcpTool(tool.name));
        list.appendChild(button);
    });
    if (!rows.length) list.innerHTML = '<div class="mcp-empty-tools">没有匹配的工具</div>';
}

function filterMcpTools(value) {
    renderMcpTools(value);
}
window.filterMcpTools = filterMcpTools;

function buildMcpArgumentExample(schema, depth = 0) {
    if (!schema || depth > 4) return {};
    if (schema.default !== undefined) return schema.default;
    if (schema.example !== undefined) return schema.example;
    if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
    if (schema.type === 'string') return '';
    if (schema.type === 'number' || schema.type === 'integer') return 0;
    if (schema.type === 'boolean') return false;
    if (schema.type === 'array') return [];
    const properties = schema.properties || {};
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    return Object.keys(properties).reduce((result, key) => {
        if (required.has(key) || properties[key].default !== undefined) result[key] = buildMcpArgumentExample(properties[key], depth + 1);
        return result;
    }, {});
}

function selectMcpTool(toolName) {
    const tool = githubMcpState.tools.find(item => item.name === toolName);
    if (!tool) return;
    githubMcpState.selectedTool = tool;
    const runner = document.getElementById('mcp-tool-runner');
    const name = document.getElementById('mcp-selected-tool');
    const description = document.getElementById('mcp-selected-tool-description');
    const args = document.getElementById('mcp-tool-arguments');
    const result = document.getElementById('mcp-result');
    if (name) name.textContent = tool.name;
    if (description) description.textContent = tool.description || '未提供工具说明';
    if (args) args.value = JSON.stringify(buildMcpArgumentExample(tool.inputSchema), null, 2);
    result?.classList.add('hidden');
    runner?.classList.remove('hidden');
    requestAnimationFrame(() => runner?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
window.selectMcpTool = selectMcpTool;

function closeMcpToolRunner() {
    githubMcpState.selectedTool = null;
    document.getElementById('mcp-tool-runner')?.classList.add('hidden');
    document.getElementById('mcp-result')?.classList.add('hidden');
}
window.closeMcpToolRunner = closeMcpToolRunner;

function shouldConfirmMcpToolCall(tool) {
    const annotations = tool?.annotations && typeof tool.annotations === 'object' ? tool.annotations : null;
    if (annotations?.destructiveHint === true) return true;
    if (annotations?.readOnlyHint === true) return false;
    if (annotations?.readOnlyHint === false) return true;
    return true;
}

function formatMcpToolResult(result) {
    const parts = [];
    if (Array.isArray(result?.content)) {
        result.content.forEach(item => {
            if (item?.type === 'text' && item.text) parts.push(item.text);
            else if (item?.type === 'resource' && item.resource) parts.push(JSON.stringify(item.resource, null, 2));
            else if (item) parts.push(JSON.stringify(item, null, 2));
        });
    }
    if (result?.structuredContent !== undefined) parts.push(JSON.stringify(result.structuredContent, null, 2));
    if (!parts.length) parts.push(JSON.stringify(result ?? null, null, 2));
    return parts.join('\n\n');
}

async function callSelectedMcpTool() {
    const tool = githubMcpState.selectedTool;
    if (!githubMcpState.connected || !tool || githubMcpState.busy) return;
    let args;
    try {
        args = JSON.parse(document.getElementById('mcp-tool-arguments')?.value || '{}');
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Arguments 必须是 JSON 对象');
    } catch (error) {
        setMcpStatus('error', error?.message || 'Arguments JSON 格式错误');
        return;
    }
    const config = githubMcpState.config;
    const needsConfirmation = config?.isGitHub
        ? (!config.readonly && shouldConfirmMcpToolCall(tool))
        : shouldConfirmMcpToolCall(tool);
    if (needsConfirmation) {
        const target = config?.isGitHub ? 'GitHub 数据' : '外部系统数据';
        const confirmed = window.confirm(`即将调用可能修改${target}的工具：${tool.name}\n\n确认继续吗？`);
        if (!confirmed) return;
    }
    setMcpBusy(true, '正在调用工具…');
    const resultBox = document.getElementById('mcp-result');
    const output = document.getElementById('mcp-result-output');
    resultBox?.classList.remove('hidden');
    if (output) output.textContent = '正在等待 MCP Server 返回…';
    try {
        const result = await callGitHubMcpRpc('tools/call', { name: tool.name, arguments: args });
        githubMcpState.lastResult = formatMcpToolResult(result);
        if (output) output.textContent = githubMcpState.lastResult;
        setMcpStatus(result?.isError ? 'error' : 'connected', result?.isError ? '工具返回错误' : '调用完成');
    } catch (error) {
        githubMcpState.lastResult = error?.message || '调用失败';
        if (output) output.textContent = githubMcpState.lastResult;
        setMcpStatus('error', githubMcpState.lastResult);
    } finally {
        setMcpBusy(false);
    }
}
window.callSelectedMcpTool = callSelectedMcpTool;

async function copyMcpResult() {
    if (!githubMcpState.lastResult) return;
    try {
        await navigator.clipboard.writeText(githubMcpState.lastResult);
        if (typeof showWechatToast === 'function') showWechatToast('MCP 结果已复制');
    } catch (_) {}
}
window.copyMcpResult = copyMcpResult;

// Character toolbox bridge (apps/wechat/character/character-tools.js): the MCP app's current connection,
// reused headlessly so characters can call the tools the user allowed for them.
window.ByndMcpBridge = {
    status() {
        const config = githubMcpState.config || loadGitHubMcpConfig();
        let key = '';
        try { key = getMcpTokenScope(normalizeMcpServerUrl(config.url).url); } catch (_) {}
        return {
            connected: githubMcpState.connected,
            key,
            name: githubMcpState.serverInfo?.name || '',
            tools: githubMcpState.tools.map(tool => ({ name: tool.name, description: tool.description || '', annotations: tool.annotations || null, inputSchema: tool.inputSchema || null }))
        };
    },
    async ensureConnected() {
        if (githubMcpState.connected) return true;
        if (githubMcpState.busy) throw new Error('MCP 正在连接，请稍后再试');
        const saved = loadGitHubMcpConfig();
        const normalized = normalizeMcpServerUrl(saved.url);
        const token = getMcpSessionToken(normalized.url);
        if (normalized.isGitHub && !token) throw new Error('请先在 MCP 应用里重新连接（Token 只保存在本次会话）');
        githubMcpState.config = { ...saved, url: normalized.url, isGitHub: normalized.isGitHub, connectionType: normalized.connectionType, token, readonly: normalized.isGitHub && saved.readonly, lockdown: normalized.isGitHub && saved.lockdown, toolsets: normalized.isGitHub ? saved.toolsets : '' };
        githubMcpState.sessionId = '';
        githubMcpState.protocolVersion = GITHUB_MCP_PROTOCOL_VERSION;
        const initialized = await callGitHubMcpRpc('initialize', {
            protocolVersion: GITHUB_MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'BYND Character Tools', version: '1' }
        }, { includeSession: false, includeProtocol: false });
        githubMcpState.protocolVersion = initialized?.protocolVersion || GITHUB_MCP_PROTOCOL_VERSION;
        githubMcpState.serverInfo = initialized?.serverInfo || { name: normalized.isGitHub ? 'GitHub MCP' : 'MCP Server' };
        await sendGitHubMcpNotification('notifications/initialized', {});
        githubMcpState.tools = await listAllGitHubMcpTools();
        githubMcpState.connected = true;
        return true;
    },
    async call(toolName, args) {
        const result = await callGitHubMcpRpc('tools/call', { name: toolName, arguments: args });
        const text = formatMcpToolResult(result);
        if (result?.isError) throw new Error(String(text || '工具返回错误').slice(0, 200));
        return text;
    }
};

