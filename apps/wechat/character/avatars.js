// --- 角色头像集 ---
function renderWechatCharacterVoiceSettings(char) {
    const providerEl = document.getElementById('wcs-char-voice-provider');
    const modelEl = document.getElementById('wcs-char-voice-model');
    const voiceEl = document.getElementById('wcs-char-voice-id');
    if (!providerEl || !modelEl || !voiceEl) return;
    const binding = normalizeWechatCharacterVoiceBinding(char?.chatConfig?.voiceBinding);
    providerEl.value = binding?.provider || '';
    modelEl.value = binding?.voiceModel || '';
    voiceEl.value = binding?.voiceId || '';
    updateWechatCharacterVoiceHint();
}

function getWechatVoiceProviderLabel(provider) {
    return ({
        minimax: 'MiniMax',
        openai: 'OpenAI TTS',
        'fish-audio': 'Fish Audio',
        elevenlabs: 'ElevenLabs',
        local: '本地 TTS 接口'
    })[provider] || '';
}

function updateWechatCharacterVoiceHint() {
    const provider = document.getElementById('wcs-char-voice-provider')?.value || '';
    const fields = document.getElementById('wcs-char-voice-fields');
    const hint = document.getElementById('wcs-char-voice-hint');
    if (fields) fields.classList.toggle('is-disabled', !provider);
    if (!hint) return;
    hint.textContent = provider
        ? `将使用设置 → TTS 中的 ${getWechatVoiceProviderLabel(provider)} 密钥和接口。角色卡只保存这里的模型与音色 ID，不保存密钥。`
        : '未绑定付费音色。学习 App 会改用系统语音；聊天页不会用系统语音代替角色。';
}

function handleWechatCharacterVoiceProviderChange() {
    const provider = document.getElementById('wcs-char-voice-provider')?.value || '';
    const modelEl = document.getElementById('wcs-char-voice-model');
    const voiceEl = document.getElementById('wcs-char-voice-id');
    if (provider && typeof getVoiceApiByProvider === 'function') {
        const saved = getVoiceApiByProvider(provider);
        if (modelEl && !modelEl.value.trim()) modelEl.value = saved?.voiceModel || saved?.model || '';
        if (voiceEl && !voiceEl.value.trim()) voiceEl.value = saved?.voiceId || saved?.voice || '';
    }
    updateWechatCharacterVoiceHint();
}
window.handleWechatCharacterVoiceProviderChange = handleWechatCharacterVoiceProviderChange;

function getWechatAvatarManagementState(char) {
    const state = window._wechatAvatarManageState;
    if (!state || !char || state.charId !== char.id || !(state.selected instanceof Set)) return null;
    return state;
}

function renderWechatAvatarManagementControls(char) {
    const state = getWechatAvatarManagementState(char);
    const managing = !!state;
    const count = state?.selected.size || 0;
    document.getElementById('wcs-avatar-add-btn')?.classList.toggle('hidden', managing);
    document.getElementById('wcs-avatar-manage-btn')?.classList.toggle('hidden', managing);
    document.getElementById('wcs-avatar-cancel-btn')?.classList.toggle('hidden', !managing);
    const removeButton = document.getElementById('wcs-avatar-delete-selected-btn');
    if (removeButton) {
        removeButton.classList.toggle('hidden', !managing);
        removeButton.disabled = count === 0;
        removeButton.textContent = count ? `删除 (${count})` : '删除';
    }
}

function renderAvatarGallery(char) {
    const gallery = document.getElementById('wcs-avatar-gallery');
    if (!gallery) return;
    const avatars = Array.from(new Set((Array.isArray(char.avatarGallery) ? char.avatarGallery : []).filter(Boolean)));
    if (char.avatar && !avatars.includes(char.avatar)) avatars.unshift(char.avatar);
    char.avatarGallery = avatars;
    const manageState = getWechatAvatarManagementState(char);
    const managing = !!manageState;
    if (manageState) {
        manageState.selected = new Set(Array.from(manageState.selected).filter(url => avatars.includes(url)));
    }
    gallery.classList.toggle('is-managing', managing);
    const moods = char.avatarMoods && typeof char.avatarMoods === 'object' ? char.avatarMoods : {};
    gallery.innerHTML = avatars.map((url, i) => `
        <div class="wcs-avatar-gallery-cell">
        <div class="wcs-avatar-gallery-tile ${manageState?.selected.has(url) ? 'selected' : ''}" role="button" tabindex="0"
             aria-label="${managing ? '选择头像' : '切换头像'} ${i + 1}" aria-selected="${manageState?.selected.has(url) ? 'true' : 'false'}"
             onclick="handleWechatAvatarGalleryTap(${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();handleWechatAvatarGalleryTap(${i})}">
            <img class="wcs-avatar-gallery-item ${url === char.avatar ? 'active' : ''}"
                 src="${wcEscapeAttr(url)}" alt="角色头像 ${i + 1}">
            ${managing ? `<span class="wcs-avatar-selection-mark"><i class="ri-check-line"></i></span>` : ''}
        </div>
        ${managing ? '' : `<button type="button" class="wcs-avatar-mood ${moods[url] ? 'has-mood' : ''}" onclick="editWechatAvatarMood(${i})" aria-label="设置头像 ${i + 1} 的心情">${wcEscapeAttr(moods[url] || '＋心情')}</button>`}
        </div>
    `).join('') || '<span style="font-size:12px;color:#bbb;">暂无头像</span>';
    renderWechatAvatarManagementControls(char);
}

// The model never sees the images, so a short mood label per avatar is what lets it pick one by feeling.
function editWechatAvatarMood(idx) {
    const char = getCurrentChatChar();
    const url = char?.avatarGallery?.[idx];
    if (!url) return;
    const moods = char.avatarMoods && typeof char.avatarMoods === 'object' ? char.avatarMoods : {};
    const value = prompt('这个头像适合什么心情或状态？（如：开心、生气、吃醋、害羞；留空清除）', moods[url] || '');
    if (value === null) return;
    const label = value.trim().slice(0, 12);
    if (label) moods[url] = label;
    else delete moods[url];
    Object.keys(moods).forEach(key => { if (!char.avatarGallery.includes(key)) delete moods[key]; });
    char.avatarMoods = moods;
    saveCharactersToStorage();
    renderAvatarGallery(char);
}

function loadWechatAvatarForVision(src, size = 192) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, size / Math.max(img.naturalWidth || size, img.naturalHeight || size));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round((img.naturalWidth || size) * scale));
                canvas.height = Math.max(1, Math.round((img.naturalHeight || size) * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.82));
            } catch (_) {
                resolve(/^(?:data:image\/|https?:\/\/)/i.test(src) ? src : '');
            }
        };
        img.onerror = () => resolve('');
        img.src = window.ByndBuiltinArtwork?.[src] || src;
    });
}

function parseWechatAvatarMoodLabels(text, count) {
    const parsed = parseWechatJsonObject(text);
    const list = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed?.moods) ? parsed.moods
        : Array.isArray(parsed?.labels) ? parsed.labels
        : parsed && typeof parsed === 'object' ? Array.from({ length: count }, (_, i) => parsed[i + 1] ?? parsed[String(i + 1)])
        : [];
    return Array.from({ length: count }, (_, i) => {
        const item = list[i];
        const value = item && typeof item === 'object' ? (item.mood || item.label || '') : item;
        return String(value || '').replace(/[\s"'“”「」【】\[\]]/g, '').slice(0, 12);
    });
}

// One vision request labels every avatar; relays reject bursts, so never one request per image.
async function recognizeWechatAvatarMoods() {
    const char = getCurrentChatChar();
    const gallery = Array.isArray(char?.avatarGallery) ? char.avatarGallery.filter(Boolean) : [];
    if (!char || !gallery.length) return;
    const button = document.getElementById('wcs-avatar-mood-ai-btn');
    if (button?.disabled) return;
    if (button) { button.disabled = true; button.innerHTML = '<i class="ri-loader-4-line"></i>识别中…'; }
    try {
        const known = char.avatarMoods && typeof char.avatarMoods === 'object' ? char.avatarMoods : {};
        // Later presses fill the gaps; once every avatar has a label, a press relabels them all.
        const pending = gallery.some(src => !known[src]) ? gallery.map(src => !known[src]) : gallery.map(() => true);
        const images = await Promise.all(gallery.map((src, index) => pending[index] ? loadWechatAvatarForVision(src) : ''));
        const usable = images.map((url, index) => ({ url, index })).filter(item => item.url);
        if (!usable.length) { showWechatToast('头像图片读取失败'); return; }
        const content = [
            {
                type: 'text',
                text: `下面按顺序是角色「${char.name || '角色'}」的 ${usable.length} 张聊天头像。请逐张观察表情、神态、动作和氛围，给每张写一个具体的心情或状态标签，2-5 个汉字，例如：冷淡、吃醋、炸毛、害羞、得意、委屈、困倦、生闷气、温柔。不同头像尽量用不同标签，不要写“头像”“日常”“正常”这类空泛的词。只返回 JSON 数组，长度必须是 ${usable.length}，按图片顺序，例如 ["冷淡","害羞"]。`
            },
            ...usable.flatMap((item, order) => [
                { type: 'text', text: `第 ${order + 1} 张：` },
                { type: 'image_url', image_url: { url: item.url } }
            ])
        ];
        const result = await callChatApi([{ role: 'user', content }], {
            // Thinking models spend part of the budget before answering; a small cap cut the array after one or two labels.
            max_tokens: 2400,
            temperature: 0.3,
            skipLengthContinuation: true,
            skipStatusValidationRetry: true,
            usageFeature: 'other',
            usageChar: char
        });
        if (!result?.ok) { showWechatToast(result?.error || '识别失败', 3200); return; }
        const labels = parseWechatAvatarMoodLabels(result.content, usable.length);
        if (!labels.some(Boolean)) { showWechatToast('没能读出心情标签，换个支持识图的模型再试', 3200); return; }
        const moods = char.avatarMoods && typeof char.avatarMoods === 'object' ? char.avatarMoods : {};
        usable.forEach((item, order) => { if (labels[order]) moods[gallery[item.index]] = labels[order]; });
        Object.keys(moods).forEach(key => { if (!gallery.includes(key)) delete moods[key]; });
        char.avatarMoods = moods;
        saveCharactersToStorage();
        const filled = labels.filter(Boolean).length;
        showWechatToast(filled < usable.length
            ? `只识别出 ${filled}/${usable.length} 个，再点一次补齐剩下的`
            : `已识别 ${filled} 个头像的心情`, 2600);
    } finally {
        if (button) { button.disabled = false; button.innerHTML = '<i class="ri-sparkling-line"></i>AI 识别心情'; }
        renderAvatarGallery(char);
    }
}

function handleWechatAvatarGalleryTap(idx) {
    const char = getCurrentChatChar();
    if (!char || !Array.isArray(char.avatarGallery) || !char.avatarGallery[idx]) return;
    const state = getWechatAvatarManagementState(char);
    if (!state) {
        selectCharAvatar(idx);
        return;
    }
    const url = char.avatarGallery[idx];
    if (state.selected.has(url)) state.selected.delete(url);
    else state.selected.add(url);
    renderAvatarGallery(char);
}

function beginWechatAvatarManagement() {
    const char = getCurrentChatChar();
    if (!char) return;
    const avatars = Array.isArray(char.avatarGallery) ? char.avatarGallery.filter(Boolean) : [];
    if (!avatars.length) {
        if (typeof showWechatToast === 'function') showWechatToast('还没有可删除的头像');
        return;
    }
    window._wechatAvatarManageState = { charId: char.id, selected: new Set() };
    renderAvatarGallery(char);
}

function cancelWechatAvatarManagement() {
    const char = getCurrentChatChar();
    window._wechatAvatarManageState = null;
    closeWechatAvatarDeleteDialog();
    if (char) renderAvatarGallery(char);
}

function requestDeleteSelectedWechatAvatars() {
    const char = getCurrentChatChar();
    const state = getWechatAvatarManagementState(char);
    if (!char || !state || !state.selected.size) return;
    const selected = char.avatarGallery.filter(url => state.selected.has(url));
    if (!selected.length) return;
    const host = getWechatModalRoot();
    let modal = document.getElementById('wc-avatar-delete-dialog');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-avatar-delete-dialog';
        modal.className = 'wc-modal-overlay wcs-avatar-delete-dialog hidden';
        host.appendChild(modal);
    }
    const preview = selected.slice(0, 4).map(url => `<img src="${wcEscapeAttr(url)}" alt="" onerror="this.style.visibility='hidden'">`).join('');
    modal.innerHTML = `
        <div class="wcs-avatar-delete-sheet" role="dialog" aria-modal="true" aria-labelledby="wcs-avatar-delete-title">
            <div class="wcs-avatar-delete-grabber"></div>
            <div class="wcs-avatar-delete-icon"><i class="ri-delete-bin-6-line"></i></div>
            <h3 id="wcs-avatar-delete-title">删除${selected.length}张头像？</h3>
            <p>${selected.includes(char.avatar) ? '其中包含当前头像，删除后将自动换成剩余头像。' : '删除后无法恢复，角色将不再使用这些头像。'}</p>
            <div class="wcs-avatar-delete-preview">${preview}${selected.length > 4 ? `<span>+${selected.length - 4}</span>` : ''}</div>
            <div class="wcs-avatar-delete-error" id="wcs-avatar-delete-error"></div>
            <div class="wcs-avatar-delete-dialog-actions">
                <button type="button" onclick="closeWechatAvatarDeleteDialog()">取消</button>
                <button type="button" class="danger" id="wcs-avatar-delete-confirm" onclick="confirmDeleteSelectedWechatAvatars()">删除</button>
            </div>
        </div>
    `;
    modal.onclick = event => { if (event.target === modal) closeWechatAvatarDeleteDialog(); };
    modal.classList.remove('hidden');
}

function closeWechatAvatarDeleteDialog() {
    document.getElementById('wc-avatar-delete-dialog')?.classList.add('hidden');
}

async function confirmDeleteSelectedWechatAvatars() {
    const char = getCurrentChatChar();
    const state = getWechatAvatarManagementState(char);
    if (!char || !state || !state.selected.size) return;
    const previousGallery = char.avatarGallery.slice();
    const previousAvatar = char.avatar || '';
    const selected = new Set(state.selected);
    const remaining = char.avatarGallery.filter(url => !selected.has(url));
    const button = document.getElementById('wcs-avatar-delete-confirm');
    const errorEl = document.getElementById('wcs-avatar-delete-error');
    if (button) { button.disabled = true; button.textContent = '正在删除…'; }
    if (errorEl) errorEl.textContent = '';
    char.avatarGallery = remaining;
    if (selected.has(char.avatar)) char.avatar = remaining[0] || '';
    const preview = document.getElementById('wcs-char-avatar');
    if (preview) preview.src = char.avatar || DEFAULT_AVATAR;
    try {
        const saved = await saveCharactersToStorage();
        if (saved === false) throw new Error('角色头像未能保存');
        window._wechatAvatarManageState = null;
        closeWechatAvatarDeleteDialog();
        renderAvatarGallery(char);
        refreshChatView(char);
        renderChatList();
        if (typeof showWechatToast === 'function') showWechatToast(`已删除 ${selected.size} 张头像`);
    } catch (error) {
        char.avatarGallery = previousGallery;
        char.avatar = previousAvatar;
        if (preview) preview.src = char.avatar || DEFAULT_AVATAR;
        renderAvatarGallery(char);
        if (button) { button.disabled = false; button.textContent = '重试删除'; }
        if (errorEl) errorEl.textContent = '保存失败，头像已恢复，请检查存储空间后重试。';
        console.error('角色头像批量删除失败:', error);
    }
}
window.beginWechatAvatarManagement = beginWechatAvatarManagement;
window.cancelWechatAvatarManagement = cancelWechatAvatarManagement;
window.requestDeleteSelectedWechatAvatars = requestDeleteSelectedWechatAvatars;
window.closeWechatAvatarDeleteDialog = closeWechatAvatarDeleteDialog;
window.confirmDeleteSelectedWechatAvatars = confirmDeleteSelectedWechatAvatars;
window.handleWechatAvatarGalleryTap = handleWechatAvatarGalleryTap;

function selectCharAvatar(idx) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    const avatars = char.avatarGallery || [];
    if (char.avatar && !avatars.includes(char.avatar)) avatars.unshift(char.avatar);
    if (avatars[idx]) {
        char.avatar = avatars[idx];
        document.getElementById('wcs-char-avatar').src = avatars[idx];
        saveCharactersToStorage();
        renderAvatarGallery(char);
    }
}

function addCharAvatarToGallery(input) {
    if (!input.files || !input.files[0]) return;
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        openWechatAvatarCropper(e.target.result, compressed => {
            if (!char.avatarGallery) char.avatarGallery = [];
            char.avatarGallery.push(compressed);
            saveCharactersToStorage();
            renderAvatarGallery(char);
        }, { outputSize: 200, quality: 0.7 });
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
}

async function saveChatSettings() {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    // 保存聊天配置到角色
    const prevConfig = char.chatConfig || {};
    const voiceBinding = normalizeWechatCharacterVoiceBinding({
        provider: document.getElementById('wcs-char-voice-provider')?.value || '',
        voiceModel: document.getElementById('wcs-char-voice-model')?.value || '',
        voiceId: document.getElementById('wcs-char-voice-id')?.value || ''
    });
    const promptWorldBookIds = Array.from(document.querySelectorAll('#wcs-prompt-worldbook-list input[type="checkbox"]:checked'))
        .map(input => String(input.dataset.worldbookId || ''))
        .filter(Boolean);
    char.chatConfig = {
        ...prevConfig,
        chatBg: prevConfig.chatBg || '#ededed',
        chatBgImage: window._tempChatBgImage || prevConfig.chatBgImage || '',
        bubbleAi: prevConfig.bubbleAi || '#ffffff',
        bubbleUser: prevConfig.bubbleUser || '#95ec69',
        fontSize: parseInt(document.getElementById('wcs-font-size').value) || 15,
        userTitle: document.getElementById('wcs-user-title').value.trim() || '我',
        nickname: document.getElementById('wcs-char-nickname').value.trim() || '',
        chatPresenceMode: ['online', 'offline'].includes(document.getElementById('wcs-chat-presence-mode')?.value)
            ? document.getElementById('wcs-chat-presence-mode').value
            : 'auto',
        timeMode: getWechatSettingsTimeMode(),
        virtualTime: document.getElementById('wcs-virtual-time')?.value || prevConfig.virtualTime || '',
        memorySegmentLimit: normalizeWechatMemoryNumber(document.getElementById('wcs-memory-segment')?.value, prevConfig.memorySegmentLimit || WECHAT_MEMORY_DEFAULTS.segmentLimit, 3, 50),
        memoryLongTermLimit: normalizeWechatMemoryNumber(document.getElementById('wcs-memory-long')?.value, prevConfig.memoryLongTermLimit || WECHAT_MEMORY_DEFAULTS.longTermLimit, 3, 50),
        memoryKeepRecent: normalizeWechatMemoryNumber(document.getElementById('wcs-memory-keep')?.value, prevConfig.memoryKeepRecent || WECHAT_MEMORY_DEFAULTS.keepRecent, 1, 50),
        memoryExtractEvery: normalizeWechatMemoryNumber(document.getElementById('wcs-memory-extract')?.value, prevConfig.memoryExtractEvery || WECHAT_MEMORY_DEFAULTS.extractEvery, 2, 30),
        memoryResetAt: prevConfig.memoryResetAt || 0,
        signature: document.getElementById('wcs-char-signature')?.value.trim() || prevConfig.signature || '',
        imageReference: prevConfig.imageReference || '',
        videoCallBg: prevConfig.videoCallBg || '',
        videoCallUseCamera: !!document.getElementById('wcs-video-real-camera')?.checked,
        momentCovers: Array.isArray(prevConfig.momentCovers) ? prevConfig.momentCovers : [],
        contactProfile: prevConfig.contactProfile || null,
        contactProfileError: prevConfig.contactProfileError || '',
        profileBio: prevConfig.profileBio || '',
        blacklisted: !!prevConfig.blacklisted,
        friendRequestReason: prevConfig.friendRequestReason || '',
        friendRequestAt: prevConfig.friendRequestAt || 0,
        charBlacklistedUser: !!prevConfig.charBlacklistedUser,
        charBlacklistReason: prevConfig.charBlacklistReason || '',
        monitorEnabled: !!document.getElementById('wcs-monitor-enabled')?.checked,
        monitorMode: getWechatMonitorMode({ chatConfig: { monitorMode: document.getElementById('wcs-monitor-mode')?.value } }),
        monitorBarrageSpeed: normalizeWechatMonitorBarrageSpeed(document.getElementById('wcs-monitor-barrage-speed')?.value),
        promptWorldBookIds,
        voiceBinding,
        monitorState: prevConfig.monitorState || null,
        pendingMonitorRequest: prevConfig.pendingMonitorRequest || null,
        pendingContactDeleteRequest: prevConfig.pendingContactDeleteRequest || null,
        aiMoments: Array.isArray(prevConfig.aiMoments) ? prevConfig.aiMoments : [],
        aiStatusSnapshot: prevConfig.aiStatusSnapshot || null,
        aiStatusError: prevConfig.aiStatusError || '',
        aiStatusHistory: Array.isArray(prevConfig.aiStatusHistory) ? prevConfig.aiStatusHistory : [],
        aiPhoneSnapshot: prevConfig.aiPhoneSnapshot || null,
        userProfile: prevConfig.userProfile || null,
        customCss: (document.getElementById('wcs-custom-css') || {}).value || ''
    };
    window._tempChatBgImage = null;

    // 保存角色描述
    char.description = document.getElementById('wcs-char-desc').value;

    // 保存用户资料（当前聊天独立）
    const scopedProfile = {
        avatar: document.getElementById('wcs-user-avatar').src || '',
        name: document.getElementById('wcs-user-name').value.trim() || '我',
        bio: document.getElementById('wcs-user-bio').value.trim(),
        signature: document.getElementById('wcs-user-signature')?.value.trim() || '',
        personaId: prevConfig.userProfile?.personaId || ''
    };
    saveWechatChatUserProfile(char, scopedProfile);

    const memoryStore = getWechatMemoryStore();
    const memoryBucket = getWechatMemoryBucket(memoryStore, char.id);
    promoteWechatMemoryBucket(memoryBucket, char);
    saveWechatMemoryStore(memoryStore);

    // 应用配置到当前聊天
    applyChatConfig(char);

    // 保存成功后才关闭面板，避免将存储失败伪装成已保存。
    try {
        const saved = await saveCharactersToStorage();
        if (saved === false) throw new Error('设置未能保存');
    } catch (error) {
        if (typeof showWechatToast === 'function') showWechatToast('设置保存失败，请清理空间后重试');
        console.error('聊天设置保存失败:', error);
        return false;
    }
    refreshChatView(char);
    renderChatList();

    closeChatSettings();
    return true;
}

function resetWechatChatDerivedContext(char) {
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    const resetAt = Date.now();
    clearWechatMemoryForChar(char.id);
    const oldTimer = window._wechatMemoryExtractionTimers?.get?.(char.id);
    if (oldTimer) {
        clearTimeout(oldTimer);
        window._wechatMemoryExtractionTimers.delete(char.id);
    }

    char.chatConfig.aiStatusSnapshot = null;
    char.chatConfig.aiStatusHistory = [];
    char.chatConfig.aiStatusError = '';
    char.chatConfig.aiStatusLoading = false;
    char.chatConfig.aiPhoneSnapshot = null;
    char.chatConfig.aiPhoneUserRemark = '';
    char.chatConfig.aiPhoneUsageLog = [];
    // 代发 threads, pending reactions and events belong to the cleared session.
    char.chatConfig.aiPhoneContactReplies = null;
    char.chatConfig.monitorState = null;
    char.chatConfig.pendingMonitorRequest = null;
    char.chatConfig.pendingContactDeleteRequest = null;
    char.chatConfig.monitorReason = '';
    char.chatConfig.monitorChangedByCharAt = 0;
    char.chatConfig.userTitle = '';
    char.chatConfig.memoryResetAt = resetAt;
    char.chatConfig.lastReadAt = resetAt;
    char.chatConfig.unreadCount = 0;
    char.unreadCount = 0;
    // Cleared chats must not linger as Living World private-chat memories.
    try { window.LivingWorld?.clearPrivateChatEvents?.(char); }
    catch (error) { console.warn('论坛私聊记录清理失败', error); }
}

function pruneWechatAutoMemoryForChar(charId) {
    const id = String(charId || '').trim();
    if (!id) return false;
    const store = getWechatMemoryStore();
    const bucket = store.chars && store.chars[id];
    if (!bucket) return false;
    const isAutoMemory = item => !!(item && (item.auto || /^mem_(?:ext|auto)_/.test(String(item.id || ''))));
    const pruneList = list => Array.isArray(list) ? list.filter(item => !isAutoMemory(item)) : [];
    const nextBucket = {
        segments: pruneList(bucket.segments),
        longTerm: pruneList(bucket.longTerm),
        compressed: pruneList(bucket.compressed),
        meta: bucket.meta || {}
    };
    const changed =
        nextBucket.segments.length !== (bucket.segments || []).length ||
        nextBucket.longTerm.length !== (bucket.longTerm || []).length ||
        nextBucket.compressed.length !== (bucket.compressed || []).length;
    if (!changed) return false;
    if (!nextBucket.segments.length && !nextBucket.longTerm.length && !nextBucket.compressed.length) delete store.chars[id];
    else {
        nextBucket.meta.lastExtractedIndex = 0;
        nextBucket.meta.lastExtractedAt = 0;
        nextBucket.meta.extractionBusy = false;
        nextBucket.meta.extractionError = '';
        store.chars[id] = nextBucket;
    }
    saveWechatMemoryStore(store);
    return true;
}

function sanitizeWechatEmptyChatDerivedContext(char) {
    if (!char || !char.id) return false;
    const history = Array.isArray(char.history) ? char.history : [];
    if (history.length || String(char.lastMsg || '').trim()) return false;
    char.chatConfig = char.chatConfig || {};
    if (char.chatConfig.memoryResetAt) return false;

    const resetAt = Date.now();
    let changed = pruneWechatAutoMemoryForChar(char.id);
    if (
        char.chatConfig.aiStatusSnapshot ||
        (Array.isArray(char.chatConfig.aiStatusHistory) && char.chatConfig.aiStatusHistory.length) ||
        char.chatConfig.aiPhoneSnapshot ||
        char.chatConfig.aiPhoneUserRemark ||
        (char.chatConfig.userTitle && char.chatConfig.userTitle !== '我') ||
        char.chatConfig.monitorState ||
        char.chatConfig.pendingMonitorRequest ||
        char.chatConfig.pendingContactDeleteRequest
    ) {
        char.chatConfig.aiStatusSnapshot = null;
        char.chatConfig.aiStatusHistory = [];
        char.chatConfig.aiStatusError = '';
        char.chatConfig.aiStatusLoading = false;
        char.chatConfig.aiPhoneSnapshot = null;
        char.chatConfig.aiPhoneUserRemark = '';
        char.chatConfig.aiPhoneUsageLog = [];
        char.chatConfig.monitorState = null;
        char.chatConfig.pendingMonitorRequest = null;
        char.chatConfig.pendingContactDeleteRequest = null;
        char.chatConfig.monitorReason = '';
        char.chatConfig.monitorChangedByCharAt = 0;
        char.chatConfig.userTitle = '';
        changed = true;
    }
    if (changed) {
        char.chatConfig.memoryResetAt = resetAt;
        char.chatConfig.lastReadAt = resetAt;
        char.chatConfig.unreadCount = 0;
        char.unreadCount = 0;
    }
    return changed;
}

function clearCurrentWechatChatHistory() {
    const char = getCurrentChatChar();
    if (!char) return;
    const displayName = (char.chatConfig && char.chatConfig.nickname) || char.name || '该角色';
    if (!confirm(`确定删除「${displayName}」的所有聊天记录吗？\n会同时清空该角色的自动记忆、状态栏记录、小手机快照和关系称呼；不会删除角色卡、贴纸包和基础聊天设置。`)) return;
    char.history = [];
    char.lastMsg = '';
    resetWechatChatDerivedContext(char);
    window._wechatExpandedHistoryIds?.delete?.(char.id);
    saveCharactersToStorage();
    refreshChatView(char);
    renderChatList();
    closeChatSettings();
    if (typeof showWechatToast === 'function') showWechatToast('已删除聊天记录、记忆和状态缓存');
}

function getWechatChatForegroundTone(pixels) {
    let brightness = 0;
    let weight = 0;
    for (let i = 0; i + 3 < pixels.length; i += 4) {
        const alpha = pixels[i + 3] / 255;
        if (alpha <= 0) continue;
        brightness += (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) * alpha;
        weight += alpha;
    }
    const isLightBackground = weight > 0 && brightness / weight >= 150;
    return isLightBackground
        ? { color: '#111827', shadow: 'drop-shadow(0 1px 2px rgba(255,255,255,0.92))' }
        : { color: '#ffffff', shadow: 'drop-shadow(0 1px 3px rgba(0,0,0,0.88))' };
}

function getWechatChatBackgroundSamplePoint(target, contentRect, fallbackX) {
    const rect = target?.getBoundingClientRect?.();
    if (!rect || !rect.width || !rect.height || !contentRect.width || !contentRect.height) {
        return { x: fallbackX, y: 0.085 };
    }
    return {
        x: Math.max(0, Math.min(1, (rect.left + rect.width / 2 - contentRect.left) / contentRect.width)),
        y: Math.max(0, Math.min(1, (rect.top + rect.height / 2 - contentRect.top) / contentRect.height))
    };
}

// The left and right controls can sit over very different parts of a portrait.
// Sample each control's actual background instead of assigning one colour to the whole header.
function syncWechatChatBackgroundTones(roomEl, contentEl, src) {
    if (!roomEl || !contentEl || !src || typeof Image !== 'function' || typeof document === 'undefined') return;
    const token = String(src).slice(0, 96) + ':' + String(src).length;
    if (roomEl.dataset.chatBgToneToken === token) return;
    roomEl.dataset.chatBgToneToken = token;

    const image = new Image();
    if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous';
    image.onload = () => {
        let layoutRetries = 0;
        const applySampledTones = () => {
            if (roomEl.dataset.chatBgToneToken !== token) return;
            try {
                let contentRect = contentEl.getBoundingClientRect?.() || {};
                if ((!contentRect.width || !contentRect.height) && layoutRetries < 4 && typeof requestAnimationFrame === 'function') {
                    layoutRetries++;
                    requestAnimationFrame(applySampledTones);
                    return;
                }
                if (!contentRect.width || !contentRect.height) {
                    const roomRect = roomEl.getBoundingClientRect?.() || {};
                    contentRect = roomRect.width && roomRect.height
                        ? roomRect
                        : { left: 0, top: 0, width: 390, height: 780 };
                }
                const aspect = contentRect.width && contentRect.height ? contentRect.height / contentRect.width : 2;
                const canvas = document.createElement('canvas');
                canvas.width = 96;
                canvas.height = Math.max(96, Math.min(240, Math.round(canvas.width * aspect)));
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
                const drawWidth = image.naturalWidth * scale;
                const drawHeight = image.naturalHeight * scale;
                ctx.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);

                const header = roomEl.querySelector('.wc-room-header');
                const targets = [
                    ['back', roomEl.querySelector('.wc-float-back') || header?.querySelector('i:first-child'), 0.075],
                    ['title', roomEl.querySelector('.wc-floating-avatar') || header?.querySelector('.wc-room-title-wrap'), 0.5],
                    ['more', roomEl.querySelector('.wc-float-more') || header?.querySelector('i:last-child'), 0.925]
                ];
                targets.forEach(([name, target, fallbackX]) => {
                    const point = getWechatChatBackgroundSamplePoint(target, contentRect, fallbackX);
                    const radius = 6;
                    const x = Math.max(radius, Math.min(canvas.width - radius, Math.round(point.x * canvas.width)));
                    const y = Math.max(radius, Math.min(canvas.height - radius, Math.round(point.y * canvas.height)));
                    const pixels = ctx.getImageData(x - radius, y - radius, radius * 2, radius * 2).data;
                    const tone = getWechatChatForegroundTone(pixels);
                    roomEl.style.setProperty(`--wc-chat-${name}-color`, tone.color);
                    roomEl.style.setProperty(`--wc-chat-${name}-shadow`, tone.shadow);
                });
            } catch (_) {
                roomEl.style.setProperty('--wc-chat-back-color', '#ffffff');
                roomEl.style.setProperty('--wc-chat-title-color', '#ffffff');
                roomEl.style.setProperty('--wc-chat-more-color', '#ffffff');
            }
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(applySampledTones);
        else applySampledTones();
    };
    image.onerror = () => {
        if (roomEl.dataset.chatBgToneToken === token) delete roomEl.dataset.chatBgToneToken;
    };
    image.src = src;
}

function applyChatConfig(char) {
    const config = char.chatConfig || {};
    const contentEl = document.getElementById('chat-room-content');
    if (!contentEl) return;
    syncWechatQQGroupShortcutBar(char);

    // 背景
    const roomEl = contentEl.closest ? contentEl.closest('.wc-chat-room') : null;
    if (config.chatBgImage) {
        contentEl.classList.add('has-custom-chat-bg');
        if (roomEl) {
            roomEl.classList.add('has-custom-chat-bg');
            syncWechatChatBackgroundTones(roomEl, contentEl, config.chatBgImage);
        }
        contentEl.style.setProperty('--custom-chat-bg-image', `url(${config.chatBgImage})`);
        contentEl.style.backgroundImage = `url(${config.chatBgImage})`;
        contentEl.style.backgroundSize = 'cover';
        contentEl.style.backgroundPosition = 'center';
        contentEl.style.backgroundRepeat = 'no-repeat';
        contentEl.style.backgroundColor = '';
    } else {
        contentEl.classList.remove('has-custom-chat-bg');
        if (roomEl) {
            roomEl.classList.remove('has-custom-chat-bg');
            delete roomEl.dataset.chatBgToneToken;
            ['back', 'title', 'more'].forEach(name => {
                roomEl.style.removeProperty(`--wc-chat-${name}-color`);
                roomEl.style.removeProperty(`--wc-chat-${name}-shadow`);
            });
        }
        contentEl.style.removeProperty('--custom-chat-bg-image');
        contentEl.style.backgroundImage = '';
        contentEl.style.backgroundSize = '';
        contentEl.style.backgroundPosition = '';
        contentEl.style.backgroundRepeat = '';
        contentEl.style.backgroundColor = config.chatBg || '';
    }

    // 气泡颜色 + 字体大小（通过 CSS 变量注入）
    const room = document.getElementById('wechat-chat-room');
    if (room) {
        room.style.setProperty('--bubble-ai', config.bubbleAi || '#ffffff');
        room.style.setProperty('--bubble-user', config.bubbleUser || '#95ec69');
        room.style.setProperty('--chat-font-size', (config.fontSize || 15) + 'px');
    }

    // 自定义气泡 CSS
    let customStyle = document.getElementById('chat-custom-css');
    if (config.customCss) {
        if (!customStyle) {
            customStyle = document.createElement('style');
            customStyle.id = 'chat-custom-css';
            document.head.appendChild(customStyle);
        }
        customStyle.textContent = scopeWechatChatCustomCss(config.customCss);
    } else if (customStyle) {
        customStyle.remove();
    }

    // 清除预览样式
    const previewStyle = document.getElementById('wcs-css-preview-style');
    if (previewStyle) previewStyle.remove();

    requestAnimationFrame(() => applyWechatBubbleMetaContrast(contentEl));
    if (window.ByndApiTicket?.refreshEntryTones) requestAnimationFrame(() => window.ByndApiTicket.refreshEntryTones(contentEl, char));
}

