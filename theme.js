// --- 🎨 theme.js: 最终增强版 (全屏亮度检测 + 自动白字) ---

const THEME_ICON_TARGETS = [
    {i:'ri-wechat-line', n:'微信'}, {i:'ri-code-s-slash-line', n:'正则'},
    {i:'ri-book-read-line', n:'世界书'}, {i:'ri-settings-4-line', n:'设置'},
    {i:'ri-palette-line', n:'美化'}, {i:'ri-graduation-cap-line', n:'学习'},
    {i:'ri-money-cny-box-line', n:'记账'}, {i:'ri-gamepad-line', n:'Game'},
    {i:'ri-moon-cloudy-line', n:'盗梦空间'}, {i:'ri-eye-line', n:'监控'},
    {i:'ri-map-pin-user-line', n:'一起出门'},
    {i:'ri-book-open-line', n:'PageMate'}, {i:'ri-image-2-line', n:'相册'},
    {i:'ri-music-2-fill', n:'音乐'}, {i:'ri-camera-lens-line', n:'相机'},
    {i:'ri-equalizer-line', n:'预设'}
];
const THEME_DESKTOP_ICON_COUNT = 13;
const THEME_DOCK_ICON_START = THEME_DESKTOP_ICON_COUNT;
const THEME_LIBRARY_KEY = 'bynd_theme_library_v1';
const TAP_EFFECT_PRESETS = {
    none: {
        label: '关闭',
        symbol: '',
        particles: '',
        colorA: '#f7d9ff',
        colorB: '#8fd9ff',
        size: 112
    },
    moon: {
        label: '月辉',
        symbol: '☾',
        particles: '✦·',
        colorA: '#f8eaff',
        colorB: '#94d9ff',
        size: 112
    },
    star: {
        label: '星盘',
        symbol: '✦',
        particles: '✦✧·',
        colorA: '#fff2d2',
        colorB: '#d7b6ff',
        size: 118
    },
    feather: {
        label: '羽梦',
        symbol: '🪶',
        particles: '🪶✧·',
        colorA: '#ffd6ec',
        colorB: '#b9d7ff',
        size: 116
    },
    fruit: {
        label: '甜果',
        symbol: '♡',
        particles: '✦·',
        colorA: '#ffd09a',
        colorB: '#ff7f8f',
        size: 108
    },
    custom: {
        label: '自定义',
        symbol: '✦',
        particles: '✦·',
        colorA: '#f7d9ff',
        colorB: '#8fd9ff',
        size: 112
    }
};

// 1. 初始化图标网格
function initIconGrid() {
    const container = document.getElementById('icon-grid-container');
    if (!container) return;

    let htmlContent = '';
    THEME_ICON_TARGETS.forEach((item, index) => {
        htmlContent += `
            <div class="pretty-icon-item" onclick="document.getElementById('file-icon-${index}').click()">
                <div class="icon-preview" id="preview-icon-${index}">
                    <i class="${item.i}"></i>
                </div>
                <span class="icon-name">${item.n}</span>
                <input type="text" id="input-icon-${index}" style="display:none">
                <input type="file" id="file-icon-${index}" accept="image/*" style="display:none" onchange="convertFile(this, 'input-icon-${index}')">
            </div>
        `;
    });
    container.innerHTML = htmlContent;
}

function normalizeThemeIconList(icons) {
    if (!Array.isArray(icons)) return [];
    const normalized = new Array(THEME_ICON_TARGETS.length).fill('');
    if (icons.length >= THEME_ICON_TARGETS.length) {
        return icons.slice(0, THEME_ICON_TARGETS.length);
    }
    if (icons.length === 14) {
        for (let i = 0; i < 11; i++) normalized[i] = icons[i] || '';
        normalized[THEME_DOCK_ICON_START] = icons[11] || '';
        normalized[THEME_DOCK_ICON_START + 1] = icons[12] || '';
        normalized[THEME_DOCK_ICON_START + 2] = icons[13] || '';
        return normalized;
    }
    if (icons.length === 13) {
        for (let i = 0; i < 10; i++) normalized[i] = icons[i] || '';
        normalized[THEME_DOCK_ICON_START] = icons[10] || '';
        normalized[THEME_DOCK_ICON_START + 1] = icons[11] || '';
        normalized[THEME_DOCK_ICON_START + 2] = icons[12] || '';
        return normalized;
    }
    if (icons.length === THEME_ICON_TARGETS.length - 1) {
        for (let i = 0; i < 10; i++) normalized[i] = icons[i] || '';
        normalized[10] = '';
        normalized[THEME_DOCK_ICON_START] = icons[10] || '';
        normalized[THEME_DOCK_ICON_START + 1] = icons[11] || '';
        normalized[THEME_DOCK_ICON_START + 2] = icons[12] || '';
        return normalized;
    }
    if (icons.length === 12) {
        for (let i = 0; i < 8; i++) normalized[i] = icons[i] || '';
        normalized[THEME_DOCK_ICON_START] = icons[8] || '';
        normalized[THEME_DOCK_ICON_START + 1] = icons[10] || '';
        normalized[THEME_DOCK_ICON_START + 2] = icons[11] || '';
        return normalized;
    }
    if (icons.length === 11) {
        for (let i = 0; i < 8; i++) normalized[i] = icons[i] || '';
        normalized[THEME_DOCK_ICON_START] = icons[8] || '';
        normalized[THEME_DOCK_ICON_START + 1] = icons[9] || '';
        normalized[THEME_DOCK_ICON_START + 2] = icons[10] || '';
        return normalized;
    }
    for (let i = 0; i < Math.min(icons.length, THEME_ICON_TARGETS.length); i++) normalized[i] = icons[i] || '';
    return normalized;
}

function migrateThemeIconData(data) {
    if (!data || !Array.isArray(data.icons)) return [];
    const normalized = normalizeThemeIconList(data.icons);
    if (normalized.length !== data.icons.length) {
        data.icons = normalized;
        try {
            localStorage.setItem('my_theme_data', JSON.stringify(data));
        } catch (e) {}
    }
    return normalized;
}

function themeEscapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function normalizeThemeWidgetStyle(value) {
    return ['frost', 'midnight', 'aurora', 'paper'].includes(value) ? value : 'frost';
}

function normalizeThemeWidgetType(value) {
    return value === 'photo' ? 'photo' : 'photo';
}

function normalizeThemeAccent(value, fallback) {
    const text = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function normalizeTapEffectData(value) {
    const input = value && typeof value === 'object' ? value : {};
    const preset = TAP_EFFECT_PRESETS[input.preset] ? input.preset : 'moon';
    const base = TAP_EFFECT_PRESETS[preset] || TAP_EFFECT_PRESETS.moon;
    let rawSymbol = input.symbol;
    let rawParticles = input.particles;
    if (String(rawSymbol || '').trim() === '羽') rawSymbol = TAP_EFFECT_PRESETS.feather.symbol;
    if (preset === 'feather') {
        if (!rawSymbol) rawSymbol = base.symbol;
        if (!rawParticles || String(rawParticles).trim() === '✧·') rawParticles = base.particles;
    }
    const symbol = Array.from(String(rawSymbol || base.symbol || '').trim()).slice(0, 2).join('');
    const particles = Array.from(String(rawParticles || base.particles || '').trim()).slice(0, 10).join('');
    const size = Math.max(72, Math.min(150, Number(input.size || base.size || 112)));
    return {
        preset,
        symbol,
        particles,
        colorA: normalizeThemeAccent(input.colorA || base.colorA, base.colorA || '#f7d9ff'),
        colorB: normalizeThemeAccent(input.colorB || base.colorB, base.colorB || '#8fd9ff'),
        size
    };
}

function getSavedTapEffectData() {
    return normalizeTapEffectData(getSavedThemeData().tapEffect);
}

function renderTapEffectSettings(data) {
    data = normalizeTapEffectData(data || getSavedTapEffectData());
    const grid = document.getElementById('tapfx-preset-grid');
    if (grid) {
        grid.innerHTML = Object.entries(TAP_EFFECT_PRESETS).map(([id, item]) => {
            let preview = '<i class="ri-close-line"></i>';
            if (id !== 'none') {
                const iconClass = id === 'feather' ? ' tapfx-preset-feather' : '';
                const iconBody = id === 'feather' ? '<span class="tapfx-feather-mark"></span>' : themeEscapeHtml(item.symbol || '✦');
                preview = `<b class="tapfx-preset-icon${iconClass}" style="--a:${themeEscapeHtml(item.colorA)};--b:${themeEscapeHtml(item.colorB)}">${iconBody}</b>`;
            }
            return `
                <button type="button" data-preset="${themeEscapeHtml(id)}" class="${data.preset === id ? 'active' : ''}" onclick="selectTapEffectPreset('${themeEscapeHtml(id)}')">
                    ${preview}
                    <span>${themeEscapeHtml(item.label)}</span>
                </button>
            `;
        }).join('');
    }
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    };
    setValue('tapfx-symbol', data.symbol);
    setValue('tapfx-particles', data.particles);
    setValue('tapfx-color-a', data.colorA);
    setValue('tapfx-color-b', data.colorB);
    setValue('tapfx-size', data.size);
}

function setTapEffectPresetActive(preset) {
    const grid = document.getElementById('tapfx-preset-grid');
    if (!grid) return;
    grid.querySelectorAll('button[data-preset]').forEach(button => {
        button.classList.toggle('active', button.dataset.preset === preset);
    });
}

function collectTapEffectDataFromInputs(preset) {
    const saved = getSavedTapEffectData();
    const read = (id, fallback) => {
        const el = document.getElementById(id);
        return el ? el.value : fallback;
    };
    return normalizeTapEffectData({
        preset: preset || saved.preset || 'moon',
        symbol: read('tapfx-symbol', saved.symbol),
        particles: read('tapfx-particles', saved.particles),
        colorA: read('tapfx-color-a', saved.colorA),
        colorB: read('tapfx-color-b', saved.colorB),
        size: read('tapfx-size', saved.size)
    });
}

function saveTapEffectToThemeData(data, options = {}) {
    const saved = getSavedThemeData();
    const next = { ...saved, tapEffect: normalizeTapEffectData(data) };
    localStorage.setItem('my_theme_data', JSON.stringify(next));
    applyGlobalTapEffectSettings(next.tapEffect);
    if (!options.silent && typeof showWechatToast === 'function') showWechatToast('触碰特效已更新');
    return next.tapEffect;
}

function selectTapEffectPreset(preset) {
    const base = normalizeTapEffectData({ preset });
    renderTapEffectSettings(base);
    saveTapEffectToThemeData(base, { silent: true });
    if (preset !== 'none') previewTapEffectBurst();
}
window.selectTapEffectPreset = selectTapEffectPreset;

function previewTapEffectSettings() {
    const data = collectTapEffectDataFromInputs('custom');
    setTapEffectPresetActive(data.preset);
    saveTapEffectToThemeData(data, { silent: true });
}
window.previewTapEffectSettings = previewTapEffectSettings;

function previewTapEffectBurst() {
    const phone = document.querySelector('.phone-container') || document.body;
    const rect = phone.getBoundingClientRect();
    playGlobalTapEffect(rect.left + rect.width / 2, rect.top + Math.min(rect.height * 0.36, 280), { force: true });
}

let globalTapEffectState = null;
let globalTapEffectBound = false;
let globalTapEffectSettings = normalizeTapEffectData({});

function applyGlobalTapEffectSettings(data) {
    globalTapEffectSettings = normalizeTapEffectData(data);
    document.documentElement.dataset.tapEffect = globalTapEffectSettings.preset;
}
window.applyGlobalTapEffectSettings = applyGlobalTapEffectSettings;

function ensureGlobalTapEffectLayer() {
    const phone = document.querySelector('.phone-container') || document.body;
    let layer = Array.from(phone.children).find(el => el.classList && el.classList.contains('tapfx-layer'));
    if (!layer) {
        layer = document.createElement('div');
        layer.className = 'tapfx-layer';
        phone.appendChild(layer);
    }
    return layer;
}

function isGlobalTapEffectBlockedTarget(target) {
    return !!(target && target.closest && target.closest('.tapfx-layer, input, textarea, select, option, [contenteditable="true"], .wc-modal-overlay, .coread-reader-tools, .coread-settings-drawer, .coread-toc-drawer'));
}

function handleGlobalTapPointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    globalTapEffectState = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        target: event.target,
        time: Date.now()
    };
}

function handleGlobalTapPointerUp(event) {
    const state = globalTapEffectState;
    globalTapEffectState = null;
    if (!state || state.pointerId !== event.pointerId) return;
    if (globalTapEffectSettings.preset === 'none') return;
    if (isGlobalTapEffectBlockedTarget(state.target)) return;
    const moved = Math.abs(event.clientX - state.x) > 12 || Math.abs(event.clientY - state.y) > 12;
    if (moved || Date.now() - state.time > 1100) return;
    playGlobalTapEffect(event.clientX, event.clientY);
}

function makeTapEffectParticleText(index, settings) {
    const chars = Array.from(String(settings.particles || '✦·').trim() || '✦·');
    return chars[index % chars.length] || '·';
}

function playGlobalTapEffect(clientX, clientY, options = {}) {
    const settings = normalizeTapEffectData(globalTapEffectSettings);
    if (!options.force && settings.preset === 'none') return;
    const layer = ensureGlobalTapEffectLayer();
    const rect = layer.getBoundingClientRect();
    const burst = document.createElement('div');
    burst.className = `tapfx-burst tapfx-${settings.preset}`;
    burst.style.left = `${clientX - rect.left}px`;
    burst.style.top = `${clientY - rect.top}px`;
    burst.style.setProperty('--tapfx-size', `${settings.size}px`);
    burst.style.setProperty('--tapfx-a', settings.colorA);
    burst.style.setProperty('--tapfx-b', settings.colorB);
    const symbolHtml = settings.preset === 'feather'
        ? '<span class="tapfx-feather-core"></span>'
        : themeEscapeHtml(settings.symbol || '✦');
    burst.innerHTML = `
        <span class="tapfx-ring"></span>
        <span class="tapfx-orbit"></span>
        <span class="tapfx-symbol">${symbolHtml}</span>
        <span class="tapfx-wave wave-1"></span>
        <span class="tapfx-wave wave-2"></span>
    `;
    const particleCount = settings.preset === 'star' ? 18 : (settings.preset === 'feather' ? 16 : 14);
    for (let i = 0; i < particleCount; i += 1) {
        const p = document.createElement('span');
        p.className = settings.preset === 'feather' ? 'tapfx-particle tapfx-particle-feather' : 'tapfx-particle';
        const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.42;
        const distance = settings.size * (0.34 + Math.random() * 0.52);
        if (settings.preset !== 'feather') p.textContent = makeTapEffectParticleText(i, settings);
        p.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
        p.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
        p.style.setProperty('--delay', `${Math.random() * 120}ms`);
        p.style.setProperty('--scale', `${0.72 + Math.random() * 0.72}`);
        p.style.setProperty('--spin', `${-140 + Math.random() * 280}deg`);
        burst.appendChild(p);
    }
    layer.appendChild(burst);
    setTimeout(() => burst.remove(), 1150);
}
window.playGlobalTapEffect = playGlobalTapEffect;

function initGlobalTapEffect() {
    applyGlobalTapEffectSettings(getSavedTapEffectData());
    if (globalTapEffectBound) return;
    globalTapEffectBound = true;
    document.addEventListener('pointerdown', handleGlobalTapPointerDown, { capture: true, passive: true });
    document.addEventListener('pointerup', handleGlobalTapPointerUp, { capture: true, passive: true });
    document.addEventListener('pointercancel', () => { globalTapEffectState = null; }, { capture: true, passive: true });
}

const LOCK_DECO_ICONS = [
    'ri-attachment-line',
    'ri-heart-3-fill',
    'ri-sparkling-2-fill',
    'ri-flower-fill',
    'ri-bookmark-3-fill',
    'ri-star-smile-fill',
    'ri-moon-clear-fill'
];

function normalizeLockDecoIcon(value, fallback) {
    return LOCK_DECO_ICONS.includes(value) ? value : fallback;
}

function setThemeCheckbox(id, value) {
    const el = document.getElementById(id);
    if (el) el.checked = value !== false;
}

function getThemeCheckbox(id) {
    const el = document.getElementById(id);
    return !el || el.checked;
}

function getSavedThemeData() {
    try {
        const data = JSON.parse(localStorage.getItem('my_theme_data') || '{}') || {};
        if (Array.isArray(data.icons)) data.icons = normalizeThemeIconList(data.icons);
        return data;
    } catch (e) {
        return {};
    }
}

function applyLockscreenEnabled(enabled) {
    const isEnabled = enabled !== false;
    const root = document.documentElement;
    const lockScreen = document.getElementById('lock-screen');
    const homeScreen = document.getElementById('home-screen');
    root.classList.toggle('lockscreen-disabled', !isEnabled);
    if (!lockScreen || !homeScreen) return;
    if (!isEnabled) {
        lockScreen.classList.add('hidden', 'unlocked');
        homeScreen.classList.remove('hidden');
        if (typeof resetDesktopToFirstPage === 'function') resetDesktopToFirstPage();
        const statusBar = document.querySelector('.status-bar');
        if (statusBar && typeof window.homeIsDark !== 'undefined') {
            statusBar.classList.toggle('white-text', !!window.homeIsDark);
        }
        return;
    }
    lockScreen.classList.remove('hidden');
}
window.applyLockscreenEnabled = applyLockscreenEnabled;

function shouldDefaultHidePhoneStatusBar() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const standalone = window.navigator?.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
    return isIOS && standalone;
}

function resolvePhoneStatusBarEnabled(value) {
    if (value === false) return false;
    if (value === true) return true;
    return !shouldDefaultHidePhoneStatusBar();
}

let phoneStatusBarSlots = [];

function syncPhoneStatusBarHideStyle(isEnabled) {
    const styleId = 'bynd-phone-statusbar-hide-style';
    let styleEl = document.getElementById(styleId);
    if (isEnabled) {
        styleEl?.remove();
        return;
    }
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = '.status-bar{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}';
}

function detachPhoneStatusBarNodes() {
    document.querySelectorAll('.status-bar').forEach(statusBar => {
        let slot = phoneStatusBarSlots.find(item => item.node === statusBar);
        if (!slot) {
            const marker = document.createComment('bynd-phone-status-bar-slot');
            statusBar.parentNode?.insertBefore(marker, statusBar);
            slot = { node: statusBar, marker };
            phoneStatusBarSlots.push(slot);
        }
        statusBar.remove();
    });
}

function restorePhoneStatusBarNodes() {
    phoneStatusBarSlots.forEach(slot => {
        const node = slot.node;
        if (node.isConnected) return;
        if (slot.marker?.parentNode) {
            slot.marker.parentNode.insertBefore(node, slot.marker.nextSibling);
            return;
        }
        const phone = document.querySelector('.phone-container');
        const lockScreen = document.getElementById('lock-screen');
        if (phone && lockScreen) phone.insertBefore(node, lockScreen);
        else phone?.prepend(node);
    });
}

function syncPhoneStatusBarElements(isEnabled) {
    document.documentElement.classList.toggle('bynd-statusbar-hidden', !isEnabled);
    document.body?.classList.toggle('bynd-statusbar-hidden', !isEnabled);
    syncPhoneStatusBarHideStyle(isEnabled);
    if (isEnabled) restorePhoneStatusBarNodes();
    document.querySelectorAll('.status-bar').forEach(statusBar => {
        statusBar.classList.toggle('bynd-statusbar-force-hidden', !isEnabled);
        statusBar.hidden = false;
        if (isEnabled) {
            statusBar.style.removeProperty('display');
            statusBar.style.removeProperty('visibility');
            statusBar.style.removeProperty('opacity');
            statusBar.style.removeProperty('pointer-events');
        } else {
            statusBar.style.setProperty('display', 'none', 'important');
            statusBar.style.setProperty('visibility', 'hidden', 'important');
            statusBar.style.setProperty('opacity', '0', 'important');
            statusBar.style.setProperty('pointer-events', 'none', 'important');
        }
        statusBar.setAttribute('aria-hidden', isEnabled ? 'false' : 'true');
    });
    if (!isEnabled) detachPhoneStatusBarNodes();
}

function schedulePhoneStatusBarSync(isEnabled) {
    syncPhoneStatusBarElements(isEnabled);
    [0, 16, 80, 180, 420, 900].forEach(delay => {
        setTimeout(() => syncPhoneStatusBarElements(isEnabled), delay);
    });
    requestAnimationFrame(() => syncPhoneStatusBarElements(isEnabled));
    requestAnimationFrame(() => requestAnimationFrame(() => syncPhoneStatusBarElements(isEnabled)));
}

function applyPhoneStatusBarEnabled(enabled) {
    const isEnabled = resolvePhoneStatusBarEnabled(enabled);
    schedulePhoneStatusBarSync(isEnabled);
    return isEnabled;
}
window.applyPhoneStatusBarEnabled = applyPhoneStatusBarEnabled;

function setPhoneStatusBarEnabled(enabled) {
    const isEnabled = enabled !== false;
    const data = getSavedThemeData();
    data.phoneStatusBarEnabled = isEnabled;
    try {
        localStorage.setItem('my_theme_data', JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to save phone status bar setting', e);
    }
    setThemeCheckbox('phone-status-bar-enabled', isEnabled);
    applyPhoneStatusBarEnabled(isEnabled);
}
window.setPhoneStatusBarEnabled = setPhoneStatusBarEnabled;

function getPhoneStatusBarEnabledFromInput(fallbackValue) {
    const el = document.getElementById('phone-status-bar-enabled');
    return el ? el.checked : resolvePhoneStatusBarEnabled(fallbackValue);
}

function bindPhoneStatusBarSettingControl() {
    const el = document.getElementById('phone-status-bar-enabled');
    if (!el || el.dataset.phoneStatusBarBound === '1') return;
    el.dataset.phoneStatusBarBound = '1';
    el.addEventListener('change', () => setPhoneStatusBarEnabled(el.checked));
    el.addEventListener('input', () => setPhoneStatusBarEnabled(el.checked));
    el.addEventListener('click', () => requestAnimationFrame(() => setPhoneStatusBarEnabled(el.checked)));
}

function initPhoneStatusBarSettingDelegation() {
    if (document.documentElement.dataset.phoneStatusBarDelegated === '1') return;
    document.documentElement.dataset.phoneStatusBarDelegated = '1';
    const syncFromEvent = event => {
        const input = event.target?.id === 'phone-status-bar-enabled'
            ? event.target
            : event.target?.closest?.('label')?.querySelector?.('#phone-status-bar-enabled');
        if (!input) return;
        setTimeout(() => setPhoneStatusBarEnabled(input.checked), 0);
    };
    document.addEventListener('change', syncFromEvent, true);
    document.addEventListener('input', syncFromEvent, true);
    document.addEventListener('click', syncFromEvent, true);
}
initPhoneStatusBarSettingDelegation();

function byndClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function byndRgb(parts, alpha) {
    const rgb = parts.map(v => Math.round(byndClamp(v, 0, 255))).join(',');
    return alpha == null ? `rgb(${rgb})` : `rgba(${rgb},${alpha})`;
}

function byndMix(a, b, amount) {
    const t = byndClamp(amount, 0, 1);
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];
}

function byndBrightness(parts) {
    return (parts[0] * 299 + parts[1] * 587 + parts[2] * 114) / 1000;
}

function byndColorScore(parts, baseBrightness) {
    const max = Math.max(parts[0], parts[1], parts[2]);
    const min = Math.min(parts[0], parts[1], parts[2]);
    const saturation = max <= 0 ? 0 : (max - min) / max;
    const contrast = Math.abs(byndBrightness(parts) - baseBrightness) / 255;
    return saturation * 0.72 + contrast * 0.28;
}

function byndPickAccent(samples, average) {
    const baseBrightness = byndBrightness(average);
    let best = null;
    let bestScore = -1;
    samples.forEach(color => {
        const bright = byndBrightness(color);
        if (bright < 35 || bright > 238) return;
        const score = byndColorScore(color, baseBrightness);
        if (score > bestScore) {
            bestScore = score;
            best = color;
        }
    });
    if (best && bestScore > 0.18) return best;
    return byndMix(average, baseBrightness < 132 ? [200, 220, 255] : [35, 45, 58], 0.58);
}

function applyByndAdaptivePalette(average, accent) {
    average = average || [246, 247, 249];
    accent = accent || [45, 58, 74];
    const root = document.documentElement;
    const isDark = byndBrightness(average) < 132;
    const quietAccent = isDark ? byndMix(accent, [255, 255, 255], 0.22) : byndMix(accent, [18, 22, 28], 0.12);
    const tintedBg = isDark ? byndMix(average, [8, 9, 11], 0.72) : byndMix(average, [255, 255, 255], 0.74);

    root.classList.add('bynd-adaptive');
    root.dataset.byndTone = isDark ? 'dark' : 'light';
    root.style.setProperty('--bynd-accent', byndRgb(quietAccent));
    root.style.setProperty('--bynd-accent-soft', byndRgb(quietAccent, isDark ? 0.22 : 0.15));
    root.style.setProperty('--bynd-accent-faint', byndRgb(quietAccent, isDark ? 0.11 : 0.08));
    root.style.setProperty('--bynd-on-accent', '#ffffff');
    root.style.setProperty('--bynd-danger', '#ef4444');
    root.style.setProperty('--desktop-note-ink', isDark ? '#f8fafc' : '#151922');
    root.style.setProperty('--desktop-note-bg', isDark ? byndRgb(byndMix(average, [10, 12, 16], 0.56), 0.80) : byndRgb(byndMix(average, [255, 255, 255], 0.62), 0.86));
    root.style.setProperty('--desktop-note-accent', byndRgb(quietAccent));
    root.style.setProperty('--desktop-note-soft', byndRgb(quietAccent, isDark ? 0.22 : 0.14));
    root.style.setProperty('--desktop-note-shadow', isDark ? '0 16px 34px rgba(0,0,0,0.26)' : '0 16px 34px rgba(36,48,66,0.14)');

    if (isDark) {
        root.style.setProperty('--bynd-app-bg', `linear-gradient(180deg, rgba(7,8,10,0.92), ${byndRgb(tintedBg, 0.88)})`);
        root.style.setProperty('--bynd-content-bg', `linear-gradient(180deg, rgba(255,255,255,0.035), ${byndRgb(tintedBg, 0.72)})`);
        root.style.setProperty('--bynd-header', 'rgba(12,13,16,0.76)');
        root.style.setProperty('--bynd-surface', 'rgba(255,255,255,0.085)');
        root.style.setProperty('--bynd-surface-strong', 'rgba(255,255,255,0.13)');
        root.style.setProperty('--bynd-surface-solid', 'rgba(24,25,28,0.96)');
        root.style.setProperty('--bynd-control-bg', 'rgba(255,255,255,0.075)');
        root.style.setProperty('--bynd-code-bg', 'rgba(255,255,255,0.06)');
        root.style.setProperty('--bynd-text', '#f8fafc');
        root.style.setProperty('--bynd-muted', 'rgba(248,250,252,0.64)');
        root.style.setProperty('--bynd-faint', 'rgba(248,250,252,0.42)');
        root.style.setProperty('--bynd-border', 'rgba(255,255,255,0.12)');
        root.style.setProperty('--bynd-border-strong', 'rgba(255,255,255,0.20)');
        root.style.setProperty('--bynd-shadow', '0 18px 44px rgba(0,0,0,0.28)');
    } else {
        root.style.setProperty('--bynd-app-bg', `linear-gradient(180deg, rgba(255,255,255,0.90), ${byndRgb(tintedBg, 0.86)})`);
        root.style.setProperty('--bynd-content-bg', `linear-gradient(180deg, rgba(255,255,255,0.68), ${byndRgb(tintedBg, 0.58)})`);
        root.style.setProperty('--bynd-header', 'rgba(255,255,255,0.74)');
        root.style.setProperty('--bynd-surface', 'rgba(255,255,255,0.72)');
        root.style.setProperty('--bynd-surface-strong', 'rgba(255,255,255,0.88)');
        root.style.setProperty('--bynd-surface-solid', 'rgba(255,255,255,0.96)');
        root.style.setProperty('--bynd-control-bg', 'rgba(255,255,255,0.58)');
        root.style.setProperty('--bynd-code-bg', 'rgba(15,23,42,0.045)');
        root.style.setProperty('--bynd-text', '#111318');
        root.style.setProperty('--bynd-muted', 'rgba(17,19,24,0.58)');
        root.style.setProperty('--bynd-faint', 'rgba(17,19,24,0.36)');
        root.style.setProperty('--bynd-border', 'rgba(15,23,42,0.075)');
        root.style.setProperty('--bynd-border-strong', 'rgba(15,23,42,0.13)');
        root.style.setProperty('--bynd-shadow', '0 18px 42px rgba(15,23,42,0.10)');
    }
}

function getByndHomeWallpaperSrc() {
    const saved = getSavedThemeData();
    if (saved.wpHome) return saved.wpHome;
    const home = document.getElementById('home-screen');
    const bg = home ? home.style.backgroundImage || getComputedStyle(home).backgroundImage : '';
    const match = bg && bg.match(/url\(["']?(.+?)["']?\)/);
    return match ? match[1] : '';
}

function applyByndAdaptiveTheme(src) {
    src = src || getByndHomeWallpaperSrc();
    if (!src) {
        applyByndAdaptivePalette(window.homeIsDark ? [38, 42, 48] : [242, 244, 246], window.homeIsDark ? [150, 176, 210] : [42, 54, 70]);
        return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 56;
            canvas.height = 56;
            ctx.drawImage(img, 0, 0, 56, 56);
            const pixels = ctx.getImageData(0, 0, 56, 56).data;
            const samples = [];
            let total = [0, 0, 0];
            let count = 0;
            for (let i = 0; i < pixels.length; i += 16) {
                const alpha = pixels[i + 3];
                if (alpha < 80) continue;
                const color = [pixels[i], pixels[i + 1], pixels[i + 2]];
                total[0] += color[0];
                total[1] += color[1];
                total[2] += color[2];
                count++;
                samples.push(color);
            }
            if (!count) throw new Error('empty palette');
            const average = [total[0] / count, total[1] / count, total[2] / count];
            applyByndAdaptivePalette(average, byndPickAccent(samples, average));
        } catch (e) {
            applyByndAdaptivePalette(window.homeIsDark ? [38, 42, 48] : [242, 244, 246], window.homeIsDark ? [150, 176, 210] : [42, 54, 70]);
        }
    };
    img.onerror = function() {
        applyByndAdaptivePalette(window.homeIsDark ? [38, 42, 48] : [242, 244, 246], window.homeIsDark ? [150, 176, 210] : [42, 54, 70]);
    };
    img.src = src;
}
window.applyByndAdaptiveTheme = applyByndAdaptiveTheme;

function applyLockscreenAdaptivePalette(average, accent) {
    average = average || [246, 247, 249];
    accent = accent || [45, 58, 74];
    const root = document.documentElement;
    const isDark = byndBrightness(average) < 132;
    const quietAccent = isDark ? byndMix(accent, [255, 255, 255], 0.34) : byndMix(accent, [12, 16, 24], 0.22);
    const textColor = isDark ? '#ffffff' : '#17191f';
    const mutedColor = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(23,25,31,0.68)';

    root.classList.add('lock-adaptive');
    root.dataset.lockTone = isDark ? 'dark' : 'light';
    root.style.setProperty('--lock-text', textColor);
    root.style.setProperty('--lock-muted', mutedColor);
    root.style.setProperty('--lock-text-shadow', isDark ? '0 2px 14px rgba(0,0,0,0.45)' : '0 1px 12px rgba(255,255,255,0.55)');
    root.style.setProperty('--lock-chip-bg', isDark ? 'rgba(8,10,14,0.34)' : 'rgba(255,255,255,0.58)');
    root.style.setProperty('--lock-chip-border', isDark ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.72)');
    root.style.setProperty('--lock-chip-text', isDark ? '#ffffff' : byndRgb(byndMix(quietAccent, [0, 0, 0], 0.18)));
    root.style.setProperty('--lock-control-bg', isDark ? 'rgba(0,0,0,0.26)' : 'rgba(255,255,255,0.48)');
    root.style.setProperty('--lock-control-text', textColor);
    root.style.setProperty('--lock-swipe-bg', isDark ? 'rgba(255,255,255,0.58)' : 'rgba(23,25,31,0.32)');
    root.style.setProperty('--lock-glass-shadow', isDark ? '0 12px 30px rgba(0,0,0,0.22)' : '0 12px 30px rgba(90,112,140,0.12)');
    const swatches = [
        textColor,
        rgbToHex(...byndMix(quietAccent, isDark ? [255, 255, 255] : [0, 0, 0], 0.08).map(Math.round)),
        rgbToHex(...byndMix(average, isDark ? [240, 248, 255] : [24, 28, 34], 0.42).map(Math.round)),
        isDark ? '#d8e6ff' : '#111318'
    ];
    renderLockClockSwatches(swatches);
    applyLockClockColorPreference(textColor, isDark);
}

function getLockClockColorInput() {
    return document.getElementById('lock-clock-color');
}

function getSavedLockClockColorMode() {
    const input = getLockClockColorInput();
    if (input && input.dataset.auto) return input.dataset.auto === '1' ? 'auto' : 'custom';
    const saved = getSavedThemeData();
    return saved.lockClockColorMode === 'custom' ? 'custom' : 'auto';
}

function applyLockClockCustomColor(value) {
    const color = normalizeThemeAccent(value, '#ffffff');
    const root = document.documentElement;
    const isDarkColor = byndBrightness([
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16)
    ]) < 132;
    root.style.setProperty('--lock-text', color);
    root.style.setProperty('--lock-muted', hexToThemeRgba(color, 0.72));
    root.style.setProperty('--lock-text-shadow', isDarkColor ? '0 1px 12px rgba(255,255,255,0.36)' : '0 2px 14px rgba(0,0,0,0.42)');
}

function applyLockClockColorPreference(autoColor, isDark) {
    const input = getLockClockColorInput();
    const saved = getSavedThemeData();
    const mode = getSavedLockClockColorMode();
    const custom = input?.value || saved.lockClockColor || '';
    if (mode === 'custom' && custom) {
        applyLockClockCustomColor(custom);
    } else if (input) {
        input.dataset.auto = '1';
        input.value = normalizeThemeAccent(autoColor, isDark ? '#ffffff' : '#17191f');
    }
}

function setLockClockCustomColor(value) {
    const input = getLockClockColorInput();
    if (input) {
        input.dataset.auto = '0';
        input.value = normalizeThemeAccent(value, '#ffffff');
    }
    applyLockClockCustomColor(value);
}
window.setLockClockCustomColor = setLockClockCustomColor;

function resetLockClockColorAuto() {
    const input = getLockClockColorInput();
    if (input) input.dataset.auto = '1';
    applyLockscreenAdaptiveTheme();
}
window.resetLockClockColorAuto = resetLockClockColorAuto;

function renderLockClockSwatches(colors) {
    const wrap = document.getElementById('lock-clock-swatches');
    if (!wrap) return;
    const unique = [...new Set((colors || []).map(c => normalizeThemeAccent(c, '')).filter(Boolean))].slice(0, 5);
    wrap.innerHTML = unique.map(color => `<button type="button" style="--swatch:${color}" onclick="setLockClockCustomColor('${color}')" aria-label="选择 ${color}"></button>`).join('');
}

function applyLockscreenAdaptiveTheme(src) {
    const saved = getSavedThemeData();
    src = src || saved.wpLock || '';
    if (!src) {
        applyLockscreenAdaptivePalette(window.lockIsDark ? [38, 42, 48] : [246, 247, 249], window.lockIsDark ? [185, 205, 232] : [48, 60, 76]);
        return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 54;
            canvas.height = 54;
            ctx.drawImage(img, 0, 0, 54, 54);
            const pixels = ctx.getImageData(0, 0, 54, 54).data;
            const samples = [];
            let total = [0, 0, 0];
            let count = 0;
            for (let i = 0; i < pixels.length; i += 16) {
                const alpha = pixels[i + 3];
                if (alpha < 80) continue;
                const color = [pixels[i], pixels[i + 1], pixels[i + 2]];
                total[0] += color[0];
                total[1] += color[1];
                total[2] += color[2];
                count++;
                samples.push(color);
            }
            if (!count) throw new Error('empty lock palette');
            const average = [total[0] / count, total[1] / count, total[2] / count];
            applyLockscreenAdaptivePalette(average, byndPickAccent(samples, average));
        } catch (e) {
            applyLockscreenAdaptivePalette(window.lockIsDark ? [38, 42, 48] : [246, 247, 249], window.lockIsDark ? [185, 205, 232] : [48, 60, 76]);
        }
    };
    img.onerror = function() {
        applyLockscreenAdaptivePalette(window.lockIsDark ? [38, 42, 48] : [246, 247, 249], window.lockIsDark ? [185, 205, 232] : [48, 60, 76]);
    };
    img.src = src;
}
window.applyLockscreenAdaptiveTheme = applyLockscreenAdaptiveTheme;

const CAL_TRANSPARENCY_DEFAULT = 0;

function normalizeCalTransparency(value) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return CAL_TRANSPARENCY_DEFAULT;
    return Math.max(0, Math.min(78, n));
}

function updateCalTransparencyLabel(value) {
    const normalized = normalizeCalTransparency(value);
    const range = document.getElementById('cal-transparency');
    const label = document.getElementById('cal-transparency-value');
    if (range) range.value = String(normalized);
    if (label) label.textContent = `${normalized}%`;
}

function getCalTransparencyValue(value) {
    const saved = getSavedThemeData();
    const range = document.getElementById('cal-transparency');
    const normalized = normalizeCalTransparency(
        value != null ? value : (range && range.value !== '' ? range.value : saved.calTransparency)
    );
    updateCalTransparencyLabel(normalized);
    return normalized;
}

function previewCalTransparency(value) {
    const normalized = getCalTransparencyValue(value);
    const activeMode = document.querySelector('.cal-mode-btn.active')?.dataset.mode;
    if (activeMode === 'transparent') applyTransparentCalColors(normalized);
}
window.previewCalTransparency = previewCalTransparency;

function getLockWeatherText(data) {
    const raw = data && data.lockWeather != null ? data.lockWeather : '';
    const text = String(raw || '').trim();
    return /^24\s*(?:°C|掳C)$/i.test(text) ? '' : text;
}

function getLockDisplayWeatherText(data) {
    return getLockWeatherText(data) || String(window._byndLockAutoWeatherText || '').trim();
}

function setLockMusicText(value) {
    const text = String(value || '').trim();
    const marquee = document.querySelector('.music-pill marquee');
    const pill = marquee ? marquee.closest('.music-pill') : null;
    if (marquee) marquee.textContent = text;
    if (pill) pill.classList.toggle('hidden', !text);
}

function updateLockDateDisplay(data) {
    const dateEl = document.getElementById('ls-date');
    if (!dateEl) return;
    data = data || getSavedThemeData();
    const now = new Date();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateText = `${weekdays[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;
    const weather = getLockDisplayWeatherText(data);
    dateEl.innerHTML = `<span>${dateText}</span>${weather ? `<span class="ls-weather-chip">${themeEscapeHtml(weather)}</span>` : ''}`;
    const weatherPill = document.getElementById('ls-weather-pill-text');
    const weatherWrap = weatherPill ? weatherPill.closest('.widget-pill') : null;
    if (weatherPill) weatherPill.textContent = weather;
    if (weatherWrap) weatherWrap.classList.toggle('hidden', !weather);
}
window.updateLockDateDisplay = updateLockDateDisplay;

function applyLockscreenOptions(data) {
    data = data || getSavedThemeData();
    applyLockscreenEnabled(data.lockEnabled !== false);
    if (Object.prototype.hasOwnProperty.call(data, 'phoneStatusBarEnabled')) {
        applyPhoneStatusBarEnabled(data.phoneStatusBarEnabled);
    }
    const leftPhoto = document.getElementById('lock-photo-left');
    const rightPhoto = document.getElementById('lock-photo-right');
    const vibeText = document.getElementById('ls-vibe-text');
    const topDeco = document.getElementById('ls-top-deco');
    const topIcon = document.getElementById('ls-top-deco-icon');
    const bottomDeco = document.getElementById('ls-bottom-deco');

    if (leftPhoto) leftPhoto.classList.toggle('hidden', data.lockShowLeft === false);
    if (rightPhoto) rightPhoto.classList.toggle('hidden', data.lockShowRight === false);
    if (vibeText) vibeText.classList.toggle('hidden', data.lockShowText === false || !String(vibeText.textContent || '').trim());
    if (topDeco) topDeco.classList.toggle('hidden', data.lockShowTopDeco === false);
    if (bottomDeco) bottomDeco.classList.toggle('hidden', data.lockShowBottomDeco === false);

    if (topIcon) topIcon.className = normalizeLockDecoIcon(data.lockTopIcon, 'ri-attachment-line');
    if (bottomDeco) {
        bottomDeco.className = `${normalizeLockDecoIcon(data.lockBottomIcon, 'ri-star-smile-fill')} sticker-star`;
    }
    if (data.lockClockColorMode === 'custom' && data.lockClockColor) {
        applyLockClockCustomColor(data.lockClockColor);
    }
    updateLockDateDisplay(data);
}
window.applyLockscreenOptions = applyLockscreenOptions;

// 2. 🔧 强力压缩函数
function convertFile(input, targetInputId) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;

            img.onload = function() {
                let maxWidth = 720;  
                let quality = 0.5;   
                let isIcon = targetInputId.includes('icon');

                if (isIcon) {
                    maxWidth = 150;  
                    quality = 0.8;   
                }

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let outputType = 'image/jpeg';
                if (isIcon) {
                    outputType = 'image/png'; 
                    canvas.width = maxWidth;
                    canvas.height = maxWidth;
                    ctx.clearRect(0, 0, maxWidth, maxWidth); 
                    const cropSize = Math.min(img.width, img.height);
                    const cropX = (img.width - cropSize) / 2;
                    const cropY = (img.height - cropSize) / 2;
                    ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, maxWidth, maxWidth);
                } else {
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.fillStyle = "#ffffff"; 
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                }
                
                const compressedData = canvas.toDataURL(outputType, quality);

                const inputEl = document.getElementById(targetInputId);
                inputEl.value = compressedData;

                const previewId = targetInputId.replace('input-', 'preview-');
                const previewEl = document.getElementById(previewId);
                if(previewEl) previewEl.innerHTML = `<img src="${compressedData}">`;

                if (targetInputId === 'input-wp-lock') applyLockscreenAdaptiveTheme(compressedData);
                if (targetInputId === 'input-wp-home') applyByndAdaptiveTheme(compressedData);
                
                if(inputEl.parentElement) {
                    inputEl.parentElement.style.background = "#e6fffa"; 
                }
            }
        };
        reader.readAsDataURL(file);
    }
}

// 3. 读取设置
function loadSavedSettings() {
    try {
        const data = JSON.parse(localStorage.getItem('my_theme_data') || '{}') || {};
        renderThemeLibrary();
        bindPhoneStatusBarSettingControl();
        const phoneStatusBarEnabled = applyPhoneStatusBarEnabled(data.phoneStatusBarEnabled);
        setThemeCheckbox('phone-status-bar-enabled', phoneStatusBarEnabled);
        if (Object.keys(data).length === 0) return;

        if (data.wpLock) document.getElementById('input-wp-lock').value = data.wpLock;
        if (data.wpHome) document.getElementById('input-wp-home').value = data.wpHome;
        if (data.music) document.getElementById('input-music-text').value = data.music;
        if (data.vibe) document.getElementById('input-vibe-text').value = data.vibe;
        if (data.l1) document.getElementById('input-lock-img-1').value = data.l1;
        if (data.l2) document.getElementById('input-lock-img-2').value = data.l2;
        if (data.d1) document.getElementById('input-desk-img-1').value = data.d1;
        if (data.d2) document.getElementById('input-desk-img-2').value = data.d2;
        setThemeCheckbox('lock-enabled', data.lockEnabled);
        setThemeCheckbox('phone-status-bar-enabled', phoneStatusBarEnabled);
        setThemeCheckbox('lock-show-left', data.lockShowLeft);
        setThemeCheckbox('lock-show-right', data.lockShowRight);
        setThemeCheckbox('lock-show-text', data.lockShowText);
        setThemeCheckbox('lock-show-top-deco', data.lockShowTopDeco);
        setThemeCheckbox('lock-show-bottom-deco', data.lockShowBottomDeco);
        if (document.getElementById('lock-top-icon')) document.getElementById('lock-top-icon').value = normalizeLockDecoIcon(data.lockTopIcon, 'ri-attachment-line');
        if (document.getElementById('lock-bottom-icon')) document.getElementById('lock-bottom-icon').value = normalizeLockDecoIcon(data.lockBottomIcon, 'ri-star-smile-fill');
        if (document.getElementById('input-lock-weather')) document.getElementById('input-lock-weather').value = getLockWeatherText(data);
        const lockClockInput = getLockClockColorInput();
        if (lockClockInput) {
            lockClockInput.dataset.auto = data.lockClockColorMode === 'custom' ? '0' : '1';
            lockClockInput.value = normalizeThemeAccent(data.lockClockColor, '#ffffff');
            if (data.lockClockColorMode === 'custom' && data.lockClockColor) applyLockClockCustomColor(data.lockClockColor);
        }

        if (data.icons) {
            migrateThemeIconData(data).forEach((url, index) => {
                const inputEl = document.getElementById('input-icon-' + index);
                if (inputEl) {
                    inputEl.value = url;
                    if(url && url.length > 0) {
                        const previewEl = document.getElementById('preview-icon-' + index);
                        if(previewEl) previewEl.innerHTML = `<img src="${url}">`;
                    }
                }
            });
        }

        // 加载日历配色
        if (data.calBg) document.getElementById('cal-color-bg').value = data.calBg;
        if (data.calText) document.getElementById('cal-color-text').value = data.calText;
        if (data.calDim) document.getElementById('cal-color-dim').value = data.calDim;
        if (data.calAccent) document.getElementById('cal-color-accent').value = data.calAccent;
        updateCalTransparencyLabel(data.calTransparency);
        if (data.calMode) switchCalMode(data.calMode);
        renderTapEffectSettings(data.tapEffect);
        applyGlobalTapEffectSettings(data.tapEffect);

        // 加载锁屏快捷按钮
        const leftSel = document.getElementById('ls-shortcut-left');
        const rightSel = document.getElementById('ls-shortcut-right');
        if (leftSel && data.lsLeft) leftSel.value = normalizeLsShortcutAction(data.lsLeft, 'flashlight');
        if (rightSel && data.lsRight) rightSel.value = normalizeLsShortcutAction(data.lsRight, 'camera');

        // 加载组件设置
        if (data.widget1) {
            const sel1 = document.getElementById('widget-type-1');
            if (sel1) { sel1.value = normalizeThemeWidgetType(data.widget1.type); toggleWidgetOptions(1); }
            if (data.widget1.style && document.getElementById('widget-style-1')) document.getElementById('widget-style-1').value = normalizeThemeWidgetStyle(data.widget1.style);
            if (data.widget1.accent && document.getElementById('widget-accent-1')) document.getElementById('widget-accent-1').value = normalizeThemeAccent(data.widget1.accent, '#0a84ff');
        }
        if (data.widget2) {
            const sel2 = document.getElementById('widget-type-2');
            if (sel2) { sel2.value = normalizeThemeWidgetType(data.widget2.type); toggleWidgetOptions(2); }
            if (data.widget2.style && document.getElementById('widget-style-2')) document.getElementById('widget-style-2').value = normalizeThemeWidgetStyle(data.widget2.style);
            if (data.widget2.accent && document.getElementById('widget-accent-2')) document.getElementById('widget-accent-2').value = normalizeThemeAccent(data.widget2.accent, '#ff9f0a');
        }
    } catch (e) { console.error(e); }
}

function collectThemeDataFromInputs() {
    const fallback = getSavedThemeData();
    const readValue = (id, fallbackValue) => {
        const el = document.getElementById(id);
        return el ? el.value : (fallbackValue || '');
    };
    const widgetData = (slot, fallbackWidget, fallbackAccent) => ({
        type: 'photo',
        cdTitle: '',
        cdDate: '',
        quote: '',
        style: normalizeThemeWidgetStyle(readValue('widget-style-' + slot, fallbackWidget?.style || 'frost')),
        accent: normalizeThemeAccent(readValue('widget-accent-' + slot, fallbackWidget?.accent || fallbackAccent), fallbackAccent)
    });
    const iconInputs = [];
    for (let i = 0; i < THEME_ICON_TARGETS.length; i++) {
        iconInputs.push(readValue('input-icon-' + i, fallback.icons?.[i] || ''));
    }
    const calMode = document.querySelector('.cal-mode-btn.active')?.dataset.mode || fallback.calMode || 'manual';
    return {
        wpLock: readValue('input-wp-lock', fallback.wpLock),
        wpHome: readValue('input-wp-home', fallback.wpHome),
        music: readValue('input-music-text', fallback.music),
        vibe: readValue('input-vibe-text', fallback.vibe),
        l1: readValue('input-lock-img-1', fallback.l1),
        l2: readValue('input-lock-img-2', fallback.l2),
        d1: readValue('input-desk-img-1', fallback.d1),
        d2: readValue('input-desk-img-2', fallback.d2),
        icons: iconInputs,
        lockEnabled: getThemeCheckbox('lock-enabled'),
        phoneStatusBarEnabled: getPhoneStatusBarEnabledFromInput(fallback.phoneStatusBarEnabled),
        lockShowLeft: getThemeCheckbox('lock-show-left'),
        lockShowRight: getThemeCheckbox('lock-show-right'),
        lockShowText: getThemeCheckbox('lock-show-text'),
        lockShowTopDeco: getThemeCheckbox('lock-show-top-deco'),
        lockShowBottomDeco: getThemeCheckbox('lock-show-bottom-deco'),
        lockTopIcon: normalizeLockDecoIcon(readValue('lock-top-icon', fallback.lockTopIcon), 'ri-attachment-line'),
        lockBottomIcon: normalizeLockDecoIcon(readValue('lock-bottom-icon', fallback.lockBottomIcon), 'ri-star-smile-fill'),
        lockWeather: readValue('input-lock-weather', fallback.lockWeather).trim(),
        lockClockColorMode: getSavedLockClockColorMode(),
        lockClockColor: readValue('lock-clock-color', fallback.lockClockColor || '#ffffff'),
        calMode,
        calBg: readValue('cal-color-bg', fallback.calBg || '#1f2937'),
        calText: readValue('cal-color-text', fallback.calText || '#ffffff'),
        calDim: readValue('cal-color-dim', fallback.calDim || '#888888'),
        calAccent: readValue('cal-color-accent', fallback.calAccent || '#ff69b4'),
        calTransparency: getCalTransparencyValue(),
        tapEffect: collectTapEffectDataFromInputs(fallback.tapEffect?.preset || 'moon'),
        lsLeft: normalizeLsShortcutAction(readValue('ls-shortcut-left', fallback.lsLeft || 'flashlight'), 'flashlight'),
        lsRight: normalizeLsShortcutAction(readValue('ls-shortcut-right', fallback.lsRight || 'camera'), 'camera'),
        widget1: widgetData(1, fallback.widget1, '#0a84ff'),
        widget2: widgetData(2, fallback.widget2, '#ff9f0a')
    };
}

function getSavedDesktopLayoutSnapshot() {
    if (window._editMode && typeof collectDesktopLayout === 'function') {
        return { items: collectDesktopLayout(), savedAt: Date.now() };
    }
    try {
        return JSON.parse(localStorage.getItem('desktop_layout_v2') || '{}') || {};
    } catch (e) {
        return {};
    }
}

const THEME_LIBRARY_DB_NAME = 'bynd_theme_library_db';
const THEME_LIBRARY_DB_VERSION = 1;
const THEME_LIBRARY_STORE_NAME = 'themes';
const THEME_LIBRARY_LIMIT = 24;
let themeLibrarySaving = false;

function setThemeLibraryStatus(text, type) {
    const el = document.getElementById('theme-library-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'theme-library-status' + (type ? ' ' + type : '');
}

function getThemeLibrarySaveButton() {
    return document.getElementById('theme-library-save-btn') || document.querySelector('.theme-library-save button');
}

function setThemeLibrarySaving(active) {
    themeLibrarySaving = !!active;
    const btn = getThemeLibrarySaveButton();
    if (!btn) return;
    btn.disabled = !!active;
    btn.textContent = active ? '保存中...' : '保存当前主题';
}

function openThemeLibraryDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(THEME_LIBRARY_DB_NAME, THEME_LIBRARY_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(THEME_LIBRARY_STORE_NAME)) {
                db.createObjectStore(THEME_LIBRARY_STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('theme library db failed'));
    });
}

function readThemeLibraryFromDb() {
    return openThemeLibraryDb().then(db => new Promise((resolve, reject) => {
        if (!db) { resolve(null); return; }
        const tx = db.transaction(THEME_LIBRARY_STORE_NAME, 'readonly');
        const req = tx.objectStore(THEME_LIBRARY_STORE_NAME).getAll();
        req.onsuccess = () => {
            db.close();
            resolve((req.result || []).sort((a, b) => ((b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))));
        };
        req.onerror = () => {
            db.close();
            reject(req.error || new Error('theme library read failed'));
        };
    }));
}

function writeThemeLibraryToDb(list) {
    return openThemeLibraryDb().then(db => new Promise((resolve, reject) => {
        if (!db) { resolve(false); return; }
        const tx = db.transaction(THEME_LIBRARY_STORE_NAME, 'readwrite');
        const store = tx.objectStore(THEME_LIBRARY_STORE_NAME);
        store.clear();
        (Array.isArray(list) ? list : []).forEach(item => store.put(item));
        tx.oncomplete = () => {
            db.close();
            resolve(true);
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error || new Error('theme library write failed'));
        };
    }));
}

async function getThemeLibraryStore() {
    try {
        const idbList = await readThemeLibraryFromDb();
        if (Array.isArray(idbList) && idbList.length) return idbList.filter(item => item && item.id && item.themeData);
    } catch (e) {
        console.warn('theme library idb read failed:', e);
    }
    try {
        const list = JSON.parse(localStorage.getItem(THEME_LIBRARY_KEY) || '[]');
        const safeList = Array.isArray(list) ? list.filter(item => item && item.id && item.themeData) : [];
        if (safeList.length) {
            writeThemeLibraryToDb(safeList).catch(() => {});
            localStorage.setItem(THEME_LIBRARY_KEY, JSON.stringify(safeList.map(item => ({
                id: item.id,
                name: item.name,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            }))));
        }
        return safeList;
    } catch (e) {
        return [];
    }
}

async function saveThemeLibraryStore(list) {
    const safeList = Array.isArray(list) ? list : [];
    let wroteToDb = false;
    let idbError = null;
    try {
        wroteToDb = await writeThemeLibraryToDb(safeList);
    } catch (e) {
        idbError = e;
    }
    const localStorePayload = wroteToDb ? safeList.map(item => ({
        id: item.id,
        name: item.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
    })) : safeList;
    try {
        localStorage.setItem(THEME_LIBRARY_KEY, JSON.stringify(localStorePayload));
    } catch (e) {
        if (!wroteToDb) throw e;
    }
    if (!wroteToDb && idbError) console.warn('theme library idb write failed:', idbError);
}

async function saveCurrentThemeLibraryItem() {
    if (themeLibrarySaving) return;
    setThemeLibraryStatus('正在保存当前主题...', '');
    setThemeLibrarySaving(true);
    const input = document.getElementById('theme-library-name');
    try {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const list = await getThemeLibraryStore();
        const name = (input?.value || '').trim() || `主题 ${list.length + 1}`;
        const themeData = collectThemeDataFromInputs();
        const item = {
            id: 'theme_' + Date.now(),
            name: name.slice(0, 28),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            themeData,
            desktopLayout: getSavedDesktopLayoutSnapshot()
        };
        list.unshift(item);
        await saveThemeLibraryStore(list.slice(0, THEME_LIBRARY_LIMIT));
        if (input) input.value = '';
        await renderThemeLibrary();
        setThemeLibraryStatus('已保存到主题库。', 'ok');
    } catch (e) {
        console.error('save theme library failed:', e);
        setThemeLibraryStatus('保存失败：' + (e && e.message ? e.message : '存储空间不足或浏览器拒绝写入'), 'error');
    } finally {
        setThemeLibrarySaving(false);
    }
}
window.saveCurrentThemeLibraryItem = saveCurrentThemeLibraryItem;

async function applyThemeLibraryItem(id) {
    const item = (await getThemeLibraryStore()).find(entry => entry.id === id);
    if (!item) return;
    localStorage.setItem('my_theme_data', JSON.stringify(item.themeData || {}));
    if (item.desktopLayout && Array.isArray(item.desktopLayout.items) && item.desktopLayout.items.length) {
        localStorage.setItem('desktop_layout_v2', JSON.stringify(item.desktopLayout));
    } else {
        localStorage.removeItem('desktop_layout_v2');
    }
    window.location.href = window.location.pathname + '?v=theme-' + Date.now();
}
window.applyThemeLibraryItem = applyThemeLibraryItem;

async function overwriteThemeLibraryItem(id) {
    if (themeLibrarySaving) return;
    setThemeLibraryStatus('正在覆盖主题...', '');
    setThemeLibrarySaving(true);
    try {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const list = await getThemeLibraryStore();
        const index = list.findIndex(entry => entry.id === id);
        if (index < 0) {
            setThemeLibraryStatus('没有找到要覆盖的主题。', 'error');
            return;
        }
        const now = Date.now();
        const current = list[index] || {};
        list[index] = {
            ...current,
            name: current.name || '未命名主题',
            createdAt: current.createdAt || now,
            updatedAt: now,
            themeData: collectThemeDataFromInputs(),
            desktopLayout: getSavedDesktopLayoutSnapshot()
        };
        list.sort((a, b) => ((b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)));
        await saveThemeLibraryStore(list.slice(0, THEME_LIBRARY_LIMIT));
        await renderThemeLibrary();
        setThemeLibraryStatus(`已覆盖「${list.find(item => item.id === id)?.name || '主题'}」。`, 'ok');
    } catch (e) {
        console.error('overwrite theme library failed:', e);
        setThemeLibraryStatus('覆盖失败：' + (e && e.message ? e.message : '存储空间不足或浏览器拒绝写入'), 'error');
    } finally {
        setThemeLibrarySaving(false);
    }
}
window.overwriteThemeLibraryItem = overwriteThemeLibraryItem;

async function deleteThemeLibraryItem(id) {
    const next = (await getThemeLibraryStore()).filter(item => item.id !== id);
    await saveThemeLibraryStore(next);
    await renderThemeLibrary();
    setThemeLibraryStatus('已删除主题。', 'ok');
}
window.deleteThemeLibraryItem = deleteThemeLibraryItem;

async function renderThemeLibrary() {
    const listEl = document.getElementById('theme-library-list');
    if (!listEl) return;
    const list = await getThemeLibraryStore();
    if (!list.length) {
        listEl.innerHTML = `
            <div class="theme-library-empty">
                <strong>还没有保存的主题</strong>
                <span>调好壁纸、图标、锁屏、日历和桌面布局后点上方保存。</span>
            </div>
        `;
        return;
    }
    listEl.innerHTML = list.map(item => {
        const data = item.themeData || {};
        const preview = data.wpHome || data.wpLock || data.d1 || data.l1 || '';
        const iconCount = Array.isArray(data.icons) ? data.icons.filter(Boolean).length : 0;
        const layoutCount = Array.isArray(item.desktopLayout?.items) ? item.desktopLayout.items.length : 0;
        const time = new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        return `
            <div class="theme-library-item">
                <div class="theme-library-preview">${preview ? `<img src="${themeEscapeHtml(preview)}" alt="">` : '<i class="ri-palette-line"></i>'}</div>
                <div class="theme-library-meta">
                    <strong>${themeEscapeHtml(item.name || '未命名主题')}</strong>
                    <span>${time} · 图标 ${iconCount} · 布局 ${layoutCount}</span>
                </div>
                <button type="button" class="apply" onclick="applyThemeLibraryItem('${themeEscapeHtml(item.id)}')">套用</button>
                <button type="button" class="overwrite" onclick="overwriteThemeLibraryItem('${themeEscapeHtml(item.id)}')">覆盖</button>
                <button type="button" class="delete" onclick="deleteThemeLibraryItem('${themeEscapeHtml(item.id)}')" aria-label="删除主题"><i class="ri-delete-bin-line"></i></button>
            </div>
        `;
    }).join('');
}

// 4. 💾 保存设置
function saveTheme() {
    const wpLock = document.getElementById('input-wp-lock').value;
    const wpHome = document.getElementById('input-wp-home').value;
    const musicText = document.getElementById('input-music-text').value;
    const vibeText = document.getElementById('input-vibe-text').value; 
    
    const lockImg1 = document.getElementById('input-lock-img-1').value;
    const lockImg2 = document.getElementById('input-lock-img-2').value;
    const deskImg1 = document.getElementById('input-desk-img-1').value;
    const deskImg2 = document.getElementById('input-desk-img-2').value;
    const lockEnabled = getThemeCheckbox('lock-enabled');
    const phoneStatusBarEnabled = getPhoneStatusBarEnabledFromInput();
    const lockShowLeft = getThemeCheckbox('lock-show-left');
    const lockShowRight = getThemeCheckbox('lock-show-right');
    const lockShowText = getThemeCheckbox('lock-show-text');
    const lockShowTopDeco = getThemeCheckbox('lock-show-top-deco');
    const lockShowBottomDeco = getThemeCheckbox('lock-show-bottom-deco');
    const lockTopIcon = normalizeLockDecoIcon(document.getElementById('lock-top-icon')?.value, 'ri-attachment-line');
    const lockBottomIcon = normalizeLockDecoIcon(document.getElementById('lock-bottom-icon')?.value, 'ri-star-smile-fill');
    const lockWeather = (document.getElementById('input-lock-weather')?.value || '').trim();
    const lockClockColorMode = getSavedLockClockColorMode();
    const lockClockColor = normalizeThemeAccent(document.getElementById('lock-clock-color')?.value || '#ffffff', '#ffffff');

    if (wpLock) {
        const lockScreen = document.getElementById('lock-screen');
        lockScreen.style.backgroundImage = `url('${wpLock}')`;
        lockScreen.style.backgroundSize = "cover"; 
    }
    if (wpHome) {
        const homeScreen = document.getElementById('home-screen');
        homeScreen.style.backgroundImage = `url('${wpHome}')`;
        homeScreen.style.backgroundSize = "cover";
    }

    // 检测亮度
    if (wpLock) checkImageBrightness(wpLock, 'lock');
    else checkImageBrightness("", 'lock');
    if (wpHome) checkImageBrightness(wpHome, 'home');
    else checkImageBrightness("", 'home');
    applyLockscreenAdaptiveTheme(wpLock);
    applyByndAdaptiveTheme(wpHome);
    applyPhoneStatusBarEnabled(phoneStatusBarEnabled);

    setLockMusicText(musicText);
    const lockVibeText = document.getElementById('ls-vibe-text');
    if (lockVibeText) lockVibeText.textContent = vibeText;
    if(lockImg1) document.querySelector('.user-img-1').src = lockImg1;
    if(lockImg2) document.querySelector('.user-img-2').src = lockImg2;
    applyLockscreenOptions({
        lockEnabled,
        lockShowLeft,
        lockShowRight,
        lockShowText,
        lockShowTopDeco,
        lockShowBottomDeco,
        lockTopIcon,
        lockBottomIcon,
        lockWeather,
        lockClockColorMode,
        lockClockColor,
        phoneStatusBarEnabled
    });
    // 组件系统
    const widgetType1 = 'photo';
    const widgetType2 = 'photo';
    const widgetCdTitle1 = '';
    const widgetCdDate1 = '';
    const widgetCdTitle2 = '';
    const widgetCdDate2 = '';
    const widgetQuote1 = '';
    const widgetQuote2 = '';
    const widgetStyle1 = normalizeThemeWidgetStyle(document.getElementById('widget-style-1')?.value || 'frost');
    const widgetStyle2 = normalizeThemeWidgetStyle(document.getElementById('widget-style-2')?.value || 'frost');
    const widgetAccent1 = normalizeThemeAccent(document.getElementById('widget-accent-1')?.value || '#0a84ff', '#0a84ff');
    const widgetAccent2 = normalizeThemeAccent(document.getElementById('widget-accent-2')?.value || '#ff9f0a', '#ff9f0a');

    renderWidget(1, widgetType1, { img: deskImg1, title: widgetCdTitle1, date: widgetCdDate1, text: widgetQuote1, style: widgetStyle1, accent: widgetAccent1 });
    renderWidget(2, widgetType2, { img: deskImg2, title: widgetCdTitle2, date: widgetCdDate2, text: widgetQuote2, style: widgetStyle2, accent: widgetAccent2 });

    const iconInputs = [];
    for(let i=0; i<THEME_ICON_TARGETS.length; i++) {
        const el = document.getElementById('input-icon-' + i);
        iconInputs.push(el ? el.value : "");
    }

    const dockIcons = document.querySelectorAll('.dock-item');

    iconInputs.forEach((url, index) => {
        if (!url) return; 
        if (index >= THEME_DOCK_ICON_START) {
            const dockIndex = index - THEME_DOCK_ICON_START;
            if (dockIcons[dockIndex]) {
                const iconBox = dockIcons[dockIndex].querySelector('.dock-icon-box');
                if (iconBox) {
                    iconBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:cover; display:block;">`;
                }
            }
        }
    });

    // 日历配色
    const calMode = document.querySelector('.cal-mode-btn.active')?.dataset.mode || 'manual';
    const calBg = document.getElementById('cal-color-bg').value;
    const calText = document.getElementById('cal-color-text').value;
    const calDim = document.getElementById('cal-color-dim').value;
    const calAccent = document.getElementById('cal-color-accent').value;
    const calTransparency = getCalTransparencyValue();

    const lsLeft = normalizeLsShortcutAction(document.getElementById('ls-shortcut-left')?.value || 'flashlight', 'flashlight');
    const lsRight = normalizeLsShortcutAction(document.getElementById('ls-shortcut-right')?.value || 'camera', 'camera');
    const tapEffect = collectTapEffectDataFromInputs();

    const themeData = {
        wpLock: wpLock, wpHome: wpHome, music: musicText, vibe: vibeText,
        l1: lockImg1, l2: lockImg2, d1: deskImg1, d2: deskImg2, icons: iconInputs,
        lockEnabled, phoneStatusBarEnabled,
        lockShowLeft, lockShowRight, lockShowText, lockShowTopDeco, lockShowBottomDeco,
        lockTopIcon, lockBottomIcon, lockWeather, lockClockColorMode, lockClockColor,
        calMode: calMode, calBg: calBg, calText: calText, calDim: calDim, calAccent: calAccent, calTransparency: calTransparency,
        tapEffect,
        lsLeft: lsLeft, lsRight: lsRight,
        widget1: { type: widgetType1, cdTitle: widgetCdTitle1, cdDate: widgetCdDate1, quote: widgetQuote1, style: widgetStyle1, accent: widgetAccent1 },
        widget2: { type: widgetType2, cdTitle: widgetCdTitle2, cdDate: widgetCdDate2, quote: widgetQuote2, style: widgetStyle2, accent: widgetAccent2 }
    };
    if (typeof refreshDesktopThemedIcons === 'function') refreshDesktopThemedIcons(themeData);
    applyGlobalTapEffectSettings(tapEffect);
    
    try {
        localStorage.removeItem('my_theme_data');
        localStorage.setItem('my_theme_data', JSON.stringify(themeData));
        applyLsShortcuts(lsLeft, lsRight);

        alert("✅ 保存成功！文字颜色已自动适配");
        if (typeof closeApp === 'function') closeApp('theme');
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
             alert("❌ 空间不足！请重新点击上传按钮，触发压缩逻辑！");
        } else {
             alert("❌ 错误: " + e.message);
        }
    }
}

// 5. 初始化
function initTheme() {
    try {
        const data = JSON.parse(localStorage.getItem('my_theme_data') || '{}') || {};
        const saveBtn = getThemeLibrarySaveButton();
        if (saveBtn) saveBtn.onclick = saveCurrentThemeLibraryItem;
        renderThemeLibrary();
        initGlobalTapEffect();
        bindPhoneStatusBarSettingControl();
        renderTapEffectSettings(data.tapEffect);
        applyByndAdaptiveTheme(data.wpHome || '');
        applyLockscreenAdaptiveTheme(data.wpLock || '');
        applyLockscreenEnabled(data.lockEnabled !== false);
        applyPhoneStatusBarEnabled(data.phoneStatusBarEnabled);
        if (Object.keys(data).length === 0) return;

        if (data.wpLock) {
            const lockScreen = document.getElementById('lock-screen');
            lockScreen.style.backgroundImage = `url('${data.wpLock}')`;
            lockScreen.style.backgroundSize = "cover";
            checkImageBrightness(data.wpLock, 'lock');
        }
        if (data.wpHome) {
            const homeScreen = document.getElementById('home-screen');
            homeScreen.style.backgroundImage = `url('${data.wpHome}')`;
            homeScreen.style.backgroundSize = "cover";
            checkImageBrightness(data.wpHome, 'home');
        }

        setLockMusicText(data.music || '');
        const lockVibeText = document.getElementById('ls-vibe-text');
        if (lockVibeText) lockVibeText.textContent = data.vibe || '';
        if(data.l1) document.querySelector('.user-img-1').src = data.l1;
        if(data.l2) document.querySelector('.user-img-2').src = data.l2;
        applyLockscreenOptions(data);
        const lockClockInput = getLockClockColorInput();
        if (lockClockInput) {
            lockClockInput.dataset.auto = data.lockClockColorMode === 'custom' ? '0' : '1';
            lockClockInput.value = normalizeThemeAccent(data.lockClockColor, '#ffffff');
            if (data.lockClockColorMode === 'custom' && data.lockClockColor) applyLockClockCustomColor(data.lockClockColor);
        }
        // 桌面组件
        if (data.widget1) {
            renderWidget(1, normalizeThemeWidgetType(data.widget1.type), { img: data.d1, style: data.widget1.style, accent: data.widget1.accent });
        } else if (data.d1) {
            document.querySelector('.desktop-img-1').src = data.d1;
        }
        if (data.widget2) {
            renderWidget(2, normalizeThemeWidgetType(data.widget2.type), { img: data.d2, style: data.widget2.style, accent: data.widget2.accent });
        } else {
            const allDeskImgs = document.querySelectorAll('.photo-large img');
            if(allDeskImgs.length > 1 && data.d2) allDeskImgs[1].src = data.d2;
        }

        // 初始化日历配色
        updateCalTransparencyLabel(data.calTransparency);
        if (data.calMode === 'transparent') {
            applyTransparentCalColors(data.calTransparency);
        } else if (data.calMode === 'auto') {
            // 自动取色需要等壁纸加载完
            setTimeout(() => autoExtractCalColors(), 300);
        } else if (data.calBg) {
            applyCalColors(data.calBg, data.calText || '#ffffff', data.calDim || '#888888', data.calAccent || '#ff69b4');
        }

        const dockIcons = document.querySelectorAll('.dock-item');

        if (data.icons) {
            const normalizedIcons = migrateThemeIconData(data);
            if (typeof refreshDesktopThemedIcons === 'function') refreshDesktopThemedIcons({ ...data, icons: normalizedIcons });
            normalizedIcons.forEach((url, index) => {
                if (!url) return;
                if (index >= THEME_DOCK_ICON_START) {
                    const dockIndex = index - THEME_DOCK_ICON_START;
                    if(dockIcons[dockIndex]) {
                        const iconBox = dockIcons[dockIndex].querySelector('.dock-icon-box');
                        if (iconBox) {
                            iconBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:cover; display:block;">`;
                        }
                    }
                }
            });
        }

        // 锁屏快捷按钮
        if (data.lsLeft || data.lsRight) {
            applyLsShortcuts(
                normalizeLsShortcutAction(data.lsLeft || 'flashlight', 'flashlight'),
                normalizeLsShortcutAction(data.lsRight || 'camera', 'camera')
            );
        }
    } catch(e) { console.error(e); }
}

// 6. 📅 日历配色功能

// 模式切换
function switchCalMode(mode) {
    if (!['manual', 'auto', 'transparent'].includes(mode)) mode = 'manual';
    document.querySelectorAll('.cal-mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.cal-mode-btn[data-mode="${mode}"]`)?.classList.add('active');
    document.getElementById('cal-manual-panel').classList.toggle('hidden', mode !== 'manual');
    document.getElementById('cal-auto-panel').classList.toggle('hidden', mode !== 'auto');
    document.getElementById('cal-transparent-panel')?.classList.toggle('hidden', mode !== 'transparent');

    if (mode === 'auto') {
        autoExtractCalColors();
    } else if (mode === 'transparent') {
        applyTransparentCalColors();
    }
}

// 实时预览手动调色
function previewCalColors() {
    const bg = document.getElementById('cal-color-bg').value;
    const text = document.getElementById('cal-color-text').value;
    const dim = document.getElementById('cal-color-dim').value;
    const accent = document.getElementById('cal-color-accent').value;
    applyCalColors(bg, text, dim, accent);
}

// 应用颜色到日历组件
function applyCalColors(bg, text, dim, accent) {
    const widget = document.querySelector('.calendar-widget');
    if (!widget) return;
    widget.classList.remove('calendar-transparent');
    widget.style.setProperty('--cal-bg', bg);
    widget.style.setProperty('--cal-text', text);
    widget.style.setProperty('--cal-dim', dim);
    widget.style.setProperty('--cal-accent', accent);

    // 同步更新预览小组件
    const preview = document.getElementById('cal-preview');
    if (preview) {
        preview.classList.remove('calendar-transparent');
        preview.style.setProperty('--cal-bg', bg);
        preview.style.setProperty('--cal-text', text);
        preview.style.setProperty('--cal-dim', dim);
        preview.style.setProperty('--cal-accent', accent);
    }
}

// 从壁纸自动提取主色调
function autoExtractCalColors() {
    const homeScreen = document.getElementById('home-screen');
    if (!homeScreen) return;
    const bgImg = homeScreen.style.backgroundImage;
    const match = bgImg && bgImg.match(/url\(['"]?(.+?)['"]?\)/);

    if (!match) {
        // 没有壁纸，用默认深色
        applyCalColors('#000000', '#ffffff', '#888888', '#ff69b4');
        return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = match[1];
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 80;
        canvas.height = 80;
        ctx.drawImage(img, 0, 0, 80, 80);
        const data = ctx.getImageData(0, 0, 80, 80).data;

        // 收集所有像素颜色，找主色调
        const colorBuckets = {};
        for (let i = 0; i < data.length; i += 16) { // 每4个像素采样一次
            const r = Math.round(data[i] / 32) * 32;
            const g = Math.round(data[i+1] / 32) * 32;
            const b = Math.round(data[i+2] / 32) * 32;
            const key = `${r},${g},${b}`;
            colorBuckets[key] = (colorBuckets[key] || 0) + 1;
        }

        // 按频率排序
        const sorted = Object.entries(colorBuckets).sort((a, b) => b[1] - a[1]);

        // 主色（最常见）作为背景
        const dominant = sorted[0][0].split(',').map(Number);
        const dominantBrightness = (dominant[0] * 299 + dominant[1] * 587 + dominant[2] * 114) / 1000;

        // 根据主色亮度决定文字颜色
        const isDark = dominantBrightness < 140;
        const textColor = isDark ? '#ffffff' : '#1a1a1a';
        const dimColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';

        // 找一个饱和度高的颜色做爱心色（accent）
        let accentColor = '#ff69b4'; // 默认粉色
        for (let j = 0; j < Math.min(sorted.length, 10); j++) {
            const [rs, gs, bs] = sorted[j][0].split(',').map(Number);
            const max = Math.max(rs, gs, bs);
            const min = Math.min(rs, gs, bs);
            const saturation = max === 0 ? 0 : (max - min) / max;
            if (saturation > 0.3 && max > 60) {
                accentColor = `rgb(${rs},${gs},${bs})`;
                break;
            }
        }

        // 让背景色稍微加深/半透明感
        const bgR = Math.max(0, dominant[0] - 20);
        const bgG = Math.max(0, dominant[1] - 20);
        const bgB = Math.max(0, dominant[2] - 20);
        const bgColor = `rgb(${bgR},${bgG},${bgB})`;

        applyCalColors(bgColor, textColor, dimColor, accentColor);

        // 同步更新手动面板的颜色选择器
        document.getElementById('cal-color-bg').value = rgbToHex(bgR, bgG, bgB);
        document.getElementById('cal-color-text').value = isDark ? '#ffffff' : '#1a1a1a';
        document.getElementById('cal-color-accent').value = rgbStringToHex(accentColor);
    };
    img.onerror = function() {
        applyCalColors('#000000', '#ffffff', '#888888', '#ff69b4');
    };
}

// RGB 转 hex 辅助
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => Math.min(255, Math.max(0, x)).toString(16).padStart(2, '0')).join('');
}
function rgbStringToHex(str) {
    const m = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) return rgbToHex(+m[1], +m[2], +m[3]);
    return str; // 已经是 hex
}

// 7. 🧠 自动变色大脑 (升级版：检测全图)
window.lockIsDark = false; 
window.homeIsDark = false;

function checkImageBrightness(src, type) {
    if (!src) return;
    if (src.includes('radial-gradient') || src === '') {
        applyBrightnessResult(false, type);
        return;
    }
    const img = new Image();
    img.crossOrigin = "Anonymous"; 
    img.src = src;
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        // 👇 关键修改：采样整张图片 (缩略为 50x50 以提高性能)
        canvas.width = 50;
        canvas.height = 50; 
        ctx.drawImage(img, 0, 0, 50, 50);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let r, g, b, avg;
        let colorSum = 0;
        
        for (let i = 0, len = data.length; i < len; i += 4) {
            r = data[i]; g = data[i + 1]; b = data[i + 2];
            avg = Math.floor((r + g + b) / 3);
            colorSum += avg;
        }
        
        const brightness = Math.floor(colorSum / (canvas.width * canvas.height));
        // 阈值：亮度 < 140 算深色 (可以根据需要调整)
        applyBrightnessResult(brightness < 140, type);
    }
}

function applyBrightnessResult(isDark, type) {
    const statusBar = document.querySelector('.status-bar');

    if (type === 'lock') {
        window.lockIsDark = isDark;
        const lockScreen = document.getElementById('lock-screen');
        if (isDark) {
            lockScreen.classList.add('dark-mode');
        } else {
            lockScreen.classList.remove('dark-mode');
        }

        if (!lockScreen.classList.contains('unlocked')) {
            isDark ? statusBar.classList.add('white-text') : statusBar.classList.remove('white-text');
        }
    }
    else if (type === 'home') {
        window.homeIsDark = isDark;
        const homeScreen = document.getElementById('home-screen');
        if (isDark) {
            homeScreen.classList.add('dark-mode');
        } else {
            homeScreen.classList.remove('dark-mode');
        }

        const lockScreen = document.getElementById('lock-screen');
        if (lockScreen.classList.contains('unlocked')) {
            isDark ? statusBar.classList.add('white-text') : statusBar.classList.remove('white-text');
        }

        const activeCalMode = document.querySelector('.cal-mode-btn.active')?.dataset.mode || getSavedThemeData().calMode;
        if (activeCalMode === 'transparent') applyTransparentCalColors();
    }
}

// 7. 锁屏快捷按钮系统
const LS_SHORTCUT_ICONS = {
    flashlight: 'ri-flashlight-fill',
    wechat: 'ri-wechat-fill',
    camera: 'ri-camera-fill',
    music: 'ri-music-2-fill',
    settings: 'ri-settings-3-fill',
    theme: 'ri-palette-fill'
};

function normalizeLsShortcutAction(action, fallback) {
    return LS_SHORTCUT_ICONS[action] ? action : fallback;
}

function lsShortcutAction(side) {
    const data = JSON.parse(localStorage.getItem('my_theme_data') || '{}');
    const action = side === 'left'
        ? normalizeLsShortcutAction(data.lsLeft || 'flashlight', 'flashlight')
        : normalizeLsShortcutAction(data.lsRight || 'camera', 'camera');

    if (action === 'flashlight') {
        const btn = document.getElementById('ls-btn-' + side);
        btn.classList.toggle('ls-flash-on');
        return;
    }

    unlockPhone();
    if (action === 'camera' && typeof openSystemCamera === 'function') {
        openSystemCamera();
        return;
    }
    setTimeout(() => {
        if (typeof openApp === 'function') openApp(action);
    }, 300);
}

function applyLsShortcuts(leftVal, rightVal) {
    const leftBtn = document.getElementById('ls-btn-left');
    const rightBtn = document.getElementById('ls-btn-right');
    leftVal = normalizeLsShortcutAction(leftVal || 'flashlight', 'flashlight');
    rightVal = normalizeLsShortcutAction(rightVal || 'camera', 'camera');
    if (leftBtn) leftBtn.innerHTML = `<i class="${LS_SHORTCUT_ICONS[leftVal] || 'ri-flashlight-fill'}"></i>`;
    if (rightBtn) rightBtn.innerHTML = `<i class="${LS_SHORTCUT_ICONS[rightVal] || 'ri-camera-fill'}"></i>`;
}

function initLsShortcuts() {
    try {
        const data = JSON.parse(localStorage.getItem('my_theme_data'));
        if (!data) return;
        const leftVal = normalizeLsShortcutAction(data.lsLeft || 'flashlight', 'flashlight');
        const rightVal = normalizeLsShortcutAction(data.lsRight || 'camera', 'camera');
        applyLsShortcuts(leftVal, rightVal);
        const leftSel = document.getElementById('ls-shortcut-left');
        const rightSel = document.getElementById('ls-shortcut-right');
        if (leftSel) leftSel.value = leftVal;
        if (rightSel) rightSel.value = rightVal;
    } catch(e) {}
}

// 8. 桌面组件系统
function toggleWidgetOptions(idx) {
    const type = normalizeThemeWidgetType(document.getElementById('widget-type-' + idx)?.value);
    const container = document.getElementById('widget-opts-' + idx);
    if (!container) return;
    container.querySelector('.widget-opt-photo')?.classList.toggle('hidden', type !== 'photo');
}

function renderWidget(slot, type, data) {
    const el = document.querySelector('.photo-large:nth-of-type(' + slot + ')');
    const containers = document.querySelectorAll('.photo-large');
    const container = containers[slot - 1];
    if (!container) return;
    data = data || {};
    type = normalizeThemeWidgetType(type);
    const styleName = normalizeThemeWidgetStyle(data.style || document.getElementById('widget-style-' + slot)?.value || 'frost');
    const accent = normalizeThemeAccent(data.accent || document.getElementById('widget-accent-' + slot)?.value || '#0a84ff', slot === 2 ? '#ff9f0a' : '#0a84ff');
    container.className = `photo-large ios-widget-host ios-widget-${styleName}`;
    container.style.setProperty('--widget-accent', accent);
    container.style.setProperty('--widget-accent-soft', hexToThemeRgba(accent, 0.18));

    const imgSrc = data.img || container.querySelector('img')?.src || '';
    container.innerHTML = `<img src="${themeEscapeHtml(imgSrc)}" class="desktop-img-${slot} ios-photo-widget">`;
}

function applyTransparentCalColors(value) {
    const widget = document.querySelector('.calendar-widget');
    const preview = document.getElementById('cal-preview');
    const opacity = getCalTransparencyValue(value) / 100;
    const isDark = !!window.homeIsDark;
    const text = isDark ? '#ffffff' : '#263241';
    const dim = isDark ? 'rgba(255,255,255,0.58)' : 'rgba(38,50,65,0.48)';
    const accent = isDark ? '#d8e6ff' : '#8fb3df';
    const bg = isDark
        ? `rgba(255,255,255,${(opacity * 0.58).toFixed(2)})`
        : `rgba(255,255,255,${opacity.toFixed(2)})`;
    const strength = Math.max(0, Math.min(1, opacity / 0.78));
    const borderAlpha = Math.min(0.42, opacity * 0.9);
    const shadowAlpha = strength * 0.12;
    const blurPx = Math.round(strength * 14);
    [widget, preview].forEach(el => {
        if (!el) return;
        el.classList.add('calendar-transparent');
        el.style.setProperty('--cal-bg', bg);
        el.style.setProperty('--cal-text', text);
        el.style.setProperty('--cal-dim', dim);
        el.style.setProperty('--cal-accent', accent);
        el.style.setProperty('--cal-border', `rgba(255,255,255,${borderAlpha.toFixed(2)})`);
        el.style.setProperty('--cal-shadow', `0 14px 30px rgba(114,136,160,${shadowAlpha.toFixed(2)})`);
        el.style.setProperty('--cal-blur', `${blurPx}px`);
    });
}

function hexToThemeRgba(hex, alpha) {
    const safe = normalizeThemeAccent(hex, '#0a84ff').replace('#', '');
    const r = parseInt(safe.slice(0, 2), 16);
    const g = parseInt(safe.slice(2, 4), 16);
    const b = parseInt(safe.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function updateWidgetClock(slot) {
    const timeEl = document.getElementById('widget-clock-' + slot);
    const dateEl = document.getElementById('widget-clock-date-' + slot);
    if (!timeEl) return;
    const now = new Date();
    timeEl.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    if (dateEl) {
        const days = ['日','一','二','三','四','五','六'];
        dateEl.textContent = `${now.getMonth()+1}月${now.getDate()}日 周${days[now.getDay()]}`;
    }
}
