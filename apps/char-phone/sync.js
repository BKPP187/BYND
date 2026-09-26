function getWechatAiPhoneAlarmRows(snapshot, char) {
    const schedule = getWechatAiPhoneScheduleRows(snapshot, char);
    return schedule.slice(0, 4).map(row => ({
        title: row.time || row.meta || '提醒',
        detail: row.title || row.detail || '日历提醒',
        meta: row.meta || '开启'
    }));
}

function getWechatAiPhoneAvatarHtml(src, fallbackText, className = '') {
    const safeSrc = src || DEFAULT_AVATAR;
    return `
        <div class="wc-ai-phone-mini-avatar ${className}">
            <img src="${wcEscapeHtml(safeSrc)}" onerror="this.replaceWith(document.createTextNode('${wcEscapeHtml(getWechatAiPhoneInitial(fallbackText))}'))">
        </div>
    `;
}

function mergeWechatAiPhoneRows(rows, fallback = [], limit = 8) {
    const primary = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (primary.length) return primary.slice(0, limit);
    return Array.isArray(fallback) ? fallback.filter(Boolean).slice(0, limit) : [];
}

function mergeWechatAiPhoneRawPatch(base, patch) {
    const source = base && typeof base === 'object' ? { ...base } : {};
    const data = (patch && patch.phoneData && typeof patch.phoneData === 'object' && patch.phoneData)
        || (patch && patch.aiPhone && typeof patch.aiPhone === 'object' && patch.aiPhone)
        || (patch && patch.iphone && typeof patch.iphone === 'object' && patch.iphone)
        || (patch && patch.data && typeof patch.data === 'object' && patch.data)
        || patch;
    if (!data || typeof data !== 'object') return source;
    Object.keys(data).forEach(key => {
        const value = data[key];
        if (Array.isArray(value)) {
            if (value.length) source[key] = value;
            return;
        }
        if (value && typeof value === 'object') {
            source[key] = { ...(source[key] && typeof source[key] === 'object' ? source[key] : {}), ...value };
            return;
        }
        if (String(value || '').trim()) source[key] = value;
    });
    return source;
}

function normalizeWechatAiPhoneSnapshot(raw, char) {
    const rawData = raw && typeof raw === 'object' ? raw : {};
    const data = (rawData.phoneData && typeof rawData.phoneData === 'object' && rawData.phoneData)
        || (rawData.aiPhone && typeof rawData.aiPhone === 'object' && rawData.aiPhone)
        || (rawData.iphone && typeof rawData.iphone === 'object' && rawData.iphone)
        || (rawData.data && typeof rawData.data === 'object' && rawData.data)
        || rawData;
    const fallback = buildWechatAiPhoneFallback(char);
    const explicitRemark = stripWechatPromptText(pickWechatAiPhoneField(data, ['userRemark', 'userAlias', 'userContactName', 'userNickname', 'savedName', 'remarkForUser', '用户备注', '用户通讯录备注', '给用户的备注']), 24);
    const userDisplayName = explicitRemark ? setWechatAiPhoneUserRemark(char, explicitRemark) : getWechatAiPhoneUserRemark(char);
    const realUserChat = buildWechatAiPhoneRealUserChatRow(char, userDisplayName);
    const reservedByndNames = new Set((window.myCharacters || [])
        .filter(item => item && item.id !== (char && char.id))
        .flatMap(item => [item.name, item.chatConfig && item.chatConfig.nickname])
        .filter(Boolean)
        .map(name => String(name).trim()));
    const normalizeChats = (value) => {
        const fallbackContacts = (Array.isArray(fallback.chats) ? fallback.chats.slice(1) : []).filter(Boolean);
        if (!Array.isArray(value)) return [realUserChat, ...fallbackContacts].slice(0, 5);
        const contacts = value.map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            return {
                name: stripWechatPromptText(item.name || item.with || item.contact || '', 32),
                text: stripWechatPromptText(item.text || item.lastMessage || item.message || '', 82),
                time: stripWechatPromptText(item.time || item.status || '', 16)
            };
        }).filter(item => (
            item
            && item.name
            && item.text
            && item.time
            && item.name !== userDisplayName
            && !/^(我|用户|user)$/i.test(item.name)
            && !reservedByndNames.has(item.name)
            && !isWechatAiPhonePlaceholderChatRow(item)
            && !shouldDropWechatAiPhoneRowForPersona(item, char)
        ));
        const list = [realUserChat, ...contacts, ...fallbackContacts].slice(0, 5);
        return list.length ? list : [realUserChat];
    };

    const chats = mergeWechatAiPhoneContinuityChats(
        normalizeChats(pickWechatAiPhoneField(data, ['chats', 'chatList', 'contacts', 'messages', 'wechatChats', 'imessages', '微信', '信息', '聊天列表', '通讯录'])),
        char
    );
    syncWechatAiPhoneGeneratedContactContinuity(char, chats);

    const browserRows = getWechatAiPhoneBrowserRows({ browser: pickWechatAiPhoneField(data, ['browser', 'browserHistory', 'safari', 'webHistory', 'searchHistory', 'recentSearches', '浏览器', '浏览记录', 'Safari']) }, char);
    const walletRows = getWechatAiPhoneWalletRows({ walletRecords: pickWechatAiPhoneField(data, ['walletRecords', 'bills', 'transactions', 'payments', 'cards', 'passes', '钱包记录', '账单', '交易记录', '卡包']) }, char);
    const footprintRows = normalizeWechatAiPhoneRecordList(pickWechatAiPhoneField(data, ['footprints', 'traces', 'locations', 'places', 'mapRecords', 'visitedPlaces', 'locationHistory', 'importantPlaces', '足迹', '地点记录', '位置记录', '重要地点', '去过的地方']), [], 6);
    const usageRows = normalizeWechatAiPhoneRecordList(pickWechatAiPhoneField(data, ['usageRecords', 'usage', 'appUsage', 'screenTime', 'appUsageRecords', '使用记录', '应用使用', '屏幕使用时间']), [], 10);
    const scheduleRows = getWechatAiPhoneScheduleRows({ scheduleRecords: pickWechatAiPhoneField(data, ['scheduleRecords', 'schedule', 'calendar', 'calendarEvents', 'itinerary', 'plans', 'appointments', 'agenda', '行程', '日程', '日历', '安排']) }, char);
    const shoppingRows = getWechatAiPhoneShoppingRows({ shoppingRecords: pickWechatAiPhoneField(data, ['shoppingRecords', 'shopping', 'orders', 'purchaseRecords', 'shoppingOrders', 'wishList', 'favorites', '购物', '购物记录', '订单', '购买记录', '收藏夹']) }, char);
    const takeoutRows = getWechatAiPhoneTakeoutRows({ takeoutRecords: pickWechatAiPhoneField(data, ['takeoutRecords', 'takeout', 'foodDelivery', 'deliveryRecords', 'mealOrders', 'drinkOrders', '外卖', '外卖记录', '点单', '饮品', '送餐记录']) }, char);
    const gameRows = getWechatAiPhoneGameRows({ gameRecords: pickWechatAiPhoneField(data, ['gameRecords', 'games', 'gameHistory', 'playedGames', 'Game Center', '游戏', '玩的游戏', '游戏记录']) }, char);
    const diaryLetterRows = getWechatAiPhoneDiaryLetters(data);
    const rawWallet = pickWechatAiPhoneField(data, ['wallet', 'walletSummary', 'balance', 'money', '钱包', '钱包概要', '余额']);
    const wallet = typeof rawWallet === 'string' ? cleanWechatAiPhoneWalletText(rawWallet) : '';

    return {
        ...normalizeCharPhoneApps(Array.isArray(data.installedApps) ? data : {...data, installedApps:char?.chatConfig?.aiPhoneSnapshot?.installedApps, appData:data.appData || char?.chatConfig?.aiPhoneSnapshot?.appData, deviceName:data.deviceName || char?.chatConfig?.aiPhoneSnapshot?.deviceName}, char?.chatConfig?.aiPhoneSnapshot || {}),
        updatedAt: Date.now(),
        schemaVersion: WECHAT_AI_PHONE_SCHEMA_VERSION,
        generatedBy: raw ? 'api' : 'local',
        userRemark: userDisplayName,
        chats,
        memos: normalizeWechatAiPhoneMemoList(pickWechatAiPhoneField(data, ['memos', 'memo', 'notes', 'reminders', '备忘录', '便签']), fallback.memos),
        browser: mergeWechatAiPhoneRows(browserRows, fallback.browser, 6),
        wallet,
        footprints: mergeWechatAiPhoneRows(footprintRows, fallback.footprints, 6),
        usageRecords: mergeWechatAiPhoneRows(usageRows, fallback.usageRecords, 10),
        walletRecords: mergeWechatAiPhoneRows(walletRows, fallback.walletRecords, 8),
        scheduleRecords: mergeWechatAiPhoneRows(scheduleRows, fallback.scheduleRecords, 6),
        shoppingRecords: mergeWechatAiPhoneRows(shoppingRows, fallback.shoppingRecords, 8),
        takeoutRecords: mergeWechatAiPhoneRows(takeoutRows, fallback.takeoutRecords, 8),
        gameRecords: mergeWechatAiPhoneRows(gameRows, fallback.gameRecords, 8),
        diary: stripWechatPromptText(pickWechatAiPhoneField(data, ['diary', 'journal', 'privateDiary', 'unsentDiary', '日记', '私密日记']) || fallback.diary, 260),
        diaryLetters: diaryLetterRows
    };
}

function getWechatAiPhoneSnapshotGapSummary(snapshot, { includeDiary = true } = {}) {
    if (!snapshot || typeof snapshot !== 'object') return '没有返回手机数据';
    const fieldApps = {memos:'memo',browser:'browser',walletRecords:'wallet',scheduleRecords:'schedule',shoppingRecords:'shopping',takeoutRecords:'takeout',footprints:'footprints',usageRecords:'usage',diaryLetters:'diary'};
    const selected = Array.isArray(snapshot.installedApps) ? snapshot.installedApps : null;
    const required = [
        ['memos', '备忘录'],
        ['browser', '浏览器'],
        ['walletRecords', '钱包记录'],
        ['scheduleRecords', '行程'],
        ['shoppingRecords', '购物'],
        ['takeoutRecords', '外卖'],
        ['footprints', '足迹'],
        ['usageRecords', '使用记录'],
        ['diaryLetters', '日记信件', 2]
    ].filter(([key]) => (includeDiary || key !== 'diaryLetters') && (!selected || selected.includes(fieldApps[key])));
    const missing = required
        .filter(([key, , minCount = 1]) => !Array.isArray(snapshot[key]) || snapshot[key].length < minCount)
        .map(([, label, minCount = 1]) => minCount > 1 ? `${label}（需 ${minCount} 封完整信件）` : label);
    if ((!selected || selected.includes('wallet')) && !formatWechatAiPhoneMoneyText(snapshot.wallet)) missing.push('钱包余额');
    for (const key of snapshot.appSyncMissing || []) missing.push(getWechatAiPhoneAllApps().find(app=>app.key===key)?.label || key);
    if (selected && !missing.length) return '';
    const totalRows = required.reduce((sum, [key]) => sum + (Array.isArray(snapshot[key]) ? snapshot[key].length : 0), 0);
    const diary = stripWechatPromptText(snapshot.diary, 80);
    if (!missing.length && totalRows >= (includeDiary ? 12 : 10) && diary) return '';
    return `缺少：${missing.join('、') || '内容过少'}；总记录 ${totalRows} 条${diary ? '' : '；日记为空'}`;
}

function isWechatAiPhoneSparseSnapshot(snapshot) {
    return !!getWechatAiPhoneSnapshotGapSummary(snapshot);
}

function getWechatAiPhoneRenderSnapshot(char) {
    const snapshot = char && char.chatConfig && char.chatConfig.aiPhoneSnapshot;
    if (
        snapshot
        && snapshot.schemaVersion === WECHAT_AI_PHONE_SCHEMA_VERSION
        && (snapshot.generatedBy === 'api' || snapshot.generatedBy === 'error')
    ) {
        return withWechatAiPhoneRealUserChat(snapshot, char);
    }
    return buildWechatAiPhoneFallback(char);
}

function getWechatAiPhoneReusableSnapshot(char, refreshUserChat = true) {
    const snapshot = char && char.chatConfig && char.chatConfig.aiPhoneSnapshot;
    if (!snapshot || snapshot.schemaVersion !== WECHAT_AI_PHONE_SCHEMA_VERSION) return null;
    if (snapshot.generatedBy !== 'api' && snapshot.generatedBy !== 'error') return null;
    return refreshUserChat ? withWechatAiPhoneRealUserChat({ ...snapshot }, char) : { ...snapshot };
}

function buildWechatAiPhoneErrorSnapshot(char, errorText, previousSnapshot = null) {
    const snapshot = previousSnapshot
        ? withWechatAiPhoneRealUserChat({ ...previousSnapshot }, char)
        : buildWechatAiPhoneFallback(char);
    snapshot.schemaVersion = WECHAT_AI_PHONE_SCHEMA_VERSION;
    snapshot.generatedBy = 'error';
    snapshot.syncError = stripWechatPromptText(errorText || 'AI 小手机同步失败', 260);
    snapshot.syncFailedAt = Date.now();
    return snapshot;
}

function getWechatAiPhoneSyncTurn(char) {
    const history = Array.isArray(char?.history) ? char.history : [];
    let replied = false;
    let repliedAt = 0;
    for (let index = history.length - 1; index >= 0; index -= 1) {
        const msg = history[index];
        if (isChatApiInternalHistoryMessage(msg) || msg.type === 'user_event') continue;
        if (isChatApiVisibleUserHistoryMessage(msg)) {
            if (!replied) return null;
            const timestamp = msg.timestamp || msg.createdAt || msg.time || '';
            return {
                key: JSON.stringify([msg.id || '', timestamp, msg.id || timestamp ? '' : index]),
                repliedAt
            };
        }
        if (msg.isMe === false && !msg.apiError && !/^\u26a0\ufe0f?\s/.test(String(msg.content || ''))) {
            replied = true;
            repliedAt = getChatApiMessageTimestamp(msg);
        }
    }
    return null;
}

function shouldAutoSyncWechatAiPhone(char, turn = getWechatAiPhoneSyncTurn(char)) {
    if (!turn) return false;
    const snapshot = char?.chatConfig?.aiPhoneSnapshot;
    if (snapshot?.syncTurnKey === turn.key) return false;
    if (snapshot && Object.prototype.hasOwnProperty.call(snapshot, 'syncTurnKey')) return true;
    if (!getWechatAiPhoneReusableSnapshot(char)) return true;
    // Existing saved phones already include replies made before their last sync.
    const syncedAt = Math.max(Number(snapshot.updatedAt) || 0, Number(snapshot.syncFailedAt) || 0);
    return turn.repliedAt > 0 && turn.repliedAt > syncedAt;
}

function scheduleWechatAiPhoneSyncAfterStatus(char) {
    if (!char || !char.id) return;
    window._wechatAiPhoneDeferredSyncTimers = window._wechatAiPhoneDeferredSyncTimers || new Map();
    const existing = window._wechatAiPhoneDeferredSyncTimers.get(char.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
        window._wechatAiPhoneDeferredSyncTimers.delete(char.id);
        if (window._wechatAiPhoneOpenCharId !== char.id) return;
        requestWechatAiPhoneSnapshot(char).catch(error => console.warn('deferred ai phone sync failed:', error));
    }, 1200);
    window._wechatAiPhoneDeferredSyncTimers.set(char.id, timer);
}

// Missing letters are written by a separate, later diary request instead of in
// the phone sync's own burst. Failed diaries retry on their own backoff and stop
// after a few automatic attempts; 同步日记 stays available at any time.
const WECHAT_AI_PHONE_DIARY_RETRY_MS = 10 * 60 * 1000;
const WECHAT_AI_PHONE_DIARY_AUTO_ATTEMPTS = 3;
function isWechatAiPhoneDiaryFollowUpDue(char) {
    const snapshot = char?.chatConfig?.aiPhoneSnapshot;
    if (!snapshot || snapshot.generatedBy !== 'api' || snapshot.schemaVersion !== WECHAT_AI_PHONE_SCHEMA_VERSION) return false;
    if (getWechatAiPhoneDiaryLetters(snapshot).length >= 2) return false;
    const attempts = Number(snapshot.diarySyncAttempts) || 0;
    if (attempts >= WECHAT_AI_PHONE_DIARY_AUTO_ATTEMPTS) return false;
    const failedAt = Number(snapshot.diarySyncFailedAt) || 0;
    return !failedAt || Date.now() - failedAt >= WECHAT_AI_PHONE_DIARY_RETRY_MS * Math.max(1, attempts);
}

function scheduleWechatAiPhoneDiaryFollowUp(char) {
    if (!char || !char.id || !isWechatAiPhoneDiaryFollowUpDue(char)) return;
    window._wechatAiPhoneDiaryFollowUpTimers = window._wechatAiPhoneDiaryFollowUpTimers || new Map();
    if (window._wechatAiPhoneDiaryFollowUpTimers.has(char.id)) return;
    const timer = setTimeout(() => {
        window._wechatAiPhoneDiaryFollowUpTimers.delete(char.id);
        if (window._wechatAiPhoneOpenCharId !== char.id || !isWechatAiPhoneDiaryFollowUpDue(char)) return;
        requestWechatAiPhoneSnapshot(char, { diaryOnly: true, followUp: true }).catch(error => console.warn('deferred ai phone diary failed:', error));
    }, 1500);
    window._wechatAiPhoneDiaryFollowUpTimers.set(char.id, timer);
}

function buildWechatAiPhoneDiaryFailureSnapshot(snapshot, error, previousSnapshot = snapshot) {
    const freshLetters = normalizeWechatAiPhoneDiaryLetterList([
        ...getWechatAiPhoneDiaryLetters(error && error.diaryLetters),
        ...(snapshot !== previousSnapshot ? getWechatAiPhoneDiaryLetters(snapshot) : [])
    ]);
    const savedLetters = getWechatAiPhoneDiaryLetters(previousSnapshot);
    const result = {
        ...snapshot,
        diaryLetters: normalizeWechatAiPhoneDiaryLetterList([...freshLetters, ...savedLetters]),
        diarySyncError: stripWechatPromptText(error?.message || error || '日记同步失败，请重试。', 260),
        diarySyncFailedAt: Date.now(),
        diarySyncAttempts: (Number(previousSnapshot?.diarySyncAttempts) || 0) + 1
    };
    if (freshLetters.length) result.diaryUpdatedAt = Date.now();
    else if (savedLetters.length) result.diaryUpdatedAt = previousSnapshot.diaryUpdatedAt || previousSnapshot.updatedAt;
    if (error && error.diarySyncDiagnostics) result.diarySyncDiagnostics = error.diarySyncDiagnostics;
    else delete result.diarySyncDiagnostics;
    return result;
}

// Every phone request goes through the background queue (quiet gap between calls); manual work only jumps ahead in it.
async function requestWechatAiPhoneDiaryLetters(char, contextMessage, manual = false, initialLetters = []) {
    let collected = normalizeWechatAiPhoneDiaryLetterList(initialLetters);
    const responses = [];
    const failure = message => {
        const error = new Error(message);
        error.diaryLetters = collected;
        error.diarySyncDiagnostics = { responses };
        return error;
    };
    const messages = [
        {
            role: 'system',
            content: `你是「${char.name}」写给 user 的书信作者。只生成这个角色小手机日记里的两封正式中文书信，不生成其他手机应用数据。只返回可 JSON.parse 的对象 {"diaryLetters":[...]}，不要 Markdown、分析或解释。
每封信完整返回 title、subtitle、meta、salutation、greeting、body、closing、wish、signature、date 十个非空字符串。title/subtitle/meta 要针对本封内容原创，不能使用“日记、草稿、便签、未寄出的信、未命名信件、一封信”等通用标题，不能出现品牌或占位文字。title 是书信信题：用 2-20 个字写成含具体意象、事件或心绪的短语，像“灯下的旧约”“雨声抵窗”“归途有信”，但必须按本封内容原创；禁止“关于……”“……病理分析”“……隐性条款”“问题分析”“情况说明”“工作汇报”等论文、报告或说明书式标题。subtitle 只作一行细小的情境提示，不能复述标题或写成分类标签。
如果后续指出缺项并要求补写，只返回尚缺少的信件；不要重复已生成的完整信件。
salutation 只写收信称呼；greeting 单独问候。body 用“我”对“你”写 120-260 字、2-4 段，在 JSON 字符串中用 \\n 分段。结合角色身份、世界书、记忆、关系和真实聊天中的具体话题，不能复制状态、写旁白、套模板或替 user 编造说过的话。没有可引用的聊天事实时，只写角色自己基于人设和关系想表达的内容。
closing 与 wish 分别写祝颂语和祝愿，signature 写符合角色身份的署名，date 写 YYYY年M月D日。保留完整正文、称呼、问候、祝颂、署名和日期，不得返回字段碎片或固定兜底信件。`
        },
        contextMessage
    ];
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await callChatApi(messages, { max_tokens: 4096, temperature: attempt ? 0.5 : 0.72, background: true, backgroundPriority: manual ? 5 : 0, force: !!manual, skipStatusValidationRetry: true, usageFeature: 'charPhone', usageChar: char });
        if (!result?.ok) throw failure(result?.error || '日记接口未返回内容，请稍后重试。');
        const report = {};
        const letters = getWechatAiPhoneDiaryLetters(result.content, report);
        responses.push({
            candidateCount: report.candidateCount,
            acceptedCount: letters.length,
            issues: report.issues.slice(0, 4),
            content: String(result.content || '').slice(0, 6000)
        });
        if (letters.length >= 2) return letters;
        collected = normalizeWechatAiPhoneDiaryLetterList([...collected, ...letters]);
        if (collected.length >= 2) return collected;
        const reason = report.candidateCount
            ? '已收到 ' + collected.length + ' 封完整信件。' + (report.issues.slice(0, 2).join('；') || '还缺少另一封完整信件') + '。'
            : '返回内容中未找到可读取的信件 JSON。';
        if (attempt) throw failure('日记未能完整生成：' + reason + '请重新同步日记。');
        messages.push({ role: 'assistant', content: String(result.content || '').slice(0, 12000) });
        messages.push({ role: 'user', content: reason + '请补齐剩余 ' + (2 - collected.length) + ' 封完整信件，只输出 {"diaryLetters":[...]}。修复上面指出的具体缺项，保留完整正文、称呼、问候、祝颂、署名和日期；不要重复已完整的信件或返回其他应用内容。' });
    }
}

async function requestWechatAiPhoneSnapshot(charOrId, options = {}) {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    if (!char) return null;
    char.chatConfig = char.chatConfig || {};
    const previousSnapshot = getWechatAiPhoneReusableSnapshot(char, !options.diaryOnly);
    if (!options.force && typeof getWechatAgentPreferences === 'function' && !getWechatAgentPreferences(char).allowPhone) return previousSnapshot || getWechatAiPhoneRenderSnapshot(char);
    const savedDiaryLetters = getWechatAiPhoneDiaryLetters(previousSnapshot);
    // Reading an existing diary must not rewrite it when other phone data refreshes.
    // Only a complete mailbox (two letters) is preserved; a failed or partial diary
    // is still requested again instead of being frozen by its error marker.
    const preserveDiary = !options.diaryOnly && savedDiaryLetters.length >= 2;
    const keepSavedDiary = preserveDiary || !!options.patchOnly;
    const manual = !!options.force;
    const phoneApiOptions = { max_tokens: 8192, background: true, backgroundPriority: manual ? 5 : 0, force: manual, usageFeature: 'charPhone', usageChar: char };
    const buildFailureSnapshot = error => options.diaryOnly ? {
        ...buildWechatAiPhoneDiaryFailureSnapshot(previousSnapshot || buildWechatAiPhoneFallback(char), error, previousSnapshot),
        generatedBy: previousSnapshot?.generatedBy || 'error'
    } : options.patchOnly && previousSnapshot ? {
        ...previousSnapshot,
        generatedBy: 'error',
        syncError: stripWechatPromptText('补全失败：' + (error?.message || error || '请稍后重试'), 260),
        syncRecovered: stripWechatPromptText('补全未完成：' + (error?.message || error || '请稍后重试'), 260)
    } : buildWechatAiPhoneErrorSnapshot(char, error?.message || error, previousSnapshot);
    window._wechatAiPhoneGenerating = window._wechatAiPhoneGenerating || new Map();
    if (window._wechatAiPhoneGenerating.has(char.id)) return window._wechatAiPhoneGenerating.get(char.id);
    const syncTurn = getWechatAiPhoneSyncTurn(char);
    if (!options.force && !options.followUp && !shouldAutoSyncWechatAiPhone(char, syncTurn)) {
        return previousSnapshot || getWechatAiPhoneRenderSnapshot(char);
    }
    if (!options.force && (isWechatAiRateLimitPaused() || isWechatBackgroundApiPaused())) {
        return previousSnapshot || getWechatAiPhoneRenderSnapshot(char);
    }
    if (!options.force && (window._wechatAiBusy || isWechatAiStatusGenerationActive())) {
        if (options.followUp) scheduleWechatAiPhoneDiaryFollowUp(char);
        else scheduleWechatAiPhoneSyncAfterStatus(char);
        return previousSnapshot || getWechatAiPhoneRenderSnapshot(char);
    }
    const deferredTimer = window._wechatAiPhoneDeferredSyncTimers && window._wechatAiPhoneDeferredSyncTimers.get(char.id);
    if (deferredTimer) {
        clearTimeout(deferredTimer);
        window._wechatAiPhoneDeferredSyncTimers.delete(char.id);
    }
    delete char.chatConfig.aiPhoneUsageLog;

    const promise = Promise.resolve().then(async () => {
        const activity = typeof beginWechatToolActivity === 'function' ? beginWechatToolActivity(char, 'phone', options.diaryOnly ? '更新日记' : '更新小手机') : null;
        let snapshot = buildWechatAiPhoneFallback(char);
        let syncStage = '保存同步记录';
        try {
            // Persist the attempted turn before using API quota, including failed
            // syncs. Capture this turn now so a newer reply is not consumed later.
            char.chatConfig.aiPhoneSnapshot = {
                ...(previousSnapshot || snapshot),
                ...(options.diaryOnly || options.patchOnly ? {} : { syncTurnKey: syncTurn?.key || '' })
            };
            if (await saveCharactersToStorage() === false) {
                throw new Error('同步记录未能保存，本次未请求 API。请检查存储后手动重试。');
            }
            syncStage = '生成手机数据';
            const status = getWechatAiStatusSnapshot(char) || { fields: {} };
            const identityAnchor = typeof buildWechatIdentityContextPrompt === 'function'
                ? buildWechatIdentityContextPrompt(char, (typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : {}))
                : '';
            const worldBookAnchor = buildWechatWorldBookPrompt(char, 18);
            const memoryAnchor = typeof buildWechatMemoryPrompt === 'function' ? buildWechatMemoryPrompt(char) : '';
            const presetAnchor = typeof buildWechatPresetPromptForStatus === 'function' ? buildWechatPresetPromptForStatus(char) : '';
            const personaText = getWechatCharacterPersonaText(char, 7000);
            const contextText = [
                stripWechatPromptText(identityAnchor, 1800),
                personaText,
                stripWechatPromptText(worldBookAnchor, 2400),
                stripWechatPromptText(presetAnchor, 900),
                stripWechatPromptText(memoryAnchor, 1200)
            ].filter(Boolean).join('\n\n');
            const statusText = JSON.stringify(status.fields || {});
            const historyText = buildWechatRecentHistoryForPrompt(char, 14);
            const proxyContinuityText = buildWechatAiPhoneProxyContinuityContext(char);
            const today = new Date();
            const buildMessages = (extraRule = '') => [
                {
                    role: 'system',
                    content: `你是「${char.name}」本人手机的数据生成器。读角色卡/世界书/记忆后，按这个角色真实生活合理生成 iPhone 数据。只返回一个可 JSON.parse 的压缩 JSON 对象；不要 Markdown、不要解释、不要换行排版、不要省略号。
基础字段：userRemark,chats,memos,browser,wallet,walletRecords,footprints,usageRecords,scheduleRecords,shoppingRecords,takeoutRecords,gameRecords,diary${preserveDiary ? '' : ',diaryLetters'}。所有业务内容都必须由你依据当前角色资料生成；前端不会用固定角色模板补齐任何缺项。
wallet 必须是字符串且包含具体余额/可用额度数字，不要返回对象；格式示例："零钱 ¥328.60 · 工资卡可用额度 ¥12000 · 日常消费正常"。
数组格式：chats[{name,text,time}]；memos[{title,content,meta}]；browser/walletRecords/footprints/usageRecords/shoppingRecords/takeoutRecords/gameRecords[{title,detail,meta}]；scheduleRecords[{time,title,meta}]${preserveDiary ? '' : '；diaryLetters[{title,subtitle,meta,salutation,greeting,body,closing,wish,signature,date}]'}。walletRecords.meta 必须写具体金额，例如 "-25.00"、"+8000.00" 或 "¥128.50"。
数量：除 gameRecords 外，每个数组 2-3 条；chats 只写 char 手机里除 user 以外的其他联系人/NPC，禁止包含 user/用户/用户备注，也禁止替 user 生成聊天内容；系统会用真实聊天历史自动插入 user 那一条。chats.name 必须是明确联系人身份或姓名，禁止写“联系人/好友/朋友/NPC/工作联系人”；chats.text 禁止写“最近一条未读消息/有一条新消息/聊天/消息”等占位文案。${preserveDiary ? '' : 'diaryLetters 2 条。'}memos.content 30-90 字；diary 30-90 字；${preserveDiary ? '' : 'diaryLetters.body 必须分为 2-4 段、总长 120-260 字；'}其他字符串 8-38 字。
如果【小手机代发连续性】不为空，chats 优先保留其中 1-2 个联系人/NPC，并自然续写他们在 char 手机里的下一条聊天预览。NPC 可以察觉语气变化、追问、误会、接受、顺着办理、谨慎确认或觉得不像本人，但必须按联系人身份、上下文、关系和语气灵活变化；不要每次固定说“不像你发的”。
gameRecords 只能写这个 char 自己按人设、世界书、职业、年龄、生活方式会玩的游戏；禁止复制用户手机/桌面/BYND 小游戏库里的游戏，也不要因为用户手机里有某个游戏就让 char 玩。若角色人设明显不玩游戏，gameRecords 可以为空数组。
【状态】只可作为时间/地点/最近上下文的参考；memos、scheduleRecords${preserveDiary ? '' : '、diaryLetters'} 禁止直接复制状态栏字段、innerMonologue、thoughts、action、miniDiary 原文，也不要写成情绪独白。
memos 是 char 认为重要、需要自己记住或回头处理的事情；必须来自角色卡/世界书/长期记忆/最近聊天的推演，例如承诺、禁忌、任务、关系要点、职业待办。不要把状态栏、身体动作、当前心情搬进备忘录。
scheduleRecords 必须按 char 的人设世界推演：身份/职业/阶层、时代或世界规则、当天责任、当前剧情、与 user 的关系都要影响行程。现代角色写真实日历；古风/异能/末世/架空角色也要把小手机视为 BYND 映射界面，行程内容仍遵守其世界逻辑。禁止套“整理灵感/创作录制/私密日记”等模板，除非角色资料明确支持。
${preserveDiary ? '日记信件已经保存，由系统原样保留。本次只更新其他手机数据，不要返回 diaryLetters，也不要重写、补写或替换已保存的信件。' : `diaryLetters 必须是 char 第一人称正式写给 user 的中文书信，不是日记、草稿、内心独白、状态复述或旁白。每封都必须由 AI 原创并完整返回 title、subtitle、meta、salutation、greeting、body、closing、wish、signature、date 十个非空字段，缺一不可；不得依赖系统补默认值。title 是结合角色身份、世界规则、关系阶段、近期事件和当天安排生成的独特信题；subtitle 是本封信独有的副题；meta 是本封信独有的简短信封信息。title/subtitle/meta 禁止使用通用模板、占位、品牌字样或 Letter From、For、Saved by、PRIVATE、BYND、FOURTEEN。salutation 只能写收信称呼，必须顶格并以中文全角冒号结尾；greeting 必须另起一段，不能与称呼合并。body 必须至少两段，在 JSON 字符串中用 \n 分隔，总长 120-260 字；必须自然结合【角色资料/世界书】中的具体身份、经历或世界规则、char 与 user 的真实关系，以及【最近聊天】里确实出现的具体话题、约定或事件。只能引用真实聊天，不得虚构、改写或替 user 补说过的话；若最近聊天没有可用事实，就明确立足角色资料、长期记忆和当前关系写角色自己的内容。正文必须用“我”对“你”写，禁止第三视角、模板段落、空泛占位、万能情话、固定套话、状态栏/innerMonologue/thoughts/action/miniDiary 复制，也不能出现“根据角色卡”“结合世界书”“最近真实聊天”等生成说明。closing 与 wish 必须分别独立成行并构成规范祝颂；signature 必须是符合角色身份的真实署名；date 必须是 YYYY年M月D日 的完整中文日期并单独成行。严禁“${char.name}希望/他把/她觉得/TA会/这个角色想”等旁白句式。禁止使用“没有发出去的话/夜里的草稿/折起来的便签/未寄出的信/私密日记/日记/草稿/便签/未命名信件”等通用信题。`}
规则：不能空白；不能写未授权查看；不能套模板或固定低余额；不能复制用户手机/桌面/应用使用记录；所有字段必须是 char 自己手机里的数据。必须从【角色资料】里提取这个 char 的真实身份、职业、经济水平、世界观、关系网和说话风格，再定制生成。副市长/公务员/政务角色要写政务会议、规划院/文旅/民生/调研/上会/公文/舆情等痕迹，禁止写成偶像妆发舞台粉丝营业；只有角色资料明确是偶像/艺人时才写经纪、妆造、舞台、粉丝运营、品牌/录音/拍摄。没有明写手机记录也要基于人设合理创作。userRemark 是角色在自己手机里给用户存的备注，不是用户设置里的称呼。严禁根据【最近聊天】改写、续写、概括成 user 没说过的新句子；user 聊天预览只能由系统真实聊天记录生成。${charPhoneCatalogPrompt()}${extraRule ? `\n修正：${extraRule}` : ''}`
                },
                {
                    role: 'user',
                    content: `【当前日期】${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日\n【角色资料】${contextText || String(char.description || '').slice(0, 5000)}\n【状态】${statusText}\n【最近聊天】${historyText}\n【小手机代发连续性】${proxyContinuityText || '暂无'}`
                }
            ];
            if (options.diaryOnly) {
                snapshot = {
                    ...(previousSnapshot || snapshot),
                    generatedBy: previousSnapshot?.generatedBy || 'api',
                    diaryLetters: await requestWechatAiPhoneDiaryLetters(char, buildMessages()[1], manual, options.followUp ? savedDiaryLetters : []),
                    diaryUpdatedAt: Date.now()
                };
                delete snapshot.diarySyncError;
                delete snapshot.diarySyncFailedAt;
                delete snapshot.diarySyncAttempts;
                delete snapshot.diarySyncDiagnostics;
                if (!getWechatAiPhoneSnapshotGapSummary(snapshot)) delete snapshot.syncRecovered;
            } else if (options.patchOnly) {
                // User-triggered 补全: one request for the fields the last sync left short.
                const base = previousSnapshot || snapshot;
                const gap = getWechatAiPhoneSnapshotGapSummary(base, { includeDiary: false });
                snapshot = { ...base };
                if (gap) {
                    const patch = await callChatApi(buildMessages(`缺项：${gap}。只返回缺少/空白字段的 JSON patch，按同一个 char 的人设、世界书、关系和最近真实聊天定制补齐；不要重写已有完整字段，不要套模板。本次不要生成 diaryLetters。`), { ...phoneApiOptions, max_tokens: 2400, temperature: 0.62 });
                    if (!patch || !patch.ok) throw new Error(patch && patch.error || '补全请求失败');
                    const patchParsed = parseWechatJsonObject(patch.content);
                    if (!patchParsed) throw new Error('AI 返回的补全内容无法解析。');
                    snapshot = { ...base, ...normalizeWechatAiPhoneSnapshot(mergeWechatAiPhoneRawPatch(base, patchParsed), char) };
                }
                snapshot.diaryLetters = savedDiaryLetters;
                for (const key of ['diaryUpdatedAt', 'diarySyncError', 'diarySyncFailedAt', 'diarySyncAttempts', 'diarySyncDiagnostics', 'syncTurnKey']) {
                    if (Object.prototype.hasOwnProperty.call(base, key)) snapshot[key] = base[key];
                }
                const remaining = getWechatAiPhoneSnapshotGapSummary(snapshot, { includeDiary: false });
                if (remaining) snapshot.syncRecovered = `AI 已按角色资料生成，仍有部分字段偏少：${remaining}`;
                else delete snapshot.syncRecovered;
            } else {
                // At most the main request plus one repair (empty-body retry or JSON
                // repair) per sync; everything else is deferred or user-triggered.
                let result = await callChatApi(buildMessages(), { ...phoneApiOptions, temperature: 0.78 });
                let repairUsed = false;
                if ((!result || !result.ok) && /空内容/.test(String(result && result.error || ''))) {
                    repairUsed = true;
                    result = await callChatApi(
                        buildMessages('上一次响应没有 JSON 正文。现在必须直接输出一个 minified JSON 对象，禁止 thinking、reasoning、分析、解释、Markdown。每组数组最多 2 条；' + (preserveDiary ? '不要返回 diaryLetters。' : '非信件字符串可以更短，但 diaryLetters 仍须返回 2 封各含十个字段、正文至少两段的完整正式书信。')),
                        { ...phoneApiOptions, temperature: 0.42 }
                    );
                }
                if (result && result.ok) {
                    let parsed = parseWechatJsonObject(result.content);
                    let rawJsonText = result.content || '';
                    let repairError = '';
                    if (!parsed && !repairUsed) {
                        const repair = await callChatApi([
                            {
                                role: 'system',
                                content: '你是 JSON 修复器。只把用户给你的残缺/多余说明/尾逗号/少括号 JSON 修成一个合法 JSON 对象；不要新增解释，不要 Markdown，不要重写内容。'
                            },
                            {
                                role: 'user',
                                content: String(rawJsonText || '').slice(0, 32000)
                            }
                        ], { ...phoneApiOptions, temperature: 0 });
                        if (!repair?.ok) repairError = repair?.error || '修复请求未成功';
                        if (repair && repair.ok) {
                            rawJsonText = repair.content || rawJsonText;
                            parsed = parseWechatJsonObject(repair.content);
                        }
                    }
                    if (parsed) {
                        syncStage = '整理模型返回的数据';
                        snapshot = normalizeWechatAiPhoneSnapshot(parsed, char);
                        const freshLetters = getWechatAiPhoneDiaryLetters(snapshot);
                        if (preserveDiary || freshLetters.length < 2) {
                            // Keep the saved mailbox (plus any complete letter this reply
                            // brought); missing letters are requested later on their own.
                            snapshot.diaryLetters = preserveDiary ? savedDiaryLetters : normalizeWechatAiPhoneDiaryLetterList([...freshLetters, ...savedDiaryLetters]);
                            for (const key of ['diaryUpdatedAt', 'diarySyncError', 'diarySyncFailedAt', 'diarySyncAttempts', 'diarySyncDiagnostics']) {
                                if (previousSnapshot && Object.prototype.hasOwnProperty.call(previousSnapshot, key)) snapshot[key] = previousSnapshot[key];
                            }
                            if (!preserveDiary && snapshot.diaryLetters.length >= 2) {
                                snapshot.diaryUpdatedAt = Date.now();
                                for (const key of ['diarySyncError', 'diarySyncFailedAt', 'diarySyncAttempts', 'diarySyncDiagnostics']) delete snapshot[key];
                            }
                        } else {
                            snapshot.diaryUpdatedAt = Date.now();
                        }
                        const finalGap = getWechatAiPhoneSnapshotGapSummary(snapshot, { includeDiary: false });
                        if (finalGap) {
                            snapshot.generatedBy = 'api';
                            snapshot.syncRecovered = `AI 已按角色资料生成，仍有部分字段偏少：${finalGap}`;
                        }
                    } else {
                        snapshot = buildFailureSnapshot(repairError ? `JSON 修复请求失败：${repairError}；已保留原有手机内容。` : 'JSON 解析失败：模型返回内容不完整或格式错误，修复后仍无法解析。已保留原有手机内容。');
                        console.warn('ai phone json parse failed:', rawJsonText);
                    }
                } else {
                    snapshot = buildFailureSnapshot(result && result.error ? result.error : 'AI 小手机同步失败');
                }
            }
        } catch (e) {
            console.warn('request ai phone failed:', e);
            const failure = e instanceof Error ? e : new Error(String(e || '未知错误'));
            failure.message = `${syncStage}失败：${failure.message}`;
            snapshot = buildFailureSnapshot(failure);
        }
        if (!options.force && typeof getWechatAgentPreferences === 'function' && !getWechatAgentPreferences(char).allowPhone) {
            if (previousSnapshot) char.chatConfig.aiPhoneSnapshot = previousSnapshot; else delete char.chatConfig.aiPhoneSnapshot;
            if (activity) await finishWechatToolActivity(char, activity, false, '自动更新权限已关闭，保留原有内容');
            return previousSnapshot;
        }
        const keepsTurn = options.diaryOnly || options.patchOnly;
        if (!keepsTurn) snapshot.syncTurnKey = syncTurn?.key || '';
        char.chatConfig.aiPhoneSnapshot = snapshot;
        try {
            if (await saveCharactersToStorage() === false) throw new Error('小手机内容未能保存，请检查存储后手动重试。');
        } catch (error) {
            snapshot = buildFailureSnapshot(error.message || '小手机内容保存失败');
            if (!keepsTurn) snapshot.syncTurnKey = syncTurn?.key || '';
            char.chatConfig.aiPhoneSnapshot = snapshot;
        }
        if (activity) await finishWechatToolActivity(char, activity, snapshot.generatedBy !== 'error' && !snapshot.diarySyncError, snapshot.syncError || snapshot.diarySyncError || (snapshot.syncRecovered ? '已更新，部分内容不完整，可在小手机中查看' : options.diaryOnly ? '日记已保存' : '小手机内容已保存'));
        if (window._wechatAiPhoneOpenCharId === char.id) {
            renderWechatAiPhone(char);
            if (options.force && !options.diaryOnly && snapshot.generatedBy === 'error' && snapshot.syncError) {
                setTimeout(() => openWechatAiPhoneErrorPrompt(char.id, snapshot.syncError), 0);
            }
        }
        return snapshot;
    });

    window._wechatAiPhoneGenerating.set(char.id, promise);
    if (options.diaryOnly || (!preserveDiary && !options.patchOnly)) {
        window._wechatAiPhoneDiaryGenerating = window._wechatAiPhoneDiaryGenerating || new Set();
        window._wechatAiPhoneDiaryGenerating.add(char.id);
    }
    if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
    try {
        return await promise;
    } finally {
        window._wechatAiPhoneGenerating.delete(char.id);
        window._wechatAiPhoneDiaryGenerating?.delete(char.id);
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
        if (!options.diaryOnly && !options.patchOnly) scheduleWechatAiPhoneDiaryFollowUp(char);
    }
}

function openWechatAiPhone(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    window._wechatAiPhoneOpenCharId = charId;
    window._wechatAiPhoneTab = 'home';
    window._wechatAiPhoneChatIndex = 0;
    window._wechatAiPhoneMemoIndex = -1;
    window._wechatAiPhoneBrowserIndex = -1;
    let modal = document.getElementById('wc-ai-phone-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-ai-phone-overlay';
        modal.className = 'wc-ai-phone-overlay';
        modal.setAttribute('onclick', 'if(event.target===this) closeWechatAiPhone()');
        getWechatModalRoot().appendChild(modal);
    }
    renderWechatAiPhone(char);
    if (shouldAutoSyncWechatAiPhone(char)) {
        requestWechatAiPhoneSnapshot(char).catch(e => console.warn('ai phone open failed:', e));
    } else {
        scheduleWechatAiPhoneDiaryFollowUp(char);
    }
}

function regenerateWechatAiPhoneSnapshot(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    requestWechatAiPhoneSnapshot(char, { force: true }).catch(e => console.warn('ai phone manual generate failed:', e));
    renderWechatAiPhone(char);
}
window.regenerateWechatAiPhoneSnapshot = regenerateWechatAiPhoneSnapshot;

// 补全: the missing-field patch runs only when the user asks for it.
function completeWechatAiPhoneSnapshot(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return Promise.resolve(null);
    const pending = requestWechatAiPhoneSnapshot(char, { force: true, patchOnly: true }).catch(e => console.warn('ai phone patch failed:', e));
    renderWechatAiPhone(char);
    return pending;
}
window.completeWechatAiPhoneSnapshot = completeWechatAiPhoneSnapshot;

function regenerateWechatAiPhoneDiary(charId) {
    return requestWechatAiPhoneSnapshot(charId, { force: true, diaryOnly: true }).catch(error => {
        console.warn('ai phone diary sync failed:', error);
        if (typeof showWechatToast === 'function') showWechatToast(error?.message || '日记同步失败，请重试');
    });
}

function getWechatAiPhoneSyncErrorText(charId, fallback = '') {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const snapshot = char && char.chatConfig && char.chatConfig.aiPhoneSnapshot;
    return stripWechatPromptText(fallback || snapshot && snapshot.syncError || '小手机同步失败，请稍后再试。', 260);
}

function getWechatAiPhoneFriendlyErrorText(errorText) {
    const text = String(errorText || '').trim();
    if (/空内容/.test(text)) return 'AI 这次没有返回可用内容，可能是接口、模型或代理响应为空。可以点重新同步再试一次。';
    if (/429|rate limit|请求太频繁|too many requests/i.test(text)) return '接口请求太频繁，自动请求已经短暂停止。等几分钟后再重新同步会更稳。';
    return text || '同步时遇到了一点问题，请稍后再试。';
}

function closeWechatAiPhoneErrorPrompt() {
    document.getElementById('wc-ai-phone-error-modal')?.remove();
}
window.closeWechatAiPhoneErrorPrompt = closeWechatAiPhoneErrorPrompt;

function retryWechatAiPhoneFromErrorPrompt() {
    const modal = document.getElementById('wc-ai-phone-error-modal');
    const charId = modal && modal.dataset.charId || window._wechatAiPhoneOpenCharId;
    closeWechatAiPhoneErrorPrompt();
    if (charId) regenerateWechatAiPhoneSnapshot(charId);
}
window.retryWechatAiPhoneFromErrorPrompt = retryWechatAiPhoneFromErrorPrompt;

function openWechatAiPhoneErrorPrompt(charId, errorText = '') {
    const safeCharId = charId || window._wechatAiPhoneOpenCharId || '';
    const char = (window.myCharacters || []).find(c => c.id === safeCharId);
    const rawError = getWechatAiPhoneSyncErrorText(safeCharId, errorText);
    const friendlyError = getWechatAiPhoneFriendlyErrorText(rawError);
    let modal = document.getElementById('wc-ai-phone-error-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-ai-phone-error-modal';
        modal.className = 'wc-ai-phone-error-modal';
        modal.setAttribute('onclick', 'if(event.target===this) closeWechatAiPhoneErrorPrompt()');
        getWechatModalRoot().appendChild(modal);
    }
    modal.dataset.charId = safeCharId;
    modal.innerHTML = `
        <div class="wc-ai-phone-error-card" onclick="event.stopPropagation()">
            <div class="wc-ai-phone-error-icon"><i class="ri-error-warning-line"></i></div>
            <div class="wc-ai-phone-error-copy">
                <strong>小手机同步没成功</strong>
                <span>${wcEscapeHtml(char ? `${getWechatCharDisplayName(char)} 的手机内容暂时用本地记录显示` : '当前内容暂时用本地记录显示')}</span>
            </div>
            <div class="wc-ai-phone-error-reason">
                <b>原因</b>
                <p>${wcEscapeHtml(friendlyError)}</p>
            </div>
            <div class="wc-ai-phone-error-actions">
                <button type="button" onclick="closeWechatAiPhoneErrorPrompt()">知道了</button>
                <button type="button" class="primary" onclick="retryWechatAiPhoneFromErrorPrompt()"><i class="ri-refresh-line"></i><span>重新同步</span></button>
            </div>
        </div>
    `;
}
window.openWechatAiPhoneErrorPrompt = openWechatAiPhoneErrorPrompt;

