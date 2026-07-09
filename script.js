// --- 📱 script.js: 核心系统与路由 (最终完整版) ---

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initBattery();
    initDate();
    initLockScreen();
    initCalendar();
    initByndFullscreenRuntime();
    
    if (typeof initIconGrid === 'function') initIconGrid();
    if (typeof initTheme === 'function') initTheme();
    initLockscreenWeatherRuntime();
    if (typeof loadCharactersFromStorage === 'function') loadCharactersFromStorage(); 
    if (typeof initOutingAppRuntime === 'function') initOutingAppRuntime();
    if (typeof initDesktopStatusWidgetRuntime === 'function') initDesktopStatusWidgetRuntime();
    initProactiveNotify();
    if (typeof syncMonitorPetFloating === 'function') syncMonitorPetFloating();
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
    dateEl.innerHTML = `<span>${weekdays[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}</span>`;
}

function unlockPhone() {
    document.getElementById('lock-screen')?.classList.add('unlocked');
    document.getElementById('home-screen')?.classList.remove('hidden');
    resetDesktopToFirstPage();
    if (typeof scheduleDesktopVisibleLayoutRepair === 'function') scheduleDesktopVisibleLayoutRepair();
    if (typeof syncMonitorPetFloating === 'function') syncMonitorPetFloating();
    
    // 触发变色检查
    const statusBar = document.querySelector('.status-bar');
    if (typeof window.homeIsDark !== 'undefined') {
        if (window.homeIsDark) statusBar.classList.add('white-text');
        else statusBar.classList.remove('white-text');
    }
}

function initCalendar() {
    const widgets = Array.from(document.querySelectorAll('.calendar-widget'));
    if (!widgets.length) return;

    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const today = now.getDate();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    widgets.forEach(widget => {
        const dayNameEl = widget.querySelector('.cal-day');
        const dateNumEl = widget.querySelector('.cal-date');
        const monthNameEl = widget.querySelector('.cal-month');
        const gridEl = widget.querySelector('.cal-grid');
        if (dayNameEl) dayNameEl.textContent = days[now.getDay()];
        if (dateNumEl) dateNumEl.textContent = today;
        if (monthNameEl) monthNameEl.textContent = months[now.getMonth()];
        if (!gridEl) return;
        gridEl.innerHTML = '';
        for (let i = 1; i <= totalDays; i++) {
            const dot = document.createElement('div');
            dot.className = 'cal-dot';
            dot.textContent = i;
            if (i === today) dot.classList.add('active');
            gridEl.appendChild(dot);
        }
    });
}

// --- 🌟 路由控制 (这里修复了！) ---

function openApp(appName) {
    window._activeAppOriginPageByApp = window._activeAppOriginPageByApp || {};
    window._activeAppOriginPageByApp[appName] = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
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
    // 10. 记账 App
    else if (appName === 'money') {
        const win = document.getElementById('app-money-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initMoneyApp();
        }
    }
    // 11. 盗梦空间
    else if (appName === 'dream') {
        const win = document.getElementById('app-dream-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initDreamApp();
        }
    }
    // 12. 监控
    else if (appName === 'monitor') {
        const win = document.getElementById('app-monitor-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initMonitorApp();
        }
    }
    // 13. 一起出门
    else if (appName === 'outing') {
        const win = document.getElementById('app-outing-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initOutingApp();
        }
    }
    // 14. 共读
    else if (appName === 'coread') {
        const win = document.getElementById('app-coread-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initCoReadApp();
        }
    }
    // 15. 相册
    else if (appName === 'album') {
        const win = document.getElementById('app-album-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initAlbumApp();
        }
    }
    // 16. System Camera
    else if (appName === 'camera') {
        openSystemCamera();
    }
    // 其他未开发
    else {
        alert("正在打开: " + appName + " (功能开发中...)");
    }
    if (typeof syncMonitorPetFloating === 'function') setTimeout(syncMonitorPetFloating, 40);
}

function openSystemCamera() {
    let input = document.getElementById('bynd-system-camera-input')
        || document.getElementById('wc-camera-input');
    if (!input) {
        input = document.createElement('input');
        input.id = 'bynd-system-camera-input';
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.setAttribute('capture', 'environment');
        input.style.display = 'none';
        input.onchange = () => handleSystemCameraCapture(input);
        document.body.appendChild(input);
    }
    if (!input) {
        alert('当前页面没有找到相机入口');
        return;
    }
    input.value = '';
    input.click();
}
window.openSystemCamera = openSystemCamera;

function handleSystemCameraCapture(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const kind = /^video\//i.test(file.type) ? '视频' : '照片';
    const msg = `已拍摄${kind}：${file.name || 'camera capture'}`;
    if (typeof showWechatToast === 'function') showWechatToast(msg);
    else alert(msg);
}
window.handleSystemCameraCapture = handleSystemCameraCapture;

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
    else if (appName === 'money') winId = 'app-money-window';
    else if (appName === 'dream') winId = 'app-dream-window';
    else if (appName === 'monitor') winId = 'app-monitor-window';
    else if (appName === 'outing') winId = 'app-outing-window';
    else if (appName === 'coread') winId = 'app-coread-window';
    else if (appName === 'album') winId = 'app-album-window';
    const win = document.getElementById(winId);
    if (win) {
        restoreDesktopPageAfterApp(appName);
        win.classList.remove('active');
        setTimeout(() => win.classList.add('hidden'), 300);

        if (appName === 'wechat' && typeof closeChat === 'function') {
            if (typeof collapseWechatMusicOverlaysToIsland === 'function') collapseWechatMusicOverlaysToIsland();
            setTimeout(closeChat, 300);
        }
        if (typeof syncMonitorPetFloating === 'function') setTimeout(syncMonitorPetFloating, 320);
    }
}

function restoreDesktopPageAfterApp(appName) {
    const page = window._activeAppOriginPageByApp && Number.isInteger(window._activeAppOriginPageByApp[appName])
        ? window._activeAppOriginPageByApp[appName]
        : 0;
    if (typeof window.goToDesktopPage === 'function') {
        window.goToDesktopPage(page);
        return;
    }
    if (page <= 0) resetDesktopToFirstPage();
}

// --- BYND PWA / 手机通知壳 ---
const BYND_NOTIFY_SETTINGS_KEY = 'bynd_proactive_notify_settings_v1';
const BYND_NOTIFY_STATE_KEY = 'bynd_proactive_notify_state_v1';
const BYND_NOTIFY_CLIENT_ID_KEY = 'bynd_proactive_notify_client_id_v1';
const BYND_DEFAULT_PUSH_WORKER_ENDPOINT = '';
const BYND_DEFAULT_VAPID_PUBLIC_KEY = 'BIbjVk-agaHTFm60-tWEQVguyL40QGfEPf1PQrgonF_zN--LvkVpLED90WOl-WP3D5u9ptu3L4RxuGLn_2mu31U';
const BYND_NOTIFY_MIN_INTERVAL_HOURS = 0.1;
const BYND_NOTIFY_MAX_INTERVAL_HOURS = 720;
const BYND_NOTIFY_INTERVAL_PRESETS = [0.5, 1, 3, 6, 12, 24];
let _byndServiceWorkerReady;

function getProactiveNotifyClientId() {
    let id = localStorage.getItem(BYND_NOTIFY_CLIENT_ID_KEY);
    if (!id) {
        id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : 'client_' + Date.now() + '_' + Math.random().toString(16).slice(2);
        localStorage.setItem(BYND_NOTIFY_CLIENT_ID_KEY, id);
    }
    return id;
}

function clampProactiveNotifyIntervalHours(value, fallback = 24) {
    const num = Number(value);
    const safe = Number.isFinite(num) && num > 0 ? num : fallback;
    return Math.max(BYND_NOTIFY_MIN_INTERVAL_HOURS, Math.min(BYND_NOTIFY_MAX_INTERVAL_HOURS, safe));
}

function parseProactiveNotifyIntervalHours(value, fallback = 24) {
    if (typeof value === 'number') return clampProactiveNotifyIntervalHours(value, fallback);
    const text = String(value || '').trim().toLowerCase();
    if (!text) return clampProactiveNotifyIntervalHours(fallback, 24);
    if (/半\s*(小时|小時|h|hour)/i.test(text)) return 0.5;
    const match = text.match(/(\d+(?:\.\d+)?)/);
    const num = match ? Number(match[1]) : NaN;
    if (!Number.isFinite(num)) return clampProactiveNotifyIntervalHours(fallback, 24);
    if (/(分钟|分鐘|分|min|minute|m\b)/i.test(text)) return clampProactiveNotifyIntervalHours(num / 60, fallback);
    if (/(天|日|day|d\b)/i.test(text)) return clampProactiveNotifyIntervalHours(num * 24, fallback);
    return clampProactiveNotifyIntervalHours(num, fallback);
}

function formatProactiveNotifyInterval(value) {
    const hours = clampProactiveNotifyIntervalHours(value, 24);
    if (hours < 1) {
        const minutes = Math.round(hours * 60);
        return `${minutes} 分钟`;
    }
    if (hours >= 24 && Math.abs(hours % 24) < 0.001) {
        const days = Math.round(hours / 24);
        return days === 1 ? '1 天' : `${days} 天`;
    }
    return Number.isInteger(hours) ? `${hours} 小时` : `${Number(hours.toFixed(1))} 小时`;
}

function normalizeProactiveWorkerEndpoint(value) {
    const raw = String(value || '').trim().replace(/\/+$/, '');
    if (!raw) return '';
    try {
        const url = new URL(raw, location.origin);
        if (url.hostname.endsWith('.workers.dev')) return '';
    } catch (e) {}
    return raw;
}

function isByndMobileRuntime() {
    return document.documentElement.classList.contains('mobile-runtime');
}

function isByndAndroidAppRuntime() {
    return !!window.ByndAndroid;
}

function markByndDisplayMode() {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
    const fullscreen = window.matchMedia?.('(display-mode: fullscreen)').matches;
    const iosStandalone = window.navigator?.standalone === true;
    const isIOS = document.documentElement.classList.contains('bynd-ios');
    document.documentElement.classList.toggle('bynd-display-standalone', !!standalone || iosStandalone);
    // iOS PWA 不是真全屏：系统状态栏仍在，误标 fullscreen 会清掉安全区让位。
    // manifest "display: fullscreen" 会让 iOS 的 matchMedia 报 fullscreen=true，必须排除 iOS（2026-07-09 真机七图事故）。
    document.documentElement.classList.toggle('bynd-display-fullscreen', !!fullscreen && !isIOS);
}

function tryByndFullscreen() {
    if (isByndAndroidAppRuntime()) return;
    if (!isByndMobileRuntime() || document.fullscreenElement) return;
    const target = document.documentElement;
    const request = target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen;
    if (request) Promise.resolve(request.call(target)).then(markByndDisplayMode).catch(markByndDisplayMode);
}

function initByndFullscreenRuntime() {
    markByndDisplayMode();
    if (isByndAndroidAppRuntime()) {
        document.documentElement.classList.add('bynd-android-app');
        return;
    }
    window.matchMedia?.('(display-mode: fullscreen)').addEventListener?.('change', markByndDisplayMode);
    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', markByndDisplayMode);
    document.addEventListener('fullscreenchange', markByndDisplayMode);
    document.addEventListener('webkitfullscreenchange', markByndDisplayMode);
    ['pointerup', 'touchend', 'click'].forEach(type => {
        document.addEventListener(type, tryByndFullscreen, { once: true, passive: true });
    });
}

function cleanupByndServiceWorkerIfIdle() {
    const settings = getProactiveNotifySettings();
    if (settings.enabled || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations?.().then(registrations => {
        registrations.forEach(reg => {
            const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
            if (scriptURL.includes('/sw.js')) reg.unregister().catch(() => {});
        });
    }).catch(() => {});
    if ('caches' in window) caches.delete('bynd-notify-cache-v1').catch(() => {});
}

function ensureByndServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (_byndServiceWorkerReady) return _byndServiceWorkerReady;
    _byndServiceWorkerReady = navigator.serviceWorker.register('sw.js?v=20260704-push-safe1').then(() => {
        syncProactiveServiceWorkerConfig();
        return navigator.serviceWorker.ready;
    }).catch(err => {
        console.warn('service worker register failed:', err);
        _byndServiceWorkerReady = null;
        throw err;
    });
    return _byndServiceWorkerReady;
}

function getProactiveNotifySettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(BYND_NOTIFY_SETTINGS_KEY) || '{}') || {};
        return {
            enabled: !!saved.enabled,
            charId: saved.charId || 'current',
            intervalHours: parseProactiveNotifyIntervalHours(saved.intervalHours, 24),
            workerEndpoint: normalizeProactiveWorkerEndpoint(saved.workerEndpoint),
            vapidPublicKey: String(saved.vapidPublicKey || '').trim(),
            intervalUpdatedBy: String(saved.intervalUpdatedBy || '').trim(),
            intervalUpdatedByCharId: String(saved.intervalUpdatedByCharId || '').trim(),
            intervalUpdatedByCharName: String(saved.intervalUpdatedByCharName || '').trim(),
            intervalUpdatedReason: String(saved.intervalUpdatedReason || '').trim(),
            intervalUpdatedAt: Number(saved.intervalUpdatedAt) || 0
        };
    } catch (e) {
        return { enabled: false, charId: 'current', intervalHours: 24, workerEndpoint: '', vapidPublicKey: '' };
    }
}

function getDefaultProactivePushConfig() {
    return {
        workerEndpoint: BYND_DEFAULT_PUSH_WORKER_ENDPOINT.trim(),
        vapidPublicKey: BYND_DEFAULT_VAPID_PUBLIC_KEY.trim()
    };
}

function resolveProactiveNotifySettings(settings = getProactiveNotifySettings()) {
    const defaults = getDefaultProactivePushConfig();
    const workerEndpoint = settings.workerEndpoint || defaults.workerEndpoint;
    const vapidPublicKey = settings.vapidPublicKey || defaults.vapidPublicKey;
    return {
        ...settings,
        workerEndpoint,
        vapidPublicKey,
        usingBuiltInPush: !settings.workerEndpoint && !settings.vapidPublicKey && !!workerEndpoint && !!vapidPublicKey
    };
}

function saveProactiveNotifySettings(settings) {
    localStorage.setItem(BYND_NOTIFY_SETTINGS_KEY, JSON.stringify(settings || getProactiveNotifySettings()));
    syncProactiveServiceWorkerConfig();
}

function applyProactiveNotifyIntervalByChar(char, intervalValue, reason = '') {
    const current = getProactiveNotifySettings();
    const intervalHours = parseProactiveNotifyIntervalHours(intervalValue, current.intervalHours || 24);
    const charName = getProactiveCharName(char);
    const next = {
        ...current,
        intervalHours,
        intervalUpdatedBy: 'char',
        intervalUpdatedByCharId: char?.id || '',
        intervalUpdatedByCharName: charName,
        intervalUpdatedReason: String(reason || '').trim().slice(0, 140),
        intervalUpdatedAt: Date.now()
    };
    saveProactiveNotifySettings(next);
    renderProactiveNotifySettings();
    syncProactivePushSubscription().catch(() => {});
    return {
        ok: true,
        intervalHours,
        intervalLabel: formatProactiveNotifyInterval(intervalHours),
        charName,
        reason: next.intervalUpdatedReason
    };
}

function buildProactiveNotifyPromptContext(char) {
    const settings = getProactiveNotifySettings();
    const intervalLabel = formatProactiveNotifyInterval(settings.intervalHours);
    const charName = getProactiveCharName(char);
    const lastChanged = settings.intervalUpdatedBy === 'char' && settings.intervalUpdatedByCharName
        ? `上次由${settings.intervalUpdatedByCharName}改成这个时间${settings.intervalUpdatedReason ? `，理由是：${settings.intervalUpdatedReason}` : ''}。`
        : settings.intervalUpdatedBy === 'user'
            ? '这是用户设置的后台消息时间。'
            : '这是当前默认后台消息时间。';
    if (!settings.enabled) {
        return `【后台消息设置】后台消息未开启；当前预设时间是 ${intervalLabel}。你知道这个开关目前是关的，不要主动输出后台时间修改指令。`;
    }
    return `【后台消息设置】后台消息已开启；当前会在用户 ${intervalLabel} 没回来时提醒。${lastChanged}你作为${charName}可以知道这个时间；如果你按人设明显不喜欢这个间隔（太短、太久或不符合你们关系），可以偶尔把 [微信后台时间:新时间|原因] 作为独立段输出，例如 [微信后台时间:2小时|我不想等到一天后才找你]。系统会真的修改后台时间并用灵动岛通知用户；不要频繁修改，也不要在普通气泡里解释指令。`;
}

window.applyProactiveNotifyIntervalByChar = applyProactiveNotifyIntervalByChar;
window.buildProactiveNotifyPromptContext = buildProactiveNotifyPromptContext;
window.formatProactiveNotifyInterval = formatProactiveNotifyInterval;
window.getProactiveNotifySettings = getProactiveNotifySettings;

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
    const settings = resolveProactiveNotifySettings();
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

function getProactiveNotifyIntervalPresetValue(intervalHours) {
    const hours = clampProactiveNotifyIntervalHours(intervalHours, 24);
    const preset = BYND_NOTIFY_INTERVAL_PRESETS.find(item => Math.abs(item - hours) < 0.001);
    return preset == null ? 'custom' : String(preset);
}

function updateProactiveNotifyCustomIntervalVisibility() {
    const row = document.getElementById('notify-time-row');
    const presetInput = document.getElementById('notify-interval-preset');
    const customWrap = document.getElementById('notify-custom-wrap');
    const intervalInput = document.getElementById('notify-interval');
    const isCustom = presetInput?.value === 'custom';
    if (row) row.classList.toggle('custom-active', !!isCustom);
    if (customWrap) customWrap.hidden = !isCustom;
    if (!isCustom && intervalInput && presetInput) intervalInput.value = presetInput.value || '24';
    syncProactiveNotifyPresetUi();
}

function readProactiveNotifyIntervalFromUI(fallback = 24) {
    const presetInput = document.getElementById('notify-interval-preset');
    const intervalInput = document.getElementById('notify-interval');
    if (presetInput && presetInput.value && presetInput.value !== 'custom') {
        return parseProactiveNotifyIntervalHours(presetInput.value, fallback);
    }
    return parseProactiveNotifyIntervalHours(intervalInput?.value, fallback);
}

function getProactiveNotifyPresetLabel(value) {
    const presetInput = document.getElementById('notify-interval-preset');
    const option = presetInput ? Array.from(presetInput.options).find(item => item.value === String(value)) : null;
    return option ? option.textContent.trim() : formatProactiveNotifyInterval(value);
}

function syncProactiveNotifyPresetUi() {
    const presetInput = document.getElementById('notify-interval-preset');
    const label = document.getElementById('notify-interval-preset-label');
    const menu = document.getElementById('notify-interval-preset-menu');
    if (!presetInput) return;
    if (label) label.textContent = getProactiveNotifyPresetLabel(presetInput.value);
    menu?.querySelectorAll('button[data-value]').forEach(button => {
        const active = button.dataset.value === presetInput.value;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
}

function closeProactiveNotifyPresetMenu() {
    const ui = document.getElementById('notify-interval-preset-ui');
    const menu = document.getElementById('notify-interval-preset-menu');
    const trigger = document.getElementById('notify-interval-preset-button');
    ui?.classList.remove('open');
    if (menu) menu.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
}

function toggleProactiveNotifyPresetMenu() {
    const ui = document.getElementById('notify-interval-preset-ui');
    const menu = document.getElementById('notify-interval-preset-menu');
    const trigger = document.getElementById('notify-interval-preset-button');
    if (!ui || !menu) return;
    const opening = menu.hidden;
    document.querySelectorAll('.notify-preset-select.open').forEach(item => {
        if (item !== ui) item.classList.remove('open');
    });
    ui.classList.toggle('open', opening);
    menu.hidden = !opening;
    trigger?.setAttribute('aria-expanded', opening ? 'true' : 'false');
}

function selectProactiveNotifyIntervalPreset(value) {
    const presetInput = document.getElementById('notify-interval-preset');
    if (!presetInput) return;
    presetInput.value = String(value || '24');
    closeProactiveNotifyPresetMenu();
    updateProactiveNotifyCustomIntervalVisibility();
    saveProactiveNotifySettingsFromUI({ silent: true });
    updateProactiveNotifyStatus();
}

function renderProactiveNotifySettings() {
    const enabled = document.getElementById('notify-enabled');
    if (!enabled) return;
    const settings = getProactiveNotifySettings();
    const charSelect = document.getElementById('notify-char');
    const intervalInput = document.getElementById('notify-interval');
    const presetInput = document.getElementById('notify-interval-preset');
    const endpointInput = document.getElementById('notify-worker-endpoint');
    const vapidInput = document.getElementById('notify-vapid-key');
    enabled.checked = settings.enabled;
    if (intervalInput) intervalInput.value = String(settings.intervalHours);
    if (presetInput) presetInput.value = getProactiveNotifyIntervalPresetValue(settings.intervalHours);
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
    updateProactiveNotifyCustomIntervalVisibility();
    syncProactiveNotifyPresetUi();
    bindProactiveNotifyControls();
    updateProactiveNotifyStatus();
}
window.renderProactiveNotifySettings = renderProactiveNotifySettings;

function buildProactiveNotifySyncPayload(settings = resolveProactiveNotifySettings(), state = getProactiveNotifyState()) {
    const resolvedSettings = resolveProactiveNotifySettings(settings);
    return {
        clientId: getProactiveNotifyClientId(),
        settings: resolvedSettings,
        state,
        origin: location.origin,
        url: location.origin + location.pathname + '?open=wechat',
        chars: getProactiveNotifyChars(resolvedSettings).map(char => ({
            id: char.id,
            name: getProactiveCharName(char),
            avatar: char.avatar || ''
        }))
    };
}

function syncProactiveServiceWorkerConfig() {
    if (!('serviceWorker' in navigator)) return;
    const settings = resolveProactiveNotifySettings();
    if (!settings.enabled && !navigator.serviceWorker.controller) return;
    const message = { type: 'BYND_NOTIFY_CONFIG', payload: buildProactiveNotifySyncPayload(settings) };
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(message);
    }
    ensureByndServiceWorker()?.then(reg => {
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
    const settings = resolveProactiveNotifySettings();
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    const pushReady = settings.workerEndpoint && settings.vapidPublicKey ? '后台推送已接入' : '网页运行时可提醒';
    const intervalLabel = formatProactiveNotifyInterval(settings.intervalHours);
    el.textContent = settings.enabled
        ? `已开启，${intervalLabel} 没回来会提醒。浏览器权限：${permission}，${pushReady}。`
        : `未开启。当前时间：${intervalLabel}。点开关后会请求通知权限。`;
}

function explainByndPushLimit() {
    alert('网页本地提醒只能在页面或浏览器后台仍可运行时触发。退出网页、清理后台甚至关机后还要准时收到，必须接 Web Push 云端后端；iOS 也必须先添加到主屏幕并授权通知。');
}
window.explainByndPushLimit = explainByndPushLimit;

function openProactiveNotifyGuide() {
    let modal = document.getElementById('bynd-notify-guide-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'bynd-notify-guide-modal';
        modal.className = 'bynd-guide-modal hidden';
        modal.setAttribute('onclick', 'if(event.target===this) closeProactiveNotifyGuide()');
        modal.innerHTML = `
            <div class="bynd-guide-card">
                <div class="bynd-guide-head">
                    <div>
                        <strong>主动消息新手教程</strong>
                        <span>先本地跑通，再接云端推送。</span>
                    </div>
                    <button type="button" onclick="closeProactiveNotifyGuide()" aria-label="关闭"><i class="ri-close-line"></i></button>
                </div>
                <div class="bynd-guide-steps">
                    <section>
                        <b>1. 选择谁来找你</b>
                        <p>选择当前聊天角色、所有角色，或者指定某一个角色，再设置“多久没联系”。这个时间从用户最后一次主动发消息开始计算。</p>
                    </section>
                    <section>
                        <b>2. 先测试本机提醒</b>
                        <p>打开开关，点“授权通知”，再点“测试通知”。网页开着或浏览器仍允许后台运行时，这一步就能验证提醒样式。</p>
                    </section>
                    <section>
                        <b>3. 真手机后台推送</b>
                        <p>退出网页、清理后台甚至关机后还要准时收到，需要 Cloudflare Worker 保存订阅并按时发送 Web Push。这里要填 Worker 推送接口和 VAPID Public Key。</p>
                    </section>
                    <section>
                        <b>4. 保存并同步</b>
                        <p>填完后点“保存设置”。状态显示“云端推送订阅已同步”才说明手机端订阅发给后端了。</p>
                    </section>
                </div>
                <div class="bynd-guide-note">提示：iPhone 需要先把站点添加到主屏幕再授权通知；安卓不同浏览器对后台策略不同，云端 Web Push 是最稳的方向。</div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
}
window.openProactiveNotifyGuide = openProactiveNotifyGuide;

function closeProactiveNotifyGuide() {
    document.getElementById('bynd-notify-guide-modal')?.classList.add('hidden');
}
window.closeProactiveNotifyGuide = closeProactiveNotifyGuide;

function saveProactiveNotifySettingsFromUI(options = {}) {
    const current = getProactiveNotifySettings();
    const endpointInput = document.getElementById('notify-worker-endpoint');
    const vapidInput = document.getElementById('notify-vapid-key');
    const charSelect = document.getElementById('notify-char');
    const intervalHours = readProactiveNotifyIntervalFromUI(current.intervalHours);
    const intervalChanged = Math.abs(intervalHours - current.intervalHours) > 0.001;
    const next = {
        ...current,
        enabled: !!document.getElementById('notify-enabled')?.checked,
        charId: charSelect?.value || current.charId || 'current',
        intervalHours,
        workerEndpoint: endpointInput ? String(endpointInput.value || '').trim() : current.workerEndpoint,
        vapidPublicKey: vapidInput ? String(vapidInput.value || '').trim() : current.vapidPublicKey
    };
    if (intervalChanged) {
        next.intervalUpdatedBy = 'user';
        next.intervalUpdatedByCharId = '';
        next.intervalUpdatedByCharName = '';
        next.intervalUpdatedReason = '';
        next.intervalUpdatedAt = Date.now();
    }
    saveProactiveNotifySettings(next);
    if (!options.silent) updateProactiveNotifyStatus('已保存主动消息提醒设置。');
    if (!options.skipSync) syncProactivePushSubscription().catch(err => updateProactiveNotifyStatus('设置已保存，但云端订阅失败：' + err.message));
    checkProactiveNotifications(false);
    return next;
}
window.saveProactiveNotifySettingsFromUI = saveProactiveNotifySettingsFromUI;

function bindProactiveNotifyControls() {
    const enabled = document.getElementById('notify-enabled');
    if (enabled && enabled.dataset.notifyBound !== '1') {
        enabled.dataset.notifyBound = '1';
        enabled.addEventListener('change', toggleProactiveNotifyFromUI);
    }
    ['notify-char', 'notify-interval'].forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.notifyBound === '1') return;
        el.dataset.notifyBound = '1';
        el.addEventListener('change', () => {
            saveProactiveNotifySettingsFromUI({ silent: true });
            updateProactiveNotifyStatus();
        });
    });
    const presetInput = document.getElementById('notify-interval-preset');
    if (presetInput && presetInput.dataset.notifyBound !== '1') {
        presetInput.dataset.notifyBound = '1';
        presetInput.addEventListener('change', () => {
            updateProactiveNotifyCustomIntervalVisibility();
            saveProactiveNotifySettingsFromUI({ silent: true });
            updateProactiveNotifyStatus();
        });
    }
    const presetButton = document.getElementById('notify-interval-preset-button');
    if (presetButton && presetButton.dataset.notifyBound !== '1') {
        presetButton.dataset.notifyBound = '1';
        presetButton.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            toggleProactiveNotifyPresetMenu();
        });
        presetButton.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeProactiveNotifyPresetMenu();
        });
    }
    document.querySelectorAll('#notify-interval-preset-menu button[data-value]').forEach(button => {
        if (button.dataset.notifyBound === '1') return;
        button.dataset.notifyBound = '1';
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            selectProactiveNotifyIntervalPreset(button.dataset.value);
        });
    });
    if (!document.documentElement.dataset.notifyPresetCloseBound) {
        document.documentElement.dataset.notifyPresetCloseBound = '1';
        document.addEventListener('pointerdown', event => {
            const ui = document.getElementById('notify-interval-preset-ui');
            if (!ui || ui.contains(event.target)) return;
            closeProactiveNotifyPresetMenu();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeProactiveNotifyPresetMenu();
        });
    }
}

async function toggleProactiveNotifyFromUI() {
    const next = saveProactiveNotifySettingsFromUI({ silent: true, skipSync: true });
    if (!next.enabled) {
        updateProactiveNotifyStatus('后台消息已关闭。');
        return;
    }
    updateProactiveNotifyStatus('正在开启后台消息...');
    try {
        await requestByndNotificationPermission();
        await syncProactivePushSubscription();
        updateProactiveNotifyStatus();
    } catch (err) {
        updateProactiveNotifyStatus('后台消息已开启，但推送同步失败：' + (err.message || err));
    }
}

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
    const settings = resolveProactiveNotifySettings();
    if (!settings.enabled || !settings.workerEndpoint || !settings.vapidPublicKey) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('当前浏览器不支持 Push API');
    if (!('Notification' in window)) throw new Error('当前浏览器不支持网页通知');
    if (Notification.permission !== 'granted') return;
    const reg = await ensureByndServiceWorker();
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
    const icon = 'bynd-icon.svg';
    if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
            body,
            tag,
            renotify: false,
            icon,
            badge: icon,
            data: { charId: char.id, url: location.origin + location.pathname + '?open=wechat&char=' + encodeURIComponent(char.id) }
        });
    } else {
        new Notification(title, { body, tag, icon });
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
    cleanupByndServiceWorkerIfIdle();
    syncProactiveServiceWorkerConfig();
    setInterval(() => checkProactiveNotifications(false), 60 * 1000);
    setTimeout(() => checkProactiveNotifications(false), 2500);
}

// --- 音乐 App ---
const MUSIC_COMMENTS_KEY = 'bynd_music_comments_v1';
const MUSIC_FAVORITES_KEY = 'bynd_music_favorites_v1';
const MUSIC_CO_LISTEN_KEY = 'bynd_music_co_listen_v1';
const MUSIC_CO_LISTEN_CHAR_KEY = 'bynd_music_co_listen_char_v1';
const MUSIC_SOURCE_MODE_KEY = 'bynd_music_source_mode_v1';
const MUSIC_SOURCE_SETTINGS_KEY = 'bynd_music_source_settings_v1';
const MUSIC_PLAYLISTS_KEY = 'bynd_music_playlists_v1';
const MUSIC_LIBRARY_STATE_KEY = 'bynd_music_library_state_v1';
const MUSIC_SOURCE_DEFAULTS = {
    metingBases: [
        'https://meting.mikus.ink/api',
        'https://meting.elysium-stack.cn/api'
    ],
    goApiBase: ''
};
const MUSIC_PLATFORM_LABELS = {
    smart: '多源',
    netease: '网易云',
    archive: '公开曲库',
    local: '本地'
};
const MUSIC_PLATFORM_ORDER = ['netease'];
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
const MUSIC_PLACEHOLDER_TRACK = {
    id: 'placeholder:bynd-music',
    trackName: '暂无播放',
    artistName: '搜索或导入音乐',
    collectionName: 'BYND Music',
    artworkUrl100: '',
    audioUrl: '',
    trackViewUrl: '',
    primaryGenreName: 'Music',
    sourceName: '音乐'
};

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
let musicShuffleEnabled = false;
let musicRepeatMode = 'all';
let musicCoListening = false;
let musicCoListenBusy = false;
let musicAiMessages = [];
let musicActiveLyricIndex = -1;
let musicCoListenLastTrackKey = '';
let musicCoListenCharId = localStorage.getItem(MUSIC_CO_LISTEN_CHAR_KEY) || '';

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

function getMusicPlaceholderTrack() {
    return normalizeMusicTrack(MUSIC_PLACEHOLDER_TRACK);
}

function isMusicFallbackTrack(track) {
    const id = String(track?.id || '');
    if (id === MUSIC_PLACEHOLDER_TRACK.id) return true;
    return MUSIC_FALLBACK_TRACKS.some(item => String(item.id || '') === id);
}

function getUserMusicTracks() {
    return (Array.isArray(musicTracks) ? musicTracks : []).filter(track => track && !isMusicFallbackTrack(track));
}

function getUserMusicTrackEntries() {
    return (Array.isArray(musicTracks) ? musicTracks : [])
        .map((track, index) => ({ track, index }))
        .filter(item => item.track && !isMusicFallbackTrack(item.track));
}

function getPersistableMusicTracks() {
    return (Array.isArray(musicTracks) ? musicTracks : [])
        .filter(track => track && !isMusicFallbackTrack(track))
        .map(track => normalizeMusicTrack(track))
        .slice(0, 500);
}

function saveMusicLibraryState(source = 'music') {
    try {
        const tracks = getPersistableMusicTracks();
        if (!tracks.length) return;
        const currentKey = getMusicTrackKey(musicTracks[musicCurrentIndex]);
        const currentIndex = Math.max(0, tracks.findIndex(track => getMusicTrackKey(track) === currentKey));
        localStorage.setItem(MUSIC_LIBRARY_STATE_KEY, JSON.stringify({
            tracks,
            currentIndex,
            mainTab: musicMainTab,
            albumFilter: musicAlbumFilter,
            source,
            updatedAt: Date.now()
        }));
    } catch (e) {}
}
window.saveMusicLibraryState = saveMusicLibraryState;

function restoreMusicLibraryState() {
    try {
        const state = JSON.parse(localStorage.getItem(MUSIC_LIBRARY_STATE_KEY) || 'null');
        const tracks = Array.isArray(state?.tracks)
            ? state.tracks.map(normalizeMusicTrack).filter(track => track && !isMusicFallbackTrack(track))
            : [];
        if (!tracks.length) return false;
        musicTracks = tracks;
        const index = Number(state.currentIndex);
        musicCurrentIndex = Number.isFinite(index) ? Math.min(Math.max(0, index), musicTracks.length - 1) : 0;
        if (['home', 'search', 'albums', 'favorites'].includes(state.mainTab)) musicMainTab = state.mainTab;
        musicAlbumFilter = state.albumFilter ? String(state.albumFilter) : '';
        return true;
    } catch (e) {
        return false;
    }
}

function loadMusicSourceSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(MUSIC_SOURCE_SETTINGS_KEY) || '{}') || {};
        const metingBases = Array.isArray(saved.metingBases) ? saved.metingBases : String(saved.metingBases || '').split(/\n|,/);
        return {
            metingBases: metingBases.map(url => cleanMusicBaseUrl(url)).filter(Boolean),
            goApiBase: cleanMusicBaseUrl(saved.goApiBase || '')
        };
    } catch (e) {
        return { ...MUSIC_SOURCE_DEFAULTS };
    }
}

function getMusicSourceSettings() {
    const settings = loadMusicSourceSettings();
    if (!settings.metingBases.length) settings.metingBases = [...MUSIC_SOURCE_DEFAULTS.metingBases];
    return settings;
}

function cleanMusicBaseUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

function getMusicSourceMode() {
    const mode = localStorage.getItem(MUSIC_SOURCE_MODE_KEY) || 'smart';
    return MUSIC_PLATFORM_LABELS[mode] ? mode : 'smart';
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
    if (metingInput) metingInput.value = settings.metingBases.join('\n');
    if (goInput) goInput.value = settings.goApiBase || '';
    renderMusicImportedPlaylists();
}

function saveMusicSourceSettingsFromUI() {
    const metingBases = String(document.getElementById('music-meting-bases')?.value || '')
        .split(/\n|,/)
        .map(url => cleanMusicBaseUrl(url))
        .filter(Boolean);
    const settings = {
        metingBases,
        goApiBase: cleanMusicBaseUrl(document.getElementById('music-go-api-base')?.value || '')
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
        el.innerHTML = '<div class="music-import-empty">还没有导入歌单，粘贴网易云歌单链接或纯数字 ID 试试。</div>';
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
    const platform = fallbackPlatform || 'netease';
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
        saveMusicLibraryState('playlist-import');
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
    saveMusicLibraryState('playlist-open');
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
    if (!restoreMusicLibraryState()) {
        musicTracks = [];
        musicCurrentIndex = 0;
    }
    syncMusicSourceUI();
    const input = document.getElementById('music-search-input');
    if (input) input.value = '';
    renderMusicApp();
}

function renderMusicApp() {
    renderMusicNowPlaying();
    renderMusicMainTab();
    renderMusicDetail();
    updateMusicProgress();
}

function renderMusicNowPlaying() {
    const track = musicTracks[musicCurrentIndex] || getMusicPlaceholderTrack();
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
        source.classList.remove('hidden');
        source.removeAttribute('href');
        source.removeAttribute('target');
        source.onclick = event => event.preventDefault();
    }
    updateMusicFavoriteButton();
    syncMusicPlaybackModeButtons();
    updateMusicProgress();
}

function syncMusicPlaybackModeButtons() {
    const shuffleBtn = document.getElementById('music-shuffle-btn');
    const repeatBtn = document.getElementById('music-repeat-btn');
    if (shuffleBtn) {
        shuffleBtn.classList.toggle('active', musicShuffleEnabled);
        shuffleBtn.setAttribute('aria-pressed', musicShuffleEnabled ? 'true' : 'false');
    }
    if (repeatBtn) {
        const icon = repeatBtn.querySelector('i');
        const isActive = musicRepeatMode !== 'off';
        repeatBtn.dataset.mode = musicRepeatMode;
        repeatBtn.classList.toggle('active', isActive);
        repeatBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        repeatBtn.setAttribute('aria-label', musicRepeatMode === 'one'
            ? '单曲循环'
            : (musicRepeatMode === 'off' ? '顺序播放' : '列表循环'));
        if (icon) icon.className = musicRepeatMode === 'one' ? 'ri-repeat-one-line' : 'ri-repeat-line';
    }
}

function toggleMusicShuffle() {
    musicShuffleEnabled = !musicShuffleEnabled;
    syncMusicPlaybackModeButtons();
}
window.toggleMusicShuffle = toggleMusicShuffle;

function toggleMusicRepeatMode() {
    musicRepeatMode = musicRepeatMode === 'all' ? 'one' : (musicRepeatMode === 'one' ? 'off' : 'all');
    syncMusicPlaybackModeButtons();
}
window.toggleMusicRepeatMode = toggleMusicRepeatMode;

function switchMusicMainTab(tab) {
    musicMainTab = ['home', 'search', 'albums', 'favorites'].includes(tab) ? tab : 'home';
    closeMusicOverlayForMainTab();
    if (musicMainTab !== 'albums') musicAlbumFilter = '';
    syncMusicMainTabs();
    renderMusicMainTab();
    if (musicMainTab === 'search') {
        setTimeout(() => document.getElementById('music-search-input')?.focus(), 60);
    }
}
window.switchMusicMainTab = switchMusicMainTab;

function closeMusicOverlayForMainTab() {
    const neteaseView = document.getElementById('music-netease-view');
    if (neteaseView && !neteaseView.classList.contains('hidden')) {
        if (typeof window.closeNeteaseView === 'function') window.closeNeteaseView();
        else neteaseView.classList.add('hidden');
    }
}

function ensureMusicConceptNav() {
    const bar = document.querySelector('#app-music-window .music-bottom-nav');
    if (!bar || bar.dataset.conceptNav === '1') return;
    bar.dataset.conceptNav = '1';
    bar.innerHTML = `
        <button type="button" data-music-tab="home" onclick="switchMusicMainTab('home')"><i class="ri-home-5-fill"></i><span>首页</span></button>
        <button type="button" data-music-tab="search" onclick="switchMusicMainTab('search')"><i class="ri-search-line"></i><span>搜索</span></button>
        <button type="button" data-music-tab="albums" onclick="switchMusicMainTab('albums')"><i class="ri-album-line"></i><span>曲库</span></button>
        <button type="button" data-music-tab="favorites" onclick="switchMusicMainTab('favorites')"><i class="ri-fire-line"></i><span>热榜</span></button>
    `;
}

function syncMusicMainTabs() {
    ensureMusicConceptNav();
    const win = document.getElementById('app-music-window');
    if (win) win.dataset.musicTab = musicMainTab;
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
            : (musicMainTab === 'favorites' ? 'Hotlist' : (musicMainTab === 'search' ? 'Search' : 'Now Playing'));
    }
    if (musicMainTab === 'albums') {
        renderMusicAlbums();
    } else if (musicMainTab === 'favorites') {
        renderMusicFavorites();
    } else {
        renderMusicList();
    }
}

function renderMusicHomePlaylists() {
    const list = getMusicPlaylistsStore();
    if (!list.length) return '';
    return `
        <div class="music-home-playlists">
            <div class="music-home-playlists-title">我的歌单<em>${list.length}</em></div>
            ${list.map(item => `
                <button type="button" class="music-home-playlist-row" onclick="loadImportedMusicPlaylist('${musicEscapeAttr(item.id)}')">
                    <i class="ri-play-list-2-line"></i>
                    <span>${musicEscapeHtml(item.name || item.platformLabel || '导入歌单')}</span>
                    <em>${Array.isArray(item.tracks) ? item.tracks.length : 0} 首</em>
                </button>
            `).join('')}
        </div>
    `;
}

function renderMusicList() {
    const list = document.getElementById('music-track-list');
    if (!list) return;
    const entries = getUserMusicTrackEntries();
    if (!entries.length) {
        list.innerHTML = `${renderMusicHomePlaylists()}<div class="music-empty-state"><strong>没有搜索结果</strong><span>换个歌名、歌手或切换音乐源试试。</span></div>`;
        return;
    }
    list.innerHTML = renderMusicHomePlaylists() + entries.map(({ track, index }) => {
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
    const libraryEntries = getUserMusicTrackEntries();
    if (musicAlbumFilter) {
        const rows = libraryEntries
            .filter(item => (item.track.collectionName || '未命名专辑') === musicAlbumFilter);
        list.innerHTML = `
            <button type="button" class="music-album-back" onclick="closeMusicAlbum()">
                <i class="ri-arrow-left-s-line"></i><span>返回专辑列表</span>
            </button>
            ${rows.map(({ track, index }) => renderMusicTrackRow(track, index, false)).join('') || '<div class="music-empty-state"><strong>这张专辑还没有歌曲</strong></div>'}
        `;
        return;
    }

    const groups = new Map();
    libraryEntries.forEach(({ track, index }) => {
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
        const action = items.length === 1
            ? `openMusicDetail(${items[0].index})`
            : `openMusicAlbum(this.dataset.album)`;
        return `
            <button type="button" class="music-album-item" data-album="${musicEscapeAttr(name)}" onclick="${action}">
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

function renderMusicTrackRow(track, index, playDirect = false) {
    const artwork = getMusicArtwork(track);
    const liked = isMusicFavorite(track);
    const action = playDirect ? `playMusicTrackFromAlbum(${index})` : `openMusicDetail(${index})`;
    return `
        <button type="button" class="music-track-item ${index === musicCurrentIndex ? 'active' : ''}" onclick="${action}">
            <div class="music-track-art">
                ${artwork ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(track.trackName)}" onerror="this.remove()">` : '<i class="ri-music-2-line"></i>'}
            </div>
            <div class="music-track-meta">
                <strong>${musicEscapeHtml(track.trackName)}</strong>
                <span>${musicEscapeHtml(track.artistName)} · ${musicEscapeHtml(track.sourceName || 'Full audio')}</span>
            </div>
            <i class="${liked ? 'ri-heart-3-fill' : (playDirect ? 'ri-play-circle-line' : 'ri-arrow-right-s-line')}"></i>
        </button>
    `;
}

function playMusicTrackFromAlbum(index) {
    if (!musicTracks[index]) return;
    selectMusicTrack(index, true);
}
window.playMusicTrackFromAlbum = playMusicTrackFromAlbum;

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

function openCurrentMusicDetail() {
    if (!getUserMusicTracks().length) {
        showMusicStatus('还没有歌曲，先搜索或导入音乐。');
        return;
    }
    openMusicDetail(musicCurrentIndex);
}
window.openCurrentMusicDetail = openCurrentMusicDetail;

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

function getCurrentMusicTrack() {
    const track = musicTracks[musicCurrentIndex];
    return track ? { ...track } : null;
}
window.getCurrentMusicTrack = getCurrentMusicTrack;

function getMusicLibraryTracks() {
    return getUserMusicTracks().map(track => ({ ...track }));
}
window.getMusicLibraryTracks = getMusicLibraryTracks;

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
    saveMusicLibraryState('select');
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
        if (typeof window.renderNeteasePlayerProgress === 'function') window.renderNeteasePlayerProgress();
    });
    musicAudio.addEventListener('pause', () => {
        musicIsPlaying = false;
        renderMusicNowPlaying();
        renderMusicMainTab();
        if (typeof window.renderNeteasePlayerProgress === 'function') window.renderNeteasePlayerProgress();
    });
    musicAudio.addEventListener('loadedmetadata', updateMusicProgress);
    musicAudio.addEventListener('ended', handleMusicEnded);
    musicAudio.addEventListener('timeupdate', updateMusicProgress);
}

function toggleMusicPlayback(forcePlay) {
    const track = musicTracks[musicCurrentIndex];
    if (!track) return;
    if (!track.audioUrl) {
        if (track.sourceKey === 'netease' && track.remoteId && typeof window.resolveAndPlayNeteaseMusic === 'function') {
            window.resolveAndPlayNeteaseMusic(track, true);
            return;
        }
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


function startMusicCoListenFromWechat(trackData, charId, options = {}) {
    const track = normalizeMusicTrack({
        ...trackData,
        trackName: trackData?.trackName || trackData?.title || '\u4e00\u8d77\u542c\u6b4c',
        artistName: trackData?.artistName || trackData?.artist || 'Unknown Artist',
        artworkUrl100: trackData?.artworkUrl100 || trackData?.artwork || '',
        audioUrl: trackData?.audioUrl || trackData?.playableUrl || trackData?.url || '',
        sourceName: trackData?.sourceName || '\u5fae\u4fe1\u97f3\u4e50'
    });
    if (!track.audioUrl) return false;
    const char = (window.myCharacters || []).find(item => item && item.id === charId);
    if (char) {
        musicCoListenCharId = char.id;
        localStorage.setItem(MUSIC_CO_LISTEN_CHAR_KEY, char.id);
    }
    const existingIndex = musicTracks.findIndex(item => getMusicTrackKey(item) === getMusicTrackKey(track));
    if (existingIndex >= 0) musicCurrentIndex = existingIndex;
    else {
        musicTracks.unshift(track);
        musicCurrentIndex = 0;
    }
    saveMusicLibraryState('wechat-co-listen');
    musicCoListening = true;
    musicCoListenLastTrackKey = '';
    setupMusicAudio();
    if (musicAudio.src !== track.audioUrl) {
        musicAudio.src = track.audioUrl;
        musicAudio.load();
    }
    renderMusicApp();
    if (options.autoplay) toggleMusicPlayback(true);
    if (options.queueAi) queueMusicAiReaction(options.reason || 'wechat-invite');
    if (typeof showMusicStatus === 'function') showMusicStatus('\u5df2\u63a5\u5165\u5fae\u4fe1\u4e00\u8d77\u542c\u6b4c\u3002');
    return true;
}
window.startMusicCoListenFromWechat = startMusicCoListenFromWechat;

function getNextMusicIndex() {
    if (!musicTracks.length) return 0;
    if (musicShuffleEnabled && musicTracks.length > 1) {
        let nextIndex = musicCurrentIndex;
        while (nextIndex === musicCurrentIndex) {
            nextIndex = Math.floor(Math.random() * musicTracks.length);
        }
        return nextIndex;
    }
    return (musicCurrentIndex + 1) % musicTracks.length;
}

function handleMusicEnded() {
    if (!musicTracks.length) return;
    if (musicRepeatMode === 'one' && musicAudio) {
        musicAudio.currentTime = 0;
        musicAudio.play().catch(() => {
            musicIsPlaying = false;
            renderMusicNowPlaying();
        });
        return;
    }
    if (musicRepeatMode === 'off' && !musicShuffleEnabled && musicCurrentIndex >= musicTracks.length - 1) {
        musicIsPlaying = false;
        renderMusicNowPlaying();
        renderMusicMainTab();
        return;
    }
    playNextMusicTrack();
}

function playNextMusicTrack() {
    if (!musicTracks.length) return;
    musicCurrentIndex = getNextMusicIndex();
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
    const wave = document.querySelector('#app-music-window .music-wave');
    const current = musicAudio && Number.isFinite(musicAudio.currentTime) ? musicAudio.currentTime : 0;
    const trackDuration = musicTracks[musicCurrentIndex]?.duration;
    const total = musicAudio && Number.isFinite(musicAudio.duration) ? musicAudio.duration : (trackDuration || 0);
    const percent = total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 0;
    if (bar) bar.style.width = `${percent}%`;
    if (wave) {
        const bars = wave.querySelectorAll('span');
        const activeCount = Math.max(1, Math.round((percent / 100) * bars.length));
        wave.classList.toggle('is-playing', !!musicIsPlaying);
        wave.style.setProperty('--music-wave-progress', `${percent}%`);
        bars.forEach((item, index) => {
            item.style.setProperty('--wave-i', index);
            item.classList.toggle('active', index < activeCount);
        });
    }
    if (elapsed) elapsed.textContent = formatMusicTime(current);
    if (duration) duration.textContent = total > 0 ? formatMusicTime(total) : '--:--';
    updateActiveMusicLyric(current);
    if (typeof window.renderNeteasePlayerProgress === 'function') window.renderNeteasePlayerProgress();
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
        saveMusicLibraryState('search');
        if (musicAudio) musicAudio.pause();
        musicIsPlaying = false;
        closeMusicDetail();
        renderMusicApp();
        showMusicStatus(buildMusicSourceSummary(tracks));
    } catch (e) {
        musicTracks = [];
        musicCurrentIndex = 0;
        if (musicAudio) musicAudio.pause();
        musicIsPlaying = false;
        closeMusicDetail();
        renderMusicApp();
        showMusicStatus('在线音乐源暂时不可用，换个关键词或稍后再试。');
    }
}
window.searchMusic = searchMusic;

window.searchAcrossMusicSources = searchAcrossMusicSources;
window.normalizeMusicTrack = normalizeMusicTrack;
window.getMusicSourceMode = getMusicSourceMode;

async function searchAcrossMusicSources(query, mode) {
    const settings = getMusicSourceSettings();
    const tasks = [];
    const platforms = mode === 'smart' ? MUSIC_PLATFORM_ORDER : [mode];

    platforms.filter(platform => platform !== 'archive').forEach(platform => {
        tasks.push(searchMetingMusic(query, platform, settings));
        if (settings.goApiBase) tasks.push(searchGoMusicApi(query, platform, settings));
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

function goBackMusicView() {
    closeMusicDetail();
    renderMusicMainTab();
}
window.goBackMusicView = goBackMusicView;

function handleMusicHeaderBack() {
    const detail = document.getElementById('music-detail-view');
    if (detail && !detail.classList.contains('hidden')) {
        goBackMusicView();
        return;
    }
    const neteaseView = document.getElementById('music-netease-view');
    if (neteaseView && !neteaseView.classList.contains('hidden')) {
        if (typeof window.closeNeteaseView === 'function') window.closeNeteaseView();
        else neteaseView.classList.add('hidden');
        return;
    }
    if (musicMainTab === 'albums' && musicAlbumFilter) {
        closeMusicAlbum();
        return;
    }
    closeApp('music');
}
window.handleMusicHeaderBack = handleMusicHeaderBack;

function renderMusicDetail() {
    const detail = document.getElementById('music-detail-view');
    if (!detail || detail.classList.contains('hidden')) return;
    const track = musicTracks[musicCurrentIndex] || getMusicPlaceholderTrack();
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
    const nowBtn = document.getElementById('music-now-favorite-btn');
    const track = musicTracks[musicCurrentIndex];
    if (!track) return;
    const liked = isMusicFavorite(track);
    if (btn) {
        btn.classList.toggle('active', liked);
        btn.innerHTML = `<i class="${liked ? 'ri-heart-3-fill' : 'ri-heart-3-line'}"></i><span>${liked ? '已收藏' : '收藏'}</span>`;
    }
    if (nowBtn) {
        nowBtn.classList.toggle('active', liked);
        nowBtn.setAttribute('aria-label', liked ? '取消收藏' : '收藏');
        nowBtn.innerHTML = `<i class="${liked ? 'ri-heart-fill' : 'ri-heart-line'}"></i>`;
    }
}

function getMusicCurrentChar() {
    const chars = window.myCharacters || [];
    if (musicCoListenCharId) {
        const selected = chars.find(c => c.id === musicCoListenCharId);
        if (selected) return selected;
    }
    if (typeof getCurrentChatChar === 'function') {
        const current = getCurrentChatChar();
        if (current) return current;
    }
    if (window.currentChatCharId) {
        const current = chars.find(c => c.id === window.currentChatCharId);
        if (current) return current;
    }
    return chars[0] || null;
}

function getMusicCharName(char) {
    return (char?.chatConfig && char.chatConfig.nickname) || char?.name || 'AI';
}

function selectMusicCoListenChar(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    musicCoListenCharId = char.id;
    localStorage.setItem(MUSIC_CO_LISTEN_CHAR_KEY, char.id);
    musicCoListenLastTrackKey = '';
    renderMusicAiPanel();
    if (musicCoListening) queueMusicAiReaction('switch-char');
}
window.selectMusicCoListenChar = selectMusicCoListenChar;

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
    const cleanText = cleanMusicAiCommentText(text);
    const item = {
        name: getMusicCharName(char),
        text: cleanText,
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
    const chars = (window.myCharacters || []).filter(item => item && item.id && !item.isGroupChat);
    const chooserHtml = chars.length ? `
        <div class="music-ai-char-list">
            ${chars.map(item => `
                <button type="button" class="${item.id === char?.id ? 'active' : ''}" onclick="selectMusicCoListenChar('${musicEscapeAttr(item.id)}')">
                    ${item.avatar ? `<img src="${musicEscapeAttr(item.avatar)}" alt="${musicEscapeAttr(getMusicCharName(item))}">` : '<i class="ri-user-smile-line"></i>'}
                    <span>${musicEscapeHtml(getMusicCharName(item))}</span>
                </button>
            `).join('')}
        </div>
    ` : '';
    const visibleMessages = thread.items
        .map(item => ({ ...item, text: cleanMusicAiCommentText(item.text) }))
        .filter(item => item.text);
    const messagesHtml = visibleMessages.length
        ? visibleMessages.map(item => `
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
            ${musicCoListenBusy ? '<em class="music-ai-thinking"><i class="ri-loader-4-line"></i><span>思考中...</span></em>' : '<button type="button" onclick="queueMusicAiReaction(\'manual\')"><span>问一句</span></button>'}
        </div>
        ${chooserHtml}
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
        content: '你正在 BYND Music 里和用户一起听歌。请按角色卡和最近聊天，用自然口吻给出一句短评论；只允许输出角色自己说的话。不要写旁白、动作描写、舞台说明、心理描写、括号说明、分隔符或思考过程。如果你想点歌或不喜欢当前歌，可以在回复末尾单独加一行 JSON：{"action":"request","query":"歌名 歌手","comment":"理由"} 或 {"action":"skip","comment":"理由"}。'
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
    const text = cleanMusicAiCommentText(parsed.comment || parsed.text || result.content);
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
    if (!match) return { action: 'comment', text: cleanMusicAiCommentText(raw) };
    try {
        const json = JSON.parse(match[0]);
        const text = cleanMusicAiCommentText(raw.slice(0, match.index).trim());
        const action = ['request', 'skip', 'comment'].includes(json.action) ? json.action : 'comment';
        return {
            action,
            query: String(json.query || '').trim(),
            comment: cleanMusicAiCommentText(json.comment || text || ''),
            text
        };
    } catch (e) {
        return { action: 'comment', text: cleanMusicAiCommentText(raw) };
    }
}

function cleanMusicAiCommentText(value) {
    let text = String(value || '').trim();
    if (!text) return '';
    text = text.replace(/```[\s\S]*?```/g, '').trim();
    text = text.replace(/\|\|\|/g, '\n');
    text = text.replace(/^[\s\-–—*]*(旁白|系统|舞台|动作|心理|内心|narration|narrator|aside|stage|action)\s*[：:]\s*.*$/gim, '');
    text = text.replace(/[\[【(（]\s*(旁白|系统|舞台|动作|心理|内心|narration|narrator|aside|stage|action)\s*[：:][\s\S]*?[\]】)）]/gim, '');
    text = text.replace(/[\[【(（][^()[\]（）【】]*(低声|轻声|笑|叹气|看着|望向|屏幕|手机|镜头|回视线|摩挲|沉默|停顿|靠近|转头)[^()[\]（）【】]*[\]】)）]/g, '');
    text = text.split(/\n+/)
        .map(line => line.trim())
        .filter(line => line && !/^(旁白|系统|舞台|动作|心理|内心|narration|narrator|aside|stage|action)\s*[：:]/i.test(line))
        .join('\n')
        .trim();
    return text.replace(/\n{2,}/g, '\n').trim();
}

function addMusicCommentFromAi(char, text) {
    const track = musicTracks[musicCurrentIndex];
    const cleanText = cleanMusicAiCommentText(text);
    if (!track || !cleanText) return;
    const store = getMusicCommentsStore();
    if (!Array.isArray(store[track.id])) store[track.id] = [];
    store[track.id].unshift({
        name: getMusicCharName(char),
        text: cleanText,
        time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    saveMusicCommentsStore(store);
    renderMusicComments();
}

function switchMusicDetailTab(tab) {
    musicDetailTab = tab === 'comments' ? 'comments' : 'lyrics';
    document.getElementById('music-detail-view')?.classList.toggle('music-detail-comments-mode', musicDetailTab === 'comments');
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
    if (track.sourceKey === 'netease' && track.remoteId && typeof window.fetchNeteaseLyricLines === 'function') {
        try {
            const lyrics = await window.fetchNeteaseLyricLines(track.remoteId);
            if (lyrics) return lyrics;
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
    const comments = (store[track.id] || [])
        .map(comment => ({ ...comment, text: cleanMusicAiCommentText(comment.text) }))
        .filter(comment => comment.text);
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
const STUDY_CHECKINS_KEY = 'bynd_study_checkins_v1';
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

function getStudyCheckins() {
    try {
        const data = JSON.parse(localStorage.getItem(STUDY_CHECKINS_KEY) || '{}');
        return data && typeof data === 'object' ? data : {};
    } catch (e) {
        return {};
    }
}

function saveStudyCheckins(data) {
    localStorage.setItem(STUDY_CHECKINS_KEY, JSON.stringify(data && typeof data === 'object' ? data : {}));
}

function getStudyDateKey(date = new Date()) {
    const safe = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, '0')}-${String(safe.getDate()).padStart(2, '0')}`;
}

function getStudyDayLabel(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getStudyMoodOptions() {
    return [
        { id: 'clear', label: '开心', tone: '#ff9f43' },
        { id: 'calm', label: '平稳', tone: '#34c759' },
        { id: 'tired', label: '疲惫', tone: '#8e8e93' },
        { id: 'focus', label: '燃起', tone: '#5b7cfa' }
    ];
}

function buildStudyRecentDays(count = 21) {
    return Array.from({ length: count }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (count - 1 - index));
        return { date, key: getStudyDateKey(date) };
    });
}

function buildStudyCurvePath(days, checkins) {
    if (!days.length) return '';
    const width = 290;
    const height = 88;
    return days.map((day, index) => {
        const item = checkins[day.key] || {};
        const progress = Math.max(0, Math.min(100, Number(item.progress || 0)));
        const x = days.length === 1 ? width / 2 : (index / (days.length - 1)) * width;
        const y = height - (progress / 100) * 68 - 10;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
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
    const checkins = getStudyCheckins();
    const todayKey = getStudyDateKey();
    const todayCheck = checkins[todayKey] || {};
    const moods = getStudyMoodOptions();
    const days = buildStudyRecentDays(21);
    const curvePath = buildStudyCurvePath(days, checkins);
    const checkedDays = days.filter(day => checkins[day.key]).length;
    const progressValue = Math.max(0, Math.min(100, Number(todayCheck.progress || 0)));
    el.innerHTML = `
        <div class="study-check-head">
            <div>
                <span>Daily Check-in</span>
                <strong>${todayCheck.done ? '今日已打卡' : '今日还未打卡'}</strong>
                <p>${todayCount}/${Math.max(cards.length, 1)} 张卡 · 最近 21 天打卡 ${checkedDays} 天</p>
            </div>
            <button type="button" onclick="startStudyQuiz()"><i class="ri-question-answer-line"></i> 抽查</button>
        </div>
        <div class="study-check-calendar">
            ${days.map(day => {
                const item = checkins[day.key];
                return `<button type="button" class="${item ? 'active' : ''} ${day.key === todayKey ? 'today' : ''}" title="${day.key}">
                    <b>${getStudyDayLabel(day.date)}</b>
                    <span style="--mood:${musicEscapeAttr(getStudyMoodOptions().find(m => m.id === item?.mood)?.tone || '#d0d5dd')}"></span>
                </button>`;
            }).join('')}
        </div>
        <div class="study-check-moods">
            ${moods.map(mood => `
                <button type="button" class="${todayCheck.mood === mood.id ? 'active' : ''}" style="--mood:${musicEscapeAttr(mood.tone)}" onclick="setStudyTodayMood('${musicEscapeAttr(mood.id)}')">
                    <i></i><span>${musicEscapeHtml(mood.label)}</span>
                </button>
            `).join('')}
        </div>
        <div class="study-check-progress">
            <div><span>学习进度</span><b id="study-progress-value">${progressValue}%</b></div>
            <input id="study-check-progress-input" type="range" min="0" max="100" step="5" value="${progressValue}" oninput="updateStudyProgressPreview(this.value)">
        </div>
        <div class="study-check-curve">
            <div><span>记忆曲线</span><b>${checkedDays}/21</b></div>
            <svg viewBox="0 0 290 88" preserveAspectRatio="none" aria-hidden="true">
                <path class="study-curve-bg" d="M0 78 C46 44 84 72 126 46 C172 18 216 48 290 22"></path>
                <path class="study-curve-main" d="${curvePath || 'M0 78 L290 78'}"></path>
            </svg>
        </div>
        <textarea id="study-check-note" class="study-check-note" maxlength="120" placeholder="今天学了什么、心情如何，可以写一句。">${musicEscapeHtml(todayCheck.note || '')}</textarea>
        <div class="study-check-actions">
            <button type="button" onclick="saveStudyTodayCheckin()"><i class="ri-check-line"></i> 保存打卡</button>
            <button type="button" onclick="askStudySupervisor()"><i class="ri-sparkling-2-line"></i> 让 AI 监督</button>
        </div>
    `;
}

function updateStudyProgressPreview(value) {
    const el = document.getElementById('study-progress-value');
    if (el) el.textContent = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
}
window.updateStudyProgressPreview = updateStudyProgressPreview;

function setStudyTodayMood(moodId) {
    const moods = getStudyMoodOptions();
    if (!moods.some(mood => mood.id === moodId)) return;
    const checkins = getStudyCheckins();
    const key = getStudyDateKey();
    checkins[key] = { ...(checkins[key] || {}), mood: moodId, updatedAt: Date.now() };
    saveStudyCheckins(checkins);
    renderStudyCheckCard();
}
window.setStudyTodayMood = setStudyTodayMood;

function saveStudyTodayCheckin() {
    const checkins = getStudyCheckins();
    const key = getStudyDateKey();
    const prev = checkins[key] || {};
    const progressValue = Math.max(0, Math.min(100, Number(document.getElementById('study-check-progress-input')?.value || prev.progress || 0)));
    const note = (document.getElementById('study-check-note')?.value || '').trim();
    checkins[key] = {
        ...prev,
        done: true,
        mood: prev.mood || 'calm',
        progress: progressValue,
        note,
        updatedAt: Date.now()
    };
    saveStudyCheckins(checkins);
    const box = document.getElementById('study-supervisor-text');
    if (box) box.textContent = `今日学习打卡已保存：进度 ${progressValue}%。`;
    renderStudyCheckCard();
}
window.saveStudyTodayCheckin = saveStudyTodayCheckin;

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

// --- Money App / 记账 ---
const MONEY_RECORDS_KEY = 'bynd_money_records_v1';
const MONEY_ACTIVE_TAB_KEY = 'bynd_money_active_tab_v1';
let moneyActiveTab = 'home';
let moneySearchText = '';
let moneyCategoryFilter = 'all';

const MONEY_TABS = [
    { id: 'home', label: '首页', icon: 'ri-home-5-fill' },
    { id: 'records', label: '明细', icon: 'ri-list-check-3' },
    { id: 'stats', label: '统计', icon: 'ri-pie-chart-2-line' },
    { id: 'settings', label: '设置', icon: 'ri-settings-3-line' }
];

const MONEY_CATEGORIES = [
    { name: '餐饮', icon: 'ri-restaurant-line' },
    { name: '交通', icon: 'ri-taxi-line' },
    { name: '购物', icon: 'ri-shopping-bag-3-line' },
    { name: '医疗', icon: 'ri-heart-pulse-line' },
    { name: '生活', icon: 'ri-home-5-line' },
    { name: '学习', icon: 'ri-book-open-line' },
    { name: '娱乐', icon: 'ri-gamepad-line' },
    { name: '日常', icon: 'ri-wallet-3-line' }
];

function getMoneyRecords() {
    try {
        const records = JSON.parse(localStorage.getItem(MONEY_RECORDS_KEY) || '[]');
        return Array.isArray(records) ? records : [];
    } catch (e) {
        return [];
    }
}

function saveMoneyRecords(records) {
    localStorage.setItem(MONEY_RECORDS_KEY, JSON.stringify(Array.isArray(records) ? records : []));
}

function formatMoneyDate(value, mode = 'time') {
    const date = value ? new Date(value) : new Date();
    const safe = Number.isNaN(date.getTime()) ? new Date() : date;
    if (mode === 'day') return `${safe.getMonth() + 1}月${safe.getDate()}日`;
    if (mode === 'month') return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, '0')}`;
    if (mode === 'full') return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, '0')}-${String(safe.getDate()).padStart(2, '0')} ${String(safe.getHours()).padStart(2, '0')}:${String(safe.getMinutes()).padStart(2, '0')}`;
    return `${String(safe.getHours()).padStart(2, '0')}:${String(safe.getMinutes()).padStart(2, '0')}`;
}

function getMoneyCategory(title) {
    const text = String(title || '');
    if (/奶|咖啡|茶|包子|饭|餐|吃|面|粉|鸡|肉|菜|水果|早餐|午餐|晚餐|夜宵/.test(text)) return { name: '餐饮', icon: 'ri-restaurant-line' };
    if (/车|打车|地铁|公交|高铁|机票|油/.test(text)) return { name: '交通', icon: 'ri-taxi-line' };
    if (/衣|鞋|包|化妆|美妆|护肤|口红|买/.test(text)) return { name: '购物', icon: 'ri-shopping-bag-3-line' };
    if (/药|医院|挂号|牙|检查/.test(text)) return { name: '医疗', icon: 'ri-heart-pulse-line' };
    if (/房租|水电|电费|话费|网费/.test(text)) return { name: '生活', icon: 'ri-home-5-line' };
    if (/书|课|学习|考试|文具|课程/.test(text)) return { name: '学习', icon: 'ri-book-open-line' };
    if (/电影|游戏|会员|演唱会|玩/.test(text)) return { name: '娱乐', icon: 'ri-gamepad-line' };
    return { name: '日常', icon: 'ri-wallet-3-line' };
}

function getMoneyCategoryMeta(name) {
    return MONEY_CATEGORIES.find(item => item.name === name) || getMoneyCategory(name) || MONEY_CATEGORIES[MONEY_CATEGORIES.length - 1];
}

function cleanupMoneyItemName(raw) {
    let text = String(raw || '')
        .replace(/[，,。；;、]/g, ' ')
        .replace(/\d+(?:\.\d+)?\s*(元|块|rmb|RMB)?/g, ' ')
        .replace(/(今天|早上|上午|中午|下午|晚上|夜里|刚刚|然后|还有|另外|我|给|在|去|了|的)/g, ' ')
        .replace(/(吃了|买了|花了|花|用了|消费|支出|付款|付了|付|买|吃|喝)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const parts = text.split(/\s+/).filter(Boolean);
    text = parts[parts.length - 1] || text;
    return text.slice(-10) || '消费';
}

function parseMoneyExpenses(text) {
    const source = String(text || '').replace(/[¥￥]/g, '元');
    const records = [];
    const pattern = /([\u4e00-\u9fa5A-Za-z0-9_·\s，,。；;、]{0,24}?)(花了|花|用了|消费|支出|付款|付了|付|买了|买)?\s*(\d+(?:\.\d+)?)(\s*(元|块|rmb|RMB))?/g;
    let match;
    while ((match = pattern.exec(source))) {
        const hasSpendVerb = !!match[2];
        const hasCurrencyUnit = !!match[5];
        if (!hasSpendVerb && !hasCurrencyUnit) continue;
        const amount = Number(match[3]);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 999999) continue;
        const before = source.slice(0, match.index + match[1].length);
        const chunk = before.split(/[，,。；;、\n]/).pop() || match[1] || '';
        const title = cleanupMoneyItemName(chunk);
        if (!title || /^\d+$/.test(title)) continue;
        records.push({ title, amount });
    }
    const deduped = [];
    records.forEach(item => {
        const key = `${item.title}-${item.amount}`;
        if (!deduped.some(old => `${old.title}-${old.amount}` === key)) deduped.push(item);
    });
    return deduped.slice(0, 8);
}

function addMoneyRecord(record) {
    const records = getMoneyRecords();
    const amount = Number(record?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const category = typeof record.category === 'string' ? getMoneyCategoryMeta(record.category) : (record.category || getMoneyCategory(record.title));
    const next = {
        id: record.id || `money_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
        title: String(record.title || '消费').trim().slice(0, 24),
        amount: Math.round(amount * 100) / 100,
        category: category.name || '日常',
        icon: category.icon || 'ri-wallet-3-line',
        source: record.source || 'manual',
        charId: record.charId || '',
        charName: record.charName || '',
        note: record.note || '',
        createdAt: record.createdAt || Date.now(),
        done: !!record.done
    };
    records.unshift(next);
    saveMoneyRecords(records.slice(0, 500));
    if (document.getElementById('app-money-window')?.classList.contains('active')) renderMoneyApp();
    return next;
}

function captureMoneyExpensesFromText(text, source = {}) {
    const expenses = parseMoneyExpenses(text);
    if (!expenses.length) return [];
    const added = expenses.map(item => addMoneyRecord({
        ...item,
        source: source.source || 'wechat',
        charId: source.charId || '',
        charName: source.charName || '',
        note: String(text || '').slice(0, 120)
    })).filter(Boolean);
    if (added.length && typeof showWechatToast === 'function') {
        showWechatToast(`已记账 ${added.length} 笔`);
    }
    return added;
}
window.captureMoneyExpensesFromText = captureMoneyExpensesFromText;

function isMoneyRecordToday(item) {
    return new Date(item.createdAt || Date.now()).toDateString() === new Date().toDateString();
}

function getMoneySummary(records) {
    const now = new Date();
    const monthKey = formatMoneyDate(now, 'month');
    const todayKey = now.toDateString();
    return records.reduce((acc, item) => {
        const date = new Date(item.createdAt || Date.now());
        if (formatMoneyDate(date, 'month') === monthKey) acc.month += Number(item.amount) || 0;
        if (date.toDateString() === todayKey) {
            acc.today += Number(item.amount) || 0;
            acc.todayCount += 1;
        }
        acc.total += Number(item.amount) || 0;
        return acc;
    }, { month: 0, today: 0, total: 0, todayCount: 0 });
}

function getMoneyStats(records) {
    const byCategory = {};
    records.forEach(item => {
        const category = item.category || '日常';
        if (!byCategory[category]) byCategory[category] = { category, total: 0, count: 0, icon: item.icon || getMoneyCategoryMeta(category).icon };
        byCategory[category].total += Number(item.amount) || 0;
        byCategory[category].count += 1;
    });
    return Object.values(byCategory).sort((a, b) => b.total - a.total);
}

function getMoneyFilteredRecords(records) {
    const query = moneySearchText.trim().toLowerCase();
    return records.filter(item => {
        const categoryOk = moneyCategoryFilter === 'all' || item.category === moneyCategoryFilter;
        const haystack = `${item.title || ''} ${item.category || ''} ${item.note || ''} ${item.charName || ''}`.toLowerCase();
        const queryOk = !query || haystack.includes(query);
        return categoryOk && queryOk;
    });
}

function renderMoneyRecordItem(item, options = {}) {
    const compact = !!options.compact;
    return `
        <div class="money-record-item ${item.done ? 'done' : ''}">
            <button type="button" class="money-record-main" onclick="toggleMoneyRecord('${musicEscapeAttr(item.id)}')">
                <i class="${musicEscapeAttr(item.icon || 'ri-wallet-3-line')}"></i>
                <div>
                    <strong>${musicEscapeHtml(item.title)}</strong>
                    <span>${musicEscapeHtml(item.category || '日常')} · ${musicEscapeHtml(compact ? formatMoneyDate(item.createdAt) : formatMoneyDate(item.createdAt, 'full'))}${item.charName ? ` · 来自 ${musicEscapeHtml(item.charName)}` : ''}</span>
                </div>
                <em>-￥${Number(item.amount || 0).toFixed(2)}</em>
            </button>
            ${compact ? '' : `
                <div class="money-record-actions">
                    <button type="button" onclick="editMoneyRecord('${musicEscapeAttr(item.id)}')"><i class="ri-edit-line"></i> 编辑</button>
                    <button type="button" onclick="deleteMoneyRecord('${musicEscapeAttr(item.id)}')"><i class="ri-delete-bin-line"></i> 删除</button>
                </div>
            `}
        </div>
    `;
}

function renderMoneyEmpty(text = '在微信里说“早餐包子花了4.5，牛奶3块”，这里会自动出现。') {
    return `
        <div class="money-empty">
            <i class="ri-chat-quote-line"></i>
            <strong>还没有账单</strong>
            <span>${musicEscapeHtml(text)}</span>
        </div>
    `;
}

function renderMoneyHome(records, summary, profile) {
    const todayRecords = records.filter(isMoneyRecordToday);
    const visible = todayRecords.length ? todayRecords.slice(0, 5) : records.slice(0, 5);
    return `
        <section class="money-hello">
            <div>
                <span>HELLO, <b>${musicEscapeHtml(profile.name || 'BYND')}</b></span>
                <strong>今天的消费已经整理好了</strong>
            </div>
            <em>${summary.todayCount} 笔</em>
        </section>
        <section class="money-id-card">
            <div class="money-id-main">
                <span>MONTHLY SPEND</span>
                <strong>￥${summary.month.toFixed(2)}</strong>
                <p>今日 ￥${summary.today.toFixed(2)} · 累计 ￥${summary.total.toFixed(2)}</p>
            </div>
            <div class="money-id-side">
                <i class="ri-wallet-3-line"></i>
                <div class="money-barcode"><span></span><span></span><span></span><span></span><span></span></div>
            </div>
        </section>
        <section class="money-list-card">
            <div class="money-section-head">
                <div><span>RECORDS</span><strong>${todayRecords.length ? '今日记录' : '最近记录'}</strong></div>
                <button type="button" onclick="addManualMoneyRecord()">+ 记一笔</button>
            </div>
            <div class="money-record-list">${visible.length ? visible.map(item => renderMoneyRecordItem(item, { compact: true })).join('') : renderMoneyEmpty()}</div>
        </section>
    `;
}

function renderMoneyRecords(records) {
    const categories = ['all', ...Array.from(new Set(records.map(item => item.category || '日常')))];
    const filtered = getMoneyFilteredRecords(records);
    return `
        <section class="money-list-card money-records-page">
            <div class="money-section-head">
                <div><span>DETAILS</span><strong>消费明细</strong></div>
                <button type="button" onclick="addManualMoneyRecord()">+ 记一笔</button>
            </div>
            <label class="money-search">
                <i class="ri-search-line"></i>
                <input type="search" value="${musicEscapeAttr(moneySearchText)}" placeholder="搜索内容、分类或角色" oninput="setMoneySearch(this.value)">
            </label>
            <div class="money-filter-row">
                ${categories.map(category => `
                    <button type="button" class="${moneyCategoryFilter === category ? 'active' : ''}" onclick="setMoneyCategoryFilter('${musicEscapeAttr(category)}')">${musicEscapeHtml(category === 'all' ? '全部' : category)}</button>
                `).join('')}
            </div>
            <div class="money-record-list">${filtered.length ? filtered.map(item => renderMoneyRecordItem(item)).join('') : renderMoneyEmpty('没有匹配到记录，换个关键词或分类试试。')}</div>
        </section>
    `;
}

function renderMoneyStats(records, summary) {
    const stats = getMoneyStats(records);
    const max = Math.max(1, ...stats.map(item => item.total));
    return `
        <section class="money-stats-hero">
            <span>THIS MONTH</span>
            <strong>￥${summary.month.toFixed(2)}</strong>
            <p>今日 ￥${summary.today.toFixed(2)} · 共 ${records.length} 笔记录</p>
        </section>
        <section class="money-list-card">
            <div class="money-section-head">
                <div><span>ANALYTICS</span><strong>分类统计</strong></div>
                <button type="button" onclick="switchMoneyTab('records')">看明细</button>
            </div>
            <div class="money-stat-list">
                ${stats.length ? stats.map(item => `
                    <div class="money-stat-item">
                        <i class="${musicEscapeAttr(item.icon || 'ri-wallet-3-line')}"></i>
                        <div>
                            <strong>${musicEscapeHtml(item.category)}</strong>
                            <span>${item.count} 笔 · ￥${item.total.toFixed(2)}</span>
                            <b style="width:${Math.max(8, Math.round((item.total / max) * 100))}%"></b>
                        </div>
                    </div>
                `).join('') : renderMoneyEmpty('还没有可统计的记录。')}
            </div>
        </section>
    `;
}

function renderMoneySettings(records, summary) {
    return `
        <section class="money-list-card money-settings-card">
            <div class="money-section-head">
                <div><span>SETTINGS</span><strong>记账设置</strong></div>
                <button type="button" onclick="addManualMoneyRecord()">+ 记一笔</button>
            </div>
            <div class="money-setting-grid">
                <button type="button" onclick="exportMoneyRecords()"><i class="ri-download-2-line"></i><strong>导出账本</strong><span>${records.length} 笔记录</span></button>
                <button type="button" onclick="importMoneyRecordsFromText()"><i class="ri-file-copy-2-line"></i><strong>粘贴导入</strong><span>支持 JSON</span></button>
                <button type="button" onclick="switchMoneyTab('stats')"><i class="ri-pie-chart-2-line"></i><strong>查看统计</strong><span>本月 ￥${summary.month.toFixed(2)}</span></button>
                <button type="button" class="danger" onclick="clearMoneyRecords()"><i class="ri-delete-bin-line"></i><strong>清空账本</strong><span>谨慎操作</span></button>
            </div>
        </section>
        <section class="money-help-card">
            <strong>微信自动记账</strong>
            <p>在微信聊天里发送“早上吃了包子花了4.5，牛奶3块”，会自动拆成多条记录。明细页可以编辑、删除和按分类筛选。</p>
        </section>
    `;
}

function renderMoneyTabbar() {
    const tabbar = document.getElementById('money-tabbar');
    if (!tabbar) return;
    tabbar.innerHTML = MONEY_TABS.map(tab => `
        <button type="button" class="${moneyActiveTab === tab.id ? 'active' : ''}" onclick="switchMoneyTab('${musicEscapeAttr(tab.id)}')">
            <i class="${musicEscapeAttr(tab.icon)}"></i><span>${musicEscapeHtml(tab.label)}</span>
        </button>
    `).join('');
}

function renderMoneyApp() {
    const content = document.getElementById('money-content');
    if (!content) return;
    const records = getMoneyRecords();
    const summary = getMoneySummary(records);
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    if (!MONEY_TABS.some(tab => tab.id === moneyActiveTab)) moneyActiveTab = 'home';
    if (moneyActiveTab === 'records') content.innerHTML = renderMoneyRecords(records);
    else if (moneyActiveTab === 'stats') content.innerHTML = renderMoneyStats(records, summary);
    else if (moneyActiveTab === 'settings') content.innerHTML = renderMoneySettings(records, summary);
    else content.innerHTML = renderMoneyHome(records, summary, profile);
    renderMoneyTabbar();
}

function initMoneyApp() {
    const saved = localStorage.getItem(MONEY_ACTIVE_TAB_KEY);
    moneyActiveTab = MONEY_TABS.some(tab => tab.id === saved) ? saved : 'home';
    renderMoneyApp();
}
window.initMoneyApp = initMoneyApp;

function switchMoneyTab(tab) {
    moneyActiveTab = MONEY_TABS.some(item => item.id === tab) ? tab : 'home';
    localStorage.setItem(MONEY_ACTIVE_TAB_KEY, moneyActiveTab);
    renderMoneyApp();
}
window.switchMoneyTab = switchMoneyTab;

function setMoneySearch(value) {
    moneySearchText = String(value || '');
    const list = document.querySelector('.money-records-page .money-record-list');
    if (!list) {
        renderMoneyApp();
        return;
    }
    const filtered = getMoneyFilteredRecords(getMoneyRecords());
    list.innerHTML = filtered.length ? filtered.map(item => renderMoneyRecordItem(item)).join('') : renderMoneyEmpty('没有匹配到记录，换个关键词或分类试试。');
}
window.setMoneySearch = setMoneySearch;

function setMoneyCategoryFilter(category) {
    moneyCategoryFilter = category || 'all';
    renderMoneyApp();
}
window.setMoneyCategoryFilter = setMoneyCategoryFilter;

function getMoneySheetCategoryButtons(activeCategory) {
    const active = getMoneyCategoryMeta(activeCategory || '日常').name;
    return MONEY_CATEGORIES.map(category => `
        <button type="button" class="${category.name === active ? 'active' : ''}" data-money-category="${musicEscapeAttr(category.name)}" onclick="selectMoneySheetCategory('${musicEscapeAttr(category.name)}')">
            <i class="${musicEscapeAttr(category.icon)}"></i><span>${musicEscapeHtml(category.name)}</span>
        </button>
    `).join('');
}

function openMoneyManualSheet(record = null) {
    closeMoneyManualSheet(true);
    const editing = !!record;
    const category = getMoneyCategoryMeta(record?.category || record?.title || '日常');
    const host = document.querySelector('#app-money-window .money-shell') || document.getElementById('app-money-window') || document.body;
    const sheet = document.createElement('div');
    sheet.id = 'money-manual-sheet';
    sheet.className = 'money-sheet-overlay';
    sheet.innerHTML = `
        <button type="button" class="money-sheet-backdrop" onclick="closeMoneyManualSheet()" aria-label="关闭记账表单"></button>
        <form class="money-sheet" onsubmit="submitMoneyManualSheet(event)">
            <div class="money-sheet-grip"></div>
            <div class="money-sheet-head">
                <div>
                    <span>${editing ? 'EDIT RECORD' : 'NEW RECORD'}</span>
                    <strong>${editing ? '编辑这笔账' : '记一笔'}</strong>
                </div>
                <button type="button" onclick="closeMoneyManualSheet()" aria-label="关闭"><i class="ri-close-line"></i></button>
            </div>
            <input type="hidden" id="money-sheet-id" value="${musicEscapeAttr(record?.id || '')}">
            <label class="money-field">
                <span>花在什么上</span>
                <input id="money-sheet-title" type="text" value="${musicEscapeAttr(record?.title || '')}" placeholder="比如 包子、牛奶、日语教材" autocomplete="off">
            </label>
            <label class="money-field">
                <span>金额</span>
                <input id="money-sheet-amount" type="number" inputmode="decimal" min="0" step="0.01" value="${record?.amount ? musicEscapeAttr(String(record.amount)) : ''}" placeholder="0.00">
            </label>
            <div class="money-field">
                <span>分类</span>
                <div class="money-category-picker" id="money-sheet-categories">${getMoneySheetCategoryButtons(category.name)}</div>
            </div>
            <label class="money-field">
                <span>备注</span>
                <textarea id="money-sheet-note" rows="2" placeholder="可选">${musicEscapeHtml(record?.note || '')}</textarea>
            </label>
            <button type="submit" class="money-sheet-submit">${editing ? '保存修改' : '保存这笔'}</button>
        </form>
    `;
    host.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
    setTimeout(() => document.getElementById('money-sheet-title')?.focus(), 120);
}
window.openMoneyManualSheet = openMoneyManualSheet;

function closeMoneyManualSheet(immediate = false) {
    const sheet = document.getElementById('money-manual-sheet');
    if (!sheet) return;
    if (immediate) {
        sheet.remove();
        return;
    }
    sheet.classList.remove('show');
    setTimeout(() => sheet.remove(), 180);
}
window.closeMoneyManualSheet = closeMoneyManualSheet;

function selectMoneySheetCategory(category) {
    const picker = document.getElementById('money-sheet-categories');
    if (!picker) return;
    picker.querySelectorAll('button').forEach(button => {
        button.classList.toggle('active', button.dataset.moneyCategory === category);
    });
}
window.selectMoneySheetCategory = selectMoneySheetCategory;

function submitMoneyManualSheet(event) {
    event?.preventDefault?.();
    const id = document.getElementById('money-sheet-id')?.value || '';
    const title = document.getElementById('money-sheet-title')?.value?.trim() || '';
    const amount = Number(document.getElementById('money-sheet-amount')?.value || 0);
    const activeCategory = document.querySelector('#money-sheet-categories button.active')?.dataset.moneyCategory || getMoneyCategory(title).name;
    const note = document.getElementById('money-sheet-note')?.value?.trim() || '';
    if (!title) {
        if (typeof showWechatToast === 'function') showWechatToast('先写这笔钱花在什么上');
        else alert('先写这笔钱花在什么上');
        return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        if (typeof showWechatToast === 'function') showWechatToast('金额不正确');
        else alert('金额不正确');
        return;
    }
    if (id) {
        const records = getMoneyRecords();
        const item = records.find(record => record.id === id);
        if (item) {
            const category = getMoneyCategoryMeta(activeCategory);
            item.title = title.slice(0, 24);
            item.amount = Math.round(amount * 100) / 100;
            item.category = category.name;
            item.icon = category.icon;
            item.note = note;
            item.updatedAt = Date.now();
            saveMoneyRecords(records);
        }
    } else {
        addMoneyRecord({ title, amount, category: activeCategory, note, source: 'manual' });
    }
    closeMoneyManualSheet();
    renderMoneyApp();
}
window.submitMoneyManualSheet = submitMoneyManualSheet;

function toggleMoneyRecord(id) {
    const records = getMoneyRecords();
    const item = records.find(record => record.id === id);
    if (item) item.done = !item.done;
    saveMoneyRecords(records);
    renderMoneyApp();
}
window.toggleMoneyRecord = toggleMoneyRecord;

function editMoneyRecord(id) {
    const records = getMoneyRecords();
    const item = records.find(record => record.id === id);
    if (!item) return;
    openMoneyManualSheet(item);
}
window.editMoneyRecord = editMoneyRecord;

function deleteMoneyRecord(id) {
    const records = getMoneyRecords();
    const item = records.find(record => record.id === id);
    if (!item) return;
    if (!confirm(`删除「${item.title}」这笔记录？`)) return;
    saveMoneyRecords(records.filter(record => record.id !== id));
    renderMoneyApp();
}
window.deleteMoneyRecord = deleteMoneyRecord;

function addManualMoneyRecord() {
    openMoneyManualSheet();
}
window.addManualMoneyRecord = addManualMoneyRecord;

function exportMoneyRecords() {
    const records = getMoneyRecords();
    const payload = JSON.stringify({ version: 'bynd-money-v1', exportedAt: new Date().toISOString(), records }, null, 2);
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(payload).then(() => alert('账本 JSON 已复制到剪贴板')).catch(() => prompt('复制账本 JSON', payload));
    } else {
        prompt('复制账本 JSON', payload);
    }
}
window.exportMoneyRecords = exportMoneyRecords;

function importMoneyRecordsFromText() {
    const text = prompt('粘贴账本 JSON');
    if (!text) return;
    try {
        const data = JSON.parse(text);
        const incoming = Array.isArray(data) ? data : data.records;
        if (!Array.isArray(incoming)) throw new Error('没有 records 数组');
        const normalized = incoming.map(item => {
            const category = getMoneyCategoryMeta(item.category || item.title || '日常');
            return {
                id: item.id || `money_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
                title: String(item.title || '消费').slice(0, 24),
                amount: Math.max(0, Number(item.amount) || 0),
                category: category.name,
                icon: item.icon || category.icon,
                source: item.source || 'import',
                charId: item.charId || '',
                charName: item.charName || '',
                note: item.note || '',
                createdAt: item.createdAt || Date.now(),
                done: !!item.done
            };
        }).filter(item => item.amount > 0);
        saveMoneyRecords([...normalized, ...getMoneyRecords()].slice(0, 500));
        alert(`已导入 ${normalized.length} 笔`);
        renderMoneyApp();
    } catch (e) {
        alert('导入失败：' + e.message);
    }
}
window.importMoneyRecordsFromText = importMoneyRecordsFromText;

function clearMoneyRecords() {
    if (!confirm('确定清空所有记账记录？')) return;
    saveMoneyRecords([]);
    renderMoneyApp();
}
window.clearMoneyRecords = clearMoneyRecords;

// --- Dream Vault / 盗梦空间 ---
const DREAM_RECORDS_KEY = 'bynd_dream_records_v1';
let dreamGenerating = false;

function getDreamRecords() {
    try {
        const records = JSON.parse(localStorage.getItem(DREAM_RECORDS_KEY) || '[]');
        return Array.isArray(records) ? records.filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

function saveDreamRecords(records) {
    localStorage.setItem(DREAM_RECORDS_KEY, JSON.stringify((Array.isArray(records) ? records : []).slice(0, 80)));
}

function getDreamCharacters() {
    return Array.isArray(window.myCharacters)
        ? window.myCharacters.filter(char => char && char.id && !char.isGroupChat)
        : [];
}

function getDreamCharName(char) {
    return (char && char.chatConfig && char.chatConfig.nickname) || (char && char.name) || '未命名';
}

function getDreamTimeText(ts) {
    if (typeof formatWechatRelativeTime === 'function') return formatWechatRelativeTime(ts);
    const date = new Date(ts || Date.now());
    return Number.isNaN(date.getTime()) ? '刚刚' : `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function setDreamStatus(text, tone = '') {
    const el = document.getElementById('dream-status');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.tone = tone || '';
}

function extractDreamJsonPayload(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const unfenced = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    const candidates = [unfenced];
    const objectStart = unfenced.indexOf('{');
    const objectEnd = unfenced.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) candidates.push(unfenced.slice(objectStart, objectEnd + 1));
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch (_) {}
    }
    return null;
}

function getDreamRecentContext(char) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    return history.slice(-10).map(msg => {
        const who = msg.isMe ? '用户' : getDreamCharName(char);
        const text = String(msg.description || msg.content || msg.dialogue || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        return text ? `${who}: ${text.slice(0, 220)}` : '';
    }).filter(Boolean).join('\n');
}

function buildDreamGenerationMessages(char) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const name = getDreamCharName(char);
    const description = String(char && char.description || '').replace(/\s+/g, ' ').slice(0, 2800);
    const worldBook = Array.isArray(char && char.worldBook)
        ? char.worldBook.slice(0, 12).map(entry => {
            const key = entry.key || entry.keys || entry.keyword || '';
            const content = String(entry.content || entry.entry || entry.value || '').replace(/\s+/g, ' ').slice(0, 380);
            return content ? `${key ? `【${key}】` : ''}${content}` : '';
        }).filter(Boolean).join('\n')
        : '';
    const recent = getDreamRecentContext(char) || '暂无最近聊天。';
    return [
        {
            role: 'system',
            content: [
                '你是 BYND 盗梦空间的梦境档案编写器，只输出 JSON 对象，不要解释，不要 Markdown。',
                '字段必须是：title、text、imagePrompt。',
                'title：12 字以内，像电影章节名。',
                'text：220-520 字，中文，梦幻、神秘、有电影感，像打开潘多拉盒子后看到的私人梦境档案。',
                'imagePrompt：英文或中文都可以，用于文生图，必须描述画面、光线、镜头、氛围和角色一致性。',
                '可以写暧昧、眷恋、身体距离和潜意识欲望，但不要写露骨性器官、具体性行为或未成年人内容。'
            ].join('\n')
        },
        {
            role: 'user',
            content: [
                `角色原名：${char.name || name}`,
                `用户给角色的备注名：${name}`,
                `用户：${profile.name || '我'}`,
                description ? `角色卡：${description}` : '',
                worldBook ? `世界书：\n${worldBook}` : '',
                `最近聊天：\n${recent}`,
                '请基于角色人设和最近互动，生成一条“角色醒来后被记录下来的梦境”。只输出 JSON。'
            ].filter(Boolean).join('\n\n')
        }
    ];
}

function renderDreamEmpty(message) {
    return `
        <div class="dream-empty">
            <i class="ri-moon-cloudy-line"></i>
            <strong>${musicEscapeHtml(message || '还没有梦境档案')}</strong>
            <span>选择一个角色后生成，文字走聊天 API，封面走生图 API。</span>
        </div>
    `;
}

function renderDreamList() {
    const list = document.getElementById('dream-list');
    if (!list) return;
    const records = getDreamRecords().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!records.length) {
        list.innerHTML = renderDreamEmpty('梦境盒子还没有被打开');
        return;
    }
    list.innerHTML = records.map(record => `
        <article class="dream-record">
            <div class="dream-record-cover">
                ${record.imageUrl ? `<img src="${musicEscapeAttr(record.imageUrl)}" alt="${musicEscapeAttr(record.title || '梦境封面')}" onerror="this.remove()">` : '<i class="ri-moon-foggy-line"></i>'}
            </div>
            <div class="dream-record-body">
                <div class="dream-record-meta">
                    <span>${musicEscapeHtml(record.charName || '未知角色')}</span>
                    <em>${musicEscapeHtml(getDreamTimeText(record.createdAt))}</em>
                </div>
                <strong>${musicEscapeHtml(record.title || '无题梦境')}</strong>
                <p>${musicEscapeHtml(record.text || '')}</p>
                ${record.imageError ? `<small>封面生成失败：${musicEscapeHtml(record.imageError)}</small>` : ''}
            </div>
            <button type="button" class="dream-delete" onclick="deleteDreamRecord('${musicEscapeAttr(record.id)}')" aria-label="删除梦境"><i class="ri-close-line"></i></button>
        </article>
    `).join('');
}

function initDreamApp() {
    const select = document.getElementById('dream-char-select');
    const chars = getDreamCharacters();
    if (select) {
        const previous = select.value;
        select.classList.add('dream-native-select');
        select.innerHTML = chars.length
            ? chars.map(char => `<option value="${musicEscapeAttr(char.id)}">${musicEscapeHtml(getDreamCharName(char))}</option>`).join('')
            : '<option value="">先导入角色卡</option>';
        if (previous && chars.some(char => char.id === previous)) select.value = previous;
    }
    renderDreamCharPicker(chars);
    setDreamStatus(chars.length ? '选择角色，打开梦境盒子。' : '还没有可生成梦境的角色。', chars.length ? '' : 'warn');
    renderDreamList();
}
window.initDreamApp = initDreamApp;

function renderDreamCharPicker(chars = getDreamCharacters()) {
    const select = document.getElementById('dream-char-select');
    const label = select?.closest('label');
    if (!select || !label) return;
    let picker = label.querySelector('.dream-char-picker');
    if (!picker) {
        picker = document.createElement('div');
        picker.className = 'dream-char-picker';
        select.insertAdjacentElement('afterend', picker);
    }
    const selected = chars.find(char => char.id === select.value) || chars[0] || null;
    if (selected && select.value !== selected.id) select.value = selected.id;
    const buttonLabel = selected ? getDreamCharName(selected) : '先导入角色卡';
    picker.innerHTML = `
        <button type="button" class="dream-char-trigger" onclick="toggleDreamCharPicker(event)" ${chars.length ? '' : 'disabled'}>
            <span>${musicEscapeHtml(buttonLabel)}</span>
            <i class="ri-arrow-down-s-line"></i>
        </button>
        <div class="dream-char-menu">
            ${chars.length ? chars.map(char => {
                const active = char.id === select.value;
                return `<button type="button" class="${active ? 'active' : ''}" onclick="selectDreamChar('${musicEscapeAttr(char.id)}')">${musicEscapeHtml(getDreamCharName(char))}</button>`;
            }).join('') : '<em>还没有角色</em>'}
        </div>
    `;
    if (!document.documentElement.dataset.dreamPickerBound) {
        document.documentElement.dataset.dreamPickerBound = '1';
        document.addEventListener('pointerdown', event => {
            if (event.target.closest('.dream-char-picker')) return;
            closeDreamCharPicker();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeDreamCharPicker();
        });
    }
}

function toggleDreamCharPicker(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const picker = document.querySelector('.dream-char-picker');
    if (!picker) return false;
    picker.classList.toggle('open');
    return false;
}
window.toggleDreamCharPicker = toggleDreamCharPicker;

function closeDreamCharPicker() {
    document.querySelectorAll('.dream-char-picker.open').forEach(item => item.classList.remove('open'));
}
window.closeDreamCharPicker = closeDreamCharPicker;

function selectDreamChar(charId) {
    const select = document.getElementById('dream-char-select');
    if (!select) return false;
    select.value = charId;
    closeDreamCharPicker();
    renderDreamCharPicker();
    return false;
}
window.selectDreamChar = selectDreamChar;

async function generateDreamRecord() {
    if (dreamGenerating) return;
    const select = document.getElementById('dream-char-select');
    const charId = select?.value || '';
    const char = getDreamCharacters().find(item => item.id === charId) || getDreamCharacters()[0];
    if (!char) {
        setDreamStatus('还没有可生成梦境的角色。', 'warn');
        return;
    }
    if (typeof callChatApi !== 'function') {
        setDreamStatus('聊天 API 模块没有加载，无法生成梦境文字。', 'error');
        return;
    }
    dreamGenerating = true;
    document.querySelectorAll('.dream-control button, .dream-topbar button:last-child').forEach(btn => btn.disabled = true);
    setDreamStatus('正在读取角色记忆，生成梦境文字...', 'busy');
    try {
        const result = await callChatApi(buildDreamGenerationMessages(char));
        if (!result.ok) throw new Error(result.error || '梦境文字生成失败');
        const payload = extractDreamJsonPayload(result.content);
        if (!payload) throw new Error('AI 没有返回可解析的梦境 JSON');
        const title = String(payload.title || '未命名梦境').trim().slice(0, 24);
        const text = String(payload.text || payload.content || '').trim();
        const imagePrompt = String(payload.imagePrompt || payload.prompt || title).trim();
        if (!text) throw new Error('AI 没有返回梦境正文');

        let imageUrl = '';
        let imageError = '';
        if (typeof callWechatImageGenerationApi === 'function' && imagePrompt) {
            setDreamStatus('梦境文字已生成，正在生成封面...', 'busy');
            const imageResult = await callWechatImageGenerationApi(
                [
                    imagePrompt,
                    `cinematic dream archive, mysterious portal, Pandora box atmosphere, ${getDreamCharName(char)} as the central figure, soft surreal lighting, high detail, portrait composition`
                ].join('\n'),
                { referenceImage: (char.chatConfig && char.chatConfig.imageReference) || char.avatar || '', size: '1024x1024' }
            );
            if (imageResult.ok && imageResult.url) imageUrl = imageResult.url;
            else imageError = imageResult.error || '图片接口没有返回图片';
        } else {
            imageError = '未找到生图 API 函数';
        }

        const records = getDreamRecords();
        records.unshift({
            id: `dream_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
            charId: char.id,
            charName: getDreamCharName(char),
            avatar: char.avatar || '',
            createdAt: Date.now(),
            title,
            text,
            imagePrompt,
            imageUrl,
            imageError
        });
        saveDreamRecords(records);
        renderDreamList();
        setDreamStatus(imageError ? `梦境已保存，但封面生成失败：${imageError}` : '梦境已封存。', imageError ? 'warn' : 'done');
    } catch (e) {
        setDreamStatus(`生成失败：${e.message || e}`, 'error');
    } finally {
        dreamGenerating = false;
        document.querySelectorAll('.dream-control button, .dream-topbar button:last-child').forEach(btn => btn.disabled = false);
    }
}
window.generateDreamRecord = generateDreamRecord;

function deleteDreamRecord(id) {
    const record = getDreamRecords().find(item => item.id === id);
    if (!record) return;
    if (!confirm(`删除「${record.title || '这条梦境'}」？`)) return;
    saveDreamRecords(getDreamRecords().filter(item => item.id !== id));
    renderDreamList();
    setDreamStatus('已删除一条梦境档案。', 'done');
}
window.deleteDreamRecord = deleteDreamRecord;

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
    'https://bynd-push.myluckylxy.workers.dev/codex-pets',
    MONITOR_PET_ORIGIN
];
let monitorActiveTool = localStorage.getItem(MONITOR_ACTIVE_TOOL_KEY) || 'internal';
let monitorPetQuery = '';
let monitorPetResults = [];
let monitorPetLoading = false;
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
    const enabled = chars.filter(char => !!(char.chatConfig && char.chatConfig.monitorEnabled));
    if (!enabled.length) return null;
    const boundId = localStorage.getItem(MONITOR_PET_BOUND_CHAR_KEY) || '';
    return enabled.find(char => char.id === boundId) || enabled[0] || null;
}

function setMonitorPetBoundChar(charId) {
    const id = String(charId || '').trim();
    if (id) localStorage.setItem(MONITOR_PET_BOUND_CHAR_KEY, id);
    else localStorage.removeItem(MONITOR_PET_BOUND_CHAR_KEY);
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
    localStorage.setItem(MONITOR_PET_ENABLED_KEY, enabled ? '1' : '0');
    monitorPetFloatMessage = '';
    if (!enabled) {
        stopMonitorPetAutoObserve();
        document.querySelector('.phone-container > .monitor-pet-floating')?.remove();
        updateMonitorPetStatus('桌宠已关闭，素材和绑定角色会保留。');
    } else {
        updateMonitorPetStatus('桌宠已开启。');
        if (isMonitorScreenSharingActive()) startMonitorPetAutoObserve();
    }
    syncMonitorPetFloating();
    renderMonitorCharacters();
    if (typeof showWechatToast === 'function') showWechatToast(enabled ? '桌宠已开启' : '桌宠已关闭');
    return false;
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
            updateMonitorScreenStatus('已请求安卓屏幕录制授权，请在系统弹窗中确认。');
            renderMonitorCharacters();
            startMonitorPetAutoObserve();
        } catch (e) {
            updateMonitorScreenStatus(`安卓屏幕授权失败：${e && e.message ? e.message : e}`);
        }
        return false;
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        updateMonitorScreenStatus('当前浏览器不支持屏幕共享；APK 版需要接 Android MediaProjection。');
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
        } catch (e) {}
    }
    if (monitorScreenStream) {
        monitorScreenStream.getTracks().forEach(track => track.stop());
    }
    monitorScreenStream = null;
    monitorScreenFrameDataUrl = '';
    if (monitorScreenVideo) monitorScreenVideo.srcObject = null;
    updateMonitorScreenStatus('屏幕共享已停止');
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
    localStorage.setItem('bynd_monitor_pet_observe_interval_v1', String(seconds === 0 ? 0 : Math.max(30, seconds)));
    if (seconds === 0) {
        stopMonitorPetAutoObserve();
        updateMonitorScreenStatus('已切换为仅点击桌宠时观察屏幕。');
    } else {
        if (isMonitorScreenSharingActive()) startMonitorPetAutoObserve();
        updateMonitorScreenStatus(`桌宠会每 ${seconds >= 60 ? `${Math.round(seconds / 60)} 分钟` : `${seconds} 秒`}左右自动观察一次屏幕。`);
    }
    renderMonitorCharacters();
    return false;
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

function renderMonitorOverview(chars) {
    const box = document.getElementById('monitor-overview');
    const toolbar = document.getElementById('monitor-toolbar');
    const stats = getMonitorStats(chars);
    if (!['internal', 'island', 'pet', 'phone'].includes(monitorActiveTool)) monitorActiveTool = 'internal';
    if (box) {
        box.innerHTML = `
            <article>
                <span>接入角色</span>
                <strong>${stats.enabled}<em>/${stats.total}</em></strong>
                <small>${stats.enabled ? '正在监听 BYND 内部聊天' : '等待选择监控者'}</small>
            </article>
            <article>
                <span>吐槽视角</span>
                <strong>${stats.observer}</strong>
                <small>${stats.persona ? `${stats.persona} 位角色本人视角` : '第三方弹幕更适合吃瓜'}</small>
            </article>
            <article>
                <span>异常</span>
                <strong>${stats.errors}</strong>
                <small>${stats.errors ? '有角色需要刷新状态' : '当前状态干净'}</small>
            </article>
        `;
    }
    if (toolbar) {
        const tools = [
            { id: 'internal', icon: 'ri-radar-line', title: '内部剧情', text: stats.enabled ? '已启用' : '未接入' },
            { id: 'island', icon: 'ri-notification-4-line', title: '后台提示', text: stats.enabled ? '跟随角色' : '待角色接入' },
            { id: 'pet', icon: 'ri-bubble-chart-line', title: '桌宠气泡', text: isMonitorPetEnabled() ? (stats.enabled ? '跟随角色' : '待角色接入') : '已关闭' },
            { id: 'phone', icon: 'ri-smartphone-line', title: '真实手机', text: isMonitorScreenSharingActive() ? '已授权' : '需授权' }
        ];
        toolbar.innerHTML = tools.map(item => `
            <button type="button" class="${monitorActiveTool === item.id ? 'active' : ''}" onclick="handleMonitorTool('${item.id}')">
                <i class="${item.icon}"></i>
                <b>${item.title}</b>
                <span>${item.text}</span>
            </button>
        `).join('');
    }
    renderMonitorToolPanel(chars, stats);
}

function renderMonitorToolPanel(chars, stats = getMonitorStats(chars)) {
    const panel = document.getElementById('monitor-tool-panel');
    if (!panel) return;
    const enabled = chars.filter(char => !!(char.chatConfig && char.chatConfig.monitorEnabled));
    const names = enabled.map(char => getMonitorCharName(char)).slice(0, 3).join('、');
    const summary = names ? `${names}${enabled.length > 3 ? ` 等 ${enabled.length} 位` : ''}` : '还没有角色接入';
    const configs = {
        internal: {
            icon: 'ri-radar-line',
            title: '内部剧情监控',
            desc: stats.enabled ? `当前由 ${summary} 观察 BYND 内部聊天。` : '选择角色接入后，会根据角色人设、记忆和聊天气氛输出反应。',
            status: stats.enabled ? '运行中' : '未接入',
            action: '管理角色',
            onclick: "document.getElementById('monitor-char-list')?.scrollIntoView({behavior:'smooth',block:'start'})"
        },
        island: {
            icon: 'ri-notification-4-line',
            title: '后台提示输出',
            desc: stats.enabled ? '角色返回 island / warning 时，会走后台提示和灵动岛提示。' : '先接入至少一位角色，后台提示才会跟随监控结果出现。',
            status: stats.enabled ? '跟随监控' : '等待角色',
            action: '刷新状态',
            onclick: 'refreshMonitorApp()'
        },
        pet: {
            icon: 'ri-bubble-chart-line',
            title: '桌宠气泡',
            desc: isMonitorPetEnabled()
                ? (stats.enabled ? '桌宠会绑定已接入的角色；授权屏幕共享后，点击桌宠会把当前真实屏幕的一帧交给视觉模型。' : '先接入至少一位角色，桌宠才会按人设和世界书说话。')
                : '桌宠已关闭，素材、位置和绑定角色都会保留，重新开启后继续使用。',
            status: isMonitorPetEnabled() ? (stats.enabled ? '跟随角色' : '等待角色') : '已关闭',
            action: '查看角色',
            onclick: "document.getElementById('monitor-char-list')?.scrollIntoView({behavior:'smooth',block:'start'})"
        },
        phone: {
            icon: 'ri-smartphone-line',
            title: '真实手机陪看',
            desc: isMonitorScreenSharingActive()
                ? '浏览器屏幕共享已开启。桌宠每次生成气泡前会读取一帧画面，发送给支持视觉的聊天模型。'
                : '网页端只能通过系统弹窗授权屏幕共享；稳定 APK 版需要 Android MediaProjection。',
            status: isMonitorScreenSharingActive() ? '屏幕共享中' : '需要授权',
            action: isMonitorScreenSharingActive() ? '停止共享' : '授权屏幕',
            onclick: isMonitorScreenSharingActive() ? 'stopMonitorScreenShare()' : 'startMonitorScreenShare()'
        }
    };
    const item = configs[monitorActiveTool] || configs.internal;
    const petLibrary = monitorActiveTool === 'pet' ? renderMonitorPetLibrary() : '';
    const screenPanel = (monitorActiveTool === 'pet' || monitorActiveTool === 'phone') ? renderMonitorScreenSharePanel() : '';
    const actionControl = monitorActiveTool === 'pet'
        ? `
            <label class="monitor-tool-switch ${isMonitorPetEnabled() ? 'active' : ''}" title="${musicEscapeAttr(isMonitorPetEnabled() ? '关闭桌宠' : '开启桌宠')}">
                <input type="checkbox" ${isMonitorPetEnabled() ? 'checked' : ''} onchange="setMonitorPetEnabled(this.checked)">
                <span aria-hidden="true"></span>
                <b>${isMonitorPetEnabled() ? '已开' : '已关'}</b>
            </label>
        `
        : `<button type="button" onclick="${item.onclick}">${musicEscapeHtml(item.action)}</button>`;
    panel.dataset.tool = monitorActiveTool;
    panel.innerHTML = `
        <div class="monitor-tool-card">
            <div class="monitor-tool-icon"><i class="${item.icon}"></i></div>
            <div class="monitor-tool-copy">
                <span>${musicEscapeHtml(item.status)}</span>
                <strong>${musicEscapeHtml(item.title)}</strong>
                <p>${musicEscapeHtml(item.desc)}</p>
            </div>
            ${actionControl}
        </div>
        ${screenPanel}
        ${petLibrary}
    `;
    syncMonitorPetFloating();
}

function renderMonitorScreenSharePanel() {
    const active = isMonitorScreenSharingActive();
    const supported = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function');
    const intervalMs = getMonitorPetAutoObserveIntervalMs();
    const intervalSeconds = Math.round(intervalMs / 1000);
    const observeOptions = [
        { value: 0, label: '仅点击时观察' },
        { value: 60, label: '每 1 分钟' },
        { value: 120, label: '每 2 分钟（推荐）' },
        { value: 300, label: '每 5 分钟' },
        { value: 600, label: '每 10 分钟' }
    ];
    return `
        <div class="monitor-screen-panel ${active ? 'active' : ''}">
            <div class="monitor-screen-copy">
                <span>${active ? 'SCREEN LIVE' : (supported ? 'SCREEN PERMISSION' : 'WEB LIMITED')}</span>
                <strong>${active ? '真实屏幕已接入桌宠' : '授权后桌宠才能看见真实屏幕'}</strong>
                <p id="monitor-screen-status">${musicEscapeHtml(monitorScreenStatus)}</p>
            </div>
            <div class="monitor-screen-actions">
                <button type="button" onclick="${active ? 'captureMonitorScreenFrame()' : 'startMonitorScreenShare()'}">
                    <i class="${active ? 'ri-camera-lens-line' : 'ri-screen-share-line'}"></i>
                    <span>${active ? '读一帧' : '授权屏幕'}</span>
                </button>
                ${active ? '<button type="button" class="ghost" onclick="stopMonitorScreenShare()"><i class="ri-stop-circle-line"></i><span>停止</span></button>' : ''}
            </div>
            <div class="monitor-screen-observe">
                <label for="monitor-observe-interval"><i class="ri-timer-line"></i> 自动观察频率</label>
                <select id="monitor-observe-interval" onchange="setMonitorPetObserveInterval(this.value)">
                    ${observeOptions.map(opt => `<option value="${opt.value}" ${opt.value === intervalSeconds ? 'selected' : ''}>${opt.label}</option>`).join('')}
                </select>
                <small>${intervalSeconds > 0 ? '授权屏幕后，桌宠会按这个频率自己看一眼屏幕并搭话。' : '桌宠只在你点击它时才看一眼屏幕。'}</small>
            </div>
        </div>
    `;
}

function handleMonitorTool(tool) {
    monitorActiveTool = ['internal', 'island', 'pet', 'phone'].includes(tool) ? tool : 'internal';
    localStorage.setItem(MONITOR_ACTIVE_TOOL_KEY, monitorActiveTool);
    renderMonitorCharacters();
    if (monitorActiveTool === 'pet' && !monitorPetResults.length && !monitorPetLoading) {
        searchMonitorPets();
    }
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
    localStorage.setItem(MONITOR_PET_LIBRARY_KEY, JSON.stringify((Array.isArray(list) ? list : []).map(normalizeMonitorPet).filter(Boolean).slice(0, 80)));
}

function getActiveMonitorPetId() {
    return localStorage.getItem(MONITOR_ACTIVE_PET_KEY) || '';
}

function renderMonitorPetLibrary() {
    const saved = getMonitorPetLibrary();
    const activeId = getActiveMonitorPetId();
    const savedCards = saved.map(pet => renderMonitorPetCard(pet, true, activeId, true)).join('');
    const activePet = saved.find(pet => pet.id === activeId);
    const boundChar = getMonitorPetBoundChar();
    const petEnabled = isMonitorPetEnabled();
    const boundText = boundChar ? ` · 绑定 ${getMonitorCharName(boundChar)}` : ' · 未接入角色';
    const onlineContent = monitorPetLoading
        ? '<div class="monitor-pet-empty">正在加载素材...</div>'
        : renderMonitorPetOnlineContent(saved, activeId);
    return `
        <div class="monitor-pet-library">
            <div class="monitor-pet-active">
                <div class="monitor-pet-preview">${activePet ? `<img src="${musicEscapeAttr(getMonitorPetDisplayImage(activePet))}" alt="${musicEscapeAttr(activePet.displayName)}" onerror="this.remove()">` : '<i class="ri-bubble-chart-line"></i>'}</div>
                <div>
                    <span>当前桌宠素材</span>
                    <strong>${musicEscapeHtml(activePet ? activePet.displayName : '还没有应用素材')}</strong>
                    <p>${musicEscapeHtml(activePet ? (petEnabled ? `来自 ${activePet.source}${boundText}` : '桌宠已关闭，开启后会重新浮到页面上。') : '先搜索、下载，再应用到项目中。')}</p>
                </div>
                <label class="monitor-pet-enable ${petEnabled ? 'active' : ''}" title="${musicEscapeAttr(petEnabled ? '关闭桌宠' : '开启桌宠')}">
                    <input type="checkbox" ${petEnabled ? 'checked' : ''} onchange="setMonitorPetEnabled(this.checked)">
                    <span aria-hidden="true"></span>
                    <b>${petEnabled ? '已开' : '已关'}</b>
                </label>
            </div>
            <div class="monitor-pet-search">
                <input id="monitor-pet-search-input" type="search" value="${musicEscapeAttr(monitorPetQuery)}" placeholder="搜索素材" onkeydown="if(event.key==='Enter') searchMonitorPets(this.value, 1)">
                <button type="button" onclick="searchMonitorPets(document.getElementById('monitor-pet-search-input')?.value, 1)">${monitorPetLoading ? '<i class="ri-loader-4-line"></i>' : '<i class="ri-search-line"></i>'}</button>
            </div>
            <div class="monitor-pet-status">${musicEscapeHtml(monitorPetStatus || '可在项目内查看、下载并应用素材。')}</div>
            <div class="monitor-pet-gallery-head">
                <div class="monitor-pet-gallery-brand"><i class="ri-terminal-box-line"></i><strong>codex-pets</strong></div>
                ${renderMonitorPetTabButton('gallery', 'Gallery')}
                ${renderMonitorPetTabButton('collections', 'Collections')}
                ${renderMonitorPetTabButton('creators', 'Creators')}
            </div>
            <div class="monitor-pet-grid">${onlineContent}</div>
            ${renderMonitorPetPager()}
            <div class="monitor-pet-section-head"><strong>已下载</strong><span>${saved.length} 个</span></div>
            <div class="monitor-pet-grid">${savedCards || '<div class="monitor-pet-empty">下载后的素材会出现在这里。</div>'}</div>
        </div>
    `;
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
            if (!map.has(id)) map.set(id, { label: key, count: 0, cover: getMonitorPetDisplayImage(pet), views: 0 });
            const item = map.get(id);
            item.count += 1;
            item.views += Number(pet.viewCount || 0) || 0;
            if (!item.cover) item.cover = getMonitorPetDisplayImage(pet);
        });
    });
    const rows = Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 18);
    if (!rows.length) return '<div class="monitor-pet-empty">当前页还没有可聚合的合集。</div>';
    return rows.map(item => `
        <button type="button" class="monitor-pet-filter-card" onclick="openMonitorPetFilter(decodeURIComponent('${musicEscapeAttr(encodeURIComponent(item.label))}'))">
            <span>${item.cover ? `<img src="${musicEscapeAttr(item.cover)}" alt="${musicEscapeAttr(item.label)}" onerror="this.remove()">` : '<i class="ri-price-tag-3-line"></i>'}</span>
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
        if (!map.has(id)) map.set(id, { label: name, count: 0, cover: getMonitorPetDisplayImage(pet), likes: 0, comments: 0 });
        const item = map.get(id);
        item.count += 1;
        item.likes += Number(pet.likeCount || 0) || 0;
        item.comments += Number(pet.commentCount || 0) || 0;
        if (!item.cover) item.cover = getMonitorPetDisplayImage(pet);
    });
    const rows = Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 18);
    if (!rows.length) return '<div class="monitor-pet-empty">当前页还没有创作者信息。</div>';
    return rows.map(item => `
        <button type="button" class="monitor-pet-filter-card creator" onclick="openMonitorPetFilter(decodeURIComponent('${musicEscapeAttr(encodeURIComponent(item.label))}'))">
            <span>${item.cover ? `<img src="${musicEscapeAttr(item.cover)}" alt="${musicEscapeAttr(item.label)}" onerror="this.remove()">` : '<i class="ri-user-smile-line"></i>'}</span>
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

function renderMonitorPetCard(pet, saved, activeId, localOnly = false) {
    const image = getMonitorPetDisplayImage(pet);
    return `
        <article class="monitor-pet-card ${activeId === pet.id ? 'active' : ''}">
            <div class="monitor-pet-card-image">${image ? `<img src="${musicEscapeAttr(image)}" alt="${musicEscapeAttr(pet.displayName)}" loading="lazy" onerror="this.remove()">` : '<i class="ri-image-line"></i>'}</div>
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
                ${localOnly ? '' : `<button type="button" class="monitor-pet-action-btn" onclick="previewMonitorPet('${musicEscapeAttr(pet.id)}', this)">预览</button>`}
                <button type="button" class="monitor-pet-action-btn" onclick="${saved ? `applyMonitorPet('${musicEscapeAttr(pet.id)}', this)` : `downloadMonitorPet('${musicEscapeAttr(pet.id)}', this)`}">${activeId === pet.id ? '已应用' : (saved ? '应用' : '下载')}</button>
            </div>
        </article>
    `;
}

function updateMonitorPetStatus(text) {
    monitorPetStatus = String(text || '');
    const el = document.querySelector('.monitor-pet-status');
    if (el) el.textContent = monitorPetStatus;
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
    const activePet = getMonitorPetLibrary().find(pet => pet.id === getActiveMonitorPetId());
    renderMonitorPetFloat(activePet || null);
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
    const maxY = Math.max(8, host.clientHeight - height - 8);
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
        y: host.clientHeight - height - 30
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
    if (!pet || !isMonitorPetEnabled()) {
        if (node) node.remove();
        return;
    }
    if (!node) {
        node = document.createElement('div');
        node.className = 'monitor-pet-floating';
        host.appendChild(node);
    }
    const image = getMonitorPetDisplayImage(pet);
    const boundChar = getMonitorPetBoundChar();
    const petState = boundChar && boundChar.chatConfig ? (boundChar.chatConfig.monitorPetState || {}) : {};
    const pending = !!(petState && petState.pending);
    const characterMessage = String((petState && petState.bubbleText) || '').trim();
    const transientMessage = String(monitorPetFloatMessage || '').trim();
    const message = transientMessage || (pending ? '...' : characterMessage);
    const hasBubble = !!message;
    const boundName = boundChar ? getMonitorCharName(boundChar) : '';
    node.className = `monitor-pet-floating ${mode === 'preview' ? 'previewing' : ''} ${hasBubble ? 'has-bubble' : ''} ${pending ? 'thinking' : ''} pop`;
    node.dataset.boundChar = boundChar ? boundChar.id : '';
    node.innerHTML = `
        ${hasBubble ? `<div class="monitor-pet-floating-bubble">${pending ? '<span class="monitor-pet-thinking-text">...</span>' : musicEscapeHtml(message)}</div>` : ''}
        <button type="button" class="monitor-pet-floating-body" aria-label="${musicEscapeAttr(boundName ? `点击让 ${boundName} 说话` : '先接入角色再让桌宠说话')}" title="${musicEscapeAttr(boundName ? `绑定：${boundName}` : '未绑定角色')}">
            ${image ? `<img src="${musicEscapeAttr(image)}" alt="${musicEscapeAttr(pet.displayName)}" onerror="this.remove()">` : '<i class="ri-bubble-chart-line"></i>'}
        </button>
    `;
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
    if (!char) {
        updateMonitorPetStatus('先接入一个角色，桌宠才会按角色人设说话。');
        if (typeof showWechatToast === 'function') showWechatToast('先接入一个角色');
        return false;
    }
    if (typeof callChatApi !== 'function') {
        updateMonitorPetStatus('当前没有可用 API，桌宠无法生成角色气泡。');
        return false;
    }
    const now = Date.now();
    if (monitorPetAiBusy || now - monitorPetLastReactionAt < 2200) return false;
    monitorPetAiBusy = true;
    monitorPetLastReactionAt = now;
    const state = ensureMonitorPetState(char);
    state.pending = true;
    state.lastError = '';
    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    syncMonitorPetFloating();
    try {
        const screenImage = isMonitorScreenSharingActive()
            ? await captureMonitorScreenFrame().catch(() => '')
            : '';
        if (reason === 'observe' && !/^data:image\//i.test(String(screenImage || ''))) {
            return false;
        }
        const result = await callChatApi(buildMonitorPetReactionMessages(char, reason, screenImage), {
            max_tokens: screenImage ? 220 : 160,
            temperature: 0.82,
            background: true,
            backgroundPriority: 1
        });
        const text = normalizeMonitorPetReactionText(result && result.ok ? result.content : '');
        if (!text) {
            state.lastError = (result && result.error) || 'AI 返回了空内容';
            updateMonitorPetStatus(`${getMonitorCharName(char)} 暂时没有生成桌宠气泡：${state.lastError}`);
            return false;
        }
        state.bubbleText = text;
        state.bubbleAt = Date.now();
        state.lastError = '';
        monitorPetFloatMessage = '';
        updateMonitorPetStatus(`${getMonitorCharName(char)} 已更新桌宠气泡。`);
    } catch (e) {
        state.lastError = e && e.message ? e.message : String(e || '生成失败');
        updateMonitorPetStatus(`${getMonitorCharName(char)} 的桌宠气泡生成失败：${state.lastError}`);
    } finally {
        state.pending = false;
        monitorPetAiBusy = false;
        if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
        syncMonitorPetFloating();
    }
    return false;
}
window.requestMonitorPetReaction = requestMonitorPetReaction;

function getMonitorPetDisplayImage(pet) {
    if (!pet) return '';
    return pet.posterDataUrl || pet.posterUrl || pet.shareImageUrl || pet.previewUrl || '';
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
    const pet = monitorPetResults.find(item => item.id === petId) || getMonitorPetLibrary().find(item => item.id === petId);
    if (!pet) return false;
    updateMonitorPetStatus(`正在预览：${pet.displayName}`);
    setMonitorPetActionButton(button, 'done', '已预览');
    monitorPetFloatMessage = `预览 ${pet.displayName}`;
    renderMonitorPetFloat(pet, 'preview');
    const preview = document.querySelector('.monitor-pet-active');
    if (preview) {
        preview.classList.remove('is-previewing');
        void preview.offsetWidth;
        preview.classList.add('is-previewing');
        preview.innerHTML = `
            <div class="monitor-pet-preview">${getMonitorPetDisplayImage(pet) ? `<img src="${musicEscapeAttr(getMonitorPetDisplayImage(pet))}" alt="${musicEscapeAttr(pet.displayName)}" onerror="this.remove()">` : '<i class="ri-bubble-chart-line"></i>'}</div>
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
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MONITOR_PET_DB_STORE, 'readwrite');
        tx.objectStore(MONITOR_PET_DB_STORE).put(value, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function monitorBlobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

async function fetchMonitorPetDataUrl(url) {
    const resp = await fetch(toMonitorPetFetchUrl(url), { cache: 'no-store' });
    if (!resp.ok) throw new Error(`下载失败 ${resp.status}`);
    return monitorBlobToDataUrl(await resp.blob());
}

async function downloadMonitorPet(petId, button) {
    const pet = monitorPetResults.find(item => item.id === petId);
    if (!pet) return false;
    updateMonitorPetStatus(`正在下载 ${pet.displayName}...`);
    setMonitorPetActionButton(button, 'loading', '下载中');
    try {
        const posterSource = pet.posterUrl || pet.shareImageUrl || pet.previewUrl;
        const posterDataUrl = posterSource ? await fetchMonitorPetDataUrl(posterSource) : '';
        const zipDataUrl = pet.downloadUrl ? await fetchMonitorPetDataUrl(pet.downloadUrl) : '';
        await saveMonitorPetAsset(`${pet.id}:zip`, zipDataUrl);
        const library = getMonitorPetLibrary().filter(item => item.id !== pet.id);
        library.unshift({ ...pet, posterDataUrl, savedAt: Date.now() });
        saveMonitorPetLibrary(library);
        monitorPetFloatMessage = `下载完成`;
        renderMonitorPetFloat({ ...pet, posterDataUrl }, 'preview');
        updateMonitorPetStatus(`已下载 ${pet.displayName}，可以应用到项目中。`);
        setMonitorPetActionButton(button, 'done', '已下载');
    } catch (e) {
        updateMonitorPetStatus(`下载失败：${e.message || e}`);
        if (button) {
            button.disabled = false;
            button.classList.remove('loading');
            button.textContent = button.dataset.originalText || '下载';
        }
    } finally {
        setTimeout(() => {
            monitorPetFloatMessage = '';
            renderMonitorCharacters();
        }, 420);
    }
    return false;
}
window.downloadMonitorPet = downloadMonitorPet;

function applyMonitorPet(petId, button) {
    const pet = getMonitorPetLibrary().find(item => item.id === petId);
    if (!pet) return false;
    setMonitorPetActionButton(button, 'loading', '应用中');
    localStorage.setItem(MONITOR_ACTIVE_PET_KEY, pet.id);
    localStorage.setItem(MONITOR_PET_ENABLED_KEY, '1');
    monitorPetFloatMessage = '';
    updateMonitorPetStatus(`已应用 ${pet.displayName}，桌宠已浮到页面上。`);
    renderMonitorPetFloat(pet, 'apply');
    setMonitorPetActionButton(button, 'done', '已应用');
    setTimeout(() => {
        monitorPetFloatMessage = '';
        renderMonitorCharacters();
    }, 520);
    setTimeout(() => requestMonitorPetReaction('apply'), 80);
    if (typeof showWechatToast === 'function') showWechatToast(`已应用桌宠素材：${pet.displayName}`);
    return false;
}
window.applyMonitorPet = applyMonitorPet;

function updateMonitorSpeedPreview(input) {
    const label = input && input.closest('label');
    const text = label && label.querySelector('span');
    if (text) text.textContent = `弹幕 ${getMonitorSpeedText(input.value)}`;
}
window.updateMonitorSpeedPreview = updateMonitorSpeedPreview;

function renderMonitorCharacters() {
    const list = document.getElementById('monitor-char-list');
    const status = document.getElementById('monitor-status');
    if (!list) return;
    const chars = getMonitorCharacters();
    renderMonitorOverview(chars);
    if (status) status.textContent = getMonitorStatusText(chars);
    if (!chars.length) {
        list.innerHTML = `
            <div class="monitor-empty">
                <i class="ri-user-search-line"></i>
                <strong>还没有角色</strong>
                <span>先在微信里导入角色卡，再回来选择谁接入监控剧情。</span>
            </div>
        `;
        return;
    }
    list.innerHTML = chars.map(char => {
        const enabled = !!(char.chatConfig && char.chatConfig.monitorEnabled);
        const mode = getMonitorMode(char);
        const speed = normalizeMonitorBarrageSpeed(char.chatConfig && char.chatConfig.monitorBarrageSpeed);
        const state = (char.chatConfig && char.chatConfig.monitorState) || {};
        const lastLevel = state.lastLevel ? `上次强度：${state.lastLevel}` : '等待下一条 BYND 内部消息';
        const modeLabel = mode === 'observer' ? '第三方吐槽' : '角色本人';
        const lastError = state.lastError ? `<small class="monitor-error">${musicEscapeHtml(state.lastError)}</small>` : '';
        return `
            <article class="monitor-char-card ${enabled ? 'active' : ''}" data-mode="${mode}">
                <div class="monitor-char-avatar">
                    <img src="${musicEscapeAttr(char.avatar || window.DEFAULT_AVATAR || '')}" alt="${musicEscapeAttr(getMonitorCharName(char))}" onerror="this.src=window.DEFAULT_AVATAR || ''">
                </div>
                <div class="monitor-char-main">
                    <div class="monitor-char-title">
                        <strong>${musicEscapeHtml(getMonitorCharName(char))}</strong>
                        <span>${enabled ? 'ON AIR' : 'STANDBY'}</span>
                    </div>
                    <p>${musicEscapeHtml(getMonitorRecentSummary(char))}</p>
                    <em>${musicEscapeHtml(modeLabel)} · ${musicEscapeHtml(lastLevel)}</em>
                    <div class="monitor-char-config">
                        <select onchange="setMonitorWatcherMode('${musicEscapeAttr(char.id)}', this.value)">
                            <option value="persona" ${mode === 'persona' ? 'selected' : ''}>角色本人</option>
                            <option value="observer" ${mode === 'observer' ? 'selected' : ''}>第三方吐槽</option>
                        </select>
                        <label>
                            <span>弹幕 ${musicEscapeHtml(getMonitorSpeedText(speed))}</span>
                            <input type="range" min="0.7" max="1.6" step="0.1" value="${speed}" oninput="updateMonitorSpeedPreview(this)" onchange="setMonitorWatcherSpeed('${musicEscapeAttr(char.id)}', this.value)">
                        </label>
                    </div>
                    ${lastError}
                </div>
                <div class="monitor-char-actions">
                    <button type="button" class="${enabled ? 'danger' : ''}" onclick="toggleMonitorWatcher('${musicEscapeAttr(char.id)}')">
                        <i class="${enabled ? 'ri-link-unlink-m' : 'ri-link-m'}"></i><span>${enabled ? '解除' : '接入'}</span>
                    </button>
                    <button type="button" class="ghost" onclick="refreshMonitorWatcher('${musicEscapeAttr(char.id)}')">
                        <i class="ri-refresh-line"></i><span>更新</span>
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

function initMonitorApp() {
    renderMonitorCharacters();
    if (monitorActiveTool === 'pet' && !monitorPetResults.length && !monitorPetLoading) {
        searchMonitorPets();
    }
}
window.initMonitorApp = initMonitorApp;

function refreshMonitorApp() {
    getMonitorCharacters().forEach(char => {
        char.chatConfig = char.chatConfig || {};
        if (char.chatConfig.monitorMode === 'god' || char.chatConfig.monitorMode === 'cp') {
            char.chatConfig.monitorMode = 'observer';
        }
        char.chatConfig.monitorState = char.chatConfig.monitorState || {};
        char.chatConfig.monitorState.lastError = '';
        char.chatConfig.monitorState.lastRefreshedAt = Date.now();
    });
    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    renderMonitorCharacters();
    if (typeof showWechatToast === 'function') showWechatToast('监控状态已更新');
}
window.refreshMonitorApp = refreshMonitorApp;

function refreshMonitorWatcher(charId) {
    const char = getMonitorCharacters().find(item => item.id === charId);
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    if (char.chatConfig.monitorMode === 'god' || char.chatConfig.monitorMode === 'cp') {
        char.chatConfig.monitorMode = 'observer';
    }
    char.chatConfig.monitorState = char.chatConfig.monitorState || {};
    char.chatConfig.monitorState.lastError = '';
    char.chatConfig.monitorState.lastRefreshedAt = Date.now();
    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    renderMonitorCharacters();
    if (typeof showWechatToast === 'function') showWechatToast(`${getMonitorCharName(char)} 的监控状态已更新`);
}
window.refreshMonitorWatcher = refreshMonitorWatcher;

function setMonitorWatcherMode(charId, mode) {
    const char = getMonitorCharacters().find(item => item.id === charId);
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.monitorMode = mode === 'observer' ? 'observer' : 'persona';
    char.chatConfig.monitorState = char.chatConfig.monitorState || {};
    char.chatConfig.monitorState.lastError = '';
    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    renderMonitorCharacters();
    if (typeof showWechatToast === 'function') showWechatToast(`${getMonitorCharName(char)} 已切换监控视角`);
}
window.setMonitorWatcherMode = setMonitorWatcherMode;

function setMonitorWatcherSpeed(charId, value) {
    const char = getMonitorCharacters().find(item => item.id === charId);
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.monitorBarrageSpeed = normalizeMonitorBarrageSpeed(value);
    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    renderMonitorCharacters();
}
window.setMonitorWatcherSpeed = setMonitorWatcherSpeed;

function toggleMonitorWatcher(charId) {
    const char = getMonitorCharacters().find(item => item.id === charId);
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.monitorEnabled = !char.chatConfig.monitorEnabled;
    char.chatConfig.monitorState = char.chatConfig.monitorState || {};
    char.chatConfig.monitorState.lastError = '';
    if (char.chatConfig.monitorEnabled) {
        setMonitorPetBoundChar(char.id);
    } else if (localStorage.getItem(MONITOR_PET_BOUND_CHAR_KEY) === char.id) {
        const next = getMonitorCharacters().find(item => item.id !== char.id && item.chatConfig && item.chatConfig.monitorEnabled);
        setMonitorPetBoundChar(next ? next.id : '');
    }
    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    renderMonitorCharacters();
    syncMonitorPetFloating();
    const name = getMonitorCharName(char);
    const text = char.chatConfig.monitorEnabled
        ? `${name} 已接入 BYND 内部监控剧情`
        : `已解除 ${name} 的监控剧情`;
    if (typeof showWechatToast === 'function') showWechatToast(text);
}
window.toggleMonitorWatcher = toggleMonitorWatcher;

// --- BYND Outing / 一起出门 ---
const OUTING_STATE_KEY = 'bynd_outing_date_state_v1';
const OUTING_WAKE_DISTANCE_M = 500;
const OUTING_WAKE_COOLDOWN_MS = 30 * 1000;
let outingWatchId = null;

function getOutingCharacters() {
    return Array.isArray(window.myCharacters)
        ? window.myCharacters.filter(char => char && char.id && !char.isGroupChat)
        : [];
}

function getOutingCharName(char) {
    if (typeof getWechatCharDisplayName === 'function') return getWechatCharDisplayName(char);
    return (char && char.chatConfig && char.chatConfig.nickname) || (char && char.name) || '未命名';
}

function getOutingState() {
    try {
        const state = JSON.parse(localStorage.getItem(OUTING_STATE_KEY) || '{}');
        return state && typeof state === 'object' ? state : {};
    } catch (_) {
        return {};
    }
}

function saveOutingState(state) {
    const safe = {
        ...(state || {}),
        trail: Array.isArray(state?.trail) ? state.trail.slice(-60) : []
    };
    localStorage.setItem(OUTING_STATE_KEY, JSON.stringify(safe));
}

function getOutingSelectedChar() {
    const state = getOutingState();
    const selectValue = document.getElementById('outing-char-select')?.value || '';
    const charId = selectValue || state.charId || '';
    return getOutingCharacters().find(char => char.id === charId) || getOutingCharacters()[0] || null;
}

function setOutingStatus(text, tone = '') {
    const el = document.getElementById('outing-location-text');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.tone = tone || '';
}

function formatOutingTime(ts = Date.now()) {
    const date = new Date(ts);
    const safe = Number.isNaN(date.getTime()) ? new Date() : date;
    return `${String(safe.getHours()).padStart(2, '0')}:${String(safe.getMinutes()).padStart(2, '0')}`;
}

function formatOutingPoint(point) {
    if (!point) return '未知位置';
    return `${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`;
}

function getOutingDistanceMeters(a, b) {
    if (!a || !b) return 0;
    const toRad = value => Number(value || 0) * Math.PI / 180;
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function addOutingTrail(kind, text, point = null) {
    const state = getOutingState();
    const entry = {
        id: `outing_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
        kind,
        text: String(text || '').slice(0, 180),
        point,
        createdAt: Date.now()
    };
    state.trail = Array.isArray(state.trail) ? state.trail : [];
    state.trail.push(entry);
    saveOutingState(state);
    renderOutingApp();
    return entry;
}

function appendOutingMessageToChar(char, msg, options = {}) {
    if (!char) return false;
    char.history = Array.isArray(char.history) ? char.history : [];
    const nextMsg = {
        ...(msg || {}),
        isMe: true,
        timestamp: msg && msg.timestamp ? msg.timestamp : (typeof createMessageTimestamp === 'function' ? createMessageTimestamp() : new Date().toISOString())
    };
    if (typeof syncWechatMessageDescription === 'function') syncWechatMessageDescription(nextMsg);
    char.history.push(nextMsg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    if (typeof notifyWechatMonitors === 'function') notifyWechatMonitors(char, nextMsg);
    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    if (typeof renderChatList === 'function') renderChatList();
    if (window.currentChatCharId === char.id && typeof refreshChatView === 'function') refreshChatView(char);
    if (options.autoReply && typeof queueWechatAutoReplyToChar === 'function') queueWechatAutoReplyToChar(char.id, 0, { background: window.currentChatCharId !== char.id });
    return true;
}

function buildOutingLocationMessage(point, distanceText, reason) {
    const lines = [
        '【一起出门】',
        reason || '我更新了真实 GPS 位置。',
        `当前位置：${formatOutingPoint(point)}`,
        point && Number.isFinite(Number(point.accuracy)) ? `定位精度：约 ${Math.round(point.accuracy)} 米` : '',
        distanceText ? `移动距离：${distanceText}` : '',
        '你可以按人设看看我现在可能去了哪里、在附近会看到什么，也可以主动问我拍张照片给你。'
    ].filter(Boolean);
    return lines.join('\n');
}

function wakeOutingChar(point, distance, reason = '') {
    const char = getOutingSelectedChar();
    if (!char) return;
    const state = getOutingState();
    const distanceText = distance ? `${Math.round(distance)} 米` : '';
    appendOutingMessageToChar(char, {
        type: 'text',
        content: buildOutingLocationMessage(point, distanceText, reason || `我已经移动了 ${distanceText || '一段距离'}，一起出门自动叫醒你。`)
    }, { autoReply: true });
    state.lastWakePoint = point;
    state.lastWakeAt = Date.now();
    state.wakeCount = Number(state.wakeCount || 0) + 1;
    saveOutingState(state);
    addOutingTrail('wake', `已叫醒 ${getOutingCharName(char)}${distanceText ? ` · ${distanceText}` : ''}`, point);
}

function handleOutingPosition(pos, options = {}) {
    const coords = pos && pos.coords;
    if (!coords) return;
    const point = {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        ts: Date.now()
    };
    const state = getOutingState();
    const previous = state.currentPoint || null;
    state.currentPoint = point;
    state.trail = Array.isArray(state.trail) ? state.trail : [];
    if (!previous || getOutingDistanceMeters(previous, point) >= 30 || options.manual) {
        state.trail.push({
            id: `outing_loc_${Date.now()}`,
            kind: options.manual ? 'refresh' : 'location',
            text: options.manual ? '手动刷新定位' : '定位已更新',
            point,
            createdAt: Date.now()
        });
    }
    const active = !!state.active;
    const lastWakePoint = state.lastWakePoint || null;
    const distance = lastWakePoint ? getOutingDistanceMeters(lastWakePoint, point) : 0;
    const canWake = active
        && (!lastWakePoint || distance >= OUTING_WAKE_DISTANCE_M)
        && (!state.lastWakeAt || Date.now() - state.lastWakeAt >= OUTING_WAKE_COOLDOWN_MS);
    saveOutingState(state);
    renderOutingApp();
    if (canWake) {
        wakeOutingChar(point, distance, lastWakePoint ? '' : '我开启了一起出门，这是第一次同步真实 GPS 位置。');
    }
}

function handleOutingLocationError(err) {
    const msg = err && err.message ? err.message : '定位权限未允许或当前设备无法获取 GPS。';
    setOutingStatus(`定位失败：${msg}`, 'error');
    if (typeof showWechatToast === 'function') showWechatToast('定位失败：' + msg);
}

function startOutingWatcher() {
    if (outingWatchId != null) return;
    if (!navigator.geolocation) {
        setOutingStatus('当前浏览器不支持 GPS 定位。', 'error');
        return;
    }
    outingWatchId = navigator.geolocation.watchPosition(
        pos => handleOutingPosition(pos),
        handleOutingLocationError,
        { enableHighAccuracy: true, maximumAge: 12000, timeout: 22000 }
    );
}

function stopOutingWatcher() {
    if (outingWatchId == null || !navigator.geolocation) return;
    navigator.geolocation.clearWatch(outingWatchId);
    outingWatchId = null;
}

function renderOutingCharacters() {
    const select = document.getElementById('outing-char-select');
    if (!select) return;
    const trigger = document.getElementById('outing-char-trigger');
    const triggerName = document.getElementById('outing-char-trigger-name');
    const menu = document.getElementById('outing-char-menu');
    const chars = getOutingCharacters();
    const state = getOutingState();
    const previous = select.value || state.charId || '';
    select.innerHTML = chars.length
        ? chars.map(char => `<option value="${musicEscapeAttr(char.id)}">${musicEscapeHtml(getOutingCharName(char))}</option>`).join('')
        : '<option value="">先导入角色卡</option>';
    if (previous && chars.some(char => char.id === previous)) select.value = previous;
    else if (chars[0]) select.value = chars[0].id;
    const selected = chars.find(char => char.id === select.value) || null;
    if (triggerName) triggerName.textContent = selected ? getOutingCharName(selected) : '先导入角色卡';
    if (trigger) {
        trigger.disabled = !chars.length;
        trigger.setAttribute('aria-expanded', 'false');
    }
    if (menu) {
        menu.classList.add('hidden');
        menu.innerHTML = chars.length ? chars.map(char => {
            const active = char.id === select.value;
            const avatar = musicEscapeAttr(char.avatar || DEFAULT_AVATAR || '');
            const name = musicEscapeHtml(getOutingCharName(char));
            return `
                <button type="button" class="${active ? 'active' : ''}" role="option" aria-selected="${active ? 'true' : 'false'}" onclick="selectOutingChar(${quoteWechatJsString(char.id)})">
                    <img src="${avatar}" alt="" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR || '')}'">
                    <span>${name}</span>
                    <i class="${active ? 'ri-check-line' : 'ri-user-heart-line'}"></i>
                </button>
            `;
        }).join('') : '<div class="outing-select-empty">先导入角色卡</div>';
    }
    select.onchange = () => {
        const next = getOutingState();
        next.charId = select.value;
        next.lastWakePoint = null;
        next.wakeCount = 0;
        saveOutingState(next);
        renderOutingApp();
    };
}

function closeOutingCharMenu() {
    const trigger = document.getElementById('outing-char-trigger');
    const menu = document.getElementById('outing-char-menu');
    if (menu) menu.classList.add('hidden');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
}
window.closeOutingCharMenu = closeOutingCharMenu;

function toggleOutingCharMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('outing-char-menu');
    const trigger = document.getElementById('outing-char-trigger');
    if (!menu || !trigger || trigger.disabled) return;
    const open = menu.classList.toggle('hidden');
    trigger.setAttribute('aria-expanded', open ? 'false' : 'true');
}
window.toggleOutingCharMenu = toggleOutingCharMenu;

function selectOutingChar(charId) {
    const select = document.getElementById('outing-char-select');
    if (!select) return;
    select.value = charId;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    closeOutingCharMenu();
}
window.selectOutingChar = selectOutingChar;

document.addEventListener('click', event => {
    if (!event.target?.closest?.('#outing-char-picker')) closeOutingCharMenu();
});

function renderOutingApp() {
    const state = getOutingState();
    const chars = getOutingCharacters();
    const selected = getOutingSelectedChar();
    const active = !!state.active;
    const current = state.currentPoint || null;
    const lastWake = state.lastWakePoint || null;
    const distance = current && lastWake ? getOutingDistanceMeters(lastWake, current) : 0;
    const activeName = document.getElementById('outing-active-name');
    const modeLabel = document.getElementById('outing-mode-label');
    const toggleBtn = document.getElementById('outing-toggle-btn');
    const distanceEl = document.getElementById('outing-distance');
    const wakeEl = document.getElementById('outing-wake-count');
    const accuracyEl = document.getElementById('outing-accuracy');
    const photoCard = document.getElementById('outing-photo-card');
    const photoTime = document.getElementById('outing-photo-time');
    const logList = document.getElementById('outing-log-list');

    if (activeName) activeName.textContent = selected ? `${getOutingCharName(selected)} 正在和你出门` : '先导入角色卡';
    if (modeLabel) modeLabel.textContent = active ? 'BEYOND SCREEN ON' : 'OFFLINE';
    if (toggleBtn) {
        toggleBtn.classList.toggle('active', active);
        toggleBtn.innerHTML = active
            ? '<i class="ri-pause-circle-line"></i><span>关闭</span>'
            : '<i class="ri-map-pin-line"></i><span>开启</span>';
    }
    if (distanceEl) distanceEl.textContent = current && lastWake ? `${Math.round(distance)}m` : '--';
    if (wakeEl) wakeEl.textContent = String(Number(state.wakeCount || 0));
    if (accuracyEl) accuracyEl.textContent = current && Number.isFinite(Number(current.accuracy)) ? `±${Math.round(current.accuracy)}m` : '--';
    if (photoCard) {
        const image = String(state.lastPhoto || '');
        photoCard.classList.toggle('has-photo', !!image);
        const visual = photoCard.querySelector('div');
        if (visual) visual.innerHTML = image ? `<img src="${musicEscapeAttr(image)}" alt="outing photo">` : '<i class="ri-camera-lens-line"></i>';
        if (photoTime) photoTime.textContent = state.lastPhotoAt ? formatOutingTime(state.lastPhotoAt) : '还没有照片';
    }
    if (!chars.length) {
        setOutingStatus('还没有可一起出门的角色。', 'warn');
    } else if (current) {
        setOutingStatus(`GPS：${formatOutingPoint(current)}${active ? '。移动 500 米后会自动叫醒角色。' : '。开启后开始自动叫醒。'}`);
    } else {
        setOutingStatus(active ? '正在等待真实 GPS 定位授权...' : '开启后，每移动 500 米会自动叫醒角色。');
    }
    if (logList) {
        const trail = Array.isArray(state.trail) ? state.trail.slice(-12).reverse() : [];
        logList.innerHTML = trail.length ? trail.map(entry => `
            <div class="outing-log-row">
                <i class="${entry.kind === 'photo' ? 'ri-camera-line' : entry.kind === 'wake' ? 'ri-alarm-warning-line' : 'ri-map-pin-line'}"></i>
                <span>${musicEscapeHtml(entry.text || '')}</span>
                <em>${musicEscapeHtml(formatOutingTime(entry.createdAt))}</em>
            </div>
        `).join('') : '<div class="outing-empty">还没有出门轨迹</div>';
    }
}

function initOutingApp() {
    renderOutingCharacters();
    renderOutingApp();
    if (getOutingState().active) startOutingWatcher();
}
window.initOutingApp = initOutingApp;

function initOutingAppRuntime() {
    if (getOutingState().active) {
        setTimeout(() => startOutingWatcher(), 800);
    }
}
window.initOutingAppRuntime = initOutingAppRuntime;

function toggleOutingDateMode() {
    const char = getOutingSelectedChar();
    if (!char) {
        if (typeof showWechatToast === 'function') showWechatToast('先导入角色卡');
        return;
    }
    const state = getOutingState();
    state.charId = char.id;
    state.active = !state.active;
    if (!state.active) {
        stopOutingWatcher();
        saveOutingState(state);
        addOutingTrail('stop', `已关闭和 ${getOutingCharName(char)} 的一起出门`, state.currentPoint || null);
        return;
    }
    state.lastWakePoint = null;
    state.lastWakeAt = 0;
    state.wakeCount = 0;
    saveOutingState(state);
    addOutingTrail('start', `已开启和 ${getOutingCharName(char)} 的一起出门`, state.currentPoint || null);
    startOutingWatcher();
    refreshOutingLocation();
}
window.toggleOutingDateMode = toggleOutingDateMode;

function refreshOutingLocation() {
    if (!navigator.geolocation) {
        setOutingStatus('当前浏览器不支持 GPS 定位。', 'error');
        return;
    }
    setOutingStatus('正在获取真实 GPS 定位...', 'busy');
    navigator.geolocation.getCurrentPosition(
        pos => handleOutingPosition(pos, { manual: true }),
        handleOutingLocationError,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 22000 }
    );
}
window.refreshOutingLocation = refreshOutingLocation;

function captureOutingPhoto() {
    const char = getOutingSelectedChar();
    if (!char) {
        if (typeof showWechatToast === 'function') showWechatToast('先导入角色卡');
        return;
    }
    document.getElementById('outing-camera-input')?.click();
}
window.captureOutingPhoto = captureOutingPhoto;

function readOutingImageFile(file, maxWidth = 1280, quality = 0.78) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('照片读取失败'));
        reader.onload = () => {
            const raw = reader.result;
            const img = new Image();
            img.onerror = () => resolve(raw);
            img.onload = () => {
                const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
                const width = Math.max(1, Math.round(img.width * scale));
                const height = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = raw;
        };
        reader.readAsDataURL(file);
    });
}

async function handleOutingPhotoInput(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const char = getOutingSelectedChar();
    if (!char) return;
    try {
        setOutingStatus('正在压缩照片并发送给角色...', 'busy');
        const dataUrl = await readOutingImageFile(file);
        const state = getOutingState();
        state.lastPhoto = dataUrl;
        state.lastPhotoAt = Date.now();
        saveOutingState(state);
        const point = state.currentPoint || null;
        const description = [
            '【一起出门照片】我刚刚用真实手机拍/选了一张照片给你看。',
            point ? `拍摄时 GPS：${formatOutingPoint(point)}` : '',
            point && Number.isFinite(Number(point.accuracy)) ? `定位精度：约 ${Math.round(point.accuracy)} 米` : '',
            '请直接观察照片内容，并按你的人设和我们的关系自然评论。'
        ].filter(Boolean).join('\n');
        appendOutingMessageToChar(char, {
            type: 'image',
            content: dataUrl,
            imageUrl: dataUrl,
            description
        }, { autoReply: true });
        addOutingTrail('photo', `已把照片发给 ${getOutingCharName(char)}`, point);
        renderOutingApp();
        if (typeof showWechatToast === 'function') showWechatToast('照片已发给角色');
    } catch (e) {
        setOutingStatus(`照片发送失败：${e.message || e}`, 'error');
    } finally {
        if (input) input.value = '';
    }
}
window.handleOutingPhotoInput = handleOutingPhotoInput;

function clearOutingTrail() {
    const state = getOutingState();
    state.trail = [];
    saveOutingState(state);
    renderOutingApp();
}
window.clearOutingTrail = clearOutingTrail;

// --- Game App / 小游戏大厅 + 狼人杀 ---
const GAME_STATE_KEY = 'bynd_game_wolfcha_state_v1';
const GAME_ACTIVE_KEY = 'bynd_game_active_v1';
const WOLFCHA_SETUP_KEY = 'bynd_game_wolfcha_setup_v1';
const WOLFCHA_ENTRY_KEY = 'bynd_game_wolfcha_entry_v1';
const GAME_HUB_FILTER_KEY = 'bynd_game_hub_filter_v1';
const SYNC_GAME_CHAR_KEY = 'bynd_game_sync_char_v1';
const SYNC_GAME_STATE_KEY = 'bynd_game_sync_state_v2';
const CARDMATCH_RULES_SKIP_KEY = 'bynd_game_cardmatch_rules_skip_date_v1';
const ACTING_GAME_STATE_KEY = 'bynd_game_acting_state_v1';
const GAME_2048_STATE_KEY = 'bynd_game_2048_state_v1';
const CATPOT_STATE_KEY = 'bynd_game_catpot_state_v5';
const CATPOT_ROUND_MS = 90000;
const CATPOT_CUSTOMER_PATIENCE_MS = 22000;
const CATPOT_CUSTOMER_COUNT = 3;
const CATPOT_TARGET_CUSTOMERS = 18;
const JUMP_GAME_STATE_KEY = 'bynd_game_jump_state_v1';
const JUMP_GAME_BEST_KEY = 'bynd_game_jump_best_v1';
const WATER_SORT_STATE_KEY = 'bynd_game_water_sort_state_v1';
const WATER_SORT_BEST_LEVEL_KEY = 'bynd_game_water_sort_best_level_v1';
const GOMOKU_STATE_KEY = 'bynd_game_gomoku_state_v1';
const BOARD_GAME_STATE_PREFIX = 'bynd_game_board_state_';
const BOARD_GAME_CHAR_KEY_PREFIX = 'bynd_game_board_char_';
const BOARD_GAME_READY_KEY_PREFIX = 'bynd_game_board_ready_';
const BOARD_GAME_CHAT_KEY_PREFIX = 'bynd_game_board_chat_';
const BOARD_GAME_FIRST_KEY_PREFIX = 'bynd_game_board_first_';
const BOARD_GAME_COMMENT_RATE_KEY_PREFIX = 'bynd_game_board_comment_rate_';
const BOARD_GAME_AUTO_TIMERS = {};
const BOARD_GAME_AUTO_COMMENT_EVERY_MOVES = 4;
const BOARD_GAME_AUTO_COMMENT_COOLDOWN_MS = 90 * 1000;
const BOARD_GAME_MANUAL_COMMENT_COOLDOWN_MS = 30 * 1000;
const BOARD_GAME_RATE_LIMIT_PAUSE_MS = 5 * 60 * 1000;
const GOMOKU_BOARD_SIZE = 15;
const GOMOKU_DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const GAME_ROLES = ['狼人', '预言家', '女巫', '守卫', '村民', '村民', '村民', '村民', '村民', '猎人'];
const CATPOT_INGREDIENTS = [
    { id: 'egg', name: '笑脸煎蛋', asset: 'assets/cat-breakfast-pot/food/egg.png', color: '#ffd95f' },
    { id: 'youtiao', name: '软乎油条', asset: 'assets/cat-breakfast-pot/food/youtiao.png', color: '#e8a94b' },
    { id: 'pawball', name: '猫爪包子', asset: 'assets/cat-breakfast-pot/food/pawball-direct-v11.png', color: '#ffb7c5' },
    { id: 'fish', name: '小鱼干', asset: 'assets/cat-breakfast-pot/food/fish.png', color: '#9db7c9' },
    { id: 'scallion', name: '迷你葱芽', asset: 'assets/cat-breakfast-pot/food/scallion.png', color: '#8edb82' },
    { id: 'carrot', name: '爱心胡萝卜', asset: 'assets/cat-breakfast-pot/food/carrot.png', color: '#ff985d' },
    { id: 'tofu', name: '星星豆腐', asset: 'assets/cat-breakfast-pot/food/tofu.png', color: '#ffe8a8' }
];
const CATPOT_CATS = [
    { cat: '橘子猫', mood: '想要暖暖早餐' },
    { cat: '奶盖猫', mood: '今天要软乎乎' },
    { cat: '花花猫', mood: '喜欢彩色摆盘' },
    { cat: '小围裙猫', mood: '想吃招牌早餐锅' },
    { cat: '三花猫', mood: '想要可爱一点' },
    { cat: '黑糖猫', mood: '肚子咕噜咕噜' }
];
const GAME_LIBRARY = [
    { id: 'wolfcha', title: 'BYND 狼人杀', tag: '多人推理', icon: 'ri-shield-star-fill', genre: 'Social deduction', category: 'role', accent: '#e5484d', desc: '先选择陪玩的角色，再随机身份开局。角色会按人设参与发言。' },
    { id: 'acting', title: '谁是演技派', tag: '沉浸剧本', icon: 'ri-movie-2-line', genre: 'Script roleplay', category: 'role', accent: '#c99b5d', desc: '选择角色，AI 生成非俗套剧本和你的报纸档案，旁白推动剧情。' },
    { id: 'chicken', title: '肥鸡大冒险', tag: '像素飞行', icon: 'ri-flight-takeoff-line', genre: 'Tap arcade', category: 'arcade', accent: '#22b8ff', desc: '点击让小角色飞起来，穿过砖墙空隙，吃金币刷新纪录。' },
    { id: 'catpot', title: '猫猫早餐锅', tag: '治愈摆盘', icon: 'ri-restaurant-2-line', genre: 'Cute cooking', category: 'arcade', accent: '#ff9f6e', desc: '按猫猫订单把煎蛋、油条和猫爪包子放进早餐锅，完成后会有啵啵反馈。' },
    { id: 'jump', title: '跳一跳', tag: '蓄力跳跃', icon: 'ri-arrow-up-circle-line', genre: 'Timing arcade', category: 'arcade', accent: '#111318', desc: '按住蓄力，松手跳到下一块平台，力度越准分数越高。' },
    { id: 'watersort', title: '倒水排序', tag: '颜色解谜', icon: 'ri-goblet-line', genre: 'Water Sort', category: 'board', accent: '#2f80ed', desc: '把同色水倒到一起，每个瓶子只能装同一种颜色。' },
    { id: '2048', title: '2048', tag: '数字合成', icon: 'ri-layout-grid-fill', genre: 'Number puzzle', category: 'board', accent: '#ffb02e', desc: '上下左右推动方块，合成更高数字，随时可重新开局。' },
    { id: 'gomoku', title: '五子棋', tag: '双人落子', icon: 'ri-grid-line', genre: 'Board duel', category: 'board', accent: '#111318', desc: '黑白双方轮流落子，任意方向先连成五子获胜。' },
    { id: 'chess', title: '国际象棋', tag: '棋盘对弈', icon: 'ri-vip-crown-2-line', genre: 'Classic board', category: 'board', accent: '#7c5cff', desc: '轻量棋盘模式，可选择棋子并移动，先用于角色共玩流程。' },
    { id: 'xiangqi', title: '中国象棋', tag: '楚河汉界', icon: 'ri-shield-cross-line', genre: 'Classic board', category: 'board', accent: '#d94b3d', desc: '九路十行棋盘，可选择棋子移动，后续可继续补完整规则。' },
    { id: 'sync', title: '默契问答', tag: 'AI互动', icon: 'ri-chat-smile-3-line', genre: 'Co-op talk', category: 'role', accent: '#5b7cfa', desc: '裁判出题，你和角色分别作答，再判定默契度。' },
    { id: 'cardmatch', title: '语言翻牌', tag: '学习联动', icon: 'ri-flashlight-line', genre: 'Study arcade', category: 'study', accent: '#34a853', desc: '用学习卡做小游戏，随机抽一张多语言卡来回忆。' },
    { id: 'coming-board', title: '桌游房间', tag: '即将开放', icon: 'ri-dice-5-line', genre: 'Board games', category: 'role', accent: '#ff9f0a', desc: '预留给真心话、抽卡、跑团类玩法，后续接入角色列表。', comingSoon: true },
    { id: 'coming-puzzle', title: '解谜档案', tag: '即将开放', icon: 'ri-folder-shield-2-line', genre: 'Mystery', category: 'role', accent: '#8e8e93', desc: '预留给多角色剧情推理和线索收集，不会只固定成狼人杀。', comingSoon: true }
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
    const chars = getWolfchaCharacters().slice(0, 9).map((char, index) => ({
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

function getWolfchaCharacters() {
    return Array.isArray(window.myCharacters) ? window.myCharacters.filter(char => char && char.id && !char.isGroupChat) : [];
}

function getWolfchaSetupIds() {
    const chars = getWolfchaCharacters();
    const allIds = chars.map(char => char.id);
    try {
        const saved = JSON.parse(localStorage.getItem(WOLFCHA_SETUP_KEY) || '[]');
        const valid = Array.isArray(saved) ? saved.filter(id => allIds.includes(id)) : [];
        if (valid.length) return valid.slice(0, 9);
    } catch (e) {}
    return allIds.slice(0, Math.min(5, allIds.length));
}

function saveWolfchaSetupIds(ids) {
    const allIds = getWolfchaCharacters().map(char => char.id);
    const valid = Array.isArray(ids) ? ids.filter((id, index) => allIds.includes(id) && ids.indexOf(id) === index).slice(0, 9) : [];
    localStorage.setItem(WOLFCHA_SETUP_KEY, JSON.stringify(valid));
}

function shuffleWolfchaList(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function normalizeWolfchaLogEntry(entry) {
    if (entry && typeof entry === 'object') return entry;
    return { type: 'narrator', name: '旁白', text: String(entry || '') };
}

function getWolfchaLastLog(state) {
    const logs = Array.isArray(state?.log) ? state.log.map(normalizeWolfchaLogEntry) : [];
    return logs[logs.length - 1] || { type: 'narrator', name: '旁白', text: '人到齐了，开始吧。' };
}

function pushWolfchaLog(state, entry) {
    if (!Array.isArray(state.log)) state.log = [];
    state.log.push(normalizeWolfchaLogEntry(entry));
    if (state.log.length > 80) state.log = state.log.slice(-80);
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

function handleGameBack() {
    if (getActiveGame() === 'hub') {
        if (typeof closeApp === 'function') closeApp('game');
        return;
    }
    openGameHub();
}
window.handleGameBack = handleGameBack;

function openMiniGame(gameId) {
    const game = GAME_LIBRARY.find(item => item.id === gameId);
    if (game?.comingSoon) {
        if (typeof showWechatToast === 'function') showWechatToast('这个游戏位已经留好，后续可以继续接玩法。');
        return;
    }
    setActiveGame(gameId);
    if (gameId === 'wolfcha') {
        localStorage.removeItem(GAME_STATE_KEY);
        localStorage.setItem(WOLFCHA_ENTRY_KEY, 'opening');
    }
    if (gameId === 'acting') {
        localStorage.removeItem(ACTING_GAME_STATE_KEY);
    }
    if (isBoardCompanionGame(gameId)) {
        localStorage.removeItem(BOARD_GAME_READY_KEY_PREFIX + gameId);
    }
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
    startWolfchaGame(getWolfchaSetupIds(), shouldRender);
}

function startWolfchaGame(charIds = getWolfchaSetupIds(), shouldRender = true) {
    const chars = getWolfchaCharacters();
    const selectedIds = Array.isArray(charIds) ? charIds : [];
    const selectedChars = selectedIds
        .map(id => chars.find(char => char.id === id))
        .filter(Boolean)
        .slice(0, 9);
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const players = [{
        id: 'user',
        name: profile.name || '你',
        avatar: profile.avatar || '',
        number: 1,
        isUser: true,
        role: '',
        alive: true
    }, ...selectedChars.map((char, index) => ({
        id: char.id,
        name: getMusicCharName(char),
        avatar: char.avatar || '',
        number: index + 2,
        isUser: false,
        role: '',
        alive: true
    }))];
    const roles = shuffleWolfchaList([...GAME_ROLES]).slice(0, players.length);
    const state = {
        phase: 'day',
        day: 1,
        turnMode: 'day_intro',
        speechQueue: players.map(player => player.id),
        speechIndex: -1,
        awaitingUserSpeech: false,
        aiSpeechBusyId: '',
        nightStep: 0,
        action: '旁白开场',
        selectedId: players[0]?.id || 'user',
        currentSpeakerId: players[0]?.id || 'user',
        log: [
            { type: 'narrator', name: '旁白', text: `人到齐了，${players.length} 名玩家入场，身份已随机分配。` },
            { type: 'narrator', name: '旁白', text: '第一天从警徽竞选发言开始。点击「旁白继续」，我会依次点名发言。' }
        ],
        players: players.map((player, index) => ({ ...player, role: roles[index] || '村民', alive: true }))
    };
    saveWolfchaSetupIds(selectedChars.map(char => char.id));
    saveGameState(state);
    if (shouldRender) renderGameApp();
}
window.resetWolfchaGame = resetWolfchaGame;
window.startWolfchaGame = startWolfchaGame;

function getWolfchaUserPlayer(state = null) {
    const players = Array.isArray(state?.players) ? state.players : [];
    return players.find(player => player && player.isUser) || null;
}

function isWolfchaRoleVisibleToUser(player, state = null) {
    if (!player) return false;
    if (player.isUser) return true;
    const userPlayer = getWolfchaUserPlayer(state);
    return !!(userPlayer && userPlayer.role === '狼人' && player.role === '狼人');
}

function getWolfchaPlayerRoleLabel(player, state = null) {
    if (!player) return '身份隐藏';
    if (isWolfchaRoleVisibleToUser(player, state)) return player.role || '未知身份';
    return player.alive === false ? '身份封存' : '身份隐藏';
}

function getWolfchaPlayerRoleClass(player, state = null) {
    if (!player) return 'hidden';
    if (!isWolfchaRoleVisibleToUser(player, state)) return 'hidden';
    return player.role === '狼人' ? 'wolf' : '';
}

function getWolfchaRoleIconForPlayer(player, state = null) {
    if (!isWolfchaRoleVisibleToUser(player, state)) return 'ri-lock-2-line';
    const role = player && player.role;
    if (role === '狼人') return 'ri-moon-clear-fill';
    if (role === '预言家') return 'ri-eye-2-fill';
    if (role === '女巫') return 'ri-flask-line';
    if (role === '守卫') return 'ri-shield-star-fill';
    if (role === '猎人') return 'ri-crosshair-2-line';
    return 'ri-user-smile-line';
}

function getWolfchaPublicLogText(entry, state = null) {
    const item = normalizeWolfchaLogEntry(entry);
    const players = Array.isArray(state?.players) ? state.players : [];
    const player = item.playerId ? players.find(row => row.id === item.playerId) : null;
    const text = String(item.text || '');
    if (player && !isWolfchaRoleVisibleToUser(player, state)) {
        return text.replace(/身份是\s*(狼人|预言家|女巫|守卫|猎人|村民)[。.!！]?/g, '身份已由裁判记录，玩家视角不公开。');
    }
    return text;
}

function getGameHubFilter() {
    const saved = localStorage.getItem(GAME_HUB_FILTER_KEY);
    return ['all', 'role', 'study', 'arcade', 'board'].includes(saved) ? saved : 'all';
}

function setGameHubFilter(filter) {
    localStorage.setItem(GAME_HUB_FILTER_KEY, ['all', 'role', 'study', 'arcade', 'board'].includes(filter) ? filter : 'all');
    renderGameApp();
}
window.setGameHubFilter = setGameHubFilter;

function getWolfchaEntryStep() {
    return localStorage.getItem(WOLFCHA_ENTRY_KEY) || 'opening';
}

function renderWolfchaOpening(el) {
    const chars = getWolfchaCharacters();
    const selectedCount = getWolfchaSetupIds().length;
    el.innerHTML = `
        <section class="wolfcha-opening">
            <div class="wolfcha-opening-bg" aria-hidden="true"></div>
            <div class="wolfcha-opening-orbit" aria-hidden="true"></div>
            <div class="wolfcha-opening-cards" aria-hidden="true">
                <span><i class="ri-moon-clear-fill"></i><b>狼人</b></span>
                <span><i class="ri-eye-2-fill"></i><b>预言家</b></span>
                <span><i class="ri-shield-star-fill"></i><b>守卫</b></span>
            </div>
            <div class="wolfcha-opening-copy">
                <span>MOONLIT TABLE</span>
                <strong>梦境牌局即将开启</strong>
                <p>午夜、身份、谎言和预言会在同一张桌上醒来。先召集角色，再由旁白引导入局。</p>
            </div>
            <div class="wolfcha-opening-meta">
                <span><b>${selectedCount || Math.min(chars.length, 9)}</b> 已候选</span>
                <span><b>${chars.length}</b> 可邀请</span>
            </div>
            <button type="button" class="wolfcha-opening-start" onclick="enterWolfchaSetup()">
                <i class="ri-sparkling-2-fill"></i>
                <span>召集入局</span>
            </button>
        </section>
    `;
}
window.renderWolfchaOpening = renderWolfchaOpening;

function enterWolfchaSetup() {
    localStorage.setItem(WOLFCHA_ENTRY_KEY, 'setup');
    localStorage.removeItem(GAME_STATE_KEY);
    renderGameApp();
}
window.enterWolfchaSetup = enterWolfchaSetup;

function renderWolfchaSetup(el) {
    const chars = getWolfchaCharacters();
    const selectedIds = getWolfchaSetupIds();
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    el.innerHTML = `
        <section class="wolfcha-setup">
            <div class="wolfcha-setup-hero">
                <div class="wolfcha-setup-sigil" aria-hidden="true"><i class="ri-moon-clear-fill"></i></div>
                <span>BYND WEREWOLF</span>
                <strong>选择陪你入局的角色</strong>
                <p>你会自动加入牌局。开局后只有你的身份可见；如果你是狼人，会额外看到同阵营狼人。其他身份由裁判持有。</p>
                <div class="wolfcha-setup-omens" aria-hidden="true">
                    <i></i><i></i><i></i><i></i>
                </div>
            </div>
            <div class="wolfcha-user-card">
                <div>${profile.avatar ? `<img src="${musicEscapeAttr(profile.avatar)}" alt="${musicEscapeAttr(profile.name || '你')}">` : '<i class="ri-user-smile-line"></i>'}</div>
                <span>玩家 1</span>
                <strong>${musicEscapeHtml(profile.name || '你')}</strong>
                <em>固定加入</em>
            </div>
            <div class="wolfcha-setup-head">
                <strong>AI 玩家</strong>
                <span>${selectedIds.length}/${Math.min(chars.length, 9)} 已选择</span>
            </div>
            <div class="wolfcha-setup-list">
                ${chars.length ? chars.map((char, index) => {
                    const selected = selectedIds.includes(char.id);
                    return `
                        <button type="button" class="wolfcha-setup-char ${selected ? 'selected' : ''}" onclick="toggleWolfchaSetupChar('${musicEscapeAttr(char.id)}')">
                            <div class="wolfcha-setup-avatar">${char.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(getMusicCharName(char))}">` : '<i class="ri-user-line"></i>'}</div>
                            <div>
                                <span>玩家 ${index + 2}</span>
                                <strong>${musicEscapeHtml(getMusicCharName(char))}</strong>
                            </div>
                            <i class="${selected ? 'ri-checkbox-circle-fill' : 'ri-add-circle-line'}"></i>
                        </button>
                    `;
                }).join('') : '<div class="wolfcha-setup-empty">先在微信里导入角色，再回来选择陪玩的 AI。</div>'}
            </div>
            <div class="wolfcha-setup-actions">
                <button type="button" onclick="selectFirstWolfchaChars()"><i class="ri-group-line"></i> 选前九个</button>
                <button type="button" class="primary" onclick="startWolfchaGameFromSetup()" ${selectedIds.length ? '' : 'disabled'}><i class="ri-play-fill"></i> 开始游戏</button>
            </div>
        </section>
    `;
}
window.renderWolfchaSetup = renderWolfchaSetup;

function openWolfchaSetup() {
    localStorage.removeItem(GAME_STATE_KEY);
    localStorage.setItem(WOLFCHA_ENTRY_KEY, 'setup');
    setActiveGame('wolfcha');
    renderGameApp();
}
window.openWolfchaSetup = openWolfchaSetup;

function toggleWolfchaSetupChar(id) {
    const selected = getWolfchaSetupIds();
    const exists = selected.includes(id);
    const next = exists ? selected.filter(item => item !== id) : [...selected, id].slice(0, 9);
    saveWolfchaSetupIds(next);
    renderGameApp();
}
window.toggleWolfchaSetupChar = toggleWolfchaSetupChar;

function selectFirstWolfchaChars() {
    saveWolfchaSetupIds(getWolfchaCharacters().slice(0, 9).map(char => char.id));
    renderGameApp();
}
window.selectFirstWolfchaChars = selectFirstWolfchaChars;

function startWolfchaGameFromSetup() {
    const selected = getWolfchaSetupIds();
    if (!selected.length) {
        if (typeof showWechatToast === 'function') showWechatToast('至少选择一个 AI 角色');
        return;
    }
    localStorage.setItem(WOLFCHA_ENTRY_KEY, 'playing');
    startWolfchaGame(selected, true);
}
window.startWolfchaGameFromSetup = startWolfchaGameFromSetup;

function renderGameApp() {
    const el = document.getElementById('game-content');
    if (!el) return;
    const activeGame = getActiveGame();
    const gameWindow = document.getElementById('app-game-window');
    if (gameWindow) {
        Array.from(gameWindow.classList).forEach(cls => { if (cls.startsWith('game-mode-')) gameWindow.classList.remove(cls); });
        gameWindow.classList.add(`game-mode-${activeGame}`);
    }
    if (activeGame !== 'chicken') {
        stopChickenGame(false);
        stopChickenBgm();
    }
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
    if (activeGame === 'catpot') {
        renderCatPotGame(el);
        return;
    }
    if (activeGame === 'acting') {
        renderActingGame(el);
        return;
    }
    if (activeGame === 'chicken') {
        renderChickenGame(el);
        return;
    }
    if (activeGame === 'jump') {
        renderJumpGame(el);
        return;
    }
    if (activeGame === 'watersort') {
        renderWaterSortGame(el);
        return;
    }
    if (activeGame === '2048') {
        render2048Game(el);
        return;
    }
    if (activeGame === 'gomoku') {
        if (!isBoardGameReady(activeGame)) {
            renderBoardGameCompanionSetup(el, activeGame);
            return;
        }
        renderGomokuGame(el);
        return;
    }
    if (activeGame === 'chess' || activeGame === 'xiangqi') {
        if (!isBoardGameReady(activeGame)) {
            renderBoardGameCompanionSetup(el, activeGame);
            return;
        }
        renderBoardGame(el, activeGame);
        return;
    }
    if (activeGame === 'wolfcha' && !getGameState() && getWolfchaEntryStep() !== 'setup') {
        renderWolfchaOpening(el);
        return;
    }
    if (activeGame === 'wolfcha' && !getGameState()) {
        renderWolfchaSetup(el);
        return;
    }
    const state = getGameState() || { players: getGamePlayers(), log: [] };
    const players = state.players || getGamePlayers();
    const alive = players.filter(player => player.alive !== false).length;
    const selected = players.find(player => player.id === state.currentSpeakerId) || players.find(player => player.id === state.selectedId) || players[0];
    const lastLog = getWolfchaLastLog(state);
    const lastNarrator = (state.log || [])
        .map(normalizeWolfchaLogEntry)
        .filter(item => item.type === 'narrator')
        .slice(-1)[0];
    const waitingUserSpeech = !!state.awaitingUserSpeech && selected?.isUser;
    const phaseText = state.phase === 'night' ? '夜晚行动' : '白日发言';
    const selectedRole = getWolfchaPlayerRoleLabel(selected, state);
    const selectedRoleIcon = getWolfchaRoleIconForPlayer(selected, state);
    const dialogMetaText = lastNarrator?.text && lastNarrator.text !== lastLog.text ? lastNarrator.text : '';
    const dialogText = getWolfchaPublicLogText(lastLog, state);
    el.innerHTML = `
        <section class="wolfcha-stage ${state.phase === 'night' ? 'night' : ''}">
            <div class="wolfcha-table-aura" aria-hidden="true"></div>
            <div class="wolfcha-topline">
                <div class="wolfcha-status">
                    <span><small>第</small><b>${String(state.day || 1).padStart(2, '0')}</b><small>天</small></span>
                    <span><small>存活</small><b>${alive}/${players.length}</b></span>
                </div>
                <div class="wolfcha-top-actions">
                    <button type="button" onclick="openGameHub()"><i class="ri-apps-2-line"></i> 大厅</button>
                    <button type="button" onclick="openWolfchaSetup()"><i class="ri-group-line"></i> 换人</button>
                </div>
            </div>
            <div class="wolfcha-action-pill"><i class="ri-eye-line"></i><span>${musicEscapeHtml(state.action || '等待开始')}</span></div>
            <div class="wolfcha-center">
                ${waitingUserSpeech ? `
                    <div class="wolfcha-user-speech-box">
                        <textarea id="wolfcha-user-speech-input" maxlength="180" placeholder="轮到你发言，写下你的怀疑、站边或解释..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitWolfchaUserSpeech();}"></textarea>
                        <button type="button" onclick="submitWolfchaUserSpeech()"><i class="ri-send-plane-fill"></i> 发言</button>
                    </div>
                ` : ''}
                <div class="wolfcha-speaker-card">
                    <div class="wolfcha-role-card">
                        <span>${musicEscapeHtml(selectedRole)}</span>
                        <i class="${selectedRoleIcon}"></i>
                        <b>${musicEscapeHtml(phaseText)}</b>
                    </div>
                    <div class="wolfcha-avatar-large">${selected?.avatar ? `<img src="${musicEscapeAttr(selected.avatar)}" alt="${musicEscapeAttr(selected.name)}">` : '<i class="ri-user-smile-line"></i>'}</div>
                    <div>
                        <span>当前发言席</span>
                        <strong>${musicEscapeHtml(selected?.name || '旁白')}</strong>
                    </div>
                </div>
                <div class="wolfcha-dialog">
                    <strong>${musicEscapeHtml(lastLog.name || selected?.name || '旁白')}</strong>
                    <p>${musicEscapeHtml(dialogText || '人到齐了，开始吧。')}</p>
                    ${dialogMetaText ? `<span>${musicEscapeHtml(getWolfchaPublicLogText(lastNarrator, state))}</span>` : ''}
                </div>
            </div>
            <div class="wolfcha-actions">
                <button type="button" onclick="wolfchaNarratorStep()"><i class="ri-scroll-to-bottom-line"></i> 旁白继续</button>
                <button type="button" onclick="wolfchaNextSpeech()"><i class="ri-chat-voice-line"></i> ${waitingUserSpeech ? '写发言' : '当前发言'}</button>
                <button type="button" onclick="startWolfchaNight()"><i class="ri-moon-clear-line"></i> 入夜</button>
                <button type="button" onclick="wolfchaVoteSelected()"><i class="ri-skull-2-line"></i> 放逐</button>
            </div>
        </section>
        <section class="wolfcha-player-rail">
            ${players.map(player => `
                <button type="button" class="wolfcha-player ${player.id === state.selectedId ? 'active' : ''} ${player.alive === false ? 'dead' : ''}" onclick="selectWolfchaPlayer('${musicEscapeAttr(player.id)}')">
                    <span class="wolfcha-role ${getWolfchaPlayerRoleClass(player, state)}">${musicEscapeHtml(getWolfchaPlayerRoleLabel(player, state))}</span>
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
    const featured = GAME_LIBRARY[0];
    const playableCount = GAME_LIBRARY.filter(game => !game.comingSoon).length;
    const filter = getGameHubFilter();
    const tabs = [
        { id: 'all', label: '全部' },
        { id: 'role', label: '角色联机' },
        { id: 'study', label: '学习联动' },
        { id: 'arcade', label: '街机' },
        { id: 'board', label: '棋盘' }
    ];
    const games = GAME_LIBRARY.filter(game => filter === 'all' || game.category === filter);
    el.innerHTML = `
        <section class="game-hub">
            <div class="game-hub-hero appstore-hero" onclick="openMiniGame('${musicEscapeAttr(featured.id)}')">
                <div class="appstore-hero-copy">
                    <span>BYND GAME LIBRARY</span>
                    <strong>${musicEscapeHtml(featured.title)}</strong>
                    <p>${musicEscapeHtml(featured.desc)}</p>
                    <button type="button"><i class="ri-play-fill"></i> 开始游戏</button>
                </div>
                <div class="appstore-hero-art" style="--game-accent:${musicEscapeAttr(featured.accent || '#0a84ff')}">
                    <i class="${musicEscapeAttr(featured.icon)}"></i>
                    <em>${chars.length || 0} CHARS</em>
                </div>
            </div>
            <div class="game-hub-tabs">
                ${tabs.map(tab => `<button type="button" class="${filter === tab.id ? 'active' : ''}" onclick="setGameHubFilter('${musicEscapeAttr(tab.id)}')">${musicEscapeHtml(tab.label)}</button>`).join('')}
            </div>
            <div class="game-section-title">
                <strong>游戏库</strong>
                <span>${playableCount} playable · ${GAME_LIBRARY.length} slots</span>
            </div>
            <div class="game-library">
                ${games.map(game => `
                    <button type="button" class="game-library-card ${game.comingSoon ? 'coming' : ''}" style="--game-accent:${musicEscapeAttr(game.accent || '#0a84ff')}" onclick="openMiniGame('${musicEscapeAttr(game.id)}')">
                        <div class="game-card-cover"><i class="${musicEscapeAttr(game.icon)}"></i></div>
                        <div>
                            <span>${musicEscapeHtml(game.tag)}</span>
                            <strong>${musicEscapeHtml(game.title)}</strong>
                            <p>${musicEscapeHtml(game.desc)}</p>
                            <small>${musicEscapeHtml(game.genre || '')}</small>
                        </div>
                        <em class="${game.comingSoon ? 'ri-lock-2-line' : 'ri-arrow-right-s-line'}"></em>
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function getActingGameState() {
    try {
        const state = JSON.parse(localStorage.getItem(ACTING_GAME_STATE_KEY) || '{}') || {};
        return state.phase ? state : null;
    } catch (_) {
        return null;
    }
}

function saveActingGameState(state) {
    localStorage.setItem(ACTING_GAME_STATE_KEY, JSON.stringify(state || {}));
}

function resetActingGame() {
    localStorage.removeItem(ACTING_GAME_STATE_KEY);
    renderGameApp();
}
window.resetActingGame = resetActingGame;

function setActingPhase(phase, extra = {}) {
    const state = { ...(getActingGameState() || {}), ...extra, phase };
    saveActingGameState(state);
    renderGameApp();
}

function startActingGameSelection() {
    setActingPhase('select', { error: '' });
}
window.startActingGameSelection = startActingGameSelection;

function getActingSelectedChar() {
    const state = getActingGameState();
    const chars = getWolfchaCharacters();
    return chars.find(char => char.id === state?.selectedCharId) || null;
}

function selectActingGameChar(id) {
    if (!getWolfchaCharacters().some(char => char.id === id)) return;
    const state = getActingGameState() || { phase: 'select' };
    state.selectedCharId = id;
    state.error = '';
    saveActingGameState(state);
    renderGameApp();
}
window.selectActingGameChar = selectActingGameChar;

function extractActingJsonPayload(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const unfenced = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    const candidates = [unfenced];
    const objectStart = unfenced.indexOf('{');
    const objectEnd = unfenced.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) candidates.push(unfenced.slice(objectStart, objectEnd + 1));
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch (_) {}
    }
    return null;
}

function compactActingText(value, maxLength = 700) {
    const cleaner = typeof window.cleanChatApiVisibleContent === 'function'
        ? window.cleanChatApiVisibleContent
        : value => String(value == null ? '' : value);
    const text = cleaner(value)
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function getActingWorldBookText(char) {
    const entries = Array.isArray(char?.worldBook) ? char.worldBook : [];
    return entries.slice(0, 16).map(entry => {
        const key = entry.key || entry.keys || entry.keyword || entry.name || '';
        const content = compactActingText(entry.content || entry.entry || entry.value || '', 360);
        return content ? `${key ? `【${key}】` : ''}${content}` : '';
    }).filter(Boolean).join('\n');
}

function getActingRecentChatText(char) {
    const history = Array.isArray(char?.history) ? char.history : [];
    const charName = getMusicCharName(char);
    return history.slice(-12).map(msg => {
        const who = msg.isMe ? '用户' : charName;
        const text = compactActingText(msg.description || msg.content || msg.dialogue || '', 220);
        return text ? `${who}：${text}` : '';
    }).filter(Boolean).join('\n');
}

function buildActingGameMessages(char) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const charName = getMusicCharName(char);
    const description = compactActingText(char?.description || '', 3400);
    const worldBook = getActingWorldBookText(char);
    const recent = getActingRecentChatText(char) || '暂无最近聊天。';
    return [
        {
            role: 'system',
            content: [
                '你是 BYND 游戏「谁是演技派」的剧本导演，只输出 JSON 对象，不要 Markdown，不要解释。',
                '你要为用户和一个已导入角色生成沉浸式即兴剧本。剧情要华丽、梦幻、复古、带悬疑或奇幻感，但不要廉价狗血。',
                '禁止生成“霸道总裁爱上我”、强迫、羞辱、极端控制、未成年人或露骨性内容。可以参考但不要照搬这些方向：捡手机文学、快穿三千小世界、变成男主的小猫、错拿档案袋、旧剧院失忆夜、雨夜电台来信。',
                '字段必须是：title、genre、premise、openingNarration、userRole、charRole、scenes。',
                'userRole 字段：name、identity、cover、secret、goal、props(数组)。',
                'charRole 字段：name、identity、relationship、conflict。',
                'scenes 是 4-6 个数组项，每项必须有 title、narration、charLine、userCue、stageHint。',
                'charLine 必须按角色卡和最近聊天口吻写，像真实角色在剧本里表演；narration 由旁白推动剧情；userCue 是给用户下一句台词的方向。'
            ].join('\n')
        },
        {
            role: 'user',
            content: [
                `用户：${profile.name || '我'}`,
                profile.bio ? `用户资料：${compactActingText(profile.bio, 500)}` : '',
                `角色原名：${char?.name || charName}`,
                `用户给角色的备注名：${charName}`,
                description ? `角色卡：${description}` : '',
                worldBook ? `世界书：\n${worldBook}` : '',
                `最近聊天：\n${recent}`,
                '请生成一个完整剧本 JSON。'
            ].filter(Boolean).join('\n\n')
        }
    ];
}

function normalizeActingScript(raw, char) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const normalizeObject = value => (value && typeof value === 'object') ? value : {};
    const text = (value, fallback = '', max = 500) => compactActingText(value || fallback, max);
    const userRole = normalizeObject(data.userRole || data.user || data['用户角色']);
    const charRole = normalizeObject(data.charRole || data.characterRole || data['角色档案']);
    const scenesRaw = Array.isArray(data.scenes || data['场景']) ? (data.scenes || data['场景']) : [];
    const scenes = scenesRaw.map((scene, index) => {
        const safe = normalizeObject(scene);
        return {
            title: text(safe.title || safe.name, `第 ${index + 1} 场`, 34),
            narration: text(safe.narration || safe.aside || safe['旁白'], '', 620),
            charLine: text(safe.charLine || safe.line || safe['角色台词'], '', 420),
            userCue: text(safe.userCue || safe.prompt || safe['用户提示'], '用你的方式接住这一幕。', 180),
            stageHint: text(safe.stageHint || safe.hint || safe['舞台提示'], '', 180)
        };
    }).filter(scene => scene.narration || scene.charLine);

    return {
        title: text(data.title || data.name, '未命名剧本', 28),
        genre: text(data.genre || data.type, '梦幻即兴剧', 32),
        premise: text(data.premise || data.summary || data['设定'], '一份被误投的档案，把两个人卷进了同一场临时演出。', 360),
        openingNarration: text(data.openingNarration || data.opening || data['开场旁白'], '旧剧院的灯一盏盏亮起，档案袋在桌面上自动摊开。', 380),
        userRole: {
            name: text(userRole.name, '临时演员', 24),
            identity: text(userRole.identity, '被卷入剧本的证人', 80),
            cover: text(userRole.cover, '表面只是路过的人', 100),
            secret: text(userRole.secret, '你手里有剧情缺失的一页。', 140),
            goal: text(userRole.goal, '在不露馅的情况下走完第一幕。', 140),
            props: Array.isArray(userRole.props) ? userRole.props.map(item => text(item, '', 32)).filter(Boolean).slice(0, 5) : []
        },
        charRole: {
            name: text(charRole.name, getMusicCharName(char), 24),
            identity: text(charRole.identity, '剧本里的关键人物', 90),
            relationship: text(charRole.relationship, '和用户互相试探', 120),
            conflict: text(charRole.conflict, '他不确定该相信台词，还是相信你。', 140)
        },
        scenes: scenes.length ? scenes.slice(0, 6) : []
    };
}

async function generateActingScript() {
    const char = getActingSelectedChar();
    if (!char) {
        if (typeof showWechatToast === 'function') showWechatToast('先选择一个角色');
        return;
    }
    if (typeof callChatApi !== 'function') {
        setActingPhase('select', { error: '聊天 API 模块没有加载，无法生成剧本。' });
        return;
    }
    const pending = { ...(getActingGameState() || {}), phase: 'generating', error: '', selectedCharId: char.id };
    saveActingGameState(pending);
    renderGameApp();
    try {
        const result = await callChatApi(buildActingGameMessages(char));
        if (!result || !result.ok) throw new Error((result && result.error) || '剧本生成失败');
        const payload = extractActingJsonPayload(result.content);
        if (!payload) throw new Error('AI 没有返回可解析的剧本 JSON');
        const script = normalizeActingScript(payload, char);
        if (!script.scenes.length) throw new Error('剧本里没有可用场景');
        saveActingGameState({
            phase: 'roleFile',
            selectedCharId: char.id,
            script,
            sceneIndex: 0,
            userLines: [],
            error: ''
        });
    } catch (e) {
        saveActingGameState({
            phase: 'select',
            selectedCharId: char.id,
            error: `生成失败：${e.message || e}`
        });
    }
    renderGameApp();
}
window.generateActingScript = generateActingScript;

function enterActingStage() {
    const state = getActingGameState();
    if (!state?.script) return;
    state.phase = 'stage';
    state.sceneIndex = Number.isFinite(state.sceneIndex) ? state.sceneIndex : 0;
    saveActingGameState(state);
    renderGameApp();
}
window.enterActingStage = enterActingStage;

function advanceActingScene() {
    const state = getActingGameState();
    if (!state?.script) return;
    const count = state.script.scenes.length;
    state.sceneIndex = Math.min(count, (Number(state.sceneIndex) || 0) + 1);
    state.phase = state.sceneIndex >= count ? 'ending' : 'stage';
    saveActingGameState(state);
    renderGameApp();
}
window.advanceActingScene = advanceActingScene;

function submitActingUserLine() {
    const input = document.getElementById('acting-user-line');
    const text = String(input?.value || '').trim();
    if (!text) {
        input?.focus();
        return;
    }
    const state = getActingGameState();
    if (!state?.script) return;
    state.userLines = Array.isArray(state.userLines) ? state.userLines : [];
    state.userLines.push({
        sceneIndex: Number(state.sceneIndex) || 0,
        text,
        at: Date.now()
    });
    saveActingGameState(state);
    if (input) input.value = '';
    if (typeof showWechatToast === 'function') showWechatToast('台词已写入档案');
    renderGameApp();
}
window.submitActingUserLine = submitActingUserLine;

function renderActingOpening(el) {
    el.innerHTML = `
        <section class="acting-game acting-opening">
            <div class="acting-noise" aria-hidden="true"></div>
            <div class="acting-opening-aura" aria-hidden="true"></div>
            <div class="acting-opening-orbit" aria-hidden="true">
                ${Array.from({ length: 8 }).map((_, idx) => `
                    <span class="acting-orbit-card card-${idx + 1}">
                        <i class="${idx % 3 === 0 ? 'ri-movie-2-line' : idx % 3 === 1 ? 'ri-file-paper-2-line' : 'ri-sparkling-2-fill'}"></i>
                    </span>
                `).join('')}
            </div>
            <div class="acting-opening-mission">
                <span></span><span></span><span></span><strong>1</strong><span></span><span></span>
            </div>
            <div class="acting-opening-stage">
                <span class="acting-kicker">BYND CASTING ROOM</span>
                <strong>谁是演技派</strong>
                <p>抽取一张命运牌，AI 临场写下剧本。角色保留原本人设，只是被推进一场更像电影的戏里。</p>
                <button type="button" onclick="startActingGameSelection()"><i class="ri-sparkling-2-fill"></i> 开启剧场</button>
            </div>
            <div class="acting-floating-files" aria-hidden="true">
                <span>CASE 01</span><span>STAGE</span><span>DOSSIER</span><span>SECRET</span>
            </div>
        </section>
    `;
}

function renderActingSelection(el, state) {
    const chars = getWolfchaCharacters();
    const selectedId = state?.selectedCharId || '';
    el.innerHTML = `
        <section class="acting-game acting-select">
            <div class="acting-select-head">
                <span class="acting-kicker">CAST DOSSIER</span>
                <strong>选择一起演戏的角色</strong>
                <p>像翻阅演员档案一样选人。生成剧本后，角色会保留原人设，只是进入新的剧情壳子里。</p>
            </div>
            ${state?.error ? `<div class="acting-error"><i class="ri-error-warning-line"></i>${musicEscapeHtml(state.error)}</div>` : ''}
            <div class="acting-dossier-grid">
                ${chars.length ? chars.map(char => {
                    const selected = char.id === selectedId;
                    return `
                        <button type="button" class="acting-dossier ${selected ? 'selected' : ''}" onclick="selectActingGameChar('${musicEscapeAttr(char.id)}')">
                            <div class="acting-dossier-avatar">${char.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(getMusicCharName(char))}">` : '<i class="ri-user-smile-line"></i>'}</div>
                            <div>
                                <span>FILE / ${musicEscapeHtml((char.id || '').slice(-4).toUpperCase() || 'CHAR')}</span>
                                <strong>${musicEscapeHtml(getMusicCharName(char))}</strong>
                                <p>${musicEscapeHtml(compactActingText(char.description || '暂无角色简介', 70))}</p>
                            </div>
                            <i class="${selected ? 'ri-checkbox-circle-fill' : 'ri-add-circle-line'}"></i>
                        </button>
                    `;
                }).join('') : '<div class="acting-empty">先在微信里导入角色卡，再回来选演员。</div>'}
            </div>
            <div class="acting-bottom-actions">
                <button type="button" onclick="resetActingGame()">返回开场</button>
                <button type="button" class="primary" onclick="generateActingScript()" ${selectedId ? '' : 'disabled'}><i class="ri-sparkling-2-fill"></i> 生成剧本</button>
            </div>
        </section>
    `;
}

function renderActingGenerating(el, state) {
    const char = getActingSelectedChar();
    el.innerHTML = `
        <section class="acting-game acting-generating">
            <div class="acting-loader">
                <div>${char?.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(getMusicCharName(char))}">` : '<i class="ri-movie-2-line"></i>'}</div>
                <span>剧院灯光正在亮起</span>
                <strong>AI 正在写剧本</strong>
                <p>读取角色卡、世界书、最近聊天和用户档案，生成非俗套剧情与报纸式人物档案。</p>
            </div>
        </section>
    `;
}

function renderActingRoleFile(el, state) {
    const script = state.script;
    const char = getActingSelectedChar();
    const props = Array.isArray(script.userRole.props) && script.userRole.props.length ? script.userRole.props : ['旧报纸', '未署名钥匙'];
    el.innerHTML = `
        <section class="acting-game acting-rolefile">
            <div class="acting-script-card">
                <span class="acting-kicker">SCRIPT READY</span>
                <strong>${musicEscapeHtml(script.title)}</strong>
                <p>${musicEscapeHtml(script.premise)}</p>
            </div>
            <article class="acting-newspaper">
                <div class="acting-paper-head">
                    <span>BYND EVENING POST</span>
                    <b>${musicEscapeHtml(script.genre)}</b>
                </div>
                <h3>${musicEscapeHtml(script.userRole.name)}</h3>
                <h4>${musicEscapeHtml(script.userRole.identity)}</h4>
                <p>${musicEscapeHtml(script.openingNarration)}</p>
                <div class="acting-paper-columns">
                    <div><span>公开身份</span><strong>${musicEscapeHtml(script.userRole.cover)}</strong></div>
                    <div><span>隐藏秘密</span><strong>${musicEscapeHtml(script.userRole.secret)}</strong></div>
                    <div><span>本幕目标</span><strong>${musicEscapeHtml(script.userRole.goal)}</strong></div>
                    <div><span>对手戏</span><strong>${musicEscapeHtml(script.charRole.relationship || getMusicCharName(char))}</strong></div>
                </div>
                <div class="acting-props">
                    ${props.map(item => `<em>${musicEscapeHtml(item)}</em>`).join('')}
                </div>
            </article>
            <div class="acting-bottom-actions">
                <button type="button" onclick="startActingGameSelection()">重新选角</button>
                <button type="button" class="primary" onclick="enterActingStage()"><i class="ri-play-fill"></i> 开始第一幕</button>
            </div>
        </section>
    `;
}

function renderActingStage(el, state) {
    const script = state.script;
    const char = getActingSelectedChar();
    const index = Number(state.sceneIndex) || 0;
    const scene = script.scenes[index];
    const userLines = (Array.isArray(state.userLines) ? state.userLines : []).filter(item => item.sceneIndex === index);
    el.innerHTML = `
        <section class="acting-game acting-stage">
            <div class="acting-stage-top">
                <div>
                    <span class="acting-kicker">SCENE ${String(index + 1).padStart(2, '0')} / ${String(script.scenes.length).padStart(2, '0')}</span>
                    <strong>${musicEscapeHtml(scene.title)}</strong>
                </div>
                <button type="button" onclick="resetActingGame()"><i class="ri-restart-line"></i></button>
            </div>
            <div class="acting-stage-board">
                <div class="acting-narrator">
                    <span>旁白</span>
                    <p>${musicEscapeHtml(scene.narration || '灯光落下，新的幕布缓缓拉开。')}</p>
                    ${scene.stageHint ? `<em>${musicEscapeHtml(scene.stageHint)}</em>` : ''}
                </div>
                <div class="acting-char-line">
                    <div>${char?.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(getMusicCharName(char))}">` : '<i class="ri-user-voice-line"></i>'}</div>
                    <p><strong>${musicEscapeHtml(script.charRole.name || getMusicCharName(char))}</strong>${musicEscapeHtml(scene.charLine || '……')}</p>
                </div>
                <div class="acting-user-cue">
                    <span>你的表演方向</span>
                    <strong>${musicEscapeHtml(scene.userCue)}</strong>
                    <textarea id="acting-user-line" maxlength="180" placeholder="写一句你要接的台词..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitActingUserLine();}"></textarea>
                    <button type="button" onclick="submitActingUserLine()"><i class="ri-send-plane-fill"></i> 写入档案</button>
                </div>
                ${userLines.length ? `<div class="acting-user-lines">${userLines.map(item => `<p>${musicEscapeHtml(item.text)}</p>`).join('')}</div>` : ''}
            </div>
            <div class="acting-bottom-actions">
                <button type="button" onclick="startActingGameSelection()">换剧本</button>
                <button type="button" class="primary" onclick="advanceActingScene()">${index + 1 >= script.scenes.length ? '收束演出' : '旁白推进'} <i class="ri-arrow-right-s-line"></i></button>
            </div>
        </section>
    `;
}

function renderActingEnding(el, state) {
    const script = state.script || {};
    const lines = Array.isArray(state.userLines) ? state.userLines : [];
    el.innerHTML = `
        <section class="acting-game acting-ending">
            <div class="acting-script-card">
                <span class="acting-kicker">CURTAIN CALL</span>
                <strong>${musicEscapeHtml(script.title || '演出结束')}</strong>
                <p>这场临时剧本已经走完。你的台词被收进档案，可以重新开一局生成新的剧情。</p>
            </div>
            <div class="acting-archive-list">
                ${lines.length ? lines.map((item, index) => `<p><b>${index + 1}</b>${musicEscapeHtml(item.text)}</p>`).join('') : '<p><b>0</b>这次你还没有写入台词。</p>'}
            </div>
            <div class="acting-bottom-actions">
                <button type="button" onclick="openGameHub()">返回大厅</button>
                <button type="button" class="primary" onclick="resetActingGame()">重新开场</button>
            </div>
        </section>
    `;
}

function renderActingGame(el) {
    const state = getActingGameState() || { phase: 'opening' };
    if (state.phase === 'select') return renderActingSelection(el, state);
    if (state.phase === 'generating') return renderActingGenerating(el, state);
    if (state.phase === 'roleFile' && state.script) return renderActingRoleFile(el, state);
    if (state.phase === 'stage' && state.script) return renderActingStage(el, state);
    if (state.phase === 'ending' && state.script) return renderActingEnding(el, state);
    return renderActingOpening(el);
}
window.renderActingGame = renderActingGame;

function getSyncGameCharId() {
    const chars = getWolfchaCharacters();
    const saved = localStorage.getItem(SYNC_GAME_CHAR_KEY);
    return chars.some(char => char.id === saved) ? saved : '';
}

function getSyncGameChar() {
    const selectedId = getSyncGameCharId();
    return getWolfchaCharacters().find(char => char.id === selectedId) || null;
}

function selectSyncGameChar(id) {
    if (!getWolfchaCharacters().some(char => char.id === id)) return;
    localStorage.setItem(SYNC_GAME_CHAR_KEY, id);
    clearSyncGameState();
    renderGameApp();
}
window.selectSyncGameChar = selectSyncGameChar;

function getSyncGameState() {
    try {
        const state = JSON.parse(localStorage.getItem(SYNC_GAME_STATE_KEY) || '{}') || {};
        return state.phase ? state : null;
    } catch (e) {
        return null;
    }
}

function saveSyncGameState(state) {
    localStorage.setItem(SYNC_GAME_STATE_KEY, JSON.stringify(state || {}));
}

function clearSyncGameState() {
    localStorage.removeItem(SYNC_GAME_STATE_KEY);
}

function getSyncFallbackQuestions() {
    return [
        { question: '如果今晚只能留下一样东西陪你们，你们会选热饮、音乐还是一盏灯？', judgeTip: '看核心选择是否一致，也允许同义表达。' },
        { question: '如果要一起临时出门，你们会先确认路线、天气还是对方的心情？', judgeTip: '判断优先级是否一致。' },
        { question: '收到一张空白明信片时，你们会先写地点、日期还是一句想说的话？', judgeTip: '比较第一反应。' },
        { question: '如果把今天存成一张照片，你们觉得画面里最重要的会是什么？', judgeTip: '比较画面重点和情绪重点。' }
    ];
}

function pickSyncFallbackQuestion() {
    const list = getSyncFallbackQuestions();
    return list[Math.floor(Math.random() * list.length)] || list[0];
}

function extractSyncJsonPayload(text) {
    if (typeof extractActingJsonPayload === 'function') return extractActingJsonPayload(text);
    const raw = String(text || '').trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const candidates = [raw, start >= 0 && end > start ? raw.slice(start, end + 1) : ''].filter(Boolean);
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch (_) {}
    }
    return null;
}

function cleanSyncGameText(value, maxLength = 180) {
    const text = compactActingText(value, maxLength);
    return text || '';
}

function getSyncGameContext(char) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const charName = getMusicCharName(char);
    const userName = profile.name || '用户';
    const persona = cleanSyncGameText([
        char?.description,
        char?.personality,
        char?.scenario,
        char?.system_prompt || char?.systemPrompt
    ].filter(Boolean).join('\n'), 900);
    const world = typeof getActingWorldBookText === 'function' ? cleanSyncGameText(getActingWorldBookText(char), 700) : '';
    const recent = typeof getActingRecentChatText === 'function' ? cleanSyncGameText(getActingRecentChatText(char), 700) : '';
    return { profile, charName, userName, persona, world, recent };
}

function buildSyncJudgeQuestionMessages(char) {
    const ctx = getSyncGameContext(char);
    return [
        {
            role: 'system',
            content: '你是 BYND 小游戏「默契问答」的系统裁判，只负责出题。只返回 JSON，不要 Markdown，不要解释。格式：{"question":"一个双方都能独立作答的问题","judgeTip":"判定一致性的标准"}。问题必须轻松、具体、可由用户和角色分别作答；不要让角色猜用户；不要要求现实隐私；不要出现血腥、露骨或高风险内容。'
        },
        {
            role: 'user',
            content: `用户名：${ctx.userName}\n角色名：${ctx.charName}\n【角色人设】${ctx.persona || '无'}\n${ctx.world ? `【世界书】${ctx.world}\n` : ''}${ctx.recent ? `【最近聊天】${ctx.recent}\n` : ''}请裁判出一道适合他们同时作答的默契题。`
        }
    ];
}

function buildSyncCharAnswerMessages(char, question) {
    const base = typeof buildMessages === 'function'
        ? buildMessages(char, Array.isArray(char.history) ? char.history.slice(-8) : [])
        : [{ role: 'system', content: `你是${getMusicCharName(char)}。` }];
    base.push({
        role: 'user',
        content: `我们正在玩「默契问答」。系统裁判的问题是：「${question}」\n请你以${getMusicCharName(char)}本人身份独立作答，不要猜用户会怎么答，也不要询问用户。只返回 JSON：{"answer":"你的答案，30字以内","reason":"一句很短的理由，可留空"}。`
    });
    return base;
}

function buildSyncJudgeResultMessages(state) {
    return [
        {
            role: 'system',
            content: '你是 BYND 小游戏「默契问答」的系统裁判，只负责比较两份答案是否默契一致。只返回 JSON，不要 Markdown，不要解释。格式：{"matched":true或false,"score":0到100,"verdict":"一句裁判播报","reason":"为什么一致或不一致"}。语义一致即可判 true，不要求逐字相同；明显不同、优先级不同或对象不同判 false。'
        },
        {
            role: 'user',
            content: `题目：${state.question}\n判定标准：${state.judgeTip || '语义和优先级是否一致'}\n用户答案：${state.userAnswer}\n角色答案：${state.charAnswer}\n请裁判判定。`
        }
    ];
}

function normalizeSyncQuestionPayload(payload) {
    const fallback = pickSyncFallbackQuestion();
    return {
        question: cleanSyncGameText(payload?.question || payload?.title || payload?.text || fallback.question, 120) || fallback.question,
        judgeTip: cleanSyncGameText(payload?.judgeTip || payload?.standard || payload?.rule || fallback.judgeTip, 120) || fallback.judgeTip
    };
}

function normalizeSyncCharAnswerPayload(payload, char) {
    const fallback = `${getMusicCharName(char)}会先按自己的直觉选一个最在意的答案。`;
    return {
        answer: cleanSyncGameText(payload?.answer || payload?.text || payload?.content || fallback, 60) || fallback,
        reason: cleanSyncGameText(payload?.reason || payload?.why || '', 90)
    };
}

function normalizeSyncJudgePayload(payload, state) {
    const normalize = value => String(value || '').replace(/\s+/g, '').toLowerCase();
    const user = normalize(state.userAnswer);
    const char = normalize(state.charAnswer);
    const fallbackMatched = !!user && !!char && (user === char || user.includes(char) || char.includes(user));
    const matched = typeof payload?.matched === 'boolean'
        ? payload.matched
        : /^(true|yes|一致|相同|默契|match)$/i.test(String(payload?.matched || payload?.result || '').trim()) || fallbackMatched;
    const score = Number.isFinite(Number(payload?.score)) ? Math.max(0, Math.min(100, Number(payload.score))) : (matched ? 88 : 42);
    return {
        matched,
        score,
        verdict: cleanSyncGameText(payload?.verdict || payload?.title || (matched ? '裁判判定：默契命中' : '裁判判定：这题没对上'), 60),
        reason: cleanSyncGameText(payload?.reason || payload?.comment || (matched ? '两边答案的重点基本一致。' : '两边答案的重点不在同一处。'), 140)
    };
}

function renderSyncGameRound(char, state) {
    const charName = char ? getMusicCharName(char) : '角色';
    if (!state || state.phase === 'idle') {
        return `
            <div class="mini-game-card sync-game-round">
                <span>默契问答</span>
                <strong>裁判出题，你和 ${musicEscapeHtml(charName)} 分别作答</strong>
                <p>系统裁判会先抽一题；${musicEscapeHtml(charName)} 会暗中作答，你也写下自己的答案，最后由裁判判断是否一致。</p>
                <button type="button" onclick="startSyncMiniGame()" ${char ? '' : 'disabled'}><i class="ri-sparkling-2-line"></i> 裁判出题</button>
            </div>
        `;
    }
    if (state.phase === 'asking') {
        return `
            <div class="mini-game-card sync-game-round">
                <span>系统裁判</span>
                <strong>正在出题</strong>
                <p>裁判会出一道双方都能独立回答的问题，不会让 ${musicEscapeHtml(charName)} 猜你。</p>
                <div class="sync-game-loading"><i class="ri-loader-4-line"></i><em>Preparing question</em></div>
            </div>
        `;
    }
    if (state.phase === 'answering' || state.phase === 'judging') {
        const busy = state.phase === 'judging';
        return `
            <div class="mini-game-card sync-game-round">
                <span>系统裁判出题</span>
                <strong>${musicEscapeHtml(state.question || '这一题还没准备好')}</strong>
                <p>${musicEscapeHtml(state.judgeTip || '两边独立作答后，裁判比较答案重点是否一致。')}</p>
                <div class="sync-answer-status">
                    <span><i class="ri-user-smile-line"></i>${musicEscapeHtml(charName)} 已暗中作答</span>
                    <span><i class="ri-user-heart-line"></i>等待你的答案</span>
                </div>
                <label class="sync-answer-box">
                    <span>你的答案</span>
                    <textarea id="sync-user-answer" maxlength="80" rows="3" placeholder="写下你的第一反应" ${busy ? 'disabled' : ''}>${musicEscapeHtml(state.userAnswer || '')}</textarea>
                </label>
                <div class="sync-game-actions">
                    <button type="button" onclick="submitSyncGameAnswer()" ${busy ? 'disabled' : ''}><i class="${busy ? 'ri-loader-4-line' : 'ri-scales-3-line'}"></i> ${busy ? '裁判判定中' : '提交给裁判'}</button>
                    <button type="button" class="ghost" onclick="resetSyncMiniGame()" ${busy ? 'disabled' : ''}>换一题</button>
                </div>
            </div>
        `;
    }
    if (state.phase === 'result') {
        const result = state.result || {};
        return `
            <div class="mini-game-card sync-game-round">
                <span>${result.matched ? '默契命中' : '差一点点'}</span>
                <strong>${musicEscapeHtml(result.verdict || '裁判结果')}</strong>
                <p>${musicEscapeHtml(state.question || '')}</p>
                <div class="sync-result-score ${result.matched ? 'matched' : 'missed'}">
                    <b>${Math.round(Number(result.score) || 0)}</b><span>默契度</span>
                </div>
                <div class="sync-answer-compare">
                    <article><span>你的答案</span><p>${musicEscapeHtml(state.userAnswer || '空')}</p></article>
                    <article><span>${musicEscapeHtml(charName)} 的答案</span><p>${musicEscapeHtml(state.charAnswer || '空')}</p>${state.charReason ? `<em>${musicEscapeHtml(state.charReason)}</em>` : ''}</article>
                </div>
                <p class="sync-judge-reason">${musicEscapeHtml(result.reason || '')}</p>
                <div class="sync-game-actions">
                    <button type="button" onclick="startSyncMiniGame()"><i class="ri-sparkling-2-line"></i> 再来一题</button>
                    <button type="button" class="ghost" onclick="resetSyncMiniGame()">重新准备</button>
                </div>
            </div>
        `;
    }
    if (state.phase === 'error') {
        return `
            <div class="mini-game-card sync-game-round">
                <span>默契问答</span>
                <strong>这一题暂时失败</strong>
                <p>${musicEscapeHtml(state.error || '没有生成成功。')}</p>
                <button type="button" onclick="startSyncMiniGame()" ${char ? '' : 'disabled'}><i class="ri-refresh-line"></i> 重试</button>
            </div>
        `;
    }
    return '';
}

function renderSyncGame(el) {
    const chars = getWolfchaCharacters();
    const selectedId = getSyncGameCharId();
    const char = getSyncGameChar();
    const savedState = getSyncGameState();
    const state = char && savedState?.selectedCharId === char.id ? savedState : null;
    el.innerHTML = `
        <section class="mini-game-panel">
            <div class="sync-player-card">
                <span>选择陪玩的角色</span>
                <div class="sync-player-list">
                    ${chars.length ? chars.map(item => `
                        <button type="button" class="${item.id === selectedId ? 'active' : ''}" onclick="selectSyncGameChar('${musicEscapeAttr(item.id)}')">
                            <div>${item.avatar ? `<img src="${musicEscapeAttr(item.avatar)}" alt="${musicEscapeAttr(getMusicCharName(item))}">` : '<i class="ri-user-smile-line"></i>'}</div>
                            <strong>${musicEscapeHtml(getMusicCharName(item))}</strong>
                        </button>
                    `).join('') : '<p>先在微信导入角色，再一起玩默契问答。</p>'}
                </div>
            </div>
            ${renderSyncGameRound(char, state)}
        </section>
    `;
}

async function startSyncMiniGame() {
    const char = getSyncGameChar();
    if (!char) {
        if (typeof showWechatToast === 'function') showWechatToast('先选择一个陪你玩的角色');
        return;
    }
    saveSyncGameState({ phase: 'asking', selectedCharId: char.id, startedAt: Date.now() });
    renderGameApp();
    try {
        let questionData = pickSyncFallbackQuestion();
        if (typeof callChatApi === 'function') {
            const questionResult = await callChatApi(buildSyncJudgeQuestionMessages(char), { max_tokens: 520, temperature: 0.72 });
            if (questionResult && questionResult.ok) questionData = normalizeSyncQuestionPayload(extractSyncJsonPayload(questionResult.content));
        }
        let charData = normalizeSyncCharAnswerPayload(null, char);
        if (typeof callChatApi === 'function') {
            const charResult = await callChatApi(buildSyncCharAnswerMessages(char, questionData.question), { max_tokens: 420, temperature: 0.68 });
            if (charResult && charResult.ok) charData = normalizeSyncCharAnswerPayload(extractSyncJsonPayload(charResult.content) || { answer: charResult.content }, char);
        }
        saveSyncGameState({
            phase: 'answering',
            selectedCharId: char.id,
            question: questionData.question,
            judgeTip: questionData.judgeTip,
            charAnswer: charData.answer,
            charReason: charData.reason,
            userAnswer: '',
            startedAt: Date.now()
        });
    } catch (e) {
        saveSyncGameState({ phase: 'error', selectedCharId: char.id, error: `这一题暂时没连上裁判：${e.message || e}` });
    }
    renderGameApp();
}
window.startSyncMiniGame = startSyncMiniGame;

async function submitSyncGameAnswer() {
    const char = getSyncGameChar();
    const state = getSyncGameState();
    const input = document.getElementById('sync-user-answer');
    const answer = cleanSyncGameText(input && input.value, 90);
    if (!char || !state || state.phase !== 'answering') return;
    if (!answer) {
        if (typeof showWechatToast === 'function') showWechatToast('先写下你的答案');
        return;
    }
    const judgingState = { ...state, userAnswer: answer, phase: 'judging' };
    saveSyncGameState(judgingState);
    renderGameApp();
    try {
        let resultData = normalizeSyncJudgePayload(null, judgingState);
        if (typeof callChatApi === 'function') {
            const result = await callChatApi(buildSyncJudgeResultMessages(judgingState), { max_tokens: 520, temperature: 0.35 });
            if (result && result.ok) resultData = normalizeSyncJudgePayload(extractSyncJsonPayload(result.content), judgingState);
        }
        saveSyncGameState({ ...judgingState, phase: 'result', result: resultData });
    } catch (e) {
        const resultData = normalizeSyncJudgePayload(null, judgingState);
        resultData.reason = `裁判 API 暂时不可用，先按文本相似度判定：${resultData.reason}`;
        saveSyncGameState({ ...judgingState, phase: 'result', result: resultData });
    }
    renderGameApp();
}
window.submitSyncGameAnswer = submitSyncGameAnswer;

function resetSyncMiniGame() {
    clearSyncGameState();
    renderGameApp();
}
window.resetSyncMiniGame = resetSyncMiniGame;

function getTodayDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function shouldShowCardMatchRules() {
    return localStorage.getItem(CARDMATCH_RULES_SKIP_KEY) !== getTodayDateKey();
}

function closeCardMatchRules(skipToday = false) {
    if (skipToday) localStorage.setItem(CARDMATCH_RULES_SKIP_KEY, getTodayDateKey());
    document.getElementById('cardmatch-rules-overlay')?.classList.add('hidden');
}
window.closeCardMatchRules = closeCardMatchRules;

function renderCardMatchGame(el) {
    const cards = getStudyCards();
    const card = cards.length ? cards[Math.floor(Math.random() * cards.length)] : null;
    const languages = getStudyLanguages().filter(lang => card?.lines?.[lang.id]);
    const showRules = shouldShowCardMatchRules();
    el.innerHTML = `
        <section class="mini-game-panel">
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
            <div id="cardmatch-rules-overlay" class="cardmatch-rules-overlay ${showRules ? '' : 'hidden'}">
                <div class="cardmatch-rules-card">
                    <span>语言翻牌规则</span>
                    <strong>先看第一行，再自己回忆其他语言</strong>
                    <p>每次随机抽一张学习卡。第一行会显示出来，其他行先遮住，你先在心里回忆，再点换一张继续练习。</p>
                    <div>
                        <button type="button" onclick="closeCardMatchRules(false)">开始游戏</button>
                        <button type="button" class="primary" onclick="closeCardMatchRules(true)">今日不再提示</button>
                    </div>
                </div>
            </div>
        </section>
    `;
}

function createCatPotOrder(level = 1) {
    const shuffled = [...CATPOT_INGREDIENTS].sort(() => Math.random() - 0.5);
    const kindCount = Math.min(4, 2 + Math.floor(Math.max(1, level) / 4));
    const maxTotal = Math.min(6, 3 + Math.floor(Math.max(1, level) / 5));
    const wants = {};
    let total = 0;
    shuffled.slice(0, kindCount).forEach((item, index) => {
        const canDouble = level > 1 && total < maxTotal - 1 && (index === 0 || Math.random() > 0.62);
        const count = canDouble ? 2 : 1;
        wants[item.id] = count;
        total += count;
    });
    const guest = CATPOT_CATS[Math.floor(Math.random() * CATPOT_CATS.length)] || CATPOT_CATS[0];
    return { ...guest, wants, bornAt: Date.now(), patienceMs: Math.max(12000, CATPOT_CUSTOMER_PATIENCE_MS - Math.min(7000, level * 420)) };
}

function isValidCatPotOrder(order) {
    return order && order.wants && Object.keys(order.wants).some(id => CATPOT_INGREDIENTS.some(item => item.id === id));
}

function createCatPotOrders(level = 1, count = CATPOT_CUSTOMER_COUNT) {
    return Array.from({ length: count }, (_, index) => createCatPotOrder(level + index));
}

function createCatPotState(level = 1, score = 0, streak = 0, order = null) {
    const now = Date.now();
    return {
        level: Math.max(1, Number(level) || 1),
        order: isValidCatPotOrder(order) ? order : createCatPotOrder(level),
        orders: isValidCatPotOrder(order) ? [order, ...createCatPotOrders(level + 1, CATPOT_CUSTOMER_COUNT - 1)] : createCatPotOrders(level),
        placed: [],
        score,
        streak,
        missed: 0,
        wrongs: 0,
        served: score,
        target: CATPOT_TARGET_CUSTOMERS,
        roundStartedAt: now,
        roundEndsAt: now + CATPOT_ROUND_MS,
        rush: 1,
        finished: false,
        feedback: '早餐高峰开始啦，连续给猫猫们出餐。',
        feedbackType: 'ready',
        justCompleted: false
    };
}

function normalizeCatPotState(state) {
    const now = Date.now();
    const level = Math.max(1, Number(state.level) || Number(state.orderIndex) + 1 || 1);
    const normalized = {
        ...createCatPotState(level, Number(state.score) || 0, Number(state.streak) || 0, state.order),
        ...state,
        level,
        score: Number(state.score) || 0,
        streak: Number(state.streak) || 0,
        missed: Number(state.missed) || 0,
        wrongs: Number(state.wrongs) || 0,
        served: Number(state.served) || Number(state.score) || 0,
        target: Number(state.target) || CATPOT_TARGET_CUSTOMERS,
        rush: Number(state.rush) || 1,
        roundStartedAt: Number(state.roundStartedAt) || now,
        roundEndsAt: Number(state.roundEndsAt) || (now + CATPOT_ROUND_MS),
        orders: Array.isArray(state.orders) && state.orders.some(isValidCatPotOrder) ? state.orders.filter(isValidCatPotOrder).slice(0, CATPOT_CUSTOMER_COUNT) : (isValidCatPotOrder(state.order) ? [state.order] : createCatPotOrders(level)),
        placed: Array.isArray(state.placed) ? state.placed.filter(id => CATPOT_INGREDIENTS.some(item => item.id === id)).slice(0, 9) : []
    };
    while (normalized.orders.length < CATPOT_CUSTOMER_COUNT) normalized.orders.push(createCatPotOrder(normalized.level + normalized.orders.length));
    normalized.order = normalized.orders[0];
    if (!Number(normalized.order.bornAt)) normalized.order.bornAt = now;
    if (!Number(normalized.order.patienceMs)) normalized.order.patienceMs = Math.max(12000, CATPOT_CUSTOMER_PATIENCE_MS - Math.min(7000, level * 420));
    if (now >= normalized.roundEndsAt) {
        normalized.finished = true;
        normalized.placed = [];
        normalized.feedback = `营业结束：服务 ${normalized.served || 0} 位猫猫，错菜 ${normalized.wrongs || 0} 次，走失 ${normalized.missed || 0} 位。`;
        normalized.feedbackType = (normalized.served || 0) >= 8 ? 'served' : 'ready';
    } else if (!normalized.finished) {
        const activeOrder = normalized.orders[0];
        const activePatience = activeOrder.patienceMs || CATPOT_CUSTOMER_PATIENCE_MS;
        const activeExpired = now - (activeOrder.bornAt || now) > activePatience;
        if (activeExpired) {
            normalized.orders.shift();
            normalized.missed += 1;
            normalized.streak = 0;
            normalized.level += 1;
            while (normalized.orders.length < CATPOT_CUSTOMER_COUNT) normalized.orders.push(createCatPotOrder(normalized.level + normalized.orders.length));
            if (normalized.orders[0]) normalized.orders[0].bornAt = now;
            normalized.order = normalized.orders[0];
            normalized.feedback = '有猫猫等太久走掉了，别让下一位空等。';
            normalized.feedbackType = 'wrong';
        }
        normalized.order = normalized.orders[0];
    }
    return normalized;
}

function getCatPotState() {
    try {
        const state = JSON.parse(localStorage.getItem(CATPOT_STATE_KEY) || '{}');
        if (state && Array.isArray(state.placed)) {
            const normalized = normalizeCatPotState(state);
            if (JSON.stringify(normalized) !== JSON.stringify(state)) saveCatPotState(normalized);
            return normalized;
        }
    } catch (e) {}
    const state = createCatPotState();
    saveCatPotState(state);
    return state;
}

function saveCatPotState(state) {
    localStorage.setItem(CATPOT_STATE_KEY, JSON.stringify(state));
}

function getCatPotOrder(state) {
    if (!Array.isArray(state.orders) || !state.orders.some(isValidCatPotOrder)) {
        state.orders = createCatPotOrders(state.level || 1);
    }
    state.orders = state.orders.filter(isValidCatPotOrder);
    while (state.orders.length < CATPOT_CUSTOMER_COUNT) {
        state.orders.push(createCatPotOrder((state.level || 1) + state.orders.length));
    }
    state.order = state.orders[0];
    return state.order;
}

function getCatPotIngredient(id) {
    return CATPOT_INGREDIENTS.find(item => item.id === id) || CATPOT_INGREDIENTS[0];
}

function countCatPotPlaced(state) {
    return state.placed.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
    }, {});
}

function isCatPotOrderComplete(state) {
    const order = getCatPotOrder(state);
    const counts = countCatPotPlaced(state);
    return Object.entries(order.wants).every(([id, need]) => (counts[id] || 0) >= need);
}

function isCatPotPlateExactMatch(order, counts) {
    if (!isValidCatPotOrder(order)) return false;
    const wantedIds = Object.keys(order.wants);
    const plateIds = Object.keys(counts).filter(id => counts[id] > 0);
    if (wantedIds.length !== plateIds.length) return false;
    return wantedIds.every(id => (counts[id] || 0) === order.wants[id]);
}

function findCatPotMatchingOrder(state) {
    const counts = countCatPotPlaced(state);
    return (state.orders || []).find(order => isCatPotPlateExactMatch(order, counts)) || null;
}

function catPotPlaySound(type) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!window._catPotAudioCtx) window._catPotAudioCtx = new AudioCtx();
        const ctx = window._catPotAudioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        const notes = type === 'success' ? [523, 659, 784] : type === 'wrong' ? [196, 164] : type === 'drop' ? [392, 523] : [440];
        notes.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type === 'wrong' ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(freq, now + index * 0.07);
            gain.gain.setValueAtTime(0.0001, now + index * 0.07);
            gain.gain.exponentialRampToValueAtTime(type === 'success' ? 0.16 : 0.1, now + index * 0.07 + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.07 + 0.16);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + index * 0.07);
            osc.stop(now + index * 0.07 + 0.18);
        });
    } catch (e) {}
}

function catPotAddIngredient(id) {
    const item = getCatPotIngredient(id);
    const state = getCatPotState();
    if (state.finished) {
        resetCatPotGame();
        return;
    }
    const counts = countCatPotPlaced(state);
    if (state.placed.length >= 7) {
        state.feedback = '这份餐已经太满了，先上菜或清盘。';
        state.feedbackType = 'wrong';
        state.justCompleted = false;
        saveCatPotState(state);
        catPotPlaySound('wrong');
        renderGameApp();
        return;
    }
    state.placed.push(id);
    const matched = findCatPotMatchingOrder(state);
    state.justCompleted = !!matched;
    state.feedback = matched ? `这份餐匹配 ${matched.cat}，可以上菜。` : `${item.name} 已加入餐盘，继续对照顾客订单。`;
    state.feedbackType = state.justCompleted ? 'complete' : 'drop';
    saveCatPotState(state);
    catPotPlaySound(state.justCompleted ? 'success' : 'drop');
    renderGameApp();
}
window.catPotAddIngredient = catPotAddIngredient;

function catPotRemoveIngredient(index) {
    const state = getCatPotState();
    if (state.finished) return;
    if (index < 0 || index >= state.placed.length) return;
    const [removed] = state.placed.splice(index, 1);
    state.justCompleted = false;
    state.feedback = `${getCatPotIngredient(removed).name} 回到篮子里了。`;
    state.feedbackType = 'ready';
    saveCatPotState(state);
    catPotPlaySound('tap');
    renderGameApp();
}
window.catPotRemoveIngredient = catPotRemoveIngredient;

function catPotServe() {
    const state = getCatPotState();
    if (state.finished) {
        resetCatPotGame();
        return;
    }
    const matched = findCatPotMatchingOrder(state);
    if (!matched) {
        state.feedback = state.placed.length ? '错菜！这份餐不属于任何正在等的顾客，扣连击。' : '餐盘是空的，不能上菜。';
        state.feedbackType = 'wrong';
        state.justCompleted = false;
        state.streak = 0;
        state.wrongs = (state.wrongs || 0) + 1;
        state.roundEndsAt = Math.max(Date.now() + 8000, (state.roundEndsAt || Date.now()) - 3000);
        if (Array.isArray(state.orders) && state.orders[0]) {
            state.orders[0].bornAt = Math.max(Date.now() - (state.orders[0].patienceMs || CATPOT_CUSTOMER_PATIENCE_MS) + 5000, (state.orders[0].bornAt || Date.now()) - 3000);
        }
        saveCatPotState(state);
        catPotPlaySound('wrong');
        renderGameApp();
        return;
    }
    const wasFrontOrder = Array.isArray(state.orders) && state.orders[0] === matched;
    const next = createCatPotState((state.level || 1) + 1, state.score + 1, state.streak + 1);
    next.roundStartedAt = state.roundStartedAt;
    next.roundEndsAt = state.roundEndsAt;
    next.missed = state.missed || 0;
    next.wrongs = state.wrongs || 0;
    next.served = (state.served || state.score || 0) + 1;
    next.target = state.target || CATPOT_TARGET_CUSTOMERS;
    next.rush = Math.min(5, 1 + Math.floor((state.score + 1) / 3));
    next.orders = (state.orders || []).filter(order => order !== matched);
    while (next.orders.length < CATPOT_CUSTOMER_COUNT) next.orders.push(createCatPotOrder(next.level + next.orders.length));
    if (wasFrontOrder && next.orders[0]) next.orders[0].bornAt = Date.now();
    next.order = next.orders[0];
    const fast = getCatPotPatienceLeft(matched) >= 70;
    if (fast) {
        next.score += 1;
        next.feedback = `${matched.cat} 收到正确早餐，快速出餐 +1 小费。`;
    } else {
        next.feedback = `${matched.cat} 收到正确早餐，下一位马上来。`;
    }
    next.feedbackType = 'served';
    next.justCompleted = true;
    if (next.served >= next.target) {
        next.finished = true;
        next.placed = [];
        next.feedback = `营业结束：服务 ${next.served} 位猫猫，错菜 ${next.wrongs || 0} 次，走失 ${next.missed || 0} 位。`;
        next.feedbackType = 'served';
    }
    saveCatPotState(next);
    catPotPlaySound('success');
    renderGameApp();
}
window.catPotServe = catPotServe;

function resetCatPotGame() {
    const state = createCatPotState();
    saveCatPotState(state);
    catPotPlaySound('tap');
    renderGameApp();
}
window.resetCatPotGame = resetCatPotGame;

function catPotClearPlate() {
    const state = getCatPotState();
    state.placed = [];
    state.justCompleted = false;
    state.feedback = '餐盘已清空，重新按顾客订单制作。';
    state.feedbackType = 'ready';
    saveCatPotState(state);
    catPotPlaySound('tap');
    renderGameApp();
}
window.catPotClearPlate = catPotClearPlate;

function getCatPotTimeLeft(state) {
    return Math.max(0, Math.ceil(((state.roundEndsAt || Date.now()) - Date.now()) / 1000));
}

function getCatPotPatienceLeft(order) {
    const left = Math.max(0, (order.bornAt || Date.now()) + (order.patienceMs || CATPOT_CUSTOMER_PATIENCE_MS) - Date.now());
    return Math.max(0, Math.min(100, Math.round((left / (order.patienceMs || CATPOT_CUSTOMER_PATIENCE_MS)) * 100)));
}

function renderCatPotFoodIcon(item, extraClass = '') {
    return `<img class="catpot-food-img ${extraClass}" src="${musicEscapeAttr(item.asset)}" alt="${musicEscapeAttr(item.name)}">`;
}

function renderCatPotGame(el) {
    const state = getCatPotState();
    const order = getCatPotOrder(state);
    const counts = countCatPotPlaced(state);
    const complete = !!findCatPotMatchingOrder(state);
    const timeLeft = getCatPotTimeLeft(state);
    const patienceLeft = getCatPotPatienceLeft(order);
    const queueCount = Math.max(0, (state.target || CATPOT_TARGET_CUSTOMERS) - (state.served || 0));
    const placed = state.placed.map((id, index) => {
        const item = getCatPotIngredient(id);
        return `
            <button type="button" class="catpot-placed catpot-placed-${index}" onclick="catPotRemoveIngredient(${index})" title="拿回 ${musicEscapeAttr(item.name)}">
                ${renderCatPotFoodIcon(item, 'in-pot')}
            </button>
        `;
    }).join('');
    el.innerHTML = `
        <section class="catpot-game" data-catpot-order="${musicEscapeAttr(String(order.bornAt || ''))}" data-catpot-finished="${state.finished ? '1' : '0'}">
            <div class="catpot-bg"></div>
            <div class="catpot-order-card">
                <div class="catpot-cat">
                    <img class="catpot-cat-art" src="assets/cat-breakfast-pot/ui/cat-customer.png" alt="猫猫客人">
                    <div>
                        <span>早餐高峰</span>
                        <strong>按订单配餐</strong>
                    </div>
                </div>
                <div class="catpot-stats">
                    <span>时间 <b data-catpot-time>${timeLeft}s</b></span>
                    <span>营业 <b data-catpot-score>${state.served || 0}/${state.target || CATPOT_TARGET_CUSTOMERS}</b></span>
                    <span>待客 <b data-catpot-queue>${queueCount}</b></span>
                </div>
                <div class="catpot-patience"><i data-catpot-patience style="width:${patienceLeft}%"></i></div>
                <div class="catpot-ticket">
                    <div class="catpot-current-guest">
                        <span>当前 ${musicEscapeHtml(order.cat)}</span>
                        <b>${patienceLeft}%</b>
                    </div>
                    <div class="catpot-main-order-grid">
                        ${Object.entries(order.wants).map(([id, need]) => {
                            const item = getCatPotIngredient(id);
                            const done = counts[id] || 0;
                            return `
                                <div class="catpot-order-sticker ${done === need ? 'done' : ''} ${done > need ? 'over' : ''}">
                                    ${renderCatPotFoodIcon(item, 'order')}
                                    <b>${done}/${need}</b>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="catpot-queue-strip">
                        ${(state.orders || []).slice(1).map(guest => `
                            <span>${musicEscapeHtml(guest.cat)} 候餐</span>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="catpot-pot-wrap ${complete ? 'complete' : ''} ${state.feedbackType === 'wrong' ? 'shake' : ''} ${state.rush >= 3 ? 'rush' : ''}">
                <div class="catpot-pot">
                    <img class="catpot-pot-art" src="assets/cat-breakfast-pot/ui/pot-empty.png" alt="空猫耳早餐锅">
                    ${placed || '<div class="catpot-empty">把食材放进猫耳早餐锅</div>'}
                    <img class="catpot-sparkles" src="assets/cat-breakfast-pot/ui/sparkles.png" alt="">
                </div>
                <div class="catpot-feedback ${state.feedbackType}">${musicEscapeHtml(state.feedback)}</div>
            </div>
            <div class="catpot-basket">
                <img class="catpot-basket-art" src="assets/cat-breakfast-pot/ui/basket.png" alt="">
                ${CATPOT_INGREDIENTS.map(item => {
                    const disabled = state.placed.length >= 7;
                    return `
                        <button type="button" class="catpot-food-btn ${disabled ? 'muted' : ''}" onclick="catPotAddIngredient('${musicEscapeAttr(item.id)}')">
                            ${renderCatPotFoodIcon(item)}
                            <span>${musicEscapeHtml(item.name)}</span>
                        </button>
                    `;
                }).join('')}
            </div>
            <div class="catpot-actions">
                <button type="button" onclick="catPotClearPlate()"><i class="ri-delete-bin-line"></i> 清盘</button>
                <button type="button" class="catpot-serve ${complete ? 'ready' : ''}" onclick="catPotServe()"><i class="ri-paw-print-fill"></i> ${state.finished ? '再开一局' : '上菜'}</button>
            </div>
        </section>
    `;
    if (!window._catPotRushTimer) {
        window._catPotRushTimer = setInterval(() => {
            if (!getActiveGame || getActiveGame() !== 'catpot') return;
            const current = getCatPotState();
            const timeNode = document.querySelector('[data-catpot-time]');
            const scoreNode = document.querySelector('[data-catpot-score]');
            const queueNode = document.querySelector('[data-catpot-queue]');
            const patienceNode = document.querySelector('[data-catpot-patience]');
            if (timeNode) timeNode.textContent = `${getCatPotTimeLeft(current)}s`;
            if (scoreNode) scoreNode.textContent = `${current.served || 0}/${current.target || CATPOT_TARGET_CUSTOMERS}`;
            if (queueNode) queueNode.textContent = String(Math.max(0, (current.target || CATPOT_TARGET_CUSTOMERS) - (current.served || 0)));
            if (patienceNode) patienceNode.style.width = `${getCatPotPatienceLeft(getCatPotOrder(current))}%`;
            const root = document.querySelector('.catpot-game');
            const renderedOrder = root ? root.getAttribute('data-catpot-order') : '';
            const currentOrder = String(getCatPotOrder(current).bornAt || '');
            const renderedFinished = root ? root.getAttribute('data-catpot-finished') === '1' : false;
            if (current.finished !== renderedFinished || (currentOrder && renderedOrder && currentOrder !== renderedOrder)) renderGameApp();
        }, 1000);
    }
}

function create2048State() {
    const state = { board: Array.from({ length: 4 }, () => Array(4).fill(0)), score: 0, moves: 0, over: false };
    add2048Tile(state);
    add2048Tile(state);
    return state;
}

function get2048State() {
    try {
        const state = JSON.parse(localStorage.getItem(GAME_2048_STATE_KEY) || '{}');
        if (Array.isArray(state.board) && state.board.length === 4) return state;
    } catch (e) {}
    const state = create2048State();
    save2048State(state);
    return state;
}

function save2048State(state) {
    localStorage.setItem(GAME_2048_STATE_KEY, JSON.stringify(state));
}

function add2048Tile(state) {
    const empty = [];
    state.board.forEach((row, r) => row.forEach((value, c) => { if (!value) empty.push([r, c]); }));
    if (!empty.length) return false;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    state.board[r][c] = Math.random() < 0.9 ? 2 : 4;
    return true;
}

function compress2048Line(line, state) {
    const nums = line.filter(Boolean);
    const result = [];
    for (let i = 0; i < nums.length; i += 1) {
        if (nums[i] && nums[i] === nums[i + 1]) {
            const merged = nums[i] * 2;
            result.push(merged);
            state.score += merged;
            i += 1;
        } else {
            result.push(nums[i]);
        }
    }
    while (result.length < 4) result.push(0);
    return result;
}

function canMove2048(state) {
    for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 4; c += 1) {
            if (!state.board[r][c]) return true;
            if (r < 3 && state.board[r][c] === state.board[r + 1][c]) return true;
            if (c < 3 && state.board[r][c] === state.board[r][c + 1]) return true;
        }
    }
    return false;
}

function move2048(direction) {
    const state = get2048State();
    if (state.over) return;
    const before = JSON.stringify(state.board);
    if (direction === 'left' || direction === 'right') {
        state.board = state.board.map(row => {
            const source = direction === 'right' ? [...row].reverse() : [...row];
            const merged = compress2048Line(source, state);
            return direction === 'right' ? merged.reverse() : merged;
        });
    } else {
        for (let c = 0; c < 4; c += 1) {
            const source = [];
            for (let r = 0; r < 4; r += 1) source.push(state.board[r][c]);
            const merged = compress2048Line(direction === 'down' ? source.reverse() : source, state);
            const finalLine = direction === 'down' ? merged.reverse() : merged;
            for (let r = 0; r < 4; r += 1) state.board[r][c] = finalLine[r];
        }
    }
    if (JSON.stringify(state.board) !== before) {
        state.moves += 1;
        add2048Tile(state);
        state.over = !canMove2048(state);
        save2048State(state);
        renderGameApp();
    }
}
window.move2048 = move2048;

function reset2048Game() {
    const state = create2048State();
    save2048State(state);
    renderGameApp();
}
window.reset2048Game = reset2048Game;

function bind2048Gestures() {
    const board = document.getElementById('game-2048-board');
    if (!board || board.dataset.bound) return;
    board.dataset.bound = '1';
    let sx = 0;
    let sy = 0;
    board.addEventListener('pointerdown', event => {
        sx = event.clientX;
        sy = event.clientY;
    });
    board.addEventListener('pointerup', event => {
        const dx = event.clientX - sx;
        const dy = event.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
        move2048(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    if (!window._bynd2048KeyboardBound) {
        window._bynd2048KeyboardBound = true;
        window.addEventListener('keydown', event => {
            if (getActiveGame() !== '2048') return;
            const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
            if (!map[event.key]) return;
            event.preventDefault();
            move2048(map[event.key]);
        });
    }
}

function render2048Game(el) {
    const state = get2048State();
    const maxTile = Math.max(...state.board.flat(), 0);
    el.innerHTML = `
        <section class="mini-game-panel game2048-panel">
            <div class="game2048-top">
                <div><span>2048</span><strong>${state.over ? '本局结束' : '合成更高数字'}</strong><p>滑动棋盘或点方向键移动。</p></div>
                <button type="button" onclick="reset2048Game()"><i class="ri-refresh-line"></i> 新局</button>
            </div>
            <div class="game2048-stats"><span>分数 <b>${state.score || 0}</b></span><span>最高 <b>${maxTile}</b></span><span>步数 <b>${state.moves || 0}</b></span></div>
            <div id="game-2048-board" class="game2048-board">
                ${state.board.flat().map(value => `<div class="tile-${value || 0}">${value || ''}</div>`).join('')}
            </div>
            <div class="game2048-controls">
                <button type="button" onclick="move2048('up')"><i class="ri-arrow-up-s-line"></i></button>
                <button type="button" onclick="move2048('left')"><i class="ri-arrow-left-s-line"></i></button>
                <button type="button" onclick="move2048('down')"><i class="ri-arrow-down-s-line"></i></button>
                <button type="button" onclick="move2048('right')"><i class="ri-arrow-right-s-line"></i></button>
            </div>
        </section>
    `;
    requestAnimationFrame(bind2048Gestures);
}

function playMiniGameSound(kind = 'tap') {
    const audio = typeof unlockChickenAudio === 'function' ? unlockChickenAudio() : null;
    const ctx = audio?.ctx || (typeof getChickenAudioContext === 'function' ? getChickenAudioContext() : null);
    if (!ctx) return;
    const run = () => {
        try {
            const now = ctx.currentTime;
            const sounds = {
                coin: [
                    { f: 920, to: 1180, t: 0, d: 0.085, v: 0.15, type: 'sine' },
                    { f: 1540, t: 0.055, d: 0.10, v: 0.12, type: 'triangle' }
                ],
                bigCoin: [
                    { f: 760, to: 1220, t: 0, d: 0.12, v: 0.16, type: 'sine' },
                    { f: 1320, to: 1760, t: 0.08, d: 0.15, v: 0.14, type: 'triangle' },
                    { f: 2090, t: 0.18, d: 0.12, v: 0.10, type: 'sine' }
                ],
                jump: [
                    { f: 240, to: 560, t: 0, d: 0.20, v: 0.09, type: 'triangle' }
                ],
                land: [
                    { f: 320, to: 220, t: 0, d: 0.16, v: 0.10, type: 'sine' }
                ],
                fail: [
                    { f: 180, to: 96, t: 0, d: 0.26, v: 0.11, type: 'sawtooth' }
                ],
                water: [
                    { f: 430, to: 250, t: 0, d: 0.38, v: 0.075, type: 'sine' },
                    { f: 280, to: 170, t: 0.05, d: 0.42, v: 0.05, type: 'triangle' }
                ],
                win: [
                    { f: 523.25, t: 0, d: 0.11, v: 0.12, type: 'sine' },
                    { f: 659.25, t: 0.1, d: 0.11, v: 0.12, type: 'sine' },
                    { f: 783.99, t: 0.2, d: 0.16, v: 0.13, type: 'triangle' }
                ]
            };
            const notes = sounds[kind] || sounds.coin;
            const master = ctx.createGain();
            master.gain.setValueAtTime(0.0001, now);
            master.gain.exponentialRampToValueAtTime(0.95, now + 0.012);
            master.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(...notes.map(note => note.t + note.d)) + 0.08);
            master.connect(ctx.destination);
            notes.forEach(note => {
                const start = now + note.t;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = note.type || 'sine';
                osc.frequency.setValueAtTime(note.f, start);
                if (note.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, note.to), start + note.d);
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(note.v, start + 0.012);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + note.d);
                osc.connect(gain);
                gain.connect(master);
                osc.start(start);
                osc.stop(start + note.d + 0.04);
            });
            setTimeout(() => {
                try { master.disconnect(); } catch (e) {}
            }, Math.ceil((Math.max(...notes.map(note => note.t + note.d)) + 0.18) * 1000));
        } catch (e) {}
    };
    if (ctx.state === 'suspended') {
        audio?.resume?.then(run);
    } else {
        run();
    }
}

let jumpChargeTimer = 0;
let jumpAnimating = false;

const JUMP_FIELD_W = 344;
const JUMP_FIELD_H = 430;
const JUMP_PLATFORM_H = 36;
const JUMP_PLAYER_H = 42;
const JUMP_CURRENT_BASE = { x: 88, y: 86, w: 92, h: JUMP_PLATFORM_H, type: 'start', label: 'BYND' };
const JUMP_SCENES = [
    { name: '清晨街角', skyA: '#a9dcff', skyB: '#f8fcff', groundA: '#c8efbf', groundB: '#78d8b0', accent: '#ffb34d' },
    { name: '雨后便利店', skyA: '#cbd9ff', skyB: '#f7faff', groundA: '#d7e5ff', groundB: '#92ace8', accent: '#5e7ce2' },
    { name: '海边公路', skyA: '#a7f0f3', skyB: '#f6fffb', groundA: '#b7eadf', groundB: '#47b4c6', accent: '#ff7a59' },
    { name: '天台霓虹', skyA: '#9da7ff', skyB: '#f4f0ff', groundA: '#d8d3ff', groundB: '#6d6bd6', accent: '#ff5fa2' },
    { name: '午后公园', skyA: '#ffe0aa', skyB: '#fffaf2', groundA: '#d8f0a2', groundB: '#88cb72', accent: '#2fa66a' },
    { name: '午夜车站', skyA: '#18233f', skyB: '#7e8fc8', groundA: '#ccd8f4', groundB: '#54637f', accent: '#ffe16a' }
];
const JUMP_PLATFORM_TYPES = [
    { type: 'store', label: '24H' },
    { type: 'gift', label: 'BOX' },
    { type: 'clock', label: 'TIME' },
    { type: 'music', label: 'PLAY' },
    { type: 'coffee', label: 'CAFE' },
    { type: 'book', label: 'BOOK' },
    { type: 'star', label: 'STAR' }
];

function clampJumpNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getJumpScene(score = 0) {
    return JUMP_SCENES[Math.floor(Math.max(0, score || 0) / 4) % JUMP_SCENES.length];
}

function normalizeJumpPlatform(platform, fallback = JUMP_CURRENT_BASE) {
    const base = platform || fallback;
    return {
        x: Number.isFinite(base.x) ? base.x : fallback.x,
        y: Number.isFinite(base.y) ? base.y : fallback.y,
        w: Number.isFinite(base.w) ? clampJumpNumber(base.w, 54, 112) : fallback.w,
        h: Number.isFinite(base.h) ? base.h : JUMP_PLATFORM_H,
        type: base.type || fallback.type || 'start',
        label: base.label || fallback.label || 'BYND'
    };
}

function createJumpCurrentPlatform(fromTarget = null) {
    const target = fromTarget ? normalizeJumpPlatform(fromTarget, JUMP_CURRENT_BASE) : null;
    return {
        ...JUMP_CURRENT_BASE,
        w: target ? clampJumpNumber(target.w, 58, 104) : JUMP_CURRENT_BASE.w,
        type: target?.type || JUMP_CURRENT_BASE.type,
        label: target?.label || JUMP_CURRENT_BASE.label
    };
}

function createJumpTarget(score = 0) {
    const type = JUMP_PLATFORM_TYPES[(Math.floor(Math.random() * JUMP_PLATFORM_TYPES.length) + Math.max(0, score || 0)) % JUMP_PLATFORM_TYPES.length];
    const widthBase = 88 - Math.min(18, Math.floor((score || 0) / 5) * 2);
    const targetW = clampJumpNumber(widthBase + Math.round(Math.random() * 18) - 7, 58, 98);
    const targetX = 224 + Math.round(Math.random() * 56);
    const targetY = 178 + Math.round(Math.random() * 86);
    return {
        x: targetX,
        y: targetY,
        w: targetW,
        h: JUMP_PLATFORM_H,
        type: type.type,
        label: type.label
    };
}

function createJumpState() {
    const current = createJumpCurrentPlatform();
    return {
        score: 0,
        best: Math.max(0, parseInt(localStorage.getItem(JUMP_GAME_BEST_KEY) || '0', 10) || 0),
        power: 0,
        combo: 0,
        step: 0,
        current,
        target: createJumpTarget(0),
        landing: null,
        message: '按住蓄力，松手跳到前方下一块。',
        over: false
    };
}

function getJumpState() {
    try {
        const state = JSON.parse(localStorage.getItem(JUMP_GAME_STATE_KEY) || '{}');
        if (state && Number.isFinite(state.score) && state.current && state.target) {
            const defaults = createJumpState();
            const merged = { ...defaults, ...state };
            merged.current = normalizeJumpPlatform(merged.current, defaults.current);
            merged.target = normalizeJumpPlatform(merged.target, defaults.target);
            merged.landing = merged.landing && Number.isFinite(merged.landing.x) && Number.isFinite(merged.landing.y) ? merged.landing : null;
            merged.combo = Math.max(0, parseInt(merged.combo || '0', 10) || 0);
            merged.step = Math.max(0, parseInt(merged.step || '0', 10) || 0);
            return merged;
        }
    } catch (e) {}
    const state = createJumpState();
    saveJumpState(state);
    return state;
}

function saveJumpState(state) {
    localStorage.setItem(JUMP_GAME_STATE_KEY, JSON.stringify(state));
}

function resetJumpGame() {
    clearInterval(jumpChargeTimer);
    jumpChargeTimer = 0;
    jumpAnimating = false;
    saveJumpState(createJumpState());
    renderGameApp();
}
window.resetJumpGame = resetJumpGame;

function beginJumpCharge() {
    if (jumpAnimating) return;
    let state = getJumpState();
    if (state.over) {
        state = createJumpState();
        saveJumpState(state);
        const field = document.getElementById('jump-field');
        if (field) {
            applyJumpFieldVars(field, state);
            field.classList.remove('jump-success', 'jump-fail', 'is-jumping');
        }
        document.querySelector('.jump-player')?.classList.remove('fallen');
    }
    clearInterval(jumpChargeTimer);
    state.power = 10;
    state.message = '蓄力中...';
    saveJumpState(state);
    document.getElementById('jump-field')?.classList.add('is-charging');
    renderJumpPower(state.power);
    jumpChargeTimer = setInterval(() => {
        const next = getJumpState();
        next.power = Math.min(100, (next.power || 0) + 4.2);
        saveJumpState(next);
        renderJumpPower(next.power);
    }, 45);
}
window.beginJumpCharge = beginJumpCharge;

function releaseJumpCharge() {
    clearInterval(jumpChargeTimer);
    jumpChargeTimer = 0;
    const state = getJumpState();
    if (state.over || jumpAnimating) return;
    document.getElementById('jump-field')?.classList.remove('is-charging');
    const current = normalizeJumpPlatform(state.current, JUMP_CURRENT_BASE);
    const target = normalizeJumpPlatform(state.target, createJumpTarget(state.score || 0));
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const targetDistance = Math.max(1, Math.hypot(dx, dy));
    const jumpDistance = (state.power || 0) * 2.45;
    const ratio = jumpDistance / targetDistance;
    const landingX = current.x + dx * ratio;
    const landingY = current.y + dy * ratio;
    const distanceError = jumpDistance - targetDistance;
    const hitTolerance = Math.max(24, target.w * 0.42);
    const perfect = Math.abs(distanceError) <= 10;
    const nextState = { ...state, power: 0 };
    if (Math.abs(distanceError) <= hitTolerance) {
        const combo = perfect ? Math.min(10, (state.combo || 0) + 2) : 0;
        nextState.combo = combo;
        nextState.score += perfect ? combo : 1;
        nextState.best = Math.max(nextState.best || 0, nextState.score || 0);
        localStorage.setItem(JUMP_GAME_BEST_KEY, String(nextState.best));
        nextState.current = createJumpCurrentPlatform(target);
        nextState.target = createJumpTarget(nextState.score);
        nextState.step = (state.step || 0) + 1;
        nextState.landing = null;
        nextState.message = perfect ? `中心落点，连中 +${combo}。` : '落稳了，镜头继续向前。';
    } else {
        nextState.over = true;
        nextState.combo = 0;
        nextState.landing = {
            x: clampJumpNumber(landingX, 24, JUMP_FIELD_W - 24),
            y: clampJumpNumber(landingY, 34, JUMP_FIELD_H - 86)
        };
        nextState.message = distanceError < 0 ? '差一点，跳短了。' : '用力过猛，跳过啦。';
    }
    animateJumpResult({ x: landingX, y: landingY }, !nextState.over, nextState, current, target);
}
window.releaseJumpCharge = releaseJumpCharge;

function getJumpPlayerPoint(state, current = normalizeJumpPlatform(state.current, JUMP_CURRENT_BASE)) {
    if (state.over && state.landing) {
        return {
            x: clampJumpNumber(state.landing.x, 24, JUMP_FIELD_W - 24),
            bottom: clampJumpNumber(state.landing.y + JUMP_PLATFORM_H + 2, 48, JUMP_FIELD_H - JUMP_PLAYER_H)
        };
    }
    return {
        x: current.x,
        bottom: current.y + current.h + 2
    };
}

function applyJumpFieldVars(field, state) {
    if (!field) return;
    const current = normalizeJumpPlatform(state.current, JUMP_CURRENT_BASE);
    const target = normalizeJumpPlatform(state.target, createJumpTarget(state.score || 0));
    const player = getJumpPlayerPoint(state, current);
    const scene = getJumpScene(state.score || 0);
    const vars = {
        '--scene-sky-a': scene.skyA,
        '--scene-sky-b': scene.skyB,
        '--scene-ground-a': scene.groundA,
        '--scene-ground-b': scene.groundB,
        '--scene-accent': scene.accent,
        '--current-x': `${current.x}px`,
        '--current-y': `${current.y}px`,
        '--current-w': `${current.w}px`,
        '--target-x': `${target.x}px`,
        '--target-y': `${target.y}px`,
        '--target-w': `${target.w}px`,
        '--player-x': `${player.x}px`,
        '--player-bottom': `${player.bottom}px`
    };
    Object.entries(vars).forEach(([name, value]) => field.style.setProperty(name, value));
}

function animateJumpResult(landing, success, nextState, current, target) {
    jumpAnimating = true;
    playMiniGameSound('jump');
    const field = document.getElementById('jump-field');
    const startBottom = current.y + current.h + 2;
    const landingX = success ? clampJumpNumber(landing.x, target.x - target.w / 2 + 8, target.x + target.w / 2 - 8) : clampJumpNumber(landing.x, 22, JUMP_FIELD_W - 22);
    const landingY = success ? target.y + target.h + 2 : clampJumpNumber(landing.y + JUMP_PLATFORM_H + 2, 44, JUMP_FIELD_H - JUMP_PLAYER_H);
    const midX = (current.x + landingX) / 2;
    const midY = Math.max(startBottom, landingY) + 92;
    if (field) {
        field.style.setProperty('--jump-start-x', `${current.x}px`);
        field.style.setProperty('--jump-start-y', `${startBottom}px`);
        field.style.setProperty('--jump-land-x', `${landingX}px`);
        field.style.setProperty('--jump-land-y', `${landingY}px`);
        field.style.setProperty('--jump-mid-x', `${midX}px`);
        field.style.setProperty('--jump-mid-y', `${Math.min(JUMP_FIELD_H - 24, midY)}px`);
        field.classList.remove('jump-success', 'jump-fail', 'is-jumping');
        field.classList.add(success ? 'jump-success' : 'jump-fail', 'is-jumping');
    }
    setTimeout(() => {
        playMiniGameSound(success ? 'land' : 'fail');
        if (success && field) {
            field.classList.remove('is-jumping');
            field.classList.add('camera-shift');
            setTimeout(() => {
                jumpAnimating = false;
                saveJumpState(nextState);
                renderGameApp();
            }, 260);
            return;
        }
        jumpAnimating = false;
        saveJumpState(nextState);
        renderGameApp();
    }, 520);
}

function renderJumpPower(power) {
    const fill = document.getElementById('jump-power-fill');
    const value = document.getElementById('jump-power-value');
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, power || 0))}%`;
    if (value) value.textContent = `${Math.round(power || 0)}%`;
}

function bindJumpGameInput() {
    const field = document.getElementById('jump-field');
    if (!field || field.dataset.bound) return;
    field.dataset.bound = '1';
    let chargingPointerId = null;
    field.addEventListener('pointerdown', event => {
        if (event.target.closest('button')) return;
        event.preventDefault();
        chargingPointerId = event.pointerId;
        field.setPointerCapture?.(event.pointerId);
        beginJumpCharge();
    });
    field.addEventListener('pointerup', event => {
        event.preventDefault();
        if (chargingPointerId !== null && event.pointerId !== chargingPointerId) return;
        chargingPointerId = null;
        releaseJumpCharge();
    });
    field.addEventListener('pointercancel', () => {
        chargingPointerId = null;
        releaseJumpCharge();
    });
}

function renderJumpGame(el) {
    const state = getJumpState();
    const current = normalizeJumpPlatform(state.current, JUMP_CURRENT_BASE);
    const target = normalizeJumpPlatform(state.target, createJumpTarget(state.score || 0));
    const scene = getJumpScene(state.score || 0);
    const player = getJumpPlayerPoint(state, current);
    const fieldStyle = [
        `--scene-sky-a:${scene.skyA}`,
        `--scene-sky-b:${scene.skyB}`,
        `--scene-ground-a:${scene.groundA}`,
        `--scene-ground-b:${scene.groundB}`,
        `--scene-accent:${scene.accent}`,
        `--current-x:${current.x}px`,
        `--current-y:${current.y}px`,
        `--current-w:${current.w}px`,
        `--target-x:${target.x}px`,
        `--target-y:${target.y}px`,
        `--target-w:${target.w}px`,
        `--player-x:${player.x}px`,
        `--player-bottom:${player.bottom}px`
    ].join(';');
    el.innerHTML = `
        <section class="mini-game-panel jump-panel">
            <div class="jump-top">
                <div><span>JUMP</span><strong>${state.over ? '本局结束' : '跳一跳'}</strong><p>${musicEscapeHtml(state.message || '按住屏幕蓄力。')}</p></div>
                <button type="button" onclick="resetJumpGame()"><i class="ri-refresh-line"></i> 新局</button>
            </div>
            <div class="jump-stats"><span>分数 <b>${state.score || 0}</b></span><span>最高 <b>${state.best || 0}</b></span><span id="jump-power-value">${Math.round(state.power || 0)}%</span></div>
            <div id="jump-field" class="jump-field ${state.over ? 'is-over' : ''}" style="${fieldStyle}">
                <div class="jump-sun"></div>
                <div class="jump-cloud c1"></div>
                <div class="jump-cloud c2"></div>
                <div class="jump-scene-name">${musicEscapeHtml(scene.name)}</div>
                <div class="jump-track"></div>
                <div class="jump-platform start ${musicEscapeHtml(current.type)}"><b>${musicEscapeHtml(current.label)}</b></div>
                <div class="jump-platform target ${musicEscapeHtml(target.type)}"><b>${musicEscapeHtml(target.label)}</b></div>
                <div class="jump-player ${state.over ? 'fallen' : ''}"></div>
                <div class="jump-power"><i id="jump-power-fill" style="width:${Math.round(state.power || 0)}%"></i></div>
            </div>
        </section>
    `;
    requestAnimationFrame(bindJumpGameInput);
}

const WATER_SORT_COLORS = ['#ff5f7e', '#ffbf3d', '#47c97e', '#39a7ff', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#64748b', '#84cc16'];

function getWaterSortBestLevel() {
    return Math.max(1, parseInt(localStorage.getItem(WATER_SORT_BEST_LEVEL_KEY) || '1', 10) || 1);
}

function getWaterSortLevelConfig(level = getWaterSortBestLevel()) {
    const safeLevel = Math.max(1, parseInt(level, 10) || 1);
    const colorCount = Math.min(WATER_SORT_COLORS.length, 3 + Math.floor((safeLevel - 1) / 2));
    const emptyTubes = Math.min(4, 2 + Math.floor((safeLevel - 1) / 5));
    return { level: safeLevel, colorCount, emptyTubes, capacity: 4, tubeCount: colorCount + emptyTubes };
}

function createWaterSortState(level = getWaterSortBestLevel()) {
    const config = getWaterSortLevelConfig(level);
    const colors = WATER_SORT_COLORS.slice(0, config.colorCount);
    const pool = colors.flatMap(color => Array(4).fill(color));
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const tubes = [];
    for (let i = 0; i < config.colorCount; i += 1) tubes.push(pool.slice(i * config.capacity, i * config.capacity + config.capacity));
    for (let i = 0; i < config.emptyTubes; i += 1) tubes.push([]);
    return {
        level: config.level,
        capacity: config.capacity,
        colorCount: config.colorCount,
        tubes,
        selected: null,
        moves: 0,
        message: `第 ${config.level} 关：点一个瓶子，再点目标瓶子倒水。`,
        won: false
    };
}

function getWaterSortState() {
    try {
        const state = JSON.parse(localStorage.getItem(WATER_SORT_STATE_KEY) || '{}');
        if (Array.isArray(state.tubes)) {
            const level = Math.max(1, parseInt(state.level || getWaterSortBestLevel(), 10) || 1);
            return { ...createWaterSortState(level), ...state, level };
        }
    } catch (e) {}
    const state = createWaterSortState();
    saveWaterSortState(state);
    return state;
}

function saveWaterSortState(state) {
    localStorage.setItem(WATER_SORT_STATE_KEY, JSON.stringify(state));
}

function resetWaterSortGame() {
    clearTimeout(window._waterSortAutoNextTimer);
    const current = getWaterSortState();
    saveWaterSortState(createWaterSortState(current.level || getWaterSortBestLevel()));
    renderGameApp();
}
window.resetWaterSortGame = resetWaterSortGame;

function startWaterSortLevel(level) {
    clearTimeout(window._waterSortAutoNextTimer);
    const best = getWaterSortBestLevel();
    const safeLevel = Math.max(1, Math.min(best, parseInt(level, 10) || 1));
    saveWaterSortState(createWaterSortState(safeLevel));
    renderGameApp();
}
window.startWaterSortLevel = startWaterSortLevel;

function nextWaterSortLevel() {
    clearTimeout(window._waterSortAutoNextTimer);
    const state = getWaterSortState();
    const nextLevel = Math.max((state.level || 1) + 1, getWaterSortBestLevel());
    localStorage.setItem(WATER_SORT_BEST_LEVEL_KEY, String(nextLevel));
    saveWaterSortState(createWaterSortState(nextLevel));
    renderGameApp();
}
window.nextWaterSortLevel = nextWaterSortLevel;

function scheduleWaterSortAutoNextLevel(level) {
    clearTimeout(window._waterSortAutoNextTimer);
    window._waterSortAutoNextTimer = setTimeout(() => {
        const current = getWaterSortState();
        if (!current.won || Number(current.level || 1) !== Number(level || 1)) return;
        nextWaterSortLevel();
    }, 900);
}

function isWaterSortWon(tubes) {
    return tubes.every(tube => !tube.length || (tube.length === 4 && tube.every(color => color === tube[0])));
}

function pourWaterSort(tubes, fromIndex, toIndex) {
    const from = tubes[fromIndex] || [];
    const to = tubes[toIndex] || [];
    const capacity = 4;
    if (fromIndex === toIndex || !from.length || to.length >= capacity) return false;
    const color = from[from.length - 1];
    if (to.length && to[to.length - 1] !== color) return false;
    let amount = 0;
    for (let i = from.length - 1; i >= 0 && from[i] === color; i -= 1) amount += 1;
    const pourCount = Math.min(amount, capacity - to.length);
    for (let i = 0; i < pourCount; i += 1) to.push(from.pop());
    return pourCount > 0;
}

function selectWaterTube(index) {
    const state = getWaterSortState();
    if (state.won) return;
    if (state.selected === null || state.selected === undefined) {
        if ((state.tubes[index] || []).length) {
            state.selected = index;
            state.message = '再点一个瓶子倒过去。';
        }
        saveWaterSortState(state);
        renderGameApp();
        return;
    }
    if (state.selected === index) {
        state.selected = null;
        state.message = '已取消选择。';
        saveWaterSortState(state);
        renderGameApp();
        return;
    }
    const ok = pourWaterSort(state.tubes, state.selected, index);
    state.selected = null;
    if (ok) {
        playMiniGameSound('water');
        state.moves += 1;
        state.won = isWaterSortWon(state.tubes);
        if (state.won) {
            const unlocked = Math.max(getWaterSortBestLevel(), (state.level || 1) + 1);
            localStorage.setItem(WATER_SORT_BEST_LEVEL_KEY, String(unlocked));
            state.message = `第 ${state.level || 1} 关完成，正在进入下一关。`;
            setTimeout(() => playMiniGameSound('win'), 170);
            scheduleWaterSortAutoNextLevel(state.level || 1);
        } else {
            state.message = '倒好了，继续整理颜色。';
        }
    } else {
        state.message = '只能倒到空瓶，或倒到同色水上。';
    }
    saveWaterSortState(state);
    renderGameApp();
}
window.selectWaterTube = selectWaterTube;

function renderWaterSortGame(el) {
    const state = getWaterSortState();
    const bestLevel = getWaterSortBestLevel();
    const config = getWaterSortLevelConfig(state.level || 1);
    const columns = Math.min(4, Math.max(3, Math.ceil(Math.sqrt(state.tubes.length))));
    el.innerHTML = `
        <section class="mini-game-panel water-panel">
            <div class="water-top">
                <div><span>WATER SORT</span><strong>${state.won ? `第 ${state.level || 1} 关完成` : `倒水排序 Lv.${state.level || 1}`}</strong><p>${musicEscapeHtml(state.message || '把同色水倒在一起。')}</p></div>
                <button type="button" onclick="resetWaterSortGame()"><i class="ri-refresh-line"></i> 重开</button>
            </div>
            <div class="water-meta"><span>关卡 <b>${state.level || 1}</b></span><span>杯子 <b>${state.tubes.length}</b></span><span>步数 <b>${state.moves || 0}</b></span></div>
            <div class="water-level-actions">
                <button type="button" onclick="startWaterSortLevel(${Math.max(1, (state.level || 1) - 1)})" ${(state.level || 1) <= 1 ? 'disabled' : ''}>上一关</button>
                <span>${state.selected === null || state.selected === undefined ? `已解锁到 ${bestLevel}` : `已选 ${state.selected + 1}`}</span>
                ${state.won ? `<button type="button" class="primary" onclick="nextWaterSortLevel()">下一关</button>` : `<button type="button" onclick="startWaterSortLevel(${Math.min(bestLevel, (state.level || 1) + 1)})" ${bestLevel <= (state.level || 1) ? 'disabled' : ''}>下一关</button>`}
            </div>
            <div class="water-rack" style="--tube-cols:${columns};--tube-count:${state.tubes.length};">
                ${state.tubes.map((tube, index) => `
                    <button type="button" class="water-tube ${state.selected === index ? 'selected' : ''}" onclick="selectWaterTube(${index})">
                        ${Array.from({ length: config.capacity }).map((_, slot) => {
                            const color = tube[slot] || '';
                            return `<i style="${color ? `--water:${musicEscapeAttr(color)}` : ''}"></i>`;
                        }).reverse().join('')}
                    </button>
                `).join('')}
            </div>
        </section>
    `;
    if (waitingUserSpeech) {
        requestAnimationFrame(() => document.getElementById('wolfcha-user-speech-input')?.focus());
    }
}

function isBoardCompanionGame(type) {
    return ['gomoku', 'chess', 'xiangqi'].includes(type);
}

function getBoardGameMeta(type) {
    return GAME_LIBRARY.find(game => game.id === type) || { id: type, title: '棋盘游戏', tag: 'Board duel', accent: '#171a22' };
}

function getBoardGameCharId(type) {
    const chars = getWolfchaCharacters();
    const saved = localStorage.getItem(BOARD_GAME_CHAR_KEY_PREFIX + type);
    return chars.some(char => char.id === saved) ? saved : '';
}

function getBoardGameChar(type) {
    const selectedId = getBoardGameCharId(type);
    return getWolfchaCharacters().find(char => char.id === selectedId) || null;
}

function isBoardGameReady(type) {
    return isBoardCompanionGame(type) && localStorage.getItem(BOARD_GAME_READY_KEY_PREFIX + type) === '1' && !!getBoardGameChar(type);
}

function selectBoardGameChar(type, id) {
    if (!isBoardCompanionGame(type)) return;
    if (!getWolfchaCharacters().some(char => char.id === id)) return;
    localStorage.setItem(BOARD_GAME_CHAR_KEY_PREFIX + type, id);
    renderGameApp();
}
window.selectBoardGameChar = selectBoardGameChar;

function getBoardGameFirstPlayer(type) {
    const saved = localStorage.getItem(BOARD_GAME_FIRST_KEY_PREFIX + type);
    return saved === 'char' ? 'char' : 'user';
}

function setBoardGameFirstPlayer(type, player) {
    if (!isBoardCompanionGame(type)) return;
    localStorage.setItem(BOARD_GAME_FIRST_KEY_PREFIX + type, player === 'char' ? 'char' : 'user');
    renderGameApp();
}
window.setBoardGameFirstPlayer = setBoardGameFirstPlayer;

function getBoardGameFirstSide(type) {
    if (type === 'gomoku') return 'black';
    if (type === 'xiangqi') return 'red';
    return 'white';
}

function getBoardGameSecondSide(type) {
    if (type === 'gomoku') return 'white';
    if (type === 'xiangqi') return 'black';
    return 'black';
}

function getBoardGameSideLabel(type, side) {
    if (type === 'gomoku') return side === 'black' ? '黑棋' : '白棋';
    if (type === 'xiangqi') return side === 'red' ? '红方' : '黑方';
    return side === 'white' ? '白方' : '黑方';
}

function getBoardGamePlayerSides(type, firstPlayer = getBoardGameFirstPlayer(type)) {
    const firstSide = getBoardGameFirstSide(type);
    const secondSide = getBoardGameSecondSide(type);
    const normalizedFirst = firstPlayer === 'char' ? 'char' : 'user';
    return {
        firstPlayer: normalizedFirst,
        firstSide,
        userSide: normalizedFirst === 'user' ? firstSide : secondSide,
        charSide: normalizedFirst === 'char' ? firstSide : secondSide
    };
}

function getBoardGameTurnOwner(type, state) {
    if (!state) return 'user';
    const sides = {
        userSide: state.userSide || getBoardGamePlayerSides(type).userSide,
        charSide: state.charSide || getBoardGamePlayerSides(type).charSide
    };
    return state.turn === sides.charSide ? 'char' : 'user';
}

function getBoardGameTurnText(type, state) {
    const char = getBoardGameChar(type);
    const owner = getBoardGameTurnOwner(type, state);
    const ownerName = owner === 'char' ? getMusicCharName(char) : '你';
    return `${ownerName} · ${getBoardGameSideLabel(type, state?.turn)}`;
}

function getBoardGameStateByType(type) {
    return type === 'gomoku' ? getGomokuState() : getBoardGameState(type);
}

function saveBoardGameStateByType(type, state) {
    if (type === 'gomoku') saveGomokuState(state);
    else saveBoardGameState(type, state);
}

function clearBoardGameAutoTurn(type) {
    if (BOARD_GAME_AUTO_TIMERS[type]) {
        clearTimeout(BOARD_GAME_AUTO_TIMERS[type]);
        BOARD_GAME_AUTO_TIMERS[type] = 0;
    }
}

function scheduleBoardGameAutoTurn(type, reason = 'turn') {
    if (!isBoardCompanionGame(type) || !isBoardGameReady(type)) return;
    clearBoardGameAutoTurn(type);
    const state = getBoardGameStateByType(type);
    if (!state || state.winner || getBoardGameTurnOwner(type, state) !== 'char') return;
    BOARD_GAME_AUTO_TIMERS[type] = setTimeout(() => executeBoardGameAutoMove(type, reason), 720);
}

function isGomokuInside(row, col) {
    return row >= 0 && row < GOMOKU_BOARD_SIZE && col >= 0 && col < GOMOKU_BOARD_SIZE;
}

function getGomokuCandidateCells(state) {
    const board = state.board || [];
    const occupied = [];
    board.forEach((row, r) => row.forEach((stone, c) => {
        if (stone) occupied.push([r, c]);
    }));
    if (!occupied.length) return [[7, 7]];
    const seen = new Set();
    const cells = [];
    occupied.forEach(([r, c]) => {
        for (let dr = -3; dr <= 3; dr += 1) {
            for (let dc = -3; dc <= 3; dc += 1) {
                const nr = r + dr;
                const nc = c + dc;
                const key = `${nr},${nc}`;
                if (!isGomokuInside(nr, nc) || board[nr]?.[nc] || seen.has(key)) continue;
                seen.add(key);
                cells.push([nr, nc]);
            }
        }
    });
    return cells.sort((a, b) => {
        const da = Math.abs(a[0] - 7) + Math.abs(a[1] - 7);
        const db = Math.abs(b[0] - 7) + Math.abs(b[1] - 7);
        return da - db;
    });
}

function countGomokuDirection(board, row, col, stone, dr, dc) {
    let count = 0;
    let r = row + dr;
    let c = col + dc;
    while (isGomokuInside(r, c) && board[r]?.[c] === stone) {
        count += 1;
        r += dr;
        c += dc;
    }
    return { count, endRow: r, endCol: c };
}

function scoreGomokuLine(total, openEnds) {
    if (total >= 5) return 1000000;
    if (total === 4 && openEnds === 2) return 260000;
    if (total === 4 && openEnds === 1) return 120000;
    if (total === 3 && openEnds === 2) return 36000;
    if (total === 3 && openEnds === 1) return 9000;
    if (total === 2 && openEnds === 2) return 2600;
    if (total === 2 && openEnds === 1) return 900;
    return total * 80 + openEnds * 45;
}

function scoreGomokuWindow(board, row, col, stone, dr, dc) {
    let score = 0;
    for (let start = -4; start <= 0; start += 1) {
        const cells = [];
        let hasCandidate = false;
        let blocked = false;
        for (let offset = 0; offset < 5; offset += 1) {
            const step = start + offset;
            const r = row + dr * step;
            const c = col + dc * step;
            if (!isGomokuInside(r, c)) {
                blocked = true;
                break;
            }
            if (step === 0) hasCandidate = true;
            const value = step === 0 ? stone : board[r]?.[c];
            if (value && value !== stone) {
                blocked = true;
                break;
            }
            cells.push(value === stone ? 'stone' : 'empty');
        }
        if (blocked || !hasCandidate) continue;
        const stones = cells.filter(value => value === 'stone').length;
        const beforeRow = row + dr * (start - 1);
        const beforeCol = col + dc * (start - 1);
        const afterRow = row + dr * (start + 5);
        const afterCol = col + dc * (start + 5);
        const openEnds = Number(isGomokuInside(beforeRow, beforeCol) && !board[beforeRow]?.[beforeCol])
            + Number(isGomokuInside(afterRow, afterCol) && !board[afterRow]?.[afterCol]);
        if (stones === 4) score += openEnds === 2 ? 90000 : 42000;
        else if (stones === 3) score += openEnds === 2 ? 15000 : 5200;
        else if (stones === 2) score += openEnds === 2 ? 1800 : 500;
    }
    return score;
}

function scoreGomokuPlacement(state, row, col, stone) {
    const board = state.board || [];
    if (!isGomokuInside(row, col) || board[row]?.[col]) return -Infinity;
    let score = 0;
    let openFour = 0;
    let blockedFour = 0;
    let openThree = 0;
    let strongLines = 0;
    for (const [dr, dc] of GOMOKU_DIRECTIONS) {
        const forward = countGomokuDirection(board, row, col, stone, dr, dc);
        const backward = countGomokuDirection(board, row, col, stone, -dr, -dc);
        const total = forward.count + backward.count + 1;
        const openEnds = Number(isGomokuInside(forward.endRow, forward.endCol) && !board[forward.endRow]?.[forward.endCol])
            + Number(isGomokuInside(backward.endRow, backward.endCol) && !board[backward.endRow]?.[backward.endCol]);
        const lineScore = scoreGomokuLine(total, openEnds);
        score += lineScore + scoreGomokuWindow(board, row, col, stone, dr, dc);
        if (total >= 5) strongLines += 4;
        else if (total === 4 && openEnds === 2) {
            openFour += 1;
            strongLines += 3;
        } else if (total === 4 && openEnds === 1) {
            blockedFour += 1;
            strongLines += 2;
        } else if (total === 3 && openEnds === 2) {
            openThree += 1;
            strongLines += 1;
        }
    }
    if (openFour) score += 180000 * openFour;
    if (blockedFour >= 2) score += 140000;
    if (openThree >= 2) score += 110000;
    if (openThree && blockedFour) score += 90000;
    if (strongLines >= 4) score += 50000;
    const centerDistance = Math.abs(row - 7) + Math.abs(col - 7);
    score += Math.max(0, 14 - centerDistance) * 55;
    return score;
}

function findGomokuTacticalMove(state, stone) {
    const candidates = getGomokuCandidateCells(state);
    for (const [r, c] of candidates) {
        state.board[r][c] = stone;
        const wins = checkGomokuWin(state.board, r, c, stone);
        state.board[r][c] = '';
        if (wins) return { row: r, col: c };
    }
    return null;
}

function chooseGomokuAutoMove(state) {
    const charStone = state.charSide || state.turn;
    const userStone = state.userSide || (charStone === 'black' ? 'white' : 'black');
    const win = findGomokuTacticalMove(state, charStone);
    if (win) return win;
    const block = findGomokuTacticalMove(state, userStone);
    if (block) return block;
    const candidates = getGomokuCandidateCells(state);
    const ranked = candidates.map(([row, col]) => {
        const attack = scoreGomokuPlacement(state, row, col, charStone);
        const defense = scoreGomokuPlacement(state, row, col, userStone);
        const centerDistance = Math.abs(row - 7) + Math.abs(col - 7);
        return {
            row,
            col,
            attack,
            defense,
            score: attack + defense * 1.08 - centerDistance * 6
        };
    }).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.attack !== a.attack) return b.attack - a.attack;
        return (Math.abs(a.row - 7) + Math.abs(a.col - 7)) - (Math.abs(b.row - 7) + Math.abs(b.col - 7));
    });
    const urgentDefense = ranked.find(move => move.defense >= 120000);
    const bestAttack = ranked[0];
    if (urgentDefense && (!bestAttack || bestAttack.attack < urgentDefense.defense * 1.15)) {
        return { row: urgentDefense.row, col: urgentDefense.col };
    }
    return bestAttack ? { row: bestAttack.row, col: bestAttack.col } : null;
}

function getBoardGamePieceSide(type, piece, row) {
    if (!piece) return '';
    if (type === 'chess') {
        if ('♙♖♘♗♕♔'.includes(piece)) return 'white';
        if ('♟♜♞♝♛♚'.includes(piece)) return 'black';
    }
    if (type === 'xiangqi') {
        if ('兵炮相仕帥'.includes(piece)) return 'red';
        if ('卒砲象士將'.includes(piece)) return 'black';
        return row <= 4 ? 'red' : 'black';
    }
    return '';
}

function isBoardCellInside(type, row, col) {
    const maxRow = type === 'xiangqi' ? 10 : 8;
    const maxCol = type === 'xiangqi' ? 9 : 8;
    return row >= 0 && row < maxRow && col >= 0 && col < maxCol;
}

function getChessPieceKind(piece) {
    const map = {
        '♙': 'pawn', '♟': 'pawn',
        '♖': 'rook', '♜': 'rook',
        '♘': 'knight', '♞': 'knight',
        '♗': 'bishop', '♝': 'bishop',
        '♕': 'queen', '♛': 'queen',
        '♔': 'king', '♚': 'king'
    };
    return map[piece] || '';
}

function isChessPathClear(board, fromRow, fromCol, toRow, toCol) {
    const dr = Math.sign(toRow - fromRow);
    const dc = Math.sign(toCol - fromCol);
    let row = fromRow + dr;
    let col = fromCol + dc;
    while (row !== toRow || col !== toCol) {
        if (board[row]?.[col]) return false;
        row += dr;
        col += dc;
    }
    return true;
}

function isChessMoveShapeLegal(board, piece, fromRow, fromCol, toRow, toCol) {
    if (!isBoardCellInside('chess', toRow, toCol)) return false;
    const side = getBoardGamePieceSide('chess', piece, fromRow);
    const target = board[toRow]?.[toCol] || '';
    if (!side || (target && getBoardGamePieceSide('chess', target, toRow) === side)) return false;
    const kind = getChessPieceKind(piece);
    const dr = toRow - fromRow;
    const dc = toCol - fromCol;
    const absR = Math.abs(dr);
    const absC = Math.abs(dc);
    if (kind === 'pawn') {
        const dir = side === 'white' ? -1 : 1;
        const startRow = side === 'white' ? 6 : 1;
        if (dc === 0 && dr === dir && !target) return true;
        if (dc === 0 && fromRow === startRow && dr === dir * 2 && !target && !board[fromRow + dir]?.[fromCol]) return true;
        if (absC === 1 && dr === dir && target && getBoardGamePieceSide('chess', target, toRow) !== side) return true;
        return false;
    }
    if (kind === 'rook') return (dr === 0 || dc === 0) && isChessPathClear(board, fromRow, fromCol, toRow, toCol);
    if (kind === 'bishop') return absR === absC && isChessPathClear(board, fromRow, fromCol, toRow, toCol);
    if (kind === 'queen') return (dr === 0 || dc === 0 || absR === absC) && isChessPathClear(board, fromRow, fromCol, toRow, toCol);
    if (kind === 'knight') return (absR === 2 && absC === 1) || (absR === 1 && absC === 2);
    if (kind === 'king') return Math.max(absR, absC) === 1;
    return false;
}

function getChessLegalMoves(state, row, col) {
    const board = state.board || [];
    const piece = board[row]?.[col] || '';
    if (!piece) return [];
    const side = getBoardGamePieceSide('chess', piece, row);
    if (!side) return [];
    const moves = [];
    for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
            if (!isChessMoveShapeLegal(board, piece, row, col, r, c)) continue;
            const capturedPiece = board[r]?.[c] || '';
            moves.push({ from: [row, col], to: [r, c], piece, capturedPiece, row: r, col: c });
        }
    }
    return moves;
}

function getBoardLegalMoves(type, state, row, col) {
    if (type === 'chess') return getChessLegalMoves(state, row, col);
    const board = state.board || [];
    const piece = board[row]?.[col] || '';
    if (!piece) return [];
    const side = getBoardGamePieceSide(type, piece, row);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    return dirs.map(([dr, dc]) => {
        const nr = row + dr;
        const nc = col + dc;
        const target = board[nr]?.[nc] || '';
        if (!isBoardCellInside(type, nr, nc)) return null;
        if (target && getBoardGamePieceSide(type, target, nr) === side) return null;
        return { from: [row, col], to: [nr, nc], piece, capturedPiece: target, row: nr, col: nc };
    }).filter(Boolean);
}

function chooseClassicBoardAutoMove(type, state) {
    const ownSide = state.charSide || state.turn;
    const moves = [];
    const rows = state.board || [];
    rows.forEach((row, r) => row.forEach((piece, c) => {
        if (!piece || getBoardGamePieceSide(type, piece, r) !== ownSide) return;
        moves.push(...getBoardLegalMoves(type, state, r, c));
    }));
    const valueMap = { king: 999, queen: 90, rook: 50, bishop: 32, knight: 31, pawn: 10 };
    moves.sort((a, b) => {
        const av = valueMap[getChessPieceKind(a.capturedPiece)] || Number(!!a.capturedPiece);
        const bv = valueMap[getChessPieceKind(b.capturedPiece)] || Number(!!b.capturedPiece);
        return bv - av;
    });
    return moves[0] || null;
}

function promoteChessPieceIfNeeded(piece, toRow) {
    if (piece === '♙' && toRow === 0) return '♕';
    if (piece === '♟' && toRow === 7) return '♛';
    return piece;
}

function applyClassicBoardMove(type, state, move) {
    const from = move.from;
    const to = move.to;
    const movingPiece = move.piece || state.board[from[0]]?.[from[1]] || '';
    const capturedPiece = move.capturedPiece || state.board[to[0]]?.[to[1]] || '';
    state.board[to[0]][to[1]] = type === 'chess' ? promoteChessPieceIfNeeded(movingPiece, to[0]) : movingPiece;
    state.board[from[0]][from[1]] = '';
    state.selected = null;
    state.moves = (state.moves || 0) + 1;
    if (type === 'chess' && getChessPieceKind(capturedPiece) === 'king') {
        state.winner = getBoardGamePieceSide(type, movingPiece, from[0]);
    } else {
        state.turn = type === 'xiangqi'
            ? (state.turn === 'red' ? 'black' : 'red')
            : (state.turn === 'white' ? 'black' : 'white');
    }
    return { ...move, piece: movingPiece, capturedPiece };
}

function getBoardGameCommentRateKey(type) {
    return `${BOARD_GAME_COMMENT_RATE_KEY_PREFIX}${type}_${getBoardGameCharId(type) || 'default'}`;
}

function getBoardGameCommentRate(type) {
    try {
        const data = JSON.parse(localStorage.getItem(getBoardGameCommentRateKey(type)) || '{}');
        if (data && typeof data === 'object') return data;
    } catch (e) {}
    return {};
}

function saveBoardGameCommentRate(type, data) {
    localStorage.setItem(getBoardGameCommentRateKey(type), JSON.stringify(data || {}));
}

function isBoardGameAutoCommentReason(reason) {
    return reason === 'char-move' || reason === 'user-move';
}

function getBoardGameMoveCountForComment(type, payload = {}) {
    if (Number.isFinite(payload.moveCount)) return Number(payload.moveCount);
    const state = payload.state || getBoardGameStateByType(type);
    return Number(state?.moves || 0);
}

function reserveBoardGameAiComment(type, reason, payload = {}) {
    const now = Date.now();
    const rate = getBoardGameCommentRate(type);
    if (rate.pauseUntil && now < rate.pauseUntil) {
        return { allowed: false, reason: 'paused', retryMs: rate.pauseUntil - now };
    }
    if (reason === 'manual') {
        if (now - Number(rate.lastManualAt || 0) < BOARD_GAME_MANUAL_COMMENT_COOLDOWN_MS) {
            return { allowed: false, reason: 'manual-cooldown' };
        }
        rate.lastManualAt = now;
    } else if (isBoardGameAutoCommentReason(reason)) {
        const moveCount = getBoardGameMoveCountForComment(type, payload);
        if (!moveCount || moveCount % BOARD_GAME_AUTO_COMMENT_EVERY_MOVES !== 0) {
            return { allowed: false, reason: 'move-spacing' };
        }
        if (now - Number(rate.lastAutoAt || 0) < BOARD_GAME_AUTO_COMMENT_COOLDOWN_MS) {
            return { allowed: false, reason: 'auto-cooldown' };
        }
        rate.lastAutoAt = now;
    } else if (reason === 'start' || reason === 'reset') {
        if (now - Number(rate.lastSetupAt || 0) < BOARD_GAME_AUTO_COMMENT_COOLDOWN_MS) {
            return { allowed: false, reason: 'setup-cooldown' };
        }
        rate.lastSetupAt = now;
    } else if (reason === 'win') {
        const moveCount = getBoardGameMoveCountForComment(type, payload);
        if (rate.lastWinMove === moveCount && now - Number(rate.lastWinAt || 0) < BOARD_GAME_AUTO_COMMENT_COOLDOWN_MS) {
            return { allowed: false, reason: 'win-cooldown' };
        }
        rate.lastWinAt = now;
        rate.lastWinMove = moveCount;
    }
    rate.lastRequestAt = now;
    saveBoardGameCommentRate(type, rate);
    return { allowed: true };
}

function isBoardGameRateLimitError(value) {
    return /429|rate.?limit|too many|请求限制|请求过于频繁|达到.*限制/i.test(String(value || ''));
}

function pauseBoardGameAiComments(type) {
    const rate = getBoardGameCommentRate(type);
    rate.pauseUntil = Date.now() + BOARD_GAME_RATE_LIMIT_PAUSE_MS;
    saveBoardGameCommentRate(type, rate);
}

function finishBoardGameMove(type, state, move, actor) {
    saveBoardGameStateByType(type, state);
    renderGameApp();
    const row = Number.isInteger(move.row) ? move.row : move.to?.[0];
    const col = Number.isInteger(move.col) ? move.col : move.to?.[1];
    const sideText = getBoardGameSideLabel(type, move.side || move.placedStone || state.charSide || state.turn);
    const reason = state.winner ? 'win' : (actor === 'char' ? 'char-move' : 'user-move');
    const action = state.winner
        ? `${sideText}获胜了，请按人设对这一局说一句收尾气泡。`
        : actor === 'char'
        ? `你刚刚替自己下了${sideText}，位置是第${(row || 0) + 1}行第${(col || 0) + 1}列。请按人设对这一步说一句话。`
        : `用户刚刚下了${sideText}。请自然评价这一手。`;
    requestBoardGameAiComment(type, reason, { action, actor, row, col, move, moveCount: state.moves || 0 });
    if (!state.winner && getBoardGameTurnOwner(type, state) === 'char') scheduleBoardGameAutoTurn(type, 'after-move');
}

function executeBoardGameAutoMove(type, reason = 'auto') {
    clearBoardGameAutoTurn(type);
    if (!isBoardGameReady(type) || getActiveGame() !== type) return;
    const state = getBoardGameStateByType(type);
    if (!state || state.winner || getBoardGameTurnOwner(type, state) !== 'char') return;
    if (type === 'gomoku') {
        const move = chooseGomokuAutoMove(state);
        if (!move) return;
        const placedStone = state.turn;
        state.board[move.row][move.col] = placedStone;
        state.moves = (state.moves || 0) + 1;
        if (checkGomokuWin(state.board, move.row, move.col, placedStone)) {
            state.winner = placedStone;
        } else {
            state.turn = placedStone === 'black' ? 'white' : 'black';
        }
        finishBoardGameMove(type, state, { ...move, placedStone }, 'char');
        return;
    }
    const move = chooseClassicBoardAutoMove(type, state);
    if (!move) return;
    const applied = applyClassicBoardMove(type, state, move);
    finishBoardGameMove(type, state, { ...applied, side: state.charSide }, 'char');
}

function openBoardGameCompanionSetup(type) {
    if (!isBoardCompanionGame(type)) return;
    localStorage.removeItem(BOARD_GAME_READY_KEY_PREFIX + type);
    setActiveGame(type);
    renderGameApp();
}
window.openBoardGameCompanionSetup = openBoardGameCompanionSetup;

function startBoardGameWithChar(type) {
    const char = getBoardGameChar(type);
    if (!char) {
        if (typeof showWechatToast === 'function') showWechatToast('先选择一位陪玩的角色');
        return;
    }
    const firstPlayer = getBoardGameFirstPlayer(type);
    if (type === 'gomoku') {
        saveGomokuState(createGomokuState(firstPlayer));
    } else {
        saveBoardGameState(type, getInitialBoardGameState(type, firstPlayer));
    }
    const sides = getBoardGamePlayerSides(type, firstPlayer);
    const firstName = firstPlayer === 'char' ? getMusicCharName(char) : '你';
    localStorage.setItem(BOARD_GAME_READY_KEY_PREFIX + type, '1');
    saveBoardGameChat(type, {
        status: 'idle',
        text: `棋局已创建，${firstName}先手。`,
        updatedAt: Date.now()
    });
    renderGameApp();
    requestBoardGameAiComment(type, 'start', {
        action: `刚进入${getBoardGameMeta(type).title}棋局，${firstName}先手，用户执${getBoardGameSideLabel(type, sides.userSide)}，你执${getBoardGameSideLabel(type, sides.charSide)}，请开局说一句头像旁边的小气泡。`
    });
    scheduleBoardGameAutoTurn(type, 'start');
}
window.startBoardGameWithChar = startBoardGameWithChar;

function getBoardGameChat(type) {
    try {
        const data = JSON.parse(localStorage.getItem(BOARD_GAME_CHAT_KEY_PREFIX + type) || '{}');
        if (data && typeof data === 'object') return normalizeBoardGameChat(data);
    } catch (e) {}
    return normalizeBoardGameChat({ status: 'idle', text: '等待真实角色发言。', updatedAt: 0 });
}

function normalizeBoardGameChat(data = {}) {
    const status = data.status || 'idle';
    return {
        ...data,
        status,
        source: data.source || (status === 'done' ? 'api' : 'system')
    };
}

function saveBoardGameChat(type, data) {
    localStorage.setItem(BOARD_GAME_CHAT_KEY_PREFIX + type, JSON.stringify(normalizeBoardGameChat(data || {})));
}

function summarizeBoardGame(type, payload = {}) {
    if (type === 'gomoku') {
        const state = getGomokuState();
        const black = state.board.flat().filter(value => value === 'black').length;
        const white = state.board.flat().filter(value => value === 'white').length;
        const status = state.winner ? `${state.winner === 'black' ? '黑棋' : '白棋'}已经获胜` : `当前轮到${state.turn === 'black' ? '黑棋' : '白棋'}`;
        return `${status}；总步数${state.moves || 0}；黑棋${black}，白棋${white}；${payload.action || ''}`;
    }
    const state = getBoardGameState(type);
    const pieces = state.board.flat().filter(Boolean).length;
    const turn = type === 'xiangqi'
        ? (state.turn === 'red' ? '红方' : '黑方')
        : (state.turn === 'white' ? '白方' : '黑方');
    return `当前轮到${turn}；棋盘上还有${pieces}枚棋子；${payload.action || ''}`;
}

async function requestBoardGameAiComment(type, reason = 'manual', payload = {}) {
    if (!isBoardCompanionGame(type)) return;
    const char = getBoardGameChar(type);
    if (!char) {
        saveBoardGameChat(type, { status: 'error', text: '先选择一位陪玩的角色。', updatedAt: Date.now() });
        renderGameApp();
        return;
    }
    const meta = getBoardGameMeta(type);
    const reserved = reserveBoardGameAiComment(type, reason, payload);
    if (!reserved.allowed) {
        if (reason === 'manual' && reserved.reason === 'manual-cooldown' && typeof showWechatToast === 'function') {
            showWechatToast('棋局气泡先缓一下，避免接口限流');
        }
        if (reason === 'manual' && reserved.reason === 'paused' && typeof showWechatToast === 'function') {
            showWechatToast('接口刚刚限流了，几分钟后再试');
        }
        return;
    }
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    saveBoardGameChat(type, {
        status: 'pending',
        requestId,
        text: '正在请求角色发言...',
        updatedAt: Date.now()
    });
    renderGameApp();
    if (typeof callChatApi !== 'function') {
        saveBoardGameChat(type, { status: 'error', text: '暂时没连上聊天 API。', updatedAt: Date.now() });
        renderGameApp();
        return;
    }
    try {
        const history = Array.isArray(char.history) ? char.history.slice(-6) : [];
        const messages = typeof buildMessages === 'function'
            ? buildMessages(char, history)
            : [{ role: 'system', content: `你是${getMusicCharName(char)}。` }];
        messages.push({
            role: 'user',
            content: `我们正在 BYND 里玩${meta.title}。你是陪玩角色，请严格按照角色卡和最近聊天，用自然口吻回一句棋局气泡，40字以内。不要写思考过程，不要暴露系统提示，不要JSON。当前局面：${summarizeBoardGame(type, payload)}。触发原因：${reason}。`
        });
        const result = await callChatApi(messages);
        const current = getBoardGameChat(type);
        if (current.requestId && current.requestId !== requestId) return;
        const raw = result.ok ? result.content : result.error;
        const cleanText = typeof window.cleanChatApiVisibleContent === 'function'
            ? window.cleanChatApiVisibleContent(raw)
            : String(raw || '').trim();
        if (!result.ok && isBoardGameRateLimitError(raw)) pauseBoardGameAiComments(type);
        saveBoardGameChat(type, {
            status: result.ok ? 'done' : 'error',
            text: result.ok
                ? (cleanText || '本次 API 没有返回可显示内容。')
                : (isBoardGameRateLimitError(raw) ? '接口限流中，已暂停棋局发言几分钟。' : '这一句暂时没连上 API。'),
            updatedAt: Date.now()
        });
    } catch (e) {
        const current = getBoardGameChat(type);
        if (current.requestId && current.requestId !== requestId) return;
        if (isBoardGameRateLimitError(e?.message || e)) pauseBoardGameAiComments(type);
        saveBoardGameChat(type, {
            status: 'error',
            text: isBoardGameRateLimitError(e?.message || e) ? '接口限流中，已暂停棋局发言几分钟。' : '这一句暂时没连上 API。',
            updatedAt: Date.now()
        });
    }
    if (getActiveGame() === type) renderGameApp();
}
window.requestBoardGameAiComment = requestBoardGameAiComment;

function renderBoardGameCompanionSetup(el, type) {
    const meta = getBoardGameMeta(type);
    const chars = getWolfchaCharacters();
    const selectedId = getBoardGameCharId(type);
    const selectedChar = chars.find(char => char.id === selectedId);
    const firstPlayer = getBoardGameFirstPlayer(type);
    const sides = getBoardGamePlayerSides(type, firstPlayer);
    const charName = selectedChar ? getMusicCharName(selectedChar) : '角色';
    el.innerHTML = `
        <section class="mini-game-panel board-companion-setup">
            <div class="board-companion-hero" style="--game-accent:${musicEscapeAttr(meta.accent || '#171a22')}">
                <span>${musicEscapeHtml(meta.genre || 'BOARD DUEL')}</span>
                <strong>${musicEscapeHtml(meta.title)}</strong>
                <p>先选择一位角色陪你玩。进入棋局后，对方会根据角色卡和最近聊天，用文字气泡回应你的落子。</p>
            </div>
            <div class="board-companion-list">
                ${chars.length ? chars.map(char => {
                    const active = char.id === selectedId;
                    return `
                        <button type="button" class="${active ? 'active' : ''}" onclick="selectBoardGameChar('${musicEscapeAttr(type)}','${musicEscapeAttr(char.id)}')">
                            <div>${char.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(getMusicCharName(char))}">` : '<i class="ri-user-smile-line"></i>'}</div>
                            <strong>${musicEscapeHtml(getMusicCharName(char))}</strong>
                            <span>${active ? '已选择' : '选择陪玩'}</span>
                        </button>
                    `;
                }).join('') : '<div class="board-companion-empty">先在微信导入角色，再回来选择陪玩的 AI。</div>'}
            </div>
            <div class="board-first-picker">
                <div>
                    <span>先手</span>
                    <strong>谁先下棋</strong>
                </div>
                <button type="button" class="${firstPlayer === 'user' ? 'active' : ''}" onclick="setBoardGameFirstPlayer('${musicEscapeAttr(type)}','user')">
                    <b>我先</b><small>${musicEscapeHtml(getBoardGameSideLabel(type, getBoardGameFirstSide(type)))}</small>
                </button>
                <button type="button" class="${firstPlayer === 'char' ? 'active' : ''}" onclick="setBoardGameFirstPlayer('${musicEscapeAttr(type)}','char')" ${selectedId ? '' : 'disabled'}>
                    <b>${musicEscapeHtml(charName)}先</b><small>${musicEscapeHtml(getBoardGameSideLabel(type, getBoardGameFirstSide(type)))}</small>
                </button>
                <em>你：${musicEscapeHtml(getBoardGameSideLabel(type, sides.userSide))} / ${musicEscapeHtml(charName)}：${musicEscapeHtml(getBoardGameSideLabel(type, sides.charSide))}</em>
            </div>
            <div class="board-companion-actions">
                <button type="button" onclick="openGameHub()">先返回</button>
                <button type="button" class="primary" onclick="startBoardGameWithChar('${musicEscapeAttr(type)}')" ${selectedId ? '' : 'disabled'}><i class="ri-play-fill"></i> 进入棋局</button>
            </div>
        </section>
    `;
}

function renderBoardGameCompanionBar(type) {
    const char = getBoardGameChar(type);
    const chat = getBoardGameChat(type);
    const name = char ? getMusicCharName(char) : 'AI 陪玩';
    const text = chat.text || '真实角色发言会显示在这里。';
    const isApiSpeech = chat.source === 'api';
    const sourceLabel = isApiSpeech ? 'API 角色发言' : '系统状态';
    const state = type === 'gomoku' ? getGomokuState() : getBoardGameState(type);
    const turnText = getBoardGameTurnText(type, state);
    return `
        <div class="board-companion-card">
            <div class="board-companion-avatar">${char?.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(name)}">` : '<i class="ri-user-smile-line"></i>'}</div>
            <div class="board-companion-main">
                <div class="board-companion-head">
                    <div class="board-companion-copy">
                        <span>${musicEscapeHtml(turnText)}</span>
                        <strong>${musicEscapeHtml(name)}</strong>
                    </div>
                    <button type="button" onclick="openBoardGameCompanionSetup('${musicEscapeAttr(type)}')">换人</button>
                </div>
                <div class="board-inline-speech ${isApiSpeech ? 'api' : 'system'} ${chat.status === 'pending' ? 'thinking' : ''} ${chat.status === 'error' ? 'error' : ''}">
                    <span class="board-speech-source">${musicEscapeHtml(sourceLabel)}</span>
                    <p>${musicEscapeHtml(text)}</p>
                    <button type="button" aria-label="让角色说一句" onclick="requestBoardGameAiComment('${musicEscapeAttr(type)}','manual',{ action: '用户想听你对当前棋局说一句话。' })"><i class="ri-chat-smile-3-line"></i></button>
                </div>
            </div>
        </div>
    `;
}

function createGomokuState(firstPlayer = getBoardGameFirstPlayer('gomoku')) {
    const sides = getBoardGamePlayerSides('gomoku', firstPlayer);
    return {
        board: Array.from({ length: 15 }, () => Array(15).fill('')),
        turn: sides.firstSide,
        winner: '',
        moves: 0,
        firstPlayer: sides.firstPlayer,
        userSide: sides.userSide,
        charSide: sides.charSide
    };
}

function getGomokuState() {
    try {
        const state = JSON.parse(localStorage.getItem(GOMOKU_STATE_KEY) || '{}');
        if (Array.isArray(state.board) && state.board.length === 15) {
            const sides = getBoardGamePlayerSides('gomoku', state.firstPlayer || getBoardGameFirstPlayer('gomoku'));
            state.firstPlayer = state.firstPlayer || sides.firstPlayer;
            state.userSide = state.userSide || sides.userSide;
            state.charSide = state.charSide || sides.charSide;
            return state;
        }
    } catch (e) {}
    const state = createGomokuState();
    saveGomokuState(state);
    return state;
}

function saveGomokuState(state) {
    localStorage.setItem(GOMOKU_STATE_KEY, JSON.stringify(state));
}

function checkGomokuWin(board, row, col, stone) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    return dirs.some(([dr, dc]) => {
        let count = 1;
        for (const sign of [-1, 1]) {
            let r = row + dr * sign;
            let c = col + dc * sign;
            while (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === stone) {
                count += 1;
                r += dr * sign;
                c += dc * sign;
            }
        }
        return count >= 5;
    });
}

function placeGomokuStone(row, col) {
    const state = getGomokuState();
    if (state.winner || state.board[row]?.[col]) return;
    if (getBoardGameTurnOwner('gomoku', state) === 'char') {
        if (typeof showWechatToast === 'function') showWechatToast('等对方下完这一手');
        scheduleBoardGameAutoTurn('gomoku', 'blocked-user-tap');
        return;
    }
    const placedStone = state.turn;
    state.board[row][col] = placedStone;
    state.moves += 1;
    if (checkGomokuWin(state.board, row, col, placedStone)) {
        state.winner = placedStone;
    } else {
        state.turn = state.turn === 'black' ? 'white' : 'black';
    }
    finishBoardGameMove('gomoku', state, { row, col, placedStone }, 'user');
}
window.placeGomokuStone = placeGomokuStone;

function resetGomokuGame() {
    saveGomokuState(createGomokuState());
    const char = getBoardGameChar('gomoku');
    const firstName = getBoardGameFirstPlayer('gomoku') === 'char' ? getMusicCharName(char) : '你';
    saveBoardGameChat('gomoku', { status: 'idle', text: `棋局已重开，${firstName}先手。`, updatedAt: Date.now() });
    renderGameApp();
    requestBoardGameAiComment('gomoku', 'reset', { action: '五子棋重新开局，请说一句开局气泡。' });
    scheduleBoardGameAutoTurn('gomoku', 'reset');
}
window.resetGomokuGame = resetGomokuGame;

function renderGomokuGame(el) {
    const state = getGomokuState();
    const label = state.winner ? `${getBoardGameSideLabel('gomoku', state.winner)}获胜` : `${getBoardGameTurnText('gomoku', state)}落子`;
    el.innerHTML = `
        <section class="mini-game-panel board-panel gomoku-panel">
            ${renderBoardGameCompanionBar('gomoku')}
            <div class="board-game-top"><div><span>GOMOKU</span><strong>${label}</strong><p>先连成五子的一方获胜。</p></div><button type="button" onclick="resetGomokuGame()">重开</button></div>
            <div class="gomoku-board">
                ${state.board.map((row, r) => row.map((stone, c) => `
                    <button type="button" class="${stone || ''}" onclick="placeGomokuStone(${r},${c})">${stone ? '<i></i>' : ''}</button>
                `).join('')).join('')}
            </div>
        </section>
    `;
}

function getInitialBoardGameState(type, firstPlayer = getBoardGameFirstPlayer(type)) {
    const sides = getBoardGamePlayerSides(type, firstPlayer);
    if (type === 'xiangqi') {
        return {
            selected: null,
            turn: sides.firstSide,
            firstPlayer: sides.firstPlayer,
            userSide: sides.userSide,
            charSide: sides.charSide,
            board: [
                ['車','馬','相','仕','帥','仕','相','馬','車'],
                ['', '', '', '', '', '', '', '', ''],
                ['', '炮', '', '', '', '', '', '炮', ''],
                ['兵', '', '兵', '', '兵', '', '兵', '', '兵'],
                ['', '', '', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', '', ''],
                ['卒', '', '卒', '', '卒', '', '卒', '', '卒'],
                ['', '砲', '', '', '', '', '', '砲', ''],
                ['', '', '', '', '', '', '', '', ''],
                ['車','馬','象','士','將','士','象','馬','車']
            ]
        };
    }
    return {
        selected: null,
        turn: sides.firstSide,
        firstPlayer: sides.firstPlayer,
        userSide: sides.userSide,
        charSide: sides.charSide,
        board: [
            ['♜','♞','♝','♛','♚','♝','♞','♜'],
            ['♟','♟','♟','♟','♟','♟','♟','♟'],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['♙','♙','♙','♙','♙','♙','♙','♙'],
            ['♖','♘','♗','♕','♔','♗','♘','♖']
        ]
    };
}

function getBoardGameState(type) {
    const key = BOARD_GAME_STATE_PREFIX + type;
    try {
        const state = JSON.parse(localStorage.getItem(key) || '{}');
        if (Array.isArray(state.board)) {
            const sides = getBoardGamePlayerSides(type, state.firstPlayer || getBoardGameFirstPlayer(type));
            state.firstPlayer = state.firstPlayer || sides.firstPlayer;
            state.userSide = state.userSide || sides.userSide;
            state.charSide = state.charSide || sides.charSide;
            return state;
        }
    } catch (e) {}
    const state = getInitialBoardGameState(type);
    localStorage.setItem(key, JSON.stringify(state));
    return state;
}

function saveBoardGameState(type, state) {
    localStorage.setItem(BOARD_GAME_STATE_PREFIX + type, JSON.stringify(state));
}

function clickBoardGameCell(type, row, col) {
    const state = getBoardGameState(type);
    if (state.winner) return;
    if (getBoardGameTurnOwner(type, state) === 'char') {
        if (typeof showWechatToast === 'function') showWechatToast('等对方走完这一手');
        scheduleBoardGameAutoTurn(type, 'blocked-user-tap');
        return;
    }
    const piece = state.board[row]?.[col] || '';
    let moved = null;
    if (!state.selected) {
        if (piece && getBoardGamePieceSide(type, piece, row) === state.userSide) {
            const legalMoves = getBoardLegalMoves(type, state, row, col);
            if (!legalMoves.length) {
                if (typeof showWechatToast === 'function') showWechatToast('这个棋子现在没有可走位置');
            } else {
                state.selected = { row, col };
            }
        } else if (piece && typeof showWechatToast === 'function') {
            showWechatToast('只能移动自己的棋子');
        }
    } else {
        const { row: sr, col: sc } = state.selected;
        if (sr === row && sc === col) {
            state.selected = null;
        } else if (piece && getBoardGamePieceSide(type, piece, row) === state.userSide) {
            const legalMoves = getBoardLegalMoves(type, state, row, col);
            state.selected = legalMoves.length ? { row, col } : null;
        } else {
            const legalMoves = getBoardLegalMoves(type, state, sr, sc);
            const move = legalMoves.find(item => item.to[0] === row && item.to[1] === col);
            if (!move) {
                if (typeof showWechatToast === 'function') {
                    showWechatToast(type === 'chess' ? '这一步不符合国际象棋走法' : '这一步不能走');
                }
                return;
            }
            moved = applyClassicBoardMove(type, state, move);
        }
    }
    saveBoardGameState(type, state);
    renderGameApp();
    if (moved) {
        finishBoardGameMove(type, state, { from: moved.from, to: moved.to, side: state.userSide, piece: moved.piece, capturedPiece: moved.capturedPiece }, 'user');
    }
}
window.clickBoardGameCell = clickBoardGameCell;

function resetBoardGame(type) {
    saveBoardGameState(type, getInitialBoardGameState(type));
    const char = getBoardGameChar(type);
    const firstName = getBoardGameFirstPlayer(type) === 'char' ? getMusicCharName(char) : '你';
    saveBoardGameChat(type, { status: 'idle', text: `棋局已重开，${firstName}先手。`, updatedAt: Date.now() });
    renderGameApp();
    requestBoardGameAiComment(type, 'reset', { action: `${getBoardGameMeta(type).title}重新开局，请说一句开局气泡。` });
    scheduleBoardGameAutoTurn(type, 'reset');
}
window.resetBoardGame = resetBoardGame;

function renderBoardGame(el, type) {
    const state = getBoardGameState(type);
    const isXiangqi = type === 'xiangqi';
    const title = isXiangqi ? '中国象棋' : '国际象棋';
    const turnLabel = state.winner ? `${getBoardGameSideLabel(type, state.winner)}获胜` : getBoardGameTurnText(type, state);
    const cols = isXiangqi ? 9 : 8;
    const selectedMoves = state.selected ? getBoardLegalMoves(type, state, state.selected.row, state.selected.col) : [];
    const legalKeys = new Set(selectedMoves.map(move => `${move.to[0]},${move.to[1]}`));
    const chessHelp = isXiangqi ? '' : `
        <div class="chess-rule-card">
            <div class="chess-rule-head">
                <span>新手规则</span>
                <strong>轮流走棋，吃到对方的王就获胜</strong>
            </div>
            <div class="chess-rule-strip">
                <span><b>兵</b>直走，斜吃，首步可走两格</span>
                <span><b>车</b>横竖走任意格</span>
                <span><b>马</b>走 L 形，可跳子</span>
                <span><b>象</b>斜线走任意格</span>
                <span><b>后</b>横竖斜都能走</span>
                <span><b>王</b>每次走一格</span>
            </div>
            <div class="chess-rule-notes">
                <span>点自己的棋子后，绿色格可以走，红色格可以吃。</span>
                <span>兵走到最后一排会自动升后。</span>
                <span>当前轻量版先做基础走法，暂不处理王车易位、吃过路兵和将军判定。</span>
            </div>
        </div>
    `;
    el.innerHTML = `
        <section class="mini-game-panel board-panel ${isXiangqi ? 'xiangqi-panel' : 'chess-panel'}">
            ${renderBoardGameCompanionBar(type)}
            <div class="board-game-top"><div><span>${isXiangqi ? 'XIANGQI' : 'CHESS'}</span><strong>${title}</strong><p>${musicEscapeHtml(turnLabel)}。${isXiangqi ? '点击棋子选中，再点击目标格移动。' : '点棋子会亮出能走的位置，绿色可走，红色可吃。'}</p></div><button type="button" onclick="resetBoardGame('${type}')">重开</button></div>
            ${chessHelp}
            <div class="classic-board ${isXiangqi ? 'xiangqi' : 'chess'}" style="--cols:${cols}">
                ${state.board.map((row, r) => row.map((piece, c) => {
                    const selected = state.selected && state.selected.row === r && state.selected.col === c;
                    const legal = legalKeys.has(`${r},${c}`);
                    const capturable = legal && !!piece;
                    return `<button type="button" class="${selected ? 'selected' : ''} ${piece ? 'has-piece' : ''} ${legal ? 'legal-move' : ''} ${capturable ? 'capture-move' : ''}" onclick="clickBoardGameCell('${type}',${r},${c})"><span>${musicEscapeHtml(piece)}</span></button>`;
                }).join('')).join('')}
            </div>
        </section>
    `;
}
const CHICKEN_GAME_BEST_KEY = 'bynd_game_chicken_best_v1';
const CHICKEN_AVATAR_KEY = 'bynd_game_chicken_avatar_v1';
let chickenGame = null;
let chickenRaf = 0;
let chickenBgm = null;

const CHICKEN_AVATARS = [
    { id: 'chicken', label: '肥鸡', icon: '🐔', body: '#ffd25a', accent: '#f05a28' },
    { id: 'cat', label: '小猫', icon: '🐱', body: '#ffcf8a', accent: '#3d2b1f' },
    { id: 'dog', label: '小狗', icon: '🐶', body: '#d99b5f', accent: '#5a3927' },
    { id: 'bird', label: '小鸟', icon: '🐦', body: '#62c7ff', accent: '#245b8c' },
    { id: 'mushroom', label: '蘑菇', icon: '🍄', body: '#fff1d0', accent: '#e94444' }
];

function getChickenAvatarId() {
    const saved = localStorage.getItem(CHICKEN_AVATAR_KEY);
    return CHICKEN_AVATARS.some(item => item.id === saved) ? saved : 'chicken';
}

function setChickenAvatar(id) {
    if (!CHICKEN_AVATARS.some(item => item.id === id)) return;
    localStorage.setItem(CHICKEN_AVATAR_KEY, id);
    if (chickenGame) chickenGame.avatarId = id;
    renderGameApp();
}
window.setChickenAvatar = setChickenAvatar;

function getChickenBest() {
    return Math.max(0, parseInt(localStorage.getItem(CHICKEN_GAME_BEST_KEY) || '0', 10) || 0);
}

function stopChickenGame(clearState = false) {
    if (chickenRaf) cancelAnimationFrame(chickenRaf);
    chickenRaf = 0;
    if (chickenGame) chickenGame.running = false;
    stopChickenBgm();
    if (clearState) chickenGame = null;
}
window.stopChickenGame = stopChickenGame;

function getChickenAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!window._byndChickenAudioContext) window._byndChickenAudioContext = new AudioCtx();
    return window._byndChickenAudioContext;
}

function unlockChickenAudio() {
    const ctx = getChickenAudioContext();
    if (!ctx) return null;
    const resume = ctx.state === 'suspended' && typeof ctx.resume === 'function'
        ? ctx.resume().catch(() => {})
        : Promise.resolve();
    if (!window._byndChickenAudioUnlocked) {
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.025);
            window._byndChickenAudioUnlocked = true;
        } catch (e) {}
    }
    return { ctx, resume };
}

function startChickenBgm() {
    const audio = unlockChickenAudio();
    const ctx = audio?.ctx;
    if (!ctx) return;
    if (!chickenBgm) {
        const master = ctx.createGain();
        master.gain.value = 0.42;
        master.connect(ctx.destination);
        chickenBgm = { ctx, master, timer: 0, step: 0, playing: false, bassOsc: null, bassGain: null };
    }
    if (chickenBgm.playing) return;
    chickenBgm.playing = true;
    const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 587.33, 659.25, 783.99];
    const startBass = () => {
        if (!chickenBgm?.playing || chickenBgm.bassOsc) return;
        try {
            const now = ctx.currentTime;
            const bassOsc = ctx.createOscillator();
            const bassGain = ctx.createGain();
            bassOsc.type = 'triangle';
            bassOsc.frequency.setValueAtTime(130.81, now);
            bassGain.gain.setValueAtTime(0.0001, now);
            bassGain.gain.linearRampToValueAtTime(0.026, now + 0.12);
            bassOsc.connect(bassGain);
            bassGain.connect(chickenBgm.master);
            bassOsc.start(now);
            chickenBgm.bassOsc = bassOsc;
            chickenBgm.bassGain = bassGain;
        } catch (e) {}
    };
    const tick = () => {
        if (!chickenBgm?.playing) return;
        const now = ctx.currentTime;
        const freq = notes[chickenBgm.step % notes.length];
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = chickenBgm.step % 4 === 0 ? 'triangle' : 'square';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.connect(gain);
        gain.connect(chickenBgm.master);
        osc.start(now);
        osc.stop(now + 0.2);
        chickenBgm.step += 1;
        chickenBgm.timer = setTimeout(tick, chickenBgm.step % 4 === 0 ? 235 : 185);
    };
    const begin = () => {
        if (!chickenBgm?.playing || chickenBgm.timer) return;
        startBass();
        tick();
    };
    if (ctx.state === 'suspended') {
        audio.resume?.then(begin);
        setTimeout(begin, 140);
    } else {
        begin();
    }
}

function stopChickenBgm() {
    if (!chickenBgm) return;
    chickenBgm.playing = false;
    if (chickenBgm.timer) clearTimeout(chickenBgm.timer);
    chickenBgm.timer = 0;
    if (chickenBgm.bassGain) {
        try {
            const now = chickenBgm.ctx.currentTime;
            chickenBgm.bassGain.gain.cancelScheduledValues(now);
            chickenBgm.bassGain.gain.setValueAtTime(chickenBgm.bassGain.gain.value || 0.0001, now);
            chickenBgm.bassGain.gain.linearRampToValueAtTime(0.0001, now + 0.08);
        } catch (e) {}
    }
    if (chickenBgm.bassOsc) {
        try { chickenBgm.bassOsc.stop(chickenBgm.ctx.currentTime + 0.09); } catch (e) {}
        try { chickenBgm.bassOsc.disconnect(); } catch (e) {}
    }
    if (chickenBgm.bassGain) {
        setTimeout(() => {
            try { chickenBgm?.bassGain?.disconnect(); } catch (e) {}
        }, 120);
    }
    chickenBgm.bassOsc = null;
    chickenBgm.bassGain = null;
}

function createChickenGameState(canvas) {
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width || 320));
    const height = Math.max(480, Math.round(rect.height || 520));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return {
        canvas,
        ctx,
        width,
        height,
        avatarId: getChickenAvatarId(),
        bird: { x: 74, y: height * 0.48, size: 30, vy: 0, angle: 0 },
        gravity: 0.34,
        flap: -6.2,
        speed: 2.25,
        score: 0,
        coins: 0,
        distance: 0,
        best: getChickenBest(),
        obstacles: [],
        particles: [],
        clouds: [
            { x: 36, y: 78, s: 0.76 },
            { x: 186, y: 132, s: 1.12 },
            { x: 284, y: 258, s: 0.78 },
            { x: 92, y: 360, s: 1.0 }
        ],
        lastTime: 0,
        running: false,
        started: false,
        over: false,
        spawnX: width + 80
    };
}

function resetChickenGame(canvas) {
    stopChickenGame(false);
    const target = canvas || document.getElementById('chicken-canvas');
    if (!target) return;
    chickenGame = createChickenGameState(target);
    drawChickenFrame(chickenGame);
    updateChickenHud();
}

function startChickenGame() {
    unlockChickenAudio();
    const canvas = document.getElementById('chicken-canvas');
    if (!canvas) return;
    if (!chickenGame || chickenGame.canvas !== canvas || chickenGame.over) {
        resetChickenGame(canvas);
    }
    chickenGame.started = true;
    chickenGame.running = true;
    chickenGame.over = false;
    chickenGame.lastTime = performance.now();
    chickenGame.bird.vy = chickenGame.flap;
    startChickenBgm();
    chickenGameLoop(chickenGame.lastTime);
    updateChickenHud();
}
window.startChickenGame = startChickenGame;

function flapChickenGame() {
    unlockChickenAudio();
    if (!chickenGame) return;
    if (chickenGame.over) {
        resetChickenGame(chickenGame.canvas);
        startChickenGame();
        return;
    }
    if (!chickenGame.started) {
        startChickenGame();
        return;
    }
    chickenGame.bird.vy = chickenGame.flap;
    chickenGame.particles.push({ x: chickenGame.bird.x - 11, y: chickenGame.bird.y + 8, life: 18, color: 'rgba(255,255,255,0.82)' });
}
window.flapChickenGame = flapChickenGame;

function createChickenCoins(game, top, gap) {
    const count = 3 + Math.floor(Math.random() * 3);
    const center = top + gap / 2;
    const coins = [];
    const bigIndex = Math.floor(Math.random() * count);
    for (let i = 0; i < count; i += 1) {
        const big = i === bigIndex;
        const yOffset = (Math.sin(i * 0.85 + Math.random() * 0.7) * 34) + (Math.random() * 16 - 8);
        coins.push({
            x: game.width + 72 + i * 32,
            y: Math.max(top + 24, Math.min(top + gap - 24, center + yOffset)),
            taken: false,
            big,
            value: big ? 3 : 1,
            scale: big ? 1.18 : 0.78 + Math.random() * 0.12
        });
    }
    return coins;
}

function spawnChickenObstacle(game) {
    const gap = Math.max(138, Math.min(178, game.height * 0.31));
    const topMin = 82;
    const topMax = Math.max(topMin + 20, game.height - gap - 120);
    const top = Math.round(topMin + Math.random() * (topMax - topMin));
    game.obstacles.push({
        x: game.width + 26,
        width: 46,
        top,
        gap,
        passed: false,
        coins: createChickenCoins(game, top, gap)
    });
}

function chickenGameLoop(time) {
    if (!chickenGame || !chickenGame.running) return;
    const game = chickenGame;
    const delta = Math.min(34, time - (game.lastTime || time));
    game.lastTime = time;
    const step = delta / 16.67;
    updateChickenGame(game, step);
    drawChickenFrame(game);
    updateChickenHud();
    if (game.running) chickenRaf = requestAnimationFrame(chickenGameLoop);
}

function updateChickenGame(game, step) {
    const bird = game.bird;
    bird.vy += game.gravity * step;
    bird.y += bird.vy * step;
    bird.angle = Math.max(-0.45, Math.min(0.72, bird.vy / 10));
    game.distance += game.speed * step;
    game.spawnX -= game.speed * step;
    if (game.spawnX < game.width - 130) {
        spawnChickenObstacle(game);
        game.spawnX = game.width + 116 + Math.random() * 42;
    }
    game.obstacles.forEach(ob => {
        ob.x -= game.speed * step;
        const coins = Array.isArray(ob.coins) ? ob.coins : (ob.coin ? [ob.coin] : []);
        ob.coins = coins;
        coins.forEach(coin => { coin.x -= game.speed * step; });
        if (!ob.passed && ob.x + ob.width < bird.x - bird.size * 0.35) {
            ob.passed = true;
            game.score += 1;
        }
        coins.forEach(coin => {
            if (!coin.taken) {
                const dx = coin.x - bird.x;
                const dy = coin.y - bird.y;
                const radius = bird.size * 0.66 + (coin.big ? 9 : 3);
                if (Math.sqrt(dx * dx + dy * dy) < radius) {
                    coin.taken = true;
                    const value = coin.value || (coin.big ? 3 : 1);
                    game.coins += value;
                    game.score += value * 2;
                    playMiniGameSound(coin.big ? 'bigCoin' : 'coin');
                    game.particles.push({ x: coin.x, y: coin.y, life: coin.big ? 32 : 24, color: coin.big ? '#ffb21f' : '#ffe16a' });
                }
            }
        });
    });
    game.obstacles = game.obstacles.filter(ob => ob.x + ob.width > -40);
    game.clouds.forEach(cloud => {
        cloud.x -= (0.25 + cloud.s * 0.12) * step;
        if (cloud.x < -90) {
            cloud.x = game.width + 40 + Math.random() * 120;
            cloud.y = 64 + Math.random() * (game.height - 190);
        }
    });
    game.particles.forEach(p => {
        p.x -= 0.7 * step;
        p.y -= 0.4 * step;
        p.life -= step;
    });
    game.particles = game.particles.filter(p => p.life > 0);
    const groundY = game.height - 36;
    if (bird.y + bird.size * 0.5 > groundY || bird.y - bird.size * 0.5 < 12) endChickenGame();
    const hit = game.obstacles.some(ob => chickenHitObstacle(game, ob));
    if (hit) endChickenGame();
}

function chickenHitObstacle(game, ob) {
    const b = game.bird;
    const pad = 7;
    const left = b.x - b.size * 0.38 + pad;
    const right = b.x + b.size * 0.42 - pad;
    const top = b.y - b.size * 0.42 + pad;
    const bottom = b.y + b.size * 0.42 - pad;
    const withinX = right > ob.x && left < ob.x + ob.width;
    if (!withinX) return false;
    return top < ob.top || bottom > ob.top + ob.gap;
}

function endChickenGame() {
    if (!chickenGame || chickenGame.over) return;
    chickenGame.running = false;
    chickenGame.over = true;
    const best = Math.max(chickenGame.best, chickenGame.score);
    chickenGame.best = best;
    localStorage.setItem(CHICKEN_GAME_BEST_KEY, String(best));
    stopChickenBgm();
    drawChickenFrame(chickenGame);
    updateChickenHud();
}

function drawPixelRect(ctx, x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(w) - 2, Math.round(h) - 2);
    }
}

function drawChickenCloud(ctx, x, y, s, face = true) {
    const blocks = [[0,14,58,24], [12,0,36,30], [44,10,34,26], [-10,22,25,20]];
    blocks.forEach(b => drawPixelRect(ctx, x + b[0] * s, y + b[1] * s, b[2] * s, b[3] * s, 'rgba(255,255,255,0.94)'));
    drawPixelRect(ctx, x + 2 * s, y + 34 * s, 70 * s, 7 * s, 'rgba(180,238,255,0.42)');
    if (face) {
        drawPixelRect(ctx, x + 23 * s, y + 24 * s, 5 * s, 10 * s, '#315577');
        drawPixelRect(ctx, x + 46 * s, y + 24 * s, 5 * s, 10 * s, '#315577');
        drawPixelRect(ctx, x + 34 * s, y + 34 * s, 9 * s, 4 * s, '#315577');
        drawPixelRect(ctx, x + 16 * s, y + 35 * s, 7 * s, 4 * s, 'rgba(255,160,176,0.55)');
        drawPixelRect(ctx, x + 53 * s, y + 35 * s, 7 * s, 4 * s, 'rgba(255,160,176,0.55)');
    }
}

function drawChickenBrickColumn(ctx, x, y, w, h) {
    drawPixelRect(ctx, x - 3, y, w + 6, h, '#2f2a34');
    const brickH = 18;
    for (let row = 0; row < Math.ceil(h / brickH); row += 1) {
        const by = y + row * brickH;
        const offset = row % 2 ? -13 : 0;
        for (let bx = x + offset; bx < x + w; bx += 26) {
            drawPixelRect(ctx, bx, by + 2, 24, brickH - 4, '#b9563e', '#70372e');
            drawPixelRect(ctx, bx + 3, by + 5, 13, 3, 'rgba(255,164,97,0.38)');
        }
    }
}

function drawChickenCoin(ctx, x, y, scale = 1) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    drawPixelRect(ctx, -9 * scale, -9 * scale, 18 * scale, 18 * scale, '#ffcf2f', '#9c6d14');
    drawPixelRect(ctx, -5 * scale, -5 * scale, 10 * scale, 10 * scale, '#ffe572');
    drawPixelRect(ctx, -1 * scale, -6 * scale, 3 * scale, 12 * scale, '#c98d18');
    ctx.restore();
}

function drawChickenAvatar(ctx, avatarId, x, y, size, angle) {
    const avatar = CHICKEN_AVATARS.find(item => item.id === avatarId) || CHICKEN_AVATARS[0];
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle || 0);
    const s = size / 32;
    if (avatar.id === 'mushroom') {
        drawPixelRect(ctx, -11*s, -3*s, 22*s, 18*s, '#fff1d0', '#5b3626');
        drawPixelRect(ctx, -16*s, -15*s, 32*s, 17*s, avatar.accent, '#5b1e1e');
        drawPixelRect(ctx, -10*s, -12*s, 7*s, 7*s, '#fff6dc');
        drawPixelRect(ctx, 5*s, -10*s, 7*s, 7*s, '#fff6dc');
        drawPixelRect(ctx, -5*s, 4*s, 3*s, 7*s, '#3c2b24');
        drawPixelRect(ctx, 5*s, 4*s, 3*s, 7*s, '#3c2b24');
    } else if (avatar.id === 'cat' || avatar.id === 'dog') {
        drawPixelRect(ctx, -13*s, -10*s, 26*s, 24*s, avatar.body, '#5b3626');
        if (avatar.id === 'cat') {
            drawPixelRect(ctx, -14*s, -17*s, 8*s, 10*s, avatar.body, '#5b3626');
            drawPixelRect(ctx, 6*s, -17*s, 8*s, 10*s, avatar.body, '#5b3626');
        } else {
            drawPixelRect(ctx, -18*s, -8*s, 8*s, 14*s, '#8b5b3a', '#5b3626');
            drawPixelRect(ctx, 10*s, -8*s, 8*s, 14*s, '#8b5b3a', '#5b3626');
        }
        drawPixelRect(ctx, -6*s, -1*s, 4*s, 6*s, '#1e293b');
        drawPixelRect(ctx, 5*s, -1*s, 4*s, 6*s, '#1e293b');
        drawPixelRect(ctx, -1*s, 6*s, 5*s, 3*s, avatar.accent);
    } else {
        drawPixelRect(ctx, -14*s, -10*s, 28*s, 22*s, avatar.body, '#4a3425');
        drawPixelRect(ctx, -22*s, -4*s, 12*s, 13*s, avatar.id === 'bird' ? '#b7e9ff' : '#fff0a6', '#4a3425');
        drawPixelRect(ctx, 10*s, -1*s, 11*s, 8*s, '#ff9f1a', '#6b3d10');
        drawPixelRect(ctx, -7*s, -1*s, 4*s, 7*s, '#1f2937');
        drawPixelRect(ctx, 4*s, -1*s, 4*s, 7*s, '#1f2937');
        if (avatar.id === 'chicken') {
            drawPixelRect(ctx, -8*s, -18*s, 6*s, 8*s, avatar.accent, '#692114');
            drawPixelRect(ctx, -2*s, -20*s, 6*s, 10*s, avatar.accent, '#692114');
            drawPixelRect(ctx, 4*s, -17*s, 6*s, 7*s, avatar.accent, '#692114');
        }
    }
    ctx.restore();
}

function drawChickenFrame(game) {
    const { ctx, width, height } = game;
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#47c8ff');
    sky.addColorStop(0.58, '#5ed7ff');
    sky.addColorStop(1, '#9befff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 0; x < width; x += 8) ctx.fillRect(x, 0, 1, height);
    for (let y = 0; y < height; y += 8) ctx.fillRect(0, y, width, 1);
    game.clouds.forEach((cloud, index) => drawChickenCloud(ctx, cloud.x, cloud.y, cloud.s, index % 2 === 1));
    game.obstacles.forEach(ob => {
        drawChickenBrickColumn(ctx, ob.x, 0, ob.width, ob.top);
        drawChickenBrickColumn(ctx, ob.x, ob.top + ob.gap, ob.width, height - ob.top - ob.gap - 34);
        (Array.isArray(ob.coins) ? ob.coins : (ob.coin ? [ob.coin] : [])).forEach(coin => {
            if (!coin.taken) drawChickenCoin(ctx, coin.x, coin.y, coin.scale || (coin.big ? 1.18 : 0.86));
        });
    });
    game.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / 24);
        drawPixelRect(ctx, p.x, p.y, 8, 8, p.color || '#fff');
        ctx.globalAlpha = 1;
    });
    drawChickenAvatar(ctx, game.avatarId, game.bird.x, game.bird.y, game.bird.size, game.bird.angle);
    const groundY = height - 36;
    drawPixelRect(ctx, 0, groundY, width, 36, '#72df3b');
    drawPixelRect(ctx, 0, groundY + 10, width, 26, '#38b92b');
    for (let x = -20; x < width; x += 18) {
        drawPixelRect(ctx, x + ((Math.floor(game.distance / 10) % 18)), groundY + 20, 12, 5, '#11662a');
    }
    if (!game.started || game.over) drawChickenOverlay(game);
}

function drawChickenOverlay(game) {
    const { ctx, width, height } = game;
    ctx.save();
    ctx.fillStyle = 'rgba(5,20,32,0.18)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = game.over ? '#ffdf4c' : '#ffffff';
    ctx.strokeStyle = '#2a2f3a';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.font = '900 30px system-ui, sans-serif';
    const title = game.over ? '撞墙啦' : '点击屏幕开始';
    ctx.strokeText(title, width / 2, height * 0.44);
    ctx.fillText(title, width / 2, height * 0.44);
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(game.over ? '再点一下重新起飞' : '吃金币，穿过砖墙，不要落地', width / 2, height * 0.44 + 30);
    ctx.restore();
}

function updateChickenHud() {
    if (!chickenGame) return;
    const coinEl = document.getElementById('chicken-coin-count');
    const scoreEl = document.getElementById('chicken-score-count');
    const bestEl = document.getElementById('chicken-best-count');
    const startBtn = document.querySelector('.chicken-start-btn');
    if (coinEl) coinEl.textContent = String(chickenGame.coins || 0);
    if (scoreEl) scoreEl.textContent = String(chickenGame.score || 0);
    if (bestEl) bestEl.textContent = String(chickenGame.best || getChickenBest());
    if (startBtn) {
        startBtn.classList.toggle('is-playing', chickenGame.started && chickenGame.running && !chickenGame.over);
        startBtn.textContent = chickenGame.over ? '重新开始' : '点击起飞';
    }
}

function renderChickenGame(el) {
    const activeAvatar = getChickenAvatarId();
    const best = getChickenBest();
    stopChickenGame(false);
    el.innerHTML = `
        <section class="chicken-game-shell">
            <div class="chicken-game-canvas-wrap">
                <canvas id="chicken-canvas" aria-label="肥鸡大冒险"></canvas>
                <div class="chicken-hud left"><i class="ri-coin-fill"></i><b id="chicken-coin-count">0</b></div>
                <div class="chicken-hud right"><i class="ri-trophy-fill"></i><b id="chicken-best-count">${best}</b></div>
                <button type="button" class="chicken-start-btn" onclick="flapChickenGame()">点击屏幕开始</button>
                <div class="chicken-avatar-row">
                    ${CHICKEN_AVATARS.map(item => `
                        <button type="button" class="${item.id === activeAvatar ? 'active' : ''}" onclick="setChickenAvatar('${musicEscapeAttr(item.id)}')">
                            <span>${item.icon}</span><b>${musicEscapeHtml(item.label)}</b>
                        </button>
                    `).join('')}
                </div>
            </div>
        </section>
    `;
    const canvas = document.getElementById('chicken-canvas');
    if (!canvas) return;
    resetChickenGame(canvas);
    const wrap = canvas.closest('.chicken-game-canvas-wrap');
    const onTap = (ev) => {
        if (ev.target.closest('.chicken-start-btn, .chicken-avatar-row')) return;
        ev.preventDefault();
        flapChickenGame();
    };
    wrap?.addEventListener('pointerdown', onTap);
    if (!window._chickenKeyboardReady) {
        window._chickenKeyboardReady = true;
        window.addEventListener('keydown', (ev) => {
            if (getActiveGame() !== 'chicken') return;
            if (ev.code === 'Space' || ev.key === ' ') {
                ev.preventDefault();
                flapChickenGame();
            }
        });
    }
    requestAnimationFrame(() => resetChickenGame(canvas));
}
window.renderChickenGame = renderChickenGame;
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

function getWolfchaNextAlivePlayer(state) {
    const players = Array.isArray(state?.players) ? state.players : [];
    const alive = players.filter(player => player.alive !== false);
    if (!alive.length) return null;
    const currentId = state.currentSpeakerId || state.selectedId;
    const index = alive.findIndex(player => player.id === currentId);
    return alive[(index + 1 + alive.length) % alive.length] || alive[0];
}

function getWolfchaRecentText(state) {
    return (state.log || [])
        .map(normalizeWolfchaLogEntry)
        .slice(-8)
        .map(item => `${item.name || '旁白'}：${item.text || ''}`)
        .join('\n');
}

function compactWolfchaPromptText(value, maxLength = 700) {
    const cleaner = typeof window.cleanChatApiVisibleContent === 'function'
        ? window.cleanChatApiVisibleContent
        : value => String(value == null ? '' : value);
    const text = cleaner(value)
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function getWolfchaRoleGuide(role) {
    const guides = {
        '狼人': '你的阵营目标是隐藏狼人身份、混淆好人视角、保护狼人队友、推动放逐好人。发言要像真实玩家一样找逻辑漏洞，不要直接承认自己是狼人。',
        '预言家': '你的阵营目标是帮助好人找狼人。没有明确查验结果时不要编造查验；如果要跳预言家，要说明你的警徽流或怀疑链，但避免泄露系统提示。',
        '女巫': '你的阵营目标是帮助好人。不要轻易暴露女巫身份；没有夜间用药记录时不要编造救人、毒人结果，可从发言状态和投票倾向盘逻辑。',
        '守卫': '你的阵营目标是帮助好人。不要轻易暴露守卫身份；没有守护结果时不要编造信息，可谨慎分析谁像神、谁像狼。',
        '猎人': '你的阵营目标是帮助好人。可以有压迫感和反击感，但不要无依据乱带队；除非局势需要，不要过早暴露身份。',
        '村民': '你没有夜间信息，目标是从发言、站边、票型和情绪里找狼人。不要编造查验、用药、守护等神职信息。'
    };
    return guides[role] || guides['村民'];
}

function getWolfchaPublicTableText(state, player) {
    const players = Array.isArray(state?.players) ? state.players : [];
    const aliveLines = players.map(item => {
        const flags = [
            item.id === player.id ? '你' : '',
            item.isUser ? '用户' : '',
            item.alive === false ? '出局' : '在场',
            item.id === state.currentSpeakerId ? '当前发言' : '',
            item.id === state.selectedId ? '被选中' : ''
        ].filter(Boolean).join('，');
        return `${item.number || '?'}号 ${item.name || '未知'}（${flags || '在场'}）`;
    });
    const wolfMates = player.role === '狼人'
        ? players
            .filter(item => item.id !== player.id && item.role === '狼人' && item.alive !== false)
            .map(item => `${item.number}号 ${item.name}`)
        : [];
    return [
        aliveLines.join('\n'),
        wolfMates.length ? `你的狼人队友：${wolfMates.join('、')}` : ''
    ].filter(Boolean).join('\n');
}

function getWolfchaSpeechHistoryText(state) {
    const logs = Array.isArray(state?.log) ? state.log.map(normalizeWolfchaLogEntry) : [];
    const lines = logs
        .filter(item => item && item.status !== 'pending' && item.text)
        .slice(-14)
        .map(item => {
            const type = item.type === 'speech' ? '发言' : '流程';
            return `【${type}】${item.name || '旁白'}：${compactWolfchaPromptText(item.text, 220)}`;
        });
    return lines.length ? lines.join('\n') : '暂无有效发言。';
}

function buildWolfchaAiSpeechPrompt(state, player, char) {
    const userProfile = typeof getUserProfile === 'function' ? getUserProfile() : { name: '我' };
    const role = player.role || '村民';
    const phase = state.phase === 'night' ? '夜晚' : '白天';
    const nickname = char?.chatConfig?.nickname ? `用户给你的备注名：${char.chatConfig.nickname}` : '';
    const userInfo = [
        `用户名：${userProfile.name || '我'}`,
        userProfile.bio ? `用户资料：${compactWolfchaPromptText(userProfile.bio, 220)}` : ''
    ].filter(Boolean).join('\n');
    return `【BYND 狼人杀发言任务】
现在不是微信聊天，而是游戏内发言。你必须继续扮演角色「${player.name}」，保留角色卡的人设、语气、关系和表达习惯，但发言内容必须符合狼人杀规则和当前局势。

【你的牌面】
- 玩家编号：${player.number || '?'}号
- 游戏身份：${role}
- 当前阶段：第 ${state.day || 1} 天，${phase}，轮到你发言
- 角色策略：${getWolfchaRoleGuide(role)}
${nickname ? `- ${nickname}\n` : ''}${userInfo ? `- ${userInfo}\n` : ''}
【公开场上信息】
${getWolfchaPublicTableText(state, player)}

【最近流程和发言】
${getWolfchaSpeechHistoryText(state)}

【发言要求】
- 只输出「${player.name}」的一段玩家发言，不要写旁白、舞台说明、系统说明、JSON、Markdown 或引号。
- 不要输出微信特殊指令，不要使用 ||| 分段。
- 你只知道自己的身份，以及规则允许你知道的信息；裁判拥有上帝视角，但你不能用上帝视角发言。
- 按你的身份目标说话：狼人要伪装和带节奏，好人要找狼、站边、质疑或保护关键玩家。
- 不要编造未发生的查验、救药、毒药、守护、枪击、投票结果；只能基于上面的公开信息和你的身份推理。
- 发言要像真实狼人杀玩家，允许有角色口吻、情绪、试探、拉踩、反问，但不要自曝隐藏身份，除非符合当前策略。
- 60-140 字，中文。`;
}

function cleanWolfchaAiSpeechContent(value, playerName) {
    const cleaner = typeof window.cleanChatApiVisibleContent === 'function'
        ? window.cleanChatApiVisibleContent
        : value => String(value == null ? '' : value);
    let text = cleaner(value)
        .replace(/\[微信(?:转账|红包|语音|表情|语音电话|视频电话)[^\]]*\]/g, '')
        .replace(/\|\|\|/g, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const labels = ['旁白', '系统', '法官', '主持人', '玩家发言', '发言', playerName].filter(Boolean)
        .map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (labels.length) {
        text = text.replace(new RegExp(`^(?:${labels.join('|')})[：:]\\s*`, 'i'), '').trim();
    }
    return text.length > 220 ? `${text.slice(0, 219)}…` : text;
}

const WOLFCHA_NIGHT_STEPS = [
    { key: 'werewolf', role: '狼人', text: '狼人请睁眼，确认队友并选择今晚的目标。' },
    { key: 'seer', role: '预言家', text: '预言家请睁眼，选择一名玩家查验身份。' },
    { key: 'witch', role: '女巫', text: '女巫请睁眼，选择是否使用解药或毒药。' },
    { key: 'guard', role: '守卫', text: '守卫请睁眼，选择今晚要守护的对象。' }
];

function getWolfchaAlivePlayers(state) {
    return (Array.isArray(state?.players) ? state.players : []).filter(player => player.alive !== false);
}

function prepareWolfchaSpeechQueue(state) {
    const alive = getWolfchaAlivePlayers(state);
    state.speechQueue = alive.map(player => player.id);
    state.speechIndex = -1;
}

function getWolfchaCurrentSpeaker(state) {
    const players = Array.isArray(state?.players) ? state.players : [];
    return players.find(player => player.id === state.currentSpeakerId)
        || players.find(player => player.id === state.selectedId)
        || getWolfchaAlivePlayers(state)[0]
        || null;
}

function beginWolfchaSpeechTurn(state, player) {
    if (!player) return;
    state.turnMode = 'speaking';
    state.currentSpeakerId = player.id;
    state.selectedId = player.id;
    state.awaitingUserSpeech = !!player.isUser;
    state.aiSpeechBusyId = player.isUser ? '' : player.id;
    state.action = `${player.number} 号发言`;
    pushWolfchaLog(state, {
        type: 'narrator',
        name: '旁白',
        playerId: player.id,
        text: player.isUser
            ? `轮到 ${player.name} 发言。请在头像上方输入你的发言。`
            : `轮到 ${player.number} 号 ${player.name} 发言。`
    });
    if (!player.isUser) {
        pushWolfchaLog(state, {
            type: 'speech',
            name: player.name,
            playerId: player.id,
            status: 'pending',
            text: '正在整理发言...'
        });
    }
}

function moveWolfchaToNextSpeech(state) {
    const alive = getWolfchaAlivePlayers(state);
    if (!Array.isArray(state.speechQueue) || !state.speechQueue.length) {
        state.speechQueue = alive.map(player => player.id);
        state.speechIndex = -1;
    }
    let nextIndex = Number.isFinite(state.speechIndex) ? state.speechIndex + 1 : 0;
    while (nextIndex < state.speechQueue.length) {
        const player = alive.find(item => item.id === state.speechQueue[nextIndex]);
        if (player) {
            state.speechIndex = nextIndex;
            beginWolfchaSpeechTurn(state, player);
            return player;
        }
        nextIndex += 1;
    }
    state.turnMode = 'vote';
    state.awaitingUserSpeech = false;
    state.aiSpeechBusyId = '';
    state.action = '放逐投票';
    pushWolfchaLog(state, {
        type: 'narrator',
        name: '旁白',
        text: '本轮发言结束。请选择你怀疑的玩家，然后点击「放逐」。'
    });
    return null;
}

function getWolfchaPendingSpeechIndex(logs, playerId) {
    return logs
        .map((item, index) => ({ item, index }))
        .reverse()
        .find(({ item }) => item.playerId === playerId && item.status === 'pending')?.index;
}

async function runWolfchaAiSpeech(playerId) {
    const state = getGameState();
    if (!state) return;
    const player = (state.players || []).find(item => item.id === playerId && item.alive !== false);
    if (!player || player.isUser) return;
    const char = (window.myCharacters || []).find(item => item.id === player.id);
    if (!char || typeof callChatApi !== 'function') {
        updateWolfchaState(next => {
            next.aiSpeechBusyId = '';
            next.turnMode = 'speech_done';
            next.action = `${player.number} 号发言未完成`;
            const logs = Array.isArray(next.log) ? next.log.map(normalizeWolfchaLogEntry) : [];
            const pendingIndex = getWolfchaPendingSpeechIndex(logs, player.id);
            if (pendingIndex != null) logs.splice(pendingIndex, 1);
            next.log = logs;
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `${player.name} 暂时无法接入 API 发言，请点击旁白继续。` });
        });
        return;
    }
    try {
        const latest = getGameState() || state;
        const messages = typeof buildMessages === 'function'
            ? buildMessages(char, Array.isArray(char.history) ? char.history.slice(-6) : [])
            : [{ role: 'system', content: `你是${player.name}。` }];
        messages.push({
            role: 'user',
            content: buildWolfchaAiSpeechPrompt(latest, player, char)
        });
        const result = await callChatApi(messages);
        updateWolfchaState(next => {
            const logs = Array.isArray(next.log) ? next.log.map(normalizeWolfchaLogEntry) : [];
            const pendingIndex = getWolfchaPendingSpeechIndex(logs, player.id);
            if (result.ok) {
                const cleanText = cleanWolfchaAiSpeechContent(result.content, player.name);
                const speech = { type: 'speech', name: player.name, playerId: player.id, text: cleanText || '……' };
                if (pendingIndex != null) logs[pendingIndex] = speech;
                else logs.push(speech);
                next.log = logs;
                next.turnMode = 'speech_done';
                next.action = `${player.number} 号发言结束`;
            } else {
                if (pendingIndex != null) logs.splice(pendingIndex, 1);
                next.log = logs;
                next.turnMode = 'speech_done';
                next.action = `${player.number} 号发言未完成`;
                pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `${player.name} 的 API 发言失败：${result.error}` });
            }
            next.aiSpeechBusyId = '';
            next.awaitingUserSpeech = false;
        });
    } catch (e) {
        updateWolfchaState(next => {
            const logs = Array.isArray(next.log) ? next.log.map(normalizeWolfchaLogEntry) : [];
            const pendingIndex = getWolfchaPendingSpeechIndex(logs, player.id);
            if (pendingIndex != null) logs.splice(pendingIndex, 1);
            next.log = logs;
            next.aiSpeechBusyId = '';
            next.awaitingUserSpeech = false;
            next.turnMode = 'speech_done';
            next.action = `${player.number} 号发言未完成`;
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `${player.name} 的 API 发言没有接通：${e.message || '未知错误'}` });
        });
    }
}

function wolfchaNarratorStep() {
    const state = getGameState();
    if (!state) return;
    if (state.aiSpeechBusyId) {
        if (typeof showWechatToast === 'function') showWechatToast('AI 正在发言，稍等一下');
        return;
    }
    let aiToSpeak = '';
    updateWolfchaState(next => {
        if (next.awaitingUserSpeech) {
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: '请先完成你的发言，再继续流程。' });
            return;
        }
        const mode = next.turnMode || 'day_intro';
        if (mode === 'day_intro') {
            next.phase = 'day';
            prepareWolfchaSpeechQueue(next);
            next.action = next.day === 1 ? '警徽竞选发言' : `第 ${next.day} 天发言`;
            pushWolfchaLog(next, {
                type: 'narrator',
                name: '旁白',
                text: next.day === 1
                    ? '警徽竞选开始。旁白将按顺序点名，轮到 AI 会自动发言，轮到你会出现输入框。'
                    : `第 ${next.day} 天开始，所有存活玩家依次发言。`
            });
            const player = moveWolfchaToNextSpeech(next);
            if (player && !player.isUser) aiToSpeak = player.id;
            return;
        }
        if (mode === 'speech_done' || mode === 'speaking') {
            const player = moveWolfchaToNextSpeech(next);
            if (player && !player.isUser) aiToSpeak = player.id;
            return;
        }
        if (mode === 'vote') {
            next.action = '等待投票';
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: '请在下方点选一名玩家，再点击「放逐」。如果暂时不想放逐，可以点击「入夜」。' });
            return;
        }
        if (mode === 'night_intro') {
            next.phase = 'night';
            next.nightStep = 0;
            next.turnMode = 'night_action';
            next.action = `第 ${next.day || 1} 夜`;
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `天黑请闭眼。${WOLFCHA_NIGHT_STEPS[0].text}` });
            return;
        }
        if (mode === 'night_action') {
            const step = Number.isFinite(next.nightStep) ? next.nightStep + 1 : 1;
            if (step < WOLFCHA_NIGHT_STEPS.length) {
                next.nightStep = step;
                next.action = WOLFCHA_NIGHT_STEPS[step].role + '行动';
                pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: WOLFCHA_NIGHT_STEPS[step].text });
                return;
            }
            next.phase = 'day';
            next.day = (next.day || 1) + 1;
            next.turnMode = 'day_intro';
            next.nightStep = 0;
            next.action = `第 ${next.day} 天天亮`;
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `天亮了。第 ${next.day} 天开始，点击旁白继续进入发言轮。` });
            return;
        }
        next.turnMode = 'day_intro';
        pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: '流程已整理，点击旁白继续开始下一步。' });
    });
    if (aiToSpeak) setTimeout(() => runWolfchaAiSpeech(aiToSpeak), 300);
}
window.wolfchaNarratorStep = wolfchaNarratorStep;

function startWolfchaNight() {
    updateWolfchaState(state => {
        state.phase = 'night';
        state.turnMode = 'night_intro';
        state.awaitingUserSpeech = false;
        state.aiSpeechBusyId = '';
        state.action = '第 ' + state.day + ' 夜，天黑请闭眼';
        pushWolfchaLog(state, {
            type: 'narrator',
            name: '旁白',
            text: '夜幕降临。点击「旁白继续」，我会按狼人、预言家、女巫、守卫的顺序引导。'
        });
    });
}
window.startWolfchaNight = startWolfchaNight;

async function wolfchaNextSpeech() {
    const state = getGameState();
    if (!state) return;
    if (state.awaitingUserSpeech) {
        const input = document.getElementById('wolfcha-user-speech-input');
        input?.focus();
        if (typeof showWechatToast === 'function') showWechatToast('轮到你发言，先输入内容');
        return;
    }
    const player = getWolfchaCurrentSpeaker(state);
    if (player && !player.isUser && (state.turnMode === 'speaking' || state.aiSpeechBusyId === player.id)) {
        runWolfchaAiSpeech(player.id);
        return;
    }
    wolfchaNarratorStep();
}
window.wolfchaNextSpeech = wolfchaNextSpeech;

function submitWolfchaUserSpeech() {
    const input = document.getElementById('wolfcha-user-speech-input');
    const text = String(input?.value || '').trim();
    const state = getGameState();
    if (!state || !state.awaitingUserSpeech) return;
    const player = getWolfchaCurrentSpeaker(state);
    if (!player || !player.isUser) return;
    if (!text) {
        if (typeof showWechatToast === 'function') showWechatToast('先写一句发言');
        input?.focus();
        return;
    }
    updateWolfchaState(next => {
        next.awaitingUserSpeech = false;
        next.turnMode = 'speech_done';
        next.aiSpeechBusyId = '';
        next.action = `${player.number} 号发言结束`;
        pushWolfchaLog(next, { type: 'speech', name: player.name, playerId: player.id, text });
        pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `${player.name} 发言结束。点击「旁白继续」进入下一位。` });
    });
}
window.submitWolfchaUserSpeech = submitWolfchaUserSpeech;

function wolfchaVoteSelected() {
    updateWolfchaState(state => {
        const player = state.players.find(item => item.id === state.selectedId);
        if (!player || player.alive === false) {
            pushWolfchaLog(state, { type: 'narrator', name: '旁白', text: '请选择一名仍在场的玩家再放逐。' });
            return;
        }
        player.alive = false;
        state.phase = 'day';
        state.turnMode = 'night_intro';
        state.awaitingUserSpeech = false;
        state.aiSpeechBusyId = '';
        state.action = `${player.number} 号被放逐`;
        state.currentSpeakerId = getWolfchaNextAlivePlayer(state)?.id || 'user';
        pushWolfchaLog(state, {
            type: 'narrator',
            name: '旁白',
            playerId: player.id,
            text: isWolfchaRoleVisibleToUser(player, state)
                ? `${player.name} 被投票出局，身份是 ${player.role}。`
                : `${player.name} 被投票出局，身份已由裁判记录，玩家视角不公开。`
        });
        pushWolfchaLog(state, { type: 'narrator', name: '旁白', text: '放逐结束，接下来进入夜晚。点击「旁白继续」开始夜间行动。' });
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
const DESKTOP_FOLDER_STORAGE_KEY = 'desktop_folders';
window._folders = JSON.parse(localStorage.getItem(DESKTOP_FOLDER_STORAGE_KEY) || '[]');

function saveFolders() {
    localStorage.setItem(DESKTOP_FOLDER_STORAGE_KEY, JSON.stringify(window._folders));
}

function desktopEscapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function desktopEscapeAttr(value) {
    return desktopEscapeHtml(value).replace(/"/g, '&quot;');
}

function getDesktopAppDefinition(appRef) {
    const id = typeof appRef === 'string' ? appRef : appRef?.id;
    const name = typeof appRef === 'object' ? appRef?.name : '';
    const base = getDesktopAnyAppDefinition(appRef);
    return {
        id: base?.id || id || name || '',
        name: base?.name || name || '应用',
        icon: base?.icon || appRef?.icon || 'ri-apps-line'
    };
}

function normalizeDesktopAppRef(appRef) {
    const app = getDesktopAppDefinition(appRef);
    return app.id ? { id: app.id } : app;
}

function normalizeDesktopFolder(folder) {
    const safe = folder && typeof folder === 'object' ? folder : {};
    const apps = Array.isArray(safe.apps) ? safe.apps.map(normalizeDesktopAppRef).filter(app => app.id) : [];
    return {
        id: safe.id || `folder_${Date.now()}`,
        name: String(safe.name || '文件夹').trim() || '文件夹',
        apps,
        width: Number(safe.width) || null,
        height: Number(safe.height) || null,
        size: safe.size === 'large' ? 'large' : 'small'
    };
}

function normalizeDesktopFolders() {
    window._folders = (Array.isArray(window._folders) ? window._folders : []).map(normalizeDesktopFolder).filter(folder => folder.apps.length > 0);
}

function getDesktopFolderApps(folder) {
    return (Array.isArray(folder?.apps) ? folder.apps : []).map(getDesktopAppDefinition).filter(app => app.id);
}

function getDesktopThemeData(source) {
    if (source && typeof source === 'object') return source;
    try {
        return JSON.parse(localStorage.getItem('my_theme_data') || '{}') || {};
    } catch (e) {
        return {};
    }
}

function getDesktopThemeIconUrl(appId, source) {
    const data = getDesktopThemeData(source);
    const appIndex = getDesktopAllAppDefinitions().findIndex(app => app.id === appId);
    let icons = Array.isArray(data.icons) ? data.icons : [];
    if (typeof normalizeThemeIconList === 'function') icons = normalizeThemeIconList(icons);
    return appIndex >= 0 ? String(icons[appIndex] || '').trim() : '';
}

function renderDesktopAppIcon(appRef, options = {}) {
    const app = getDesktopAppDefinition(appRef);
    const url = getDesktopThemeIconUrl(app.id, options.themeData);
    if (url) return `<img class="desktop-app-icon-img" src="${desktopEscapeAttr(url)}" alt="">`;
    return `<i class="${desktopEscapeAttr(app.icon)}"></i>`;
}

function getDesktopAppIdFromElement(item) {
    if (!item) return '';
    if (item.dataset.appId) return item.dataset.appId;
    const onclick = item.getAttribute('onclick') || '';
    const match = onclick.match(/openApp\(['"]([^'"]+)['"]\)/);
    if (match?.[1]) return match[1];
    const label = item.querySelector('span')?.textContent?.trim();
    return getDesktopAllAppDefinitions().find(app => app.name === label)?.id || '';
}

function hydrateDesktopAppElement(item) {
    const appId = getDesktopAppIdFromElement(item);
    if (!appId) return null;
    const app = getDesktopAppDefinition(appId);
    item.dataset.appId = app.id;
    if (!item.dataset.layoutId) item.dataset.layoutId = `app-${app.id}`;
    return app;
}

function syncDesktopFolderIcon(folderId) {
    const folder = window._folders.find(item => item.id === folderId);
    document.querySelectorAll('.app-item.is-folder').forEach(item => {
        if (item.dataset.folderId !== folderId || !folder) return;
        const icon = item.querySelector('.app-icon');
        const label = item.querySelector('span');
        if (icon) icon.innerHTML = renderDesktopFolderMiniIcons(folder);
        if (label) label.textContent = folder.name;
    });
}

function refreshDesktopThemedIcons(themeData) {
    document.querySelectorAll('.apps-quad .app-item:not(.is-folder), .page2-app-grid .app-item:not(.is-folder), .desktop-layout-item.app-item:not(.is-folder)').forEach(item => {
        const app = hydrateDesktopAppElement(item);
        if (!app) return;
        const icon = item.querySelector('.app-icon');
        const label = item.querySelector('span');
        if (icon) icon.innerHTML = renderDesktopAppIcon(app, { themeData });
        if (label) label.textContent = app.name;
    });
    document.querySelectorAll('.app-item.is-folder').forEach(item => {
        const folder = window._folders.find(folderItem => folderItem.id === item.dataset.folderId);
        const icon = item.querySelector('.app-icon');
        const label = item.querySelector('span');
        if (icon && folder) icon.innerHTML = renderDesktopFolderMiniIcons(folder, { themeData });
        if (label && folder) label.textContent = folder.name;
    });
    document.querySelectorAll('#folder-grid .folder-grid-item[data-app-id]').forEach(item => {
        const app = getDesktopAppDefinition(item.dataset.appId);
        const icon = item.querySelector('.app-icon');
        const label = item.querySelector('span');
        if (icon) icon.innerHTML = renderDesktopAppIcon(app, { themeData });
        if (label) label.textContent = app.name;
    });
    getDesktopDockItems().forEach(item => {
        const app = hydrateDesktopDockItem(item);
        if (!app) return;
        const icon = item.querySelector('.dock-icon-box');
        const label = item.querySelector('.dock-label');
        if (icon) icon.innerHTML = renderDesktopAppIcon(app, { themeData });
        if (label) label.textContent = app.name;
    });
}
window.refreshDesktopThemedIcons = refreshDesktopThemedIcons;

function applyFolderPopupSize(folder, popup) {
    if (!folder || !popup) return;
    const width = Math.max(240, Math.min(340, Number(folder.width) || 260));
    const height = Math.max(250, Math.min(520, Number(folder.height) || 0));
    popup.style.width = `${width}px`;
    popup.style.height = folder.height ? `${height}px` : '';
}

function saveFolderPopupSize(folderId, popup) {
    const folder = window._folders.find(item => item.id === folderId);
    if (!folder || !popup) return;
    folder.width = Math.round(popup.offsetWidth || 260);
    folder.height = Math.round(popup.offsetHeight || 0);
    saveFolders();
}

function ensureFolderResizeHandle(popup) {
    if (!popup || popup.querySelector('.folder-resize-handle')) return;
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'folder-resize-handle';
    handle.setAttribute('aria-label', '调整文件夹大小');
    handle.innerHTML = '<i class="ri-drag-move-2-line"></i>';
    handle.addEventListener('click', event => event.stopPropagation());
    handle.addEventListener('pointerdown', startFolderPopupResize);
    popup.appendChild(handle);
}

function startFolderPopupResize(e) {
    const popup = e.currentTarget.closest('.folder-popup');
    const overlay = popup?.closest('.folder-overlay');
    const folderId = popup?.dataset.folderId;
    if (!popup || !overlay || !folderId) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = popup.offsetWidth;
    const startHeight = popup.offsetHeight;
    const maxWidth = Math.max(260, overlay.clientWidth - 34);
    const maxHeight = Math.max(300, overlay.clientHeight - 120);
    if (typeof e.currentTarget.setPointerCapture === 'function') {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    }
    const move = ev => {
        const width = Math.max(240, Math.min(maxWidth, startWidth + ev.clientX - startX));
        const height = Math.max(250, Math.min(maxHeight, startHeight + ev.clientY - startY));
        popup.style.width = `${Math.round(width)}px`;
        popup.style.height = `${Math.round(height)}px`;
    };
    const up = () => {
        saveFolderPopupSize(folderId, popup);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

function createFolder(app1, app2) {
    const folder = {
        id: 'folder_' + Date.now(),
        name: '文件夹',
        apps: [normalizeDesktopAppRef(app1), normalizeDesktopAppRef(app2)],
        width: null,
        height: null,
        size: 'small'
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
    const popup = overlay?.querySelector('.folder-popup');
    if (!overlay || !grid || !nameInput || !popup) return;

    const isEditing = !!window._editMode;
    popup.dataset.folderId = folderId;
    popup.classList.toggle('large-folder', folder.size === 'large');
    overlay.classList.toggle('folder-editing', isEditing);
    applyFolderPopupSize(folder, popup);
    ensureFolderResizeHandle(popup);
    nameInput.value = folder.name;
    nameInput.oninput = () => {
        folder.name = nameInput.value.trim() || '文件夹';
        saveFolders();
        syncDesktopFolderIcon(folderId);
    };

    grid.innerHTML = `
        <button type="button" class="folder-size-toggle" onclick="event.stopPropagation();toggleDesktopFolderSize('${desktopEscapeAttr(folderId)}')">
            <i class="${folder.size === 'large' ? 'ri-collapse-diagonal-line' : 'ri-expand-diagonal-line'}"></i>
            <span>${folder.size === 'large' ? '小文件夹' : '大文件夹'}</span>
        </button>
    `;
    getDesktopFolderApps(folder).forEach(app => {
        const item = document.createElement('div');
        item.className = 'app-item folder-grid-item';
        item.dataset.appId = app.id;
        item.dataset.folderId = folderId;
        item.onclick = (e) => {
            e.stopPropagation();
            if (window._editMode) {
                moveAppOutOfFolder(folderId, app.id, { keepOpen: true });
                return;
            }
            closeFolderOverlay();
            openApp(app.id);
        };
        item.innerHTML = `
            <div class="app-icon icon-black">${renderDesktopAppIcon(app)}</div>
            <span>${desktopEscapeHtml(app.name)}</span>
            <button type="button" class="folder-move-out-btn" aria-label="移出到桌面">
                <i class="ri-logout-box-r-line"></i>
            </button>
        `;
        item.querySelector('.folder-move-out-btn')?.addEventListener('click', (event) => {
            event.stopPropagation();
            moveAppOutOfFolder(folderId, app.id, { keepOpen: window._editMode });
        });
        grid.appendChild(item);
    });

    overlay.classList.remove('hidden');
}

function closeFolderOverlay(e) {
    if (e && e.target !== e.currentTarget) return;
    const overlay = document.getElementById('folder-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('folder-editing');
}

function toggleDesktopFolderSize(folderId) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;
    folder.size = folder.size === 'large' ? 'small' : 'large';
    if (folder.size === 'large') {
        folder.width = Math.max(Number(folder.width) || 260, 318);
        folder.height = Math.max(Number(folder.height) || 0, 430);
    } else {
        folder.width = 260;
        folder.height = null;
    }
    saveFolders();
    syncDesktopFolderIcon(folderId);
    openFolder(folderId);
}
window.toggleDesktopFolderSize = toggleDesktopFolderSize;

function resizeDesktopFolderLayoutIcon(folderId, isLarge) {
    const item = Array.from(document.querySelectorAll('.desktop-layout-item.is-folder')).find(el => el.dataset.folderId === folderId);
    const pageArea = item?.closest?.('.desktop-scroll-area');
    if (!item || !pageArea) return;
    const left = parseFloat(item.style.left) || item.offsetLeft || 24;
    const top = parseFloat(item.style.top) || item.offsetTop || 64;
    applyDesktopLayoutRect(item, pageArea, {
        left,
        top,
        width: isLarge ? 156 : 72,
        height: isLarge ? 132 : 76
    }, { mode: 'resize' });
}

function addToFolder(folderId, app) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;
    const appRef = normalizeDesktopAppRef(app);
    if (!folder.apps.find(a => a.id === appRef.id)) {
        folder.apps.push(appRef);
        saveFolders();
        rebuildDesktop();
        syncDesktopFolderIcon(folderId);
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

// --- Co-reading / 共读小说 ---
const COREAD_LIBRARY_KEY = 'bynd_coread_library_v1';
const COREAD_DAILY_KEY = 'bynd_coread_daily_v1';
const COREAD_DAILY_PARTICIPANTS_KEY = 'bynd_coread_daily_participants_v1';
const COREAD_SOURCE_KEY = 'bynd_coread_sources_v1';
const COREAD_SOURCE_VERSION_KEY = 'bynd_coread_sources_version_v1';
const COREAD_READER_SETTINGS_KEY = 'bynd_coread_reader_settings_v1';
const COREAD_READER_WALLPAPER_KEY = 'bynd_coread_reader_wallpaper_v1';
const COREAD_PROGRESS_KEY = 'bynd_coread_progress_v1';
const COREAD_SHELF_SETTINGS_KEY = 'bynd_coread_shelf_settings_v1';
const COREAD_SHELF_META_KEY = 'bynd_coread_shelf_meta_v1';
const COREAD_BUILTIN_SOURCE_VERSION = 'moxing-7.1-web-20260608';
const COREAD_BUILTIN_SOURCE_URL = 'assets/coread-book-sources.json?v=20260608-moxing71';
const COREAD_DEFAULT_SOURCE_URLS = [
    'https://lifves.com/api/v2/booksource/list',
    'https://someok.github.io/booksources/data.json'
];
let coreadActiveBookId = '';
let coreadActiveCharId = '';
let coreadBusy = false;
let coreadSearchCache = [];
let coreadActiveTab = 'discover';
let coreadShelfCategory = 'all';
let coreadShelfMenuOpen = false;
let coreadShelfToolPanel = '';
let coreadShelfStatusText = '';
let coreadShelfSelectionMode = false;
let coreadShelfSelectedIds = new Set();
let coreadStatsRange = 'day';
let coreadStatsOffset = 0;
let coreadBookReviewBusyId = '';
let coreadMateDropdownOpen = false;
let coreadDailyLoading = false;
let coreadSearchRunId = 0;
let coreadTocOpen = false;
let coreadSettingsOpen = false;
let coreadCommentPanelOpen = false;
let coreadReaderPanelTab = 'chapters';
let coreadReaderPanelOpen = false;
let coreadReaderChapterGroupIndex = -1;
let coreadReaderChapterGroupPickerOpen = false;
let coreadReaderToolPointerAt = 0;
let coreadCommentStatusText = '';
let coreadLibraryCache = null;
let coreadLibraryCacheRaw = '';
let coreadProgressCache = null;
let coreadProgressCacheRaw = '';
let coreadReaderSettingsCache = null;
let coreadReaderSettingsCacheRaw = '';
let coreadReaderWallpaperCache = '';
let coreadReaderWallpaperCacheRaw = null;
let coreadReaderTapState = null;
let coreadReaderTapHandledAt = 0;
let coreadReaderPendingScrollPage = null;
let coreadSettingsPointerAt = 0;
let coreadPageModePointerAt = 0;
let coreadPageModeCommitToken = 0;
let coreadFastSettingsBound = false;
let coreadDiscoveryLoadStarted = false;
const coreadResolvingBookIds = new Set();

const COREAD_DAILY_SEEDS = [
    '中文 小说 文学', '幻想 小说', 'romance fiction', 'mystery fiction',
    'science fiction', 'historical fiction', 'poetry', 'essay literature',
    'young adult fantasy', 'contemporary novel', 'classic literature', 'short stories'
];

const COREAD_DAILY_LINES = [
    '今天不急着读完，先把第一句留给喜欢的人。',
    '随机翻到的书，也可能刚好撞进当前剧情。',
    '让 char 坐到书页旁边，故事会多出另一种呼吸。',
    '每日一书，每日一言，像有人把新的门轻轻推开。',
    '读同一本书时，沉默也会变成聊天记录。'
];

const COREAD_SHELF_CATEGORIES = [
    { id: 'all', label: '全部' },
    { id: 'unsorted', label: '未整理' },
    { id: 'pending', label: '待看' }
];

const COREAD_SHELF_TOOL_GROUPS = [
    [
        { id: 'select', label: '选择书籍', icon: 'ri-checkbox-line' }
    ],
    [
        { id: 'importLocal', label: '从本机导入', icon: 'ri-add-line' },
        { id: 'scanFolder', label: '扫描文件夹', icon: 'ri-folder-line' },
        { id: 'smartImport', label: '智能导入', icon: 'ri-scan-2-line' },
        { id: 'createBook', label: '创建书籍', icon: 'ri-booklet-line' }
    ],
    [
        { id: 'settings', label: '书架设置', icon: 'ri-settings-3-line' },
        { id: 'tags', label: '标签管理', icon: 'ri-hashtag' },
        { id: 'categories', label: '分类管理', icon: 'ri-folder-settings-line' },
        { id: 'sort', label: '书籍排序', icon: 'ri-sort-desc', arrow: true },
        { id: 'more', label: '更多', icon: 'ri-more-fill', arrow: true }
    ]
];

const COREAD_SHELF_DEFAULT_SETTINGS = {
    viewMode: 'grid',
    compact: false,
    cardMode: true,
    divider: false,
    sidePadding: 16,
    topSteps: 0
};

const COREAD_SHELF_DEFAULT_META = {
    categories: {},
    sortMode: 'recent'
};

const COREAD_OBFUSCATED_TEXT_MAP = {
    '': '这', '': '天', '': '里', '': '之', '': '地', '': '大',
    '': '和', '': '美', '': '如', '': '以', '': '下', '': '么',
    '': '后', '': '为', '': '上', '': '道', '': '来', '': '然',
    '': '而', '': '对', '': '于', '': '没', '': '用', '': '自',
    '': '要', '': '时', '': '心', '': '个', '': '小', '': '事',
    '': '第', '': '发', '': '可', '': '想', '': '样', '': '家',
    '': '开', '': '们', '': '起', '': '出'
};
const COREAD_PAGE_SIZE = 480;
const COREAD_AI_CONTEXT_PREVIOUS_PAGES = 1;
const COREAD_AI_COMMENT_MAX_TOKENS = 1800;
const COREAD_AI_REPLY_MAX_TOKENS = 1800;
const COREAD_RESOLVE_VERSION = 3;
const COREAD_META_VERSION = 1;
const COREAD_CHAPTER_VERSION = 1;

function getCoReadCharacters() {
    return Array.isArray(window.myCharacters)
        ? window.myCharacters.filter(char => char && char.id && !char.isGroupChat)
        : [];
}

function getCoReadLibrary() {
    try {
        const raw = localStorage.getItem(COREAD_LIBRARY_KEY) || '[]';
        if (raw !== coreadLibraryCacheRaw || !Array.isArray(coreadLibraryCache)) {
            const list = JSON.parse(raw);
            coreadLibraryCache = Array.isArray(list) ? list.filter(item => item && item.id) : [];
            coreadLibraryCacheRaw = raw;
        }
        applyCoReadStoredProgress(coreadLibraryCache);
        return coreadLibraryCache;
    } catch (_) {
        return [];
    }
}

function saveCoReadLibrary(list) {
    const normalized = (Array.isArray(list) ? list : []).slice(0, 80);
    const raw = JSON.stringify(normalized);
    localStorage.setItem(COREAD_LIBRARY_KEY, raw);
    coreadLibraryCache = normalized;
    coreadLibraryCacheRaw = raw;
}

function getCoReadProgressMap() {
    try {
        const raw = localStorage.getItem(COREAD_PROGRESS_KEY) || '{}';
        if (raw !== coreadProgressCacheRaw || !coreadProgressCache) {
            const parsed = JSON.parse(raw);
            coreadProgressCache = parsed && typeof parsed === 'object' ? parsed : {};
            coreadProgressCacheRaw = raw;
        }
        return coreadProgressCache;
    } catch (_) {
        coreadProgressCache = {};
        coreadProgressCacheRaw = '{}';
        return coreadProgressCache;
    }
}

function applyCoReadStoredProgress(list) {
    if (!Array.isArray(list) || !list.length) return;
    const progress = getCoReadProgressMap();
    list.forEach(book => {
        if (!book || !book.id) return;
        const savedPage = Number(progress[book.id]);
        if (Number.isFinite(savedPage) && savedPage >= 0) book.page = savedPage;
    });
}

function saveCoReadBookPage(bookId, page) {
    const id = String(bookId || '');
    if (!id) return;
    const nextPage = Math.max(0, Math.floor(Number(page || 0)));
    const progress = { ...getCoReadProgressMap(), [id]: nextPage };
    const raw = JSON.stringify(progress);
    localStorage.setItem(COREAD_PROGRESS_KEY, raw);
    coreadProgressCache = progress;
    coreadProgressCacheRaw = raw;
    if (Array.isArray(coreadLibraryCache)) {
        const cached = coreadLibraryCache.find(book => book && book.id === id);
        if (cached) {
            cached.page = nextPage;
            cached.updatedAt = Date.now();
            if (getCoReadBookProgress(cached) >= 100) cached.finishedAt = cached.finishedAt || Date.now();
            const libraryRaw = JSON.stringify(coreadLibraryCache.slice(0, 80));
            localStorage.setItem(COREAD_LIBRARY_KEY, libraryRaw);
            coreadLibraryCacheRaw = libraryRaw;
        }
    }
}

function normalizeCoReadShelfSettings(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        viewMode: ['grid', 'waterfall', 'list'].includes(source.viewMode) ? source.viewMode : COREAD_SHELF_DEFAULT_SETTINGS.viewMode,
        compact: !!source.compact,
        cardMode: source.cardMode !== false,
        divider: !!source.divider,
        sidePadding: Math.max(8, Math.min(28, Number(source.sidePadding || COREAD_SHELF_DEFAULT_SETTINGS.sidePadding))),
        topSteps: Math.max(0, Math.min(72, Number(source.topSteps || COREAD_SHELF_DEFAULT_SETTINGS.topSteps)))
    };
}

function getCoReadShelfSettings() {
    try {
        return normalizeCoReadShelfSettings(JSON.parse(localStorage.getItem(COREAD_SHELF_SETTINGS_KEY) || '{}'));
    } catch (_) {
        return normalizeCoReadShelfSettings({});
    }
}

function saveCoReadShelfSettings(next) {
    const settings = normalizeCoReadShelfSettings({ ...getCoReadShelfSettings(), ...(next || {}) });
    localStorage.setItem(COREAD_SHELF_SETTINGS_KEY, JSON.stringify(settings));
    return settings;
}

function normalizeCoReadShelfMeta(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawCategories = source.categories && typeof source.categories === 'object' ? source.categories : {};
    const categories = {};
    Object.keys(rawCategories).forEach(name => {
        const safeName = String(name || '').trim().slice(0, 28);
        if (!safeName) return;
        const item = rawCategories[name] && typeof rawCategories[name] === 'object' ? rawCategories[name] : {};
        categories[safeName] = {
            coverUrl: normalizeCoReadCoverUrl(item.coverUrl || ''),
            createdAt: Number(item.createdAt || Date.now())
        };
    });
    return {
        categories,
        sortMode: ['recent', 'title', 'author', 'progress'].includes(source.sortMode) ? source.sortMode : COREAD_SHELF_DEFAULT_META.sortMode
    };
}

function getCoReadShelfMeta() {
    try {
        return normalizeCoReadShelfMeta(JSON.parse(localStorage.getItem(COREAD_SHELF_META_KEY) || '{}'));
    } catch (_) {
        return normalizeCoReadShelfMeta({});
    }
}

function saveCoReadShelfMeta(next) {
    const meta = normalizeCoReadShelfMeta({ ...getCoReadShelfMeta(), ...(next || {}) });
    localStorage.setItem(COREAD_SHELF_META_KEY, JSON.stringify(meta));
    return meta;
}

function showCoReadShelfToast(text) {
    const msg = String(text || '').trim();
    if (!msg) return;
    setCoReadShelfStatus(msg);
    if (typeof showWechatToast === 'function') showWechatToast(msg);
}

function applyCoReadShelfSettings() {
    const content = document.querySelector('.coread-content');
    if (!content) return;
    const settings = getCoReadShelfSettings();
    content.dataset.shelfView = settings.viewMode;
    content.classList.toggle('coread-shelf-compact', !!settings.compact);
    content.classList.toggle('coread-shelf-card-mode', !!settings.cardMode);
    content.classList.toggle('coread-shelf-divider', !!settings.divider);
    content.style.setProperty('--coread-shelf-side-padding', `${settings.sidePadding}px`);
    content.style.setProperty('--coread-shelf-top-steps', `${settings.topSteps}px`);
}

const COREAD_READER_DEFAULT_SETTINGS = {
    fontSize: 18,
    pageMode: 'paged',
    color: 'ivory',
    wallpaperTone: ''
};

const COREAD_READER_COLORS = {
    ivory: { label: '米白', bg: '#fff9ed', color: '#26211c' },
    paper: { label: '纸黄', bg: '#f4ecd9', color: '#2d261d' },
    green: { label: '浅绿', bg: '#edf4e8', color: '#233124' },
    gray: { label: '灰调', bg: '#eef0ee', color: '#222629' },
    dark: { label: '夜间', bg: '#1f211f', color: '#d9d2c3' }
};

function getCoReadReaderWallpaper(fallback = '') {
    try {
        const raw = localStorage.getItem(COREAD_READER_WALLPAPER_KEY);
        if (raw !== null) {
            if (raw !== coreadReaderWallpaperCacheRaw) {
                coreadReaderWallpaperCache = raw || '';
                coreadReaderWallpaperCacheRaw = raw;
            }
            return coreadReaderWallpaperCache;
        }
    } catch (_) {}
    return String(fallback || '');
}

function saveCoReadReaderWallpaper(value) {
    const text = String(value || '');
    try {
        if (text) localStorage.setItem(COREAD_READER_WALLPAPER_KEY, text);
        else localStorage.removeItem(COREAD_READER_WALLPAPER_KEY);
        coreadReaderWallpaperCache = text;
        coreadReaderWallpaperCacheRaw = text || null;
    } catch (_) {}
}

function normalizeCoReadReaderSettings(saved) {
    const source = saved && typeof saved === 'object' ? saved : {};
    const settings = { ...COREAD_READER_DEFAULT_SETTINGS, ...source };
    settings.fontSize = Math.max(15, Math.min(26, Number(settings.fontSize || COREAD_READER_DEFAULT_SETTINGS.fontSize)));
    settings.pageMode = settings.pageMode === 'scroll' ? 'scroll' : 'paged';
    settings.color = COREAD_READER_COLORS[settings.color] ? settings.color : COREAD_READER_DEFAULT_SETTINGS.color;
    settings.wallpaperTone = settings.wallpaperTone === 'light' || settings.wallpaperTone === 'dark' ? settings.wallpaperTone : '';
    settings.wallpaper = getCoReadReaderWallpaper(source.wallpaper);
    delete settings.theme;
    delete settings.customCss;
    return settings;
}

function getCoReadReaderSettings() {
    try {
        let raw = localStorage.getItem(COREAD_READER_SETTINGS_KEY) || '{}';
        if (raw !== coreadReaderSettingsCacheRaw || !coreadReaderSettingsCache) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                let shouldRewrite = false;
                let legacyWallpaper = '';
                if (parsed.wallpaper) {
                    legacyWallpaper = String(parsed.wallpaper || '');
                    delete parsed.wallpaper;
                    shouldRewrite = true;
                }
                if (Object.prototype.hasOwnProperty.call(parsed, 'theme')) {
                    delete parsed.theme;
                    shouldRewrite = true;
                }
                if (Object.prototype.hasOwnProperty.call(parsed, 'customCss')) {
                    delete parsed.customCss;
                    shouldRewrite = true;
                }
                if (shouldRewrite) {
                    raw = JSON.stringify(parsed);
                    localStorage.setItem(COREAD_READER_SETTINGS_KEY, raw);
                }
                if (legacyWallpaper) saveCoReadReaderWallpaper(legacyWallpaper);
            }
            coreadReaderSettingsCache = parsed && typeof parsed === 'object' ? parsed : {};
            coreadReaderSettingsCacheRaw = raw;
        }
        return normalizeCoReadReaderSettings(coreadReaderSettingsCache);
    } catch (_) {
        return normalizeCoReadReaderSettings({});
    }
}

function saveCoReadReaderSettings(next, options = {}) {
    const incoming = next && typeof next === 'object' ? { ...next } : {};
    if (Object.prototype.hasOwnProperty.call(incoming, 'wallpaper')) {
        saveCoReadReaderWallpaper(incoming.wallpaper);
        delete incoming.wallpaper;
    }
    delete incoming.theme;
    delete incoming.customCss;
    const current = getCoReadReaderSettings();
    const settings = normalizeCoReadReaderSettings({ ...current, ...incoming });
    const stored = { ...settings };
    delete stored.wallpaper;
    const raw = JSON.stringify(stored);
    localStorage.setItem(COREAD_READER_SETTINGS_KEY, raw);
    coreadReaderSettingsCache = stored;
    coreadReaderSettingsCacheRaw = raw;
    applyCoReadReaderSettings();
    if (options.renderSettings !== false) renderCoReadSettings();
    if (options.renderReader !== false) renderCoReadReader();
}

function getCoReadHexRgb(value, fallback = '#ffffff') {
    let text = String(value || fallback || '#ffffff').trim();
    if (/^#[0-9a-f]{3}$/i.test(text)) {
        text = `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
    }
    const match = text.match(/^#([0-9a-f]{6})$/i);
    if (!match) return getCoReadHexRgb(fallback, '#ffffff');
    const hex = match[1];
    return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
    ];
}

function getCoReadRgba(value, fallback, alpha) {
    const [r, g, b] = getCoReadHexRgb(value, fallback);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyCoReadReaderSettings() {
    const shell = document.querySelector('.coread-shell');
    if (!shell) return;
    const settings = getCoReadReaderSettings();
    const color = COREAD_READER_COLORS[settings.color] || COREAD_READER_COLORS.ivory;
    shell.dataset.coreadPageMode = settings.pageMode;
    shell.dataset.coreadColor = settings.color;
    shell.dataset.coreadWallpaperTone = settings.wallpaper ? (settings.wallpaperTone || 'dark') : '';
    shell.classList.toggle('coread-has-wallpaper', Boolean(settings.wallpaper));
    shell.classList.toggle('coread-wallpaper-light', Boolean(settings.wallpaper) && settings.wallpaperTone === 'light');
    shell.classList.toggle('coread-wallpaper-dark', Boolean(settings.wallpaper) && settings.wallpaperTone !== 'light');
    const wallpaperIsLight = Boolean(settings.wallpaper) && settings.wallpaperTone === 'light';
    const wallpaperIsDark = Boolean(settings.wallpaper) && settings.wallpaperTone !== 'light';
    const readerColor = wallpaperIsLight ? color.color : (wallpaperIsDark ? '#f3eadc' : color.color);
    shell.style.setProperty('--coread-font-size', `${settings.fontSize}px`);
    shell.style.setProperty('--coread-reader-bg', color.bg);
    shell.style.setProperty('--coread-reader-color', readerColor);
    shell.style.setProperty('--coread-reader-chrome-bg', wallpaperIsLight ? 'rgba(255,255,255,0.62)' : (wallpaperIsDark ? 'rgba(15,18,16,0.50)' : 'color-mix(in srgb, var(--coread-reader-bg) 88%, #fff 12%)'));
    shell.style.setProperty('--coread-reader-panel-bg', wallpaperIsLight ? 'rgba(255,255,255,0.56)' : (wallpaperIsDark ? 'rgba(12,15,13,0.58)' : 'color-mix(in srgb, var(--coread-reader-bg) 90%, #d6c8b4 10%)'));
    shell.style.setProperty('--coread-reader-border', wallpaperIsLight ? 'rgba(38,31,24,0.10)' : (wallpaperIsDark ? 'rgba(255,255,255,0.10)' : 'rgba(48,42,36,0.07)'));
    shell.style.setProperty('--coread-reader-paper-layer', 'linear-gradient(90deg, rgba(47,40,32,0.025) 0 1px, transparent 1px 100%)');
    shell.style.setProperty('--coread-wallpaper-scrim', wallpaperIsLight
        ? `145deg, rgba(255,255,255,0.28) 0%, ${getCoReadRgba(color.bg, '#ffffff', 0.22)} 50%, rgba(255,255,255,0.36) 100%`
        : `145deg, rgba(9,12,10,0.38) 0%, ${getCoReadRgba(color.bg, '#1f211f', 0.18)} 52%, rgba(9,12,10,0.46) 100%`);
    shell.style.setProperty('--coread-wallpaper', settings.wallpaper ? `url("${settings.wallpaper}")` : 'none');
}

function estimateCoReadWallpaperTone(canvas) {
    try {
        const ctx = canvas.getContext('2d');
        const width = Math.max(1, canvas.width || 1);
        const height = Math.max(1, canvas.height || 1);
        const sample = 24;
        const data = ctx.getImageData(0, 0, width, height).data;
        let total = 0;
        let count = 0;
        for (let y = 0; y < sample; y += 1) {
            const py = Math.min(height - 1, Math.floor((y + 0.5) * height / sample));
            for (let x = 0; x < sample; x += 1) {
                const px = Math.min(width - 1, Math.floor((x + 0.5) * width / sample));
                const index = (py * width + px) * 4;
                const alpha = (data[index + 3] || 255) / 255;
                const r = data[index] || 0;
                const g = data[index + 1] || 0;
                const b = data[index + 2] || 0;
                total += (0.2126 * r + 0.7152 * g + 0.0722 * b) * alpha;
                count += 1;
            }
        }
        return (total / Math.max(1, count)) > 150 ? 'light' : 'dark';
    } catch (_) {
        return 'dark';
    }
}

function renderCoReadSettings() {
    const fontLabel = document.getElementById('coread-font-size-label');
    const modeBox = document.getElementById('coread-page-mode-options');
    const colorBox = document.getElementById('coread-color-options');
    const settings = getCoReadReaderSettings();
    syncCoReadSettingsDrawerState();
    if (fontLabel) fontLabel.textContent = String(settings.fontSize);
    if (modeBox) {
        const modes = [
            { id: 'paged', label: '分页' },
            { id: 'scroll', label: '滚动' }
        ];
        modeBox.innerHTML = modes.map(mode => `
            <button type="button" data-coread-page-mode="${mode.id}" class="${settings.pageMode === mode.id ? 'active' : ''}" aria-pressed="${settings.pageMode === mode.id ? 'true' : 'false'}" onpointerdown="return handleCoReadPageModePointer('${mode.id}', event)" ontouchstart="return handleCoReadPageModePointer('${mode.id}', event)" onclick="return handleCoReadPageModeClick('${mode.id}', event)">${mode.label}</button>
        `).join('');
        syncCoReadPageModeControls(settings.pageMode);
    }
    if (colorBox) {
        colorBox.innerHTML = Object.entries(COREAD_READER_COLORS).map(([id, item]) => `
            <button type="button" class="${settings.color === id ? 'active' : ''}" onclick="setCoReadReaderColor('${id}')" aria-label="${musicEscapeAttr(item.label)}">
                <i style="background:${musicEscapeAttr(item.bg)}; color:${musicEscapeAttr(item.color)}"></i>
                <span>${musicEscapeHtml(item.label)}</span>
            </button>
        `).join('');
    }
}

function syncCoReadSettingsDrawerState() {
    const drawer = document.getElementById('coread-settings-drawer');
    if (!drawer) return;
    drawer.classList.toggle('open', coreadSettingsOpen);
    drawer.setAttribute('aria-hidden', coreadSettingsOpen ? 'false' : 'true');
}

function toggleCoReadSettings(open) {
    const wasTocOpen = coreadTocOpen;
    coreadSettingsOpen = typeof open === 'boolean' ? open : !coreadSettingsOpen;
    if (coreadSettingsOpen) {
        coreadTocOpen = false;
        coreadCommentPanelOpen = false;
        renderCoReadCommentPanel();
    }
    if (wasTocOpen && !coreadTocOpen) syncCoReadTocDrawerState();
    syncCoReadSettingsDrawerState();
}
window.toggleCoReadSettings = toggleCoReadSettings;

function handleCoReadSettingsPointer(open, event) {
    coreadSettingsPointerAt = Date.now();
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
    toggleCoReadSettings(open);
    return false;
}
window.handleCoReadSettingsPointer = handleCoReadSettingsPointer;

function handleCoReadSettingsClick(open, event) {
    if (Date.now() - coreadSettingsPointerAt < 600) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
        return false;
    }
    toggleCoReadSettings(open);
    return false;
}
window.handleCoReadSettingsClick = handleCoReadSettingsClick;

function handleCoReadSettingsFastEvent(event) {
    const target = event.target && event.target.closest && event.target.closest('[data-coread-settings-open]');
    if (!target || !document.getElementById('app-coread-window')?.contains(target)) return;
    const open = target.dataset.coreadSettingsOpen === 'true';
    handleCoReadSettingsPointer(open, event);
}

function bindCoReadFastSettingsControls() {
    if (coreadFastSettingsBound) return;
    coreadFastSettingsBound = true;
    document.addEventListener('pointerdown', handleCoReadSettingsFastEvent, { capture: true });
    document.addEventListener('touchstart', handleCoReadSettingsFastEvent, { capture: true, passive: false });
    document.addEventListener('mousedown', handleCoReadSettingsFastEvent, { capture: true });
}

function changeCoReadFontSize(delta) {
    const settings = getCoReadReaderSettings();
    saveCoReadReaderSettings({ fontSize: Math.max(15, Math.min(26, settings.fontSize + Number(delta || 0))) }, { renderReader: false });
}
window.changeCoReadFontSize = changeCoReadFontSize;

function syncCoReadPageModeControls(mode) {
    const targetMode = mode === 'scroll' ? 'scroll' : 'paged';
    const modeBox = document.getElementById('coread-page-mode-options');
    if (!modeBox) return;
    modeBox.dataset.coreadCurrentMode = targetMode;
    modeBox.querySelectorAll('[data-coread-page-mode]').forEach(btn => {
        const active = btn.dataset.coreadPageMode === targetMode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function commitCoReadPageMode(mode) {
    const targetMode = mode === 'scroll' ? 'scroll' : 'paged';
    syncCoReadPageModeControls(targetMode);
    const current = getCoReadReaderSettings();
    if (current.pageMode === targetMode) return false;
    const book = getCoReadBook(coreadActiveBookId);
    const body = document.getElementById('coread-reader-body');
    if (current.pageMode === 'scroll' && targetMode === 'paged' && book && body) {
        const page = getCoReadPageFromScrollPosition(body, book);
        book.page = page;
        saveCoReadBookPage(book.id, page);
    }
    if (current.pageMode === 'paged' && targetMode === 'scroll' && book) {
        coreadReaderPendingScrollPage = Number(book.page || 0);
    }
    saveCoReadReaderSettings({ pageMode: targetMode }, { renderSettings: false });
    syncCoReadPageModeControls(targetMode);
    return false;
}

function setCoReadPageMode(mode) {
    coreadPageModeCommitToken += 1;
    return commitCoReadPageMode(mode);
}
window.setCoReadPageMode = setCoReadPageMode;

function scheduleCoReadPageMode(mode) {
    const targetMode = mode === 'scroll' ? 'scroll' : 'paged';
    const token = coreadPageModeCommitToken + 1;
    coreadPageModeCommitToken = token;
    syncCoReadPageModeControls(targetMode);
    const commit = () => {
        if (token !== coreadPageModeCommitToken) return;
        commitCoReadPageMode(targetMode);
    };
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => setTimeout(commit, 0));
    } else {
        setTimeout(commit, 0);
    }
    return false;
}

function handleCoReadPageModePointer(mode, event) {
    coreadPageModePointerAt = Date.now();
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    return scheduleCoReadPageMode(mode);
}
window.handleCoReadPageModePointer = handleCoReadPageModePointer;

function handleCoReadPageModeClick(mode, event) {
    if (Date.now() - coreadPageModePointerAt < 600) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        return false;
    }
    return scheduleCoReadPageMode(mode);
}
window.handleCoReadPageModeClick = handleCoReadPageModeClick;

function setCoReadReaderColor(color) {
    saveCoReadReaderSettings({ color: COREAD_READER_COLORS[color] ? color : 'ivory' }, { renderReader: false });
}
window.setCoReadReaderColor = setCoReadReaderColor;

function uploadCoReadWallpaper(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const img = new Image();
        img.onload = () => {
            try {
                const maxSide = 1400;
                const scale = Math.min(1, maxSide / Math.max(img.width || maxSide, img.height || maxSide));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round((img.width || maxSide) * scale));
                canvas.height = Math.max(1, Math.round((img.height || maxSide) * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                saveCoReadReaderSettings({ wallpaper: canvas.toDataURL('image/jpeg', 0.82), wallpaperTone: estimateCoReadWallpaperTone(canvas) }, { renderReader: false });
            } catch (_) {
                saveCoReadReaderSettings({ wallpaper: dataUrl, wallpaperTone: 'dark' }, { renderReader: false });
            }
            input.value = '';
        };
        img.onerror = () => {
            saveCoReadReaderSettings({ wallpaper: dataUrl, wallpaperTone: 'dark' }, { renderReader: false });
            input.value = '';
        };
        img.src = dataUrl;
    };
    reader.readAsDataURL(file);
}
window.uploadCoReadWallpaper = uploadCoReadWallpaper;

function clearCoReadWallpaper() {
    saveCoReadReaderSettings({ wallpaper: '', wallpaperTone: '' }, { renderReader: false });
}
window.clearCoReadWallpaper = clearCoReadWallpaper;

function getCoReadSources() {
    try {
        const list = JSON.parse(localStorage.getItem(COREAD_SOURCE_KEY) || '[]');
        return Array.isArray(list) ? list.filter(item => item && item.bookSourceName && item.searchUrl) : [];
    } catch (_) {
        return [];
    }
}

function saveCoReadSources(list) {
    const seen = new Set();
    const normalized = (Array.isArray(list) ? list : [])
        .filter(item => item && item.bookSourceName && item.bookSourceUrl && item.searchUrl && item.ruleSearch)
        .filter(item => {
            const key = `${item.bookSourceName}|${item.bookSourceUrl}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 180);
    localStorage.setItem(COREAD_SOURCE_KEY, JSON.stringify(normalized));
}

async function loadCoReadBuiltinSources(force = false) {
    const currentVersion = localStorage.getItem(COREAD_SOURCE_VERSION_KEY) || '';
    if (!force && currentVersion === COREAD_BUILTIN_SOURCE_VERSION && getCoReadSources().length) {
        return getCoReadSources().length;
    }
    try {
        const resp = await fetch(COREAD_BUILTIN_SOURCE_URL, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const imported = normalizeCoReadSourceList(await resp.json());
        if (!imported.length) return getCoReadSources().length;
        saveCoReadSources([...imported, ...getCoReadSources()]);
        localStorage.setItem(COREAD_SOURCE_VERSION_KEY, COREAD_BUILTIN_SOURCE_VERSION);
        return getCoReadSources().length;
    } catch (e) {
        return getCoReadSources().length;
    }
}

function setCoReadSourceStatus(text) {
    const el = document.getElementById('coread-source-status');
    if (el) el.textContent = text || '';
}

function renderCoReadSourceManager() {
    const list = document.getElementById('coread-source-list');
    const sources = getCoReadSources();
    setCoReadSourceStatus(sources.length ? `已加载 ${sources.length} 个书源，搜索会优先使用书源解析` : '未加载书源');
    if (!list) return;
    list.innerHTML = sources.slice(0, 24).map((source, index) => `
        <button type="button" title="${musicEscapeAttr(source.bookSourceUrl || '')}">
            <span>${musicEscapeHtml(source.bookSourceName || `书源 ${index + 1}`)}</span>
            <em>${musicEscapeHtml(source.bookSourceGroup || source.bookSourceUrl || '')}</em>
        </button>
    `).join('') || '<div class="coread-empty">还没有书源。点击加载书源，或粘贴 Legado / 阅读 JSON 链接导入。</div>';
}

function toggleCoReadSourceManager() {
    const panel = document.getElementById('coread-source-manager');
    if (!panel) return;
    panel.classList.toggle('hidden');
    renderCoReadSourceManager();
}
window.toggleCoReadSourceManager = toggleCoReadSourceManager;

function normalizeCoReadChapterUrl(url, baseUrl = '') {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const match = raw.match(/https?:\/\/[^\s"'<>）)]+/i) || raw.match(/^[^\s"'<>）)]+/);
    const clean = match ? match[0] : raw;
    try {
        return new URL(clean, baseUrl || undefined).href;
    } catch (_) {
        return clean;
    }
}

async function coReadFetchText(url, options = {}) {
    const rawUrl = normalizeCoReadChapterUrl(url) || String(url || '').trim();
    const isHttp = /^https?:\/\//i.test(rawUrl);
    const isProxyUrl = /^https?:\/\/(?:r\.jina\.ai|corsproxy\.io|api\.allorigins\.win)\//i.test(rawUrl);
    const isZhenhun = !isProxyUrl && /zhenhunxiaoshuo\.com/i.test(rawUrl);
    const attempts = (isZhenhun
        ? [
            isHttp ? `https://r.jina.ai/${rawUrl}` : '',
            isHttp ? `https://corsproxy.io/?${encodeURIComponent(rawUrl)}` : '',
            rawUrl,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`
        ]
        : [
            isHttp ? `https://corsproxy.io/?${encodeURIComponent(rawUrl)}` : '',
            rawUrl,
            isHttp ? `https://r.jina.ai/${rawUrl}` : '',
            `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`
        ]).filter(Boolean);
    let lastError = null;
    for (const target of attempts) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Number(options.timeoutMs || 4500));
        try {
            const fetchOptions = { ...options, signal: controller.signal };
            delete fetchOptions.timeoutMs;
            delete fetchOptions.quiet;
            const resp = await fetch(target, fetchOptions);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.text();
        } catch (e) {
            lastError = e;
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError || new Error('fetch failed');
}

function coReadWithTimeout(promise, timeoutMs, fallback) {
    let timer = null;
    return Promise.race([
        promise,
        new Promise(resolve => {
            timer = setTimeout(() => resolve(fallback), timeoutMs);
        })
    ]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

function normalizeCoReadSourceList(payload) {
    const raw = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload?.sources) ? payload.sources : []));
    return raw.filter(item => item && item.bookSourceName && item.bookSourceUrl && item.searchUrl && item.ruleSearch);
}

async function importCoReadSourcesFromUrl(url) {
    const rawUrl = String(url || '').trim();
    if (!rawUrl) return 0;
    const text = await coReadFetchText(rawUrl);
    const json = JSON.parse(text.replace(/^\uFEFF/, ''));
    const imported = normalizeCoReadSourceList(json);
    const existing = getCoReadSources();
    saveCoReadSources([...existing, ...imported]);
    renderCoReadSourceManager();
    return imported.length;
}

async function loadCoReadDefaultSources() {
    setCoReadSourceStatus('正在加载内置书源...');
    let total = 0;
    let failed = 0;
    for (const url of COREAD_DEFAULT_SOURCE_URLS) {
        try {
            total += await importCoReadSourcesFromUrl(url);
        } catch (e) {
            failed += 1;
        }
    }
    renderCoReadSourceManager();
    if (total) {
        setCoReadSourceStatus(`已加载/更新 ${getCoReadSources().length} 个书源${failed ? `，${failed} 个订阅暂不可用` : ''}`);
    } else {
        setCoReadSourceStatus('默认订阅暂不可用，可以手动粘贴书源 JSON 链接');
    }
}
window.loadCoReadDefaultSources = loadCoReadDefaultSources;

async function importCoReadSourceUrl() {
    const input = document.getElementById('coread-source-url-input');
    const url = String(input && input.value || '').trim();
    if (!url) return;
    setCoReadSourceStatus('正在导入书源...');
    try {
        const count = await importCoReadSourcesFromUrl(url);
        if (input) input.value = '';
        setCoReadSourceStatus(count ? `已导入 ${count} 个书源` : '这个链接没有解析到可用书源');
    } catch (e) {
        setCoReadSourceStatus('导入失败：请确认是 Legado / 阅读 JSON 书源链接');
    }
}
window.importCoReadSourceUrl = importCoReadSourceUrl;

function getCoReadBook(bookId) {
    return getCoReadLibrary().find(book => book.id === bookId) || null;
}

function deleteCoReadBook(bookId) {
    const id = String(bookId || '');
    if (!id) return;
    const library = getCoReadLibrary();
    const book = library.find(item => item.id === id);
    if (!book) return;
    if (!confirm(`删除《${book.title || '这本书'}》？`)) return;
    const next = library.filter(item => item.id !== id);
    saveCoReadLibrary(next);
    if (coreadActiveBookId === id) {
        coreadActiveBookId = next[0] ? next[0].id : '';
    }
    renderCoReadApp();
}
window.deleteCoReadBook = deleteCoReadBook;

function normalizeCoReadCoverUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    return raw
        .replace(/^http:\/\//i, 'https://')
        .replace(/zoom=\d+/i, 'zoom=2')
        .replace(/&edge=curl/gi, '');
}

async function fetchCoReadCoverFromMetadata(title, author = '') {
    const query = [title, author].filter(Boolean).join(' ');
    if (!query.trim()) return '';
    try {
        const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${title} ${author || ''}`)}&maxResults=5`;
        const resp = await fetch(googleUrl);
        if (resp.ok) {
            const data = await resp.json();
            const items = Array.isArray(data.items) ? data.items : [];
            for (const item of items) {
                const links = item.volumeInfo && item.volumeInfo.imageLinks || {};
                const cover = normalizeCoReadCoverUrl(links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail);
                if (cover) return cover;
            }
        }
    } catch (_) {}
    try {
        const open = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author || '')}&limit=1`);
        if (open.ok) {
            const data = await open.json();
            const doc = Array.isArray(data.docs) ? data.docs[0] : null;
            if (doc && doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        }
    } catch (_) {}
    return '';
}

function buildCoReadGeneratedCoverUrl(title, author = '') {
    const shortTitle = cleanCoReadReadableText(title || '共读').replace(/\s+/g, '').slice(0, 6) || '共读';
    const shortAuthor = cleanCoReadReadableText(author || '').replace(/\s+/g, ' ').slice(0, 18);
    const seed = Array.from(`${shortTitle}${shortAuthor}`).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const palettes = [
        ['#eee4d4', '#bba58a', '#6c5945'],
        ['#e7eddc', '#9db48f', '#405f47'],
        ['#e8e2d8', '#c4a6a0', '#6a4e4a'],
        ['#e4e6df', '#9aa7aa', '#344b54'],
        ['#f0e7da', '#d3b36f', '#604d31']
    ];
    const [paper, accent, ink] = palettes[Math.abs(seed) % palettes.length];
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#fffaf0"/>
                    <stop offset="0.45" stop-color="${paper}"/>
                    <stop offset="1" stop-color="${accent}"/>
                </linearGradient>
            </defs>
            <rect width="360" height="520" rx="10" fill="url(#g)"/>
            <rect x="0" y="0" width="42" height="520" fill="${ink}" opacity="0.13"/>
            <rect x="62" y="62" width="236" height="330" rx="4" fill="#fffaf0" opacity="0.32" stroke="${ink}" stroke-opacity="0.13"/>
            <text x="180" y="210" text-anchor="middle" fill="${ink}" font-size="42" font-family="Georgia, 'Noto Serif SC', serif" font-weight="800">${musicEscapeHtml(shortTitle)}</text>
            <text x="180" y="452" text-anchor="middle" fill="${ink}" opacity="0.72" font-size="22" font-family="'Noto Serif SC', serif">${musicEscapeHtml(shortAuthor || 'BYND')}</text>
        </svg>
    `.replace(/\s{2,}/g, ' ').trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function ensureCoReadBookCover(bookId) {
    const library = getCoReadLibrary();
    const book = library.find(item => item.id === bookId);
    if (!book || book.coverUrl || book.coverResolving) return;
    book.coverResolving = true;
    saveCoReadLibrary(library);
    try {
        const cover = await fetchCoReadCoverFromMetadata(book.title, book.author);
        const latest = getCoReadLibrary();
        const target = latest.find(item => item.id === bookId);
        if (target) {
            target.coverUrl = cover || target.coverUrl || buildCoReadGeneratedCoverUrl(target.title, target.author);
            target.coverResolving = false;
            saveCoReadLibrary(latest);
        }
    } catch (_) {
        const latest = getCoReadLibrary();
        const target = latest.find(item => item.id === bookId);
        if (target) {
            target.coverUrl = target.coverUrl || buildCoReadGeneratedCoverUrl(target.title, target.author);
            target.coverResolving = false;
            saveCoReadLibrary(latest);
        }
    }
    renderCoReadDashboard();
}

function getCoReadCharName(char) {
    return (char && char.chatConfig && char.chatConfig.nickname) || (char && char.name) || '未命名';
}

function getCoReadRecentContext(char) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    return history.slice(-12).map(msg => {
        const who = msg.isMe ? '用户' : getCoReadCharName(char);
        const text = String(msg.description || msg.content || msg.dialogue || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        return text ? `${who}: ${text.slice(0, 220)}` : '';
    }).filter(Boolean).join('\n') || '暂无最近聊天。';
}

function getCoReadWorldBookText(char) {
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

function sanitizeCoReadPromptText(text) {
    return String(text || '')
        .replace(/\b(?:alpha|omega|beta)\b/gi, '角色')
        .replace(/信息素/g, '气息')
        .replace(/腺体/g, '身体反应')
        .replace(/发情|易感期|标记/g, '情绪牵引')
        .replace(/包养/g, '供养')
        .replace(/乳糖|奶糖/g, '甜味')
        .replace(/恶心/g, '不适')
        .replace(/雪藏/g, '冷处理')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function getCoReadPageText(book) {
    if (book && book.resolving) return book.resolveStatus || '正在解析正文和章节，稍等一下。';
    const content = String(book && book.content || book && book.description || '');
    if (!content) return '这本书目前只有书名和来源链接，还没有正文。';
    const page = Math.max(0, Number(book.page || 0));
    const size = COREAD_PAGE_SIZE;
    return content.slice(page * size, (page + 1) * size) || content.slice(-size);
}

function getCoReadRecentPageContextText(book) {
    if (book && book.resolving) return book.resolveStatus || '正在解析正文和章节，稍等一下。';
    const content = String(book && book.content || book && book.description || '');
    if (!content) return '这本书目前只有书名和来源链接，还没有正文。';
    const pageCount = Math.max(1, Math.ceil(content.length / COREAD_PAGE_SIZE));
    const rawPage = Number(book && book.page);
    const requestedPage = Number.isFinite(rawPage) ? Math.floor(rawPage) : 0;
    const currentPage = Math.max(0, Math.min(pageCount - 1, requestedPage));
    const startPage = Math.max(0, currentPage - COREAD_AI_CONTEXT_PREVIOUS_PAGES);
    const pieces = [];
    for (let page = startPage; page <= currentPage; page += 1) {
        const text = content.slice(page * COREAD_PAGE_SIZE, (page + 1) * COREAD_PAGE_SIZE).trim();
        if (!text) continue;
        const distance = currentPage - page;
        const label = page === currentPage ? '当前页' : (distance === 1 ? '上一页' : `前 ${distance} 页`);
        pieces.push(`【${label}】\n${text}`);
    }
    return pieces.join('\n\n') || getCoReadPageText(book);
}

function isCoReadUsefulContent(text) {
    const clean = String(text || '').replace(/\s+/g, '');
    if (clean.length < 300) return false;
    if (/^书名[:：].{0,80}作者[:：]/.test(clean)) return false;
    return true;
}

function isCoReadLikelyDirectoryContent(text) {
    const clean = String(text || '').replace(/\s+/g, ' ');
    return (clean.match(/第\s*\d+\s*章/g) || []).length >= 5;
}

function shouldResolveCoReadBookContent(book) {
    if (!book || !book.url || coreadResolvingBookIds.has(book.id)) return false;
    const contentLength = String(book.content || '').length;
    if (isCoReadUrlTitle(book.title) && Number(book.resolveMetaVersion || 0) < COREAD_META_VERSION) return true;
    if (Number(book.resolveChapterVersion || 0) < COREAD_CHAPTER_VERSION) return true;
    if (!isCoReadUsefulContent(book.content)) return true;
    if (Number(book.resolveVersion || 0) < COREAD_RESOLVE_VERSION && isCoReadLikelyDirectoryContent(book.content)) return true;
    return Number(book.resolveVersion || 0) < COREAD_RESOLVE_VERSION && contentLength < 6000;
}

function renderCoReadBookCard(book) {
    const active = book.id === coreadActiveBookId ? 'active' : '';
    const selected = coreadShelfSelectedIds.has(book.id) ? 'selected' : '';
    const source = book.source === 'search' ? '在线搜索' : (book.source || '本地');
    const status = book.resolving ? '解析中' : (isCoReadUsefulContent(book.content) ? '可阅读' : (book.resolveStatus || source));
    return `
        <div class="coread-book ${active} ${selected}">
            ${coreadShelfSelectionMode ? `<button type="button" class="coread-book-check" onclick="event.stopPropagation(); toggleCoReadShelfBookSelected('${musicEscapeAttr(book.id)}')" aria-label="选择书籍"><i class="${selected ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'}"></i></button>` : ''}
            <button type="button" class="coread-book-main" onclick="selectCoReadBook('${musicEscapeAttr(book.id)}')">
                <span>${musicEscapeHtml(book.title || '未命名书籍')}</span>
                <em>${musicEscapeHtml([book.author, status].filter(Boolean).join(' · '))}</em>
            </button>
            <button type="button" class="coread-book-delete" onclick="event.stopPropagation(); deleteCoReadBook('${musicEscapeAttr(book.id)}')" aria-label="删除书籍">
                <i class="ri-delete-bin-6-line"></i>
            </button>
        </div>
    `;
}

function renderCoReadCharOptions() {
    const chars = getCoReadCharacters();
    return chars.map(char => `
        <button type="button" class="${char.id === coreadActiveCharId ? 'active' : ''}" onclick="selectCoReadChar('${musicEscapeAttr(char.id)}')">
            <img src="${musicEscapeAttr(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
            <span>${musicEscapeHtml(getCoReadCharName(char))}</span>
        </button>
    `).join('') || '<div class="coread-empty">先导入角色卡</div>';
}

function isCoReadBookUnsorted(book) {
    if (!book) return false;
    const tags = Array.isArray(book.tags) ? book.tags.filter(Boolean) : [];
    return !String(book.categoryId || book.category || '').trim() && !tags.length;
}

function isCoReadBookPending(book) {
    if (!book) return false;
    return getCoReadBookProgress(book) <= 1 && !book.finishedAt;
}

function getCoReadShelfCategoryName(book) {
    return String(book && (book.category || book.categoryId) || '').trim();
}

function getCoReadShelfCategoryTabs(library = getCoReadLibrary()) {
    const meta = getCoReadShelfMeta();
    const names = new Set(Object.keys(meta.categories || {}));
    (Array.isArray(library) ? library : []).forEach(book => {
        const name = getCoReadShelfCategoryName(book);
        if (name) names.add(name);
    });
    return [
        ...COREAD_SHELF_CATEGORIES,
        ...Array.from(names).sort((a, b) => a.localeCompare(b, 'zh-CN')).map(name => ({ id: `cat:${name}`, label: name }))
    ];
}

function sortCoReadShelfBooks(list) {
    const mode = getCoReadShelfMeta().sortMode;
    const books = Array.isArray(list) ? [...list] : [];
    if (mode === 'title') return books.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'));
    if (mode === 'author') return books.sort((a, b) => String(a.author || '').localeCompare(String(b.author || ''), 'zh-CN'));
    if (mode === 'progress') return books.sort((a, b) => getCoReadBookProgress(b) - getCoReadBookProgress(a));
    return books.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
}

function getCoReadShelfBooks(library = getCoReadLibrary()) {
    const list = Array.isArray(library) ? library : [];
    if (coreadShelfCategory === 'unsorted') return sortCoReadShelfBooks(list.filter(isCoReadBookUnsorted));
    if (coreadShelfCategory === 'pending') return sortCoReadShelfBooks(list.filter(isCoReadBookPending));
    if (coreadShelfCategory.startsWith('cat:')) {
        const category = coreadShelfCategory.slice(4);
        return sortCoReadShelfBooks(list.filter(book => getCoReadShelfCategoryName(book) === category));
    }
    return sortCoReadShelfBooks(list);
}

function getCoReadShelfCategoryCounts(library = getCoReadLibrary()) {
    const counts = {
        all: library.length,
        unsorted: library.filter(isCoReadBookUnsorted).length,
        pending: library.filter(isCoReadBookPending).length
    };
    getCoReadShelfCategoryTabs(library).forEach(item => {
        if (item.id.startsWith('cat:')) {
            const category = item.id.slice(4);
            counts[item.id] = library.filter(book => getCoReadShelfCategoryName(book) === category).length;
        }
    });
    return counts;
}

function renderCoReadShelfTabs(library = getCoReadLibrary()) {
    const box = document.getElementById('coread-shelf-tabs');
    if (!box) return;
    const tabs = getCoReadShelfCategoryTabs(library);
    const counts = getCoReadShelfCategoryCounts(library);
    if (!tabs.some(item => item.id === coreadShelfCategory)) coreadShelfCategory = 'all';
    box.innerHTML = tabs.map(item => `
        <button type="button" class="${coreadShelfCategory === item.id ? 'active' : ''}" onclick="setCoReadShelfCategory(${musicEscapeAttr(JSON.stringify(item.id))})">
            <span>${musicEscapeHtml(item.label)}</span>
            <em>${Number(counts[item.id] || 0)}</em>
        </button>
    `).join('');
}

function setCoReadShelfCategory(category) {
    const next = String(category || 'all');
    coreadShelfCategory = getCoReadShelfCategoryTabs().some(item => item.id === next) ? next : 'all';
    renderCoReadApp();
}
window.setCoReadShelfCategory = setCoReadShelfCategory;

function setCoReadShelfStatus(text) {
    coreadShelfStatusText = String(text || '');
    const status = document.getElementById('coread-status');
    if (status && coreadActiveTab === 'shelf') status.textContent = coreadShelfStatusText || '内置书城优先，公开书目备用。';
}

function syncCoReadShelfMenuState() {
    const menu = document.getElementById('coread-shelf-menu');
    if (!menu) return;
    const open = coreadShelfMenuOpen && coreadActiveTab === 'shelf';
    menu.classList.toggle('open', open);
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function toggleCoReadShelfMenu(open) {
    coreadShelfMenuOpen = open == null ? !coreadShelfMenuOpen : !!open;
    if (!coreadShelfMenuOpen) coreadShelfToolPanel = '';
    renderCoReadShelfMenu();
    syncCoReadShelfMenuState();
}
window.toggleCoReadShelfMenu = toggleCoReadShelfMenu;

function setCoReadShelfToolPanel(panel) {
    coreadShelfToolPanel = coreadShelfToolPanel === panel ? '' : String(panel || '');
    renderCoReadShelfMenu();
}

function getCoReadShelfSelectedBooks() {
    const selected = coreadShelfSelectedIds instanceof Set ? coreadShelfSelectedIds : new Set();
    return getCoReadLibrary().filter(book => selected.has(book.id));
}

function toggleCoReadShelfSelectionMode(force) {
    coreadShelfSelectionMode = force == null ? !coreadShelfSelectionMode : !!force;
    if (!coreadShelfSelectionMode) coreadShelfSelectedIds = new Set();
    coreadShelfToolPanel = coreadShelfSelectionMode ? 'select' : '';
    renderCoReadApp();
}
window.toggleCoReadShelfSelectionMode = toggleCoReadShelfSelectionMode;

function toggleCoReadShelfBookSelected(bookId) {
    const id = String(bookId || '');
    if (!id) return;
    if (coreadShelfSelectedIds.has(id)) coreadShelfSelectedIds.delete(id);
    else coreadShelfSelectedIds.add(id);
    renderCoReadApp();
}
window.toggleCoReadShelfBookSelected = toggleCoReadShelfBookSelected;

function selectAllCurrentCoReadShelfBooks() {
    coreadShelfSelectedIds = new Set(getCoReadShelfBooks().map(book => book.id));
    renderCoReadApp();
}
window.selectAllCurrentCoReadShelfBooks = selectAllCurrentCoReadShelfBooks;

function setCoReadBookCategory(bookIds, category) {
    const ids = new Set((Array.isArray(bookIds) ? bookIds : [bookIds]).map(String).filter(Boolean));
    const name = String(category || '').trim().slice(0, 28);
    if (!ids.size) return 0;
    if (name) {
        const meta = getCoReadShelfMeta();
        meta.categories[name] = meta.categories[name] || { coverUrl: '', createdAt: Date.now() };
        saveCoReadShelfMeta(meta);
    }
    const library = getCoReadLibrary();
    let changed = 0;
    library.forEach(book => {
        if (!book || !ids.has(book.id)) return;
        book.category = name;
        book.categoryId = name;
        book.updatedAt = Date.now();
        changed++;
    });
    saveCoReadLibrary(library);
    return changed;
}

function getCoReadActiveShelfCategoryName() {
    return coreadShelfCategory.startsWith('cat:') ? coreadShelfCategory.slice(4) : '';
}

function createCoReadShelfCategory() {
    const input = document.getElementById('coread-category-name-input');
    const name = String(input?.value || '').trim().slice(0, 28);
    if (!name) {
        showCoReadShelfToast('先写分类名');
        return;
    }
    const meta = getCoReadShelfMeta();
    meta.categories[name] = meta.categories[name] || { coverUrl: '', createdAt: Date.now() };
    saveCoReadShelfMeta(meta);
    const checkedIds = Array.from(document.querySelectorAll('input[name="coread-new-category-book"]:checked'))
        .map(input => String(input.value || '').trim())
        .filter(Boolean);
    const selectedIds = checkedIds.length ? checkedIds : getCoReadShelfSelectedBooks().map(book => book.id);
    if (selectedIds.length) setCoReadBookCategory(selectedIds, name);
    coreadShelfCategory = `cat:${name}`;
    showCoReadShelfToast(selectedIds.length ? `已把 ${selectedIds.length} 本书移到「${name}」` : `已创建「${name}」`);
    renderCoReadApp();
}
window.createCoReadShelfCategory = createCoReadShelfCategory;

function dissolveCoReadShelfCategory() {
    const category = getCoReadActiveShelfCategoryName();
    const selected = getCoReadShelfSelectedBooks();
    if (!category && !selected.length) {
        showCoReadShelfToast('先进入一个分类，或先选择书籍');
        return;
    }
    const text = category ? `解散分类「${category}」？书不会删除，只会移到未整理。` : `把选中的 ${selected.length} 本书移到未整理？`;
    if (!confirm(text)) return;
    const library = getCoReadLibrary();
    let changed = 0;
    library.forEach(book => {
        const hit = category ? getCoReadShelfCategoryName(book) === category : coreadShelfSelectedIds.has(book.id);
        if (!hit) return;
        book.category = '';
        book.categoryId = '';
        book.updatedAt = Date.now();
        changed++;
    });
    const meta = getCoReadShelfMeta();
    if (category && meta.categories) delete meta.categories[category];
    saveCoReadShelfMeta(meta);
    saveCoReadLibrary(library);
    coreadShelfCategory = 'unsorted';
    coreadShelfSelectedIds = new Set();
    showCoReadShelfToast(`已整理 ${changed} 本书`);
    renderCoReadApp();
}
window.dissolveCoReadShelfCategory = dissolveCoReadShelfCategory;

function setCoReadShelfSortMode(mode) {
    saveCoReadShelfMeta({ sortMode: mode });
    renderCoReadApp();
}
window.setCoReadShelfSortMode = setCoReadShelfSortMode;

function createManualCoReadBook() {
    const title = String(document.getElementById('coread-create-title')?.value || '').trim();
    const author = String(document.getElementById('coread-create-author')?.value || '').trim();
    const content = String(document.getElementById('coread-create-content')?.value || '').trim();
    if (!title) {
        showCoReadShelfToast('先写书名');
        return;
    }
    addCoReadBook({
        title,
        author,
        content: content || `书名：${title}\n作者：${author || '未知'}\n\n这是手动创建的书籍，可以之后继续补正文。`,
        source: 'manual',
        category: getCoReadActiveShelfCategoryName()
    });
    showCoReadShelfToast(`已创建《${title}》`);
}
window.createManualCoReadBook = createManualCoReadBook;

function applyCoReadTagsToSelected() {
    const value = String(document.getElementById('coread-tags-input')?.value || '').trim();
    const tags = value.split(/[，,\s]+/).map(tag => tag.trim()).filter(Boolean).slice(0, 12);
    if (!tags.length) {
        showCoReadShelfToast('先写标签');
        return;
    }
    const ids = getCoReadShelfSelectedBooks().map(book => book.id);
    if (!ids.length && coreadActiveBookId) ids.push(coreadActiveBookId);
    const set = new Set(ids);
    const library = getCoReadLibrary();
    let changed = 0;
    library.forEach(book => {
        if (!set.has(book.id)) return;
        book.tags = tags;
        book.updatedAt = Date.now();
        changed++;
    });
    saveCoReadLibrary(library);
    showCoReadShelfToast(`已更新 ${changed} 本书的标签`);
    renderCoReadApp();
}
window.applyCoReadTagsToSelected = applyCoReadTagsToSelected;

function applyCoReadBookCoverUrl(bookId) {
    const input = document.getElementById(`coread-cover-url-${bookId}`);
    const url = normalizeCoReadCoverUrl(input?.value || '');
    if (!url) {
        showCoReadShelfToast('先粘贴封面 URL');
        return;
    }
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === bookId);
    if (!book) return;
    book.coverUrl = url;
    book.updatedAt = Date.now();
    saveCoReadLibrary(library);
    showCoReadShelfToast('封面已更新');
    renderCoReadApp();
}
window.applyCoReadBookCoverUrl = applyCoReadBookCoverUrl;

function applyCoReadCloudImportUrl() {
    const value = String(document.getElementById('coread-cloud-url-input')?.value || '').trim();
    if (!value) {
        showCoReadShelfToast('先粘贴链接');
        return;
    }
    const input = document.getElementById('coread-url-input');
    if (input) input.value = value;
    toggleCoReadShelfMenu(false);
    addCoReadUrl();
}
window.applyCoReadCloudImportUrl = applyCoReadCloudImportUrl;

function chooseCoReadShelfFiles(options = {}) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.txt,.md,.markdown,.json,.csv,.doc,.docx,.pdf,text/*';
    if (options.directory) {
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
    }
    input.onchange = () => importCoReadFiles(input.files, options);
    input.click();
}
window.chooseCoReadShelfFiles = chooseCoReadShelfFiles;

function handleCoReadShelfTool(action) {
    const id = String(action || '');
    const panels = ['select', 'newCategory', 'cover', 'settings', 'cloudImport', 'createBook', 'covers', 'tags', 'categories', 'sort', 'more'];
    if (id === 'select') {
        toggleCoReadShelfSelectionMode();
        return;
    }
    if (id === 'importLocal') {
        toggleCoReadShelfMenu(false);
        document.getElementById('coread-file-input')?.click();
        return;
    }
    if (id === 'scanFolder') {
        chooseCoReadShelfFiles({ directory: true });
        return;
    }
    if (id === 'smartImport') {
        chooseCoReadShelfFiles({ smart: true });
        return;
    }
    if (id === 'dissolve') {
        dissolveCoReadShelfCategory();
        return;
    }
    if (panels.includes(id)) {
        setCoReadShelfToolPanel(id);
        return;
    }
    showCoReadShelfToast('这个工具暂时没有可执行动作');
}
window.handleCoReadShelfTool = handleCoReadShelfTool;

function setCoReadShelfViewMode(mode) {
    saveCoReadShelfSettings({ viewMode: mode });
    applyCoReadShelfSettings();
    renderCoReadDashboard();
    renderCoReadShelfMenu();
}
window.setCoReadShelfViewMode = setCoReadShelfViewMode;

function setCoReadShelfOption(option, value) {
    const key = String(option || '');
    if (!['compact', 'cardMode', 'divider', 'sidePadding', 'topSteps'].includes(key)) return;
    saveCoReadShelfSettings({ [key]: value });
    applyCoReadShelfSettings();
    renderCoReadDashboard();
    if (key !== 'sidePadding' && key !== 'topSteps') renderCoReadShelfMenu();
}
window.setCoReadShelfOption = setCoReadShelfOption;

function applyCoReadCategoryCoverFromUrl() {
    const category = getCoReadActiveShelfCategoryName();
    const value = String(document.getElementById('coread-category-cover-url')?.value || '').trim();
    const coverUrl = normalizeCoReadCoverUrl(value);
    if (!category) {
        showCoReadShelfToast('先进入一个自定义分类');
        return;
    }
    if (!coverUrl) {
        showCoReadShelfToast('请先粘贴有效的图床 URL');
        return;
    }
    const meta = getCoReadShelfMeta();
    meta.categories[category] = { ...(meta.categories[category] || {}), coverUrl, createdAt: meta.categories[category]?.createdAt || Date.now() };
    saveCoReadShelfMeta(meta);
    showCoReadShelfToast(`已更新「${category}」封面`);
    renderCoReadShelfMenu();
}
window.applyCoReadCategoryCoverFromUrl = applyCoReadCategoryCoverFromUrl;

function uploadCoReadCategoryCover(input) {
    const file = input && input.files && input.files[0];
    const category = getCoReadActiveShelfCategoryName();
    if (!file) {
        showCoReadShelfToast('没有选择图片');
        return;
    }
    if (!category) {
        showCoReadShelfToast('先进入一个自定义分类');
        if (input) input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        const meta = getCoReadShelfMeta();
        meta.categories[category] = { ...(meta.categories[category] || {}), coverUrl: String(reader.result || ''), createdAt: meta.categories[category]?.createdAt || Date.now() };
        saveCoReadShelfMeta(meta);
        showCoReadShelfToast(`已更新「${category}」封面`);
        renderCoReadShelfMenu();
    };
    reader.readAsDataURL(file);
    if (input) input.value = '';
}
window.uploadCoReadCategoryCover = uploadCoReadCategoryCover;

function renderCoReadShelfMenu() {
    const panel = document.getElementById('coread-shelf-menu-panel');
    if (!panel) return;
    const settings = getCoReadShelfSettings();
    const meta = getCoReadShelfMeta();
    const library = getCoReadLibrary();
    const selectedBooks = getCoReadShelfSelectedBooks();
    const activeCategory = getCoReadActiveShelfCategoryName();
    const shelfBooks = getCoReadShelfBooks(library);
    const groups = COREAD_SHELF_TOOL_GROUPS.map(group => `
        <div class="coread-shelf-tool-group">
            ${group.map(item => `
                <button type="button" class="${coreadShelfToolPanel === item.id || (item.id === 'select' && coreadShelfSelectionMode) ? 'active' : ''}" onclick="handleCoReadShelfTool('${item.id}')">
                    <i class="${item.icon}"></i><span>${musicEscapeHtml(item.label)}</span>${item.arrow ? '<b><i class="ri-arrow-right-s-line"></i></b>' : ''}
                </button>
            `).join('')}
        </div>
    `).join('');
    const selectPanel = coreadShelfToolPanel === 'select' ? `
        <div class="coread-shelf-subpanel">
            <strong>已选择 ${selectedBooks.length} 本</strong>
            <div class="coread-shelf-cover-actions">
                <button type="button" onclick="toggleCoReadShelfSelectionMode(false)"><i class="ri-check-line"></i><span>完成选择</span></button>
                <button type="button" onclick="selectAllCurrentCoReadShelfBooks()"><i class="ri-checkbox-multiple-fill"></i><span>全选当前</span></button>
            </div>
            <label class="coread-shelf-url-field">
                <span>移到</span>
                <input id="coread-move-category-input" type="text" placeholder="分类名" value="${musicEscapeAttr(activeCategory)}">
                <button type="button" onclick="setCoReadBookCategory(getCoReadShelfSelectedBooks().map(book => book.id), document.getElementById('coread-move-category-input')?.value); showCoReadShelfToast('已移动选中书籍'); renderCoReadApp();">保存</button>
            </label>
        </div>
    ` : '';
    const newCategoryPanel = coreadShelfToolPanel === 'newCategory' ? `
        <div class="coread-shelf-subpanel">
            <strong>新建子分类</strong>
            <label class="coread-shelf-url-field">
                <span>名称</span>
                <input id="coread-category-name-input" type="text" maxlength="28" placeholder="例如：待追 / 古风 / 同人">
                <button type="button" onclick="createCoReadShelfCategory()">创建</button>
            </label>
            <div class="coread-new-category-picker">
                <em>选择要放进分类的书</em>
                ${(library.length ? library.slice(0, 24).map(book => {
                    const checked = coreadShelfSelectedIds.has(book.id) ? 'checked' : '';
                    return `
                        <label>
                            <input type="checkbox" name="coread-new-category-book" value="${musicEscapeAttr(book.id)}" ${checked}>
                            <span>${musicEscapeHtml(book.title || '未命名书籍')}</span>
                        </label>
                    `;
                }).join('') : '<small>书架还没有书，可以先创建空分类。</small>')}
            </div>
        </div>
    ` : '';
    const coverPanel = coreadShelfToolPanel === 'cover' ? `
        <div class="coread-shelf-subpanel">
            <strong>分类封面${activeCategory ? ` · ${musicEscapeHtml(activeCategory)}` : ''}</strong>
            ${activeCategory && meta.categories?.[activeCategory]?.coverUrl ? `<div class="coread-shelf-cover-preview"><img src="${musicEscapeAttr(meta.categories[activeCategory].coverUrl)}" onerror="this.remove()"></div>` : '<small>先进入自定义分类，再设置这个分类的封面。</small>'}
            <div class="coread-shelf-cover-actions">
                <button type="button" onclick="document.getElementById('coread-category-cover-input')?.click()"><i class="ri-upload-cloud-2-line"></i><span>上传图片</span></button>
                <input id="coread-category-cover-input" type="file" accept="image/*" onchange="uploadCoReadCategoryCover(this)" hidden>
            </div>
            <label class="coread-shelf-url-field">
                <span>图床 URL</span>
                <input id="coread-category-cover-url" type="url" placeholder="https://..." onkeydown="if(event.key==='Enter') applyCoReadCategoryCoverFromUrl()">
                <button type="button" onclick="applyCoReadCategoryCoverFromUrl()">应用</button>
            </label>
        </div>
    ` : '';
    const cloudPanel = coreadShelfToolPanel === 'cloudImport' ? `
        <div class="coread-shelf-subpanel">
            <strong>百度网盘导入</strong>
            <label class="coread-shelf-url-field">
                <span>链接</span>
                <input id="coread-cloud-url-input" type="url" placeholder="粘贴百度网盘分享链接" onkeydown="if(event.key==='Enter') applyCoReadCloudImportUrl()">
                <button type="button" onclick="applyCoReadCloudImportUrl()">导入</button>
            </label>
        </div>
    ` : '';
    const createBookPanel = coreadShelfToolPanel === 'createBook' ? `
        <div class="coread-shelf-subpanel coread-shelf-form-panel">
            <strong>创建书籍</strong>
            <input id="coread-create-title" type="text" placeholder="书名">
            <input id="coread-create-author" type="text" placeholder="作者，可不填">
            <textarea id="coread-create-content" placeholder="正文或简介，可之后再补"></textarea>
            <button type="button" onclick="createManualCoReadBook()">创建</button>
        </div>
    ` : '';
    const coversPanel = coreadShelfToolPanel === 'covers' ? `
        <div class="coread-shelf-subpanel">
            <strong>封面图集</strong>
            ${shelfBooks.slice(0, 6).map(book => `
                <label class="coread-shelf-url-field">
                    <span>${musicEscapeHtml(String(book.title || '书').slice(0, 4))}</span>
                    <input id="coread-cover-url-${musicEscapeAttr(book.id)}" type="url" placeholder="封面 URL" value="${musicEscapeAttr(book.coverUrl || '')}">
                    <button type="button" onclick="applyCoReadBookCoverUrl('${musicEscapeAttr(book.id)}')">保存</button>
                </label>
            `).join('') || '<small>当前分类没有书。</small>'}
        </div>
    ` : '';
    const tagsPanel = coreadShelfToolPanel === 'tags' ? `
        <div class="coread-shelf-subpanel">
            <strong>标签管理</strong>
            <small>${selectedBooks.length ? `会更新已选 ${selectedBooks.length} 本书。` : '未选择书籍时，会更新当前正在阅读的书。'}</small>
            <label class="coread-shelf-url-field">
                <span>标签</span>
                <input id="coread-tags-input" type="text" placeholder="甜文, 古风, 待补">
                <button type="button" onclick="applyCoReadTagsToSelected()">保存</button>
            </label>
        </div>
    ` : '';
    const categoriesPanel = coreadShelfToolPanel === 'categories' ? `
        <div class="coread-shelf-subpanel">
            <strong>分类管理</strong>
            ${getCoReadShelfCategoryTabs(library).filter(item => item.id.startsWith('cat:')).map(item => `
                <button type="button" class="${coreadShelfCategory === item.id ? 'active' : ''}" onclick="setCoReadShelfCategory(${musicEscapeAttr(JSON.stringify(item.id))})">${musicEscapeHtml(item.label)} · ${Number(getCoReadShelfCategoryCounts(library)[item.id] || 0)}</button>
            `).join('') || '<small>还没有自定义分类。</small>'}
        </div>
    ` : '';
    const settingsPanel = coreadShelfToolPanel === 'settings' ? `
        <div class="coread-shelf-subpanel">
            <strong>书架设置</strong>
            <div class="coread-shelf-view-row">
                ${[
                    ['grid', '网格'],
                    ['waterfall', '流式'],
                    ['list', '列表']
                ].map(([id, label]) => `<button type="button" class="${settings.viewMode === id ? 'active' : ''}" onclick="setCoReadShelfViewMode('${id}')">${label}</button>`).join('')}
            </div>
            <label><input type="checkbox" ${settings.cardMode ? 'checked' : ''} onchange="setCoReadShelfOption('cardMode', this.checked)"><span>卡片模式</span></label>
            <label><input type="checkbox" ${settings.compact ? 'checked' : ''} onchange="setCoReadShelfOption('compact', this.checked)"><span>紧凑模式</span></label>
            <label><input type="checkbox" ${settings.divider ? 'checked' : ''} onchange="setCoReadShelfOption('divider', this.checked)"><span>显示分割线</span></label>
            <label class="range"><span>左右间距</span><input type="range" min="8" max="28" value="${settings.sidePadding}" oninput="setCoReadShelfOption('sidePadding', this.value)"></label>
            <label class="range"><span>顶部书架台阶</span><input type="range" min="0" max="72" value="${settings.topSteps}" oninput="setCoReadShelfOption('topSteps', this.value)"></label>
        </div>
    ` : '';
    const sortPanel = coreadShelfToolPanel === 'sort' ? `
        <div class="coread-shelf-subpanel">
            <strong>书籍排序</strong>
            <div class="coread-shelf-view-row">
                ${[
                    ['recent', '最近'],
                    ['title', '书名'],
                    ['author', '作者'],
                    ['progress', '进度']
                ].map(([id, label]) => `<button type="button" class="${meta.sortMode === id ? 'active' : ''}" onclick="setCoReadShelfSortMode('${id}')">${label}</button>`).join('')}
            </div>
        </div>
    ` : '';
    const morePanel = coreadShelfToolPanel === 'more' ? `
        <div class="coread-shelf-subpanel coread-shelf-more-panel">
            <strong>更多</strong>
            <button type="button" onclick="setCoReadShelfToolPanel('newCategory')"><i class="ri-folder-add-line"></i><span>新建子分类</span></button>
            <button type="button" onclick="setCoReadShelfToolPanel('cover')"><i class="ri-image-add-line"></i><span>分类封面</span></button>
            <button type="button" onclick="dissolveCoReadShelfCategory()"><i class="ri-folder-reduce-line"></i><span>解散分类</span></button>
            <button type="button" onclick="setCoReadShelfToolPanel('cloudImport')"><i class="ri-cloud-line"></i><span>百度网盘导入</span></button>
            <button type="button" onclick="setCoReadShelfToolPanel('covers')"><i class="ri-gallery-line"></i><span>封面图集</span></button>
        </div>
    ` : '';
    panel.innerHTML = `
        ${groups}
        ${selectPanel}
        ${newCategoryPanel}
        ${coverPanel}
        ${cloudPanel}
        ${createBookPanel}
        ${coversPanel}
        ${tagsPanel}
        ${categoriesPanel}
        ${settingsPanel}
        ${sortPanel}
        ${morePanel}
    `;
}

function getCoReadCharacterById(charId) {
    return getCoReadCharacters().find(char => char && char.id === charId) || null;
}

function getCoReadThoughts(limit = 120) {
    return getCoReadLibrary()
        .flatMap(book => Array.isArray(book.thoughts)
            ? book.thoughts.map(item => {
                const char = getCoReadCharacterById(item.charId);
                return {
                    ...item,
                    bookId: book.id,
                    bookTitle: book.title || '未命名书籍',
                    bookAuthor: book.author || '',
                    charName: item.charName || getCoReadCharName(char) || 'char',
                    charAvatar: item.charAvatar || (char && char.avatar) || DEFAULT_AVATAR,
                    replies: Array.isArray(item.replies) ? item.replies : []
                };
            })
            : [])
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, Math.max(1, Number(limit || 120)));
}

function getCoReadThoughtStatsForChar(charId) {
    const thoughts = getCoReadThoughts(600).filter(item => item.charId === charId);
    const books = new Set(thoughts.map(item => item.bookId || item.bookTitle).filter(Boolean));
    return { thoughtCount: thoughts.length, bookCount: books.size };
}

function getCoReadCategoryShelfGroups(library = getCoReadLibrary()) {
    const meta = getCoReadShelfMeta();
    const groups = new Map();
    Object.keys(meta.categories || {}).forEach(name => {
        groups.set(name, {
            name,
            coverUrl: meta.categories[name]?.coverUrl || '',
            books: []
        });
    });
    (Array.isArray(library) ? library : []).forEach(book => {
        const name = getCoReadShelfCategoryName(book);
        if (!name) return;
        if (!groups.has(name)) groups.set(name, { name, coverUrl: '', books: [] });
        groups.get(name).books.push(book);
    });
    return Array.from(groups.values())
        .filter(group => group.name)
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'));
}

function renderCoReadCategoryShelves(library = getCoReadLibrary()) {
    const groups = getCoReadCategoryShelfGroups(library);
    if (!groups.length || coreadShelfCategory !== 'all') return '';
    return `
        <section class="coread-category-shelves" aria-label="分类书架">
            <div class="coread-category-shelves-head">
                <strong>分类书架</strong>
                <span>点击展开</span>
            </div>
            <div class="coread-category-shelf-rail">
                ${groups.map(group => {
                    const books = group.books.slice(0, 7);
                    return `
                        <button type="button" class="coread-category-stack" onclick="setCoReadShelfCategory(${musicEscapeAttr(JSON.stringify(`cat:${group.name}`))})">
                            <div class="coread-category-stack-books">
                                ${books.slice(0, 5).map((book, index) => `
                                    <span class="coread-category-mini-book b${index + 1}">
                                        ${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<em>${musicEscapeHtml(String(book.title || group.name).slice(0, 1))}</em>`}
                                    </span>
                                `).join('') || '<span class="coread-category-mini-book b1"><em>空</em></span>'}
                            </div>
                            <i></i>
                            <strong>${musicEscapeHtml(group.name)}</strong>
                            <small>${group.books.length} 本</small>
                        </button>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function getCoReadBookTags(book) {
    const tags = [];
    const push = value => {
        const text = String(value || '').trim();
        if (text && !tags.includes(text)) tags.push(text.slice(0, 12));
    };
    (Array.isArray(book && book.tags) ? book.tags : []).forEach(push);
    push(book && (book.category || book.categoryId));
    push(book && book.sourceData && book.sourceData.kind);
    if (book && book.source) push(book.source === 'search' ? '在线' : book.source);
    return tags.slice(0, 5);
}

function getCoReadBookIntro(book, limit = 92) {
    const source = String(book && (book.description || book.content || '') || '')
        .replace(/\s+/g, ' ')
        .replace(/^书名[:：][^。！？\n]{0,120}/, '')
        .trim();
    if (!source) return '这本书还没有简介。';
    return source.slice(0, limit);
}

function renderCoReadShelfRail(library = getCoReadLibrary()) {
    const books = (Array.isArray(library) ? library : []).slice(0, 18);
    if (!books.length) return '';
    return `
        <section class="coread-total-shelf" aria-label="总书架">
            <div class="coread-total-shelf-rail">
                ${books.map((book, index) => `
                    <button type="button" class="coread-total-book b${index % 5}" onclick="openCoReadBookDetail('${musicEscapeAttr(book.id)}')" aria-label="${musicEscapeAttr(book.title || '未命名书籍')}">
                        ${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${musicEscapeHtml(String(book.title || '书').slice(0, 1))}</span>`}
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function getCurrentCoReadThought() {
    const book = getCoReadBook(coreadActiveBookId);
    if (!book || !Array.isArray(book.thoughts)) return null;
    const charId = coreadActiveCharId || '';
    const page = Math.max(0, Number(book.page || 0));
    const item = book.thoughts.find(thought => thought
        && (!charId || thought.charId === charId)
        && Math.max(0, Number(thought.page || 0)) === page);
    if (!item) return null;
    const char = getCoReadCharacterById(item.charId);
    return {
        ...item,
        bookId: book.id,
        bookTitle: book.title || '未命名书籍',
        charName: item.charName || getCoReadCharName(char) || 'char',
        charAvatar: item.charAvatar || (char && char.avatar) || DEFAULT_AVATAR,
        replies: Array.isArray(item.replies) ? item.replies : []
    };
}

function saveCoReadThoughtMutation(bookId, thoughtId, mutator) {
    const library = getCoReadLibrary();
    const record = library.find(book => book && book.id === bookId);
    if (!record) return null;
    record.thoughts = Array.isArray(record.thoughts) ? record.thoughts : [];
    const thought = record.thoughts.find(item => item && item.id === thoughtId);
    if (!thought) return null;
    mutator(thought, record);
    saveCoReadLibrary(library);
    return thought;
}

function createCoReadThoughtRecord(book, char, text) {
    const library = getCoReadLibrary();
    const record = library.find(item => item.id === book.id);
    if (!record) return null;
    record.thoughts = Array.isArray(record.thoughts) ? record.thoughts : [];
    const thought = {
        id: `thought_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        charId: char.id,
        charName: getCoReadCharName(char),
        charAvatar: char.avatar || DEFAULT_AVATAR,
        text,
        page: Number(record.page || 0),
        pageText: getCoReadRecentPageContextText(record),
        replies: [],
        createdAt: Date.now()
    };
    record.thoughts.unshift(thought);
    record.thoughts = record.thoughts.slice(0, 120);
    saveCoReadLibrary(library);
    return { ...thought, bookId: record.id, bookTitle: record.title || '未命名书籍' };
}

function getCoReadRecentDiscussionContext(charId, currentBookId = '') {
    const rows = getCoReadThoughts(80)
        .filter(item => item.charId === charId)
        .slice(0, 6)
        .map(item => {
            const replies = (Array.isArray(item.replies) ? item.replies : [])
                .slice(-4)
                .map(reply => `${reply.role === 'user' ? '用户' : item.charName || 'char'}：${String(reply.text || '').slice(0, 160)}`)
                .join('\n');
            return [
                `《${item.bookTitle || '共读'}》${item.bookId === currentBookId ? '（当前书）' : ''}`,
                `${item.charName || 'char'}：${String(item.text || '').slice(0, 260)}`,
                replies
            ].filter(Boolean).join('\n');
        });
    return rows.join('\n\n') || '暂无共读对话。';
}

function buildCoReadCommentMessages(char, book, extra = {}) {
    const userProfile = typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : (typeof getUserProfile === 'function' ? getUserProfile() : {});
    const identity = typeof buildWechatIdentityContextPrompt === 'function' ? buildWechatIdentityContextPrompt(char, userProfile) : '';
    const safeRetry = !!extra.safeRetry;
    const rawWorldBook = getCoReadWorldBookText(char);
    const worldBook = safeRetry ? sanitizeCoReadPromptText(rawWorldBook).slice(0, 1600) : rawWorldBook;
    const memory = safeRetry ? '' : (typeof buildWechatMemoryPrompt === 'function' ? buildWechatMemoryPrompt(char) : '');
    const persona = String(char.description || '').slice(0, safeRetry ? 2200 : 4200);
    const rawPageText = extra.pageText || getCoReadRecentPageContextText(book);
    const pageText = safeRetry ? sanitizeCoReadPromptText(rawPageText).slice(0, 1100) : rawPageText;
    const instruction = extra.replyText
        ? '用户刚回复了你的共读言论。请仍然按角色身份接话，像聊天一样回复用户，短一点，有态度，优先回应当前页，必要时参考上一页的承接。'
        : '请用角色会对用户说出口的语气，写 1-3 段短评论。可以感悟、吐槽、代入剧情，但必须优先贴着当前页说，必要时参考上一页的承接。不要复述整段原文。';
    return [
        {
            role: 'system',
            content: '你是 BYND 共读小说功能里的角色即时共读伙伴。必须让角色按自己的人设、世界书、当前关系、最近聊天和共读记录发言。输出必须是可直接显示在气泡里的中文自然语言，禁止空内容，禁止 JSON，禁止系统口吻，禁止通用书评，禁止替用户总结。'
        },
        {
            role: 'user',
            content: [
                identity,
                persona ? `【角色卡/人设】\n${persona}` : '',
                worldBook ? `【世界书】\n${worldBook}` : '',
                memory ? `【角色记忆】\n${memory}` : '',
                `【最近聊天】\n${getCoReadRecentContext(char)}`,
                `【最近共读对话】\n${getCoReadRecentDiscussionContext(char.id, book.id)}`,
                `【正在共读的书】\n标题：${book.title}\n作者：${book.author || '未知'}\n来源：${book.url || book.source || '本地'}`,
                safeRetry
                    ? `【最近页文本（上一页 + 当前页，已安全转述，仍来自用户正在读的附近页）】\n${pageText}`
                    : `【最近页文本（上一页 + 当前页）】\n${pageText}`,
                extra.threadText ? `【本条共读对话】\n${extra.threadText}` : '',
                extra.replyText ? `【用户刚刚回复】\n${extra.replyText}` : '',
                extra.retryForEmpty ? '【重要】上一次返回为空。现在必须补写一条能直接显示的角色发言，至少 18 个中文字符，贴着当前页文本和用户关系说。' : '',
                safeRetry ? '【安全生成要求】只评论人物关系、情绪张力和角色心态，不扩写露骨内容，不输出敏感词，不输出空白。' : '',
                instruction
            ].filter(Boolean).join('\n\n')
        }
    ];
}

function normalizeCoReadAiCommentText(value) {
    let source = value;
    if (source && typeof source === 'object') {
        source = source.content || source.text || source.message || source.response || source.answer || '';
    }
    let text = String(source || '')
        .replace(/^```(?:json|text|markdown)?/i, '')
        .replace(/```$/i, '')
        .replace(/^\s*(?:角色发言|评论|旁注|回复)\s*[：:]\s*/i, '')
        .trim();
    if (/^[{[]/.test(text)) {
        try {
            const parsed = JSON.parse(text);
            const candidate = parsed && (parsed.content || parsed.text || parsed.message || parsed.response || parsed.answer || parsed.reply || parsed.comment);
            if (candidate) text = String(candidate).trim();
        } catch (_) {}
    }
    if (!text || text.length < 2) return '';
    if (/^(?:null|undefined|none|无|空|没有|AI 返回了空内容)$/i.test(text)) return '';
    return text;
}

async function requestCoReadAiComment(char, book, extra = {}, options = {}) {
    const minTokens = extra && extra.replyText ? COREAD_AI_REPLY_MAX_TOKENS : COREAD_AI_COMMENT_MAX_TOKENS;
    const requestedTokens = Number(options.max_tokens);
    const apiOptions = {
        max_tokens: Math.max(minTokens, Number.isFinite(requestedTokens) ? requestedTokens : 0),
        temperature: options.temperature ?? 0.84
    };
    const first = await callChatApi(buildCoReadCommentMessages(char, book, extra), apiOptions);
    const firstText = normalizeCoReadAiCommentText(first && first.ok ? first.content : '');
    if (firstText) return { ok: true, text: firstText };
    if (first && (first.ok || /空内容|empty/i.test(String(first.error || '')))) {
        const retry = await callChatApi(
            buildCoReadCommentMessages(char, book, { ...extra, retryForEmpty: true }),
            { ...apiOptions, temperature: Math.max(0.72, Number(apiOptions.temperature || 0.84) - 0.08), max_tokens: Math.max(minTokens, Number(apiOptions.max_tokens || minTokens)) }
        );
        const retryText = normalizeCoReadAiCommentText(retry && retry.ok ? retry.content : '');
        if (retryText) return { ok: true, text: retryText };
        const safeRetry = await callChatApi(
            buildCoReadCommentMessages(char, book, { ...extra, retryForEmpty: true, safeRetry: true }),
            { ...apiOptions, temperature: 0.72, max_tokens: Math.max(minTokens, Number(apiOptions.max_tokens || minTokens)) }
        );
        const safeText = normalizeCoReadAiCommentText(safeRetry && safeRetry.ok ? safeRetry.content : '');
        if (safeText) return { ok: true, text: safeText };
        return { ok: false, error: (safeRetry && safeRetry.error) || (retry && retry.error) || 'AI 返回了空内容' };
    }
    return { ok: false, error: (first && first.error) || 'AI 没有回应' };
}

function groupCoReadThoughtsByCharAndBook(thoughts) {
    const groups = [];
    const byChar = new Map();
    thoughts.forEach(item => {
        const charKey = item.charId || item.charName || 'char';
        if (!byChar.has(charKey)) {
            const group = {
                charId: item.charId || '',
                charName: item.charName || 'char',
                charAvatar: item.charAvatar || DEFAULT_AVATAR,
                count: 0,
                books: new Map()
            };
            byChar.set(charKey, group);
            groups.push(group);
        }
        const group = byChar.get(charKey);
        group.count += 1;
        const bookKey = item.bookId || item.bookTitle || 'book';
        if (!group.books.has(bookKey)) {
            group.books.set(bookKey, {
                bookId: item.bookId || '',
                bookTitle: item.bookTitle || '未命名书籍',
                bookAuthor: item.bookAuthor || '',
                items: []
            });
        }
        group.books.get(bookKey).items.push(item);
    });
    return groups;
}

function renderCoReadThoughts() {
    const list = document.getElementById('coread-thought-list');
    if (!list) return;
    const groups = groupCoReadThoughtsByCharAndBook(getCoReadThoughts(240));
    list.innerHTML = groups.map(group => `
        <article class="coread-thought-group">
            <header>
                <img src="${musicEscapeAttr(group.charAvatar || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                <div>
                    <strong>${musicEscapeHtml(group.charName || 'char')}</strong>
                    <span>一起读过 ${group.books.size} 本书 · ${group.count} 条言论</span>
                </div>
            </header>
            ${Array.from(group.books.values()).map(bookGroup => `
                <section class="coread-thought-book">
                    <h4>
                        <span>${musicEscapeHtml(bookGroup.bookTitle || '未命名书籍')}</span>
                        <em>${bookGroup.items.length} 条</em>
                    </h4>
                    ${bookGroup.items.map(item => {
                        const replies = Array.isArray(item.replies) ? item.replies : [];
                        const userReplyCount = replies.filter(reply => reply.role === 'user').length;
                        return `
                            <div class="coread-thought-card">
                                <p>${musicEscapeHtml(item.text || '')}</p>
                                <em>第 ${Math.max(1, Number(item.page || 0) + 1)} 页${userReplyCount ? ` · 你回复 ${userReplyCount} 条` : ''}</em>
                            </div>
                        `;
                    }).join('')}
                </section>
            `).join('')}
        </article>
    `).join('') || `
        <div class="coread-empty coread-thought-empty">
            还没有共读想法。进入书架，选一本书和一个 char，让 char 写第一条旁注。
        </div>
    `;
}

function renderCoReadMePanel() {
    const list = document.getElementById('coread-me-char-list');
    if (!list) return;
    const chars = getCoReadCharacters();
    const selectedChar = chars.find(char => char.id === coreadActiveCharId) || chars[0] || null;
    const selectedStats = selectedChar ? getCoReadThoughtStatsForChar(selectedChar.id) : { bookCount: 0, thoughtCount: 0 };
    list.innerHTML = chars.length ? `
        <div class="coread-mate-dropdown ${coreadMateDropdownOpen ? 'open' : ''}">
            <button type="button" class="coread-mate-trigger" onclick="toggleCoReadMateDropdown()">
                <img src="${musicEscapeAttr((selectedChar && selectedChar.avatar) || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                <span>
                    <b>选择共读对象</b>
                    <strong>${musicEscapeHtml(selectedChar ? getCoReadCharName(selectedChar) : '未选择')}</strong>
                    <em>一起读过 ${selectedStats.bookCount} 本 · ${selectedStats.thoughtCount} 条旁注</em>
                </span>
                <small>${chars.length} 个角色</small>
                <i class="ri-arrow-down-s-line" aria-hidden="true"></i>
            </button>
            <div class="coread-mate-list">
            ${chars.map(char => {
        const active = selectedChar && char.id === selectedChar.id ? 'active' : '';
        const stats = getCoReadThoughtStatsForChar(char.id);
        return `
            <button type="button" class="${active}" onclick="selectCoReadChar('${musicEscapeAttr(char.id)}')">
                <img src="${musicEscapeAttr(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                <span>
                    <strong>${musicEscapeHtml(getCoReadCharName(char))}</strong>
                    <em>一起读过 ${stats.bookCount} 本 · ${stats.thoughtCount} 条旁注</em>
                </span>
                <small>${active ? '已选择' : '选择'}</small>
            </button>
        `;
    }).join('')}
            </div>
        </div>
    ` : '<div class="coread-empty">先导入角色卡</div>';
}

function toggleCoReadMateDropdown(open) {
    coreadMateDropdownOpen = typeof open === 'boolean' ? open : !coreadMateDropdownOpen;
    renderCoReadMePanel();
}
window.toggleCoReadMateDropdown = toggleCoReadMateDropdown;

function toggleCoReadCommentPanel(open) {
    coreadCommentPanelOpen = typeof open === 'boolean' ? open : !coreadCommentPanelOpen;
    if (coreadCommentPanelOpen) {
        syncCoReadPageFromScrollPosition();
        coreadTocOpen = false;
        coreadSettingsOpen = false;
        syncCoReadTocDrawerState();
        syncCoReadSettingsDrawerState();
    }
    renderCoReadCommentPanel();
}
window.toggleCoReadCommentPanel = toggleCoReadCommentPanel;

function syncCoReadPageFromScrollPosition() {
    const settings = getCoReadReaderSettings();
    if (settings.pageMode !== 'scroll' || coreadActiveTab !== 'reader') return;
    const book = getCoReadBook(coreadActiveBookId);
    const body = document.getElementById('coread-reader-body');
    if (!book || !body) return;
    const page = getCoReadPageFromScrollPosition(body, book);
    if (page !== Number(book.page || 0)) {
        book.page = page;
        saveCoReadBookPage(book.id, page);
    }
}

function openCoReadCommentPanel() {
    toggleCoReadCommentPanel(true);
    const thought = getCurrentCoReadThought();
    if (thought && coreadCommentStatusText) {
        coreadCommentStatusText = '';
        renderCoReadCommentPanel();
    }
    if (!thought && !coreadBusy) askCoReadComment();
}
window.openCoReadCommentPanel = openCoReadCommentPanel;

function buildCoReadThreadText(thought) {
    if (!thought) return '';
    const rows = [`${thought.charName || 'char'}：${thought.text || ''}`];
    (Array.isArray(thought.replies) ? thought.replies : []).forEach(reply => {
        rows.push(`${reply.role === 'user' ? '用户' : thought.charName || 'char'}：${reply.text || ''}`);
    });
    return rows.join('\n').slice(0, 1800);
}

function renderCoReadCommentPanel() {
    const panel = document.getElementById('coread-comment-popover');
    if (!panel) return;
    const book = getCoReadBook(coreadActiveBookId);
    const char = getCoReadCharacters().find(item => item.id === coreadActiveCharId);
    const thought = getCurrentCoReadThought();
    panel.classList.toggle('open', !!coreadCommentPanelOpen);
    panel.setAttribute('aria-hidden', coreadCommentPanelOpen ? 'false' : 'true');
    if (!coreadCommentPanelOpen) {
        panel.innerHTML = '';
        return;
    }
    const charName = char ? getCoReadCharName(char) : (thought && thought.charName) || 'char';
    const avatar = (char && char.avatar) || (thought && thought.charAvatar) || DEFAULT_AVATAR;
    const replies = thought && Array.isArray(thought.replies) ? thought.replies : [];
    const missing = !book || !char;
    const body = missing
        ? '先选择一本书和一个 char，再让 char 读这一段。'
        : coreadCommentStatusText
            ? coreadCommentStatusText
            : coreadBusy && !thought
                ? '正在读这一段...'
            : thought && thought.text
                ? thought.text
                : '还没有当前页言论，点“让 char 读”生成。';
    panel.innerHTML = `
        <section class="coread-comment-bubble">
            <header>
                <img src="${musicEscapeAttr(avatar)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                <div>
                    <span>${musicEscapeHtml(book ? (book.title || '共读') : '共读')}</span>
                    <strong>${musicEscapeHtml(charName)}</strong>
                </div>
                <button type="button" onclick="toggleCoReadCommentPanel(false)" aria-label="关闭"><i class="ri-close-line"></i></button>
            </header>
            <div class="coread-comment-body ${coreadBusy ? 'thinking' : ''}">
                <p>${musicEscapeHtml(body)}</p>
            </div>
            ${replies.length ? `
                <div class="coread-comment-thread">
                    ${replies.slice(-8).map(reply => `
                        <div class="${reply.role === 'user' ? 'user' : 'char'}">
                            <span>${reply.role === 'user' ? '你' : musicEscapeHtml(charName)}</span>
                            <p>${musicEscapeHtml(reply.text || '')}</p>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <div class="coread-comment-actions">
                <button type="button" onclick="askCoReadComment()" ${missing || coreadBusy ? 'disabled' : ''}><i class="ri-sparkling-2-line"></i><span>${thought ? '重读这段' : '让 char 读'}</span></button>
            </div>
            <label class="coread-comment-reply">
                <textarea id="coread-comment-reply-input" rows="2" placeholder="回复 ${musicEscapeAttr(charName)}..." ${!thought || coreadBusy ? 'disabled' : ''}></textarea>
                <button type="button" onclick="sendCoReadCommentReply()" ${!thought || coreadBusy ? 'disabled' : ''} aria-label="发送回复"><i class="ri-send-plane-2-fill"></i></button>
            </label>
        </section>
    `;
}

async function sendCoReadCommentReply() {
    const book = getCoReadBook(coreadActiveBookId);
    const char = getCoReadCharacters().find(item => item.id === coreadActiveCharId);
    const thought = getCurrentCoReadThought();
    const input = document.getElementById('coread-comment-reply-input');
    const replyText = String(input && input.value || '').trim();
    if (!book || !char || !thought || !replyText || coreadBusy) return;
    coreadCommentStatusText = '';
    if (input) input.value = '';
    saveCoReadThoughtMutation(book.id, thought.id, item => {
        item.replies = Array.isArray(item.replies) ? item.replies : [];
        item.replies.push({ role: 'user', text: replyText, createdAt: Date.now() });
        item.updatedAt = Date.now();
    });
    coreadBusy = true;
    renderCoReadCommentPanel();
    try {
        const latest = getCurrentCoReadThought();
        const result = await requestCoReadAiComment(char, book, {
            pageText: (latest && latest.pageText) || getCoReadRecentPageContextText(book),
            threadText: buildCoReadThreadText(latest),
            replyText
        }, { max_tokens: COREAD_AI_REPLY_MAX_TOKENS, temperature: 0.82 });
        const text = result && result.ok ? result.text : '';
        if (text) {
            saveCoReadThoughtMutation(book.id, thought.id, item => {
                item.replies = Array.isArray(item.replies) ? item.replies : [];
                item.replies.push({ role: 'char', text, createdAt: Date.now() });
                item.updatedAt = Date.now();
            });
            coreadCommentStatusText = '';
        } else {
            coreadCommentStatusText = (result && result.error) || 'AI 返回了空内容';
        }
    } catch (_) {
        coreadCommentStatusText = '生成失败，稍后再试。';
    } finally {
        coreadBusy = false;
        renderCoReadCommentPanel();
        if (coreadActiveTab === 'thoughts') renderCoReadThoughts();
        if (coreadActiveTab === 'me') renderCoReadMePanel();
    }
}
window.sendCoReadCommentReply = sendCoReadCommentReply;

function getCoReadBookProgress(book) {
    const contentLength = String(book && book.content || '').length;
    if (!contentLength) return Math.min(100, Math.max(0, Number(book && book.progress || 0)));
    const pageCount = Math.max(1, Math.ceil(contentLength / COREAD_PAGE_SIZE));
    return Math.round((Math.min(pageCount - 1, Number(book.page || 0)) + 1) / pageCount * 100);
}

function getCoReadPageCount(book) {
    const contentLength = String(book && book.content || '').length;
    return Math.max(1, Math.ceil(contentLength / COREAD_PAGE_SIZE));
}

function getCoReadChapterPage(chapter) {
    const raw = chapter && chapter.page;
    if (raw === null || raw === undefined || raw === '') return null;
    const page = Number(raw);
    return Number.isFinite(page) ? Math.max(0, page) : null;
}

function getCoReadChapters(book) {
    const content = String(book && book.content || '');
    const stored = Array.isArray(book && book.chapters) ? book.chapters : [];
    const chapters = stored
        .filter(chapter => chapter && chapter.title)
        .map((chapter, index) => ({
            title: cleanCoReadReadableText(chapter.title).replace(/\s+/g, ' ').slice(0, 72),
            url: chapter.url || '',
            page: getCoReadChapterPage(chapter),
            index
        }));
    const seen = new Set();
    const pattern = /(?:^|\n)([^\n]{0,28}第\s*[一二三四五六七八九十百千万零〇\d]+\s*[章节回卷][^\n]{0,56})/g;
    let match = null;
    while (content && (match = pattern.exec(content)) && chapters.length < 360) {
        const title = cleanCoReadReadableText(match[1]).replace(/\s+/g, ' ').slice(0, 72);
        if (!title || seen.has(title)) continue;
        seen.add(title);
        const page = Math.max(0, Math.floor(match.index / COREAD_PAGE_SIZE));
        const existing = chapters.find(chapter => chapter.title === title || chapter.title.includes(title) || title.includes(chapter.title));
        if (existing) existing.page = Number.isFinite(Number(existing.page)) ? Math.min(existing.page, page) : page;
        else chapters.push({ title, page, url: '', index: chapters.length });
    }
    if (!chapters.length) {
        const pageCount = getCoReadPageCount(book);
        return Array.from({ length: Math.min(pageCount, 80) }, (_, index) => ({
            title: `第 ${index + 1} 页`,
            page: index
        }));
    }
    return chapters;
}

function getCoReadCurrentChapter(book) {
    const page = Math.max(0, Number(book && book.page || 0));
    const chapters = getCoReadChapters(book);
    return [...chapters].reverse().find(chapter => {
        const chapterPage = getCoReadChapterPage(chapter);
        return chapterPage != null && chapterPage <= page;
    }) || chapters[0] || null;
}

function renderCoReadToc() {
    const drawer = document.getElementById('coread-toc-drawer');
    const bookBox = document.getElementById('coread-toc-book');
    const currentBox = document.getElementById('coread-toc-current');
    const listBox = document.getElementById('coread-toc-list');
    const book = getCoReadBook(coreadActiveBookId);
    syncCoReadTocDrawerState();
    if (!book) {
        if (bookBox) bookBox.innerHTML = '';
        if (currentBox) currentBox.innerHTML = '';
        if (listBox) listBox.innerHTML = '<div class="coread-empty">先选择一本书</div>';
        return;
    }
    const page = Math.max(0, Number(book.page || 0));
    const pageCount = getCoReadPageCount(book);
    const chapters = getCoReadChapters(book);
    const current = getCoReadCurrentChapter(book);
    if (bookBox) {
        bookBox.innerHTML = `
            <div class="coread-toc-cover">${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${musicEscapeHtml(String(book.title || '书').slice(0, 2))}</span>`}</div>
            <div>
                <strong>${musicEscapeHtml(book.title || '未命名书籍')}</strong>
                <em>${musicEscapeHtml(book.author || book.source || '未知作者')}</em>
            </div>
        `;
    }
    if (currentBox) {
        currentBox.innerHTML = `
            <span>正在阅读·${musicEscapeHtml(current ? current.title : `第 ${page + 1} 页`)}</span>
            <em>${page + 1}/${pageCount}</em>
        `;
    }
    if (listBox) {
        listBox.innerHTML = chapters.map((chapter, index) => {
            const active = current && chapter.title === current.title ? 'active' : '';
            const chapterPage = getCoReadChapterPage(chapter);
            const done = chapterPage != null && chapterPage < page ? ' done' : '';
            return `
                <button type="button" class="${active}${done}" onclick="jumpCoReadChapter(${index})">
                    <span>${musicEscapeHtml(chapter.title)}</span>
                    <i class="ri-checkbox-circle-fill"></i>
                </button>
            `;
        }).join('') || '<div class="coread-empty">还没有目录</div>';
    }
}

function syncCoReadTocDrawerState() {
    const drawer = document.getElementById('coread-toc-drawer');
    if (!drawer) return;
    drawer.classList.toggle('open', coreadTocOpen);
    drawer.setAttribute('aria-hidden', coreadTocOpen ? 'false' : 'true');
}

function toggleCoReadToc(open) {
    const wasSettingsOpen = coreadSettingsOpen;
    coreadTocOpen = typeof open === 'boolean' ? open : !coreadTocOpen;
    if (coreadTocOpen) {
        coreadSettingsOpen = false;
        coreadCommentPanelOpen = false;
        renderCoReadCommentPanel();
    }
    if (wasSettingsOpen && !coreadSettingsOpen) syncCoReadSettingsDrawerState();
    if (coreadTocOpen) renderCoReadToc();
    else syncCoReadTocDrawerState();
}
window.toggleCoReadToc = toggleCoReadToc;

async function jumpCoReadChapter(index) {
    const library = getCoReadLibrary();
    const book = library.find(item => item.id === coreadActiveBookId);
    if (!book) return;
    const chapter = getCoReadChapters(book)[Number(index || 0)];
    if (!chapter) return;
    let targetPage = getCoReadChapterPage(chapter);
    if (targetPage == null && chapter.url) {
        book.resolving = true;
        book.resolveStatus = `正在加载${chapter.title || '章节'}`;
        saveCoReadLibrary(library);
        renderCoReadApp();
        try {
            const chapterUrl = normalizeCoReadChapterUrl(chapter.url);
            const raw = await coReadFetchText(chapterUrl, { timeoutMs: 20000, quiet: true });
            const text = extractCoReadChapterText(raw, chapterUrl);
            const latest = getCoReadLibrary();
            const target = latest.find(item => item.id === coreadActiveBookId);
            if (!target) return;
            if (isCoReadUsefulContent(text)) {
                const prefix = target.content ? '\n\n' : '';
                targetPage = Math.max(0, Math.floor((String(target.content || '').length + prefix.length) / COREAD_PAGE_SIZE));
                target.content = `${target.content || ''}${prefix}${chapter.title || '章节'}\n\n${text}`.slice(0, 120000);
                const chapterIndex = Number.isFinite(Number(chapter.index)) ? Number(chapter.index) : Number(index || 0);
                if (Array.isArray(target.chapters) && target.chapters[chapterIndex]) {
                    target.chapters[chapterIndex].page = targetPage;
                }
                target.resolveStatus = '章节已加载';
            } else {
                target.resolveStatus = '这一章暂时加载失败';
            }
            target.resolving = false;
            target.page = targetPage == null ? Number(target.page || 0) : Math.max(0, Math.min(getCoReadPageCount(target) - 1, targetPage));
            saveCoReadLibrary(latest);
            coreadTocOpen = false;
            coreadReaderPanelOpen = false;
            renderCoReadApp();
            return;
        } catch (_) {
            const latest = getCoReadLibrary();
            const target = latest.find(item => item.id === coreadActiveBookId);
            if (target) {
                target.resolving = false;
                target.resolveStatus = '这一章暂时加载失败';
                saveCoReadLibrary(latest);
            }
            renderCoReadApp();
            return;
        }
    }
    book.page = Math.max(0, Math.min(getCoReadPageCount(book) - 1, Number(targetPage || 0)));
    saveCoReadLibrary(library);
    coreadTocOpen = false;
    coreadReaderPanelOpen = false;
    renderCoReadApp();
}
window.jumpCoReadChapter = jumpCoReadChapter;

function getCoReadBookReadChars(book) {
    const contentLength = String(book && book.content || '').length;
    if (!contentLength) return 0;
    const page = Math.max(0, Number(book && book.page || 0));
    return Math.max(0, Math.min(contentLength, (page + 1) * COREAD_PAGE_SIZE));
}

function formatCoReadStatNumber(value, unit = '') {
    const num = Math.max(0, Number(value || 0));
    if (unit === '字') {
        if (num >= 10000) return `${(num / 10000).toFixed(num >= 100000 ? 1 : 2).replace(/\.0$/, '')} 万字`;
        return `${Math.round(num)} 字`;
    }
    if (unit === '分钟') return `${Math.round(num)} 分钟`;
    if (unit === '天') return `${Math.round(num)} 天`;
    if (unit === '本') return `${Math.round(num)} 本`;
    if (unit === '条') return `${Math.round(num)} 条`;
    return String(Math.round(num));
}

function formatCoReadStatMinutes(minutes) {
    const total = Math.max(0, Math.round(Number(minutes || 0)));
    if (total >= 60) {
        const hours = Math.floor(total / 60);
        const rest = total % 60;
        return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
    }
    return `${total} 分钟`;
}

function getCoReadPeriodRange(range = coreadStatsRange, offset = coreadStatsOffset) {
    const now = new Date();
    const safeRange = ['day', 'week', 'month', 'year', 'total'].includes(range) ? range : 'day';
    if (safeRange === 'total') {
        return { id: safeRange, start: 0, end: Infinity, label: '全部' };
    }
    if (safeRange === 'day') {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
        return { id: safeRange, start: start.getTime(), end: end.getTime(), label: `${start.getMonth() + 1}月${start.getDate()}日` };
    }
    if (safeRange === 'week') {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset * 7);
        const day = date.getDay() || 7;
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day + 1);
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
        return { id: safeRange, start: start.getTime(), end: end.getTime(), label: `${start.getMonth() + 1}.${start.getDate()} - ${new Date(end.getTime() - 1).getMonth() + 1}.${new Date(end.getTime() - 1).getDate()}` };
    }
    if (safeRange === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        return { id: safeRange, start: start.getTime(), end: end.getTime(), label: `${start.getFullYear()}年${start.getMonth() + 1}月` };
    }
    const start = new Date(now.getFullYear() + offset, 0, 1);
    const end = new Date(start.getFullYear() + 1, 0, 1);
    return { id: safeRange, start: start.getTime(), end: end.getTime(), label: `${start.getFullYear()}年` };
}

function getCoReadBookActivityTime(book) {
    return Number(book && (book.updatedAt || book.lastReadAt || book.createdAt) || 0);
}

function getCoReadStatsBooks(library, rangeInfo) {
    if (!rangeInfo || rangeInfo.id === 'total') return Array.isArray(library) ? library : [];
    return (Array.isArray(library) ? library : []).filter(book => {
        const ts = getCoReadBookActivityTime(book);
        return ts >= rangeInfo.start && ts < rangeInfo.end;
    });
}

function buildCoReadStatsModel(library = getCoReadLibrary()) {
    const range = getCoReadPeriodRange();
    const scopedBooks = getCoReadStatsBooks(library, range);
    const sourceBooks = range.id === 'total' ? library : scopedBooks;
    const readChars = sourceBooks.reduce((sum, book) => sum + getCoReadBookReadChars(book), 0);
    const estimatedMinutes = Math.ceil(readChars / 423);
    const readDays = new Set(sourceBooks.map(book => {
        const ts = getCoReadBookActivityTime(book);
        return ts ? new Date(ts).toDateString() : '';
    }).filter(Boolean)).size;
    const finished = sourceBooks.filter(book => getCoReadBookProgress(book) >= 100 || book.finishedAt).length;
    const reading = sourceBooks.filter(book => getCoReadBookProgress(book) > 0 && getCoReadBookProgress(book) < 100).length;
    const noteCount = getCoReadThoughts(1000).filter(item => {
        if (range.id === 'total') return true;
        const ts = Number(item.createdAt || 0);
        return ts >= range.start && ts < range.end;
    }).length;
    const ranking = [...sourceBooks]
        .map(book => {
            const chars = getCoReadBookReadChars(book);
            return {
                book,
                chars,
                minutes: Math.max(1, Math.ceil(chars / 423))
            };
        })
        .filter(item => item.chars > 0)
        .sort((a, b) => b.minutes - a.minutes || b.chars - a.chars)
        .slice(0, 5);
    return {
        range,
        totalBooks: sourceBooks.length,
        finished,
        reading,
        noteCount,
        readChars,
        estimatedMinutes,
        readDays,
        speed: estimatedMinutes ? Math.round(readChars / estimatedMinutes) : 0,
        ranking
    };
}

function setCoReadStatsRange(range) {
    const next = ['day', 'week', 'month', 'year', 'total'].includes(range) ? range : 'day';
    if (coreadStatsRange !== next) {
        coreadStatsRange = next;
        coreadStatsOffset = 0;
    }
    renderCoReadStatsMount();
}
window.setCoReadStatsRange = setCoReadStatsRange;

function shiftCoReadStatsPeriod(delta) {
    if (coreadStatsRange !== 'total') coreadStatsOffset += Number(delta || 0);
    renderCoReadStatsMount();
}
window.shiftCoReadStatsPeriod = shiftCoReadStatsPeriod;

function renderCoReadStatsMount(library = getCoReadLibrary()) {
    const target = document.getElementById('coread-me-reading-stats');
    if (target) target.innerHTML = renderCoReadStatsPanel(library);
}

function renderCoReadStatsPanel(library = getCoReadLibrary()) {
    const model = buildCoReadStatsModel(library);
    const tabs = [
        { id: 'day', label: '日' },
        { id: 'week', label: '周' },
        { id: 'month', label: '月' },
        { id: 'year', label: '年' },
        { id: 'total', label: '总' }
    ];
    const stats = [
        { icon: 'ri-alarm-line', value: formatCoReadStatMinutes(model.estimatedMinutes), label: '阅读时间' },
        { icon: 'ri-calendar-line', value: formatCoReadStatNumber(model.readDays, '天'), label: '阅读天数' },
        { icon: 'ri-book-2-line', value: formatCoReadStatNumber(model.totalBooks, '本'), label: '累计读过' },
        { icon: 'ri-checkbox-circle-line', value: formatCoReadStatNumber(model.finished, '本'), label: '读完书籍' },
        { icon: 'ri-book-open-line', value: formatCoReadStatNumber(model.reading, '本'), label: '在读书籍' },
        { icon: 'ri-quill-pen-line', value: formatCoReadStatNumber(model.noteCount, '条'), label: '记录笔记' },
        { icon: 'ri-menu-2-line', value: formatCoReadStatNumber(model.readChars, '字'), label: '阅读字数' },
        { icon: 'ri-speed-up-line', value: model.speed ? `${model.speed} 字/分钟` : '暂无', label: '阅读速度' }
    ];
    return `
        <section class="coread-stats-board">
            <div class="coread-stats-title">
                <strong>阅读统计</strong>
                <span>Reading Stats</span>
            </div>
            <div class="coread-stats-tabs">
                ${tabs.map(tab => `
                    <button type="button" class="${coreadStatsRange === tab.id ? 'active' : ''}" onclick="setCoReadStatsRange('${tab.id}')">${tab.label}</button>
                `).join('')}
            </div>
            <div class="coread-stats-date">
                <button type="button" onclick="shiftCoReadStatsPeriod(-1)" aria-label="上一段"><i class="ri-arrow-left-s-line"></i></button>
                <strong>${musicEscapeHtml(model.range.label)}</strong>
                <button type="button" onclick="shiftCoReadStatsPeriod(1)" aria-label="下一段"><i class="ri-arrow-right-s-line"></i></button>
            </div>
            <div class="coread-stats-metrics">
                ${stats.map(item => `
                    <div>
                        <strong>${musicEscapeHtml(item.value)}</strong>
                        <span><i class="${item.icon}"></i>${musicEscapeHtml(item.label)}</span>
                    </div>
                `).join('')}
            </div>
            <section class="coread-stats-rank">
                <h3>阅读时长排行榜 <i class="ri-arrow-right-s-line"></i></h3>
                ${model.ranking.map((item, index) => `
                    <button type="button" onclick="selectCoReadBook('${musicEscapeAttr(item.book.id)}')">
                        <b>${index + 1}</b>
                        <span class="coread-stats-rank-cover">${item.book.coverUrl ? `<img src="${musicEscapeAttr(item.book.coverUrl)}" onerror="this.remove()">` : `<em>${musicEscapeHtml(String(item.book.title || '书').slice(0, 1))}</em>`}</span>
                        <span class="coread-stats-rank-copy">
                            <strong>${formatCoReadStatMinutes(item.minutes)}</strong>
                            <em>${musicEscapeHtml(item.book.title || '未命名书籍')}</em>
                            <small>累计阅读：${musicEscapeHtml(formatCoReadStatNumber(item.chars, '字'))}</small>
                        </span>
                    </button>
                `).join('') || '<div class="coread-stats-empty">当前周期还没有阅读记录。</div>'}
            </section>
        </section>
    `;
}

function getCoReadBookReviews(book) {
    return Array.isArray(book && book.reviews) ? book.reviews.filter(item => item && item.text) : [];
}

function normalizeCoReadBookReviewItems(value) {
    let source = value;
    if (source && typeof source === 'object') source = source.content || source.text || source.message || source.answer || source.response || '';
    let text = String(source || '').trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim();
    if (!text) return [];
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch (_) {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
            try { parsed = JSON.parse(match[0]); } catch (__) {}
        }
    }
    const rows = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.comments) ? parsed.comments : []);
    return rows.map(item => ({
        id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        nickname: String(item && (item.nickname || item.name) || '').trim().slice(0, 18),
        text: String(item && (item.text || item.comment || item.content) || '').trim().slice(0, 220),
        replyTo: String(item && (item.replyTo || item.to || '') || '').trim().slice(0, 18),
        likes: Math.max(0, Math.floor(Number(item && item.likes || 0))),
        createdAt: Date.now(),
        source: 'api'
    })).filter(item => item.nickname && item.text).slice(0, 18);
}

function buildCoReadBookReviewMessages(book) {
    const tags = getCoReadBookTags(book).join('、') || '未标注';
    const intro = getCoReadBookIntro(book, 420);
    const sample = String(book && book.content || '').slice(0, 1200);
    return [
        {
            role: 'system',
            content: '你是中文网文读者评论生成器。只输出 JSON，不要 Markdown，不要解释。评论必须像真实读者区，带昵称、吐槽、网络热梗、互相引用和轻微楼中楼互动。禁止空内容，禁止营销书评，禁止系统口吻。'
        },
        {
            role: 'user',
            content: [
                `书名：${book.title || '未命名书籍'}`,
                `作者：${book.author || '未知作者'}`,
                `属性/标签：${tags}`,
                `简介：${intro}`,
                sample ? `正文片段：${sample}` : '',
                '请生成 10-15 条中文读者评论。每条包含 nickname、text、likes，可选 replyTo。',
                'nickname 要搞笑、中二、抽象或像网络平台真实昵称。text 要有吐槽、网络热梗、小红书/抖音语感、短句、疯言疯语、错字、表情符号、@互动、楼中楼引用。必须贴合这本书，不要泛泛而谈。',
                '输出格式示例：[{"nickname":"...","text":"...","likes":7,"replyTo":"..."}]'
            ].filter(Boolean).join('\n\n')
        }
    ];
}

async function generateCoReadBookReviews(bookId) {
    const id = String(bookId || coreadActiveBookId || '');
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === id);
    if (!book || coreadBookReviewBusyId || typeof callChatApi !== 'function') return;
    coreadBookReviewBusyId = id;
    renderCoReadBookDetail();
    try {
        const result = await callChatApi(buildCoReadBookReviewMessages(book), { max_tokens: 1800, temperature: 0.9 });
        const items = normalizeCoReadBookReviewItems(result && result.ok ? result.content : '');
        if (items.length) {
            book.reviews = [...items, ...getCoReadBookReviews(book)].slice(0, 80);
        } else {
            book.reviewError = (result && result.error) || 'AI 没有返回可用书评。';
        }
        book.updatedAt = Date.now();
        saveCoReadLibrary(library);
    } catch (_) {
        book.reviewError = '书评生成失败，稍后再试。';
        saveCoReadLibrary(library);
    } finally {
        coreadBookReviewBusyId = '';
        renderCoReadBookDetail();
    }
}
window.generateCoReadBookReviews = generateCoReadBookReviews;

function likeCoReadBookReview(bookId, reviewId) {
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === bookId);
    const review = book && getCoReadBookReviews(book).find(item => item.id === reviewId);
    if (!book || !review) return;
    review.likes = Math.max(0, Number(review.likes || 0)) + 1;
    saveCoReadLibrary(library);
    renderCoReadBookDetail();
}
window.likeCoReadBookReview = likeCoReadBookReview;

function addCoReadUserBookReview(bookId) {
    const input = document.getElementById('coread-book-review-input');
    const text = String(input && input.value || '').trim();
    if (!text) return;
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === bookId);
    if (!book) return;
    book.reviews = [{
        id: `review_user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        nickname: '我',
        text: text.slice(0, 220),
        likes: 0,
        createdAt: Date.now(),
        source: 'user'
    }, ...getCoReadBookReviews(book)].slice(0, 80);
    book.updatedAt = Date.now();
    saveCoReadLibrary(library);
    if (input) input.value = '';
    renderCoReadBookDetail();
}
window.addCoReadUserBookReview = addCoReadUserBookReview;

function openCoReadBookDetail(bookId) {
    coreadActiveBookId = String(bookId || '');
    coreadActiveTab = 'detail';
    renderCoReadApp();
}
window.openCoReadBookDetail = openCoReadBookDetail;

function startCoReadBook(bookId) {
    coreadActiveBookId = String(bookId || coreadActiveBookId || '');
    coreadActiveTab = 'reader';
    coreadReaderPanelOpen = false;
    renderCoReadApp();
}
window.startCoReadBook = startCoReadBook;

function renderCoReadBookReviews(book) {
    const reviews = getCoReadBookReviews(book);
    const userProfile = typeof getUserProfile === 'function' ? (getUserProfile() || {}) : {};
    if (!reviews.length) {
        return `
            <div class="coread-book-review-empty">
                <span>${book.reviewError ? musicEscapeHtml(book.reviewError) : '还没有书评。调用 API 生成一组真实读者风格评论。'}</span>
                <button type="button" onclick="generateCoReadBookReviews('${musicEscapeAttr(book.id)}')">${coreadBookReviewBusyId === book.id ? '生成中...' : '生成书评'}</button>
            </div>
        `;
    }
    return reviews.map(item => `
        <article class="coread-book-review">
            <img src="${musicEscapeAttr(item.source === 'user' ? (userProfile.avatar || DEFAULT_AVATAR) : DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
            <div>
                <header>
                    <strong>${musicEscapeHtml(item.nickname || '读者')}</strong>
                    ${item.replyTo ? `<em>@${musicEscapeHtml(item.replyTo)}</em>` : ''}
                </header>
                <p>${musicEscapeHtml(item.text || '')}</p>
                <footer>
                    <button type="button" onclick="likeCoReadBookReview('${musicEscapeAttr(book.id)}','${musicEscapeAttr(item.id)}')"><i class="ri-heart-3-line"></i>${Number(item.likes || 0) || '赞'}</button>
                    <button type="button" onclick="document.getElementById('coread-book-review-input')?.focus()">回复</button>
                </footer>
            </div>
        </article>
    `).join('');
}

function renderCoReadBookDetail() {
    const box = document.getElementById('coread-book-detail');
    if (!box) return;
    const book = getCoReadBook(coreadActiveBookId);
    if (!book) {
        box.innerHTML = '<div class="coread-empty">先选择一本书。</div>';
        return;
    }
    const tags = getCoReadBookTags(book);
    const pct = getCoReadBookProgress(book);
    box.innerHTML = `
        <article class="coread-book-hero-card">
            <div class="coread-book-hero-cover">${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${musicEscapeHtml(String(book.title || '书').slice(0, 1))}</span>`}</div>
            <div class="coread-book-hero-copy">
                <strong>${musicEscapeHtml(book.title || '未命名书籍')}</strong>
                <em>${musicEscapeHtml(book.author || '未知作者')}</em>
                <div class="coread-book-tags">${tags.map(tag => `<span>${musicEscapeHtml(tag)}</span>`).join('') || '<span>未标注</span>'}</div>
                <p>${musicEscapeHtml(getCoReadBookIntro(book, 180))}</p>
                <small>${musicEscapeHtml([book.source || '本地', formatCoReadByteSize(getCoReadBookByteSize(book)), `${pct}%`].filter(Boolean).join(' · '))}</small>
            </div>
        </article>
        <div class="coread-book-actions">
            <button type="button" onclick="startCoReadBook('${musicEscapeAttr(book.id)}')"><i class="ri-book-open-line"></i>开始阅读</button>
            <button type="button" onclick="generateCoReadBookReviews('${musicEscapeAttr(book.id)}')" ${coreadBookReviewBusyId === book.id ? 'disabled' : ''}><i class="ri-chat-smile-3-line"></i>${coreadBookReviewBusyId === book.id ? '生成中' : 'AI 书评'}</button>
        </div>
        <section class="coread-book-review-panel">
            <header>
                <strong>全部评论 <em>${getCoReadBookReviews(book).length}</em></strong>
                <button type="button" onclick="generateCoReadBookReviews('${musicEscapeAttr(book.id)}')" ${coreadBookReviewBusyId === book.id ? 'disabled' : ''}>最热</button>
            </header>
            <div class="coread-book-review-list">${renderCoReadBookReviews(book)}</div>
            <div class="coread-book-review-input">
                <input id="coread-book-review-input" type="text" maxlength="220" placeholder="说点好听的">
                <button type="button" onclick="addCoReadUserBookReview('${musicEscapeAttr(book.id)}')">发送</button>
            </div>
        </section>
    `;
}

function renderCoReadDashboard() {
    const current = document.getElementById('coread-current-reads');
    const library = getCoReadLibrary();
    const shelfBooks = getCoReadShelfBooks(library);
    const shelfSettings = getCoReadShelfSettings();
    if (current) {
        current.dataset.view = shelfSettings.viewMode;
        current.classList.toggle('compact', !!shelfSettings.compact);
        current.classList.toggle('divider', !!shelfSettings.divider);
        current.classList.toggle('flat', !shelfSettings.cardMode);
        current.style.setProperty('--coread-shelf-top-steps', `${shelfSettings.topSteps}px`);
        const categoryShelvesHtml = renderCoReadCategoryShelves(library);
        const totalShelfHtml = renderCoReadShelfRail(library);
        const bookCardsHtml = shelfBooks.slice(0, 24).map(book => {
            const pct = getCoReadBookProgress(book);
            const stars = Math.max(0, Math.min(5, Number(book.rating || 0)));
            const selected = coreadShelfSelectedIds.has(book.id);
            const tags = getCoReadBookTags(book);
            return `
                <article class="coread-read-card coread-read-detail-card ${book.id === coreadActiveBookId ? 'active' : ''} ${selected ? 'selected' : ''}">
                    ${coreadShelfSelectionMode ? `<button type="button" class="coread-read-check" onclick="event.stopPropagation(); toggleCoReadShelfBookSelected('${musicEscapeAttr(book.id)}')" aria-label="选择书籍"><i class="${selected ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'}"></i></button>` : ''}
                    <button type="button" class="coread-read-main" onclick="openCoReadBookDetail('${musicEscapeAttr(book.id)}')">
                        <div class="coread-read-cover">
                            ${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${book.coverResolving ? '...' : musicEscapeHtml(String(book.title || '书').slice(0, 2))}</span>`}
                        </div>
                        <div class="coread-read-copy">
                            <strong>${musicEscapeHtml(book.title || '未命名书籍')}</strong>
                            <div class="coread-card-stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
                            <div class="coread-read-tags">${tags.map(tag => `<span>${musicEscapeHtml(tag)}</span>`).join('') || '<span>未标注</span>'}</div>
                            <em>${musicEscapeHtml(book.author || '未知作者')}</em>
                            <p>${musicEscapeHtml(getCoReadBookIntro(book, 118))}</p>
                            <small>${musicEscapeHtml([book.source || '本地', formatCoReadByteSize(getCoReadBookByteSize(book)), `${pct}%`].join(' · '))}</small>
                        </div>
                    </button>
                    <button type="button" class="coread-read-delete" onclick="event.stopPropagation(); deleteCoReadBook('${musicEscapeAttr(book.id)}')" aria-label="删除书籍">
                        <i class="ri-close-line"></i>
                    </button>
                </article>
            `;
        }).join('');
        current.innerHTML = totalShelfHtml + categoryShelvesHtml + (bookCardsHtml || `<div class="coread-empty">${library.length ? '这个分类下暂时没有书。' : '书架还空着。先从书源搜索或导入一本书。'}</div>`);
        library.filter(book => book && !book.coverUrl && !book.coverResolving && book.title && !isCoReadUrlTitle(book.title)).slice(0, 4).forEach(book => {
            ensureCoReadBookCover(book.id);
        });
    }
    renderCoReadStatsMount(library);
}

function renderCoReadCalendarStats() {
    const stats = document.getElementById('coread-me-stats');
    const calendar = document.getElementById('coread-reading-calendar');
    const library = getCoReadLibrary();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthBooks = library.filter(book => {
        const ts = Number(book.createdAt || 0);
        return ts >= monthStart.getTime();
    });
    const avg = library.length ? Math.round(library.reduce((sum, book) => sum + getCoReadBookProgress(book), 0) / library.length) : 0;
    if (stats) {
        stats.innerHTML = `
            <div><strong>${monthBooks.length}</strong><span>本月加入</span></div>
            <div><strong>${avg}%</strong><span>平均进度</span></div>
            <div><strong>${getCoReadThoughts().length}</strong><span>共读旁注</span></div>
        `;
    }
    if (calendar) {
        const activeDays = new Set(monthBooks.map(book => new Date(book.createdAt || Date.now()).getDate()));
        calendar.innerHTML = `
            <div class="coread-calendar-head"><strong>${now.getFullYear()} / ${now.getMonth() + 1}</strong><span>本月阅读记录</span></div>
            <div class="coread-calendar-grid">
                ${Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    return `<span class="${activeDays.has(day) ? 'active' : ''}">${day}</span>`;
                }).join('')}
            </div>
        `;
    }
}

function bindCoReadReaderTapZones(body) {
    if (!body || body.dataset.coreadTapBound === '1') return;
    body.dataset.coreadTapBound = '1';
    body.setAttribute('tabindex', '0');
    body.addEventListener('pointerdown', handleCoReadReaderPointerDown);
    body.addEventListener('pointerup', handleCoReadReaderPointerUp);
    body.addEventListener('pointercancel', () => { coreadReaderTapState = null; });
    body.addEventListener('click', handleCoReadReaderClick);
    body.addEventListener('keydown', handleCoReadReaderKeydown);
}

function handleCoReadReaderPointerDown(event) {
    if (coreadActiveTab !== 'reader' || coreadTocOpen || coreadSettingsOpen) {
        coreadReaderTapState = null;
        return;
    }
    if (event.button != null && event.button !== 0) return;
    const body = event.currentTarget;
    coreadReaderTapState = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scrollTop: body ? body.scrollTop : 0
    };
}

function handleCoReadReaderPointerUp(event) {
    const state = coreadReaderTapState;
    coreadReaderTapState = null;
    if (!state || state.pointerId !== event.pointerId) return;
    if (coreadActiveTab !== 'reader' || coreadTocOpen || coreadSettingsOpen) return;
    if (event.button != null && event.button !== 0) return;
    const body = event.currentTarget;
    if (!body) return;
    const rect = body.getBoundingClientRect();
    const moved = Math.abs(event.clientX - state.x) > 12
        || Math.abs(event.clientY - state.y) > 12
        || Math.abs(body.scrollTop - state.scrollTop) > 6;
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (moved || !inside) return;
    coreadReaderTapHandledAt = Date.now();
    turnCoReadPage(event.clientX >= rect.left + rect.width / 2 ? 1 : -1);
}

function handleCoReadReaderClick(event) {
    if (Date.now() - coreadReaderTapHandledAt < 350) return;
    if (coreadActiveTab !== 'reader' || coreadTocOpen || coreadSettingsOpen) return;
    const body = event.currentTarget;
    if (!body) return;
    const rect = body.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) return;
    coreadReaderTapHandledAt = Date.now();
    turnCoReadPage(event.clientX >= rect.left + rect.width / 2 ? 1 : -1);
}

function handleCoReadReaderKeydown(event) {
    if (coreadActiveTab !== 'reader' || coreadTocOpen || coreadSettingsOpen) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        turnCoReadPage(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        turnCoReadPage(-1);
    }
}

function getCoReadPageFromScrollPosition(body, book) {
    if (!body || !book) return 0;
    const maxPage = Math.max(0, getCoReadPageCount(book) - 1);
    const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
    if (!maxPage || !maxScroll) return 0;
    return Math.max(0, Math.min(maxPage, Math.round((body.scrollTop / maxScroll) * maxPage)));
}

function getCoReadScrollTopForPage(body, book, page) {
    if (!body || !book) return 0;
    const maxPage = Math.max(0, getCoReadPageCount(book) - 1);
    const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
    if (!maxPage || !maxScroll) return 0;
    const safePage = Math.max(0, Math.min(maxPage, Number(page || 0)));
    return Math.round((safePage / maxPage) * maxScroll);
}

function scrollCoReadBodyToPage(body, book, page) {
    if (!body || !book) return;
    const previousBehavior = body.style.scrollBehavior;
    body.style.scrollBehavior = 'auto';
    const apply = () => {
        body.scrollTop = getCoReadScrollTopForPage(body, book, page);
    };
    apply();
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
            apply();
            body.style.scrollBehavior = previousBehavior;
        });
    } else {
        body.style.scrollBehavior = previousBehavior;
    }
}

function formatCoReadByteSize(bytes) {
    const value = Math.max(0, Number(bytes || 0));
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(value >= 100 * 1024 ? 0 : 1)} KB`;
    return `${value || 0} B`;
}

function getCoReadBookByteSize(book) {
    const explicit = Number(book && (book.fileSize || book.size || book.bytes));
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const text = String(book && (book.content || book.description) || '');
    if (typeof Blob === 'function') return new Blob([text]).size;
    return text.length * 2;
}

function formatCoReadDurationFromChars(count) {
    const minutes = Math.max(1, Math.ceil(Math.max(0, Number(count || 0)) / 520));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours && rest) return `${hours} 小时 ${rest} 分钟`;
    if (hours) return `${hours} 小时`;
    return `${rest} 分钟`;
}

function getCoReadReaderNotes(book) {
    if (!book || !Array.isArray(book.thoughts)) return [];
    return book.thoughts.map(item => {
        const char = getCoReadCharacterById(item.charId);
        return {
            ...item,
            charName: item.charName || getCoReadCharName(char) || 'char',
            charAvatar: item.charAvatar || (char && char.avatar) || DEFAULT_AVATAR,
            replies: Array.isArray(item.replies) ? item.replies : []
        };
    }).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function getCoReadBookmarks(book) {
    return (Array.isArray(book && book.bookmarks) ? book.bookmarks : [])
        .map(item => ({
            ...item,
            page: Math.max(0, Number(item && item.page || 0)),
            createdAt: Number(item && item.createdAt || 0)
        }))
        .sort((a, b) => a.page - b.page || b.createdAt - a.createdAt);
}

function isCurrentCoReadPageBookmarked(book) {
    const page = Math.max(0, Number(book && book.page || 0));
    return getCoReadBookmarks(book).some(item => item.page === page);
}

function toggleCurrentCoReadBookmark() {
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === coreadActiveBookId);
    if (!book) return false;
    const page = Math.max(0, Number(book.page || 0));
    const bookmarks = getCoReadBookmarks(book);
    const exists = bookmarks.some(item => item.page === page);
    book.bookmarks = exists
        ? bookmarks.filter(item => item.page !== page)
        : [{
            id: `bookmark_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            page,
            title: getCoReadCurrentChapter(book)?.title || `第 ${page + 1} 页`,
            excerpt: getCoReadPageText(book).replace(/\s+/g, ' ').slice(0, 80),
            createdAt: Date.now()
        }, ...bookmarks].slice(0, 120);
    saveCoReadLibrary(library);
    renderCoReadReader();
    return false;
}
window.toggleCurrentCoReadBookmark = toggleCurrentCoReadBookmark;

function jumpCoReadBookmark(page) {
    const library = getCoReadLibrary();
    const book = library.find(item => item && item.id === coreadActiveBookId);
    if (!book) return;
    book.page = Math.max(0, Math.min(getCoReadPageCount(book) - 1, Number(page || 0)));
    saveCoReadLibrary(library);
    coreadReaderPendingScrollPage = book.page;
    coreadReaderPanelOpen = false;
    renderCoReadReader();
}
window.jumpCoReadBookmark = jumpCoReadBookmark;

function setCoReadReaderPanelTab(tab) {
    const next = ['chapters', 'notes', 'bookmarks'].includes(tab) ? tab : 'chapters';
    if (coreadReaderPanelOpen && coreadReaderPanelTab === next) {
        coreadReaderPanelOpen = false;
        renderCoReadReaderOverview();
        updateCoReadTopbar();
        return;
    }
    coreadReaderPanelTab = next;
    coreadReaderPanelOpen = true;
    if (next !== 'chapters') {
        coreadReaderChapterGroupIndex = -1;
        coreadReaderChapterGroupPickerOpen = false;
    }
    renderCoReadReaderOverview();
    updateCoReadTopbar();
}
window.setCoReadReaderPanelTab = setCoReadReaderPanelTab;

function closeCoReadReaderPanel() {
    coreadReaderPanelOpen = false;
    coreadReaderChapterGroupIndex = -1;
    coreadReaderChapterGroupPickerOpen = false;
    renderCoReadReaderOverview();
    updateCoReadTopbar();
}
window.closeCoReadReaderPanel = closeCoReadReaderPanel;

function toggleCoReadReaderChapterGroup() {
    coreadReaderChapterGroupPickerOpen = !coreadReaderChapterGroupPickerOpen;
    renderCoReadReaderOverview();
}
window.toggleCoReadReaderChapterGroup = toggleCoReadReaderChapterGroup;

function selectCoReadReaderChapterGroup(index) {
    const next = Math.max(0, Number(index) || 0);
    coreadReaderChapterGroupIndex = next;
    coreadReaderChapterGroupPickerOpen = false;
    renderCoReadReaderOverview();
}
window.selectCoReadReaderChapterGroup = selectCoReadReaderChapterGroup;

function runCoReadReaderToolAction(action) {
    const tool = String(action || '');
    if (tool === 'chapters' || tool === 'notes' || tool === 'bookmarks') {
        setCoReadReaderPanelTab(tool);
        return;
    }
    if (tool === 'mode') {
        setCoReadPageMode(getCoReadReaderSettings().pageMode === 'scroll' ? 'paged' : 'scroll');
    }
}

function handleCoReadReaderToolPointer(action, event) {
    coreadReaderToolPointerAt = Date.now();
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
    runCoReadReaderToolAction(action);
    return false;
}
window.handleCoReadReaderToolPointer = handleCoReadReaderToolPointer;

function handleCoReadReaderToolClick(action, event) {
    if (Date.now() - coreadReaderToolPointerAt < 600) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
        return false;
    }
    runCoReadReaderToolAction(action);
    return false;
}
window.handleCoReadReaderToolClick = handleCoReadReaderToolClick;

function renderCoReadReaderChapterRows(book, limit = 48, startIndex = 0) {
    const chapters = getCoReadChapters(book);
    const page = Math.max(0, Number(book && book.page || 0));
    const current = getCoReadCurrentChapter(book);
    const from = Math.max(0, Math.min(Number(startIndex) || 0, Math.max(0, chapters.length - 1)));
    return chapters.slice(from, from + limit).map((chapter, offset) => {
        const index = from + offset;
        const chapterPage = getCoReadChapterPage(chapter);
        const active = current && chapter.title === current.title ? ' active' : '';
        const done = chapterPage != null && chapterPage < page ? ' done' : '';
        const chapterTitle = chapter.title || `第 ${index + 1} 页`;
        return `
            <button type="button" class="coread-reader-row${active}${done}" onclick="jumpCoReadChapter(${index})">
                <span><b>${index + 1}</b>${musicEscapeHtml(chapterTitle)}</span>
                <em>${chapterPage == null ? '加载' : Math.max(1, chapterPage + 1)}</em>
                <i class="ri-checkbox-circle-fill" aria-hidden="true"></i>
            </button>
        `;
    }).join('') || '<div class="coread-reader-panel-empty">还没有目录</div>';
}

function renderCoReadReaderNoteRows(book) {
    const notes = getCoReadReaderNotes(book);
    return notes.slice(0, 30).map(note => {
        const replies = (Array.isArray(note.replies) ? note.replies : []).slice(-2);
        return `
            <article class="coread-reader-note">
                <header>
                    <img src="${musicEscapeAttr(note.charAvatar || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                    <div>
                        <strong>${musicEscapeHtml(note.charName || 'char')}</strong>
                        <span>第 ${Math.max(1, Number(note.page || 0) + 1)} 页 · ${replies.length ? `${replies.length} 条最近回复` : 'char 旁注'}</span>
                    </div>
                </header>
                <p>${musicEscapeHtml(note.text || '')}</p>
                ${replies.map(reply => `
                    <div class="coread-reader-reply ${reply.role === 'user' ? 'is-user' : 'is-char'}">
                        <b>${reply.role === 'user' ? 'user' : musicEscapeHtml(note.charName || 'char')}</b>
                        <span>${musicEscapeHtml(reply.text || '')}</span>
                    </div>
                `).join('')}
            </article>
        `;
    }).join('') || `
        <div class="coread-reader-panel-empty">
            <span>这本书还没有笔记。</span>
            <button type="button" onclick="openCoReadCommentPanel()">让 char 读当前页</button>
        </div>
    `;
}

function renderCoReadReaderBookmarkRows(book) {
    const bookmarks = getCoReadBookmarks(book);
    const marked = isCurrentCoReadPageBookmarked(book);
    const action = `
        <button type="button" class="coread-reader-bookmark-action ${marked ? 'active' : ''}" onclick="toggleCurrentCoReadBookmark()">
            <i class="${marked ? 'ri-bookmark-3-fill' : 'ri-bookmark-3-line'}"></i>
            <span>${marked ? '移除当前页书签' : '收藏当前页'}</span>
        </button>
    `;
    const rows = bookmarks.map(item => `
        <button type="button" class="coread-reader-row" onclick="jumpCoReadBookmark(${Number(item.page || 0)})">
            <span>${musicEscapeHtml(item.title || `第 ${Number(item.page || 0) + 1} 页`)}</span>
            <em>${Number(item.page || 0) + 1}</em>
            ${item.excerpt ? `<small>${musicEscapeHtml(item.excerpt)}</small>` : ''}
        </button>
    `).join('');
    return `${action}${rows || '<div class="coread-reader-panel-empty">还没有书签，先收藏当前页。</div>'}`;
}

function renderCoReadReaderOverview() {
    const box = document.getElementById('coread-reader-overview');
    if (!box) return;
    const shell = document.querySelector('.coread-shell');
    if (shell) shell.classList.toggle('coread-reader-panel-open', !!coreadReaderPanelOpen);
    const book = getCoReadBook(coreadActiveBookId);
    box.classList.toggle('open', !!coreadReaderPanelOpen);
    if (!coreadReaderPanelOpen) {
        delete box.dataset.readerPanelTab;
        box.innerHTML = '';
        return;
    }
    if (!book) {
        box.innerHTML = `
            <div class="coread-reader-empty-card">
                <strong>Pick a book</strong>
                <span>导入一本书，再选择 Reading Soulmate 开始共读。</span>
            </div>
        `;
        return;
    }
    box.dataset.readerPanelTab = coreadReaderPanelTab;
    const contentLength = String(book.content || book.description || '').length;
    const pageCount = getCoReadPageCount(book);
    const currentPage = Math.max(0, Number(book.page || 0));
    const notes = getCoReadReaderNotes(book);
    const bookmarks = getCoReadBookmarks(book);
    const chapters = getCoReadChapters(book);
    const currentChapter = getCoReadCurrentChapter(book);
    const currentChapterIndex = Math.max(0, chapters.findIndex(chapter => currentChapter && chapter.title === currentChapter.title));
    const chapterGroupSize = 30;
    const chapterGroupCount = Math.max(1, Math.ceil(Math.max(1, chapters.length) / chapterGroupSize));
    const currentGroupIndex = Math.max(0, Math.min(chapterGroupCount - 1, Math.floor(currentChapterIndex / chapterGroupSize)));
    const activeGroupIndex = Math.max(0, Math.min(chapterGroupCount - 1, coreadReaderChapterGroupIndex >= 0 ? coreadReaderChapterGroupIndex : currentGroupIndex));
    if (coreadReaderChapterGroupIndex < 0) coreadReaderChapterGroupIndex = activeGroupIndex;
    const chapterGroupStart = activeGroupIndex * chapterGroupSize + 1;
    const chapterGroupEnd = Math.min(chapters.length || chapterGroupStart, chapterGroupStart + chapterGroupSize - 1);
    const tabs = [
        { id: 'chapters', label: '章节', count: chapters.length },
        { id: 'notes', label: '笔记', count: notes.length },
        { id: 'bookmarks', label: '书签', count: bookmarks.length }
    ];
    const panel = coreadReaderPanelTab === 'notes'
        ? renderCoReadReaderNoteRows(book)
        : coreadReaderPanelTab === 'bookmarks'
            ? renderCoReadReaderBookmarkRows(book)
            : renderCoReadReaderChapterRows(book, chapterGroupSize, chapterGroupStart - 1);
    const chapterGroups = Array.from({ length: chapterGroupCount }, (_, index) => {
        const start = index * chapterGroupSize + 1;
        const end = Math.min(chapters.length || start, start + chapterGroupSize - 1);
        return { index, start, end };
    });
    const chapterGroupPicker = coreadReaderPanelTab === 'chapters' && coreadReaderChapterGroupPickerOpen && chapterGroups.length > 1 ? `
        <div class="coread-reader-drawer-groups">
            ${chapterGroups.map(group => `
                <button type="button" class="${group.index === activeGroupIndex ? 'active' : ''}" onclick="selectCoReadReaderChapterGroup(${group.index})">
                    第${group.start}-${group.end}章
                </button>
            `).join('')}
        </div>
    ` : '';
    const chapterDrawerHeader = coreadReaderPanelTab === 'chapters' ? `
        <div class="coread-reader-drawer-head">
            <div class="coread-reader-drawer-cover">${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${musicEscapeHtml(String(book.title || '书').slice(0, 1))}</span>`}</div>
            <div class="coread-reader-drawer-meta">
                <strong>${musicEscapeHtml(book.title || '未命名书籍')}</strong>
                <span>${musicEscapeHtml(book.author || book.source || '未知作者')}</span>
            </div>
        </div>
        <div class="coread-reader-drawer-status">
            <span>正在阅读·${currentChapterIndex + 1}${musicEscapeHtml(currentChapter ? currentChapter.title : `第 ${currentPage + 1} 页`)}（第${Math.min(pageCount, currentPage + 1)}页）</span>
            <button type="button" onclick="closeCoReadReaderPanel()" aria-label="关闭章节目录"><i class="ri-list-check-2"></i></button>
        </div>
        <button type="button" class="coread-reader-drawer-group" onclick="toggleCoReadReaderChapterGroup()" aria-label="${coreadReaderChapterGroupPickerOpen ? '收起章节范围' : '选择章节范围'}">
            <i class="${coreadReaderChapterGroupPickerOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}"></i>
            <span>第${chapterGroupStart}-${chapterGroupEnd}章</span>
        </button>
        ${chapterGroupPicker}
    ` : '';
    const classicHeader = coreadReaderPanelTab === 'chapters' ? '' : `
        <div class="coread-reader-book-card">
            <div class="coread-reader-cover">${book.coverUrl ? `<img src="${musicEscapeAttr(book.coverUrl)}" onerror="this.remove()">` : `<span>${musicEscapeHtml(String(book.title || '书').slice(0, 1))}</span>`}</div>
            <div class="coread-reader-book-info">
                <strong>${musicEscapeHtml(book.title || '未命名书籍')}</strong>
                <span>${musicEscapeHtml(book.author || book.source || '未知作者')}</span>
                <em>${pageCount} 页 · ${contentLength ? `${(contentLength / 10000).toFixed(contentLength >= 100000 ? 1 : 2)} 万字` : '暂无正文'} · ${formatCoReadByteSize(getCoReadBookByteSize(book))}</em>
            </div>
            <div class="coread-reader-time">
                <span>阅读时长</span>
                <strong>${formatCoReadDurationFromChars(contentLength)}</strong>
                <em>${Math.min(pageCount, currentPage + 1)} / ${pageCount}</em>
            </div>
            <button type="button" class="coread-reader-panel-close" onclick="closeCoReadReaderPanel()" aria-label="关闭"><i class="ri-close-line"></i></button>
        </div>
        <div class="coread-reader-tabs">
            ${tabs.map(tab => `
                <button type="button" class="${coreadReaderPanelTab === tab.id ? 'active' : ''}" onclick="setCoReadReaderPanelTab('${tab.id}')">
                    <span>${tab.label}</span>
                    <em>${tab.count}</em>
                </button>
            `).join('')}
        </div>
    `;
    box.innerHTML = `
        ${chapterDrawerHeader}
        ${classicHeader}
        <div class="coread-reader-panel" data-reader-panel="${musicEscapeAttr(coreadReaderPanelTab)}">
            ${panel}
        </div>
    `;
}

function renderCoReadReader() {
    const book = getCoReadBook(coreadActiveBookId);
    const title = document.getElementById('coread-reader-title');
    const body = document.getElementById('coread-reader-body');
    const meta = document.getElementById('coread-reader-meta');
    const settings = getCoReadReaderSettings();
    if (title) title.textContent = book ? (book.title || '未命名书籍') : '选择一本书';
    if (meta) {
        const pageCount = book && book.content ? Math.max(1, Math.ceil(String(book.content || '').length / COREAD_PAGE_SIZE)) : 1;
        meta.textContent = book
            ? `${book.author || '未知作者'} · ${settings.pageMode === 'scroll' ? '滚动阅读' : `第 ${Math.max(1, Number(book.page || 0) + 1)} / ${pageCount} 页`}${book.resolveStatus ? ` · ${book.resolveStatus}` : ''}`
            : '导入 txt/md，或用在线书城搜索加入书架';
    }
    if (body) {
        bindCoReadReaderTapZones(body);
        const previousScrollTop = body.scrollTop;
        const wasScrollMode = body.dataset.coreadPageMode === 'scroll';
        const text = book
            ? (settings.pageMode === 'scroll' && !book.resolving
                ? String(book.content || book.description || '这本书目前只有书名和来源链接，还没有正文。')
                : getCoReadPageText(book))
            : '书架空着。导入一本书，选择一个角色，就可以开始共读。';
        if (body.textContent !== text) body.textContent = text;
        body.dataset.coreadPageMode = settings.pageMode;
        if (settings.pageMode === 'scroll') {
            if (book && coreadReaderPendingScrollPage != null) {
                const page = coreadReaderPendingScrollPage;
                coreadReaderPendingScrollPage = null;
                scrollCoReadBodyToPage(body, book, page);
            } else if (wasScrollMode) {
                body.scrollTop = previousScrollTop;
            } else if (book) {
                scrollCoReadBodyToPage(body, book, Number(book.page || 0));
            }
        } else {
            body.scrollTop = 0;
        }
    }
    renderCoReadReaderOverview();
}

function getCoReadTodayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getCoReadDailyParticipants() {
    const today = getCoReadTodayKey();
    try {
        const cache = JSON.parse(localStorage.getItem(COREAD_DAILY_PARTICIPANTS_KEY) || '{}');
        if (cache && cache.date === today && Number.isFinite(Number(cache.value))) {
            return Number(cache.value);
        }
    } catch (_) {
        // Regenerate below if the cached shape is invalid.
    }
    const min = 46000;
    const max = 268000;
    let random = Math.random();
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const bucket = new Uint32Array(1);
        window.crypto.getRandomValues(bucket);
        random = bucket[0] / 0xffffffff;
    }
    const value = Math.floor(min + random * (max - min + 1));
    try {
        localStorage.setItem(COREAD_DAILY_PARTICIPANTS_KEY, JSON.stringify({ date: today, value }));
    } catch (_) {
        // localStorage may be unavailable in private contexts; the random value still renders.
    }
    return value;
}

function getCoReadDailyCache() {
    try {
        const cache = JSON.parse(localStorage.getItem(COREAD_DAILY_KEY) || '{}');
        return cache && typeof cache === 'object' ? cache : {};
    } catch (_) {
        return {};
    }
}

function saveCoReadDailyCache(cache) {
    localStorage.setItem(COREAD_DAILY_KEY, JSON.stringify(cache && typeof cache === 'object' ? cache : {}));
}

function buildCoReadFallbackDaily() {
    const today = getCoReadTodayKey();
    const line = COREAD_DAILY_LINES[Math.abs(today.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % COREAD_DAILY_LINES.length];
    return {
        title: '今日惊喜书页',
        author: '在线书城同步中',
        line,
        tone: '随机推送 · 每日一书',
        volume: `VOL.${String(new Date().getDate()).padStart(2, '0')}`,
        source: 'daily-fallback',
        url: '',
        description: '打开共读后会尝试从在线书城抽取每日推荐。'
    };
}

function getCoReadDailyRecommendation() {
    const cache = getCoReadDailyCache();
    const today = getCoReadTodayKey();
    return cache.date === today && cache.book ? cache.book : buildCoReadFallbackDaily();
}

function getCoReadHolidaySense(date = new Date()) {
    const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const map = {
        '01-01': { title: '元旦', line: '新的一年，也给故事留一个新的开头。', theme: 'NEW YEAR' },
        '02-14': { title: '情人节', line: '把心动写进书页，和喜欢的人慢慢读。', theme: 'LOVE' },
        '05-01': { title: '劳动节', line: '忙碌之后，留一页给自己安静下来。', theme: 'REST' },
        '06-01': { title: '童心', line: '有些故事，会把人带回最柔软的年纪。', theme: 'CHILDHOOD' },
        '10-01': { title: '国庆', line: '山河辽阔，故事也值得慢慢走过。', theme: 'NATIONAL DAY' },
        '12-25': { title: '冬日', line: '把暖意藏进一页书里，等夜色慢下来。', theme: 'WINTER' }
    };
    const dragonBoat = ['05-30', '05-31', '06-01', '06-02', '06-03'];
    if (dragonBoat.includes(mmdd)) {
        return { title: '端午', line: '除了中国传统节日，这些传统文化你也不能忘', theme: 'DRAGON BOAT FESTIVAL' };
    }
    return map[mmdd] || null;
}

async function refreshCoReadDailyRecommendation(force = false) {
    if (coreadDailyLoading) return;
    const cache = getCoReadDailyCache();
    const today = getCoReadTodayKey();
    if (!force && cache.date === today && cache.book && cache.book.title && cache.book.source !== 'daily-fallback') {
        renderCoReadDaily();
        return;
    }
    coreadDailyLoading = true;
    renderCoReadDaily();
    try {
        const seedBase = today.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) + (force ? Math.floor(Math.random() * 1000) : 0);
        const seed = COREAD_DAILY_SEEDS[Math.abs(seedBase) % COREAD_DAILY_SEEDS.length];
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(seed)}&maxResults=20&orderBy=relevance`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`daily search ${resp.status}`);
        const data = await resp.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const candidates = items.map(item => {
            const info = item.volumeInfo || {};
            return {
                title: stripWechatPromptText(info.title || '', 80),
                author: Array.isArray(info.authors) ? stripWechatPromptText(info.authors.slice(0, 2).join(' / '), 80) : '',
                line: stripWechatPromptText(info.subtitle || info.description || COREAD_DAILY_LINES[Math.floor(Math.random() * COREAD_DAILY_LINES.length)], 72),
                tone: stripWechatPromptText((Array.isArray(info.categories) ? info.categories.slice(0, 2).join(' · ') : '') || seed, 42),
                volume: `VOL.${String(new Date().getDate()).padStart(2, '0')}`,
                source: 'Google Books Daily',
                url: info.infoLink || item.selfLink || '',
                description: stripWechatPromptText(info.description || '', 520)
            };
        }).filter(item => item.title);
        const picked = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
        const book = picked || buildCoReadFallbackDaily();
        saveCoReadDailyCache({ date: today, book, updatedAt: Date.now() });
    } catch (e) {
        const fallback = buildCoReadFallbackDaily();
        const current = getCoReadDailyCache();
        if (!current.book || force) saveCoReadDailyCache({ date: today, book: fallback, updatedAt: Date.now() });
    } finally {
        coreadDailyLoading = false;
        renderCoReadDaily();
    }
}

function renderCoReadDaily() {
    const rec = getCoReadDailyRecommendation();
    const holiday = getCoReadHolidaySense();
    const volume = document.getElementById('coread-daily-volume');
    const title = document.getElementById('coread-daily-title');
    const line = document.getElementById('coread-daily-line');
    const card = document.getElementById('coread-daily-card');
    const participants = getCoReadDailyParticipants();
    const senseTitle = holiday ? holiday.title : '惊喜';
    const senseLine = holiday ? holiday.line : (rec.line || '你缺的有趣叫仪式感，赠你生活达人养成秘籍');
    if (volume) volume.textContent = rec.volume;
    if (title) title.textContent = holiday ? holiday.title : '今日惊喜书页';
    if (line) line.textContent = senseLine;
    if (card) {
        card.innerHTML = `
            <button type="button" class="coread-daily-book coread-sense-card${holiday ? ' is-holiday' : ''}" onclick="refreshCoReadDailyRecommendation(true)" aria-label="换一张今日惊喜书页">
                <span>${musicEscapeHtml(rec.volume || 'VOL.17')}</span>
                <b>SENSE</b>
                <i aria-hidden="true"></i>
                <em>${musicEscapeHtml(senseLine)}</em>
                <strong>${musicEscapeHtml(senseTitle)}</strong>
                <small>${musicEscapeHtml(holiday ? holiday.theme : `${participants}人 · 参与话题`)}</small>
            </button>
        `;
    }
}

function handleCoReadBack() {
    if (coreadActiveTab === 'reader' && coreadReaderPanelOpen) {
        closeCoReadReaderPanel();
        return false;
    }
    if (coreadActiveTab === 'reader' || coreadActiveTab === 'detail') {
        setCoReadTab('shelf');
        return false;
    }
    closeApp('coread');
    return false;
}
window.handleCoReadBack = handleCoReadBack;

function updateCoReadTopbar() {
    const topbar = document.querySelector('.coread-topbar');
    if (!topbar) return;
    const eyebrow = topbar.querySelector('span');
    const title = topbar.querySelector('strong');
    const rightBtn = topbar.querySelector('button:last-child');
    const backBtn = topbar.querySelector('button:first-child');
    const backIcon = topbar.querySelector('button:first-child i');
    if (backBtn) {
        const returnsToReading = coreadActiveTab === 'reader' && coreadReaderPanelOpen;
        const returnsToShelf = coreadActiveTab === 'reader' || coreadActiveTab === 'detail';
        backBtn.setAttribute('onclick', 'return handleCoReadBack()');
        backBtn.setAttribute('aria-label', returnsToReading ? '返回阅读' : (returnsToShelf ? '返回书架' : '返回'));
    }
    const tabs = {
        discover: { title: '发现', icon: 'ri-more-fill', onclick: "setCoReadTab('shelf')", aria: '去书架' },
        shelf: { title: '书架', icon: 'ri-more-fill', onclick: "toggleCoReadShelfMenu()", aria: '书架工具' },
        detail: { title: '书页', icon: 'ri-book-open-line', onclick: "startCoReadBook()", aria: '开始阅读' },
        thoughts: { title: '想法', icon: 'ri-more-fill', onclick: "setCoReadTab('shelf')", aria: '去书架' },
        me: { title: '我', icon: 'ri-more-fill', onclick: "setCoReadTab('shelf')", aria: '去书架' }
    };
    const config = tabs[coreadActiveTab];
    topbar.classList.toggle('coread-ios-topbar', !!config);
    topbar.classList.toggle('coread-reader-topbar', coreadActiveTab === 'reader');
    if (coreadActiveTab === 'reader') {
        if (eyebrow) eyebrow.textContent = '';
        if (title) title.textContent = '';
        if (rightBtn) {
            rightBtn.classList.remove('coread-topbar-text-btn');
            rightBtn.innerHTML = '<i class="ri-chat-quote-line"></i>';
            rightBtn.setAttribute('onclick', 'openCoReadCommentPanel()');
            rightBtn.setAttribute('aria-label', '打开 char 共读气泡');
        }
        if (backIcon) backIcon.className = 'ri-arrow-left-s-line';
        return;
    }
    if (!config) {
        if (eyebrow) eyebrow.textContent = 'SHARED READING';
        if (title) title.textContent = '和 char 共读小说';
        if (rightBtn) {
            rightBtn.classList.remove('coread-topbar-text-btn');
            rightBtn.innerHTML = '<i class="ri-chat-quote-line"></i>';
            rightBtn.setAttribute('onclick', 'openCoReadCommentPanel()');
            rightBtn.setAttribute('aria-label', '打开 char 共读气泡');
        }
        if (backIcon) backIcon.className = 'ri-arrow-left-s-line';
        return;
    }
    if (eyebrow) eyebrow.textContent = '';
    if (title) title.textContent = config.title;
    if (rightBtn) {
        rightBtn.classList.remove('coread-topbar-text-btn');
        rightBtn.innerHTML = `<i class="${config.icon || 'ri-more-fill'}"></i>`;
        rightBtn.setAttribute('onclick', config.onclick);
        rightBtn.setAttribute('aria-label', config.aria || config.title);
    }
    if (backIcon) backIcon.className = 'ri-arrow-left-s-line';
}

function renderCoReadApp() {
    const list = document.getElementById('coread-book-list');
    const chars = document.getElementById('coread-char-list');
    const status = document.getElementById('coread-status');
    const library = getCoReadLibrary();
    const isReader = coreadActiveTab === 'reader';
    if (coreadActiveTab !== 'shelf') {
        coreadShelfMenuOpen = false;
        coreadShelfToolPanel = '';
    }
    if (!isReader) {
        coreadTocOpen = false;
        coreadSettingsOpen = false;
        coreadCommentPanelOpen = false;
    }
    if (!coreadActiveBookId && library[0]) coreadActiveBookId = library[0].id;
    if (!coreadActiveCharId && getCoReadCharacters()[0]) coreadActiveCharId = getCoReadCharacters()[0].id;
    if (!isReader) {
        const shelfBooks = getCoReadShelfBooks(library);
        if (list) list.innerHTML = shelfBooks.map(renderCoReadBookCard).join('') || `<div class="coread-empty">${library.length ? '这个分类下暂时没有书。' : '还没有书'}</div>`;
        if (chars) chars.innerHTML = renderCoReadCharOptions();
        if (status) status.textContent = coreadBusy ? '正在听 char 读这一页' : (coreadShelfStatusText || '内置书城优先，公开书目备用。');
    }
    const content = document.querySelector('.coread-content');
    if (content) content.dataset.tab = coreadActiveTab;
    const shell = document.querySelector('.coread-shell');
    if (shell) {
        shell.classList.toggle('coread-reader-mode', isReader);
        shell.classList.toggle('coread-reader-panel-open', isReader && coreadReaderPanelOpen);
    }
    applyCoReadShelfSettings();
    renderCoReadShelfTabs(library);
    renderCoReadShelfMenu();
    syncCoReadShelfMenuState();
    applyCoReadReaderSettings();
    updateCoReadTopbar();
    const backBtn = document.querySelector('.coread-topbar button:first-child');
    if (backBtn) {
        const returnsToReading = isReader && coreadReaderPanelOpen;
        const returnsToShelf = isReader || coreadActiveTab === 'detail';
        backBtn.setAttribute('onclick', 'return handleCoReadBack()');
        backBtn.setAttribute('aria-label', returnsToReading ? '返回阅读' : (returnsToShelf ? '返回书架' : '返回'));
    }
    document.querySelectorAll('.coread-bottom-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.coreadTab === coreadActiveTab);
    });
    if (isReader) {
        renderCoReadReader();
        renderCoReadToc();
        renderCoReadSettings();
        renderCoReadCommentPanel();
    } else {
        syncCoReadTocDrawerState();
        syncCoReadSettingsDrawerState();
        renderCoReadCommentPanel();
        if (coreadActiveTab === 'discover') renderCoReadDaily();
        if (coreadActiveTab === 'shelf') renderCoReadDashboard();
        if (coreadActiveTab === 'detail') renderCoReadBookDetail();
        if (coreadActiveTab === 'thoughts') renderCoReadThoughts();
        if (coreadActiveTab === 'me') {
            renderCoReadMePanel();
            renderCoReadCalendarStats();
        }
        if (coreadActiveTab === 'discover' || coreadActiveTab === 'shelf') renderCoReadSourceManager();
    }
    let currentLibrary = library;
    const stuck = currentLibrary.find(book => book && book.url && book.resolving && Number(book.resolveVersion || 0) < COREAD_RESOLVE_VERSION && !coreadResolvingBookIds.has(book.id));
    if (stuck) {
        stuck.resolving = false;
        stuck.resolveStatus = '等待重新解析正文';
        saveCoReadLibrary(currentLibrary);
        currentLibrary = getCoReadLibrary();
    }
    const expandable = currentLibrary.find(book => book.id === coreadActiveBookId && shouldResolveCoReadBookContent(book))
        || currentLibrary.find(book => shouldResolveCoReadBookContent(book));
    if (expandable) {
        setTimeout(() => resolveCoReadBookContent(expandable.id), 0);
    }
}

function initCoReadApp() {
    bindCoReadFastSettingsControls();
    renderCoReadApp();
    maybeLoadCoReadDiscoveryData();
}
window.initCoReadApp = initCoReadApp;

function maybeLoadCoReadDiscoveryData() {
    if (coreadDiscoveryLoadStarted || (coreadActiveTab !== 'discover' && coreadActiveTab !== 'shelf')) return;
    coreadDiscoveryLoadStarted = true;
    setTimeout(() => {
        refreshCoReadDailyRecommendation(false);
        loadCoReadBuiltinSources(false).then(() => {
            if (coreadActiveTab === 'discover' || coreadActiveTab === 'shelf') renderCoReadSourceManager();
        });
    }, 0);
}

function selectCoReadBook(bookId) {
    if (coreadShelfSelectionMode) {
        toggleCoReadShelfBookSelected(bookId);
        return;
    }
    coreadActiveBookId = bookId || '';
    coreadActiveTab = 'detail';
    renderCoReadApp();
}
window.selectCoReadBook = selectCoReadBook;

function selectCoReadChar(charId) {
    coreadActiveCharId = charId || '';
    coreadMateDropdownOpen = false;
    renderCoReadApp();
}
window.selectCoReadChar = selectCoReadChar;

function setCoReadTab(tab) {
    coreadActiveTab = tab || 'discover';
    if (coreadActiveTab !== 'shelf') {
        coreadShelfMenuOpen = false;
        coreadShelfToolPanel = '';
    }
    const content = document.querySelector('.coread-content');
    if (content) content.dataset.tab = coreadActiveTab;
    renderCoReadApp();
    maybeLoadCoReadDiscoveryData();
}
window.setCoReadTab = setCoReadTab;

function closeCoReadReader() {
    setCoReadTab('shelf');
}
window.closeCoReadReader = closeCoReadReader;

function addCoReadRecommendedBook() {
    const rec = getCoReadDailyRecommendation();
    addCoReadBook({
        title: rec.title,
        author: rec.author,
        source: 'daily',
        url: rec.url || '',
        description: rec.description || rec.line || '',
        content: `每日推荐：${rec.title}\n作者：${rec.author || '未知'}\n来源：${rec.source || '每日推荐'} ${rec.url || ''}\n\n${rec.description || rec.line || '可以先加入书架，再导入 txt/md 正文开始共读。'}`
    });
}
window.addCoReadRecommendedBook = addCoReadRecommendedBook;

function addCoReadBook(book) {
    const library = getCoReadLibrary();
    const safe = {
        id: book.id || `book_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: String(book.title || '未命名书籍').slice(0, 120),
        author: String(book.author || '').slice(0, 120),
        source: String(book.source || 'local'),
        url: String(book.url || ''),
        coverUrl: normalizeCoReadCoverUrl(book.coverUrl || ''),
        rating: Math.max(0, Math.min(5, Number(book.rating || 0))),
        sourceData: book.sourceData || null,
        chapters: Array.isArray(book.chapters) ? book.chapters.slice(0, 360) : [],
        content: String(book.content || ''),
        description: String(book.description || ''),
        category: String(book.category || book.categoryId || '').trim().slice(0, 28),
        tags: Array.isArray(book.tags) ? book.tags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 12) : [],
        resolving: false,
        resolveStatus: book.url && !isCoReadUsefulContent(book.content || '') ? '等待解析正文' : '',
        resolveVersion: book.url && isCoReadUsefulContent(book.content || '') ? COREAD_RESOLVE_VERSION : 0,
        resolveMetaVersion: book.url && isCoReadUrlTitle(book.title || '') ? 0 : COREAD_META_VERSION,
        resolveChapterVersion: Array.isArray(book.chapters) && book.chapters.length ? COREAD_CHAPTER_VERSION : 0,
        page: 0,
        createdAt: Date.now()
    };
    library.unshift(safe);
    saveCoReadLibrary(library);
    coreadActiveBookId = safe.id;
    coreadActiveTab = 'reader';
    renderCoReadApp();
    if (!safe.coverUrl && !isCoReadUrlTitle(safe.title)) ensureCoReadBookCover(safe.id);
    if (shouldResolveCoReadBookContent(safe)) resolveCoReadBookContent(safe.id);
}

function cleanCoReadReadableText(text) {
    return String(text || '')
        .replace(/\r/g, '\n')
        .replace(/[-]/g, ch => COREAD_OBFUSCATED_TEXT_MAP[ch] || ch)
        .replace(/……?（?内容加载失败！?）?[\s\S]*$/g, '')
        .replace(/抱歉，章节内容不支持该浏览器显示[\s\S]*$/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>|<\/div>|<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

function collectCoReadJsonTexts(value, out = []) {
    if (value == null) return out;
    if (typeof value === 'string') {
        const text = cleanCoReadReadableText(value);
        if (text.length > 180) out.push(text);
        return out;
    }
    if (Array.isArray(value)) {
        value.forEach(item => collectCoReadJsonTexts(item, out));
        return out;
    }
    if (typeof value === 'object') {
        const preferred = ['content', 'chapterContent', 'bookContent', 'text', 'body', 'html', 'data'];
        preferred.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(value, key)) collectCoReadJsonTexts(value[key], out);
        });
        Object.keys(value).forEach(key => {
            if (!preferred.includes(key)) collectCoReadJsonTexts(value[key], out);
        });
    }
    return out;
}

function extractCoReadTextFromJson(raw) {
    try {
        const data = JSON.parse(String(raw || '').replace(/^\uFEFF/, ''));
        const pieces = collectCoReadJsonTexts(data)
            .filter(text => !/^https?:\/\//i.test(text) && !/^\d+$/.test(text))
            .sort((a, b) => b.length - a.length);
        return pieces.slice(0, 8).join('\n\n');
    } catch (_) {
        return '';
    }
}

function cleanCoReadBookTitle(title) {
    let text = cleanCoReadReadableText(title).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    text = text
        .replace(/^Title:\s*/i, '')
        .replace(/(?:最新章节|小说全文|全文阅读|无弹窗|免费阅读|章节目录|在线阅读|小说网|镇魂小说网).*$/i, '')
        .replace(/[（(][^）)]{1,40}[）)]/g, '')
        .split(/[_｜|]/)[0]
        .replace(/\s*[-—]\s*(?:小说|小说网|在线阅读|全文阅读).*$/i, '')
        .replace(/小说$/i, '')
        .replace(/^www\.[^\s/]+.*$/i, '')
        .trim();
    return text.length > 1 ? text.slice(0, 80) : '';
}

function cleanCoReadBookAuthor(author) {
    let text = cleanCoReadReadableText(author).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    text = text
        .replace(/^作者\s*[:：]?\s*/i, '')
        .replace(/\s*(?:著|作者|写的|作品).*$/i, '')
        .replace(/[|｜_].*$/g, '')
        .trim();
    return text && !/^https?:\/\//i.test(text) ? text.slice(0, 60) : '';
}

function isCoReadUrlTitle(title) {
    const text = String(title || '').trim();
    return !text || /^https?:\/\//i.test(text) || /^www\./i.test(text) || /^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(text);
}

function extractCoReadMetadataFromHtml(raw, baseUrl = '') {
    const text = String(raw || '');
    const meta = { title: '', author: '', coverUrl: '' };
    const jinaTitle = text.match(/^\s*Title:\s*([^\n]+)/i);
    const titleAuthor = jinaTitle && jinaTitle[1].match(/[（(]([^）)]{2,30})[）)]/);
    if (titleAuthor) meta.author = cleanCoReadBookAuthor(titleAuthor[1]);
    if (jinaTitle) meta.title = cleanCoReadBookTitle(jinaTitle[1]);
    const jinaMarkdownHead = text.match(/Markdown Content:\s*\n+\s*#\s*([^\n]+)/i);
    if (!meta.title && jinaMarkdownHead) meta.title = cleanCoReadBookTitle(jinaMarkdownHead[1]);
    try {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const readAttr = selector => doc.querySelector(selector)?.getAttribute('content') || '';
        const readText = selector => doc.querySelector(selector)?.textContent || '';
        meta.title = meta.title
            || cleanCoReadBookTitle(readAttr('meta[property="og:title"], meta[name="og:title"]'))
            || cleanCoReadBookTitle(readAttr('meta[name="twitter:title"]'))
            || cleanCoReadBookTitle(readText('h1, .book-title, .bookname, #info h1, .info h1, title'));
        meta.author = meta.author
            || cleanCoReadBookAuthor(readAttr('meta[name="author"], meta[property="book:author"], meta[property="article:author"]'))
            || cleanCoReadBookAuthor(readText('.author, .book-author, .writer, #info p, .info p'));
        const cover = readAttr('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"]')
            || doc.querySelector('.cover img, .book-cover img, #fmimg img, img.cover')?.getAttribute('src')
            || '';
        if (cover) {
            try {
                meta.coverUrl = normalizeCoReadCoverUrl(new URL(cover, baseUrl).href);
            } catch (_) {
                meta.coverUrl = normalizeCoReadCoverUrl(cover);
            }
        }
    } catch (_) {}
    const plain = cleanCoReadReadableText(text);
    if (!meta.author) {
        const authorMatch = plain.match(/(?:作者|作\s*者)\s*[:：]\s*([^\n\r《》_｜|]{1,40})/);
        if (authorMatch) meta.author = cleanCoReadBookAuthor(authorMatch[1]);
    }
    if (!meta.title) {
        const titleMatch = plain.match(/(?:书名|小说名)\s*[:：]\s*([^\n\r《》_｜|]{1,60})/);
        if (titleMatch) meta.title = cleanCoReadBookTitle(titleMatch[1]);
    }
    return meta;
}

function mergeCoReadMetadata(target, meta = {}) {
    if (!target || !meta) return;
    if (meta.title && (isCoReadUrlTitle(target.title) || target.source === 'url')) {
        target.title = meta.title;
        if (!target.coverUrl) target.coverResolving = false;
    }
    if (meta.author && (!target.author || target.author === '未知作者')) {
        target.author = meta.author;
    }
    if (meta.coverUrl && !target.coverUrl) {
        target.coverUrl = meta.coverUrl;
    }
}

function extractCoReadTextFromHtml(html, baseUrl = '') {
    const raw = String(html || '');
    if (/^\s*Title:\s*/i.test(raw) && /\n\n/.test(raw)) {
        return cleanCoReadReadableText(raw.replace(/^\s*Title:[^\n]*\n+(?:URL Source|URL):[^\n]*\n+(?:Published Time:[^\n]*\n+)?(?:Markdown Content:\n+)?/i, ''));
    }
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    doc.querySelectorAll('script,style,noscript,nav,header,footer,iframe,form,button,.nav,.header,.footer,.ads,.advertisement,.comment,.comments').forEach(node => node.remove());
    const selectors = [
        '.article-content', '#content', '.content', '.chapter-content', '.chapter_content', '.read-content',
        '.reader-content', '.article-content', '.book-content', '.novelcontent',
        '.txt', '.txtnav', '.entry-content', '.post-content', 'article', 'main'
    ];
    const candidates = selectors
        .flatMap(selector => Array.from(doc.querySelectorAll(selector)))
        .map(node => cleanCoReadReadableText(node.innerHTML || node.textContent || ''))
        .filter(text => text.length > 240);
    if (!candidates.length) {
        const bodyText = cleanCoReadReadableText(doc.body ? doc.body.innerHTML : raw);
        if (bodyText.length > 500) candidates.push(bodyText);
    }
    return candidates.sort((a, b) => b.length - a.length)[0] || '';
}

function extractCoReadChapterText(raw, url = '') {
    const jsonText = extractCoReadTextFromJson(raw);
    if (isCoReadUsefulContent(jsonText)) return jsonText;
    const htmlText = extractCoReadTextFromHtml(raw, url);
    if (isCoReadUsefulContent(htmlText)) return htmlText;
    try {
        const doc = new DOMParser().parseFromString(String(raw || ''), 'text/html');
        const article = doc.querySelector('article.article-content, .article-content, .entry-content, .post-content');
        const text = cleanCoReadReadableText(article ? (article.innerHTML || article.textContent || '') : '');
        if (isCoReadUsefulContent(text)) return text;
    } catch (_) {}
    return htmlText || jsonText || '';
}

function findCoReadContinuationLinks(html, baseUrl = '') {
    const raw = String(html || '');
    const links = [];
    const seen = new Set();
    const add = href => {
        if (!href || /javascript:|#|mailto:/i.test(href)) return;
        try {
            const url = new URL(href, baseUrl).href;
            if (!seen.has(url)) {
                seen.add(url);
                links.push(url);
            }
        } catch (_) {}
    };
    const nextFromScript = raw.match(/t2018_1\s*:\s*['"]([^'"]+)['"]/);
    if (nextFromScript) add(nextFromScript[1]);
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    Array.from(doc.querySelectorAll('a[href]')).forEach(a => {
        const label = cleanCoReadReadableText(a.textContent || '');
        const href = a.getAttribute('href') || '';
        if (/下一页|下一章|下页|下章|继续阅读/i.test(label)) add(href);
    });
    return links;
}

function findCoReadChapterLinks(html, baseUrl = '') {
    const raw = String(html || '');
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const links = [];
    const seen = new Set();
    const add = (title, href) => {
        if (!href || /javascript:|#|mailto:/i.test(href)) return;
        try {
            const url = normalizeCoReadChapterUrl(href, baseUrl);
            if (!seen.has(url)) {
                seen.add(url);
                links.push({ title: title || '正文', url });
            }
        } catch (_) {}
    };
    Array.from(doc.querySelectorAll('a[href]')).forEach(a => {
        const label = cleanCoReadReadableText(a.textContent || '');
        const href = a.getAttribute('href') || '';
        const looksChapter = /第\s*[一二三四五六七八九十百千万零〇\d]+\s*[章节回卷]|第.{1,16}[章节回卷]|chapter|正文|目录|阅读|最新章/i.test(label)
            || (/chapter|read|book|novel|\/\d+\.html|\/\d+\/?$/i.test(href) && !/简介|介绍|作者|评论|目录/.test(label));
        if (looksChapter) add(label, href);
    });
    Array.from(raw.matchAll(/\[([^\]]*第\s*[一二三四五六七八九十百千万零〇\d]+\s*[章节回卷][^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+["'][^"']*["'])?\)/g))
        .forEach(match => add(cleanCoReadReadableText(match[1]), match[2]));
    return links.slice(0, 360).map((chapter, index) => ({
        title: cleanCoReadReadableText(chapter.title).replace(/\s+/g, ' ').slice(0, 88) || `第 ${index + 1} 章`,
        url: chapter.url,
        page: getCoReadChapterPage(chapter)
    }));
}

async function extractCoReadReadableContent(url, title = '') {
    const rawUrl = String(url || '').trim();
    const result = { content: '', meta: {}, chapters: [] };
    if (!/^https?:\/\//i.test(rawUrl)) return result;
    const first = await coReadFetchText(rawUrl, { timeoutMs: 6500, quiet: true });
    result.meta = extractCoReadMetadataFromHtml(first, rawUrl);
    const jsonText = extractCoReadTextFromJson(first);
    if (isCoReadUsefulContent(jsonText) && !isCoReadLikelyDirectoryContent(jsonText)) {
        result.content = jsonText;
        return result;
    }
    const chapters = findCoReadChapterLinks(first, rawUrl);
    result.chapters = chapters;
    if (chapters.length >= 3) {
        const picked = [];
        for (const chapter of chapters.slice(0, 3)) {
            try {
                const chapterRaw = await coReadFetchText(chapter.url, { timeoutMs: 12000, quiet: true });
                const chapterText = extractCoReadChapterText(chapterRaw, chapter.url);
                if (isCoReadUsefulContent(chapterText)) {
                    chapter.page = Math.max(0, Math.floor(picked.join('\n\n').length / COREAD_PAGE_SIZE));
                    picked.push(`${chapter.title || title || '章节'}\n\n${chapterText}`);
                }
            } catch (_) {}
            if (picked.join('\n\n').length > 7000) break;
        }
        if (picked.length) {
            result.content = picked.join('\n\n');
            return result;
        }
    }
    const pageText = extractCoReadTextFromHtml(first, rawUrl);
    if (isCoReadUsefulContent(pageText) && !isCoReadLikelyDirectoryContent(pageText) && !/目录|最新章节|全部章节/.test(pageText.slice(0, 500))) {
        const pieces = [pageText];
        const seen = new Set([rawUrl]);
        let nextUrl = findCoReadContinuationLinks(first, rawUrl).find(link => !seen.has(link));
        for (let i = 0; nextUrl && i < 3 && pieces.join('\n\n').length < 9000; i += 1) {
            seen.add(nextUrl);
            try {
                const nextRaw = await coReadFetchText(nextUrl, { timeoutMs: 12000, quiet: true });
                const nextText = extractCoReadChapterText(nextRaw, nextUrl);
                if (isCoReadUsefulContent(nextText) && !pieces.includes(nextText)) {
                    pieces.push(nextText);
                }
                nextUrl = findCoReadContinuationLinks(nextRaw, nextUrl).find(link => !seen.has(link));
            } catch (_) {
                nextUrl = '';
            }
        }
        result.content = pieces.join('\n\n');
        return result;
    }
    const picked = [];
    for (const chapter of chapters.slice(0, 4)) {
        try {
            const chapterRaw = await coReadFetchText(chapter.url, { timeoutMs: 12000, quiet: true });
            const chapterText = extractCoReadChapterText(chapterRaw, chapter.url);
            if (chapterText && chapterText.length > 260) {
                chapter.page = Math.max(0, Math.floor(picked.join('\n\n').length / COREAD_PAGE_SIZE));
                picked.push(`${chapter.title || title || '章节'}\n\n${chapterText}`);
            }
        } catch (_) {}
        if (picked.join('\n\n').length > 5200) break;
    }
    result.content = picked.join('\n\n') || (pageText.length > 500 ? pageText : '');
    return result;
}

async function resolveCoReadBookContent(bookId) {
    const id = String(bookId || '');
    if (!id) return;
    if (coreadResolvingBookIds.has(id)) return;
    let library = getCoReadLibrary();
    let book = library.find(item => item.id === id);
    if (!shouldResolveCoReadBookContent(book)) return;
    coreadResolvingBookIds.add(id);
    book.resolving = true;
    book.resolveStatus = isCoReadUsefulContent(book.content) ? '正在扩展正文' : '正在解析正文';
    saveCoReadLibrary(library);
    renderCoReadApp();
    try {
        const parsed = await extractCoReadReadableContent(book.url, book.title);
        const text = typeof parsed === 'string' ? parsed : String(parsed && parsed.content || '');
        library = getCoReadLibrary();
        book = library.find(item => item.id === id);
        if (!book) return;
        mergeCoReadMetadata(book, parsed && parsed.meta);
        book.resolveMetaVersion = COREAD_META_VERSION;
        if (parsed && Array.isArray(parsed.chapters)) {
            book.chapters = parsed.chapters.slice(0, 360);
        }
        book.resolveChapterVersion = COREAD_CHAPTER_VERSION;
        if (isCoReadUsefulContent(text)) {
            book.content = text.slice(0, 120000);
            book.description = book.description || text.slice(0, 240);
            book.resolveStatus = '正文已解析';
            book.resolveVersion = COREAD_RESOLVE_VERSION;
        } else {
            book.resolveStatus = '未解析到正文，可导入 txt/md';
            book.resolveVersion = COREAD_RESOLVE_VERSION;
        }
        book.resolving = false;
        saveCoReadLibrary(library);
        if (!book.coverUrl) ensureCoReadBookCover(book.id);
    } catch (_) {
        library = getCoReadLibrary();
        book = library.find(item => item.id === id);
        if (book) {
            book.resolving = false;
            book.resolveStatus = '解析失败，可导入 txt/md';
            book.resolveVersion = COREAD_RESOLVE_VERSION;
            book.resolveMetaVersion = COREAD_META_VERSION;
            book.resolveChapterVersion = COREAD_CHAPTER_VERSION;
            saveCoReadLibrary(library);
        }
    } finally {
        coreadResolvingBookIds.delete(id);
    }
    renderCoReadApp();
}
window.resolveCoReadBookContent = resolveCoReadBookContent;

async function readCoReadFileAsBook(file) {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const asText = ['txt', 'md', 'markdown', 'json', 'csv'].includes(ext) || /^text\//i.test(file.type || '');
    const content = asText
        ? await file.text()
        : `已加入书架：${file.name}\n\n当前浏览器静态版只直接抽取 txt/md 正文。doc/docx/pdf 可以先加入书架记录来源；如需逐页共读，请转成 txt 后导入，或粘贴可访问的正文链接。`;
    const textFromJson = ext === 'json' ? extractCoReadTextFromJson(content) : '';
    return {
        title: file.name.replace(/\.[^.]+$/, ''),
        author: '',
        source: asText ? 'file' : ext || 'file',
        content: textFromJson || content,
        category: getCoReadActiveShelfCategoryName()
    };
}

async function importCoReadFiles(files, options = {}) {
    const picked = Array.from(files || []).filter(file => file && file.name && !/^\./.test(file.name));
    if (!picked.length) return;
    const library = getCoReadLibrary();
    const books = [];
    for (const file of picked.slice(0, 80)) {
        try {
            const book = await readCoReadFileAsBook(file);
            if (book) {
                books.push({
                    id: `book_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    title: String(book.title || '未命名书籍').slice(0, 120),
                    author: String(book.author || '').slice(0, 120),
                    source: String(book.source || 'file'),
                    url: '',
                    coverUrl: '',
                    rating: 0,
                    sourceData: null,
                    chapters: [],
                    content: String(book.content || ''),
                    description: '',
                    category: String(book.category || '').trim().slice(0, 28),
                    tags: options.smart ? ['智能导入'] : [],
                    resolving: false,
                    resolveStatus: '',
                    resolveVersion: COREAD_RESOLVE_VERSION,
                    resolveMetaVersion: COREAD_META_VERSION,
                    resolveChapterVersion: 0,
                    page: 0,
                    createdAt: Date.now()
                });
            }
        } catch (e) {
            console.warn('import coread file failed:', file.name, e);
        }
    }
    if (!books.length) {
        showCoReadShelfToast('没有读到可导入的文件');
        return;
    }
    saveCoReadLibrary([...books, ...library].slice(0, 80));
    coreadActiveBookId = books[0].id;
    coreadActiveTab = 'shelf';
    showCoReadShelfToast(`已导入 ${books.length} 本书`);
    renderCoReadApp();
}
window.importCoReadFiles = importCoReadFiles;

async function importCoReadFile(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const book = await readCoReadFileAsBook(file);
    addCoReadBook(book);
    input.value = '';
}
window.importCoReadFile = importCoReadFile;

async function addCoReadUrl() {
    const input = document.getElementById('coread-url-input');
    const url = String(input && input.value || '').trim();
    if (!url) return;
    if (/\.json(?:\?|#|$)|booksource|shuyuan|booksources|legado/i.test(url)) {
        try {
            const count = await importCoReadSourcesFromUrl(url);
            if (input) input.value = '';
            setCoReadTab('discover');
            const panel = document.getElementById('coread-source-manager');
            if (panel) panel.classList.remove('hidden');
            setCoReadSourceStatus(count ? `已从链接导入 ${count} 个书源` : '链接已读取，但没有解析到书源');
            return;
        } catch (e) {
            setCoReadSourceStatus('链接不是可解析书源，按普通书籍链接加入书架');
        }
    }
    addCoReadBook({
        title: url.replace(/^https?:\/\//, '').slice(0, 80),
        source: 'url',
        url,
        content: `来源链接：${url}\n\n如果这是可公开访问的正文链接，请把正文复制为 txt 导入；char 评论会基于标题、链接和当前可见文本生成。`
    });
    input.value = '';
}
window.addCoReadUrl = addCoReadUrl;

function buildCoReadSourceSearchRequest(source, query) {
    const raw = String(source.searchUrl || '').trim();
    if (!raw) return null;
    let path = raw;
    let options = {};
    const comma = raw.indexOf(',{');
    if (comma > 0) {
        path = raw.slice(0, comma);
        const escapedQuery = JSON.stringify(query).slice(1, -1);
        const optionText = raw.slice(comma + 1)
            .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, text) => JSON.stringify(text.replace(/\\'/g, "'")))
            .replace(/(:\s*)\{\{key\}\}/g, `$1${JSON.stringify(query)}`)
            .replace(/(:\s*)\{\{page\}\}/g, (_, prefix) => `${prefix}1`)
            .replace(/\{\{key\}\}/g, escapedQuery)
            .replace(/\{\{page\}\}/g, '1');
        try {
            options = JSON.parse(optionText);
        } catch (_) {
            options = {};
        }
    }
    path = path
        .replace(/\{\{key\}\}/g, encodeURIComponent(query))
        .replace(/\{\{page\}\}/g, '1');
    const url = /^https?:\/\//i.test(path)
        ? path
        : new URL(path || '/', source.bookSourceUrl).href;
    const method = String(options.method || options.Method || 'GET').toUpperCase();
    const body = options.body
        ? (typeof options.body === 'string'
            ? options.body.replace(/\{\{key\}\}/g, query)
            : JSON.stringify(options.body).replace(/\{\{key\}\}/g, query))
        : undefined;
    const headers = {
        ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
        'Content-Type': body && /^\s*[\[{]/.test(body) ? 'application/json' : 'application/x-www-form-urlencoded'
    };
    return {
        url,
        options: method === 'GET' ? {} : {
            method,
            headers,
            body
        }
    };
}

function applyCoReadLegadoReplace(value, rule) {
    let text = String(value == null ? '' : value).trim();
    const parts = String(rule || '').split('##');
    if (parts.length >= 3) {
        try {
            text = text.replace(new RegExp(parts[1], 'g'), parts[2].replace(/###$/g, ''));
        } catch (_) {}
    } else if (parts.length === 2) {
        try {
            text = text.replace(new RegExp(parts[1], 'g'), '');
        } catch (_) {}
    }
    return text.replace(/\s+/g, ' ').trim();
}

function readCoReadJsonPath(data, path) {
    let clean = String(path || '').split('##')[0].split('&&')[0].split('@')[0].trim();
    if (!clean) return data;
    if (clean.startsWith('$..')) {
        const key = clean.slice(3).replace(/\[\*\]$/g, '');
        const found = [];
        const walk = value => {
            if (!value || typeof value !== 'object') return;
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const item = value[key];
                if (Array.isArray(item)) found.push(...item);
                else found.push(item);
            }
            Object.values(value).forEach(walk);
        };
        walk(data);
        return found;
    }
    clean = clean
        .replace(/^\$\./, '')
        .replace(/^\$/, '')
        .replace(/\[(\d+)\]/g, '.$1')
        .replace(/\[\*\]/g, '.*');
    if (!clean) return data;
    return clean.split('.').filter(Boolean).reduce((value, key) => {
        if (Array.isArray(value)) {
            if (key === '*') return value.flatMap(item => Array.isArray(item) ? item : [item]);
            if (/^\d+$/.test(key)) return value[Number(key)] != null ? value[Number(key)] : '';
            return value.flatMap(item => item && item[key] != null ? item[key] : []);
        }
        if (key === '*') return value && typeof value === 'object' ? Object.values(value) : [];
        return value && value[key] != null ? value[key] : '';
    }, data);
}

function readCoReadJsonRule(item, rule, baseUrl = '') {
    if (!rule) return '';
    const parts = String(rule).split('||');
    for (const part of parts) {
        let text = String(part || '').trim();
        const readTemplate = path => {
            let clean = String(path || '').trim();
            clean = clean.replace(/^book\./, '$.');
            if (!clean.startsWith('$')) clean = `$.${clean}`;
            const value = readCoReadJsonPath(item, clean);
            return Array.isArray(value) ? value.join(' ') : String(value == null ? '' : value);
        };
        text = text
            .replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path) => readTemplate(path))
            .replace(/\{\s*(\$[.$][^}]+)\s*\}/g, (_, path) => readTemplate(path));
        let value = '';
        if (text.startsWith('$.') || text.startsWith('$..') || text === '$') {
            const raw = readCoReadJsonPath(item, text);
            value = Array.isArray(raw) ? raw.join(' ') : String(raw == null ? '' : raw);
        } else if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\]|\[\*\])*$/.test(text)) {
            const raw = readCoReadJsonPath(item, text);
            value = Array.isArray(raw) ? raw.join(' ') : String(raw == null ? '' : raw);
        } else {
            value = text;
        }
        value = applyCoReadLegadoReplace(value, part);
        if ((/^\/(?!\/)/.test(value) || value.startsWith('./') || value.startsWith('../')) && baseUrl) {
            try { value = new URL(value, baseUrl).href; } catch (_) {}
        }
        if (value) return value;
    }
    return '';
}

function parseCoReadRulePart(rule) {
    const clean = String(rule || '').split('##')[0].split('&&')[0].trim();
    const at = clean.lastIndexOf('@');
    if (at < 0) return { selector: clean, attr: 'text' };
    const attr = clean.slice(at + 1).trim() || 'text';
    const isAttr = /^(text|textNodes|ownText|html|href|src|data-original|_src|title|alt|content|value|all)$/i.test(attr);
    return isAttr
        ? { selector: clean.slice(0, at).trim(), attr }
        : { selector: clean, attr: 'text' };
}

function normalizeCoReadLegadoSelector(selector) {
    return String(selector || '').split('@').map(part => {
        let clean = part.trim();
        clean = clean.replace(/^tag\./, '');
        clean = clean.replace(/^id\.([^\s>+~.#:[\]]+)/, '#$1');
        clean = clean.replace(/^class\.([^\s>+~:[\]]+(?:\s+[^\s>+~:[\]]+)*)/, (_, names) => {
            return String(names || '').trim().split(/\s+/).filter(Boolean).map(name => `.${name}`).join('');
        });
        clean = clean.replace(/(^|[\s>+~])tag\./g, '$1');
        clean = clean.replace(/(^|[\s>+~])id\.([^\s>+~.#:[\]]+)/g, '$1#$2');
        clean = clean.replace(/(^|[\s>+~])class\.([^\s>+~.#:[\]]+)/g, '$1.$2');
        return clean;
    }).filter(Boolean).join(' ');
}

function selectCoReadRuleNodes(root, selector) {
    let clean = String(selector || '').trim();
    if (!clean) return [root];
    if (clean.includes('||')) {
        const seen = new Set();
        return clean.split('||').flatMap(part => selectCoReadRuleNodes(root, part)).filter(node => {
            if (!node || seen.has(node)) return false;
            seen.add(node);
            return true;
        });
    }
    if (clean.startsWith('-')) clean = clean.slice(1).trim();
    clean = normalizeCoReadLegadoSelector(clean);
    let index = null;
    clean = clean.replace(/\.(-?\d+)(?::[-\d]+)*$/g, (_, n) => {
        index = Number(n);
        return '';
    });
    let nodes = [];
    try {
        nodes = Array.from(root.querySelectorAll(clean || '*'));
    } catch (_) {
        nodes = [];
    }
    if (index != null) {
        const picked = index < 0 ? nodes[nodes.length + index] : nodes[index];
        return picked ? [picked] : [];
    }
    return nodes;
}

function readCoReadRule(root, rule, baseUrl = '') {
    if (!rule) return '';
    const parts = String(rule).split('||');
    for (const part of parts) {
        const { selector, attr } = parseCoReadRulePart(part);
        const nodes = selectCoReadRuleNodes(root, selector);
        const values = nodes.map(node => {
            if (!node) return '';
            if (attr === 'text' || attr === 'textNodes' || attr === 'ownText') return node.textContent || '';
            if (attr === 'html') return node.innerHTML || '';
            const value = node.getAttribute(attr) || '';
            if ((attr === 'href' || attr === 'src' || attr === 'data-original' || attr === '_src') && value && baseUrl) {
                try { return new URL(value, baseUrl).href; } catch (_) {}
            }
            return value;
        }).filter(Boolean);
        const value = applyCoReadLegadoReplace(values.join(' '), part);
        if (value) return value;
    }
    return '';
}

function parseCoReadSourceSearchHtml(html, source, query) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rule = source.ruleSearch || {};
    const listRule = rule.bookList || '';
    const roots = selectCoReadRuleNodes(doc, listRule).slice(0, 8);
    return roots.map(root => {
        const title = readCoReadRule(root, rule.name, source.bookSourceUrl);
        const bookUrl = readCoReadRule(root, rule.bookUrl, source.bookSourceUrl);
        if (!title && !bookUrl) return null;
        return {
            title: title || query,
            author: readCoReadRule(root, rule.author, source.bookSourceUrl),
            url: bookUrl,
            source: source.bookSourceName,
            sourceType: 'bookSource',
            description: readCoReadRule(root, rule.intro, source.bookSourceUrl),
            coverUrl: readCoReadRule(root, rule.coverUrl, source.bookSourceUrl),
            lastChapter: readCoReadRule(root, rule.lastChapter, source.bookSourceUrl),
            kind: readCoReadRule(root, rule.kind, source.bookSourceUrl),
            bookSourceUrl: source.bookSourceUrl
        };
    }).filter(Boolean);
}

function parseCoReadSourceSearchJson(text, source, query) {
    let data = null;
    try {
        data = JSON.parse(text.replace(/^\uFEFF/, ''));
    } catch (_) {
        return [];
    }
    const rule = source.ruleSearch || {};
    const listRule = String(rule.bookList || '');
    const candidates = listRule.split('||').map(part => readCoReadJsonPath(data, part)).filter(Boolean);
    const list = candidates.find(item => Array.isArray(item) && item.length) || (Array.isArray(data) ? data : []);
    return list.slice(0, 8).map(item => {
        const title = readCoReadJsonRule(item, rule.name, source.bookSourceUrl);
        const bookUrl = readCoReadJsonRule(item, rule.bookUrl, source.bookSourceUrl);
        if (!title && !bookUrl) return null;
        return {
            title: title || query,
            author: readCoReadJsonRule(item, rule.author, source.bookSourceUrl),
            url: bookUrl,
            source: source.bookSourceName,
            sourceType: 'bookSource',
            description: readCoReadJsonRule(item, rule.intro, source.bookSourceUrl),
            coverUrl: readCoReadJsonRule(item, rule.coverUrl, source.bookSourceUrl),
            lastChapter: readCoReadJsonRule(item, rule.lastChapter, source.bookSourceUrl),
            kind: readCoReadJsonRule(item, rule.kind, source.bookSourceUrl),
            bookSourceUrl: source.bookSourceUrl
        };
    }).filter(Boolean);
}

async function searchCoReadBookSources(query) {
    const sources = getCoReadSources()
        .filter(source => source && source.enabled !== false && source.ruleSearch && source.searchUrl)
        .sort((a, b) => {
            const aJson = /^\$|^[A-Za-z_$][\w$]*(?:\.|\[|$)/.test(String(a.ruleSearch?.bookList || '')) ? 0 : 1;
            const bJson = /^\$|^[A-Za-z_$][\w$]*(?:\.|\[|$)/.test(String(b.ruleSearch?.bookList || '')) ? 0 : 1;
            if (aJson !== bJson) return aJson - bJson;
            const aPost = /,\s*\{[\s\S]*method[\s\S]*POST/i.test(String(a.searchUrl || '')) ? 1 : 0;
            const bPost = /,\s*\{[\s\S]*method[\s\S]*POST/i.test(String(b.searchUrl || '')) ? 1 : 0;
            return aPost - bPost;
        })
        .slice(0, 18);
    if (!sources.length) return [];
    const results = [];
    for (let i = 0; i < sources.length && results.length < 12; i += 6) {
        const batch = sources.slice(i, i + 6);
        const settled = await Promise.allSettled(batch.map(async source => {
            try {
                const request = buildCoReadSourceSearchRequest(source, query);
                if (!request) return [];
                const html = await coReadFetchText(request.url, { ...(request.options || {}), timeoutMs: 4200, quiet: true });
                return /^\s*[\[{]/.test(html)
                    ? parseCoReadSourceSearchJson(html, source, query)
                    : parseCoReadSourceSearchHtml(html, source, query);
            } catch (e) {
                return [];
            }
        }));
        results.push(...settled.flatMap(item => item.status === 'fulfilled' && Array.isArray(item.value) ? item.value : []));
        if (results.length >= 4) break;
    }
    return results.slice(0, 12);
}

async function searchCoReadReadableWeb(query) {
    const rawQuery = String(query || '').trim();
    if (!rawQuery) return [];
    const url = `https://www.yodu.org/sa/all-${encodeURIComponent(rawQuery)}-1.html`;
    try {
        const raw = await coReadFetchText(`https://r.jina.ai/${url}`, { timeoutMs: 5200, quiet: true });
        if (!raw || !raw.includes(rawQuery)) return [];
        const startUrl = (raw.match(/开始阅读[\s\S]{0,180}?\]\((https?:\/\/www\.yodu\.org\/book\/[^)\s"]+)/) || [])[1]
            || (raw.match(/\]\((https?:\/\/www\.yodu\.org\/book\/\d+\/\d+\.html)[^)]*\)/) || [])[1];
        if (!startUrl) return [];
        const headings = Array.from(raw.matchAll(/^#\s+(.+)$/gm)).map(match => cleanCoReadReadableText(match[1]));
        const title = headings.find(item => item === rawQuery) || headings.find(item => item && !/全文在线阅读|有度中文网/.test(item)) || rawQuery;
        const author = cleanCoReadReadableText((raw.match(/\*\*\[([^\]]{1,80})\]\(https?:\/\/www\.yodu\.org\/authorarticle\//) || [])[1] || '');
        const coverUrl = (raw.match(/!\[[^\]]*?\]\((https?:\/\/www\.yodu\.org\/files\/article\/image\/[^)\s]+)/) || [])[1] || '';
        const bodyStart = raw.indexOf(author || title);
        const bodyEnd = raw.indexOf('开始阅读');
        const description = cleanCoReadReadableText(raw.slice(
            bodyStart >= 0 ? bodyStart : 0,
            bodyEnd > 0 ? bodyEnd : Math.min(raw.length, 6200)
        )).slice(0, 520);
        return [{
            title,
            author,
            url: startUrl,
            source: '有度中文网',
            sourceType: 'readableWeb',
            description,
            coverUrl,
            lastChapter: '从第一章开始',
            kind: '可解析正文'
        }];
    } catch (_) {
        return [];
    }
}

function parseCoReadZhenhunSearch(raw, query) {
    const rows = [];
    const seen = new Set();
    const add = (label, url, titleAttr = '') => {
        const cleanUrl = normalizeCoReadChapterUrl(url);
        if (!cleanUrl || !/zhenhunxiaoshuo\.com\/[^/?#]+\/?$/i.test(cleanUrl)) return;
        if (/\/(?:chunai|chunai\d+|yanqing|yanqing\d+|baihexiaoshuo|作者|chaxun|priest)\//i.test(cleanUrl)) return;
        const text = cleanCoReadReadableText(label || titleAttr || query).replace(/\s+/g, ' ').trim();
        if (!text || seen.has(cleanUrl)) return;
        seen.add(cleanUrl);
        const title = cleanCoReadBookTitle(titleAttr || text) || cleanCoReadBookTitle(text) || query;
        let author = '';
        const authorMatch = text.replace(title, '').match(/[\s　]+([^\s　]{2,12})$/);
        if (authorMatch && !/小说|全文|免费|阅读|镇魂/.test(authorMatch[1])) author = cleanCoReadBookAuthor(authorMatch[1]);
        rows.push({
            title,
            author,
            url: cleanUrl,
            source: '镇魂小说网',
            sourceType: 'readableWeb',
            description: text,
            coverUrl: '',
            lastChapter: '目录可解析',
            kind: '可解析正文'
        });
    };
    Array.from(String(raw || '').matchAll(/\[([^\]]{1,120})\]\((https?:\/\/www\.zhenhunxiaoshuo\.com\/[^)\s"]+)(?:\s+"([^"]+)")?\)/g))
        .forEach(match => add(match[1], match[2], match[3] || ''));
    Array.from(String(raw || '').matchAll(/<a\b[^>]*href=["'](https?:\/\/www\.zhenhunxiaoshuo\.com\/[^"']+)["'][^>]*>([\s\S]{1,180}?)<\/a>/gi))
        .forEach(match => add(match[2].replace(/<[^>]+>/g, ' '), match[1], ''));
    return rows.filter(item => {
        const haystack = `${item.title} ${item.author} ${item.description}`.toLowerCase();
        return haystack.includes(String(query || '').toLowerCase()) || rows.length <= 4;
    }).slice(0, 10);
}

function getCoReadZhenhunKnownResults(query) {
    const rawQuery = String(query || '').trim();
    if (!rawQuery) return [];
    const known = [
        { title: '魔道祖师', author: '墨香铜臭', slug: 'modaozushi' },
        { title: '天官赐福', author: '墨香铜臭', slug: 'tianguancifu' },
        { title: '人渣反派自救系统', author: '墨香铜臭', slug: 'renzhafanpaizijiuxitong' }
    ];
    return known.filter(book => `${book.title} ${book.author}`.includes(rawQuery) || rawQuery.includes(book.title) || rawQuery.includes(book.author))
        .map(book => ({
            title: book.title,
            author: book.author,
            url: `https://www.zhenhunxiaoshuo.com/${book.slug}/`,
            source: '镇魂小说网',
            sourceType: 'readableWeb',
            description: `${book.author}作品，目录可解析。`,
            coverUrl: '',
            lastChapter: '目录可解析',
            kind: '可解析正文'
        }));
}

async function searchCoReadZhenhun(query) {
    const rawQuery = String(query || '').trim();
    if (!rawQuery) return [];
    const knownResults = getCoReadZhenhunKnownResults(rawQuery);
    if (knownResults.length) return knownResults;
    const candidates = [
        { url: `https://www.zhenhunxiaoshuo.com/${encodeURIComponent(rawQuery)}/`, authorPage: true },
        { url: `https://www.zhenhunxiaoshuo.com/?s=${encodeURIComponent(rawQuery)}`, authorPage: false }
    ];
    for (const item of candidates) {
        const requestUrls = item.authorPage
            ? [
                item.url,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(item.url)}`,
                `https://corsproxy.io/?${encodeURIComponent(item.url)}`
            ]
            : [item.url];
        for (const requestUrl of requestUrls) {
            try {
                const raw = await coReadFetchText(requestUrl, { timeoutMs: 9000, quiet: true });
                const rows = parseCoReadZhenhunSearch(raw, rawQuery).map(book => ({
                    ...book,
                    author: book.author || (item.authorPage ? rawQuery : '')
                }));
                if (rows.length) return rows;
            } catch (_) {
                // Continue to the next search shape; the site treats author pages and keyword search differently.
            }
        }
    }
    return [];
}

async function searchCoReadBooks() {
    const input = document.getElementById('coread-search-input');
    const box = document.getElementById('coread-search-results');
    const query = String(input && input.value || '').trim();
    if (!query || !box) return;
    const runId = ++coreadSearchRunId;
    coreadSearchCache = [];
    box.innerHTML = renderCoReadSearchResults(query, '正在搜索书源和公开书目。');
    try {
        await loadCoReadBuiltinSources(false);
        const [sourceResults, readableWeb, zhenhun] = await Promise.all([
            coReadWithTimeout(searchCoReadBookSources(query), 7600, []),
            coReadWithTimeout(searchCoReadReadableWeb(query), 5600, []),
            coReadWithTimeout(searchCoReadZhenhun(query), 9200, [])
        ]);
        if (runId !== coreadSearchRunId) return;
        const google = sourceResults.length || readableWeb.length || zhenhun.length ? [] : await coReadWithTimeout(searchCoReadGoogleBooks(query), 3200, []);
        if (runId !== coreadSearchRunId) return;
        const openLibrary = sourceResults.length || readableWeb.length || zhenhun.length || google.length >= 4 ? [] : await coReadWithTimeout(searchCoReadOpenLibrary(query), 2600, []);
        if (runId !== coreadSearchRunId) return;
        const seen = new Set();
        coreadSearchCache = [...zhenhun, ...readableWeb, ...sourceResults, ...google, ...openLibrary].filter(item => {
            const key = `${String(item.title || '').toLowerCase()}|${String(item.author || '').toLowerCase()}`;
            if (!item.title || seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 12);
        box.innerHTML = renderCoReadSearchResults(query, coreadSearchCache.length ? '已从书城解析到结果，可直接加入书架。' : '暂未搜到匹配结果，可以在书架页粘贴书籍链接或导入本地文件。');
    } catch (e) {
        if (runId !== coreadSearchRunId) return;
        coreadSearchCache = [];
        box.innerHTML = renderCoReadSearchResults(query, '在线搜索失败，可以在书架页粘贴书籍链接或导入本地文件。');
    }
}
window.searchCoReadBooks = searchCoReadBooks;

async function searchCoReadGoogleBooks(query) {
    const terms = [
        `intitle:${query}`,
        query
    ];
    const all = [];
    for (const term of terms) {
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(term)}&langRestrict=zh&maxResults=8`;
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const data = await resp.json();
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach(item => {
            const info = item.volumeInfo || {};
            all.push({
                title: info.title || '',
                author: Array.isArray(info.authors) ? info.authors.slice(0, 2).join(' / ') : '',
                url: info.infoLink || item.selfLink || '',
                source: 'Google Books',
                coverUrl: normalizeCoReadCoverUrl(info.imageLinks && (info.imageLinks.extraLarge || info.imageLinks.large || info.imageLinks.medium || info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)),
                description: info.description || ''
            });
        });
        if (all.length) break;
    }
    return all;
}

async function searchCoReadOpenLibrary(query) {
    const resp = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`);
    if (!resp.ok) return [];
    const data = await resp.json();
    const docs = Array.isArray(data.docs) ? data.docs : [];
    return docs.map(doc => ({
        title: doc.title || '未命名书籍',
        author: Array.isArray(doc.author_name) ? doc.author_name.slice(0, 2).join(' / ') : '',
        url: doc.key ? `https://openlibrary.org${doc.key}` : 'https://openlibrary.org',
        source: 'Open Library',
        coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
        description: doc.first_sentence && Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : ''
    }));
}

function renderCoReadSearchResults(query, note = '') {
    const rows = coreadSearchCache.map((doc, index) => {
            const title = doc.title || '未命名书籍';
            const author = doc.author || '';
            return `
                <button type="button" onclick="addCoReadSearchResult(${index})">
                    <span>${musicEscapeHtml(title)}</span>
                    <em>${musicEscapeHtml([author, doc.source, doc.lastChapter].filter(Boolean).join(' · ') || '书名加入')}</em>
                </button>
            `;
    }).join('');
    const external = `
        <div class="coread-external-search">
            <span>${musicEscapeHtml(note || `正在从内置书城搜索「${query}」。`)}</span>
        </div>
    `;
    return rows + external;
}

function addCoReadSearchResult(index) {
    const item = coreadSearchCache[Math.max(0, Number(index || 0))];
    if (!item) return;
    addCoReadBook({
        title: item.title,
        author: item.author,
        source: item.source || 'search',
        url: item.url,
        description: item.description || `${item.source || '搜索'} 条目：${item.url}`,
        coverUrl: item.coverUrl || '',
        rating: 0,
        sourceData: item.sourceType === 'bookSource' ? {
            bookSourceName: item.source || '',
            bookSourceUrl: item.bookSourceUrl || '',
            bookUrl: item.url || '',
            lastChapter: item.lastChapter || '',
            kind: item.kind || ''
        } : null,
        content: `书名：${item.title}\n作者：${item.author || '未知'}\n来源：${item.source || '搜索'} ${item.url || ''}\n${item.lastChapter ? `最新章节：${item.lastChapter}\n` : ''}\n${item.kind ? `分类：${item.kind}\n` : ''}\n${item.description || '已从搜索结果加入书架。后续可以继续导入正文或章节解析。'}`
    });
}
window.addCoReadSearchResult = addCoReadSearchResult;

function openCoReadExternalSearch(source) {
    const query = String(document.getElementById('coread-search-input')?.value || getCoReadBook(coreadActiveBookId)?.title || getCoReadDailyRecommendation().title || '').trim();
    if (!query) return;
    const encoded = encodeURIComponent(query);
    const urls = {
        douban: `https://search.douban.com/book/subject_search?search_text=${encoded}`,
        weread: `https://weread.qq.com/web/search/books?keyword=${encoded}`,
        google: `https://books.google.com/books?q=${encoded}`
    };
    window.open(urls[source] || urls.google, '_blank', 'noopener');
}
window.openCoReadExternalSearch = openCoReadExternalSearch;

function turnCoReadPage(delta) {
    const settings = getCoReadReaderSettings();
    if (settings.pageMode === 'scroll' && coreadActiveTab === 'reader') {
        const body = document.getElementById('coread-reader-body');
        if (body) {
            body.scrollBy({
                top: Number(delta || 0) * Math.max(240, body.clientHeight * 0.86),
                behavior: 'auto'
            });
            return;
        }
    }
    const book = getCoReadBook(coreadActiveBookId);
    if (!book) return;
    const maxPage = Math.max(0, Math.ceil(String(book.content || '').length / COREAD_PAGE_SIZE) - 1);
    const nextPage = Math.max(0, Math.min(maxPage, Number(book.page || 0) + Number(delta || 0)));
    if (nextPage === Number(book.page || 0)) return;
    book.page = nextPage;
    saveCoReadBookPage(book.id, nextPage);
    renderCoReadReader();
    if (coreadTocOpen) renderCoReadToc();
}
window.turnCoReadPage = turnCoReadPage;

async function askCoReadComment() {
    syncCoReadPageFromScrollPosition();
    const book = getCoReadBook(coreadActiveBookId);
    const char = getCoReadCharacters().find(item => item.id === coreadActiveCharId);
    if (!book || !char || coreadBusy) return;
    coreadCommentPanelOpen = true;
    coreadCommentStatusText = '正在读这一段...';
    coreadBusy = true;
    renderCoReadApp();
    try {
        const result = await requestCoReadAiComment(char, book, {}, { max_tokens: COREAD_AI_COMMENT_MAX_TOKENS, temperature: 0.84 });
        const text = result && result.ok ? result.text : '';
        if (text) {
            createCoReadThoughtRecord(book, char, text);
            coreadCommentStatusText = '';
            renderCoReadThoughts();
        } else {
            coreadCommentStatusText = (result && result.error) || 'char 没有回应。';
        }
    } catch (e) {
        coreadCommentStatusText = '生成失败，稍后再试。';
    } finally {
        coreadBusy = false;
        renderCoReadApp();
    }
}
window.askCoReadComment = askCoReadComment;

// --- Chat Album / 相册 ---
const CHAT_ALBUM_KEY = 'bynd_chat_album_v1';

function getChatAlbumStore() {
    try {
        const list = JSON.parse(localStorage.getItem(CHAT_ALBUM_KEY) || '[]');
        return Array.isArray(list) ? list.filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

function saveChatAlbumStore(list) {
    localStorage.setItem(CHAT_ALBUM_KEY, JSON.stringify((Array.isArray(list) ? list : []).slice(0, 500)));
}

function recordWechatGeneratedImageToAlbum(char, msg) {
    const url = msg && (msg.imageUrl || msg.content);
    if (!char || !url) return;
    const list = getChatAlbumStore();
    if (list.some(item => item.url === url)) return;
    list.unshift({
        id: `album_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        charId: char.id || '',
        charName: getCoReadCharName(char),
        avatar: char.avatar || DEFAULT_AVATAR,
        url,
        description: String(msg.description || msg.imagePrompt || '').slice(0, 260),
        prompt: String(msg.imagePrompt || '').slice(0, 800),
        createdAt: Date.now()
    });
    saveChatAlbumStore(list);
    if (!document.getElementById('app-album-window')?.classList.contains('hidden')) renderAlbumApp();
}
window.recordWechatGeneratedImageToAlbum = recordWechatGeneratedImageToAlbum;

function renderAlbumApp() {
    const tabs = document.getElementById('album-char-tabs');
    const grid = document.getElementById('album-grid');
    const status = document.getElementById('album-status');
    if (!tabs || !grid) return;
    const chars = getCoReadCharacters();
    const store = getChatAlbumStore();
    const active = window._albumActiveCharId || (chars[0] && chars[0].id) || '';
    window._albumActiveCharId = active;
    tabs.innerHTML = chars.map(char => {
        const count = store.filter(item => item.charId === char.id).length;
        return `
            <button type="button" class="${char.id === active ? 'active' : ''}" onclick="selectAlbumChar('${musicEscapeAttr(char.id)}')">
                <img src="${musicEscapeAttr(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${musicEscapeAttr(DEFAULT_AVATAR)}'">
                <span>${musicEscapeHtml(getCoReadCharName(char))}</span>
                <em>${count}</em>
            </button>
        `;
    }).join('') || '<div class="album-empty">先导入角色卡</div>';
    const rows = store.filter(item => !active || item.charId === active);
    grid.innerHTML = rows.map(item => `
        <figure class="album-photo">
            <img src="${musicEscapeAttr(item.url)}" alt="${musicEscapeAttr(item.description || item.charName || '聊天图片')}" loading="lazy">
            <figcaption>
                <strong>${musicEscapeHtml(item.charName || '角色')}</strong>
                <span>${musicEscapeHtml(item.description || '聊天生成图片')}</span>
            </figcaption>
        </figure>
    `).join('') || '<div class="album-empty">这个角色还没有聊天生成图</div>';
    if (status) status.textContent = `已保存 ${store.length} 张聊天生成图`;
}

function initAlbumApp() {
    renderAlbumApp();
}
window.initAlbumApp = initAlbumApp;

function selectAlbumChar(charId) {
    window._albumActiveCharId = charId || '';
    renderAlbumApp();
}
window.selectAlbumChar = selectAlbumChar;

const DESKTOP_DOCK_APP_DEFINITIONS = [
    { id: 'music', name: '音乐', icon: 'ri-music-2-fill' },
    { id: 'camera', name: '相机', icon: 'ri-camera-lens-line' },
    { id: 'preset', name: '预设', icon: 'ri-equalizer-line' }
];

const DESKTOP_APPS = [
    { id: 'wechat', name: '微信', icon: 'ri-wechat-line' },
    { id: 'regex', name: '正则', icon: 'ri-code-s-slash-line' },
    { id: 'worldbook', name: '世界书', icon: 'ri-book-read-line' },
    { id: 'settings', name: '设置', icon: 'ri-settings-4-line' },
    { id: 'theme', name: '美化', icon: 'ri-palette-line' },
    { id: 'study', name: '学习', icon: 'ri-graduation-cap-line' },
    { id: 'money', name: '记账', icon: 'ri-money-cny-box-line' },
    { id: 'game', name: 'Game', icon: 'ri-gamepad-line' },
    { id: 'dream', name: '盗梦空间', icon: 'ri-moon-cloudy-line' },
    { id: 'monitor', name: '监控', icon: 'ri-eye-line' },
    { id: 'outing', name: '一起出门', icon: 'ri-map-pin-user-line' },
    { id: 'coread', name: 'PageMate', icon: 'ri-book-open-line' },
    { id: 'album', name: '相册', icon: 'ri-image-2-line' }
];
normalizeDesktopFolders();
saveFolders();

function getDesktopAllAppDefinitions() {
    const map = new Map();
    [...DESKTOP_APPS, ...DESKTOP_DOCK_APP_DEFINITIONS].forEach(app => {
        if (app && app.id && !map.has(app.id)) map.set(app.id, app);
    });
    return Array.from(map.values());
}

function getDesktopAnyAppDefinition(appRef) {
    const id = typeof appRef === 'string' ? appRef : appRef?.id;
    const name = typeof appRef === 'object' ? appRef?.name : '';
    return getDesktopAllAppDefinitions().find(app => app.id === id)
        || getDesktopAllAppDefinitions().find(app => app.name === name)
        || null;
}

function renderDesktopFolderMiniIcons(folder, options = {}) {
    return getDesktopFolderApps(folder).slice(0, 4).map(app => `<div class="folder-mini-icon">${renderDesktopAppIcon(app, options)}</div>`).join('');
}

function createDesktopAppElement(app) {
    const safeApp = getDesktopAppDefinition(app);
    const el = document.createElement('div');
    el.className = 'app-item';
    el.dataset.appId = safeApp.id;
    el.dataset.layoutId = `app-${safeApp.id}`;
    el.onclick = () => openApp(safeApp.id);
    el.innerHTML = `<div class="app-icon icon-black">${renderDesktopAppIcon(safeApp)}</div><span>${desktopEscapeHtml(safeApp.name)}</span>`;
    return el;
}

function createDesktopFolderElement(folder) {
    const el = document.createElement('div');
    el.className = `app-item is-folder ${folder?.size === 'large' ? 'folder-large-icon' : 'folder-small-icon'}`;
    el.dataset.folderId = folder.id;
    el.dataset.layoutId = `folder-${folder.id}`;
    el.dataset.layoutType = 'folder';
    el.dataset.folderSize = folder?.size === 'large' ? 'large' : 'small';
    el.onclick = () => openFolder(folder.id);
    el.innerHTML = `<div class="app-icon">${renderDesktopFolderMiniIcons(folder)}</div><span>${desktopEscapeHtml(folder.name)}</span>`;
    return el;
}

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
                quad.appendChild(createDesktopFolderElement(item.data));
            } else {
                quad.appendChild(createDesktopAppElement(item.data));
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
                const appId = item.dataset.appId;
                const appName = item.querySelector('span')?.textContent;
                const app = DESKTOP_APPS.find(a => a.id === appId) || DESKTOP_APPS.find(a => a.name === appName);
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
                const targetId = item.dataset.appId;
                const targetName = item.querySelector('span')?.textContent;
                const targetApp = DESKTOP_APPS.find(a => a.id === targetId) || DESKTOP_APPS.find(a => a.name === targetName);
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

function addDesktopAppToCurrentPage(app, offsetIndex = 0, preferredArea = null, options = {}) {
    const pageArea = preferredArea || (() => {
        const pageIndex = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
        const page = ensureDesktopPage(pageIndex) || document.querySelector('#pages-container .desktop-page');
        return page?.querySelector('.desktop-scroll-area') || null;
    })();
    if (!pageArea) return null;
    const item = createDesktopAppElement(app);
    const placed = placeDesktopAppInFirstOpenSlot(item, pageArea, offsetIndex, options);
    if (!placed) return null;
    if (!options.strictOpenSlot) repairDesktopAppOverlaps(pageArea);
    return item;
}

function addDesktopAppAfterFolderPage(app, folderPageArea, offsetIndex = 0) {
    const startPage = folderPageArea?.closest?.('.desktop-page');
    const startIndex = Math.max(0, getDesktopPageIndex(startPage));
    const pageCount = Math.max(getDesktopPages().length, startIndex + 1);
    for (let pageIndex = startIndex; pageIndex <= pageCount; pageIndex += 1) {
        const area = ensureDesktopPage(pageIndex)?.querySelector('.desktop-scroll-area');
        if (!area) continue;
        const item = addDesktopAppToCurrentPage(app, offsetIndex, area, { strictOpenSlot: true });
        if (item) return item;
    }
    return null;
}

function moveAppOutOfFolder(folderId, appId, options = {}) {
    const folder = window._folders.find(f => f.id === folderId);
    if (!folder) return;
    const originalApps = [...folder.apps];
    const movedApp = originalApps.find(app => app.id === appId);
    if (!movedApp) return;
    const movedAppInfo = getDesktopAppDefinition(movedApp);
    const nextApps = originalApps.filter(app => app.id !== appId);
    const shouldDissolveFolder = nextApps.length <= 1;
    const appsToPlace = shouldDissolveFolder ? originalApps : [movedApp];

    if (shouldDissolveFolder) {
        window._folders = window._folders.filter(f => f.id !== folderId);
    } else {
        folder.apps = nextApps;
    }
    saveFolders();
    const keepOverlayOpen = !!options.keepOpen && !shouldDissolveFolder;
    if (!keepOverlayOpen) closeFolderOverlay();

    const hasLayoutCanvas = !!document.querySelector('#pages-container .desktop-scroll-area.layout-canvas');
    if (window._editMode || hasLayoutCanvas) {
        const folderItem = Array.from(document.querySelectorAll('.app-item.is-folder')).find(item => item.dataset.folderId === folderId);
        const folderPageArea = folderItem?.closest?.('.desktop-scroll-area') || getPreferredDesktopPageArea();
        if (shouldDissolveFolder) {
            folderItem?.remove();
        } else if (folderItem) {
            const currentFolder = window._folders.find(f => f.id === folderId);
            const icon = folderItem.querySelector('.app-icon');
            if (icon && currentFolder) icon.innerHTML = renderDesktopFolderMiniIcons(currentFolder);
        }
        let lastItem = null;
        appsToPlace.forEach((app, index) => {
            lastItem = addDesktopAppAfterFolderPage(app, folderPageArea, index) || addDesktopAppToCurrentPage(app, index, folderPageArea);
        });
        if (window._editMode && lastItem) selectDesktopLayoutItem(lastItem);
        if (!window._editMode) {
            localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify({
                items: collectDesktopLayout(),
                pageCount: getDesktopPages().length,
                savedAt: Date.now()
            }));
        }
    } else {
        rebuildDesktop();
        setTimeout(initFolderDrag, 0);
    }

    if (keepOverlayOpen) openFolder(folderId);
    if (typeof showWechatToast === 'function') showWechatToast(`${movedAppInfo.name} 已移到桌面`);
}
window.moveAppOutOfFolder = moveAppOutOfFolder;

// --- 📄 页面滑动系统 ---
function initPageSwipe(options = {}) {
    const container = document.getElementById('pages-container');
    const homeScreen = document.getElementById('home-screen');
    if (!container) return;
    const force = !!(options && options.force);
    if (container.dataset.pageSwipeInit === '1') {
        if (!force) return;
        if (typeof container._pageSwipeCleanup === 'function') {
            container._pageSwipeCleanup();
        }
    }
    container.dataset.pageSwipeInit = '1';

    let currentPage = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isDragging = false;
    let swipeIntent = '';
    let activeMousePointerId = null;
    let activeLegacyMouseSwipe = false;
    let suppressNextSwipeClick = false;
    let suppressNextSwipeClickTimer = null;
    let wheelSwipeAccum = 0;
    let wheelSwipeResetTimer = null;
    let wheelSwipeLockedUntil = 0;
    const getPages = () => Array.from(container.querySelectorAll('.desktop-page'));
    const cleanupSwipeListeners = [];
    const bindSwipe = (target, type, handler, eventOptions) => {
        if (!target) return;
        target.addEventListener(type, handler, eventOptions);
        cleanupSwipeListeners.push(() => target.removeEventListener(type, handler, eventOptions));
    };
    const markSwipeClickSuppressed = () => {
        suppressNextSwipeClick = true;
        clearTimeout(suppressNextSwipeClickTimer);
        suppressNextSwipeClickTimer = setTimeout(() => {
            suppressNextSwipeClick = false;
        }, 360);
    };

    function goToPage(idx) {
        const pages = getPages();
        const totalPages = Math.max(1, pages.length);
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
    window._desktopPageSwipeState = {
        begin(e, point) { beginSwipe(e, point || e); },
        move(e, point) { moveSwipe(e, point || e); },
        end() { endSwipe(); }
    };

    function updateDots() {
        const dots = document.querySelectorAll('#page-dots .page-dot');
        dots.forEach((d, i) => d.classList.toggle('active', i === currentPage));
    }

    function isDesktopSwipeInteractiveTarget(target) {
        return !!(target && target.closest && target.closest(
            'button, a, input, textarea, select, [contenteditable="true"], .folder-overlay, .desktop-edit-toolbar, .desktop-save-modal, .desktop-widget-library, .desktop-resize-handle, .desktop-item-center, .desktop-item-move-page, .desktop-item-delete, .lcw-control, .lcw-input, .pw-note'
        ));
    }

    function canSwipeDesktopPage(e) {
        const target = e.target;
        if (!window._editMode) {
            if (target && target.closest && !target.closest('#pages-container, .page-dots, .dock-bar, #home-screen')) return false;
            return !isDesktopSwipeInteractiveTarget(target);
        }
        if (target && target.closest && target.closest('.dock-item, .desktop-edit-toolbar, .desktop-save-modal, .folder-overlay, .desktop-resize-handle, .desktop-item-center, .desktop-item-move-page, .desktop-item-delete')) return false;
        const layoutItem = target && target.closest ? target.closest('.desktop-layout-item') : null;
        if (layoutItem) {
            const point = getDesktopPointerPoint(e);
            const rect = layoutItem.getBoundingClientRect();
            const innerX = point.x - rect.left;
            const innerY = point.y - rect.top;
            const isAppIcon = layoutItem.classList.contains('layout-app');
            const activeCoreWidth = isAppIcon ? Math.min(rect.width, 86) : rect.width;
            const activeCoreHeight = isAppIcon ? Math.min(rect.height, 96) : rect.height;
            const coreLeft = (rect.width - activeCoreWidth) / 2;
            const coreTop = (rect.height - activeCoreHeight) / 2;
            const insideCore = innerX >= coreLeft && innerX <= coreLeft + activeCoreWidth && innerY >= coreTop && innerY <= coreTop + activeCoreHeight;
            if (insideCore) return false;
        }
        return true;
    }

    const beginSwipe = (e, point) => {
        if (!canSwipeDesktopPage(e)) return;
        startX = point.clientX;
        startY = point.clientY;
        currentX = startX;
        currentY = startY;
        swipeIntent = '';
        isDragging = true;
    };

    const moveSwipe = (e, point) => {
        if (!canSwipeDesktopPage(e)) return;
        if (!isDragging) return;
        const pages = getPages();
        currentX = point.clientX;
        currentY = point.clientY;
        const diff = currentX - startX;
        const diffY = currentY - startY;
        if (!swipeIntent && (Math.abs(diff) > 8 || Math.abs(diffY) > 8)) {
            swipeIntent = Math.abs(diff) > Math.abs(diffY) * 1.12 ? 'horizontal' : 'vertical';
        }
        if (swipeIntent !== 'horizontal') return;
        if (e.cancelable) e.preventDefault();
        if (Math.abs(diff) > 14) markSwipeClickSuppressed();
        const offset = -currentPage * 100 + (diff / container.offsetWidth) * 100;
        pages.forEach(p => {
            p.style.transition = 'none';
            p.style.transform = `translateX(${offset}%)`;
        });
    };

    const endSwipe = () => {
        if (!isDragging) return;
        isDragging = false;
        const diff = currentX - startX;
        const diffY = currentY - startY;
        const pages = getPages();
        const totalPages = Math.max(1, pages.length);
        pages.forEach(p => p.style.transition = '');

        const threshold = Math.max(24, Math.min(42, container.offsetWidth * 0.1));
        const horizontal = swipeIntent === 'horizontal' || Math.abs(diff) > Math.abs(diffY) * 1.12;
        if (horizontal && Math.abs(diff) > threshold) {
            if (diff < 0 && currentPage < totalPages - 1) goToPage(currentPage + 1);
            else if (diff > 0 && currentPage > 0) goToPage(currentPage - 1);
            else goToPage(currentPage);
        } else {
            goToPage(currentPage);
        }
        startX = 0;
        startY = 0;
        currentX = 0;
        currentY = 0;
        swipeIntent = '';
    };

    const handleWheelSwipe = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (!canSwipeDesktopPage(e)) return;
        const pages = getPages();
        if (pages.length < 2) return;
        const rawDeltaX = Number(e.deltaX) || 0;
        const rawDeltaY = Number(e.deltaY) || 0;
        const horizontalDelta = e.shiftKey ? (rawDeltaX || rawDeltaY) : rawDeltaX;
        const verticalDelta = e.shiftKey ? 0 : rawDeltaY;
        if (!horizontalDelta) return;
        if (!e.shiftKey && Math.abs(horizontalDelta) < Math.max(8, Math.abs(verticalDelta) * 1.08)) return;
        if (e.cancelable) e.preventDefault();

        const now = Date.now();
        if (now < wheelSwipeLockedUntil) return;
        wheelSwipeAccum += horizontalDelta;
        clearTimeout(wheelSwipeResetTimer);
        wheelSwipeResetTimer = setTimeout(() => {
            wheelSwipeAccum = 0;
        }, 180);

        const threshold = Math.max(36, Math.min(80, container.offsetWidth * 0.16));
        if (Math.abs(wheelSwipeAccum) < threshold) return;
        if (wheelSwipeAccum > 0 && currentPage < pages.length - 1) goToPage(currentPage + 1);
        else if (wheelSwipeAccum < 0 && currentPage > 0) goToPage(currentPage - 1);
        else goToPage(currentPage);
        wheelSwipeAccum = 0;
        wheelSwipeLockedUntil = now + 360;
    };

    const shouldSkipOuterSwipeEvent = (e) => (
        homeScreen
        && e.currentTarget === homeScreen
        && e.target
        && e.target.closest
        && e.target.closest('#pages-container')
    );

    const onTouchStart = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.touches && e.touches[0]) beginSwipe(e, e.touches[0]);
    };

    const onTouchMove = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.touches && e.touches[0]) moveSwipe(e, e.touches[0]);
    };

    const onPointerDown = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.pointerType === 'mouse') activeMousePointerId = e.pointerId;
        beginSwipe(e, e);
    };

    const onPointerMove = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.pointerType === 'mouse' && activeMousePointerId !== e.pointerId) return;
        moveSwipe(e, e);
    };

    const onPointerUp = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.pointerType === 'mouse' && activeMousePointerId !== e.pointerId) return;
        activeMousePointerId = null;
        endSwipe();
    };

    const onPointerCancel = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.pointerType === 'mouse' && activeMousePointerId !== e.pointerId) return;
        activeMousePointerId = null;
        endSwipe();
    };

    const onMouseDown = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (activeMousePointerId !== null || e.button !== 0) return;
        activeLegacyMouseSwipe = true;
        beginSwipe(e, e);
    };

    const onMouseMove = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (!activeLegacyMouseSwipe) return;
        moveSwipe(e, e);
    };

    const onMouseUp = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (!activeLegacyMouseSwipe) return;
        activeLegacyMouseSwipe = false;
        endSwipe();
    };

    const onMouseLeave = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (!activeLegacyMouseSwipe) return;
        activeLegacyMouseSwipe = false;
        endSwipe();
    };

    const onClick = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (!suppressNextSwipeClick) return;
        suppressNextSwipeClick = false;
        clearTimeout(suppressNextSwipeClickTimer);
        e.preventDefault();
        e.stopPropagation();
    };

    const swipeTargets = [container];
    if (homeScreen && homeScreen !== container) swipeTargets.push(homeScreen);
    swipeTargets.forEach(target => {
        bindSwipe(target, 'touchstart', onTouchStart, { passive: true });
        bindSwipe(target, 'touchmove', onTouchMove, { passive: false });
        bindSwipe(target, 'touchend', endSwipe);
        bindSwipe(target, 'touchcancel', endSwipe);
        bindSwipe(target, 'pointerdown', onPointerDown);
        bindSwipe(target, 'pointermove', onPointerMove);
        bindSwipe(target, 'pointerup', onPointerUp);
        bindSwipe(target, 'pointercancel', onPointerCancel);
        bindSwipe(target, 'mousedown', onMouseDown);
        bindSwipe(target, 'mousemove', onMouseMove);
        bindSwipe(target, 'mouseup', onMouseUp);
        bindSwipe(target, 'mouseleave', onMouseLeave);
        bindSwipe(target, 'click', onClick, true);
        bindSwipe(target, 'wheel', handleWheelSwipe, { passive: false });
    });
    container._pageSwipeCleanup = () => {
        clearTimeout(suppressNextSwipeClickTimer);
        clearTimeout(wheelSwipeResetTimer);
        cleanupSwipeListeners.splice(0).forEach(remove => remove());
        delete container._pageSwipeCleanup;
        delete container.dataset.pageSwipeInit;
    };

    goToPage(currentPage);
}

// --- 桌面长按布局编辑 ---
const DESKTOP_LAYOUT_KEY = 'desktop_layout_v2';
const DESKTOP_STICKY_NOTES_KEY = 'desktop_sticky_notes_v1';
const DESKTOP_STATUS_WIDGET_PREFS_KEY = 'desktop_status_widget_prefs_v1';
const DESKTOP_LOVELY_WIDGET_PREFS_KEY = 'desktop_lovely_widget_prefs_v1';
const DESKTOP_LOVELY_LEGACY_BUBBLE_TEXT = "BEYOND THE CODE\nTHAT'S WHERE WE'LL BE\nFOREVER FREE";
const DESKTOP_LOVELY_DEFAULT_BUBBLE_TEXT = "FACEBOOK\nCHU ANH一梅";
const DESKTOP_LOVELY_BUBBLE_COLORS = {
    blue: 'rgba(181,218,247,0.72)',
    pink: 'rgba(252,205,221,0.94)',
    mint: 'rgba(196,235,218,0.94)',
    yellow: 'rgba(249,230,171,0.94)',
    purple: 'rgba(220,206,247,0.94)',
    clear: 'rgba(255,255,255,0)',
    black: 'rgba(20,22,27,0.88)',
    gray: 'rgba(152,159,170,0.82)'
};
const DESKTOP_LOVELY_BUBBLE_HEX = {
    blue: '#b8dbf9',
    pink: '#fccddd',
    mint: '#c4ebda',
    yellow: '#f9e6ab',
    purple: '#dccef7',
    clear: '#ffffff',
    black: '#14161b',
    gray: '#989faa'
};
const DESKTOP_NOTES_WIDGET_TONES = {
    blue: { label: '奶蓝', card: 'rgba(213,238,253,0.76)', accent: '#8ec8ee', back: '#2aa9d6', back2: '#bfeaf8', text: '#65acd7', icon: 'ri-fish-line' },
    pink: { label: '奶粉', card: 'rgba(253,223,234,0.78)', accent: '#f3a8c4', back: '#f7a8c9', back2: '#fff6b6', text: '#e88eb1', icon: 'ri-footprint-line' },
    yellow: { label: '奶黄', card: 'rgba(255,231,177,0.78)', accent: '#f5bf59', back: '#ffc863', back2: '#d9efff', text: '#e19c1a', icon: 'ri-ship-line' },
    mint: { label: '薄荷', card: 'rgba(214,244,230,0.78)', accent: '#83d6ac', back: '#89dcb6', back2: '#d9f0ff', text: '#63b88d', icon: 'ri-leaf-line' },
    purple: { label: '淡紫', card: 'rgba(229,218,252,0.78)', accent: '#b69be9', back: '#c1a7ef', back2: '#f9d8eb', text: '#9c80d6', icon: 'ri-star-smile-line' }
};
const DESKTOP_STATUS_WEATHER_KEY = 'desktop_status_weather_v1';
const DESKTOP_STATUS_STEPS_KEY = 'desktop_status_steps_v1';
const DESKTOP_DEFAULT_PRINCESS_DELETED_KEY = 'desktop_default_princess_deleted_v1';
const DESKTOP_DEFAULT_LOVELY_DELETED_KEY = 'desktop_default_lovely_deleted_v1';
const DESKTOP_DEFAULT_PRINCESS_ID = 'custom-princess-default';
const DESKTOP_DEFAULT_LOVELY_ID = 'custom-lovely-default';
const DESKTOP_DEFAULT_LOVELY_LEGACY_TOP = 14;
const DESKTOP_DEFAULT_LOVELY_OLD_TOP = 104;
const DESKTOP_DEFAULT_LOVELY_TOP = 48;
const DESKTOP_CUSTOM_WIDGET_KINDS = new Set(['princess', 'status', 'lovely', 'polaroid', 'calendar', 'photo-square', 'notes-trio', 'catalog']);
const DESKTOP_SNAP_GRID = 12;
const DESKTOP_SNAP_TOLERANCE = 9;
const DESKTOP_DOCK_LAYOUT_MAX = 4;
const DESKTOP_DELETABLE_BUILTIN_IDS = new Set(['widget-calendar', 'widget-photo-1', 'widget-photo-2']);
const DESKTOP_STATIC_PAGE2_APP_LAYOUT_IDS = new Set();
window._editMode = false;
window._desktopSelectedLayoutItem = null;
let _editLongPressTimer = null;
let _desktopLayoutBackupHtml = '';
let _desktopDefaultLayoutHtml = '';
let _desktopDockBackupHtml = '';
let _desktopDefaultDockHtml = '';
let _desktopLongPressStart = null;
let _desktopLongPressTriggered = false;
let _desktopLongPressActive = false;
let _desktopLayoutApplied = false;
let _desktopLayoutNeedsVisiblePersist = false;
let _desktopDefaultPrincessDeletedBackup = null;
let _desktopDefaultLovelyDeletedBackup = null;
let _desktopStickyNotesBackup = null;
let _desktopLovelyPrefsBackup = null;
let _desktopStatusBattery = null;
let _desktopStatusBatteryBound = false;

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
        if (el.classList.contains('is-folder') && el.dataset.folderId) return `folder-${el.dataset.folderId}`;
        if (el.dataset.appId) return `app-${el.dataset.appId}`;
        const onclick = el.getAttribute('onclick') || '';
        const match = onclick.match(/openApp\('([^']+)'\)/);
        if (match) return 'app-' + match[1];
        const label = el.querySelector('span')?.textContent?.trim() || Date.now();
        return 'app-custom-' + label;
    }
    return 'item-' + Date.now();
}

function isDesktopStaticPage2AppLayoutId(id) {
    return DESKTOP_STATIC_PAGE2_APP_LAYOUT_IDS.has(String(id || ''));
}

function findDesktopBuiltinElement(id) {
    if (id === 'widget-calendar') return document.querySelector('.calendar-widget');
    if (id === 'widget-photo-1') return document.querySelector('.desktop-img-1')?.closest('.photo-large') || document.querySelectorAll('.photo-large')[0];
    if (id === 'widget-photo-2') return document.querySelector('.desktop-img-2')?.closest('.photo-large') || document.querySelectorAll('.photo-large')[1];
    if (id.startsWith('folder-')) {
        const folderId = id.slice(7);
        const folder = window._folders.find(f => f.id === folderId);
        return folder ? createDesktopFolderElement(folder) : null;
    }
    if (id.startsWith('app-')) {
        const appId = id.slice(4);
        const app = getDesktopAnyAppDefinition(appId);
        if (app) return createDesktopAppElement(app);
        return Array.from(document.querySelectorAll('.app-item')).find(item => {
            const onclick = item.getAttribute('onclick') || '';
            return onclick.includes(`openApp('${appId}')`);
        });
    }
    return null;
}

function getDesktopBuiltinElementById(id) {
    if (id === 'widget-calendar') return document.querySelector('.calendar-widget');
    if (id === 'widget-photo-1') return document.querySelector('.desktop-img-1')?.closest('.photo-large') || null;
    if (id === 'widget-photo-2') return document.querySelector('.desktop-img-2')?.closest('.photo-large') || null;
    return null;
}

function removeDesktopBuiltinElementById(id) {
    const item = getDesktopBuiltinElementById(id) || document.querySelector(`.desktop-layout-item[data-layout-id="${CSS.escape(String(id || ''))}"]`);
    if (!item) return false;
    item.remove();
    return true;
}

function collectDesktopDeletedBuiltinIds() {
    return Array.from(DESKTOP_DELETABLE_BUILTIN_IDS).filter(id => !getDesktopBuiltinElementById(id));
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
    const safeRect = clampDesktopLayoutRect(rect, pageArea);
    item.dataset.layoutId = id;
    item.dataset.layoutType = item.dataset.layoutType || (id.startsWith('app-') ? 'app' : 'builtin');
    item.classList.add('desktop-layout-item');
    if (item.classList.contains('app-item')) {
        item.classList.add('layout-app');
        item.setAttribute('draggable', 'false');
    }
    pageArea.classList.add('layout-canvas');
    if (item.parentElement !== pageArea) pageArea.appendChild(item);
    item.style.left = `${Math.round(safeRect.left)}px`;
    item.style.top = `${Math.round(safeRect.top)}px`;
    item.style.width = `${Math.round(safeRect.width)}px`;
    item.style.height = `${Math.round(safeRect.height)}px`;
    setupDesktopLayoutItem(item);
}

function clampDesktopLayoutRect(rect, pageArea) {
    const source = rect || {};
    const hasMeasuredBounds = hasDesktopUsableLayoutBounds(pageArea);
    const areaWidth = Math.max(260, hasMeasuredBounds ? pageArea.clientWidth : 375);
    const areaHeight = Math.max(520, hasMeasuredBounds ? pageArea.clientHeight : 590);
    const minWidth = Math.min(220, Math.max(54, Number(source.width) || 96));
    const minHeight = Math.min(140, Math.max(58, Number(source.height) || 96));
    const width = hasMeasuredBounds
        ? Math.max(54, Math.min(areaWidth - 16, Number(source.width) || minWidth))
        : Math.max(54, Number(source.width) || minWidth);
    const height = hasMeasuredBounds
        ? Math.max(58, Math.min(areaHeight - 16, Number(source.height) || minHeight))
        : Math.max(58, Number(source.height) || minHeight);
    const left = Number(source.left);
    const top = Number(source.top);
    return {
        left: hasMeasuredBounds
            ? Math.max(8, Math.min(areaWidth - width - 8, Number.isFinite(left) ? left : 8))
            : Math.max(8, Number.isFinite(left) ? left : 8),
        top: hasMeasuredBounds
            ? Math.max(8, Math.min(areaHeight - height - 8, Number.isFinite(top) ? top : 8))
            : Math.max(8, Number.isFinite(top) ? top : 8),
        width,
        height
    };
}

function hasDesktopUsableLayoutBounds(pageArea) {
    return !!(pageArea && pageArea.clientWidth > 0 && pageArea.clientHeight > 0);
}

function getDesktopRawStyleRect(item, fallback = {}) {
    if (!item) return null;
    const styleLeft = parseFloat(item.style.left);
    const styleTop = parseFloat(item.style.top);
    const styleWidth = parseFloat(item.style.width);
    const styleHeight = parseFloat(item.style.height);
    return {
        left: Number.isFinite(styleLeft) ? styleLeft : (Number(fallback.left) || item.offsetLeft || 0),
        top: Number.isFinite(styleTop) ? styleTop : (Number(fallback.top) || item.offsetTop || 0),
        width: Number.isFinite(styleWidth) && styleWidth > 0 ? styleWidth : (item.offsetWidth || Number(fallback.width) || 72),
        height: Number.isFinite(styleHeight) && styleHeight > 0 ? styleHeight : (item.offsetHeight || Number(fallback.height) || 82)
    };
}

function desktopRectsDiffer(a, b, tolerance = 1) {
    if (!a || !b) return false;
    return Math.abs((a.left || 0) - (b.left || 0)) > tolerance
        || Math.abs((a.top || 0) - (b.top || 0)) > tolerance
        || Math.abs((a.width || 0) - (b.width || 0)) > tolerance
        || Math.abs((a.height || 0) - (b.height || 0)) > tolerance;
}

function setDesktopLayoutItemRect(item, rect) {
    if (!item || !rect) return false;
    const current = getDesktopRawStyleRect(item);
    if (!desktopRectsDiffer(current, rect)) return false;
    item.style.left = `${Math.round(rect.left)}px`;
    item.style.top = `${Math.round(rect.top)}px`;
    item.style.width = `${Math.round(rect.width)}px`;
    item.style.height = `${Math.round(rect.height)}px`;
    return true;
}

function getDesktopDirectLayoutItems(pageArea) {
    const items = [];
    pageArea.querySelectorAll(':scope > .calendar-widget, :scope > .photo-large, :scope > .app-item, :scope > .desktop-custom-widget').forEach(item => items.push(item));
    pageArea.querySelectorAll(':scope > .bento-box > .photo-large, :scope > .bento-box > .apps-quad > .app-item').forEach(item => items.push(item));
    pageArea.querySelectorAll(':scope > .page2-app-grid > .app-item').forEach(item => items.push(item));
    return items.filter((item, index, arr) => (
        arr.indexOf(item) === index
        && !item.classList.contains('layout-source-hidden')
        && !item.closest('.layout-source-hidden')
    ));
}

function materializeDesktopPage(page) {
    const pageArea = page.querySelector('.desktop-scroll-area');
    if (!pageArea) return;
    pageArea.scrollTop = 0;
    pageArea.scrollLeft = 0;
    const items = getDesktopDirectLayoutItems(pageArea);
    const snapshots = items.map(item => ({
        item,
        rect: normalizeDesktopLayoutRect(item, pageArea)
    }));
    snapshots.forEach(({ item, rect }) => prepareDesktopLayoutItem(item, pageArea, rect));
    page.querySelectorAll('.bento-box, .page2-app-grid, .desktop-empty-placeholder').forEach(el => el.classList.add('layout-source-hidden'));
}

function materializeExistingDesktopForLayout() {
    document.querySelectorAll('#pages-container .desktop-page').forEach(materializeDesktopPage);
}

function getDesktopPages() {
    return Array.from(document.querySelectorAll('#pages-container .desktop-page'));
}

function createDesktopScreenPage(index) {
    const page = document.createElement('div');
    page.className = 'desktop-page';
    page.dataset.page = String(index);
    page.innerHTML = `
        <div class="desktop-scroll-area page-extra-content">
            <div class="desktop-empty-placeholder">
                <i class="ri-add-circle-line"></i>
                <span>第 ${index + 1} 屏</span>
                <small>长按编辑后可以把图标和组件放到这里。</small>
            </div>
        </div>
    `;
    return page;
}

function syncDesktopPagesAndDots(activeIndex) {
    const pages = getDesktopPages();
    pages.forEach((page, index) => { page.dataset.page = String(index); });
    const dots = document.getElementById('page-dots');
    if (dots) {
        dots.innerHTML = pages.map((_, index) => `<div class="page-dot ${index === activeIndex ? 'active' : ''}"></div>`).join('');
    }
}

function ensureDesktopPage(index) {
    const container = document.getElementById('pages-container');
    if (!container) return null;
    let pages = getDesktopPages();
    while (pages.length <= index) {
        const page = createDesktopScreenPage(pages.length);
        container.appendChild(page);
        pages.push(page);
    }
    syncDesktopPagesAndDots(Math.min(index, pages.length - 1));
    return pages[index] || null;
}

function setupDesktopLayoutItem(item) {
    if (item._layoutReady) return;
    item._layoutReady = true;
    item.dataset.layoutReady = '1';
    if (item.classList.contains('layout-app') && !item.classList.contains('is-folder')) {
        item.onclick = null;
        item.removeAttribute('onclick');
    }
    item.addEventListener('pointerdown', startDesktopItemDrag);
    item.addEventListener('click', (e) => {
        if (e.target.closest('.desktop-resize-handle, .desktop-item-center, .desktop-item-move-page, .desktop-item-delete, .pw-note, .dsw-avatar, .dsw-avatar-input, .dsw-weather, .dsw-steps, .lcw-control, .lcw-input')) return;
        if (item.classList.contains('is-folder') && item.dataset.folderId && !item.dataset.desktopDragMoved) {
            e.preventDefault();
            e.stopPropagation();
            openFolder(item.dataset.folderId);
            return;
        }
        if (!window._editMode) return;
        e.preventDefault();
        e.stopPropagation();
        selectDesktopLayoutItem(item);
    }, true);
    item.addEventListener('click', (e) => {
        if (window._editMode) return;
        if (e.defaultPrevented) return;
        if (item.classList.contains('is-folder')) return;
        const appId = getDesktopAppIdFromElement(item);
        if (!appId) return;
        e.preventDefault();
        e.stopPropagation();
        openApp(appId);
    });
}

function addDesktopItemControls(item) {
    item.querySelectorAll(':scope > .desktop-resize-handle, :scope > .desktop-item-center, :scope > .desktop-item-move-page, :scope > .desktop-item-delete').forEach(el => el.remove());
    if (!item.classList.contains('layout-app') || item.classList.contains('is-folder')) {
        const resize = document.createElement('div');
        resize.className = 'desktop-resize-handle';
        resize.setAttribute('role', 'button');
        resize.setAttribute('aria-label', '拖动缩放组件');
        resize.innerHTML = '<i class="ri-expand-diagonal-line" aria-hidden="true"></i><span>缩放</span>';
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
    if (!item.classList.contains('layout-app')) {
        const center = document.createElement('button');
        center.type = 'button';
        center.className = 'desktop-item-center';
        center.textContent = '居中';
        center.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            centerSelectedDesktopItem();
        });
        item.appendChild(center);
    }
    if (item.dataset.layoutType === 'custom' || DESKTOP_DELETABLE_BUILTIN_IDS.has(item.dataset.layoutId || '')) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'desktop-item-delete';
        del.innerHTML = '<span aria-hidden="true">×</span>';
        del.setAttribute('aria-label', '删除组件');
        del.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteSelectedDesktopLayoutItem();
        });
        item.appendChild(del);
    }
}

function selectDesktopLayoutItem(item) {
    document.querySelectorAll('.desktop-layout-item.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.dock-item.selected').forEach(el => el.classList.remove('selected'));
    window._desktopSelectedLayoutItem = item;
    item.classList.add('selected');
    if (item.classList.contains('desktop-layout-item')) addDesktopItemControls(item);
}

function getDesktopLayoutItemAppRef(item) {
    if (!item || !item.classList.contains('layout-app')) return null;
    if (item.classList.contains('is-folder')) return null;
    const appId = item.dataset.appId || String(item.dataset.layoutId || '').replace(/^app-/, '');
    return getDesktopAnyAppDefinition(appId);
}

function getDesktopRectOverlapScore(sourceRect, targetRect) {
    const left = Math.max(sourceRect.left, targetRect.left);
    const right = Math.min(sourceRect.right, targetRect.right);
    const top = Math.max(sourceRect.top, targetRect.top);
    const bottom = Math.min(sourceRect.bottom, targetRect.bottom);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    const sourceArea = Math.max(1, sourceRect.width * sourceRect.height);
    return (width * height) / sourceArea;
}

function getDesktopFolderMergeHitRect(target) {
    const rect = target?.querySelector?.('.app-icon')?.getBoundingClientRect?.()
        || target?.getBoundingClientRect?.();
    if (!rect) return null;
    const inset = Math.max(4, Math.min(rect.width || 0, rect.height || 0) * 0.14);
    return {
        left: rect.left + inset,
        right: rect.right - inset,
        top: rect.top + inset,
        bottom: rect.bottom - inset,
        width: Math.max(1, rect.width - inset * 2),
        height: Math.max(1, rect.height - inset * 2)
    };
}

function isDesktopPointInsideRect(point, rect, pad = 0) {
    if (!point || !rect) return false;
    return point.x >= rect.left - pad
        && point.x <= rect.right + pad
        && point.y >= rect.top - pad
        && point.y <= rect.bottom + pad;
}

function findDesktopFolderMergeTarget(item, pageArea, point) {
    if (!item || !pageArea || !item.classList.contains('layout-app') || item.classList.contains('is-folder')) return null;
    const itemRect = item.getBoundingClientRect();
    const itemCenter = {
        x: point?.x ?? (itemRect.left + itemRect.width / 2),
        y: point?.y ?? (itemRect.top + itemRect.height / 2)
    };
    const candidates = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item.layout-app')).filter(target => target !== item);
    const centered = candidates.find(target => isDesktopPointInsideRect(itemCenter, getDesktopFolderMergeHitRect(target), 5));
    if (centered) return centered;
    if (point) return null;
    const sourceIconRect = item.querySelector?.('.app-icon')?.getBoundingClientRect?.() || itemRect;
    const scored = candidates.map(target => ({
        target,
        score: getDesktopRectOverlapScore(sourceIconRect, getDesktopFolderMergeHitRect(target) || target.getBoundingClientRect())
    })).filter(entry => entry.score >= 0.52)
      .sort((a, b) => b.score - a.score);
    return scored[0]?.target || null;
}

function findDesktopDockFolderMergeTarget(pageArea, point, sourceAppId) {
    if (!pageArea || !point) return null;
    const candidates = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item.layout-app')).filter(target => {
        if (!target) return false;
        const targetAppId = getDesktopAppIdFromElement(target);
        return !targetAppId || targetAppId !== sourceAppId;
    });
    const centered = candidates.find(target => isDesktopPointInsideRect(point, getDesktopFolderMergeHitRect(target), 5));
    if (centered) return centered;
    return candidates.map(target => {
        const rect = getDesktopFolderMergeHitRect(target) || target.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return {
            target,
            distance: Math.hypot(point.x - centerX, point.y - centerY),
            limit: Math.max(rect.width, rect.height) * 0.42
        };
    }).filter(entry => entry.distance <= entry.limit)
      .sort((a, b) => a.distance - b.distance)[0]?.target || null;
}

function getDesktopOrderedSlotItems(pageArea, includeDraggedItem) {
    if (!pageArea) return [];
    return Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item.layout-app'))
        .filter(item => includeDraggedItem || !item.classList.contains('desktop-slot-dragging'))
        .sort((a, b) => {
            const aSlot = Number(a.dataset.desktopSlot);
            const bSlot = Number(b.dataset.desktopSlot);
            const aHasSlot = Number.isFinite(aSlot);
            const bHasSlot = Number.isFinite(bSlot);
            if (aHasSlot && bHasSlot && aSlot !== bSlot) return aSlot - bSlot;
            const at = parseFloat(a.style.top) || a.offsetTop || 0;
            const bt = parseFloat(b.style.top) || b.offsetTop || 0;
            if (Math.abs(at - bt) > 12) return at - bt;
            return (parseFloat(a.style.left) || a.offsetLeft || 0) - (parseFloat(b.style.left) || b.offsetLeft || 0);
        });
}

function getDesktopFallbackSlotMetrics(pageArea) {
    const width = Math.max(300, pageArea?.clientWidth || 375);
    const iconWidth = 72;
    const iconHeight = 82;
    const columns = Math.max(3, Math.min(4, Math.floor((width - 34) / iconWidth)));
    const gapX = columns > 1 ? Math.max(10, Math.floor((width - (columns * iconWidth) - 24) / (columns - 1))) : 12;
    const startX = Math.max(12, Math.round((width - (columns * iconWidth + gapX * (columns - 1))) / 2));
    return {
        columns,
        iconWidth,
        iconHeight,
        startX,
        startY: 18,
        gapX,
        gapY: 18
    };
}

function getDesktopFlowSlotRects(pageArea) {
    if (!pageArea) return [];
    const metrics = getDesktopFallbackSlotMetrics(pageArea);
    const areaHeight = Math.max(520, pageArea.clientHeight || 590);
    const maxTop = Math.max(metrics.startY, areaHeight - metrics.iconHeight - 8);
    const maxRows = Math.max(1, Math.floor((maxTop - metrics.startY) / (metrics.iconHeight + metrics.gapY)) + 1);
    const widgetRects = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item:not(.layout-app)'))
        .map(item => getDesktopStyleRect(item, pageArea))
        .filter(Boolean);
    const obstacles = widgetRects.map(rect => ({
        left: rect.left - 8,
        top: rect.top - 12,
        width: rect.width + 16,
        height: rect.height + 20
    }));
    const slots = [];
    const seen = new Set();
    const pushSlot = rect => {
        const safe = clampDesktopLayoutRect(rect, pageArea);
        const key = `${Math.round(safe.left)}:${Math.round(safe.top)}`;
        if (seen.has(key)) return;
        const iconCoreRect = {
            left: safe.left + 8,
            top: safe.top + 4,
            width: Math.max(36, safe.width - 16),
            height: Math.max(48, safe.height - 18)
        };
        const blocked = obstacles.some(obstacle => (
            getDesktopRectIntersectionRatio(safe, obstacle) > 0.52
            || getDesktopRectIntersectionRatio(iconCoreRect, obstacle) > 0.18
        ));
        if (blocked) return;
        seen.add(key);
        slots.push(safe);
    };
    for (let row = 0; row < maxRows; row += 1) {
        for (let col = 0; col < metrics.columns; col += 1) {
            const top = metrics.startY + row * (metrics.iconHeight + metrics.gapY);
            if (top > maxTop + 1) continue;
            pushSlot({
                left: metrics.startX + col * (metrics.iconWidth + metrics.gapX),
                top,
                width: metrics.iconWidth,
                height: metrics.iconHeight
            });
        }
    }
    widgetRects.forEach(widget => {
        const edgeTops = [
            widget.top + widget.height + 8,
            widget.top - metrics.iconHeight - 8
        ];
        edgeTops.forEach(top => {
            if (top < metrics.startY - 1 || top > maxTop + 1) return;
            for (let col = 0; col < metrics.columns; col += 1) {
                pushSlot({
                    left: metrics.startX + col * (metrics.iconWidth + metrics.gapX),
                    top,
                    width: metrics.iconWidth,
                    height: metrics.iconHeight
                });
            }
        });
    });
    return slots.sort((a, b) => (a.top - b.top) || (a.left - b.left));
}

function getDesktopStableSlotRects(pageArea, items, flowSlots = []) {
    if (!pageArea) return [];
    const orderedItems = Array.isArray(items) ? items : [];
    const slots = [];
    const pushSlot = rect => {
        if (!rect) return;
        const safe = clampDesktopLayoutRect(rect, pageArea);
        const duplicate = slots.some(slot => (
            getDesktopRectIntersectionRatio(safe, slot) > 0.68
            || (
                Math.abs((safe.left + safe.width / 2) - (slot.left + slot.width / 2)) < 12
                && Math.abs((safe.top + safe.height / 2) - (slot.top + slot.height / 2)) < 12
            )
        ));
        if (!duplicate) slots.push(safe);
    };

    orderedItems
        .map(item => getDesktopStyleRect(item, pageArea))
        .filter(Boolean)
        .sort((a, b) => (a.top - b.top) || (a.left - b.left))
        .forEach(pushSlot);

    if (slots.length < orderedItems.length && Array.isArray(flowSlots)) {
        for (const slot of flowSlots) {
            if (slots.length >= orderedItems.length) break;
            pushSlot(slot);
        }
    }

    let fallbackIndex = 0;
    const fallbackLimit = Math.max(orderedItems.length + 12, 24);
    while (slots.length < orderedItems.length && fallbackIndex < fallbackLimit) {
        pushSlot(getDesktopFallbackSlotRect(pageArea, fallbackIndex));
        fallbackIndex += 1;
    }

    return slots;
}

function getDesktopCompactSlotRects(pageArea, items, flowSlots = []) {
    if (!pageArea) return [];
    const orderedItems = Array.isArray(items) ? items : [];
    const slots = [];
    const pushSlot = rect => {
        if (!rect || slots.length >= orderedItems.length) return;
        const safe = clampDesktopLayoutRect(rect, pageArea);
        const duplicate = slots.some(slot => (
            getDesktopRectIntersectionRatio(safe, slot) > 0.68
            || (
                Math.abs((safe.left + safe.width / 2) - (slot.left + slot.width / 2)) < 12
                && Math.abs((safe.top + safe.height / 2) - (slot.top + slot.height / 2)) < 12
            )
        ));
        if (!duplicate) slots.push(safe);
    };

    if (Array.isArray(flowSlots)) {
        flowSlots.forEach(pushSlot);
    }

    let fallbackIndex = 0;
    const fallbackLimit = Math.max(orderedItems.length + 12, 24);
    while (slots.length < orderedItems.length && fallbackIndex < fallbackLimit) {
        pushSlot(getDesktopFallbackSlotRect(pageArea, fallbackIndex));
        fallbackIndex += 1;
    }

    return slots;
}

function getNearestDesktopFlowSlotIndex(pageArea, item, slots, usedSlots = new Set(), preferredIndex = null) {
    if (!pageArea || !item || !Array.isArray(slots) || !slots.length) return 0;
    const preferred = Number(preferredIndex);
    if (Number.isFinite(preferred) && preferred >= 0 && preferred < slots.length && !usedSlots.has(preferred)) return preferred;
    const rect = getDesktopStyleRect(item, pageArea);
    if (!rect) return Math.max(0, slots.findIndex((_, index) => !usedSlots.has(index)));
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ranked = slots
        .map((slot, index) => ({
            index,
            distance: (cx - (slot.left + slot.width / 2)) ** 2 + (cy - (slot.top + slot.height / 2)) ** 2
        }))
        .filter(entry => !usedSlots.has(entry.index))
        .sort((a, b) => a.distance - b.distance);
    return ranked[0]?.index ?? 0;
}

function getDesktopFallbackSlotRect(pageArea, slotIndex, item) {
    const metrics = getDesktopFallbackSlotMetrics(pageArea);
    const index = Math.max(0, Number(slotIndex) || 0);
    const width = item?.offsetWidth || parseFloat(item?.style?.width) || metrics.iconWidth;
    const height = item?.offsetHeight || parseFloat(item?.style?.height) || metrics.iconHeight;
    const column = index % metrics.columns;
    const row = Math.floor(index / metrics.columns);
    return clampDesktopLayoutRect({
        left: metrics.startX + column * (metrics.iconWidth + metrics.gapX) + Math.round((metrics.iconWidth - width) / 2),
        top: metrics.startY + row * (metrics.iconHeight + metrics.gapY),
        width,
        height
    }, pageArea);
}

function captureDesktopPageSlotRects(pageArea, options = {}) {
    if (!pageArea) return [];
    const items = getDesktopOrderedSlotItems(pageArea, true);
    const flowSlots = getDesktopFlowSlotRects(pageArea);
    const slotRects = options.compact
        ? getDesktopCompactSlotRects(pageArea, items, flowSlots)
        : getDesktopStableSlotRects(pageArea, items, flowSlots);
    if (slotRects.length) {
        const usedSlots = new Set();
        items.forEach(item => {
            const index = options.compact
                ? usedSlots.size
                : getNearestDesktopFlowSlotIndex(pageArea, item, slotRects, usedSlots, null);
            usedSlots.add(index);
            item.dataset.desktopSlot = String(index);
        });
        pageArea._desktopSlotRects = slotRects;
        return slotRects;
    }
    const slots = items.map((item, index) => {
        const rect = clampDesktopLayoutRect({
            left: parseFloat(item.style.left) || item.offsetLeft || 0,
            top: parseFloat(item.style.top) || item.offsetTop || 0,
            width: item.offsetWidth || parseFloat(item.style.width) || 72,
            height: item.offsetHeight || parseFloat(item.style.height) || 82
        }, pageArea);
        item.dataset.desktopSlot = String(index);
        return rect;
    });
    pageArea._desktopSlotRects = slots;
    return slots;
}

function ensureDesktopPageSlotRects(pageArea) {
    if (!pageArea) return [];
    if (Array.isArray(pageArea._desktopSlotRects) && pageArea._desktopSlotRects.length) return pageArea._desktopSlotRects;
    return captureDesktopPageSlotRects(pageArea);
}

function clearDesktopPageSlotRects() {
    document.querySelectorAll('#pages-container .desktop-scroll-area').forEach(area => {
        delete area._desktopSlotRects;
    });
    document.querySelectorAll('.desktop-layout-item[data-desktop-nudged-by]').forEach(item => {
        delete item.dataset.desktopNudgedBy;
    });
}

function getDesktopSlotRect(pageArea, slotIndex, item) {
    const index = Math.max(0, Number(slotIndex) || 0);
    const slots = ensureDesktopPageSlotRects(pageArea);
    const slot = slots[index];
    if (!slot) return getDesktopFallbackSlotRect(pageArea, index, item);
    const width = item?.offsetWidth || parseFloat(item?.style?.width) || slot.width || 72;
    const height = item?.offsetHeight || parseFloat(item?.style?.height) || slot.height || 82;
    return clampDesktopLayoutRect({
        left: slot.left + Math.round(((slot.width || width) - width) / 2),
        top: slot.top + Math.round(((slot.height || height) - height) / 2),
        width,
        height
    }, pageArea);
}

function getDesktopSlotIndexFromPoint(pageArea, point, item) {
    const rect = pageArea.getBoundingClientRect();
    const scale = getDesktopEditScale();
    const x = (point.x - rect.left) / scale + (pageArea.scrollLeft || 0);
    const y = (point.y - rect.top) / scale + (pageArea.scrollTop || 0);
    const slots = ensureDesktopPageSlotRects(pageArea);
    const items = getDesktopOrderedSlotItems(pageArea, true);
    const reorderCount = Math.max(1, items.length + (item && !items.includes(item) ? 1 : 0));
    const maxIndex = Math.max(0, Math.min(slots.length || reorderCount, reorderCount) - 1);
    if (!slots.length) {
        const metrics = getDesktopFallbackSlotMetrics(pageArea);
        const column = Math.max(0, Math.min(metrics.columns - 1, Math.round((x - metrics.startX - metrics.iconWidth / 2) / (metrics.iconWidth + metrics.gapX))));
        const row = Math.max(0, Math.floor((y - metrics.startY + metrics.iconHeight / 2) / (metrics.iconHeight + metrics.gapY)));
        return Math.max(0, Math.min(maxIndex, row * metrics.columns + column));
    }
    let bestIndex = 0;
    let bestDistance = Infinity;
    slots.forEach((slot, index) => {
        const cx = slot.left + slot.width / 2;
        const cy = slot.top + slot.height / 2;
        const distance = (x - cx) ** 2 + (y - cy) ** 2;
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    });
    return Math.max(0, Math.min(maxIndex, bestIndex));
}

function applyDesktopSlotOrder(pageArea, draggedItem, targetIndex) {
    if (!pageArea || !draggedItem || !draggedItem.classList.contains('layout-app')) return;
    const slots = ensureDesktopPageSlotRects(pageArea);
    if (!slots.length) return;
    const items = getDesktopOrderedSlotItems(pageArea, true).filter(item => item !== draggedItem);
    const index = Math.max(0, Math.min(Number(targetIndex) || 0, Math.min(slots.length, items.length + 1) - 1));
    const orderedItems = [...items];
    orderedItems.splice(index, 0, draggedItem);
    orderedItems.forEach((item, slotIndex) => {
        if (slotIndex >= slots.length) return;
        item.dataset.desktopSlot = String(slotIndex);
        const rect = getDesktopSlotRect(pageArea, slotIndex, item);
        item.style.left = `${Math.round(rect.left)}px`;
        item.style.top = `${Math.round(rect.top)}px`;
        item.style.width = `${Math.round(rect.width)}px`;
        item.style.height = `${Math.round(rect.height)}px`;
    });
}

function normalizeDesktopLayoutAppSlotSize(item, pageArea) {
    if (!item || !pageArea || !item.classList.contains('layout-app') || item.classList.contains('is-folder')) return;
    const metrics = getDesktopFallbackSlotMetrics(pageArea);
    item.style.width = `${metrics.iconWidth}px`;
    item.style.height = `${metrics.iconHeight}px`;
}

function insertDesktopAppAtSlot(pageArea, item, targetIndex) {
    if (!pageArea || !item || !item.classList.contains('layout-app')) return;
    delete pageArea._desktopSlotRects;
    const slots = ensureDesktopPageSlotRects(pageArea);
    const existingItems = getDesktopOrderedSlotItems(pageArea, true).filter(entry => entry !== item);
    const index = Math.max(0, Math.min(Number(targetIndex) || 0, existingItems.length));
    const orderedItems = [...existingItems];
    orderedItems.splice(index, 0, item);
    const capacity = slots.length || orderedItems.length;
    const overflowItems = [];
    orderedItems.forEach((entry, slotIndex) => {
        if (slotIndex >= capacity) {
            overflowItems.push(entry);
            return;
        }
        normalizeDesktopLayoutAppSlotSize(entry, pageArea);
        entry.dataset.desktopSlot = String(slotIndex);
        const rect = getDesktopSlotRect(pageArea, slotIndex, entry);
        entry.style.left = `${Math.round(rect.left)}px`;
        entry.style.top = `${Math.round(rect.top)}px`;
        entry.style.width = `${Math.round(rect.width)}px`;
        entry.style.height = `${Math.round(rect.height)}px`;
    });
    if (overflowItems.length) {
        const currentPage = pageArea.closest('.desktop-page');
        const nextIndex = getDesktopPageIndex(currentPage) + 1;
        const nextArea = ensureDesktopPage(nextIndex)?.querySelector('.desktop-scroll-area');
        if (nextArea) {
            nextArea.classList.add('layout-canvas');
            nextArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
            overflowItems.forEach((entry, overflowIndex) => {
                nextArea.appendChild(entry);
                entry.classList.add('desktop-layout-item', 'layout-app');
                setupDesktopLayoutItem(entry);
                placeDesktopAppInFirstOpenSlot(entry, nextArea, overflowIndex);
            });
        }
    }
}

function compactDesktopSlotOrder(pageArea, excludedItem = null, options = {}) {
    if (!pageArea) return;
    delete pageArea._desktopSlotRects;
    if (options.compact) captureDesktopPageSlotRects(pageArea, { compact: true });
    getDesktopOrderedSlotItems(pageArea, true).filter(item => item !== excludedItem).forEach((item, index) => {
        item.dataset.desktopSlot = String(index);
        const rect = getDesktopSlotRect(pageArea, index, item);
        item.style.left = `${Math.round(rect.left)}px`;
        item.style.top = `${Math.round(rect.top)}px`;
        item.style.width = `${Math.round(rect.width)}px`;
        item.style.height = `${Math.round(rect.height)}px`;
    });
    repairDesktopAppOverlaps(pageArea);
}

function getDesktopStyleRect(item, pageArea) {
    if (!item || !pageArea) return null;
    return clampDesktopLayoutRect(getDesktopRawStyleRect(item), pageArea);
}

function getDesktopRectIntersectionRatio(a, b) {
    if (!a || !b) return 0;
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.left + a.width, b.left + b.width);
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.top + a.height, b.top + b.height);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    const area = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
    return (width * height) / area;
}

function scoreDesktopCandidateOverlap(candidate, pageArea, ignoreItems = []) {
    const ignored = new Set(ignoreItems.filter(Boolean));
    return Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item'))
        .filter(item => !ignored.has(item))
        .reduce((score, item) => {
            const rect = getDesktopStyleRect(item, pageArea);
            return Math.max(score, getDesktopRectIntersectionRatio(candidate, rect));
        }, 0);
}

function nudgeDesktopLayoutObstacles(dragItem, pageArea) {
    if (!dragItem || !pageArea || !dragItem.classList.contains('layout-app')) return false;
    const dragRect = getDesktopStyleRect(dragItem, pageArea);
    if (!dragRect) return false;
    const dragKey = dragItem.dataset.layoutId || 'dragging';
    const obstacles = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item:not(.layout-app)'));
    let hasObstacle = false;
    obstacles.forEach(obstacle => {
        const obstacleRect = getDesktopStyleRect(obstacle, pageArea);
        if (!obstacleRect) return;
        if (getDesktopRectIntersectionRatio(dragRect, obstacleRect) < 0.22) return;
        hasObstacle = true;
        if (obstacle.dataset.desktopNudgedBy === dragKey) return;
        const gap = 12;
        const attempts = [
            { ...obstacleRect, left: obstacleRect.left - dragRect.width - gap },
            { ...obstacleRect, left: obstacleRect.left + dragRect.width + gap },
            { ...obstacleRect, top: obstacleRect.top + dragRect.height + gap },
            { ...obstacleRect, top: obstacleRect.top - dragRect.height - gap }
        ].map(rect => clampDesktopLayoutRect(rect, pageArea));
        const best = attempts
            .map(rect => ({
                rect,
                score: Math.max(
                    getDesktopRectIntersectionRatio(rect, dragRect),
                    scoreDesktopCandidateOverlap(rect, pageArea, [dragItem, obstacle])
                )
            }))
            .sort((a, b) => a.score - b.score)[0];
        if (!best || best.score > 0.42) return;
        obstacle.dataset.desktopNudgedBy = dragKey;
        obstacle.style.left = `${Math.round(best.rect.left)}px`;
        obstacle.style.top = `${Math.round(best.rect.top)}px`;
        obstacle.style.width = `${Math.round(best.rect.width)}px`;
        obstacle.style.height = `${Math.round(best.rect.height)}px`;
    });
    return hasObstacle;
}

function findDesktopOpenAppRect(pageArea, item, preferredRect) {
    if (!pageArea || !item) return preferredRect || null;
    const metrics = getDesktopFallbackSlotMetrics(pageArea);
    const width = item.offsetWidth || parseFloat(item.style.width) || metrics.iconWidth;
    const height = item.offsetHeight || parseFloat(item.style.height) || metrics.iconHeight;
    const flowSlots = getDesktopFlowSlotRects(pageArea);
    const candidates = flowSlots.map(slot => clampDesktopLayoutRect({
        left: slot.left + Math.round(((slot.width || width) - width) / 2),
        top: slot.top + Math.round(((slot.height || height) - height) / 2),
        width,
        height
    }, pageArea));
    if (!candidates.length) {
        const areaHeight = Math.max(520, pageArea.clientHeight || 590);
        const maxTop = Math.max(metrics.startY, areaHeight - metrics.iconHeight - 8);
        const maxRows = Math.max(1, Math.floor((maxTop - metrics.startY) / (metrics.iconHeight + metrics.gapY)) + 1);
        for (let row = 0; row < maxRows; row += 1) {
            for (let col = 0; col < metrics.columns; col += 1) {
                candidates.push(clampDesktopLayoutRect({
                    left: metrics.startX + col * (metrics.iconWidth + metrics.gapX) + Math.round((metrics.iconWidth - width) / 2),
                    top: metrics.startY + row * (metrics.iconHeight + metrics.gapY),
                    width,
                    height
                }, pageArea));
            }
        }
    }
    const source = preferredRect || getDesktopStyleRect(item, pageArea) || candidates[0];
    const scored = candidates.map(rect => ({
        rect,
        overlap: scoreDesktopCandidateOverlap(rect, pageArea, [item]),
        distance: source ? Math.abs(rect.left - source.left) + Math.abs(rect.top - source.top) : 0
    })).sort((a, b) => (a.overlap - b.overlap) || (a.distance - b.distance));
    return (scored.find(entry => entry.overlap < 0.16) || scored[0])?.rect || source;
}

function repairDesktopAppOverlaps(pageArea) {
    if (!pageArea || !hasDesktopUsableLayoutBounds(pageArea)) return false;
    const items = getDesktopOrderedSlotItems(pageArea, true);
    const placed = [];
    let changed = false;
    items.forEach(item => {
        let rect = getDesktopStyleRect(item, pageArea);
        const overlapsPlaced = placed.some(entry => getDesktopRectIntersectionRatio(rect, entry.rect) > 0.08);
        const overlapsWidget = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item:not(.layout-app)'))
            .some(widget => getDesktopRectIntersectionRatio(rect, getDesktopStyleRect(widget, pageArea)) > 0.34);
        if (overlapsPlaced || overlapsWidget) {
            rect = findDesktopOpenAppRect(pageArea, item, rect);
            item.style.left = `${Math.round(rect.left)}px`;
            item.style.top = `${Math.round(rect.top)}px`;
            item.style.width = `${Math.round(rect.width)}px`;
            item.style.height = `${Math.round(rect.height)}px`;
            changed = true;
        }
        placed.push({ item, rect });
    });
    if (changed) captureDesktopPageSlotRects(pageArea);
    return changed;
}

function repairDesktopWidgetOverlaps(pageArea) {
    if (!pageArea || !hasDesktopUsableLayoutBounds(pageArea)) return false;
    const items = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item:not(.layout-app)'))
        .sort((a, b) => {
            const ar = getDesktopRawStyleRect(a);
            const br = getDesktopRawStyleRect(b);
            if (Math.abs(ar.top - br.top) > 8) return ar.top - br.top;
            return ar.left - br.left;
        });
    const placed = [];
    let changed = false;
    items.forEach(item => {
        let rect = getDesktopStyleRect(item, pageArea);
        if (!rect) return;
        const overlapsPlaced = placed.some(entry => getDesktopRectIntersectionRatio(rect, entry.rect) > 0.16);
        if (overlapsPlaced) {
            const currentScore = scoreDesktopCandidateOverlap(rect, pageArea, [item]);
            const candidate = findDesktopOpenWidgetRect(pageArea, {
                width: rect.width,
                height: rect.height
            }, rect, [item]);
            const candidateScore = candidate ? scoreDesktopCandidateOverlap(candidate, pageArea, [item]) : Infinity;
            if (candidate && candidateScore + 0.01 < currentScore && candidateScore < 0.34) {
                setDesktopLayoutItemRect(item, candidate);
                rect = candidate;
                changed = true;
            }
        }
        placed.push({ item, rect });
    });
    return changed;
}

function repairDesktopLayoutOverlaps() {
    let changed = false;
    document.querySelectorAll('#pages-container .desktop-scroll-area.layout-canvas').forEach(pageArea => {
        if (!hasDesktopUsableLayoutBounds(pageArea)) return;
        if (repairDesktopWidgetOverlaps(pageArea)) changed = true;
        if (repairDesktopAppOverlaps(pageArea)) changed = true;
    });
    return changed;
}

function settleDesktopAppsAroundWidget(widgetItem, pageArea) {
    if (!widgetItem || !pageArea || widgetItem.classList.contains('layout-app')) return;
    delete pageArea._desktopSlotRects;
    captureDesktopPageSlotRects(pageArea, { compact: true });
    compactDesktopSlotOrder(pageArea, null, { compact: true });
    repairDesktopAppOverlaps(pageArea);
}

function isPointInsideDesktopDock(point) {
    const dock = document.querySelector('#home-screen .dock-bar');
    if (!dock) return false;
    const rect = dock.getBoundingClientRect();
    const hitWidth = Math.max(rect.width, 220);
    const centerX = rect.left + rect.width / 2;
    const left = centerX - hitWidth / 2;
    const right = centerX + hitWidth / 2;
    return point.x >= left - 10 && point.x <= right + 10 && point.y >= rect.top - 18 && point.y <= rect.bottom + 18;
}

function getDesktopPageAreaFromPoint(point) {
    if (!point || isPointInsideDesktopDock(point)) return null;
    const target = document.elementFromPoint(point.x, point.y);
    if (target?.closest?.('.desktop-edit-toolbar, .desktop-widget-library, .desktop-save-modal, .folder-overlay')) return null;
    const directArea = target?.closest?.('.desktop-scroll-area');
    if (directArea) return directArea;
    const directPage = target?.closest?.('.desktop-page');
    if (directPage) return directPage.querySelector('.desktop-scroll-area');

    const pages = getDesktopPages();
    for (const page of pages) {
        const rect = page.getBoundingClientRect();
        if (point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) {
            return page.querySelector('.desktop-scroll-area');
        }
    }

    const container = document.getElementById('pages-container');
    const home = document.getElementById('home-screen');
    const scopeRect = container?.getBoundingClientRect?.() || home?.getBoundingClientRect?.();
    if (scopeRect && point.x >= scopeRect.left - 12 && point.x <= scopeRect.right + 12 && point.y >= scopeRect.top - 12 && point.y <= scopeRect.bottom + 90) {
        return getPreferredDesktopPageArea();
    }
    return null;
}

function getDesktopDragEdgeDirection(point) {
    if (!point || isPointInsideDesktopDock(point)) return '';
    const container = document.getElementById('pages-container');
    const rect = container?.getBoundingClientRect?.();
    if (!rect || point.y < rect.top - 20 || point.y > rect.bottom + 20) return '';
    const edgeSize = 34;
    if (point.x <= rect.left + edgeSize) return 'left';
    if (point.x >= rect.right - edgeSize) return 'right';
    return '';
}

function getDesktopEdgePageAreaForDrag(point, currentPageArea) {
    if (!point || !currentPageArea || isPointInsideDesktopDock(point)) return null;
    const container = document.getElementById('pages-container');
    const rect = container?.getBoundingClientRect?.();
    if (!rect || point.y < rect.top - 20 || point.y > rect.bottom + 20) return null;
    const pages = getDesktopPages();
    const currentIndex = getDesktopPageIndex(currentPageArea.closest('.desktop-page'));
    const edgeDirection = getDesktopDragEdgeDirection(point);
    let targetIndex = currentIndex;
    if (edgeDirection === 'left') targetIndex = currentIndex - 1;
    if (edgeDirection === 'right') targetIndex = currentIndex + 1;
    if (targetIndex === currentIndex || targetIndex < 0 || targetIndex >= pages.length) return null;
    return pages[targetIndex]?.querySelector('.desktop-scroll-area') || null;
}

function getDesktopDockItemAppId(item) {
    if (!item) return '';
    if (item.dataset.appId) return item.dataset.appId;
    const onclick = item.getAttribute('onclick') || '';
    const match = onclick.match(/openApp\(['"]([^'"]+)['"]\)/);
    if (match?.[1]) return match[1];
    const label = item.querySelector('.dock-label, span')?.textContent?.trim();
    return getDesktopAllAppDefinitions().find(app => app.name === label)?.id || '';
}

function hydrateDesktopDockItem(item) {
    const appId = getDesktopDockItemAppId(item);
    if (!item || !appId) return null;
    const app = getDesktopAnyAppDefinition(appId);
    if (!app) return null;
    item.dataset.appId = app.id;
    item.dataset.layoutId = `app-${app.id}`;
    item.onclick = () => openApp(app.id);
    if (!item.querySelector('.dock-icon-box')) {
        const icon = document.createElement('div');
        icon.className = 'dock-icon-box';
        item.insertBefore(icon, item.firstChild);
    }
    if (!item.querySelector('.dock-label')) {
        const label = document.createElement('span');
        label.className = 'dock-label';
        item.appendChild(label);
    }
    return app;
}

function createDesktopDockItem(appRef) {
    const app = getDesktopAppDefinition(appRef);
    const el = document.createElement('div');
    el.className = 'dock-item';
    el.dataset.appId = app.id;
    el.dataset.layoutId = `app-${app.id}`;
    el.onclick = () => openApp(app.id);
    el.innerHTML = `<div class="dock-icon-box">${renderDesktopAppIcon(app)}</div><span class="dock-label">${desktopEscapeHtml(app.name)}</span>`;
    setupDesktopDockItem(el);
    return el;
}

function getDesktopDockItems() {
    const dock = document.querySelector('#home-screen .dock-bar');
    return dock ? Array.from(dock.querySelectorAll(':scope > .dock-item')) : [];
}

function getDesktopDockInsertIndex(point, draggedItem) {
    if (!point) return getDesktopDockItems().length;
    const items = getDesktopDockItems().filter(item => item !== draggedItem);
    if (!items.length) return 0;
    for (let i = 0; i < items.length; i += 1) {
        const rect = items[i].getBoundingClientRect();
        if (point.x < rect.left + rect.width / 2) return i;
    }
    return items.length;
}

function refreshDesktopDockOrder() {
    getDesktopDockItems().forEach((item, index) => {
        hydrateDesktopDockItem(item);
        item.dataset.dockIndex = String(index);
        setupDesktopDockItem(item);
    });
}

function setupDesktopDockItem(item) {
    if (!item || item._dockLayoutReady) return;
    item._dockLayoutReady = true;
    item.dataset.dockLayoutReady = '1';
    item.addEventListener('pointerdown', startDesktopDockItemDrag, true);
    item.addEventListener('click', (e) => {
        if (!window._editMode) return;
        e.preventDefault();
        e.stopPropagation();
        selectDesktopLayoutItem(item);
    }, true);
}

function setupDesktopDockEditing() {
    refreshDesktopDockOrder();
}

function collectDesktopDockLayout() {
    return getDesktopDockItems()
        .map(item => getDesktopDockItemAppId(item))
        .filter(Boolean)
        .filter((appId, index, arr) => arr.indexOf(appId) === index);
}

function applyDesktopDockLayout(appIds) {
    const dock = document.querySelector('#home-screen .dock-bar');
    if (!dock || !Array.isArray(appIds)) return;
    const unique = appIds.filter((appId, index, arr) => appId && arr.indexOf(appId) === index);
    dock.innerHTML = '';
    unique.slice(0, DESKTOP_DOCK_LAYOUT_MAX).forEach(appId => {
        const app = getDesktopAnyAppDefinition(appId);
        if (app) dock.appendChild(createDesktopDockItem(app));
    });
    refreshDesktopDockOrder();
}

function getDesktopAppElementForTransfer(appId) {
    if (!appId) return null;
    let item = Array.from(document.querySelectorAll('.desktop-layout-item.layout-app')).find(el => getDesktopAppIdFromElement(el) === appId);
    if (item) return item;
    const app = getDesktopAnyAppDefinition(appId);
    return app ? createDesktopAppElement(app) : null;
}

function getPreferredDesktopPageArea() {
    const index = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
    return ensureDesktopPage(index)?.querySelector('.desktop-scroll-area') || document.querySelector('#pages-container .desktop-page .desktop-scroll-area');
}

function findDesktopFirstOpenAppSlotRect(pageArea, item, preferredIndex = 0, options = {}) {
    if (!pageArea || !item) return null;
    delete pageArea._desktopSlotRects;
    const metrics = getDesktopFallbackSlotMetrics(pageArea);
    const width = item.offsetWidth || parseFloat(item.style.width) || metrics.iconWidth;
    const height = item.offsetHeight || parseFloat(item.style.height) || metrics.iconHeight;
    const slots = getDesktopFlowSlotRects(pageArea);
    const start = Math.max(0, Number(preferredIndex) || 0);
    const orderedSlots = slots
        .map((slot, index) => ({ slot, index }))
        .sort((a, b) => {
            const aWrapped = a.index < start ? a.index + slots.length : a.index;
            const bWrapped = b.index < start ? b.index + slots.length : b.index;
            return aWrapped - bWrapped;
        });
    const candidates = orderedSlots.map(entry => ({
        slotIndex: entry.index,
        rect: clampDesktopLayoutRect({
            left: entry.slot.left + Math.round(((entry.slot.width || width) - width) / 2),
            top: entry.slot.top + Math.round(((entry.slot.height || height) - height) / 2),
            width,
            height
        }, pageArea)
    }));
    const free = candidates.find(entry => scoreDesktopCandidateOverlap(entry.rect, pageArea, [item]) < 0.08);
    if (options.strictOpenSlot) {
        if (free) {
            item.dataset.desktopSlot = String(free.slotIndex);
            return free.rect;
        }
        return null;
    }
    const best = free || candidates
        .map(entry => ({ ...entry, score: scoreDesktopCandidateOverlap(entry.rect, pageArea, [item]) }))
        .sort((a, b) => a.score - b.score)[0];
    if (best) {
        item.dataset.desktopSlot = String(best.slotIndex);
        return best.rect;
    }
    return findDesktopOpenAppRect(pageArea, item, getDesktopFallbackSlotRect(pageArea, start, item));
}

function placeDesktopAppInFirstOpenSlot(item, preferredArea, preferredIndex = 0, options = {}) {
    const pageArea = preferredArea || getPreferredDesktopPageArea();
    if (!item || !pageArea) return false;
    pageArea.classList.add('layout-canvas');
    pageArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    if (item.parentElement !== pageArea) pageArea.appendChild(item);
    item.classList.add('desktop-layout-item', 'layout-app');
    item.dataset.layoutId = item.dataset.layoutId || `app-${getDesktopAppIdFromElement(item)}`;
    item.dataset.layoutType = item.dataset.layoutType || (item.classList.contains('is-folder') ? 'folder' : 'app');
    normalizeDesktopLayoutAppSlotSize(item, pageArea);
    item.style.removeProperty('transform');
    item.style.removeProperty('position');
    setupDesktopLayoutItem(item);
    const slot = Math.max(0, Number(preferredIndex) || 0);
    const rect = findDesktopFirstOpenAppSlotRect(pageArea, item, slot, options);
    if (!rect) {
        item.remove();
        return false;
    }
    prepareDesktopLayoutItem(item, pageArea, rect);
    if (!options.strictOpenSlot) repairDesktopAppOverlaps(pageArea);
    captureDesktopPageSlotRects(pageArea);
    return true;
}

function removeDesktopDuplicateAppIcons(appId, keepItem) {
    if (!appId) return;
    document.querySelectorAll('.desktop-layout-item.layout-app').forEach(item => {
        if (item === keepItem) return;
        if (getDesktopAppIdFromElement(item) === appId) item.remove();
    });
    getDesktopDockItems().forEach(item => {
        if (item === keepItem) return;
        if (getDesktopDockItemAppId(item) === appId) item.remove();
    });
}

function moveDesktopAppItemToDock(sourceItem, insertIndex) {
    const dock = document.querySelector('#home-screen .dock-bar');
    if (!dock || !sourceItem) return false;
    const appId = getDesktopAppIdFromElement(sourceItem) || getDesktopDockItemAppId(sourceItem);
    const app = getDesktopAnyAppDefinition(appId);
    if (!app) return false;
    const originArea = sourceItem.closest?.('.desktop-scroll-area') || getPreferredDesktopPageArea();
    const dockItem = sourceItem.classList.contains('dock-item') ? sourceItem : createDesktopDockItem(app);
    removeDesktopDuplicateAppIcons(appId, dockItem);
    if (sourceItem !== dockItem) {
        sourceItem.remove();
        compactDesktopSlotOrder(originArea);
    }
    const items = getDesktopDockItems().filter(item => item !== dockItem);
    const index = Math.max(0, Math.min(Number(insertIndex) || 0, items.length));
    dock.insertBefore(dockItem, items[index] || null);
    while (getDesktopDockItems().length > DESKTOP_DOCK_LAYOUT_MAX) {
        const overflow = getDesktopDockItems().find(item => item !== dockItem && Number(item.dataset.dockIndex) >= DESKTOP_DOCK_LAYOUT_MAX - 1)
            || getDesktopDockItems().find(item => item !== dockItem)
            || getDesktopDockItems()[DESKTOP_DOCK_LAYOUT_MAX];
        if (!overflow) break;
        const overflowId = getDesktopDockItemAppId(overflow);
        overflow.remove();
        const overflowApp = getDesktopAnyAppDefinition(overflowId);
        if (overflowApp) placeDesktopAppInFirstOpenSlot(createDesktopAppElement(overflowApp), originArea);
    }
    refreshDesktopDockOrder();
    return true;
}

function moveDesktopDockItemToPage(dockItem, pageArea, targetIndex) {
    if (!dockItem || !pageArea) return null;
    const appId = getDesktopDockItemAppId(dockItem);
    const app = getDesktopAnyAppDefinition(appId);
    if (!app) return null;
    const item = createDesktopAppElement(app);
    removeDesktopDuplicateAppIcons(app.id, item);
    delete pageArea._desktopSlotRects;
    dockItem.remove();
    pageArea.classList.add('layout-canvas');
    pageArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    pageArea.appendChild(item);
    item.classList.add('desktop-layout-item', 'layout-app');
    item.dataset.layoutId = item.dataset.layoutId || `app-${app.id}`;
    item.dataset.layoutType = 'app';
    normalizeDesktopLayoutAppSlotSize(item, pageArea);
    item.style.removeProperty('transform');
    item.style.removeProperty('position');
    setupDesktopLayoutItem(item);
    const index = Number.isFinite(targetIndex) ? targetIndex : getDesktopOrderedSlotItems(pageArea, true).length - 1;
    insertDesktopAppAtSlot(pageArea, item, index);
    refreshDesktopDockOrder();
    return item;
}

function mergeDesktopDockItemIntoFolder(dockItem, targetItem, pageArea) {
    if (!dockItem || !targetItem || !pageArea) return false;
    const appId = getDesktopDockItemAppId(dockItem);
    const sourceApp = getDesktopAnyAppDefinition(appId);
    if (!sourceApp) return false;
    let folder = null;
    let folderItem = null;
    if (targetItem.classList.contains('is-folder')) {
        folder = window._folders.find(f => f.id === targetItem.dataset.folderId);
        if (!folder || folder.apps?.some(app => app?.id === sourceApp.id)) return false;
        folder.apps.push(normalizeDesktopAppRef(sourceApp));
        saveFolders();
        dockItem.remove();
        syncDesktopFolderIcon(folder.id);
        folderItem = targetItem;
    } else {
        const targetApp = getDesktopLayoutItemAppRef(targetItem);
        if (!targetApp || targetApp.id === sourceApp.id) return false;
        folder = {
            id: 'folder_' + Date.now(),
            name: '文件夹',
            apps: [normalizeDesktopAppRef(targetApp), normalizeDesktopAppRef(sourceApp)],
            width: null,
            height: null,
            size: 'small'
        };
        window._folders.push(folder);
        saveFolders();
        const rect = {
            left: parseFloat(targetItem.style.left) || targetItem.offsetLeft || 24,
            top: parseFloat(targetItem.style.top) || targetItem.offsetTop || 64,
            width: targetItem.offsetWidth || 72,
            height: targetItem.offsetHeight || 76
        };
        folderItem = createDesktopFolderElement(folder);
        pageArea.appendChild(folderItem);
        prepareDesktopLayoutItem(folderItem, pageArea, rect);
        targetItem.remove();
        dockItem.remove();
    }
    if (!folderItem) return false;
    removeDesktopDuplicateAppIcons(sourceApp.id, folderItem);
    folderItem.classList.remove('desktop-folder-merge-target');
    playDesktopFolderMergeAnimation(folderItem);
    selectDesktopLayoutItem(folderItem);
    refreshDesktopDockOrder();
    if (typeof showWechatToast === 'function') showWechatToast('已合并为文件夹');
    return true;
}

function startDesktopDockItemDrag(e) {
    if (!window._editMode) return;
    const dockItem = e.currentTarget;
    if (!dockItem) return;
    const dockApp = hydrateDesktopDockItem(dockItem);
    if (!dockApp) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof dockItem.setPointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
        try { dockItem.setPointerCapture(e.pointerId); } catch (err) {}
    }
    selectDesktopLayoutItem(dockItem);
    const startPoint = getDesktopPointerPoint(e);
    const previousPointerEvents = dockItem.style.pointerEvents;
    let pendingFolderMergeTarget = null;
    const setPendingFolderMergeTarget = target => {
        if (pendingFolderMergeTarget && pendingFolderMergeTarget !== target) {
            pendingFolderMergeTarget.classList.remove('desktop-folder-merge-target');
        }
        pendingFolderMergeTarget = target || null;
        if (pendingFolderMergeTarget) pendingFolderMergeTarget.classList.add('desktop-folder-merge-target');
    };
    const clearPendingFolderMergeTarget = () => setPendingFolderMergeTarget(null);
    dockItem.style.pointerEvents = 'none';
    const ghost = dockItem.cloneNode(true);
    ghost.classList.add('dock-drag-ghost');
    document.body.appendChild(ghost);
    const moveGhost = point => {
        ghost.style.left = `${Math.round(point.x - ghost.offsetWidth / 2)}px`;
        ghost.style.top = `${Math.round(point.y - ghost.offsetHeight / 2)}px`;
    };
    moveGhost(startPoint);

    const move = ev => {
        const point = getDesktopPointerPoint(ev);
        moveGhost(point);
        if (isPointInsideDesktopDock(point)) {
            clearPendingFolderMergeTarget();
            const index = getDesktopDockInsertIndex(point, dockItem);
            const items = getDesktopDockItems().filter(item => item !== dockItem);
            document.querySelector('#home-screen .dock-bar')?.insertBefore(dockItem, items[index] || null);
            refreshDesktopDockOrder();
            return;
        }
        const targetArea = getDesktopPageAreaFromPoint(point);
        if (targetArea) {
            ensureDesktopPageSlotRects(targetArea);
            setPendingFolderMergeTarget(findDesktopDockFolderMergeTarget(targetArea, point, dockApp.id));
        } else {
            clearPendingFolderMergeTarget();
        }
    };
    const up = ev => {
        const point = getDesktopPointerPoint(ev);
        if (typeof dockItem.releasePointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
            try { dockItem.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        dockItem.style.pointerEvents = previousPointerEvents;
        ghost.remove();
        const targetArea = getDesktopPageAreaFromPoint(point);
        if (targetArea && !isPointInsideDesktopDock(point)) {
            const mergeTarget = pendingFolderMergeTarget || findDesktopDockFolderMergeTarget(targetArea, point, dockApp.id);
            if (mergeTarget && mergeDesktopDockItemIntoFolder(dockItem, mergeTarget, targetArea)) {
                clearPendingFolderMergeTarget();
            } else {
                clearPendingFolderMergeTarget();
                const targetIndex = getDesktopSlotIndexFromPoint(targetArea, point, null);
                const pageItem = moveDesktopDockItemToPage(dockItem, targetArea, targetIndex);
                if (pageItem) selectDesktopLayoutItem(pageItem);
            }
        } else {
            clearPendingFolderMergeTarget();
            const index = getDesktopDockInsertIndex(point, dockItem);
            const items = getDesktopDockItems().filter(item => item !== dockItem);
            document.querySelector('#home-screen .dock-bar')?.insertBefore(dockItem, items[index] || null);
            refreshDesktopDockOrder();
        }
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
}

function mergeDesktopLayoutAppsIntoFolder(sourceItem, targetItem, pageArea) {
    const sourceApp = getDesktopLayoutItemAppRef(sourceItem);
    if (!sourceApp || !targetItem || !pageArea) return false;
    let folder = null;
    let animatedFolderItem = null;
    if (targetItem.classList.contains('is-folder')) {
        folder = window._folders.find(f => f.id === targetItem.dataset.folderId);
        if (!folder) return false;
        addToFolder(folder.id, sourceApp);
        sourceItem.remove();
        animatedFolderItem = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item.is-folder'))
            .find(item => item.dataset.folderId === folder.id) || targetItem;
    } else {
        const targetApp = getDesktopLayoutItemAppRef(targetItem);
        if (!targetApp || targetApp.id === sourceApp.id) return false;
        folder = {
            id: 'folder_' + Date.now(),
            name: '文件夹',
            apps: [normalizeDesktopAppRef(targetApp), normalizeDesktopAppRef(sourceApp)],
            width: null,
            height: null,
            size: 'small'
        };
        window._folders.push(folder);
        saveFolders();
        const rect = {
            left: parseFloat(targetItem.style.left) || targetItem.offsetLeft || 24,
            top: parseFloat(targetItem.style.top) || targetItem.offsetTop || 64,
            width: targetItem.offsetWidth || 72,
            height: targetItem.offsetHeight || 76
        };
        const folderItem = createDesktopFolderElement(folder);
        pageArea.appendChild(folderItem);
        prepareDesktopLayoutItem(folderItem, pageArea, rect);
        targetItem.remove();
        sourceItem.remove();
        animatedFolderItem = folderItem;
        selectDesktopLayoutItem(folderItem);
    }
    if (folder) {
        saveFolders();
        if (animatedFolderItem) playDesktopFolderMergeAnimation(animatedFolderItem);
        if (typeof showWechatToast === 'function') showWechatToast('已合并为文件夹');
        return true;
    }
    return false;
}

function playDesktopFolderMergeAnimation(folderItem) {
    if (!folderItem) return;
    folderItem.classList.remove('desktop-folder-created');
    void folderItem.offsetWidth;
    folderItem.classList.add('desktop-folder-created');
    setTimeout(() => folderItem.classList.remove('desktop-folder-created'), 420);
}

function centerSelectedDesktopItem() {
    const item = window._desktopSelectedLayoutItem;
    const pageArea = item?.closest?.('.desktop-scroll-area');
    if (!window._editMode || !item || !pageArea) return;
    const width = item.offsetWidth || parseFloat(item.style.width) || 118;
    const height = item.offsetHeight || parseFloat(item.style.height) || 96;
    const top = parseFloat(item.style.top) || item.offsetTop || 8;
    const areaRect = pageArea.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const style = getComputedStyle(pageArea);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const scaleX = itemRect.width > 0 && width > 0
        ? itemRect.width / width
        : (areaRect.width > 0 && pageArea.clientWidth > 0 ? areaRect.width / pageArea.clientWidth : 1);
    const visualCenteredLeft = scaleX > 0
        ? ((areaRect.width - itemRect.width) / 2) / scaleX - paddingLeft
        : (pageArea.clientWidth - width) / 2;
    const centeredLeft = Math.round(Number.isFinite(visualCenteredLeft) ? visualCenteredLeft : (pageArea.clientWidth - width) / 2);
    const safe = clampDesktopLayoutRect({
        left: Math.max(8, centeredLeft),
        top,
        width,
        height
    }, pageArea);
    setDesktopLayoutItemRect(item, safe);
    delete pageArea._desktopSlotRects;
    showDesktopSnapGuides(pageArea, {
        ...safe,
        guideX: Math.round(safe.left + safe.width / 2),
        guideY: Math.round(safe.top + safe.height / 2),
        centerX: true,
        centerY: false,
        mode: 'move'
    });
    setTimeout(() => hideDesktopSnapGuides(pageArea), 520);
    if (typeof showWechatToast === 'function') showWechatToast('已居中');
}
window.centerSelectedDesktopItem = centerSelectedDesktopItem;

function startDesktopItemDrag(e) {
    if (!window._editMode || e.target.closest('.desktop-resize-handle, .desktop-item-center, .desktop-item-move-page, .desktop-item-delete')) return;
    const item = e.currentTarget;
    const isPolaroidWidget = item.classList.contains('desktop-widget-polaroid');
    if (e.target.closest('.pw-note, .dsw-avatar, .dsw-avatar-input, .dsw-weather, .dsw-steps, .lcw-input, .dnw-tone-picker, .lcw-bubble-palette, .lcw-bubble-custom, .lcw-title-palette')) return;
    if (!isPolaroidWidget && !item.classList.contains('desktop-custom-widget') && e.target.closest('.lcw-control')) return;
    const pageArea = item.closest('.desktop-scroll-area');
    if (!pageArea) return;
    const sourcePageRect = pageArea.getBoundingClientRect();
    delete item.dataset.desktopDragMoved;
    e.preventDefault();
    e.stopPropagation();
    if (typeof item.setPointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
        try { item.setPointerCapture(e.pointerId); } catch (err) {}
    }
    selectDesktopLayoutItem(item);
    item.classList.add('desktop-layout-dragging');
    const startPoint = getDesktopPointerPoint(e);
    const startX = startPoint.x;
    const startY = startPoint.y;
    const startLeft = parseFloat(item.style.left) || 0;
    const startTop = parseFloat(item.style.top) || 0;
    const scale = getDesktopEditScale();
    const isAppIcon = item.classList.contains('layout-app');
    const isFolderIcon = item.classList.contains('is-folder') && !!item.dataset.folderId;
    const canMoveAcrossPages = isAppIcon || item.classList.contains('desktop-custom-widget') || item.classList.contains('calendar-widget') || item.classList.contains('photo-large');
    let currentPageArea = pageArea;
    let movedToPageIndex = getDesktopPageIndex(pageArea.closest('.desktop-page'));
    let hasMoved = false;
    let maxMovedDistance = 0;
    let pendingDockIndex = -1;
    let lockedEdgeDirection = '';
    let edgeHoverDirection = '';
    let edgeHoverSince = 0;
    let pendingFolderMergeTarget = null;
    const setPendingFolderMergeTarget = target => {
        if (pendingFolderMergeTarget && pendingFolderMergeTarget !== target) {
            pendingFolderMergeTarget.classList.remove('desktop-folder-merge-target');
        }
        pendingFolderMergeTarget = target || null;
        if (pendingFolderMergeTarget) pendingFolderMergeTarget.classList.add('desktop-folder-merge-target');
    };
    const clearPendingFolderMergeTarget = () => setPendingFolderMergeTarget(null);
    if (isAppIcon) {
        item.classList.add('desktop-slot-dragging');
        captureDesktopPageSlotRects(pageArea);
    }

    const move = (ev) => {
        const point = getDesktopPointerPoint(ev);
        const movedDistance = Math.hypot(point.x - startX, point.y - startY);
        maxMovedDistance = Math.max(maxMovedDistance, movedDistance);
        const moveThreshold = isFolderIcon ? 16 : 6;
        if (movedDistance > moveThreshold) {
            hasMoved = true;
            item.dataset.desktopDragMoved = '1';
        }
        if (!hasMoved) return;
        const activeArea = currentPageArea || pageArea;
        const pointerMergeTarget = isAppIcon ? findDesktopFolderMergeTarget(item, activeArea, point) : null;
        const pointerSlotIndex = isAppIcon ? getDesktopSlotIndexFromPoint(activeArea, point, item) : -1;
        const currentSlotIndex = isAppIcon ? Number(item.dataset.desktopSlot) : -1;
        const pointerIsOnDesktopIcon = !!pointerMergeTarget
            || (Number.isFinite(pointerSlotIndex) && Number.isFinite(currentSlotIndex) && pointerSlotIndex !== currentSlotIndex);
        const edgeDirection = pointerIsOnDesktopIcon ? '' : getDesktopDragEdgeDirection(point);
        if (!edgeDirection) {
            lockedEdgeDirection = '';
            edgeHoverDirection = '';
            edgeHoverSince = 0;
        } else if (edgeDirection !== edgeHoverDirection) {
            edgeHoverDirection = edgeDirection;
            edgeHoverSince = Date.now();
        }
        if (edgeDirection && edgeDirection !== lockedEdgeDirection && Date.now() - edgeHoverSince < 760) {
            edgeHoverDirection = edgeDirection;
        }
        const edgeReady = edgeDirection && edgeDirection !== lockedEdgeDirection && Date.now() - edgeHoverSince >= 760;
        const edgePageArea = edgeReady ? getDesktopEdgePageAreaForDrag(point, currentPageArea) : null;
        const targetPageArea = edgePageArea || getDesktopPageAreaFromPoint(point);
        if (canMoveAcrossPages && targetPageArea && targetPageArea !== currentPageArea && !isPointInsideDesktopDock(point)) {
            targetPageArea.classList.add('layout-canvas');
            targetPageArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
            if (isAppIcon) compactDesktopSlotOrder(currentPageArea);
            targetPageArea.appendChild(item);
            currentPageArea = targetPageArea;
            movedToPageIndex = getDesktopPageIndex(targetPageArea.closest('.desktop-page'));
            if (typeof window.goToDesktopPage === 'function') window.goToDesktopPage(movedToPageIndex);
            if (isAppIcon) captureDesktopPageSlotRects(currentPageArea);
            if (edgePageArea) lockedEdgeDirection = edgeDirection;
        }
        if (isAppIcon && isPointInsideDesktopDock(point)) {
            pendingDockIndex = getDesktopDockInsertIndex(point, null);
            item.classList.add('desktop-dock-drop-ready');
            clearPendingFolderMergeTarget();
            return;
        }
        pendingDockIndex = -1;
        item.classList.remove('desktop-dock-drop-ready');
        const area = currentPageArea || pageArea;
        const areaRect = area.getBoundingClientRect();
        const maxLeft = Math.max(8, area.clientWidth - item.offsetWidth - 8);
        const maxTop = Math.max(8, area.clientHeight - item.offsetHeight - 8);
        const dx = (point.x - startX) / scale;
        const dy = (point.y - startY) / scale;
        const sourceOffsetX = (sourcePageRect.left - areaRect.left) / scale;
        const sourceOffsetY = (sourcePageRect.top - areaRect.top) / scale;
        applyDesktopLayoutRect(item, area, {
            left: Math.max(8, Math.min(maxLeft, startLeft + dx + sourceOffsetX)),
            top: Math.max(8, Math.min(maxTop, startTop + dy + sourceOffsetY)),
            width: item.offsetWidth,
            height: item.offsetHeight
        }, { mode: 'move' });
        if (isAppIcon) {
            const mergeTarget = (area === activeArea ? pointerMergeTarget : null) || findDesktopFolderMergeTarget(item, area, point);
            if (mergeTarget) {
                setPendingFolderMergeTarget(mergeTarget);
                return;
            }
            clearPendingFolderMergeTarget();
            const slotIndex = area === activeArea && pointerSlotIndex >= 0 ? pointerSlotIndex : getDesktopSlotIndexFromPoint(area, point, item);
            applyDesktopSlotOrder(area, item, slotIndex);
        } else {
            clearPendingFolderMergeTarget();
        }
    };
    const up = (ev) => {
        if (typeof item.releasePointerCapture === 'function' && typeof e.pointerId !== 'undefined') {
            try { item.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        const point = getDesktopPointerPoint(ev);
        const area = item.closest('.desktop-scroll-area') || currentPageArea || pageArea;
        if (isFolderIcon && (!hasMoved || maxMovedDistance <= 18)) {
            item.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready');
            hideDesktopSnapGuides(area);
            clearPendingFolderMergeTarget();
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            openFolder(item.dataset.folderId);
            return;
        }
        if (isAppIcon && (isPointInsideDesktopDock(point) || pendingDockIndex >= 0)) {
            moveDesktopAppItemToDock(item, pendingDockIndex >= 0 ? pendingDockIndex : getDesktopDockInsertIndex(point, null));
            hideDesktopSnapGuides(area);
            item.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready');
            clearPendingFolderMergeTarget();
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            return;
        }
        const target = hasMoved ? (pendingFolderMergeTarget || findDesktopFolderMergeTarget(item, area, point)) : null;
        if (target && mergeDesktopLayoutAppsIntoFolder(item, target, area)) {
            hideDesktopSnapGuides(area);
            item.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready');
            clearPendingFolderMergeTarget();
            compactDesktopSlotOrder(area);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            return;
        }
        clearPendingFolderMergeTarget();
        if (isAppIcon) {
            const finalIndex = getDesktopSlotIndexFromPoint(area, point, item);
            applyDesktopSlotOrder(area, item, finalIndex);
            const rect = getDesktopSlotRect(area, Number(item.dataset.desktopSlot), item);
            item.style.left = `${Math.round(rect.left)}px`;
            item.style.top = `${Math.round(rect.top)}px`;
            item.style.width = `${Math.round(rect.width)}px`;
            item.style.height = `${Math.round(rect.height)}px`;
            if (Number.isInteger(movedToPageIndex) && typeof window.goToDesktopPage === 'function') {
                window.goToDesktopPage(movedToPageIndex);
            }
        } else {
            if (hasMoved) settleDesktopAppsAroundWidget(item, area);
        }
        item.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready');
        if (item.dataset.desktopDragMoved) {
            setTimeout(() => { delete item.dataset.desktopDragMoved; }, 0);
        }
        hideDesktopSnapGuides(area);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

function startDesktopItemResize(e) {
    if (!window._editMode) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    const item = e.currentTarget.closest('.desktop-layout-item');
    const pageArea = item?.closest('.desktop-scroll-area');
    if (!item || !pageArea) return;
    const handle = e.currentTarget;
    const pointerId = typeof e.pointerId !== 'undefined' ? e.pointerId : null;
    e.preventDefault();
    e.stopPropagation();
    if (typeof handle.setPointerCapture === 'function' && pointerId !== null) {
        try { handle.setPointerCapture(pointerId); } catch (err) {}
    }
    selectDesktopLayoutItem(item);
    item.classList.add('desktop-layout-resizing');
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = item.offsetWidth;
    const startHeight = item.offsetHeight;
    const isFolder = item.classList.contains('is-folder');
    const isLovelyWidget = item.classList.contains('desktop-widget-lovely');
    const minWidth = item.classList.contains('calendar-widget') ? 220 : isLovelyWidget ? 150 : isFolder ? 72 : 118;
    const minHeight = item.classList.contains('calendar-widget') ? 118 : isLovelyWidget ? 128 : isFolder ? 76 : 96;
    const scale = getDesktopEditScale();
    let hasResized = false;
    let active = true;

    const move = (ev) => {
        if (!active) return;
        if (pointerId !== null && typeof ev.pointerId !== 'undefined' && ev.pointerId !== pointerId) return;
        if (ev.pointerType === 'mouse' && ev.buttons === 0) {
            finishResize(ev);
            return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        const left = parseFloat(item.style.left) || 0;
        const top = parseFloat(item.style.top) || 0;
        const maxWidth = pageArea.clientWidth - left;
        const maxHeight = pageArea.clientHeight - top;
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        if (!hasResized && Math.hypot(dx, dy) < 4) return;
        hasResized = true;
        applyDesktopLayoutRect(item, pageArea, {
            left,
            top,
            width: Math.max(minWidth, Math.min(maxWidth, startWidth + dx)),
            height: Math.max(minHeight, Math.min(maxHeight, startHeight + dy))
        }, { mode: 'resize' });
    };
    function finishResize(ev) {
        if (!active) return;
        if (ev && pointerId !== null && typeof ev.pointerId !== 'undefined' && ev.pointerId !== pointerId) return;
        active = false;
        if (typeof handle.releasePointerCapture === 'function' && pointerId !== null) {
            try { handle.releasePointerCapture(pointerId); } catch (err) {}
        }
        item.classList.remove('desktop-layout-resizing');
        hideDesktopSnapGuides(pageArea);
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', finishResize, true);
        window.removeEventListener('pointercancel', finishResize, true);
        window.removeEventListener('mouseup', finishResize, true);
        window.removeEventListener('blur', finishResize, true);
        handle.removeEventListener('lostpointercapture', finishResize, true);
        if (hasResized && !item.classList.contains('layout-app')) {
            settleDesktopAppsAroundWidget(item, pageArea);
        }
    }
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finishResize, true);
    window.addEventListener('pointercancel', finishResize, true);
    window.addEventListener('mouseup', finishResize, true);
    window.addEventListener('blur', finishResize, true);
    handle.addEventListener('lostpointercapture', finishResize, true);
}

function getDesktopStatusCharacters() {
    if (Array.isArray(window.myCharacters) && window.myCharacters.length) return window.myCharacters;
    try {
        const data = JSON.parse(localStorage.getItem('my_characters_data') || '[]');
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function getDesktopStatusCharacter() {
    const chars = getDesktopStatusCharacters();
    if (!chars.length) return null;
    const currentId = window.currentChatCharId || localStorage.getItem('bynd_music_co_listen_char_v1') || '';
    const selected = currentId ? chars.find(char => char && char.id === currentId) : null;
    return selected || chars.find(char => char && !char.isGroupChat) || chars[0] || null;
}

function getDesktopStatusCharName(char) {
    if (!char) return '';
    if (typeof getWechatCharDisplayName === 'function') return getWechatCharDisplayName(char);
    return (char.chatConfig && char.chatConfig.nickname) || char.name || '';
}

function getDesktopStatusWidgetPrefs() {
    try {
        const prefs = JSON.parse(localStorage.getItem(DESKTOP_STATUS_WIDGET_PREFS_KEY) || '{}');
        return prefs && typeof prefs === 'object' ? prefs : {};
    } catch (e) {
        return {};
    }
}

function saveDesktopStatusWidgetPrefs(prefs) {
    localStorage.setItem(DESKTOP_STATUS_WIDGET_PREFS_KEY, JSON.stringify(prefs && typeof prefs === 'object' ? prefs : {}));
}

function getDesktopStatusWidgetAvatar(layoutId) {
    const prefs = getDesktopStatusWidgetPrefs();
    return prefs.avatars && layoutId ? prefs.avatars[layoutId] || '' : '';
}

function setDesktopStatusWidgetAvatar(layoutId, avatar) {
    if (!layoutId || !avatar) return;
    const prefs = getDesktopStatusWidgetPrefs();
    prefs.avatars = prefs.avatars && typeof prefs.avatars === 'object' ? prefs.avatars : {};
    prefs.avatars[layoutId] = avatar;
    saveDesktopStatusWidgetPrefs(prefs);
}

function deleteDesktopStatusWidgetPrefs(layoutId) {
    if (!layoutId) return;
    const prefs = getDesktopStatusWidgetPrefs();
    if (prefs.avatars && Object.prototype.hasOwnProperty.call(prefs.avatars, layoutId)) {
        delete prefs.avatars[layoutId];
        saveDesktopStatusWidgetPrefs(prefs);
    }
}

function readDesktopStatusAvatarFile(file) {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('没有选择头像'));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('头像读取失败'));
        reader.onload = () => {
            const raw = reader.result;
            const img = new Image();
            img.onerror = () => resolve(raw);
            img.onload = () => {
                const size = 256;
                const scale = Math.max(size / Math.max(1, img.width), size / Math.max(1, img.height));
                const width = Math.round(img.width * scale);
                const height = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.82));
            };
            img.src = raw;
        };
        reader.readAsDataURL(file);
    });
}

async function handleDesktopStatusAvatarInput(input) {
    const file = input?.files?.[0];
    if (!file) return;
    input.value = '';
    const widget = input.closest('.desktop-widget-status');
    const layoutId = widget?.dataset?.layoutId || '';
    if (!widget || !layoutId) return;
    try {
        const avatar = await readDesktopStatusAvatarFile(file);
        setDesktopStatusWidgetAvatar(layoutId, avatar);
        updateDesktopStatusWidgets();
    } catch (e) {
        if (typeof showWechatToast === 'function') showWechatToast(e.message || '头像读取失败');
    }
}
window.handleDesktopStatusAvatarInput = handleDesktopStatusAvatarInput;

function getDesktopStatusBatteryPercent() {
    if (_desktopStatusBattery && typeof _desktopStatusBattery.level === 'number') {
        return Math.round(_desktopStatusBattery.level * 100);
    }
    if (!('getBattery' in navigator)) return null;
    const text = document.getElementById('battery-level')?.textContent || '';
    const match = text.match(/\d+/);
    return match ? Math.max(0, Math.min(100, Number(match[0]))) : null;
}

function formatDesktopStatusWidgetDate(now = new Date()) {
    const weeks = ['日', '一', '二', '三', '四', '五', '六'];
    return `${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 · 周${weeks[now.getDay()]}`;
}

function getDesktopStatusWeatherCache() {
    try {
        const data = JSON.parse(localStorage.getItem(DESKTOP_STATUS_WEATHER_KEY) || '{}');
        return data && typeof data === 'object' ? data : {};
    } catch (e) {
        return {};
    }
}

function saveDesktopStatusWeatherCache(data) {
    localStorage.setItem(DESKTOP_STATUS_WEATHER_KEY, JSON.stringify(data && typeof data === 'object' ? data : {}));
}

function getDesktopWeatherCodeText(code) {
    const n = Number(code);
    if (n === 0) return '晴';
    if ([1, 2].includes(n)) return '少云';
    if (n === 3) return '多云';
    if ([45, 48].includes(n)) return '雾';
    if ([51, 53, 55, 56, 57].includes(n)) return '毛毛雨';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(n)) return '雨';
    if ([71, 73, 75, 77, 85, 86].includes(n)) return '雪';
    if ([95, 96, 99].includes(n)) return '雷雨';
    return '天气';
}

function getDesktopStatusWeatherText() {
    const data = getDesktopStatusWeatherCache();
    if (!data || typeof data.temp !== 'number') return '授权定位获取天气';
    const max = typeof data.max === 'number' ? `${Math.round(data.max)}°` : '--';
    const min = typeof data.min === 'number' ? `${Math.round(data.min)}°` : '--';
    return `${getDesktopWeatherCodeText(data.code)} ${Math.round(data.temp)}° · ${max}/${min}`;
}

function setDesktopStatusWeatherText(text, state = '') {
    document.querySelectorAll('[data-dsw-weather]').forEach(el => {
        el.textContent = text || '授权定位获取天气';
        el.dataset.state = state;
    });
}

const LOCKSCREEN_WEATHER_REFRESH_MS = 30 * 60 * 1000;
let _lockscreenWeatherTimer = null;
let _lockscreenWeatherRequesting = false;

function getLockManualWeatherText() {
    try {
        const data = JSON.parse(localStorage.getItem('my_theme_data') || '{}') || {};
        const text = String(data.lockWeather || '').trim();
        return /^24\s*(?:°C|掳C)$/i.test(text) ? '' : text;
    } catch (e) {
        return '';
    }
}

function getByndWeatherLocationLabel(data) {
    if (!data || typeof data !== 'object') return '';
    return String(
        data.city
        || data.locality
        || data.principalSubdivision
        || data.countryName
        || ''
    ).trim();
}

function getLockscreenWeatherTextFromCache(data = getDesktopStatusWeatherCache()) {
    if (!data || typeof data.temp !== 'number') return '';
    const weather = getDesktopWeatherCodeText(data.code);
    const temp = `${Math.round(data.temp)}°`;
    const city = getByndWeatherLocationLabel(data);
    return city ? `${city} · ${weather} ${temp}` : `${weather} ${temp}`;
}

function syncLockscreenWeatherFromCache() {
    const manualWeather = getLockManualWeatherText();
    window._byndLockAutoWeatherText = manualWeather ? '' : getLockscreenWeatherTextFromCache();
    if (typeof updateLockDateDisplay === 'function') updateLockDateDisplay();
}

function normalizeByndCoordinate(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

async function fetchByndReverseGeocode(lat, lon) {
    const params = new URLSearchParams({ localityLanguage: 'zh' });
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        params.set('latitude', String(lat));
        params.set('longitude', String(lon));
    }
    const resp = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`, {
        signal: AbortSignal.timeout(14000)
    });
    if (!resp.ok) throw new Error(`城市定位 HTTP ${resp.status}`);
    return resp.json();
}

async function getLockscreenWeatherLocation() {
    try {
        const position = await getDesktopCurrentPosition();
        const lat = normalizeByndCoordinate(position?.coords?.latitude);
        const lon = normalizeByndCoordinate(position?.coords?.longitude);
        if (lat != null && lon != null) {
            let place = {};
            try {
                place = await fetchByndReverseGeocode(lat, lon);
            } catch (e) {}
            return { lat, lon, place };
        }
    } catch (e) {}

    const place = await fetchByndReverseGeocode();
    const lat = normalizeByndCoordinate(place.latitude || place.location?.latitude);
    const lon = normalizeByndCoordinate(place.longitude || place.location?.longitude);
    if (lat == null || lon == null) throw new Error('定位没有返回经纬度');
    return { lat, lon, place };
}

async function fetchByndOpenMeteoWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat.toFixed(4))}&longitude=${encodeURIComponent(lon.toFixed(4))}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(18000) });
    if (!resp.ok) throw new Error(`天气接口 HTTP ${resp.status}`);
    const json = await resp.json();
    const weather = {
        temp: Number(json?.current?.temperature_2m),
        code: Number(json?.current?.weather_code),
        max: Number(json?.daily?.temperature_2m_max?.[0]),
        min: Number(json?.daily?.temperature_2m_min?.[0])
    };
    if (!Number.isFinite(weather.temp)) throw new Error('天气接口没有返回温度');
    return weather;
}

async function requestLockscreenWeather(options = {}) {
    if (_lockscreenWeatherRequesting) return;
    if (getLockManualWeatherText() && !options.force) {
        syncLockscreenWeatherFromCache();
        return;
    }
    _lockscreenWeatherRequesting = true;
    try {
        const location = await getLockscreenWeatherLocation();
        const weather = await fetchByndOpenMeteoWeather(location.lat, location.lon);
        const place = location.place || {};
        const record = {
            ...weather,
            lat: location.lat,
            lon: location.lon,
            city: place.city || place.locality || '',
            locality: place.locality || '',
            principalSubdivision: place.principalSubdivision || '',
            countryName: place.countryName || '',
            updatedAt: Date.now(),
            source: 'auto-lockscreen'
        };
        saveDesktopStatusWeatherCache(record);
        syncLockscreenWeatherFromCache();
        updateDesktopStatusWidgets();
    } catch (e) {
        syncLockscreenWeatherFromCache();
        if (options.force && typeof showWechatToast === 'function') showWechatToast(e.message || '天气获取失败');
    } finally {
        _lockscreenWeatherRequesting = false;
    }
}
window.requestLockscreenWeather = requestLockscreenWeather;

function initLockscreenWeatherRuntime() {
    syncLockscreenWeatherFromCache();
    const cache = getDesktopStatusWeatherCache();
    const age = Date.now() - Number(cache.updatedAt || 0);
    if (!getLockManualWeatherText() && (!Number.isFinite(Number(cache.temp)) || age > LOCKSCREEN_WEATHER_REFRESH_MS || !getByndWeatherLocationLabel(cache))) {
        requestLockscreenWeather();
    }
    clearInterval(_lockscreenWeatherTimer);
    _lockscreenWeatherTimer = setInterval(() => requestLockscreenWeather(), LOCKSCREEN_WEATHER_REFRESH_MS);
}

function getDesktopStatusStepsCache() {
    try {
        const data = JSON.parse(localStorage.getItem(DESKTOP_STATUS_STEPS_KEY) || '{}');
        return data && typeof data === 'object' ? data : {};
    } catch (e) {
        return {};
    }
}

function saveDesktopStatusStepsCache(data) {
    localStorage.setItem(DESKTOP_STATUS_STEPS_KEY, JSON.stringify(data && typeof data === 'object' ? data : {}));
}

function getDesktopStatusStepsText() {
    const data = getDesktopStatusStepsCache();
    const steps = Number(data.steps);
    if (!Number.isFinite(steps) || steps < 0) return '步数 未连接';
    return `步数 ${Math.round(steps)}`;
}

function setDesktopStatusStepsText(text, state = '') {
    document.querySelectorAll('[data-dsw-steps]').forEach(el => {
        el.textContent = text || '步数 未连接';
        el.dataset.state = state;
    });
}

async function readDesktopNativeStepCount() {
    const bridgeCandidates = [
        window.BYND_NATIVE,
        window.BeyondScreenNative,
        window.Android,
        window.webkit?.messageHandlers?.byndHealth
    ].filter(Boolean);
    for (const bridge of bridgeCandidates) {
        const fn = bridge.getStepCount || bridge.requestStepCount || bridge.getTodaySteps || bridge.postMessage;
        if (typeof fn !== 'function') continue;
        const result = await fn.call(bridge, { type: 'getTodaySteps' });
        const value = typeof result === 'object' && result ? (result.steps ?? result.stepCount ?? result.todaySteps) : result;
        const steps = Number(value);
        if (Number.isFinite(steps) && steps >= 0) return steps;
    }
    throw new Error('当前网页环境没有真实步数接口');
}

async function requestDesktopStatusSteps(options = {}) {
    if (!document.querySelector('.desktop-widget-status')) return;
    setDesktopStatusStepsText('正在授权步数...', 'loading');
    try {
        const steps = await readDesktopNativeStepCount();
        saveDesktopStatusStepsCache({ steps: Math.round(steps), updatedAt: Date.now(), source: 'native' });
        updateDesktopStatusWidgets();
    } catch (e) {
        setDesktopStatusStepsText(getDesktopStatusStepsText(), 'error');
        if (options.force && typeof showWechatToast === 'function') {
            showWechatToast('网页不能直接读取手机健康步数，需要原生壳子接 HealthKit / Health Connect');
        }
    }
}
window.requestDesktopStatusSteps = requestDesktopStatusSteps;

function getDesktopCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('当前浏览器不支持定位'));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            maximumAge: 20 * 60 * 1000,
            timeout: 18000
        });
    });
}

async function requestDesktopStatusWeather(options = {}) {
    if (!document.querySelector('.desktop-widget-status')) return;
    setDesktopStatusWeatherText('正在定位...', 'loading');
    try {
        const position = await getDesktopCurrentPosition();
        const lat = Number(position.coords.latitude).toFixed(4);
        const lon = Number(position.coords.longitude).toFixed(4);
        setDesktopStatusWeatherText('正在获取天气...', 'loading');
        let place = {};
        try {
            place = await fetchByndReverseGeocode(Number(lat), Number(lon));
        } catch (e) {}
        const openMeteoWeather = await fetchByndOpenMeteoWeather(Number(lat), Number(lon));
        const weather = {
            lat: Number(lat),
            lon: Number(lon),
            ...openMeteoWeather,
            city: place.city || place.locality || '',
            locality: place.locality || '',
            principalSubdivision: place.principalSubdivision || '',
            countryName: place.countryName || '',
            updatedAt: Date.now()
        };
        saveDesktopStatusWeatherCache(weather);
        syncLockscreenWeatherFromCache();
        updateDesktopStatusWidgets();
    } catch (e) {
        const fallback = options.force ? '定位或天气获取失败' : getDesktopStatusWeatherText();
        setDesktopStatusWeatherText(fallback, 'error');
        if (options.force && typeof showWechatToast === 'function') showWechatToast(e.message || '天气获取失败');
    }
}
window.requestDesktopStatusWeather = requestDesktopStatusWeather;

function updateDesktopStatusWidgets() {
    const widgets = document.querySelectorAll('.desktop-widget-status');
    const notesWidgets = document.querySelectorAll('.desktop-widget-notes-trio');
    if (!widgets.length && !notesWidgets.length) return;
    const now = new Date();
    const timeText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateText = formatDesktopStatusWidgetDate(now);
    const batteryPercent = getDesktopStatusBatteryPercent();
    const batteryText = batteryPercent == null ? '--%' : `${batteryPercent}%`;
    const char = getDesktopStatusCharacter();
    const charName = getDesktopStatusCharName(char);
    const weatherText = getDesktopStatusWeatherText();
    const stepsText = getDesktopStatusStepsText();
    widgets.forEach(widget => {
        const layoutId = widget.dataset.layoutId || '';
        const avatar = getDesktopStatusWidgetAvatar(layoutId) || (char && char.avatar) || window.DEFAULT_AVATAR || '';
        widget.style.setProperty('--dsw-battery-angle', `${Math.max(0, Math.min(100, batteryPercent == null ? 0 : batteryPercent)) * 3.6}deg`);
        widget.querySelectorAll('[data-dsw-battery]').forEach(el => { el.textContent = batteryText; });
        widget.querySelectorAll('[data-dsw-time]').forEach(el => { el.textContent = timeText; });
        widget.querySelectorAll('[data-dsw-date]').forEach(el => { el.textContent = dateText; });
        widget.querySelectorAll('[data-dsw-weather]').forEach(el => { el.textContent = weatherText; });
        widget.querySelectorAll('[data-dsw-steps]').forEach(el => { el.textContent = stepsText; });
        widget.querySelectorAll('[data-dsw-name]').forEach(el => { el.textContent = charName || '角色'; });
        const img = widget.querySelector('[data-dsw-avatar]');
        if (img && avatar && img.getAttribute('src') !== avatar) img.src = avatar;
        if (img) img.alt = charName || '';
    });
    notesWidgets.forEach(widget => {
        widget.querySelectorAll('[data-dnw-time]').forEach(el => { el.textContent = timeText; });
        widget.querySelectorAll('[data-dnw-weather]').forEach(el => { el.textContent = `weather : ${weatherText}`; });
    });
}

function initDesktopStatusWidgetRuntime() {
    updateDesktopStatusWidgets();
    setInterval(updateDesktopStatusWidgets, 30000);
    if (_desktopStatusBatteryBound || !('getBattery' in navigator)) return;
    _desktopStatusBatteryBound = true;
    navigator.getBattery().then(battery => {
        _desktopStatusBattery = battery;
        const update = () => updateDesktopStatusWidgets();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
        update();
    }).catch(() => {});
}

function getDesktopLovelyWidgetPrefs() {
    try {
        const prefs = JSON.parse(localStorage.getItem(DESKTOP_LOVELY_WIDGET_PREFS_KEY) || '{}');
        return prefs && typeof prefs === 'object' ? prefs : {};
    } catch (e) {
        return {};
    }
}

function saveDesktopLovelyWidgetPrefs(prefs) {
    localStorage.setItem(DESKTOP_LOVELY_WIDGET_PREFS_KEY, JSON.stringify(prefs && typeof prefs === 'object' ? prefs : {}));
}

function normalizeDesktopLovelyChecklist(checks) {
    const source = Array.isArray(checks) ? checks : [];
    const rows = source.slice(0, 3).map(item => ({
        text: String(item?.text || '').slice(0, 40),
        done: !!item?.done
    }));
    while (rows.length < 3) rows.push({ text: '', done: false });
    return rows;
}

function normalizeDesktopLovelyBubbleTone(tone) {
    return Object.prototype.hasOwnProperty.call(DESKTOP_LOVELY_BUBBLE_COLORS, tone) || tone === 'custom' ? tone : 'blue';
}

function normalizeDesktopLovelyBubbleColor(color) {
    const value = String(color || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    return '';
}

function normalizeDesktopLovelyBubbleOpacity(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0.72;
    return Math.max(0.18, Math.min(1, number));
}

function getDesktopLovelyBubbleBg(data) {
    const tone = normalizeDesktopLovelyBubbleTone(data?.bubbleTone);
    if (tone === 'custom') return normalizeDesktopLovelyBubbleColor(data?.bubbleColor) || DESKTOP_LOVELY_BUBBLE_COLORS.blue;
    return DESKTOP_LOVELY_BUBBLE_COLORS[tone] || DESKTOP_LOVELY_BUBBLE_COLORS.blue;
}

function getDesktopLovelyToneColor(tone, customColor, fallbackTone = 'blue') {
    const safeTone = normalizeDesktopLovelyBubbleTone(tone);
    if (safeTone === 'custom') return normalizeDesktopLovelyBubbleColor(customColor) || DESKTOP_LOVELY_BUBBLE_COLORS[fallbackTone] || DESKTOP_LOVELY_BUBBLE_COLORS.blue;
    return DESKTOP_LOVELY_BUBBLE_COLORS[safeTone] || DESKTOP_LOVELY_BUBBLE_COLORS[fallbackTone] || DESKTOP_LOVELY_BUBBLE_COLORS.blue;
}

function renderDesktopLovelyBubblePalette(data, options = {}) {
    const tone = normalizeDesktopLovelyBubbleTone(data?.bubbleTone);
    const customColor = normalizeDesktopLovelyBubbleColor(data?.bubbleColor) || DESKTOP_LOVELY_BUBBLE_HEX.blue;
    const targetId = options.targetId || '';
    const targetAttr = targetId ? ` data-lcw-target="${desktopEscapeAttr(targetId)}"` : '';
    const presets = [
        ['blue', '奶蓝'],
        ['pink', '奶粉'],
        ['mint', '薄荷'],
        ['yellow', '奶黄'],
        ['purple', '淡紫'],
        ['clear', '透明'],
        ['black', '黑色'],
        ['gray', '灰色']
    ];
    return `
        <div class="lcw-bubble-palette" aria-label="气泡颜色">
            ${presets.map(([key, label]) => `
                <button type="button" class="lcw-bubble-swatch ${tone === key ? 'active' : ''}" data-tone="${desktopEscapeAttr(key)}"${targetAttr} title="${desktopEscapeAttr(label)}" style="--swatch:${desktopEscapeAttr(DESKTOP_LOVELY_BUBBLE_COLORS[key])};" onclick="setDesktopLovelyBubbleTone(this)"></button>
            `).join('')}
            <label class="lcw-bubble-custom ${tone === 'custom' ? 'active' : ''}" title="自定义颜色">
                <input type="color" value="${desktopEscapeAttr(customColor)}"${targetAttr} onchange="setDesktopLovelyBubbleCustomColor(this)">
            </label>
        </div>
    `;
}

function renderDesktopLovelyColorSwatches(data, part) {
    const toneKey = part === 'outer' ? 'titleOuterTone' : 'titleInnerTone';
    const colorKey = part === 'outer' ? 'titleOuterColor' : 'titleInnerColor';
    const fallback = part === 'outer' ? 'clear' : 'blue';
    const tone = normalizeDesktopLovelyBubbleTone(data?.[toneKey] || fallback);
    const customColor = normalizeDesktopLovelyBubbleColor(data?.[colorKey]) || DESKTOP_LOVELY_BUBBLE_HEX[fallback] || DESKTOP_LOVELY_BUBBLE_HEX.blue;
    const presets = [
        ['blue', '奶蓝'],
        ['pink', '奶粉'],
        ['mint', '薄荷'],
        ['yellow', '奶黄'],
        ['purple', '淡紫'],
        ['clear', '透明'],
        ['black', '黑色'],
        ['gray', '灰色']
    ];
    return `
        <div class="lcw-title-palette-row" data-part="${desktopEscapeAttr(part)}">
            <span>${part === 'outer' ? '外' : '内'}</span>
            ${presets.map(([key, label]) => `
                <button type="button" class="lcw-title-swatch lcw-bubble-swatch ${tone === key ? 'active' : ''}" data-part="${desktopEscapeAttr(part)}" data-tone="${desktopEscapeAttr(key)}" title="${desktopEscapeAttr(label)}" style="--swatch:${desktopEscapeAttr(DESKTOP_LOVELY_BUBBLE_COLORS[key])};" onclick="setDesktopLovelyTitleTone(this)"></button>
            `).join('')}
            <label class="lcw-title-custom lcw-bubble-custom ${tone === 'custom' ? 'active' : ''}" title="自定义颜色">
                <input type="color" value="${desktopEscapeAttr(customColor)}" data-part="${desktopEscapeAttr(part)}" onchange="setDesktopLovelyTitleCustomColor(this)">
            </label>
        </div>
    `;
}

function renderDesktopLovelyTitlePalette(data) {
    return `
        <div class="lcw-title-palette" aria-label="标题颜色">
            ${renderDesktopLovelyColorSwatches(data, 'inner')}
            ${renderDesktopLovelyColorSwatches(data, 'outer')}
        </div>
    `;
}

function getDesktopLovelyWidgetData(layoutId) {
    const prefs = getDesktopLovelyWidgetPrefs();
    const data = layoutId && prefs[layoutId] && typeof prefs[layoutId] === 'object' ? prefs[layoutId] : {};
    const noteTone = Object.prototype.hasOwnProperty.call(DESKTOP_NOTES_WIDGET_TONES, data.noteTone) ? data.noteTone : 'blue';
    return {
        hero: typeof data.hero === 'string' ? data.hero : '',
        avatar: typeof data.avatar === 'string' ? data.avatar : '',
        square: typeof data.square === 'string' ? data.square : '',
        sticker: typeof data.sticker === 'string' ? data.sticker : '',
        wall1: typeof data.wall1 === 'string' ? data.wall1 : '',
        wall2: typeof data.wall2 === 'string' ? data.wall2 : '',
        wall3: typeof data.wall3 === 'string' ? data.wall3 : '',
        notePhoto1: typeof data.notePhoto1 === 'string' ? data.notePhoto1 : '',
        notePhoto2: typeof data.notePhoto2 === 'string' ? data.notePhoto2 : '',
        notePhoto3: typeof data.notePhoto3 === 'string' ? data.notePhoto3 : '',
        noteText: typeof data.noteText === 'string' ? data.noteText.slice(0, 90) : 'best trio\n\\( > < )/ · *☆',
        noteTone,
        catalogHero: typeof data.catalogHero === 'string' ? data.catalogHero : '',
        catalogAvatar: typeof data.catalogAvatar === 'string' ? data.catalogAvatar : '',
        catalog1: typeof data.catalog1 === 'string' ? data.catalog1 : '',
        catalog2: typeof data.catalog2 === 'string' ? data.catalog2 : '',
        catalog3: typeof data.catalog3 === 'string' ? data.catalog3 : '',
        title: typeof data.title === 'string' ? data.title.slice(0, 28) : 'CHU ANH',
        subtitle: typeof data.subtitle === 'string' ? data.subtitle.slice(0, 28) : '疗愈院・♡',
        bubble: typeof data.bubble === 'string' && data.bubble.trim() !== DESKTOP_LOVELY_LEGACY_BUBBLE_TEXT ? data.bubble.slice(0, 140) : DESKTOP_LOVELY_DEFAULT_BUBBLE_TEXT,
        bubbleTone: normalizeDesktopLovelyBubbleTone(data.bubbleTone),
        bubbleColor: normalizeDesktopLovelyBubbleColor(data.bubbleColor),
        bubbleOpacity: normalizeDesktopLovelyBubbleOpacity(data.bubbleOpacity),
        titleInnerTone: normalizeDesktopLovelyBubbleTone(data.titleInnerTone || 'blue'),
        titleInnerColor: normalizeDesktopLovelyBubbleColor(data.titleInnerColor),
        titleOuterTone: normalizeDesktopLovelyBubbleTone(data.titleOuterTone || 'clear'),
        titleOuterColor: normalizeDesktopLovelyBubbleColor(data.titleOuterColor),
        checks: normalizeDesktopLovelyChecklist(data.checks)
    };
}

function setDesktopLovelyWidgetData(layoutId, data) {
    if (!layoutId) return;
    const prefs = getDesktopLovelyWidgetPrefs();
    prefs[layoutId] = {
        ...getDesktopLovelyWidgetData(layoutId),
        ...(data && typeof data === 'object' ? data : {})
    };
    prefs[layoutId].checks = normalizeDesktopLovelyChecklist(prefs[layoutId].checks);
    prefs[layoutId].bubbleTone = normalizeDesktopLovelyBubbleTone(prefs[layoutId].bubbleTone);
    prefs[layoutId].bubbleColor = normalizeDesktopLovelyBubbleColor(prefs[layoutId].bubbleColor);
    prefs[layoutId].bubbleOpacity = normalizeDesktopLovelyBubbleOpacity(prefs[layoutId].bubbleOpacity);
    prefs[layoutId].titleInnerTone = normalizeDesktopLovelyBubbleTone(prefs[layoutId].titleInnerTone || 'blue');
    prefs[layoutId].titleInnerColor = normalizeDesktopLovelyBubbleColor(prefs[layoutId].titleInnerColor);
    prefs[layoutId].titleOuterTone = normalizeDesktopLovelyBubbleTone(prefs[layoutId].titleOuterTone || 'clear');
    prefs[layoutId].titleOuterColor = normalizeDesktopLovelyBubbleColor(prefs[layoutId].titleOuterColor);
    prefs[layoutId].noteTone = Object.prototype.hasOwnProperty.call(DESKTOP_NOTES_WIDGET_TONES, prefs[layoutId].noteTone) ? prefs[layoutId].noteTone : 'blue';
    prefs[layoutId].noteText = String(prefs[layoutId].noteText || '').slice(0, 90);
    if (!prefs[layoutId].title || prefs[layoutId].title === 'Namiii') prefs[layoutId].title = 'CHU ANH';
    prefs[layoutId].title = String(prefs[layoutId].title || '').slice(0, 28);
    prefs[layoutId].subtitle = String(prefs[layoutId].subtitle || '').slice(0, 28);
    if (!prefs[layoutId].bubble || prefs[layoutId].bubble === DESKTOP_LOVELY_LEGACY_BUBBLE_TEXT) prefs[layoutId].bubble = DESKTOP_LOVELY_DEFAULT_BUBBLE_TEXT;
    prefs[layoutId].bubble = String(prefs[layoutId].bubble || '').slice(0, 140);
    saveDesktopLovelyWidgetPrefs(prefs);
}

function deleteDesktopLovelyWidgetPrefs(layoutId) {
    if (!layoutId) return;
    const prefs = getDesktopLovelyWidgetPrefs();
    if (Object.prototype.hasOwnProperty.call(prefs, layoutId)) {
        delete prefs[layoutId];
        saveDesktopLovelyWidgetPrefs(prefs);
    }
}

function renderDesktopLovelyImageSlot(slot, value, label, className) {
    const img = value ? `<img src="${desktopEscapeAttr(value)}" alt="">` : `<span class="lcw-placeholder"><i class="ri-image-add-line"></i><em>${desktopEscapeHtml(label)}</em></span>`;
    const accept = slot === 'sticker' ? 'image/png,image/*' : 'image/*';
    return `
        <label class="lcw-photo ${desktopEscapeAttr(className)} lcw-control">
            ${img}
            <input class="lcw-input lcw-file" type="file" accept="${accept}" data-lcw-slot="${desktopEscapeAttr(slot)}" onchange="handleDesktopLovelyImageInput(this)">
        </label>
    `;
}

function renderDesktopLovelyPolaroidSlot(slot, value, label, index) {
    const img = value ? `<img src="${desktopEscapeAttr(value)}" alt="">` : `<span class="lcw-polaroid-placeholder"><i class="ri-image-add-line"></i></span>`;
    return `
        <label class="lcw-polaroid lcw-polaroid-${index} lcw-control">
            <span class="lcw-polaroid-photo">${img}</span>
            <span class="lcw-polaroid-caption">${desktopEscapeHtml(label)}</span>
            <input class="lcw-input lcw-file" type="file" accept="image/*" data-lcw-slot="${desktopEscapeAttr(slot)}" onchange="handleDesktopLovelyImageInput(this)">
        </label>
    `;
}

function renderDesktopLovelyWidgetInner(layoutId) {
    const data = getDesktopLovelyWidgetData(layoutId);
    const avatar = data.avatar || '';
    const titleInner = getDesktopLovelyToneColor(data.titleInnerTone, data.titleInnerColor, 'blue');
    const titleOuter = getDesktopLovelyToneColor(data.titleOuterTone, data.titleOuterColor, 'clear');
    const bubbleLines = String(data.bubble || DESKTOP_LOVELY_DEFAULT_BUBBLE_TEXT).split(/\n+/);
    return `
        <div class="lcw-shell">
            ${renderDesktopLovelyImageSlot('hero', data.hero, '横向照片', 'lcw-hero')}
            ${renderDesktopLovelyImageSlot('avatar', avatar, '头像', 'lcw-avatar')}
            <div class="lcw-title-row" data-inner-tone="${desktopEscapeAttr(data.titleInnerTone)}" data-outer-tone="${desktopEscapeAttr(data.titleOuterTone)}" style="--lcw-title-inner:${desktopEscapeAttr(titleInner)}; --lcw-title-outer:${desktopEscapeAttr(titleOuter)};">
                <div class="lcw-title-card lcw-title-card-left">
                    <span aria-hidden="true">꒰ ˚ CHU ANH ˚ ꒱</span>
                    <input class="lcw-title-input lcw-input" type="text" maxlength="28" value="${desktopEscapeAttr(data.title || 'CHU ANH')}" oninput="saveDesktopLovelyTitle(this)">
                    <input class="lcw-title-subtitle lcw-input" type="text" maxlength="28" value="${desktopEscapeAttr(data.subtitle || '疗愈院・♡')}" oninput="saveDesktopLovelySubtitle(this)">
                </div>
                ${renderDesktopLovelyTitlePalette(data)}
            </div>
        </div>
    `;
}

function renderDesktopPolaroidWidgetInner(layoutId) {
    const data = getDesktopLovelyWidgetData(layoutId);
    return `
        <div class="lcw-polaroid-widget-shell">
            <div class="lcw-polaroid-wall">
                ${renderDesktopLovelyPolaroidSlot('wall1', data.wall1, 'Photo', 1)}
                ${renderDesktopLovelyPolaroidSlot('wall2', data.wall2, 'Photo', 2)}
                ${renderDesktopLovelyPolaroidSlot('wall3', data.wall3, 'Photo', 3)}
            </div>
        </div>
    `;
}

function renderDesktopCalendarWidgetInner() {
    return `
        <div class="calendar-widget desktop-calendar-widget-inner">
            <div class="cal-left">
                <div class="cal-day">--</div>
                <div class="cal-date">--</div>
            </div>
            <div class="cal-right">
                <div class="cal-month">--</div>
                <div class="cal-grid"></div>
            </div>
        </div>
    `;
}

function renderDesktopPhotoSquareWidgetInner(layoutId) {
    const data = getDesktopLovelyWidgetData(layoutId);
    const image = data.square || '';
    return `
        <label class="desktop-photo-square-shell">
            ${image ? `<img src="${desktopEscapeAttr(image)}" alt="">` : '<span class="desktop-photo-square-placeholder"><i class="ri-image-add-line"></i></span>'}
            <input class="lcw-input lcw-file" type="file" accept="image/*" data-lcw-slot="square" onchange="handleDesktopLovelyImageInput(this)">
        </label>
    `;
}

function renderDesktopNotesTrioPhoto(slot, value, index) {
    return `
        <label class="dnw-avatar-slot dnw-avatar-${index}">
            ${value ? `<img src="${desktopEscapeAttr(value)}" alt="">` : '<span><i class="ri-image-add-line"></i></span>'}
            <input class="lcw-input lcw-file" type="file" accept="image/*" data-lcw-slot="${desktopEscapeAttr(slot)}" onchange="handleDesktopLovelyImageInput(this)">
        </label>
    `;
}

function renderDesktopNotesTrioToneSwatches(data) {
    return `
        <div class="dnw-tone-picker" aria-label="切换颜色">
            ${Object.entries(DESKTOP_NOTES_WIDGET_TONES).map(([key, tone]) => `
                <button type="button" class="${data.noteTone === key ? 'active' : ''}" data-tone="${desktopEscapeAttr(key)}" title="${desktopEscapeAttr(tone.label)}" style="--dnw-swatch:${desktopEscapeAttr(tone.card)}; --dnw-swatch-accent:${desktopEscapeAttr(tone.accent)};" onclick="setDesktopNotesTrioTone(this)"></button>
            `).join('')}
        </div>
    `;
}

function renderDesktopNotesTrioWidgetInner(layoutId) {
    const data = getDesktopLovelyWidgetData(layoutId);
    const tone = DESKTOP_NOTES_WIDGET_TONES[data.noteTone] || DESKTOP_NOTES_WIDGET_TONES.blue;
    return `
        <div class="dnw-shell" data-tone="${desktopEscapeAttr(data.noteTone)}" style="--dnw-card:${desktopEscapeAttr(tone.card)}; --dnw-accent:${desktopEscapeAttr(tone.accent)}; --dnw-back:${desktopEscapeAttr(tone.back)}; --dnw-back2:${desktopEscapeAttr(tone.back2)}; --dnw-text:${desktopEscapeAttr(tone.text)};">
            <span class="dnw-paperclip" aria-hidden="true"></span>
            <span class="dnw-back-sheet dnw-back-a" aria-hidden="true"></span>
            <span class="dnw-back-sheet dnw-back-b" aria-hidden="true"></span>
            <div class="dnw-card">
                <div class="dnw-head">
                    <i class="${desktopEscapeAttr(tone.icon)}"></i>
                    <span>notes</span>
                    <i class="${desktopEscapeAttr(tone.icon)}"></i>
                </div>
                <textarea class="dnw-text lcw-input" maxlength="90" spellcheck="false" oninput="saveDesktopNotesTrioText(this)">${desktopEscapeHtml(data.noteText)}</textarea>
                <div class="dnw-doodles" aria-hidden="true">
                    <span>✦</span><span>⌁⌁</span><span>𓆟</span><span>𓆝</span><span>𓆞</span><span>☆</span>
                </div>
                <div class="dnw-avatars">
                    ${renderDesktopNotesTrioPhoto('notePhoto1', data.notePhoto1, 1)}
                    ${renderDesktopNotesTrioPhoto('notePhoto2', data.notePhoto2, 2)}
                    ${renderDesktopNotesTrioPhoto('notePhoto3', data.notePhoto3, 3)}
                </div>
                ${renderDesktopNotesTrioToneSwatches(data)}
            </div>
        </div>
    `;
}

function renderDesktopCatalogPhoto(slot, value, className, label) {
    return `
        <label class="${desktopEscapeAttr(className)} dcw-photo-slot">
            ${value ? `<img src="${desktopEscapeAttr(value)}" alt="">` : `<span><i class="ri-image-add-line"></i><em>${desktopEscapeHtml(label)}</em></span>`}
            <input class="lcw-input lcw-file" type="file" accept="image/*" data-lcw-slot="${desktopEscapeAttr(slot)}" onchange="handleDesktopLovelyImageInput(this)">
        </label>
    `;
}

function renderDesktopCatalogWidgetInner(layoutId) {
    const data = getDesktopLovelyWidgetData(layoutId);
    return `
        <div class="dcw-shell">
            <div class="dcw-top">
                ${renderDesktopCatalogPhoto('catalogHero', data.catalogHero, 'dcw-hero', '上方图片')}
                ${renderDesktopCatalogPhoto('catalogAvatar', data.catalogAvatar, 'dcw-avatar', '头像')}
            </div>
            <div class="dcw-panel">
                <div class="dcw-panel-head">
                    <strong>Catalog</strong>
                    <span>See all <i class="ri-arrow-right-s-line"></i></span>
                </div>
                <div class="dcw-grid">
                    ${renderDesktopCatalogPhoto('catalog1', data.catalog1, 'dcw-thumb dcw-thumb-1', '图片')}
                    ${renderDesktopCatalogPhoto('catalog2', data.catalog2, 'dcw-thumb dcw-thumb-2', '图片')}
                    ${renderDesktopCatalogPhoto('catalog3', data.catalog3, 'dcw-thumb dcw-thumb-3', '图片')}
                </div>
            </div>
        </div>
    `;
}

function readDesktopLovelyImageFile(file, slot) {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('没有选择图片'));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('图片读取失败'));
        reader.onload = () => {
            const raw = reader.result;
            const img = new Image();
            img.onerror = () => resolve(raw);
            img.onload = () => {
                const maxSize = slot === 'hero' ? 960 : 520;
                const scale = Math.min(1, maxSize / Math.max(1, img.width), maxSize / Math.max(1, img.height));
                const width = Math.max(1, Math.round(img.width * scale));
                const height = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(slot === 'sticker' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.84));
            };
            img.src = raw;
        };
        reader.readAsDataURL(file);
    });
}

async function handleDesktopLovelyImageInput(input) {
    const file = input?.files?.[0];
    if (!file) return;
    input.value = '';
    const widget = input.closest('.desktop-custom-widget');
    const slot = input.dataset.lcwSlot;
    if (!widget || !slot) return;
    try {
        const image = await readDesktopLovelyImageFile(file, slot);
        const layoutId = widget.dataset.layoutId;
        const data = getDesktopLovelyWidgetData(layoutId);
        data[slot] = image;
        setDesktopLovelyWidgetData(layoutId, data);
        const holder = input.closest('.lcw-photo');
        const squareHolder = input.closest('.desktop-photo-square-shell');
        const polaroidHolder = input.closest('.lcw-polaroid')?.querySelector('.lcw-polaroid-photo');
        const notesHolder = input.closest('.dnw-avatar-slot');
        const catalogHolder = input.closest('.dcw-photo-slot');
        if (catalogHolder) {
            catalogHolder.querySelector('img, span')?.remove();
        } else if (notesHolder) {
            notesHolder.querySelector('img, span')?.remove();
        } else if (polaroidHolder) {
            polaroidHolder.querySelector('img, .lcw-polaroid-placeholder')?.remove();
        } else if (squareHolder) {
            squareHolder.querySelector('img, .desktop-photo-square-placeholder')?.remove();
        } else {
            holder?.querySelector('img, .lcw-placeholder')?.remove();
        }
        const img = document.createElement('img');
        img.src = image;
        img.alt = '';
        if (catalogHolder) {
            catalogHolder.insertBefore(img, input);
        } else if (notesHolder) {
            notesHolder.insertBefore(img, input);
        } else if (polaroidHolder) {
            polaroidHolder.appendChild(img);
        } else if (squareHolder) {
            squareHolder.insertBefore(img, input);
        } else {
            holder?.insertBefore(img, input);
        }
    } catch (e) {
        if (typeof showWechatToast === 'function') showWechatToast(e.message || '图片读取失败');
    }
}
window.handleDesktopLovelyImageInput = handleDesktopLovelyImageInput;

function saveDesktopNotesTrioText(input) {
    const widget = input?.closest?.('.desktop-widget-notes-trio');
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(widget.dataset.layoutId);
    data.noteText = String(input.value || '').slice(0, 90);
    setDesktopLovelyWidgetData(widget.dataset.layoutId, data);
}
window.saveDesktopNotesTrioText = saveDesktopNotesTrioText;

function setDesktopNotesTrioTone(button) {
    const widget = button?.closest?.('.desktop-widget-notes-trio');
    const toneKey = Object.prototype.hasOwnProperty.call(DESKTOP_NOTES_WIDGET_TONES, button?.dataset?.tone) ? button.dataset.tone : 'blue';
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(widget.dataset.layoutId);
    data.noteTone = toneKey;
    setDesktopLovelyWidgetData(widget.dataset.layoutId, data);
    const nextTone = DESKTOP_NOTES_WIDGET_TONES[toneKey] || DESKTOP_NOTES_WIDGET_TONES.blue;
    const shell = widget.querySelector('.dnw-shell');
    if (shell) {
        shell.dataset.tone = toneKey;
        shell.style.setProperty('--dnw-card', nextTone.card);
        shell.style.setProperty('--dnw-accent', nextTone.accent);
        shell.style.setProperty('--dnw-back', nextTone.back);
        shell.style.setProperty('--dnw-back2', nextTone.back2);
        shell.style.setProperty('--dnw-text', nextTone.text);
        shell.querySelectorAll('.dnw-head i').forEach(icon => { icon.className = nextTone.icon; });
    }
    widget.querySelectorAll('.dnw-tone-picker button').forEach(item => item.classList.toggle('active', item === button));
}
window.setDesktopNotesTrioTone = setDesktopNotesTrioTone;

function saveDesktopLovelyText(input) {
    const widget = input?.closest?.('.desktop-widget-lovely');
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(widget.dataset.layoutId);
    const lines = Array.from(widget.querySelectorAll('.lcw-title-card-right .lcw-bubble'))
        .map(item => String(item.value || '').trim())
        .filter(Boolean);
    data.bubble = (lines.length ? lines.join('\n') : String(input.value || '')).slice(0, 140);
    setDesktopLovelyWidgetData(widget.dataset.layoutId, data);
}
window.saveDesktopLovelyText = saveDesktopLovelyText;

function getDesktopLovelyPanelTargetSelector(layoutId) {
    if (!layoutId) return '';
    const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(layoutId)
        : String(layoutId).replace(/["\\]/g, '\\$&');
    return `.desktop-widget-lovely[data-layout-id="${escaped}"]`;
}

function getDesktopLovelyWidgetFromControl(control) {
    const targetId = control?.dataset?.lcwTarget || '';
    if (targetId) {
        const widget = document.querySelector(getDesktopLovelyPanelTargetSelector(targetId));
        if (widget) return widget;
    }
    return control?.closest?.('.desktop-widget-lovely') || null;
}

function applyDesktopLovelyBubbleColor(widget, data) {
    const bubbleCard = widget?.querySelector?.('.lcw-bubble-card');
    if (!bubbleCard) return;
    const tone = normalizeDesktopLovelyBubbleTone(data?.bubbleTone);
    bubbleCard.dataset.tone = tone;
    bubbleCard.style.setProperty('--lcw-bubble-bg', getDesktopLovelyBubbleBg(data));
    bubbleCard.style.setProperty('--lcw-bubble-opacity', normalizeDesktopLovelyBubbleOpacity(data?.bubbleOpacity));
    const layoutId = widget.dataset.layoutId || '';
    document.querySelectorAll(`.lcw-bubble-swatch${layoutId ? `[data-lcw-target="${desktopEscapeAttr(layoutId)}"]` : ''}`).forEach(button => {
        button.classList.toggle('active', button.dataset.tone === tone);
    });
    document.querySelectorAll('.lcw-bubble-custom').forEach(label => {
        const input = label.querySelector('input');
        if (layoutId && input?.dataset?.lcwTarget !== layoutId) return;
        label.classList.toggle('active', tone === 'custom');
    });
    const panelRange = document.querySelector(`.desktop-lovely-bubble-panel input[data-lcw-target="${desktopEscapeAttr(layoutId)}"][type="range"]`);
    if (panelRange) panelRange.value = normalizeDesktopLovelyBubbleOpacity(data?.bubbleOpacity);
}

function setDesktopLovelyBubbleTone(button) {
    const widget = getDesktopLovelyWidgetFromControl(button);
    const tone = normalizeDesktopLovelyBubbleTone(button?.dataset?.tone);
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(widget.dataset.layoutId);
    data.bubbleTone = tone;
    if (tone !== 'custom') data.bubbleColor = data.bubbleColor || '';
    setDesktopLovelyWidgetData(widget.dataset.layoutId, data);
    applyDesktopLovelyBubbleColor(widget, data);
}
window.setDesktopLovelyBubbleTone = setDesktopLovelyBubbleTone;

function setDesktopLovelyBubbleCustomColor(input) {
    const widget = getDesktopLovelyWidgetFromControl(input);
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(widget.dataset.layoutId);
    data.bubbleTone = 'custom';
    data.bubbleColor = normalizeDesktopLovelyBubbleColor(input.value) || DESKTOP_LOVELY_BUBBLE_HEX.blue;
    setDesktopLovelyWidgetData(widget.dataset.layoutId, data);
    applyDesktopLovelyBubbleColor(widget, data);
}
window.setDesktopLovelyBubbleCustomColor = setDesktopLovelyBubbleCustomColor;

function setDesktopLovelyBubbleOpacity(input) {
    const widget = getDesktopLovelyWidgetFromControl(input);
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(widget.dataset.layoutId);
    data.bubbleOpacity = normalizeDesktopLovelyBubbleOpacity(input.value);
    setDesktopLovelyWidgetData(widget.dataset.layoutId, data);
    applyDesktopLovelyBubbleColor(widget, data);
}
window.setDesktopLovelyBubbleOpacity = setDesktopLovelyBubbleOpacity;

function closeDesktopLovelyBubblePanel() {
    document.querySelector('.desktop-lovely-bubble-panel')?.remove();
}
window.closeDesktopLovelyBubblePanel = closeDesktopLovelyBubblePanel;

function openDesktopLovelyBubblePanel(layoutId) {
    const widget = document.querySelector(getDesktopLovelyPanelTargetSelector(layoutId));
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(layoutId);
    closeDesktopLovelyBubblePanel();
    const panel = document.createElement('div');
    panel.className = 'desktop-lovely-bubble-panel';
    panel.innerHTML = `
        <button type="button" class="desktop-lovely-bubble-panel-backdrop" aria-label="关闭气泡属性" onclick="closeDesktopLovelyBubblePanel()"></button>
        <div class="desktop-lovely-bubble-sheet" role="dialog" aria-label="气泡属性" onpointerdown="event.stopPropagation()" ontouchstart="event.stopPropagation()" onmousedown="event.stopPropagation()">
            <div class="desktop-lovely-bubble-sheet-head">
                <span>气泡属性</span>
                <button type="button" aria-label="关闭" onclick="closeDesktopLovelyBubblePanel()"><i class="ri-close-line"></i></button>
            </div>
            <div class="desktop-lovely-bubble-panel-row">
                <span>背景</span>
                ${renderDesktopLovelyBubblePalette(data, { targetId: layoutId })}
            </div>
            <label class="desktop-lovely-bubble-panel-row desktop-lovely-opacity-row">
                <span>透明度</span>
                <input type="range" min="0.18" max="1" step="0.02" value="${desktopEscapeAttr(data.bubbleOpacity)}" data-lcw-target="${desktopEscapeAttr(layoutId)}" oninput="setDesktopLovelyBubbleOpacity(this)" onpointerdown="event.stopPropagation()" ontouchstart="event.stopPropagation()" onmousedown="event.stopPropagation()">
            </label>
        </div>
    `;
    (document.getElementById('home-screen') || document.body).appendChild(panel);
}
window.openDesktopLovelyBubblePanel = openDesktopLovelyBubblePanel;

function applyDesktopLovelyTitleColors(widget, data) {
    const titleRow = widget?.querySelector?.('.lcw-title-row');
    if (!titleRow) return;
    const innerTone = normalizeDesktopLovelyBubbleTone(data?.titleInnerTone || 'blue');
    const outerTone = normalizeDesktopLovelyBubbleTone(data?.titleOuterTone || 'clear');
    titleRow.dataset.innerTone = innerTone;
    titleRow.dataset.outerTone = outerTone;
    titleRow.style.setProperty('--lcw-title-inner', getDesktopLovelyToneColor(innerTone, data?.titleInnerColor, 'blue'));
    titleRow.style.setProperty('--lcw-title-outer', getDesktopLovelyToneColor(outerTone, data?.titleOuterColor, 'clear'));
    titleRow.querySelectorAll('.lcw-title-swatch').forEach(button => {
        const activeTone = button.dataset.part === 'outer' ? outerTone : innerTone;
        button.classList.toggle('active', button.dataset.tone === activeTone);
    });
    titleRow.querySelectorAll('.lcw-title-custom').forEach(label => {
        const input = label.querySelector('input');
        const activeTone = input?.dataset?.part === 'outer' ? outerTone : innerTone;
        label.classList.toggle('active', activeTone === 'custom');
    });
}

function setDesktopLovelyTitleTone(button) {
    const widget = button?.closest?.('.desktop-widget-lovely');
    const part = button?.dataset?.part === 'outer' ? 'outer' : 'inner';
    const tone = normalizeDesktopLovelyBubbleTone(button?.dataset?.tone);
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(widget.dataset.layoutId);
    if (part === 'outer') {
        data.titleOuterTone = tone;
    } else {
        data.titleInnerTone = tone;
    }
    setDesktopLovelyWidgetData(widget.dataset.layoutId, data);
    applyDesktopLovelyTitleColors(widget, data);
}
window.setDesktopLovelyTitleTone = setDesktopLovelyTitleTone;

function setDesktopLovelyTitleCustomColor(input) {
    const widget = input?.closest?.('.desktop-widget-lovely');
    const part = input?.dataset?.part === 'outer' ? 'outer' : 'inner';
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(widget.dataset.layoutId);
    if (part === 'outer') {
        data.titleOuterTone = 'custom';
        data.titleOuterColor = normalizeDesktopLovelyBubbleColor(input.value) || DESKTOP_LOVELY_BUBBLE_HEX.blue;
    } else {
        data.titleInnerTone = 'custom';
        data.titleInnerColor = normalizeDesktopLovelyBubbleColor(input.value) || DESKTOP_LOVELY_BUBBLE_HEX.blue;
    }
    setDesktopLovelyWidgetData(widget.dataset.layoutId, data);
    applyDesktopLovelyTitleColors(widget, data);
}
window.setDesktopLovelyTitleCustomColor = setDesktopLovelyTitleCustomColor;

function saveDesktopLovelyTitle(input) {
    const widget = input?.closest?.('.desktop-widget-lovely');
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(widget.dataset.layoutId);
    data.title = String(input.value || '').slice(0, 28);
    setDesktopLovelyWidgetData(widget.dataset.layoutId, data);
}
window.saveDesktopLovelyTitle = saveDesktopLovelyTitle;

function saveDesktopLovelySubtitle(input) {
    const widget = input?.closest?.('.desktop-widget-lovely');
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(widget.dataset.layoutId);
    data.subtitle = String(input.value || '').slice(0, 28);
    setDesktopLovelyWidgetData(widget.dataset.layoutId, data);
}
window.saveDesktopLovelySubtitle = saveDesktopLovelySubtitle;

function saveDesktopLovelyChecklist(input) {
    const widget = input?.closest?.('.desktop-widget-lovely');
    if (!widget) return;
    const data = getDesktopLovelyWidgetData(widget.dataset.layoutId);
    data.checks = Array.from(widget.querySelectorAll('.lcw-task')).map(row => ({
        done: !!row.querySelector('.lcw-task-check')?.checked,
        text: String(row.querySelector('.lcw-task-text')?.value || '').slice(0, 40)
    }));
    setDesktopLovelyWidgetData(widget.dataset.layoutId, data);
}
window.saveDesktopLovelyChecklist = saveDesktopLovelyChecklist;

function syncDesktopLovelyWidgetsFromDom() {
    document.querySelectorAll('.desktop-widget-lovely').forEach(widget => {
        const layoutId = widget.dataset.layoutId;
        if (!layoutId) return;
        const data = getDesktopLovelyWidgetData(layoutId);
        const title = widget.querySelector('.lcw-title-input');
        if (title) data.title = String(title.value || '').slice(0, 28);
        const bubble = widget.querySelector('.lcw-bubble');
        if (bubble) {
            data.bubble = Array.from(widget.querySelectorAll('.lcw-title-card-right .lcw-bubble'))
                .map(input => String(input.value || '').trim())
                .filter(Boolean)
                .join('\n')
                .slice(0, 140);
        }
        const subtitle = widget.querySelector('.lcw-title-subtitle');
        if (subtitle) data.subtitle = String(subtitle.value || '').slice(0, 28);
        const bubbleCard = widget.querySelector('.lcw-bubble-card');
        if (bubbleCard) data.bubbleTone = normalizeDesktopLovelyBubbleTone(bubbleCard.dataset.tone);
        const bubbleOpacity = widget.querySelector('.lcw-bubble-opacity-control input');
        if (bubbleOpacity) data.bubbleOpacity = normalizeDesktopLovelyBubbleOpacity(bubbleOpacity.value);
        const customColor = widget.querySelector('.lcw-bubble-custom input');
        if (customColor) data.bubbleColor = normalizeDesktopLovelyBubbleColor(customColor.value);
        const titleRow = widget.querySelector('.lcw-title-row');
        if (titleRow) {
            data.titleInnerTone = normalizeDesktopLovelyBubbleTone(titleRow.dataset.innerTone || 'blue');
            data.titleOuterTone = normalizeDesktopLovelyBubbleTone(titleRow.dataset.outerTone || 'clear');
        }
        const titleInnerCustom = widget.querySelector('.lcw-title-custom input[data-part="inner"]');
        if (titleInnerCustom) data.titleInnerColor = normalizeDesktopLovelyBubbleColor(titleInnerCustom.value);
        const titleOuterCustom = widget.querySelector('.lcw-title-custom input[data-part="outer"]');
        if (titleOuterCustom) data.titleOuterColor = normalizeDesktopLovelyBubbleColor(titleOuterCustom.value);
        data.checks = Array.from(widget.querySelectorAll('.lcw-task')).map(row => ({
            done: !!row.querySelector('.lcw-task-check')?.checked,
            text: String(row.querySelector('.lcw-task-text')?.value || '').slice(0, 40)
        }));
        setDesktopLovelyWidgetData(layoutId, data);
    });
    document.querySelectorAll('.desktop-widget-notes-trio').forEach(widget => {
        const layoutId = widget.dataset.layoutId;
        if (!layoutId) return;
        const data = getDesktopLovelyWidgetData(layoutId);
        const text = widget.querySelector('.dnw-text');
        if (text) data.noteText = String(text.value || '').slice(0, 90);
        const shell = widget.querySelector('.dnw-shell');
        if (shell) data.noteTone = Object.prototype.hasOwnProperty.call(DESKTOP_NOTES_WIDGET_TONES, shell.dataset.tone) ? shell.dataset.tone : 'blue';
        setDesktopLovelyWidgetData(layoutId, data);
    });
}

function createDesktopCustomWidget(kind, id) {
    const el = document.createElement('div');
    const safeKind = DESKTOP_CUSTOM_WIDGET_KINDS.has(kind) ? kind : 'princess';
    const layoutId = id || `custom-${safeKind}-${Date.now()}`;
    const noteText = getDesktopStickyNoteValue(layoutId);
    el.className = `desktop-custom-widget desktop-widget-${safeKind}`;
    el.dataset.layoutType = 'custom';
    el.dataset.widgetKind = safeKind;
    el.dataset.layoutId = layoutId;
    const templates = {
        princess: `
            <div class="pw-card">
                <div class="pw-bow pw-bow-main"><span></span></div>
                <div class="pw-date">07/05/22</div>
                <div class="pw-love">love forever</div>
                <div class="pw-vertical">For appreciation only</div>
                <div class="pw-stamp">SAMPLE</div>
                <span class="pw-star s1">✦</span>
                <span class="pw-star s2">✦</span>
                <span class="pw-star s3">✦</span>
                <span class="pw-star s4">✦</span>
                <span class="pw-star s5">✦</span>
                <textarea class="pw-note" maxlength="220" placeholder="写一点今天想记住的事" oninput="saveDesktopStickyNote(this)">${musicEscapeHtml(noteText || 'Around the\ngalaxy, there are no\nbrighter stars than you.')}</textarea>
                <div class="pw-title">The princess</div>
                <div class="pw-script">You are my highness</div>
                <div class="pw-bow-stack">
                    <span class="pw-mini-bow"></span>
                    <span class="pw-mini-bow"></span>
                    <span class="pw-mini-bow"></span>
                </div>
            </div>
        `,
        status: `
            <div class="dsw-shell">
                <div class="dsw-top">
                    <div class="dsw-battery-pill">
                        <strong data-dsw-battery>--%</strong>
                        <span>剩余电量</span>
                    </div>
                    <div class="dsw-ring" aria-hidden="true"><span></span></div>
                </div>
                <div class="dsw-card">
                    <div class="dsw-avatar" onclick="this.querySelector('.dsw-avatar-input')?.click()">
                        <img data-dsw-avatar src="${desktopEscapeAttr(window.DEFAULT_AVATAR || '')}" alt="">
                        <input class="dsw-avatar-input" type="file" accept="image/*" onchange="handleDesktopStatusAvatarInput(this)">
                    </div>
                    <div class="dsw-mid">
                        <div class="dsw-symbols" aria-hidden="true">
                            <i class="ri-heart-3-line"></i>
                            <i class="ri-sparkling-2-line"></i>
                            <i class="ri-heart-3-fill"></i>
                            <i class="ri-send-plane-2-line"></i>
                            <i class="ri-gift-line"></i>
                            <i class="ri-sparkling-fill"></i>
                        </div>
                        <div class="dsw-date" data-dsw-date>--月--日 · 周-</div>
                        <button type="button" class="dsw-weather" data-dsw-weather onclick="event.stopPropagation(); requestDesktopStatusWeather({ force: true })">授权定位获取天气</button>
                    </div>
                    <div class="dsw-right">
                        <strong data-dsw-time>--:--</strong>
                        <button type="button" class="dsw-steps" data-dsw-steps onclick="event.stopPropagation(); requestDesktopStatusSteps({ force: true })">步数 未连接</button>
                    </div>
                </div>
            </div>
        `,
        lovely: renderDesktopLovelyWidgetInner(layoutId),
        polaroid: renderDesktopPolaroidWidgetInner(layoutId),
        calendar: renderDesktopCalendarWidgetInner(),
        'photo-square': renderDesktopPhotoSquareWidgetInner(layoutId),
        'notes-trio': renderDesktopNotesTrioWidgetInner(layoutId),
        catalog: renderDesktopCatalogWidgetInner(layoutId)
    };
    el.innerHTML = templates[safeKind];
    if (safeKind === 'status') setTimeout(updateDesktopStatusWidgets, 0);
    if (safeKind === 'notes-trio') setTimeout(updateDesktopStatusWidgets, 0);
    if (safeKind === 'calendar') setTimeout(initCalendar, 0);
    return el;
}

function getDesktopStickyNotes() {
    try {
        const notes = JSON.parse(localStorage.getItem(DESKTOP_STICKY_NOTES_KEY) || '{}');
        return notes && typeof notes === 'object' ? notes : {};
    } catch (e) {
        return {};
    }
}

function setDesktopStickyNoteValue(id, text) {
    if (!id) return;
    const notes = getDesktopStickyNotes();
    notes[id] = String(text || '').slice(0, 220);
    localStorage.setItem(DESKTOP_STICKY_NOTES_KEY, JSON.stringify(notes));
}

function getDesktopStickyNoteValue(id) {
    const notes = getDesktopStickyNotes();
    return notes[id] || '';
}

function saveDesktopStickyNote(input) {
    const widget = input?.closest?.('.desktop-custom-widget');
    if (!widget) return;
    setDesktopStickyNoteValue(widget.dataset.layoutId, input.value || '');
}
window.saveDesktopStickyNote = saveDesktopStickyNote;

function syncDesktopStickyNotesFromDom() {
    document.querySelectorAll('.desktop-widget-princess .pw-note').forEach(input => saveDesktopStickyNote(input));
    syncDesktopLovelyWidgetsFromDom();
}

function snapDesktopNumber(value, step = DESKTOP_SNAP_GRID) {
    return Math.round(Number(value || 0) / step) * step;
}

function getDesktopSnapTargets(pageArea, activeItem) {
    const areaWidth = Math.max(260, pageArea?.clientWidth || 375);
    const areaHeight = Math.max(520, pageArea?.clientHeight || 590);
    const vertical = [{ value: Math.round(areaWidth / 2), type: 'center' }];
    const horizontal = [{ value: Math.round(areaHeight / 2), type: 'center' }];
    pageArea?.querySelectorAll?.(':scope > .desktop-layout-item')?.forEach(item => {
        if (!item || item === activeItem) return;
        const left = parseFloat(item.style.left) || item.offsetLeft || 0;
        const top = parseFloat(item.style.top) || item.offsetTop || 0;
        const width = item.offsetWidth || parseFloat(item.style.width) || 0;
        const height = item.offsetHeight || parseFloat(item.style.height) || 0;
        vertical.push(
            { value: Math.round(left), type: 'peer' },
            { value: Math.round(left + width / 2), type: 'peer' },
            { value: Math.round(left + width), type: 'peer' }
        );
        horizontal.push(
            { value: Math.round(top), type: 'peer' },
            { value: Math.round(top + height / 2), type: 'peer' },
            { value: Math.round(top + height), type: 'peer' }
        );
    });
    return { vertical, horizontal };
}

function findDesktopSnapMatch(targets, points) {
    let best = null;
    targets.forEach(target => {
        points.forEach(point => {
            const distance = Math.abs(point.value - target.value);
            if (distance > DESKTOP_SNAP_TOLERANCE) return;
            if (!best || distance < best.distance || (distance === best.distance && target.type === 'center')) {
                best = { ...target, offset: point.offset, pointRole: point.role || '', distance };
            }
        });
    });
    return best;
}

function snapDesktopLayoutRect(rect, pageArea, options = {}) {
    const source = rect || {};
    const areaWidth = Math.max(260, pageArea?.clientWidth || 375);
    const areaHeight = Math.max(520, pageArea?.clientHeight || 590);
    let width = Math.max(54, snapDesktopNumber(source.width || 72));
    let height = Math.max(58, snapDesktopNumber(source.height || 76));
    let left = snapDesktopNumber(source.left);
    let top = snapDesktopNumber(source.top);
    let guideX = left;
    let guideY = top;
    let snapXType = '';
    let snapYType = '';
    const mode = options.mode || 'move';
    const targets = getDesktopSnapTargets(pageArea, options.item || null);

    if (mode === 'resize') {
        const rightMatch = findDesktopSnapMatch(targets.vertical, [
            { value: left + width, offset: 0, role: 'edge' },
            { value: left + width / 2, offset: width / 2, role: 'center' }
        ]);
        const bottomMatch = findDesktopSnapMatch(targets.horizontal, [
            { value: top + height, offset: 0, role: 'edge' },
            { value: top + height / 2, offset: height / 2, role: 'center' }
        ]);
        if (rightMatch) {
            width = Math.max(54, rightMatch.pointRole === 'center' ? (rightMatch.value - left) * 2 : rightMatch.value - left);
            guideX = rightMatch.value;
            snapXType = rightMatch.type;
        } else {
            guideX = left + width;
        }
        if (bottomMatch) {
            height = Math.max(58, bottomMatch.pointRole === 'center' ? (bottomMatch.value - top) * 2 : bottomMatch.value - top);
            guideY = bottomMatch.value;
            snapYType = bottomMatch.type;
        } else {
            guideY = top + height;
        }
    } else {
        const xMatch = findDesktopSnapMatch(targets.vertical, [
            { value: left, offset: 0 },
            { value: left + width / 2, offset: width / 2 },
            { value: left + width, offset: width }
        ]);
        const yMatch = findDesktopSnapMatch(targets.horizontal, [
            { value: top, offset: 0 },
            { value: top + height / 2, offset: height / 2 },
            { value: top + height, offset: height }
        ]);
        if (xMatch) {
            left = Math.round(xMatch.value - xMatch.offset);
            guideX = xMatch.value;
            snapXType = xMatch.type;
        }
        if (yMatch) {
            top = Math.round(yMatch.value - yMatch.offset);
            guideY = yMatch.value;
            snapYType = yMatch.type;
        }
    }

    const safe = clampDesktopLayoutRect({ ...source, left, top, width, height }, pageArea);
    return {
        ...safe,
        guideX: Math.max(0, Math.min(areaWidth, guideX)),
        guideY: Math.max(0, Math.min(areaHeight, guideY)),
        centerX: snapXType === 'center',
        centerY: snapYType === 'center',
        peerX: snapXType === 'peer',
        peerY: snapYType === 'peer',
        mode
    };
}

function ensureDesktopSnapGuides(pageArea) {
    if (!pageArea) return null;
    let guide = pageArea.querySelector(':scope > .desktop-snap-guides');
    if (!guide) {
        guide = document.createElement('div');
        guide.className = 'desktop-snap-guides';
        guide.innerHTML = '<span class="desktop-snap-guide vertical"></span><span class="desktop-snap-guide horizontal"></span>';
        pageArea.appendChild(guide);
    }
    return guide;
}

function showDesktopSnapGuides(pageArea, rect) {
    const guide = ensureDesktopSnapGuides(pageArea);
    if (!guide || !rect) return;
    const vertical = guide.querySelector('.vertical');
    const horizontal = guide.querySelector('.horizontal');
    if (vertical) {
        vertical.style.left = `${Math.round(rect.mode === 'resize' ? rect.left + rect.width : rect.guideX)}px`;
        vertical.classList.toggle('center', !!rect.centerX);
        vertical.classList.toggle('peer', !!rect.peerX);
    }
    if (horizontal) {
        horizontal.style.top = `${Math.round(rect.mode === 'resize' ? rect.top + rect.height : rect.guideY)}px`;
        horizontal.classList.toggle('center', !!rect.centerY);
        horizontal.classList.toggle('peer', !!rect.peerY);
    }
    guide.classList.add('visible');
}

function hideDesktopSnapGuides(pageArea) {
    const scope = pageArea || document;
    scope.querySelectorAll('.desktop-snap-guides.visible').forEach(guide => guide.classList.remove('visible'));
}

function applyDesktopLayoutRect(item, pageArea, rect, options = {}) {
    const safe = snapDesktopLayoutRect(rect, pageArea, { ...options, item });
    item.style.left = `${Math.round(safe.left)}px`;
    item.style.top = `${Math.round(safe.top)}px`;
    item.style.width = `${Math.round(safe.width)}px`;
    item.style.height = `${Math.round(safe.height)}px`;
    if (item && !item.classList.contains('layout-app')) delete pageArea._desktopSlotRects;
    showDesktopSnapGuides(pageArea, safe);
    return safe;
}

function getDesktopCustomWidgetSize(kind) {
    if (kind === 'lovely') return { width: 340, height: 248 };
    if (kind === 'polaroid') return { width: 322, height: 128 };
    if (kind === 'status') return { width: 322, height: 116 };
    if (kind === 'calendar') return { width: 322, height: 180 };
    if (kind === 'photo-square') return { width: 156, height: 156 };
    if (kind === 'notes-trio') return { width: 168, height: 168 };
    if (kind === 'catalog') return { width: 322, height: 322 };
    if (kind === 'princess') return { width: 188, height: 188 };
    return { width: 188, height: 188 };
}

function findDesktopOpenWidgetRect(pageArea, size, preferredRect = null, ignoreItems = []) {
    const width = Math.min(size?.width || 188, Math.max(120, (pageArea?.clientWidth || 375) - 24));
    const height = Math.min(size?.height || 188, Math.max(120, (pageArea?.clientHeight || 590) - 24));
    const areaWidth = Math.max(260, pageArea?.clientWidth || 375);
    const areaHeight = Math.max(520, pageArea?.clientHeight || 590);
    const candidates = [];
    const step = 24;
    const maxTop = Math.max(12, areaHeight - height - 12);
    const maxLeft = Math.max(12, areaWidth - width - 12);
    for (let top = 18; top <= maxTop; top += step) {
        for (let left = 14; left <= maxLeft; left += step) {
            candidates.push(clampDesktopLayoutRect({ left, top, width, height }, pageArea));
        }
    }
    if (!candidates.length) return clampDesktopLayoutRect({ left: 18, top: 44, width, height }, pageArea);
    const ignored = new Set(ignoreItems.filter(Boolean));
    const existing = Array.from(pageArea.querySelectorAll(':scope > .desktop-layout-item'))
        .filter(item => !item.classList.contains('desktop-layout-dragging') && !ignored.has(item));
    const scored = candidates.map(rect => {
        const overlap = existing.reduce((score, item) => Math.max(score, getDesktopRectIntersectionRatio(rect, getDesktopStyleRect(item, pageArea))), 0);
        const source = preferredRect || { left: 18, top: 44 };
        const distance = Math.abs(rect.left - source.left) + Math.abs(rect.top - source.top);
        return { rect, overlap, distance };
    }).sort((a, b) => (a.overlap - b.overlap) || (a.distance - b.distance));
    const best = scored.find(entry => entry.overlap < 0.08) || scored[0];
    return best.rect;
}

function addDesktopCustomWidget(kind) {
    if (!DESKTOP_CUSTOM_WIDGET_KINDS.has(kind)) return;
    if (!window._editMode) enterEditMode();
    const pageIndex = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
    const page = ensureDesktopPage(pageIndex) || document.querySelector('#pages-container .desktop-page');
    const pageArea = page?.querySelector('.desktop-scroll-area');
    if (!pageArea) return;
    const item = createDesktopCustomWidget(kind);
    const size = getDesktopCustomWidgetSize(kind);
    pageArea.appendChild(item);
    prepareDesktopLayoutItem(item, pageArea, findDesktopOpenWidgetRect(pageArea, size));
    settleDesktopAppsAroundWidget(item, pageArea);
    if (kind === 'status') {
        updateDesktopStatusWidgets();
        requestDesktopStatusWeather({ force: true });
    }
    selectDesktopLayoutItem(item);
}

function ensureDesktopLovelyWidget() {
    if (localStorage.getItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY) === '1') return;
    const page = ensureDesktopPage(1);
    const pageArea = page?.querySelector('.desktop-scroll-area');
    if (!pageArea || pageArea.querySelector('.desktop-widget-lovely')) return;
    const item = createDesktopCustomWidget('lovely', DESKTOP_DEFAULT_LOVELY_ID);
    const size = getDesktopCustomWidgetSize('lovely');
    if (pageArea.classList.contains('layout-canvas') || pageArea.querySelector(':scope > .desktop-layout-item')) {
        pageArea.appendChild(item);
        prepareDesktopLayoutItem(item, pageArea, {
            left: 22,
            top: DESKTOP_DEFAULT_LOVELY_TOP,
            width: Math.min(size.width, Math.max(260, pageArea.clientWidth - 44)),
            height: size.height
        });
        compactDesktopSlotOrder(pageArea);
    } else {
        item.style.marginTop = `${DESKTOP_DEFAULT_LOVELY_TOP}px`;
        pageArea.insertBefore(item, pageArea.firstChild);
    }
    pageArea.scrollTop = 0;
    pageArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    syncDesktopPagesAndDots(Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0);
}
window.ensureDesktopLovelyWidget = ensureDesktopLovelyWidget;

function ensureDesktopPrincessWidget() {
    if (localStorage.getItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY) === '1') return;
    const page = ensureDesktopPage(1);
    const pageArea = page?.querySelector('.desktop-scroll-area');
    if (!pageArea || pageArea.querySelector('.desktop-widget-princess')) return;
    const item = createDesktopCustomWidget('princess', DESKTOP_DEFAULT_PRINCESS_ID);
    pageArea.insertBefore(item, pageArea.firstChild);
    pageArea.scrollTop = 0;
    pageArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    syncDesktopPagesAndDots(Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0);
}
window.ensureDesktopPrincessWidget = ensureDesktopPrincessWidget;

function deleteSelectedDesktopLayoutItem() {
    const item = window._desktopSelectedLayoutItem;
    if (!item) return;
    const layoutId = item.dataset.layoutId || '';
    const isCustom = item.dataset.layoutType === 'custom';
    const isDeletableBuiltin = DESKTOP_DELETABLE_BUILTIN_IDS.has(layoutId);
    if (!isCustom && !isDeletableBuiltin) return;
    if (isCustom) {
        if (layoutId === DESKTOP_DEFAULT_PRINCESS_ID) {
            localStorage.setItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY, '1');
        }
        if (layoutId === DESKTOP_DEFAULT_LOVELY_ID) {
            localStorage.setItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY, '1');
        }
        if (item.dataset.widgetKind === 'status') deleteDesktopStatusWidgetPrefs(layoutId);
        if (item.dataset.widgetKind === 'lovely' || item.dataset.widgetKind === 'polaroid' || item.dataset.widgetKind === 'photo-square' || item.dataset.widgetKind === 'notes-trio' || item.dataset.widgetKind === 'catalog') deleteDesktopLovelyWidgetPrefs(layoutId);
        const notes = getDesktopStickyNotes();
        if (layoutId && Object.prototype.hasOwnProperty.call(notes, layoutId)) {
            delete notes[layoutId];
            localStorage.setItem(DESKTOP_STICKY_NOTES_KEY, JSON.stringify(notes));
        }
    }
    const area = item.closest('.desktop-scroll-area');
    item.remove();
    window._desktopSelectedLayoutItem = null;
    if (area && !area.querySelector(':scope > .desktop-layout-item')) {
        area.querySelector('.desktop-empty-placeholder')?.classList.remove('layout-source-hidden');
    }
    if (typeof showWechatToast === 'function') showWechatToast('已删除组件，保存布局后生效');
}
window.deleteSelectedDesktopLayoutItem = deleteSelectedDesktopLayoutItem;
function deleteSelectedDesktopCustomWidget() {
    deleteSelectedDesktopLayoutItem();
}
window.deleteSelectedDesktopCustomWidget = deleteSelectedDesktopCustomWidget;

function addDesktopScreen() {
    if (!window._editMode) enterEditMode();
    const pages = getDesktopPages();
    const nextIndex = pages.length;
    const page = ensureDesktopPage(nextIndex);
    const pageArea = page?.querySelector('.desktop-scroll-area');
    if (pageArea) {
        pageArea.classList.add('layout-canvas');
        pageArea.querySelector('.desktop-empty-placeholder')?.classList.remove('layout-source-hidden');
    }
    if (typeof window.goToDesktopPage === 'function') window.goToDesktopPage(nextIndex);
    if (typeof showWechatToast === 'function') showWechatToast(`已添加第 ${nextIndex + 1} 屏`);
}
window.addDesktopScreen = addDesktopScreen;

function isDesktopScreenEmpty(page) {
    const area = page?.querySelector?.('.desktop-scroll-area');
    if (!area) return true;
    return !Array.from(area.children || []).some(child => {
        if (!child || child.classList.contains('desktop-empty-placeholder') || child.classList.contains('desktop-snap-guides')) return false;
        if (child.classList.contains('layout-source-hidden')) return false;
        return child.matches?.('.desktop-layout-item, .desktop-custom-widget, .app-item, .photo-large, .calendar-widget, .bento-box');
    });
}

function deleteEmptyDesktopScreen() {
    if (!window._editMode) enterEditMode();
    const pages = getDesktopPages();
    if (pages.length <= 1) {
        if (typeof showWechatToast === 'function') showWechatToast('至少保留一个屏幕');
        return;
    }
    const currentIndex = Math.max(0, Math.min(pages.length - 1, Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0));
    let deleteIndex = isDesktopScreenEmpty(pages[currentIndex]) ? currentIndex : -1;
    if (deleteIndex < 0) {
        deleteIndex = pages.findIndex((page, index) => index > 0 && isDesktopScreenEmpty(page));
    }
    if (deleteIndex < 0) {
        if (typeof showWechatToast === 'function') showWechatToast('没有空白屏幕可以删除');
        return;
    }
    if (window._desktopSelectedLayoutItem && pages[deleteIndex].contains(window._desktopSelectedLayoutItem)) {
        window._desktopSelectedLayoutItem = null;
    }
    pages[deleteIndex].remove();
    const nextIndex = Math.max(0, Math.min(deleteIndex, getDesktopPages().length - 1));
    window._desktopCurrentPage = nextIndex;
    syncDesktopPagesAndDots(nextIndex);
    if (typeof window.goToDesktopPage === 'function') window.goToDesktopPage(nextIndex);
    if (typeof showWechatToast === 'function') showWechatToast('已删除空白屏幕');
}
window.deleteEmptyDesktopScreen = deleteEmptyDesktopScreen;

function moveSelectedDesktopItemToOtherPage() {
    const item = window._desktopSelectedLayoutItem;
    if (!item) return;
    let pages = getDesktopPages();
    if (pages.length < 2) {
        ensureDesktopPage(1);
        pages = getDesktopPages();
    }
    const currentPage = item.closest('.desktop-page');
    const currentIndex = getDesktopPageIndex(currentPage);
    const nextIndex = (currentIndex + 1) % Math.max(1, pages.length);
    const targetPage = ensureDesktopPage(nextIndex);
    const targetArea = targetPage?.querySelector('.desktop-scroll-area');
    if (!targetArea) return;
    targetArea.classList.add('layout-canvas');
    targetArea.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
    targetArea.appendChild(item);
    item.style.left = '24px';
    item.style.top = '64px';
    if (typeof window.goToDesktopPage === 'function') window.goToDesktopPage(nextIndex);
    selectDesktopLayoutItem(item);
}

function getDesktopWidgetLibraryItems() {
    return [
        {
            kind: 'princess',
            title: '蝴蝶结',
            desc: '便签风格小卡片',
            symbol: '✦',
            preview: 'princess',
            tone: 'princess'
        },
        {
            kind: 'status',
            title: '状态条',
            desc: '头像、电量、天气、时间',
            icon: 'ri-dashboard-3-line',
            preview: 'status',
            tone: 'status'
        },
        {
            kind: 'calendar',
            title: '日历',
            desc: '原桌面日历，可拖动缩放',
            icon: 'ri-calendar-line',
            preview: 'calendar',
            tone: 'calendar'
        },
        {
            kind: 'photo-square',
            title: '正方形照片',
            desc: '点击即可更换照片',
            icon: 'ri-image-line',
            preview: 'photo-square',
            tone: 'photo-square'
        },
        {
            kind: 'lovely',
            title: '头像签名',
            desc: '横图、圆头像和下方签名',
            icon: 'ri-collage-line',
            preview: 'lovely',
            tone: 'lovely'
        },
        {
            kind: 'polaroid',
            title: '照片墙',
            desc: '三连拍立得，点击更换照片',
            icon: 'ri-image-2-line',
            preview: 'polaroid',
            tone: 'polaroid'
        },
        {
            kind: 'notes-trio',
            title: 'Notes 三头像',
            desc: '三张圆图、文字和颜色预设',
            icon: 'ri-sticky-note-line',
            preview: 'notes-trio',
            tone: 'notes-trio'
        },
        {
            kind: 'catalog',
            title: 'Catalog 相册',
            desc: '横图、头像和三张缩略图',
            icon: 'ri-gallery-line',
            preview: 'catalog',
            tone: 'catalog'
        }
    ];
}

function renderDesktopWidgetLibraryIcon(item) {
    if (item.preview) return `<span class="desktop-widget-thumb desktop-widget-thumb-${desktopEscapeAttr(item.preview)}" aria-hidden="true"><i></i></span>`;
    if (item.symbol) return `<b class="desktop-widget-library-symbol">${desktopEscapeHtml(item.symbol)}</b>`;
    return `<i class="${desktopEscapeAttr(item.icon || 'ri-layout-grid-line')}"></i>`;
}

function openDesktopWidgetLibrary() {
    const home = document.getElementById('home-screen');
    if (!home || document.getElementById('desktop-widget-library')) return;
    const modal = document.createElement('div');
    modal.id = 'desktop-widget-library';
    modal.className = 'desktop-widget-library';
    modal.innerHTML = `
        <div class="desktop-widget-library-card">
            <div class="desktop-widget-library-head">
                <div>
                    <strong>组件</strong>
                    <span>选择一个小组件添加到当前屏幕</span>
                </div>
                <button type="button" onclick="closeDesktopWidgetLibrary()" aria-label="关闭组件库"><i class="ri-close-line"></i></button>
            </div>
            <div class="desktop-widget-library-grid">
                ${getDesktopWidgetLibraryItems().map(item => `
                    <button type="button" class="desktop-widget-choice ${desktopEscapeAttr(item.tone || '')}" onclick="addDesktopCustomWidgetFromLibrary('${desktopEscapeAttr(item.kind)}')">
                        <span class="desktop-widget-choice-preview">${renderDesktopWidgetLibraryIcon(item)}</span>
                        <span class="desktop-widget-choice-copy">
                            <b>${desktopEscapeHtml(item.title)}</b>
                            <em>${desktopEscapeHtml(item.desc)}</em>
                        </span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    modal.addEventListener('click', event => {
        if (event.target === modal) closeDesktopWidgetLibrary();
    });
    home.appendChild(modal);
}
window.openDesktopWidgetLibrary = openDesktopWidgetLibrary;

function closeDesktopWidgetLibrary() {
    document.getElementById('desktop-widget-library')?.remove();
}
window.closeDesktopWidgetLibrary = closeDesktopWidgetLibrary;

function addDesktopCustomWidgetFromLibrary(kind) {
    closeDesktopWidgetLibrary();
    addDesktopCustomWidget(kind);
}
window.addDesktopCustomWidgetFromLibrary = addDesktopCustomWidgetFromLibrary;

function renderDesktopEditChrome() {
    const home = document.getElementById('home-screen');
    if (!home || document.getElementById('desktop-edit-toolbar')) return;
    if (!document.getElementById('desktop-edit-swipe-zone')) {
        const swipeZone = document.createElement('div');
        swipeZone.id = 'desktop-edit-swipe-zone';
        swipeZone.className = 'desktop-edit-swipe-zone';
        swipeZone.setAttribute('aria-label', '滑动切换桌面屏幕');
        swipeZone.addEventListener('pointerdown', handleDesktopEditSwipeZonePointerDown);
        swipeZone.addEventListener('touchstart', handleDesktopEditSwipeZoneTouchStart, { passive: true });
        swipeZone.addEventListener('touchmove', handleDesktopEditSwipeZoneTouchMove, { passive: false });
        swipeZone.addEventListener('touchend', handleDesktopEditSwipeZoneTouchEnd);
        swipeZone.addEventListener('touchcancel', handleDesktopEditSwipeZoneTouchEnd);
        home.appendChild(swipeZone);
    }
    const toolbar = document.createElement('div');
    toolbar.id = 'desktop-edit-toolbar';
    toolbar.className = 'desktop-edit-toolbar';
    toolbar.innerHTML = `
        <div class="desktop-edit-handle">
            <strong>编辑桌面</strong>
            <span>拖动图标或组件，点选后可缩放、换屏。</span>
        </div>
        <div class="desktop-widget-tray">
            <button type="button" class="desktop-widget-library-open" onclick="openDesktopWidgetLibrary()"><i class="ri-shapes-line"></i><span>组件</span></button>
            <button type="button" onclick="addDesktopScreen()"><i class="ri-layout-row-line"></i><span>加屏</span></button>
            <button type="button" onclick="deleteEmptyDesktopScreen()"><i class="ri-delete-bin-6-line"></i><span>删空屏</span></button>
        </div>
        <div class="desktop-edit-actions">
            <button type="button" class="restore" onclick="promptRestoreDefaultDesktopLayout()">恢复原始</button>
            <button type="button" onclick="exitEditMode(false)">取消</button>
            <button type="button" class="primary" onclick="promptSaveDesktopLayout()">保存布局</button>
        </div>
    `;
    home.appendChild(toolbar);
}

function handleDesktopEditSwipeZonePointerDown(e) {
    if (!window._editMode || !window._desktopPageSwipeState) return;
    e.stopPropagation();
    window._desktopPageSwipeState.begin(e, e);
    const move = ev => {
        ev.stopPropagation();
        window._desktopPageSwipeState.move(ev, ev);
    };
    const up = ev => {
        ev.stopPropagation();
        window._desktopPageSwipeState.end();
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
}

function handleDesktopEditSwipeZoneTouchStart(e) {
    if (!window._editMode || !window._desktopPageSwipeState || !e.touches?.[0]) return;
    e.stopPropagation();
    window._desktopPageSwipeState.begin(e, e.touches[0]);
}

function handleDesktopEditSwipeZoneTouchMove(e) {
    if (!window._editMode || !window._desktopPageSwipeState || !e.touches?.[0]) return;
    e.stopPropagation();
    window._desktopPageSwipeState.move(e, e.touches[0]);
}

function handleDesktopEditSwipeZoneTouchEnd(e) {
    if (!window._editMode || !window._desktopPageSwipeState) return;
    e.stopPropagation();
    window._desktopPageSwipeState.end();
}

function enterEditMode() {
    if (window._editMode) return;
    const pages = document.getElementById('pages-container');
    const home = document.getElementById('home-screen');
    if (!pages || !home) return;
    window._editMode = true;
    _desktopLayoutBackupHtml = pages.innerHTML;
    const dock = document.querySelector('#home-screen .dock-bar');
    _desktopDockBackupHtml = dock ? dock.innerHTML : '';
    _desktopDefaultPrincessDeletedBackup = localStorage.getItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY);
    _desktopDefaultLovelyDeletedBackup = localStorage.getItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY);
    _desktopStickyNotesBackup = localStorage.getItem(DESKTOP_STICKY_NOTES_KEY);
    _desktopLovelyPrefsBackup = localStorage.getItem(DESKTOP_LOVELY_WIDGET_PREFS_KEY);
    materializeExistingDesktopForLayout();
    document.querySelectorAll('.desktop-layout-item').forEach(setupDesktopLayoutItem);
    setupDesktopDockEditing();
    repairDesktopLayoutOverlaps();
    home.classList.add('desktop-editing');
    renderDesktopEditChrome();
    if (navigator.vibrate) navigator.vibrate(20);
}

function startDesktopEditLongPress(e) {
    const home = document.getElementById('home-screen');
    if (!home || window._editMode) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    if (e.target.closest('.app-window, .folder-overlay, .desktop-edit-toolbar, .desktop-widget-library, .desktop-save-modal')) return;
    if (!e.target.closest('.desktop-scroll-area, .desktop-layout-item, .desktop-custom-widget, .app-item, .photo-large, .calendar-widget, .desktop-page, .dock-bar, .dock-item')) return;

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

function shouldSuppressDesktopNativeLongPress(target) {
    if (!target || !target.closest) return false;
    if (!target.closest('#home-screen')) return false;
    if (target.closest('input, textarea, select, [contenteditable="true"], .lcw-input, .pw-note')) return false;
    return !!target.closest([
        '.pages-container',
        '.desktop-page',
        '.desktop-scroll-area',
        '.app-item',
        '.app-icon',
        '.dock-bar',
        '.dock-item',
        '.desktop-layout-item',
        '.desktop-custom-widget',
        '.photo-large',
        '.calendar-widget',
        '.desktop-edit-swipe-zone',
        '.page-dots'
    ].join(','));
}

function suppressDesktopNativeLongPress(e) {
    if (!shouldSuppressDesktopNativeLongPress(e.target)) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
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
    syncDesktopStickyNotesFromDom();
    const dockAppIds = new Set(collectDesktopDockLayout().map(appId => `app-${appId}`));
    return Array.from(document.querySelectorAll('.desktop-layout-item')).filter(item => (
        !isDesktopStaticPage2AppLayoutId(item.dataset.layoutId)
        && !dockAppIds.has(item.dataset.layoutId)
    )).map(item => {
        const page = item.closest('.desktop-page');
        const area = item.closest('.desktop-scroll-area');
        const rect = clampDesktopLayoutRect({
            left: parseFloat(item.style.left) || 0,
            top: parseFloat(item.style.top) || 0,
            width: item.offsetWidth,
            height: item.offsetHeight
        }, area);
        return {
            id: item.dataset.layoutId,
            type: item.dataset.layoutType || 'builtin',
            kind: item.dataset.widgetKind || '',
            page: getDesktopPageIndex(page),
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    });
}

function saveDesktopLayout() {
    syncDesktopStickyNotesFromDom();
    localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify({
        items: collectDesktopLayout(),
        dock: collectDesktopDockLayout(),
        deletedBuiltins: collectDesktopDeletedBuiltinIds(),
        pageCount: getDesktopPages().length,
        savedAt: Date.now()
    }));
    exitEditMode(true);
}

function restoreDefaultDesktopLayout() {
    localStorage.removeItem(DESKTOP_LAYOUT_KEY);
    localStorage.removeItem(DESKTOP_FOLDER_STORAGE_KEY);
    localStorage.removeItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY);
    localStorage.removeItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY);
    window._folders = [];
    _desktopLayoutApplied = false;
    document.getElementById('desktop-save-modal')?.remove();
    const pages = document.getElementById('pages-container');
    const template = _desktopDefaultLayoutHtml || _desktopLayoutBackupHtml;
    if (pages && template) {
        if (typeof pages._pageSwipeCleanup === 'function') pages._pageSwipeCleanup();
        const newPages = pages.cloneNode(false);
        newPages.innerHTML = template;
        pages.replaceWith(newPages);
    }
    const dock = document.querySelector('#home-screen .dock-bar');
    if (dock && _desktopDefaultDockHtml) dock.innerHTML = _desktopDefaultDockHtml;
    window._editMode = false;
    window._desktopSelectedLayoutItem = null;
    window._desktopCurrentPage = 0;
    window._desktopPageSwipeState = null;
    window._desktopDraggingItem = null;
    window._desktopDockDraggingItem = null;
    document.getElementById('home-screen')?.classList.remove('desktop-editing');
    clearDesktopEditChrome();
    if (typeof clearDesktopPageSlotRects === 'function') clearDesktopPageSlotRects();
    setTimeout(() => {
        if (typeof syncDesktopPagesAndDots === 'function') syncDesktopPagesAndDots(0);
        if (typeof initFolderDrag === 'function') initFolderDrag();
        if (typeof ensureMonitorDesktopEntry === 'function') ensureMonitorDesktopEntry();
        if (typeof ensureDesktopLovelyWidget === 'function') ensureDesktopLovelyWidget();
        if (typeof restoreDesktopRuntimeAfterEdit === 'function') restoreDesktopRuntimeAfterEdit();
        if (typeof resetDesktopToFirstPage === 'function') resetDesktopToFirstPage();
    }, 0);
}

function clearDesktopEditChrome() {
    document.getElementById('desktop-edit-toolbar')?.remove();
    document.getElementById('desktop-widget-library')?.remove();
    document.getElementById('desktop-edit-swipe-zone')?.remove();
    document.getElementById('desktop-save-modal')?.remove();
    document.querySelectorAll('.desktop-resize-handle, .desktop-item-center, .desktop-item-move-page, .desktop-item-delete').forEach(el => el.remove());
    document.querySelectorAll('.desktop-snap-guides').forEach(el => el.remove());
    document.querySelectorAll('.desktop-layout-item.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.dock-item.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.desktop-layout-dragging, .desktop-slot-dragging, .desktop-dock-drop-ready').forEach(el => el.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready'));
    document.querySelectorAll('.dock-drag-ghost').forEach(el => el.remove());
}

function resetDesktopInteractionStateAfterEdit() {
    clearTimeout(_editLongPressTimer);
    _desktopLongPressActive = false;
    _desktopLongPressTriggered = false;
    _desktopLongPressStart = null;
    window._desktopDraggingItem = null;
    window._desktopDockDraggingItem = null;
    document.querySelectorAll('[data-desktop-drag-moved]').forEach(item => {
        delete item.dataset.desktopDragMoved;
    });
    document.querySelectorAll('#pages-container .desktop-layout-item').forEach(item => {
        item.classList.remove('desktop-layout-dragging', 'desktop-slot-dragging', 'desktop-dock-drop-ready', 'desktop-layout-resizing');
    });
}

function restoreDesktopRuntimeAfterEdit() {
    if (typeof initPageSwipe === 'function') initPageSwipe({ force: true });
    const pages = typeof getDesktopPages === 'function' ? getDesktopPages() : [];
    const maxPage = Math.max(0, pages.length - 1);
    const currentPage = Math.max(0, Math.min(maxPage, Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0));
    window._desktopCurrentPage = currentPage;
    if (typeof window.goToDesktopPage === 'function') {
        window.goToDesktopPage(currentPage);
    } else {
        syncDesktopPagesAndDots(currentPage);
    }
    document.querySelectorAll('#pages-container .desktop-layout-item').forEach(item => setupDesktopLayoutItem(item));
    setupDesktopDockEditing();
    resetDesktopInteractionStateAfterEdit();
}

function normalizeDesktopSavedLayoutItems(items, dockItems = []) {
    if (!Array.isArray(items)) return [];
    const dockAppIds = new Set((Array.isArray(dockItems) ? dockItems : []).map(appId => String(appId || '')).filter(Boolean));
    const seen = new Set();
    const normalized = [];
    for (let i = items.length - 1; i >= 0; i -= 1) {
        const record = items[i];
        if (!record || typeof record !== 'object') continue;
        const id = String(record.id || '').trim();
        if (!id || seen.has(id) || isDesktopStaticPage2AppLayoutId(id)) continue;
        if (id.startsWith('app-') && dockAppIds.has(id.slice(4))) continue;
        const type = String(record.type || (id.startsWith('app-') ? 'app' : 'builtin'));
        const kind = String(record.kind || '');
        if (type === 'custom' && !DESKTOP_CUSTOM_WIDGET_KINDS.has(kind)) continue;
        if (type === 'custom' && id === DESKTOP_DEFAULT_PRINCESS_ID) continue;
        const page = Number(record.page);
        seen.add(id);
        normalized.unshift({
            ...record,
            id,
            type,
            kind,
            page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 0
        });
    }
    return normalized;
}

function hasDesktopMeasurableLayoutCanvas() {
    return Array.from(document.querySelectorAll('#pages-container .desktop-scroll-area.layout-canvas'))
        .some(hasDesktopUsableLayoutBounds);
}

function persistDesktopLayoutRepair(existing = null) {
    let saved = existing;
    if (!saved) {
        try {
            saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}') || {};
        } catch (e) {
            saved = {};
        }
    }
    const hadSavedLayout = Array.isArray(saved.items) || Array.isArray(saved.dock) || Array.isArray(saved.deletedBuiltins);
    if (!hadSavedLayout) return false;
    try {
        const now = Date.now();
        localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify({
            ...saved,
            items: collectDesktopLayout(),
            dock: collectDesktopDockLayout(),
            deletedBuiltins: collectDesktopDeletedBuiltinIds(),
            pageCount: getDesktopPages().length,
            savedAt: saved.savedAt || now,
            repairedAt: now
        }));
        _desktopLayoutNeedsVisiblePersist = false;
        return true;
    } catch (e) {
        console.warn('desktop layout repair persist failed:', e);
        return false;
    }
}

function clampDesktopVisibleLayoutItems() {
    let changed = false;
    document.querySelectorAll('#pages-container .desktop-scroll-area.layout-canvas').forEach(pageArea => {
        if (!hasDesktopUsableLayoutBounds(pageArea)) return;
        pageArea.querySelectorAll(':scope > .desktop-layout-item').forEach(item => {
            const safeRect = clampDesktopLayoutRect(getDesktopRawStyleRect(item), pageArea);
            if (setDesktopLayoutItemRect(item, safeRect)) changed = true;
        });
    });
    return changed;
}

function repairDesktopLayoutForVisibleViewport(options = {}) {
    const home = document.getElementById('home-screen');
    if (home?.classList.contains('hidden') || window._editMode) return false;
    let changed = false;
    if (clampDesktopVisibleLayoutItems()) changed = true;
    if (repairDesktopLayoutOverlaps()) changed = true;
    if ((changed || _desktopLayoutNeedsVisiblePersist) && options.persist !== false) {
        persistDesktopLayoutRepair(options.saved || null);
    }
    return changed;
}

function scheduleDesktopVisibleLayoutRepair(options = {}) {
    if (window._desktopVisibleLayoutRepairPending) return;
    window._desktopVisibleLayoutRepairPending = true;
    const run = () => {
        window._desktopVisibleLayoutRepairPending = false;
        repairDesktopLayoutForVisibleViewport({ persist: true, ...options });
    };
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(run));
    } else {
        setTimeout(run, 0);
    }
}

function exitEditMode(saveChanges) {
    if (!window._editMode) return;
    window._editMode = false;
    document.getElementById('home-screen')?.classList.remove('desktop-editing');
    clearDesktopEditChrome();
    resetDesktopInteractionStateAfterEdit();
    window._desktopSelectedLayoutItem = null;
    if (!saveChanges && _desktopLayoutBackupHtml) {
        if (_desktopDefaultPrincessDeletedBackup == null) {
            localStorage.removeItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY);
        } else {
            localStorage.setItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY, _desktopDefaultPrincessDeletedBackup);
        }
        if (_desktopStickyNotesBackup == null) {
            localStorage.removeItem(DESKTOP_STICKY_NOTES_KEY);
        } else {
            localStorage.setItem(DESKTOP_STICKY_NOTES_KEY, _desktopStickyNotesBackup);
        }
        if (_desktopDefaultLovelyDeletedBackup == null) {
            localStorage.removeItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY);
        } else {
            localStorage.setItem(DESKTOP_DEFAULT_LOVELY_DELETED_KEY, _desktopDefaultLovelyDeletedBackup);
        }
        if (_desktopLovelyPrefsBackup == null) {
            localStorage.removeItem(DESKTOP_LOVELY_WIDGET_PREFS_KEY);
        } else {
            localStorage.setItem(DESKTOP_LOVELY_WIDGET_PREFS_KEY, _desktopLovelyPrefsBackup);
        }
        const oldPages = document.getElementById('pages-container');
        const newPages = oldPages.cloneNode(false);
        newPages.innerHTML = _desktopLayoutBackupHtml;
        oldPages.replaceWith(newPages);
        const dock = document.querySelector('#home-screen .dock-bar');
        if (dock) dock.innerHTML = _desktopDockBackupHtml || _desktopDefaultDockHtml || dock.innerHTML;
        _desktopLayoutApplied = false;
        setTimeout(() => {
            initFolderDrag();
            restoreDesktopRuntimeAfterEdit();
        }, 0);
    } else {
        setTimeout(restoreDesktopRuntimeAfterEdit, 0);
    }
    clearDesktopPageSlotRects();
    _desktopDefaultPrincessDeletedBackup = null;
    _desktopDefaultLovelyDeletedBackup = null;
    _desktopStickyNotesBackup = null;
    _desktopLovelyPrefsBackup = null;
    _desktopDockBackupHtml = '';
}

function applySavedDesktopLayout() {
    if (_desktopLayoutApplied) return;
    let saved;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}');
    } catch (e) {
        return;
    }
    if (Array.isArray(saved.dock)) applyDesktopDockLayout(saved.dock);
    const deletedBuiltins = Array.isArray(saved.deletedBuiltins)
        ? saved.deletedBuiltins.filter(id => DESKTOP_DELETABLE_BUILTIN_IDS.has(String(id || '')))
        : [];
    if ((!Array.isArray(saved.items) || !saved.items.length) && !deletedBuiltins.length) {
        _desktopLayoutApplied = false;
        return;
    }
    _desktopLayoutApplied = true;
    const rawSavedItems = Array.isArray(saved.items) ? saved.items : [];
    const savedItems = normalizeDesktopSavedLayoutItems(rawSavedItems, saved.dock);
    const savedItemsSanitized = savedItems.length !== rawSavedItems.length
        || savedItems.some((item, index) => item.id !== String(rawSavedItems[index]?.id || '').trim());
    const pageCount = Math.max(saved.pageCount || 0, ...savedItems.map(item => (item.page || 0) + 1), 1);
    for (let i = 0; i < pageCount; i += 1) ensureDesktopPage(i);
    const pages = getDesktopPages();
    pages.forEach(page => page.querySelector('.desktop-scroll-area')?.classList.add('layout-canvas'));
    deletedBuiltins.forEach(removeDesktopBuiltinElementById);
    savedItems.forEach(record => {
        if (isDesktopStaticPage2AppLayoutId(record && record.id)) return;
        if (record && String(record.id || '').startsWith('app-') && Array.isArray(saved.dock) && saved.dock.includes(String(record.id).slice(4))) return;
        if (record.type === 'custom' && !DESKTOP_CUSTOM_WIDGET_KINDS.has(record.kind)) return;
        if (record.type === 'custom' && record.id === DESKTOP_DEFAULT_PRINCESS_ID) return;
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
    pages.forEach(page => {
        page.querySelectorAll(':scope > .desktop-scroll-area > .calendar-widget:not(.desktop-layout-item), :scope > .desktop-scroll-area > .photo-large:not(.desktop-layout-item)').forEach(el => {
            el.classList.add('layout-source-hidden');
        });
        page.querySelectorAll(':scope > .desktop-scroll-area > .app-item:not(.desktop-layout-item)').forEach(el => {
            el.classList.add('layout-source-hidden');
        });
        page.querySelectorAll(':scope > .desktop-scroll-area > .page2-app-grid').forEach(el => {
            el.classList.add('layout-source-hidden');
        });
    });
    const repaired = repairDesktopLayoutOverlaps();
    if (savedItemsSanitized || repaired) {
        if (hasDesktopMeasurableLayoutCanvas()) {
            persistDesktopLayoutRepair(saved);
        } else {
            _desktopLayoutNeedsVisiblePersist = true;
        }
    }
    updateDesktopStatusWidgets();
}

function migrateDesktopDefaultPrincessWidget() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}');
    } catch (e) {
        saved = null;
    }
    if (saved && Array.isArray(saved.items) && saved.items.some(item => item && item.id === DESKTOP_DEFAULT_PRINCESS_ID)) {
        saved.items = saved.items.filter(item => item && item.id !== DESKTOP_DEFAULT_PRINCESS_ID);
        localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(saved));
    }
    const notes = getDesktopStickyNotes();
    if (Object.prototype.hasOwnProperty.call(notes, DESKTOP_DEFAULT_PRINCESS_ID)) {
        delete notes[DESKTOP_DEFAULT_PRINCESS_ID];
        localStorage.setItem(DESKTOP_STICKY_NOTES_KEY, JSON.stringify(notes));
    }
    localStorage.removeItem(DESKTOP_DEFAULT_PRINCESS_DELETED_KEY);
}

function migrateDesktopDefaultLovelyWidget() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}');
    } catch (e) {
        saved = null;
    }
    if (!saved || !Array.isArray(saved.items)) return;
    let changed = false;
    saved.items.forEach(item => {
        if (!item || item.id !== DESKTOP_DEFAULT_LOVELY_ID) return;
        const top = Number(item.top);
        const isLegacyTop = Number.isFinite(top) && top <= DESKTOP_DEFAULT_LOVELY_LEGACY_TOP + 24;
        const isPreviousDefaultTop = Number.isFinite(top) && Math.abs(top - DESKTOP_DEFAULT_LOVELY_OLD_TOP) <= 24;
        if (isLegacyTop || isPreviousDefaultTop) {
            item.top = DESKTOP_DEFAULT_LOVELY_TOP;
            changed = true;
        }
        const height = Number(item.height);
        const defaultHeight = getDesktopCustomWidgetSize('lovely').height;
        if (!Number.isFinite(height) || height < defaultHeight || height > defaultHeight * 1.35 || height === 264 || height === 304) {
            item.height = defaultHeight;
            changed = true;
        }
        const width = Number(item.width);
        const defaultWidth = getDesktopCustomWidgetSize('lovely').width;
        if (!Number.isFinite(width) || width < 260 || width > defaultWidth * 1.25) {
            item.width = defaultWidth;
            changed = true;
        }
    });
    if (changed) localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(saved));
}

function migrateDesktopStoryAppsToIcons() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || '{}');
    } catch (e) {
        saved = null;
    }
    if (!saved || !Array.isArray(saved.items)) return;
    const before = saved.items.length;
    saved.items = saved.items.filter(item => !isDesktopStaticPage2AppLayoutId(item && item.id));
    const changed = saved.items.length !== before;
    if (changed) localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(saved));
}

function ensureMonitorDesktopEntry() {
    const page = ensureDesktopPage(1);
    const area = page?.querySelector('.desktop-scroll-area');
    if (!area) return;
    if (area.classList.contains('layout-canvas') || area.querySelector(':scope > .desktop-layout-item')) {
        area.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
        return;
    }

    let grid = area.querySelector(':scope > .page2-app-grid');
    if (!grid) {
        grid = document.createElement('div');
        grid.className = 'page2-app-grid';
        area.insertBefore(grid, area.firstChild);
    }

    ['dream', 'monitor', 'outing', 'coread', 'album'].forEach(appId => {
        if (grid.querySelector(`:scope > .app-item[data-app-id="${appId}"]`)) return;
        const app = DESKTOP_APPS.find(item => item.id === appId);
        if (!app) return;
        const item = createDesktopAppElement(app);
        item.classList.remove('desktop-layout-item', 'layout-app', 'selected');
        item.removeAttribute('style');
        grid.appendChild(item);
    });
    area.querySelector('.desktop-empty-placeholder')?.classList.add('layout-source-hidden');
}

function startDesktopLayoutFromTheme() {
    if (typeof closeApp === 'function') closeApp('theme');
    setTimeout(() => {
        if (typeof unlockPhone === 'function') unlockPhone();
        if (!_desktopLayoutApplied) applySavedDesktopLayout();
        enterEditMode();
    }, 360);
}

function initEditMode() {
    const home = document.getElementById('home-screen');
    if (!home || home.dataset.editInit === '1') return;
    const pages = document.getElementById('pages-container');
    if (pages && !_desktopDefaultLayoutHtml) _desktopDefaultLayoutHtml = pages.innerHTML;
    const dock = document.querySelector('#home-screen .dock-bar');
    if (dock && !_desktopDefaultDockHtml) _desktopDefaultDockHtml = dock.innerHTML;
    home.dataset.editInit = '1';
    ['contextmenu', 'dragstart', 'selectstart'].forEach(type => {
        home.addEventListener(type, suppressDesktopNativeLongPress, true);
    });
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
        if (e.target.closest('.desktop-edit-toolbar, .desktop-widget-library, .desktop-save-modal')) {
            _desktopLongPressTriggered = false;
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        _desktopLongPressTriggered = false;
    }, true);
    setTimeout(() => {
        migrateDesktopDefaultPrincessWidget();
        migrateDesktopDefaultLovelyWidget();
        migrateDesktopStoryAppsToIcons();
        applySavedDesktopLayout();
        ensureMonitorDesktopEntry();
        ensureDesktopLovelyWidget();
        setupDesktopDockEditing();
        syncDesktopPagesAndDots(Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0);
        scheduleDesktopVisibleLayoutRepair();
    }, 50);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditMode);
} else {
    initEditMode();
}
