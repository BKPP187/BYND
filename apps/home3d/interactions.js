(function (H) {
    'use strict';
    const labels = { Sit: '坐一会儿', Lie: '醒着躺一会儿', Sleep: '睡觉', Hug: '一起抱抱', 'Use Phone': '坐着看手机', 'Use Computer': '使用电脑', Game: '玩电脑游戏', Work: '坐下来工作', Watch: '坐着看电视', Read: '坐着看书', Drink: '喝点热饮', Eat: '吃点东西', 'Look At': '看看它', 'Play Music': '播放音乐', Photo: '打开相册', Care: '浇水', Cook: '做饭', Bathe: '泡澡', Shower: '洗澡', 'Wash Hands': '洗手', 'Wash Face': '洗脸', 'Use Toilet': '上厕所', Groom: '整理仪容', 'Change Outfit': '管理人物形象' };
    const destinations = { 'Play Music': 'music', Photo: 'album', Game: 'game' };
    let pending = null, shared = null;
    function cancel(phase = 'cancelled', reason = '已取消这次互动') {
        pending = null;
        if (shared) {
            H.runtime?.cancelShared?.();
            // Retain the receipt tokens if persistence fails, so the next cleanup
            // can retry both participants after storage becomes available again.
            H.Actions.transitionGroup(shared, phase, reason, Date.now(), true);
            shared = null;
        }
        H.runtime?.cancelInteraction?.();
        H.Actions?.end('user', phase, reason);
    }
    function valid(intent) { return pending === intent && H.runtime && intent.session === H.session && intent.charId === H.State.load().activeCharId; }
    function resume() {
        const intent = pending;
        if (!intent) return false;
        if (!valid(intent)) { cancel(); return false; }
        if (intent.phase === 'performing') return true;
        if (intent.fetchPartner) {
            intent.fetchPartner = false; intent.travelWithPartner = true;
            try { if (!H.runtime.navigate(intent.room, true)) throw Error('回去的楼梯暂时走不过去。'); return true; }
            catch(error) { cancel('blocked', error.message); H.UI.notice(error.message, true); return false; }
        }
        const row = H.runtime.worldFurniture ? H.runtime.worldFurniture().find(r => r.area === intent.room && r.local.id === intent.localId) : H.runtime.furniture().find(r => r.placement.id === intent.localId);
        if (!row) {
            const level=H.runtime.stats().villa?.level;
            if(level===undefined||H.Villa.floorOf(intent.room)===level){cancel('blocked','家具已经移动或移除');H.UI.notice('这件家具已经移动或移除，请重新选择。',true);}
            return false;
        }
        intent.phase = 'performing';
        try { if (!execute(row, intent)) throw Error('这个位置暂时走不过去，请先给家具前面留出空间。'); return true; }
        catch (error) { cancel('blocked', error.message); H.UI.notice(error.message, true); return false; }
    }
    async function perform(id, action, together = false) {
        if (id.startsWith('memory-')) { H.UI.showMemories(); return; }
        const row = H.runtime?.getFurniture?.(id) || H.runtime?.furniture().find(item => item.placement.id === id);
        if (!row || !row.item.actions.includes(action)) throw new Error('这个互动暂时不可用。');
        if (together && !H.Rooms.sharedActions(row.item)[action]) throw Error('这个互动适合单人完成。');
        cancel();
        if (action === 'Change Outfit') { H.UI.showSettings(); return; }
        if (destinations[action] && !(action === 'Play Music' && row.item.type === 'piano') && !(action === 'Game' && ['desk', 'computer'].includes(row.item.type))) { H.Bridge.open(destinations[action]); return; }
        if (action === 'Memory') { H.UI.showMemories(); return; }
        if (action === 'Look At') { H.UI.notice(row.local?.reason || row.placement.reason || '这里有我们一起生活的小小痕迹。'); return; }
        const intent = { session: H.session, charId: H.State.load().activeCharId, room: row.area || H.State.home().room, localId: row.local?.id || id, action, phase: 'traveling', together };
        if (together) {
            shared = H.Actions.beginGroup(['user','char'].map(actor => ({ actor, room:intent.room, target:intent.localId, action, source:'interaction' })));
            intent.receipts = shared;
            intent.travelWithPartner = !!H.runtime.stats().actors?.find(actor => actor.who === 'char' && actor.visible);
        } else intent.receipt = H.Actions?.begin('user', { room: intent.room, target: intent.localId, action });
        pending = intent;
        const stats = H.runtime.stats();
        try {
            if (intent.receipt) H.Actions.transition(intent.receipt, 'walking');
            if (intent.receipts) H.Actions.transitionGroup(intent.receipts, 'walking');
            if (stats.villa?.browsing || ['exterior', 'dollhouse'].includes(stats.camera?.mode)) await H.runtime.setViewpoint('isometric');
            if (!valid(intent)) { if(pending===intent)cancel(); return; }
            if (together && stats.villa && !intent.travelWithPartner && H.Villa.floorOf(intent.room) === stats.villa.level) {
                intent.fetchPartner = true;
                if (!H.runtime.navigate(H.State.home().activity.room, true)) throw Error('暂时无法走到Ta身边。');
                H.UI.notice('先去叫Ta，再一起回来。');
            } else if (stats.villa && H.Villa.floorOf(intent.room) !== stats.villa.level) {
                if (!H.runtime.navigate(intent.room, true)) throw Error('楼梯前的路被挡住了，暂时无法过去互动。');
                H.UI.notice('先走楼梯到' + H.Rooms.get(intent.room).name + '，再' + labels[action] + '。');
            } else resume();
        } catch (error) { if (pending === intent) cancel('blocked', error.message); throw error; }
    }
    function execute(row, intent) {
        const action = intent.action, charId = intent.charId, roomId = intent.room, id = intent.localId;
        if (intent.together) return H.runtime.interactPair(row.placement.id, action, () => {
            if (!valid(intent)) return false;
            try {
                if (!H.Actions.transitionGroup(intent.receipts, 'acting')) return false;
                pending = null; H.UI.updateStatus(); H.UI.notice((H.Rooms.sharedActions(row.item)[action] || '一起待一会儿') + '，点人物可以结束。'); return true;
            } catch(error) { try { cancel('blocked', error.message); } catch (_) { /* Preserve the save error. */ } H.UI.notice(error.message, true); return false; }
        });
        return H.runtime.interact(row.placement.id, action, () => {
            if (!valid(intent)) { if(pending===intent)cancel(); return; }
            pending = null;
            try {
                if (intent.receipt) {
                    if (!H.Actions.transition(intent.receipt, 'acting')) return;
                    H.UI.updateStatus();
                    H.UI.notice(action === 'Hug' ? '靠近一点，就这样抱一会儿。' : '正在' + (labels[action] || action) + '，点人物可以结束动作。');
                    return;
                }
                const text = action === 'Hug' ? '在小屋里给了彼此一个拥抱' : '在' + row.item.name + '，' + (labels[action] || H.Living.labels[action] || action);
                H.State.withHome((home, data) => {
                    if (data.activeCharId !== charId) throw new Error('同住角色已切换，这次互动没有保存。');
                    const now = Date.now(), last = home.moments.at(-1);
                    if (last?.action !== action || now - last.at >= 60000) home.moments.push({ id: 'moment_' + now, at: now, action, text, source: 'interaction' });
                    home.moments = home.moments.slice(-300); home.objectState ||= {};
                    const key = roomId + ':' + id, old = home.objectState[key] || {};
                    home.objectState[key] = { ...old, lastUsedAt: now, action, source: 'interaction', uses: (old.uses || 0) + 1, ...(action === 'Care' ? { wateredAt: now } : {}) };
                }); H.UI.updateStatus();
                H.UI.notice(action === 'Hug' ? '靠近一点，就这样抱一会儿。' : '正在' + (labels[action] || action) + '，点人物可以结束动作。');
            } catch (error) {
                // A failed arrival receipt must not leave a successful-looking interaction.
                try { H.runtime.stopAction?.(); } catch (_) { /* Keep the original save error. */ }
                H.UI.notice(error.message, true);
            }
        });
    }
    H.Interactions = { perform, resume, cancel, paired: () => pending?.together ? pending : null, hasPending: () => !!pending, labels };
})(window.ByndHome3D);
