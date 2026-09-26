function buildWechatAiPhoneContactReplyReactionPrompt(char, events) {
    const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : ((typeof getUserProfile === 'function') ? getUserProfile() : {});
    const identity = typeof buildWechatIdentityContextPrompt === 'function' ? buildWechatIdentityContextPrompt(char, userProfile) : '';
    const characterCard = typeof getWechatCharacterPersonaText === 'function'
        ? getWechatCharacterPersonaText(char, 5200)
        : String(char && char.description || '').slice(0, 5200);
    const worldBook = typeof buildWechatWorldBookPrompt === 'function' ? buildWechatWorldBookPrompt(char) : '';
    const memory = typeof buildWechatMemoryPrompt === 'function' ? buildWechatMemoryPrompt(char) : '';
    const recent = typeof buildWechatRecentHistoryForPrompt === 'function'
        ? buildWechatRecentHistoryForPrompt(char, 18)
        : (Array.isArray(char && char.history) ? char.history.slice(-18).map(msg => `${msg.isMe ? '用户' : getWechatCharDisplayName(char)}: ${msg.content || msg.description || ''}`).join('\n') : '');
    const eventText = events.map((event, index) => [
        `事件 ${index + 1}`,
        `联系人：${event.contactName || '联系人'}`,
        event.contactPreview ? `原聊天预览：${event.contactPreview}` : '',
        `用户拿着/看着 char 的小手机，替 char 发出的回复：${event.userReply}`
    ].filter(Boolean).join('\n')).join('\n\n');
    return [
        identity,
        characterCard ? `【角色卡/人设】\n${characterCard}` : '',
        worldBook,
        memory,
        `【最近聊天】\n${recent || '暂无最近聊天。'}`,
        `【刚发生的手机事件】\n${eventText}`,
        '请作为这个 char，在普通聊天里对用户自然回应。char 明确知道用户查看了自己的小手机，也知道用户替自己回复了联系人/NPC。必须按人设、世界书、当前关系和情绪推演反应，可以质问、害羞、纵容、冷处理、调侃或顺势推进剧情，但不要写系统说明，不要模板化，不要脱离角色。按语气自然拆成 2-4 条短消息，用 ||| 分隔，不要把整段回应挤在一条消息里。'
    ].filter(Boolean).join('\n\n');
}

function buildWechatAiPhoneContactReplyMessages(content, char) {
    const source = cleanWechatVisibleContent(content);
    const hasExplicitBubbleBreak = /\|{2,}|\r?\n/.test(source);
    const messages = splitWechatAiResponseSegments(source, char)
        .filter(segment => !isWechatAiMetaLeakContent(segment))
        .flatMap(segment => cleanWechatVisibleContent(segment).replace(/<[^>]+>/g, '').split(/\r?\n+/))
        .flatMap(paragraph => splitWechatSentenceChunks(paragraph, 118))
        .filter(text => text && !isWechatAiMetaLeakContent(text))
        .map(text => syncWechatMessageDescription({
            type: 'text',
            isMe: false,
            content: text,
            background: true,
            timestamp: createMessageTimestamp()
        }));
    if (!hasExplicitBubbleBreak) return messages;
    return messages.map((message, index) => index === messages.length - 1
        ? message
        : { ...message, content: String(message.content || '').replace(/。\s*$/, '') });
}

async function triggerWechatAiPhoneContactReplyReaction(char, events) {
    if (!char || !Array.isArray(events) || !events.length || typeof callChatApi !== 'function') return false;
    if (isWechatAiRateLimitPaused() || isWechatBackgroundApiPaused()) return false;
    const store = getWechatAiPhoneContactReplyStore(char);
    let messages = [];
    let removedEvents = [];
    let saved = false;
    try {
        if (await saveCharactersToStorage() === false) throw new Error('代发记录未能保存，本次未请求回复。');
        const result = await callChatApi([
            {
                role: 'system',
                content: '你是 BYND 微信聊天里的角色本体。只输出角色发给用户的普通文字消息，像正常微信聊天一样按语气分成多个短气泡，用 ||| 分隔，也可以换行分段。用 ||| 分成多条时，除最后一条外不要以中文句号“。”收尾；问号、叹号和省略号照常保留。不要输出序号、JSON、系统说明或特殊消息指令。'
            },
            {
                role: 'user',
                content: buildWechatAiPhoneContactReplyReactionPrompt(char, events)
            }
        ], { background: true, usageFeature: 'charPhone', usageChar: char });
        if (!result?.ok) throw new Error(result?.error || '接口未返回回复内容。');
        messages = buildWechatAiPhoneContactReplyMessages(result.content, char);
        if (!messages.length) throw new Error('接口未返回可显示的回复。');
        char.history = Array.isArray(char.history) ? char.history : [];
        char.history.push(...messages);
        const eventIds = new Set(events.map(event => event.id).filter(Boolean));
        const belongsToReply = event => events.includes(event) || (event.id && eventIds.has(event.id));
        removedEvents = store.pending.filter(belongsToReply);
        store.pending = store.pending.filter(event => !belongsToReply(event));
        if (await saveCharactersToStorage() === false) throw new Error('回复未能保存，已保留代发记录。');
        saved = true;
        renderChatList();
        if (window.currentChatCharId === char.id && typeof refreshChatView === 'function') refreshChatView(char);
        return true;
    } catch (e) {
        if (!saved) {
            // Keep messages/events added by another in-flight user action.
            char.history = (char.history || []).filter(msg => !messages.includes(msg));
            const restored = [...removedEvents, ...store.pending];
            const seen = new Set();
            store.pending = restored.filter(event => {
                const key = event.id || event;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            if (typeof showWechatToast === 'function') showWechatToast('代发后的回复未完成：' + (e.message || '请稍后重试。'));
        }
        console.warn('ai phone contact reply reaction failed:', e);
        return saved;
    }
}

function flushWechatAiPhoneContactReplyReactions(char) {
    const store = char ? getWechatAiPhoneContactReplyStore(char) : null;
    if (!char || !store.pending.length || isWechatAiRateLimitPaused() || isWechatBackgroundApiPaused()) return false;
    window._wechatAiPhoneContactReplyGenerating = window._wechatAiPhoneContactReplyGenerating || new Map();
    const generating = window._wechatAiPhoneContactReplyGenerating;
    if (generating.has(char.id)) return false;
    const pending = store.pending.slice(0, 8);
    let completed = false;
    const promise = triggerWechatAiPhoneContactReplyReaction(char, pending)
        .then(success => { completed = success; return success; })
        .finally(() => {
            generating.delete(char.id);
            if (completed && store.pending.length) setTimeout(() => flushWechatAiPhoneContactReplyReactions(char), 0);
        });
    generating.set(char.id, promise);
    return true;
}

function closeWechatAiPhone() {
    resetCharPhoneClock();
    const charId = window._wechatAiPhoneOpenCharId;
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const deferredTimer = window._wechatAiPhoneDeferredSyncTimers?.get(charId);
    if (deferredTimer) clearTimeout(deferredTimer);
    window._wechatAiPhoneDeferredSyncTimers?.delete(charId);
    const diaryTimer = window._wechatAiPhoneDiaryFollowUpTimers?.get(charId);
    if (diaryTimer) clearTimeout(diaryTimer);
    window._wechatAiPhoneDiaryFollowUpTimers?.delete(charId);
    const modal = document.getElementById('wc-ai-phone-overlay');
    if (modal) modal.remove();
    closeWechatAiPhoneErrorPrompt();
    closeWechatAiPhoneHomeEditor();
    closeWechatAiPhoneIconEditor();
    window._wechatAiPhoneOpenCharId = '';
    window._wechatAiPhoneTab = 'home';
    window._wechatAiPhoneChatIndex = 0;
    window._wechatAiPhoneMemoIndex = -1;
    window._wechatAiPhoneBrowserIndex = -1;
    flushWechatAiPhoneContactReplyReactions(char);
}
