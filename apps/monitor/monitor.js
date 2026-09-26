// --- BYND Monitor / 内部监控剧情入口 ---
const MONITOR_ACTIVE_TOOL_KEY = 'bynd_monitor_active_tool_v1';
const MONITOR_PET_LIBRARY_KEY = 'bynd_monitor_pet_library_v1';
const MONITOR_ACTIVE_PET_KEY = 'bynd_monitor_active_pet_v1';
const MONITOR_PET_FLOAT_POS_KEY = 'bynd_monitor_pet_float_pos_v1';
const MONITOR_PET_BOUND_CHAR_KEY = 'bynd_monitor_pet_bound_char_v1';
const MONITOR_PET_ENABLED_KEY = 'bynd_monitor_pet_enabled_v1';
const MONITOR_PET_DB_NAME = 'bynd_monitor_pet_assets_v1';
const MONITOR_PET_DB_STORE = 'assets';
const MONITOR_PET_ORIGIN = 'https://codex-pets.net';
const MONITOR_PET_API_BASES = [
    '/codex-pets',
    'https://bynd.ccwu.cc/mcp/relay/codex-pets',
    MONITOR_PET_ORIGIN
];
let monitorActiveTool = localStorage.getItem(MONITOR_ACTIVE_TOOL_KEY) || 'internal';
let monitorPetQuery = '';
let monitorPetResults = [];
let monitorPetLoading = false;
let monitorPetLibraryAction = null;
let monitorPetStatus = '';
let monitorPetResolvedBase = '';
let monitorPetPage = 1;
let monitorPetPageSize = 12;
let monitorPetTotal = 0;
let monitorPetTotalPages = 1;
let monitorPetView = 'gallery';
let monitorPetFloatMessage = '';
let monitorPetAiBusy = false;
let monitorPetLastReactionAt = 0;
let monitorPetDragState = null;
let monitorScreenStream = null;
let monitorScreenVideo = null;
let monitorScreenFrameDataUrl = '';
let monitorScreenStatus = '未授权屏幕共享';
let monitorScreenLastCaptureAt = 0;

function getMonitorCharacters() {
    return Array.isArray(window.myCharacters)
        ? window.myCharacters.filter(char => char && char.id && !char.isGroupChat)
        : [];
}

function getMonitorCharName(char) {
    if (typeof getWechatCharDisplayName === 'function') return getWechatCharDisplayName(char);
    return (char && char.chatConfig && char.chatConfig.nickname) || (char && char.name) || '未命名';
}

function getMonitorPetBoundChar() {
    const chars = getMonitorCharacters();
    const boundId = localStorage.getItem(MONITOR_PET_BOUND_CHAR_KEY) || '';
    // Desktop pets have their own binding. Enabling a chat watcher must never select a pet.
    return chars.find(char => char.id === boundId) || null;
}

function setMonitorPetBoundChar(charId) {
    const id = String(charId || '').trim();
    if (id) localStorage.setItem(MONITOR_PET_BOUND_CHAR_KEY, id);
    else localStorage.removeItem(MONITOR_PET_BOUND_CHAR_KEY);
    if (window.ByndCharacterPet) for (const char of getMonitorCharacters()) window.ByndCharacterPet.reset(char);
}

function ensureMonitorPetState(char) {
    if (!char) return {};
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.monitorPetState = char.chatConfig.monitorPetState || {};
    return char.chatConfig.monitorPetState;
}

function isMonitorPetEnabled() {
    return localStorage.getItem(MONITOR_PET_ENABLED_KEY) !== '0';
}

function setMonitorPetEnabled(value) {
    const enabled = !!value;
    try { localStorage.setItem(MONITOR_PET_ENABLED_KEY, enabled ? '1' : '0'); }
    catch (error) {
        renderMonitorCharacters();
        if (typeof showWechatToast === 'function') showWechatToast('桌宠开关未能保存，请重试。');
        return false;
    }
    monitorPetFloatMessage = '';
    if (!enabled) {
        stopMonitorPetAutoObserve();
        if (window.ByndCharacterPet) for (const char of getMonitorCharacters()) window.ByndCharacterPet.reset(char);
        document.querySelector('.phone-container > .monitor-pet-floating')?.remove();
        updateMonitorPetStatus('桌宠已关闭，素材和绑定角色会保留。');
    } else {
        updateMonitorPetStatus('桌宠已开启。');
        if (isMonitorScreenSharingActive()) startMonitorPetAutoObserve();
    }
    syncMonitorPetFloating();
    renderMonitorCharacters();
    if (typeof showWechatToast === 'function') showWechatToast(enabled ? '桌宠已开启' : '桌宠已关闭');
    return true;
}
window.setMonitorPetEnabled = setMonitorPetEnabled;

function toggleMonitorPetEnabled() {
    return setMonitorPetEnabled(!isMonitorPetEnabled());
}
window.toggleMonitorPetEnabled = toggleMonitorPetEnabled;

function isMonitorScreenSharingActive() {
    const bridge = getMonitorAndroidScreenBridge();
    if (bridge) {
        try {
            return String(bridge.isScreenCaptureActive && bridge.isScreenCaptureActive()) === 'true';
        } catch (e) {
            return false;
        }
    }
    return !!(monitorScreenStream && monitorScreenStream.getVideoTracks().some(track => track.readyState === 'live'));
}

function getMonitorAndroidScreenBridge() {
    const bridge = window.ByndAndroid;
    if (!bridge || typeof bridge !== 'object') return null;
    return typeof bridge.captureScreenFrame === 'function' ? bridge : null;
}

function updateMonitorScreenStatus(text) {
    monitorScreenStatus = String(text || '');
    const el = document.getElementById('monitor-screen-status');
    if (el) el.textContent = monitorScreenStatus;
    window.ByndPetWorkspace?.screenChanged();
}

function ensureMonitorScreenVideo() {
    if (monitorScreenVideo) return monitorScreenVideo;
    monitorScreenVideo = document.createElement('video');
    monitorScreenVideo.muted = true;
    monitorScreenVideo.playsInline = true;
    monitorScreenVideo.autoplay = true;
    monitorScreenVideo.style.position = 'fixed';
    monitorScreenVideo.style.left = '-9999px';
    monitorScreenVideo.style.top = '-9999px';
    monitorScreenVideo.style.width = '1px';
    monitorScreenVideo.style.height = '1px';
    monitorScreenVideo.setAttribute('aria-hidden', 'true');
    document.body.appendChild(monitorScreenVideo);
    return monitorScreenVideo;
}

async function startMonitorScreenShare() {
    const bridge = getMonitorAndroidScreenBridge();
    if (bridge && typeof bridge.startScreenCapture === 'function') {
        try {
            bridge.startScreenCapture();
            updateMonitorScreenStatus(isMonitorScreenSharingActive() ? '已开启屏幕共享，可以随时停止。' : '请在系统弹窗中选择要共享的画面。');
            renderMonitorCharacters();
            startMonitorPetAutoObserve();
        } catch (e) {
            updateMonitorScreenStatus(`安卓屏幕授权失败：${e && e.message ? e.message : e}`);
        }
        return false;
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        updateMonitorScreenStatus('当前浏览器暂不支持共享屏幕，请使用安卓版或支持屏幕共享的桌面浏览器。');
        if (typeof showWechatToast === 'function') showWechatToast('当前浏览器不支持屏幕共享');
        return false;
    }
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 2 },
            audio: false
        });
        stopMonitorScreenShare(false);
        monitorScreenStream = stream;
        const video = ensureMonitorScreenVideo();
        video.srcObject = stream;
        await video.play().catch(() => {});
        stream.getVideoTracks().forEach(track => {
            track.addEventListener('ended', () => stopMonitorScreenShare(true), { once: true });
        });
        monitorScreenFrameDataUrl = '';
        updateMonitorScreenStatus('已授权屏幕共享，桌宠会定期自动观察屏幕画面，点击桌宠可立刻观察一次。');
        renderMonitorCharacters();
        startMonitorPetAutoObserve();
        return false;
    } catch (e) {
        updateMonitorScreenStatus(`屏幕共享未开启：${e && e.message ? e.message : '用户取消或浏览器拒绝'}`);
        return false;
    }
}
window.startMonitorScreenShare = startMonitorScreenShare;

function stopMonitorScreenShare(render = true) {
    stopMonitorPetAutoObserve();
    const bridge = getMonitorAndroidScreenBridge();
    if (bridge && typeof bridge.stopScreenCapture === 'function') {
        try {
            bridge.stopScreenCapture();
        } catch (e) {
            updateMonitorScreenStatus(`未能停止共享：${e && e.message ? e.message : '请重试'}`);
            if (render) renderMonitorCharacters();
            return false;
        }
    }
    if (monitorScreenStream) {
        monitorScreenStream.getTracks().forEach(track => track.stop());
    }
    monitorScreenStream = null;
    monitorScreenFrameDataUrl = '';
    monitorScreenLastCaptureAt = 0;
    if (monitorScreenVideo) monitorScreenVideo.srcObject = null;
    updateMonitorScreenStatus(bridge && isMonitorScreenSharingActive() ? '已请求停止共享，正在等待系统结束。' : '屏幕共享已停止');
    if (render) renderMonitorCharacters();
    return false;
}
window.stopMonitorScreenShare = stopMonitorScreenShare;

let monitorPetAutoObserveTimer = null;

function getMonitorPetAutoObserveIntervalMs() {
    const raw = localStorage.getItem('bynd_monitor_pet_observe_interval_v1');
    if (raw === '0') return 0;
    const stored = Number(raw);
    const seconds = Number.isFinite(stored) && stored >= 30 ? stored : 120;
    return seconds * 1000;
}

function setMonitorPetObserveInterval(value) {
    const seconds = Math.max(0, Number(value) || 0);
    try { localStorage.setItem('bynd_monitor_pet_observe_interval_v1', String(seconds === 0 ? 0 : Math.max(30, seconds))); }
    catch (error) {
        renderMonitorCharacters();
        if (typeof showWechatToast === 'function') showWechatToast('观察频率未能保存，请重试。');
        return false;
    }
    if (seconds === 0) {
        stopMonitorPetAutoObserve();
        updateMonitorScreenStatus('已设为手动：点击桌宠时才观察共享画面。');
    } else {
        if (isMonitorScreenSharingActive()) startMonitorPetAutoObserve();
        updateMonitorScreenStatus(`已保存：共享开启后，每 ${seconds >= 60 ? `${Math.round(seconds / 60)} 分钟` : `${seconds} 秒`}左右观察一次。`);
    }
    renderMonitorCharacters();
    return true;
}
window.setMonitorPetObserveInterval = setMonitorPetObserveInterval;

function startMonitorPetAutoObserve() {
    stopMonitorPetAutoObserve();
    if (!isMonitorPetEnabled()) return;
    if (getMonitorPetAutoObserveIntervalMs() <= 0) return;
    const schedule = () => {
        const base = getMonitorPetAutoObserveIntervalMs();
        const delay = Math.round(base * (0.85 + Math.random() * 0.3));
        monitorPetAutoObserveTimer = setTimeout(async () => {
            try {
                if (!document.hidden
                    && isMonitorScreenSharingActive()
                    && document.querySelector('.monitor-pet-floating')
                    && typeof getMonitorPetBoundChar === 'function'
                    && getMonitorPetBoundChar()) {
                    await requestMonitorPetReaction('observe');
                }
            } catch (e) {}
            if (monitorPetAutoObserveTimer !== null) schedule();
        }, delay);
    };
    schedule();
}

function stopMonitorPetAutoObserve() {
    if (monitorPetAutoObserveTimer !== null) {
        clearTimeout(monitorPetAutoObserveTimer);
        monitorPetAutoObserveTimer = null;
    }
}

async function captureMonitorScreenFrame() {
    const bridge = getMonitorAndroidScreenBridge();
    if (bridge) {
        try {
            const dataUrl = String(bridge.captureScreenFrame && bridge.captureScreenFrame() || '');
            if (/^data:image\//i.test(dataUrl)) {
                monitorScreenFrameDataUrl = dataUrl;
                monitorScreenLastCaptureAt = Date.now();
                updateMonitorScreenStatus(`已读取安卓屏幕画面 ${new Date(monitorScreenLastCaptureAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
                return dataUrl;
            }
            updateMonitorScreenStatus(isMonitorScreenSharingActive() ? '安卓屏幕画面准备中，请稍后再试。' : '还没有授权安卓屏幕录制。');
        } catch (e) {
            updateMonitorScreenStatus(`安卓屏幕读取失败：${e && e.message ? e.message : e}`);
        }
        return '';
    }
    if (!isMonitorScreenSharingActive()) return '';
    const video = ensureMonitorScreenVideo();
    if (!video.videoWidth || !video.videoHeight) {
        await new Promise(resolve => setTimeout(resolve, 180));
    }
    if (!video.videoWidth || !video.videoHeight) return '';
    const maxSide = 768;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(video, 0, 0, width, height);
    monitorScreenFrameDataUrl = canvas.toDataURL('image/jpeg', 0.72);
    monitorScreenLastCaptureAt = Date.now();
    updateMonitorScreenStatus(`已读取屏幕画面 ${new Date(monitorScreenLastCaptureAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    return monitorScreenFrameDataUrl;
}
window.captureMonitorScreenFrame = captureMonitorScreenFrame;

function getMonitorRecentSummary(char) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const msg = history.slice().reverse().find(item => item && !item.monitorEvent && item.type !== 'system_notice');
    if (!msg) return '还没有可观察的聊天痕迹';
    const raw = msg.description || msg.content || msg.dialogue || '';
    const text = String(raw).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!text) return msg.isMe ? '你刚刚发送了一条非文字消息' : '角色最近发送了一条非文字消息';
    return (msg.isMe ? '你：' : `${getMonitorCharName(char)}：`) + text.slice(0, 34);
}

function getMonitorMode(char) {
    const mode = char && char.chatConfig && char.chatConfig.monitorMode;
    return mode === 'observer' || mode === 'god' || mode === 'cp' ? 'observer' : 'persona';
}

function normalizeMonitorBarrageSpeed(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 1;
    return Math.min(1.6, Math.max(0.7, Math.round(num * 10) / 10));
}

function getMonitorSpeedText(value) {
    const speed = normalizeMonitorBarrageSpeed(value);
    if (speed >= 1.35) return '很快';
    if (speed >= 1.1) return '偏快';
    if (speed <= 0.8) return '慢速';
    return '标准';
}

function getMonitorStatusText(chars) {
    const enabled = chars.filter(char => !!(char.chatConfig && char.chatConfig.monitorEnabled));
    if (!chars.length) return '未导入角色';
    if (!enabled.length) return '尚未接入';
    if (enabled.length === 1) return `${getMonitorCharName(enabled[0])} 已接入`;
    return `${enabled.length} 位角色已接入`;
}

function getMonitorStats(chars) {
    const enabled = chars.filter(char => !!(char.chatConfig && char.chatConfig.monitorEnabled));
    const observerCount = enabled.filter(char => getMonitorMode(char) === 'observer').length;
    const personaCount = enabled.length - observerCount;
    const errorCount = enabled.filter(char => char.chatConfig && char.chatConfig.monitorState && char.chatConfig.monitorState.lastError).length;
    return {
        total: chars.length,
        enabled: enabled.length,
        observer: observerCount,
        persona: personaCount,
        errors: errorCount
    };
}

// The workspace owns presentation; these entry points also serve existing integrations.
function renderMonitorOverview() { window.ByndMonitor?.render(); }
function renderMonitorToolPanel() { window.ByndMonitor?.render(); }
function renderMonitorScreenSharePanel() { return window.ByndPetWorkspace?.screenView() || ''; }

function handleMonitorTool(tool) {
    // Keep old shortcuts working, while pet controls live in their own application.
    if (tool === 'pet' || tool === 'phone') {
        if (typeof closeApp === 'function') closeApp('monitor');
        if (typeof openApp === 'function') openApp('pet');
        window.ByndPetWorkspace?.navigate(tool);
        return false;
    }
    monitorActiveTool = tool === 'island' ? 'island' : 'internal';
    try { localStorage.setItem(MONITOR_ACTIVE_TOOL_KEY, monitorActiveTool); }
    catch (error) { console.warn('监控页面位置未保存', error); }
    window.ByndMonitor?.navigate(monitorActiveTool);
    renderMonitorCharacters();
    return false;
}
window.handleMonitorTool = handleMonitorTool;

function normalizeMonitorPet(item) {
    if (!item || typeof item !== 'object') return null;
    const id = String(item.id || '').trim();
    if (!id) return null;
    return {
        id,
        displayName: String(item.displayName || id),
        description: String(item.description || ''),
        kind: String(item.kind || 'pet'),
        ownerName: String(item.ownerName || item.ownerHandle || ''),
        tags: Array.isArray(item.tags) ? item.tags.map(tag => String(tag || '')).filter(Boolean).slice(0, 5) : [],
        posterUrl: toMonitorPetDisplayUrl(item.posterUrl || item.previewUrl || item.shareImageUrl || ''),
        previewUrl: toMonitorPetDisplayUrl(item.previewUrl || item.posterUrl || item.shareImageUrl || ''),
        shareImageUrl: toMonitorPetDisplayUrl(item.shareImageUrl || ''),
        spritesheetUrl: toMonitorPetDisplayUrl(item.spritesheetUrl || ''),
        downloadUrl: item.downloadUrl ? toMonitorPetDisplayUrl(item.downloadUrl) : '',
        source: 'codex-pets.net',
        viewCount: Number(item.viewCount || 0) || 0,
        downloadCount: Number(item.downloadCount || 0) || 0,
        likeCount: Number(item.likeCount || 0) || 0,
        commentCount: Number(item.commentCount || 0) || 0,
        savedAt: item.savedAt || 0,
        posterDataUrl: item.posterDataUrl || ''
    };
}

function toMonitorPetDisplayUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        return new URL(raw, MONITOR_PET_ORIGIN).toString();
    } catch (e) {
        return raw;
    }
}

function toMonitorPetFetchUrl(value) {
    const raw = toMonitorPetDisplayUrl(value);
    if (!raw) return '';
    try {
        const url = new URL(raw);
        if (url.hostname !== 'codex-pets.net') return raw;
        const base = monitorPetResolvedBase || MONITOR_PET_API_BASES[0];
        if (!base || base === MONITOR_PET_ORIGIN) return raw;
        return `${base.replace(/\/+$/, '')}${url.pathname}${url.search}`;
    } catch (e) {
        return raw;
    }
}

function getMonitorPetLibrary() {
    try {
        const list = JSON.parse(localStorage.getItem(MONITOR_PET_LIBRARY_KEY) || '[]');
        return Array.isArray(list) ? list.map(normalizeMonitorPet).filter(Boolean) : [];
    } catch (e) {
        return [];
    }
}

function saveMonitorPetLibrary(list) {
    localStorage.setItem(MONITOR_PET_LIBRARY_KEY, JSON.stringify((Array.isArray(list) ? list : []).map(normalizeMonitorPet).filter(Boolean)));
}

function getActiveMonitorPetId() {
    return localStorage.getItem(MONITOR_ACTIVE_PET_KEY) || '';
}

function renderMonitorPetLibrary(online = false) {
    const saved = getMonitorPetLibrary();
    const activeId = getMonitorPetActiveLibraryId();
    const onlineContent = monitorPetLoading
        ? '<div class="monitor-pet-empty" role="status">正在加载素材…</div>'
        : renderMonitorPetOnlineContent(saved, activeId);
    return `<div class="mh-library-content">
        ${online ? `<div class="monitor-pet-search">
            <input id="monitor-pet-search-input" type="search" aria-label="搜索在线桌宠素材" value="${musicEscapeAttr(monitorPetQuery)}" placeholder="搜索素材、主题或创作者" onkeydown="if(event.key==='Enter') searchMonitorPets(this.value, 1)">
            <button type="button" aria-label="搜索" onclick="searchMonitorPets(document.getElementById('monitor-pet-search-input')?.value, 1)" ${monitorPetLoading ? 'disabled' : ''}><i class="${monitorPetLoading ? 'ri-loader-4-line' : 'ri-search-line'}"></i></button>
        </div>
        <div class="monitor-pet-gallery-head">
            ${renderMonitorPetTabButton('gallery', '全部素材')}
            ${renderMonitorPetTabButton('collections', '主题合集')}
            ${renderMonitorPetTabButton('creators', '创作者')}
        </div>` : ''}
        <p class="monitor-pet-status" data-mh-pet-status role="status">${musicEscapeHtml(monitorPetStatus)}</p>
        <div class="monitor-pet-grid">${online ? onlineContent : saved.map(pet => renderMonitorPetCard(pet, true, activeId, true)).join('') || '<div class="monitor-pet-empty">还没有导入桌宠，到在线素材里挑一只吧。</div>'}</div>
        ${online ? renderMonitorPetPager() : ''}
    </div>`;
}

function renderMonitorPetTabButton(view, label) {
    return `<button type="button" class="${monitorPetView === view ? 'active' : ''}" onclick="setMonitorPetView('${view}')">${label}</button>`;
}

function renderMonitorPetOnlineContent(saved, activeId) {
    if (monitorPetView === 'collections') return renderMonitorPetCollections();
    if (monitorPetView === 'creators') return renderMonitorPetCreators();
    return monitorPetResults.map(pet => renderMonitorPetCard(pet, saved.some(item => item.id === pet.id), activeId)).join('')
        || '<div class="monitor-pet-empty">还没有搜索结果。</div>';
}

function renderMonitorPetCollections() {
    const map = new Map();
    monitorPetResults.forEach(pet => {
        const keys = [pet.kind, ...(Array.isArray(pet.tags) ? pet.tags : [])]
            .map(item => String(item || '').trim())
            .filter(Boolean);
        keys.forEach(key => {
            const id = key.toLowerCase();
            if (!map.has(id)) map.set(id, { label: key, count: 0, cover: getMonitorPetDisplayImage(pet) ? pet : null, views: 0 });
            const item = map.get(id);
            item.count += 1;
            item.views += Number(pet.viewCount || 0) || 0;
            if (!item.cover && getMonitorPetDisplayImage(pet)) item.cover = pet;
        });
    });
    const rows = Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 18);
    if (!rows.length) return '<div class="monitor-pet-empty">当前页还没有可聚合的合集。</div>';
    return rows.map(item => `
        <button type="button" class="monitor-pet-filter-card" data-monitor-pet-filter="${musicEscapeAttr(item.label)}" onclick="openMonitorPetFilter(this.dataset.monitorPetFilter)">
            <span>${item.cover ? renderMonitorPetMedia(item.cover) : '<i class="ri-price-tag-3-line"></i>'}</span>
            <strong>${musicEscapeHtml(item.label)}</strong>
            <em>${item.count} 个素材 · ${item.views} 浏览</em>
        </button>
    `).join('');
}

function renderMonitorPetCreators() {
    const map = new Map();
    monitorPetResults.forEach(pet => {
        const name = String(pet.ownerName || pet.ownerHandle || 'unknown').trim() || 'unknown';
        const id = name.toLowerCase();
        if (!map.has(id)) map.set(id, { label: name, count: 0, cover: getMonitorPetDisplayImage(pet) ? pet : null, likes: 0, comments: 0 });
        const item = map.get(id);
        item.count += 1;
        item.likes += Number(pet.likeCount || 0) || 0;
        item.comments += Number(pet.commentCount || 0) || 0;
        if (!item.cover && getMonitorPetDisplayImage(pet)) item.cover = pet;
    });
    const rows = Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 18);
    if (!rows.length) return '<div class="monitor-pet-empty">当前页还没有创作者信息。</div>';
    return rows.map(item => `
        <button type="button" class="monitor-pet-filter-card creator" data-monitor-pet-filter="${musicEscapeAttr(item.label)}" onclick="openMonitorPetFilter(this.dataset.monitorPetFilter)">
            <span>${item.cover ? renderMonitorPetMedia(item.cover) : '<i class="ri-user-smile-line"></i>'}</span>
            <strong>${musicEscapeHtml(item.label)}</strong>
            <em>${item.count} 个素材 · ${item.likes} 喜欢 · ${item.comments} 评论</em>
        </button>
    `).join('');
}

function renderMonitorPetPager() {
    if (monitorPetLoading || monitorPetTotalPages <= 1) return '';
    const page = Math.max(1, Math.min(monitorPetPage, monitorPetTotalPages));
    return `
        <div class="monitor-pet-pager">
            <button type="button" ${page <= 1 ? 'disabled' : ''} onclick="goMonitorPetPage(-1)"><i class="ri-arrow-left-s-line"></i><span>上一页</span></button>
            <strong>第 ${page} / ${monitorPetTotalPages} 页</strong>
            <button type="button" ${page >= monitorPetTotalPages ? 'disabled' : ''} onclick="goMonitorPetPage(1)"><span>下一页</span><i class="ri-arrow-right-s-line"></i></button>
        </div>
    `;
}

function getMonitorPetActiveLibraryId() {
    if (!isMonitorPetEnabled()) return '';
    const char = getMonitorPetBoundChar();
    const profile = char && window.ByndCharacterPet?.profile?.(char);
    return profile?.active && profile.baseKey ? '' : getActiveMonitorPetId();
}

function renderMonitorPetUseButton(pet, saved) {
    const current = getMonitorPetActiveLibraryId() === pet.id;
    const pending = monitorPetLibraryAction?.id === pet.id;
    const label = pending ? (monitorPetLibraryAction.use ? '启用中…' : '导入中…') : current ? '正在使用' : saved ? '使用桌宠' : '导入并使用';
    return `<button type="button" class="mh-primary monitor-pet-action-btn ${pending ? 'loading' : ''}" data-monitor-pet-id="${musicEscapeAttr(pet.id)}" data-monitor-pet-operation="${saved ? 'apply' : 'import'}" onclick="${saved ? 'applyMonitorPet' : 'importAndUseMonitorPet'}(this.dataset.monitorPetId, this)" ${monitorPetLibraryAction || current ? 'disabled' : ''}>${musicEscapeHtml(label)}</button>`;
}

function renderMonitorPetCard(pet, saved, activeId, localOnly = false) {
    return `
        <article class="monitor-pet-card ${activeId === pet.id ? 'active' : ''}">
            <button type="button" class="monitor-pet-card-image" data-monitor-pet-id="${musicEscapeAttr(pet.id)}" data-monitor-pet-operation="preview-image" onclick="previewMonitorPet(this.dataset.monitorPetId, this)" aria-label="预览 ${musicEscapeAttr(pet.displayName)}">${renderMonitorPetMedia(pet)}</button>
            <div class="monitor-pet-card-stats">
                <span><i class="ri-eye-line"></i>${Number(pet.viewCount || 0) || 0}</span>
                <span><i class="ri-heart-line"></i>${Number(pet.likeCount || 0) || 0}</span>
                <span><i class="ri-chat-3-line"></i>${Number(pet.commentCount || 0) || 0}</span>
            </div>
            <div class="monitor-pet-card-copy">
                <strong>${musicEscapeHtml(pet.displayName)}</strong>
                <span>by ${musicEscapeHtml(pet.ownerName || pet.ownerHandle || 'unknown')}</span>
                ${pet.description ? `<p>${musicEscapeHtml(pet.description)}</p>` : ''}
                ${pet.tags.length ? `<div>${pet.tags.map(tag => `<em>${musicEscapeHtml(tag)}</em>`).join('')}</div>` : ''}
            </div>
            <div class="monitor-pet-card-actions">
                <button type="button" class="monitor-pet-action-btn" data-monitor-pet-id="${musicEscapeAttr(pet.id)}" data-monitor-pet-operation="preview" onclick="previewMonitorPet(this.dataset.monitorPetId, this)">预览</button>
                ${renderMonitorPetUseButton(pet, saved)}
            </div>
        </article>
    `;
}

function updateMonitorPetStatus(text) {
    monitorPetStatus = String(text || '');
    const el = document.querySelector('.monitor-pet-status');
    if (el) el.textContent = monitorPetStatus;
    window.ByndPetWorkspace?.petChanged();
}

function setMonitorPetActionButton(button, state, text) {
    if (!button) return;
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent || '';
    button.classList.toggle('loading', state === 'loading');
    button.classList.toggle('done', state === 'done');
    button.disabled = state === 'loading';
    button.innerHTML = state === 'loading'
        ? `<i class="ri-loader-4-line"></i><span>${musicEscapeHtml(text || '处理中')}</span>`
        : `<span>${musicEscapeHtml(text || button.dataset.originalText || '')}</span>`;
    if (state === 'done') {
        setTimeout(() => {
            if (!button.isConnected) return;
            button.classList.remove('done');
            button.disabled = false;
            button.textContent = button.dataset.originalText || text || '';
        }, 900);
    }
}

function syncMonitorPetFloating() {
    const host = document.querySelector('.phone-container');
    const home = document.getElementById('home-screen');
    const lock = document.getElementById('lock-screen');
    const unlocked = !home || !home.classList.contains('hidden') || lock?.classList.contains('unlocked');
    if (!unlocked || !isMonitorPetEnabled()) {
        host?.querySelector(':scope > .monitor-pet-floating')?.remove();
        return;
    }
    const char = getMonitorPetBoundChar();
    const activePet = (char && window.ByndCharacterPet?.material(char)) || getMonitorPetLibrary().find(pet => pet.id === getActiveMonitorPetId());
    renderMonitorPetFloat(activePet || null);
    window.ByndCharacterPet?.observeScene();
}
window.syncMonitorPetFloating = syncMonitorPetFloating;

function readMonitorPetFloatPosition() {
    try {
        const value = JSON.parse(localStorage.getItem(MONITOR_PET_FLOAT_POS_KEY) || 'null');
        if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) return value;
    } catch (e) {}
    return null;
}

function clampMonitorPetFloatPosition(host, node, x, y) {
    const width = Math.max(76, node.offsetWidth || 96);
    const height = Math.max(76, node.offsetHeight || 96);
    const maxX = Math.max(8, host.clientWidth - width - 8);
    let maxY = Math.max(8, host.clientHeight - height - 8);
    const navigation = document.querySelector('.monitor-workspace.active:not(.hidden) .mh-nav');
    if (navigation && navigation.getClientRects().length) {
        const top = navigation.getBoundingClientRect().top - host.getBoundingClientRect().top;
        if (top > 0) maxY = Math.max(8, Math.min(maxY, top - height - 12));
    }
    if (node.classList.contains('character-pet')) {
        const footer = document.querySelector('#app-wechat-window.active .wc-room-footer');
        if (footer && footer.getClientRects().length) {
            const top = footer.getBoundingClientRect().top - host.getBoundingClientRect().top;
            if (top > 0) maxY = Math.max(8, Math.min(maxY, top - height - 16));
        }
    }
    return {
        x: Math.min(maxX, Math.max(8, Number(x) || 8)),
        y: Math.min(maxY, Math.max(8, Number(y) || 8))
    };
}

function applyMonitorPetFloatPosition(host, node, pos) {
    const width = Math.max(76, node.offsetWidth || 96);
    const height = Math.max(76, node.offsetHeight || 96);
    const target = pos || {
        x: host.clientWidth - width - 18,
        y: host.clientHeight - height - (node.classList.contains('character-pet') ? 140 : 30)
    };
    const clamped = clampMonitorPetFloatPosition(host, node, target.x, target.y);
    node.style.left = `${clamped.x}px`;
    node.style.top = `${clamped.y}px`;
    node.style.right = 'auto';
    node.style.bottom = 'auto';
    return clamped;
}

function saveMonitorPetFloatPosition(host, node) {
    const pos = clampMonitorPetFloatPosition(
        host,
        node,
        parseFloat(node.style.left),
        parseFloat(node.style.top)
    );
    localStorage.setItem(MONITOR_PET_FLOAT_POS_KEY, JSON.stringify(pos));
}

function finishMonitorPetFloatDrag(event, allowTap) {
    const state = monitorPetDragState;
    if (!state) return;
    const { node, host, moved, pointerId, body } = state;
    monitorPetDragState = null;
    node.classList.remove('dragging');
    try {
        body?.releasePointerCapture?.(pointerId);
    } catch (e) {}
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (moved) {
        saveMonitorPetFloatPosition(host, node);
        syncMonitorPetFloating();
        return;
    }
    if (allowTap) requestMonitorPetReaction('tap');
}

function bindMonitorPetFloatEvents(node) {
    if (!node || node.dataset.dragBound === '1') return;
    node.dataset.dragBound = '1';
    node.addEventListener('pointerdown', event => {
        const body = event.target && event.target.closest && event.target.closest('.monitor-pet-floating-body');
        if (!body || !node.contains(body)) return;
        const host = node.parentElement;
        if (!host) return;
        const rect = node.getBoundingClientRect();
        event.preventDefault();
        event.stopPropagation();
        monitorPetDragState = {
            node,
            host,
            body,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            moved: false
        };
        node.classList.add('dragging');
        try {
            body.setPointerCapture?.(event.pointerId);
        } catch (e) {}
    });
    node.addEventListener('pointermove', event => {
        const state = monitorPetDragState;
        if (!state || state.node !== node || state.pointerId !== event.pointerId) return;
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        if (Math.hypot(dx, dy) > 3) state.moved = true;
        const hostRect = state.host.getBoundingClientRect();
        const pos = clampMonitorPetFloatPosition(
            state.host,
            node,
            event.clientX - hostRect.left - state.offsetX,
            event.clientY - hostRect.top - state.offsetY
        );
        node.style.left = `${pos.x}px`;
        node.style.top = `${pos.y}px`;
        node.style.right = 'auto';
        node.style.bottom = 'auto';
        event.preventDefault();
        event.stopPropagation();
    });
    node.addEventListener('pointerup', event => finishMonitorPetFloatDrag(event, true));
    node.addEventListener('pointercancel', event => finishMonitorPetFloatDrag(event, false));
}

function renderMonitorPetFloat(pet, mode = '') {
    const host = document.querySelector('.phone-container');
    if (!host) return;
    let node = host.querySelector(':scope > .monitor-pet-floating');
    if (node && monitorPetDragState?.node === node) return;
    if (!pet || !isMonitorPetEnabled()) {
        if (node) node.remove();
        return;
    }
    if (!node) {
        node = document.createElement('div');
        node.className = 'monitor-pet-floating';
        host.appendChild(node);
    }
    const boundChar = getMonitorPetBoundChar();
    const custom = !!(pet.characterId && pet.characterId === boundChar?.id && window.ByndCharacterPet);
    const visual = custom ? window.ByndCharacterPet.visual(boundChar) : null;
    const image = visual ? visual.image : getMonitorPetDisplayImage(pet);
    const petState = boundChar && boundChar.chatConfig ? (boundChar.chatConfig.monitorPetState || {}) : {};
    const pending = visual ? visual.pending : !!(petState && petState.pending);
    const characterMessage = visual ? visual.bubble : String((petState && petState.bubbleText) || '').trim();
    const transientMessage = String(monitorPetFloatMessage || '').trim();
    const message = transientMessage || (pending ? '...' : characterMessage);
    const hasBubble = !!message;
    const boundName = boundChar ? getMonitorCharName(boundChar) : '';
    node.className = `monitor-pet-floating ${custom ? 'character-pet' : ''} ${mode === 'preview' ? 'previewing' : ''} ${hasBubble ? 'has-bubble' : ''} ${pending ? 'thinking' : ''} ${visual?.paused ? 'paused' : ''} pop`;
    node.dataset.boundChar = boundChar ? boundChar.id : '';
    node.dataset.petState = visual?.state || 'idle';
    // Rate-limit pauses hold automatic reactions back; say so on the pet instead of going silent.
    let pausedBadge = node.querySelector('.monitor-pet-floating-paused');
    if (visual?.paused) {
        if (!pausedBadge) { pausedBadge = document.createElement('span'); pausedBadge.className = 'monitor-pet-floating-paused'; node.appendChild(pausedBadge); }
        pausedBadge.textContent = visual.paused.quotaExceeded ? '额度不足' : '暂停';
        pausedBadge.title = visual.paused.message || '';
        pausedBadge.setAttribute('role', 'status');
    } else pausedBadge?.remove();
    let bubble = node.querySelector('.monitor-pet-floating-bubble');
    if (hasBubble) {
        if (!bubble) { bubble = document.createElement('div'); bubble.className = 'monitor-pet-floating-bubble'; node.prepend(bubble); }
        if (pending) bubble.innerHTML = '<span class="monitor-pet-thinking-text">...</span>';
        else bubble.textContent = message;
    } else bubble?.remove();
    let body = node.querySelector('.monitor-pet-floating-body');
    if (!body) { body = document.createElement('button'); body.type = 'button'; body.className = 'monitor-pet-floating-body'; node.appendChild(body); }
    body.setAttribute('aria-label', boundName ? `点击让 ${boundName} 说话` : '绑定互动角色后可让桌宠说话');
    body.title = boundName ? `绑定：${boundName}` : '未绑定角色';
    if (image && !custom) {
        const media = body.querySelector('.monitor-pet-media');
        if (!media || media.dataset.mediaSource !== image) body.innerHTML = renderMonitorPetMedia(pet);
    } else if (image) {
        let picture = body.querySelector(':scope > img');
        if (!picture) { picture = document.createElement('img'); picture.onerror = () => picture.remove(); body.replaceChildren(picture); }
        // Keep the same image node and source so ordinary repaints do not restart GIFs.
        if (picture.getAttribute('src') !== image) picture.src = image;
        picture.alt = pet.displayName || '';
    } else if (!body.querySelector('i')) body.innerHTML = '<i class="ri-bubble-chart-line"></i>';
    bindMonitorPetFloatEvents(node);
    applyMonitorPetFloatPosition(host, node, readMonitorPetFloatPosition());
    clearTimeout(renderMonitorPetFloat._timer);
    renderMonitorPetFloat._timer = setTimeout(() => {
        if (node && node.isConnected) node.classList.remove('pop');
        if (transientMessage && monitorPetFloatMessage === transientMessage) {
            monitorPetFloatMessage = '';
            syncMonitorPetFloating();
        }
    }, transientMessage ? 1100 : 760);
}

function getMonitorPetWorldBookText(char) {
    const entries = Array.isArray(char && char.worldBook)
        ? char.worldBook.filter(entry => entry && entry.enabled !== false)
        : [];
    return entries.slice(0, 12).map(entry => {
        const keySource = [entry.key, entry.keys, entry.keyword, entry.name, entry.comment].find(value => {
            if (Array.isArray(value)) return value.filter(Boolean).length > 0;
            return String(value || '').trim();
        }) || '';
        const key = Array.isArray(keySource) ? keySource.filter(Boolean).join('、') : String(keySource || '');
        const content = String(entry.content || entry.entry || entry.value || entry.text || '').replace(/\s+/g, ' ').slice(0, 420);
        return content ? `${key ? `【${key}】` : ''}${content}` : '';
    }).filter(Boolean).join('\n');
}

function getMonitorPetRecentContext(char) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    return history.slice(-10).map(msg => {
        const who = msg.isMe ? '用户' : getMonitorCharName(char);
        const text = String(msg.description || msg.content || msg.dialogue || '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        return text ? `${who}: ${text.slice(0, 180)}` : '';
    }).filter(Boolean).join('\n') || '暂无最近聊天。';
}

function getMonitorPetCurrentSceneText() {
    const active = document.querySelector('.app-window.active:not(.hidden)');
    if (!active) return '系统只能知道：用户当前停留在 BYND 手机桌面。';
    const raw = String(active.id || '').replace(/^app-/, '').replace(/-window$/, '');
    const labels = {
        wechat: '微信聊天页',
        music: '音乐页',
        monitor: '监控页',
        pet: '桌宠页',
        coread: 'PageMate 阅读页',
        dream: '盗梦空间',
        theme: '美化页',
        settings: '设置页',
        worldbook: '世界书页',
        album: '相册页',
        money: '转账红包页',
        game: '小游戏页',
        outing: '一起出门页',
        preset: 'API 预设页'
    };
    return `系统只能知道：用户当前打开了项目内的「${labels[raw] || raw || '某个页面'}」。`;
}

function buildMonitorPetReactionMessages(char, reason = 'tap', screenImage = '') {
    const userProfile = typeof getWechatChatUserProfile === 'function'
        ? getWechatChatUserProfile(char)
        : (typeof getUserProfile === 'function' ? getUserProfile() : {});
    const identity = typeof buildWechatIdentityContextPrompt === 'function' ? buildWechatIdentityContextPrompt(char, userProfile) : '';
    const memory = typeof buildWechatMemoryPrompt === 'function' ? buildWechatMemoryPrompt(char) : '';
    const worldBook = getMonitorPetWorldBookText(char);
    const persona = [
        char && char.description,
        char && char.personality,
        char && char.prompt,
        char && char.setting
    ].filter(Boolean).map(item => String(item)).join('\n').slice(0, 3600);
    const pet = getMonitorPetLibrary().find(item => item.id === getActiveMonitorPetId());
    const hasScreenImage = /^data:image\//i.test(String(screenImage || ''));
    const lastBubble = String(char && char.chatConfig && char.chatConfig.monitorPetState && char.chatConfig.monitorPetState.bubbleText || '').trim();
    const triggerText = reason === 'tap'
        ? '用户点击了桌宠'
        : reason === 'observe'
            ? '桌宠例行看了一眼共享屏幕（用户没有召唤你，是你自己在观察）'
            : '桌宠状态更新';
    const userPrompt = [
        identity,
        `【角色名】${getMonitorCharName(char)}`,
        `【触发】${triggerText}`,
        lastBubble ? `【上一条气泡】${lastBubble}（这句刚说过，禁止重复它的内容和句式）` : '',
        pet ? `【桌宠素材】${pet.displayName}` : '',
        `【可感知状态】${getMonitorPetCurrentSceneText()}`,
        hasScreenImage ? '【真实屏幕截图】本轮附带了一帧用户主动授权共享的真实屏幕画面。你可以观察这张图，但不要说得像长期监控。' : '【真实屏幕截图】本轮没有屏幕画面。你不能假装看见真实屏幕。',
        persona ? `【角色卡/人设】\n${persona}` : '',
        worldBook ? `【世界书】\n${worldBook}` : '',
        memory ? `【角色记忆】\n${memory}` : '',
        `【最近聊天】\n${getMonitorPetRecentContext(char)}`,
        hasScreenImage
            ? '请让角色本人基于截图里能看见的内容，用很短的一句话对用户说话。不要输出图片分析报告。'
            : '请让角色本人用很短的一句话回应用户点击桌宠或当前项目内状态。不要假装拥有屏幕视觉。'
    ].filter(Boolean).join('\n\n');
    return [
        {
            role: 'system',
            content: [
                '你是 BYND 桌宠气泡里的角色本人。',
                '必须严格按角色人设、世界书、记忆和最近聊天关系发言。',
                hasScreenImage
                    ? '本轮用户主动授权并附带了一帧真实屏幕截图；你可以观察截图里实际出现的内容。'
                    : '本轮没有屏幕截图；你不能看见真实手机屏幕、摄像头画面、用户身边的人或其它 App 内容。',
                '没有截图时禁止声称“我看到你的屏幕/旁边有人/你正在看某个外部 App”。有截图时只描述截图中确实可见的内容。',
                '只输出一句中文自然语言，10-36 个字，像桌宠贴在屏幕上对用户说话。',
                '不要 JSON，不要 Markdown，不要旁白动作，不要系统口吻，不要解释。'
            ].join('\n')
        },
        {
            role: 'user',
            content: hasScreenImage
                ? [
                    { type: 'text', text: userPrompt },
                    { type: 'image_url', image_url: { url: screenImage } }
                ]
                : userPrompt
        }
    ];
}

function normalizeMonitorPetReactionText(value) {
    let source = value;
    if (source && typeof source === 'object') {
        source = source.content || source.text || source.message || source.response || source.answer || source.reply || '';
    }
    let text = String(source || '')
        .replace(/^```(?:json|text|markdown)?/i, '')
        .replace(/```$/i, '')
        .replace(/<[^>]+>/g, '')
        .trim();
    if (/^[{[]/.test(text)) {
        try {
            const parsed = JSON.parse(text);
            const candidate = parsed && (parsed.bubble || parsed.text || parsed.content || parsed.message || parsed.reply || parsed.answer);
            if (candidate) text = String(candidate).trim();
        } catch (e) {}
    }
    text = text
        .replace(/^\s*(?:桌宠气泡|角色发言|回复|气泡)\s*[：:]\s*/i, '')
        .replace(/^["“”'「『]+|["“”'」』]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text || /^(?:null|undefined|none|无|空|没有)$/i.test(text)) return '';
    return text.slice(0, 80);
}

async function requestMonitorPetReaction(reason = 'tap') {
    if (!isMonitorPetEnabled()) {
        updateMonitorPetStatus('桌宠已关闭，开启后才会生成气泡。');
        return false;
    }
    const char = getMonitorPetBoundChar();
    if (char && window.ByndCharacterPet?.active(char)) return window.ByndCharacterPet.request(char, reason);
    if (!char) {
        updateMonitorPetStatus('在桌宠 App 中绑定互动角色，就能按人设对话。');
        if (typeof showWechatToast === 'function') showWechatToast('到桌宠 App 绑定互动角色');
        return false;
    }
    if (typeof callChatApi !== 'function') {
        updateMonitorPetStatus('当前没有可用 API，桌宠无法生成角色气泡。');
        return false;
    }
    const now = Date.now();
    if (monitorPetAiBusy || now - monitorPetLastReactionAt < 2200) return false;
    const requests = window.ByndPetRequests;
    const access = requests?.acquire(reason, char.id);
    if (access && !access.lease) {
        updateMonitorPetStatus(access.message);
        if (reason === 'tap' && typeof showWechatToast === 'function') showWechatToast(access.message);
        return false;
    }
    monitorPetAiBusy = true;
    monitorPetLastReactionAt = now;
    const state = ensureMonitorPetState(char);
    const beforeBubble = { bubbleText: state.bubbleText, bubbleAt: state.bubbleAt };
    state.pending = true;
    state.lastError = '';
    try {
        syncMonitorPetFloating();
        const screenImage = isMonitorScreenSharingActive()
            ? await captureMonitorScreenFrame().catch(() => '')
            : '';
        if (reason === 'observe' && !/^data:image\//i.test(String(screenImage || ''))) {
            return false;
        }
        const messages = buildMonitorPetReactionMessages(char, reason, screenImage);
        const options = {
            max_tokens: screenImage ? 220 : 160,
            usageFeature: 'pet',
            usageChar: char,
            temperature: 0.82,
            background: true,
            backgroundPriority: 1,
            skipLengthContinuation: true,
            skipStatusValidationRetry: true,
            skipEmptyLengthRetry: true,
            canSend: () => isMonitorPetEnabled() && getMonitorPetBoundChar() === char && !window.ByndCharacterPet?.active(char)
        };
        const result = requests ? await requests.call(access.lease, messages, options) : await callChatApi(messages, options);
        if (!options.canSend()) return false;
        const text = normalizeMonitorPetReactionText(result && result.ok ? result.content : '');
        if (!text) {
            state.lastError = result?.ok ? 'AI 返回了空内容' : requests ? requests.message(result) : result?.error || '互动未完成';
            updateMonitorPetStatus(`${getMonitorCharName(char)} 暂时没有生成桌宠气泡：${state.lastError}`);
            if (reason === 'tap' && typeof showWechatToast === 'function') showWechatToast(state.lastError);
            return false;
        }
        state.bubbleText = text;
        state.bubbleAt = Date.now();
        state.lastError = '';
        state.pending = false;
        if (typeof saveCharactersToStorage === 'function' && await saveCharactersToStorage() === false) throw new Error('桌宠互动未能保存，请重试。');
        monitorPetFloatMessage = '';
        updateMonitorPetStatus(`${getMonitorCharName(char)} 已更新桌宠气泡。`);
    } catch (e) {
        Object.assign(state, beforeBubble);
        state.lastError = e && e.message ? e.message : String(e || '生成失败');
        updateMonitorPetStatus(`${getMonitorCharName(char)} 的桌宠气泡生成失败：${state.lastError}`);
    } finally {
        if (access?.lease) requests.release(access.lease);
        state.pending = false;
        monitorPetAiBusy = false;
        syncMonitorPetFloating();
    }
    return false;
}
window.requestMonitorPetReaction = requestMonitorPetReaction;

function getMonitorPetDisplayImage(pet) {
    if (!pet) return '';
    return pet.posterDataUrl || pet.previewUrl || pet.posterUrl || pet.shareImageUrl || '';
}

function getMonitorPetStripLayout(width, height, source) {
    // codex-pets preview.webp is a horizontal strip of 96x104 cells, not an animated WebP.
    // Inspect the decoded dimensions as well so ordinary GIFs and individual posters stay intact.
    const candidate = /(?:\/preview\.webp(?:[?#]|$)|^data:image\/webp[;,])/i.test(String(source || ''));
    const frames = width / 96;
    return candidate && height === 104 && Number.isInteger(frames) && frames > 1 && frames <= 170
        ? { width: 96, height: 104, frames } : null;
}

function renderMonitorPetMedia(pet, extraClass = '', visualId = '') {
    const sources = [...new Set([pet?.posterDataUrl, pet?.previewUrl, pet?.posterUrl, pet?.shareImageUrl].filter(value =>
        typeof value === 'string' && /^(?:https?:\/\/|blob:|data:image\/)/i.test(value)))];
    const source = sources[0] || '';
    return `<span class="monitor-pet-media ${musicEscapeAttr(extraClass)}" role="img" aria-label="${musicEscapeAttr(pet?.displayName || '桌宠预览')}" data-media-source="${musicEscapeAttr(source)}" data-media-fallbacks="${musicEscapeAttr(JSON.stringify(sources.slice(1)))}" ${visualId ? `data-mh-visual="${musicEscapeAttr(visualId)}"` : ''}>
        ${source ? `<img src="${musicEscapeAttr(source)}" alt="" aria-hidden="true" loading="lazy" draggable="false" onload="monitorPetMediaLoaded(this)" onerror="monitorPetMediaFailed(this)">` : ''}
        <span class="monitor-pet-media-status">${source ? '加载预览…' : '暂无预览'}</span>
    </span>`;
}

function monitorPetMediaLoaded(image) {
    const media = image.closest('.monitor-pet-media');
    if (!media) return;
    media.querySelector('svg')?.remove();
    const source = image.currentSrc || image.getAttribute('src') || '';
    const layout = getMonitorPetStripLayout(image.naturalWidth, image.naturalHeight, source);
    media.classList.toggle('is-strip', !!layout);
    media.classList.remove('is-error');
    if (layout) {
        const create = name => document.createElementNS('http://www.w3.org/2000/svg', name);
        const svg = create('svg'), viewport = create('svg'), track = create('image');
        svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('aria-hidden', 'true');
        // The inner viewport clips neighboring frames even when the outer SVG is letterboxed.
        viewport.setAttribute('width', layout.width);
        viewport.setAttribute('height', layout.height);
        viewport.setAttribute('overflow', 'hidden');
        track.setAttribute('href', source);
        track.setAttribute('width', image.naturalWidth);
        track.setAttribute('height', layout.height);
        track.setAttribute('class', 'monitor-pet-strip-track');
        track.style.setProperty('--pet-strip-end', `-${image.naturalWidth}px`);
        track.style.setProperty('--pet-strip-frames', String(layout.frames));
        track.style.setProperty('--pet-strip-duration', `${layout.frames * 0.2}s`);
        viewport.appendChild(track);
        svg.appendChild(viewport);
        media.appendChild(svg);
        media.dataset.mediaFrames = String(layout.frames);
    } else delete media.dataset.mediaFrames;
    media.classList.add('is-ready');
}

function monitorPetMediaFailed(image) {
    const media = image.closest('.monitor-pet-media');
    if (!media) return;
    let fallbacks = [];
    try { fallbacks = JSON.parse(media.dataset.mediaFallbacks || '[]'); } catch (_) {}
    const next = fallbacks.shift();
    media.dataset.mediaFallbacks = JSON.stringify(fallbacks);
    media.classList.remove('is-ready', 'is-strip');
    media.querySelector('svg')?.remove();
    if (next) { image.src = next; return; }
    media.classList.add('is-error');
    media.querySelector('.monitor-pet-media-status').textContent = '预览加载失败';
}

function setMonitorPetView(view) {
    monitorPetView = ['gallery', 'collections', 'creators'].includes(view) ? view : 'gallery';
    renderMonitorCharacters();
}
window.setMonitorPetView = setMonitorPetView;

function openMonitorPetFilter(query) {
    monitorPetView = 'gallery';
    searchMonitorPets(query, 1);
    return false;
}
window.openMonitorPetFilter = openMonitorPetFilter;

function goMonitorPetPage(delta) {
    const next = Math.max(1, Math.min(monitorPetTotalPages || 1, monitorPetPage + Number(delta || 0)));
    if (next === monitorPetPage || monitorPetLoading) return false;
    searchMonitorPets(monitorPetQuery, next);
    return false;
}
window.goMonitorPetPage = goMonitorPetPage;

async function searchMonitorPets(query = '', page = 1) {
    monitorPetQuery = String(query || '').trim();
    monitorPetPage = Math.max(1, Number(page) || 1);
    monitorPetLoading = true;
    monitorPetStatus = '正在读取在线素材...';
    renderMonitorCharacters();
    try {
        const params = new URLSearchParams({ page: String(monitorPetPage), pageSize: String(monitorPetPageSize) });
        if (monitorPetQuery) params.set('q', monitorPetQuery);
        const data = await fetchMonitorPetJson(`/api/pets?${params.toString()}`);
        monitorPetResults = (Array.isArray(data.pets) ? data.pets : []).map(normalizeMonitorPet).filter(Boolean);
        monitorPetTotal = Math.max(0, Number(data.total || 0) || monitorPetResults.length);
        monitorPetTotalPages = Math.max(1, Number(data.totalPages || 0) || Math.ceil(monitorPetTotal / monitorPetPageSize) || 1);
        monitorPetPage = Math.max(1, Math.min(Number(data.page || monitorPetPage) || 1, monitorPetTotalPages));
        monitorPetStatus = monitorPetResults.length
            ? `找到 ${monitorPetTotal} 个素材，当前第 ${monitorPetPage} / ${monitorPetTotalPages} 页。`
            : '没有找到匹配素材，换个关键词试试。';
    } catch (e) {
        monitorPetResults = [];
        monitorPetTotal = 0;
        monitorPetTotalPages = 1;
        monitorPetStatus = `读取失败：${e.message || e}`;
    } finally {
        monitorPetLoading = false;
        renderMonitorCharacters();
    }
}
window.searchMonitorPets = searchMonitorPets;

async function fetchMonitorPetJson(path) {
    let lastError = null;
    for (const base of MONITOR_PET_API_BASES) {
        const url = `${base.replace(/\/+$/, '')}${path}`;
        try {
            const resp = await fetch(url, { cache: 'no-store' });
            if (!resp.ok) throw new Error(`${resp.status}`);
            const data = await resp.json();
            monitorPetResolvedBase = base;
            return data;
        } catch (e) {
            lastError = e;
        }
    }
    throw new Error(lastError?.message || 'Failed to fetch');
}

function previewMonitorPet(petId, button) {
    const pet = getMonitorPetLibrary().find(item => item.id === petId) || monitorPetResults.find(item => item.id === petId);
    if (!pet) return false;
    updateMonitorPetStatus(`正在预览：${pet.displayName}`);
    if (button?.dataset.monitorPetOperation !== 'preview-image') setMonitorPetActionButton(button, 'done', '已预览');
    if (window.ByndPetWorkspace?.previewPet(pet)) return false;
    monitorPetFloatMessage = `预览 ${pet.displayName}`;
    renderMonitorPetFloat(pet, 'preview');
    const preview = document.querySelector('.monitor-pet-active');
    if (preview) {
        preview.classList.remove('is-previewing');
        void preview.offsetWidth;
        preview.classList.add('is-previewing');
        preview.innerHTML = `
            <div class="monitor-pet-preview">${renderMonitorPetMedia(pet)}</div>
            <div>
                <span>预览素材</span>
                <strong>${musicEscapeHtml(pet.displayName)}</strong>
                <p>${musicEscapeHtml(pet.description || `来自 ${pet.source}`)}</p>
            </div>
        `;
    }
    return false;
}
window.previewMonitorPet = previewMonitorPet;

function openMonitorPetDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(MONITOR_PET_DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(MONITOR_PET_DB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveMonitorPetAsset(id, value) {
    const db = await openMonitorPetDb();
    try { return await new Promise((resolve, reject) => {
        const tx = db.transaction(MONITOR_PET_DB_STORE, 'readwrite');
        tx.objectStore(MONITOR_PET_DB_STORE).put(value, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('桌宠图片保存中断'));
    }); } finally { db.close(); }
}

function monitorBlobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

async function fetchMonitorPetDataUrl(url, expectedType = '') {
    const resp = await fetch(toMonitorPetFetchUrl(url), { cache: 'no-store' });
    if (!resp.ok) throw new Error(`下载失败 ${resp.status}`);
    const blob = await resp.blob();
    if (!blob.size || (expectedType && !blob.type.toLowerCase().startsWith(expectedType))) {
        throw new Error(expectedType ? '素材没有返回有效图片，请稍后重试。' : '素材包为空，请稍后重试。');
    }
    return monitorBlobToDataUrl(blob);
}

async function saveMonitorPetSelection(pet) {
    const char = getMonitorPetBoundChar();
    const previousId = localStorage.getItem(MONITOR_ACTIVE_PET_KEY);
    const previousEnabled = localStorage.getItem(MONITOR_PET_ENABLED_KEY);
    try {
        localStorage.setItem(MONITOR_ACTIVE_PET_KEY, pet.id);
        localStorage.setItem(MONITOR_PET_ENABLED_KEY, '1');
        if (char && window.ByndCharacterPet?.profile(char).active) {
            await window.ByndCharacterPet.update(char, next => { next.active = false; });
        }
    } catch (error) {
        let restored = true;
        try {
            if (previousId == null) localStorage.removeItem(MONITOR_ACTIVE_PET_KEY);
            else localStorage.setItem(MONITOR_ACTIVE_PET_KEY, previousId);
            if (previousEnabled == null) localStorage.removeItem(MONITOR_PET_ENABLED_KEY);
            else localStorage.setItem(MONITOR_PET_ENABLED_KEY, previousEnabled);
        } catch (_) { restored = false; }
        throw new Error(restored ? `桌宠切换未能保存：${error.message || error}` : '桌宠切换和设置恢复均未完成，请检查储存空间后重试。');
    }
}

async function runMonitorPetLibraryAction(petId, use, button) {
    if (monitorPetLibraryAction) return false;
    let pet = getMonitorPetLibrary().find(item => item.id === petId);
    const alreadySaved = !!pet;
    pet = pet || monitorPetResults.find(item => item.id === petId);
    if (!pet) { updateMonitorPetStatus('找不到这只桌宠，请刷新素材列表后重试。'); return false; }
    monitorPetLibraryAction = { id: petId, use };
    window.ByndPetWorkspace?.setBusy(true);
    updateMonitorPetStatus(`${alreadySaved ? '正在启用' : '正在导入'} ${pet.displayName}…`);
    setMonitorPetActionButton(button, 'loading', alreadySaved ? '启用中' : '导入中');
    renderMonitorCharacters();
    let savedNow = false;
    try {
        if (!alreadySaved) {
            // Keep the animated preview when available; the stored image remains usable offline.
            const sources = [...new Set([pet.previewUrl, pet.posterUrl, pet.shareImageUrl].filter(Boolean))];
            let posterDataUrl = '', imageError;
            for (const source of sources) {
                try { posterDataUrl = await fetchMonitorPetDataUrl(source, 'image/'); break; }
                catch (error) { imageError = error; }
            }
            if (!posterDataUrl) throw imageError || new Error('这份素材没有可用图片。');
            const zipDataUrl = pet.downloadUrl ? await fetchMonitorPetDataUrl(pet.downloadUrl) : '';
            if (zipDataUrl) await saveMonitorPetAsset(`${pet.id}:zip`, zipDataUrl);
            pet = { ...pet, posterDataUrl, savedAt: Date.now() };
            saveMonitorPetLibrary([pet, ...getMonitorPetLibrary().filter(item => item.id !== pet.id)]);
            savedNow = true;
        }
        if (use) {
            await saveMonitorPetSelection(pet);
            monitorPetFloatMessage = '';
            syncMonitorPetFloating();
        }
        const message = use ? `已启用 ${pet.displayName}${getMonitorPetBoundChar() ? '，返回其他页面即可互动。' : '，可随时绑定角色开启对话。'}` : `已导入 ${pet.displayName}，可在“我的桌宠”中使用。`;
        updateMonitorPetStatus(message);
        if (typeof showWechatToast === 'function') showWechatToast(message);
        return true;
    } catch (error) {
        updateMonitorPetStatus(`${savedNow ? '素材已导入，但未能启用：' : alreadySaved ? '' : '导入失败：'}${error.message || error}`);
        return false;
    } finally {
        monitorPetLibraryAction = null;
        if (button) { button.disabled = false; button.classList.remove('loading'); button.textContent = button.dataset.originalText || '重试'; }
        renderMonitorCharacters();
        window.ByndPetWorkspace?.setBusy(false);
    }
}

function downloadMonitorPet(petId, button) {
    return runMonitorPetLibraryAction(petId, false, button);
}
window.downloadMonitorPet = downloadMonitorPet;

function importAndUseMonitorPet(petId, button) {
    return runMonitorPetLibraryAction(petId, true, button);
}
window.importAndUseMonitorPet = importAndUseMonitorPet;

function applyMonitorPet(petId, button) {
    if (!getMonitorPetLibrary().some(item => item.id === petId)) {
        updateMonitorPetStatus('这只桌宠尚未导入，请先导入素材。');
        return Promise.resolve(false);
    }
    return runMonitorPetLibraryAction(petId, true, button);
}
window.applyMonitorPet = applyMonitorPet;

function updateMonitorSpeedPreview(input) {
    const label = input && input.closest('label');
    const text = label && label.querySelector('span');
    if (text) text.textContent = `弹幕 ${getMonitorSpeedText(input.value)}`;
}
window.updateMonitorSpeedPreview = updateMonitorSpeedPreview;

function renderMonitorCharacters() {
    window.ByndMonitor?.render();
    window.ByndPetWorkspace?.render();
}

function initMonitorApp() {
    renderMonitorCharacters();
}
window.initMonitorApp = initMonitorApp;

function refreshMonitorApp() {
    // Refreshing the view must not erase a real provider error or create a new request.
    renderMonitorCharacters();
    if (typeof showWechatToast === 'function') showWechatToast('已刷新当前状态');
}
window.refreshMonitorApp = refreshMonitorApp;

function refreshMonitorWatcher() { refreshMonitorApp(); }
window.refreshMonitorWatcher = refreshMonitorWatcher;

let monitorConfigSaving = false;
async function saveMonitorWatcherSetting(charId, field, value, message) {
    const char = getMonitorCharacters().find(item => item.id === charId);
    if (!char || monitorConfigSaving) return false;
    const config = char.chatConfig || (char.chatConfig = {});
    const hadValue = Object.prototype.hasOwnProperty.call(config, field);
    const previous = config[field];
    monitorConfigSaving = true;
    config[field] = value;
    window.ByndMonitor?.setBusy(true);
    try {
        if (typeof saveCharactersToStorage !== 'function' || await saveCharactersToStorage() === false) {
            throw new Error('设置未能保存，请重试。');
        }
    } catch (error) {
        // Restore only our field, keeping any concurrent chat history or unrelated settings.
        if (config[field] === value) {
            if (hadValue) config[field] = previous;
            else delete config[field];
        }
        if (typeof showWechatToast === 'function') showWechatToast(error.message || '设置未能保存，请重试。');
        return false;
    } finally {
        monitorConfigSaving = false;
        window.ByndMonitor?.setBusy(false);
        renderMonitorCharacters();
    }
    if (message && typeof showWechatToast === 'function') showWechatToast(message);
    return true;
}

function setMonitorWatcherMode(charId, mode) {
    return saveMonitorWatcherSetting(charId, 'monitorMode', mode === 'observer' ? 'observer' : 'persona', '监控视角已保存');
}
window.setMonitorWatcherMode = setMonitorWatcherMode;

function setMonitorWatcherSpeed(charId, value) {
    return saveMonitorWatcherSetting(charId, 'monitorBarrageSpeed', normalizeMonitorBarrageSpeed(value), '弹幕速度已保存');
}
window.setMonitorWatcherSpeed = setMonitorWatcherSpeed;

async function toggleMonitorWatcher(charId) {
    const char = getMonitorCharacters().find(item => item.id === charId);
    if (!char || monitorConfigSaving) return false;
    const enabled = !char.chatConfig?.monitorEnabled;
    if (!await saveMonitorWatcherSetting(charId, 'monitorEnabled', enabled)) return false;
    renderMonitorCharacters();
    if (typeof showWechatToast === 'function') showWechatToast(enabled ? `${getMonitorCharName(char)} 已接入监控` : `${getMonitorCharName(char)} 已解除监控`);
    return true;
}
window.toggleMonitorWatcher = toggleMonitorWatcher;

