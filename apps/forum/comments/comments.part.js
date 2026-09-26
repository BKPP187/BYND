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
