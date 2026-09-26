// --- 共享AI调用逻辑 ---
function isWechatApiRateLimitError(result) {
    return !!(result && result.rateLimited === true);
}

function getWechatChatApiPauseRemainingMs() {
    return typeof getChatApiRateLimitPauseRemainingMs === 'function'
        ? getChatApiRateLimitPauseRemainingMs()
        : 0;
}

function isWechatAiRateLimitPaused() {
    return getWechatChatApiPauseRemainingMs() > 0;
}

function isWechatBackgroundApiPaused() {
    return getWechatChatApiPauseRemainingMs() > 0;
}

function consumeWechatAvatarDirective(char, content) {
    let changed = false;
    let backgroundChanged = false;
    const text = String(content || '').replace(/[\[【]换头像\s*[：:]\s*(\d+)\s*[\]】]/g, (_, number) => {
        const avatar = char.avatarGallery?.[Number(number) - 1];
        if (avatar && char.avatar !== avatar) { char.avatar = avatar; changed = true; }
        return '';
    }).replace(/[\[【]换背景\s*[：:]\s*(\d+)\s*[\]】]/g, (_, number) => {
        const background = char.chatConfig?.chatBgGallery?.[Number(number) - 1];
        if (background && char.chatConfig.chatBgImage !== background) { char.chatConfig.chatBgImage = background; changed = true; backgroundChanged = true; }
        return '';
    }).trim();
    return { content: text, changed, backgroundChanged };
}

// After a reply, the decision layer (Jev when configured, otherwise the reply's own <bynd_decide> verdicts)
// says which background jobs are worth a request; null keeps the original BYND behaviour for that job.
async function runWechatTurnFollowUps(char, context = {}) {
    let turn = null;
    try { turn = await window.ByndDecider?.afterReply(char, { replyDecisions: context.replyDecisions }); }
    catch (error) { console.warn('turn decisions failed:', error); }
    if (!(window.myCharacters || []).includes(char)) return;
    if (turn?.avatar && char.avatarGallery?.[turn.avatar.index]) {
        char.avatar = char.avatarGallery[turn.avatar.index];
        saveCharactersToStorage();
        if (window.currentChatCharId === char.id) refreshChatView(char);
        renderChatList();
    }
    const skipStatus = turn?.status === false;
    const statusRequestWillRun = !skipStatus && shouldDeferWechatMemoryAfterReply(char);
    const statusJob = !skipStatus ? requestWechatAiStatusSnapshot(char, { reason: 'after_reply', decided: turn?.status === true })
        .catch(e => console.warn('ai status snapshot failed:', e)) : null;
    // A reply must not immediately consume quota again for both generated
    // status and memory. The next eligible reply will pick memory up once
    // the status snapshot is fresh (or its automatic retry is cooled down).
    if (statusRequestWillRun && context.webSearched && turn?.memory === true) {
        void statusJob?.then(() => scheduleWechatMemoryExtraction(char, 'web_search'));
    } else if (!statusRequestWillRun && turn?.memory !== false) {
        scheduleWechatMemoryExtraction(char, context.webSearched && turn?.memory === true ? 'web_search' : 'after_reply');
    }
    if (!context.textOnly && !char.isGroupChat && turn?.moment !== false) void considerWechatCharMomentAfterReply(char);
}

