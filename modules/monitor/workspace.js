/* BYND companion workspace. Presentation only: opening a view never calls a model. */
(() => {
    'use strict';
    const selectionKey = 'bynd_monitor_selected_char_v1';
    const tabs = [
        { id: 'internal', label: '陪伴', icon: 'ri-heart-3-line' },
        { id: 'phone', label: '屏幕', icon: 'ri-screenshot-2-line' },
        { id: 'pet', label: '桌宠', icon: 'ri-bear-smile-line' },
        { id: 'island', label: '动态', icon: 'ri-chat-smile-2-line' }
    ];
    const frequencies = [
        { value: 0, title: '只在点击时', text: '由你决定什么时候看一眼' },
        { value: 60, title: '每 1 分钟', text: '更频繁地参与当下' },
        { value: 120, title: '每 2 分钟', text: '留一些自然的陪伴间隔', recommended: true },
        { value: 300, title: '每 5 分钟', text: '偶尔看看，少一点打扰' },
        { value: 600, title: '每 10 分钟', text: '安静地陪在一旁' }
    ];
    let selectedId = '';
    try { selectedId = localStorage.getItem(selectionKey) || ''; } catch (_) {}
    let layer = null, roleQuery = '', petPane = 'own', libraryOnline = false, activityFilter = 'all', busy = false;
    let previousFocus = null, busyFocus = null, screenTimer = null, lastScreenActive = null, renderQueued = false;
    const root = () => document.getElementById('app-monitor-window');
    const escape = value => musicEscapeHtml(String(value ?? ''));
    const attr = value => musicEscapeAttr(String(value ?? ''));
    const icon = name => `<i class="${name}" aria-hidden="true"></i>`;
    const disabled = () => busy ? 'disabled' : '';
    const name = char => char ? getMonitorCharName(char) : '选择角色';
    function character() {
        const chars = getMonitorCharacters();
        return chars.find(char => char.id === selectedId) || getMonitorPetBoundChar() || chars[0] || null;
    }
    function imageSource(value) {
        const source = String(value || '').trim();
        return /^(?:data:image\/|blob:|https?:\/\/|\/(?!\/)|\.\.?\/|assets\/)/i.test(source) ? source : '';
    }
    function avatar(char, extra = '') {
        const source = imageSource(char?.avatar);
        return `<span class="mh-avatar ${extra}" aria-hidden="true"><span>${escape(char ? Array.from(name(char))[0] : '♡')}</span>${source ? `<img src="${attr(source)}" alt="">` : ''}</span>`;
    }
    function chooseButton(char) {
        return `<button type="button" class="mh-character-picker" data-mh-action="roles">${avatar(char)}<span>${escape(name(char))}</span>${icon('ri-arrow-down-s-line')}</button>`;
    }
    function badge(text, tone = '') {
        return `<span class="mh-badge ${tone}"><span aria-hidden="true"></span>${escape(text)}</span>`;
    }
    function heading(title, subtitle, action = '') {
        return `<div class="mh-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
    }
    function petVisual(char) {
        const material = char && window.ByndCharacterPet?.material(char);
        const visual = material && window.ByndCharacterPet.visual(char);
        const custom = imageSource(visual?.image || material?.posterDataUrl);
        const saved = getMonitorPetLibrary().find(pet => pet.id === getActiveMonitorPetId());
        const stock = getMonitorPetBoundChar()?.id === char?.id ? imageSource(getMonitorPetDisplayImage(saved)) : '';
        const source = custom || stock;
        if (source) return `<img class="mh-pet-art" data-mh-visual="${attr(char?.id || 'pet')}" src="${attr(source)}" alt="${attr(name(char))}的桌宠">`;
        return `<div class="mh-portrait-art">${avatar(char, 'mh-portrait')}<span class="mh-orbit mh-orbit-one" aria-hidden="true">✦</span><span class="mh-orbit mh-orbit-two" aria-hidden="true">✧</span><span class="mh-orbit-dot" aria-hidden="true"></span></div>`;
    }
    function stage(char, pet = false) {
        const enabled = !!char?.chatConfig?.monitorEnabled;
        const material = char && window.ByndCharacterPet?.material(char);
        const hasPet = !!(material?.posterDataUrl || (getMonitorPetBoundChar()?.id === char?.id && getActiveMonitorPetId()));
        const state = char?.chatConfig?.monitorState;
        return `<section class="mh-stage ${pet ? 'mh-stage-pet' : ''}" aria-label="${pet ? '桌宠预览' : '当前陪伴角色'}">
            <div class="mh-stage-top">${chooseButton(char)}${badge(pet ? (isMonitorPetEnabled() ? '桌宠已开启' : '桌宠已关闭') : enabled ? '陪伴已开启' : '尚未开启', (pet ? isMonitorPetEnabled() : enabled) ? 'is-on' : '')}</div>
            <div class="mh-scene"><span class="mh-scene-word" aria-hidden="true">${pet ? 'little moments' : 'be with you'}</span>${petVisual(char)}</div>
            <div class="mh-stage-bottom"><div><span>${pet ? (hasPet ? '当前形态' : '角色头像预览') : '陪伴视角'}</span><strong>${pet ? (hasPet ? escape(window.ByndCharacterPet?.visual(char)?.label || '待机') : '制作一个专属小伙伴') : char ? (getMonitorMode(char) === 'observer' ? '第三方吐槽' : '角色本人') : '从一位角色开始'}</strong></div>
                <button type="button" class="mh-round-button" data-mh-action="${pet ? 'studio' : 'settings'}" aria-label="${pet ? '制作或编辑桌宠' : '设置陪伴视角'}" ${!char ? 'disabled' : ''}>${icon(pet ? 'ri-magic-line' : 'ri-equalizer-line')}</button>
            </div>
            ${state?.lastError && !pet ? '<span class="mh-stage-warning">有一条待处理提醒</span>' : ''}
        </section>`;
    }
    function timestamp(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    function activity(chars = getMonitorCharacters()) {
        const records = [];
        for (const char of chars) {
            const history = Array.isArray(char.history) ? char.history : [];
            history.forEach((message, index) => {
                if (!message?.monitorEvent || !message.content) return;
                records.push({ id: `${char.id}:history:${index}`, char, text: String(message.content).replace(/^【旁观吐槽[^】]*】/, ''), kind: message.monitorLevel || 'island', at: timestamp(message.timestamp) });
            });
            const state = char.chatConfig?.monitorState || {};
            if (Array.isArray(state.lastBarrage) && state.lastBarrage.length) records.push({ id: `${char.id}:barrage`, char, text: state.lastBarrage.map(String).join('\n'), kind: 'barrage', at: timestamp(state.lastAt) });
            if (state.lastError) records.push({ id: `${char.id}:error`, char, text: String(state.lastError), kind: 'error', at: timestamp(state.lastAt) });
            const pet = char.chatConfig?.monitorPetState;
            if (pet?.bubbleText && pet.bubbleAt) records.push({ id: `${char.id}:pet`, char, text: String(pet.bubbleText), kind: 'pet', at: timestamp(pet.bubbleAt) });
        }
        return records.sort((a, b) => b.at - a.at).slice(0, 60);
    }
    function timeLabel(at) {
        if (!at) return '时间未记录';
        const date = new Date(at);
        const clock = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
        return date.toDateString() === new Date().toDateString() ? `今天 ${clock}` : `${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
    }
    const kindLabels = { island: '轻提醒', warning: '特别提醒', barrage: '弹幕', pet: '桌宠互动', silent: '安静陪伴', error: '待处理' };
    function activityCard(item, compact = false) {
        return `<article class="mh-activity ${item.kind === 'error' ? 'is-error' : ''}">${avatar(item.char)}<div class="mh-activity-body"><div class="mh-activity-meta"><strong>${escape(name(item.char))}</strong><time>${escape(timeLabel(item.at))}</time></div><span class="mh-kind">${escape(kindLabels[item.kind] || '陪伴动态')}</span>${compact ? `<p class="mh-clamp">${escape(item.text)}</p>` : `<p>${escape(item.text)}</p>`}</div></article>`;
    }
    function empty(title, text, action = '') {
        return `<div class="mh-empty"><div class="mh-empty-art" aria-hidden="true">${icon('ri-chat-smile-2-line')}<span>✦</span></div><h2>${title}</h2><p>${text}</p>${action}</div>`;
    }
    function homeView() {
        const char = character();
        const enabled = !!char?.chatConfig?.monitorEnabled;
        const latest = activity()[0];
        return `${heading('陪伴，刚刚好。', '让熟悉的 TA，参与日常的小片刻。')}
            <div class="mh-home-grid"><div class="mh-home-main">${stage(char)}
                <div class="mh-companion-controls"><button type="button" class="mh-primary" data-mh-action="${char ? 'toggle-watcher' : 'roles'}" ${disabled()}>${icon(enabled ? 'ri-pause-line' : 'ri-play-line')}${char ? enabled ? '暂停陪伴' : '开启陪伴' : '选择陪伴角色'}</button><button type="button" class="mh-secondary" data-mh-action="chat" ${!char ? 'disabled' : ''}>${icon('ri-chat-3-line')}和 TA 聊聊</button></div>
                <p class="mh-caption">${enabled ? '已参与 BYND 内聊天，真实屏幕需另外开启。' : '沿用角色人设、世界书与聊天关系。'}</p></div>
                <div class="mh-shortcuts"><button type="button" class="mh-shortcut mh-shortcut-screen" data-mh-tab="phone"><span class="mh-shortcut-icon">${icon('ri-screenshot-2-line')}</span>${icon('ri-arrow-right-up-line')}<strong>一起看屏幕</strong><span>${isMonitorScreenSharingActive() ? '正在共享 · 随时可停止' : '由你开启，随时停止'}</span></button>
                <button type="button" class="mh-shortcut mh-shortcut-pet" data-mh-tab="pet"><span class="mh-shortcut-icon">${icon('ri-bear-smile-line')}</span>${icon('ri-arrow-right-up-line')}<strong>我的小桌宠</strong><span>形态、动作与表情</span></button></div>
                <section class="mh-recent"><div class="mh-section-heading"><h2>最近的陪伴</h2><button type="button" class="mh-text-button" data-mh-tab="island">全部动态 ${icon('ri-arrow-right-s-line')}</button></div>${latest ? activityCard(latest, true) : '<p class="mh-quiet-empty">还没有新动态，下一次互动会留在这里。</p>'}</section></div>`;
    }
    function screenPreview() {
        const active = isMonitorScreenSharingActive();
        const image = active && imageSource(monitorScreenFrameDataUrl);
        return `<div class="mh-screen-top">${badge(active ? '正在共享' : '尚未共享', active ? 'is-on' : '')}<span>${image ? escape(timeLabel(monitorScreenLastCaptureAt)) : '由你掌控'}</span></div>
            ${image ? `<img class="mh-screen-image" src="${attr(image)}" alt="最近一次读取的共享画面"><span class="mh-frame-label">最近读取的画面</span>` : `<div class="mh-screen-placeholder"><div class="mh-screen-illustration" aria-hidden="true"><span></span><span></span><span></span><b>${icon(active ? 'ri-eye-line' : 'ri-lock-2-line')}</b></div><h2>${active ? '已连接你的屏幕' : '一起看看你的世界'}</h2><p>${active ? '点击下方按钮，查看当前共享画面。' : '开始后，TA 才能看见你分享的画面。'}</p></div>`}`;
    }
    function intervalLabel() {
        const seconds = Math.round(getMonitorPetAutoObserveIntervalMs() / 1000);
        return frequencies.find(item => item.value === seconds)?.title || `每 ${seconds} 秒`;
    }
    function screenView() {
        const active = isMonitorScreenSharingActive();
        const bound = getMonitorPetBoundChar();
        return `${heading('屏幕里的同行。', '看见同一刻，也保留自己的节奏。')}
            <div class="mh-screen-layout"><section class="mh-screen-preview" data-mh-screen-preview>${screenPreview()}</section><div class="mh-screen-options">
                <div class="mh-screen-controls">${active ? `<button type="button" class="mh-primary" data-mh-action="capture">${icon('ri-camera-lens-line')}查看当前画面</button><button type="button" class="mh-stop" data-mh-action="stop-screen">${icon('ri-stop-circle-line')}停止共享</button>` : `<button type="button" class="mh-primary" data-mh-action="start-screen">${icon('ri-screenshot-2-line')}开始屏幕陪伴</button>`}</div>
                <p class="mh-screen-status" id="monitor-screen-status" role="status">${escape(monitorScreenStatus)}</p>
                <section class="mh-settings-block"><button type="button" class="mh-setting-row" data-mh-action="screen-role"><span class="mh-setting-icon">${icon('ri-user-heart-line')}</span><span><strong>谁来陪你看</strong><small>${escape(bound ? name(bound) : '还没有绑定角色')}</small></span>${icon('ri-arrow-right-s-line')}</button>
                    <button type="button" class="mh-setting-row" id="monitor-observe-interval" data-mh-action="frequency" aria-haspopup="dialog"><span class="mh-setting-icon">${icon('ri-timer-line')}</span><span><strong>多久看一眼</strong><small>${escape(intervalLabel())}</small></span>${icon('ri-arrow-right-s-line')}</button></section>
                ${!bound || !isMonitorPetEnabled() ? `<p class="mh-inline-note">${!bound ? '选择角色并开启陪伴后，TA 才会回应画面。' : '桌宠已关闭。开启桌宠后，TA 才会回应画面。'}</p>` : ''}
                <div class="mh-privacy-note">${icon('ri-shield-check-line')}<p>共享画面会发送给你配置的模型，用于角色回应。停止后不再读取；麦克风不会开启。</p></div>
            </div></div>`;
    }
    function petView() {
        const char = character();
        if (petPane === 'library') return `${heading('桌宠素材库', '收藏喜欢的小伙伴。', '<button class="mh-icon-button" type="button" data-mh-action="pet-home" aria-label="返回我的桌宠">' + icon('ri-close-line') + '</button>')}<div class="mh-segmented" aria-label="素材来源"><button type="button" data-mh-library="saved" aria-pressed="${!libraryOnline}">已下载</button><button type="button" data-mh-library="online" aria-pressed="${libraryOnline}">在线浏览</button></div>${renderMonitorPetLibrary(libraryOnline)}`;
        const config = char && window.ByndCharacterPet?.profile(char);
        const states = (config?.states || []).filter(item => item.enabled && item.assetKey);
        const bound = getMonitorPetBoundChar();
        const enabled = isMonitorPetEnabled();
        return `${heading('小小一只，属于你。', '同一个角色，也有不同的小表情。')}
            <div class="mh-pet-layout"><div>${stage(char, true)}<div class="mh-pet-toggle-row"><span><strong>显示桌宠</strong><small>${bound ? `当前绑定 ${escape(name(bound))}` : '还没有绑定角色'}</small></span><button type="button" class="mh-switch" role="switch" aria-label="显示桌宠" aria-checked="${enabled}" data-mh-action="toggle-pet"><span></span></button></div>
                ${char && bound?.id !== char.id ? `<button class="mh-bind-button" type="button" data-mh-action="${char.chatConfig?.monitorEnabled || config?.active ? 'bind-pet' : 'settings'}">${char.chatConfig?.monitorEnabled || config?.active ? `使用 ${escape(name(char))} 陪伴` : '先为这位角色开启陪伴'}${icon('ri-arrow-right-line')}</button>` : ''}</div>
                <div class="mh-pet-tools"><div class="mh-section-heading"><h2>形态与表情</h2><span>${states.length} 个已确认动作</span></div><div class="mh-state-strip">${states.length ? states.map(item => { const asset = window.ByndCharacterPet.cached(item.assetKey); const source = imageSource(asset?.posterUrl || asset?.url); return `<div class="mh-state-tile">${source ? `<img src="${attr(source)}" alt="${attr(item.label)}">` : icon('ri-emotion-line')}<span>${escape(item.label)}</span></div>`; }).join('') : '<div class="mh-state-empty">' + icon('ri-emotion-line') + '<span>从基础形象开始，慢慢添上坐姿、动作和表情。</span></div>'}</div>
                    <button type="button" class="mh-studio-entry" data-mh-action="studio">${icon('ri-magic-line')}<span><strong>${config?.baseKey ? '编辑角色桌宠' : '制作角色桌宠'}</strong><small>沿用现有生图设置 · PNG / GIF</small></span>${icon('ri-arrow-right-s-line')}</button>
                    <div class="mh-pet-links"><button type="button" id="mh-pet-history" data-mh-action="history" ${!char ? 'disabled' : ''}>${icon('ri-history-line')}生成历史</button><button type="button" data-mh-action="library">${icon('ri-gallery-line')}素材库</button></div>
                    <p class="mh-caption">动作沿用已确认素材，互动遵循角色人设。</p><p class="mh-inline-note" data-mh-pet-status role="status">${escape(monitorPetStatus)}</p></div></div>`;
    }
    function activityView() {
        const records = activity();
        const filtered = records.filter(item => activityFilter === 'all' || (activityFilter === 'barrage' ? item.kind === 'barrage' : ['island', 'warning', 'error'].includes(item.kind)));
        return `${heading('陪伴留下的小瞬间。', '提醒、弹幕与桌宠互动，都在这里。', '<button type="button" class="mh-icon-button" data-mh-action="refresh" aria-label="刷新动态">' + icon('ri-refresh-line') + '</button>')}
            <div class="mh-segmented" aria-label="动态筛选">${[['all','全部'],['notice','提醒'],['barrage','弹幕']].map(([value,label]) => `<button type="button" data-mh-filter="${value}" aria-pressed="${activityFilter === value}">${label}</button>`).join('')}</div>
            <div class="mh-activity-list">${filtered.map(item => activityCard(item)).join('') || empty('还没有这类动态', '开启角色陪伴后，新的回应会显示在这里。', '<button type="button" class="mh-secondary" data-mh-action="roles">选择陪伴角色</button>')}</div>
            <details class="mh-about"><summary>这些动态从哪里来？${icon('ri-arrow-down-s-line')}</summary><p>角色的轻提醒会出现在顶部，弹幕会随聊天显示。这里汇总已有聊天记录与最近一次弹幕、桌宠气泡；刷新不会重新生成内容。</p></details>`;
    }
    function focusToken(element) {
        if (!element || !root()?.contains(element)) return null;
        if (element.id) return '#' + CSS.escape(element.id);
        if (element.dataset.monitorPetOperation) return `[data-monitor-pet-operation="${CSS.escape(element.dataset.monitorPetOperation)}"][data-monitor-pet-id="${CSS.escape(element.dataset.monitorPetId)}"]`;
        for (const key of ['data-mh-role','data-mh-settings','data-mh-tab','data-mh-interval','data-mh-mode','data-mh-library','data-mh-filter','data-mh-action']) {
            if (element.hasAttribute(key)) return `${element.closest('.mh-sheet') ? '#monitor-layer-host ' : ''}[${key}="${CSS.escape(element.getAttribute(key))}"]`;
        }
        return null;
    }
    function restoreFocus(token, position) {
        const target = token && root()?.querySelector(token);
        if (!target || target.disabled || target.closest('[inert]')) return;
        target.focus({ preventScroll: true });
        if (position != null && target.setSelectionRange && target.type !== 'range') {
            try { target.setSelectionRange(position, position); } catch (_) {}
        }
    }
    function render() {
        const host = root();
        if (!host || !host.querySelector('.mh-shell')) return;
        if (!tabs.some(tab => tab.id === monitorActiveTool)) monitorActiveTool = 'internal';
        bind(host);
        const focused = document.activeElement;
        const token = focusToken(focused), position = focused?.selectionStart;
        const content = host.querySelector('.mh-content'), scroll = content.scrollTop;
        const panel = host.querySelector('#monitor-tool-panel');
        // Reuse the same image node when only a control changed, preserving a GIF loop.
        const pictures = new Map(Array.from(panel.querySelectorAll('[data-mh-visual]')).map(img => [img.dataset.mhVisual + ':' + img.getAttribute('src'), img]));
        const stats = getMonitorStats(getMonitorCharacters());
        host.querySelector('#monitor-overview').innerHTML = `<span class="mh-presence ${stats.enabled ? 'is-on' : ''}"><span aria-hidden="true"></span>${stats.enabled ? `${stats.enabled} 位陪伴` : '待开启'}</span>`;
        host.querySelector('#monitor-toolbar').innerHTML = tabs.map(tab => `<button type="button" id="mh-tab-${tab.id}" role="tab" aria-selected="${monitorActiveTool === tab.id}" aria-controls="monitor-tool-panel" tabindex="${monitorActiveTool === tab.id ? 0 : -1}" data-mh-tab="${tab.id}">${icon(tab.icon)}<span>${tab.label}</span>${tab.id === 'phone' && isMonitorScreenSharingActive() ? '<b class="mh-nav-dot" aria-label="正在共享"></b>' : ''}</button>`).join('');
        panel.dataset.tool = monitorActiveTool;
        panel.setAttribute('aria-labelledby', 'mh-tab-' + monitorActiveTool);
        panel.innerHTML = monitorActiveTool === 'phone' ? screenView() : monitorActiveTool === 'pet' ? petView() : monitorActiveTool === 'island' ? activityView() : homeView();
        for (const img of panel.querySelectorAll('[data-mh-visual]')) {
            const previous = pictures.get(img.dataset.mhVisual + ':' + img.getAttribute('src'));
            if (previous) img.replaceWith(previous);
        }
        content.scrollTop = scroll;
        if (layer) renderLayer();
        restoreFocus(token, position);
        syncMonitorPetFloating();
        watchScreen();
    }
    function queueRender() {
        if (renderQueued || !root()?.classList.contains('active')) return;
        renderQueued = true;
        requestAnimationFrame(() => { renderQueued = false; render(); });
    }
    function roleRows() {
        const query = roleQuery.trim().toLocaleLowerCase();
        const chars = getMonitorCharacters().filter(char => [name(char), char.name].some(value => String(value || '').toLocaleLowerCase().includes(query)));
        return chars.map(char => `<div class="mh-role-row ${character()?.id === char.id ? 'is-selected' : ''}"><button type="button" class="mh-role-choice" data-mh-role="${attr(char.id)}" aria-pressed="${character()?.id === char.id}">${avatar(char)}<span><strong>${escape(name(char))}</strong><small>${char.chatConfig?.monitorEnabled ? '陪伴已开启' : '尚未开启陪伴'}</small></span>${character()?.id === char.id ? icon('ri-check-line') : ''}</button><button type="button" class="mh-icon-button" data-mh-settings="${attr(char.id)}" aria-label="设置 ${attr(name(char))}">${icon('ri-equalizer-line')}</button></div>`).join('') || '<p class="mh-quiet-empty">没有找到角色，换个名字试试。</p>';
    }
    function settingsBody(char) {
        if (!char) return empty('还没有角色', '先到微信添加一位角色，再来开启陪伴。');
        const mode = getMonitorMode(char), speed = normalizeMonitorBarrageSpeed(char.chatConfig?.monitorBarrageSpeed);
        return `<div class="mh-role-profile">${avatar(char)}<div><h3>${escape(name(char))}</h3><p>${char.chatConfig?.monitorEnabled ? '陪伴已开启' : '尚未开启陪伴'}</p></div><button type="button" class="mh-switch" role="switch" aria-label="开启角色陪伴" aria-checked="${!!char.chatConfig?.monitorEnabled}" data-mh-action="toggle-watcher" ${disabled()}><span></span></button></div>
            <div class="mh-sheet-section"><h3>用什么视角陪你</h3><div class="mh-mode-options">${[['persona','ri-user-heart-line','角色本人','根据 TA 的人设和你们的关系回应'],['observer','ri-chat-smile-3-line','第三方吐槽','以旁观者视角看剧情、发弹幕']].map(([value,i,title,copy]) => `<button type="button" data-mh-mode="${value}" aria-pressed="${mode === value}" ${disabled()}>${icon(i)}<span><strong>${title}</strong><small>${copy}</small></span>${icon(mode === value ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line')}</button>`).join('')}</div></div>
            <label class="mh-speed"><span><strong>弹幕速度</strong><b id="mh-speed-label">${escape(getMonitorSpeedText(speed))}</b></span><input id="mh-speed-input" type="range" min="0.7" max="1.6" step="0.1" value="${speed}" aria-label="弹幕速度" aria-valuetext="${attr(getMonitorSpeedText(speed))}" ${disabled()}><small>慢一点<span>快一点</span></small></label>
            ${char.chatConfig?.monitorState?.lastError ? `<div class="mh-error-note"><strong>最近一次请求未完成</strong><p>${escape(char.chatConfig.monitorState.lastError)}</p></div>` : ''}
            <p class="mh-caption">设置只作用于这位角色。屏幕共享需要单独开启。</p>`;
    }
    function renderLayer() {
        const host = root()?.querySelector('#monitor-layer-host');
        if (!host || !layer) return;
        const scroll = host.querySelector('.mh-sheet-body')?.scrollTop || 0;
        let title = '', body = '';
        if (layer.type === 'roles') {
            title = layer.purpose === 'binding' ? '谁来陪你看' : '谁来陪你？';
            body = `<p class="mh-sheet-intro">${layer.purpose === 'binding' ? '选择陪你看屏幕的角色。还没开启陪伴的角色，会先进入设置。' : '选择查看的角色，点右侧设置开启陪伴。'}</p><label class="mh-search">${icon('ri-search-line')}<input id="mh-role-search" type="search" aria-label="搜索陪伴角色" placeholder="搜索角色名字" value="${attr(roleQuery)}"></label><div class="mh-role-list" id="monitor-char-list">${getMonitorCharacters().length ? roleRows() : empty('还没有角色', '先到微信添加你喜欢的角色。')}</div><button type="button" class="mh-add-role" data-mh-action="contacts">${icon('ri-user-add-line')}前往微信添加角色${icon('ri-arrow-right-s-line')}</button>`;
        } else if (layer.type === 'frequency') {
            title = '多久看一眼';
            const value = Math.round(getMonitorPetAutoObserveIntervalMs() / 1000);
            body = `<p class="mh-sheet-intro">共享开启后，按这个频率观察并回应。频率越高，模型调用越多。</p><div class="mh-frequency-options" role="radiogroup" aria-label="屏幕观察频率">${frequencies.map(item => `<button type="button" role="radio" aria-checked="${value === item.value}" data-mh-interval="${item.value}"><span><strong>${item.title}${item.recommended ? '<em>推荐</em>' : ''}</strong><small>${item.text}</small></span>${icon(value === item.value ? 'ri-radio-button-line' : 'ri-checkbox-blank-circle-line')}</button>`).join('')}</div>`;
        } else if (layer.type === 'pet-preview') {
            const pet = monitorPetResults.find(item => item.id === layer.charId) || getMonitorPetLibrary().find(item => item.id === layer.charId);
            const image = imageSource(getMonitorPetDisplayImage(pet));
            title = pet?.displayName || '素材预览';
            body = `<div class="mh-asset-preview"><span class="mh-image-fallback" ${image ? 'hidden' : ''}>图片暂时无法读取</span>${image ? `<img src="${attr(image)}" alt="${attr(title)}">` : ''}</div><p class="mh-asset-description">${escape(pet?.description || '暂无素材介绍')}</p><p class="mh-library-source">${escape(pet?.ownerName ? `创作者：${pet.ownerName}` : '社区桌宠素材')}</p>`;
        } else {
            title = '陪伴设置';
            body = settingsBody(getMonitorCharacters().find(char => char.id === layer.charId));
        }
        host.innerHTML = `<div class="mh-layer"><section class="mh-sheet" role="dialog" aria-modal="true" aria-labelledby="mh-sheet-title"><div class="mh-sheet-handle" aria-hidden="true"></div><header class="mh-sheet-heading">${layer.type === 'settings' ? '<button type="button" class="mh-icon-button" data-mh-action="roles" aria-label="返回角色列表">' + icon('ri-arrow-left-s-line') + '</button>' : ''}<h2 id="mh-sheet-title">${escape(title)}</h2><button type="button" id="mh-sheet-close" class="mh-icon-button" data-mh-action="close-layer" aria-label="关闭面板">${icon('ri-close-line')}</button></header><div class="mh-sheet-body">${body}</div></section></div>`;
        host.querySelector('.mh-sheet-body').scrollTop = scroll;
        root().querySelector('.mh-shell').inert = true;
    }
    function openLayer(type, charId = '', purpose = 'view') {
        if (!layer) previousFocus = focusToken(document.activeElement);
        if (type === 'roles') roleQuery = '';
        layer = { type, charId, purpose };
        renderLayer();
        document.getElementById('mh-sheet-close')?.focus({ preventScroll: true });
    }
    function closeLayer(restore = true) {
        layer = null;
        const host = root();
        if (!host) return;
        host.querySelector('#monitor-layer-host').replaceChildren();
        host.querySelector('.mh-shell').inert = false;
        if (restore) restoreFocus(previousFocus || '#mh-tab-' + monitorActiveTool);
        previousFocus = null;
    }
    function activeChar() {
        return layer?.type === 'settings' ? getMonitorCharacters().find(char => char.id === layer.charId) : character();
    }
    function notifyError(error) {
        const message = error?.message || '操作未完成，请重试。';
        if (typeof showWechatToast === 'function') showWechatToast(message);
    }
    async function act(button) {
        if (button.disabled) return;
        const char = activeChar();
        if (button.dataset.mhTab) { handleMonitorTool(button.dataset.mhTab); return; }
        if (button.dataset.mhRole) {
            const chosen = getMonitorCharacters().find(item => item.id === button.dataset.mhRole);
            if (!chosen) return;
            if (layer?.purpose === 'binding') {
                if (!chosen.chatConfig?.monitorEnabled && !chosen.chatConfig?.characterPet?.active) { openLayer('settings', chosen.id); return; }
                setMonitorPetBoundChar(chosen.id);
            }
            localStorage.setItem(selectionKey, button.dataset.mhRole);
            selectedId = button.dataset.mhRole;
            closeLayer(false); render();
            (root()?.querySelector('.mh-character-picker') || root()?.querySelector('[data-mh-action="screen-role"]'))?.focus({ preventScroll: true });
            return;
        }
        if (button.dataset.mhSettings) { openLayer('settings', button.dataset.mhSettings); return; }
        if (button.dataset.mhMode) { if (char) await setMonitorWatcherMode(char.id, button.dataset.mhMode); return; }
        if (button.dataset.mhInterval != null) { if (setMonitorPetObserveInterval(button.dataset.mhInterval)) closeLayer(); return; }
        if (button.dataset.mhLibrary) {
            libraryOnline = button.dataset.mhLibrary === 'online'; render();
            if (libraryOnline && !monitorPetResults.length && !monitorPetLoading) await searchMonitorPets();
            return;
        }
        if (button.dataset.mhFilter) { activityFilter = button.dataset.mhFilter; render(); return; }
        switch (button.dataset.mhAction) {
            case 'back': closeLayer(false); closeApp('monitor'); break;
            case 'roles': openLayer('roles'); break;
            case 'screen-role': openLayer('roles', '', 'binding'); break;
            case 'settings': openLayer(char ? 'settings' : 'roles', char?.id); break;
            case 'close-layer': closeLayer(); break;
            case 'toggle-watcher': if (char) await toggleMonitorWatcher(char.id); break;
            case 'toggle-pet': setMonitorPetEnabled(!isMonitorPetEnabled()); break;
            case 'bind-pet': if (char) { setMonitorPetBoundChar(char.id); render(); showWechatToast('已切换桌宠陪伴角色'); } break;
            case 'chat': if (char) { closeLayer(false); closeApp('monitor'); openApp('wechat'); openChat(char.id); } break;
            case 'contacts': closeLayer(false); closeApp('monitor'); openApp('wechat'); break;
            case 'studio': closeLayer(false); await openMonitorPetStudio(char?.id || ''); break;
            case 'history': if (char) await window.ByndPetHistory?.open(char, { host: root(), panel: root().querySelector('.mh-shell'), focusTarget: button, returnLabel: '返回我的桌宠' }); break;
            case 'library': petPane = 'library'; libraryOnline = false; render(); root().querySelector('.mh-content').scrollTop = 0; break;
            case 'pet-home': petPane = 'own'; render(); root().querySelector('.mh-content').scrollTop = 0; break;
            case 'start-screen': await startMonitorScreenShare(); render(); break;
            case 'stop-screen': stopMonitorScreenShare(); render(); break;
            case 'capture': { const frame = await captureMonitorScreenFrame(); if (!frame) updateMonitorScreenStatus('画面暂时未准备好，请稍后再试。'); screenChanged(); break; }
            case 'frequency': openLayer('frequency'); break;
            case 'refresh': refreshMonitorApp(); break;
        }
    }
    function keydown(event) {
        const dialog = root()?.querySelector('.mh-sheet');
        if (dialog && event.key === 'Escape') { event.preventDefault(); closeLayer(); return; }
        if (dialog && event.key === 'Tab') {
            const controls = Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')).filter(item => item.getClientRects().length);
            if (!controls.length) return;
            if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
            else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
        }
        const nav = event.target.closest('#monitor-toolbar [role="tab"]');
        if (nav && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
            event.preventDefault();
            const index = tabs.findIndex(tab => tab.id === nav.dataset.mhTab);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            handleMonitorTool(tabs[next].id);
            document.getElementById('mh-tab-' + tabs[next].id)?.focus();
        }
        const radio = event.target.closest('[data-mh-interval]');
        if (radio && ['ArrowDown','ArrowUp'].includes(event.key)) {
            event.preventDefault();
            const options = Array.from(dialog.querySelectorAll('[data-mh-interval]'));
            options[(options.indexOf(radio) + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length].focus();
        }
    }
    function bind(host) {
        if (host.dataset.mhBound) return;
        host.dataset.mhBound = 'true';
        host.addEventListener('click', event => {
            if (event.target.classList.contains('mh-layer')) { closeLayer(); return; }
            const button = event.target.closest('button');
            if (button && host.contains(button)) act(button).catch(notifyError);
        });
        host.addEventListener('input', event => {
            if (event.target.id === 'mh-role-search') { roleQuery = event.target.value; document.getElementById('monitor-char-list').innerHTML = roleRows(); }
            if (event.target.id === 'mh-speed-input') {
                const label = getMonitorSpeedText(event.target.value);
                document.getElementById('mh-speed-label').textContent = label;
                event.target.setAttribute('aria-valuetext', label);
            }
        });
        host.addEventListener('change', event => {
            if (event.target.id === 'mh-speed-input' && activeChar()) setMonitorWatcherSpeed(activeChar().id, event.target.value).catch(notifyError);
        });
        host.addEventListener('keydown', keydown);
        host.addEventListener('error', event => {
            if (event.target.tagName !== 'IMG') return;
            const fallback = event.target.parentElement?.querySelector('.mh-image-fallback');
            if (fallback) fallback.hidden = false;
            event.target.remove();
        }, true);
    }
    function screenChanged() {
        const box = root()?.querySelector('[data-mh-screen-preview]');
        if (box) box.innerHTML = screenPreview();
    }
    function petChanged() {
        const status = root()?.querySelector('[data-mh-pet-status]');
        if (status) status.textContent = monitorPetStatus;
    }
    function watchScreen() {
        lastScreenActive = isMonitorScreenSharingActive();
        if (screenTimer || !root()?.classList.contains('active')) return;
        // Native authorization resolves outside the WebView. Read status only, never frames.
        screenTimer = setTimeout(function check() {
            screenTimer = null;
            if (!root()?.classList.contains('active')) return;
            const active = isMonitorScreenSharingActive();
            if (active !== lastScreenActive) {
                monitorScreenStatus = active ? '已开启屏幕共享，可以随时停止。' : '屏幕共享已停止。';
                if (!active) monitorScreenFrameDataUrl = '';
                render();
            } else watchScreen();
        }, 1000);
    }
    window.ByndMonitor = {
        render, screenView, screenChanged, petChanged, activity, imageSource,
        previewPet(pet) { if (!root()?.classList.contains('active')) return false; openLayer('pet-preview', pet.id); return true; },
        setBusy(value) {
            if (value) busyFocus = focusToken(document.activeElement);
            busy = !!value;
            if (layer) renderLayer();
            else root()?.querySelectorAll('[data-mh-action="toggle-watcher"]').forEach(button => { button.disabled = busy; });
            if (!value) { restoreFocus(busyFocus); busyFocus = null; }
        },
        close() { if (root()?.querySelector('#pet-history')) window.ByndPetHistory?.close(false); closeLayer(false); clearTimeout(screenTimer); screenTimer = null; },
        navigate() { closeLayer(false); petPane = 'own'; const content = root()?.querySelector('.mh-content'); if (content) content.scrollTop = 0; }
    };
    window.addEventListener('bynd:character-pet', queueRender);
})();
