/* BYND Living World: canonical local state, local feed ranking, and atomic AI batches. */
(function () {
    'use strict';

    const STORAGE_KEY = 'bynd_living_world_v1';
    const VERSION = 1;
    const MAX_NPCS = 80;
    const DAY = 86400000;
    const EVENT_RETENTION = { private_chat: 300, forum_view: 200, forum_view_as: 200 };
    const EVENT_RETENTION_DEFAULT = 800;
    const KNOWLEDGE_PER_ACCOUNT = 1200;
    const MAX_IMAGE_SIDE = 1280;
    const MAX_IMAGE_DATA_URL = 700000;
    const UNREAD_KEY = 'bynd_living_world_unread_v1';
    const DEFAULT_AVATAR = window.DEFAULT_AVATAR || 'assets/default-avatar.png';

    let state = null;
    let activeTab = 'home';
    let activeCommunity = '';
    let composeCommunityId = '';
    let activePostId = '';
    let perspectiveOpen = false;
    let searchOpen = false;
    let searchQuery = '';
    let profileTab = 'posts';
    let activityTab = 'notifications';
    let activeThreadId = '';
    let draftImage = '';
    let draftProfileAvatar = '';
    let profileEditOpen = false;
    let previousTab = 'home';
    let communityPickerOpen = false;
    let shareTarget = null;
    let replyTargetId = '';
    let replyComposerOpen = false;
    let replyDraft = '';
    let replyDraftImage = '';
    let replyMediaKind = '';
    let commentSort = 'old';
    let commentSearchOpen = false;
    let commentQuery = '';
    let postActionSheetOpen = false;
    let showPostTranslation = false;
    let translatingNewsId = '';
    const translatedNewsVisible = new Set();
    let articleLoadingId = '';
    let newsDraft = '';
    let lastAmaCheckAt = now();
    let activeNewsId = '';
    let mediaProfileId = '';
    let newsBusy = false;
    let interactionBusy = false;
    let selectedRelationPair = null;
    const relationImpressionCache = new Map();
    const relationImpressionPending = new Set();
    const relationImpressionErrors = new Map();
    const dmReplyStatuses = new Map();
    const replyingThreads = new Set();
    let isGenerating = false;
    let menuOpen = false;
    let lastScheduleCheck = 0;
    const loadingProfiles = new Set();
    let toastTimer = null;
    let feedObserver = null;

    function now() { return Date.now(); }
    function uid(prefix) { return `${prefix}_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
    function clone(value) { return JSON.parse(JSON.stringify(value)); }
    function escapeHtml(value) { const box = document.createElement('div'); box.textContent = String(value == null ? '' : value); return box.innerHTML; }
    function escapeAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;'); }
    function timeAgo(value) {
        const delta = Math.max(0, now() - Number(value || now()));
        if (delta < 60000) return '刚刚'; if (delta < 3600000) return `${Math.max(1, Math.floor(delta / 60000))} 分钟前`;
        if (delta < DAY) return `${Math.floor(delta / 3600000)} 小时前`; if (delta < DAY * 7) return `${Math.floor(delta / DAY)} 天前`;
        return new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
    }
    function safeList(value) { return Array.isArray(value) ? value : []; }
    function getRoot() { return document.getElementById('living-world-root'); }

    function emptyState() {
        const createdAt = now();
        return { version: VERSION, createdAt, updatedAt: createdAt, lastSimulatedAt: 0, accounts: {}, profileEdits: {}, publicProfiles: {}, profilePrompts: {}, npcs: [], communities: [], posts: [], comments: [], newsItems: [], newsComments: [], newsFetchedAt: 0, promotions: [], postFollows: {}, hiddenPosts: {}, reports: [], awards: [], agentStates: {}, agentDecisions: [], interactionQueue: [], interactionHandled: [], relationships: {}, socialLinks: [], knowledge: {}, traces: {}, events: [], notifications: {}, views: {}, searches: {}, messages: [], subscriptions: {}, follows: {}, viewerId: 'user', forumSettings: { refreshMode: 'manual', intervalHours: 12, profileMode: 'economy', replyMode: 'forum', replyReactionsEnabled: true, promotionsEnabled: true, promotionMinGap: 8, promotionMaxGap: 15, lastAttemptAt: 0, nextSmartAt: 0 }, migration: { apiGenerated: false } };
    }
    function normalizeState(raw) {
        const base = emptyState();
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
        const next = { ...base, ...raw, version: VERSION };
        next.accounts = raw.accounts && typeof raw.accounts === 'object' ? raw.accounts : {};
        next.profileEdits = raw.profileEdits && typeof raw.profileEdits === 'object' ? raw.profileEdits : {};
        next.publicProfiles = raw.publicProfiles && typeof raw.publicProfiles === 'object' ? raw.publicProfiles : {};
        next.profilePrompts = raw.profilePrompts && typeof raw.profilePrompts === 'object' ? raw.profilePrompts : {};
        next.npcs = safeList(raw.npcs).filter(item => item && item.id).slice(0, MAX_NPCS);
        next.communities = safeList(raw.communities).filter(item => item && item.id);
        // Old conversations and posts are history, not a disposable feed cache.
        next.posts = safeList(raw.posts).filter(validPost);
        next.comments = safeList(raw.comments).filter(item => item && item.id && item.postId && item.authorId && String(item.body || '').trim());
        next.newsItems = safeList(raw.newsItems).filter(item => item && item.id && item.title && item.url).slice(0, 80);
        next.newsComments = safeList(raw.newsComments).filter(item => item && item.id && item.newsId && item.authorId && String(item.body || '').trim()).slice(-800);
        next.promotions = safeList(raw.promotions).filter(item => item && item.id && item.sponsor && item.headline && item.body).slice(-40);
        next.newsFetchedAt = Number(raw.newsFetchedAt || 0);
        next.postFollows = raw.postFollows && typeof raw.postFollows === 'object' ? raw.postFollows : {};
        next.hiddenPosts = raw.hiddenPosts && typeof raw.hiddenPosts === 'object' ? raw.hiddenPosts : {};
        next.reports = safeList(raw.reports).slice(-100);
        next.awards = safeList(raw.awards).slice(-200);
        next.agentStates = raw.agentStates && typeof raw.agentStates === 'object' && !Array.isArray(raw.agentStates) ? raw.agentStates : {};
        next.agentDecisions = safeList(raw.agentDecisions).filter(item => item && item.actorId && item.action && item.createdAt).slice(-160);
        next.interactionQueue = safeList(raw.interactionQueue).filter(item => item && item.id && item.actorId && item.postId && item.commentId && item.eventId && Number.isFinite(Number(item.dueAt))).slice(-40);
        next.interactionHandled = safeList(raw.interactionHandled).filter(id => typeof id === 'string').slice(-160);
        next.relationships = raw.relationships && typeof raw.relationships === 'object' ? raw.relationships : {};
        next.socialLinks = safeList(raw.socialLinks).filter(item => item && item.fromId && item.toId && item.sourceEventId);
        next.forumSettings = { ...base.forumSettings, ...(raw.forumSettings && typeof raw.forumSettings === 'object' ? raw.forumSettings : {}) };
        const savedReplyMode = raw.forumSettings?.replyMode;
        next.forumSettings.replyMode = ['forum','app','off'].includes(savedReplyMode) ? savedReplyMode : raw.forumSettings?.replyReactionsEnabled === false ? 'off' : 'forum';
        next.forumSettings.replyReactionsEnabled = next.forumSettings.replyMode !== 'off';
        next.knowledge = raw.knowledge && typeof raw.knowledge === 'object' ? raw.knowledge : {};
        next.traces = raw.traces && typeof raw.traces === 'object' ? raw.traces : {};
        next.events = safeList(raw.events).filter(item => item && item.id && item.type);
        next.notifications = raw.notifications && typeof raw.notifications === 'object' ? raw.notifications : {};
        next.views = raw.views && typeof raw.views === 'object' ? raw.views : {};
        next.searches = raw.searches && typeof raw.searches === 'object' ? raw.searches : {};
        next.messages = safeList(raw.messages).filter(item => item && item.id && item.fromId && item.toId && String(item.body || '').trim());
        next.subscriptions = raw.subscriptions && typeof raw.subscriptions === 'object' ? raw.subscriptions : {};
        next.follows = raw.follows && typeof raw.follows === 'object' ? raw.follows : {};
        next.viewerId = typeof raw.viewerId === 'string' ? raw.viewerId : 'user';
        // One-time repair: author replies were once saved with the post id as actor and the metadata as target.
        if (!next.migration?.forumReplyEventsRepaired) {
            next.events.forEach(event => {
                if (event.type !== 'forum_reply' || !event.targetId || typeof event.targetId !== 'object') return;
                const metadata = event.targetId; const comment = next.comments.find(item => item.id === metadata.commentId);
                event.targetId = String(comment?.postId || event.actorId || ''); event.actorId = comment?.authorId || ''; event.metadata = metadata; event.visibility = 'public';
            });
            next.migration = { ...next.migration, forumReplyEventsRepaired: true };
        }
        // Private chat mirrors one event per message; keep history bounded so localStorage never fills up.
        next.events = trimEvents(next.events, next.interactionQueue);
        const liveEventIds = new Set(next.events.map(item => item.id));
        next.knowledge = Object.fromEntries(Object.entries(next.knowledge).map(([id, rows]) => [id, safeList(rows).filter(row => row && liveEventIds.has(row.eventId)).slice(-KNOWLEDGE_PER_ACCOUNT)]));
        next.npcs.forEach(npc => { if (!npc.contactCharId && npcInteractionCount(npc.id, next) >= 3 && npc.tier !== 'contact') { npc.tier = 'persistent'; npc.persistent = true; } });
        // v1 briefly shipped local placeholder content. It was never canonical,
        // so remove it once rather than presenting hard-coded people as a world.
        if (raw.migration?.seeded) {
            const placeholderPosts = new Set(next.posts.filter(item => String(item.id).startsWith('seed_post_')).map(item => item.id));
            next.posts = next.posts.filter(item => !placeholderPosts.has(item.id));
            next.comments = next.comments.filter(item => !placeholderPosts.has(item.postId));
            next.npcs = next.npcs.filter(item => !/^npc_(mori|qing|zhou|yao)$/.test(String(item.id)));
            next.migration = { ...next.migration, seeded: false, apiGenerated: false };
        }
        return next;
    }
    function trimEvents(events, queue) {
        const pinned = new Set(safeList(queue).map(item => item.eventId)); const counts = {}; const kept = [];
        for (let index = events.length - 1; index >= 0; index--) {
            const event = events[index]; counts[event.type] = (counts[event.type] || 0) + 1;
            if (counts[event.type] <= (EVENT_RETENTION[event.type] || EVENT_RETENTION_DEFAULT) || pinned.has(event.id)) kept.push(event);
        }
        return kept.reverse();
    }
    function validPost(item) { return !!(item && item.id && item.authorId && item.communityId && String(item.title || item.body || '').trim()); }
    function loadState() {
        if (state) return state;
        try { state = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
        catch (_) { state = emptyState(); }
        return state;
    }
    function commit(next) {
        const oldEventIds = new Set(safeList(state?.events).map(item => item.id));
        next.updatedAt = now();
        const normalized = normalizeState(next);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); }
        catch (error) { console.error('Living World 保存失败', error); throw new Error(/quota/i.test(`${error?.name || ''} ${error?.message || ''}`) ? '论坛存储空间已满，保存失败：图片或记录过多，本次操作未写入。可删除部分带图帖子后重试。' : '论坛数据保存失败，未写入本次操作。'); }
        state = normalized;
        normalized.events.filter(event => !oldEventIds.has(event.id)).forEach(event => {
            try { window.dispatchEvent(new CustomEvent('bynd:world-event', { detail: clone(event) })); } catch (_) {}
        });
        return state;
    }
    function mutate(mutator) { const next = clone(loadState()); mutator(next); return commit(next); }

    function accountFromChar(char) {
        const name = char?.chatConfig?.nickname || char?.name || '角色';
        return { id: `char:${char.id}`, charId: char.id, type: 'char', name, username: `@${String(name).replace(/\s+/g, '').slice(0, 18) || 'char'}`, avatar: char?.avatar || DEFAULT_AVATAR, summary: '', interests: inferInterests(`${char?.personality || ''}\n${char?.description || ''}`), createdAt: now() };
    }
    function userAccount() {
        const profile = typeof window.getUserProfile === 'function' ? window.getUserProfile() : {};
        return { id: 'user', type: 'user', name: profile?.name || '我', username: profile?.wechatId ? `@${profile.wechatId}` : '@me', avatar: profile?.avatar || DEFAULT_AVATAR, summary: profile?.bio || profile?.signature || '', interests: inferInterests(`${profile?.bio || ''}\n${profile?.signature || ''}`), createdAt: now() };
    }
    function inferInterests(text) {
        const source = String(text || '').toLowerCase(); const interests = [];
        const map = { photography: /摄影|相机|照片|拍照/, games: /游戏|电竞|steam|二次元/, campus: /校园|学生|课程|社团/, work: /工作|上班|职场|同事/, treehole: /情感|树洞|心情|关系/ };
        Object.entries(map).forEach(([id, re]) => { if (re.test(source)) interests.push(id); });
        return interests.length ? interests : ['lounge'];
    }
    function syncAccounts() {
        const next = clone(loadState());
        const currentUser = userAccount(); next.accounts.user = { ...next.accounts.user, ...currentUser, ...next.profileEdits.user };
        const chars = typeof window.getWechatGroupContacts === 'function' ? window.getWechatGroupContacts() : safeList(window.myCharacters).filter(char => char && !char.isGroupChat);
        safeList(chars).forEach(char => {
            if (!char?.id) return;
            const linkedNpc = next.npcs.find(item => item.contactCharId === char.id);
            const id = linkedNpc?.id || `char:${char.id}`;
            next.accounts[id] = { ...next.accounts[id], ...accountFromChar(char), ...next.publicProfiles[id], id, type: 'char', ...next.profileEdits[id] };
        });
        if (!next.accounts[next.viewerId]) next.viewerId = 'user';
        commit(next);
    }
    function account(id) { const world = loadState(); return world.accounts[id] || world.npcs.find(item => item.id === id) || { id: 'unknown', name: '未知用户', username: '@unknown', avatar: DEFAULT_AVATAR, interests: [] }; }
    function avatarMarkup(person, className = 'lw-avatar') {
        const image = String(loadState().forumSettings.profileMode === 'economy' && person?.type === 'npc' ? '' : person?.generatedAvatar || person?.avatar || '');
        if (image && image !== DEFAULT_AVATAR) return `<img class="${className}" src="${escapeAttr(image)}" onerror="this.src='${escapeAttr(DEFAULT_AVATAR)}'" alt="">`;
        const label = Array.from(String(person?.name || '?').trim()).slice(0, 2).join('');
        return `<span class="${className} lw-name-avatar" aria-label="${escapeAttr(person?.name || '成员')}的头像">${escapeHtml(label)}</span>`;
    }
    function viewer() { return account(loadState().viewerId); }
    function community(id) { return loadState().communities.find(item => item.id === id) || { id, name: '未知社区', icon: 'ri-chat-3-line' }; }
    function isVisible(post, viewerId) {
        if (post?.expiresAt && Number(post.expiresAt) <= now()) return false;
        if (post?.amaStartsAt && Number(post.amaStartsAt) > now() && post.authorId !== viewerId) return false;
        if (!post || post.visibility === 'private') return post?.authorId === viewerId;
        const mine = account(viewerId); const author = account(post.authorId);
        const allowed = post.visibility !== 'followers' || post.authorId === viewerId || safeList(loadState().follows[viewerId]).includes(post.authorId);
        return allowed && !(safeList(author.blocked).includes(viewerId) || safeList(mine.blocked).includes(post.authorId));
    }
    function relationshipScore(fromId, toId) { const value = loadState().relationships[`${fromId}>${toId}`] || {}; return Number(value.familiarity || 0) + Number(value.trust || 0) + Number(value.affection || 0) - Number(value.conflict || 0); }
    const RELATIONSHIP_DIMENSIONS = new Set(['familiarity', 'trust', 'affection', 'intimacy', 'jealousy', 'guardedness', 'conflict']);
    function clampRelationship(value) { return Math.max(-100, Math.min(100, Number(value || 0))); }
    function applyRelationshipDelta(next, fromId, toId, deltas, reasonEventId) {
        if (!fromId || !toId || fromId === toId || !reasonEventId) return false;
        const safe = Object.entries(deltas || {}).filter(([key, value]) => RELATIONSHIP_DIMENSIONS.has(key) && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 12);
        if (!safe.length) return false;
        const key = `${fromId}>${toId}`;
        const current = next.relationships[key] && typeof next.relationships[key] === 'object' ? next.relationships[key] : { history: [] };
        safe.forEach(([dimension, delta]) => { current[dimension] = clampRelationship(Number(current[dimension] || 0) + Number(delta)); });
        current.history = safeList(current.history);
        current.history.push({ eventId: reasonEventId, deltas: Object.fromEntries(safe), changedAt: now() });
        current.history = current.history.slice(-36);
        next.relationships[key] = current;
        return true;
    }
    function grantKnowledge(next, recipientId, event, sourceId, kind = 'direct', confidence = 1) {
        if (!recipientId || !event?.id) return false;
        const rows = safeList(next.knowledge[recipientId]);
        if (rows.some(row => row?.eventId === event.id)) return false;
        rows.push({ eventId: event.id, sourceId: sourceId || '', kind, confidence: Math.max(0, Math.min(1, Number(confidence || 0))), knownAt: now() });
        next.knowledge[recipientId] = rows;
        return true;
    }
    function knowsEvent(next, accountId, eventId) { return safeList(next.knowledge[accountId]).some(row => row?.eventId === eventId); }
    function traceThreshold(charId) { return 9 + (String(charId || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5); }
    function recordTrace(next, charId, action, risk, evidence = {}) {
        if (!charId || charId === 'user') return null;
        const weights = { low: 1, medium: 3, high: 6, critical: 9 };
        const trace = next.traces[charId] && typeof next.traces[charId] === 'object' ? next.traces[charId] : { entries: [], detectedAt: 0 };
        trace.entries = safeList(trace.entries);
        trace.entries.push({ action, risk, evidence, createdAt: now() });
        trace.entries = trace.entries.slice(-24);
        const score = trace.entries.reduce((sum, entry) => sum + (weights[entry.risk] || 0), 0);
        if (!trace.detectedAt && score >= traceThreshold(charId)) {
            trace.detectedAt = now();
            const detected = addEvent(next, 'forum_access_detected', charId, 'user', { action, evidence, privateTo: charId }, 'private');
            grantKnowledge(next, charId, detected, charId, 'detected', 1);
        }
        next.traces[charId] = trace;
        return trace;
    }
