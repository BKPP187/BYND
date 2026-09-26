function bindCoReadReaderTapZones(body) {
    if (!body || body.dataset.coreadTapBound === '1') return;
    body.dataset.coreadTapBound = '1';
    body.setAttribute('tabindex', '0');
    body.addEventListener('pointerdown', handleCoReadReaderPointerDown);
    body.addEventListener('pointerup', handleCoReadReaderPointerUp);
    body.addEventListener('pointercancel', () => { coreadReaderTapState = null; });
    body.addEventListener('click', handleCoReadReaderClick);
    body.addEventListener('keydown', handleCoReadReaderKeydown);
}

function handleCoReadReaderPointerDown(event) {
    if (coreadActiveTab !== 'reader' || coreadTocOpen || coreadSettingsOpen) {
        coreadReaderTapState = null;
        return;
    }
    if (event.button != null && event.button !== 0) return;
    const body = event.currentTarget;
    coreadReaderTapState = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scrollTop: body ? body.scrollTop : 0
    };
}

function handleCoReadReaderPointerUp(event) {
    const state = coreadReaderTapState;
    coreadReaderTapState = null;
    if (!state || state.pointerId !== event.pointerId) return;
    if (coreadActiveTab !== 'reader' || coreadTocOpen || coreadSettingsOpen) return;
    if (event.button != null && event.button !== 0) return;
    const body = event.currentTarget;
    if (!body) return;
    const rect = body.getBoundingClientRect();
    const moved = Math.abs(event.clientX - state.x) > 12
        || Math.abs(event.clientY - state.y) > 12
        || Math.abs(body.scrollTop - state.scrollTop) > 6;
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (moved || !inside) return;
    coreadReaderTapHandledAt = Date.now();
    turnCoReadPage(event.clientX >= rect.left + rect.width / 2 ? 1 : -1);
}

function handleCoReadReaderClick(event) {
    if (Date.now() - coreadReaderTapHandledAt < 350) return;
    if (coreadActiveTab !== 'reader' || coreadTocOpen || coreadSettingsOpen) return;
    const body = event.currentTarget;
    if (!body) return;
    const rect = body.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) return;
    coreadReaderTapHandledAt = Date.now();
    turnCoReadPage(event.clientX >= rect.left + rect.width / 2 ? 1 : -1);
}

function handleCoReadReaderKeydown(event) {
    if (coreadActiveTab !== 'reader' || coreadTocOpen || coreadSettingsOpen) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        turnCoReadPage(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        turnCoReadPage(-1);
    }
}

function getCoReadPageFromScrollPosition(body, book) {
    if (!body || !book) return 0;
    const maxPage = Math.max(0, getCoReadPageCount(book) - 1);
    const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
    if (!maxPage || !maxScroll) return 0;
    return Math.max(0, Math.min(maxPage, Math.round((body.scrollTop / maxScroll) * maxPage)));
}

function getCoReadScrollTopForPage(body, book, page) {
    if (!body || !book) return 0;
    const maxPage = Math.max(0, getCoReadPageCount(book) - 1);
    const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
    if (!maxPage || !maxScroll) return 0;
    const safePage = Math.max(0, Math.min(maxPage, Number(page || 0)));
    return Math.round((safePage / maxPage) * maxScroll);
}

function scrollCoReadBodyToPage(body, book, page) {
    if (!body || !book) return;
    const previousBehavior = body.style.scrollBehavior;
    body.style.scrollBehavior = 'auto';
    const apply = () => {
        body.scrollTop = getCoReadScrollTopForPage(body, book, page);
    };
    apply();
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
            apply();
            body.style.scrollBehavior = previousBehavior;
        });
    } else {
        body.style.scrollBehavior = previousBehavior;
    }
}

function formatCoReadByteSize(bytes) {
    const value = Math.max(0, Number(bytes || 0));
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(value >= 100 * 1024 ? 0 : 1)} KB`;
    return `${value || 0} B`;
}

function getCoReadBookByteSize(book) {
    const explicit = Number(book && (book.fileSize || book.size || book.bytes));
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const text = String(book && (book.content || book.description) || '');
    if (typeof Blob === 'function') return new Blob([text]).size;
    return text.length * 2;
}

function formatCoReadDurationFromChars(count) {
    const minutes = Math.max(1, Math.ceil(Math.max(0, Number(count || 0)) / 520));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours && rest) return `${hours} 小时 ${rest} 分钟`;
    if (hours) return `${hours} 小时`;
    return `${rest} 分钟`;
}

function getCoReadReaderNotes(book) {
    if (!book || !Array.isArray(book.thoughts)) return [];
    return book.thoughts.map(item => {
        const char = getCoReadCharacterById(item.charId);
        return {
            ...item,
            charName: item.charName || getCoReadCharName(char) || 'char',
            charAvatar: item.charAvatar || (char && char.avatar) || DEFAULT_AVATAR,
            replies: Array.isArray(item.replies) ? item.replies : []
        };
    }).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function getCoReadBookmarks(book) {
    return (Array.isArray(book && book.bookmarks) ? book.bookmarks : [])
        .map(item => ({
            ...item,
            page: Math.max(0, Number(item && item.page || 0)),
            createdAt: Number(item && item.createdAt || 0)
        }))
        .sort((a, b) => a.page - b.page || b.createdAt - a.createdAt);
}

function isCurrentCoReadPageBookmarked(book) {
    const page = Math.max(0, Number(book && book.page || 0));
    return getCoReadBookmarks(book).some(item => item.page === page);
}

function toggleCurrentCoReadBookmark() {
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === coreadActiveBookId);
    if (!book) return false;
    const page = Math.max(0, Number(book.page || 0));
    const bookmarks = getCoReadBookmarks(book);
    const exists = bookmarks.some(item => item.page === page);
    book.bookmarks = exists
        ? bookmarks.filter(item => item.page !== page)
        : [{
            id: `bookmark_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            page,
            title: getCoReadCurrentChapter(book)?.title || `第 ${page + 1} 页`,
            excerpt: getCoReadPageText(book).replace(/\s+/g, ' ').slice(0, 80),
            createdAt: Date.now()
        }, ...bookmarks].slice(0, 120);
    saveCoReadLibrary(library);
    renderCoReadReader();
    return false;
}
window.toggleCurrentCoReadBookmark = toggleCurrentCoReadBookmark;

function jumpCoReadBookmark(page) {
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === coreadActiveBookId);
    if (!book) return;
    book.page = Math.max(0, Math.min(getCoReadPageCount(book) - 1, Number(page || 0)));
    saveCoReadLibrary(library);
    coreadReaderPendingScrollPage = book.page;
    coreadReaderPanelOpen = false;
    renderCoReadReader();
}
window.jumpCoReadBookmark = jumpCoReadBookmark;

function setCoReadReaderPanelTab(tab) {
    const next = ['chapters', 'notes', 'bookmarks'].includes(tab) ? tab : 'chapters';
    if (coreadReaderPanelOpen && coreadReaderPanelTab === next) {
        coreadReaderPanelOpen = false;
        renderCoReadReaderOverview();
        updateCoReadTopbar();
        return;
    }
    coreadReaderPanelTab = next;
    coreadReaderPanelOpen = true;
    if (next !== 'chapters') {
        coreadReaderChapterGroupIndex = -1;
        coreadReaderChapterGroupPickerOpen = false;
    }
    renderCoReadReaderOverview();
    updateCoReadTopbar();
}
window.setCoReadReaderPanelTab = setCoReadReaderPanelTab;

function closeCoReadReaderPanel() {
    coreadReaderPanelOpen = false;
    coreadReaderChapterGroupIndex = -1;
    coreadReaderChapterGroupPickerOpen = false;
    renderCoReadReaderOverview();
    updateCoReadTopbar();
}
window.closeCoReadReaderPanel = closeCoReadReaderPanel;

function toggleCoReadReaderChapterGroup() {
    coreadReaderChapterGroupPickerOpen = !coreadReaderChapterGroupPickerOpen;
    renderCoReadReaderOverview();
}
window.toggleCoReadReaderChapterGroup = toggleCoReadReaderChapterGroup;

function selectCoReadReaderChapterGroup(index) {
    const next = Math.max(0, Number(index) || 0);
    coreadReaderChapterGroupIndex = next;
    coreadReaderChapterGroupPickerOpen = false;
    renderCoReadReaderOverview();
}
window.selectCoReadReaderChapterGroup = selectCoReadReaderChapterGroup;

function runCoReadReaderToolAction(action) {
    const tool = String(action || '');
    if (tool === 'chapters' || tool === 'notes' || tool === 'bookmarks') {
        setCoReadReaderPanelTab(tool);
        return;
    }
    if (tool === 'mode') {
        setCoReadPageMode(getCoReadReaderSettings().pageMode === 'scroll' ? 'paged' : 'scroll');
    }
}

function handleCoReadReaderToolPointer(action, event) {
    coreadReaderToolPointerAt = Date.now();
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
    runCoReadReaderToolAction(action);
    return false;
}
window.handleCoReadReaderToolPointer = handleCoReadReaderToolPointer;

function handleCoReadReaderToolClick(action, event) {
    if (Date.now() - coreadReaderToolPointerAt < 600) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
        return false;
    }
    runCoReadReaderToolAction(action);
    return false;
}
window.handleCoReadReaderToolClick = handleCoReadReaderToolClick;

function renderCoReadReaderChapterRows(book, limit = 48, startIndex = 0) {
    const chapters = getCoReadChapters(book);
    const page = Math.max(0, Number(book && book.page || 0));
    const current = getCoReadCurrentChapter(book);
    const from = Math.max(0, Math.min(Number(startIndex) || 0, Math.max(0, chapters.length - 1)));
    return chapters.slice(from, from + limit).map((chapter, offset) => {
        const index = from + offset;
        const chapterPage = getCoReadChapterPage(chapter);
        const active = current && chapter.title === current.title ? ' active' : '';
        const done = chapterPage != null && chapterPage < page ? ' done' : '';
        const chapterTitle = chapter.title || `第 ${index + 1} 页`;
        return `
            <button type="button" class="coread-reader-row${active}${done}" onclick="jumpCoReadChapter(${index})">
                <span><b>${index + 1}</b>${musicEscapeHtml(chapterTitle)}</span>
                <em>${chapterPage == null ? '加载' : Math.max(1, chapterPage + 1)}</em>
                <i class="ri-checkbox-circle-fill" aria-hidden="true"></i>
            </button>
        `;
    }).join('') || '<div class="coread-reader-panel-empty">还没有目录</div>';
}

function renderCoReadReaderNoteRows(book) {
    const notes = getCoReadReaderNotes(book);
    return notes.slice(0, 30).map(note => {
        const replies = (Array.isArray(note.replies) ? note.replies : []).slice(-2);
        return `
            <article class="coread-reader-note">
                <header>
                    <img src="${musicEscapeAttr(note.charAvatar || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                    <div>
                        <strong>${musicEscapeHtml(note.charName || 'char')}</strong>
                        <span>第 ${Math.max(1, Number(note.page || 0) + 1)} 页 · ${replies.length ? `${replies.length} 条最近回复` : 'char 旁注'}</span>
                    </div>
                </header>
                <p>${musicEscapeHtml(note.text || '')}</p>
                ${replies.map(reply => `
                    <div class="coread-reader-reply ${reply.role === 'user' ? 'is-user' : 'is-char'}">
                        <b>${reply.role === 'user' ? 'user' : musicEscapeHtml(note.charName || 'char')}</b>
                        <span>${musicEscapeHtml(reply.text || '')}</span>
                    </div>
                `).join('')}
            </article>
        `;
    }).join('') || `
        <div class="coread-reader-panel-empty">
            <span>这本书还没有笔记。</span>
            <button type="button" onclick="openCoReadCommentPanel()">让 char 读当前页</button>
        </div>
    `;
}

function renderCoReadReaderBookmarkRows(book) {
    const bookmarks = getCoReadBookmarks(book);
    const marked = isCurrentCoReadPageBookmarked(book);
    const action = `
        <button type="button" class="coread-reader-bookmark-action ${marked ? 'active' : ''}" onclick="toggleCurrentCoReadBookmark()">
            <i class="${marked ? 'ri-bookmark-3-fill' : 'ri-bookmark-3-line'}"></i>
            <span>${marked ? '移除当前页书签' : '收藏当前页'}</span>
        </button>
    `;
    const rows = bookmarks.map(item => `
        <button type="button" class="coread-reader-row" onclick="jumpCoReadBookmark(${Number(item.page || 0)})">
            <span>${musicEscapeHtml(item.title || `第 ${Number(item.page || 0) + 1} 页`)}</span>
            <em>${Number(item.page || 0) + 1}</em>
            ${item.excerpt ? `<small>${musicEscapeHtml(item.excerpt)}</small>` : ''}
        </button>
    `).join('');
    return `${action}${rows || '<div class="coread-reader-panel-empty">还没有书签，先收藏当前页。</div>'}`;
}

function renderCoReadReaderOverview() {
    const box = document.getElementById('coread-reader-overview');
    if (!box) return;
    const shell = document.querySelector('.coread-shell');
    if (shell) shell.classList.toggle('coread-reader-panel-open', !!coreadReaderPanelOpen);
    const book = getCoReadBook(coreadActiveBookId);
    box.classList.toggle('open', !!coreadReaderPanelOpen);
    if (!coreadReaderPanelOpen) {
        delete box.dataset.readerPanelTab;
        box.innerHTML = '';
        return;
    }
    if (!book) {
        box.innerHTML = `
            <div class="coread-reader-empty-card">
                <strong>Pick a book</strong>
                <span>导入一本书，再选择 Reading Soulmate 开始共读。</span>
            </div>
        `;
        return;
    }
    box.dataset.readerPanelTab = coreadReaderPanelTab;
    const contentLength = String(book.content || book.description || '').length;
    const pageCount = getCoReadPageCount(book);
    const currentPage = Math.max(0, Number(book.page || 0));
    const notes = getCoReadReaderNotes(book);
    const bookmarks = getCoReadBookmarks(book);
    const chapters = getCoReadChapters(book);
    const currentChapter = getCoReadCurrentChapter(book);
    const currentChapterIndex = Math.max(0, chapters.findIndex(chapter => currentChapter && chapter.title === currentChapter.title));
    const chapterGroupSize = 30;
    const chapterGroupCount = Math.max(1, Math.ceil(Math.max(1, chapters.length) / chapterGroupSize));
    const currentGroupIndex = Math.max(0, Math.min(chapterGroupCount - 1, Math.floor(currentChapterIndex / chapterGroupSize)));
    const activeGroupIndex = Math.max(0, Math.min(chapterGroupCount - 1, coreadReaderChapterGroupIndex >= 0 ? coreadReaderChapterGroupIndex : currentGroupIndex));
    if (coreadReaderChapterGroupIndex < 0) coreadReaderChapterGroupIndex = activeGroupIndex;
    const chapterGroupStart = activeGroupIndex * chapterGroupSize + 1;
    const chapterGroupEnd = Math.min(chapters.length || chapterGroupStart, chapterGroupStart + chapterGroupSize - 1);
    const tabs = [
        { id: 'chapters', label: '章节', count: chapters.length },
        { id: 'notes', label: '笔记', count: notes.length },
        { id: 'bookmarks', label: '书签', count: bookmarks.length }
    ];
    const panel = coreadReaderPanelTab === 'notes'
        ? renderCoReadReaderNoteRows(book)
        : coreadReaderPanelTab === 'bookmarks'
            ? renderCoReadReaderBookmarkRows(book)
            : renderCoReadReaderChapterRows(book, chapterGroupSize, chapterGroupStart - 1);
    const chapterGroups = Array.from({ length: chapterGroupCount }, (_, index) => {
        const start = index * chapterGroupSize + 1;
        const end = Math.min(chapters.length || start, start + chapterGroupSize - 1);
        return { index, start, end };
    });
    const chapterGroupPicker = coreadReaderPanelTab === 'chapters' && coreadReaderChapterGroupPickerOpen && chapterGroups.length > 1 ? `
        <div class="coread-reader-drawer-groups">
            ${chapterGroups.map(group => `
                <button type="button" class="${group.index === activeGroupIndex ? 'active' : ''}" onclick="selectCoReadReaderChapterGroup(${group.index})">
                    第${group.start}-${group.end}章
                </button>
            `).join('')}
        </div>
    ` : '';
    const chapterDrawerHeader = coreadReaderPanelTab === 'chapters' ? `
        <div class="coread-reader-drawer-head">
            <div class="coread-reader-drawer-cover">${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${musicEscapeHtml(String(book.title || '书').slice(0, 1))}</span>`}</div>
            <div class="coread-reader-drawer-meta">
                <strong>${musicEscapeHtml(book.title || '未命名书籍')}</strong>
                <span>${musicEscapeHtml(book.author || book.source || '未知作者')}</span>
            </div>
        </div>
        <div class="coread-reader-drawer-status">
            <span>正在阅读·${currentChapterIndex + 1}${musicEscapeHtml(currentChapter ? currentChapter.title : `第 ${currentPage + 1} 页`)}（第${Math.min(pageCount, currentPage + 1)}页）</span>
            <button type="button" onclick="closeCoReadReaderPanel()" aria-label="关闭章节目录"><i class="ri-list-check-2"></i></button>
        </div>
        <button type="button" class="coread-reader-drawer-group" onclick="toggleCoReadReaderChapterGroup()" aria-label="${coreadReaderChapterGroupPickerOpen ? '收起章节范围' : '选择章节范围'}">
            <i class="${coreadReaderChapterGroupPickerOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}"></i>
            <span>第${chapterGroupStart}-${chapterGroupEnd}章</span>
        </button>
        ${chapterGroupPicker}
    ` : '';
    const classicHeader = coreadReaderPanelTab === 'chapters' ? '' : `
        <div class="coread-reader-book-card">
            <div class="coread-reader-cover">${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${musicEscapeHtml(String(book.title || '书').slice(0, 1))}</span>`}</div>
            <div class="coread-reader-book-info">
                <strong>${musicEscapeHtml(book.title || '未命名书籍')}</strong>
                <span>${musicEscapeHtml(book.author || book.source || '未知作者')}</span>
                <em>${pageCount} 页 · ${contentLength ? `${(contentLength / 10000).toFixed(contentLength >= 100000 ? 1 : 2)} 万字` : '暂无正文'} · ${formatCoReadByteSize(getCoReadBookByteSize(book))}</em>
            </div>
            <div class="coread-reader-time">
                <span>阅读时长</span>
                <strong>${formatCoReadDurationFromChars(contentLength)}</strong>
                <em>${Math.min(pageCount, currentPage + 1)} / ${pageCount}</em>
            </div>
            <button type="button" class="coread-reader-panel-close" onclick="closeCoReadReaderPanel()" aria-label="关闭"><i class="ri-close-line"></i></button>
        </div>
        <div class="coread-reader-tabs">
            ${tabs.map(tab => `
                <button type="button" class="${coreadReaderPanelTab === tab.id ? 'active' : ''}" onclick="setCoReadReaderPanelTab('${tab.id}')">
                    <span>${tab.label}</span>
                    <em>${tab.count}</em>
                </button>
            `).join('')}
        </div>
    `;
    box.innerHTML = `
        ${chapterDrawerHeader}
        ${classicHeader}
        <div class="coread-reader-panel" data-reader-panel="${musicEscapeAttr(coreadReaderPanelTab)}">
            ${panel}
        </div>
    `;
}

function renderCoReadReader() {
    const book = getCoReadBook(coreadActiveBookId);
    const title = document.getElementById('coread-reader-title');
    const body = document.getElementById('coread-reader-body');
    const meta = document.getElementById('coread-reader-meta');
    const settings = getCoReadReaderSettings();
    if (title) title.textContent = book ? (book.title || '未命名书籍') : '选择一本书';
    if (meta) {
        const pageCount = book && book.content ? Math.max(1, Math.ceil(String(book.content || '').length / COREAD_PAGE_SIZE)) : 1;
        meta.textContent = book
            ? `${book.author || '未知作者'} · ${settings.pageMode === 'scroll' ? '滚动阅读' : `第 ${Math.max(1, Number(book.page || 0) + 1)} / ${pageCount} 页`}${book.resolveStatus ? ` · ${book.resolveStatus}` : ''}`
            : '导入 txt/md，或用在线书城搜索加入书架';
    }
    if (body) {
        bindCoReadReaderTapZones(body);
        const previousScrollTop = body.scrollTop;
        const wasScrollMode = body.dataset.coreadPageMode === 'scroll';
        const text = book
            ? (settings.pageMode === 'scroll' && !book.resolving
                ? String(book.content || book.description || '这本书目前只有书名和来源链接，还没有正文。')
                : getCoReadPageText(book))
            : '书架空着。导入一本书，选择一个角色，就可以开始共读。';
        if (body.textContent !== text) body.textContent = text;
        body.dataset.coreadPageMode = settings.pageMode;
        if (settings.pageMode === 'scroll') {
            if (book && coreadReaderPendingScrollPage != null) {
                const page = coreadReaderPendingScrollPage;
                coreadReaderPendingScrollPage = null;
                scrollCoReadBodyToPage(body, book, page);
            } else if (wasScrollMode) {
                body.scrollTop = previousScrollTop;
            } else if (book) {
                scrollCoReadBodyToPage(body, book, Number(book.page || 0));
            }
        } else {
            body.scrollTop = 0;
        }
    }
    renderCoReadReaderOverview();
}

