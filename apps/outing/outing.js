// --- BYND Outing / 一起出门 ---
// Durable trips, live GPS and chat delivery.
const OUTING_STATE_KEY = 'bynd_outing_date_state_v1';
const OUTING_WAKE_DISTANCE_M = 500;
const OUTING_WAKE_COOLDOWN_MS = 30000;
let outingWatchId = null;
let outingWakeBusy = false;
let outingStatus = '';
let outingDeliveryQueue = Promise.resolve();
function outingEscape(text) { return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function outingId() { return `outing_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }
function getOutingCharacters() { return (window.myCharacters || []).filter(c => c?.id && !c.isGroupChat && !c.isGroupNpc && !c.groupNpc); }
function getOutingCharName(char) { return typeof getWechatCharDisplayName === 'function' ? getWechatCharDisplayName(char) : char?.name || '未命名'; }
function getOutingState() {
    const raw = localStorage.getItem(OUTING_STATE_KEY);
    if (!raw) return { trail: [], trips: [] };
    try {
        const state = JSON.parse(raw);
        if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('invalid');
        return { ...state, trail: Array.isArray(state.trail) ? state.trail : [], trips: Array.isArray(state.trips) ? state.trips : [] };
    } catch (_) { throw new Error('出门记录无法读取，请先导出备份，避免覆盖原记录。'); }
}
function saveOutingState(state) { localStorage.setItem(OUTING_STATE_KEY, JSON.stringify({ ...state, trail: (state.trail || []).slice(-120) })); }
function getOutingSelectedChar() {
    const state = getOutingState();
    const id = state.active && state.journey ? state.journey.charId : document.getElementById('outing-char-select')?.value || state.charId;
    return getOutingCharacters().find(c => c.id === id) || (!state.active ? getOutingCharacters()[0] : null);
}
function setOutingStatus(text, tone = '') {
    outingStatus = text || '';
    const el = document.getElementById('outing-location-text');
    if (el) { el.textContent = outingStatus; el.dataset.tone = tone; }
    if (!tone) { const error = document.getElementById('outing-error'); if (error) error.hidden = true; }
}
function outingFail(error) {
    const text = error?.message || String(error); setOutingStatus(text, 'error');
    const el = document.getElementById('outing-error'); if (el) { el.textContent = text; el.hidden = false; }
    return false;
}
function formatOutingTime(ts = Date.now()) { return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }); }
function formatOutingPoint(p) { return p ? `${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}` : '未定位'; }
function getOutingDistanceMeters(a, b) {
    if (!a || !b) return 0;
    const rad = n => Number(n) * Math.PI / 180;
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
// Await durable storage before claiming delivery. IDs make retries idempotent.
function appendOutingMessageToChar(char, msg, options = {}) {
    const work = outingDeliveryQueue.catch(() => {}).then(async () => {
        if (!char || typeof saveCharactersToStorage !== 'function') throw new Error('角色不可用，记录已保留，稍后可重试发送。');
        char.history ||= [];
        const id = msg.outingMessageId || outingId();
        let row = char.history.find(m => m.outingMessageId === id);
        const existed = !!row;
        if (!row) {
            row = { ...msg, outingMessageId: id, isMe: options.isMe !== false, timestamp: new Date().toISOString() };
            if (typeof syncWechatMessageDescription === 'function') syncWechatMessageDescription(row);
            char.history.push(row);
        }
        try { if (await saveCharactersToStorage() === false) throw new Error('聊天保存失败，记录已保留，请重试发送。'); }
        catch (error) { if (!existed) { const index = char.history.indexOf(row); if (index >= 0) char.history.splice(index, 1); } throw error; }
        if (typeof renderChatList === 'function') renderChatList();
        if (window.currentChatCharId === char.id && typeof refreshChatView === 'function') refreshChatView(char);
        if (!existed && options.autoReply && typeof queueWechatAutoReplyToChar === 'function') queueWechatAutoReplyToChar(char.id, 0, { background: window.currentChatCharId !== char.id });
        return true;
    });
    outingDeliveryQueue = work; return work;
}
function buildOutingLocationMessage(point, distanceText, reason) {
    return ['【一起出门】', reason || '更新了真实 GPS 位置。', `当前位置：${formatOutingPoint(point)}`, distanceText ? `移动距离：${distanceText}` : '', '附近地点会在查询成功后同步；不要把推测当作到访事实。'].filter(Boolean).join('\n');
}
async function wakeOutingChar(point, distance, reason = '') {
    if (outingWakeBusy) return;
    const state = getOutingState(), tripId = state.journey?.id, char = getOutingSelectedChar();
    if (!char || !state.active) return;
    outingWakeBusy = true;
    try {
        await appendOutingMessageToChar(char, { type: 'text', content: buildOutingLocationMessage(point, distance ? `${Math.round(distance)}米` : '', reason), outingMessageId: `${tripId}_gps_${point.ts}` }, { autoReply: true });
        const fresh = getOutingState(); if (!fresh.active || fresh.journey?.id !== tripId) return;
        fresh.lastWakePoint = point; fresh.lastWakeAt = Date.now(); fresh.wakeCount = Number(fresh.wakeCount || 0) + 1;
        saveOutingState(fresh); renderOutingApp();
    } catch (error) { outingFail(error); } finally { outingWakeBusy = false; }
}
function handleOutingPosition(pos, options = {}) {
    try {
        const point = { lat: pos?.coords?.latitude, lng: pos?.coords?.longitude, accuracy: pos?.coords?.accuracy, ts: Date.now() };
        if (!isOutingPoint(point)) throw new Error('定位返回了无效坐标，请重试。');
        const state = getOutingState(); state.currentPoint = point;
        if (state.active && state.journey) {
            const points = state.journey.points ||= [], previous = points[points.length - 1];
            if (!previous || getOutingDistanceMeters(previous, point) >= 30) points.push(point);
        }
        saveOutingState(state); setOutingStatus(`已定位 · 精度约 ${Math.round(point.accuracy || 0)}m`);
        renderOutingApp(); loadOutingNearby(options.manual === true);
        const distance = getOutingDistanceMeters(state.lastWakePoint, point);
        if (state.active && (!state.lastWakePoint || distance >= OUTING_WAKE_DISTANCE_M) && (!state.lastWakeAt || Date.now() - state.lastWakeAt >= OUTING_WAKE_COOLDOWN_MS)) wakeOutingChar(point, distance, !state.lastWakePoint ? '我们出发啦，这是现在的真实位置。' : '我们走到了新的位置。');
    } catch (error) { outingFail(error); }
}
function handleOutingLocationError(err) { outingFail(new Error(`定位失败：${err?.message || '请允许位置权限后重试；仍可手动记录旅程。'}`)); }
function startOutingWatcher() {
    if (outingWatchId != null) return;
    if (!navigator.geolocation) return handleOutingLocationError({ message: '当前设备不支持定位。' });
    outingWatchId = navigator.geolocation.watchPosition(pos => handleOutingPosition(pos), handleOutingLocationError, { enableHighAccuracy: true, maximumAge: 12000, timeout: 22000 });
}
function stopOutingWatcher() { if (outingWatchId != null) navigator.geolocation?.clearWatch(outingWatchId); outingWatchId = null; }
function refreshOutingLocation() {
    if (!navigator.geolocation) return handleOutingLocationError({ message: '当前设备不支持定位。' });
    setOutingStatus('正在确认你的位置…', 'busy');
    navigator.geolocation.getCurrentPosition(pos => handleOutingPosition(pos, { manual: true }), handleOutingLocationError, { enableHighAccuracy: true, maximumAge: 0, timeout: 22000 });
}
function renderOutingApp() {
    const state = getOutingState(), char = getOutingSelectedChar(), active = !!state.active;
    const button = document.getElementById('outing-toggle-btn'); if (!button) return;
    button.innerHTML = active ? '<i class="ri-mail-open-line"></i><span>结束旅程</span>' : '<i class="ri-footprint-line"></i><span>出发</span>';
    button.classList.toggle('active', active);
    document.getElementById('outing-active-name').textContent = char ? `${getOutingCharName(char)} · ${active ? '和你在路上' : '一起走走吧'}` : '选择出门对象';
    document.getElementById('outing-destination-btn').innerHTML = `<i class="ri-map-pin-2-line"></i><span>${outingEscape(state.journey && active ? state.journey.destination || '随心走走 · 可选目的地' : state.destination || '随心走走 · 可选目的地')}</span><i class="ri-edit-line"></i>`;
    document.getElementById('outing-char-trigger').disabled = active || !getOutingCharacters().length;
    if (!outingStatus) setOutingStatus(state.currentPoint ? `已定位 · ${formatOutingPoint(state.currentPoint)}` : '确认定位，发现附近的吃喝玩乐');
    document.getElementById('outing-mode-label').textContent = active ? 'ON OUR WAY' : 'A LITTLE DAY OUT';
    renderOutingNearby(); renderOutingJournal(); renderOutingMap();
}
function initOutingApp() { try { migrateOutingJourney(); renderOutingCharacters(); renderOutingApp(); if (getOutingState().active) startOutingWatcher(); } catch (error) { outingFail(error); } }
function initOutingAppRuntime() { try { migrateOutingJourney(); if (getOutingState().active) setTimeout(startOutingWatcher, 800); } catch (error) { outingFail(error); } }
async function toggleOutingDateMode() {
    try {
        const state = getOutingState(); if (state.active) return finishOutingJourney();
        const char = getOutingSelectedChar(); if (!char) throw new Error('先选择一个角色一起出门。');
        state.charId = char.id; state.active = true; state.lastWakePoint = null; state.lastWakeAt = 0; state.wakeCount = 0;
        state.journey = { id: outingId(), charId: char.id, charName: getOutingCharName(char), avatar: char.avatar || '', startedAt: Date.now(), destination: state.destination || '', entries: [], points: [] };
        saveOutingState(state); outingViewedTripId = ''; outingJournalView = 'today';
        renderOutingApp(); playOutingDeparture(char); startOutingWatcher(); refreshOutingLocation();
        if (state.nearby && isOutingPoint(state.currentPoint) && Date.now() - state.currentPoint.ts < 60000) syncOutingNearbyToChar(state.journey.id).catch(outingFail);
    } catch (error) { outingFail(error); }
}
function captureOutingPhoto() {
    try { if (!getOutingState().active) throw new Error('先点击出发，再为这次旅程拍照。'); document.getElementById('outing-camera-input')?.click(); } catch (error) { outingFail(error); }
}
function readOutingImageFile(file, maxWidth = 960, quality = 0.74) {
    return new Promise((resolve, reject) => {
        if (!/^image\//.test(file.type) || file.size > 25 * 1024 * 1024) return reject(new Error('请选择 25MB 以内的图片。'));
        const reader = new FileReader(); reader.onerror = () => reject(new Error('照片读取失败，请重试。'));
        reader.onload = () => {
            const image = new Image(); image.onerror = () => reject(new Error('图片无法解码，请选择 JPG、PNG 或 WebP。'));
            image.onload = () => {
                try {
                    const scale = Math.min(1, maxWidth / Math.max(image.width, image.height));
                    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
                    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('照片处理失败');
                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (error) { reject(error); }
            }; image.src = reader.result;
        }; reader.readAsDataURL(file);
    });
}
async function handleOutingPhotoInput(input) {
    const file = input?.files?.[0]; if (!file) return;
    const tripId = getOutingState().journey?.id;
    try {
        const image = await readOutingImageFile(file), state = getOutingState();
        if (!state.active || state.journey?.id !== tripId) throw new Error('旅程已结束，请重新开始后再拍照。');
        const entry = { id: outingId(), kind: 'photo', text: '路上的一张照片', image, createdAt: Date.now(), point: state.currentPoint || null };
        state.journey.entries.push(entry); saveOutingState(state); renderOutingApp(); await syncOutingEntry(tripId, entry.id);
    } catch (error) { outingFail(error); } finally { if (input) input.value = ''; }
}
Object.assign(window, { initOutingApp, initOutingAppRuntime, toggleOutingDateMode, refreshOutingLocation, captureOutingPhoto, handleOutingPhotoInput });

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
        if (getOutingState().active) return;
        try {
        const next = getOutingState();
        next.charId = select.value;
        next.lastWakePoint = null;
        next.wakeCount = 0;
        saveOutingState(next);
        renderOutingApp();
        } catch (error) { outingFail(error); }
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
    if (getOutingState().active) return;
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

