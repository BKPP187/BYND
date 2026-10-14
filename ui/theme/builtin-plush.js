// Original cream / plush theme. Assets are local so the preset also works offline.
const PLUSH_THEME_ROOT = 'assets/themes/cream-plush/';
const plushToy = index => PLUSH_THEME_ROOT + `toy-${index}.webp`;
window.BYND_BUILTIN_THEMES = [{
    id: 'builtin-cream-plush', name: '奶绒小熊', builtin: true,
    description: '奶油毛绒 · 玩偶拼贴',
    themeData: {
        builtinTheme: 'cream-plush',
        wpLock: PLUSH_THEME_ROOT + 'lock.webp', wpHome: PLUSH_THEME_ROOT + 'fleece.webp',
        l1: plushToy(16), l2: plushToy(5), d1: plushToy(5), d2: plushToy(1),
        // Slot order is the existing THEME_ICON_TARGETS order, including Dock apps.
        icons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 14, 13, 2, 3, 10, 16, 1, 12, 7, 4, 11, 9, 15].map(plushToy),
        lockEnabled: true, lockShowLeft: false, lockShowRight: false, lockShowText: false,
        lockShowTopDeco: false, lockShowBottomDeco: false,
        lockClockColorMode: 'custom', lockClockColor: '#827e6e', lockWeather: '',
        music: '把日子过得软绵绵', vibe: '', lsLeft: 'flashlight', lsRight: 'camera',
        calMode: 'manual', calBg: '#f1eee6', calText: '#5e594f', calDim: '#918979', calAccent: '#89735f', calTransparency: 0,
        tapEffect: { preset: 'none' },
        widget1: { type: 'photo', style: 'paper', accent: '#89735f' },
        widget2: { type: 'photo', style: 'paper', accent: '#89735f' }
    }
}];

function getBuiltinThemeLibraryItem(id) {
    return window.BYND_BUILTIN_THEMES.find(item => item.id === id);
}

function buildPlushDesktopLayout() {
    const area = document.querySelector('#pages-container .desktop-scroll-area');
    const canvasWidth = area?.clientWidth || 375;
    const unit = canvasWidth / 375;
    const items = [];
    const add = (id, type, page, left, top, width, height, kind = '') => items.push({
        id, type, kind, page, left: Math.round(left * unit), top, width: Math.round(width * unit), height, canvasWidth
    });
    add('custom-plush-portrait', 'custom', 0, 16, 12, 164, 174, 'plush');
    add('custom-plush-duo', 'custom', 0, 195, 208, 164, 174, 'plush');
    add('custom-plush-player', 'custom', 0, 16, 408, 343, 120, 'plush');
    const folders = Array.isArray(window._folders) ? window._folders : [];
    const folderApps = typeof getDesktopFolderAppIds === 'function' ? getDesktopFolderAppIds() : new Set();
    const dock = ['music', 'camera', 'money', 'worldbook', 'preset', 'bill', ...getDesktopAllAppDefinitions().map(app => app.id)]
        .filter((id, index, all) => !folderApps.has(id) && all.indexOf(id) === index).slice(0, 4);
    const front = ['wechat', 'study', 'theme', 'settings', 'album', 'coread', 'outing', 'pet', 'game', 'moon', 'home3d', 'dream']
        .filter(id => !folderApps.has(id) && !dock.includes(id)).slice(0, 8);
    const used = new Set(dock);
    front.forEach((id, index) => {
        if (folderApps.has(id) || used.has(id)) return;
        const left = index < 4 ? [198, 285][index % 2] : [19, 106][index % 2];
        const top = index < 4 ? [16, 110][Math.floor(index / 2)] : [212, 306][Math.floor((index - 4) / 2)];
        add('app-' + id, 'app', 0, left, top, 72, 82);
        used.add(id);
    });
    // Keep existing folders and every remaining app available on the next pages.
    const rest = getDesktopAllAppDefinitions().filter(app => !used.has(app.id) && !folderApps.has(app.id));
    const entries = rest.map(app => ({ id: 'app-' + app.id, type: 'app' }));
    entries.forEach((entry, index) => {
        add(entry.id, entry.type, 1 + Math.floor(index / 16), 19 + (index % 4) * 88, 24 + Math.floor((index % 16) / 4) * 108, 72, 82);
    });
    const folderPage = 1 + Math.ceil(entries.length / 16);
    // A separate page leaves large folders enough room for their existing size.
    folders.forEach((folder, index) => {
        const large = folder.size === 'large';
        add('folder-' + folder.id, 'app', folderPage + Math.floor(index / 4), 16 + (index % 2) * 178, 24 + Math.floor((index % 4) / 2) * 214,
            large ? 164 : 72, large ? Math.min(190, Math.max(118, Number(folder.height) || 140)) : 82);
    });
    return { items, dock, deletedBuiltins: ['widget-calendar', 'widget-photo-1', 'widget-photo-2'], pageCount: Math.max(2, folderPage + Math.ceil(folders.length / 4)), savedAt: Date.now() };
}

function applyBuiltinThemeAppearance(data) {
    document.documentElement.dataset.builtinTheme = data?.builtinTheme === 'cream-plush' ? 'cream-plush' : '';
}

function renderBuiltinThemeLibraryCard(item) {
    return `<article class="theme-builtin-card">
        <div class="plush-preview" aria-label="奶绒小熊锁屏与桌面预览">
            <div class="plush-preview-lock"><span>09:41</span><small>把日子过得软绵绵</small></div>
            <div class="plush-preview-home"><img class="plush-preview-portrait" src="${plushToy(5)}" alt="奶绒兔子">
                <div class="plush-preview-icons">${[1, 6, 5, 4].map(index => `<img src="${plushToy(index)}" alt="">`).join('')}</div>
                <div class="plush-preview-icons">${[15, 12, 11, 16].map(index => `<img src="${plushToy(index)}" alt="">`).join('')}</div>
                <img class="plush-preview-portrait" src="${plushToy(1)}" alt="相伴小熊"><div class="plush-preview-player">♡ &nbsp; soft little days &nbsp; ♫</div>
            </div>
        </div>
        <div class="theme-builtin-meta"><div><strong>${themeEscapeHtml(item.name)} <small>内置</small></strong><span>锁屏 · 壁纸 · 图标 · 组件 · 布局</span></div>
            <button type="button" class="apply" onclick="applyThemeLibraryItem('${item.id}')">套用</button>
        </div>
    </article>`;
}

async function preloadBuiltinThemeAssets(data) {
    const sources = [...new Set([data.wpLock, data.wpHome, ...(data.icons || [])].filter(Boolean))];
    await Promise.all(sources.map(src => new Promise((resolve, reject) => {
        const img = new Image();
        const timer = setTimeout(() => reject(new Error('主题图片加载超时，请重试')), 15000);
        img.onload = () => { clearTimeout(timer); resolve(); };
        img.onerror = () => { clearTimeout(timer); reject(new Error('主题图片加载失败，请重试')); };
        img.src = src;
    })));
}

function renderDesktopPlushWidgetInner(layoutId) {
    if (layoutId === 'custom-plush-player') {
        return `<div class="plush-player-shell"><div class="plush-player-tabs"><span>♡ little moments</span><span>♪ music</span></div>
            <div class="plush-player-body"><button class="plush-player-photo" onclick="openApp('music')" aria-label="打开音乐"><img src="${plushToy(14)}" alt="戴耳机的小熊"></button>
                <div class="plush-player-controls"><button class="plush-track-label" data-plush-track onclick="openApp('music')">选一首喜欢的歌</button>
                    <div class="plush-player-line"></div><div class="plush-player-buttons">
                        <button onclick="handlePlushMusicAction('prev')" aria-label="上一首"><i class="ri-skip-back-fill"></i></button>
                        <button onclick="handlePlushMusicAction('play')" aria-label="播放或暂停"><i data-plush-play class="ri-play-fill"></i></button>
                        <button onclick="handlePlushMusicAction('next')" aria-label="下一首"><i class="ri-skip-forward-fill"></i></button>
                    </div>
                </div><div class="plush-player-stamps"><img src="${plushToy(1)}" alt=""><img src="${plushToy(16)}" alt=""></div>
            </div></div>`;
    }
    if (layoutId === 'custom-plush-duo') {
        const data = getSavedThemeData();
        const left = typeof data.plushBubbleLeft === 'string' ? data.plushBubbleLeft : '陪着你 ♡';
        const right = typeof data.plushBubbleRight === 'string' ? data.plushBubbleRight : '慢慢来 ☁';
        return `<div class="plush-duo-shell">
            <div class="plush-duo-bubbles"><button type="button" data-plush-bubble="left" onclick="editPlushBubble('left')" aria-label="编辑左侧气泡文字">${themeEscapeHtml(left)}</button><button type="button" data-plush-bubble="right" onclick="editPlushBubble('right')" aria-label="编辑右侧气泡文字">${themeEscapeHtml(right)}</button></div>
            <div class="plush-duo-faces"><img src="${plushToy(4)}" alt="围巾小熊"><img src="${plushToy(5)}" alt="蝴蝶结兔子"></div>
            <button type="button" class="plush-days" data-plush-days onclick="setPlushAnniversary()" aria-label="设置相伴纪念日">♡ 相伴日</button><small>our soft little days</small></div>`;
    }
    return `<div class="plush-portrait-shell"><div class="plush-portrait-frame"><img src="${plushToy(5)}" alt="奶绒兔子"></div><div class="plush-portrait-wings" aria-hidden="true"><svg width="118" height="28" viewBox="0 0 118 28"><defs><path id="plush-wing" d="M43 13C28 15 15 10 8 3C2 9 7 16 20 17C8 14 6 20 13 23C20 26 31 25 43 18Z"/></defs><g fill="#fffdf5" stroke="#d8d3c5" stroke-width="1.2"><use href="#plush-wing"/><use href="#plush-wing" transform="translate(118 0) scale(-1 1)"/></g><path d="m59 7 2.8 6 6.7.8-5 4.5 1.3 6.5-5.8-3.2-5.8 3.2 1.3-6.5-5-4.5 6.7-.8Z" fill="#68665e"/></svg></div><span>soft little things</span></div>`;
}

function updatePlushWidgets() {
    const data = typeof getSavedThemeData === 'function' ? getSavedThemeData() : {};
    const since = /^\d{4}-\d{2}-\d{2}$/.test(data.plushSince || '') ? new Date(data.plushSince + 'T00:00:00') : null;
    const today = new Date();
    document.querySelectorAll('[data-plush-bubble]').forEach(el => {
        const key = el.dataset.plushBubble === 'left' ? 'plushBubbleLeft' : 'plushBubbleRight';
        if (typeof data[key] === 'string') el.textContent = data[key];
    });
    if (data.builtinTheme === 'cream-plush') {
        const dateLabel = document.getElementById('ls-date');
        if (dateLabel) dateLabel.textContent = `${today.getMonth() + 1}月${today.getDate()}日 星期${'日一二三四五六'[today.getDay()]}`;
    }
    const day = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const days = since && Number.isFinite(since.getTime()) ? Math.max(0, Math.round((day(today) - day(since)) / 86400000)) : null;
    document.querySelectorAll('[data-plush-days]').forEach(el => { el.textContent = days == null ? '♡ 设置相伴日' : String(days).padStart(2, '0') + ' · Day'; });
    const track = typeof musicTracks !== 'undefined' ? musicTracks[musicCurrentIndex] : null;
    document.querySelectorAll('[data-plush-track]').forEach(el => { el.textContent = track?.trackName || '选一首喜欢的歌'; });
    document.querySelectorAll('[data-plush-play]').forEach(el => { el.className = typeof musicAudio !== 'undefined' && musicAudio && !musicAudio.paused ? 'ri-pause-fill' : 'ri-play-fill'; });
}

function editPlushBubble(side) {
    if (window._editMode) return;
    const key = side === 'left' ? 'plushBubbleLeft' : 'plushBubbleRight';
    const data = getSavedThemeData();
    const value = prompt('编辑气泡文字（最多30个字）', typeof data[key] === 'string' ? data[key] : side === 'left' ? '陪着你 ♡' : '慢慢来 ☁');
    if (value === null) return;
    const text = value.trim().replace(/[\r\n]+/g, ' ');
    if (Array.from(text).length > 30) { alert('气泡文字最多30个字。'); return; }
    try { localStorage.setItem('my_theme_data', JSON.stringify({ ...data, [key]: text })); updatePlushWidgets(); }
    catch (error) { alert('气泡文字保存失败：' + error.message); }
}

function handlePlushMusicAction(action) {
    if (typeof musicTracks === 'undefined' || !musicTracks.length) { openApp('music'); return; }
    if (action === 'prev') playPrevMusicTrack();
    else if (action === 'next') playNextMusicTrack();
    else toggleMusicPlayback();
    updatePlushWidgets();
}

function setPlushAnniversary() {
    if (window._editMode) return;
    const data = getSavedThemeData();
    const value = prompt('相伴的第一天（YYYY-MM-DD）', data.plushSince || new Date().toLocaleDateString('sv-SE'));
    if (value === null) return;
    const date = new Date(value + 'T00:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toLocaleDateString('sv-SE') !== value || date > new Date()) {
        alert('请输入有效日期，且不能晚于今天。'); return;
    }
    try { localStorage.setItem('my_theme_data', JSON.stringify({ ...data, plushSince: value })); updatePlushWidgets(); }
    catch (error) { alert('纪念日保存失败：' + error.message); }
}

document.addEventListener('DOMContentLoaded', () => {
    updatePlushWidgets();
    // The clock and playback state remain live even when the music app is closed.
    setInterval(() => { if (document.querySelector('.desktop-widget-plush')) updatePlushWidgets(); }, 1000);
});
