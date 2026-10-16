(function (H) {
    'use strict';
    let root = null, active = false, style = 'all', category = '全部', roomId = '', charId = '', drag = null;
    const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const btn = (action, text, extra = '') => '<button type="button" data-action="build-' + action + '" ' + extra + '>' + text + '</button>';
    function thumb(item) { return '<img data-preview="' + item.id + '" alt="" draggable="false"><small class="home3d-preview-fallback">预览暂不可用</small>'; }
    function render() {
        const tray = root?.querySelector('.home3d-build-tray'); if (!tray) return;
        const items = H.catalogs.furnitureCatalog.items.map(raw => H.Furniture.get(raw.id)).filter(item => (style === 'all' || item.style === style) && (category === '全部' || item.category === category) && item.type !== 'prop');
        const placed = H.Rooms.placements(H.Rooms.get(roomId), H.State.home());
        const icons = {'全部':'ri-home-heart-line','床':'ri-hotel-bed-line','沙发':'ri-sofa-line','桌椅':'ri-book-open-line','灯':'ri-sparkling-line','装饰':'ri-plant-line','收纳':'ri-gift-line','生活设施':'ri-settings-4-line'};
        tray.innerHTML = '<div class="home3d-build-head"><label><select data-build-style aria-label="家具风格"><option value="all" ' + (style === 'all' ? 'selected' : '') + '>全部风格</option>' + Object.entries(H.catalogs.furnitureCatalog.styles).map(([id, s]) => '<option value="' + id + '" ' + (id === style ? 'selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></label>' + btn('interiors', '全屋风格', 'class="home3d-interior-entry"') + btn('rooms', H.Icons.paint('ri-add-line'), 'aria-label="扩建房间"') + btn('done', '完成') + '</div><nav class="home3d-build-categories" aria-label="家具分类">' + Object.keys(icons).map(c => btn('category', H.Icons.paint(icons[c]) + '<span>' + c + '</span>', 'data-category="' + c + '" aria-pressed="' + (c === category) + '"')).join('') + '</nav><div class="home3d-build-catalog">' + items.map(item => btn('item', '<div class="home3d-build-preview">' + thumb(item) + '</div><span>' + esc(item.name.split(' · ').at(-1)) + '</span><small class="home3d-build-count">' + placed.filter(p => p.furnitureId === item.id).length + ' 件已摆放</small>', 'data-furniture="' + item.id + '" aria-label="添加' + esc(item.name) + '"')).join('') + '</div><div class="home3d-build-selection" hidden></div><details class="home3d-build-help"><summary>摆放帮助</summary><p>左右滑动选家具，点击或向上拖进房间。点已有家具可以移动；旋转后确认保存。粉色位置需要调整，绿色可以摆放。移动桌柜会一起带走上面的物品。</p></details>';
        if (!items.length) tray.insertAdjacentHTML('beforeend', '<p class="home3d-build-empty">这个风格下暂时没有这类家具，换个风格或分类看看。</p>');
        H.FurniturePreviews.fill(tray, items);
        changed(H.runtime?.draft());
    }
    function changed(draft) {
        const box = root?.querySelector('.home3d-build-selection'); if (!box) return;
        root.classList.toggle('has-build-draft', !!draft);
        box.hidden = !draft; if (!draft) { box.dataset.id = ''; return; }
        if (box.dataset.id === draft.id) { box.querySelector('[data-build-valid]').textContent = hint(draft); return; }
        box.dataset.id = draft.id;
        box.innerHTML = '<div><strong>' + esc(name(draft.furnitureId)) + '</strong><span data-build-valid>' + esc(hint(draft)) + '</span></div><div class="home3d-build-controls">' + btn('rotate', '旋转 ↻', 'aria-label="旋转家具90度"') + btn('nudge', '←', 'data-dx="-0.2" data-dz="0" aria-label="向左移动家具"') + btn('nudge', '↑', 'data-dx="0" data-dz="-0.2" aria-label="向后移动家具"') + btn('nudge', '↓', 'data-dx="0" data-dz="0.2" aria-label="向前移动家具"') + btn('nudge', '→', 'data-dx="0.2" data-dz="0" aria-label="向右移动家具"') + '</div><div class="home3d-build-confirm">' + btn('cancel', '取消') + (H.runtime.furniture().some(row => row.placement.id === draft.id) ? btn('remove', '移除家具') : '') + btn('confirm', '确认摆放') + '</div>';
    }
    const name = id => H.Build.label ? H.Build.label(H.Furniture.get(id)) : H.Furniture.get(id).name;
    // During a drag only the reason is shown; "not saved" belongs to confirm.
    const hint = draft => draft.error ? '这里放不下：' + String(draft.error).replace(/^这里放不下[:：]\s*/, '') : '拖动调整位置，确认后保存';
    function area(id) { if (active && id) { roomId = id; render(); } }
    function open(element) {
        if (!H.runtime || active) return;
        root = element; active = true; roomId = H.State.home().room; charId = H.State.load().activeCharId;
        root.classList.add('is-building'); H.runtime.setBuild(true); render();
        root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move); root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up); root.addEventListener('keydown', key);
    }
    function close() {
        active = false; drag = null; H.FurniturePreviews.close(); root?.classList.remove('is-building', 'has-build-draft'); H.runtime?.setBuild(false);
        root?.removeEventListener('pointerdown', down); root?.removeEventListener('pointermove', move); root?.removeEventListener('pointerup', up); root?.removeEventListener('pointercancel', up); root?.removeEventListener('keydown', key); root = null;
    }
    async function choose(id) {
        if (!active) return;
        const draft = { id: 'placed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), furnitureId: id, position: [0, 0, 1.4], rotation: 0 };
        // Spawn on the nearest free, valid spot around the camera centre instead of a fixed point.
        try {
            const c = H.runtime.viewCenter?.(), spot = H.Build.findSpot?.(H.Rooms.get(roomId), H.State.home(), draft, c ? [c.x, 0, c.z] : draft.position);
            if (spot) draft.position = spot.position || spot;
        } catch (_) {}
        await H.runtime.beginDraft(draft);
    }
    async function edit(id) {
        const row = H.runtime?.furniture().find(row => row.placement.id === id);
        if (active && row) await H.runtime.beginDraft(row.placement);
    }
    function down(event) {
        const card = event.target.closest('[data-furniture]'); if (!active || !card || event.isPrimary === false) return;
        drag = { id: event.pointerId, card, x: event.clientX, y: event.clientY, started: false };
    }
    function move(event) {
        if (drag?.id !== event.pointerId) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.started && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { drag = null; return; }
        if (!drag.started && Math.abs(dy) > 12) {
            event.preventDefault(); drag.started = true; drag.card.setPointerCapture(event.pointerId);
            drag.ready = choose(drag.card.dataset.furniture).catch(error => H.UI.notice(error.message, true));
        }
        if (drag?.started) { const pending = drag; pending.point = [event.clientX, event.clientY]; pending.ready.then(() => H.runtime?.moveDraft(...pending.point)); }
    }
    function up(event) {
        if (drag?.id !== event.pointerId) return;
        const pending = drag; drag = null;
        if (pending.started) { pending.point = [event.clientX, event.clientY]; pending.ready.then(() => H.runtime?.moveDraft(...pending.point)); }
    }
    function key(event) {
        if (!H.runtime?.draft() || event.target.matches('input,select,textarea')) return;
        const arrows = { ArrowLeft: [-.2, 0], ArrowRight: [.2, 0], ArrowUp: [0, -.2], ArrowDown: [0, .2] };
        if (arrows[event.key]) { event.preventDefault(); event.stopPropagation(); H.runtime.nudgeDraft(...arrows[event.key], true); }
        if (event.key.toLowerCase() === 'r') { event.preventDefault(); H.runtime.rotateDraft(); }
        if (event.key === 'Escape') { H.runtime.clearDraft(); changed(null); }
    }
    async function action(name, target) {
        if (name === 'build-interiors') { H.UI.showInteriors(); return; }
        if (name === 'build-done') { close(); H.UI.refreshLife(); return; }
        if (name === 'build-rooms') { H.UI.showExpansion(); return; }
        if (name === 'build-category') { category = target.dataset.category; render(); return; }
        if (name === 'build-item') { if (H.runtime.draft()?.furnitureId !== target.dataset.furniture) await choose(target.dataset.furniture); return; }
        if (name === 'build-rotate') { H.runtime.rotateDraft(); return; }
        if (name === 'build-nudge') { H.runtime.nudgeDraft(Number(target.dataset.dx), Number(target.dataset.dz), true); return; }
        if (name === 'build-cancel') { H.runtime.clearDraft(); changed(null); return; }
        const draft = H.runtime.draft(); if (!draft) return;
        if (name === 'build-confirm') H.Build.commit(roomId, draft, charId);
        else if (name === 'build-remove') H.Build.remove(roomId, draft.id);
        else return;
        H.runtime.clearDraft(); changed(null);
        // Only this room's changed furniture is swapped in; camera and actions stay put.
        try { if (!H.runtime.syncArea || (await H.runtime.syncArea(roomId)) === false) { await H.UI.loadRoom(roomId); H.runtime.setBuild(true); } }
        catch (error) { H.UI.notice(error.message, true); }
        H.UI.notice(name === 'build-confirm' ? '家具摆好了，Ta会用上这个新位置。' : '家具已移除。');
    }
    function change(target) { if (target.matches('[data-build-style]')) { style = target.value; render(); return true; } return false; }
    H.BuildUI = { open, close, edit, changed, action, change, area, active: () => active };
})(window.ByndHome3D);
