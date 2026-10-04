(() => {
    'use strict';
    const api = () => window.ByndCharacterEvents;
    const el = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const date = t => new Date(t).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
    let filter = 'all', selected = '', preview = false, previousFocus = null, announcement = '', lastError = '';
    let storyTimers = [], storyToken = 0;
    const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    function stopStory() { storyToken++; storyTimers.forEach(clearTimeout); storyTimers = []; }
    function later(fn, delay) { const token = storyToken; storyTimers.push(setTimeout(() => { if (token === storyToken) fn(); }, delay)); }
    function letterPhase(phase) {
        const story = el('event-viewer').querySelector('.event-letter-story');
        el('event-viewer').dataset.phase = phase;
        if (story) { story.dataset.phase = phase; story.querySelectorAll('[data-story-scene]').forEach(n => { n.inert = n.dataset.storyScene !== phase; }); }
    }
    function finishLetterIntro() { stopStory(); letterPhase('envelope'); }
    function startLetterIntro(e) {
        if (!preview && !e.unread) { letterPhase('read'); return; }
        if (reducedMotion()) { letterPhase('envelope'); return; }
        letterPhase('ribbon');
        later(() => letterPhase('pause'), 2200);
        later(() => letterPhase('calendar'), 2700);
        later(() => letterPhase('verse'), 4500);
        later(() => letterPhase('envelope'), 6700);
    }
    function letterStory(e, meta, photo) {
        const stamp = new Date(e.createdAt), day = stamp.getDate(), month = stamp.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
        const ribbon = '<img class="event-story-ribbon" src="assets/character-events/ribbon-black-v1.png" alt="" aria-hidden="true">';
        return `<div class="event-letter-story" data-phase="ribbon">
            <div class="event-story-controls"><span>一封来信 · ${esc(e.charName)}</span><button type="button" class="event-story-skip" onclick="ByndEventInbox.finishLetterIntro()">跳过前奏 ↗</button></div>
            <section class="event-story-scene event-story-ribbon-scene" data-story-scene="ribbon" aria-label="丝带缓缓展开">${ribbon}<p class="event-ribbon-phrase phrase-one">有些话</p><p class="event-ribbon-phrase phrase-two">留在纸上</p><p class="event-ribbon-phrase phrase-three">绕过时间</p><p class="event-ribbon-phrase phrase-four">来到你身旁</p></section>
            <section class="event-story-scene event-story-calendar" data-story-scene="calendar" aria-label="寄出这封信的日期"><div class="event-calendar-grid"><span>${day > 1 ? day - 1 : ''}</span><div><small>${esc(month)}</small><strong>${String(day).padStart(2, '0')}</strong><p>这一天，<em>把信寄给你。</em></p><i>THE DAY I SENT IT</i></div><span>${day < 28 ? day + 1 : ''}</span></div></section>
            <section class="event-story-scene event-story-verse" data-story-scene="verse" aria-label="终于寄出去的信"><small>FROM ${esc(e.charName)} · TO YOU</small><h2>终于<em>寄出的</em>一封信<span>A LETTER, AT LAST.</span></h2>${ribbon}<p>${esc(e.title)}</p></section>
            <section class="event-story-scene event-story-envelope-scene" data-story-scene="envelope"><div class="event-envelope"><div class="event-envelope-address"><small>FOR YOU</small><h2>${esc(e.title)}</h2><span>${esc(e.charName)} · ${esc(date(e.createdAt))}</span></div><div class="event-envelope-paper"></div><div class="event-envelope-flap"></div><button class="event-seal" type="button" onclick="ByndEventInbox.unseal(this)" aria-label="拆开这封信"><img src="assets/character-events/seal-black-v1.png" alt="黑色蝴蝶结封蜡"><span>轻触拆封</span></button><p class="event-envelope-caption">终于，送到了你手里。</p></div></section>
            <article class="event-letter event-story-scene" data-story-scene="read">${meta}<div class="event-letter-heading"><small>A LETTER FOR YOU</small><h2>${esc(e.title)}</h2></div><div class="event-body">${esc(e.body)}</div>${photo}<p class="event-signature">${esc(e.charName)}</p><button class="event-story-replay" type="button" onclick="ByndEventInbox.replayLetter()">再看一次寄信前奏 ↗</button></article>
        </div>`;
    }
    function bottleContents(e, meta) {
        return `<article class="event-bottle-sheet">${meta}<div class="event-bottle-heading"><small>WORDS I KEPT FOR YOU</small><h2>${esc(e.title)}</h2><p>每落下一句，都是想你的声音。</p></div><div class="event-bottle" aria-label="装着思念的玻璃瓶"><svg class="event-bottle-outline" viewBox="0 0 320 440" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="event-glass" x1="0" y1="0" x2="1" y2=".3"><stop offset="0" stop-color="#e3ece7" stop-opacity=".24"/><stop offset=".18" stop-color="#fff" stop-opacity="0"/><stop offset=".86" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#dde7e2" stop-opacity=".32"/></linearGradient></defs><path class="event-glass-body" d="M119 30 L119 71 C119 94 88 92 65 108 C40 126 25 153 25 183 L25 383 Q25 420 61 421 L259 421 Q295 420 295 383 L295 183 C295 153 280 126 255 108 C232 92 201 94 201 71 L201 30 Z" fill="url(#event-glass)"/><path class="event-glass-light" d="M45 183 Q45 146 72 127 M44 206 L44 328 M276 180 L276 347 M68 407 Q160 416 252 407"/><rect class="event-glass-lip" x="109" y="20" width="102" height="12" rx="5"/></svg><div class="event-bottle-words">${e.words.map((w, i) => `<span data-word="${i}">${esc(w)}</span>`).join('')}</div><span class="event-bottle-floor" aria-hidden="true"></span></div><div class="event-bottle-footer"><span>${e.words.length} 句，慢慢攒起来</span><button class="event-bottle-replay" type="button" onclick="ByndEventInbox.replayBottle()">再听一次 ↺</button></div><div class="event-body">${esc(e.body)}</div></article>`;
    }
    function layoutBottle(animate = true) {
        const bottle = el('event-viewer').querySelector('.event-bottle'); if (!bottle) return;
        const cloud = bottle.querySelector('.event-bottle-words'), width = cloud.clientWidth;
        if (!width) return;
        const rows = []; let row = [], used = 0, height = 0;
        [...cloud.children].forEach((word, i) => {
            word.style.maxWidth = Math.min(180, width - 30) + 'px';
            const tilt = [-11, 8, -5, 13, -12, 4, 10, -7][i % 8];
            word.style.setProperty('--tilt', tilt + 'deg');
            const w = word.offsetWidth, h = word.offsetHeight;
            const bw = Math.abs(w * Math.cos(tilt * Math.PI / 180)) + Math.abs(h * Math.sin(tilt * Math.PI / 180));
            const bh = Math.abs(h * Math.cos(tilt * Math.PI / 180)) + Math.abs(w * Math.sin(tilt * Math.PI / 180));
            if (row.length && used + bw + 7 > width - 10) { rows.push({ words: row, width: used, height }); row = []; used = 0; height = 0; }
            row.push({ word, w, h, bw, bh, index: i }); used += bw + 7; height = Math.max(height, bh);
        });
        if (row.length) rows.push({ words: row, width: used, height });
        const pileHeight = rows.reduce((sum, r) => sum + r.height + 1, 0);
        bottle.style.height = Math.max(418, pileHeight + 120) + 'px';
        cloud.style.height = pileHeight + 'px';
        let bottom = 0;
        rows.forEach((r, ri) => {
            const spare = Math.max(0, width - r.width + 7);
            const lean = [12, -12, 6, -8, 14, -5][ri % 6];
            let left = spare / 2 + Math.sign(lean) * Math.min(Math.abs(lean), spare / 3);
            r.words.forEach(({ word, w, h, bw, bh, index }) => {
                const x = left + (bw - w) / 2, y = pileHeight - bottom - r.height + (r.height - h) / 2;
                word.style.setProperty('--land-x', x + 'px'); word.style.setProperty('--land-y', y + 'px');
                word.style.setProperty('--delay', (index * .27 + .1) + 's');
                word.style.setProperty('--drop', -(pileHeight + 200) + 'px');
                left += bw + 7;
            });
            bottom += r.height + 1;
        });
        cloud.classList.toggle('is-falling', animate && !reducedMotion());
    }
    function glyph(type) {
        const paths = {
            letter: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 6 9 7 9-7"/>',
            newspaper: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M7 7h10M7 11h4m3 0h3M7 15h4m3 0h3M7 18h10"/>',
            bottle: '<path d="M8 3h8v4l3 4v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8l3-4zM8 6h8m-7 8 3 3 3-3"/>',
            doodle: '<path d="m5 15 11-11 4 4L9 19l-6 2zM14 6l4 4M5 15l4 4"/>',
            message: '<path d="M4 4h16v12H9l-5 4zM8 8h8M8 12h5"/>',
            album: '<rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 7"/>'
        };
        return `<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[type] || '<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/>'}</svg>`;
    }
    function status(message) {
        lastError = String(message || '');
        const box = el('event-status');
        if (box) { box.textContent = lastError; box.hidden = !lastError; }
    }
    function badge() {
        const s = api().read();
        const count = s.events.filter(e => e.unread && e.delivery === 'delivered').length;
        document.querySelectorAll('[data-app-id="events"] .app-icon').forEach(node => { if (!node.querySelector('[data-event-badge]')) { const b = document.createElement('b'); b.dataset.eventBadge = ''; node.appendChild(b); } });
        document.querySelectorAll('[data-event-badge]').forEach(node => { node.textContent = count > 99 ? '99+' : count; node.hidden = !count; });
        const widget = el('event-desktop-widget');
        const e = [...s.events].reverse().find(e => e.type === 'widget' && e.delivery === 'delivered' && e.unread);
        if (widget) { widget.hidden = !e; widget.textContent = e ? `${e.charName}：${e.body.slice(0, 60)}` : ''; widget.dataset.eventId = e?.id || ''; }
    }
    function render() {
        try {
            badge();
            const root = el('event-list'); if (!root) return;
            const s = api().read();
            const rows = [...s.events].reverse().filter(e => filter === 'all' || (filter === 'letters' ? e.type === 'letter' : filter === 'notes' ? ['note', 'diary', 'widget'].includes(e.type) : ['doodle', 'newspaper', 'bottle', 'album'].includes(e.type)));
            root.innerHTML = rows.length ? rows.map(e => `<button class="event-row ${e.unread ? 'is-unread' : ''}" data-event-id="${esc(e.id)}"><span class="event-row-icon">${glyph(e.type)}</span><span class="event-row-copy"><span class="event-row-meta">${esc(e.charName)} · ${esc(api().slots[e.type])}<time>${esc(date(e.createdAt))}</time></span><strong>${esc(e.title)}</strong><span class="event-row-excerpt">${esc(e.delivery === 'failed' ? '未送达 · ' + e.deliveryError : e.delivery === 'pending' ? '等待送达' : e.body)}</span></span><span class="event-unread-dot" ${e.unread ? '' : 'hidden'}></span></button>`).join('') : '<div class="event-empty">' + glyph('letter') + '<h2>把空白留给下一次来信</h2><p>角色留下的消息、信和小心意，会收在这里。</p><button type="button" onclick="ByndEventInbox.showPreview(\'letter\')">看看信封的样子</button></div>';
            el('event-enabled').checked = s.enabled;
            el('event-threshold').value = String(s.thresholdDays);
            const failures = Object.entries(s.characters).filter(([, r]) => r.pending);
            el('event-pending').innerHTML = failures.length ? `<p>${failures.length} 位角色的判断待完成</p>${failures.filter(([, r]) => r.lastError).map(([, r]) => `<p class="event-error">${esc(r.lastError)}</p>`).join('')}<button type="button" onclick="ByndEventInbox.retryPending(this)">重试判断</button>` : '';
            status(lastError);
        } catch (error) { status(error.message); }
    }
    function open() { void api().init(); render(); }
    function chooseFilter(key) {
        filter = key;
        document.querySelectorAll('[data-event-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.eventFilter === key)));
        render();
    }
    function sketch(strokes) {
        return `<svg class="event-sketch" viewBox="0 0 300 300" role="img" aria-label="角色的手绘画作">${strokes.map(s => `<polyline points="${esc(s.points.map(p => p.join(',')).join(' '))}" fill="none" stroke="${esc(s.color)}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
    }
    function contents(e) {
        const meta = `<div class="event-sheet-meta">${esc(e.charName)}<span>${esc(date(e.createdAt))}</span></div>`;
        const photo = e.imageUrl ? `<img class="event-art-image" src="${esc(e.imageUrl)}" alt="${esc(e.title)}" referrerpolicy="no-referrer">` : '';
        if (e.type === 'letter') return letterStory(e, meta, photo);
        if (e.type === 'newspaper') return `<article class="event-newspaper"><div class="event-news-kicker"><span>私人刊物</span><span>VOL. 01</span></div><div class="event-masthead">关于你的消息</div>${meta}<h2>${esc(e.title)}</h2>${photo || '<div class="event-news-mark" aria-hidden="true">?</div>'}<div class="event-body">${esc(e.body)}</div><footer>仅为你而印 · ${esc(e.charName)}</footer></article>`;
        if (e.type === 'bottle') return bottleContents(e, meta);
        return `<article class="event-paper event-paper-${esc(e.type)}">${meta}${e.type === 'doodle' ? `<div class="event-doodle-art">${photo || sketch(e.strokes)}</div>` : photo}<h2>${esc(e.title)}</h2><div class="event-body">${esc(e.body)}</div><p class="event-signature">${esc(e.charName)}</p></article>`;
    }
    function show(e, isPreview = false) {
        if (!e) return;
        stopStory();
        selected = e.id; preview = isPreview;
        previousFocus = document.activeElement;
        const dialog = el('event-viewer');
        dialog.innerHTML = `<header class="event-viewer-header"><button type="button" onclick="ByndEventInbox.closeViewer()" aria-label="关闭心意">×</button><span>${isPreview ? '样式预览 · 示例内容' : esc(api().slots[e.type])}</span><span>${!isPreview && e.unread ? '未读' : ''}</span></header><div class="event-viewer-scroll">${contents(e)}${!isPreview && e.delivery !== 'delivered' ? `<div class="event-delivery-error"><p role="alert">${esc(e.deliveryError || '尚未完成送达')}</p><button type="button" onclick="ByndEventInbox.retryDelivery(this)">重试送达</button></div>` : ''}<p id="event-viewer-error" role="alert"></p></div>`;
        dialog.hidden = false;
        dialog.dataset.type = e.type;
        const app = el('app-events-window');
        app.querySelectorAll(':scope > :not(#event-viewer)').forEach(n => { n.inert = true; });
        dialog.querySelector('button').focus();
        if (e.type === 'letter') startLetterIntro(e);
        if (e.type === 'bottle') layoutBottle();
        if (!isPreview && e.type !== 'letter' && e.delivery === 'delivered') readSelected();
    }
    function readSelected() {
        if (preview) return;
        try { api().markRead(selected); const label = el('event-viewer')?.querySelector('.event-viewer-header span:last-child'); if (label) label.textContent = ''; }
        catch (error) { el('event-viewer-error').textContent = '已打开，但阅读状态保存失败：' + error.message; }
    }
    function showId(id) { try { show(api().eventById(id)); } catch (error) { status(error.message); } }
    function closeViewer(restoreFocus = true) {
        stopStory();
        el('event-viewer').hidden = true; el('event-viewer').innerHTML = '';
        el('app-events-window').querySelectorAll(':scope > *').forEach(n => { n.inert = false; });
        render(); if (restoreFocus) previousFocus?.focus();
    }
    function close() { if (!el('event-viewer').hidden) closeViewer(false); }
    function unseal(button) {
        if (button.disabled) return;
        button.disabled = true; stopStory();
        const story = button.closest('.event-letter-story'); story.classList.add('is-unsealing');
        const complete = () => {
            story.classList.remove('is-unsealing'); letterPhase('read');
            el('event-viewer').querySelector('.event-viewer-scroll').scrollTop = 0;
            el('event-viewer').querySelector('button').focus();
            if (preview || api().eventById(selected)?.delivery === 'delivered') readSelected();
        };
        if (reducedMotion()) complete(); else later(complete, 850);
    }
    function replayLetter() { stopStory(); el('event-viewer').querySelector('.event-seal').disabled = false; startLetterIntro({ unread: true }); }
    function replayBottle() {
        const node = el('event-viewer').querySelector('.event-bottle-words');
        const copy = node.cloneNode(true); node.replaceWith(copy); layoutBottle();
    }
    const examples = {
        letter: { title: '终于寄出去的信', body: '展信好。\n\n窗边那盆植物又长出了新叶。原本想等你来的时候再说，想了想，还是先写给你。\n\n等你有空，我们再慢慢聊。' },
        newspaper: { title: '寻人启事：一位熟悉的读者', body: '本报今日留出一栏，寻找那位总在傍晚出现的读者。\n\n桌上的书还停在上次那一页。若你路过，随时可以继续读下去。' },
        bottle: { title: '把想念，攒成一小瓶', body: '这些零零碎碎的小事，想等你有空时说给你听。', words: ['想你', '今天的晚霞', '那首没听完的歌', '窗外下雨了', '想和你说晚安', '等你有空', '一片新叶', '路过那家书店', '偷偷想了你一下', '梦里见', '好好吃饭', '下次一起'] },
        doodle: { title: '在纸边画了朵花', body: '写到一半，忍不住在这里画了一笔。', strokes: [ { color: '#3446aa', points: [[146,257],[162,184],[151,130],[117,128],[90,108],[96,76],[118,62],[133,80],[141,46],[168,39],[183,70],[207,61],[226,85],[215,118],[183,138],[151,130]] }, { color: '#3446aa', points: [[156,211],[119,196],[101,169],[128,172],[158,196],[198,159],[206,176],[178,207],[156,211]] }, { color: '#d5ad39', points: [[121,101],[122,84],[129,115],[137,94],[146,122],[151,70],[158,122],[166,65],[172,119],[179,79],[186,112],[194,91]] } ] }
    };
    function showPreview(type) {
        if (!examples[type]) return;
        show({ id: 'preview', type, charName: '示例角色', createdAt: Date.now(), imageUrl: '', strokes: [], ...examples[type] }, true);
    }
    function configure() {
        try { api().configure({ enabled: el('event-enabled').checked, thresholdDays: el('event-threshold').value }); status('已保存'); }
        catch (error) { status('保存失败：' + error.message); render(); }
    }
    async function retryPending(button) {
        button.disabled = true; status('正在重试角色判断…');
        try {
            await api().processPending(true);
            const failed = Object.values(api().read().characters).some(r => r.pending);
            status(failed ? '仍有判断未完成，请查看具体原因后重试。' : '判断已完成；角色也可以选择保持沉默。');
        } catch (error) { status('重试失败：' + error.message); }
        finally { button.disabled = false; render(); }
    }
    async function retryDelivery(button) {
        button.disabled = true;
        try { const e = await api().retryDelivery(selected); show(e); }
        catch (error) { el('event-viewer-error').textContent = '送达失败：' + error.message; }
        finally { button.disabled = false; }
    }
    function exportFile() {
        let url;
        try {
            url = URL.createObjectURL(new Blob([api().exportEvents()], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = 'BYND-heartmail.json'; document.body.appendChild(a); a.click(); a.remove();
            status('已发起下载，请在下载列表确认文件。');
        } catch (error) { status('导出失败：' + error.message); }
        finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
    async function importFile(input) {
        const file = input.files?.[0]; if (!file) return;
        try {
            if (file.size > 8000000) throw new Error('文件不能超过 8 MB');
            const count = api().importEvents(await file.text());
            const imported = api().read().events.filter(e => e.delivery === 'pending');
            let failed = 0;
            for (const e of imported) { try { await api().retryDelivery(e.id); } catch (_) { failed++; } }
            status(failed ? `已导入 ${count} 条，${failed} 条送达失败，可打开记录重试。` : `已导入 ${count} 条心意。`);
        } catch (error) { status('导入失败：' + error.message); }
        finally { input.value = ''; render(); }
    }
    function announce(e) {
        if (!e || e.delivery !== 'delivered' || !e.unread) return;
        announcement = e.id;
        const banner = el('event-arrival');
        if (banner) {
            banner.hidden = false;
            banner.querySelector('span').textContent = `${e.charName} 留下了${api().slots[e.type]}`;
            banner.querySelector('.event-arrival-art')?.remove();
            if (e.type === 'doodle') {
                const art = document.createElement('div'); art.className = 'event-arrival-art';
                art.innerHTML = e.imageUrl ? `<img src="${esc(e.imageUrl)}" alt="${esc(e.title)}" referrerpolicy="no-referrer">` : sketch(e.strokes);
                banner.querySelector('button').appendChild(art);
            }
        }
        badge();
    }
    function openArrival() { el('event-arrival').hidden = true; window.openApp('events'); showId(announcement); }
    document.addEventListener('click', e => {
        const row = e.target.closest?.('[data-event-id]');
        if (row?.dataset.eventId) { window.openApp('events'); showId(row.dataset.eventId); }
    });
    document.addEventListener('keydown', e => {
        const dialog = el('event-viewer'); if (!dialog || dialog.hidden) return;
        if (e.key === 'Escape') { e.preventDefault(); closeViewer(); }
        if (e.key === 'Tab') {
            const nodes = [...dialog.querySelectorAll('button,a,[tabindex="0"]')].filter(n => !n.disabled && n.getClientRects().length);
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
    });
    window.addEventListener('bynd:character-events', render);
    window.addEventListener('storage', e => { if (e.key === api().storageKey) render(); });
    window.addEventListener('resize', () => layoutBottle(false));
    window.ByndEventInbox = { open, close, render, status, chooseFilter, showId, closeViewer, unseal, finishLetterIntro, replayLetter, replayBottle, showPreview, configure, retryPending, retryDelivery, exportFile, importFile, announce, openArrival };
})();
