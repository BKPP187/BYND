// --- 📁 文件夹系统 ---
const DESKTOP_FOLDER_STORAGE_KEY = 'desktop_folders';
const DESKTOP_LAYOUT_KEY = 'desktop_layout_v2';
window._folders = JSON.parse(localStorage.getItem(DESKTOP_FOLDER_STORAGE_KEY) || '[]');

function saveFolders() {
    localStorage.setItem(DESKTOP_FOLDER_STORAGE_KEY, JSON.stringify(window._folders));
}

function desktopEscapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function desktopEscapeAttr(value) {
    return desktopEscapeHtml(value).replace(/"/g, '&quot;');
}

function getDesktopAppDefinition(appRef) {
    const id = typeof appRef === 'string' ? appRef : appRef?.id;
    const name = typeof appRef === 'object' ? appRef?.name : '';
    const base = getDesktopAnyAppDefinition(appRef);
    return {
        id: base?.id || id || name || '',
        name: base?.name || name || '应用',
        icon: base?.icon || appRef?.icon || 'ri-apps-line'
    };
}

function normalizeDesktopAppRef(appRef) {
    const app = getDesktopAppDefinition(appRef);
    return app.id ? { id: app.id } : app;
}

function normalizeDesktopFolder(folder) {
    const safe = folder && typeof folder === 'object' ? folder : {};
    const apps = Array.isArray(safe.apps) ? safe.apps.map(normalizeDesktopAppRef).filter(app => app.id) : [];
    return {
        id: safe.id || `folder_${Date.now()}`,
        name: String(safe.name || '文件夹').trim() || '文件夹',
        apps,
        width: Number(safe.width) || null,
        height: Number(safe.height) || null,
        size: safe.size === 'large' ? 'large' : 'small'
    };
}

function normalizeDesktopFolders() {
    window._folders = (Array.isArray(window._folders) ? window._folders : []).map(normalizeDesktopFolder).filter(folder => folder.apps.length > 0);
}

function getDesktopFolderApps(folder) {
    return (Array.isArray(folder?.apps) ? folder.apps : []).map(getDesktopAppDefinition).filter(app => app.id);
}

function getDesktopThemeData(source) {
    if (source && typeof source === 'object') return source;
    try {
        return JSON.parse(localStorage.getItem('my_theme_data') || '{}') || {};
    } catch (e) {
        return {};
    }
}

function getDesktopThemeIconUrl(appId, source) {
    const data = getDesktopThemeData(source);
    const appIndex = {
        wechat: 0,
        regex: 1,
        worldbook: 2,
        settings: 3,
        theme: 4,
        study: 5,
        money: 6,
        game: 7,
        dream: 8,
        monitor: 9,
        outing: 10,
        coread: 11,
        album: 12,
        music: 13,
        camera: 14,
        preset: 15,
        manual: 16,
        mcp: 17,
        pet: 18,
        'living-world': 19,
        comic: 20,
        bill: 21
    }[appId];
    let icons = Array.isArray(data.icons) ? data.icons : [];
    if (typeof normalizeThemeIconList === 'function') icons = normalizeThemeIconList(icons);
    return Number.isInteger(appIndex) ? String(icons[appIndex] || '').trim() : '';
}

function renderDesktopAppIcon(appRef, options = {}) {
    const app = getDesktopAppDefinition(appRef);
    const url = getDesktopThemeIconUrl(app.id, options.themeData);
    if (url) return `<img class="desktop-app-icon-img" src="${desktopEscapeAttr(url)}" alt="">`;
    return `<i class="${desktopEscapeAttr(app.icon)}"></i>`;
}

function getDesktopAppIdFromElement(item) {
    if (!item) return '';
    if (item.dataset.appId) return item.dataset.appId;
    const onclick = item.getAttribute('onclick') || '';
    const match = onclick.match(/openApp\(['"]([^'"]+)['"]\)/);
    if (match?.[1]) return match[1];
    const label = item.querySelector('span')?.textContent?.trim();
    return getDesktopAllAppDefinitions().find(app => app.name === label)?.id || '';
}

function hydrateDesktopAppElement(item) {
    const appId = getDesktopAppIdFromElement(item);
    if (!appId) return null;
    const app = getDesktopAppDefinition(appId);
    item.dataset.appId = app.id;
    if (!item.dataset.layoutId) item.dataset.layoutId = `app-${app.id}`;
    return app;
}

function syncDesktopFolderIcon(folderId) {
    const folder = window._folders.find(item => item.id === folderId);
    document.querySelectorAll('.app-item.is-folder').forEach(item => {
        if (item.dataset.folderId !== folderId || !folder) return;
        const icon = item.querySelector('.app-icon');
        const label = item.querySelector('span');
        if (icon) icon.innerHTML = renderDesktopFolderMiniIcons(folder);
        if (label) label.textContent = folder.name;
    });
}

function refreshDesktopThemedIcons(themeData) {
    document.querySelectorAll('.apps-quad .app-item:not(.is-folder), .page2-app-grid .app-item:not(.is-folder), .desktop-layout-item.app-item:not(.is-folder)').forEach(item => {
        const app = hydrateDesktopAppElement(item);
        if (!app) return;
        const icon = item.querySelector('.app-icon');
        const label = item.querySelector('span');
        if (icon) icon.innerHTML = renderDesktopAppIcon(app, { themeData });
        if (label) label.textContent = app.name;
    });
    document.querySelectorAll('.app-item.is-folder').forEach(item => {
        const folder = window._folders.find(folderItem => folderItem.id === item.dataset.folderId);
        const icon = item.querySelector('.app-icon');
        const label = item.querySelector('span');
        if (icon && folder) icon.innerHTML = renderDesktopFolderMiniIcons(folder, { themeData });
        if (label && folder) label.textContent = folder.name;
    });
    document.querySelectorAll('#folder-grid .folder-grid-item[data-app-id]').forEach(item => {
        const app = getDesktopAppDefinition(item.dataset.appId);
        const icon = item.querySelector('.app-icon');
        const label = item.querySelector('span');
        if (icon) icon.innerHTML = renderDesktopAppIcon(app, { themeData });
        if (label) label.textContent = app.name;
    });
    getDesktopDockItems().forEach(item => {
        const app = hydrateDesktopDockItem(item);
        if (!app) return;
        const icon = item.querySelector('.dock-icon-box');
        const label = item.querySelector('.dock-label');
        if (icon) icon.innerHTML = renderDesktopAppIcon(app, { themeData });
        if (label) label.textContent = app.name;
    });
}
window.refreshDesktopThemedIcons = refreshDesktopThemedIcons;

function applyFolderPopupSize(folder, popup) {
    if (!folder || !popup) return;
    const width = Math.max(240, Math.min(340, Number(folder.width) || 260));
    const height = Math.max(250, Math.min(520, Number(folder.height) || 0));
    popup.style.width = `${width}px`;
    popup.style.height = folder.height ? `${height}px` : '';
}

function saveFolderPopupSize(folderId, popup) {
    const folder = window._folders.find(item => item.id === folderId);
    if (!folder || !popup) return;
    folder.width = Math.round(popup.offsetWidth || 260);
    folder.height = Math.round(popup.offsetHeight || 0);
    saveFolders();
}

function ensureFolderResizeHandle(popup) {
    if (!popup || popup.querySelector('.folder-resize-handle')) return;
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'folder-resize-handle';
    handle.setAttribute('aria-label', '调整文件夹大小');
    handle.innerHTML = '<i class="ri-drag-move-2-line"></i>';
    handle.addEventListener('click', event => event.stopPropagation());
    handle.addEventListener('pointerdown', startFolderPopupResize);
    popup.appendChild(handle);
}

function startFolderPopupResize(e) {
    const popup = e.currentTarget.closest('.folder-popup');
    const overlay = popup?.closest('.folder-overlay');
    const folderId = popup?.dataset.folderId;
    if (!popup || !overlay || !folderId) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = popup.offsetWidth;
    const startHeight = popup.offsetHeight;
    const maxWidth = Math.max(260, overlay.clientWidth - 34);
    const maxHeight = Math.max(300, overlay.clientHeight - 120);
    if (typeof e.currentTarget.setPointerCapture === 'function') {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    }
    const move = ev => {
        const width = Math.max(240, Math.min(maxWidth, startWidth + ev.clientX - startX));
        const height = Math.max(250, Math.min(maxHeight, startHeight + ev.clientY - startY));
        popup.style.width = `${Math.round(width)}px`;
        popup.style.height = `${Math.round(height)}px`;
    };
    const up = () => {
        saveFolderPopupSize(folderId, popup);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

function createFolder(app1, app2) {
    const folder = {
        id: 'folder_' + Date.now(),
        name: '文件夹',
        apps: [normalizeDesktopAppRef(app1), normalizeDesktopAppRef(app2)],
        width: null,
        height: null,
        size: 'small'
    };
    window._folders.push(folder);
    saveFolders();
    rebuildDesktop();
    return folder;
}

function openFolder(folderId) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;

    const overlay = document.getElementById('folder-overlay');
    const grid = document.getElementById('folder-grid');
    const nameInput = document.getElementById('folder-name-input');
    const popup = overlay?.querySelector('.folder-popup');
    if (!overlay || !grid || !nameInput || !popup) return;

    const isEditing = !!window._editMode;
    popup.dataset.folderId = folderId;
    popup.classList.toggle('large-folder', folder.size === 'large');
    overlay.classList.toggle('folder-editing', isEditing);
    applyFolderPopupSize(folder, popup);
    ensureFolderResizeHandle(popup);
    nameInput.value = folder.name;
    nameInput.oninput = () => {
        folder.name = nameInput.value.trim() || '文件夹';
        saveFolders();
        syncDesktopFolderIcon(folderId);
    };

    grid.innerHTML = `
        <button type="button" class="folder-size-toggle" onclick="event.stopPropagation();toggleDesktopFolderSize('${desktopEscapeAttr(folderId)}')">
            <i class="${folder.size === 'large' ? 'ri-collapse-diagonal-line' : 'ri-expand-diagonal-line'}"></i>
            <span>${folder.size === 'large' ? '小文件夹' : '大文件夹'}</span>
        </button>
    `;
    getDesktopFolderApps(folder).forEach(app => {
        const item = document.createElement('div');
        item.className = 'app-item folder-grid-item';
        item.dataset.appId = app.id;
        item.dataset.folderId = folderId;
        item.onclick = (e) => {
            e.stopPropagation();
            if (window._editMode) {
                moveAppOutOfFolder(folderId, app.id, { keepOpen: true });
                return;
            }
            closeFolderOverlay();
            openApp(app.id);
        };
        item.innerHTML = `
            <div class="app-icon icon-black">${renderDesktopAppIcon(app)}</div>
            <span>${desktopEscapeHtml(app.name)}</span>
            <button type="button" class="folder-move-out-btn" aria-label="移出到桌面">
                <i class="ri-logout-box-r-line"></i>
            </button>
        `;
        item.querySelector('.folder-move-out-btn')?.addEventListener('click', (event) => {
            event.stopPropagation();
            moveAppOutOfFolder(folderId, app.id, { keepOpen: window._editMode });
        });
        grid.appendChild(item);
    });

    overlay.classList.remove('hidden');
}

function closeFolderOverlay(e) {
    if (e && e.target !== e.currentTarget) return;
    const overlay = document.getElementById('folder-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('folder-editing');
}

function toggleDesktopFolderSize(folderId) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;
    folder.size = folder.size === 'large' ? 'small' : 'large';
    if (folder.size === 'large') {
        folder.width = Math.max(Number(folder.width) || 260, 318);
        folder.height = Math.max(Number(folder.height) || 0, 430);
    } else {
        folder.width = 260;
        folder.height = null;
    }
    saveFolders();
    syncDesktopFolderIcon(folderId);
    openFolder(folderId);
}
window.toggleDesktopFolderSize = toggleDesktopFolderSize;

function resizeDesktopFolderLayoutIcon(folderId, isLarge) {
    const item = Array.from(document.querySelectorAll('.desktop-layout-item.is-folder')).find(el => el.dataset.folderId === folderId);
    const pageArea = item?.closest?.('.desktop-scroll-area');
    if (!item || !pageArea) return;
    const left = parseFloat(item.style.left) || item.offsetLeft || 24;
    const top = parseFloat(item.style.top) || item.offsetTop || 64;
    applyDesktopLayoutRect(item, pageArea, {
        left,
        top,
        width: isLarge ? 156 : 72,
        height: isLarge ? 132 : 76
    }, { mode: 'resize' });
}

function addToFolder(folderId, app) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;
    const appRef = normalizeDesktopAppRef(app);
    if (!folder.apps.find(a => a.id === appRef.id)) {
        folder.apps.push(appRef);
        saveFolders();
        rebuildDesktop();
        syncDesktopFolderIcon(folderId);
    }
}

function removeFromFolder(folderId, appId) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;
    folder.apps = folder.apps.filter(a => a.id !== appId);
    if (folder.apps.length <= 1) {
        window._folders = window._folders.filter(f => f.id !== folderId);
    }
    saveFolders();
    rebuildDesktop();
}

