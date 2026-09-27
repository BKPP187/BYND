(function (H) {
    'use strict';
    const destinations = { 'Play Music': 'music', Photo: 'album', Game: 'game' };
    function perform(id, action) {
        if (id.startsWith('memory-')) { H.UI.showMemories(); return; }
        const row = H.runtime?.furniture().find(item => item.placement.id === id);
        if (!row || !row.item.actions.includes(action)) throw new Error('这个互动暂时不可用。');
        if (destinations[action]) { H.Bridge.open(destinations[action]); return; }
        if (action === 'Memory') { H.UI.showMemories(); return; }
        if (action === 'Look At') { H.runtime.emote('Happy'); H.UI.notice(row.placement.reason || '这里有我们一起生活的小小痕迹。'); return; }
        if (action === 'Care') { H.State.moment('Care', '一起照顾了窗边的绿植'); H.runtime.emote('Happy'); H.UI.notice('给小绿植留了一点照顾，也记在我们的日子里。'); return; }
        const success = H.runtime.interact(id, action, () => {
            try {
                const text = action === 'Hug' ? '在小屋里给了彼此一个拥抱' : '一起在' + row.item.name + '旁，' + (H.Living.labels[action] || action);
                H.State.moment(action, text); H.UI.updateStatus();
                H.UI.notice(action === 'Hug' ? '靠近一点，就这样抱一会儿。' : '这一小段日常，已经留在我们的家里。');
            } catch (error) { H.UI.notice(error.message, true); }
        });
        if (!success) throw new Error('这个位置暂时走不过去，试试旁边的家具。');
    }
    H.Interactions = { perform };
})(window.ByndHome3D);
