function getCoReadBookProgress(book) {
    const contentLength = String(book && book.content || '').length;
    if (!contentLength) return Math.min(100, Math.max(0, Number(book && book.progress || 0)));
    const pageCount = Math.max(1, Math.ceil(contentLength / COREAD_PAGE_SIZE));
    return Math.round((Math.min(pageCount - 1, Number(book.page || 0)) + 1) / pageCount * 100);
}

function getCoReadPageCount(book) {
    const contentLength = String(book && book.content || '').length;
    return Math.max(1, Math.ceil(contentLength / COREAD_PAGE_SIZE));
}

function getCoReadChapterPage(chapter) {
    const raw = chapter && chapter.page;
    if (raw === null || raw === undefined || raw === '') return null;
    const page = Number(raw);
    return Number.isFinite(page) ? Math.max(0, page) : null;
}

function getCoReadChapters(book) {
    const content = String(book && book.content || '');
    const stored = Array.isArray(book && book.chapters) ? book.chapters : [];
    const chapters = stored
        .filter(chapter => chapter && chapter.title)
        .map((chapter, index) => ({
            title: cleanCoReadReadableText(chapter.title).replace(/\s+/g, ' ').slice(0, 72),
            url: chapter.url || '',
            page: getCoReadChapterPage(chapter),
            index
        }));
    const seen = new Set();
    const pattern = /(?:^|\n)([^\n]{0,28}第\s*[一二三四五六七八九十百千万零〇\d]+\s*[章节回卷][^\n]{0,56})/g;
    let match = null;
    while (content && (match = pattern.exec(content)) && chapters.length < 360) {
        const title = cleanCoReadReadableText(match[1]).replace(/\s+/g, ' ').slice(0, 72);
        if (!title || seen.has(title)) continue;
        seen.add(title);
        const page = Math.max(0, Math.floor(match.index / COREAD_PAGE_SIZE));
        const existing = chapters.find(chapter => chapter.title === title || chapter.title.includes(title) || title.includes(chapter.title));
        if (existing) existing.page = Number.isFinite(Number(existing.page)) ? Math.min(existing.page, page) : page;
        else chapters.push({ title, page, url: '', index: chapters.length });
    }
    if (!chapters.length) {
        const pageCount = getCoReadPageCount(book);
        return Array.from({ length: Math.min(pageCount, 80) }, (_, index) => ({
            title: `第 ${index + 1} 页`,
            page: index
        }));
    }
    return chapters;
}

function getCoReadCurrentChapter(book) {
    const page = Math.max(0, Number(book && book.page || 0));
    const chapters = getCoReadChapters(book);
    return [...chapters].reverse().find(chapter => {
        const chapterPage = getCoReadChapterPage(chapter);
        return chapterPage != null && chapterPage <= page;
    }) || chapters[0] || null;
}

function renderCoReadToc() {
    const drawer = document.getElementById('coread-toc-drawer');
    const bookBox = document.getElementById('coread-toc-book');
    const currentBox = document.getElementById('coread-toc-current');
    const listBox = document.getElementById('coread-toc-list');
    const book = getCoReadBook(coreadActiveBookId);
    syncCoReadTocDrawerState();
    if (!book) {
        if (bookBox) bookBox.innerHTML = '';
        if (currentBox) currentBox.innerHTML = '';
        if (listBox) listBox.innerHTML = '<div class="coread-empty">先选择一本书</div>';
        return;
    }
    const page = Math.max(0, Number(book.page || 0));
    const pageCount = getCoReadPageCount(book);
    const chapters = getCoReadChapters(book);
    const current = getCoReadCurrentChapter(book);
    if (bookBox) {
        bookBox.innerHTML = `
            <div class="coread-toc-cover">${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${musicEscapeHtml(String(book.title || '书').slice(0, 2))}</span>`}</div>
            <div>
                <strong>${musicEscapeHtml(book.title || '未命名书籍')}</strong>
                <em>${musicEscapeHtml(book.author || book.source || '未知作者')}</em>
            </div>
        `;
    }
    if (currentBox) {
        currentBox.innerHTML = `
            <span>正在阅读·${musicEscapeHtml(current ? current.title : `第 ${page + 1} 页`)}</span>
            <em>${page + 1}/${pageCount}</em>
        `;
    }
    if (listBox) {
        listBox.innerHTML = chapters.map((chapter, index) => {
            const active = current && chapter.title === current.title ? 'active' : '';
            const chapterPage = getCoReadChapterPage(chapter);
            const done = chapterPage != null && chapterPage < page ? ' done' : '';
            return `
                <button type="button" class="${active}${done}" onclick="jumpCoReadChapter(${index})">
                    <span>${musicEscapeHtml(chapter.title)}</span>
                    <i class="ri-checkbox-circle-fill"></i>
                </button>
            `;
        }).join('') || '<div class="coread-empty">还没有目录</div>';
    }
}

function syncCoReadTocDrawerState() {
    const drawer = document.getElementById('coread-toc-drawer');
    if (!drawer) return;
    drawer.classList.toggle('open', coreadTocOpen);
    drawer.setAttribute('aria-hidden', coreadTocOpen ? 'false' : 'true');
}

function toggleCoReadToc(open) {
    const wasSettingsOpen = coreadSettingsOpen;
    coreadTocOpen = typeof open === 'boolean' ? open : !coreadTocOpen;
    if (coreadTocOpen) {
        coreadSettingsOpen = false;
        coreadCommentPanelOpen = false;
        renderCoReadCommentPanel();
    }
    if (wasSettingsOpen && !coreadSettingsOpen) syncCoReadSettingsDrawerState();
    if (coreadTocOpen) renderCoReadToc();
    else syncCoReadTocDrawerState();
}
window.toggleCoReadToc = toggleCoReadToc;

async function jumpCoReadChapter(index) {
    const library = getCoReadLibrary();
    const book = library.find(item => item.id === coreadActiveBookId);
    if (!book) return;
    const chapter = getCoReadChapters(book)[Number(index || 0)];
    if (!chapter) return;
    let targetPage = getCoReadChapterPage(chapter);
    if (targetPage == null && chapter.url) {
        book.resolving = true;
        book.resolveStatus = `正在加载${chapter.title || '章节'}`;
        saveCoReadLibrary(library);
        renderCoReadApp();
        try {
            const chapterUrl = normalizeCoReadChapterUrl(chapter.url);
            const raw = await coReadFetchText(chapterUrl, { timeoutMs: 20000, quiet: true });
            const text = extractCoReadChapterText(raw, chapterUrl);
            const latest = getCoReadLibrary();
            const target = latest.find(item => item.id === coreadActiveBookId);
            if (!target) return;
            if (isCoReadUsefulContent(text)) {
                const prefix = target.content ? '\n\n' : '';
                targetPage = Math.max(0, Math.floor((String(target.content || '').length + prefix.length) / COREAD_PAGE_SIZE));
                target.content = `${target.content || ''}${prefix}${chapter.title || '章节'}\n\n${text}`.slice(0, 120000);
                const chapterIndex = Number.isFinite(Number(chapter.index)) ? Number(chapter.index) : Number(index || 0);
                if (Array.isArray(target.chapters) && target.chapters[chapterIndex]) {
                    target.chapters[chapterIndex].page = targetPage;
                }
                target.resolveStatus = '章节已加载';
            } else {
                target.resolveStatus = '这一章暂时加载失败';
            }
            target.resolving = false;
            target.page = targetPage == null ? Number(target.page || 0) : Math.max(0, Math.min(getCoReadPageCount(target) - 1, targetPage));
            saveCoReadLibrary(latest);
            coreadTocOpen = false;
            coreadReaderPanelOpen = false;
            renderCoReadApp();
            return;
        } catch (_) {
            const latest = getCoReadLibrary();
            const target = latest.find(item => item.id === coreadActiveBookId);
            if (target) {
                target.resolving = false;
                target.resolveStatus = '这一章暂时加载失败';
                saveCoReadLibrary(latest);
            }
            renderCoReadApp();
            return;
        }
    }
    book.page = Math.max(0, Math.min(getCoReadPageCount(book) - 1, Number(targetPage || 0)));
    saveCoReadLibrary(library);
    coreadTocOpen = false;
    coreadReaderPanelOpen = false;
    renderCoReadApp();
}
window.jumpCoReadChapter = jumpCoReadChapter;

function getCoReadBookReadChars(book) {
    const contentLength = String(book && book.content || '').length;
    if (!contentLength) return 0;
    const page = Math.max(0, Number(book && book.page || 0));
    return Math.max(0, Math.min(contentLength, (page + 1) * COREAD_PAGE_SIZE));
}

function formatCoReadStatNumber(value, unit = '') {
    const num = Math.max(0, Number(value || 0));
    if (unit === '字') {
        if (num >= 10000) return `${(num / 10000).toFixed(num >= 100000 ? 1 : 2).replace(/\.0$/, '')} 万字`;
        return `${Math.round(num)} 字`;
    }
    if (unit === '分钟') return `${Math.round(num)} 分钟`;
    if (unit === '天') return `${Math.round(num)} 天`;
    if (unit === '本') return `${Math.round(num)} 本`;
    if (unit === '条') return `${Math.round(num)} 条`;
    return String(Math.round(num));
}

function formatCoReadStatMinutes(minutes) {
    const total = Math.max(0, Math.round(Number(minutes || 0)));
    if (total >= 60) {
        const hours = Math.floor(total / 60);
        const rest = total % 60;
        return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
    }
    return `${total} 分钟`;
}

function getCoReadPeriodRange(range = coreadStatsRange, offset = coreadStatsOffset) {
    const now = new Date();
    const safeRange = ['day', 'week', 'month', 'year', 'total'].includes(range) ? range : 'day';
    if (safeRange === 'total') {
        return { id: safeRange, start: 0, end: Infinity, label: '全部' };
    }
    if (safeRange === 'day') {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
        return { id: safeRange, start: start.getTime(), end: end.getTime(), label: `${start.getMonth() + 1}月${start.getDate()}日` };
    }
    if (safeRange === 'week') {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset * 7);
        const day = date.getDay() || 7;
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day + 1);
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
        return { id: safeRange, start: start.getTime(), end: end.getTime(), label: `${start.getMonth() + 1}.${start.getDate()} - ${new Date(end.getTime() - 1).getMonth() + 1}.${new Date(end.getTime() - 1).getDate()}` };
    }
    if (safeRange === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        return { id: safeRange, start: start.getTime(), end: end.getTime(), label: `${start.getFullYear()}年${start.getMonth() + 1}月` };
    }
    const start = new Date(now.getFullYear() + offset, 0, 1);
    const end = new Date(start.getFullYear() + 1, 0, 1);
    return { id: safeRange, start: start.getTime(), end: end.getTime(), label: `${start.getFullYear()}年` };
}

function getCoReadBookActivityTime(book) {
    return Number(book && (book.updatedAt || book.lastReadAt || book.createdAt) || 0);
}

function getCoReadStatsBooks(library, rangeInfo) {
    if (!rangeInfo || rangeInfo.id === 'total') return Array.isArray(library) ? library : [];
    return (Array.isArray(library) ? library : []).filter(book => {
        const ts = getCoReadBookActivityTime(book);
        return ts >= rangeInfo.start && ts < rangeInfo.end;
    });
}

function buildCoReadStatsModel(library = getCoReadLibrary()) {
    const range = getCoReadPeriodRange();
    const scopedBooks = getCoReadStatsBooks(library, range);
    const sourceBooks = range.id === 'total' ? library : scopedBooks;
    const readChars = sourceBooks.reduce((sum, book) => sum + getCoReadBookReadChars(book), 0);
    const estimatedMinutes = Math.ceil(readChars / 423);
    const readDays = new Set(sourceBooks.map(book => {
        const ts = getCoReadBookActivityTime(book);
        return ts ? new Date(ts).toDateString() : '';
    }).filter(Boolean)).size;
    const finished = sourceBooks.filter(book => getCoReadBookProgress(book) >= 100 || book.finishedAt).length;
    const reading = sourceBooks.filter(book => getCoReadBookProgress(book) > 0 && getCoReadBookProgress(book) < 100).length;
    const noteCount = getCoReadThoughts(1000).filter(item => {
        if (range.id === 'total') return true;
        const ts = Number(item.createdAt || 0);
        return ts >= range.start && ts < range.end;
    }).length;
    const ranking = [...sourceBooks]
        .map(book => {
            const chars = getCoReadBookReadChars(book);
            return {
                book,
                chars,
                minutes: Math.max(1, Math.ceil(chars / 423))
            };
        })
        .filter(item => item.chars > 0)
        .sort((a, b) => b.minutes - a.minutes || b.chars - a.chars)
        .slice(0, 5);
    return {
        range,
        totalBooks: sourceBooks.length,
        finished,
        reading,
        noteCount,
        readChars,
        estimatedMinutes,
        readDays,
        speed: estimatedMinutes ? Math.round(readChars / estimatedMinutes) : 0,
        ranking
    };
}

function setCoReadStatsRange(range) {
    const next = ['day', 'week', 'month', 'year', 'total'].includes(range) ? range : 'day';
    if (coreadStatsRange !== next) {
        coreadStatsRange = next;
        coreadStatsOffset = 0;
    }
    renderCoReadStatsMount();
}
window.setCoReadStatsRange = setCoReadStatsRange;

function shiftCoReadStatsPeriod(delta) {
    if (coreadStatsRange !== 'total') coreadStatsOffset += Number(delta || 0);
    renderCoReadStatsMount();
}
window.shiftCoReadStatsPeriod = shiftCoReadStatsPeriod;

function renderCoReadStatsMount(library = getCoReadLibrary()) {
    const target = document.getElementById('coread-me-reading-stats');
    if (target) target.innerHTML = renderCoReadStatsPanel(library);
}

function renderCoReadStatsPanel(library = getCoReadLibrary()) {
    const model = buildCoReadStatsModel(library);
    const tabs = [
        { id: 'day', label: '日' },
        { id: 'week', label: '周' },
        { id: 'month', label: '月' },
        { id: 'year', label: '年' },
        { id: 'total', label: '总' }
    ];
    const stats = [
        { icon: 'ri-alarm-line', value: formatCoReadStatMinutes(model.estimatedMinutes), label: '阅读时间' },
        { icon: 'ri-calendar-line', value: formatCoReadStatNumber(model.readDays, '天'), label: '阅读天数' },
        { icon: 'ri-book-2-line', value: formatCoReadStatNumber(model.totalBooks, '本'), label: '累计读过' },
        { icon: 'ri-checkbox-circle-line', value: formatCoReadStatNumber(model.finished, '本'), label: '读完书籍' },
        { icon: 'ri-book-open-line', value: formatCoReadStatNumber(model.reading, '本'), label: '在读书籍' },
        { icon: 'ri-quill-pen-line', value: formatCoReadStatNumber(model.noteCount, '条'), label: '记录笔记' },
        { icon: 'ri-menu-2-line', value: formatCoReadStatNumber(model.readChars, '字'), label: '阅读字数' },
        { icon: 'ri-speed-up-line', value: model.speed ? `${model.speed} 字/分钟` : '暂无', label: '阅读速度' }
    ];
    return `
        <section class="coread-stats-board">
            <div class="coread-stats-title">
                <strong>阅读统计</strong>
                <span>Reading Stats</span>
            </div>
            <div class="coread-stats-tabs">
                ${tabs.map(tab => `
                    <button type="button" class="${coreadStatsRange === tab.id ? 'active' : ''}" onclick="setCoReadStatsRange('${tab.id}')">${tab.label}</button>
                `).join('')}
            </div>
            <div class="coread-stats-date">
                <button type="button" onclick="shiftCoReadStatsPeriod(-1)" aria-label="上一段"><i class="ri-arrow-left-s-line"></i></button>
                <strong>${musicEscapeHtml(model.range.label)}</strong>
                <button type="button" onclick="shiftCoReadStatsPeriod(1)" aria-label="下一段"><i class="ri-arrow-right-s-line"></i></button>
            </div>
            <div class="coread-stats-metrics">
                ${stats.map(item => `
                    <div>
                        <strong>${musicEscapeHtml(item.value)}</strong>
                        <span><i class="${item.icon}"></i>${musicEscapeHtml(item.label)}</span>
                    </div>
                `).join('')}
            </div>
            <section class="coread-stats-rank">
                <h3>阅读时长排行榜 <i class="ri-arrow-right-s-line"></i></h3>
                ${model.ranking.map((item, index) => `
                    <button type="button" onclick="selectCoReadBook('${musicEscapeAttr(item.book.id)}')">
                        <b>${index + 1}</b>
                        <span class="coread-stats-rank-cover">${item.book.coverUrl ? `<img src="${musicEscapeAttr(item.book.coverUrl)}" onerror="this.remove()">` : `<em>${musicEscapeHtml(String(item.book.title || '书').slice(0, 1))}</em>`}</span>
                        <span class="coread-stats-rank-copy">
                            <strong>${formatCoReadStatMinutes(item.minutes)}</strong>
                            <em>${musicEscapeHtml(item.book.title || '未命名书籍')}</em>
                            <small>累计阅读：${musicEscapeHtml(formatCoReadStatNumber(item.chars, '字'))}</small>
                        </span>
                    </button>
                `).join('') || '<div class="coread-stats-empty">当前周期还没有阅读记录。</div>'}
            </section>
        </section>
    `;
}

