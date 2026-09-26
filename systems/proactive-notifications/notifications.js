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
    _byndServiceWorkerReady = navigator.serviceWorker.register('sw.js?v=1.1.698').then(() => {
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
    const icon = 'bynd-icon.png';
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

