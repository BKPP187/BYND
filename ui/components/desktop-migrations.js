function migrateDesktopDefaultPrincessWidget() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}');
    } catch (e) {
        saved = null;
    }
    if (saved && Array.isArray(saved.items) && saved.items.some(item => item && item.id === DESKTOP_DEFAULT_PRINCESS_ID)) {
        saved.items = saved.items.filter(item => item && item.id !== DESKTOP_DEFAULT_PRINCESS_ID);
        localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(saved));
    }
    const notes = getDesktopStickyNotes();
    if (Object.prototype.hasOwnProperty.call(notes, DESKTOP_DEFAULT_PRINCESS_ID)) {
        delete notes[DESKTOP_DEFAULT_PRINCESS_ID];
        localStorage.setItem(DESKTOP_STICKY_NOTES_KEY, JSON.stringify(notes));
    }
    localStorage.removeItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY);
}

function migrateDesktopDefaultLovelyWidget() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}');
    } catch (e) {
        saved = null;
    }
    if (!saved || !Array.isArray(saved.items)) return;
    let changed = false;
    saved.items.forEach(item => {
        if (!item || item.id !== DESKTOP_DEFAULT_LOVELY_ID) return;
        const top = Number(item.top);
        const isLegacyTop = Number.isFinite(top) && top <= DESKTOP_DEFAULT_LOVELY_LEGACY_TOP + 24;
        const isPreviousDefaultTop = Number.isFinite(top) && Math.abs(top - DESKTOP_DEFAULT_LOVELY_OLD_TOP) <= 24;
        if (isLegacyTop || isPreviousDefaultTop) {
            item.top = DESKTOP_DEFAULT_LOVELY_TOP;
            changed = true;
        }
        const height = Number(item.height);
        const defaultHeight = getDesktopCustomWidgetSize('lovely').height;
        if (!Number.isFinite(height) || height < defaultHeight || height > defaultHeight * 1.35 || height === 264 || height === 304) {
            item.height = defaultHeight;
            changed = true;
        }
        const width = Number(item.width);
        const defaultWidth = getDesktopCustomWidgetSize('lovely').width;
        if (!Number.isFinite(width) || width < 260 || width > defaultWidth * 1.25) {
            item.width = defaultWidth;
            changed = true;
        }
    });
    if (changed) localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(saved));
}

function migrateDesktopStoryAppsToIcons() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}');
    } catch (e) {
        saved = null;
    }
    if (!saved || !Array.isArray(saved.items)) return;
    const before = saved.items.length;
    saved.items = saved.items.filter(item => !isDesktopStaticPage2AppLayoutId(item && item.id));
    const changed = saved.items.length !== before;
    if (changed) localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(saved));
}

function migrateDesktopManualApp() {
    let saved;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}') || {};
    } catch (e) {
        return false;
    }
    const hasSavedLayout = Array.isArray(saved.items) || Array.isArray(saved.dock) || Array.isArray(saved.deletedBuiltins);
    if (!hasSavedLayout) return false;
    const hasManualInFolder = (Array.isArray(window._folders) ? window._folders : []).some(folder =>
        (Array.isArray(folder?.apps) ? folder.apps : []).some(app => String(app?.id || app) === 'manual')
    );
    const hasManualInSavedLayout = (Array.isArray(saved.items) ? saved.items : []).some(item => String(item?.id || '') === 'app-manual');
    const hasManualInSavedDock = (Array.isArray(saved.dock) ? saved.dock : []).some(appId => String(appId) === 'manual');
    const hasManualOnDesktop = Array.from(document.querySelectorAll('#pages-container .desktop-layout-item.layout-app'))
        .some(item => getDesktopAppIdFromElement(item) === 'manual');
    const hasManualInDock = collectDesktopDockLayout().includes('manual');
    if (hasManualInFolder || hasManualInSavedLayout || hasManualInSavedDock || hasManualOnDesktop || hasManualInDock) return false;

    const area = ensureDesktopPage(1)?.querySelector('.desktop-scroll-area');
    const app = DESKTOP_APPS.find(item => item.id === 'manual');
    if (!area?.classList.contains('layout-canvas') || !app) return false;
    // Prefer page 2, then scan later pages and create one more page when all existing slots are full.
    // This keeps the manual reachable for users with a completely customized desktop.
    const item = addDesktopAppAfterFolderPage(app, area, 0);
    if (!item) return false;
    if (hasDesktopMeasurableLayoutCanvas()) {
        persistDesktopLayoutRepair(saved);
    } else {
        _desktopLayoutNeedsVisiblePersist = true;
    }
    return true;
}

function migrateDesktopMcpApp() {
    let saved;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}') || {};
    } catch (e) {
        return false;
    }
    const hasSavedLayout = Array.isArray(saved.items) || Array.isArray(saved.dock) || Array.isArray(saved.deletedBuiltins);
    if (!hasSavedLayout) return false;
    const hasMcpInFolder = (Array.isArray(window._folders) ? window._folders : []).some(folder =>
        (Array.isArray(folder?.apps) ? folder.apps : []).some(app => String(app?.id || app) === 'mcp')
    );
    const hasMcpInSavedLayout = (Array.isArray(saved.items) ? saved.items : []).some(item => String(item?.id || '') === 'app-mcp');
    const hasMcpInSavedDock = (Array.isArray(saved.dock) ? saved.dock : []).some(appId => String(appId) === 'mcp');
    const hasMcpOnDesktop = Array.from(document.querySelectorAll('#pages-container .desktop-layout-item.layout-app'))
        .some(item => getDesktopAppIdFromElement(item) === 'mcp');
    const hasMcpInDock = collectDesktopDockLayout().includes('mcp');
    if (hasMcpInFolder || hasMcpInSavedLayout || hasMcpInSavedDock || hasMcpOnDesktop || hasMcpInDock) return false;

    const area = ensureDesktopPage(1)?.querySelector('.desktop-scroll-area');
    const app = DESKTOP_APPS.find(item => item.id === 'mcp');
    if (!area?.classList.contains('layout-canvas') || !app) return false;
    const item = addDesktopAppAfterFolderPage(app, area, 1);
    if (!item) return false;
    if (hasDesktopMeasurableLayoutCanvas()) {
        persistDesktopLayoutRepair(saved);
    } else {
        _desktopLayoutNeedsVisiblePersist = true;
    }
    return true;
}

function migrateDesktopPetApp() {
    const migrationKey = 'bynd_desktop_pet_entry_v1';
    let saved;
    try {
        if (localStorage.getItem(migrationKey) === '1') return false;
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}') || {};
    }
    catch (_) { return false; }
    const remember = () => { try { localStorage.setItem(migrationKey, '1'); } catch (_) {} };
    if (!Array.isArray(saved.items) && !Array.isArray(saved.dock) && !Array.isArray(saved.deletedBuiltins)) { remember(); return false; }
    // Respect custom folders, dock placement and a user's explicit removal of this entry.
    if (Array.isArray(saved.deletedBuiltins) && saved.deletedBuiltins.some(id => id === 'app-pet' || id === 'pet')) { remember(); return false; }
    const inFolder = (Array.isArray(window._folders) ? window._folders : []).some(folder => (Array.isArray(folder?.apps) ? folder.apps : []).some(app => String(app?.id || app) === 'pet'));
    const inSaved = (Array.isArray(saved.items) ? saved.items : []).some(item => item?.id === 'app-pet') || (Array.isArray(saved.dock) ? saved.dock : []).includes('pet');
    const onDesktop = Array.from(document.querySelectorAll('#pages-container .desktop-layout-item.layout-app')).some(item => getDesktopAppIdFromElement(item) === 'pet');
    if (inFolder || inSaved) { remember(); return false; }
    if (onDesktop || collectDesktopDockLayout().includes('pet')) {
        if (hasDesktopMeasurableLayoutCanvas() && persistDesktopLayoutRepair(saved)) remember();
        else _desktopLayoutNeedsVisiblePersist = true;
        return false;
    }
    const area = ensureDesktopPage(1)?.querySelector('.desktop-scroll-area');
    const app = DESKTOP_APPS.find(item => item.id === 'pet');
    if (!area?.classList.contains('layout-canvas') || !app) return false;
    if (!addDesktopAppAfterFolderPage(app, area, 1)) return false;
    if (hasDesktopMeasurableLayoutCanvas() && persistDesktopLayoutRepair(saved)) remember();
    else _desktopLayoutNeedsVisiblePersist = true;
    return true;
}

// 账单 ships in the default dock. Saved layouts replace the dock HTML, so existing users
// get it appended to their own dock when a slot is free; a full dock is never evicted —
// the app goes to the first open desktop slot instead (same placement as 说明书 / MCP).
function planDesktopBillDockEntry(saved, currentDock, placedElsewhere) {
    const safe = saved && typeof saved === 'object' ? saved : {};
    const hasSavedLayout = Array.isArray(safe.items) || Array.isArray(safe.dock) || Array.isArray(safe.deletedBuiltins);
    if (!hasSavedLayout || !Array.isArray(safe.dock)) return { action: 'default' };
    const dock = (Array.isArray(currentDock) ? currentDock : safe.dock).map(appId => String(appId || '')).filter(Boolean);
    const inSaved = safe.dock.some(appId => String(appId) === 'bill')
        || (Array.isArray(safe.items) ? safe.items : []).some(item => String(item?.id || '') === 'app-bill');
    if (placedElsewhere || inSaved || dock.includes('bill')) return { action: 'present' };
    if (dock.length < DESKTOP_DOCK_LAYOUT_MAX) return { action: 'dock', dock: [...dock, 'bill'] };
    return { action: 'desktop' };
}

function migrateDesktopBillDockApp() {
    const migrationKey = 'bynd_desktop_bill_dock_v1';
    let saved;
    try {
        if (localStorage.getItem(migrationKey) === '1') return false;
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}') || {};
    } catch (_) { return false; }
    const remember = () => { try { localStorage.setItem(migrationKey, '1'); } catch (_) {} };
    const inFolder = (Array.isArray(window._folders) ? window._folders : []).some(folder => (Array.isArray(folder?.apps) ? folder.apps : []).some(app => String(app?.id || app) === 'bill'));
    const onDesktop = Array.from(document.querySelectorAll('#pages-container .desktop-layout-item.layout-app')).some(item => getDesktopAppIdFromElement(item) === 'bill');
    const plan = planDesktopBillDockEntry(saved, collectDesktopDockLayout(), inFolder || onDesktop);
    if (plan.action === 'default' || plan.action === 'present') { remember(); return false; }
    if (plan.action === 'dock') {
        const dock = document.querySelector('#home-screen .dock-bar');
        if (!dock) return false;
        dock.appendChild(createDesktopDockItem('bill'));
        refreshDesktopDockOrder();
        try {
            localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify({ ...saved, dock: collectDesktopDockLayout() }));
            remember();
        } catch (e) {
            console.warn('bill dock migration persist failed:', e);
        }
        return true;
    }
    const area = ensureDesktopPage(1)?.querySelector('.desktop-scroll-area');
    if (!area?.classList.contains('layout-canvas')) return false;
    if (!addDesktopAppAfterFolderPage(getDesktopAppDefinition('bill'), area, 2)) return false;
    if (hasDesktopMeasurableLayoutCanvas() && persistDesktopLayoutRepair(saved)) remember();
    else _desktopLayoutNeedsVisiblePersist = true;
    return true;
}

function cleanupRemovedWatchTogetherData() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}') || {};
    } catch (e) {
        saved = null;
    }
    if (saved) {
        const items = Array.isArray(saved.items) ? saved.items : [];
        const dock = Array.isArray(saved.dock) ? saved.dock : [];
        const deletedBuiltins = Array.isArray(saved.deletedBuiltins) ? saved.deletedBuiltins : [];
        const nextItems = items.filter(item => String(item?.id || '') !== 'app-watch');
        const nextDock = dock.filter(appId => String(appId || '') !== 'watch');
        const nextDeletedBuiltins = deletedBuiltins.filter(id => !['app-watch', 'watch'].includes(String(id || '')));
        if (nextItems.length !== items.length
            || nextDock.length !== dock.length
            || nextDeletedBuiltins.length !== deletedBuiltins.length) {
            localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify({
                ...saved,
                items: nextItems,
                dock: nextDock,
                deletedBuiltins: nextDeletedBuiltins
            }));
        }
    }

    const folders = Array.isArray(window._folders) ? window._folders : [];
    let foldersChanged = false;
    const nextFolders = folders.flatMap(folder => {
        const apps = Array.isArray(folder?.apps) ? folder.apps : [];
        const nextApps = apps.filter(app => String(app?.id || app || '') !== 'watch');
        if (nextApps.length === apps.length) return [folder];
        foldersChanged = true;
        return nextApps.length ? [{ ...folder, apps: nextApps }] : [];
    });
    if (foldersChanged) {
        window._folders = nextFolders;
        saveFolders();
    }

    let charactersChanged = false;
    if (Array.isArray(window.myCharacters)) {
        window.myCharacters.forEach(char => {
            if (!char?.chatConfig || !Object.prototype.hasOwnProperty.call(char.chatConfig, 'aiPhoneWatch')) return;
            delete char.chatConfig.aiPhoneWatch;
            charactersChanged = true;
        });
    }
    if (charactersChanged && typeof saveCharactersToStorage === 'function') saveCharactersToStorage();

    localStorage.removeItem('bynd_watch_together_char_v1');
    delete window._watchTogetherCharId;
    delete window._wechatAiPhoneWatchRuntime;
    document.querySelectorAll('[data-app-id="watch"], [data-layout-id="app-watch"]').forEach(item => item.remove());
}

function ensureMonitorDesktopEntry() {
    const page = ensureDesktopPage(1);
    const area = page?.querySelector('.desktop-scroll-area');
    if (!area) return;
    if (area.classList.contains('layout-canvas') || area.querySelector(':scope > .desktop-layout-item')) {
        area.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
        return;
    }

    let grid = area.querySelector(':scope > .page2-app-grid');
    if (!grid) {
        grid = document.createElement('div');
        grid.className = 'page2-app-grid';
        area.insertBefore(grid, area.firstChild);
    }

    ['dream', 'monitor', 'pet', 'outing', 'coread', 'album', 'comic', 'manual', 'mcp'].forEach(appId => {
        if (grid.querySelector(`:scope > .app-item[data-app-id="${appId}"]`)) return;
        const app = DESKTOP_APPS.find(item => item.id === appId);
        if (!app) return;
        const item = createDesktopAppElement(app);
        item.classList.remove('desktop-layout-item', 'layout-app', 'selected');
        item.removeAttribute('style');
        grid.appendChild(item);
    });
    area.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
}

function startDesktopLayoutFromTheme() {
    if (typeof closeApp === 'function') closeApp('theme');
    setTimeout(() => {
        if (typeof unlockPhone === 'function') unlockPhone();
        if (!_desktopLayoutApplied) applySavedDesktopLayout();
        enterEditMode();
    }, 360);
}

function initEditMode() {
    const home = document.getElementById('home-screen');
    if (!home || home.dataset.editInit === '1') return;
    const pages = document.getElementById('pages-container');
    if (pages && !_desktopDefaultLayoutHtml) _desktopDefaultLayoutHtml = pages.innerHTML;
    const dock = document.querySelector('#home-screen .dock-bar');
    if (dock && !_desktopDefaultDockHtml) _desktopDefaultDockHtml = dock.innerHTML;
    home.dataset.editInit = '1';
    window.addEventListener('resize', () => scheduleDesktopVisibleLayoutRepair());
    ['contextmenu', 'dragstart', 'selectstart'].forEach(type => {
        home.addEventListener(type, suppressDesktopNativeLongPress, true);
    });
    home.addEventListener('pointerdown', startDesktopEditLongPress, true);
    ['pointerup', 'pointercancel', 'pointerleave', 'pointermove'].forEach(type => {
        home.addEventListener(type, cancelDesktopEditLongPress, true);
    });
    home.addEventListener('touchstart', startDesktopEditLongPress, { capture: true, passive: true });
    ['touchend', 'touchcancel', 'touchmove'].forEach(type => {
        home.addEventListener(type, cancelDesktopEditLongPress, { capture: true, passive: true });
    });
    home.addEventListener('click', (e) => {
        if (!_desktopLongPressTriggered) return;
        if (e.target.closest('.desktop-edit-toolbar, .desktop-widget-library, .desktop-save-modal')) {
            _desktopLongPressTriggered = false;
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        _desktopLongPressTriggered = false;
    }, true);
    setTimeout(() => {
        migrateDesktopDefaultPrincessWidget();
        migrateDesktopDefaultLovelyWidget();
        migrateDesktopStoryAppsToIcons();
        applySavedDesktopLayout();
        migrateDesktopManualApp();
        migrateDesktopMcpApp();
        migrateDesktopPetApp();
        migrateDesktopBillDockApp();
        ensureMonitorDesktopEntry();
        ensureDesktopLovelyWidget();
        setupDesktopDockEditing();
        syncDesktopPagesAndDots(Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0);
        scheduleDesktopVisibleLayoutRepair();
    }, 50);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => byndStylesReady.then(initEditMode));
} else {
    byndStylesReady.then(initEditMode);
}
