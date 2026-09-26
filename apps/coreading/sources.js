function getCoReadSources() {
    try {
        const list = JSON.parse(localStorage.getItem(COREAD_SOURCE_KEY) || '[]');
        return Array.isArray(list) ? list.filter(item => item && item.bookSourceName && item.searchUrl) : [];
    } catch (_) {
        return [];
    }
}

function saveCoReadSources(list) {
    const seen = new Set();
    const normalized = (Array.isArray(list) ? list : [])
        .filter(item => item && item.bookSourceName && item.bookSourceUrl && item.searchUrl && item.ruleSearch)
        .filter(item => {
            const key = `${item.bookSourceName}|${item.bookSourceUrl}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 180);
    localStorage.setItem(COREAD_SOURCE_KEY, JSON.stringify(normalized));
}

async function loadCoReadBuiltinSources(force = false) {
    const currentVersion = localStorage.getItem(COREAD_SOURCE_VERSION_KEY) || '';
    if (!force && currentVersion === COREAD_BUILTIN_SOURCE_VERSION && getCoReadSources().length) {
        return getCoReadSources().length;
    }
    try {
        const resp = await fetch(COREAD_BUILTIN_SOURCE_URL, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const imported = normalizeCoReadSourceList(await resp.json());
        if (!imported.length) return getCoReadSources().length;
        saveCoReadSources([...imported, ...getCoReadSources()]);
        localStorage.setItem(COREAD_SOURCE_VERSION_KEY, COREAD_BUILTIN_SOURCE_VERSION);
        return getCoReadSources().length;
    } catch (e) {
        return getCoReadSources().length;
    }
}

function setCoReadSourceStatus(text) {
    const el = document.getElementById('coread-source-status');
    if (el) el.textContent = text || '';
}

function renderCoReadSourceManager() {
    const list = document.getElementById('coread-source-list');
    const sources = getCoReadSources();
    setCoReadSourceStatus(sources.length ? `已加载 ${sources.length} 个书源，搜索会优先使用书源解析` : '未加载书源');
    if (!list) return;
    list.innerHTML = sources.slice(0, 24).map((source, index) => `
        <button type="button" title="${musicEscapeAttr(source.bookSourceUrl || '')}">
            <span>${musicEscapeHtml(source.bookSourceName || `书源 ${index + 1}`)}</span>
            <em>${musicEscapeHtml(source.bookSourceGroup || source.bookSourceUrl || '')}</em>
        </button>
    `).join('') || '<div class="coread-empty">还没有书源。点击加载书源，或粘贴 Legado / 阅读 JSON 链接导入。</div>';
}

function toggleCoReadSourceManager() {
    const panel = document.getElementById('coread-source-manager');
    if (!panel) return;
    panel.classList.toggle('hidden');
    renderCoReadSourceManager();
}
window.toggleCoReadSourceManager = toggleCoReadSourceManager;

function normalizeCoReadChapterUrl(url, baseUrl = '') {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const match = raw.match(/https?:\/\/[^\s"'<>）)]+/i) || raw.match(/^[^\s"'<>）)]+/);
    const clean = match ? match[0] : raw;
    try {
        return new URL(clean, baseUrl || undefined).href;
    } catch (_) {
        return clean;
    }
}

async function coReadFetchText(url, options = {}) {
    const rawUrl = normalizeCoReadChapterUrl(url) || String(url || '').trim();
    const isHttp = /^https?:\/\//i.test(rawUrl);
    const isProxyUrl = /^https?:\/\/(?:r\.jina\.ai|corsproxy\.io|api\.allorigins\.win)\//i.test(rawUrl);
    const isZhenhun = !isProxyUrl && /zhenhunxiaoshuo\.com/i.test(rawUrl);
    const attempts = (isZhenhun
        ? [
            isHttp ? `https://r.jina.ai/${rawUrl}` : '',
            isHttp ? `https://corsproxy.io/?${encodeURIComponent(rawUrl)}` : '',
            rawUrl,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`
        ]
        : [
            isHttp ? `https://corsproxy.io/?${encodeURIComponent(rawUrl)}` : '',
            rawUrl,
            isHttp ? `https://r.jina.ai/${rawUrl}` : '',
            `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`
        ]).filter(Boolean);
    let lastError = null;
    for (const target of attempts) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Number(options.timeoutMs || 4500));
        try {
            const fetchOptions = { ...options, signal: controller.signal };
            delete fetchOptions.timeoutMs;
            delete fetchOptions.quiet;
            const resp = await fetch(target, fetchOptions);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.text();
        } catch (e) {
            lastError = e;
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError || new Error('fetch failed');
}

function coReadWithTimeout(promise, timeoutMs, fallback) {
    let timer = null;
    return Promise.race([
        promise,
        new Promise(resolve => {
            timer = setTimeout(() => resolve(fallback), timeoutMs);
        })
    ]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

function normalizeCoReadSourceList(payload) {
    const raw = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload?.sources) ? payload.sources : []));
    return raw.filter(item => item && item.bookSourceName && item.bookSourceUrl && item.searchUrl && item.ruleSearch);
}

async function importCoReadSourcesFromUrl(url) {
    const rawUrl = String(url || '').trim();
    if (!rawUrl) return 0;
    const text = await coReadFetchText(rawUrl);
    const json = JSON.parse(text.replace(/^\uFEFF/, ''));
    const imported = normalizeCoReadSourceList(json);
    const existing = getCoReadSources();
    saveCoReadSources([...existing, ...imported]);
    renderCoReadSourceManager();
    return imported.length;
}

async function loadCoReadDefaultSources() {
    setCoReadSourceStatus('正在加载内置书源...');
    let total = 0;
    let failed = 0;
    for (const url of COREAD_DEFAULT_SOURCE_URLS) {
        try {
            total += await importCoReadSourcesFromUrl(url);
        } catch (e) {
            failed += 1;
        }
    }
    renderCoReadSourceManager();
    if (total) {
        setCoReadSourceStatus(`已加载/更新 ${getCoReadSources().length} 个书源${failed ? `，${failed} 个订阅暂不可用` : ''}`);
    } else {
        setCoReadSourceStatus('默认订阅暂不可用，可以手动粘贴书源 JSON 链接');
    }
}
window.loadCoReadDefaultSources = loadCoReadDefaultSources;

async function importCoReadSourceUrl() {
    const input = document.getElementById('coread-source-url-input');
    const url = String(input && input.value || '').trim();
    if (!url) return;
    setCoReadSourceStatus('正在导入书源...');
    try {
        const count = await importCoReadSourcesFromUrl(url);
        if (input) input.value = '';
        setCoReadSourceStatus(count ? `已导入 ${count} 个书源` : '这个链接没有解析到可用书源');
    } catch (e) {
        setCoReadSourceStatus('导入失败：请确认是 Legado / 阅读 JSON 书源链接');
    }
}
window.importCoReadSourceUrl = importCoReadSourceUrl;

function getCoReadBook(bookId) {
    return getCoReadLibrary().find(book => book.id === bookId) || null;
}

function deleteCoReadBook(bookId) {
    const id = String(bookId || '');
    if (!id) return;
    const library = getCoReadLibrary();
    const book = library.find(item => item.id === id);
    if (!book) return;
    if (!confirm(`删除《${book.title || '这本书'}》？`)) return;
    const next = library.filter(item => item.id !== id);
    saveCoReadLibrary(next);
    coreadShelfSelectedIds.delete(id);
    if (coreadActiveBookId === id) {
        coreadActiveBookId = next[0] ? next[0].id : '';
    }
    renderCoReadApp();
}
window.deleteCoReadBook = deleteCoReadBook;

function normalizeCoReadCoverUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    return raw
        .replace(/^http:\/\//i, 'https://')
        .replace(/zoom=\d+/i, 'zoom=2')
        .replace(/&edge=curl/gi, '');
}

async function fetchCoReadCoverFromMetadata(title, author = '') {
    const query = [title, author].filter(Boolean).join(' ');
    if (!query.trim()) return '';
    try {
        const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${title} ${author || ''}`)}&maxResults=5`;
        const resp = await fetch(googleUrl);
        if (resp.ok) {
            const data = await resp.json();
            const items = Array.isArray(data.items) ? data.items : [];
            for (const item of items) {
                const links = item.volumeInfo && item.volumeInfo.imageLinks || {};
                const cover = normalizeCoReadCoverUrl(links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail);
                if (cover) return cover;
            }
        }
    } catch (_) {}
    try {
        const open = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author || '')}&limit=1`);
        if (open.ok) {
            const data = await open.json();
            const doc = Array.isArray(data.docs) ? data.docs[0] : null;
            if (doc && doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        }
    } catch (_) {}
    return '';
}

function buildCoReadGeneratedCoverUrl(title, author = '') {
    const shortTitle = cleanCoReadReadableText(title || '共读').replace(/\s+/g, '').slice(0, 6) || '共读';
    const shortAuthor = cleanCoReadReadableText(author || '').replace(/\s+/g, ' ').slice(0, 18);
    const seed = Array.from(`${shortTitle}${shortAuthor}`).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const palettes = [
        ['#eee4d4', '#bba58a', '#6c5945'],
        ['#e7eddc', '#9db48f', '#405f47'],
        ['#e8e2d8', '#c4a6a0', '#6a4e4a'],
        ['#e4e6df', '#9aa7aa', '#344b54'],
        ['#f0e7da', '#d3b36f', '#604d31']
    ];
    const [paper, accent, ink] = palettes[Math.abs(seed) % palettes.length];
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#fffaf0"/>
                    <stop offset="0.45" stop-color="${paper}"/>
                    <stop offset="1" stop-color="${accent}"/>
                </linearGradient>
            </defs>
            <rect width="360" height="520" rx="10" fill="url(#g)"/>
            <rect x="0" y="0" width="42" height="520" fill="${ink}" opacity="0.13"/>
            <rect x="62" y="62" width="236" height="330" rx="4" fill="#fffaf0" opacity="0.32" stroke="${ink}" stroke-opacity="0.13"/>
            <text x="180" y="210" text-anchor="middle" fill="${ink}" font-size="42" font-family="Georgia, 'Noto Serif SC', serif" font-weight="800">${musicEscapeHtml(shortTitle)}</text>
            <text x="180" y="452" text-anchor="middle" fill="${ink}" opacity="0.72" font-size="22" font-family="'Noto Serif SC', serif">${musicEscapeHtml(shortAuthor || 'BYND')}</text>
        </svg>
    `.replace(/\s{2,}/g, ' ').trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function ensureCoReadBookCover(bookId) {
    const library = getCoReadLibrary();
    const book = library.find(item => item.id === bookId);
    if (!book || book.coverUrl || book.coverResolving) return;
    coreadCoverResolvingIds.add(bookId);
    book.coverResolving = true;
    saveCoReadLibrary(library);
    try {
        const cover = await fetchCoReadCoverFromMetadata(book.title, book.author);
        coreadCoverResolvingIds.delete(bookId);
        const latest = getCoReadLibrary();
        const target = latest.find(item => item.id === bookId);
        if (target) {
            target.coverUrl = cover || target.coverUrl || buildCoReadGeneratedCoverUrl(target.title, target.author);
            target.coverResolving = false;
            saveCoReadLibrary(latest);
        }
    } catch (_) {
        coreadCoverResolvingIds.delete(bookId);
        const latest = getCoReadLibrary();
        const target = latest.find(item => item.id === bookId);
        if (target) {
            target.coverUrl = target.coverUrl || buildCoReadGeneratedCoverUrl(target.title, target.author);
            target.coverResolving = false;
            saveCoReadLibrary(latest);
        }
    }
    renderCoReadDashboard();
}

function getCoReadCharName(char) {
    return (char && char.chatConfig && char.chatConfig.nickname) || (char && char.name) || '未命名';
}

function getCoReadRecentContext(char) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    return history.slice(-12).map(msg => {
        const who = msg.isMe ? '用户' : getCoReadCharName(char);
        const text = String(msg.description || msg.content || msg.dialogue || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        return text ? `${who}: ${text.slice(0, 220)}` : '';
    }).filter(Boolean).join('\n') || '暂无最近聊天。';
}

function getCoReadWorldBookText(char) {
    const entries = Array.isArray(char && char.worldBook)
        ? char.worldBook.filter(entry => entry && entry.enabled !== false)
        : [];
    return entries.slice(0, 12).map(entry => {
        const keySource = [entry.key, entry.keys, entry.keyword, entry.name, entry.comment].find(value => {
            if (Array.isArray(value)) return value.filter(Boolean).length > 0;
            return String(value || '').trim();
        }) || '';
        const key = Array.isArray(keySource) ? keySource.filter(Boolean).join('、') : String(keySource || '');
        const content = String(entry.content || entry.entry || entry.value || entry.text || '').replace(/\s+/g, ' ').slice(0, 420);
        return content ? `${key ? `【${key}】` : ''}${content}` : '';
    }).filter(Boolean).join('\n');
}

function sanitizeCoReadPromptText(text) {
    return String(text || '')
        .replace(/\b(?:alpha|omega|beta)\b/gi, '角色')
        .replace(/信息素/g, '气息')
        .replace(/腺体/g, '身体反应')
        .replace(/发情|易感期|标记/g, '情绪牵引')
        .replace(/包养/g, '供养')
        .replace(/乳糖|奶糖/g, '甜味')
        .replace(/恶心/g, '不适')
        .replace(/雪藏/g, '冷处理')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function getCoReadPageText(book) {
    if (book && book.resolving) return book.resolveStatus || '正在解析正文和章节，稍等一下。';
    const content = String(book && book.content || book && book.description || '');
    if (!content) return '这本书目前只有书名和来源链接，还没有正文。';
    const page = Math.max(0, Number(book.page || 0));
    const size = COREAD_PAGE_SIZE;
    return content.slice(page * size, (page + 1) * size) || content.slice(-size);
}

function getCoReadRecentPageContextText(book) {
    if (book && book.resolving) return book.resolveStatus || '正在解析正文和章节，稍等一下。';
    const content = String(book && book.content || book && book.description || '');
    if (!content) return '这本书目前只有书名和来源链接，还没有正文。';
    const pageCount = Math.max(1, Math.ceil(content.length / COREAD_PAGE_SIZE));
    const rawPage = Number(book && book.page);
    const requestedPage = Number.isFinite(rawPage) ? Math.floor(rawPage) : 0;
    const currentPage = Math.max(0, Math.min(pageCount - 1, requestedPage));
    const startPage = Math.max(0, currentPage - COREAD_AI_CONTEXT_PREVIOUS_PAGES);
    const pieces = [];
    for (let page = startPage; page <= currentPage; page += 1) {
        const text = content.slice(page * COREAD_PAGE_SIZE, (page + 1) * COREAD_PAGE_SIZE).trim();
        if (!text) continue;
        const distance = currentPage - page;
        const label = page === currentPage ? '当前页' : (distance === 1 ? '上一页' : `前 ${distance} 页`);
        pieces.push(`【${label}】\n${text}`);
    }
    return pieces.join('\n\n') || getCoReadPageText(book);
}

function isCoReadUsefulContent(text) {
    const clean = String(text || '').replace(/\s+/g, '');
    if (clean.length < 300) return false;
    if (/^书名[:：].{0,80}作者[:：]/.test(clean)) return false;
    return true;
}

function isCoReadLikelyDirectoryContent(text) {
    const clean = String(text || '').replace(/\s+/g, ' ');
    return (clean.match(/第\s*\d+\s*章/g) || []).length >= 5;
}

function shouldResolveCoReadBookContent(book) {
    if (!book || !book.url || coreadResolvingBookIds.has(book.id)) return false;
    // A link that already failed to parse waits for a manual 重新解析 instead of re-fetching forever.
    if (book.resolveFailedAt) return false;
    const contentLength = String(book.content || '').length;
    if (isCoReadUrlTitle(book.title) && Number(book.resolveMetaVersion || 0) < COREAD_META_VERSION) return true;
    if (Number(book.resolveChapterVersion || 0) < COREAD_CHAPTER_VERSION) return true;
    if (!isCoReadUsefulContent(book.content)) return true;
    if (Number(book.resolveVersion || 0) < COREAD_RESOLVE_VERSION && isCoReadLikelyDirectoryContent(book.content)) return true;
    return Number(book.resolveVersion || 0) < COREAD_RESOLVE_VERSION && contentLength < 6000;
}

