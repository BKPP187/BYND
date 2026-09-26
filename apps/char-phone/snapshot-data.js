const WECHAT_AI_PHONE_SCHEMA_VERSION = '20260718-no-hardcoded-phone4';

function cleanWechatAiPhoneBlockText(value, maxLength = 620) {
    const text = cleanWechatVisibleContent(value)
        .replace(/<[^>]+>/g, '')
        .replace(/\|\|\|/g, '\n')
        .replace(/\r/g, '')
        .split(/\n+/)
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

function normalizeWechatAiPhoneMemoList(value, fallback = []) {
    const source = Array.isArray(value)
        ? value
        : (typeof value === 'string' && value.trim() ? value.split(/\n+/) : []);
    const rows = source.map(item => {
        const raw = item && typeof item === 'object' ? item : { content: item };
        const content = cleanWechatAiPhoneBlockText(raw.content || raw.detail || raw.note || raw.text || raw.body || '', 620);
        const rawTitle = stripWechatPromptText(raw.title || raw.name || raw.subject || '', 30);
        const meta = stripWechatPromptText(raw.meta || raw.time || raw.date || raw.updatedAt || '', 18);
        if (!rawTitle || !content || !meta) return null;
        const title = rawTitle;
        const detail = stripWechatPromptText(raw.detail || raw.summary || raw.note || content, 76);
        return {
            title,
            detail: detail && detail !== title ? detail : stripWechatPromptText(content, 76),
            meta,
            content: content || detail || title
        };
    }).filter(Boolean).slice(0, 6);
    if (rows.length) return rows;
    return Array.isArray(fallback) ? fallback.filter(Boolean).slice(0, 6) : [];
}

function isWechatAiPhoneOfficeTemplateText(value) {
    return /沈助理|周秘书|项目群|会议材料已放到桌面|董事会临时改到下午|等你确认最终版本/.test(String(value || ''));
}

function shouldDropWechatAiPhoneRowForPersona(row, char) {
    const text = `${row && row.name || ''} ${row && row.title || ''} ${row && row.text || ''} ${row && row.detail || ''} ${row && row.meta || ''}`;
    return isWechatAiPhoneOfficeTemplateText(text);
}

function buildWechatAiPhoneFallback(char) {
    const userProfile = (typeof getWechatChatUserProfile === 'function')
        ? getWechatChatUserProfile(char)
        : ((typeof getUserProfile === 'function') ? getUserProfile() : { name: '\u7528\u6237' });
    const userName = getWechatAiPhoneUserDisplayName(char, userProfile);
    const realUserChat = buildWechatAiPhoneRealUserChatRow(char, userName);
    return {
        updatedAt: Date.now(),
        schemaVersion: WECHAT_AI_PHONE_SCHEMA_VERSION,
        generatedBy: 'local',
        userRemark: userName,
        chats: realUserChat ? [realUserChat] : [],
        memos: [],
        browser: [],
        wallet: '',
        footprints: [],
        usageRecords: [],
        walletRecords: [],
        scheduleRecords: [],
        shoppingRecords: [],
        takeoutRecords: [],
        gameRecords: [],
        diary: '',
        diaryLetters: []
    };
}

function getWechatAiPhoneUserDisplayName(char, profile) {
    return getWechatAiPhoneUserRemark(char, profile);
}

function getWechatAiPhoneUserRemark(char, profile) {
    char = char || {};
    const config = char.chatConfig || {};
    const saved = stripWechatPromptText(config.aiPhoneUserRemark, 24);
    if (saved && !/^(我|用户|user)$/i.test(saved)) return saved;
    const characterTitle = stripWechatPromptText(config.userTitle, 24);
    if (characterTitle && !/^(我|用户|user)$/i.test(characterTitle)) return characterTitle;
    const profileName = stripWechatPromptText(profile && profile.name, 24);
    return profileName || '你';
}

function setWechatAiPhoneUserRemark(char, value) {
    if (!char) return '';
    const next = stripWechatPromptText(value, 24);
    if (!next || /^(我|用户|user)$/i.test(next)) return getWechatAiPhoneUserRemark(char);
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.aiPhoneUserRemark = next;
    return next;
}

function isWechatAiPhoneRealUserMessage(msg, char) {
    return !!(
        msg
        && msg.isMe === true
        && msg.type !== 'system_notice'
        && !msg.monitorEvent
        && !isWechatRegexPayloadMessage(msg, char)
    );
}

function buildWechatAiPhoneRealUserChatRow(char, displayName = '') {
    const userName = displayName || getWechatAiPhoneUserDisplayName(char);
    const history = Array.isArray(char && char.history) ? char.history : [];
    const lastUserMsg = history.slice().reverse().find(msg => isWechatAiPhoneRealUserMessage(msg, char));
    const text = lastUserMsg
        ? (stripWechatPromptText(getWechatAiPhoneMessageText(lastUserMsg), 72) || '发来一条消息')
        : '还没有真实聊天记录';
    return {
        name: userName,
        text,
        time: lastUserMsg ? formatMessageTime(lastUserMsg) : ''
    };
}

function isWechatAiPhonePlaceholderChatRow(row) {
    if (!row || typeof row !== 'object') return true;
    const name = stripWechatPromptText(row.name || '', 32);
    const text = stripWechatPromptText(row.text || row.lastMessage || row.message || '', 90);
    if (!name && !text) return true;
    if (/^(联系人|工作联系人|某联系人|未知联系人|好友|朋友|NPC)$/i.test(name)
        && /^(最近一条未读消息|未读消息|有一条新消息|聊天|消息|暂无|无)$/i.test(text || '')) {
        return true;
    }
    if (/^(联系人|工作联系人|某联系人|未知联系人|好友|朋友|NPC)$/i.test(name) && !text) return true;
    return false;
}

function withWechatAiPhoneRealUserChat(snapshot, char, displayName = '') {
    const source = snapshot && typeof snapshot === 'object' ? { ...snapshot } : buildWechatAiPhoneFallback(char);
    const userRow = buildWechatAiPhoneRealUserChatRow(char, displayName || source.userRemark || '');
    const contacts = (Array.isArray(source.chats) ? source.chats.slice(1) : [])
        .filter(item => item && String(item.name || '').trim() && String(item.name || '').trim() !== userRow.name)
        .filter(item => !isWechatAiPhonePlaceholderChatRow(item))
        .slice(0, 4);
    source.chats = [userRow, ...contacts];
    return source;
}

function getWechatAiPhoneContinuityContacts(char) {
    const store = getWechatAiPhoneContactReplyStore(char);
    const events = Array.isArray(store.events) ? store.events.slice(-10) : [];
    const latestByName = new Map();
    events.forEach(event => {
        const name = stripWechatPromptText(event.contactName || '', 32);
        const key = event.contactNameKey || getWechatAiPhoneContactNameKey(name);
        if (key && name) latestByName.set(key, { ...event, contactName: name, contactNameKey: key });
    });
    return Array.from(latestByName.values()).reverse().map(event => {
        const rows = mergeWechatAiPhoneContactRows(
            event.contactKey && Array.isArray(store.threads[event.contactKey]) ? store.threads[event.contactKey] : [],
            event.contactNameKey && Array.isArray(store.threadsByName[event.contactNameKey]) ? store.threadsByName[event.contactNameKey] : []
        );
        const lastRow = rows.slice().reverse().find(row => row && row.text);
        return {
            name: event.contactName,
            text: stripWechatPromptText((lastRow && lastRow.text) || event.userReply || event.contactPreview || '有一条代发后的聊天', 82),
            time: (lastRow && lastRow.time) || (event.createdAt ? formatWechatSnapshotTime(event.createdAt) : '最近'),
            byContinuity: true,
            contactNameKey: event.contactNameKey
        };
    }).filter(item => item.name && item.text).slice(0, 4);
}

function mergeWechatAiPhoneContinuityChats(chats, char) {
    const source = Array.isArray(chats) ? chats.filter(Boolean) : [];
    const userRow = source[0] || buildWechatAiPhoneRealUserChatRow(char);
    const generated = source.slice(1);
    const continuity = getWechatAiPhoneContinuityContacts(char);
    const output = [userRow];
    const seen = new Set();
    const pushContact = (item) => {
        if (isWechatAiPhonePlaceholderChatRow(item)) return;
        const key = getWechatAiPhoneContactNameKey(item && item.name);
        if (!key || seen.has(key)) return;
        output.push(item);
        seen.add(key);
    };
    continuity.forEach(item => {
        const key = getWechatAiPhoneContactNameKey(item.name);
        const generatedMatch = generated.find(row => getWechatAiPhoneContactNameKey(row && row.name) === key);
        pushContact(generatedMatch || item);
    });
    generated.forEach(pushContact);
    return output.slice(0, 5);
}

function syncWechatAiPhoneGeneratedContactContinuity(char, chats) {
    const store = getWechatAiPhoneContactReplyStore(char);
    (Array.isArray(chats) ? chats : []).slice(1).forEach((contact, offset) => {
        const index = offset + 1;
        const nameKey = getWechatAiPhoneContactNameKey(contact && contact.name);
        const hasContinuity = !!(nameKey && Array.isArray(store.events) && store.events.some(event => (
            (event.contactNameKey || getWechatAiPhoneContactNameKey(event.contactName)) === nameKey
        )));
        if (!hasContinuity) return;
        const previewRow = buildWechatAiPhoneContactPreviewRow(contact);
        if (!previewRow) return;
        const rows = getWechatAiPhoneStoredContactRows(char, contact, index);
        if (hasWechatAiPhoneContactRowText(rows, previewRow.text)) return;
        setWechatAiPhoneStoredContactRows(char, contact, index, rows.concat({
            ...previewRow,
            generatedContinuation: true
        }));
    });
}

function buildWechatAiPhoneProxyContinuityContext(char) {
    const store = getWechatAiPhoneContactReplyStore(char);
    const events = Array.isArray(store.events) ? store.events.slice(-6) : [];
    if (!events.length) return '';
    const blocks = events.map((event, index) => {
        const name = stripWechatPromptText(event.contactName || '联系人', 32);
        const rows = mergeWechatAiPhoneContactRows(
            event.contactKey && Array.isArray(store.threads[event.contactKey]) ? store.threads[event.contactKey] : [],
            event.contactNameKey && Array.isArray(store.threadsByName[event.contactNameKey]) ? store.threadsByName[event.contactNameKey] : []
        ).slice(-5);
        const rowText = rows.map(row => {
            const speaker = row.byUserProxy ? '用户代 char 发' : (row.isCharSide ? 'char' : name);
            return `${speaker}: ${row.text}`;
        }).join('\n');
        return [
            `事件${index + 1} 联系人：${name}`,
            event.contactPreview ? `原预览：${stripWechatPromptText(event.contactPreview, 90)}` : '',
            `用户代发：${stripWechatPromptText(event.userReply, 120)}`,
            rowText ? `现有线程：\n${rowText}` : ''
        ].filter(Boolean).join('\n');
    });
    return stripWechatPromptText(blocks.join('\n\n'), 1800);
}

function stringifyWechatAiPhoneRecordValue(value) {
    if (value == null) return '';
    if (Array.isArray(value)) {
        return value.map(item => stringifyWechatAiPhoneRecordValue(item)).filter(Boolean).join('、');
    }
    if (typeof value === 'object') {
        const direct = value.title || value.name || value.label || value.product || value.item || value.dish || value.food || value.shop || value.store || value.amount || value.price || value.status || value.text || value.content || value.detail || value.description;
        if (direct != null) return stringifyWechatAiPhoneRecordValue(direct);
        try { return JSON.stringify(value); } catch (_) { return ''; }
    }
    return String(value);
}

function normalizeWechatAiPhoneRecordList(value, fallback = [], limit = 8) {
    const parseRecord = (item) => {
        if (!item) return null;
        if (typeof item === 'object') {
            const title = stripWechatPromptText(
                stringifyWechatAiPhoneRecordValue(item.title || item.name || item.place || item.location || item.app || item.application || item.label || item.shop || item.store || item.merchant || item.product || item.item || item.destination || item.contact || item.dish || item.food || item.restaurant || item['标题'] || item['名称'] || item['地点'] || item['位置'] || item['店铺'] || item['商品'] || item['菜品'] || item['App名'] || item.text || ''),
                40
            );
            const detail = stripWechatPromptText(
                stringifyWechatAiPhoneRecordValue(item.detail || item.address || item.reason || item.summary || item.note || item.description || item.items || item.content || item.activity || item.purpose || item.behavior || item.action || item['详情'] || item['说明'] || item['原因'] || item['内容'] || item['商品列表'] || item['菜品列表'] || item['使用行为'] || item.text || ''),
                92
            );
            const meta = stripWechatPromptText(
                stringifyWechatAiPhoneRecordValue(item.meta || item.time || item.date || item.duration || item.lastUsed || item.count || item.value || item.amount || item.price || item.status || item['时间'] || item['日期'] || item['时长'] || item['金额'] || item['价格'] || item['状态'] || ''),
                20
            );
            if (!title) return null;
            return {
                title,
                detail: detail && detail !== title ? detail : '',
                meta
            };
        }
        const text = stripWechatPromptText(item, 140);
        if (!text) return null;
        const parts = text.split(/[｜|]/).map(part => stripWechatPromptText(part, 80)).filter(Boolean);
        if (parts.length >= 3) return { title: parts[0], detail: parts.slice(2).join(' · '), meta: parts[1] };
        if (parts.length === 2) return { title: parts[0], detail: parts[1], meta: '' };
        const softParts = text.split(/\s+[·•]\s+|\s+-\s+|\s+—\s+/).map(part => stripWechatPromptText(part, 80)).filter(Boolean);
        if (softParts.length >= 2) return { title: softParts[0], detail: softParts.slice(1).join(' · '), meta: '' };
        return { title: text, detail: '', meta: '' };
    };

    let source = [];
    if (Array.isArray(value)) source = value;
    else if (typeof value === 'string' && value.trim()) source = value.split(/\n+/);
    const parsed = source.map(parseRecord).filter(Boolean).slice(0, limit);
    if (parsed.length) return parsed;
    return Array.isArray(fallback) ? fallback.slice(0, limit) : [];
}

function hasWechatAiPhoneSnapshotField(snapshot, keys) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    return keys.some(key => Object.prototype.hasOwnProperty.call(snapshot, key));
}

function isWechatAiPhoneLocalGameRecord(row) {
    const text = `${row && row.title || ''} ${row && row.detail || ''}`.trim();
    if (!text) return false;
    const localTitles = [
        '肥鸡大冒险',
        '跳一跳',
        '倒水排序',
        '2048',
        '五子棋',
        '国际象棋',
        '中国象棋',
        '默契问答',
        '语言翻牌',
        '桌游房间',
        '解谜档案'
    ];
    return localTitles.some(title => new RegExp(`(^|[\\s、，,：:「《])${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[\\s、，,。；;」》])`).test(text))
        || /\bBYND\b|BYND\s*Game|小游戏大厅|用户手机|user\s*phone/i.test(text);
}

function filterWechatAiPhoneGameRowsForPersona(rows, char) {
    const cleaned = (Array.isArray(rows) ? rows : [])
        .filter(row => row && !isWechatAiPhoneLocalGameRecord(row))
        .slice(0, 6);
    return cleaned;
}

function pickWechatAiPhoneField(data, keys) {
    if (!data || typeof data !== 'object') return undefined;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(data, key) && data[key] != null) return data[key];
    }
    const lowerMap = Object.keys(data).reduce((map, key) => {
        map[key.toLowerCase()] = key;
        return map;
    }, {});
    for (const key of keys) {
        const actual = lowerMap[String(key).toLowerCase()];
        if (actual && data[actual] != null) return data[actual];
    }
    return undefined;
}

function isWechatAiPhoneScheduleNarrative(value) {
    const text = stripWechatPromptText(value, 120);
    if (!text) return false;
    if (text.length > 34) return true;
    return /后脑|发根|指腹|摩挲|唇|呼吸|腰|腿|胸|暧昧|姿势|动作|视线|目光|小夜灯|床|衣角|手指|掌心|安抚|贴近|压低|颤|喘|亲|吻/.test(text);
}

function normalizeWechatAiPhoneScheduleRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(row => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
        const rawTime = stripWechatPromptText(row.time, 8).replace('：', ':');
        const timeMatch = rawTime.match(/^([01]?\d|2[0-3]):[0-5]\d$/);
        const title = stripWechatPromptText(row.title, 32);
        const meta = stripWechatPromptText(row.meta, 18);
        if (!timeMatch || !title || !meta || isWechatAiPhoneScheduleNarrative(title) || isWechatAiPhoneScheduleNarrative(meta)) return null;
        const time = `${String(Number(timeMatch[1])).padStart(2, '0')}:${rawTime.slice(-2)}`;
        return { time, title, meta };
    }).filter(Boolean).slice(0, 6);
}

function getWechatAiPhoneFootprintRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && snapshot.footprints, [], 6);
    if (hasWechatAiPhoneSnapshotField(snapshot, ['footprints', 'traces', 'locations', '足迹', '地点记录']) && !rawRows.length) return [];
    if (rawRows.length) return rawRows.slice(0, 5);
    return [];
}


function shouldWechatAiPhoneShowGames(char, snapshot = null) {
    const rawGames = normalizeWechatAiPhoneRecordList(snapshot && (snapshot.gameRecords || snapshot.games || snapshot['\u6e38\u620f']), [], 5);
    if (filterWechatAiPhoneGameRowsForPersona(rawGames, char).length) return true;
    return false;
}

function getWechatAiPhoneScheduleRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneScheduleRows(snapshot && (snapshot.scheduleRecords || snapshot.schedule || snapshot.calendar || snapshot['\u884c\u7a0b'] || snapshot['\u65e5\u7a0b']));
    if (hasWechatAiPhoneSnapshotField(snapshot, ['scheduleRecords', 'schedule', 'calendar', '\u884c\u7a0b', '\u65e5\u7a0b']) && !rawRows.length) return [];
    return rawRows;
}

function getWechatAiPhoneShoppingRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && (snapshot.shoppingRecords || snapshot.shopping || snapshot.orders || snapshot['\u8d2d\u7269'] || snapshot['\u8d2d\u7269\u8bb0\u5f55']), [], 8);
    if (hasWechatAiPhoneSnapshotField(snapshot, ['shoppingRecords', 'shopping', 'orders', '\u8d2d\u7269', '\u8d2d\u7269\u8bb0\u5f55']) && !rawRows.length) return [];
    if (rawRows.length) return rawRows.slice(0, 6);
    const history = Array.isArray(char && char.history) ? char.history : [];
    const rows = history.slice().reverse().reduce((list, msg) => {
        if (list.length >= 5 || !msg) return list;
        if (msg.type === 'gift') {
            const item = msg.item && typeof msg.item === 'object' ? msg.item : {};
            list.push({ title: item.name || msg.title || '\u793c\u7269\u8ba2\u5355', detail: msg.isMe ? '\u7528\u6237\u53d1\u6765\u7684\u793c\u7269\u8bb0\u5f55' : '\u89d2\u8272\u9001\u51fa\u7684\u793c\u7269\u8bb0\u5f55', meta: formatMessageTime(msg) });
        } else if (msg.type === 'share_card' && msg.card && (msg.card.action === 'product' || msg.card.product)) {
            const product = msg.card.product || {};
            list.push({ title: product.name || msg.card.title || '\u5546\u54c1\u5361\u7247', detail: product.description || msg.card.text || '\u4ece\u8d2d\u7269\u9875\u8f6c\u53d1\u7684\u5546\u54c1', meta: formatMessageTime(msg) });
        } else if (msg.type === 'intimatePay') {
            list.push({ title: '\u4eb2\u5bc6\u4ed8\u8bb0\u5f55', detail: msg.note || msg.description || '\u4eb2\u5bc6\u4ed8\u76f8\u5173\u8d26\u5355', meta: formatMessageTime(msg) });
        }
        return list;
    }, []);
    if (rows.length) return rows;
    return [];
}

function getWechatAiPhoneTakeoutRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && (snapshot.takeoutRecords || snapshot.takeout || snapshot.foodDelivery || snapshot['\u5916\u5356'] || snapshot['\u5916\u5356\u8bb0\u5f55']), [], 8);
    if (hasWechatAiPhoneSnapshotField(snapshot, ['takeoutRecords', 'takeout', 'foodDelivery', '\u5916\u5356', '\u5916\u5356\u8bb0\u5f55']) && !rawRows.length) return [];
    if (rawRows.length) return rawRows.slice(0, 6);
    return [];
}

function getWechatAiPhoneGameRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && (snapshot.gameRecords || snapshot.games || snapshot['\u6e38\u620f'] || snapshot['\u73a9\u7684\u6e38\u620f']), [], 8);
    if (hasWechatAiPhoneSnapshotField(snapshot, ['gameRecords', 'games', '\u6e38\u620f', '\u73a9\u7684\u6e38\u620f']) && !rawRows.length) return [];
    return filterWechatAiPhoneGameRowsForPersona(rawRows, char);
}

function getWechatAiPhoneAppUsageLabel(tabName) {
    const map = {
        home: '主屏幕',
        chat: '信息',
        wechatChat: '信息',
        memo: '备忘录',
        browser: 'Safari',
        wallet: '钱包',
        diary: '日记',
        footprints: '地图',
        usage: '屏幕使用时间',
        clock: '时钟',
        schedule: '日历',
        shopping: '购物',
        takeout: '外卖',
        games: '游戏'
    };
    return map[tabName] || '应用';
}

function recordWechatAiPhoneAppUsage(char, tabName) {
    if (char && char.chatConfig && char.chatConfig.aiPhoneUsageLog) {
        delete char.chatConfig.aiPhoneUsageLog;
    }
}

function getWechatAiPhoneUsageRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && (snapshot.usageRecords || snapshot.usage || snapshot.appUsage || snapshot['\u4f7f\u7528\u8bb0\u5f55'] || snapshot['\u5e94\u7528\u4f7f\u7528']), [], 10);
    if (rawRows.length) return rawRows.slice(0, 10);
    return [];
}

function getWechatAiPhoneUsageTotal(rows) {
    const total = (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
        const match = String(row && row.meta || '').match(/\d+/);
        return sum + (match ? Number(match[0]) : 0);
    }, 0);
    return Math.max(12, total || 12);
}

function getWechatAiPhoneBrowserRows(snapshot, char) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && snapshot.browser, [], 8);
    if (hasWechatAiPhoneSnapshotField(snapshot, ['browser', 'browserHistory', '\u6d4f\u89c8\u5668']) && !rawRows.length) return [];
    const badPattern = /视线|目光|姿势|动作|呼吸|小夜灯|额前|唇|体温|卧室|身边|腰|腿|胸|暧昧|心跳|手臂/;
    const rows = rawRows.filter(row => {
        const text = `${row.title || ''} ${row.detail || ''}`;
        return !badPattern.test(text);
    });

    history.slice().reverse().forEach(msg => {
        if (rows.length >= 6) return;
        if (!msg || msg.type === 'system_notice') return;
        if (msg.type === 'link_card' && msg.url) {
            rows.push({
                title: msg.title || getWechatLinkHost(msg.url),
                detail: getWechatLinkHost(msg.url),
                meta: formatMessageTime(msg)
            });
        } else if (msg.type === 'share_card' && msg.card) {
            const card = msg.card || {};
            rows.push({
                title: card.title || card.source || '转发内容',
                detail: stripWechatPromptText(card.text || card.source || '从聊天里打开的转发卡片', 72),
                meta: formatMessageTime(msg)
            });
        } else if (msg.type === 'music_card') {
            const music = msg.music || {};
            rows.push({
                title: music.title || msg.title || '音乐卡片',
                detail: music.artist ? `搜索音乐：${music.artist}` : '从聊天里打开的音乐',
                meta: formatMessageTime(msg)
            });
        }
    });

    if (rows.length) return rows.slice(0, 6);
    return [];
}


function cleanWechatAiPhoneWalletText(value) {
    return stripWechatPromptText(value, 120)
        .replace(/^\[/, '')
        .replace(/\]\s*/g, ' ')
        .replace(/\[object Object\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function formatWechatAiPhoneMoneyText(value, currency = '') {
    if (value == null || value === '') return '';
    const unit = stripWechatPromptText(currency, 8);
    const prefix = /^(?:\$|USD)$/i.test(unit) ? '$' : (unit && !/^(?:CNY|RMB|元|人民币)$/i.test(unit) ? unit : '¥');
    if (typeof value === 'number' && Number.isFinite(value)) return `${prefix}${value.toFixed(2)}`;
    const text = cleanWechatAiPhoneWalletText(stringifyWechatAiPhoneRecordValue(value));
    if (!text) return '';
    const numberOnly = text.replace(/,/g, '').match(/^[+-]?\d+(?:\.\d{1,2})?$/);
    if (numberOnly) return `${prefix}${Number(numberOnly[0]).toFixed(2)}`;
    const match = text.match(/([+-]?\s*(?:￥|¥|RMB|CNY|\$)?\s*\d[\d,]*(?:\.\d{1,2})?\s*(?:元|块|CNY|RMB|USD)?)/i);
    return match ? match[1].replace(/\s+/g, '') : '';
}

function getWechatAiPhoneWalletInfoFromValue(value, char) {
    const charName = getWechatCharDisplayName(char);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const currency = value.currency || value.unit || value['币种'] || value['货币'];
        const amount = formatWechatAiPhoneMoneyText(
            value.balance ?? value.availableBalance ?? value.available ?? value.currentBalance ?? value.cardBalance
                ?? value.availableCredit ?? value.money ?? value.amount ?? value.limit ?? value.credit
                ?? value['余额'] ?? value['账户余额'] ?? value['可用余额'] ?? value['可用额度']
                ?? value['零钱'] ?? value['金额'] ?? value['额度'],
            currency
        );
        const label = cleanWechatAiPhoneWalletText(
            value.cardName || value.card || value.account || value.accountName || value.type || value.name
                || value.title || value.label || value['卡名'] || value['账户'] || value['类型'] || '零钱'
        );
        const summary = cleanWechatAiPhoneWalletText(
            value.summary || value.detail || value.description || value.status || value.note
                || value['概要'] || value['详情'] || value['说明'] || value['状态'] || ''
        );
        const detail = [label, summary].filter(part => part && part !== amount).join(' · ');
        return {
            amount,
            detail: detail || (amount ? `${charName}的钱包余额` : '')
        };
    }

    const text = cleanWechatAiPhoneWalletText(value);
    const amount = formatWechatAiPhoneMoneyText(text);
    const detail = amount
        ? (text.replace(amount, '').replace(/^(?:余额|零钱|可用|额度)?\s*[·,，。:：\-—|｜]?\s*/i, '').trim() || `${charName}的钱包余额`)
        : text;
    return { amount, detail };
}

function getWechatAiPhoneWalletSummary(snapshot, char) {
    const info = getWechatAiPhoneWalletInfoFromValue(snapshot && snapshot.wallet, char);
    const summary = [info.amount, info.detail].filter(Boolean).join(' · ');
    if (summary && !/未授权|无权|无法查看|不能查看|不可查看/.test(summary)) return summary;
    if (snapshot && (snapshot.generatedBy === 'local' || hasWechatAiPhoneSnapshotField(snapshot, ['wallet', '\u94b1\u5305']))) return '等待 AI 根据角色卡同步钱包数据';
    return '等待 AI 根据角色卡同步钱包数据';
}

function getWechatAiPhoneWalletPassInfo(snapshot, char) {
    const info = getWechatAiPhoneWalletInfoFromValue(snapshot && snapshot.wallet, char);
    const fallbackInfo = info.amount
        ? { amount: '', detail: '' }
        : getWechatAiPhoneWalletInfoFromValue(buildWechatAiPhoneFallback(char).wallet, char);
    return {
        amount: info.amount || fallbackInfo.amount || '金额待同步',
        owner: getWechatCharDisplayName(char),
        detail: info.detail || fallbackInfo.detail || getWechatAiPhoneWalletSummary(snapshot, char)
    };
}

function getWechatAiPhoneWalletRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && (snapshot.walletRecords || snapshot.bills || snapshot.transactions || snapshot['钱包记录'] || snapshot['账单']), [], 8);
    if (rawRows.length) return rawRows.slice(0, 6);
    if (hasWechatAiPhoneSnapshotField(snapshot, ['walletRecords', 'bills', 'transactions', '钱包记录', '账单'])) return [];
    if (snapshot && hasWechatAiPhoneSnapshotField(snapshot, ['wallet', '\u94b1\u5305'])) return [];
    const history = Array.isArray(char && char.history) ? char.history : [];
    const rows = history
        .filter(msg => msg && ['transfer', 'redpacket', 'gift', 'intimatePay'].includes(msg.type))
        .slice(-4)
        .reverse()
        .map(msg => ({
            title: cleanWechatAiPhoneWalletText(getWechatMessageSummary(msg)),
            detail: msg.isMe ? '用户发起' : `${getWechatCharDisplayName(char)}发起`,
            meta: formatMessageTime(msg)
        }));
    return rows;
}

function isWechatAiPhoneDiaryPlaceholder(value) {
    const text = String(value || '').replace(/^[\s【[（(]+|[\s】\]）)。，！!：:]+$/g, '');
    return !text || /^(?:待补充|待完善|暂无(?:内容)?|无内容|未填写|占位(?:符)?|模板内容|这里填写|此处填写.*|按角色卡生成|结合世界书生成|正文|正文内容|标题|副标题|署名|日期|null|undefined|n\/a|\.{3,}|…+)$/i.test(text);
}

function isWechatAiPhoneDiaryPoorTitle(value) {
    const title = stripWechatPromptText(value, 60).replace(/[《》“”"'：:，,。！？!?]/g, '');
    if (!title || title.length < 2 || title.length > 20) return true;
    return /^(?:关于|有关|针对|论|浅谈|分析|报告|记录)/.test(title)
        || /(?:病理分析|隐性条款|问题分析|情况说明|工作汇报|研究报告|待办事项)/.test(title);
}

function getWechatAiPhoneDiaryText(value, depth = 0) {
    if (depth > 4) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.slice(0, 24).map(item => getWechatAiPhoneDiaryText(item, depth + 1)).filter(Boolean).join('\n');
    if (!value || typeof value !== 'object') return '';
    for (const key of ['text', 'content', 'body', 'paragraph', 'name', '正文', '内容']) {
        const text = getWechatAiPhoneDiaryText(value[key], depth + 1);
        if (text.trim()) return text;
    }
    return '';
}

function normalizeWechatAiPhoneDiaryLetterList(value, report = null) {
    const source = Array.isArray(value) ? value : (value && typeof value === 'object' ? [value] : []);
    const punctuate = text => text ? text.replace(/!$/, '！').replace(/\?$/, '？').replace(/\.$/, '。').replace(/([^。！？])$/, '$1！') : '';
    const seen = new Set();
    if (report) {
        report.candidateCount = source.length;
        report.issues = [];
    }
    return source.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const pick = (...keys) => keys.map(key => getWechatAiPhoneDiaryText(item[key])).find(text => text.trim()) || '';
        const addressee = stripWechatPromptText(pick('salutation', 'recipient', '称呼', '称谓', '收信人'), 80).replace(/[：:,，。]+$/, '');
        const salutation = addressee ? `${addressee}：` : '';
        const greeting = punctuate(stripWechatPromptText(pick('greeting', 'greetings', '问候', '问候语'), 160));
        const body = cleanWechatAiPhoneBlockText(pick('body', 'content', 'paragraphs', 'letterBody', 'letter_body', '正文', '正文段落')
            .replace(/\\r\\n|\\n|\\r/g, '\n').replace(/<br\s*\/?\s*>/gi, '\n').replace(/\r\n?/g, '\n'), 12000);
        const closing = stripWechatPromptText(pick('closing', 'signoff', 'sign_off', '祝颂语', '祝颂', '结语'), 100);
        let wish = punctuate(stripWechatPromptText(pick('wish', 'wishes', '祝愿', '祝福'), 100));
        if (wish.replace(/[。！!]+$/, '') === closing.replace(/[。！!]+$/, '')) wish = '';
        const signature = stripWechatPromptText(pick('signature', 'sender', 'author', '署名', '落款', '签名'), 80);
        const rawDate = stripWechatPromptText(pick('date', 'writtenAt', 'written_at', '日期', '写信日期'), 80);
        const dateParts = rawDate.match(/^(?:写于\s*)?(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})日?(?=$|[T\s（(周星])/);
        const validDate = dateParts && Number(dateParts[2]) >= 1 && Number(dateParts[2]) <= 12
            && Number(dateParts[3]) >= 1 && Number(dateParts[3]) <= new Date(Number(dateParts[1]), Number(dateParts[2]), 0).getDate();
        const date = validDate ? dateParts[1] + '年' + Number(dateParts[2]) + '月' + Number(dateParts[3]) + '日' : '';
        let paragraphs = body.split(/\n+/).map(paragraph => paragraph.trim()).filter(Boolean);
        // Formatting a complete single-paragraph letter must not discard its words.
        if (paragraphs.length === 1) {
            const breaks = Array.from(body.matchAll(/[。！？!?][”’」』]?/g), match => match.index + match[0].length)
                .filter(index => index >= body.length / 4 && index <= body.length * 3 / 4);
            const split = breaks.sort((a, b) => Math.abs(a - body.length / 2) - Math.abs(b - body.length / 2))[0];
            if (split) paragraphs = [body.slice(0, split).trim(), body.slice(split).trim()];
        }
        const bodyLength = paragraphs.join('').replace(/\s+/g, '').length;
        const missing = [[salutation, '称呼'], [greeting, '问候'], [body, '正文'], [signature, '署名']]
            .filter(([text]) => isWechatAiPhoneDiaryPlaceholder(text)).map(([, label]) => label);
        if ((!closing && !wish) || isWechatAiPhoneDiaryPlaceholder(closing + wish) || /^(此致|祝|祝你|祝您|敬祝|顺祝)[。！!]*$/.test(closing + wish)) missing.push('完整祝颂');
        if (!date) missing.push('有效日期');
        if (!missing.includes('正文') && (paragraphs.length < 2 || bodyLength < 60 || bodyLength > 6000)) missing.push('完整分段正文');
        if (missing.length) {
            if (report) report.issues.push('第' + (index + 1) + '封缺少' + missing.join('、'));
            return null;
        }
        const key = signature + '\n' + date + '\n' + body.replace(/\s+/g, '');
        if (seen.has(key)) {
            if (report) report.issues.push('第' + (index + 1) + '封与已收到的信件重复');
            return null;
        }
        seen.add(key);
        // Envelope decoration and wording preferences must not discard a
        // complete letter. Labels use only text the model actually supplied.
        const titleText = stripWechatPromptText(pick('title', 'subject', '标题'), 40);
        const subtitleText = stripWechatPromptText(pick('subtitle', 'subTitle', 'sub_title', '副标题'), 60);
        const metaText = stripWechatPromptText(pick('meta', '信封信息'), 40);
        const title = isWechatAiPhoneDiaryPlaceholder(titleText) ? stripWechatPromptText(body.split(/[。！？\n]/)[0], 40) : titleText;
        const subtitle = isWechatAiPhoneDiaryPlaceholder(subtitleText) ? '' : subtitleText;
        const meta = isWechatAiPhoneDiaryPlaceholder(metaText) ? date : metaText;
        if (isWechatAiPhoneDiaryPoorTitle(title)) {
            if (report) report.issues.push('第' + (index + 1) + '封信题不宜使用说明文或分析文格式');
            return null;
        }
        return {
            title,
            subtitle,
            meta,
            salutation,
            greeting,
            body: paragraphs.join('\n'),
            closing,
            wish,
            signature,
            date
        };
    }).filter(Boolean).slice(0, 3);
}

function getWechatAiPhoneDiaryLetters(snapshot, report = null) {
    const candidates = [];
    const seen = new Set();
    const letterKeys = ['diaryLetters', 'diary_letters', 'letters', 'letterCards', 'letter_cards', 'mailbox', 'letter', 'diary', '日记信件', '信件', '信封', '日记'];
    const wrapperKeys = ['phoneData', 'aiPhone', 'iphone', 'data', 'result', 'response', 'output', 'payload', 'content'];
    let visited = 0;
    const visit = (value, depth = 0, container = false) => {
        if (depth > 8 || candidates.length >= 16 || ++visited > 100) return;
        if (typeof value === 'string') {
            if (!value.trim() || value.length > 50000) return;
            let parsed;
            try { parsed = JSON.parse(value); } catch (_) { parsed = parseWechatJsonObject(value); }
            if (parsed && parsed !== value) visit(parsed, depth + 1, container);
            return;
        }
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        if (Array.isArray(value)) {
            value.slice(0, 16).forEach(item => visit(item, depth + 1, true));
            return;
        }
        const isLetter = ['salutation', 'recipient', '称呼', '称谓', '收信人', 'greeting', '问候', '问候语', 'body', 'paragraphs', 'letterBody', 'letter_body', '正文', 'signature', '署名', '落款']
            .some(key => Object.prototype.hasOwnProperty.call(value, key));
        if (isLetter) {
            candidates.push(value);
            return;
        }
        let wrapped = false;
        for (const key of [...letterKeys, ...wrapperKeys]) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
            wrapped = true;
            visit(value[key], depth + 1, container || letterKeys.includes(key));
        }
        if (!wrapped && container) {
            if (value.title || value.subject || value['标题']) candidates.push(value);
            else Object.values(value).slice(0, 16).forEach(item => visit(item, depth + 1, true));
        }
    };
    visit(snapshot);
    return normalizeWechatAiPhoneDiaryLetterList(candidates, report);
}

function renderWechatAiPhoneDiaryMailbox(snapshot, char, isLoading = false, isPhoneBusy = false) {
    const letters = getWechatAiPhoneDiaryLetters(snapshot);
    const retryId = quoteWechatJsString(char && char.id);
    const diaryError = stripWechatPromptText(snapshot && (snapshot.diarySyncError || (!letters.length && snapshot.generatedBy === 'error' ? snapshot.syncError : '')), 260);
    const responses = snapshot?.diarySyncDiagnostics?.responses;
    const lastResponse = Array.isArray(responses) ? responses[responses.length - 1] : null;
    const responseDetail = diaryError && lastResponse?.content
        ? '<details class="wc-ai-phone-diary-response"><summary>查看本次返回</summary><pre>' + wcEscapeHtml(lastResponse.content) + '</pre></details>'
        : '';
    const syncButton = `<button type="button" class="wc-ai-phone-letter-back" aria-label="${isLoading ? '正在同步日记' : '同步日记'}" onclick="regenerateWechatAiPhoneDiary(${retryId})" ${isLoading || isPhoneBusy ? 'disabled' : ''} ${isLoading ? 'aria-busy="true"' : ''}><i class="${isLoading ? 'ri-loader-4-line' : 'ri-refresh-line'}" aria-hidden="true"></i>${isLoading ? '正在同步日记' : '同步日记'}</button>`;
    const syncControls = `<div class="wc-ai-phone-diary-sync">${diaryError ? `<p role="status">本次未能完整更新，已保留可用信件。${wcEscapeHtml(getWechatAiPhoneFriendlyErrorText(diaryError))}</p>` : ''}${syncButton}${responseDetail}</div>`;
    if (!letters.length) {
        window._wechatAiPhoneDiaryOpen = -1;
        const emptyTitle = isLoading ? '正在生成信件' : (diaryError ? '日记同步失败' : '还没有信件');
        const emptyDetail = isLoading
            ? ''
            : (diaryError ? getWechatAiPhoneFriendlyErrorText(diaryError) : '点击同步日记，生成写给你的信件。');
        return `
            <div class="wc-ai-phone-diary-mailbox">
                <div class="wc-ai-phone-empty">
                    <strong>${wcEscapeHtml(emptyTitle)}</strong>
                    ${emptyDetail ? `<p>${wcEscapeHtml(emptyDetail)}</p>` : ''}
                    ${syncButton}
                    ${responseDetail}
                </div>
            </div>
        `;
    }
    const openIndex = Number.isInteger(window._wechatAiPhoneDiaryOpen) ? window._wechatAiPhoneDiaryOpen : -1;
    if (openIndex >= 0 && letters[openIndex]) {
        const letter = letters[openIndex];
        const bodyHtml = letter.body.split(/\n+/).map(line => `<p>${wcEscapeHtml(line)}</p>`).join('');
        return `
            <div class="wc-ai-phone-diary-open">
                <button type="button" class="wc-ai-phone-letter-back" onclick="closeWechatAiPhoneDiaryLetter()"><i class="ri-arrow-left-s-line"></i>信件</button>
                <div class="wc-ai-phone-open-envelope">
                    <div class="wc-ai-phone-envelope-flap"></div>
                    <article class="wc-ai-phone-letter-paper">
                        <div class="wc-ai-phone-letter-formal">
                            <p class="wc-ai-phone-letter-salutation">${wcEscapeHtml(letter.salutation)}</p>
                            <p class="wc-ai-phone-letter-greeting">${wcEscapeHtml(letter.greeting)}</p>
                            <div class="wc-ai-phone-letter-body">${bodyHtml}</div>
                            ${letter.closing ? `<p class="wc-ai-phone-letter-closing">${wcEscapeHtml(letter.closing)}</p>` : ''}
                            ${letter.wish ? `<p class="wc-ai-phone-letter-wish">${wcEscapeHtml(letter.wish)}</p>` : ''}
                            <p class="wc-ai-phone-letter-signature">${wcEscapeHtml(letter.signature)}</p>
                            <p class="wc-ai-phone-letter-date">${wcEscapeHtml(letter.date)}</p>
                        </div>
                    </article>
                </div>
            </div>
        `;
    }
    const featuredLetter = letters[0];
    return `
        <div class="wc-ai-phone-diary-mailbox">
            ${syncControls}
            <div class="wc-ai-phone-letter-hero">
                <span>${wcEscapeHtml(featuredLetter.meta)}</span>
                <strong>${wcEscapeHtml(featuredLetter.title)}</strong>
                ${featuredLetter.subtitle ? `<em>${wcEscapeHtml(featuredLetter.subtitle)}</em>` : ''}
            </div>
            <div class="wc-ai-phone-letter-list">
                ${letters.map((letter, index) => `
                    <button type="button" class="wc-ai-phone-letter-card card-${index}" onclick="openWechatAiPhoneDiaryLetter(${index})">
                        <span>${wcEscapeHtml(letter.meta)}</span>
                        <strong>${wcEscapeHtml(letter.title)}</strong>
                        ${letter.subtitle ? `<em>${wcEscapeHtml(letter.subtitle)}</em>` : ''}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

