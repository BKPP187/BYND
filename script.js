// --- 📱 script.js: 核心系统与路由 (最终完整版) ---

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initBattery();
    initDate();
    initLockScreen();
    initCalendar();
    initByndPwaRuntime();
    
    if (typeof initIconGrid === 'function') initIconGrid();
    if (typeof initTheme === 'function') initTheme();
    if (typeof loadCharactersFromStorage === 'function') loadCharactersFromStorage(); 
    initProactiveNotify();
});

// --- 基础功能 ---
function initClock() {
    const timeEl = document.getElementById('clock-time-small');
    if (!timeEl) return;
    setInterval(() => {
        const now = new Date();
        timeEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }, 1000);
}

function initBattery() {
    const levelEl = document.getElementById('battery-level');
    const iconEl = document.getElementById('battery-icon');
    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            const update = () => {
                levelEl.textContent = `${Math.round(battery.level * 100)}%`;
                iconEl.className = battery.charging ? "ri-battery-2-charge-fill" : "ri-battery-fill";
            };
            update();
        });
    } else {
        levelEl.textContent = "100%";
    }
}

function initLockScreen() {
    const bigClock = document.getElementById('ls-big-clock');
    const updateTime = () => {
        const now = new Date();
        if(bigClock) bigClock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    };
    setInterval(updateTime, 1000);
    updateTime();
}

function initDate() {
    const dateEl = document.getElementById('ls-date');
    if (!dateEl) return;
    if (typeof window.updateLockDateDisplay === 'function') {
        window.updateLockDateDisplay();
        return;
    }
    const now = new Date();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    dateEl.innerHTML = `<span>${weekdays[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}</span><span class="ls-weather-chip">24°C</span>`;
}

function unlockPhone() {
    document.getElementById('lock-screen').classList.add('unlocked');
    document.getElementById('home-screen').classList.remove('hidden');
    resetDesktopToFirstPage();
    
    // 触发变色检查
    const statusBar = document.querySelector('.status-bar');
    if (typeof window.homeIsDark !== 'undefined') {
        if (window.homeIsDark) statusBar.classList.add('white-text');
        else statusBar.classList.remove('white-text');
    }
}

function initCalendar() {
    const dayNameEl = document.getElementById('cal-day-name');
    const dateNumEl = document.getElementById('cal-date-num');
    const monthNameEl = document.getElementById('cal-month-name');
    const gridEl = document.getElementById('cal-grid');

    if (!dateNumEl) return;

    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    dayNameEl.textContent = days[now.getDay()];
    dateNumEl.textContent = now.getDate();
    monthNameEl.textContent = months[now.getMonth()];

    gridEl.innerHTML = ''; 
    const today = now.getDate();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); 

    for (let i = 1; i <= totalDays; i++) {
        const dot = document.createElement('div');
        dot.className = 'cal-dot';
        dot.textContent = i;
        if (i === today) dot.classList.add('active');
        gridEl.appendChild(dot);
    }
}

// --- 🌟 路由控制 (这里修复了！) ---

function openApp(appName) {
    document.querySelectorAll('.app-window.active').forEach(w => {
        w.classList.remove('active');
        w.classList.add('hidden');
    });
    // 1. 美化 App
    if (appName === 'theme') {
        const win = document.getElementById('app-theme-window');
        if (win) { 
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10); 
            if (typeof loadSavedSettings === 'function') loadSavedSettings();
        }
    }
    // 2. 微信 App
    else if (appName === 'wechat') {
        const win = document.getElementById('app-wechat-window');
        if (win) { 
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof renderChatList === 'function') renderChatList(); 
        }
    } 
    // 3. 📖 世界书 App (新增)
    else if (appName === 'worldbook') {
        const win = document.getElementById('app-worldbook-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initWorldBook === 'function') initWorldBook();
        }
    }
    // 4. 🛠️ 正则 App (新增)
    else if (appName === 'regex') {
        const win = document.getElementById('app-regex-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initRegexApp === 'function') initRegexApp();
        }
    }
    // 5. ⚙️ 设置 App
    else if (appName === 'settings') {
        const win = document.getElementById('app-settings-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initSettings === 'function') initSettings();
        }
    }
    // 6. 预设 App
    else if (appName === 'preset') {
        const win = document.getElementById('app-preset-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof renderPresetList === 'function') renderPresetList();
        }
    }
    // 7. 音乐 App
    else if (appName === 'music') {
        const win = document.getElementById('app-music-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initMusicApp();
        }
    }
    // 8. 学习 App
    else if (appName === 'study') {
        const win = document.getElementById('app-study-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initStudyApp();
        }
    }
    // 9. Game App
    else if (appName === 'game') {
        const win = document.getElementById('app-game-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initGameApp();
        }
    }
    // 其他未开发
    else {
        alert("正在打开: " + appName + " (功能开发中...)");
    }
}

function closeApp(appName) {
    let winId = '';
    if (appName === 'theme') winId = 'app-theme-window';
    else if (appName === 'wechat') winId = 'app-wechat-window';
    else if (appName === 'worldbook') winId = 'app-worldbook-window';
    else if (appName === 'regex') winId = 'app-regex-window';
    else if (appName === 'settings') winId = 'app-settings-window';
    else if (appName === 'preset') winId = 'app-preset-window';
    else if (appName === 'music') winId = 'app-music-window';
    else if (appName === 'study') winId = 'app-study-window';
    else if (appName === 'game') winId = 'app-game-window';
    const win = document.getElementById(winId);
    if (win) {
        resetDesktopToFirstPage();
        win.classList.remove('active');
        setTimeout(() => win.classList.add('hidden'), 300);

        if (appName === 'wechat' && typeof closeChat === 'function') {
            setTimeout(closeChat, 300);
        }
    }
}

// --- BYND PWA / 手机通知壳 ---
const BYND_NOTIFY_SETTINGS_KEY = 'bynd_proactive_notify_settings_v1';
const BYND_NOTIFY_STATE_KEY = 'bynd_proactive_notify_state_v1';
const BYND_NOTIFY_CLIENT_ID_KEY = 'bynd_proactive_notify_client_id_v1';

function getProactiveNotifyClientId() {
    let id = localStorage.getItem(BYND_NOTIFY_CLIENT_ID_KEY);
    if (!id) {
        id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : 'client_' + Date.now() + '_' + Math.random().toString(16).slice(2);
        localStorage.setItem(BYND_NOTIFY_CLIENT_ID_KEY, id);
    }
    return id;
}

function initByndPwaRuntime() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js?v=20260521-mobile-frame1').then(() => {
        syncProactiveServiceWorkerConfig();
    }).catch(err => {
        console.warn('service worker register failed:', err);
    });
}

function getProactiveNotifySettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(BYND_NOTIFY_SETTINGS_KEY) || '{}') || {};
        return {
            enabled: !!saved.enabled,
            charId: saved.charId || 'current',
            intervalHours: Math.max(0.1, Math.min(720, Number(saved.intervalHours) || 24)),
            workerEndpoint: String(saved.workerEndpoint || '').trim(),
            vapidPublicKey: String(saved.vapidPublicKey || '').trim()
        };
    } catch (e) {
        return { enabled: false, charId: 'current', intervalHours: 24, workerEndpoint: '', vapidPublicKey: '' };
    }
}

function saveProactiveNotifySettings(settings) {
    localStorage.setItem(BYND_NOTIFY_SETTINGS_KEY, JSON.stringify(settings || getProactiveNotifySettings()));
    syncProactiveServiceWorkerConfig();
}

function getProactiveNotifyState() {
    try {
        const state = JSON.parse(localStorage.getItem(BYND_NOTIFY_STATE_KEY) || '{}') || {};
        state.lastContact = state.lastContact || {};
        state.lastSent = state.lastSent || {};
        return state;
    } catch (e) {
        return { lastContact: {}, lastSent: {} };
    }
}

function saveProactiveNotifyState(state) {
    localStorage.setItem(BYND_NOTIFY_STATE_KEY, JSON.stringify(state || {}));
    syncProactiveServiceWorkerConfig();
}

function recordWechatUserContact(charId) {
    if (!charId) return;
    const state = getProactiveNotifyState();
    state.lastContact[charId] = Date.now();
    saveProactiveNotifyState(state);
    syncProactiveContactToWorker(charId, state.lastContact[charId]);
}
window.recordWechatUserContact = recordWechatUserContact;

function syncProactiveContactToWorker(charId, contactedAt) {
    const settings = getProactiveNotifySettings();
    if (!settings.enabled || !settings.workerEndpoint) return;
    const char = (window.myCharacters || []).find(item => item.id === charId);
    fetch(settings.workerEndpoint.replace(/\/+$/, '') + '/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            clientId: getProactiveNotifyClientId(),
            charId,
            charName: char ? getProactiveCharName(char) : '',
            contactedAt,
            origin: location.origin
        })
    }).catch(() => {});
}

function getProactiveNotifyChars(settings) {
    const chars = window.myCharacters || [];
    if (!settings || settings.charId === 'all') return chars;
    if (settings.charId === 'current') {
        const current = typeof getCurrentChatChar === 'function' ? getCurrentChatChar() : null;
        return current ? [current] : chars.slice(0, 1);
    }
    return chars.filter(char => char.id === settings.charId);
}

function getProactiveCharName(char) {
    return (char?.chatConfig && char.chatConfig.nickname) || char?.name || 'AI';
}

function renderProactiveNotifySettings() {
    const enabled = document.getElementById('notify-enabled');
    if (!enabled) return;
    const settings = getProactiveNotifySettings();
    const charSelect = document.getElementById('notify-char');
    const intervalInput = document.getElementById('notify-interval');
    const endpointInput = document.getElementById('notify-worker-endpoint');
    const vapidInput = document.getElementById('notify-vapid-key');
    enabled.checked = settings.enabled;
    if (intervalInput) intervalInput.value = String(settings.intervalHours);
    if (endpointInput) endpointInput.value = settings.workerEndpoint;
    if (vapidInput) vapidInput.value = settings.vapidPublicKey;
    if (charSelect) {
        const chars = window.myCharacters || [];
        charSelect.innerHTML = `
            <option value="current">当前聊天角色</option>
            <option value="all">所有角色</option>
            ${chars.map(char => `<option value="${musicEscapeAttr(char.id)}">${musicEscapeHtml(getProactiveCharName(char))}</option>`).join('')}
        `;
        charSelect.value = [...Array.from(charSelect.options)].some(opt => opt.value === settings.charId) ? settings.charId : 'current';
    }
    updateProactiveNotifyStatus();
}
window.renderProactiveNotifySettings = renderProactiveNotifySettings;

function buildProactiveNotifySyncPayload(settings = getProactiveNotifySettings(), state = getProactiveNotifyState()) {
    return {
        clientId: getProactiveNotifyClientId(),
        settings,
        state,
        origin: location.origin,
        url: location.origin + location.pathname + '?open=wechat',
        chars: getProactiveNotifyChars(settings).map(char => ({
            id: char.id,
            name: getProactiveCharName(char),
            avatar: char.avatar || ''
        }))
    };
}

function syncProactiveServiceWorkerConfig() {
    if (!('serviceWorker' in navigator)) return;
    const message = { type: 'BYND_NOTIFY_CONFIG', payload: buildProactiveNotifySyncPayload() };
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(message);
    }
    navigator.serviceWorker.ready.then(reg => {
        if (reg.active) reg.active.postMessage(message);
    }).catch(() => {});
}
window.syncProactiveServiceWorkerConfig = syncProactiveServiceWorkerConfig;

function updateProactiveNotifyStatus(text) {
    const el = document.getElementById('notify-status');
    if (!el) return;
    if (text) {
        el.textContent = text;
        return;
    }
    const settings = getProactiveNotifySettings();
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    const pushReady = settings.workerEndpoint && settings.vapidPublicKey ? '已填写推送后端' : '未配置云端推送';
    el.textContent = settings.enabled
        ? `已开启，浏览器权限：${permission}，${pushReady}。网页关闭后的准时通知需要云端推送。`
        : `未开启。iPhone 需要先把 bynd.ccwu.cc 添加到主屏幕再授权通知。`;
}

function saveProactiveNotifySettingsFromUI() {
    const next = {
        enabled: !!document.getElementById('notify-enabled')?.checked,
        charId: document.getElementById('notify-char')?.value || 'current',
        intervalHours: Math.max(0.1, Math.min(720, Number(document.getElementById('notify-interval')?.value) || 24)),
        workerEndpoint: String(document.getElementById('notify-worker-endpoint')?.value || '').trim(),
        vapidPublicKey: String(document.getElementById('notify-vapid-key')?.value || '').trim()
    };
    saveProactiveNotifySettings(next);
    updateProactiveNotifyStatus('已保存主动消息提醒设置。');
    syncProactivePushSubscription().catch(err => updateProactiveNotifyStatus('设置已保存，但云端订阅失败：' + err.message));
    checkProactiveNotifications(false);
}
window.saveProactiveNotifySettingsFromUI = saveProactiveNotifySettingsFromUI;

async function requestByndNotificationPermission() {
    if (!('Notification' in window)) {
        updateProactiveNotifyStatus('这个浏览器不支持网页通知。');
        return;
    }
    const result = await Notification.requestPermission();
    updateProactiveNotifyStatus(result === 'granted' ? '通知权限已允许。' : '通知权限没有允许。');
    if (result === 'granted') await syncProactivePushSubscription();
}
window.requestByndNotificationPermission = requestByndNotificationPermission;

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function syncProactivePushSubscription() {
    const settings = getProactiveNotifySettings();
    if (!settings.enabled || !settings.workerEndpoint || !settings.vapidPublicKey) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('当前浏览器不支持 Push API');
    if (!('Notification' in window)) throw new Error('当前浏览器不支持网页通知');
    if (Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
        subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(settings.vapidPublicKey)
        });
    }
    const payload = {
        clientId: getProactiveNotifyClientId(),
        subscription,
        settings,
        state: getProactiveNotifyState(),
        chars: buildProactiveNotifySyncPayload(settings).chars,
        origin: location.origin,
        url: location.origin + location.pathname + '?open=wechat',
        updatedAt: Date.now()
    };
    await fetch(settings.workerEndpoint.replace(/\/+$/, '') + '/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    updateProactiveNotifyStatus('云端推送订阅已同步。');
}

async function showByndLocalNotification(char, reason) {
    if (!char || !('Notification' in window) || Notification.permission !== 'granted') return;
    const title = `${getProactiveCharName(char)} 想找你`;
    const body = reason || '你有一段时间没有主动联系了。';
    const tag = 'bynd-proactive-' + char.id;
    if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
            body,
            tag,
            renotify: false,
            icon: char.avatar || undefined,
            badge: char.avatar || undefined,
            data: { charId: char.id, url: location.origin + location.pathname + '?open=wechat&char=' + encodeURIComponent(char.id) }
        });
    } else {
        new Notification(title, { body, tag, icon: char.avatar || undefined });
    }
}

function sendTestByndNotification() {
    const settings = getProactiveNotifySettings();
    const char = getProactiveNotifyChars(settings)[0] || (window.myCharacters || [])[0];
    requestByndNotificationPermission().then(() => {
        showByndLocalNotification(char, '这是一条 BYND 主动消息测试通知。');
    });
}
window.sendTestByndNotification = sendTestByndNotification;

function checkProactiveNotifications(force) {
    const settings = getProactiveNotifySettings();
    if (!settings.enabled) return;
    const chars = getProactiveNotifyChars(settings);
    if (!chars.length) return;
    const state = getProactiveNotifyState();
    const intervalMs = settings.intervalHours * 60 * 60 * 1000;
    const now = Date.now();
    chars.forEach(char => {
        const lastContact = state.lastContact[char.id] || 0;
        const lastSent = state.lastSent[char.id] || 0;
        const inactiveLongEnough = !lastContact || (now - lastContact >= intervalMs);
        const sentRecently = lastSent && now - lastSent < Math.max(intervalMs * 0.75, 30 * 60 * 1000);
        if ((force || inactiveLongEnough) && !sentRecently) {
            state.lastSent[char.id] = now;
            showByndLocalNotification(char, `${getProactiveCharName(char)} 已经等你 ${settings.intervalHours} 小时了。`);
        }
    });
    saveProactiveNotifyState(state);
}

function initProactiveNotify() {
    renderProactiveNotifySettings();
    syncProactiveServiceWorkerConfig();
    setInterval(() => checkProactiveNotifications(false), 60 * 1000);
    setTimeout(() => checkProactiveNotifications(false), 2500);
}

// --- 音乐 App ---
const MUSIC_COMMENTS_KEY = 'bynd_music_comments_v1';
const MUSIC_FAVORITES_KEY = 'bynd_music_favorites_v1';
const MUSIC_CO_LISTEN_KEY = 'bynd_music_co_listen_v1';
const MUSIC_SOURCE_MODE_KEY = 'bynd_music_source_mode_v1';
const MUSIC_SOURCE_SETTINGS_KEY = 'bynd_music_source_settings_v1';
const MUSIC_PLAYLISTS_KEY = 'bynd_music_playlists_v1';
const MUSIC_SOURCE_DEFAULTS = {
    metingBases: [
        'https://meting.mikus.ink/api',
        'https://meting.elysium-stack.cn/api'
    ],
    goApiBase: '',
    neteaseApiBase: 'https://wyapi.toubiec.cn',
    qqApiBase: ''
};
const MUSIC_PLATFORM_LABELS = {
    smart: '多源',
    netease: '网易云',
    tencent: 'QQ音乐',
    kugou: '酷狗',
    kuwo: '酷我',
    baidu: '百度音乐',
    archive: '公开曲库',
    local: '本地'
};
const MUSIC_PLATFORM_ORDER = ['netease', 'tencent', 'kugou', 'kuwo', 'baidu'];
const MUSIC_FALLBACK_TRACKS = [
    {
        id: 'archive:GeorgeFridericHandelHallelujah:Handel__Messiah__44_Hallelujah.mp3',
        trackName: 'Hallelujah Chorus',
        artistName: 'George Frideric Handel',
        collectionName: 'Messiah',
        artworkUrl100: 'https://archive.org/services/img/GeorgeFridericHandelHallelujah',
        audioUrl: 'https://archive.org/download/GeorgeFridericHandelHallelujah/Handel__Messiah__44_Hallelujah.mp3',
        trackViewUrl: 'https://archive.org/details/GeorgeFridericHandelHallelujah',
        primaryGenreName: 'Classical',
        sourceName: 'Internet Archive'
    },
    {
        id: 'archive:CanonInD-Pachelbel:07CanonPachelbel.m4a',
        trackName: 'Canon in D',
        artistName: 'Johann Pachelbel',
        collectionName: 'Public Domain Recording',
        artworkUrl100: 'https://archive.org/services/img/CanonInD-Pachelbel',
        audioUrl: 'https://archive.org/download/CanonInD-Pachelbel/07CanonPachelbel.m4a',
        trackViewUrl: 'https://archive.org/details/CanonInD-Pachelbel',
        primaryGenreName: 'Classical',
        sourceName: 'Internet Archive'
    }
];

let musicAudio = null;
let musicTracks = [];
let musicCurrentIndex = 0;
let musicIsPlaying = false;
let musicSearchTimer = null;
let musicProgressTimer = null;
let musicLyricsCache = {};
let musicDetailTab = 'lyrics';
let musicMainTab = 'home';
let musicAlbumFilter = '';
let musicCoListening = false;
let musicCoListenBusy = false;
let musicAiMessages = [];
let musicActiveLyricIndex = -1;
let musicCoListenLastTrackKey = '';

function musicEscapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function musicEscapeAttr(value) {
    return musicEscapeHtml(value).replace(/`/g, '&#96;');
}

function getMusicArtwork(track) {
    return track?.artworkUrl100 || track?.artwork || '';
}

function normalizeMetingAsset(value) {
    if (!value) return '';
    const text = String(value).trim();
    return /^https?:\/\//i.test(text) ? text.replace(/^http:\/\//i, 'https://') : '';
}

function getFallbackCover() {
    return `
        <div class="music-cover-fallback">
            <i class="ri-disc-line"></i>
            <span>BYND</span>
        </div>
    `;
}

function normalizeMusicTrack(track) {
    return {
        id: track.id || `music_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        trackName: track.trackName || track.title || track.collectionName || 'Untitled',
        artistName: track.artistName || track.creator || 'Unknown Artist',
        collectionName: track.collectionName || track.album || track.primaryGenreName || 'Full track',
        artworkUrl100: track.artworkUrl100 || '',
        audioUrl: track.audioUrl || '',
        trackViewUrl: track.trackViewUrl || '',
        lyricsUrl: track.lyricsUrl || '',
        lyricsText: track.lyricsText || '',
        remoteId: track.remoteId || track.songId || '',
        sourceKey: track.sourceKey || '',
        sourceMeta: track.sourceMeta || '',
        primaryGenreName: track.primaryGenreName || 'Archive Audio',
        sourceName: track.sourceName || 'Internet Archive',
        duration: track.duration || null
    };
}

function loadMusicSourceSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(MUSIC_SOURCE_SETTINGS_KEY) || '{}') || {};
        const metingBases = Array.isArray(saved.metingBases) ? saved.metingBases : String(saved.metingBases || '').split(/\n|,/);
        return {
            metingBases: metingBases.map(url => cleanMusicBaseUrl(url)).filter(Boolean),
            goApiBase: cleanMusicBaseUrl(saved.goApiBase || ''),
            neteaseApiBase: cleanMusicBaseUrl(saved.neteaseApiBase || MUSIC_SOURCE_DEFAULTS.neteaseApiBase),
            qqApiBase: cleanMusicBaseUrl(saved.qqApiBase || '')
        };
    } catch (e) {
        return { ...MUSIC_SOURCE_DEFAULTS };
    }
}

function getMusicSourceSettings() {
    const settings = loadMusicSourceSettings();
    if (!settings.metingBases.length) settings.metingBases = [...MUSIC_SOURCE_DEFAULTS.metingBases];
    if (!settings.neteaseApiBase) settings.neteaseApiBase = MUSIC_SOURCE_DEFAULTS.neteaseApiBase;
    return settings;
}

function cleanMusicBaseUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

function getMusicSourceMode() {
    return localStorage.getItem(MUSIC_SOURCE_MODE_KEY) || 'smart';
}

function setMusicSourceMode(mode) {
    const nextMode = MUSIC_PLATFORM_LABELS[mode] ? mode : 'smart';
    localStorage.setItem(MUSIC_SOURCE_MODE_KEY, nextMode);
    syncMusicSourceUI();
    const input = document.getElementById('music-search-input');
    searchMusic(input?.value || '周杰伦');
}
window.setMusicSourceMode = setMusicSourceMode;

function toggleMusicSourceConfig() {
    const panel = document.getElementById('music-source-config');
    if (!panel) return;
    panel.classList.toggle('hidden');
    syncMusicSourceUI();
}
window.toggleMusicSourceConfig = toggleMusicSourceConfig;

function syncMusicSourceUI() {
    const mode = getMusicSourceMode();
    document.querySelectorAll('#music-source-chips button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.source === mode);
    });
    const settings = getMusicSourceSettings();
    const metingInput = document.getElementById('music-meting-bases');
    const goInput = document.getElementById('music-go-api-base');
    const neteaseInput = document.getElementById('music-netease-api-base');
    const qqInput = document.getElementById('music-qq-api-base');
    if (metingInput) metingInput.value = settings.metingBases.join('\n');
    if (goInput) goInput.value = settings.goApiBase || '';
    if (neteaseInput) neteaseInput.value = settings.neteaseApiBase || '';
    if (qqInput) qqInput.value = settings.qqApiBase || '';
    renderMusicImportedPlaylists();
}

function saveMusicSourceSettingsFromUI() {
    const metingBases = String(document.getElementById('music-meting-bases')?.value || '')
        .split(/\n|,/)
        .map(url => cleanMusicBaseUrl(url))
        .filter(Boolean);
    const settings = {
        metingBases,
        goApiBase: cleanMusicBaseUrl(document.getElementById('music-go-api-base')?.value || ''),
        neteaseApiBase: cleanMusicBaseUrl(document.getElementById('music-netease-api-base')?.value || ''),
        qqApiBase: cleanMusicBaseUrl(document.getElementById('music-qq-api-base')?.value || '')
    };
    localStorage.setItem(MUSIC_SOURCE_SETTINGS_KEY, JSON.stringify(settings));
    syncMusicSourceUI();
    const input = document.getElementById('music-search-input');
    searchMusic(input?.value || '周杰伦');
}
window.saveMusicSourceSettingsFromUI = saveMusicSourceSettingsFromUI;

function getMusicPlaylistsStore() {
    try {
        const list = JSON.parse(localStorage.getItem(MUSIC_PLAYLISTS_KEY) || '[]');
        return Array.isArray(list) ? list.filter(item => item && item.id) : [];
    } catch (e) {
        return [];
    }
}

function saveMusicPlaylistsStore(list) {
    localStorage.setItem(MUSIC_PLAYLISTS_KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, 30) : []));
}

function renderMusicImportedPlaylists() {
    const el = document.getElementById('music-imported-playlists');
    if (!el) return;
    const list = getMusicPlaylistsStore();
    if (!list.length) {
        el.innerHTML = '<div class="music-import-empty">还没有导入歌单，粘贴网易云 / QQ / 酷狗链接试试。</div>';
        return;
    }
    el.innerHTML = list.map(item => `
        <div class="music-import-row">
            <button type="button" onclick="loadImportedMusicPlaylist('${musicEscapeAttr(item.id)}')">
                <i class="ri-play-list-2-line"></i>
                <span>${musicEscapeHtml(item.name || item.platformLabel || '导入歌单')}</span>
                <em>${musicEscapeHtml(item.platformLabel || '')} · ${Array.isArray(item.tracks) ? item.tracks.length : 0} 首</em>
            </button>
            <i class="ri-close-line" onclick="deleteImportedMusicPlaylist('${musicEscapeAttr(item.id)}')"></i>
        </div>
    `).join('');
}

function extractMusicPlaylistInfo(raw, fallbackPlatform) {
    const text = String(raw || '').trim();
    const platform = fallbackPlatform || (
        /y\.qq\.com|qq\.com/i.test(text) ? 'tencent' :
        /kugou\.com/i.test(text) ? 'kugou' :
        /kuwo\.cn/i.test(text) ? 'kuwo' :
        'netease'
    );
    let id = '';
    const patterns = [
        /[?&]id=(\d+)/i,
        /playlist[/?#]+(?:id=)?(\d+)/i,
        /songlist[/?#]+(\d+)/i,
        /specialid=(\d+)/i,
        /\/(\d{5,})(?:[/?#]|$)/
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) { id = match[1]; break; }
    }
    if (!id && /^\d{4,}$/.test(text)) id = text;
    return { platform, id, raw: text };
}

async function importMusicPlaylist() {
    const input = document.getElementById('music-playlist-url');
    const select = document.getElementById('music-playlist-platform');
    const info = extractMusicPlaylistInfo(input?.value || '', select?.value || 'netease');
    if (!info.id) {
        showMusicStatus('没有识别到歌单 ID，换成完整歌单链接或纯数字 ID。');
        return;
    }
    showMusicStatus('正在导入歌单...');
    try {
        let tracks = await fetchCustomMusicPlaylist(info.platform, info.id);
        if (!tracks.length) tracks = await fetchMetingPlaylist(info.platform, info.id);
        if (!tracks.length) throw new Error('empty playlist');
        const platformLabel = MUSIC_PLATFORM_LABELS[info.platform] || info.platform;
        const item = {
            id: `playlist_${info.platform}_${info.id}`,
            platform: info.platform,
            platformLabel,
            playlistId: info.id,
            name: `${platformLabel}歌单 ${info.id}`,
            sourceUrl: info.raw,
            tracks: tracks.slice(0, 80),
            createdAt: Date.now()
        };
        const list = getMusicPlaylistsStore().filter(row => row.id !== item.id);
        list.unshift(item);
        saveMusicPlaylistsStore(list);
        if (input) input.value = '';
        musicTracks = item.tracks.map(normalizeMusicTrack);
        musicCurrentIndex = 0;
        musicMainTab = 'home';
        musicAlbumFilter = '';
        closeMusicDetail();
        renderMusicApp();
        renderMusicImportedPlaylists();
        showMusicStatus(`已导入 ${platformLabel} 歌单，${musicTracks.length} 首。`);
    } catch (e) {
        showMusicStatus('导入失败：当前公开 Meting 源没有返回可播放音频，换个源或接自己的后端。');
    }
}
window.importMusicPlaylist = importMusicPlaylist;

async function fetchMetingPlaylist(platform, playlistId) {
    const settings = getMusicSourceSettings();
    const bases = settings.metingBases?.length ? settings.metingBases : MUSIC_SOURCE_DEFAULTS.metingBases;
    const settled = await Promise.allSettled(bases.map(async base => {
        const params = new URLSearchParams({ server: platform, type: 'playlist', id: String(playlistId) });
        const json = await fetchJsonWithTimeout(`${base}?${params.toString()}`, {}, 10000);
        const rows = extractMusicRows(json).slice(0, 40);
        const hydrated = await Promise.allSettled(rows.map(item => hydrateMetingTrack(base, platform, item)));
        return hydrated.flatMap(item => item.status === 'fulfilled' && item.value ? [item.value] : []);
    }));
    return dedupeMusicTracks(settled.flatMap(item => item.status === 'fulfilled' ? item.value : []));
}

async function fetchCustomMusicPlaylist(platform, playlistId) {
    const settings = getMusicSourceSettings();
    if (platform === 'netease' && settings.neteaseApiBase) {
        const base = settings.neteaseApiBase;
        try {
            const json = await fetchMusicJsonFlexible([
                `${base}/playlist?${new URLSearchParams({ id: String(playlistId) }).toString()}`,
                `${base}/api/playlist?${new URLSearchParams({ id: String(playlistId) }).toString()}`,
                `${base}/playlist`
            ], { id: String(playlistId) });
            const rows = extractMusicRows(json).slice(0, 80);
            const settled = await Promise.allSettled(rows.map(song => hydrateNeteaseMusicApiTrack(base, song)));
            const tracks = settled.flatMap(item => item.status === 'fulfilled' && item.value ? [item.value] : []);
            if (tracks.length) return dedupeMusicTracks(tracks);
        } catch (e) {}
    }

    if (settings.goApiBase) {
        const base = settings.goApiBase;
        const urls = [
            `${base}/playlist?${new URLSearchParams({ id: String(playlistId), source: platform }).toString()}`,
            `${base}/api/playlist?${new URLSearchParams({ id: String(playlistId), platform }).toString()}`,
            `${base}/music/playlist?${new URLSearchParams({ id: String(playlistId), platform }).toString()}`
        ];
        for (const url of urls) {
            try {
                const json = await fetchJsonWithTimeout(url, {}, 10000);
                const rows = extractMusicRows(json).slice(0, 80);
                const tracks = rows.map(item => normalizeGenericMusicTrack(item, platform, '聚合歌单')).filter(track => track.audioUrl);
                if (tracks.length) return dedupeMusicTracks(tracks);
            } catch (e) {}
        }
    }

    return [];
}

function loadImportedMusicPlaylist(id) {
    const item = getMusicPlaylistsStore().find(row => row.id === id);
    if (!item || !Array.isArray(item.tracks)) return;
    musicTracks = item.tracks.map(normalizeMusicTrack);
    musicCurrentIndex = 0;
    musicMainTab = 'home';
    musicAlbumFilter = '';
    closeMusicDetail();
    renderMusicApp();
    showMusicStatus(`已打开歌单：${item.name || item.platformLabel || '导入歌单'}`);
}
window.loadImportedMusicPlaylist = loadImportedMusicPlaylist;

function deleteImportedMusicPlaylist(id) {
    saveMusicPlaylistsStore(getMusicPlaylistsStore().filter(item => item.id !== id));
    renderMusicImportedPlaylists();
}
window.deleteImportedMusicPlaylist = deleteImportedMusicPlaylist;

function initMusicApp() {
    const win = document.getElementById('app-music-window');
    if (!win || win.dataset.ready === '1') return;
    win.dataset.ready = '1';
    musicTracks = MUSIC_FALLBACK_TRACKS.map(normalizeMusicTrack);
    syncMusicSourceUI();
    renderMusicApp();
    searchMusic('周杰伦');
}

function renderMusicApp() {
    renderMusicNowPlaying();
    renderMusicMainTab();
    renderMusicDetail();
    updateMusicProgress();
}

function renderMusicNowPlaying() {
    const track = musicTracks[musicCurrentIndex] || normalizeMusicTrack(MUSIC_FALLBACK_TRACKS[0]);
    const cover = document.getElementById('music-now-cover');
    const title = document.getElementById('music-now-title');
    const artist = document.getElementById('music-now-artist');
    const album = document.getElementById('music-now-album');
    const playIcon = document.getElementById('music-play-icon');
    const detailPlayIcon = document.getElementById('music-detail-play-icon');
    const source = document.getElementById('music-source-link');
    const win = document.getElementById('app-music-window');
    const artwork = getMusicArtwork(track);

    if (win) win.classList.toggle('is-playing', musicIsPlaying);
    if (cover) {
        cover.innerHTML = artwork
            ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(track.trackName)}" onerror="this.parentElement.innerHTML=getFallbackCover()">`
            : getFallbackCover();
    }
    if (title) title.textContent = track.trackName;
    if (artist) artist.textContent = track.artistName;
    if (album) album.textContent = track.collectionName || track.primaryGenreName || track.sourceName;
    if (playIcon) playIcon.className = musicIsPlaying ? 'ri-pause-fill' : 'ri-play-fill';
    if (detailPlayIcon) detailPlayIcon.className = musicIsPlaying ? 'ri-pause-fill' : 'ri-play-fill';
    if (source) {
        source.textContent = track.sourceName || 'Source';
        source.classList.toggle('hidden', !track.trackViewUrl);
        source.href = track.trackViewUrl || '#';
    }
}

function switchMusicMainTab(tab) {
    musicMainTab = ['home', 'albums', 'favorites'].includes(tab) ? tab : 'home';
    if (musicMainTab !== 'albums') musicAlbumFilter = '';
    syncMusicMainTabs();
    renderMusicMainTab();
}
window.switchMusicMainTab = switchMusicMainTab;

function syncMusicMainTabs() {
    document.querySelectorAll('.music-bottom-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.musicTab === musicMainTab);
    });
}

function renderMusicMainTab() {
    syncMusicMainTabs();
    const title = document.querySelector('.music-list-title strong');
    if (title) {
        title.textContent = musicMainTab === 'albums'
            ? (musicAlbumFilter || '专辑')
            : (musicMainTab === 'favorites' ? '收藏' : '完整音频');
    }
    if (musicMainTab === 'albums') {
        renderMusicAlbums();
    } else if (musicMainTab === 'favorites') {
        renderMusicFavorites();
    } else {
        renderMusicList();
    }
}

function renderMusicList() {
    const list = document.getElementById('music-track-list');
    if (!list) return;
    if (!musicTracks.length) {
        list.innerHTML = `<div class="music-empty-state"><strong>没有搜索结果</strong><span>换个歌名、歌手或切换音乐源试试。</span></div>`;
        return;
    }
    list.innerHTML = musicTracks.map((track, index) => {
        const artwork = getMusicArtwork(track);
        const liked = isMusicFavorite(track);
        return `
            <button type="button" class="music-track-item ${index === musicCurrentIndex ? 'active' : ''}" onclick="openMusicDetail(${index})">
                <div class="music-track-art">
                    ${artwork ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(track.trackName)}" onerror="this.remove()">` : '<i class="ri-music-2-line"></i>'}
                </div>
                <div class="music-track-meta">
                    <strong>${musicEscapeHtml(track.trackName)}</strong>
                    <span>${musicEscapeHtml(track.artistName)} · ${musicEscapeHtml(track.sourceName || 'Full audio')}</span>
                </div>
                <i class="${liked ? 'ri-heart-3-fill' : (index === musicCurrentIndex && musicIsPlaying ? 'ri-volume-up-line' : 'ri-arrow-right-s-line')}"></i>
            </button>
        `;
    }).join('');
}

function renderMusicAlbums() {
    const list = document.getElementById('music-track-list');
    if (!list) return;
    if (musicAlbumFilter) {
        const rows = musicTracks
            .map((track, index) => ({ track, index }))
            .filter(item => (item.track.collectionName || '未命名专辑') === musicAlbumFilter);
        list.innerHTML = `
            <button type="button" class="music-album-back" onclick="closeMusicAlbum()">
                <i class="ri-arrow-left-s-line"></i><span>返回专辑列表</span>
            </button>
            ${rows.map(({ track, index }) => renderMusicTrackRow(track, index)).join('') || '<div class="music-empty-state"><strong>这张专辑还没有歌曲</strong></div>'}
        `;
        return;
    }

    const groups = new Map();
    musicTracks.forEach((track, index) => {
        const name = track.collectionName || '未命名专辑';
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push({ track, index });
    });
    if (!groups.size) {
        list.innerHTML = '<div class="music-empty-state"><strong>还没有专辑</strong><span>先搜索几首歌，专辑会自动聚合。</span></div>';
        return;
    }
    list.innerHTML = Array.from(groups.entries()).map(([name, items]) => {
        const first = items[0]?.track || {};
        const artwork = getMusicArtwork(first);
        const artists = Array.from(new Set(items.map(item => item.track.artistName).filter(Boolean))).slice(0, 2).join(' / ');
        return `
            <button type="button" class="music-album-item" data-album="${musicEscapeAttr(name)}" onclick="openMusicAlbum(this.dataset.album)">
                <div class="music-album-art">${artwork ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(name)}" onerror="this.remove()">` : '<i class="ri-album-line"></i>'}</div>
                <div class="music-track-meta">
                    <strong>${musicEscapeHtml(name)}</strong>
                    <span>${musicEscapeHtml(artists || first.sourceName || 'Album')} · ${items.length} 首</span>
                </div>
                <i class="ri-arrow-right-s-line"></i>
            </button>
        `;
    }).join('');
}

function openMusicAlbum(name) {
    musicAlbumFilter = String(name || '');
    renderMusicMainTab();
}
window.openMusicAlbum = openMusicAlbum;

function closeMusicAlbum() {
    musicAlbumFilter = '';
    renderMusicMainTab();
}
window.closeMusicAlbum = closeMusicAlbum;

function renderMusicTrackRow(track, index) {
    const artwork = getMusicArtwork(track);
    const liked = isMusicFavorite(track);
    return `
        <button type="button" class="music-track-item ${index === musicCurrentIndex ? 'active' : ''}" onclick="openMusicDetail(${index})">
            <div class="music-track-art">
                ${artwork ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(track.trackName)}" onerror="this.remove()">` : '<i class="ri-music-2-line"></i>'}
            </div>
            <div class="music-track-meta">
                <strong>${musicEscapeHtml(track.trackName)}</strong>
                <span>${musicEscapeHtml(track.artistName)} · ${musicEscapeHtml(track.sourceName || 'Full audio')}</span>
            </div>
            <i class="${liked ? 'ri-heart-3-fill' : 'ri-arrow-right-s-line'}"></i>
        </button>
    `;
}

function getMusicFavoritesStore() {
    try {
        return JSON.parse(localStorage.getItem(MUSIC_FAVORITES_KEY) || '[]') || [];
    } catch (e) {
        return [];
    }
}

function saveMusicFavoritesStore(list) {
    localStorage.setItem(MUSIC_FAVORITES_KEY, JSON.stringify(Array.isArray(list) ? list : []));
}

function getMusicTrackKey(track) {
    if (!track) return '';
    return `${track.remoteId || track.id || ''}|${track.audioUrl || ''}|${track.trackName || ''}|${track.artistName || ''}`.toLowerCase();
}

function isMusicFavorite(track) {
    const key = getMusicTrackKey(track);
    if (!key) return false;
    return getMusicFavoritesStore().some(item => getMusicTrackKey(item) === key);
}

function toggleMusicFavorite() {
    const track = musicTracks[musicCurrentIndex];
    if (!track) return;
    const key = getMusicTrackKey(track);
    const store = getMusicFavoritesStore();
    const index = store.findIndex(item => getMusicTrackKey(item) === key);
    if (index >= 0) {
        store.splice(index, 1);
        showMusicStatus('已取消收藏。');
    } else {
        store.unshift({ ...track, favoritedAt: Date.now() });
        showMusicStatus('已加入收藏。');
    }
    saveMusicFavoritesStore(store.slice(0, 120));
    updateMusicFavoriteButton();
    renderMusicMainTab();
}
window.toggleMusicFavorite = toggleMusicFavorite;

function renderMusicFavorites() {
    const list = document.getElementById('music-track-list');
    if (!list) return;
    const favorites = getMusicFavoritesStore().map(normalizeMusicTrack);
    if (!favorites.length) {
        list.innerHTML = '<div class="music-empty-state"><strong>还没有收藏</strong><span>在歌词页面点收藏，喜欢的歌会留在这里。</span></div>';
        return;
    }
    list.innerHTML = favorites.map((track, index) => {
        const artwork = getMusicArtwork(track);
        return `
            <button type="button" class="music-track-item" onclick="openFavoriteMusicTrack(${index})">
                <div class="music-track-art">${artwork ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(track.trackName)}" onerror="this.remove()">` : '<i class="ri-heart-3-line"></i>'}</div>
                <div class="music-track-meta">
                    <strong>${musicEscapeHtml(track.trackName)}</strong>
                    <span>${musicEscapeHtml(track.artistName)} · ${musicEscapeHtml(track.collectionName || track.sourceName || '收藏')}</span>
                </div>
                <i class="ri-arrow-right-s-line"></i>
            </button>
        `;
    }).join('');
}

function openFavoriteMusicTrack(index) {
    const track = getMusicFavoritesStore().map(normalizeMusicTrack)[index];
    if (!track) return;
    const existingIndex = musicTracks.findIndex(item => getMusicTrackKey(item) === getMusicTrackKey(track));
    if (existingIndex >= 0) {
        openMusicDetail(existingIndex);
        return;
    }
    musicTracks.unshift(track);
    openMusicDetail(0);
}
window.openFavoriteMusicTrack = openFavoriteMusicTrack;

function selectMusicTrack(index, autoplay) {
    if (!musicTracks[index]) return;
    const prevKey = getMusicTrackKey(musicTracks[musicCurrentIndex]);
    musicCurrentIndex = index;
    const track = musicTracks[musicCurrentIndex];
    const nextKey = getMusicTrackKey(track);
    if (prevKey !== nextKey) {
        musicActiveLyricIndex = -1;
        musicCoListenLastTrackKey = '';
    }
    if (!musicAudio) setupMusicAudio();
    if (track.audioUrl && musicAudio.src !== track.audioUrl) {
        musicAudio.src = track.audioUrl;
        musicAudio.load();
    } else if (!track.audioUrl) {
        musicAudio.removeAttribute('src');
        musicAudio.load();
    }
    musicIsPlaying = false;
    renderMusicApp();
    if (autoplay) toggleMusicPlayback(true);
}
window.selectMusicTrack = selectMusicTrack;

function setupMusicAudio() {
    if (musicAudio) return;
    musicAudio = new Audio();
    musicAudio.preload = 'metadata';
    musicAudio.addEventListener('play', () => {
        musicIsPlaying = true;
        startMusicProgressTimer();
        renderMusicNowPlaying();
        renderMusicMainTab();
    });
    musicAudio.addEventListener('pause', () => {
        musicIsPlaying = false;
        renderMusicNowPlaying();
        renderMusicMainTab();
    });
    musicAudio.addEventListener('loadedmetadata', updateMusicProgress);
    musicAudio.addEventListener('ended', () => playNextMusicTrack());
    musicAudio.addEventListener('timeupdate', updateMusicProgress);
}

function toggleMusicPlayback(forcePlay) {
    const track = musicTracks[musicCurrentIndex];
    if (!track) return;
    if (!track.audioUrl) {
        showMusicStatus('这条结果没有可播放的完整音频，换一首试试。');
        return;
    }
    setupMusicAudio();
    if (musicAudio.src !== track.audioUrl) {
        musicAudio.src = track.audioUrl;
        musicAudio.load();
    }
    if (forcePlay || musicAudio.paused) {
        musicAudio.play().catch(() => showMusicStatus('浏览器拦截了播放，点一下播放键再试。'));
        if (musicCoListening) queueMusicAiReaction('play');
    } else {
        musicAudio.pause();
    }
}
window.toggleMusicPlayback = toggleMusicPlayback;

function playNextMusicTrack() {
    if (!musicTracks.length) return;
    musicCurrentIndex = (musicCurrentIndex + 1) % musicTracks.length;
    selectMusicTrack(musicCurrentIndex, true);
}
window.playNextMusicTrack = playNextMusicTrack;

function playPrevMusicTrack() {
    if (!musicTracks.length) return;
    musicCurrentIndex = (musicCurrentIndex - 1 + musicTracks.length) % musicTracks.length;
    selectMusicTrack(musicCurrentIndex, true);
}
window.playPrevMusicTrack = playPrevMusicTrack;

function updateMusicProgress() {
    const bar = document.getElementById('music-progress-fill');
    const elapsed = document.getElementById('music-time-elapsed');
    const duration = document.getElementById('music-time-duration');
    const current = musicAudio && Number.isFinite(musicAudio.currentTime) ? musicAudio.currentTime : 0;
    const trackDuration = musicTracks[musicCurrentIndex]?.duration;
    const total = musicAudio && Number.isFinite(musicAudio.duration) ? musicAudio.duration : (trackDuration || 0);
    const percent = total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 0;
    if (bar) bar.style.width = `${percent}%`;
    if (elapsed) elapsed.textContent = formatMusicTime(current);
    if (duration) duration.textContent = total > 0 ? formatMusicTime(total) : '--:--';
    updateActiveMusicLyric(current);
}

function startMusicProgressTimer() {
    clearInterval(musicProgressTimer);
    musicProgressTimer = setInterval(() => {
        if (!musicAudio || musicAudio.paused) {
            clearInterval(musicProgressTimer);
            return;
        }
        updateMusicProgress();
    }, 400);
}

function formatMusicTime(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function seekMusic(event) {
    if (!musicAudio || !musicAudio.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    musicAudio.currentTime = musicAudio.duration * percent;
    updateMusicProgress();
}
window.seekMusic = seekMusic;

function handleMusicSearchInput(value) {
    clearTimeout(musicSearchTimer);
    musicSearchTimer = setTimeout(() => searchMusic(value), 420);
}
window.handleMusicSearchInput = handleMusicSearchInput;

async function searchMusic(term) {
    const query = String(term || '').trim() || '周杰伦';
    musicMainTab = 'home';
    musicAlbumFilter = '';
    const mode = getMusicSourceMode();
    const label = MUSIC_PLATFORM_LABELS[mode] || '多源';
    showMusicStatus(`正在搜索${label}音乐源...`);
    try {
        const tracks = await searchAcrossMusicSources(query, mode);
        if (!tracks.length) throw new Error('empty result');
        musicTracks = tracks;
        musicCurrentIndex = 0;
        if (musicAudio) musicAudio.pause();
        musicIsPlaying = false;
        closeMusicDetail();
        renderMusicApp();
        showMusicStatus(buildMusicSourceSummary(tracks));
    } catch (e) {
        musicTracks = MUSIC_FALLBACK_TRACKS.map(normalizeMusicTrack);
        musicCurrentIndex = 0;
        if (musicAudio) musicAudio.pause();
        musicIsPlaying = false;
        closeMusicDetail();
        renderMusicApp();
        showMusicStatus('在线音乐源暂时不可用，已切到公开备用曲目。');
    }
}
window.searchMusic = searchMusic;

async function searchAcrossMusicSources(query, mode) {
    const settings = getMusicSourceSettings();
    const tasks = [];
    const platforms = mode === 'smart' ? MUSIC_PLATFORM_ORDER : [mode];

    platforms.filter(platform => platform !== 'archive').forEach(platform => {
        tasks.push(searchMetingMusic(query, platform, settings));
        if (settings.goApiBase) tasks.push(searchGoMusicApi(query, platform, settings));
        if (platform === 'netease' && settings.neteaseApiBase) tasks.push(searchNeteaseMusicApi(query, settings));
        if (platform === 'tencent' && settings.qqApiBase) tasks.push(searchTencentParserMusic(query, settings));
    });

    if (mode === 'archive' || mode === 'smart') {
        tasks.push(searchInternetArchiveMusic(query));
    }

    const settled = await Promise.allSettled(tasks);
    const tracks = settled.flatMap(item => item.status === 'fulfilled' ? item.value : []);
    return dedupeMusicTracks(tracks).slice(0, 28);
}

function dedupeMusicTracks(tracks) {
    const seen = new Set();
    return tracks.filter(track => {
        if (!track?.audioUrl) return false;
        const key = `${track.sourceName}|${track.remoteId || track.audioUrl || track.trackViewUrl || track.trackName}|${track.trackName}|${track.artistName}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildMusicSourceSummary(tracks) {
    const counts = tracks.reduce((acc, track) => {
        const name = track.sourceName || '音乐源';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {});
    const text = Object.entries(counts).slice(0, 4).map(([name, count]) => `${name} ${count}`).join(' · ');
    return text ? `已聚合：${text}` : '已载入搜索结果。';
}

async function fetchJsonWithTimeout(url, options = {}, timeout = 6500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (!res.ok) throw new Error(`music api ${res.status}`);
        const text = await res.text();
        if (!text.trim()) return null;
        return JSON.parse(text);
    } finally {
        clearTimeout(timer);
    }
}

async function searchMetingMusic(query, platform, settings) {
    const bases = settings.metingBases?.length ? settings.metingBases : MUSIC_SOURCE_DEFAULTS.metingBases;
    const settled = await Promise.allSettled(bases.map(base => searchMetingBase(base, platform, query)));
    return dedupeMusicTracks(settled.flatMap(item => item.status === 'fulfilled' ? item.value : []));
}

async function searchMetingBase(base, platform, query) {
    const params = new URLSearchParams({
        server: platform,
        type: 'search',
        id: query,
        limit: '10'
    });
    const json = await fetchJsonWithTimeout(`${base}?${params.toString()}`);
    const rows = extractMusicRows(json).slice(0, 8);
    const settled = await Promise.allSettled(rows.map(item => hydrateMetingTrack(base, platform, item)));
    return settled.flatMap(item => item.status === 'fulfilled' && item.value ? [item.value] : []);
}

async function hydrateMetingTrack(base, platform, item) {
    const id = item.id || item.song_id || item.songmid || item.mid || item.url_id;
    const urlId = item.url_id || item.id || item.song_id || item.songmid || item.mid;
    const lyricId = item.lyric_id || item.id || item.song_id || item.songmid || item.mid;
    const picId = item.pic_id || item.picId || item.cover_id || item.id;
    const directUrl = pickMusicUrl(item);
    const directLyrics = pickMusicLyrics(item.lrc || item.lyric || item.lyrics);
    const lyricsUrl = normalizeMetingAsset(item.lrc || item.lyric || item.lyrics);
    const [audioUrl, artworkUrl100] = await Promise.all([
        directUrl ? Promise.resolve(directUrl) : fetchMetingAsset(base, platform, 'url', urlId),
        item.pic || item.cover || item.artwork || item.artworkUrl100 ? Promise.resolve(item.pic || item.cover || item.artwork || item.artworkUrl100) : fetchMetingAsset(base, platform, 'pic', picId, { size: '300' })
    ]);
    return normalizeMusicTrack({
        id: `meting:${platform}:${id || urlId || item.name}:${audioUrl}`,
        remoteId: String(id || urlId || ''),
        trackName: item.name || item.title || item.songname || 'Untitled',
        artistName: normalizeMusicArtist(item.artist || item.artists || item.singer || item.author),
        collectionName: item.album || item.albumname || MUSIC_PLATFORM_LABELS[platform],
        artworkUrl100,
        audioUrl,
        trackViewUrl: getMusicPlatformUrl(platform, id || urlId),
        primaryGenreName: 'Online Music',
        sourceName: MUSIC_PLATFORM_LABELS[platform] || platform,
        sourceKey: 'meting',
        sourceMeta: JSON.stringify({ base, platform, lyricId }),
        lyricsUrl,
        lyricsText: directLyrics,
        duration: normalizeMusicDuration(item.duration || item.interval)
    });
}

async function fetchMetingAsset(base, platform, type, id, extra = {}) {
    if (!id) return '';
    const params = new URLSearchParams({ server: platform, type, id: String(id), ...extra });
    if (type === 'url') {
        params.set('br', '320');
        params.set('r', '320');
    }
    const requestUrl = `${base}?${params.toString()}`;
    if (type === 'url' || type === 'pic') return requestUrl;
    try {
        const json = await fetchJsonWithTimeout(requestUrl);
        return type === 'lyric' ? pickMusicLyrics(json) : pickMusicUrl(json);
    } catch (e) {}
    return '';
}

async function searchNeteaseMusicApi(query, settings) {
    const base = settings.neteaseApiBase;
    if (!base) return [];
    const json = await fetchMusicJsonFlexible([
        `${base}/search?${new URLSearchParams({ keywords: query, limit: '10' }).toString()}`,
        `${base}/search?${new URLSearchParams({ keyword: query, limit: '10' }).toString()}`,
        `${base}/cloudsearch?${new URLSearchParams({ keywords: query, limit: '10' }).toString()}`,
        `${base}/api/search?${new URLSearchParams({ keywords: query, keyword: query, limit: '10' }).toString()}`,
        `${base}/api/cloudsearch?${new URLSearchParams({ keywords: query, limit: '10' }).toString()}`,
        `${base}/search`
    ], { keywords: query, keyword: query, limit: 10 });
    const songs = extractMusicRows(json?.result?.songs || json?.songs || json?.data || json).slice(0, 8);
    const settled = await Promise.allSettled(songs.map(song => hydrateNeteaseMusicApiTrack(base, song)));
    return settled.flatMap(item => item.status === 'fulfilled' && item.value ? [item.value] : []);
}

async function hydrateNeteaseMusicApiTrack(base, song) {
    const id = song.id || song.songId || song.song_id;
    if (!id) return null;
    let detail = null;
    try {
        detail = await fetchMusicJsonFlexible([
            `${base}/song?${new URLSearchParams({ id: String(id) }).toString()}`,
            `${base}/song/url/v1?${new URLSearchParams({ id: String(id), level: 'exhigh' }).toString()}`,
            `${base}/song/url?${new URLSearchParams({ id: String(id), br: '320000' }).toString()}`,
            `${base}/api/song/url/v1?${new URLSearchParams({ id: String(id), level: 'exhigh' }).toString()}`,
            `${base}/api/song/url?${new URLSearchParams({ id: String(id), br: '320000' }).toString()}`,
            `${base}/parse?${new URLSearchParams({ id: String(id) }).toString()}`,
            `${base}/song`
        ], { id: String(id), level: 'exhigh' });
    } catch (e) {}
    const merged = { ...song, ...flattenMusicPayload(detail) };
    const audioUrl = pickMusicUrl(merged);
    if (!audioUrl) return null;
    return normalizeMusicTrack({
        id: `netease-api:${id}:${audioUrl}`,
        remoteId: String(id),
        trackName: merged.name || merged.title || song.name || 'Untitled',
        artistName: normalizeMusicArtist(merged.artists || merged.artist || song.artists || song.artist),
        collectionName: merged.album || merged.albumName || song.album || '网易云',
        artworkUrl100: merged.pic || merged.cover || merged.image || merged.picUrl || '',
        audioUrl,
        trackViewUrl: `https://music.163.com/song?id=${encodeURIComponent(id)}`,
        sourceName: '网易无损',
        sourceKey: 'netease-api',
        lyricsText: pickMusicLyrics(merged),
        duration: normalizeMusicDuration(merged.duration || song.duration)
    });
}

async function searchTencentParserMusic(query, settings) {
    const base = settings.qqApiBase;
    if (!base || !/y\.qq\.com|qq\.com|songmid=|songid=/i.test(query)) return [];
    const url = `${base}/song?${new URLSearchParams({ url: query }).toString()}`;
    const json = await fetchJsonWithTimeout(url);
    const data = flattenMusicPayload(json);
    const audioUrl = pickMusicUrl(data);
    if (!audioUrl) return [];
    return [normalizeMusicTrack({
        id: `qq-parser:${data.id || data.mid || query}`,
        remoteId: String(data.id || data.mid || ''),
        trackName: data.name || data.title || data.songname || 'QQ Music',
        artistName: normalizeMusicArtist(data.artist || data.singer || data.artists),
        collectionName: data.album || data.albumname || 'QQ音乐',
        artworkUrl100: data.image || data.pic || data.cover || '',
        audioUrl,
        trackViewUrl: query,
        sourceName: 'QQ解析',
        sourceKey: 'qq-parser',
        lyricsText: pickMusicLyrics(data)
    })];
}

async function searchGoMusicApi(query, platform, settings) {
    const base = settings.goApiBase;
    if (!base) return [];
    const urls = [
        `${base}/search?${new URLSearchParams({ keywords: query, source: platform, limit: '10' }).toString()}`,
        `${base}/api/search?${new URLSearchParams({ keyword: query, source: platform, limit: '10' }).toString()}`,
        `${base}/music/search?${new URLSearchParams({ keyword: query, platform, limit: '10' }).toString()}`
    ];
    for (const url of urls) {
        try {
            const json = await fetchJsonWithTimeout(url);
            const rows = extractMusicRows(json).slice(0, 10);
            const tracks = rows.map(item => normalizeGenericMusicTrack(item, platform, '聚合后端')).filter(track => track.audioUrl);
            if (tracks.length) return tracks;
        } catch (e) {}
    }
    return [];
}

function normalizeGenericMusicTrack(item, platform, sourceName) {
    const id = item.id || item.songId || item.song_id || item.mid || item.hash || item.rid || item.url;
    return normalizeMusicTrack({
        id: `generic:${platform}:${id || item.name || item.title}`,
        remoteId: String(id || ''),
        trackName: item.name || item.title || item.songname || item.songName || 'Untitled',
        artistName: normalizeMusicArtist(item.artist || item.artists || item.singer || item.author),
        collectionName: item.album || item.albumname || item.albumName || MUSIC_PLATFORM_LABELS[platform] || 'Online Music',
        artworkUrl100: item.pic || item.cover || item.image || item.artwork || item.artworkUrl100 || '',
        audioUrl: pickMusicUrl(item),
        trackViewUrl: item.link || item.url_page || item.share || getMusicPlatformUrl(platform, id),
        sourceName,
        sourceKey: 'generic',
        lyricsText: pickMusicLyrics(item),
        duration: normalizeMusicDuration(item.duration || item.interval)
    });
}

async function postMusicJson(url, body) {
    return fetchJsonWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
    });
}

async function fetchMusicJsonFlexible(urls, body) {
    let lastError = null;
    for (const url of urls) {
        try {
            if (url.endsWith('/search') || url.endsWith('/song')) {
                return await postMusicJson(url, body);
            }
            return await fetchJsonWithTimeout(url);
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError || new Error('music source unavailable');
}

function extractMusicRows(json) {
    if (Array.isArray(json)) return json;
    if (!json || typeof json !== 'object') return [];
    const candidates = [
        json.data,
        json.result,
        json.result?.songs,
        json.result?.list,
        json.songs,
        json.list,
        json.items,
        json.records
    ];
    for (const item of candidates) {
        if (Array.isArray(item)) return item;
        if (item && typeof item === 'object') {
            const nested = extractMusicRows(item);
            if (nested.length) return nested;
        }
    }
    return [];
}

function flattenMusicPayload(value) {
    if (!value || typeof value !== 'object') return {};
    if (Array.isArray(value)) return flattenMusicPayload(value[0]);
    for (const key of ['data', 'result', 'song', 'songs', 'info']) {
        const nested = value[key];
        if (Array.isArray(nested)) return { ...value, ...flattenMusicPayload(nested[0]) };
        if (nested && typeof nested === 'object') return { ...value, ...flattenMusicPayload(nested) };
    }
    return value;
}

function pickMusicUrl(value) {
    if (!value) return '';
    if (typeof value === 'string') return /^https?:\/\//i.test(value) ? value : '';
    if (Array.isArray(value)) {
        for (const item of value) {
            const url = pickMusicUrl(item);
            if (url) return url;
        }
        return '';
    }
    const directKeys = ['url', 'audioUrl', 'playUrl', 'musicUrl', 'src', 'file', 'location'];
    for (const key of directKeys) {
        const url = pickMusicUrl(value[key]);
        if (url) return url;
    }
    const containers = ['data', 'result', 'song', 'music_urls', 'musicUrls', 'urls'];
    for (const key of containers) {
        const url = pickMusicUrl(value[key]);
        if (url) return url;
    }
    if (value.flac || value.ape || value['320'] || value.m4a || value['128']) {
        return pickMusicUrl(value.flac || value.ape || value['320'] || value.m4a || value['128']);
    }
    return '';
}

function pickMusicLyrics(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.includes('\n') || value.includes('[') ? value : '';
    if (Array.isArray(value)) return value.map(pickMusicLyrics).find(Boolean) || '';
    const keys = ['lrc', 'lyric', 'lyrics', 'plainLyrics', 'syncedLyrics', 'original', 'translation'];
    for (const key of keys) {
        const text = pickMusicLyrics(value[key]);
        if (text) return text;
    }
    for (const key of ['data', 'result', 'lyric']) {
        const text = pickMusicLyrics(value[key]);
        if (text) return text;
    }
    return '';
}

function normalizeMusicArtist(value) {
    if (Array.isArray(value)) {
        return value.map(item => {
            if (typeof item === 'string') return item;
            return item?.name || item?.artistName || item?.title || '';
        }).filter(Boolean).join(', ') || 'Unknown Artist';
    }
    if (value && typeof value === 'object') return value.name || value.artistName || value.title || 'Unknown Artist';
    return String(value || '').trim() || 'Unknown Artist';
}

function normalizeMusicDuration(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num > 10000 ? Math.round(num / 1000) : num;
}

function getMusicPlatformUrl(platform, id) {
    if (!id) return '';
    const encoded = encodeURIComponent(id);
    if (platform === 'netease') return `https://music.163.com/song?id=${encoded}`;
    if (platform === 'tencent') return `https://y.qq.com/n/ryqq/songDetail/${encoded}`;
    if (platform === 'kuwo') return `https://www.kuwo.cn/play_detail/${encoded}`;
    if (platform === 'kugou') return `https://www.kugou.com/song/#hash=${encoded}`;
    return '';
}

async function searchInternetArchiveMusic(query) {
    const q = `${query} AND mediatype:audio`;
    const params = new URLSearchParams();
    params.set('q', q);
    params.append('fl[]', 'identifier');
    params.append('fl[]', 'title');
    params.append('fl[]', 'creator');
    params.append('fl[]', 'date');
    params.append('sort[]', 'downloads desc');
    params.set('rows', '14');
    params.set('page', '1');
    params.set('output', 'json');
    const res = await fetch(`https://archive.org/advancedsearch.php?${params.toString()}`);
    if (!res.ok) throw new Error(`Archive search ${res.status}`);
    const json = await res.json();
    const docs = json?.response?.docs || [];
    const hydrated = await Promise.all(docs.slice(0, 10).map(hydrateArchiveTrack));
    return hydrated.filter(Boolean).slice(0, 12);
}

async function hydrateArchiveTrack(doc) {
    const identifier = doc?.identifier;
    if (!identifier) return null;
    try {
        const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
        if (!res.ok) return null;
        const json = await res.json();
        const file = pickArchiveAudioFile(json.files || []);
        if (!file) return null;
        const meta = json.metadata || {};
        const title = file.title || meta.title || doc.title || file.name;
        const creator = normalizeArchiveCreator(meta.creator || doc.creator);
        const album = meta.album || meta.collection || meta.title || 'Internet Archive';
        const duration = Number.parseFloat(file.length || meta.runtime || '');
        return normalizeMusicTrack({
            id: `archive:${identifier}:${file.name}`,
            trackName: title,
            artistName: creator || 'Internet Archive',
            collectionName: Array.isArray(album) ? album[0] : album,
            artworkUrl100: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
            audioUrl: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeArchivePath(file.name)}`,
            trackViewUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
            primaryGenreName: file.format || 'Archive Audio',
            sourceName: 'Internet Archive',
            duration: Number.isFinite(duration) ? duration : null
        });
    } catch (e) {
        return null;
    }
}

function pickArchiveAudioFile(files) {
    const audioFiles = files.filter(file => {
        const name = String(file.name || '');
        const format = String(file.format || '').toLowerCase();
        return /\.(mp3|m4a|ogg|oga|wav)$/i.test(name)
            || format.includes('mp3')
            || format.includes('ogg')
            || format.includes('mpeg4 audio');
    }).filter(file => !/_sample\./i.test(file.name || ''));
    const score = file => {
        const name = String(file.name || '').toLowerCase();
        const format = String(file.format || '').toLowerCase();
        if (format.includes('vbr mp3') || name.endsWith('.mp3')) return 4;
        if (name.endsWith('.m4a')) return 3;
        if (format.includes('ogg') || name.endsWith('.ogg') || name.endsWith('.oga')) return 2;
        if (name.endsWith('.wav')) return 1;
        return 0;
    };
    return audioFiles.sort((a, b) => score(b) - score(a))[0] || null;
}

function encodeArchivePath(path) {
    return String(path || '').split('/').map(part => encodeURIComponent(part)).join('/');
}

function normalizeArchiveCreator(value) {
    if (Array.isArray(value)) return value.filter(Boolean).join(', ');
    return String(value || '').trim();
}

function showMusicStatus(text) {
    const el = document.getElementById('music-status');
    if (el) el.textContent = text || '';
}

function openMusicDetail(index) {
    selectMusicTrack(index, false);
    const detail = document.getElementById('music-detail-view');
    if (detail) detail.classList.remove('hidden');
    switchMusicDetailTab('lyrics');
    renderMusicDetail();
    refreshMusicLyrics();
}
window.openMusicDetail = openMusicDetail;

function closeMusicDetail() {
    document.getElementById('music-detail-view')?.classList.add('hidden');
}
window.closeMusicDetail = closeMusicDetail;

function renderMusicDetail() {
    const detail = document.getElementById('music-detail-view');
    if (!detail || detail.classList.contains('hidden')) return;
    const track = musicTracks[musicCurrentIndex] || normalizeMusicTrack(MUSIC_FALLBACK_TRACKS[0]);
    const cover = document.getElementById('music-detail-cover');
    const source = document.getElementById('music-detail-source');
    const title = document.getElementById('music-detail-title');
    const artist = document.getElementById('music-detail-artist');
    const artwork = getMusicArtwork(track);
    if (cover) {
        cover.innerHTML = artwork
            ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(track.trackName)}" onerror="this.parentElement.innerHTML=getFallbackCover()">`
            : getFallbackCover();
    }
    if (source) source.textContent = track.sourceName || 'Full track';
    if (title) title.textContent = track.trackName;
    if (artist) artist.textContent = track.artistName;
    updateMusicFavoriteButton();
    renderMusicAiPanel();
    renderMusicComments();
}

function updateMusicFavoriteButton() {
    const btn = document.getElementById('music-favorite-btn');
    const track = musicTracks[musicCurrentIndex];
    if (!btn || !track) return;
    const liked = isMusicFavorite(track);
    btn.classList.toggle('active', liked);
    btn.innerHTML = `<i class="${liked ? 'ri-heart-3-fill' : 'ri-heart-3-line'}"></i><span>${liked ? '已收藏' : '收藏'}</span>`;
}

function getMusicCurrentChar() {
    if (typeof getCurrentChatChar === 'function') {
        const current = getCurrentChatChar();
        if (current) return current;
    }
    const chars = window.myCharacters || [];
    if (window.currentChatCharId) {
        const current = chars.find(c => c.id === window.currentChatCharId);
        if (current) return current;
    }
    return chars[0] || null;
}

function getMusicCharName(char) {
    return (char?.chatConfig && char.chatConfig.nickname) || char?.name || 'AI';
}

function getMusicCoListenStore() {
    try {
        return JSON.parse(localStorage.getItem(MUSIC_CO_LISTEN_KEY) || '{}') || {};
    } catch (e) {
        return {};
    }
}

function saveMusicCoListenStore(store) {
    localStorage.setItem(MUSIC_CO_LISTEN_KEY, JSON.stringify(store || {}));
}

function getMusicCoListenThread(track, char) {
    const store = getMusicCoListenStore();
    const key = `${char?.id || 'ai'}::${getMusicTrackKey(track)}`;
    return { store, key, items: Array.isArray(store[key]) ? store[key] : [] };
}

function saveMusicAiMessage(track, char, text, kind) {
    const thread = getMusicCoListenThread(track, char);
    const item = {
        name: getMusicCharName(char),
        text: String(text || '').trim(),
        kind: kind || 'comment',
        time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    };
    if (!item.text) return;
    thread.items.unshift(item);
    thread.store[thread.key] = thread.items.slice(0, 18);
    saveMusicCoListenStore(thread.store);
    musicAiMessages = thread.store[thread.key];
}

function renderMusicAiPanel() {
    const panel = document.getElementById('music-ai-panel');
    const btn = document.getElementById('music-ai-listen-btn');
    const track = musicTracks[musicCurrentIndex];
    const char = getMusicCurrentChar();
    if (!panel || !btn || !track) return;
    const thread = getMusicCoListenThread(track, char);
    musicAiMessages = thread.items;
    btn.classList.toggle('active', musicCoListening);
    btn.innerHTML = `<i class="${musicCoListening ? 'ri-user-heart-fill' : 'ri-user-heart-line'}"></i><span>${musicCoListening ? '正在共听' : '共同听歌'}</span>`;
    panel.classList.toggle('hidden', !musicCoListening && !thread.items.length && !musicCoListenBusy);
    if (panel.classList.contains('hidden')) return;
    const charName = getMusicCharName(char);
    const avatar = char?.avatar || '';
    const messagesHtml = thread.items.length
        ? thread.items.map(item => `
            <div class="music-ai-message ${musicEscapeAttr(item.kind || 'comment')}">
                <strong>${musicEscapeHtml(item.name || charName)}</strong>
                <p>${musicEscapeHtml(item.text)}</p>
                <span>${musicEscapeHtml(item.time || '')}</span>
            </div>
        `).join('')
        : '<div class="music-ai-empty">开始播放后，角色会按人设评价、点歌或切歌。</div>';
    panel.innerHTML = `
        <div class="music-ai-head">
            <div class="music-ai-avatar">${avatar ? `<img src="${musicEscapeAttr(avatar)}" alt="${musicEscapeAttr(charName)}" onerror="this.remove()">` : '<i class="ri-user-smile-line"></i>'}</div>
            <div>
                <strong>${musicEscapeHtml(charName)}</strong>
                <span>${musicCoListening ? '正在和你一起听' : '共听记录'}</span>
            </div>
            ${musicCoListenBusy ? '<em>思考中...</em>' : '<button type="button" onclick="queueMusicAiReaction(\'manual\')">问一句</button>'}
        </div>
        <div class="music-ai-messages">${messagesHtml}</div>
    `;
}

function toggleMusicCoListen() {
    const char = getMusicCurrentChar();
    if (!char) {
        showMusicStatus('先在微信导入或选择一个角色，再一起听歌。');
        return;
    }
    musicCoListening = !musicCoListening;
    renderMusicAiPanel();
    if (musicCoListening) queueMusicAiReaction('start');
}
window.toggleMusicCoListen = toggleMusicCoListen;

function queueMusicAiReaction(reason) {
    if (musicCoListenBusy) return;
    const track = musicTracks[musicCurrentIndex];
    if (!track || !musicCoListening && reason !== 'manual') return;
    const key = `${getMusicTrackKey(track)}::${reason}`;
    if (reason === 'play' && musicCoListenLastTrackKey === key) return;
    musicCoListenLastTrackKey = key;
    requestMusicAiReaction(reason).catch(err => {
        console.warn('music ai reaction failed:', err);
        musicCoListenBusy = false;
        renderMusicAiPanel();
        showMusicStatus('共同听歌暂时没有回复，检查 API 或换个模型再试。');
    });
}
window.queueMusicAiReaction = queueMusicAiReaction;

async function requestMusicAiReaction(reason) {
    const track = musicTracks[musicCurrentIndex];
    const char = getMusicCurrentChar();
    if (!track || !char || typeof callChatApi !== 'function') return;
    musicCoListenBusy = true;
    renderMusicAiPanel();
    const charName = getMusicCharName(char);
    const userProfile = typeof getUserProfile === 'function' ? getUserProfile() : { name: '我' };
    const context = [
        `当前正在共同听歌。`,
        `歌曲：${track.trackName}`,
        `歌手：${track.artistName}`,
        `专辑/来源：${track.collectionName || track.sourceName || ''}`,
        `用户：${userProfile.name || '我'}`,
        `触发：${reason}`
    ].join('\n');
    const history = Array.isArray(char.history) ? char.history.slice(-10) : [];
    const messages = typeof buildMessages === 'function'
        ? buildMessages(char, history)
        : [{ role: 'system', content: `你是${charName}。` }];
    messages.push({
        role: 'system',
        content: '你正在 BYND Music 里和用户一起听歌。请按角色卡和最近聊天，用自然口吻给出一句短评论；如果你想点歌或不喜欢当前歌，可以在回复末尾单独加一行 JSON：{"action":"request","query":"歌名 歌手","comment":"理由"} 或 {"action":"skip","comment":"理由"}。不要写思考过程。'
    });
    messages.push({ role: 'user', content: context });
    const result = await callChatApi(messages);
    musicCoListenBusy = false;
    if (!result?.ok) {
        saveMusicAiMessage(track, char, result?.error || '我这边暂时听不清，等一下再说。', 'error');
        renderMusicAiPanel();
        return;
    }
    const parsed = parseMusicAiCommand(result.content);
    const text = parsed.comment || parsed.text || result.content;
    saveMusicAiMessage(track, char, text, parsed.action || 'comment');
    renderMusicAiPanel();
    addMusicCommentFromAi(char, text);
    if (parsed.action === 'skip') {
        showMusicStatus(`${charName} 切掉了这首。`);
        setTimeout(() => playNextMusicTrack(), 600);
    } else if (parsed.action === 'request' && parsed.query) {
        const input = document.getElementById('music-search-input');
        if (input) input.value = parsed.query;
        showMusicStatus(`${charName} 点了一首：${parsed.query}`);
        setTimeout(() => searchMusic(parsed.query), 600);
    }
}

function parseMusicAiCommand(content) {
    const raw = String(content || '').trim();
    const match = raw.match(/\{[\s\S]*\}\s*$/);
    if (!match) return { action: 'comment', text: raw };
    try {
        const json = JSON.parse(match[0]);
        const text = raw.slice(0, match.index).trim();
        const action = ['request', 'skip', 'comment'].includes(json.action) ? json.action : 'comment';
        return {
            action,
            query: String(json.query || '').trim(),
            comment: String(json.comment || text || '').trim(),
            text
        };
    } catch (e) {
        return { action: 'comment', text: raw };
    }
}

function addMusicCommentFromAi(char, text) {
    const track = musicTracks[musicCurrentIndex];
    if (!track || !text) return;
    const store = getMusicCommentsStore();
    if (!Array.isArray(store[track.id])) store[track.id] = [];
    store[track.id].unshift({
        name: getMusicCharName(char),
        text,
        time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    saveMusicCommentsStore(store);
    renderMusicComments();
}

function switchMusicDetailTab(tab) {
    musicDetailTab = tab === 'comments' ? 'comments' : 'lyrics';
    document.querySelectorAll('.music-detail-tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === musicDetailTab);
    });
    document.getElementById('music-lyrics-panel')?.classList.toggle('active', musicDetailTab === 'lyrics');
    document.getElementById('music-comments-panel')?.classList.toggle('active', musicDetailTab === 'comments');
}
window.switchMusicDetailTab = switchMusicDetailTab;

async function refreshMusicLyrics() {
    const track = musicTracks[musicCurrentIndex];
    if (!track) return;
    const lyricsBox = document.getElementById('music-lyrics-box');
    const status = document.getElementById('music-lyrics-status');
    if (status) status.textContent = '正在匹配歌词...';
    if (lyricsBox) lyricsBox.innerHTML = '<div class="music-lyrics-empty">正在查找歌词。</div>';
    try {
        const lyrics = musicLyricsCache[track.id] || await fetchMusicLyrics(track);
        musicLyricsCache[track.id] = lyrics;
        renderMusicLyrics(lyrics);
        if (status) status.textContent = lyrics.source || '歌词已载入';
    } catch (e) {
        if (status) status.textContent = '没有匹配到歌词';
        if (lyricsBox) {
            lyricsBox.innerHTML = `
                <div class="music-lyrics-empty">
                    <strong>暂时没有找到歌词</strong>
                    <span>这首完整音频来自公开档案，歌词库可能没有收录。可以先在评论里记下想法。</span>
                </div>
            `;
        }
    }
}
window.refreshMusicLyrics = refreshMusicLyrics;

async function fetchMusicLyrics(track) {
    const directLyrics = await fetchMusicSourceLyrics(track);
    if (directLyrics) return directLyrics;

    const params = new URLSearchParams();
    params.set('q', `${track.trackName} ${track.artistName}`);
    const res = await fetch(`https://lrclib.net/api/search?${params.toString()}`);
    if (!res.ok) throw new Error(`lyrics ${res.status}`);
    const results = await res.json();
    const item = Array.isArray(results) ? results[0] : null;
    if (!item || (!item.syncedLyrics && !item.plainLyrics)) throw new Error('no lyrics');
    const raw = item.syncedLyrics || item.plainLyrics;
    return {
        source: item.syncedLyrics ? 'LRCLIB 同步歌词' : 'LRCLIB 普通歌词',
        lines: parseLyricsLines(raw)
    };
}

async function fetchMusicSourceLyrics(track) {
    if (track.lyricsText) {
        return {
            source: `${track.sourceName || '音乐源'} 歌词`,
            lines: parseLyricsLines(track.lyricsText)
        };
    }
    if (track.lyricsUrl) {
        try {
            const res = await fetch(track.lyricsUrl);
            if (res.ok) {
                const text = await res.text();
                if (text.trim()) {
                    return {
                        source: `${track.sourceName || '音乐源'} 歌词`,
                        lines: parseLyricsLines(text)
                    };
                }
            }
        } catch (e) {}
    }
    if (track.sourceKey === 'meting' && track.sourceMeta) {
        try {
            const meta = JSON.parse(track.sourceMeta);
            const text = await fetchMetingTextAsset(meta.base, meta.platform, 'lrc', meta.lyricId);
            if (text) {
                return {
                    source: `${MUSIC_PLATFORM_LABELS[meta.platform] || track.sourceName} 歌词`,
                    lines: parseLyricsLines(text)
                };
            }
        } catch (e) {}
    }
    return null;
}

async function fetchMetingTextAsset(base, platform, type, id) {
    if (!base || !platform || !id) return '';
    const params = new URLSearchParams({ server: platform, type, id: String(id) });
    const res = await fetch(`${base}?${params.toString()}`);
    if (!res.ok) return '';
    return res.text();
}

function parseLyricsLines(raw) {
    return String(raw || '').split(/\r?\n/).map(line => {
        const match = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
        if (!match) return { time: null, text: line.trim() };
        const seconds = Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] || 0}`);
        return { time: seconds, text: match[4].trim() };
    }).filter(line => line.text);
}

function renderMusicLyrics(lyrics) {
    const box = document.getElementById('music-lyrics-box');
    if (!box) return;
    musicActiveLyricIndex = -1;
    if (!lyrics?.lines?.length) {
        box.innerHTML = '<div class="music-lyrics-empty">没有歌词内容。</div>';
        return;
    }
    box.innerHTML = lyrics.lines.map((line, index) => `
        <div class="music-lyric-line" data-time="${line.time == null ? '' : line.time}" data-line-index="${index}">
            <span>${line.time == null ? '' : formatMusicTime(line.time)}</span>
            <p>${musicEscapeHtml(line.text)}</p>
        </div>
    `).join('');
    updateActiveMusicLyric(musicAudio?.currentTime || 0, true);
}

function updateActiveMusicLyric(currentTime, force) {
    const box = document.getElementById('music-lyrics-box');
    if (!box || !box.querySelector('.music-lyric-line[data-time]')) return;
    const lines = Array.from(box.querySelectorAll('.music-lyric-line'));
    let activeIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        const rawTime = lines[i].dataset.time;
        if (rawTime === '') continue;
        const time = Number(rawTime);
        if (!Number.isFinite(time)) continue;
        if (time <= currentTime + 0.18) activeIndex = i;
        else break;
    }
    if (activeIndex < 0) activeIndex = lines.findIndex(line => line.dataset.time !== '' && Number.isFinite(Number(line.dataset.time)));
    if (activeIndex < 0 || (!force && activeIndex === musicActiveLyricIndex)) return;
    musicActiveLyricIndex = activeIndex;
    lines.forEach((line, index) => line.classList.toggle('active', index === activeIndex));
    const active = lines[activeIndex];
    if (active && document.getElementById('music-detail-view') && !document.getElementById('music-detail-view').classList.contains('hidden')) {
        active.scrollIntoView({ block: 'center', behavior: force ? 'auto' : 'smooth' });
    }
}

function getMusicCommentsStore() {
    try {
        return JSON.parse(localStorage.getItem(MUSIC_COMMENTS_KEY) || '{}') || {};
    } catch (e) {
        return {};
    }
}

function saveMusicCommentsStore(store) {
    localStorage.setItem(MUSIC_COMMENTS_KEY, JSON.stringify(store || {}));
}

function renderMusicComments() {
    const list = document.getElementById('music-comments-list');
    const track = musicTracks[musicCurrentIndex];
    if (!list || !track) return;
    const store = getMusicCommentsStore();
    const comments = store[track.id] || [];
    if (!comments.length) {
        list.innerHTML = `
            <div class="music-comments-empty">
                <strong>还没有留言</strong>
                <span>可以记录这首歌适合什么场景，或者想转发给谁。</span>
            </div>
        `;
        return;
    }
    list.innerHTML = comments.map(comment => `
        <div class="music-comment-item">
            <strong>${musicEscapeHtml(comment.name || '我')}</strong>
            <p>${musicEscapeHtml(comment.text)}</p>
            <span>${musicEscapeHtml(comment.time)}</span>
        </div>
    `).join('');
}

function addMusicComment() {
    const input = document.getElementById('music-comment-input');
    const track = musicTracks[musicCurrentIndex];
    if (!input || !track) return;
    const text = input.value.trim();
    if (!text) return;
    const store = getMusicCommentsStore();
    if (!Array.isArray(store[track.id])) store[track.id] = [];
    store[track.id].unshift({
        name: '我',
        text,
        time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    saveMusicCommentsStore(store);
    input.value = '';
    renderMusicComments();
}
window.addMusicComment = addMusicComment;

// --- 学习 App ---
const STUDY_CARDS_KEY = 'bynd_study_cards_v1';
const STUDY_PROGRESS_KEY = 'bynd_study_progress_v1';
const STUDY_LANGUAGES_KEY = 'bynd_study_languages_v1';
const DEFAULT_STUDY_LANGUAGES = [
    { id: 'cn', label: '中文', short: '中', placeholder: '我今天想认真学习。' },
    { id: 'ja', label: '日本語', short: '日', placeholder: '今日は真面目に勉強したい。' },
    { id: 'th', label: 'ไทย', short: '泰', placeholder: 'วันนี้ฉันอยากตั้งใจเรียน' }
];

function getStudyCards() {
    try {
        const cards = JSON.parse(localStorage.getItem(STUDY_CARDS_KEY) || '[]');
        return Array.isArray(cards) ? cards.map(normalizeStudyCard) : [];
    } catch (e) {
        return [];
    }
}

function saveStudyCards(cards) {
    localStorage.setItem(STUDY_CARDS_KEY, JSON.stringify(Array.isArray(cards) ? cards.map(normalizeStudyCard) : []));
}

function getStudyLanguages() {
    try {
        const langs = JSON.parse(localStorage.getItem(STUDY_LANGUAGES_KEY) || '[]');
        if (Array.isArray(langs) && langs.length) return langs.map(normalizeStudyLanguage).filter(Boolean).slice(0, 8);
    } catch (e) {}
    return [...DEFAULT_STUDY_LANGUAGES];
}

function saveStudyLanguages(languages) {
    const safe = (Array.isArray(languages) ? languages : []).map(normalizeStudyLanguage).filter(Boolean).slice(0, 8);
    localStorage.setItem(STUDY_LANGUAGES_KEY, JSON.stringify(safe.length ? safe : DEFAULT_STUDY_LANGUAGES));
}

function normalizeStudyLanguage(lang) {
    if (!lang) return null;
    const label = String(lang.label || lang.name || '').trim();
    if (!label) return null;
    const id = String(lang.id || label.toLowerCase().replace(/\s+/g, '_')).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'lang_' + Date.now();
    return {
        id,
        label: label.slice(0, 24),
        short: String(lang.short || label.slice(0, 1)).trim().slice(0, 3) || label.slice(0, 1),
        placeholder: String(lang.placeholder || `写一行${label}`).slice(0, 80)
    };
}

function normalizeStudyCard(card) {
    const lines = { ...(card?.lines || {}) };
    if (card?.cn && !lines.cn) lines.cn = card.cn;
    if (card?.ja && !lines.ja) lines.ja = card.ja;
    if (card?.th && !lines.th) lines.th = card.th;
    return {
        ...card,
        id: card?.id || 'study_' + Date.now() + '_' + Math.random().toString(16).slice(2),
        lines,
        cn: lines.cn || card?.cn || '',
        ja: lines.ja || card?.ja || '',
        th: lines.th || card?.th || '',
        note: card?.note || '',
        createdAt: card?.createdAt || Date.now()
    };
}

function getStudyProgress() {
    try {
        return JSON.parse(localStorage.getItem(STUDY_PROGRESS_KEY) || '{}') || {};
    } catch (e) {
        return {};
    }
}

function saveStudyProgress(progress) {
    localStorage.setItem(STUDY_PROGRESS_KEY, JSON.stringify(progress || {}));
}

function getStudySupervisor() {
    const char = typeof getCurrentChatChar === 'function' ? getCurrentChatChar() : null;
    return char || (window.myCharacters || [])[0] || null;
}

function initStudyApp() {
    if (!localStorage.getItem(STUDY_LANGUAGES_KEY)) saveStudyLanguages(DEFAULT_STUDY_LANGUAGES);
    seedStudyCardsIfEmpty();
    renderStudyApp();
}

function seedStudyCardsIfEmpty() {
    if (getStudyCards().length) return;
    saveStudyCards([
        {
            id: 'study_seed_1',
            cn: '我想慢慢变得更稳定。',
            ja: '少しずつ安定した自分になりたい。',
            th: 'ฉันอยากค่อยๆ เป็นคนที่มั่นคงขึ้น',
            note: '中文的“慢慢”偏过程；日语用少しずつ；泰语用ค่อยๆ。例句：我想慢慢习惯这件事。',
            createdAt: Date.now()
        },
        {
            id: 'study_seed_2',
            cn: '今天先学十分钟就好。',
            ja: '今日はまず十分だけ勉強すればいい。',
            th: 'วันนี้เรียนแค่สิบนาทีก่อนก็พอ',
            note: '“就好/ก็พอ”都有降低压力的语气，适合做每日学习目标。',
            createdAt: Date.now() - 1000
        }
    ]);
}

function renderStudyApp() {
    const supervisor = getStudySupervisor();
    const label = document.getElementById('study-supervisor-label');
    const languages = getStudyLanguages();
    if (label) label.textContent = supervisor ? `${getMusicCharName(supervisor)} 在监督` : 'AI Supervisor';
    const title = document.getElementById('study-hero-title');
    if (title) title.textContent = languages.map(lang => lang.label).join(' / ');
    renderStudyLanguageList();
    renderStudyEditorFields();
    renderStudyCheckCard();
    renderStudyCardList();
}

function renderStudyLanguageList() {
    const el = document.getElementById('study-language-list');
    if (!el) return;
    const languages = getStudyLanguages();
    el.innerHTML = languages.map(lang => `
        <div class="study-language-pill">
            <b>${musicEscapeHtml(lang.short)}</b>
            <span>${musicEscapeHtml(lang.label)}</span>
            <button type="button" onclick="removeStudyLanguage('${musicEscapeAttr(lang.id)}')" aria-label="删除语言"><i class="ri-close-line"></i></button>
        </div>
    `).join('');
}

function renderStudyEditorFields(card = null) {
    const el = document.getElementById('study-editor-fields');
    if (!el) return;
    const languages = getStudyLanguages();
    const lines = card?.lines || {};
    el.innerHTML = languages.map(lang => `
        <label>
            <span>${musicEscapeHtml(lang.label)}</span>
            <input type="text" data-study-lang="${musicEscapeAttr(lang.id)}" placeholder="${musicEscapeAttr(lang.placeholder)}" value="${musicEscapeAttr(lines[lang.id] || '')}">
        </label>
    `).join('');
}

function renderStudyCheckCard() {
    const el = document.getElementById('study-check-card');
    if (!el) return;
    const cards = getStudyCards();
    const progress = getStudyProgress();
    const today = new Date().toLocaleDateString('zh-CN');
    const todayCount = progress[today] || 0;
    el.innerHTML = `
        <div>
            <span>今日进度</span>
            <strong>${todayCount}/${Math.max(cards.length, 1)}</strong>
            <p>像闯关一样每天刷几张卡，当前聊天角色可以抽查、监督和追问。</p>
        </div>
        <button type="button" onclick="startStudyQuiz()"><i class="ri-question-answer-line"></i> 抽查</button>
    `;
}

function renderStudyCardList() {
    const el = document.getElementById('study-card-list');
    if (!el) return;
    const cards = getStudyCards();
    const languages = getStudyLanguages();
    if (!cards.length) {
        el.innerHTML = '<div class="study-empty">还没有学习卡，先保存一条多语言对照。</div>';
        return;
    }
    el.innerHTML = cards.map(card => `
        <article class="study-lang-card">
            <div class="study-lang-lines">
                ${languages.map(lang => card.lines?.[lang.id] ? `<p><b>${musicEscapeHtml(lang.short)}</b>${musicEscapeHtml(card.lines[lang.id])}</p>` : '').join('')}
            </div>
            <div class="study-note">${musicEscapeHtml(card.note || '')}</div>
            <div class="study-card-actions">
                <span>${new Date(card.createdAt || Date.now()).toLocaleDateString('zh-CN')}</span>
                <button type="button" onclick="editStudyCard('${musicEscapeAttr(card.id)}')"><i class="ri-edit-line"></i></button>
                <button type="button" onclick="deleteStudyCard('${musicEscapeAttr(card.id)}')"><i class="ri-delete-bin-line"></i></button>
            </div>
        </article>
    `).join('');
}

function saveStudyCard() {
    const idEl = document.getElementById('study-edit-id');
    const note = document.getElementById('study-note')?.value.trim() || '';
    const lines = {};
    document.querySelectorAll('#study-editor-fields [data-study-lang]').forEach(input => {
        const key = input.dataset.studyLang;
        const value = input.value.trim();
        if (key && value) lines[key] = value;
    });
    if (!Object.keys(lines).length) {
        alert('至少写一行语言内容');
        return;
    }
    const cards = getStudyCards();
    const id = idEl?.value || '';
    const next = {
        id: id || 'study_' + Date.now(),
        lines,
        cn: lines.cn || '',
        ja: lines.ja || '',
        th: lines.th || '',
        note,
        createdAt: Date.now()
    };
    const index = cards.findIndex(card => card.id === id);
    if (index >= 0) cards[index] = { ...cards[index], ...next, createdAt: cards[index].createdAt || next.createdAt, updatedAt: Date.now() };
    else cards.unshift(next);
    saveStudyCards(cards);
    clearStudyEditor();
    renderStudyApp();
}
window.saveStudyCard = saveStudyCard;

function clearStudyEditor() {
    ['study-edit-id', 'study-note'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.querySelectorAll('#study-editor-fields input').forEach(input => { input.value = ''; });
}
window.clearStudyEditor = clearStudyEditor;

function editStudyCard(id) {
    const card = getStudyCards().find(item => item.id === id);
    if (!card) return;
    document.getElementById('study-edit-id').value = card.id;
    renderStudyEditorFields(card);
    document.getElementById('study-note').value = card.note || '';
}
window.editStudyCard = editStudyCard;

function deleteStudyCard(id) {
    saveStudyCards(getStudyCards().filter(card => card.id !== id));
    renderStudyApp();
}
window.deleteStudyCard = deleteStudyCard;

function startStudyQuiz() {
    const cards = getStudyCards();
    if (!cards.length) return;
    const card = cards[Math.floor(Math.random() * cards.length)];
    const languages = getStudyLanguages().filter(lang => card.lines?.[lang.id]);
    const source = languages[0];
    const targets = languages.slice(1);
    const answer = prompt(`请写出这句的${targets.map(lang => lang.label).join('或') || '另一种语言'}：\n${source ? card.lines[source.id] : Object.values(card.lines || {})[0]}`);
    if (answer == null) return;
    const progress = getStudyProgress();
    const today = new Date().toLocaleDateString('zh-CN');
    progress[today] = (progress[today] || 0) + 1;
    saveStudyProgress(progress);
    const box = document.getElementById('study-supervisor-text');
    if (box) box.textContent = `你的回答：${answer || '空'}。参考：${languages.map(lang => `${lang.label}: ${card.lines[lang.id]}`).join(' / ')}`;
    renderStudyCheckCard();
}
window.startStudyQuiz = startStudyQuiz;

function addStudyLanguage() {
    const label = prompt('要学习哪种语言？例如：英语、韩语、法语');
    if (!label || !label.trim()) return;
    const short = prompt('给它一个短标签，例如：英、韩、FR') || label.trim().slice(0, 1);
    const languages = getStudyLanguages();
    const idBase = label.trim().toLowerCase().replace(/\s+/g, '_');
    let id = idBase.replace(/[^a-zA-Z0-9_-]/g, '') || 'lang_' + Date.now();
    while (languages.some(lang => lang.id === id)) id = id + '_' + Math.random().toString(16).slice(2, 5);
    languages.push(normalizeStudyLanguage({ id, label: label.trim(), short, placeholder: `写一行${label.trim()}` }));
    saveStudyLanguages(languages);
    renderStudyApp();
}
window.addStudyLanguage = addStudyLanguage;

function removeStudyLanguage(id) {
    const languages = getStudyLanguages();
    if (languages.length <= 1) {
        alert('至少保留一种语言');
        return;
    }
    saveStudyLanguages(languages.filter(lang => lang.id !== id));
    renderStudyApp();
}
window.removeStudyLanguage = removeStudyLanguage;

async function askStudySupervisor() {
    const char = getStudySupervisor();
    const box = document.getElementById('study-supervisor-text');
    if (!char || typeof callChatApi !== 'function') {
        if (box) box.textContent = '先在微信导入角色并配置 API，就能让角色监督你学习。';
        return;
    }
    const cards = getStudyCards().slice(0, 8);
    if (box) box.textContent = `${getMusicCharName(char)} 正在看你的学习卡...`;
    try {
        const messages = typeof buildMessages === 'function'
            ? buildMessages(char, Array.isArray(char.history) ? char.history.slice(-8) : [])
            : [{ role: 'system', content: `你是${getMusicCharName(char)}。` }];
        messages.push({
            role: 'user',
            content: `请按你的人设监督我学语言。我的学习卡如下：\n${cards.map((card, i) => `${i + 1}. ${Object.entries(card.lines || {}).map(([key, value]) => `${key}:${value}`).join('\n')}\n解释:${card.note}`).join('\n\n')}\n请给一个不超过80字的监督建议，并出一个小问题。`
        });
        const result = await callChatApi(messages);
        if (box) box.textContent = result.ok ? result.content : result.error;
    } catch (e) {
        if (box) box.textContent = 'AI 监督暂时没有回复，检查 API 后再试。';
    }
}
window.askStudySupervisor = askStudySupervisor;

// --- Game App / 小游戏大厅 + 狼人杀 ---
const GAME_STATE_KEY = 'bynd_game_wolfcha_state_v1';
const GAME_ACTIVE_KEY = 'bynd_game_active_v1';
const GAME_ROLES = ['狼人', '预言家', '女巫', '守卫', '村民', '村民', '村民', '村民', '村民', '猎人'];
const GAME_LIBRARY = [
    { id: 'wolfcha', title: 'Wolfcha 狼人杀', tag: '多人推理', icon: 'ri-shield-star-fill', desc: '和现有角色一起发言、投票、入夜，角色会按人设参与。' },
    { id: 'sync', title: '默契问答', tag: 'AI互动', icon: 'ri-chat-smile-3-line', desc: '抽一个问题，让当前角色猜你会怎么回答。' },
    { id: 'cardmatch', title: '语言翻牌', tag: '学习联动', icon: 'ri-flashlight-line', desc: '用学习卡做小游戏，随机抽一张多语言卡来回忆。' }
];

function getActiveGame() {
    return localStorage.getItem(GAME_ACTIVE_KEY) || 'hub';
}

function setActiveGame(gameId) {
    localStorage.setItem(GAME_ACTIVE_KEY, gameId || 'hub');
}

function getGamePlayers() {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const userAvatar = profile.avatar || '';
    const chars = (window.myCharacters || []).slice(0, 9).map((char, index) => ({
        id: char.id,
        name: getMusicCharName(char),
        avatar: char.avatar || '',
        number: index + 2,
        isUser: false,
        role: ''
    }));
    return [{
        id: 'user',
        name: profile.name || '你',
        avatar: userAvatar,
        number: 1,
        isUser: true,
        role: ''
    }, ...chars];
}

function getGameState() {
    try {
        const state = JSON.parse(localStorage.getItem(GAME_STATE_KEY) || '{}') || {};
        return state.phase ? state : null;
    } catch (e) {
        return null;
    }
}

function saveGameState(state) {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state || {}));
}

function initGameApp() {
    setActiveGame('hub');
    renderGameApp();
}

function openGameHub() {
    setActiveGame('hub');
    renderGameApp();
}
window.openGameHub = openGameHub;

function openMiniGame(gameId) {
    setActiveGame(gameId);
    if (gameId === 'wolfcha' && !getGameState()) resetWolfchaGame(false);
    renderGameApp();
}
window.openMiniGame = openMiniGame;

function updateGameHeader(mode) {
    const kicker = document.getElementById('game-header-kicker');
    const title = document.getElementById('game-header-title');
    if (kicker) kicker.textContent = mode === 'hub' ? 'GAME HUB' : 'PLAYING';
    if (title) title.textContent = mode === 'hub' ? '小游戏' : (GAME_LIBRARY.find(game => game.id === mode)?.title || '小游戏');
}

function resetWolfchaGame(shouldRender = true) {
    const players = getGamePlayers().slice(0, 10);
    const roles = [...GAME_ROLES].slice(0, players.length).sort(() => Math.random() - 0.5);
    const state = {
        phase: 'lobby',
        day: 1,
        action: '契约待签署',
        selectedId: '',
        log: ['我自愿加入这场关于谎言与真相的游戏。'],
        players: players.map((player, index) => ({ ...player, role: roles[index] || '村民', alive: true }))
    };
    saveGameState(state);
    if (shouldRender) renderGameApp();
}
window.resetWolfchaGame = resetWolfchaGame;

function renderGameApp() {
    const el = document.getElementById('game-content');
    if (!el) return;
    const activeGame = getActiveGame();
    updateGameHeader(activeGame);
    if (activeGame === 'hub') {
        renderGameHub(el);
        return;
    }
    if (activeGame === 'sync') {
        renderSyncGame(el);
        return;
    }
    if (activeGame === 'cardmatch') {
        renderCardMatchGame(el);
        return;
    }
    const state = getGameState() || { players: getGamePlayers(), log: [] };
    const players = state.players || getGamePlayers();
    const alive = players.filter(player => player.alive !== false).length;
    const selected = players.find(player => player.id === state.selectedId) || players[0];
    el.innerHTML = `
        <section class="wolfcha-stage ${state.phase === 'night' ? 'night' : ''}">
            <div class="wolfcha-topline">
                <div class="wolfcha-brand"><i class="ri-shield-star-fill"></i><span>WOLFCHA</span></div>
                <div class="wolfcha-status">DAY <b>${String(state.day || 1).padStart(2, '0')}</b> ALIVE <b>${alive}/${players.length}</b></div>
                <button type="button" onclick="openGameHub()"><i class="ri-apps-2-line"></i> 大厅</button>
                <button type="button" onclick="resetWolfchaGame(true)"><i class="ri-restart-line"></i> 重开</button>
            </div>
            <div class="wolfcha-action-pill"><i class="ri-eye-line"></i><span>${musicEscapeHtml(state.action || '等待开始')}</span></div>
            <div class="wolfcha-center">
                <div class="wolfcha-avatar-large">${selected?.avatar ? `<img src="${musicEscapeAttr(selected.avatar)}" alt="${musicEscapeAttr(selected.name)}">` : '<i class="ri-user-smile-line"></i>'}</div>
                <div class="wolfcha-dialog">
                    <strong>${musicEscapeHtml(selected?.name || '主持人')}</strong>
                    <p>${musicEscapeHtml((state.log || []).slice(-1)[0] || '人到齐了，开始吧。')}</p>
                    <span>${(state.log || []).length} 条消息</span>
                </div>
            </div>
            <div class="wolfcha-actions">
                <button type="button" onclick="startWolfchaNight()"><i class="ri-moon-clear-line"></i> 入夜</button>
                <button type="button" onclick="wolfchaNextSpeech()"><i class="ri-chat-voice-line"></i> 发言</button>
                <button type="button" onclick="wolfchaVoteSelected()"><i class="ri-skull-2-line"></i> 投票</button>
            </div>
        </section>
        <section class="wolfcha-player-rail">
            ${players.map(player => `
                <button type="button" class="wolfcha-player ${player.id === state.selectedId ? 'active' : ''} ${player.alive === false ? 'dead' : ''}" onclick="selectWolfchaPlayer('${musicEscapeAttr(player.id)}')">
                    <span class="wolfcha-role ${player.role === '狼人' ? 'wolf' : ''}">${musicEscapeHtml(player.role || '未知')}</span>
                    <div>${player.avatar ? `<img src="${musicEscapeAttr(player.avatar)}" alt="${musicEscapeAttr(player.name)}">` : '<i class="ri-user-line"></i>'}</div>
                    <strong><em>${player.number}</em>${musicEscapeHtml(player.name)}</strong>
                </button>
            `).join('')}
        </section>
    `;
}
window.renderGameApp = renderGameApp;

function renderGameHub(el) {
    const chars = window.myCharacters || [];
    el.innerHTML = `
        <section class="game-hub">
            <div class="game-hub-hero">
                <span>WITH ${chars.length || 0} CHARACTERS</span>
                <strong>选择一个小游戏</strong>
                <p>游戏会尽量调用当前角色和角色列表；狼人杀已经接入角色玩家。</p>
            </div>
            <div class="game-library">
                ${GAME_LIBRARY.map(game => `
                    <button type="button" class="game-library-card" onclick="openMiniGame('${musicEscapeAttr(game.id)}')">
                        <i class="${musicEscapeAttr(game.icon)}"></i>
                        <div>
                            <span>${musicEscapeHtml(game.tag)}</span>
                            <strong>${musicEscapeHtml(game.title)}</strong>
                            <p>${musicEscapeHtml(game.desc)}</p>
                        </div>
                        <em class="ri-arrow-right-s-line"></em>
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function renderSyncGame(el) {
    const char = getStudySupervisor();
    el.innerHTML = `
        <section class="mini-game-panel">
            <button type="button" class="mini-game-back" onclick="openGameHub()"><i class="ri-arrow-left-s-line"></i> 返回大厅</button>
            <div class="mini-game-card">
                <span>默契问答</span>
                <strong>${musicEscapeHtml(char ? getMusicCharName(char) : 'AI')} 会猜你怎么回答</strong>
                <p id="sync-game-text">点开始后，角色会抛一个轻问题并给出自己的猜测。</p>
                <button type="button" onclick="startSyncMiniGame()"><i class="ri-sparkling-2-line"></i> 开始一题</button>
            </div>
        </section>
    `;
}

async function startSyncMiniGame() {
    const box = document.getElementById('sync-game-text');
    const char = getStudySupervisor();
    if (box) box.textContent = char ? `${getMusicCharName(char)} 正在想题目...` : '先导入角色并配置 API，会更像和角色一起玩。';
    if (!char || typeof callChatApi !== 'function') return;
    try {
        const messages = typeof buildMessages === 'function'
            ? buildMessages(char, Array.isArray(char.history) ? char.history.slice(-6) : [])
            : [{ role: 'system', content: `你是${getMusicCharName(char)}。` }];
        messages.push({ role: 'user', content: '我们正在玩默契问答。请出一个轻松的问题，并猜你觉得我会怎么回答，80字以内。' });
        const result = await callChatApi(messages);
        if (box) box.textContent = result.ok ? result.content : result.error;
    } catch (e) {
        if (box) box.textContent = '这一题暂时没连上 API。';
    }
}
window.startSyncMiniGame = startSyncMiniGame;

function renderCardMatchGame(el) {
    const cards = getStudyCards();
    const card = cards.length ? cards[Math.floor(Math.random() * cards.length)] : null;
    const languages = getStudyLanguages().filter(lang => card?.lines?.[lang.id]);
    el.innerHTML = `
        <section class="mini-game-panel">
            <button type="button" class="mini-game-back" onclick="openGameHub()"><i class="ri-arrow-left-s-line"></i> 返回大厅</button>
            <div class="mini-game-card">
                <span>语言翻牌</span>
                <strong>${card ? '回忆这张学习卡' : '还没有学习卡'}</strong>
                <div class="mini-card-lines">
                    ${card ? languages.map((lang, index) => `
                        <p class="${index === 0 ? 'show' : ''}"><b>${musicEscapeHtml(lang.short)}</b>${index === 0 ? musicEscapeHtml(card.lines[lang.id]) : '点击刷新后自己回忆这一行'}</p>
                    `).join('') : '<p class="show"><b>+</b>先去学习页保存一张多语言卡。</p>'}
                </div>
                <button type="button" onclick="renderGameApp()"><i class="ri-refresh-line"></i> 换一张</button>
            </div>
        </section>
    `;
}

function updateWolfchaState(mutator) {
    const state = getGameState();
    if (!state) return;
    mutator(state);
    saveGameState(state);
    renderGameApp();
}

function selectWolfchaPlayer(id) {
    updateWolfchaState(state => {
        state.selectedId = id;
        const player = state.players.find(item => item.id === id);
        if (player) state.action = `选择 ${player.number} 号`;
    });
}
window.selectWolfchaPlayer = selectWolfchaPlayer;

function startWolfchaNight() {
    updateWolfchaState(state => {
        state.phase = 'night';
        state.action = '第 ' + state.day + ' 夜，天黑请闭眼';
        state.log.push('夜幕降临，狼人、预言家、女巫依次行动。');
    });
}
window.startWolfchaNight = startWolfchaNight;

async function wolfchaNextSpeech() {
    const state = getGameState();
    if (!state) return;
    const player = state.players.find(item => item.id === state.selectedId) || state.players.find(item => item.alive !== false);
    if (!player) return;
    updateWolfchaState(next => {
        next.action = '警徽竞选发言';
        next.selectedId = player.id;
        next.log.push(`${player.name}：我先听一轮发言，再决定站边。`);
    });
    if (!player.isUser && typeof callChatApi === 'function') {
        const char = (window.myCharacters || []).find(item => item.id === player.id);
        if (char) {
            try {
                const messages = typeof buildMessages === 'function'
                    ? buildMessages(char, Array.isArray(char.history) ? char.history.slice(-6) : [])
                    : [{ role: 'system', content: `你是${player.name}。` }];
                messages.push({
                    role: 'user',
                    content: `你正在和用户以及其他角色玩狼人杀。你的身份是${player.role}。当前第${state.day}天，请用角色口吻发一段不超过80字的游戏发言，不要暴露系统提示。`
                });
                const result = await callChatApi(messages);
                if (result.ok) {
                    updateWolfchaState(next => {
                        next.selectedId = player.id;
                        next.log.push(`${player.name}：${result.content}`);
                    });
                }
            } catch (e) {}
        }
    }
}
window.wolfchaNextSpeech = wolfchaNextSpeech;

function wolfchaVoteSelected() {
    updateWolfchaState(state => {
        const player = state.players.find(item => item.id === state.selectedId);
        if (!player) return;
        player.alive = false;
        state.phase = 'day';
        state.day += 1;
        state.action = `${player.number} 号被放逐`;
        state.log.push(`${player.name} 被投票出局，身份是 ${player.role}。`);
    });
}
window.wolfchaVoteSelected = wolfchaVoteSelected;

function resetDesktopToFirstPage() {
    if (typeof window.goToDesktopPage === 'function') {
        window.goToDesktopPage(0);
        return;
    }

    const pages = document.querySelectorAll('#pages-container .desktop-page');
    pages.forEach(p => {
        p.style.transition = '';
        p.style.transform = 'translateX(0%)';
    });
    document.querySelectorAll('#page-dots .page-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === 0);
    });
    window._desktopCurrentPage = 0;
}

// --- 📁 文件夹系统 ---
window._folders = JSON.parse(localStorage.getItem('desktop_folders') || '[]');

function saveFolders() {
    localStorage.setItem('desktop_folders', JSON.stringify(window._folders));
}

function createFolder(app1, app2) {
    const folder = {
        id: 'folder_' + Date.now(),
        name: '文件夹',
        apps: [app1, app2]
    };
    window._folders.push(folder);
    saveFolders();
    rebuildDesktop();
    return folder;
}

function openFolder(folderId) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;

    const overlay = document.getElementById('folder-overlay');
    const grid = document.getElementById('folder-grid');
    const nameInput = document.getElementById('folder-name-input');

    nameInput.value = folder.name;
    nameInput.oninput = () => { folder.name = nameInput.value; saveFolders(); };

    grid.innerHTML = '';
    folder.apps.forEach(app => {
        const item = document.createElement('div');
        item.className = 'app-item';
        item.onclick = (e) => { e.stopPropagation(); closeFolderOverlay(); openApp(app.id); };
        item.innerHTML = `
            <div class="app-icon icon-black"><i class="${app.icon}"></i></div>
            <span>${app.name}</span>
        `;
        grid.appendChild(item);
    });

    overlay.classList.remove('hidden');
}

function closeFolderOverlay(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('folder-overlay').classList.add('hidden');
}

function addToFolder(folderId, app) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;
    if (!folder.apps.find(a => a.id === app.id)) {
        folder.apps.push(app);
        saveFolders();
        rebuildDesktop();
    }
}

function removeFromFolder(folderId, appId) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;
    folder.apps = folder.apps.filter(a => a.id !== appId);
    if (folder.apps.length <= 1) {
        window._folders = window._folders.filter(f => f.id !== folderId);
    }
    saveFolders();
    rebuildDesktop();
}

const DESKTOP_APPS = [
    { id: 'wechat', name: '微信', icon: 'ri-wechat-line' },
    { id: 'regex', name: '正则', icon: 'ri-code-s-slash-line' },
    { id: 'worldbook', name: '世界书', icon: 'ri-book-read-line' },
    { id: 'settings', name: '设置', icon: 'ri-settings-4-line' },
    { id: 'theme', name: '美化', icon: 'ri-palette-line' },
    { id: 'study', name: '学习', icon: 'ri-graduation-cap-line' },
    { id: 'money', name: '记账', icon: 'ri-money-cny-box-line' },
    { id: 'game', name: 'Game', icon: 'ri-gamepad-line' }
];

function rebuildDesktop() {
    const quads = document.querySelectorAll('.apps-quad');
    if (quads.length < 2) return;

    const folderAppIds = new Set();
    window._folders.forEach(f => f.apps.forEach(a => folderAppIds.add(a.id)));

    const freeApps = DESKTOP_APPS.filter(a => !folderAppIds.has(a.id));
    const allItems = [...window._folders.map(f => ({ type: 'folder', data: f })), ...freeApps.map(a => ({ type: 'app', data: a }))];

    quads.forEach((quad, qi) => {
        quad.innerHTML = '';
        const start = qi * 4;
        const slice = allItems.slice(start, start + 4);
        slice.forEach(item => {
            if (item.type === 'folder') {
                const f = item.data;
                const el = document.createElement('div');
                el.className = 'app-item is-folder';
                el.onclick = () => openFolder(f.id);
                const minis = f.apps.slice(0, 4).map(a => `<div class="folder-mini-icon"><i class="${a.icon}" style="font-size:9px;"></i></div>`).join('');
                el.innerHTML = `<div class="app-icon">${minis}</div><span>${f.name}</span>`;
                quad.appendChild(el);
            } else {
                const a = item.data;
                const el = document.createElement('div');
                el.className = 'app-item';
                el.onclick = () => openApp(a.id);
                el.innerHTML = `<div class="app-icon icon-black"><i class="${a.icon}"></i></div><span>${a.name}</span>`;
                quad.appendChild(el);
            }
        });
    });
}

function initFolderDrag() {
    const quads = document.querySelectorAll('.apps-quad');
    let dragSrc = null;
    let longPressTimer = null;

    quads.forEach(quad => {
        quad.querySelectorAll('.app-item:not(.is-folder)').forEach(item => {
            item.setAttribute('draggable', 'true');
            item.addEventListener('dragstart', (e) => {
                const appName = item.querySelector('span')?.textContent;
                const app = DESKTOP_APPS.find(a => a.name === appName);
                if (app) {
                    dragSrc = app;
                    e.dataTransfer.setData('text/plain', app.id);
                    item.style.opacity = '0.4';
                }
            });
            item.addEventListener('dragend', () => { item.style.opacity = '1'; dragSrc = null; });
            item.addEventListener('dragover', (e) => { e.preventDefault(); item.style.transform = 'scale(1.1)'; });
            item.addEventListener('dragleave', () => { item.style.transform = ''; });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.style.transform = '';
                if (!dragSrc) return;
                const targetName = item.querySelector('span')?.textContent;
                const targetApp = DESKTOP_APPS.find(a => a.name === targetName);
                if (targetApp && targetApp.id !== dragSrc.id) {
                    createFolder(dragSrc, targetApp);
                }
                dragSrc = null;
            });
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window._folders.length > 0) rebuildDesktop();
        setTimeout(initFolderDrag, 500);
        initPageSwipe();
    });
} else {
    if (window._folders.length > 0) rebuildDesktop();
    setTimeout(initFolderDrag, 500);
    initPageSwipe();
}

// --- 📄 页面滑动系统 ---
function initPageSwipe() {
    const container = document.getElementById('pages-container');
    if (!container) return;

    const pages = container.querySelectorAll('.desktop-page');
    const totalPages = pages.length;
    let currentPage = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    function goToPage(idx) {
        idx = Math.max(0, Math.min(idx, totalPages - 1));
        currentPage = idx;
        window._desktopCurrentPage = currentPage;
        pages.forEach(p => {
            p.style.transition = '';
            p.style.transform = `translateX(-${currentPage * 100}%)`;
        });
        updateDots();
    }
    window.goToDesktopPage = goToPage;

    function updateDots() {
        const dots = document.querySelectorAll('#page-dots .page-dot');
        dots.forEach((d, i) => d.classList.toggle('active', i === currentPage));
    }

    container.addEventListener('touchstart', (e) => {
        if (window._editMode) return;
        startX = e.touches[0].clientX;
        currentX = startX;
        isDragging = true;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (window._editMode) return;
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        const offset = -currentPage * 100 + (diff / container.offsetWidth) * 100;
        pages.forEach(p => {
            p.style.transition = 'none';
            p.style.transform = `translateX(${offset}%)`;
        });
    }, { passive: true });

    container.addEventListener('touchend', () => {
        if (window._editMode) {
            isDragging = false;
            return;
        }
        if (!isDragging) return;
        isDragging = false;
        const diff = currentX - startX;
        pages.forEach(p => p.style.transition = '');

        if (Math.abs(diff) > 60) {
            if (diff < 0 && currentPage < totalPages - 1) goToPage(currentPage + 1);
            else if (diff > 0 && currentPage > 0) goToPage(currentPage - 1);
            else goToPage(currentPage);
        } else {
            goToPage(currentPage);
        }
        startX = 0;
        currentX = 0;
    });

    goToPage(0);
}

// --- 桌面长按布局编辑 ---
const DESKTOP_LAYOUT_KEY = 'desktop_layout_v2';
window._editMode = false;
window._desktopSelectedLayoutItem = null;
let _editLongPressTimer = null;
let _desktopLayoutBackupHtml = '';
let _desktopDefaultLayoutHtml = '';
let _desktopLongPressStart = null;
let _desktopLongPressTriggered = false;
let _desktopLongPressActive = false;

function getDesktopPointerPoint(e) {
    const touch = e && e.touches && e.touches[0];
    const changedTouch = e && e.changedTouches && e.changedTouches[0];
    const point = touch || changedTouch || e || {};
    return {
        x: Number(point.clientX) || 0,
        y: Number(point.clientY) || 0
    };
}

function getDesktopEditScale() {
    const home = document.getElementById('home-screen');
    if (!home || !home.classList.contains('desktop-editing')) return 1;
    const scale = parseFloat(getComputedStyle(home).getPropertyValue('--desktop-edit-scale'));
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function getDesktopPageIndex(page) {
    const pages = Array.from(document.querySelectorAll('#pages-container .desktop-page'));
    return Math.max(0, pages.indexOf(page));
}

function getDesktopItemId(el) {
    if (el.dataset.layoutId) return el.dataset.layoutId;
    if (el.classList.contains('calendar-widget')) return 'widget-calendar';
    if (el.classList.contains('photo-large')) {
        if (el.querySelector('.desktop-img-1')) return 'widget-photo-1';
        if (el.querySelector('.desktop-img-2')) return 'widget-photo-2';
        const idx = Array.from(document.querySelectorAll('.photo-large')).indexOf(el);
        if (idx >= 0) return `widget-photo-${idx + 1}`;
        return 'widget-photo-' + Date.now();
    }
    if (el.classList.contains('app-item')) {
        const onclick = el.getAttribute('onclick') || '';
        const match = onclick.match(/openApp\('([^']+)'\)/);
        if (match) return 'app-' + match[1];
        const label = el.querySelector('span')?.textContent?.trim() || Date.now();
        return 'app-custom-' + label;
    }
    return 'item-' + Date.now();
}

function findDesktopBuiltinElement(id) {
    if (id === 'widget-calendar') return document.querySelector('.calendar-widget');
    if (id === 'widget-photo-1') return document.querySelector('.desktop-img-1')?.closest('.photo-large') || document.querySelectorAll('.photo-large')[0];
    if (id === 'widget-photo-2') return document.querySelector('.desktop-img-2')?.closest('.photo-large') || document.querySelectorAll('.photo-large')[1];
    if (id.startsWith('app-')) {
        const appId = id.slice(4);
        return Array.from(document.querySelectorAll('.app-item')).find(item => {
            const onclick = item.getAttribute('onclick') || '';
            return onclick.includes(`openApp('${appId}')`);
        });
    }
    return null;
}

function normalizeDesktopLayoutRect(item, pageArea) {
    const areaRect = pageArea.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    return {
        left: Math.max(8, rect.left - areaRect.left + pageArea.scrollLeft),
        top: Math.max(8, rect.top - areaRect.top + pageArea.scrollTop),
        width: Math.max(54, rect.width),
        height: Math.max(58, rect.height)
    };
}

function prepareDesktopLayoutItem(item, pageArea, rect) {
    if (!item || !pageArea) return;
    const id = getDesktopItemId(item);
    item.dataset.layoutId = id;
    item.dataset.layoutType = item.dataset.layoutType || (id.startsWith('app-') ? 'app' : 'builtin');
    item.classList.add('desktop-layout-item');
    if (item.classList.contains('app-item')) item.classList.add('layout-app');
    pageArea.classList.add('layout-canvas');
    if (item.parentElement !== pageArea) pageArea.appendChild(item);
    item.style.left = `${Math.round(rect.left)}px`;
    item.style.top = `${Math.round(rect.top)}px`;
    item.style.width = `${Math.round(rect.width)}px`;
    item.style.height = `${Math.round(rect.height)}px`;
    setupDesktopLayoutItem(item);
}

function materializeDesktopPage(page) {
    const pageArea = page.querySelector('.desktop-scroll-area');
    if (!pageArea) return;
    const items = Array.from(page.querySelectorAll('.calendar-widget, .photo-large, .app-item, .desktop-custom-widget'));
    items.forEach(item => {
        const rect = normalizeDesktopLayoutRect(item, pageArea);
        prepareDesktopLayoutItem(item, pageArea, rect);
    });
    page.querySelectorAll('.bento-box, .desktop-empty-placeholder').forEach(el => el.classList.add('layout-source-hidden'));
}

function materializeExistingDesktopForLayout() {
    document.querySelectorAll('#pages-container .desktop-page').forEach(materializeDesktopPage);
}

function setupDesktopLayoutItem(item) {
    if (item._layoutReady) return;
    item._layoutReady = true;
    item.dataset.layoutReady = '1';
    item.addEventListener('pointerdown', startDesktopItemDrag);
    item.addEventListener('click', (e) => {
        if (!window._editMode) return;
        e.preventDefault();
        e.stopPropagation();
        selectDesktopLayoutItem(item);
    }, true);
}

function addDesktopItemControls(item) {
    item.querySelectorAll(':scope > .desktop-resize-handle, :scope > .desktop-item-move-page').forEach(el => el.remove());
    if (!item.classList.contains('layout-app')) {
        const resize = document.createElement('div');
        resize.className = 'desktop-resize-handle';
        resize.addEventListener('pointerdown', startDesktopItemResize);
        item.appendChild(resize);
    }
    const move = document.createElement('button');
    move.type = 'button';
    move.className = 'desktop-item-move-page';
    move.textContent = '换屏';
    move.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        moveSelectedDesktopItemToOtherPage();
    });
    item.appendChild(move);
}

function selectDesktopLayoutItem(item) {
    document.querySelectorAll('.desktop-layout-item.selected').forEach(el => el.classList.remove('selected'));
    window._desktopSelectedLayoutItem = item;
    item.classList.add('selected');
    addDesktopItemControls(item);
}

function startDesktopItemDrag(e) {
    if (!window._editMode || e.target.closest('.desktop-resize-handle, .desktop-item-move-page')) return;
    const item = e.currentTarget;
    const pageArea = item.closest('.desktop-scroll-area');
    if (!pageArea) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof item.setPointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
        try { item.setPointerCapture(e.pointerId); } catch (err) {}
    }
    selectDesktopLayoutItem(item);
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseFloat(item.style.left) || 0;
    const startTop = parseFloat(item.style.top) || 0;
    const scale = getDesktopEditScale();

    const move = (ev) => {
        const maxLeft = Math.max(0, pageArea.clientWidth - item.offsetWidth);
        const maxTop = Math.max(0, Math.max(pageArea.scrollHeight, pageArea.clientHeight) - item.offsetHeight);
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        item.style.left = `${Math.max(0, Math.min(maxLeft, startLeft + dx))}px`;
        item.style.top = `${Math.max(0, Math.min(maxTop, startTop + dy))}px`;
    };
    const up = () => {
        if (typeof item.releasePointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
            try { item.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

function startDesktopItemResize(e) {
    if (!window._editMode) return;
    const item = e.currentTarget.closest('.desktop-layout-item');
    const pageArea = item?.closest('.desktop-scroll-area');
    if (!item || !pageArea) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = item.offsetWidth;
    const startHeight = item.offsetHeight;
    const minWidth = item.classList.contains('calendar-widget') ? 220 : 118;
    const minHeight = item.classList.contains('calendar-widget') ? 118 : 96;
    const scale = getDesktopEditScale();

    const move = (ev) => {
        const left = parseFloat(item.style.left) || 0;
        const maxWidth = pageArea.clientWidth - left;
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        item.style.width = `${Math.max(minWidth, Math.min(maxWidth, startWidth + dx))}px`;
        item.style.height = `${Math.max(minHeight, startHeight + dy)}px`;
    };
    const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

function createDesktopCustomWidget(kind, id) {
    const el = document.createElement('div');
    el.className = `desktop-custom-widget desktop-widget-${kind}`;
    el.dataset.layoutType = 'custom';
    el.dataset.widgetKind = kind;
    el.dataset.layoutId = id || `custom-${kind}-${Date.now()}`;
    const templates = {
        music: `<div class="dw-mp3-screen"><i class="ri-disc-line"></i><span>playlist</span><strong>soft blue</strong></div><div class="dw-mp3-pad"><i class="ri-skip-back-fill"></i><b></b><i class="ri-skip-forward-fill"></i></div>`,
        camera: `<div class="dw-camera-lens"><i class="ri-camera-3-line"></i></div><strong>camera</strong><span>daily snaps</span>`,
        album: `<div class="dw-album-grid"><span></span><span></span><span></span><span></span></div><strong>gallery</strong><em>4 photos</em>`
    };
    el.innerHTML = templates[kind] || templates.album;
    return el;
}

function addDesktopCustomWidget(kind) {
    if (!window._editMode) enterEditMode();
    const pageIndex = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
    const page = document.querySelectorAll('#pages-container .desktop-page')[pageIndex] || document.querySelector('#pages-container .desktop-page');
    const pageArea = page?.querySelector('.desktop-scroll-area');
    if (!pageArea) return;
    const item = createDesktopCustomWidget(kind);
    pageArea.appendChild(item);
    prepareDesktopLayoutItem(item, pageArea, {
        left: 22,
        top: 70 + pageArea.querySelectorAll('.desktop-custom-widget').length * 18,
        width: kind === 'music' ? 300 : 142,
        height: kind === 'music' ? 132 : 142
    });
    selectDesktopLayoutItem(item);
}

function moveSelectedDesktopItemToOtherPage() {
    const item = window._desktopSelectedLayoutItem;
    if (!item) return;
    const pages = Array.from(document.querySelectorAll('#pages-container .desktop-page'));
    const currentPage = item.closest('.desktop-page');
    const currentIndex = getDesktopPageIndex(currentPage);
    const nextIndex = currentIndex === 0 ? 1 : 0;
    const targetArea = pages[nextIndex]?.querySelector('.desktop-scroll-area');
    if (!targetArea) return;
    targetArea.classList.add('layout-canvas');
    targetArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    targetArea.appendChild(item);
    item.style.left = '24px';
    item.style.top = '64px';
    if (typeof window.goToDesktopPage === 'function') window.goToDesktopPage(nextIndex);
    selectDesktopLayoutItem(item);
}

function renderDesktopEditChrome() {
    const home = document.getElementById('home-screen');
    if (!home || document.getElementById('desktop-edit-toolbar')) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'desktop-edit-toolbar';
    toolbar.className = 'desktop-edit-toolbar';
    toolbar.innerHTML = `
        <div class="desktop-edit-handle">
            <strong>编辑桌面</strong>
            <span>拖动图标或组件，点选后可缩放、换屏。</span>
        </div>
        <div class="desktop-widget-tray">
            <button type="button" onclick="addDesktopCustomWidget('music')"><i class="ri-music-2-line"></i><span>音乐</span></button>
            <button type="button" onclick="addDesktopCustomWidget('camera')"><i class="ri-camera-3-line"></i><span>相机</span></button>
            <button type="button" onclick="addDesktopCustomWidget('album')"><i class="ri-image-2-line"></i><span>相册</span></button>
        </div>
        <div class="desktop-edit-actions">
            <button type="button" class="restore" onclick="promptRestoreDefaultDesktopLayout()">恢复原始</button>
            <button type="button" onclick="exitEditMode(false)">取消</button>
            <button type="button" class="primary" onclick="promptSaveDesktopLayout()">保存布局</button>
        </div>
    `;
    home.appendChild(toolbar);
}

function enterEditMode() {
    if (window._editMode) return;
    const pages = document.getElementById('pages-container');
    const home = document.getElementById('home-screen');
    if (!pages || !home) return;
    window._editMode = true;
    _desktopLayoutBackupHtml = pages.innerHTML;
    materializeExistingDesktopForLayout();
    document.querySelectorAll('.desktop-layout-item').forEach(setupDesktopLayoutItem);
    home.classList.add('desktop-editing');
    renderDesktopEditChrome();
    if (navigator.vibrate) navigator.vibrate(20);
}

function startDesktopEditLongPress(e) {
    const home = document.getElementById('home-screen');
    if (!home || window._editMode) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    if (e.target.closest('.app-window, .dock-bar, .folder-overlay, .desktop-edit-toolbar, .desktop-save-modal')) return;
    if (!e.target.closest('.desktop-scroll-area, .desktop-layout-item, .app-item, .photo-large, .calendar-widget, .desktop-page')) return;

    const point = getDesktopPointerPoint(e);
    _desktopLongPressActive = true;
    _desktopLongPressTriggered = false;
    _desktopLongPressStart = point;
    clearTimeout(_editLongPressTimer);
    _editLongPressTimer = setTimeout(() => {
        if (!_desktopLongPressActive) return;
        _desktopLongPressTriggered = true;
        _desktopLongPressActive = false;
        enterEditMode();
    }, 520);
}

function cancelDesktopEditLongPress(e) {
    if (e && e.type === 'pointermove' && _desktopLongPressStart) {
        const point = getDesktopPointerPoint(e);
        const dx = Math.abs(point.x - _desktopLongPressStart.x);
        const dy = Math.abs(point.y - _desktopLongPressStart.y);
        if (dx < 16 && dy < 16) return;
    }
    if (e && e.type === 'touchmove' && _desktopLongPressStart) {
        const point = getDesktopPointerPoint(e);
        const dx = Math.abs(point.x - _desktopLongPressStart.x);
        const dy = Math.abs(point.y - _desktopLongPressStart.y);
        if (dx < 16 && dy < 16) return;
    }
    clearTimeout(_editLongPressTimer);
    _desktopLongPressActive = false;
    _desktopLongPressStart = null;
}

function promptSaveDesktopLayout() {
    const home = document.getElementById('home-screen');
    if (!home || document.getElementById('desktop-save-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'desktop-save-modal';
    modal.className = 'desktop-save-modal';
    modal.innerHTML = `
        <div class="desktop-save-card">
            <strong>保存当前桌面布局？</strong>
            <span>图标、组件位置和大小都会保存。</span>
            <div>
                <button type="button" onclick="document.getElementById('desktop-save-modal')?.remove()">再看看</button>
                <button type="button" class="primary" onclick="saveDesktopLayout()">保存</button>
            </div>
        </div>
    `;
    home.appendChild(modal);
}

function promptRestoreDefaultDesktopLayout() {
    const home = document.getElementById('home-screen');
    if (!home || document.getElementById('desktop-save-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'desktop-save-modal';
    modal.className = 'desktop-save-modal';
    modal.innerHTML = `
        <div class="desktop-save-card desktop-restore-card">
            <strong>恢复原始桌面？</strong>
            <span>会清除已保存的桌面摆放，图标和组件回到初始布局。</span>
            <div>
                <button type="button" onclick="document.getElementById('desktop-save-modal')?.remove()">取消</button>
                <button type="button" class="primary danger" onclick="restoreDefaultDesktopLayout()">恢复</button>
            </div>
        </div>
    `;
    home.appendChild(modal);
}

function collectDesktopLayout() {
    return Array.from(document.querySelectorAll('.desktop-layout-item')).map(item => {
        const page = item.closest('.desktop-page');
        return {
            id: item.dataset.layoutId,
            type: item.dataset.layoutType || 'builtin',
            kind: item.dataset.widgetKind || '',
            page: getDesktopPageIndex(page),
            left: Math.round(parseFloat(item.style.left) || 0),
            top: Math.round(parseFloat(item.style.top) || 0),
            width: Math.round(item.offsetWidth),
            height: Math.round(item.offsetHeight)
        };
    });
}

function saveDesktopLayout() {
    localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify({ items: collectDesktopLayout(), savedAt: Date.now() }));
    exitEditMode(true);
}

function restoreDefaultDesktopLayout() {
    localStorage.removeItem(DESKTOP_LAYOUT_KEY);
    document.getElementById('desktop-save-modal')?.remove();
    const pages = document.getElementById('pages-container');
    const template = _desktopDefaultLayoutHtml || _desktopLayoutBackupHtml;
    if (pages && template) {
        const newPages = pages.cloneNode(false);
        newPages.innerHTML = template;
        pages.replaceWith(newPages);
    }
    window._editMode = false;
    window._desktopSelectedLayoutItem = null;
    document.getElementById('home-screen')?.classList.remove('desktop-editing');
    clearDesktopEditChrome();
    setTimeout(() => {
        if (typeof rebuildDesktop === 'function') rebuildDesktop();
        if (typeof initFolderDrag === 'function') initFolderDrag();
        if (typeof initPageSwipe === 'function') initPageSwipe();
        if (typeof resetDesktopToFirstPage === 'function') resetDesktopToFirstPage();
    }, 0);
}

function clearDesktopEditChrome() {
    document.getElementById('desktop-edit-toolbar')?.remove();
    document.getElementById('desktop-save-modal')?.remove();
    document.querySelectorAll('.desktop-resize-handle, .desktop-item-move-page').forEach(el => el.remove());
    document.querySelectorAll('.desktop-layout-item.selected').forEach(el => el.classList.remove('selected'));
}

function exitEditMode(saveChanges) {
    if (!window._editMode) return;
    window._editMode = false;
    document.getElementById('home-screen')?.classList.remove('desktop-editing');
    clearDesktopEditChrome();
    window._desktopSelectedLayoutItem = null;
    if (!saveChanges && _desktopLayoutBackupHtml) {
        const oldPages = document.getElementById('pages-container');
        const newPages = oldPages.cloneNode(false);
        newPages.innerHTML = _desktopLayoutBackupHtml;
        oldPages.replaceWith(newPages);
        setTimeout(() => {
            initFolderDrag();
            initPageSwipe();
            document.querySelectorAll('.desktop-layout-item').forEach(item => {
                item._layoutReady = false;
                item.removeAttribute('data-layout-ready');
            });
        }, 0);
    }
}

function applySavedDesktopLayout() {
    let saved;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}');
    } catch (e) {
        return;
    }
    if (!Array.isArray(saved.items) || !saved.items.length) return;
    const pages = Array.from(document.querySelectorAll('#pages-container .desktop-page'));
    saved.items.forEach(record => {
        const page = pages[Math.max(0, Math.min(pages.length - 1, record.page || 0))];
        const area = page?.querySelector('.desktop-scroll-area');
        if (!area) return;
        let item = record.type === 'custom'
            ? createDesktopCustomWidget(record.kind || 'album', record.id)
            : findDesktopBuiltinElement(record.id);
        if (!item) return;
        area.appendChild(item);
        prepareDesktopLayoutItem(item, area, record);
        area.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
        page.querySelectorAll('.bento-box').forEach(el => el.classList.add('layout-source-hidden'));
    });
}

function startDesktopLayoutFromTheme() {
    if (typeof closeApp === 'function') closeApp('theme');
    setTimeout(() => {
        if (typeof unlockPhone === 'function') unlockPhone();
        enterEditMode();
    }, 360);
}

function initEditMode() {
    const home = document.getElementById('home-screen');
    if (!home || home.dataset.editInit === '1') return;
    const pages = document.getElementById('pages-container');
    if (pages && !_desktopDefaultLayoutHtml) _desktopDefaultLayoutHtml = pages.innerHTML;
    home.dataset.editInit = '1';
    home.addEventListener('pointerdown', startDesktopEditLongPress, true);
    ['pointerup', 'pointercancel', 'pointerleave', 'pointermove'].forEach(type => {
        home.addEventListener(type, cancelDesktopEditLongPress, true);
    });
    home.addEventListener('touchstart', startDesktopEditLongPress, { capture: true, passive: true });
    ['touchend', 'touchcancel', 'touchmove'].forEach(type => {
        home.addEventListener(type, cancelDesktopEditLongPress, { capture: true, passive: true });
    });
    home.addEventListener('click', (e) => {
        if (!_desktopLongPressTriggered) return;
        e.preventDefault();
        e.stopPropagation();
        _desktopLongPressTriggered = false;
    }, true);
    setTimeout(applySavedDesktopLayout, 50);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditMode);
} else {
    initEditMode();
}
