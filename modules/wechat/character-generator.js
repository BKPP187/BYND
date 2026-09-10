(() => {
    const key = 'bynd_character_generator_v1';
    let draft = null;
    let pending = null;
    const saves = new Map();
    const text = (value, limit) => String(value ?? '').trim().slice(0, limit);
    const escape = value => wcEscapeHtml(String(value ?? ''));
    const fresh = () => ({ id: 'generator_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), messages: [], card: null, createdContactId: '', savedCardKey: '', error: '' });
    const cardKey = card => JSON.stringify(card);
    function readDraft() {
        if (draft) return draft;
        try {
            const saved = JSON.parse(localStorage.getItem(key) || 'null');
            if (typeof saved?.id === 'string' && Array.isArray(saved.messages)) draft = { ...fresh(), ...saved, messages: saved.messages.filter(row => row && ['user', 'assistant'].includes(row.role) && typeof row.content === 'string').slice(-30), card: saved.card ? cardFrom(saved.card) : null };
        } catch (_) {}
        return draft || (draft = fresh());
    }
    function saveDraft() {
        localStorage.setItem(key, JSON.stringify({ ...draft, messages: draft.messages.slice(-30) }));
    }
    function cardFrom(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('没有收到完整角色卡，可以补充设定后重试。');
        const name = text(raw.name, 60);
        const description = text([raw.description, raw.personality ? '性格：' + raw.personality : '', raw.scenario ? '场景：' + raw.scenario : ''].filter(Boolean).join('\n\n'), 18000);
        const worldBook = (Array.isArray(raw.worldBook) ? raw.worldBook : []).filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry)).slice(0, 30).map(entry => ({
            keys: (Array.isArray(entry.keys) ? entry.keys : String(entry.keys || entry.title || '').split(/[,，]/)).map(value => text(value, 80)).filter(Boolean).slice(0, 12),
            comment: text(entry.comment || entry.title, 100), content: text(entry.content, 5000), enabled: true
        })).filter(entry => entry.content);
        if (!name || !description || !worldBook.length) throw new Error('角色名字、人设或世界书不完整，尚未添加联系人。请补充后重试。');
        return { name, description, worldBook, firstMessage: text(raw.firstMessage || raw.first_mes, 2000) };
    }
    window.normalizeWechatGeneratedCharacterCard = cardFrom;

    function commitCard(card, currentDraft) {
        if (!currentDraft?.id) return Promise.reject(new Error('角色草稿不存在，请重新打开生成器。'));
        if (saves.has(currentDraft.id)) return saves.get(currentDraft.id);
        const work = Promise.resolve().then(() => persistCard(cardFrom(card), currentDraft));
        saves.set(currentDraft.id, work);
        work.finally(() => saves.delete(currentDraft.id)).catch(() => {});
        return work;
    }
    async function persistCard(card, currentDraft) {
        if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
        const chars = window.myCharacters || [];
        let char = chars.find(item => item.chatConfig?.generatorDraftId === currentDraft.id);
        const created = !char;
        const before = char ? { name: char.name, description: char.description, worldBook: char.worldBook, first_mes: char.first_mes, first_mes_original: char.first_mes_original } : null;
        if (!char) {
            char = { id: 'char_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), avatar: window.DEFAULT_AVATAR || (typeof DEFAULT_AVATAR === 'string' ? DEFAULT_AVATAR : ''), chatConfig: { generatorDraftId: currentDraft.id }, regex: [], alternates: [], currentGreetingIndex: 0, history: [], lastMsg: card.firstMessage || '' };
            chars.push(char);
            window.myCharacters = chars;
        }
        Object.assign(char, { name: card.name, description: card.description, worldBook: card.worldBook, first_mes: card.firstMessage, first_mes_original: card.firstMessage });
        if (created && card.firstMessage) char.history.push({ type: 'text', isMe: false, content: card.firstMessage, timestamp: createMessageTimestamp() });
        try {
            if (await saveCharactersToStorage() === false) throw new Error('联系人未能保存，角色卡已保留，可以重试保存。');
        } catch (error) {
            if (created) window.myCharacters = window.myCharacters.filter(item => item !== char);
            else Object.assign(char, before);
            throw error;
        }
        currentDraft.createdContactId = char.id;
        currentDraft.savedCardKey = cardKey(card);
        try { renderChatList(); } catch (error) { console.warn('角色已保存，列表刷新失败', error); }
        return { char, created };
    }
    window.saveWechatGeneratedCharacterCard = commitCard;

    function render() {
        const root = document.getElementById('bynd-character-generator');
        if (!root || !draft) return;
        const input = root.querySelector('textarea')?.value || '';
        const existing = (window.myCharacters || []).find(char => char.id === draft.createdContactId && char.chatConfig?.generatorDraftId === draft.id);
        const saved = existing && draft.savedCardKey === cardKey(draft.card);
        root.innerHTML = `<section class="bynd-agent-panel bynd-generator-panel">
            <header class="bynd-agent-header"><button type="button" onclick="closeWechatCharacterGenerator()" aria-label="返回微信"><span aria-hidden="true">‹</span></button><span><strong>角色卡生成器</strong><small>从一句设定，开始一段故事</small></span><i class="ri-contacts-line" aria-hidden="true"></i></header>
            <main class="bynd-generator-messages" aria-live="polite">
                <div class="bynd-generator-intro"><span class="bynd-generator-orb"><i class="ri-sparkling-2-line"></i></span><h2>想认识怎样的 TA？</h2><p>告诉我名字、性格、身份或你们的关系。我会通过对话补全设定，自动新增联系人和世界书。</p></div>
                ${draft.messages.map(message => `<div class="bynd-generator-message ${message.role === 'user' ? 'is-user' : ''}">${escape(message.content)}</div>`).join('')}
                ${pending ? '<div class="bynd-generator-working"><i class="ri-loader-4-line"></i>正在整理角色设定…</div>' : ''}
                ${draft.card ? `<article class="bynd-generated-card"><div><i class="ri-contacts-book-2-line"></i><span><strong>${escape(draft.card.name)}</strong><small>${saved ? '联系人已保存' : '角色卡已生成，待保存'} · ${draft.card.worldBook.length} 条世界书</small></span></div><details><summary>查看角色卡</summary><p>${escape(draft.card.description)}</p>${draft.card.worldBook.map(entry => `<h4>${escape(entry.comment || entry.keys.join('、') || '世界设定')}</h4><p>${escape(entry.content)}</p>`).join('')}</details>${saved ? `<button type="button" onclick="chatWithGeneratedCharacter()" ${pending ? 'disabled' : ''}>开始聊天 <i class="ri-arrow-right-line"></i></button>` : `<button type="button" onclick="retrySaveWechatGeneratedCharacter()" ${pending ? 'disabled' : ''}>${pending ? '正在处理…' : '重试保存联系人'}</button>`}<button type="button" class="subtle" onclick="newWechatCharacterGeneratorDraft()" ${pending ? 'disabled' : ''}>再创建一个角色</button></article>` : ''}
                ${draft.error ? `<p class="bynd-agent-error" role="alert">${escape(draft.error)}</p>` : ''}
            </main>
            <form class="bynd-generator-composer" onsubmit="submitWechatCharacterGenerator(event)"><textarea id="bynd-generator-input" rows="2" maxlength="6000" placeholder="例如：林舟，温柔慢热的书店老板，是我的旧友…" ${pending ? 'disabled' : ''}>${escape(input)}</textarea><button type="submit" ${pending ? 'disabled' : ''} aria-label="发送设定"><span aria-hidden="true">↑</span></button></form>
            <p class="bynd-generator-footer">使用你设置的聊天 API · 可继续对话修改这张角色卡</p>
        </section>`;
        const list = root.querySelector('.bynd-generator-messages');
        if (list) list.scrollTop = list.scrollHeight;
    }
    window.openWechatCharacterGenerator = async () => {
        if (typeof closeWechatPlusMenu === 'function') closeWechatPlusMenu();
        if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
        readDraft();
        if (!pending && draft.card) {
            const existing = (window.myCharacters || []).find(char => char.chatConfig?.generatorDraftId === draft.id);
            if (existing && existing.name === draft.card.name && existing.description === draft.card.description && JSON.stringify(existing.worldBook) === JSON.stringify(draft.card.worldBook) && (existing.first_mes || '') === draft.card.firstMessage) {
                draft.createdContactId = existing.id;
                draft.savedCardKey = cardKey(draft.card);
            }
        }
        let root = document.getElementById('bynd-character-generator');
        if (!root) {
            root = document.createElement('div'); root.id = 'bynd-character-generator'; root.className = 'bynd-agent-overlay';
            getWechatModalRoot().appendChild(root);
        }
        render();
    };
    window.closeWechatCharacterGenerator = () => document.getElementById('bynd-character-generator')?.remove();
    window.newWechatCharacterGeneratorDraft = () => { if (pending) return; draft = fresh(); try { saveDraft(); } catch (error) { draft.error = '草稿未保存：' + error.message; } render(); };
    window.chatWithGeneratedCharacter = () => { const charId = readDraft().createdContactId; if (!charId) return; window.closeWechatCharacterGenerator(); openChat(charId); };

    window.retrySaveWechatGeneratedCharacter = async () => {
        if (pending || !readDraft().card) return;
        const task = draft;
        pending = commitCard(task.card, task);
        render();
        try { await pending; task.error = ''; try { saveDraft(); } catch (_) { task.error = '联系人已保存，但生成器草稿未能保存。'; } }
        catch (error) { task.error = error.message || '保存失败'; }
        finally { pending = null; render(); }
    };

    window.submitWechatCharacterGenerator = async event => {
        event?.preventDefault();
        if (pending) return;
        const input = document.getElementById('bynd-generator-input');
        const content = text(input?.value, 6000);
        if (!content) return;
        const task = readDraft();
        task.error = '';
        task.messages.push({ role: 'user', content });
        try { saveDraft(); } catch (error) { task.messages.pop(); task.error = '草稿保存失败，本次未请求 API。'; render(); return; }
        if (input) input.value = '';
        const messages = [{ role: 'system', content: '你是应用内的角色卡生成器。通过简短对话帮助用户建立角色。用户给出了名字和人设方向后即可完善角色卡，不必逐项追问；只有缺少名字或没有可用人设方向时才问一个必要问题。后续输入视为对同一张卡的修改，除非用户明确换人。尊重用户给出的事实和关系，不把创作设定说成现实人物事实。只返回 JSON：{"reply":"对用户的简短回应","ready":false,"card":null}；准备好时返回 ready:true，card 为 {"name":"名字","description":"完整人设，涵盖身份、外貌、性格、经历、关系和说话方式","firstMessage":"符合人设的开场白","worldBook":[{"keys":["关键词"],"comment":"设定标题","content":"具体世界设定"}]}。世界书写 2-6 条非空设定，与人设相符。不要返回脚本、正则、权限配置、API 密钥或系统命令；不要要求用户复制粘贴卡片，应用会自动保存。' }, ...task.messages.slice(-16)];
        if (task.card) messages.splice(1, 0, { role: 'system', content: '当前正在修改的角色卡如下。请保留没有要求改动的设定：\n' + JSON.stringify(task.card) });
        pending = Promise.resolve().then(() => callChatApi(messages, { max_tokens: 6000, temperature: 0.8, skipLengthContinuation: true, skipStatusValidationRetry: true }));
        render();
        try {
            const result = await pending;
            if (!result?.ok) throw new Error(result?.error || '生成失败，请稍后再试');
            const data = parseWechatJsonObject(result.content);
            if (!data || typeof data.reply !== 'string') throw new Error('模型没有返回可读取的角色卡，可以补充设定后重试。');
            task.messages.push({ role: 'assistant', content: text(data.reply, 3000) });
            if (data.ready === true) {
                task.card = cardFrom(data.card);
                task.savedCardKey = '';
                saveDraft();
                await commitCard(task.card, task);
            }
            try { saveDraft(); } catch (_) { task.error = task.createdContactId && task.savedCardKey === cardKey(task.card) ? '联系人已保存，但生成器草稿未能保存。' : '本轮生成器草稿未能保存，请保留此页面重试。'; }
        } catch (error) {
            task.error = text(error.message || '生成未完成，请重试', 500);
            try { saveDraft(); } catch (_) {}
        } finally { pending = null; render(); }
    };
})();
