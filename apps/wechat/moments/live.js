(() => {
    const D = () => window.ByndDiscoverStory;
    const e = value => D().escape(value);
    let selected = '', sourceId = '', filter = 'active', panel = '';
    let rolling = null, rollingTimer = null;
    const state = () => D().read('live');
    const roomFor = id => state().rooms.find(room => String(room.id) === String(id));
    function choices(raw) {
        if (!Array.isArray(raw) || !raw.length) throw new Error('直播没有提供下一步互动选择。');
        return raw.slice(0, 4).map((choice, index) => {
            const text = D().clip(typeof choice === 'string' ? choice : choice?.text, 100);
            if (!text) throw new Error('互动选择内容为空。');
            return { id: 'choice_' + index, text };
        });
    }
    function publish(charId, options = {}) {
        return D().run('publish:live:' + charId, async () => {
            const char = D().character(charId);
            if (!char) throw new Error('先选择一个角色世界。');
            if (state().rooms.some(room => room.hostId === char.id && room.status !== 'ended')) throw new Error('这个角色已有进行中的直播，可以先进入房间。');
            const result = await D().ask(char, '判断角色此刻是否自然会开直播；合适才生成属于角色当前生活的直播开场，例如做饭、游戏、排练、访谈。由角色本人主持，NPC 可以在弹幕中出现', { trigger: options.background ? '本轮剧情' : '查看角色直播', requestedTopic: options.topic || '', previous: state().rooms.filter(room => room.hostId === char.id).slice(-8).map(room => room.title) }, '{"needed":true或false,"title":"直播标题","category":"做饭/游戏/排练/访谈或符合人设的活动","caption":"此刻画面","lines":[{"actor":{"charId":"联系人id"},"text":"主播或NPC发言"}],"choices":["可参与的选择"]}');
            if (options.turn && D().capture(char) !== options.turn) throw new Error('剧情已经变化，本次直播未开启。');
            if (result.needed === false) { D().change('live', s => { s.notice = '角色暂时没有开播，稍后再来。'; }); return false; }
            if (result.needed !== true || !D().clip(result.title) || !D().clip(result.caption)) throw new Error('直播开场不完整，原有房间已保留。');
            const lines = D().lines(result.lines, char);
            if (!lines.length) throw new Error('直播开场发言为空。');
            const room = { id: D().uid('live'), hostId: char.id, sourceCharId: char.id, host: D().actor({ charId: char.id }, char), title: D().clip(result.title, 100), category: D().clip(result.category, 40), caption: D().clip(result.caption, 1600), lines, choices: choices(result.choices), version: 0, status: 'active', createdAt: Date.now(), log: [] };
            D().change('live', s => {
                if (s.rooms.length >= 100) throw new Error('直播历史已达 100 场，请先整理历史。');
                if (s.rooms.some(item => item.hostId === char.id && item.status !== 'ended')) throw new Error('这个角色已经在直播中。');
                s.rooms.push(room); s.notice = '';
            });
            return true;
        }, () => D().refresh());
    }
    function perform(id) {
        return D().execute('live', id, async event => {
            const room = roomFor(event.targetId);
            if (!room || room.status === 'ended') throw new Error('直播已经结束或房间不存在。');
            if (Number(room.version || 0) !== event.version) throw new Error('直播进程已变化，本条互动已过期。');
            const char = D().character(room.hostId || room.sourceCharId);
            if (!char) throw new Error('主播已删除或被拉黑。');
            const ending = event.kind === 'end';
            const result = await D().ask(char, ending ? '结束这场直播：自然收尾，回顾用户真实参与的内容，并写一条角色收播后发给用户的私聊，不复述与此次直播无关的秘密' : '继续这场可参与的直播。明确回应用户刚刚的弹幕、点歌或选择，让其影响眼前场景；NPC 发言按各自身份和可知信息生成，不替用户做决定', { title: room.title, category: room.category, caption: room.caption, host: room.host, recentLines: room.lines.slice(-12), actions: room.log.slice(-12), action: event.kind, userText: event.text, previousChoices: room.choices }, '{"caption":"新的直播场景或收尾","lines":[{"actor":{"charId":"联系人id"},"text":"回应或NPC弹幕"}],"choices":["接下来可选择的方向"],"privateMessage":"收播时必须提供给用户的私聊回访，像微信消息一样用|||分成2~4条，每条一句完整的话，不要在句子中间断开；太短就一条不分隔，其他时候为空"}', ending);
            const lines = D().lines(result.lines, char);
            if (!lines.length || !D().clip(result.caption)) throw new Error('直播回应不完整，请重试。');
            const nextChoices = ending ? [] : choices(result.choices);
            const privateMessage = D().clip(result.privateMessage, 2000);
            if (ending && !privateMessage) throw new Error('收播回访没有生成，直播仍然保留，重试即可。');
            D().change('live', s => {
                const current = s.rooms.find(item => item.id === room.id), row = s.events.find(item => item.id === id);
                if (!current || current.status === 'ended' || !row || row.status === 'done' || Number(current.version || 0) !== event.version) throw new Error('直播已变化，本次回应未覆盖现有内容。');
                current.log ||= [];
                current.log.push({ kind: event.kind, text: event.text, eventId: id, at: Date.now() });
                if (!current.lines.some(line => line.eventId === id && line.user)) current.lines.push({ user: true, notice: event.kind === 'enter', text: event.text, eventId: id });
                current.lines.push(...lines);
                current.caption = D().clip(result.caption, 1600); current.choices = nextChoices; current.version = event.version + 1;
                if (ending) {
                    current.status = 'ended'; current.endedAt = Date.now(); current.recap = privateMessage;
                    const dms = D().privateMessages(privateMessage, char);
                    if (dms.length) {
                        dms[0].content = '刚才那场直播《' + room.title + '》结束了。\n' + dms[0].content;
                        D().outbox(s, id, char.id, dms);
                    }
                }
                row.status = 'done'; row.completedAt = Date.now(); delete row.error;
            });
            if (ending) await D().deliver('live');
            return true;
        });
    }
    function submit(id, kind, text = '', choiceId, version) {
        return D().run('submit:live:' + id, async () => {
            const room = roomFor(id);
            if (!room || room.status === 'ended') throw new Error('直播已结束。');
            if (!D().character(room.hostId || room.sourceCharId)) throw new Error('主播已不存在。');
            if (state().events.some(item => item.targetId === id && !['done', 'cancelled'].includes(item.status))) throw new Error('上一条互动未完成，请先重试或撤销。');
            if ((room.log || []).length >= 80 && kind !== 'end') throw new Error('这场直播已经很长，可以收播后继续私聊。');
            if (kind === 'choice') {
                if (version !== Number(room.version || 0)) throw new Error('这个选择已经过期，请选择当前直播的选项。');
                const choice = (room.choices || []).find(item => item.id === choiceId);
                if (!choice) throw new Error('这个选择已不存在。');
                text = choice.text;
            }
            if (!['enter', 'danmaku', 'song', 'choice', 'end'].includes(kind) || !D().clip(text) || text.length > 1000) throw new Error('请输入 1–1000 字的互动内容。');
            const eventId = D().uid('discover_event');
            D().change('live', s => {
                s.events.push({ id: eventId, createdAt: Date.now(), status: 'pending', kind, targetId: id, text, version: Number(room.version || 0) });
                const current = s.rooms.find(item => item.id === id);
                current.lines.push({ user: true, notice: kind === 'enter', text, eventId });
            });
            const input = document.getElementById('wc-ds-live-input');
            if (input?.value.trim() === text.trim()) input.value = '';
            return perform(eventId);
        }, () => D().refresh());
    }
    function enter(id) {
        selected = id; panel = ''; render();
        const room = roomFor(id);
        if (room?.status === 'active' && !state().events.some(item => item.targetId === id && item.kind === 'enter')) return submit(id, 'enter', D().context(D().character(room.hostId)).userName + '进入了直播间');
        return Promise.resolve(true);
    }
    function cancel(id) {
        return D().run('cancel:' + id, () => {
            if (D().busy('event:' + id)) throw new Error('回应正在生成，完成后再操作。');
            D().change('live', s => { const item = s.events.find(row => row.id === id); if (item && item.status !== 'done') item.status = 'cancelled'; });
            return true;
        }, () => D().refresh());
    }
    function lineHtml(line, host) {
        const user = line.user;
        const name = user ? D().userName(D().character(host.charId)) : line.actor?.name || host.name;
        return `<div class="wc-live-barrage-line ${user ? 'is-user' : ''} ${line.notice ? 'is-notice' : ''}"><strong>${e(line.notice ? '' : name)}</strong><span>${e(typeof line === 'string' ? line : line.text)}</span></div>`;
    }
    function roll(room) {
        let node = document.getElementById('wc-live-barrage'); if (!node) return;
        const lines = room.lines || [], host = typeof room.host === 'object' ? room.host : { name: room.host || '主播', charId: room.hostId };
        if (!rolling || rolling.id !== room.id) { rolling = { id: room.id, shown: Math.max(0, lines.length - 4), node }; clearTimeout(rollingTimer); rollingTimer = null; }
        else if (rolling.node !== node) { for (const line of rolling.node.children) line.classList.add('is-settled'); node.replaceWith(rolling.node); node = rolling.node; }
        if (!node.children.length) for (const line of lines.slice(Math.max(0, rolling.shown - 4), rolling.shown)) { node.insertAdjacentHTML('beforeend', lineHtml(line, host)); node.lastElementChild.classList.add('is-settled'); }
        if (rollingTimer) return;
        const next = () => {
            rollingTimer = null;
            if (selected !== room.id || !document.querySelector('#wc-feature-screen.active [data-live-room]')) return;
            const latest = roomFor(room.id), target = document.getElementById('wc-live-barrage');
            if (!latest || !target) return;
            if (rolling.shown < (latest.lines || []).length) {
                const positions = [...target.children].map(node => [node, node.getBoundingClientRect().top]);
                target.insertAdjacentHTML('beforeend', lineHtml(latest.lines[rolling.shown++], host));
                target.lastElementChild.addEventListener('animationend', event => event.currentTarget.classList.add('is-settled'), { once: true });
                while (target.children.length > 5) target.firstElementChild.remove();
                target.scrollTop = target.scrollHeight;
                if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) for (const [node, top] of positions) if (node.isConnected) {
                    const distance = top - node.getBoundingClientRect().top;
                    if (distance > 0) node.animate?.([{ transform: 'translateY(' + distance + 'px)' }, { transform: 'translateY(0)' }], { duration: 550, easing: 'ease-out' });
                }
                rollingTimer = setTimeout(next, 1600);
            }
        };
        next();
    }
    function stopRolling() { clearTimeout(rollingTimer); rollingTimer = null; rolling = null; }
    function roomHtml(room) {
        const host = typeof room.host === 'object' ? room.host : { name: room.host || '主播', charId: room.hostId };
        const old = !room.hostId, ended = room.status === 'ended';
        const pending = state().events.filter(item => item.targetId === room.id && !['done', 'cancelled'].includes(item.status));
        const media = window.ByndLiveMedia?.status() || { kind: 'text' };
        const hostLine = (room.lines || []).filter(line => line.actor?.charId === room.hostId).at(-1)?.text;
        return `<article class="wc-live-room" data-live-room="${e(room.id)}" data-media-kind="${e(media.kind)}"><div data-live-media-slot></div><div class="wc-live-scrim"></div>
            <header class="wc-live-top"><button class="wc-live-host" data-ds-action="history" aria-label="查看直播记录">${D().avatar(host)}<span><strong>${e(host.name)}</strong><small><i class="wc-live-dot"></i>${ended ? '已收播' : old ? '历史房间' : '直播中'} · ${e(room.category || '生活')}</small></span></button><button class="wc-live-close" data-ds-action="back" aria-label="离开直播间">×</button></header>
            <div class="wc-ds-live-stage wc-live-fallback">${D().avatar(host)}<div class="wc-live-voice-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><p>${e(room.caption || room.title)}</p></div>
            <div class="wc-live-side"><button data-ds-action="history" aria-label="查看完整弹幕">☰</button>${!ended && !old ? `<button data-ds-action="options" aria-label="选择直播剧情">◇</button><button data-ds-action="song-mode" aria-label="点歌">♪</button>` : ''}${media.hasSound || media.blocked ? `<button data-ds-action="live-sound" aria-label="${media.sound ? '关闭声音' : '开启播放'}">${media.sound ? '♫' : '♬'}</button>` : ''}<button data-ds-action="media-options" aria-label="画面选项">⋯</button></div>
            <div class="wc-live-bottom"><div class="wc-live-heading"><span>${e(room.category || '生活')} · ${ended ? '回放记录' : '正在直播'}</span><h3>${e(room.title)}</h3></div>${media.kind !== 'text' && hostLine ? `<p class="wc-live-subtitle">${e(hostLine)}</p>` : ''}<div class="wc-live-barrage-viewport" aria-label="直播弹幕"><div id="wc-live-barrage" class="wc-live-barrage" role="log" aria-live="polite"></div></div>
            <div class="wc-live-status" role="status">${e(media.phase === 'video' ? '正在连接视频画面…' : media.phase === 'image' ? '正在绘制直播场景…' : media.note || '头像直播')} ${pending.length ? '· 主播回应中…' : ''}</div>
            ${pending.length && !D().busy('event:' + pending[0].id) ? `<div class="wc-live-inline-error">${D().pendingHtml('live', room.id)}<button data-ds-action="cancel" data-id="${e(pending[0].id)}">撤销未完成互动</button></div>` : ''}${D().errorHtml('submit:live:' + room.id)}${D().deliveryHtml('live')}
            ${ended ? `<button data-ds-action="history">查看收播回顾</button>` : old ? '<p>历史房间 · 可查看完整弹幕记录</p>' : `<div class="wc-live-compose"><select id="wc-ds-live-kind" aria-label="互动类型"><option value="danmaku">弹幕</option><option value="song">点歌</option></select><textarea id="wc-ds-live-input" maxlength="1000" rows="1" aria-label="直播内容" placeholder="说点什么…"></textarea><button class="wc-ds-primary" data-ds-action="send" data-id="${e(room.id)}" ${pending.length ? 'disabled' : ''}>发送</button></div>`}</div>
            ${panel ? panelHtml(room, host, pending) : ''}</article>`;
    }
    function panelHtml(room, host, pending) {
        const ended = room.status === 'ended', media = window.ByndLiveMedia?.status() || {};
        let body;
        if (panel === 'history') body = `<div class="wc-live-history">${(room.lines || []).map(line => lineHtml(line, host)).join('')}</div>${ended ? `<div class="wc-ds-recap"><h3>收播回顾</h3><p>${e(room.recap || '直播已结束。')}</p></div>` : ''}`;
        else if (panel === 'options') body = `<div class="wc-ds-choices">${(room.choices || []).map(choice => `<button data-ds-action="choice" data-id="${e(room.id)}" data-choice="${e(choice.id)}" data-version="${Number(room.version || 0)}" ${pending.length ? 'disabled' : ''}>${e(choice.text)}</button>`).join('')}</div>`;
        else body = `<p class="wc-ds-muted">优先实时视频；连接失败时使用场景图片，最后使用头像直播。更换画面会使用你配置的 API。</p><button data-ds-action="media-retry" ${media.phase || ended ? 'disabled' : ''}>重新连接画面</button>${media.kind !== 'video' ? `<button data-ds-action="image-refresh" ${media.phase || ended || !window.ByndLiveMedia?.hasImage() ? 'disabled' : ''}>按当前剧情更新图片</button>` : ''}${!ended && room.hostId ? `<button data-ds-action="end" data-id="${e(room.id)}" ${pending.length ? 'disabled' : ''}>收播并私聊回访</button>` : ''}${D().errorHtml('media-action:' + room.id)}`;
        return `<div class="wc-live-sheet-shade"><section class="wc-live-sheet" role="dialog" aria-modal="true" aria-label="${panel === 'history' ? '直播记录' : panel === 'options' ? '参与剧情' : '画面选项'}"><header><strong>${panel === 'history' ? '直播记录' : panel === 'options' ? '参与剧情' : '画面选项'}</strong><button data-ds-action="panel-close" aria-label="关闭">×</button></header>${body}</section></div>`;
    }
    function render() {
        const s = state(); sourceId = D().character(sourceId)?.id || D().characters()[0]?.id || '';
        const room = roomFor(selected);
        const rooms = s.rooms.slice().reverse().filter(item => filter === 'history' ? item.status === 'ended' || !item.hostId : item.status !== 'ended' && item.hostId);
        const body = room ? roomHtml(room) : rooms.map(item => { const host = typeof item.host === 'object' ? item.host : { name: item.host || '主播' }; return `<button class="wc-ds-live-card" data-ds-action="enter" data-id="${e(item.id)}">${D().avatar(host)}<strong>${e(item.title)}</strong><span>${e(host.name)} · ${e(item.category || '生活')}</span><p>${e(item.caption || '查看这场直播')}</p><small>${item.status === 'ended' || !item.hostId ? '查看回放记录' : '进入直播'}</small></button>`; }).join('') || `<p class="wc-ds-empty">${filter === 'history' ? '还没有直播记录。' : '角色还没有开播。选择一个角色，看看 TA 是否有新的直播安排。'}</p>`;
        openWechatFeatureScreen(room ? room.title : '直播', room ? `<section class="wc-ds wc-ds-immersive" data-discover-view="live">${body}</section>` : `<section class="wc-ds" data-discover-view="live"><div class="wc-ds-toolbar">${D().sourceSelect('wc-ds-live-source', sourceId)}<button class="wc-ds-primary" data-ds-action="publish" ${!sourceId || D().busy('publish:live:' + sourceId) ? 'disabled' : ''}>${D().busy('publish:live:' + sourceId) ? '查看中…' : '看看谁开播'}</button></div>${D().errorHtml('publish:live:' + sourceId)}${D().deliveryHtml('live')}${s.notice ? `<p class="wc-ds-muted" role="status">${e(s.notice)}</p>` : ''}<nav class="wc-ds-tabs"><button data-ds-action="filter" data-id="active" aria-pressed="${filter === 'active'}">正在直播</button><button data-ds-action="filter" data-id="history" aria-pressed="${filter === 'history'}">直播记录</button></nav><div class="wc-ds-feed">${body}</div></section>`);
        D().mount('live', render);
        const select = document.getElementById('wc-ds-live-source'); if (select) select.onchange = event => { sourceId = event.target.value; render(); };
        D().bind((action, data) => {
            if (action === 'publish') void publish(sourceId);
            if (action === 'back') { selected = ''; panel = ''; stopRolling(); window.ByndLiveMedia?.leave(); render(); }
            if (action === 'filter') { filter = data.id; render(); }
            if (action === 'enter') void enter(data.id);
            if (action === 'retry') void perform(data.id);
            if (action === 'cancel') void cancel(data.id);
            if (action === 'delivery') void D().deliver('live');
            if (action === 'history' || action === 'options' || action === 'media-options') { panel = action === 'media-options' ? 'media' : action; D().refresh(); }
            if (action === 'panel-close') { panel = ''; D().refresh(); }
            if (action === 'song-mode') { const kind = document.getElementById('wc-ds-live-kind'); if (kind) kind.value = 'song'; document.getElementById('wc-ds-live-input')?.focus(); }
            if (action === 'live-sound') void window.ByndLiveMedia?.sound();
            if (action === 'media-retry' || action === 'image-refresh') void D().run('media-action:' + selected, () => action === 'media-retry' ? window.ByndLiveMedia?.retry(roomFor(selected)) : window.ByndLiveMedia?.refreshImage(roomFor(selected)), () => D().refresh());
            if (action === 'choice') { panel = ''; void submit(data.id, 'choice', '', data.choice, Number(data.version)); }
            if (action === 'send') { const text = document.getElementById('wc-ds-live-input')?.value.trim(); if (text) void submit(data.id, document.getElementById('wc-ds-live-kind')?.value || 'danmaku', text); }
            if (action === 'end') { panel = ''; void submit(data.id, 'end', '这场直播先到这里，和大家道别后再来微信聊。'); }
        });
        const sheet = document.querySelector?.('.wc-live-sheet');
        if (sheet) {
            for (const child of document.querySelector('[data-live-room]').children) if (!child.classList.contains('wc-live-sheet-shade')) child.inert = true;
            sheet.onkeydown = event => {
                if (event.key === 'Escape') { panel = ''; D().refresh(); }
                if (event.key === 'Tab') {
                    const buttons = [...sheet.querySelectorAll('button:not(:disabled)')], first = buttons[0], last = buttons.at(-1);
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                }
            };
            sheet.querySelector('button')?.focus({ preventScroll: true });
            const shade = sheet.parentElement; shade.onclick = event => { if (event.target === shade) { panel = ''; D().refresh(); } };
        }
        if (room) { window.ByndLiveMedia?.mount(room); roll(room); }
        else { window.ByndLiveMedia?.leave(); stopRolling(); }
    }
    function open() { selected = ''; panel = ''; render(); if (state().outbox.some(item => item.status === 'pending')) void D().deliver('live'); }
    window.ByndLive = { publish, perform, submit, enter, cancel, render, open, state };
    window.openWechatLive = open;
    window.renderWechatLive = render;
    window.generateWechatLiveRooms = () => publish(D().character(sourceId)?.id || D().characters()[0]?.id);
})();
