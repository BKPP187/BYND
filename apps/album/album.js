// --- Chat Album / 相册 ---
const CHAT_ALBUM_KEY = 'bynd_chat_album_v1';

function getLegacyChatAlbumStore() {
    try {
        const list = JSON.parse(localStorage.getItem(CHAT_ALBUM_KEY) || '[]');
        return Array.isArray(list) ? list.filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

function getWechatAlbumMessageRows(char, msg) {
    if (!char?.id || !msg || msg.isMe || msg.imagePending || msg.imageError || !['image', 'image_stack'].includes(msg.type)) return [];
    const sources = msg.type === 'image_stack' ? (msg.images || msg.imageUrls || []) : [msg.imageUrl || msg.content || msg.url];
    return (Array.isArray(sources) ? sources : []).filter(url => typeof url === 'string' && /^(?:https?:\/\/|data:image\/)/i.test(url)).map((url, index) => ({
        id: `album_${char.id}_${msg.timestamp || msg.id || 'saved'}_${index}`,
        charId: char.id,
        charName: getCoReadCharName(char),
        avatar: char.avatar || DEFAULT_AVATAR,
        url,
        description: String(msg.description || msg.imagePrompt || '').slice(0, 260),
        prompt: String(msg.imagePrompt || '').slice(0, 800),
        createdAt: Number(msg.timestamp) || Date.now()
    }));
}

function getChatAlbumStore() {
    const rows = getLegacyChatAlbumStore();
    for (const char of (window.myCharacters || [])) {
        if (!char?.id) continue;
        rows.push(...(Array.isArray(char.chatConfig?.generatedImages) ? char.chatConfig.generatedImages : []));
        for (const msg of (char.history || [])) rows.push(...getWechatAlbumMessageRows(char, msg));
    }
    const seen = new Map();
    rows.forEach(row => {
        if (!row?.charId || typeof row.url !== 'string' || !/^(?:https?:\/\/|data:image\/)/i.test(row.url)) return;
        const key = row.charId + '\n' + row.url;
        if (!seen.has(key)) seen.set(key, row);
    });
    return Array.from(seen.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function saveChatAlbumStore(list) {
    // Store full-size images with the character's IndexedDB-backed data, not a second localStorage copy.
    const added = [];
    for (const row of (Array.isArray(list) ? list : [])) {
        const char = (window.myCharacters || []).find(item => item.id === row?.charId);
        if (!char) continue;
        char.chatConfig = char.chatConfig || {};
        const current = Array.isArray(char.chatConfig.generatedImages) ? char.chatConfig.generatedImages : [];
        if (current.some(item => item.url === row.url)) continue;
        char.chatConfig.generatedImages = [...current, row];
        added.push({ char, row });
    }
    if (!added.length && !window._chatAlbumSaveError) return false;
    try {
        if (await saveCharactersToStorage() === false) throw new Error('相册保存失败，请重试；图片仍可从聊天中查看。');
        window._chatAlbumSaveError = '';
        for (const char of (window.myCharacters || [])) for (const msg of (char.history || [])) delete msg.imageSaveError;
        // Release old duplicate data only after the full character snapshot is durable.
        const legacy = getLegacyChatAlbumStore();
        const remaining = legacy.filter(row => !(window.myCharacters || []).some(char => char.id === row.charId && char.chatConfig?.generatedImages?.some(image => image.url === row.url)));
        if (remaining.length < legacy.length) {
            try {
                if (remaining.length) localStorage.setItem(CHAT_ALBUM_KEY, JSON.stringify(remaining));
                else localStorage.removeItem(CHAT_ALBUM_KEY);
            } catch (error) { console.warn('旧相册缓存暂未清理，完整照片已保存', error); }
        }
        return added.length > 0;
    } catch (error) {
        for (const { char, row } of added) char.chatConfig.generatedImages = (char.chatConfig.generatedImages || []).filter(item => item !== row);
        window._chatAlbumSaveError = error.message || '相册保存失败';
        throw error;
    }
}

async function recordWechatGeneratedImageToAlbum(char, msg) {
    const rows = getWechatAlbumMessageRows(char, msg);
    if (!rows.length) return false;
    const saved = await saveChatAlbumStore(rows);
    const album = document.getElementById('app-album-window');
    if (album && !album.classList.contains('hidden')) {
        try { renderAlbumApp(); } catch (error) { console.warn('相册已保存，界面刷新失败', error); }
    }
    return saved;
}
window.recordWechatGeneratedImageToAlbum = recordWechatGeneratedImageToAlbum;

function renderAlbumApp() {
    const tabs = document.getElementById('album-char-tabs');
    const grid = document.getElementById('album-grid');
    const status = document.getElementById('album-status');
    if (!tabs || !grid) return;
    const chars = getCoReadCharacters();
    const store = getChatAlbumStore();
    const requested = window._albumActiveCharId || '';
    const active = chars.some(char => char.id === requested) ? requested : '';
    window._albumActiveCharId = active;
    tabs.innerHTML = `<button type="button" class="${active ? '' : 'active'}" onclick="selectAlbumChar('')"><i class="ri-gallery-line"></i><span>全部照片</span><em>${store.length}</em></button>` + chars.map(char => {
        const count = store.filter(item => item.charId === char.id).length;
        return `
            <button type="button" class="${char.id === active ? 'active' : ''}" onclick="selectAlbumChar('${musicEscapeAttr(char.id)}')">
                <img src="${musicEscapeAttr(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                <span>${musicEscapeHtml(getCoReadCharName(char))}</span>
                <em>${count}</em>
            </button>
        `;
    }).join('') || '<div class="album-empty">先导入角色卡</div>';
    const rows = store.filter(item => !active || item.charId === active);
    grid.innerHTML = rows.map(item => `
        <figure class="album-photo">
            <img src="${musicEscapeAttr(item.url)}" alt="${musicEscapeAttr(item.description || item.charName || '聊天图片')}" loading="lazy">
            <figcaption>
                <strong>${musicEscapeHtml(item.charName || '角色')}</strong>
                <span>${musicEscapeHtml(item.description || '聊天生成图片')}</span>
            </figcaption>
        </figure>
    `).join('') || `<div class="album-empty">${active ? '这个角色' : '相册'}还没有聊天生成图</div>`;
    if (status) status.innerHTML = window._chatAlbumSaveError ? `${store.length} 张 · <button type="button" onclick="initAlbumApp()">重试保存</button>` : `已收录 ${store.length} 张聊天生成图`;
}

async function initAlbumApp() {
    const status = document.getElementById('album-status');
    if (status) status.textContent = '读取照片中';
    try {
        if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
        await saveChatAlbumStore(getChatAlbumStore());
    } catch (error) {
        window._chatAlbumSaveError = error.message || '相册保存失败';
        if (typeof showWechatToast === 'function') showWechatToast(window._chatAlbumSaveError);
    } finally { renderAlbumApp(); }
}
window.initAlbumApp = initAlbumApp;

function selectAlbumChar(charId) {
    window._albumActiveCharId = charId || '';
    renderAlbumApp();
}
window.selectAlbumChar = selectAlbumChar;

const DESKTOP_DOCK_APP_DEFINITIONS = [
    { id: 'music', name: '音乐', icon: 'ri-music-2-fill' },
    { id: 'camera', name: '相机', icon: 'ri-camera-lens-line' },
    { id: 'preset', name: '预设', icon: 'ri-equalizer-line' },
    { id: 'bill', name: '账单', icon: 'ri-bill-line' }
];

const DESKTOP_APPS = [
    { id: 'wechat', name: '微信', icon: 'ri-wechat-line' },
    { id: 'regex', name: '正则', icon: 'ri-code-s-slash-line' },
    { id: 'worldbook', name: '世界书', icon: 'ri-book-read-line' },
    { id: 'settings', name: '设置', icon: 'ri-settings-4-line' },
    { id: 'theme', name: '美化', icon: 'ri-palette-line' },
    { id: 'study', name: '学习', icon: 'ri-graduation-cap-line' },
    { id: 'money', name: '记账', icon: 'ri-money-cny-box-line' },
    { id: 'game', name: 'Game', icon: 'ri-gamepad-line' },
    { id: 'dream', name: '盗梦空间', icon: 'ri-moon-cloudy-line' },
    { id: 'monitor', name: '监控', icon: 'ri-eye-line' },
    { id: 'pet', name: '桌宠', icon: 'ri-bear-smile-line' },
    { id: 'outing', name: '一起出门', icon: 'ri-map-pin-user-line' },
    { id: 'coread', name: 'PageMate', icon: 'ri-book-open-line' },
    { id: 'living-world', name: '论坛', icon: 'ri-discuss-line' },
    { id: 'album', name: '相册', icon: 'ri-image-2-line' },
    { id: 'comic', name: '漫画', icon: 'ri-booklet-line' },
    { id: 'manual', name: '说明书', icon: 'ri-book-2-line' },
    { id: 'mcp', name: 'MCP', icon: 'ri-github-fill' }
];
normalizeDesktopFolders();
saveFolders();

function getDesktopAllAppDefinitions() {
    const map = new Map();
    [...DESKTOP_APPS, ...DESKTOP_DOCK_APP_DEFINITIONS].forEach(app => {
        if (app && app.id && !map.has(app.id)) map.set(app.id, app);
    });
    return Array.from(map.values());
}

function getDesktopAnyAppDefinition(appRef) {
    const id = typeof appRef === 'string' ? appRef : appRef?.id;
    const name = typeof appRef === 'object' ? appRef?.name : '';
    return getDesktopAllAppDefinitions().find(app => app.id === id)
        || getDesktopAllAppDefinitions().find(app => app.name === name)
        || null;
}

function renderDesktopFolderMiniIcons(folder, options = {}) {
    return getDesktopFolderApps(folder).slice(0, 4).map(app => `<div class="folder-mini-icon">${renderDesktopAppIcon(app, options)}</div>`).join('');
}

function createDesktopAppElement(app) {
    const safeApp = getDesktopAppDefinition(app);
    const el = document.createElement('div');
    el.className = 'app-item';
    el.dataset.appId = safeApp.id;
    el.dataset.layoutId = `app-${safeApp.id}`;
    el.onclick = () => openApp(safeApp.id);
    el.innerHTML = `<div class="app-icon icon-black ${safeApp.id === 'mcp' ? 'mcp-desktop-icon' : ''}">${renderDesktopAppIcon(safeApp)}</div><span>${desktopEscapeHtml(safeApp.name)}</span>`;
    return el;
}

function createDesktopFolderElement(folder) {
    const el = document.createElement('div');
    el.className = `app-item is-folder ${folder?.size === 'large' ? 'folder-large-icon' : 'folder-small-icon'}`;
    el.dataset.folderId = folder.id;
    el.dataset.layoutId = `folder-${folder.id}`;
    el.dataset.layoutType = 'folder';
    el.dataset.folderSize = folder?.size === 'large' ? 'large' : 'small';
    el.onclick = () => openFolder(folder.id);
    el.innerHTML = `<div class="app-icon">${renderDesktopFolderMiniIcons(folder)}</div><span>${desktopEscapeHtml(folder.name)}</span>`;
    return el;
}

function rebuildDesktop() {
    const quads = document.querySelectorAll('.apps-quad');
    if (quads.length < 2) return;

    const folderAppIds = new Set();
    window._folders.forEach(f => f.apps.forEach(a => folderAppIds.add(a.id)));

    const freeApps = DESKTOP_APPS.filter(a => !folderAppIds.has(a.id));
    const allItems = [...window._folders.map(f => ({ type: 'folder', data: f })), ...freeApps.map(a => ({ type: 'app', data: a }))];

    quads.forEach((quad, qi) => {
        quad.innerHTML = '';
        const start = qi * 4;
        const slice = allItems.slice(start, start + 4);
        slice.forEach(item => {
            if (item.type === 'folder') {
                quad.appendChild(createDesktopFolderElement(item.data));
            } else {
                quad.appendChild(createDesktopAppElement(item.data));
            }
        });
    });
}

function initFolderDrag() {
    const quads = document.querySelectorAll('.apps-quad');
    let dragSrc = null;
    let longPressTimer = null;

    quads.forEach(quad => {
        quad.querySelectorAll('.app-item:not(.is-folder)').forEach(item => {
            item.setAttribute('draggable', 'true');
            item.addEventListener('dragstart', (e) => {
                const appId = item.dataset.appId;
                const appName = item.querySelector('span')?.textContent;
                const app = DESKTOP_APPS.find(a => a.id === appId) || DESKTOP_APPS.find(a => a.name === appName);
                if (app) {
                    dragSrc = app;
                    e.dataTransfer.setData('text/plain', app.id);
                    item.style.opacity = '0.4';
                }
            });
            item.addEventListener('dragend', () => { item.style.opacity = '1'; dragSrc = null; });
            item.addEventListener('dragover', (e) => { e.preventDefault(); item.style.transform = 'scale(1.1)'; });
            item.addEventListener('dragleave', () => { item.style.transform = ''; });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.style.transform = '';
                if (!dragSrc) return;
                const targetId = item.dataset.appId;
                const targetName = item.querySelector('span')?.textContent;
                const targetApp = DESKTOP_APPS.find(a => a.id === targetId) || DESKTOP_APPS.find(a => a.name === targetName);
                if (targetApp && targetApp.id !== dragSrc.id) {
                    createFolder(dragSrc, targetApp);
                }
                dragSrc = null;
            });
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        byndStylesReady.then(() => {
            cleanupRemovedWatchTogetherData();
            if (window._folders.length > 0) rebuildDesktop();
            setTimeout(initFolderDrag, 500);
            initPageSwipe();
        });
    });
} else {
    byndStylesReady.then(() => {
        cleanupRemovedWatchTogetherData();
        if (window._folders.length > 0) rebuildDesktop();
        setTimeout(initFolderDrag, 500);
        initPageSwipe();
    });
}

function addDesktopAppToCurrentPage(app, offsetIndex = 0, preferredArea = null, options = {}) {
    const pageArea = preferredArea || (() => {
        const pageIndex = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
        const page = ensureDesktopPage(pageIndex) || document.querySelector('#pages-container .desktop-page');
        return page?.querySelector('.desktop-scroll-area') || null;
    })();
    if (!pageArea) return null;
    const item = createDesktopAppElement(app);
    const placed = placeDesktopAppInFirstOpenSlot(item, pageArea, offsetIndex, options);
    if (!placed) return null;
    if (!options.strictOpenSlot) repairDesktopAppOverlaps(pageArea);
    return item;
}

function addDesktopAppAfterFolderPage(app, folderPageArea, offsetIndex = 0) {
    const startPage = folderPageArea?.closest?.('.desktop-page');
    const startIndex = Math.max(0, getDesktopPageIndex(startPage));
    const pageCount = Math.max(getDesktopPages().length, startIndex + 1);
    for (let pageIndex = startIndex; pageIndex <= pageCount; pageIndex += 1) {
        const area = ensureDesktopPage(pageIndex)?.querySelector('.desktop-scroll-area');
        if (!area) continue;
        const item = addDesktopAppToCurrentPage(app, offsetIndex, area, { strictOpenSlot: true });
        if (item) return item;
    }
    return null;
}

function moveAppOutOfFolder(folderId, appId, options = {}) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;
    const originalApps = [...folder.apps];
    const movedApp = originalApps.find(app => app.id === appId);
    if (!movedApp) return;
    const movedAppInfo = getDesktopAppDefinition(movedApp);
    const nextApps = originalApps.filter(app => app.id !== appId);
    const shouldDissolveFolder = nextApps.length <= 1;
    const appsToPlace = shouldDissolveFolder ? originalApps : [movedApp];

    if (shouldDissolveFolder) {
        window._folders = window._folders.filter(f => f.id !== folderId);
    } else {
        folder.apps = nextApps;
    }
    saveFolders();
    const keepOverlayOpen = !!options.keepOpen && !shouldDissolveFolder;
    if (!keepOverlayOpen) closeFolderOverlay();

    const hasLayoutCanvas = !!document.querySelector('#pages-container .desktop-scroll-area.layout-canvas');
    if (window._editMode || hasLayoutCanvas) {
        const folderItem = Array.from(document.querySelectorAll('.app-item.is-folder')).find(item => item.dataset.folderId === folderId);
        const folderPageArea = folderItem?.closest?.('.desktop-scroll-area') || getPreferredDesktopPageArea();
        if (shouldDissolveFolder) {
            folderItem?.remove();
        } else if (folderItem) {
            const currentFolder = window._folders.find(f => f.id === folderId);
            const icon = folderItem.querySelector('.app-icon');
            if (icon && currentFolder) icon.innerHTML = renderDesktopFolderMiniIcons(currentFolder);
        }
        let lastItem = null;
        appsToPlace.forEach((app, index) => {
            lastItem = addDesktopAppAfterFolderPage(app, folderPageArea, index) || addDesktopAppToCurrentPage(app, index, folderPageArea);
        });
        if (window._editMode && lastItem) selectDesktopLayoutItem(lastItem);
        if (!window._editMode) {
            localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify({
                items: collectDesktopLayout(),
                pageCount: getDesktopPages().length,
                savedAt: Date.now()
            }));
        }
    } else {
        rebuildDesktop();
        setTimeout(initFolderDrag, 0);
    }

    if (keepOverlayOpen) openFolder(folderId);
    if (typeof showWechatToast === 'function') showWechatToast(`${movedAppInfo.name} 已移到桌面`);
}
window.moveAppOutOfFolder = moveAppOutOfFolder;

