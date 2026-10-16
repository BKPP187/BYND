(function (H) {
    'use strict';
    const KEY = 'bynd_home3d_v1';
    // Structural copy: objects/arrays are copied, primitives (including the
    // large data-URL strings) are shared, which costs O(nodes) not O(bytes).
    const clone = value => {
        if (Array.isArray(value)) return value.map(clone);
        if (value && typeof value === 'object') { const out = {}; for (const key of Object.keys(value)) out[key] = clone(value[key]); return out; }
        return value;
    };
    const defaults = () => ({ version: 1, activeCharId: '', user: { name: '我', reference: '', avatar: H.Characters?.defaultProfile('user') || {} }, homes: {} });
    const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const unsafeKey = id => ['__proto__', 'constructor', 'prototype'].includes(id);
    // In-memory cache of the parsed, validated save. `raw` is the exact string
    // it was parsed from; any other writer (tests, other tabs, backup import)
    // changes the string and forces a re-parse.
    let cache = null;
    function invalidate() { cache = null; }
    try { window.addEventListener?.('storage', event => { if (!event || event.key === KEY || event.key === null) invalidate(); }); } catch (_) {}
    // Only structural corruption throws (the raw save is never rewritten here).
    // Stale catalog references are dropped per item so one removed room,
    // style or furniture id cannot lock every home out.
    // Moment ids are list keys; writers stamp them with Date.now(), so two
    // moments in the same millisecond would collide. Rename later duplicates.
    function uniqueMoments(current) {
        if (!Array.isArray(current?.moments)) return;
        const seen = new Set();
        current.moments.forEach((row, index) => {
            if (!object(row)) return;
            let id = typeof row.id === 'string' && row.id ? row.id : 'moment_' + (Number.isFinite(row.at) ? row.at : 0);
            if (seen.has(id)) { const base = id; let n = index; do id = base + '_' + (n++).toString(36); while (seen.has(id)); }
            seen.add(id); row.id = id;
        });
    }
    function repairHome(current) {
        if (!object(current)) throw new Error('小屋存档内容无效，请先备份。');
        if (current.modelId !== undefined && !['portrait', 'bunny-blue-v1', 'silver-red-v1'].includes(current.modelId)) delete current.modelId;
        for (const field of ['visits', 'moments', 'keepsakes']) if (!Array.isArray(current[field])) current[field] = [];
        current.visits = current.visits.filter(day => typeof day === 'string');
        current.moments = current.moments.filter(object); current.keepsakes = current.keepsakes.filter(object);
        uniqueMoments(current);
        if (current.openRooms != null) {
            if (!Array.isArray(current.openRooms)) throw new Error('小屋扩建存档无效，原存档已保留。');
            current.openRooms = current.openRooms.filter(id => typeof id === 'string' && !!H.Rooms.get(id)?.expandable);
        }
        const receipt = value => object(value) && typeof value.id === 'string' && ['user', 'char'].includes(value.actor) && ['queued', 'walking', 'acting', 'finished', 'blocked', 'cancelled'].includes(value.phase) && Number.isFinite(value.at);
        if (current.executions != null && (!object(current.executions) || Object.values(current.executions).some(row => !receipt(row)))) throw new Error('小屋活动回执无效，原存档已保留。');
        if (current.actionReceipts != null && (!Array.isArray(current.actionReceipts) || current.actionReceipts.length > 80 || current.actionReceipts.some(row => !receipt(row)))) throw new Error('小屋活动记录无效，原存档已保留。');
        if (current.preferences != null && (!object(current.preferences) || Object.values(current.preferences).some(value => !['auto', 'like', 'avoid'].includes(value)))) throw new Error('小屋生活偏好无效，原存档已保留。');
        if (current.lifeInbox != null && (!object(current.lifeInbox) || !Array.isArray(current.lifeInbox.entries) || current.lifeInbox.entries.length > 60 || current.lifeInbox.entries.some(row => !object(row) || typeof row.id !== 'string' || typeof row.text !== 'string' || !Number.isFinite(row.at) || !Number.isFinite(row.consumedAt)) || !Array.isArray(current.lifeInbox.seen) || current.lifeInbox.seen.length > 240 || current.lifeInbox.seen.some(id => typeof id !== 'string'))) throw new Error('小屋生活动态无效，原存档已保留。');
        if (current.interiors != null) {
            const options = H.catalogs.materialPresets.interiors, styles = H.catalogs.furnitureCatalog.styles;
            if (!object(current.interiors)) throw new Error('墙面地板存档无效，原存档已保留。');
            const interiors = {};
            for (const [roomId, config] of Object.entries(current.interiors)) {
                // A finish from an older catalog falls back to the room default.
                if (unsafeKey(roomId) || !H.Rooms.get(roomId) || !object(config) || !Object.hasOwn(options.presets, config.preset)) continue;
                if (config.wall !== undefined && !Object.hasOwn(options.walls, config.wall)) delete config.wall;
                if (config.floor !== undefined && !Object.hasOwn(options.floors, config.floor)) delete config.floor;
                if (config.furniture !== undefined) {
                    if (!object(config.furniture)) delete config.furniture;
                    else { const kept = {}; for (const [id, style] of Object.entries(config.furniture)) if (/^[\w-]{1,100}$/.test(id) && !unsafeKey(id) && Object.hasOwn(styles, style)) kept[id] = style; config.furniture = kept; }
                }
                interiors[roomId] = config;
            }
            current.interiors = interiors;
        }
        if (current.layouts != null) {
            if (!object(current.layouts)) throw new Error('装修存档无效，原存档已保留。');
            const layouts = {};
            for (const [roomId, layout] of Object.entries(current.layouts)) {
                if (!object(layout?.items) || Object.keys(layout.items).length > 80 || !Array.isArray(layout.removed) || layout.removed.some(id => typeof id !== 'string')) throw new Error('装修存档无效，原存档已保留。');
                for (const [id, p] of Object.entries(layout.items)) if (!/^[\w-]{1,100}$/.test(id) || unsafeKey(id) || p?.id !== id || !Array.isArray(p.position) || p.position.length !== 3 || !p.position.every(Number.isFinite) || p.position.some(v => Math.abs(v) > 20) || !Number.isFinite(p.rotation)) throw new Error('家具存档位置无效，原存档已保留。');
                // A room or furniture id that left the catalog is skipped, not fatal.
                if (unsafeKey(roomId) || !H.Rooms.get(roomId)) continue;
                for (const [id, p] of Object.entries(layout.items)) if (!H.Furniture.get(p.furnitureId)) delete layout.items[id];
                layouts[roomId] = layout;
            }
            current.layouts = layouts;
        }
        return current;
    }
    function parse(raw) {
        if (!raw) return defaults();
        let data;
        try { data = JSON.parse(raw); } catch (_) { throw new Error('小屋存档无法读取。原存档已保留，请先从设置导出备份。'); }
        if (data?.version !== 1 || !object(data.homes)) throw new Error('小屋存档版本不兼容，请先备份。');
        if (data.user != null && !object(data.user)) throw new Error('小屋存档内容无效，请先备份。');
        if (data.user?.modelId !== undefined && !['portrait', 'bunny-blue-v1', 'silver-red-v1'].includes(data.user.modelId)) delete data.user.modelId;
        const homes = {};
        for (const [id, current] of Object.entries(data.homes)) { if (unsafeKey(id)) continue; homes[id] = repairHome(current); }
        return { ...defaults(), ...data, homes, user: { ...defaults().user, ...data.user } };
    }
    // Returns the cached, validated save (shared; callers must not mutate).
    function snapshot(checkStorage = true) {
        if (cache && !checkStorage) { if (cache.error) throw cache.error; return cache.data; }
        const raw = localStorage.getItem(KEY);
        if (!cache || cache.raw !== raw) {
            try { cache = { raw, data: parse(raw) }; } catch (error) { cache = { raw, error }; }
        }
        if (cache.error) throw cache.error;
        return cache.data;
    }
    function load() { return clone(snapshot()); }
    function update(mutator) {
        const next = clone(snapshot());
        mutator(next);
        if (object(next?.homes)) for (const current of Object.values(next.homes)) uniqueMoments(current);
        const serialized = JSON.stringify(next);
        try { localStorage.setItem(KEY, serialized); } catch (_) { throw new Error('小屋没有保存成功，可能是设备存储空间不足。请备份并清理后重试。'); }
        // Only a successful write replaces the cache; a failed write keeps the old state.
        cache = { raw: serialized, data: clone(next) };
        return next;
    }
    function createHome(now = Date.now()) {
        return { createdAt: now, room: 'living_room', theme: 'auto', charAvatar: H.Characters?.defaultProfile('char') || {}, avatarReference: '', visits: [], moments: [], keepsakes: [], placements: [], layouts: {}, openRooms: [], lastLifeAt: now, needs: { energy: 80, comfort: 80 }, activity: null, relationship: '亲近', consentHug: true };
    }
    function bind(charId, user) {
        if (['__proto__', 'constructor', 'prototype'].includes(String(charId))) throw new Error('角色标识无效。');
        if (!H.Bridge.characters().some(char => String(char.id) === String(charId))) throw new Error('请选择一个仍在通讯录中的角色。');
        return update(next => {
            next.activeCharId = String(charId);
            next.user = { ...next.user, ...user };
            next.homes[charId] ||= createHome();
        });
    }
    function home(data = load()) { return data?.homes?.[data.activeCharId] || null; }
    // Hot-path read for the render loop: no storage access, no parse, no copy.
    // The returned object is shared with the cache and must be treated as read-only.
    function peekHome() { try { return home(snapshot(false)); } catch (_) { return null; } }
    function withHome(mutator) { return update(next => { const current = home(next); if (!current) throw new Error('请先选择同住角色。'); mutator(current, next); }); }
    function visit(now = Date.now()) {
        const day = new Date(now).toLocaleDateString('en-CA');
        return withHome(current => { if (!current.visits.includes(day)) current.visits = [...current.visits, day].slice(-730); });
    }
    let momentSequence = 0;
    function moment(action, text, source = 'interaction', now = Date.now()) {
        return withHome(current => {
            const last = current.moments.at(-1);
            if (last?.action === action && now - last.at < 60000) return;
            current.moments.push({ id: 'moment_' + now + '_' + (++momentSequence).toString(36) + Math.random().toString(36).slice(2, 6), action, text: String(text).slice(0, 360), source, at: now });
            current.moments = current.moments.slice(-300);
        });
    }
    function keepMemory(memory) {
        if (!memory?.id || !memory.content) throw new Error('这段记忆暂时不能放进小屋。');
        return withHome(current => {
            if (current.keepsakes.some(item => item.sourceId === String(memory.id))) return;
            if (current.keepsakes.length >= 24) throw new Error('纪念角已经放满了，先保留现有回忆吧。');
            current.keepsakes.push({ id: 'memory_' + memory.id, sourceId: String(memory.id), type: 'memory', title: String(memory.title || memory.topic || '一起记住的事').slice(0, 60), text: String(memory.content).slice(0, 900), at: Date.now() });
        });
    }
    H.State = { key: KEY, load, update, invalidate, peekHome, bind, home, withHome, visit, moment, keepMemory, createHome };
})(window.ByndHome3D);
