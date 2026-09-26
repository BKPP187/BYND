function renderCoReadBookCard(book) {
    const active = book.id === coreadActiveBookId ? 'active' : '';
    const selected = coreadShelfSelectedIds.has(book.id) ? 'selected' : '';
    const source = book.source === 'search' ? '在线搜索' : (book.source || '本地');
    const status = book.resolving ? '解析中' : (isCoReadUsefulContent(book.content) ? '可阅读' : (book.resolveStatus || source));
    return `
        <div class="coread-book ${active} ${selected}" onclick="selectCoReadBook('${musicEscapeAttr(book.id)}')">
            ${coreadShelfSelectionMode ? `<button type="button" class="coread-book-check" onclick="event.stopPropagation(); toggleCoReadShelfBookSelected('${musicEscapeAttr(book.id)}')" aria-label="${selected ? '取消选择' : '选择'}《${musicEscapeAttr(book.title || '未命名书籍')}》" aria-pressed="${selected ? 'true' : 'false'}"><i class="${selected ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'}"></i></button>` : ''}
            <button type="button" class="coread-book-main">
                <span>${musicEscapeHtml(book.title || '未命名书籍')}</span>
                <em>${musicEscapeHtml([book.author, status].filter(Boolean).join(' · '))}</em>
            </button>
            ${coreadShelfSelectionMode || !book.url || !book.resolveFailedAt || book.resolving ? '' : `<button type="button" class="coread-book-delete coread-book-retry" onclick="event.stopPropagation(); retryCoReadBookContent('${musicEscapeAttr(book.id)}')" aria-label="重新解析正文" title="重新解析">
                <i class="ri-refresh-line"></i>
            </button>`}
            ${coreadShelfSelectionMode ? '' : `<button type="button" class="coread-book-delete" onclick="event.stopPropagation(); deleteCoReadBook('${musicEscapeAttr(book.id)}')" aria-label="删除书籍">
                <i class="ri-delete-bin-6-line"></i>
            </button>`}
        </div>
    `;
}

function renderCoReadCharOptions() {
    const chars = getCoReadCharacters();
    return chars.map(char => `
        <button type="button" class="${char.id === coreadActiveCharId ? 'active' : ''}" onclick="selectCoReadChar('${musicEscapeAttr(char.id)}')">
            <img src="${musicEscapeAttr(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
            <span>${musicEscapeHtml(getCoReadCharName(char))}</span>
        </button>
    `).join('') || '<div class="coread-empty">先导入角色卡</div>';
}

function isCoReadBookUnsorted(book) {
    if (!book) return false;
    const tags = Array.isArray(book.tags) ? book.tags.filter(Boolean) : [];
    return !String(book.categoryId || book.category || '').trim() && !tags.length;
}

function isCoReadBookPending(book) {
    if (!book) return false;
    return getCoReadBookProgress(book) <= 1 && !book.finishedAt;
}

function getCoReadShelfCategoryName(book) {
    return String(book && (book.category || book.categoryId) || '').trim();
}

function getCoReadShelfCategoryTabs(library = getCoReadLibrary()) {
    const meta = getCoReadShelfMeta();
    const names = new Set(Object.keys(meta.categories || {}));
    (Array.isArray(library) ? library : []).forEach(book => {
        const name = getCoReadShelfCategoryName(book);
        if (name) names.add(name);
    });
    return [
        ...COREAD_SHELF_CATEGORIES,
        ...Array.from(names).sort((a, b) => a.localeCompare(b, 'zh-CN')).map(name => ({ id: `cat:${name}`, label: name }))
    ];
}

function sortCoReadShelfBooks(list) {
    const mode = getCoReadShelfMeta().sortMode;
    const books = Array.isArray(list) ? [...list] : [];
    if (mode === 'title') return books.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'));
    if (mode === 'author') return books.sort((a, b) => String(a.author || '').localeCompare(String(b.author || ''), 'zh-CN'));
    if (mode === 'progress') return books.sort((a, b) => getCoReadBookProgress(b) - getCoReadBookProgress(a));
    return books.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
}

function getCoReadShelfBooks(library = getCoReadLibrary()) {
    const list = Array.isArray(library) ? library : [];
    if (coreadShelfCategory === 'unsorted') return sortCoReadShelfBooks(list.filter(isCoReadBookUnsorted));
    if (coreadShelfCategory === 'pending') return sortCoReadShelfBooks(list.filter(isCoReadBookPending));
    if (coreadShelfCategory.startsWith('cat:')) {
        const category = coreadShelfCategory.slice(4);
        return sortCoReadShelfBooks(list.filter(book => getCoReadShelfCategoryName(book) === category));
    }
    return sortCoReadShelfBooks(list);
}

function getCoReadShelfCategoryCounts(library = getCoReadLibrary()) {
    const counts = {
        all: library.length,
        unsorted: library.filter(isCoReadBookUnsorted).length,
        pending: library.filter(isCoReadBookPending).length
    };
    getCoReadShelfCategoryTabs(library).forEach(item => {
        if (item.id.startsWith('cat:')) {
            const category = item.id.slice(4);
            counts[item.id] = library.filter(book => getCoReadShelfCategoryName(book) === category).length;
        }
    });
    return counts;
}

function renderCoReadShelfTabs(library = getCoReadLibrary()) {
    const box = document.getElementById('coread-shelf-tabs');
    if (!box) return;
    const tabs = getCoReadShelfCategoryTabs(library);
    const counts = getCoReadShelfCategoryCounts(library);
    if (!tabs.some(item => item.id === coreadShelfCategory)) coreadShelfCategory = 'all';
    box.innerHTML = tabs.map(item => `
        <button type="button" class="${coreadShelfCategory === item.id ? 'active' : ''}" onclick="setCoReadShelfCategory(${musicEscapeAttr(JSON.stringify(item.id))})">
            <span>${musicEscapeHtml(item.label)}</span>
            <em>${Number(counts[item.id] || 0)}</em>
        </button>
    `).join('');
}

function setCoReadShelfCategory(category) {
    const next = String(category || 'all');
    coreadShelfCategory = getCoReadShelfCategoryTabs().some(item => item.id === next) ? next : 'all';
    renderCoReadApp();
}
window.setCoReadShelfCategory = setCoReadShelfCategory;

function setCoReadShelfStatus(text) {
    coreadShelfStatusText = String(text || '');
    const status = document.getElementById('coread-status');
    if (status && coreadActiveTab === 'shelf') status.textContent = coreadShelfStatusText || '内置书城优先，公开书目备用。';
}

function syncCoReadShelfMenuState() {
    const menu = document.getElementById('coread-shelf-menu');
    if (!menu) return;
    const open = coreadShelfMenuOpen && coreadActiveTab === 'shelf';
    menu.classList.toggle('open', open);
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    const shell = document.querySelector('.coread-shell');
    shell?.classList.toggle('coread-shelf-menu-open', open);
    const trigger = document.getElementById('coread-topbar-action');
    if (trigger && coreadActiveTab === 'shelf') {
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-controls', 'coread-shelf-menu');
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    } else if (trigger) {
        trigger.removeAttribute('aria-haspopup');
        trigger.removeAttribute('aria-controls');
        trigger.removeAttribute('aria-expanded');
    }
}

function focusCoReadShelfMenuView(selector = '') {
    requestAnimationFrame(() => {
        if (!coreadShelfMenuOpen) return;
        const panel = document.getElementById('coread-shelf-menu-panel');
        const target = selector ? panel?.querySelector(selector) : panel?.querySelector('button, input, textarea, select');
        const shell = document.querySelector('.coread-shell');
        const content = document.querySelector('.coread-content');
        const shellScrollTop = shell?.scrollTop || 0;
        const contentScrollTop = content?.scrollTop || 0;
        (target || panel)?.focus({ preventScroll: true });
        if (shell) shell.scrollTop = shellScrollTop;
        if (content) content.scrollTop = contentScrollTop;
        requestAnimationFrame(() => {
            if (shell) shell.scrollTop = shellScrollTop;
            if (content) content.scrollTop = contentScrollTop;
        });
    });
}

function toggleCoReadShelfMenu(open, options = {}) {
    const wasOpen = coreadShelfMenuOpen;
    coreadShelfMenuOpen = open == null ? !coreadShelfMenuOpen : !!open;
    if (coreadShelfMenuOpen && !wasOpen) {
        coreadShelfMenuTrigger = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : document.getElementById('coread-topbar-action');
    }
    if (!coreadShelfMenuOpen) coreadShelfToolPanel = '';
    renderCoReadShelfMenu();
    syncCoReadShelfMenuState();
    if (coreadShelfMenuOpen && !wasOpen) {
        focusCoReadShelfMenuView('[data-coread-shelf-action]');
    } else if (!coreadShelfMenuOpen && wasOpen && options.restoreFocus !== false) {
        const trigger = coreadShelfMenuTrigger?.isConnected ? coreadShelfMenuTrigger : document.getElementById('coread-topbar-action');
        requestAnimationFrame(() => trigger?.focus({ preventScroll: true }));
    }
}
window.toggleCoReadShelfMenu = toggleCoReadShelfMenu;

function setCoReadShelfToolPanel(panel) {
    const shell = document.querySelector('.coread-shell');
    const content = document.querySelector('.coread-content');
    const shellScrollTop = shell?.scrollTop || 0;
    const contentScrollTop = content?.scrollTop || 0;
    coreadShelfToolPanel = String(panel || '');
    renderCoReadShelfMenu();
    if (shell) shell.scrollTop = shellScrollTop;
    if (content) content.scrollTop = contentScrollTop;
    focusCoReadShelfMenuView('[data-coread-menu-back]');
}
window.setCoReadShelfToolPanel = setCoReadShelfToolPanel;

function returnCoReadShelfMenu() {
    const shell = document.querySelector('.coread-shell');
    const content = document.querySelector('.coread-content');
    const shellScrollTop = shell?.scrollTop || 0;
    const contentScrollTop = content?.scrollTop || 0;
    const nestedPanels = ['newCategory', 'cover', 'covers'];
    const previousPanel = coreadShelfToolPanel;
    coreadShelfToolPanel = nestedPanels.includes(previousPanel) ? 'more' : '';
    renderCoReadShelfMenu();
    if (shell) shell.scrollTop = shellScrollTop;
    if (content) content.scrollTop = contentScrollTop;
    const target = coreadShelfToolPanel
        ? `[data-coread-more-action="${previousPanel}"]`
        : `[data-coread-shelf-action="${previousPanel === 'select' ? 'select' : previousPanel}"]`;
    focusCoReadShelfMenuView(target);
}
window.returnCoReadShelfMenu = returnCoReadShelfMenu;

function openCoReadShelfTools(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const alreadyOnShelf = coreadActiveTab === 'shelf';
    if (alreadyOnShelf && coreadShelfMenuOpen) {
        coreadShelfMenuOpen = false;
        coreadShelfToolPanel = '';
        syncCoReadShelfMenuState();
        return false;
    }
    coreadShelfToolPanel = '';
    coreadShelfMenuOpen = true;
    coreadActiveTab = 'shelf';
    if (alreadyOnShelf) {
        renderCoReadShelfMenu();
        syncCoReadShelfMenuState();
    } else {
        renderCoReadApp();
        maybeLoadCoReadDiscoveryData();
    }
    focusCoReadShelfMenuView('[data-coread-shelf-action]');
    return false;
}
window.openCoReadShelfTools = openCoReadShelfTools;

function bindCoReadShelfMenuEvents() {
    if (coreadShelfMenuEventsBound) return;
    coreadShelfMenuEventsBound = true;
    document.addEventListener('keydown', event => {
        if (!coreadShelfMenuOpen || coreadActiveTab !== 'shelf') return;
        if (event.key === 'Escape') {
            event.preventDefault();
            toggleCoReadShelfMenu(false);
            return;
        }
        if (event.key !== 'Tab') return;
        const panel = document.getElementById('coread-shelf-menu-panel');
        const focusable = Array.from(panel?.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])
            .filter(element => element.getClientRects().length);
        if (!focusable.length) {
            event.preventDefault();
            panel?.focus();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
}

function getCoReadShelfSelectedBooks() {
    const selected = coreadShelfSelectedIds instanceof Set ? coreadShelfSelectedIds : new Set();
    return getCoReadLibrary().filter(book => selected.has(book.id));
}

function renderCoReadShelfSelectionToolbar(library = getCoReadLibrary()) {
    const toolbar = document.getElementById('coread-selection-toolbar');
    const count = document.getElementById('coread-selection-count');
    const manage = document.getElementById('coread-selection-manage');
    const validIds = new Set((Array.isArray(library) ? library : []).map(book => book && book.id).filter(Boolean));
    coreadShelfSelectedIds = new Set(Array.from(coreadShelfSelectedIds).filter(id => validIds.has(id)));
    const selectedCount = coreadShelfSelectedIds.size;
    const visible = coreadShelfSelectionMode && coreadActiveTab === 'shelf';
    toolbar?.classList.toggle('active', visible);
    toolbar?.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (count) count.textContent = `已选 ${selectedCount} 本`;
    if (manage) manage.disabled = selectedCount === 0;
    document.querySelector('.coread-shell')?.classList.toggle('coread-shelf-selection-mode', coreadShelfSelectionMode);
}

function toggleCoReadShelfSelectionMode(force) {
    const nextMode = force == null ? !coreadShelfSelectionMode : !!force;
    coreadShelfSelectionMode = nextMode;
    coreadShelfToolPanel = '';
    if (!nextMode) {
        coreadShelfSelectedIds = new Set();
        if (coreadShelfMenuOpen) toggleCoReadShelfMenu(false);
    }
    renderCoReadApp();
}
window.toggleCoReadShelfSelectionMode = toggleCoReadShelfSelectionMode;

function toggleCoReadShelfBookSelected(bookId) {
    const id = String(bookId || '');
    if (!id) return;
    if (coreadShelfSelectedIds.has(id)) coreadShelfSelectedIds.delete(id);
    else coreadShelfSelectedIds.add(id);
    renderCoReadApp();
}
window.toggleCoReadShelfBookSelected = toggleCoReadShelfBookSelected;

function selectAllCurrentCoReadShelfBooks() {
    const ids = getCoReadShelfBooks().map(book => book.id);
    if (!ids.length) {
        showCoReadShelfToast('当前分类没有可选择的书');
        return;
    }
    coreadShelfSelectedIds = new Set(ids);
    renderCoReadApp();
}
window.selectAllCurrentCoReadShelfBooks = selectAllCurrentCoReadShelfBooks;

function openCoReadShelfSelectionManager() {
    if (!getCoReadShelfSelectedBooks().length) {
        showCoReadShelfToast('请先选择至少一本书');
        return;
    }
    coreadShelfToolPanel = 'select';
    toggleCoReadShelfMenu(true);
    focusCoReadShelfMenuView('[data-coread-menu-back]');
}
window.openCoReadShelfSelectionManager = openCoReadShelfSelectionManager;

function moveSelectedCoReadBooks() {
    const ids = getCoReadShelfSelectedBooks().map(book => book.id);
    if (!ids.length) {
        showCoReadShelfToast('请先选择至少一本书');
        return;
    }
    const category = document.getElementById('coread-move-category-input')?.value || '';
    const changed = setCoReadBookCategory(ids, category);
    showCoReadShelfToast(category ? `已把 ${changed} 本书移到「${category}」` : `已把 ${changed} 本书移到未整理`);
    renderCoReadApp();
}
window.moveSelectedCoReadBooks = moveSelectedCoReadBooks;

function deleteSelectedCoReadBooks() {
    const selectedBooks = getCoReadShelfSelectedBooks();
    if (!selectedBooks.length) {
        showCoReadShelfToast('请先选择至少一本书');
        return;
    }
    if (!confirm(`删除已选的 ${selectedBooks.length} 本书？此操作无法撤销。`)) return;
    const selectedIds = new Set(selectedBooks.map(book => book.id));
    const next = getCoReadLibrary().filter(book => !selectedIds.has(book.id));
    saveCoReadLibrary(next);
    if (selectedIds.has(coreadActiveBookId) || !next.some(book => book.id === coreadActiveBookId)) {
        coreadActiveBookId = next[0]?.id || '';
    }
    coreadShelfSelectedIds = new Set();
    coreadShelfSelectionMode = false;
    coreadShelfToolPanel = '';
    if (coreadShelfMenuOpen) toggleCoReadShelfMenu(false);
    renderCoReadApp();
    showCoReadShelfToast(`已删除 ${selectedBooks.length} 本书`);
}
window.deleteSelectedCoReadBooks = deleteSelectedCoReadBooks;

function setCoReadBookCategory(bookIds, category) {
    const ids = new Set((Array.isArray(bookIds) ? bookIds : [bookIds]).map(String).filter(Boolean));
    const name = String(category || '').trim().slice(0, 28);
    if (!ids.size) return 0;
    if (name) {
        const meta = getCoReadShelfMeta();
        meta.categories[name] = meta.categories[name] || { coverUrl: '', createdAt: Date.now() };
        saveCoReadShelfMeta(meta);
    }
    const library = getCoReadLibrary();
    let changed = 0;
    library.forEach(book => {
        if (!book || !ids.has(book.id)) return;
        book.category = name;
        book.categoryId = name;
        book.updatedAt = Date.now();
        changed++;
    });
    saveCoReadLibrary(library);
    return changed;
}

function getCoReadActiveShelfCategoryName() {
    return coreadShelfCategory.startsWith('cat:') ? coreadShelfCategory.slice(4) : '';
}

function createCoReadShelfCategory() {
    const input = document.getElementById('coread-category-name-input');
    const name = String(input?.value || '').trim().slice(0, 28);
    if (!name) {
        showCoReadShelfToast('先写分类名');
        return;
    }
    const meta = getCoReadShelfMeta();
    meta.categories[name] = meta.categories[name] || { coverUrl: '', createdAt: Date.now() };
    saveCoReadShelfMeta(meta);
    const checkedIds = Array.from(document.querySelectorAll('input[name="coread-new-category-book"]:checked'))
        .map(input => String(input.value || '').trim())
        .filter(Boolean);
    const selectedIds = checkedIds.length ? checkedIds : getCoReadShelfSelectedBooks().map(book => book.id);
    if (selectedIds.length) setCoReadBookCategory(selectedIds, name);
    coreadShelfCategory = `cat:${name}`;
    showCoReadShelfToast(selectedIds.length ? `已把 ${selectedIds.length} 本书移到「${name}」` : `已创建「${name}」`);
    renderCoReadApp();
}
window.createCoReadShelfCategory = createCoReadShelfCategory;

function dissolveCoReadShelfCategory() {
    const category = getCoReadActiveShelfCategoryName();
    const selected = getCoReadShelfSelectedBooks();
    if (!category && !selected.length) {
        showCoReadShelfToast('先进入一个分类，或先选择书籍');
        return;
    }
    const text = category ? `解散分类「${category}」？书不会删除，只会移到未整理。` : `把选中的 ${selected.length} 本书移到未整理？`;
    if (!confirm(text)) return;
    const library = getCoReadLibrary();
    let changed = 0;
    library.forEach(book => {
        const hit = category ? getCoReadShelfCategoryName(book) === category : coreadShelfSelectedIds.has(book.id);
        if (!hit) return;
        book.category = '';
        book.categoryId = '';
        book.updatedAt = Date.now();
        changed++;
    });
    const meta = getCoReadShelfMeta();
    if (category && meta.categories) delete meta.categories[category];
    saveCoReadShelfMeta(meta);
    saveCoReadLibrary(library);
    coreadShelfCategory = 'unsorted';
    coreadShelfSelectedIds = new Set();
    showCoReadShelfToast(`已整理 ${changed} 本书`);
    renderCoReadApp();
}
window.dissolveCoReadShelfCategory = dissolveCoReadShelfCategory;

function setCoReadShelfSortMode(mode) {
    saveCoReadShelfMeta({ sortMode: mode });
    renderCoReadApp();
}
window.setCoReadShelfSortMode = setCoReadShelfSortMode;

function createManualCoReadBook() {
    const title = String(document.getElementById('coread-create-title')?.value || '').trim();
    const author = String(document.getElementById('coread-create-author')?.value || '').trim();
    const content = String(document.getElementById('coread-create-content')?.value || '').trim();
    if (!title) {
        showCoReadShelfToast('先写书名');
        return;
    }
    addCoReadBook({
        title,
        author,
        content: content || `书名：${title}\n作者：${author || '未知'}\n\n这是手动创建的书籍，可以之后继续补正文。`,
        source: 'manual',
        category: getCoReadActiveShelfCategoryName()
    });
    showCoReadShelfToast(`已创建《${title}》`);
}
window.createManualCoReadBook = createManualCoReadBook;

function applyCoReadTagsToSelected() {
    const value = String(document.getElementById('coread-tags-input')?.value || '').trim();
    const tags = value.split(/[，,\s]+/).map(tag => tag.trim()).filter(Boolean).slice(0, 12);
    if (!tags.length) {
        showCoReadShelfToast('先写标签');
        return;
    }
    const ids = getCoReadShelfSelectedBooks().map(book => book.id);
    if (!ids.length && coreadShelfSelectionMode) {
        showCoReadShelfToast('请先选择至少一本书');
        return;
    }
    if (!ids.length && coreadActiveBookId) ids.push(coreadActiveBookId);
    const set = new Set(ids);
    const library = getCoReadLibrary();
    let changed = 0;
    library.forEach(book => {
        if (!set.has(book.id)) return;
        book.tags = tags;
        book.updatedAt = Date.now();
        changed++;
    });
    saveCoReadLibrary(library);
    showCoReadShelfToast(`已更新 ${changed} 本书的标签`);
    renderCoReadApp();
}
window.applyCoReadTagsToSelected = applyCoReadTagsToSelected;

async function uploadCoReadBookCover(input, bookId) {
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file) return;
    if (!/^image\//i.test(file.type || '')) {
        showCoReadShelfToast('请选择图片文件');
        return;
    }
    if (file.size > 12 * 1024 * 1024) {
        showCoReadShelfToast('原图片不能超过 12 MB，请先缩小后再试');
        return;
    }
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === String(bookId || ''));
    if (!book) {
        showCoReadShelfToast('没有找到这本书');
        return;
    }
    const objectUrl = URL.createObjectURL(file);
    try {
        const image = new Image();
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('image-load-failed'));
            image.src = objectUrl;
        });
        const width = Number(image.naturalWidth || image.width || 0);
        const height = Number(image.naturalHeight || image.height || 0);
        if (!width || !height) throw new Error('image-size-invalid');
        const scale = Math.min(1, 900 / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas-unavailable');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let dataUrl = canvas.toDataURL('image/webp', 0.82);
        if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        if (!/^data:image\/(?:webp|jpeg);base64,/i.test(dataUrl)) throw new Error('image-export-failed');
        const previousCoverUrl = book.coverUrl;
        const previousUpdatedAt = book.updatedAt;
        book.coverUrl = dataUrl;
        book.updatedAt = Date.now();
        try {
            saveCoReadLibrary(library);
        } catch (error) {
            book.coverUrl = previousCoverUrl;
            book.updatedAt = previousUpdatedAt;
            const quotaError = error?.name === 'QuotaExceededError'
                || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
                || error?.code === 22
                || error?.code === 1014;
            showCoReadShelfToast(quotaError
                ? '本机存储空间不足，请换更小的图片或删除部分书籍后重试'
                : '封面保存失败，请稍后再试');
            return;
        }
        showCoReadShelfToast('封面已更新');
        renderCoReadApp();
    } catch (_) {
        showCoReadShelfToast('图片处理失败，请换一张图片再试');
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}
window.uploadCoReadBookCover = uploadCoReadBookCover;

function isUnsupportedCoReadCloudShareUrl(value) {
    let raw = String(value || '').trim();
    const matched = raw.match(/https?:\/\/[^\s]+/i);
    if (matched) raw = matched[0];
    raw = raw.replace(/[，。；;）)\]】]+$/, '');
    if (!/^https?:\/\//i.test(raw) && /^(?:pan|yun)\.baidu\.com\//i.test(raw)) raw = `https://${raw}`;
    try {
        const host = new URL(raw).hostname.toLowerCase();
        return host === 'pan.baidu.com' || host === 'yun.baidu.com';
    } catch (_) {
        return false;
    }
}

function chooseCoReadShelfFiles(options = {}) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = options.textOnly
        ? '.txt,.md,.markdown,.json,.csv,text/*'
        : '.txt,.md,.markdown,.json,.csv,.doc,.docx,.pdf,text/*';
    input.hidden = true;
    input.dataset.coreadTemporary = 'true';
    if (options.directory) {
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
    }
    input.onchange = async () => {
        if (!input.files?.length) return;
        setCoReadShelfStatus(options.smart ? '正在智能整理所选文件…' : (options.directory ? '正在扫描并导入文件夹…' : '正在导入所选文件…'));
        await importCoReadFiles(input.files, options);
        input.remove();
    };
    document.body.appendChild(input);
    openCoReadShelfFilePicker(input, options.smart
        ? '等待选择智能导入文件…'
        : (options.directory ? '等待选择文件夹…' : '等待选择本地文件…'));
}
window.chooseCoReadShelfFiles = chooseCoReadShelfFiles;

function openCoReadShelfFilePicker(input, waitingText = '等待选择文件…') {
    if (!input) return;
    const token = ++coreadShelfPickerToken;
    toggleCoReadShelfMenu(false, { restoreFocus: false });
    setCoReadShelfStatus(waitingText);
    input.value = '';
    const cancel = () => {
        if (token !== coreadShelfPickerToken || input.files?.length) return;
        setCoReadShelfStatus('已取消选择');
        if (input.dataset.coreadTemporary === 'true') input.remove();
    };
    input.addEventListener('cancel', cancel, { once: true });
    window.addEventListener('focus', () => setTimeout(cancel, 240), { once: true });
    try {
        input.click();
    } catch (_) {
        cancel();
    }
}

function handleCoReadShelfTool(action) {
    const id = String(action || '');
    const panels = ['select', 'newCategory', 'cover', 'settings', 'createBook', 'covers', 'tags', 'categories', 'sort', 'more'];
    if (id === 'select') {
        if (!coreadShelfSelectionMode) {
            toggleCoReadShelfMenu(false, { restoreFocus: false });
            toggleCoReadShelfSelectionMode(true);
            showCoReadShelfToast('已进入选择模式，点击整张书籍卡片即可选择');
        } else {
            openCoReadShelfSelectionManager();
        }
        return;
    }
    if (id === 'importLocal') {
        openCoReadShelfFilePicker(document.getElementById('coread-file-input'), '等待选择本机文件…');
        return;
    }
    if (id === 'scanFolder') {
        chooseCoReadShelfFiles({ directory: true });
        return;
    }
    if (id === 'smartImport') {
        chooseCoReadShelfFiles({ smart: true });
        return;
    }
    if (id === 'dissolve') {
        dissolveCoReadShelfCategory();
        return;
    }
    if (panels.includes(id)) {
        setCoReadShelfToolPanel(id);
        return;
    }
    showCoReadShelfToast('这个工具暂时没有可执行动作');
}
window.handleCoReadShelfTool = handleCoReadShelfTool;

function setCoReadShelfViewMode(mode) {
    saveCoReadShelfSettings({ viewMode: mode });
    applyCoReadShelfSettings();
    renderCoReadDashboard();
    renderCoReadShelfMenu();
}
window.setCoReadShelfViewMode = setCoReadShelfViewMode;

function setCoReadShelfOption(option, value) {
    const key = String(option || '');
    if (!['compact', 'cardMode', 'divider', 'sidePadding', 'topSteps'].includes(key)) return;
    saveCoReadShelfSettings({ [key]: value });
    applyCoReadShelfSettings();
    renderCoReadDashboard();
    if (key !== 'sidePadding' && key !== 'topSteps') renderCoReadShelfMenu();
}
window.setCoReadShelfOption = setCoReadShelfOption;

function applyCoReadCategoryCoverFromUrl() {
    const category = getCoReadActiveShelfCategoryName();
    const value = String(document.getElementById('coread-category-cover-url')?.value || '').trim();
    const coverUrl = normalizeCoReadCoverUrl(value);
    if (!category) {
        showCoReadShelfToast('先进入一个自定义分类');
        return;
    }
    if (!coverUrl) {
        showCoReadShelfToast('请先粘贴有效的图床 URL');
        return;
    }
    const meta = getCoReadShelfMeta();
    meta.categories[category] = { ...(meta.categories[category] || {}), coverUrl, createdAt: meta.categories[category]?.createdAt || Date.now() };
    saveCoReadShelfMeta(meta);
    showCoReadShelfToast(`已更新「${category}」封面`);
    renderCoReadShelfMenu();
}
window.applyCoReadCategoryCoverFromUrl = applyCoReadCategoryCoverFromUrl;

function uploadCoReadCategoryCover(input) {
    const file = input && input.files && input.files[0];
    const category = getCoReadActiveShelfCategoryName();
    if (!file) {
        showCoReadShelfToast('没有选择图片');
        return;
    }
    if (!category) {
        showCoReadShelfToast('先进入一个自定义分类');
        if (input) input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        const meta = getCoReadShelfMeta();
        meta.categories[category] = { ...(meta.categories[category] || {}), coverUrl: String(reader.result || ''), createdAt: meta.categories[category]?.createdAt || Date.now() };
        saveCoReadShelfMeta(meta);
        showCoReadShelfToast(`已更新「${category}」封面`);
        renderCoReadShelfMenu();
    };
    reader.readAsDataURL(file);
    if (input) input.value = '';
}
window.uploadCoReadCategoryCover = uploadCoReadCategoryCover;

function renderCoReadShelfMenu() {
    const panel = document.getElementById('coread-shelf-menu-panel');
    if (!panel) return;
    const settings = getCoReadShelfSettings();
    const meta = getCoReadShelfMeta();
    const library = getCoReadLibrary();
    const selectedBooks = getCoReadShelfSelectedBooks();
    const activeCategory = getCoReadActiveShelfCategoryName();
    const shelfBooks = getCoReadShelfBooks(library);
    const groups = COREAD_SHELF_TOOL_GROUPS.map(group => `
        <div class="coread-shelf-tool-group">
            ${group.map(item => `
                <button type="button" data-coread-shelf-action="${item.id}" class="${item.id === 'select' && coreadShelfSelectionMode ? 'active' : ''}" onclick="handleCoReadShelfTool('${item.id}')">
                    <i class="${item.icon}"></i><span>${musicEscapeHtml(item.label)}</span>${item.arrow ? '<b><i class="ri-arrow-right-s-line"></i></b>' : ''}
                </button>
            `).join('')}
        </div>
    `).join('');
    const selectPanel = coreadShelfToolPanel === 'select' ? `
        <div class="coread-shelf-subpanel coread-selection-manage-panel">
            <small aria-live="polite">已选 ${selectedBooks.length} 本</small>
            <label class="coread-shelf-url-field">
                <span>移到</span>
                <select id="coread-move-category-input">
                    <option value="">未整理</option>
                    ${getCoReadShelfCategoryTabs(library).filter(item => item.id.startsWith('cat:')).map(item => `<option value="${musicEscapeAttr(item.label)}">${musicEscapeHtml(item.label)}</option>`).join('')}
                </select>
                <button type="button" onclick="moveSelectedCoReadBooks()">移动</button>
            </label>
            <label class="coread-shelf-url-field">
                <span>标签</span>
                <input id="coread-tags-input" type="text" placeholder="甜文, 古风, 待补">
                <button type="button" onclick="applyCoReadTagsToSelected()">保存</button>
            </label>
            <button type="button" class="coread-selection-delete" onclick="deleteSelectedCoReadBooks()"><i class="ri-delete-bin-6-line"></i><span>删除已选</span></button>
            <button type="button" class="coread-selection-finish" onclick="toggleCoReadShelfSelectionMode(false)"><i class="ri-check-line"></i><span>完成选择</span></button>
        </div>
    ` : '';
    const newCategoryPanel = coreadShelfToolPanel === 'newCategory' ? `
        <div class="coread-shelf-subpanel">
            <label class="coread-shelf-url-field">
                <span>名称</span>
                <input id="coread-category-name-input" type="text" maxlength="28" placeholder="例如：待追 / 古风 / 同人">
                <button type="button" onclick="createCoReadShelfCategory()">创建</button>
            </label>
            <div class="coread-new-category-picker">
                <em>选择要放进分类的书</em>
                ${(library.length ? library.slice(0, 24).map(book => {
                    const checked = coreadShelfSelectedIds.has(book.id) ? 'checked' : '';
                    return `
                        <label>
                            <input type="checkbox" name="coread-new-category-book" value="${musicEscapeAttr(book.id)}" ${checked}>
                            <span>${musicEscapeHtml(book.title || '未命名书籍')}</span>
                        </label>
                    `;
                }).join('') : '<small>书架还没有书，可以先创建空分类。</small>')}
            </div>
        </div>
    ` : '';
    const coverPanel = coreadShelfToolPanel === 'cover' ? `
        <div class="coread-shelf-subpanel">
            ${activeCategory ? `<small>正在设置「${musicEscapeHtml(activeCategory)}」的分类封面。</small>` : ''}
            ${activeCategory && meta.categories?.[activeCategory]?.coverUrl ? `<div class="coread-shelf-cover-preview"><img src="${musicEscapeAttr(meta.categories[activeCategory].coverUrl)}" onerror="this.remove()"></div>` : '<small>先进入自定义分类，再设置这个分类的封面。</small>'}
            <div class="coread-shelf-cover-actions">
                <button type="button" onclick="document.getElementById('coread-category-cover-input')?.click()"><i class="ri-upload-cloud-2-line"></i><span>上传图片</span></button>
                <input id="coread-category-cover-input" type="file" accept="image/*" onchange="uploadCoReadCategoryCover(this)" hidden>
            </div>
            <label class="coread-shelf-url-field">
                <span>图床 URL</span>
                <input id="coread-category-cover-url" type="url" placeholder="https://..." onkeydown="if(event.key==='Enter') applyCoReadCategoryCoverFromUrl()">
                <button type="button" onclick="applyCoReadCategoryCoverFromUrl()">应用</button>
            </label>
        </div>
    ` : '';
    const createBookPanel = coreadShelfToolPanel === 'createBook' ? `
        <div class="coread-shelf-subpanel coread-shelf-form-panel">
            <input id="coread-create-title" type="text" placeholder="书名">
            <input id="coread-create-author" type="text" placeholder="作者，可不填">
            <textarea id="coread-create-content" placeholder="正文或简介，可之后再补"></textarea>
            <button type="button" onclick="createManualCoReadBook()">创建</button>
        </div>
    ` : '';
    const coversPanel = coreadShelfToolPanel === 'covers' ? `
        <div class="coread-shelf-subpanel coread-book-cover-list">
            ${shelfBooks.map(book => `
                <div class="coread-book-cover-row">
                    <span class="coread-book-cover-thumb">
                        <i class="ri-book-2-line" aria-hidden="true"></i>
                        ${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" alt="" onerror="this.remove()">` : ''}
                    </span>
                    <strong title="${musicEscapeAttr(book.title || '未命名书籍')}">${musicEscapeHtml(book.title || '未命名书籍')}</strong>
                    <button type="button" onclick="this.nextElementSibling?.click()">${book.coverUrl ? '更换图片' : '选择图片'}</button>
                    <input type="file" accept="image/*" data-book-id="${musicEscapeAttr(book.id)}" onchange="uploadCoReadBookCover(this, this.dataset.bookId)" hidden>
                </div>
            `).join('') || '<small>当前分类没有书。</small>'}
        </div>
    ` : '';
    const tagsPanel = coreadShelfToolPanel === 'tags' ? `
        <div class="coread-shelf-subpanel">
            <small>${selectedBooks.length ? `会更新已选 ${selectedBooks.length} 本书。` : '未选择书籍时，会更新当前正在阅读的书。'}</small>
            <label class="coread-shelf-url-field">
                <span>标签</span>
                <input id="coread-tags-input" type="text" placeholder="甜文, 古风, 待补">
                <button type="button" onclick="applyCoReadTagsToSelected()">保存</button>
            </label>
        </div>
    ` : '';
    const categoriesPanel = coreadShelfToolPanel === 'categories' ? `
        <div class="coread-shelf-subpanel">
            ${getCoReadShelfCategoryTabs(library).filter(item => item.id.startsWith('cat:')).map(item => `
                <button type="button" class="${coreadShelfCategory === item.id ? 'active' : ''}" onclick="setCoReadShelfCategory(${musicEscapeAttr(JSON.stringify(item.id))})">${musicEscapeHtml(item.label)} · ${Number(getCoReadShelfCategoryCounts(library)[item.id] || 0)}</button>
            `).join('') || '<small>还没有自定义分类。</small>'}
        </div>
    ` : '';
    const settingsPanel = coreadShelfToolPanel === 'settings' ? `
        <div class="coread-shelf-subpanel">
            <div class="coread-shelf-view-row">
                ${[
                    ['grid', '网格'],
                    ['waterfall', '流式'],
                    ['list', '列表']
                ].map(([id, label]) => `<button type="button" class="${settings.viewMode === id ? 'active' : ''}" onclick="setCoReadShelfViewMode('${id}')">${label}</button>`).join('')}
            </div>
            <label><input type="checkbox" ${settings.cardMode ? 'checked' : ''} onchange="setCoReadShelfOption('cardMode', this.checked)"><span>卡片模式</span></label>
            <label><input type="checkbox" ${settings.compact ? 'checked' : ''} onchange="setCoReadShelfOption('compact', this.checked)"><span>紧凑模式</span></label>
            <label><input type="checkbox" ${settings.divider ? 'checked' : ''} onchange="setCoReadShelfOption('divider', this.checked)"><span>显示分割线</span></label>
            <label class="range"><span>左右间距</span><input type="range" min="8" max="28" value="${settings.sidePadding}" oninput="setCoReadShelfOption('sidePadding', this.value)"></label>
            <label class="range"><span>顶部书架台阶</span><input type="range" min="0" max="72" value="${settings.topSteps}" oninput="setCoReadShelfOption('topSteps', this.value)"></label>
        </div>
    ` : '';
    const sortPanel = coreadShelfToolPanel === 'sort' ? `
        <div class="coread-shelf-subpanel">
            <div class="coread-shelf-view-row">
                ${[
                    ['recent', '最近'],
                    ['title', '书名'],
                    ['author', '作者'],
                    ['progress', '进度']
                ].map(([id, label]) => `<button type="button" class="${meta.sortMode === id ? 'active' : ''}" onclick="setCoReadShelfSortMode('${id}')">${label}</button>`).join('')}
            </div>
        </div>
    ` : '';
    const morePanel = coreadShelfToolPanel === 'more' ? `
        <div class="coread-shelf-subpanel coread-shelf-more-panel">
            <button type="button" data-coread-more-action="newCategory" onclick="setCoReadShelfToolPanel('newCategory')"><i class="ri-folder-add-line"></i><span>新建子分类</span><i class="ri-arrow-right-s-line"></i></button>
            <button type="button" data-coread-more-action="cover" onclick="setCoReadShelfToolPanel('cover')"><i class="ri-image-add-line"></i><span>分类封面</span><i class="ri-arrow-right-s-line"></i></button>
            <button type="button" onclick="dissolveCoReadShelfCategory()"><i class="ri-folder-reduce-line"></i><span>解散分类</span></button>
            <button type="button" data-coread-more-action="covers" onclick="setCoReadShelfToolPanel('covers')"><i class="ri-gallery-line"></i><span>封面图集</span><i class="ri-arrow-right-s-line"></i></button>
        </div>
    ` : '';
    const panelTitles = {
        select: '选择书籍',
        newCategory: '新建子分类',
        cover: activeCategory ? `分类封面 · ${activeCategory}` : '分类封面',
        createBook: '创建书籍',
        covers: '封面图集',
        tags: '标签管理',
        categories: '分类管理',
        settings: '书架设置',
        sort: '书籍排序',
        more: '更多'
    };
    const subpanel = selectPanel || newCategoryPanel || coverPanel || createBookPanel || coversPanel
        || tagsPanel || categoriesPanel || settingsPanel || sortPanel || morePanel;
    panel.dataset.view = coreadShelfToolPanel || 'main';
    panel.innerHTML = coreadShelfToolPanel ? `
        <section class="coread-shelf-menu-view coread-shelf-menu-subview" aria-labelledby="coread-shelf-menu-title">
            <header class="coread-shelf-menu-head">
                <button type="button" data-coread-menu-back onclick="returnCoReadShelfMenu()" aria-label="返回上一级"><i class="ri-arrow-left-s-line"></i></button>
                <strong id="coread-shelf-menu-title">${musicEscapeHtml(panelTitles[coreadShelfToolPanel] || '书架工具')}</strong>
            </header>
            ${subpanel}
        </section>
    ` : `
        <nav class="coread-shelf-menu-view coread-shelf-menu-main" aria-label="书架工具列表">
            ${groups}
        </nav>
    `;
}

