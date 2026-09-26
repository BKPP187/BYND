// --- 气泡CSS预设系统 ---
const BUBBLE_CSS_PRESETS = [
    { id: 'default', name: '默认', css: '' },
    { id: 'blue-pink', name: '蓝粉长条', css: '.msg-bubble { background: #CDECFF; color: #333; border-radius: 18px 18px 18px 6px; }\n.msg-bubble.green { background: #FFD2DD; color: #333; border-radius: 18px 18px 6px 18px; }' },
    { id: 'telegram', name: 'TG 清透', css: '.msg-bubble { background: #E8F2FF; color: #17212b; border-radius: 18px 18px 18px 7px; box-shadow: 0 1px 2px rgba(23,33,43,0.08); }\n.msg-bubble.green { background: #DDF7C8; color: #17212b; border-radius: 18px 18px 7px 18px; box-shadow: 0 1px 2px rgba(23,33,43,0.08); }\n.msg-meta { color: rgba(23,33,43,0.46); }' },
    { id: 'blue-white-chat', name: '蓝白轻聊', css: '.msg-bubble { background: #FFFFFF; color: #182334; border: 1px solid rgba(15,23,42,0.045); border-radius: 15px 15px 15px 5px; box-shadow: 0 1px 3px rgba(15,23,42,0.075); padding: 7px 10px 5px 12px; font-weight: 650; }\n.msg-bubble.green { background: #D8ECFF; color: #101927; border: 1px solid rgba(99,154,214,0.12); border-radius: 10px 10px 4px 10px; box-shadow: 0 1px 3px rgba(75,132,190,0.10); padding: 7px 10px 5px 12px; font-weight: 650; }\n.msg-meta { color: rgba(79,91,107,0.56); font-weight: 500; }\n.msg-bubble.green .msg-meta { color: rgba(55,86,126,0.62); }' },
    { id: 'kakao-yellow', name: '黄白轻语', css: '.wc-room-content { background: #AFC2CF; }\n.wcs-bubble-preview { background: #AFC2CF; }\n.msg-bubble { background: #FFFFFF; color: #1F2933; border: 1px solid rgba(49,70,86,0.045); border-radius: 13px 13px 13px 4px; box-shadow: 0 1px 2px rgba(31,49,66,0.08); padding: 7px 10px 5px 11px; font-weight: 650; }\n.msg-bubble.green { background: #FFE100; color: #1B1B18; border: 1px solid rgba(154,128,0,0.10); border-radius: 12px 12px 4px 12px; box-shadow: 0 1px 2px rgba(85,78,24,0.10); padding: 7px 10px 5px 11px; font-weight: 650; }\n.msg-meta { color: rgba(45,61,74,0.62); font-weight: 520; }\n.msg-bubble.green .msg-meta { color: rgba(54,50,20,0.56); }' },
    { id: 'imessage', name: 'iMessage', css: '.msg-bubble { background: #E9EAEE; color: #101418; border-radius: 19px 19px 19px 7px; box-shadow: none; }\n.msg-bubble.green { background: #1688FF; color: #fff; border-radius: 19px 19px 7px 19px; box-shadow: none; }\n.msg-bubble.green .msg-meta { color: rgba(255,255,255,0.74); }' },
    { id: 'soft-paper', name: '柔纸', css: '.msg-bubble { background: #FFF7E8; color: #34251B; border: 1px solid rgba(160,118,75,0.18); border-radius: 16px 16px 16px 6px; box-shadow: 0 2px 8px rgba(94,65,39,0.07); }\n.msg-bubble.green { background: #E7F5EF; color: #20362C; border-color: rgba(70,130,103,0.18); border-radius: 16px 16px 6px 16px; }' },
    { id: 'strawberry', name: '草莓布丁', css: '.msg-bubble { color: #C75C83; background: #FDECF2; border: 2px dashed #F6A4C1; box-shadow: 0 3px 6px rgba(220,150,180,0.2); border-radius: 20px 20px 20px 8px; text-shadow: none; }\n.msg-bubble.green { color: #C75C83; background: #FDECF2; border: 2px dashed #F6A4C1; box-shadow: 0 3px 6px rgba(220,150,180,0.2); border-radius: 20px 20px 8px 20px; }' }
];
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

function renderBubblePresetPicker(all, selectedId) {
    const label = document.getElementById('wcs-bubble-preset-label');
    const menu = document.getElementById('wcs-bubble-preset-menu');
    if (!label || !menu) return;
    const selected = all.find(p => p.id === selectedId) || all[0];
    label.textContent = selected ? selected.name : '默认';
    menu.innerHTML = all.map(p => `
        <button type="button" class="wcs-bubble-option ${p.id === selectedId ? 'active' : ''}" data-preset-id="${wcEscapeHtml(p.id)}">
            <span>${wcEscapeHtml(p.name)}</span>
            ${p.id === selectedId ? '<i class="ri-check-line"></i>' : ''}
        </button>
    `).join('');
    menu.querySelectorAll('.wcs-bubble-option').forEach(btn => {
        btn.onclick = () => chooseBubblePreset(btn.dataset.presetId || 'default');
    });
}

function toggleBubblePresetPicker(event) {
    if (event) event.stopPropagation();
    const wrap = document.querySelector('.wcs-bubble-preset-wrap');
    if (!wrap) return;
    wrap.classList.toggle('open');
}

function closeBubblePresetPicker() {
    const wrap = document.querySelector('.wcs-bubble-preset-wrap');
    if (wrap) wrap.classList.remove('open');
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

