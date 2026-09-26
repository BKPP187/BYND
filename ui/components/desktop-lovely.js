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

