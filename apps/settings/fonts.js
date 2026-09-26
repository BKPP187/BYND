// ========== 字体设置（下拉列表 + IndexedDB 存储） ==========

// localStorage 存元数据: { fonts: [{id, name, type, url?}], activeId }
// IndexedDB 存字体二进制: key=fontId, value=dataUrl

const FONT_DB_NAME = 'XuexiFontDB';
const FONT_DB_STORE = 'fonts';
const FONT_MAX_BYTES = 50 * 1024 * 1024;
const FONT_FETCH_TIMEOUT_MS = 300000;
const FONT_PROXY_FALLBACK = 'https://bynd.ccwu.cc/font-proxy';
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
