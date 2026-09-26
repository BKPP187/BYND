// ========== 发现页：朋友圈 / 视频号 / 直播 / 购物 ==========

function readWechatStore(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function writeWechatStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function showWechatToast(text, duration = 1400) {
    let toast = document.getElementById('wc-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'wc-toast';
        toast.className = 'wc-toast';
        getWechatModalRoot().appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(window._wechatToastTimer);
    window._wechatToastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function getWechatFavoritesStore() {
    const store = readWechatStore(WECHAT_FAVORITES_STORAGE_KEY, { items: [] });
    store.items = Array.isArray(store.items) ? store.items : [];
    return store;
}

function saveWechatFavoritesStore(store) {
    writeWechatStore(WECHAT_FAVORITES_STORAGE_KEY, store);
}

function addWechatFavorite(item) {
    const store = getWechatFavoritesStore();
    const sourceKey = item.sourceKey || '';
    if (sourceKey && store.items.some(existing => existing.sourceKey === sourceKey)) {
        showWechatToast('已在收藏里');
        return null;
    }
    const favorite = {
        id: item.id || ('fav_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
        type: item.type || 'text',
        title: item.title || '收藏',
        text: item.text || '',
        media: Array.isArray(item.media) ? item.media : [],
        sourceKey,
        source: item.source && typeof item.source === 'object' ? item.source : null,
        message: item.message && typeof item.message === 'object' ? item.message : null,
        createdAt: item.createdAt || Date.now(),
        updatedAt: item.updatedAt || Date.now()
    };
    store.items.unshift(favorite);
    saveWechatFavoritesStore(store);
    showWechatToast('已收藏');
    return favorite;
}

function deleteWechatFavorite(id) {
    const store = getWechatFavoritesStore();
    store.items = store.items.filter(item => item.id !== id);
    saveWechatFavoritesStore(store);
    renderWechatFavoriteList();
}

function cloneWechatMessageForFavorite(msg) {
    if (!msg || typeof msg !== 'object') return null;
    try {
        const clone = JSON.parse(JSON.stringify(msg));
        delete clone.monitorEvent;
        delete clone.monitorEventId;
        delete clone.receiptCreated;
        return clone;
    } catch (e) {
        return null;
    }
}

function cloneWechatMessageForForward(msg) {
    const clone = cloneWechatMessageForFavorite(msg);
    if (!clone) return null;
    clone.isMe = true;
    clone.timestamp = createMessageTimestamp();
    delete clone.receipt;
    delete clone.receiptFor;
    delete clone.collectedAt;
    delete clone.status;
    if (clone.type === 'voice') {
        clone.duration = normalizeWechatDuration(clone.duration, estimateWechatVoiceDuration(clone.transcript || clone.content || ''));
        clone.content = clone.transcript || clone.content || `[语音 ${formatWechatDuration(clone.duration)}]`;
    }
    return syncWechatMessageDescription(clone);
}

function collectWechatMessage(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const msg = char && Array.isArray(char.history) ? char.history[msgIdx] : null;
    if (!char || !msg || msg.isMe) return;
    const text = stripWechatPromptText(getWechatMessagePromptContent(msg), 520) || '[微信消息]';
    const msgKey = getWechatMessageSourceKey(char.id, msg, msgIdx);
    addWechatFavorite({
        type: 'message',
        title: `${getWechatCharDisplayName(char)} 的消息`,
        text,
        message: cloneWechatMessageForFavorite(msg),
        sourceKey: msgKey,
        source: { kind: 'message', charId: char.id, msgKey },
        createdAt: msg.timestamp || msg.createdAt || Date.now()
    });
}

function collectWechatMoment(postId) {
    const store = getWechatMomentStore();
    const post = store.posts.find(item => item.id === postId);
    if (!post) return;
    addWechatFavorite({
        type: 'moment',
        title: `${post.userName || '我'} 的朋友圈`,
        text: post.text || '[图片朋友圈]',
        media: (post.images || []).map(url => ({ type: /^data:video\//i.test(url) ? 'video' : 'image', url })),
        sourceKey: `moment:${post.id}`,
        createdAt: post.createdAt || Date.now()
    });
}

function collectWechatCharMoment(charId, momentId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const moments = getWechatCharMoments(char);
    const fallbackIndex = String(momentId || '').startsWith('idx_') ? parseInt(String(momentId).slice(4), 10) : -1;
    const item = moments.find(moment => moment.id === momentId) || (fallbackIndex >= 0 ? moments[fallbackIndex] : null);
    if (!char || !item) return;
    addWechatFavorite({
        type: 'moment',
        title: `${getWechatCharDisplayName(char)} 的朋友圈`,
        text: item.text || '',
        sourceKey: `charMoment:${char.id}:${item.id || momentId}`,
        createdAt: item.createdAt || Date.now()
    });
}

function getWechatFavoriteMediaHtml(media = []) {
    return media.length ? `<div class="wc-fav-media">${media.slice(0, 6).map(item => {
        const url = wcEscapeHtml(item.url || '');
        if (item.type === 'audio') return `<audio src="${url}" controls></audio>`;
        if (item.type === 'video') return `<video src="${url}" controls muted playsinline></video>`;
        return `<img src="${url}" onerror="this.style.opacity='0.35'">`;
    }).join('')}</div>` : '';
}

function openWechatFavorites() {
    openWechatFeatureScreen('收藏', `
        <div class="wc-fav-page">
            <div class="wc-fav-search"><i class="ri-search-line"></i><input id="wc-fav-search-input" placeholder="搜索收藏和笔记" oninput="renderWechatFavoriteList(this.value)"></div>
            <div id="wc-fav-list" class="wc-fav-list"></div>
        </div>
    `, '<i class="ri-add-line" onclick="openWechatFavoriteNoteEditor()"></i>');
    renderWechatFavoriteList();
}

function renderWechatFavoriteList(query = '') {
    const listEl = document.getElementById('wc-fav-list');
    if (!listEl) return;
    const q = String(query || document.getElementById('wc-fav-search-input')?.value || '').trim().toLowerCase();
    const items = getWechatFavoritesStore().items
        .filter(item => !q || `${item.title || ''} ${item.text || ''}`.toLowerCase().includes(q))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    listEl.innerHTML = items.length ? items.map(item => `
        <div class="wc-fav-item">
            <div class="wc-fav-main" onclick="${getWechatFavoriteOpenAction(item)}">
                <div class="wc-fav-title">${wcEscapeHtml(item.title || '收藏')}</div>
                <div class="wc-fav-text">${wcEscapeHtml(item.text || '').replace(/\n/g, '<br>') || ' '}</div>
                ${getWechatFavoriteMediaHtml(item.media || [])}
                <div class="wc-fav-time">${new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleString()}</div>
            </div>
            <div class="wc-fav-actions">
                <button onclick="shareWechatFavorite(${quoteWechatJsString(item.id)})"><i class="ri-share-forward-line"></i></button>
                <button onclick="deleteWechatFavorite(${quoteWechatJsString(item.id)})"><i class="ri-delete-bin-line"></i></button>
            </div>
        </div>
    `).join('') : '<div class="wc-discover-empty">还没有收藏</div>';
}

function getWechatFavoriteOpenAction(item) {
    if (item.type === 'note') return `openWechatFavoriteNoteEditor(${quoteWechatJsString(item.id)})`;
    if (item.type === 'message') {
        const source = item.source || {};
        let charId = source.charId || '';
        let msgKey = source.msgKey || item.sourceKey || '';
        if (!charId && item.sourceKey && item.sourceKey.startsWith('message:')) {
            const parts = item.sourceKey.split(':');
            charId = parts[1] || '';
            msgKey = parts.slice(0, 3).join(':');
        }
        if (charId && msgKey) return `openWechatMessageSource(${quoteWechatJsString(charId)}, ${quoteWechatJsString(msgKey)})`;
    }
    return '';
}

function getWechatFavoriteById(id) {
    return getWechatFavoritesStore().items.find(item => item.id === id) || null;
}

function saveWechatFavoriteNoteDraft() {
    const id = window._wechatEditingFavoriteNoteId;
    const titleEl = document.getElementById('wc-note-title');
    const textEl = document.getElementById('wc-note-text');
    if (!id || !titleEl || !textEl) return;
    const store = getWechatFavoritesStore();
    const item = store.items.find(fav => fav.id === id);
    if (!item) return;
    item.title = titleEl.value.trim() || '未命名笔记';
    item.text = textEl.value;
    item.updatedAt = Date.now();
    saveWechatFavoritesStore(store);
}

function captureWechatNoteUndo() {
    const textEl = document.getElementById('wc-note-text');
    if (!textEl) return;
    window._wechatNoteUndo = window._wechatNoteUndo || [];
    window._wechatNoteRedo = [];
    const last = window._wechatNoteUndo[window._wechatNoteUndo.length - 1];
    if (last !== textEl.value) window._wechatNoteUndo.push(textEl.value);
    if (window._wechatNoteUndo.length > 50) window._wechatNoteUndo.shift();
}

function undoWechatFavoriteNote() {
    const textEl = document.getElementById('wc-note-text');
    if (!textEl || !window._wechatNoteUndo || !window._wechatNoteUndo.length) return;
    window._wechatNoteRedo = window._wechatNoteRedo || [];
    window._wechatNoteRedo.push(textEl.value);
    textEl.value = window._wechatNoteUndo.pop();
    saveWechatFavoriteNoteDraft();
}

function redoWechatFavoriteNote() {
    const textEl = document.getElementById('wc-note-text');
    if (!textEl || !window._wechatNoteRedo || !window._wechatNoteRedo.length) return;
    window._wechatNoteUndo = window._wechatNoteUndo || [];
    window._wechatNoteUndo.push(textEl.value);
    textEl.value = window._wechatNoteRedo.pop();
    saveWechatFavoriteNoteDraft();
}

function getWechatNoteActionHtml(type) {
    const icons = {
        undo: '<svg viewBox="0 0 48 48" fill="none"><path d="M11.2721 36.7279C14.5294 39.9853 19.0294 42 24 42C33.9411 42 42 33.9411 42 24C42 14.0589 33.9411 6 24 6C19.0294 6 14.5294 8.01472 11.2721 11.2721C9.61407 12.9301 6 17 6 17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 9V17H14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        redo: '<svg viewBox="0 0 48 48" fill="none"><path d="M36.7279 36.7279C33.4706 39.9853 28.9706 42 24 42C14.0589 42 6 33.9411 6 24C6 14.0589 14.0589 6 24 6C28.9706 6 33.4706 8.01472 36.7279 11.2721C38.3859 12.9301 42 17 42 17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 8V17H33" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        more: '<svg viewBox="0 0 48 48" fill="none"><circle cx="12" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="36" cy="24" r="3" fill="currentColor"/></svg>'
    };
    const labels = { undo: '撤销', redo: '重做', more: '转发' };
    const handlers = { undo: 'undoWechatFavoriteNote()', redo: 'redoWechatFavoriteNote()', more: 'shareWechatFavoriteNote()' };
    return `<button type="button" class="wc-note-action-btn" title="${labels[type]}" onclick="${handlers[type]}">${icons[type]}</button>`;
}

function openWechatFavoriteNoteEditor(noteId = '') {
    let note = noteId ? getWechatFavoriteById(noteId) : null;
    if (!note) {
        note = addWechatFavorite({ type: 'note', title: '新笔记', text: '', sourceKey: '' });
    }
    if (!note) return;
    window._wechatEditingFavoriteNoteId = note.id;
    window._wechatNoteUndo = [];
    window._wechatNoteRedo = [];
    openWechatFeatureScreen('笔记', `
        <div class="wc-note-page">
            <input id="wc-note-title" class="wc-note-title" value="${wcEscapeHtml(note.title || '')}" placeholder="标题" oninput="saveWechatFavoriteNoteDraft()">
            <textarea id="wc-note-text" class="wc-note-text" placeholder="记录文字、图片或者录音" onbeforeinput="captureWechatNoteUndo()" oninput="saveWechatFavoriteNoteDraft()">${wcEscapeHtml(note.text || '')}</textarea>
            <div class="wc-note-tools">
                <label><i class="ri-image-add-line"></i><span>图片</span><input type="file" accept="image/*" multiple onchange="handleWechatFavoriteNoteMedia(this, 'image')"></label>
                <label><i class="ri-mic-line"></i><span>录音</span><input type="file" accept="audio/*" onchange="handleWechatFavoriteNoteMedia(this, 'audio')"></label>
            </div>
            <div id="wc-note-media" class="wc-note-media">${getWechatFavoriteMediaHtml(note.media || [])}</div>
            <div class="wc-note-time">自动保存 · ${new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleString()}</div>
        </div>
    `, `${getWechatNoteActionHtml('undo')}${getWechatNoteActionHtml('redo')}${getWechatNoteActionHtml('more')}`);
    setWechatFeatureLeftText('收藏', 'openWechatFavorites()');
}

function handleWechatFavoriteNoteMedia(input, type) {
    const files = Array.from(input.files || []).slice(0, 6);
    const id = window._wechatEditingFavoriteNoteId;
    if (!files.length || !id) return;
    const store = getWechatFavoritesStore();
    const item = store.items.find(fav => fav.id === id);
    if (!item) return;
    item.media = Array.isArray(item.media) ? item.media : [];
    let remaining = files.length;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            item.media.push({ type, url: e.target.result, name: file.name });
            item.updatedAt = Date.now();
            remaining -= 1;
            if (remaining === 0) {
                saveWechatFavoritesStore(store);
                openWechatFavoriteNoteEditor(id);
            }
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function shareWechatFavorite(itemId) {
    const item = getWechatFavoriteById(itemId);
    if (!item) return;
    if (item.message) {
        shareWechatText(item.title || '收藏消息', item.text || '[微信消息]', {
            action: 'message_forward',
            title: item.title || '收藏消息',
            text: item.text || '',
            source: '微信收藏',
            message: item.message
        });
        return;
    }
    shareWechatText(item.title || '收藏', item.text || '[收藏内容]');
}

function shareWechatFavoriteNote() {
    const item = getWechatFavoriteById(window._wechatEditingFavoriteNoteId);
    if (!item) return;
    saveWechatFavoriteNoteDraft();
    shareWechatFavorite(item.id);
}

