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

