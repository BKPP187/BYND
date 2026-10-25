// --- 🚀 微信发送消息（只发送；点闪光按钮才触发AI） ---
function sendWechatMessage() {
    if (window._wechatAiBusy) return;
    const inputEl = document.getElementById('wc-msg-input');
    if (!inputEl) return;
    const text = getWechatMessageInputValue({ markers: true }).trim();
    if (!text) return;

    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    if (isWechatQQGroupSpeechMuted(char)) {
        showWechatToast('当前群已开启全员禁言');
        return;
    }

    const userMsg = buildWechatUserTextMessage(text);
    clearWechatMessageInput();
    syncWechatDraftState();
    closeChatToolbar();
    if (window._wechatReplyDraft) {
        userMsg.replyTo = { ...window._wechatReplyDraft };
        clearWechatReplyDraft();
    }
    if (!char.history) char.history = [];
    char.history.push(userMsg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    notifyWechatMonitors(char, userMsg);
    maybeCaptureWechatMemoryCommand(char, text);
    if (typeof window.captureMoneyExpensesFromText === 'function') {
        window.captureMoneyExpensesFromText(text, {
            source: 'wechat',
            charId: char.id,
            charName: (char.chatConfig && char.chatConfig.nickname) || char.name || ''
        });
    }

    refreshChatView(char);
    saveCharactersToStorage().then(saved => {
        if (saved !== false && !char.isGroupChat && window.LivingWorld?.recordPrivateChatMessage) {
            try { window.LivingWorld.recordPrivateChatMessage(char, userMsg); }
            catch (error) { console.warn('论坛私聊事件未保存', error); }
        }
    });
    renderChatList();
    maybeShowWechatReplyHint();
}

// 发送只发出消息，点 ✨ 才回复。第一次发送时提示一次，之后不再打扰。
const WECHAT_REPLY_HINT_KEY = 'bynd_wechat_reply_hint_seen_v1';
let wechatReplyHintTimer = 0;
function maybeShowWechatReplyHint() {
    try {
        if (localStorage.getItem(WECHAT_REPLY_HINT_KEY)) return;
        localStorage.setItem(WECHAT_REPLY_HINT_KEY, '1');
    } catch (_) { return; }
    const room = document.getElementById('wechat-chat-room');
    const button = room?.querySelector('.wc-ai-btn');
    if (!room || !button || room.querySelector('.wc-reply-hint')) return;
    const roomRect = room.getBoundingClientRect(), rect = button.getBoundingClientRect();
    const hint = document.createElement('div');
    hint.className = 'wc-reply-hint';
    hint.setAttribute('role', 'status');
    hint.innerHTML = '<b>点 ✨ 让 Ta 回复</b><span>可以先连发几条，再一起回复</span><button type="button">知道了</button>';
    hint.style.right = Math.max(8, roomRect.right - rect.right - 6) + 'px';
    hint.style.bottom = (roomRect.bottom - rect.top + 10) + 'px';
    hint.querySelector('button').onclick = dismissWechatReplyHint;
    room.appendChild(hint);
    wechatReplyHintTimer = setTimeout(dismissWechatReplyHint, 15000);
}

function dismissWechatReplyHint() {
    clearTimeout(wechatReplyHintTimer);
    document.querySelectorAll('.wc-reply-hint').forEach(hint => hint.remove());
}

