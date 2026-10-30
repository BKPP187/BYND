// --- 同一角色的多个独立聊天窗口 ---
// 每个窗口是一条独立的聊天联系人（独立 id、聊天记录、记忆、状态），窗口之间互不通信、不共享上下文。
// 人设、世界书、头像跟随主角色同步；联系人列表、朋友圈、论坛里仍然只有主角色这一个人。
// 监控不受隔离限制：所有窗口都留在角色列表里，监控照常能看到每个窗口。
const WECHAT_WINDOW_PERSONA_FIELDS = ['name', 'description', 'personality', 'scenario', 'avatar', '_smallAvatar', 'avatarGallery', 'worldBook', 'regex', 'alternates', 'first_mes_original'];
// Conversation-derived state that must never leak into a fresh window.
const WECHAT_WINDOW_PRIVATE_CONFIG = /^(ai|monitor|pending|memory|summary|summaries|generated|last|unread|blacklist|douyin|spark|story|moment|proactive|call|reply|draft|lifeState|relationship|affection|npcFriend|generator|contactId|windowOf|windowLabel|windowIndex)/i;

function isWechatChatWindow(char) {
    return !!(char && !char.isGroupChat && char.chatConfig && char.chatConfig.windowOf);
}
window.isWechatChatWindow = isWechatChatWindow;

function getWechatChatWindowRootId(char) {
    return char ? String(char.chatConfig?.windowOf || char.id || '') : '';
}

function getWechatChatWindowBase(char) {
    if (!isWechatChatWindow(char)) return null;
    return (window.myCharacters || []).find(item => item && item.id === char.chatConfig.windowOf && !item.isGroupChat) || null;
}

// The main contact first, then its windows in creation order.
function getWechatChatWindowFamily(charOrId) {
    const list = window.myCharacters || [];
    const char = typeof charOrId === 'string' ? list.find(item => item && item.id === charOrId) : charOrId;
    if (!char || char.isGroupChat) return [];
    const rootId = getWechatChatWindowRootId(char);
    const root = list.find(item => item && item.id === rootId && !item.isGroupChat);
    const windows = list.filter(item => isWechatChatWindow(item) && item.chatConfig.windowOf === rootId)
        .sort((a, b) => (Number(a.chatConfig.windowIndex) || 0) - (Number(b.chatConfig.windowIndex) || 0));
    return root ? [root, ...windows] : windows;
}
window.getWechatChatWindowFamily = getWechatChatWindowFamily;

function getWechatChatWindowLabel(char) {
    if (!char || char.isGroupChat) return '';
    return isWechatChatWindow(char) ? String(char.chatConfig.windowLabel || '窗口') : '主窗口';
}
window.getWechatChatWindowLabel = getWechatChatWindowLabel;

function cloneWechatWindowChatConfig(config) {
    const copy = JSON.parse(JSON.stringify(config && typeof config === 'object' ? config : {}));
    Object.keys(copy).forEach(key => { if (WECHAT_WINDOW_PRIVATE_CONFIG.test(key)) delete copy[key]; });
    return copy;
}

function syncWechatChatWindowPersona(char) {
    const base = getWechatChatWindowBase(char);
    if (!base) return false;
    let changed = false;
    for (const field of WECHAT_WINDOW_PERSONA_FIELDS) {
        if (!(field in base)) continue;
        const next = base[field];
        if (JSON.stringify(char[field]) === JSON.stringify(next)) continue;
        char[field] = next && typeof next === 'object' ? JSON.parse(JSON.stringify(next)) : next;
        changed = true;
    }
    return changed;
}
window.syncWechatChatWindowPersona = syncWechatChatWindowPersona;

function buildWechatChatWindow(base, now = Date.now()) {
    if (!base || base.isGroupChat) throw new Error('群聊不能新建窗口');
    const root = isWechatChatWindow(base) ? (getWechatChatWindowBase(base) || base) : base;
    const family = getWechatChatWindowFamily(root);
    const index = Math.max(1, ...family.map(item => Number(item.chatConfig?.windowIndex) || 1)) + 1;
    const chatConfig = cloneWechatWindowChatConfig(root.chatConfig);
    Object.assign(chatConfig, { windowOf: root.id, windowIndex: index, windowLabel: `窗口 ${index}`, windowCreatedAt: now, memoryResetAt: now });
    const char = { id: `char_win_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`, chatConfig, history: [], lastMsg: '', currentGreetingIndex: 0 };
    for (const field of WECHAT_WINDOW_PERSONA_FIELDS) {
        if (field in root) char[field] = root[field] && typeof root[field] === 'object' ? JSON.parse(JSON.stringify(root[field])) : root[field];
    }
    char.first_mes = root.first_mes_original || root.first_mes || '';
    if (typeof seedWechatCharacterGreeting === 'function') seedWechatCharacterGreeting(char);
    char.lastMsg = char.history.length ? String(char.history[char.history.length - 1].content || '').slice(0, 60) : '';
    return char;
}

let wechatChatWindowCreating = null;
async function createWechatChatWindow(baseId = window.currentChatCharId) {
    if (wechatChatWindowCreating) return wechatChatWindowCreating;
    const base = (window.myCharacters || []).find(item => item && item.id === baseId);
    wechatChatWindowCreating = (async () => {
        let char;
        try { char = buildWechatChatWindow(base); }
        catch (error) { showWechatToast?.(error.message || '无法新建窗口'); return null; }
        const list = window.myCharacters;
        const at = list.indexOf(base);
        list.splice(at >= 0 ? at + 1 : list.length, 0, char);
        let saved = false;
        try { saved = (await saveCharactersToStorage()) !== false; } catch (_) { saved = false; }
        if (!saved) {
            const index = list.indexOf(char);
            if (index >= 0) list.splice(index, 1);
            showWechatToast?.('新窗口没有保存成功，请重试');
            return null;
        }
        showWechatToast?.(`已新建${char.chatConfig.windowLabel}`);
        return char;
    })().finally(() => { wechatChatWindowCreating = null; });
    return wechatChatWindowCreating;
}
window.createWechatChatWindow = createWechatChatWindow;

// Repair only an untouched, legacy window opening. Edited messages and windows
// with an ongoing conversation keep their existing history and references.
async function repairWechatChatWindowGreeting(char) {
    if (!isWechatChatWindow(char) || !char.history?.length) return false;
    const originals = char.history.slice();
    if (originals.some(msg => !msg || msg.isMe || !['text', 'offline_narration'].includes(msg.type) || msg.isSystem || msg.hiddenFromChat)) return false;
    const content = getWechatCharacterGreetingContent(char);
    const parts = splitWechatCharacterGreeting(content, char);
    if (!parts.length) return false;
    const unsplit = originals.length === 1 && String(originals[0].content || '').trim() === content;
    const split = originals.length === parts.length && originals.every((msg, index) => msg.content === parts[index].content);
    if (!unsplit && !split) return false;
    if (split && originals.every((msg, index) => msg.type === parts[index].type)) return false;
    // Rendering normalizes narration by cloning messages. An enumerable symbol
    // survives that clone but is omitted from JSON, so rollback still finds the
    // inserted bubbles without persisting a repair marker.
    const repairMarker = Symbol('wechatGreetingRepair');
    const messages = parts.map((part, index) => ({ ...(split ? originals[index] : originals[0]), ...part, [repairMarker]: true }));
    char.history.splice(0, originals.length, ...messages);
    try {
        if (await saveCharactersToStorage() === false) throw new Error('Greeting save failed');
        return true;
    } catch (error) {
        const at = char.history.findIndex(msg => msg?.[repairMarker]);
        if (at >= 0) {
            char.history = char.history.filter(msg => !msg?.[repairMarker]);
            char.history.splice(at, 0, ...originals);
            if (window.currentChatCharId === char.id && typeof refreshChatView === 'function') refreshChatView(char);
        }
        showWechatToast?.('开场白分段没有保存成功，请重新打开窗口重试');
        return false;
    } finally {
        messages.forEach(msg => { delete msg[repairMarker]; });
        char.history.forEach(msg => { if (msg) delete msg[repairMarker]; });
    }
}

async function createAndOpenWechatChatWindow() {
    const char = await createWechatChatWindow(window.currentChatCharId);
    if (!char) return false;
    if (typeof closeChatSettings === 'function') closeChatSettings();
    if (typeof renderChatList === 'function') renderChatList();
    openChat(char.id);
    return true;
}
window.createAndOpenWechatChatWindow = createAndOpenWechatChatWindow;

function openWechatChatWindowFromSettings(charId) {
    if (typeof closeChatSettings === 'function') closeChatSettings();
    openChat(charId);
}
window.openWechatChatWindowFromSettings = openWechatChatWindowFromSettings;

function renderWechatChatWindowsSection(char = (window.myCharacters || []).find(item => item.id === window.currentChatCharId)) {
    const host = document.getElementById('wcs-chat-windows');
    if (!host) return;
    const wrap = document.getElementById('wcs-chat-windows-wrap');
    if (wrap) wrap.hidden = !char || char.isGroupChat;
    if (!char || char.isGroupChat) { host.innerHTML = ''; return; }
    const family = getWechatChatWindowFamily(char);
    const esc = value => (typeof wcEscapeHtml === 'function' ? wcEscapeHtml(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`));
    host.innerHTML = family.map(item => {
        const current = item.id === char.id;
        const count = Array.isArray(item.history) ? item.history.filter(msg => msg && !msg.isSystem && msg.type !== 'system_notice').length : 0;
        return `<button type="button" class="wcs-nav-row wcs-window-row${current ? ' is-current' : ''}" ${current ? 'aria-current="true" disabled' : `onclick="openWechatChatWindowFromSettings(${esc(JSON.stringify(item.id))})"`}>
            <span><i class="ri-chat-3-line"></i> ${esc(getWechatChatWindowLabel(item))}</span>
            <em>${current ? '当前窗口 · ' : ''}${count} 条消息</em>
            <i class="${current ? 'ri-check-line' : 'ri-arrow-right-s-line'}"></i>
        </button>`;
    }).join('') + `<button type="button" class="wcs-nav-row wcs-window-new" onclick="createAndOpenWechatChatWindow()"><span><i class="ri-add-line"></i> 新建独立窗口</span><em>新窗口从开场白开始，不带入其他窗口的聊天</em><i class="ri-arrow-right-s-line"></i></button>`;
}
window.renderWechatChatWindowsSection = renderWechatChatWindowsSection;

function decorateWechatChatWindowList() {
    document.querySelectorAll('#wc-chat-list .wc-swipe-container[data-char-id]').forEach(container => {
        const char = (window.myCharacters || []).find(item => item && item.id === container.dataset.charId);
        const name = container.querySelector('.wc-name');
        if (!name || name.querySelector('.wc-window-badge')) return;
        const family = char && !char.isGroupChat ? getWechatChatWindowFamily(char) : [];
        if (family.length < 2) return;
        const badge = document.createElement('em');
        badge.className = 'wc-window-badge';
        badge.textContent = getWechatChatWindowLabel(char);
        name.appendChild(badge);
    });
}

// Themes show either the classic title or the floating name, so both carry the window label.
function decorateWechatChatWindowTitle(char) {
    if (!char || char.isGroupChat) return;
    const show = getWechatChatWindowFamily(char).length > 1;
    for (const id of ['chat-room-title', 'wc-float-name']) {
        const title = document.getElementById(id);
        if (!title) continue;
        title.querySelector('.wc-window-badge')?.remove();
        if (!show) continue;
        const badge = document.createElement('em');
        badge.className = 'wc-window-badge';
        badge.textContent = getWechatChatWindowLabel(char);
        title.appendChild(badge);
    }
}

// Hooks wrap the shared WeChat entry points without editing them. Assigning to the
// global name keeps inline handlers and in-script calls on the wrapped version.
(function installWechatChatWindowHooks() {
    if (window.__wechatChatWindowHooks) return;
    window.__wechatChatWindowHooks = true;
    const baseOpenChat = window.openChat;
    if (typeof baseOpenChat === 'function') {
        window.openChat = function openChatWithWindows(charId, ...rest) {
            const char = (window.myCharacters || []).find(item => item && item.id === charId);
            if (char && syncWechatChatWindowPersona(char)) {
                try { Promise.resolve(saveCharactersToStorage()).catch(() => {}); } catch (_) {}
            }
            if (char) void repairWechatChatWindowGreeting(char);
            const result = baseOpenChat.call(this, charId, ...rest);
            decorateWechatChatWindowTitle(char);
            return result;
        };
    }
    const baseRenderChatList = window.renderChatList;
    if (typeof baseRenderChatList === 'function') {
        window.renderChatList = function renderChatListWithWindows(...args) {
            const result = baseRenderChatList.apply(this, args);
            decorateWechatChatWindowList();
            return result;
        };
    }
    const baseGroupContacts = window.getWechatGroupContacts;
    if (typeof baseGroupContacts === 'function') {
        window.getWechatGroupContacts = function getWechatGroupContactsWithoutWindows(options = {}) {
            const list = baseGroupContacts.call(this, options);
            return options && options.includeWindows ? list : list.filter(char => !isWechatChatWindow(char));
        };
    }
    const baseOpenChatSettings = window.openChatSettings;
    if (typeof baseOpenChatSettings === 'function') {
        window.openChatSettings = function openChatSettingsWithWindows(...args) {
            const result = baseOpenChatSettings.apply(this, args);
            try { renderWechatChatWindowsSection(); } catch (error) { console.warn('聊天窗口列表渲染失败', error); }
            try { window.syncWechatCardExportRow?.(); } catch (_) {}
            return result;
        };
    }
})();
