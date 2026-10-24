    // ── 小世界心跳 (1.1.1011) ───────────────────────────────────────────────
    // 论坛不只在你点开时才“动”：每个 NPC 有自己的作息，按自己的时间刷帖、点赞、关注别人；
    // 离开几个小时再回来，这段时间里发生过的事会被补上（有上限）。这一层完全在本地运行，不调用 API。
    // char 发出的帖子，过一阵会像朋友一样私信你分享（需要你自己的 API，且有冷却与每日上限）。
    // 小世界心跳：谁在做什么、刷不刷论坛、点不点赞、关不关注，全部交给 Jev 判断（Jev 未配置或不确定时，由该角色自己的 agent 通过你的 API 判断）。
    // 两者都不可用时什么也不演——不用写死的作息表或随机数造一个假的热闹。
    const PULSE_STEP = 40 * 60000, PULSE_MAX_ROUNDS = 3, PULSE_ACTORS_PER_ROUND = 2, LIFE_FRESH = 8 * 3600000;
    const SHARE_COOLDOWN = 10 * 3600000, SHARE_DAILY_LIMIT = 2, SHARE_MIN_AGE = 25 * 60000, SHARE_MAX_AGE = 36 * 3600000;
    let sharingBusy = false, lastShareCheck = 0, pulseBusy = false;
    const LIFE_LABELS = { sleeping:'睡着了', working:'忙着正事', commuting:'在路上', eating:'在吃饭', free:'有空闲', browsing:'在刷论坛' };

    function lifeChip(id) {
        const world = loadState(); if (!id || id === 'user' || world.forumSettings.worldPulse === 'off') return '';
        const life = world.agentStates[id]?.life; if (!life?.label || now() - Number(life.at || 0) > LIFE_FRESH) return '';
        return `<p class="lw-life ${life.key === 'sleeping' ? 'asleep' : 'awake'}"><i></i>${escapeHtml(String(life.label).slice(0, 24))}</p>`;
    }
    function actorProfile(world, actor) {
        const char = safeList(window.myCharacters).find(item => item.id === actor.charId || item.id === actor.originCharId || `char:${item.id}` === actor.id);
        return { name:actor.name || '', summary:String(actor.summary || '').slice(0, 160), mood:actor.mood || '', style:actor.style || '', occupation:actor.occupation || '', interests:safeList(actor.interests).slice(0, 6), persona:char ? String(char.description || char.personality || '').slice(0, 300) : '' };
    }
    function pulsePickPost(next, actor, at) {
        const habits = next.agentStates[actor.id]?.communityCounts || {}, following = new Set(safeList(next.follows[actor.id]));
        const rows = next.posts.filter(post => post.authorId !== actor.id && !post.deletedAt && post.visibility !== 'private' && Number(post.createdAt) <= at && at - Number(post.createdAt) < 3 * DAY && (!post.amaStartsAt || post.amaStartsAt <= at) && !(post.votes && post.votes[actor.id]) && isVisible(post, actor.id));
        if (!rows.length) return null;
        return rows.map(post => ({ post, score:(safeList(actor.interests).includes(post.communityId) ? 4 : 0) + Math.min(3, Number(habits[post.communityId] || 0)) + (following.has(post.authorId) ? 4 : 0) + Math.max(0, 3 - (at - Number(post.createdAt)) / DAY) })).sort((a, b) => b.score - a.score)[0].post;
    }
    // 这一步轮到谁只是排班（最久没动的、到点的先来）；做什么由 Jev / agent 决定。
    function pulseSchedule(world, at) {
        const people = [...world.npcs, ...Object.values(world.accounts).filter(item => item?.id && item.id !== 'user' && item.type !== 'user')];
        return [...new Map(people.filter(item => item?.id).map(item => [item.id, item])).values()]
            .filter(item => Number(world.agentStates[item.id]?.nextEligibleAt || 0) <= at)
            .sort((a, b) => Number(world.agentStates[a.id]?.lastPulseAt || 0) - Number(world.agentStates[b.id]?.lastPulseAt || 0)).slice(0, PULSE_ACTORS_PER_ROUND);
    }
    async function decidePulse(world, actor, post, at) {
        const author = account(post.authorId), relation = relationshipScore(actor.id, post.authorId);
        const state = { actor:actorProfile(world, actor), localTime:new Date(at).toLocaleString('zh-CN'), post:{ title:String(post.title || '').slice(0, 80), body:String(post.body || '').slice(0, 220), community:community(post.communityId).name, author:author.name || '' }, alreadyFollowsAuthor:safeList(world.follows[actor.id]).includes(post.authorId), relationToAuthor:relation };
        const criteria = { sleeping:'The character is asleep or about to sleep and cannot browse.', working:'The character is busy with work, study or chores and cannot browse.', commuting:'The character is out and about, could glance at a phone briefly.', eating:'The character is eating or taking a break.', free:'The character has free time and may browse the forum.', browsing:'The character is already scrolling the forum.' };
        const instructions = { doing:'Given who this character is and the local time, what are they most plausibly doing right now? Stay in character; do not default to browsing.', like:'If the character is able to see this post, would they naturally react with a like?', follow:'Would this character naturally follow the post author because of this post?' };
        const jev = window.ByndJev;
        if (jev?.available?.('forumAction')) {
            const answers = await jev.ask('forumAction', state, { doing:{ type:'choice', instructions:instructions.doing, criteria }, like:{ type:'noul', instructions:instructions.like }, follow:{ type:'noul', instructions:instructions.follow } }, { charName:actor.name, labels:{ doing:'论坛心跳：此刻在做什么', like:'论坛心跳：是否点赞', follow:'论坛心跳：是否关注' } });
            if (answers?.doing?.confident) { const key = answers.doing.value; const can = ['free', 'browsing', 'commuting', 'eating'].includes(key); return { key, label:LIFE_LABELS[key] || '', browse:can, like:can && answers.like?.value === true, follow:can && answers.follow?.value === true, source:'jev' }; }
        }
        if (typeof window.callChatApi !== 'function') return null;
        const result = await window.callChatApi([{ role:'system', content:'你只扮演论坛里的一个人，按他/她的身份、性格和此刻的时间，判断此刻在做什么，以及是否会刷到并回应这条帖子。只返回严格 JSON。' }, { role:'user', content:`${JSON.stringify(state)}\n返回：{"doing":"不超过 12 个字，此刻在做什么（如“在地铁上”“夜班理货中”）","browsing":true|false,"like":true|false,"follow":true|false}。不方便看手机、已睡着、与这条帖子无关时 browsing/like/follow 为 false；不要为了热闹而点赞或关注。` }], { background:true, backgroundPriority:-1, stream:false, temperature:.7, max_tokens:160, usageFeature:'forum' });
        if (!result?.ok) return null;
        try { const row = parseJsonBatch(result.content), browse = row.browsing === true; const label = String(row.doing || '').trim().slice(0, 24); if (!label) return null; return { key:browse ? 'browsing' : 'working', label, browse, like:browse && row.like === true, follow:browse && row.follow === true, source:'agent' }; } catch (_) { return null; }
    }
    function applyPulse(next, actor, post, decision, at) {
        const record = next.agentStates[actor.id] && typeof next.agentStates[actor.id] === 'object' ? next.agentStates[actor.id] : {};
        record.life = { key:decision.key, label:decision.label, at }; record.lastPulseAt = at; record.nextEligibleAt = at + (30 + Math.floor(Math.random() * 60)) * 60000;
        if (decision.browse) { record.lastBrowseAt = at; record.communityCounts = { ...(record.communityCounts || {}), [post.communityId]:Math.min(999, Number(record.communityCounts?.[post.communityId] || 0) + 1) }; }
        next.agentStates[actor.id] = record;
        if (!decision.browse) return;
        if (decision.like) {
            const target = next.posts.find(item => item.id === post.id); if (!target || target.deletedAt) return;
            target.votes = target.votes && typeof target.votes === 'object' ? target.votes : {}; target.votes[actor.id] = 1;
            const event = addEvent(next, 'forum_like', actor.id, post.id, { generated:true, pulse:decision.source }, 'public'); event.createdAt = at;
            grantKnowledge(next, actor.id, event, actor.id, 'authored', 1);
            if (post.authorId !== actor.id) {
                grantKnowledge(next, post.authorId, event, actor.id, 'notification', 1);
                applyRelationshipDelta(next, actor.id, post.authorId, { familiarity:1 }, event.id);
                if (post.authorId === 'user' || next.accounts[post.authorId]) notify(next, post.authorId, '有人赞同了你的帖子', `${actor.name || account(actor.id).name} 赞同了帖子`, post.id);
            }
        }
        const following = safeList(next.follows[actor.id]);
        if (decision.follow && post.authorId !== actor.id && post.authorId !== 'user' && !following.includes(post.authorId)) {
            next.follows[actor.id] = [...following, post.authorId];
            const event = addEvent(next, 'forum_follow', actor.id, post.authorId, { generated:true, pulse:decision.source }, 'public'); event.createdAt = at;
            grantKnowledge(next, actor.id, event, actor.id, 'authored', 1); grantKnowledge(next, post.authorId, event, actor.id, 'notification', 1);
            applyRelationshipDelta(next, actor.id, post.authorId, { familiarity:2, trust:1 }, event.id);
        }
    }
    async function runPulse() {
        if (pulseBusy || isGenerating) return 0;
        const world = loadState(); if (world.forumSettings.worldPulse === 'off' || !world.posts.length) return 0;
        const jev = window.ByndJev?.available?.('forumAction'); if (!jev && typeof window.callChatApi !== 'function') return 0;
        const state = world.worldPulse && typeof world.worldPulse === 'object' ? world.worldPulse : {}, current = now();
        if (!Number(state.lastAt)) { try { mutate(next => { next.worldPulse = { lastAt:current }; }); } catch (_) {} return 0; }
        const elapsed = current - Number(state.lastAt), rounds = Math.min(PULSE_MAX_ROUNDS, Math.floor(elapsed / PULSE_STEP));
        if (rounds < 1) return 0;
        pulseBusy = true; let acted = 0;
        try {
            try { mutate(next => { next.worldPulse = { lastAt:current }; }); } catch (_) { return 0; }
            for (let index = 1; index <= rounds; index++) {
                const at = current - Math.round((rounds - index) * Math.min(elapsed, 3 * DAY) / rounds);
                for (const actor of pulseSchedule(loadState(), Math.min(at, current))) {
                    const post = pulsePickPost(loadState(), actor, Math.min(at, current)); if (!post) continue;
                    const decision = await decidePulse(loadState(), actor, post, Math.min(at, current)); if (!decision) continue;
                    try { mutate(next => applyPulse(next, actor, post, decision, Math.min(at, current))); acted++; } catch (error) { console.warn('小世界心跳未保存', error); }
                }
            }
        } finally { pulseBusy = false; }
        if (acted) { const forum = document.getElementById('app-living-world-window'); if (forum && !forum.classList.contains('hidden') && activeTab !== 'create' && !replyComposerOpen) render(); }
        return acted;
    }

    // ── char 主动分享 ───────────────────────────────────────────────────────
    function shareCandidate(world) {
        const current = now(), day = current - DAY;
        const chars = Object.values(world.accounts).filter(item => item?.type === 'char' && item.id);
        for (const actor of chars.sort(() => Math.random() - .5)) {
            const record = world.agentStates[actor.id] || {};
            if (current - Number(record.lastShareAt || 0) < SHARE_COOLDOWN || current - Number(record.lastShareAttemptAt || 0) < 3600000) continue;
            if (safeList(record.shareLog).filter(at => Number(at) > day).length >= SHARE_DAILY_LIMIT) continue;
            const post = world.posts.find(item => item.authorId === actor.id && !item.deletedAt && item.generated && !item.sharedToUser && item.visibility !== 'private' && current - Number(item.createdAt) >= SHARE_MIN_AGE && current - Number(item.createdAt) <= SHARE_MAX_AGE && !world.comments.some(row => row.postId === item.id && row.authorId === 'user') && !(item.votes && item.votes.user));
            if (post) return { actor, post };
        }
        return null;
    }
    async function maybeShareToUser() {
        if (sharingBusy || isGenerating || document.hidden || typeof window.callChatApi !== 'function') return;
        if (now() - lastShareCheck < 60000) return; lastShareCheck = now();
        const world = loadState(); if (world.forumSettings.worldShare === 'off' || world.viewerId !== 'user') return;
        const picked = shareCandidate(world); if (!picked) return;
        const { actor, post } = picked; sharingBusy = true;
        const hold = window.ByndJev?.available?.('forumAction') ? await window.ByndJev.choose('forumAction', { actor:actorProfile(world, actor), localTime:new Date().toLocaleString('zh-CN'), ownPost:{ title:String(post.title || '').slice(0, 80), body:String(post.body || '').slice(0, 200) }, minutesSincePosted:Math.round((now() - Number(post.createdAt)) / 60000) }, 'Would this character naturally message the user to share their own forum post right now? Prefer hold when it would feel pushy, out of character, or the timing is wrong.', { share:'The character sends the user a short private message sharing the post.', hold:'The character does not message the user about it now.' }) : '';
        if (hold === 'hold') { try { mutate(next => { next.agentStates[actor.id] ||= {}; next.agentStates[actor.id].lastShareAttemptAt = now(); }); } catch (_) {} sharingBusy = false; return; }
        try { mutate(next => { next.agentStates[actor.id] ||= {}; next.agentStates[actor.id].lastShareAttemptAt = now(); }); } catch (_) { sharingBusy = false; return; }
        try {
            const char = safeList(window.myCharacters).find(item => item.id === actor.charId || `char:${item.id}` === actor.id);
            const persona = String(char?.description || char?.personality || actor.summary || '').slice(0, 1500);
            const known = typeof getRelevantEventsForChar === 'function' ? getRelevantEventsForChar(char || actor.id, 3) : '';
            const result = await window.callChatApi([{ role:'system', content:`你是「${actor.name}」。你刚在论坛发了一条帖子，想顺手发条私信把它分享给对方（User）。只输出你发给对方的那一两句自然的话，口吻符合人设，不要 JSON、旁白、系统说明，不要复述整篇帖子，不要替对方说话，也不要写链接（链接会自动附上）。\n人设：${persona}\n${known}` }, { role:'user', content:`现在是 ${new Date().toLocaleString('zh-CN')}。你的帖子《${String(post.title || '').slice(0, 60)}》：${String(post.body || '').slice(0, 300)}\n写出分享时说的话；如果此刻你并不想分享，只输出 SKIP。` }], { background:true, backgroundPriority:-1, stream:false, temperature:.8, max_tokens:220, usageFeature:'forum', usageChar:char });
            if (!result?.ok) throw new Error(result?.error || '分享失败');
            const text = String(result.content || '').trim().replace(/^["“「]|["”」]$/g, '').slice(0, 400); if (!text) throw new Error('空分享'); if (/^SKIP$/i.test(text)) return;
            mutate(next => {
                const target = next.posts.find(item => item.id === post.id); if (!target || target.deletedAt || target.sharedToUser) return;
                target.sharedToUser = now();
                const message = { id:uid('dm'), fromId:actor.id, toId:'user', body:`${text}\n${postLink(post.id)}`, createdAt:now(), readAt:0, shared:true };
                next.messages.push(message);
                const event = addEvent(next, 'forum_dm', actor.id, 'user', { messageId:message.id, sharedPostId:post.id }, 'private');
                grantKnowledge(next, 'user', event, actor.id, 'direct', 1); grantKnowledge(next, actor.id, event, actor.id, 'authored', 1);
                const record = next.agentStates[actor.id] ||= {}; record.lastShareAt = now(); record.shareLog = [...safeList(record.shareLog).filter(at => Number(at) > now() - 3 * DAY), now()];
            });
            setForumUnread(true);
            if ((activeTab === 'chat' && activeThreadId === actor.id) || activeTab === 'notifications') render();
        } catch (error) { console.warn('char 分享帖子未完成', error); }
        finally { sharingBusy = false; }
    }
