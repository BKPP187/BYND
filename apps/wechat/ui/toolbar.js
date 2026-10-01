// --- 工具栏开关 ---
function alignQqChatToolbarPointer() {
    const app = document.getElementById('app-wechat-window');
    const room = document.getElementById('wechat-chat-room');
    const toolbar = document.getElementById('wc-chat-toolbar');
    const plus = room?.querySelector('.wc-add-btn');
    if (!app?.classList.contains('wc-ui-theme-qq') || !room || !toolbar || !plus || toolbar.classList.contains('hidden')) return;
    const plusRect = plus.getBoundingClientRect();
    const roomRight = room.getBoundingClientRect().right;
    const plusCenter = plusRect.left + plusRect.width / 2;
    // Panel right inset is 20px and the pointer is 14px wide.
    toolbar.style.setProperty('--wc-qq-toolbar-pointer-right', `${roomRight - plusCenter - 27}px`);
}

function toggleChatToolbar() {
    if (document.getElementById('app-wechat-window')?.dataset.uiTheme === 'pixel') return;
    const toolbar = document.getElementById('wc-chat-toolbar');
    const picker = document.getElementById('wc-sticker-picker');
    if (picker && !picker.classList.contains('hidden')) picker.classList.add('hidden');
    if (isWechatVoiceInputMode()) setWechatVoiceInputMode(false, { keepDraft: true });
    toolbar.classList.toggle('hidden');
    const room = document.getElementById('wechat-chat-room');
    if (room) room.classList.toggle('wc-toolbar-open', !toolbar.classList.contains('hidden'));
    const addBtn = document.querySelector('.wc-add-btn');
    if (addBtn) addBtn.classList.toggle('is-open', !toolbar.classList.contains('hidden'));
    alignQqChatToolbarPointer();
}

window.addEventListener('resize', alignQqChatToolbarPointer);

function closeChatToolbar() {
    const toolbar = document.getElementById('wc-chat-toolbar');
    if (toolbar && !toolbar.classList.contains('hidden')) toolbar.classList.add('hidden');
    document.getElementById('wechat-chat-room')?.classList.remove('wc-toolbar-open');
    const addBtn = document.querySelector('.wc-add-btn');
    if (addBtn) addBtn.classList.remove('is-open');
    const picker = document.getElementById('wc-sticker-picker');
    if (picker && !picker.classList.contains('hidden')) picker.classList.add('hidden');
}

function isWechatChatSettingsOpen() {
    const settingsPanel = document.getElementById('wc-chat-settings-panel');
    return !!(settingsPanel && (settingsPanel.classList.contains('active') || settingsPanel.style.display === 'flex'));
}

function closeChat(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    if (isWechatChatSettingsOpen()) {
        backWechatChatSettings(event);
        return;
    }
    closeChatToolbar();
    setWechatVoiceInputMode(false, { keepDraft: true });
    const room = document.getElementById('wechat-chat-room');
    if (room) {
        room.classList.remove('active');
        setTimeout(() => room.classList.add('hidden'), 300);
    }
    window.currentChatCharId = null;
    if (typeof updateWechatUiThemeStructure === 'function') updateWechatUiThemeStructure(getWechatUiTheme());
}
