function parseWechatAiJsonPayload(content) {
    const text = String(content || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    if (!text) return null;
    try { return JSON.parse(text); } catch (_) {}
    const arrayStart = text.indexOf('[');
    const arrayEnd = text.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
        try { return JSON.parse(text.slice(arrayStart, arrayEnd + 1)); } catch (_) {}
    }
    const objectStart = text.indexOf('{');
    const objectEnd = text.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
        try { return JSON.parse(text.slice(objectStart, objectEnd + 1)); } catch (_) {}
    }
    return null;
}

function getWechatGeneratedGradient(seed = '') {
    const palettes = [
        ['#0f172a', '#38bdf8', '#f8fafc'],
        ['#111827', '#22c55e', '#facc15'],
        ['#2f1b45', '#e879f9', '#fef3c7'],
        ['#172554', '#f97316', '#f8fafc'],
        ['#064e3b', '#14b8a6', '#ecfeff'],
        ['#3b1d12', '#fb7185', '#fde68a'],
        ['#1e293b', '#a3e635', '#f8fafc']
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    const p = palettes[hash % palettes.length];
    return [
        `linear-gradient(135deg,${p[0]},${p[1]})`,
        `linear-gradient(135deg,${p[1]},${p[2]})`,
        `linear-gradient(135deg,${p[0]},${p[2]})`
    ];
}

function getWechatMediaFrameStyle(frame) {
    const value = String(frame || '').trim();
    if (/^(https?:|data:image)/i.test(value)) return `background-image:${getWechatCssUrl(value)}`;
    return `background:${wcEscapeHtml(value || getWechatGeneratedGradient('media')[0])}`;
}

(() => {
    const D = () => window.ByndDiscoverStory;
    const e = value => D().escape(value);
    let tab = 'discover', mode = 'feed', selected = '', sourceId = '', picker = false, replyTo = null;
    const scenes = new Map();
    const state = () => D().read('video');
    const find = id => state().videos.find(item => String(item.id) === String(id));
    const actorOf = item => typeof item.author === 'object' ? item.author : { key: 'legacy:' + item.id, name: item.author || '作品作者' };
    const sceneList = item => Array.isArray(item.scenes) && item.scenes.length ? item.scenes : [{ caption: item.description || item.title, visual: '' }];
    const source = () => D().character(sourceId) || D().characters()[0];
    const viewer = () => state().perspective === 'user' ? null : D().character(state().perspective);
    const publicActor = video => viewer() ? D().characterActor(viewer()) : D().userActor(D().character(video?.sourceCharId) || source());
    const prefs = (s = state(), actor = publicActor(), create = false) => D().account(s, actor, create);
    const owns = (video, actor = publicActor(video)) => actor.key === actorOf(video).key || (actor.charId != null && String(actor.charId) === String(actorOf(video).charId));
    const participants = watch => watch.participants || [watch.initiator || D().userActor(D().character(watch.charId)), { key: 'char:' + watch.charId, charId: watch.charId, name: D().name(D().character(watch.charId)) }];
    const canWatch = (watch, actor = publicActor()) => participants(watch).some(person => person.key === actor.key);
    const liked = (s, video, actor = publicActor(video)) => prefs(s, actor).likes[video.id] ?? !!video.reactions?.some(person => person.key === actor.key);
    function trace(s, kind, video, text, extras = {}) {
        const actor = extras.actor || publicActor(video);
        const knownBy = [...new Set([actor.charId, video?.author?.charId, ...(video?.author?.user ? [video.sourceCharId] : []), ...(extras.knownBy || [])].filter(Boolean))];
        D().remember(s, { kind, actor, targetId: video?.id, title: video?.title, text, knownBy, ...extras });
    }
    function setPerspective(id) {
        return D().run('perspective:video', () => {
            const char = id === 'user' ? null : D().character(id);
            if (id !== 'user' && !char) throw new Error('这个角色已不可用。');
            D().change('video', s => {
                s.perspective = id;
                if (char) D().remember(s, { kind: 'visit', actor: D().userActor(char), text: D().userName(char) + '来看了' + D().name(char) + '的视频号视角', knownBy: [char.id], dedupe: 'visit:' + char.id + ':' + Math.floor(Date.now() / 1800000) });
            });
            if (char) sourceId = char.id;
            picker = false; mode = 'feed'; replyTo = null; return true;
        }, () => D().refresh());
    }
    function viewWork(id, kind = 'view') {
        const video = find(id); if (!video) return;
        const actor = publicActor(video);
        D().change('video', s => trace(s, kind, video, kind === 'scene' ? '继续看了作品的下一幕' : '打开了这条作品', { actor, dedupe: kind + ':' + actor.key + ':' + id + ':' + Math.floor(Date.now() / 1800000) }));
    }
    function publish(charId, options = {}) {
        return D().run('publish:video:' + charId, async () => {
            const char = D().character(charId);
            if (!char) throw new Error('先选择一个角色世界。');
            const publicWorks = state().videos.filter(item => String(item.sourceCharId) === String(char.id)).slice(-10);
            const result = await D().ask(char, '判断是否有自然动机发布作品；有则生成角色或世界 NPC 的公开图文作品与场景字幕，不要照搬私聊。你与朋友也可对已有公开作品继续点赞、评论、回复彼此，interactions引用publicWorks的id；不要替用户发言，不要所有互动都围绕用户。没新作品可needed=false，仍可有自然的公开互动，也可以都不做', { previous: publicWorks.map(item => item.title), publicWorks: publicWorks.map(video => ({ id: video.id, author: actorOf(video), title: video.title, text: video.description, comments: [...(video.comments || []), ...(state().comments[video.id] || [])].slice(-10) })), trigger: options.background ? '本轮剧情' : '用户查看新动态' }, '{"needed":true或false,"videos":[{"author":{"charId":"联系人id"},"title":"标题","description":"公开配文","scenes":[{"caption":"场景字幕","visual":"画面描写"}],"comments":[{"actor":{"charId":"联系人id"},"text":"朋友评论"}]}],"interactions":[{"videoId":"已有公开作品id","actor":{"charId":"联系人id"},"text":"评论，可以为空","replyTo":"回复对象名，可空","like":true}]}');
            if (options.turn && D().capture(char) !== options.turn) throw new Error('剧情已经变化，本次作品未发布。');
            const interactions = (Array.isArray(result.interactions) ? result.interactions : []).slice(0, 8).map(raw => {
                if (!publicWorks.some(video => String(video.id) === String(raw.videoId))) throw new Error('互动引用了不可见的作品。');
                return { videoId: raw.videoId, actor: D().actor(raw.actor, char), text: D().clip(raw.text, 1000), replyTo: D().clip(raw.replyTo, 60), like: raw.like === true };
            });
            if (result.needed !== false && (result.needed !== true || !Array.isArray(result.videos) || !result.videos.length)) throw new Error('没有收到完整作品，原有内容已保留。');
            const videos = (result.needed === false ? [] : result.videos).slice(0, 3).map(raw => {
                const title = D().clip(raw.title, 100), description = D().clip(raw.description, 1500);
                const parts = (Array.isArray(raw.scenes) ? raw.scenes : []).slice(0, 6).map(scene => ({ caption: D().clip(scene.caption, 1000), visual: D().clip(scene.visual, 800) }));
                if (!title || !parts.length || parts.some(scene => !scene.caption)) throw new Error('作品标题或场景字幕不完整。');
                return { id: D().uid('channel'), sourceCharId: char.id, author: D().actor(raw.author, char, true), title, description, scenes: parts, comments: D().lines(raw.comments || [], char), createdAt: Date.now() };
            });
            D().change('video', s => {
                if (s.videos.length + videos.length > 200) throw new Error('作品已达 200 条，请先整理历史内容。');
                const fresh = videos.filter(item => !s.videos.some(old => old.sourceCharId === item.sourceCharId && old.title === item.title));
                s.videos.push(...fresh);
                for (const interaction of interactions) {
                    const video = s.videos.find(item => String(item.id) === String(interaction.videoId)); if (!video) continue;
                    s.comments[video.id] ||= [];
                    if (interaction.text && !s.comments[video.id].some(row => row.actor?.key === interaction.actor.key && row.text === interaction.text)) s.comments[video.id].push({ actor: interaction.actor, text: interaction.text, replyTo: interaction.replyTo });
                    if (interaction.like) { video.reactions = [...new Map([...(video.reactions || []), interaction.actor].map(actor => [actor.key, actor])).values()]; prefs(s, interaction.actor, true).likes[video.id] = true; }
                    trace(s, 'world-interaction', video, interaction.actor.name + (interaction.text ? '：' + interaction.text : '赞了这条作品'), { actor: interaction.actor, knownBy: [...new Set([char.id, interaction.actor.charId, video.author?.charId].filter(Boolean))] });
                }
                s.notice = fresh.length || interactions.length ? '' : '暂时没有新的作品，稍后再来看看。'; s.generatedAt = Date.now();
            });
            return videos.length > 0 || interactions.length > 0;
        }, () => D().refresh());
    }
    function privateCard(video) { return { type: 'share_card', isMe: true, card: { type: 'channel', title: video.title, text: video.description || sceneList(video).map(scene => scene.caption).join('\n'), source: '视频号 · 一起看', images: [] } }; }
    function perform(id) {
        return D().execute('video', id, async event => {
            const video = find(event.targetId); if (!video) throw new Error('作品已不存在。');
            const watch = event.watchId ? state().watches[event.watchId] : null;
            const isWatch = event.kind.startsWith('watch');
            const speaker = event.actor || watch?.initiator || D().userActor(D().character(video.sourceCharId));
            if (!speaker.user && !D().character(speaker.charId)) throw new Error('发言身份已不可用。');
            if (isWatch && (!watch || !canWatch(watch, speaker) || watch.videoId !== video.id || !Number.isInteger(event.sceneIndex) || event.sceneIndex < 0 || event.sceneIndex >= sceneList(video).length)) throw new Error('一起看的会话或参与身份已不存在。');
            const partner = isWatch ? participants(watch).find(person => person.key !== speaker.key) : null;
            const char = D().character(isWatch ? partner?.charId || speaker.charId : ['account-post', 'user-post'].includes(event.kind) ? video.sourceCharId : actorOf(video).charId || video.sourceCharId);
            if (!char) throw new Error('作品未关联可互动的角色，或角色已被删除。');
            const result = isWatch && partner?.user ? { reply: '', privateMessage: '' } : await D().ask(char,
                isWatch ? '和 interactionActor 所标明的身份一起看作品，自然回应当前场景和对方的话，结束时回顾共同经历。严格按参与人身份说话，不把其他角色当成用户。'
                : '在视频号里自然互动。interactionActor 是本次实际操作的身份：user 才是用户，charId 对应角色本人。本次发言已保存，不要让同一个身份重复回应自己；其他角色或世界NPC可以接话，也可以沉默。新作品的作者可能是角色本人或用户。评论回复要接住 replyTo 指定的对象。不要替用户发言，不要所有人围着用户。只有操作人是user时才可选择私聊该用户，角色之间互动时privateMessage留空。',
                { action: event.kind, interactionActor: speaker, userText: event.text, replyTo: event.replyTo || null, work: { author: actorOf(video), title: video.title, description: video.description, scenes: sceneList(video) }, sceneIndex: event.sceneIndex, discussion: watch?.messages?.slice(-12) || [], publicComments: [...(video.comments || []), ...(state().comments[video.id] || [])].slice(-18) },
                isWatch ? '{"reply":"受邀角色的回应","privateMessage":"结束时的私聊回顾，像微信消息一样用|||分成2~4条，每条一句完整的话，不要在句子中间断开；太短就一条不分隔，其他时候为空"}' : '{"replies":[{"actor":{"charId":"联系人id"},"text":"公开回复"}],"likes":[{"charId":"联系人id"}],"privateMessage":"仅操作人是user时可提供私聊，像微信消息一样用|||分成2~4条，每条一句完整的话，不要在句子中间断开；太短就一条不分隔，其他时候为空"}', isWatch && !!speaker.user);
            if (!speaker.user && !D().character(speaker.charId)) throw new Error('发言身份已删除，本次回应未保存。');
            const replies = isWatch ? [] : D().lines(result.replies || [], char).filter(reply => reply.actor.key !== speaker.key);
            if (isWatch && !partner?.user && !D().clip(result.reply, 1500)) throw new Error('角色还没有给出一起看的回应。');
            if (speaker.user && ['comment', 'user-post'].includes(event.kind) && !replies.length) throw new Error('评论回复为空，请重试。');
            const reactions = ['user-post', 'account-post'].includes(event.kind) ? (Array.isArray(result.likes) ? result.likes : []).slice(0, 8).map(raw => D().actor(raw, char)).filter(actor => actor.key !== speaker.key) : [];
            const privateMessage = D().clip(result.privateMessage, 2000);
            D().change('video', currentState => {
                const row = currentState.events.find(item => item.id === id);
                if (!row || row.status === 'done') return;
                if (event.kind === 'like' && !prefs(currentState, speaker).likes[video.id]) { row.status = 'cancelled'; return; }
                if (isWatch) {
                    const current = currentState.watches[event.watchId];
                    if (!current || current.status === 'ended') throw new Error('一起看已经结束。');
                    if (event.text) current.messages.push({ actor: speaker, isMe: speaker.key === participants(current)[0].key, text: event.text, sceneIndex: event.sceneIndex });
                    if (result.reply) current.messages.push({ actor: partner, isMe: false, text: D().clip(result.reply, 1500), sceneIndex: event.sceneIndex });
                    current.sceneIndex = event.sceneIndex;
                    const peers = participants(current), host = peers.find(person => !person.user);
                    trace(currentState, event.kind, video, event.text + (result.reply ? '\n' + partner.name + '：' + result.reply : ''), { actor: speaker, knownBy: peers.map(person => person.charId).filter(Boolean) });
                    if (event.kind === 'watch-start' && peers.some(person => person.user)) {
                        const messages = speaker.user ? [privateCard(video), ...D().privateMessages(result.reply, char)] : [{ ...privateCard(video), isMe: false }];
                        D().outbox(currentState, id, host.charId, messages);
                    }
                    if (event.kind === 'watch-end') {
                        current.status = 'ended'; current.endedAt = Date.now();
                        if (peers.some(person => person.user)) D().outbox(currentState, id, host.charId, speaker.user
                            ? [{ type: 'text', isMe: true, content: '刚才一起看了《' + video.title + '》。\n' + current.messages.filter(item => item.actor?.user || (!item.actor && item.isMe)).map(item => item.text).slice(-8).join('\n') }, ...D().privateMessages(privateMessage || D().clip(result.reply, 1500), char)]
                            : [{ type: 'text', isMe: false, content: '刚才和你一起看了《' + video.title + '》。\n' + event.text }]);
                    }
                } else {
                    currentState.comments[video.id] ||= [];
                    if (event.kind === 'comment' && !currentState.comments[video.id].some(comment => comment.eventId === id && (comment.submitted || comment.user))) currentState.comments[video.id].push({ submitted: true, user: !!speaker.user, name: speaker.name, actor: speaker, text: event.text, replyTo: event.replyTo, eventId: id });
                    currentState.comments[video.id].push(...replies.map(reply => ({ ...reply, replyTo: speaker.name, eventId: id })));
                    const currentVideo = currentState.videos.find(item => item.id === video.id);
                    if (currentVideo && reactions.length) currentVideo.reactions = [...new Map([...(currentVideo.reactions || []), ...reactions].map(actor => [actor.key, actor])).values()];
                    for (const actor of reactions) prefs(currentState, actor, true).likes[video.id] = true;
                    trace(currentState, 'public-replies', video, replies.map(reply => reply.actor.name + '：' + reply.text).join('\n'), { actor: speaker, knownBy: [...new Set([speaker.charId, char.id, ...replies.map(reply => reply.actor.charId)].filter(Boolean))] });
                    if (speaker.user && privateMessage) {
                        const dms = D().privateMessages(privateMessage, char);
                        if (dms.length) {
                            dms[0].content = '关于视频号《' + video.title + '》：\n' + dms[0].content;
                            D().outbox(currentState, id, actorOf(video).charId || char.id, dms);
                        }
                    }
                }
                row.status = 'done'; row.completedAt = Date.now(); delete row.error;
            });
            await D().deliver('video'); return true;
        });
    }
    function submit(kind, id, text = '', sceneIndex) {
        const identity = publicActor(find(id));
        const targetReply = replyTo;
        return D().run('submit:video:' + id, async () => {
            if (!['comment', 'watch-message', 'watch-next', 'watch-end'].includes(kind)) throw new Error('不支持的作品互动。');
            if (text.length > 1000) throw new Error('这条消息最多 1000 字。');
            const video = find(id); if (!video) throw new Error('作品已不存在。');
            const watch = mode === 'watch' ? state().watches[selected] : null;
            if (kind.startsWith('watch') && !watch) throw new Error('请先打开当前身份参与的一起看会话。');
            if (watch && !canWatch(watch, identity)) throw new Error('当前身份不在这次一起看中。');
            if (watch && state().events.some(item => item.watchId === watch.id && !['done', 'cancelled'].includes(item.status))) throw new Error('上一条回应还未完成，请先重试。');
            const eventId = D().uid('discover_event');
            D().change('video', s => {
                const actor = identity;
                s.events.push({ id: eventId, createdAt: Date.now(), status: 'pending', kind, targetId: id, text: D().clip(text, 1000), actor, replyTo: kind === 'comment' ? targetReply : null, ...(watch ? { watchId: watch.id, sceneIndex: sceneIndex ?? watch.sceneIndex ?? 0 } : {}) });
                if (kind === 'comment') {
                    s.comments[id] ||= [];
                    s.comments[id].push({ submitted: true, user: !!actor.user, name: actor.name, actor, text: D().clip(text, 1000), replyTo: targetReply, eventId });
                    trace(s, 'comment', video, text, { actor, replyTo: targetReply, dedupe: eventId });
                }
            });
            if (kind === 'comment') replyTo = null;
            const input = document.getElementById(kind === 'comment' ? 'wc-ds-comment' : 'wc-ds-watch-input');
            if (input?.value.trim() === text.trim()) input.value = '';
            return perform(eventId);
        }, () => D().refresh());
    }
    function toggleLike(id) {
        const identity = publicActor(find(id));
        return D().run('like:' + id, async () => {
            let eventId;
            D().change('video', s => {
                const video = s.videos.find(item => item.id === id); if (!video) throw new Error('作品已不存在。');
                const account = prefs(s, identity, true);
                account.likes[id] = !liked(s, video, identity);
                video.reactions = (video.reactions || []).filter(actor => actor.key !== identity.key);
                if (account.likes[id]) video.reactions.push(identity);
                trace(s, account.likes[id] ? 'like' : 'unlike', video, identity.name + (account.likes[id] ? '点赞了这条作品' : '取消了点赞'), { actor: identity });
                if (account.likes[id] && video.sourceCharId && !s.events.some(row => row.targetId === id && row.kind === 'like' && (row.actor?.key || 'user') === identity.key)) {
                    eventId = D().uid('discover_event');
                    s.events.push({ id: eventId, createdAt: Date.now(), status: 'pending', kind: 'like', actor: identity, targetId: id, text: identity.name + '点赞了这条作品' });
                }
            });
            if (eventId) return perform(eventId);
            return true;
        }, () => D().refresh());
    }
    function toggle(field, id) {
        const identity = publicActor();
        return D().run('toggle:' + field + ':' + id, () => { D().change('video', s => {
            if (!['favs', 'follows'].includes(field)) throw new Error('不支持的操作。');
            if (field === 'follows' && id === identity.key) throw new Error('不能关注自己。');
            const account = prefs(s, identity, true); account[field][id] = !account[field][id];
            if (field === 'follows') { const video = s.videos.find(item => actorOf(item).key === id); if (video) trace(s, account[field][id] ? 'follow' : 'unfollow', video, account[field][id] ? '关注了作者' : '取消关注作者', { actor: identity }); }
        }); return true; }, () => D().refresh());
    }
    function post(text, charId = source()?.id) {
        const identity = publicActor();
        return D().run('user-post:video', async () => {
            const char = D().character(charId), body = D().clip(text, 1500);
            if (!char || !body || String(text).length > 1500) throw new Error('选择可见的角色世界，写下 1–1500 字作品内容。');
            const id = D().uid('user_channel'), eventId = D().uid('discover_event');
            D().change('video', s => {
                if (s.videos.length >= 200) throw new Error('作品已达 200 条，请先整理历史内容。');
                const video = { id, sourceCharId: char.id, author: identity, manual: true, title: body.split(/\n|[。！？]/)[0].slice(0, 60), description: body, scenes: [{ caption: body, visual: '' }], comments: [], createdAt: Date.now() };
                s.videos.push(video);
                s.events.push({ id: eventId, targetId: id, kind: identity.user ? 'user-post' : 'account-post', actor: identity, text: body, status: 'pending', createdAt: Date.now() });
                trace(s, identity.user ? 'user-post' : 'account-post', video, body, { actor: identity, knownBy: [identity.charId, char.id].filter(Boolean), dedupe: eventId });
            });
            const input = document.getElementById('wc-ds-post'); if (input) input.value = '';
            tab = 'mine'; mode = 'feed';
            return perform(eventId);
        }, () => D().refresh());
    }
    function share(videoId, charId) {
        const identity = publicActor(find(videoId));
        return D().run('share:' + videoId, async () => {
            const video = find(videoId), char = D().character(charId);
            const recipient = charId === 'user' ? D().userActor(D().character(identity.charId)) : char ? D().characterActor(char) : null;
            if (!video || !recipient || recipient.key === identity.key) throw new Error('请转发给其他身份。');
            D().change('video', s => {
                if (!identity.user && !recipient.user) {
                    s.shares.push({ id: D().uid('channel_share'), actor: identity, recipient, videoId, at: Date.now() });
                    trace(s, 'share', video, '转发了这条作品给' + recipient.name, { actor: identity, knownBy: [identity.charId, recipient.charId] });
                    return;
                }
                const targetId = recipient.user ? identity.charId : char.id;
                if (s.outbox.some(item => item.shareVideoId === videoId && (item.senderKey || 'user') === identity.key && String(item.charId) === String(targetId) && !['sent', 'cancelled'].includes(item.status))) return;
                const id = D().uid('channel_share');
                D().outbox(s, id, targetId, [{ ...privateCard(video), isMe: !!identity.user, card: { ...privateCard(video).card, source: '视频号 · 转发' } }]);
                Object.assign(s.outbox.find(item => item.id === id), { shareVideoId: videoId, senderKey: identity.key });
                trace(s, 'share', video, '转发了这条作品给' + recipient.name, { actor: identity, knownBy: [], recipientId: targetId, outboxId: id });
            });
            const delivered = await D().deliver('video');
            if (!delivered) throw new Error('转发还未送达，可重试发送。');
            mode = 'feed'; return true;
        }, () => D().refresh());
    }
    function startWatch(videoId, charId) {
        const identity = publicActor(find(videoId));
        return D().run('watch-create:' + videoId, async () => {
            const partner = charId === 'user' ? D().userActor(D().character(identity.charId)) : D().characterActor(D().character(charId));
            if (!find(videoId) || partner.key === identity.key) throw new Error('请选择另一个身份一起看。');
            const existing = Object.values(state().watches).find(item => item.videoId === videoId && participants(item).some(person => person.key === partner.key) && canWatch(item, identity) && item.status === 'active');
            if (existing) { selected = existing.id; mode = 'watch'; render(); return true; }
            const id = D().uid('watch');
            D().change('video', s => { s.watches[id] = { id, videoId, charId: partner.charId || identity.charId, initiator: identity, participants: [identity, partner], status: 'active', messages: [], sceneIndex: 0, createdAt: Date.now() }; });
            selected = id; mode = 'watch'; render();
            return perform(D().event('video', { kind: 'watch-start', actor: identity, targetId: videoId, watchId: id, text: '邀请你一起看《' + find(videoId).title + '》', sceneIndex: 0 }));
        }, () => D().refresh());
    }
    function poster(video, index = 0) {
        const parts = sceneList(video), part = parts[Math.max(0, Math.min(parts.length - 1, index))];
        const legacyImage = Array.isArray(video.frames) ? video.frames[Math.min(index, video.frames.length - 1)] : '';
        const image = /^(?:https?:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(legacyImage || '') ? `<img class="wc-ds-art" src="${e(legacyImage)}" alt="${e(part.visual || video.title)}">` : D().avatar(actorOf(video));
        return `<div class="wc-ds-stage">${image}<span class="wc-ds-stage-label">${index + 1} / ${parts.length}</span><strong>${e(video.title)}</strong><p>${e(part.visual || video.description)}</p><blockquote>${e(part.caption)}</blockquote></div>`;
    }
    function card(video, detail = false) {
        const s = state(), account = prefs(s), actor = actorOf(video), comments = [...(video.comments || []), ...(s.comments[video.id] || [])];
        return `<article class="wc-ds-card"><div class="wc-ds-person">${D().avatar(actor)}<div><strong>${e(actor.name)}</strong><small>${owns(video) ? '我的作品 · ' : ''}${video.createdAt ? e(formatWechatRelativeTime(video.createdAt)) : '历史作品'}</small></div>${owns(video) ? '' : `<button data-ds-action="follow" data-id="${e(actor.key)}" aria-pressed="${!!account.follows[actor.key]}">${account.follows[actor.key] ? '已关注' : '关注'}</button>`}</div>
            ${actor.user || video.manual ? '' : `${poster(video, scenes.get(video.id) || 0)}<div class="wc-ds-scene-nav"><button data-ds-action="scene" data-id="${e(video.id)}" data-step="-1">上一幕</button><button data-ds-action="scene" data-id="${e(video.id)}" data-step="1">下一幕</button></div>`}<p>${e(video.description)}</p>
            <div class="wc-ds-actions"><button data-ds-action="like" data-id="${e(video.id)}" aria-pressed="${!!liked(s, video)}" ${D().busy('like:' + video.id) ? 'disabled' : ''}>${liked(s, video) ? '已点赞' : '点赞'}</button><button data-ds-action="fav" data-id="${e(video.id)}" aria-pressed="${!!account.favs[video.id]}">${account.favs[video.id] ? '已收藏' : '收藏'}</button><button data-ds-action="comments" data-id="${e(video.id)}">评论 ${comments.length}</button><button data-ds-action="invite" data-id="${e(video.id)}">一起看</button><button data-ds-action="share" data-id="${e(video.id)}">转发</button></div>
            ${video.reactions?.length ? `<p class="wc-ds-muted">♡ ${video.reactions.map(actor => e(actor.name)).join('、')} 赞过</p>` : ''}
            ${D().errorHtml('like:' + video.id)}${D().errorHtml('toggle:favs:' + video.id)}${D().errorHtml('toggle:follows:' + actor.key)}${D().errorHtml('view:' + video.id)}${D().errorHtml('submit:video:' + video.id)}${D().pendingHtml('video', video.id)}
            ${detail ? `<div class="wc-ds-thread">${comments.map((comment, index) => `<button type="button" class="wc-ds-comment-row" data-ds-action="reply" data-id="${e(video.id)}" data-index="${index}" aria-label="回复${e(comment.name || comment.actor?.name || '我')}的评论"><span><strong>${e(comment.name || comment.actor?.name || '我')}</strong>${comment.replyTo ? `<small>回复 ${e(typeof comment.replyTo === 'string' ? comment.replyTo : comment.replyTo.name)}</small>` : ''}<span class="wc-ds-comment-text">${e(typeof comment === 'string' ? comment : comment.text)}</span></span></button>`).join('') || '<p class="wc-ds-muted">还没有评论，来聊聊这条作品。</p>'}</div><label class="wc-ds-input-label">${replyTo ? `回复 ${e(replyTo.name)}` : '写评论'} · ${e(publicActor(video).name)}<textarea id="wc-ds-comment" maxlength="1000" placeholder="说说你看到的这一幕"></textarea></label>${replyTo ? '<button data-ds-action="reply-cancel">取消回复</button>' : ''}<button class="wc-ds-primary" data-ds-action="comment-send" data-id="${e(video.id)}" ${D().busy('submit:video:' + video.id) ? 'disabled' : ''}>发送评论</button>` : ''}</article>`;
    }
    function recipientSelect() {
        const identity = publicActor();
        const people = [...(identity.user ? [] : [D().userActor(D().character(identity.charId))]), ...D().characters().filter(char => 'char:' + char.id !== identity.key).map(char => D().characterActor(char))];
        return `<select id="wc-ds-watch-character" aria-label="选择互动对象" ${people.length ? '' : 'disabled'}>${people.map(person => `<option value="${e(person.user ? 'user' : person.charId)}">${e(person.name)}${person.user ? '（user）' : ''}</option>`).join('')}</select>`;
    }
    function watchHtml(watch) {
        const video = find(watch.videoId), people = participants(watch), identity = publicActor(video), partner = people.find(person => person.key !== identity.key);
        if (!video || !partner || !canWatch(watch, identity)) return '<p class="wc-ds-empty">当前身份不在这次一起看中。</p>';
        return `<div class="wc-ds-card"><div class="wc-ds-person">${D().avatar(partner)}<strong>${e(identity.name)}和${e(partner.name)}一起看</strong><small>${watch.status === 'ended' ? '已结束' : '进行中'}</small></div>${poster(video, watch.sceneIndex)}<div class="wc-ds-thread">${watch.messages.map(msg => { const speaker = msg.actor || (msg.isMe ? people[0] : people[1]); return `<p class="${speaker.key === identity.key ? 'is-user' : ''}"><strong>${e(speaker.name)}</strong> ${e(msg.text)}</p>`; }).join('')}</div>${D().pendingHtml('video', video.id)}${D().errorHtml('submit:video:' + video.id)}${watch.status !== 'ended' ? `<label class="wc-ds-input-label">一起聊聊 · ${e(identity.name)}<textarea id="wc-ds-watch-input" maxlength="1000" placeholder="把你的想法告诉 TA"></textarea></label><div class="wc-ds-actions"><button data-ds-action="watch-send" data-id="${e(video.id)}">发送</button><button data-ds-action="watch-next" data-id="${e(video.id)}" ${watch.sceneIndex >= sceneList(video).length - 1 ? 'disabled' : ''}>一起看下一幕</button><button data-ds-action="watch-end" data-id="${e(video.id)}">结束一起看</button></div>` : '<p class="wc-ds-muted">这次共同经历已保留。</p>'}</div>`;
    }
    function perspectiveHtml() {
        const char = viewer();
        return `<button class="wc-ds-perspective" data-ds-action="perspective" aria-haspopup="dialog" aria-expanded="${!!picker}">${D().avatar(char ? { charId: char.id, name: D().name(char) } : D().userActor(source()))}<span><strong>${e(char ? D().name(char) + '的视角' : '我的视角')}</strong><small>${char ? '以 TA 的身份互动 · TA 知道你来过' : e(D().userName(source())) + ' · 我与角色的日常'}</small></span><span aria-hidden="true">⌄</span></button>`;
    }
    function pickerHtml() {
        if (!picker) return '';
        const audience = picker === 'audience';
        return `<div class="wc-ds-picker-backdrop" data-ds-dismiss="picker"><section class="wc-ds-picker" role="dialog" aria-modal="true" aria-labelledby="wc-ds-picker-title"><header><strong id="wc-ds-picker-title">${audience ? '谁能看到这条作品' : '切换视频号视角'}</strong><button data-ds-action="picker-close" aria-label="关闭视角选择">×</button></header>${audience ? '' : `<p>谁的视角，就以谁的身份发布和互动。</p>`}<div class="wc-ds-picker-options">${[...(audience ? [] : [{ id: 'user', name: D().userName(source()), user: true }]), ...D().characters()].map(char => `<button data-ds-action="perspective-select" data-id="${e(char.id)}" aria-pressed="${String(audience ? sourceId : state().perspective) === String(char.id)}">${D().avatar(char.user ? D().userActor(source()) : { charId: char.id, name: D().name(char) })}<span><strong>${e(char.name)}</strong><small>${char.user ? '我的视角' : audience ? '与 TA 和同世界 NPC 分享' : '使用 TA 的视频号身份'}</small></span><span>${String(audience ? sourceId : state().perspective) === String(char.id) ? '✓' : '›'}</span></button>`).join('')}</div>${D().errorHtml('perspective:video')}</section></div>`;
    }
    function render() {
        const s = state(); sourceId = source()?.id || '';
        const perspective = viewer(), identity = publicActor(), account = prefs(s, identity);
        let body;
        if (mode === 'compose') body = `<div class="wc-ds-card"><h3>发布我的作品</h3><button class="wc-ds-audience" data-ds-action="audience">${e(D().name(source()))}的世界可见 ›</button><label class="wc-ds-input-label">${e(identity.name)}<textarea id="wc-ds-post" maxlength="1500" placeholder="分享今天的一幕，角色和朋友也会刷到…"></textarea></label><button class="wc-ds-primary" data-ds-action="post-send" ${D().busy('user-post:video') ? 'disabled' : ''}>发布作品</button>${D().errorHtml('user-post:video')}</div>`;
        else if (mode === 'comments' && find(selected)) body = card(find(selected), true);
        else if ((mode === 'invite' || mode === 'share') && find(selected)) body = `<div class="wc-ds-card"><h3>${mode === 'share' ? '转发给谁？' : '邀请谁一起看？'}</h3>${recipientSelect()}<button class="wc-ds-primary" data-ds-action="${mode === 'share' ? 'share-send' : 'watch-start'}" data-id="${e(selected)}" ${!sourceId || D().busy((mode === 'share' ? 'share:' : 'watch-create:') + selected) ? 'disabled' : ''}>${mode === 'share' ? '发送到私聊' : '邀请一起看'}</button>${D().errorHtml((mode === 'share' ? 'share:' : 'watch-create:') + selected)}</div>`;
        else if (mode === 'watch' && s.watches[selected]) body = watchHtml(s.watches[selected]);
        else if (tab === 'watch') body = Object.values(s.watches).filter(watch => canWatch(watch, identity)).slice().reverse().map(watch => `<button class="wc-ds-session" data-ds-action="watch-open" data-id="${e(watch.id)}"><strong>${e(find(watch.videoId)?.title || '历史作品')}</strong><span>与 ${e(participants(watch).find(person => person.key !== identity.key)?.name || '另一位参与人')} · ${watch.status === 'ended' ? '已结束' : '继续一起看'}</span></button>`).join('') || '<p class="wc-ds-empty">还没有一起看的作品，从作品下方邀请一个角色吧。</p>';
        else {
            const worldId = perspective?.chatConfig?.npcSourceCharId || perspective?.id;
            const visible = video => !perspective || String(video.sourceCharId) === String(worldId) || String(video.sourceCharId) === String(perspective.id) || String(actorOf(video).charId) === String(perspective.id);
            body = s.videos.slice().reverse().filter(video => visible(video) && (tab !== 'mine' || owns(video, identity)) && (tab !== 'following' || account.follows[actorOf(video).key]) && (tab !== 'favourites' || account.favs[video.id])).map(video => card(video)).join('') || `<div class="wc-ds-empty">${tab === 'mine' ? '把你的日常也分享给这个小世界吧。' : tab === 'following' ? '关注角色后，他们的作品会出现在这里。' : tab === 'favourites' ? '收藏过的作品会出现在这里。' : '还没有作品，看看大家最近在做什么。'}</div>`;
        }
        openWechatFeatureScreen(mode === 'watch' ? '一起看' : '视频号', `<section class="wc-ds" data-discover-view="video"><div class="wc-ds-toolbar wc-ds-channel-toolbar">${perspectiveHtml()}<button class="wc-ds-new-post" data-ds-action="compose" aria-label="发布我的作品">＋</button></div>${D().errorHtml('perspective:video')}${D().deliveryHtml('video')}${mode !== 'feed' ? '<button data-ds-action="back">返回作品列表</button>' : `<div class="wc-ds-feed-tools"><nav class="wc-ds-tabs">${[['discover', '发现'], ['following', '关注'], ['favourites', '收藏'], ['watch', '一起看'], ['mine', '我的']].map(([id, label]) => `<button data-ds-action="tab" data-id="${id}" aria-pressed="${tab === id}">${label}</button>`).join('')}</nav><button class="wc-ds-refresh" data-ds-action="publish" aria-label="看看新作品" ${!sourceId || D().busy('publish:video:' + sourceId) ? 'disabled' : ''}>${D().busy('publish:video:' + sourceId) ? '更新中…' : '看看新作品 ↻'}</button></div>`}${D().errorHtml('publish:video:' + sourceId)}${s.notice ? `<p class="wc-ds-muted" role="status">${e(s.notice)}</p>` : ''}<div class="wc-ds-feed">${body}</div>${pickerHtml()}</section>`);
        D().mount('video', render);
        const dismiss = document.querySelector('.wc-ds-picker-backdrop');
        if (dismiss) dismiss.onclick = event => { if (event.target === dismiss) { picker = false; render(); } };
        const dialog = document.querySelector('.wc-ds-picker');
        if (dialog) {
            for (const node of document.querySelector('.wc-ds').children) if (!node.classList.contains('wc-ds-picker-backdrop')) node.inert = true;
            dialog.onkeydown = event => {
                if (event.key === 'Escape') { picker = false; D().refresh(); document.querySelector('[data-ds-action="perspective"]')?.focus(); }
                if (event.key === 'Tab') { const buttons = [...dialog.querySelectorAll('button:not(:disabled)')]; const first = buttons[0], last = buttons.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
            };
            dialog.querySelector('button[aria-pressed="true"]')?.focus({ preventScroll: true });
        }
        D().bind((action, data) => {
            if (action === 'perspective' || action === 'audience') { picker = action === 'audience' ? 'audience' : 'perspective'; D().refresh(); }
            if (action === 'picker-close') { picker = false; D().refresh(); }
            if (action === 'perspective-select') { if (picker === 'audience') { sourceId = data.id; picker = false; D().refresh(); } else void setPerspective(data.id); }
            if (action === 'compose') { mode = 'compose'; D().refresh(); }
            if (action === 'post-send') { const text = document.getElementById('wc-ds-post')?.value.trim(); if (text) void post(text); }
            if (action === 'publish') void publish(sourceId);
            if (action === 'delivery') void D().deliver('video');
            if (action === 'retry') void perform(data.id);
            if (action === 'tab') { tab = data.id; mode = 'feed'; render(); }
            if (action === 'back') { mode = 'feed'; render(); }
            if (action === 'scene') { try { viewWork(data.id, 'scene'); } catch (error) { void D().run('like:' + data.id, () => { throw error; }, () => D().refresh()); return; } const video = find(data.id); scenes.set(data.id, Math.max(0, Math.min(sceneList(video).length - 1, (scenes.get(data.id) || 0) + Number(data.step)))); render(); }
            if (action === 'like') void toggleLike(data.id);
            if (action === 'fav') void toggle('favs', data.id);
            if (action === 'follow') void toggle('follows', data.id);
            if (['comments', 'invite', 'share'].includes(action)) { selected = data.id; mode = action; replyTo = null; void D().run('view:' + data.id, () => { viewWork(data.id); return true; }, () => D().refresh()); }
            if (action === 'reply') { const video = find(data.id); const comment = [...(video?.comments || []), ...(state().comments[data.id] || [])][Number(data.index)]; if (comment) { replyTo = { name: comment.name || comment.actor?.name || '我', actor: comment.actor || null, text: D().clip(comment.text, 600) }; D().refresh(); document.getElementById('wc-ds-comment')?.focus(); } }
            if (action === 'reply-cancel') { replyTo = null; D().refresh(); }
            if (action === 'share-send') void share(data.id, document.getElementById('wc-ds-watch-character')?.value);
            if (action === 'comment-send') { const text = document.getElementById('wc-ds-comment')?.value.trim(); if (text) void submit('comment', data.id, text); }
            if (action === 'watch-start') void startWatch(data.id, document.getElementById('wc-ds-watch-character')?.value);
            if (action === 'watch-open') { selected = data.id; mode = 'watch'; render(); }
            if (action === 'watch-send') { const text = document.getElementById('wc-ds-watch-input')?.value.trim(); if (text) void submit('watch-message', data.id, text); }
            if (action === 'watch-next') void submit('watch-next', data.id, '我们接着看下一幕吧。', (state().watches[selected]?.sceneIndex || 0) + 1);
            if (action === 'watch-end') void submit('watch-end', data.id, '这次先看到这里。');
        });
    }
    function open() { mode = 'feed'; picker = false; replyTo = null; sourceId = viewer()?.id || source()?.id || ''; render(); if (state().outbox.some(item => item.status === 'pending')) void D().deliver('video'); }
    window.ByndChannels = { publish, perform, submit, startWatch, toggleLike, toggle, post, share, setPerspective, viewWork, render, open, state, sceneList };
    window.openWechatChannels = open;
    window.renderWechatChannels = render;
    window.generateWechatChannelVideos = () => publish(source()?.id);
    window.toggleWechatVideoLike = toggleLike;
    window.toggleWechatVideoFav = id => toggle('favs', id);
    window.commentWechatVideo = id => { selected = id; mode = 'comments'; replyTo = null; render(); };
})();
