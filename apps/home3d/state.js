(function (H) {
    'use strict';
    const KEY = 'bynd_home3d_v1';
    const clone = value => JSON.parse(JSON.stringify(value));
    const defaults = () => ({ version: 1, activeCharId: '', user: { name: '我', reference: '', avatar: H.Characters?.defaultProfile('user') || {} }, homes: {} });
    function load() {
        const raw = localStorage.getItem(KEY);
        if (!raw) return defaults();
        let data;
        try { data = JSON.parse(raw); } catch (_) { throw new Error('小屋存档无法读取。原存档已保留，请先从设置导出备份。'); }
        if (data?.version !== 1 || !data.homes || typeof data.homes !== 'object' || Array.isArray(data.homes)) throw new Error('小屋存档版本不兼容，请先备份。');
        if (data.user?.modelId !== undefined && !['portrait', 'bunny-blue-v1'].includes(data.user.modelId)) throw new Error('我的小屋模型无效，原存档已保留。');
        for (const current of Object.values(data.homes)) {
            if (!current || typeof current !== 'object') throw new Error('小屋存档内容无效，请先备份。');
            if (current.modelId !== undefined && !['portrait', 'silver-red-v1'].includes(current.modelId)) throw new Error('小屋人物模型无效，原存档已保留。');
            if (current.openRooms && (!Array.isArray(current.openRooms) || current.openRooms.some(id => !H.Rooms.get(id)?.expandable))) throw new Error('小屋扩建存档无效，原存档已保留。');
            if (current.interiors) {
                const options = H.catalogs.materialPresets.interiors;
                if (typeof current.interiors !== 'object' || Array.isArray(current.interiors)) throw new Error('墙面地板存档无效，原存档已保留。');
                for (const [roomId, config] of Object.entries(current.interiors)) {
                    if (!H.Rooms.get(roomId) || !config || typeof config !== 'object' || Array.isArray(config) || !Object.hasOwn(options.presets, config.preset) || (config.wall && !Object.hasOwn(options.walls, config.wall)) || (config.floor && !Object.hasOwn(options.floors, config.floor)) || (config.furniture && (typeof config.furniture !== 'object' || Array.isArray(config.furniture) || Object.entries(config.furniture).some(([id, style]) => !/^[\w-]{1,100}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id) || !Object.hasOwn(H.catalogs.furnitureCatalog.styles, style))))) throw new Error('墙面地板存档无效，原存档已保留。');
                }
            }
            if (current.layouts) {
                if (typeof current.layouts !== 'object' || Array.isArray(current.layouts)) throw new Error('装修存档无效，原存档已保留。');
                for (const [roomId, layout] of Object.entries(current.layouts)) {
                    if (!H.Rooms.get(roomId) || !layout?.items || typeof layout.items !== 'object' || Array.isArray(layout.items) || Object.keys(layout.items).length > 80 || !Array.isArray(layout.removed) || layout.removed.some(id => typeof id !== 'string')) throw new Error('装修存档无效，原存档已保留。');
                    for (const [id, p] of Object.entries(layout.items)) if (!/^[\w-]{1,100}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id) || p?.id !== id || !H.Furniture.get(p.furnitureId) || !Array.isArray(p.position) || p.position.length !== 3 || !p.position.every(Number.isFinite) || p.position.some(v => Math.abs(v) > 20) || !Number.isFinite(p.rotation)) throw new Error('家具存档位置无效，原存档已保留。');
                }
            }
        }
        return { ...defaults(), ...data, user: { ...defaults().user, ...data.user } };
    }
    function update(mutator) {
        const next = clone(load());
        mutator(next);
        const serialized = JSON.stringify(next);
        try { localStorage.setItem(KEY, serialized); } catch (_) { throw new Error('小屋没有保存成功，可能是设备存储空间不足。请备份并清理后重试。'); }
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
    function home(data = load()) { return data.homes[data.activeCharId] || null; }
    function withHome(mutator) { return update(next => { const current = home(next); if (!current) throw new Error('请先选择同住角色。'); mutator(current, next); }); }
    function visit(now = Date.now()) {
        const day = new Date(now).toLocaleDateString('en-CA');
        return withHome(current => { if (!current.visits.includes(day)) current.visits = [...current.visits, day].slice(-730); });
    }
    function moment(action, text, source = 'interaction', now = Date.now()) {
        return withHome(current => {
            const last = current.moments.at(-1);
            if (last?.action === action && now - last.at < 60000) return;
            current.moments.push({ id: 'moment_' + now, action, text: String(text).slice(0, 360), source, at: now });
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
    H.State = { key: KEY, load, update, bind, home, withHome, visit, moment, keepMemory, createHome };
})(window.ByndHome3D);
