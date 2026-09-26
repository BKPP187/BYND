function formatWechatRelativeTime(ts) {
    const diff = Math.max(0, Date.now() - (Number(ts) || Date.now()));
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min}分钟前`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}小时前`;
    return `${Math.floor(hour / 24)}天前`;
}

function getWechatMomentStore() {
    const store = readWechatStore(WECHAT_MOMENTS_STORAGE_KEY, { posts: [] });
    if (!Array.isArray(store.posts)) store.posts = [];
    return store;
}

function saveWechatMomentStore(store) {
    writeWechatStore(WECHAT_MOMENTS_STORAGE_KEY, store);
}

function isWechatOldMomentTemplateComment(text) {
    const value = String(text || '').trim();
    return [
        '早上看到这个，还挺有精神的。',
        '这个时间发出来刚刚好，我看到了。',
        '晚上刷到这个，感觉很适合慢慢聊。'
    ].includes(value);
}

function migrateWechatMomentTemplateComments(store) {
    if (!store || !Array.isArray(store.posts)) return false;
    let changed = false;
    store.posts.forEach(post => {
        if (!Array.isArray(post.comments)) return;
        const removed = [];
        post.comments = post.comments.filter(comment => {
            if (!comment) return false;
            if (comment.user) return true;
            if (!comment.charId) return true;
            if (comment.generatedBy === 'api' && !isWechatOldMomentTemplateComment(comment.text)) return true;
            if (comment.charId) removed.push(comment.charId);
            changed = true;
            return false;
        });
        if (removed.length) {
            post.pending = Array.isArray(post.pending) ? post.pending : [];
            removed.forEach((charId, index) => {
                const exists = post.pending.some(task => task && task.charId === charId && task.type === 'comment' && !task.done);
                if (exists) return;
                post.pending.push({
                    id: 'mqt_retry_' + (post.id || Date.now()) + '_' + charId + '_' + index,
                    charId,
                    type: 'comment',
                    dueAt: Date.now(),
                    done: false,
                    apiOnly: true
                });
            });
        }
    });
    return changed;
}

function scheduleWechatMomentEngagement(post) {
    const chars = (window.myCharacters || []).filter(char => char && !char.isGroupChat).slice(0, 6);
    const needsAsk = /[?？]|怎么|为什么|为啥|怎么办|不懂|纠结/.test(post.text || '');
    post.pending = chars.map((char, index) => ({
        id: 'mqt_' + (post.id || Date.now()) + '_' + char.id + '_' + index,
        charId: char.id,
        type: needsAsk && index === 0 ? 'ask' : 'comment',
        dueAt: Date.now() + 45000 + index * 35000 + Math.floor(Math.random() * 45000),
        done: false
    }));
}

function isWechatMomentsScreenOpen() {
    const screen = document.getElementById('wc-feature-screen');
    const title = document.getElementById('wc-feature-title');
    return !!screen && screen.classList.contains('active') && title && title.textContent === '朋友圈';
}

function normalizeWechatMomentGeneratedComment(value) {
    const parsed = parseWechatJsonObject(value);
    let text = parsed && typeof parsed === 'object'
        ? (parsed.comment || parsed.text || parsed.reply || '')
        : String(value || '');
    text = cleanWechatVisibleContent(text)
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\|\|\|/g, ' ')
        .replace(/^\s*(?:朋友圈)?评论\s*[：:]\s*/i, '')
        .replace(/^\s*["'“”‘’]+|["'“”‘’]+\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return '';
    const firstLine = text.split(/\r?\n/).map(item => item.trim()).filter(Boolean)[0] || '';
    return firstLine.length > 44 ? firstLine.slice(0, 43) + '…' : firstLine;
}

async function chooseWechatMomentEngagement(post, char, type) {
    return await window.ByndJev?.choose('momentEngagement', {
        character:{ name:getWechatCharDisplayName(char), persona:String(char.description || char.personality || '').slice(0,240) },
        post:{ text:stripWechatPromptText(post?.text || '',220), imageCount:Array.isArray(post?.images) ? post.images.length : 0, ageMinutes:Math.max(0,Math.floor((Date.now()-Number(post?.createdAt || Date.now()))/60000)) },
        interaction:type,
        recentMessages:(char.history || []).slice(-4).map(msg => ({ from:msg.isMe ? 'user' : 'char', text:stripWechatPromptText(msg.content || '',70) }))
    }, 'Would this character naturally interact with this user social post now? Silence is normal; do not force a reaction.', { engage:'A natural reaction or question fits their personality and relationship.', silence:'This character would read but not respond.' });
}

function finishWechatMomentTaskSilently(task) {
    task.done = true;
    task.generating = false;
    task.generatedAt = Date.now();
    delete task.error;
}

async function generateWechatMomentPersonaComment(post, char, usedTexts = new Set()) {
    if (typeof callChatApi !== 'function') return { silence:false, text:'' };
    const profile = getUserProfile();
    const postText = stripWechatPromptText(post?.text || '', 180) || (post?.images?.length ? '[图片朋友圈]' : '[空动态]');
    const imageHint = Array.isArray(post?.images) && post.images.length ? `含 ${post.images.length} 张图片` : '无图片';
    const charName = getWechatCharDisplayName(char);
    const userName = profile.name || '用户';
    try {
        const result = await callChatApi([
            {
                role: 'system',
                content: typeof buildSystemPrompt === 'function'
                    ? buildSystemPrompt(char)
                    : `你是「${charName}」。保持角色卡、人设、世界书和最近聊天关系。`
            },
            {
                role: 'system',
                content: `你正在浏览「${userName}」刚发的微信朋友圈。你可以不评论；保持「${charName}」的人设、口吻、关系距离和世界书，不要和其他角色同质化。只返回 JSON：{"action":"comment","text":"8-36字的自然评论"} 或 {"action":"silence"}。不要替用户说话或行动。`
            },
            {
                role: 'user',
                content: `朋友圈内容：${postText}\n图片：${imageHint}\n发布时间：${formatWechatRelativeTime(post?.createdAt)}\n\n世界书：\n${buildWechatWorldBookPrompt(char, 12)}\n\n最近聊天：\n${buildWechatRecentHistoryForPrompt(char, 10)}`
            }
        ], { background: true, usageFeature: 'moment', usageChar: char });
        if (!result?.ok) return getWechatMomentTaskFailure(result);
        const parsed = parseWechatJsonObject(result.content);
        if (parsed?.action === 'silence') return { silence:true, text:'' };
        const text = result && result.ok ? normalizeWechatMomentGeneratedComment(result.content) : '';
        if (text && !usedTexts.has(text) && !isWechatOldMomentTemplateComment(text)) return { silence:false, text };
    } catch (e) {
        console.warn('moment persona comment failed:', e);
    }
    return { silence:false, text:'' };
}

function appendWechatMomentCommentToStore(store, post, task, char, text, failure = {}) {
    post.comments = post.comments || [];
    const safeText = String(text || '').trim();
    if (!safeText) return backoffWechatMomentTask(task, { error: 'API 未生成朋友圈评论', ...failure });
    post.comments.push({
        id: 'mc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        charId: char.id,
        name: (char.chatConfig && char.chatConfig.nickname) || char.name,
        avatar: char.avatar || DEFAULT_AVATAR,
        text: safeText,
        generatedBy: 'api',
        createdAt: Date.now()
    });
    task.done = true;
    task.generating = false;
    task.generatedAt = Date.now();
    delete task.error;
    return true;
}

const WECHAT_MOMENT_TASK_MAX_ATTEMPTS = 4;

function getWechatMomentTaskFailure(result) {
    return { silence: false, text: '', error: String(result?.error || 'API 调用失败'), deferred: !!result?.deferred, retryAfterMs: Number(result?.retryAfterMs) || 0 };
}

// Failed moment tasks back off exponentially and stop after a few sent attempts; a deferred request was never sent, so it only waits.
function backoffWechatMomentTask(task, failure = {}) {
    const retryAfterMs = Math.max(0, Number(failure.retryAfterMs) || 0);
    task.generating = false;
    task.error = String(failure.error || 'API 未生成朋友圈互动').slice(0, 160);
    if (failure.deferred) {
        task.dueAt = Date.now() + Math.max(retryAfterMs, 60000);
        return false;
    }
    task.attempts = Number(task.attempts || 0) + 1;
    if (task.attempts >= WECHAT_MOMENT_TASK_MAX_ATTEMPTS) {
        task.done = true;
        task.failed = true;
        return false;
    }
    task.dueAt = Date.now() + Math.max(retryAfterMs, 5 * 60000 * 2 ** (task.attempts - 1));
    return false;
}

// Jobs await the API; re-read the store afterwards so a stale snapshot never overwrites other posts or resurrects deleted ones.
function commitWechatMomentTask(postId, taskId, apply) {
    const store = getWechatMomentStore();
    const post = store.posts.find(item => item.id === postId);
    const task = post && (post.pending || []).find(item => item.id === taskId);
    if (!post || !task || task.done) return false;
    apply(post, task, store);
    saveWechatMomentStore(store);
    return true;
}

function queueWechatMomentCommentGeneration(postId, taskId) {
    window._wechatMomentCommentJobs = window._wechatMomentCommentJobs || new Set();
    const jobKey = `${postId}:${taskId}`;
    if (window._wechatMomentCommentJobs.has(jobKey)) return;
    window._wechatMomentCommentJobs.add(jobKey);
    (async () => {
        try {
            const store = getWechatMomentStore();
            const post = store.posts.find(item => item.id === postId);
            const task = post && (post.pending || []).find(item => item.id === taskId);
            const char = task && (window.myCharacters || []).find(c => c.id === task.charId);
            if (!post || !task || !char || task.done) return;
            if (await chooseWechatMomentEngagement(post,char,'comment') === 'silence') {
                commitWechatMomentTask(postId, taskId, (latestPost, latestTask) => finishWechatMomentTaskSilently(latestTask));
                return;
            }
            const used = new Set((post.comments || []).map(comment => String(comment && comment.text || '').trim()).filter(Boolean));
            const result = await generateWechatMomentPersonaComment(post, char, used);
            const saved = commitWechatMomentTask(postId, taskId, (latestPost, latestTask, latestStore) => {
                if (result.silence) finishWechatMomentTaskSilently(latestTask);
                else appendWechatMomentCommentToStore(latestStore, latestPost, latestTask, char, result.text, result);
            });
            if (!saved) return;
            saveCharactersToStorage();
            if (isWechatMomentsScreenOpen()) renderWechatMoments();
        } finally {
            window._wechatMomentCommentJobs.delete(jobKey);
            setTimeout(processWechatMomentQueue, 0);
        }
    })();
}

function normalizeWechatMomentGeneratedChat(value) {
    const parsed = parseWechatJsonObject(value);
    let text = parsed && typeof parsed === 'object'
        ? (parsed.message || parsed.text || parsed.reply || '')
        : String(value || '');
    text = cleanWechatVisibleContent(text)
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\|\|\|/g, ' ')
        .replace(/^\s*(?:询问|消息|回复)\s*[：:]\s*/i, '')
        .replace(/^\s*["'“”‘’]+|["'“”‘’]+\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > 90 ? text.slice(0, 89) + '…' : text;
}

async function generateWechatMomentAskMessage(post, char) {
    if (typeof callChatApi !== 'function') return { silence:false, text:'' };
    const profile = getUserProfile();
    const postText = stripWechatPromptText(post?.text || '', 220) || (post?.images?.length ? '[图片朋友圈]' : '[空动态]');
    try {
        const result = await callChatApi([
            {
                role: 'system',
                content: typeof buildSystemPrompt === 'function'
                    ? buildSystemPrompt(char)
                    : `你是「${getWechatCharDisplayName(char)}」。保持角色卡、人设、世界书和最近聊天关系。`
            },
            {
                role: 'system',
                content: `你看到「${profile.name || '用户'}」刚发的朋友圈。你可以选择不私聊追问。只返回 JSON：{"action":"ask","text":"12-60字自然消息"} 或 {"action":"silence"}。必须按人设、关系和世界书说话；不要替用户说话或行动。`
            },
            {
                role: 'user',
                content: `朋友圈内容：${postText}\n图片数量：${Array.isArray(post?.images) ? post.images.length : 0}\n\n世界书：\n${buildWechatWorldBookPrompt(char, 12)}\n\n最近聊天：\n${buildWechatRecentHistoryForPrompt(char, 10)}`
            }
        ], { background: true, usageFeature: 'moment', usageChar: char });
        if (!result?.ok) return getWechatMomentTaskFailure(result);
        const parsed = parseWechatJsonObject(result.content);
        if (parsed?.action === 'silence') return { silence:true, text:'' };
        return { silence:false, text:normalizeWechatMomentGeneratedChat(result.content) };
    } catch (e) {
        console.warn('moment ask generation failed:', e);
        return { silence:false, text:'' };
    }
}

function appendWechatMomentAskToChar(char, post, task, text, failure = {}) {
    const safeText = String(text || '').trim();
    if (!safeText) return backoffWechatMomentTask(task, { error: 'API 未生成朋友圈询问', ...failure });
    if (!char.history) char.history = [];
    char.history.push({
        type: 'share_card',
        isMe: false,
        card: {
            type: 'moment',
            title: `${post.userName || '我'} 的朋友圈`,
            text: post.text || '[图片朋友圈]',
            source: '朋友圈',
            images: Array.isArray(post.images) ? post.images.filter(Boolean).slice(0, 9) : []
        },
        timestamp: createMessageTimestamp()
    });
    char.history.push({
        type: 'text',
        isMe: false,
        content: safeText,
        timestamp: createMessageTimestamp()
    });
    task.done = true;
    task.generating = false;
    task.generatedAt = Date.now();
    delete task.error;
    if (window.currentChatCharId === char.id) refreshChatView(char);
    renderChatList();
    return true;
}

function queueWechatMomentAskGeneration(postId, taskId) {
    window._wechatMomentAskJobs = window._wechatMomentAskJobs || new Set();
    const jobKey = `${postId}:${taskId}`;
    if (window._wechatMomentAskJobs.has(jobKey)) return;
    window._wechatMomentAskJobs.add(jobKey);
    (async () => {
        try {
            const store = getWechatMomentStore();
            const post = store.posts.find(item => item.id === postId);
            const task = post && (post.pending || []).find(item => item.id === taskId);
            const char = task && (window.myCharacters || []).find(c => c.id === task.charId);
            if (!post || !task || !char || task.done) return;
            if (await chooseWechatMomentEngagement(post,char,'ask') === 'silence') {
                commitWechatMomentTask(postId, taskId, (latestPost, latestTask) => finishWechatMomentTaskSilently(latestTask));
                return;
            }
            const result = await generateWechatMomentAskMessage(post, char);
            const saved = commitWechatMomentTask(postId, taskId, (latestPost, latestTask) => {
                if (result.silence) finishWechatMomentTaskSilently(latestTask);
                else appendWechatMomentAskToChar(char, latestPost, latestTask, result.text, result);
            });
            if (!saved) return;
            saveCharactersToStorage();
            if (isWechatMomentsScreenOpen()) renderWechatMoments();
        } finally {
            window._wechatMomentAskJobs.delete(jobKey);
            setTimeout(processWechatMomentQueue, 0);
        }
    })();
}

function processWechatMomentQueue() {
    const store = getWechatMomentStore();
    let changed = migrateWechatMomentTemplateComments(store);
    // The relay rejects request bursts: start at most one job per scan; each finished job rescans for the next due task.
    let started = !!(window._wechatMomentCommentJobs?.size || window._wechatMomentAskJobs?.size);
    store.posts.forEach(post => {
        (post.pending || []).forEach(task => {
            if (task.done || task.dueAt > Date.now()) return;
            if (!task.id) {
                task.id = 'mqt_' + (post.id || Date.now()) + '_' + (task.charId || 'char') + '_' + Math.random().toString(36).slice(2, 7);
                changed = true;
            }
            const char = (window.myCharacters || []).find(c => c.id === task.charId);
            if (!char || char.isGroupChat) {
                task.done = true;
                changed = true;
                return;
            }
            if (task.generating && (!task.startedAt || Date.now() - Number(task.startedAt) > 120000)) {
                task.generating = false;
                task.error = task.error || '生成超时，等待重试';
                changed = true;
            }
            if (task.generating || started) return;
            task.generating = true;
            task.startedAt = Date.now();
            started = true;
            if (task.type === 'ask') queueWechatMomentAskGeneration(post.id, task.id);
            else queueWechatMomentCommentGeneration(post.id, task.id);
            changed = true;
        });
    });
    if (changed) {
        saveWechatMomentStore(store);
        saveCharactersToStorage();
    }
}

function openWechatMoments(focusPostId = '') {
    (window.myCharacters || []).filter(char => char && !char.isGroupChat).forEach(char => getWechatCharMomentPosts(char));
    processWechatMomentQueue();
    window._wechatMomentDraftImages = window._wechatMomentDraftImages || [];
    renderWechatMoments(focusPostId);
}

function renderWechatMoments(focusPostId = '') {
    const store = getWechatMomentStore();
    const profile = getUserProfile();
    const posts = store.posts.slice().sort((a, b) => b.createdAt - a.createdAt);
    const coverImage = profile.momentCover || '';
    openWechatFeatureScreen('朋友圈', `
        <div class="wc-moment-cover" style="${getWechatMomentCoverStyle(coverImage, profile.name || '我')}" onclick="handleWechatMomentCoverClick()" ondblclick="handleWechatMomentCoverDoubleClick()">
            <div class="wc-moment-cover-name">${wcEscapeHtml(profile.name || '我')}</div>
            <img class="wc-moment-cover-avatar" src="${profile.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
        </div>
        <div class="wc-moment-feed">
            ${posts.length ? posts.map(renderWechatMomentPost).join('') : '<div class="wc-discover-empty">还没有朋友圈动态</div>'}
        </div>
    `, '<i class="ri-camera-line" onclick="openWechatMomentCameraSheet()"></i>');
    if (focusPostId) {
        setTimeout(() => {
            const target = Array.from(document.querySelectorAll('.wc-moment-post')).find(el => el.dataset.postId === String(focusPostId));
            if (!target) return;
            target.scrollIntoView({ block: 'start', behavior: 'smooth' });
            target.classList.add('focus');
            setTimeout(() => target.classList.remove('focus'), 1400);
        }, 80);
    }
}

function renderWechatMomentPost(post) {
    const comments = post.comments || [];
    const waiting = (post.pending || []).filter(t => !t.done).length;
    const postId = quoteWechatJsString(post.id);
    return `
        <div class="wc-moment-post" data-post-id="${wcEscapeHtml(post.id || '')}">
            <div class="wc-moment-avatar"><img src="${post.userAvatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'"></div>
            <div class="wc-moment-content">
                <div class="wc-moment-name">${wcEscapeHtml(post.userName || '我')}</div>
                ${post.text ? `<div class="wc-moment-text">${wcEscapeHtml(post.text).replace(/\n/g, '<br>')}</div>` : ''}
                ${(post.images || []).length ? `<div class="wc-moment-grid">${post.images.map(renderWechatMomentMedia).join('')}</div>` : ''}
                <div class="wc-moment-meta">
                    <span>${formatWechatRelativeTime(post.createdAt)}${post.location ? ` · ${wcEscapeHtml(post.location)}` : ''}${post.visibility === 'private' ? ' · 私密' : ''}</span>
                    <div class="wc-moment-meta-actions">
                        <button onclick="collectWechatMoment(${postId})">收藏</button>
                        <button onclick="shareWechatMomentPost(${postId})">转发</button>
                        ${post.charId ? '' : `<button onclick="editWechatMoment(${postId})">编辑</button>`}
                        <button onclick="deleteWechatMoment(${postId})">删除</button>
                    </div>
                </div>
                ${waiting ? `<div class="wc-moment-waiting"><i class="ri-time-line"></i>${waiting} 位好友稍后可能留言</div>` : ''}
                ${comments.length ? `<div class="wc-moment-comments">${comments.map(comment => renderWechatMomentComment(post.id, comment)).join('')}</div>` : ''}
            </div>
        </div>
    `;
}

function renderWechatMomentComment(postId, comment) {
    const postArg = quoteWechatJsString(postId);
    const commentArg = quoteWechatJsString(comment.id || '');
    const replyTo = comment.replyTo ? `<em>回复 ${wcEscapeHtml(comment.replyTo)}</em>` : '';
    return `
        <div class="wc-moment-comment">
            <div><strong>${wcEscapeHtml(comment.name || '好友')}</strong>${replyTo}：${wcEscapeHtml(comment.text || '')}</div>
            <button onclick="replyWechatMomentComment(${postArg}, ${commentArg})">回复</button>
        </div>
    `;
}

function renderWechatMomentMedia(src) {
    const safeSrc = wcEscapeHtml(src || '');
    if (/^data:video\//i.test(src || '') || /\.(mp4|webm|mov)(\?|#|$)/i.test(src || '')) {
        return `<video src="${safeSrc}" controls muted playsinline onerror="this.style.opacity='0.35'"></video>`;
    }
    return `<img src="${safeSrc}" onerror="this.style.opacity='0.35'">`;
}

function renderWechatMomentDraftPreview() {
    const box = document.getElementById('wc-moment-draft-preview');
    if (!box) return;
    const images = window._wechatMomentDraftImages || [];
    box.innerHTML = images.map((src, index) => `<div class="wc-moment-draft-img">${renderWechatMomentMedia(src)}<button onclick="removeWechatMomentDraftImage(${index})"><i class="ri-close-line"></i></button></div>`).join('');
}

function handleWechatMomentCoverClick() {
    clearTimeout(window._wechatMomentCoverClickTimer);
    window._wechatMomentCoverClickTimer = setTimeout(() => openWechatMomentCoverSheet(), 220);
}

function handleWechatMomentCoverDoubleClick() {
    clearTimeout(window._wechatMomentCoverClickTimer);
    openNewWechatMomentTextComposer();
}

function openWechatMomentCoverSheet() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="promptWechatMomentCoverUrl()"><i class="ri-link"></i><span>使用图床 URL 更换封面</span></div>
        <div class="wc-sheet-item" onclick="document.getElementById('wc-moment-cover-file').click()"><i class="ri-image-add-line"></i><span>从本地上传封面</span><input id="wc-moment-cover-file" type="file" accept="image/*" style="display:none" onchange="uploadWechatMomentCover(this)"></div>
    `);
}

function promptWechatMomentCoverUrl() {
    hideActionSheet();
    const old = getUserProfile().momentCover || '';
    const url = prompt('输入朋友圈封面图床 URL', old);
    if (!url || !url.trim()) return;
    saveWechatMomentCover(url.trim());
}

function uploadWechatMomentCover(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => saveWechatMomentCover(e.target.result);
    reader.readAsDataURL(file);
    input.value = '';
    hideActionSheet();
}

function saveWechatMomentCover(src) {
    const profile = getUserProfile();
    profile.momentCover = src;
    saveUserProfile(profile);
    renderWechatMoments();
}

function openWechatMomentCameraSheet() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="openNewWechatMomentTextComposer()"><i class="ri-edit-2-line"></i><span>发表文字</span></div>
        <div class="wc-sheet-item" onclick="document.getElementById('wc-moment-camera-file').click()"><i class="ri-camera-line"></i><span>拍摄（照片或者视频）</span><input id="wc-moment-camera-file" type="file" accept="image/*,video/*" capture style="display:none" onchange="handleWechatMomentCameraPick(this)"></div>
        <div class="wc-sheet-item" onclick="document.getElementById('wc-moment-album-file').click()"><i class="ri-image-line"></i><span>从手机相册选择</span><input id="wc-moment-album-file" type="file" accept="image/*,video/*" multiple style="display:none" onchange="handleWechatMomentCameraPick(this)"></div>
    `);
}

function handleWechatMomentCameraPick(input) {
    window._wechatMomentDraftImages = [];
    window._wechatEditingMomentId = '';
    handleWechatMomentImages(input);
    hideActionSheet();
    openWechatMomentTextComposer();
}

function openNewWechatMomentTextComposer() {
    window._wechatMomentDraftImages = [];
    window._wechatEditingMomentId = '';
    openWechatMomentTextComposer();
}

function openWechatMomentTextComposer(postId = '') {
    hideActionSheet();
    const store = getWechatMomentStore();
    const editingPost = postId ? store.posts.find(post => post.id === postId && !post.charId) : null;
    window._wechatEditingMomentId = editingPost ? editingPost.id : '';
    window._wechatMomentDraftImages = editingPost ? (editingPost.images || []).slice() : (window._wechatMomentDraftImages || []);
    const title = editingPost ? '编辑朋友圈' : '发表文字';
    const actionText = editingPost ? '保存' : '发表';
    openWechatFeatureScreen(title, `
        <div class="wc-moment-compose-page">
            <textarea id="wc-moment-text" class="wc-moment-compose-text" placeholder="这一刻的想法..." maxlength="500">${wcEscapeHtml(editingPost?.text || '')}</textarea>
            <div id="wc-moment-draft-preview" class="wc-moment-grid"></div>
            <div class="wc-moment-compose-row" onclick="promptWechatMomentLocation()">
                <i class="ri-map-pin-line"></i><span>所在位置</span><em id="wc-moment-location-text" data-value="${wcEscapeHtml(editingPost?.location || '')}">${editingPost?.location ? wcEscapeHtml(editingPost.location) : '不显示位置'}</em>
            </div>
            <div class="wc-moment-compose-row">
                <i class="ri-eye-line"></i><span>谁可以看</span>
                <div class="wc-moment-visibility">
                    <button type="button" class="${editingPost?.visibility === 'private' ? '' : 'active'}" data-value="public" onclick="setWechatMomentVisibility('public')">公开</button>
                    <button type="button" class="${editingPost?.visibility === 'private' ? 'active' : ''}" data-value="private" onclick="setWechatMomentVisibility('private')">私密</button>
                </div>
                <input type="hidden" id="wc-moment-visibility-value" value="${editingPost?.visibility === 'private' ? 'private' : 'public'}">
            </div>
            <label class="wc-moment-add-media"><i class="ri-image-add-line"></i><span>添加照片/视频</span><input type="file" accept="image/*,video/*" multiple onchange="handleWechatMomentImages(this)"></label>
        </div>
    `, `<button type="button" class="wc-feature-publish-btn" onclick="publishWechatMoment()">${actionText}</button>`);
    setWechatFeatureLeftText('取消', 'openWechatMoments()');
    renderWechatMomentDraftPreview();
}

function promptWechatMomentLocation() {
    const textEl = document.getElementById('wc-moment-location-text');
    const old = textEl && textEl.dataset.value ? textEl.dataset.value : '';
    const value = prompt('输入所在位置', old);
    if (!textEl) return;
    textEl.dataset.value = (value || '').trim();
    textEl.textContent = textEl.dataset.value || '不显示位置';
}

function setWechatMomentVisibility(value) {
    const safe = value === 'private' ? 'private' : 'public';
    const input = document.getElementById('wc-moment-visibility-value');
    if (input) input.value = safe;
    document.querySelectorAll('.wc-moment-visibility button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === safe);
    });
}

function handleWechatMomentImages(input) {
    const files = Array.from(input.files || []).slice(0, 9);
    window._wechatMomentDraftImages = window._wechatMomentDraftImages || [];
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            window._wechatMomentDraftImages.push(e.target.result);
            renderWechatMomentDraftPreview();
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function removeWechatMomentDraftImage(index) {
    window._wechatMomentDraftImages = window._wechatMomentDraftImages || [];
    window._wechatMomentDraftImages.splice(index, 1);
    renderWechatMomentDraftPreview();
}

function publishWechatMoment() {
    const text = (document.getElementById('wc-moment-text')?.value || '').trim();
    const images = (window._wechatMomentDraftImages || []).slice();
    if (!text && images.length === 0) return;
    const profile = getUserProfile();
    const visibility = document.getElementById('wc-moment-visibility-value')?.value === 'private' ? 'private' : 'public';
    const store = getWechatMomentStore();
    const editingId = window._wechatEditingMomentId || '';
    // Character-authored posts are theirs; the user's composer can only edit the user's own posts.
    const editingPost = editingId ? store.posts.find(item => item.id === editingId && !item.charId) : null;
    if (editingPost) {
        editingPost.text = text;
        editingPost.images = images;
        editingPost.userName = profile.name || editingPost.userName || '我';
        editingPost.userAvatar = profile.avatar || editingPost.userAvatar || DEFAULT_AVATAR;
        editingPost.location = (document.getElementById('wc-moment-location-text')?.dataset.value || '').trim();
        editingPost.visibility = visibility;
        editingPost.updatedAt = Date.now();
        editingPost.comments = Array.isArray(editingPost.comments) ? editingPost.comments : [];
        editingPost.pending = visibility === 'private' ? [] : (Array.isArray(editingPost.pending) ? editingPost.pending : []);
        saveWechatMomentStore(store);
        window._wechatMomentDraftImages = [];
        window._wechatEditingMomentId = '';
        renderWechatMoments();
        return;
    }
    const post = {
        id: 'mom_' + Date.now(),
        text,
        images,
        userName: profile.name || '我',
        userAvatar: profile.avatar || DEFAULT_AVATAR,
        location: (document.getElementById('wc-moment-location-text')?.dataset.value || '').trim(),
        visibility,
        comments: [],
        pending: [],
        createdAt: Date.now()
    };
    if (visibility !== 'private') scheduleWechatMomentEngagement(post);
    store.posts.push(post);
    saveWechatMomentStore(store);
    window._wechatMomentDraftImages = [];
    window._wechatEditingMomentId = '';
    renderWechatMoments();
}

function editWechatMoment(id) {
    openWechatMomentTextComposer(id);
}

function shareWechatMomentPost(id) {
    const store = getWechatMomentStore();
    const post = store.posts.find(item => item.id === id);
    if (!post) return;
    shareWechatText('朋友圈', `${post.userName || '我'} 的朋友圈：${post.text || '[图片朋友圈]'}`, {
        type: 'moment',
        title: `${post.userName || '我'} 的朋友圈`,
        text: post.text || '[图片朋友圈]',
        source: '朋友圈',
        images: Array.isArray(post.images) ? post.images.filter(Boolean) : []
    });
}

function replyWechatMomentComment(postId, commentId) {
    const store = getWechatMomentStore();
    const post = store.posts.find(item => item.id === postId);
    if (!post) return;
    const comments = Array.isArray(post.comments) ? post.comments : [];
    const target = comments.find(item => item.id === commentId) || comments[0];
    const value = prompt(target ? `回复 ${target.name || '好友'}` : '回复朋友圈', '');
    if (!value || !value.trim()) return;
    const profile = getUserProfile();
    comments.push({
        id: 'mc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: profile.name || '我',
        avatar: profile.avatar || DEFAULT_AVATAR,
        text: value.trim().slice(0, 240),
        replyTo: target?.name || '',
        user: true,
        createdAt: Date.now()
    });
    post.comments = comments;
    saveWechatMomentStore(store);
    renderWechatMoments();
}

function deleteWechatMoment(id) {
    if (!confirm('确定删除这条朋友圈吗？')) return;
    const store = getWechatMomentStore();
    const removed = store.posts.find(post => post.id === id);
    store.posts = store.posts.filter(post => post.id !== id);
    saveWechatMomentStore(store);
    const author = removed?.charId && (window.myCharacters || []).find(char => char.id === removed.charId);
    if (author && Array.isArray(author.chatConfig?.aiMoments)) {
        author.chatConfig.aiMoments = author.chatConfig.aiMoments.filter(item => item.id !== id);
        saveCharactersToStorage();
    }
    renderWechatMoments();
}

