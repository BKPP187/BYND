    function processPlannedDeletes() { const due = loadState().posts.filter(post => post.plannedDeleteAt && !post.deletedAt && post.plannedDeleteAt <= now()); if (!due.length) return; try { mutate(next => { next.posts.filter(post => post.plannedDeleteAt && !post.deletedAt && post.plannedDeleteAt <= now()).forEach(post => tombstonePost(next,post,post.authorId,true,post.plannedDeleteAt)); }); render(); } catch (error) { showToast(error.message); } }
    function maybeLazySimulate() { if (now() - lastScheduleCheck < 30000) return; lastScheduleCheck = now(); const world = loadState(); if (!world.migration?.apiGenerated || isGenerating) return; const settings = world.forumSettings; const elapsed = now() - Number(world.lastSimulatedAt || now()); const lastAttempt = Number(settings.lastAttemptAt || 0); const retryAt = Number(settings.autoRetryAt || 0); let due = false; if (settings.refreshMode === 'interval') due = retryAt ? now() >= retryAt : now() - Math.max(Number(world.lastSimulatedAt || 0),lastAttempt) >= Number(settings.intervalHours || 12) * 3600000; if (settings.refreshMode === 'smart') { if (!settings.nextSmartAt) { try { mutate(next => { next.forumSettings.nextSmartAt = nextSmartTime(now()); }); } catch (error) { showToast(error.message); } return; } due = retryAt ? now() >= retryAt : now() >= Number(settings.nextSmartAt) && now() - lastAttempt >= 30 * 60000; } if (!due) return; try { mutate(next => { next.forumSettings.lastAttemptAt = now(); next.forumSettings.autoRetryAt = 0; if (settings.refreshMode === 'smart' && !retryAt) next.forumSettings.nextSmartAt = nextSmartTime(now()); }); void advanceWorld({ offline: true, elapsed }); } catch (error) { showToast(error.message); } }
    async function init() { setForumUnread(false); if (window._wechatCharactersLoadPromise) { try { await window._wechatCharactersLoadPromise; } catch (_) {} } let saveError = null; try { syncAccounts(); queueRecentInteractions(); } catch (error) { saveError = error; } activeTab = activeTab || 'home'; render(); if (saveError) showToast(saveError.message); else { processPlannedDeletes(); maybeLazySimulate(); void maybeRunInteraction(); } }
    if (typeof window.setInterval === 'function') window.setInterval(() => { if (document.hidden) return; void maybeRunInteraction(); const forum = document.getElementById('app-living-world-window'); if (!forum || forum.classList.contains('hidden')) return; processPlannedDeletes(); maybeLazySimulate(); const current = now(); const boundary = loadState().posts.some(post => post.ama && ((Number(post.amaStartsAt) > lastAmaCheckAt && Number(post.amaStartsAt) <= current) || (Number(post.expiresAt) > lastAmaCheckAt && Number(post.expiresAt) <= current))); lastAmaCheckAt = current; if (boundary) { if (activeTab === 'detail' && !isVisible(loadState().posts.find(post => post.id === activePostId),viewer().id)) { activeTab = 'home'; activePostId = ''; replyComposerOpen = false; } render(); } }, 30000);
    // Background replies (「应用运行时自动」) land while the forum is closed; flag the desktop entry until the forum opens.
    function setForumUnread(value) { try { if (value) localStorage.setItem(UNREAD_KEY, '1'); else localStorage.removeItem(UNREAD_KEY); } catch (_) {} document.documentElement?.classList?.toggle('lw-forum-unread', !!value); }
    if (typeof window.addEventListener === 'function') window.addEventListener('bynd:world-event', event => {
        const item = event?.detail; const forum = document.getElementById('app-living-world-window');
        if (!item || !item.actorId || item.actorId === 'user' || !['forum_reply','forum_post','forum_dm_reply','forum_news_reply','forum_follow','forum_like'].includes(item.type) || (forum && !forum.classList.contains('hidden'))) return;
        setForumUnread(true);
    });
    try { if (localStorage.getItem(UNREAD_KEY)) document.documentElement?.classList?.add('lw-forum-unread'); } catch (_) {}

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

    window.LivingWorld = { init, render, setTab, setCommunity, openCommunity, openPost, openPostLink, openProfile, refreshProfile, back, toggleMenu, menuGo, returnToDesktop, saveForumSettings, setPromotionEnabled, updatePromotionGap, restoreHiddenPost, getVisibleSocialLinks: visibleSocialLinks, togglePerspective, toggleSearch, submitSearch, searchFor, clearSearch, toggleCommentSearch, submitCommentSearch, clearCommentSearch, openReplyComposer, closeReplyComposer, updateReplyDraft, setReplyMedia, clearReplyMedia, pickReplyImage, togglePostActions, copyPostLink, copyPostText, comicCurrentPost, shareCurrentPost, saveCurrentPost, followCurrentPost, hideCurrentPost, blockPostAuthor, reportCurrentPost, awardCurrentPost, crosspostCurrentPost, postLanguageInfo, translateCurrentPost, translateNews, openChat, setActivityTab, setProfileTab, editProfile, pickProfileAvatar, saveProfile, setViewer, createPost, reply, replyToComment, clearReplyTarget, toggleCommentSort, voteComment, vote, votePoll, toggleLike, toggleBookmark, toggleBlock, togglePostMenu, sharePost, shareNews, closeShare, shareToForumDm, shareToCharacterChat, deletePost, toggleFollow, toggleCommunityPicker, selectComposeCommunity, showComposeCommunityForm, updateCompose, toggleLinkInput, togglePoll, addPollOption, toggleAma, openAmaPicker, closeAmaPicker, selectAmaOption, updateAmaStart, removeDraftImage, pickImage, startMessage, filterRecipients, openThread, sendMessage, retryDirectReply, markAllRead, toggleCommunityForm, createCommunity, toggleSubscribe, promoteNpc, openNotice, fetchRealNews, openNews, commentNews, updateNewsDraft, openPromotion, generate, advanceWorld, maybeRunInteraction, progressWorld, getRelevantEventsForChar, recordPrivateChatMessage, clearPrivateChatEvents, storageKey: STORAGE_KEY };
    window.initLivingWorld = init;
    window.LivingWorld.getRelationshipGraph = relationshipGraphData;
    window.LivingWorld.openRelation = openRelation;
    window.LivingWorld.retryRelationImpression = retryRelationImpression;
    window.LivingWorld.closeRelation = closeRelation;
    window.getLivingWorldRelevantEventsForChar = getRelevantEventsForChar;
    window.LivingWorld.getPostPreview = getPostPreview;
    window.getLivingWorldMemoryCandidatesForChar = getMemoryCandidatesForChar;
}());
