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
    // Photos from every chat window of a character belong to that one character.
    const base = char?.chatConfig?.windowOf && (window.myCharacters || []).find(item => item && item.id === char.chatConfig.windowOf);
    if (base) char = base;
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

function getChatAlbumRows() {
    const rows = getLegacyChatAlbumStore();
    for (const char of (window.myCharacters || [])) {
        if (!char?.id) continue;
        rows.push(...(Array.isArray(char.chatConfig?.generatedImages) ? char.chatConfig.generatedImages : []));
        for (const msg of (char.history || [])) rows.push(...getWechatAlbumMessageRows(char, msg));
    }
    return rows.map(row => {
        if (!row || row.id) return row;
        let hash = 2166136261;
        const text = String(row.url || '');
        for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
        return { ...row, id: `album_legacy_${row.charId}_${(hash >>> 0).toString(36)}_${text.length}` };
    });
}

function getChatAlbumStore() {
    const rows = getChatAlbumRows();
    const hidden = new Set(JSON.parse(localStorage.getItem('bynd_album_removed_v1') || '[]'));
    const seen = new Map();
    rows.forEach(row => {
        if (!row?.charId || typeof row.url !== 'string' || !/^(?:https?:\/\/|data:image\/)/i.test(row.url)) return;
        if (hidden.has(row.id)) return;
        const key = row.charId + '\n' + row.url;
        if (!seen.has(key)) seen.set(key, row);
    });
    return Array.from(seen.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function removeAlbumPhoto(id) {
    try {
        const item = getChatAlbumStore().find(row => row.id === id);
        if (!item) return false;
        const ids = getChatAlbumRows().filter(row => row.charId === item.charId && row.url === item.url).map(row => row.id).filter(Boolean);
        if (!ids.length) throw new Error('照片标识缺失');
        const key = 'bynd_album_removed_v1';
        const previous = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
        const added = ids.filter(value => !previous.has(value));
        ids.forEach(value => previous.add(value));
        localStorage.setItem(key, JSON.stringify([...previous]));
        renderAlbumApp();
        window.ByndUndo?.offer({ label: '已移除照片', undo: () => {
            const latest = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
            added.forEach(value => latest.delete(value));
            localStorage.setItem(key, JSON.stringify([...latest]));
            renderAlbumApp(); return true;
        } });
        return true;
    } catch (error) { console.warn('照片移除失败', error); window.showWechatToast?.('照片移除失败，请重试'); return false; }
}
window.removeAlbumPhoto = removeAlbumPhoto;

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
            <button type="button" class="album-delete" data-remove-photo="${musicEscapeAttr(item.id || '')}" aria-label="移除照片">×</button>
            <button type="button" class="album-photo-open" data-open-photo="${musicEscapeAttr(item.id || '')}" aria-label="查看大图"><img src="${musicEscapeAttr(item.url)}" alt="${musicEscapeAttr(item.description || item.charName || '聊天图片')}" loading="lazy"></button>
            <figcaption>
                <strong>${musicEscapeHtml(item.charName || '角色')}</strong>
                <span>${musicEscapeHtml(item.description || '聊天生成图片')}</span>
            </figcaption>
        </figure>
    `).join('') || '<div class="album-empty">这里还没有我们的照片<br><small>TA 发来的生成图，会一张张留在这里。</small></div>';
    grid.querySelectorAll('[data-remove-photo]').forEach(button => { button.onclick = () => removeAlbumPhoto(button.dataset.removePhoto); });
    grid.querySelectorAll('[data-open-photo]').forEach(button => { button.onclick = () => openAlbumViewer(button.dataset.openPhoto, rows); });
    if (status) status.innerHTML = window._chatAlbumSaveError ? `${store.length} 张 · <button type="button" onclick="initAlbumApp()">重试保存</button>` : `已收录 ${store.length} 张聊天生成图`;
}

async function initAlbumApp() {
    if (typeof closeAlbumViewer === 'function') closeAlbumViewer();
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

// --- 大图查看器：全屏、左右滑动切换、双指/双击/滚轮缩放、拖动平移 ---
const ALBUM_VIEWER_MAX_SCALE = 4;
const ALBUM_VIEWER_DOUBLE_TAP_SCALE = 2.5;
let albumViewer = null;

function albumViewerClampScale(scale) {
    return Math.min(ALBUM_VIEWER_MAX_SCALE, Math.max(1, Number(scale) || 1));
}

// Keeps a zoomed image covering its frame: at scale s the image may move (s - 1) * size / 2 each way.
function albumViewerClampPan(x, y, scale, box) {
    const maxX = Math.max(0, (scale - 1) * (Number(box?.width) || 0) / 2);
    const maxY = Math.max(0, (scale - 1) * (Number(box?.height) || 0) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, Number(x) || 0)), y: Math.min(maxY, Math.max(-maxY, Number(y) || 0)) };
}

// A horizontal drag past 18% of the width (or a quick flick) moves one photo; edges stay put.
function albumViewerSwipeTarget(index, count, dx, width, velocity = 0) {
    const passed = Math.abs(dx) > Math.max(40, (Number(width) || 0) * 0.18) || (Math.abs(dx) > 24 && Math.abs(velocity) > 0.45);
    if (!passed) return index;
    return Math.min(count - 1, Math.max(0, index + (dx < 0 ? 1 : -1)));
}

function openAlbumViewer(id, rows = null) {
    const list = (Array.isArray(rows) && rows.length ? rows : getChatAlbumStore()).filter(row => row?.url);
    const index = list.findIndex(row => row.id === id);
    if (index < 0) return false;
    closeAlbumViewer();
    const host = document.getElementById('app-album-window') || document.body;
    const node = document.createElement('div');
    node.className = 'album-viewer';
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    node.setAttribute('aria-label', '查看照片');
    node.tabIndex = -1;
    node.innerHTML = `
        <div class="album-viewer-top">
            <button type="button" class="album-viewer-close" aria-label="关闭"><i class="ri-close-line"></i></button>
            <span class="album-viewer-count" aria-live="polite"></span>
            <button type="button" class="album-viewer-reset" aria-label="还原大小"><i class="ri-fullscreen-exit-line"></i></button>
        </div>
        <div class="album-viewer-stage"><div class="album-viewer-track"></div></div>
        <button type="button" class="album-viewer-nav prev" aria-label="上一张"><i class="ri-arrow-left-s-line"></i></button>
        <button type="button" class="album-viewer-nav next" aria-label="下一张"><i class="ri-arrow-right-s-line"></i></button>
        <div class="album-viewer-caption"></div>`;
    host.appendChild(node);
    albumViewer = { node, rows: list, index, scale: 1, x: 0, y: 0, pointers: new Map(), gesture: null, lastTap: null, tapTimer: 0, chromeHidden: false };
    node.querySelector('.album-viewer-close').onclick = closeAlbumViewer;
    node.querySelector('.album-viewer-reset').onclick = () => setAlbumViewerZoom(1);
    node.querySelector('.album-viewer-nav.prev').onclick = () => showAlbumViewerPhoto(albumViewer.index - 1);
    node.querySelector('.album-viewer-nav.next').onclick = () => showAlbumViewerPhoto(albumViewer.index + 1);
    node.addEventListener('keydown', handleAlbumViewerKey);
    const stage = node.querySelector('.album-viewer-stage');
    stage.addEventListener('pointerdown', handleAlbumViewerPointerDown);
    stage.addEventListener('pointermove', handleAlbumViewerPointerMove);
    stage.addEventListener('pointerup', handleAlbumViewerPointerUp);
    stage.addEventListener('pointercancel', handleAlbumViewerPointerUp);
    stage.addEventListener('wheel', handleAlbumViewerWheel, { passive: false });
    renderAlbumViewer();
    node.focus({ preventScroll: true });
    return true;
}
window.openAlbumViewer = openAlbumViewer;

function closeAlbumViewer() {
    if (!albumViewer) return;
    clearTimeout(albumViewer.tapTimer);
    albumViewer.node.remove();
    albumViewer = null;
}
window.closeAlbumViewer = closeAlbumViewer;

function renderAlbumViewer() {
    const viewer = albumViewer;
    if (!viewer) return;
    const { rows, index, node } = viewer;
    const item = rows[index];
    const slide = (row, offset) => row ? `<figure class="album-viewer-slide" data-offset="${offset}" style="transform:translateX(${offset * 100}%)"><img src="${musicEscapeAttr(row.url)}" alt="${musicEscapeAttr(row.description || row.charName || '照片')}" draggable="false"></figure>` : '';
    node.querySelector('.album-viewer-track').innerHTML = slide(rows[index - 1], -1) + slide(item, 0) + slide(rows[index + 1], 1);
    node.querySelector('.album-viewer-count').textContent = `${index + 1} / ${rows.length}`;
    const date = item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    node.querySelector('.album-viewer-caption').innerHTML = `<strong>${musicEscapeHtml(item.charName || '角色')}</strong>${date ? `<time>${musicEscapeHtml(date)}</time>` : ''}${item.description ? `<p>${musicEscapeHtml(item.description)}</p>` : ''}`;
    node.querySelector('.album-viewer-nav.prev').disabled = index <= 0;
    node.querySelector('.album-viewer-nav.next').disabled = index >= rows.length - 1;
    node.classList.toggle('chrome-hidden', viewer.chromeHidden);
    applyAlbumViewerTransform();
}

function applyAlbumViewerTransform(dragX = 0, animate = false) {
    const viewer = albumViewer;
    if (!viewer) return;
    const track = viewer.node.querySelector('.album-viewer-track');
    track.style.transition = animate ? 'transform .24s ease' : 'none';
    track.style.transform = `translateX(${dragX}px)`;
    const img = viewer.node.querySelector('.album-viewer-slide[data-offset="0"] img');
    if (img) {
        img.style.transition = animate ? 'transform .2s ease' : 'none';
        img.style.transform = `translate(${viewer.x}px, ${viewer.y}px) scale(${viewer.scale})`;
    }
    viewer.node.classList.toggle('is-zoomed', viewer.scale > 1.01);
}

function getAlbumViewerBox() {
    const stage = albumViewer?.node.querySelector('.album-viewer-stage');
    const rect = stage ? stage.getBoundingClientRect() : { width: 0, height: 0, left: 0, top: 0 };
    return { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
}

function showAlbumViewerPhoto(index) {
    const viewer = albumViewer;
    if (!viewer) return;
    const next = Math.min(viewer.rows.length - 1, Math.max(0, index));
    Object.assign(viewer, { index: next, scale: 1, x: 0, y: 0 });
    renderAlbumViewer();
}
window.showAlbumViewerPhoto = showAlbumViewerPhoto;

// Zooms around a stage point (client coordinates) so the spot under the finger stays put.
function setAlbumViewerZoom(scale, clientX = null, clientY = null, animate = true) {
    const viewer = albumViewer;
    if (!viewer) return;
    const box = getAlbumViewerBox();
    const nextScale = albumViewerClampScale(scale);
    let { x, y } = viewer;
    if (clientX != null && clientY != null && viewer.scale > 0) {
        const px = clientX - box.left - box.width / 2, py = clientY - box.top - box.height / 2;
        const ratio = nextScale / viewer.scale;
        x = px - (px - x) * ratio;
        y = py - (py - y) * ratio;
    }
    const pan = nextScale <= 1 ? { x: 0, y: 0 } : albumViewerClampPan(x, y, nextScale, box);
    Object.assign(viewer, { scale: nextScale, x: pan.x, y: pan.y });
    applyAlbumViewerTransform(0, animate);
}
window.setAlbumViewerZoom = setAlbumViewerZoom;

function handleAlbumViewerKey(event) {
    if (!albumViewer) return;
    if (event.key === 'Escape') { event.preventDefault(); closeAlbumViewer(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); showAlbumViewerPhoto(albumViewer.index - 1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); showAlbumViewerPhoto(albumViewer.index + 1); }
}

function handleAlbumViewerWheel(event) {
    if (!albumViewer) return;
    event.preventDefault();
    setAlbumViewerZoom(albumViewer.scale * (event.deltaY < 0 ? 1.18 : 1 / 1.18), event.clientX, event.clientY, false);
}

function handleAlbumViewerPointerDown(event) {
    const viewer = albumViewer;
    if (!viewer) return;
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (_) {}
    viewer.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...viewer.pointers.values()];
    if (points.length >= 2) {
        const [a, b] = points;
        viewer.gesture = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: viewer.scale, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, x: viewer.x, y: viewer.y };
    } else {
        viewer.gesture = { type: viewer.scale > 1.01 ? 'pan' : 'swipe', startX: event.clientX, startY: event.clientY, x: viewer.x, y: viewer.y, at: Date.now(), moved: 0 };
    }
}

function handleAlbumViewerPointerMove(event) {
    const viewer = albumViewer;
    if (!viewer || !viewer.pointers.has(event.pointerId)) return;
    viewer.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = viewer.gesture;
    if (!gesture) return;
    const box = getAlbumViewerBox();
    if (gesture.type === 'pinch') {
        const [a, b] = [...viewer.pointers.values()];
        if (!b) return;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const scale = albumViewerClampScale(gesture.scale * Math.hypot(a.x - b.x, a.y - b.y) / gesture.dist);
        const px = gesture.mid.x - box.left - box.width / 2, py = gesture.mid.y - box.top - box.height / 2;
        const ratio = scale / gesture.scale;
        const pan = albumViewerClampPan(px - (px - gesture.x) * ratio + mid.x - gesture.mid.x, py - (py - gesture.y) * ratio + mid.y - gesture.mid.y, scale, box);
        Object.assign(viewer, { scale, x: scale <= 1 ? 0 : pan.x, y: scale <= 1 ? 0 : pan.y });
        applyAlbumViewerTransform();
        return;
    }
    const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
    gesture.moved = Math.max(gesture.moved, Math.hypot(dx, dy));
    if (gesture.type === 'pan') {
        Object.assign(viewer, albumViewerClampPan(gesture.x + dx, gesture.y + dy, viewer.scale, box));
        applyAlbumViewerTransform();
    } else {
        const atEdge = (dx > 0 && viewer.index === 0) || (dx < 0 && viewer.index === viewer.rows.length - 1);
        applyAlbumViewerTransform(atEdge ? dx * 0.3 : dx);
    }
}

function handleAlbumViewerPointerUp(event) {
    const viewer = albumViewer;
    if (!viewer) return;
    const gesture = viewer.gesture;
    viewer.pointers.delete(event.pointerId);
    if (gesture?.type === 'pinch') {
        // Lifting one finger of a pinch continues as a pan from where the other finger is.
        const rest = [...viewer.pointers.values()][0];
        viewer.gesture = rest ? { type: 'pan', startX: rest.x, startY: rest.y, x: viewer.x, y: viewer.y, at: Date.now(), moved: 99 } : null;
        if (viewer.scale <= 1.01) setAlbumViewerZoom(1);
        return;
    }
    if (viewer.pointers.size || !gesture) return;
    viewer.gesture = null;
    const dx = event.clientX - gesture.startX;
    const elapsed = Math.max(1, Date.now() - gesture.at);
    if (gesture.moved < 10 && elapsed < 320) {
        if (gesture.type === 'swipe') applyAlbumViewerTransform(0);
        handleAlbumViewerTap(event);
        return;
    }
    if (gesture.type !== 'swipe') return;
    const box = getAlbumViewerBox();
    const target = albumViewerSwipeTarget(viewer.index, viewer.rows.length, dx, box.width, dx / elapsed);
    if (target === viewer.index) { applyAlbumViewerTransform(0, true); return; }
    applyAlbumViewerTransform(target > viewer.index ? -box.width : box.width, true);
    setTimeout(() => { if (albumViewer === viewer) showAlbumViewerPhoto(target); }, 240);
}

function handleAlbumViewerTap(event) {
    const viewer = albumViewer;
    const now = Date.now();
    const last = viewer.lastTap;
    if (last && now - last.at < 300 && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 30) {
        clearTimeout(viewer.tapTimer);
        viewer.lastTap = null;
        setAlbumViewerZoom(viewer.scale > 1.01 ? 1 : ALBUM_VIEWER_DOUBLE_TAP_SCALE, event.clientX, event.clientY);
        return;
    }
    viewer.lastTap = { at: now, x: event.clientX, y: event.clientY };
    clearTimeout(viewer.tapTimer);
    viewer.tapTimer = setTimeout(() => {
        if (albumViewer !== viewer) return;
        viewer.chromeHidden = !viewer.chromeHidden;
        viewer.node.classList.toggle('chrome-hidden', viewer.chromeHidden);
    }, 300);
}

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
    { id: 'role-tools', name: '角色台', icon: 'ri-tools-line' },
    { id: 'moon', name: '月伴', icon: 'ri-moon-line' },
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
    { id: 'events', name: '心意', icon: 'ri-mail-open-line' },
    { id: 'home3d', name: '小屋', icon: 'ri-home-heart-line' },
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

