function pickWechatCharMomentCover(char) {
    const covers = Array.isArray(char?.chatConfig?.momentCovers) ? char.chatConfig.momentCovers.filter(Boolean) : [];
    if (!covers.length) return '';
    const seed = Math.floor(Date.now() / 86400000) + String(char.id || '').length;
    return covers[seed % covers.length];
}

function applyWechatCharMomentDirective(rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const text = String(args[0] || '').trim().slice(0, 500);
    const images = args.slice(1).map(item => String(item || '').trim()).filter(item => /^(https?:|data:image|data:video)/i.test(item)).slice(0, 9);
    if (!text && !images.length) return null;
    const store = getWechatMomentStore();
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.aiMoments = Array.isArray(char.chatConfig.aiMoments) ? char.chatConfig.aiMoments : [];
    const post = {
        id: 'mom_char_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        text,
        images,
        userName: getWechatCharDisplayName(char),
        userAvatar: char.avatar || DEFAULT_AVATAR,
        charId: char.id,
        source: 'ai_moment',
        cover: pickWechatCharMomentCover(char),
        comments: [],
        pending: [],
        createdAt: Date.now()
    };
    store.posts.push(post);
    char.chatConfig.aiMoments.push({ id: post.id, text, source: 'ai_moment', createdAt: post.createdAt });
    saveWechatMomentStore(store);
    saveCharactersToStorage();
    if (isWechatMomentsScreenOpen()) renderWechatMoments();
    return {
        type: 'system_notice',
        isMe: false,
        content: `${getWechatCharDisplayName(char)} 发了一条朋友圈`,
        timestamp: createMessageTimestamp()
    };
}

const pendingWechatCharMoments = new Set();
async function considerWechatCharMomentAfterReply(char) {
    if (!char?.id || char.isGroupChat || pendingWechatCharMoments.has(char.id) || typeof callChatApi !== 'function') return false;
    const current = Date.now();
    const existing = getWechatMomentStore().posts.filter(post => post.charId === char.id && post.source === 'ai_moment');
    const lastPostAt = Math.max(0,...existing.map(post => Number(post.createdAt || 0)));
    if (current - lastPostAt < 18 * 3600000) return false;
    const recent = (char.history || []).slice(-20);
    if (recent.filter(msg => msg?.isMe && msg.type !== 'system_notice').length < 4) return false;
    const savedActivity = readWechatStore(WECHAT_CHAR_MOMENT_ACTIVITY_KEY, {});
    const activity = savedActivity && typeof savedActivity === 'object' && !Array.isArray(savedActivity) ? savedActivity : {};
    if (current - Number(activity[char.id] || 0) < 10 * 3600000) return false;
    try { writeWechatStore(WECHAT_CHAR_MOMENT_ACTIVITY_KEY,{ ...activity,[char.id]:current }); }
    catch (error) { console.warn('朋友圈决策时间未保存，已跳过 API 调用',error); return false; }
    pendingWechatCharMoments.add(char.id);
    try {
        const identity = String(char.description || char.personality || '').slice(0,650);
        const history = recent.map(msg => `${msg.isMe ? '用户' : char.name}：${stripWechatPromptText(msg.content || msg.description || '',100)}`).join('\n').slice(-1500);
        const worldBook = typeof buildWechatWorldBookPrompt === 'function' ? buildWechatWorldBookPrompt(char,4).slice(0,1000) : '';
        const jevChoice = await window.ByndJev?.choose('moment', { role:char.name, persona:identity.slice(0,240), recent:recent.slice(-5).map(msg => ({ from:msg.isMe ? 'user' : 'char', text:stripWechatPromptText(msg.content || msg.description || '',80) })), hoursSinceLastPost:lastPostAt ? Math.floor((current-lastPostAt)/3600000) : null }, 'Should this character publish an independent social update now, given their own motivation and recent activity?', { post:'A natural independent update is timely and in character.', silence:'No natural reason to publish now; remain silent.' });
        if (jevChoice === 'silence') return false;
        const systemPrompt = jevChoice === 'post'
            ? 'Jev 已选择角色此时发布朋友圈。你只写这条独立动态。只返回严格 JSON：{"post":true,"text":"8-180字的自然动态"}。保持人设、世界书和当前情绪；不要复述私聊原文，不要替用户发帖。'
            : '你只决定角色是否会在自己的朋友圈发一条独立动态。只返回严格 JSON：{"post":false} 或 {"post":true,"text":"8-180字的自然动态"}。保持人设、世界书和当前情绪；不要复述私聊原文，不要替用户发帖。没有自然动机就不发。';
        const result = await callChatApi([{ role:'system', content:systemPrompt },{ role:'user', content:`角色：${char.name}\n设定：${identity}\n世界书：${worldBook}\n最近聊天：${history}\n上次发动态：${lastPostAt ? new Date(lastPostAt).toISOString() : '暂无'}` }],{ background:true, backgroundPriority:-1, stream:false, temperature:.7, max_tokens:250, usageFeature:'moment', usageChar:char });
        if (!result?.ok) throw new Error(result?.error || '朋友圈决策失败');
        const raw = String(result.content || '').trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
        const decision = JSON.parse(raw);
        if (decision?.post !== true) return false;
        const text = String(decision.text || '').trim();
        if (text.length < 8 || text.length > 180 || /[\[【]微信朋友圈[：:]/.test(text)) throw new Error('朋友圈内容无效');
        const privateLines = recent.filter(msg => msg?.isMe).map(msg => String(msg.content || '').replace(/\s+/g,''));
        const condensed = text.replace(/\s+/g,'');
        if (privateLines.some(line => { for (let i = 0; i <= line.length - 12; i++) if (condensed.includes(line.slice(i,i + 12))) return true; return false; })) throw new Error('朋友圈内容复述了私聊原文');
        if (!(window.myCharacters || []).includes(char)) return false;
        const store = getWechatMomentStore();
        const post = { id:'mom_char_' + current + '_' + Math.random().toString(36).slice(2,6), text, images:[], userName:getWechatCharDisplayName(char), userAvatar:char.avatar || DEFAULT_AVATAR, charId:char.id, source:'ai_moment', cover:pickWechatCharMomentCover(char), comments:[], pending:[], createdAt:Date.now() };
        char.chatConfig = char.chatConfig || {};
        const oldMoments = Array.isArray(char.chatConfig.aiMoments) ? char.chatConfig.aiMoments : [];
        let saved = false;
        try {
            saveWechatMomentStore({ ...store, posts:[...store.posts,post] });
            char.chatConfig.aiMoments = [...oldMoments,{ id:post.id, text, source:'ai_moment', createdAt:post.createdAt }];
            if (await saveCharactersToStorage() === false) throw new Error('朋友圈未能保存角色资料');
            saved = true;
        } finally {
            if (!saved) {
                char.chatConfig.aiMoments = (char.chatConfig.aiMoments || []).filter(item => item.id !== post.id);
                try { const latest = getWechatMomentStore(); saveWechatMomentStore({ ...latest, posts:latest.posts.filter(item => item.id !== post.id) }); }
                catch (rollbackError) { console.warn('朋友圈保存回滚失败',rollbackError); }
            }
        }
        if (isWechatMomentsScreenOpen()) renderWechatMoments();
        return true;
    } catch (error) { console.warn('角色朋友圈动态未发布',error); return false; }
    finally { pendingWechatCharMoments.delete(char.id); }
}

function findWechatContactByNameOrId(value, exceptId = '') {
    const query = String(value || '').trim();
    if (!query) return null;
    return (window.myCharacters || []).find(item => {
        if (!item || item.id === exceptId || item.isGroupChat) return false;
        const display = getWechatCharDisplayName(item);
        return item.id === query || item.name === query || display === query || (item.chatConfig && item.chatConfig.nickname === query);
    }) || null;
}

function applyWechatContactDeleteDirective(rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const target = findWechatContactByNameOrId(args[0] || '', char.id);
    const reason = args.slice(1).join('|').trim();
    if (!target) return null;
    const request = {
        id: `delete_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        targetId: target.id,
        targetName: getWechatCharDisplayName(target),
        reason,
        requestedAt: Date.now()
    };
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.pendingContactDeleteRequest = request;
    setTimeout(() => showWechatContactDeleteRequestModal(char.id, request.id), 0);
    return {
        type: 'system_notice',
        isMe: false,
        contactDeleteRequestId: request.id,
        content: reason
            ? `${getWechatCharDisplayName(char)}想要删除「${request.targetName}」：${reason}`
            : `${getWechatCharDisplayName(char)}想要删除「${request.targetName}」`,
        timestamp: createMessageTimestamp()
    };
}

function showWechatContactDeleteRequestModal(charId, requestId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const request = char?.chatConfig?.pendingContactDeleteRequest;
    if (!char || !request || request.id !== requestId) return;
    const host = getWechatModalRoot();
    let modal = document.getElementById('wc-contact-delete-request');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-contact-delete-request';
        modal.className = 'wc-modal-overlay wc-contact-delete-request hidden';
        host.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="wc-monitor-request-card wc-contact-delete-card">
            <div class="wc-monitor-request-head">
                <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div><strong>${wcEscapeHtml(getWechatCharDisplayName(char))}</strong><span>联系人删除请求</span></div>
            </div>
            <p>${wcEscapeHtml(getWechatCharDisplayName(char))} 想要从你的联系人列表里删除「${wcEscapeHtml(request.targetName)}」。${request.reason ? wcEscapeHtml(request.reason) : ''}</p>
            <div class="wc-monitor-request-actions">
                <button type="button" onclick="rejectWechatContactDeleteRequest(${quoteWechatJsString(charId)}, ${quoteWechatJsString(requestId)})">不允许</button>
                <button type="button" class="primary danger" onclick="approveWechatContactDeleteRequest(${quoteWechatJsString(charId)}, ${quoteWechatJsString(requestId)})">允许删除</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function rejectWechatContactDeleteRequest(charId, requestId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (char?.chatConfig?.pendingContactDeleteRequest?.id === requestId) delete char.chatConfig.pendingContactDeleteRequest;
    saveCharactersToStorage();
    document.getElementById('wc-contact-delete-request')?.classList.add('hidden');
    showWechatToast('已拒绝删除联系人');
}

function approveWechatContactDeleteRequest(charId, requestId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const request = char?.chatConfig?.pendingContactDeleteRequest;
    if (!char || !request || request.id !== requestId) return;
    const targetName = request.targetName;
    window.myCharacters = (window.myCharacters || []).filter(c => c.id !== request.targetId);
    delete char.chatConfig.pendingContactDeleteRequest;
    saveCharactersToStorage();
    document.getElementById('wc-contact-delete-request')?.classList.add('hidden');
    renderChatList();
    renderContacts();
    showWechatToast(`已删除 ${targetName}`);
}
window.approveWechatContactDeleteRequest = approveWechatContactDeleteRequest;
window.rejectWechatContactDeleteRequest = rejectWechatContactDeleteRequest;
window.applyWechatCharMomentDirective = applyWechatCharMomentDirective;

function applyWechatCharBlacklistDirective(rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const reason = args.join('|').trim();
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.charBlacklistedUser = true;
    char.chatConfig.charBlacklistReason = reason || '';
    return {
        type: 'system_notice',
        isMe: false,
        content: reason
            ? `${getWechatCharDisplayName(char)}把你拉黑了：${reason}`
            : `${getWechatCharDisplayName(char)}把你拉黑了`,
        timestamp: createMessageTimestamp()
    };
}

function parseWechatAiMessageParts(text, char) {
    const source = normalizeWechatRegexPayloadSource(cleanWechatVisibleContent(text), char);
    if (!source) return [];
    if (/^\]\s*$/.test(source)) return [];
    if (shouldDropWechatAiPipeStatusPayload(source, char)) return [];
    const looseStickerMsg = buildWechatLooseStickerDirectiveMessageFromText(source, char);
    if (looseStickerMsg && looseStickerMsg.content) {
        return [{ kind: 'special', msg: looseStickerMsg }];
    }
    if (isWechatStandaloneRichOrRegexSource(source, char) && !hasWechatAiDirectiveSource(source)) {
        return [{ kind: 'text', content: source }];
    }

    const parts = [];
    const events = getWechatAiParseEvents(source);
    if (!events.length) {
        appendWechatPlainAiTextParts(parts, source, char);
        return parts.length ? parts : splitWechatOfflinePlainText(source, char);
    }

    let lastIndex = 0;
    events.forEach((event, eventIndex) => {
        if (event.start < lastIndex) return;
        const before = source.slice(lastIndex, event.start).trim();
        if (before) appendWechatPlainAiTextParts(parts, before, char);

        if (event.type === 'rich') {
            const rich = source.slice(event.start, event.end).trim();
            if (rich) parts.push({ kind: 'text', content: rich });
            lastIndex = event.end;
            return;
        }

        if (event.standaloneNarration) {
            const nextStart = events[eventIndex + 1] ? events[eventIndex + 1].start : source.length;
            appendWechatNarrationContentParts(parts, source.slice(event.end, nextStart), char);
            lastIndex = nextStart;
            return;
        }

        appendWechatDirectivePart(parts, event.command, event.args, char);
        lastIndex = event.end;
    });

    const after = source.slice(lastIndex).trim();
    if (after) appendWechatPlainAiTextParts(parts, after, char);
    return parts.length ? parts : splitWechatOfflinePlainText(source, char);
}

function getWechatRecentUserCallRequest(char) {
    if (!char || char.isGroupChat || !Array.isArray(char.history)) return null;
    const chunks = [];
    for (let i = char.history.length - 1; i >= 0 && chunks.length < 4; i -= 1) {
        const msg = char.history[i];
        if (!msg || isWechatHiddenChatSurfaceMessage(msg)) continue;
        if (!msg.isMe) break;
        const text = getWechatTextMessageVisibleText(msg, char) || msg.content || msg.description || '';
        if (text) chunks.unshift(String(text));
    }
    const text = cleanWechatVisibleContent(chunks.join(' ')).replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const asksCall = /(?:视频|语音)?(?:通话|电话)|打(?:个|一通)?(?:视频|语音|电话)|给我打|打给我|拨给我|连麦/i.test(text);
    if (!asksCall) return null;
    const type = /视频|摄像头|露脸|看看你|看你|见你/i.test(text)
        ? 'videoCall'
        : (/语音|电话|通话|连麦/i.test(text) ? 'voiceCall' : null);
    return type ? { type, text } : null;
}

function buildWechatImplicitCallFromAiText(text, char) {
    const request = getWechatRecentUserCallRequest(char);
    if (!request) return null;
    const source = cleanWechatVisibleContent(text).replace(/\s+/g, ' ').trim();
    if (!source || source.length > 34) return null;
    if (/(?:不|别|没法|不能|不要|拒绝|算了|等一下|等等|先别).{0,8}(?:打|接|通话|电话|视频|语音)/i.test(source)) return null;
    const agreesToCall = /^(?:行|好|好吧|可以|嗯|那好|别急|等我|马上|现在|这就|来了|来啦)?[，,。\s]*(?:我|这边|现在)?(?:给你)?(?:打|拨|开|发起|呼)(?:给你|过去|一个|视频|语音|电话|通话)?(?:了|啦|吧|。|！|!|~|～)?$/i.test(source)
        || /(?:我|这边|现在|马上|这就).{0,6}(?:给你)?(?:打|拨|开|发起)(?:视频|语音|电话|通话)?/i.test(source)
        || /(?:视频|语音|电话|通话).{0,6}(?:打|拨|开|发起).{0,6}(?:给你|过去)/i.test(source);
    if (!agreesToCall) return null;
    const command = request.type === 'videoCall' ? '微信视频电话' : '微信语音电话';
    return buildWechatMessageFromAiDirective(command, source || request.text, char);
}

