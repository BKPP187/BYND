// --- 📱 script.js: 核心系统与路由 (最终完整版) ---

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initBattery();
    initDate();
    initLockScreen();
    initCalendar();
    
    if (typeof initIconGrid === 'function') initIconGrid();
    if (typeof initTheme === 'function') initTheme();
    if (typeof loadCharactersFromStorage === 'function') loadCharactersFromStorage(); 
});

// --- 基础功能 ---
function initClock() {
    const timeEl = document.getElementById('clock-time-small');
    if (!timeEl) return;
    setInterval(() => {
        const now = new Date();
        timeEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }, 1000);
}

function initBattery() {
    const levelEl = document.getElementById('battery-level');
    const iconEl = document.getElementById('battery-icon');
    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            const update = () => {
                levelEl.textContent = `${Math.round(battery.level * 100)}%`;
                iconEl.className = battery.charging ? "ri-battery-2-charge-fill" : "ri-battery-fill";
            };
            update();
        });
    } else {
        levelEl.textContent = "100%";
    }
}

function initLockScreen() {
    const bigClock = document.getElementById('ls-big-clock');
    const updateTime = () => {
        const now = new Date();
        if(bigClock) bigClock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    };
    setInterval(updateTime, 1000);
    updateTime();
}

function initDate() {
    const dateEl = document.getElementById('ls-date');
    if (!dateEl) return;
    if (typeof window.updateLockDateDisplay === 'function') {
        window.updateLockDateDisplay();
        return;
    }
    const now = new Date();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    dateEl.innerHTML = `<span>${weekdays[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}</span><span class="ls-weather-chip">24°C</span>`;
}

function unlockPhone() {
    document.getElementById('lock-screen').classList.add('unlocked');
    document.getElementById('home-screen').classList.remove('hidden');
    resetDesktopToFirstPage();
    
    // 触发变色检查
    const statusBar = document.querySelector('.status-bar');
    if (typeof window.homeIsDark !== 'undefined') {
        if (window.homeIsDark) statusBar.classList.add('white-text');
        else statusBar.classList.remove('white-text');
    }
}

function initCalendar() {
    const dayNameEl = document.getElementById('cal-day-name');
    const dateNumEl = document.getElementById('cal-date-num');
    const monthNameEl = document.getElementById('cal-month-name');
    const gridEl = document.getElementById('cal-grid');

    if (!dateNumEl) return;

    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    dayNameEl.textContent = days[now.getDay()];
    dateNumEl.textContent = now.getDate();
    monthNameEl.textContent = months[now.getMonth()];

    gridEl.innerHTML = ''; 
    const today = now.getDate();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); 

    for (let i = 1; i <= totalDays; i++) {
        const dot = document.createElement('div');
        dot.className = 'cal-dot';
        dot.textContent = i;
        if (i === today) dot.classList.add('active');
        gridEl.appendChild(dot);
    }
}

// --- 🌟 路由控制 (这里修复了！) ---

function openApp(appName) {
    document.querySelectorAll('.app-window.active').forEach(w => {
        w.classList.remove('active');
        w.classList.add('hidden');
    });
    // 1. 美化 App
    if (appName === 'theme') {
        const win = document.getElementById('app-theme-window');
        if (win) { 
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10); 
            if (typeof loadSavedSettings === 'function') loadSavedSettings();
        }
    }
    // 2. 微信 App
    else if (appName === 'wechat') {
        const win = document.getElementById('app-wechat-window');
        if (win) { 
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof renderChatList === 'function') renderChatList(); 
        }
    } 
    // 3. 📖 世界书 App (新增)
    else if (appName === 'worldbook') {
        const win = document.getElementById('app-worldbook-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initWorldBook === 'function') initWorldBook();
        }
    }
    // 4. 🛠️ 正则 App (新增)
    else if (appName === 'regex') {
        const win = document.getElementById('app-regex-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initRegexApp === 'function') initRegexApp();
        }
    }
    // 5. ⚙️ 设置 App
    else if (appName === 'settings') {
        const win = document.getElementById('app-settings-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initSettings === 'function') initSettings();
        }
    }
    // 6. 预设 App
    else if (appName === 'preset') {
        const win = document.getElementById('app-preset-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof renderPresetList === 'function') renderPresetList();
        }
    }
    // 其他未开发
    else {
        alert("正在打开: " + appName + " (功能开发中...)");
    }
}

function closeApp(appName) {
    let winId = '';
    if (appName === 'theme') winId = 'app-theme-window';
    else if (appName === 'wechat') winId = 'app-wechat-window';
    else if (appName === 'worldbook') winId = 'app-worldbook-window';
    else if (appName === 'regex') winId = 'app-regex-window';
    else if (appName === 'settings') winId = 'app-settings-window';
    else if (appName === 'preset') winId = 'app-preset-window';
    const win = document.getElementById(winId);
    if (win) {
        resetDesktopToFirstPage();
        win.classList.remove('active');
        setTimeout(() => win.classList.add('hidden'), 300);

        if (appName === 'wechat' && typeof closeChat === 'function') {
            setTimeout(closeChat, 300);
        }
    }
}

function resetDesktopToFirstPage() {
    if (typeof window.goToDesktopPage === 'function') {
        window.goToDesktopPage(0);
        return;
    }

    const pages = document.querySelectorAll('#pages-container .desktop-page');
    pages.forEach(p => {
        p.style.transition = '';
        p.style.transform = 'translateX(0%)';
    });
    document.querySelectorAll('#page-dots .page-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === 0);
    });
    window._desktopCurrentPage = 0;
}

// --- 📁 文件夹系统 ---
window._folders = JSON.parse(localStorage.getItem('desktop_folders') || '[]');

function saveFolders() {
    localStorage.setItem('desktop_folders', JSON.stringify(window._folders));
}

function createFolder(app1, app2) {
    const folder = {
        id: 'folder_' + Date.now(),
        name: '文件夹',
        apps: [app1, app2]
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

    nameInput.value = folder.name;
    nameInput.oninput = () => { folder.name = nameInput.value; saveFolders(); };

    grid.innerHTML = '';
    folder.apps.forEach(app => {
        const item = document.createElement('div');
        item.className = 'app-item';
        item.onclick = (e) => { e.stopPropagation(); closeFolderOverlay(); openApp(app.id); };
        item.innerHTML = `
            <div class="app-icon icon-black"><i class="${app.icon}"></i></div>
            <span>${app.name}</span>
        `;
        grid.appendChild(item);
    });

    overlay.classList.remove('hidden');
}

function closeFolderOverlay(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('folder-overlay').classList.add('hidden');
}

function addToFolder(folderId, app) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;
    if (!folder.apps.find(a => a.id === app.id)) {
        folder.apps.push(app);
        saveFolders();
        rebuildDesktop();
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

const DESKTOP_APPS = [
    { id: 'wechat', name: '微信', icon: 'ri-wechat-line' },
    { id: 'regex', name: '正则', icon: 'ri-code-s-slash-line' },
    { id: 'worldbook', name: '世界书', icon: 'ri-book-read-line' },
    { id: 'settings', name: '设置', icon: 'ri-settings-4-line' },
    { id: 'theme', name: '美化', icon: 'ri-palette-line' },
    { id: 'study', name: '学习', icon: 'ri-graduation-cap-line' },
    { id: 'money', name: '记账', icon: 'ri-money-cny-box-line' },
    { id: 'game', name: 'Game', icon: 'ri-gamepad-line' }
];

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
                const f = item.data;
                const el = document.createElement('div');
                el.className = 'app-item is-folder';
                el.onclick = () => openFolder(f.id);
                const minis = f.apps.slice(0, 4).map(a => `<div class="folder-mini-icon"><i class="${a.icon}" style="font-size:9px;"></i></div>`).join('');
                el.innerHTML = `<div class="app-icon">${minis}</div><span>${f.name}</span>`;
                quad.appendChild(el);
            } else {
                const a = item.data;
                const el = document.createElement('div');
                el.className = 'app-item';
                el.onclick = () => openApp(a.id);
                el.innerHTML = `<div class="app-icon icon-black"><i class="${a.icon}"></i></div><span>${a.name}</span>`;
                quad.appendChild(el);
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
                const appName = item.querySelector('span')?.textContent;
                const app = DESKTOP_APPS.find(a => a.name === appName);
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
                const targetName = item.querySelector('span')?.textContent;
                const targetApp = DESKTOP_APPS.find(a => a.name === targetName);
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
        if (window._folders.length > 0) rebuildDesktop();
        setTimeout(initFolderDrag, 500);
        initPageSwipe();
    });
} else {
    if (window._folders.length > 0) rebuildDesktop();
    setTimeout(initFolderDrag, 500);
    initPageSwipe();
}

// --- 📄 页面滑动系统 ---
function initPageSwipe() {
    const container = document.getElementById('pages-container');
    if (!container) return;

    const pages = container.querySelectorAll('.desktop-page');
    const totalPages = pages.length;
    let currentPage = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    function goToPage(idx) {
        idx = Math.max(0, Math.min(idx, totalPages - 1));
        currentPage = idx;
        window._desktopCurrentPage = currentPage;
        pages.forEach(p => {
            p.style.transition = '';
            p.style.transform = `translateX(-${currentPage * 100}%)`;
        });
        updateDots();
    }
    window.goToDesktopPage = goToPage;

    function updateDots() {
        const dots = document.querySelectorAll('#page-dots .page-dot');
        dots.forEach((d, i) => d.classList.toggle('active', i === currentPage));
    }

    container.addEventListener('touchstart', (e) => {
        if (window._editMode) return;
        startX = e.touches[0].clientX;
        currentX = startX;
        isDragging = true;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (window._editMode) return;
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        const offset = -currentPage * 100 + (diff / container.offsetWidth) * 100;
        pages.forEach(p => {
            p.style.transition = 'none';
            p.style.transform = `translateX(${offset}%)`;
        });
    }, { passive: true });

    container.addEventListener('touchend', () => {
        if (window._editMode) {
            isDragging = false;
            return;
        }
        if (!isDragging) return;
        isDragging = false;
        const diff = currentX - startX;
        pages.forEach(p => p.style.transition = '');

        if (Math.abs(diff) > 60) {
            if (diff < 0 && currentPage < totalPages - 1) goToPage(currentPage + 1);
            else if (diff > 0 && currentPage > 0) goToPage(currentPage - 1);
            else goToPage(currentPage);
        } else {
            goToPage(currentPage);
        }
        startX = 0;
        currentX = 0;
    });

    goToPage(0);
}

// --- 桌面长按布局编辑 ---
const DESKTOP_LAYOUT_KEY = 'desktop_layout_v2';
window._editMode = false;
window._desktopSelectedLayoutItem = null;
let _editLongPressTimer = null;
let _desktopLayoutBackupHtml = '';
let _desktopDefaultLayoutHtml = '';
let _desktopLongPressStart = null;
let _desktopLongPressTriggered = false;
let _desktopLongPressActive = false;

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
        const onclick = el.getAttribute('onclick') || '';
        const match = onclick.match(/openApp\('([^']+)'\)/);
        if (match) return 'app-' + match[1];
        const label = el.querySelector('span')?.textContent?.trim() || Date.now();
        return 'app-custom-' + label;
    }
    return 'item-' + Date.now();
}

function findDesktopBuiltinElement(id) {
    if (id === 'widget-calendar') return document.querySelector('.calendar-widget');
    if (id === 'widget-photo-1') return document.querySelector('.desktop-img-1')?.closest('.photo-large') || document.querySelectorAll('.photo-large')[0];
    if (id === 'widget-photo-2') return document.querySelector('.desktop-img-2')?.closest('.photo-large') || document.querySelectorAll('.photo-large')[1];
    if (id.startsWith('app-')) {
        const appId = id.slice(4);
        return Array.from(document.querySelectorAll('.app-item')).find(item => {
            const onclick = item.getAttribute('onclick') || '';
            return onclick.includes(`openApp('${appId}')`);
        });
    }
    return null;
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
    item.dataset.layoutId = id;
    item.dataset.layoutType = item.dataset.layoutType || (id.startsWith('app-') ? 'app' : 'builtin');
    item.classList.add('desktop-layout-item');
    if (item.classList.contains('app-item')) item.classList.add('layout-app');
    pageArea.classList.add('layout-canvas');
    if (item.parentElement !== pageArea) pageArea.appendChild(item);
    item.style.left = `${Math.round(rect.left)}px`;
    item.style.top = `${Math.round(rect.top)}px`;
    item.style.width = `${Math.round(rect.width)}px`;
    item.style.height = `${Math.round(rect.height)}px`;
    setupDesktopLayoutItem(item);
}

function materializeDesktopPage(page) {
    const pageArea = page.querySelector('.desktop-scroll-area');
    if (!pageArea) return;
    const items = Array.from(page.querySelectorAll('.calendar-widget, .photo-large, .app-item, .desktop-custom-widget'));
    items.forEach(item => {
        const rect = normalizeDesktopLayoutRect(item, pageArea);
        prepareDesktopLayoutItem(item, pageArea, rect);
    });
    page.querySelectorAll('.bento-box, .desktop-empty-placeholder').forEach(el => el.classList.add('layout-source-hidden'));
}

function materializeExistingDesktopForLayout() {
    document.querySelectorAll('#pages-container .desktop-page').forEach(materializeDesktopPage);
}

function setupDesktopLayoutItem(item) {
    if (item._layoutReady) return;
    item._layoutReady = true;
    item.dataset.layoutReady = '1';
    item.addEventListener('pointerdown', startDesktopItemDrag);
    item.addEventListener('click', (e) => {
        if (!window._editMode) return;
        e.preventDefault();
        e.stopPropagation();
        selectDesktopLayoutItem(item);
    }, true);
}

function addDesktopItemControls(item) {
    item.querySelectorAll(':scope > .desktop-resize-handle, :scope > .desktop-item-move-page').forEach(el => el.remove());
    if (!item.classList.contains('layout-app')) {
        const resize = document.createElement('div');
        resize.className = 'desktop-resize-handle';
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
}

function selectDesktopLayoutItem(item) {
    document.querySelectorAll('.desktop-layout-item.selected').forEach(el => el.classList.remove('selected'));
    window._desktopSelectedLayoutItem = item;
    item.classList.add('selected');
    addDesktopItemControls(item);
}

function startDesktopItemDrag(e) {
    if (!window._editMode || e.target.closest('.desktop-resize-handle, .desktop-item-move-page')) return;
    const item = e.currentTarget;
    const pageArea = item.closest('.desktop-scroll-area');
    if (!pageArea) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof item.setPointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
        try { item.setPointerCapture(e.pointerId); } catch (err) {}
    }
    selectDesktopLayoutItem(item);
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseFloat(item.style.left) || 0;
    const startTop = parseFloat(item.style.top) || 0;
    const scale = getDesktopEditScale();

    const move = (ev) => {
        const maxLeft = Math.max(0, pageArea.clientWidth - item.offsetWidth);
        const maxTop = Math.max(0, Math.max(pageArea.scrollHeight, pageArea.clientHeight) - item.offsetHeight);
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        item.style.left = `${Math.max(0, Math.min(maxLeft, startLeft + dx))}px`;
        item.style.top = `${Math.max(0, Math.min(maxTop, startTop + dy))}px`;
    };
    const up = () => {
        if (typeof item.releasePointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
            try { item.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

function startDesktopItemResize(e) {
    if (!window._editMode) return;
    const item = e.currentTarget.closest('.desktop-layout-item');
    const pageArea = item?.closest('.desktop-scroll-area');
    if (!item || !pageArea) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = item.offsetWidth;
    const startHeight = item.offsetHeight;
    const minWidth = item.classList.contains('calendar-widget') ? 220 : 118;
    const minHeight = item.classList.contains('calendar-widget') ? 118 : 96;
    const scale = getDesktopEditScale();

    const move = (ev) => {
        const left = parseFloat(item.style.left) || 0;
        const maxWidth = pageArea.clientWidth - left;
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        item.style.width = `${Math.max(minWidth, Math.min(maxWidth, startWidth + dx))}px`;
        item.style.height = `${Math.max(minHeight, startHeight + dy)}px`;
    };
    const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

function createDesktopCustomWidget(kind, id) {
    const el = document.createElement('div');
    el.className = `desktop-custom-widget desktop-widget-${kind}`;
    el.dataset.layoutType = 'custom';
    el.dataset.widgetKind = kind;
    el.dataset.layoutId = id || `custom-${kind}-${Date.now()}`;
    const templates = {
        music: `<div class="dw-mp3-screen"><i class="ri-disc-line"></i><span>playlist</span><strong>soft blue</strong></div><div class="dw-mp3-pad"><i class="ri-skip-back-fill"></i><b></b><i class="ri-skip-forward-fill"></i></div>`,
        camera: `<div class="dw-camera-lens"><i class="ri-camera-3-line"></i></div><strong>camera</strong><span>daily snaps</span>`,
        album: `<div class="dw-album-grid"><span></span><span></span><span></span><span></span></div><strong>gallery</strong><em>4 photos</em>`
    };
    el.innerHTML = templates[kind] || templates.album;
    return el;
}

function addDesktopCustomWidget(kind) {
    if (!window._editMode) enterEditMode();
    const pageIndex = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
    const page = document.querySelectorAll('#pages-container .desktop-page')[pageIndex] || document.querySelector('#pages-container .desktop-page');
    const pageArea = page?.querySelector('.desktop-scroll-area');
    if (!pageArea) return;
    const item = createDesktopCustomWidget(kind);
    pageArea.appendChild(item);
    prepareDesktopLayoutItem(item, pageArea, {
        left: 22,
        top: 70 + pageArea.querySelectorAll('.desktop-custom-widget').length * 18,
        width: kind === 'music' ? 300 : 142,
        height: kind === 'music' ? 132 : 142
    });
    selectDesktopLayoutItem(item);
}

function moveSelectedDesktopItemToOtherPage() {
    const item = window._desktopSelectedLayoutItem;
    if (!item) return;
    const pages = Array.from(document.querySelectorAll('#pages-container .desktop-page'));
    const currentPage = item.closest('.desktop-page');
    const currentIndex = getDesktopPageIndex(currentPage);
    const nextIndex = currentIndex === 0 ? 1 : 0;
    const targetArea = pages[nextIndex]?.querySelector('.desktop-scroll-area');
    if (!targetArea) return;
    targetArea.classList.add('layout-canvas');
    targetArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    targetArea.appendChild(item);
    item.style.left = '24px';
    item.style.top = '64px';
    if (typeof window.goToDesktopPage === 'function') window.goToDesktopPage(nextIndex);
    selectDesktopLayoutItem(item);
}

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
            <button type="button" onclick="addDesktopCustomWidget('music')"><i class="ri-music-2-line"></i><span>音乐</span></button>
            <button type="button" onclick="addDesktopCustomWidget('camera')"><i class="ri-camera-3-line"></i><span>相机</span></button>
            <button type="button" onclick="addDesktopCustomWidget('album')"><i class="ri-image-2-line"></i><span>相册</span></button>
        </div>
        <div class="desktop-edit-actions">
            <button type="button" class="restore" onclick="promptRestoreDefaultDesktopLayout()">恢复原始</button>
            <button type="button" onclick="exitEditMode(false)">取消</button>
            <button type="button" class="primary" onclick="promptSaveDesktopLayout()">保存布局</button>
        </div>
    `;
    home.appendChild(toolbar);
}

function enterEditMode() {
    if (window._editMode) return;
    const pages = document.getElementById('pages-container');
    const home = document.getElementById('home-screen');
    if (!pages || !home) return;
    window._editMode = true;
    _desktopLayoutBackupHtml = pages.innerHTML;
    materializeExistingDesktopForLayout();
    document.querySelectorAll('.desktop-layout-item').forEach(setupDesktopLayoutItem);
    home.classList.add('desktop-editing');
    renderDesktopEditChrome();
    if (navigator.vibrate) navigator.vibrate(20);
}

function startDesktopEditLongPress(e) {
    const home = document.getElementById('home-screen');
    if (!home || window._editMode) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    if (e.target.closest('.app-window, .dock-bar, .folder-overlay, .desktop-edit-toolbar, .desktop-save-modal')) return;
    if (!e.target.closest('.desktop-scroll-area, .desktop-layout-item, .app-item, .photo-large, .calendar-widget, .desktop-page')) return;

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
    return Array.from(document.querySelectorAll('.desktop-layout-item')).map(item => {
        const page = item.closest('.desktop-page');
        return {
            id: item.dataset.layoutId,
            type: item.dataset.layoutType || 'builtin',
            kind: item.dataset.widgetKind || '',
            page: getDesktopPageIndex(page),
            left: Math.round(parseFloat(item.style.left) || 0),
            top: Math.round(parseFloat(item.style.top) || 0),
            width: Math.round(item.offsetWidth),
            height: Math.round(item.offsetHeight)
        };
    });
}

function saveDesktopLayout() {
    localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify({ items: collectDesktopLayout(), savedAt: Date.now() }));
    exitEditMode(true);
}

function restoreDefaultDesktopLayout() {
    localStorage.removeItem(DESKTOP_LAYOUT_KEY);
    document.getElementById('desktop-save-modal')?.remove();
    const pages = document.getElementById('pages-container');
    const template = _desktopDefaultLayoutHtml || _desktopLayoutBackupHtml;
    if (pages && template) {
        const newPages = pages.cloneNode(false);
        newPages.innerHTML = template;
        pages.replaceWith(newPages);
    }
    window._editMode = false;
    window._desktopSelectedLayoutItem = null;
    document.getElementById('home-screen')?.classList.remove('desktop-editing');
    clearDesktopEditChrome();
    setTimeout(() => {
        if (typeof rebuildDesktop === 'function') rebuildDesktop();
        if (typeof initFolderDrag === 'function') initFolderDrag();
        if (typeof initPageSwipe === 'function') initPageSwipe();
        if (typeof resetDesktopToFirstPage === 'function') resetDesktopToFirstPage();
    }, 0);
}

function clearDesktopEditChrome() {
    document.getElementById('desktop-edit-toolbar')?.remove();
    document.getElementById('desktop-save-modal')?.remove();
    document.querySelectorAll('.desktop-resize-handle, .desktop-item-move-page').forEach(el => el.remove());
    document.querySelectorAll('.desktop-layout-item.selected').forEach(el => el.classList.remove('selected'));
}

function exitEditMode(saveChanges) {
    if (!window._editMode) return;
    window._editMode = false;
    document.getElementById('home-screen')?.classList.remove('desktop-editing');
    clearDesktopEditChrome();
    window._desktopSelectedLayoutItem = null;
    if (!saveChanges && _desktopLayoutBackupHtml) {
        const oldPages = document.getElementById('pages-container');
        const newPages = oldPages.cloneNode(false);
        newPages.innerHTML = _desktopLayoutBackupHtml;
        oldPages.replaceWith(newPages);
        setTimeout(() => {
            initFolderDrag();
            initPageSwipe();
            document.querySelectorAll('.desktop-layout-item').forEach(item => {
                item._layoutReady = false;
                item.removeAttribute('data-layout-ready');
            });
        }, 0);
    }
}

function applySavedDesktopLayout() {
    let saved;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}');
    } catch (e) {
        return;
    }
    if (!Array.isArray(saved.items) || !saved.items.length) return;
    const pages = Array.from(document.querySelectorAll('#pages-container .desktop-page'));
    saved.items.forEach(record => {
        const page = pages[Math.max(0, Math.min(pages.length - 1, record.page || 0))];
        const area = page?.querySelector('.desktop-scroll-area');
        if (!area) return;
        let item = record.type === 'custom'
            ? createDesktopCustomWidget(record.kind || 'album', record.id)
            : findDesktopBuiltinElement(record.id);
        if (!item) return;
        area.appendChild(item);
        prepareDesktopLayoutItem(item, area, record);
        area.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
        page.querySelectorAll('.bento-box').forEach(el => el.classList.add('layout-source-hidden'));
    });
}

function startDesktopLayoutFromTheme() {
    if (typeof closeApp === 'function') closeApp('theme');
    setTimeout(() => {
        if (typeof unlockPhone === 'function') unlockPhone();
        enterEditMode();
    }, 360);
}

function initEditMode() {
    const home = document.getElementById('home-screen');
    if (!home || home.dataset.editInit === '1') return;
    const pages = document.getElementById('pages-container');
    if (pages && !_desktopDefaultLayoutHtml) _desktopDefaultLayoutHtml = pages.innerHTML;
    home.dataset.editInit = '1';
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
        e.preventDefault();
        e.stopPropagation();
        _desktopLongPressTriggered = false;
    }, true);
    setTimeout(applySavedDesktopLayout, 50);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditMode);
} else {
    initEditMode();
}
