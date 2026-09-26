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
        const keys = knownPrivateChatKeys();
        if (keys.has(sourceKey)) return false;
        mutate(next => {
            if (!next.accounts[charId]) next.accounts[charId] = accountFromChar(char);
            const event = addEvent(next, 'private_chat', actorId, recipientId, { sourceKey, excerpt, privateTo: [charId, 'user'] }, 'private');
            grantKnowledge(next, actorId, event, actorId, 'direct', 1);
            grantKnowledge(next, recipientId, event, actorId, 'direct', 1);
        });
        keys.add(sourceKey); privateChatKeysState = state;
        return true;
    }
    // Chat mirroring runs per message; a cached key set keeps dedupe from rescanning every event each time.
    let privateChatKeys = new Set(); let privateChatKeysState = null;
    function knownPrivateChatKeys() {
        const world = loadState();
        if (privateChatKeysState !== world) { privateChatKeys = new Set(world.events.filter(item => item.type === 'private_chat').map(item => item.metadata?.sourceKey)); privateChatKeysState = world; }
        return privateChatKeys;
    }
    function clearPrivateChatEvents(char) {
        if (!char?.id) return false;
        const world = loadState();
        const ids = new Set([`char:${char.id}`, ...world.npcs.filter(item => item.contactCharId === char.id).map(item => item.id)]);
        const removed = new Set(world.events.filter(item => item.type === 'private_chat' && safeList(item.metadata?.privateTo).some(id => ids.has(id))).map(item => item.id));
        if (!removed.size) return false;
        // normalizeState drops the knowledge rows that pointed at the removed events.
        mutate(next => { next.events = next.events.filter(item => !removed.has(item.id)); });
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

