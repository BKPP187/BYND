// 2. 修复切换开场白导致微信也变的问题 (数据分离)
function switchGreeting(direction) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    const allGreetings = [char.first_mes_original || char.first_mes, ...(char.alternates || [])].filter(t => t);
    
    if (typeof char.currentGreetingIndex === 'undefined') char.currentGreetingIndex = 0;

    let newIndex = char.currentGreetingIndex + direction;
    if (newIndex < 0) newIndex = allGreetings.length - 1; 
    if (newIndex >= allGreetings.length) newIndex = 0; 

    // 🔥 核心修改：只更新“索引”，绝对不去改 history 里的内容！
    // 微信读取的是 history，所以微信永远不变。
    // 当前问候语索引会影响角色开场白。
    char.currentGreetingIndex = newIndex;
    
    // 注意：这里不再调用 openChat 刷新微信，因为微信不需要变
}

function createMessageTimestamp() {
    return Date.now();
}

function padWechatDatePart(value) {
    return String(value).padStart(2, '0');
}

function toWechatDatetimeLocalValue(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return `${safeDate.getFullYear()}-${padWechatDatePart(safeDate.getMonth() + 1)}-${padWechatDatePart(safeDate.getDate())}T${padWechatDatePart(safeDate.getHours())}:${padWechatDatePart(safeDate.getMinutes())}`;
}

function formatWechatDateTimeForPrompt(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${safeDate.getFullYear()}年${safeDate.getMonth() + 1}月${safeDate.getDate()}日 ${weekdays[safeDate.getDay()]} ${padWechatDatePart(safeDate.getHours())}:${padWechatDatePart(safeDate.getMinutes())}`;
}

function getWechatCurrentTimeContext(char) {
    const config = (char && char.chatConfig) || {};
    const mode = config.timeMode === 'virtual' ? 'virtual' : 'real';
    const rawTime = mode === 'virtual' ? config.virtualTime : null;
    const date = rawTime ? new Date(rawTime) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return {
        mode,
        label: mode === 'virtual' ? '虚拟时间' : '真实世界时间',
        text: formatWechatDateTimeForPrompt(safeDate),
        iso: safeDate.toISOString()
    };
}

function ensureMessageTimestamp(msg) {
    if (!msg.timestamp && !msg.createdAt && !msg.time) {
        msg.timestamp = createMessageTimestamp();
        // A display fallback for imported history is not a known send time.
        msg.timestampEstimated = true;
        return true;
    }
    return false;
}

function getWechatHistoryVersionKey(char) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const last = history[history.length - 1] || {};
    const lastText = String(last.content || last.description || last.dialogue || last.text || '');
    return [
        WECHAT_HISTORY_REPAIR_SCHEMA_VERSION,
        char && char.id || '',
        history.length,
        last.id || '',
        last.timestamp || last.createdAt || last.time || '',
        last.type || '',
        last.isMe ? '1' : '0',
        lastText.length
    ].join('|');
}

function ensureWechatHistoryTimestamps(char) {
    if (!char || !Array.isArray(char.history)) return false;
    window._wechatTimestampCheckKeys = window._wechatTimestampCheckKeys || new Map();
    const beforeKey = getWechatHistoryVersionKey(char);
    if (window._wechatTimestampCheckKeys.get(char.id) === beforeKey) return false;
    let touched = false;
    char.history.forEach(msg => {
        if (ensureMessageTimestamp(msg)) touched = true;
    });
    window._wechatTimestampCheckKeys.set(char.id, getWechatHistoryVersionKey(char));
    return touched;
}

function scheduleWechatChatListRefresh() {
    clearTimeout(window._wechatChatListRefreshTimer);
    window._wechatChatListRefreshTimer = setTimeout(() => {
        renderChatList();
    }, 80);
}

function formatMessageTime(msg) {
    const rawTime = msg.timestamp || msg.createdAt || msg.time;
    const date = rawTime ? new Date(rawTime) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return `${String(safeDate.getHours()).padStart(2, '0')}:${String(safeDate.getMinutes()).padStart(2, '0')}`;
}

function formatWechatCoupleMessageDateTime(msg) {
    const rawTime = msg && (msg.timestamp || msg.createdAt || msg.time);
    const date = rawTime ? new Date(rawTime) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const now = new Date();
    const dateText = safeDate.getFullYear() === now.getFullYear()
        ? `${safeDate.getMonth() + 1}月${safeDate.getDate()}日`
        : `${safeDate.getFullYear()}年${safeDate.getMonth() + 1}月${safeDate.getDate()}日`;
    return {
        date: dateText,
        time: `${String(safeDate.getHours()).padStart(2, '0')}:${String(safeDate.getMinutes()).padStart(2, '0')}`
    };
}

function getWechatCoupleMessageSenderKey(msg, char = null) {
    if (!msg || msg.type === 'system_notice') return '';
    if (msg.isMe) return 'me';
    return String(
        msg.senderId
        || msg.speakerId
        || msg.senderName
        || msg.speakerName
        || (char && char.isGroupChat ? 'group-member' : 'ai')
    );
}

function shouldShowWechatCoupleMessageHeader(prevMsg, msg, char = null) {
    if (!isWechatCoupleTheme()) return true;
    if (!msg || msg.type === 'system_notice') return true;
    if (!prevMsg || prevMsg.type === 'system_notice') return true;
    if (getWechatCoupleMessageSenderKey(prevMsg, char) !== getWechatCoupleMessageSenderKey(msg, char)) return true;
    const raw = msg.timestamp || msg.createdAt || msg.time;
    const prevRaw = prevMsg.timestamp || prevMsg.createdAt || prevMsg.time;
    const date = raw ? new Date(raw) : null;
    const prevDate = prevRaw ? new Date(prevRaw) : null;
    if (!date || !prevDate || Number.isNaN(date.getTime()) || Number.isNaN(prevDate.getTime())) return false;
    if (date.toDateString() !== prevDate.toDateString()) return true;
    return date.getTime() - prevDate.getTime() >= 10 * 60 * 1000;
}

function buildMessageMeta(msg) {
    const readIcon = '<i class="ri-check-double-line"></i>';
    return `<span class="msg-meta ${msg.isMe ? 'read' : 'delivered'}"><span>${formatMessageTime(msg)}</span>${readIcon}</span>`;
}

function isWechatRegexPayloadMessage(msg, char = null) {
    if (!msg || msg.isMe || msg.type === 'system_notice') return false;
    if (!['text', 'offline_narration'].includes(msg.type || 'text')) return false;
    const source = cleanWechatVisibleContent(msg.content || msg.description || msg.dialogue || msg.text || '');
    if (!source) return false;
    return isWechatStandaloneRichOrRegexSource(source, char) || shouldDropWechatAiPipeStatusPayload(source, char);
}
window.isWechatRegexPayloadMessage = isWechatRegexPayloadMessage;

function isWechatHiddenChatSurfaceMessage(msg) {
    return !!(msg && (msg.hiddenFromChat || msg.internalEvent || msg.monitorEvent));
}

function getWechatLastChatMessage(char) {
    const history = Array.isArray(char?.history) ? char.history : [];
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg && msg.type !== 'system_notice' && !isWechatHiddenChatSurfaceMessage(msg) && !isWechatRegexPayloadMessage(msg, char)) return msg;
    }
    return null;
}

function formatTelegramChatListTime(char) {
    const msg = getWechatLastChatMessage(char);
    const raw = msg && (msg.timestamp || msg.createdAt || msg.time);
    if (!raw) return '现在';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '现在';
    const now = new Date();
    const sameDay = date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
    if (sameDay) return `${padWechatDatePart(date.getHours())}:${padWechatDatePart(date.getMinutes())}`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getTelegramChatUnreadCount(char) {
    if (!char) return 0;
    if (typeof isWechatChatPageActive === 'function' && isWechatChatPageActive(char.id)) return 0;
    if (isWechatQQGroupBlocked(char)) return 0;
    const explicit = Number(char?.unreadCount ?? char?.chatConfig?.unreadCount ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return Math.min(999, Math.floor(explicit));
    const history = Array.isArray(char?.history) ? char.history : [];
    const lastReadAt = Number(char?.chatConfig?.lastReadAt) || 0;
    let count = 0;
    if (lastReadAt > 0) {
        history.forEach(msg => {
            if (!msg || msg.type === 'system_notice' || msg.isMe) return;
            if (isWechatHiddenChatSurfaceMessage(msg)) return;
            if (isWechatRegexPayloadMessage(msg, char)) return;
            if (getWechatMessageTimestampValue(msg) > lastReadAt) count += 1;
        });
    } else {
        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            if (!msg || msg.type === 'system_notice') continue;
            if (isWechatHiddenChatSurfaceMessage(msg)) continue;
            if (msg.isMe) break;
            if (isWechatRegexPayloadMessage(msg, char)) continue;
            count += 1;
        }
    }
    return Math.min(999, count);
}


function getWechatMessageDate(msg) {
    const raw = msg && (msg.timestamp || msg.createdAt || msg.time);
    const date = raw ? new Date(raw) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildWechatCollectedAtText(msg) {
    const rawTime = msg.collectedAt || msg.timestamp || msg.createdAt || msg.time;
    return rawTime ? `已于 ${formatMessageTime({ timestamp: rawTime })} 收取` : '已收取';
}

function getWechatMessagePlainSummary(msg, maxLength = 92) {
    const raw = getWechatMessageSummary(msg)
        .replace(/<[^>]+>/g, '')
        .replace(/\|\|\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!raw) return '[消息]';
    return raw.length > maxLength ? raw.slice(0, maxLength - 1) + '…' : raw;
}

function isWechatReplyMediaSource(value) {
    const text = String(value || '').trim();
    if (!text || text.length > 2048) return false;
    return /^(?:data:image\/|blob:|https?:\/\/|assets\/|\.{0,2}\/assets\/|\/assets\/)/i.test(text)
        || /\.(?:png|jpe?g|gif|webp|avif|svg)(?:[?#].*)?$/i.test(text);
}

function isWechatReplyMediaTextLeak(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    return /^(?:data:image\/|blob:|https?:\/\/|assets\/|\.{0,2}\/assets\/|\/assets\/)/i.test(text)
        || /\.(?:png|jpe?g|gif|webp|avif|svg)(?:[?#].*)?$/i.test(text);
}

function getWechatReplySourceMessage(replyTo, char) {
    if (!replyTo || !char || !Array.isArray(char.history)) return null;
    const history = char.history;
    const replyId = String(replyTo.msgId || '').trim();
    if (replyId) {
        const byId = history.find(msg => String(msg && msg.id || '') === replyId);
        if (byId) return byId;
    }
    const idx = Number(replyTo.msgIdx);
    if (Number.isInteger(idx) && idx >= 0 && idx < history.length) {
        return history[idx] || null;
    }
    return null;
}

function getWechatReplyMedia(replyTo, char) {
    if (!replyTo) return null;
    const sourceMsg = getWechatReplySourceMessage(replyTo, char);
    const sourceType = String((sourceMsg && sourceMsg.type) || replyTo.type || '').toLowerCase();
    const sourceUrl = sourceMsg && sourceMsg.content;
    if (sourceType === 'sticker' && isWechatReplyMediaSource(sourceUrl)) {
        return {
            type: 'sticker',
            url: sourceUrl,
            label: sourceMsg.stickerName || sourceMsg.name || replyTo.stickerName || replyTo.name || '表情',
            emoji: !!(sourceMsg.emoji || sourceMsg.stickerKind === 'wechatEmoji' || isWechatBuiltinEmojiUrl(sourceUrl))
        };
    }
    if (sourceType === 'image' && isWechatReplyMediaSource(sourceUrl)) {
        return {
            type: 'image',
            url: sourceUrl,
            label: sourceMsg.description || replyTo.text || '图片'
        };
    }
    if (sourceType === 'image_stack') {
        const first = getWechatImageStackSources(sourceMsg || replyTo)[0] || '';
        if (isWechatReplyMediaSource(first)) {
            return {
                type: 'image',
                url: first,
                label: sourceMsg?.description || replyTo.text || '多张图片'
            };
        }
    }
    const directUrl = replyTo.mediaUrl || replyTo.stickerUrl || replyTo.imageUrl || replyTo.url || replyTo.content;
    if ((sourceType === 'sticker' || sourceType === 'image') && isWechatReplyMediaSource(directUrl)) {
        return {
            type: sourceType,
            url: directUrl,
            label: replyTo.stickerName || replyTo.name || replyTo.text || (sourceType === 'sticker' ? '表情' : '图片'),
            emoji: !!replyTo.emoji
        };
    }
    const textUrl = replyTo.text;
    if ((sourceType === 'sticker' || sourceType === 'image') && isWechatReplyMediaSource(textUrl)) {
        return {
            type: sourceType,
            url: textUrl,
            label: sourceType === 'sticker' ? '表情' : '图片',
            emoji: !!replyTo.emoji
        };
    }
    return null;
}

function getWechatReplyDisplayText(replyTo, media) {
    if (media && media.type === 'sticker') return '';
    const fallbackText = media
        ? (media.label || '[图片]')
        : '[消息]';
    const rawText = String(replyTo && replyTo.text || '').trim();
    if (!rawText) return fallbackText;
    if (media && isWechatReplyMediaTextLeak(rawText)) return fallbackText;
    return rawText;
}

function getWechatMessageSenderName(msg, char) {
    if (msg && msg.isMe) {
        const profile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : ((typeof getUserProfile === 'function') ? getUserProfile() : null);
        return (profile && profile.name) || '我';
    }
    if (char?.isGroupChat) {
        const explicit = msg && (msg.senderName || msg.speakerName);
        const member = msg && findWechatGroupMember(char, msg.senderId || msg.speakerId || explicit);
        if (member) return getWechatQQGroupMemberDisplayName(char, member);
        if (explicit) return explicit;
        const normalized = normalizeWechatGroupSpeechText(msg && msg.content, char);
        if (normalized.member) return getWechatQQGroupMemberDisplayName(char, normalized.member);
    }
    return getWechatCharDisplayName(char);
}

function getWechatDouyinReplyMentionName(replyTo, char) {
    if (!replyTo) return '';
    const fallback = replyTo.isMe ? getWechatDisplayUserName() : getWechatCharDisplayName(char);
    return String(replyTo.sender || fallback || '')
        .replace(/^@+/, '')
        .trim()
        .slice(0, 24);
}

function renderWechatDouyinSelfSenderLabel(char) {
    const profile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : ((typeof getUserProfile === 'function') ? getUserProfile() : {});
    const name = String((profile && profile.name) || getWechatDisplayUserName() || '我').trim();
    if (!name) return '';
    return `<div class="msg-douyin-self-name">${wcEscapeHtml(name)}</div>`;
}

function renderWechatXChatProfileIntro(char) {
    if (!char || !isWechatXTheme()) return '';
    const name = wcEscapeHtml(getWechatCharDisplayName(char));
    const avatar = wcEscapeHtml(char.avatar || DEFAULT_AVATAR);
    const handleSource = getWechatContactId(char) || String(char.name || 'contact').replace(/\s+/g, '').slice(0, 18) || 'contact';
    const handle = wcEscapeHtml(handleSource.startsWith('@') ? handleSource : `@${handleSource}`);
    const createdAt = char.importedAt || char.createdAt || char.addedAt || Date.now();
    const date = new Date(createdAt);
    const joined = Number.isNaN(date.getTime())
        ? '加入于今天'
        : `加入于 ${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    return `
        <div class="wc-x-chat-profile-intro" onclick="openWechatContactProfile(${quoteWechatJsString(char.id)})">
            <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
            <strong>${name}</strong>
            <span>${handle}</span>
            <em>${wcEscapeHtml(joined)}</em>
            <button type="button" onclick="event.stopPropagation();openWechatContactProfile(${quoteWechatJsString(char.id)})">查看个人资料</button>
        </div>
    `;
}

function buildWechatReplySnapshot(msg, char, msgIdx) {
    if (!msg) return null;
    const type = msg.type || 'text';
    const snapshot = {
        msgId: msg.id || '',
        msgIdx: Number.isInteger(msgIdx) ? msgIdx : null,
        isMe: !!msg.isMe,
        sender: getWechatMessageSenderName(msg, char),
        text: getWechatMessagePlainSummary(msg, 120),
        type,
        timestamp: msg.timestamp || msg.createdAt || msg.time || ''
    };
    if (type === 'music_card') {
        const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
        snapshot.title = music.title || msg.title || '音乐';
        snapshot.artist = music.artist || msg.artist || '';
        snapshot.artwork = music.artwork || msg.artwork || '';
    }
    if (type === 'image_stack') {
        const first = getWechatImageStackSources(msg)[0] || '';
        if (first) snapshot.mediaUrl = first;
    }
    if ((type === 'sticker' || type === 'image') && isWechatReplyMediaSource(msg.content)) {
        snapshot.mediaUrl = msg.content;
        if (type === 'sticker') {
            snapshot.stickerName = msg.stickerName || msg.name || '';
            snapshot.emoji = !!(msg.emoji || msg.stickerKind === 'wechatEmoji' || isWechatBuiltinEmojiUrl(msg.content));
        }
    }
    return snapshot;
}

function renderWechatMessageQuote(replyTo, char) {
    if (!replyTo) return '';
    if (typeof getWechatUiThemeId === 'function' && getWechatUiThemeId() === 'qq') {
        return renderWechatQqMessageQuote(replyTo, char);
    }
    const media = getWechatReplyMedia(replyTo, char);
    const senderText = replyTo.sender || (replyTo.isMe ? '我' : '对方');
    const sender = wcEscapeHtml(senderText);
    const sourceMsg = getWechatReplySourceMessage(replyTo, char);
    const sourceType = String((sourceMsg && sourceMsg.type) || replyTo.type || '').toLowerCase();
    if (sourceType === 'music_card') {
        const music = (sourceMsg && sourceMsg.music && typeof sourceMsg.music === 'object') ? sourceMsg.music : {};
        const title = music.title || sourceMsg?.title || replyTo.title || getWechatReplyDisplayText(replyTo, media).replace(/^\[音乐卡片\]\s*/, '') || '音乐';
        const artist = music.artist || sourceMsg?.artist || replyTo.artist || '';
        const artwork = music.artwork || sourceMsg?.artwork || replyTo.artwork || '';
        return `
            <div class="msg-quote msg-quote-music">
                <div class="msg-quote-music-art">${artwork ? `<img src="${wcEscapeHtml(artwork)}" alt="" loading="lazy" onerror="this.remove()">` : '<i class="ri-music-2-fill"></i>'}</div>
                <div class="msg-quote-music-main">
                    <span>音乐卡片</span>
                    <strong>${wcEscapeHtml(title)}</strong>
                    ${(artist || senderText) ? `<em>${wcEscapeHtml(artist || senderText)}</em>` : ''}
                </div>
                <button type="button" class="msg-quote-music-play" aria-label="播放音乐"><i class="ri-play-fill"></i></button>
                <div class="msg-quote-music-footer"><span>一起听歌</span></div>
            </div>
        `;
    }
    const displayText = getWechatReplyDisplayText(replyTo, media);
    const text = wcEscapeHtml(displayText);
    if (media && media.url) {
        const mediaClass = `msg-quote-image ${media.type === 'sticker' ? 'sticker' : 'image'}${media.emoji ? ' emoji' : ''}`;
        const quoteClass = `msg-quote has-media is-${media.type}${media.emoji ? ' is-emoji' : ''}`;
        return `
            <div class="${quoteClass}">
                <div class="msg-quote-media">
                    <img class="${mediaClass}" src="${wcEscapeHtml(media.url)}" alt="${wcEscapeHtml(media.label || '表情')}" loading="lazy" onerror="this.closest('.msg-quote-media')?.classList.add('is-broken');this.remove()">
                </div>
                <div class="msg-quote-caption">
                    <strong>${sender}</strong>
                    ${displayText ? `<span>${text}</span>` : ''}
                </div>
            </div>
        `;
    }
    return `<div class="msg-quote"><strong>${sender}</strong><span>${text}</span></div>`;
}

function shouldRenderWechatExternalQuote() {
    return typeof getWechatUiThemeId === 'function' && getWechatUiThemeId() === 'wechat';
}

function renderWechatQqMessageQuote(replyTo, char) {
    if (!replyTo) return '';
    const sourceMsg = getWechatReplySourceMessage(replyTo, char);
    const senderText = String(replyTo.sender || (replyTo.isMe ? '我' : '对方')).trim() || '对方';
    const quoteText = getWechatExternalQuoteText(replyTo, char);
    const timeText = formatMessageTime(sourceMsg || replyTo);
    return `
        <div class="msg-quote msg-quote-qq">
            <div class="msg-quote-qq-head">
                <strong>${wcEscapeHtml(senderText)}</strong>
                <time>${wcEscapeHtml(timeText)}</time>
                <i class="ri-arrow-up-line" aria-hidden="true"></i>
            </div>
            <span>${wcEscapeHtml(quoteText)}</span>
        </div>
    `;
}

function highlightWechatRednoteMentions(html) {
    return String(html || '').replace(/(^|[\s>])(@[^\s<：:，,。！？!?、]{0,24})/gu, (match, lead, mention) => {
        if (!mention || mention === '@') return `${lead}<span class="msg-rednote-mention">@</span>`;
        return `${lead}<span class="msg-rednote-mention">${mention}</span>`;
    });
}

function isWechatQqNumericLinkText(text) {
    const clean = String(text || '').replace(/\s+/g, '');
    return /^\p{N}+$/u.test(clean);
}

function getWechatExternalQuoteText(replyTo, char) {
    const media = getWechatReplyMedia(replyTo, char);
    const sourceMsg = getWechatReplySourceMessage(replyTo, char);
    const sourceType = String((sourceMsg && sourceMsg.type) || replyTo?.type || '').toLowerCase();
    if (sourceType === 'music_card') {
        const music = sourceMsg && sourceMsg.music && typeof sourceMsg.music === 'object' ? sourceMsg.music : {};
        return music.title || sourceMsg?.title || replyTo?.title || getWechatReplyDisplayText(replyTo, media).replace(/^\[音乐卡片\]\s*/, '') || '音乐';
    }
    if (media && media.type === 'sticker') return media.label || '表情';
    if (media && media.type === 'image') return getWechatReplyDisplayText(replyTo, media) || '图片';
    return getWechatReplyDisplayText(replyTo, media) || '消息';
}

function renderWechatExternalMessageQuote(replyTo, char) {
    if (!replyTo) return '';
    const senderText = String(replyTo.sender || (replyTo.isMe ? '我' : '对方')).trim() || '对方';
    const text = getWechatExternalQuoteText(replyTo, char);
    return `<div class="msg-wechat-quote"><strong>${wcEscapeHtml(senderText)}:</strong><span>${wcEscapeHtml(text)}</span></div>`;
}

function findWechatMessageForAiQuote(char, query) {
    if (!char || !Array.isArray(char.history) || !char.history.length) return null;
    const history = char.history;
    const options = (arguments.length > 2 && arguments[2] && typeof arguments[2] === 'object') ? arguments[2] : {};
    const raw = String(query || '').trim();
    if (/^\d+$/.test(raw)) {
        const index = Math.max(0, Math.min(history.length - 1, parseInt(raw, 10) - 1));
        return { msg: history[index], index };
    }
    const normalized = raw.replace(/^(?:最后|上一条|最近|last)$/i, '').trim();
    if (!normalized) {
        for (let i = history.length - 1; i >= 0; i -= 1) {
            const msg = history[i];
            if (i === options.excludeIndex || msg === options.excludeMessage) continue;
            if (msg && msg.type !== 'system_notice' && msg.isMe && !isWechatAiQuoteDirectiveLeakMessage(msg)) return { msg, index: i };
        }
    }
    const queryKey = normalizeWechatQuoteSearchText(normalized);
    if (isWechatMusicQuoteQuery(normalized, queryKey)) {
        for (let i = history.length - 1; i >= 0; i -= 1) {
            const msg = history[i];
            if (i === options.excludeIndex || msg === options.excludeMessage) continue;
            if (!msg || msg.type !== 'music_card' || isWechatAiQuoteDirectiveLeakMessage(msg)) continue;
            if (isWechatGenericMusicQuoteQuery(normalized, queryKey)) return { msg, index: i };
            const summary = getWechatMessagePlainSummary(msg, 180);
            const summaryKeys = getWechatQuoteSearchKeys(msg, summary);
            if (summary.includes(normalized) || summaryKeys.some(key => key && (key.includes(queryKey) || (queryKey.includes(key) && key.length >= 4)))) {
                return { msg, index: i };
            }
        }
    }
    for (let i = history.length - 1; i >= 0; i -= 1) {
        const msg = history[i];
        if (i === options.excludeIndex || msg === options.excludeMessage) continue;
        if (!msg || msg.type === 'system_notice') continue;
        if (isWechatAiQuoteDirectiveLeakMessage(msg)) continue;
        const summary = getWechatMessagePlainSummary(msg, 180);
        if (!normalized || summary.includes(normalized) || getWechatMessageSenderName(msg, char).includes(normalized)) {
            return { msg, index: i };
        }
        if (!queryKey) continue;
        const summaryKeys = getWechatQuoteSearchKeys(msg, summary);
        if (summaryKeys.some(key => key && (key.includes(queryKey) || (queryKey.includes(key) && key.length >= 4)))) {
            return { msg, index: i };
        }
    }
    return null;
}

function normalizeWechatQuoteSearchText(value) {
    let source = cleanWechatVisibleContent(value)
        .replace(/^[\[【](?:微信引用|引用)\s*[：:]\s*/i, '')
        .replace(/[\]】]\s*$/i, '')
        .replace(/^\s*(?:🎵|🎶|♫|♪)+\s*/u, '')
        .replace(/^\s*[\[【](?:音乐卡片|音乐|music card)[\]】]\s*/i, '')
        .replace(/^(?:音乐卡片|音乐|music card)\s*[：:]\s*/i, '')
        .trim();
    if (!source) return '';
    try {
        source = source.normalize('NFKC').toLowerCase();
        return source.replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
    } catch (_) {
        return source.toLowerCase().replace(/[^\u3400-\u9fff\w]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
}

function getWechatQuoteSearchKeys(msg, summary) {
    const keys = [normalizeWechatQuoteSearchText(summary)];
    if (msg && msg.type === 'music_card') {
        const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
        const title = music.title || msg.title || '';
        const artist = music.artist || msg.artist || '';
        keys.push(
            normalizeWechatQuoteSearchText(title),
            normalizeWechatQuoteSearchText(artist),
            normalizeWechatQuoteSearchText(`${title} ${artist}`)
        );
    }
    return Array.from(new Set(keys.filter(Boolean)));
}

function isWechatGenericMusicQuoteQuery(raw, normalized) {
    const source = cleanWechatVisibleContent(raw).toLowerCase();
    const key = String(normalized || normalizeWechatQuoteSearchText(raw));
    return /^(?:音乐|音乐卡片|歌曲|歌|这首歌|那首歌|这首|那首|music|song|track|bgm)$/i.test(source)
        || /^(?:音乐|音乐卡片|歌曲|歌|这首歌|那首歌|这首|那首|music|song|track|bgm)$/i.test(key)
        || /(?:这首|那首|泰语歌|音乐卡片|music card)/i.test(source);
}

function isWechatMusicQuoteQuery(raw, normalized) {
    const source = cleanWechatVisibleContent(raw);
    const key = String(normalized || normalizeWechatQuoteSearchText(raw));
    return isWechatGenericMusicQuoteQuery(source, key)
        || /(?:音乐|歌曲|歌|music|song|track|bgm)/i.test(source)
        || /(?:音乐|歌曲|歌|music|song|track|bgm)/i.test(key);
}

function isWechatAiQuoteDirectiveLeakMessage(msg) {
    const raw = cleanWechatVisibleContent((msg && (msg.content || msg.description)) || '');
    if (/^\s*[\[【]微信引用\s*[：:]/.test(raw)) return true;
    const replyText = cleanWechatVisibleContent(msg && msg.replyTo && (msg.replyTo.text || msg.replyTo.content));
    return /^\s*[\[【]微信引用\s*[：:]/.test(replyText);
}

function parseWechatAiQuoteDirectiveText(value) {
    const source = cleanWechatVisibleContent(value);
    if (!source) return null;
    const start = Math.min(
        ...['[微信引用', '【微信引用'].map(token => source.indexOf(token)).filter(index => index >= 0)
    );
    if (!Number.isFinite(start)) return null;
    const event = readWechatAiDirectiveAt(source, start);
    if (!event || event.command !== '微信引用') return null;
    const args = splitWechatDirectiveArgs(event.args);
    const query = args[0] || '';
    const content = args.slice(1).join('|').trim();
    return query || content ? { query, content } : null;
}

function buildWechatFallbackReplySnapshotFromAiQuote(query) {
    const text = cleanWechatVisibleContent(query)
        .replace(/^(?:最后|上一条|最近|last)$/i, '')
        .trim()
        .slice(0, 120);
    if (!text) return null;
    return {
        msgId: '',
        msgIdx: null,
        isMe: true,
        sender: getWechatDisplayUserName(),
        text,
        type: 'text',
        timestamp: createMessageTimestamp()
    };
}

function appendWechatTimeDivider(container, date) {
    if (!container) return;
    const divider = document.createElement('div');
    divider.className = 'msg-row time';
    divider.innerHTML = `<div class="msg-time-divider">${wcEscapeHtml(formatWechatDateTimeDivider(date))}</div>`;
    container.appendChild(divider);
}

function formatWechatDateTimeDivider(date) {
    const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const today = new Date();
    const isSameDay = safeDate.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dayText = isSameDay
        ? ''
        : (safeDate.toDateString() === yesterday.toDateString()
            ? '昨天 '
            : `${safeDate.getMonth() + 1}月${safeDate.getDate()}日 `);
    return `${dayText}${String(safeDate.getHours()).padStart(2, '0')}:${String(safeDate.getMinutes()).padStart(2, '0')}`;
}

function shouldShowWechatTimeDivider(prevMsg, msg) {
    const raw = msg && (msg.timestamp || msg.createdAt || msg.time);
    const date = raw ? new Date(raw) : new Date();
    if (Number.isNaN(date.getTime())) return false;
    if (!prevMsg) return true;
    const prevRaw = prevMsg.timestamp || prevMsg.createdAt || prevMsg.time;
    const prevDate = prevRaw ? new Date(prevRaw) : null;
    if (!prevDate || Number.isNaN(prevDate.getTime())) return true;
    const gap = date.getTime() - prevDate.getTime();
    if (gap >= 10 * 60 * 1000) return true;
    return date.getMinutes() === 0 && date.getHours() !== prevDate.getHours();
}

function parseWechatRgbColor(value) {
    const text = String(value || '').trim();
    if (!text || text === 'transparent') return null;
    const rgba = text.match(/^rgba?\(([^)]+)\)$/i);
    if (rgba) {
        const parts = rgba[1].split(',').map(part => parseFloat(part.trim()));
        if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
            const alpha = Number.isFinite(parts[3]) ? parts[3] : 1;
            if (alpha <= 0.02) return null;
            return { r: parts[0], g: parts[1], b: parts[2], a: alpha };
        }
    }
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        const raw = hex[1].length === 3
            ? hex[1].split('').map(ch => ch + ch).join('')
            : hex[1];
        return {
            r: parseInt(raw.slice(0, 2), 16),
            g: parseInt(raw.slice(2, 4), 16),
            b: parseInt(raw.slice(4, 6), 16),
            a: 1
        };
    }
    return null;
}

function getWechatColorLuminance(color) {
    const channel = value => {
        const normalized = Math.max(0, Math.min(255, value)) / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function findWechatPaintedBackground(el) {
    let current = el;
    while (current && current.nodeType === 1) {
        const style = getComputedStyle(current);
        const bg = parseWechatRgbColor(style.backgroundColor);
        if (bg) return bg;
        const imageColor = String(style.backgroundImage || '').match(/rgba?\([^)]+\)|#[0-9a-f]{3,6}/i);
        if (imageColor) {
            const parsed = parseWechatRgbColor(imageColor[0]);
            if (parsed) return parsed;
        }
        current = current.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
}

function applyWechatBubbleMetaContrast(scope) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;
    scope.querySelectorAll('.msg-bubble').forEach(bubble => {
        const color = findWechatPaintedBackground(bubble);
        const isDark = getWechatColorLuminance(color) < 0.48;
        bubble.style.setProperty('--msg-meta-color', isDark ? 'rgba(255,255,255,0.78)' : 'rgba(23,33,43,0.50)');
        bubble.style.setProperty('--msg-meta-icon-color', isDark ? 'rgba(255,255,255,0.88)' : '#4aa3ff');
    });
    scope.querySelectorAll('.msg-meta').forEach(meta => {
        const source = meta.closest('.msg-card-footer') || meta.closest('.msg-bubble') || meta;
        const color = findWechatPaintedBackground(source);
        const isDark = getWechatColorLuminance(color) < 0.48;
        const metaColor = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(23,33,43,0.50)';
        const iconColor = isDark ? 'rgba(255,255,255,0.88)' : '#4aa3ff';
        meta.style.setProperty('color', metaColor, 'important');
        meta.querySelectorAll('i').forEach(icon => icon.style.setProperty('color', iconColor, 'important'));
    });
}

function isRichMessageContent(content) {
    const source = String(content || '');
    return /```(?:html|xml|markdown)?\s*[\s\S]*?```/i.test(source)
        || /<\s*\/?\s*(?:div|style|script|table|iframe|img|span|section|header|article|button|ul|ol|li|p|video|audio|svg|canvas)\b/i.test(source)
        || /<\s*\/?\s*[a-z][\w:-]*\b[^>]*>/i.test(source);
}

function isWechatRichCardContent(content) {
    // Markdown produces inline tags and <br>; only authored layouts bypass the speech bubble.
    return /<\s*(?:!doctype|html|body|div|section|article|header|footer|main|aside|nav|style|script|table|iframe|img|video|audio|svg|canvas|form|details|button|input|textarea|select|ul|ol)\b/i.test(String(content || ''));
}

function cleanWechatVisibleContent(value, options = {}) {
    const externalCleaner = typeof window.cleanChatApiVisibleContent === 'function'
        ? window.cleanChatApiVisibleContent
        : null;
    let text = externalCleaner ? externalCleaner(value) : String(value == null ? '' : value);
    if (!text) return '';

    const hiddenTags = [
        'thinking',
        'think',
        'thought',
        'execute_think',
        'cot',
        'analysis',
        'reasoning',
        'chain_of_thought'
    ];

    for (let pass = 0; pass < 4; pass += 1) {
        const before = text;
        hiddenTags.forEach(tag => {
            text = text.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
        });
        if (text === before) break;
    }

    text = text
        .replace(/<\/?(?:thinking|think|thought|execute_think|cot|analysis|reasoning|chain_of_thought)\b[^>]*>/gi, '')
        .replace(/<content\b[^>]*>([\s\S]*?)<\/content>/gi, '$1')
        .replace(/<\/?content\b[^>]*>/gi, '');

    if (options.stripExecutableCodeBlocks !== false) {
        text = text.replace(/```(?:html|xml|markdown|json)?\s*[\s\S]*?(?:setChatMessages|document\.getElementById|<script\b|<style\b)[\s\S]*?```/gi, '');
    }

    return text
        .replace(/^\s*(?:思考完毕[，,。；;：:]?\s*)+/i, '')
        .replace(/^\s*(?:生成回复[，,。；;：:]?\s*)+/i, '')
        .trim();
}

function isWechatAiMetaLeakContent(value) {
    const text = cleanWechatVisibleContent(value)
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return true;
    if (/^[|‖｜\s]+$/.test(text)) return true;
    if (/^(?:<\/?[a-z][\w-]*\s*\/?>\s*)+$/i.test(text)) return true;
    if (/^\[(?:语音通话|视频通话)\]\s*(?:角色发起，用户处理|用户发起，角色处理)；结果：/i.test(text)) return true;
    if (/^[-\s]*[（(]?自检[）)]?\s*$/i.test(text)) return true;
    if (/^[-\s]*(?:\[?(?:消息|状态栏|狀態欄|状态|狀態|自检|自檢|内心OS|思考|反思|判断|行动|计划|策略)\]?)[：:]/i.test(text)) return true;
    if (/^[-\s]*(?:符合.+人设吗|符合当前情境吗|解决用户问题了吗)[？?]/i.test(text)) return true;
    if (/^[-\s]*(?:是的|否|已|未)[，,、\s]*(?:嘴硬|有掌控欲|行动上会关心|回复简短|解释了|准备回去|解释用户问题|符合.+人设|符合当前情境)/i.test(text)) return true;
    if (/^(?:The soul now awakens|Janus,|I MUST start every response|Process \(|\[Process\d|Archive compression mode)/i.test(text)) return true;
    return false;
}

function wcEscapeHtml(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value == null ? '' : String(value));
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function wcEscapeAttr(value) {
    return wcEscapeHtml(value)
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

function quoteWechatJsString(value) {
    const json = JSON.stringify(String(value == null ? '' : value)
    )
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    return json
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
}

function getWechatCssUrl(value) {
    const safe = String(value == null ? '' : value)
        .replace(/'/g, '%27')
        .replace(/"/g, '%22')
        .replace(/\)/g, '%29')
        .replace(/[\r\n]/g, '');
    return `url('${wcEscapeHtml(safe)}')`;
}

function isWechatSpecialMessage(type) {
    return ['voice', 'transfer', 'redpacket', 'voiceCall', 'videoCall', 'share_card', 'gift', 'intimatePay', 'poke', 'screen_shake', 'music_card', 'link_card', 'tool_result'].includes(type);
}

function normalizeWechatUrl(value) {
    let raw = String(value || '').trim();
    raw = raw.replace(/[，。；、\s]+$/g, '');
    if (!raw) return '';
    if (/^www\./i.test(raw)) raw = `https://${raw}`;
    if (!/^https?:\/\//i.test(raw)) return '';
    return raw.replace(/^http:\/\//i, 'https://');
}

function extractWechatFirstUrl(value) {
    const source = String(value || '');
    const match = source.match(/https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+/i);
    return match ? normalizeWechatUrl(match[0]) : '';
}

function parseWechatAmountNumber(value) {
    const num = parseFloat(String(value || '').replace(/[^\d.]/g, ''));
    return Number.isFinite(num) && num > 0 ? num : null;
}

function normalizeWechatAmount(value, fallback = '0.00') {
    const num = parseWechatAmountNumber(value);
    if (num == null) return fallback;
    return num.toFixed(2);
}

function normalizeWechatDuration(value, fallback) {
    const num = parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(num) || num <= 0) return fallback;
    return Math.min(num, 5999);
}

function isWechatDurationArg(value) {
    return /^\s*\d+\s*(?:秒|s|S)?\s*$/.test(String(value || ''));
}

function formatWechatDuration(seconds) {
    const sec = normalizeWechatDuration(seconds, 1);
    if (sec < 60) return `${sec}秒`;
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return rest ? `${min}分${String(rest).padStart(2, '0')}秒` : `${min}分钟`;
}

function estimateWechatVoiceDuration(text) {
    const source = String(text || '').trim();
    if (!source) return 1;
    const cjkCount = (source.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
    const asciiText = source.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ');
    const wordTokens = (asciiText.match(/[A-Za-z0-9]+/g) || [])
        .reduce((sum, word) => sum + Math.max(1, Math.ceil(word.length / 4)), 0);
    const punctuationTokens = Math.ceil(((source.match(/[，。！？、,.!?;；:：]/g) || []).length) * 0.35);
    const tokenCount = Math.max(1, cjkCount + wordTokens + punctuationTokens);
    return Math.max(1, Math.min(90, Math.ceil(tokenCount / 3.8)));
}

function updateWechatVoiceDurationEstimate() {
    const transcript = document.getElementById('wc-compose-transcript')?.value || '';
    const duration = estimateWechatVoiceDuration(transcript);
    const label = document.getElementById('wc-compose-duration-estimate');
    if (label) label.textContent = `${duration}"`;
}

function toggleWechatVoiceTranscript(bubbleEl) {
    if (!bubbleEl || !bubbleEl.querySelector('.msg-voice-transcript')) return;
    bubbleEl.classList.toggle('show-transcript');
}

function toggleWechatVoiceMessage(bubbleEl) {
    if (!bubbleEl) return;
    const audio = bubbleEl.querySelector('audio');
    if (!audio || !audio.getAttribute('src')) {
        toggleWechatVoiceTranscript(bubbleEl);
        return;
    }
    document.querySelectorAll('.msg-voice-bubble.is-playing').forEach(item => {
        if (item === bubbleEl) return;
        const otherAudio = item.querySelector('audio');
        if (otherAudio) otherAudio.pause();
        item.classList.remove('is-playing');
        item.querySelector('.msg-voice-play-state i')?.classList.replace('ri-pause-mini-fill', 'ri-play-mini-fill');
    });
    const icon = bubbleEl.querySelector('.msg-voice-play-state i');
    if (!audio.paused && !audio.ended) {
        audio.pause();
        bubbleEl.classList.remove('is-playing');
        icon?.classList.replace('ri-pause-mini-fill', 'ri-play-mini-fill');
        return;
    }
    audio.onended = () => {
        bubbleEl.classList.remove('is-playing');
        icon?.classList.replace('ri-pause-mini-fill', 'ri-play-mini-fill');
    };
    audio.play().then(() => {
        bubbleEl.classList.add('is-playing');
        icon?.classList.replace('ri-play-mini-fill', 'ri-pause-mini-fill');
    }).catch(() => {
        bubbleEl.classList.remove('is-playing');
        icon?.classList.replace('ri-pause-mini-fill', 'ri-play-mini-fill');
        if (typeof showWechatToast === 'function') showWechatToast('语音播放失败');
    });
}

function getWechatCallDescription(msg) {
    const status = msg.status || '已结束';
    const duration = parseInt(msg.duration, 10);
    const rawReason = msg.reason || msg.note || '';
    const direction = msg.callDirection || msg.direction || (msg.isMe ? 'outgoing' : 'incoming');
    let displayStatus = status;
    if (status === '已拒绝') {
        displayStatus = direction === 'incoming' ? '你已拒绝' : '对方已拒绝';
    } else if (status === '未接通') {
        displayStatus = direction === 'incoming' ? '未接通' : '对方未接通';
    } else if (status === '已取消') {
        displayStatus = direction === 'incoming' ? '对方已取消' : '已取消';
    } else if (status === '对方已挂断') {
        displayStatus = '对方已挂断';
    }
    const reason = rawReason && rawReason !== displayStatus ? rawReason : '';
    if ((status === '已结束' || status === '对方已挂断') && Number.isFinite(duration) && duration > 0) {
        return reason ? `${displayStatus} · ${formatWechatDuration(duration)} · ${reason}` : `${displayStatus} · ${formatWechatDuration(duration)}`;
    }
    return reason ? `${displayStatus} · ${reason}` : displayStatus;
}

function getWechatMessageSummary(msg) {
    if (!msg) return '[消息]';
    if (isWechatRegexPayloadMessage(msg)) return '[状态更新]';
    if (msg.description && msg.type !== 'voiceCall' && msg.type !== 'videoCall') return msg.description;
    if (msg.type === 'sticker') {
        const name = msg.stickerName || msg.name || '';
        return name ? `[表情] ${name}` : '[表情]';
    }
    if (msg.type === 'image') {
        return msg.description || '[图片]';
    }
    if (msg.type === 'voice') {
        const text = msg.transcript ? ` ${msg.transcript}` : '';
        return `[语音 ${formatWechatDuration(msg.duration || 8)}]${text}`;
    }
    if (msg.type === 'transfer') {
        const note = msg.note ? ` ${msg.note}` : '';
        if (msg.returned || msg.status === '已退回') return `[已退回转账 ¥${normalizeWechatAmount(msg.amount)}]${note}`;
        return msg.receipt ? `[已收取转账 ¥${normalizeWechatAmount(msg.amount)}]${note}` : `[转账 ¥${normalizeWechatAmount(msg.amount)}]${note}`;
    }
    if (msg.type === 'redpacket') {
        const title = msg.title || msg.note || '恭喜发财，大吉大利';
        const status = msg.status ? ` ${msg.status}` : '';
        if (msg.returned || msg.status === '已退回') return `[已退回红包] ${title}`;
        return msg.receipt ? `[已收取红包] ${title}` : `[红包${status}] ${title}`;
    }
    if (msg.type === 'gift') {
        const item = msg.item && typeof msg.item === 'object' ? msg.item : {};
        const name = item.name || msg.title || '礼物';
        const status = msg.status ? ` ${msg.status}` : '';
        return msg.receipt ? `[已收取礼物] ${name}` : `[礼物${status}] ${name}`;
    }
    if (msg.type === 'intimatePay') {
        const status = msg.status ? ` ${msg.status}` : '';
        return `[亲密付${status}] ${msg.note || '邀请开通'}`;
    }
    if (msg.type === 'poke') {
        return `[拍一拍] ${msg.content || msg.note || '拍了拍对方'}`;
    }
    if (msg.type === 'screen_shake') {
        return `[震动屏幕] ${msg.content || msg.note || '发送了一次屏幕震动'}`;
    }
    if (msg.type === 'music_card') {
        const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
        const title = music.title || msg.title || '音乐';
        const artist = music.artist || msg.artist || '';
        return `[音乐卡片] ${title}${artist ? ` - ${artist}` : ''}`;
    }
    if (msg.type === 'link_card') {
        const title = msg.title || msg.url || '链接';
        return `[链接] ${title} ${msg.url || ''}`.trim();
    }
    if (msg.type === 'tool_result') {
        return String(msg.summary || msg.content || '[工具结果]');
    }
    if (msg.type === 'voiceCall') {
        return `[语音通话] ${getWechatCallDescription(msg)}`;
    }
    if (msg.type === 'videoCall') {
        return `[视频通话] ${getWechatCallDescription(msg)}`;
    }
    if (msg.type === 'share_card') {
        const card = msg.card && typeof msg.card === 'object' ? msg.card : {};
        const title = card.title || msg.title || '转发';
        const text = card.text || msg.text || msg.content || '';
        return `[${title}] ${String(text || '').replace(/<[^>]+>/g, '').slice(0, 80)}`;
    }
    return String(msg.content || '[消息]');
}

function syncWechatMessageDescription(msg) {
    if (!msg) return msg;
    if (msg.type === 'share_card') {
        msg.description = getWechatMessageSummary({ ...msg, description: '' });
        return msg;
    }
    if (isWechatSpecialMessage(msg.type)) {
        msg.description = getWechatMessageSummary({ ...msg, description: '' });
        if (msg.type === 'poke' || msg.type === 'screen_shake' || msg.type === 'music_card' || msg.type === 'link_card') {
            if (!msg.content && msg.note) msg.content = msg.note;
        } else if (!msg.content || msg.type !== 'voice') {
            msg.content = msg.description;
        }
    }
    return msg;
}

function getWechatTextMessageVisibleText(msg, charObj = null) {
    if (!msg || isWechatSpecialMessage(msg.type) || msg.type === 'system_notice') return '[special]';
    const source = cleanWechatVisibleContent(msg.content || msg.description || msg.dialogue || msg.text || '');
    if (!source || isWechatAiMetaLeakContent(source)) return '';
    const char = charObj || getCurrentChatChar?.();
    if (!msg.isMe && isWechatGroupSystemActionEchoContent(source, char)) return '';
    if (
        isRichMessageContent(source)
        || looksLikeWechatRegexPayloadSource(source)
        || looksLikeWechatPipeStatusPayloadSource(source)
        || willWechatRegexRenderRich(source, char)
        || isWechatStandaloneRichOrRegexSource(source, char)
    ) {
        return source;
    }
    const rendered = processMsgContent(source, char);
    return String(rendered || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function isWechatGroupSystemActionEchoContent(text, group) {
    if (!group?.isGroupChat) return false;
    const compact = cleanWechatVisibleContent(text)
        .replace(/[「」『』“”"'`]/g, '')
        .replace(/\s+/g, '')
        .replace(/[。.!！?？]+$/g, '');
    if (!compact || compact.length > 80) return false;
    return /^(?:[^，、：:]{1,24})?(?:已)?将[^，、：:]{1,24}(?:设置为|设为|升为)群?管理员$/.test(compact)
        || /^(?:[^，、：:]{1,24})?(?:修改|更改|改了?|把).{0,8}群(?:聊)?名(?:称)?(?:为|成|改为).{1,32}$/.test(compact)
        || /^(?:[^，、：:]{1,24})?将群(?:聊)?名(?:称)?从.{1,32}改为.{1,32}$/.test(compact);
}

function isWechatRenderableMessage(msg, charObj = null) {
    if (!msg) return false;
    if (msg.hiddenFromChat || msg.internalEvent) return false;
    if (msg.type === 'system_notice') return true;
    if (isWechatSpecialMessage(msg.type) || msg.type === 'image' || msg.type === 'image_stack' || msg.type === 'sticker') return true;
    return !!getWechatTextMessageVisibleText(msg, charObj);
}

function pruneWechatEmptyAiTextMessages(char) {
    if (!char || !Array.isArray(char.history)) return false;
    const before = char.history.length;
    char.history = char.history.filter(msg => msg?.isMe || isWechatRenderableMessage(msg, char));
    return char.history.length !== before;
}

function getWechatLinkHost(url) {
    try {
        return new URL(normalizeWechatUrl(url)).hostname.replace(/^www\./i, '');
    } catch (_) {
        return String(url || '').replace(/^https?:\/\//i, '').split('/')[0] || '链接';
    }
}

function getWechatBuiltinEmojiAliasName(name) {
    const text = String(name || '').trim();
    const lower = text.toLowerCase();
    const aliases = {
        '发': '發',
        '發': '發',
        'emm': 'Emm',
        'ok': 'OK'
    };
    return aliases[text] || aliases[lower] || text;
}

function getWechatActiveBuiltinEmojiSource() {
    return getWechatUiThemeId() === 'qq' ? 'qq' : 'wechat';
}

function buildWechatBuiltinEmojiMarker(name, source = getWechatActiveBuiltinEmojiSource(), url = '') {
    const markerSource = source === 'qq' ? 'QQ_EMOJI' : 'WECHAT_EMOJI';
    const label = source === 'qq' ? String(name || '').trim() : getWechatBuiltinEmojiAliasName(name);
    if (!label) return '';
    return `[[${markerSource}:${encodeURIComponent(label)}${url ? `:${encodeURIComponent(url)}` : ''}]]`;
}

function parseWechatBuiltinEmojiMarker(text) {
    const match = String(text || '').trim().match(/^\[\[(WECHAT_EMOJI|QQ_EMOJI):([^:\]]+)(?::([^\]]+))?\]\]$/);
    if (!match) return null;
    const decode = value => {
        try {
            return decodeURIComponent(value || '');
        } catch (_) {
            return value || '';
        }
    };
    return {
        source: match[1] === 'QQ_EMOJI' ? 'qq' : 'wechat',
        name: decode(match[2]),
        url: decode(match[3])
    };
}

function hasWechatBuiltinEmojiMarker(text) {
    return /\[\[(?:WECHAT_EMOJI|QQ_EMOJI):[^\]]+\]\]/.test(String(text || ''));
}

function getSingleWechatBuiltinEmojiMarker(text) {
    return parseWechatBuiltinEmojiMarker(text);
}

function getWechatInputEmojiDisplayToken(name) {
    const label = String(name || '').trim();
    if (!label) return '';
    if (getWechatUiThemeId() === 'qq') return `[${label}]`;
    return WECHAT_INPUT_EMOJI_MAP[label] || label;
}

function getWechatInputEmojiDraftItems() {
    if (!Array.isArray(window._wechatInputEmojiDraftItems)) window._wechatInputEmojiDraftItems = [];
    return window._wechatInputEmojiDraftItems;
}

function rememberWechatInputEmojiDraftItem(item) {
    if (!item || !item.token || !item.name) return;
    getWechatInputEmojiDraftItems().push(item);
}

function clearWechatInputEmojiDraftItems() {
    window._wechatInputEmojiDraftItems = [];
}

function prepareWechatTextWithDraftEmojis(text) {
    if (!['wechat', 'qq'].includes(getWechatUiThemeId())) return { text: String(text || ''), hasEmoji: false };
    let output = String(text || '');
    let hasEmoji = hasWechatBuiltinEmojiMarker(output);
    getWechatInputEmojiDraftItems().forEach(item => {
        if (!item || !item.token || !item.name) return;
        const index = output.indexOf(item.token);
        if (index < 0) return;
        const marker = buildWechatBuiltinEmojiMarker(item.name, item.source || getWechatActiveBuiltinEmojiSource(), item.url || '');
        if (!marker) return;
        output = output.slice(0, index) + marker + output.slice(index + item.token.length);
        hasEmoji = true;
    });
    return { text: output, hasEmoji };
}

function getWechatRichInputElement() {
    return document.getElementById('wc-rich-msg-input');
}

function isWechatRichInputEnabled() {
    return ['wechat', 'qq'].includes(getWechatUiThemeId()) && !!getWechatRichInputElement();
}

function isWechatMobileKeyboardContext() {
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile|SamsungBrowser/i.test(ua)
        || (navigator.maxTouchPoints > 1 && window.matchMedia?.('(max-width: 820px)')?.matches);
}

function handleWechatMessageInputCompositionStart() {
    window._wechatInputComposing = true;
}
window.handleWechatMessageInputCompositionStart = handleWechatMessageInputCompositionStart;

function handleWechatMessageInputCompositionEnd(event) {
    window._wechatInputComposing = false;
    if (event?.target?.id === 'wc-rich-msg-input') handleWechatRichInputInput();
    else syncWechatDraftState();
}
window.handleWechatMessageInputCompositionEnd = handleWechatMessageInputCompositionEnd;

function insertWechatPlainInputLineBreak(inputEl) {
    if (!inputEl) return;
    const start = Number.isFinite(inputEl.selectionStart) ? inputEl.selectionStart : inputEl.value.length;
    const end = Number.isFinite(inputEl.selectionEnd) ? inputEl.selectionEnd : start;
    inputEl.value = `${inputEl.value.slice(0, start)}\n${inputEl.value.slice(end)}`;
    const nextPos = start + 1;
    try {
        inputEl.setSelectionRange(nextPos, nextPos);
    } catch (e) {}
    syncWechatDraftState();
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
}

function handleWechatMessageInputBeforeInput(event) {
    if (!event || !['insertLineBreak', 'insertParagraph'].includes(event.inputType)) return;
    if (event.isComposing || window._wechatInputComposing) return;
    if (window._wechatAllowNextLineBreakAt && Date.now() - window._wechatAllowNextLineBreakAt < 300) {
        window._wechatAllowNextLineBreakAt = 0;
        return;
    }
    if (!isWechatMobileKeyboardContext()) return;
    event.preventDefault();
    sendWechatMessage();
}
window.handleWechatMessageInputBeforeInput = handleWechatMessageInputBeforeInput;

function handleWechatMessageInputKeydown(event) {
    if (!event || event.key !== 'Enter') return;
    if (event.isComposing || event.keyCode === 229 || event.which === 229 || window._wechatInputComposing) return;
    if (event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.target?.id === 'wc-rich-msg-input') {
            event.preventDefault();
            insertWechatRichInputLineBreak();
            handleWechatRichInputInput();
        }
        window._wechatAllowNextLineBreakAt = Date.now();
        return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    sendWechatMessage();
}
window.handleWechatMessageInputKeydown = handleWechatMessageInputKeydown;

function isWechatSelectionInside(element) {
    const selection = window.getSelection && window.getSelection();
    if (!selection || !selection.rangeCount || !element) return false;
    const node = selection.anchorNode;
    return !!(node && (node === element || element.contains(node)));
}

function setWechatRichInputCaretAfter(node) {
    const selection = window.getSelection && window.getSelection();
    if (!selection || !node) return;
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

function syncWechatHiddenInputFromRich() {
    const inputEl = document.getElementById('wc-msg-input');
    if (!inputEl || !isWechatRichInputEnabled()) return;
    inputEl.value = getWechatMessageInputValue({ markers: false });
}

function getWechatRichInputValue(options = {}) {
    const richEl = getWechatRichInputElement();
    if (!richEl) return '';
    const useMarkers = !!options.markers;
    const readNode = node => {
        if (!node) return '';
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const el = node;
        if (el.matches && el.matches('img.wc-rich-input-emoji')) {
            const name = el.dataset.emojiName || el.getAttribute('alt') || '';
            return useMarkers
                ? buildWechatBuiltinEmojiMarker(name.replace(/^\[|\]$/g, ''), el.dataset.emojiSource || getWechatActiveBuiltinEmojiSource(), el.dataset.emojiUrl || '')
                : (el.dataset.displayToken || el.getAttribute('alt') || '');
        }
        if (el.tagName === 'BR') return '\n';
        let text = '';
        el.childNodes.forEach(child => { text += readNode(child); });
        if (['DIV', 'P'].includes(el.tagName) && text && !text.endsWith('\n')) text += '\n';
        return text;
    };
    let text = '';
    richEl.childNodes.forEach(node => { text += readNode(node); });
    return text.replace(/\n+$/g, '');
}

function getWechatMessageInputValue(options = {}) {
    if (isWechatRichInputEnabled()) return getWechatRichInputValue(options);
    const inputEl = document.getElementById('wc-msg-input');
    return inputEl ? inputEl.value : '';
}

function clearWechatMessageInput() {
    const inputEl = document.getElementById('wc-msg-input');
    const richEl = getWechatRichInputElement();
    if (inputEl) inputEl.value = '';
    if (richEl) richEl.innerHTML = '';
    clearWechatInputEmojiDraftItems();
}

function handleWechatRichInputInput() {
    syncWechatHiddenInputFromRich();
    syncWechatDraftState();
}

function insertWechatRichInputText(text) {
    const richEl = getWechatRichInputElement();
    if (!richEl) return;
    richEl.focus();
    const selection = window.getSelection && window.getSelection();
    const range = selection && selection.rangeCount && isWechatSelectionInside(richEl)
        ? selection.getRangeAt(0)
        : document.createRange();
    if (!selection || !selection.rangeCount || !isWechatSelectionInside(richEl)) {
        range.selectNodeContents(richEl);
        range.collapse(false);
    }
    range.deleteContents();
    const textNode = document.createTextNode(String(text || ''));
    range.insertNode(textNode);
    setWechatRichInputCaretAfter(textNode);
    handleWechatRichInputInput();
}

function handleWechatRichInputPaste(event) {
    if (!isWechatRichInputEnabled()) return;
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    insertWechatRichInputText(text);
}

function insertWechatRichInputEmoji(name, url = '') {
    const richEl = getWechatRichInputElement();
    const source = getWechatActiveBuiltinEmojiSource();
    const label = source === 'qq' ? String(name || '').trim() : getWechatBuiltinEmojiAliasName(name);
    const resolvedUrl = url || (source === 'qq' ? getQqBuiltinEmojiUrlByName(label) : getWechatBuiltinEmojiUrlByName(label));
    if (!richEl || !label || !resolvedUrl) return false;
    richEl.focus();
    const img = document.createElement('img');
    img.className = 'wc-rich-input-emoji';
    img.src = resolvedUrl;
    img.alt = `[${label}]`;
    img.title = label;
    img.draggable = false;
    img.dataset.emojiName = label;
    img.dataset.emojiSource = source;
    img.dataset.emojiUrl = resolvedUrl;
    img.dataset.displayToken = getWechatInputEmojiDisplayToken(name);

    const selection = window.getSelection && window.getSelection();
    const range = selection && selection.rangeCount && isWechatSelectionInside(richEl)
        ? selection.getRangeAt(0)
        : document.createRange();
    if (!selection || !selection.rangeCount || !isWechatSelectionInside(richEl)) {
        range.selectNodeContents(richEl);
        range.collapse(false);
    }
    range.deleteContents();
    range.insertNode(img);
    setWechatRichInputCaretAfter(img);
    handleWechatRichInputInput();
    return true;
}

function buildWechatUserTextMessage(text) {
    const prepared = prepareWechatTextWithDraftEmojis(text);
    const content = prepared.text;
    const singleEmoji = getSingleWechatBuiltinEmojiMarker(content);
    if (singleEmoji && singleEmoji.name) {
        const emojiUrl = singleEmoji.url || (singleEmoji.source === 'qq'
            ? getQqBuiltinEmojiUrlByName(singleEmoji.name)
            : getWechatBuiltinEmojiUrlByName(singleEmoji.name));
        return {
            type: 'sticker',
            isMe: true,
            content: emojiUrl,
            stickerName: singleEmoji.name,
            stickerKind: singleEmoji.source === 'qq' ? 'qqEmoji' : 'wechatEmoji',
            emoji: true,
            timestamp: createMessageTimestamp()
        };
    }
    const url = extractWechatFirstUrl(content);
    if (!url) return { type: 'text', isMe: true, content, wechatEmojiText: prepared.hasEmoji, timestamp: createMessageTimestamp() };
    const note = String(content || '').replace(url, '').trim();
    return syncWechatMessageDescription({
        type: 'link_card',
        isMe: true,
        url,
        title: note || getWechatLinkHost(url),
        note,
        timestamp: createMessageTimestamp()
    });
}

function triggerWechatScreenFeedback(kind = 'shake') {
    const root = document.getElementById('wechat-chat-room') || document.querySelector('.phone-screen') || document.body;
    if (root) {
        root.classList.remove('wc-screen-shake');
        void root.offsetWidth;
        root.classList.add('wc-screen-shake');
        setTimeout(() => root.classList.remove('wc-screen-shake'), 460);
    }
    if (navigator.vibrate) navigator.vibrate(kind === 'poke' ? [22, 24, 22] : [42, 28, 42, 28, 42]);
}

function openWechatLinkCard(url) {
    const safeUrl = normalizeWechatUrl(url);
    if (!safeUrl) return;
    window.open(safeUrl, '_blank', 'noopener,noreferrer');
}

