// ========== 微信记忆系统 ==========

function normalizeWechatMemoryStore(store) {
    const safe = (store && typeof store === 'object') ? store : {};
    const normalizeList = (list, tier, charId) => Array.isArray(list) ? list
        .filter(item => item && typeof item === 'object')
        .map(item => ({
            id: item.id || ('mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
            tier,
            charId: item.charId || charId || '',
            category: String(item.category || item.type || item.memoryType || '').trim(),
            topic: String(item.topic || '').trim(),
            title: String(item.title || '').trim(),
            content: String(item.content || '').trim(),
            confidence: Math.min(1, Math.max(0, Number(item.confidence || 0.72))),
            auto: !!item.auto,
            enabled: item.enabled !== false,
            sourceCount: Math.max(1, Number(item.sourceCount || 1)),
            sourceStart: Number.isFinite(Number(item.sourceStart)) ? Number(item.sourceStart) : null,
            sourceEnd: Number.isFinite(Number(item.sourceEnd)) ? Number(item.sourceEnd) : null,
            createdAt: item.createdAt || Date.now(),
            updatedAt: item.updatedAt || item.createdAt || Date.now()
        }))
        .filter(item => item.content)
        : [];

    const normalizeMeta = meta => {
        const source = (meta && typeof meta === 'object') ? meta : {};
        return {
            lastExtractedIndex: Math.max(0, Number(source.lastExtractedIndex || 0)),
            lastExtractedAt: Math.max(0, Number(source.lastExtractedAt || 0)),
            extractionBusy: false,
            extractionError: String(source.extractionError || '').slice(0, 180)
        };
    };

    const normalizeGraph = (graph, charId) => {
        const source = (graph && typeof graph === 'object') ? graph : {};
        const clean = (value, limit = 120) => String(value || '').trim().slice(0, limit);
        const normalizeFacts = list => Array.isArray(list) ? list
            .filter(item => item && typeof item === 'object')
            .map(item => ({
                id: item.id || ('fact_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
                charId: item.charId || charId || '',
                sourceMemoryId: clean(item.sourceMemoryId || item.memoryId || '', 80),
                subject: clean(item.subject || item.who || '', 80),
                predicate: clean(item.predicate || item.action || item.relation || '', 80),
                object: clean(item.object || item.target || item.what || '', 140),
                topic: clean(item.topic || item.family || '', 80),
                emotion: clean(item.emotion || item.mood || '', 80),
                confidence: Math.min(1, Math.max(0.1, Number(item.confidence || 0.72))),
                enabled: item.enabled !== false,
                sourceStart: Number.isFinite(Number(item.sourceStart)) ? Number(item.sourceStart) : null,
                sourceEnd: Number.isFinite(Number(item.sourceEnd)) ? Number(item.sourceEnd) : null,
                createdAt: item.createdAt || Date.now(),
                updatedAt: item.updatedAt || item.createdAt || Date.now()
            }))
            .filter(item => item.subject && item.predicate && item.object)
            : [];
        const normalizeRelations = list => Array.isArray(list) ? list
            .filter(item => item && typeof item === 'object')
            .map(item => ({
                id: item.id || ('edge_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
                charId: item.charId || charId || '',
                sourceMemoryId: clean(item.sourceMemoryId || item.memoryId || '', 80),
                from: clean(item.from || item.source || item.a || '', 140),
                type: clean(item.type || item.relation || item.predicate || '', 80),
                to: clean(item.to || item.target || item.b || '', 140),
                topic: clean(item.topic || item.family || '', 80),
                confidence: Math.min(1, Math.max(0.1, Number(item.confidence || 0.72))),
                enabled: item.enabled !== false,
                sourceStart: Number.isFinite(Number(item.sourceStart)) ? Number(item.sourceStart) : null,
                sourceEnd: Number.isFinite(Number(item.sourceEnd)) ? Number(item.sourceEnd) : null,
                createdAt: item.createdAt || Date.now(),
                updatedAt: item.updatedAt || item.createdAt || Date.now()
            }))
            .filter(item => item.from && item.type && item.to)
            : [];
        return {
            facts: normalizeFacts(source.facts),
            relations: normalizeRelations(source.relations || source.edges),
            updatedAt: Math.max(0, Number(source.updatedAt || 0))
        };
    };

    const normalizeBucket = (bucket, charId) => {
        if (Array.isArray(bucket)) {
            return {
                segments: normalizeList(bucket, 'segment', charId),
                longTerm: [],
                compressed: [],
                graph: normalizeGraph(null, charId),
                meta: normalizeMeta(null)
            };
        }
        return {
            segments: normalizeList(bucket && (bucket.segments || bucket.segment), 'segment', charId),
            longTerm: normalizeList(bucket && (bucket.longTerm || bucket.long || bucket.longterm), 'long', charId),
            compressed: normalizeList(bucket && (bucket.compressed || bucket.compress), 'compressed', charId),
            graph: normalizeGraph(bucket && bucket.graph, charId),
            meta: normalizeMeta(bucket && bucket.meta)
        };
    };

    const chars = {};
    Object.keys(safe.chars || {}).forEach(charId => {
        chars[charId] = normalizeBucket(safe.chars[charId], charId);
    });
    return {
        chars
    };
}

function getWechatMemoryStore() {
    try {
        return normalizeWechatMemoryStore(JSON.parse(localStorage.getItem(WECHAT_MEMORY_STORAGE_KEY) || '{}'));
    } catch (e) {
        return normalizeWechatMemoryStore({});
    }
}

function saveWechatMemoryStore(store) {
    localStorage.setItem(WECHAT_MEMORY_STORAGE_KEY, JSON.stringify(normalizeWechatMemoryStore(store)));
}

function clearWechatMemoryForChar(charId) {
    const id = String(charId || '').trim();
    if (!id) return false;
    const store = getWechatMemoryStore();
    if (!store.chars || !store.chars[id]) return false;
    delete store.chars[id];
    saveWechatMemoryStore(store);
    return true;
}

function getWechatMemoryBucket(store, charId) {
    if (!store.chars[charId]) {
        store.chars[charId] = {
            segments: [],
            longTerm: [],
            compressed: [],
            graph: { facts: [], relations: [], updatedAt: 0 },
            meta: { lastExtractedIndex: 0, lastExtractedAt: 0, extractionBusy: false, extractionError: '' }
        };
    }
    store.chars[charId].graph = store.chars[charId].graph || { facts: [], relations: [], updatedAt: 0 };
    store.chars[charId].graph.facts = Array.isArray(store.chars[charId].graph.facts) ? store.chars[charId].graph.facts : [];
    store.chars[charId].graph.relations = Array.isArray(store.chars[charId].graph.relations) ? store.chars[charId].graph.relations : [];
    store.chars[charId].meta = store.chars[charId].meta || { lastExtractedIndex: 0, lastExtractedAt: 0, extractionBusy: false, extractionError: '' };
    return store.chars[charId];
}

function addWechatAutoMemory(char, content, title = '角色主动记忆') {
    if (!char || !char.id) return false;
    const text = String(content || '').trim();
    if (!text) return false;
    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const now = Date.now();
    bucket.segments.push({
        id: 'mem_auto_' + now + '_' + Math.random().toString(36).slice(2, 7),
        tier: 'segment',
        charId: char.id,
        category: 'relationship',
        topic: String(title || '角色主动记忆').slice(0, 32),
        title: String(title || '角色主动记忆').slice(0, 32),
        content: text.slice(0, 900),
        confidence: 0.9,
        auto: true,
        enabled: true,
        sourceCount: 1,
        sourceStart: null,
        sourceEnd: Array.isArray(char.history) ? char.history.length : null,
        createdAt: now,
        updatedAt: now
    });
    promoteWechatMemoryBucket(bucket, char);
    saveWechatMemoryStore(store);
    return true;
}

function getWechatMemoryListForTier(store, tier, charId) {
    const bucket = getWechatMemoryBucket(store, charId);
    if (tier === 'compressed') return bucket.compressed;
    if (tier === 'long') return bucket.longTerm;
    return bucket.segments;
}

function normalizeWechatMemoryNumber(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

function getWechatMemoryConfig(charOrId) {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    const config = (char && char.chatConfig) || {};
    const segmentLimit = normalizeWechatMemoryNumber(config.memorySegmentLimit, WECHAT_MEMORY_DEFAULTS.segmentLimit, 3, 50);
    const longTermLimit = normalizeWechatMemoryNumber(config.memoryLongTermLimit, WECHAT_MEMORY_DEFAULTS.longTermLimit, 3, 50);
    const keepRecent = Math.min(
        segmentLimit,
        normalizeWechatMemoryNumber(config.memoryKeepRecent, WECHAT_MEMORY_DEFAULTS.keepRecent, 1, Math.max(1, segmentLimit))
    );
    const extractEvery = normalizeWechatMemoryNumber(config.memoryExtractEvery, WECHAT_MEMORY_DEFAULTS.extractEvery, 2, 30);
    return {
        segmentLimit,
        longTermLimit,
        keepRecent,
        extractEvery
    };
}

function getWechatMemoryTierLabel(tier) {
    if (tier === 'compressed') return '压缩记忆';
    if (tier === 'long') return '长期记忆';
    return '分段记忆';
}

function findWechatMemoryEntry(store, id) {
    for (const charId of Object.keys(store.chars || {})) {
        const bucket = getWechatMemoryBucket(store, charId);
        for (const tier of ['segments', 'longTerm', 'compressed']) {
            const list = bucket[tier] || [];
            const index = list.findIndex(item => item.id === id);
            if (index >= 0) return { list, index, item: list[index] };
        }
    }
    return null;
}

function buildWechatMemoryDigest(items, label) {
    const lines = items
        .filter(item => item && item.content)
        .map(item => {
            const title = item.title ? `${item.title}：` : '';
            const category = item.category ? `【${item.category}】` : '';
            return `${category}${title}${item.content}`;
        });
    const text = lines.join('；');
    return text.length > 900 ? `${text.slice(0, 900)}...` : text;
}

function promoteWechatMemoryBucket(bucket, charOrId) {
    const memoryConfig = getWechatMemoryConfig(charOrId);
    const now = Date.now();
    if (bucket.segments.length > memoryConfig.segmentLimit) {
        const moveCount = Math.max(1, bucket.segments.length - memoryConfig.keepRecent);
        const moved = bucket.segments.splice(0, moveCount);
        bucket.longTerm.push({
            id: 'mem_long_' + now + '_' + Math.random().toString(36).slice(2, 7),
            tier: 'long',
            title: `阶段整理 ${new Date(now).toLocaleDateString()}`,
            content: buildWechatMemoryDigest(moved, '分段记忆'),
            enabled: true,
            sourceCount: moved.reduce((sum, item) => sum + Number(item.sourceCount || 1), 0),
            createdAt: now,
            updatedAt: now
        });
    }

    if (bucket.longTerm.length > memoryConfig.longTermLimit) {
        const keepLongTerm = Math.min(memoryConfig.keepRecent, memoryConfig.longTermLimit);
        const moveCount = Math.max(1, bucket.longTerm.length - keepLongTerm);
        const moved = bucket.longTerm.splice(0, moveCount);
        bucket.compressed.push({
            id: 'mem_zip_' + now + '_' + Math.random().toString(36).slice(2, 7),
            tier: 'compressed',
            title: `压缩记忆 ${new Date(now).toLocaleDateString()}`,
            content: buildWechatMemoryDigest(moved, '长期记忆'),
            enabled: true,
            sourceCount: moved.reduce((sum, item) => sum + Number(item.sourceCount || 1), 0),
            createdAt: now,
            updatedAt: now
        });
    }
}

function getWechatActiveMemories(char) {
    const store = getWechatMemoryStore();
    const charId = char && char.id;
    if (!charId) return { segments: [], longTerm: [], compressed: [] };
    const bucket = getWechatMemoryBucket(store, charId);
    const memoryConfig = getWechatMemoryConfig(char);
    const recallQuery = buildWechatMemoryRecallQuery(char);
    const pickRelevant = (list, limit, alwaysRecent = 2) => {
        const enabled = list.filter(item => item && item.enabled);
        const recent = enabled.slice(-alwaysRecent);
        const recentIds = new Set(recent.map(item => item.id));
        const scored = enabled
            .filter(item => !recentIds.has(item.id))
            .map(item => ({ item, score: scoreWechatMemoryRelevance(item, recallQuery) }))
            .filter(pair => pair.score > 0)
            .sort((a, b) => b.score - a.score || (b.item.updatedAt || 0) - (a.item.updatedAt || 0))
            .slice(0, Math.max(0, limit - recent.length))
            .map(pair => pair.item);
        return [...scored, ...recent].slice(-limit);
    };
    return {
        segments: pickRelevant(bucket.segments, memoryConfig.segmentLimit, Math.min(3, memoryConfig.keepRecent)),
        longTerm: pickRelevant(bucket.longTerm, memoryConfig.longTermLimit, Math.min(2, memoryConfig.keepRecent)),
        compressed: bucket.compressed.filter(item => item.enabled).slice(-6)
    };
}

function buildWechatMemoryPrompt(char) {
    const memories = getWechatActiveMemories(char);
    const sections = [];
    const renderLines = list => list.map(item => {
        const title = item.title ? `${item.title}：` : '';
        const meta = [item.category, item.topic].filter(Boolean).join('/');
        return `- ${meta ? `【${meta}】` : ''}${title}${item.content}`;
    }).join('\n');
    if (memories.compressed.length) sections.push(`【压缩记忆】\n${renderLines(memories.compressed)}`);
    const graphPrompt = buildWechatMemoryGraphPrompt(char, memories);
    if (graphPrompt) sections.push(graphPrompt);
    if (memories.longTerm.length) sections.push(`【长期记忆】\n${renderLines(memories.longTerm)}`);
    if (memories.segments.length) sections.push(`【近期分段记忆】\n${renderLines(memories.segments)}`);
    if (!sections.length) return '';
    return `【当前聊天对象记忆】\n这些记忆只属于当前 AI 角色和用户的关系。压缩记忆是关系底色，长期记忆是稳定事实/偏好，分段记忆是发生过的事件，其时效要结合当前时间判断；记忆中的动作、场景和临时状态不代表此刻仍在持续，长时间未联系也不会自动清空稳定关系。回复时自然遵守，不要主动解释记忆系统；如果记忆和最新聊天冲突，以最新聊天为准，并可用 [微信记忆:...] 主动更新。\n${sections.join('\n')}`;
}

function getWechatMemoryCategoryLabel(category) {
    const key = String(category || '').trim();
    const labels = {
        relationship: '关系',
        preference: '偏好',
        fact: '事实',
        boundary: '边界',
        plot: '剧情',
        task: '待办',
        correction: '修正'
    };
    return labels[key] || key || '记忆';
}

function buildWechatMemoryRecallQuery(char) {
    const profile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : {};
    const history = Array.isArray(char && char.history) ? char.history : [];
    const lines = history.slice(-12).map(msg => getWechatMessagePromptContent(msg)).filter(Boolean);
    return [
        (char && char.name) || '',
        (char && char.chatConfig && char.chatConfig.nickname) || '',
        profile.name || '',
        profile.bio || '',
        profile.signature || '',
        ...lines
    ].join('\n');
}

function getWechatMemoryRecallTokens(value) {
    const compact = String(value || '')
        .toLowerCase()
        .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, ' ')
        .trim();
    if (!compact) return [];
    const tokens = compact.split(/\s+/).filter(item => item.length >= 2 && item.length <= 28);
    const dense = compact.replace(/\s+/g, '');
    for (let i = 0; i < dense.length - 1 && tokens.length < 120; i += 2) {
        const token = dense.slice(i, i + 2);
        if (token && token.length === 2) tokens.push(token);
    }
    return Array.from(new Set(tokens)).slice(0, 120);
}

function scoreWechatMemoryRelevance(item, query) {
    if (!item || !query) return 0;
    const haystack = `${item.category || ''} ${item.topic || ''} ${item.title || ''} ${item.content || ''}`.toLowerCase();
    const tokens = getWechatMemoryRecallTokens(query);
    let score = 0;
    tokens.forEach(token => {
        if (!token) return;
        if (haystack.includes(token)) score += token.length > 2 ? 3 : 1;
    });
    const ageHours = Math.max(0, (Date.now() - Number(item.updatedAt || item.createdAt || 0)) / 3600000);
    if (ageHours < 24) score += 3;
    if (item.category === 'relationship' || item.category === 'boundary') score += 2;
    return score;
}

function getWechatMemoryGraphFactText(fact) {
    if (!fact) return '';
    return [fact.subject, fact.predicate, fact.object].filter(Boolean).join(' ');
}

function scoreWechatMemoryGraphItem(item, query) {
    if (!item || !query) return 0;
    const haystack = Object.keys(item)
        .map(key => typeof item[key] === 'string' ? item[key] : '')
        .join(' ')
        .toLowerCase();
    const tokens = getWechatMemoryRecallTokens(query);
    let score = 0;
    tokens.forEach(token => {
        if (token && haystack.includes(token)) score += token.length > 2 ? 3 : 1;
    });
    const ageHours = Math.max(0, (Date.now() - Number(item.updatedAt || item.createdAt || 0)) / 3600000);
    if (ageHours < 72) score += 2;
    score += Math.round(Number(item.confidence || 0.72) * 2);
    return score;
}

function getWechatMemoryFamilyKeyFromItem(item) {
    const raw = String((item && (item.topic || item.category || item.title)) || '').trim();
    return raw || '未分类星座';
}

function buildWechatMemoryGraphPrompt(char, activeMemories) {
    const charId = char && char.id;
    if (!charId) return '';
    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, charId);
    const graph = bucket.graph || { facts: [], relations: [] };
    const query = buildWechatMemoryRecallQuery(char);
    const rankByQuery = list => list
        .filter(item => item && item.enabled !== false)
        .map(item => ({ item, score: scoreWechatMemoryGraphItem(item, query) }))
        .filter(pair => pair.score > 0)
        .sort((a, b) => b.score - a.score || (b.item.updatedAt || 0) - (a.item.updatedAt || 0))
        .map(pair => pair.item);
    const relevantFacts = rankByQuery(graph.facts || []).slice(0, 5);
    const relevantRelations = rankByQuery(graph.relations || []).slice(0, 4);
    const familyMap = new Map();
    const rememberFamily = (key, text, updatedAt) => {
        const name = String(key || '').trim() || '未分类星座';
        const entry = familyMap.get(name) || { name, count: 0, samples: [], updatedAt: 0 };
        entry.count += 1;
        if (text && entry.samples.length < 3) entry.samples.push(text);
        entry.updatedAt = Math.max(entry.updatedAt, Number(updatedAt || 0));
        familyMap.set(name, entry);
    };
    [
        ...((activeMemories && activeMemories.compressed) || []),
        ...((activeMemories && activeMemories.longTerm) || []),
        ...((activeMemories && activeMemories.segments) || [])
    ].forEach(item => {
        if (!item || item.enabled === false) return;
        rememberFamily(getWechatMemoryFamilyKeyFromItem(item), item.title || item.content, item.updatedAt || item.createdAt);
    });
    relevantFacts.forEach(fact => {
        rememberFamily(fact.topic || fact.predicate, getWechatMemoryGraphFactText(fact), fact.updatedAt || fact.createdAt);
    });
    const families = Array.from(familyMap.values())
        .filter(item => item.count > 1 || item.samples.length > 1)
        .sort((a, b) => b.count - a.count || b.updatedAt - a.updatedAt)
        .slice(0, 3);
    const sections = [];
    if (families.length) {
        sections.push(`【记忆星河/联想层】\n${families.map(item => `- ${item.name}：${item.samples.join('；').slice(0, 180)}`).join('\n')}`);
    }
    if (relevantFacts.length) {
        sections.push(`【高相关原子事实】\n${relevantFacts.map(fact => `- ${getWechatMemoryGraphFactText(fact)}${fact.emotion ? `（情绪：${fact.emotion}）` : ''}`).join('\n')}`);
    }
    if (relevantRelations.length) {
        sections.push(`【记忆联想关系】\n${relevantRelations.map(edge => `- ${edge.from} --${edge.type}--> ${edge.to}`).join('\n')}`);
    }
    return sections.join('\n');
}

function buildWechatMemoryExtractionTranscript(char, startIndex, maxCount = 18) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : {};
    const userName = userProfile.name || '用户';
    const charName = getWechatCharDisplayName(char);
    const rows = [];
    for (let i = Math.max(0, startIndex); i < history.length && rows.length < maxCount; i += 1) {
        const msg = history[i];
        if (!msg || msg.type === 'system_notice' || msg.monitorEvent) continue;
        const content = stripWechatPromptText(getWechatMessagePromptContent(msg), 360);
        if (!content) continue;
        rows.push({
            index: i,
            role: msg.isMe ? 'user' : 'char',
            line: `#${i + 1} ${msg.isMe ? userName : charName}: ${content}${Array.isArray(msg.webSources) && msg.webSources.length ? ` [本轮主动搜索了现实资料，展示了 ${msg.webSources.length} 条来源]` : ''}`
        });
    }
    return rows;
}

function buildWechatMemoryExistingManifest(bucket) {
    const all = [
        ...(bucket.compressed || []).slice(-6),
        ...(bucket.longTerm || []).slice(-12),
        ...(bucket.segments || []).slice(-18)
    ].filter(item => item && item.content);
    if (!all.length) return '暂无已有记忆。';
    return all.map(item => {
        const tier = getWechatMemoryTierLabel(item.tier || 'segment');
        const category = getWechatMemoryCategoryLabel(item.category);
        const title = item.title || item.topic || '未命名';
        return `- ${tier}/${category}/${title}：${stripWechatPromptText(item.content, 160)}`;
    }).join('\n');
}

function parseWechatMemoryExtractionPayload(text) {
    const raw = parseWechatJsonObject(text);
    const list = Array.isArray(raw) ? raw : (Array.isArray(raw && raw.memories) ? raw.memories : []);
    const validCategories = new Set(['relationship', 'preference', 'fact', 'boundary', 'plot', 'task', 'correction']);
    const memories = list.map(item => {
        if (!item || typeof item !== 'object') return null;
        const content = stripWechatPromptText(item.content || item.memory || item.note || '', 900);
        if (content.length < 4) return null;
        const category = String(item.category || item.type || 'relationship').trim();
        const title = stripWechatPromptText(item.title || item.topic || content.slice(0, 18), 36);
        return {
            category: validCategories.has(category) ? category : 'relationship',
            topic: stripWechatPromptText(item.topic || title, 36),
            title,
            content,
            confidence: Math.min(1, Math.max(0.35, Number(item.confidence || 0.72)))
        };
    }).filter(Boolean).slice(0, 6);
    const factList = Array.isArray(raw && raw.facts)
        ? raw.facts
        : (Array.isArray(raw && raw.graphFacts) ? raw.graphFacts : []);
    const relationList = Array.isArray(raw && raw.relations)
        ? raw.relations
        : (Array.isArray(raw && raw.graphRelations) ? raw.graphRelations : (Array.isArray(raw && raw.edges) ? raw.edges : []));
    const facts = factList.map(item => {
        if (!item || typeof item !== 'object') return null;
        const subject = stripWechatPromptText(item.subject || item.who || item.entity || '', 80);
        const predicate = stripWechatPromptText(item.predicate || item.action || item.relation || '', 80);
        const object = stripWechatPromptText(item.object || item.target || item.what || '', 140);
        if (!subject || !predicate || !object) return null;
        return {
            subject,
            predicate,
            object,
            topic: stripWechatPromptText(item.topic || item.family || '', 80),
            emotion: stripWechatPromptText(item.emotion || item.mood || '', 80),
            confidence: Math.min(1, Math.max(0.35, Number(item.confidence || 0.72)))
        };
    }).filter(Boolean).slice(0, 10);
    const relations = relationList.map(item => {
        if (!item || typeof item !== 'object') return null;
        const from = stripWechatPromptText(item.from || item.source || item.a || '', 140);
        const type = stripWechatPromptText(item.type || item.relation || item.predicate || '', 80);
        const to = stripWechatPromptText(item.to || item.target || item.b || '', 140);
        if (!from || !type || !to) return null;
        return {
            from,
            type,
            to,
            topic: stripWechatPromptText(item.topic || item.family || '', 80),
            confidence: Math.min(1, Math.max(0.35, Number(item.confidence || 0.72)))
        };
    }).filter(Boolean).slice(0, 12);
    return { memories, facts, relations };
}

function parseWechatMemoryExtractionJson(text) {
    return parseWechatMemoryExtractionPayload(text).memories;
}

function getWechatMemoryDuplicateScore(existing, candidate) {
    const a = `${existing.topic || ''} ${existing.title || ''} ${existing.content || ''}`.toLowerCase();
    const b = `${candidate.topic || ''} ${candidate.title || ''} ${candidate.content || ''}`.toLowerCase();
    if (!a || !b) return 0;
    if ((existing.topic && candidate.topic && existing.topic === candidate.topic) || (existing.title && candidate.title && existing.title === candidate.title)) return 100;
    if (a.includes(candidate.content.toLowerCase()) || b.includes(String(existing.content || '').toLowerCase())) return 90;
    const tokens = getWechatMemoryRecallTokens(b).slice(0, 80);
    if (!tokens.length) return 0;
    const hits = tokens.filter(token => a.includes(token)).length;
    return hits / tokens.length * 100;
}

function mergeWechatMemoryContent(oldContent, newContent) {
    const oldText = String(oldContent || '').trim();
    const newText = String(newContent || '').trim();
    if (!oldText) return newText.slice(0, 900);
    if (!newText || oldText.includes(newText)) return oldText;
    if (newText.includes(oldText)) return newText.slice(0, 900);
    return `${oldText}；${newText}`.slice(0, 900);
}

function getWechatMemoryGraphFactKey(fact) {
    return [fact && fact.subject, fact && fact.predicate, fact && fact.object]
        .map(value => String(value || '').trim().toLowerCase())
        .join('|');
}

function getWechatMemoryGraphRelationKey(relation) {
    return [relation && relation.from, relation && relation.type, relation && relation.to]
        .map(value => String(value || '').trim().toLowerCase())
        .join('|');
}

function upsertWechatMemoryGraphFact(bucket, fact, char, sourceStart, sourceEnd, sourceMemoryId = '') {
    if (!bucket || !fact || !fact.subject || !fact.predicate || !fact.object) return null;
    bucket.graph = bucket.graph || { facts: [], relations: [], updatedAt: 0 };
    bucket.graph.facts = Array.isArray(bucket.graph.facts) ? bucket.graph.facts : [];
    const now = Date.now();
    const key = getWechatMemoryGraphFactKey(fact);
    let existing = bucket.graph.facts.find(item => getWechatMemoryGraphFactKey(item) === key);
    if (existing) {
        existing.topic = fact.topic || existing.topic;
        existing.emotion = fact.emotion || existing.emotion;
        existing.confidence = Math.max(Number(existing.confidence || 0), Number(fact.confidence || 0.72));
        existing.sourceMemoryId = existing.sourceMemoryId || sourceMemoryId || '';
        existing.sourceStart = existing.sourceStart == null ? sourceStart : Math.min(existing.sourceStart, sourceStart);
        existing.sourceEnd = existing.sourceEnd == null ? sourceEnd : Math.max(existing.sourceEnd, sourceEnd);
        existing.enabled = true;
        existing.updatedAt = now;
        bucket.graph.updatedAt = now;
        return existing;
    }
    existing = {
        id: 'fact_' + now + '_' + Math.random().toString(36).slice(2, 7),
        charId: char && char.id ? char.id : '',
        sourceMemoryId: sourceMemoryId || '',
        subject: fact.subject,
        predicate: fact.predicate,
        object: fact.object,
        topic: fact.topic || '',
        emotion: fact.emotion || '',
        confidence: Number(fact.confidence || 0.72),
        enabled: true,
        sourceStart,
        sourceEnd,
        createdAt: now,
        updatedAt: now
    };
    bucket.graph.facts.push(existing);
    if (bucket.graph.facts.length > 180) bucket.graph.facts.splice(0, bucket.graph.facts.length - 180);
    bucket.graph.updatedAt = now;
    return existing;
}

function upsertWechatMemoryGraphRelation(bucket, relation, char, sourceStart, sourceEnd, sourceMemoryId = '') {
    if (!bucket || !relation || !relation.from || !relation.type || !relation.to) return null;
    bucket.graph = bucket.graph || { facts: [], relations: [], updatedAt: 0 };
    bucket.graph.relations = Array.isArray(bucket.graph.relations) ? bucket.graph.relations : [];
    const now = Date.now();
    const key = getWechatMemoryGraphRelationKey(relation);
    let existing = bucket.graph.relations.find(item => getWechatMemoryGraphRelationKey(item) === key);
    if (existing) {
        existing.topic = relation.topic || existing.topic;
        existing.confidence = Math.max(Number(existing.confidence || 0), Number(relation.confidence || 0.72));
        existing.sourceMemoryId = existing.sourceMemoryId || sourceMemoryId || '';
        existing.sourceStart = existing.sourceStart == null ? sourceStart : Math.min(existing.sourceStart, sourceStart);
        existing.sourceEnd = existing.sourceEnd == null ? sourceEnd : Math.max(existing.sourceEnd, sourceEnd);
        existing.enabled = true;
        existing.updatedAt = now;
        bucket.graph.updatedAt = now;
        return existing;
    }
    existing = {
        id: 'edge_' + now + '_' + Math.random().toString(36).slice(2, 7),
        charId: char && char.id ? char.id : '',
        sourceMemoryId: sourceMemoryId || '',
        from: relation.from,
        type: relation.type,
        to: relation.to,
        topic: relation.topic || '',
        confidence: Number(relation.confidence || 0.72),
        enabled: true,
        sourceStart,
        sourceEnd,
        createdAt: now,
        updatedAt: now
    };
    bucket.graph.relations.push(existing);
    if (bucket.graph.relations.length > 220) bucket.graph.relations.splice(0, bucket.graph.relations.length - 220);
    bucket.graph.updatedAt = now;
    return existing;
}

function upsertWechatMemoryGraphPayload(bucket, payload, char, sourceStart, sourceEnd, sourceMemoryIds = []) {
    if (!bucket || !payload) return;
    const memoryIds = Array.isArray(sourceMemoryIds) ? sourceMemoryIds.filter(Boolean) : [];
    (payload.facts || []).forEach((fact, index) => {
        const fallbackMemoryId = memoryIds[index] || memoryIds[0] || '';
        upsertWechatMemoryGraphFact(bucket, fact, char, sourceStart, sourceEnd, fallbackMemoryId);
    });
    (payload.relations || []).forEach(relation => {
        upsertWechatMemoryGraphRelation(bucket, relation, char, sourceStart, sourceEnd, memoryIds[0] || '');
    });
}

function syncWechatMemoryGraphSourceState(store, sourceMemoryId, enabled) {
    const id = String(sourceMemoryId || '').trim();
    if (!id || !store || !store.chars) return;
    Object.keys(store.chars).forEach(charId => {
        const bucket = getWechatMemoryBucket(store, charId);
        const graph = bucket.graph || {};
        ['facts', 'relations'].forEach(key => {
            const list = Array.isArray(graph[key]) ? graph[key] : [];
            list.forEach(item => {
                if (item && item.sourceMemoryId === id) {
                    item.enabled = enabled !== false;
                    item.updatedAt = Date.now();
                }
            });
        });
    });
}

function removeWechatMemoryGraphSource(store, sourceMemoryId) {
    const id = String(sourceMemoryId || '').trim();
    if (!id || !store || !store.chars) return;
    Object.keys(store.chars).forEach(charId => {
        const bucket = getWechatMemoryBucket(store, charId);
        const graph = bucket.graph || {};
        if (Array.isArray(graph.facts)) graph.facts = graph.facts.filter(item => !item || item.sourceMemoryId !== id);
        if (Array.isArray(graph.relations)) graph.relations = graph.relations.filter(item => !item || item.sourceMemoryId !== id);
        graph.updatedAt = Date.now();
        bucket.graph = graph;
    });
}

function upsertWechatExtractedMemory(bucket, candidate, char, sourceStart, sourceEnd) {
    const now = Date.now();
    const searchable = [...(bucket.segments || []), ...(bucket.longTerm || [])];
    let duplicate = null;
    let duplicateScore = 0;
    searchable.forEach(item => {
        const score = getWechatMemoryDuplicateScore(item, candidate);
        if (score > duplicateScore) {
            duplicate = item;
            duplicateScore = score;
        }
    });
    if (duplicate && duplicateScore >= 62) {
        duplicate.category = candidate.category || duplicate.category;
        duplicate.topic = candidate.topic || duplicate.topic || candidate.title;
        duplicate.title = candidate.title || duplicate.title || candidate.topic;
        duplicate.content = mergeWechatMemoryContent(duplicate.content, candidate.content);
        duplicate.confidence = Math.max(Number(duplicate.confidence || 0), Number(candidate.confidence || 0.72));
        duplicate.sourceCount = Math.max(1, Number(duplicate.sourceCount || 1)) + 1;
        duplicate.sourceStart = duplicate.sourceStart == null ? sourceStart : Math.min(duplicate.sourceStart, sourceStart);
        duplicate.sourceEnd = duplicate.sourceEnd == null ? sourceEnd : Math.max(duplicate.sourceEnd, sourceEnd);
        duplicate.updatedAt = now;
        duplicate.auto = true;
        return duplicate;
    }
    const item = {
        id: 'mem_ext_' + now + '_' + Math.random().toString(36).slice(2, 7),
        tier: 'segment',
        charId: char.id,
        category: candidate.category || 'relationship',
        topic: candidate.topic || candidate.title || '自动整理',
        title: candidate.title || candidate.topic || '自动整理',
        content: candidate.content.slice(0, 900),
        confidence: Number(candidate.confidence || 0.72),
        auto: true,
        enabled: true,
        sourceCount: 1,
        sourceStart,
        sourceEnd,
        createdAt: now,
        updatedAt: now
    };
    bucket.segments.push(item);
    return item;
}

function getWechatExtractableMessageCount(history, startIndex) {
    return history.slice(Math.max(0, startIndex)).filter(msg => msg && msg.type !== 'system_notice' && !msg.monitorEvent).length;
}

function scheduleWechatMemoryExtraction(char, reason = 'after_reply') {
    if (!char || !char.id || typeof callChatApi !== 'function') return;
    if (reason !== 'manual' && typeof getWechatAgentPreferences === 'function' && !getWechatAgentPreferences(char).allowMemory) return;
    if (isWechatBackgroundApiPaused()) return;
    const history = Array.isArray(char.history) ? char.history : [];
    if (!history.length) return;
    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const config = getWechatMemoryConfig(char);
    const cursor = Math.min(history.length, Math.max(0, Number(bucket.meta?.lastExtractedIndex || 0)));
    if (reason !== 'web_search' && getWechatExtractableMessageCount(history, cursor) < config.extractEvery) return;
    window._wechatMemoryExtractionTimers = window._wechatMemoryExtractionTimers || new Map();
    const oldTimer = window._wechatMemoryExtractionTimers.get(char.id);
    if (oldTimer) clearTimeout(oldTimer);
    const timer = setTimeout(() => {
        window._wechatMemoryExtractionTimers.delete(char.id);
        requestWechatMemoryExtraction(char.id, reason).catch(e => console.warn('wechat memory extraction failed:', e));
    }, 700);
    window._wechatMemoryExtractionTimers.set(char.id, timer);
}

async function requestWechatMemoryExtraction(charOrId, reason = 'manual') {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    if (!char || !char.id || typeof callChatApi !== 'function') return null;
    if (reason !== 'manual' && typeof getWechatAgentPreferences === 'function' && !getWechatAgentPreferences(char).allowMemory) return null;
    if (reason !== 'manual' && isWechatBackgroundApiPaused()) return null;
    window._wechatMemoryExtractionBusy = window._wechatMemoryExtractionBusy || new Set();
    if (window._wechatMemoryExtractionBusy.has(char.id)) return null;
    const history = Array.isArray(char.history) ? char.history : [];
    if (!history.length) return null;
    const resetToken = Number(char.chatConfig && char.chatConfig.memoryResetAt) || 0;

    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const config = getWechatMemoryConfig(char);
    let startIndex = Math.min(history.length, Math.max(0, Number(bucket.meta?.lastExtractedIndex || 0)));
    const maxWindow = Math.max(12, config.extractEvery * 4);
    if (startIndex === 0 && history.length > maxWindow) startIndex = history.length - maxWindow;
    const transcriptRows = buildWechatMemoryExtractionTranscript(char, startIndex, maxWindow);
    if (transcriptRows.length < config.extractEvery && reason !== 'manual' && reason !== 'web_search') return null;
    if (!transcriptRows.length) return null;
    const forumCandidates = typeof window.getLivingWorldMemoryCandidatesForChar === 'function'
        ? window.getLivingWorldMemoryCandidatesForChar(char, bucket.meta?.lastExtractedAt || 0)
        : '';

    window._wechatMemoryExtractionBusy.add(char.id);
    const activity = typeof beginWechatToolActivity === 'function' ? beginWechatToolActivity(char, 'memory', '整理记忆') : null;
    try {
        const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : {};
        const result = await callChatApi([
            {
                role: 'system',
                content: `你是 BYND 微信记忆整理子代理。只分析提供的新增聊天片段和角色确实可知的论坛记忆候选，抽取值得长期影响后续互动的记忆；先检查已有记忆，避免重复。论坛公开发言只是某人的说法，不可当作已证实的客观事实；不知道的角色不得获知。只返回 JSON，不要 Markdown。格式：{"memories":[{"category":"relationship|preference|fact|boundary|plot|task|correction","topic":"主题","title":"短标题","content":"一条可直接给角色使用的记忆","confidence":0.35到1}],"facts":[{"subject":"User/角色名/具体实体","predicate":"喜欢/害怕/正在/会为了等关系动作","object":"对象或事实结果","topic":"记忆家族主题","emotion":"可空","confidence":0.35到1}],"relations":[{"from":"事实或实体A","type":"关联类型","to":"事实或实体B","topic":"记忆家族主题","confidence":0.35到1}]}。memories 是给角色直接阅读的自然语言记忆；facts 是可组成记忆星河的原子事实，必须从 memories、聊天片段或论坛候选中拆出；relations 只描述真实存在的联想关系。保存标准：用户明确要求记住的事、稳定偏好、关系变化、边界、推进的剧情、承诺、重要论坛互动；主动搜索若带来后续会用到的新约定或共同认知，也可记住这次查找事件。不要保存：普通寒暄、普通帖子、一次性情绪、临时搜索结果、未确认猜测、隐私敏感内容、模型思考过程。没有值得记的内容就返回空数组。`
            },
            {
                role: 'user',
                content: `${buildWechatIdentityContextPrompt(char, userProfile)}\n\n【已有记忆清单】\n${buildWechatMemoryExistingManifest(bucket)}\n\n【新增聊天片段】\n${transcriptRows.map(row => row.line).join('\n')}${forumCandidates ? `\n\n【角色可知的论坛记忆候选】\n${forumCandidates}` : ''}`
            }
        ], {
            usageFeature: 'memory',
            usageChar: char,
            max_tokens: 1200,
            temperature: 0.25,
            skipLengthContinuation: true,
            skipStatusValidationRetry: true,
            background: reason !== 'manual'
        });

        const freshStore = getWechatMemoryStore();
        const sourceStart = transcriptRows[0].index;
        const sourceEnd = transcriptRows[transcriptRows.length - 1].index;
        const currentResetToken = Number(char.chatConfig && char.chatConfig.memoryResetAt) || 0;
        if (currentResetToken !== resetToken || char.history !== history || !Array.isArray(char.history) || char.history.length <= sourceEnd || (reason !== 'manual' && typeof getWechatAgentPreferences === 'function' && !getWechatAgentPreferences(char).allowMemory)) {
            if (activity) await finishWechatToolActivity(char, activity, false, '聊天或权限已变化，本次未写入记忆');
            return null;
        }
        const freshBucket = getWechatMemoryBucket(freshStore, char.id);
        if (result && result.ok) {
            const payload = parseWechatMemoryExtractionPayload(result.content);
            const memories = payload.memories;
            const touchedMemoryIds = memories
                .map(memory => upsertWechatExtractedMemory(freshBucket, memory, char, sourceStart, sourceEnd))
                .filter(Boolean)
                .map(item => item.id);
            upsertWechatMemoryGraphPayload(freshBucket, payload, char, sourceStart, sourceEnd, touchedMemoryIds);
            promoteWechatMemoryBucket(freshBucket, char);
            freshBucket.meta.lastExtractedIndex = history.length;
            freshBucket.meta.lastExtractedAt = Date.now();
            freshBucket.meta.extractionError = '';
            saveWechatMemoryStore(freshStore);
            if (activity) await finishWechatToolActivity(char, activity, true, memories.length ? `已整理 ${memories.length} 条记忆` : '本轮没有需要新增的长期记忆');
            if (window._wechatMemoryTier && document.getElementById('wc-memory-manager') && !document.getElementById('wc-memory-manager').classList.contains('hidden')) {
                renderWechatMemoryManager();
            }
            return memories;
        }
        freshBucket.meta.extractionError = (result && result.error) || '记忆整理失败';
        saveWechatMemoryStore(freshStore);
        if (activity) await finishWechatToolActivity(char, activity, false, freshBucket.meta.extractionError);
        return null;
    } catch (error) {
        if (activity) await finishWechatToolActivity(char, activity, false, error.message || '记忆整理未完成');
        throw error;
    } finally {
        window._wechatMemoryExtractionBusy.delete(char.id);
    }
}

function maybeCaptureWechatMemoryCommand(char, text) {
    const match = String(text || '').match(/^\s*(?:记住|记忆|remember)\s*[：:\s]\s*([\s\S]{2,})$/i);
    if (!match || !char) return false;
    const content = match[1].trim();
    if (!content) return false;
    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const list = bucket.segments;
    const now = Date.now();
    list.push({
        id: 'mem_' + now + '_' + Math.random().toString(36).slice(2, 7),
        tier: 'segment',
        charId: char.id,
        title: content.slice(0, 18),
        content,
        enabled: true,
        sourceCount: 1,
        createdAt: now,
        updatedAt: now
    });
    promoteWechatMemoryBucket(bucket, char);
    saveWechatMemoryStore(store);
    return true;
}

function ensureWechatMemoryManager() {
    let modal = document.getElementById('wc-memory-manager');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-memory-manager';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay wc-sticker-submodal';
    modal.style.zIndex = '3800';
    modal.innerHTML = `
        <div class="wc-compose-card wc-memory-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i class="ri-star-smile-line"></i><span>记忆星河</span></div>
                <i class="ri-close-line" onclick="closeWechatMemoryManager()"></i>
            </div>
            <div class="wc-compose-body wc-memory-body">
                <div class="wc-compose-segment wc-memory-tabs">
                    <button id="wc-memory-tab-galaxy" onclick="switchWechatMemoryTier('galaxy')">星河</button>
                    <button id="wc-memory-tab-segment" onclick="switchWechatMemoryTier('segment')">分段</button>
                    <button id="wc-memory-tab-long" onclick="switchWechatMemoryTier('long')">长期</button>
                    <button id="wc-memory-tab-compressed" onclick="switchWechatMemoryTier('compressed')">压缩</button>
                </div>
                <div id="wc-memory-stats" class="wc-memory-stats"></div>
                <div class="wc-memory-editor">
                    <input id="wc-memory-title" type="text" maxlength="32" placeholder="标题">
                    <textarea id="wc-memory-content" maxlength="900" placeholder="写入当前聊天对象需要记住的事实、偏好或关系状态"></textarea>
                </div>
                <div id="wc-memory-list" class="wc-memory-list"></div>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" id="wc-memory-clear-btn" onclick="clearWechatMemoryEditor()">清空</button>
                <button class="wc-compose-secondary" id="wc-memory-extract-btn" onclick="runWechatMemoryExtractionNow(event)">整理最近</button>
                <button class="wc-compose-primary" id="wc-memory-save-btn" onclick="saveWechatMemoryFromEditor()">保存记忆</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function openWechatMemoryManager() {
    const char = getCurrentChatChar();
    if (!char) return;
    closeChatToolbar();
    closeStickerPicker();
    window._wechatMemoryTier = window._wechatMemoryTier || 'galaxy';
    const modal = ensureWechatMemoryManager();
    modal.dataset.editId = '';
    modal.classList.remove('hidden');
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

function closeWechatMemoryManager() {
    const modal = document.getElementById('wc-memory-manager');
    if (modal) modal.classList.add('hidden');
}

function switchWechatMemoryTier(tier) {
    window._wechatMemoryTier = tier === 'galaxy' ? 'galaxy' : (tier === 'compressed' ? 'compressed' : (tier === 'long' ? 'long' : 'segment'));
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

function switchWechatMemoryScope() {
    switchWechatMemoryTier('segment');
}

function clearWechatMemoryEditor(render = true) {
    const modal = document.getElementById('wc-memory-manager');
    if (modal) modal.dataset.editId = '';
    const title = document.getElementById('wc-memory-title');
    const content = document.getElementById('wc-memory-content');
    const saveBtn = document.getElementById('wc-memory-save-btn');
    if (title) title.value = '';
    if (content) content.value = '';
    if (saveBtn) saveBtn.textContent = '保存记忆';
    if (render) renderWechatMemoryManager();
}

function getWechatMemoryGalaxyItems(bucket) {
    if (!bucket) return [];
    return [
        ...(bucket.compressed || []),
        ...(bucket.longTerm || []),
        ...(bucket.segments || [])
    ].filter(item => item && item.content);
}

function getWechatMemoryGalaxyFamilyKey(item) {
    const raw = String((item && (item.topic || item.category || item.title)) || '').trim();
    return raw || '未分类星座';
}

function buildWechatMemoryGalaxyFamilies(bucket) {
    const map = new Map();
    const remember = (name, sample, updatedAt) => {
        const key = String(name || '').trim() || '未分类星座';
        const entry = map.get(key) || { name: key, count: 0, samples: [], updatedAt: 0 };
        entry.count += 1;
        if (sample && entry.samples.length < 3) entry.samples.push(sample);
        entry.updatedAt = Math.max(entry.updatedAt, Number(updatedAt || 0));
        map.set(key, entry);
    };
    getWechatMemoryGalaxyItems(bucket)
        .filter(item => item.enabled !== false)
        .forEach(item => remember(getWechatMemoryGalaxyFamilyKey(item), item.title || item.content, item.updatedAt || item.createdAt));
    const facts = ((bucket && bucket.graph && bucket.graph.facts) || []).filter(item => item && item.enabled !== false);
    facts.forEach(fact => remember(fact.topic || fact.predicate, getWechatMemoryGraphFactText(fact), fact.updatedAt || fact.createdAt));
    return Array.from(map.values())
        .sort((a, b) => b.count - a.count || b.updatedAt - a.updatedAt)
        .slice(0, 8);
}

function renderWechatMemoryGalaxy(char, bucket) {
    const memoryItems = getWechatMemoryGalaxyItems(bucket).filter(item => item.enabled !== false);
    const graph = (bucket && bucket.graph) || { facts: [], relations: [] };
    const facts = (graph.facts || []).filter(item => item && item.enabled !== false);
    const relations = (graph.relations || []).filter(item => item && item.enabled !== false);
    const families = buildWechatMemoryGalaxyFamilies(bucket);
    if (!memoryItems.length && !facts.length && !relations.length) {
        return `<div class="wc-memory-empty">暂无星光记忆</div>`;
    }
    const displayItems = memoryItems.slice(-18);
    const centerX = 50;
    const centerY = 48;
    const nodes = displayItems.map((item, index) => {
        const count = Math.max(1, displayItems.length);
        const angle = -Math.PI / 2 + (Math.PI * 2 * index / count);
        const radiusX = 30 + (index % 3) * 4;
        const radiusY = 23 + (index % 2) * 7;
        return {
            item,
            x: Math.max(8, Math.min(92, centerX + Math.cos(angle) * radiusX)),
            y: Math.max(10, Math.min(88, centerY + Math.sin(angle) * radiusY))
        };
    });
    const familyGroups = new Map();
    nodes.forEach(node => {
        const key = getWechatMemoryGalaxyFamilyKey(node.item);
        if (!familyGroups.has(key)) familyGroups.set(key, []);
        familyGroups.get(key).push(node);
    });
    const centerLines = nodes.map(node => `<line x1="${centerX}" y1="${centerY}" x2="${node.x.toFixed(2)}" y2="${node.y.toFixed(2)}" class="wc-memory-galaxy-line-soft"/>`).join('');
    const familyLines = Array.from(familyGroups.values()).map(group => group.length > 1
        ? group.slice(1).map((node, index) => {
            const prev = group[index];
            return `<line x1="${prev.x.toFixed(2)}" y1="${prev.y.toFixed(2)}" x2="${node.x.toFixed(2)}" y2="${node.y.toFixed(2)}" class="wc-memory-galaxy-line-strong"/>`;
        }).join('')
        : ''
    ).join('');
    const avatar = wcEscapeHtml(getWechatCharAvatarSource(char));
    const charName = wcEscapeHtml(getWechatCharDisplayName(char));
    const nodeHtml = nodes.map(node => {
        const item = node.item;
        const title = wcEscapeHtml(item.title || item.topic || item.content.slice(0, 18));
        const tier = item.tier === 'compressed' ? 'compressed' : (item.tier === 'long' ? 'long' : 'segment');
        return `<button class="wc-memory-star is-${tier}" style="left:${node.x.toFixed(2)}%;top:${node.y.toFixed(2)}%;" onclick="editWechatMemoryEntry('${item.id}')" title="${title}"><span></span></button>`;
    }).join('');
    const familyHtml = families.length ? families.map(item => `
        <div class="wc-memory-constellation">
            <div class="wc-memory-constellation-head">
                <strong>${wcEscapeHtml(item.name)}</strong>
                <span>${item.count} 点</span>
            </div>
            <p>${wcEscapeHtml(item.samples.join(' / '))}</p>
        </div>
    `).join('') : `<div class="wc-memory-empty">暂无星座</div>`;
    const factHtml = facts.slice(-6).reverse().map(fact => `
        <div class="wc-memory-fact">
            <span>${wcEscapeHtml(fact.topic || fact.predicate || '星点')}</span>
            <p>${wcEscapeHtml(getWechatMemoryGraphFactText(fact))}${fact.emotion ? ` <em>${wcEscapeHtml(fact.emotion)}</em>` : ''}</p>
        </div>
    `).join('');
    const relationHtml = relations.slice(-6).reverse().map(edge => `
        <div class="wc-memory-relation">
            <span>${wcEscapeHtml(edge.from)}</span>
            <b>${wcEscapeHtml(edge.type)}</b>
            <span>${wcEscapeHtml(edge.to)}</span>
        </div>
    `).join('');
    return `
        <div class="wc-memory-galaxy">
            <div class="wc-memory-sky">
                <svg class="wc-memory-galaxy-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${centerLines}${familyLines}</svg>
                <div class="wc-memory-galaxy-center">
                    <img src="${avatar}" alt="">
                    <span>${charName}</span>
                </div>
                ${nodeHtml}
            </div>
            <div class="wc-memory-galaxy-sections">
                <section>
                    <h4>星座</h4>
                    ${familyHtml}
                </section>
                <section>
                    <h4>星点</h4>
                    ${factHtml || `<div class="wc-memory-empty">暂无原子事实</div>`}
                </section>
                <section>
                    <h4>星线</h4>
                    ${relationHtml || `<div class="wc-memory-empty">暂无联想关系</div>`}
                </section>
            </div>
        </div>
    `;
}

function renderWechatMemoryManager() {
    const char = getCurrentChatChar();
    if (!char) return;
    const tier = window._wechatMemoryTier === 'galaxy' ? 'galaxy' : (window._wechatMemoryTier === 'compressed' ? 'compressed' : (window._wechatMemoryTier === 'long' ? 'long' : 'segment'));
    document.getElementById('wc-memory-tab-galaxy')?.classList.toggle('active', tier === 'galaxy');
    document.getElementById('wc-memory-tab-segment')?.classList.toggle('active', tier === 'segment');
    document.getElementById('wc-memory-tab-long')?.classList.toggle('active', tier === 'long');
    document.getElementById('wc-memory-tab-compressed')?.classList.toggle('active', tier === 'compressed');
    document.querySelector('#wc-memory-manager .wc-memory-editor')?.classList.toggle('hidden', tier === 'galaxy');
    document.getElementById('wc-memory-clear-btn')?.classList.toggle('hidden', tier === 'galaxy');
    document.getElementById('wc-memory-save-btn')?.classList.toggle('hidden', tier === 'galaxy');

    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const memoryConfig = getWechatMemoryConfig(char);
    const listEl = document.getElementById('wc-memory-list');
    if (!listEl) return;
    const statsEl = document.getElementById('wc-memory-stats');
    if (statsEl) {
        if (tier === 'galaxy') {
            const graph = bucket.graph || { facts: [], relations: [] };
            statsEl.innerHTML = `
                <span>星笺 ${getWechatMemoryGalaxyItems(bucket).filter(item => item.enabled !== false).length}</span>
                <span>星点 ${(graph.facts || []).filter(item => item && item.enabled !== false).length}</span>
                <span>星线 ${(graph.relations || []).filter(item => item && item.enabled !== false).length}</span>
            `;
        } else {
            statsEl.innerHTML = `
                <span>分段 ${bucket.segments.length}/${memoryConfig.segmentLimit}</span>
                <span>长期 ${bucket.longTerm.length}/${memoryConfig.longTermLimit}</span>
                <span>压缩 ${bucket.compressed.length}</span>
            `;
        }
    }

    if (tier === 'galaxy') {
        listEl.innerHTML = renderWechatMemoryGalaxy(char, bucket);
        return;
    }

    const list = getWechatMemoryListForTier(store, tier, char.id);
    if (!list.length) {
        listEl.innerHTML = `<div class="wc-memory-empty">暂无${getWechatMemoryTierLabel(tier)}</div>`;
        return;
    }

    listEl.innerHTML = list.slice().reverse().map(item => `
        <div class="wc-memory-item ${item.enabled ? '' : 'is-off'}">
            <div class="wc-memory-main" onclick="editWechatMemoryEntry('${item.id}')">
                <div class="wc-memory-title">${wcEscapeHtml(item.title || '未命名记忆')}</div>
                <div class="wc-memory-content">${wcEscapeHtml(item.content)}</div>
                <div class="wc-memory-meta">${getWechatMemoryTierLabel(item.tier || tier)} · ${item.sourceCount || 1} 段来源</div>
            </div>
            <div class="wc-memory-actions">
                <button onclick="toggleWechatMemoryEntry('${item.id}')" title="${item.enabled ? '停用' : '启用'}"><i class="${item.enabled ? 'ri-toggle-fill' : 'ri-toggle-line'}"></i></button>
                <button onclick="deleteWechatMemoryEntry('${item.id}')" title="删除"><i class="ri-delete-bin-6-line"></i></button>
            </div>
        </div>
    `).join('');
}

function saveWechatMemoryFromEditor() {
    const char = getCurrentChatChar();
    if (!char) return;
    const modal = document.getElementById('wc-memory-manager');
    const titleEl = document.getElementById('wc-memory-title');
    const contentEl = document.getElementById('wc-memory-content');
    const content = contentEl ? contentEl.value.trim() : '';
    if (!content) {
        contentEl?.focus();
        return;
    }

    const store = getWechatMemoryStore();
    const editId = modal ? modal.dataset.editId : '';
    const now = Date.now();
    if (editId) {
        const found = findWechatMemoryEntry(store, editId);
        if (found) {
            found.item.title = (titleEl?.value || '').trim() || content.slice(0, 18);
            found.item.content = content;
            found.item.updatedAt = now;
            removeWechatMemoryGraphSource(store, found.item.id);
        }
    } else {
        const tier = window._wechatMemoryTier === 'compressed' ? 'compressed' : (window._wechatMemoryTier === 'long' ? 'long' : 'segment');
        const bucket = getWechatMemoryBucket(store, char.id);
        const list = getWechatMemoryListForTier(store, tier, char.id);
        list.push({
            id: 'mem_' + now + '_' + Math.random().toString(36).slice(2, 7),
            tier,
            charId: char.id,
            title: (titleEl?.value || '').trim() || content.slice(0, 18),
            content,
            enabled: true,
            sourceCount: 1,
            createdAt: now,
            updatedAt: now
        });
        promoteWechatMemoryBucket(bucket, char);
    }

    saveWechatMemoryStore(store);
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

function editWechatMemoryEntry(id) {
    const store = getWechatMemoryStore();
    const found = findWechatMemoryEntry(store, id);
    if (!found) return;
    const modal = ensureWechatMemoryManager();
    modal.dataset.editId = id;
    if (window._wechatMemoryTier === 'galaxy') {
        window._wechatMemoryTier = found.item.tier === 'compressed' ? 'compressed' : (found.item.tier === 'long' ? 'long' : 'segment');
        renderWechatMemoryManager();
    }
    const title = document.getElementById('wc-memory-title');
    const content = document.getElementById('wc-memory-content');
    const saveBtn = document.getElementById('wc-memory-save-btn');
    if (title) title.value = found.item.title || '';
    if (content) content.value = found.item.content || '';
    if (saveBtn) saveBtn.textContent = '更新记忆';
    content?.focus();
}

function toggleWechatMemoryEntry(id) {
    const store = getWechatMemoryStore();
    const found = findWechatMemoryEntry(store, id);
    if (!found) return;
    found.item.enabled = !found.item.enabled;
    found.item.updatedAt = Date.now();
    syncWechatMemoryGraphSourceState(store, found.item.id, found.item.enabled);
    saveWechatMemoryStore(store);
    renderWechatMemoryManager();
}

function deleteWechatMemoryEntry(id) {
    const store = getWechatMemoryStore();
    const found = findWechatMemoryEntry(store, id);
    if (!found) return;
    if (!confirm(`确定删除「${found.item.title || '这条记忆'}」吗？`)) return;
    removeWechatMemoryGraphSource(store, found.item.id);
    found.list.splice(found.index, 1);
    saveWechatMemoryStore(store);
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

async function runWechatMemoryExtractionNow(evt) {
    const char = getCurrentChatChar();
    if (!char) return;
    const btn = evt && evt.currentTarget ? evt.currentTarget : null;
    const oldText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '整理中';
    }
    try {
        const memories = await requestWechatMemoryExtraction(char, 'manual');
        renderWechatMemoryManager();
        if (typeof showWechatToast === 'function') {
            showWechatToast(memories && memories.length ? `整理出 ${memories.length} 条记忆` : '最近没有值得新增的记忆');
        }
    } catch (e) {
        console.warn('manual memory extraction failed:', e);
        if (typeof showWechatToast === 'function') showWechatToast('记忆整理失败');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = oldText || '整理最近';
        }
    }
}

function ensureWechatComposerModal() {
    let modal = document.getElementById('wc-composer-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-composer-modal';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
    modal.innerHTML = `
        <div class="wc-compose-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i id="wc-compose-icon" class="ri-mic-line"></i><span id="wc-compose-title">发送消息</span></div>
                <i class="ri-close-line" onclick="closeWechatComposer()"></i>
            </div>
            <div class="wc-compose-body">
                <div id="wc-compose-fields"></div>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="closeWechatComposer()">取消</button>
                <button class="wc-compose-primary" id="wc-compose-submit" onclick="submitWechatComposer()">发送</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function composeField(type, msg, options = {}) {
    const value = (key, fallback = '') => wcEscapeHtml(msg && msg[key] != null ? msg[key] : fallback);
    const char = getCurrentChatChar();
    const peerName = wcEscapeHtml((char && ((char.chatConfig && char.chatConfig.nickname) || char.name)) || '对方');
    const peerAvatar = wcEscapeHtml((char && char.avatar) || DEFAULT_AVATAR);
    if (type === 'voice') {
        const transcript = msg?.transcript || '';
        const duration = estimateWechatVoiceDuration(transcript);
        return `
            <div class="wc-voice-estimate">
                <div class="wc-voice-estimate-icon"><i class="ri-mic-fill"></i></div>
                <div>
                    <span>自动估算语音时长</span>
                    <strong id="wc-compose-duration-estimate">${duration}"</strong>
                </div>
            </div>
            <label class="wc-compose-field">
                <span>转文字内容</span>
                <textarea id="wc-compose-transcript" rows="3" placeholder="输入语音转文字内容" oninput="updateWechatVoiceDurationEstimate()">${value('transcript', '')}</textarea>
            </label>
        `;
    }
    if (type === 'transfer') {
        return `
            <div class="wc-transfer-pay">
                <div class="wc-transfer-peer">
                    <img src="${peerAvatar}" alt="">
                    <div>
                        <span>转账给</span>
                        <strong>${peerName}</strong>
                    </div>
                </div>
                <label class="wc-transfer-amount">
                    <span>¥</span>
                    <input id="wc-compose-amount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${value('amount', '')}" placeholder="0.00">
                </label>
                <label class="wc-compose-field">
                    <span>转账说明</span>
                    <input id="wc-compose-note" type="text" value="${value('note', '')}" placeholder="添加说明">
                </label>
                <div class="wc-transfer-method">
                    <span>付款方式</span>
                    <strong>零钱</strong>
                </div>
            </div>
        `;
    }
    if (type === 'redpacket') {
        return `
            <label class="wc-compose-field">
                <span>红包标题</span>
                <input id="wc-compose-title-input" type="text" value="${value('title', '恭喜发财，大吉大利')}" placeholder="恭喜发财，大吉大利">
            </label>
            <label class="wc-compose-field">
                <span>金额</span>
                <input id="wc-compose-amount" type="number" min="0.01" step="0.01" value="${value('amount', '')}" placeholder="可留空">
            </label>
        `;
    }
    if (type === 'poke') {
        return `
            <label class="wc-compose-field">
                <span>拍一拍内容</span>
                <input id="wc-compose-action-content" type="text" maxlength="80" value="${wcEscapeAttr(getWechatPokeSuffix(msg || {}, getCurrentChatChar()) || '肩膀')}" placeholder="例如：肩膀、脑袋">
            </label>
        `;
    }
    if (type === 'screen_shake') {
        return `
            <label class="wc-compose-field">
                <span>震动内容</span>
                <input id="wc-compose-action-content" type="text" maxlength="80" value="${wcEscapeAttr(msg ? getWechatLiteActionContent(msg,'screen_shake') : '')}" placeholder="想附一句话（可选）">
            </label>
        `;
    }
    if (type === 'music_card') {
        const existing = normalizeWechatMusicDraftTrack(msg?.music || msg || null);
        window._wechatMusicComposeSelected = existing && existing.audioUrl ? existing : null;
        window._wechatMusicComposeResults = existing && existing.audioUrl ? [existing] : [];
        const query = existing ? [existing.title, existing.artist].filter(Boolean).join(' ') : '';
        const modeText = options.musicMode === 'queue' ? '添加到列表' : '发送';
        return `
            <div class="wc-music-compose-search">
                <label class="wc-compose-field">
                    <span>搜索音乐</span>
                    <div class="wc-music-search-row">
                        <input id="wc-compose-music-query" type="search" value="${wcEscapeHtml(query)}" placeholder="输入歌名 / 歌手，例如 周杰伦 晴天" onkeydown="if(event.key==='Enter'){event.preventDefault();searchWechatMusicForComposer();}">
                        <button type="button" onclick="searchWechatMusicForComposer()">搜索</button>
                    </div>
                </label>
                <div id="wc-compose-music-status" class="wc-compose-hint">${existing?.audioUrl ? '已选择：' + wcEscapeHtml(existing.title) : `搜索后选择一首歌再${modeText}。`}</div>
                <div id="wc-compose-music-results" class="wc-music-result-list"></div>
            </div>
        `;
    }
    return `
        <label class="wc-compose-field">
            <span>通话状态</span>
            <select id="wc-compose-status">
                ${['已结束', '已取消', '未接通', '已拒绝'].map(status => `<option value="${status}" ${(msg && msg.status === status) ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
        </label>
        <label class="wc-compose-field">
            <span>通话时长</span>
            <input id="wc-compose-duration" type="number" min="1" max="5999" value="${value('duration', 60)}">
        </label>
    `;
}

function openWechatComposer(type, editIndex, options = {}) {
    const config = WECHAT_COMPOSER_CONFIG[type];
    const char = getCurrentChatChar();
    if (!config || !char) return;
    closeChatToolbar();
    closeStickerPicker();

    const msg = Number.isInteger(editIndex) ? char.history?.[editIndex] : null;
    const modal = ensureWechatComposerModal();
    modal.dataset.type = type;
    modal.dataset.editIndex = Number.isInteger(editIndex) ? String(editIndex) : '';
    modal.dataset.musicMode = type === 'music_card' && options.musicMode === 'queue' ? 'queue' : '';
    modal.querySelector('.wc-compose-card')?.classList.toggle('wc-transfer-compose-card', type === 'transfer');

    document.getElementById('wc-compose-icon').className = config.icon;
    document.getElementById('wc-compose-title').textContent = Number.isInteger(editIndex)
        ? `编辑${config.title.replace('发送', '')}`
        : (modal.dataset.musicMode === 'queue' ? '添加音乐' : config.title);
    document.getElementById('wc-compose-submit').textContent = modal.dataset.musicMode === 'queue'
        ? '添加到列表'
        : (Number.isInteger(editIndex) ? '保存修改' : config.primary);
    document.getElementById('wc-compose-fields').innerHTML = composeField(type, msg, options);
    modal.classList.remove('hidden');
}

function closeWechatComposer() {
    const modal = document.getElementById('wc-composer-modal');
    if (modal) modal.classList.add('hidden');
}

function buildWechatSpecialMessageFromComposer(type, existingMsg) {
    const msg = {
        type,
        isMe: existingMsg ? existingMsg.isMe : true,
        timestamp: existingMsg?.timestamp || createMessageTimestamp()
    };
    if (type === 'voice') {
        msg.transcript = (document.getElementById('wc-compose-transcript')?.value || '').trim();
        msg.duration = estimateWechatVoiceDuration(msg.transcript);
        msg.content = msg.transcript || `[语音 ${formatWechatDuration(msg.duration)}]`;
    } else if (type === 'transfer') {
        msg.amount = normalizeWechatAmount(document.getElementById('wc-compose-amount')?.value);
        msg.note = (document.getElementById('wc-compose-note')?.value || '').trim();
    } else if (type === 'redpacket') {
        msg.title = (document.getElementById('wc-compose-title-input')?.value || '').trim() || '恭喜发财，大吉大利';
        const amount = (document.getElementById('wc-compose-amount')?.value || '').trim();
        if (amount) msg.amount = normalizeWechatAmount(amount);
        msg.status = existingMsg?.status || '待收取';
    } else if (type === 'poke') {
        msg.pokeSuffix = (document.getElementById('wc-compose-action-content')?.value || '').trim() || '肩膀';
        msg.content = getWechatPokeText(msg, getCurrentChatChar());
        msg.note = msg.content;
    } else if (type === 'screen_shake') {
        msg.content = (document.getElementById('wc-compose-action-content')?.value || '').trim() || '你震动了对方的屏幕';
        msg.note = msg.content;
    } else if (type === 'music_card') {
        const selected = window._wechatMusicComposeSelected;
        if (!selected || !selected.audioUrl) return null;
        const selectedSourceUrl = selected.sourceAudioUrl || selected.audioUrl;
        const selectedPlayableUrl = selected.playableUrl || selected.audioUrl;
        const selectedCardUrl = isWechatMusicProxyUrl(selectedSourceUrl) ? selectedSourceUrl : selectedPlayableUrl;
        msg.music = {
            title: selected.title,
            artist: selected.artist || '',
            audioUrl: selectedCardUrl,
            playableUrl: selectedPlayableUrl,
            sourceAudioUrl: selectedSourceUrl,
            url: selected.url || '',
            artwork: selected.artwork || '',
            sourceName: selected.sourceName || '',
            sourceMeta: selected.sourceMeta || '',
            sourceKey: selected.sourceKey || '',
            lyricsText: selected.lyricsText || '',
            lyricsUrl: selected.lyricsUrl || ''
        };
        msg.title = selected.title;
        msg.artist = selected.artist || '';
        msg.audioUrl = selectedCardUrl;
        msg.playableUrl = selectedPlayableUrl;
        msg.sourceAudioUrl = selectedSourceUrl;
        msg.url = selected.url || '';
        msg.artwork = selected.artwork || '';
        msg.sourceName = selected.sourceName || '';
        msg.sourceMeta = selected.sourceMeta || '';
        msg.sourceKey = selected.sourceKey || '';
        msg.lyricsText = selected.lyricsText || '';
        msg.lyricsUrl = selected.lyricsUrl || '';
    } else if (type === 'voiceCall' || type === 'videoCall') {
        msg.status = document.getElementById('wc-compose-status')?.value || '已结束';
        msg.duration = normalizeWechatDuration(document.getElementById('wc-compose-duration')?.value, 60);
    }
    return syncWechatMessageDescription(msg);
}

function submitWechatComposer() {
    const modal = document.getElementById('wc-composer-modal');
    const type = modal?.dataset.type;
    const char = getCurrentChatChar();
    if (!modal || !type || !char) return;

    const editIndex = modal.dataset.editIndex === '' ? null : parseInt(modal.dataset.editIndex, 10);
    const existingMsg = Number.isInteger(editIndex) ? char.history?.[editIndex] : null;
    if (type === 'transfer' && parseWechatAmountNumber(document.getElementById('wc-compose-amount')?.value) == null) {
        alert('请输入转账金额');
        return;
    }
    const msg = buildWechatSpecialMessageFromComposer(type, existingMsg);
    if (!msg) {
        if (type === 'music_card') {
            if (typeof showWechatToast === 'function') showWechatToast('先搜索并选择一首可播放的音乐');
        }
        return;
    }
    if (type === 'music_card' && window._wechatMusicComposeSelected?.resolving) {
        if (typeof showWechatToast === 'function') showWechatToast('音乐地址还在解析，等一下再操作');
        return;
    }
    if (type === 'music_card' && modal.dataset.musicMode === 'queue') {
        const selected = window._wechatMusicComposeSelected;
        if (!addWechatMusicTrackToQueue(selected)) {
            if (typeof showWechatToast === 'function') showWechatToast('这首歌没法添加，换一首试试');
            return;
        }
        renderWechatMusicQueuePanel();
        if (typeof showWechatToast === 'function') showWechatToast('已添加到音乐列表');
        closeWechatComposer();
        return;
    }

    if (existingMsg) {
        char.history[editIndex] = { ...existingMsg, ...msg };
        saveCharactersToStorage();
        refreshChatView(char);
        renderChatList();
    } else {
        appendWechatMessage(msg);
        if (type === 'poke') triggerWechatScreenFeedback('poke');
        if (type === 'screen_shake') triggerWechatScreenFeedback('shake');
    }
    closeWechatComposer();
}

function ensureWechatTextEditModal() {
    let modal = document.getElementById('wc-text-edit-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-text-edit-modal';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
    modal.innerHTML = `
        <div class="wc-compose-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i class="ri-edit-line"></i><span>编辑消息</span></div>
                <i class="ri-close-line" onclick="closeWechatMessageEditor()"></i>
            </div>
            <div class="wc-compose-body">
                <div class="wc-edit-target-pill" id="wc-edit-target-pill"></div>
                <label class="wc-compose-field">
                    <span>消息内容</span>
                    <textarea id="wc-edit-content" rows="7"></textarea>
                </label>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="closeWechatMessageEditor()">取消</button>
                <button class="wc-compose-primary" onclick="submitWechatMessageEditor()">保存修改</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function selectWechatEditSide(side) {
    document.querySelectorAll('#wc-edit-side button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.side === side);
    });
}

function getWechatEditSide() {
    return document.querySelector('#wc-edit-side button.active')?.dataset.side || 'me';
}

function openWechatMessageEditor(msgIdx) {
    const char = getCurrentChatChar();
    if (!char || !char.history || msgIdx < 0 || msgIdx >= char.history.length) return;
    const msg = char.history[msgIdx];
    const modal = ensureWechatTextEditModal();
    modal.dataset.msgIdx = String(msgIdx);
    document.getElementById('wc-edit-content').value = msg.content || msg.dialogue || msg.description || '';
    const target = document.getElementById('wc-edit-target-pill');
    if (target) {
        const sender = getWechatMessageSenderName(msg, char);
        target.innerHTML = `<i class="ri-chat-1-line"></i><span>只编辑 ${wcEscapeHtml(sender)} 的这条消息</span>`;
        target.classList.toggle('is-char', msg.isMe === false);
    }
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('wc-edit-content')?.focus(), 30);
}

function closeWechatMessageEditor() {
    const modal = document.getElementById('wc-text-edit-modal');
    if (modal) modal.classList.add('hidden');
}

function submitWechatMessageEditor() {
    const modal = document.getElementById('wc-text-edit-modal');
    const char = getCurrentChatChar();
    if (!modal || !char || !char.history) return;
    const msgIdx = parseInt(modal.dataset.msgIdx, 10);
    const msg = char.history[msgIdx];
    if (!msg) return;
    msg.content = document.getElementById('wc-edit-content').value;
    msg.description = (msg.type === 'image' || msg.type === 'image_stack') ? msg.description : '';
    saveCharactersToStorage();
    refreshChatView(char);
    renderChatList();
    closeWechatMessageEditor();
}

