// --- 微信语音/视频通话 ---
function getWechatCallLabel(type) {
    return type === 'videoCall' ? '视频通话' : '语音通话';
}

function getWechatCallIcon(type) {
    return type === 'videoCall' ? 'ri-video-chat-fill' : 'ri-phone-fill';
}

function normalizeWechatCallParticipant(item, char, fallbackIndex = 0) {
    if (!item || typeof item !== 'object') return null;
    const id = String(item.id || item.charId || item.memberId || `participant-${fallbackIndex}`);
    const name = item.name || item.displayName || item.nickname || (item.isUser ? '我' : '');
    const avatar = item.avatar || item.avatarUrl || item.image || '';
    return {
        id,
        name: name || (char?.isGroupChat ? '成员' : getWechatCharDisplayName(char)),
        avatar: avatar || DEFAULT_AVATAR,
        isUser: !!item.isUser
    };
}

function getWechatCallParticipants(char, source = null) {
    const existing = Array.isArray(source?.participants) ? source.participants : [];
    const raw = existing.length
        ? existing
        : (char?.isGroupChat
            ? getWechatQQGroupDisplayMembers(char).map(member => ({
                id: member.id,
                name: getWechatQQGroupMemberDisplayName(char, member),
                avatar: member.avatar || DEFAULT_AVATAR,
                isUser: !!member.isUser
            }))
            : [{
                id: char?.id || 'peer',
                name: getWechatCharDisplayName(char),
                avatar: char?.avatar || DEFAULT_AVATAR
            }]);
    const seen = new Set();
    return raw
        .map((item, index) => normalizeWechatCallParticipant(item, char, index))
        .filter(item => {
            if (!item) return false;
            const key = item.id || `${item.name}|${item.avatar}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function getWechatCallAvatarStackWidth(count, extraClass = '') {
    const visible = Math.max(1, Number(count) || 1);
    if (String(extraClass || '').includes('msg-call-avatars')) return 24 + (Math.min(visible, 4) - 1) * 16;
    if (String(extraClass || '').includes('wc-call-island-avatars')) return 34 + (Math.min(visible, 6) - 1) * 23;
    if (String(extraClass || '').includes('wc-call-top-avatars')) {
        if (visible <= 1) return 84;
        return 64 + (Math.min(visible, 6) - 1) * 44;
    }
    return 38 + (Math.min(visible, 6) - 1) * 26;
}

function renderWechatCallAvatarStack(char, source = null, extraClass = '') {
    const participants = getWechatCallParticipants(char, source);
    const count = Math.max(1, participants.length);
    const width = getWechatCallAvatarStackWidth(count, extraClass);
    const classes = [
        'wc-call-avatars',
        extraClass,
        count > 1 ? 'multi' : 'single',
        char?.isGroupChat ? 'is-group' : 'is-peer'
    ].filter(Boolean).join(' ');
    const images = participants.map(item => `
        <img src="${wcEscapeAttr(item.avatar || DEFAULT_AVATAR)}" alt="${wcEscapeAttr(item.name || '成员')}" title="${wcEscapeAttr(item.name || '成员')}" onerror="this.src='${DEFAULT_AVATAR}'">
    `).join('');
    return `<div class="${wcEscapeAttr(classes)}" data-count="${count}" style="--avatar-count:${count};--wc-call-stack-width:${width}px">${images}</div>`;
}

function mountWechatCallAvatarStack(target, char, source = null, extraClass = '') {
    if (!target) return;
    const participants = getWechatCallParticipants(char, source);
    const count = Math.max(1, participants.length);
    const width = getWechatCallAvatarStackWidth(count, extraClass);
    target.className = [
        'wc-call-avatars',
        extraClass,
        count > 1 ? 'multi' : 'single',
        char?.isGroupChat ? 'is-group' : 'is-peer'
    ].filter(Boolean).join(' ');
    target.dataset.count = String(count);
    target.style.setProperty('--avatar-count', String(count));
    target.style.setProperty('--wc-call-stack-width', `${width}px`);
    target.innerHTML = participants.map(item => `
        <img src="${wcEscapeAttr(item.avatar || DEFAULT_AVATAR)}" alt="${wcEscapeAttr(item.name || '成员')}" title="${wcEscapeAttr(item.name || '成员')}" onerror="this.src='${DEFAULT_AVATAR}'">
    `).join('');
}

function isWechatIncomingCallMessage(msg) {
    return msg && (msg.type === 'voiceCall' || msg.type === 'videoCall') && msg.isMe === false && msg.status === '来电';
}

function isWechatChatPageActive(charId) {
    const win = document.getElementById('app-wechat-window');
    const room = document.getElementById('wechat-chat-room');
    return !!(win && room && win.classList.contains('active') && !win.classList.contains('hidden') && room.classList.contains('active') && window.currentChatCharId === charId);
}

function isByndDesktopVisible() {
    const home = document.getElementById('home-screen');
    const activeWindow = document.querySelector('.app-window.active:not(.hidden)');
    return !!(home && !home.classList.contains('hidden') && !activeWindow);
}

function playWechatMessageIslandTone() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = window._wechatMessageIslandAudioCtx || new AudioCtx();
        window._wechatMessageIslandAudioCtx = ctx;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        [660, 880].forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, now + index * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.045, now + index * 0.09 + 0.016);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.13);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + index * 0.09);
            osc.stop(now + index * 0.09 + 0.15);
        });
    } catch (e) {}
}

function showWechatDesktopMessageIsland(char) {
    if (!char || isWechatChatPageActive(char.id) || !isByndDesktopVisible()) return;
    if (isWechatQQGroupMuted(char)) return;
    const host = getWechatModalRoot();
    let island = document.getElementById('wc-message-island');
    if (!island) {
        island = document.createElement('div');
        island.id = 'wc-message-island';
        island.className = 'wc-message-island';
        host.appendChild(island);
    }
    const name = getWechatCharDisplayName(char);
    const preview = getChatPreview(char).replace(/\s+/g, ' ').slice(0, 120);
    island.innerHTML = `
        <div class="wc-message-island-main">
            <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
            <div class="wc-message-island-text">
                <strong>${wcEscapeHtml(name)}</strong>
                <span>${wcEscapeHtml(preview || '发来一条消息')}</span>
            </div>
        </div>
        <i class="ri-wechat-line"></i>
    `;
    island.onclick = () => {
        island.classList.remove('show');
        if (typeof openApp === 'function') openApp('wechat');
        setTimeout(() => openChat(char.id), 80);
    };
    clearTimeout(window._wechatMessageIslandTimer);
    island.classList.remove('show');
    requestAnimationFrame(() => island.classList.add('show'));
    playWechatMessageIslandTone();
    window._wechatMessageIslandTimer = setTimeout(() => {
        island.classList.remove('show');
    }, 5200);
}

function showWechatNotifyIntervalIsland(char, intervalLabel, reason = '') {
    if (!char) return;
    const host = getWechatModalRoot();
    let island = document.getElementById('wc-notify-interval-island');
    if (!island) {
        island = document.createElement('div');
        island.id = 'wc-notify-interval-island';
        island.className = 'wc-message-island wc-notify-interval-island';
        host.appendChild(island);
    }
    const name = getWechatCharDisplayName(char);
    const subtitle = reason
        ? `改为 ${intervalLabel}：${stripWechatPromptText(reason, 26)}`
        : `改为 ${intervalLabel}`;
    island.innerHTML = `
        <div class="wc-message-island-main">
            <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
            <div class="wc-message-island-text">
                <strong>${wcEscapeHtml(name)}改了后台时间</strong>
                <span>${wcEscapeHtml(subtitle)}</span>
            </div>
        </div>
        <i class="ri-timer-flash-line"></i>
    `;
    island.onclick = () => {
        island.classList.remove('show');
        if (typeof openApp === 'function') openApp('settings');
    };
    clearTimeout(window._wechatNotifyIntervalIslandTimer);
    island.classList.remove('show');
    requestAnimationFrame(() => island.classList.add('show'));
    playWechatMessageIslandTone();
    window._wechatNotifyIntervalIslandTimer = setTimeout(() => {
        island.classList.remove('show');
    }, 5600);
}

const WECHAT_MONITOR_COOLDOWN_MS = 14000;
const WECHAT_MONITOR_MAX_WATCHERS = 3;
const WECHAT_MONITOR_LEVELS = ['silent', 'island', 'barrage', 'warning'];
const WECHAT_MONITOR_MODE_LABELS = {
    persona: '按角色人设',
    observer: '第三方视角吐槽'
};
window._wechatMonitorLastRequestAt = window._wechatMonitorLastRequestAt || {};

function getWechatMonitorEventId(targetChar, msg) {
    if (!msg) return '';
    if (!msg.monitorEventId) {
        msg.monitorEventId = `mon_${targetChar?.id || 'chat'}_${msg.timestamp || Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    return msg.monitorEventId;
}

function isWechatMonitorableUserMessage(msg) {
    if (!msg || msg.isMe !== true || msg.monitorEvent || msg.type === 'system_notice') return false;
    return ['text', 'image', 'sticker', 'voice', 'transfer', 'redpacket', 'gift', 'intimatePay', 'voiceCall', 'videoCall'].includes(msg.type || 'text');
}

function getWechatMonitorState(char) {
    char.chatConfig = char.chatConfig || {};
    const state = char.chatConfig.monitorState && typeof char.chatConfig.monitorState === 'object'
        ? char.chatConfig.monitorState
        : {};
    state.processedIds = Array.isArray(state.processedIds) ? state.processedIds.slice(-40) : [];
    char.chatConfig.monitorState = state;
    return state;
}

function getWechatMonitorMode(char) {
    const mode = char && char.chatConfig && char.chatConfig.monitorMode;
    if (mode === 'god' || mode === 'cp') return 'observer';
    return Object.prototype.hasOwnProperty.call(WECHAT_MONITOR_MODE_LABELS, mode) ? mode : 'persona';
}

function getWechatMonitorModePrompt(mode) {
    if (mode === 'observer') return '采用第三方路人弹幕视角。你不是角色本人，也不是 user/char 的代言人，而是屏幕外一群吃瓜群众、看剧路人、磕糖党、梗党、亲妈粉、显眼包和前排观众在围观当前互动。barrage 每条都必须是“昵称：吐槽言论”的字符串，昵称必须由你按当次剧情原创，搞笑、中二、抽象、有网感，不要从固定列表选，不要使用真实用户姓名或角色名。吐槽言论要像真实弹幕/抖音热评/小红书评论区：短句、疯言疯语、语气词乱飞、可有错别字、emoji、@别人、盖楼、互相点赞/质疑/接梗，可以出现“这幕我收藏了/备孕了”这类网络语感。弹幕只写围观反应，不写剧情正文，不做长篇分析，不替任何人说话。严禁引用、复述或改写 user/char 的原话；不要使用“用户：”“char：”“他说/她说/你说”这类发言转述；不要把弹幕写成角色发给用户的聊天消息。可以缺德但不恶毒，可以磕、可以疑惑、可以起哄、可以提醒“这波不对劲”。重点看气氛、反差、暧昧、误会、动作和关系张力。不得攻击用户人格，不得威胁、控制、网暴或声称访问真实设备。除非完全没有可吐槽内容，否则 level 优先返回 barrage，并给 4-9 条 12-42 字弹幕。';
    return '采用角色本人视角，必须贴合角色卡、人设、关系和记忆，可吃味、嘴硬或吐槽，但默认是娱乐化反应，不要偏激。';
}

function getWechatMonitorWatchers(targetChar) {
    const targetId = targetChar && targetChar.id;
    const candidates = (window.myCharacters || []).filter(char => (
        char && char.id && !char.isGroupChat && char.chatConfig && char.chatConfig.monitorEnabled
    ));
    const selected = [];
    const seen = new Set();
    const push = (char) => {
        if (!char || !char.id || seen.has(char.id)) return;
        selected.push(char);
        seen.add(char.id);
    };

    // In observer mode the active chat itself is the watcher, so it must not
    // be pushed out by older global monitor entries before the max watcher cap.
    push(candidates.find(char => char.id === targetId && getWechatMonitorMode(char) === 'observer'));
    candidates.forEach(char => {
        if (getWechatMonitorMode(char) === 'observer') push(char);
    });
    candidates.forEach(char => {
        if (char.id !== targetId && getWechatMonitorMode(char) !== 'observer') push(char);
    });
    return selected.slice(0, WECHAT_MONITOR_MAX_WATCHERS);
}

function notifyWechatMonitors(targetChar, userMsg) {
    if (!targetChar || !isWechatMonitorableUserMessage(userMsg)) return;
    const watchers = getWechatMonitorWatchers(targetChar);
    if (!watchers.length) return;
    const eventId = getWechatMonitorEventId(targetChar, userMsg);
    watchers.forEach((watcher, index) => {
        window.setTimeout(() => {
            requestWechatMonitorReaction(watcher, targetChar, userMsg, eventId).catch(err => {
                console.warn('wechat monitor reaction failed:', err);
            });
        }, index * 700);
    });
}

function buildWechatMonitorMessages(watcher, targetChar, userMsg) {
    const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(targetChar) : ((typeof getUserProfile === 'function') ? getUserProfile() : { name: '用户' });
    const byndContacts = (window.myCharacters || [])
        .filter(char => char && !char.isGroupChat)
        .map(char => getWechatCharDisplayName(char))
        .filter(Boolean);
    const watcherName = getWechatCharDisplayName(watcher);
    const targetName = getWechatCharDisplayName(targetChar);
    const observed = stripWechatPromptText(getWechatMessagePromptContent(userMsg), 520);
    const watcherHistory = buildWechatRecentHistoryForPrompt(watcher, 10);
    const targetHistory = buildWechatRecentHistoryForPrompt(targetChar, 10);
    const watcherWorldBook = buildWechatWorldBookPrompt(watcher, 30);
    const memoryAnchor = typeof buildWechatMemoryPrompt === 'function' ? buildWechatMemoryPrompt(watcher) : '';
    const monitorState = watcher && watcher.chatConfig && watcher.chatConfig.monitorState && typeof watcher.chatConfig.monitorState === 'object'
        ? watcher.chatConfig.monitorState
        : {};
    const previousBarrage = Array.isArray(monitorState.lastBarrage)
        ? monitorState.lastBarrage.map(item => stripWechatPromptText(item, 28)).filter(Boolean).slice(-8)
        : [];
    const randomSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const monitorMode = getWechatMonitorMode(watcher);
    const monitorModeLabel = WECHAT_MONITOR_MODE_LABELS[monitorMode] || WECHAT_MONITOR_MODE_LABELS.persona;
    const monitorModePrompt = getWechatMonitorModePrompt(monitorMode);
    const systemPrompt = typeof buildSystemPrompt === 'function'
        ? buildSystemPrompt(watcher)
        : `你是「${watcher.name || watcherName}」。请保持角色设定。`;

    return [
        {
            role: 'system',
            content: systemPrompt
        },
        {
            role: 'system',
            content: `这是 BYND 应用内部的虚构娱乐剧情功能「监控」，只允许观察 BYND 内部微信角色聊天记录，不能声称访问真实手机联系人、真实微信、系统短信或外部设备。监控吐槽视角：${monitorModeLabel}。${monitorModePrompt} 请按人设、关系、世界书、记忆和当前聊天气氛反应。不要写极端威胁、封锁、强控制、恐吓、惩罚或黑客攻击；本质是像观众看剧一样的弹幕吐槽、磕糖、吃瓜、起哄或旁观反应。只返回 JSON，不要 Markdown，不要解释。JSON 字段：level, island, warning, barrage, deleteContact。level 只能是 silent/island/barrage/warning。island 是灵动岛短句 8-30 字；warning 是弹窗提示 12-70 字；barrage 是 0-10 条随机飞字短句数组。deleteContact 可为空；只有角色本人视角才允许按人设返回 deleteContact；第三方视角必须让 deleteContact 为空。普通消息可 silent/island；有戏剧张力时优先用 barrage，像路人刷弹幕；如果当前模式是「第三方视角吐槽」，除非完全无内容，否则必须返回 level:"barrage" 并让 barrage 至少 4 条。第三方视角的 barrage 每条必须写成“AI原创抽象昵称：吐槽言论”，昵称不要用 user/char/用户/角色/真实姓名，不要从固定列表选择，言论要有网络语感、短句、疯言疯语、错别字、表情符、@互动、盖楼感或热梗。禁止照抄、引用、复述 user/char 原话，不要写成角色发言或系统解说。每次必须根据当前这条消息重新生成，不要复用上次弹幕，不要套用“前排吃瓜、镜头别切、这波有戏、气氛微妙”这类通用固定句。只有用户明确要求严肃提醒或剧情已经非常尖锐时才 warning。本次生成随机因子：${randomSeed}。`
        },
        {
            role: 'user',
            content: `用户：${userProfile.name || '用户'}\nBYND 内部联系人数量：${byndContacts.length}\nBYND 联系人：${byndContacts.slice(0, 24).join('、') || '暂无'}\n监控角色：${watcherName}\n被观察聊天对象：${targetName}\n监控吐槽视角：${monitorModeLabel}\n上次第三方弹幕（本次不要重复这些语气和句式）：${previousBarrage.join(' / ') || '无'}\n${watcherWorldBook ? `${watcherWorldBook}\n` : ''}${memoryAnchor ? `${memoryAnchor}\n` : ''}用户刚刚发给 ${targetName} 的消息：${observed || '[非文字消息]'}\n\n以下聊天记录只用于判断气氛和关系走向；第三方弹幕不得引用原句，不得复述为 user/char 发言。第三方弹幕请全部使用“你当场原创的抽象昵称：网络语感吐槽”格式，昵称和吐槽都必须根据当前气氛生成，不能像固定模板。\n\n${watcherName} 与用户最近聊天：\n${watcherHistory}\n\n用户与 ${targetName} 最近聊天：\n${targetHistory}`
        }
    ];
}

function normalizeWechatMonitorLevel(level) {
    const text = String(level || '').trim().toLowerCase();
    return WECHAT_MONITOR_LEVELS.includes(text) ? text : 'island';
}

function getWechatMonitorLevelIndex(level) {
    return Math.max(0, WECHAT_MONITOR_LEVELS.indexOf(normalizeWechatMonitorLevel(level)));
}

function markWechatMonitorEventProcessed(state, eventId) {
    if (!state || !eventId) return;
    state.processedIds = Array.isArray(state.processedIds) ? state.processedIds : [];
    if (!state.processedIds.includes(eventId)) state.processedIds.push(eventId);
    state.processedIds = state.processedIds.slice(-40);
}

function fallbackWechatObserverMonitor(watcher, targetChar, userMsg, eventId, state, message) {
    if (!state) return;
    state.lastError = stripWechatPromptText(message || '监控剧情暂时无法调用 API', 90);
    markWechatMonitorEventProcessed(state, eventId);
    state.lastTargetId = targetChar.id;
    state.lastAt = Date.now();
    saveCharactersToStorage();
}

function normalizeWechatBarrageItemText(item) {
    if (item && typeof item === 'object') {
        const name = stripWechatPromptText(item.nickname || item.name || item.author || item.user || '', 14);
        const text = stripWechatPromptText(item.text || item.comment || item.content || item.message || item.value || '', 52);
        return name && text ? `${name}：${text}` : (text || name);
    }
    return stripWechatPromptText(item || '', 72);
}

function parseWechatObserverBarrageSpeaker(text) {
    let clean = String(text || '').trim();
    clean = clean.replace(/^([^：:\s]{1,14})\s*[：:]\s*/, '$1：');
    const match = clean.match(/^([^：:]{1,14})[：:](.+)$/);
    if (!match) return null;
    const name = stripWechatPromptText(match[1], 14).trim();
    const body = stripWechatPromptText(match[2], 58).trim();
    if (!name || !body || /^(?:user|char|用户|角色)$/i.test(name)) return null;
    return { name, body };
}

function hasWechatObserverBarrageSpeaker(text) {
    return !!parseWechatObserverBarrageSpeaker(normalizeWechatBarrageItemText(text));
}

function sanitizeWechatObserverBarrageText(text) {
    let clean = normalizeWechatBarrageItemText(text)
        .replace(/[「“"'‘][^「」“”"'‘’]{1,40}[」”"'’]/g, '这波')
        .replace(/^\s*(?:user|char|用户|角色)\s*[：:]\s*/i, '')
        .replace(/\b(?:user|char)\b/gi, '')
        .replace(/用户刚刚说|角色刚刚说|他说|她说|你说|我说/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!clean || /^[：:，,。.！!？?、\s]+$/.test(clean)) return '';
    const speaker = parseWechatObserverBarrageSpeaker(clean);
    if (!speaker) return '';
    return `${speaker.name}：${speaker.body}`.slice(0, 72);
}

function extractWechatBarrageRepairLines(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.barrage)) return parsed.barrage;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    return [];
}

async function repairWechatObserverBarrageSpeakers(reaction) {
    if (!reaction) return reaction;
    const sourceItems = Array.isArray(reaction.barrage) && reaction.barrage.length
        ? reaction.barrage
        : [reaction.island, reaction.warning];
    const normalized = sourceItems.map(normalizeWechatBarrageItemText).filter(Boolean).slice(0, 10);
    if (!normalized.length || normalized.every(hasWechatObserverBarrageSpeaker)) {
        reaction.barrage = normalized;
        return reaction;
    }
    if (typeof callChatApi !== 'function') {
        reaction.barrage = normalized.filter(hasWechatObserverBarrageSpeaker);
        return reaction;
    }
    try {
        const result = await callChatApi([
            {
                role: 'system',
                content: '你是弹幕评论区昵称与吐槽改写器。只输出 JSON，不要解释。把输入弹幕改写为 JSON 数组，每条必须是“AI原创抽象昵称：吐槽言论”。昵称必须由你现场原创，搞笑、中二、抽象、有网感，不得使用真实姓名、用户、角色、user、char；不要照抄输入里的昵称。吐槽言论保持短句、网络语感、错别字/语气词/emoji/@互动/盖楼感可以有，但禁止引用或复述原聊天内容。'
            },
            {
                role: 'user',
                content: `把这些弹幕补齐或重写成“原创抽象昵称：吐槽言论”，保留 ${Math.min(10, normalized.length)} 条左右：\n${normalized.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
            }
        ], { background: true, temperature: 0.98, usageFeature: 'agent' });
        if (!result || !result.ok) {
            reaction.barrage = normalized.filter(hasWechatObserverBarrageSpeaker);
            return reaction;
        }
        const repaired = extractWechatBarrageRepairLines(parseWechatJsonObject(result.content))
            .map(normalizeWechatBarrageItemText)
            .filter(Boolean)
            .slice(0, 10);
        reaction.barrage = repaired.length ? repaired : normalized.filter(hasWechatObserverBarrageSpeaker);
        return reaction;
    } catch (e) {
        console.warn('observer barrage repair failed:', e);
        reaction.barrage = normalized.filter(hasWechatObserverBarrageSpeaker);
        return reaction;
    }
}

async function ensureWechatObserverReactionVisible(watcher, targetChar, userMsg, reaction) {
    if (getWechatMonitorMode(watcher) !== 'observer' || !reaction) return reaction;
    if (normalizeWechatMonitorLevel(reaction.level) === 'silent') reaction.level = 'barrage';
    reaction = await repairWechatObserverBarrageSpeakers(reaction);
    const cleaned = Array.isArray(reaction.barrage)
        ? reaction.barrage.map(sanitizeWechatObserverBarrageText).filter(Boolean)
        : [];
    [reaction.island, reaction.warning].forEach(item => {
        const text = sanitizeWechatObserverBarrageText(item);
        if (!cleaned.length && text) cleaned.push(text);
    });
    reaction.barrage = cleaned.filter((item, index, arr) => arr.indexOf(item) === index).slice(0, 10);
    reaction.island = reaction.barrage[0] || '';
    reaction.warning = '';
    reaction.deleteContact = null;
    if (!reaction.island && !reaction.barrage.length) return null;
    return reaction;
}

function normalizeWechatMonitorReaction(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const level = normalizeWechatMonitorLevel(raw.level);
    const island = stripWechatPromptText(raw.island || raw.message || raw.text || '', 42);
    const warning = stripWechatPromptText(raw.warning || raw.warn || island || '', 90);
    const barrage = Array.isArray(raw.barrage)
        ? raw.barrage.map(normalizeWechatBarrageItemText).filter(Boolean).slice(0, 10)
        : [];
    const deleteRaw = raw.deleteContact && typeof raw.deleteContact === 'object' ? raw.deleteContact : null;
    const deleteContact = deleteRaw ? {
        name: stripWechatPromptText(deleteRaw.name || deleteRaw.target || '', 36),
        reason: stripWechatPromptText(deleteRaw.reason || '', 80)
    } : null;
    if (level !== 'silent' && !island && !warning && !barrage.length && !(deleteContact && deleteContact.name)) return null;
    return { level, island, warning, barrage, deleteContact };
}

function escalateWechatMonitorLevel(state, reaction, targetChar, watcher) {
    let level = reaction.level;
    const mode = getWechatMonitorMode(watcher);
    const now = Date.now();
    const sameTarget = state.lastTargetId === targetChar.id && state.lastAt && now - state.lastAt < 10 * 60 * 1000;
    const suspicion = sameTarget ? Math.min(10, Number(state.suspicion || 0) + Math.max(1, getWechatMonitorLevelIndex(level))) : getWechatMonitorLevelIndex(level);
    if (sameTarget && suspicion >= 3 && getWechatMonitorLevelIndex(level) < getWechatMonitorLevelIndex('barrage')) level = 'barrage';
    if (mode === 'observer' && level !== 'silent' && getWechatMonitorLevelIndex(level) < getWechatMonitorLevelIndex('barrage')) level = 'barrage';
    state.suspicion = suspicion;
    state.lastTargetId = targetChar.id;
    state.lastAt = now;
    state.lastLevel = level;
    return level;
}

async function requestWechatMonitorReaction(watcher, targetChar, userMsg, eventId) {
    if (!watcher || !targetChar || !eventId) return;
    const state = getWechatMonitorState(watcher);
    if (state.processedIds.includes(eventId)) return;
    const requestKey = `${watcher.id}:${targetChar.id}`;
    const now = Date.now();
    if (window._wechatMonitorLastRequestAt[requestKey] && now - window._wechatMonitorLastRequestAt[requestKey] < WECHAT_MONITOR_COOLDOWN_MS) {
        return;
    }
    window._wechatMonitorLastRequestAt[requestKey] = now;

    if (typeof callChatApi !== 'function') {
        fallbackWechatObserverMonitor(watcher, targetChar, userMsg, eventId, state, '监控剧情无法调用 API');
        return;
    }
    if (isWechatAiRateLimitPaused() || isWechatBackgroundApiPaused()) {
        fallbackWechatObserverMonitor(watcher, targetChar, userMsg, eventId, state, '接口要求等待，监控剧情请求暂未发送');
        return;
    }

    const monitorApiOptions = { background: true, usageFeature: 'agent', usageChar: watcher };
    if (getWechatMonitorMode(watcher) === 'observer') monitorApiOptions.temperature = 0.95;
    const result = await callChatApi(buildWechatMonitorMessages(watcher, targetChar, userMsg), monitorApiOptions);
    if (!result || !result.ok) {
        state.lastError = (result && result.error) || '监控剧情 API 调用失败';
        fallbackWechatObserverMonitor(watcher, targetChar, userMsg, eventId, state, state.lastError);
        saveCharactersToStorage();
        return;
    }

    let reaction = normalizeWechatMonitorReaction(parseWechatJsonObject(result.content));
    if (!reaction) {
        state.lastError = '监控剧情 API 没有返回可解析 JSON';
        fallbackWechatObserverMonitor(watcher, targetChar, userMsg, eventId, state, state.lastError);
        saveCharactersToStorage();
        return;
    }
    reaction = await ensureWechatObserverReactionVisible(watcher, targetChar, userMsg, reaction);
    if (!reaction) {
        state.lastError = '监控剧情 API 没有生成可展示弹幕';
        markWechatMonitorEventProcessed(state, eventId);
        saveCharactersToStorage();
        return;
    }

    const level = escalateWechatMonitorLevel(state, reaction, targetChar, watcher);
    markWechatMonitorEventProcessed(state, eventId);
    state.lastError = '';
    if (getWechatMonitorMode(watcher) === 'observer') {
        state.lastBarrage = Array.isArray(reaction.barrage) ? reaction.barrage.slice(0, 10) : [];
    }
    if (getWechatMonitorMode(watcher) !== 'observer') {
        appendWechatMonitorRecord(watcher, targetChar, userMsg, reaction, level);
        maybeApplyWechatMonitorContactDelete(watcher, reaction);
    }
    saveCharactersToStorage();
    renderChatList();
    if (getWechatMonitorMode(watcher) !== 'observer' && window.currentChatCharId === watcher.id) refreshChatView(watcher);
    presentWechatMonitorReaction(watcher, targetChar, reaction, level);
}

function appendWechatMonitorRecord(watcher, targetChar, userMsg, reaction, level) {
    if (getWechatMonitorMode(watcher) === 'observer') return;
    const text = reaction.warning || reaction.island || reaction.barrage[0] || '';
    if (!text) return;
    const targetName = getWechatCharDisplayName(targetChar);
    const observed = getWechatMessagePlainSummary(userMsg, 80);
    if (!watcher.history) watcher.history = [];
    watcher.history.push({
        type: 'text',
        isMe: false,
        content: `【旁观吐槽：你和${targetName}】${text}`,
        description: `[监控] 看到你发给${targetName}：${observed}`,
        monitorEvent: true,
        monitorLevel: level,
        monitorTargetId: targetChar.id,
        timestamp: createMessageTimestamp()
    });
}


function maybeApplyWechatMonitorContactDelete(watcher, reaction) {
    const request = reaction && reaction.deleteContact;
    if (!watcher || !request || !request.name) return;
    const msg = applyWechatContactDeleteDirective(`${request.name}|${request.reason || '监控剧情触发'}`, watcher);
    if (!msg) return;
    if (!watcher.history) watcher.history = [];
    watcher.history.push(msg);
}

function presentWechatMonitorReaction(watcher, targetChar, reaction, level) {
    if (level === 'silent') return;
    const islandText = reaction.island || reaction.warning || reaction.barrage[0] || '';
    if (!islandText) return;
    showWechatMonitorIsland(watcher, targetChar, islandText);
    if (level === 'warning') {
        showWechatMonitorWarning(watcher, reaction.warning || islandText);
    }
    if (['barrage', 'warning'].includes(level)) {
        const basePhrases = reaction.barrage.length ? reaction.barrage : [islandText, reaction.warning || islandText];
        showWechatMonitorBarrage(watcher, buildWechatMonitorBarrageBurst(basePhrases, level));
    }
    if (navigator.vibrate && ['warning', 'barrage'].includes(level)) {
        navigator.vibrate([45, 25, 65]);
    }
}

function showWechatMonitorIsland(watcher, targetChar, text) {
    if (!watcher || isWechatChatPageActive(watcher.id)) return;
    const host = getWechatModalRoot();
    let island = document.getElementById('wc-monitor-island');
    if (!island) {
        island = document.createElement('div');
        island.id = 'wc-monitor-island';
        island.className = 'wc-message-island wc-monitor-island';
        host.appendChild(island);
    }
    const watcherName = getWechatCharDisplayName(watcher);
    const targetName = getWechatCharDisplayName(targetChar);
    island.innerHTML = `
        <div class="wc-message-island-main">
            <img src="${wcEscapeHtml(watcher.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
            <div class="wc-message-island-text">
                <strong>${wcEscapeHtml(watcherName)} 发来吐槽</strong>
                <span>${wcEscapeHtml(targetName)} · ${wcEscapeHtml(text)}</span>
            </div>
        </div>
        <i class="ri-eye-line"></i>
    `;
    island.onclick = () => {
        island.classList.remove('show');
        if (typeof openApp === 'function') openApp('wechat');
        setTimeout(() => openChat(watcher.id), 80);
    };
    clearTimeout(window._wechatMonitorIslandTimer);
    island.classList.remove('show');
    requestAnimationFrame(() => island.classList.add('show'));
    playWechatMessageIslandTone();
    window._wechatMonitorIslandTimer = setTimeout(() => island.classList.remove('show'), 6200);
}

function showWechatMonitorWarning(watcher, text) {
    const host = getWechatModalRoot();
    let modal = document.getElementById('wc-monitor-warning');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-monitor-warning';
        modal.className = 'wc-monitor-warning';
        host.appendChild(modal);
    }
    const name = getWechatCharDisplayName(watcher);
    modal.innerHTML = `
        <div class="wc-monitor-card">
            <div class="wc-monitor-card-head">
                <img src="${wcEscapeHtml(watcher.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div><strong>${wcEscapeHtml(name)}</strong><span>监控剧情警告</span></div>
            </div>
            <p>${wcEscapeHtml(text)}</p>
            <div class="wc-monitor-card-actions">
                <button type="button" onclick="document.getElementById('wc-monitor-warning')?.classList.remove('show')">知道了</button>
                <button type="button" class="primary" onclick="openWechatMonitorChat(${quoteWechatJsString(watcher.id)})">去找TA</button>
            </div>
        </div>
    `;
    requestAnimationFrame(() => modal.classList.add('show'));
}

function openWechatMonitorChat(charId) {
    document.getElementById('wc-monitor-warning')?.classList.remove('show');
    document.getElementById('wc-monitor-lockdown')?.remove();
    if (typeof openApp === 'function') openApp('wechat');
    setTimeout(() => openChat(charId), 80);
}

function showWechatMonitorBarrage(watcher, phrases) {
    const host = getWechatModalRoot();
    const old = document.getElementById('wc-monitor-barrage');
    if (old) old.remove();
    const barrage = document.createElement('div');
    barrage.id = 'wc-monitor-barrage';
    barrage.className = 'wc-monitor-barrage';
    const safePhrases = (phrases || [])
        .map(phrase => stripWechatPromptText(phrase, 72))
        .filter(Boolean)
        .slice(0, 16);
    const speed = getWechatMonitorBarrageSpeed(watcher);
    barrage.innerHTML = safePhrases.map((phrase, index) => `
        <span style="--i:${index};--top:${10 + (index % 6) * 14}%;--dur:${((5.2 + Math.random() * 1.7) / speed).toFixed(2)}s;">${wcEscapeHtml(phrase)}</span>
    `).join('');
    host.appendChild(barrage);
    setTimeout(() => barrage.remove(), Math.max(4800, Math.round(7800 / speed)));
}

function showWechatMonitorLockdown(watcher, text) {
    const host = getWechatModalRoot();
    document.getElementById('wc-monitor-lockdown')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'wc-monitor-lockdown';
    overlay.className = 'wc-monitor-lockdown';
    const name = getWechatCharDisplayName(watcher);
    const lines = Array.from({ length: 14 }, (_, index) => {
        const seed = `${watcher.id || 'bynd'}${Date.now()}${index}`;
        const code = Array.from(seed).reduce((sum, ch) => sum + ch.charCodeAt(0), 0).toString(16).toUpperCase();
        return `<span>BYND/MONITOR/${String(index + 1).padStart(2, '0')} :: ${wcEscapeHtml(code)} :: ${wcEscapeHtml(text).slice(0, 34)}</span>`;
    }).join('');
    overlay.innerHTML = `
        <div class="wc-monitor-noise">${lines}</div>
        <div class="wc-monitor-lock-card">
            <img src="${wcEscapeHtml(watcher.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
            <strong>${wcEscapeHtml(name)} 已接管屏幕</strong>
            <p>${wcEscapeHtml(text)}</p>
            <button type="button" onpointerdown="startWechatMonitorUnlockHold(this)" onpointerup="cancelWechatMonitorUnlockHold()" onpointerleave="cancelWechatMonitorUnlockHold()">长按解除</button>
        </div>
    `;
    host.appendChild(overlay);
}

function startWechatMonitorUnlockHold(button) {
    if (button) button.classList.add('holding');
    clearTimeout(window._wechatMonitorUnlockTimer);
    window._wechatMonitorUnlockTimer = setTimeout(() => {
        document.getElementById('wc-monitor-lockdown')?.remove();
        clearTimeout(window._wechatMonitorUnlockTimer);
    }, 1100);
}

function cancelWechatMonitorUnlockHold() {
    document.querySelector('#wc-monitor-lockdown button')?.classList.remove('holding');
    clearTimeout(window._wechatMonitorUnlockTimer);
}

function buildWechatCallEvent(char, msg, direction) {
    return {
        id: Date.now(),
        type: msg.type,
        charId: char.id,
        direction,
        startedAt: msg.timestamp || createMessageTimestamp(),
        acceptedAt: null,
        reason: msg.reason || msg.note || '',
        participants: getWechatCallParticipants(char, msg),
        lines: [],
        ended: false
    };
}

function ensureWechatCallScreen() {
    let screen = document.getElementById('wc-call-screen');
    if (screen) {
        cleanupWechatCallOverlayArtifacts();
        return screen;
    }
    screen = document.createElement('div');
    screen.id = 'wc-call-screen';
    screen.className = 'wc-call-screen hidden';
    screen.innerHTML = `
        <div class="wc-call-bg"><img id="wc-call-bg-img" src="" alt=""></div>
        <div class="wc-call-shade"></div>
        <div class="wc-video-local-tile hidden" id="wc-video-local-tile">
            <img id="wc-video-local-avatar" src="" alt="">
        </div>
        <video id="wc-call-camera-preview" class="wc-call-camera-preview hidden" autoplay muted playsinline></video>
        <div id="wc-call-ai-portrait" class="wc-call-ai-portrait hidden">
            <img id="wc-call-ai-portrait-img" src="" alt="" role="button" tabindex="0">
            <span id="wc-call-ai-portrait-status">正在生成 AI 画面...</span>
        </div>
        <div class="wc-call-top">
            <div class="wc-call-avatars wc-call-top-avatars single" id="wc-call-avatar-stack"></div>
            <div class="wc-call-name" id="wc-call-name"></div>
            <div class="wc-call-status" id="wc-call-status">正在呼叫...</div>
            <div class="wc-call-timer hidden" id="wc-call-timer">00:00</div>
        </div>
        <div class="wc-call-log" id="wc-call-log"></div>
        <div class="wc-call-inputbar hidden" id="wc-call-inputbar">
            <input id="wc-call-input" type="text" placeholder="通话中说点什么...">
            <button type="button" onclick="sendWechatCallMessage()"><i class="ri-send-plane-2-fill"></i></button>
        </div>
        <div class="wc-call-typing hidden" id="wc-call-typing">对方正在输入中......</div>
        <div class="wc-call-actions" id="wc-call-actions">
            <button type="button" class="wc-call-tool"><i class="ri-mic-line"></i><span>静音</span></button>
            <button type="button" class="wc-call-end" onclick="endWechatCall()"><i class="ri-phone-fill"></i></button>
            <button type="button" class="wc-call-tool"><i id="wc-call-kind-icon" class="ri-phone-fill"></i><span id="wc-call-kind-label">语音</span></button>
        </div>
    `;
    const portraitImg = screen.querySelector('#wc-call-ai-portrait-img');
    if (portraitImg) {
        portraitImg.addEventListener('click', openWechatCallPortraitPreview);
        portraitImg.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') openWechatCallPortraitPreview(event);
        });
    }
    bindWechatCallInputHandlers(screen);
    getWechatModalRoot().appendChild(screen);
    cleanupWechatCallOverlayArtifacts();
    return screen;
}

function bindWechatCallInputHandlers(screen) {
    const input = screen?.querySelector('#wc-call-input');
    if (!input || input.dataset.boundCallInput === '1') return;
    input.dataset.boundCallInput = '1';
    input.addEventListener('keydown', event => {
        if (event.isComposing || event.key !== 'Enter') return;
        event.preventDefault();
        event.stopPropagation();
        sendWechatCallMessage();
    });
    input.addEventListener('beforeinput', event => {
        if (event.inputType !== 'insertLineBreak') return;
        event.preventDefault();
        event.stopPropagation();
        sendWechatCallMessage();
    });
}

function cleanupWechatCallOverlayArtifacts() {
    document.querySelectorAll('#wc-video-net-tip, .wc-video-net-tip').forEach(el => el.remove());
    const actions = document.getElementById('wc-call-actions');
    if (!actions) return;
    const endButtons = Array.from(actions.querySelectorAll('.wc-call-end'));
    endButtons.slice(0, -1).forEach(btn => btn.remove());
    const screen = document.getElementById('wc-call-screen');
    if (screen?.classList.contains('is-video-call')) {
        const allowed = new Set(['mute', 'speaker', 'beauty']);
        actions.querySelectorAll('.wc-call-tool').forEach(btn => {
            const control = btn.dataset.wcCallControl || '';
            if (!control || !allowed.has(control)) btn.remove();
        });
    }
}

function ensureWechatIncomingIsland() {
    let island = document.getElementById('wc-call-island');
    if (island) return island;
    island = document.createElement('div');
    island.id = 'wc-call-island';
    island.className = 'wc-call-island hidden';
    island.innerHTML = `
        <div class="wc-call-island-main" onclick="acceptWechatIncomingCall()">
            <div class="wc-call-avatars wc-call-island-avatars single" id="wc-call-island-avatar-stack"></div>
            <div class="wc-call-island-text">
                <strong id="wc-call-island-name"></strong>
                <span id="wc-call-island-label"></span>
            </div>
        </div>
        <div class="wc-call-island-actions">
            <button type="button" class="reject" onclick="event.stopPropagation();rejectWechatIncomingCall()"><i class="ri-close-line"></i></button>
            <button type="button" class="accept" onclick="event.stopPropagation();acceptWechatIncomingCall()"><i class="ri-phone-fill"></i></button>
        </div>
    `;
    getWechatModalRoot().appendChild(island);
    return island;
}

function showWechatIncomingIsland(call) {
    const char = window.myCharacters.find(c => c.id === call.charId);
    if (!char) return;
    const island = ensureWechatIncomingIsland();
    mountWechatCallAvatarStack(document.getElementById('wc-call-island-avatar-stack'), char, call, 'wc-call-island-avatars');
    document.getElementById('wc-call-island-name').textContent = getWechatCharDisplayName(char);
    document.getElementById('wc-call-island-label').textContent = `来${getWechatCallLabel(call.type)}`;
    island.classList.remove('hidden');
}

function hideWechatIncomingIsland() {
    const island = document.getElementById('wc-call-island');
    if (island) island.classList.add('hidden');
}

function handleWechatIncomingCall(char, msg) {
    const call = buildWechatCallEvent(char, msg, 'incoming');
    window._wechatIncomingCall = call;
    if (isWechatChatPageActive(char.id)) {
        openWechatIncomingCallScreen(call);
    } else {
        showWechatIncomingIsland(call);
    }
}

function getWechatActiveCallChar() {
    const call = window._wechatActiveCall;
    if (!call) return null;
    return window.myCharacters.find(c => c.id === call.charId) || null;
}

function setWechatCallMode(mode) {
    const screen = ensureWechatCallScreen();
    screen.dataset.mode = mode;
    document.getElementById('wc-call-inputbar')?.classList.toggle('hidden', mode !== 'connected');
    document.getElementById('wc-call-timer')?.classList.toggle('hidden', mode !== 'connected');
    setWechatCallTyping(false);
    const actions = document.getElementById('wc-call-actions');
    if (actions) {
        actions.innerHTML = mode === 'incoming'
            ? `
                <button type="button" class="wc-call-decline" onclick="rejectWechatIncomingCall()"><i class="ri-phone-fill"></i><span>拒绝</span></button>
                <button type="button" class="wc-call-answer" onclick="acceptWechatIncomingCall()"><i class="ri-phone-fill"></i><span>接听</span></button>
            `
            : (window._wechatActiveCall?.type === 'videoCall'
                ? `
                    <button type="button" class="wc-call-tool" data-wc-call-control="mute" onclick="toggleWechatCallControl('mute')"><i class="ri-mic-line"></i><span>静音</span></button>
                    <button type="button" class="wc-call-tool" data-wc-call-control="speaker" onclick="toggleWechatCallControl('speaker')"><i class="ri-volume-up-line"></i><span>扬声器</span></button>
                    <button type="button" class="wc-call-tool" data-wc-call-control="beauty" onclick="toggleWechatCallControl('beauty')"><i class="ri-sparkling-2-line"></i><span>美颜</span></button>
                    <button type="button" class="wc-call-end" onclick="endWechatCall()" aria-label="挂断"><i class="ri-phone-fill"></i></button>
                `
                : `
                    <button type="button" class="wc-call-tool" data-wc-call-control="mute" onclick="toggleWechatCallControl('mute')"><i class="ri-mic-line"></i><span>静音</span></button>
                    <button type="button" class="wc-call-end" onclick="endWechatCall()" aria-label="挂断"><i class="ri-phone-fill"></i></button>
                    <button type="button" class="wc-call-tool" data-wc-call-control="speaker" onclick="toggleWechatCallControl('speaker')"><i class="ri-volume-up-line"></i><span>扬声器</span></button>
                `);
        refreshWechatCallControls();
        cleanupWechatCallOverlayArtifacts();
    }
}

function setWechatCallTyping(show) {
    const typing = document.getElementById('wc-call-typing');
    if (typing) typing.classList.toggle('hidden', !show);
}

function refreshWechatCallControls() {
    const call = window._wechatActiveCall;
    const screen = document.getElementById('wc-call-screen');
    if (screen) screen.classList.toggle('beauty-on', !!call?.beautyOn);
    const states = {
        mute: { active: !!call?.muted, label: call?.muted ? '已静音' : '静音', icon: call?.muted ? 'ri-mic-off-line' : 'ri-mic-line' },
        speaker: { active: !!call?.speakerOn, label: '扬声器', icon: call?.speakerOn ? 'ri-volume-up-fill' : 'ri-volume-up-line' },
        beauty: { active: !!call?.beautyOn, label: call?.beautyOn ? '已美颜' : '美颜', icon: 'ri-sparkling-2-line' }
    };
    Object.entries(states).forEach(([key, state]) => {
        const btn = document.querySelector(`[data-wc-call-control="${key}"]`);
        if (!btn) return;
        btn.classList.toggle('active', state.active);
        const icon = btn.querySelector('i');
        const label = btn.querySelector('span');
        if (icon) icon.className = state.icon;
        if (label) label.textContent = state.label;
    });
}

function toggleWechatCallControl(kind) {
    const call = window._wechatActiveCall;
    if (!call || call.ended) return;
    if (kind === 'mute') call.muted = !call.muted;
    if (kind === 'speaker') call.speakerOn = !call.speakerOn;
    if (kind === 'beauty' && call.type === 'videoCall') call.beautyOn = !call.beautyOn;
    refreshWechatCallControls();
}

function setWechatCallStatus(text) {
    const statusEl = document.getElementById('wc-call-status');
    if (statusEl) statusEl.textContent = text;
}

function formatWechatCallClock(seconds) {
    const sec = Math.max(0, Math.floor(seconds || 0));
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return `${String(min).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function updateWechatCallTimer() {
    const call = window._wechatActiveCall;
    const timer = document.getElementById('wc-call-timer');
    if (!call || !call.acceptedAt || !timer) return;
    timer.textContent = formatWechatCallClock((Date.now() - call.acceptedAt) / 1000);
}

function addWechatCallLine(role, text) {
    const call = window._wechatActiveCall;
    const log = document.getElementById('wc-call-log');
    const content = String(text || '').trim();
    if (!call || !log || !content) return;
    if (!call.lines) call.lines = [];
    call.lines.push({ role, content });
    const item = document.createElement('div');
    item.className = `wc-call-line ${role}`;
    item.innerHTML = wcEscapeHtml(content).replace(/\n/g, '<br>');
    log.appendChild(item);
    scrollWechatCallLogToBottom(item);
}

function scrollWechatCallLogToBottom(item = null) {
    const log = document.getElementById('wc-call-log');
    if (!log) return;
    requestAnimationFrame(() => {
        if (item && typeof item.scrollIntoView === 'function') {
            item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        log.scrollTop = log.scrollHeight;
        requestAnimationFrame(() => {
            log.scrollTop = log.scrollHeight;
        });
    });
}

function cleanWechatCallVisibleReply(text) {
    let source = cleanWechatVisibleContent(text)
        .replace(/\|\|\|/g, '\n')
        .replace(/[\[【]\s*(?:微信表情|表情|发送了表情)\s*[：:]\s*[^\]】\r\n]{0,160}[\]】]?/gi, '\n')
        .replace(/[\[【]\s*(?:微信图片|微信照片|微信语音|微信音乐|音乐卡片|微信链接|链接卡片|微信引用|微信红包|微信转账|微信礼物|微信送礼物|微信亲密付|微信拍一拍|拍一拍|微信震动|震动屏幕)\s*[：:][^\]】\r\n]{0,220}[\]】]?/gi, '\n')
        .replace(/[\[【]\s*(?:微信监控|开启监控|关闭监控|微信改备注|微信改用户备注|微信改群头衔|微信改群昵称|微信改群名|微信拉黑|微信删除联系人|微信朋友圈|群邀请|群拉人|微信群邀请|QQ群邀请|群NPC|群npc|群聊发言|微信群聊|微信旁白|旁白)\s*[：:][^\]】\r\n]{0,260}[\]】]?/gi, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (/^\]\s*$/.test(source)) return '';
    return source;
}

function parseWechatCallDecision(content) {
    const raw = String(content || '').replace(/\|\|\|/g, ' ').trim();
    const cleaned = raw
        .replace(/\[接听\]/g, '')
        .replace(/\[拒绝[：:]?([^\]]*)\]/g, '$1')
        .trim();
    const refused = /拒绝|不接|不方便|在忙|忙着|挂断|稍后|未接|没法|不能接/.test(raw) && !/接听|接了|可以接|我接|接吧/.test(raw);
    return {
        accepted: !refused,
        message: cleaned
    };
}

function cleanWechatCallEndText(text) {
    return cleanWechatCallVisibleReply(text)
        .replace(/\[换(?:头像|背景)[：:]\d+\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseWechatCallEndReply(content, call) {
    const raw = cleanWechatCallVisibleReply(content);
    let ended = false;
    let text = raw;
    const callWord = call?.type === 'videoCall' ? '视频通话' : '语音通话';
    const endSummaryRe = /(?:语音|视频)?通话\s*(?:已|已经|被)?\s*(?:结束|挂断|中断)|(?:结束|挂断)(?:语音|视频)?通话/;

    text = text.replace(/[\[【]\s*(?:微信)?旁白\s*[：:]\s*([^\]】]+)[\]】]/g, (_, summary) => {
        if (endSummaryRe.test(cleanWechatCallEndText(summary))) ended = true;
        return '\n';
    });
    text = text.replace(/[\[【]\s*(?:挂断|挂电话|结束通话)\s*[：:]\s*([^\]】]*)[\]】]/g, (_, speech) => {
        ended = true;
        return speech ? `\n${speech}\n` : '\n';
    });
    text = text.replace(/[\[【]\s*((?:语音|视频)?通话\s*(?:已|已经|被)?\s*(?:结束|挂断|中断))\s*[\]】]/g, () => {
        ended = true;
        return '\n';
    });

    const lines = text.split(/\r?\n/)
        .map(line => cleanWechatCallEndText(line))
        .filter(Boolean)
        .filter(line => {
            const normalized = line.replace(/[。.!！~～\s]/g, '');
            if (!normalized) return false;
            if (endSummaryRe.test(line) || normalized === `${callWord}已结束`) {
                ended = true;
                return false;
            }
            return true;
        });
    const message = lines.join('\n').trim();
    const compact = message.replace(/\s+/g, '');
    if (/(?:^|[，。！？,.!?])(?:我|那我|我这边|先|现在)?(?:先)?挂(?:了|啦|断|电话)|(?:不说了|不聊了|先这样).{0,8}挂|(?:拜拜|再见).{0,8}挂/.test(compact)) {
        ended = true;
    }
    return { ended, message };
}

async function startWechatCall(type) {
    if (window._wechatAiBusy || window._wechatActiveCall) return;
    const char = getCurrentChatChar();
    if (!char) return;
    closeChatToolbar();
    closeStickerPicker();

    const label = getWechatCallLabel(type);
    const screen = ensureWechatCallScreen();
    window._wechatActiveCall = {
        id: Date.now(),
        type,
        charId: char.id,
        direction: 'outgoing',
        startedAt: Date.now(),
        acceptedAt: null,
        reason: '',
        participants: getWechatCallParticipants(char),
        lines: [],
        ended: false
    };

    setupWechatCallScreen(window._wechatActiveCall, char);
    setWechatCallStatus(`正在邀请对方加入${label}...`);
    screen.classList.remove('hidden');

    await requestWechatCallDecision(window._wechatActiveCall);
}

function setupWechatCallScreen(call, char) {
    ensureWechatCallScreen();
    const config = char.chatConfig || {};
    const bg = call.type === 'videoCall' ? (config.videoCallBg || config.imageReference || char.avatar || DEFAULT_AVATAR) : (char.avatar || DEFAULT_AVATAR);
    document.getElementById('wc-call-bg-img').src = bg;
    mountWechatCallAvatarStack(document.getElementById('wc-call-avatar-stack'), char, call, 'wc-call-top-avatars');
    document.getElementById('wc-call-name').textContent = getWechatCharDisplayName(char);
    document.getElementById('wc-call-log').innerHTML = '';
    document.getElementById('wc-call-input').value = '';
    const screen = ensureWechatCallScreen();
    screen.classList.toggle('is-video-call', call.type === 'videoCall');
    const camera = document.getElementById('wc-call-camera-preview');
    const portrait = document.getElementById('wc-call-ai-portrait');
    const localTile = document.getElementById('wc-video-local-tile');
    const localAvatar = document.getElementById('wc-video-local-avatar');
    if (camera) camera.classList.add('hidden');
    if (portrait) portrait.classList.toggle('hidden', call.type !== 'videoCall');
    if (localTile) localTile.classList.toggle('hidden', call.type !== 'videoCall');
    cleanupWechatCallOverlayArtifacts();
    if (localAvatar) {
        const userProfile = typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : (typeof getUserProfile === 'function' ? getUserProfile() : {});
        localAvatar.src = userProfile.avatar || DEFAULT_AVATAR;
    }
    const portraitImg = document.getElementById('wc-call-ai-portrait-img');
    const portraitStatus = document.getElementById('wc-call-ai-portrait-status');
    if (portraitImg) portraitImg.src = config.imageReference || char.avatar || DEFAULT_AVATAR;
    if (portraitStatus) portraitStatus.textContent = call.type === 'videoCall' ? '等待接通后生成 AI 画面' : '';
    setWechatCallMode(call.direction === 'incoming' ? 'incoming' : 'ringing');
}

async function requestWechatCallDecision(call) {
    const char = getWechatActiveCallChar();
    if (!call || !char) return;
    window._wechatAiBusy = true;
    setWechatBusyState(true);

    const label = getWechatCallLabel(call.type);
    try {
        const messages = buildMessages(char, char.history || []);
        messages.push({
            role: 'system',
            content: `当前用户正在给你发起${label}。你必须以角色身份决定是否接听。只回复一种格式：[接听]一句接通后的开场白，或 [拒绝:一句拒绝理由]。不要解释格式。`
        });
        messages.push({ role: 'user', content: `我正在给你打${label}，你接吗？` });
        const result = await callChatApi(messages, { usageFeature: 'chat', usageChar: char });
        if (window._wechatActiveCall?.id !== call.id || call.ended) return;

        if (!result.ok) {
            setWechatCallStatus('暂时无法接通');
            addWechatCallRecord(call, '未接通', result.error);
            setTimeout(() => closeWechatCallScreen(call.id), 800);
            return;
        }

        const decision = parseWechatCallDecision(result.content);
        if (decision.accepted) {
            acceptWechatCall(call, decision.message);
        } else {
            setWechatCallStatus('对方已拒绝');
            if (decision.message) addWechatCallLine('assistant', decision.message);
            call.reason = decision.message;
            addWechatCallRecord(call, '已拒绝', decision.message);
            setTimeout(() => closeWechatCallScreen(call.id), 1100);
        }
    } finally {
        if (window._wechatActiveCall?.id === call.id) {
            window._wechatAiBusy = false;
            setWechatBusyState(false);
        }
    }
}

function acceptWechatCall(call, firstMessage) {
    if (!call || call.ended) return;
    call.acceptedAt = Date.now();
    setWechatCallMode('connected');
    setWechatCallStatus('通话中');
    updateWechatCallTimer();
    clearInterval(call.timerId);
    call.timerId = setInterval(updateWechatCallTimer, 1000);
    if (firstMessage) addWechatCallLine('assistant', firstMessage);
    const input = document.getElementById('wc-call-input');
    if (input) input.focus();
    if (call.type === 'videoCall') activateWechatVideoCallFeatures(call);
}

async function activateWechatVideoCallFeatures(call) {
    const char = getWechatActiveCallChar();
    if (!call || !char || call.ended) return;
    const config = char.chatConfig || {};
    const portraitStatus = document.getElementById('wc-call-ai-portrait-status');
    const portraitImg = document.getElementById('wc-call-ai-portrait-img');
    if (config.videoCallUseCamera) {
        startWechatCallCameraStream().catch(err => {
            addWechatCallLine('system', '真实相机没有打开：' + (err && err.message ? err.message : '浏览器未授权'));
        });
    }
    if (portraitStatus) portraitStatus.textContent = '正在生成 AI 视频画面...';
    const reference = config.imageReference || char.avatar || '';
    const prompt = [
        `生成${getWechatCharDisplayName(char)}的干净前置摄像头人像画面。`,
        '这是一张纯摄像头画面，不是手机截图，不是视频通话软件界面。',
        '竖屏近景人像，真实光线，表情自然，像正在看着镜头和用户说话。',
        '画面里只能有角色本人和自然环境背景；禁止出现任何 UI、按钮、图标、麦克风、挂断键、摄像头键、扬声器键、聊天气泡、文字、状态栏、顶部提示、头像小窗、边框、水印、箭头或屏幕控件。',
        'Do not draw video call controls, phone UI, app interface, text overlays, icons, chat bubbles, picture-in-picture windows, buttons, borders, or watermarks.',
        char.description ? `角色设定：${char.description.slice(0, 700)}` : '',
        config.signature ? `个性签名/气质：${config.signature}` : ''
    ].filter(Boolean).join('\n');
    const result = await callWechatImageGenerationApi(prompt, { referenceImage: reference, size: '1024x1024' });
    if (window._wechatActiveCall?.id !== call.id || call.ended) return;
    if (result.ok && result.url) {
        if (portraitImg) portraitImg.src = result.url;
        const bgImg = document.getElementById('wc-call-bg-img');
        if (bgImg && !config.videoCallBg) bgImg.src = result.url;
        if (portraitStatus) portraitStatus.textContent = '';
    } else if (portraitStatus) {
        portraitStatus.textContent = result.error ? `生图失败：${String(result.error).slice(0, 42)}` : 'AI 画面生成失败';
    }
}

async function startWechatCallCameraStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('当前浏览器不支持真实相机');
    }
    const video = document.getElementById('wc-call-camera-preview');
    if (!video) return;
    stopWechatCallCameraStream();
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
    });
    window._wechatCallCameraStream = stream;
    video.srcObject = stream;
    document.getElementById('wc-video-local-tile')?.classList.add('hidden');
    video.classList.remove('hidden');
}

function stopWechatCallCameraStream() {
    const stream = window._wechatCallCameraStream;
    if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach(track => track.stop());
    }
    window._wechatCallCameraStream = null;
    const video = document.getElementById('wc-call-camera-preview');
    if (video) {
        video.srcObject = null;
        video.classList.add('hidden');
    }
    const screen = document.getElementById('wc-call-screen');
    if (screen?.classList.contains('is-video-call')) document.getElementById('wc-video-local-tile')?.classList.remove('hidden');
}

function openWechatIncomingCallScreen(call) {
    const char = window.myCharacters.find(c => c.id === call.charId);
    if (!char) return;
    hideWechatIncomingIsland();
    if (typeof openApp === 'function') openApp('wechat');
    if (window.currentChatCharId !== char.id) openChat(char.id);
    window._wechatIncomingCall = call;
    window._wechatActiveCall = call;
    setupWechatCallScreen(call, char);
    setWechatCallStatus(`${getWechatCharDisplayName(char)} 邀请你加入${getWechatCallLabel(call.type)}`);
    ensureWechatCallScreen().classList.remove('hidden');
}

function acceptWechatIncomingCall() {
    const call = window._wechatIncomingCall
        || (window._wechatActiveCall?.direction === 'incoming' && !window._wechatActiveCall.acceptedAt ? window._wechatActiveCall : null);
    if (!call || call.ended) return;
    const char = window.myCharacters.find(c => c.id === call.charId);
    if (char) {
        if (typeof openApp === 'function') openApp('wechat');
        if (window.currentChatCharId !== char.id) openChat(char.id);
    }
    hideWechatIncomingIsland();
    window._wechatIncomingCall = null;
    window._wechatActiveCall = call;
    const screen = ensureWechatCallScreen();
    if (screen.classList.contains('hidden')) {
        if (char) setupWechatCallScreen(call, char);
        screen.classList.remove('hidden');
    }
    acceptWechatCall(call, call.reason);
}

function rejectWechatIncomingCall() {
    const call = window._wechatIncomingCall
        || (window._wechatActiveCall?.direction === 'incoming' && !window._wechatActiveCall.acceptedAt ? window._wechatActiveCall : null);
    if (!call) return;
    const char = window.myCharacters.find(c => c.id === call.charId);
    hideWechatIncomingIsland();
    addWechatCallRecord(call, '已拒绝', '你已拒绝');
    if (char) appendWechatIncomingCallRejectedEvent(char, call);
    call.ended = true;
    const screen = document.getElementById('wc-call-screen');
    if (screen) screen.classList.add('hidden');
    window._wechatIncomingCall = null;
    if (window._wechatActiveCall?.id === call.id) window._wechatActiveCall = null;
    if (char) queueWechatAutoReplyToChar(char.id, 0, {
        background: window.currentChatCharId !== char.id,
        textOnly: true
    });
}

function appendWechatIncomingCallRejectedEvent(char, call) {
    if (!char || !call) return;
    if (!Array.isArray(char.history)) char.history = [];
    const label = getWechatCallLabel(call.type);
    char.history.push({
        type: 'user_event',
        isMe: true,
        hiddenFromChat: true,
        internalEvent: true,
        eventKind: 'incoming_call_rejected',
        callType: call.type,
        callTimestamp: call.startedAt || '',
        content: `用户拒绝了你刚刚主动打来的${label}${call.reason ? `。你来电时的理由/开场是：${call.reason}` : ''}。请按你的人设、当前关系和最近聊天自然回应，可以失落、嘴硬、尴尬、关心用户是不是不方便，或改用文字继续说；不要重复系统说明，也不要假装通话已经接通。`,
        timestamp: createMessageTimestamp()
    });
    saveCharactersToStorage();
}

async function sendWechatCallMessage() {
    const call = window._wechatActiveCall;
    const char = getWechatActiveCallChar();
    const input = document.getElementById('wc-call-input');
    if (!call || !char || !input || call.ended || call.busy || !call.acceptedAt) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addWechatCallLine('user', text);
    scrollWechatCallLogToBottom();

    call.busy = true;
    input.disabled = true;
    setWechatCallStatus('通话中');
    setWechatCallTyping(true);
    try {
        const messages = buildMessages(char, char.history || []);
        messages.push({
            role: 'system',
            content: `现在你和用户正在${getWechatCallLabel(call.type)}中。直接回复通话里会说的话，保持自然口语。如果你想结束通话，可以自然说“我先挂了/我挂了”之类的话；不要输出微信特殊消息指令，不要写旁白。`
        });
        (call.lines || []).forEach(line => {
            if (line.role === 'user' || line.role === 'assistant') {
                messages.push({ role: line.role, content: line.content });
            }
        });
        const result = await callChatApi(messages, { usageFeature: 'chat', usageChar: char });
        if (window._wechatActiveCall?.id !== call.id || call.ended) return;
        if (result.ok) {
            const reply = parseWechatCallEndReply(result.content, call);
            reply.message.split(/\|{2,}/).map(s => s.trim()).filter(s => s && !/^[|‖｜\s]+$/.test(s)).forEach(part => {
                addWechatCallLine('assistant', part);
            });
            if (reply.ended && window._wechatActiveCall?.id === call.id && !call.ended) {
                setWechatCallStatus('对方已挂断');
                endWechatCall('对方已挂断', reply.message);
                return;
            }
        } else {
            addWechatCallLine('system', `通话信号不稳定：${result.error}`);
        }
    } finally {
        if (window._wechatActiveCall?.id === call.id && !call.ended) {
            call.busy = false;
            input.disabled = false;
            setWechatCallTyping(false);
            setWechatCallStatus('通话中');
            input.focus();
        }
    }
}

function addWechatCallRecord(call, status, reason = '') {
    const char = window.myCharacters.find(c => c.id === call.charId);
    if (!char) return;
    if (!char.history) char.history = [];
    const duration = call.acceptedAt ? Math.max(1, Math.round((Date.now() - call.acceptedAt) / 1000)) : 0;
    const msg = syncWechatMessageDescription({
        type: call.type,
        isMe: call.direction !== 'incoming',
        status,
        reason: reason || call.reason || '',
        duration,
        callDirection: call.direction,
        rejectedBy: status === '已拒绝'
            ? (call.direction === 'incoming' ? 'user' : 'char')
            : '',
        participants: getWechatCallParticipants(char, call),
        timestamp: call.startedAt || createMessageTimestamp()
    });
    char.history.push(msg);
    saveCharactersToStorage();
    if (window.currentChatCharId === char.id) refreshChatView(char);
    renderChatList();
}

function appendWechatUserEndedCallEvent(char, call, reason = '') {
    if (!char || !call) return;
    if (!Array.isArray(char.history)) char.history = [];
    const label = getWechatCallLabel(call.type);
    const duration = call.acceptedAt ? Math.max(1, Math.round((Date.now() - call.acceptedAt) / 1000)) : 0;
    char.history.push({
        type: 'user_event',
        isMe: true,
        hiddenFromChat: true,
        internalEvent: true,
        eventKind: 'user_ended_call',
        callType: call.type,
        callTimestamp: call.startedAt || '',
        content: `用户刚刚主动挂断了和你的${label}${duration ? `，通话持续约${formatWechatDuration(duration)}` : ''}${reason ? `。挂断前最后的通话内容：${reason}` : ''}。请按你的人设和当前关系，用普通文字消息自然回应这件事；你知道是用户挂断，不要误以为是你拒绝或你主动挂断，也不要发送语音消息。`,
        timestamp: createMessageTimestamp()
    });
    saveCharactersToStorage();
}

function endWechatCall(status = '已结束', reason = '') {
    const call = window._wechatActiveCall;
    if (!call || call.ended) return;
    const char = window.myCharacters.find(c => c.id === call.charId);
    const userEndedConnectedCall = status === '已结束' && call.acceptedAt;
    call.ended = true;
    clearInterval(call.timerId);
    const recordReason = userEndedConnectedCall && !reason ? '用户挂断了电话' : reason;
    addWechatCallRecord(call, call.acceptedAt ? status : '已取消', recordReason);
    if (userEndedConnectedCall && char) {
        appendWechatUserEndedCallEvent(char, call, reason);
        queueWechatAutoReplyToChar(char.id, 0, {
            background: window.currentChatCharId !== char.id,
            textOnly: true
        });
    }
    closeWechatCallScreen(call.id);
}

function closeWechatCallScreen(callId) {
    const call = window._wechatActiveCall;
    if (call && callId && call.id !== callId) return;
    if (call) {
        call.ended = true;
        clearInterval(call.timerId);
    }
    const screen = document.getElementById('wc-call-screen');
    if (screen) screen.classList.add('hidden');
    setWechatCallTyping(false);
    stopWechatCallCameraStream();
    window._wechatActiveCall = null;
    window._wechatAiBusy = false;
    setWechatBusyState(false);
}

function openWechatCallPortraitPreview(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    const img = document.getElementById('wc-call-ai-portrait-img');
    const src = String(img?.getAttribute('src') || img?.src || '').trim();
    if (!src) return;
    const call = window._wechatActiveCall;
    const char = getWechatActiveCallChar();
    const label = call ? getWechatCallLabel(call.type) : '视频通话';
    const name = char ? getWechatCharDisplayName(char) : '';
    openWechatImagePreview(src, name ? `${name}的${label}画面` : label);
}

window.openWechatCallPortraitPreview = openWechatCallPortraitPreview;

