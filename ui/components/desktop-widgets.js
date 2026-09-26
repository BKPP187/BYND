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
        item.style.marginTop = `${DESKTOP_DEFAULT_LOVELY_TOP}px`;
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

function moveSelectedDesktopItemToOtherPage() {
    const item = window._desktopSelectedLayoutItem;
    if (!item) return;
    let pages = getDesktopPages();
    if (pages.length < 2) {
        ensureDesktopPage(1);
        pages = getDesktopPages();
    }
    const currentPage = item.closest('.desktop-page');
    const currentIndex = getDesktopPageIndex(currentPage);
    const nextIndex = (currentIndex + 1) % Math.max(1, pages.length);
    const targetPage = ensureDesktopPage(nextIndex);
    const targetArea = targetPage?.querySelector('.desktop-scroll-area');
    if (!targetArea) return;
    targetArea.classList.add('layout-canvas');
    targetArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    targetArea.appendChild(item);
    item.style.left = '24px';
    item.style.top = '64px';
    if (['pet', 'comic'].includes(getDesktopAppIdFromElement(item))) {
        try { localStorage.setItem('bynd_desktop_page2_custom_v1', '1'); } catch (_) {}
    }
    if (typeof window.goToDesktopPage === 'function') window.goToDesktopPage(nextIndex);
    selectDesktopLayoutItem(item);
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
