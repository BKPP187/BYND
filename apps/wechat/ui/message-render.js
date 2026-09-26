// 🔥 微信渲染逻辑：只显示纯文本 (Clean & Simple)
function renderMessageBubble(container, msg, avatarUrl, charObj, msgIndex, options = {}) {
    const row = document.createElement('div');
    row.className = `msg-row ${msg.isMe ? 'right' : 'left'}`;
    if (typeof msgIndex === 'number') row.dataset.msgIdx = msgIndex;

    if (msg.type === 'system_notice') {
        row.className = 'msg-row system';
        row.innerHTML = `<div class="msg-system-notice">${wcEscapeHtml(msg.content || '')}</div>`;
        container.appendChild(row);
        return;
    }

    if (msg.type === 'poke' || msg.type === 'screen_shake') {
        row.className = `msg-row time msg-poke-row${msg.type === 'screen_shake' ? ' msg-shake-row' : ''}`;
        row.innerHTML = msg.type === 'poke' ? renderWechatPokeNotice(msg, charObj) : renderWechatScreenShakeNotice(msg, charObj);
        appendWechatApiTicketEntry(row, msg, charObj, msgIndex);
        container.appendChild(row);
        bindWechatMessageRowActions(row, msg, msgIndex);
        return;
    }

    if (msg.type === 'offline_narration') {
        const narration = normalizeWechatOfflineNarrationText(msg.content || msg.description || '');
        if (!narration) return;
        row.className = 'msg-row narration';
        row.innerHTML = `
            <div class="msg-offline-narration">
                <i class="ri-chat-quote-line"></i>
                <span>${renderWechatMarkdownLite(narration)}</span>
                ${buildMessageMeta({ ...msg, isMe: false })}
            </div>
        `;
        appendWechatApiTicketEntry(row, msg, charObj, msgIndex);
        container.appendChild(row);
        bindWechatMessageRowActions(row, msg, msgIndex);
        return;
    }

    const profile = getWechatChatUserProfile(charObj);
    const myAvatar = profile.avatar || DEFAULT_AVATAR;
    let displayMsg = msg;
    let groupMember = null;
    if (!msg.isMe && charObj?.isGroupChat) {
        groupMember = findWechatGroupMember(charObj, msg.senderId || msg.speakerId || msg.senderName || msg.speakerName);
        if (!groupMember && msg.type === 'text') {
            const normalized = normalizeWechatGroupSpeechText(msg.content, charObj);
            if (normalized.member) {
                groupMember = normalized.member;
                displayMsg = { ...msg, content: normalized.text };
            }
        }
    }
    if (groupMember) row.classList.add('group-member');

    const currentAvatar = msg.isMe
        ? myAvatar
        : getWechatFirstRealAvatarSource(
            groupMember?.avatar,
            msg.avatar,
            msg.avatarUrl,
            msg.senderAvatar,
            msg.speakerAvatar,
            avatarUrl,
            getWechatCharAvatarSource(charObj, '')
        ) || DEFAULT_AVATAR;
    const showCoupleHeader = !isWechatCoupleTheme() || options.showCoupleHeader !== false;
    if (isWechatCoupleTheme()) {
        row.classList.add(showCoupleHeader ? 'couple-group-start' : 'couple-continuation');
    }

    const config = charObj.chatConfig || {};
    const fontSize = config.fontSize || 15;
    const useWechatExternalQuote = shouldRenderWechatExternalQuote() && !!displayMsg.replyTo;
    const quoteHtml = useWechatExternalQuote ? '' : renderWechatMessageQuote(displayMsg.replyTo, charObj);
    const externalQuoteHtml = useWechatExternalQuote ? renderWechatExternalMessageQuote(displayMsg.replyTo, charObj) : '';
    if (externalQuoteHtml) row.classList.add('has-wechat-quote');
    if (isWechatImageStackMessage(displayMsg)) row.classList.add('has-image-stack');

    let bubbleHtml = '';
    const avatarClass = msg.isMe ? 'msg-avatar' : 'msg-avatar msg-avatar-ai';
    const groupMemberLabel = (!msg.isMe && charObj?.isGroupChat && groupMember)
        ? renderWechatQQGroupMessageSenderLabel(charObj, groupMember)
        : '';
    const avatarHtml = renderWechatMessageAvatarHtml(displayMsg, currentAvatar, avatarClass, { showCoupleHeader });
    const groupNameHtml = groupMemberLabel;

    if (displayMsg.type === 'sticker') {
        const isWechatEmoji = displayMsg.emoji || displayMsg.stickerKind === 'wechatEmoji' || isWechatBuiltinEmojiUrl(displayMsg.content);
        const emojiClass = isWechatEmoji ? ' wechat-emoji' : '';
        const inner = `<div class="msg-bubble sticker${emojiClass}">${quoteHtml}<div class="msg-sticker-main"><img src="${wcEscapeHtml(displayMsg.content)}" alt="${wcEscapeHtml(displayMsg.stickerName || '')}"><span class="msg-sticker-meta">${formatMessageTime(displayMsg)}<i class="ri-check-double-line"></i></span></div></div>`;
        bubbleHtml = msg.isMe && !externalQuoteHtml ? avatarHtml + inner : avatarHtml + `<div class="msg-bubble-shell media">${groupNameHtml}${inner}${externalQuoteHtml}</div>`;
    } else if (isWechatImageStackMessage(displayMsg)) {
        const inner = renderWechatImageStackBubble(displayMsg, quoteHtml);
        bubbleHtml = msg.isMe && !externalQuoteHtml ? avatarHtml + inner : avatarHtml + `<div class="msg-bubble-shell media image-stack-shell">${groupNameHtml}${inner}${externalQuoteHtml}</div>`;
    } else if (displayMsg.type === 'image') {
        let imageBody = '';
        if (displayMsg.content) {
            imageBody = `<img src="${wcEscapeHtml(displayMsg.content)}">`;
        } else if (displayMsg.imagePending) {
            imageBody = `<div class="msg-image-placeholder"><i class="ri-loader-4-line"></i><span>正在生成照片...</span></div>`;
        } else {
            imageBody = `<div class="msg-image-placeholder error"><i class="ri-error-warning-line"></i><span>${wcEscapeHtml(displayMsg.imageError || '图片生成失败')}</span></div>`;
        }
        const inner = `<div class="msg-bubble image-bubble${displayMsg.imagePending ? ' pending' : ''}${displayMsg.imageError ? ' error' : ''}">${quoteHtml}${imageBody}<span class="msg-media-meta">${formatMessageTime(displayMsg)}<i class="ri-check-double-line"></i></span></div>`;
        bubbleHtml = msg.isMe && !externalQuoteHtml ? avatarHtml + inner : avatarHtml + `<div class="msg-bubble-shell media">${groupNameHtml}${inner}${externalQuoteHtml}</div>`;
    } else if (isWechatSpecialMessage(displayMsg.type)) {
        syncWechatMessageDescription(displayMsg);
        const inner = buildWechatSpecialBubble(displayMsg, quoteHtml, msgIndex, charObj);
        bubbleHtml = msg.isMe && !externalQuoteHtml ? avatarHtml + inner : avatarHtml + `<div class="msg-bubble-shell">${groupNameHtml}${inner}${externalQuoteHtml}</div>`;
    } else {
        const visibleText = getWechatTextMessageVisibleText(displayMsg, charObj);
        const hasVisibleText = !!visibleText;
        if (!hasVisibleText && !quoteHtml && !externalQuoteHtml) return;
        const forumPreview = hasVisibleText && typeof getWechatForumPostPreview === 'function' ? getWechatForumPostPreview(visibleText) : null;
        const forumText = forumPreview ? String(displayMsg.content || '').replace(forumPreview.link,'').trim() : displayMsg.content;
        let rawContent = hasVisibleText && forumText ? processMsgContent(forumText, charObj) : '';
        const metaHtml = buildMessageMeta(displayMsg);
        const isRich = isWechatRichCardContent(rawContent);
        if (!isRich) rawContent = renderWechatBuiltinEmojiMarkersHtml(rawContent);
        const emojiTextClass = !isRich && (displayMsg.wechatEmojiText || hasWechatBuiltinEmojiMarker(displayMsg.content)) ? ' wechat-emoji-text' : '';
        const quoteBubbleClass = externalQuoteHtml ? ' has-wechat-quote' : '';
        const themeId = typeof getWechatUiThemeId === 'function' ? getWechatUiThemeId() : '';
        const isQqTheme = themeId === 'qq';
        const isRednoteTheme = themeId === 'rednote';
        const isDouyinTheme = themeId === 'douyin';
        const qqQuoteBubbleClass = quoteHtml && isQqTheme ? ' has-qq-quote' : '';
        const rednoteQuoteBubbleClass = quoteHtml && isRednoteTheme ? ' has-rednote-quote' : '';
        const douyinQuoteBubbleClass = quoteHtml && isDouyinTheme ? ' has-douyin-quote' : '';
        if (isDouyinTheme && quoteHtml) row.classList.add('has-douyin-quote-row');
        if (isQqTheme && !msg.isMe && !isRich && isWechatQqNumericLinkText(visibleText)) rawContent = `<span class="msg-qq-numeric-link">${rawContent}</span>`;
        if (isRednoteTheme && !isRich) rawContent = highlightWechatRednoteMentions(rawContent);
        if (isDouyinTheme && quoteHtml && !isRich && displayMsg.replyTo) {
            const mentionName = getWechatDouyinReplyMentionName(displayMsg.replyTo, charObj);
            const visible = String(visibleText || '').trim();
            if (mentionName && !visible.startsWith(`@${mentionName}`)) {
                rawContent = `<span class="msg-douyin-quote-mention">@${wcEscapeHtml(mentionName)}</span> ${rawContent}`;
            }
        }
        const textBubbleHtml = hasVisibleText && !isRich
            ? forumPreview
                ? `<div class="msg-forum-preview-stack" style="font-size:${fontSize}px;">${quoteHtml || rawContent ? `<div class="msg-bubble${msg.isMe ? ' green' : ''}${quoteBubbleClass}${qqQuoteBubbleClass}${rednoteQuoteBubbleClass}${douyinQuoteBubbleClass}${emojiTextClass}">${quoteHtml}${rawContent ? `<div class="msg-text">${rawContent}</div>` : ''}</div>` : ''}<div class="msg-forum-card">${renderWechatForumPostPreview(forumPreview)}${metaHtml}</div></div>`
                : `<div class="msg-bubble${msg.isMe ? ' green' : ''}${quoteBubbleClass}${qqQuoteBubbleClass}${rednoteQuoteBubbleClass}${douyinQuoteBubbleClass}${emojiTextClass}" style="font-size:${fontSize}px;">${quoteHtml}${rawContent ? `<div class="msg-text">${rawContent}</div>` : ''}${metaHtml}</div>`
            : '';
        const richCardHtml = hasVisibleText && isRich
            ? `<div class="msg-rich-card${msg.isMe ? ' is-self' : ''}" style="font-size:${fontSize}px;">${quoteHtml}${rawContent}${metaHtml}</div>`
            : '';

        if (isRich) {
            row.classList.add('is-rich-message');
            // Rich role cards own their layout and background. Do not wrap them in a speech bubble.
            bubbleHtml = avatarHtml + `<div class="msg-rich-shell">${groupNameHtml}${richCardHtml}${externalQuoteHtml}</div>`;
        } else if (msg.isMe) {
            if (isDouyinTheme && quoteHtml && !isRich) {
                bubbleHtml = avatarHtml + `<div class="msg-bubble-shell msg-douyin-self-shell">${renderWechatDouyinSelfSenderLabel(charObj)}${textBubbleHtml}${externalQuoteHtml}</div>`;
            } else {
            bubbleHtml = externalQuoteHtml
                ? avatarHtml + `<div class="msg-bubble-shell">${textBubbleHtml}${externalQuoteHtml}</div>`
                : avatarHtml + textBubbleHtml;
            }
        } else {
            bubbleHtml = avatarHtml + `<div class="msg-bubble-shell">${groupNameHtml}${textBubbleHtml}${externalQuoteHtml}</div>`;
        }
    }

    row.innerHTML = bubbleHtml;
    if (displayMsg.type === 'sticker') bindWechatStickerAlphaTrim(row);
    appendWechatApiTicketEntry(row, msg, charObj, msgIndex);
    container.appendChild(row);
    executeScriptsInElement(row);
    bindWechatMusicCardPlayback(row);
    bindWechatImageStacks(row);
    applyWechatBubbleMetaContrast(row);
    if (displayMsg.type === 'image' && displayMsg.content) {
        const imageEl = row.querySelector('.msg-bubble.image-bubble img');
        if (imageEl) {
            imageEl.setAttribute('role', 'button');
            imageEl.setAttribute('tabindex', '0');
            imageEl.addEventListener('click', event => {
                if (window._msgMultiSelectMode) return;
                event.preventDefault();
                event.stopPropagation();
                openWechatImagePreview(displayMsg.content, displayMsg.description || '');
            });
            imageEl.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                openWechatImagePreview(displayMsg.content, displayMsg.description || '');
            });
        }
    }
    if (typeof msgIndex === 'number' && !msg.isMe && !msg.receipt && ['transfer', 'redpacket', 'gift', 'intimatePay'].includes(msg.type) && msg.status !== '已被领取' && msg.status !== '已收取' && msg.status !== '已开通' && msg.status !== '已退回') {
        row.classList.add('msg-row-pay-collectable');
        const payBubble = row.querySelector('.msg-pay-bubble, .msg-gift-bubble, .msg-intimate-pay-bubble');
        if (payBubble) {
            payBubble.setAttribute('role', 'button');
            payBubble.setAttribute('tabindex', '0');
            payBubble.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                if (msg.type === 'transfer' || msg.type === 'redpacket') openWechatPaymentActionModal(msgIndex);
                else collectWechatIncomingPayment(msgIndex);
            });
            payBubble.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                if (msg.type === 'transfer' || msg.type === 'redpacket') openWechatPaymentActionModal(msgIndex);
                else collectWechatIncomingPayment(msgIndex);
            });
        }
    }
    if (!msg.isMe) bindWechatAiAvatarInteractions(row, groupMember || charObj);
    bindWechatMessageRowActions(row, msg, msgIndex);
}

function bindWechatMessageRowActions(row, msg, msgIndex) {
    if (!row || typeof msgIndex !== 'number') return;
    let pressTimer = null;
    row.addEventListener('click', (e) => {
        if (!window._msgMultiSelectMode) return;
        e.preventDefault();
        e.stopPropagation();
        toggleMsgSelect(msgIndex, row);
    }, true);
    const startPress = (e) => {
        if (window._msgMultiSelectMode) return;
        if (isWechatRichInteractiveTarget(e.target)) return;
        pressTimer = setTimeout(() => {
            e.preventDefault();
            showMsgActionMenu(msgIndex, !!msg?.isMe, row);
        }, 500);
    };
    const cancelPress = () => { clearTimeout(pressTimer); };
    row.addEventListener('touchstart', startPress, { passive: true });
    row.addEventListener('touchend', cancelPress);
    row.addEventListener('touchmove', cancelPress);
    row.addEventListener('mousedown', startPress);
    row.addEventListener('mouseup', cancelPress);
    row.addEventListener('mouseleave', cancelPress);
    row.addEventListener('dblclick', (e) => {
        if (window._msgMultiSelectMode) return;
        if (isWechatRichInteractiveTarget(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        clearTimeout(pressTimer);
        showMsgActionMenu(msgIndex, !!msg?.isMe, row);
    });
}

function bindWechatAiAvatarInteractions(row, charObj) {
    const avatarEl = row && row.querySelector ? row.querySelector('.msg-avatar-ai') : null;
    if (!avatarEl || !charObj) return;

    let clickTimer = null;
    const stopAvatarBubble = (event) => {
        event.stopPropagation();
    };
    avatarEl.addEventListener('mousedown', stopAvatarBubble);
    avatarEl.addEventListener('mouseup', stopAvatarBubble);
    avatarEl.addEventListener('touchstart', stopAvatarBubble, { passive: true });
    avatarEl.addEventListener('touchend', stopAvatarBubble);
    avatarEl.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => openWechatAiStatusTicket(charObj.id), 220);
    });
    avatarEl.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(clickTimer);
        openWechatAiPhone(charObj.id);
    });
}

function bindWechatClaudeTitleInteractions(charObj = getCurrentChatChar()) {
    const title = document.getElementById('chat-room-title');
    if (!title) return;
    const isClaude = typeof getWechatUiThemeId === 'function' && getWechatUiThemeId() === 'claude';
    title.classList.toggle('wc-claude-title-action', !!isClaude);
    title.onclick = null;
    title.ondblclick = null;
    title.onkeydown = null;
    title.removeAttribute('role');
    title.removeAttribute('tabindex');
    title.removeAttribute('aria-label');
    if (!isClaude || !charObj || !charObj.id) return;

    let clickTimer = null;
    title.setAttribute('role', 'button');
    title.setAttribute('tabindex', '0');
    title.setAttribute('aria-label', `查看 ${getWechatCharDisplayName(charObj)} 的状态；双击打开小手机`);
    title.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => openWechatAiStatusTicket(charObj.id), 220);
    };
    title.ondblclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(clickTimer);
        openWechatAiPhone(charObj.id);
    };
    title.onkeydown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openWechatAiStatusTicket(charObj.id);
    };
}
window.bindWechatClaudeTitleInteractions = bindWechatClaudeTitleInteractions;

function isWechatRichInteractiveTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    if (!target.closest('.msg-rich-card')) return false;
    return !!target.closest('a, button, input, select, textarea, label, summary, details, [role="button"], .wc-rich-clickable, [data-wc-rich-click]');
}

