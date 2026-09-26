// --- 桌面长按布局编辑 ---
const DESKTOP_STICKY_NOTES_KEY = 'desktop_sticky_notes_v1';
const DESKTOP_STATUS_WIDGET_PREFS_KEY = 'desktop_status_widget_prefs_v1';
const DESKTOP_LOVELY_WIDGET_PREFS_KEY = 'desktop_lovely_widget_prefs_v1';
const DESKTOP_LOVELY_LEGACY_BUBBLE_TEXT = "BEYOND THE CODE\nTHAT'S WHERE WE'LL BE\nFOREVER FREE";
const DESKTOP_LOVELY_DEFAULT_BUBBLE_TEXT = "FACEBOOK\nCHU ANH一梅";
const DESKTOP_LOVELY_BUBBLE_COLORS = {
    blue: 'rgba(181,218,247,0.72)',
    pink: 'rgba(252,205,221,0.94)',
    mint: 'rgba(196,235,218,0.94)',
    yellow: 'rgba(249,230,171,0.94)',
    purple: 'rgba(220,206,247,0.94)',
    clear: 'rgba(255,255,255,0)',
    black: 'rgba(20,22,27,0.88)',
    gray: 'rgba(152,159,170,0.82)'
};
const DESKTOP_LOVELY_BUBBLE_HEX = {
    blue: '#b8dbf9',
    pink: '#fccddd',
    mint: '#c4ebda',
    yellow: '#f9e6ab',
    purple: '#dccef7',
    clear: '#ffffff',
    black: '#14161b',
    gray: '#989faa'
};
const DESKTOP_NOTES_WIDGET_TONES = {
    blue: { label: '奶蓝', card: 'rgba(213,238,253,0.76)', accent: '#8ec8ee', back: '#2aa9d6', back2: '#bfeaf8', text: '#65acd7', icon: 'ri-fish-line' },
    pink: { label: '奶粉', card: 'rgba(253,223,234,0.78)', accent: '#f3a8c4', back: '#f7a8c9', back2: '#fff6b6', text: '#e88eb1', icon: 'ri-footprint-line' },
    yellow: { label: '奶黄', card: 'rgba(255,231,177,0.78)', accent: '#f5bf59', back: '#ffc863', back2: '#d9efff', text: '#e19c1a', icon: 'ri-ship-line' },
    mint: { label: '薄荷', card: 'rgba(214,244,230,0.78)', accent: '#83d6ac', back: '#89dcb6', back2: '#d9f0ff', text: '#63b88d', icon: 'ri-leaf-line' },
    purple: { label: '淡紫', card: 'rgba(229,218,252,0.78)', accent: '#b69be9', back: '#c1a7ef', back2: '#f9d8eb', text: '#9c80d6', icon: 'ri-star-smile-line' }
};
const DESKTOP_STATUS_WEATHER_KEY = 'desktop_status_weather_v1';
const DESKTOP_STATUS_STEPS_KEY = 'desktop_status_steps_v1';
const DESKTOP_DEFAULT_PRINCESS_DELETED_KEY = 'desktop_default_princess_deleted_v1';
const DESKTOP_DEFAULT_LOVELY_DELETED_KEY = 'desktop_default_lovely_deleted_v1';
const DESKTOP_DEFAULT_PRINCESS_ID = 'custom-princess-default';
const DESKTOP_DEFAULT_LOVELY_ID = 'custom-lovely-default';
const DESKTOP_DEFAULT_LOVELY_LEGACY_TOP = 14;
const DESKTOP_DEFAULT_LOVELY_OLD_TOP = 104;
const DESKTOP_DEFAULT_LOVELY_TOP = 48;
const DESKTOP_CUSTOM_WIDGET_KINDS = new Set(['princess', 'status', 'lovely', 'polaroid', 'calendar', 'photo-square', 'notes-trio', 'catalog']);
const DESKTOP_SNAP_GRID = 12;
const DESKTOP_SNAP_TOLERANCE = 9;
const DESKTOP_DOCK_LAYOUT_MAX = 4;
const DESKTOP_DELETABLE_BUILTIN_IDS = new Set(['widget-calendar', 'widget-photo-1', 'widget-photo-2']);
const DESKTOP_STATIC_PAGE2_APP_LAYOUT_IDS = new Set();
const DESKTOP_PAGE2_APP_IDS = new Set(['dream', 'monitor', 'pet', 'outing', 'coread', 'living-world', 'album', 'manual', 'mcp', 'comic']);
window._editMode = false;
window._desktopSelectedLayoutItem = null;
let _editLongPressTimer = null;
let _desktopLayoutBackupHtml = '';
let _desktopDefaultLayoutHtml = '';
let _desktopDockBackupHtml = '';
let _desktopPage2CustomBackup = null;
let _desktopFoldersBackup = null;
let _desktopDefaultDockHtml = '';
let _desktopLongPressStart = null;
let _desktopLongPressTriggered = false;
let _desktopLongPressActive = false;
let _desktopLayoutApplied = false;
let _desktopLayoutNeedsVisiblePersist = false;
let _desktopDefaultPrincessDeletedBackup = null;
let _desktopDefaultLovelyDeletedBackup = null;
let _desktopStickyNotesBackup = null;
let _desktopLovelyPrefsBackup = null;
let _desktopStatusBattery = null;
let _desktopStatusBatteryBound = false;

function getDesktopPointerPoint(e) {
    const touch = e && e.touches && e.touches[0];
    const changedTouch = e && e.changedTouches && e.changedTouches[0];
    const point = touch || changedTouch || e || {};
    return {
        x: Number(point.clientX) || 0,
        y: Number(point.clientY) || 0
    };
}

function getDesktopEditScale() {
    const home = document.getElementById('home-screen');
    if (!home || !home.classList.contains('desktop-editing')) return 1;
    const scale = parseFloat(getComputedStyle(home).getPropertyValue('--desktop-edit-scale'));
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function getDesktopPageIndex(page) {
    const pages = Array.from(document.querySelectorAll('#pages-container .desktop-page'));
    return Math.max(0, pages.indexOf(page));
}

function getDesktopItemId(el) {
    if (el.dataset.layoutId) return el.dataset.layoutId;
    if (el.classList.contains('calendar-widget')) return 'widget-calendar';
    if (el.classList.contains('photo-large')) {
        if (el.querySelector('.desktop-img-1')) return 'widget-photo-1';
        if (el.querySelector('.desktop-img-2')) return 'widget-photo-2';
        const idx = Array.from(document.querySelectorAll('.photo-large')).indexOf(el);
        if (idx >= 0) return `widget-photo-${idx + 1}`;
        return 'widget-photo-' + Date.now();
    }
    if (el.classList.contains('app-item')) {
        if (el.classList.contains('is-folder') && el.dataset.folderId) return `folder-${el.dataset.folderId}`;
        if (el.dataset.appId) return `app-${el.dataset.appId}`;
        const onclick = el.getAttribute('onclick') || '';
        const match = onclick.match(/openApp\('([^']+)'\)/);
        if (match) return 'app-' + match[1];
        const label = el.querySelector('span')?.textContent?.trim() || Date.now();
        return 'app-custom-' + label;
    }
    return 'item-' + Date.now();
}

function isDesktopStaticPage2AppLayoutId(id) {
    return DESKTOP_STATIC_PAGE2_APP_LAYOUT_IDS.has(String(id || ''));
}

function findDesktopBuiltinElement(id) {
    if (id === 'widget-calendar') return document.querySelector('.calendar-widget');
    if (id === 'widget-photo-1') return document.querySelector('.desktop-img-1')?.closest('.photo-large') || document.querySelectorAll('.photo-large')[0];
    if (id === 'widget-photo-2') return document.querySelector('.desktop-img-2')?.closest('.photo-large') || document.querySelectorAll('.photo-large')[1];
    if (id.startsWith('folder-')) {
        const folderId = id.slice(7);
        const folder = window._folders.find(f => f.id === folderId);
        return folder ? createDesktopFolderElement(folder) : null;
    }
    if (id.startsWith('app-')) {
        const appId = id.slice(4);
        const app = getDesktopAnyAppDefinition(appId);
        if (app) return createDesktopAppElement(app);
        return Array.from(document.querySelectorAll('.app-item')).find(item => {
            const onclick = item.getAttribute('onclick') || '';
            return onclick.includes(`openApp('${appId}')`);
        });
    }
    return null;
}

function getDesktopBuiltinElementById(id) {
    if (id === 'widget-calendar') return document.querySelector('.calendar-widget');
    if (id === 'widget-photo-1') return document.querySelector('.desktop-img-1')?.closest('.photo-large') || null;
    if (id === 'widget-photo-2') return document.querySelector('.desktop-img-2')?.closest('.photo-large') || null;
    return null;
}

function removeDesktopBuiltinElementById(id) {
    const item = getDesktopBuiltinElementById(id) || document.querySelector(`.desktop-layout-item[data-layout-id="${CSS.escape(String(id || ''))}"]`);
    if (!item) return false;
    item.remove();
    return true;
}

function collectDesktopDeletedBuiltinIds() {
    return Array.from(DESKTOP_DELETABLE_BUILTIN_IDS).filter(id => !getDesktopBuiltinElementById(id));
}

function normalizeDesktopLayoutRect(item, pageArea) {
    const areaRect = pageArea.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    return {
        left: Math.max(8, rect.left - areaRect.left + pageArea.scrollLeft),
        top: Math.max(8, rect.top - areaRect.top + pageArea.scrollTop),
        width: Math.max(54, rect.width),
        height: Math.max(58, rect.height)
    };
}

function prepareDesktopLayoutItem(item, pageArea, rect) {
    if (!item || !pageArea) return;
    const id = getDesktopItemId(item);
    const safeRect = clampDesktopLayoutRect(projectDesktopLayoutRect(rect, pageArea.clientWidth), pageArea);
    if (pageArea.clientWidth > 0) pageArea._byndLayoutWidth = pageArea.clientWidth;
    else if (rect.canvasWidth > 0) pageArea._byndLayoutWidth = rect.canvasWidth;
    item.dataset.layoutId = id;
    item.dataset.layoutType = item.dataset.layoutType || (id.startsWith('app-') ? 'app' : 'builtin');
    item.classList.add('desktop-layout-item');
    if (item.classList.contains('app-item')) {
        item.classList.add('layout-app');
        item.setAttribute('draggable', 'false');
    }
    pageArea.classList.add('layout-canvas');
    if (item.parentElement !== pageArea) pageArea.appendChild(item);
    item.style.left = `${Math.round(safeRect.left)}px`;
    item.style.top = `${Math.round(safeRect.top)}px`;
    item.style.width = `${Math.round(safeRect.width)}px`;
    item.style.height = `${Math.round(safeRect.height)}px`;
    setupDesktopLayoutItem(item);
}

function projectDesktopLayoutRect(rect, canvasWidth) {
    const oldWidth = Number(rect.canvasWidth);
    if (!(oldWidth > 0 && canvasWidth > 0) || Math.abs(oldWidth - canvasWidth) < 1) return rect;
    const ratio = canvasWidth / oldWidth;
    const isApp = rect.type === 'app' || String(rect.id || '').startsWith('app-');
    const width = isApp ? rect.width : rect.width * ratio;
    return { ...rect, left: (rect.left + rect.width / 2) * ratio - width / 2, width, canvasWidth };
}

function inferDesktopLegacyCanvasWidth(records, currentWidth) {
    // Older layouts saved only pixel coordinates. A broad, symmetrically placed
    // widget is evidence of the original canvas; leave sparse layouts untouched.
    const anchor = records.find(record => /^widget-(calendar|photo-\d+)$/.test(String(record.id || '')) && record.width >= 260 && record.left >= 8 && record.left <= 40);
    if (!anchor) return currentWidth;
    const width = anchor.width + anchor.left * 2;
    return records.every(record => record.left + record.width <= width) ? width : currentWidth;
}

function clampDesktopLayoutRect(rect, pageArea) {
    const source = rect || {};
    const hasMeasuredBounds = hasDesktopUsableLayoutBounds(pageArea);
    const areaWidth = Math.max(260, hasMeasuredBounds ? pageArea.clientWidth : 375);
    const areaHeight = Math.max(520, hasMeasuredBounds ? pageArea.clientHeight : 590);
    const minWidth = Math.min(220, Math.max(54, Number(source.width) || 96));
    const minHeight = Math.min(140, Math.max(58, Number(source.height) || 96));
    const width = hasMeasuredBounds
        ? Math.max(54, Math.min(areaWidth - 16, Number(source.width) || minWidth))
        : Math.max(54, Number(source.width) || minWidth);
    const height = hasMeasuredBounds
        ? Math.max(58, Math.min(areaHeight - 16, Number(source.height) || minHeight))
        : Math.max(58, Number(source.height) || minHeight);
    const left = Number(source.left);
    const top = Number(source.top);
    return {
        left: hasMeasuredBounds
            ? Math.max(8, Math.min(areaWidth - width - 8, Number.isFinite(left) ? left : 8))
            : Math.max(8, Number.isFinite(left) ? left : 8),
        top: hasMeasuredBounds
            ? Math.max(8, Math.min(areaHeight - height - 8, Number.isFinite(top) ? top : 8))
            : Math.max(8, Number.isFinite(top) ? top : 8),
        width,
        height
    };
}

function hasDesktopUsableLayoutBounds(pageArea) {
    return !!(pageArea && pageArea.clientWidth > 0 && pageArea.clientHeight > 0);
}

function getDesktopRawStyleRect(item, fallback = {}) {
    if (!item) return null;
    const styleLeft = parseFloat(item.style.left);
    const styleTop = parseFloat(item.style.top);
    const styleWidth = parseFloat(item.style.width);
    const styleHeight = parseFloat(item.style.height);
    return {
        left: Number.isFinite(styleLeft) ? styleLeft : (Number(fallback.left) || item.offsetLeft || 0),
        top: Number.isFinite(styleTop) ? styleTop : (Number(fallback.top) || item.offsetTop || 0),
        width: Number.isFinite(styleWidth) && styleWidth > 0 ? styleWidth : (item.offsetWidth || Number(fallback.width) || 72),
        height: Number.isFinite(styleHeight) && styleHeight > 0 ? styleHeight : (item.offsetHeight || Number(fallback.height) || 82)
    };
}

function desktopRectsDiffer(a, b, tolerance = 1) {
    if (!a || !b) return false;
    return Math.abs((a.left || 0) - (b.left || 0)) > tolerance
        || Math.abs((a.top || 0) - (b.top || 0)) > tolerance
        || Math.abs((a.width || 0) - (b.width || 0)) > tolerance
        || Math.abs((a.height || 0) - (b.height || 0)) > tolerance;
}

function setDesktopLayoutItemRect(item, rect) {
    if (!item || !rect) return false;
    const current = getDesktopRawStyleRect(item);
    if (!desktopRectsDiffer(current, rect)) return false;
    item.style.left = `${Math.round(rect.left)}px`;
    item.style.top = `${Math.round(rect.top)}px`;
    item.style.width = `${Math.round(rect.width)}px`;
    item.style.height = `${Math.round(rect.height)}px`;
    return true;
}

function getDesktopDirectLayoutItems(pageArea) {
    const items = [];
    pageArea.querySelectorAll(':scope > .calendar-widget, :scope > .photo-large, :scope > .app-item, :scope > .desktop-custom-widget').forEach(item => items.push(item));
    pageArea.querySelectorAll(':scope > .bento-box > .photo-large, :scope > .bento-box > .apps-quad > .app-item').forEach(item => items.push(item));
    pageArea.querySelectorAll(':scope > .page2-app-grid > .app-item').forEach(item => items.push(item));
    return items.filter((item, index, arr) => (
        arr.indexOf(item) === index
        && !item.classList.contains('layout-source-hidden')
        && !item.closest('.layout-source-hidden')
    ));
}

function materializeDesktopPage(page) {
    const pageArea = page.querySelector('.desktop-scroll-area');
    if (!pageArea) return;
    pageArea.scrollTop = 0;
    pageArea.scrollLeft = 0;
    const items = getDesktopDirectLayoutItems(pageArea);
    const snapshots = items.map(item => ({
        item,
        rect: normalizeDesktopLayoutRect(item, pageArea)
    }));
    snapshots.forEach(({ item, rect }) => prepareDesktopLayoutItem(item, pageArea, rect));
    page.querySelectorAll('.bento-box, .page2-app-grid, .desktop-empty-placeholder').forEach(el => el.classList.add('layout-source-hidden'));
}

function materializeExistingDesktopForLayout() {
    document.querySelectorAll('#pages-container .desktop-page').forEach(materializeDesktopPage);
}

function getDesktopPages() {
    return Array.from(document.querySelectorAll('#pages-container .desktop-page'));
}

function createDesktopScreenPage(index) {
    const page = document.createElement('div');
    page.className = 'desktop-page';
    page.dataset.page = String(index);
    page.innerHTML = `
        <div class="desktop-scroll-area page-extra-content">
            <div class="desktop-empty-placeholder">
                <i class="ri-add-circle-line"></i>
                <span>第 ${index + 1} 屏</span>
                <small>长按编辑后可以把图标和组件放到这里。</small>
            </div>
        </div>
    `;
    return page;
}

function syncDesktopPagesAndDots(activeIndex) {
    const pages = getDesktopPages();
    pages.forEach((page, index) => { page.dataset.page = String(index); });
    const dots = document.getElementById('page-dots');
    if (dots) {
        dots.innerHTML = pages.map((_, index) => `<div class="page-dot ${index === activeIndex ? 'active' : ''}"></div>`).join('');
    }
}

function ensureDesktopPage(index) {
    const container = document.getElementById('pages-container');
    if (!container) return null;
    let pages = getDesktopPages();
    while (pages.length <= index) {
        const page = createDesktopScreenPage(pages.length);
        container.appendChild(page);
        pages.push(page);
    }
    syncDesktopPagesAndDots(Math.min(index, pages.length - 1));
    return pages[index] || null;
}

function setupDesktopLayoutItem(item) {
    if (item._layoutReady) return;
    item._layoutReady = true;
    item.dataset.layoutReady = '1';
    if (item.classList.contains('layout-app') && !item.classList.contains('is-folder')) {
        item.onclick = null;
        item.removeAttribute('onclick');
    }
    item.addEventListener('pointerdown', startDesktopItemDrag);
    item.addEventListener('click', (e) => {
        if (e.target.closest('.desktop-resize-handle, .desktop-item-center, .desktop-item-move-page, .desktop-item-delete, .pw-note, .dsw-avatar, .dsw-avatar-input, .dsw-weather, .dsw-steps, .lcw-control, .lcw-input')) return;
        if (item.classList.contains('is-folder') && item.dataset.folderId && !item.dataset.desktopDragMoved) {
            e.preventDefault();
            e.stopPropagation();
            openFolder(item.dataset.folderId);
            return;
        }
        if (!window._editMode) return;
        e.preventDefault();
        e.stopPropagation();
        selectDesktopLayoutItem(item);
    }, true);
    item.addEventListener('click', (e) => {
        if (window._editMode) return;
        if (e.defaultPrevented) return;
        if (item.classList.contains('is-folder')) return;
        const appId = getDesktopAppIdFromElement(item);
        if (!appId) return;
        e.preventDefault();
        e.stopPropagation();
        openApp(appId);
    });
}

function addDesktopItemControls(item) {
    item.querySelectorAll(':scope > .desktop-resize-handle, :scope > .desktop-item-center, :scope > .desktop-item-move-page, :scope > .desktop-item-delete').forEach(el => el.remove());
    if (!item.classList.contains('layout-app') || item.classList.contains('is-folder')) {
        const resize = document.createElement('div');
        resize.className = 'desktop-resize-handle';
        resize.setAttribute('role', 'button');
        resize.setAttribute('aria-label', '拖动缩放组件');
        resize.innerHTML = '<i class="ri-expand-diagonal-line" aria-hidden="true"></i><span>缩放</span>';
        resize.addEventListener('pointerdown', startDesktopItemResize);
        item.appendChild(resize);
    }
    const move = document.createElement('button');
    move.type = 'button';
    move.className = 'desktop-item-move-page';
    move.textContent = '换屏';
    move.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        moveSelectedDesktopItemToOtherPage();
    });
    item.appendChild(move);
    if (!item.classList.contains('layout-app')) {
        const center = document.createElement('button');
        center.type = 'button';
        center.className = 'desktop-item-center';
        center.textContent = '居中';
        center.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            centerSelectedDesktopItem();
        });
        item.appendChild(center);
    }
    if (item.dataset.layoutType === 'custom' || DESKTOP_DELETABLE_BUILTIN_IDS.has(item.dataset.layoutId || '')) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'desktop-item-delete';
        del.innerHTML = '<span aria-hidden="true">×</span>';
        del.setAttribute('aria-label', '删除组件');
        del.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteSelectedDesktopLayoutItem();
        });
        item.appendChild(del);
    }
}

function selectDesktopLayoutItem(item) {
    document.querySelectorAll('.desktop-layout-item.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.dock-item.selected').forEach(el => el.classList.remove('selected'));
    window._desktopSelectedLayoutItem = item;
    item.classList.add('selected');
    if (item.classList.contains('desktop-layout-item')) addDesktopItemControls(item);
}

function getDesktopLayoutItemAppRef(item) {
    if (!item || !item.classList.contains('layout-app')) return null;
    if (item.classList.contains('is-folder')) return null;
    const appId = item.dataset.appId || String(item.dataset.layoutId || '').replace(/^app-/, '');
    return getDesktopAnyAppDefinition(appId);
}

function getDesktopRectOverlapScore(sourceRect, targetRect) {
    const left = Math.max(sourceRect.left, targetRect.left);
    const right = Math.min(sourceRect.right, targetRect.right);
    const top = Math.max(sourceRect.top, targetRect.top);
    const bottom = Math.min(sourceRect.bottom, targetRect.bottom);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    const sourceArea = Math.max(1, sourceRect.width * sourceRect.height);
    return (width * height) / sourceArea;
}

function getDesktopFolderMergeHitRect(target) {
    const rect = target?.querySelector?.('.app-icon')?.getBoundingClientRect?.()
        || target?.getBoundingClientRect?.();
    if (!rect) return null;
    const inset = Math.max(4, Math.min(rect.width || 0, rect.height || 0) * 0.14);
    return {
        left: rect.left + inset,
        right: rect.right - inset,
        top: rect.top + inset,
        bottom: rect.bottom - inset,
        width: Math.max(1, rect.width - inset * 2),
        height: Math.max(1, rect.height - inset * 2)
    };
}

function isDesktopPointInsideRect(point, rect, pad = 0) {
    if (!point || !rect) return false;
    return point.x >= rect.left - pad
        && point.x <= rect.right + pad
        && point.y >= rect.top - pad
        && point.y <= rect.bottom + pad;
}

function findDesktopFolderMergeTarget(item, pageArea, point) {
    if (!item || !pageArea || !item.classList.contains('layout-app') || item.classList.contains('is-folder')) return null;
    const itemRect = item.getBoundingClientRect();
    const itemCenter = {
        x: point?.x ?? (itemRect.left + itemRect.width / 2),
        y: point?.y ?? (itemRect.top + itemRect.height / 2)
    };
    const candidates = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item.layout-app')).filter(target => target !== item);
    const centered = candidates.find(target => isDesktopPointInsideRect(itemCenter, getDesktopFolderMergeHitRect(target), 5));
    if (centered) return centered;
    if (point) return null;
    const sourceIconRect = item.querySelector?.('.app-icon')?.getBoundingClientRect?.() || itemRect;
    const scored = candidates.map(target => ({
        target,
        score: getDesktopRectOverlapScore(sourceIconRect, getDesktopFolderMergeHitRect(target) || target.getBoundingClientRect())
    })).filter(entry => entry.score >= 0.52)
      .sort((a, b) => b.score - a.score);
    return scored[0]?.target || null;
}

function findDesktopDockFolderMergeTarget(pageArea, point, sourceAppId) {
    if (!pageArea || !point) return null;
    const candidates = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item.layout-app')).filter(target => {
        if (!target) return false;
        const targetAppId = getDesktopAppIdFromElement(target);
        return !targetAppId || targetAppId !== sourceAppId;
    });
    const centered = candidates.find(target => isDesktopPointInsideRect(point, getDesktopFolderMergeHitRect(target), 5));
    if (centered) return centered;
    return candidates.map(target => {
        const rect = getDesktopFolderMergeHitRect(target) || target.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return {
            target,
            distance: Math.hypot(point.x - centerX, point.y - centerY),
            limit: Math.max(rect.width, rect.height) * 0.42
        };
    }).filter(entry => entry.distance <= entry.limit)
      .sort((a, b) => a.distance - b.distance)[0]?.target || null;
}

function getDesktopOrderedSlotItems(pageArea, includeDraggedItem) {
    if (!pageArea) return [];
    return Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item.layout-app'))
        .filter(item => includeDraggedItem || !item.classList.contains('desktop-slot-dragging'))
        .sort((a, b) => {
            const aSlot = Number(a.dataset.desktopSlot);
            const bSlot = Number(b.dataset.desktopSlot);
            const aHasSlot = Number.isFinite(aSlot);
            const bHasSlot = Number.isFinite(bSlot);
            if (aHasSlot && bHasSlot && aSlot !== bSlot) return aSlot - bSlot;
            const at = parseFloat(a.style.top) || a.offsetTop || 0;
            const bt = parseFloat(b.style.top) || b.offsetTop || 0;
            if (Math.abs(at - bt) > 12) return at - bt;
            return (parseFloat(a.style.left) || a.offsetLeft || 0) - (parseFloat(b.style.left) || b.offsetLeft || 0);
        });
}

function getDesktopFallbackSlotMetrics(pageArea) {
    const width = Math.max(300, pageArea?.clientWidth || 375);
    const iconWidth = 72;
    const iconHeight = 82;
    const columns = Math.max(3, Math.min(4, Math.floor((width - 34) / iconWidth)));
    const gapX = columns > 1 ? Math.max(10, Math.floor((width - (columns * iconWidth) - 24) / (columns - 1))) : 12;
    const startX = Math.max(12, Math.round((width - (columns * iconWidth + gapX * (columns - 1))) / 2));
    return {
        columns,
        iconWidth,
        iconHeight,
        startX,
        startY: 18,
        gapX,
        gapY: 18
    };
}

function getDesktopFourColumnAppGridMetrics(pageArea) {
    const width = Math.max(300, pageArea?.clientWidth || 375);
    const columns = 4;
    const iconWidth = Math.min(72, Math.floor((width - 24) / columns));
    const iconHeight = 82;
    const gapX = Math.max(0, (width - iconWidth * columns - 24) / (columns - 1));
    const startX = Math.max(8, (width - (iconWidth * columns + gapX * (columns - 1))) / 2);
    return { columns, iconWidth, iconHeight, gapX, gapY: 18, startX, startY: 18 };
}

function normalizeSecondPageAppGrid(pageArea) {
    if (!pageArea || getDesktopPageIndex(pageArea.closest('.desktop-page')) !== 1 || !hasDesktopUsableLayoutBounds(pageArea)) return false;
    try { if (localStorage.getItem('bynd_desktop_page2_custom_v1') === '1') return false; } catch (_) {}
    const apps = getDesktopOrderedSlotItems(pageArea, true);
    const appIds = apps.map(item => getDesktopAppIdFromElement(item));
    const originalGrid = apps.length === DESKTOP_PAGE2_APP_IDS.size - 1
        && new Set(appIds).size === apps.length
        && appIds.every(id => DESKTOP_PAGE2_APP_IDS.has(id) && id !== 'comic');
    const comicGrid = apps.length === DESKTOP_PAGE2_APP_IDS.size && pageArea.dataset.comicAutoLayout === '1'
        && new Set(appIds).size === apps.length
        && appIds.every(id => DESKTOP_PAGE2_APP_IDS.has(id));
    if (!originalGrid && !comicGrid) return false;
    const orderedApps = comicGrid
        ? [
            ...apps.filter(item => !['pet', 'comic'].includes(getDesktopAppIdFromElement(item))),
            apps.find(item => getDesktopAppIdFromElement(item) === 'pet'),
            apps.find(item => getDesktopAppIdFromElement(item) === 'comic')
        ]
        : apps;

    const metrics = getDesktopFourColumnAppGridMetrics(pageArea);
    const widgets = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item:not(.layout-app)'));
    const widgetBottom = widgets.reduce((bottom, widget) => {
        const rect = getDesktopStyleRect(widget, pageArea);
        return Math.max(bottom, rect ? rect.top + rect.height : 0);
    }, 0);
    const rows = Math.ceil(orderedApps.length / metrics.columns);
    const areaHeight = Math.max(520, pageArea.clientHeight || 590);
    const requiredHeight = rows * metrics.iconHeight + (rows - 1) * metrics.gapY;
    const maxStartY = Math.max(metrics.startY, areaHeight - requiredHeight - 8);
    const startY = Math.min(Math.max(metrics.startY, widgetBottom + 18), maxStartY);
    let changed = false;

    orderedApps.forEach((item, index) => {
        const column = index % metrics.columns;
        const row = Math.floor(index / metrics.columns);
        const rect = {
            left: metrics.startX + column * (metrics.iconWidth + metrics.gapX),
            top: startY + row * (metrics.iconHeight + metrics.gapY),
            width: metrics.iconWidth,
            height: metrics.iconHeight
        };
        item.dataset.desktopSlot = String(index);
        if (setDesktopLayoutItemRect(item, rect)) changed = true;
    });
    if (comicGrid) delete pageArea.dataset.comicAutoLayout;
    if (changed) captureDesktopPageSlotRects(pageArea);
    return changed;
}

function getDesktopFlowSlotRects(pageArea) {
    if (!pageArea) return [];
    const metrics = getDesktopFallbackSlotMetrics(pageArea);
    const areaHeight = Math.max(520, pageArea.clientHeight || 590);
    const maxTop = Math.max(metrics.startY, areaHeight - metrics.iconHeight - 8);
    const maxRows = Math.max(1, Math.floor((maxTop - metrics.startY) / (metrics.iconHeight + metrics.gapY)) + 1);
    const widgetRects = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item:not(.layout-app)'))
        .map(item => getDesktopStyleRect(item, pageArea))
        .filter(Boolean);
    const obstacles = widgetRects.map(rect => ({
        left: rect.left - 8,
        top: rect.top - 12,
        width: rect.width + 16,
        height: rect.height + 20
    }));
    const slots = [];
    const seen = new Set();
    const pushSlot = rect => {
        const safe = clampDesktopLayoutRect(rect, pageArea);
        const key = `${Math.round(safe.left)}:${Math.round(safe.top)}`;
        if (seen.has(key)) return;
        const iconCoreRect = {
            left: safe.left + 8,
            top: safe.top + 4,
            width: Math.max(36, safe.width - 16),
            height: Math.max(48, safe.height - 18)
        };
        const blocked = obstacles.some(obstacle => (
            getDesktopRectIntersectionRatio(safe, obstacle) > 0.52
            || getDesktopRectIntersectionRatio(iconCoreRect, obstacle) > 0.18
        ));
        if (blocked) return;
        seen.add(key);
        slots.push(safe);
    };
    for (let row = 0; row < maxRows; row += 1) {
        for (let col = 0; col < metrics.columns; col += 1) {
            const top = metrics.startY + row * (metrics.iconHeight + metrics.gapY);
            if (top > maxTop + 1) continue;
            pushSlot({
                left: metrics.startX + col * (metrics.iconWidth + metrics.gapX),
                top,
                width: metrics.iconWidth,
                height: metrics.iconHeight
            });
        }
    }
    widgetRects.forEach(widget => {
        const edgeTops = [
            widget.top + widget.height + 8,
            widget.top - metrics.iconHeight - 8
        ];
        edgeTops.forEach(top => {
            if (top < metrics.startY - 1 || top > maxTop + 1) return;
            for (let col = 0; col < metrics.columns; col += 1) {
                pushSlot({
                    left: metrics.startX + col * (metrics.iconWidth + metrics.gapX),
                    top,
                    width: metrics.iconWidth,
                    height: metrics.iconHeight
                });
            }
        });
    });
    return slots.sort((a, b) => (a.top - b.top) || (a.left - b.left));
}

function getDesktopStableSlotRects(pageArea, items, flowSlots = []) {
    if (!pageArea) return [];
    const orderedItems = Array.isArray(items) ? items : [];
    const slots = [];
    const pushSlot = rect => {
        if (!rect) return;
        const safe = clampDesktopLayoutRect(rect, pageArea);
        const duplicate = slots.some(slot => (
            getDesktopRectIntersectionRatio(safe, slot) > 0.68
            || (
                Math.abs((safe.left + safe.width / 2) - (slot.left + slot.width / 2)) < 12
                && Math.abs((safe.top + safe.height / 2) - (slot.top + slot.height / 2)) < 12
            )
        ));
        if (!duplicate) slots.push(safe);
    };

    orderedItems
        .map(item => getDesktopStyleRect(item, pageArea))
        .filter(Boolean)
        .sort((a, b) => (a.top - b.top) || (a.left - b.left))
        .forEach(pushSlot);

    if (slots.length < orderedItems.length && Array.isArray(flowSlots)) {
        for (const slot of flowSlots) {
            if (slots.length >= orderedItems.length) break;
            pushSlot(slot);
        }
    }

    let fallbackIndex = 0;
    const fallbackLimit = Math.max(orderedItems.length + 12, 24);
    while (slots.length < orderedItems.length && fallbackIndex < fallbackLimit) {
        pushSlot(getDesktopFallbackSlotRect(pageArea, fallbackIndex));
        fallbackIndex += 1;
    }

    return slots;
}

function getDesktopCompactSlotRects(pageArea, items, flowSlots = []) {
    if (!pageArea) return [];
    const orderedItems = Array.isArray(items) ? items : [];
    const slots = [];
    const pushSlot = rect => {
        if (!rect || slots.length >= orderedItems.length) return;
        const safe = clampDesktopLayoutRect(rect, pageArea);
        const duplicate = slots.some(slot => (
            getDesktopRectIntersectionRatio(safe, slot) > 0.68
            || (
                Math.abs((safe.left + safe.width / 2) - (slot.left + slot.width / 2)) < 12
                && Math.abs((safe.top + safe.height / 2) - (slot.top + slot.height / 2)) < 12
            )
        ));
        if (!duplicate) slots.push(safe);
    };

    if (Array.isArray(flowSlots)) {
        flowSlots.forEach(pushSlot);
    }

    let fallbackIndex = 0;
    const fallbackLimit = Math.max(orderedItems.length + 12, 24);
    while (slots.length < orderedItems.length && fallbackIndex < fallbackLimit) {
        pushSlot(getDesktopFallbackSlotRect(pageArea, fallbackIndex));
        fallbackIndex += 1;
    }

    return slots;
}

function getNearestDesktopFlowSlotIndex(pageArea, item, slots, usedSlots = new Set(), preferredIndex = null) {
    if (!pageArea || !item || !Array.isArray(slots) || !slots.length) return 0;
    const preferred = Number(preferredIndex);
    if (Number.isFinite(preferred) && preferred >= 0 && preferred < slots.length && !usedSlots.has(preferred)) return preferred;
    const rect = getDesktopStyleRect(item, pageArea);
    if (!rect) return Math.max(0, slots.findIndex((_, index) => !usedSlots.has(index)));
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ranked = slots
        .map((slot, index) => ({
            index,
            distance: (cx - (slot.left + slot.width / 2)) ** 2 + (cy - (slot.top + slot.height / 2)) ** 2
        }))
        .filter(entry => !usedSlots.has(entry.index))
        .sort((a, b) => a.distance - b.distance);
    return ranked[0]?.index ?? 0;
}

function getDesktopFallbackSlotRect(pageArea, slotIndex, item) {
    const metrics = getDesktopFallbackSlotMetrics(pageArea);
    const index = Math.max(0, Number(slotIndex) || 0);
    const width = item?.offsetWidth || parseFloat(item?.style?.width) || metrics.iconWidth;
    const height = item?.offsetHeight || parseFloat(item?.style?.height) || metrics.iconHeight;
    const column = index % metrics.columns;
    const row = Math.floor(index / metrics.columns);
    return clampDesktopLayoutRect({
        left: metrics.startX + column * (metrics.iconWidth + metrics.gapX) + Math.round((metrics.iconWidth - width) / 2),
        top: metrics.startY + row * (metrics.iconHeight + metrics.gapY),
        width,
        height
    }, pageArea);
}

function captureDesktopPageSlotRects(pageArea, options = {}) {
    if (!pageArea) return [];
    const items = getDesktopOrderedSlotItems(pageArea, true);
    const flowSlots = getDesktopFlowSlotRects(pageArea);
    const slotRects = options.compact
        ? getDesktopCompactSlotRects(pageArea, items, flowSlots)
        : getDesktopStableSlotRects(pageArea, items, flowSlots);
    if (slotRects.length) {
        const usedSlots = new Set();
        items.forEach(item => {
            const index = options.compact
                ? usedSlots.size
                : getNearestDesktopFlowSlotIndex(pageArea, item, slotRects, usedSlots, null);
            usedSlots.add(index);
            item.dataset.desktopSlot = String(index);
        });
        pageArea._desktopSlotRects = slotRects;
        return slotRects;
    }
    const slots = items.map((item, index) => {
        const rect = clampDesktopLayoutRect({
            left: parseFloat(item.style.left) || item.offsetLeft || 0,
            top: parseFloat(item.style.top) || item.offsetTop || 0,
            width: item.offsetWidth || parseFloat(item.style.width) || 72,
            height: item.offsetHeight || parseFloat(item.style.height) || 82
        }, pageArea);
        item.dataset.desktopSlot = String(index);
        return rect;
    });
    pageArea._desktopSlotRects = slots;
    return slots;
}

function ensureDesktopPageSlotRects(pageArea) {
    if (!pageArea) return [];
    if (Array.isArray(pageArea._desktopSlotRects) && pageArea._desktopSlotRects.length) return pageArea._desktopSlotRects;
    return captureDesktopPageSlotRects(pageArea);
}

function clearDesktopPageSlotRects() {
    document.querySelectorAll('#pages-container .desktop-scroll-area').forEach(area => {
        delete area._desktopSlotRects;
    });
    document.querySelectorAll('.desktop-layout-item[data-desktop-nudged-by]').forEach(item => {
        delete item.dataset.desktopNudgedBy;
    });
}

function getDesktopSlotRect(pageArea, slotIndex, item) {
    const index = Math.max(0, Number(slotIndex) || 0);
    const slots = ensureDesktopPageSlotRects(pageArea);
    const slot = slots[index];
    if (!slot) return getDesktopFallbackSlotRect(pageArea, index, item);
    const width = item?.offsetWidth || parseFloat(item?.style?.width) || slot.width || 72;
    const height = item?.offsetHeight || parseFloat(item?.style?.height) || slot.height || 82;
    return clampDesktopLayoutRect({
        left: slot.left + Math.round(((slot.width || width) - width) / 2),
        top: slot.top + Math.round(((slot.height || height) - height) / 2),
        width,
        height
    }, pageArea);
}

function getDesktopSlotIndexFromPoint(pageArea, point, item) {
    const rect = pageArea.getBoundingClientRect();
    const scale = getDesktopEditScale();
    const x = (point.x - rect.left) / scale + (pageArea.scrollLeft || 0);
    const y = (point.y - rect.top) / scale + (pageArea.scrollTop || 0);
    const slots = ensureDesktopPageSlotRects(pageArea);
    const items = getDesktopOrderedSlotItems(pageArea, true);
    const reorderCount = Math.max(1, items.length + (item && !items.includes(item) ? 1 : 0));
    const maxIndex = Math.max(0, Math.min(slots.length || reorderCount, reorderCount) - 1);
    if (!slots.length) {
        const metrics = getDesktopFallbackSlotMetrics(pageArea);
        const column = Math.max(0, Math.min(metrics.columns - 1, Math.round((x - metrics.startX - metrics.iconWidth / 2) / (metrics.iconWidth + metrics.gapX))));
        const row = Math.max(0, Math.floor((y - metrics.startY + metrics.iconHeight / 2) / (metrics.iconHeight + metrics.gapY)));
        return Math.max(0, Math.min(maxIndex, row * metrics.columns + column));
    }
    let bestIndex = 0;
    let bestDistance = Infinity;
    slots.forEach((slot, index) => {
        const cx = slot.left + slot.width / 2;
        const cy = slot.top + slot.height / 2;
        const distance = (x - cx) ** 2 + (y - cy) ** 2;
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    });
    return Math.max(0, Math.min(maxIndex, bestIndex));
}

function applyDesktopSlotOrder(pageArea, draggedItem, targetIndex) {
    if (!pageArea || !draggedItem || !draggedItem.classList.contains('layout-app')) return;
    const slots = ensureDesktopPageSlotRects(pageArea);
    if (!slots.length) return;
    const items = getDesktopOrderedSlotItems(pageArea, true).filter(item => item !== draggedItem);
    const index = Math.max(0, Math.min(Number(targetIndex) || 0, Math.min(slots.length, items.length + 1) - 1));
    const orderedItems = [...items];
    orderedItems.splice(index, 0, draggedItem);
    orderedItems.forEach((item, slotIndex) => {
        if (slotIndex >= slots.length) return;
        item.dataset.desktopSlot = String(slotIndex);
        const rect = getDesktopSlotRect(pageArea, slotIndex, item);
        item.style.left = `${Math.round(rect.left)}px`;
        item.style.top = `${Math.round(rect.top)}px`;
        item.style.width = `${Math.round(rect.width)}px`;
        item.style.height = `${Math.round(rect.height)}px`;
    });
}

function normalizeDesktopLayoutAppSlotSize(item, pageArea) {
    if (!item || !pageArea || !item.classList.contains('layout-app') || item.classList.contains('is-folder')) return;
    const metrics = getDesktopFallbackSlotMetrics(pageArea);
    item.style.width = `${metrics.iconWidth}px`;
    item.style.height = `${metrics.iconHeight}px`;
}

function insertDesktopAppAtSlot(pageArea, item, targetIndex) {
    if (!pageArea || !item || !item.classList.contains('layout-app')) return;
    delete pageArea._desktopSlotRects;
    const slots = ensureDesktopPageSlotRects(pageArea);
    const existingItems = getDesktopOrderedSlotItems(pageArea, true).filter(entry => entry !== item);
    const index = Math.max(0, Math.min(Number(targetIndex) || 0, existingItems.length));
    const orderedItems = [...existingItems];
    orderedItems.splice(index, 0, item);
    const capacity = slots.length || orderedItems.length;
    const overflowItems = [];
    orderedItems.forEach((entry, slotIndex) => {
        if (slotIndex >= capacity) {
            overflowItems.push(entry);
            return;
        }
        normalizeDesktopLayoutAppSlotSize(entry, pageArea);
        entry.dataset.desktopSlot = String(slotIndex);
        const rect = getDesktopSlotRect(pageArea, slotIndex, entry);
        entry.style.left = `${Math.round(rect.left)}px`;
        entry.style.top = `${Math.round(rect.top)}px`;
        entry.style.width = `${Math.round(rect.width)}px`;
        entry.style.height = `${Math.round(rect.height)}px`;
    });
    if (overflowItems.length) {
        const currentPage = pageArea.closest('.desktop-page');
        const nextIndex = getDesktopPageIndex(currentPage) + 1;
        const nextArea = ensureDesktopPage(nextIndex)?.querySelector('.desktop-scroll-area');
        if (nextArea) {
            nextArea.classList.add('layout-canvas');
            nextArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
            overflowItems.forEach((entry, overflowIndex) => {
                nextArea.appendChild(entry);
                entry.classList.add('desktop-layout-item', 'layout-app');
                setupDesktopLayoutItem(entry);
                placeDesktopAppInFirstOpenSlot(entry, nextArea, overflowIndex);
            });
        }
    }
}

function compactDesktopSlotOrder(pageArea, excludedItem = null, options = {}) {
    if (!pageArea) return;
    delete pageArea._desktopSlotRects;
    if (options.compact) captureDesktopPageSlotRects(pageArea, { compact: true });
    getDesktopOrderedSlotItems(pageArea, true).filter(item => item !== excludedItem).forEach((item, index) => {
        item.dataset.desktopSlot = String(index);
        const rect = getDesktopSlotRect(pageArea, index, item);
        item.style.left = `${Math.round(rect.left)}px`;
        item.style.top = `${Math.round(rect.top)}px`;
        item.style.width = `${Math.round(rect.width)}px`;
        item.style.height = `${Math.round(rect.height)}px`;
    });
    repairDesktopAppOverlaps(pageArea);
}

function getDesktopStyleRect(item, pageArea) {
    if (!item || !pageArea) return null;
    return clampDesktopLayoutRect(getDesktopRawStyleRect(item), pageArea);
}

function getDesktopRectIntersectionRatio(a, b) {
    if (!a || !b) return 0;
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.left + a.width, b.left + b.width);
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.top + a.height, b.top + b.height);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    const area = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
    return (width * height) / area;
}

function scoreDesktopCandidateOverlap(candidate, pageArea, ignoreItems = []) {
    const ignored = new Set(ignoreItems.filter(Boolean));
    return Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item'))
        .filter(item => !ignored.has(item))
        .reduce((score, item) => {
            const rect = getDesktopStyleRect(item, pageArea);
            return Math.max(score, getDesktopRectIntersectionRatio(candidate, rect));
        }, 0);
}

function nudgeDesktopLayoutObstacles(dragItem, pageArea) {
    if (!dragItem || !pageArea || !dragItem.classList.contains('layout-app')) return false;
    const dragRect = getDesktopStyleRect(dragItem, pageArea);
    if (!dragRect) return false;
    const dragKey = dragItem.dataset.layoutId || 'dragging';
    const obstacles = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item:not(.layout-app)'));
    let hasObstacle = false;
    obstacles.forEach(obstacle => {
        const obstacleRect = getDesktopStyleRect(obstacle, pageArea);
        if (!obstacleRect) return;
        if (getDesktopRectIntersectionRatio(dragRect, obstacleRect) < 0.22) return;
        hasObstacle = true;
        if (obstacle.dataset.desktopNudgedBy === dragKey) return;
        const gap = 12;
        const attempts = [
            { ...obstacleRect, left: obstacleRect.left - dragRect.width - gap },
            { ...obstacleRect, left: obstacleRect.left + dragRect.width + gap },
            { ...obstacleRect, top: obstacleRect.top + dragRect.height + gap },
            { ...obstacleRect, top: obstacleRect.top - dragRect.height - gap }
        ].map(rect => clampDesktopLayoutRect(rect, pageArea));
        const best = attempts
            .map(rect => ({
                rect,
                score: Math.max(
                    getDesktopRectIntersectionRatio(rect, dragRect),
                    scoreDesktopCandidateOverlap(rect, pageArea, [dragItem, obstacle])
                )
            }))
            .sort((a, b) => a.score - b.score)[0];
        if (!best || best.score > 0.42) return;
        obstacle.dataset.desktopNudgedBy = dragKey;
        obstacle.style.left = `${Math.round(best.rect.left)}px`;
        obstacle.style.top = `${Math.round(best.rect.top)}px`;
        obstacle.style.width = `${Math.round(best.rect.width)}px`;
        obstacle.style.height = `${Math.round(best.rect.height)}px`;
    });
    return hasObstacle;
}

function findDesktopOpenAppRect(pageArea, item, preferredRect) {
    if (!pageArea || !item) return preferredRect || null;
    const metrics = getDesktopFallbackSlotMetrics(pageArea);
    const width = item.offsetWidth || parseFloat(item.style.width) || metrics.iconWidth;
    const height = item.offsetHeight || parseFloat(item.style.height) || metrics.iconHeight;
    const flowSlots = getDesktopFlowSlotRects(pageArea);
    const candidates = flowSlots.map(slot => clampDesktopLayoutRect({
        left: slot.left + Math.round(((slot.width || width) - width) / 2),
        top: slot.top + Math.round(((slot.height || height) - height) / 2),
        width,
        height
    }, pageArea));
    if (!candidates.length) {
        const areaHeight = Math.max(520, pageArea.clientHeight || 590);
        const maxTop = Math.max(metrics.startY, areaHeight - metrics.iconHeight - 8);
        const maxRows = Math.max(1, Math.floor((maxTop - metrics.startY) / (metrics.iconHeight + metrics.gapY)) + 1);
        for (let row = 0; row < maxRows; row += 1) {
            for (let col = 0; col < metrics.columns; col += 1) {
                candidates.push(clampDesktopLayoutRect({
                    left: metrics.startX + col * (metrics.iconWidth + metrics.gapX) + Math.round((metrics.iconWidth - width) / 2),
                    top: metrics.startY + row * (metrics.iconHeight + metrics.gapY),
                    width,
                    height
                }, pageArea));
            }
        }
    }
    const source = preferredRect || getDesktopStyleRect(item, pageArea) || candidates[0];
    const scored = candidates.map(rect => ({
        rect,
        overlap: scoreDesktopCandidateOverlap(rect, pageArea, [item]),
        distance: source ? Math.abs(rect.left - source.left) + Math.abs(rect.top - source.top) : 0
    })).sort((a, b) => (a.overlap - b.overlap) || (a.distance - b.distance));
    return (scored.find(entry => entry.overlap < 0.16) || scored[0])?.rect || source;
}

function desktopAppRectsHaveClearance(a, b) {
    if (!a || !b) return true;
    return a.left + a.width + 6 <= b.left
        || b.left + b.width + 6 <= a.left
        || a.top + a.height + 8 <= b.top
        || b.top + b.height + 8 <= a.top;
}

function findDesktopComicBesidePetRect(pageArea, comic) {
    if (!pageArea || !comic) return null;
    const apps = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item.layout-app'))
        .filter(item => item !== comic);
    const pet = apps.find(item => getDesktopAppIdFromElement(item) === 'pet');
    const petRect = getDesktopStyleRect(pet, pageArea);
    if (!petRect) return null;
    const appRects = apps.map(item => getDesktopStyleRect(item, pageArea)).filter(Boolean);
    const columns = [];
    appRects.map(rect => rect.left).sort((a, b) => a - b).forEach(left => {
        if (!columns.some(value => Math.abs(value - left) < 16)) columns.push(left);
    });
    const petColumn = columns.findIndex(left => Math.abs(left - petRect.left) < 16);
    if (petColumn < 0) return null;
    const widgets = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item:not(.layout-app)'))
        .map(item => getDesktopStyleRect(item, pageArea))
        .filter(rect => rect && getDesktopRectIntersectionRatio(rect, petRect) < 0.12);
    const width = parseFloat(comic.style.width) || petRect.width;
    const height = parseFloat(comic.style.height) || petRect.height;
    for (const left of columns.slice(petColumn + 1)) {
        const rect = clampDesktopLayoutRect({ left, top: petRect.top, width, height }, pageArea);
        if (appRects.every(other => desktopAppRectsHaveClearance(rect, other))
            && widgets.every(other => desktopAppRectsHaveClearance(rect, other))) return rect;
    }
    return null;
}

function getDesktopComicProvisionalPetRect(pageArea, comic) {
    const apps = Array.from(pageArea?.querySelectorAll(':scope > .desktop-layout-item.layout-app') || []);
    const pet = apps.find(item => getDesktopAppIdFromElement(item) === 'pet');
    const petRect = getDesktopStyleRect(pet, pageArea);
    if (!petRect) return null;
    const nextColumn = apps.map(item => getDesktopStyleRect(item, pageArea)?.left)
        .filter(left => Number.isFinite(left) && left > petRect.left + 16)
        .sort((a, b) => a - b)[0];
    const metrics = getDesktopFourColumnAppGridMetrics(pageArea);
    return clampDesktopLayoutRect({
        left: nextColumn ?? petRect.left + petRect.width + metrics.gapX,
        top: petRect.top,
        width: parseFloat(comic.style.width) || petRect.width,
        height: parseFloat(comic.style.height) || petRect.height
    }, pageArea);
}

function findDesktopComicClearRect(pageArea, item, preferredRect) {
    if (!pageArea || !item) return null;
    const metrics = getDesktopFallbackSlotMetrics(pageArea);
    const width = preferredRect?.width || parseFloat(item.style.width) || metrics.iconWidth;
    const height = preferredRect?.height || parseFloat(item.style.height) || metrics.iconHeight;
    const occupied = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item'))
        .filter(other => other !== item)
        .map(other => getDesktopStyleRect(other, pageArea))
        .filter(Boolean);
    const clear = rect => occupied.every(other => desktopAppRectsHaveClearance(rect, other));
    const preferred = preferredRect && clampDesktopLayoutRect(preferredRect, pageArea);
    if (preferred && clear(preferred)) return preferred;
    const besidePet = findDesktopComicBesidePetRect(pageArea, item);
    if (besidePet) return besidePet;
    const slots = getDesktopFlowSlotRects(pageArea)
        .map(slot => clampDesktopLayoutRect({
            left: slot.left + Math.round((slot.width - width) / 2),
            top: slot.top + Math.round((slot.height - height) / 2),
            width,
            height
        }, pageArea))
        .filter(clear)
        .sort((a, b) => {
            if (!preferred) return (a.top - b.top) || (a.left - b.left);
            const distance = rect => Math.abs(rect.left - preferred.left) + Math.abs(rect.top - preferred.top);
            return (distance(a) - distance(b)) || (a.top - b.top) || (a.left - b.left);
        });
    return slots[0] || null;
}

function repairDesktopComicOverlap(pageArea) {
    if (!pageArea || !hasDesktopUsableLayoutBounds(pageArea)) return false;
    const comic = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item.layout-app'))
        .find(item => getDesktopAppIdFromElement(item) === 'comic');
    if (!comic) return false;
    const current = getDesktopStyleRect(comic, pageArea);
    let clear = findDesktopComicClearRect(pageArea, comic, current);
    if (!clear && getDesktopPageIndex(pageArea.closest('.desktop-page')) === 1) {
        const apps = getDesktopOrderedSlotItems(pageArea, true);
        if (apps.length === DESKTOP_PAGE2_APP_IDS.size
            && apps.every(item => DESKTOP_PAGE2_APP_IDS.has(getDesktopAppIdFromElement(item)))) {
            pageArea.dataset.comicAutoLayout = '1';
            normalizeSecondPageAppGrid(pageArea);
            clear = findDesktopComicClearRect(pageArea, comic, getDesktopStyleRect(comic, pageArea));
        }
    }
    if (clear && !desktopRectsDiffer(current, clear, 0.1)) return false;
    if (clear) {
        setDesktopLayoutItemRect(comic, clear);
        captureDesktopPageSlotRects(pageArea);
        return true;
    }
    const nextArea = ensureDesktopPage(getDesktopPageIndex(pageArea.closest('.desktop-page')) + 1)?.querySelector('.desktop-scroll-area');
    if (!nextArea) return false;
    const nextRect = findDesktopComicClearRect(nextArea, comic, null);
    if (!nextRect) return false;
    prepareDesktopLayoutItem(comic, nextArea, nextRect);
    captureDesktopPageSlotRects(pageArea);
    captureDesktopPageSlotRects(nextArea);
    return true;
}

function repairDesktopAppOverlaps(pageArea) {
    if (!pageArea || !hasDesktopUsableLayoutBounds(pageArea)) return false;
    const items = getDesktopOrderedSlotItems(pageArea, true);
    const placed = [];
    let changed = false;
    items.forEach(item => {
        let rect = getDesktopStyleRect(item, pageArea);
        const overlapsPlaced = placed.some(entry => getDesktopRectIntersectionRatio(rect, entry.rect) > 0.08);
        const overlapsWidget = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item:not(.layout-app)'))
            .some(widget => getDesktopRectIntersectionRatio(rect, getDesktopStyleRect(widget, pageArea)) > 0.34);
        if (overlapsPlaced || overlapsWidget) {
            rect = findDesktopOpenAppRect(pageArea, item, rect);
            item.style.left = `${Math.round(rect.left)}px`;
            item.style.top = `${Math.round(rect.top)}px`;
            item.style.width = `${Math.round(rect.width)}px`;
            item.style.height = `${Math.round(rect.height)}px`;
            changed = true;
        }
        placed.push({ item, rect });
    });
    if (changed) captureDesktopPageSlotRects(pageArea);
    return changed;
}

function repairDesktopWidgetOverlaps(pageArea) {
    if (!pageArea || !hasDesktopUsableLayoutBounds(pageArea)) return false;
    const items = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item:not(.layout-app)'))
        .sort((a, b) => {
            const ar = getDesktopRawStyleRect(a);
            const br = getDesktopRawStyleRect(b);
            if (Math.abs(ar.top - br.top) > 8) return ar.top - br.top;
            return ar.left - br.left;
        });
    const placed = [];
    let changed = false;
    items.forEach(item => {
        let rect = getDesktopStyleRect(item, pageArea);
        if (!rect) return;
        const overlapsPlaced = placed.some(entry => getDesktopRectIntersectionRatio(rect, entry.rect) > 0.16);
        if (overlapsPlaced) {
            const currentScore = scoreDesktopCandidateOverlap(rect, pageArea, [item]);
            const candidate = findDesktopOpenWidgetRect(pageArea, {
                width: rect.width,
                height: rect.height
            }, rect, [item]);
            const candidateScore = candidate ? scoreDesktopCandidateOverlap(candidate, pageArea, [item]) : Infinity;
            if (candidate && candidateScore + 0.01 < currentScore && candidateScore < 0.34) {
                setDesktopLayoutItemRect(item, candidate);
                rect = candidate;
                changed = true;
            }
        }
        placed.push({ item, rect });
    });
    return changed;
}

function getDesktopAppRowSpacingPlan(records, metrics) {
    const apps = records.filter(record => record.isApp).sort((a, b) => a.top - b.top || a.left - b.left);
    if (apps.length < 8 || apps.some(record => record.isFolder || record.height > 140)) return [];
    const rows = [];
    apps.forEach(record => {
        const last = rows[rows.length - 1];
        if (last && Math.abs(record.top - last[0].top) <= 8) last.push(record);
        else rows.push([record]);
    });
    if (rows.length < 2 || rows.some(row => row.length !== 4)) return [];
    rows.forEach(row => row.sort((a, b) => a.left - b.left));
    const centerY = row => row.reduce((sum, record) => sum + record.top + record.height / 2, 0) / row.length;
    const step = metrics.iconHeight + metrics.gapY;
    if (rows.some(row => row.some((record, column) => Math.abs(record.left + record.width / 2 - rows[0][column].left - rows[0][column].width / 2) > 8))) return [];
    if (!rows.some((row, index) => index && centerY(row) - centerY(rows[index - 1]) > step + 12)) return [];
    const firstTop = Math.min(...rows[0].map(record => record.top));
    const lastBottom = Math.max(...rows[rows.length - 1].map(record => record.top + record.height));
    // A component between the rows can be intentional; only tighten an uninterrupted app grid.
    if (records.some(record => !record.isApp && record.top < lastBottom && record.top + record.height > firstTop)) return [];
    const plan = [];
    let previousCenter = centerY(rows[0]);
    rows.forEach((row, index) => {
        const originalCenter = centerY(row);
        const center = index ? previousCenter + Math.min(step, originalCenter - centerY(rows[index - 1])) : originalCenter;
        row.forEach(record => plan.push({ ...record, top: center - metrics.iconHeight / 2, height: metrics.iconHeight }));
        previousCenter = center;
    });
    const newBottom = Math.max(...plan.map(record => record.top + record.height));
    const lift = lastBottom - newBottom;
    const trailingPhoto = records.find(record => record.isPhoto && record.width >= metrics.canvasWidth * 0.7
        && record.top >= lastBottom && record.top - lastBottom <= 32);
    if (trailingPhoto && lift > 0) plan.push({ ...trailingPhoto, top: trailingPhoto.top - lift });
    const untouched = records.filter(record => !plan.some(change => change.id === record.id));
    if (plan.some(change => untouched.some(record => change.left < record.left + record.width && change.left + change.width > record.left
        && change.top < record.top + record.height && change.top + change.height > record.top))) return [];
    return plan;
}

function tightenDesktopAppRowSpacing(pageArea) {
    const items = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item'));
    const records = items.map((item, id) => ({
        ...getDesktopRawStyleRect(item), id,
        isApp: item.classList.contains('layout-app'),
        isFolder: item.classList.contains('is-folder'),
        isPhoto: item.classList.contains('photo-large')
    }));
    const plan = getDesktopAppRowSpacingPlan(records, { ...getDesktopFourColumnAppGridMetrics(pageArea), canvasWidth: pageArea.clientWidth });
    let changed = false;
    plan.forEach(rect => { if (setDesktopLayoutItemRect(items[rect.id], rect)) changed = true; });
    if (changed) captureDesktopPageSlotRects(pageArea);
    return changed;
}

function repairDesktopLayoutOverlaps() {
    let changed = false;
    document.querySelectorAll('#pages-container .desktop-scroll-area.layout-canvas').forEach(pageArea => {
        if (!hasDesktopUsableLayoutBounds(pageArea)) return;
        if (repairDesktopWidgetOverlaps(pageArea)) changed = true;
        if (normalizeSecondPageAppGrid(pageArea)) changed = true;
        if (tightenDesktopAppRowSpacing(pageArea)) changed = true;
        if (repairDesktopAppOverlaps(pageArea)) changed = true;
        if (repairDesktopComicOverlap(pageArea)) changed = true;
    });
    return changed;
}

function settleDesktopAppsAroundWidget(widgetItem, pageArea) {
    if (!widgetItem || !pageArea || widgetItem.classList.contains('layout-app')) return;
    delete pageArea._desktopSlotRects;
    captureDesktopPageSlotRects(pageArea, { compact: true });
    compactDesktopSlotOrder(pageArea, null, { compact: true });
    repairDesktopAppOverlaps(pageArea);
}
