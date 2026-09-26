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

function normalizeWechatChannelVideos(data) {
    const raw = Array.isArray(data) ? data : (data && (data.videos || data.items)) || [];
    return raw.slice(0, 4).map((item, index) => {
        const title = String(item.title || item.name || '').trim();
        const author = String(item.author || item.creator || 'AI 视频号').trim();
        const description = String(item.description || item.desc || item.copy || '').trim();
        const bullets = Array.isArray(item.bullets) ? item.bullets : (Array.isArray(item.danmaku) ? item.danmaku : []);
        const thumb = String(item.thumbnail || item.cover || item.image || '').trim();
        return {
            id: item.id || ('v_ai_' + Date.now() + '_' + index),
            author,
            title: title || `AI 生成视频 ${index + 1}`,
            description,
            frames: Array.isArray(item.frames) && item.frames.length ? item.frames.slice(0, 3) : (thumb ? [thumb, thumb, thumb] : getWechatGeneratedGradient(title + author + index)),
            bullets: bullets.map(b => String(b).trim()).filter(Boolean).slice(0, 5)
        };
    }).filter(video => video.title);
}

function getWechatVideoState() {
    const state = readWechatStore(WECHAT_VIDEO_STORAGE_KEY, { videos: [], likes: {}, favs: {}, comments: {}, generatedAt: 0, error: '' });
    state.videos = Array.isArray(state.videos) ? state.videos : [];
    state.likes = state.likes || {};
    state.favs = state.favs || {};
    state.comments = state.comments || {};
    state.error = state.error || '';
    return state;
}

function saveWechatVideoState(state) {
    writeWechatStore(WECHAT_VIDEO_STORAGE_KEY, state);
}

function openWechatChannels(force = true) {
    renderWechatChannels({ loading: true });
    if (force || !getWechatVideoState().videos.length) generateWechatChannelVideos();
    else renderWechatChannels();
}

function renderWechatChannels(status = {}) {
    const state = getWechatVideoState();
    const body = status.loading ? `
        <div class="wc-ai-loading"><i class="ri-sparkling-2-line"></i><span>正在生成本次视频号内容...</span></div>
    ` : state.error ? `
        <div class="wc-ai-loading error"><i class="ri-error-warning-line"></i><span>${wcEscapeHtml(state.error)}</span><button onclick="openWechatChannels(true)">重新生成</button></div>
    ` : !state.videos.length ? `
        <div class="wc-ai-loading"><i class="ri-movie-2-line"></i><span>点击右上角生成本次视频号内容</span></div>
    ` : `
        <div class="wc-channel-feed">
            ${state.videos.map(video => `
                <div class="wc-channel-card">
                    <div class="wc-channel-stage">
                        ${video.frames.map(bg => `<div class="wc-channel-frame" style="${getWechatMediaFrameStyle(bg)}"></div>`).join('')}
                        <div class="wc-channel-progress"></div>
                        <div class="wc-channel-danmaku">${(video.bullets || []).map((b, i) => `<span style="--i:${i}">${wcEscapeHtml(b)}</span>`).join('')}</div>
                    </div>
                    <div class="wc-channel-info"><strong>${wcEscapeHtml(video.author)}</strong><span>${wcEscapeHtml(video.title)}</span>${video.description ? `<em>${wcEscapeHtml(video.description)}</em>` : ''}</div>
                    <div class="wc-channel-actions">
                        <button class="${state.likes[video.id] ? 'active' : ''}" onclick="toggleWechatVideoLike('${video.id}')"><i class="ri-heart-3-line"></i>赞</button>
                        <button class="${state.favs[video.id] ? 'active' : ''}" onclick="toggleWechatVideoFav('${video.id}')"><i class="ri-star-line"></i>收藏</button>
                        <button onclick="commentWechatVideo('${video.id}')"><i class="ri-chat-3-line"></i>评论</button>
                        <button onclick="shareWechatText(${quoteWechatJsString('视频号')}, ${quoteWechatJsString('我转发了视频号：' + video.title)})"><i class="ri-share-forward-line"></i>转发</button>
                    </div>
                    ${(state.comments[video.id] || []).length ? `<div class="wc-channel-comments">${state.comments[video.id].map(c => `<div>${wcEscapeHtml(c)}</div>`).join('')}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
    openWechatFeatureScreen('视频号', `
        ${body}
    `, '<i class="ri-refresh-line" onclick="openWechatChannels(true)"></i>');
}

async function generateWechatChannelVideos() {
    const state = getWechatVideoState();
    state.error = '';
    saveWechatVideoState(state);
    const result = await callChatApi([
        { role: 'system', content: '你是微信视频号内容生成器。只输出 JSON 数组，不要解释。每条包含 author、title、description、bullets。bullets 是 3-5 条短弹幕。内容要像真实视频号刷到的，不要营销模板。' },
        { role: 'user', content: `生成 3 条彼此不同的视频号内容。本次随机种子：${Date.now()}。` }
    ], { usageFeature: 'discover' });
    const parsed = result.ok ? parseWechatAiJsonPayload(result.content) : null;
    const videos = parsed ? normalizeWechatChannelVideos(parsed) : [];
    if (!result.ok || !videos.length) {
        state.error = result.ok ? 'AI 返回格式无法解析，点右上角再生成一次。' : result.error;
        state.videos = [];
    } else {
        state.videos = videos;
        state.generatedAt = Date.now();
        state.error = '';
    }
    saveWechatVideoState(state);
    renderWechatChannels();
}

function toggleWechatVideoLike(id) {
    const state = getWechatVideoState();
    state.likes[id] = !state.likes[id];
    saveWechatVideoState(state);
    renderWechatChannels();
}

function toggleWechatVideoFav(id) {
    const state = getWechatVideoState();
    state.favs[id] = !state.favs[id];
    saveWechatVideoState(state);
    renderWechatChannels();
}

function commentWechatVideo(id) {
    const text = prompt('写一条评论');
    if (!text || !text.trim()) return;
    const state = getWechatVideoState();
    state.comments[id] = state.comments[id] || [];
    state.comments[id].push(text.trim());
    saveWechatVideoState(state);
    renderWechatChannels();
}

