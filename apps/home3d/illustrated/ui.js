/* 2.5D 小屋 · screens and the life loop.
   Uses the same saves, living planner and action receipts as the 3D house, so the chat
   prompt, the journal and the Living World see one continuous home. */
(function (H) {
    'use strict';
    const VIEW_KEY = 'bynd_home_view_v1';
    const esc = H.Room25.esc;
    const EXTRA = {
        zzz: '<path d="M4 6h6l-6 7h6M13 4h5l-5 6h5M15 14h4l-4 5h4"/>',
        tv: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="m9 2 3 4 3-4M8 21h8"/>',
        laptop: '<rect x="5" y="5" width="14" height="10" rx="2"/><path d="M3 19h18"/>',
        cup: '<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 3v2m3-2v2"/>',
        pan: '<circle cx="9" cy="13" r="6"/><path d="M15 13h7"/>',
        music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
        walk: '<circle cx="13" cy="4" r="2"/><path d="m9 21 3-7 3 3v4M7 12l3-4 4 1 2 4"/>',
        journal: '<path d="M6 3h11a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 7h7M8 11h7M8 15h4"/>',
        pat: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4m0-5a1.5 1.5 0 0 1 3 0v5m0-4a1.5 1.5 0 0 1 3 0v5m0-2a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-4l-2-4a1.5 1.5 0 0 1 2.6-1.5L7 13"/>',
        bath: '<path d="M3 12h18v2a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6zM6 12V5a2 2 0 0 1 4 0M7 20l-1 2m11-2 1 2"/>',
        door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M15 12h.01"/>',
        cube: '<path d="m12 2 9 5v10l-9 5-9-5V7zM12 22V12M3 7l9 5 9-5"/>',
        pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
        stop: '<rect x="6" y="6" width="12" height="12" rx="3"/>'
    };
    const icon = name => EXTRA[name] ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + EXTRA[name] + '</svg>' : H.Icons.paint(name);
    const ACTION_ICON = { Sleep: 'zzz', Lie: 'ri-hotel-bed-line', Sit: 'ri-sofa-line', Read: 'ri-book-open-line', 'Use Phone': 'ri-smartphone-line', Watch: 'tv', Game: 'ri-gamepad-line', Work: 'laptop', 'Use Computer': 'laptop', Drink: 'cup', Eat: 'ri-restaurant-line', Cook: 'pan', Care: 'ri-plant-line', 'Play Music': 'music', Bathe: 'bath', Shower: 'ri-drop-line', 'Wash Hands': 'ri-drop-line', 'Wash Face': 'ri-drop-line', Groom: 'ri-sparkling-line', 'Use Toilet': 'door', Walk: 'walk', Idle: 'ri-emotion-happy-line', Hug: 'ri-heart-3-line', 'Look At': 'ri-eye-line' };
    const LABELS = { Sit: '坐一会儿', Lie: '躺一会儿', Sleep: '睡觉', Hug: '抱抱', 'Use Phone': '看手机', 'Use Computer': '用电脑', Game: '打游戏', Work: '工作', Watch: '看电视', Read: '看书', Drink: '喝点热的', Eat: '吃点东西', 'Look At': '看看它', 'Play Music': '弹琴', Care: '浇浇水', Cook: '做饭', Bathe: '泡澡', Shower: '冲个澡', 'Wash Hands': '洗手', 'Wash Face': '洗脸', 'Use Toilet': '去洗手间', Groom: '照照镜子' };
    const TOGETHER = { Sit: '并肩坐坐', Read: '一起看书', Watch: '一起看电视', 'Use Phone': '一起刷手机', Sleep: '一起睡觉', Lie: '一起躺一会儿', Eat: '一起吃饭', Drink: '一起喝点东西' };
    const SKIP = new Set(['Change Outfit', 'Photo', 'Memory', 'Hug']);
    const ROOM_SKIP = new Set(['hallway', 'upper_hallway', 'stair_hall', 'landing', 'garden']);

    let root = null, scene = null, roomId = '', timer = 0, bubbleTimer = 0, noticeTimer = 0, session = 0;
    let user = null;            // { tokens, row, action, together }
    let charShown = null;       // last applied activity key

    const view = () => { try { return localStorage.getItem(VIEW_KEY) === '3d' ? '3d' : 'illustrated'; } catch (_) { return 'illustrated'; } };
    function setView(mode) { try { localStorage.setItem(VIEW_KEY, mode); } catch (_) { notice('这台设备没能保存画面设置。', true); return false; } return true; }
    const charName = () => H.Bridge.name(H.Bridge.char());
    const home = () => H.State.home();
    const ctx = () => { try { return H.Bridge.context(); } catch (_) { return { history: [], events: [], personality: '', phone: {} }; } };

    function sprites() {
        const data = H.State.load(), h = H.State.home(data);
        const pick = (person, who) => {
            const p = person?.portrait;
            // Same rule as the 3D house: a saved portrait wins only when chosen (or
            // when no model was ever chosen); otherwise the packaged 3D figure is used.
            const portrait = person?.modelId === 'portrait' || (!person?.modelId && p);
            if (!portrait) return { model: true };
            if (p?.url && /^data:image\/png;base64,/.test(p.url)) {
                const ratio = p.width && p.height ? p.width / p.height : H.Room25.DOLLS[who].ratio;
                return { stand: p.url, sleep: '', custom: true, ratio };
            }
            return null;
        };
        return { user: pick(data.user, 'user'), char: pick(h, 'char') };
    }

    // ---------- shell ----------
    function notice(message, error = false) {
        const box = root?.querySelector('.h25-notice'); if (!box) return;
        clearTimeout(noticeTimer); box.textContent = message; box.classList.toggle('is-error', !!error); box.hidden = false;
        noticeTimer = setTimeout(() => { box.hidden = true; }, error ? 8000 : 4200);
    }
    function availableRooms(h = home()) {
        return H.catalogs.roomCatalog.rooms.filter(r => !ROOM_SKIP.has(r.id) && H.Rooms.available(r, h) && (r.furniture.length >= 2 || (h.layouts?.[r.id] && Object.keys(h.layouts[r.id].items || {}).length)));
    }
    function clockText() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

    function header(title, sub, right = '') {
        return '<header class="h25-header"><button type="button" class="h25-round" data-act="back" aria-label="返回桌面">' + icon('ri-arrow-left-s-line') + '</button><div class="h25-title"><strong>' + esc(title) + '</strong><small>' + sub + '</small></div>' + right + '</header>';
    }

    async function open(element, sessionId) {
        close(); root = element; session = sessionId; root.className = 'h25-root';
        root.onclick = onClick;
        const data = H.State.load();
        if (!data.activeCharId || !H.Bridge.char() || !H.State.home(data)) { setup(); return; }
        try { H.State.visit(); } catch (error) { /* A full disk should not block entering. */ }
        entrance();
    }

    function setup() {
        const chars = H.Bridge.characters();
        root.dataset.screen = 'setup';
        root.innerHTML = header('小屋', '两个人的日常') + '<main class="h25-setup"><div class="h25-setup-art" aria-hidden="true"></div><h1>我们的小屋</h1><p>选一个一起生活的人，点亮家里的灯。</p>' +
            (chars.length ? '<div class="h25-pick">' + chars.map(c => '<button type="button" data-act="bind" data-id="' + esc(c.id) + '">' + (c.avatar && /^(data:image\/|https?:\/\/)/.test(c.avatar) ? '<img src="' + esc(c.avatar) + '" alt="">' : '<span>' + esc(H.Bridge.name(c).slice(0, 1)) + '</span>') + '<b>' + esc(H.Bridge.name(c)) + '</b></button>').join('') + '</div>'
                : '<p class="h25-fine">通讯录里还没有单聊角色。先在微信里添加一个角色，再回来点亮小屋。</p>') +
            '</main><div class="h25-notice" role="status" hidden></div>';
    }

    function entrance() {
        root.dataset.screen = 'entrance';
        const h = home(), night = ['night', 'dawn'].includes(H.Room25.timeOfDay());
        const days = Math.max(1, Math.floor((Date.now() - h.createdAt) / 86400000) + 1);
        root.innerHTML = '<main class="h25-entry' + (night ? ' is-night' : '') + '">' +
            '<div class="h25-entry-top"><button type="button" class="h25-round" data-act="back" aria-label="返回桌面">' + icon('ri-arrow-left-s-line') + '</button></div>' +
            '<div class="h25-entry-title"><span>OUR LITTLE HOME</span><h1>我们的小屋</h1><p>' + (night ? '灯还亮着，回来吧。' : '今天也在一起生活。') + '</p></div>' +
            '<div class="h25-entry-art"><img src="assets/home3d/entrance/' + (night ? 'night' : 'day') + '.png" alt="' + (night ? '夜晚亮着灯的小屋' : '白天的小屋') + '"></div>' +
            '<div class="h25-entry-actions"><button type="button" class="h25-primary" data-act="enter">' + icon('ri-home-heart-line') + '回家</button><small>和' + esc(charName()) + '一起生活的第 ' + days + ' 天</small></div></main><div class="h25-notice" role="status" hidden></div>';
    }

    function shell() {
        root.dataset.screen = 'room';
        const h = home(), days = Math.max(1, Math.floor((Date.now() - h.createdAt) / 86400000) + 1);
        const right = '<button type="button" class="h25-round" data-act="journal" aria-label="日常">' + icon('journal') + '</button><button type="button" class="h25-round" data-act="settings" aria-label="小屋设置">' + icon('ri-settings-4-line') + '</button>';
        root.innerHTML = header('小屋', '<span class="h25-clock"></span> · 第 ' + days + ' 天', right) +
            '<nav class="h25-rooms" aria-label="房间"></nav>' +
            '<main class="h25-world"><div class="h25-scene"></div><div class="h25-bubbles" aria-live="polite"></div>' +
            '<div class="h25-tools"><button type="button" class="h25-round is-small" data-act="zoom-in" aria-label="放大">' + icon('ri-add-line') + '</button><button type="button" class="h25-round is-small" data-act="zoom-out" aria-label="缩小">' + icon('ri-subtract-line') + '</button><button type="button" class="h25-round is-small" data-act="find" aria-label="找到 Ta">' + icon('ri-focus-3-line') + '</button></div>' +
            '<section class="h25-dock"></section></main>' +
            '<div class="h25-sheet-wrap" data-act="backdrop" hidden><div class="h25-sheet" role="dialog" aria-modal="true"></div></div><div class="h25-notice" role="status" hidden></div>';
        scene = H.Room25.mount(root.querySelector('.h25-scene'), { onFurniture, onActor, onFloor, onFrame: bubbles });
        tickClock();
    }
    function tickClock() { const c = root?.querySelector('.h25-clock'); if (c) c.textContent = clockText(); }

    function roomTabs() {
        const nav = root.querySelector('.h25-rooms'), h = home(), here = h.activity?.room;
        nav.innerHTML = availableRooms(h).map(r => '<button type="button" data-act="room" data-room="' + r.id + '" class="' + (r.id === roomId ? 'is-current' : '') + '" aria-pressed="' + (r.id === roomId) + '">' + esc(r.name) + (r.id === here ? '<i class="h25-dot" aria-label="Ta 在这里"></i>' : '') + '</button>').join('');
        nav.querySelector('.is-current')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    }

    function photo() {
        try { const list = H.Bridge.photos(); const p = list.find(x => /^(data:image\/|https?:\/\/)/.test(x?.url || x?.src || x?.image || '')); return p ? (p.url || p.src || p.image) : ''; } catch (_) { return ''; }
    }

    // ---------- entering & rooms ----------
    async function enter() {
        try { H.Living.advance(ctx()); } catch (error) { notice(error.message, true); }
        shell();
        const h = home(), start = H.Rooms.available(H.Rooms.get(h.activity?.room), h) && !ROOM_SKIP.has(h.activity?.room) ? h.activity.room : (availableRooms(h)[0]?.id || 'living_room');
        showRoom(start, { arrive: true });
        startLife();
        const summary = home().awaySummary;
        if (summary && Date.now() - summary.until < 30000) notice('你不在的时候，' + charName() + '也好好生活着。点右上角「日常」看看。');
    }

    function showRoom(id, opts = {}) {
        endUser('finished', '换了个房间');
        roomId = id;
        try { H.State.withHome(h => { h.room = id; }); } catch (_) { /* Display still works without saving the room. */ }
        const h = home();
        const cfg = scene.render(id, h, { photo: photo() });
        root.querySelector('.h25-world').dataset.tod = cfg.tod;
        root.dataset.tod = cfg.tod;
        const sp = sprites();
        // You come in through the front of the room.
        const door = H.Animation.nearest({ x: cfg.W / 2 - 1.1, z: cfg.D / 2 - .7 }, scene.obstacles(), [cfg.W, cfg.D], .2) || { x: 0, z: cfg.D / 2 - .7 };
        scene.place('user', { x: door.x, z: door.z, sprite: sp.user });
        scene.ensureActor('char', sp.char);
        charShown = null;
        applyChar(h.activity, true);
        roomTabs(); dock();
        requestAnimationFrame(() => { if (scene) { const a = scene.actor('char'); scene.focusActor(a?.visible ? 'char' : 'user', 1.9); bubbles(); } });
    }

    // ---------- the character's own life ----------
    const actKey = a => a ? [a.action, a.room, a.target || ''].join('|') : '';
    function applyChar(activity, immediate) {
        if (!activity || !scene) return;
        if (H.Actions && user?.together) return;
        const key = actKey(activity);
        if (!immediate && key === charShown) return;
        charShown = key;
        const visible = activity.room === roomId;
        let token = null;
        try { token = H.Actions.begin('char', activity, { restore: immediate, simulated: !visible }); }
        catch (error) { notice(error.message, true); }
        const report = (phase, reason = '') => { try { if (token) H.Actions.transition(token, phase, reason); } catch (error) { notice(error.message, true); } dock(); };
        if (!visible) { scene.hide('char'); report('acting'); dock(); roomTabs(); return; }
        const sp = sprites().char, row = activity.target ? scene.row(activity.target) : null;
        const a = scene.ensureActor('char', sp); a.visible = true;
        if (!row || activity.action === 'Walk' || activity.action === 'Idle') {
            const cfg = scene.config(), seed = activity.wanderSeed || Date.now();
            const spot = H.Animation.nearest({ x: ((seed % 7) / 7 - .5) * (cfg.W - 1.6), z: (((seed >> 3) % 5) / 5 - .3) * (cfg.D - 1.6) }, scene.obstacles(), [cfg.W, cfg.D], .2) || { x: 0, z: 0 };
            if (immediate || !a.screen) { scene.place('char', { x: spot.x, z: spot.z, sprite: sp }); report('acting'); }
            else { report('walking'); if (!scene.walkTo('char', spot, () => report('acting'))) { scene.place('char', { x: spot.x, z: spot.z, sprite: sp }); report('acting'); } }
            dock(); return;
        }
        const use = useRow(row, activity.action);
        if (immediate || !a.screen) { scene.place('char', { row: use, action: activity.action, sprite: sp }); report('acting'); }
        else {
            report('walking');
            const ok = scene.walkTo('char', { row: use }, () => { scene.settle('char', use, activity.action); report('acting'); bubbles(); });
            if (!ok) { scene.place('char', { row: use, action: activity.action, sprite: sp }); report('acting'); }
        }
        dock();
    }
    function useRow(row, action) {
        const rows = scene.rows().map(r => ({ ...r, area: roomId }));
        const found = H.Rooms.useRow(rows, { ...row, area: roomId }, action);
        return found ? scene.row(found.placement.id) || row : row;
    }

    function startLife() {
        clearInterval(timer); clearInterval(bubbleTimer);
        timer = setInterval(() => {
            if (document.hidden || !root?.closest('.app-window')?.classList.contains('active')) return;
            tickClock();
            if (user?.together) return;
            try {
                const data = H.Living.advance(ctx(), Date.now(), !!scene?.actor('char')?.visible);
                applyChar(H.State.home(data).activity, false); roomTabs();
            } catch (error) { notice(error.message, true); }
        }, 10000);
        bubbleTimer = setInterval(bubbles, 600);
    }

    // ---------- your actions ----------
    function endUser(phase = 'finished', reason = '已结束') {
        if (!user) return;
        const current = user; user = null;
        try {
            if (current.together) H.Actions.transitionGroup(current.tokens, phase, reason, Date.now(), true);
            else H.Actions.end('user', phase, reason);
        } catch (error) { notice(error.message, true); }
        if (!scene) return;
        const a = scene.actor('user');
        if (a && a.pose !== 'stand') { const p = scene.standPoint(a); scene.place('user', { x: p.x, z: p.z, sprite: sprites().user }); }
        if (current.together) { charShown = null; const h = home(); applyChar(h.activity, false); }
        dock();
    }

    function perform(row, action, together) {
        closeSheet();
        if (action === 'Look At') { notice(row.placement.reason || '这里有我们一起生活的小小痕迹。'); return; }
        endUser('finished', '换了件事做');
        const use = useRow(row, action);
        if (together) {
            try { H.Rooms.sharedAnchors(scene.rows().map(r => ({ ...r, area: roomId })), { ...row, area: roomId }, action); }
            catch (error) { notice(error.message, true); return; }
            let tokens;
            try { tokens = H.Actions.beginGroup(['user', 'char'].map(actor => ({ actor, room: roomId, target: use.placement.id, action, source: 'interaction' }))); }
            catch (error) { notice(error.message, true); return; }
            user = { tokens, row: use, action, together: true };
            try { H.Actions.transitionGroup(tokens, 'walking'); } catch (error) { notice(error.message, true); }
            const c = scene.ensureActor('char', sprites().char);
            if (!c.visible) { c.visible = true; const p = scene.actor('user'); scene.place('char', { x: p.x + .4, z: p.z, sprite: sprites().char }); }
            let waiting = 2;
            const arrived = () => {
                if (--waiting) return;
                if (user?.tokens !== tokens) return;
                scene.settle('user', use, action); scene.settle('char', use, action);
                try { H.Actions.transitionGroup(tokens, 'acting'); } catch (error) { notice(error.message, true); }
                notice((TOGETHER[action] || '一起待一会儿') + '。点下面的「结束」可以起身。'); dock(); bubbles();
            };
            for (const who of ['user', 'char']) if (!scene.walkTo(who, { row: use }, arrived)) { scene.settle(who, use, action); arrived(); }
            dock(); return;
        }
        let token;
        try { token = H.Actions.begin('user', { room: roomId, target: use.placement.id, action }); H.Actions.transition(token, 'walking'); }
        catch (error) { notice(error.message, true); return; }
        user = { tokens: [token], row: use, action, together: false };
        const done = () => {
            if (user?.tokens[0] !== token) return;
            scene.settle('user', use, action);
            try { H.Actions.transition(token, 'acting'); } catch (error) { notice(error.message, true); }
            dock();
        };
        if (!scene.walkTo('user', { row: use }, done)) {
            try { H.Actions.transition(token, 'blocked', '前面被家具挡住了'); } catch (_) { /* Keep the visible message. */ }
            user = null; notice('走不过去，家具前面留一点空地再试试。', true);
        }
        dock();
    }

    function onFurniture(row) {
        const item = row.item, actions = (item.actions || []).filter(a => !SKIP.has(a) && (LABELS[a]));
        const shared = H.Rooms.sharedActions(item);
        const style = H.catalogs.furnitureCatalog.styles[item.style]?.name || '';
        const solo = actions.map(a => '<button type="button" data-act="do" data-action="' + esc(a) + '">' + icon(ACTION_ICON[a] || 'ri-sparkling-line') + '<span>' + esc(LABELS[a]) + '</span></button>').join('');
        const both = Object.keys(shared).filter(a => TOGETHER[a]).map(a => '<button type="button" data-act="do-together" data-action="' + esc(a) + '">' + icon(ACTION_ICON[a] || 'ri-heart-3-line') + '<span>' + esc(TOGETHER[a]) + '</span></button>').join('');
        const last = home().objectState?.[roomId + ':' + row.placement.id];
        sheet('<div class="h25-sheet-head"><div><span>' + esc(item.category || '') + (style ? ' · ' + esc(style) : '') + '</span><h2>' + esc(item.name) + '</h2></div><button type="button" class="h25-round is-small" data-act="close" aria-label="关闭">' + icon('ri-close-line') + '</button></div>' +
            '<div class="h25-sheet-body">' +
            (solo ? '<h3>我去</h3><div class="h25-grid">' + solo + '</div>' : '<p class="h25-fine">它安静地待在这里，是家的一部分。</p>') +
            (both ? '<h3>和' + esc(charName()) + '一起</h3><div class="h25-grid is-together">' + both + '</div>' : '') +
            (last?.lastUsedAt ? '<p class="h25-fine">上次用它：' + esc(new Date(last.lastUsedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + ' · ' + esc(LABELS[last.action] || H.Living.labels[last.action] || '') + '</p>' : '') +
            '</div>', { row });
    }

    function onActor(who) {
        if (who === 'user') {
            if (user) sheet(sheetHead('你', '此刻') + '<div class="h25-sheet-body"><p class="h25-state">' + esc(user.together ? TOGETHER[user.action] : LABELS[user.action] || '在家里') + '</p><button type="button" class="h25-wide" data-act="end">' + icon('stop') + '起身，结束这件事</button></div>');
            else notice('点地板走过去，点家具可以坐下、看书、做饭……');
            return;
        }
        const h = home(), act = h.activity, status = (act?.room === roomId ? H.Actions.status(h) : '') || H.Living.labels[act?.action] || '在家';
        const body = '<div class="h25-sheet-body"><p class="h25-state">' + esc(status) + '</p>' + (act?.reason ? '<p class="h25-fine">' + esc(act.reason) + '</p>' : '') +
            '<div class="h25-grid">' +
            '<button type="button" data-act="hug">' + icon('ri-heart-3-line') + '<span>抱抱</span></button>' +
            '<button type="button" data-act="pat">' + icon('pat') + '<span>摸摸头</span></button>' +
            '<button type="button" data-act="chat">' + icon('ri-chat-1-line') + '<span>说说话</span></button>' +
            '<button type="button" data-act="phone">' + icon('ri-smartphone-line') + '<span>Ta 的手机</span></button>' +
            '</div></div>';
        sheet(sheetHead(charName(), 'TA 的此刻') + body);
    }
    const sheetHead = (title, eyebrow) => '<div class="h25-sheet-head"><div><span>' + esc(eyebrow) + '</span><h2>' + esc(title) + '</h2></div><button type="button" class="h25-round is-small" data-act="close" aria-label="关闭">' + icon('ri-close-line') + '</button></div>';

    function onFloor(point) {
        if (user?.together) { notice('正在和' + charName() + '一起，先点「结束」再走开。'); return; }
        endUser('finished', '起身走走');
        scene.walkTo('user', point, () => dock());
    }

    function hugOrPat(kind) {
        closeSheet();
        const c = scene.actor('char');
        if (!c?.visible) { notice(charName() + '现在在' + (H.Rooms.get(home().activity?.room)?.name || '别的房间') + '。'); return; }
        if (user?.together) { notice('先结束现在一起做的事。'); return; }
        endUser('finished', '走到 Ta 身边');
        const side = { x: c.x + (c.pose === 'stand' ? .42 : .55), z: c.z + (c.pose === 'stand' ? .12 : .5) };
        const go = scene.walkTo('user', side, () => {
            const u = scene.actor('user');
            u.dir = Math.atan2(c.x - u.x, c.z - u.z); if (c.pose === 'stand') c.dir = u.dir + Math.PI;
            if (kind === 'hug' && c.pose === 'stand') { u.facing = -1; scene.lean('user', -8); scene.lean('char', 8); } else scene.lean('user', 0);
            scene.setMood('char', 'happy'); hearts(kind === 'hug' ? 5 : 3);
            try { H.State.moment(kind === 'hug' ? 'Hug' : 'Pat', kind === 'hug' ? '在小屋里抱了抱' + charName() : '摸了摸' + charName() + '的头', 'interaction'); } catch (error) { notice(error.message, true); }
            notice(kind === 'hug' ? '靠近一点，就这样抱一会儿。' : charName() + '眯起眼睛蹭了蹭你的手。');
            setTimeout(() => { if (!scene) return; scene.lean('user', 0); scene.lean('char', 0); scene.setMood('char', ''); }, 4500);
        });
        if (!go) notice('走不到 Ta 身边，周围太挤了。', true);
    }
    function hearts(n) {
        const box = root.querySelector('.h25-bubbles'), pos = scene.screenOf('char'); if (!box || !pos) return;
        for (let i = 0; i < n; i++) {
            const el = document.createElement('i'); el.className = 'h25-heart'; el.innerHTML = icon('ri-heart-3-line');
            el.style.left = (pos[0] + (i - n / 2) * 12) + 'px'; el.style.top = (pos[1] + 10) + 'px'; el.style.animationDelay = (i * .18) + 's';
            box.appendChild(el); setTimeout(() => el.remove(), 2600 + i * 180);
        }
    }

    // ---------- bubbles & dock ----------
    function bubbles() {
        if (!scene || !root) return;
        const box = root.querySelector('.h25-bubbles'); if (!box) return;
        const h = home(), act = h?.activity;
        const charLabel = act && scene.actor('char')?.visible ? (scene.actor('char').path.length ? '走过来' : (act.action === 'Sleep' ? '睡着了' : (H.Living.labels[act.action] || LABELS[act.action] || ''))) : '';
        for (const who of ['char', 'user']) {
            let el = box.querySelector('[data-bubble="' + who + '"]');
            const pos = scene.screenOf(who);
            const text = who === 'char' ? charLabel : (user && !scene.actor('user').path.length ? (user.together ? TOGETHER[user.action] : LABELS[user.action]) : '');
            if (!pos || !text) { el?.remove(); continue; }
            if (!el) { el = document.createElement('div'); el.className = 'h25-bubble is-' + who; el.dataset.bubble = who; box.appendChild(el); }
            const action = who === 'char' ? act.action : user.action, html = icon(ACTION_ICON[action] || 'ri-sparkling-line') + '<span>' + esc(text) + '</span>';
            if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
            el.classList.toggle('is-sleep', who === 'char' && act.action === 'Sleep');
            el.style.transform = 'translate(' + Math.round(pos[0]) + 'px,' + Math.round(pos[1] - 8) + 'px) translate(-50%,-100%)';
        }
    }

    function dock() {
        const box = root?.querySelector('.h25-dock'); if (!box || !scene) return;
        const h = home(), act = h.activity, here = act?.room === roomId, room = H.Rooms.get(act?.room);
        const avatar = H.Bridge.char()?.avatar;
        const status = (here ? H.Actions.status(h) : '') || H.Living.labels[act?.action] || '在家';
        const mine = user ? '<div class="h25-me"><span>' + icon(ACTION_ICON[user.action] || 'ri-user-smile-line') + (user.together ? esc(TOGETHER[user.action]) : '你在' + esc(LABELS[user.action] || '')) + '</span><button type="button" data-act="end">结束</button></div>' : '';
        box.innerHTML = '<div class="h25-presence"><button type="button" class="h25-avatar" data-act="char" aria-label="看看' + esc(charName()) + '">' + (avatar && /^(data:image\/|https?:\/\/)/.test(avatar) ? '<img src="' + esc(avatar) + '" alt="">' : '<b>' + esc(charName().slice(0, 1)) + '</b>') + '</button>' +
            '<div><strong>' + esc(charName()) + '<em>' + esc(room?.name || '家里') + '</em></strong><p>' + esc(status) + (act?.reason && act.reason !== status ? ' · ' + esc(act.reason) : '') + '</p></div>' +
            (here ? '<button type="button" class="h25-chip" data-act="char">' + icon('ri-heart-3-line') + '互动</button>' : '<button type="button" class="h25-chip is-go" data-act="go">' + icon('pin') + '去找 Ta</button>') + '</div>' + mine;
    }

    // ---------- sheets ----------
    let sheetContext = null;
    function sheet(html, context = null) {
        const wrap = root.querySelector('.h25-sheet-wrap'); if (!wrap) return;
        sheetContext = context; wrap.querySelector('.h25-sheet').innerHTML = html; wrap.hidden = false;
        requestAnimationFrame(() => wrap.classList.add('is-open'));
    }
    function closeSheet() { const wrap = root?.querySelector('.h25-sheet-wrap'); if (!wrap) return; wrap.classList.remove('is-open'); wrap.hidden = true; sheetContext = null; }

    function journal() {
        const h = home(), rows = (h.moments || []).slice(-60).reverse().filter((m, i, list) => !(i && list[i - 1].text === m.text && Math.abs(list[i - 1].at - m.at) < 5000)).slice(0, 40);
        const fmt = at => new Date(at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const tag = s => s === 'simulation' ? '你不在时' : s === 'interaction' ? '一起' : s === 'autonomous' ? 'Ta 自己' : '';
        sheet(sheetHead('日常', '小屋里的点点滴滴') + '<div class="h25-sheet-body">' + (rows.length ? '<ol class="h25-journal">' + rows.map(m => '<li><time>' + esc(fmt(m.at)) + '</time><p>' + esc(m.text) + '</p>' + (tag(m.source) ? '<em>' + tag(m.source) + '</em>' : '') + '</li>').join('') + '</ol>' : '<p class="h25-fine">还没有记录。一起坐坐、做顿饭，这里就会慢慢写满。</p>') + '</div>');
    }
    function settings() {
        const chars = H.Bridge.characters(), current = H.State.load().activeCharId;
        sheet(sheetHead('小屋设置', '画面与同住') + '<div class="h25-sheet-body">' +
            '<h3>画面</h3><div class="h25-seg" role="radiogroup"><button type="button" class="is-on" aria-checked="true" role="radio">' + icon('ri-home-heart-line') + '插画小屋</button><button type="button" data-act="to-3d" role="radio" aria-checked="false">' + icon('cube') + '经典 3D</button></div>' +
            '<p class="h25-fine">插画小屋更轻、手机上更流畅。专属形象生成、装修摆放和墙地风格目前在经典 3D 里调整，改完回来这里同样生效。</p>' +
            (chars.length > 1 ? '<h3>同住的人</h3><div class="h25-pick is-row">' + chars.map(c => '<button type="button" data-act="rebind" data-id="' + esc(c.id) + '" class="' + (String(c.id) === current ? 'is-on' : '') + '">' + (c.avatar && /^(data:image\/|https?:\/\/)/.test(c.avatar) ? '<img src="' + esc(c.avatar) + '" alt="">' : '<span>' + esc(H.Bridge.name(c).slice(0, 1)) + '</span>') + '<b>' + esc(H.Bridge.name(c)) + '</b></button>').join('') + '</div><p class="h25-fine">每个人都有自己的一间小屋，切换不会清掉原来的家。</p>' : '') +
            '</div>');
    }

    // ---------- clicks ----------
    async function onClick(event) {
        const button = event.target.closest('[data-act]'); if (!button || !root.contains(button)) return;
        const act = button.dataset.act;
        try {
            switch (act) {
                case 'back': window.closeApp?.('home3d'); break;
                case 'bind': H.State.bind(button.dataset.id, {}); H.State.visit(); entrance(); break;
                case 'enter': await enter(); break;
                case 'room': if (button.dataset.room !== roomId) showRoom(button.dataset.room); break;
                case 'go': closeSheet(); showRoom(home().activity.room); break;
                case 'char': onActor('char'); break;
                case 'close': closeSheet(); break;
                case 'backdrop': if (event.target === button) closeSheet(); break;
                case 'do': perform(sheetContext.row, button.dataset.action, false); break;
                case 'do-together': perform(sheetContext.row, button.dataset.action, true); break;
                case 'end': closeSheet(); endUser('finished', '起身了'); break;
                case 'hug': hugOrPat('hug'); break;
                case 'pat': hugOrPat('pat'); break;
                case 'chat': closeSheet(); H.Bridge.open('chat'); break;
                case 'phone': closeSheet(); H.Bridge.open('phone'); break;
                case 'journal': journal(); break;
                case 'settings': settings(); break;
                case 'to-3d': if (setView('3d')) { closeSheet(); H.close(); H.open(); } break;
                case 'rebind': { if (button.dataset.id === H.State.load().activeCharId) break; endUser('cancelled', '换了同住的人'); H.State.bind(button.dataset.id, H.State.load().user); H.State.visit(); closeSheet(); await enter(); break; }
                case 'zoom-in': scene.focusActor(scene.actor('char')?.visible ? 'char' : 'user', Math.min(2.6, scene.zoom() * 1.25)); break;
                case 'zoom-out': scene.fitAll(); break;
                case 'find': { const c = scene.actor('char'); if (c?.visible) scene.focusActor('char', Math.max(1.5, scene.zoom())); else showRoom(home().activity.room); break; }
            }
        } catch (error) { notice(error.message || '刚才没有成功，请再试一次。', true); }
    }

    function close() {
        clearInterval(timer); clearInterval(bubbleTimer); clearTimeout(noticeTimer); timer = bubbleTimer = noticeTimer = 0;
        try { if (user) endUser('cancelled', '离开了小屋'); H.Actions?.end('char', 'cancelled', '已离开当前画面'); } catch (_) { /* Leaving must not throw. */ }
        user = null; scene?.dispose(); scene = null; charShown = null;
        if (root) { root.onclick = null; root.className = ''; delete root.dataset.screen; delete root.dataset.tod; }
    }

    H.UI25 = { open, close, view, setView, notice: (m, e) => notice(m, e) };
})(window.ByndHome3D);
