// --- Co-reading / 共读小说 ---
const COREAD_LIBRARY_KEY = 'bynd_coread_library_v1';
const COREAD_DAILY_KEY = 'bynd_coread_daily_v1';
const COREAD_DAILY_PARTICIPANTS_KEY = 'bynd_coread_daily_participants_v1';
const COREAD_SOURCE_KEY = 'bynd_coread_sources_v1';
const COREAD_SOURCE_VERSION_KEY = 'bynd_coread_sources_version_v1';
const COREAD_READER_SETTINGS_KEY = 'bynd_coread_reader_settings_v1';
const COREAD_READER_WALLPAPER_KEY = 'bynd_coread_reader_wallpaper_v1';
const COREAD_PROGRESS_KEY = 'bynd_coread_progress_v1';
const COREAD_SHELF_SETTINGS_KEY = 'bynd_coread_shelf_settings_v1';
const COREAD_SHELF_META_KEY = 'bynd_coread_shelf_meta_v1';
const COREAD_BUILTIN_SOURCE_VERSION = 'moxing-7.1-web-20260608';
const COREAD_BUILTIN_SOURCE_URL = 'assets/coread-book-sources.json?v=1.1.704';
const COREAD_DEFAULT_SOURCE_URLS = [
    'https://lifves.com/api/v2/booksource/list',
    'https://someok.github.io/booksources/data.json'
];
let coreadActiveBookId = '';
let coreadActiveCharId = '';
let coreadBusy = false;
let coreadSearchCache = [];
let coreadActiveTab = 'discover';
let coreadShelfCategory = 'all';
let coreadShelfMenuOpen = false;
let coreadShelfToolPanel = '';
let coreadShelfMenuTrigger = null;
let coreadShelfMenuEventsBound = false;
let coreadShelfPickerToken = 0;
let coreadShelfStatusText = '';
let coreadShelfSelectionMode = false;
let coreadShelfSelectedIds = new Set();
let coreadStatsRange = 'day';
let coreadStatsOffset = 0;
let coreadBookReviewBusyId = '';
let coreadMateDropdownOpen = false;
let coreadDailyLoading = false;
let coreadSearchRunId = 0;
let coreadTocOpen = false;
let coreadSettingsOpen = false;
let coreadCommentPanelOpen = false;
let coreadReaderPanelTab = 'chapters';
let coreadReaderPanelOpen = false;
let coreadReaderChapterGroupIndex = -1;
let coreadReaderChapterGroupPickerOpen = false;
let coreadReaderToolPointerAt = 0;
let coreadCommentStatusText = '';
let coreadLibraryCache = null;
let coreadLibraryCacheRaw = '';
let coreadProgressCache = null;
let coreadProgressCacheRaw = '';
let coreadReaderSettingsCache = null;
let coreadReaderSettingsCacheRaw = '';
let coreadReaderWallpaperCache = '';
let coreadReaderWallpaperCacheRaw = null;
let coreadReaderTapState = null;
let coreadReaderTapHandledAt = 0;
let coreadReaderPendingScrollPage = null;
let coreadSettingsPointerAt = 0;
let coreadPageModePointerAt = 0;
let coreadPageModeCommitToken = 0;
let coreadFastSettingsBound = false;
let coreadDiscoveryLoadStarted = false;
const coreadResolvingBookIds = new Set();

const COREAD_DAILY_SEEDS = [
    '中文 小说 文学', '幻想 小说', 'romance fiction', 'mystery fiction',
    'science fiction', 'historical fiction', 'poetry', 'essay literature',
    'young adult fantasy', 'contemporary novel', 'classic literature', 'short stories'
];

const COREAD_DAILY_LINES = [
    '今天不急着读完，先把第一句留给喜欢的人。',
    '随机翻到的书，也可能刚好撞进当前剧情。',
    '让 char 坐到书页旁边，故事会多出另一种呼吸。',
    '每日一书，每日一言，像有人把新的门轻轻推开。',
    '读同一本书时，沉默也会变成聊天记录。'
];

const COREAD_SHELF_CATEGORIES = [
    { id: 'all', label: '全部' },
    { id: 'unsorted', label: '未整理' },
    { id: 'pending', label: '待看' }
];

const COREAD_SHELF_TOOL_GROUPS = [
    [
        { id: 'select', label: '选择书籍', icon: 'ri-checkbox-line' }
    ],
    [
        { id: 'importLocal', label: '从本机导入', icon: 'ri-add-line' },
        { id: 'scanFolder', label: '扫描文件夹', icon: 'ri-folder-line' },
        { id: 'smartImport', label: '智能导入', icon: 'ri-scan-2-line' },
        { id: 'createBook', label: '创建书籍', icon: 'ri-booklet-line' }
    ],
    [
        { id: 'settings', label: '书架设置', icon: 'ri-settings-3-line' },
        { id: 'tags', label: '标签管理', icon: 'ri-hashtag' },
        { id: 'categories', label: '分类管理', icon: 'ri-folder-settings-line' },
        { id: 'sort', label: '书籍排序', icon: 'ri-sort-desc', arrow: true },
        { id: 'more', label: '更多', icon: 'ri-more-fill', arrow: true }
    ]
];

const COREAD_SHELF_DEFAULT_SETTINGS = {
    viewMode: 'grid',
    compact: false,
    cardMode: true,
    divider: false,
    sidePadding: 16,
    topSteps: 0
};

const COREAD_SHELF_DEFAULT_META = {
    categories: {},
    sortMode: 'recent'
};

const COREAD_OBFUSCATED_TEXT_MAP = {
    '': '这', '': '天', '': '里', '': '之', '': '地', '': '大',
    '': '和', '': '美', '': '如', '': '以', '': '下', '': '么',
    '': '后', '': '为', '': '上', '': '道', '': '来', '': '然',
    '': '而', '': '对', '': '于', '': '没', '': '用', '': '自',
    '': '要', '': '时', '': '心', '': '个', '': '小', '': '事',
    '': '第', '': '发', '': '可', '': '想', '': '样', '': '家',
    '': '开', '': '们', '': '起', '': '出'
};
const COREAD_PAGE_SIZE = 480;
const COREAD_AI_CONTEXT_PREVIOUS_PAGES = 1;
const COREAD_AI_COMMENT_MAX_TOKENS = 1800;
const COREAD_AI_REPLY_MAX_TOKENS = 1800;
const COREAD_RESOLVE_VERSION = 3;
const COREAD_META_VERSION = 1;
const COREAD_CHAPTER_VERSION = 1;

function getCoReadCharacters() {
    return Array.isArray(window.myCharacters)
        ? window.myCharacters.filter(char => char && char.id && !char.isGroupChat)
        : [];
}

// Cover lookups in flight this session; coverResolving is never persisted, so a
// reload cannot leave a book stuck showing "..." without a lookup running.
const coreadCoverResolvingIds = new Set();

function getCoReadLibrary() {
    try {
        const raw = localStorage.getItem(COREAD_LIBRARY_KEY) || '[]';
        if (raw !== coreadLibraryCacheRaw || !Array.isArray(coreadLibraryCache)) {
            const list = JSON.parse(raw);
            coreadLibraryCache = Array.isArray(list) ? list.filter(item => item && item.id) : [];
            coreadLibraryCache.forEach(item => {
                if (coreadCoverResolvingIds.has(item.id)) item.coverResolving = true;
                else delete item.coverResolving;
            });
            coreadLibraryCacheRaw = raw;
        }
        applyCoReadStoredProgress(coreadLibraryCache);
        return coreadLibraryCache;
    } catch (_) {
        return [];
    }
}

function saveCoReadLibrary(list) {
    const normalized = (Array.isArray(list) ? list : []).slice(0, 80);
    const raw = JSON.stringify(normalized, (key, value) => key === 'coverResolving' ? undefined : value);
    localStorage.setItem(COREAD_LIBRARY_KEY, raw);
    coreadLibraryCache = normalized;
    coreadLibraryCacheRaw = raw;
}

function getCoReadProgressMap() {
    try {
        const raw = localStorage.getItem(COREAD_PROGRESS_KEY) || '{}';
        if (raw !== coreadProgressCacheRaw || !coreadProgressCache) {
            const parsed = JSON.parse(raw);
            coreadProgressCache = parsed && typeof parsed === 'object' ? parsed : {};
            coreadProgressCacheRaw = raw;
        }
        return coreadProgressCache;
    } catch (_) {
        coreadProgressCache = {};
        coreadProgressCacheRaw = '{}';
        return coreadProgressCache;
    }
}

function applyCoReadStoredProgress(list) {
    if (!Array.isArray(list) || !list.length) return;
    const progress = getCoReadProgressMap();
    list.forEach(book => {
        if (!book || !book.id) return;
        const savedPage = Number(progress[book.id]);
        if (Number.isFinite(savedPage) && savedPage >= 0) book.page = savedPage;
    });
}

function saveCoReadBookPage(bookId, page) {
    const id = String(bookId || '');
    if (!id) return;
    const nextPage = Math.max(0, Math.floor(Number(page || 0)));
    const progress = { ...getCoReadProgressMap(), [id]: nextPage };
    const raw = JSON.stringify(progress);
    localStorage.setItem(COREAD_PROGRESS_KEY, raw);
    coreadProgressCache = progress;
    coreadProgressCacheRaw = raw;
    if (Array.isArray(coreadLibraryCache)) {
        const cached = coreadLibraryCache.find(book => book && book.id === id);
        if (cached) {
            cached.page = nextPage;
            cached.updatedAt = Date.now();
            if (getCoReadBookProgress(cached) >= 100) cached.finishedAt = cached.finishedAt || Date.now();
            const libraryRaw = JSON.stringify(coreadLibraryCache.slice(0, 80));
            localStorage.setItem(COREAD_LIBRARY_KEY, libraryRaw);
            coreadLibraryCacheRaw = libraryRaw;
        }
    }
}

function normalizeCoReadShelfSettings(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        viewMode: ['grid', 'waterfall', 'list'].includes(source.viewMode) ? source.viewMode : COREAD_SHELF_DEFAULT_SETTINGS.viewMode,
        compact: !!source.compact,
        cardMode: source.cardMode !== false,
        divider: !!source.divider,
        sidePadding: Math.max(8, Math.min(28, Number(source.sidePadding || COREAD_SHELF_DEFAULT_SETTINGS.sidePadding))),
        topSteps: Math.max(0, Math.min(72, Number(source.topSteps || COREAD_SHELF_DEFAULT_SETTINGS.topSteps)))
    };
}

function getCoReadShelfSettings() {
    try {
        return normalizeCoReadShelfSettings(JSON.parse(localStorage.getItem(COREAD_SHELF_SETTINGS_KEY) || '{}'));
    } catch (_) {
        return normalizeCoReadShelfSettings({});
    }
}

function saveCoReadShelfSettings(next) {
    const settings = normalizeCoReadShelfSettings({ ...getCoReadShelfSettings(), ...(next || {}) });
    localStorage.setItem(COREAD_SHELF_SETTINGS_KEY, JSON.stringify(settings));
    return settings;
}

function normalizeCoReadShelfMeta(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawCategories = source.categories && typeof source.categories === 'object' ? source.categories : {};
    const categories = {};
    Object.keys(rawCategories).forEach(name => {
        const safeName = String(name || '').trim().slice(0, 28);
        if (!safeName) return;
        const item = rawCategories[name] && typeof rawCategories[name] === 'object' ? rawCategories[name] : {};
        categories[safeName] = {
            coverUrl: normalizeCoReadCoverUrl(item.coverUrl || ''),
            createdAt: Number(item.createdAt || Date.now())
        };
    });
    return {
        categories,
        sortMode: ['recent', 'title', 'author', 'progress'].includes(source.sortMode) ? source.sortMode : COREAD_SHELF_DEFAULT_META.sortMode
    };
}

function getCoReadShelfMeta() {
    try {
        return normalizeCoReadShelfMeta(JSON.parse(localStorage.getItem(COREAD_SHELF_META_KEY) || '{}'));
    } catch (_) {
        return normalizeCoReadShelfMeta({});
    }
}

function saveCoReadShelfMeta(next) {
    const meta = normalizeCoReadShelfMeta({ ...getCoReadShelfMeta(), ...(next || {}) });
    localStorage.setItem(COREAD_SHELF_META_KEY, JSON.stringify(meta));
    return meta;
}

function showCoReadShelfToast(text) {
    const msg = String(text || '').trim();
    if (!msg) return;
    setCoReadShelfStatus(msg);
    if (typeof showWechatToast === 'function') showWechatToast(msg);
}

function applyCoReadShelfSettings() {
    const content = document.querySelector('.coread-content');
    if (!content) return;
    const settings = getCoReadShelfSettings();
    content.dataset.shelfView = settings.viewMode;
    content.classList.toggle('coread-shelf-compact', !!settings.compact);
    content.classList.toggle('coread-shelf-card-mode', !!settings.cardMode);
    content.classList.toggle('coread-shelf-divider', !!settings.divider);
    content.style.setProperty('--coread-shelf-side-padding', `${settings.sidePadding}px`);
    content.style.setProperty('--coread-shelf-top-steps', `${settings.topSteps}px`);
}

const COREAD_READER_DEFAULT_SETTINGS = {
    fontSize: 18,
    pageMode: 'paged',
    color: 'ivory',
    wallpaperTone: ''
};

const COREAD_READER_COLORS = {
    ivory: { label: '米白', bg: '#fff9ed', color: '#26211c' },
    paper: { label: '纸黄', bg: '#f4ecd9', color: '#2d261d' },
    green: { label: '浅绿', bg: '#edf4e8', color: '#233124' },
    gray: { label: '灰调', bg: '#eef0ee', color: '#222629' },
    dark: { label: '夜间', bg: '#1f211f', color: '#d9d2c3' }
};

function getCoReadReaderWallpaper(fallback = '') {
    try {
        const raw = localStorage.getItem(COREAD_READER_WALLPAPER_KEY);
        if (raw !== null) {
            if (raw !== coreadReaderWallpaperCacheRaw) {
                coreadReaderWallpaperCache = raw || '';
                coreadReaderWallpaperCacheRaw = raw;
            }
            return coreadReaderWallpaperCache;
        }
    } catch (_) {}
    return String(fallback || '');
}

function saveCoReadReaderWallpaper(value) {
    const text = String(value || '');
    try {
        if (text) localStorage.setItem(COREAD_READER_WALLPAPER_KEY, text);
        else localStorage.removeItem(COREAD_READER_WALLPAPER_KEY);
        coreadReaderWallpaperCache = text;
        coreadReaderWallpaperCacheRaw = text || null;
    } catch (_) {}
}

function normalizeCoReadReaderSettings(saved) {
    const source = saved && typeof saved === 'object' ? saved : {};
    const settings = { ...COREAD_READER_DEFAULT_SETTINGS, ...source };
    settings.fontSize = Math.max(15, Math.min(26, Number(settings.fontSize || COREAD_READER_DEFAULT_SETTINGS.fontSize)));
    settings.pageMode = settings.pageMode === 'scroll' ? 'scroll' : 'paged';
    settings.color = COREAD_READER_COLORS[settings.color] ? settings.color : COREAD_READER_DEFAULT_SETTINGS.color;
    settings.wallpaperTone = settings.wallpaperTone === 'light' || settings.wallpaperTone === 'dark' ? settings.wallpaperTone : '';
    settings.wallpaper = getCoReadReaderWallpaper(source.wallpaper);
    delete settings.theme;
    delete settings.customCss;
    return settings;
}

function getCoReadReaderSettings() {
    try {
        let raw = localStorage.getItem(COREAD_READER_SETTINGS_KEY) || '{}';
        if (raw !== coreadReaderSettingsCacheRaw || !coreadReaderSettingsCache) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                let shouldRewrite = false;
                let legacyWallpaper = '';
                if (parsed.wallpaper) {
                    legacyWallpaper = String(parsed.wallpaper || '');
                    delete parsed.wallpaper;
                    shouldRewrite = true;
                }
                if (Object.prototype.hasOwnProperty.call(parsed, 'theme')) {
                    delete parsed.theme;
                    shouldRewrite = true;
                }
                if (Object.prototype.hasOwnProperty.call(parsed, 'customCss')) {
                    delete parsed.customCss;
                    shouldRewrite = true;
                }
                if (shouldRewrite) {
                    raw = JSON.stringify(parsed);
                    localStorage.setItem(COREAD_READER_SETTINGS_KEY, raw);
                }
                if (legacyWallpaper) saveCoReadReaderWallpaper(legacyWallpaper);
            }
            coreadReaderSettingsCache = parsed && typeof parsed === 'object' ? parsed : {};
            coreadReaderSettingsCacheRaw = raw;
        }
        return normalizeCoReadReaderSettings(coreadReaderSettingsCache);
    } catch (_) {
        return normalizeCoReadReaderSettings({});
    }
}

function saveCoReadReaderSettings(next, options = {}) {
    const incoming = next && typeof next === 'object' ? { ...next } : {};
    if (Object.prototype.hasOwnProperty.call(incoming, 'wallpaper')) {
        saveCoReadReaderWallpaper(incoming.wallpaper);
        delete incoming.wallpaper;
    }
    delete incoming.theme;
    delete incoming.customCss;
    const current = getCoReadReaderSettings();
    const settings = normalizeCoReadReaderSettings({ ...current, ...incoming });
    const stored = { ...settings };
    delete stored.wallpaper;
    const raw = JSON.stringify(stored);
    localStorage.setItem(COREAD_READER_SETTINGS_KEY, raw);
    coreadReaderSettingsCache = stored;
    coreadReaderSettingsCacheRaw = raw;
    applyCoReadReaderSettings();
    if (options.renderSettings !== false) renderCoReadSettings();
    if (options.renderReader !== false) renderCoReadReader();
}

function getCoReadHexRgb(value, fallback = '#ffffff') {
    let text = String(value || fallback || '#ffffff').trim();
    if (/^#[0-9a-f]{3}$/i.test(text)) {
        text = `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
    }
    const match = text.match(/^#([0-9a-f]{6})$/i);
    if (!match) return getCoReadHexRgb(fallback, '#ffffff');
    const hex = match[1];
    return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
    ];
}

function getCoReadRgba(value, fallback, alpha) {
    const [r, g, b] = getCoReadHexRgb(value, fallback);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyCoReadReaderSettings() {
    const shell = document.querySelector('.coread-shell');
    if (!shell) return;
    const settings = getCoReadReaderSettings();
    const color = COREAD_READER_COLORS[settings.color] || COREAD_READER_COLORS.ivory;
    shell.dataset.coreadPageMode = settings.pageMode;
    shell.dataset.coreadColor = settings.color;
    shell.dataset.coreadWallpaperTone = settings.wallpaper ? (settings.wallpaperTone || 'dark') : '';
    shell.classList.toggle('coread-has-wallpaper', Boolean(settings.wallpaper));
    shell.classList.toggle('coread-wallpaper-light', Boolean(settings.wallpaper) && settings.wallpaperTone === 'light');
    shell.classList.toggle('coread-wallpaper-dark', Boolean(settings.wallpaper) && settings.wallpaperTone !== 'light');
    const wallpaperIsLight = Boolean(settings.wallpaper) && settings.wallpaperTone === 'light';
    const wallpaperIsDark = Boolean(settings.wallpaper) && settings.wallpaperTone !== 'light';
    const readerColor = wallpaperIsLight ? color.color : (wallpaperIsDark ? '#f3eadc' : color.color);
    shell.style.setProperty('--coread-font-size', `${settings.fontSize}px`);
    shell.style.setProperty('--coread-reader-bg', color.bg);
    shell.style.setProperty('--coread-reader-color', readerColor);
    shell.style.setProperty('--coread-reader-chrome-bg', wallpaperIsLight ? 'rgba(255,255,255,0.62)' : (wallpaperIsDark ? 'rgba(15,18,16,0.50)' : 'color-mix(in srgb, var(--coread-reader-bg) 88%, #fff 12%)'));
    shell.style.setProperty('--coread-reader-panel-bg', wallpaperIsLight ? 'rgba(255,255,255,0.56)' : (wallpaperIsDark ? 'rgba(12,15,13,0.58)' : 'color-mix(in srgb, var(--coread-reader-bg) 90%, #d6c8b4 10%)'));
    shell.style.setProperty('--coread-reader-border', wallpaperIsLight ? 'rgba(38,31,24,0.10)' : (wallpaperIsDark ? 'rgba(255,255,255,0.10)' : 'rgba(48,42,36,0.07)'));
    shell.style.setProperty('--coread-reader-paper-layer', 'linear-gradient(90deg, rgba(47,40,32,0.025) 0 1px, transparent 1px 100%)');
    shell.style.setProperty('--coread-wallpaper-scrim', wallpaperIsLight
        ? `145deg, rgba(255,255,255,0.28) 0%, ${getCoReadRgba(color.bg, '#ffffff', 0.22)} 50%, rgba(255,255,255,0.36) 100%`
        : `145deg, rgba(9,12,10,0.38) 0%, ${getCoReadRgba(color.bg, '#1f211f', 0.18)} 52%, rgba(9,12,10,0.46) 100%`);
    shell.style.setProperty('--coread-wallpaper', settings.wallpaper ? `url("${settings.wallpaper}")` : 'none');
}

function estimateCoReadWallpaperTone(canvas) {
    try {
        const ctx = canvas.getContext('2d');
        const width = Math.max(1, canvas.width || 1);
        const height = Math.max(1, canvas.height || 1);
        const sample = 24;
        const data = ctx.getImageData(0, 0, width, height).data;
        let total = 0;
        let count = 0;
        for (let y = 0; y < sample; y += 1) {
            const py = Math.min(height - 1, Math.floor((y + 0.5) * height / sample));
            for (let x = 0; x < sample; x += 1) {
                const px = Math.min(width - 1, Math.floor((x + 0.5) * width / sample));
                const index = (py * width + px) * 4;
                const alpha = (data[index + 3] || 255) / 255;
                const r = data[index] || 0;
                const g = data[index + 1] || 0;
                const b = data[index + 2] || 0;
                total += (0.2126 * r + 0.7152 * g + 0.0722 * b) * alpha;
                count += 1;
            }
        }
        return (total / Math.max(1, count)) > 150 ? 'light' : 'dark';
    } catch (_) {
        return 'dark';
    }
}

function renderCoReadSettings() {
    const fontLabel = document.getElementById('coread-font-size-label');
    const modeBox = document.getElementById('coread-page-mode-options');
    const colorBox = document.getElementById('coread-color-options');
    const settings = getCoReadReaderSettings();
    syncCoReadSettingsDrawerState();
    if (fontLabel) fontLabel.textContent = String(settings.fontSize);
    if (modeBox) {
        const modes = [
            { id: 'paged', label: '分页' },
            { id: 'scroll', label: '滚动' }
        ];
        modeBox.innerHTML = modes.map(mode => `
            <button type="button" data-coread-page-mode="${mode.id}" class="${settings.pageMode === mode.id ? 'active' : ''}" aria-pressed="${settings.pageMode === mode.id ? 'true' : 'false'}" onpointerdown="return handleCoReadPageModePointer('${mode.id}', event)" ontouchstart="return handleCoReadPageModePointer('${mode.id}', event)" onclick="return handleCoReadPageModeClick('${mode.id}', event)">${mode.label}</button>
        `).join('');
        syncCoReadPageModeControls(settings.pageMode);
    }
    if (colorBox) {
        colorBox.innerHTML = Object.entries(COREAD_READER_COLORS).map(([id, item]) => `
            <button type="button" class="${settings.color === id ? 'active' : ''}" onclick="setCoReadReaderColor('${id}')" aria-label="${musicEscapeAttr(item.label)}">
                <i style="background:${musicEscapeAttr(item.bg)}; color:${musicEscapeAttr(item.color)}"></i>
                <span>${musicEscapeHtml(item.label)}</span>
            </button>
        `).join('');
    }
}

function syncCoReadSettingsDrawerState() {
    const drawer = document.getElementById('coread-settings-drawer');
    if (!drawer) return;
    drawer.classList.toggle('open', coreadSettingsOpen);
    drawer.setAttribute('aria-hidden', coreadSettingsOpen ? 'false' : 'true');
}

function toggleCoReadSettings(open) {
    const wasTocOpen = coreadTocOpen;
    coreadSettingsOpen = typeof open === 'boolean' ? open : !coreadSettingsOpen;
    if (coreadSettingsOpen) {
        coreadTocOpen = false;
        coreadCommentPanelOpen = false;
        renderCoReadCommentPanel();
    }
    if (wasTocOpen && !coreadTocOpen) syncCoReadTocDrawerState();
    syncCoReadSettingsDrawerState();
}
window.toggleCoReadSettings = toggleCoReadSettings;

function handleCoReadSettingsPointer(open, event) {
    coreadSettingsPointerAt = Date.now();
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
    toggleCoReadSettings(open);
    return false;
}
window.handleCoReadSettingsPointer = handleCoReadSettingsPointer;

function handleCoReadSettingsClick(open, event) {
    if (Date.now() - coreadSettingsPointerAt < 600) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
        return false;
    }
    toggleCoReadSettings(open);
    return false;
}
window.handleCoReadSettingsClick = handleCoReadSettingsClick;

function handleCoReadSettingsFastEvent(event) {
    const target = event.target && event.target.closest && event.target.closest('[data-coread-settings-open]');
    if (!target || !document.getElementById('app-coread-window')?.contains(target)) return;
    const open = target.dataset.coreadSettingsOpen === 'true';
    handleCoReadSettingsPointer(open, event);
}

function bindCoReadFastSettingsControls() {
    if (coreadFastSettingsBound) return;
    coreadFastSettingsBound = true;
    document.addEventListener('pointerdown', handleCoReadSettingsFastEvent, { capture: true });
    document.addEventListener('touchstart', handleCoReadSettingsFastEvent, { capture: true, passive: false });
    document.addEventListener('mousedown', handleCoReadSettingsFastEvent, { capture: true });
}

function changeCoReadFontSize(delta) {
    const settings = getCoReadReaderSettings();
    saveCoReadReaderSettings({ fontSize: Math.max(15, Math.min(26, settings.fontSize + Number(delta || 0))) }, { renderReader: false });
}
window.changeCoReadFontSize = changeCoReadFontSize;

function syncCoReadPageModeControls(mode) {
    const targetMode = mode === 'scroll' ? 'scroll' : 'paged';
    const modeBox = document.getElementById('coread-page-mode-options');
    if (!modeBox) return;
    modeBox.dataset.coreadCurrentMode = targetMode;
    modeBox.querySelectorAll('[data-coread-page-mode]').forEach(btn => {
        const active = btn.dataset.coreadPageMode === targetMode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function commitCoReadPageMode(mode) {
    const targetMode = mode === 'scroll' ? 'scroll' : 'paged';
    syncCoReadPageModeControls(targetMode);
    const current = getCoReadReaderSettings();
    if (current.pageMode === targetMode) return false;
    const book = getCoReadBook(coreadActiveBookId);
    const body = document.getElementById('coread-reader-body');
    if (current.pageMode === 'scroll' && targetMode === 'paged' && book && body) {
        const page = getCoReadPageFromScrollPosition(body, book);
        book.page = page;
        saveCoReadBookPage(book.id, page);
    }
    if (current.pageMode === 'paged' && targetMode === 'scroll' && book) {
        coreadReaderPendingScrollPage = Number(book.page || 0);
    }
    saveCoReadReaderSettings({ pageMode: targetMode }, { renderSettings: false });
    syncCoReadPageModeControls(targetMode);
    return false;
}

function setCoReadPageMode(mode) {
    coreadPageModeCommitToken += 1;
    return commitCoReadPageMode(mode);
}
window.setCoReadPageMode = setCoReadPageMode;

function scheduleCoReadPageMode(mode) {
    const targetMode = mode === 'scroll' ? 'scroll' : 'paged';
    const token = coreadPageModeCommitToken + 1;
    coreadPageModeCommitToken = token;
    syncCoReadPageModeControls(targetMode);
    const commit = () => {
        if (token !== coreadPageModeCommitToken) return;
        commitCoReadPageMode(targetMode);
    };
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => setTimeout(commit, 0));
    } else {
        setTimeout(commit, 0);
    }
    return false;
}

function handleCoReadPageModePointer(mode, event) {
    coreadPageModePointerAt = Date.now();
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    return scheduleCoReadPageMode(mode);
}
window.handleCoReadPageModePointer = handleCoReadPageModePointer;

function handleCoReadPageModeClick(mode, event) {
    if (Date.now() - coreadPageModePointerAt < 600) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        return false;
    }
    return scheduleCoReadPageMode(mode);
}
window.handleCoReadPageModeClick = handleCoReadPageModeClick;

function setCoReadReaderColor(color) {
    saveCoReadReaderSettings({ color: COREAD_READER_COLORS[color] ? color : 'ivory' }, { renderReader: false });
}
window.setCoReadReaderColor = setCoReadReaderColor;

function uploadCoReadWallpaper(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const img = new Image();
        img.onload = () => {
            try {
                const maxSide = 1400;
                const scale = Math.min(1, maxSide / Math.max(img.width || maxSide, img.height || maxSide));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round((img.width || maxSide) * scale));
                canvas.height = Math.max(1, Math.round((img.height || maxSide) * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                saveCoReadReaderSettings({ wallpaper: canvas.toDataURL('image/jpeg', 0.82), wallpaperTone: estimateCoReadWallpaperTone(canvas) }, { renderReader: false });
            } catch (_) {
                saveCoReadReaderSettings({ wallpaper: dataUrl, wallpaperTone: 'dark' }, { renderReader: false });
            }
            input.value = '';
        };
        img.onerror = () => {
            saveCoReadReaderSettings({ wallpaper: dataUrl, wallpaperTone: 'dark' }, { renderReader: false });
            input.value = '';
        };
        img.src = dataUrl;
    };
    reader.readAsDataURL(file);
}
window.uploadCoReadWallpaper = uploadCoReadWallpaper;

function clearCoReadWallpaper() {
    saveCoReadReaderSettings({ wallpaper: '', wallpaperTone: '' }, { renderReader: false });
}
window.clearCoReadWallpaper = clearCoReadWallpaper;

