    async function promoteNpc(npcId) {
        if (viewer().id !== 'user') { showToast('请切回我的视角后添加联系人。'); return; }
        const npc = loadState().npcs.find(item => item.id === npcId);
        if (!canPromoteNpc(npc)) { showToast('还需要更多真实互动。'); return; }
        if (!Array.isArray(window.myCharacters)) { showToast('联系人尚未加载，无法保存。'); return; }
        const contactId = `living_world_${npc.id}`;
        let contact = window.myCharacters.find(item => item?.id === contactId);
        if (!contact) {
            contact = { id: contactId, name: npc.name, avatar: npc.avatar || DEFAULT_AVATAR, description: npc.summary, personality: npc.summary, scenario: npc.summary, history: [], chatConfig: {} };
            window.myCharacters.push(contact);
            try {
                if (typeof window.saveCharactersToStorage !== 'function') throw new Error('联系人保存服务不可用。');
                const saved = await window.saveCharactersToStorage();
                if (saved === false) throw new Error('联系人保存失败。');
            } catch (error) {
                const index = window.myCharacters.indexOf(contact); if (index >= 0) window.myCharacters.splice(index, 1);
                showToast(error?.message || '联系人保存失败。'); return;
            }
        }
        try {
            mutate(next => {
                const target = next.npcs.find(item => item.id === npcId); if (!target) throw new Error('该论坛成员已不存在。');
                target.tier = 'contact'; target.persistent = true; target.contactCharId = contactId;
                const event = addEvent(next, 'npc_promoted_to_contact', 'user', npcId, { contactId }, 'private'); grantKnowledge(next, 'user', event, 'user', 'direct', 1);
            });
            syncAccounts(); render(); showToast('已添加为联系人。');
        } catch (error) { showToast(error?.message || '联系人状态保存失败。'); }
    }
    function openNotice(id) { const notice = safeList(loadState().notifications[viewer().id]).find(item => item.id === id); if (!notice) return; try { mutate(next => { const item = safeList(next.notifications[next.viewerId]).find(row => row.id === id); if (item) item.read = true; }); if (notice.postId && loadState().posts.some(post => post.id === notice.postId && isVisible(post, viewer().id))) openPost(notice.postId); else render(); } catch (error) { showToast(error.message); } }

