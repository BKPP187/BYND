function isPointInsideDesktopDock(point) {
    const dock = document.querySelector('#home-screen .dock-bar');
    if (!dock) return false;
    const rect = dock.getBoundingClientRect();
    const hitWidth = Math.max(rect.width, 220);
    const centerX = rect.left + rect.width / 2;
    const left = centerX - hitWidth / 2;
    const right = centerX + hitWidth / 2;
    return point.x >= left - 10 && point.x <= right + 10 && point.y >= rect.top - 18 && point.y <= rect.bottom + 18;
}

function getDesktopPageAreaFromPoint(point) {
    if (!point || isPointInsideDesktopDock(point)) return null;
    const target = document.elementFromPoint(point.x, point.y);
    if (target?.closest?.('.desktop-edit-toolbar, .desktop-widget-library, .desktop-save-modal, .folder-overlay')) return null;
    const directArea = target?.closest?.('.desktop-scroll-area');
    if (directArea) return directArea;
    const directPage = target?.closest?.('.desktop-page');
    if (directPage) return directPage.querySelector('.desktop-scroll-area');

    const pages = getDesktopPages();
    for (const page of pages) {
        const rect = page.getBoundingClientRect();
        if (point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) {
            return page.querySelector('.desktop-scroll-area');
        }
    }

    const container = document.getElementById('pages-container');
    const home = document.getElementById('home-screen');
    const scopeRect = container?.getBoundingClientRect?.() || home?.getBoundingClientRect?.();
    if (scopeRect && point.x >= scopeRect.left - 12 && point.x <= scopeRect.right + 12 && point.y >= scopeRect.top - 12 && point.y <= scopeRect.bottom + 90) {
        return getPreferredDesktopPageArea();
    }
    return null;
}

function getDesktopDragEdgeDirection(point) {
    if (!point || isPointInsideDesktopDock(point)) return '';
    const container = document.getElementById('pages-container');
    const rect = container?.getBoundingClientRect?.();
    if (!rect || point.y < rect.top - 20 || point.y > rect.bottom + 20) return '';
    const edgeSize = 34;
    if (point.x <= rect.left + edgeSize) return 'left';
    if (point.x >= rect.right - edgeSize) return 'right';
    return '';
}

function getDesktopEdgePageAreaForDrag(point, currentPageArea) {
    if (!point || !currentPageArea || isPointInsideDesktopDock(point)) return null;
    const container = document.getElementById('pages-container');
    const rect = container?.getBoundingClientRect?.();
    if (!rect || point.y < rect.top - 20 || point.y > rect.bottom + 20) return null;
    const pages = getDesktopPages();
    const currentIndex = getDesktopPageIndex(currentPageArea.closest('.desktop-page'));
    const edgeDirection = getDesktopDragEdgeDirection(point);
    let targetIndex = currentIndex;
    if (edgeDirection === 'left') targetIndex = currentIndex - 1;
    if (edgeDirection === 'right') targetIndex = currentIndex + 1;
    if (targetIndex === currentIndex || targetIndex < 0 || targetIndex >= pages.length) return null;
    return pages[targetIndex]?.querySelector('.desktop-scroll-area') || null;
}

function getDesktopDockItemAppId(item) {
    if (!item) return '';
    if (item.dataset.appId) return item.dataset.appId;
    const onclick = item.getAttribute('onclick') || '';
    const match = onclick.match(/openApp\(['"]([^'"]+)['"]\)/);
    if (match?.[1]) return match[1];
    const label = item.querySelector('.dock-label, span')?.textContent?.trim();
    return getDesktopAllAppDefinitions().find(app => app.name === label)?.id || '';
}

function hydrateDesktopDockItem(item) {
    const appId = getDesktopDockItemAppId(item);
    if (!item || !appId) return null;
    const app = getDesktopAnyAppDefinition(appId);
    if (!app) return null;
    item.dataset.appId = app.id;
    item.dataset.layoutId = `app-${app.id}`;
    item.onclick = () => openApp(app.id);
    if (!item.querySelector('.dock-icon-box')) {
        const icon = document.createElement('div');
        icon.className = 'dock-icon-box';
        item.insertBefore(icon, item.firstChild);
    }
    if (!item.querySelector('.dock-label')) {
        const label = document.createElement('span');
        label.className = 'dock-label';
        item.appendChild(label);
    }
    return app;
}

function createDesktopDockItem(appRef) {
    const app = getDesktopAppDefinition(appRef);
    const el = document.createElement('div');
    el.className = 'dock-item';
    el.dataset.appId = app.id;
    el.dataset.layoutId = `app-${app.id}`;
    el.onclick = () => openApp(app.id);
    el.innerHTML = `<div class="dock-icon-box">${renderDesktopAppIcon(app)}</div><span class="dock-label">${desktopEscapeHtml(app.name)}</span>`;
    setupDesktopDockItem(el);
    return el;
}

function getDesktopDockItems() {
    const dock = document.querySelector('#home-screen .dock-bar');
    return dock ? Array.from(dock.querySelectorAll(':scope > .dock-item')) : [];
}

function getDesktopDockInsertIndex(point, draggedItem) {
    if (!point) return getDesktopDockItems().length;
    const items = getDesktopDockItems().filter(item => item !== draggedItem);
    if (!items.length) return 0;
    for (let i = 0; i < items.length; i += 1) {
        const rect = items[i].getBoundingClientRect();
        if (point.x < rect.left + rect.width / 2) return i;
    }
    return items.length;
}

function refreshDesktopDockOrder() {
    getDesktopDockItems().forEach((item, index) => {
        hydrateDesktopDockItem(item);
        item.dataset.dockIndex = String(index);
        setupDesktopDockItem(item);
    });
}

function setupDesktopDockItem(item) {
    if (!item || item._dockLayoutReady) return;
    item._dockLayoutReady = true;
    item.dataset.dockLayoutReady = '1';
    item.addEventListener('pointerdown', startDesktopDockItemDrag, true);
    item.addEventListener('click', (e) => {
        if (!window._editMode) return;
        e.preventDefault();
        e.stopPropagation();
        selectDesktopLayoutItem(item);
    }, true);
}

function setupDesktopDockEditing() {
    refreshDesktopDockOrder();
}

function collectDesktopDockLayout() {
    return getDesktopDockItems()
        .map(item => getDesktopDockItemAppId(item))
        .filter(Boolean)
        .filter((appId, index, arr) => arr.indexOf(appId) === index);
}

function applyDesktopDockLayout(appIds) {
    const dock = document.querySelector('#home-screen .dock-bar');
    if (!dock || !Array.isArray(appIds)) return;
    const unique = appIds.filter((appId, index, arr) => appId && arr.indexOf(appId) === index);
    dock.innerHTML = '';
    unique.slice(0, DESKTOP_DOCK_LAYOUT_MAX).forEach(appId => {
        const app = getDesktopAnyAppDefinition(appId);
        if (app) dock.appendChild(createDesktopDockItem(app));
    });
    refreshDesktopDockOrder();
}

function getDesktopAppElementForTransfer(appId) {
    if (!appId) return null;
    let item = Array.from(document.querySelectorAll('.desktop-layout-item.layout-app')).find(el => getDesktopAppIdFromElement(el) === appId);
    if (item) return item;
    const app = getDesktopAnyAppDefinition(appId);
    return app ? createDesktopAppElement(app) : null;
}

function getPreferredDesktopPageArea() {
    const index = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
    return ensureDesktopPage(index)?.querySelector('.desktop-scroll-area') || document.querySelector('#pages-container .desktop-page .desktop-scroll-area');
}

function findDesktopFirstOpenAppSlotRect(pageArea, item, preferredIndex = 0, options = {}) {
    if (!pageArea || !item) return null;
    delete pageArea._desktopSlotRects;
    const metrics = getDesktopFallbackSlotMetrics(pageArea);
    const width = item.offsetWidth || parseFloat(item.style.width) || metrics.iconWidth;
    const height = item.offsetHeight || parseFloat(item.style.height) || metrics.iconHeight;
    const slots = getDesktopFlowSlotRects(pageArea);
    const start = Math.max(0, Number(preferredIndex) || 0);
    const orderedSlots = slots
        .map((slot, index) => ({ slot, index }))
        .sort((a, b) => {
            const aWrapped = a.index < start ? a.index + slots.length : a.index;
            const bWrapped = b.index < start ? b.index + slots.length : b.index;
            return aWrapped - bWrapped;
        });
    const candidates = orderedSlots.map(entry => ({
        slotIndex: entry.index,
        rect: clampDesktopLayoutRect({
            left: entry.slot.left + Math.round(((entry.slot.width || width) - width) / 2),
            top: entry.slot.top + Math.round(((entry.slot.height || height) - height) / 2),
            width,
            height
        }, pageArea)
    }));
    const free = candidates.find(entry => scoreDesktopCandidateOverlap(entry.rect, pageArea, [item]) < 0.08);
    if (options.strictOpenSlot) {
        if (free) {
            item.dataset.desktopSlot = String(free.slotIndex);
            return free.rect;
        }
        return null;
    }
    const best = free || candidates
        .map(entry => ({ ...entry, score: scoreDesktopCandidateOverlap(entry.rect, pageArea, [item]) }))
        .sort((a, b) => a.score - b.score)[0];
    if (best) {
        item.dataset.desktopSlot = String(best.slotIndex);
        return best.rect;
    }
    return findDesktopOpenAppRect(pageArea, item, getDesktopFallbackSlotRect(pageArea, start, item));
}

function placeDesktopAppInFirstOpenSlot(item, preferredArea, preferredIndex = 0, options = {}) {
    const pageArea = preferredArea || getPreferredDesktopPageArea();
    if (!item || !pageArea) return false;
    pageArea.classList.add('layout-canvas');
    pageArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    if (item.parentElement !== pageArea) pageArea.appendChild(item);
    item.classList.add('desktop-layout-item', 'layout-app');
    item.dataset.layoutId = item.dataset.layoutId || `app-${getDesktopAppIdFromElement(item)}`;
    item.dataset.layoutType = item.dataset.layoutType || (item.classList.contains('is-folder') ? 'folder' : 'app');
    normalizeDesktopLayoutAppSlotSize(item, pageArea);
    item.style.removeProperty('transform');
    item.style.removeProperty('position');
    setupDesktopLayoutItem(item);
    const slot = Math.max(0, Number(preferredIndex) || 0);
    const rect = findDesktopFirstOpenAppSlotRect(pageArea, item, slot, options);
    if (!rect) {
        item.remove();
        return false;
    }
    prepareDesktopLayoutItem(item, pageArea, rect);
    if (!options.strictOpenSlot) repairDesktopAppOverlaps(pageArea);
    captureDesktopPageSlotRects(pageArea);
    return true;
}

function removeDesktopDuplicateAppIcons(appId, keepItem) {
    if (!appId) return;
    document.querySelectorAll('.desktop-layout-item.layout-app').forEach(item => {
        if (item === keepItem) return;
        if (getDesktopAppIdFromElement(item) === appId) item.remove();
    });
    getDesktopDockItems().forEach(item => {
        if (item === keepItem) return;
        if (getDesktopDockItemAppId(item) === appId) item.remove();
    });
}

function moveDesktopAppItemToDock(sourceItem, insertIndex) {
    const dock = document.querySelector('#home-screen .dock-bar');
    if (!dock || !sourceItem) return false;
    const appId = getDesktopAppIdFromElement(sourceItem) || getDesktopDockItemAppId(sourceItem);
    const app = getDesktopAnyAppDefinition(appId);
    if (!app) return false;
    const originArea = sourceItem.closest?.('.desktop-scroll-area') || getPreferredDesktopPageArea();
    const dockItem = sourceItem.classList.contains('dock-item') ? sourceItem : createDesktopDockItem(app);
    removeDesktopDuplicateAppIcons(appId, dockItem);
    if (sourceItem !== dockItem) {
        sourceItem.remove();
        compactDesktopSlotOrder(originArea);
    }
    const items = getDesktopDockItems().filter(item => item !== dockItem);
    const index = Math.max(0, Math.min(Number(insertIndex) || 0, items.length));
    dock.insertBefore(dockItem, items[index] || null);
    while (getDesktopDockItems().length > DESKTOP_DOCK_LAYOUT_MAX) {
        const overflow = getDesktopDockItems().find(item => item !== dockItem && Number(item.dataset.dockIndex) >= DESKTOP_DOCK_LAYOUT_MAX - 1)
            || getDesktopDockItems().find(item => item !== dockItem)
            || getDesktopDockItems()[DESKTOP_DOCK_LAYOUT_MAX];
        if (!overflow) break;
        const overflowId = getDesktopDockItemAppId(overflow);
        overflow.remove();
        const overflowApp = getDesktopAnyAppDefinition(overflowId);
        if (overflowApp) placeDesktopAppInFirstOpenSlot(createDesktopAppElement(overflowApp), originArea);
    }
    refreshDesktopDockOrder();
    return true;
}

function moveDesktopDockItemToPage(dockItem, pageArea, targetIndex) {
    if (!dockItem || !pageArea) return null;
    const appId = getDesktopDockItemAppId(dockItem);
    const app = getDesktopAnyAppDefinition(appId);
    if (!app) return null;
    const item = createDesktopAppElement(app);
    removeDesktopDuplicateAppIcons(app.id, item);
    delete pageArea._desktopSlotRects;
    dockItem.remove();
    pageArea.classList.add('layout-canvas');
    pageArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    pageArea.appendChild(item);
    item.classList.add('desktop-layout-item', 'layout-app');
    item.dataset.layoutId = item.dataset.layoutId || `app-${app.id}`;
    item.dataset.layoutType = 'app';
    normalizeDesktopLayoutAppSlotSize(item, pageArea);
    item.style.removeProperty('transform');
    item.style.removeProperty('position');
    setupDesktopLayoutItem(item);
    const index = Number.isFinite(targetIndex) ? targetIndex : getDesktopOrderedSlotItems(pageArea, true).length - 1;
    insertDesktopAppAtSlot(pageArea, item, index);
    refreshDesktopDockOrder();
    return item;
}

function mergeDesktopDockItemIntoFolder(dockItem, targetItem, pageArea) {
    if (!dockItem || !targetItem || !pageArea) return false;
    const appId = getDesktopDockItemAppId(dockItem);
    const sourceApp = getDesktopAnyAppDefinition(appId);
    if (!sourceApp) return false;
    let folder = null;
    let folderItem = null;
    if (targetItem.classList.contains('is-folder')) {
        folder = window._folders.find(f => f.id === targetItem.dataset.folderId);
        if (!folder || folder.apps?.some(app => app?.id === sourceApp.id)) return false;
        folder.apps.push(normalizeDesktopAppRef(sourceApp));
        saveFolders();
        dockItem.remove();
        syncDesktopFolderIcon(folder.id);
        folderItem = targetItem;
    } else {
        const targetApp = getDesktopLayoutItemAppRef(targetItem);
        if (!targetApp || targetApp.id === sourceApp.id) return false;
        folder = {
            id: 'folder_' + Date.now(),
            name: '文件夹',
            apps: [normalizeDesktopAppRef(targetApp), normalizeDesktopAppRef(sourceApp)],
            width: null,
            height: null,
            size: 'small'
        };
        window._folders.push(folder);
        saveFolders();
        const rect = {
            left: parseFloat(targetItem.style.left) || targetItem.offsetLeft || 24,
            top: parseFloat(targetItem.style.top) || targetItem.offsetTop || 64,
            width: targetItem.offsetWidth || 72,
            height: targetItem.offsetHeight || 76
        };
        folderItem = createDesktopFolderElement(folder);
        pageArea.appendChild(folderItem);
        prepareDesktopLayoutItem(folderItem, pageArea, rect);
        targetItem.remove();
        dockItem.remove();
    }
    if (!folderItem) return false;
    removeDesktopDuplicateAppIcons(sourceApp.id, folderItem);
    folderItem.classList.remove('desktop-folder-merge-target');
    playDesktopFolderMergeAnimation(folderItem);
    selectDesktopLayoutItem(folderItem);
    refreshDesktopDockOrder();
    if (typeof showWechatToast === 'function') showWechatToast('已合并为文件夹');
    return true;
}

function startDesktopDockItemDrag(e) {
    if (!window._editMode) return;
    const dockItem = e.currentTarget;
    if (!dockItem) return;
    const dockApp = hydrateDesktopDockItem(dockItem);
    if (!dockApp) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof dockItem.setPointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
        try { dockItem.setPointerCapture(e.pointerId); } catch (err) {}
    }
    selectDesktopLayoutItem(dockItem);
    const startPoint = getDesktopPointerPoint(e);
    const previousPointerEvents = dockItem.style.pointerEvents;
    let pendingFolderMergeTarget = null;
    const setPendingFolderMergeTarget = target => {
        if (pendingFolderMergeTarget && pendingFolderMergeTarget !== target) {
            pendingFolderMergeTarget.classList.remove('desktop-folder-merge-target');
        }
        pendingFolderMergeTarget = target || null;
        if (pendingFolderMergeTarget) pendingFolderMergeTarget.classList.add('desktop-folder-merge-target');
    };
    const clearPendingFolderMergeTarget = () => setPendingFolderMergeTarget(null);
    dockItem.style.pointerEvents = 'none';
    const ghost = dockItem.cloneNode(true);
    ghost.classList.add('dock-drag-ghost');
    document.body.appendChild(ghost);
    const moveGhost = point => {
        ghost.style.left = `${Math.round(point.x - ghost.offsetWidth / 2)}px`;
        ghost.style.top = `${Math.round(point.y - ghost.offsetHeight / 2)}px`;
    };
    moveGhost(startPoint);

    const move = ev => {
        const point = getDesktopPointerPoint(ev);
        moveGhost(point);
        if (isPointInsideDesktopDock(point)) {
            clearPendingFolderMergeTarget();
            const index = getDesktopDockInsertIndex(point, dockItem);
            const items = getDesktopDockItems().filter(item => item !== dockItem);
            document.querySelector('#home-screen .dock-bar')?.insertBefore(dockItem, items[index] || null);
            refreshDesktopDockOrder();
            return;
        }
        const targetArea = getDesktopPageAreaFromPoint(point);
        if (targetArea) {
            ensureDesktopPageSlotRects(targetArea);
            setPendingFolderMergeTarget(findDesktopDockFolderMergeTarget(targetArea, point, dockApp.id));
        } else {
            clearPendingFolderMergeTarget();
        }
    };
    const up = ev => {
        const point = getDesktopPointerPoint(ev);
        if (typeof dockItem.releasePointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
            try { dockItem.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        dockItem.style.pointerEvents = previousPointerEvents;
        ghost.remove();
        const targetArea = getDesktopPageAreaFromPoint(point);
        if (targetArea && !isPointInsideDesktopDock(point)) {
            const mergeTarget = pendingFolderMergeTarget || findDesktopDockFolderMergeTarget(targetArea, point, dockApp.id);
            if (mergeTarget && mergeDesktopDockItemIntoFolder(dockItem, mergeTarget, targetArea)) {
                clearPendingFolderMergeTarget();
            } else {
                clearPendingFolderMergeTarget();
                const targetIndex = getDesktopSlotIndexFromPoint(targetArea, point, null);
                const pageItem = moveDesktopDockItemToPage(dockItem, targetArea, targetIndex);
                if (pageItem) selectDesktopLayoutItem(pageItem);
            }
        } else {
            clearPendingFolderMergeTarget();
            const index = getDesktopDockInsertIndex(point, dockItem);
            const items = getDesktopDockItems().filter(item => item !== dockItem);
            document.querySelector('#home-screen .dock-bar')?.insertBefore(dockItem, items[index] || null);
            refreshDesktopDockOrder();
        }
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
}

function mergeDesktopLayoutAppsIntoFolder(sourceItem, targetItem, pageArea) {
    const sourceApp = getDesktopLayoutItemAppRef(sourceItem);
    if (!sourceApp || !targetItem || !pageArea) return false;
    let folder = null;
    let animatedFolderItem = null;
    if (targetItem.classList.contains('is-folder')) {
        folder = window._folders.find(f => f.id === targetItem.dataset.folderId);
        if (!folder) return false;
        addToFolder(folder.id, sourceApp);
        sourceItem.remove();
        animatedFolderItem = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item.is-folder'))
            .find(item => item.dataset.folderId === folder.id) || targetItem;
    } else {
        const targetApp = getDesktopLayoutItemAppRef(targetItem);
        if (!targetApp || targetApp.id === sourceApp.id) return false;
        folder = {
            id: 'folder_' + Date.now(),
            name: '文件夹',
            apps: [normalizeDesktopAppRef(targetApp), normalizeDesktopAppRef(sourceApp)],
            width: null,
            height: null,
            size: 'small'
        };
        window._folders.push(folder);
        saveFolders();
        const rect = {
            left: parseFloat(targetItem.style.left) || targetItem.offsetLeft || 24,
            top: parseFloat(targetItem.style.top) || targetItem.offsetTop || 64,
            width: targetItem.offsetWidth || 72,
            height: targetItem.offsetHeight || 76
        };
        const folderItem = createDesktopFolderElement(folder);
        pageArea.appendChild(folderItem);
        prepareDesktopLayoutItem(folderItem, pageArea, rect);
        targetItem.remove();
        sourceItem.remove();
        animatedFolderItem = folderItem;
        selectDesktopLayoutItem(folderItem);
    }
    if (folder) {
        saveFolders();
        if (animatedFolderItem) playDesktopFolderMergeAnimation(animatedFolderItem);
        if (typeof showWechatToast === 'function') showWechatToast('已合并为文件夹');
        return true;
    }
    return false;
}

function playDesktopFolderMergeAnimation(folderItem) {
    if (!folderItem) return;
    folderItem.classList.remove('desktop-folder-created');
    void folderItem.offsetWidth;
    folderItem.classList.add('desktop-folder-created');
    setTimeout(() => folderItem.classList.remove('desktop-folder-created'), 420);
}

function centerSelectedDesktopItem() {
    const item = window._desktopSelectedLayoutItem;
    const pageArea = item?.closest?.('.desktop-scroll-area');
    if (!window._editMode || !item || !pageArea) return;
    const width = item.offsetWidth || parseFloat(item.style.width) || 118;
    const height = item.offsetHeight || parseFloat(item.style.height) || 96;
    const top = parseFloat(item.style.top) || item.offsetTop || 8;
    const areaRect = pageArea.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const style = getComputedStyle(pageArea);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const scaleX = itemRect.width > 0 && width > 0
        ? itemRect.width / width
        : (areaRect.width > 0 && pageArea.clientWidth > 0 ? areaRect.width / pageArea.clientWidth : 1);
    const visualCenteredLeft = scaleX > 0
        ? ((areaRect.width - itemRect.width) / 2) / scaleX - paddingLeft
        : (pageArea.clientWidth - width) / 2;
    const centeredLeft = Math.round(Number.isFinite(visualCenteredLeft) ? visualCenteredLeft : (pageArea.clientWidth - width) / 2);
    const safe = clampDesktopLayoutRect({
        left: Math.max(8, centeredLeft),
        top,
        width,
        height
    }, pageArea);
    setDesktopLayoutItemRect(item, safe);
    delete pageArea._desktopSlotRects;
    showDesktopSnapGuides(pageArea, {
        ...safe,
        guideX: Math.round(safe.left + safe.width / 2),
        guideY: Math.round(safe.top + safe.height / 2),
        centerX: true,
        centerY: false,
        mode: 'move'
    });
    setTimeout(() => hideDesktopSnapGuides(pageArea), 520);
    if (typeof showWechatToast === 'function') showWechatToast('已居中');
}
window.centerSelectedDesktopItem = centerSelectedDesktopItem;

function startDesktopItemDrag(e) {
    if (!window._editMode || e.target.closest('.desktop-resize-handle, .desktop-item-center, .desktop-item-move-page, .desktop-item-delete')) return;
    const item = e.currentTarget;
    const isPolaroidWidget = item.classList.contains('desktop-widget-polaroid');
    if (e.target.closest('.pw-note, .dsw-avatar, .dsw-avatar-input, .dsw-weather, .dsw-steps, .lcw-input, .dnw-tone-picker, .lcw-bubble-palette, .lcw-bubble-custom, .lcw-title-palette')) return;
    if (!isPolaroidWidget && !item.classList.contains('desktop-custom-widget') && e.target.closest('.lcw-control')) return;
    const pageArea = item.closest('.desktop-scroll-area');
    if (!pageArea) return;
    const sourcePageRect = pageArea.getBoundingClientRect();
    delete item.dataset.desktopDragMoved;
    e.preventDefault();
    e.stopPropagation();
    if (typeof item.setPointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
        try { item.setPointerCapture(e.pointerId); } catch (err) {}
    }
    selectDesktopLayoutItem(item);
    item.classList.add('desktop-layout-dragging');
    const startPoint = getDesktopPointerPoint(e);
    const startX = startPoint.x;
    const startY = startPoint.y;
    const startLeft = parseFloat(item.style.left) || 0;
    const startTop = parseFloat(item.style.top) || 0;
    const scale = getDesktopEditScale();
    const isAppIcon = item.classList.contains('layout-app');
    const isFolderIcon = item.classList.contains('is-folder') && !!item.dataset.folderId;
    const canMoveAcrossPages = isAppIcon || item.classList.contains('desktop-custom-widget') || item.classList.contains('calendar-widget') || item.classList.contains('photo-large');
    let currentPageArea = pageArea;
    let movedToPageIndex = getDesktopPageIndex(pageArea.closest('.desktop-page'));
    let hasMoved = false;
    let maxMovedDistance = 0;
    let pendingDockIndex = -1;
    let lockedEdgeDirection = '';
    let edgeHoverDirection = '';
    let edgeHoverSince = 0;
    let pendingFolderMergeTarget = null;
    let pendingFolderMergeSince = 0;
    let pendingFolderMergeTimer = null;
    const setPendingFolderMergeTarget = target => {
        if (pendingFolderMergeTarget && pendingFolderMergeTarget !== target) {
            pendingFolderMergeTarget.classList.remove('desktop-folder-merge-target');
        }
        if (pendingFolderMergeTarget !== target) {
            clearTimeout(pendingFolderMergeTimer);
            pendingFolderMergeSince = target ? Date.now() : 0;
            if (target) pendingFolderMergeTimer = setTimeout(() => {
                if (pendingFolderMergeTarget === target) target.classList.add('desktop-folder-merge-target');
            }, 550);
        }
        pendingFolderMergeTarget = target || null;
    };
    const clearPendingFolderMergeTarget = () => setPendingFolderMergeTarget(null);
    if (isAppIcon) {
        item.classList.add('desktop-slot-dragging');
        captureDesktopPageSlotRects(pageArea);
    }

    const move = (ev) => {
        const point = getDesktopPointerPoint(ev);
        const movedDistance = Math.hypot(point.x - startX, point.y - startY);
        maxMovedDistance = Math.max(maxMovedDistance, movedDistance);
        const moveThreshold = isFolderIcon ? 16 : 6;
        if (movedDistance > moveThreshold) {
            hasMoved = true;
            item.dataset.desktopDragMoved = '1';
        }
        if (!hasMoved) return;
        const activeArea = currentPageArea || pageArea;
        const pointerMergeTarget = isAppIcon ? findDesktopFolderMergeTarget(item, activeArea, point) : null;
        const pointerSlotIndex = isAppIcon ? getDesktopSlotIndexFromPoint(activeArea, point, item) : -1;
        const currentSlotIndex = isAppIcon ? Number(item.dataset.desktopSlot) : -1;
        const pointerIsOnDesktopIcon = !!pointerMergeTarget
            || (Number.isFinite(pointerSlotIndex) && Number.isFinite(currentSlotIndex) && pointerSlotIndex !== currentSlotIndex);
        const edgeDirection = pointerIsOnDesktopIcon ? '' : getDesktopDragEdgeDirection(point);
        if (!edgeDirection) {
            lockedEdgeDirection = '';
            edgeHoverDirection = '';
            edgeHoverSince = 0;
        } else if (edgeDirection !== edgeHoverDirection) {
            edgeHoverDirection = edgeDirection;
            edgeHoverSince = Date.now();
        }
        if (edgeDirection && edgeDirection !== lockedEdgeDirection && Date.now() - edgeHoverSince < 760) {
            edgeHoverDirection = edgeDirection;
        }
        const edgeReady = edgeDirection && edgeDirection !== lockedEdgeDirection && Date.now() - edgeHoverSince >= 760;
        const edgePageArea = edgeReady ? getDesktopEdgePageAreaForDrag(point, currentPageArea) : null;
        const targetPageArea = edgePageArea || getDesktopPageAreaFromPoint(point);
        if (canMoveAcrossPages && targetPageArea && targetPageArea !== currentPageArea && !isPointInsideDesktopDock(point)) {
            targetPageArea.classList.add('layout-canvas');
            targetPageArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
            if (isAppIcon) compactDesktopSlotOrder(currentPageArea);
            targetPageArea.appendChild(item);
            currentPageArea = targetPageArea;
            movedToPageIndex = getDesktopPageIndex(targetPageArea.closest('.desktop-page'));
            if (typeof window.goToDesktopPage === 'function') window.goToDesktopPage(movedToPageIndex);
            if (isAppIcon) captureDesktopPageSlotRects(currentPageArea);
            if (edgePageArea) lockedEdgeDirection = edgeDirection;
        }
        if (isAppIcon && isPointInsideDesktopDock(point)) {
            pendingDockIndex = getDesktopDockInsertIndex(point, null);
            item.classList.add('desktop-dock-drop-ready');
            clearPendingFolderMergeTarget();
            return;
        }
        pendingDockIndex = -1;
        item.classList.remove('desktop-dock-drop-ready');
        const area = currentPageArea || pageArea;
        const areaRect = area.getBoundingClientRect();
        const maxLeft = Math.max(8, area.clientWidth - item.offsetWidth - 8);
        const maxTop = Math.max(8, area.clientHeight - item.offsetHeight - 8);
        const dx = (point.x - startX) / scale;
        const dy = (point.y - startY) / scale;
        const sourceOffsetX = (sourcePageRect.left - areaRect.left) / scale;
        const sourceOffsetY = (sourcePageRect.top - areaRect.top) / scale;
        applyDesktopLayoutRect(item, area, {
            left: Math.max(8, Math.min(maxLeft, startLeft + dx + sourceOffsetX)),
            top: Math.max(8, Math.min(maxTop, startTop + dy + sourceOffsetY)),
            width: item.offsetWidth,
            height: item.offsetHeight
        }, { mode: 'move' });
        if (isAppIcon) {
            const mergeTarget = (area === activeArea ? pointerMergeTarget : null) || findDesktopFolderMergeTarget(item, area, point);
            if (mergeTarget) {
                setPendingFolderMergeTarget(mergeTarget);
                return;
            }
            clearPendingFolderMergeTarget();
            const slotIndex = area === activeArea && pointerSlotIndex >= 0 ? pointerSlotIndex : getDesktopSlotIndexFromPoint(area, point, item);
            applyDesktopSlotOrder(area, item, slotIndex);
        } else {
            clearPendingFolderMergeTarget();
        }
    };
    const up = (ev) => {
        if (typeof item.releasePointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
            try { item.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        const point = getDesktopPointerPoint(ev);
        const area = item.closest('.desktop-scroll-area') || currentPageArea || pageArea;
        if (hasMoved && isAppIcon && ['pet', 'comic'].includes(getDesktopAppIdFromElement(item))) {
            try { localStorage.setItem('bynd_desktop_page2_custom_v1', '1'); } catch (_) {}
        }
        if (isFolderIcon && (!hasMoved || maxMovedDistance <= 18)) {
            item.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready');
            hideDesktopSnapGuides(area);
            clearPendingFolderMergeTarget();
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            openFolder(item.dataset.folderId);
            return;
        }
        if (isAppIcon && (isPointInsideDesktopDock(point) || pendingDockIndex >= 0)) {
            moveDesktopAppItemToDock(item, pendingDockIndex >= 0 ? pendingDockIndex : getDesktopDockInsertIndex(point, null));
            hideDesktopSnapGuides(area);
            item.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready');
            clearPendingFolderMergeTarget();
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            return;
        }
        const target = hasMoved && pendingFolderMergeTarget && Date.now() - pendingFolderMergeSince >= 550
            && findDesktopFolderMergeTarget(item, area, point) === pendingFolderMergeTarget
            ? pendingFolderMergeTarget : null;
        if (target && mergeDesktopLayoutAppsIntoFolder(item, target, area)) {
            hideDesktopSnapGuides(area);
            item.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready');
            clearPendingFolderMergeTarget();
            compactDesktopSlotOrder(area);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            return;
        }
        clearPendingFolderMergeTarget();
        if (isAppIcon) {
            const finalIndex = getDesktopSlotIndexFromPoint(area, point, item);
            applyDesktopSlotOrder(area, item, finalIndex);
            const rect = getDesktopSlotRect(area, Number(item.dataset.desktopSlot), item);
            item.style.left = `${Math.round(rect.left)}px`;
            item.style.top = `${Math.round(rect.top)}px`;
            item.style.width = `${Math.round(rect.width)}px`;
            item.style.height = `${Math.round(rect.height)}px`;
            if (Number.isInteger(movedToPageIndex) && typeof window.goToDesktopPage === 'function') {
                window.goToDesktopPage(movedToPageIndex);
            }
        } else {
            if (hasMoved) settleDesktopAppsAroundWidget(item, area);
        }
        item.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready');
        if (item.dataset.desktopDragMoved) {
            setTimeout(() => { delete item.dataset.desktopDragMoved; }, 0);
        }
        hideDesktopSnapGuides(area);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

function startDesktopItemResize(e) {
    if (!window._editMode) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    const item = e.currentTarget.closest('.desktop-layout-item');
    const pageArea = item?.closest('.desktop-scroll-area');
    if (!item || !pageArea) return;
    const handle = e.currentTarget;
    const pointerId = typeof e.pointerId !== 'undefined' ? e.pointerId : null;
    e.preventDefault();
    e.stopPropagation();
    if (typeof handle.setPointerCapture === 'function' && pointerId !== null) {
        try { handle.setPointerCapture(pointerId); } catch (err) {}
    }
    selectDesktopLayoutItem(item);
    item.classList.add('desktop-layout-resizing');
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = item.offsetWidth;
    const startHeight = item.offsetHeight;
    const isFolder = item.classList.contains('is-folder');
    const isLovelyWidget = item.classList.contains('desktop-widget-lovely');
    const minWidth = item.classList.contains('calendar-widget') ? 220 : isLovelyWidget ? 150 : isFolder ? 72 : 118;
    const minHeight = item.classList.contains('calendar-widget') ? 118 : isLovelyWidget ? 128 : isFolder ? 76 : 96;
    const scale = getDesktopEditScale();
    let hasResized = false;
    let active = true;

    const move = (ev) => {
        if (!active) return;
        if (pointerId !== null && typeof ev.pointerId !== 'undefined' && ev.pointerId !== pointerId) return;
        if (ev.pointerType === 'mouse' && ev.buttons === 0) {
            finishResize(ev);
            return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        const left = parseFloat(item.style.left) || 0;
        const top = parseFloat(item.style.top) || 0;
        const maxWidth = pageArea.clientWidth - left;
        const maxHeight = pageArea.clientHeight - top;
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        if (!hasResized && Math.hypot(dx, dy) < 4) return;
        hasResized = true;
        applyDesktopLayoutRect(item, pageArea, {
            left,
            top,
            width: Math.max(minWidth, Math.min(maxWidth, startWidth + dx)),
            height: Math.max(minHeight, Math.min(maxHeight, startHeight + dy))
        }, { mode: 'resize' });
    };
    function finishResize(ev) {
        if (!active) return;
        if (ev && pointerId !== null && typeof ev.pointerId !== 'undefined' && ev.pointerId !== pointerId) return;
        active = false;
        if (typeof handle.releasePointerCapture === 'function' && pointerId !== null) {
            try { handle.releasePointerCapture(pointerId); } catch (err) {}
        }
        item.classList.remove('desktop-layout-resizing');
        hideDesktopSnapGuides(pageArea);
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', finishResize, true);
        window.removeEventListener('pointercancel', finishResize, true);
        window.removeEventListener('mouseup', finishResize, true);
        window.removeEventListener('blur', finishResize, true);
        handle.removeEventListener('lostpointercapture', finishResize, true);
        if (hasResized && !item.classList.contains('layout-app')) {
            settleDesktopAppsAroundWidget(item, pageArea);
        }
    }
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finishResize, true);
    window.addEventListener('pointercancel', finishResize, true);
    window.addEventListener('mouseup', finishResize, true);
    window.addEventListener('blur', finishResize, true);
    handle.addEventListener('lostpointercapture', finishResize, true);
}
