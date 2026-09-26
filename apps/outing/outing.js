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

