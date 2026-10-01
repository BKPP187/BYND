(function (H) {
    'use strict';
    const destinations = { 'Play Music': 'music', Photo: 'album', Game: 'game' };
    function perform(id, action) {
        if (id.startsWith('memory-')) { H.UI.showMemories(); return; }
        const row = H.runtime?.furniture().find(item => item.placement.id === id);
        if (!row || !row.item.actions.includes(action)) throw new Error('这个互动暂时不可用。');
        if (destinations[action] && !(action === 'Play Music' && row.item.type === 'piano')) { H.Bridge.open(destinations[action]); return; }
        if (action === 'Memory') { H.UI.showMemories(); return; }
        if (action === 'Look At') { H.runtime.emote('Happy'); H.UI.notice(row.placement.reason || '这里有我们一起生活的小小痕迹。'); return; }
        const charId = H.State.load().activeCharId, roomId = H.State.home().room;
        const success = H.runtime.interact(id, action, () => {
            try {
                const text = action === 'Hug' ? '在小屋里给了彼此一个拥抱' : '一起在' + row.item.name + '旁，' + (H.Living.labels[action] || action);
                H.State.withHome((home, data) => {
                    if (data.activeCharId !== charId) throw new Error('同住角色已切换，这次互动没有保存。');
                    const now = Date.now(), last = home.moments.at(-1);
                    if (last?.action !== action || now - last.at >= 60000) home.moments.push({ id: 'moment_' + now, at: now, action, text, source: 'interaction' });
                    home.moments = home.moments.slice(-300); home.objectState ||= {};
                    const key = roomId + ':' + id, old = home.objectState[key] || {};
                    home.objectState[key] = { lastUsedAt: now, action, source: 'interaction', uses: (old.uses || 0) + 1, ...(action === 'Care' ? { wateredAt: now } : {}) };
                }); H.UI.updateStatus();
                H.UI.notice(action === 'Hug' ? '靠近一点，就这样抱一会儿。' : '这一小段日常，已经留在我们的家里。');
            } catch (error) { H.UI.notice(error.message, true); }
        });
        if (!success) throw new Error('这个位置暂时走不过去，试试旁边的家具。');
    }
    H.Interactions = { perform };
})(window.ByndHome3D);
