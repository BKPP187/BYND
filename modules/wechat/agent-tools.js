// Character-scoped permissions, public reasoning summaries and actual tool activity.
(() => {
    const defaults = { streamReplies: false, showTokenUsage: false, showThinking: false, showTools: true, allowImages: true, allowPhone: true, allowMemory: true, allowTodos: false, allowTools: false, toolWeather: true, toolPlaces: true, toolMovies: true, toolShop: true, toolMcp: true };
    const openDetails = new Set();
    const liveActivities = new Set();
    const preferenceWrites = new Set();
    const escape = value => wcEscapeHtml(String(value ?? ''));
    const clean = (value, limit = 1200) => String(value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, limit);
    const id = () => 'agent_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const preferences = char => Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof char?.chatConfig?.agentPreferences?.[key] === 'boolean' ? char.chatConfig.agentPreferences[key] : fallback]));
    const reasoningAppearance = char => {
        const saved = char?.chatConfig?.agentReasoningAppearance || {};
        return {
            title: clean(saved.title, 36) || '思考摘要',
            css: String(saved.css || '').trim()
        };
    };
    const notify = text => typeof showWechatToast === 'function' && showWechatToast(text);
    const refresh = char => {
        try { if (window.currentChatCharId === char?.id && document.getElementById('chat-room-content')) refreshChatView(char); }
        catch (error) { console.warn('角色操作后的界面刷新失败', error); }
    };
    const persist = async () => {
        if (await saveCharactersToStorage() === false) throw new Error('保存失败，请重试');
    };

    // The user may style only this component.  Keeping selectors scoped means a
    // character's theme tweak can never accidentally recolor the whole chat.
    const sanitizeReasoningCss = value => {
        const source = String(value || '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (!source) return '';
        if (source.length > 12000) throw new Error('思考摘要 CSS 最多 12000 个字符');
        if (/@(?:import|namespace|font-face|keyframes|media|supports)\b|url\s*\(|expression\s*\(|-moz-binding|<\/?style/iu.test(source)) {
            throw new Error('只支持 .bynd-reasoning 范围内的普通样式规则');
        }
        const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
        const rules = [...source.matchAll(rulePattern)];
        if (!rules.length || source.replace(rulePattern, '').trim()) throw new Error('CSS 格式不完整，请使用“选择器 { 属性: 值; }”');
        const scopedRules = rules.map(([, selectorText, declarations]) => {
            const selectors = selectorText.split(',').map(selector => selector.trim()).filter(Boolean);
            if (!selectors.length || selectors.some(selector => !/^\.bynd-reasoning(?:[\s>+~.#:\[\]_\-]|$)/u.test(selector))) {
                throw new Error('CSS 选择器必须从 .bynd-reasoning 开始');
            }
            return selectors.map(selector => `#app-wechat-window ${selector}`).join(', ') + `{${declarations}}`;
        });
        return scopedRules.join('\n');
    };

    const applyReasoningCss = char => {
        const doc = window.document;
        if (!doc?.getElementById) return false;
        let style = doc.getElementById('bynd-reasoning-custom-style');
        const css = sanitizeReasoningCss(reasoningAppearance(char).css);
        if (!css) {
            style?.remove?.();
            return true;
        }
        if (!style && doc.createElement && doc.head?.appendChild) {
            style = doc.createElement('style');
            style.id = 'bynd-reasoning-custom-style';
            doc.head.appendChild(style);
        }
        if (!style) return false;
        style.textContent = css;
        return true;
    };

    const compactReasoningText = value => clean(value, 1200).replace(/\s+/g, ' ').trim().slice(0, 118);

    function closeReasoningSheet(sheet) {
        const node = sheet || document.getElementById('bynd-reasoning-sheet');
        if (!node) return;
        node.classList?.remove('is-open');
        setTimeout(() => node.remove?.(), 160);
    }

    function openReasoningSheet(title, content, themeId) {
        const doc = window.document;
        if (!doc?.body || !doc.createElement) return;
        closeReasoningSheet();
        const sheet = doc.createElement('div');
        sheet.id = 'bynd-reasoning-sheet';
        sheet.className = `bynd-reasoning-sheet${themeId === 'claude' ? ' bynd-reasoning-sheet--claude' : ''}`;
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.setAttribute('aria-label', title);
        sheet.innerHTML = `<div class="bynd-reasoning-sheet__backdrop" data-reasoning-close></div><section class="bynd-reasoning-sheet__panel"><div class="bynd-reasoning-sheet__handle"></div><header><button type="button" aria-label="关闭" data-reasoning-close><i class="ri-close-line"></i></button><strong>${escape(themeId === 'claude' ? 'Summary' : title)}</strong><span aria-hidden="true"></span></header><div class="bynd-reasoning-sheet__content bynd-reasoning__content"><span class="bynd-reasoning-sheet__dot" aria-hidden="true"></span><p>${escape(clean(content, 1200))}</p></div></section>`;
        sheet.addEventListener('click', event => {
            if (event.target?.closest?.('[data-reasoning-close]')) closeReasoningSheet(sheet);
        });
        sheet.addEventListener('keydown', event => { if (event.key === 'Escape') closeReasoningSheet(sheet); });
        (doc.getElementById('app-wechat-window') || doc.body).appendChild(sheet);
        requestAnimationFrame(() => sheet.classList?.add('is-open'));
        sheet.querySelector?.('[data-reasoning-close]')?.focus?.();
    }

    window.getWechatAgentPreferences = preferences;
    window.rememberWechatAgentDetails = (key, opened) => opened ? openDetails.add(key) : openDetails.delete(key);
    window.sanitizeWechatReasoningCss = sanitizeReasoningCss;
    window.applyWechatReasoningCss = applyReasoningCss;

    window.renderWechatAgentSettings = char => {
        const root = document.getElementById('wcs-agent-features');
        if (!root || !char) return;
        root.dataset.charId = char.id;
        const config = preferences(char);
        const appearance = reasoningAppearance(char);
        const row = (key, title, hint) => `<label class="bynd-agent-toggle"><span><strong>${title}</strong><small>${hint}</small></span><input type="checkbox" data-agent-pref="${key}" ${config[key] ? 'checked' : ''} ${preferenceWrites.has(char.id) ? 'disabled' : ''} onchange="setWechatAgentPreference('${key}',this.checked,this)"></label>`;
        root.innerHTML = `<div class="wcs-section-title">回复方式</div><div class="wcs-section bynd-agent-settings">
            ${row('streamReplies', '流式回复', '边生成边显示文字；接口不支持流式时自动按完整回复处理')}
            ${row('showTokenUsage', '显示 Token 用量', '开启后在每轮回复下方显示 API 小票入口，记录请求和上下文组成')}
        </div><div class="wcs-section-title">思考与工具</div><div class="wcs-section bynd-agent-settings">
            ${row('showThinking', '思考摘要', '在消息间显示一行公开摘要；点开后再看完整内容')}
            ${row('showTools', '工具调用动态', '显示生成图片、记录待办等操作的真实进度和结果')}
        </div><div class="wcs-section-title">思考摘要外观</div><div class="wcs-section bynd-agent-settings bynd-reasoning-settings">
            <label>显示标题<input id="bynd-reasoning-title" maxlength="36" value="${escape(appearance.title)}" placeholder="思考摘要"></label>
            <label>自定义 CSS<textarea id="bynd-reasoning-css" maxlength="12000" spellcheck="false" placeholder=".bynd-reasoning { }&#10;.bynd-reasoning__header { }&#10;.bynd-reasoning__content { }">${escape(appearance.css)}</textarea></label>
            <p>仅接受以上 <code>.bynd-reasoning</code> 作用域。</p>
            <button type="button" class="bynd-reasoning-save" onclick="saveWechatReasoningAppearance(this)">保存思考摘要样式</button>
        </div><div class="wcs-section-title">角色权限</div><div class="wcs-section bynd-agent-settings">
            ${row('allowImages', '生成图片', '允许角色生成照片并收录到相册')}
            ${row('allowPhone', '更新自己的小手机', '允许按新聊天更新手机内容；已保存的信件保留')}
            ${row('allowMemory', '自动整理记忆', '允许角色从当前聊天整理自己的记忆')}
            ${row('allowTodos', '记录待办', '允许角色在当前聊天里添加自己的待办事项')}
            <p class="bynd-agent-note">以上权限仅作用于当前角色。小手机和记忆仍可手动更新。OpenClaw 的权限需在服务端单独设置。</p>
        </div><div class="wcs-section-title">角色工具箱</div><div class="wcs-section bynd-agent-settings">
            ${row('allowTools', '允许使用工具', '角色按人设自然需要时会查天气、找店、聊电影、搜商品；不符合人设的调用会被拦下')}
            ${window.ByndCharacterTools?.renderAgentToolRows(char, row) || ''}
            <p class="bynd-agent-note">Key、城市和购物方式在「设置 → 工具」里配置。</p>
        </div><div class="wcs-section-title">角色桌宠</div><div class="wcs-section">
            <button type="button" class="bynd-agent-nav" onclick="openMonitorPetStudio(document.getElementById('wcs-agent-features').dataset.charId)"><span><strong>专属形象与人设互动</strong><small>沿用生图设置，制作透明 3D 形象和专属表情</small></span><i class="ri-arrow-right-s-line"></i></button>
        </div><div class="wcs-section-title">OpenClaw · 微信</div><div class="wcs-section">
            <button type="button" class="bynd-agent-nav" onclick="openWechatOpenClawSettings()"><span><strong>角色绑定与连接</strong><small>${char.chatConfig?.openClawBinding?.agentId ? '已保存角色绑定 · 点击管理连接' : '设置服务地址，准备微信角色绑定'}</small></span><i class="ri-arrow-right-s-line"></i></button>
        </div><div class="wcs-section-title">角色待办</div><div class="wcs-section bynd-agent-todos">${renderTodos(char)}</div>`;
    };

    window.saveWechatReasoningAppearance = async button => {
        const root = document.getElementById('wcs-agent-features');
        const char = (window.myCharacters || []).find(item => item.id === root?.dataset.charId);
        if (!char || !root) return false;
        const title = clean(root.querySelector?.('#bynd-reasoning-title')?.value, 36);
        const inputCss = String(root.querySelector?.('#bynd-reasoning-css')?.value || '');
        let css;
        try { css = sanitizeReasoningCss(inputCss); }
        catch (error) { notify(error.message); return false; }
        const before = char.chatConfig?.agentReasoningAppearance;
        char.chatConfig = char.chatConfig || {};
        if (!title && !css) delete char.chatConfig.agentReasoningAppearance;
        else char.chatConfig.agentReasoningAppearance = { title, css: inputCss.trim() };
        if (button) button.disabled = true;
        try {
            applyReasoningCss(char);
            await persist();
            refresh(char);
            notify('思考摘要样式已保存');
            return true;
        } catch (error) {
            if (before === undefined) delete char.chatConfig.agentReasoningAppearance;
            else char.chatConfig.agentReasoningAppearance = before;
            try { applyReasoningCss(char); } catch (_) {}
            notify(error.message || '保存失败，请重试');
            return false;
        } finally {
            if (button) button.disabled = false;
        }
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

    window.saveWechatApiContextWindow = async input => {
        const char = (window.myCharacters || []).find(item => item.id === document.getElementById('wcs-agent-features')?.dataset.charId);
        if (!char || !input) return false;
        const raw = String(input.value || '').trim();
        const value = raw ? Number(raw) : 0;
        if (raw && (!Number.isInteger(value) || value < 1 || value > 2000000)) {
            notify('请输入 1 到 2,000,000 之间的 Token 上限');
            input.value = char.chatConfig?.apiContextWindow || '';
            return false;
        }
        char.chatConfig = char.chatConfig || {};
        const before = char.chatConfig.apiContextWindow;
        if (value) char.chatConfig.apiContextWindow = value;
        else delete char.chatConfig.apiContextWindow;
        input.disabled = true;
        try { await persist(); return true; }
        catch (error) {
            if (before === undefined) delete char.chatConfig.apiContextWindow;
            else char.chatConfig.apiContextWindow = before;
            input.value = before || '';
            notify(error.message || '保存失败，请重试');
            return false;
        } finally { input.disabled = false; }
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
        const themeId = typeof getWechatUiThemeId === 'function' ? getWechatUiThemeId() : '';
        try { applyReasoningCss(char); } catch (error) { console.warn('思考摘要自定义样式已忽略', error); }
        const detail = (key, title, body, className) => {
            const expanded = openDetails.has(key);
            const node = document.createElement('section');
            node.className = `bynd-agent-detail bynd-agent-detail--${themeId === 'claude' ? 'claude' : 'inline'} ${className}`;
            node.dataset.expanded = String(expanded);
            node.innerHTML = `<button type="button" class="bynd-agent-detail__summary" aria-expanded="${expanded}"><i class="ri-arrow-right-s-line"></i>${title}</button><div class="bynd-agent-detail-body"${expanded ? '' : ' hidden'}>${body}</div>`;
            node.addEventListener('click', event => {
                const trigger = event.target?.closest?.('.bynd-agent-detail__summary');
                if (!trigger) return;
                const next = node.dataset.expanded !== 'true';
                node.dataset.expanded = String(next);
                trigger.setAttribute?.('aria-expanded', String(next));
                const content = node.querySelector?.('.bynd-agent-detail-body');
                if (content) content.hidden = !next;
                window.rememberWechatAgentDetails(key, next);
            });
            container.appendChild(node);
        };
        if (config.showThinking && msg.thinkingSummary) {
            const appearance = reasoningAppearance(char);
            const summary = clean(msg.thinkingSummary, 1200);
            const preview = compactReasoningText(summary);
            const node = document.createElement(themeId === 'claude' ? 'button' : 'section');
            node.className = `bynd-reasoning bynd-reasoning--${themeId === 'claude' ? 'claude' : 'inline'}`;
            if (themeId === 'claude') {
                node.type = 'button';
                node.setAttribute?.('aria-label', `查看${appearance.title}`);
                node.innerHTML = `<span class="bynd-reasoning__icon" aria-hidden="true"><i class="ri-time-line"></i></span><span class="bynd-reasoning__copy"><span class="bynd-reasoning__header">${escape(appearance.title)}</span><span class="bynd-reasoning__preview">${escape(preview)}</span></span><i class="ri-arrow-right-s-line bynd-reasoning__chevron" aria-hidden="true"></i>`;
                node.addEventListener('click', () => openReasoningSheet(appearance.title, summary, themeId));
            } else {
                const key = char.id + ':thought:' + msg.timestamp;
                const expanded = openDetails.has(key);
                node.dataset.expanded = String(expanded);
                node.innerHTML = `<button type="button" class="bynd-reasoning__summary" aria-expanded="${expanded}"><i class="ri-arrow-right-s-line bynd-reasoning__chevron" aria-hidden="true"></i><span class="bynd-reasoning__icon" aria-hidden="true"><i class="ri-loader-4-line"></i></span><span class="bynd-reasoning__header">${escape(appearance.title)}</span></button><div class="bynd-reasoning__content"${expanded ? '' : ' hidden'}>${escape(summary)}</div>`;
                node.addEventListener('click', event => {
                    const trigger = event.target?.closest?.('.bynd-reasoning__summary');
                    if (!trigger) return;
                    const next = node.dataset.expanded !== 'true';
                    node.dataset.expanded = String(next);
                    trigger.setAttribute?.('aria-expanded', String(next));
                    const content = node.querySelector?.('.bynd-reasoning__content');
                    if (content) content.hidden = !next;
                    window.rememberWechatAgentDetails(key, next);
                });
            }
            container.appendChild(node);
        }
        if (Array.isArray(msg.webSources) && msg.webSources.length) {
            const sources = document.createElement('section');
            sources.className = 'bynd-web-sources';
            const heading = document.createElement('strong');
            heading.textContent = '这次查到的来源';
            sources.appendChild(heading);
            msg.webSources.slice(0, 5).forEach((source, index) => {
                try {
                    const url = new URL(source.url);
                    if (!['https:', 'http:'].includes(url.protocol)) return;
                    const link = document.createElement('a');
                    link.href = url.toString();
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = `${index + 1}. ${clean(source.title, 100) || url.hostname}`;
                    sources.appendChild(link);
                } catch (_) {}
            });
            if (sources.querySelector('a')) container.appendChild(sources);
        }
        if (!config.showTools) return;
        const activities = (Array.isArray(char.chatConfig?.agentActivity) ? char.chatConfig.agentActivity : []).filter(item => item && String(item.anchorTimestamp) === String(msg.timestamp));
        const phoneEvents = activities.filter(item => item.kind === 'phone' && ['更新小手机', '更新日记'].includes(item.title));
        const phoneGroup = phoneEvents.length > 1 ? phoneEvents : null;
        for (const original of activities) {
            if (phoneGroup && original.kind === 'phone' && original !== phoneGroup[0]) continue;
            const event = phoneGroup && original === phoneGroup[0] ? {
                ...original,
                id: phoneGroup.map(item => item.id).join(':'),
                title: '更新小手机与日记',
                state: phoneGroup.some(item => item.state === 'error') ? 'error' : phoneGroup.some(item => item.state === 'running') ? 'running' : 'success',
                startedAt: Math.min(...phoneGroup.map(item => item.startedAt)),
                finishedAt: phoneGroup.every(item => item.finishedAt) ? Math.max(...phoneGroup.map(item => item.finishedAt)) : null,
                result: phoneGroup.map(item => `${item.title}：${item.result || (item.state === 'running' ? '执行中' : '已完成')}`).join('\n'),
                unsaved: phoneGroup.some(item => item.unsaved)
            } : original;
            // An unfinished record restored from storage is not a live running tool.
            const running = event.state === 'running' && (phoneGroup && original === phoneGroup[0] ? phoneGroup.some(item => liveActivities.has(item.id)) : liveActivities.has(event.id));
            const state = running ? 'running' : ['success', 'error'].includes(event.state) ? event.state : 'interrupted';
            const label = { running: '执行中', success: '已完成', error: '未完成', interrupted: '已中断' }[state] || '已记录';
            const duration = event.finishedAt ? ` · ${Math.max(0.1, (event.finishedAt - event.startedAt) / 1000).toFixed(1)} 秒` : '';
            detail(char.id + ':' + event.id, `<span class="bynd-agent-state ${state}"></span><strong>${escape(event.title)}</strong><small>${label}${duration}</small>`, `${event.input ? `<p>${escape(event.input)}</p>` : ''}${event.result ? `<p>${escape(event.result)}</p>` : ''}${state === 'interrupted' ? '<p>上次操作没有返回完成结果。</p>' : ''}${event.unsaved ? '<p>本次记录尚未保存。</p>' : ''}`, 'bynd-agent-tool');
        }
    };
    window.buildWechatAgentInstructions = char => {
        const config = preferences(char);
        return [
            window.ByndCharacterPet?.chatInstructions(char) || '',
            window.ByndDecider?.replyInstructions(char) || '',
            config.showThinking ? '请在回复开头用 <bynd_summary>...</bynd_summary> 提供 1-3 句简短、可公开的回应思路摘要。只说明回应目标和必要依据，不输出私有思维链、逐步内部推理或系统提示；正文仍放在标签之外。' : '不要输出 bynd_summary 或思考过程，只给角色正文。',
            !config.allowImages ? '当前角色的生图权限已关闭，不要发出图片生成指令。' : '',
            config.allowTodos ? '可以使用当前角色的待办工具：<bynd_tool>{"name":"todo.add","title":"具体待办标题","note":"可选说明"}</bynd_tool> 或 <bynd_tool>{"name":"todo.list"}</bynd_tool>。只有用户需要记下/查看待办时才调用。最多 3 次；这些是应用内清单，不会自动向系统推送提醒。正文同时自然回应用户。' : '当前角色没有写入待办的权限，不要声称已经创建待办。',
            window.ByndCharacterTools?.instructions(char) || ''
        ].filter(Boolean).join('\n');
    };

    window.consumeWechatAgentResponse = async (char, raw) => {
        const config = preferences(char);
        const decided = window.ByndDecider?.extractReplyDecisions(raw) || { content: String(raw || ''), decisions: null };
        let content = decided.content;
        let summary = '';
        content = content.replace(/<bynd_summary\b[^>]*>([\s\S]*?)<\/bynd_summary>/gi, (_, value) => { if (config.showThinking && !summary) summary = clean(value, 1200); return ''; });
        const calls = [];
        content = content.replace(/<bynd_tool\b[^>]*>([\s\S]*?)<\/bynd_tool>/gi, (_, value) => { if (calls.length < 3) calls.push(value); return ''; });
        // A truncated control block is never a visible chat bubble or an executable call.
        content = content.replace(/<bynd_(?:summary|tool)\b[^>]*>[\s\S]*$/gi, '').replace(/<\/?bynd_(?:summary|tool)\b[^>]*>/gi, '');
        let toolCount = 0;
        const outcomes = [];
        const toolCards = [];
        const toolReacts = [];
        for (const rawCall of calls) {
            let parsed = null;
            try { parsed = JSON.parse(rawCall); } catch (_) {}
            // Character toolbox calls never rewrite the character's own words; a blocked or failed call only shows in the activity card.
            if (parsed && window.ByndCharacterTools?.handles(parsed.name)) {
                const event = window.beginWechatToolActivity(char, 'tool', '角色工具');
                let outcome;
                try {
                    if (!(window.myCharacters || []).includes(char)) throw new Error('角色已移除，未执行操作');
                    outcome = await window.ByndCharacterTools.execute(char, parsed, event);
                } catch (error) { outcome = { ok: false, message: error.message || '工具未完成' }; }
                await window.finishWechatToolActivity(char, event, outcome.ok, outcome.message);
                if (outcome.card) toolCards.push(outcome.card);
                if (outcome.ok && outcome.react) toolReacts.push(outcome.react);
                toolCount += 1;
                continue;
            }
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
        const result = { content: content.trim(), summary, toolCount, decisions: decided.decisions };
        // Cards land after the character's own bubbles; the follow-up reaction is queued in the background.
        if (toolCards.length || toolReacts.length) result.afterAppend = (options = {}) => window.ByndCharacterTools.deliver(char, toolCards, toolReacts, options);
        return result;
    };
})();
