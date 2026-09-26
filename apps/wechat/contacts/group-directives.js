window._wechatReplyDraft = null;

function updateWechatReplyPreview() {
    const preview = document.getElementById('wc-reply-preview');
    if (!preview) return;
    const draft = window._wechatReplyDraft;
    if (!draft || !draft.text) {
        preview.classList.add('hidden');
        preview.classList.remove('has-media');
        preview.innerHTML = '';
        return;
    }
    const media = getWechatReplyMedia(draft, getCurrentChatChar());
    const displayText = getWechatReplyDisplayText(draft, media);
    preview.classList.toggle('has-media', !!media);
    const leadHtml = media && media.url
        ? `<span class="wc-reply-thumb ${media.type === 'sticker' ? 'sticker' : 'image'}${media.emoji ? ' emoji' : ''}"><img src="${wcEscapeHtml(media.url)}" alt="${wcEscapeHtml(media.label || '表情')}" loading="lazy" onerror="this.parentElement?.classList.add('is-broken');this.remove()"></span>`
        : '<i class="ri-reply-line"></i>';
    preview.classList.remove('hidden');
    preview.innerHTML = `
        <div class="wc-reply-preview-main">
            ${leadHtml}
            <div>
                <strong>引用 ${wcEscapeHtml(draft.sender || '消息')}</strong>
                ${displayText ? `<span>${wcEscapeHtml(displayText)}</span>` : ''}
            </div>
        </div>
        <button type="button" onclick="clearWechatReplyDraft()" aria-label="取消引用"><i class="ri-close-line"></i></button>
    `;
}

function clearWechatReplyDraft() {
    window._wechatReplyDraft = null;
    updateWechatReplyPreview();
}

function quoteWechatMessage(msgIdx) {
    closeMsgActionMenu();
    const char = getCurrentChatChar();
    if (!char || !Array.isArray(char.history) || msgIdx < 0 || msgIdx >= char.history.length) return;
    const snapshot = buildWechatReplySnapshot(char.history[msgIdx], char, msgIdx);
    if (!snapshot) return;
    window._wechatReplyDraft = snapshot;
    updateWechatReplyPreview();
    document.getElementById('wc-msg-input')?.focus();
}

function splitWechatDirectiveArgs(raw) {
    return String(raw || '').split('|').map(part => part.trim());
}

function buildWechatGroupSpeechDirective(rawArgs, group) {
    if (!group?.isGroupChat) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const member = findWechatGroupMember(group, args[0] || '');
    const content = args.slice(1).join('|').trim();
    if (!member || !content) return null;

    const nestedMediaMsg = buildWechatStickerMessageFromAiText(content, group) || buildWechatImageMessageFromAiText(content, group);
    const baseMsg = nestedMediaMsg && (nestedMediaMsg.content || nestedMediaMsg.imagePending)
        ? nestedMediaMsg
        : { type: 'text', isMe: false, content, timestamp: createMessageTimestamp() };

    return {
        ...baseMsg,
        isMe: false,
        senderId: member.id,
        senderName: getWechatQQGroupMemberDisplayName(group, member),
        timestamp: baseMsg.timestamp || createMessageTimestamp()
    };
}

function isWechatQQGroupTitleDirectiveCommand(command) {
    return command === 'QQ群头衔' || command === '群头衔' || command === '微信改群头衔';
}

function isWechatGroupNicknameDirectiveCommand(command) {
    return command === '群昵称' || command === '微信群昵称' || command === 'QQ群昵称' || command === '微信改群昵称';
}

function isWechatGroupNameDirectiveCommand(command) {
    return command === '群名' || command === '群名称' || command === '群聊名称' || command === '微信群名' || command === 'QQ群名' || command === '微信改群名' || command === 'QQ改群名';
}

function isWechatGroupInviteDirectiveCommand(command) {
    return command === '群邀请' || command === '群拉人' || command === '微信群邀请' || command === 'QQ群邀请' || command === '群NPC' || command === '群npc';
}

function refreshWechatGroupAfterMemberMutation(group) {
    if (!group?.isGroupChat) return;
    getWechatQQGroupOwnerId(group);
    if (!group.avatar || /^data:image\/svg\+xml/.test(group.avatar)) group.avatar = buildWechatGroupAvatar(group);
    saveCharactersToStorage();
    if (window.currentChatCharId === group.id) refreshChatView(group);
    renderChatList();
    syncWechatQQGroupSettingsEntry(group);
}

function applyWechatQQGroupTitleDirective(rawArgs, group) {
    if (!group?.isGroupChat) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const member = findWechatGroupMember(group, args[0] || '');
    const nextTitle = String(args[1] || '').trim().slice(0, 16);
    if (!member || !nextTitle || member.id === WECHAT_QQ_GROUP_USER_ID || member.isUser) return null;

    const badgeBefore = getWechatQQGroupMemberBadge(group, member.id);
    const previousTitle = badgeBefore && badgeBefore.text ? badgeBefore.text : '';
    if (previousTitle === nextTitle) return null;

    const settings = getWechatQQGroupSettings(group);
    const profile = getWechatQQGroupMemberProfile(group, member.id);
    profile.title = nextTitle;
    profile.titleChangedBy = member.id;
    profile.titleChangedAt = Date.now();
    const reason = args.slice(2).join('|').trim();
    if (reason) profile.titleChangeReason = reason;
    else delete profile.titleChangeReason;

    settings.memberProfiles = getWechatQQGroupMemberProfiles(group);
    group.chatConfig = group.chatConfig || {};
    group.chatConfig.qqGroupSettings = settings;
    saveCharactersToStorage();
    if (window.currentChatCharId === group.id) refreshChatView(group);
    renderChatList();
    syncWechatQQGroupSettingsEntry(group);

    const displayName = getWechatQQGroupMemberDisplayName(group, member);
    return {
        type: 'system_notice',
        isMe: false,
        content: reason
            ? `${displayName} 将群头衔改为「${nextTitle}」：${reason}`
            : `${displayName} 将群头衔改为「${nextTitle}」`,
        timestamp: createMessageTimestamp()
    };
}

function applyWechatGroupNicknameDirective(rawArgs, group) {
    if (!group?.isGroupChat) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const member = findWechatGroupMember(group, args[0] || '');
    const nextName = String(args[1] || '').trim().slice(0, 24);
    if (!member || !nextName || member.id === WECHAT_QQ_GROUP_USER_ID || member.isUser) return null;

    const previousName = getWechatQQGroupMemberDisplayName(group, member);
    if (previousName === nextName) return null;

    const settings = getWechatQQGroupSettings(group);
    const profile = getWechatQQGroupMemberProfile(group, member.id);
    profile.remark = nextName;
    profile.nicknameChangedBy = member.id;
    profile.nicknameChangedAt = Date.now();
    const reason = args.slice(2).join('|').trim();
    if (reason) profile.nicknameChangeReason = reason;
    else delete profile.nicknameChangeReason;

    settings.memberProfiles = getWechatQQGroupMemberProfiles(group);
    group.chatConfig = group.chatConfig || {};
    group.chatConfig.qqGroupSettings = settings;
    refreshWechatGroupAfterMemberMutation(group);

    return {
        type: 'system_notice',
        isMe: false,
        content: reason
            ? `${previousName} 将群昵称改为「${nextName}」：${reason}`
            : `${previousName} 将群昵称改为「${nextName}」`,
        timestamp: createMessageTimestamp()
    };
}

function applyWechatGroupNameDirective(rawArgs, group) {
    if (!group?.isGroupChat) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const member = findWechatGroupMember(group, args[0] || '');
    const nextName = String(args[1] || '').trim().slice(0, 24);
    if (!member || !nextName || member.id === WECHAT_QQ_GROUP_USER_ID || member.isUser) return null;

    const actorName = getWechatQQGroupMemberDisplayName(group, member);
    const role = getWechatQQGroupMemberRole(group, member.id);
    const reason = args.slice(2).join('|').trim();
    if (role !== 'owner' && role !== 'admin') {
        return {
            type: 'system_notice',
            isMe: false,
            content: `${actorName} 尝试将群名称改为「${nextName}」，但没有群管理权限`,
            timestamp: createMessageTimestamp()
        };
    }

    const previousName = group.name || '群聊';
    if (previousName === nextName) return null;

    const settings = getWechatQQGroupSettings(group);
    group.name = nextName;
    settings.groupNameChangedBy = member.id;
    settings.groupNameChangedAt = Date.now();
    if (reason) settings.groupNameChangeReason = reason;
    else delete settings.groupNameChangeReason;
    group.chatConfig = group.chatConfig || {};
    group.chatConfig.qqGroupSettings = settings;
    if (!group.avatar || /^data:image\/svg\+xml/.test(group.avatar)) group.avatar = buildWechatGroupAvatar(group);
    saveCharactersToStorage();
    if (window.currentChatCharId === group.id) {
        updateWechatCurrentChatHeader(group);
        refreshChatView(group);
    }
    renderChatList();
    syncWechatQQGroupSettingsEntry(group);

    return {
        type: 'system_notice',
        isMe: false,
        content: reason
            ? `${actorName} 将群名称从「${previousName}」改为「${nextName}」：${reason}`
            : `${actorName} 将群名称从「${previousName}」改为「${nextName}」`,
        timestamp: createMessageTimestamp()
    };
}

function normalizeWechatGroupNpcAvatar(value, seed) {
    const avatar = String(value || '').trim();
    if (/^(?:https?:|data:image\/)/i.test(avatar)) return avatar;
    const source = String(seed || avatar || 'npc');
    const hue = source.split('').reduce((sum, ch) => (sum + ch.charCodeAt(0)) % 360, 0);
    const label = wcEscapeHtml(Array.from(source.trim()).find(ch => !/\s/.test(ch)) || '友');
    return 'data:image/svg+xml,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
            <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="hsl(${hue},72%,78%)"/>
                    <stop offset="100%" stop-color="hsl(${(hue + 46) % 360},76%,90%)"/>
                </linearGradient>
            </defs>
            <rect width="160" height="160" rx="80" fill="url(#bg)"/>
            <circle cx="80" cy="66" r="28" fill="rgba(255,255,255,0.86)"/>
            <path d="M38 132c9-29 74-29 84 0" fill="rgba(255,255,255,0.82)"/>
            <text x="80" y="91" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="800" fill="hsl(${hue},52%,36%)">${wcEscapeHtml(label)}</text>
        </svg>
    `);
}

function findWechatContactForGroupInvite(group, name) {
    const query = String(name || '').trim();
    if (!query) return null;
    const currentIds = new Set(Array.isArray(group?.groupMembers) ? group.groupMembers : []);
    const matchesName = char => {
        if (!char || currentIds.has(char.id)) return false;
        const display = getWechatGroupMemberName(char);
        return char.id === query || char.name === query || display === query
            || query.includes(display) || display.includes(query);
    };
    return getWechatGroupContacts({ includeGroupNpc: false }).find(matchesName)
        || getWechatGroupContacts({ includeGroupNpc: true }).find(char => (
            isWechatGroupNpcContact(char)
            && char.npcOriginGroupId === group.id
            && matchesName(char)
        ))
        || null;
}

function buildWechatGroupNpcId(group, name, persona) {
    const seed = `${group?.id || 'group'}|${name}|${persona || ''}`;
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `npc_${(hash >>> 0).toString(36)}_${Date.now().toString(36)}`;
}

function createWechatGroupNpcContact(group, name, persona, avatarUrl, inviter) {
    const cleanName = String(name || '').trim().slice(0, 24);
    if (!cleanName) return null;
    const cleanPersona = String(persona || '').trim().slice(0, 900);
    const existing = getWechatGroupContacts({ includeGroupNpc: true }).find(char => {
        const display = getWechatGroupMemberName(char);
        return isWechatGroupNpcContact(char)
            && char.npcOriginGroupId === group.id
            && (char.name === cleanName || display === cleanName);
    });
    if (existing) return existing;
    const now = Date.now();
    const npc = {
        id: buildWechatGroupNpcId(group, cleanName, cleanPersona),
        name: cleanName,
        description: cleanPersona || `${cleanName} 是由群成员邀请进群的群内联系人。`,
        avatar: normalizeWechatGroupNpcAvatar(avatarUrl, cleanName),
        lastMsg: '',
        worldBook: [],
        regex: [],
        alternates: [],
        first_mes_original: '',
        first_mes: '',
        currentGreetingIndex: 0,
        isGroupNpc: true,
        groupNpc: true,
        npcOriginGroupId: group.id || '',
        npcCreatedByMemberId: inviter?.id || '',
        npcCreatedAt: now,
        chatConfig: {
            nickname: cleanName,
            groupNpc: true,
            npcOriginGroupId: group.id || '',
            npcPersona: cleanPersona
        },
        history: []
    };
    window.myCharacters = Array.isArray(window.myCharacters) ? window.myCharacters : [];
    window.myCharacters.push(npc);
    return npc;
}

function applyWechatGroupInviteDirective(rawArgs, group) {
    if (!group?.isGroupChat) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const inviter = findWechatGroupMember(group, args[0] || '');
    const memberName = String(args[1] || '').trim().slice(0, 24);
    if (!inviter || inviter.id === WECHAT_QQ_GROUP_USER_ID || inviter.isUser || !memberName) return null;

    const settings = getWechatQQGroupSettings(group);
    if (!getWechatQQGroupFlag(settings, 'memberInviteEnabled', true)) {
        return {
            type: 'system_notice',
            isMe: false,
            content: `${getWechatQQGroupMemberDisplayName(group, inviter)} 想邀请 ${memberName} 入群，但群已关闭成员邀请`,
            timestamp: createMessageTimestamp()
        };
    }

    group.groupMembers = Array.isArray(group.groupMembers) ? group.groupMembers : [];
    let member = findWechatContactForGroupInvite(group, memberName);
    if (!member) {
        member = createWechatGroupNpcContact(group, memberName, args[2] || '', args[3] || '', inviter);
    }
    if (!member || group.groupMembers.includes(member.id)) return null;

    const inviterName = getWechatQQGroupMemberDisplayName(group, inviter);
    const memberDisplay = getWechatGroupMemberName(member);
    if (settings.joinApproval) {
        settings.pendingMembers = Array.isArray(settings.pendingMembers) ? settings.pendingMembers : [];
        if (!settings.pendingMembers.includes(member.id)) settings.pendingMembers.push(member.id);
        settings.memberProfiles = getWechatQQGroupMemberProfiles(group);
        group.chatConfig = group.chatConfig || {};
        group.chatConfig.qqGroupSettings = settings;
        refreshWechatGroupAfterMemberMutation(group);
        return {
            type: 'system_notice',
            isMe: false,
            content: `${inviterName} 邀请 ${memberDisplay} 入群，已进入审核`,
            timestamp: createMessageTimestamp()
        };
    }

    group.groupMembers.push(member.id);
    settings.memberProfiles = getWechatQQGroupMemberProfiles(group);
    group.chatConfig = group.chatConfig || {};
    group.chatConfig.qqGroupSettings = settings;
    refreshWechatGroupAfterMemberMutation(group);
    return {
        type: 'system_notice',
        isMe: false,
        content: `${inviterName} 邀请 ${memberDisplay} 加入了群聊`,
        timestamp: createMessageTimestamp()
    };
}

