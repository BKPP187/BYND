function ensureDesktopSnapGuides(pageArea) {
    if (!pageArea) return null;
    let guide = pageArea.querySelector(':scope > .desktop-snap-guides');
    if (!guide) {
        guide = document.createElement('div');
        guide.className = 'desktop-snap-guides';
        guide.innerHTML = '<span class="desktop-snap-guide vertical"></span><span class="desktop-snap-guide horizontal"></span>';
        pageArea.appendChild(guide);
    }
    return guide;
}

function showDesktopSnapGuides(pageArea, rect) {
    const guide = ensureDesktopSnapGuides(pageArea);
    if (!guide || !rect) return;
    const vertical = guide.querySelector('.vertical');
    const horizontal = guide.querySelector('.horizontal');
    if (vertical) {
        vertical.style.left = `${Math.round(rect.mode === 'resize' ? rect.left + rect.width : rect.guideX)}px`;
        vertical.classList.toggle('center', !!rect.centerX);
        vertical.classList.toggle('peer', !!rect.peerX);
    }
    if (horizontal) {
        horizontal.style.top = `${Math.round(rect.mode === 'resize' ? rect.top + rect.height : rect.guideY)}px`;
        horizontal.classList.toggle('center', !!rect.centerY);
        horizontal.classList.toggle('peer', !!rect.peerY);
    }
    guide.classList.add('visible');
}

function hideDesktopSnapGuides(pageArea) {
    const scope = pageArea || document;
    scope.querySelectorAll('.desktop-snap-guides.visible').forEach(guide => guide.classList.remove('visible'));
}

function applyDesktopLayoutRect(item, pageArea, rect, options = {}) {
    const safe = snapDesktopLayoutRect(rect, pageArea, { ...options, item });
    item.style.left = `${Math.round(safe.left)}px`;
    item.style.top = `${Math.round(safe.top)}px`;
    item.style.width = `${Math.round(safe.width)}px`;
    item.style.height = `${Math.round(safe.height)}px`;
    if (item && !item.classList.contains('layout-app')) delete pageArea._desktopSlotRects;
    showDesktopSnapGuides(pageArea, safe);
    return safe;
}

function getDesktopCustomWidgetSize(kind) {
    if (kind === 'lovely') return { width: 340, height: 248 };
    if (kind === 'polaroid') return { width: 322, height: 128 };
    if (kind === 'status') return { width: 322, height: 116 };
    if (kind === 'calendar') return { width: 322, height: 180 };
    if (kind === 'photo-square') return { width: 156, height: 156 };
    if (kind === 'notes-trio') return { width: 168, height: 168 };
    if (kind === 'catalog') return { width: 322, height: 322 };
    if (kind === 'princess') return { width: 188, height: 188 };
    return { width: 188, height: 188 };
}

function findDesktopOpenWidgetRect(pageArea, size, preferredRect = null, ignoreItems = []) {
    const width = Math.min(size?.width || 188, Math.max(120, (pageArea?.clientWidth || 375) - 24));
    const height = Math.min(size?.height || 188, Math.max(120, (pageArea?.clientHeight || 590) - 24));
    const areaWidth = Math.max(260, pageArea?.clientWidth || 375);
    const areaHeight = Math.max(520, pageArea?.clientHeight || 590);
    const candidates = [];
    const step = 24;
    const maxTop = Math.max(12, areaHeight - height - 12);
    const maxLeft = Math.max(12, areaWidth - width - 12);
    for (let top = 18; top <= maxTop; top += step) {
        for (let left = 14; left <= maxLeft; left += step) {
            candidates.push(clampDesktopLayoutRect({ left, top, width, height }, pageArea));
        }
    }
    if (!candidates.length) return clampDesktopLayoutRect({ left: 18, top: 44, width, height }, pageArea);
    const ignored = new Set(ignoreItems.filter(Boolean));
    const existing = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item'))
        .filter(item => !item.classList.contains('desktop-layout-dragging') && !ignored.has(item));
    const scored = candidates.map(rect => {
        const overlap = existing.reduce((score, item) => Math.max(score, getDesktopRectIntersectionRatio(rect, getDesktopStyleRect(item, pageArea))), 0);
        const source = preferredRect || { left: 18, top: 44 };
        const distance = Math.abs(rect.left - source.left) + Math.abs(rect.top - source.top);
        return { rect, overlap, distance };
    }).sort((a, b) => (a.overlap - b.overlap) || (a.distance - b.distance));
    const best = scored.find(entry => entry.overlap < 0.08) || scored[0];
    return best.rect;
}

function addDesktopCustomWidget(kind) {
    if (!DESKTOP_CUSTOM_WIDGET_KINDS.has(kind)) return;
    if (!window._editMode) enterEditMode();
    const pageIndex = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
    const page = ensureDesktopPage(pageIndex) || document.querySelector('#pages-container .desktop-page');
    const pageArea = page?.querySelector('.desktop-scroll-area');
    if (!pageArea) return;
    const item = createDesktopCustomWidget(kind);
    const size = getDesktopCustomWidgetSize(kind);
    pageArea.appendChild(item);
    prepareDesktopLayoutItem(item, pageArea, findDesktopOpenWidgetRect(pageArea, size));
    settleDesktopAppsAroundWidget(item, pageArea);
    if (kind === 'status') {
        updateDesktopStatusWidgets();
        requestDesktopStatusWeather({ force: true });
    }
    selectDesktopLayoutItem(item);
}

function ensureDesktopLovelyWidget() {
    if (localStorage.getItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY) === '1') return;
    const page = ensureDesktopPage(1);
    const pageArea = page?.querySelector('.desktop-scroll-area');
    if (!pageArea || pageArea.querySelector('.desktop-widget-lovely')) return;
    const item = createDesktopCustomWidget('lovely', DESKTOP_DEFAULT_LOVELY_ID);
    const size = getDesktopCustomWidgetSize('lovely');
    if (pageArea.classList.contains('layout-canvas') || pageArea.querySelector(':scope > .desktop-layout-item')) {
        pageArea.appendChild(item);
        prepareDesktopLayoutItem(item, pageArea, {
            left: 22,
            top: DESKTOP_DEFAULT_LOVELY_TOP,
            width: Math.min(size.width, Math.max(260, pageArea.clientWidth - 44)),
            height: size.height
        });
        compactDesktopSlotOrder(pageArea);
    } else {
        item.style.marginTop = pageArea.classList.contains('desktop-reference-page') ? '0' : `${DESKTOP_DEFAULT_LOVELY_TOP}px`;
        pageArea.insertBefore(item, pageArea.firstChild);
    }
    pageArea.scrollTop = 0;
    pageArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    syncDesktopPagesAndDots(Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0);
}
window.ensureDesktopLovelyWidget = ensureDesktopLovelyWidget;

function ensureDesktopPrincessWidget() {
    if (localStorage.getItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY) === '1') return;
    const page = ensureDesktopPage(1);
    const pageArea = page?.querySelector('.desktop-scroll-area');
    if (!pageArea || pageArea.querySelector('.desktop-widget-princess')) return;
    const item = createDesktopCustomWidget('princess', DESKTOP_DEFAULT_PRINCESS_ID);
    pageArea.insertBefore(item, pageArea.firstChild);
    pageArea.scrollTop = 0;
    pageArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    syncDesktopPagesAndDots(Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0);
}
window.ensureDesktopPrincessWidget = ensureDesktopPrincessWidget;

function deleteSelectedDesktopLayoutItem() {
    const item = window._desktopSelectedLayoutItem;
    if (!item) return;
    const layoutId = item.dataset.layoutId || '';
    const isCustom = item.dataset.layoutType === 'custom';
    const isDeletableBuiltin = DESKTOP_DELETABLE_BUILTIN_IDS.has(layoutId);
    if (!isCustom && !isDeletableBuiltin) return;
    if (isCustom) {
        if (layoutId === DESKTOP_DEFAULT_PRINCESS_ID) {
            localStorage.setItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY, '1');
        }
        if (layoutId === DESKTOP_DEFAULT_LOVELY_ID) {
            localStorage.setItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY, '1');
        }
        if (item.dataset.widgetKind === 'status') deleteDesktopStatusWidgetPrefs(layoutId);
        if (item.dataset.widgetKind === 'lovely' || item.dataset.widgetKind === 'polaroid' || item.dataset.widgetKind === 'photo-square' || item.dataset.widgetKind === 'notes-trio' || item.dataset.widgetKind === 'catalog') deleteDesktopLovelyWidgetPrefs(layoutId);
        const notes = getDesktopStickyNotes();
        if (layoutId && Object.prototype.hasOwnProperty.call(notes, layoutId)) {
            delete notes[layoutId];
            localStorage.setItem(DESKTOP_STICKY_NOTES_KEY, JSON.stringify(notes));
        }
    }
    const area = item.closest('.desktop-scroll-area');
    item.remove();
    window._desktopSelectedLayoutItem = null;
    if (area && !area.querySelector(':scope > .desktop-layout-item')) {
        area.querySelector('.desktop-empty-placeholder')?.classList.remove('layout-source-hidden');
    }
    if (typeof showWechatToast === 'function') showWechatToast('已删除组件，保存布局后生效');
}
window.deleteSelectedDesktopLayoutItem = deleteSelectedDesktopLayoutItem;
function deleteSelectedDesktopCustomWidget() {
    deleteSelectedDesktopLayoutItem();
}
window.deleteSelectedDesktopCustomWidget = deleteSelectedDesktopCustomWidget;

function addDesktopScreen() {
    if (!window._editMode) enterEditMode();
    const pages = getDesktopPages();
    const nextIndex = pages.length;
    const page = ensureDesktopPage(nextIndex);
    const pageArea = page?.querySelector('.desktop-scroll-area');
    if (pageArea) {
        pageArea.classList.add('layout-canvas');
        pageArea.querySelector('.desktop-empty-placeholder')?.classList.remove('layout-source-hidden');
    }
    if (typeof window.goToDesktopPage === 'function') window.goToDesktopPage(nextIndex);
    if (typeof showWechatToast === 'function') showWechatToast(`已添加第 ${nextIndex + 1} 屏`);
}
window.addDesktopScreen = addDesktopScreen;

function isDesktopScreenEmpty(page) {
    const area = page?.querySelector?.('.desktop-scroll-area');
    if (!area) return true;
    return !Array.from(area.children || []).some(child => {
        if (!child || child.classList.contains('desktop-empty-placeholder') || child.classList.contains('desktop-snap-guides')) return false;
        if (child.classList.contains('layout-source-hidden')) return false;
        return child.matches?.('.desktop-layout-item, .desktop-custom-widget, .app-item, .photo-large, .calendar-widget, .bento-box');
    });
}

function deleteEmptyDesktopScreen() {
    if (!window._editMode) enterEditMode();
    const pages = getDesktopPages();
    if (pages.length <= 1) {
        if (typeof showWechatToast === 'function') showWechatToast('至少保留一个屏幕');
        return;
    }
    const currentIndex = Math.max(0, Math.min(pages.length - 1, Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0));
    let deleteIndex = isDesktopScreenEmpty(pages[currentIndex]) ? currentIndex : -1;
    if (deleteIndex < 0) {
        deleteIndex = pages.findIndex((page, index) => index > 0 && isDesktopScreenEmpty(page));
    }
    if (deleteIndex < 0) {
        if (typeof showWechatToast === 'function') showWechatToast('没有空白屏幕可以删除');
        return;
    }
    if (window._desktopSelectedLayoutItem && pages[deleteIndex].contains(window._desktopSelectedLayoutItem)) {
        window._desktopSelectedLayoutItem = null;
    }
    pages[deleteIndex].remove();
    const nextIndex = Math.max(0, Math.min(deleteIndex, getDesktopPages().length - 1));
    window._desktopCurrentPage = nextIndex;
    syncDesktopPagesAndDots(nextIndex);
    if (typeof window.goToDesktopPage === 'function') window.goToDesktopPage(nextIndex);
    if (typeof showWechatToast === 'function') showWechatToast('已删除空白屏幕');
}
window.deleteEmptyDesktopScreen = deleteEmptyDesktopScreen;

function normalizeDesktopIconRows(pageArea) {
    const cards = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item.layout-app:not(.is-folder)'))
        .map(item => ({ item, rect: getDesktopRawStyleRect(item) })).sort((a, b) => a.rect.top - b.rect.top);
    const rows = [];
    cards.forEach(card => {
        const row = rows.at(-1);
        if (row && Math.abs(card.rect.top - row[0].rect.top) <= 16) row.push(card);
        else rows.push([card]);
    });
    let changed = false;
    rows.forEach(row => {
        const largest = row.reduce((a, b) => a.rect.height >= b.rect.height ? a : b);
        const centers = row.map(card => card.rect.top + card.rect.height / 2).sort((a, b) => a - b);
        const center = largest.rect.height > 83 ? largest.rect.top + largest.rect.height / 2 : centers[Math.floor(centers.length / 2)];
        row.forEach(({ item, rect }) => { if (setDesktopLayoutItemRect(item, { ...rect, top: center - 41, height: 82 })) changed = true; });
    });
    return changed;
}

function getDesktopTransferFootprint(item, pageArea) {
    const raw = getDesktopRawStyleRect(item);
    if (!item.classList.contains('layout-app') || !item.getBoundingClientRect) return raw;
    const frame = item.getBoundingClientRect(), scale = frame.width / (item.offsetWidth || raw.width);
    if (!(scale > 0)) return raw;
    // Measure content overflow relative to the card. Absolute DOM positions can
    // lag behind saved coordinates during transitions and drag transforms.
    const rects = Array.from(item.querySelectorAll('.app-icon, :scope > span')).map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height);
    const left = Math.min(0, ...rects.map(rect => (rect.left - frame.left) / scale));
    const top = Math.min(0, ...rects.map(rect => (rect.top - frame.top) / scale));
    const right = Math.max(raw.width, ...rects.map(rect => (rect.right - frame.left) / scale));
    const bottom = Math.max(raw.height, ...rects.map(rect => (rect.bottom - frame.top) / scale));
    return { left: raw.left + left, top: raw.top + top, width: right - left, height: bottom - top };
}

function findDesktopTransferRect(pageArea, item) {
    if (!pageArea || !item || !hasDesktopUsableLayoutBounds(pageArea)) return null;
    const isApp = item.classList.contains('layout-app');
    const source = getDesktopRawStyleRect(item);
    const metrics = getDesktopFourColumnAppGridMetrics(pageArea);
    const size = clampDesktopLayoutRect({ ...source, ...(isApp && !item.classList.contains('is-folder') ? { width: metrics.iconWidth, height: metrics.iconHeight } : {}) }, pageArea);
    const occupiedItems = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item')).filter(other => other !== item);
    const occupied = occupiedItems.map(other => getDesktopTransferFootprint(other, pageArea));
    const candidates = [];
    const push = (left, top) => candidates.push(clampDesktopLayoutRect({ left, top, width: size.width, height: size.height }, pageArea));
    if (isApp) {
        const rows = occupiedItems.filter(other => other.classList.contains('layout-app') && !other.classList.contains('is-folder')).map(other => getDesktopRawStyleRect(other).top);
        const slots = getDesktopFlowSlotRects(pageArea).sort((a, b) => Number(rows.some(top => Math.abs(top - b.top) < 2)) - Number(rows.some(top => Math.abs(top - a.top) < 2)) || a.top - b.top || a.left - b.left);
        slots.forEach(slot => push(slot.left + (slot.width - size.width) / 2, slot.top + (slot.height - size.height) / 2));
    }
    // Also support components and irregular layouts; a fully occupied screen
    // has no valid result rather than a least-overlapping fallback position.
    const maxLeft = Math.max(8, pageArea.clientWidth - size.width - 8);
    const maxTop = Math.max(8, pageArea.clientHeight - size.height - 8);
    if (!isApp) {
        for (let top = 8; top <= maxTop; top += 12) {
            for (let left = 8; left <= maxLeft; left += 12) push(left, top);
        }
    }
    const clear = rect => rect.left >= 8 && rect.top >= 8
        && rect.left + rect.width <= pageArea.clientWidth - 8
        && rect.top + rect.height <= pageArea.clientHeight - (isApp ? 0 : 8)
        && occupied.every(other => desktopAppRectsHaveClearance(rect, other));
    return candidates.find(clear) || null;
}

function promptDesktopMovePage(item) {
    const home = document.getElementById('home-screen');
    if (!home || !window._editMode || !item || document.getElementById('desktop-save-modal')) return;
    if (getDesktopPages().length < 2) ensureDesktopPage(1);
    const pages = getDesktopPages(), current = getDesktopPageIndex(item.closest('.desktop-page'));
    const modal = document.createElement('div');
    modal.id = 'desktop-save-modal'; modal.className = 'desktop-save-modal';
    modal.innerHTML = '<section class="desktop-save-card desktop-move-card" role="dialog" aria-modal="true" aria-labelledby="desktop-move-title"><strong id="desktop-move-title">移到哪一屏？</strong><span>会放入空位，避开照片组件和其他图标。</span><label>目标屏幕<select aria-label="目标屏幕">' + pages.map((_, index) => '<option value="' + index + '" ' + (index === current ? 'disabled' : '') + (index === (current + 1) % pages.length ? ' selected' : '') + '>第 ' + (index + 1) + ' 屏' + (index === current ? '（当前）' : '') + '</option>').join('') + '</select></label><div><button type="button" data-move-cancel>取消</button><button type="button" class="primary" data-move-confirm>移过去</button></div></section>';
    const dismiss = () => { modal.remove(); item.querySelector('.desktop-item-move-page')?.focus({ preventScroll: true }); };
    modal.querySelector('[data-move-cancel]').onclick = dismiss;
    modal.querySelector('[data-move-confirm]').onclick = () => {
        if (!window._editMode || !item.isConnected) { modal.remove(); return; }
        selectDesktopLayoutItem(item);
        if (moveSelectedDesktopItemToOtherPage(Number(modal.querySelector('select').value))) modal.remove();
    };
    modal.onclick = event => { if (event.target === modal) dismiss(); };
    modal.onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); dismiss(); } };
    const diagnostic = document.createElement('button');
    diagnostic.type = 'button'; diagnostic.hidden = true;
    diagnostic.dataset.moveDiagnostic = ''; diagnostic.textContent = '复制布局诊断';
    diagnostic.onclick = async () => {
        const target = ensureDesktopPage(Number(modal.querySelector('select').value))?.querySelector('.desktop-scroll-area');
        const text = JSON.stringify({
            version: typeof APP_VERSION === 'string' ? APP_VERSION : '',
            viewport: { width: innerWidth, height: innerHeight, scale: getDesktopEditScale() },
            source: item.dataset.layoutId,
            target: target ? { width: target.clientWidth, height: target.clientHeight,
                slots: getDesktopFlowSlotRects(target),
                items: Array.from(target.querySelectorAll(':scope > .desktop-layout-item')).map(node => ({ id: node.dataset.layoutId, rect: getDesktopRawStyleRect(node), footprint: getDesktopTransferFootprint(node, target) })) } : null
        }, null, 2);
        try {
            if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
            await navigator.clipboard.writeText(text);
            if (typeof showWechatToast === 'function') showWechatToast('布局诊断已复制，可以粘贴给我。');
        } catch (_) {
            let field = modal.querySelector('[data-layout-diagnostic-text]');
            if (!field) { field = document.createElement('textarea'); field.dataset.layoutDiagnosticText = ''; field.readOnly = true; field.setAttribute('aria-label', '布局诊断'); modal.querySelector('section').appendChild(field); }
            field.value = text; field.focus(); field.select();
            if (typeof showWechatToast === 'function') showWechatToast('请复制选中的布局诊断文字。');
        }
    };
    modal.querySelector('section').appendChild(diagnostic);
    home.appendChild(modal); modal.querySelector('select').focus();
}

function moveSelectedDesktopItemToOtherPage(targetIndex) {
    const item = window._desktopSelectedLayoutItem;
    if (!item) return;
    let pages = getDesktopPages();
    if (pages.length < 2) {
        ensureDesktopPage(1);
        pages = getDesktopPages();
    }
    const currentPage = item.closest('.desktop-page');
    const currentIndex = getDesktopPageIndex(currentPage);
    const nextIndex = Number.isInteger(targetIndex) ? targetIndex : (currentIndex + 1) % Math.max(1, pages.length);
    if (nextIndex < 0 || nextIndex >= pages.length || nextIndex === currentIndex) return false;
    const targetPage = ensureDesktopPage(nextIndex);
    const targetArea = targetPage?.querySelector('.desktop-scroll-area');
    if (!targetArea) return false;
    const rect = findDesktopTransferRect(targetArea, item);
    if (!rect) {
        const diagnostic = document.querySelector('#desktop-save-modal [data-move-diagnostic]');
        if (diagnostic) diagnostic.hidden = false;
        if (typeof showWechatToast === 'function') showWechatToast('目标屏幕没有足够空位，请先腾出位置或添加新屏幕。');
        return false;
    }
    const sourceArea = item.closest('.desktop-scroll-area');
    targetArea.classList.add('layout-canvas');
    targetArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    targetArea.appendChild(item);
    setDesktopLayoutItemRect(item, rect);
    delete item.dataset.desktopSlot;
    delete item.dataset.desktopNudgedBy;
    captureDesktopPageSlotRects(sourceArea);
    captureDesktopPageSlotRects(targetArea);
    if (['pet', 'comic'].includes(getDesktopAppIdFromElement(item))) {
        try { localStorage.setItem('bynd_desktop_page2_custom_v1', '1'); } catch (_) {}
    }
    if (typeof window.goToDesktopPage === 'function') window.goToDesktopPage(nextIndex);
    selectDesktopLayoutItem(item);
    return true;
}

function getDesktopWidgetLibraryItems() {
    return [
        {
            kind: 'princess',
            title: '蝴蝶结',
            desc: '便签风格小卡片',
            symbol: '✦',
            preview: 'princess',
            tone: 'princess'
        },
        {
            kind: 'status',
            title: '状态条',
            desc: '头像、电量、天气、时间',
            icon: 'ri-dashboard-3-line',
            preview: 'status',
            tone: 'status'
        },
        {
            kind: 'calendar',
            title: '日历',
            desc: '原桌面日历，可拖动缩放',
            icon: 'ri-calendar-line',
            preview: 'calendar',
            tone: 'calendar'
        },
        {
            kind: 'photo-square',
            title: '正方形照片',
            desc: '点击即可更换照片',
            icon: 'ri-image-line',
            preview: 'photo-square',
            tone: 'photo-square'
        },
        {
            kind: 'lovely',
            title: '头像签名',
            desc: '横图、圆头像和下方签名',
            icon: 'ri-collage-line',
            preview: 'lovely',
            tone: 'lovely'
        },
        {
            kind: 'polaroid',
            title: '照片墙',
            desc: '三连拍立得，点击更换照片',
            icon: 'ri-image-2-line',
            preview: 'polaroid',
            tone: 'polaroid'
        },
        {
            kind: 'notes-trio',
            title: 'Notes 三头像',
            desc: '三张圆图、文字和颜色预设',
            icon: 'ri-sticky-note-line',
            preview: 'notes-trio',
            tone: 'notes-trio'
        },
        {
            kind: 'catalog',
            title: 'Catalog 相册',
            desc: '横图、头像和三张缩略图',
            icon: 'ri-gallery-line',
            preview: 'catalog',
            tone: 'catalog'
        }
    ];
}

function renderDesktopWidgetLibraryIcon(item) {
    if (item.preview) return `<span class="desktop-widget-thumb desktop-widget-thumb-${desktopEscapeAttr(item.preview)}" aria-hidden="true"><i></i></span>`;
    if (item.symbol) return `<b class="desktop-widget-library-symbol">${desktopEscapeHtml(item.symbol)}</b>`;
    return `<i class="${desktopEscapeAttr(item.icon || 'ri-layout-grid-line')}"></i>`;
}

function openDesktopWidgetLibrary() {
    const home = document.getElementById('home-screen');
    if (!home || document.getElementById('desktop-widget-library')) return;
    const modal = document.createElement('div');
    modal.id = 'desktop-widget-library';
    modal.className = 'desktop-widget-library';
    modal.innerHTML = `
        <div class="desktop-widget-library-card">
            <div class="desktop-widget-library-head">
                <div>
                    <strong>组件</strong>
                    <span>选择一个小组件添加到当前屏幕</span>
                </div>
                <button type="button" onclick="closeDesktopWidgetLibrary()" aria-label="关闭组件库"><i class="ri-close-line"></i></button>
            </div>
            <div class="desktop-widget-library-grid">
                ${getDesktopWidgetLibraryItems().map(item => `
                    <button type="button" class="desktop-widget-choice ${desktopEscapeAttr(item.tone || '')}" onclick="addDesktopCustomWidgetFromLibrary('${desktopEscapeAttr(item.kind)}')">
                        <span class="desktop-widget-choice-preview">${renderDesktopWidgetLibraryIcon(item)}</span>
                        <span class="desktop-widget-choice-copy">
                            <b>${desktopEscapeHtml(item.title)}</b>
                            <em>${desktopEscapeHtml(item.desc)}</em>
                        </span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    modal.addEventListener('click', event => {
        if (event.target === modal) closeDesktopWidgetLibrary();
    });
    home.appendChild(modal);
}
window.openDesktopWidgetLibrary = openDesktopWidgetLibrary;

function closeDesktopWidgetLibrary() {
    document.getElementById('desktop-widget-library')?.remove();
}
window.closeDesktopWidgetLibrary = closeDesktopWidgetLibrary;

function addDesktopCustomWidgetFromLibrary(kind) {
    closeDesktopWidgetLibrary();
    addDesktopCustomWidget(kind);
}
window.addDesktopCustomWidgetFromLibrary = addDesktopCustomWidgetFromLibrary;

function renderDesktopEditChrome() {
    const home = document.getElementById('home-screen');
    if (!home || document.getElementById('desktop-edit-toolbar')) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'desktop-edit-toolbar';
    toolbar.className = 'desktop-edit-toolbar';
    toolbar.innerHTML = `
        <div class="desktop-edit-handle">
            <strong>编辑桌面</strong>
            <span>拖动图标或组件，点选后可缩放、换屏。</span>
        </div>
        <div class="desktop-widget-tray">
            <button type="button" class="desktop-widget-library-open" onclick="openDesktopWidgetLibrary()"><i class="ri-shapes-line"></i><span>组件</span></button>
            <button type="button" onclick="addDesktopScreen()"><i class="ri-layout-row-line"></i><span>加屏</span></button>
            <button type="button" onclick="deleteEmptyDesktopScreen()"><i class="ri-delete-bin-6-line"></i><span>删空屏</span></button>
        </div>
        <div class="desktop-edit-actions">
            <button type="button" class="restore" onclick="promptRestoreDefaultDesktopLayout()">恢复原始</button>
            <button type="button" onclick="exitEditMode(false)">取消</button>
            <button type="button" class="primary" onclick="promptSaveDesktopLayout()">保存布局</button>
        </div>
    `;
    home.appendChild(toolbar);
}
