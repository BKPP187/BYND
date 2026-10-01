(function (H) {
    'use strict';
    let root = null, active = false, style = 'cream', category = '床', roomId = '', charId = '', drag = null;
    const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const btn = (action, text, extra = '') => '<button type="button" data-action="build-' + action + '" ' + extra + '>' + text + '</button>';
    function thumb(item) {
        const s = H.catalogs.furnitureCatalog.styles[item.style] || H.catalogs.furnitureCatalog.styles.cream;
        const rect = (x, y, w, h, fill, r = 4) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
        const line = (a, b, c, d) => `<path d="M${a} ${b}L${c} ${d}" fill="none"/>`;
        let draw = '';
        if (item.type === 'bed') draw = rect(12, 18, 56, 24, s.wood) + rect(12, 36, 56, 26, s.fabric) + rect(18, 28, 19, 13, '#fffcf1') + rect(43, 28, 19, 13, '#fffcf1') + line(17, 62, 17, 67) + line(63, 62, 63, 67) + (item.style === 'chinese' ? line(9, 8, 9, 61) + line(71, 8, 71, 61) + line(9, 8, 71, 8) : '');
        else if (['sofa', 'chair'].includes(item.type)) draw = rect(15, 23, 50, 28, s.fabric) + rect(10, 41, 60, 18, s.fabric) + rect(10, 36, 10, 22, s.accent) + rect(60, 36, 10, 22, s.accent) + line(18, 59, 18, 65) + line(62, 59, 62, 65) + rect(27, 31, 14, 14, s.accent);
        else if (['desk', 'table', 'stove'].includes(item.type)) draw = rect(10, 33, 60, 9, s.wood) + rect(16, 42, 5, 23, s.wood) + rect(59, 42, 5, 23, s.wood) + (item.type === 'desk' ? rect(48, 43, 16, 15, s.fabric) + rect(21, 26, 17, 6, s.accent) : rect(29, 23, 12, 10, s.fabric));
        else if (item.type === 'plant') draw = rect(25, 47, 30, 20, s.fabric) + line(40, 48, 40, 21) + '<ellipse cx="31" cy="27" rx="13" ry="8" fill="' + s.accent + '"/><ellipse cx="49" cy="39" rx="13" ry="8" fill="' + s.accent + '"/>';
        else if (item.type === 'lamp') draw = rect(35, 28, 7, 36, s.wood) + rect(23, 61, 32, 6, s.wood) + '<path d="M19 32Q19 9 40 9Q61 9 61 32Z" fill="' + s.fabric + '"/>';
        else if (item.type === 'tub') draw = rect(9, 33, 62, 28, s.fabric, 13) + rect(9, 31, 62, 8, '#fffaf0') + line(16, 30, 16, 20) + line(16, 20, 25, 20);
        else if (item.type === 'piano') draw = rect(10, 17, 60, 37, s.accent) + rect(10, 38, 60, 10, '#fffaf0') + [18, 26, 38, 46, 58].map(x => rect(x, 38, 4, 6, s.wood, 0)).join('') + line(15, 54, 15, 66) + line(65, 54, 65, 66);
        else draw = rect(17, 16, 46, 47, s.wood) + rect(21, 21, 18, 35, s.fabric) + rect(41, 21, 18, 35, s.fabric) + line(34, 39, 35, 39) + line(45, 39, 46, 39);
        return '<svg viewBox="0 0 80 80" aria-hidden="true" stroke="#715d50" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + draw + '</svg>';
    }
    function render() {
        const tray = root?.querySelector('.home3d-build-tray'); if (!tray) return;
        const items = H.catalogs.furnitureCatalog.items.map(raw => H.Furniture.get(raw.id)).filter(item => item.style === style && item.category === category && item.type !== 'prop');
        tray.innerHTML = '<div class="home3d-build-head"><strong>布置我们的家</strong>' + btn('rooms', '扩建房间') + btn('done', '完成装修') + '</div><div class="home3d-build-filter"><label>风格<select data-build-style aria-label="家具风格">' + Object.entries(H.catalogs.furnitureCatalog.styles).map(([id, s]) => '<option value="' + id + '" ' + (id === style ? 'selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></label><span>拖出家具，放在空地上</span></div><nav class="home3d-build-categories" aria-label="家具分类">' + ['床', '沙发', '桌椅', '灯', '装饰', '收纳', '生活设施'].map(c => btn('category', c, 'data-category="' + c + '" aria-pressed="' + (c === category) + '"')).join('') + '</nav><div class="home3d-build-catalog">' + items.map(item => btn('item', thumb(item) + '<span>' + esc(item.name.split(' · ').at(-1)) + '</span>', 'data-furniture="' + item.id + '" aria-label="添加' + esc(item.name) + '"')).join('') + '</div><div class="home3d-build-selection" hidden></div><details class="home3d-build-help"><summary>怎么装修？</summary><p>从家具栏拖到房间，或点击后点空地摆放。点已有家具可以移动；旋转后确认才保存。粉色位置需要调整，绿色可以摆放。移动桌柜会一起带走上面的物品。装修时，Ta会等你布置好。</p></details>';
        changed(H.runtime?.draft());
    }
    function changed(draft) {
        const box = root?.querySelector('.home3d-build-selection'); if (!box) return;
        root.classList.toggle('has-build-draft', !!draft);
        box.hidden = !draft; if (!draft) { box.dataset.id = ''; return; }
        if (box.dataset.id === draft.id) { box.querySelector('[data-build-valid]').textContent = draft.error || '拖动调整位置，确认后保存'; return; }
        box.dataset.id = draft.id;
        box.innerHTML = '<div><strong>' + esc(H.Furniture.get(draft.furnitureId).name) + '</strong><span data-build-valid>' + esc(draft.error || '拖动调整位置，确认后保存') + '</span></div><div class="home3d-build-controls">' + btn('rotate', '旋转 ↻', 'aria-label="旋转家具90度"') + btn('nudge', '←', 'data-dx="-0.2" data-dz="0" aria-label="向左移动家具"') + btn('nudge', '↑', 'data-dx="0" data-dz="-0.2" aria-label="向后移动家具"') + btn('nudge', '↓', 'data-dx="0" data-dz="0.2" aria-label="向前移动家具"') + btn('nudge', '→', 'data-dx="0.2" data-dz="0" aria-label="向右移动家具"') + '</div><div class="home3d-build-confirm">' + btn('cancel', '取消') + (H.runtime.furniture().some(row => row.placement.id === draft.id) ? btn('remove', '收起家具') : '') + btn('confirm', '确认摆放') + '</div>';
    }
    function open(element) {
        if (!H.runtime || active) return;
        root = element; active = true; roomId = H.State.home().room; charId = H.State.load().activeCharId;
        root.classList.add('is-building'); H.runtime.setBuild(true); render();
        root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move); root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up); root.addEventListener('keydown', key);
    }
    function close() {
        active = false; drag = null; root?.classList.remove('is-building', 'has-build-draft'); H.runtime?.setBuild(false);
        root?.removeEventListener('pointerdown', down); root?.removeEventListener('pointermove', move); root?.removeEventListener('pointerup', up); root?.removeEventListener('pointercancel', up); root?.removeEventListener('keydown', key); root = null;
    }
    async function choose(id) {
        if (!active) return;
        await H.runtime.beginDraft({ id: 'placed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), furnitureId: id, position: [0, 0, 1.4], rotation: 0 });
    }
    async function edit(id) {
        const row = H.runtime?.furniture().find(row => row.placement.id === id);
        if (active && row) await H.runtime.beginDraft(row.placement);
    }
    function down(event) {
        const card = event.target.closest('[data-furniture]'); if (!active || !card || event.isPrimary === false) return;
        event.preventDefault(); drag = { id: event.pointerId, card }; card.setPointerCapture(event.pointerId);
        choose(card.dataset.furniture).catch(error => H.UI.notice(error.message, true));
    }
    function move(event) { if (drag?.id === event.pointerId) H.runtime?.moveDraft(event.clientX, event.clientY); }
    function up(event) { if (drag?.id === event.pointerId) { H.runtime?.moveDraft(event.clientX, event.clientY); drag = null; } }
    function key(event) {
        if (!H.runtime?.draft() || event.target.matches('input,select,textarea')) return;
        const arrows = { ArrowLeft: [-.2, 0], ArrowRight: [.2, 0], ArrowUp: [0, -.2], ArrowDown: [0, .2] };
        if (arrows[event.key]) { event.preventDefault(); event.stopPropagation(); H.runtime.nudgeDraft(...arrows[event.key]); }
        if (event.key.toLowerCase() === 'r') { event.preventDefault(); H.runtime.rotateDraft(); }
        if (event.key === 'Escape') { H.runtime.clearDraft(); changed(null); }
    }
    async function action(name, target) {
        if (name === 'build-done') { close(); H.UI.refreshLife(); return; }
        if (name === 'build-rooms') { H.UI.showExpansion(); return; }
        if (name === 'build-category') { category = target.dataset.category; render(); return; }
        if (name === 'build-item') { if (H.runtime.draft()?.furnitureId !== target.dataset.furniture) await choose(target.dataset.furniture); return; }
        if (name === 'build-rotate') { H.runtime.rotateDraft(); return; }
        if (name === 'build-nudge') { H.runtime.nudgeDraft(Number(target.dataset.dx), Number(target.dataset.dz)); return; }
        if (name === 'build-cancel') { H.runtime.clearDraft(); changed(null); return; }
        const draft = H.runtime.draft(); if (!draft) return;
        if (name === 'build-confirm') H.Build.commit(roomId, draft, charId);
        else if (name === 'build-remove') H.Build.remove(roomId, draft.id);
        else return;
        H.runtime.clearDraft(); changed(null); await H.UI.loadRoom(roomId); H.runtime.setBuild(true);
        H.UI.notice(name === 'build-confirm' ? '家具摆好了，Ta会用上这个新位置。' : '家具已收起。');
    }
    function change(target) { if (target.matches('[data-build-style]')) { style = target.value; render(); return true; } return false; }
    H.BuildUI = { open, close, edit, changed, action, change, active: () => active };
})(window.ByndHome3D);
