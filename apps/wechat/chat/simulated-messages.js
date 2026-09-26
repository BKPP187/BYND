// ========== 微信模拟消息：转账 / 红包 / 语音 / 通话 ==========

const WECHAT_COMPOSER_CONFIG = {
    voice: {
        title: '发送语音',
        icon: 'ri-mic-line',
        primary: '发送语音'
    },
    transfer: {
        title: '转账',
        icon: 'ri-money-cny-circle-line',
        primary: '确认转账'
    },
    redpacket: {
        title: '发送红包',
        icon: 'ri-red-packet-line',
        primary: '发送红包'
    },
    videoCall: {
        title: '视频电话',
        icon: 'ri-video-chat-line',
        primary: '生成视频电话记录'
    },
    voiceCall: {
        title: '语音电话',
        icon: 'ri-phone-line',
        primary: '生成语音电话记录'
    },
    poke: {
        title: '拍一拍',
        icon: 'ri-hand-heart-line',
        primary: '发送拍一拍'
    },
    screen_shake: {
        title: '屏幕震动',
        icon: 'ri-shake-hands-line',
        primary: '发送震动'
    },
    music_card: {
        title: '发送音乐',
        icon: 'ri-music-2-line',
        primary: '发送音乐卡片'
    }
};

function getCurrentChatChar() {
    const charId = window.currentChatCharId;
    if (!charId) return null;
    return window.myCharacters.find(c => c.id === charId) || null;
}
window.getCurrentChatChar = getCurrentChatChar;

function appendWechatMessage(msg) {
    const char = getCurrentChatChar();
    if (!char) return;
    if (!char.history) char.history = [];
    if (window._wechatReplyDraft) {
        msg.replyTo = { ...window._wechatReplyDraft };
        clearWechatReplyDraft();
    }
    ensureMessageTimestamp(msg);
    syncWechatMessageDescription(msg);
    char.history.push(msg);
    if (msg.isMe && typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    if (msg.isMe) notifyWechatMonitors(char, msg);

    refreshChatView(char);
    saveCharactersToStorage();
    renderChatList();
}

function getWechatModalRoot() {
    return document.querySelector('.phone-container') || document.body;
}

let wechatImagePreviewState = {
    images: [],
    index: 0,
    captions: []
};

function ensureWechatImagePreviewOverlay() {
    let overlay = document.getElementById('wc-image-preview-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'wc-image-preview-overlay';
    overlay.className = 'wc-image-preview-overlay hidden';
    overlay.innerHTML = `
        <button type="button" class="wc-image-preview-close" aria-label="关闭图片预览"><i class="ri-close-line"></i></button>
        <button type="button" class="wc-image-preview-nav prev" aria-label="上一张"><i class="ri-arrow-left-s-line"></i></button>
        <button type="button" class="wc-image-preview-nav next" aria-label="下一张"><i class="ri-arrow-right-s-line"></i></button>
        <div class="wc-image-preview-stage">
            <img src="" alt="图片预览">
            <div class="wc-image-preview-caption"></div>
        </div>
    `;
    overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target.classList.contains('wc-image-preview-stage')) closeWechatImagePreview();
    });
    overlay.querySelector('.wc-image-preview-close')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        closeWechatImagePreview();
    });
    overlay.querySelector('.wc-image-preview-nav.prev')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        navigateWechatImagePreview(-1);
    });
    overlay.querySelector('.wc-image-preview-nav.next')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        navigateWechatImagePreview(1);
    });
    const stage = overlay.querySelector('.wc-image-preview-stage');
    let previewStartX = 0;
    let previewStartY = 0;
    let previewPointerId = null;
    stage?.addEventListener('pointerdown', event => {
        previewStartX = event.clientX;
        previewStartY = event.clientY;
        previewPointerId = event.pointerId;
        try {
            stage.setPointerCapture?.(event.pointerId);
        } catch (_) {}
    });
    stage?.addEventListener('pointerup', event => {
        if (previewPointerId !== event.pointerId) return;
        const dx = event.clientX - previewStartX;
        const dy = event.clientY - previewStartY;
        previewPointerId = null;
        if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy) * 0.72) {
            event.preventDefault();
            event.stopPropagation();
            navigateWechatImagePreview(dx < 0 ? 1 : -1);
        }
    });
    stage?.addEventListener('pointercancel', event => {
        if (previewPointerId === event.pointerId) previewPointerId = null;
    });
    getWechatModalRoot().appendChild(overlay);
    return overlay;
}

function renderWechatImagePreview() {
    const overlay = ensureWechatImagePreviewOverlay();
    const images = Array.isArray(wechatImagePreviewState.images) ? wechatImagePreviewState.images : [];
    const index = Math.max(0, Math.min(images.length - 1, Number(wechatImagePreviewState.index || 0)));
    const imageUrl = images[index] || '';
    const img = overlay.querySelector('img');
    const captionEl = overlay.querySelector('.wc-image-preview-caption');
    const prev = overlay.querySelector('.wc-image-preview-nav.prev');
    const next = overlay.querySelector('.wc-image-preview-nav.next');
    if (img) img.src = imageUrl;
    if (captionEl) {
        const caption = images.length > 1 ? `第 ${index + 1} / ${images.length} 张` : (wechatImagePreviewState.captions[index] || '');
        captionEl.textContent = stripWechatPromptText(caption, 72);
        captionEl.style.display = captionEl.textContent ? 'block' : 'none';
    }
    if (prev) prev.style.display = images.length > 1 ? 'inline-flex' : 'none';
    if (next) next.style.display = images.length > 1 ? 'inline-flex' : 'none';
}

function navigateWechatImagePreview(delta) {
    const images = Array.isArray(wechatImagePreviewState.images) ? wechatImagePreviewState.images : [];
    if (images.length <= 1) return;
    const next = (Number(wechatImagePreviewState.index || 0) + Number(delta || 0) + images.length) % images.length;
    wechatImagePreviewState.index = next;
    renderWechatImagePreview();
}

function openWechatImagePreview(src, caption = '', gallery = null, activeIndex = 0) {
    const imageUrl = String(src || '').trim();
    if (!imageUrl) return;
    const overlay = ensureWechatImagePreviewOverlay();
    const images = (Array.isArray(gallery) ? gallery : [imageUrl])
        .map(item => String(item || '').trim())
        .filter(Boolean);
    const index = Math.max(0, Math.min(images.length - 1, Number(activeIndex || 0)));
    wechatImagePreviewState = {
        images: images.length ? images : [imageUrl],
        index,
        captions: [caption]
    };
    renderWechatImagePreview();
    overlay.classList.remove('hidden');
}

function closeWechatImagePreview() {
    const overlay = document.getElementById('wc-image-preview-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    wechatImagePreviewState = { images: [], index: 0, captions: [] };
    const img = overlay.querySelector('img');
    if (img) img.removeAttribute('src');
}

window.openWechatImagePreview = openWechatImagePreview;
window.closeWechatImagePreview = closeWechatImagePreview;
window.navigateWechatImagePreview = navigateWechatImagePreview;

if (!window._wechatImagePreviewKeyBound) {
    window._wechatImagePreviewKeyBound = true;
    document.addEventListener('keydown', event => {
        const overlay = document.getElementById('wc-image-preview-overlay');
        if (!overlay || overlay.classList.contains('hidden')) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeWechatImagePreview();
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            navigateWechatImagePreview(-1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            navigateWechatImagePreview(1);
        }
    });
}

function getWechatCharDisplayName(char) {
    if (char && char.isGroupChat) return getWechatQQGroupDisplayName(char);
    return (char && char.chatConfig && char.chatConfig.nickname) || (char && char.name) || '对方';
}

function isWechatCoupleTheme() {
    return typeof getWechatUiThemeId === 'function' && getWechatUiThemeId() === 'couple';
}
window.isWechatCoupleTheme = isWechatCoupleTheme;

function getWechatCoupleMoodSource(char) {
    const parts = [];
    const snapshot = typeof getWechatAiStatusSnapshot === 'function' ? getWechatAiStatusSnapshot(char) : null;
    if (snapshot && snapshot.fields) {
        parts.push(
            snapshot.fields.innerMonologue,
            snapshot.fields.miniDiary,
            snapshot.fields.thoughts,
            snapshot.fields.action,
            snapshot.fields.gaze,
            snapshot.reason
        );
    }
    const history = Array.isArray(char && char.history) ? char.history : [];
    for (let i = history.length - 1; i >= 0 && parts.length < 12; i -= 1) {
        const msg = history[i];
        if (!msg || msg.isMe || isWechatHiddenChatSurfaceMessage(msg) || msg.type === 'system_notice') continue;
        const text = (typeof getWechatTextMessageVisibleText === 'function'
            ? getWechatTextMessageVisibleText(msg, char)
            : (msg.content || msg.description || ''));
        if (text) parts.push(text);
    }
    return stripWechatPromptText(parts.filter(Boolean).join(' '), 900);
}

function getWechatCoupleMoodKaomoji(char) {
    const source = getWechatCoupleMoodSource(char);
    const rules = [
        { pattern: /害羞|脸红|不好意思|心跳|暧昧|亲|吻|抱|贴近|想你|喜欢|爱|舍不得|撒娇|甜|黏/i, face: '///▽///' },
        { pattern: /开心|高兴|快乐|笑|哈哈|愉快|期待|雀跃|兴奋|满足|安心/i, face: '> ᵕ <' },
        { pattern: /难过|委屈|失落|低落|哭|眼泪|孤单|想哭|心酸|疼|难受|不安/i, face: 'T ^ T' },
        { pattern: /生气|烦|恼|不爽|气死|火大|冷脸|哼|炸毛|忍住/i, face: '>_<#' },
        { pattern: /吃醋|醋|嫉妒|占有|别扭|嘴硬|不甘心|酸/i, face: '¬_¬' },
        { pattern: /困|累|疲惫|睡|醒|懒|发呆|迷糊|困倦/i, face: '- ᵕ -' },
        { pattern: /紧张|慌|怕|担心|小心|试探|犹豫|纠结/i, face: '> <' }
    ];
    const matched = rules.find(rule => rule.pattern.test(source));
    return matched ? matched.face : '> ᵕ <';
}

function syncWechatCoupleThemeHeader(char = getCurrentChatChar()) {
    const room = document.getElementById('wechat-chat-room');
    if (!room) return;
    let pill = document.getElementById('wc-couple-theme-pill');
    if (!isWechatCoupleTheme() || !char) {
        pill?.remove();
        return;
    }
    if (!pill) {
        pill = document.createElement('button');
        pill.type = 'button';
        pill.id = 'wc-couple-theme-pill';
        pill.className = 'wc-couple-theme-pill';
        pill.onclick = () => openChatSettings();
        const contentEl = document.getElementById('chat-room-content');
        room.insertBefore(pill, contentEl || room.firstChild);
    }
    const profile = getWechatChatUserProfile(char);
    const userAvatar = profile.avatar || DEFAULT_AVATAR;
    const charAvatar = getWechatCharAvatarSource(char);
    const kaomoji = getWechatCoupleMoodKaomoji(char);
    pill.setAttribute('aria-label', `${getWechatCharDisplayName(char)} 当前心情 ${kaomoji}`);
    pill.innerHTML = `
        <img class="wc-couple-char-avatar" src="${wcEscapeAttr(charAvatar)}" onerror="this.src='${DEFAULT_AVATAR}'">
        <span>${wcEscapeHtml(kaomoji)}</span>
        <img class="wc-couple-user-avatar" src="${wcEscapeAttr(userAvatar)}" onerror="this.src='${DEFAULT_AVATAR}'">
    `;
}
window.syncWechatCoupleThemeHeader = syncWechatCoupleThemeHeader;

function renderWechatMessageAvatarHtml(msg, avatarUrl, avatarClass, options = {}) {
    const src = wcEscapeAttr(avatarUrl || DEFAULT_AVATAR);
    const fallback = wcEscapeAttr(DEFAULT_AVATAR);
    if (!isWechatCoupleTheme()) {
        return `<img class="${avatarClass}" src="${src}" onerror="this.src='${fallback}'">`;
    }
    const sideClass = msg && msg.isMe ? 'me' : 'ai';
    if (options.showCoupleHeader === false) return '';
    const timeParts = formatWechatCoupleMessageDateTime(msg || {});
    return `
        <span class="msg-avatar-layer ${sideClass}">
            <img class="${avatarClass}" src="${src}" onerror="this.src='${fallback}'">
            <span class="msg-avatar-time">
                <span>${wcEscapeHtml(timeParts.date)}</span>
                <span>${wcEscapeHtml(timeParts.time)}</span>
            </span>
        </span>
    `;
}

function closeWechatMonitorRequestModal() {
    const modal = document.getElementById('wc-monitor-request-modal');
    if (modal) modal.classList.add('hidden');
}

function showWechatMonitorRequestModal(charId, requestId) {
    const char = (window.myCharacters || []).find(item => item && item.id === charId);
    if (!char || !char.chatConfig || !char.chatConfig.pendingMonitorRequest) return;
    const request = char.chatConfig.pendingMonitorRequest;
    if (requestId && request.id !== requestId) return;
    const label = WECHAT_MONITOR_MODE_LABELS[request.mode] || WECHAT_MONITOR_MODE_LABELS.persona;
    const name = getWechatCharDisplayName(char);
    let modal = document.getElementById('wc-monitor-request-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-monitor-request-modal';
        modal.className = 'wc-modal-overlay hidden wc-monitor-request-overlay';
        getWechatModalRoot().appendChild(modal);
    }
    modal.dataset.charId = charId;
    modal.dataset.requestId = request.id;
    modal.innerHTML = `
        <div class="wc-monitor-request-card">
            <div class="wc-monitor-request-head">
                <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" alt="">
                <div>
                    <span>监控剧情请求</span>
                    <strong>${wcEscapeHtml(name)}想要开启监控</strong>
                </div>
            </div>
            <div class="wc-monitor-request-mode">
                <i class="ri-radar-line"></i>
                <div><b>${wcEscapeHtml(label)}</b><p>${wcEscapeHtml(request.reason || '角色想根据当前剧情观察 BYND 内部聊天动态。')}</p></div>
            </div>
            <div class="wc-monitor-request-actions">
                <button type="button" onclick="rejectWechatMonitorRequest()">拒绝</button>
                <button type="button" class="primary" onclick="approveWechatMonitorRequest()">允许</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function resolveWechatMonitorRequestFromModal() {
    const modal = document.getElementById('wc-monitor-request-modal');
    if (!modal) return null;
    const charId = modal.dataset.charId;
    const requestId = modal.dataset.requestId;
    const char = (window.myCharacters || []).find(item => item && item.id === charId);
    const request = char && char.chatConfig && char.chatConfig.pendingMonitorRequest;
    if (!char || !request || request.id !== requestId) return null;
    return { char, request };
}

function approveWechatMonitorRequest() {
    const resolved = resolveWechatMonitorRequestFromModal();
    if (!resolved) {
        closeWechatMonitorRequestModal();
        return;
    }
    const { char, request } = resolved;
    const label = WECHAT_MONITOR_MODE_LABELS[request.mode] || WECHAT_MONITOR_MODE_LABELS.persona;
    char.chatConfig.monitorEnabled = true;
    char.chatConfig.monitorMode = request.mode;
    char.chatConfig.monitorReason = request.reason || '';
    char.chatConfig.monitorChangedByCharAt = Date.now();
    delete char.chatConfig.pendingMonitorRequest;
    if (!Array.isArray(char.history)) char.history = [];
    char.history.push({
        type: 'system_notice',
        isMe: false,
        content: `已允许：监控剧情已开启（${label}）`,
        timestamp: createMessageTimestamp()
    });
    closeWechatMonitorRequestModal();
    if (typeof updateWechatChatSettings === 'function') updateWechatChatSettings(char);
    saveCharactersToStorage();
    if (window.currentChatCharId === char.id) refreshChatView(char);
    renderChatList();
}

function rejectWechatMonitorRequest() {
    const resolved = resolveWechatMonitorRequestFromModal();
    if (!resolved) {
        closeWechatMonitorRequestModal();
        return;
    }
    const { char } = resolved;
    const name = getWechatCharDisplayName(char);
    delete char.chatConfig.pendingMonitorRequest;
    if (!Array.isArray(char.history)) char.history = [];
    char.history.push({
        type: 'system_notice',
        isMe: false,
        content: `已拒绝：没有允许${name}开启监控`,
        timestamp: createMessageTimestamp()
    });
    closeWechatMonitorRequestModal();
    saveCharactersToStorage();
    if (window.currentChatCharId === char.id) refreshChatView(char);
    renderChatList();
}

window.showWechatMonitorRequestModal = showWechatMonitorRequestModal;
window.closeWechatMonitorRequestModal = closeWechatMonitorRequestModal;
window.approveWechatMonitorRequest = approveWechatMonitorRequest;
window.rejectWechatMonitorRequest = rejectWechatMonitorRequest;

function syncWechatCurrentChatTitleState(text) {
    const char = getCurrentChatChar();
    const displayName = char ? getWechatCharDisplayName(char) : '';
    const titleText = text || displayName || '...';
    const title = document.getElementById('chat-room-title');
    const floatName = document.getElementById('wc-float-name');
    const status = document.querySelector('#wechat-chat-room .wc-room-status');
    if (title) title.textContent = titleText;
    if (floatName) floatName.textContent = titleText;
    if (status) {
        status.classList.toggle('is-replying', !!text);
        status.innerHTML = '<b></b>在线<i class="ri-arrow-right-s-line"></i>';
    }
}

function updateWechatCurrentChatHeader(char) {
    if (!char || window.currentChatCharId !== char.id) return;
    syncWechatCurrentChatTitleState('');
    syncWechatCoupleThemeHeader(char);
    renderChatList();
}

function stripWechatPromptText(value, maxLength = 360) {
    const text = cleanWechatVisibleContent(value)
        .replace(/<[^>]+>/g, '')
        .replace(/\|\|\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

function formatWechatSnapshotTime(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return `${padWechatDatePart(safeDate.getHours())}:${padWechatDatePart(safeDate.getMinutes())}`;
}

function getWechatStatusSerial(char) {
    const source = String((char && char.id) || (char && char.name) || 'wechat-status');
    const hash = source.split('').reduce((sum, ch) => ((sum * 31) + ch.charCodeAt(0)) >>> 0, 17);
    return `#${String(hash % 1000000).padStart(6, '0')}`;
}

function isWechatStatusPlaceholderValue(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return true;
    return [
        /^API\s*未返回$/i,
        /^等待.*生成/,
        /^状态.*生成/,
        /^生成失败/,
        /当前剧情.*(?:没有|暂无|未).{0,12}(?:描写|描述|变化|内容)/,
        /(?:没有|暂无|未).{0,8}(?:新|具体|特别|明确)?.{0,6}(?:描写|描述|变化|记录|内容)/,
        /保持角色设定/,
        /沿用当前角色设定/,
        /按.*人设.*保持当前状态/,
        /不适用|无该器官/,
        /未.{0,4}描写/,
        /固定占位/,
        /模板化省略/,
        /^一枚.{0,24}表情$/,
        /^一张图片$/
    ].some(pattern => pattern.test(text));
}

function sanitizeWechatAiStatusFieldValue(value, key = '') {
    let text = stripWechatPromptText(value, 180)
        .replace(/[\[【]\s*(?:微信表情|表情|贴纸|sticker|emoji)\s*[：:]?\s*([^\]】\r\n]{0,80})[\]】]?/gi, (_, name) => {
            const label = String(name || '')
                .replace(/[\]】]+$/g, '')
                .replace(/^表情\s*/i, '')
                .trim();
            return label && !/^\d{1,5}$/.test(label) ? `一枚${label}表情` : '一枚表情';
        })
        .replace(/表情\s*\d{1,5}\]?/gi, '一枚表情')
        .replace(/一枚表情(?:\s*一枚表情)+/g, '一枚表情')
        .replace(/[\[【]\s*(?:图片|微信图片|照片|image)\s*[：:]?[^\]】\r\n]{0,80}[\]】]?/gi, '一张图片')
        .replace(/\s+/g, ' ')
        .trim();
    if (key === 'miniDiary') {
        text = text
            .replace(/想回头再和(.{1,18})说清楚[「“]?一枚表情[」”]?这件事[。.]?/g, '想等气氛合适时，再问清那枚表情背后的意思。')
            .replace(/想回头再和(.{1,18})说清楚[「“]?一张图片[」”]?这件事[。.]?/g, '想等气氛合适时，再问清那张图片背后的意思。');
    }
    return text;
}

function getWechatStatusFieldDisplay(snapshot, item) {
    if (snapshot && snapshot.fields) {
        const value = sanitizeWechatAiStatusFieldValue(snapshot.fields[item.key], item.key);
        if (!isWechatStatusPlaceholderValue(value)) return value;
    }
    return '';
}

function buildWechatPreviousAiStatusPrompt(char) {
    const snapshot = getWechatAiStatusSnapshot(char);
    if (!snapshot || !snapshot.fields) return '';
    const useful = {};
    WECHAT_AI_STATUS_FIELDS.forEach(item => {
        const value = sanitizeWechatAiStatusFieldValue(snapshot.fields[item.key], item.key);
        if (!isWechatStatusPlaceholderValue(value)) useful[item.key] = value;
    });
    if (!Object.keys(useful).length) return '';
    const timeContext = getWechatCurrentTimeContext(char);
    const timestamp = typeof getChatApiMessageTimestamp === 'function'
        ? getChatApiMessageTimestamp({ timestamp: snapshot.updatedAt }) : 0;
    const recordedAt = timeContext.mode !== 'virtual' && timestamp
        ? `记录于${formatWechatDateTimeForPrompt(timestamp)}。` : '';
    return `【历史状态】${recordedAt}以下只代表记录当时的状态，不能默认旧动作、服饰、地点一直延续到现在。\n${JSON.stringify(useful, null, 2)}`;
}

function buildWechatWorldBookPrompt(char, limit = 30) {
    const entries = Array.isArray(char && char.worldBook) ? char.worldBook : [];
    const selectedIds = getWechatPromptWorldBookSelection(char);
    const enabled = entries
        .filter((entry, index) => entry && entry.enabled !== false && (!selectedIds || selectedIds.includes(getWechatWorldBookEntryId(entry, index))))
        .slice(0, limit)
        .map(entry => {
            const title = entry.name || entry.title || entry.key || entry.keys || entry.keyword || '世界书';
            const content = entry.content || entry.text || entry.entry || entry.value || entry.comment || entry.description || '';
            const statusLike = /<\s*(?:jwy|status|state)\b|<\/\s*(?:jwy|status|state)\s*>|状态栏格式|状态栏|status\s*bar|weibo-status-bar/i.test(String(content || ''));
            return stripWechatPromptText(`${title}：${content}`, statusLike ? 2600 : 420);
        })
        .filter(Boolean);
    return enabled.length ? `【世界书】\n${enabled.join('\n')}` : '';
}

function getWechatCharacterPersonaText(char, maxLength = 10000) {
    if (!char) return '';
    const parts = [];
    const push = (label, value, limit = 2200) => {
        const text = stripWechatPromptText(value, limit);
        if (text) parts.push(`【${label}】\n${text}`);
    };
    push('角色描述', char.description, 5200);
    push('性格', char.personality, 1800);
    push('场景', char.scenario, 1800);
    push('对话样例', char.mes_example || char.mesExample, 2200);
    push('系统提示词', char.system_prompt || char.systemPrompt, 2200);
    push('后置指令', char.post_history_instructions || char.postHistoryInstructions, 1800);
    push('作者备注', char.creator_notes || char.creatorNotes || char.character_note || char.characterNote, 1600);
    push('原始开场', char.first_mes_original || char.first_mes, 1200);
    if (Array.isArray(char.alternates) && char.alternates.length) {
        push('备选开场/语气样例', char.alternates.slice(0, 5).join('\n'), 2200);
    }
    const worldBook = buildWechatWorldBookPrompt(char, 30);
    if (worldBook) parts.push(worldBook);
    const joined = parts.join('\n\n');
    return joined.length > maxLength ? `${joined.slice(0, maxLength)}\n\n【以上角色卡内容已自动截断，保留核心设定。】` : joined;
}

function getWechatVoicePromptContent(msg) {
    const rawDuration = Number(msg.duration);
    const duration = formatWechatDuration(Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration) : (msg.duration || 8));
    const transcript = stripWechatPromptText(msg.transcript || msg.content || '', 130);
    const meta = formatWechatVoiceMetaForPrompt(msg.voiceMeta);
    const parts = [`[语音 ${duration}]`];
    if (transcript && !/^\[语音/.test(transcript)) parts.push(`转写：${transcript}`);
    if (meta) parts.push(`声音线索（仅作语气参考，不要机械复述标签）：${meta}`);
    return parts.join(' ');
}

function getWechatMessagePromptContent(msg) {
    if (!msg) return '';
    if (isWechatRegexPayloadMessage(msg)) return '';
    if (msg.type === 'image_stack') return msg.description || `[${getWechatImageStackSources(msg).length || 0}张图片]`;
    if (msg.type === 'image') return msg.description || '[图片]';
    if (msg.type === 'sticker') {
        const name = stripWechatPromptText(msg.stickerName || msg.name || '', 40);
        return name ? `发了一枚表情（${name}）` : '发了一枚表情';
    }
    if (msg.type === 'voice') return getWechatVoicePromptContent(msg);
    if (isWechatSpecialMessage(msg.type)) return msg.description || msg.content || '[微信特殊消息]';
    if (msg.type === 'system_notice') return `[系统提示] ${msg.content || ''}`;
    return msg.content || msg.dialogue || msg.description || '';
}

function buildWechatRecentHistoryForPrompt(char, limit = 12) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const timeContext = getWechatCurrentTimeContext(char);
    const userName = ((typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : (typeof getUserProfile === 'function' ? getUserProfile() : {})) || {}).name || '用户';
    const charName = getWechatCharDisplayName(char);
    const lines = history
        .filter(msg => msg && msg.type !== 'user_event' && !isWechatRegexPayloadMessage(msg, char)
            && (typeof isChatApiInternalHistoryMessage !== 'function' || !isChatApiInternalHistoryMessage(msg)))
        .slice(-limit)
        .map(msg => {
            const role = msg.isMe ? userName : charName;
            const content = stripWechatPromptText(getWechatMessagePromptContent(msg), 220);
            const timeLabel = typeof buildChatApiHistoryTimeLabel === 'function'
                ? buildChatApiHistoryTimeLabel(msg, timeContext) : '';
            return content ? `${timeLabel}${role}: ${content}` : '';
        }).filter(Boolean);
    return lines.length ? lines.join('\n') : '暂无聊天记录。';
}

function cleanWechatJsonCandidate(value) {
    const source = String(value || '')
        .replace(/^\uFEFF/, '')
        .replace(/^```(?:json|javascript|js)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .replace(/^[\s\S]*?(?=[{\[])/, '')
        .trim();
    let out = '';
    let quote = '';
    let escape = false;
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (quote) {
            if (escape) {
                out += ch;
                escape = false;
            } else if (ch === '\\') {
                out += ch;
                escape = true;
            } else if ((/[“”]/.test(quote) && /[“”]/.test(ch)) || (/[‘’]/.test(quote) && /[‘’]/.test(ch)) || ch === quote) {
                out += /[“”]/.test(quote) ? '"' : (/[‘’]/.test(quote) ? "'" : ch);
                quote = '';
            } else {
                // Smart punctuation inside a JSON string is letter content,
                // not a delimiter to replace or a reason to salvage a fragment.
                out += (/[“”]/.test(quote) && ch === '"') || (/[‘’]/.test(quote) && ch === "'") ? '\\' + ch : ch;
            }
            continue;
        }
        if (ch === '/' && source[i + 1] === '/') {
            while (i < source.length && !/[\r\n]/.test(source[i])) i += 1;
            out += '\n';
        } else if (ch === '/' && source[i + 1] === '*') {
            const end = source.indexOf('*/', i + 2);
            i = end < 0 ? source.length : end + 1;
            out += ' ';
        } else if (/["'“”‘’]/.test(ch)) {
            quote = ch;
            out += /[“”]/.test(ch) ? '"' : (/[‘’]/.test(ch) ? "'" : ch);
        } else if (ch !== ',' || !/^\s*[}\]]/.test(source.slice(i + 1))) {
            out += ch;
        }
    }
    return out;
}

function stripWechatJsonComments(value) {
    const source = String(value || '');
    let out = '';
    let quote = '';
    let escape = false;
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        const next = source[i + 1];
        if (quote) {
            out += ch;
            if (escape) escape = false;
            else if (ch === '\\') escape = true;
            else if (ch === quote) quote = '';
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            out += ch;
            continue;
        }
        if (ch === '/' && next === '/') {
            while (i < source.length && !/[\r\n]/.test(source[i])) i += 1;
            out += '\n';
            continue;
        }
        if (ch === '/' && next === '*') {
            i += 2;
            while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
            i += 1;
            continue;
        }
        out += ch;
    }
    return out;
}

function extractWechatBalancedJsonCandidate(value) {
    const source = cleanWechatJsonCandidate(value);
    const starts = ['{', '[']
        .map(ch => source.indexOf(ch))
        .filter(index => index >= 0);
    if (!starts.length) return '';
    const start = Math.min(...starts);
    const stack = [];
    let quote = '';
    let escape = false;
    for (let i = start; i < source.length; i += 1) {
        const ch = source[i];
        if (quote) {
            if (escape) escape = false;
            else if (ch === '\\') escape = true;
            else if (ch === quote) quote = '';
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if ((ch === '}' || ch === ']') && stack.length) {
            const expected = stack.pop();
            if (ch !== expected) return '';
            if (!stack.length) return source.slice(start, i + 1);
        }
    }
    return '';
}

function repairWechatJsonFragment(value) {
    let source = cleanWechatJsonCandidate(stripWechatJsonComments(value));
    const starts = ['{', '['].map(ch => source.indexOf(ch)).filter(index => index >= 0);
    if (!starts.length) return '';
    source = source.slice(Math.min(...starts));
    const stack = [];
    let quote = '';
    let escape = false;
    let lastSafe = 0;
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (quote) {
            if (escape) escape = false;
            else if (ch === '\\') escape = true;
            else if (ch === quote) quote = '';
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if ((ch === '}' || ch === ']') && stack.length) stack.pop();
        if (ch === '}' || ch === ']' || ch === '"' || /\d/.test(ch) || ch === 'e' || ch === 'E' || ch === 'l') lastSafe = i + 1;
    }
    let repaired = source.slice(0, lastSafe || source.length).trim();
    if (quote) repaired += quote;
    repaired = repaired.replace(/,\s*$/, '');
    repaired += stack.slice().reverse().join('');
    return cleanWechatJsonCandidate(repaired);
}

function tryParseWechatJsonCandidate(candidate) {
    const cleaned = cleanWechatJsonCandidate(stripWechatJsonComments(candidate));
    if (!cleaned) return null;
    const jsonish = cleaned
        .replace(/([{,]\s*)([A-Za-z_$][\w$-]*|[\u4e00-\u9fa5]{1,24})\s*:/g, '$1"$2":')
        .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => JSON.stringify(inner.replace(/\\'/g, "'")));
    const variants = [
        cleaned,
        cleaned.replace(/,\s*([}\]])/g, '$1'),
        jsonish,
        jsonish.replace(/,\s*([}\]])/g, '$1')
    ];
    for (const item of variants) {
        try {
            return JSON.parse(item);
        } catch (_) {}
    }
    return null;
}

function parseWechatJsonObject(text) {
    const source = String(text || '').trim();
    if (!source) return null;
    const cleaned = cleanWechatJsonCandidate(source);
    const candidates = [
        cleaned,
        extractWechatBalancedJsonCandidate(cleaned),
        repairWechatJsonFragment(cleaned)
    ].filter(Boolean);
    for (const candidate of candidates) {
        const parsed = tryParseWechatJsonCandidate(candidate);
        if (parsed && typeof parsed === 'object') return parsed;
    }
    const starts = ['{', '['].map(ch => cleaned.indexOf(ch)).filter(index => index >= 0);
    if (starts.length) {
        const fragment = cleaned.slice(Math.min(...starts));
        let cut = fragment.length;
        for (let attempt = 0; attempt < 40 && cut > 8; attempt += 1) {
            const commaCut = fragment.lastIndexOf(',', cut - 1);
            const braceCut = Math.max(fragment.lastIndexOf('}', cut - 1), fragment.lastIndexOf(']', cut - 1));
            cut = Math.max(commaCut, braceCut);
            if (cut <= 0) break;
            const repaired = repairWechatJsonFragment(fragment.slice(0, cut));
            const parsed = tryParseWechatJsonCandidate(repaired);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    }
    return null;
}

function isWechatAiStatusSnapshotComplete(snapshot) {
    return !!(
        snapshot
        && snapshot.generatedBy === 'api'
        && snapshot.fields
        && WECHAT_AI_STATUS_FIELDS.every(item => {
            const value = sanitizeWechatAiStatusFieldValue(snapshot.fields[item.key], item.key);
            return !isWechatStatusPlaceholderValue(value);
        })
    );
}

function normalizeWechatAiStatusSnapshot(raw, char, reason = 'api') {
    normalizeWechatAiStatusSnapshot.lastMissingKeys = [];
    if (!raw || typeof raw !== 'object') return null;
    const data = raw;
    const fieldsSource = data.fields && typeof data.fields === 'object' ? data.fields : data;
    const aliases = {
        innerMonologue: ['innerMonologue', 'inner_monologue', '内心独白', '内心声音'],
        miniDiary: ['miniDiary', 'mini_diary', '小日记'],
        thoughts: ['thoughts', 'thinking', '想法'],
        outfit: ['outfit', 'clothing', '服饰', '穿着'],
        posture: ['posture', 'pose', '姿势'],
        action: ['action', 'movement', '动作'],
        gaze: ['gaze', 'eyes', '目光', '视线'],
        penis: ['penis', 'Penis', 'PENIS', '阴茎', '身体状态', '身体反应', '生理状态', '体感', 'bodyState', 'bodyReaction']
    };
    const fields = {};
    WECHAT_AI_STATUS_FIELDS.forEach(item => {
        const keys = aliases[item.key] || [item.key, item.label];
        const value = keys.map(key => fieldsSource[key]).find(v => v != null && String(v).trim());
        fields[item.key] = sanitizeWechatAiStatusFieldValue(value || '', item.key);
    });
    const missingKeys = WECHAT_AI_STATUS_FIELDS
        .filter(item => isWechatStatusPlaceholderValue(fields[item.key]))
        .map(item => item.key);
    if (missingKeys.length) {
        normalizeWechatAiStatusSnapshot.lastMissingKeys = missingKeys;
        return null;
    }
    return {
        updatedAt: Date.now(),
        reason,
        generatedBy: 'api',
        fields
    };
}

function getWechatAiStatusSnapshot(char) {
    const snapshot = char && char.chatConfig && char.chatConfig.aiStatusSnapshot;
    if (snapshot && snapshot.fields && isWechatAiStatusSnapshotComplete(snapshot)) return snapshot;
    return null;
}

function isWechatAutoStatusSnapshotReason(reason) {
    return String(reason || '') === 'after_reply';
}

function isWechatAiStatusGenerationActive() {
    return !!(window._wechatAiStatusGenerating && window._wechatAiStatusGenerating.size > 0);
}

function shouldDeferWechatMemoryAfterReply(char) {
    if (!char) return false;
    const statusRequests = window._wechatAiStatusGenerating;
    if (statusRequests && statusRequests.has(char.id)) return true;
    return !shouldSkipWechatAiStatusSnapshotRequest(char, { reason: 'after_reply' });
}

function shouldSkipWechatAiStatusSnapshotRequest(char, options = {}) {
    if (!char) return true;
    if (options.force) return false;
    if (!isWechatAutoStatusSnapshotReason(options.reason)) return false;
    if (getWechatChatApiPauseRemainingMs() > 0) return true;
    const now = Date.now();
    const snapshot = getWechatAiStatusSnapshot(char);
    const snapshotAt = Number(snapshot && snapshot.updatedAt) || 0;
    // A decided change of heart may refresh a recent snapshot; the retry cooldown below still applies.
    if (snapshotAt && !options.decided && now - snapshotAt < WECHAT_AI_STATUS_AUTO_REFRESH_COOLDOWN_MS) return true;
    const lastRequestedAt = Number(char.chatConfig && char.chatConfig.aiStatusAutoRequestedAt) || 0;
    return !!(lastRequestedAt && now - lastRequestedAt < WECHAT_AI_STATUS_AUTO_RETRY_COOLDOWN_MS);
}

function markWechatAiStatusAutoRequest(char, options = {}) {
    if (!char || !isWechatAutoStatusSnapshotReason(options.reason)) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.aiStatusAutoRequestedAt = Date.now();
}

function buildWechatIdentityContextPrompt(char, userProfile = null) {
    const profile = userProfile || ((typeof getWechatChatUserProfile === 'function')
        ? getWechatChatUserProfile(char)
        : ((typeof getUserProfile === 'function') ? getUserProfile() : {}));
    const config = (char && char.chatConfig) || {};
    const originalName = (char && char.name) || '未命名角色';
    const nickname = config.nickname || '';
    const displayName = getWechatCharDisplayName(char);
    const userName = (profile && profile.name) || '用户';
    const userTitle = config.userTitle || userName;
    const rows = [
        `- 角色原名：${originalName}`,
        `- 当前聊天显示名：${displayName}`,
        nickname
            ? `- 用户给角色设置的备注名：${nickname}（这是用户给角色的备注，不是用户本人名字，也不是当前聊天话题）`
            : '- 用户尚未给角色设置备注名',
        `- 用户名字：${userName}`,
        `- 角色对用户的称呼/备注：${userTitle}`,
        profile && profile.bio ? `- 用户简介：${stripWechatPromptText(profile.bio, 260)}` : '',
        profile && profile.signature ? `- 用户个性签名/当前人设：${stripWechatPromptText(profile.signature, 260)}` : '',
        '- 用户本人的身份、外貌与经历以上面用户自己填写的资料为准；角色卡里没写的用户信息不要替用户设定'
    ].filter(Boolean);
    return `【身份与称呼上下文】\n${rows.join('\n')}`;
}

function buildWechatPresetPromptForStatus(char) {
    try {
        const preset = (typeof getActivePreset === 'function') ? getActivePreset() : null;
        if (!preset || !Array.isArray(preset.prompts) || !preset.prompts.length) return '';
        const enabled = preset.prompts
            .filter(item => item && item.enabled !== false && item.content)
            .slice(0, 8)
            .map((item, index) => {
                const title = item.name || item.title || `预设${index + 1}`;
                let content = String(item.content || '');
                const profile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : {};
                content = content
                    .replace(/\{\{char\}\}/gi, (char && char.name) || getWechatCharDisplayName(char))
                    .replace(/\{\{user\}\}/gi, (profile && profile.name) || '用户')
                    .replace(/\{\{description\}\}/gi, String((char && char.description) || '').slice(0, 900))
                    .replace(/\{\{personality\}\}/gi, String((char && char.description) || '').slice(0, 900));
                return `- ${stripWechatPromptText(title, 40)}：${stripWechatPromptText(content, 520)}`;
            })
            .filter(Boolean);
        return enabled.length ? `【当前启用预设】\n${enabled.join('\n')}` : '';
    } catch (e) {
        console.warn('build status preset prompt failed:', e);
        return '';
    }
}

function buildWechatRegexPromptForStatus(char) {
    if (typeof buildRegexAnchor !== 'function') return '';
    try {
        return buildRegexAnchor(char) || '';
    } catch (e) {
        console.warn('build status regex prompt failed:', e);
        return '';
    }
}

function getWechatUserMomentsPromptForStatus() {
    if (typeof buildUserMomentsAnchor !== 'function') return '';
    try {
        return buildUserMomentsAnchor() || '';
    } catch (_) {
        return '';
    }
}

async function requestWechatAiStatusSnapshot(charOrId, options = {}) {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    if (!char) return null;
    char.chatConfig = char.chatConfig || {};
    window._wechatAiStatusGenerating = window._wechatAiStatusGenerating || new Map();
    if (window._wechatAiStatusGenerating.has(char.id)) {
        return window._wechatAiStatusGenerating.get(char.id);
    }
    if (shouldSkipWechatAiStatusSnapshotRequest(char, options)) {
        return getWechatAiStatusSnapshot(char);
    }
    markWechatAiStatusAutoRequest(char, options);

    const promise = Promise.resolve().then(async () => {
        let snapshot = null;
        let errorText = '';
        try {
            const isBackgroundStatusRequest = isWechatAutoStatusSnapshotReason(options.reason) && !options.force;
            const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : ((typeof getUserProfile === 'function') ? getUserProfile() : { name: '用户' });
            const identityAnchor = buildWechatIdentityContextPrompt(char, userProfile);
            const presetAnchor = buildWechatPresetPromptForStatus(char);
            const regexAnchor = buildWechatRegexPromptForStatus(char);
            const momentsAnchor = getWechatUserMomentsPromptForStatus();
            const previousStatus = buildWechatPreviousAiStatusPrompt(char);
            const livingWorldStatus = typeof window.getLivingWorldRelevantEventsForChar === 'function' ? window.getLivingWorldRelevantEventsForChar(char, 3) : '';
            // Status is a compact receipt rather than a second full chat completion.
            const worldBookAnchor = stripWechatPromptText(buildWechatWorldBookPrompt(char), 1800);
            const memoryAnchor = typeof buildWechatMemoryPrompt === 'function' ? stripWechatPromptText(buildWechatMemoryPrompt(char), 1800) : '';
            const characterCard = getWechatCharacterPersonaText(char, 3000);
            const timeAnchor = typeof buildCurrentTimeAnchor === 'function' ? buildCurrentTimeAnchor(char) : '';
            const baseSystemPrompt = `你是 BYND 的微信角色状态收据生成器。你的任务不是继续聊天，而是根据真实上下文生成「${char.name || '角色'}」此刻的状态快照。只返回 JSON，不要 Markdown，不要解释。JSON 字段必须包含：innerMonologue, miniDiary, thoughts, outfit, posture, action, gaze, penis；字段名必须保留 penis，页面会显示为 PENIS。miniDiary 是想对用户说但没说出口的话。必须综合角色卡、角色设定、启用预设、正则设定、世界书、当前聊天备注/称呼、记忆、朋友圈、最近聊天和上一轮状态。用户给角色设置的备注只是身份元信息，不是用户名字，也不一定是聊天主题；如果最近聊天没有谈到名字/备注/称呼，不要让内心独白、小日记或想法围绕备注展开。不要编造用户没有说过的名字争议。所有字段都按最近聊天情绪和角色设定自然生成，禁止固定占位、模板化省略、拒绝式套话或“未特别描写”。禁止输出 [表情]、[微信表情:...]、表情031、[图片] 这类占位符；如果最近消息是表情、贴纸或图片，只能用自然语言写它造成的气氛或角色误读，不能照抄占位符。
outfit、posture、action、gaze、penis 都必须写当前这一刻的具体状态；禁止写“没有新的描写/没有变化/保持角色设定/沿用设定/不适用/无该器官/当前剧情没有……”。
penis 是 PENIS 栏的身体/生理状态字段，不是拒绝字段，也不是固定模板。状态是什么就写什么：必须按当前上下文、角色身体设定、世界书、服饰、姿势、情绪、关系阶段和剧情尺度推演。角色卡明确有对应器官时，可以如实写该器官此刻在衣物、姿势、刺激和情绪影响下的具体状态；角色设定不对应该器官时，也要写与该角色身体相符的下腹、腿间、敏感处、呼吸、体温或肌肉反应，不能用否定句绕过。不要无上下文硬升级情色；已有成人/亲密上下文时，就按当下尺度具体写。`;
            const baseUserPrompt = `${identityAnchor}\n${characterCard ? `\n【角色卡/角色设定】\n${characterCard}\n` : ''}${presetAnchor ? `\n${presetAnchor}\n` : ''}${regexAnchor ? `\n${regexAnchor}\n` : ''}${worldBookAnchor ? `\n${worldBookAnchor}\n` : ''}${memoryAnchor ? `\n${memoryAnchor}\n` : ''}${livingWorldStatus ? `\n${livingWorldStatus}\n` : ''}\n【最近聊天上下文】\n${buildWechatRecentHistoryForPrompt(char, 12)}\n${momentsAnchor ? `\n${momentsAnchor}` : ''}${previousStatus ? `\n【上一轮状态】\n${previousStatus}` : ''}`;
            let lastRawStatus = '';
            let lastMissingKeys = [];
            let rateLimitRetried = false;
            for (let attempt = 0; attempt < 2 && !snapshot; attempt += 1) {
                // A repair request right after the first one trips per-minute relay limits.
                if (attempt && typeof waitForChatApiQuietGap === 'function') await waitForChatApiQuietGap();
                const retryRule = attempt
                    ? `\n【强制重写】上一次状态快照不可用${lastMissingKeys.length ? `，缺少或无效字段：${lastMissingKeys.join(', ')}` : ''}。现在必须重新输出完整 JSON，不要只输出 patch，不要解释原因。八个字段每一项都必须有当前状态内容。`
                    : '';
                const rejectedSample = lastRawStatus
                    ? `\n【上一次不可用输出，仅用于纠错，禁止照抄】\n${stripWechatPromptText(lastRawStatus, 1200)}`
                    : '';
                const result = await callChatApi([
                    {
                        role: 'system',
                        content: `${baseSystemPrompt}\n${timeAnchor}${retryRule}`
                    },
                    {
                        role: 'user',
                        content: `${baseUserPrompt}${rejectedSample}`
                    }
                ], {
                    usageFeature: 'status',
                    usageChar: char,
                    max_tokens: 2200 + attempt * 400,
                    temperature: attempt ? 0.52 : 0.45,
                    skipLengthContinuation: true,
                    skipEmptyLengthRetry: true,
                    skipStatusValidationRetry: true,
                    background: isBackgroundStatusRequest,
                    backgroundPriority: isBackgroundStatusRequest ? 10 : 0
                });
                if (result && result.ok) {
                    lastRawStatus = result.content || '';
                    snapshot = normalizeWechatAiStatusSnapshot(parseWechatJsonObject(lastRawStatus), char, options.reason || 'api');
                    if (!snapshot) {
                        lastMissingKeys = normalizeWechatAiStatusSnapshot.lastMissingKeys || [];
                        const truncated = /length|max_tokens/i.test(String(result.finishReason || ''));
                        const missingLabels = lastMissingKeys
                            .map(key => (WECHAT_AI_STATUS_FIELDS.find(item => item.key === key) || {}).label || key)
                            .join('、');
                        errorText = truncated
                            ? '状态 JSON 不完整（输出被截断）'
                            : `状态 JSON 不完整${missingLabels ? `（缺少：${missingLabels}）` : ''}`;
                    }
                    continue;
                }
                // A bare 429 (no Retry-After) usually means "too soon": wait once and retry; an explicit Retry-After pause is honoured instead.
                if (result && result.rateLimited && !(Number(result.retryAfterMs) > 0) && !rateLimitRetried) {
                    rateLimitRetried = true;
                    await new Promise(resolve => setTimeout(resolve, 15000));
                    attempt -= 1;
                    continue;
                }
                errorText = (result && result.error) || 'API 状态生成失败';
                // Only incomplete successful responses need a repair request.
                break;
            }
        } catch (e) {
            console.warn('request ai status failed:', e);
            errorText = String(e && e.message || 'API 状态生成失败');
        }

        if (snapshot) {
            char.chatConfig.aiStatusSnapshot = snapshot;
            char.chatConfig.aiStatusError = '';
            char.chatConfig.aiStatusHistory = Array.isArray(char.chatConfig.aiStatusHistory) ? char.chatConfig.aiStatusHistory : [];
            char.chatConfig.aiStatusHistory.unshift(snapshot);
            char.chatConfig.aiStatusHistory = char.chatConfig.aiStatusHistory.slice(0, 20);
        } else if (errorText) {
            char.chatConfig.aiStatusError = errorText;
        }
        saveCharactersToStorage();
        if (window._wechatAiStatusOpenCharId === char.id) renderWechatAiStatusTicket(char);
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
        if (window.currentChatCharId === char.id) syncWechatCoupleThemeHeader(char);
        return snapshot;
    });

    window._wechatAiStatusGenerating.set(char.id, promise);
    if (window._wechatAiStatusOpenCharId === char.id) renderWechatAiStatusTicket(char);
    try {
        return await promise;
    } finally {
        window._wechatAiStatusGenerating.delete(char.id);
        if (window._wechatAiStatusOpenCharId === char.id) renderWechatAiStatusTicket(char);
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
        if (window.currentChatCharId === char.id) syncWechatCoupleThemeHeader(char);
    }
}

function ensureWechatAiStatusOverlay() {
    let modal = document.getElementById('wc-ai-status-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-ai-status-overlay';
        modal.className = 'wc-ai-status-overlay';
        modal.setAttribute('onclick', 'if(event.target===this) closeWechatAiStatusTicket()');
        getWechatModalRoot().appendChild(modal);
    }
    return modal;
}

function openWechatAiStatusTicket(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    window._wechatAiStatusOpenCharId = charId;
    ensureWechatAiStatusOverlay();
    renderWechatAiStatusTicket(char);
}

function renderWechatAiStatusTicket(char) {
    const modal = document.getElementById('wc-ai-status-overlay');
    if (!modal || !char) return;
    const snapshot = getWechatAiStatusSnapshot(char);
    const charName = getWechatCharDisplayName(char);
    const generating = !!(window._wechatAiStatusGenerating && window._wechatAiStatusGenerating.has(char.id));
    const errorText = String(char.chatConfig && char.chatConfig.aiStatusError || '').trim();
    const statusTime = formatWechatSnapshotTime(snapshot && snapshot.updatedAt);
    const sourceLabel = snapshot ? 'API RECEIPT' : (generating ? 'GENERATING' : (errorText ? 'SYNC ERROR' : 'STATUS READY'));
    const fieldsHtml = WECHAT_AI_STATUS_FIELDS.map((item, index) => {
        const value = snapshot
            ? getWechatStatusFieldDisplay(snapshot, item)
            : (generating ? '正在生成中' : (errorText ? '状态暂时没有更新，请稍后刷新。' : '角色回复后会自动生成状态快照。'));
        return `
        <div class="wc-ai-status-row">
            <div class="wc-ai-status-item-head">
                <b>#${String(index + 1).padStart(2, '0')}</b>
                <span>${wcEscapeHtml(item.label)}</span>
                <i></i>
                <em>${wcEscapeHtml(item.key)}</em>
            </div>
            <p>${wcEscapeHtml(value)}</p>
        </div>
    `;
    }).join('');
    const safeMiniDiary = snapshot && snapshot.fields ? sanitizeWechatAiStatusFieldValue(snapshot.fields.miniDiary, 'miniDiary') : '';
    const guestbookText = safeMiniDiary || (generating ? '正在生成中' : '状态生成后，这里会显示角色此刻想说的话。');
    modal.innerHTML = `
        <div class="wc-ai-status-ticket">
            <div class="wc-ai-status-top">
                <button type="button" onclick="closeWechatAiStatusTicket()" aria-label="关闭"><i class="ri-close-line"></i></button>
                <div>
                    <strong>${wcEscapeHtml(charName)}</strong>
                    <span>${wcEscapeHtml(sourceLabel)}</span>
                </div>
                <button type="button" onclick="openWechatAiStatusHistory(${quoteWechatJsString(char.id)})" aria-label="历史记录"><i class="ri-history-line"></i></button>
            </div>
            <div class="wc-ai-status-brand">
                <div class="wc-ai-status-logo"><i class="ri-cup-line"></i><span>STATUS</span></div>
                <h3>${wcEscapeHtml(charName)}</h3>
                <p>CHARACTER RECEIPT</p>
            </div>
            <div class="wc-ai-status-meta">
                <span>DATE</span><b>${wcEscapeHtml(statusTime)}</b>
                <span>SERIAL NUMBER</span><b>${wcEscapeHtml(getWechatStatusSerial(char))}</b>
            </div>
            <div class="wc-ai-status-sync">
                ${errorText && !generating ? `<p role="status">${wcEscapeHtml(errorText)}</p>` : ''}
                <button type="button" onclick="refreshWechatAiStatusTicket(${quoteWechatJsString(char.id)})" ${generating ? 'disabled' : ''}>
                    <i class="ri-refresh-line"></i><span>${generating ? '正在生成状态…' : '刷新状态'}</span>
                </button>
            </div>
            <div class="wc-ai-status-bar">ITEM</div>
            <div class="wc-ai-status-fields">${fieldsHtml}</div>
            <div class="wc-ai-status-footer">
                <div><span>TOTAL</span><b>${WECHAT_AI_STATUS_FIELDS.length}</b></div>
                <div><span>AMOUNT</span><b>$0.00</b></div>
            </div>
            <div class="wc-ai-status-guestbook">
                <span>GUESTBOOK</span>
                <p>${wcEscapeHtml(guestbookText)}</p>
                <b>MESSAGE DATE: ${wcEscapeHtml(statusTime)}</b>
            </div>
            <div class="wc-ai-status-goodday">BEYOND THE SCREEN</div>
        </div>
    `;
}

function getWechatAiStatusHistory(char) {
    if (!char || !char.chatConfig) return [];
    const list = [];
    const seen = new Set();
    const pushSnapshot = snapshot => {
        if (!isWechatAiStatusSnapshotComplete(snapshot)) return;
        const key = `${snapshot.updatedAt || ''}_${snapshot.reason || ''}_${JSON.stringify(snapshot.fields)}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push(snapshot);
    };
    pushSnapshot(char.chatConfig.aiStatusSnapshot);
    (Array.isArray(char.chatConfig.aiStatusHistory) ? char.chatConfig.aiStatusHistory : []).forEach(pushSnapshot);
    return list.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 30);
}

function renderWechatAiStatusHistoryFields(snapshot) {
    const fields = snapshot && snapshot.fields ? snapshot.fields : {};
    return WECHAT_AI_STATUS_FIELDS.map((item, index) => {
        const value = sanitizeWechatAiStatusFieldValue(fields[item.key], item.key);
        return `
            <div class="wc-ai-history-field">
                <b>#${String(index + 1).padStart(2, '0')} ${wcEscapeHtml(item.label)}</b>
                <p>${wcEscapeHtml(value)}</p>
            </div>
        `;
    }).join('');
}

function openWechatAiStatusHistory(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const modal = document.getElementById('wc-ai-status-overlay');
    if (!char || !modal) return;
    const history = getWechatAiStatusHistory(char);
    const charName = getWechatCharDisplayName(char);
    const historyHtml = history.length ? history.map((snapshot, index) => `
        <details class="wc-ai-history-item" ${index === 0 ? 'open' : ''}>
            <summary>
                <span>${index === 0 ? 'CURRENT' : `HISTORY ${String(index).padStart(2, '0')}`}</span>
                <b>${wcEscapeHtml(formatWechatSnapshotTime(snapshot.updatedAt))}</b>
                <em>${wcEscapeHtml(snapshot.reason || snapshot.generatedBy || 'status')}</em>
            </summary>
            <div class="wc-ai-history-fields">
                ${renderWechatAiStatusHistoryFields(snapshot)}
            </div>
        </details>
    `).join('') : `
        <div class="wc-ai-history-empty">
            <i class="ri-history-line"></i>
            <span>还没有状态历史</span>
            <p>AI 状态生成后会自动保存到这里。</p>
        </div>
    `;
    modal.innerHTML = `
        <div class="wc-ai-status-ticket wc-ai-status-history">
            <div class="wc-ai-status-top">
                <button type="button" onclick="backWechatAiStatusTicket(${quoteWechatJsString(char.id)})" aria-label="返回状态"><i class="ri-arrow-left-s-line"></i></button>
                <div>
                    <strong>${wcEscapeHtml(charName)}</strong>
                    <span>STATUS HISTORY · ${history.length}</span>
                </div>
                <button type="button" onclick="closeWechatAiStatusTicket()" aria-label="关闭"><i class="ri-close-line"></i></button>
            </div>
            <div class="wc-ai-status-brand">
                <div class="wc-ai-status-logo"><i class="ri-history-line"></i><span>HISTORY</span></div>
                <h3>${wcEscapeHtml(charName)}</h3>
                <p>ATTRIBUTE ARCHIVE</p>
            </div>
            <div class="wc-ai-status-bar">RECORDS</div>
            <div class="wc-ai-history-list">${historyHtml}</div>
            <div class="wc-ai-status-goodday">BEYOND THE SCREEN</div>
        </div>
    `;
}

function backWechatAiStatusTicket(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (char) renderWechatAiStatusTicket(char);
}

function refreshWechatAiStatusTicket(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    renderWechatAiStatusTicket(char);
    requestWechatAiStatusSnapshot(char, { reason: 'manual_refresh', force: true })
        .then(snapshot => {
            if (window._wechatAiStatusOpenCharId !== charId) return;
            ensureWechatAiStatusOverlay();
            renderWechatAiStatusTicket(char);
        })
        .catch(e => console.warn('manual status refresh failed:', e));
}

function closeWechatAiStatusTicket() {
    const modal = document.getElementById('wc-ai-status-overlay');
    if (modal) modal.remove();
    window._wechatAiStatusOpenCharId = '';
}

function normalizeWechatTextList(value, fallback = []) {
    if (Array.isArray(value)) return value.map(item => stripWechatPromptText(item, 120)).filter(Boolean).slice(0, 6);
    if (typeof value === 'string' && value.trim()) return value.split(/\n+/).map(item => stripWechatPromptText(item, 120)).filter(Boolean).slice(0, 6);
    return fallback;
}

