function enterEditMode() {
    if (window._editMode) return;
    const pages = document.getElementById('pages-container');
    const home = document.getElementById('home-screen');
    if (!pages || !home) return;
    window._editMode = true;
    _desktopLayoutBackupHtml = pages.innerHTML;
    const dock = document.querySelector('#home-screen .dock-bar');
    _desktopDockBackupHtml = dock ? dock.innerHTML : '';
    _desktopDefaultPrincessDeletedBackup = localStorage.getItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY);
    _desktopDefaultLovelyDeletedBackup = localStorage.getItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY);
    _desktopStickyNotesBackup = localStorage.getItem(DESKTOP_STICKY_NOTES_KEY);
    _desktopLovelyPrefsBackup = localStorage.getItem(DESKTOP_LOVELY_WIDGET_PREFS_KEY);
    _desktopPage2CustomBackup = localStorage.getItem('bynd_desktop_page2_custom_v1');
    _desktopFoldersBackup = localStorage.getItem(DESKTOP_FOLDER_STORAGE_KEY);
    materializeExistingDesktopForLayout();
    document.querySelectorAll('.desktop-layout-item').forEach(setupDesktopLayoutItem);
    setupDesktopDockEditing();
    repairDesktopLayoutOverlaps();
    home.classList.add('desktop-editing');
    renderDesktopEditChrome();
    if (navigator.vibrate) navigator.vibrate(20);
}

function startDesktopEditLongPress(e) {
    const home = document.getElementById('home-screen');
    if (!home || window._editMode) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    if (e.target.closest('.app-window, .folder-overlay, .desktop-edit-toolbar, .desktop-widget-library, .desktop-save-modal')) return;
    if (!e.target.closest('.desktop-scroll-area, .desktop-layout-item, .desktop-custom-widget, .app-item, .photo-large, .calendar-widget, .desktop-page, .dock-bar, .dock-item')) return;

    const point = getDesktopPointerPoint(e);
    _desktopLongPressActive = true;
    _desktopLongPressTriggered = false;
    _desktopLongPressStart = point;
    clearTimeout(_editLongPressTimer);
    _editLongPressTimer = setTimeout(() => {
        if (!_desktopLongPressActive) return;
        _desktopLongPressTriggered = true;
        _desktopLongPressActive = false;
        enterEditMode();
    }, 520);
}

function cancelDesktopEditLongPress(e) {
    if (e && e.type === 'pointermove' && _desktopLongPressStart) {
        const point = getDesktopPointerPoint(e);
        const dx = Math.abs(point.x - _desktopLongPressStart.x);
        const dy = Math.abs(point.y - _desktopLongPressStart.y);
        if (dx < 16 && dy < 16) return;
    }
    if (e && e.type === 'touchmove' && _desktopLongPressStart) {
        const point = getDesktopPointerPoint(e);
        const dx = Math.abs(point.x - _desktopLongPressStart.x);
        const dy = Math.abs(point.y - _desktopLongPressStart.y);
        if (dx < 16 && dy < 16) return;
    }
    clearTimeout(_editLongPressTimer);
    _desktopLongPressActive = false;
    _desktopLongPressStart = null;
}

function shouldSuppressDesktopNativeLongPress(target) {
    if (!target || !target.closest) return false;
    if (!target.closest('#home-screen')) return false;
    if (target.closest('input, textarea, select, [contenteditable="true"], .lcw-input, .pw-note')) return false;
    return !!target.closest([
        '.pages-container',
        '.desktop-page',
        '.desktop-scroll-area',
        '.app-item',
        '.app-icon',
        '.dock-bar',
        '.dock-item',
        '.desktop-layout-item',
        '.desktop-custom-widget',
        '.photo-large',
        '.calendar-widget',
        '.page-dots'
    ].join(','));
}

function suppressDesktopNativeLongPress(e) {
    if (!shouldSuppressDesktopNativeLongPress(e.target)) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
}

function promptSaveDesktopLayout() {
    const home = document.getElementById('home-screen');
    if (!home || document.getElementById('desktop-save-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'desktop-save-modal';
    modal.className = 'desktop-save-modal';
    modal.innerHTML = `
        <div class="desktop-save-card">
            <strong>保存当前桌面布局？</strong>
            <span>图标、组件位置和大小都会保存。</span>
            <div>
                <button type="button" onclick="document.getElementById('desktop-save-modal')?.remove()">再看看</button>
                <button type="button" class="primary" onclick="saveDesktopLayout()">保存</button>
            </div>
        </div>
    `;
    home.appendChild(modal);
}

function promptRestoreDefaultDesktopLayout() {
    const home = document.getElementById('home-screen');
    if (!home || document.getElementById('desktop-save-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'desktop-save-modal';
    modal.className = 'desktop-save-modal';
    modal.innerHTML = `
        <div class="desktop-save-card desktop-restore-card">
            <strong>恢复原始桌面？</strong>
            <span>会清除已保存的桌面摆放，图标和组件回到初始布局。</span>
            <div>
                <button type="button" onclick="document.getElementById('desktop-save-modal')?.remove()">取消</button>
                <button type="button" class="primary danger" onclick="restoreDefaultDesktopLayout()">恢复</button>
            </div>
        </div>
    `;
    home.appendChild(modal);
}

function collectDesktopLayout() {
    syncDesktopStickyNotesFromDom();
    const dockAppIds = new Set(collectDesktopDockLayout().map(appId => `app-${appId}`));
    return Array.from(document.querySelectorAll('.desktop-layout-item')).filter(item => (
        !isDesktopStaticPage2AppLayoutId(item.dataset.layoutId)
        && !dockAppIds.has(item.dataset.layoutId)
    )).map(item => {
        const page = item.closest('.desktop-page');
        const area = item.closest('.desktop-scroll-area');
        const rect = clampDesktopLayoutRect({
            left: parseFloat(item.style.left) || 0,
            top: parseFloat(item.style.top) || 0,
            width: item.offsetWidth,
            height: item.offsetHeight
        }, area);
        return {
            id: item.dataset.layoutId,
            type: item.dataset.layoutType || 'builtin',
            kind: item.dataset.widgetKind || '',
            page: getDesktopPageIndex(page),
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            canvasWidth: area.clientWidth
        };
    });
}

function saveDesktopLayout() {
    syncDesktopStickyNotesFromDom();
    localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify({
        items: collectDesktopLayout(),
        dock: collectDesktopDockLayout(),
        deletedBuiltins: collectDesktopDeletedBuiltinIds(),
        pageCount: getDesktopPages().length,
        savedAt: Date.now()
    }));
    exitEditMode(true);
}

function restoreDefaultDesktopLayout() {
    localStorage.removeItem(DESKTOP_LAYOUT_KEY);
    localStorage.removeItem(DESKTOP_FOLDER_STORAGE_KEY);
    localStorage.removeItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY);
    localStorage.removeItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY);
    window._folders = [];
    _desktopLayoutApplied = false;
    document.getElementById('desktop-save-modal')?.remove();
    const pages = document.getElementById('pages-container');
    const template = _desktopDefaultLayoutHtml || _desktopLayoutBackupHtml;
    if (pages && template) {
        if (typeof pages._pageSwipeCleanup === 'function') pages._pageSwipeCleanup();
        const newPages = pages.cloneNode(false);
        newPages.innerHTML = template;
        pages.replaceWith(newPages);
    }
    const dock = document.querySelector('#home-screen .dock-bar');
    if (dock && _desktopDefaultDockHtml) dock.innerHTML = _desktopDefaultDockHtml;
    window._editMode = false;
    window._desktopSelectedLayoutItem = null;
    window._desktopCurrentPage = 0;
    window._desktopPageSwipeState = null;
    window._desktopDraggingItem = null;
    window._desktopDockDraggingItem = null;
    document.getElementById('home-screen')?.classList.remove('desktop-editing');
    clearDesktopEditChrome();
    if (typeof clearDesktopPageSlotRects === 'function') clearDesktopPageSlotRects();
    setTimeout(() => {
        if (typeof syncDesktopPagesAndDots === 'function') syncDesktopPagesAndDots(0);
        if (typeof initFolderDrag === 'function') initFolderDrag();
        if (typeof ensureMonitorDesktopEntry === 'function') ensureMonitorDesktopEntry();
        if (typeof ensureDesktopLovelyWidget === 'function') ensureDesktopLovelyWidget();
        if (typeof restoreDesktopRuntimeAfterEdit === 'function') restoreDesktopRuntimeAfterEdit();
        if (typeof resetDesktopToFirstPage === 'function') resetDesktopToFirstPage();
    }, 0);
}

function clearDesktopEditChrome() {
    document.getElementById('desktop-edit-toolbar')?.remove();
    document.getElementById('desktop-widget-library')?.remove();
    document.getElementById('desktop-save-modal')?.remove();
    document.querySelectorAll('.desktop-resize-handle, .desktop-item-center, .desktop-item-move-page, .desktop-item-delete').forEach(el => el.remove());
    document.querySelectorAll('.desktop-snap-guides').forEach(el => el.remove());
    document.querySelectorAll('.desktop-layout-item.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.dock-item.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.desktop-layout-dragging, .desktop-slot-dragging, .desktop-dock-drop-ready').forEach(el => el.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready'));
    document.querySelectorAll('.dock-drag-ghost').forEach(el => el.remove());
}

function resetDesktopInteractionStateAfterEdit() {
    clearTimeout(_editLongPressTimer);
    _desktopLongPressActive = false;
    _desktopLongPressTriggered = false;
    _desktopLongPressStart = null;
    window._desktopDraggingItem = null;
    window._desktopDockDraggingItem = null;
    document.querySelectorAll('[data-desktop-drag-moved]').forEach(item => {
        delete item.dataset.desktopDragMoved;
    });
    document.querySelectorAll('#pages-container .desktop-layout-item').forEach(item => {
        item.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready', 'desktop-layout-resizing');
    });
}

function restoreDesktopRuntimeAfterEdit() {
    if (typeof initPageSwipe === 'function') initPageSwipe({ force: true });
    const pages = typeof getDesktopPages === 'function' ? getDesktopPages() : [];
    const maxPage = Math.max(0, pages.length - 1);
    const currentPage = Math.max(0, Math.min(maxPage, Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0));
    window._desktopCurrentPage = currentPage;
    if (typeof window.goToDesktopPage === 'function') {
        window.goToDesktopPage(currentPage);
    } else {
        syncDesktopPagesAndDots(currentPage);
    }
    document.querySelectorAll('#pages-container .desktop-layout-item').forEach(item => setupDesktopLayoutItem(item));
    setupDesktopDockEditing();
    resetDesktopInteractionStateAfterEdit();
}

function normalizeDesktopSavedLayoutItems(items, dockItems = []) {
    if (!Array.isArray(items)) return [];
    const dockAppIds = new Set((Array.isArray(dockItems) ? dockItems : []).map(appId => String(appId || '')).filter(Boolean));
    const seen = new Set();
    const normalized = [];
    for (let i = items.length - 1; i >= 0; i -= 1) {
        const record = items[i];
        if (!record || typeof record !== 'object') continue;
        const id = String(record.id || '').trim();
        if (!id || seen.has(id) || isDesktopStaticPage2AppLayoutId(id)) continue;
        if (id.startsWith('app-') && dockAppIds.has(id.slice(4))) continue;
        const type = String(record.type || (id.startsWith('app-') ? 'app' : 'builtin'));
        const kind = String(record.kind || '');
        if (type === 'custom' && !DESKTOP_CUSTOM_WIDGET_KINDS.has(kind)) continue;
        if (type === 'custom' && id === DESKTOP_DEFAULT_PRINCESS_ID) continue;
        const page = Number(record.page);
        seen.add(id);
        normalized.unshift({
            ...record,
            id,
            type,
            kind,
            page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 0
        });
    }
    return normalized;
}

function hasDesktopMeasurableLayoutCanvas() {
    return Array.from(document.querySelectorAll('#pages-container .desktop-scroll-area.layout-canvas'))
        .some(hasDesktopUsableLayoutBounds);
}

function persistDesktopLayoutRepair(existing = null) {
    let saved = existing;
    if (!saved) {
        try {
            saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}') || {};
        } catch (e) {
            saved = {};
        }
    }
    const hadSavedLayout = Array.isArray(saved.items) || Array.isArray(saved.dock) || Array.isArray(saved.deletedBuiltins);
    if (!hadSavedLayout) return false;
    try {
        const now = Date.now();
        localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify({
            ...saved,
            items: collectDesktopLayout(),
            dock: collectDesktopDockLayout(),
            deletedBuiltins: collectDesktopDeletedBuiltinIds(),
            pageCount: getDesktopPages().length,
            savedAt: saved.savedAt || now,
            repairedAt: now
        }));
        _desktopLayoutNeedsVisiblePersist = false;
        return true;
    } catch (e) {
        console.warn('desktop layout repair persist failed:', e);
        return false;
    }
}

function clampDesktopVisibleLayoutItems() {
    let changed = false;
    document.querySelectorAll('#pages-container .desktop-scroll-area.layout-canvas').forEach(pageArea => {
        if (!hasDesktopUsableLayoutBounds(pageArea)) return;
        const oldWidth = pageArea._byndLayoutWidth || pageArea.clientWidth;
        pageArea.querySelectorAll(':scope > .desktop-layout-item').forEach(item => {
            const raw = { ...getDesktopRawStyleRect(item), id: item.dataset.layoutId, canvasWidth: oldWidth };
            if (!item._byndResponsiveBase || desktopRectsDiffer(raw, item._byndResponsiveApplied, 0.1)) item._byndResponsiveBase = raw;
            const safeRect = clampDesktopLayoutRect(projectDesktopLayoutRect(item._byndResponsiveBase, pageArea.clientWidth), pageArea);
            if (setDesktopLayoutItemRect(item, safeRect)) changed = true;
            item._byndResponsiveApplied = getDesktopRawStyleRect(item);
        });
        pageArea._byndLayoutWidth = pageArea.clientWidth;
    });
    return changed;
}

function repairDesktopLayoutForVisibleViewport(options = {}) {
    const home = document.getElementById('home-screen');
    if (home?.classList.contains('hidden') || window._editMode) return false;
    let changed = false;
    if (clampDesktopVisibleLayoutItems()) changed = true;
    if (repairDesktopLayoutOverlaps()) changed = true;
    if ((changed || _desktopLayoutNeedsVisiblePersist) && options.persist !== false) {
        persistDesktopLayoutRepair(options.saved || null);
    }
    return changed;
}

function scheduleDesktopVisibleLayoutRepair(options = {}) {
    if (window._desktopVisibleLayoutRepairPending) return;
    window._desktopVisibleLayoutRepairPending = true;
    const run = () => {
        window._desktopVisibleLayoutRepairPending = false;
        repairDesktopLayoutForVisibleViewport({ persist: true, ...options });
    };
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(run));
    } else {
        setTimeout(run, 0);
    }
}

function exitEditMode(saveChanges) {
    if (!window._editMode) return;
    window._editMode = false;
    document.getElementById('home-screen')?.classList.remove('desktop-editing');
    clearDesktopEditChrome();
    resetDesktopInteractionStateAfterEdit();
    window._desktopSelectedLayoutItem = null;
    if (!saveChanges && _desktopLayoutBackupHtml) {
        if (_desktopPage2CustomBackup == null) localStorage.removeItem('bynd_desktop_page2_custom_v1');
        else localStorage.setItem('bynd_desktop_page2_custom_v1', _desktopPage2CustomBackup);
        if (_desktopFoldersBackup == null) localStorage.removeItem(DESKTOP_FOLDER_STORAGE_KEY);
        else localStorage.setItem(DESKTOP_FOLDER_STORAGE_KEY, _desktopFoldersBackup);
        window._folders = JSON.parse(_desktopFoldersBackup || '[]');
        if (_desktopDefaultPrincessDeletedBackup == null) {
            localStorage.removeItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY);
        } else {
            localStorage.setItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY, _desktopDefaultPrincessDeletedBackup);
        }
        if (_desktopStickyNotesBackup == null) {
            localStorage.removeItem(DESKTOP_STICKY_NOTES_KEY);
        } else {
            localStorage.setItem(DESKTOP_STICKY_NOTES_KEY, _desktopStickyNotesBackup);
        }
        if (_desktopDefaultLovelyDeletedBackup == null) {
            localStorage.removeItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY);
        } else {
            localStorage.setItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY, _desktopDefaultLovelyDeletedBackup);
        }
        if (_desktopLovelyPrefsBackup == null) {
            localStorage.removeItem(DESKTOP_LOVELY_WIDGET_PREFS_KEY);
        } else {
            localStorage.setItem(DESKTOP_LOVELY_WIDGET_PREFS_KEY, _desktopLovelyPrefsBackup);
        }
        const oldPages = document.getElementById('pages-container');
        const newPages = oldPages.cloneNode(false);
        newPages.innerHTML = _desktopLayoutBackupHtml;
        oldPages.replaceWith(newPages);
        const dock = document.querySelector('#home-screen .dock-bar');
        if (dock) dock.innerHTML = _desktopDockBackupHtml || _desktopDefaultDockHtml || dock.innerHTML;
        _desktopLayoutApplied = false;
        setTimeout(() => {
            initFolderDrag();
            restoreDesktopRuntimeAfterEdit();
        }, 0);
    } else {
        setTimeout(restoreDesktopRuntimeAfterEdit, 0);
    }
    clearDesktopPageSlotRects();
    _desktopDefaultPrincessDeletedBackup = null;
    _desktopDefaultLovelyDeletedBackup = null;
    _desktopStickyNotesBackup = null;
    _desktopLovelyPrefsBackup = null;
    _desktopPage2CustomBackup = null;
    _desktopFoldersBackup = null;
    _desktopDockBackupHtml = '';
}

function applySavedDesktopLayout() {
    if (_desktopLayoutApplied) return;
    let saved;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}');
    } catch (e) {
        return;
    }
    if (Array.isArray(saved.dock)) applyDesktopDockLayout(saved.dock);
    const deletedBuiltins = Array.isArray(saved.deletedBuiltins)
        ? saved.deletedBuiltins.filter(id => DESKTOP_DELETABLE_BUILTIN_IDS.has(String(id || '')))
        : [];
    if ((!Array.isArray(saved.items) || !saved.items.length) && !deletedBuiltins.length) {
        _desktopLayoutApplied = false;
        return;
    }
    _desktopLayoutApplied = true;
    const rawSavedItems = Array.isArray(saved.items) ? saved.items : [];
    const savedItems = normalizeDesktopSavedLayoutItems(rawSavedItems, saved.dock);
    const savedItemsSanitized = savedItems.length !== rawSavedItems.length
        || savedItems.some((item, index) => item.id !== String(rawSavedItems[index]?.id || '').trim());
    const pageCount = Math.max(saved.pageCount || 0, ...savedItems.map(item => (item.page || 0) + 1), 1);
    for (let i = 0; i < pageCount; i += 1) ensureDesktopPage(i);
    const pages = getDesktopPages();
    pages.forEach(page => page.querySelector('.desktop-scroll-area')?.classList.add('layout-canvas'));
    deletedBuiltins.forEach(removeDesktopBuiltinElementById);
    savedItems.forEach(record => {
        if (isDesktopStaticPage2AppLayoutId(record && record.id)) return;
        if (record && String(record.id || '').startsWith('app-') && Array.isArray(saved.dock) && saved.dock.includes(String(record.id).slice(4))) return;
        if (record.type === 'custom' && !DESKTOP_CUSTOM_WIDGET_KINDS.has(record.kind)) return;
        if (record.type === 'custom' && record.id === DESKTOP_DEFAULT_PRINCESS_ID) return;
        const page = pages[Math.max(0, Math.min(pages.length - 1, record.page || 0))];
        const area = page?.querySelector('.desktop-scroll-area');
        if (!area) return;
        let item = record.type === 'custom'
            ? createDesktopCustomWidget(record.kind || 'album', record.id)
            : findDesktopBuiltinElement(record.id);
        if (!item) return;
        area.appendChild(item);
        const canvasWidth = record.canvasWidth || inferDesktopLegacyCanvasWidth(savedItems.filter(entry => entry.page === record.page), area.clientWidth);
        prepareDesktopLayoutItem(item, area, { ...record, canvasWidth });
        if (canvasWidth !== area.clientWidth || !record.canvasWidth) _desktopLayoutNeedsVisiblePersist = true;
        area.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
        page.querySelectorAll('.bento-box').forEach(el => el.classList.add('layout-source-hidden'));
    });
    // Saved layouts intentionally preserve the user's arrangement. New built-in apps
    // therefore need an explicit migration instead of relying on the static HTML grid.
    // Keep Living World directly under PageMate on page two when an older layout lacks it.
    const hasLivingWorld = savedItems.some(item => item?.id === 'app-living-world')
        || (Array.isArray(saved.dock) && saved.dock.includes('living-world'));
    let livingWorldAdded = false;
    if (!hasLivingWorld) {
        const area = ensureDesktopPage(1)?.querySelector('.desktop-scroll-area');
        const app = DESKTOP_APPS.find(item => item.id === 'living-world');
        const pageMate = Array.from(area?.querySelectorAll('.desktop-layout-item.layout-app') || [])
            .find(item => getDesktopAppIdFromElement(item) === 'coread');
        if (area && app && pageMate) {
            const mateRect = getDesktopStyleRect(pageMate, area);
            const metrics = getDesktopFourColumnAppGridMetrics(area);
            const item = createDesktopAppElement(app);
            prepareDesktopLayoutItem(item, area, {
                left: mateRect?.left ?? metrics.startX,
                top: (mateRect?.top ?? metrics.startY) + (mateRect?.height ?? metrics.iconHeight) + metrics.gapY,
                width: mateRect?.width ?? metrics.iconWidth,
                height: mateRect?.height ?? metrics.iconHeight,
                canvasWidth: area.clientWidth
            });
            livingWorldAdded = true;
            _desktopLayoutNeedsVisiblePersist = true;
        }
    }
    const hasComic = savedItems.some(item => item?.id === 'app-comic')
        || (Array.isArray(saved.dock) && saved.dock.includes('comic'));
    let comicAdded = false;
    if (!hasComic) {
        const area = ensureDesktopPage(1)?.querySelector('.desktop-scroll-area');
        const app = DESKTOP_APPS.find(item => item.id === 'comic');
        const album = Array.from(area?.querySelectorAll('.desktop-layout-item.layout-app') || [])
            .find(item => getDesktopAppIdFromElement(item) === 'album');
        if (area && app) {
            const albumRect = album && getDesktopStyleRect(album, area);
            const metrics = getDesktopFourColumnAppGridMetrics(area);
            const item = createDesktopAppElement(app);
            const preferredRect = {
                left: albumRect?.left ?? metrics.startX,
                top: (albumRect?.top ?? metrics.startY) + (albumRect?.height ?? metrics.iconHeight) + metrics.gapY,
                width: albumRect?.width ?? metrics.iconWidth,
                height: albumRect?.height ?? metrics.iconHeight
            };
            const canonicalGrid = getDesktopOrderedSlotItems(area, true).length === DESKTOP_PAGE2_APP_IDS.size - 1
                && getDesktopOrderedSlotItems(area, true).every(entry => DESKTOP_PAGE2_APP_IDS.has(getDesktopAppIdFromElement(entry)));
            let targetArea = area;
            let rect = findDesktopComicBesidePetRect(targetArea, item)
                || (canonicalGrid ? getDesktopComicProvisionalPetRect(targetArea, item) : null)
                || findDesktopComicClearRect(targetArea, item, preferredRect);
            if (!rect) {
                targetArea = ensureDesktopPage(getDesktopPages().length)?.querySelector('.desktop-scroll-area');
                rect = findDesktopComicClearRect(targetArea, item, null);
            }
            if (targetArea && rect) {
                prepareDesktopLayoutItem(item, targetArea, { ...rect, canvasWidth: targetArea.clientWidth });
                if (canonicalGrid && targetArea === area) area.dataset.comicAutoLayout = '1';
                comicAdded = true;
                _desktopLayoutNeedsVisiblePersist = true;
            }
        }
    }
    pages.forEach(page => {
        page.querySelectorAll(':scope > .desktop-scroll-area > .calendar-widget:not(.desktop-layout-item), :scope > .desktop-scroll-area > .photo-large:not(.desktop-layout-item)').forEach(el => {
            el.classList.add('layout-source-hidden');
        });
        page.querySelectorAll(':scope > .desktop-scroll-area > .app-item:not(.desktop-layout-item)').forEach(el => {
            el.classList.add('layout-source-hidden');
        });
        page.querySelectorAll(':scope > .desktop-scroll-area > .page2-app-grid').forEach(el => {
            el.classList.add('layout-source-hidden');
        });
    });
    const repaired = repairDesktopLayoutOverlaps();
    if (savedItemsSanitized || repaired || livingWorldAdded || comicAdded) {
        if (hasDesktopMeasurableLayoutCanvas()) {
            persistDesktopLayoutRepair(saved);
        } else {
            _desktopLayoutNeedsVisiblePersist = true;
        }
    }
    updateDesktopStatusWidgets();
}
