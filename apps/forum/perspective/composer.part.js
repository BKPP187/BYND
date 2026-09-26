    function setViewer(id) {
        if (!loadState().accounts[id]) return;
        const stayInProfile = activeTab === 'profile';
        try { mutate(next => { next.viewerId = id; const event = addEvent(next, 'forum_view_as', 'user', id, { risk: id === 'user' ? 'none' : 'low' }, 'private'); grantKnowledge(next, 'user', event, 'user', 'direct', 1); if (id !== 'user') recordTrace(next, id, 'switch_perspective', 'low'); }); }
        catch (error) { showToast(error.message); return; }
        perspectiveOpen = false; profileEditOpen = false; searchQuery = ''; activeTab = stayInProfile ? 'profile' : 'home'; activePostId = stayInProfile ? id : ''; render(); showToast(`${account(id).name} · 视角`);
    }
