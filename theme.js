// --- 🎨 theme.js: 最终增强版 (全屏亮度检测 + 自动白字) ---

const THEME_ICON_TARGETS = [
    {i:'ri-wechat-line', n:'微信'}, {i:'ri-code-s-slash-line', n:'正则'},
    {i:'ri-book-read-line', n:'世界书'}, {i:'ri-settings-4-line', n:'设置'},
    {i:'ri-palette-line', n:'美化'}, {i:'ri-graduation-cap-line', n:'学习'},
    {i:'ri-money-cny-box-line', n:'记账'}, {i:'ri-gamepad-line', n:'Game'},
    {i:'ri-music-2-fill', n:'音乐'}, {i:'ri-camera-lens-line', n:'相机'},
    {i:'ri-equalizer-line', n:'预设'}
];

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
    if (icons.length >= 12) {
        return [...icons.slice(0, 9), ...icons.slice(10, 12)];
    }
    return icons.slice(0, THEME_ICON_TARGETS.length);
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

function normalizeThemeAccent(value, fallback) {
    const text = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
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
        return JSON.parse(localStorage.getItem('my_theme_data') || '{}') || {};
    } catch (e) {
        return {};
    }
}

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

const CAL_TRANSPARENCY_DEFAULT = 36;

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
    const raw = data && data.lockWeather != null ? data.lockWeather : '24°C';
    return String(raw || '').trim();
}

function updateLockDateDisplay(data) {
    const dateEl = document.getElementById('ls-date');
    if (!dateEl) return;
    data = data || getSavedThemeData();
    const now = new Date();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateText = `${weekdays[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;
    const weather = getLockWeatherText(data);
    dateEl.innerHTML = `<span>${dateText}</span>${weather ? `<span class="ls-weather-chip">${themeEscapeHtml(weather)}</span>` : ''}`;
    const weatherPill = document.getElementById('ls-weather-pill-text');
    const weatherWrap = weatherPill ? weatherPill.closest('.widget-pill') : null;
    if (weatherPill) weatherPill.textContent = weather;
    if (weatherWrap) weatherWrap.classList.toggle('hidden', !weather);
}
window.updateLockDateDisplay = updateLockDateDisplay;

function applyLockscreenOptions(data) {
    data = data || getSavedThemeData();
    const leftPhoto = document.getElementById('lock-photo-left');
    const rightPhoto = document.getElementById('lock-photo-right');
    const vibeText = document.getElementById('ls-vibe-text');
    const topDeco = document.getElementById('ls-top-deco');
    const topIcon = document.getElementById('ls-top-deco-icon');
    const bottomDeco = document.getElementById('ls-bottom-deco');

    if (leftPhoto) leftPhoto.classList.toggle('hidden', data.lockShowLeft === false);
    if (rightPhoto) rightPhoto.classList.toggle('hidden', data.lockShowRight === false);
    if (vibeText) vibeText.classList.toggle('hidden', data.lockShowText === false);
    if (topDeco) topDeco.classList.toggle('hidden', data.lockShowTopDeco === false);
    if (bottomDeco) bottomDeco.classList.toggle('hidden', data.lockShowBottomDeco === false);

    if (topIcon) topIcon.className = normalizeLockDecoIcon(data.lockTopIcon, 'ri-attachment-line');
    if (bottomDeco) {
        bottomDeco.className = `${normalizeLockDecoIcon(data.lockBottomIcon, 'ri-star-smile-fill')} sticker-star`;
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
        const data = JSON.parse(localStorage.getItem('my_theme_data'));
        if (!data) return;

        if (data.wpLock) document.getElementById('input-wp-lock').value = data.wpLock;
        if (data.wpHome) document.getElementById('input-wp-home').value = data.wpHome;
        if (data.music) document.getElementById('input-music-text').value = data.music;
        if (data.vibe) document.getElementById('input-vibe-text').value = data.vibe;
        if (data.l1) document.getElementById('input-lock-img-1').value = data.l1;
        if (data.l2) document.getElementById('input-lock-img-2').value = data.l2;
        if (data.d1) document.getElementById('input-desk-img-1').value = data.d1;
        if (data.d2) document.getElementById('input-desk-img-2').value = data.d2;
        setThemeCheckbox('lock-show-left', data.lockShowLeft);
        setThemeCheckbox('lock-show-right', data.lockShowRight);
        setThemeCheckbox('lock-show-text', data.lockShowText);
        setThemeCheckbox('lock-show-top-deco', data.lockShowTopDeco);
        setThemeCheckbox('lock-show-bottom-deco', data.lockShowBottomDeco);
        if (document.getElementById('lock-top-icon')) document.getElementById('lock-top-icon').value = normalizeLockDecoIcon(data.lockTopIcon, 'ri-attachment-line');
        if (document.getElementById('lock-bottom-icon')) document.getElementById('lock-bottom-icon').value = normalizeLockDecoIcon(data.lockBottomIcon, 'ri-star-smile-fill');
        if (document.getElementById('input-lock-weather')) document.getElementById('input-lock-weather').value = getLockWeatherText(data);

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

        // 加载锁屏快捷按钮
        const leftSel = document.getElementById('ls-shortcut-left');
        const rightSel = document.getElementById('ls-shortcut-right');
        if (leftSel && data.lsLeft) leftSel.value = normalizeLsShortcutAction(data.lsLeft, 'flashlight');
        if (rightSel && data.lsRight) rightSel.value = normalizeLsShortcutAction(data.lsRight, 'camera');

        // 加载组件设置
        if (data.widget1) {
            const sel1 = document.getElementById('widget-type-1');
            if (sel1) { sel1.value = data.widget1.type || 'photo'; toggleWidgetOptions(1); }
            if (data.widget1.cdTitle) document.getElementById('widget-cd-title-1').value = data.widget1.cdTitle;
            if (data.widget1.cdDate) document.getElementById('widget-cd-date-1').value = data.widget1.cdDate;
            if (data.widget1.quote) document.getElementById('widget-quote-1').value = data.widget1.quote;
            if (data.widget1.style && document.getElementById('widget-style-1')) document.getElementById('widget-style-1').value = normalizeThemeWidgetStyle(data.widget1.style);
            if (data.widget1.accent && document.getElementById('widget-accent-1')) document.getElementById('widget-accent-1').value = normalizeThemeAccent(data.widget1.accent, '#0a84ff');
        }
        if (data.widget2) {
            const sel2 = document.getElementById('widget-type-2');
            if (sel2) { sel2.value = data.widget2.type || 'photo'; toggleWidgetOptions(2); }
            if (data.widget2.cdTitle) document.getElementById('widget-cd-title-2').value = data.widget2.cdTitle;
            if (data.widget2.cdDate) document.getElementById('widget-cd-date-2').value = data.widget2.cdDate;
            if (data.widget2.quote) document.getElementById('widget-quote-2').value = data.widget2.quote;
            if (data.widget2.style && document.getElementById('widget-style-2')) document.getElementById('widget-style-2').value = normalizeThemeWidgetStyle(data.widget2.style);
            if (data.widget2.accent && document.getElementById('widget-accent-2')) document.getElementById('widget-accent-2').value = normalizeThemeAccent(data.widget2.accent, '#ff9f0a');
        }
    } catch (e) { console.error(e); }
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
    const lockShowLeft = getThemeCheckbox('lock-show-left');
    const lockShowRight = getThemeCheckbox('lock-show-right');
    const lockShowText = getThemeCheckbox('lock-show-text');
    const lockShowTopDeco = getThemeCheckbox('lock-show-top-deco');
    const lockShowBottomDeco = getThemeCheckbox('lock-show-bottom-deco');
    const lockTopIcon = normalizeLockDecoIcon(document.getElementById('lock-top-icon')?.value, 'ri-attachment-line');
    const lockBottomIcon = normalizeLockDecoIcon(document.getElementById('lock-bottom-icon')?.value, 'ri-star-smile-fill');
    const lockWeather = (document.getElementById('input-lock-weather')?.value || '').trim();

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
    applyByndAdaptiveTheme(wpHome);

    if(musicText) document.querySelector('.music-pill marquee').textContent = musicText;
    if(vibeText) document.getElementById('ls-vibe-text').textContent = vibeText;
    if(lockImg1) document.querySelector('.user-img-1').src = lockImg1;
    if(lockImg2) document.querySelector('.user-img-2').src = lockImg2;
    applyLockscreenOptions({
        lockShowLeft,
        lockShowRight,
        lockShowText,
        lockShowTopDeco,
        lockShowBottomDeco,
        lockTopIcon,
        lockBottomIcon,
        lockWeather
    });
    // 组件系统
    const widgetType1 = document.getElementById('widget-type-1')?.value || 'photo';
    const widgetType2 = document.getElementById('widget-type-2')?.value || 'photo';
    const widgetCdTitle1 = document.getElementById('widget-cd-title-1')?.value || '';
    const widgetCdDate1 = document.getElementById('widget-cd-date-1')?.value || '';
    const widgetCdTitle2 = document.getElementById('widget-cd-title-2')?.value || '';
    const widgetCdDate2 = document.getElementById('widget-cd-date-2')?.value || '';
    const widgetQuote1 = document.getElementById('widget-quote-1')?.value || '';
    const widgetQuote2 = document.getElementById('widget-quote-2')?.value || '';
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

    const desktopIcons = document.querySelectorAll('.apps-quad .app-icon');
    const dockIcons = document.querySelectorAll('.dock-item');

    iconInputs.forEach((url, index) => {
        if (!url) return; 
        if (index < 8) { 
            if (desktopIcons[index]) {
                desktopIcons[index].innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:cover; display:block;">`;
                desktopIcons[index].style.padding = "0"; 
                desktopIcons[index].style.background = "transparent";
            }
        } else { 
            const dockIndex = index - 8;
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

    const themeData = {
        wpLock: wpLock, wpHome: wpHome, music: musicText, vibe: vibeText,
        l1: lockImg1, l2: lockImg2, d1: deskImg1, d2: deskImg2, icons: iconInputs,
        lockShowLeft, lockShowRight, lockShowText, lockShowTopDeco, lockShowBottomDeco,
        lockTopIcon, lockBottomIcon, lockWeather,
        calMode: calMode, calBg: calBg, calText: calText, calDim: calDim, calAccent: calAccent, calTransparency: calTransparency,
        lsLeft: lsLeft, lsRight: lsRight,
        widget1: { type: widgetType1, cdTitle: widgetCdTitle1, cdDate: widgetCdDate1, quote: widgetQuote1, style: widgetStyle1, accent: widgetAccent1 },
        widget2: { type: widgetType2, cdTitle: widgetCdTitle2, cdDate: widgetCdDate2, quote: widgetQuote2, style: widgetStyle2, accent: widgetAccent2 }
    };
    
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
        applyByndAdaptiveTheme(data.wpHome || '');
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

        if(data.music) document.querySelector('.music-pill marquee').textContent = data.music;
        if(data.vibe) document.getElementById('ls-vibe-text').textContent = data.vibe;
        if(data.l1) document.querySelector('.user-img-1').src = data.l1;
        if(data.l2) document.querySelector('.user-img-2').src = data.l2;
        applyLockscreenOptions(data);
        // 桌面组件
        if (data.widget1) {
            renderWidget(1, data.widget1.type, { img: data.d1, title: data.widget1.cdTitle, date: data.widget1.cdDate, text: data.widget1.quote, style: data.widget1.style, accent: data.widget1.accent });
        } else if (data.d1) {
            document.querySelector('.desktop-img-1').src = data.d1;
        }
        if (data.widget2) {
            renderWidget(2, data.widget2.type, { img: data.d2, title: data.widget2.cdTitle, date: data.widget2.cdDate, text: data.widget2.quote, style: data.widget2.style, accent: data.widget2.accent });
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

        const desktopIcons = document.querySelectorAll('.apps-quad .app-icon');
        const dockIcons = document.querySelectorAll('.dock-item');

        if (data.icons) {
            migrateThemeIconData(data).forEach((url, index) => {
                if (!url) return;
                if (index < 8 && desktopIcons[index]) {
                    desktopIcons[index].innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:cover; display:block;">`;
                    desktopIcons[index].style.padding = "0"; 
                    desktopIcons[index].style.background = "transparent";
                } else if (index >= 8) {
                    const dockIndex = index - 8;
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
    const type = document.getElementById('widget-type-' + idx).value;
    const container = document.getElementById('widget-opts-' + idx);
    if (!container) return;
    container.querySelector('.widget-opt-photo').classList.toggle('hidden', type !== 'photo');
    container.querySelector('.widget-opt-countdown').classList.toggle('hidden', type !== 'countdown');
    container.querySelector('.widget-opt-quote').classList.toggle('hidden', type !== 'quote');
}

function renderWidget(slot, type, data) {
    const el = document.querySelector('.photo-large:nth-of-type(' + slot + ')');
    const containers = document.querySelectorAll('.photo-large');
    const container = containers[slot - 1];
    if (!container) return;
    data = data || {};
    const styleName = normalizeThemeWidgetStyle(data.style || document.getElementById('widget-style-' + slot)?.value || 'frost');
    const accent = normalizeThemeAccent(data.accent || document.getElementById('widget-accent-' + slot)?.value || '#0a84ff', slot === 2 ? '#ff9f0a' : '#0a84ff');
    container.className = `photo-large ios-widget-host ios-widget-${styleName}`;
    container.style.setProperty('--widget-accent', accent);
    container.style.setProperty('--widget-accent-soft', hexToThemeRgba(accent, 0.18));

    if (type === 'photo') {
        const imgSrc = data.img || container.querySelector('img')?.src || '';
        container.innerHTML = `<img src="${themeEscapeHtml(imgSrc)}" class="desktop-img-${slot} ios-photo-widget">`;
    } else if (type === 'clock') {
        container.innerHTML = `
            <div class="widget-clock ios-widget-card">
                <div class="ios-widget-head"><i class="ri-time-line"></i><span>Clock</span></div>
                <div class="wc-time" id="widget-clock-${slot}">00:00</div>
                <div class="wc-date" id="widget-clock-date-${slot}"></div>
                <div class="ios-widget-ring"></div>
            </div>
        `;
        updateWidgetClock(slot);
        if (!window._widgetClockInterval) {
            window._widgetClockInterval = setInterval(() => {
                updateWidgetClock(1);
                updateWidgetClock(2);
            }, 1000);
        }
    } else if (type === 'countdown') {
        const title = data.title || '倒计时';
        const target = data.date ? new Date(data.date) : new Date();
        const now = new Date();
        const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
        const display = diff > 0 ? diff : 0;
        const targetText = data.date ? data.date.replace(/-/g, '.') : '未设置日期';
        container.innerHTML = `
            <div class="widget-countdown ios-widget-card">
                <div class="ios-widget-head"><i class="ri-calendar-event-line"></i><span>${themeEscapeHtml(targetText)}</span></div>
                <div class="cd-title">${themeEscapeHtml(title)}</div>
                <div class="cd-days">${display}</div>
                <div class="cd-label">days left</div>
                <div class="ios-widget-progress"><span style="width:${Math.max(8, Math.min(100, 100 - display))}%"></span></div>
            </div>
        `;
    } else if (type === 'quote') {
        const text = data.text || '今天也要加油鸭~';
        container.innerHTML = `
            <div class="widget-quote-card ios-widget-card">
                <div class="ios-widget-head"><i class="ri-double-quotes-l"></i><span>Note</span></div>
                <div class="qt-text">${themeEscapeHtml(text)}</div>
                <div class="qt-mark">“</div>
            </div>
        `;
    }
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
