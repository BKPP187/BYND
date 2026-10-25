// --- QQ 主题群聊：活跃等级、@成员、群公告、禁言与群内戳一戳 ---
// Chrome (level badges, @ picker, announcement bar, "有人@我") only appears in the QQ theme;
// the underlying records (announcement cards, mute, pokes) are ordinary group history in every theme.

const WECHAT_QQ_MENTION_ALL = '全体成员';
const WECHAT_QQ_MUTE_MAX_MINUTES = 30 * 24 * 60;

function isWechatQQGroupChatTheme(group) {
    return !!(group && group.isGroupChat && typeof getWechatUiThemeId === 'function' && getWechatUiThemeId() === 'qq');
}

function getWechatQQGroupUserDisplayName(group) {
    return getWechatQQGroupMemberDisplayName(group, getWechatQQGroupUserMember(group));
}

// "我" / the user's own group name / a member's group name or real name → member id.
function resolveWechatQQGroupTargetId(group, value) {
    const query = String(value || '').trim().replace(/^@/, '');
    if (!query) return '';
    if (['我', '用户', '群主', 'user', WECHAT_QQ_GROUP_USER_ID].includes(query) || query === getWechatQQGroupUserDisplayName(group)) return WECHAT_QQ_GROUP_USER_ID;
    const member = findWechatGroupMember(group, query);
    return member ? member.id : '';
}

function getWechatQQGroupNameById(group, memberId) {
    if (memberId === WECHAT_QQ_GROUP_USER_ID) return getWechatQQGroupUserDisplayName(group);
    const member = getWechatGroupMembers(group).find(item => item.id === memberId)
        || getWechatGroupContacts({ includeGroupNpc: true }).find(item => item.id === memberId);
    return member ? getWechatQQGroupMemberDisplayName(group, member) : '成员';
}

function buildWechatQQGroupNotice(content) {
    return { type: 'system_notice', isMe: false, qqGroupNotice: true, content, timestamp: createMessageTimestamp() };
}

async function persistWechatQQGroupChange(group, rollback) {
    let ok = false;
    try { ok = await saveCharactersToStorage() !== false; } catch (_) { ok = false; }
    if (!ok) {
        rollback();
        showWechatToast('保存失败，请重试');
    }
    if (window.currentChatCharId === group?.id) refreshChatView(group);
    if (typeof renderChatList === 'function') renderChatList();
    return ok;
}

// --- A. 活跃等级 ---
const wechatQQGroupActivityCache = new WeakMap();

function getWechatQQGroupActivityCounts(group) {
    const history = Array.isArray(group?.history) ? group.history : [];
    const key = `${history.length}:${history[history.length - 1]?.timestamp || ''}`;
    const cached = wechatQQGroupActivityCache.get(group);
    if (cached && cached.key === key) return cached.counts;
    const counts = {};
    history.forEach(msg => {
        if (!msg || msg.type === 'system_notice' || msg.hiddenFromChat || msg.internalEvent || msg.recalled) return;
        const id = msg.isMe ? WECHAT_QQ_GROUP_USER_ID : (msg.senderId || msg.speakerId);
        if (id) counts[id] = (counts[id] || 0) + 1;
    });
    if (group && typeof group === 'object') wechatQQGroupActivityCache.set(group, { key, counts });
    return counts;
}

function getWechatQQGroupMemberLevel(group, memberId) {
    const manual = Number(getWechatQQGroupMemberProfile(group, memberId).level);
    if (Number.isInteger(manual) && manual >= 1 && manual <= 100) return manual;
    const count = getWechatQQGroupActivityCounts(group)[memberId] || 0;
    return Math.min(100, 1 + Math.floor(Math.sqrt(count * 6)));
}

function renderWechatQQGroupLevelBadge(group, memberId) {
    const level = getWechatQQGroupMemberLevel(group, memberId);
    const tier = level >= 80 ? 4 : level >= 50 ? 3 : level >= 20 ? 2 : 1;
    return `<em class="wcs-qq-level-badge tier-${tier}">LV${level}</em>`;
}

// --- B. @ 成员 ---
function getWechatQQGroupMentionTargets(group) {
    const members = getWechatGroupMembers(group).map(member => ({ id: member.id, name: getWechatQQGroupMemberDisplayName(group, member), avatar: member.avatar || DEFAULT_AVATAR }));
    return [{ id: WECHAT_QQ_GROUP_USER_ID, name: getWechatQQGroupUserDisplayName(group), avatar: getWechatQQGroupUserMember(group).avatar }, ...members];
}

function escapeWechatRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// rawHtml is already escaped message HTML; only exact "@name" tokens of this group are marked.
function highlightWechatQQGroupMentions(rawHtml, group) {
    const html = String(rawHtml || '');
    if (!html.includes('@') || !group?.isGroupChat) return html;
    const userName = getWechatQQGroupUserDisplayName(group);
    const names = [WECHAT_QQ_MENTION_ALL, ...getWechatQQGroupMentionTargets(group).map(item => item.name)]
        .filter(Boolean)
        .map(name => wcEscapeHtml(name))
        .sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`@(${names.map(escapeWechatRegExp).join('|')})`, 'g');
    const meNames = new Set([wcEscapeHtml(userName), WECHAT_QQ_MENTION_ALL]);
    return html.replace(pattern, (match, name) => `<span class="msg-qq-mention${meNames.has(name) ? ' is-me' : ''}">${match}</span>`);
}

function doesWechatQQGroupMessageMentionUser(group, msg) {
    if (!group?.isGroupChat || !msg || msg.isMe || msg.recalled || msg.type === 'system_notice') return false;
    const text = String(msg.content || '');
    return text.includes(`@${WECHAT_QQ_MENTION_ALL}`) || text.includes(`@${getWechatQQGroupUserDisplayName(group)}`);
}

// The newest @me that came after the user's own last message and was not opened from the chip.
function findWechatQQGroupUnreadMentionIndex(group) {
    const history = Array.isArray(group?.history) ? group.history : [];
    const seenAt = Number(getWechatQQGroupSettings(group).mentionSeenAt) || 0;
    for (let i = history.length - 1; i >= 0; i -= 1) {
        const msg = history[i];
        if (msg?.isMe && !msg.recalled && msg.type !== 'poke') return -1;
        if (doesWechatQQGroupMessageMentionUser(group, msg)) return Number(msg.timestamp) > seenAt ? i : -1;
    }
    return -1;
}

async function openWechatQQGroupUnreadMention() {
    const group = getCurrentChatChar();
    const index = findWechatQQGroupUnreadMentionIndex(group);
    if (index < 0) return false;
    const settings = getWechatQQGroupSettings(group);
    const previous = settings.mentionSeenAt;
    settings.mentionSeenAt = Number(group.history[index].timestamp) || Date.now();
    const row = document.querySelector(`#chat-room-content .msg-row[data-msg-idx="${index}"]`);
    await persistWechatQQGroupChange(group, () => { settings.mentionSeenAt = previous; });
    const target = document.querySelector(`#chat-room-content .msg-row[data-msg-idx="${index}"]`) || row;
    target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    target?.classList?.add('qq-mention-flash');
    setTimeout(() => target?.classList?.remove('qq-mention-flash'), 1600);
    return true;
}

let wechatQQMentionCaret = null;

function rememberWechatQQMentionCaret(target) {
    if (target?.id === 'wc-msg-input') {
        wechatQQMentionCaret = { kind: 'plain', pos: Number.isFinite(target.selectionStart) ? target.selectionStart : target.value.length };
        return;
    }
    const selection = window.getSelection?.();
    wechatQQMentionCaret = selection && selection.rangeCount ? { kind: 'rich', range: selection.getRangeAt(0).cloneRange() } : { kind: 'rich', range: null };
}

function insertWechatQQGroupMentionText(text) {
    const value = String(text || '');
    if (!value) return false;
    const caret = wechatQQMentionCaret;
    wechatQQMentionCaret = null;
    if (typeof isWechatRichInputEnabled === 'function' && isWechatRichInputEnabled()) {
        const rich = getWechatRichInputElement();
        rich.focus();
        const selection = window.getSelection?.();
        if (selection) {
            selection.removeAllRanges();
            if (caret?.range) selection.addRange(caret.range);
            else {
                const range = document.createRange();
                range.selectNodeContents(rich);
                range.collapse(false);
                selection.addRange(range);
            }
        }
        if (!document.execCommand?.('insertText', false, value)) rich.appendChild(document.createTextNode(value));
        if (typeof handleWechatRichInputInput === 'function') handleWechatRichInputInput();
        return true;
    }
    const input = document.getElementById('wc-msg-input');
    if (!input) return false;
    const pos = caret?.kind === 'plain' ? Math.min(caret.pos, input.value.length) : input.value.length;
    input.value = `${input.value.slice(0, pos)}${value}${input.value.slice(pos)}`;
    const next = pos + value.length;
    try { input.setSelectionRange(next, next); } catch (_) {}
    input.focus?.();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
}

function pickWechatQQGroupMention(name) {
    if (typeof hideActionSheet === 'function') hideActionSheet();
    return insertWechatQQGroupMentionText(`${name} `);
}

function openWechatQQGroupMentionPicker() {
    const group = getCurrentChatChar();
    if (!isWechatQQGroupChatTheme(group)) return false;
    const targets = getWechatQQGroupMentionTargets(group).filter(item => item.id !== WECHAT_QQ_GROUP_USER_ID);
    const row = (name, avatarHtml, extra = '') => `<div class="wc-sheet-item wc-qq-mention-item" onclick="pickWechatQQGroupMention(${quoteWechatJsString(name)})">${avatarHtml}<span>${wcEscapeHtml(name)}</span>${extra}</div>`;
    showWechatActionSheet(`
        <div class="wc-qq-mention-title">选择提醒的人</div>
        ${row(WECHAT_QQ_MENTION_ALL, '<i class="ri-group-line wc-qq-mention-all-icon"></i>')}
        ${targets.map(item => row(item.name, `<img src="${wcEscapeAttr(item.avatar || DEFAULT_AVATAR)}" alt="">`, renderWechatQQGroupLevelBadge(group, item.id) + renderWechatQQGroupMemberBadge(group, item.id))).join('')}
    `);
    return true;
}

function mentionWechatQQGroupMemberFromMessage(msgIdx) {
    if (typeof closeMsgActionMenu === 'function') closeMsgActionMenu();
    const group = getCurrentChatChar();
    const msg = group?.history?.[msgIdx];
    if (!group?.isGroupChat || !msg || msg.isMe || !msg.senderId) return false;
    wechatQQMentionCaret = null;
    return insertWechatQQGroupMentionText(`@${getWechatQQGroupNameById(group, msg.senderId)} `);
}

function handleWechatQQGroupMentionInput(event) {
    const target = event?.target;
    if (!target || !['wc-msg-input', 'wc-rich-msg-input'].includes(target.id)) return;
    if (!String(event.inputType || '').startsWith('insert') || event.isComposing) return;
    const data = String(event.data || '');
    if (!/[@＠]$/.test(data)) return;
    if (!isWechatQQGroupChatTheme(getCurrentChatChar())) return;
    rememberWechatQQMentionCaret(target);
    openWechatQQGroupMentionPicker();
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('input', handleWechatQQGroupMentionInput, true);
}

// --- C. 群公告 ---
function publishWechatQQGroupAnnouncement(group, text, actorId) {
    const content = String(text || '').trim().slice(0, 240);
    if (!group?.isGroupChat || !content) return null;
    const settings = getWechatQQGroupSettings(group);
    settings.announcement = content;
    settings.announcementAt = Date.now();
    settings.announcementBy = actorId || WECHAT_QQ_GROUP_USER_ID;
    const isUser = settings.announcementBy === WECHAT_QQ_GROUP_USER_ID;
    return {
        type: 'group_announcement',
        isMe: isUser,
        ...(isUser ? {} : { senderId: actorId, senderName: getWechatQQGroupNameById(group, actorId) }),
        content,
        timestamp: createMessageTimestamp()
    };
}

function getWechatQQGroupAnnouncementPublisher(group, msg) {
    return msg.isMe ? '你' : (msg.senderName || getWechatQQGroupNameById(group, msg.senderId));
}

function renderWechatQQGroupAnnouncementCard(msg, group) {
    return `<div class="msg-group-announcement">
        <div class="msg-group-announcement-head"><i class="ri-megaphone-line"></i><b>群公告</b><span>${wcEscapeHtml(getWechatQQGroupAnnouncementPublisher(group, msg))} · ${wcEscapeHtml(formatMessageTime(msg))}</span></div>
        <div class="msg-group-announcement-body">${wcEscapeHtml(msg.content || '')}</div>
    </div>`;
}

function isWechatQQGroupAnnouncementBarVisible(group) {
    const settings = getWechatQQGroupSettings(group);
    if (!isWechatQQGroupChatTheme(group) || !String(settings.announcement || '').trim()) return false;
    return String(settings.announcementDismissedFor || '') !== String(settings.announcementAt || settings.announcement);
}

async function dismissWechatQQGroupAnnouncementBar() {
    const group = getCurrentChatChar();
    if (!group?.isGroupChat) return false;
    const settings = getWechatQQGroupSettings(group);
    const previous = settings.announcementDismissedFor;
    settings.announcementDismissedFor = String(settings.announcementAt || settings.announcement);
    syncWechatQQGroupChatChrome(group);
    const ok = await persistWechatQQGroupChange(group, () => { settings.announcementDismissedFor = previous; });
    syncWechatQQGroupChatChrome(group);
    return ok;
}

function openWechatQQGroupAnnouncementSheet() {
    const group = getCurrentChatChar();
    const settings = getWechatQQGroupSettings(group);
    if (!group?.isGroupChat || !settings.announcement) return false;
    const by = settings.announcementBy ? getWechatQQGroupNameById(group, settings.announcementBy) : '';
    showWechatActionSheet(`<div class="wc-qq-announcement-sheet"><div class="wc-qq-mention-title"><i class="ri-megaphone-line"></i> 群公告${by ? ` · ${wcEscapeHtml(by)}` : ''}</div><p>${wcEscapeHtml(settings.announcement)}</p></div>`);
    return true;
}

// [群公告:发布人|内容] — only the owner or an admin may publish.
function applyWechatQQGroupAnnouncementDirective(rawArgs, group) {
    if (!group?.isGroupChat) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const member = findWechatGroupMember(group, args[0] || '');
    const text = args.slice(1).join('|').trim();
    if (!member || !text) return null;
    const role = getWechatQQGroupMemberRole(group, member.id);
    if (role !== 'owner' && role !== 'admin') {
        return buildWechatQQGroupNotice(`${getWechatQQGroupMemberDisplayName(group, member)} 尝试发布群公告，但没有群管理权限`);
    }
    if (String(getWechatQQGroupSettings(group).announcement || '').trim() === text) return null;
    return publishWechatQQGroupAnnouncement(group, text, member.id);
}

// --- D. 禁言 ---
function parseWechatQQMuteMinutes(value) {
    const text = String(value || '').trim();
    if (!text || /^(?:0|解除|取消|解禁|解除禁言)$/.test(text)) return 0;
    const match = text.match(/(\d+(?:\.\d+)?)\s*(分钟|分|min|小时|时|h|天|日|d)?/i);
    if (!match) return null;
    const amount = Number(match[1]);
    const unit = (match[2] || '分钟').toLowerCase();
    const minutes = /小时|时|h/.test(unit) ? amount * 60 : /天|日|d/.test(unit) ? amount * 1440 : amount;
    return Math.max(1, Math.min(WECHAT_QQ_MUTE_MAX_MINUTES, Math.round(minutes)));
}

function formatWechatQQMuteDuration(minutes) {
    if (minutes % 1440 === 0) return `${minutes / 1440}天`;
    if (minutes % 60 === 0) return `${minutes / 60}小时`;
    return `${minutes}分钟`;
}

function getWechatQQGroupMemberMutedUntil(group, memberId, now = Date.now()) {
    const until = Number(getWechatQQGroupMemberProfile(group, memberId).mutedUntil) || 0;
    return until > now ? until : 0;
}

function isWechatQQGroupMemberMuted(group, memberId, now = Date.now()) {
    return !!(group?.isGroupChat && memberId && memberId !== WECHAT_QQ_GROUP_USER_ID && getWechatQQGroupMemberMutedUntil(group, memberId, now));
}

// Returns the notice text, or '' when nothing changed.
function setWechatQQGroupMemberMute(group, memberId, minutes, actorId = WECHAT_QQ_GROUP_USER_ID) {
    if (!group?.isGroupChat || !memberId || memberId === WECHAT_QQ_GROUP_USER_ID) return '';
    const profile = getWechatQQGroupMemberProfile(group, memberId);
    const wasMuted = isWechatQQGroupMemberMuted(group, memberId);
    const actor = actorId === WECHAT_QQ_GROUP_USER_ID ? '你' : getWechatQQGroupNameById(group, actorId);
    const target = getWechatQQGroupNameById(group, memberId);
    if (!minutes) {
        if (!wasMuted) return '';
        delete profile.mutedUntil;
        return `${actor} 解除了 ${target} 的禁言`;
    }
    profile.mutedUntil = Date.now() + minutes * 60000;
    return `${target} 被 ${actor} 禁言${formatWechatQQMuteDuration(minutes)}`;
}

// [群禁言:操作人|成员名|时长|原因] — owner/admin only; admins cannot mute the owner or other admins.
function applyWechatQQGroupMuteDirective(rawArgs, group) {
    if (!group?.isGroupChat) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const actor = findWechatGroupMember(group, args[0] || '');
    const targetId = resolveWechatQQGroupTargetId(group, args[1] || '');
    const minutes = parseWechatQQMuteMinutes(args[2]);
    if (!actor || !targetId || minutes == null || targetId === actor.id) return null;
    const actorName = getWechatQQGroupMemberDisplayName(group, actor);
    const actorRole = getWechatQQGroupMemberRole(group, actor.id);
    const targetRole = getWechatQQGroupMemberRole(group, targetId);
    if (actorRole !== 'owner' && actorRole !== 'admin') return buildWechatQQGroupNotice(`${actorName} 尝试禁言 ${getWechatQQGroupNameById(group, targetId)}，但没有群管理权限`);
    if (targetId === WECHAT_QQ_GROUP_USER_ID || targetRole === 'owner' || (actorRole === 'admin' && targetRole === 'admin')) {
        return buildWechatQQGroupNotice(`${actorName} 没有权限禁言 ${getWechatQQGroupNameById(group, targetId)}`);
    }
    const text = setWechatQQGroupMemberMute(group, targetId, minutes, actor.id);
    const reason = args.slice(3).join('|').trim();
    return text ? buildWechatQQGroupNotice(reason ? `${text}：${reason}` : text) : null;
}

// --- E. 群内戳一戳 ---
// [群拍一拍:发起人|对象|部位]
function applyWechatQQGroupPokeDirective(rawArgs, group) {
    if (!group?.isGroupChat) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const actor = findWechatGroupMember(group, args[0] || '');
    const targetId = resolveWechatQQGroupTargetId(group, args[1] || '我') || WECHAT_QQ_GROUP_USER_ID;
    if (!actor || targetId === actor.id) return null;
    const suffix = args.slice(2).join('|').trim();
    return {
        type: 'poke',
        isMe: false,
        senderId: actor.id,
        senderName: getWechatQQGroupMemberDisplayName(group, actor),
        pokeTargetId: targetId,
        pokeSuffix: suffix,
        content: suffix,
        note: suffix,
        timestamp: createMessageTimestamp()
    };
}

async function pokeWechatQQGroupMember(memberId) {
    const group = getCurrentChatChar();
    if (!group?.isGroupChat || !memberId || memberId === WECHAT_QQ_GROUP_USER_ID) return false;
    const msg = { type: 'poke', isMe: true, pokeTargetId: memberId, pokeSuffix: '', content: '', timestamp: createMessageTimestamp() };
    group.history = Array.isArray(group.history) ? group.history : [];
    group.history.push(msg);
    const ok = await persistWechatQQGroupChange(group, () => {
        const index = group.history.indexOf(msg);
        if (index !== -1) group.history.splice(index, 1);
    });
    if (ok && typeof triggerWechatScreenFeedback === 'function') triggerWechatScreenFeedback('poke', msg);
    return ok;
}

function shouldVibrateWechatPoke(msg) {
    return !!(msg && msg.type === 'poke' && !msg.isMe && (!msg.pokeTargetId || msg.pokeTargetId === WECHAT_QQ_GROUP_USER_ID));
}

// --- 聊天页顶部公告条与「有人@我」---
function syncWechatQQGroupChatChrome(group = getCurrentChatChar()) {
    const room = document.getElementById('wechat-chat-room');
    const content = document.getElementById('chat-room-content');
    if (!room || !content) return;
    let bar = document.getElementById('wc-qq-announcement-bar');
    let chip = document.getElementById('wc-qq-mention-chip');
    const showBar = isWechatQQGroupAnnouncementBarVisible(group);
    const mentionIndex = isWechatQQGroupChatTheme(group) ? findWechatQQGroupUnreadMentionIndex(group) : -1;
    if (!showBar) {
        bar?.remove();
        content.style.removeProperty('padding-top');
    } else {
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'wc-qq-announcement-bar';
            bar.className = 'wc-qq-announcement-bar';
            room.appendChild(bar);
        }
        bar.innerHTML = `<button type="button" class="wc-qq-announcement-open" onclick="openWechatQQGroupAnnouncementSheet()"><i class="ri-megaphone-line"></i><span>${wcEscapeHtml(getWechatQQGroupSettings(group).announcement)}</span></button><button type="button" class="wc-qq-announcement-close" aria-label="关闭群公告" onclick="dismissWechatQQGroupAnnouncementBar()"><i class="ri-close-line"></i></button>`;
    }
    if (mentionIndex < 0) chip?.remove();
    if (mentionIndex >= 0) {
        if (!chip) {
            chip = document.createElement('button');
            chip.type = 'button';
            chip.id = 'wc-qq-mention-chip';
            chip.className = 'wc-qq-mention-chip';
            chip.onclick = () => openWechatQQGroupUnreadMention();
            room.appendChild(chip);
        }
        const sender = group.history[mentionIndex].senderName || getWechatQQGroupNameById(group, group.history[mentionIndex].senderId);
        chip.innerHTML = `<i class="ri-at-line"></i><span>${wcEscapeHtml(sender)} @了你</span>`;
    }
    if (showBar || mentionIndex >= 0) {
        positionWechatQQGroupChatChrome();
        // Opening a chat slides the room in; measure again once it has laid out.
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => positionWechatQQGroupChatChrome());
        setTimeout(positionWechatQQGroupChatChrome, 380);
    }
}

// Sits just under whatever header the theme draws (its height already includes the safe area)
// and keeps the "@了你" chip above the footer and QQ shortcut bar.
function positionWechatQQGroupChatChrome() {
    const room = document.getElementById('wechat-chat-room');
    const content = document.getElementById('chat-room-content');
    if (!room || !content) return;
    const roomRect = room.getBoundingClientRect();
    const bar = document.getElementById('wc-qq-announcement-bar');
    if (bar) {
        const header = Array.from(room.querySelectorAll('.wc-room-header, .wechat-header, .wc-couple-chat-header'))
            .find(node => node.getClientRects?.().length && getComputedStyle(node).display !== 'none');
        const top = header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom - roomRect.top)) : 0;
        bar.style.top = `${top + 6}px`;
        content.style.removeProperty('padding-top');
        const basePadding = parseFloat(getComputedStyle(content).paddingTop) || 0;
        const needed = top + 6 + (bar.offsetHeight || 38) + 8;
        if (basePadding < needed) content.style.paddingTop = `${needed}px`;
    }
    const chip = document.getElementById('wc-qq-mention-chip');
    if (chip) {
        const anchors = [room.querySelector('.wc-room-footer'), document.getElementById('wc-qq-group-shortcut-bar')]
            .filter(Boolean).map(node => node.getBoundingClientRect().top).filter(value => value > roomRect.top);
        const anchorTop = anchors.length ? Math.min(...anchors) : 0;
        chip.style.bottom = `${Math.max(90, Math.round((anchorTop ? roomRect.bottom - anchorTop : 90) + 10))}px`;
    }
}

// --- 群聊提示词 ---
function buildWechatQQGroupPromptExtras(group) {
    if (!group?.isGroupChat) return '';
    const settings = getWechatQQGroupSettings(group);
    const now = Date.now();
    const muted = getWechatGroupMembers(group)
        .filter(member => isWechatQQGroupMemberMuted(group, member.id, now))
        .map(member => {
            const until = new Date(getWechatQQGroupMemberMutedUntil(group, member.id, now));
            return `${getWechatQQGroupMemberDisplayName(group, member)}（禁言至 ${until.getMonth() + 1}月${until.getDate()}日 ${String(until.getHours()).padStart(2, '0')}:${String(until.getMinutes()).padStart(2, '0')}）`;
        });
    const userName = getWechatQQGroupUserDisplayName(group);
    return [
        settings.announcement ? `- 当前群公告：${String(settings.announcement).slice(0, 240)}` : '',
        muted.length ? `- 正在禁言的成员：${muted.join('、')}。他们本轮不能发言，系统会丢弃他们的发言；其他成员可以提到他们被禁言。` : '',
        `- @规则：用户消息里出现「@成员名」时，被 @ 的成员必须第一个回复并正面回应；出现「@${WECHAT_QQ_MENTION_ALL}」时每个成员都要回应。成员也可以在发言里写「@${userName}」点名用户，或「@其他成员名」点名别人；不要每句都 @。`,
        '- 群主或管理员可以用 [群公告:发布人|公告内容] 发布新群公告，用 [群禁言:操作人|成员名|时长|原因] 禁言成员（时长如 10分钟、1小时、1天，写“解除”则解除禁言）；管理员不能禁言群主或其他管理员，普通成员没有这些权限。',
        `- 成员可以用 [群拍一拍:发起人|对象|部位] 戳一戳用户或别的成员，例如 [群拍一拍:成员名|${userName}|脑袋]；少用，不要连续戳。`
    ].filter(Boolean).join('\n');
}
