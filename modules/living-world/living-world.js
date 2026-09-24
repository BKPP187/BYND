/* BYND Living World: canonical local state, local feed ranking, and atomic AI batches. */
(function () {
    'use strict';

    const STORAGE_KEY = 'bynd_living_world_v1';
    const VERSION = 1;
    const MAX_NPCS = 80;
    const DAY = 86400000;
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
        catch (error) { console.error('Living World 保存失败', error); throw new Error('论坛数据保存失败，未写入本次操作。'); }
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
    function scorePost(post, viewerId) {
        const world = loadState(); const who = account(viewerId); const author = account(post.authorId); const ageHours = Math.max(0, (now() - Number(post.createdAt || now())) / 3600000);
        const interest = safeList(who.interests).includes(post.communityId) ? 14 : 0;
        const subscribed = safeList(world.subscriptions[viewerId]).includes(post.communityId) ? 7 : 0;
        const followed = safeList(world.follows[viewerId]).includes(post.authorId) ? 9 : 0;
        const related = relationshipScore(viewerId, post.authorId) * .7;
        const popularity = Math.min(12, Number(post.likes || 0) * .7 + Number(post.commentCount || 0));
        const history = safeList(world.views[viewerId]).includes(post.id) ? -3 : 0;
        const freshness = Math.max(-11, 12 - ageHours * .38);
        const stableNoise = ((post.id.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) + Math.floor(now() / DAY)) % 9) - 4;
        return interest + subscribed + followed + related + popularity + history + freshness + stableNoise + (author.type === 'npc' ? 1 : 0);
    }
    function feed() { const world = loadState(); return world.posts.filter(post => isVisible(post, world.viewerId) && (!post.amaStartsAt || Number(post.amaStartsAt) <= now()) && !safeList(world.hiddenPosts[world.viewerId]).includes(post.id) && (!activeCommunity || post.communityId === activeCommunity)).sort((a, b) => scorePost(b, world.viewerId) - scorePost(a, world.viewerId) || b.createdAt - a.createdAt); }
    function commentsFor(postId) { return loadState().comments.filter(item => item.postId === postId).sort((a, b) => a.createdAt - b.createdAt); }

    function addEvent(next, type, actorId, targetId, metadata = {}, visibility = 'private') {
        const event = { id: uid('event'), type, actorId, targetId: targetId || '', metadata, visibility, createdAt: now() };
        next.events.push(event);
        return event;
    }
    function recordPrivateChatMessage(char, message) {
        if (!char?.id || char.isGroupChat || !message || message.apiError) return false;
        const charId = loadState().npcs.find(item => item.contactCharId === char.id)?.id || `char:${char.id}`;
        const actorId = message.isMe ? 'user' : charId;
        const recipientId = message.isMe ? charId : 'user';
        const excerpt = String(message.content || message.description || '').replace(/\s+/g, ' ').trim().slice(0, 140);
        if (!excerpt) return false;
        const sourceKey = `${charId}:${actorId}:${String(message.timestamp || '')}:${excerpt}`;
        if (loadState().events.some(item => item.type === 'private_chat' && item.metadata?.sourceKey === sourceKey)) return false;
        mutate(next => {
            if (!next.accounts[charId]) next.accounts[charId] = accountFromChar(char);
            const event = addEvent(next, 'private_chat', actorId, recipientId, { sourceKey, excerpt, privateTo: [charId, 'user'] }, 'private');
            grantKnowledge(next, actorId, event, actorId, 'direct', 1);
            grantKnowledge(next, recipientId, event, actorId, 'direct', 1);
        });
        return true;
    }
    function recordView(postId, sensitivity = 'low') {
        const who = loadState().viewerId;
        mutate(next => {
            next.views[who] = safeList(next.views[who]);
            if (!next.views[who].includes(postId)) next.views[who].push(postId);
            next.views[who] = next.views[who].slice(-80);
            const publicPostEvent = next.events.find(item => item.type === 'forum_post' && item.targetId === postId && item.visibility === 'public');
            if (publicPostEvent) grantKnowledge(next, 'user', publicPostEvent, publicPostEvent.actorId, 'read', 1);
            if (who === 'user') {
                const event = addEvent(next, 'forum_view', 'user', postId, { sensitivity }, 'private');
                grantKnowledge(next, 'user', event, 'user', 'direct', 1);
            } else {
                addEvent(next, 'forum_view_as', 'user', who, { postId, sensitivity }, 'private');
                recordTrace(next, who, 'view', sensitivity);
            }
        });
    }
    function notify(next, targetId, title, detail, postId) { next.notifications[targetId] = safeList(next.notifications[targetId]); next.notifications[targetId].unshift({ id: uid('notice'), title, detail, postId: postId || '', createdAt: now(), read: false }); next.notifications[targetId] = next.notifications[targetId].slice(0, 80); }
    function visibleMembers() { const world = loadState(); return [...new Map([...world.npcs, ...Object.values(world.accounts)].filter(item => item?.id).map(item => [item.id, item])).values()].filter(item => item.id !== world.viewerId && !safeList(item.blocked).includes(world.viewerId) && !safeList(viewer().blocked).includes(item.id)); }
    function messageThread(peerId) { const who = viewer().id; return loadState().messages.filter(item => (item.fromId === who && item.toId === peerId) || (item.toId === who && item.fromId === peerId)).sort((a, b) => a.createdAt - b.createdAt); }
    function unreadMessages() { return loadState().messages.filter(item => item.toId === viewer().id && !item.readAt).length; }
    function unreadNotifications() { return safeList(loadState().notifications[viewer().id]).filter(item => !item.read).length; }
    function postVotes(post) { const votes = post.votes && typeof post.votes === 'object' ? post.votes : {}; return Math.max(0, Number(post.likes || 0)) + Math.max(0, Number(post.downvotes || 0)) + Object.values(votes).filter(value => Number(value) === 1 || Number(value) === -1).length; }
    function myVote(post) { return Number(post.votes?.[viewer().id] || (safeList(post.likedBy).includes(viewer().id) ? 1 : 0)); }

    function postCard(post, expanded = false) {
        const author = account(post.authorId); const com = community(post.communityId); const who = viewer().id;
        if (post.deletedAt) return `<article class="lw-post lw-post-deleted" data-post-id="${escapeAttr(post.id)}"><div class="lw-post-heading">${avatarMarkup(author)}<span class="lw-post-meta"><b>${escapeHtml(com.name)}</b><span>${escapeHtml(author.name)} · ${timeAgo(post.deletedAt)}</span></span></div><h2>该贴已删</h2><p>帖子曾存在，相关回复和知情记录仍保留。</p>${expanded ? `<small>删除时间：${new Date(post.deletedAt).toLocaleString('zh-CN')}</small>` : ''}</article>`;
        const vote = myVote(post); const marked = safeList(post.bookmarkedBy).includes(who); const joined = safeList(loadState().subscriptions[who]).includes(post.communityId);
        const body = expanded ? post.body : String(post.body || '');
        return `<article class="lw-post" data-post-id="${escapeAttr(post.id)}">
            <div class="lw-post-heading"><button class="lw-post-head" type="button" onclick="LivingWorld.openCommunity('${escapeAttr(com.id)}')">${avatarMarkup(author)}<span class="lw-post-meta"><b>${escapeHtml(com.name)}</b><span>${timeAgo(post.createdAt)} · ${escapeHtml(author.name)}</span></span></button>${!joined ? `<button type="button" class="lw-post-join" onclick="LivingWorld.toggleSubscribe('${escapeAttr(com.id)}')">加入</button>` : ''}<button type="button" class="lw-post-menu" onclick="LivingWorld.togglePostMenu('${escapeAttr(post.id)}')" aria-label="帖子操作"><i class="ri-more-2-fill"></i></button></div>
            <div class="lw-post-menu-panel" id="lw-menu-${escapeAttr(post.id)}" hidden><button type="button" onclick="LivingWorld.toggleBookmark('${escapeAttr(post.id)}')">${marked ? '取消收藏' : '收藏帖子'}</button><button type="button" onclick="LivingWorld.sharePost('${escapeAttr(post.id)}')">分享帖子</button>${post.authorId === who ? `<button type="button" onclick="LivingWorld.deletePost('${escapeAttr(post.id)}')">删除帖子</button>` : `<button type="button" onclick="LivingWorld.openProfile('${escapeAttr(author.id)}')">查看作者</button>`}</div>
            <button type="button" class="lw-post-open" onclick="LivingWorld.openPost('${escapeAttr(post.id)}')">${post.ama ? '<small class="lw-ama-label">AMA · 问我任何事</small>' : ''}<h2>${escapeHtml(post.title || '')}</h2><p>${escapeHtml(body)}</p>${post.imageUrl && post.mediaType !== 'video' ? `<img class="lw-post-image" src="${escapeAttr(post.imageUrl)}" alt="帖子图片" loading="lazy">` : ''}</button>${post.imageUrl && post.mediaType === 'video' ? `<video class="lw-post-image" controls preload="metadata" src="${escapeAttr(post.imageUrl)}"></video>` : ''}${post.poll ? renderPoll(post) : ''}
            <div class="lw-post-actions"><div class="lw-vote-pill"><button class="${vote === 1 ? 'is-on' : ''}" type="button" onclick="LivingWorld.vote('${escapeAttr(post.id)}',1)" aria-label="赞同"><i class="ri-arrow-up-line"></i></button><b>${postVotes(post)}</b><span></span><button class="${vote === -1 ? 'is-on' : ''}" type="button" onclick="LivingWorld.vote('${escapeAttr(post.id)}',-1)" aria-label="反对"><i class="ri-arrow-down-line"></i></button></div><button type="button" onclick="LivingWorld.openPost('${escapeAttr(post.id)}')"><i class="ri-chat-3-line"></i>${Number(post.commentCount || 0)}</button><button class="lw-share" type="button" onclick="LivingWorld.sharePost('${escapeAttr(post.id)}')" aria-label="分享"><i class="ri-share-forward-line"></i></button></div>
        </article>`;
    }
    function renderPoll(post) { const options = safeList(post.poll?.options); const total = options.reduce((sum, item) => sum + safeList(item.voters).length, 0); const voted = options.some(item => safeList(item.voters).includes(viewer().id)); return `<div class="lw-poll"><small>${total} 人投票${voted ? ' · 已投票' : ''}</small>${options.map(item => `<button type="button" class="${safeList(item.voters).includes(viewer().id) ? 'selected' : ''}" onclick="LivingWorld.votePoll('${escapeAttr(post.id)}','${escapeAttr(item.id)}')"><span>${escapeHtml(item.text)}</span><b>${voted && total ? Math.round(safeList(item.voters).length / total * 100) + '%' : ''}</b></button>`).join('')}</div>`; }
    function render() {
        const root = getRoot(); if (!root) return; const view = viewer();
        feedObserver?.disconnect(); feedObserver = null;
        let content = '';
        if (activeTab === 'home') content = renderHome();
        else if (activeTab === 'communities') content = renderCommunities();
        else if (activeTab === 'create') content = renderCreate();
        else if (activeTab === 'chat') content = renderChat();
        else if (activeTab === 'notifications') content = renderNotifications();
        else if (activeTab === 'profile') content = renderProfile(activePostId || view.id);
        else if (activeTab === 'detail') content = renderDetail(activePostId);
        else if (activeTab === 'settings') content = renderForumSettings();
        else if (activeTab === 'relationships') content = renderRelationships();
        else if (activeTab === 'media') content = renderMedia();
        else if (activeTab === 'news-detail') content = renderNewsDetail();
        else if (activeTab === 'promotion') content = renderPromotionDetail();
        const title = activeTab === 'detail' ? '帖子' : activeTab === 'communities' ? '社区' : activeTab === 'chat' ? (activeThreadId ? account(activeThreadId).name : '聊天') : activeTab === 'notifications' ? '活动' : activeTab === 'profile' ? account(activePostId || view.id).name : activeTab === 'settings' ? '论坛设置' : activeTab === 'relationships' ? '关系图' : activeTab === 'media' ? '媒体' : activeTab === 'news-detail' ? '新闻讨论' : activeTab === 'promotion' ? '推广' : '论坛';
        const avatar = `<button class="lw-viewer-button" type="button" onclick="LivingWorld.openProfile('${escapeAttr(view.id)}')" aria-label="打开个人主页"><img class="lw-viewer-avatar" src="${escapeAttr(view.avatar || DEFAULT_AVATAR)}" onerror="this.src='${escapeAttr(DEFAULT_AVATAR)}'"></button>`;
        const header = activeTab === 'create' ? `<header class="lw-topbar lw-create-topbar"><button type="button" class="lw-close" onclick="LivingWorld.back()" aria-label="关闭"><i class="ri-close-line"></i></button><button type="button" class="lw-community-picker" onclick="LivingWorld.toggleCommunityPicker()">${escapeHtml(community(composeCommunityId || activeCommunity || loadState().communities[0]?.id).name || '选择社区')} <i class="ri-arrow-up-down-line"></i></button><span class="lw-topbar-spacer"></span><button type="submit" form="lw-create-form" class="lw-publish" id="lw-publish" disabled>发帖</button></header>`
            : activeTab === 'home' ? `<header class="lw-topbar lw-home-topbar"><button class="lw-menu-button" type="button" onclick="LivingWorld.toggleMenu()" aria-label="打开论坛菜单"><i class="ri-menu-line"></i>${unreadMessages() + unreadNotifications() ? '<span class="lw-menu-dot" aria-label="有未读消息"></span>' : ''}</button><button class="lw-search-pill" type="button" onclick="LivingWorld.toggleSearch(true)"><i class="ri-search-line"></i><span>搜索</span></button>${avatar}</header>`
            : activeTab === 'detail' ? `<header class="lw-topbar lw-detail-topbar"><button class="lw-close" type="button" onclick="LivingWorld.back()" aria-label="关闭帖子"><i class="ri-close-line"></i></button><span class="lw-topbar-spacer"></span><button class="lw-icon-button" type="button" onclick="LivingWorld.toggleCommentSort()" aria-label="切换评论排序"><i class="ri-equalizer-2-line"></i></button><button class="lw-icon-button" type="button" onclick="LivingWorld.toggleCommentSearch()" aria-label="搜索本帖评论"><i class="ri-search-line"></i></button><button class="lw-icon-button" type="button" onclick="LivingWorld.togglePostActions()" aria-label="帖子菜单"><i class="ri-more-2-fill"></i></button>${avatar}</header>`
            : `<header class="lw-topbar"><button class="lw-back" type="button" onclick="LivingWorld.back()" aria-label="返回"><i class="ri-arrow-left-line"></i></button>${activeTab === 'profile' ? `<button class="lw-profile-title" type="button" onclick="LivingWorld.togglePerspective(true)">${escapeHtml(title)} <i class="ri-arrow-down-s-line"></i></button>` : `<strong class="lw-title">${title}</strong>`}<span class="lw-topbar-spacer"></span>${activeTab === 'notifications' ? `<button class="lw-icon-button" type="button" onclick="LivingWorld.markAllRead()" aria-label="全部标为已读"><i class="ri-mail-check-line"></i></button>` : ''}${activeTab === 'chat' && !activeThreadId ? `<button class="lw-icon-button" type="button" onclick="LivingWorld.startMessage()" aria-label="新私信"><i class="ri-edit-line"></i></button>` : ''}${activeTab === 'profile' ? `<button class="lw-icon-button" type="button" onclick="LivingWorld.toggleSearch(true)" aria-label="搜索"><i class="ri-search-line"></i></button>${activePostId === view.id ? `<button class="lw-icon-button" type="button" onclick="LivingWorld.setTab('settings')" aria-label="论坛设置"><i class="ri-settings-3-line"></i></button>` : ''}` : ''}</header>`;
        const identityHint = view.id === 'user' ? '' : `<div class="lw-identity-hint">你正在使用 ${escapeHtml(view.name)} 的身份</div>`;
        root.innerHTML = `<div class="lw-shell ${activeTab === 'create' ? 'lw-compose-shell' : ''} ${['detail','news-detail','promotion'].includes(activeTab) ? 'lw-detail-shell' : ''}">${header}${activeTab === 'detail' ? (commentSearchOpen ? renderCommentSearch() : '') : (searchOpen && activeTab !== 'create' ? renderSearchBar() : '')}${identityHint}<main class="lw-main">${content}</main>${activeTab === 'create' || ['detail','news-detail','promotion'].includes(activeTab) || (activeTab === 'chat' && activeThreadId) ? '' : renderNav()}${renderPerspectiveSheet()}${renderMenu()}${renderComposeCommunityPicker()}${renderShareSheet()}${renderPostActionSheet()}${renderReplySheet()}${activeTab === 'relationships' ? renderRelationCard() : ''}<div id="lw-ama-picker" class="lw-ama-picker" hidden></div><div id="lw-toast" class="lw-toast" hidden></div></div>`;
        if (activeTab === 'relationships') { const viewport = root.querySelector('.lw-relation-viewport'); if (viewport) viewport.scrollLeft = Math.max(0,(viewport.scrollWidth - viewport.clientWidth) / 2); }
        const composer = root.querySelector('.lw-detail-composer, .lw-news-composer');
        if (composer) root.querySelector('.lw-shell')?.append(composer);
        if (activeTab === 'detail' && activePostId && !safeList(loadState().views[view.id]).includes(activePostId)) {
            try { recordView(activePostId, 'low'); } catch (error) { console.warn('论坛浏览记录保存失败', error); }
        }
        if (activeTab === 'home' && typeof IntersectionObserver !== 'undefined') {
            feedObserver = new IntersectionObserver(entries => { for (const entry of entries) { if (!entry.isIntersecting || entry.intersectionRatio < .65) continue; feedObserver?.unobserve(entry.target); const id = entry.target.dataset.postId; if (!id || safeList(loadState().views[view.id]).includes(id)) continue; try { mutate(next => { next.views[view.id] = [...safeList(next.views[view.id]),id].slice(-80); }); } catch (error) { console.warn('论坛浏览偏好保存失败',error); } } }, { root:root.querySelector('.lw-main'), threshold:.65 });
            root.querySelectorAll('.lw-feed .lw-post[data-post-id]').forEach(card => feedObserver.observe(card));
        }
    }
    function renderWorldEmpty() { return `<div class="lw-empty lw-world-empty"><i class="ri-chat-smile-2-line"></i><b>论坛正在等待第一批故事</b><p>社区、成员和帖子都会由当前 API 生成。你也可以先创建自己的社区。</p><button class="lw-empty-action" type="button" onclick="LivingWorld.generate({bootstrap:true})" ${isGenerating ? 'disabled' : ''}>${isGenerating ? '正在生成…' : '开始生成'}</button><button class="lw-text-action" type="button" onclick="LivingWorld.setTab('communities')">创建社区</button></div>`; }
    function renderFeedEmpty() { return `<div class="lw-empty lw-feed-empty"><span>${searchQuery ? '没有找到匹配的帖子' : '这个频道暂时没有新帖子'}</span>${searchQuery ? '<button class="lw-text-action" type="button" onclick="LivingWorld.clearSearch()">清除搜索</button>' : `<button class="lw-text-action" type="button" onclick="LivingWorld.progressWorld()" ${isGenerating ? 'disabled' : ''}>${isGenerating ? '正在推进…' : '让世界继续'}</button>`}</div>`; }
    function postMatchesSearch(post, query) { const text = `${post.deletedAt ? '该贴已删' : `${post.title || ''} ${post.body || ''}`} ${account(post.authorId).name} ${community(post.communityId).name}`.toLowerCase(); return text.includes(String(query || '').trim().toLowerCase()); }
    function promotionCandidates() { const world = loadState(); if (!world.forumSettings.promotionsEnabled) return []; const who = world.viewerId; const viewed = safeList(world.views[who]).slice(-30).map(id => world.posts.find(post => post.id === id)?.communityId).filter(Boolean); const searches = safeList(world.searches[who]).slice(0,5).map(value => String(value).toLowerCase()); return world.promotions.filter(item => !item.privateFor || item.privateFor === who).map(item => ({ item, score:safeList(item.targetCommunityIds).reduce((sum,id) => sum + viewed.filter(value => value === id).length * 3 + (safeList(world.subscriptions[who]).includes(id) ? 5 : 0) + (activeCommunity === id ? 8 : 0),0) + searches.reduce((sum,term) => sum + (term && `${item.headline} ${item.body}`.toLowerCase().includes(term) ? 4 : 0),0) })).sort((a,b) => b.score - a.score || b.item.createdAt - a.item.createdAt).map(row => row.item); }
    function renderPromotion(item) { return `<article class="lw-promotion" data-promotion-id="${escapeAttr(item.id)}"><div class="lw-promotion-label"><i class="ri-megaphone-line"></i> 推广 / Sponsored ${item.privateFor ? '· 仅你可见' : ''}</div><p class="lw-promotion-sponsor">${escapeHtml(item.sponsor)}</p><h2>${escapeHtml(item.headline)}</h2><p>${escapeHtml(item.body)}</p><button type="button" onclick="LivingWorld.openPromotion('${escapeAttr(item.id)}')">${escapeHtml(item.cta || '了解详情')} <i class="ri-arrow-right-line"></i></button></article>`; }
    function renderPromotionDetail() { const item = loadState().promotions.find(row => row.id === activePostId && (!row.privateFor || row.privateFor === viewer().id)); if (!item) return '<div class="lw-empty">这条推广不在你的可见范围内。</div>'; const destination = safeList(item.targetCommunityIds).find(id => loadState().communities.some(row => row.id === id)); return `<section class="lw-promotion-detail"><div class="lw-promotion-label">推广 / Sponsored ${item.privateFor ? '· 仅你可见' : ''}</div><p class="lw-promotion-sponsor">${escapeHtml(item.sponsor)}</p><h1>${escapeHtml(item.headline)}</h1><p>${escapeHtml(item.body)}</p><div>${escapeHtml(item.detail)}</div>${destination ? `<button type="button" onclick="LivingWorld.openCommunity('${escapeAttr(destination)}')">浏览 ${escapeHtml(community(destination).name)} <i class="ri-arrow-right-line"></i></button>` : ''}</section>`; }
    function openPromotion(id) { const item = loadState().promotions.find(row => row.id === id && (!row.privateFor || row.privateFor === viewer().id)); if (!item) return; try { mutate(next => { recordForumAction(next,'forum_promotion_open',next.viewerId,id,{ sponsor:item.sponsor },'low','private'); }); activePostId = id; activeTab = 'promotion'; render(); } catch (error) { showToast(error.message); } }
    function renderFeedWithPromotions(rows) { const ads = searchQuery ? [] : promotionCandidates(); if (!ads.length) return rows.map(post => postCard(post)).join(''); const settings = loadState().forumSettings; const min = Math.max(4, Math.min(30, Number(settings.promotionMinGap || 8))); const max = Math.max(min, Math.min(30, Number(settings.promotionMaxGap || 15))); const seed = `${viewer().id}:${Math.floor(now() / DAY)}:${rows[0]?.id || ''}`.split('').reduce((sum,char) => sum + char.charCodeAt(0),0); let nextGap = min + seed % (max - min + 1); let count = 0; let adIndex = 0; return rows.map(post => { count++; let markup = postCard(post); if (count >= nextGap) { markup += renderPromotion(ads[adIndex % ads.length]); adIndex++; count = 0; nextGap = min + (seed + adIndex * 7) % (max - min + 1); } return markup; }).join(''); }
    function renderHome() { const communities = loadState().communities; const rows = searchQuery ? feed().filter(post => postMatchesSearch(post, searchQuery)) : feed(); return communities.length ? `<nav class="lw-filter-row" aria-label="帖子分类"><button class="lw-category-tab ${!activeCommunity ? 'active' : ''}" onclick="LivingWorld.setCommunity('')">推荐</button>${communities.map(item => `<button class="lw-category-tab ${activeCommunity === item.id ? 'active' : ''}" onclick="LivingWorld.setCommunity('${escapeAttr(item.id)}')">${escapeHtml(item.name)}</button>`).join('')}</nav><div class="lw-feed">${renderFeedWithPromotions(rows) || renderFeedEmpty()}</div>` : renderWorldEmpty(); }
    function renderCommunities() { const rows = loadState().communities; const subscribed = safeList(loadState().subscriptions[viewer().id]); return `<section class="lw-community-page"><div class="lw-inbox-title"><h1>社区</h1><button type="button" onclick="LivingWorld.toggleCommunityForm()"><i class="ri-add-line"></i> 创建</button></div><p>探索感兴趣的话题，进入社区阅读和发帖。</p><form id="lw-community-form" class="lw-community-form" onsubmit="return LivingWorld.createCommunity(event)" hidden><input id="lw-community-name" maxlength="40" required placeholder="社区名称" aria-label="社区名称"><input id="lw-community-description" maxlength="160" required placeholder="介绍这个社区" aria-label="社区介绍"><button type="submit">创建社区</button></form><div class="lw-community-list">${rows.map(item => { const count = loadState().posts.filter(post => post.communityId === item.id).length; return `<div class="lw-community-row"><button type="button" class="lw-community-enter" onclick="LivingWorld.openCommunity('${escapeAttr(item.id)}')"><i class="lw-community-icon ${escapeAttr(item.icon || 'ri-community-line')}"></i><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.description)} · ${count} 帖</small></span></button><button type="button" class="lw-subscribe ${subscribed.includes(item.id) ? 'on' : ''}" onclick="LivingWorld.toggleSubscribe('${escapeAttr(item.id)}')">${subscribed.includes(item.id) ? '已加入' : '加入'}</button></div>`; }).join('') || '<div class="lw-empty">还没有社区。创建一个社区，或返回首页生成论坛故事。</div>'}</div></section>`; }
    function renderAmaComposer() { return `<section class="lw-ama-card" id="lw-ama-card" hidden><div class="lw-ama-head"><strong>AMA <i class="ri-information-line" title="限时问答，到期后从公开页面消失"></i></strong><button type="button" onclick="LivingWorld.toggleAma(false)" aria-label="关闭 AMA"><i class="ri-close-line"></i></button></div><input id="lw-ama-start-mode" type="hidden" value="now"><button class="lw-ama-choice" type="button" onclick="LivingWorld.openAmaPicker('start')" aria-label="选择开始时间"><span>开始时间</span><b id="lw-ama-start-label">立即开始</b><i class="ri-arrow-down-s-line" aria-hidden="true"></i></button><input id="lw-ama-start-at" class="lw-ama-date" type="datetime-local" aria-label="AMA 开始时间" hidden><input id="lw-ama-duration" type="hidden" value="4"><button class="lw-ama-choice" type="button" onclick="LivingWorld.openAmaPicker('duration')" aria-label="选择持续时间"><span>持续时间</span><b id="lw-ama-duration-label">4 小时</b><i class="ri-arrow-down-s-line" aria-hidden="true"></i></button><div class="lw-ama-selfie"><button type="button" onclick="document.getElementById('lw-image-file').click()"><i class="ri-camera-line"></i><i class="ri-image-line"></i></button><b>添加自拍（可选）</b><small>用照片介绍本次 AMA。结束后帖子会从公开页面消失，历史记录仍保留。</small></div></section>`; }
    function renderCreate() { const communities = loadState().communities; if (!communities.length) return renderWorldEmpty(); return `<form id="lw-create-form" class="lw-create-form" onsubmit="return LivingWorld.createPost(event)"><select id="lw-post-community" aria-label="选择社区" onchange="LivingWorld.updateCompose()">${communities.map(item => `<option value="${escapeAttr(item.id)}" ${item.id === (composeCommunityId || activeCommunity || communities[0].id) ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select><input id="lw-post-title" maxlength="120" required placeholder="标题" aria-label="标题" oninput="LivingWorld.updateCompose()">${renderAmaComposer()}<textarea id="lw-post-body" maxlength="3000" placeholder="正文文本（可选）" aria-label="正文文本" oninput="LivingWorld.updateCompose()"></textarea>${draftImage ? `<div class="lw-draft-image"><img src="${escapeAttr(draftImage)}" alt="待发布图片"><button type="button" onclick="LivingWorld.removeDraftImage()" aria-label="移除图片"><i class="ri-close-line"></i></button></div>` : ''}<div id="lw-poll-fields" class="lw-poll-fields" hidden><b>投票选项</b><input class="lw-poll-option" maxlength="80" placeholder="选项 1"><input class="lw-poll-option" maxlength="80" placeholder="选项 2"><button type="button" onclick="LivingWorld.addPollOption()">添加选项</button></div><input id="lw-post-image" type="url" maxlength="800" placeholder="图片链接" aria-label="图片或视频链接" hidden><div class="lw-compose-tools"><button type="button" onclick="LivingWorld.toggleLinkInput('image')" aria-label="添加链接"><i class="ri-link"></i></button><button type="button" onclick="document.getElementById('lw-image-file').click()" aria-label="添加图片"><i class="ri-image-line"></i></button><button type="button" onclick="LivingWorld.toggleLinkInput('video')" aria-label="添加视频"><i class="ri-video-line"></i></button><button type="button" onclick="LivingWorld.togglePoll()" aria-label="添加投票"><i class="ri-list-radio"></i></button><button type="button" id="lw-ama-button" onclick="LivingWorld.toggleAma()" aria-label="问我任何事"><strong>ama</strong></button><input id="lw-image-file" type="file" accept="image/*" hidden onchange="LivingWorld.pickImage(this)"></div></form>`; }
    function renderSearchBar() { const recent = safeList(loadState().searches[viewer().id]).slice(0, 4); return `<div class="lw-search-area"><form class="lw-searchbar" role="search" onsubmit="return LivingWorld.submitSearch(event)"><i class="ri-search-line"></i><input id="lw-search-input" value="${escapeAttr(searchQuery)}" autocomplete="off" placeholder="搜索" aria-label="搜索"><button type="button" onclick="LivingWorld.clearSearch()" aria-label="清除搜索"><i class="ri-close-line"></i></button></form>${!searchQuery && recent.length ? `<div class="lw-recent-searches">${recent.map(term => `<button type="button" data-term="${escapeAttr(term)}" onclick="LivingWorld.searchFor(this.dataset.term)">${escapeHtml(term)}</button>`).join('')}</div>` : ''}</div>`; }
    function forumMessageMarkup(body) { return String(body || '').split(/(bynd:\/\/forum\/post\/[A-Za-z0-9_.:%-]+)/g).map(part => /^bynd:\/\/forum\/post\//.test(part) ? `<button class="lw-inline-post-link" type="button" data-link="${escapeAttr(part)}" onclick="LivingWorld.openPostLink(this.dataset.link)">${escapeHtml(part)}</button>` : escapeHtml(part)).join(''); }
    function renderChat() {
        if (activeThreadId) { const peer = account(activeThreadId); const rows = messageThread(activeThreadId); const status = dmReplyStatuses.get(activeThreadId); return `<section class="lw-thread"><div class="lw-thread-person"><img class="lw-avatar" src="${escapeAttr(peer.avatar || DEFAULT_AVATAR)}" onerror="this.src='${escapeAttr(DEFAULT_AVATAR)}'"><b>${escapeHtml(peer.name)}</b><span>${escapeHtml(peer.username || '')}</span></div><div class="lw-thread-messages">${rows.map(item => `<div class="lw-message ${item.fromId === viewer().id ? 'mine' : ''}"><p>${forumMessageMarkup(item.body)}</p><time>${timeAgo(item.createdAt)}</time></div>`).join('') || '<p class="lw-thread-empty">这是你们的私信。发一条消息开始聊天。</p>'}${status ? `<div class="lw-dm-status">${status.busy ? '对方正在回复…' : `${escapeHtml(status.error || '回复暂时不可用。')} <button type="button" onclick="LivingWorld.retryDirectReply()">重试回复</button>`}</div>` : ''}</div><form class="lw-message-composer" onsubmit="return LivingWorld.sendMessage(event)"><input id="lw-message-input" maxlength="2000" required placeholder="${viewer().id === 'user' ? '输入消息' : `以 ${escapeAttr(viewer().name)} 的身份输入消息`}" aria-label="输入私信"><button type="submit" aria-label="发送私信"><i class="ri-send-plane-fill"></i></button></form></section>`; }
        const who = viewer().id; const peers = [...new Set(loadState().messages.filter(item => item.fromId === who || item.toId === who).map(item => item.fromId === who ? item.toId : item.fromId))].map(id => ({ id, latest: messageThread(id).at(-1) })).sort((a,b) => b.latest.createdAt - a.latest.createdAt);
        return `<section class="lw-inbox"><div class="lw-inbox-title"><h1>聊天</h1><button type="button" onclick="LivingWorld.startMessage()"><i class="ri-edit-line"></i> 新私信</button></div>${peers.map(row => { const person = account(row.id); const unread = loadState().messages.filter(item => item.fromId === row.id && item.toId === who && !item.readAt).length; return `<button class="lw-conversation" type="button" onclick="LivingWorld.openThread('${escapeAttr(row.id)}')"><img class="lw-avatar" src="${escapeAttr(person.avatar || DEFAULT_AVATAR)}" onerror="this.src='${escapeAttr(DEFAULT_AVATAR)}'"><span><b>${escapeHtml(person.name)} ${unread ? `<em>${unread}</em>` : ''}</b><small>${escapeHtml(row.latest.body)}</small></span><time>${timeAgo(row.latest.createdAt)}</time></button>`; }).join('') || `<div class="lw-empty"><i class="ri-chat-3-line"></i><h2>还没有私信</h2><p>与论坛里的成员开始一段私密对话。</p><button class="lw-empty-action" type="button" onclick="LivingWorld.startMessage()">新私信</button></div>`}</section>`;
    }
    function renderNotifications() { const rows = safeList(loadState().notifications[viewer().id]); return `<section class="lw-activity"><div class="lw-activity-tabs"><button class="${activityTab === 'notifications' ? 'active' : ''}" onclick="LivingWorld.setActivityTab('notifications')">通知${unreadNotifications() ? `<em>${unreadNotifications()}</em>` : ''}</button><button class="${activityTab === 'chat' ? 'active' : ''}" onclick="LivingWorld.setActivityTab('chat')">聊天${unreadMessages() ? `<em>${unreadMessages()}</em>` : ''}</button></div>${activityTab === 'chat' ? renderChat() : rows.map(item => `<button class="lw-note ${item.read ? '' : 'unread'}" type="button" onclick="LivingWorld.openNotice('${escapeAttr(item.id)}')"><i class="ri-notification-3-line"></i><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail)} · ${timeAgo(item.createdAt)}</small></span></button>`).join('') || '<div class="lw-empty"><i class="ri-notification-3-line"></i><h2>暂无通知</h2><p>有人回复或赞同你的帖子时，会显示在这里。</p></div>'}</section>`; }
    function commentVoteCount(comment) { return Object.values(comment.votes || {}).filter(value => Number(value) === 1 || Number(value) === -1).length; }
    function renderCommentTree(postId) {
        const allComments = commentsFor(postId); const comments = commentQuery ? allComments.filter(row => `${row.body} ${account(row.authorId).name}`.toLowerCase().includes(commentQuery.toLowerCase())) : allComments; const visible = new Set();
        const renderRow = (comment, depth = 0) => { if (visible.has(comment.id)) return ''; visible.add(comment.id); const author = account(comment.authorId); const children = commentQuery ? [] : comments.filter(row => row.parentCommentId === comment.id); const vote = Number(comment.votes?.[viewer().id] || 0); return `<article class="lw-detail-comment" data-comment-id="${escapeAttr(comment.id)}" style="--comment-depth:${Math.min(depth,4)}"><div class="lw-comment-head">${avatarMarkup(author)}<button type="button" onclick="LivingWorld.openProfile('${escapeAttr(author.id)}')">${escapeHtml(author.name)}</button><small>· ${timeAgo(comment.createdAt)}</small></div><p>${escapeHtml(comment.body)}</p>${comment.mediaUrl && comment.mediaType === 'image' ? `<img class="lw-comment-media" src="${escapeAttr(comment.mediaUrl)}" alt="评论图片" loading="lazy">` : ''}${comment.mediaUrl && comment.mediaType === 'video' ? `<video class="lw-comment-media" controls preload="metadata" src="${escapeAttr(comment.mediaUrl)}"></video>` : ''}${comment.mediaUrl && comment.mediaType === 'link' ? `<a class="lw-comment-link" href="${escapeAttr(comment.mediaUrl)}" target="_blank" rel="noopener noreferrer">查看链接 <i class="ri-external-link-line"></i></a>` : ''}<div class="lw-comment-actions"><button type="button" onclick="LivingWorld.replyToComment('${escapeAttr(comment.id)}')"><i class="ri-reply-line"></i> 回复</button><button type="button" class="${vote === 1 ? 'on' : ''}" onclick="LivingWorld.voteComment('${escapeAttr(comment.id)}',1)" aria-label="赞同评论"><i class="ri-arrow-up-line"></i></button><span>${commentVoteCount(comment)}</span><button type="button" class="${vote === -1 ? 'on' : ''}" onclick="LivingWorld.voteComment('${escapeAttr(comment.id)}',-1)" aria-label="反对评论"><i class="ri-arrow-down-line"></i></button></div>${children.map(child => renderRow(child,depth + 1)).join('')}</article>`; };
        const roots = comments.filter(row => commentQuery || !row.parentCommentId || !comments.some(parent => parent.id === row.parentCommentId));
        roots.sort((a,b) => commentSort === 'new' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt);
        return roots.map(row => renderRow(row)).join('') || `<p class="lw-no-comments">${commentQuery ? '没有匹配的评论' : loadState().posts.find(post => post.id === postId)?.deletedAt ? '删除前没有回复。' : '成为第一个回复的人'}</p>`;
    }
    function renderDetail(postId) {
        const post = loadState().posts.find(item => item.id === postId);
        if (!post || !isVisible(post,viewer().id)) return '<div class="lw-empty">这条帖子已经不在你的可见范围内。</div>';
        const author = account(post.authorId); const place = community(post.communityId); const joined = safeList(loadState().subscriptions[viewer().id]).includes(post.communityId);
        const pending = !!(post.ama && post.amaStartsAt > now());
        const title = showPostTranslation && post.translatedTitle ? post.translatedTitle : post.title;
        const body = showPostTranslation && post.translatedBody ? post.translatedBody : post.body;
        const amaBadge = post.ama ? `<div class="lw-ama-status"><i class="ri-time-line"></i> AMA · ${pending ? `将于 ${new Date(post.amaStartsAt).toLocaleString('zh-CN')} 开始` : `进行中 · ${new Date(post.expiresAt).toLocaleString('zh-CN')} 结束后从公开页面消失`}</div>` : '';
        return `<section class="lw-detail"><article class="lw-detail-post"><div class="lw-detail-post-head">${avatarMarkup(author)}<div><button type="button" onclick="LivingWorld.openCommunity('${escapeAttr(place.id)}')">r/${escapeHtml(place.name)}</button><span><button type="button" onclick="LivingWorld.openProfile('${escapeAttr(author.id)}')">${escapeHtml(author.username || author.name)}</button> · ${timeAgo(post.createdAt)}</span></div>${!joined ? `<button class="lw-detail-join" type="button" onclick="LivingWorld.toggleSubscribe('${escapeAttr(place.id)}')">订阅</button>` : ''}</div>${post.deletedAt ? `<h1>该贴已删</h1><p class="lw-deleted-note">内容已从公开页面移除；先前留下的回复和记录仍在。</p>` : `${amaBadge}<h1>${escapeHtml(title)}</h1>${post.imageUrl && post.mediaType !== 'video' ? `<img class="lw-detail-image" src="${escapeAttr(post.imageUrl)}" alt="帖子图片" loading="lazy">` : ''}${post.imageUrl && post.mediaType === 'video' ? `<video class="lw-detail-image" controls preload="metadata" src="${escapeAttr(post.imageUrl)}"></video>` : ''}${body ? `<p class="lw-detail-body">${escapeHtml(body)}</p>` : ''}${post.poll ? renderPoll(post) : ''}<div class="lw-detail-actions"><div class="lw-vote-pill"><button class="${myVote(post) === 1 ? 'is-on' : ''}" type="button" onclick="LivingWorld.vote('${escapeAttr(post.id)}',1)" aria-label="赞同"><i class="ri-arrow-up-line"></i></button><b>${postVotes(post)}</b><span></span><button class="${myVote(post) === -1 ? 'is-on' : ''}" type="button" onclick="LivingWorld.vote('${escapeAttr(post.id)}',-1)" aria-label="反对"><i class="ri-arrow-down-line"></i></button></div><button type="button" onclick="LivingWorld.openReplyComposer()" ${pending ? 'disabled' : ''}><i class="ri-chat-3-line"></i> ${commentsFor(postId).length}</button><button type="button" onclick="LivingWorld.sharePost('${escapeAttr(post.id)}')" aria-label="分享帖子"><i class="ri-share-forward-line"></i></button></div>`}</article><div class="lw-detail-comments"><div class="lw-detail-comments-heading"><h2>${commentQuery ? `匹配 ${commentsFor(postId).filter(row => `${row.body} ${account(row.authorId).name}`.toLowerCase().includes(commentQuery.toLowerCase())).length} 条评论` : `${commentsFor(postId).length} 条评论`}</h2><button type="button" onclick="LivingWorld.toggleCommentSort()">${commentSort === 'new' ? '最新' : '最早'} <i class="ri-arrow-down-s-line"></i></button></div>${renderCommentTree(postId)}</div>${post.deletedAt || pending ? '' : `<button class="lw-detail-composer" type="button" onclick="LivingWorld.openReplyComposer()"><i class="ri-add-line"></i><span>加入对话</span></button>`}</section>`;
    }
    function renderCommentSearch() { return `<form class="lw-comment-search" role="search" onsubmit="return LivingWorld.submitCommentSearch(event)"><i class="ri-search-line"></i><input id="lw-comment-search" value="${escapeAttr(commentQuery)}" placeholder="搜索本帖评论" aria-label="搜索本帖评论"><button type="submit">搜索</button><button type="button" onclick="LivingWorld.clearCommentSearch()" aria-label="清除评论搜索"><i class="ri-close-line"></i></button></form>`; }
    function toggleCommentSearch() { commentSearchOpen = !commentSearchOpen; if (!commentSearchOpen) commentQuery = ''; render(); if (commentSearchOpen) document.getElementById('lw-comment-search')?.focus(); }
    function submitCommentSearch(event) { event.preventDefault(); commentQuery = document.getElementById('lw-comment-search')?.value.trim() || ''; render(); return false; }
    function clearCommentSearch() { commentQuery = ''; commentSearchOpen = false; render(); }
    function renderReplySheet() { if (activeTab !== 'detail' || !replyComposerOpen) return ''; const post = loadState().posts.find(item => item.id === activePostId); if (!post || post.deletedAt || !isVisible(post,viewer().id)) return ''; const parent = loadState().comments.find(item => item.id === replyTargetId && item.postId === post.id); return `<div class="lw-reply-shade" onclick="if(event.target===this)LivingWorld.closeReplyComposer()"><form class="lw-reply-sheet" onsubmit="return LivingWorld.reply(event,'${escapeAttr(post.id)}')"><div class="lw-reply-grip"></div><div class="lw-reply-context"><span>正在评论 <b>${escapeHtml(parent ? parent.body.slice(0,60) : post.title.slice(0,60))}</b></span><button type="button" onclick="LivingWorld.closeReplyComposer()" aria-label="收起评论框"><i class="ri-contract-up-down-line"></i></button></div><textarea id="lw-reply" maxlength="1600" required placeholder="加入对话" aria-label="回复帖子" oninput="LivingWorld.updateReplyDraft(this.value)">${escapeHtml(replyDraft)}</textarea>${replyDraftImage ? `<div class="lw-reply-preview"><img src="${escapeAttr(replyDraftImage)}" alt="待发送图片"><button type="button" onclick="LivingWorld.clearReplyMedia()" aria-label="移除图片"><i class="ri-close-line"></i></button></div>` : ''}${replyMediaKind && replyMediaKind !== 'image' ? `<input id="lw-reply-media-url" type="url" placeholder="${replyMediaKind === 'video' ? '视频链接（https://）' : replyMediaKind === 'gif' ? 'GIF 链接（https://）' : '链接（https://）'}" aria-label="附件链接" required>` : ''}<div class="lw-reply-tools"><button type="button" onclick="LivingWorld.setReplyMedia('link')" aria-label="添加链接"><i class="ri-link"></i></button><button type="button" onclick="document.getElementById('lw-reply-file').click()" aria-label="添加图片"><i class="ri-image-line"></i></button><button type="button" onclick="LivingWorld.setReplyMedia('gif')" aria-label="添加 GIF"><b>GIF</b></button><button type="button" onclick="LivingWorld.setReplyMedia('video')" aria-label="添加视频"><i class="ri-video-line"></i></button><input id="lw-reply-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onchange="LivingWorld.pickReplyImage(this)"><span></span><button class="lw-reply-send" type="submit" ${replyDraft.trim() ? '' : 'disabled'} aria-label="发送回复"><i class="ri-send-plane-2-fill"></i></button></div></form></div>`; }
    function openReplyComposer(id = '') { if (id) replyTargetId = id; replyComposerOpen = true; render(); document.getElementById('lw-reply')?.focus(); }
    function closeReplyComposer() { replyComposerOpen = false; replyTargetId = ''; render(); }
    function updateReplyDraft(value) { replyDraft = String(value || '').slice(0,1600); const button = document.querySelector('.lw-reply-send'); if (button) button.disabled = !replyDraft.trim(); }
    function setReplyMedia(kind) { replyMediaKind = replyMediaKind === kind ? '' : kind; replyDraftImage = ''; render(); document.getElementById('lw-reply-media-url')?.focus(); }
    function clearReplyMedia() { replyMediaKind = ''; replyDraftImage = ''; render(); }
    function pickReplyImage(input) { const file = input?.files?.[0]; if (!file) return; if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type) || file.size > 1024 * 1024) { showToast('评论图片需小于 1 MB。'); return; } const reader = new FileReader(); reader.onload = () => { replyDraftImage = String(reader.result || ''); replyMediaKind = 'image'; render(); }; reader.onerror = () => showToast('图片读取失败。'); reader.readAsDataURL(file); }
    function toggleCommentSort() { commentSort = commentSort === 'new' ? 'old' : 'new'; render(); }
    function replyToComment(id) { const comment = commentsFor(activePostId).find(row => row.id === id); if (!comment) return; openReplyComposer(id); }
    function clearReplyTarget() { replyTargetId = ''; render(); }
    function voteComment(id,direction) { if (![1,-1].includes(direction)) return; try { mutate(next => { const comment = next.comments.find(row => row.id === id); if (!comment || next.posts.find(post => post.id === comment.postId)?.deletedAt) throw new Error('评论不可投票。'); comment.votes ||= {}; const previous = Number(comment.votes[next.viewerId] || 0); if (previous === direction) delete comment.votes[next.viewerId]; else comment.votes[next.viewerId] = direction; if (direction === 1 && previous !== 1) recordForumAction(next,'forum_comment_like',next.viewerId,id,{ postId:comment.postId },'low'); }); render(); } catch (error) { showToast(error.message); } }
    function npcInteractionCount(npcId, world = loadState()) {
        const postAuthors = new Map(world.posts.map(post => [post.id, post.authorId]));
        const betweenPosts = world.comments.filter(item => (item.authorId === npcId && postAuthors.get(item.postId) === 'user') || (item.authorId === 'user' && postAuthors.get(item.postId) === npcId)).length;
        const privateMessages = world.messages.filter(item => (item.fromId === 'user' && item.toId === npcId) || (item.toId === 'user' && item.fromId === npcId)).length;
        const userVotes = world.posts.filter(post => post.authorId === npcId && (post.votes?.user === 1 || safeList(post.likedBy).includes('user'))).length;
        const follows = safeList(world.follows.user).includes(npcId) ? 1 : 0;
        return betweenPosts + privateMessages + userVotes + follows;
    }
    function canPromoteNpc(npc) { return !!(npc && npc.type === 'npc' && !npc.contactCharId && (npc.tier === 'persistent' || npcInteractionCount(npc.id) >= 4)); }
    function renderProfileCommunities(id) {
        const world = loadState();
        const rows = world.communities.map(item => ({ ...item, postCount: world.posts.filter(post => post.authorId === id && post.communityId === item.id && isVisible(post, viewer().id)).length })).filter(item => item.postCount > 0).sort((a, b) => b.postCount - a.postCount).slice(0, 4);
        if (!rows.length) return '';
        return `<section class="lw-profile-section"><div class="lw-profile-section-heading"><h2>活跃社区</h2><span>${rows.length} 个</span></div><div class="lw-profile-community-row">${rows.map(item => `<button class="lw-profile-community" type="button" onclick="LivingWorld.openCommunity('${escapeAttr(item.id)}')"><i class="${escapeAttr(item.icon || 'ri-community-line')}"></i><b>${escapeHtml(item.name)}</b><small>${item.postCount} 帖</small></button>`).join('')}</div></section>`;
    }
    function profileMetrics(id) {
        const world = loadState();
        const following = safeList(world.follows[id]).length;
        const knownFollowers = Object.values(world.follows).filter(list => safeList(list).includes(id)).length;
        const suggestedFollowers = Number(account(id).followerCount);
        const followers = Math.max(knownFollowers, Number.isSafeInteger(suggestedFollowers) && suggestedFollowers >= 0 ? suggestedFollowers : 0);
        const authored = world.posts.filter(post => post.authorId === id && isVisible(post,id));
        const replies = world.comments.filter(item => item.authorId === id).length;
        const media = authored.filter(post => post.imageUrl).length;
        return { following, followers, communities: new Set(authored.map(post => post.communityId)).size, posts: authored.length, replies, media };
    }
    function renderProfile(id) {
        const who = account(id); const mine = viewer().id === id; const npc = loadState().npcs.find(item => item.id === id); const posts = loadState().posts.filter(post => post.authorId === id && isVisible(post, viewer().id)); const metrics = profileMetrics(id);
        const contactControl = !mine && npc && viewer().id === 'user' ? (npc.contactCharId ? '<p class="lw-form-note">已成为你的联系人。</p>' : canPromoteNpc(npc) ? `<button class="lw-submit" type="button" onclick="LivingWorld.promoteNpc('${escapeAttr(npc.id)}')">添加为联系人</button>` : '<p class="lw-form-note">持续互动后，TA 会逐渐成为可添加的联系人。</p>') : '';
        // “我的” is the current-perspective feed, not a character sheet.
        // Keep role/persona copy out of it; public profiles may expose a shared summary.
        const publicSummary = loadState().profileEdits[id]?.summary || who.summary || (npc ? npc.summary || '' : '');
        const following = safeList(loadState().follows[viewer().id]).includes(id);
        const blocked = safeList(viewer().blocked).includes(id);
        const controls = mine ? `<button type="button" onclick="LivingWorld.editProfile()">编辑</button><button type="button" onclick="LivingWorld.setTab('create')">创建</button>` : blocked ? `<button type="button" onclick="LivingWorld.toggleBlock('${escapeAttr(id)}')">解除屏蔽</button>` : `<button type="button" onclick="LivingWorld.openThread('${escapeAttr(id)}')">私信</button><button type="button" onclick="LivingWorld.toggleBlock('${escapeAttr(id)}')">屏蔽</button><button type="button" class="primary" onclick="LivingWorld.toggleFollow('${escapeAttr(id)}')">${following ? '已关注' : '关注'}</button>`;
        const editForm = mine && profileEditOpen ? `<form class="lw-profile-editor" onsubmit="return LivingWorld.saveProfile(event)"><h2>编辑论坛资料</h2><label>显示名称<input id="lw-profile-name" maxlength="40" required value="${escapeAttr(who.name)}"></label><label>@ 昵称<input id="lw-profile-username" maxlength="32" required value="${escapeAttr(who.username || '@member')}" placeholder="@你的昵称"></label><label>简介<textarea id="lw-profile-summary" maxlength="220" placeholder="介绍一下自己">${escapeHtml(publicSummary)}</textarea></label><label>头像链接（可选）<input id="lw-profile-avatar-url" type="url" maxlength="800" placeholder="https://" value="${/^https?:\/\//i.test(who.avatar || '') ? escapeAttr(who.avatar) : ''}"></label><label class="lw-profile-upload">或选择本地头像<input id="lw-profile-avatar-file" type="file" accept="image/*" onchange="LivingWorld.pickProfileAvatar(this)"></label>${draftProfileAvatar ? '<small>已选择本地头像</small>' : ''}<div><button type="button" onclick="LivingWorld.editProfile(false)">取消</button><button type="submit">保存</button></div></form>` : '';
        let rows = posts;
        if (profileTab === 'media') rows = posts.filter(post => post.imageUrl);
        if (profileTab === 'saved') rows = loadState().posts.filter(post => safeList(post.bookmarkedBy).includes(id) && isVisible(post, viewer().id));
        const replies = loadState().comments.filter(item => item.authorId === id && loadState().posts.some(post => post.id === item.postId && isVisible(post, viewer().id))).slice().reverse();
        return `<section class="lw-profile-identity"><div class="lw-profile-controls">${controls}</div>${avatarMarkup(who,'lw-profile-avatar')}<h1>${escapeHtml(who.name)}</h1><p>${escapeHtml(who.username || '@member')} · ${metrics.followers} 位粉丝</p>${publicSummary ? `<p class="lw-profile-summary">${escapeHtml(publicSummary)}</p>` : ''}${id !== 'user' ? `<button class="lw-profile-ai-refresh" type="button" onclick="LivingWorld.refreshProfile('${escapeAttr(id)}')">更新公开资料</button>` : ''}${contactControl}${editForm}</section><div class="lw-profile-stats"><span><b>${metrics.posts}</b><small>发帖数量</small></span><span><b>${metrics.following}</b><small>关注</small></span><span><b>${metrics.followers}</b><small>粉丝</small></span></div><section class="lw-profile-section lw-profile-posts"><nav class="lw-profile-tabs" aria-label="主页内容">${[['posts','帖子'],['replies','评论'],['media','媒体'],['saved','收藏']].map(([key,label]) => `<button type="button" class="${profileTab === key ? 'active' : ''}" onclick="LivingWorld.setProfileTab('${key}')">${label}</button>`).join('')}</nav><div class="lw-feed lw-profile-feed">${profileTab === 'replies' ? replies.map(item => `<button class="lw-profile-reply" type="button" onclick="LivingWorld.openPost('${escapeAttr(item.postId)}')"><b>${escapeHtml(loadState().posts.find(post => post.id === item.postId)?.deletedAt ? '该贴已删' : loadState().posts.find(post => post.id === item.postId)?.title || '帖子')}</b><p>${escapeHtml(item.body)}</p><small>${timeAgo(item.createdAt)}</small></button>`).join('') || '<div class="lw-empty">还没有评论。</div>' : rows.map(post => postCard(post)).join('') || `<div class="lw-empty lw-profile-empty"><i class="ri-chat-smile-2-line"></i><h2>${profileTab === 'saved' ? '还没有收藏的帖子' : profileTab === 'media' ? '还没有媒体帖子' : profileTab === 'replies' ? '还没有评论' : mine ? '你还没有任何帖子' : '这里还没有帖子'}</h2><p>${mine ? '在社区中发帖后，内容会显示在这里。' : '等 TA 发帖后再来看看。'}</p>${mine && profileTab === 'posts' ? `<button type="button" class="lw-empty-action" onclick="LivingWorld.setTab('create')">创建帖子</button>` : ''}</div>`}</div></section>`;
    }
    function renderNav() { const items = [['home','主页','ri-home-5-line'],['create','创建','ri-add-line'],['notifications','收件箱','ri-notification-3-line'],['profile','你','ri-user-3-line']]; return `<nav class="lw-nav" aria-label="论坛导航">${items.map(([id,label,icon]) => `<button type="button" aria-label="${label}" title="${label}" class="${activeTab === id || (id === 'notifications' && activeTab === 'chat') ? 'active ' : ''}" onclick="LivingWorld.setTab('${id}')"><i class="${icon}" aria-hidden="true"></i>${id === 'notifications' && unreadMessages() + unreadNotifications() ? '<em class="lw-nav-dot"></em>' : ''}</button>`).join('')}</nav>`; }
    function renderMenu() { return menuOpen ? `<div class="lw-menu-shade" onclick="if(event.target===this)LivingWorld.toggleMenu(false)"><section class="lw-menu-panel" role="dialog" aria-label="论坛菜单"><h2>论坛</h2><button onclick="LivingWorld.menuGo('home')"><i class="ri-home-5-line"></i> 首页</button><button onclick="LivingWorld.menuGo('communities')"><i class="ri-group-line"></i> 社区</button><button onclick="LivingWorld.menuGo('media')"><i class="ri-newspaper-line"></i> 媒体与新闻</button><button onclick="LivingWorld.menuGo('relationships')"><i class="ri-node-tree"></i> 关系图</button><button onclick="LivingWorld.menuGo('settings')"><i class="ri-settings-3-line"></i> 论坛设置</button><button onclick="LivingWorld.returnToDesktop()"><i class="ri-apps-line"></i> 返回桌面</button></section></div>` : ''; }
    function renderComposeCommunityPicker() { if (!communityPickerOpen || activeTab !== 'create') return ''; const selected = document.getElementById('lw-post-community')?.value || composeCommunityId || activeCommunity; return `<div class="lw-community-sheet" onclick="if(event.target===this)LivingWorld.toggleCommunityPicker(false)"><section class="lw-community-panel" role="dialog" aria-modal="true" aria-label="选择发帖社区"><div class="lw-community-panel-head"><h2>选择社区</h2><button type="button" onclick="LivingWorld.toggleCommunityPicker(false)" aria-label="关闭"><i class="ri-close-line"></i></button></div><div class="lw-compose-community-list">${loadState().communities.map(item => `<button type="button" class="${item.id === selected ? 'selected' : ''}" onclick="LivingWorld.selectComposeCommunity('${escapeAttr(item.id)}')"><i class="${escapeAttr(item.icon || 'ri-community-line')}"></i><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.description)}</small></span>${item.id === selected ? '<i class="ri-check-line"></i>' : ''}</button>`).join('')}</div><button type="button" class="lw-community-new" onclick="LivingWorld.showComposeCommunityForm()"><i class="ri-add-line"></i> 创建社区</button><form id="lw-compose-community-form" onsubmit="return LivingWorld.createCommunity(event)" hidden><input id="lw-community-name" maxlength="40" required placeholder="社区名称" aria-label="社区名称"><textarea id="lw-community-description" maxlength="160" required placeholder="介绍这个社区" aria-label="社区介绍"></textarea><button type="submit">创建并选择</button></form></section></div>`; }
    function postLink(id) { return `bynd://forum/post/${encodeURIComponent(id)}`; }
    function postIdFromLink(link) { const match = /^bynd:\/\/forum\/post\/([^/?#\s]+)$/i.exec(String(link || '').trim()); if (!match) return ''; try { return decodeURIComponent(match[1]); } catch (_) { return ''; } }
    function getPostPreview(link) { const id = postIdFromLink(link); if (!id) return null; const world = loadState(); const post = world.posts.find(item => item.id === id); if (!post || !isVisible(post,'user')) return null; const group = world.communities.find(item => item.id === post.communityId); const author = world.accounts[post.authorId] || world.npcs.find(item => item.id === post.authorId); return { id, link:postLink(id), community:group?.name || '社区', author:author?.name || (post.authorId === 'user' ? '你' : '社区成员'), title:post.deletedAt ? '该贴已删' : post.title, excerpt:post.deletedAt ? '原帖已由作者删除' : String(post.body || '').slice(0,130), deleted:!!post.deletedAt }; }
    function openPostLink(link) { const id = postIdFromLink(link); if (!id) { showToast('不是有效的 BYND 帖子链接。'); return; } const post = loadState().posts.find(item => item.id === id); if (!post) { showToast('当前设备没有这条帖子；论坛数据尚未跨设备同步。'); return; } if (!document.getElementById('lock-screen')?.classList.contains('unlocked') && typeof window.unlockPhone === 'function') window.unlockPhone(); if (typeof window.openApp === 'function') window.openApp('living-world'); openPost(id); }
    function sharedText() { if (!shareTarget) return ''; if (shareTarget.type === 'news') { const item = loadState().newsItems.find(row => row.id === shareTarget.id); return item ? `【真实资讯 · ${item.source}】${item.title}\n${item.url}` : ''; } const post = loadState().posts.find(row => row.id === shareTarget.id && !row.deletedAt); return post ? `【BYND 帖子 · ${community(post.communityId).name}】${post.title}${post.body ? `\n${post.body.slice(0,1300)}` : ''}\n${postLink(post.id)}` : ''; }
    function renderShareSheet() { if (!shareTarget) return ''; const chars = typeof window.getWechatGroupContacts === 'function' ? window.getWechatGroupContacts() : safeList(window.myCharacters).filter(item => item && !item.isGroupChat); const dms = [...new Set(loadState().messages.filter(item => item.fromId === viewer().id || item.toId === viewer().id).map(item => item.fromId === viewer().id ? item.toId : item.fromId))]; return `<div class="lw-share-shade" onclick="if(event.target===this)LivingWorld.closeShare()"><section class="lw-share-panel" role="dialog" aria-modal="true" aria-label="转发到聊天"><div class="lw-share-head"><h2>转发到</h2><button type="button" onclick="LivingWorld.closeShare()" aria-label="关闭"><i class="ri-close-line"></i></button></div><p>选择后会打开聊天并填入草稿，由你确认发送。</p><h3>角色聊天</h3>${safeList(chars).filter(char => char?.id).map(char => `<button class="lw-share-recipient" type="button" onclick="LivingWorld.shareToCharacterChat('${escapeAttr(char.id)}')">${avatarMarkup(account(`char:${char.id}`))}<span>${escapeHtml(char.chatConfig?.nickname || char.name || '')}</span><i class="ri-arrow-right-s-line"></i></button>`).join('') || '<small>还没有可转发的角色。</small>'}<h3>论坛私信</h3>${dms.map(id => `<button class="lw-share-recipient" type="button" onclick="LivingWorld.shareToForumDm('${escapeAttr(id)}')">${avatarMarkup(account(id))}<span>${escapeHtml(account(id).name)}</span><i class="ri-arrow-right-s-line"></i></button>`).join('') || '<small>还没有私信会话。你也可以先在收件箱发起私信。</small>'}</section></div>`; }
    function closeShare() { shareTarget = null; render(); }
    function shareNews(id) { if (!loadState().newsItems.some(item => item.id === id)) return; shareTarget = { type:'news', id }; render(); }
    function shareToForumDm(id) { const content = sharedText(); if (!content || !visibleMembers().some(item => item.id === id)) { showToast('转发目标不可用。'); return; } shareTarget = null; openThread(id); const input = document.getElementById('lw-message-input'); if (input) { input.value = content.slice(0,1900); input.focus(); showToast('内容已放入私信草稿，请确认后发送。'); } else showToast('私信输入框不可用，未发送。'); }
    function shareToCharacterChat(charId) { const content = sharedText(); const chars = typeof window.getWechatGroupContacts === 'function' ? window.getWechatGroupContacts() : window.myCharacters; if (!content || !safeList(chars).some(char => String(char?.id) === charId && !char.isGroupChat)) { showToast('角色聊天不可用。'); return; } if (typeof window.openApp !== 'function' || typeof window.openChat !== 'function') { showToast('角色聊天入口不可用，未发送。'); return; } try { window.openApp('wechat'); window.openChat(charId); const input = document.getElementById('wc-msg-input'); if (!input) throw new Error('角色聊天输入框不可用。'); const richEnabled = typeof window.isWechatRichInputEnabled === 'function' && window.isWechatRichInputEnabled(); if (richEnabled && typeof window.insertWechatRichInputText === 'function') { const existing = typeof window.getWechatMessageInputValue === 'function' ? window.getWechatMessageInputValue() : ''; window.insertWechatRichInputText(`${existing ? '\n' : ''}${content.slice(0,1900)}`); } else { input.value = `${input.value ? `${input.value}\n` : ''}${content.slice(0,1900)}`; input.dispatchEvent(new Event('input',{ bubbles:true })); input.focus(); } shareTarget = null; } catch (error) { try { window.openApp('living-world'); } catch (_) {} showToast(error.message || '转发草稿未能写入。'); } }
    function renderForumSettings() {
        const settings = loadState().forumSettings;
        const choice = (value, current) => value === current ? 'selected' : '';
        return `<section class="lw-settings">
            <h1>动态刷新</h1><p>只有在打开论坛时才检查到期任务。每次推进只让一位角色根据自己的已知经历选择行动或沉默；启用 Jev 时可能先增加一次决策调用，实际写作最多调用一次文本 API。手动模式不会自动推进。首次打开角色主页仍可能调用 API 生成资料。</p>
            <label>刷新方式<select id="lw-refresh-mode"><option value="manual" ${choice('manual',settings.refreshMode)}>手动</option><option value="interval" ${choice('interval',settings.refreshMode)}>固定间隔</option><option value="smart" ${choice('smart',settings.refreshMode)}>智能时段（随机）</option></select></label>
            <label>固定间隔<select id="lw-refresh-hours">${[3,6,12,24,48].map(hour => `<option value="${hour}" ${choice(hour,Number(settings.intervalHours))}>${hour} 小时</option>`).join('')}</select></label>
            <p>智能时段参考 08:00、12:30、03:00，每次在附近随机浮动；离线期间不会补扣多次 API。下次进入论坛时最多补一次。</p>
            <section class="lw-reaction-settings"><div class="lw-reaction-heading"><span class="lw-reaction-icon"><i class="ri-chat-smile-3-line"></i></span><div><h2>角色回复</h2><p>你在角色的帖子下留言后，由角色决定是否接话。</p></div></div><div class="lw-reaction-options" role="radiogroup" aria-label="角色回复调用方式">${[['forum','打开论坛时','只有进入论坛后才调用 AI 判断，不打断聊天。','ri-discuss-line'],['app','应用运行时自动','即使正在聊天或使用其他页面，也会在应用可见时判断。','ri-smartphone-line'],['off','关闭','不自动调用 AI；你的评论仍会正常保存。','ri-moon-line']].map(([mode,title,description,icon]) => `<label class="lw-reaction-option"><input type="radio" name="lw-reply-mode" value="${mode}" ${settings.replyMode === mode ? 'checked' : ''}><span class="lw-reaction-option-face"><i class="${icon}" aria-hidden="true"></i><span><strong>${title}</strong><small>${description}</small></span><i class="ri-check-line lw-reaction-check" aria-hidden="true"></i></span></label>`).join('')}</div><p class="lw-reaction-note">两种自动方式都会先等待 2–12 分钟；同一角色至少间隔 4 小时，全局至少间隔 10 分钟。未启用 Jev 时由文本模型判断；启用后先尝试 Jev，确需回复才由文本模型写内容。退出应用后不会后台调用，下次打开再检查。</p></section>
            <h2>角色主页</h2><label>头像与资料<select id="lw-profile-mode"><option value="economy" ${choice('economy',settings.profileMode)}>省生图：NPC 姓名头像 + AI 资料</option><option value="full" ${choice('full',settings.profileMode)}>完整：角色资料 + 生图头像</option></select></label>
            <p>完整模式只在角色主页实际更新时尝试生图。生图 API 未配置或失败时保留现有头像，并提示错误。</p>
            <section class="lw-promo-settings"><div class="lw-promo-settings-head"><span class="lw-promo-settings-icon"><i class="ri-megaphone-line"></i></span><div><h2>世界内推广</h2><p>让世界里的店铺与事件自然出现在信息流。</p></div></div><input id="lw-promotion-enabled" type="hidden" value="${settings.promotionsEnabled ? 'yes' : 'no'}"><div class="lw-promo-segment" role="group" aria-label="展示推广"><button type="button" class="${settings.promotionsEnabled ? 'active' : ''}" onclick="LivingWorld.setPromotionEnabled(true)">开启</button><button type="button" class="${!settings.promotionsEnabled ? 'active' : ''}" onclick="LivingWorld.setPromotionEnabled(false)">关闭</button></div><div class="lw-promo-preview"><span>信息流预览</span><strong>推广 · Sponsored</strong><p>与当前世界相关的内容会在这里出现</p></div><div class="lw-promo-sliders"><label for="lw-promotion-min"><span>最少间隔</span><b id="lw-promotion-min-display">${Number(settings.promotionMinGap || 8)} 条</b></label><input id="lw-promotion-min" type="range" min="4" max="30" value="${Number(settings.promotionMinGap || 8)}" oninput="LivingWorld.updatePromotionGap('min',this.value)"><label for="lw-promotion-max"><span>最多间隔</span><b id="lw-promotion-max-display">${Number(settings.promotionMaxGap || 15)} 条</b></label><input id="lw-promotion-max" type="range" min="4" max="30" value="${Number(settings.promotionMaxGap || 15)}" oninput="LivingWorld.updatePromotionGap('max',this.value)"></div><p class="lw-promo-note">每隔设定数量的帖子随机插入 1 条。始终明确标注「推广」，关闭后不再展示或生成。</p></section><h2 class="lw-hidden-title">已隐藏的帖子</h2>${safeList(loadState().hiddenPosts[viewer().id]).map(id => { const post = loadState().posts.find(row => row.id === id); return post ? `<button class="lw-hidden-post" type="button" onclick="LivingWorld.restoreHiddenPost('${escapeAttr(id)}')">${escapeHtml(post.title)} <span>恢复</span></button>` : ''; }).join('') || '<p class="lw-hidden-empty">暂无隐藏的帖子</p>'}
            <div class="lw-settings-actions"><button class="lw-settings-save" type="button" onclick="LivingWorld.saveForumSettings()">保存设置</button><button class="lw-settings-run" type="button" onclick="LivingWorld.progressWorld()" ${isGenerating ? 'disabled' : ''}>推进一位角色</button></div>
            <div class="lw-world-expand"><div><strong>扩展世界</strong><p>批量生成新社区、路人和世界线索。会比推进单个角色消耗更多文本额度。</p></div><button type="button" onclick="LivingWorld.generate()" ${isGenerating ? 'disabled' : ''}>扩展</button></div>${settings.lastAttemptAt ? `<small>上次自动尝试：${new Date(settings.lastAttemptAt).toLocaleString('zh-CN')}</small>` : ''}
        </section>`;
    }
    function visibleSocialLinks() {
        const world = loadState(); const who = world.viewerId;
        const known = new Set(safeList(world.knowledge[who]).map(row => row.eventId));
        const explicit = world.socialLinks.filter(link => link.fromId === who || known.has(link.sourceEventId));
        const observed = Object.entries(world.relationships).flatMap(([key,value]) => { const [fromId,toId] = key.split('>'); const evidence = safeList(value?.history).slice().reverse().find(row => known.has(row.eventId)); return evidence ? [{ fromId,toId,kind:'interacted',sourceEventId:evidence.eventId,sourceLabel:'已知论坛互动' }] : []; });
        return [...explicit,...observed].filter(link => world.accounts[link.fromId] || world.npcs.some(npc => npc.id === link.fromId)).filter(link => world.accounts[link.toId] || world.npcs.some(npc => npc.id === link.toId));
    }
    function relationshipGraphData() {
        const world = loadState(); const who = world.viewerId;
        const known = new Set(safeList(world.knowledge[who]).map(row => row.eventId));
        const people = new Set([...Object.keys(world.accounts), ...world.npcs.map(npc => npc.id)]);
        const links = visibleSocialLinks().map(link => ({ ...link, eventId:link.sourceEventId, at:Number(world.events.find(event => event.id === link.sourceEventId)?.createdAt || link.updatedAt || 0) }));
        world.events.forEach(event => {
            if (!known.has(event.id) && event.actorId !== who) return;
            if (event.type === 'private_chat') {
                if (event.visibility === 'private' && known.has(event.id) && [event.actorId,event.targetId].includes(who)) links.push({ fromId:event.actorId, toId:event.targetId, kind:'private_chat', eventId:event.id, at:event.createdAt });
                return;
            }
            if (event.visibility !== 'public') return;
            if (event.type === 'forum_follow' && safeList(world.follows[event.actorId]).includes(event.targetId)) links.push({ fromId:event.actorId, toId:event.targetId, kind:'follow', eventId:event.id, at:event.createdAt });
            if (event.type === 'forum_reply') {
                const post = world.posts.find(item => item.id === event.targetId);
                const comment = world.comments.find(item => item.id === event.metadata?.commentId);
                const parent = world.comments.find(item => item.id === comment?.parentCommentId);
                const toId = parent?.authorId || post?.authorId;
                if (toId) links.push({ fromId:event.actorId, toId, kind:'reply', eventId:event.id, at:event.createdAt });
            }
        });
        const pairs = new Map();
        links.forEach(link => {
            if (!people.has(link.fromId) || !people.has(link.toId) || link.fromId === link.toId) return;
            const [a,b] = [link.fromId,link.toId].sort(); const key = `${a}\u0000${b}`;
            if (!pairs.has(key)) pairs.set(key,{ a,b,records:[],forward:false,backward:false });
            const pair = pairs.get(key);
            if (pair.records.some(row => row.fromId === link.fromId && row.toId === link.toId && row.kind === link.kind && row.eventId === link.eventId)) return;
            pair.records.push(link);
            if (link.fromId === a) pair.forward = true; else pair.backward = true;
        });
        return [...pairs.values()].sort((left,right) => Number(right.records.some(row => row.fromId === who || row.toId === who)) - Number(left.records.some(row => row.fromId === who || row.toId === who)) || Math.max(...right.records.map(row => row.at || 0)) - Math.max(...left.records.map(row => row.at || 0)));
    }
    function relationKindLabel(kind) { return { follow:'关注', reply:'回复过', private_chat:'私聊过', met:'认识', heard:'听说过', interacted:'互动过' }[kind] || '有联系'; }
    function relationPairLabel(pair) {
        if (pair.forward && pair.backward) return pair.records.some(row => row.kind === 'met') ? '双向认识' : '双向互动';
        return relationKindLabel(pair.records.find(row => row.kind !== 'interacted')?.kind || pair.records[0]?.kind);
    }
    function relationPersona(world, id, otherId) {
        const person = world.accounts[id] || world.npcs.find(item => item.id === id) || {};
        const charId = person.charId || person.contactCharId || person.originCharId || (id.startsWith('char:') ? id.slice(5) : '');
        const chars = safeList(typeof window.getWechatGroupContacts === 'function' ? window.getWechatGroupContacts() : window.myCharacters);
        const char = chars.find(item => String(item?.id) === String(charId));
        const otherName = String((world.accounts[otherId] || world.npcs.find(item => item.id === otherId))?.name || '');
        const relatedLore = safeList(char?.worldBook).filter(entry => entry?.enabled !== false && otherName && String(entry?.content || entry?.text || '').includes(otherName)).slice(0,2).map(entry => String(entry.content || entry.text).slice(0,350));
        return { name:person.name || '未知人物', publicProfile:String(person.summary || '').slice(0,240), personality:[char?.personality,char?.description,person.personality,person.style].filter(Boolean).join('\n').slice(0,1000), relatedLore };
    }
    function relationEvidence(world, pair, fromId) {
        const known = new Set(safeList(world.knowledge[fromId]).map(row => row.eventId));
        return pair.records.filter(row => known.has(row.eventId) || row.fromId === fromId).slice(-12).map(row => {
            const event = world.events.find(item => item.id === row.eventId);
            const comment = event?.type === 'forum_reply' ? world.comments.find(item => item.id === event.metadata?.commentId) : null;
            const post = event?.type?.startsWith('forum_') ? world.posts.find(item => item.id === event.targetId || item.id === comment?.postId) : null;
            // Private-chat excerpts must not be sent to a relationship card visible from another account's perspective.
            const canShowPrivate = event?.type !== 'private_chat' || world.viewerId === fromId;
            return { direction:`${row.fromId} → ${row.toId}`, kind:relationKindLabel(row.kind), postTitle:String(post?.title || '').slice(0,80), excerpt:canShowPrivate ? String(comment?.body || event?.metadata?.excerpt || '').slice(0,180) : '', at:row.at || 0 };
        });
    }
    function relationImpressionInput(world, pair) {
        const make = (fromId,toId) => { const other = relationPersona(world,toId,fromId); return { fromId, toId, from:relationPersona(world,fromId,toId), to:{ name:other.name, publicProfile:other.publicProfile }, evidence:relationEvidence(world,pair,fromId) }; };
        return { viewerId:world.viewerId, aToB:make(pair.a,pair.b), bToA:make(pair.b,pair.a) };
    }
    function relationImpressionKey(input) { return `${input.viewerId}|${input.aToB.fromId}|${input.bToA.fromId}`; }
    function relationImpression(world, pair, fromId) {
        const input = relationImpressionInput(world,pair), key = relationImpressionKey(input);
        const direction = fromId === pair.a ? 'aToB' : 'bToA';
        if (!input[direction].evidence.length) return '尚无足够线索判断态度';
        const cached = relationImpressionCache.get(key);
        if (cached?.signature === JSON.stringify(input)) return cached[direction];
        if (relationImpressionPending.has(key)) return '正在结合人设与已知经历整理…';
        if (relationImpressionErrors.has(key)) return '暂时无法生成人设印象';
        return '等待结合人设与已知经历整理';
    }
    async function loadRelationImpression(pair, force = false) {
        const input = relationImpressionInput(loadState(),pair), key = relationImpressionKey(input), signature = JSON.stringify(input);
        if (relationImpressionPending.has(key) || (!force && relationImpressionCache.get(key)?.signature === signature)) return;
        relationImpressionErrors.delete(key);
        if (typeof window.callChatApi !== 'function') { relationImpressionErrors.set(key,'未配置文本模型'); render(); return; }
        relationImpressionPending.add(key); render();
        try {
            const prompt = `请根据人物各自的人设和实际可知的互动，分别写两个方向的印象。关系是有方向的：A 对 B 的态度不可从 B 对 A 的态度反推。互动次数只说明发生过接触，不能自动解释为熟悉、信任、喜欢或警惕。只依据每个方向自己的 evidence；若线索不够，就写“态度尚不明确”。不要编造共同经历、私聊内容或内心确定事实；用审慎的第三人称推测，体现人设但不要复述人设。每方向 8 至 60 个汉字。只输出严格 JSON：{"aToB":"...","bToA":"..."}。\n${signature}`;
            const result = await window.callChatApi([{ role:'system', content:'你只输出符合输入证据的双向人物关系印象 JSON。' },{ role:'user', content:prompt }], { background:true, backgroundPriority:-1, stream:false, temperature:.55, max_tokens:260, usageFeature:'relation' });
            if (!result?.ok) throw new Error(result?.error || '文本模型不可用');
            const parsed = parseJsonBatch(result.content);
            const clean = value => String(value || '').replace(/^印象[：:]\s*/, '').trim();
            const aToB = clean(parsed.aToB), bToA = clean(parsed.bToA);
            if (!aToB || !bToA || aToB.length > 90 || bToA.length > 90) throw new Error('关系印象格式无效');
            if (JSON.stringify(relationImpressionInput(loadState(),pair)) === signature) relationImpressionCache.set(key,{ signature, aToB, bToA });
        } catch (error) { relationImpressionErrors.set(key,error?.message || '生成失败'); }
        finally { relationImpressionPending.delete(key); if (selectedRelationPair?.a === pair.a && selectedRelationPair?.b === pair.b) render(); }
    }
    function renderRelationCard() {
        if (!selectedRelationPair) return '';
        const pair = relationshipGraphData().find(item => item.a === selectedRelationPair.a && item.b === selectedRelationPair.b);
        if (!pair) return '';
        const world = loadState(); const names = [account(pair.a).name,account(pair.b).name];
        const events = [...new Map(pair.records.map(row => [row.eventId,world.events.find(event => event.id === row.eventId)]).filter(([,event]) => event).map(([id,event]) => [id,event])).values()].sort((a,b) => a.createdAt - b.createdAt);
        const first = events[0]; const latest = events.at(-1);
        const firstPost = first && world.posts.find(post => post.id === first.targetId);
        const firstSource = !first ? '暂无可确认记录' : first.type === 'private_chat' ? '私聊' : firstPost ? `论坛 · 《${firstPost.title}》` : first.type.startsWith('forum_') ? '论坛 · 公开互动' : '世界轨迹';
        const shared = events.filter(event => safeList(world.knowledge[pair.a]).some(row => row.eventId === event.id) && safeList(world.knowledge[pair.b]).some(row => row.eventId === event.id)).length;
        const sources = [...new Set(events.map(event => event.type === 'private_chat' ? '私聊' : event.type.startsWith('forum_') ? '论坛' : '世界轨迹'))];
        const directions = [[pair.a,pair.b],[pair.b,pair.a]];
        const impressionKey = relationImpressionKey(relationImpressionInput(world,pair));
        return `<div class="lw-relation-shade" onclick="if(event.target===this)LivingWorld.closeRelation()"><section class="lw-relation-card" role="dialog" aria-modal="true" aria-label="${escapeAttr(names.join('与'))}的关系"><div class="lw-relation-card-head"><span>关系详情</span><button type="button" onclick="LivingWorld.closeRelation()" aria-label="关闭关系卡"><i class="ri-close-line"></i></button></div><h2>${escapeHtml(names[0])} <span>${pair.forward && pair.backward ? '↔' : pair.forward ? '→' : '←'}</span> ${escapeHtml(names[1])}</h2><div class="lw-relation-metrics"><div><small>认知状态</small><b>${pair.forward && pair.backward ? '双向已知' : '单向已知'}</b></div><div><small>首次接触</small><b>${escapeHtml(firstSource)}</b></div><div><small>最近接触</small><b>${latest ? timeAgo(latest.createdAt) : '未知'}</b></div><div><small>互动次数</small><b>${events.length}</b></div><div><small>共同事件</small><b>${shared}</b></div><div><small>关系来源</small><b>${escapeHtml(sources.join(' / ') || '已知线索')}</b></div></div><div class="lw-relation-directions">${directions.map(([fromId,toId]) => { const directionRows = pair.records.filter(row => row.fromId === fromId && row.toId === toId); return `<div><strong>${escapeHtml(account(fromId).name)} → ${escapeHtml(account(toId).name)}</strong><p>印象（推测）：${escapeHtml(relationImpression(world,pair,fromId))}</p><small>${directionRows.length ? [...new Set(directionRows.map(row => relationKindLabel(row.kind)))].join(' · ') : '尚无这方向的可见依据'}</small></div>`; }).join('')}</div>${relationImpressionErrors.has(impressionKey) ? `<button type="button" class="lw-relation-retry" onclick="LivingWorld.retryRelationImpression()">重新整理印象</button>` : ''}</section></div>`;
    }
    function openRelation(fromId,toId) { const pair = relationshipGraphData().find(item => [item.a,item.b].includes(fromId) && [item.a,item.b].includes(toId) && fromId !== toId); if (!pair) return; selectedRelationPair = { a:pair.a,b:pair.b }; render(); void loadRelationImpression(pair); }
    function retryRelationImpression() { if (!selectedRelationPair) return; const pair = relationshipGraphData().find(item => item.a === selectedRelationPair.a && item.b === selectedRelationPair.b); if (pair) void loadRelationImpression(pair,true); }
    function closeRelation() { selectedRelationPair = null; render(); }
    function renderRelationships() {
        const allPairs = relationshipGraphData(); const who = viewer().id;
        const ids = [...new Set([who,...allPairs.flatMap(pair => [pair.a,pair.b])])];
        const featured = ids.slice(0,17); const wide = featured.length > 6;
        const width = wide ? 640 : 420, height = wide ? 600 : 440, cx = width / 2, cy = height / 2 - 8;
        const nodes = featured.map((id,index) => { if (!index) return { id,x:cx,y:cy }; const ordinal = index - 1; const ring = ordinal < 8 ? 0 : 1; const count = ring ? Math.max(1,featured.length - 9) : Math.min(8,featured.length - 1); const position = ring ? ordinal - 8 : ordinal; const angle = -Math.PI / 2 + position * Math.PI * 2 / count; const radius = ring ? 255 : wide ? 166 : 160; return { id,x:Math.round(cx + radius * Math.cos(angle)),y:Math.round(cy + radius * Math.sin(angle)) }; });
        const byId = Object.fromEntries(nodes.map(node => [node.id,node])); const pairs = allPairs.filter(pair => byId[pair.a] && byId[pair.b]);
        const edgeSvg = pair => { const a = byId[pair.a], b = byId[pair.b]; const dx = b.x - a.x,dy = b.y - a.y,length = Math.hypot(dx,dy) || 1; const inset = 28; const x1 = Math.round(a.x + dx / length * inset),y1 = Math.round(a.y + dy / length * inset),x2 = Math.round(b.x - dx / length * inset),y2 = Math.round(b.y - dy / length * inset); const middleX = (x1+x2)/2,middleY = (y1+y2)/2; const label = relationPairLabel(pair); return `<g class="lw-relation-edge" role="button" tabindex="0" data-from="${escapeAttr(pair.a)}" data-to="${escapeAttr(pair.b)}" aria-label="查看 ${escapeAttr(account(pair.a).name)} 与 ${escapeAttr(account(pair.b).name)} 的关系" onclick="LivingWorld.openRelation(this.dataset.from,this.dataset.to)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();LivingWorld.openRelation(this.dataset.from,this.dataset.to)}"><line class="lw-relation-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${pair.backward ? 'marker-start="url(#lw-arrowhead)"' : ''} ${pair.forward ? 'marker-end="url(#lw-arrowhead)"' : ''}/><line class="lw-relation-hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><rect class="lw-relation-edge-label-bg" x="${Math.round(middleX-37)}" y="${Math.round(middleY-12)}" width="74" height="23" rx="11"/><text class="lw-relation-edge-label" x="${middleX}" y="${middleY+4}" text-anchor="middle">${escapeHtml(label)}</text></g>`; };
        return `<section class="lw-relations"><div class="lw-relation-intro"><span class="lw-relation-eyebrow">SOCIAL GRAPH</span><h1>已知关系网络</h1><p>只显示 ${escapeHtml(viewer().name)} 当前有依据知道的联系。箭头表示关系方向；两端都有依据时才显示双箭头。点边查看来往细节。</p></div>${pairs.length ? `<div class="lw-relation-viewport"><svg class="lw-relation-graph" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="group" aria-label="可点击边查看详情的已知人物关系图"><defs><marker id="lw-arrowhead" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto-start-reverse"><path d="M0 0 L9 4.5 L0 9" fill="#667888"/></marker></defs>${pairs.map(edgeSvg).join('')}${nodes.map(node => `<g class="lw-relation-node ${node.id === who ? 'is-current' : ''}" transform="translate(${node.x} ${node.y})"><circle r="24"/><text class="lw-relation-initial" text-anchor="middle" y="5">${escapeHtml(Array.from(account(node.id).name).slice(0,1).join(''))}</text><text class="lw-relation-name" text-anchor="middle" y="47">${escapeHtml(account(node.id).name)}</text>${node.id === who ? `<text class="lw-relation-current" text-anchor="middle" y="62">当前人物</text>` : ''}</g>`).join('')}</svg></div><div class="lw-relation-legend"><span><i>→</i> 单向</span><span><i>↔</i> 双向</span><span>${featured.length} 位人物 · ${pairs.length} 组关系</span></div>${ids.length > featured.length ? `<p class="lw-relation-overflow">人物较多，当前显示与视角最相关的 ${featured.length} 位。</p>` : ''}<div class="lw-relation-list">${pairs.map(pair => `<button type="button" data-from="${escapeAttr(pair.a)}" data-to="${escapeAttr(pair.b)}" onclick="LivingWorld.openRelation(this.dataset.from,this.dataset.to)"><span class="lw-relation-list-icon">${pair.forward && pair.backward ? '↔' : pair.forward ? '→' : '←'}</span><span><strong>${escapeHtml(account(pair.a).name)} ${pair.forward && pair.backward ? '↔' : pair.forward ? '→' : '←'} ${escapeHtml(account(pair.b).name)}</strong><small>${escapeHtml(relationPairLabel(pair))} · ${pair.records.length} 条可见线索</small></span><i class="ri-arrow-right-s-line"></i></button>`).join('')}</div>` : '<div class="lw-empty"><h2>关系网还在生长</h2><p>角色的关注、回复、私聊和有来源的世界事件，会逐渐把人物连在一起；未知关系不会凭空出现。</p></div>'}</section>`;
    }
    function safeExternalUrl(value) { try { const url = new URL(String(value || '')); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch (_) { return ''; } }
    function stableNewsId(url) { let hash = 2166136261; for (const character of url) { hash ^= character.charCodeAt(0); hash = Math.imul(hash,16777619); } return `news_${(hash >>> 0).toString(36)}`; }
    function plainNewsText(value) { return String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/[ \t]+/g,' ').trim(); }
    function normalizeNewsItem(item) {
        const url = safeExternalUrl(item.url || item.link); const title = String(item.title || '').trim().slice(0,220);
        if (!url || !title) return null;
        const source = String(item.host || item.domain || item.source || new URL(url).hostname).trim().slice(0,80);
        const dateText = String(item.seendate || item.published_at || item.publishedAt || '').trim();
        const parsed = /^\d{14}$/.test(dateText) ? Date.parse(`${dateText.slice(0,4)}-${dateText.slice(4,6)}-${dateText.slice(6,8)}T${dateText.slice(8,10)}:${dateText.slice(10,12)}:${dateText.slice(12,14)}Z`) : Date.parse(dateText);
        return { id: stableNewsId(url), title, url, source, description: plainNewsText(item.description || item.summary).slice(0,700), content: plainNewsText(item.text || item.content).slice(0,900), imageUrl: safeExternalUrl(item.image || item.socialimage || item.og || ''), publishedAt: Number.isFinite(parsed) ? parsed : now(), fetchedAt: now(), provider: String(item.provider || 'GDELT').slice(0,40) };
    }
    async function fetchNewsJson(url) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(),15000); try { const response = await fetch(url,{ signal: controller.signal, headers: { Accept:'application/json' } }); if (!response.ok) throw new Error(`资讯源暂不可用（HTTP ${response.status}）。`); return await response.json(); } finally { clearTimeout(timer); } }
    async function fetchRealNews(force = false) {
        if (newsBusy) return;
        const world = loadState(); if (!force && world.newsItems.length && now() - world.newsFetchedAt < 6 * 3600000) return;
        if (force && now() - world.newsFetchedAt < 30000) { showToast('请稍后再刷新真实资讯。'); return; }
        newsBusy = true; render();
        let source = 'FreeNews'; let rows = []; let outcome = '';
        try {
            try { const payload = await fetchNewsJson('https://freenewsapi.ai/v1/search?date=24h&lang=en&size=18&sort=date'); rows = safeList(payload.results).map(item => normalizeNewsItem({ ...item, provider:'FreeNews' })).filter(Boolean); if (!rows.length) throw new Error('资讯索引暂无可用文章。'); }
            catch (primaryError) { try { source = 'GDELT'; const url = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent('world OR technology OR culture') + '&mode=artlist&format=json&maxrecords=18&timespan=1d&sort=datedesc'; const payload = await fetchNewsJson(url); rows = safeList(payload.articles).map(normalizeNewsItem).filter(Boolean); if (!rows.length) throw new Error('聚合源暂无可用文章。'); }
                catch (_) { source = 'Hacker News'; const ids = await fetchNewsJson('https://hacker-news.firebaseio.com/v0/topstories.json'); const items = await Promise.all(safeList(ids).slice(0,12).map(async id => { try { return await fetchNewsJson(`https://hacker-news.firebaseio.com/v0/item/${encodeURIComponent(id)}.json`); } catch (_) { return null; } })); rows = items.filter(item => item && item.type === 'story' && item.title).map(item => normalizeNewsItem({ title:item.title, url:item.url || `https://news.ycombinator.com/item?id=${item.id}`, source:'Hacker News', text:item.text || '', publishedAt:new Date(Number(item.time || 0) * 1000).toISOString(), provider:'Hacker News' })).filter(Boolean); if (!rows.length) throw primaryError; } }
            mutate(next => { const previous = new Map(next.newsItems.map(item => [item.id,item])); rows.forEach(item => { const old = previous.get(item.id); previous.set(item.id,{ ...old,...item, content:item.content || old?.content || '', translatedTitle:old?.translatedTitle || '', translatedDescription:old?.translatedDescription || '', translatedContent:old?.translatedContent || '' }); }); next.newsItems = [...previous.values()].sort((a,b) => b.publishedAt - a.publishedAt).slice(0,80); next.newsFetchedAt = now(); });
            outcome = `已载入 ${rows.length} 条真实资讯 · ${source}。`;
        } catch (error) { outcome = `${error.message || '资讯获取失败。'}${world.newsItems.length ? ' 已保留上次内容。' : ''}`; }
        finally { newsBusy = false; render(); showToast(outcome); }
    }
    async function translateEnglish(text) { const source = String(text || '').trim(); if (!source) return ''; if (!/[A-Za-z]{3}/.test(source)) throw new Error('当前内容不是英文，无需翻译。'); const chunks = []; let chunk = '', bytes = 0; for (const character of source) { const point = character.codePointAt(0); const size = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4; if (bytes + size > 450) { chunks.push(chunk); chunk = ''; bytes = 0; } chunk += character; bytes += size; } if (chunk) chunks.push(chunk); if (chunks.length > 12) throw new Error('内容过长，请查看原文。'); const result = []; for (const part of chunks) { const payload = await fetchNewsJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(part)}&langpair=en%7Czh-CN`); const translated = String(payload.responseData?.translatedText || '').trim(); if (Number(payload.responseStatus) !== 200 || !translated || translated === part) throw new Error('翻译服务暂不可用。'); result.push(translated); } return result.join(''); }
    async function translateCurrentPost() { const post = loadState().posts.find(item => item.id === activePostId); if (!post) return; postActionSheetOpen = false; if (showPostTranslation) { showPostTranslation = false; render(); return; } if (post.translatedTitle) { showPostTranslation = true; render(); return; } render(); try { showToast('正在翻译帖子…'); const title = await translateEnglish(post.title), body = post.body ? await translateEnglish(post.body.slice(0,2100)) + (post.body.length > 2100 ? '\n（其余内容请查看原文）' : '') : ''; mutate(next => { const target = next.posts.find(item => item.id === post.id); if (target) { target.translatedTitle = title; target.translatedBody = body; } }); showPostTranslation = true; render(); } catch (error) { showToast(error.message || '翻译失败。'); } }
    async function translateNews(id) { const item = loadState().newsItems.find(row => row.id === id); if (!item || translatingNewsId) return; if (translatedNewsVisible.has(id)) { translatedNewsVisible.delete(id); render(); return; } if (item.translatedTitle && (!item.content || item.translatedContent)) { translatedNewsVisible.add(id); render(); return; } translatingNewsId = id; render(); let failure = ''; try { const title = item.translatedTitle || await translateEnglish(item.title); const description = item.description && !item.translatedDescription ? await translateEnglish(item.description) : item.translatedDescription || ''; const content = item.content && !item.translatedContent ? await translateEnglish(item.content) : item.translatedContent || ''; mutate(next => { const target = next.newsItems.find(row => row.id === id); if (target) Object.assign(target,{ translatedTitle:title, translatedDescription:description, translatedContent:content }); }); translatedNewsVisible.add(id); } catch (error) { failure = error.message || '翻译失败，已保留英文原文。'; } finally { translatingNewsId = ''; render(); if (failure) showToast(failure); } }
    function newsTranslationButton(item) { return `<button type="button" onclick="LivingWorld.translateNews('${escapeAttr(item.id)}')" ${translatingNewsId === item.id ? 'disabled' : ''}><i class="ri-translate-2"></i> ${translatingNewsId === item.id ? '翻译中…' : translatedNewsVisible.has(item.id) ? '显示原文' : '译成中文'}</button>`; }
    function renderNewsCard(item) { const comments = loadState().newsComments.filter(row => row.newsId === item.id).length, translated = translatedNewsVisible.has(item.id); return `<article class="lw-news-card"><div class="lw-news-source"><i class="ri-global-line"></i><b>${escapeHtml(item.source)}</b><span>${timeAgo(item.publishedAt)} · ${escapeHtml(item.provider)}</span></div><button type="button" class="lw-news-open" onclick="LivingWorld.openNews('${escapeAttr(item.id)}')"><h2>${escapeHtml(translated && item.translatedTitle || item.title)}</h2>${item.description ? `<p>${escapeHtml(translated && item.translatedDescription || item.description)}</p>` : ''}${item.imageUrl ? `<img src="${escapeAttr(item.imageUrl)}" alt="" loading="lazy" onerror="this.hidden=true">` : ''}</button><div class="lw-news-actions"><button type="button" onclick="LivingWorld.openNews('${escapeAttr(item.id)}')"><i class="ri-chat-3-line"></i> ${comments} 条讨论</button>${newsTranslationButton(item)}<button type="button" onclick="LivingWorld.shareNews('${escapeAttr(item.id)}')"><i class="ri-share-forward-line"></i> 转发</button></div></article>`; }
    function renderMedia() { const world = loadState(); return `<section class="lw-media-page"><div class="lw-media-intro"><h1>现实热点</h1><button type="button" onclick="LivingWorld.fetchRealNews(true)" ${newsBusy ? 'disabled' : ''}><i class="ri-refresh-line"></i> ${newsBusy ? '获取中…' : '刷新资讯'}</button></div>${world.newsFetchedAt ? `<small class="lw-news-updated">上次获取：${new Date(world.newsFetchedAt).toLocaleString('zh-CN')}</small>` : ''}<div class="lw-news-feed">${world.newsItems.map(renderNewsCard).join('') || `<div class="lw-empty"><i class="ri-newspaper-line"></i><h2>${newsBusy ? '正在获取真实资讯' : '还没有资讯'}</h2><p>${newsBusy ? '请稍候。' : '点击刷新资讯；若来源不可用，会明确显示失败。'}</p></div>`}</div></section>`; }
    function renderNewsDetail() { const item = loadState().newsItems.find(row => row.id === activeNewsId); if (!item) return '<div class="lw-empty">这条资讯已不在本地缓存中。</div>'; const comments = loadState().newsComments.filter(row => row.newsId === item.id).sort((a,b) => a.createdAt - b.createdAt), translated = translatedNewsVisible.has(item.id); const content = translated && item.translatedContent || item.content || (translated && item.translatedDescription || item.description); return `<section class="lw-news-detail"><div class="lw-news-source"><i class="ri-global-line"></i><b>${escapeHtml(item.source)}</b><span>${timeAgo(item.publishedAt)}</span></div><h1>${escapeHtml(translated && item.translatedTitle || item.title)}</h1>${item.imageUrl ? `<img class="lw-news-hero" src="${escapeAttr(item.imageUrl)}" alt="" onerror="this.hidden=true">` : ''}<div class="lw-news-article"><strong>${item.content ? '新闻摘录' : '来源摘要'}</strong>${content ? `<p>${escapeHtml(content)}</p>` : `<p class="lw-news-unavailable">${articleLoadingId === item.id ? '正在获取正文…' : '暂时无法获取新闻正文，请查看来源原文。'}</p>`}${!item.content && articleLoadingId === item.id && content ? '<p class="lw-news-unavailable">正在获取正文…</p>' : ''}<small>内容来自 ${escapeHtml(item.source)}，版权归原发布方所有。</small></div><div class="lw-news-actions">${newsTranslationButton(item)}<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">查看原文 <i class="ri-external-link-line"></i></a><button type="button" onclick="LivingWorld.shareNews('${escapeAttr(item.id)}')"><i class="ri-share-forward-line"></i> 转发</button></div><h2>BYND 讨论 · ${comments.length}</h2><div class="lw-news-comments">${comments.map(row => `<article class="lw-news-comment">${avatarMarkup(account(row.authorId))}<div><b>${escapeHtml(account(row.authorId).name)} <small>${timeAgo(row.createdAt)}</small></b><p>${escapeHtml(row.body)}</p></div></article>`).join('') || '<p class="lw-news-empty">还没有人讨论这条新闻。</p>'}</div><form class="lw-news-composer" onsubmit="return LivingWorld.commentNews(event)"><input id="lw-news-comment" required maxlength="1200" value="${escapeAttr(newsDraft)}" placeholder="在 BYND 留言" aria-label="新闻留言" oninput="LivingWorld.updateNewsDraft(this.value)"><button type="submit" ${newsDraft.trim() ? '' : 'disabled'} aria-label="发送留言"><i class="ri-send-plane-2-fill"></i></button></form></section>`; }
    function updateNewsDraft(value) { newsDraft = String(value || '').slice(0,1200); const button = document.querySelector('.lw-news-composer button[type=submit]'); if (button) button.disabled = !newsDraft.trim(); }
    async function fetchReaderArticle(sourceUrl) {
        const url = safeExternalUrl(sourceUrl);
        if (!url || /^(?:localhost|127(?:\.\d+){3}|10(?:\.\d+){3}|192\.168(?:\.\d+){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d+){2}|\[?::1\]?)$/i.test(new URL(url).hostname)) throw new Error('新闻来源链接无效。');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(`https://r.jina.ai/${url}`, { signal:controller.signal, headers:{ Accept:'application/json' } });
            if (!response.ok) throw new Error(`正文提取服务暂不可用（HTTP ${response.status}）。`);
            const payload = await response.json();
            const content = plainNewsText(payload.data?.content || payload.content || '').slice(0,1800);
            if (!content) throw new Error('来源没有提供可提取的正文。');
            return content;
        } finally { clearTimeout(timer); }
    }
    async function fetchArticleContent(id) {
        const item = loadState().newsItems.find(row => row.id === id);
        if (!item || item.content || articleLoadingId) return;
        articleLoadingId = id;
        if (activeNewsId === id) render();
        let failure = '';
        try {
            let content = '';
            if (item.provider === 'FreeNews') {
                try { const payload = await fetchNewsJson(`https://freenewsapi.ai/v1/article?url=${encodeURIComponent(item.url)}`); content = plainNewsText(payload.text || payload.article?.text).slice(0,1800); } catch (_) { /* Try the source itself below. */ }
            }
            if (!content) content = await fetchReaderArticle(item.url);
            mutate(next => { const target = next.newsItems.find(row => row.id === id); if (target) target.content = content; });
        } catch (error) { failure = error.message || '新闻正文暂不可用。'; }
        finally { articleLoadingId = ''; if (activeNewsId === id) render(); if (failure) showToast(failure); }
    }
    function openNews(id) { if (!loadState().newsItems.some(item => item.id === id)) return; activeNewsId = id; newsDraft = ''; activeTab = 'news-detail'; render(); void fetchArticleContent(id); }
    function commentNews(event) { event.preventDefault(); const body = document.getElementById('lw-news-comment')?.value.trim(); if (!body || !loadState().newsItems.some(item => item.id === activeNewsId)) return false; try { mutate(next => { const row = { id:uid('newscomment'), newsId:activeNewsId, authorId:next.viewerId, body:body.slice(0,1200), createdAt:now() }; next.newsComments.push(row); recordForumAction(next,'forum_news_reply',next.viewerId,activeNewsId,{ commentId:row.id, excerpt:row.body.slice(0,140) },'medium'); }); newsDraft = ''; render(); showToast('留言已发布在 BYND。'); } catch (error) { showToast(error.message); } return false; }
    function renderPerspectiveSheet() { if (!perspectiveOpen) return '<div class="lw-sheet" hidden></div>'; const accounts = Object.values(loadState().accounts).filter(item => item && item.id); return `<div class="lw-sheet" role="dialog" aria-modal="true" onclick="if(event.target===this)LivingWorld.togglePerspective(false)"><section class="lw-sheet-panel"><h3>你正在透过谁的眼睛？</h3><p>切换只重排本地可见内容，不会重新生成论坛。</p>${accounts.map(item => `<button class="lw-perspective-option ${item.id === viewer().id ? 'active' : ''}" type="button" onclick="LivingWorld.setViewer('${escapeAttr(item.id)}')"><img src="${escapeAttr(item.avatar || DEFAULT_AVATAR)}" onerror="this.src='${escapeAttr(DEFAULT_AVATAR)}'"><span>${escapeHtml(item.name)}</span><small>${item.id === 'user' ? '我的视角' : '角色视角'}</small></button>`).join('')}</section></div>`; }

    function showToast(text) { const el = document.getElementById('lw-toast'); if (!el) return; el.textContent = text; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2400); }
    function setTab(tab) { if (tab === 'create') previousTab = activeTab; if (tab === 'notifications' && viewer().id !== 'user' && activeTab !== 'notifications') { try { mutate(next => { addEvent(next, 'forum_open_notification_as', 'user', next.viewerId, {}, 'private'); recordTrace(next, next.viewerId, 'open_notifications', 'medium'); }); } catch (error) { showToast(error.message); return; } } activeTab = tab; menuOpen = false; if (tab !== 'relationships') selectedRelationPair = null; if (tab !== 'create') communityPickerOpen = false; if (tab !== 'detail') activePostId = tab === 'profile' ? viewer().id : ''; if (tab === 'notifications') activityTab = 'notifications'; if (tab !== 'chat') activeThreadId = ''; render(); if (tab === 'profile' && viewer().id !== 'user') void ensureProfile(viewer().id); if (tab === 'media' && (!loadState().newsItems.length || now() - loadState().newsFetchedAt > 6 * 3600000)) void fetchRealNews(); }
    function toggleMenu(force) { menuOpen = typeof force === 'boolean' ? force : !menuOpen; render(); }
    function menuGo(tab) { menuOpen = false; setTab(tab); }
    function returnToDesktop() { menuOpen = false; if (typeof window.closeApp === 'function') window.closeApp('living-world'); else showToast('无法返回桌面。'); }
    function saveForumSettings() {
        const refreshMode = document.getElementById('lw-refresh-mode')?.value;
        const intervalHours = Number(document.getElementById('lw-refresh-hours')?.value);
        const profileMode = document.getElementById('lw-profile-mode')?.value;
        const replyMode = document.querySelector('input[name="lw-reply-mode"]:checked')?.value || loadState().forumSettings.replyMode;
        const promotionsEnabled = (document.getElementById('lw-promotion-enabled')?.value || 'yes') === 'yes';
        const promotionMinGap = Number(document.getElementById('lw-promotion-min')?.value ?? 8);
        const promotionMaxGap = Number(document.getElementById('lw-promotion-max')?.value ?? 15);
        if (!['manual','interval','smart'].includes(refreshMode) || ![3,6,12,24,48].includes(intervalHours) || !['economy','full'].includes(profileMode) || !['forum','app','off'].includes(replyMode) || !Number.isInteger(promotionMinGap) || !Number.isInteger(promotionMaxGap) || promotionMinGap < 4 || promotionMinGap > 30 || promotionMaxGap > 30 || promotionMinGap > promotionMaxGap) { showToast('设置项无效。'); return; }
        try {
            mutate(next => {
                const old = next.forumSettings;
                next.forumSettings = { ...old, refreshMode, intervalHours, profileMode, replyMode, replyReactionsEnabled:replyMode !== 'off', promotionsEnabled, promotionMinGap, promotionMaxGap, nextSmartAt: refreshMode === 'smart' && old.refreshMode !== 'smart' ? nextSmartTime(now()) : old.nextSmartAt };
                if (replyMode === 'off') {
                    next.interactionHandled.push(...next.interactionQueue.map(item => item.commentId));
                    next.interactionHandled = next.interactionHandled.slice(-160);
                    next.interactionQueue = [];
                }
            });
            render(); showToast('论坛设置已保存。');
        } catch (error) { showToast(error.message); }
    }
    function setPromotionEnabled(value) { const input = document.getElementById('lw-promotion-enabled'); if (input) input.value = value ? 'yes' : 'no'; document.querySelectorAll('.lw-promo-segment button').forEach((button,index) => button.classList.toggle('active',index === (value ? 0 : 1))); }
    function updatePromotionGap(kind,value) { const min = document.getElementById('lw-promotion-min'), max = document.getElementById('lw-promotion-max'); if (!min || !max) return; if (kind === 'min' && Number(value) > Number(max.value)) max.value = value; if (kind === 'max' && Number(value) < Number(min.value)) min.value = value; document.getElementById('lw-promotion-min-display').textContent = `${min.value} 条`; document.getElementById('lw-promotion-max-display').textContent = `${max.value} 条`; }
    function setCommunity(id) { activeCommunity = id || ''; activeTab = 'home'; render(); }
    function openCommunity(id) { activeCommunity = id; activeTab = 'home'; render(); }
    function openPost(id) { const post = loadState().posts.find(item => item.id === id); if (!post || !isVisible(post, viewer().id)) { showToast('帖子不可访问。'); return; } activePostId = id; replyTargetId = ''; replyComposerOpen = false; commentQuery = ''; commentSearchOpen = false; postActionSheetOpen = false; showPostTranslation = false; activeTab = 'detail'; render(); }
    function openProfile(id) { activePostId = id; activeTab = 'profile'; profileTab = 'posts'; profileEditOpen = false; render(); if (id !== 'user' && account(id).id !== 'unknown') void ensureProfile(id); }
    function refreshProfile(id) { void ensureProfile(id, true); }
    function back() { if (selectedRelationPair) { closeRelation(); return; } if (postActionSheetOpen) { togglePostActions(false); return; } if (replyComposerOpen) { closeReplyComposer(); return; } if (activeTab === 'chat' && activeThreadId) { activeThreadId = ''; activeTab = 'notifications'; activityTab = 'chat'; render(); } else if (activeTab === 'news-detail') { activeTab = 'media'; activeNewsId = ''; render(); } else if (activeTab === 'media' && mediaProfileId) { activeTab = 'profile'; activePostId = mediaProfileId; mediaProfileId = ''; render(); } else if (['detail','promotion','profile','communities','settings','relationships','media','chat','notifications'].includes(activeTab)) { activeTab = 'home'; activePostId = ''; render(); } else if (activeTab === 'create') setTab(previousTab === 'create' ? 'home' : previousTab); else returnToDesktop(); }
    function togglePerspective(force) { perspectiveOpen = typeof force === 'boolean' ? force : !perspectiveOpen; render(); }
    function toggleSearch(force) { searchOpen = typeof force === 'boolean' ? force : !searchOpen; render(); if (searchOpen) setTimeout(() => document.getElementById('lw-search-input')?.focus(), 0); }
    function submitSearch(event) { event.preventDefault(); const term = document.getElementById('lw-search-input')?.value.trim() || ''; if (term.startsWith('bynd://forum/post/')) { openPostLink(term); return false; } if (term) { try { mutate(next => { next.searches[next.viewerId] = [term.slice(0, 80), ...safeList(next.searches[next.viewerId]).filter(item => item !== term)].slice(0, 12); if (next.viewerId !== 'user') { addEvent(next, 'forum_search_as', 'user', next.viewerId, { query: term.slice(0, 80) }, 'private'); recordTrace(next, next.viewerId, 'search', 'high', { query: term.slice(0, 80) }); } }); } catch (error) { showToast(error.message); return false; } } searchQuery = term; activeTab = 'home'; activePostId = ''; render(); return false; }
    function searchFor(term) { const input = document.getElementById('lw-search-input'); if (input) input.value = term; submitSearch({ preventDefault() {} }); }
    function clearSearch() { searchQuery = ''; searchOpen = false; render(); }
    function openChat() { activeTab = 'chat'; activeThreadId = ''; activityTab = 'chat'; render(); }
    function setActivityTab(tab) { activityTab = tab === 'chat' ? 'chat' : 'notifications'; activeThreadId = ''; render(); }
    function setProfileTab(tab) { if (!['posts','replies','media','saved'].includes(tab)) return; if (tab === 'media') { mediaProfileId = activePostId || viewer().id; setTab('media'); return; } profileTab = tab; render(); }
    function editProfile(force) { profileEditOpen = typeof force === 'boolean' ? force : !profileEditOpen; if (!profileEditOpen) draftProfileAvatar = ''; render(); }
    function pickProfileAvatar(input) { const file = input?.files?.[0]; if (!file) return; if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type) || file.size > 1024 * 1024) { showToast('请选择小于 1 MB 的 PNG、JPG、WebP 或 GIF 头像。'); input.value = ''; return; } const reader = new FileReader(); reader.onload = () => { draftProfileAvatar = String(reader.result || ''); const note = document.createElement('small'); note.textContent = '已选择本地头像'; input.closest('label')?.after(note); }; reader.onerror = () => showToast('头像读取失败。'); reader.readAsDataURL(file); }
    function saveProfile(event) { event.preventDefault(); if (activeTab !== 'profile' || activePostId !== viewer().id) return false; const name = document.getElementById('lw-profile-name')?.value.trim(); const username = document.getElementById('lw-profile-username')?.value.trim() || viewer().username; const summary = document.getElementById('lw-profile-summary')?.value.trim() || ''; const avatarUrl = document.getElementById('lw-profile-avatar-url')?.value.trim() || ''; if (!name) { showToast('请填写显示名称。'); return false; } if (!/^@[\p{L}\p{N}_.-]{2,31}$/u.test(username)) { showToast('@ 昵称需以 @ 开头，后接 2–31 个字母、汉字、数字、下划线、点或横线。'); return false; } if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) { showToast('头像链接需以 http 或 https 开头。'); return false; } try { mutate(next => { const id = next.viewerId; const edit = { ...next.profileEdits[id], name: name.slice(0, 40), username, summary: summary.slice(0, 220) }; if (draftProfileAvatar || avatarUrl) edit.avatar = draftProfileAvatar || avatarUrl.slice(0, 800); next.profileEdits[id] = edit; next.accounts[id] = { ...next.accounts[id], ...edit }; }); profileEditOpen = false; draftProfileAvatar = ''; render(); showToast('论坛资料已保存。'); } catch (error) { showToast(error.message); } return false; }
    function toggleCommunityPicker(force) { communityPickerOpen = typeof force === 'boolean' ? force : !communityPickerOpen; document.querySelector('.lw-community-sheet')?.remove(); if (communityPickerOpen) document.querySelector('.lw-shell')?.insertAdjacentHTML('beforeend',renderComposeCommunityPicker()); }
    function selectComposeCommunity(id) { if (!loadState().communities.some(item => item.id === id)) return; composeCommunityId = id; activeCommunity = id; const select = document.getElementById('lw-post-community'); if (select) select.value = id; const picker = document.querySelector('.lw-community-picker'); if (picker) picker.firstChild.textContent = `${community(id).name} `; toggleCommunityPicker(false); updateCompose(); }
    function showComposeCommunityForm() { const form = document.getElementById('lw-compose-community-form'); if (form) { form.hidden = false; document.getElementById('lw-community-name')?.focus(); } }
    function updateCompose() { const title = document.getElementById('lw-post-title')?.value.trim(); const button = document.getElementById('lw-publish'); if (button) button.disabled = !title || !document.getElementById('lw-post-community')?.value; const picker = document.querySelector('.lw-community-picker'); if (picker) picker.firstChild.textContent = `${community(document.getElementById('lw-post-community')?.value).name} `; }
    function toggleLinkInput(kind = 'image') { const input = document.getElementById('lw-post-image'); if (input) { const sameOpen = !input.hidden && input.dataset.kind === kind; input.hidden = sameOpen; input.dataset.kind = kind === 'video' ? 'video' : 'image'; input.placeholder = kind === 'video' ? '视频链接（https://）' : '图片链接（https://）'; if (!input.hidden) input.focus(); } }
    function togglePoll() { const fields = document.getElementById('lw-poll-fields'); if (fields) { fields.hidden = !fields.hidden; if (!fields.hidden) fields.querySelector('input')?.focus(); } }
    function addPollOption() { const fields = document.getElementById('lw-poll-fields'); if (!fields || fields.querySelectorAll('.lw-poll-option').length >= 6) return; const input = document.createElement('input'); input.className = 'lw-poll-option'; input.maxLength = 80; input.placeholder = `选项 ${fields.querySelectorAll('.lw-poll-option').length + 1}`; fields.querySelector('button')?.before(input); input.focus(); }
    function toggleAma(force) { const button = document.getElementById('lw-ama-button'); const card = document.getElementById('lw-ama-card'); if (!button || !card) return; const open = typeof force === 'boolean' ? force : !button.classList.contains('selected'); button.classList.toggle('selected',open); card.hidden = !open; if (!open) closeAmaPicker(); if (open) card.scrollIntoView?.({ block:'nearest', behavior:'smooth' }); }
    function openAmaPicker(kind) {
        if (kind !== 'start' && kind !== 'duration') return;
        const sheet = document.getElementById('lw-ama-picker');
        if (!sheet) return;
        const current = document.getElementById(kind === 'start' ? 'lw-ama-start-mode' : 'lw-ama-duration')?.value || (kind === 'start' ? 'now' : '4');
        const choices = kind === 'start'
            ? [['now','立即开始','发布后立刻开放问答','ri-flashlight-line'],['later','设定时间','预约未来 30 天内的时间','ri-calendar-event-line']]
            : [1,2,4,8,12,24].map(hours => [String(hours),`${hours} 小时`,'','ri-time-line']);
        sheet.dataset.kind = kind;
        sheet.innerHTML = `<section class="lw-ama-picker-panel" role="dialog" aria-modal="true" aria-label="${kind === 'start' ? '选择开始时间' : '选择持续时间'}"><div class="lw-ama-picker-handle"></div><div class="lw-ama-picker-head"><div><h2>${kind === 'start' ? '什么时候开始？' : '问答持续多久？'}</h2><p>${kind === 'start' ? '选择 AMA 对社区开放的时间' : '到期后帖子会从公开页面消失'}</p></div><button type="button" onclick="LivingWorld.closeAmaPicker()" aria-label="关闭选项"><i class="ri-close-line"></i></button></div><div class="lw-ama-picker-options ${kind === 'duration' ? 'is-duration' : ''}">${choices.map(([value,label,description,icon]) => `<button type="button" class="lw-ama-picker-option ${value === current ? 'selected' : ''}" onclick="LivingWorld.selectAmaOption('${value}')" aria-pressed="${value === current}"><i class="${icon}" aria-hidden="true"></i><span><b>${label}</b>${description ? `<small>${description}</small>` : ''}</span><i class="ri-check-line lw-ama-picker-check" aria-hidden="true"></i></button>`).join('')}</div></section>`;
        sheet.hidden = false;
        sheet.onclick = event => { if (event.target === sheet) closeAmaPicker(); };
    }
    function closeAmaPicker() { const sheet = document.getElementById('lw-ama-picker'); if (sheet) { sheet.hidden = true; sheet.innerHTML = ''; } }
    function selectAmaOption(value) {
        const sheet = document.getElementById('lw-ama-picker');
        if (!sheet || sheet.hidden) return;
        if (sheet.dataset.kind === 'start' && ['now','later'].includes(value)) {
            document.getElementById('lw-ama-start-mode').value = value;
            document.getElementById('lw-ama-start-label').textContent = value === 'now' ? '立即开始' : '设定时间';
            updateAmaStart();
        } else if (sheet.dataset.kind === 'duration' && ['1','2','4','8','12','24'].includes(value)) {
            document.getElementById('lw-ama-duration').value = value;
            document.getElementById('lw-ama-duration-label').textContent = `${value} 小时`;
        } else return;
        closeAmaPicker();
    }
    function updateAmaStart() { const input = document.getElementById('lw-ama-start-at'); if (input) { input.hidden = document.getElementById('lw-ama-start-mode')?.value !== 'later'; if (!input.hidden && !input.value) { const start = new Date(now() + 3600000); input.value = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}T${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`; } } }
    function removeDraftImage() { draftImage = ''; document.querySelector('.lw-draft-image')?.remove(); }
    function pickImage(input) { const file = input?.files?.[0]; if (!file) return; if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type) || file.size > 2 * 1024 * 1024) { showToast('请选择小于 2 MB 的 PNG、JPG、WebP 或 GIF 图片。'); input.value = ''; return; } const reader = new FileReader(); reader.onload = () => { draftImage = String(reader.result || ''); document.querySelector('.lw-draft-image')?.remove(); const container = document.createElement('div'); container.className = 'lw-draft-image'; const img = document.createElement('img'); img.src = draftImage; img.alt = '待发布图片'; const button = document.createElement('button'); button.type = 'button'; button.textContent = '移除'; button.onclick = removeDraftImage; container.append(img, button); document.querySelector('.lw-compose-tools')?.before(container); }; reader.onerror = () => showToast('图片读取失败。'); reader.readAsDataURL(file); }
    function startMessage() { activeThreadId = ''; activeTab = 'chat'; render(); const main = document.querySelector('.lw-inbox'); if (!main) return; const chooser = document.createElement('div'); chooser.className = 'lw-recipient-chooser'; chooser.innerHTML = `<div class="lw-chooser-head"><b>新私信</b><button type="button" onclick="this.closest('.lw-recipient-chooser').remove()" aria-label="关闭"><i class="ri-close-line"></i></button></div><input type="search" placeholder="搜索成员" aria-label="搜索成员" oninput="LivingWorld.filterRecipients(this.value)"><div id="lw-recipient-list"></div>`; main.prepend(chooser); filterRecipients(''); chooser.querySelector('input')?.focus(); }
    function toggleCommunityForm() { const form = document.getElementById('lw-community-form'); if (form) { form.hidden = !form.hidden; if (!form.hidden) document.getElementById('lw-community-name')?.focus(); } }
    function createCommunity(event) { event.preventDefault(); const name = document.getElementById('lw-community-name')?.value.trim(); const description = document.getElementById('lw-community-description')?.value.trim(); if (!name || !description) return false; const id = uid('community'); const composing = activeTab === 'create'; try { mutate(next => { if (next.communities.some(item => item.name.toLowerCase() === name.toLowerCase())) throw new Error('这个社区名称已存在。'); next.communities.push({ id, name: name.slice(0, 40), description: description.slice(0, 160), icon: 'ri-community-line', createdAt: now(), ownerId: next.viewerId, generated: false }); next.subscriptions[next.viewerId] = [...new Set([...safeList(next.subscriptions[next.viewerId]), id])]; addEvent(next, 'forum_community_create', next.viewerId, id, { name }, 'public'); }); activeCommunity = id; if (composing) { const select = document.getElementById('lw-post-community'); if (select) { const option = document.createElement('option'); option.value = id; option.textContent = name; select.append(option); } selectComposeCommunity(id); } else { activeTab = 'home'; render(); } showToast('社区已创建。'); } catch (error) { showToast(error.message); } return false; }
    function toggleSubscribe(id) { if (!loadState().communities.some(item => item.id === id)) return; try { mutate(next => { const rows = new Set(safeList(next.subscriptions[next.viewerId])); if (rows.has(id)) rows.delete(id); else rows.add(id); next.subscriptions[next.viewerId] = [...rows]; }); render(); } catch (error) { showToast(error.message); } }
    function filterRecipients(query) { const list = document.getElementById('lw-recipient-list'); if (!list) return; const members = visibleMembers().filter(item => `${item.name} ${item.username || ''}`.toLowerCase().includes(String(query || '').toLowerCase())); list.innerHTML = members.map(item => `<button type="button" onclick="LivingWorld.openThread('${escapeAttr(item.id)}')"><img src="${escapeAttr(item.avatar || DEFAULT_AVATAR)}" onerror="this.src='${escapeAttr(DEFAULT_AVATAR)}'"><span>${escapeHtml(item.name)}</span></button>`).join('') || '<p>没有找到成员。</p>'; }
    function openThread(id) { if (!visibleMembers().some(item => item.id === id)) { showToast('无法与该成员私信。'); return; } activeThreadId = id; activeTab = 'chat'; activityTab = 'chat'; try { mutate(next => { next.messages.forEach(item => { if (item.fromId === id && item.toId === next.viewerId && !item.readAt) item.readAt = now(); }); if (next.viewerId !== 'user') { addEvent(next, 'forum_open_dm_as', 'user', next.viewerId, { peerId: id }, 'private'); recordTrace(next, next.viewerId, 'open_dm', 'medium', { peerId: id }); } }); } catch (error) { showToast(error.message); return; } render(); }
    function sendMessage(event) { event.preventDefault(); const body = document.getElementById('lw-message-input')?.value.trim(); if (!body || !activeThreadId || !visibleMembers().some(item => item.id === activeThreadId)) return false; const peerId = activeThreadId; const senderId = viewer().id; const sentId = uid('dm'); try { mutate(next => { const message = { id: sentId, fromId: senderId, toId: peerId, body: body.slice(0, 2000), createdAt: now(), readAt: 0 }; next.messages.push(message); const action = addEvent(next, 'forum_dm', senderId, peerId, { messageId: message.id }, 'private'); grantKnowledge(next, peerId, action, senderId, 'direct', 1); if (senderId !== 'user') { const trace = addEvent(next, 'forum_impersonation', 'user', senderId, { action: 'forum_dm', messageId: sentId, targetId: peerId }, 'private'); grantKnowledge(next, 'user', trace, 'user', 'direct', 1); recordTrace(next, senderId, 'forum_dm', 'high', { messageId: sentId, targetId: peerId }); } }); dmReplyStatuses.delete(peerId); render(); void requestDirectReply(peerId, senderId, sentId); } catch (error) { showToast(error.message); } return false; }
    async function requestDirectReply(peerId, senderId, sentId) {
        const peer = account(peerId);
        if (!['char', 'npc'].includes(peer.type) || replyingThreads.has(peerId)) return;
        replyingThreads.add(peerId); dmReplyStatuses.set(peerId, { peerId, senderId, sentId, busy: true }); if (activeTab === 'chat' && activeThreadId === peerId) render();
        try {
            if (typeof window.callChatApi !== 'function') throw new Error('聊天 API 尚未配置。');
            const char = peer.type === 'char' ? safeList(window.myCharacters).find(item => item.id === peer.charId || `char:${item.id}` === peerId) : null;
            const thread = loadState().messages.filter(item => (item.fromId === senderId && item.toId === peerId) || (item.fromId === peerId && item.toId === senderId)).slice(-12);
            const history = thread.map(item => `${item.fromId === peerId ? peer.name : account(senderId).name}：${item.body}`).join('\n');
            const persona = String(char?.description || char?.personality || `${peer.summary || ''}\n身份：${peer.occupation || '普通社区成员'}。表达风格：${peer.style || '自然'}`).slice(0, 1800);
            const known = getRelevantEventsForChar(char || peerId, 3);
            const result = await window.callChatApi([{ role: 'system', content: `你是论坛成员「${peer.name}」。按以下人设和可知事实回复一条私信，只输出自己发给对方的自然语言消息，不要 JSON、旁白、系统说明或代替对方说话。\n人设：${persona}\n${known}` }, { role: 'user', content: `最近私信：\n${history}\n请回复最后一条消息。` }], { background: true, backgroundPriority: -1, stream: false, temperature: .78, max_tokens: 420, usageFeature: 'forum', usageChar: char });
            if (!result?.ok) throw new Error(result?.error || '对方暂时没有回复。');
            const body = String(result.content || '').trim().slice(0, 2000);
            if (!body) throw new Error('对方返回了空回复。');
            mutate(next => {
                if (!next.messages.some(item => item.id === sentId && item.fromId === senderId && item.toId === peerId)) throw new Error('原私信已不存在。');
                if (next.messages.some(item => item.replyTo === sentId)) return;
                const message = { id: uid('dm'), fromId: peerId, toId: senderId, body, replyTo: sentId, createdAt: now(), readAt: next.viewerId === senderId && activeThreadId === peerId ? now() : 0 };
                next.messages.push(message);
                const event = addEvent(next, 'forum_dm_reply', peerId, senderId, { messageId: message.id, replyTo: sentId }, 'private');
                grantKnowledge(next, senderId === 'user' ? senderId : 'user', event, peerId, 'direct', 1);
            });
            if (dmReplyStatuses.get(peerId)?.sentId === sentId) dmReplyStatuses.delete(peerId);
        } catch (error) { if (dmReplyStatuses.get(peerId)?.sentId === sentId) dmReplyStatuses.set(peerId, { peerId, senderId, sentId, busy: false, error: error?.message || '回复失败。' }); }
        finally {
            replyingThreads.delete(peerId);
            if ((activeTab === 'chat' && activeThreadId === peerId) || (activeTab === 'notifications' && activityTab === 'chat')) render();
            const messages = loadState().messages; const index = messages.findIndex(item => item.id === sentId);
            const latest = index < 0 ? null : messages.slice(index + 1).filter(item => item.fromId === senderId && item.toId === peerId && !messages.some(reply => reply.replyTo === item.id)).at(-1);
            if (latest) void requestDirectReply(peerId, senderId, latest.id);
        }
    }
    function retryDirectReply() { const status = dmReplyStatuses.get(activeThreadId); if (!status || status.busy || !loadState().messages.some(item => item.id === status.sentId)) return; void requestDirectReply(status.peerId, status.senderId, status.sentId); }
    function markAllRead() { try { mutate(next => { safeList(next.notifications[next.viewerId]).forEach(item => { item.read = true; }); if (next.viewerId !== 'user') { addEvent(next, 'forum_notification_read_as', 'user', next.viewerId, {}, 'private'); recordTrace(next, next.viewerId, 'mark_notifications_read', 'high'); } }); render(); } catch (error) { showToast(error.message); } }
    function togglePostMenu(id) { const menu = document.getElementById(`lw-menu-${id}`); if (menu) menu.hidden = !menu.hidden; }
    function renderPostActionSheet() {
        if (activeTab !== 'detail' || !postActionSheetOpen) return '';
        const post = loadState().posts.find(item => item.id === activePostId); if (!post) return '';
        const who = viewer().id, following = safeList(loadState().postFollows[who]).includes(post.id), saved = safeList(post.bookmarkedBy).includes(who);
        const actions = [
            ['ri-link','复制链接','copyPostLink'], ['ri-share-forward-line','分享','shareCurrentPost'],
            [following ? 'ri-notification-off-line' : 'ri-notification-3-line',following ? '取消关注帖子' : '关注帖子','followCurrentPost'],
            [saved ? 'ri-bookmark-fill' : 'ri-bookmark-line',saved ? '取消保存' : '保存','saveCurrentPost'],
            ['ri-translate-2',showPostTranslation ? '显示原内容' : '翻译成中文','translateCurrentPost'],
            ['ri-settings-3-line','语言和翻译','postLanguageInfo'],
            ['ri-award-line','奖励此帖子','awardCurrentPost'], ['ri-file-copy-line','复制文本','copyPostText'],
            ['ri-booklet-line','画成漫画','comicCurrentPost'],
            ['ri-eye-off-line','隐藏','hideCurrentPost'],
            ...(post.authorId === who ? [] : [['ri-user-unfollow-line','屏蔽账户','blockPostAuthor']]),
            ['ri-flag-line','举报','reportCurrentPost'], ['ri-repeat-2-line','转载到社区','crosspostCurrentPost']
        ];
        return `<div class="lw-action-shade" role="presentation" onclick="if(event.target===this)LivingWorld.togglePostActions(false)"><section class="lw-action-sheet" role="dialog" aria-modal="true" aria-label="帖子操作"><div class="lw-action-grip"></div>${actions.map(([icon,label,method]) => `<button type="button" onclick="LivingWorld.${method}()"><i class="${icon}"></i><span>${label}</span></button>`).join('')}</section></div>`;
    }
    function togglePostActions(force) { postActionSheetOpen = typeof force === 'boolean' ? force : !postActionSheetOpen; render(); }
    async function copyText(value) { try { if (!window.navigator?.clipboard?.writeText) throw new Error('当前环境不支持复制。'); await window.navigator.clipboard.writeText(value); showToast('已复制。'); } catch (error) { showToast(error.message || '复制失败。'); } }
    function copyPostLink() { const id = activePostId; postActionSheetOpen = false; render(); void copyText(postLink(id)); }
    function copyPostText() { const post = loadState().posts.find(item => item.id === activePostId); postActionSheetOpen = false; render(); if (post && !post.deletedAt) void copyText(`${post.title}\n\n${post.body || ''}`); }
    function comicCurrentPost() { const post = loadState().posts.find(item => item.id === activePostId); if (!post || post.deletedAt) return; postActionSheetOpen = false; window.ByndComic?.fromSource('forum', post.authorId, `${post.title}\n\n${post.body || ''}`); }
    function shareCurrentPost() { postActionSheetOpen = false; sharePost(activePostId); }
    function saveCurrentPost() { postActionSheetOpen = false; toggleBookmark(activePostId); }
    function followCurrentPost() { const id = activePostId; try { mutate(next => { const follows = new Set(safeList(next.postFollows[next.viewerId])); if (follows.has(id)) follows.delete(id); else follows.add(id); next.postFollows[next.viewerId] = [...follows]; }); postActionSheetOpen = false; render(); } catch (error) { showToast(error.message); } }
    function hideCurrentPost() { const id = activePostId; try { mutate(next => { next.hiddenPosts[next.viewerId] = [...new Set([...safeList(next.hiddenPosts[next.viewerId]),id])]; }); postActionSheetOpen = false; activeTab = 'home'; activePostId = ''; render(); showToast('已隐藏，可在论坛设置中恢复。'); } catch (error) { showToast(error.message); } }
    function restoreHiddenPost(id) { try { mutate(next => { next.hiddenPosts[next.viewerId] = safeList(next.hiddenPosts[next.viewerId]).filter(value => value !== id); }); render(); } catch (error) { showToast(error.message); } }
    function blockPostAuthor() { const post = loadState().posts.find(item => item.id === activePostId); if (!post || post.authorId === viewer().id) return; postActionSheetOpen = false; toggleBlock(post.authorId); }
    function reportCurrentPost() { const post = loadState().posts.find(item => item.id === activePostId); if (!post) return; const reason = window.prompt('举报原因（仅保存在本机，不会自动提交外部平台）'); if (reason === null) return; if (!reason.trim()) { showToast('请填写举报原因。'); return; } try { mutate(next => { next.reports.push({ id:uid('report'), postId:post.id, reporterId:next.viewerId, reason:reason.trim().slice(0,400), createdAt:now() }); next.reports = next.reports.slice(-100); }); postActionSheetOpen = false; render(); showToast('举报记录已保存在本机。'); } catch (error) { showToast(error.message); } }
    function awardCurrentPost() { const post = loadState().posts.find(item => item.id === activePostId); if (!post) return; try { mutate(next => { next.awards.push({ id:uid('award'), postId:post.id, fromId:next.viewerId, createdAt:now() }); if (post.authorId !== next.viewerId) notify(next,post.authorId,'帖子收到奖励',`${account(next.viewerId).name} 向你的帖子送出了一枚徽章`,post.id); }); postActionSheetOpen = false; render(); showToast('已送出徽章。'); } catch (error) { showToast(error.message); } }
    function crosspostCurrentPost() { const post = loadState().posts.find(item => item.id === activePostId); if (!post || post.deletedAt) return; postActionSheetOpen = false; previousTab = 'detail'; activeTab = 'create'; render(); const title = document.getElementById('lw-post-title'), body = document.getElementById('lw-post-body'); if (title) title.value = `转载：${post.title}`.slice(0,120); if (body) body.value = `${post.body || ''}\n\n来源：${community(post.communityId).name} · ${account(post.authorId).name}`.trim().slice(0,3000); updateCompose(); showToast('已填入转载草稿，请确认社区后发帖。'); }
    function postLanguageInfo() { postActionSheetOpen = false; render(); showToast('英文内容可按需翻译成中文；翻译会调用外部服务。'); }
    function sharePost(id) { const post = loadState().posts.find(item => item.id === id); if (!post || post.deletedAt) return; shareTarget = { type:'post', id }; render(); }
    function tombstonePost(next, post, actorId, generated = false, deletedAt = now()) { if (!post || post.deletedAt) return; post.deletedAt = deletedAt; post.deletedBy = actorId; const event = generated ? addEvent(next, 'forum_delete', actorId, post.id, { title: post.title, generated: true }, 'public') : recordForumAction(next, 'forum_delete', actorId, post.id, { title: post.title }, 'critical'); event.createdAt = deletedAt; grantKnowledge(next, actorId, event, actorId, 'authored', 1); }
    function deletePost(id) { const post = loadState().posts.find(item => item.id === id); if (!post || post.deletedAt || post.authorId !== viewer().id) return; if (!window.confirm('确定删除这条帖子吗？将显示“该贴已删”，原有记录不会消失。')) return; try { mutate(next => { tombstonePost(next, next.posts.find(item => item.id === id), next.viewerId); }); activeTab = 'home'; activePostId = ''; render(); showToast('帖子已删除，已看过的人仍可能记得内容。'); } catch (error) { showToast(error.message); } }
    function toggleFollow(id) { if (id === viewer().id || !visibleMembers().some(item => item.id === id)) return; try { mutate(next => { const rows = new Set(safeList(next.follows[next.viewerId])); if (rows.has(id)) { rows.delete(id); recordForumAction(next, 'forum_unfollow', next.viewerId, id, {}, 'medium'); } else { rows.add(id); const action = recordForumAction(next, 'forum_follow', next.viewerId, id, {}, 'medium'); notify(next, id, '新关注', `${account(next.viewerId).name} 关注了你`, ''); grantKnowledge(next, id, action, next.viewerId, 'notification', 1); } next.follows[next.viewerId] = [...rows]; }); render(); } catch (error) { showToast(error.message); } }
    function toggleBlock(id) { if (id === viewer().id || !account(id)?.id || account(id).id === 'unknown') return; try { mutate(next => { const who = next.accounts[next.viewerId] || next.npcs.find(item => item.id === next.viewerId); if (!who) throw new Error('当前论坛账号不可用。'); const blocked = new Set(safeList(who.blocked)); const adding = !blocked.has(id); if (adding) blocked.add(id); else blocked.delete(id); who.blocked = [...blocked]; const event = addEvent(next, adding ? 'forum_block' : 'forum_unblock', next.viewerId, id, {}, 'private'); grantKnowledge(next, 'user', event, 'user', 'direct', 1); if (next.viewerId !== 'user') { addEvent(next, 'forum_impersonation', 'user', next.viewerId, { action: event.type, publicEventId: event.id, targetId: id }, 'private'); recordTrace(next, next.viewerId, event.type, 'high', { targetId: id }); } }); render(); } catch (error) { showToast(error.message); } }
    function votePoll(postId, optionId) { const who = viewer().id; try { mutate(next => { const post = next.posts.find(item => item.id === postId); if (!post || post.deletedAt || !isVisible(post, who) || !post.poll) throw new Error('投票已不可用。'); const option = safeList(post.poll.options).find(item => item.id === optionId); if (!option) throw new Error('投票选项不存在。'); post.poll.options.forEach(item => { item.voters = safeList(item.voters).filter(id => id !== who); }); option.voters.push(who); recordForumAction(next, 'forum_poll_vote', who, postId, { optionId }, 'medium', 'private'); }); render(); } catch (error) { showToast(error.message); } }
    function recordForumAction(next, type, apparentActorId, targetId, metadata = {}, risk = 'low', visibility = 'public') {
        const impersonated = apparentActorId !== 'user';
        const publicEvent = addEvent(next, type, apparentActorId, targetId, metadata, visibility);
        if (!impersonated) grantKnowledge(next, apparentActorId, publicEvent, apparentActorId, 'authored', 1);
        if (impersonated) {
            const privateEvent = addEvent(next, 'forum_impersonation', 'user', apparentActorId, { action: type, publicEventId: publicEvent.id, targetId, risk }, 'private');
            grantKnowledge(next, 'user', privateEvent, 'user', 'direct', 1);
            recordTrace(next, apparentActorId, type, risk, { publicEventId: publicEvent.id, targetId });
        }
        return publicEvent;
    }
    function setViewer(id) {
        if (!loadState().accounts[id]) return;
        const stayInProfile = activeTab === 'profile';
        try { mutate(next => { next.viewerId = id; const event = addEvent(next, 'forum_view_as', 'user', id, { risk: id === 'user' ? 'none' : 'low' }, 'private'); grantKnowledge(next, 'user', event, 'user', 'direct', 1); if (id !== 'user') recordTrace(next, id, 'switch_perspective', 'low'); }); }
        catch (error) { showToast(error.message); return; }
        perspectiveOpen = false; profileEditOpen = false; searchQuery = ''; activeTab = stayInProfile ? 'profile' : 'home'; activePostId = stayInProfile ? id : ''; render(); showToast(`${account(id).name} · 视角`);
    }
    function createPost(event) {
        event.preventDefault(); const title = document.getElementById('lw-post-title')?.value.trim(); const body = document.getElementById('lw-post-body')?.value.trim() || ''; const communityId = document.getElementById('lw-post-community')?.value; const imageUrl = document.getElementById('lw-post-image')?.value.trim() || '';
        if (!title || !loadState().communities.some(item => item.id === communityId)) { showToast('请填写标题并选择社区。'); return false; }
        if (imageUrl && !/^https?:\/\//i.test(imageUrl)) { showToast('媒体链接需以 http 或 https 开头。'); return false; }
        if (draftImage && imageUrl) { showToast('请选择本地图片或媒体链接。'); return false; }
        const pollFields = document.getElementById('lw-poll-fields');
        const pollOptions = pollFields && !pollFields.hidden ? [...pollFields.querySelectorAll('.lw-poll-option')].map(input => input.value.trim()).filter(Boolean) : [];
        if (pollFields && !pollFields.hidden && (pollOptions.length < 2 || new Set(pollOptions.map(value => value.toLowerCase())).size !== pollOptions.length)) { showToast('投票需要至少两个不同的选项。'); return false; }
        const mediaType = document.getElementById('lw-post-image')?.dataset?.kind === 'video' && imageUrl ? 'video' : 'image';
        const ama = !!document.getElementById('lw-ama-button')?.classList.contains('selected');
        const amaDurationHours = ama ? Number(document.getElementById('lw-ama-duration')?.value) : 0;
        const amaScheduled = ama && document.getElementById('lw-ama-start-mode')?.value === 'later';
        const amaStartsAt = amaScheduled ? new Date(document.getElementById('lw-ama-start-at')?.value || '').getTime() : now();
        if (ama && (![1,2,4,8,12,24].includes(amaDurationHours) || !Number.isFinite(amaStartsAt) || (amaScheduled && (amaStartsAt <= now() || amaStartsAt > now() + 30 * DAY)))) { showToast('请选择未来 30 天内的 AMA 开始时间和有效时长。'); return false; }
        const newPostId = uid('post');
        try {
            mutate(next => {
                const post = { id: newPostId, authorId: next.viewerId, communityId, title: title.slice(0,120), body: body.slice(0,3000), imageUrl: draftImage || imageUrl.slice(0,800), mediaType: draftImage ? 'image' : mediaType, ama, amaStartsAt: ama ? amaStartsAt : 0, expiresAt: ama ? amaStartsAt + amaDurationHours * 3600000 : 0, poll: pollOptions.length ? { options: pollOptions.map(text => ({ id: uid('option'), text, voters: [] })) } : null, createdAt: now(), likes: 0, commentCount: 0, bookmarks: 0, likedBy: [], bookmarkedBy: [], visibility: 'public', generated: false };
                next.posts.unshift(post);
                recordForumAction(next, 'forum_post', next.viewerId, post.id, { title: post.title, excerpt: post.body.slice(0, 180), communityId }, 'high');
            });
            draftImage = ''; activeTab = 'detail'; activePostId = newPostId; render(); showToast(amaScheduled ? 'AMA 已预约，开始时间到后才会公开。' : '帖子已发布。');
        } catch (error) { showToast(error.message); }
        return false;
    }
    function reply(event, postId) {
        event.preventDefault(); const input = document.getElementById('lw-reply'); const body = input?.value.trim(); const post = loadState().posts.find(item => item.id === postId); if (!body || !post || post.deletedAt || (post.amaStartsAt && post.amaStartsAt > now()) || !isVisible(post, viewer().id)) { showToast('无法回复这条帖子。'); return false; }
        const attachedUrl = document.getElementById('lw-reply-media-url')?.value.trim() || '';
        const mediaUrl = replyDraftImage || attachedUrl;
        if (attachedUrl && !safeExternalUrl(attachedUrl)) { showToast('附件链接必须是有效的 HTTPS 地址。'); return false; }
        if (mediaUrl.length > 1400000) { showToast('评论图片过大，未发送。'); return false; }
        try {
            mutate(next => {
                const parent = replyTargetId ? next.comments.find(item => item.id === replyTargetId && item.postId === postId) : null;
                const row = { id: uid('comment'), postId, parentCommentId: parent?.id || '', authorId: next.viewerId, body: body.slice(0,1600), mediaUrl: mediaUrl.slice(0,1400000), mediaType: replyMediaKind === 'gif' || replyMediaKind === 'image' ? 'image' : replyMediaKind, createdAt: now() }; next.comments.push(row);
                const target = next.posts.find(item => item.id === postId); target.commentCount = Number(target.commentCount || 0) + 1;
                const action = recordForumAction(next, 'forum_reply', next.viewerId, postId, { commentId: row.id, excerpt: row.body.slice(0, 180) }, 'high');
                if (target.authorId !== next.viewerId) { notify(next, target.authorId, '有人回复了你的帖子', `${account(next.viewerId).name}：${row.body.slice(0, 70)}`, postId); grantKnowledge(next, target.authorId, action, next.viewerId, 'notification', 1); applyRelationshipDelta(next, next.viewerId, target.authorId, { familiarity: 2, trust: 1 }, action.id); applyRelationshipDelta(next, target.authorId, next.viewerId, { familiarity: 1, guardedness: 1 }, action.id); }
                if (next.forumSettings.replyReactionsEnabled && target.authorId !== 'user' && target.authorId !== next.viewerId && agentActors(next).some(actor => actor.id === target.authorId) && !next.interactionQueue.some(item => item.actorId === target.authorId)) next.interactionQueue.push({ id:uid('reaction'), actorId:target.authorId, postId, commentId:row.id, eventId:action.id, dueAt:now() + (2 + Math.floor(Math.random() * 11)) * 60000, attempts:0 });
                if (parent && parent.authorId !== next.viewerId && parent.authorId !== target.authorId) { notify(next, parent.authorId, '有人回复了你的评论', `${account(next.viewerId).name}：${row.body.slice(0, 70)}`, postId); grantKnowledge(next, parent.authorId, action, next.viewerId, 'notification', 1); }
                for (const [followerId, ids] of Object.entries(next.postFollows)) if (followerId !== next.viewerId && followerId !== target.authorId && followerId !== parent?.authorId && safeList(ids).includes(postId)) { notify(next, followerId, '你关注的帖子有新回复', `${account(next.viewerId).name}：${row.body.slice(0,70)}`, postId); grantKnowledge(next,followerId,action,next.viewerId,'notification',1); }
            });
            replyTargetId = ''; replyDraft = ''; replyDraftImage = ''; replyMediaKind = ''; replyComposerOpen = false; render(); showToast('回复已发送。');
        } catch (error) { showToast(error.message); }
        return false;
    }
    function vote(postId, direction) {
        if (![1, -1].includes(direction)) return;
        const who = viewer().id;
        try {
            mutate(next => {
                const post = next.posts.find(item => item.id === postId); if (!post || post.deletedAt || !isVisible(post, who)) throw new Error('帖子不可访问。');
                post.votes = post.votes && typeof post.votes === 'object' ? post.votes : {};
                const legacyIndex = safeList(post.likedBy).indexOf(who);
                if (legacyIndex >= 0) { post.likedBy.splice(legacyIndex, 1); post.likes = Math.max(0, Number(post.likes || 0) - 1); post.votes[who] = 1; }
                const previous = Number(post.votes[who] || 0); const nextVote = previous === direction ? 0 : direction;
                if (nextVote) post.votes[who] = nextVote; else delete post.votes[who];
                if (nextVote === 1 && previous !== 1) { const action = recordForumAction(next, 'forum_like', who, postId, {}, 'medium'); if (post.authorId !== who) { notify(next, post.authorId, '有人赞同了你的帖子', `${account(who).name} 赞同了帖子`, postId); grantKnowledge(next, post.authorId, action, who, 'notification', 1); applyRelationshipDelta(next, who, post.authorId, { familiarity: 1 }, action.id); } }
            });
            render();
        } catch (error) { showToast(error.message); }
    }
    function toggleLike(postId) { vote(postId, 1); }
    function toggleBookmark(postId) { const who = viewer().id; try { mutate(next => { const post = next.posts.find(item => item.id === postId); if (!post || post.deletedAt || !isVisible(post, who)) throw new Error('帖子不可访问。'); post.bookmarkedBy = safeList(post.bookmarkedBy); const index = post.bookmarkedBy.indexOf(who); if (index >= 0) { post.bookmarkedBy.splice(index, 1); post.bookmarks = Math.max(0, Number(post.bookmarks || 0) - 1); } else { post.bookmarkedBy.push(who); post.bookmarks = Number(post.bookmarks || 0) + 1; recordForumAction(next, 'forum_bookmark', who, postId, {}, 'medium', 'private'); } }); render(); } catch (error) { showToast(error.message); } }
    async function promoteNpc(npcId) {
        if (viewer().id !== 'user') { showToast('请切回我的视角后添加联系人。'); return; }
        const npc = loadState().npcs.find(item => item.id === npcId);
        if (!canPromoteNpc(npc)) { showToast('还需要更多真实互动。'); return; }
        if (!Array.isArray(window.myCharacters)) { showToast('联系人尚未加载，无法保存。'); return; }
        const contactId = `living_world_${npc.id}`;
        let contact = window.myCharacters.find(item => item?.id === contactId);
        if (!contact) {
            contact = { id: contactId, name: npc.name, avatar: npc.avatar || DEFAULT_AVATAR, description: npc.summary, personality: npc.summary, scenario: npc.summary, history: [], chatConfig: {} };
            window.myCharacters.push(contact);
            try {
                if (typeof window.saveCharactersToStorage !== 'function') throw new Error('联系人保存服务不可用。');
                const saved = await window.saveCharactersToStorage();
                if (saved === false) throw new Error('联系人保存失败。');
            } catch (error) {
                const index = window.myCharacters.indexOf(contact); if (index >= 0) window.myCharacters.splice(index, 1);
                showToast(error?.message || '联系人保存失败。'); return;
            }
        }
        try {
            mutate(next => {
                const target = next.npcs.find(item => item.id === npcId); if (!target) throw new Error('该论坛成员已不存在。');
                target.tier = 'contact'; target.persistent = true; target.contactCharId = contactId;
                const event = addEvent(next, 'npc_promoted_to_contact', 'user', npcId, { contactId }, 'private'); grantKnowledge(next, 'user', event, 'user', 'direct', 1);
            });
            syncAccounts(); render(); showToast('已添加为联系人。');
        } catch (error) { showToast(error?.message || '联系人状态保存失败。'); }
    }
    function openNotice(id) { const notice = safeList(loadState().notifications[viewer().id]).find(item => item.id === id); if (!notice) return; try { mutate(next => { const item = safeList(next.notifications[next.viewerId]).find(row => row.id === id); if (item) item.read = true; }); if (notice.postId && loadState().posts.some(post => post.id === notice.postId && isVisible(post, viewer().id))) openPost(notice.postId); else render(); } catch (error) { showToast(error.message); } }

    function getGenerationContext() {
        const world = loadState();
        // A batch with several actors must never receive private chats, traces or secrets.
        const publicPosts = world.posts.filter(item => !item.visibility || item.visibility === 'public').slice(0, 16);
        const recent = world.events.filter(event => event.visibility === 'public' && ['forum_post', 'forum_reply', 'forum_news_reply', 'forum_like', 'forum_community_create'].includes(event.type)).slice(-10).map(event => ({ id: event.id, type: event.type, actorId: event.actorId, targetId: event.targetId, at: event.createdAt }));
        const cast = [...new Map([...world.npcs, ...Object.values(world.accounts)].filter(item => item?.id).map(item => [item.id, item])).values()].slice(0, 14).map(item => { const npc = world.npcs.find(row => row.id === item.id); return { id: item.id, name: item.name, username:item.username || '', followerCount:Math.max(0,Number(item.followerCount || 0),Object.values(world.follows).filter(list => safeList(list).includes(item.id)).length), interests: item.interests, publicBio: String(world.profileEdits[item.id]?.summary || item.summary || npc?.summary || '').slice(0, 100), mood: String(item.mood || npc?.mood || '').slice(0, 80), style: String(npc?.style || '').slice(0, 60), knownPublicEventIds: safeList(world.knowledge[item.id]).map(row => row.eventId).filter(id => recent.some(event => event.id === id)).slice(-6) }; });
        const chars = typeof window.getWechatGroupContacts === 'function' ? window.getWechatGroupContacts() : safeList(window.myCharacters).filter(char => char && !char.isGroupChat);
        const worldSeeds = safeList(chars).filter(char => char?.id).slice(0, 4).map(char => ({ charId: char.id, accountId: `char:${char.id}`, name: char.chatConfig?.nickname || char.name, persona: String(char.description || char.personality || '').slice(0, 400), worldBook: safeList(char.worldBook).filter(entry => entry && entry.enabled !== false).slice(0, 5).map(entry => ({ title: String(entry.name || entry.title || entry.key || '').slice(0, 60), content: String(entry.content || entry.text || entry.entry || entry.value || entry.comment || '').slice(0, 550) })), mood: typeof window.getWechatAiStatusSnapshot === 'function' ? JSON.stringify(window.getWechatAiStatusSnapshot(char)?.fields || {}).slice(0, 300) : '' }));
        const viewedCommunities = safeList(world.views.user).slice(-30).map(id => world.posts.find(post => post.id === id)?.communityId).filter(Boolean);
        const viewerSignals = { viewedCommunityIds:[...new Set(viewedCommunities)].slice(-6), joinedCommunityIds:safeList(world.subscriptions.user).slice(-8), recentSearches:safeList(world.searches.user).slice(0,4) };
        return { communities: world.communities.filter(item => !item.visibility || item.visibility === 'public').map(item => ({ id: item.id, name: item.name })), cast, worldSeeds, recentPublicEvents: recent, publicPosts: publicPosts.map(item => ({ id: item.id, authorId: item.authorId, communityId: item.communityId, title: item.deletedAt ? '该贴已删' : String(item.title).slice(0, 80), deleted: !!item.deletedAt })), realNews: world.newsItems.slice(0,8).map(item => ({ id:item.id, title:item.title, source:item.source, url:item.url, publishedAt:item.publishedAt })), newsDiscussion:world.newsComments.slice(-12).map(item => ({ newsId:item.newsId, authorId:item.authorId, body:item.body.slice(0,180) })), viewerSignals, promotionsEnabled:!!world.forumSettings.promotionsEnabled };
    }
    function parseJsonBatch(content) { const text = String(content || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim(); if (!text.startsWith('{') || !text.endsWith('}')) throw new Error('AI 没有返回完整 JSON。'); return JSON.parse(text); }
    function nextSmartTime(after) {
        const anchor = new Date(after); const slots = [[3,0],[8,0],[12,30]];
        const candidates = [];
        for (let day = 0; day < 3; day++) for (const [hour, minute] of slots) { const value = new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate() + day,hour,minute).getTime() + Math.floor((Math.random() - .5) * 90 * 60000); if (value > after + 30 * 60000) candidates.push(value); }
        return Math.min(...candidates);
    }
    function compactAvatar(url) {
        if (!/^data:image\//i.test(url)) return Promise.resolve(url);
        return new Promise((resolve,reject) => { const image = new Image(); image.onload = () => { try { const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160; canvas.getContext('2d').drawImage(image,0,0,160,160); resolve(canvas.toDataURL('image/jpeg',.72)); } catch (error) { reject(error); } }; image.onerror = () => reject(new Error('生图结果无法读取。')); image.src = url; });
    }
    async function generatePendingAvatars(limit = 2, onlyId = '', force = false) {
        if (loadState().forumSettings.profileMode !== 'full') return { made: 0, error: '' };
        if (typeof window.callWechatImageGenerationApi !== 'function') return { made: 0, error: '当前版本没有生图调用层。' };
        const world = loadState(); const ids = Object.keys(world.profilePrompts).filter(id => !onlyId || id === onlyId).filter(id => { const profile = world.npcs.find(npc => npc.id === id) || world.publicProfiles[id]; return profile && (force || profile.avatarPromptApplied !== world.profilePrompts[id]) && (force || profile.avatarAttemptPrompt !== world.profilePrompts[id] || now() - Number(profile.avatarLastAttemptAt || 0) >= 3600000); }).slice(0,limit);
        let made = 0; let error = '';
        for (const id of ids) {
            const person = account(id); const chars = typeof window.getWechatGroupContacts === 'function' ? window.getWechatGroupContacts() : window.myCharacters; const char = person.type === 'char' ? safeList(chars).find(item => String(item.id) === String(person.charId || id.slice(5))) : null;
            const referenceImage = char && typeof window.getWechatImageReferenceForChar === 'function' ? window.getWechatImageReferenceForChar(char) : (char?.avatar && char.avatar !== DEFAULT_AVATAR ? char.avatar : '');
            const prompt = `论坛个人头像，只画单人，适合圆形裁剪，无文字。角色：${person.name}。当下公开状态：${world.profilePrompts[id]}。保持角色身份和外观连续，不复制其他人物。`;
            try { mutate(next => { const target = next.npcs.find(npc => npc.id === id) || (next.publicProfiles[id] ||= {}); target.avatarAttemptPrompt = next.profilePrompts[id]; target.avatarLastAttemptAt = now(); }); const result = await window.callWechatImageGenerationApi(prompt,{ referenceImage, referenceStyle: 'identity', size: '1024x1024' }); if (!result?.ok || !result.url) throw new Error(result?.error || '生图 API 未返回头像。'); const imageUrl = await compactAvatar(result.url); if (imageUrl.length > 250000) throw new Error('头像图片过大，未写入论坛数据。'); mutate(next => { const target = next.npcs.find(npc => npc.id === id) || (next.publicProfiles[id] ||= {}); target.generatedAvatar = imageUrl; target.avatarPromptApplied = next.profilePrompts[id]; if (next.accounts[id]) next.accounts[id].generatedAvatar = imageUrl; }); made++; } catch (failure) { error = failure.message || '头像生成失败。'; break; }
        }
        return { made, error };
    }
    async function ensureProfile(id, force = false) {
        const person = account(id); if (id === 'user' || person.id === 'unknown' || loadingProfiles.has(id)) return;
        const world = loadState(); const current = world.npcs.find(npc => npc.id === id) || world.publicProfiles[id]; if (!force && current?.profileGeneratedAt && world.forumSettings.profileMode !== 'full') return;
        if (!force && world.forumSettings.profileMode === 'full' && world.profilePrompts[id]) { const result = await generatePendingAvatars(1,id); if (result.error) showToast(`头像未更新：${result.error}`); if (result.made) render(); return; }
        if (!force && now() - Number(current?.profileLastAttemptAt || 0) < 3600000) return;
        if (typeof window.callChatApi !== 'function') { showToast('未配置资料生成 API。'); return; }
        if (!force && current?.profileGeneratedAt) {
            const profileChoice = await window.ByndJev?.choose('profile', { person:{ name:person.name, username:person.username, summary:current.summary || person.summary || '' }, hoursSinceUpdate:Math.floor((now()-Number(current.profileGeneratedAt))/3600000), recentPublicActivity:world.events.filter(event => event.actorId === id && event.visibility === 'public').slice(-4).map(event => ({ type:event.type, at:event.createdAt })) }, 'Has this character’s public identity or recent life changed enough to update their profile now?', { update:'A meaningful public profile change is appropriate.', keep:'Keep the current profile unchanged.' });
            if (profileChoice === 'keep') { try { mutate(next => { const target = next.npcs.find(npc => npc.id === id) || (next.publicProfiles[id] ||= {}); target.profileLastAttemptAt = now(); }); } catch (error) { showToast(error.message); } return; }
        }
        try { mutate(next => { const target = next.npcs.find(npc => npc.id === id) || (next.publicProfiles[id] ||= {}); target.profileLastAttemptAt = now(); }); } catch (error) { showToast(error.message); return; }
        loadingProfiles.add(id); showToast('正在生成公开资料…');
        try {
            const context = getGenerationContext();
            const seedId = person.charId || world.npcs.find(npc => npc.id === id)?.originCharId;
            const known = new Set(safeList(world.knowledge[id]).map(row => row.eventId));
            context.worldSeeds = context.worldSeeds.filter(seed => seed.charId === seedId);
            context.recentPublicEvents = context.recentPublicEvents.filter(event => known.has(event.id));
            context.publicPosts = context.publicPosts.filter(post => post.authorId === id || world.events.some(event => known.has(event.id) && event.targetId === post.id));
            context.newsDiscussion = context.newsDiscussion.filter(row => row.authorId === id || world.events.some(event => known.has(event.id) && event.type === 'forum_news_reply' && event.targetId === row.newsId && event.actorId === row.authorId));
            delete context.viewerSignals;
            const prompt = `只为论坛成员 ${id} 生成符合既有世界的公开主页，严格 JSON：{"profileUpdates":[{"id":"${id}","name":"社交平台公开昵称","username":"@可更改的公开ID","summary":"签名简介","mood":"当前心情","followerCount":0,"avatarPrompt":"当下头像画面描述"}]}。followerCount 是该账号的公开粉丝总数，不要编造粉丝身份；不得小于已知关注者 ${profileMetrics(id).followers} 人，变化应符合既有经历。保留既有身份，不把 worldSeeds 的秘密当成全员已知。昵称和 @ID 可以随心情自然变化，但不要复制私聊原文。不要生成其他帖子或人物。\n${JSON.stringify(context)}`;
            const result = await window.callChatApi([{ role:'system', content:'只返回严格 JSON。' },{ role:'user', content:prompt }],{ background:true, stream:false, temperature:.75, max_tokens:550, usageFeature:'forum' });
            if (!result?.ok) throw new Error(result?.error || '资料生成失败。');
            const valid = validateBatch(parseJsonBatch(result.content));
            if (valid.profiles.length !== 1 || valid.profiles[0].id !== id) throw new Error('资料 API 返回的人物不匹配。');
            const profile = valid.profiles[0];
            mutate(next => { const {avatarPrompt,...fields} = profile; const target = next.npcs.find(npc => npc.id === id) || (next.publicProfiles[id] ||= {}); Object.assign(target,fields,{profileGeneratedAt:now()}); next.profilePrompts[id] = avatarPrompt; if (next.accounts[id]) Object.assign(next.accounts[id],fields); const event = addEvent(next,'forum_profile_change',id,id,{name:fields.name,username:fields.username,summary:fields.summary},'public'); grantKnowledge(next,id,event,id,'authored',1); });
            let message = '公开资料已更新。';
            if (loadState().forumSettings.profileMode === 'full') { const avatars = await generatePendingAvatars(1,id,force); message = avatars.error ? `资料已更新；头像未更新：${avatars.error}` : avatars.made ? '公开资料和头像已更新。' : '公开资料已更新，头像暂无变化。'; }
            render(); showToast(message);
        } catch (error) { showToast(error.message || '资料生成失败。'); } finally { loadingProfiles.delete(id); }
    }
    function validateBatch(batch) {
        if (!batch || typeof batch !== 'object' || Array.isArray(batch)) throw new Error('AI 世界批次格式无效。');
        const world = loadState();
        const validId = value => /^[a-z][a-z0-9_-]{2,48}$/i.test(String(value || ''));
        const requireArray = (key, max) => { if (batch[key] == null) return []; if (!Array.isArray(batch[key]) || batch[key].length > max) throw new Error(`AI 批次的 ${key} 格式无效。`); return batch[key]; };
        const input = { communities: requireArray('newCommunities', 8), npcs: requireArray('newNPCs', 12), posts: requireArray('newPosts', 8), comments: requireArray('newComments', 14), newsComments: requireArray('newNewsComments', 8), relationships: requireArray('relationshipChanges', 10), transfers: requireArray('knowledgeTransfers', 12), profiles: requireArray('profileUpdates', 12), deletions: requireArray('deletePosts', 6), links: requireArray('socialLinks', 12), promotions: requireArray('newPromotions', 3) };
        const communities = input.communities.map(item => ({ id: String(item.id || '').trim(), name: String(item.name || '').trim(), description: String(item.description || '').trim(), icon: String(item.icon || 'ri-community-line').trim() })).filter(item => validId(item.id) && item.name && item.description && !world.communities.some(row => row.id === item.id)).map(item => ({ ...item, name: item.name.slice(0, 40), description: item.description.slice(0, 160), visibility: 'public', createdAt: now(), generated: true }));
        const originIds = new Set(getGenerationContext().worldSeeds.map(item => item.charId));
        const newNpcs = input.npcs.map(item => ({ id: String(item.id || '').trim(), name: String(item.name || '').trim(), username: String(item.username || '').trim(), summary: String(item.summary || '').trim(), style: String(item.style || '').trim().slice(0, 80), occupation: String(item.occupation || '').trim().slice(0, 80), interests: safeList(item.interests).map(value => String(value)).filter(validId).slice(0, 5), avatar: '', originCharId: String(item.originCharId || ''), avatarPrompt: String(item.avatarPrompt || '').trim().slice(0, 500) })).filter(item => validId(item.id) && item.name && item.summary && originIds.has(item.originCharId) && !world.npcs.some(row => row.id === item.id) && !world.accounts[item.id]).map(item => ({ ...item, type: 'npc', tier: 'ephemeral', createdAt: now(), lastActiveAt: now(), generated: true }));
        const allowedAuthors = new Set([...Object.keys(world.accounts), ...world.npcs.map(item => item.id), ...newNpcs.map(item => item.id)]); const allowedGeneratedAuthors = new Set([...allowedAuthors].filter(id => id !== 'user')); const allowedCommunities = new Set([...world.communities.filter(item => !item.visibility || item.visibility === 'public').map(item => item.id), ...communities.map(item => item.id)]);
        const posts = input.posts.map(item => ({ authorId: String(item.authorId || ''), communityId: String(item.communityId || ''), title: String(item.title || '').trim(), body: String(item.body || '').trim(), imageUrl: /^https?:\/\//i.test(String(item.imageUrl || '')) ? String(item.imageUrl).slice(0,800) : '', deleteAfterMinutes: Number(item.deleteAfterMinutes || 0), amaDurationHours: Number(item.amaDurationHours || 0), amaStartsInMinutes: Number(item.amaStartsInMinutes || 0) })).filter(item => allowedGeneratedAuthors.has(item.authorId) && allowedCommunities.has(item.communityId) && item.title && item.body && (item.deleteAfterMinutes === 0 || (item.deleteAfterMinutes >= 1 && item.deleteAfterMinutes <= 120)) && (item.amaDurationHours === 0 && item.amaStartsInMinutes === 0 || [1,2,4,8,12,24].includes(item.amaDurationHours) && Number.isInteger(item.amaStartsInMinutes) && item.amaStartsInMinutes >= 0 && item.amaStartsInMinutes <= 43200)).map(item => ({ ...item, title: item.title.slice(0,120), body: item.body.slice(0,3000) }));
        const comments = input.comments.map(item => ({ authorId: String(item.authorId || ''), postId: String(item.postId || ''), body: String(item.body || '').trim() })).filter(item => allowedGeneratedAuthors.has(item.authorId) && world.posts.some(post => post.id === item.postId && !post.deletedAt && (!post.visibility || post.visibility === 'public') && isVisible(post, item.authorId)) && item.body).map(item => ({ ...item, body: item.body.slice(0,1600) }));
        const newsComments = input.newsComments.map(item => ({ authorId:String(item.authorId || ''), newsId:String(item.newsId || ''), body:String(item.body || '').trim().slice(0,1200) })).filter(item => allowedGeneratedAuthors.has(item.authorId) && world.newsItems.some(news => news.id === item.newsId) && item.body);
        const relationships = input.relationships.map(item => ({ fromId: String(item.fromId || ''), toId: String(item.toId || ''), deltas: item.deltas, reasonEventId: String(item.reasonEventId || '') })).filter(item => allowedGeneratedAuthors.has(item.fromId) && allowedAuthors.has(item.toId) && item.fromId !== item.toId && knowsEvent(world, item.fromId, item.reasonEventId) && world.events.some(event => { const people = [event.actorId, event.targetId, world.posts.find(post => post.id === event.targetId)?.authorId]; return event.id === item.reasonEventId && event.visibility === 'public' && people.includes(item.fromId) && people.includes(item.toId); }) && Object.entries(item.deltas || {}).length > 0 && Object.entries(item.deltas || {}).every(([key, value]) => RELATIONSHIP_DIMENSIONS.has(key) && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 12));
        const transfers = input.transfers.map(item => ({ sourceId: String(item.sourceId || ''), recipientId: String(item.recipientId || ''), eventId: String(item.eventId || ''), confidence: Number(item.confidence || 0) })).filter(item => allowedGeneratedAuthors.has(item.sourceId) && allowedAuthors.has(item.recipientId) && item.sourceId !== item.recipientId && world.events.some(event => event.id === item.eventId && event.visibility === 'public') && knowsEvent(world, item.sourceId, item.eventId) && item.confidence > 0 && item.confidence <= 1);
        const profiles = input.profiles.map(item => ({ id: String(item.id || ''), name: String(item.name || '').trim().slice(0, 40), username: String(item.username || '').trim().slice(0, 32), summary: String(item.summary || '').trim().slice(0, 220), mood: String(item.mood || '').trim().slice(0, 80), ...(item.followerCount == null ? {} : { followerCount:Number(item.followerCount) }), avatarPrompt: String(item.avatarPrompt || '').trim().slice(0, 500) })).filter(item => allowedGeneratedAuthors.has(item.id) && item.name && /^@[\p{L}\p{N}_.-]{2,31}$/u.test(item.username) && item.summary && (item.followerCount == null || Number.isSafeInteger(item.followerCount) && item.followerCount >= Object.values(world.follows).filter(list => safeList(list).includes(item.id)).length && item.followerCount <= 10000000) && (world.forumSettings.profileMode !== 'full' || item.avatarPrompt));
        const promotions = input.promotions.map(item => ({ sponsor:String(item.sponsor || '').trim().slice(0,60), headline:String(item.headline || '').trim().slice(0,120), body:String(item.body || '').trim().slice(0,500), detail:String(item.detail || '').trim().slice(0,1200), cta:String(item.cta || '了解详情').trim().slice(0,24), targetCommunityIds:safeList(item.targetCommunityIds).map(String), privateFor:String(item.privateFor || '') })).filter(item => item.sponsor && item.headline && item.body && item.detail && item.targetCommunityIds.length > 0 && item.targetCommunityIds.every(id => allowedCommunities.has(id)) && ['', 'user'].includes(item.privateFor) && world.forumSettings.promotionsEnabled);
        const deletions = input.deletions.map(item => ({ postId: String(item.postId || ''), authorId: String(item.authorId || '') })).filter(item => allowedGeneratedAuthors.has(item.authorId) && world.posts.some(post => post.id === item.postId && post.authorId === item.authorId && post.generated && !post.deletedAt));
        const links = input.links.map(item => ({ fromId: String(item.fromId || ''), toId: String(item.toId || ''), kind: String(item.kind || ''), sourceEventId: String(item.sourceEventId || ''), viaId: String(item.viaId || '') })).filter(item => { const event = world.events.find(row => row.id === item.sourceEventId && row.visibility === 'public'); if (!event || !allowedGeneratedAuthors.has(item.fromId) || !allowedAuthors.has(item.toId) || item.fromId === item.toId || !['met','heard'].includes(item.kind) || !knowsEvent(world,item.fromId,item.sourceEventId)) return false; const people = new Set([event.actorId,event.targetId,world.posts.find(post => post.id === event.targetId)?.authorId]); if (item.kind === 'met') return people.has(item.fromId) && people.has(item.toId); return !!(item.viaId && allowedAuthors.has(item.viaId) && item.viaId !== item.fromId && item.viaId !== item.toId && people.has(item.viaId) && world.socialLinks.some(link => link.fromId === item.viaId && link.toId === item.toId)); });
        if (world.npcs.length + newNpcs.length > MAX_NPCS) throw new Error('论坛人物数量已达上限，需先整理旧人物。');
        if (new Set(communities.map(item => item.id)).size !== communities.length || new Set(newNpcs.map(item => item.id)).size !== newNpcs.length || new Set(profiles.map(item => item.id)).size !== profiles.length || new Set(deletions.map(item => item.postId)).size !== deletions.length || new Set(links.map(item => `${item.fromId}>${item.toId}`)).size !== links.length || Object.entries(input).some(([key, rows]) => rows.length !== ({ communities, npcs: newNpcs, posts, comments, newsComments, relationships, transfers, profiles, deletions, links, promotions })[key].length)) throw new Error('AI 批次含无效或重复引用，已整批拒绝。');
        if (!communities.length && !newNpcs.length && !posts.length && !comments.length && !newsComments.length && !relationships.length && !transfers.length && !profiles.length && !deletions.length && !links.length && !promotions.length) throw new Error('AI 批次没有可写入的有效内容。');
        return { communities, newNpcs, posts, comments, newsComments, relationships, transfers, profiles, deletions, links, promotions };
    }
    function agentActors(world) {
        return [...new Map([...world.npcs, ...Object.values(world.accounts)].filter(item => item?.id && item.id !== 'user').map(item => [item.id,item])).values()];
    }
    function actorKnowledge(world, actorId) {
        const events = new Map(world.events.map(event => [event.id,event]));
        return safeList(world.knowledge[actorId]).map(row => ({ row, event:events.get(row?.eventId) })).filter(({ event }) => event && (event.visibility === 'public' || event.metadata?.privateTo?.includes(actorId) || event.actorId === actorId || event.targetId === actorId)).sort((a,b) => Number(a.row.knownAt || a.event.createdAt) - Number(b.row.knownAt || b.event.createdAt));
    }
    function actorBrowsePosts(world, actorId) {
        const actor = world.accounts[actorId] || world.npcs.find(item => item.id === actorId) || {};
        const habits = world.agentStates[actorId]?.communityCounts || {};
        return world.posts.filter(post => post.authorId !== actorId && !post.deletedAt && (!post.visibility || post.visibility === 'public') && (!post.amaStartsAt || post.amaStartsAt <= now()) && isVisible(post,actorId)).map(post => ({ post, score: (safeList(actor.interests).includes(post.communityId) ? 5 : 0) + Math.min(4,Number(habits[post.communityId] || 0)) + (safeList(world.follows[actorId]).includes(post.authorId) ? 4 : 0) + Math.max(0,3 - Math.floor((now() - Number(post.createdAt || 0)) / DAY)) })).sort((a,b) => b.score - a.score || b.post.createdAt - a.post.createdAt).slice(0,3).map(row => row.post);
    }
    function chooseWorldActor(world, preferredId = '') {
        const current = now();
        const actors = agentActors(world).filter(actor => !preferredId || actor.id === preferredId).filter(actor => Number(world.agentStates[actor.id]?.nextEligibleAt || 0) <= current);
        const ranked = actors.map(actor => { const record = world.agentStates[actor.id] || {}; const unseen = actorKnowledge(world,actor.id).filter(({ row,event }) => Number(row.knownAt || event.createdAt) > Number(record.lastConsideredAt || 0) && event.actorId !== actor.id); const direct = unseen.filter(({ event }) => event.targetId === actor.id || world.posts.some(post => post.id === event.targetId && post.authorId === actor.id)).length; const idle = Math.min(12,(current - Number(record.lastActedAt || world.createdAt || current)) / 3600000); return { actor, score: Math.min(8,unseen.length) * 2 + direct * 6 + Math.max(0,idle) + Math.random() * 2 }; });
        ranked.sort((a,b) => b.score - a.score);
        return ranked[0]?.actor || null;
    }
    function actorWorldContext(world, actorId, encountered) {
        const actor = world.accounts[actorId] || world.npcs.find(item => item.id === actorId);
        const known = actorKnowledge(world,actorId).slice(-14).map(({ row,event }) => ({ id:event.id, type:event.type, actorId:event.actorId, targetId:event.targetId, at:event.createdAt, learnedAt:row.knownAt, source:row.kind, excerpt:String(event.metadata?.excerpt || event.metadata?.title || '').slice(0,140) }));
        const charId = actor?.charId || actor?.originCharId || (actorId.startsWith('char:') ? actorId.slice(5) : '');
        const char = safeList(typeof window.getWechatGroupContacts === 'function' ? window.getWechatGroupContacts() : window.myCharacters).find(item => String(item?.id) === charId);
        const record = world.agentStates[actorId] || {};
        const worldRules = safeList(char?.worldBook).filter(entry => entry && entry.enabled !== false).slice(0,4).map(entry => ({ title:String(entry.name || entry.title || entry.key || '').slice(0,60), content:String(entry.content || entry.text || entry.entry || entry.value || '').slice(0,400) }));
        return { actor:{ id:actorId, name:actor?.name || '', username:actor?.username || '', summary:actor?.summary || '', mood:actor?.mood || '', style:actor?.style || '', interests:safeList(actor?.interests), persona:char && actorId.startsWith('char:') ? String(char.description || char.personality || '').slice(0,500) : '', worldRules, currentStatus:char && actorId.startsWith('char:') && typeof window.getWechatAiStatusSnapshot === 'function' ? JSON.stringify(window.getWechatAiStatusSnapshot(char)?.fields || {}).slice(0,300) : '' }, knownEvents:known, encounteredPosts:encountered.map(post => ({ id:post.id, authorId:post.authorId, communityId:post.communityId, title:post.title.slice(0,120), body:String(post.body || '').slice(0,500), eventId:world.events.find(event => event.type === 'forum_post' && event.targetId === post.id)?.id || '' })), ownPosts:world.posts.filter(post => post.authorId === actorId && !post.deletedAt && isVisible(post,actorId)).slice(0,5).map(post => ({ id:post.id, title:post.title, communityId:post.communityId, createdAt:post.createdAt })), communities:world.communities.filter(item => !item.visibility || item.visibility === 'public').map(item => ({ id:item.id, name:item.name, description:String(item.description || '').slice(0,100) })), learnedHabits:{ actions:record.actionCounts || {}, communities:record.communityCounts || {} }, recentChoices:world.agentDecisions.filter(item => item.actorId === actorId).slice(-5).map(item => ({ action:item.action, at:item.createdAt })), relationships:Object.entries(world.relationships).filter(([key]) => key.startsWith(`${actorId}>`)).slice(0,8).map(([key,value]) => ({ toId:key.slice(actorId.length + 1), familiarity:value.familiarity || 0, trust:value.trust || 0, conflict:value.conflict || 0 })) };
    }
    function queueRecentInteractions() {
        const world = loadState();
        if (!world.forumSettings.replyReactionsEnabled) return;
        const recent = world.comments.filter(comment => !comment.generated && Number(comment.createdAt) > now() - 48 * 3600000).slice(-40);
        const pending = recent.filter(comment => {
            const post = world.posts.find(item => item.id === comment.postId);
            return post && !post.deletedAt && post.authorId !== 'user' && post.authorId !== comment.authorId && agentActors(world).some(actor => actor.id === post.authorId) && !world.interactionHandled.includes(comment.id) && !world.interactionQueue.some(item => item.commentId === comment.id || item.actorId === post.authorId) && !world.comments.some(item => item.parentCommentId === comment.id && item.authorId === post.authorId);
        });
        if (!pending.length) return;
        mutate(next => {
            pending.slice(-3).forEach(comment => {
                const post = next.posts.find(item => item.id === comment.postId);
                const event = next.events.find(item => item.type === 'forum_reply' && item.metadata?.commentId === comment.id);
                if (!post || !event || next.interactionQueue.some(item => item.actorId === post.authorId)) return;
                next.interactionQueue.push({ id:uid('reaction'), actorId:post.authorId, postId:post.id, commentId:comment.id, eventId:event.id, dueAt:Number(comment.createdAt) + (2 + Math.floor(Math.random() * 11)) * 60000, attempts:0 });
            });
            next.interactionQueue = next.interactionQueue.slice(-40);
        });
    }
    function replyContradictsCurrentTime(body, replyAt, commentAt) {
        if (replyAt - Number(commentAt) < 2 * 3600000) return false;
        const text = String(body || '');
        const hour = new Date(replyAt).getHours();
        const refersToLastNight = /昨晚|昨夜|昨天晚上|你昨晚说/.test(text);
        if (hour >= 6 && hour < 18 && !refersToLastNight && /晚安|晚上好|怎么还没睡|快去睡|夜里凉|夜深了/.test(text)) return true;
        if ((hour >= 18 || hour < 4) && !/今早|今天早上|中午那会/.test(text) && /早安|早上好|午安|中午好/.test(text)) return true;
        return replyAt - Number(commentAt) >= 4 * 3600000 && /你刚才说|你刚刚说|你现在还没睡/.test(text);
    }
    async function maybeRunInteraction() {
        if (interactionBusy || isGenerating || typeof window.callChatApi !== 'function') return;
        const forum = document.getElementById('app-living-world-window');
        const world = loadState();
        const replyMode = world.forumSettings.replyMode;
        if (document.hidden || replyMode === 'off' || (replyMode === 'forum' && (!forum || forum.classList.contains('hidden')))) return;
        if (now() - Number(world.forumSettings.lastReactionCallAt || 0) < 10 * 60000) return;
        const task = world.interactionQueue.find(item => Number(item.dueAt) <= now());
        if (!task) return;
        const post = world.posts.find(item => item.id === task.postId);
        const comment = world.comments.find(item => item.id === task.commentId);
        const actor = agentActors(world).find(item => item.id === task.actorId);
        if (!post || post.deletedAt || !comment || !actor || !knowsEvent(world,actor.id,task.eventId)) {
            try { mutate(next => { next.interactionQueue = next.interactionQueue.filter(item => item.id !== task.id); next.interactionHandled.push(task.commentId); next.interactionHandled = next.interactionHandled.slice(-160); }); } catch (error) { showToast(error.message); }
            return;
        }
        const lastAttempt = Number(world.agentStates[actor.id]?.lastReactionAttemptAt || 0);
        if (now() - lastAttempt < 4 * 3600000) {
            try { mutate(next => { const queued = next.interactionQueue.find(item => item.id === task.id); if (queued) queued.dueAt = lastAttempt + 4 * 3600000; }); } catch (error) { showToast(error.message); }
            return;
        }
        interactionBusy = true;
        try {
            const jevChoice = await window.ByndJev?.choose('forumReply', { actor:{ name:actor.name, summary:actor.summary || '', mood:actor.mood || '' }, post:{ title:post.title, body:String(post.body || '').slice(0,300) }, comment:{ body:String(comment.body || '').slice(0,350), ageMinutes:Math.max(0,Math.floor((now()-Number(comment.createdAt))/60000)) }, currentLocalTime:new Date(now()).toLocaleString('zh-CN'), previousDeferrals:Number(task.deferrals || 0) }, 'Should the author answer this forum comment now, leave it for later, or remain silent? Do not treat an old greeting as a current live conversation.', { reply:'Reply now with a context-aware comment.', later:'Wait for a later opportunity before deciding again.', silence:'No response is needed.' });
            if (jevChoice === 'later' && Number(task.deferrals || 0) < 1) {
                mutate(next => { const queued = next.interactionQueue.find(item => item.id === task.id); if (!queued) throw new Error('互动任务已结束。'); queued.deferrals = 1; queued.dueAt = now() + 2 * 3600000; next.forumSettings.lastReactionCallAt = now(); });
                return;
            }
            if (jevChoice === 'silence') {
                mutate(next => { next.interactionQueue = next.interactionQueue.filter(item => item.id !== task.id); next.interactionHandled.push(task.commentId); next.interactionHandled = next.interactionHandled.slice(-160); next.agentStates[actor.id] ||= {}; next.agentStates[actor.id].lastReactionAttemptAt = now(); next.forumSettings.lastReactionCallAt = now(); next.agentDecisions.push({ id:uid('decision'), actorId:actor.id, action:'silence', sourceEventIds:[task.eventId], targetCommentId:task.commentId, createdAt:now() }); next.agentDecisions = next.agentDecisions.slice(-160); });
                return;
            }
            mutate(next => { const queued = next.interactionQueue.find(item => item.id === task.id); if (!queued) throw new Error('互动任务已结束。'); queued.attempts = Number(queued.attempts || 0) + 1; queued.dueAt = now() + 60 * 60000; next.agentStates[actor.id] ||= {}; next.agentStates[actor.id].lastReactionAttemptAt = now(); next.forumSettings.lastReactionCallAt = now(); });
            const context = actorWorldContext(world,actor.id,[]);
            const replyAt = now();
            const localTime = timestamp => new Date(timestamp).toLocaleString('zh-CN',{ year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false });
            const elapsedMinutes = Math.max(0,Math.floor((replyAt - Number(comment.createdAt)) / 60000));
            const prompt = `你只扮演 BYND 论坛帖子作者。${jevChoice === 'reply' ? 'Jev 已选择现在回复，你只需写出合适的文字；若与事实冲突可返回 silence。' : '有人在你的帖子下回复，但你不一定需要回应：根据角色性格、当下关系与评论内容判断。'}现在是 ${localTime(replyAt)}，对方在 ${localTime(comment.createdAt)} 留言，已过去 ${Math.floor(elapsedMinutes / 60)} 小时 ${elapsedMinutes % 60} 分钟。这是异步论坛，不是即时聊天。若留言已过去数小时，应考虑沉默或自然地从现在的时刻回应；不能把旧问候当成刚说的，也不能假设对方仍处于当时的夜晚或还没睡。不要原样回一句过时的“晚安／早安”，不要硬编迟到理由。不要透露私聊原文，不要假装知道未传达的事。只输出严格 JSON：{"action":"reply|silence","body":"若回复则填写自然、具体的短评"}。不要输出其他字段。\n${JSON.stringify({ actor:context.actor, knownEvents:context.knownEvents, relationships:context.relationships, learnedHabits:context.learnedHabits, currentLocalTime:localTime(replyAt), elapsedMinutes, post:{ id:post.id, title:post.title, body:String(post.body || '').slice(0,1000), communityId:post.communityId }, comment:{ id:comment.id, authorId:comment.authorId, body:comment.body, createdAt:comment.createdAt, localTime:localTime(comment.createdAt) } })}`;
            const result = await window.callChatApi([{ role:'system', content:'只输出角色针对这条评论的严格 JSON 决策。' },{ role:'user', content:prompt }],{ background:true, backgroundPriority:-1, stream:false, temperature:.75, max_tokens:400, usageFeature:'forum' });
            if (!result?.ok) throw new Error(result?.error || '角色互动判断失败。');
            const decision = parseJsonBatch(result.content);
            if (!decision || !['reply','silence'].includes(decision.action) || (decision.action === 'reply' && (typeof decision.body !== 'string' || !decision.body.trim() || decision.body.length > 1600 || copiesPrivateChat(world,actor.id,decision)))) throw new Error('角色互动内容无效。');
            if (decision.action === 'reply' && replyContradictsCurrentTime(decision.body,now(),comment.createdAt)) { decision.action = 'silence'; decision.body = ''; console.warn('Living World rejected a reply inconsistent with the current time'); }
            mutate(next => {
                if (!next.interactionQueue.some(item => item.id === task.id)) throw new Error('互动任务已结束。');
                const currentPost = next.posts.find(item => item.id === task.postId);
                const currentComment = next.comments.find(item => item.id === task.commentId);
                if (decision.action === 'reply' && currentPost && !currentPost.deletedAt && currentComment && !next.comments.some(item => item.parentCommentId === task.commentId && item.authorId === actor.id)) {
                    const row = { id:uid('comment'), postId:task.postId, parentCommentId:task.commentId, authorId:actor.id, body:decision.body.trim(), createdAt:now(), generated:true };
                    next.comments.push(row); currentPost.commentCount = Number(currentPost.commentCount || 0) + 1;
                    const event = addEvent(next,'forum_reply',task.postId,{ commentId:row.id, excerpt:row.body.slice(0,180), sourceEventIds:[task.eventId], generated:true },'public');
                    grantKnowledge(next,actor.id,event,actor.id,'authored',1);
                    notify(next,currentComment.authorId,'有人回复了你的评论',`${actor.name}：${row.body.slice(0,70)}`,task.postId);
                    grantKnowledge(next,currentComment.authorId,event,actor.id,'notification',1);
                    applyRelationshipDelta(next,actor.id,currentComment.authorId,{ familiarity:1 },event.id);
                }
                next.interactionQueue = next.interactionQueue.filter(item => item.id !== task.id);
                next.interactionHandled.push(task.commentId); next.interactionHandled = next.interactionHandled.slice(-160);
                next.agentDecisions.push({ id:uid('decision'), actorId:actor.id, action:decision.action, sourceEventIds:[task.eventId], targetCommentId:task.commentId, createdAt:now() });
                next.agentDecisions = next.agentDecisions.slice(-160);
            });
            if (decision.action === 'reply') render();
        } catch (error) {
            console.warn('Living World interaction rejected',error);
            try { mutate(next => { const queued = next.interactionQueue.find(item => item.id === task.id); if (!queued) return; if (Number(queued.attempts) >= 2) { next.interactionQueue = next.interactionQueue.filter(item => item.id !== task.id); next.interactionHandled.push(task.commentId); next.interactionHandled = next.interactionHandled.slice(-160); } else queued.dueAt = now() + 60 * 60000; }); } catch (saveError) { showToast(saveError.message); }
        } finally { interactionBusy = false; }
    }
    function copiesPrivateChat(world, actorId, decision) {
        const publicText = [decision.title,decision.body,decision.name,decision.username,decision.summary,decision.description].filter(Boolean).join(' ').replace(/\s+/g,'');
        if (!publicText) return false;
        return actorKnowledge(world,actorId).filter(({ event }) => event.type === 'private_chat').some(({ event }) => {
            const excerpt = String(event.metadata?.excerpt || '').replace(/\s+/g,'');
            if (excerpt.length < 12) return false;
            for (let offset = 0; offset <= excerpt.length - 12; offset++) if (publicText.includes(excerpt.slice(offset,offset + 12))) return true;
            return false;
        });
    }
    function validateActorDecision(world, actorId, encountered, raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('角色决策格式无效。');
        if (raw.actorId && raw.actorId !== actorId) throw new Error('角色决策身份不匹配。');
        const action = String(raw.action || '').trim();
        if (!['silence','post','reply','delete','profile','community'].includes(action)) throw new Error('角色返回了不支持的行动。');
        const knownIds = new Set(actorKnowledge(world,actorId).map(item => item.event.id));
        const encounteredIds = new Set(encountered.map(post => post.id));
        encountered.forEach(post => { const event = world.events.find(item => item.type === 'forum_post' && item.targetId === post.id); if (event) knownIds.add(event.id); });
        const sourceEventIds = safeList(raw.sourceEventIds).map(String);
        if (sourceEventIds.length > 5 || sourceEventIds.some(id => !knownIds.has(id))) throw new Error('角色引用了自己不知道的事件。');
        const decision = { action, sourceEventIds };
        if (action === 'post') { decision.communityId = String(raw.communityId || ''); decision.title = String(raw.title || '').trim().slice(0,120); decision.body = String(raw.body || '').trim().slice(0,3000); decision.deleteAfterMinutes = Number(raw.deleteAfterMinutes || 0); if (!world.communities.some(item => item.id === decision.communityId && (!item.visibility || item.visibility === 'public')) || !decision.title || !decision.body || (decision.deleteAfterMinutes !== 0 && (!Number.isInteger(decision.deleteAfterMinutes) || decision.deleteAfterMinutes < 1 || decision.deleteAfterMinutes > 120))) throw new Error('角色帖子内容或社区无效。'); }
        if (action === 'reply') { decision.targetPostId = String(raw.targetPostId || ''); decision.body = String(raw.body || '').trim().slice(0,1600); const post = world.posts.find(item => item.id === decision.targetPostId); const knownPost = world.events.some(item => item.type === 'forum_post' && item.targetId === decision.targetPostId && knownIds.has(item.id)); if (!post || post.deletedAt || !isVisible(post,actorId) || (!encounteredIds.has(post.id) && !knownPost) || !decision.body) throw new Error('角色回复的帖子不可见或内容无效。'); }
        if (action === 'delete') { decision.targetPostId = String(raw.targetPostId || ''); if (!world.posts.some(post => post.id === decision.targetPostId && post.authorId === actorId && post.generated && !post.deletedAt)) throw new Error('角色只能删除自己生成的帖子。'); }
        if (action === 'profile') { decision.name = String(raw.name || '').trim().slice(0,40); decision.username = String(raw.username || '').trim().slice(0,32); decision.summary = String(raw.summary || '').trim().slice(0,220); decision.mood = String(raw.mood || '').trim().slice(0,80); if (raw.followerCount != null) decision.followerCount = Number(raw.followerCount); decision.avatarPrompt = String(raw.avatarPrompt || '').trim().slice(0,500); const knownFollowers = Object.values(world.follows).filter(list => safeList(list).includes(actorId)).length; if (!decision.name || !/^@[\p{L}\p{N}_.-]{2,31}$/u.test(decision.username) || !decision.summary || (decision.followerCount != null && (!Number.isSafeInteger(decision.followerCount) || decision.followerCount < knownFollowers || decision.followerCount > 10000000)) || (world.forumSettings.profileMode === 'full' && !decision.avatarPrompt)) throw new Error('角色主页更新无效。'); }
        if (action === 'community') { decision.name = String(raw.name || '').trim().slice(0,40); decision.description = String(raw.description || '').trim().slice(0,180); if (!decision.name || !decision.description || world.communities.some(item => item.name.toLowerCase() === decision.name.toLowerCase())) throw new Error('角色创建的社区无效或重复。'); }
        if (copiesPrivateChat(world,actorId,decision)) throw new Error('角色公开内容复述了私聊原文，已阻止写入。');
        return decision;
    }
    function commitActorDecision(next, actorId, encountered, decision) {
        const timestamp = now();
        encountered.forEach(post => { const event = next.events.find(item => item.type === 'forum_post' && item.targetId === post.id && item.visibility === 'public'); if (event) grantKnowledge(next,actorId,event,event.actorId,'read',1); });
        const record = next.agentStates[actorId] && typeof next.agentStates[actorId] === 'object' ? next.agentStates[actorId] : {};
        record.lastConsideredAt = timestamp;
        record.nextEligibleAt = timestamp + (decision.action === 'silence' ? 45 + Math.floor(Math.random() * 90) : 20 + Math.floor(Math.random() * 70)) * 60000;
        record.actionCounts = { ...(record.actionCounts || {}), [decision.action]:Math.min(999,Number(record.actionCounts?.[decision.action] || 0) + 1) };
        record.communityCounts = { ...(record.communityCounts || {}) };
        const actionEvent = (type,targetId,metadata) => { const event = addEvent(next,type,actorId,targetId,metadata,'public'); grantKnowledge(next,actorId,event,actorId,'authored',1); return event; };
        let communityId = '';
        if (decision.action === 'post') { const post = { id:uid('post'), authorId:actorId, communityId:decision.communityId, title:decision.title, body:decision.body, imageUrl:'', createdAt:timestamp, plannedDeleteAt:decision.deleteAfterMinutes ? timestamp + decision.deleteAfterMinutes * 60000 : 0, likes:0, commentCount:0, bookmarks:0, likedBy:[], bookmarkedBy:[], visibility:'public', generated:true }; next.posts.unshift(post); actionEvent('forum_post',post.id,{ title:post.title, excerpt:post.body.slice(0,180), communityId:post.communityId, sourceEventIds:decision.sourceEventIds, generated:true }); communityId = post.communityId; }
        if (decision.action === 'reply') { const post = next.posts.find(item => item.id === decision.targetPostId); const row = { id:uid('comment'), postId:post.id, parentCommentId:'', authorId:actorId, body:decision.body, createdAt:timestamp, generated:true }; next.comments.push(row); post.commentCount = Number(post.commentCount || 0) + 1; const event = actionEvent('forum_reply',post.id,{ commentId:row.id, excerpt:row.body.slice(0,180), sourceEventIds:decision.sourceEventIds, generated:true }); if (post.authorId !== actorId) { notify(next,post.authorId,'有人回复了你的帖子',`${account(actorId).name}：${row.body.slice(0,70)}`,post.id); grantKnowledge(next,post.authorId,event,actorId,'notification',1); applyRelationshipDelta(next,actorId,post.authorId,{ familiarity:1 },event.id); applyRelationshipDelta(next,post.authorId,actorId,{ familiarity:1, guardedness:1 },event.id); } communityId = post.communityId; }
        if (decision.action === 'delete') tombstonePost(next,next.posts.find(post => post.id === decision.targetPostId),actorId,true);
        if (decision.action === 'profile') { const { action,sourceEventIds,...fields } = decision; const target = next.npcs.find(item => item.id === actorId) || (next.publicProfiles[actorId] ||= {}); Object.assign(target,fields,{ profileGeneratedAt:timestamp }); if (next.accounts[actorId]) Object.assign(next.accounts[actorId],fields); if (fields.avatarPrompt) next.profilePrompts[actorId] = fields.avatarPrompt; actionEvent('forum_profile_change',actorId,{ name:fields.name, username:fields.username, summary:fields.summary, sourceEventIds }); }
        if (decision.action === 'community') { const community = { id:uid('community'), name:decision.name, description:decision.description, icon:'ri-community-line', creatorId:actorId, createdAt:timestamp, generated:true, visibility:'public' }; next.communities.push(community); actionEvent('forum_community_create',community.id,{ name:community.name, sourceEventIds:decision.sourceEventIds, generated:true }); communityId = community.id; }
        if (communityId) record.communityCounts[communityId] = Math.min(999,Number(record.communityCounts[communityId] || 0) + 1);
        if (decision.action !== 'silence') record.lastActedAt = timestamp;
        next.agentStates[actorId] = record;
        next.agentDecisions.push({ id:uid('decision'), actorId, action:decision.action, sourceEventIds:decision.sourceEventIds, encounteredPostIds:encountered.map(post => post.id), createdAt:timestamp });
        next.agentDecisions = next.agentDecisions.slice(-160);
        next.lastSimulatedAt = timestamp;
        next.migration = { ...next.migration, apiGenerated:true };
    }
    async function advanceWorld(options = {}) {
        if (isGenerating) return;
        if (typeof window.callChatApi !== 'function') { showToast('当前版本找不到 AI 调用层。'); return; }
        const world = loadState(); const actor = chooseWorldActor(world,options.actorId || '');
        if (!actor) { showToast('角色暂时都在忙，稍后再推进世界。'); return; }
        const encountered = actorBrowsePosts(world,actor.id);
        const context = actorWorldContext(world,actor.id,encountered);
        isGenerating = true; render(); if (!options.offline) showToast(`${actor.name} 正在经历自己的这一天…`);
        let outcome = '';
        try {
            const actionOptions = { silence:'No public action is natural now.', post:'Publish a new public forum post.', profile:'Update public nickname, handle, mood or bio.', community:'Create a relevant new community.' };
            if (context.encounteredPosts.length) actionOptions.reply = 'Reply to a post this actor has actually encountered.';
            if (world.posts.some(post => post.authorId === actor.id && post.generated && !post.deletedAt)) actionOptions.delete = 'Delete one of this actor’s own generated posts.';
            const jevAction = await window.ByndJev?.choose('forumAction', { actor:context.actor, knownEvents:context.knownEvents.slice(-5), encounteredPosts:context.encounteredPosts.slice(0,5).map(post => ({ id:post.id, title:post.title, body:post.body.slice(0,250) })), ownPosts:context.ownPosts, recentChoices:context.recentChoices, localTime:new Date(now()).toLocaleString('zh-CN') }, 'Choose one plausible public action for this character now. Prefer silence when there is no natural motive; never act as the user.', actionOptions);
            if (jevAction === 'silence') {
                const decision = validateActorDecision(world,actor.id,encountered,{ actorId:actor.id, action:'silence', sourceEventIds:[] });
                mutate(next => { if (next.posts.length !== world.posts.length || next.events.length !== world.events.length || next.knowledge[actor.id]?.length !== world.knowledge[actor.id]?.length) throw new Error('世界在角色思考时已经变化，请重新推进。'); commitActorDecision(next,actor.id,encountered,decision); });
                outcome = `${actor.name} 看了看论坛，今天没有发言。`;
                return;
            }
            const actionGuidance = jevAction ? `Jev 已选择 action=${jevAction}。你只负责补全该行动的有效内容；若该行动与已知事实或角色意愿冲突，可改为 silence，不得换成其他行动。` : '先判断此时的意愿，再只选一个动作。';
            const prompt = `你只扮演 BYND 论坛的一位角色。以下资料是这位角色自己的身份、已知经历与本次实际刷到的帖子，不是全知世界。actor.worldRules 只约束世界设定，不意味着角色知道其中每件事；角色可选择沉默，不要为了产出而编造遭遇，不要替 User 行动，不要泄露私聊原文。${actionGuidance}只返回严格 JSON：{"actorId":"${actor.id}","action":"silence|post|reply|delete|profile|community","sourceEventIds":[],"communityId":"发帖社区ID","targetPostId":"回复或删除的帖子ID","title":"帖子标题","body":"帖子或回复内容","deleteAfterMinutes":0,"name":"社交平台公开昵称","username":"@可更改的公开ID","summary":"签名","mood":"心情","followerCount":0,"avatarPrompt":"头像描述","description":"新社区简介"}。只填写所选动作需要的字段。profile 的 followerCount 是公开粉丝总数，不得小于已知关注者 ${profileMetrics(actor.id).followers} 人，不要编造粉丝身份。sourceEventIds 只能引用 knownEvents 或 encounteredPosts 的 eventId。reply 只能回复已知或本次刷到的帖子；delete 只能删除自己生成的帖子。行为要延续已有情绪与习惯，但记忆不能改写原始事实。若没有自然动机，返回 action=silence。\n${JSON.stringify(context)}`;
            const result = await window.callChatApi([{ role:'system', content:'只输出单个角色的严格 JSON 决策；世界事实以输入为准。' },{ role:'user', content:prompt }],{ background:true, backgroundPriority:-1, stream:false, temperature:.72, max_tokens:1300, usageFeature:'forum' });
            if (!result?.ok) throw new Error(result?.error || '角色行动决策失败。');
            const decision = validateActorDecision(world,actor.id,encountered,parseJsonBatch(result.content));
            if (jevAction && decision.action !== jevAction && decision.action !== 'silence') throw new Error('角色行动与 Jev 决策不一致。');
            mutate(next => { if (next.posts.length !== world.posts.length || next.events.length !== world.events.length || next.knowledge[actor.id]?.length !== world.knowledge[actor.id]?.length) throw new Error('世界在角色思考时已经变化，请重新推进。'); commitActorDecision(next,actor.id,encountered,decision); });
            const avatars = decision.action === 'profile' && loadState().forumSettings.profileMode === 'full' ? await generatePendingAvatars(1,actor.id) : { made:0, error:'' };
            outcome = decision.action === 'silence' ? `${actor.name} 看了看论坛，今天没有发言。` : `${actor.name} 的${{ post:'帖子', reply:'回复', delete:'删帖', profile:'主页更新', community:'新社区' }[decision.action]}已写入世界轨迹。`;
            if (avatars.error) outcome += ` 头像未更新：${avatars.error}`;
        } catch (error) { console.warn('Living World actor step rejected',error); outcome = error?.message || '角色行动失败，世界状态未改变。'; }
        finally { isGenerating = false; processPlannedDeletes(); render(); if (!options.offline) showToast(outcome); }
    }
    function progressWorld(options = {}) { const world = loadState(); return !world.migration?.apiGenerated || !world.communities.length || !agentActors(world).length ? generate({ ...options, bootstrap:!world.communities.length }) : advanceWorld(options); }
    async function generate(options = {}) {
        if (isGenerating) return; if (typeof window.callChatApi !== 'function') { showToast('当前版本找不到 AI 调用层。'); return; }
        isGenerating = true; render(); showToast('世界正在整理新的痕迹…');
        const context = getGenerationContext(); const bootstrap = options.bootstrap === true || !context.communities.length; const prompt = `你是 BYND Living World 的批量演绎器。论坛是当前世界真实存在的公共空间，User、Char、NPC 都有自己的生活。程序保存的身份、关系、时间和事件是 Canon，不得修改。公开帖子只是某人说过的话，不代表内容真实；角色只能依据自己已知的事实行动，不能把本提示中的全局线索当作人人已知。knownPublicEventIds 是各角色已知的公开事件；没有来源的角色不要暗示知道私聊、匿名身份、他人的搜索或系统后台。不要代替 User 发帖、回复、传播知识或改变关系。允许任何角色保持沉默或潜水；不要为了填满数组强行制造互动。普通生活和兴趣内容应占多数，禁止所有 NPC 同一种语气、所有帖子都围绕 User 或无故制造冲突。模型只创作公开言论；新事实、关系、知识变化只能走下列结构化字段并由程序验证。所有内容、社区和 NPC 必须由你生成，不能使用示例或占位角色。只输出严格 JSON，不要 Markdown：{"newCommunities":[{"id":"英文唯一id","name":"","description":"","icon":"ri-community-line"}],"newNPCs":[{"id":"英文唯一id","name":"","username":"","summary":"","style":"说话风格","occupation":"职业身份","interests":["communityId"],"avatar":"可空"}],"newPosts":[{"authorId":"非User的现有或本批NPC ID","communityId":"现有或本批社区ID","title":"","body":"","imageUrl":"可空"}],"newComments":[{"authorId":"非User的现有角色ID","postId":"既有公开帖子ID","body":""}],"relationshipChanges":[{"fromId":"","toId":"","deltas":{"trust":1},"reasonEventId":"当事人已知且相关的公开事件ID"}],"knowledgeTransfers":[{"sourceId":"","recipientId":"","eventId":"来源者已知的公开事件ID","confidence":0.7}]}。没有合理来源就让关系变化和知识传播为空数组。${bootstrap ? '这是世界第一次启动：生成 4-6 个社区、6-10 个彼此风格不同的普通 NPC，以及 5-8 条主要与 User 无关的帖子。' : `世界经过约 ${Math.max(1, Math.floor(Number(options.elapsed || DAY) / DAY))} 天；只生成 3-6 条新帖和少量有来源的回复。` }\n\n本次可用的局部公开状态（不是任何角色的全知视角）：\n${JSON.stringify(context)}`;
        let outcome = '';
        try {
        const enrichedPrompt = `${prompt}\n\n补充强制规则：worldSeeds 是现有 Char 的角色卡及世界书，只可用来构造与其世界合理相关的 NPC，不得视为每个人都知道的事实。每个 newNPC 必须增加 originCharId，值为 worldSeeds 中真实 charId；没有 worldSeeds 时 newNPCs 留空。若现有社区不适合角色主题，可由角色自然创建 newCommunities 并在同批 newPosts 引用，不要创建空泛重复社区。不得自行填 avatar 图片 URL；头像只走应用的生图 API。newNPC 可提供 avatarPrompt。额外可输出 profileUpdates:[{id,name,username:"@可变社交ID",summary,mood,followerCount,avatarPrompt}]，为现有非 User 角色或本批 NPC 生成会随心情变化的公开主页；followerCount 是公开粉丝总数，不得低于已知真实关注人数，不要凭空创建粉丝身份；mood 是当前状态，不必对用户公开；社交昵称、@ID 和签名要自然，不要照抄角色卡私密信息。可输出 deletePosts:[{postId,authorId}]，仅作者删除自己既有的 AI 帖；保留墓碑。newPosts 可选 deleteAfterMinutes（1-120），表示作者稍后反悔删帖；也可选 amaDurationHours（1、2、4、8、12、24）与 amaStartsInMinutes（0-43200），让非 User 角色合理举办限时问答，过期后不再公开。可输出 socialLinks:[{fromId,toId,kind:"met|heard",sourceEventId,viaId}]；必须有 fromId 已知的既有事件为依据，heard 要有传话者 viaId，不要制造双向全知关系。realNews 是外部真实标题与来源，不得改写为未经核实的事实；可输出 newNewsComments:[{authorId,newsId,body}]，让非 User 角色在 BYND 内讨论这些资讯，但不冒充外部平台发言。若 promotionsEnabled 为 true，可输出 newPromotions:[{sponsor,headline,body,detail,cta,targetCommunityIds:["社区ID"],privateFor:"user或空"}]，从角色世界书与 viewerSignals 出发写世界内的推广；明确是推广，不写真实广告商或外部跳转；privateFor=user 仅用户可见，禁止把私人搜索内容直接复述为确定的现实事实。promotionsEnabled 为 false 则此数组必须为空。除有据可依的内容外，上述数组留空。`;
            const result = await window.callChatApi([{ role: 'system', content: '返回一段可以安全写入本地世界状态的 JSON。' }, { role: 'user', content: enrichedPrompt }], { background: true, backgroundPriority: -1, stream: false, temperature: .86, max_tokens: 6200, usageFeature: 'world' });
            if (!result?.ok) throw new Error(result?.error || 'AI 世界演绎失败。'); const valid = validateBatch(parseJsonBatch(result.content));
            mutate(next => {
                next.communities.push(...valid.communities); next.npcs.push(...valid.newNpcs);
                const span = options.offline ? Math.min(7 * DAY, Math.max(0, Number(options.elapsed || 0))) : 0;
                valid.posts.forEach(item => {
                    const createdAt = now() - (span ? Math.floor(Math.random() * span) : 0);
                    const amaStartsAt = item.amaDurationHours ? createdAt + item.amaStartsInMinutes * 60000 : 0;
                    const post = { id: uid('post'), ...item, createdAt, ama: !!item.amaDurationHours, amaStartsAt, expiresAt: amaStartsAt ? amaStartsAt + item.amaDurationHours * 3600000 : 0, plannedDeleteAt: item.deleteAfterMinutes ? createdAt + item.deleteAfterMinutes * 60000 : 0, likes: 0, commentCount: 0, bookmarks: 0, likedBy: [], bookmarkedBy: [], visibility: 'public', generated: true };
                    next.posts.unshift(post);
                    const event = addEvent(next, 'forum_post', post.authorId, post.id, { generated: true, communityId: post.communityId, title: post.title, excerpt: post.body.slice(0, 180) }, 'public'); event.createdAt = createdAt;
                    grantKnowledge(next, post.authorId, event, post.authorId, 'authored', 1);
                });
                valid.comments.forEach(item => {
                    const post = next.posts.find(row => row.id === item.postId);
                    const createdAt = Math.max(Number(post.createdAt || 0) + 1, now() - (span ? Math.floor(Math.random() * span) : 0));
                    const row = { id: uid('comment'), ...item, createdAt, generated: true };
                    next.comments.push(row); post.commentCount = Number(post.commentCount || 0) + 1;
                    const sourcePost = next.events.find(event => event.type === 'forum_post' && event.targetId === post.id && event.visibility === 'public');
                    if (sourcePost) grantKnowledge(next, row.authorId, sourcePost, post.authorId, 'read', 1);
                    const event = addEvent(next, 'forum_reply', row.authorId, post.id, { generated: true, commentId: row.id, excerpt: row.body.slice(0, 180) }, 'public'); event.createdAt = createdAt;
                    grantKnowledge(next, row.authorId, event, row.authorId, 'authored', 1);
                    if (post.authorId !== row.authorId) { const authorName = next.npcs.find(npc => npc.id === row.authorId)?.name || account(row.authorId).name; notify(next, post.authorId, '有人回复了你的帖子', `${authorName}：${row.body.slice(0, 70)}`, post.id); grantKnowledge(next, post.authorId, event, row.authorId, 'notification', 1); applyRelationshipDelta(next, row.authorId, post.authorId, { familiarity: 1 }, event.id); applyRelationshipDelta(next, post.authorId, row.authorId, { familiarity: 1, guardedness: 1 }, event.id); }
                });
                valid.newsComments.forEach(item => { const row = { id:uid('newscomment'), ...item, createdAt:now(), generated:true }; next.newsComments.push(row); const news = next.newsItems.find(entry => entry.id === item.newsId); const event = addEvent(next,'forum_news_reply',item.authorId,item.newsId,{ generated:true, commentId:row.id, title:news?.title || '', source:news?.source || '', excerpt:row.body.slice(0,140) },'public'); grantKnowledge(next,item.authorId,event,item.authorId,'authored',1); });
                valid.promotions.forEach(item => next.promotions.push({ id:uid('promotion'), ...item, createdAt:now(), generated:true }));
                next.promotions = next.promotions.slice(-40);
                valid.relationships.forEach(item => applyRelationshipDelta(next, item.fromId, item.toId, item.deltas, item.reasonEventId));
                valid.transfers.forEach(item => { const event = next.events.find(row => row.id === item.eventId); if (event) grantKnowledge(next, item.recipientId, event, item.sourceId, 'reported', item.confidence); });
                valid.profiles.forEach(item => { const { avatarPrompt, id, ...publicFields } = item; const npc = next.npcs.find(row => row.id === id); if (npc) Object.assign(npc, publicFields, { profileGeneratedAt: now() }); else next.publicProfiles[id] = { ...next.publicProfiles[id], ...publicFields, profileGeneratedAt: now() }; if (next.accounts[id]) Object.assign(next.accounts[id],publicFields); next.profilePrompts[id] = avatarPrompt; const event = addEvent(next, 'forum_profile_change', id, id, { name: item.name, username: item.username, summary: item.summary }, 'public'); grantKnowledge(next, id, event, id, 'authored', 1); });
                valid.newNpcs.forEach(item => { if (item.avatarPrompt) next.profilePrompts[item.id] = item.avatarPrompt; });
                valid.deletions.forEach(item => tombstonePost(next, next.posts.find(post => post.id === item.postId), item.authorId, true));
                valid.links.forEach(item => { const existing = next.socialLinks.find(link => link.fromId === item.fromId && link.toId === item.toId); const source = next.events.find(event => event.id === item.sourceEventId); const link = { ...item, sourceLabel: source?.type === 'forum_post' ? '曾看到公开发帖' : source?.type === 'forum_reply' ? '曾看到互动回复' : '已知事件', updatedAt: now() }; if (existing) Object.assign(existing, link); else next.socialLinks.push(link); });
                next.lastSimulatedAt = now(); next.migration = { ...next.migration, apiGenerated: true };
            });
            const avatars = loadState().forumSettings.profileMode === 'full' ? await generatePendingAvatars(2) : { made: 0, error: '' };
            outcome = `世界新增 ${valid.communities.length} 个社区、${valid.newNpcs.length} 位参与者和 ${valid.posts.length} 条帖子；更新 ${valid.profiles.length} 份资料、${valid.newsComments.length} 条资讯讨论和 ${valid.promotions.length} 条推广。${avatars.made ? `生成 ${avatars.made} 张头像。` : ''}${avatars.error ? `生图未完成：${avatars.error}` : ''}`;
        } catch (error) { console.warn('Living World AI batch rejected', error); outcome = error?.message || '生成失败，世界状态未改动。'; }
        finally { isGenerating = false; processPlannedDeletes(); render(); showToast(outcome); }
    }
    function processPlannedDeletes() { const due = loadState().posts.filter(post => post.plannedDeleteAt && !post.deletedAt && post.plannedDeleteAt <= now()); if (!due.length) return; try { mutate(next => { next.posts.filter(post => post.plannedDeleteAt && !post.deletedAt && post.plannedDeleteAt <= now()).forEach(post => tombstonePost(next,post,post.authorId,true,post.plannedDeleteAt)); }); render(); } catch (error) { showToast(error.message); } }
    function maybeLazySimulate() { if (now() - lastScheduleCheck < 30000) return; lastScheduleCheck = now(); const world = loadState(); if (!world.migration?.apiGenerated || isGenerating) return; const settings = world.forumSettings; const elapsed = now() - Number(world.lastSimulatedAt || now()); const lastAttempt = Number(settings.lastAttemptAt || 0); let due = false; if (settings.refreshMode === 'interval') due = now() - Math.max(Number(world.lastSimulatedAt || 0),lastAttempt) >= Number(settings.intervalHours || 12) * 3600000; if (settings.refreshMode === 'smart') { if (!settings.nextSmartAt) { try { mutate(next => { next.forumSettings.nextSmartAt = nextSmartTime(now()); }); } catch (error) { showToast(error.message); } return; } due = now() >= Number(settings.nextSmartAt) && now() - lastAttempt >= 30 * 60000; } if (!due) return; try { mutate(next => { next.forumSettings.lastAttemptAt = now(); if (settings.refreshMode === 'smart') next.forumSettings.nextSmartAt = nextSmartTime(now()); }); void advanceWorld({ offline: true, elapsed }); } catch (error) { showToast(error.message); } }
    async function init() { if (window._wechatCharactersLoadPromise) { try { await window._wechatCharactersLoadPromise; } catch (_) {} } let saveError = null; try { syncAccounts(); queueRecentInteractions(); } catch (error) { saveError = error; } activeTab = activeTab || 'home'; render(); if (saveError) showToast(saveError.message); else { processPlannedDeletes(); maybeLazySimulate(); void maybeRunInteraction(); } }
    if (typeof window.setInterval === 'function') window.setInterval(() => { if (document.hidden) return; void maybeRunInteraction(); const forum = document.getElementById('app-living-world-window'); if (!forum || forum.classList.contains('hidden')) return; processPlannedDeletes(); maybeLazySimulate(); const current = now(); const boundary = loadState().posts.some(post => post.ama && ((Number(post.amaStartsAt) > lastAmaCheckAt && Number(post.amaStartsAt) <= current) || (Number(post.expiresAt) > lastAmaCheckAt && Number(post.expiresAt) <= current))); lastAmaCheckAt = current; if (boundary) { if (activeTab === 'detail' && !isVisible(loadState().posts.find(post => post.id === activePostId),viewer().id)) { activeTab = 'home'; activePostId = ''; replyComposerOpen = false; } render(); } }, 30000);

    function getRelevantEventsForChar(char, limit = 4) {
        const charId = char?.id ? (loadState().npcs.find(item => item.contactCharId === char.id)?.id || `char:${char.id}`) : String(char || ''); if (!charId) return '';
        const world = loadState(); const knownIds = new Set(safeList(world.knowledge[charId]).map(row => row?.eventId));
        const rows = world.events.filter(event => knownIds.has(event.id)).filter(event => ['forum_post', 'forum_reply', 'forum_news_reply', 'forum_like', 'forum_access_detected', 'forum_follow', 'forum_delete'].includes(event.type)).slice(-Math.max(1, Math.min(8, limit)));
        const ownRecentPosts = world.posts.filter(post => post.authorId === charId && post.generated === true && !post.deletedAt && Number(post.createdAt) > now() - 7 * DAY).slice(0,2);
        if (!rows.length && !ownRecentPosts.length) return '';
        const describe = event => {
            if (event.type === 'forum_access_detected') return '察觉自己的论坛账号有异常痕迹，但还不能确定是谁操作的；可以暂时不说。';
            const post = world.posts.find(item => item.id === event.targetId);
            const savedTitle = post?.title || event.metadata?.title;
            const title = savedTitle ? `《${String(savedTitle).slice(0, 60)}》` : '一条后来可能已删除的帖子';
            if (event.type === 'forum_post') return `${account(event.actorId).name}发布了${title}。这是公开发言，不代表其内容已被证实。`;
            if (event.type === 'forum_reply') {
                const comment = world.comments.find(item => item.id === event.metadata?.commentId);
                const excerpt = comment?.body || event.metadata?.excerpt;
                return `${account(event.actorId).name}回复了${title}${excerpt ? `：「${String(excerpt).slice(0, 90)}」` : ''}。回复是公开说法，不自动等于事实。`;
            }
            if (event.type === 'forum_news_reply') { const news = world.newsItems.find(item => item.id === event.targetId); const comment = world.newsComments.find(item => item.id === event.metadata?.commentId); return `${account(event.actorId).name}在真实资讯${news ? `《${news.title.slice(0,60)}》` : ''}下发表了看法${comment ? `：「${comment.body.slice(0,90)}」` : ''}。资讯来自外部，观点不等于事实。`; }
            if (event.type === 'forum_like') return `${account(event.actorId).name}赞同了${title}。`;
            if (event.type === 'forum_follow') return `${account(event.actorId).name}关注了你的论坛账号。`;
            return `${title}已被删除；此前看到的人不会因此失去记忆。`;
        };
        const ownPostsAnchor = ownRecentPosts.map(post => `- 你最近在论坛发布《${String(post.title).slice(0,60)}》：${String(post.body || '').slice(0,220)}`).join('\n');
        return `【Living World 近期可知事实】\n${rows.map(event => `- ${new Date(event.createdAt).toLocaleDateString('zh-CN')}：${describe(event)}`).join('\n')}${ownPostsAnchor ? `\n【你自己最近发布的帖子】\n${ownPostsAnchor}` : ''}\n如果用户在私聊中主动提起与你帖子相符的细节，可以自然联想到对方或许刷到了帖子，但这只是猜测，不要断言对方确实看过，也不要无端主动追问。只可依据这些事实及你自己的真实聊天历史行动。公开发言可能是误解或谎言；不知道的事不要断言。可以知道但不提起；不要提及系统、后台或视角切换。`;
    }

    function getMemoryCandidatesForChar(char, since = 0) {
        const charId = char?.id ? (loadState().npcs.find(item => item.contactCharId === char.id)?.id || `char:${char.id}`) : '';
        if (!charId) return '';
        const world = loadState();
        const knownIds = new Set(safeList(world.knowledge[charId]).map(row => row?.eventId));
        const important = world.events.filter(event => event.createdAt > Number(since || 0) && knownIds.has(event.id) && (
            event.type === 'forum_access_detected' ||
            (event.type === 'forum_reply' && event.actorId === 'user' && world.posts.some(post => post.id === event.targetId && post.authorId === charId)) ||
            (event.type === 'forum_post' && event.actorId === charId && world.comments.some(comment => comment.postId === event.targetId && comment.authorId === 'user'))
        )).slice(-3);
        if (!important.length) return '';
        return important.map(event => {
            const title = world.posts.find(post => post.id === event.targetId)?.title;
            return `- ${event.id}（${new Date(event.createdAt).toLocaleDateString('zh-CN')}）：${event.type === 'forum_access_detected' ? '角色察觉自己的论坛账号有异常痕迹，尚不清楚操作者。' : event.type === 'forum_reply' ? `用户回复了角色的帖子${title ? `《${String(title).slice(0, 50)}》` : ''}。` : `用户参与了角色的帖子${title ? `《${String(title).slice(0, 50)}》` : ''}。`}这是记忆候选，不代表必须保存。`;
        }).join('\n');
    }

    window.LivingWorld = { init, render, setTab, setCommunity, openCommunity, openPost, openPostLink, openProfile, refreshProfile, back, toggleMenu, menuGo, returnToDesktop, saveForumSettings, setPromotionEnabled, updatePromotionGap, restoreHiddenPost, getVisibleSocialLinks: visibleSocialLinks, togglePerspective, toggleSearch, submitSearch, searchFor, clearSearch, toggleCommentSearch, submitCommentSearch, clearCommentSearch, openReplyComposer, closeReplyComposer, updateReplyDraft, setReplyMedia, clearReplyMedia, pickReplyImage, togglePostActions, copyPostLink, copyPostText, comicCurrentPost, shareCurrentPost, saveCurrentPost, followCurrentPost, hideCurrentPost, blockPostAuthor, reportCurrentPost, awardCurrentPost, crosspostCurrentPost, postLanguageInfo, translateCurrentPost, translateNews, openChat, setActivityTab, setProfileTab, editProfile, pickProfileAvatar, saveProfile, setViewer, createPost, reply, replyToComment, clearReplyTarget, toggleCommentSort, voteComment, vote, votePoll, toggleLike, toggleBookmark, toggleBlock, togglePostMenu, sharePost, shareNews, closeShare, shareToForumDm, shareToCharacterChat, deletePost, toggleFollow, toggleCommunityPicker, selectComposeCommunity, showComposeCommunityForm, updateCompose, toggleLinkInput, togglePoll, addPollOption, toggleAma, openAmaPicker, closeAmaPicker, selectAmaOption, updateAmaStart, removeDraftImage, pickImage, startMessage, filterRecipients, openThread, sendMessage, retryDirectReply, markAllRead, toggleCommunityForm, createCommunity, toggleSubscribe, promoteNpc, openNotice, fetchRealNews, openNews, commentNews, updateNewsDraft, openPromotion, generate, advanceWorld, maybeRunInteraction, progressWorld, getRelevantEventsForChar, recordPrivateChatMessage, storageKey: STORAGE_KEY };
    window.initLivingWorld = init;
    window.LivingWorld.getRelationshipGraph = relationshipGraphData;
    window.LivingWorld.openRelation = openRelation;
    window.LivingWorld.retryRelationImpression = retryRelationImpression;
    window.LivingWorld.closeRelation = closeRelation;
    window.getLivingWorldRelevantEventsForChar = getRelevantEventsForChar;
    window.LivingWorld.getPostPreview = getPostPreview;
    window.getLivingWorldMemoryCandidatesForChar = getMemoryCandidatesForChar;
}());
