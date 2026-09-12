// Read existing per-character PNG/GIF images from the backed-up asset store.
(() => {
    const C = window.ByndCharacterPet;
    const escape = value => wcEscapeHtml(String(value ?? ''));
    const root = () => document.getElementById('pet-history');
    let view = null;
    const alive = state => view === state && !!root() && (window.myCharacters || []).includes(state.char);
    const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '时间未记录';
    const size = value => value >= 1024 * 1024 ? (value / 1024 / 1024).toFixed(1) + ' MB' : value >= 1024 ? (value / 1024).toFixed(1) + ' KB' : value + ' B';
    const dimensions = row => row.width && row.height ? `${row.width} × ${row.height}` : '尺寸未记录';
    const source = row => ({ generated: 'AI 生成', 'generated-animation': 'AI 动作序列合成', 'background-removal': '去背景', upload: '上传图片' }[row.source]);
    const transparency = row => (row.transparent === true ? '透明 ' : row.transparent === false ? '带背景 ' : '') + row.format + (row.transparent == null ? ' · 透明度未记录' : '');
    function close(restoreFocus = true) {
        view = null;
        root()?.remove();
        const panel = document.querySelector('#bynd-pet-studio .pet-studio-panel');
        if (panel && !document.getElementById('pet-role-picker')) panel.inert = false;
        if (restoreFocus) document.querySelector('.pet-history-entry')?.focus({ preventScroll: true });
    }
    function focusFirst() { root()?.querySelector('.bynd-agent-header button')?.focus({ preventScroll: true }); }
    function trap(event) {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); view?.key ? back() : close(); }
        if (event.key !== 'Tab') return;
        const items = Array.from(root().querySelectorAll('button:not(:disabled), summary, [tabindex="0"]')).filter(item => item.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    async function open(char) {
        if (!char || !document.getElementById('bynd-pet-studio')) return;
        close(false);
        const overlay = document.createElement('section');
        overlay.id = 'pet-history'; overlay.className = 'pet-history';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'pet-history-title');
        overlay.addEventListener('keydown', trap);
        document.getElementById('bynd-pet-studio').appendChild(overlay);
        document.querySelector('#bynd-pet-studio .pet-studio-panel').inert = true;
        view = { char, rows: [], limit: 12, key: '', image: null, error: '', notice: '', loading: false, busy: false, confirm: false, listScroll: 0, revision: 0 };
        await reload();
    }
    async function reload() {
        const state = view;
        if (!state || state.loading || state.busy) return;
        state.loading = true; state.error = ''; state.notice = '';
        render(); focusFirst();
        try {
            const rows = await C.listAssets(state.char);
            if (!alive(state)) return;
            state.rows = rows;
        } catch (error) { if (alive(state)) state.error = C.clean(error.message, 300) || '图片历史读取失败，请重试。'; }
        finally { if (alive(state)) { state.loading = false; render(); focusFirst(); } }
    }
    function card(row) {
        const uses = C.assetUsage(row.key);
        return `<li class="pet-history-card"><button type="button" class="pet-history-view" data-pet-history-key="${escape(row.key)}" onclick="ByndPetHistory.detail(this.dataset.petHistoryKey)" aria-label="查看${escape(row.label)}，${escape(date(row.createdAt))}"><span class="pet-image"><img data-history-thumb="${escape(row.key)}" alt="${escape(row.label)}" loading="lazy" decoding="async"></span><span class="pet-history-caption"><strong>${escape(row.label)}</strong><small>${escape(date(row.createdAt))}</small><small>${dimensions(row)} · ${size(row.bytes)}</small><span class="pet-history-tag">${transparency(row)}</span>${uses.length ? '<span class="pet-history-used">使用中</span>' : ''}</span></button></li>`;
    }
    function detailContent(state) {
        const row = state.rows.find(item => item.key === state.key);
        if (!row || !state.image) return `<p class="pet-empty">${state.error ? '预览未能读取，请返回历史后刷新。' : '正在读取图片…'}</p>`;
        const uses = C.assetUsage(row.key);
        return `<div class="pet-history-detail"><div class="pet-image"><img src="${escape(state.image.url)}" alt="${escape(row.label)}"></div><h3>${escape(row.label)}</h3><dl><div><dt>时间</dt><dd>${escape(date(row.createdAt))}</dd></div><div><dt>尺寸</dt><dd>${dimensions(row)}</dd></div><div><dt>文件</dt><dd>${transparency(row)} · ${size(row.bytes)}</dd></div><div><dt>来源</dt><dd>${source(row)}</dd></div>${row.frames ? `<div><dt>动画</dt><dd>${row.frames} 帧 · ${(row.durationMs / 1000).toFixed(2)} 秒</dd></div>` : ''}</dl>${uses.length ? `<p class="pet-history-protected">用于${uses.map(use => escape(use.label)).join('、')}。先更换对应图片后，即可删除这张记录。</p>` : ''}${state.image.prompt ? `<details class="pet-details"><summary>查看生成提示词</summary><pre>${escape(state.image.prompt)}</pre></details>` : ''}<div class="pet-actions"><button type="button" ${state.busy ? 'disabled' : ''} onclick="ByndPetHistory.download()">下载 ${row.format}</button><button type="button" class="pet-history-delete" ${uses.length || state.busy ? 'disabled' : ''} onclick="ByndPetHistory.confirmDelete()">删除图片</button></div>${state.confirm ? `<div class="pet-history-confirm" role="group" aria-label="确认删除图片"><p>删除这份历史图片？本机历史中将无法找回。</p><div class="pet-actions"><button type="button" class="secondary" ${state.busy ? 'disabled' : ''} onclick="ByndPetHistory.cancelDelete()">保留图片</button><button type="button" class="pet-history-delete" ${state.busy ? 'disabled' : ''} onclick="ByndPetHistory.remove()">${state.busy ? '正在处理…' : '确认删除'}</button></div></div>` : ''}</div>`;
    }
    function render() {
        const state = view;
        if (!alive(state)) return;
        const overlay = root();
        const scroll = overlay.querySelector('main')?.scrollTop || 0;
        const shown = state.rows.slice(0, state.limit);
        state.revision++;
        overlay.innerHTML = `<header class="bynd-agent-header"><button type="button" aria-label="${state.key ? '返回图片历史' : '返回桌宠设置'}" onclick="ByndPetHistory.back()">‹</button><span><strong id="pet-history-title">${state.key ? '图片详情' : '桌宠图片历史'}</strong><small>${escape(C.name(state.char))}${state.loading ? '' : ' · ' + state.rows.length + ' 张'}</small></span><button type="button" aria-label="关闭图片历史" onclick="ByndPetHistory.close()">×</button></header><main class="pet-studio-main pet-history-main" aria-busy="${state.loading || state.busy}"><div class="pet-history-feedback" aria-live="polite">${state.error ? `<p class="pet-error" role="alert">${escape(state.error)}</p>` : ''}${state.notice ? `<p class="pet-progress" role="status">${escape(state.notice)}</p>` : ''}</div>${state.key ? detailContent(state) : `<div class="pet-history-toolbar"><p>生成与上传的 PNG / GIF 都在这里</p><button type="button" class="secondary" ${state.loading || state.busy ? 'disabled' : ''} onclick="ByndPetHistory.reload()">刷新</button></div>${state.loading ? '<p class="pet-empty" role="status">正在读取图片历史…</p>' : shown.length ? `<ul class="pet-history-grid">${shown.map(card).join('')}</ul>${shown.length < state.rows.length ? '<button type="button" class="pet-primary secondary" onclick="ByndPetHistory.more()">查看更多图片</button>' : ''}` : `<div class="pet-empty">${state.error ? '暂时无法读取历史，请点击刷新重试。' : '还没有桌宠图片<br>生成或上传后，会自动出现在这里。'}</div>`}`}</main>`;
        overlay.querySelector('main').scrollTop = scroll;
        loadThumbnails(state, state.revision);
    }
    async function loadThumbnails(state, revision) {
        const images = Array.from(root().querySelectorAll('[data-history-thumb]'));
        // Bound concurrent reads and only load images already displayed by the list.
        async function worker() {
            while (images.length && alive(state) && state.revision === revision) {
                const node = images.shift();
                try {
                    const image = await C.readAsset(node.dataset.historyThumb);
                    if (!alive(state) || state.revision !== revision) return;
                    if (!image?.url) throw new Error('图片不存在');
                    node.src = image.url;
                } catch (_) { if (node.isConnected) node.replaceWith(Object.assign(document.createElement('span'), { className: 'pet-history-missing', textContent: '预览未能读取' })); }
            }
        }
        await Promise.all([worker(), worker(), worker()]);
    }
    async function detail(key) {
        const state = view;
        if (!state || state.busy || !state.rows.some(row => row.key === key)) return;
        state.listScroll = root().querySelector('main').scrollTop;
        state.key = key; state.image = null; state.error = ''; state.notice = ''; state.confirm = false;
        render(); root().querySelector('main').scrollTop = 0; focusFirst();
        try {
            const image = await C.readAsset(key);
            if (!alive(state) || state.key !== key) return;
            if (!image?.url) throw new Error('图片未能读取，请返回历史并刷新。');
            state.image = image;
        } catch (error) { if (alive(state) && state.key === key) state.error = C.clean(error.message, 300); }
        finally { if (alive(state) && state.key === key) { render(); focusFirst(); } }
    }
    function back() {
        const state = view;
        if (!state?.key) { close(); return; }
        if (state.busy) { close(); return; }
        const key = state.key;
        state.key = ''; state.image = null; state.confirm = false; state.error = '';
        render(); root().querySelector('main').scrollTop = state.listScroll;
        const trigger = Array.from(root().querySelectorAll('[data-pet-history-key]')).find(node => node.dataset.petHistoryKey === key);
        if (trigger) trigger.focus({ preventScroll: true }); else focusFirst();
    }
    async function remove() {
        const state = view;
        if (!state?.key || !state.confirm || state.busy) return;
        const key = state.key;
        state.busy = true; state.error = ''; render(); focusFirst();
        try {
            await C.deleteAsset(state.char, key);
            if (!alive(state)) return;
            state.rows = state.rows.filter(row => row.key !== key);
            state.key = ''; state.image = null; state.confirm = false; state.notice = '图片已删除。';
        } catch (error) { if (alive(state)) state.error = C.clean(error.message, 400) || '删除失败，图片已保留。'; }
        finally { if (alive(state)) { state.busy = false; render(); root().querySelector('main').scrollTop = state.key ? 0 : state.listScroll; focusFirst(); } }
    }
    async function download() {
        const state = view;
        if (!state?.image || state.busy) return;
        state.busy = true; state.error = ''; state.notice = '正在准备图片…'; render(); focusFirst();
        try { const notice = await window.ByndPetStudio.exportImage(state.char, state.key); if (alive(state)) state.notice = notice; }
        catch (error) { if (alive(state)) { state.notice = ''; state.error = C.clean(error.message, 300) || '图片未能保存。'; } }
        finally { if (alive(state)) { state.busy = false; render(); focusFirst(); } }
    }
    window.ByndPetHistory = {
        open, close, reload, detail, back, remove, download,
        more: () => { if (view && !view.busy) { const key = view.rows[view.limit]?.key; view.limit += 12; render(); Array.from(root().querySelectorAll('[data-pet-history-key]')).find(node => node.dataset.petHistoryKey === key)?.focus({ preventScroll: true }); } },
        confirmDelete: () => { if (!view || view.busy || !view.image || C.assetUsage(view.key).length) return; view.confirm = true; render(); const box = root().querySelector('.pet-history-confirm'); box?.scrollIntoView({ block: 'nearest' }); box?.querySelector('button')?.focus({ preventScroll: true }); },
        cancelDelete: () => { if (view && !view.busy) { view.confirm = false; render(); root().querySelector('.pet-history-delete')?.focus({ preventScroll: true }); } }
    };
})();
