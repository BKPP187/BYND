(function (H) {
    'use strict';
    let root, activity, timer = 0, apiTimer = 0, noticeTimer = 0, loadToken = 0, busy = false, referenceDraft = '', userProfileDraft = null;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const icon = name => H.Icons.paint(name);
    const button = (action, text, symbol, extra = '') => '<button type="button" data-action="' + action + '" ' + extra + '>' + (symbol ? icon(symbol) : '') + text + '</button>';
    function apiButton(action, text, pending, extra = '') {
        return button(action, '<span data-api-label>' + esc(text) + '</span>', 'ri-sparkling-line', extra + ' data-home-api data-idle="' + esc(text) + '" data-pending="' + esc(pending) + '"');
    }
    function refreshApiControls() {
        const seconds = Math.ceil(H.Bridge.cooldownRemaining() / 1000), pending = busy || H.Bridge.requestBusy();
        root?.querySelectorAll('[data-home-api]').forEach(control => {
            control.disabled = pending || seconds > 0;
            control.querySelector('[data-api-label]').textContent = seconds > 0 ? '等待 ' + seconds + ' 秒后再试' : pending ? control.dataset.pending : control.dataset.idle;
        });
        const imageSeconds = Math.ceil(H.Portraits.cooldownRemaining() / 1000);
        root?.querySelectorAll('[data-home-image]').forEach(control => {
            control.disabled = busy || H.Portraits.busy() || imageSeconds > 0;
            control.querySelector('[data-image-label]').textContent = imageSeconds > 0 ? '等待 ' + imageSeconds + ' 秒后再试' : busy || H.Portraits.busy() ? control.dataset.pending : control.dataset.idle;
        });
        root?.querySelectorAll('.home3d-portrait-confirm button').forEach(control => { control.disabled = busy || H.Portraits.busy(); });
        const imageHint = root?.querySelector('[data-image-cooldown]');
        if (imageHint) { imageHint.hidden = !imageSeconds; imageHint.textContent = '生图服务限流，请稍后重试。当前形象已保留。'; }
        const hint = root?.querySelector('[data-api-cooldown]');
        if (hint) { hint.hidden = seconds <= 0; hint.textContent = '接口限流，约 ' + seconds + ' 秒后可以手动重试。当前形象已保留，也可以继续手动调整。'; }
    }
    const header = () => '<header class="home3d-header">' + button('back', '', 'ri-arrow-left-s-line', 'aria-label="返回桌面"') + '<div><span>BYND · OUR LITTLE HOME</span><strong>小屋</strong></div>' + button('entrance', '', 'ri-home-heart-line', 'aria-label="小屋入口"') + '</header>';
    function notice(message, error = false) {
        const box = root?.querySelector('.home3d-notice');
        if (!box) return;
        clearTimeout(noticeTimer); box.textContent = message; box.classList.toggle('is-error', error); box.hidden = false;
        noticeTimer = setTimeout(() => { box.hidden = true; }, error ? 10000 : 5500);
    }
    function shell() {
        root.classList.add('is-room');
        root.innerHTML = header() + '<main class="home3d-world"><div class="home3d-scene" id="home3d-scene"></div><div class="home3d-welcome"><span class="home3d-eyebrow">OUR LITTLE HOME</span><div id="home3d-room-label"></div></div><div class="home3d-view-tools">' + button('reset-view', '', 'ri-focus-3-line', 'aria-label="恢复视角"') + button('zoom-in', '', 'ri-add-line', 'aria-label="放大"') + button('zoom-out', '', 'ri-subtract-line', 'aria-label="缩小"') + '</div><div class="home3d-scene-error" hidden></div><div class="home3d-presence" id="home3d-presence"></div><div class="home3d-scene-hint">拖动看看家 · 点家具互动 · 点空地走动</div></main><footer class="home3d-footer"><nav class="home3d-room-tabs" aria-label="小屋房间"></nav><div class="home3d-quick-actions">' + button('build', '装修', 'ri-pencil-ruler-line') + button('together', '陪伴', 'ri-heart-3-line') + button('memories', '留点回忆', 'ri-sparkling-line') + button('journal', '日常', 'ri-book-open-line') + button('settings', '设置', 'ri-settings-4-line') + '</div></footer><section class="home3d-build-tray" aria-label="装修家具栏"></section><div class="home3d-modal" hidden></div><div class="home3d-notice" role="status" aria-live="polite" hidden></div>';
    }
    function setup() {
        root.classList.remove('is-room');
        const data = H.State.load(), chars = H.Bridge.characters(); referenceDraft = data.user.reference || ''; userProfileDraft = H.Characters.validateProfile(data.user.avatar);
        root.innerHTML = header() + '<main class="home3d-setup"><div class="home3d-setup-art"><span>✦</span><div class="home3d-mini-house">' + icon('ri-home-heart-line') + '</div><small>在这里，留下两个人的日常</small></div><span class="home3d-eyebrow">欢迎回家</span><h1>我们的小屋</h1><p>选一个一起生活的人，点亮家里的灯。</p><button type="button" class="home3d-reference" data-action="pick-user" aria-label="设置我的参考图">' + (referenceDraft ? '<img src="' + esc(referenceDraft) + '" alt="我的参考图">' : icon('ri-user-smile-line')) + '<span>我的形象<small>点击设置参考图</small></span><b>＋</b></button><label class="home3d-field">和谁一起住<select id="home3d-bind-char">' + chars.map(char => '<option value="' + esc(char.id) + '" ' + (String(char.id) === data.activeCharId ? 'selected' : '') + '>' + esc(H.Bridge.name(char)) + '</option>').join('') + '</select></label>' + (chars.length ? '<p class="home3d-fineprint">角色参考图会沿用聊天设置中的图片。没有参考图时，可以先用初始形象，在家里慢慢调整。</p>' + button('enter', '把我们的灯点亮', 'ri-arrow-right-line', 'class="home3d-primary"') : '<div class="home3d-empty">通讯录里还没有可同住的角色。</div>' + button('contacts', '去微信添加角色', 'ri-wechat-line', 'class="home3d-primary"')) + '<div class="home3d-notice" role="status" hidden></div></main><div class="home3d-modal" hidden></div>';
    }
    async function enter() {
        if (busy) return;
        const id = root.querySelector('#home3d-bind-char')?.value;
        const data = H.State.bind(id, { reference: referenceDraft, avatar: userProfileDraft || H.Characters.defaultProfile('user') });
        H.State.visit(); H.Living.advance(H.Bridge.context()); shell(); startLife(); await loadRoom(H.State.home(data).room);
        await syncAppearances();
    }
    async function open(element) {
        close(); root = element; root.onclick = onClick; root.onchange = onChange;
        const data = H.State.load();
        if (!data.activeCharId || !H.Bridge.char() || !H.State.home(data)) { setup(); return; }
        H.State.visit(); showEntrance();
    }
    async function syncAppearances() {
        const data = H.State.load(), home = H.State.home(data);
        if (home && (!home.portrait || !data.user.portrait)) notice('现在显示初始立绘。在小屋设置中，可以按参考图 AI 生成你们的专属形象。');
    }
    function showEntrance() {
        root.classList.remove('is-room');
        H.BuildUI?.close(); H.runtime?.dispose(); H.runtime = null;
        const hour = new Date().getHours(), night = hour < 7 || hour >= 19;
        const home = H.State.home();
        root.innerHTML = header() + '<main class="home3d-entry ' + (night ? 'is-night' : '') + '"><img src="assets/home3d/entrance/' + (night ? 'night' : 'day') + '.png" alt="' + (night ? '夜晚亮着灯的小屋' : '白天的小屋') + '"><div class="home3d-entry-title"><span>BYND</span><h1>我们的小屋</h1><p>' + (night ? '灯还亮着，回来吧。' : '今天也在一起生活。') + '</p></div><div class="home3d-entry-actions">' + button('home-enter', '回家', 'ri-home-heart-line', 'class="home3d-primary"') + '<small>' + esc(H.Bridge.name(H.Bridge.char())) + ' · 共同生活第 ' + Math.max(1, Math.floor((Date.now() - home.createdAt) / 86400000) + 1) + ' 天</small></div></main><div class="home3d-modal" hidden></div><div class="home3d-notice" role="status" hidden></div>';
    }
    async function arrive() {
        H.Living.advance(H.Bridge.context()); shell(); await loadRoom(H.State.home().room); startLife();
        const summary = H.State.home().awaySummary;
        if (summary && Date.now() - summary.until < 30000) notice('离开期间的生活记录已更新，点「日常」查看。');
    }
    function refreshLife() {
        if (H.BuildUI?.active() || !H.runtime) return;
        try {
            const data = H.Living.advance(H.Bridge.context()), next = H.State.home(data).activity;
            if (JSON.stringify(next) !== JSON.stringify(activity)) { activity = next; H.runtime.setCharActivity(activity); }
            updateStatus();
        } catch (error) { notice(error.message, true); }
    }
    function startLife() {
        clearInterval(timer); clearInterval(apiTimer); apiTimer = setInterval(refreshApiControls, 1000);
        timer = setInterval(() => { if (!document.hidden && root?.closest('.app-window')?.classList.contains('active')) refreshLife(); }, 10000);
    }
    function close() { H.BuildUI?.close(); clearInterval(timer); clearInterval(apiTimer); clearTimeout(noticeTimer); timer = 0; apiTimer = 0; noticeTimer = 0; loadToken++; H.runtime?.dispose(); H.runtime = null; }
    async function loadRoom(id) {
        if (!root?.closest('.app-window')?.classList.contains('active')) return;
        const token = ++loadToken, session = H.session, data = H.State.load(), home = H.State.home(data), room = H.Rooms.get(id);
        if (!H.Rooms.available(room, home)) throw new Error('这个房间还在准备中。');
        H.State.withHome(current => { current.room = id; });
        activity = H.Living.plan(home, H.Bridge.context());
        H.State.withHome(current => { current.activity = activity; });
        root.querySelector('.home3d-scene-error').hidden = true;
        root.querySelector('#home3d-room-label').innerHTML = button('room-menu', esc(room.name), room.icon, 'class="home3d-room-chip" aria-label="选择房间，当前' + esc(room.name) + '"');
        root.querySelector('.home3d-room-tabs').innerHTML = H.catalogs.roomCatalog.rooms.filter(room => H.Rooms.available(room, home)).map(room => button('room', esc(room.name), room.icon, 'data-room="' + room.id + '" class="' + (id === room.id ? 'is-current' : '') + '" aria-pressed="' + (id === room.id) + '"')).join('');
        updateStatus(); root.querySelector('#home3d-scene').classList.add('is-loading');
        try {
            if (!H.runtime) H.runtime = H.Scene.create(root.querySelector('#home3d-scene'), { theme: home.theme === 'auto' ? (new Date().getHours() < 7 || new Date().getHours() >= 19 ? 'night' : 'cream') : home.theme, onDraft: draft => H.BuildUI?.changed(draft), onSelect: selectFurniture, onActor: actor => actor === 'char' ? showChar() : showSettings(), onNotice: notice, onQuality: refreshQuality });
            await H.runtime.load(id, home, data.user.avatar, activity);
            if (token !== loadToken || session !== H.session) return;
        } catch (error) { if (token === loadToken && session === H.session) showSceneError(error.message || '3D 画面暂时没有准备好。'); }
        finally { if (token === loadToken && session === H.session) root.querySelector('#home3d-scene')?.classList.remove('is-loading'); }
    }
    function showSceneError(message) {
        const box = root?.querySelector('.home3d-scene-error'); if (!box) return;
        box.hidden = false; box.innerHTML = '<strong>家还在，画面需要重新准备一下</strong><p>' + esc(message) + '</p>' + button('retry', '重新进入', 'ri-refresh-line');
    }
    function updateStatus() {
        const home = H.State.home(), char = H.Bridge.char(), box = root?.querySelector('#home3d-presence'); if (!home || !box) return;
        const current = home.activity || activity, here = current?.room === home.room;
        const avatar = char?.avatar;
        box.innerHTML = '<button type="button" class="home3d-presence-avatar" data-action="char" aria-label="看看同住角色">' + (avatar && /^(data:image\/|https?:\/\/|assets\/)/.test(avatar) ? '<img src="' + esc(avatar) + '" alt="">' : icon('ri-emotion-happy-line')) + '<em></em></button><button type="button" class="home3d-presence-status" data-action="char"><strong>' + esc(H.Bridge.name(char)) + '</strong><span>' + (here ? esc(H.Living.labels[current?.action] || '在这里') : '在' + esc(H.Rooms.get(current?.room)?.name || '家里')) + '</span></button>' + (here ? '' : button('find-char', '去找Ta', 'ri-arrow-right-s-line'));
    }
    function modal(title, subtitle, content) {
        if (subtitle === '小屋设置') content = qualityControls() + content;
        if (subtitle === 'TA 的此刻') { const home = H.State.home(); content = '<p class="home3d-fineprint">共同生活第 ' + Math.max(1, Math.floor((Date.now() - home.createdAt) / 86400000) + 1) + ' 天 · ' + home.keepsakes.length + ' 件小小纪念</p>' + content; }
        const box = root.querySelector('.home3d-modal'); box.hidden = false;
        box.innerHTML = '<section class="home3d-sheet" role="dialog" aria-modal="true" aria-label="' + esc(title || subtitle) + '"><div class="home3d-sheet-head"><div><span>' + esc(subtitle) + '</span>' + (title ? '<h2>' + esc(title) + '</h2>' : '') + '</div>' + button('dismiss', '', 'ri-close-line', 'aria-label="关闭"') + '</div><div class="home3d-sheet-body">' + content + '</div></section>';
        refreshApiControls(); box.querySelector('button')?.focus();
        refreshQuality();
    }
    function dismiss() { const box = root?.querySelector('.home3d-modal'); if (box) box.hidden = true; }
    function selectFurniture(id) {
        if (H.BuildUI?.active()) { H.BuildUI.edit(id).catch(error => notice(error.message, true)); return; }
        if (id.startsWith('memory-')) { showMemories(); return; }
        const row = H.runtime?.furniture().find(f => f.placement.id === id); if (!row) return;
        const trace = H.State.home().objectState?.[H.State.home().room + ':' + id];
        const traceText = trace ? '上次使用：' + new Date(trace.lastUsedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + ' · ' + (H.Living.labels[trace.action] || trace.action) + (trace.source === 'simulation' ? '（离开期间的生活推演）' : '') : '';
        const labels = { Sit: '坐一会儿', Lie: '窝着放松', Sleep: '躺下来睡觉', Hug: '一起抱抱', 'Use Phone': '坐着看手机', 'Use Computer': '用电脑', Game: '去玩小游戏', Work: '坐下来工作', Watch: '看电视', Read: '翻一会儿书', Drink: '喝点热饮', Eat: '吃点零食', 'Look At': '看看它', 'Play Music': '打开音乐', Photo: '打开我们的相册', Care: '照顾绿植', Cook: '准备吃的', Bathe: '泡个暖暖的澡' };
        modal(row.item.name, '一起生活的小细节', '<div class="home3d-furniture-symbol">' + icon(row.item.type === 'bed' ? 'ri-hotel-bed-line' : row.item.type === 'sofa' ? 'ri-sofa-line' : 'ri-heart-3-line') + '</div><p class="home3d-fineprint">' + esc(traceText || row.placement.reason || '点一个动作，给今天留一点轻轻的陪伴。') + '</p><div class="home3d-action-grid">' + row.item.actions.map(action => button('furniture-action', labels[action] || action, '', 'data-id="' + esc(id) + '" data-behavior="' + esc(action) + '"')).join('') + '</div>' + (row.item.type === 'frame' ? button('choose-photo', '把一张照片放进相框', 'ri-image-add-line', 'class="home3d-wide"') : '') + (row.item.actions.includes('Use Phone') ? button('phone', '看看角色手机', 'ri-smartphone-line', 'class="home3d-wide"') : ''));
    }
    function showChar() {
        const home = H.State.home(), current = home?.activity || activity;
        if (!home) return;
        modal(H.Bridge.name(H.Bridge.char()), 'TA 的此刻', '<div class="home3d-char-state"><span>正在' + esc(H.Rooms.get(current?.room)?.name || '家里') + '</span><h3>' + esc(H.Living.labels[current?.action] || '休息') + '</h3><p>' + esc(current?.reason) + '</p><small>' + (current?.source === 'ai' ? '角色选择的生活计划' : '按当前时间和最近生活安排') + '</small></div><div class="home3d-action-grid">' + button('find-char', '去陪陪Ta', 'ri-heart-3-line') + button('phone', '看看角色手机', 'ri-smartphone-line') + button('chat', '说说话', 'ri-chat-1-line') + apiButton('decide', '让Ta安排一会儿', '正在想…') + '</div><p class="home3d-fineprint">“让Ta安排”会使用已设置的聊天 API，结合性格和生活事件选择动作与家具。</p>');
    }
    function showMemories() {
        const home = H.State.home(); if (!home) return;
        const memories = H.Bridge.memories();
        modal('留一点，在家里', 'MEMORIES LIVE HERE', '<p class="home3d-fineprint">重要的记忆会变成房间里的小星星。照片也能放进墙上的相框。</p>' + button('choose-photo', '选一张我们的照片', 'ri-image-add-line', 'class="home3d-wide"') + '<h3 class="home3d-list-title">已经留下的纪念</h3><div class="home3d-memory-list">' + (home.keepsakes.map(item => '<article><span>✦</span><div><strong>' + esc(item.title) + '</strong><p>' + esc(item.text) + '</p></div></article>').join('') || '<div class="home3d-empty">还没有纪念物。我们的日子慢慢来。</div>') + '</div><h3 class="home3d-list-title">从记忆中带一件回来</h3><div class="home3d-memory-list">' + (memories.map((item, index) => '<article><div><strong>' + esc(item.title || item.topic || '一起记住的事') + '</strong><p>' + esc(item.content) + '</p></div>' + button('keep-memory', home.keepsakes.some(k => k.sourceId === String(item.id)) ? '已留下' : '留下', '', 'data-memory="' + index + '" ' + (home.keepsakes.some(k => k.sourceId === String(item.id)) ? 'disabled' : '')) + '</article>').join('') || '<div class="home3d-empty">聊天中积累重要 Memory 后，就能带回这里。</div>') + '</div>');
    }
    function showJournal() {
        const home = H.State.home(); if (!home) return;
        modal('我们的日子', '不必升级，只管一起生活', '<div class="home3d-journal-stats"><div><strong>' + home.visits.length + '</strong><span>回家的日子</span></div><div><strong>' + home.moments.length + '</strong><span>一起做的小事</span></div><div><strong>' + home.keepsakes.length + '</strong><span>留在家的纪念</span></div></div><div class="home3d-timeline">' + (home.moments.slice(-60).reverse().map(item => '<article><small>' + esc(new Date(item.at).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</small><p>' + esc(item.text) + '</p>' + (item.source === 'simulation' ? '<small>离开期间的本地生活推演</small>' : item.source === 'autonomous' ? '<small>Ta的自主生活</small>' : '') + '</article>').join('') || '<div class="home3d-empty">第一天的灯已经点亮。<br>点点家具，一起开始生活吧。</div>') + '</div>');
    }
    function showExpansion() {
        const home = H.State.home();
        modal('给家添一间房', '留出更多生活的空间', '<div class="home3d-expansion">' + H.catalogs.roomCatalog.rooms.filter(room => room.expandable).map(room => button('expand-room', icon(room.icon) + '<strong>' + esc(room.name) + '</strong><span>' + (H.Rooms.available(room, home) ? '已扩建 · 去看看' : '扩建这间房') + '</span>', '', 'data-room="' + room.id + '"')).join('') + '</div>');
    }
    function portraitCard(person, who) {
        const model = H.CharacterModels.selected(person, who), id = who === 'user' ? 'bunny-blue-v1' : 'silver-red-v1';
        const image = person.portraitDraft || person.portrait, url = image?.url || (model ? H.initialModelPortraits[who] : H.initialPortraits[who]);
        const choice = '<label class="home3d-field">小屋人物<select id="home3d-' + (who === 'user' ? 'user' : 'character') + '-model"><option value="' + id + '" ' + (model ? 'selected' : '') + '>' + (who === 'user' ? '兔耳蓝裙女生' : '银发男生') + ' · 3D 模型</option><option value="portrait" ' + (!model ? 'selected' : '') + '>已保存的 Q 版立绘</option></select></label>';
        const card = '<div class="home3d-portrait-preview"><img src="' + esc(url) + '" alt="' + (who === 'user' ? '我的' : '角色') + ' Q 版立绘"><span>' + (person.portraitDraft ? '新形象 · 待确认' : person.portrait ? '已保存的立绘' : model ? '3D 初始形象预览 · 可生成专属立绘' : '初始立绘 · 可生成专属形象') + '</span></div>' + button('generate-' + who, '<span data-image-label>AI 生成 Q 版立绘</span>', 'ri-sparkling-line', 'class="home3d-wide" data-home-image data-idle="AI 生成 Q 版立绘" data-pending="正在生成立绘…"') + (person.portraitDraft ? '<div class="home3d-portrait-confirm">' + button('confirm-portrait', '使用这个形象', '', 'data-who="' + who + '"') + button('discard-portrait', '保留原形象', '', 'data-who="' + who + '"') + '</div>' : '');
        return choice + (model ? '<details><summary>立绘与生图</summary>' + card + '</details>' : card);
    }
    function qualityControls() {
        const mode = H.RenderQuality.preference();
        return '<label class="home3d-field home3d-quality-field">画质<select id="home3d-render-quality" aria-label="小屋画质">' + Object.entries(H.RenderQuality.labels).map(([id, name]) => '<option value="' + id + '" ' + (mode === id ? 'selected' : '') + '>' + name + '</option>').join('') + '</select></label><p class="home3d-fineprint" data-render-quality></p><details class="home3d-quality-help"><summary>如何选择画质？</summary><p>流畅适合普通手机和长时间陪伴；均衡兼顾清晰与流畅；极致增加近景细节，耗电会更高。自动会根据设备和运行状况调整。持续卡顿时，各模式都会适当降低负载。</p></details>';
    }
    function refreshQuality(value) {
        const hint = root?.querySelector('[data-render-quality]'), profile = value || H.runtime?.stats().quality;
        if (hint && profile) hint.textContent = H.RenderQuality.labels[profile.mode] + ' · 当前按' + H.RenderQuality.labels[profile.tier] + '画质运行';
    }
    function showInteriors() {
        const home = H.State.home(), room = H.Rooms.get(home.room), config = H.Interiors.resolve(room, home), options = H.Interiors.data();
        const select = (id, values, selected) => '<select id="' + id + '">' + Object.entries(values).map(([key, value]) => '<option value="' + key + '" ' + (key === selected ? 'selected' : '') + '>' + esc(value.name) + '</option>').join('') + '</select>';
        const cards = Object.entries(options.presets).map(([id, preset]) => button('interior-preset', '<span class="home3d-interior-swatch" style="--wall:' + options.walls[preset.wall].base + ';--floor:' + options.floors[preset.floor].base + ';--wood:' + preset.wood + ';--accent:' + preset.accent + '"><i></i><b></b></span><strong>' + esc(preset.name) + '</strong><small>' + esc(preset.description) + '</small>', '', 'data-interior="' + id + '" aria-pressed="' + (config.id === id) + '"')).join('');
        modal(room.name, '墙面、地板与风格', '<div class="home3d-interior-options">' + cards + '</div><p class="home3d-fineprint">套装搭配当前房间的家具、墙面、地板、窗帘与地毯；也可以单独换墙面和地板。</p><div class="home3d-interior-fields"><label class="home3d-field">墙面与壁纸' + select('home3d-interior-wall', options.walls, config.wall) + '</label><label class="home3d-field">地板' + select('home3d-interior-floor', options.floors, config.floor) + '</label></div>' + button('interior-finishes', '保存墙面和地板', 'ri-check-line', 'class="home3d-wide"'));
    }
    function showSettings() {
        const data = H.State.load(), home = H.State.home(data); if (!home) { setup(); return; }
        const chars = H.Bridge.characters(), char = H.Bridge.char();
        referenceDraft = data.user.reference || '';
        modal('', '小屋设置', '<p class="home3d-fineprint">小屋支持立体模型和透明 Q 版立绘，可在下方切换。生图生成的是立绘，先预览，确认后才替换。</p><h3 class="home3d-list-title">我的形象</h3><button type="button" class="home3d-reference" data-action="pick-user">' + (referenceDraft ? '<img src="' + esc(referenceDraft) + '" alt="我的参考图">' : icon('ri-user-smile-line')) + '<span>' + esc(data.user.name || '我') + '<small>更换自己的参考图</small></span><b>＋</b></button>' + portraitCard(data.user, 'user') + '<h3 class="home3d-list-title">' + esc(H.Bridge.name(char)) + '的形象</h3><p class="home3d-fineprint">参考图沿用聊天设置，生成时保留人物的发型、衣服与配饰。</p>' + portraitCard(home, 'char') + '<p class="home3d-fineprint" data-image-cooldown hidden></p>'  + '<h3 class="home3d-list-title">家的气氛</h3><div class="home3d-theme-options">' + Object.entries({ auto: { name: '跟随昼夜' }, ...H.catalogs.materialPresets.themes }).map(([id, theme]) => button('theme', esc(theme.name), '', 'data-theme="' + id + '" class="' + (home.theme === id ? 'is-current' : '') + '"')).join('') + '</div><label class="home3d-check"><input type="checkbox" id="home3d-consent" ' + (home.consentHug ? 'checked' : '') + '>允许小屋中的拥抱互动</label><label class="home3d-field">我们现在的关系<select id="home3d-relationship">' + ['朋友', '亲近', '恋人', '家人'].map(value => '<option ' + (home.relationship === value ? 'selected' : '') + '>' + value + '</option>').join('') + '</select></label><h3 class="home3d-list-title">切换同住角色</h3><label class="home3d-field"><select id="home3d-rebind">' + chars.map(char => '<option value="' + esc(char.id) + '" ' + (String(char.id) === data.activeCharId ? 'selected' : '') + '>' + esc(H.Bridge.name(char)) + '</option>').join('') + '</select></label><p class="home3d-fineprint">每位角色都有各自的小屋存档，照片和回忆会保留。小屋存档随 BYND 的整机备份一起保存。</p>' + button('rebind', '和这个人回家', 'ri-home-heart-line', 'class="home3d-wide"') + '<h3 class="home3d-list-title">以后，还有更多日常</h3><div class="home3d-future-rooms">' + H.catalogs.roomCatalog.rooms.filter(room => !room.open).map(room => '<span>' + icon(room.icon) + esc(room.name) + '</span>').join('') + '</div>' + button('expand', '给家添一间房', 'ri-add-line', 'class="home3d-wide"') + button('licenses', '家具与 3D 资源来源', 'ri-information-line', 'class="home3d-wide"'));
    }
    function showPhotos() {
        const photos = H.Bridge.photos();
        modal('把这一刻挂起来', '我们的相框', '<p class="home3d-fineprint">从角色发来的生成图里选一张，小屋会保存适合相框的小图。</p><div class="home3d-photo-grid">' + (photos.map((photo, index) => '<button type="button" data-action="photo" data-photo="' + index + '"><img src="' + esc(photo.url) + '" alt="' + esc(photo.description || '共同照片') + '" loading="lazy"></button>').join('') || '<div class="home3d-empty">还没有角色生成的照片。可以先在聊天中请Ta发一张。</div>') + '</div>');
    }
    function compact(source, maxSide = 512) {
        return new Promise((resolve, reject) => {
            const img = new Image(), timeout = setTimeout(() => { img.src = ''; reject(new Error('参考图片读取超时，请重试。')); }, 20000);
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                clearTimeout(timeout);
                try { const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight)), canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale)); canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height); const url = canvas.toDataURL('image/jpeg', 0.78); if (url.length > 350000) throw new Error('图片还是太大，请选择更小的图片。'); resolve(url); } catch (_) { reject(new Error('图片无法保存到小屋，可能不允许跨域读取。请换一张本地图片。')); }
            };
            img.onerror = () => { clearTimeout(timeout); reject(new Error('图片读取失败，原图片已保留。')); }; img.src = source;
        });
    }
    function pickUser() {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
        input.onchange = async () => {
            const file = input.files?.[0]; if (!file) return;
            if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) { notice('请选择 15MB 以内的图片。', true); return; }
            try {
                const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reader.onabort = () => reject(new Error('图片读取失败。')); reader.readAsDataURL(file); });
                const url = await compact(source);
                if (H.State.home()) { H.State.update(next => { next.user.reference = url; }); showSettings(); }
                else { referenceDraft = url; const button = root.querySelector('.home3d-reference'); button.innerHTML = '<img src="' + esc(url) + '" alt="我的参考图"><span>我的形象<small>参考图已选好</small></span><b>＋</b>'; }
                notice('参考图已选好，可以 AI 生成 Q 版立绘。');
            } catch (error) { notice(error.message, true); }
        };
        input.click();
    }
    async function generate(who) {
        if (busy || H.Portraits.busy()) return false;
        const data = H.State.load(), char = H.Bridge.char(), original = who === 'user' ? data.user.reference : H.Bridge.reference(char), session = H.session;
        busy = true; showSettings(); notice('正在按参考图生成可爱的 Q 版立绘…');
        try {
            if (!original) throw new Error('请先设置参考图。角色参考图沿用聊天设置。');
            const image = await compact(original, 768);
            await H.Portraits.generate(who, image, message => { if (session === H.session) notice(message); }, { who, charId: data.activeCharId, source: original, referenceKey: H.Bridge.referenceKey(original) });
            if (session === H.session) { showSettings(); notice('立绘已生成，满意后点击「使用这个形象」。'); }
            return true;
        } catch (error) { if (session === H.session) notice(error.message, true); return false; }
        finally { busy = false; refreshApiControls(); }
    }
    async function onClick(event) {
        if (event.target.classList.contains('home3d-modal')) { dismiss(); return; }
        const target = event.target.closest('[data-action]'); if (!target || target.disabled) return;
        const action = target.dataset.action;
        try {
            if (action.startsWith('build-')) { await H.BuildUI.action(action, target); return; }
            switch (action) {
                case 'back': window.closeApp('home3d'); break;
                case 'contacts': window.openApp('wechat'); break;
                case 'enter': await enter(); break;
                case 'home-enter': await arrive(); break;
                case 'entrance': if (H.State.home()) showEntrance(); break;
                case 'build': dismiss(); H.BuildUI.open(root); break;
                case 'expand': showExpansion(); break;
                case 'expand-room': H.Build.expand(target.dataset.room); H.BuildUI?.close(); dismiss(); await loadRoom(target.dataset.room); notice('新房间已经准备好了。'); break;
                case 'room': dismiss(); await loadRoom(target.dataset.room); break;
                case 'room-menu': modal('切换房间', '我们的家', '<div class="home3d-action-grid">' + H.catalogs.roomCatalog.rooms.filter(room => H.Rooms.available(room, H.State.home())).map(room => button('room', esc(room.name), room.icon, 'data-room="' + room.id + '"')).join('') + '</div>' + button('expand', '给家添一间房', 'ri-add-line', 'class="home3d-wide"')); break;
                case 'retry': H.runtime?.dispose(); H.runtime = null; await loadRoom(H.State.home().room); break;
                case 'settings': showSettings(); break;
                case 'interiors': showInteriors(); break;
                case 'interior-preset': H.Interiors.apply(H.State.home().room, { preset: target.dataset.interior }, true); await loadRoom(H.State.home().room); showInteriors(); notice('这间房的整套风格已保存。'); break;
                case 'interior-finishes': H.Interiors.apply(H.State.home().room, { wall: root.querySelector('#home3d-interior-wall').value, floor: root.querySelector('#home3d-interior-floor').value }); await loadRoom(H.State.home().room); showInteriors(); notice('墙面和地板已保存。'); break;
                case 'dismiss': dismiss(); break;
                case 'pick-user': pickUser(); break;
                case 'generate-user': await generate('user'); break;
                case 'generate-char': await generate('char'); break;
                case 'confirm-portrait': H.Portraits.confirm(target.dataset.who); await loadRoom(H.State.home().room); showSettings(); notice('新的形象已经住进小屋。'); break;
                case 'discard-portrait': H.Portraits.discard(target.dataset.who); showSettings(); break;
                case 'char': showChar(); break;
                case 'find-char': dismiss(); await loadRoom((H.State.home().activity || activity).room); break;
                case 'phone': dismiss(); H.Bridge.open('phone'); break;
                case 'chat': dismiss(); H.Bridge.open('chat'); break;
                case 'reset-view': H.runtime?.resetCamera(); break;
                case 'zoom-in': H.runtime?.zoom(0.15); break;
                case 'zoom-out': H.runtime?.zoom(-0.15); break;
                case 'memories': showMemories(); break;
                case 'journal': showJournal(); break;
                case 'choose-photo': showPhotos(); break;
                case 'furniture-action': dismiss(); H.Interactions.perform(target.dataset.id, target.dataset.behavior); break;
                case 'together': {
                    const home = H.State.home(), current = home.activity || activity;
                    if (current.room !== home.room) { await loadRoom(current.room); }
                    const row = H.runtime?.furniture().find(item => item.placement.id === current.target);
                    if (current.action === 'Sleep') { notice('Ta在睡觉，轻轻陪在旁边就好。'); H.runtime?.emote('Idle'); }
                    else if (row?.item.actions.includes('Sit')) H.Interactions.perform(row.placement.id, 'Sit');
                    else { H.runtime?.emote('Wave'); H.State.moment('Wave', '回家时，朝对方轻轻挥了挥手'); notice('我回家啦。'); }
                    break;
                }
                case 'keep-memory': H.State.keepMemory(H.Bridge.memories()[Number(target.dataset.memory)]); await loadRoom(H.State.home().room); showMemories(); notice('这段回忆变成了一颗小星星，放在家里。'); break;
                case 'photo': {
                    const photo = H.Bridge.photos()[Number(target.dataset.photo)]; if (!photo) throw new Error('这张照片已不可用。');
                    const charId = H.State.load().activeCharId, session = H.session;
                    const url = await compact(photo.url); H.State.withHome((current, next) => { if (next.activeCharId !== charId) throw new Error('同住角色已切换，照片没有放入相框。'); current.photo = { id: String(photo.id), url, title: String(photo.description || '').slice(0, 160) }; });
                    if (session !== H.session) return;
                    dismiss(); await loadRoom(H.State.home().room); notice('照片已经挂进我们的相框。'); break;
                }
                case 'theme': H.State.withHome(current => { current.theme = target.dataset.theme; }); H.runtime?.dispose(); H.runtime = null; await loadRoom(H.State.home().room); showSettings(); break;
                case 'rebind': H.State.bind(root.querySelector('#home3d-rebind').value, H.State.load().user); H.State.visit(); dismiss(); H.runtime?.dispose(); H.runtime = null; await loadRoom(H.State.home().room); break;
                case 'decide': {
                    if (busy || H.Bridge.requestBusy()) return; busy = true; showChar(); notice('Ta正在安排接下来的一小段日常…');
                    const session = H.session;
                    try { const decision = await H.Living.decide(); if (session !== H.session) return; activity = H.State.home().activity; dismiss(); await loadRoom(decision.room); notice(decision.reason); } finally { busy = false; refreshApiControls(); }
                    break;
                }
                case 'licenses': modal('家里的小小来处', '感谢这些创作者', Object.values(H.catalogs.furnitureCatalog.sources).map(source => '<article class="home3d-license"><strong>' + esc(source.author) + '</strong><p>' + esc(source.license) + ' · 可商用 · 可修改 · ' + (source.attributionRequired ? '需要署名' : '无需署名') + '</p>' + (/^https:/.test(source.source) ? '<a href="' + esc(source.source) + '" target="_blank" rel="noopener">官方资产页面 ↗</a>' : '') + '</article>').join('') + '<p class="home3d-fineprint">Three.js r180 · MIT License。家具几何来自已审核的本地资产，材质、房间与可活动小人由 BYND 统一构建。</p>'); break;
            }
        } catch (error) { notice(error.message || '这次操作没有完成，请重试。', true); }
    }
    async function onChange(event) {
        const target = event.target;
        try {
            if (H.BuildUI?.change(target)) return;
            if (target.id === 'home3d-render-quality') { try { H.runtime?.setQuality(target.value); refreshQuality(); } catch (error) { target.value = H.RenderQuality.preference(); throw error; } return; }
            if (['home3d-character-model', 'home3d-user-model'].includes(target.id)) {
                const who = target.id === 'home3d-user-model' ? 'user' : 'char', person = who === 'user' ? H.State.load().user : H.State.home();
                const previous = H.CharacterModels.modelId(person, who), allowed = who === 'user' ? 'bunny-blue-v1' : 'silver-red-v1';
                try { if (![allowed, 'portrait'].includes(target.value)) throw new Error('人物形象选项无效。'); H.State.update(data => { (who === 'user' ? data.user : H.State.home(data)).modelId = target.value; }); } catch (error) { target.value = previous; throw error; }
                await loadRoom(H.State.home().room); showSettings(); return;
            }
            if (target.dataset.avatarField) {
                const who = target.dataset.who, key = target.dataset.avatarField;
                H.State.update(next => { const profile = who === 'user' ? next.user.avatar : next.homes[next.activeCharId].charAvatar; profile[key] = target.value; });
                await loadRoom(H.State.home().room);
            } else if (target.id === 'home3d-consent') H.State.withHome(current => { current.consentHug = target.checked; });
            else if (target.id === 'home3d-relationship') { H.State.withHome(current => { current.relationship = target.value; current.activity = null; }); await loadRoom(H.State.home().room); }
        } catch (error) { notice(error.message, true); }
    }
    H.UI = { open, close, notice, updateStatus, showSceneError, showMemories, compact, loadRoom, arrive, refreshLife, showExpansion, showInteriors };
})(window.ByndHome3D);
