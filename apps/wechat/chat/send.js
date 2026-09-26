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
}

