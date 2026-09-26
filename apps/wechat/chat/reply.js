// --- ✨ AI 回复按钮（点击才触发AI回复） ---
async function triggerAiReply() {
    if (window._wechatAiBusy) return;
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    const inputEl = document.getElementById('wc-msg-input');
    const text = inputEl ? getWechatMessageInputValue({ markers: true }).trim() : '';
    const contentEl = document.getElementById('chat-room-content');
    if (!char.history) char.history = [];
    const claudeWasEmpty = getWechatUiThemeId() === 'claude'
        && !char.history.some(msg => msg && msg.type !== 'system_notice');

    // 如果输入框有文字，先发送
    if (text) {
        if (isWechatQQGroupSpeechMuted(char)) {
            showWechatToast('当前群已开启全员禁言');
            return;
        }
        const userMsg = buildWechatUserTextMessage(text);
        clearWechatMessageInput();
        syncWechatDraftState();
        if (window._wechatReplyDraft) {
            userMsg.replyTo = { ...window._wechatReplyDraft };
            clearWechatReplyDraft();
        }
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
        if (claudeWasEmpty && contentEl && !contentEl.querySelector('.wc-claude-chat-welcome')) {
            contentEl.insertAdjacentHTML('afterbegin', renderWechatClaudeChatWelcome());
        }
        saveCharactersToStorage();
        renderChatList();
    }

    if (claudeWasEmpty && contentEl && !contentEl.querySelector('.wc-claude-chat-welcome')) {
        contentEl.insertAdjacentHTML('afterbegin', renderWechatClaudeChatWelcome());
    }
    closeChatToolbar();
    await triggerAiAfterMessage(char, contentEl);
}

async function completeWechatGroupMissingReplies(char, contentEl, replyStartIndex, existingReplyCount = 0) {
    if (!char?.isGroupChat || !Array.isArray(char.history)) return 0;
    const members = getWechatGroupMembers(char);
    if (members.length < 2) return 0;
    const lastBeforeReply = getWechatLastVisibleMessageBefore(char, replyStartIndex);
    if (!lastBeforeReply || !lastBeforeReply.isMe) return 0;

    let missing = getWechatGroupMissingReplyMembers(char, replyStartIndex);
    if (!missing.length) return 0;

    let appended = 0;
    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts && missing.length; attempt++) {
        const missingNames = missing.map(member => getWechatQQGroupMemberDisplayName(char, member)).join('、');
        const alreadyNames = members
            .filter(member => !missing.some(item => item.id === member.id))
            .map(member => getWechatQQGroupMemberDisplayName(char, member))
            .join('、') || '无';
        const messages = buildMessages(char, char.history || [], 30);
        messages.push({
            role: 'system',
            content: `【群聊补发要求】刚才这轮群聊已经有人发言：${alreadyNames}。仍缺少成员：${missingNames}。请只让缺少成员各自按人设补一条短消息，必须使用 [群聊发言:成员名|消息内容]，用 ||| 分隔。不要让已发言成员再次说话，不要道歉，不要解释规则，不要替用户发言。`
        });
        messages.push({
            role: 'user',
            content: `让 ${missingNames} 现在各自接一句，保持各自人设和当前聊天情绪。`
        });

        await new Promise(resolve => setTimeout(resolve, 320 + Math.random() * 260));
        const result = await callChatApi(messages, { usageFeature: 'chat', usageChar: char });
        if (!result || !result.ok || !result.content) {
            const errorText = result && result.error;
            console.warn('group catch-up reply failed:', errorText || result);
            break;
        }

        const parts = splitWechatAiResponseSegments(result.content, char);
        let attemptCount = 0;
        for (let i = 0; i < parts.length; i++) {
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 220 + Math.random() * 260));
            const text = cleanWechatVisibleContent(parts[i]);
            if (!text) continue;
            const count = appendWechatAiMessageParts(char, contentEl, text, {
                groupFallbackStartIndex: attemptCount,
                groupFallbackMembers: missing,
                groupReplyStartIndex: replyStartIndex
            }) || 0;
            attemptCount += count;
            appended += count;
        }
        missing = getWechatGroupMissingReplyMembers(char, replyStartIndex);
    }
    return appended;
}

