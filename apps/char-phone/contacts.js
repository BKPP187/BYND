const WECHAT_AI_PHONE_CONTACT_THREAD_LIMIT = 12;
function getWechatAiPhoneContactReplyStore(char) {
    if (!char) return { threads: {}, threadsByName: {}, pending: [], events: [] };
    char.chatConfig = char.chatConfig || {};
    const store = char.chatConfig.aiPhoneContactReplies && typeof char.chatConfig.aiPhoneContactReplies === 'object'
        ? char.chatConfig.aiPhoneContactReplies
        : {};
    store.threads = store.threads && typeof store.threads === 'object' ? store.threads : {};
    store.threadsByName = store.threadsByName && typeof store.threadsByName === 'object' ? store.threadsByName : {};
    store.pending = Array.isArray(store.pending) ? store.pending : [];
    store.events = Array.isArray(store.events) ? store.events.slice(-18) : [];
    char.chatConfig.aiPhoneContactReplies = store;
    return store;
}

function getWechatAiPhoneContactKey(contact, index) {
    return `${index}:${String(contact && contact.name || '联系人').trim() || '联系人'}`;
}

function getWechatAiPhoneContactNameKey(value) {
    return stripWechatPromptText(value, 42).replace(/\s+/g, '').toLowerCase();
}

function normalizeWechatAiPhoneContactRow(row) {
    if (!row) return null;
    const text = stripWechatPromptText(row.text || row.message || row.content || row.preview || '', 600);
    if (!text) return null;
    return {
        isCharSide: !!row.isCharSide,
        text,
        time: stripWechatPromptText(row.time || row.meta || '', 16),
        type: row.type || 'text',
        byUserProxy: !!row.byUserProxy,
        fromPreview: !!row.fromPreview,
        generatedContinuation: !!row.generatedContinuation
    };
}

function getWechatAiPhoneContactRowSignature(row) {
    const side = row && row.isCharSide ? 'self' : 'other';
    const proxy = row && row.byUserProxy ? 'proxy' : '';
    return `${side}:${proxy}:${stripWechatPromptText(row && row.text, 600)}`;
}

function mergeWechatAiPhoneContactRows(...lists) {
    const seen = new Set();
    const rows = [];
    lists.flat().forEach(row => {
        const normalized = normalizeWechatAiPhoneContactRow(row);
        if (!normalized) return;
        const signature = getWechatAiPhoneContactRowSignature(normalized);
        if (seen.has(signature)) return;
        seen.add(signature);
        rows.push(normalized);
    });
    return rows.slice(-24);
}

function setWechatAiPhoneStoredContactRows(char, contact, index, rows) {
    if (!char || !contact) return [];
    const store = getWechatAiPhoneContactReplyStore(char);
    const key = getWechatAiPhoneContactKey(contact, index);
    const nameKey = getWechatAiPhoneContactNameKey(contact.name || '');
    const merged = mergeWechatAiPhoneContactRows(rows);
    // Re-insert so key order tracks recency, then drop the oldest threads.
    delete store.threads[key];
    store.threads[key] = merged;
    if (nameKey) {
        delete store.threadsByName[nameKey];
        store.threadsByName[nameKey] = merged;
    }
    for (const map of [store.threads, store.threadsByName]) {
        const keys = Object.keys(map);
        keys.slice(0, Math.max(0, keys.length - WECHAT_AI_PHONE_CONTACT_THREAD_LIMIT)).forEach(oldKey => delete map[oldKey]);
    }
    return merged;
}

function getWechatAiPhoneStoredContactRows(char, contact, index) {
    const store = getWechatAiPhoneContactReplyStore(char);
    const key = getWechatAiPhoneContactKey(contact, index);
    const nameKey = getWechatAiPhoneContactNameKey(contact && contact.name);
    return mergeWechatAiPhoneContactRows(
        Array.isArray(store.threads[key]) ? store.threads[key] : [],
        nameKey && Array.isArray(store.threadsByName[nameKey]) ? store.threadsByName[nameKey] : []
    ).slice(-18);
}

function buildWechatAiPhoneContactPreviewRow(contact) {
    if (!contact || contact.byUserProxy) return null;
    const text = stripWechatPromptText(contact.text || contact.lastMessage || contact.message || contact.preview || '', 600);
    if (!text) return null;
    return {
        isCharSide: false,
        text,
        time: stripWechatPromptText(contact.time || contact.status || '', 16),
        type: 'text',
        fromPreview: true
    };
}

function hasWechatAiPhoneContactRowText(rows, text) {
    const target = stripWechatPromptText(text, 600);
    if (!target) return false;
    return (Array.isArray(rows) ? rows : []).some(row => stripWechatPromptText(row && row.text, 600) === target);
}

function appendWechatAiPhoneContactReply(char, contact, index, text) {
    const clean = stripWechatPromptText(text, 600);
    if (!char || !clean || index <= 0) return false;
    const store = getWechatAiPhoneContactReplyStore(char);
    const key = getWechatAiPhoneContactKey(contact, index);
    const contactName = contact && contact.name || '联系人';
    const contactNameKey = getWechatAiPhoneContactNameKey(contactName);
    const previewRow = buildWechatAiPhoneContactPreviewRow(contact);
    const event = {
        id: `phone_reply_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        contactKey: key,
        contactName,
        contactNameKey,
        contactPreview: previewRow ? previewRow.text : (contact && contact.text || ''),
        userReply: clean,
        createdAt: Date.now()
    };
    const existingRows = getWechatAiPhoneStoredContactRows(char, contact, index);
    const nextRows = existingRows.slice();
    if (previewRow && !hasWechatAiPhoneContactRowText(nextRows, previewRow.text)) {
        nextRows.push(previewRow);
    }
    nextRows.push({
        isCharSide: true,
        text: clean,
        time: '刚刚',
        type: 'text',
        byUserProxy: true
    });
    setWechatAiPhoneStoredContactRows(char, contact, index, nextRows);
    const snapshotChats = char.chatConfig && char.chatConfig.aiPhoneSnapshot && Array.isArray(char.chatConfig.aiPhoneSnapshot.chats)
        ? char.chatConfig.aiPhoneSnapshot.chats
        : [];
    if (snapshotChats[index]) {
        snapshotChats[index].text = clean;
        snapshotChats[index].time = '刚刚';
        snapshotChats[index].byUserProxy = true;
    }
    store.pending.push(event);
    store.events.push(event);
    store.events = store.events.slice(-18);
    saveCharactersToStorage();
    return true;
}

function submitWechatAiPhoneContactReply(charId, chatIndex) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const snapshot = char && char.chatConfig && char.chatConfig.aiPhoneSnapshot;
    const chats = Array.isArray(snapshot && snapshot.chats) ? snapshot.chats : [];
    const index = Math.max(0, Number(chatIndex || 0));
    const input = document.getElementById('wc-ai-phone-contact-reply-input');
    const text = String(input && input.value || '').trim();
    if (!char || !text || index <= 0) return;
    if (appendWechatAiPhoneContactReply(char, chats[index], index, text)) {
        input.value = '';
        renderWechatAiPhone(char);
        flushWechatAiPhoneContactReplyReactions(char);
    }
}
window.submitWechatAiPhoneContactReply = submitWechatAiPhoneContactReply;

function renderWechatAiPhoneConversationRows(snapshot, char, index) {
    const chats = Array.isArray(snapshot.chats) ? snapshot.chats : [];
    const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : ((typeof getUserProfile === 'function') ? getUserProfile() : {});
    const userName = getWechatAiPhoneUserDisplayName(char, userProfile);
    const charName = getWechatCharDisplayName(char);
    const contact = chats[index] || chats[0] || {
        name: userName,
        text: '还没有新的聊天',
        time: ''
    };
    const history = Array.isArray(char && char.history) ? char.history : [];
    let rows = [];

    if (index === 0) {
        rows = history
            .filter(msg => msg && msg.type !== 'system_notice')
            .slice(-22)
            .map(msg => ({
                isCharSide: !msg.isMe,
                text: getWechatAiPhoneMessageText(msg),
                time: formatMessageTime(msg),
                type: msg.type || 'text',
                msg
            }))
            .filter(item => item.text || item.type === 'music_card' || item.type === 'image');
    }

    if (index > 0) {
        const storedRows = getWechatAiPhoneStoredContactRows(char, contact, index);
        const previewRow = buildWechatAiPhoneContactPreviewRow(contact);
        rows = rows.concat(storedRows);
        if (previewRow && !hasWechatAiPhoneContactRowText(storedRows, previewRow.text)) {
            rows.push(previewRow);
        }
    }

    if (!rows.length) {
        rows = index === 0
            ? [{ isCharSide: false, text: '还没有真实聊天记录', time: '', type: 'text' }]
            : [
                { isCharSide: false, text: contact.text || '这条聊天还停在预览里。', time: contact.time || '', type: 'text' },
                { isCharSide: true, text: '先放在这里，晚点再回。', time: '', type: 'text' }
            ];
    }

    return rows.map(item => {
        const sideClass = item.isCharSide ? 'is-self' : 'is-other';
        const avatarName = item.isCharSide ? charName : (index === 0 ? userName : contact.name);
        const avatarSrc = item.isCharSide ? (char.avatar || DEFAULT_AVATAR) : (index === 0 ? (userProfile.avatar || DEFAULT_AVATAR) : DEFAULT_AVATAR);
        const avatarHtml = getWechatAiPhoneAvatarHtml(avatarSrc, avatarName, item.isCharSide ? 'is-char' : 'is-contact');
        const hasSticker = !!resolveWechatAiPhoneSticker(item, char);
        const bubbleClass = [
            'wc-ai-phone-msg-bubble',
            item.type === 'voice' ? 'is-voice' : '',
            item.type === 'music_card' ? 'is-music-card' : '',
            item.type === 'image' ? 'is-image' : '',
            hasSticker ? 'is-sticker' : ''
        ].filter(Boolean).join(' ');
        return `
            <div class="wc-ai-phone-msg ${sideClass}">
                ${item.isCharSide ? '' : avatarHtml}
                <div class="${bubbleClass}">
                    ${renderWechatAiPhoneMessageContent(item, char)}
                    ${item.byUserProxy ? `<small class="wc-ai-phone-proxy-tag">由${wcEscapeHtml(userName)}代发</small>` : ''}
                </div>
                ${item.isCharSide ? avatarHtml : ''}
            </div>
        `;
    }).join('');
}

function renderWechatAiPhoneIosRows(items, emptyText = '暂无记录', icon = 'ri-circle-fill') {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return `<div class="wc-ai-phone-empty">${wcEscapeHtml(emptyText)}</div>`;
    return `
        <div class="wc-ai-phone-ios-list">
            ${list.map((item, index) => {
                const row = typeof item === 'object'
                    ? item
                    : normalizeWechatAiPhoneRecordList([item], [], 1)[0];
                const text = typeof item === 'string' ? item : (item.text || item.title || '');
                const title = stripWechatPromptText(row && row.title || text, 34) || `记录 ${index + 1}`;
                const detail = stripWechatPromptText(row && row.detail || (typeof item === 'string' ? text : ''), 92);
                const meta = stripWechatPromptText(row && row.meta || '', 20);
                return `
                    <button type="button" class="wc-ai-phone-ios-row">
                        <i class="${icon}"></i>
                        <span><strong>${wcEscapeHtml(title)}</strong><em>${wcEscapeHtml(detail || title)}</em></span>
                        ${meta ? `<small>${wcEscapeHtml(meta)}</small>` : '<b class="ri-arrow-right-s-line"></b>'}
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

function getWechatAiPhoneMemoItems(snapshot) {
    const raw = Array.isArray(snapshot && snapshot.memos) ? snapshot.memos : [];
    return raw.map((item, index) => {
        if (item && typeof item === 'object') {
            const content = cleanWechatAiPhoneBlockText(item.content || item.detail || item.note || item.text || item.title || '', 620);
            const title = stripWechatPromptText(item.title || item.name || content, 26) || `备忘录 ${index + 1}`;
            const detail = stripWechatPromptText(item.detail || item.summary || item.note || content, 72);
            const meta = stripWechatPromptText(item.meta || item.time || item.updatedAt || '', 18) || '今天';
            return { title, detail: detail && detail !== title ? detail : content, meta, content: content || detail || title };
        }
        const content = cleanWechatAiPhoneBlockText(item, 620);
        if (!content) return null;
        const title = stripWechatPromptText(content.split(/[。.!！?？\n]/).find(Boolean) || content, 26) || `备忘录 ${index + 1}`;
        return { title, detail: stripWechatPromptText(content, 72), meta: '今天', content };
    }).filter(Boolean).slice(0, 10);
}

function renderWechatAiPhoneMemoRows(items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return `<div class="wc-ai-phone-empty">没有备忘录</div>`;
    return `
        <div class="wc-ai-phone-ios-list">
            ${list.map((item, index) => `
                <button type="button" class="wc-ai-phone-ios-row" onclick="openWechatAiPhoneMemoItem(${index})">
                    <i class="ri-sticky-note-fill"></i>
                    <span><strong>${wcEscapeHtml(item.title || `备忘录 ${index + 1}`)}</strong><em>${wcEscapeHtml(item.detail || item.content || item.title || '')}</em></span>
                    <small>${wcEscapeHtml(item.meta || '今天')}</small>
                </button>
            `).join('')}
        </div>
    `;
}

function renderWechatAiPhoneMemoDetail(item) {
    return `
        <div class="wc-ai-phone-note-detail">
            <button type="button" class="wc-ai-phone-detail-back" onclick="closeWechatAiPhoneMemoItem()"><i class="ri-arrow-left-s-line"></i>备忘录</button>
            <article class="wc-ai-phone-note-paper">
                <time>${wcEscapeHtml(item.meta || '今天')}</time>
                <h3>${wcEscapeHtml(item.title || '备忘录')}</h3>
                <p>${wcEscapeHtml(item.content || item.detail || item.title || '')}</p>
            </article>
        </div>
    `;
}

function renderWechatAiPhoneBrowserListRows(items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return `<div class="wc-ai-phone-empty">没有浏览记录</div>`;
    return `
        <div class="wc-ai-phone-ios-list">
            ${list.map((item, index) => `
                <button type="button" class="wc-ai-phone-ios-row" onclick="openWechatAiPhoneBrowserItem(${index})">
                    <i class="ri-compass-3-fill"></i>
                    <span><strong>${wcEscapeHtml(item.title || `网页 ${index + 1}`)}</strong><em>${wcEscapeHtml(item.detail || item.url || item.title || '')}</em></span>
                    ${item.meta ? `<small>${wcEscapeHtml(item.meta)}</small>` : '<b class="ri-arrow-right-s-line"></b>'}
                </button>
            `).join('')}
        </div>
    `;
}

function renderWechatAiPhoneBrowserDetail(item) {
    const title = stripWechatPromptText(item && item.title, 42) || 'Safari';
    const detail = stripWechatPromptText((item && (item.detail || item.url || item.summary)) || '', 180);
    const host = detail && /^[a-z0-9.-]+\.[a-z]{2,}/i.test(detail) ? detail : 'reader.safari';
    return `
        <div class="wc-ai-phone-safari-reader">
            <div class="wc-ai-phone-safari-toolbar"><i class="ri-lock-2-fill"></i><span>${wcEscapeHtml(host)}</span><i class="ri-reload-line"></i></div>
            <button type="button" class="wc-ai-phone-detail-back" onclick="closeWechatAiPhoneBrowserItem()"><i class="ri-arrow-left-s-line"></i>最近浏览</button>
            <article class="wc-ai-phone-safari-article">
                <span>${wcEscapeHtml(item && item.meta || '最近')}</span>
                <h3>${wcEscapeHtml(title)}</h3>
                ${detail ? `<p>${wcEscapeHtml(detail)}</p>` : ''}
                <div><i class="ri-book-open-line"></i><em>阅读器视图</em></div>
            </article>
        </div>
    `;
}

function renderWechatAiPhoneScheduleRows(items) {
    const list = normalizeWechatAiPhoneScheduleRows(items);
    if (!list.length) return `<div class="wc-ai-phone-empty">没有行程记录</div>`;
    return `
        <div class="wc-ai-phone-schedule-list">
            ${list.map(row => `
                <button type="button" class="wc-ai-phone-schedule-row">
                    <span class="wc-ai-phone-schedule-time">${wcEscapeHtml(row.time || '--:--')}</span>
                    <span class="wc-ai-phone-schedule-main">
                        <strong>${wcEscapeHtml(row.title || '日历提醒')}</strong>
                        <em>${wcEscapeHtml(row.meta || '今天')}</em>
                    </span>
                    <i class="ri-calendar-event-fill"></i>
                </button>
            `).join('')}
        </div>
    `;
}


