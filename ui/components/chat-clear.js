// Clearing a conversation is a multi-store operation; keep a scoped recovery snapshot.
(function () {
    'use strict';
    const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
    const busy = new Set();
    function snapshot(char) {
        return { history: clone(char.history || []), lastMsg: char.lastMsg, unreadCount: char.unreadCount, config: clone(char.chatConfig || {}), memory: clone(getWechatMemoryStore().chars?.[char.id]), forum: window.LivingWorld?.capturePrivateChatState?.(char) };
    }
    function restoreChar(char, before, after, merge) {
        const current = char.chatConfig || {};
        const oldKeys = new Set(before.history.map(item => JSON.stringify(item)));
        char.history = merge ? [...clone(before.history), ...(char.history || []).filter(item => !oldKeys.has(JSON.stringify(item)))] : clone(before.history);
        if (!merge || !char.lastMsg) char.lastMsg = before.lastMsg;
        if (!merge || equal(char.unreadCount, after.unreadCount)) char.unreadCount = before.unreadCount;
        for (const key of new Set([...Object.keys(before.config), ...Object.keys(after.config)])) {
            if (equal(before.config[key], after.config[key])) continue;
            if (merge && !equal(current[key], after.config[key])) continue;
            if (Object.hasOwn(before.config, key)) current[key] = clone(before.config[key]);
            else delete current[key];
        }
        char.chatConfig = current;
    }
    function restoreMemory(char, before, merge = true) {
        const store = getWechatMemoryStore(); store.chars = store.chars || {};
        if (before) {
            const current = store.chars[char.id];
            const restored = clone(before);
            if (merge && current) for (const key of ['segments', 'longTerm', 'compressed']) restored[key] = [...new Map([...(restored[key] || []), ...(current[key] || [])].map(item => [item.id || JSON.stringify(item), item])).values()];
            store.chars[char.id] = restored;
        } else if (!merge) delete store.chars[char.id];
        saveWechatMemoryStore(store);
    }
    function refresh(char) { refreshChatView(char); renderChatList(); }
    async function clear(char) {
        if (!char?.id || busy.has(char.id)) return false;
        busy.add(char.id);
        let before, after;
        try {
            before = snapshot(char);
            char.history = []; char.lastMsg = '';
            resetWechatChatDerivedContext(char, { strict: true });
            after = snapshot(char);
            if (await saveCharactersToStorage() === false) throw new Error('聊天记录未能保存');
            window._wechatExpandedHistoryIds?.delete?.(char.id);
            refresh(char); closeChatSettings();
            window.ByndUndo?.offer({ label: '已清空聊天与自动记忆', undo: async () => {
                const currentChar = (window.myCharacters || []).find(item => item.id === char.id);
                if (!currentChar) throw new Error('角色已被移除，无法恢复到这段聊天');
                if (busy.has(char.id)) throw new Error('这段聊天正在保存，请稍后重试');
                busy.add(char.id);
                const latest = snapshot(currentChar);
                try {
                    restoreChar(currentChar, before, after, true);
                    restoreMemory(currentChar, before.memory);
                    window.LivingWorld?.restorePrivateChatState?.(before.forum);
                    if (await saveCharactersToStorage() === false) throw new Error('恢复未能保存');
                    refresh(currentChar); return true;
                } catch (error) {
                    restoreChar(currentChar, latest, snapshot(currentChar), false);
                    try {
                        restoreMemory(currentChar, latest.memory, false);
                        const preserved = new Set(latest.forum?.events?.map(item => item.id) || []);
                        window.LivingWorld?.removePrivateChatState?.({ events: (before.forum?.events || []).filter(item => !preserved.has(item.id)) });
                        await saveCharactersToStorage();
                    } catch (rollbackError) { console.error('聊天恢复回滚未完成', rollbackError); }
                    refresh(currentChar); throw error;
                } finally { busy.delete(char.id); }
            } });
            return true;
        } catch (error) {
            let recoveryFailed = false;
            if (before) {
                restoreChar(char, before, after || snapshot(char), false);
                try { restoreMemory(char, before.memory, false); window.LivingWorld?.restorePrivateChatState?.(before.forum); await saveCharactersToStorage(); }
                catch (rollbackError) { recoveryFailed = true; console.error('聊天清空回滚未完成', rollbackError); }
                refresh(char);
            }
            console.error('清空聊天失败', error); window.showWechatToast?.(recoveryFailed ? '清空失败，部分记录恢复未完成，请释放存储后重试。' : '清空失败，聊天记录已保留，请重试'); return false;
        } finally { busy.delete(char.id); }
    }
    window.ByndChatClear = { clear };
})();
