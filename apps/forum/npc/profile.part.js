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
