function renderWechatShareCard(msg, quoteHtml = '') {
    const card = msg.card && typeof msg.card === 'object' ? msg.card : {};
    const title = card.title || msg.title || '转发';
    const text = card.text || msg.text || msg.content || '';
    const source = card.source || msg.source || '';
    const product = card.product && typeof card.product === 'object' ? card.product : null;
    if (card.action === 'shop_pay') {
        const order = card.order && typeof card.order === 'object' ? card.order : {};
        const items = Array.isArray(order.items) ? order.items : [];
        const cover = items.find(item => item && item.image)?.image || '';
        const total = Number(order.total || 0);
        return `
            <div class="msg-bubble wc-share-product-card wc-shop-pay-card${msg.isMe ? ' green' : ''}">
                ${quoteHtml}
                <div class="wc-share-product-head"><i class="ri-bank-card-line"></i><span>购物代付请求</span></div>
                <div class="wc-share-product-main">
                    <div class="wc-share-product-thumb">${cover ? `<img src="${wcEscapeHtml(cover)}" loading="lazy" onerror="this.remove()">` : '<i class="ri-shopping-cart-2-line"></i>'}</div>
                    <div class="wc-share-product-info">
                        <strong>${wcEscapeHtml(card.title || '帮我代付这单')}</strong>
                        <span>${wcEscapeHtml(card.text || getWechatShopCartSummary(items) || '购物订单')}</span>
                        <div><em>${total > 0 ? `¥${total.toFixed(2)}` : '金额待定'}</em><b>${wcEscapeHtml(order.address ? '含收货地址' : '待补地址')}</b></div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>购物代付</span>${buildMessageMeta(msg)}</div>
            </div>
        `;
    }
    if (card.action === 'takeout_pay') {
        const order = card.order && typeof card.order === 'object' ? card.order : {};
        const total = Number(order.total || 0);
        return `
            <div class="msg-bubble wc-share-product-card wc-takeout-pay-card${msg.isMe ? ' green' : ''}">
                ${quoteHtml}
                <div class="wc-share-product-head"><i class="ri-riding-line"></i><span>外卖代点请求</span></div>
                <div class="wc-share-product-main">
                    <div class="wc-share-product-thumb"><i class="ri-restaurant-2-line"></i></div>
                    <div class="wc-share-product-info">
                        <strong>${wcEscapeHtml(order.shopName || card.title || '帮我点外卖')}</strong>
                        <span>${wcEscapeHtml(card.text || order.summary || '外卖订单')}</span>
                        <div><em>${total > 0 ? `¥${total.toFixed(2)}` : '金额待定'}</em><b>${wcEscapeHtml(order.address ? '送到地址' : '待补地址')}</b></div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>外卖代点</span>${buildMessageMeta(msg)}</div>
            </div>
        `;
    }
    if (card.action === 'screen_share') {
        return `
            <div class="msg-bubble msg-link-card${msg.isMe ? ' green' : ''}">
                ${quoteHtml}
                <div class="msg-link-main">
                    <div class="msg-link-icon"><i class="ri-cast-line"></i></div>
                    <div class="msg-link-info"><span>共享屏幕</span><strong>${wcEscapeHtml(card.title || '屏幕共享')}</strong><p>${wcEscapeHtml(text || '等待浏览器授权后共享当前标签页/屏幕。')}</p></div>
                </div>
                <div class="msg-card-footer"><span>实时共享</span>${buildMessageMeta(msg)}</div>
            </div>
        `;
    }
    if (card.action === 'product' || product) {
        const productName = product?.name || title || '商品';
        const productTag = product?.tag || card.tag || '精选好物';
        const productDesc = product?.description || text || '';
        const price = Number(product?.price || card.price || 0);
        const image = product?.image || card.image || (Array.isArray(card.images) ? card.images.find(Boolean) : '');
        return `
            <div class="msg-bubble wc-share-product-card${msg.isMe ? ' green' : ''}">
                ${quoteHtml}
                <div class="wc-share-product-head">
                    <i class="ri-shopping-bag-3-line"></i>
                    <span>${wcEscapeHtml(source || 'BYND 购物')}</span>
                </div>
                <div class="wc-share-product-main">
                    <div class="wc-share-product-thumb">
                        ${image ? `<img src="${wcEscapeHtml(image)}" loading="lazy" onerror="this.closest('.wc-share-product-thumb')?.classList.add('is-empty');this.remove()">` : '<i class="ri-store-2-line"></i>'}
                    </div>
                    <div class="wc-share-product-info">
                        <strong>${wcEscapeHtml(productName)}</strong>
                        <span>${wcEscapeHtml(productDesc || productTag)}</span>
                        <div><em>${price > 0 ? `¥${price.toFixed(2)}` : '价格待定'}</em><b>${wcEscapeHtml(productTag)}</b></div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>商品卡片</span>${buildMessageMeta(msg)}</div>
            </div>
        `;
    }
    const images = Array.isArray(card.images) ? card.images.filter(Boolean).slice(0, 4) : [];
    const imageHtml = images.length ? `
        <div class="wc-share-moment-images count-${images.length}">
            ${images.map(src => `<img src="${wcEscapeHtml(src)}" loading="lazy" onerror="this.style.display='none'">`).join('')}
        </div>
    ` : '';
    return `
        <div class="msg-bubble wc-share-moment-card${msg.isMe ? ' green' : ''}">
            ${quoteHtml}
            <div class="wc-share-moment-head">
                <i class="ri-share-forward-line"></i>
                <span>${wcEscapeHtml(title)}</span>
            </div>
            ${text ? `<div class="wc-share-moment-text">${wcEscapeHtml(text).replace(/\n/g, '<br>')}</div>` : ''}
            ${imageHtml}
            <div class="msg-card-footer"><span>${wcEscapeHtml(source || title)}</span>${buildMessageMeta(msg)}</div>
        </div>
    `;
}

function getWechatForumPostPreview(text) {
    const link = String(text || '').match(/bynd:\/\/forum\/post\/[A-Za-z0-9_%-]+/i)?.[0] || '';
    if (!link || typeof window.LivingWorld?.getPostPreview !== 'function') return null;
    const post = window.LivingWorld.getPostPreview(link);
    return post ? { ...post, link } : null;
}

function renderWechatForumPostPreview(post) {
    return `<button type="button" class="wc-forum-post-preview${post.deleted ? ' is-deleted' : ''}" onclick="LivingWorld.openPostLink('${wcEscapeAttr(post.link)}')" aria-label="打开论坛帖子：${wcEscapeAttr(post.title)}"><span class="wc-forum-post-preview-kicker"><i class="ri-discuss-line"></i> BYND 论坛 · ${wcEscapeHtml(post.community)}</span><strong>${wcEscapeHtml(post.title)}</strong>${post.excerpt ? `<span class="wc-forum-post-preview-excerpt">${wcEscapeHtml(post.excerpt)}</span>` : ''}<span class="wc-forum-post-preview-footer">${wcEscapeHtml(post.author)} <i class="ri-arrow-right-up-line" aria-hidden="true"></i></span></button>`;
}

function getWechatLiteActionContent(msg, kind) {
    const fallback = kind === 'poke'
        ? (msg.isMe ? '你拍了拍对方' : '对方拍了拍你')
        : (msg.isMe ? '你震动了对方的屏幕' : '对方震动了你的屏幕');
    let value = String(msg.note || msg.content || fallback).trim();
    const label = kind === 'poke' ? '拍一拍' : '震动屏幕';
    value = value
        .replace(new RegExp(`^\\s*(?:\\[${label}\\]|\\[${kind === 'poke' ? '拍一拍' : '屏幕震动'}\\]|\\[${kind === 'poke' ? '微信拍一拍' : '微信震动'}\\])\\s*`, 'i'), '')
        .replace(new RegExp(`^\\s*(?:${label}|\\[${label}\\])\\s*[：:]?\\s*`, 'i'), '')
        .trim();
    return value || fallback;
}

function getWechatPokeSuffix(msg, charObj = null) {
    if (typeof msg.pokeSuffix === 'string') return msg.pokeSuffix.trim().replace(/^的\s*/, '');
    let text = String(msg.note || msg.content || '').trim()
        .replace(/^(?:\[(?:微信)?拍一拍\]|【(?:微信)?拍一拍】)\s*[：:]?\s*/, '');
    const action = /^(.*?)拍(?:了|一)?拍\s*/.exec(text);
    const actor = action?.[1].trim().replace(/^[“"「]|[”"」]$/g, '');
    const knownActors = ['你', '我', '对方', 'TA', getWechatChatUserProfile(charObj).name, getWechatCharDisplayName(charObj), msg.senderName, msg.speakerName];
    if (action && (!actor || knownActors.includes(actor) || /^[“"「]/.test(text.slice(action[0].length)))) {
        text = text.slice(action[0].length);
        const targetName = msg.isMe ? getWechatCharDisplayName(charObj) : getWechatChatUserProfile(charObj).name;
        if (targetName && text.startsWith(targetName)) text = text.slice(targetName.length);
        else text = text.replace(/^(?:“[^”]*”|"[^"]*"|「[^」]*」|对方|自己|你|我|TA)\s*/i, '');
    }
    return text.trim().replace(/^[的：:]\s*/, '');
}

function getWechatPokeText(msg, charObj = null) {
    const userName = getWechatChatUserProfile(charObj).name || getWechatDisplayUserName();
    const member = !msg.isMe && charObj?.isGroupChat
        ? findWechatGroupMember(charObj, msg.senderId || msg.speakerId || msg.senderName || msg.speakerName)
        : null;
    const charName = member ? getWechatGroupMemberName(member) : getWechatCharDisplayName(charObj);
    const sender = msg.isMe ? userName : charName;
    const target = msg.isMe ? charName : userName;
    const suffix = getWechatPokeSuffix(msg, charObj);
    return `${sender}拍了拍“${target}”${suffix ? `的${suffix}` : ''}`;
}

function renderWechatPokeNotice(msg, charObj = null) {
    return `<div class="msg-time-divider msg-poke-notice">${wcEscapeHtml(getWechatPokeText(msg, charObj))}</div>`;
}

function renderWechatScreenShakeNotice(msg, charObj = null) {
    const sender = msg.isMe ? getWechatChatUserProfile(charObj).name || '你' : getWechatCharDisplayName(charObj);
    const target = msg.isMe ? getWechatCharDisplayName(charObj) : getWechatChatUserProfile(charObj).name || '你';
    const raw = getWechatLiteActionContent(msg,'screen_shake');
    const isDefault = /^(?:你震动了对方的屏幕|对方震动了你的屏幕|发来一次屏幕震动)$/.test(raw);
    return `<div class="msg-time-divider msg-poke-notice msg-shake-notice">${wcEscapeHtml(`${sender}震了震“${target}”的屏幕${isDefault ? '' : `：${raw}`}`)}</div>`;
}

function buildWechatSpecialBubble(msg, quoteHtml = '', msgIndex = -1, charObj = null) {
    const metaHtml = buildMessageMeta(msg);
    const sideClass = msg.isMe ? ' green' : '';

    if (msg.type === 'share_card') {
        return renderWechatShareCard(msg, quoteHtml);
    }

    if (msg.type === 'tool_result') {
        return window.ByndCharacterTools?.renderCard(msg, quoteHtml, metaHtml)
            || `<div class="msg-bubble${sideClass}">${quoteHtml}<div class="msg-text">${wcEscapeHtml(msg.summary || msg.content || '[工具结果]')}</div>${metaHtml}</div>`;
    }

    if (msg.type === 'poke') {
        return renderWechatPokeNotice(msg, charObj);
    }

    if (msg.type === 'screen_shake') {
        return renderWechatScreenShakeNotice(msg,charObj);
    }

    if (msg.type === 'music_card') {
        const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
        const title = music.title || msg.title || '\u4e00\u8d77\u542c\u6b4c';
        const artist = music.artist || msg.artist || '';
        const sourceUrl = normalizeWechatUrl(music.sourceAudioUrl || msg.sourceAudioUrl || '');
        const savedUrl = normalizeWechatUrl(music.playableUrl || msg.playableUrl || music.audioUrl || msg.audioUrl || music.url || msg.url || '');
        const audioUrl = (sourceUrl && isWechatMusicProxyUrl(sourceUrl)) ? sourceUrl : (savedUrl || sourceUrl);
        const artwork = music.artwork || msg.artwork || '';
        const pending = !!(music.pendingSearch || music.resolving);
        const failed = !!music.lookupFailed && !audioUrl;
        const incomingInvite = isWechatIncomingMusicInvite(msg);
        const inviteAccepted = isWechatMusicInviteAccepted(msg);
        const inviteRejected = isWechatMusicInviteRejected(msg);
        const charName = getWechatCharDisplayName(charObj);
        if (incomingInvite && !inviteAccepted) {
            const canActOnInvite = Number.isInteger(Number(msgIndex)) && Number(msgIndex) >= 0 && !inviteRejected;
            const actionHtml = inviteRejected
                ? '<span class="msg-music-invite-status">\u5df2\u62d2\u7edd\u4e00\u8d77\u542c</span>'
                : (canActOnInvite
                    ? `<button type="button" class="accept" onclick="event.stopPropagation();acceptWechatMusicInvite(${Number(msgIndex)})">\u540c\u610f\u4e00\u8d77\u542c</button><button type="button" class="reject" onclick="event.stopPropagation();rejectWechatMusicInvite(${Number(msgIndex)})">\u62d2\u7edd</button>`
                    : '<button type="button" disabled>\u7b49\u5f85\u6253\u5f00\u804a\u5929</button>');
            const helperText = inviteRejected
                ? '\u4f60\u5df2\u7ecf\u62d2\u7edd\u8fd9\u6b21\u9080\u8bf7'
                : (pending ? '\u540c\u610f\u540e\u81ea\u52a8\u627e\u53ef\u64ad\u653e\u97f3\u6e90' : (failed ? '\u5f53\u524d\u97f3\u6e90\u672a\u627e\u5230\uff0c\u53ef\u8ba9 TA \u6362\u4e00\u9996' : '\u540c\u610f\u540e\u7acb\u5373\u64ad\u653e'));
            return `
                <div class="msg-bubble msg-music-invite-card${inviteRejected ? ' rejected' : ''}${sideClass}${pending ? ' resolving' : ''}" data-audio-url="${wcEscapeHtml(audioUrl)}" data-source-url="${wcEscapeHtml(sourceUrl)}">
                    ${quoteHtml}
                    <div class="msg-music-invite-head">
                        <div class="msg-music-art">${artwork ? `<img src="${wcEscapeHtml(artwork)}" onerror="this.remove()">` : '<i class="ri-headphone-fill"></i>'}</div>
                        <div class="msg-music-main">
                            <span>${inviteRejected ? '\u5df2\u62d2\u7edd\u9080\u8bf7' : (pending ? '\u6b63\u5728\u51c6\u5907\u9080\u8bf7' : '\u4e00\u8d77\u542c\u6b4c\u9080\u8bf7')}</span>
                            <strong>${wcEscapeHtml(title)}</strong>
                            <em>${wcEscapeHtml(artist || music.sourceName || 'BYND Music')}</em>
                        </div>
                    </div>
                    <p class="msg-music-invite-copy">${wcEscapeHtml(charName)} \u60f3\u548c\u4f60\u4e00\u8d77\u542c\u8fd9\u9996\u6b4c\u3002</p>
                    <div class="msg-music-invite-actions">
                        ${actionHtml}
                        <span class="msg-music-invite-helper">${helperText}</span>
                    </div>
                    <div class="msg-card-footer"><span>\u97f3\u4e50\u9080\u8bf7</span>${metaHtml}</div>
                </div>
            `;
        }
        const cardLabel = incomingInvite ? '\u6b63\u5728\u4e00\u8d77\u542c' : (pending ? '\u6b63\u5728\u627e\u6b4c' : (failed ? '\u672a\u627e\u5230\u97f3\u6e90' : '\u97f3\u4e50\u5361\u7247'));
        const footerLabel = pending ? '\u6b63\u5728\u641c\u7d22\u53ef\u64ad\u653e\u97f3\u6e90' : (failed ? '\u9700\u8981\u6362\u4e2a\u5173\u952e\u8bcd' : (incomingInvite ? '\u5df2\u540c\u610f\u4e00\u8d77\u542c' : '\u4e00\u8d77\u542c\u6b4c'));
        return `
            <div class="msg-bubble msg-music-card${incomingInvite ? ' accepted-invite' : ''}${sideClass}${pending ? ' resolving' : ''}" data-audio-url="${wcEscapeHtml(audioUrl)}" data-source-url="${wcEscapeHtml(sourceUrl)}" data-title="${wcEscapeHtml(title)}" data-artist="${wcEscapeHtml(artist)}" data-artwork="${wcEscapeHtml(artwork)}" data-lyrics-text="${wcEscapeHtml(music.lyricsText || msg.lyricsText || '')}" data-lyrics-url="${wcEscapeHtml(music.lyricsUrl || msg.lyricsUrl || '')}" data-source-key="${wcEscapeHtml(music.sourceKey || msg.sourceKey || '')}" data-source-meta="${wcEscapeHtml(music.sourceMeta || msg.sourceMeta || '')}" data-source-name="${wcEscapeHtml(music.sourceName || msg.sourceName || '')}" role="button" tabindex="0">
                ${quoteHtml}
                <div class="msg-music-art">${artwork ? `<img src="${wcEscapeHtml(artwork)}" onerror="this.remove()">` : '<i class="ri-music-2-fill"></i>'}</div>
                <div class="msg-music-main">
                    <span>${cardLabel}</span>
                    <strong>${wcEscapeHtml(title)}</strong>
                    <em>${wcEscapeHtml(artist || music.sourceName || 'BYND Music')}</em>
                </div>
                <i class="${pending ? 'ri-loader-4-line' : 'ri-play-circle-fill'} msg-music-play"></i>
                <div class="msg-card-footer"><span>${footerLabel}</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'link_card') {
        const url = normalizeWechatUrl(msg.url || msg.content || '');
        const title = msg.title || getWechatLinkHost(url) || '链接';
        const note = msg.note || msg.text || '';
        const host = getWechatLinkHost(url);
        return `
            <div class="msg-bubble msg-link-card${sideClass}" role="button" tabindex="0" onclick="event.stopPropagation();openWechatLinkCard(${quoteWechatJsString(url)})">
                ${quoteHtml}
                <div class="msg-link-main">
                    <div class="msg-link-icon"><i class="ri-links-line"></i></div>
                    <div class="msg-link-info">
                        <span>${wcEscapeHtml(host)}</span>
                        <strong>${wcEscapeHtml(title)}</strong>
                        ${note ? `<p>${wcEscapeHtml(note)}</p>` : ''}
                    </div>
                </div>
                <div class="msg-card-footer"><span>链接卡片</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'voice') {
        const duration = normalizeWechatDuration(msg.duration, 8);
        const width = Math.min(236, Math.max(110, 96 + duration * 2.2));
        const transcript = msg.transcript ? `<div class="msg-voice-transcript">${wcEscapeHtml(msg.transcript)}</div>` : '';
        const audioUrl = msg.audioUrl || msg.audioDataUrl || '';
        const audioHtml = audioUrl ? `<audio preload="metadata" src="${wcEscapeAttr(audioUrl)}"></audio>` : '';
        const playIcon = audioUrl ? '<span class="msg-voice-play-state"><i class="ri-play-mini-fill"></i></span>' : '';
        return `
            <div class="msg-bubble msg-voice-bubble${sideClass}${audioUrl ? ' has-audio' : ''}" style="--voice-width:${width}px;" onclick="event.stopPropagation();toggleWechatVoiceMessage(this)">
                ${quoteHtml}
                <div class="msg-voice-line">
                    <span class="msg-voice-waves"><b></b><b></b><b></b><b></b><b></b></span>
                    <span class="msg-voice-duration">${duration}"</span>
                    ${playIcon}
                </div>
                ${transcript}
                ${audioHtml}
                ${metaHtml}
            </div>
        `;
    }

    if (msg.type === 'transfer') {
        const amount = normalizeWechatAmount(msg.amount);
        const isReceipt = !!msg.receipt;
        const isReturned = !!msg.returned || msg.status === '已退回';
        const title = isReturned ? '已退回转账' : (isReceipt ? '已收取转账' : (msg.status === '已被领取' ? '转账已被领取' : '转账'));
        const note = isReturned
            ? buildWechatPaymentReturnedAtText(msg)
            : isReceipt
            ? (msg.note || buildWechatCollectedAtText(msg))
            : (msg.note || (msg.status === '已被领取' ? '对方已收款' : (msg.isMe ? '待对方收款' : '转账给你')));
        const footer = isReturned ? '微信转账已退回' : (isReceipt ? '微信转账已收取' : '微信转账');
        return `
            <div class="msg-bubble msg-pay-bubble msg-transfer-bubble${isReceipt ? ' msg-pay-receipt' : ''}${isReturned ? ' msg-pay-returned' : ''}${sideClass}">
                ${quoteHtml}
                <div class="msg-pay-main">
                    <div class="msg-pay-icon"><i class="${isReturned ? 'ri-refund-2-line' : 'ri-money-cny-circle-fill'}"></i></div>
                    <div class="msg-pay-info">
                        <div class="msg-pay-title">${title}</div>
                        <div class="msg-pay-amount">¥${wcEscapeHtml(amount)}</div>
                        <div class="msg-pay-note">${wcEscapeHtml(note)}</div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>${footer}</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'redpacket') {
        const title = msg.title || msg.note || '恭喜发财，大吉大利';
        const amount = msg.amount ? `<div class="msg-rp-amount">¥${wcEscapeHtml(normalizeWechatAmount(msg.amount))}</div>` : '';
        const isReceipt = !!msg.receipt;
        const isReturned = !!msg.returned || msg.status === '已退回';
        const displayStatus = isReturned ? buildWechatPaymentReturnedAtText(msg) : (isReceipt ? buildWechatCollectedAtText(msg) : (msg.status === '已被领取' ? '对方已领取' : (msg.status || '待收取')));
        return `
            <div class="msg-bubble msg-pay-bubble msg-redpacket-bubble${isReceipt ? ' msg-pay-receipt' : ''}${isReturned ? ' msg-pay-returned' : ''}${sideClass}">
                ${quoteHtml}
                <div class="msg-pay-main">
                    <div class="msg-pay-icon"><i class="${isReturned ? 'ri-refund-2-line' : 'ri-red-packet-fill'}"></i></div>
                    <div class="msg-pay-info">
                        <div class="msg-pay-title">${wcEscapeHtml(isReturned ? '已退回红包' : (isReceipt ? '已收取红包' : title))}</div>
                        ${amount}
                        <div class="msg-pay-note">${wcEscapeHtml(displayStatus)}</div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>${isReturned ? '微信红包已退回' : (isReceipt ? '微信红包已收取' : '微信红包')}</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'gift') {
        const item = msg.item && typeof msg.item === 'object' ? msg.item : {};
        const name = item.name || msg.title || '一份礼物';
        const image = item.image || msg.image || '';
        const amount = item.price || msg.amount || '';
        const isReceipt = !!msg.receipt;
        const note = isReceipt
            ? (msg.note || buildWechatCollectedAtText(msg))
            : (msg.note || item.description || (msg.isMe ? '等待对方收取' : '送给你的礼物'));
        return `
            <div class="msg-bubble msg-gift-bubble${isReceipt ? ' msg-gift-receipt' : ''}${sideClass}">
                ${quoteHtml}
                <div class="msg-gift-cover">
                    ${image ? `<img src="${wcEscapeHtml(image)}" loading="lazy" onerror="this.style.display='none'">` : '<i class="ri-gift-2-fill"></i>'}
                </div>
                <div class="msg-gift-info">
                    <span>${wcEscapeHtml(isReceipt ? '已收取礼物' : '送你一份礼物')}</span>
                    <strong>${wcEscapeHtml(name)}</strong>
                    ${amount ? `<em>¥${wcEscapeHtml(normalizeWechatAmount(amount))}</em>` : ''}
                    <p>${wcEscapeHtml(note)}</p>
                </div>
                <div class="msg-card-footer"><span>BYND 礼物</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'intimatePay') {
        const isReceipt = !!msg.receipt || msg.status === '已开通';
        const amount = msg.amount ? normalizeWechatAmount(msg.amount) : '';
        const note = msg.note || (isReceipt ? '亲密付已开通' : '邀请你开通亲密付');
        return `
            <div class="msg-bubble msg-intimate-pay-bubble${isReceipt ? ' msg-pay-receipt' : ''}${sideClass}">
                ${quoteHtml}
                <div class="msg-pay-main">
                    <div class="msg-pay-icon"><i class="ri-bank-card-fill"></i></div>
                    <div class="msg-pay-info">
                        <div class="msg-pay-title">${isReceipt ? '亲密付已开通' : '开通亲密付'}</div>
                        ${amount ? `<div class="msg-pay-amount">¥${wcEscapeHtml(amount)}</div>` : ''}
                        <div class="msg-pay-note">${wcEscapeHtml(note)}</div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>BYND 亲密付</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'voiceCall' || msg.type === 'videoCall') {
        const isVideo = msg.type === 'videoCall';
        const title = isVideo ? '视频通话' : '语音通话';
        const icon = isVideo ? 'ri-video-chat-fill' : 'ri-phone-fill';
        const desc = getWechatCallDescription(msg);
        const callAvatarHtml = charObj?.isGroupChat
            ? renderWechatCallAvatarStack(charObj, msg, 'msg-call-avatars')
            : `<div class="msg-call-icon"><i class="${icon}"></i></div>`;
        return `
            <div class="msg-bubble msg-call-bubble${sideClass}">
                ${quoteHtml}
                <div class="msg-call-main">
                    ${callAvatarHtml}
                    <div class="msg-call-info">
                        <div class="msg-call-title">${title}</div>
                        <div class="msg-call-desc">${wcEscapeHtml(desc)}</div>
                    </div>
                </div>
                ${metaHtml}
            </div>
        `;
    }

    return '';
}

function getWechatImageStackSources(msg) {
    if (!msg) return [];
    const images = Array.isArray(msg.images) ? msg.images : (Array.isArray(msg.imageUrls) ? msg.imageUrls : []);
    const list = images.length ? images : (msg.type === 'image' && msg.content ? [msg.content] : []);
    return list.map(item => String(item || '').trim()).filter(item => /^(https?:|data:image|blob:)/i.test(item)).slice(0, 18);
}

function isWechatImageStackMessage(msg) {
    return !!(msg && (msg.type === 'image_stack' || getWechatImageStackSources(msg).length > 1));
}

function isWechatStackableImageMessage(msg) {
    return !!(msg
        && msg.type === 'image'
        && msg.content
        && !msg.imagePending
        && !msg.imageError
        && !msg.replyTo
        && /^(https?:|data:image|blob:)/i.test(String(msg.content || '')));
}

function canStackWechatAdjacentImages(first, next) {
    if (!isWechatStackableImageMessage(first) || !isWechatStackableImageMessage(next)) return false;
    if (!!first.isMe !== !!next.isMe) return false;
    if ((first.senderId || first.speakerId || '') !== (next.senderId || next.speakerId || '')) return false;
    return true;
}

function buildWechatImageStackDisplayMessage(items) {
    const rows = (Array.isArray(items) ? items : []).filter(item => isWechatStackableImageMessage(item.msg));
    if (rows.length <= 1) return rows[0] && rows[0].msg;
    const first = rows[0].msg;
    const images = rows.map(item => item.msg.content);
    return {
        ...first,
        type: 'image_stack',
        content: images[0],
        imageUrl: images[0],
        images,
        imageStackItems: rows.map(item => ({
            index: item.index,
            timestamp: item.msg.timestamp || '',
            description: item.msg.description || ''
        })),
        description: first.description || `${first.isMe ? '你' : '对方'}发送了 ${images.length} 张图片`,
        timestamp: rows[rows.length - 1].msg.timestamp || first.timestamp
    };
}

function renderWechatImageStackBubble(msg, quoteHtml = '') {
    const images = getWechatImageStackSources(msg);
    if (images.length <= 1) return '';
    return `
        <div class="msg-bubble image-stack-bubble" data-count="${images.length}">
            ${quoteHtml}
            <div class="wc-image-stack" data-active="0" tabindex="0" role="group" aria-label="${wcEscapeHtml(images.length)} 张照片">
                ${images.map((src, index) => `
                    <button type="button" class="wc-image-stack-card" data-index="${index}" data-src="${wcEscapeHtml(src)}" aria-label="查看第 ${index + 1} 张照片">
                        <img src="${wcEscapeHtml(src)}" alt="照片 ${index + 1}" loading="lazy">
                    </button>
                `).join('')}
                <span class="wc-image-stack-count">1/${images.length}</span>
            </div>
            <span class="msg-media-meta">${formatMessageTime(msg)}<i class="ri-check-double-line"></i></span>
        </div>
    `;
}

function getWechatImageStackFanDirection(stack) {
    return stack && stack.closest && stack.closest('.msg-row.right') ? -1 : 1;
}

function updateWechatImageStack(stack, activeIndex, dragOffset = 0) {
    if (!stack) return;
    const cards = Array.from(stack.querySelectorAll('.wc-image-stack-card'));
    if (!cards.length) return;
    const max = cards.length - 1;
    const active = Math.max(0, Math.min(max, Number(activeIndex || 0)));
    const fanDirection = getWechatImageStackFanDirection(stack);
    const dragX = Math.max(-64, Math.min(64, Number(dragOffset || 0)));
    stack.dataset.active = String(active);
    cards.forEach((card, index) => {
        const offset = index - active;
        const abs = Math.abs(offset);
        const visible = abs <= 2;
        const sideX = offset * fanDirection;
        const activeDrag = index === active ? dragX : dragX * Math.max(0, 0.24 - abs * 0.07);
        card.style.zIndex = String(50 - abs);
        card.style.opacity = visible ? String(Math.max(0.28, 1 - abs * 0.22)) : '0';
        card.style.pointerEvents = visible ? 'auto' : 'none';
        card.style.transform = `translate3d(${sideX * 15 + activeDrag}px, ${abs * 8}px, ${-abs * 18}px) rotate(${sideX * 3.2}deg) scale(${Math.max(0.86, 1 - abs * 0.052)})`;
        card.classList.toggle('active', index === active);
    });
    const count = stack.querySelector('.wc-image-stack-count');
    if (count) count.textContent = `${active + 1}/${cards.length}`;
}

function openWechatImageStackPreview(stack, activeIndex) {
    if (!stack || window._msgMultiSelectMode) return false;
    const cards = Array.from(stack.querySelectorAll('.wc-image-stack-card'));
    if (!cards.length) return false;
    const max = cards.length - 1;
    const index = Math.max(0, Math.min(max, Number(activeIndex || 0)));
    const sources = cards
        .map(item => item.dataset.src || '')
        .filter(Boolean);
    const src = sources[index] || cards[index]?.dataset.src || '';
    if (!src) return false;
    updateWechatImageStack(stack, index);
    stack.dataset.previewOpenedAt = String(Date.now());
    openWechatImagePreview(src, `第 ${index + 1} 张`, sources, index);
    return true;
}

function bindWechatImageStacks(root) {
    const scope = root || document;
    scope.querySelectorAll('.wc-image-stack').forEach(stack => {
        if (stack.dataset.bound === '1') return;
        stack.dataset.bound = '1';
        updateWechatImageStack(stack, Number(stack.dataset.active || 0));
        let startX = 0;
        let startY = 0;
        let pointerId = null;
        let horizontalDrag = false;
        let moved = false;
        let downCardIndex = 0;
        stack.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            const downCard = event.target.closest?.('.wc-image-stack-card');
            startX = event.clientX;
            startY = event.clientY;
            pointerId = event.pointerId;
            downCardIndex = downCard ? Number(downCard.dataset.index || 0) : Number(stack.dataset.active || 0);
            horizontalDrag = false;
            moved = false;
            stack.classList.add('dragging');
            try {
                stack.setPointerCapture?.(event.pointerId);
            } catch (_) {}
        });
        stack.addEventListener('pointermove', event => {
            if (pointerId !== event.pointerId) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (!horizontalDrag && Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(dy) * 0.72) {
                horizontalDrag = true;
                moved = true;
            }
            if (!horizontalDrag) return;
            event.preventDefault();
            event.stopPropagation();
            updateWechatImageStack(stack, Number(stack.dataset.active || 0), dx * 0.46);
        });
        stack.addEventListener('pointerup', event => {
            if (pointerId !== event.pointerId) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            const active = Number(stack.dataset.active || 0);
            stack.classList.remove('dragging');
            try {
                stack.releasePointerCapture?.(event.pointerId);
            } catch (_) {}
            pointerId = null;
            if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 0.72) {
                moved = true;
                updateWechatImageStack(stack, active + (dx < 0 ? 1 : -1));
            } else {
                updateWechatImageStack(stack, active);
            }
            if (!moved && Math.hypot(dx, dy) <= 10) {
                event.preventDefault();
                event.stopPropagation();
                openWechatImageStackPreview(stack, downCardIndex);
            }
            setTimeout(() => { moved = false; }, 0);
        });
        stack.addEventListener('pointercancel', event => {
            if (pointerId !== event.pointerId) return;
            pointerId = null;
            horizontalDrag = false;
            stack.classList.remove('dragging');
            updateWechatImageStack(stack, Number(stack.dataset.active || 0));
            setTimeout(() => { moved = false; }, 0);
        });
        stack.addEventListener('keydown', event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const active = Number(stack.dataset.active || 0);
            updateWechatImageStack(stack, active + (event.key === 'ArrowRight' ? 1 : -1));
        });
        stack.querySelectorAll('.wc-image-stack-card').forEach(card => {
            card.addEventListener('click', event => {
                if (window._msgMultiSelectMode) return;
                event.preventDefault();
                event.stopPropagation();
                if (Date.now() - Number(stack.dataset.previewOpenedAt || 0) < 450) return;
                const index = Number(card.dataset.index || 0);
                const active = Number(stack.dataset.active || 0);
                if (moved) return;
                if (index !== active) {
                    openWechatImageStackPreview(stack, index);
                } else {
                    openWechatImageStackPreview(stack, active);
                }
            });
        });
    });
}

function appendWechatApiTicketEntry(row, msg, charObj, msgIndex) {
    if (msg.isMe || !Array.isArray(msg.apiUsageRecords) || !msg.apiUsageRecords.length
        || typeof getWechatAgentPreferences !== 'function' || !getWechatAgentPreferences(charObj).showTokenUsage) return;
    const shell = row.querySelector('.msg-bubble-shell, .msg-rich-shell, .msg-offline-narration') || row;
    const totals = window.ByndApiTicket?.totalFor(msg.apiUsageRecords);
    if (!shell || !totals || !Number.isInteger(msgIndex)) return;
    const ticket = document.createElement('button');
    ticket.type = 'button';
    ticket.className = 'bynd-api-ticket-entry';
    const returnedAt = Number(msg.apiUsageRecords.at(-1)?.finishedAt);
    const timeLabel = Number.isFinite(returnedAt) && returnedAt > 0 ? ` · ${new Date(returnedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '';
    ticket.innerHTML = `<i class="ri-receipt-line" aria-hidden="true"></i><span>API 小票 · ${totals.estimated ? '≈' : ''}${totals.total.toLocaleString('zh-CN')} Token${timeLabel}</span><i class="ri-arrow-right-s-line" aria-hidden="true"></i>`;
    ticket.setAttribute('aria-label', `打开本轮 API 小票，共 ${totals.total} Token`);
    ticket.addEventListener('click', event => {
        event.stopPropagation();
        window.ByndApiTicket?.openTicket(charObj.id, msgIndex);
    });
    // Keep the receipt out of the shell's height so bottom-aligned avatars stay beside the bubble.
    if (shell.matches('.msg-bubble-shell, .msg-rich-shell')) row.classList.add('has-api-ticket');
    shell.appendChild(ticket);
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => window.ByndApiTicket?.syncEntryTone(ticket, charObj));
    }
}

// Transparent GIF canvases (GIPHY 200.gif, many pack GIFs) leave empty rows under the art, so the
// bottom-aligned avatar ends up below the visible sticker. Measure the first frame through a separate
// CORS probe (the shown <img> must stay non-CORS or hosts without CORS stop loading) and trim it.
const wechatStickerAlphaTrimCache = new Map();

function measureWechatStickerTransparentBottom(src) {
    if (wechatStickerAlphaTrimCache.has(src)) return wechatStickerAlphaTrimCache.get(src);
    const pending = new Promise(resolve => {
        const probe = new Image();
        probe.crossOrigin = 'anonymous';
        probe.onerror = () => resolve(0);
        probe.onload = () => {
            try {
                const w = probe.naturalWidth, h = probe.naturalHeight;
                if (!w || !h) return resolve(0);
                const scale = Math.min(1, 96 / Math.max(w, h));
                const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
                const canvas = document.createElement('canvas');
                canvas.width = cw;
                canvas.height = ch;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(probe, 0, 0, cw, ch);
                const data = ctx.getImageData(0, 0, cw, ch).data;
                let last = -1;
                for (let y = ch - 1; y >= 0 && last < 0; y -= 1) {
                    for (let x = 0; x < cw; x += 1) {
                        if (data[(y * cw + x) * 4 + 3] > 24) { last = y; break; }
                    }
                }
                const ratio = last < 0 ? 0 : (ch - 1 - last) / ch;
                resolve(ratio >= 0.03 ? ratio : 0);
            } catch (_) {
                resolve(0); // tainted canvas or decode failure: keep the sticker untrimmed
            }
        };
        probe.src = src;
    });
    wechatStickerAlphaTrimCache.set(src, pending);
    return pending;
}

function bindWechatStickerAlphaTrim(row) {
    const img = row.querySelector('.msg-bubble.sticker:not(.wechat-emoji) .msg-sticker-main > img');
    const src = img && (img.currentSrc || img.getAttribute('src'));
    if (!src || typeof Image !== 'function' || typeof document === 'undefined') return;
    measureWechatStickerTransparentBottom(src).then(ratio => {
        if (!ratio) return;
        const apply = () => {
            const px = Math.round(img.getBoundingClientRect().height * ratio);
            if (px > 0) img.style.marginBottom = `-${px}px`;
        };
        if (img.complete && img.naturalWidth) apply();
        else img.addEventListener('load', apply, { once: true });
    });
}

