function getCoReadTodayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getCoReadDailyParticipants() {
    const today = getCoReadTodayKey();
    try {
        const cache = JSON.parse(localStorage.getItem(COREAD_DAILY_PARTICIPANTS_KEY) || '{}');
        if (cache && cache.date === today && Number.isFinite(Number(cache.value))) {
            return Number(cache.value);
        }
    } catch (_) {
        // Regenerate below if the cached shape is invalid.
    }
    const min = 46000;
    const max = 268000;
    let random = Math.random();
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const bucket = new Uint32Array(1);
        window.crypto.getRandomValues(bucket);
        random = bucket[0] / 0xffffffff;
    }
    const value = Math.floor(min + random * (max - min + 1));
    try {
        localStorage.setItem(COREAD_DAILY_PARTICIPANTS_KEY, JSON.stringify({ date: today, value }));
    } catch (_) {
        // localStorage may be unavailable in private contexts; the random value still renders.
    }
    return value;
}

function getCoReadDailyCache() {
    try {
        const cache = JSON.parse(localStorage.getItem(COREAD_DAILY_KEY) || '{}');
        return cache && typeof cache === 'object' ? cache : {};
    } catch (_) {
        return {};
    }
}

function saveCoReadDailyCache(cache) {
    localStorage.setItem(COREAD_DAILY_KEY, JSON.stringify(cache && typeof cache === 'object' ? cache : {}));
}

function buildCoReadFallbackDaily() {
    const today = getCoReadTodayKey();
    const line = COREAD_DAILY_LINES[Math.abs(today.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % COREAD_DAILY_LINES.length];
    return {
        title: '今日惊喜书页',
        author: '在线书城同步中',
        line,
        tone: '随机推送 · 每日一书',
        volume: `VOL.${String(new Date().getDate()).padStart(2, '0')}`,
        source: 'daily-fallback',
        url: '',
        description: '打开共读后会尝试从在线书城抽取每日推荐。'
    };
}

function getCoReadDailyRecommendation() {
    const cache = getCoReadDailyCache();
    const today = getCoReadTodayKey();
    return cache.date === today && cache.book ? cache.book : buildCoReadFallbackDaily();
}

function getCoReadHolidaySense(date = new Date()) {
    const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const map = {
        '01-01': { title: '元旦', line: '新的一年，也给故事留一个新的开头。', theme: 'NEW YEAR' },
        '02-14': { title: '情人节', line: '把心动写进书页，和喜欢的人慢慢读。', theme: 'LOVE' },
        '05-01': { title: '劳动节', line: '忙碌之后，留一页给自己安静下来。', theme: 'REST' },
        '06-01': { title: '童心', line: '有些故事，会把人带回最柔软的年纪。', theme: 'CHILDHOOD' },
        '10-01': { title: '国庆', line: '山河辽阔，故事也值得慢慢走过。', theme: 'NATIONAL DAY' },
        '12-25': { title: '冬日', line: '把暖意藏进一页书里，等夜色慢下来。', theme: 'WINTER' }
    };
    const dragonBoat = ['05-30', '05-31', '06-01', '06-02', '06-03'];
    if (dragonBoat.includes(mmdd)) {
        return { title: '端午', line: '除了中国传统节日，这些传统文化你也不能忘', theme: 'DRAGON BOAT FESTIVAL' };
    }
    return map[mmdd] || null;
}

async function refreshCoReadDailyRecommendation(force = false) {
    if (coreadDailyLoading) return;
    const cache = getCoReadDailyCache();
    const today = getCoReadTodayKey();
    if (!force && cache.date === today && cache.book && cache.book.title && cache.book.source !== 'daily-fallback') {
        renderCoReadDaily();
        return;
    }
    coreadDailyLoading = true;
    renderCoReadDaily();
    try {
        const seedBase = today.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) + (force ? Math.floor(Math.random() * 1000) : 0);
        const seed = COREAD_DAILY_SEEDS[Math.abs(seedBase) % COREAD_DAILY_SEEDS.length];
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(seed)}&maxResults=20&orderBy=relevance`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`daily search ${resp.status}`);
        const data = await resp.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const candidates = items.map(item => {
            const info = item.volumeInfo || {};
            return {
                title: stripWechatPromptText(info.title || '', 80),
                author: Array.isArray(info.authors) ? stripWechatPromptText(info.authors.slice(0, 2).join(' / '), 80) : '',
                line: stripWechatPromptText(info.subtitle || info.description || COREAD_DAILY_LINES[Math.floor(Math.random() * COREAD_DAILY_LINES.length)], 72),
                tone: stripWechatPromptText((Array.isArray(info.categories) ? info.categories.slice(0, 2).join(' · ') : '') || seed, 42),
                volume: `VOL.${String(new Date().getDate()).padStart(2, '0')}`,
                source: 'Google Books Daily',
                url: info.infoLink || item.selfLink || '',
                description: stripWechatPromptText(info.description || '', 520)
            };
        }).filter(item => item.title);
        const picked = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
        const book = picked || buildCoReadFallbackDaily();
        saveCoReadDailyCache({ date: today, book, updatedAt: Date.now() });
    } catch (e) {
        const fallback = buildCoReadFallbackDaily();
        const current = getCoReadDailyCache();
        if (!current.book || force) saveCoReadDailyCache({ date: today, book: fallback, updatedAt: Date.now() });
    } finally {
        coreadDailyLoading = false;
        renderCoReadDaily();
    }
}

function renderCoReadDaily() {
    const rec = getCoReadDailyRecommendation();
    const holiday = getCoReadHolidaySense();
    const volume = document.getElementById('coread-daily-volume');
    const title = document.getElementById('coread-daily-title');
    const line = document.getElementById('coread-daily-line');
    const card = document.getElementById('coread-daily-card');
    const participants = getCoReadDailyParticipants();
    const senseTitle = holiday ? holiday.title : '惊喜';
    const senseLine = holiday ? holiday.line : (rec.line || '你缺的有趣叫仪式感，赠你生活达人养成秘籍');
    if (volume) volume.textContent = rec.volume;
    if (title) title.textContent = holiday ? holiday.title : '今日惊喜书页';
    if (line) line.textContent = senseLine;
    if (card) {
        card.innerHTML = `
            <button type="button" class="coread-daily-book coread-sense-card${holiday ? ' is-holiday' : ''}" onclick="refreshCoReadDailyRecommendation(true)" aria-label="换一张今日惊喜书页">
                <span>${musicEscapeHtml(rec.volume || 'VOL.17')}</span>
                <b>SENSE</b>
                <i aria-hidden="true"></i>
                <em>${musicEscapeHtml(senseLine)}</em>
                <strong><span class="coread-sense-title-text">${musicEscapeHtml(senseTitle)}</span></strong>
                <small>${musicEscapeHtml(holiday ? holiday.theme : `${participants}人 · 参与话题`)}</small>
            </button>
        `;
    }
}

function handleCoReadBack() {
    if (coreadActiveTab === 'reader' && coreadReaderPanelOpen) {
        closeCoReadReaderPanel();
        return false;
    }
    if (coreadActiveTab === 'reader' || coreadActiveTab === 'detail') {
        setCoReadTab('shelf');
        return false;
    }
    closeApp('coread');
    return false;
}
window.handleCoReadBack = handleCoReadBack;

function updateCoReadTopbar() {
    const topbar = document.querySelector('.coread-topbar');
    if (!topbar) return;
    const eyebrow = topbar.querySelector('span');
    const title = topbar.querySelector('strong');
    const rightBtn = topbar.querySelector('button:last-child');
    const backBtn = topbar.querySelector('button:first-child');
    const backIcon = topbar.querySelector('button:first-child i');
    if (backBtn) {
        const returnsToReading = coreadActiveTab === 'reader' && coreadReaderPanelOpen;
        const returnsToShelf = coreadActiveTab === 'reader' || coreadActiveTab === 'detail';
        backBtn.setAttribute('onclick', 'return handleCoReadBack()');
        backBtn.setAttribute('aria-label', returnsToReading ? '返回阅读' : (returnsToShelf ? '返回书架' : '返回'));
    }
    const tabs = {
        discover: { title: '发现', icon: 'ri-more-fill', onclick: 'return openCoReadShelfTools(event)', aria: '打开书架工具' },
        shelf: { title: '书架', icon: 'ri-more-fill', onclick: 'return openCoReadShelfTools(event)', aria: '打开书架工具' },
        detail: { title: '书页', icon: 'ri-book-open-line', onclick: "startCoReadBook()", aria: '开始阅读' },
        thoughts: { title: '想法', icon: 'ri-more-fill', onclick: 'return openCoReadShelfTools(event)', aria: '打开书架工具' },
        me: { title: '我', icon: 'ri-more-fill', onclick: 'return openCoReadShelfTools(event)', aria: '打开书架工具' }
    };
    const config = tabs[coreadActiveTab];
    topbar.classList.toggle('coread-ios-topbar', !!config);
    topbar.classList.toggle('coread-reader-topbar', coreadActiveTab === 'reader');
    if (coreadActiveTab === 'reader') {
        if (eyebrow) eyebrow.textContent = '';
        if (title) title.textContent = '';
        if (rightBtn) {
            rightBtn.classList.remove('coread-topbar-text-btn');
            rightBtn.innerHTML = '<i class="ri-chat-quote-line"></i>';
            rightBtn.setAttribute('onclick', 'openCoReadCommentPanel()');
            rightBtn.setAttribute('aria-label', '打开 char 共读气泡');
            rightBtn.removeAttribute('aria-haspopup');
            rightBtn.removeAttribute('aria-controls');
            rightBtn.removeAttribute('aria-expanded');
        }
        if (backIcon) backIcon.className = 'ri-arrow-left-s-line';
        return;
    }
    if (!config) {
        if (eyebrow) eyebrow.textContent = 'SHARED READING';
        if (title) title.textContent = '和 char 共读小说';
        if (rightBtn) {
            rightBtn.classList.remove('coread-topbar-text-btn');
            rightBtn.innerHTML = '<i class="ri-chat-quote-line"></i>';
            rightBtn.setAttribute('onclick', 'openCoReadCommentPanel()');
            rightBtn.setAttribute('aria-label', '打开 char 共读气泡');
            rightBtn.removeAttribute('aria-haspopup');
            rightBtn.removeAttribute('aria-controls');
            rightBtn.removeAttribute('aria-expanded');
        }
        if (backIcon) backIcon.className = 'ri-arrow-left-s-line';
        return;
    }
    if (eyebrow) eyebrow.textContent = '';
    if (title) title.textContent = config.title;
    if (rightBtn) {
        rightBtn.classList.remove('coread-topbar-text-btn');
        rightBtn.innerHTML = `<i class="${config.icon || 'ri-more-fill'}"></i>`;
        rightBtn.setAttribute('onclick', config.onclick);
        rightBtn.removeAttribute('onpointerdown');
        rightBtn.setAttribute('aria-label', config.aria || config.title);
        if (coreadActiveTab === 'shelf') {
            rightBtn.setAttribute('aria-haspopup', 'dialog');
            rightBtn.setAttribute('aria-controls', 'coread-shelf-menu');
            rightBtn.setAttribute('aria-expanded', coreadShelfMenuOpen ? 'true' : 'false');
        } else {
            rightBtn.removeAttribute('aria-haspopup');
            rightBtn.removeAttribute('aria-controls');
            rightBtn.removeAttribute('aria-expanded');
        }
    }
    if (backIcon) backIcon.className = 'ri-arrow-left-s-line';
}

function renderCoReadApp() {
    const list = document.getElementById('coread-book-list');
    const chars = document.getElementById('coread-char-list');
    const status = document.getElementById('coread-status');
    const library = getCoReadLibrary();
    const isReader = coreadActiveTab === 'reader';
    if (coreadActiveTab !== 'shelf') {
        coreadShelfMenuOpen = false;
        coreadShelfToolPanel = '';
    }
    if (!isReader) {
        coreadTocOpen = false;
        coreadSettingsOpen = false;
        coreadCommentPanelOpen = false;
    }
    if (!coreadActiveBookId && library[0]) coreadActiveBookId = library[0].id;
    if (!coreadActiveCharId && getCoReadCharacters()[0]) coreadActiveCharId = getCoReadCharacters()[0].id;
    if (!isReader) {
        const shelfBooks = getCoReadShelfBooks(library);
        if (list) list.innerHTML = shelfBooks.map(renderCoReadBookCard).join('') || `<div class="coread-empty">${library.length ? '这个分类下暂时没有书。' : '还没有书'}</div>`;
        if (chars) chars.innerHTML = renderCoReadCharOptions();
        if (status) status.textContent = coreadBusy ? '正在听 char 读这一页' : (coreadShelfStatusText || '内置书城优先，公开书目备用。');
    }
    const content = document.querySelector('.coread-content');
    if (content) content.dataset.tab = coreadActiveTab;
    const shell = document.querySelector('.coread-shell');
    if (shell) {
        shell.classList.toggle('coread-reader-mode', isReader);
        shell.classList.toggle('coread-reader-panel-open', isReader && coreadReaderPanelOpen);
    }
    applyCoReadShelfSettings();
    renderCoReadShelfTabs(library);
    renderCoReadShelfSelectionToolbar(library);
    renderCoReadShelfMenu();
    syncCoReadShelfMenuState();
    applyCoReadReaderSettings();
    updateCoReadTopbar();
    const backBtn = document.querySelector('.coread-topbar button:first-child');
    if (backBtn) {
        const returnsToReading = isReader && coreadReaderPanelOpen;
        const returnsToShelf = isReader || coreadActiveTab === 'detail';
        backBtn.setAttribute('onclick', 'return handleCoReadBack()');
        backBtn.setAttribute('aria-label', returnsToReading ? '返回阅读' : (returnsToShelf ? '返回书架' : '返回'));
    }
    document.querySelectorAll('.coread-bottom-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.coreadTab === coreadActiveTab);
    });
    if (isReader) {
        renderCoReadReader();
        renderCoReadToc();
        renderCoReadSettings();
        renderCoReadCommentPanel();
    } else {
        syncCoReadTocDrawerState();
        syncCoReadSettingsDrawerState();
        renderCoReadCommentPanel();
        if (coreadActiveTab === 'discover') renderCoReadDaily();
        if (coreadActiveTab === 'shelf') renderCoReadDashboard();
        if (coreadActiveTab === 'detail') renderCoReadBookDetail();
        if (coreadActiveTab === 'thoughts') renderCoReadThoughts();
        if (coreadActiveTab === 'me') {
            renderCoReadMePanel();
            renderCoReadCalendarStats();
        }
        if (coreadActiveTab === 'discover' || coreadActiveTab === 'shelf') renderCoReadSourceManager();
    }
    let currentLibrary = library;
    const stuck = currentLibrary.find(book => book && book.url && book.resolving && Number(book.resolveVersion || 0) < COREAD_RESOLVE_VERSION && !coreadResolvingBookIds.has(book.id));
    if (stuck) {
        stuck.resolving = false;
        stuck.resolveStatus = '等待重新解析正文';
        saveCoReadLibrary(currentLibrary);
        currentLibrary = getCoReadLibrary();
    }
    const expandable = currentLibrary.find(book => book.id === coreadActiveBookId && shouldResolveCoReadBookContent(book))
        || currentLibrary.find(book => shouldResolveCoReadBookContent(book));
    if (expandable) {
        setTimeout(() => resolveCoReadBookContent(expandable.id), 0);
    }
}

function initCoReadApp() {
    bindCoReadFastSettingsControls();
    bindCoReadShelfMenuEvents();
    renderCoReadApp();
    maybeLoadCoReadDiscoveryData();
}
window.initCoReadApp = initCoReadApp;

function maybeLoadCoReadDiscoveryData() {
    if (coreadDiscoveryLoadStarted || (coreadActiveTab !== 'discover' && coreadActiveTab !== 'shelf')) return;
    coreadDiscoveryLoadStarted = true;
    setTimeout(() => {
        refreshCoReadDailyRecommendation(false);
        loadCoReadBuiltinSources(false).then(() => {
            if (coreadActiveTab === 'discover' || coreadActiveTab === 'shelf') renderCoReadSourceManager();
        });
    }, 0);
}

function selectCoReadBook(bookId) {
    if (coreadShelfSelectionMode) {
        toggleCoReadShelfBookSelected(bookId);
        return;
    }
    coreadActiveBookId = bookId || '';
    coreadActiveTab = 'detail';
    renderCoReadApp();
}
window.selectCoReadBook = selectCoReadBook;

function selectCoReadChar(charId) {
    coreadActiveCharId = charId || '';
    coreadMateDropdownOpen = false;
    renderCoReadApp();
}
window.selectCoReadChar = selectCoReadChar;

function setCoReadTab(tab) {
    coreadActiveTab = tab || 'discover';
    if (coreadActiveTab !== 'shelf') {
        coreadShelfMenuOpen = false;
        coreadShelfToolPanel = '';
    }
    const content = document.querySelector('.coread-content');
    if (content) content.dataset.tab = coreadActiveTab;
    renderCoReadApp();
    maybeLoadCoReadDiscoveryData();
}
window.setCoReadTab = setCoReadTab;

function closeCoReadReader() {
    setCoReadTab('shelf');
}
window.closeCoReadReader = closeCoReadReader;

function addCoReadRecommendedBook() {
    const rec = getCoReadDailyRecommendation();
    addCoReadBook({
        title: rec.title,
        author: rec.author,
        source: 'daily',
        url: rec.url || '',
        description: rec.description || rec.line || '',
        content: `每日推荐：${rec.title}\n作者：${rec.author || '未知'}\n来源：${rec.source || '每日推荐'} ${rec.url || ''}\n\n${rec.description || rec.line || '可以先加入书架，再导入 txt/md 正文开始共读。'}`
    });
}
window.addCoReadRecommendedBook = addCoReadRecommendedBook;

function addCoReadBook(book) {
    const library = getCoReadLibrary();
    const safe = {
        id: book.id || `book_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: String(book.title || '未命名书籍').slice(0, 120),
        author: String(book.author || '').slice(0, 120),
        source: String(book.source || 'local'),
        url: String(book.url || ''),
        coverUrl: normalizeCoReadCoverUrl(book.coverUrl || ''),
        rating: Math.max(0, Math.min(5, Number(book.rating || 0))),
        sourceData: book.sourceData || null,
        chapters: Array.isArray(book.chapters) ? book.chapters.slice(0, 360) : [],
        content: String(book.content || ''),
        description: String(book.description || ''),
        category: String(book.category || book.categoryId || '').trim().slice(0, 28),
        tags: Array.isArray(book.tags) ? book.tags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 12) : [],
        resolving: false,
        resolveStatus: book.url && !isCoReadUsefulContent(book.content || '') ? '等待解析正文' : '',
        resolveVersion: book.url && isCoReadUsefulContent(book.content || '') ? COREAD_RESOLVE_VERSION : 0,
        resolveMetaVersion: book.url && isCoReadUrlTitle(book.title || '') ? 0 : COREAD_META_VERSION,
        resolveChapterVersion: Array.isArray(book.chapters) && book.chapters.length ? COREAD_CHAPTER_VERSION : 0,
        page: 0,
        createdAt: Date.now()
    };
    library.unshift(safe);
    saveCoReadLibrary(library);
    coreadActiveBookId = safe.id;
    coreadActiveTab = 'reader';
    renderCoReadApp();
    if (!safe.coverUrl && !isCoReadUrlTitle(safe.title)) ensureCoReadBookCover(safe.id);
    if (shouldResolveCoReadBookContent(safe)) resolveCoReadBookContent(safe.id);
}

function cleanCoReadReadableText(text) {
    return String(text || '')
        .replace(/\r/g, '\n')
        .replace(/[-]/g, ch => COREAD_OBFUSCATED_TEXT_MAP[ch] || ch)
        .replace(/……?（?内容加载失败！?）?[\s\S]*$/g, '')
        .replace(/抱歉，章节内容不支持该浏览器显示[\s\S]*$/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>|<\/div>|<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

function collectCoReadJsonTexts(value, out = []) {
    if (value == null) return out;
    if (typeof value === 'string') {
        const text = cleanCoReadReadableText(value);
        if (text.length > 180) out.push(text);
        return out;
    }
    if (Array.isArray(value)) {
        value.forEach(item => collectCoReadJsonTexts(item, out));
        return out;
    }
    if (typeof value === 'object') {
        const preferred = ['content', 'chapterContent', 'bookContent', 'text', 'body', 'html', 'data'];
        preferred.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(value, key)) collectCoReadJsonTexts(value[key], out);
        });
        Object.keys(value).forEach(key => {
            if (!preferred.includes(key)) collectCoReadJsonTexts(value[key], out);
        });
    }
    return out;
}

function extractCoReadTextFromJson(raw) {
    try {
        const data = JSON.parse(String(raw || '').replace(/^\uFEFF/, ''));
        const pieces = collectCoReadJsonTexts(data)
            .filter(text => !/^https?:\/\//i.test(text) && !/^\d+$/.test(text))
            .sort((a, b) => b.length - a.length);
        return pieces.slice(0, 8).join('\n\n');
    } catch (_) {
        return '';
    }
}

function cleanCoReadBookTitle(title) {
    let text = cleanCoReadReadableText(title).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    text = text
        .replace(/^Title:\s*/i, '')
        .replace(/(?:最新章节|小说全文|全文阅读|无弹窗|免费阅读|章节目录|在线阅读|小说网|镇魂小说网).*$/i, '')
        .replace(/[（(][^）)]{1,40}[）)]/g, '')
        .split(/[_｜|]/)[0]
        .replace(/\s*[-—]\s*(?:小说|小说网|在线阅读|全文阅读).*$/i, '')
        .replace(/小说$/i, '')
        .replace(/^www\.[^\s/]+.*$/i, '')
        .trim();
    return text.length > 1 ? text.slice(0, 80) : '';
}

function cleanCoReadBookAuthor(author) {
    let text = cleanCoReadReadableText(author).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    text = text
        .replace(/^作者\s*[:：]?\s*/i, '')
        .replace(/\s*(?:著|作者|写的|作品).*$/i, '')
        .replace(/[|｜_].*$/g, '')
        .trim();
    return text && !/^https?:\/\//i.test(text) ? text.slice(0, 60) : '';
}

function isCoReadUrlTitle(title) {
    const text = String(title || '').trim();
    return !text || /^https?:\/\//i.test(text) || /^www\./i.test(text) || /^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(text);
}

function extractCoReadMetadataFromHtml(raw, baseUrl = '') {
    const text = String(raw || '');
    const meta = { title: '', author: '', coverUrl: '' };
    const jinaTitle = text.match(/^\s*Title:\s*([^\n]+)/i);
    const titleAuthor = jinaTitle && jinaTitle[1].match(/[（(]([^）)]{2,30})[）)]/);
    if (titleAuthor) meta.author = cleanCoReadBookAuthor(titleAuthor[1]);
    if (jinaTitle) meta.title = cleanCoReadBookTitle(jinaTitle[1]);
    const jinaMarkdownHead = text.match(/Markdown Content:\s*\n+\s*#\s*([^\n]+)/i);
    if (!meta.title && jinaMarkdownHead) meta.title = cleanCoReadBookTitle(jinaMarkdownHead[1]);
    try {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const readAttr = selector => doc.querySelector(selector)?.getAttribute('content') || '';
        const readText = selector => doc.querySelector(selector)?.textContent || '';
        meta.title = meta.title
            || cleanCoReadBookTitle(readAttr('meta[property="og:title"], meta[name="og:title"]'))
            || cleanCoReadBookTitle(readAttr('meta[name="twitter:title"]'))
            || cleanCoReadBookTitle(readText('h1, .book-title, .bookname, #info h1, .info h1, title'));
        meta.author = meta.author
            || cleanCoReadBookAuthor(readAttr('meta[name="author"], meta[property="book:author"], meta[property="article:author"]'))
            || cleanCoReadBookAuthor(readText('.author, .book-author, .writer, #info p, .info p'));
        const cover = readAttr('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"]')
            || doc.querySelector('.cover img, .book-cover img, #fmimg img, img.cover')?.getAttribute('src')
            || '';
        if (cover) {
            try {
                meta.coverUrl = normalizeCoReadCoverUrl(new URL(cover, baseUrl).href);
            } catch (_) {
                meta.coverUrl = normalizeCoReadCoverUrl(cover);
            }
        }
    } catch (_) {}
    const plain = cleanCoReadReadableText(text);
    if (!meta.author) {
        const authorMatch = plain.match(/(?:作者|作\s*者)\s*[:：]\s*([^\n\r《》_｜|]{1,40})/);
        if (authorMatch) meta.author = cleanCoReadBookAuthor(authorMatch[1]);
    }
    if (!meta.title) {
        const titleMatch = plain.match(/(?:书名|小说名)\s*[:：]\s*([^\n\r《》_｜|]{1,60})/);
        if (titleMatch) meta.title = cleanCoReadBookTitle(titleMatch[1]);
    }
    return meta;
}

function mergeCoReadMetadata(target, meta = {}) {
    if (!target || !meta) return;
    if (meta.title && (isCoReadUrlTitle(target.title) || target.source === 'url')) {
        target.title = meta.title;
        if (!target.coverUrl) target.coverResolving = false;
    }
    if (meta.author && (!target.author || target.author === '未知作者')) {
        target.author = meta.author;
    }
    if (meta.coverUrl && !target.coverUrl) {
        target.coverUrl = meta.coverUrl;
    }
}

function extractCoReadTextFromHtml(html, baseUrl = '') {
    const raw = String(html || '');
    if (/^\s*Title:\s*/i.test(raw) && /\n\n/.test(raw)) {
        return cleanCoReadReadableText(raw.replace(/^\s*Title:[^\n]*\n+(?:URL Source|URL):[^\n]*\n+(?:Published Time:[^\n]*\n+)?(?:Markdown Content:\n+)?/i, ''));
    }
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    doc.querySelectorAll('script,style,noscript,nav,header,footer,iframe,form,button,.nav,.header,.footer,.ads,.advertisement,.comment,.comments').forEach(node => node.remove());
    const selectors = [
        '.article-content', '#content', '.content', '.chapter-content', '.chapter_content', '.read-content',
        '.reader-content', '.article-content', '.book-content', '.novelcontent',
        '.txt', '.txtnav', '.entry-content', '.post-content', 'article', 'main'
    ];
    const candidates = selectors
        .flatMap(selector => Array.from(doc.querySelectorAll(selector)))
        .map(node => cleanCoReadReadableText(node.innerHTML || node.textContent || ''))
        .filter(text => text.length > 240);
    if (!candidates.length) {
        const bodyText = cleanCoReadReadableText(doc.body ? doc.body.innerHTML : raw);
        if (bodyText.length > 500) candidates.push(bodyText);
    }
    return candidates.sort((a, b) => b.length - a.length)[0] || '';
}

function extractCoReadChapterText(raw, url = '') {
    const jsonText = extractCoReadTextFromJson(raw);
    if (isCoReadUsefulContent(jsonText)) return jsonText;
    const htmlText = extractCoReadTextFromHtml(raw, url);
    if (isCoReadUsefulContent(htmlText)) return htmlText;
    try {
        const doc = new DOMParser().parseFromString(String(raw || ''), 'text/html');
        const article = doc.querySelector('article.article-content, .article-content, .entry-content, .post-content');
        const text = cleanCoReadReadableText(article ? (article.innerHTML || article.textContent || '') : '');
        if (isCoReadUsefulContent(text)) return text;
    } catch (_) {}
    return htmlText || jsonText || '';
}

function findCoReadContinuationLinks(html, baseUrl = '') {
    const raw = String(html || '');
    const links = [];
    const seen = new Set();
    const add = href => {
        if (!href || /javascript:|#|mailto:/i.test(href)) return;
        try {
            const url = new URL(href, baseUrl).href;
            if (!seen.has(url)) {
                seen.add(url);
                links.push(url);
            }
        } catch (_) {}
    };
    const nextFromScript = raw.match(/t2018_1\s*:\s*['"]([^'"]+)['"]/);
    if (nextFromScript) add(nextFromScript[1]);
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    Array.from(doc.querySelectorAll('a[href]')).forEach(a => {
        const label = cleanCoReadReadableText(a.textContent || '');
        const href = a.getAttribute('href') || '';
        if (/下一页|下一章|下页|下章|继续阅读/i.test(label)) add(href);
    });
    return links;
}

function findCoReadChapterLinks(html, baseUrl = '') {
    const raw = String(html || '');
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const links = [];
    const seen = new Set();
    const add = (title, href) => {
        if (!href || /javascript:|#|mailto:/i.test(href)) return;
        try {
            const url = normalizeCoReadChapterUrl(href, baseUrl);
            if (!seen.has(url)) {
                seen.add(url);
                links.push({ title: title || '正文', url });
            }
        } catch (_) {}
    };
    Array.from(doc.querySelectorAll('a[href]')).forEach(a => {
        const label = cleanCoReadReadableText(a.textContent || '');
        const href = a.getAttribute('href') || '';
        const looksChapter = /第\s*[一二三四五六七八九十百千万零〇\d]+\s*[章节回卷]|第.{1,16}[章节回卷]|chapter|正文|目录|阅读|最新章/i.test(label)
            || (/chapter|read|book|novel|\/\d+\.html|\/\d+\/?$/i.test(href) && !/简介|介绍|作者|评论|目录/.test(label));
        if (looksChapter) add(label, href);
    });
    Array.from(raw.matchAll(/\[([^\]]*第\s*[一二三四五六七八九十百千万零〇\d]+\s*[章节回卷][^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+["'][^"']*["'])?\)/g))
        .forEach(match => add(cleanCoReadReadableText(match[1]), match[2]));
    return links.slice(0, 360).map((chapter, index) => ({
        title: cleanCoReadReadableText(chapter.title).replace(/\s+/g, ' ').slice(0, 88) || `第 ${index + 1} 章`,
        url: chapter.url,
        page: getCoReadChapterPage(chapter)
    }));
}

async function extractCoReadReadableContent(url, title = '') {
    const rawUrl = String(url || '').trim();
    const result = { content: '', meta: {}, chapters: [] };
    if (!/^https?:\/\//i.test(rawUrl)) return result;
    const first = await coReadFetchText(rawUrl, { timeoutMs: 6500, quiet: true });
    result.meta = extractCoReadMetadataFromHtml(first, rawUrl);
    const jsonText = extractCoReadTextFromJson(first);
    if (isCoReadUsefulContent(jsonText) && !isCoReadLikelyDirectoryContent(jsonText)) {
        result.content = jsonText;
        return result;
    }
    const chapters = findCoReadChapterLinks(first, rawUrl);
    result.chapters = chapters;
    if (chapters.length >= 3) {
        const picked = [];
        for (const chapter of chapters.slice(0, 3)) {
            try {
                const chapterRaw = await coReadFetchText(chapter.url, { timeoutMs: 12000, quiet: true });
                const chapterText = extractCoReadChapterText(chapterRaw, chapter.url);
                if (isCoReadUsefulContent(chapterText)) {
                    chapter.page = Math.max(0, Math.floor(picked.join('\n\n').length / COREAD_PAGE_SIZE));
                    picked.push(`${chapter.title || title || '章节'}\n\n${chapterText}`);
                }
            } catch (_) {}
            if (picked.join('\n\n').length > 7000) break;
        }
        if (picked.length) {
            result.content = picked.join('\n\n');
            return result;
        }
    }
    const pageText = extractCoReadTextFromHtml(first, rawUrl);
    if (isCoReadUsefulContent(pageText) && !isCoReadLikelyDirectoryContent(pageText) && !/目录|最新章节|全部章节/.test(pageText.slice(0, 500))) {
        const pieces = [pageText];
        const seen = new Set([rawUrl]);
        let nextUrl = findCoReadContinuationLinks(first, rawUrl).find(link => !seen.has(link));
        for (let i = 0; nextUrl && i < 3 && pieces.join('\n\n').length < 9000; i += 1) {
            seen.add(nextUrl);
            try {
                const nextRaw = await coReadFetchText(nextUrl, { timeoutMs: 12000, quiet: true });
                const nextText = extractCoReadChapterText(nextRaw, nextUrl);
                if (isCoReadUsefulContent(nextText) && !pieces.includes(nextText)) {
                    pieces.push(nextText);
                }
                nextUrl = findCoReadContinuationLinks(nextRaw, nextUrl).find(link => !seen.has(link));
            } catch (_) {
                nextUrl = '';
            }
        }
        result.content = pieces.join('\n\n');
        return result;
    }
    const picked = [];
    for (const chapter of chapters.slice(0, 4)) {
        try {
            const chapterRaw = await coReadFetchText(chapter.url, { timeoutMs: 12000, quiet: true });
            const chapterText = extractCoReadChapterText(chapterRaw, chapter.url);
            if (chapterText && chapterText.length > 260) {
                chapter.page = Math.max(0, Math.floor(picked.join('\n\n').length / COREAD_PAGE_SIZE));
                picked.push(`${chapter.title || title || '章节'}\n\n${chapterText}`);
            }
        } catch (_) {}
        if (picked.join('\n\n').length > 5200) break;
    }
    result.content = picked.join('\n\n') || (pageText.length > 500 ? pageText : '');
    return result;
}

async function resolveCoReadBookContent(bookId) {
    const id = String(bookId || '');
    if (!id) return;
    if (coreadResolvingBookIds.has(id)) return;
    let library = getCoReadLibrary();
    let book = library.find(item => item.id === id);
    if (!shouldResolveCoReadBookContent(book)) return;
    coreadResolvingBookIds.add(id);
    book.resolving = true;
    book.resolveStatus = isCoReadUsefulContent(book.content) ? '正在扩展正文' : '正在解析正文';
    saveCoReadLibrary(library);
    renderCoReadApp();
    try {
        const parsed = await extractCoReadReadableContent(book.url, book.title);
        const text = typeof parsed === 'string' ? parsed : String(parsed && parsed.content || '');
        library = getCoReadLibrary();
        book = library.find(item => item.id === id);
        if (!book) return;
        mergeCoReadMetadata(book, parsed && parsed.meta);
        book.resolveMetaVersion = COREAD_META_VERSION;
        if (parsed && Array.isArray(parsed.chapters)) {
            book.chapters = parsed.chapters.slice(0, 360);
        }
        book.resolveChapterVersion = COREAD_CHAPTER_VERSION;
        if (isCoReadUsefulContent(text)) {
            book.content = text.slice(0, 120000);
            book.description = book.description || text.slice(0, 240);
            book.resolveStatus = '正文已解析';
            book.resolveVersion = COREAD_RESOLVE_VERSION;
            delete book.resolveFailedAt;
            delete book.resolveAttempts;
        } else {
            book.resolveStatus = '未解析到正文，可导入 txt/md';
            book.resolveVersion = COREAD_RESOLVE_VERSION;
            if (!isCoReadUsefulContent(book.content)) {
                book.resolveFailedAt = Date.now();
                book.resolveAttempts = (Number(book.resolveAttempts) || 0) + 1;
            }
        }
        book.resolving = false;
        saveCoReadLibrary(library);
        if (!book.coverUrl) ensureCoReadBookCover(book.id);
    } catch (_) {
        library = getCoReadLibrary();
        book = library.find(item => item.id === id);
        if (book) {
            book.resolving = false;
            book.resolveStatus = '解析失败，可导入 txt/md';
            book.resolveVersion = COREAD_RESOLVE_VERSION;
            book.resolveMetaVersion = COREAD_META_VERSION;
            book.resolveChapterVersion = COREAD_CHAPTER_VERSION;
            book.resolveFailedAt = Date.now();
            book.resolveAttempts = (Number(book.resolveAttempts) || 0) + 1;
            saveCoReadLibrary(library);
        }
    } finally {
        coreadResolvingBookIds.delete(id);
    }
    renderCoReadApp();
}
window.resolveCoReadBookContent = resolveCoReadBookContent;

// 重新解析: the only path that clears a recorded parse failure.
function retryCoReadBookContent(bookId) {
    const id = String(bookId || '');
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === id);
    if (!book || !book.url || coreadResolvingBookIds.has(id)) return Promise.resolve();
    delete book.resolveFailedAt;
    book.resolveVersion = 0;
    book.resolveStatus = '等待重新解析正文';
    saveCoReadLibrary(library);
    return resolveCoReadBookContent(id);
}
window.retryCoReadBookContent = retryCoReadBookContent;

async function readCoReadFileAsBook(file) {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const asText = ['txt', 'md', 'markdown', 'json', 'csv'].includes(ext) || /^text\//i.test(file.type || '');
    const content = asText
        ? await file.text()
        : `已加入书架：${file.name}\n\n当前浏览器静态版只直接抽取 txt/md 正文。doc/docx/pdf 可以先加入书架记录来源；如需逐页共读，请转成 txt 后导入，或粘贴可访问的正文链接。`;
    const textFromJson = ext === 'json' ? extractCoReadTextFromJson(content) : '';
    return {
        title: file.name.replace(/\.[^.]+$/, ''),
        author: '',
        source: asText ? 'file' : ext || 'file',
        content: textFromJson || content,
        category: getCoReadActiveShelfCategoryName()
    };
}

async function importCoReadFiles(files, options = {}) {
    const picked = Array.from(files || []).filter(file => file && file.name && !/^\./.test(file.name));
    if (!picked.length) return;
    const library = getCoReadLibrary();
    const books = [];
    for (const file of picked.slice(0, 80)) {
        try {
            const book = await readCoReadFileAsBook(file);
            if (book) {
                books.push({
                    id: `book_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    title: String(book.title || '未命名书籍').slice(0, 120),
                    author: String(book.author || '').slice(0, 120),
                    source: String(book.source || 'file'),
                    url: '',
                    coverUrl: '',
                    rating: 0,
                    sourceData: null,
                    chapters: [],
                    content: String(book.content || ''),
                    description: '',
                    category: String(book.category || '').trim().slice(0, 28),
                    tags: options.smart ? ['智能导入'] : [],
                    resolving: false,
                    resolveStatus: '',
                    resolveVersion: COREAD_RESOLVE_VERSION,
                    resolveMetaVersion: COREAD_META_VERSION,
                    resolveChapterVersion: 0,
                    page: 0,
                    createdAt: Date.now()
                });
            }
        } catch (e) {
            console.warn('import coread file failed:', file.name, e);
        }
    }
    if (!books.length) {
        showCoReadShelfToast('没有读到可导入的文件');
        return;
    }
    saveCoReadLibrary([...books, ...library].slice(0, 80));
    coreadActiveBookId = books[0].id;
    coreadActiveTab = 'shelf';
    showCoReadShelfToast(`已导入 ${books.length} 本书`);
    renderCoReadApp();
}
window.importCoReadFiles = importCoReadFiles;

async function importCoReadFile(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    setCoReadShelfStatus('正在导入本机文件…');
    const book = await readCoReadFileAsBook(file);
    addCoReadBook(book);
    showCoReadShelfToast(`已导入《${book.title || '未命名书籍'}》`);
    input.value = '';
}
window.importCoReadFile = importCoReadFile;

async function addCoReadUrl() {
    const input = document.getElementById('coread-url-input');
    const url = String(input && input.value || '').trim();
    if (!url) return;
    if (isUnsupportedCoReadCloudShareUrl(url)) {
        showCoReadShelfToast('网盘分享页不能直接读取正文，请使用本地文件导入');
        return;
    }
    if (/\.json(?:\?|#|$)|booksource|shuyuan|booksources|legado/i.test(url)) {
        try {
            const count = await importCoReadSourcesFromUrl(url);
            if (input) input.value = '';
            setCoReadTab('discover');
            const panel = document.getElementById('coread-source-manager');
            if (panel) panel.classList.remove('hidden');
            setCoReadSourceStatus(count ? `已从链接导入 ${count} 个书源` : '链接已读取，但没有解析到书源');
            return;
        } catch (e) {
            setCoReadSourceStatus('链接不是可解析书源，按普通书籍链接加入书架');
        }
    }
    addCoReadBook({
        title: url.replace(/^https?:\/\//, '').slice(0, 80),
        source: 'url',
        url,
        content: ''
    });
    input.value = '';
}
window.addCoReadUrl = addCoReadUrl;

function buildCoReadSourceSearchRequest(source, query) {
    const raw = String(source.searchUrl || '').trim();
    if (!raw) return null;
    let path = raw;
    let options = {};
    const comma = raw.indexOf(',{');
    if (comma > 0) {
        path = raw.slice(0, comma);
        const escapedQuery = JSON.stringify(query).slice(1, -1);
        const optionText = raw.slice(comma + 1)
            .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, text) => JSON.stringify(text.replace(/\\'/g, "'")))
            .replace(/(:\s*)\{\{key\}\}/g, `$1${JSON.stringify(query)}`)
            .replace(/(:\s*)\{\{page\}\}/g, (_, prefix) => `${prefix}1`)
            .replace(/\{\{key\}\}/g, escapedQuery)
            .replace(/\{\{page\}\}/g, '1');
        try {
            options = JSON.parse(optionText);
        } catch (_) {
            options = {};
        }
    }
    path = path
        .replace(/\{\{key\}\}/g, encodeURIComponent(query))
        .replace(/\{\{page\}\}/g, '1');
    const url = /^https?:\/\//i.test(path)
        ? path
        : new URL(path || '/', source.bookSourceUrl).href;
    const method = String(options.method || options.Method || 'GET').toUpperCase();
    const body = options.body
        ? (typeof options.body === 'string'
            ? options.body.replace(/\{\{key\}\}/g, query)
            : JSON.stringify(options.body).replace(/\{\{key\}\}/g, query))
        : undefined;
    const headers = {
        ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
        'Content-Type': body && /^\s*[\[{]/.test(body) ? 'application/json' : 'application/x-www-form-urlencoded'
    };
    return {
        url,
        options: method === 'GET' ? {} : {
            method,
            headers,
            body
        }
    };
}

function applyCoReadLegadoReplace(value, rule) {
    let text = String(value == null ? '' : value).trim();
    const parts = String(rule || '').split('##');
    if (parts.length >= 3) {
        try {
            text = text.replace(new RegExp(parts[1], 'g'), parts[2].replace(/###$/g, ''));
        } catch (_) {}
    } else if (parts.length === 2) {
        try {
            text = text.replace(new RegExp(parts[1], 'g'), '');
        } catch (_) {}
    }
    return text.replace(/\s+/g, ' ').trim();
}

function readCoReadJsonPath(data, path) {
    let clean = String(path || '').split('##')[0].split('&&')[0].split('@')[0].trim();
    if (!clean) return data;
    if (clean.startsWith('$..')) {
        const key = clean.slice(3).replace(/\[\*\]$/g, '');
        const found = [];
        const walk = value => {
            if (!value || typeof value !== 'object') return;
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const item = value[key];
                if (Array.isArray(item)) found.push(...item);
                else found.push(item);
            }
            Object.values(value).forEach(walk);
        };
        walk(data);
        return found;
    }
    clean = clean
        .replace(/^\$\./, '')
        .replace(/^\$/, '')
        .replace(/\[(\d+)\]/g, '.$1')
        .replace(/\[\*\]/g, '.*');
    if (!clean) return data;
    return clean.split('.').filter(Boolean).reduce((value, key) => {
        if (Array.isArray(value)) {
            if (key === '*') return value.flatMap(item => Array.isArray(item) ? item : [item]);
            if (/^\d+$/.test(key)) return value[Number(key)] != null ? value[Number(key)] : '';
            return value.flatMap(item => item && item[key] != null ? item[key] : []);
        }
        if (key === '*') return value && typeof value === 'object' ? Object.values(value) : [];
        return value && value[key] != null ? value[key] : '';
    }, data);
}

function readCoReadJsonRule(item, rule, baseUrl = '') {
    if (!rule) return '';
    const parts = String(rule).split('||');
    for (const part of parts) {
        let text = String(part || '').trim();
        const readTemplate = path => {
            let clean = String(path || '').trim();
            clean = clean.replace(/^book\./, '$.');
            if (!clean.startsWith('$')) clean = `$.${clean}`;
            const value = readCoReadJsonPath(item, clean);
            return Array.isArray(value) ? value.join(' ') : String(value == null ? '' : value);
        };
        text = text
            .replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path) => readTemplate(path))
            .replace(/\{\s*(\$[.$][^}]+)\s*\}/g, (_, path) => readTemplate(path));
        let value = '';
        if (text.startsWith('$.') || text.startsWith('$..') || text === '$') {
            const raw = readCoReadJsonPath(item, text);
            value = Array.isArray(raw) ? raw.join(' ') : String(raw == null ? '' : raw);
        } else if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\]|\[\*\])*$/.test(text)) {
            const raw = readCoReadJsonPath(item, text);
            value = Array.isArray(raw) ? raw.join(' ') : String(raw == null ? '' : raw);
        } else {
            value = text;
        }
        value = applyCoReadLegadoReplace(value, part);
        if ((/^\/(?!\/)/.test(value) || value.startsWith('./') || value.startsWith('../')) && baseUrl) {
            try { value = new URL(value, baseUrl).href; } catch (_) {}
        }
        if (value) return value;
    }
    return '';
}

function parseCoReadRulePart(rule) {
    const clean = String(rule || '').split('##')[0].split('&&')[0].trim();
    const at = clean.lastIndexOf('@');
    if (at < 0) return { selector: clean, attr: 'text' };
    const attr = clean.slice(at + 1).trim() || 'text';
    const isAttr = /^(text|textNodes|ownText|html|href|src|data-original|_src|title|alt|content|value|all)$/i.test(attr);
    return isAttr
        ? { selector: clean.slice(0, at).trim(), attr }
        : { selector: clean, attr: 'text' };
}

function normalizeCoReadLegadoSelector(selector) {
    return String(selector || '').split('@').map(part => {
        let clean = part.trim();
        clean = clean.replace(/^tag\./, '');
        clean = clean.replace(/^id\.([^\s>+~.#:[\]]+)/, '#$1');
        clean = clean.replace(/^class\.([^\s>+~:[\]]+(?:\s+[^\s>+~:[\]]+)*)/, (_, names) => {
            return String(names || '').trim().split(/\s+/).filter(Boolean).map(name => `.${name}`).join('');
        });
        clean = clean.replace(/(^|[\s>+~])tag\./g, '$1');
        clean = clean.replace(/(^|[\s>+~])id\.([^\s>+~.#:[\]]+)/g, '$1#$2');
        clean = clean.replace(/(^|[\s>+~])class\.([^\s>+~.#:[\]]+)/g, '$1.$2');
        return clean;
    }).filter(Boolean).join(' ');
}

function selectCoReadRuleNodes(root, selector) {
    let clean = String(selector || '').trim();
    if (!clean) return [root];
    if (clean.includes('||')) {
        const seen = new Set();
        return clean.split('||').flatMap(part => selectCoReadRuleNodes(root, part)).filter(node => {
            if (!node || seen.has(node)) return false;
            seen.add(node);
            return true;
        });
    }
    if (clean.startsWith('-')) clean = clean.slice(1).trim();
    clean = normalizeCoReadLegadoSelector(clean);
    let index = null;
    clean = clean.replace(/\.(-?\d+)(?::[-\d]+)*$/g, (_, n) => {
        index = Number(n);
        return '';
    });
    let nodes = [];
    try {
        nodes = Array.from(root.querySelectorAll(clean || '*'));
    } catch (_) {
        nodes = [];
    }
    if (index != null) {
        const picked = index < 0 ? nodes[nodes.length + index] : nodes[index];
        return picked ? [picked] : [];
    }
    return nodes;
}

function readCoReadRule(root, rule, baseUrl = '') {
    if (!rule) return '';
    const parts = String(rule).split('||');
    for (const part of parts) {
        const { selector, attr } = parseCoReadRulePart(part);
        const nodes = selectCoReadRuleNodes(root, selector);
        const values = nodes.map(node => {
            if (!node) return '';
            if (attr === 'text' || attr === 'textNodes' || attr === 'ownText') return node.textContent || '';
            if (attr === 'html') return node.innerHTML || '';
            const value = node.getAttribute(attr) || '';
            if ((attr === 'href' || attr === 'src' || attr === 'data-original' || attr === '_src') && value && baseUrl) {
                try { return new URL(value, baseUrl).href; } catch (_) {}
            }
            return value;
        }).filter(Boolean);
        const value = applyCoReadLegadoReplace(values.join(' '), part);
        if (value) return value;
    }
    return '';
}

function parseCoReadSourceSearchHtml(html, source, query) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rule = source.ruleSearch || {};
    const listRule = rule.bookList || '';
    const roots = selectCoReadRuleNodes(doc, listRule).slice(0, 8);
    return roots.map(root => {
        const title = readCoReadRule(root, rule.name, source.bookSourceUrl);
        const bookUrl = readCoReadRule(root, rule.bookUrl, source.bookSourceUrl);
        if (!title && !bookUrl) return null;
        return {
            title: title || query,
            author: readCoReadRule(root, rule.author, source.bookSourceUrl),
            url: bookUrl,
            source: source.bookSourceName,
            sourceType: 'bookSource',
            description: readCoReadRule(root, rule.intro, source.bookSourceUrl),
            coverUrl: readCoReadRule(root, rule.coverUrl, source.bookSourceUrl),
            lastChapter: readCoReadRule(root, rule.lastChapter, source.bookSourceUrl),
            kind: readCoReadRule(root, rule.kind, source.bookSourceUrl),
            bookSourceUrl: source.bookSourceUrl
        };
    }).filter(Boolean);
}

function parseCoReadSourceSearchJson(text, source, query) {
    let data = null;
    try {
        data = JSON.parse(text.replace(/^\uFEFF/, ''));
    } catch (_) {
        return [];
    }
    const rule = source.ruleSearch || {};
    const listRule = String(rule.bookList || '');
    const candidates = listRule.split('||').map(part => readCoReadJsonPath(data, part)).filter(Boolean);
    const list = candidates.find(item => Array.isArray(item) && item.length) || (Array.isArray(data) ? data : []);
    return list.slice(0, 8).map(item => {
        const title = readCoReadJsonRule(item, rule.name, source.bookSourceUrl);
        const bookUrl = readCoReadJsonRule(item, rule.bookUrl, source.bookSourceUrl);
        if (!title && !bookUrl) return null;
        return {
            title: title || query,
            author: readCoReadJsonRule(item, rule.author, source.bookSourceUrl),
            url: bookUrl,
            source: source.bookSourceName,
            sourceType: 'bookSource',
            description: readCoReadJsonRule(item, rule.intro, source.bookSourceUrl),
            coverUrl: readCoReadJsonRule(item, rule.coverUrl, source.bookSourceUrl),
            lastChapter: readCoReadJsonRule(item, rule.lastChapter, source.bookSourceUrl),
            kind: readCoReadJsonRule(item, rule.kind, source.bookSourceUrl),
            bookSourceUrl: source.bookSourceUrl
        };
    }).filter(Boolean);
}

async function searchCoReadBookSources(query) {
    const sources = getCoReadSources()
        .filter(source => source && source.enabled !== false && source.ruleSearch && source.searchUrl)
        .sort((a, b) => {
            const aJson = /^\$|^[A-Za-z_$][\w$]*(?:\.|\[|$)/.test(String(a.ruleSearch?.bookList || '')) ? 0 : 1;
            const bJson = /^\$|^[A-Za-z_$][\w$]*(?:\.|\[|$)/.test(String(b.ruleSearch?.bookList || '')) ? 0 : 1;
            if (aJson !== bJson) return aJson - bJson;
            const aPost = /,\s*\{[\s\S]*method[\s\S]*POST/i.test(String(a.searchUrl || '')) ? 1 : 0;
            const bPost = /,\s*\{[\s\S]*method[\s\S]*POST/i.test(String(b.searchUrl || '')) ? 1 : 0;
            return aPost - bPost;
        })
        .slice(0, 18);
    if (!sources.length) return [];
    const results = [];
    for (let i = 0; i < sources.length && results.length < 12; i += 6) {
        const batch = sources.slice(i, i + 6);
        const settled = await Promise.allSettled(batch.map(async source => {
            try {
                const request = buildCoReadSourceSearchRequest(source, query);
                if (!request) return [];
                const html = await coReadFetchText(request.url, { ...(request.options || {}), timeoutMs: 4200, quiet: true });
                return /^\s*[\[{]/.test(html)
                    ? parseCoReadSourceSearchJson(html, source, query)
                    : parseCoReadSourceSearchHtml(html, source, query);
            } catch (e) {
                return [];
            }
        }));
        results.push(...settled.flatMap(item => item.status === 'fulfilled' && Array.isArray(item.value) ? item.value : []));
        if (results.length >= 4) break;
    }
    return results.slice(0, 12);
}

async function searchCoReadReadableWeb(query) {
    const rawQuery = String(query || '').trim();
    if (!rawQuery) return [];
    const url = `https://www.yodu.org/sa/all-${encodeURIComponent(rawQuery)}-1.html`;
    try {
        const raw = await coReadFetchText(`https://r.jina.ai/${url}`, { timeoutMs: 5200, quiet: true });
        if (!raw || !raw.includes(rawQuery)) return [];
        const startUrl = (raw.match(/开始阅读[\s\S]{0,180}?\]\((https?:\/\/www\.yodu\.org\/book\/[^)\s"]+)/) || [])[1]
            || (raw.match(/\]\((https?:\/\/www\.yodu\.org\/book\/\d+\/\d+\.html)[^)]*\)/) || [])[1];
        if (!startUrl) return [];
        const headings = Array.from(raw.matchAll(/^#\s+(.+)$/gm)).map(match => cleanCoReadReadableText(match[1]));
        const title = headings.find(item => item === rawQuery) || headings.find(item => item && !/全文在线阅读|有度中文网/.test(item)) || rawQuery;
        const author = cleanCoReadReadableText((raw.match(/\*\*\[([^\]]{1,80})\]\(https?:\/\/www\.yodu\.org\/authorarticle\//) || [])[1] || '');
        const coverUrl = (raw.match(/!\[[^\]]*?\]\((https?:\/\/www\.yodu\.org\/files\/article\/image\/[^)\s]+)/) || [])[1] || '';
        const bodyStart = raw.indexOf(author || title);
        const bodyEnd = raw.indexOf('开始阅读');
        const description = cleanCoReadReadableText(raw.slice(
            bodyStart >= 0 ? bodyStart : 0,
            bodyEnd > 0 ? bodyEnd : Math.min(raw.length, 6200)
        )).slice(0, 520);
        return [{
            title,
            author,
            url: startUrl,
            source: '有度中文网',
            sourceType: 'readableWeb',
            description,
            coverUrl,
            lastChapter: '从第一章开始',
            kind: '可解析正文'
        }];
    } catch (_) {
        return [];
    }
}

function parseCoReadZhenhunSearch(raw, query) {
    const rows = [];
    const seen = new Set();
    const add = (label, url, titleAttr = '') => {
        const cleanUrl = normalizeCoReadChapterUrl(url);
        if (!cleanUrl || !/zhenhunxiaoshuo\.com\/[^/?#]+\/?$/i.test(cleanUrl)) return;
        if (/\/(?:chunai|chunai\d+|yanqing|yanqing\d+|baihexiaoshuo|作者|chaxun|priest)\//i.test(cleanUrl)) return;
        const text = cleanCoReadReadableText(label || titleAttr || query).replace(/\s+/g, ' ').trim();
        if (!text || seen.has(cleanUrl)) return;
        seen.add(cleanUrl);
        const title = cleanCoReadBookTitle(titleAttr || text) || cleanCoReadBookTitle(text) || query;
        let author = '';
        const authorMatch = text.replace(title, '').match(/[\s　]+([^\s　]{2,12})$/);
        if (authorMatch && !/小说|全文|免费|阅读|镇魂/.test(authorMatch[1])) author = cleanCoReadBookAuthor(authorMatch[1]);
        rows.push({
            title,
            author,
            url: cleanUrl,
            source: '镇魂小说网',
            sourceType: 'readableWeb',
            description: text,
            coverUrl: '',
            lastChapter: '目录可解析',
            kind: '可解析正文'
        });
    };
    Array.from(String(raw || '').matchAll(/\[([^\]]{1,120})\]\((https?:\/\/www\.zhenhunxiaoshuo\.com\/[^)\s"]+)(?:\s+"([^"]+)")?\)/g))
        .forEach(match => add(match[1], match[2], match[3] || ''));
    Array.from(String(raw || '').matchAll(/<a\b[^>]*href=["'](https?:\/\/www\.zhenhunxiaoshuo\.com\/[^"']+)["'][^>]*>([\s\S]{1,180}?)<\/a>/gi))
        .forEach(match => add(match[2].replace(/<[^>]+>/g, ' '), match[1], ''));
    return rows.filter(item => {
        const haystack = `${item.title} ${item.author} ${item.description}`.toLowerCase();
        return haystack.includes(String(query || '').toLowerCase()) || rows.length <= 4;
    }).slice(0, 10);
}

function getCoReadZhenhunKnownResults(query) {
    const rawQuery = String(query || '').trim();
    if (!rawQuery) return [];
    const known = [
        { title: '魔道祖师', author: '墨香铜臭', slug: 'modaozushi' },
        { title: '天官赐福', author: '墨香铜臭', slug: 'tianguancifu' },
        { title: '人渣反派自救系统', author: '墨香铜臭', slug: 'renzhafanpaizijiuxitong' }
    ];
    return known.filter(book => `${book.title} ${book.author}`.includes(rawQuery) || rawQuery.includes(book.title) || rawQuery.includes(book.author))
        .map(book => ({
            title: book.title,
            author: book.author,
            url: `https://www.zhenhunxiaoshuo.com/${book.slug}/`,
            source: '镇魂小说网',
            sourceType: 'readableWeb',
            description: `${book.author}作品，目录可解析。`,
            coverUrl: '',
            lastChapter: '目录可解析',
            kind: '可解析正文'
        }));
}

async function searchCoReadZhenhun(query) {
    const rawQuery = String(query || '').trim();
    if (!rawQuery) return [];
    const knownResults = getCoReadZhenhunKnownResults(rawQuery);
    if (knownResults.length) return knownResults;
    const candidates = [
        { url: `https://www.zhenhunxiaoshuo.com/${encodeURIComponent(rawQuery)}/`, authorPage: true },
        { url: `https://www.zhenhunxiaoshuo.com/?s=${encodeURIComponent(rawQuery)}`, authorPage: false }
    ];
    for (const item of candidates) {
        const requestUrls = item.authorPage
            ? [
                item.url,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(item.url)}`,
                `https://corsproxy.io/?${encodeURIComponent(item.url)}`
            ]
            : [item.url];
        for (const requestUrl of requestUrls) {
            try {
                const raw = await coReadFetchText(requestUrl, { timeoutMs: 9000, quiet: true });
                const rows = parseCoReadZhenhunSearch(raw, rawQuery).map(book => ({
                    ...book,
                    author: book.author || (item.authorPage ? rawQuery : '')
                }));
                if (rows.length) return rows;
            } catch (_) {
                // Continue to the next search shape; the site treats author pages and keyword search differently.
            }
        }
    }
    return [];
}

async function searchCoReadBooks() {
    const input = document.getElementById('coread-search-input');
    const box = document.getElementById('coread-search-results');
    const query = String(input && input.value || '').trim();
    if (!query || !box) return;
    const runId = ++coreadSearchRunId;
    coreadSearchCache = [];
    box.innerHTML = renderCoReadSearchResults(query, '正在搜索书源和公开书目。');
    try {
        await loadCoReadBuiltinSources(false);
        const [sourceResults, readableWeb, zhenhun] = await Promise.all([
            coReadWithTimeout(searchCoReadBookSources(query), 7600, []),
            coReadWithTimeout(searchCoReadReadableWeb(query), 5600, []),
            coReadWithTimeout(searchCoReadZhenhun(query), 9200, [])
        ]);
        if (runId !== coreadSearchRunId) return;
        const google = sourceResults.length || readableWeb.length || zhenhun.length ? [] : await coReadWithTimeout(searchCoReadGoogleBooks(query), 3200, []);
        if (runId !== coreadSearchRunId) return;
        const openLibrary = sourceResults.length || readableWeb.length || zhenhun.length || google.length >= 4 ? [] : await coReadWithTimeout(searchCoReadOpenLibrary(query), 2600, []);
        if (runId !== coreadSearchRunId) return;
        const seen = new Set();
        coreadSearchCache = [...zhenhun, ...readableWeb, ...sourceResults, ...google, ...openLibrary].filter(item => {
            const key = `${String(item.title || '').toLowerCase()}|${String(item.author || '').toLowerCase()}`;
            if (!item.title || seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 12);
        box.innerHTML = renderCoReadSearchResults(query, coreadSearchCache.length ? '已从书城解析到结果，可直接加入书架。' : '暂未搜到匹配结果，可以在书架页粘贴书籍链接或导入本地文件。');
    } catch (e) {
        if (runId !== coreadSearchRunId) return;
        coreadSearchCache = [];
        box.innerHTML = renderCoReadSearchResults(query, '在线搜索失败，可以在书架页粘贴书籍链接或导入本地文件。');
    }
}
window.searchCoReadBooks = searchCoReadBooks;

async function searchCoReadGoogleBooks(query) {
    const terms = [
        `intitle:${query}`,
        query
    ];
    const all = [];
    for (const term of terms) {
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(term)}&langRestrict=zh&maxResults=8`;
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const data = await resp.json();
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach(item => {
            const info = item.volumeInfo || {};
            all.push({
                title: info.title || '',
                author: Array.isArray(info.authors) ? info.authors.slice(0, 2).join(' / ') : '',
                url: info.infoLink || item.selfLink || '',
                source: 'Google Books',
                coverUrl: normalizeCoReadCoverUrl(info.imageLinks && (info.imageLinks.extraLarge || info.imageLinks.large || info.imageLinks.medium || info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)),
                description: info.description || ''
            });
        });
        if (all.length) break;
    }
    return all;
}

async function searchCoReadOpenLibrary(query) {
    const resp = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`);
    if (!resp.ok) return [];
    const data = await resp.json();
    const docs = Array.isArray(data.docs) ? data.docs : [];
    return docs.map(doc => ({
        title: doc.title || '未命名书籍',
        author: Array.isArray(doc.author_name) ? doc.author_name.slice(0, 2).join(' / ') : '',
        url: doc.key ? `https://openlibrary.org${doc.key}` : 'https://openlibrary.org',
        source: 'Open Library',
        coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
        description: doc.first_sentence && Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : ''
    }));
}

function renderCoReadSearchResults(query, note = '') {
    const rows = coreadSearchCache.map((doc, index) => {
            const title = doc.title || '未命名书籍';
            const author = doc.author || '';
            return `
                <button type="button" onclick="addCoReadSearchResult(${index})">
                    <span>${musicEscapeHtml(title)}</span>
                    <em>${musicEscapeHtml([author, doc.source, doc.lastChapter].filter(Boolean).join(' · ') || '书名加入')}</em>
                </button>
            `;
    }).join('');
    const external = `
        <div class="coread-external-search">
            <span>${musicEscapeHtml(note || `正在从内置书城搜索「${query}」。`)}</span>
        </div>
    `;
    return rows + external;
}

function addCoReadSearchResult(index) {
    const item = coreadSearchCache[Math.max(0, Number(index || 0))];
    if (!item) return;
    addCoReadBook({
        title: item.title,
        author: item.author,
        source: item.source || 'search',
        url: item.url,
        description: item.description || `${item.source || '搜索'} 条目：${item.url}`,
        coverUrl: item.coverUrl || '',
        rating: 0,
        sourceData: item.sourceType === 'bookSource' ? {
            bookSourceName: item.source || '',
            bookSourceUrl: item.bookSourceUrl || '',
            bookUrl: item.url || '',
            lastChapter: item.lastChapter || '',
            kind: item.kind || ''
        } : null,
        content: `书名：${item.title}\n作者：${item.author || '未知'}\n来源：${item.source || '搜索'} ${item.url || ''}\n${item.lastChapter ? `最新章节：${item.lastChapter}\n` : ''}\n${item.kind ? `分类：${item.kind}\n` : ''}\n${item.description || '已从搜索结果加入书架。后续可以继续导入正文或章节解析。'}`
    });
}
window.addCoReadSearchResult = addCoReadSearchResult;

function openCoReadExternalSearch(source) {
    const query = String(document.getElementById('coread-search-input')?.value || getCoReadBook(coreadActiveBookId)?.title || getCoReadDailyRecommendation().title || '').trim();
    if (!query) return;
    const encoded = encodeURIComponent(query);
    const urls = {
        douban: `https://search.douban.com/book/subject_search?search_text=${encoded}`,
        weread: `https://weread.qq.com/web/search/books?keyword=${encoded}`,
        google: `https://books.google.com/books?q=${encoded}`
    };
    window.open(urls[source] || urls.google, '_blank', 'noopener');
}
window.openCoReadExternalSearch = openCoReadExternalSearch;

function turnCoReadPage(delta) {
    const settings = getCoReadReaderSettings();
    if (settings.pageMode === 'scroll' && coreadActiveTab === 'reader') {
        const body = document.getElementById('coread-reader-body');
        if (body) {
            body.scrollBy({
                top: Number(delta || 0) * Math.max(240, body.clientHeight * 0.86),
                behavior: 'auto'
            });
            return;
        }
    }
    const book = getCoReadBook(coreadActiveBookId);
    if (!book) return;
    const maxPage = Math.max(0, Math.ceil(String(book.content || '').length / COREAD_PAGE_SIZE) - 1);
    const nextPage = Math.max(0, Math.min(maxPage, Number(book.page || 0) + Number(delta || 0)));
    if (nextPage === Number(book.page || 0)) return;
    book.page = nextPage;
    saveCoReadBookPage(book.id, nextPage);
    renderCoReadReader();
    if (coreadTocOpen) renderCoReadToc();
}
window.turnCoReadPage = turnCoReadPage;

async function askCoReadComment() {
    syncCoReadPageFromScrollPosition();
    const book = getCoReadBook(coreadActiveBookId);
    const char = getCoReadCharacters().find(item => item.id === coreadActiveCharId);
    if (!book || !char || coreadBusy) return;
    coreadCommentPanelOpen = true;
    coreadCommentStatusText = '正在读这一段...';
    coreadBusy = true;
    renderCoReadApp();
    const anchor = { page: Math.max(0, Number(book.page || 0)), pageText: getCoReadRecentPageContextText(book) };
    try {
        const result = await requestCoReadAiComment(char, { ...book, page: anchor.page }, {}, { max_tokens: COREAD_AI_COMMENT_MAX_TOKENS, temperature: 0.84 });
        const text = result && result.ok ? result.text : '';
        if (text) {
            createCoReadThoughtRecord(book, char, text, anchor);
            coreadCommentStatusText = '';
            renderCoReadThoughts();
        } else {
            coreadCommentStatusText = (result && result.error) || 'char 没有回应。';
        }
    } catch (e) {
        coreadCommentStatusText = '生成失败，稍后再试。';
    } finally {
        coreadBusy = false;
        renderCoReadApp();
    }
}
window.askCoReadComment = askCoReadComment;

