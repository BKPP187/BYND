// --- A. 微信界面渲染 ---

function getWechatQQGroupSettings(group) {
    if (!group || !group.isGroupChat) return {};
    group.chatConfig = group.chatConfig || {};
    const settings = group.chatConfig.qqGroupSettings && typeof group.chatConfig.qqGroupSettings === 'object'
        ? group.chatConfig.qqGroupSettings
        : {};
    if (!/^\d{11}$/.test(String(settings.groupNumber || ''))) {
        settings.groupNumber = buildWechatQQGroupNumber(group);
    }
    group.chatConfig.qqGroupSettings = settings;
    return settings;
}

function getWechatQQGroupFlag(settings, key, defaultValue = true) {
    if (!settings || settings[key] == null) return defaultValue;
    return !!settings[key];
}

function buildWechatQQGroupNumber(group) {
    const seed = String(group?.id || group?.groupCreatedAt || group?.name || 'group');
    let hash = 1469598103934665603n;
    for (let i = 0; i < seed.length; i++) {
        hash ^= BigInt(seed.charCodeAt(i));
        hash = (hash * 1099511628211n) & ((1n << 64n) - 1n);
    }
    return String(10000000000n + (hash % 90000000000n));
}

function getWechatQQGroupDisplayName(group) {
    const settings = getWechatQQGroupSettings(group);
    return settings.groupRemark || (group && group.chatConfig && group.chatConfig.nickname) || (group && group.name) || '群聊';
}

function isWechatQQGroupPinned(char) {
    return !!(char && char.isGroupChat && getWechatQQGroupSettings(char).pinned);
}

function isWechatQQGroupHiddenPreview(char) {
    return !!(char && char.isGroupChat && getWechatQQGroupSettings(char).hideChat);
}

function isWechatQQGroupMuted(char) {
    const settings = char && char.isGroupChat ? getWechatQQGroupSettings(char) : {};
    return !!(settings.muteNotifications || settings.notificationMode === 'silent' || settings.notificationMode === 'blocked');
}

function isWechatQQGroupBlocked(char) {
    const settings = char && char.isGroupChat ? getWechatQQGroupSettings(char) : {};
    return settings.notificationMode === 'blocked';
}

function isWechatQQGroupSpeechMuted(char) {
    const settings = char && char.isGroupChat ? getWechatQQGroupSettings(char) : {};
    return !!settings.speechMuted;
}

function isWechatGroupNpcContact(char) {
    return !!(char && !char.isGroupChat && (char.isGroupNpc || char.groupNpc || char.npcOriginGroupId));
}

function getWechatVisibleChatCharacters() {
    return (window.myCharacters || []).filter(char => char && !isWechatGroupNpcContact(char));
}

function getWechatSortedChatCharacters() {
    return getWechatVisibleChatCharacters().slice().sort((a, b) => {
        const pinDelta = Number(isWechatQQGroupPinned(b)) - Number(isWechatQQGroupPinned(a));
        if (pinDelta) return pinDelta;
        return 0;
    });
}

function renderChatList() {
    renderWechatThemeChatHeader();
    const listEl = document.getElementById('wc-chat-list');
    if (!listEl) return;
    listEl.innerHTML = ''; 
    const themeId = getWechatUiThemeId();
    const isXTheme = themeId === 'hallowrok';
    const isClaudeTheme = themeId === 'claude';
    const syncThemeChrome = () => {
        if (typeof updateWechatUiThemeStructure === 'function') updateWechatUiThemeStructure(getWechatUiTheme());
    };

    if (getWechatVisibleChatCharacters().length === 0) {
        if (isClaudeTheme) {
            listEl.innerHTML = `
                <div class="wc-claude-empty">
                    <svg class="wc-claude-empty-mark" viewBox="0 0 80 80" aria-hidden="true">
                        <g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round">
                            <path d="M40 10v60"/>
                            <path d="M10 40h60"/>
                            <path d="M18.8 18.8l42.4 42.4"/>
                            <path d="M61.2 18.8 18.8 61.2"/>
                            <path d="M28.5 12.5 51.5 67.5"/>
                            <path d="M67.5 28.5 12.5 51.5"/>
                            <path d="M51.5 12.5 28.5 67.5"/>
                            <path d="M12.5 28.5 67.5 51.5"/>
                        </g>
                    </svg>
                    <h2>How can I help you today?</h2>
                    <button type="button" class="wc-claude-empty-composer" onclick="openWechatPlusMenu(event)">
                        <span>Chat with Claude</span>
                        <i class="ri-add-line"></i>
                        <b><i class="ri-mic-line"></i><em></em></b>
                    </button>
                </div>
            `;
            syncThemeChrome();
            return;
        }
        if (isXTheme) {
            syncThemeChrome();
            return;
        }
        listEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; color:#ccc;">
                <i class="ri-chat-smile-2-line" style="font-size:48px; margin-bottom:10px;"></i>
                <span style="font-size:14px;">暂无消息</span>
                <span style="font-size:12px; margin-top:5px;">点击右上角 + 导入角色卡</span>
                <button type="button" onclick="ByndBuiltinLibrary?.open()" style="margin-top:16px; border:none; border-radius:14px; padding:10px 18px; background:#14171d; color:#fff; font-size:13px; font-weight:800;">从内置角色开始</button>
            </div>
        `;
        syncThemeChrome();
        return;
    }

    const isDouyinTheme = themeId === 'douyin';
    const isLineTheme = themeId === 'line';
    const isWechatTheme = themeId === 'wechat';
    const supportsBuiltinEmojiPreview = themeId === 'wechat' || themeId === 'qq';
    getWechatSortedChatCharacters().forEach(char => {
        const container = document.createElement('div');
        container.className = 'wc-swipe-container';
        container.dataset.charId = char.id;

        const item = document.createElement('div');
        item.className = 'wc-chat-item';
        let pointerStartX = 0;
        let pointerStartY = 0;
        const openFromListItem = (event) => {
            if (event?.target?.closest('.wc-delete-btn')) return;
            if (container.classList.contains('swiping') || container.classList.contains('swipe-open')) return;
            const lastOpenAt = Number(container.dataset.openingAt || 0);
            if (Date.now() - lastOpenAt < 360) return;
            container.dataset.openingAt = String(Date.now());
            event?.preventDefault?.();
            event?.stopPropagation?.();
            openChat(char.id);
        };
        item.addEventListener('pointerdown', (event) => {
            pointerStartX = event.clientX;
            pointerStartY = event.clientY;
        }, { passive: true });
        item.addEventListener('pointerup', (event) => {
            if (event.pointerType === 'mouse') return;
            if (Math.abs(event.clientX - pointerStartX) < 18 && Math.abs(event.clientY - pointerStartY) < 18) {
                openFromListItem(event);
            }
        });
        item.addEventListener('click', openFromListItem);
        const isGroup = !!char.isGroupChat;
        const isPinned = isWechatQQGroupPinned(char);
        const isMuted = isWechatQQGroupMuted(char);
        const isHiddenPreview = isWechatQQGroupHiddenPreview(char);
        item.classList.toggle('wc-chat-pinned', isPinned);
        item.classList.toggle('wc-chat-muted', isMuted);
        item.classList.toggle('wc-chat-hidden-preview', isHiddenPreview);
        const displayName = isGroup ? getWechatQQGroupDisplayName(char) : ((char.chatConfig && char.chatConfig.nickname) || char.name);
        const avatar = getWechatCharAvatarSource(char, isGroup ? buildWechatGroupAvatar(char) : DEFAULT_AVATAR);
        const douyinUnread = isDouyinTheme ? getWechatDouyinUnreadCount(char) : 0;
        const douyinSpark = isDouyinTheme ? getWechatDouyinSparkScore(char) : 0;
        const douyinUnreadHtml = isDouyinTheme && douyinUnread > 0
            ? `<span class="wc-douyin-unread">${douyinUnread > 99 ? '99+' : douyinUnread}</span>`
            : '';
        const douyinSparkHtml = isDouyinTheme && douyinSpark > 0
            ? `<span class="wc-douyin-spark">🔥 ${douyinSpark}</span>`
            : '';

        const telegramTime = formatTelegramChatListTime(char);
        const telegramUnread = getTelegramChatUnreadCount(char);
        const telegramUnreadHtml = telegramUnread > 0
            ? `<span class="wc-telegram-unread">${telegramUnread > 99 ? '99+' : telegramUnread}</span>`
            : '';
        const lineUnread = isLineTheme ? getTelegramChatUnreadCount(char) : 0;
        const lineUnreadHtml = lineUnread > 0
            ? `<span class="wc-line-unread">${lineUnread > 99 ? '99+' : lineUnread}</span>`
            : '';
        const wechatUnread = isWechatTheme && typeof getWechatThemeCharUnreadCount === 'function'
            ? getWechatThemeCharUnreadCount(char)
            : 0;
        const wechatUnreadHtml = wechatUnread > 0
            ? `<span class="wc-wechat-list-unread">${wechatUnread > 99 ? '99+' : wechatUnread}</span>`
            : '';
        const stateHtml = `${isPinned ? '<i class="ri-pushpin-fill wc-list-state-icon"></i>' : ''}${isMuted ? '<i class="ri-notification-off-line wc-list-state-icon"></i>' : ''}`;
        const previewText = isHiddenPreview
            ? '会话已隐藏'
            : `${isGroup ? `[${getWechatQQGroupDisplayMembers(char).length}人] ` : ''}${getChatPreview(char)}`;
        const previewHtml = supportsBuiltinEmojiPreview
            ? renderWechatChatPreviewHtml(previewText)
            : escapeHtml(previewText);

        item.innerHTML = `
            <div class="wc-avatar ${isGroup ? 'wc-group-avatar' : ''}"><img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">${douyinUnreadHtml}</div>
            <div class="wc-info">
                <div class="wc-top">
                    <span class="wc-name">${escapeHtml(displayName)}${stateHtml}${douyinSparkHtml}</span>
                    <span class="wc-time">${escapeHtml(formatWechatChatListTime(char))}</span>
                    <span class="wc-line-list-side">
                        <span class="wc-line-date">${escapeHtml(formatWechatChatListTime(char))}</span>
                        ${lineUnreadHtml}
                    </span>
                    <span class="wc-telegram-list-meta">
                        <span class="wc-telegram-date"><i class="ri-pushpin-2-fill"></i>${escapeHtml(telegramTime)}</span>
                        ${telegramUnreadHtml}
                    </span>
                </div>
                <div class="wc-bottom">
                    <span class="wc-msg">${previewHtml}</span>
                    ${wechatUnreadHtml}
                </div>
            </div>
        `;

        const delBtn = document.createElement('div');
        delBtn.className = 'wc-delete-btn';
        delBtn.innerHTML = '<span>删除</span>';
        const stopDeleteEvent = (e) => {
            e.stopPropagation?.();
            e.stopImmediatePropagation?.();
        };
        ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup'].forEach(type => {
            delBtn.addEventListener(type, stopDeleteEvent, { passive: false });
        });
        delBtn.addEventListener('click', (e) => {
            e.preventDefault?.();
            stopDeleteEvent(e);
            deleteCharacter(char.id);
        });

        container.appendChild(item);
        container.appendChild(delBtn);
        listEl.appendChild(container);
    });

    initSwipeHandlers();
    syncThemeChrome();
}

function renderWechatClaudeMarkSvg(className = '') {
    return `<svg class="wc-claude-mark ${className}" viewBox="0 0 80 80" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round">
            <path d="M40 9v62"/><path d="M9 40h62"/>
            <path d="M18 18l44 44"/><path d="M62 18 18 62"/>
            <path d="M29 11l22 58"/><path d="M69 29 11 51"/>
            <path d="M51 11 29 69"/><path d="M11 29l58 22"/>
        </g>
    </svg>`;
}

function renderWechatClaudeChatWelcome() {
    return `<div class="wc-claude-chat-welcome" id="wc-claude-chat-welcome">
        ${renderWechatClaudeMarkSvg('wc-claude-welcome-mark')}
        <h2>How can I help you today?</h2>
    </div>`;
}

function getWechatGroupContacts(options = {}) {
    const includeGroupNpc = options.includeGroupNpc === true;
    return (window.myCharacters || []).filter(char => (
        char
        && char.id
        && !char.isGroupChat
        && (includeGroupNpc || !isWechatGroupNpcContact(char))
    ));
}

function getWechatGroupMembers(group) {
    const ids = Array.isArray(group?.groupMembers) ? group.groupMembers : [];
    return ids.map(id => getWechatGroupContacts({ includeGroupNpc: true }).find(char => char.id === id)).filter(Boolean);
}

function getWechatGroupMemberName(member) {
    return (member && member.chatConfig && member.chatConfig.nickname) || (member && member.name) || '成员';
}

function getWechatQQGroupUserProfile(group) {
    if (typeof getWechatChatUserProfile === 'function') return getWechatChatUserProfile(group);
    if (typeof getUserProfile === 'function') return getUserProfile();
    return {};
}

function getWechatQQGroupUserMember(group) {
    const profile = getWechatQQGroupUserProfile(group);
    const settings = getWechatQQGroupSettings(group);
    const selfProfile = settings.memberProfiles && typeof settings.memberProfiles === 'object'
        ? settings.memberProfiles[WECHAT_QQ_GROUP_USER_ID]
        : null;
    const selfRemark = selfProfile && typeof selfProfile === 'object' ? selfProfile.remark : '';
    return {
        id: WECHAT_QQ_GROUP_USER_ID,
        name: selfRemark || settings.myNickname || profile.name || '我',
        avatar: profile.avatar || DEFAULT_AVATAR,
        isUser: true
    };
}

function getWechatQQGroupDisplayMembers(group, options = {}) {
    const includeUser = options.includeUser !== false;
    const members = getWechatGroupMembers(group);
    return includeUser ? [getWechatQQGroupUserMember(group), ...members] : members;
}

function getWechatQQGroupMemberProfiles(group) {
    const settings = getWechatQQGroupSettings(group);
    if (!settings.memberProfiles || typeof settings.memberProfiles !== 'object' || Array.isArray(settings.memberProfiles)) {
        settings.memberProfiles = {};
    }
    return settings.memberProfiles;
}

function getWechatQQGroupOwnerId(group) {
    const settings = getWechatQQGroupSettings(group);
    settings.ownerId = WECHAT_QQ_GROUP_USER_ID;
    if (group) group.groupOwnerId = WECHAT_QQ_GROUP_USER_ID;
    const ownerProfile = getWechatQQGroupMemberProfile(group, WECHAT_QQ_GROUP_USER_ID);
    ownerProfile.role = 'owner';
    return WECHAT_QQ_GROUP_USER_ID;
}

function getWechatQQGroupMemberProfile(group, memberId) {
    const profiles = getWechatQQGroupMemberProfiles(group);
    const id = String(memberId || '');
    if (!id) return {};
    if (!profiles[id] || typeof profiles[id] !== 'object' || Array.isArray(profiles[id])) profiles[id] = {};
    return profiles[id];
}

function getWechatQQGroupMemberRole(group, memberId) {
    if (!group?.isGroupChat || !memberId) return 'member';
    if (memberId === WECHAT_QQ_GROUP_USER_ID) return 'owner';
    if (getWechatQQGroupOwnerId(group) === memberId) return 'owner';
    const profile = getWechatQQGroupMemberProfile(group, memberId);
    return profile.role === 'admin' ? 'admin' : 'member';
}

function getWechatQQGroupMemberDisplayName(group, member) {
    if (!member) return '成员';
    const profile = getWechatQQGroupMemberProfile(group, member.id);
    if (member.id === WECHAT_QQ_GROUP_USER_ID || member.isUser) {
        return profile.remark || member.name || '我';
    }
    return profile.remark || getWechatGroupMemberName(member);
}

function getWechatQQGroupMemberBadge(group, memberId) {
    const role = getWechatQQGroupMemberRole(group, memberId);
    const profile = getWechatQQGroupMemberProfile(group, memberId);
    if (role === 'owner') return { text: profile.title || '群主', kind: 'owner' };
    if (role === 'admin') return { text: profile.title || '管理员', kind: 'admin' };
    if (profile.title) return { text: profile.title, kind: 'title' };
    return null;
}

function renderWechatQQGroupMemberBadge(group, memberId) {
    const badge = getWechatQQGroupMemberBadge(group, memberId);
    if (!badge || !badge.text) return '';
    return `<em class="wcs-qq-member-badge ${wcEscapeAttr(badge.kind)}">${wcEscapeHtml(badge.text)}</em>`;
}

function renderWechatQQGroupMessageSenderLabel(group, member) {
    if (!group?.isGroupChat || !member) return '';
    const badgeHtml = renderWechatQQGroupMemberBadge(group, member.id);
    const name = getWechatQQGroupMemberDisplayName(group, member);
    return `<div class="msg-sender-name"><span class="msg-sender-name-line"><b>${wcEscapeHtml(name)}</b>${badgeHtml}</span></div>`;
}

function findWechatGroupMember(group, value) {
    const query = String(value || '').trim();
    if (!group || !query) return null;
    const members = getWechatGroupMembers(group);
    return members.find(member => {
        const display = getWechatGroupMemberName(member);
        const groupDisplay = getWechatQQGroupMemberDisplayName(group, member);
        return member.id === query || member.name === query || display === query || groupDisplay === query
            || query.includes(display) || display.includes(query)
            || query.includes(groupDisplay) || groupDisplay.includes(query);
    }) || null;
}

function normalizeWechatGroupSpeechText(text, group) {
    const source = cleanWechatVisibleContent(text);
    if (!source || !group?.isGroupChat) return { text: source, member: null };
    const match = source.match(/^\s*([^：:\n]{1,24})\s*[：:]\s*([\s\S]+)$/);
    if (!match) return { text: source, member: null };
    const member = findWechatGroupMember(group, match[1]);
    if (!member) return { text: source, member: null };
    return { text: match[2].trim(), member };
}

function attachWechatGroupSpeaker(msg, group, fallbackIndex = 0, fallbackMembers = null) {
    if (!msg || !group?.isGroupChat || msg.isMe || msg.type === 'system_notice') return msg;
    const scopedMembers = Array.isArray(fallbackMembers) ? fallbackMembers.filter(Boolean) : [];
    const members = scopedMembers.length ? scopedMembers : getWechatGroupMembers(group);
    const scopedIds = scopedMembers.length ? new Set(scopedMembers.map(member => member && member.id).filter(Boolean)) : null;
    if (!members.length) return msg;

    let speaker = null;
    if (msg.senderId || msg.speakerId || msg.senderName || msg.speakerName) {
        speaker = findWechatGroupMember(group, msg.senderId || msg.speakerId || msg.senderName || msg.speakerName);
        if (speaker && scopedIds && !scopedIds.has(speaker.id)) speaker = null;
    }
    if (!speaker && msg.type === 'text') {
        const normalized = normalizeWechatGroupSpeechText(msg.content, group);
        if (normalized.member) {
            speaker = normalized.member;
            msg = { ...msg, content: normalized.text };
            if (speaker && scopedIds && !scopedIds.has(speaker.id)) speaker = null;
        }
    }
    if (!speaker) {
        const safeIndex = Math.max(0, Math.min(members.length - 1, Number(fallbackIndex) || 0));
        speaker = members[safeIndex] || members[0];
    }
    if (!speaker) return msg;

    return {
        ...msg,
        senderId: speaker.id,
        senderName: getWechatQQGroupMemberDisplayName(group, speaker)
    };
}

function getWechatGroupMessageSpeakerMember(group, msg) {
    if (!group?.isGroupChat || !msg || msg.isMe || msg.type === 'system_notice') return null;
    const direct = findWechatGroupMember(group, msg.senderId || msg.speakerId || msg.senderName || msg.speakerName);
    if (direct) return direct;
    if (msg.type === 'text') {
        const normalized = normalizeWechatGroupSpeechText(msg.content, group);
        if (normalized.member) return normalized.member;
    }
    return null;
}

function getWechatGroupMissingReplyMembers(group, startIndex) {
    if (!group?.isGroupChat || !Array.isArray(group.history)) return [];
    const spokenIds = new Set();
    group.history.slice(Math.max(0, startIndex || 0)).forEach(msg => {
        const member = getWechatGroupMessageSpeakerMember(group, msg);
        if (member && member.id) spokenIds.add(member.id);
    });
    return getWechatGroupMembers(group).filter(member => member && member.id && !spokenIds.has(member.id));
}

function getWechatGroupNextFallbackMembers(group, startIndex, preferredMembers = null) {
    if (!group?.isGroupChat) return [];
    const base = Array.isArray(preferredMembers) && preferredMembers.length
        ? preferredMembers.filter(Boolean)
        : getWechatGroupMembers(group);
    if (!base.length) return [];
    const spokenIds = new Set();
    if (Array.isArray(group.history)) {
        group.history.slice(Math.max(0, startIndex || 0)).forEach(msg => {
            const member = getWechatGroupMessageSpeakerMember(group, msg);
            if (member && member.id) spokenIds.add(member.id);
        });
    }
    const missing = base.filter(member => member && member.id && !spokenIds.has(member.id));
    return missing.length ? missing : base;
}

function getWechatLastVisibleMessageBefore(char, endIndex) {
    const history = Array.isArray(char?.history) ? char.history : [];
    for (let i = Math.min(history.length, endIndex || history.length) - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg && msg.type !== 'system_notice') return msg;
    }
    return null;
}

function buildWechatGroupAvatar(group) {
    const members = Array.isArray(group?.groupMembers) ? group.groupMembers : [];
    const hue = Math.abs(String(group?.id || group?.name || 'group').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % 360;
    const label = group?.isGroupChat ? getWechatQQGroupDisplayMembers(group).length : (members.length || 'G');
    return 'data:image/svg+xml,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
            <rect width="120" height="120" rx="24" fill="hsl(${hue},70%,92%)"/>
            <rect x="18" y="18" width="38" height="38" rx="12" fill="hsl(${hue},70%,58%)"/>
            <rect x="64" y="18" width="38" height="38" rx="12" fill="hsl(${(hue + 36) % 360},70%,66%)"/>
            <rect x="18" y="64" width="38" height="38" rx="12" fill="hsl(${(hue + 72) % 360},68%,72%)"/>
            <rect x="64" y="64" width="38" height="38" rx="12" fill="#ffffff"/>
            <text x="83" y="88" text-anchor="middle" font-family="Arial" font-size="24" font-weight="800" fill="hsl(${hue},54%,34%)">${label}</text>
        </svg>
    `);
}

let wechatPlusMenuCloser = null;

function isWechatPlusMenuTrigger(target) {
    return !!(target && target.closest && target.closest('.wc-header-right, [onclick*="openWechatPlusMenu"]'));
}

function closeWechatPlusMenu() {
    document.getElementById('wc-plus-menu')?.remove();
    if (wechatPlusMenuCloser) {
        document.removeEventListener('click', wechatPlusMenuCloser, true);
        wechatPlusMenuCloser = null;
    }
}

function openWechatPlusMenu(event) {
    event?.stopPropagation?.();
    const old = document.getElementById('wc-plus-menu');
    if (old) {
        old.remove();
        return;
    }
    const root = document.getElementById('app-wechat-window');
    if (!root) return;
    const menu = document.createElement('div');
    menu.id = 'wc-plus-menu';
    const fromXFab = !!(event && event.currentTarget && event.currentTarget.closest && event.currentTarget.closest('.wc-x-compose-fab'));
    menu.className = `wc-plus-menu${fromXFab ? ' wc-plus-menu-x-fab' : ''}`;
    menu.innerHTML = `
        <button type="button" onclick="closeWechatPlusMenu();testAddCharacter()"><i class="ri-user-add-line"></i><span>导入角色</span></button>
        <button type="button" class="is-builtin" onclick="closeWechatPlusMenu();ByndBuiltinLibrary?.open()"><i class="ri-star-smile-line"></i><span>内置角色</span></button>
        <button type="button" onclick="openWechatCharacterGenerator()"><i class="ri-sparkling-2-line"></i><span>角色卡生成器</span></button>
        <button type="button" onclick="openWechatGroupCreator()"><i class="ri-group-line"></i><span>发起群聊</span></button>
        <button type="button" onclick="startWechatScreenShare()"><i class="ri-cast-line"></i><span>共享屏幕</span></button>
    `;
    root.appendChild(menu);
    setTimeout(() => {
        if (wechatPlusMenuCloser) {
            document.removeEventListener('click', wechatPlusMenuCloser, true);
        }
        wechatPlusMenuCloser = (ev) => {
            if (!ev.target.closest('#wc-plus-menu') && !isWechatPlusMenuTrigger(ev.target)) {
                closeWechatPlusMenu();
            }
        };
        document.addEventListener('click', wechatPlusMenuCloser, true);
    }, 0);
}
window.openWechatPlusMenu = openWechatPlusMenu;
window.closeWechatPlusMenu = closeWechatPlusMenu;

function openWechatSearch() {
    const root = document.getElementById('app-wechat-window');
    const input = document.getElementById('wc-search-input');
    if (!root || !input) return;
    closeWechatPlusMenu();
    root.classList.add('wc-search-open');
    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });
}

function closeWechatSearch() {
    const root = document.getElementById('app-wechat-window');
    const input = document.getElementById('wc-search-input');
    if (input) input.value = '';
    filterChatList('');
    if (root) root.classList.remove('wc-search-open');
}

function getWechatMessageSearchText(msg) {
    if (!msg) return '';
    if (isWechatRegexPayloadMessage(msg)) return '';
    if (isWechatSpecialMessage(msg.type)) return getWechatMessageSummary(msg);
    if (msg.type === 'image_stack') return `[${getWechatImageStackSources(msg).length || 0}张图片]`;
    if (msg.type === 'image') return '[图片]';
    if (msg.type === 'sticker') return msg.stickerName ? `[表情] ${msg.stickerName}` : '[表情]';
    if (msg.type === 'system_notice') return msg.content || '';
    return stripWechatPromptText(msg.content || msg.dialogue || msg.description || '', 260);
}

function renderWechatCurrentChatSearchResults(query = '') {
    const list = document.getElementById('wc-chat-message-search-results');
    if (!list) return;
    const char = getCurrentChatChar();
    if (!char) {
        list.innerHTML = '<div class="wc-chat-search-empty">没有打开聊天</div>';
        return;
    }
    const q = String(query || '').trim().toLowerCase();
    const history = Array.isArray(char.history) ? char.history : [];
    const rows = history
        .map((msg, index) => ({ msg, index, text: getWechatMessageSearchText(msg) }))
        .filter(item => item.text && item.msg && item.msg.type !== 'system_notice')
        .filter(item => !q || item.text.toLowerCase().includes(q))
        .slice(q ? 0 : Math.max(0, history.length - 24), q ? 80 : history.length)
        .reverse();
    if (!rows.length) {
        list.innerHTML = `<div class="wc-chat-search-empty">${q ? '没有搜到相关消息' : '还没有可搜索的消息'}</div>`;
        return;
    }
    list.innerHTML = rows.map(item => {
        const side = item.msg.isMe ? '你' : getWechatCharDisplayName(char);
        const time = formatMessageTime(item.msg);
        return `
            <button type="button" class="wc-chat-search-result" onclick="openWechatSearchResult(${Number(item.index)})">
                <b>${wcEscapeHtml(side)}</b>
                <span>${wcEscapeHtml(item.text)}</span>
                <em>${wcEscapeHtml(time)}</em>
            </button>
        `;
    }).join('');
}

function openWechatCurrentChatSearch() {
    const char = getCurrentChatChar();
    if (!char) {
        showWechatToast('先打开一个聊天');
        return;
    }
    closeChatToolbar();
    openWechatFeatureScreen('搜索消息', `
        <div class="wc-chat-search-page">
            <label class="wc-chat-search-box">
                <i class="ri-search-line"></i>
                <input id="wc-chat-message-search-input" placeholder="搜索当前聊天记录" oninput="renderWechatCurrentChatSearchResults(this.value)">
            </label>
            <div id="wc-chat-message-search-results" class="wc-chat-search-results"></div>
        </div>
    `);
    setWechatFeatureLeftText('取消', 'closeWechatFeatureScreen()');
    requestAnimationFrame(() => {
        document.getElementById('wc-chat-message-search-input')?.focus();
        renderWechatCurrentChatSearchResults('');
    });
}

function openWechatSearchResult(msgIdx) {
    const char = getCurrentChatChar();
    if (!char) return;
    window._wechatExpandedHistoryIds = window._wechatExpandedHistoryIds || new Set();
    window._wechatExpandedHistoryIds.add(char.id);
    closeWechatFeatureScreen();
    refreshChatView(char);
    setTimeout(() => {
        const row = document.querySelector(`.msg-row[data-msg-idx="${Number(msgIdx)}"]`);
        if (!row) return;
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        row.classList.add('msg-source-highlight');
        setTimeout(() => row.classList.remove('msg-source-highlight'), 1600);
    }, 260);
}

window.openWechatSearch = openWechatSearch;
window.closeWechatSearch = closeWechatSearch;
window.openWechatCurrentChatSearch = openWechatCurrentChatSearch;
window.renderWechatCurrentChatSearchResults = renderWechatCurrentChatSearchResults;
window.openWechatSearchResult = openWechatSearchResult;

function openWechatGroupCreator() {
    closeWechatPlusMenu();
    const contacts = getWechatGroupContacts();
    window._wechatGroupDraftIds = Array.isArray(window._wechatGroupDraftIds) ? window._wechatGroupDraftIds.filter(id => contacts.some(c => c.id === id)) : [];
    const html = `
        <div class="wc-group-create">
            <div class="wc-group-create-top">
                <strong>选择联系人</strong>
                <span>从现有 AI 联系人里拉进群聊，至少选择 2 个。</span>
            </div>
            <input id="wc-group-name-input" class="wc-group-name-input" maxlength="24" placeholder="群聊名称，可留空自动生成">
            <div class="wc-group-select-list">
                ${contacts.length ? contacts.map(char => `
                    <button type="button" class="wc-group-select-item ${window._wechatGroupDraftIds.includes(char.id) ? 'active' : ''}" onclick="toggleWechatGroupDraftMember(${quoteWechatJsString(char.id)})">
                        <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                        <span>${wcEscapeHtml((char.chatConfig && char.chatConfig.nickname) || char.name || '未命名')}</span>
                        <i class="${window._wechatGroupDraftIds.includes(char.id) ? 'ri-checkbox-circle-fill' : 'ri-add-circle-line'}"></i>
                    </button>
                `).join('') : '<div class="wc-contacts-empty">还没有可拉入群聊的联系人</div>'}
            </div>
            <button type="button" class="wc-group-create-btn" onclick="createWechatGroupChat()">创建群聊</button>
        </div>
    `;
    openWechatFeatureScreen('发起群聊', html);
}
window.openWechatGroupCreator = openWechatGroupCreator;
window.openWechatGroupCreate = openWechatGroupCreator;

function toggleWechatGroupDraftMember(charId) {
    const ids = Array.isArray(window._wechatGroupDraftIds) ? window._wechatGroupDraftIds : [];
    window._wechatGroupDraftIds = ids.includes(charId) ? ids.filter(id => id !== charId) : [...ids, charId];
    openWechatGroupCreator();
}
window.toggleWechatGroupDraftMember = toggleWechatGroupDraftMember;

function createWechatGroupChat() {
    const ids = Array.isArray(window._wechatGroupDraftIds) ? window._wechatGroupDraftIds : [];
    const members = ids.map(id => getWechatGroupContacts().find(char => char.id === id)).filter(Boolean);
    if (members.length < 2) {
        if (typeof showWechatToast === 'function') showWechatToast('至少选择 2 个联系人');
        return;
    }
    const inputName = (document.getElementById('wc-group-name-input')?.value || '').trim();
    const name = inputName || members.slice(0, 3).map(char => (char.chatConfig && char.chatConfig.nickname) || char.name || '好友').join('、') + (members.length > 3 ? ` 等${members.length}人` : '');
    const group = {
        id: 'group_' + Date.now(),
        name,
        description: '微信联系人群聊',
        avatar: '',
        isGroupChat: true,
        groupMembers: members.map(char => char.id),
        groupOwnerId: WECHAT_QQ_GROUP_USER_ID,
        groupCreatedAt: Date.now(),
        chatConfig: { qqGroupSettings: { ownerId: WECHAT_QQ_GROUP_USER_ID } },
        history: [
            { type: 'system_notice', isMe: false, content: `你邀请 ${members.map(char => (char.chatConfig && char.chatConfig.nickname) || char.name || '好友').join('、')} 加入了群聊`, timestamp: createMessageTimestamp() }
        ]
    };
    group.avatar = buildWechatGroupAvatar(group);
    window.myCharacters.unshift(group);
    window._wechatGroupDraftIds = [];
    saveCharactersToStorage();
    closeWechatFeatureScreen();
    switchWcTab('chat');
    renderChatList();
    openChat(group.id);
}
window.createWechatGroupChat = createWechatGroupChat;

function isWechatQQGroupSettingsAvailable(group) {
    return !!(group && group.isGroupChat && getWechatUiThemeId() === 'qq');
}

function syncWechatQQGroupSettingsEntry(group) {
    const wrap = document.getElementById('wcs-qq-group-entry-wrap');
    if (!wrap) return;
    const available = isWechatQQGroupSettingsAvailable(group);
    wrap.classList.toggle('hidden', !available);
    if (!available) return;
    const settings = getWechatQQGroupSettings(group);
    const summary = document.getElementById('wcs-qq-group-entry-summary');
    if (summary) {
        const count = getWechatQQGroupDisplayMembers(group).length;
        const tags = [
            `${count}人`,
            settings.pinned ? '已置顶' : '',
            settings.muteNotifications ? '免打扰' : '',
            settings.hideChat ? '隐藏预览' : ''
        ].filter(Boolean);
        summary.textContent = tags.join(' · ') || '群信息、成员、免打扰等';
    }
}

function ensureWechatQQGroupSettingsPage() {
    const panel = document.getElementById('wc-chat-settings-panel');
    if (!panel) return null;
    let page = document.getElementById('wcs-qq-group-settings-page');
    if (!page) {
        page = document.createElement('div');
        page.id = 'wcs-qq-group-settings-page';
        page.className = 'wcs-qq-group-subpage';
        panel.appendChild(page);
    }
    return page;
}

function closeWechatQQGroupSettings() {
    document.getElementById('wcs-qq-group-settings-page')?.classList.remove('active');
    document.getElementById('wcs-qq-group-resource-page')?.remove();
}

function renderWechatQQGroupMemberStrip(group) {
    const members = getWechatQQGroupDisplayMembers(group);
    const settings = getWechatQQGroupSettings(group);
    const inviteEnabled = getWechatQQGroupFlag(settings, 'memberInviteEnabled', true);
    const removeEnabled = getWechatQQGroupFlag(settings, 'memberRemoveEnabled', true);
    const people = members.map(member => ({
            id: member.id,
            name: getWechatQQGroupMemberDisplayName(group, member),
            avatar: member.avatar || DEFAULT_AVATAR,
            isUser: !!member.isUser
        }))
        .slice(0, 3);
    const avatars = people.map(person => `
        <button type="button" class="wcs-qq-member-mini" onclick="${person.isUser ? `openWechatQQGroupMemberSettings(${quoteWechatJsString(WECHAT_QQ_GROUP_USER_ID)})` : `openWechatContactProfile(${quoteWechatJsString(person.id)})`}">
            <img src="${wcEscapeAttr(person.avatar)}" onerror="this.src='${DEFAULT_AVATAR}'">
            <span><b>${wcEscapeHtml(person.name)}</b>${renderWechatQQGroupMemberBadge(group, person.id)}</span>
        </button>
    `).join('');
    return `
        ${avatars}
        <button type="button" class="wcs-qq-member-mini action" onclick="${inviteEnabled ? "openWechatQQGroupMemberPicker('add')" : 'openWechatQQGroupManagePage()'}"><i class="ri-add-line"></i><span>邀请</span></button>
        <button type="button" class="wcs-qq-member-mini action" onclick="${removeEnabled ? "openWechatQQGroupMemberPicker('remove')" : 'openWechatQQGroupManagePage()'}"><i class="ri-subtract-line"></i><span>移除</span></button>
    `;
}

function renderWechatQQGroupSettingsHtml(group) {
    const settings = getWechatQQGroupSettings(group);
    getWechatQQGroupOwnerId(group);
    const members = getWechatQQGroupDisplayMembers(group);
    const notificationMode = settings.notificationMode || (settings.muteNotifications ? 'silent' : 'all');
    const notifyText = notificationMode === 'blocked'
        ? '屏蔽群消息'
        : (notificationMode === 'silent' ? '接收消息但不提醒' : '接收并提醒');
    const groupRemarkText = settings.groupRemark || '未设置';
    const announcementText = settings.announcement || '未设置';
    const myNickText = settings.myNickname || '未设置';
    const personalityText = settings.personality || '群关系、标识佩戴等';
    return `
        <div class="wcs-qq-group-header">
            <i class="ri-arrow-left-s-line" onclick="closeWechatQQGroupSettings()"></i>
            <span>聊天信息</span>
            <i class="ri-more-fill"></i>
        </div>
        <div class="wcs-qq-group-body">
            <div class="wcs-qq-group-profile">
                <img src="${wcEscapeAttr(group.avatar || buildWechatGroupAvatar(group))}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div>
                    <strong>${wcEscapeHtml(group.name || '群聊')}</strong>
                    <span>群号：${wcEscapeHtml(settings.groupNumber || buildWechatQQGroupNumber(group))}</span>
                    <em><i class="${settings.allowSearch ? 'ri-search-eye-line' : 'ri-lock-line'}"></i>${settings.allowSearch ? '允许被搜索' : '不允许被搜索'}</em>
                </div>
                <button type="button" class="wcs-qq-qr-btn" onclick="openWechatQQGroupQrCode()" aria-label="打开群二维码"><i class="ri-qr-code-line"></i></button>
            </div>

            <div class="wcs-qq-card member-card">
                <button type="button" class="wcs-qq-card-title" onclick="openWechatQQGroupMemberPicker('manage')">
                    <strong>群成员</strong><em>${members.length}人</em><i class="ri-arrow-right-s-line"></i>
                </button>
                <div class="wcs-qq-member-strip">${renderWechatQQGroupMemberStrip(group)}</div>
            </div>

            <div class="wcs-qq-card info-card">
                <button type="button" class="wcs-qq-link-row" onclick="openWechatQQGroupEditField('name')"><span>群名称</span><em>${wcEscapeHtml(group.name || '群聊')}</em><i class="ri-arrow-right-s-line"></i></button>
                <button type="button" class="wcs-qq-link-row" onclick="openWechatQQGroupEditField('remark')"><span>群备注</span><em>${wcEscapeHtml(groupRemarkText)}</em><i class="ri-arrow-right-s-line"></i></button>
                <button type="button" class="wcs-qq-link-row" onclick="openWechatQQGroupEditField('announcement')"><span>群公告</span><em>${wcEscapeHtml(announcementText)}</em><i class="ri-arrow-right-s-line"></i></button>
                <button type="button" class="wcs-qq-link-row" onclick="openWechatQQGroupManagePage()"><span>管理群</span><em>加群设置、发言管理等</em><i class="ri-arrow-right-s-line"></i></button>
            </div>

            <div class="wcs-qq-card apps">
                <button type="button" class="wcs-qq-card-title" onclick="openWechatQQGroupResource('files')">
                    <strong>群应用</strong><em></em><i class="ri-arrow-right-s-line"></i>
                </button>
                <div class="wcs-qq-app-grid">
                    <button type="button" onclick="openWechatQQGroupResource('files')"><i class="ri-folder-fill"></i><span>文件</span></button>
                    <button type="button" onclick="openWechatQQGroupResource('photos')"><i class="ri-image-fill"></i><span>相册</span></button>
                    <button type="button" onclick="openWechatQQGroupResource('highlights')"><i class="ri-star-smile-fill"></i><span>精华消息</span></button>
                </div>
                <label class="wcs-qq-switch-row"><span>群快捷栏</span><em>边聊边使用小程序、文档等</em><input type="checkbox" id="wcs-qq-group-shortcut" onchange="saveWechatQQGroupQuickSettings()" ${settings.shortcutBar ? 'checked' : ''}></label>
                <button type="button" class="wcs-qq-link-row" onclick="openWechatQQGroupRobotEditor()"><span>群机器人</span><em>${(settings.robots || []).length ? `${settings.robots.length}个` : '未添加'}</em><i class="ri-arrow-right-s-line"></i></button>
            </div>

            <div class="wcs-qq-card">
                <button type="button" class="wcs-qq-link-row" onclick="openWechatQQGroupSearchFromSettings()"><span>查找聊天记录</span><em>图片、视频、文件等</em><i class="ri-arrow-right-s-line"></i></button>
                <label class="wcs-qq-switch-row"><span>设为置顶</span><input type="checkbox" id="wcs-qq-group-pinned" onchange="saveWechatQQGroupQuickSettings()" ${settings.pinned ? 'checked' : ''}></label>
                <label class="wcs-qq-switch-row"><span>隐藏会话</span><input type="checkbox" id="wcs-qq-group-hide" onchange="saveWechatQQGroupQuickSettings()" ${settings.hideChat ? 'checked' : ''}></label>
                <label class="wcs-qq-switch-row"><span>消息免打扰</span><input type="checkbox" id="wcs-qq-group-mute" onchange="saveWechatQQGroupQuickSettings()" ${settings.muteNotifications ? 'checked' : ''}></label>
                <button type="button" class="wcs-qq-link-row ${notificationMode === 'blocked' ? 'disabled' : ''}" onclick="openWechatQQGroupNotificationPage()"><span>消息提醒方式</span><em>${wcEscapeHtml(notifyText)}</em><i class="ri-arrow-right-s-line"></i></button>
                <button type="button" class="wcs-qq-link-row muted"><span>消息通知设置</span><em>消息预览、提示音等</em><i class="ri-arrow-right-s-line"></i></button>
            </div>

            <div class="wcs-qq-card">
                <button type="button" class="wcs-qq-link-row" onclick="openWechatQQGroupEditField('myNickname')"><span>我在本群的昵称</span><em>${wcEscapeHtml(myNickText)}</em><i class="ri-arrow-right-s-line"></i></button>
                <button type="button" class="wcs-qq-link-row" onclick="openWechatQQGroupMemberPicker('manage')"><span>群成员备注与头衔</span><em>群主、管理员、专属头衔</em><i class="ri-arrow-right-s-line"></i></button>
                <button type="button" class="wcs-qq-link-row" onclick="openWechatQQGroupEditField('personality')"><span>个性设置</span><em>${wcEscapeHtml(personalityText)}</em><i class="ri-arrow-right-s-line"></i></button>
                <label class="wcs-qq-switch-row"><span>允许通过群号搜索</span><input type="checkbox" id="wcs-qq-group-searchable" onchange="saveWechatQQGroupQuickSettings()" ${settings.allowSearch ? 'checked' : ''}></label>
            </div>

            <div class="wcs-qq-card danger">
                <button type="button" onclick="clearCurrentWechatChatHistory()">删除聊天记录</button>
                <button type="button" class="danger" onclick="dismissWechatQQGroupChat()">解散群聊</button>
            </div>
        </div>
    `;
}

function openWechatQQGroupSettings() {
    const group = getCurrentChatChar();
    if (!isWechatQQGroupSettingsAvailable(group)) {
        showWechatToast('QQ 主题的群聊才有这个设置');
        return;
    }
    const page = ensureWechatQQGroupSettingsPage();
    if (!page) return;
    page.innerHTML = renderWechatQQGroupSettingsHtml(group);
    page.classList.add('active');
    page.querySelector('.wcs-qq-group-body')?.scrollTo?.(0, 0);
}
window.openWechatQQGroupSettings = openWechatQQGroupSettings;

function saveWechatQQGroupSettingsFromPanel() {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    const prevName = group.name || '';
    const nameEl = document.getElementById('wcs-qq-group-name');
    const nextName = nameEl ? ((nameEl.value || '').trim() || prevName || '群聊') : (prevName || '群聊');
    group.name = nextName;
    const remarkEl = document.getElementById('wcs-qq-group-remark');
    const announcementEl = document.getElementById('wcs-qq-group-announcement');
    const myNickEl = document.getElementById('wcs-qq-group-my-nick');
    const personalityEl = document.getElementById('wcs-qq-group-personality');
    if (remarkEl) settings.groupRemark = (remarkEl.value || '').trim();
    if (announcementEl) settings.announcement = (announcementEl.value || '').trim();
    if (myNickEl) settings.myNickname = (myNickEl.value || '').trim();
    if (personalityEl) settings.personality = (personalityEl.value || '').trim();
    saveWechatQQGroupQuickSettings({ silent: true });
    group.chatConfig = group.chatConfig || {};
    group.chatConfig.qqGroupSettings = settings;
    if (!group.avatar || /^data:image\/svg\+xml/.test(group.avatar)) group.avatar = buildWechatGroupAvatar(group);
    if (prevName && prevName !== nextName) {
        group.history = Array.isArray(group.history) ? group.history : [];
        group.history.push({ type: 'system_notice', isMe: false, content: `群名称已修改为「${nextName}」`, timestamp: createMessageTimestamp() });
    }
    saveCharactersToStorage();
    applyChatConfig(group);
    refreshChatView(group);
    renderChatList();
    syncWechatQQGroupSettingsEntry(group);
    openWechatQQGroupSettings();
    showWechatToast('QQ群设置已保存');
}
window.saveWechatQQGroupSettingsFromPanel = saveWechatQQGroupSettingsFromPanel;

function saveWechatQQGroupQuickSettings(options = {}) {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    const shortcutEl = document.getElementById('wcs-qq-group-shortcut');
    const pinnedEl = document.getElementById('wcs-qq-group-pinned');
    const hideEl = document.getElementById('wcs-qq-group-hide');
    const muteEl = document.getElementById('wcs-qq-group-mute');
    const searchableEl = document.getElementById('wcs-qq-group-searchable');
    if (shortcutEl) settings.shortcutBar = !!shortcutEl.checked;
    if (pinnedEl) settings.pinned = !!pinnedEl.checked;
    if (hideEl) settings.hideChat = !!hideEl.checked;
    if (muteEl) settings.muteNotifications = !!muteEl.checked;
    if (searchableEl) settings.allowSearch = !!searchableEl.checked;
    if (!settings.notificationMode) settings.notificationMode = settings.muteNotifications ? 'silent' : 'all';
    if (muteEl && settings.muteNotifications && settings.notificationMode === 'all') settings.notificationMode = 'silent';
    if (muteEl && !settings.muteNotifications && settings.notificationMode === 'silent') settings.notificationMode = 'all';
    group.chatConfig = group.chatConfig || {};
    group.chatConfig.qqGroupSettings = settings;
    saveCharactersToStorage();
    applyChatConfig(group);
    renderChatList();
    syncWechatQQGroupSettingsEntry(group);
    if (!options.silent) showWechatToast('QQ群设置已更新');
}
window.saveWechatQQGroupQuickSettings = saveWechatQQGroupQuickSettings;

function getWechatQQGroupEditFieldConfig(kind, group) {
    const settings = getWechatQQGroupSettings(group);
    const profile = getWechatQQGroupUserProfile(group);
    const map = {
        name: { title: '群名称', label: '群名称', value: group.name || '', placeholder: '输入群名称', max: 36, multiline: false },
        remark: { title: '群备注', label: '群备注', value: settings.groupRemark || '', placeholder: '未设置', max: 36, multiline: false },
        announcement: { title: '群公告', label: '群公告', value: settings.announcement || '', placeholder: '写一条群公告', max: 240, multiline: true },
        myNickname: { title: '我在本群的昵称', label: '本群昵称', value: settings.myNickname || profile.name || '', placeholder: '未设置', max: 24, multiline: false },
        personality: { title: '个性设置', label: '个性设置', value: settings.personality || '', placeholder: '群关系、标识佩戴等', max: 180, multiline: true }
    };
    return map[kind] || map.name;
}

function openWechatQQGroupEditField(kind) {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const config = getWechatQQGroupEditFieldConfig(kind, group);
    const control = config.multiline
        ? `<textarea id="wcs-qq-edit-value" maxlength="${Number(config.max)}" rows="5" placeholder="${wcEscapeAttr(config.placeholder)}">${wcEscapeHtml(config.value)}</textarea>`
        : `<input id="wcs-qq-edit-value" maxlength="${Number(config.max)}" value="${wcEscapeAttr(config.value)}" placeholder="${wcEscapeAttr(config.placeholder)}">`;
    openWechatQQGroupResourceShell(config.title, `
        <div class="wcs-qq-card wcs-qq-editor-card">
            <label><span>${wcEscapeHtml(config.label)}</span>${control}</label>
        </div>
        <button type="button" class="wcs-qq-save" onclick="saveWechatQQGroupEditField(${quoteWechatJsString(kind)})">保存</button>
    `);
    requestAnimationFrame(() => document.getElementById('wcs-qq-edit-value')?.focus());
}
window.openWechatQQGroupEditField = openWechatQQGroupEditField;

function saveWechatQQGroupEditField(kind) {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    const value = (document.getElementById('wcs-qq-edit-value')?.value || '').trim();
    const prevName = group.name || '';
    if (kind === 'name') {
        group.name = value || prevName || '群聊';
        if (prevName && prevName !== group.name) {
            group.history = Array.isArray(group.history) ? group.history : [];
            group.history.push({ type: 'system_notice', isMe: false, content: `群名称已修改为「${group.name}」`, timestamp: createMessageTimestamp() });
        }
    } else if (kind === 'remark') {
        settings.groupRemark = value;
    } else if (kind === 'announcement') {
        settings.announcement = value;
    } else if (kind === 'myNickname') {
        settings.myNickname = value;
    } else if (kind === 'personality') {
        settings.personality = value;
    }
    group.chatConfig = group.chatConfig || {};
    group.chatConfig.qqGroupSettings = settings;
    saveCharactersToStorage();
    refreshChatView(group);
    renderChatList();
    closeWechatQQGroupResource();
    openWechatQQGroupSettings();
    showWechatToast('已保存');
}
window.saveWechatQQGroupEditField = saveWechatQQGroupEditField;

function openWechatQQGroupNotificationPage() {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    const mode = settings.notificationMode || (settings.muteNotifications ? 'silent' : 'all');
    const rows = [
        ['all', '接收并提醒', '正常显示未读和提醒'],
        ['silent', '接收消息但不提醒', '保留未读，不弹出提醒'],
        ['blocked', '屏蔽群消息', '不显示未读和桌面提醒']
    ];
    openWechatQQGroupResourceShell('消息提醒方式', `
        <div class="wcs-qq-card">
            ${rows.map(row => `
                <button type="button" class="wcs-qq-option-row ${mode === row[0] ? 'active' : ''}" onclick="setWechatQQGroupNotificationMode(${quoteWechatJsString(row[0])})">
                    <span><b>${wcEscapeHtml(row[1])}</b><em>${wcEscapeHtml(row[2])}</em></span>
                    <i class="${mode === row[0] ? 'ri-check-line' : ''}"></i>
                </button>
            `).join('')}
        </div>
    `);
}
window.openWechatQQGroupNotificationPage = openWechatQQGroupNotificationPage;

function setWechatQQGroupNotificationMode(mode) {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    settings.notificationMode = ['all', 'silent', 'blocked'].includes(mode) ? mode : 'all';
    settings.muteNotifications = settings.notificationMode !== 'all';
    group.chatConfig = group.chatConfig || {};
    group.chatConfig.qqGroupSettings = settings;
    saveCharactersToStorage();
    renderChatList();
    syncWechatQQGroupSettingsEntry(group);
    openWechatQQGroupNotificationPage();
}
window.setWechatQQGroupNotificationMode = setWechatQQGroupNotificationMode;

function getWechatQQGroupQrCellDark(seed, x, y) {
    let hash = 2166136261;
    const text = `${seed}:${x}:${y}`;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 100 < 44;
}

function isWechatQQGroupQrFinderCell(x, y, ox, oy) {
    const dx = x - ox;
    const dy = y - oy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
    if (dx === 0 || dy === 0 || dx === 6 || dy === 6) return true;
    if (dx === 1 || dy === 1 || dx === 5 || dy === 5) return false;
    return true;
}

function renderWechatQQGroupQrGrid(group) {
    const settings = getWechatQQGroupSettings(group);
    const seed = `${settings.groupNumber}:${group.id || ''}`;
    const size = 21;
    let html = '';
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const finder = isWechatQQGroupQrFinderCell(x, y, 0, 0)
                ?? isWechatQQGroupQrFinderCell(x, y, size - 7, 0)
                ?? isWechatQQGroupQrFinderCell(x, y, 0, size - 7);
            const dark = finder == null ? getWechatQQGroupQrCellDark(seed, x, y) : finder;
            html += `<i class="${dark ? 'dark' : ''}"></i>`;
        }
    }
    return html;
}

function openWechatQQGroupQrCode() {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    openWechatQQGroupResourceShell('群二维码', `
        <div class="wcs-qq-qr-card">
            <img src="${wcEscapeAttr(group.avatar || buildWechatGroupAvatar(group))}" onerror="this.src='${DEFAULT_AVATAR}'">
            <strong>${wcEscapeHtml(group.name || '群聊')}</strong>
            <span>群号：${wcEscapeHtml(settings.groupNumber)}</span>
            <div class="wcs-qq-qr-grid">${renderWechatQQGroupQrGrid(group)}</div>
            <em>二维码内容绑定当前群号，可用于展示和分享这个群。</em>
        </div>
    `);
}
window.openWechatQQGroupQrCode = openWechatQQGroupQrCode;

function openWechatQQGroupManagePage() {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    const pendingIds = Array.isArray(settings.pendingMembers) ? settings.pendingMembers : [];
    const contacts = getWechatGroupContacts({ includeGroupNpc: true });
    const pendingRows = pendingIds
        .map(id => contacts.find(char => char.id === id))
        .filter(Boolean);
    openWechatQQGroupResourceShell('管理群', `
        <div class="wcs-qq-card">
            <label class="wcs-qq-switch-row"><span>允许成员邀请</span><em>关闭后邀请入口会进入管理页</em><input type="checkbox" id="wcs-qq-manage-invite" ${getWechatQQGroupFlag(settings, 'memberInviteEnabled', true) ? 'checked' : ''}></label>
            <label class="wcs-qq-switch-row"><span>允许移除成员</span><em>关闭后不能从群里移除角色</em><input type="checkbox" id="wcs-qq-manage-remove" ${getWechatQQGroupFlag(settings, 'memberRemoveEnabled', true) ? 'checked' : ''}></label>
            <label class="wcs-qq-switch-row"><span>精华消息</span><em>关闭后不能新增或取消精华</em><input type="checkbox" id="wcs-qq-manage-highlight" ${getWechatQQGroupFlag(settings, 'highlightEnabled', true) ? 'checked' : ''}></label>
            <label class="wcs-qq-switch-row"><span>群机器人</span><em>关闭后不能新增或删除机器人</em><input type="checkbox" id="wcs-qq-manage-robot" ${getWechatQQGroupFlag(settings, 'robotEnabled', true) ? 'checked' : ''}></label>
            <label class="wcs-qq-switch-row"><span>加群需要确认</span><em>邀请成员后先进入待审核</em><input type="checkbox" id="wcs-qq-manage-approval" ${settings.joinApproval ? 'checked' : ''}></label>
            <label class="wcs-qq-switch-row"><span>全员禁言</span><em>开启后不能在群内发送新消息</em><input type="checkbox" id="wcs-qq-manage-speech-muted" ${settings.speechMuted ? 'checked' : ''}></label>
        </div>
        <div class="wcs-qq-card">
            <button type="button" class="wcs-qq-link-row" onclick="openWechatQQGroupMemberPicker('add')"><span>邀请成员</span><em>${getWechatQQGroupFlag(settings, 'memberInviteEnabled', true) ? '可用' : '已关闭'}</em><i class="ri-arrow-right-s-line"></i></button>
            <button type="button" class="wcs-qq-link-row" onclick="openWechatQQGroupMemberPicker('remove')"><span>移除成员</span><em>${getWechatQQGroupFlag(settings, 'memberRemoveEnabled', true) ? '可用' : '已关闭'}</em><i class="ri-arrow-right-s-line"></i></button>
        </div>
        <div class="wcs-qq-card">
            <button type="button" class="wcs-qq-card-title">
                <strong>待审核成员</strong><em>${pendingRows.length}人</em><i></i>
            </button>
            <div class="wcs-qq-resource-list">
                ${pendingRows.length ? pendingRows.map(char => `
                    <button type="button">
                        <span>${wcEscapeHtml(getWechatGroupMemberName(char))}</span>
                        <em>
                            <b onclick="approveWechatQQGroupPendingMember(${quoteWechatJsString(char.id)})">同意</b>
                            <b onclick="rejectWechatQQGroupPendingMember(${quoteWechatJsString(char.id)})">拒绝</b>
                        </em>
                    </button>
                `).join('') : '<div class="wcs-qq-empty">暂无待审核成员。</div>'}
            </div>
        </div>
        <button type="button" class="wcs-qq-save" onclick="saveWechatQQGroupManageSettings()">保存管理设置</button>
    `);
}
window.openWechatQQGroupManagePage = openWechatQQGroupManagePage;

function saveWechatQQGroupManageSettings() {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    settings.memberInviteEnabled = !!document.getElementById('wcs-qq-manage-invite')?.checked;
    settings.memberRemoveEnabled = !!document.getElementById('wcs-qq-manage-remove')?.checked;
    settings.highlightEnabled = !!document.getElementById('wcs-qq-manage-highlight')?.checked;
    settings.robotEnabled = !!document.getElementById('wcs-qq-manage-robot')?.checked;
    settings.joinApproval = !!document.getElementById('wcs-qq-manage-approval')?.checked;
    settings.speechMuted = !!document.getElementById('wcs-qq-manage-speech-muted')?.checked;
    group.chatConfig = group.chatConfig || {};
    group.chatConfig.qqGroupSettings = settings;
    saveCharactersToStorage();
    renderChatList();
    syncWechatQQGroupSettingsEntry(group);
    openWechatQQGroupManagePage();
    showWechatToast('管理设置已保存');
}
window.saveWechatQQGroupManageSettings = saveWechatQQGroupManageSettings;

function openWechatQQGroupMemberPicker(mode = 'manage') {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    if (mode === 'add' && !getWechatQQGroupFlag(settings, 'memberInviteEnabled', true)) {
        showWechatToast('成员邀请已关闭');
        openWechatQQGroupManagePage();
        return;
    }
    if (mode === 'remove' && !getWechatQQGroupFlag(settings, 'memberRemoveEnabled', true)) {
        showWechatToast('成员移除已关闭');
        openWechatQQGroupManagePage();
        return;
    }
    const currentIds = new Set(Array.isArray(group.groupMembers) ? group.groupMembers : []);
    const contacts = getWechatGroupContacts({ includeGroupNpc: mode !== 'add' });
    const rows = mode === 'add'
        ? contacts.filter(char => !currentIds.has(char.id))
        : (mode === 'remove'
            ? contacts.filter(char => currentIds.has(char.id))
            : getWechatQQGroupDisplayMembers(group));
    const title = mode === 'add' ? '邀请成员' : (mode === 'remove' ? '移除成员' : '管理群成员');
    const action = mode === 'add' ? 'addWechatQQGroupMember' : (mode === 'remove' ? 'removeWechatQQGroupMember' : 'openWechatQQGroupMemberSettings');
    openWechatQQGroupResourceShell(title, `
        <div class="wcs-qq-picker-list">
            ${rows.length ? rows.map(char => `
                <button type="button" onclick="${action}(${quoteWechatJsString(char.id)})">
                    <img src="${wcEscapeAttr(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                    <span><strong><b>${wcEscapeHtml(mode === 'add' ? getWechatGroupMemberName(char) : getWechatQQGroupMemberDisplayName(group, char))}</b>${mode === 'add' ? '' : renderWechatQQGroupMemberBadge(group, char.id)}</strong><em>${mode === 'add' ? '加入群聊' : (mode === 'remove' ? '从本群移除' : '群备注、身份、头衔')}</em></span>
                    <i class="${mode === 'add' ? 'ri-add-circle-line' : (mode === 'remove' ? 'ri-indeterminate-circle-line' : 'ri-settings-3-line')}"></i>
                </button>
            `).join('') : `<div class="wcs-qq-empty">${mode === 'add' ? '没有可邀请的联系人' : (mode === 'remove' ? '没有可移除的成员' : '还没有群成员')}</div>`}
        </div>
    `);
}
window.openWechatQQGroupMemberPicker = openWechatQQGroupMemberPicker;

function openWechatQQGroupMemberSettings(charId) {
    const group = getCurrentChatChar();
    const isUser = charId === WECHAT_QQ_GROUP_USER_ID;
    const member = isUser ? getWechatQQGroupUserMember(group) : getWechatGroupContacts({ includeGroupNpc: true }).find(char => char.id === charId);
    if (!group || !group.isGroupChat || !member) return;
    const profile = getWechatQQGroupMemberProfile(group, charId);
    const role = getWechatQQGroupMemberRole(group, charId);
    const isOwner = role === 'owner';
    openWechatQQGroupResourceShell('成员设置', `
        <div class="wcs-qq-member-editor">
            <div class="wcs-qq-member-editor-head">
                <img src="${wcEscapeAttr(member.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div><strong>${wcEscapeHtml(getWechatQQGroupMemberDisplayName(group, member))}</strong>${renderWechatQQGroupMemberBadge(group, charId)}</div>
            </div>
            <div class="wcs-qq-card wcs-qq-editor-card">
                <label><span>群备注</span><input id="wcs-qq-member-remark" maxlength="24" value="${wcEscapeAttr(profile.remark || '')}" placeholder="${wcEscapeAttr(getWechatGroupMemberName(member))}"></label>
                <label><span>群身份</span><select id="wcs-qq-member-role" ${isOwner ? 'disabled' : ''}>
                    ${isOwner ? '<option value="owner" selected>群主</option>' : ''}
                    <option value="member" ${role === 'member' ? 'selected' : ''}>普通成员</option>
                    <option value="admin" ${role === 'admin' ? 'selected' : ''}>管理员</option>
                </select></label>
                <label><span>群头衔</span><input id="wcs-qq-member-title" maxlength="16" value="${wcEscapeAttr(profile.title || '')}" placeholder="${isOwner ? '群主' : (role === 'admin' ? '管理员' : '例如 学霸、摸鱼王')}"></label>
            </div>
            <button type="button" class="wcs-qq-save" onclick="saveWechatQQGroupMemberSettings(${quoteWechatJsString(charId)})">保存成员设置</button>
        </div>
    `);
}
window.openWechatQQGroupMemberSettings = openWechatQQGroupMemberSettings;

function saveWechatQQGroupMemberSettings(charId) {
    const group = getCurrentChatChar();
    const isUser = charId === WECHAT_QQ_GROUP_USER_ID;
    const member = isUser ? getWechatQQGroupUserMember(group) : getWechatGroupContacts({ includeGroupNpc: true }).find(char => char.id === charId);
    if (!group || !group.isGroupChat || !member) return;
    const profile = getWechatQQGroupMemberProfile(group, charId);
    const role = getWechatQQGroupMemberRole(group, charId);
    profile.remark = (document.getElementById('wcs-qq-member-remark')?.value || '').trim();
    profile.title = (document.getElementById('wcs-qq-member-title')?.value || '').trim();
    profile.role = isUser || role === 'owner' ? 'owner' : (document.getElementById('wcs-qq-member-role')?.value === 'admin' ? 'admin' : 'member');
    if (isUser) {
        const settingsForNick = getWechatQQGroupSettings(group);
        settingsForNick.myNickname = profile.remark;
    }
    const settings = getWechatQQGroupSettings(group);
    if (isUser) {
        settings.ownerId = WECHAT_QQ_GROUP_USER_ID;
        group.groupOwnerId = WECHAT_QQ_GROUP_USER_ID;
    }
    settings.memberProfiles = getWechatQQGroupMemberProfiles(group);
    group.chatConfig = group.chatConfig || {};
    group.chatConfig.qqGroupSettings = settings;
    saveCharactersToStorage();
    refreshChatView(group);
    renderChatList();
    syncWechatQQGroupSettingsEntry(group);
    openWechatQQGroupMemberPicker('manage');
    showWechatToast('成员设置已保存');
}
window.saveWechatQQGroupMemberSettings = saveWechatQQGroupMemberSettings;

function addWechatQQGroupMember(charId) {
    const group = getCurrentChatChar();
    const member = getWechatGroupContacts({ includeGroupNpc: true }).find(char => char.id === charId);
    if (!group || !group.isGroupChat || !member) return;
    const settings = getWechatQQGroupSettings(group);
    if (!getWechatQQGroupFlag(settings, 'memberInviteEnabled', true)) {
        showWechatToast('成员邀请已关闭');
        openWechatQQGroupManagePage();
        return;
    }
    group.groupMembers = Array.isArray(group.groupMembers) ? group.groupMembers : [];
    if (settings.joinApproval) {
        settings.pendingMembers = Array.isArray(settings.pendingMembers) ? settings.pendingMembers : [];
        if (!group.groupMembers.includes(charId) && !settings.pendingMembers.includes(charId)) {
            settings.pendingMembers.push(charId);
            group.history = Array.isArray(group.history) ? group.history : [];
            group.history.push({ type: 'system_notice', isMe: false, content: `${getWechatGroupMemberName(member)} 的入群邀请已进入审核`, timestamp: createMessageTimestamp() });
            saveCharactersToStorage();
            refreshChatView(group);
            renderChatList();
        }
        closeWechatQQGroupResource();
        openWechatQQGroupManagePage();
        showWechatToast('已加入待审核');
        return;
    }
    if (!group.groupMembers.includes(charId)) {
        group.groupMembers.push(charId);
        getWechatQQGroupOwnerId(group);
        group.avatar = buildWechatGroupAvatar(group);
        group.history = Array.isArray(group.history) ? group.history : [];
        group.history.push({ type: 'system_notice', isMe: false, content: `你邀请 ${getWechatGroupMemberName(member)} 加入了群聊`, timestamp: createMessageTimestamp() });
        saveCharactersToStorage();
        refreshChatView(group);
        renderChatList();
        syncWechatQQGroupSettingsEntry(group);
    }
    closeWechatQQGroupResource();
    openWechatQQGroupSettings();
}
window.addWechatQQGroupMember = addWechatQQGroupMember;

function removeWechatQQGroupMember(charId) {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    if (charId === WECHAT_QQ_GROUP_USER_ID) {
        showWechatToast('群主不能从自己创建的群里移除');
        return;
    }
    const settings = getWechatQQGroupSettings(group);
    if (!getWechatQQGroupFlag(settings, 'memberRemoveEnabled', true)) {
        showWechatToast('成员移除已关闭');
        openWechatQQGroupManagePage();
        return;
    }
    const members = Array.isArray(group.groupMembers) ? group.groupMembers : [];
    if (members.length <= 1) {
        showWechatToast('群里至少保留 1 个角色成员');
        return;
    }
    const member = getWechatGroupContacts({ includeGroupNpc: true }).find(char => char.id === charId);
    group.groupMembers = members.filter(id => id !== charId);
    getWechatQQGroupOwnerId(group);
    group.avatar = buildWechatGroupAvatar(group);
    group.history = Array.isArray(group.history) ? group.history : [];
    group.history.push({ type: 'system_notice', isMe: false, content: `你将 ${getWechatGroupMemberName(member)} 移出了群聊`, timestamp: createMessageTimestamp() });
    saveCharactersToStorage();
    refreshChatView(group);
    renderChatList();
    syncWechatQQGroupSettingsEntry(group);
    closeWechatQQGroupResource();
    openWechatQQGroupSettings();
}
window.removeWechatQQGroupMember = removeWechatQQGroupMember;

function approveWechatQQGroupPendingMember(charId) {
    const group = getCurrentChatChar();
    const member = getWechatGroupContacts({ includeGroupNpc: true }).find(char => char.id === charId);
    if (!group || !group.isGroupChat || !member) return;
    const settings = getWechatQQGroupSettings(group);
    settings.pendingMembers = (Array.isArray(settings.pendingMembers) ? settings.pendingMembers : []).filter(id => id !== charId);
    group.groupMembers = Array.isArray(group.groupMembers) ? group.groupMembers : [];
    if (!group.groupMembers.includes(charId)) {
        group.groupMembers.push(charId);
        getWechatQQGroupOwnerId(group);
        group.avatar = buildWechatGroupAvatar(group);
        group.history = Array.isArray(group.history) ? group.history : [];
        group.history.push({ type: 'system_notice', isMe: false, content: `已同意 ${getWechatGroupMemberName(member)} 加入群聊`, timestamp: createMessageTimestamp() });
    }
    saveCharactersToStorage();
    refreshChatView(group);
    renderChatList();
    syncWechatQQGroupSettingsEntry(group);
    openWechatQQGroupManagePage();
}
window.approveWechatQQGroupPendingMember = approveWechatQQGroupPendingMember;

function rejectWechatQQGroupPendingMember(charId) {
    const group = getCurrentChatChar();
    const member = getWechatGroupContacts({ includeGroupNpc: true }).find(char => char.id === charId);
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    settings.pendingMembers = (Array.isArray(settings.pendingMembers) ? settings.pendingMembers : []).filter(id => id !== charId);
    group.history = Array.isArray(group.history) ? group.history : [];
    if (member) group.history.push({ type: 'system_notice', isMe: false, content: `已拒绝 ${getWechatGroupMemberName(member)} 的入群申请`, timestamp: createMessageTimestamp() });
    saveCharactersToStorage();
    refreshChatView(group);
    renderChatList();
    syncWechatQQGroupSettingsEntry(group);
    openWechatQQGroupManagePage();
}
window.rejectWechatQQGroupPendingMember = rejectWechatQQGroupPendingMember;

function openWechatQQGroupResourceShell(title, bodyHtml) {
    const host = document.getElementById('wcs-qq-group-settings-page') || ensureWechatQQGroupSettingsPage();
    if (!host) return;
    document.getElementById('wcs-qq-group-resource-page')?.remove();
    const page = document.createElement('div');
    page.id = 'wcs-qq-group-resource-page';
    page.className = 'wcs-qq-group-subpage wcs-qq-resource-page active';
    page.innerHTML = `
        <div class="wcs-qq-group-header">
            <i class="ri-arrow-left-s-line" onclick="closeWechatQQGroupResource()"></i>
            <span>${wcEscapeHtml(title)}</span>
            <i></i>
        </div>
        <div class="wcs-qq-group-body">${bodyHtml}</div>
    `;
    host.appendChild(page);
}

function closeWechatQQGroupResource() {
    document.getElementById('wcs-qq-group-resource-page')?.remove();
}
window.closeWechatQQGroupResource = closeWechatQQGroupResource;

function getWechatQQGroupResourceRows(group, type) {
    const history = Array.isArray(group?.history) ? group.history : [];
    return history.map((msg, index) => ({ msg, index })).filter(row => {
        const msg = row.msg || {};
        if (msg.type === 'system_notice') return false;
        if (type === 'files') return msg.type === 'file' || msg.fileName || msg.fileUrl || msg.attachmentName;
        if (type === 'photos') return msg.type === 'image' || msg.type === 'image_stack' || isWechatReplyMediaSource(msg.content || msg.image || msg.url || '');
        if (type === 'highlights') return !!msg.qqGroupHighlight;
        return false;
    });
}

function openWechatQQGroupResource(type) {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    const titleMap = { files: '群文件', photos: '群相册', highlights: '精华消息' };
    const rows = getWechatQQGroupResourceRows(group, type);
    let body = '';
    if (type === 'photos') {
        body = rows.length ? `<div class="wcs-qq-photo-grid">${rows.map(row => {
            const src = row.msg.content || row.msg.image || row.msg.url || '';
            return `<button type="button" onclick="openWechatImagePreview(${quoteWechatJsString(src)})"><img src="${wcEscapeAttr(src)}" onerror="this.closest('button').remove()"></button>`;
        }).join('')}</div>` : '<div class="wcs-qq-empty">这群还没有真实图片消息。</div>';
    } else if (type === 'highlights') {
        if (!getWechatQQGroupFlag(settings, 'highlightEnabled', true)) {
            body = '<div class="wcs-qq-empty">精华消息功能已在管理群中关闭。</div>';
            openWechatQQGroupResourceShell(titleMap[type] || '群应用', body);
            return;
        }
        const recent = (Array.isArray(group.history) ? group.history : [])
            .map((msg, index) => ({ msg, index }))
            .filter(row => row.msg && row.msg.type !== 'system_notice')
            .slice(-30)
            .reverse();
        body = `
            <div class="wcs-qq-resource-list">
                ${recent.length ? recent.map(row => `
                    <button type="button" class="${row.msg.qqGroupHighlight ? 'active' : ''}" onclick="toggleWechatQQGroupHighlight(${Number(row.index)})">
                        <span>${wcEscapeHtml(getWechatMessagePlainSummary(row.msg, 80))}</span>
                        <em>${row.msg.qqGroupHighlight ? '取消精华' : '设为精华'}</em>
                    </button>
                `).join('') : '<div class="wcs-qq-empty">还没有可设置为精华的消息。</div>'}
            </div>
        `;
    } else {
        body = rows.length ? `<div class="wcs-qq-resource-list">${rows.map(row => `
            <button type="button" onclick="openWechatSearchResult(${Number(row.index)})">
                <span>${wcEscapeHtml(row.msg.fileName || row.msg.attachmentName || getWechatMessagePlainSummary(row.msg, 80))}</span>
                <em>${wcEscapeHtml(formatMessageTime(row.msg))}</em>
            </button>
        `).join('')}</div>` : '<div class="wcs-qq-empty">这群还没有真实文件消息。</div>';
    }
    openWechatQQGroupResourceShell(titleMap[type] || '群应用', body);
}
window.openWechatQQGroupResource = openWechatQQGroupResource;

function toggleWechatQQGroupHighlight(index) {
    const group = getCurrentChatChar();
    const settings = getWechatQQGroupSettings(group);
    if (!getWechatQQGroupFlag(settings, 'highlightEnabled', true)) {
        showWechatToast('精华消息功能已关闭');
        return;
    }
    const msg = group && Array.isArray(group.history) ? group.history[index] : null;
    if (!msg || msg.type === 'system_notice') return;
    msg.qqGroupHighlight = !msg.qqGroupHighlight;
    saveCharactersToStorage();
    openWechatQQGroupResource('highlights');
}
window.toggleWechatQQGroupHighlight = toggleWechatQQGroupHighlight;

function normalizeWechatQQGroupRobots(settings) {
    settings.robots = (Array.isArray(settings.robots) ? settings.robots : [])
        .map((item, index) => {
            if (typeof item === 'string') {
                return { id: `robot-${Date.now()}-${index}`, name: item, remark: '', persona: '' };
            }
            if (!item || typeof item !== 'object') return null;
            const name = String(item.name || item.title || '').trim();
            if (!name) return null;
            return {
                id: item.id || `robot-${Date.now()}-${index}`,
                name,
                remark: String(item.remark || item.note || '').trim(),
                persona: String(item.persona || item.prompt || item.character || '').trim()
            };
        })
        .filter(Boolean);
    return settings.robots;
}

function openWechatQQGroupRobotEditor(editIndex = -1) {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    const settings = getWechatQQGroupSettings(group);
    const robots = normalizeWechatQQGroupRobots(settings);
    const index = Number.isFinite(Number(editIndex)) ? Number(editIndex) : -1;
    const editing = index >= 0 ? robots[index] : null;
    if (!getWechatQQGroupFlag(settings, 'robotEnabled', true)) {
        openWechatQQGroupResourceShell('群机器人', '<div class="wcs-qq-empty">群机器人已在管理群中关闭。</div>');
        return;
    }
    openWechatQQGroupResourceShell('群机器人', `
        <div class="wcs-qq-robot-editor">
            <div class="wcs-qq-card wcs-qq-robot-form">
                <input type="hidden" id="wcs-qq-robot-index" value="${editing ? Number(index) : -1}">
                <label><span>机器人名称</span><input id="wcs-qq-robot-name" maxlength="24" value="${wcEscapeAttr(editing?.name || '')}" placeholder="机器人名称"></label>
                <label><span>备注</span><input id="wcs-qq-robot-remark" maxlength="40" value="${wcEscapeAttr(editing?.remark || '')}" placeholder="例如 负责提醒、整理文件"></label>
                <label><span>人设</span><textarea id="wcs-qq-robot-persona" maxlength="500" rows="4" placeholder="写这个机器人在群里的语气、职责和边界">${wcEscapeHtml(editing?.persona || '')}</textarea></label>
                <button type="button" class="wcs-qq-save" onclick="saveWechatQQGroupRobot()">${editing ? '保存机器人' : '添加机器人'}</button>
            </div>
            <div class="wcs-qq-robot-list">
                ${robots.length ? robots.map((robot, index) => `
                    <div class="wcs-qq-robot-row">
                        <button type="button" onclick="openWechatQQGroupRobotEditor(${Number(index)})">
                            <span><b>${wcEscapeHtml(robot.name)}</b><em>${wcEscapeHtml(robot.remark || robot.persona || '未设置备注和人设')}</em></span>
                            <i class="ri-edit-2-line"></i>
                        </button>
                        <button type="button" class="danger" onclick="removeWechatQQGroupRobot(${Number(index)})"><i class="ri-close-line"></i></button>
                    </div>
                `).join('') : '<div class="wcs-qq-empty">还没有添加群机器人。</div>'}
            </div>
        </div>
    `);
}
window.openWechatQQGroupRobotEditor = openWechatQQGroupRobotEditor;

function saveWechatQQGroupRobot() {
    const group = getCurrentChatChar();
    const name = (document.getElementById('wcs-qq-robot-name')?.value || '').trim();
    if (!group || !name) return;
    const settings = getWechatQQGroupSettings(group);
    if (!getWechatQQGroupFlag(settings, 'robotEnabled', true)) {
        showWechatToast('群机器人已关闭');
        return;
    }
    const robots = normalizeWechatQQGroupRobots(settings);
    const index = Number(document.getElementById('wcs-qq-robot-index')?.value || -1);
    const prev = Number.isInteger(index) && index >= 0 ? robots[index] : null;
    const next = {
        id: prev?.id || `robot-${Date.now()}`,
        name,
        remark: (document.getElementById('wcs-qq-robot-remark')?.value || '').trim(),
        persona: (document.getElementById('wcs-qq-robot-persona')?.value || '').trim()
    };
    if (prev) robots[index] = next;
    else robots.push(next);
    settings.robots = robots;
    saveCharactersToStorage();
    openWechatQQGroupRobotEditor();
}
window.saveWechatQQGroupRobot = saveWechatQQGroupRobot;
window.addWechatQQGroupRobot = saveWechatQQGroupRobot;

function removeWechatQQGroupRobot(index) {
    const group = getCurrentChatChar();
    if (!group) return;
    const settings = getWechatQQGroupSettings(group);
    if (!getWechatQQGroupFlag(settings, 'robotEnabled', true)) {
        showWechatToast('群机器人已关闭');
        return;
    }
    const robots = normalizeWechatQQGroupRobots(settings);
    robots.splice(index, 1);
    settings.robots = robots;
    saveCharactersToStorage();
    openWechatQQGroupRobotEditor();
}
window.removeWechatQQGroupRobot = removeWechatQQGroupRobot;

function dismissWechatQQGroupChat() {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return;
    if (!confirm(`确定解散「${group.name || '群聊'}」吗？\n会删除这个群聊和群聊天记录，不会删除群成员角色卡。`)) return;
    window.myCharacters = (window.myCharacters || []).filter(char => char.id !== group.id);
    window.currentChatCharId = null;
    closeWechatQQGroupSettings();
    closeChatSettings();
    const room = document.getElementById('wechat-chat-room');
    if (room) {
        room.classList.remove('active');
        room.classList.add('hidden');
    }
    saveCharactersToStorage();
    renderChatList();
    switchWcTab('chat');
    showWechatToast('群聊已解散');
}
window.dismissWechatQQGroupChat = dismissWechatQQGroupChat;

function syncWechatQQGroupShortcutBar(group) {
    const room = document.getElementById('wechat-chat-room');
    if (!room) return;
    let bar = document.getElementById('wc-qq-group-shortcut-bar');
    const settings = group && group.isGroupChat ? getWechatQQGroupSettings(group) : {};
    const enabled = !!(group && group.isGroupChat && settings.shortcutBar);
    room.classList.toggle('qq-group-shortcuts-on', enabled);
    if (!enabled) {
        if (bar) bar.remove();
        return;
    }
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'wc-qq-group-shortcut-bar';
        bar.className = 'wc-qq-group-shortcut-bar';
        const footer = room.querySelector('.wc-room-footer');
        if (footer) room.insertBefore(bar, footer);
        else room.appendChild(bar);
    }
    bar.innerHTML = `
        <button type="button" onclick="openWechatQQGroupShortcutFeature('files')"><i class="ri-folder-line"></i><span>文件</span></button>
        <button type="button" onclick="openWechatQQGroupShortcutFeature('photos')"><i class="ri-image-line"></i><span>相册</span></button>
        <button type="button" onclick="openWechatQQGroupShortcutFeature('highlights')"><i class="ri-star-smile-line"></i><span>精华</span></button>
        <button type="button" onclick="openWechatCurrentChatSearch()"><i class="ri-search-line"></i><span>查找</span></button>
    `;
}

function renderWechatQQGroupFeatureResourceHtml(type) {
    const group = getCurrentChatChar();
    if (!group || !group.isGroupChat) return '<div class="wcs-qq-empty">没有打开群聊。</div>';
    const rows = getWechatQQGroupResourceRows(group, type);
    if (type === 'photos') {
        return rows.length ? `<div class="wcs-qq-photo-grid feature">${rows.map(row => {
            const src = row.msg.content || row.msg.image || row.msg.url || '';
            return `<button type="button" onclick="openWechatImagePreview(${quoteWechatJsString(src)})"><img src="${wcEscapeAttr(src)}" onerror="this.closest('button').remove()"></button>`;
        }).join('')}</div>` : '<div class="wcs-qq-empty">这群还没有真实图片消息。</div>';
    }
    if (type === 'highlights') {
        const settings = getWechatQQGroupSettings(group);
        if (!getWechatQQGroupFlag(settings, 'highlightEnabled', true)) return '<div class="wcs-qq-empty">精华消息功能已在管理群中关闭。</div>';
        const recent = (Array.isArray(group.history) ? group.history : [])
            .map((msg, index) => ({ msg, index }))
            .filter(row => row.msg && row.msg.type !== 'system_notice')
            .slice(-30)
            .reverse();
        return `<div class="wcs-qq-resource-list feature">
            ${recent.length ? recent.map(row => `
                <button type="button" class="${row.msg.qqGroupHighlight ? 'active' : ''}" onclick="toggleWechatQQGroupHighlightFromFeature(${Number(row.index)})">
                    <span>${wcEscapeHtml(getWechatMessagePlainSummary(row.msg, 80))}</span>
                    <em>${row.msg.qqGroupHighlight ? '取消精华' : '设为精华'}</em>
                </button>
            `).join('') : '<div class="wcs-qq-empty">还没有可设置为精华的消息。</div>'}
        </div>`;
    }
    return rows.length ? `<div class="wcs-qq-resource-list feature">${rows.map(row => `
        <button type="button" onclick="openWechatSearchResult(${Number(row.index)})">
            <span>${wcEscapeHtml(row.msg.fileName || row.msg.attachmentName || getWechatMessagePlainSummary(row.msg, 80))}</span>
            <em>${wcEscapeHtml(formatMessageTime(row.msg))}</em>
        </button>
    `).join('')}</div>` : '<div class="wcs-qq-empty">这群还没有真实文件消息。</div>';
}

function openWechatQQGroupShortcutFeature(type) {
    const titleMap = { files: '群文件', photos: '群相册', highlights: '精华消息' };
    closeChatToolbar();
    openWechatFeatureScreen(titleMap[type] || '群应用', renderWechatQQGroupFeatureResourceHtml(type));
    setWechatFeatureLeftText('取消', 'closeWechatFeatureScreen()');
}
window.openWechatQQGroupShortcutFeature = openWechatQQGroupShortcutFeature;

function openWechatQQGroupSearchFromSettings() {
    closeWechatQQGroupSettings();
    closeChatSettings();
    setTimeout(() => openWechatCurrentChatSearch(), 320);
}
window.openWechatQQGroupSearchFromSettings = openWechatQQGroupSearchFromSettings;

function toggleWechatQQGroupHighlightFromFeature(index) {
    const group = getCurrentChatChar();
    const settings = getWechatQQGroupSettings(group);
    if (!getWechatQQGroupFlag(settings, 'highlightEnabled', true)) {
        showWechatToast('精华消息功能已关闭');
        return;
    }
    const msg = group && Array.isArray(group.history) ? group.history[index] : null;
    if (!msg || msg.type === 'system_notice') return;
    msg.qqGroupHighlight = !msg.qqGroupHighlight;
    saveCharactersToStorage();
    const body = document.getElementById('wc-feature-body');
    const title = document.getElementById('wc-feature-title');
    if (body && title && title.textContent === '精华消息') body.innerHTML = renderWechatQQGroupFeatureResourceHtml('highlights');
}
window.toggleWechatQQGroupHighlightFromFeature = toggleWechatQQGroupHighlightFromFeature;

function getWechatChatListTimestamp(char) {
    const msg = getWechatLastChatMessage(char);
    const raw = msg && (msg.timestamp || msg.createdAt || msg.time);
    if (raw) return raw;
    return char?.importedAt || char?.createdAt || char?.created_at || char?.importTime || char?.updatedAt || '';
}

function formatWechatChatListTime(char) {
    const raw = getWechatChatListTimestamp(char);
    if (!raw) return '现在';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '现在';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))}分钟前`;
    const sameDay = date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
    if (sameDay) return `${padWechatDatePart(date.getHours())}:${padWechatDatePart(date.getMinutes())}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getFullYear() === yesterday.getFullYear()
        && date.getMonth() === yesterday.getMonth()
        && date.getDate() === yesterday.getDate();
    if (isYesterday) return '昨天';
    if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}/${date.getDate()}`;
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function getChatPreview(char) {
    const last = getWechatLastChatMessage(char);
    if (!last) return '';
    if (last.type === 'image_stack') {
        const count = getWechatImageStackSources(last).length || 0;
        return last.isMe ? `[${count}张图片]` : `[对方发来${count}张图片]`;
    }
    if (last.type === 'image') return last.isMe ? '[图片]' : '[对方发来图片]';
    if (last.type === 'sticker') {
        const name = last.stickerName || last.name || '';
        if ((last.emoji || last.stickerKind === 'wechatEmoji' || isWechatBuiltinEmojiUrl(last.content)) && name) {
            const source = last.stickerKind === 'qqEmoji' ? 'qq' : getWechatBuiltinEmojiSourceFromUrl(last.content);
            return `${last.isMe ? '' : '对方发来 '}${buildWechatBuiltinEmojiMarker(name, source, last.content || '')}`;
        }
        return last.isMe ? '[表情]' : '[对方发来表情]';
    }
    if (isWechatSpecialMessage(last.type)) return getWechatMessageSummary(last);
    const text = String(last.content || last.dialogue || last.description || '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text || '[消息]';
}

function filterChatList(keyword) {
    const items = document.querySelectorAll('#wc-chat-list .wc-swipe-container');
    const kw = keyword.trim().toLowerCase();
    items.forEach(container => {
        const charId = container.dataset.charId;
        const char = window.myCharacters.find(c => c.id === charId);
        if (!char) return;
        const nickname = (char.chatConfig && char.chatConfig.nickname) || '';
        const qqGroup = char.isGroupChat ? getWechatQQGroupSettings(char) : {};
        const groupNumber = qqGroup.allowSearch ? String(qqGroup.groupNumber || '') : '';
        const groupRemark = qqGroup.groupRemark || '';
        const match = !kw
            || String(char.name || '').toLowerCase().includes(kw)
            || nickname.toLowerCase().includes(kw)
            || String(groupRemark).toLowerCase().includes(kw)
            || groupNumber.includes(kw);
        container.style.display = match ? '' : 'none';
    });
}

// 通用工具：正则替换 + Markdown 清洗
function getWechatDisplayUserName() {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    return (profile && profile.name) || '我';
}

function getWechatDisplayCharName(char) {
    if (!char) return '';
    return (char.chatConfig && char.chatConfig.nickname) || char.name || '';
}

function fillWechatRegexTemplate(value, char) {
    return String(value == null ? '' : value)
        .replace(/\{\{char\}\}/gi, getWechatDisplayCharName(char))
        .replace(/\{\{user\}\}/gi, getWechatDisplayUserName());
}

function getWechatRegexScriptField(script, keys) {
    if (!script || typeof script !== 'object') return '';
    for (const key of keys) {
        if (script[key] != null && script[key] !== '') return script[key];
    }
    const common = {
        findRegex: ['find_regex', 'find', 'match', 'matcher', 'regexPattern', 'regex_pattern'],
        replaceString: ['replace_string', 'replaceWith', 'replace_with', 'replacement', 'substitute_regex', 'substituteRegex']
    };
    for (const key of keys) {
        const aliases = common[key] || [];
        for (const alias of aliases) {
            if (script[alias] != null && script[alias] !== '') return script[alias];
        }
    }
    if (script.script && typeof script.script === 'object') {
        return getWechatRegexScriptField(script.script, keys);
    }
    return '';
}

function isWechatRegexScriptEnabled(script) {
    if (!script || typeof script !== 'object') return false;
    if (script.enabled === false || script.disabled === true || script.isDisabled === true) return false;
    if (script.use_regex === false || script.useRegex === false) return false;
    if (String(script.enabled).toLowerCase() === 'false') return false;
    if (String(script.disabled).toLowerCase() === 'true') return false;
    if (String(script.use_regex).toLowerCase() === 'false') return false;
    if (String(script.useRegex).toLowerCase() === 'false') return false;
    return true;
}

function renderWechatMarkdownLite(text) {
    let html = wcEscapeHtml(text);
    const codeSpans = [];
    html = html.replace(/`([^`\n]+)`/g, (match, code) => {
        const key = `__WC_CODE_${codeSpans.length}__`;
        codeSpans.push(`<code>${code}</code>`);
        return key;
    });
    html = html.replace(/\*\*([^*\n][\s\S]*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    codeSpans.forEach((value, index) => {
        html = html.replace(`__WC_CODE_${index}__`, value);
    });
    return html.replace(/\n/g, '<br>');
}

function shouldPreserveWechatRegexRenderedHtml(text, char) {
    const source = cleanWechatVisibleContent(text);
    if (!source) return false;
    if (/^\s*<\s*(?:音乐|music)\b/i.test(source)) return false;
    return /<\s*(?:jwy|status|state|bqb)\b/i.test(source)
        || looksLikeWechatRegexPayloadSource(source)
        || looksLikeWechatPipeStatusPayloadSource(source);
}

function processMsgContent(content, char) {
    if (!content) return "";
    let text = cleanWechatVisibleContent(content);
    if (!text) return "";

    const preserveRegexHtml = shouldPreserveWechatRegexRenderedHtml(text, char);
    text = preserveRegexHtml
        ? normalizeWechatRegexPayloadSource(fillWechatRegexTemplate(text, char), char)
        : fillWechatRegexTemplate(text, char);

    // 1. 执行正则脚本
    const globalScripts = window.globalRegexScripts || [];
    const charScripts = char.regex || [];
    const allScripts = [...globalScripts, ...charScripts];

    allScripts.forEach(script => {
        if (!isWechatRegexScriptEnabled(script)) return; // 🔥 跳过已关闭的脚本
        try {
            const regexStr = getWechatRegexScriptField(script, ['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']);
            let replaceStr = getWechatRegexScriptField(script, ['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']);
            if (regexStr) {
                let pattern = fillWechatRegexTemplate(regexStr, char);
                let flags = 'g'; 
                if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
                    const lastSlash = pattern.lastIndexOf('/');
                    flags = pattern.substring(lastSlash + 1).replace(/[^gimsuy]/g, '');
                    pattern = pattern.substring(1, lastSlash);
                }
                const re = new RegExp(pattern, flags);
                if (replaceStr && typeof replaceStr === 'string') {
                    replaceStr = fillWechatRegexTemplate(replaceStr, char).replace(/\{\{match\}\}/gi, '$&');
                }
                text = text.replace(re, replaceStr);
            }
        } catch (e) { console.warn("正则执行失败:", script.name, e); }
    });

    text = cleanWechatVisibleContent(text, { stripExecutableCodeBlocks: !preserveRegexHtml });
    if (!text) return "";

    // 2. 剥离 Markdown 代码块包装（支持混合内容：文本 + 代码块）
    // 先处理内嵌的 ```html...``` 代码块，提取其中的HTML
    text = text.replace(/```(?:html|xml|markdown)?\s*([\s\S]*?)```/gi, function(match, code) {
        return code.trim();
    });
    // 如果处理后包含HTML/正则渲染块，直接返回，避免把结构化 UI 拆成旁白或 <br>
    if (isRichMessageContent(text)) {
        return text;
    } else {
        return renderWechatMarkdownLite(text);
    }
}

// 微信聊天窗口
function openChat(charId) {
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    // A forum deep link can reopen WeChat while an old chat-settings panel is
    // still mounted. Dismiss that panel before showing the destination chat.
    const settingsPanel = document.getElementById('wc-chat-settings-panel');
    if (settingsPanel) {
        settingsPanel.classList.remove('active');
        settingsPanel.style.display = 'none';
    }
    const featureScreen = document.getElementById('wc-feature-screen');
    if (featureScreen) {
        featureScreen.classList.remove('active');
        featureScreen.classList.add('hidden');
    }
    document.getElementById('wechat-chat-room')?.classList.remove('settings-opening', 'settings-open', 'settings-closing');

    window.currentChatCharId = charId;
    clearWechatReplyDraft();
    const sanitizedContext = sanitizeWechatEmptyChatDerivedContext(char);
    const touchedMessageTime = ensureWechatHistoryTimestamps(char);
    const readStateChanged = markWechatCharMessagesRead(char);

    const config = char.chatConfig || {};
    const chatTitle = char.isGroupChat ? getWechatQQGroupDisplayName(char) : (config.nickname || char.name);
    document.getElementById('chat-room-title').textContent = chatTitle;
    bindWechatClaudeTitleInteractions(char);
    const floatImg = document.getElementById('wc-float-avatar-img');
    const floatName = document.getElementById('wc-float-name');
    const roomHeaderAvatar = document.getElementById('chat-room-header-avatar');
    const charAvatar = getWechatCharAvatarSource(char);
    if (floatImg) floatImg.src = charAvatar;
    if (floatName) floatName.textContent = chatTitle;
    if (roomHeaderAvatar) roomHeaderAvatar.src = charAvatar;
    syncWechatLineRoomHeader();
    syncWechatCoupleThemeHeader(char);
    if (touchedMessageTime || readStateChanged || sanitizedContext) saveCharactersToStorage();
    if (readStateChanged) {
        scheduleWechatChatListRefresh();
    }
    // 应用聊天配置（背景/气泡/字体）
    applyChatConfig(char);
    refreshChatView(char);
    setWechatVoiceInputMode(false, { keepDraft: true });
    syncWechatDraftState();

    const room = document.getElementById('wechat-chat-room');
    const inputEl = document.getElementById('wc-msg-input');
    const richEl = getWechatRichInputElement?.();
    const placeholder = isWechatXTheme() ? '私信' : getWechatChatInputPlaceholder(getWechatUiThemeId());
    if (inputEl) inputEl.placeholder = placeholder;
    if (richEl) richEl.dataset.placeholder = placeholder;
    recoverWechatInputLockIfStale();
    room.classList.remove('hidden');
    setTimeout(() => room.classList.add('active'), 10);
}


function openWechatMessageSource(charId, msgKey) {
    if (!charId) return;
    if (typeof openApp === 'function') openApp('wechat');
    closeWechatFeatureScreen();
    setTimeout(() => {
        openChat(charId);
        requestAnimationFrame(() => {
            const char = window.myCharacters.find(c => c.id === charId);
            const history = Array.isArray(char && char.history) ? char.history : [];
            const index = history.findIndex((msg, idx) => getWechatMessageSourceKey(charId, msg, idx) === msgKey);
            const row = index >= 0 ? document.querySelector(`.msg-row[data-msg-idx="${index}"]`) : null;
            if (row) {
                row.scrollIntoView({ block: 'center', behavior: 'smooth' });
                row.classList.add('msg-source-highlight');
                setTimeout(() => row.classList.remove('msg-source-highlight'), 1600);
            }
        });
    }, 80);
}

function getWechatMessageSourceKey(charId, msg, msgIdx) {
    return `message:${charId}:${msg?.id || msg?.timestamp || msg?.createdAt || msgIdx}`;
}

