// --- 气泡CSS预设系统 ---
function createKawaiiBubblePreset({ id, name, paper, reply, ink, edge, inner, shadow, mainArt, charmArt, stitched = false }, { legacy = false, legacyMeta = false } = {}) {
    const bubble = '.msg-bubble.wc-text-bubble';
    const mine = '.msg-bubble.green.wc-text-bubble';
    const frame = fill => `background: ${fill}; color: ${ink}; border: 2px solid ${edge}; border-radius: 15px 18px 16px 18px; box-shadow: inset 0 0 0 3px ${shadow}, inset 0 0 0 4px ${inner}, 0 2px 0 ${shadow}, 0 5px 13px rgba(49, 40, 49, 0.12);${stitched ? ` outline: 1px dashed ${inner}; outline-offset: -8px;` : ''}`;
    return {
        id,
        name,
        css: [
            `${bubble} { position: relative; ${frame(paper)} ${legacy ? 'padding: 11px 17px 9px 21px;' : 'max-width: min(100%, 252px); margin-top: 14px; padding: 9px 12px 7px 15px;'} }`,
            `${mine} { ${frame(reply)} ${legacy ? 'padding: 11px 21px 9px 17px;' : 'padding: 9px 15px 7px 12px;'} border-radius: 18px 15px 18px 16px; }`,
            `${bubble}::before { content: ''; position: absolute; ${legacy ? 'top: -31px; left: -17px; right: auto; width: 56px; height: 46px;' : 'top: -13px; left: -11px; right: auto; width: 40px; height: 32px;'} background: url("assets/ui/chat-bubbles/${mainArt}.png") center / contain no-repeat; border: 0; transform: none; pointer-events: none; }`,
            `${mine}::before { left: auto; right: ${legacy ? '-17px' : '-11px'}; }`,
            `${bubble}::after { content: ''; position: absolute; ${legacy ? 'top: -13px; right: -11px; left: auto; width: 29px; height: 27px;' : 'top: -8px; right: -7px; left: auto; width: 22px; height: 20px;'} background: url("assets/ui/chat-bubbles/${charmArt}.png") center / contain no-repeat; border: 0; transform: none; pointer-events: none; }`,
            `${mine}::after { right: auto; left: ${legacy ? '-11px' : '-7px'}; }`,
            `${legacyMeta ? '.msg-bubble' : bubble} .msg-meta { color: ${ink === '#fffafc' ? 'rgba(255,250,252,0.78)' : 'rgba(79,68,78,0.56)'}; }`
        ].join('\n')
    };
}

const KAWAII_BUBBLE_DESIGNS = [
    { id: 'kawaii-kitten', name: '粉爪小猫', paper: 'linear-gradient(180deg, #fffefd, #fff3f8)', reply: 'linear-gradient(180deg, #fff8fb, #ffeef5)', ink: '#40383e', edge: '#6d6268', inner: '#eabdd0', shadow: '#fff9fc', mainArt: 'kitten-paw', charmArt: 'paw-charm' },
    { id: 'kawaii-paw', name: '奶霜猫爪', paper: 'linear-gradient(180deg, #fffdf9, #fff4ec)', reply: 'linear-gradient(180deg, #fff9f4, #ffece7)', ink: '#514144', edge: '#9e7778', inner: '#efc9c4', shadow: '#fffaf5', mainArt: 'paw-charm', charmArt: 'kitten-paw' },
    { id: 'kawaii-bat', name: '甜酷小恶魔', paper: 'linear-gradient(180deg, #fffbff, #fff0f9)', reply: 'linear-gradient(180deg, #fff5fc, #f5eafd)', ink: '#49404c', edge: '#625564', inner: '#dcb2d4', shadow: '#fff9fe', mainArt: 'bat-kitten', charmArt: 'bat-heart', stitched: true },
    { id: 'kawaii-midnight', name: '午夜蝙蝠糖', paper: 'linear-gradient(180deg, #59535f, #49434f)', reply: 'linear-gradient(180deg, #5e4b60, #493e4d)', ink: '#fffafc', edge: '#eed9e9', inner: '#e1b9d6', shadow: '#4c4552', mainArt: 'bat-heart', charmArt: 'bat-kitten', stitched: true }
];

const BUBBLE_CSS_PRESETS = [
    { id: 'default', name: '默认', css: '' },
    ...KAWAII_BUBBLE_DESIGNS.map(design => createKawaiiBubblePreset(design)),
    { id: 'blue-pink', name: '蓝粉长条', css: '.msg-bubble { background: #CDECFF; color: #333; border-radius: 18px 18px 18px 6px; }\n.msg-bubble.green { background: #FFD2DD; color: #333; border-radius: 18px 18px 6px 18px; }' },
    { id: 'telegram', name: 'TG 清透', css: '.msg-bubble { background: #E8F2FF; color: #17212b; border-radius: 18px 18px 18px 7px; box-shadow: 0 1px 2px rgba(23,33,43,0.08); }\n.msg-bubble.green { background: #DDF7C8; color: #17212b; border-radius: 18px 18px 7px 18px; box-shadow: 0 1px 2px rgba(23,33,43,0.08); }\n.msg-meta { color: rgba(23,33,43,0.46); }' },
    { id: 'blue-white-chat', name: '蓝白轻聊', css: '.msg-bubble { background: #FFFFFF; color: #182334; border: 1px solid rgba(15,23,42,0.045); border-radius: 15px 15px 15px 5px; box-shadow: 0 1px 3px rgba(15,23,42,0.075); padding: 7px 10px 5px 12px; font-weight: 650; }\n.msg-bubble.green { background: #D8ECFF; color: #101927; border: 1px solid rgba(99,154,214,0.12); border-radius: 10px 10px 4px 10px; box-shadow: 0 1px 3px rgba(75,132,190,0.10); padding: 7px 10px 5px 12px; font-weight: 650; }\n.msg-meta { color: rgba(79,91,107,0.56); font-weight: 500; }\n.msg-bubble.green .msg-meta { color: rgba(55,86,126,0.62); }' },
    { id: 'kakao-yellow', name: '黄白轻语', css: '.wc-room-content { background: #AFC2CF; }\n.wcs-bubble-preview { background: #AFC2CF; }\n.msg-bubble { background: #FFFFFF; color: #1F2933; border: 1px solid rgba(49,70,86,0.045); border-radius: 13px 13px 13px 4px; box-shadow: 0 1px 2px rgba(31,49,66,0.08); padding: 7px 10px 5px 11px; font-weight: 650; }\n.msg-bubble.green { background: #FFE100; color: #1B1B18; border: 1px solid rgba(154,128,0,0.10); border-radius: 12px 12px 4px 12px; box-shadow: 0 1px 2px rgba(85,78,24,0.10); padding: 7px 10px 5px 11px; font-weight: 650; }\n.msg-meta { color: rgba(45,61,74,0.62); font-weight: 520; }\n.msg-bubble.green .msg-meta { color: rgba(54,50,20,0.56); }' },
    { id: 'imessage', name: 'iMessage', css: '.msg-bubble { background: #E9EAEE; color: #101418; border-radius: 19px 19px 19px 7px; box-shadow: none; }\n.msg-bubble.green { background: #1688FF; color: #fff; border-radius: 19px 19px 7px 19px; box-shadow: none; }\n.msg-bubble.green .msg-meta { color: rgba(255,255,255,0.74); }' },
    { id: 'soft-paper', name: '柔纸', css: '.msg-bubble { background: #FFF7E8; color: #34251B; border: 1px solid rgba(160,118,75,0.18); border-radius: 16px 16px 16px 6px; box-shadow: 0 2px 8px rgba(94,65,39,0.07); }\n.msg-bubble.green { background: #E7F5EF; color: #20362C; border-color: rgba(70,130,103,0.18); border-radius: 16px 16px 6px 16px; }' },
    { id: 'strawberry', name: '草莓布丁', css: '.msg-bubble { color: #C75C83; background: #FDECF2; border: 2px dashed #F6A4C1; box-shadow: 0 3px 6px rgba(220,150,180,0.2); border-radius: 20px 20px 20px 8px; text-shadow: none; }\n.msg-bubble.green { color: #C75C83; background: #FDECF2; border: 2px dashed #F6A4C1; box-shadow: 0 3px 6px rgba(220,150,180,0.2); border-radius: 20px 20px 8px 20px; }' }
];
const KAWAII_BUBBLE_LEGACY_CSS = KAWAII_BUBBLE_DESIGNS.flatMap(design => [
    createKawaiiBubblePreset(design, { legacy: true }),
    createKawaiiBubblePreset(design, { legacy: true, legacyMeta: true })
]);

function normalizeBubblePresetCss(css) {
    return String(css || '').replace(/\s+/g, '');
}

function getActiveKawaiiBubblePreset(config) {
    const selected = KAWAII_BUBBLE_DESIGNS.find(design => design.id === config?.bubblePresetId);
    if (selected) return BUBBLE_CSS_PRESETS.find(preset => preset.id === selected.id);
    const css = normalizeBubblePresetCss(config?.customCss);
    if (!css) return null;
    const matched = [...BUBBLE_CSS_PRESETS, ...KAWAII_BUBBLE_LEGACY_CSS]
        .find(preset => preset.id.startsWith('kawaii-') && normalizeBubblePresetCss(preset.css) === css);
    return matched ? BUBBLE_CSS_PRESETS.find(preset => preset.id === matched.id) : null;
}

function getEffectiveBubbleCss(config) {
    return getActiveKawaiiBubblePreset(config)?.css || config?.customCss || '';
}

const BUBBLE_PRESETS_KEY = 'my_bubble_presets';

function getUserBubblePresets() {
    try {
        const raw = localStorage.getItem(BUBBLE_PRESETS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
}

function saveUserBubblePresets(list) {
    localStorage.setItem(BUBBLE_PRESETS_KEY, JSON.stringify(list));
}

function getAllBubblePresets() {
    return [...BUBBLE_CSS_PRESETS, ...getUserBubblePresets()];
}

function renderBubblePresetDropdown(selectedCss) {
    const sel = document.getElementById('wcs-bubble-preset');
    if (!sel) return;
    const all = getAllBubblePresets();
    sel.innerHTML = all.map(p =>
        `<option value="${p.id}">${p.name}</option>`
    ).join('');
    // 找到匹配当前CSS的预设
    const match = all.find(p => p.css.replace(/\s+/g, '') === (selectedCss || '').replace(/\s+/g, ''));
    sel.value = match ? match.id : 'default';
    renderBubblePresetPicker(all, sel.value);
}

function getBubblePresetSwatchFills(css, defaults = getWechatDefaultBubbleAppearance().map(side => side.background)) {
    if (!css) return defaults;
    // Parse declarations without applying this preset to the page being edited.
    const style = document.createElement('style');
    style.media = 'not all';
    style.textContent = css;
    document.head.append(style);
    const sides = [document.createElement('span').style, document.createElement('span').style];
    try {
        for (const rule of style.sheet?.cssRules || []) {
            if (!rule.selectorText || !rule.style) continue;
            for (const selector of rule.selectorText.split(',')) {
                if (!/\.msg-bubble(?:\.[\w-]+)*$/.test(selector.trim())) continue;
                const targets = selector.includes('.green') ? [sides[1]] : sides;
                targets.forEach(side => { side.cssText += rule.style.cssText; });
            }
        }
        return sides.map((side, index) => side.background || side.backgroundColor || defaults[index]);
    } finally { style.remove(); }
}

function renderBubblePresetPicker(all, selectedId) {
    const label = document.getElementById('wcs-bubble-preset-label');
    const menu = document.getElementById('wcs-bubble-preset-menu');
    if (!label || !menu) return;
    const selected = all.find(p => p.id === selectedId) || all[0];
    label.textContent = selected ? selected.name : '默认';
    menu.innerHTML = all.map(p => `
        <button type="button" class="wcs-bubble-option ${p.id === selectedId ? 'active' : ''}" data-preset-id="${wcEscapeHtml(p.id)}">
            <span class="wcs-bubble-option-swatch" aria-hidden="true"><i></i><i></i></span>
            <span class="wcs-bubble-option-name">${wcEscapeHtml(p.name)}</span>
            ${p.id === selectedId ? '<i class="ri-check-line"></i>' : ''}
        </button>
    `).join('');
    const defaults = getWechatDefaultBubbleAppearance().map(side => side.background);
    menu.querySelectorAll('.wcs-bubble-option').forEach(btn => {
        const preset = all.find(p => p.id === btn.dataset.presetId);
        const fills = getBubblePresetSwatchFills(preset?.css || '', defaults);
        btn.querySelectorAll('.wcs-bubble-option-swatch > i').forEach((side, index) => { side.style.background = fills[index]; });
        btn.onclick = () => chooseBubblePreset(btn.dataset.presetId || 'default');
    });
}

function positionBubblePresetMenu() {
    const wrap = document.querySelector('.wcs-bubble-preset-wrap.open');
    const menu = wrap?.querySelector('.wcs-bubble-menu');
    const body = wrap?.closest('.wcs-body');
    if (!menu || !body) return;
    const trigger = wrap.getBoundingClientRect();
    const bounds = body.getBoundingClientRect();
    const below = Math.max(0, bounds.bottom - trigger.bottom - 10);
    const above = Math.max(0, trigger.top - bounds.top - 10);
    const upward = below < Math.min(270, menu.scrollHeight) && above > below;
    wrap.classList.toggle('opens-up', upward);
    menu.style.maxHeight = `${Math.min(270, upward ? above : below)}px`;
}

function toggleBubblePresetPicker(event) {
    if (event) event.stopPropagation();
    const wrap = document.querySelector('.wcs-bubble-preset-wrap');
    if (!wrap) return;
    const open = wrap.classList.toggle('open');
    wrap.closest('.wcs-section')?.classList.toggle('wcs-bubble-menu-open', open);
    if (open) {
        positionBubblePresetMenu();
        const body = wrap.closest('.wcs-body');
        if (body && !body.dataset.bubbleMenuPositionBound) {
            body.addEventListener('scroll', positionBubblePresetMenu, { passive: true });
            body.dataset.bubbleMenuPositionBound = 'true';
        }
    }
}

function closeBubblePresetPicker() {
    const wrap = document.querySelector('.wcs-bubble-preset-wrap');
    if (wrap) {
        wrap.classList.remove('open');
        wrap.closest('.wcs-section')?.classList.remove('wcs-bubble-menu-open');
    }
}

function chooseBubblePreset(presetId) {
    const sel = document.getElementById('wcs-bubble-preset');
    if (sel) sel.value = presetId;
    applyBubblePreset(presetId);
    closeBubblePresetPicker();
}

function applyBubblePreset(presetId) {
    const all = getAllBubblePresets();
    const preset = all.find(p => p.id === presetId);
    if (!preset) return;
    const textarea = document.getElementById('wcs-custom-css');
    if (textarea) {
        textarea.value = preset.css;
        previewBubbleCss(preset.css);
    }
    const sel = document.getElementById('wcs-bubble-preset');
    if (sel) sel.value = preset.id;
    renderBubblePresetPicker(all, preset.id);
}

function saveCurrentCssAsPreset() {
    const textarea = document.getElementById('wcs-custom-css');
    if (!textarea || !textarea.value.trim()) {
        alert('请先在下面的编辑框中输入CSS样式');
        return;
    }
    const name = prompt('给这个气泡样式起个名字：');
    if (!name || !name.trim()) return;
    const presets = getUserBubblePresets();
    const newPreset = {
        id: 'bp_' + Date.now(),
        name: name.trim(),
        css: textarea.value.trim()
    };
    presets.push(newPreset);
    saveUserBubblePresets(presets);
    renderBubblePresetDropdown(newPreset.css);
    const sel = document.getElementById('wcs-bubble-preset');
    if (sel) sel.value = newPreset.id;
}

function deleteSelectedPreset() {
    const sel = document.getElementById('wcs-bubble-preset');
    if (!sel) return;
    const id = sel.value;
    if (BUBBLE_CSS_PRESETS.find(p => p.id === id)) {
        alert('内置预设不能删除哦～');
        return;
    }
    const presets = getUserBubblePresets();
    const idx = presets.findIndex(p => p.id === id);
    if (idx === -1) return;
    if (!confirm(`确定删除预设「${presets[idx].name}」吗？`)) return;
    presets.splice(idx, 1);
    saveUserBubblePresets(presets);
    document.getElementById('wcs-custom-css').value = '';
    previewBubbleCss('');
    renderBubblePresetDropdown('');
}

function clearBubbleCssPreset() {
    const textarea = document.getElementById('wcs-custom-css');
    if (textarea) textarea.value = '';
    previewBubbleCss('');
    renderBubblePresetDropdown('');
}

document.addEventListener('click', event => {
    if (!event.target.closest('.wcs-bubble-preset-wrap')) closeBubblePresetPicker();
});
window.addEventListener('resize', positionBubblePresetMenu);

