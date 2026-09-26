// --- 💬 聊天设置面板 ---

const USER_PROFILE_KEY = 'my_user_profile';
const WECHAT_USER_PERSONA_LIBRARY_KEY = 'wechat_user_persona_library_v1';

function getUserProfile() {
    try {
        const raw = localStorage.getItem(USER_PROFILE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { avatar: '', name: '我', bio: '', signature: '', wechatId: '' };
}

function saveUserProfile(profile) {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
}

function getWechatChatUserProfile(char) {
    const globalProfile = getUserProfile();
    const scoped = char && char.chatConfig && char.chatConfig.userProfile;
    return {
        avatar: scoped?.avatar || globalProfile.avatar || '',
        name: scoped?.name || globalProfile.name || '我',
        bio: scoped?.bio || '',
        signature: scoped?.signature || '',
        personaId: scoped?.personaId || '',
        wechatId: globalProfile.wechatId || '',
        momentCover: globalProfile.momentCover || ''
    };
}

function saveWechatChatUserProfile(char, profile) {
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.userProfile = {
        avatar: profile.avatar || '',
        name: profile.name || '我',
        bio: profile.bio || '',
        signature: profile.signature || '',
        personaId: profile.personaId || ''
    };
}

function getWechatUserPersonaLibrary() {
    try {
        const raw = localStorage.getItem(WECHAT_USER_PERSONA_LIBRARY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function saveWechatUserPersonaLibrary(list) {
    localStorage.setItem(WECHAT_USER_PERSONA_LIBRARY_KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, 30) : []));
}

function renderWechatUserPersonaLibrary(activeId = '') {
    const list = document.getElementById('wcs-user-persona-list');
    if (!list) return;
    const personas = getWechatUserPersonaLibrary();
    list.innerHTML = personas.length ? personas.map(item => `
        <button type="button" class="${item.id === activeId ? 'active' : ''}" onclick="applyWechatUserPersona(${quoteWechatJsString(item.id)})">
            <strong>${wcEscapeHtml(item.title || item.name || '未命名人设')}${item.builtinId ? '<em class="wcs-persona-tag">内置</em>' : ''}</strong>
            <span>${wcEscapeHtml((item.bio || item.signature || '').slice(0, 42) || '点击套用到当前聊天')}</span>
        </button>
    `).join('') : '<div class="wcs-persona-empty">还没有保存过 user 人设</div>';
}

function saveCurrentWechatUserPersona() {
    const name = (document.getElementById('wcs-user-name')?.value || '我').trim() || '我';
    const bio = (document.getElementById('wcs-user-bio')?.value || '').trim();
    const signature = (document.getElementById('wcs-user-signature')?.value || '').trim();
    if (!bio && !signature) {
        showWechatToast('先写个人简介或个性签名');
        return;
    }
    const personas = getWechatUserPersonaLibrary();
    const item = {
        id: 'persona_' + Date.now(),
        name,
        bio,
        signature,
        updatedAt: Date.now()
    };
    personas.unshift(item);
    saveWechatUserPersonaLibrary(personas);
    const char = getCurrentChatChar();
    if (char) {
        char.chatConfig = char.chatConfig || {};
        char.chatConfig.userProfile = {
            ...(char.chatConfig.userProfile || {}),
            name,
            bio,
            signature,
            personaId: item.id
        };
        saveCharactersToStorage();
    }
    renderWechatUserPersonaLibrary(item.id);
    showWechatToast('已保存到人设库');
}

function applyWechatUserPersona(personaId) {
    const item = getWechatUserPersonaLibrary().find(persona => persona.id === personaId);
    if (!item) return;
    const nameEl = document.getElementById('wcs-user-name');
    const bioEl = document.getElementById('wcs-user-bio');
    const signatureEl = document.getElementById('wcs-user-signature');
    if (nameEl && item.name) nameEl.value = item.name;
    if (bioEl) bioEl.value = item.bio || '';
    if (signatureEl) signatureEl.value = item.signature || '';
    const char = getCurrentChatChar();
    if (char) {
        char.chatConfig = char.chatConfig || {};
        char.chatConfig.userProfile = {
            ...(char.chatConfig.userProfile || {}),
            name: item.name || char.chatConfig.userProfile?.name || getUserProfile().name || '我',
            bio: item.bio || '',
            signature: item.signature || '',
            personaId
        };
        saveCharactersToStorage();
    }
    renderWechatUserPersonaLibrary(personaId);
    showWechatToast('已套用到当前聊天');
}

// CSS 气泡预览（实时）

function scopeWechatChatCustomCss(cssText) {
    const raw = String(cssText || '').trim();
    if (!raw) return '';
    const scope = '#app-wechat-window #wechat-chat-room';
    const scopedCss = raw.replace(/(^|})(\s*)([^@{}][^{}]*)\{/g, (match, closeBrace, space, selectorText) => {
        const scoped = selectorText.split(',').map(selector => {
            const trimmed = selector.trim();
            if (!trimmed) return '';
            if (trimmed.startsWith(scope) || trimmed.startsWith('#wechat-chat-room') || trimmed.startsWith('#app-wechat-window')) {
                return trimmed;
            }
            return `${scope} ${trimmed}`;
        }).filter(Boolean).join(', ');
        return `${closeBrace}${space}${scoped} {`;
    });
    return `${scopedCss}
${scope} .msg-bubble.sticker {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    min-width: 0 !important;
    border-radius: 0 !important;
}`;
}

function previewBubbleCss(cssText) {
    // 移除旧的预览样式
    let previewStyle = document.getElementById('wcs-css-preview-style');
    if (!previewStyle) {
        previewStyle = document.createElement('style');
        previewStyle.id = 'wcs-css-preview-style';
        document.head.appendChild(previewStyle);
    }
    // 预览里区分左右气泡，避免角色预览被 .wcs-preview-bubble.ai 默认色覆盖。
    let previewCss = cssText
        .replace(/\.msg-bubble\.green/g, '.wcs-preview-bubble.user')
        .replace(/\.msg-bubble/g, '.wcs-preview-bubble.ai');
    previewStyle.textContent = previewCss;
}

function setWechatTimeModeControls(mode) {
    const safeMode = mode === 'virtual' ? 'virtual' : 'real';
    document.getElementById('wcs-time-real')?.classList.toggle('active', safeMode === 'real');
    document.getElementById('wcs-time-virtual')?.classList.toggle('active', safeMode === 'virtual');
    document.getElementById('wcs-time-virtual-row')?.classList.toggle('hidden', safeMode !== 'virtual');
    refreshWechatTimePreview();
}

function getWechatSettingsTimeMode() {
    return document.getElementById('wcs-time-virtual')?.classList.contains('active') ? 'virtual' : 'real';
}

function toggleWechatTimeMode(mode) {
    const safeMode = mode === 'virtual' ? 'virtual' : 'real';
    const virtualInput = document.getElementById('wcs-virtual-time');
    if (safeMode === 'virtual' && virtualInput && !virtualInput.value) {
        virtualInput.value = toWechatDatetimeLocalValue(new Date());
    }
    setWechatTimeModeControls(safeMode);
}

function refreshWechatTimePreview() {
    const preview = document.getElementById('wcs-time-preview');
    if (!preview) return;
    const mode = getWechatSettingsTimeMode();
    const value = document.getElementById('wcs-virtual-time')?.value;
    preview.textContent = mode === 'virtual'
        ? `AI 会认为现在是：${formatWechatDateTimeForPrompt(value || new Date())}`
        : `AI 会跟随真实时间：${formatWechatDateTimeForPrompt(new Date())}`;
}

function setWechatVirtualTimeNow() {
    const input = document.getElementById('wcs-virtual-time');
    if (input) input.value = toWechatDatetimeLocalValue(new Date());
    setWechatTimeModeControls('virtual');
}

function renderWechatMomentCoverGallery(char) {
    const gallery = document.getElementById('wcs-moment-cover-list');
    if (!gallery || !char) return;
    const covers = ((char.chatConfig && char.chatConfig.momentCovers) || []).filter(Boolean);
    gallery.innerHTML = covers.length ? covers.map((url, index) => `
        <div class="wcs-cover-thumb">
            <img src="${url}" onerror="this.style.opacity='0.35'">
            <button type="button" onclick="removeWechatMomentCover(${index})"><i class="ri-close-line"></i></button>
        </div>
    `).join('') : '<span class="wcs-cover-empty">还没有背景图</span>';
}

function addWechatMomentCovers(input) {
    const char = getCurrentChatChar();
    if (!char || !input.files || !input.files.length) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.momentCovers = Array.isArray(char.chatConfig.momentCovers) ? char.chatConfig.momentCovers : [];
    const files = Array.from(input.files).slice(0, 8);
    let pending = files.length;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxW = 720;
                const scale = Math.min(maxW / img.width, 1);
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                char.chatConfig.momentCovers.push(canvas.toDataURL('image/jpeg', 0.72));
                pending -= 1;
                if (pending === 0) {
                    saveCharactersToStorage();
                    renderWechatMomentCoverGallery(char);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function removeWechatMomentCover(index) {
    const char = getCurrentChatChar();
    if (!char || !char.chatConfig || !Array.isArray(char.chatConfig.momentCovers)) return;
    char.chatConfig.momentCovers.splice(index, 1);
    saveCharactersToStorage();
    renderWechatMomentCoverGallery(char);
}

function renderWechatAiMomentsEditor(char) {
    const list = document.getElementById('wcs-ai-moment-list');
    if (!list || !char) return;
    const moments = getWechatCharMomentPosts(char);
    list.innerHTML = moments.length ? moments.slice().reverse().map(item => `
        <div class="wcs-ai-moment-item">
            <span>${wcEscapeHtml(item.text || '')}</span>
            <button type="button" onclick="deleteWechatAiMoment(${quoteWechatJsString(item.id)})"><i class="ri-close-line"></i></button>
        </div>
    `).join('') : '<div class="wcs-ai-moment-empty">还没有自定义动态</div>';
}

function addWechatAiMomentFromSettings() {
    const char = getCurrentChatChar();
    const input = document.getElementById('wcs-ai-moment-text');
    const text = (input && input.value || '').trim();
    if (!char || !text) return;
    getWechatCharMomentPosts(char);
    const store = getWechatMomentStore();
    store.posts.push(buildWechatCharMomentPost(char, text, 'manual_moment'));
    saveWechatMomentStore(store);
    if (input) input.value = '';
    renderWechatAiMomentsEditor(char);
    if (isWechatMomentsScreenOpen()) renderWechatMoments();
}

async function generateWechatAiMoment() {
    const char = getCurrentChatChar();
    const input = document.getElementById('wcs-ai-moment-text');
    if (!char || !input) return;
    input.value = 'AI 正在写朋友圈...';
    char.chatConfig = char.chatConfig || {};
    const coverHint = Array.isArray(char.chatConfig.momentCovers) && char.chatConfig.momentCovers.length
        ? `用户已为你设置 ${char.chatConfig.momentCovers.length} 张朋友圈封面，你能看到并知道这是你的朋友圈背景。`
        : '用户还没有为你设置朋友圈封面。';
    const result = await callChatApi([
        { role: 'system', content: `你是「${char.name}」。请以你自己的口吻写一条微信朋友圈动态，28字以内，像真实朋友圈，不要解释。${coverHint}` },
        { role: 'user', content: `角色设定：\n${String(char.description || '').slice(0, 4000)}\n\n写一条你现在会发的朋友圈。` }
    ], { usageFeature: 'moment', usageChar: char });
    input.value = result.ok
        ? String(result.content || '').replace(/\|\|\|/g, ' ').replace(/<[^>]+>/g, '').replace(/["“”]/g, '').trim().slice(0, 80)
        : '';
}

function deleteWechatAiMoment(id) {
    const char = getCurrentChatChar();
    if (!char) return;
    const store = getWechatMomentStore();
    store.posts = store.posts.filter(post => !(post.id === id && post.charId === char.id));
    saveWechatMomentStore(store);
    if (Array.isArray(char.chatConfig?.aiMoments)) {
        char.chatConfig.aiMoments = char.chatConfig.aiMoments.filter(item => item.id !== id);
        saveCharactersToStorage();
    }
    renderWechatAiMomentsEditor(char);
    if (isWechatMomentsScreenOpen()) renderWechatMoments();
}

async function generateWechatSignature() {
    const char = getCurrentChatChar();
    const input = document.getElementById('wcs-char-signature');
    if (!char || !input) return;
    const oldValue = input.value;
    input.value = '正在生成...';
    const result = await callChatApi([
        { role: 'system', content: `你是「${char.name}」。给自己的微信资料写一句自然的个性签名，16字以内。只输出签名，不要解释。` },
        { role: 'user', content: '写一句你的微信个性签名。' }
    ], { usageFeature: 'other', usageChar: char });
    input.value = result.ok
        ? String(result.content || '').replace(/\|\|\|/g, ' ').replace(/["“”]/g, '').trim().slice(0, 32)
        : oldValue;
}

function setWechatMonitorModeOption(mode) {
    const safe = mode === 'observer' ? 'observer' : 'persona';
    const input = document.getElementById('wcs-monitor-mode');
    if (input) input.value = safe;
    document.querySelectorAll('#wcs-monitor-mode-options button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === safe);
    });
}
window.setWechatMonitorModeOption = setWechatMonitorModeOption;

function normalizeWechatMonitorBarrageSpeed(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 1;
    return Math.min(1.6, Math.max(0.7, Math.round(num * 10) / 10));
}

function getWechatMonitorBarrageSpeed(char) {
    return normalizeWechatMonitorBarrageSpeed(char && char.chatConfig && char.chatConfig.monitorBarrageSpeed);
}

function getWechatMonitorSpeedText(value) {
    const speed = normalizeWechatMonitorBarrageSpeed(value);
    if (speed >= 1.35) return '很快';
    if (speed >= 1.1) return '偏快';
    if (speed <= 0.8) return '慢速';
    return '标准';
}

function updateWechatMonitorSpeedLabel(value) {
    const label = document.getElementById('wcs-monitor-barrage-speed-label');
    if (label) label.textContent = getWechatMonitorSpeedText(value);
}
window.updateWechatMonitorSpeedLabel = updateWechatMonitorSpeedLabel;

function getWechatWorldBookEntryId(entry, index) {
    if (!entry) return `wb-${index}`;
    return String(entry.id || entry.uid || entry.name || entry.title || entry.key || entry.keys || entry.keyword || `wb-${index}`);
}

function getWechatPromptWorldBookSelection(char) {
    const config = char && char.chatConfig;
    const stored = config && config.promptWorldBookIds;
    return Array.isArray(stored) ? stored.map(String) : null;
}

function renderWechatPromptWorldBookList(char) {
    const list = document.getElementById('wcs-prompt-worldbook-list');
    if (!list) return;
    const entries = Array.isArray(char && char.worldBook) ? char.worldBook : [];
    const selection = getWechatPromptWorldBookSelection(char);
    if (!entries.length) {
        list.innerHTML = '<div class="wcs-worldbook-empty">这个角色还没有世界书。</div>';
        return;
    }
    list.innerHTML = entries.map((entry, index) => {
        const id = getWechatWorldBookEntryId(entry, index);
        const title = stripWechatPromptText(entry?.name || entry?.title || entry?.key || entry?.keys || entry?.keyword || `世界书 ${index + 1}`, 28);
        const content = stripWechatPromptText(entry?.content || entry?.text || entry?.entry || entry?.value || entry?.comment || entry?.description || '', 64);
        const checked = entry?.enabled !== false && (!selection || selection.includes(id));
        const disabled = entry?.enabled === false ? 'disabled' : '';
        return `
            <label class="wcs-worldbook-item ${disabled}">
                <input type="checkbox" data-worldbook-id="${wcEscapeHtml(id)}" ${checked ? 'checked' : ''} ${disabled}>
                <span><b>${wcEscapeHtml(title)}</b><em>${wcEscapeHtml(content || '无内容预览')}</em></span>
            </label>
        `;
    }).join('');
}

function selectAllWechatPromptWorldBook(checked) {
    document.querySelectorAll('#wcs-prompt-worldbook-list input[type="checkbox"]:not(:disabled)').forEach(input => {
        input.checked = !!checked;
    });
}
window.selectAllWechatPromptWorldBook = selectAllWechatPromptWorldBook;

function openChatSettings() {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    const room = document.getElementById('wechat-chat-room');
    if (room) {
        room.classList.remove('settings-closing');
        room.classList.add('settings-opening');
        room.classList.add('settings-open');
    }

    const config = char.chatConfig || {};
    window._wechatAvatarManageState = null;
    closeWechatAvatarDeleteDialog();
    const profile = getWechatChatUserProfile(char);
    closeWechatQQGroupSettings();
    syncWechatQQGroupSettingsEntry(char);

    // 填充外观设置
    document.getElementById('wcs-bg-img-hint').textContent = config.chatBgImage ? '已设置' : '未设置';
    renderWechatChatBgGallery(char);

    const fontSize = config.fontSize || 15;
    document.getElementById('wcs-font-size').value = fontSize;
    document.getElementById('wcs-font-val').textContent = fontSize + 'px';

    // CSS 编辑器
    const cssEl = document.getElementById('wcs-custom-css');
    if (cssEl) {
        cssEl.value = config.customCss || '';
        previewBubbleCss(config.customCss || '');
        renderBubblePresetDropdown(config.customCss || '');
    }

    // 用户资料（当前聊天独立）
    const userAvatarEl = document.getElementById('wcs-user-avatar');
    if (profile.avatar) userAvatarEl.src = profile.avatar;
    else userAvatarEl.src = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 200 200%27%3E%3Cdefs%3E%3ClinearGradient id=%27bg%27 x1=%270%27 y1=%270%27 x2=%271%27 y2=%271%27%3E%3Cstop offset=%270%25%27 stop-color=%27%23f8c8dc%27/%3E%3Cstop offset=%27100%25%27 stop-color=%27%23d4a5f5%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%27200%27 height=%27200%27 rx=%27100%27 fill=%27url(%23bg)%27/%3E%3Ccircle cx=%27100%27 cy=%2780%27 r=%2735%27 fill=%27%23fff%27 opacity=%270.9%27/%3E%3Cellipse cx=%27100%27 cy=%27155%27 rx=%2750%27 ry=%2735%27 fill=%27%23fff%27 opacity=%270.9%27/%3E%3Ccircle cx=%2788%27 cy=%2775%27 r=%274%27 fill=%27%23555%27/%3E%3Ccircle cx=%27112%27 cy=%2775%27 r=%274%27 fill=%27%23555%27/%3E%3Cpath d=%27M92 90 Q100 98 108 90%27 stroke=%27%23e88%27 stroke-width=%272.5%27 fill=%27none%27 stroke-linecap=%27round%27/%3E%3C/svg%3E';
    document.getElementById('wcs-user-name').value = profile.name || '我';
    document.getElementById('wcs-user-bio').value = profile.bio || '';
    const userSignatureEl = document.getElementById('wcs-user-signature');
    if (userSignatureEl) userSignatureEl.value = profile.signature || '';
    renderWechatUserPersonaLibrary(profile.personaId || '');

    // 角色资料
    document.getElementById('wcs-char-avatar').src = char.avatar || '';
    document.getElementById('wcs-char-name').textContent = char.name;
    const descText = char.description || '';
    document.getElementById('wcs-char-desc').value = descText;
    document.getElementById('wcs-char-bio-preview').textContent = descText ? descText.slice(0, 50) + (descText.length > 50 ? '...' : '') : '无简介';
    updateWechatSettingsImagePreview('wcs-portrait-ref-preview', config.imageReference || '', '未设置参考图');

    // 称呼 & 备注
    document.getElementById('wcs-user-title').value = config.userTitle || '我';
    document.getElementById('wcs-char-nickname').value = config.nickname || '';
    const presenceMode = document.getElementById('wcs-chat-presence-mode');
    if (presenceMode) presenceMode.value = ['online', 'offline'].includes(config.chatPresenceMode) ? config.chatPresenceMode : 'auto';
    const memoryConfig = getWechatMemoryConfig(char);
    const segmentInput = document.getElementById('wcs-memory-segment');
    const longInput = document.getElementById('wcs-memory-long');
    const keepInput = document.getElementById('wcs-memory-keep');
    const extractInput = document.getElementById('wcs-memory-extract');
    if (segmentInput) segmentInput.value = memoryConfig.segmentLimit;
    if (longInput) longInput.value = memoryConfig.longTermLimit;
    if (keepInput) keepInput.value = memoryConfig.keepRecent;
    if (extractInput) extractInput.value = memoryConfig.extractEvery;
    const signatureInput = document.getElementById('wcs-char-signature');
    if (signatureInput) signatureInput.value = config.signature || '';
    const timeMode = config.timeMode === 'virtual' ? 'virtual' : 'real';
    const virtualInput = document.getElementById('wcs-virtual-time');
    if (virtualInput) virtualInput.value = toWechatDatetimeLocalValue(config.virtualTime || new Date());
    setWechatTimeModeControls(timeMode);
    updateWechatSettingsImagePreview('wcs-video-bg-preview', config.videoCallBg || '', '未设置视频通话背景');
    const videoBgHint = document.getElementById('wcs-video-bg-hint');
    if (videoBgHint) videoBgHint.textContent = config.videoCallBg ? '已设置视频通话背景' : '上传视频通话背景';
    const realCamera = document.getElementById('wcs-video-real-camera');
    if (realCamera) realCamera.checked = !!config.videoCallUseCamera;
    const monitorEnabled = document.getElementById('wcs-monitor-enabled');
    if (monitorEnabled) monitorEnabled.checked = !!config.monitorEnabled;
    setWechatMonitorModeOption(getWechatMonitorMode(char));
    const monitorSpeed = document.getElementById('wcs-monitor-barrage-speed');
    if (monitorSpeed) monitorSpeed.value = getWechatMonitorBarrageSpeed(char);
    updateWechatMonitorSpeedLabel(getWechatMonitorBarrageSpeed(char));
    renderWechatPromptWorldBookList(char);
    if (typeof renderWechatAgentSettings === 'function') renderWechatAgentSettings(char);

    // 头像集
    renderWechatCharacterVoiceSettings(char);
    renderAvatarGallery(char);
    renderWechatMomentCoverGallery(char);
    renderWechatAiMomentsEditor(char);

    // 婊戝叆
    const panel = document.getElementById('wc-chat-settings-panel');
    if (panel) {
        panel.style.display = 'flex';
        panel.classList.remove('active');
        requestAnimationFrame(() => {
            panel.classList.add('active');
            requestAnimationFrame(() => {
                if (room) room.classList.remove('settings-opening');
            });
        });
    }
}

function closeChatSettings(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    window._wechatAvatarManageState = null;
    closeWechatAvatarDeleteDialog();
    const panel = document.getElementById('wc-chat-settings-panel');
    closeWechatQQGroupSettings();
    const room = document.getElementById('wechat-chat-room');
    const revealChatChromeBehindPanel = () => {
        if (!room) return;
        room.classList.remove('settings-opening', 'settings-open');
        room.classList.add('settings-closing');
    };
    const finishChatChromeRestore = () => {
        if (room) room.classList.remove('settings-opening', 'settings-open', 'settings-closing');
    };
    if (panel && panel.classList.contains('active')) {
        revealChatChromeBehindPanel();
        panel.classList.remove('active');
        setTimeout(() => {
            if (!panel.classList.contains('active')) {
                panel.style.display = 'none';
                requestAnimationFrame(() => finishChatChromeRestore());
            }
        }, 300);
    } else {
        if (panel) panel.style.display = 'none';
        finishChatChromeRestore();
    }

    if (room && window.currentChatCharId) {
        room.classList.remove('hidden');
        room.classList.add('active');
    }
}

