const WECHAT_LIVE_CATEGORIES = ['美妆', '电子产品', '穿搭', '家居', '美食', '游戏'];

function getWechatLiveState() {
    const state = readWechatStore(WECHAT_LIVE_STORAGE_KEY, { rooms: {}, error: '' });
    state.rooms = state.rooms || {};
    state.error = state.error || '';
    return state;
}

function saveWechatLiveState(state) {
    writeWechatStore(WECHAT_LIVE_STORAGE_KEY, state);
}

function normalizeWechatLiveRooms(data, category) {
    const raw = Array.isArray(data) ? data : (data && (data.rooms || data.items || data.lives)) || [];
    return raw.slice(0, 4).map((item, index) => {
        const title = String(item.title || item.name || '').trim();
        const host = String(item.host || item.anchor || item.author || 'AI 主播').trim();
        const lines = Array.isArray(item.lines) ? item.lines : (Array.isArray(item.chat) ? item.chat : []);
        const cover = String(item.cover || item.thumbnail || item.image || '').trim();
        return {
            id: item.id || ('live_ai_' + Date.now() + '_' + index),
            title: title || `${category}直播 ${index + 1}`,
            host,
            category,
            viewers: String(item.viewers || (1.1 + Math.random() * 3).toFixed(1) + '万人观看'),
            lines: lines.map(line => String(line).trim()).filter(Boolean).slice(0, 4),
            cover,
            gradient: getWechatGeneratedGradient(title + host + category)[0]
        };
    }).filter(room => room.title);
}

function openWechatLive(category = '美妆', force = true) {
    renderWechatLive(category, { loading: true });
    if (force || !(getWechatLiveState().rooms[category] || []).length) generateWechatLiveRooms(category);
    else renderWechatLive(category);
}

function renderWechatLive(category = '美妆', status = {}) {
    const state = getWechatLiveState();
    const rooms = state.rooms[category] || [];
    const body = status.loading ? `
        <div class="wc-ai-loading"><i class="ri-broadcast-line"></i><span>正在生成 ${wcEscapeHtml(category)} 直播间...</span></div>
    ` : state.error ? `
        <div class="wc-ai-loading error"><i class="ri-error-warning-line"></i><span>${wcEscapeHtml(state.error)}</span><button onclick="openWechatLive(${quoteWechatJsString(category)}, true)">重新生成</button></div>
    ` : !rooms.length ? `
        <div class="wc-ai-loading"><i class="ri-live-line"></i><span>点击右上角生成直播间</span></div>
    ` : `
        <div class="wc-live-grid">
            ${rooms.map(room => `
                <div class="wc-live-card">
                    <div class="wc-live-cover" style="${getWechatMediaFrameStyle(room.cover || room.gradient)}"><span>LIVE</span><strong>${wcEscapeHtml(room.title)}</strong></div>
                    <div class="wc-live-meta"><span>${wcEscapeHtml(room.host)} · ${wcEscapeHtml(room.category)}</span><b>${wcEscapeHtml(room.viewers)}</b></div>
                    <div class="wc-live-chat">${(room.lines || []).map(line => `<span>${wcEscapeHtml(line)}</span>`).join('')}</div>
                    <div class="wc-live-actions">
                        <button onclick="shareWechatText(${quoteWechatJsString('直播')}, ${quoteWechatJsString('我转发了直播间：' + room.title)})">转发</button>
                        <button onclick="openWechatShop(${quoteWechatJsString(category)})">逛同款</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    openWechatFeatureScreen('直播', `
        <div class="wc-live-tabs">${WECHAT_LIVE_CATEGORIES.map(c => `<button class="${c === category ? 'active' : ''}" onclick="openWechatLive(${quoteWechatJsString(c)}, true)">${c}</button>`).join('')}</div>
        ${body}
    `, `<i class="ri-refresh-line" onclick="openWechatLive(${quoteWechatJsString(category)}, true)"></i>`);
}

async function generateWechatLiveRooms(category) {
    const state = getWechatLiveState();
    state.error = '';
    saveWechatLiveState(state);
    const result = await callChatApi([
        { role: 'system', content: '你是微信直播间内容生成器。只输出 JSON 数组，不要解释。每条包含 title、host、viewers、lines。lines 是直播间内 2-4 条真实感短句，包含主播或观众发言。' },
        { role: 'user', content: `生成 3 个「${category}」区域直播间。本次随机种子：${Date.now()}。内容要像真实直播间，不要固定模板。` }
    ], { usageFeature: 'discover' });
    const parsed = result.ok ? parseWechatAiJsonPayload(result.content) : null;
    const rooms = parsed ? normalizeWechatLiveRooms(parsed, category) : [];
    if (!result.ok || !rooms.length) {
        state.error = result.ok ? 'AI 返回格式无法解析，点右上角再生成一次。' : result.error;
        state.rooms[category] = [];
    } else {
        state.rooms[category] = rooms;
        state.error = '';
    }
    saveWechatLiveState(state);
    renderWechatLive(category);
}

