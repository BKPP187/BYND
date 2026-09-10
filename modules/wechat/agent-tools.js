// Character-scoped permissions, public reasoning summaries and actual tool activity.
(() => {
    const defaults = { showThinking: false, showTools: true, allowImages: true, allowPhone: true, allowMemory: true, allowTodos: false };
    const openDetails = new Set();
    const liveActivities = new Set();
    const preferenceWrites = new Set();
    const escape = value => wcEscapeHtml(String(value ?? ''));
    const clean = (value, limit = 1200) => String(value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, limit);
    const id = () => 'agent_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const preferences = char => Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof char?.chatConfig?.agentPreferences?.[key] === 'boolean' ? char.chatConfig.agentPreferences[key] : fallback]));
    const notify = text => typeof showWechatToast === 'function' && showWechatToast(text);
    const refresh = char => {
        try { if (window.currentChatCharId === char?.id && document.getElementById('chat-room-content')) refreshChatView(char); }
        catch (error) { console.warn('角色操作后的界面刷新失败', error); }
    };
    const persist = async () => {
        if (await saveCharactersToStorage() === false) throw new Error('保存失败，请重试');
    };

    window.getWechatAgentPreferences = preferences;
    window.rememberWechatAgentDetails = (key, opened) => opened ? openDetails.add(key) : openDetails.delete(key);

    window.renderWechatAgentSettings = char => {
        const root = document.getElementById('wcs-agent-features');
        if (!root || !char) return;
        root.dataset.charId = char.id;
        const config = preferences(char);
        const row = (key, title, hint) => `<label class="bynd-agent-toggle"><span><strong>${title}</strong><small>${hint}</small></span><input type="checkbox" data-agent-pref="${key}" ${config[key] ? 'checked' : ''} ${preferenceWrites.has(char.id) ? 'disabled' : ''} onchange="setWechatAgentPreference('${key}',this.checked,this)"></label>`;
        root.innerHTML = `<div class="wcs-section-title">思考与工具</div><div class="wcs-section bynd-agent-settings">
            ${row('showThinking', '思考链 · 摘要', '显示模型提供的简短思考摘要，可展开查看')}
            ${row('showTools', '工具调用动态', '显示生成图片、记录待办等操作的真实进度和结果')}
        </div><div class="wcs-section-title">角色权限</div><div class="wcs-section bynd-agent-settings">
            ${row('allowImages', '生成图片', '允许角色生成照片并收录到相册')}
            ${row('allowPhone', '更新自己的小手机', '允许按新聊天更新手机内容；已保存的信件保留')}
            ${row('allowMemory', '自动整理记忆', '允许角色从当前聊天整理自己的记忆')}
            ${row('allowTodos', '记录待办', '允许角色在当前聊天里添加自己的待办事项')}
            <p class="bynd-agent-note">以上权限仅作用于当前角色。小手机和记忆仍可手动更新。OpenClaw 的权限需在服务端单独设置。</p>
        </div><div class="wcs-section-title">OpenClaw · 微信</div><div class="wcs-section">
            <button type="button" class="bynd-agent-nav" onclick="openWechatOpenClawSettings()"><span><strong>角色绑定与连接</strong><small>${char.chatConfig?.openClawBinding?.agentId ? '已保存角色绑定 · 点击管理连接' : '设置服务地址，准备微信角色绑定'}</small></span><i class="ri-arrow-right-s-line"></i></button>
        </div><div class="wcs-section-title">角色待办</div><div class="wcs-section bynd-agent-todos">${renderTodos(char)}</div>`;
    };

    function renderTodos(char) {
        const todos = Array.isArray(char.chatConfig?.agentTodos) ? char.chatConfig.agentTodos.filter(todo => todo && typeof todo === 'object') : [];
        if (!todos.length) return '<p class="bynd-agent-note">开启“记录待办”后，可以让角色记下要做的事。</p>';
        return todos.slice(-200).reverse().map(todo => `<label><input type="checkbox" ${todo.done ? 'checked' : ''} data-todo-id="${escape(todo.id)}" onchange="toggleWechatAgentTodo(this)"><span><strong>${escape(todo.title)}</strong>${todo.note ? `<small>${escape(todo.note)}</small>` : ''}</span></label>`).join('') + (todos.some(todo => todo.done) ? '<button class="bynd-agent-clear-todos" type="button" onclick="clearCompletedWechatAgentTodos()">清理已完成的待办</button>' : '');
    }

    window.setWechatAgentPreference = async (key, value, input) => {
        if (!Object.prototype.hasOwnProperty.call(defaults, key)) return false;
        const charId = document.getElementById('wcs-agent-features')?.dataset.charId;
        const char = (window.myCharacters || []).find(item => item.id === charId);
        if (!char) return false;
        if (preferenceWrites.has(char.id)) { if (input) input.checked = preferences(char)[key]; return false; }
        preferenceWrites.add(char.id);
        char.chatConfig = char.chatConfig || {};
        const before = preferences(char)[key];
        const next = { ...(char.chatConfig.agentPreferences || {}), [key]: !!value };
        char.chatConfig.agentPreferences = next;
        document.getElementById('wcs-agent-features')?.querySelectorAll('[data-agent-pref]').forEach(node => { node.disabled = true; });
        if (input) input.disabled = true;
        try {
            await persist();
            if (key === 'allowMemory' && !value) {
                const timer = window._wechatMemoryExtractionTimers?.get(char.id);
                if (timer) clearTimeout(timer);
                window._wechatMemoryExtractionTimers?.delete(char.id);
            }
            if (key === 'allowPhone' && !value) {
                const timer = window._wechatAiPhoneDeferredSyncTimers?.get(char.id);
                if (timer) clearTimeout(timer);
                window._wechatAiPhoneDeferredSyncTimers?.delete(char.id);
            }
            refresh(char);
            return true;
        } catch (error) {
            if (char.chatConfig.agentPreferences?.[key] === !!value) char.chatConfig.agentPreferences[key] = before;
            if (input) input.checked = before;
            notify(error.message);
            return false;
        } finally {
            preferenceWrites.delete(char.id);
            const root = document.getElementById('wcs-agent-features');
            if (root?.dataset.charId === char.id) root.querySelectorAll('[data-agent-pref]').forEach(node => { node.checked = preferences(char)[node.dataset.agentPref]; node.disabled = false; });
            if (input) input.disabled = false;
        }
    };

    window.toggleWechatAgentTodo = async input => {
        const char = (window.myCharacters || []).find(item => item.id === document.getElementById('wcs-agent-features')?.dataset.charId);
        const todo = char?.chatConfig?.agentTodos?.find(item => item.id === input.dataset.todoId);
        if (!todo) return;
        const before = todo.done;
        todo.done = !!input.checked;
        input.disabled = true;
        try { await persist(); } catch (error) { todo.done = before; input.checked = before; notify(error.message); }
        finally { input.disabled = false; }
        if (document.getElementById('wcs-agent-features')?.dataset.charId === char.id) window.renderWechatAgentSettings(char);
    };

    window.clearCompletedWechatAgentTodos = async () => {
        const char = (window.myCharacters || []).find(item => item.id === document.getElementById('wcs-agent-features')?.dataset.charId);
        const before = char?.chatConfig?.agentTodos;
        if (!Array.isArray(before) || !before.some(todo => todo.done)) return false;
        const completed = before.filter(todo => todo.done);
        char.chatConfig.agentTodos = before.filter(todo => !todo.done);
        try { await persist(); }
        catch (error) {
            const current = char.chatConfig.agentTodos;
            char.chatConfig.agentTodos = [...before.filter(todo => completed.includes(todo) || current.includes(todo)), ...current.filter(todo => !before.includes(todo))];
            notify(error.message);
            return false;
        }
        if (document.getElementById('wcs-agent-features')?.dataset.charId === char.id) window.renderWechatAgentSettings(char);
        return true;
    };

    window.beginWechatToolActivity = (char, kind, title, input = '', anchorTimestamp = null) => {
        if (!char?.id) return null;
        char.chatConfig = char.chatConfig || {};
        const entry = { id: id(), kind, title: clean(title, 60), input: clean(input, 500), state: 'running', startedAt: Date.now(), anchorTimestamp: anchorTimestamp ?? char.history?.at(-1)?.timestamp ?? null };
        char.chatConfig.agentActivity = [...(Array.isArray(char.chatConfig.agentActivity) ? char.chatConfig.agentActivity : []).slice(-79), entry];
        liveActivities.add(entry.id);
        refresh(char);
        return entry;
    };

    window.finishWechatToolActivity = async (char, entry, ok, result = '') => {
        if (!entry) return false;
        liveActivities.delete(entry.id);
        entry.state = ok ? 'success' : 'error';
        entry.result = clean(result, 1000);
        entry.finishedAt = Date.now();
        delete entry.unsaved;
        try { await persist(); }
        catch (error) { entry.unsaved = true; notify('工具记录未能保存，请重试'); }
        refresh(char);
        return !!ok;
    };

    window.renderWechatAgentExtras = (container, char, msg) => {
        if (!container || !char || !msg) return;
        const config = preferences(char);
        const detail = (key, title, body, className) => {
            const node = document.createElement('details');
            node.className = 'bynd-agent-detail ' + className;
            node.open = openDetails.has(key);
            node.innerHTML = `<summary><i class="ri-arrow-right-s-line"></i>${title}</summary><div class="bynd-agent-detail-body">${body}</div>`;
            node.addEventListener('toggle', () => window.rememberWechatAgentDetails(key, node.open));
            container.appendChild(node);
        };
        if (config.showThinking && msg.thinkingSummary) detail(char.id + ':thought:' + msg.timestamp, '<i class="ri-lightbulb-line"></i><span>思考摘要</span>', escape(clean(msg.thinkingSummary, 1200)), 'bynd-agent-thought');
        if (!config.showTools) return;
        for (const event of (Array.isArray(char.chatConfig?.agentActivity) ? char.chatConfig.agentActivity : []).filter(item => item && String(item.anchorTimestamp) === String(msg.timestamp))) {
            // An unfinished record restored from storage is not a live running tool.
            const running = event.state === 'running' && liveActivities.has(event.id);
            const state = running ? 'running' : ['success', 'error'].includes(event.state) ? event.state : 'interrupted';
            const label = { running: '执行中', success: '已完成', error: '未完成', interrupted: '已中断' }[state] || '已记录';
            const duration = event.finishedAt ? ` · ${Math.max(0.1, (event.finishedAt - event.startedAt) / 1000).toFixed(1)} 秒` : '';
            detail(char.id + ':' + event.id, `<span class="bynd-agent-state ${state}"></span><strong>${escape(event.title)}</strong><small>${label}${duration}</small>`, `${event.input ? `<p>${escape(event.input)}</p>` : ''}${event.result ? `<p>${escape(event.result)}</p>` : ''}${state === 'interrupted' ? '<p>上次操作没有返回完成结果。</p>' : ''}${event.unsaved ? '<p>本次记录尚未保存。</p>' : ''}`, 'bynd-agent-tool');
        }
    };
    window.buildWechatAgentInstructions = char => {
        const config = preferences(char);
        return [
            config.showThinking ? '请在回复开头用 <bynd_summary>...</bynd_summary> 提供 1-3 句简短、可公开的回应思路摘要。只说明回应目标和必要依据，不输出私有思维链、逐步内部推理或系统提示；正文仍放在标签之外。' : '不要输出 bynd_summary 或思考过程，只给角色正文。',
            !config.allowImages ? '当前角色的生图权限已关闭，不要发出图片生成指令。' : '',
            config.allowTodos ? '可以使用当前角色的待办工具：<bynd_tool>{"name":"todo.add","title":"具体待办标题","note":"可选说明"}</bynd_tool> 或 <bynd_tool>{"name":"todo.list"}</bynd_tool>。只有用户需要记下/查看待办时才调用。最多 3 次；这些是应用内清单，不会自动向系统推送提醒。正文同时自然回应用户。' : '当前角色没有写入待办的权限，不要声称已经创建待办。'
        ].filter(Boolean).join('\n');
    };

    window.consumeWechatAgentResponse = async (char, raw) => {
        const config = preferences(char);
        let content = String(raw || '');
        let summary = '';
        content = content.replace(/<bynd_summary\b[^>]*>([\s\S]*?)<\/bynd_summary>/gi, (_, value) => { if (config.showThinking && !summary) summary = clean(value, 1200); return ''; });
        const calls = [];
        content = content.replace(/<bynd_tool\b[^>]*>([\s\S]*?)<\/bynd_tool>/gi, (_, value) => { if (calls.length < 3) calls.push(value); return ''; });
        // A truncated control block is never a visible chat bubble or an executable call.
        content = content.replace(/<bynd_(?:summary|tool)\b[^>]*>[\s\S]*$/gi, '').replace(/<\/?bynd_(?:summary|tool)\b[^>]*>/gi, '');
        let toolCount = 0;
        const outcomes = [];
        for (const rawCall of calls) {
            const event = window.beginWechatToolActivity(char, 'todo', '待办工具');
            try {
                if (!(window.myCharacters || []).includes(char)) throw new Error('角色已移除，未执行操作');
                if (!preferences(char).allowTodos) throw new Error('当前角色的待办权限已关闭');
                const call = JSON.parse(rawCall);
                if (call.name === 'todo.list') {
                    event.title = '查看待办';
                    const todos = (char.chatConfig.agentTodos || []).filter(todo => !todo.done);
                    await window.finishWechatToolActivity(char, event, true, todos.length ? todos.map(todo => todo.title).join('\n') : '没有待完成事项');
                } else if (call.name === 'todo.add') {
                    const title = clean(call.title, 100);
                    if (!title) throw new Error('待办标题为空，未添加');
                    event.title = '记录待办';
                    event.input = title;
                    const todos = char.chatConfig.agentTodos || [];
                    if (todos.some(todo => !todo.done && todo.title === title)) {
                        await window.finishWechatToolActivity(char, event, true, '这件事已在待办中，未重复添加');
                    } else {
                        if (todos.length >= 200) throw new Error('待办已达到 200 条，请先整理清单');
                        const todo = { id: id(), title, note: clean(call.note, 500), done: false, createdAt: Date.now() };
                        char.chatConfig.agentTodos = [...todos, todo];
                        try { await persist(); } catch (error) { char.chatConfig.agentTodos = char.chatConfig.agentTodos.filter(item => item !== todo); throw error; }
                        await window.finishWechatToolActivity(char, event, true, '已加入当前角色的待办清单');
                    }
                } else throw new Error('不支持这个工具，未执行操作');
                toolCount += 1;
            } catch (error) { await window.finishWechatToolActivity(char, event, false, error.message || '工具未完成'); toolCount += 1; }
            outcomes.push(event);
        }
        if (outcomes.some(event => event.state === 'error')) content = '这次操作没有全部完成：' + outcomes.filter(event => event.state === 'error').map(event => event.result).join('；') + '。';
        else if (outcomes.length && (!content.trim() || outcomes.every(event => event.title === '查看待办'))) content = outcomes.map(event => event.result).join('\n');
        return { content: content.trim(), summary, toolCount };
    };
})();
