function renderWechatAiPhoneSection(title, icon, items, emptyText = '暂无记录') {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    return `
        <section class="wc-ai-phone-ios-card">
            <h4><i class="${icon}"></i>${wcEscapeHtml(title)}</h4>
            ${list.length
                ? list.map(item => `<p>${wcEscapeHtml(item)}</p>`).join('')
                : `<p>${wcEscapeHtml(emptyText)}</p>`}
        </section>
    `;
}

function getWechatAiPhoneInitial(name) {
    const source = String(name || '').trim();
    return wcEscapeHtml(source ? Array.from(source)[0] : '聊');
}

function getWechatAiPhoneMessageText(msg) {
    if (!msg) return '';
    if (isWechatRegexPayloadMessage(msg)) return '';
    if (msg.type === 'image_stack') return msg.description || `[${getWechatImageStackSources(msg).length || 0}张图片]`;
    if (msg.type === 'image') return msg.description || '[图片]';
    if (msg.type === 'sticker') return msg.stickerName ? `[表情：${msg.stickerName}]` : '[表情]';
    if (msg.type === 'voice') return msg.transcript || msg.description || '[语音]';
    if (msg.type === 'music_card') {
        const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
        const title = music.title || msg.title || '音乐';
        const artist = music.artist || msg.artist || '';
        return `[音乐卡片] ${title}${artist ? ` - ${artist}` : ''}`;
    }
    if (msg.type && msg.type !== 'text') {
        const synced = (typeof syncWechatMessageDescription === 'function')
            ? syncWechatMessageDescription({ ...msg })
            : msg;
        return synced.description || synced.content || msg.description || msg.content || `[${msg.type}]`;
    }
    return stripWechatPromptText(getWechatMessagePromptContent(msg), 120) || msg.content || '';
}

function renderWechatAiPhoneInlineEmojiHtml(text) {
    const source = String(text || '');
    const marker = /\[\[(WECHAT_EMOJI|QQ_EMOJI):([^:\]]+)(?::([^\]]+))?\]\]/g;
    let html = '';
    let cursor = 0;
    let match;
    while ((match = marker.exec(source))) {
        html += wcEscapeHtml(source.slice(cursor, match.index));
        const parsed = parseWechatBuiltinEmojiMarker(match[0]);
        const url = parsed && (parsed.url || (parsed.source === 'qq'
            ? getQqBuiltinEmojiUrlByName(parsed.name)
            : getWechatBuiltinEmojiUrlByName(parsed.name)));
        if (url) {
            const label = parsed.source === 'qq' ? parsed.name : getWechatBuiltinEmojiAliasName(parsed.name);
            html += `<img class="wc-ai-phone-inline-emoji" src="${wcEscapeAttr(url)}" alt="[${wcEscapeAttr(label)}]" title="${wcEscapeAttr(label)}" draggable="false">`;
        } else {
            html += wcEscapeHtml(parsed && parsed.name ? `[表情：${parsed.name}]` : '');
        }
        cursor = marker.lastIndex;
    }
    return html + wcEscapeHtml(source.slice(cursor));
}

function resolveWechatAiPhoneSticker(item, char) {
    const msg = item && item.msg ? item.msg : {};
    if (msg.type === 'sticker' && msg.content) {
        return {
            url: msg.content,
            name: msg.stickerName || msg.name || '表情',
            emoji: !!(msg.emoji || msg.stickerKind === 'wechatEmoji' || isWechatBuiltinEmojiUrl(msg.content))
        };
    }
    const raw = String((item && item.text) || msg.content || msg.description || '').trim();
    const match = raw.match(/^\s*[\[【](?:微信表情|表情|发送了表情)\s*[：:]\s*([\s\S]+?)[\]】]\s*$/);
    if (!match) return null;
    const args = splitWechatDirectiveArgs(match[1] || '');
    const query = args[0] || match[1] || '';
    const explicit = args.slice(1).join('|').trim();
    const sticker = (typeof findWechatStickerForAi === 'function')
        ? findWechatStickerForAi(char, query, explicit)
        : null;
    if (!sticker || !sticker.url) return null;
    return {
        url: sticker.url,
        name: sticker.name || query || '表情',
        emoji: !!(sticker.emoji || sticker.source === 'wechatEmoji' || sticker.source === 'qqEmoji' || isWechatBuiltinEmojiUrl(sticker.url))
    };
}

function renderWechatAiPhoneMiniSticker(item, char) {
    const sticker = resolveWechatAiPhoneSticker(item, char);
    if (!sticker) return '';
    const emojiClass = sticker.emoji ? ' is-emoji' : '';
    return `
        <div class="wc-ai-phone-mini-sticker${emojiClass}">
            <img src="${wcEscapeHtml(sticker.url)}" alt="${wcEscapeHtml(sticker.name || '表情')}" loading="lazy" onerror="this.closest('.wc-ai-phone-mini-sticker')?.classList.add('is-broken');this.remove()">
            <span>${wcEscapeHtml(sticker.name || '表情')}</span>
            ${item.time ? `<time>${wcEscapeHtml(item.time)}</time>` : ''}
        </div>
    `;
}

function renderWechatAiPhoneMiniMusicCard(item) {
    const msg = item.msg || {};
    const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
    const title = music.title || msg.title || '音乐';
    const artist = music.artist || msg.artist || '未知歌手';
    const source = music.sourceName || music.source || 'BYND Music';
    return `
        <div class="wc-ai-phone-mini-music-card">
            <div class="wc-ai-phone-mini-music-cover"><i class="ri-music-2-fill"></i></div>
            <div class="wc-ai-phone-mini-music-main">
                <strong>${wcEscapeHtml(title)}</strong>
                <span>${wcEscapeHtml(artist)}</span>
                <em>${wcEscapeHtml(source)}</em>
            </div>
            <button type="button" aria-label="播放音乐"><i class="ri-play-fill"></i></button>
            ${item.time ? `<time>${wcEscapeHtml(item.time)}</time>` : ''}
        </div>
    `;
}

function renderWechatAiPhoneMiniImage(item) {
    const msg = (item && item.msg) || {};
    const imageUrl = msg.content || msg.imageUrl || msg.url || '';
    const label = stripWechatPromptText(msg.imagePending
        ? '图片生成中'
        : (msg.imageError || msg.description || item.text || '图片'), 42);
    const imageHtml = imageUrl
        ? `<img src="${wcEscapeHtml(imageUrl)}" alt="${wcEscapeHtml(label)}" loading="lazy" onerror="this.closest('.wc-ai-phone-mini-image')?.classList.add('is-broken');this.remove()">`
        : `<div class="wc-ai-phone-mini-image-placeholder"><i class="ri-image-line"></i><span>${wcEscapeHtml(label)}</span></div>`;
    return `
        <div class="wc-ai-phone-mini-image ${msg.imagePending ? 'is-pending' : ''} ${msg.imageError ? 'is-error' : ''}">
            ${imageHtml}
            ${label && !imageUrl ? '' : `<span>${wcEscapeHtml(label)}</span>`}
            ${item.time ? `<time>${wcEscapeHtml(item.time)}</time>` : ''}
        </div>
    `;
}

function renderWechatAiPhoneMessageContent(item, char) {
    if (item.type === 'image') return renderWechatAiPhoneMiniImage(item);
    if (item.type === 'music_card') return renderWechatAiPhoneMiniMusicCard(item);
    const stickerHtml = renderWechatAiPhoneMiniSticker(item, char);
    if (stickerHtml) return stickerHtml;
    return `
        <p>${renderWechatAiPhoneInlineEmojiHtml(item.text)}</p>
        ${item.time ? `<time>${wcEscapeHtml(item.time)}</time>` : ''}
    `;
}

function renderWechatAiPhoneChatRows(snapshot, char) {
    const chats = Array.isArray(snapshot.chats)
        ? snapshot.chats.filter((item, index) => index === 0 || !isWechatAiPhonePlaceholderChatRow(item))
        : [];
    if (!chats.length) return '<div class="wc-ai-phone-empty">还没有聊天记录</div>';
    return chats.map((item, index) => `
        <button type="button" class="wc-ai-phone-chat-row" onclick="switchWechatAiPhoneChat(${index})">
            <div class="wc-ai-phone-chat-avatar ${index === 0 ? 'primary' : ''}">${getWechatAiPhoneInitial(item.name)}</div>
            <div class="wc-ai-phone-chat-main">
                <strong>${wcEscapeHtml(item.name || '联系人')}</strong>
                <span>${renderWechatAiPhoneInlineEmojiHtml(item.text || ' ')}</span>
            </div>
            <em>${wcEscapeHtml(item.time || '')}</em>
            <i class="ri-arrow-right-s-line"></i>
        </button>
    `).join('');
}

