(function (H) {
    'use strict';
    const hobbies = {
        Read: { name: '阅读', pattern: /阅读|读书|看书|文学/, room: 'living_room', target: 'sofa' },
        Game: { name: '游戏', pattern: /游戏|电竞|玩家/, room: 'game_room', target: 'desk' },
        'Play Music': { name: '音乐', pattern: /音乐|钢琴|弹琴/, room: 'living_room', target: 'piano' },
        Care: { name: '园艺', pattern: /园艺|养花|植物/, room: 'garden', target: '' },
        Cook: { name: '下厨', pattern: /下厨|烹饪|做饭/, room: 'kitchen', target: 'stove' }
    };
    const sources = { chat: '最近聊天', phone: '角色手机', world: '生活事件' };
    function preferences(home) {
        return Object.fromEntries(Object.keys(hobbies).map(key => [key, ['like', 'avoid'].includes(home?.preferences?.[key]) ? home.preferences[key] : 'auto']));
    }
    function suggestions(ctx) {
        const lines = (String(ctx.personality || '') + '。' + String(ctx.worldBook || '')).split(/[。！!?？\n；;]/).filter(line => !/不爱|不喜欢|讨厌|厌恶|不擅长|从不|拒绝/.test(line));
        return Object.fromEntries(Object.entries(hobbies).map(([key, item]) => [key, lines.some(line => /喜欢|喜爱|热爱|爱好|擅长/.test(line) && item.pattern.test(line)) ? 'like' : 'auto']));
    }
    function save(values, charId) {
        H.State.withHome((home, data) => {
            if (data.activeCharId !== charId) throw Error('同住角色已切换，请重新打开偏好。');
            for (const key of Object.keys(hobbies)) if (!['auto', 'like', 'avoid'].includes(values[key])) throw Error('生活偏好选项无效。');
            home.preferences = Object.fromEntries(Object.keys(hobbies).map(key => [key, values[key]])); home.preferencesConfirmedAt = Date.now();
            // Apply on the next decision; an ongoing action keeps its current duration.
        });
    }
    function choose(home, action, now) {
        const prefs = preferences(home), available = H.Living.facilities(home);
        const usable = Object.keys(hobbies).filter(key => prefs[key] !== 'avoid' && available.some(row => row.item.actions.includes(key)));
        const liked = usable.filter(key => prefs[key] === 'like');
        const choices = liked.length ? liked : prefs[action] === 'avoid' ? usable : [];
        if (!choices.length) return prefs[action] === 'avoid' ? { action: 'Sit', room: 'living_room', target: 'sofa', reason: '先坐下来歇一会儿' } : null;
        const selected = choices[Math.floor(now / 90000) % choices.length];
        return { action: selected, room: hobbies[selected].room, target: hobbies[selected].target, reason: '想花一点时间' + ({ Read: '读书', Game: '玩游戏', 'Play Music': '弹琴', Care: '照顾花草', Cook: '做点吃的' }[selected]) };
    }
    function hash(text) { let n = 2166136261; for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619); return (n >>> 0).toString(36); }
    function sync(home, ctx, now) {
        const charId = String(home.charId || ctx.charId || '');
        if (ctx.charId && charId !== String(ctx.charId)) throw Error('生活上下文属于其他角色。');
        const rows = [];
        const add = (source, id, at, text) => {
            at = Number(at); text = String(text || '').slice(0, 360);
            if (!text || !Number.isFinite(at) || at <= 0 || at > now || now - at > 3 * 86400000) return;
            rows.push({ id: source + ':' + (id || hash(at + ':' + text)), charId, source, at, text });
        };
        for (const msg of ctx.history || []) add('chat', msg.id, msg.at, (msg.isMe ? '你：' : 'Ta：') + msg.text);
        const phone = ctx.phone || {};
        for (const row of (Array.isArray(phone.usageRecords) ? phone.usageRecords : []).slice(-8)) add('phone', row.id, row.timestamp || row.at || row.createdAt || phone.updatedAt, JSON.stringify(row));
        for (const event of ctx.eventRecords || ctx.events || []) if (event && typeof event === 'object') add('world', event.id, event.at || event.timestamp || event.createdAt, event.text || event.summary || event.content);
        // Receipts are retained longer than the visible inbox; a high-water mark prevents
        // bounded history eviction from causing old events to be consumed again.
        const state = home.lifeInbox || { entries: [], seen: [], through: {} };
        const seen = new Set(state.seen || []), entries = [...(state.entries || [])];
        const through = { ...(typeof state.through === 'object' ? state.through : {}) };
        for (const row of rows.sort((a, b) => a.at - b.at)) {
            if (seen.has(row.id) || row.at <= (Number(state.through?.[row.source]) || 0)) continue;
            seen.add(row.id); through[row.source] = Math.max(through[row.source] || 0, row.at);
            entries.push({ ...row, consumedAt: now, consumer: 'home-context', receipt: '已纳入生活安排参考' });
        }
        home.lifeInbox = { entries: entries.slice(-60), seen: [...seen].slice(-240), through };
        return home.lifeInbox;
    }
    H.LifeContext = { hobbies, sources, preferences, suggestions, save, choose, sync };
})(window.ByndHome3D);
