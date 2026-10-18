// Silver Ribbon replaces the original plush preset. Keep storage IDs and asset paths
// stable so existing saved copies receive the replacement without losing their layout.
const PLUSH_THEME_ROOT = 'assets/themes/cream-plush/';
const plushToy = index => PLUSH_THEME_ROOT + `toy-${index}.webp`;
window.BYND_BUILTIN_THEMES = [{
    id: 'builtin-cream-plush', name: '银粉蕾丝', builtin: true,
    description: '细波点 · 缎带 · 银色随身听',
    themeData: {
        builtinTheme: 'cream-plush',
        wpLock: PLUSH_THEME_ROOT + 'lock.webp', wpHome: PLUSH_THEME_ROOT + 'fleece.webp',
        l1: plushToy(16), l2: plushToy(7), d1: plushToy(5), d2: plushToy(16),
        // Slot order is the existing THEME_ICON_TARGETS order, including Dock apps.
        icons: [1, 13, 3, 4, 7, 3, 10, 11, 6, 15, 9, 3, 2, 8, 2, 12, 3, 13, 5, 1, 3, 10, 16, 13, 6, 14].map(plushToy),
        lockEnabled: true, lockShowLeft: false, lockShowRight: false, lockShowText: false,
        lockShowTopDeco: false, lockShowBottomDeco: false,
        lockClockColorMode: 'custom', lockClockColor: '#656166', lockWeather: '',
        music: '', vibe: '', lsLeft: 'flashlight', lsRight: 'camera',
        calMode: 'manual', calBg: '#fbf6f8', calText: '#575259', calDim: '#93858d', calAccent: '#b97e96', calTransparency: 0,
        tapEffect: { preset: 'none' },
        widget1: { type: 'photo', style: 'paper', accent: '#b97e96' },
        widget2: { type: 'photo', style: 'paper', accent: '#b97e96' }
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
    add('custom-plush-duo', 'custom', 0, 195, 378, 164, 174, 'plush');
    add('custom-plush-player', 'custom', 0, 16, 208, 343, 144, 'plush');
    const folders = Array.isArray(window._folders) ? window._folders : [];
    const folderApps = typeof getDesktopFolderAppIds === 'function' ? getDesktopFolderAppIds() : new Set();
    const apps = getDesktopAllAppDefinitions().filter(app => app.id !== 'events');
    const dock = ['music', 'camera', 'money', 'worldbook', 'preset', 'bill', ...apps.map(app => app.id)]
        .filter((id, index, all) => !folderApps.has(id) && all.indexOf(id) === index).slice(0, 4);
    const front = ['wechat', 'study', 'theme', 'settings', 'album', 'coread', 'outing', 'pet', 'game', 'moon', 'home3d', 'dream']
        .filter(id => !folderApps.has(id) && !dock.includes(id)).slice(0, 8);
    const used = new Set(dock);
    front.forEach((id, index) => {
        if (folderApps.has(id) || used.has(id)) return;
        const left = index < 4 ? [198, 285][index % 2] : [19, 106][index % 2];
        const top = index < 4 ? [16, 110][Math.floor(index / 2)] : [382, 476][Math.floor((index - 4) / 2)];
        add('app-' + id, 'app', 0, left, top, 72, 82);
        used.add(id);
    });
    // Pack folders and remaining apps into the same grid, starting on page two.
    // Folder footprints and row spacing match the desktop repair clearance.
    const rest = apps.filter(app => !used.has(app.id) && !folderApps.has(app.id));
    const grids = [];
    const place = (id, columns, rows, width, height) => {
        for (let page = 0; ; page++) {
            const grid = grids[page] || (grids[page] = new Array(16).fill(false));
            for (let row = 0; row <= 4 - rows; row++) for (let column = 0; column <= 4 - columns; column++) {
                const cells = [];
                for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) cells.push((row + y) * 4 + column + x);
                if (cells.some(cell => grid[cell])) continue;
                cells.forEach(cell => { grid[cell] = true; });
                add(id, 'app', page + 1, 19 + column * 88, 24 + row * (page === 0 ? 90 : 108), width, height);
                return;
            }
        }
    };
    folders.forEach(folder => {
        const large = folder.size === 'large';
        const height = large ? Math.min(190, Math.max(118, Number(folder.height) || 140)) : 82;
        place('folder-' + folder.id, large ? 2 : 1, large ? Math.ceil((height + 8) / 90) : 1, large ? 164 : 72, height);
    });
    rest.forEach(app => place('app-' + app.id, 1, 1, 72, 82));
    const lastBottom = Math.max(0, ...items.filter(item => item.page === 1).map(item => item.top + item.height));
    const noteTop = Math.max(330, lastBottom + 18);
    const noteHeight = Math.min(180, Math.max(132, (area?.clientHeight || 590) - noteTop - 16));
    add('custom-plush-note', 'custom', 1, 16, noteTop, 343, noteHeight, 'plush');
    return { items, dock, deletedBuiltins: ['widget-calendar', 'widget-photo-1', 'widget-photo-2'], pageCount: Math.max(2, 1 + grids.length), savedAt: Date.now() };
}

function applyBuiltinThemeAppearance(data) {
    document.documentElement.dataset.builtinTheme = data?.builtinTheme === 'cream-plush' ? 'cream-plush' : '';
}

function renderBuiltinThemeLibraryCard(item) {
    return `<article class="theme-builtin-card">
        <div class="plush-preview" aria-label="银粉蕾丝锁屏与桌面预览">
            <div class="plush-preview-lock"><small>Monday, October 20</small><span>09:41</span></div>
            <div class="plush-preview-home"><img class="plush-preview-portrait" src="${PLUSH_THEME_ROOT}lock.webp" alt="缎带兔子与银色随身听">
                <div class="plush-preview-icons">${[1, 6, 5, 4].map(index => `<img src="${plushToy(index)}" alt="">`).join('')}</div>
                <div class="plush-preview-player"><img src="${plushToy(8)}" alt=""><span>now playing<br>◀ &nbsp; Ⅱ &nbsp; ▶</span></div>
                <div class="plush-preview-icons">${[9, 3, 11, 6].map(index => `<img src="${plushToy(index)}" alt="">`).join('')}</div>
                <img class="plush-preview-portrait plush-preview-charm" src="${plushToy(16)}" alt="银色爱心挂件">
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
    if (layoutId === 'custom-plush-note') {
        const state = getRibbonNoteState();
        return `<section class="ribbon-note" data-ribbon-note aria-label="今日小笺"><div class="ribbon-note-calendar" data-ribbon-calendar></div>
            <div class="ribbon-note-list"><header><span>今日小笺</span><img src="${plushToy(7)}" alt=""></header>
                ${state.items.map((item, index) => `<div class="ribbon-note-row"><button type="button" class="ribbon-note-check" data-ribbon-check="${index}" aria-label="完成第${index + 1}件小事" aria-pressed="${item.done}" onclick="toggleRibbonNote(${index})">${item.done ? '✓' : ''}</button><button type="button" class="ribbon-note-text" data-ribbon-text="${index}" onclick="editRibbonNote(${index})" aria-label="编辑第${index + 1}件小事">${themeEscapeHtml(item.text)}</button></div>`).join('')}
            </div></section>`;
    }
    if (layoutId === 'custom-plush-player') {
        return `<div class="plush-player-shell"><div class="plush-player-tabs"><span>RIBBON ♡</span><span>portable audio · 01</span></div>
            <div class="plush-player-body"><button class="plush-player-photo" onclick="openApp('music')" aria-label="打开音乐"><img src="${plushToy(8)}" alt="银粉耳机"><span>♪ &nbsp; my favorites</span></button>
                <div class="plush-player-controls"><button class="plush-track-label" data-plush-track onclick="openApp('music')">选一首喜欢的歌</button>
                    <div class="plush-player-line"></div><div class="plush-player-buttons">
                        <button onclick="handlePlushMusicAction('prev')" aria-label="上一首"><i class="ri-skip-back-fill"></i></button>
                        <button onclick="handlePlushMusicAction('play')" aria-label="播放或暂停"><i data-plush-play class="ri-play-fill"></i></button>
                        <button onclick="handlePlushMusicAction('next')" aria-label="下一首"><i class="ri-skip-forward-fill"></i></button>
                    </div>
                </div>
            </div></div>`;
    }
    if (layoutId === 'custom-plush-duo') {
        const data = getSavedThemeData();
        const left = typeof data.plushBubbleLeft === 'string' ? data.plushBubbleLeft : '陪着你 ♡';
        const right = typeof data.plushBubbleRight === 'string' ? data.plushBubbleRight : '慢慢来 ☁';
        return `<div class="plush-duo-shell">
            <div class="plush-duo-bubbles"><button type="button" data-plush-bubble="left" onclick="editPlushBubble('left')" aria-label="编辑左侧气泡文字">${themeEscapeHtml(left)}</button><button type="button" data-plush-bubble="right" onclick="editPlushBubble('right')" aria-label="编辑右侧气泡文字">${themeEscapeHtml(right)}</button></div>
            <div class="plush-duo-faces">${['left','right'].map(slot => renderRibbonPhotoButton(slot)).join('')}</div>
            <button type="button" class="plush-days" data-plush-days onclick="setPlushAnniversary()" aria-label="设置相伴纪念日">♡ 相伴日</button><small>tied together, always</small></div>`;
    }
    return `<div class="plush-portrait-shell">${renderRibbonPhotoButton('portrait')}<img class="plush-portrait-bow" src="${plushToy(7)}" alt=""><span>a little keepsake ♡</span></div>`;
}

function getRibbonPhoto(slot, data = getSavedThemeData()) {
    const defaults = {portrait:PLUSH_THEME_ROOT + 'lock.webp', left:plushToy(5), right:plushToy(16)};
    if (!Object.prototype.hasOwnProperty.call(defaults, slot)) return null;
    const value = data.plushPhotos?.[slot];
    const src = typeof value?.src === 'string' && (/^data:image\/(?:jpeg|png|webp|gif);base64,[a-z0-9+/=\r\n]+$/i.test(value.src) || /^assets\/themes\/cream-plush\/(?:lock|toy-\d+)\.webp$/.test(value.src)) ? value.src : defaults[slot];
    return {src, shape:value?.shape === 'circle' ? 'circle' : 'square'};
}
function renderRibbonPhotoButton(slot) {
    const photo = getRibbonPhoto(slot);
    const label = slot === 'portrait' ? '相纸照片' : slot === 'left' ? '左侧相伴照片' : '右侧相伴照片';
    return `<button type="button" class="${slot === 'portrait' ? 'plush-portrait-frame' : 'ribbon-duo-photo'}" data-ribbon-photo="${slot}" data-photo-shape="${photo.shape}" data-personal-photo="${photo.src.startsWith('data:')}" aria-label="更换${label}" onclick="openRibbonPhotoEditor('${slot}')"><img src="${themeEscapeHtml(photo.src)}" alt="${label}"></button>`;
}

let ribbonPhotoDraft = null;
function closeRibbonPhotoEditor() {
    ribbonPhotoDraft = null;
    document.getElementById('ribbon-photo-editor')?.close();
}
function openRibbonPhotoEditor(slot) {
    if (window._editMode) return;
    const photo = getRibbonPhoto(slot);
    if (!photo) return;
    let dialog = document.getElementById('ribbon-photo-editor');
    if (!dialog) {
        dialog = document.createElement('dialog'); dialog.id = 'ribbon-photo-editor';
        dialog.innerHTML = `<header><strong data-ribbon-editor-title>更换照片</strong><button type="button" aria-label="关闭照片设置" onclick="closeRibbonPhotoEditor()">×</button></header>
            <div class="ribbon-photo-preview"><img data-ribbon-editor-preview alt="照片预览"></div>
            <label class="ribbon-photo-upload">从相册选择<input type="file" accept="image/*" onchange="loadRibbonPhotoFile(this)" aria-label="选择照片"></label>
            <div class="ribbon-photo-shapes" aria-label="照片形状"><button type="button" data-ribbon-shape="square" onclick="setRibbonPhotoShape('square')">正方形</button><button type="button" data-ribbon-shape="circle" onclick="setRibbonPhotoShape('circle')">圆形</button></div>
            <p role="status" data-ribbon-photo-status></p><footer><button type="button" onclick="closeRibbonPhotoEditor()">取消</button><button type="button" data-ribbon-photo-save onclick="saveRibbonPhoto()">保存照片</button></footer>`;
        dialog.addEventListener('close', () => { if (!dialog.open) ribbonPhotoDraft = null; });
        document.body.appendChild(dialog);
    }
    ribbonPhotoDraft = {slot, ...photo, loading:false};
    dialog.querySelector('input').value = '';
    dialog.querySelector('[data-ribbon-editor-title]').textContent = slot === 'portrait' ? '更换相纸照片' : slot === 'left' ? '左侧相伴照片' : '右侧相伴照片';
    dialog.querySelector('.ribbon-photo-shapes').hidden = slot === 'portrait';
    dialog.querySelector('[data-ribbon-photo-status]').textContent = '';
    refreshRibbonPhotoEditor();
    if (!dialog.open) dialog.showModal();
}
function refreshRibbonPhotoEditor() {
    if (!ribbonPhotoDraft) return;
    const dialog = document.getElementById('ribbon-photo-editor');
    dialog.querySelector('[data-ribbon-editor-preview]').src = ribbonPhotoDraft.src;
    dialog.querySelector('.ribbon-photo-preview').dataset.shape = ribbonPhotoDraft.slot === 'portrait' ? 'square' : ribbonPhotoDraft.shape;
    dialog.querySelectorAll('[data-ribbon-shape]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ribbonShape === ribbonPhotoDraft.shape)));
    dialog.querySelector('[data-ribbon-photo-save]').disabled = ribbonPhotoDraft.loading;
    dialog.querySelector('input').disabled = ribbonPhotoDraft.loading;
}
function setRibbonPhotoShape(shape) {
    if (!ribbonPhotoDraft || !['square','circle'].includes(shape)) return;
    ribbonPhotoDraft.shape = shape; refreshRibbonPhotoEditor();
}
async function readRibbonPhotoFile(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('请选择图片文件');
    if (file.size > 20 * 1024 * 1024) throw new Error('图片不能超过20MB');
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const image = new Image();
            const timer = setTimeout(() => reject(new Error('图片读取超时')), 15000);
            image.onload = () => { clearTimeout(timer); resolve(image); };
            image.onerror = () => { clearTimeout(timer); reject(new Error('图片无法读取，请换一张重试')); };
            image.src = url;
        });
        const ratio = Math.min(1, 960 / img.naturalWidth, 960 / img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('暂时无法处理图片，请重试');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Preserve cutout/sticker alpha. Browsers without WebP encoding return PNG.
        const src = canvas.toDataURL('image/webp', .9);
        if (!/^data:image\/(?:webp|png);base64,/.test(src)) throw new Error('图片处理失败，请换一张重试');
        return src;
    } finally { URL.revokeObjectURL(url); }
}
async function loadRibbonPhotoFile(input) {
    const file = input.files?.[0], draft = ribbonPhotoDraft;
    if (!file || !draft || draft.loading) return;
    draft.loading = true; refreshRibbonPhotoEditor();
    const status = document.querySelector('#ribbon-photo-editor [data-ribbon-photo-status]');
    status.textContent = '正在读取照片…';
    try {
        const src = await readRibbonPhotoFile(file);
        if (ribbonPhotoDraft !== draft) return;
        draft.src = src; status.textContent = '预览确认后保存';
    } catch (error) { if (ribbonPhotoDraft === draft) status.textContent = error.message || '照片读取失败'; }
    finally {
        input.value = '';
        if (ribbonPhotoDraft === draft) { draft.loading = false; refreshRibbonPhotoEditor(); }
    }
}
function saveRibbonPhoto() {
    const draft = ribbonPhotoDraft;
    if (!draft || draft.loading) return false;
    try {
        const data = getSavedThemeData();
        localStorage.setItem('my_theme_data', JSON.stringify({...data, plushPhotos:{...data.plushPhotos, [draft.slot]:{src:draft.src,shape:draft.shape}}}));
    } catch (error) {
        document.querySelector('#ribbon-photo-editor [data-ribbon-photo-status]').textContent = '照片保存失败：' + error.message;
        return false;
    }
    updateRibbonPhotoWidgets(); closeRibbonPhotoEditor(); return true;
}
function updateRibbonPhotoWidgets() {
    const data = getSavedThemeData();
    document.querySelectorAll('[data-ribbon-photo]').forEach(button => {
        const photo = getRibbonPhoto(button.dataset.ribbonPhoto, data);
        if (!photo) return;
        const img = button.querySelector('img');
        if (img.getAttribute('src') !== photo.src) img.src = photo.src;
        button.dataset.photoShape = photo.shape;
        button.dataset.personalPhoto = String(photo.src.startsWith('data:'));
    });
}

function updatePlushWidgets() {
    const data = typeof getSavedThemeData === 'function' ? getSavedThemeData() : {};
    const since = /^\d{4}-\d{2}-\d{2}$/.test(data.plushSince || '') ? new Date(data.plushSince + 'T00:00:00') : null;
    const today = new Date();
    updateRibbonNoteWidgets(today);
    updateRibbonPhotoWidgets();
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

const RIBBON_NOTE_KEY = 'bynd_ribbon_note_v1';
const RIBBON_NOTE_DEFAULTS = ['喝一杯水', '读几页喜欢的书', '给自己留点时间'];
function getRibbonNoteState(today = new Date()) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(RIBBON_NOTE_KEY) || '{}') || {}; }
    catch (error) { console.warn('ribbon note read failed:', error); }
    const date = today.toLocaleDateString('sv-SE');
    return { date, items:RIBBON_NOTE_DEFAULTS.map((text, index) => ({
        text:typeof saved.items?.[index]?.text === 'string' && saved.items[index].text.trim() ? Array.from(saved.items[index].text).slice(0, 24).join('') : text,
        done:saved.date === date && saved.items?.[index]?.done === true
    })) };
}
function saveRibbonNoteState(state) {
    try { localStorage.setItem(RIBBON_NOTE_KEY, JSON.stringify(state)); }
    catch (error) { alert('小笺保存失败：' + error.message); return false; }
    updateRibbonNoteWidgets();
    return true;
}
function toggleRibbonNote(index) {
    if (window._editMode || !Number.isInteger(index) || index < 0 || index > 2) return;
    const state = getRibbonNoteState();
    state.items[index].done = !state.items[index].done;
    return saveRibbonNoteState(state);
}
function editRibbonNote(index) {
    if (window._editMode || !Number.isInteger(index) || index < 0 || index > 2) return;
    const state = getRibbonNoteState();
    const value = prompt('写一件今天的小事（最多24个字）', state.items[index].text);
    if (value === null) return;
    const text = value.trim().replace(/[\r\n]+/g, ' ');
    if (!text || Array.from(text).length > 24) { alert('请写1至24个字。'); return; }
    state.items[index].text = text;
    return saveRibbonNoteState(state);
}
function updateRibbonNoteWidgets(today = new Date()) {
    const widgets = document.querySelectorAll('[data-ribbon-note]');
    if (!widgets.length) return;
    const state = getRibbonNoteState(today);
    widgets.forEach(widget => {
        state.items.forEach((item, index) => {
            const check = widget.querySelector(`[data-ribbon-check="${index}"]`);
            const text = widget.querySelector(`[data-ribbon-text="${index}"]`);
            check.setAttribute('aria-pressed', String(item.done)); check.textContent = item.done ? '✓' : '';
            text.textContent = item.text; text.classList.toggle('is-done', item.done);
        });
        if (widget.dataset.calendarDate === state.date) return;
        const year = today.getFullYear(), month = today.getMonth(), day = today.getDate();
        const offset = (new Date(year, month, 1).getDay() + 6) % 7;
        const count = new Date(year, month + 1, 0).getDate();
        widget.querySelector('[data-ribbon-calendar]').innerHTML = `<div class="ribbon-note-date"><strong>${String(day).padStart(2, '0')}</strong><span>${month + 1}月 · 周${'日一二三四五六'[today.getDay()]}</span></div><div class="ribbon-note-month" aria-label="${year}年${month + 1}月">${Array.from('一二三四五六日').map(label => `<small>${label}</small>`).join('')}${Array.from({length:offset}, () => '<span></span>').join('')}${Array.from({length:count}, (_, i) => `<span${i + 1 === day ? ' class="is-today" aria-current="date"' : ''}>${i + 1}</span>`).join('')}</div>`;
        widget.dataset.calendarDate = state.date;
    });
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
