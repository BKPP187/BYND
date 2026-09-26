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
                    const event = addEvent(next,'forum_reply',actor.id,task.postId,{ commentId:row.id, excerpt:row.body.slice(0,180), sourceEventIds:[task.eventId], generated:true },'public');
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
        let outcome = ''; let failure = '';
        const settings = world.forumSettings; const lastPromotionAt = Math.max(0, ...world.promotions.map(item => Number(item.createdAt || 0)));
        const postsSincePromotion = world.posts.filter(post => Number(post.createdAt || 0) > lastPromotionAt).length;
        // Promotions follow the feed gap settings: after min..max new posts, one actor step may add a world-grounded promotion.
        const promotionDue = !!settings.promotionsEnabled && postsSincePromotion >= Math.max(4, Number(settings.promotionMinGap || 8)) && (postsSincePromotion >= Number(settings.promotionMaxGap || 15) || Math.random() < .5);
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
            const prompt = `你只扮演 BYND 论坛的一位角色。以下资料是这位角色自己的身份、已知经历与本次实际刷到的帖子，不是全知世界。actor.worldRules 只约束世界设定，不意味着角色知道其中每件事；角色可选择沉默，不要为了产出而编造遭遇，不要替 User 行动，不要泄露私聊原文。${actionGuidance}只返回严格 JSON：{"actorId":"${actor.id}","action":"silence|post|reply|delete|profile|community","sourceEventIds":[],"communityId":"发帖社区ID","targetPostId":"回复或删除的帖子ID","title":"帖子标题","body":"帖子或回复内容","deleteAfterMinutes":0,"name":"社交平台公开昵称","username":"@可更改的公开ID","summary":"签名","mood":"心情","followerCount":0,"avatarPrompt":"头像描述","description":"新社区简介"}。只填写所选动作需要的字段。profile 的 followerCount 是公开粉丝总数，不得小于已知关注者 ${profileMetrics(actor.id).followers} 人，不要编造粉丝身份。sourceEventIds 只能引用 knownEvents 或 encounteredPosts 的 eventId。reply 只能回复已知或本次刷到的帖子；delete 只能删除自己生成的帖子。行为要延续已有情绪与习惯，但记忆不能改写原始事实。若没有自然动机，返回 action=silence。${promotionDue ? '此外，信息流需要一条世界内推广：可额外输出 "promotion":{"sponsor":"","headline":"","body":"","detail":"","cta":"","targetCommunityIds":["社区ID"]}，从这位角色所处世界里的店铺或活动出发，明确是推广，不写真实广告商或外部链接；它与 action 无关，不合适就省略。' : ''}\n${JSON.stringify(context)}`;
            const result = await window.callChatApi([{ role:'system', content:'只输出单个角色的严格 JSON 决策；世界事实以输入为准。' },{ role:'user', content:prompt }],{ background:true, backgroundPriority:-1, stream:false, temperature:.72, max_tokens:1300, usageFeature:'forum' });
            if (!result?.ok) throw new Error(result?.error || '角色行动决策失败。');
            const raw = parseJsonBatch(result.content);
            const decision = validateActorDecision(world,actor.id,encountered,raw);
            if (jevAction && decision.action !== jevAction && decision.action !== 'silence') throw new Error('角色行动与 Jev 决策不一致。');
            const promotion = promotionDue ? actorPromotion(world,actor.id,raw.promotion) : null;
            mutate(next => { if (next.posts.length !== world.posts.length || next.events.length !== world.events.length || next.knowledge[actor.id]?.length !== world.knowledge[actor.id]?.length) throw new Error('世界在角色思考时已经变化，请重新推进。'); commitActorDecision(next,actor.id,encountered,decision); if (promotion) { next.promotions.push({ id:uid('promotion'), ...promotion, createdAt:now(), generated:true, actorId:actor.id }); next.promotions = next.promotions.slice(-40); } });
            const avatars = decision.action === 'profile' && loadState().forumSettings.profileMode === 'full' ? await generatePendingAvatars(1,actor.id) : { made:0, error:'' };
            outcome = decision.action === 'silence' ? `${actor.name} 看了看论坛，今天没有发言。` : `${actor.name} 的${{ post:'帖子', reply:'回复', delete:'删帖', profile:'主页更新', community:'新社区' }[decision.action]}已写入世界轨迹。`;
            if (avatars.error) outcome += ` 头像未更新：${avatars.error}`;
        } catch (error) { console.warn('Living World actor step rejected',error); outcome = error?.message || '角色行动失败，世界状态未改变。'; failure = outcome; }
        finally { isGenerating = false; if (options.offline && (failure || loadState().forumSettings.autoFailureCount)) recordAutoAttempt(failure); processPlannedDeletes(); render(); if (!options.offline) showToast(outcome); }
    }
    function actorPromotion(world, actorId, raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        try { const item = validateBatch({ newPromotions:[{ ...raw, privateFor:'' }] }).promotions[0]; return item && !copiesPrivateChat(world,actorId,{ title:item.headline, body:`${item.body} ${item.detail}` }) ? item : null; }
        catch (_) { return null; }
    }
    // A failed scheduled step (e.g. relay 429) retries after 10 min, doubling up to the refresh interval, instead of waiting a whole interval.
    function recordAutoAttempt(failure) {
        try {
            mutate(next => {
                const settings = next.forumSettings;
                if (!failure) { settings.autoFailureCount = 0; settings.autoRetryAt = 0; settings.lastAutoFailure = null; return; }
                const count = Math.min(12, Number(settings.autoFailureCount || 0) + 1);
                const cap = Math.max(10 * 60000, (settings.refreshMode === 'interval' ? Number(settings.intervalHours || 12) : 6) * 3600000);
                settings.autoFailureCount = count; settings.autoRetryAt = now() + Math.min(cap, 10 * 60000 * 2 ** (count - 1));
                settings.lastAutoFailure = { reason:String(failure).slice(0,160), at:now() };
            });
        } catch (error) { console.warn('论坛自动推进状态未保存', error); }
    }
    function progressWorld(options = {}) { const world = loadState(); return !world.migration?.apiGenerated || !world.communities.length || !agentActors(world).length ? generate({ ...options, bootstrap:!world.communities.length }) : advanceWorld(options); }
