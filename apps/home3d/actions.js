(function (H) {
    'use strict';
    const active = new Map();
    const terminal = new Set(['finished', 'blocked', 'cancelled']);
    const allowed = { queued: ['walking', 'acting', 'blocked', 'cancelled'], walking: ['acting', 'finished', 'blocked', 'cancelled'], acting: ['finished', 'blocked', 'cancelled'] };
    let sequence = 0;
    function settle(home, now) {
        const from = Number(home.lastLifeAt) || now;
        if (now <= from || !H.Living) return;
        const record = home.executions?.char;
        // Online transitions settle the previous, confirmed action before changing it.
        const action = record?.phase === 'acting' && record.mode !== 'simulation' ? record.action : 'Idle';
        home.needs = H.Living.evolveNeeds(home.needs, action, Math.min(now - from, 180000) / 60000);
        home.lastLifeAt = now;
    }
    function valid(token) {
        return !!token && active.get(token.actor) === token && token.session === H.session && token.charId === H.State.load().activeCharId;
    }
    function applyTransition(home, token, phase, reason, now) {
        const previous = home.executions[token.actor];
        if (token.actor === 'char') settle(home, now);
        const record = { ...previous, phase, at: now, reason: String(reason).slice(0, 180) };
        if (phase === 'acting') {
            record.startedAt = now;
            if (token.actor === 'char' && record.groupId) home.activity = { room: record.room, target: record.target, action: record.action, reason: '和你一起' + (H.Living.labels[record.action] || record.action), source: 'interaction', until: now + 600000 };
            if (!record.resumed) {
                const source = token.actor === 'char' && previous.source !== 'interaction' ? 'autonomous' : 'interaction';
                const text = H.Rooms.get(record.room).name + '里，' + (H.Interactions?.labels[record.action] || H.Living.labels[record.action] || record.action);
                home.moments = [...(home.moments || []), { id: record.id, at: now, action: record.action, room: record.room, target: record.target, text, source }].slice(-300);
                if (record.target) {
                    home.objectState ||= {};
                    const key = record.room + ':' + record.target, old = home.objectState[key] || {};
                    home.objectState[key] = { ...old, lastUsedAt: now, action: record.action, source, uses: (old.uses || 0) + 1, ...(record.action === 'Care' ? { wateredAt: now } : {}) };
                }
            }
        }
        if (token.actor === 'char' && record.groupId && previous.phase === 'acting' && terminal.has(phase)) home.activity = { room: record.room, target: '', action: 'Idle', reason: '在你身边歇一会儿', source: 'interaction', until: now + 60000 };
        home.executions[token.actor] = record;
        home.actionReceipts = [...(home.actionReceipts || []), { ...record }].slice(-80);
    }
    function transitionGroup(tokens, phase, reason = '', now = Date.now(), cleanup = false) {
        if (!tokens.length || tokens.some(token => !token || active.get(token.actor) !== token || (!cleanup && !valid(token))) || tokens.some(t => t.charId !== tokens[0].charId)) return false;
        let changed = false;
        H.State.update(data => {
            const home = data.homes[tokens[0].charId];
            if (tokens.some(token => { const old = home?.executions?.[token.actor]; return !old || old.id !== token.id || terminal.has(old.phase) || !allowed[old.phase]?.includes(phase); })) return;
            tokens.forEach(token => applyTransition(home, token, phase, reason, now)); changed = true;
        });
        if (changed && terminal.has(phase)) tokens.forEach(token => active.delete(token.actor));
        return changed;
    }
    function transition(token, phase, reason = '', now = Date.now(), cleanup = false) { return transitionGroup([token], phase, reason, now, cleanup); }
    function end(actor, phase = 'cancelled', reason = '已结束这次安排') {
        const token = active.get(actor);
        if (!token) return false;
        return transition(token, phase, reason, Date.now(), true);
    }
    function beginGroup(intents, options = {}) {
        if (!intents.length || intents.some(row => !['user','char'].includes(row.actor)) || new Set(intents.map(row => row.actor)).size !== intents.length) throw Error('人物无效。');
        const charId = H.State.load().activeCharId, groupId = intents.length > 1 ? 'shared_' + Date.now() + '_' + (++sequence) : undefined;
        const tokens = intents.map(({actor}) => ({ id: 'action_' + Date.now() + '_' + (++sequence), actor, charId, session: H.session, ...(groupId ? { groupId } : {}) }));
        H.State.withHome((home, data) => {
            if (data.activeCharId !== charId) throw Error('同住角色已切换。');
            const now = Date.now(); home.executions ||= {};
            tokens.forEach((token, i) => {
                const intent = intents[i], actor = token.actor, old = home.executions[actor];
                const resumed = !!options.resume || !!options.restore && old?.phase === 'acting' && old.action === intent.action && old.room === intent.room && old.target === intent.target;
                if (actor === 'char' && active.has(actor)) settle(home, now);
                if (old && !terminal.has(old.phase)) home.actionReceipts = [...(home.actionReceipts || []), { ...old, phase: old.phase === 'acting' ? 'finished' : 'cancelled', at: now, reason: '已切换安排' }].slice(-80);
                const record = { ...token, action: intent.action, room: intent.room, target: intent.target || '', source: intent.source || (actor === 'char' ? 'local' : 'interaction'), mode: options.simulated ? 'simulation' : 'scene', phase: 'queued', at: now, createdAt: now, resumed };
                home.executions[actor] = record; home.actionReceipts = [...(home.actionReceipts || []), { ...record }].slice(-80);
            });
        });
        tokens.forEach(token => active.set(token.actor, token)); return tokens;
    }
    function begin(actor, intent, options = {}) { return beginGroup([{...intent,actor}], options)[0]; }
    function status(home, actor = 'char') {
        const record = home?.executions?.[actor];
        if (!record) return '';
        if (record.mode === 'simulation' && !terminal.has(record.phase)) return '在另一层活动 · 本地模拟';
        if (record.phase === 'acting') return H.Living.labels[record.action] || H.Interactions?.labels[record.action] || record.action;
        return { queued: '准备活动', walking: '正在走过去', finished: '刚刚结束活动', blocked: '暂时过不去', cancelled: '正在休息' }[record.phase] || '';
    }
    H.Actions = { begin, beginGroup, transition, transitionGroup, end, valid, settle, status };
})(window.ByndHome3D);
