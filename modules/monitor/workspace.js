/* Independent monitor and desktop-pet workspaces share presentation helpers, not bindings or switches. */
(() => {
    'use strict';
    function createWorkspace(appName) {
        const isPet = appName === 'pet';
        const selectionKey = isPet ? 'bynd_pet_selected_char_v1' : 'bynd_monitor_selected_char_v1';
        const tabKey = isPet ? 'bynd_pet_active_tool_v1' : MONITOR_ACTIVE_TOOL_KEY;
        const tabs = isPet ? [
            { id: 'pet', label: '我的桌宠', icon: 'ri-bear-smile-line' },
            { id: 'library', label: '在线素材', icon: 'ri-compass-3-line' },
            { id: 'phone', label: '屏幕陪看', icon: 'ri-screenshot-2-line' },
            { id: 'island', label: '互动记录', icon: 'ri-chat-smile-2-line' }
        ] : [
            { id: 'internal', label: '监控者', icon: 'ri-eye-line' },
            { id: 'island', label: '弹幕与提醒', icon: 'ri-chat-quote-line' }
        ];
        let activeTab = tabs[0].id;
        try { const saved = localStorage.getItem(tabKey); if (tabs.some(tab => tab.id === saved)) activeTab = saved; } catch (_) {}
        const frequencies = [
            { value: 0, title: '只在点击时', text: '由你决定什么时候看一眼' },
            { value: 60, title: '每 1 分钟', text: '更频繁地参与当下' },
            { value: 120, title: '每 2 分钟', text: '留一些自然的陪伴间隔', recommended: true },
            { value: 300, title: '每 5 分钟', text: '偶尔看看，少一点打扰' },
            { value: 600, title: '每 10 分钟', text: '安静地陪在一旁' }
        ];
        let selectedId = '';
        try { selectedId = localStorage.getItem(selectionKey) || ''; } catch (_) {}
        let watcherQuery = '', watcherFilter = 'all';
        let layer = null, roleQuery = '', activityFilter = 'all', busy = false, libraryOpened = false;
        const scrollPositions = new Map();
        let previousFocus = null, busyFocus = null, screenTimer = null, lastScreenActive = null, renderQueued = false;
        const root = () => document.getElementById(`app-${appName}-window`);
        const escape = value => musicEscapeHtml(String(value ?? ''));
        const attr = value => musicEscapeAttr(String(value ?? ''));
        const icon = name => `<i class="${name}" aria-hidden="true"></i>`;
        const disabled = () => busy ? 'disabled' : '';
        const name = char => char ? getMonitorCharName(char) : '选择角色';
        function character() {
            const chars = getMonitorCharacters();
            return chars.find(char => char.id === selectedId) || (isPet ? getMonitorPetBoundChar() : null) || chars[0] || null;
        }
        function imageSource(value) {
            const source = String(value || '').trim();
            return /^(?:data:image\/|blob:|https?:\/\/|\/(?!\/)|\.\.?\/|assets\/)/i.test(source) ? source : '';
        }
        function avatar(char, extra = '') {
            const source = imageSource(char?.avatar);
            return `<span class="mh-avatar ${extra}" aria-hidden="true"><span>${escape(char ? Array.from(name(char))[0] : '♡')}</span>${source ? `<img src="${attr(source)}" alt="">` : ''}</span>`;
        }
        function chooseButton(char, action = 'roles') {
            return `<button type="button" class="mh-character-picker" data-mh-action="${action}" aria-label="${action === 'screen-role' ? '桌宠互动角色' : '制作桌宠的角色'}：${attr(char ? name(char) : '未选择')}">${avatar(char)}<span>${escape(char ? name(char) : action === 'screen-role' ? '绑定互动角色' : '选择角色')}</span>${icon('ri-arrow-down-s-line')}</button>`;
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
            const stock = imageSource(getMonitorPetDisplayImage(saved));
            const source = custom || stock;
            if (source) return renderMonitorPetMedia(custom ? { posterDataUrl: custom, displayName: material?.displayName || name(char) } : saved, 'mh-pet-art', char?.id || 'pet');
            return `<div class="mh-portrait-art">${avatar(char, 'mh-portrait')}<span class="mh-orbit mh-orbit-one" aria-hidden="true">✦</span><span class="mh-orbit mh-orbit-two" aria-hidden="true">✧</span><span class="mh-orbit-dot" aria-hidden="true"></span></div>`;
        }
        function stage(char) {
            const material = char && window.ByndCharacterPet?.material(char);
            const saved = getMonitorPetLibrary().find(pet => pet.id === getActiveMonitorPetId());
            const hasPet = !!(material || saved);
            const displayed = hasPet && isMonitorPetEnabled();
            return `<section class="mh-stage mh-stage-pet" aria-label="当前桌宠">
                <div class="mh-stage-top">${chooseButton(char, 'screen-role')}${badge(displayed ? '显示中' : hasPet ? '已暂停' : '等待小伙伴', displayed ? 'is-on' : '')}</div>
                <div class="mh-scene"><span class="mh-scene-word" aria-hidden="true">hello, friend</span>${petVisual(char)}</div>
                <div class="mh-stage-bottom"><div><span>${material ? '角色专属 · ' + escape(window.ByndCharacterPet?.visual(char)?.label || '待机') : saved ? '社区桌宠' : '从喜欢的形象开始'}</span><strong>${escape(material?.displayName || saved?.displayName || '挑选你的第一只桌宠')}</strong></div>
                    <button type="button" class="mh-round-button" data-mh-tab="library" aria-label="挑选在线桌宠">${icon('ri-add-line')}</button>
                </div>
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
                if (isPet) {
                    const pet = char.chatConfig?.monitorPetState;
                    if (pet?.bubbleText && pet.bubbleAt) records.push({ id: `${char.id}:pet`, char, text: String(pet.bubbleText), kind: 'pet', at: timestamp(pet.bubbleAt) });
                    continue;
                }
                const history = Array.isArray(char.history) ? char.history : [];
                history.forEach((message, index) => {
                    if (!message?.monitorEvent || !message.content) return;
                    records.push({ id: `${char.id}:history:${index}`, char, text: String(message.content).replace(/^【旁观吐槽[^】]*】/, ''), kind: message.monitorLevel || 'island', at: timestamp(message.timestamp) });
                });
                const state = char.chatConfig?.monitorState || {};
                if (Array.isArray(state.lastBarrage) && state.lastBarrage.length) records.push({ id: `${char.id}:barrage`, char, text: state.lastBarrage.map(String).join('\n'), kind: 'barrage', at: timestamp(state.lastAt) });
                if (state.lastError) records.push({ id: `${char.id}:error`, char, text: String(state.lastError), kind: 'error', at: timestamp(state.lastAt) });
            }
            return records.sort((a, b) => b.at - a.at).slice(0, 60);
        }
        function timeLabel(at) {
            if (!at) return '时间未记录';
            const date = new Date(at);
            const clock = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
            return date.toDateString() === new Date().toDateString() ? `今天 ${clock}` : `${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
        }
        const kindLabels = { island: '轻提醒', warning: '特别提醒', barrage: '弹幕', pet: '桌宠互动', silent: '暂不回应', error: '待处理' };
        function activityCard(item, compact = false) {
            return `<article class="mh-activity ${item.kind === 'error' ? 'is-error' : ''}">${avatar(item.char)}<div class="mh-activity-body"><div class="mh-activity-meta"><strong>${escape(name(item.char))}</strong><time>${escape(timeLabel(item.at))}</time></div><span class="mh-kind">${escape(kindLabels[item.kind] || '陪伴动态')}</span>${compact ? `<p class="mh-clamp">${escape(item.text)}</p>` : `<p>${escape(item.text)}</p>`}</div></article>`;
        }
        function empty(title, text, action = '') {
            return `<div class="mh-empty"><div class="mh-empty-art" aria-hidden="true">${icon('ri-chat-smile-2-line')}<span>✦</span></div><h2>${title}</h2><p>${text}</p>${action}</div>`;
        }
        function watcherControls(char) {
            const mode = getMonitorMode(char), speed = normalizeMonitorBarrageSpeed(char.chatConfig?.monitorBarrageSpeed);
            return `<div class="mh-watcher-modes" role="group" aria-label="${attr(name(char))}的监控视角">${[['persona','ri-user-heart-line','角色本人'],['observer','ri-chat-smile-3-line','第三方吐槽']].map(([value,i,label]) => `<button type="button" data-mh-mode="${value}" data-mh-char="${attr(char.id)}" aria-pressed="${mode === value}" ${disabled()}>${icon(i)}${label}</button>`).join('')}</div>
                <label class="mh-speed"><span><strong>弹幕速度</strong><b>${escape(getMonitorSpeedText(speed))}</b></span><input type="range" min="0.7" max="1.6" step="0.1" value="${speed}" data-mh-speed="${attr(char.id)}" aria-label="${attr(name(char))}的弹幕速度" aria-valuetext="${attr(getMonitorSpeedText(speed))}" ${disabled()}><small>慢一点<span>快一点</span></small></label>`;
        }
        function watcherCard(char) {
            const enabled = !!char.chatConfig?.monitorEnabled, state = char.chatConfig?.monitorState || {};
            return `<article class="mh-watcher-card ${enabled ? 'is-connected' : ''}" data-mh-watcher="${attr(char.id)}">
                <div class="mh-watcher-heading">${avatar(char)}<div><h3>${escape(name(char))}</h3>${badge(enabled ? '已接入' : '待命', enabled ? 'is-on' : '')}</div><button type="button" class="mh-connect ${enabled ? 'is-on' : ''}" data-mh-action="toggle-watcher" data-mh-char="${attr(char.id)}" aria-label="${enabled ? '解除' : '接入'} ${attr(name(char))} 的监控" ${disabled()}>${icon(enabled ? 'ri-link-unlink-m' : 'ri-link-m')}${enabled ? '解除' : '接入'}</button></div>
                <p class="mh-watcher-summary">${escape(getMonitorRecentSummary(char))}</p>
                ${watcherControls(char)}
                <div class="mh-watcher-runtime"><span>${state.lastLevel ? '上次反应 · ' + escape(kindLabels[state.lastLevel] || state.lastLevel) : '等待下一条聊天消息'}</span>${state.lastAt ? `<time>${escape(timeLabel(timestamp(state.lastAt)))}</time>` : ''}</div>
                ${state.lastError ? `<div class="mh-error-note"><strong>最近一次请求未完成</strong><p>${escape(state.lastError)}</p></div>` : ''}
                <div class="mh-watcher-actions"><button type="button" class="mh-text-button" data-mh-action="chat" data-mh-char="${attr(char.id)}">${icon('ri-chat-3-line')}打开聊天</button><button type="button" class="mh-text-button" data-mh-action="refresh-watcher" data-mh-char="${attr(char.id)}" aria-label="更新 ${attr(name(char))} 的监控状态">${icon('ri-refresh-line')}更新状态</button></div>
            </article>`;
        }
        function watcherCards() {
            const query = watcherQuery.trim().toLocaleLowerCase();
            return getMonitorCharacters().filter(char => (watcherFilter !== 'enabled' || char.chatConfig?.monitorEnabled) && [name(char), char.name].some(value => String(value || '').toLocaleLowerCase().includes(query))).map(watcherCard).join('') || empty('没有符合条件的角色', '试试其他名字，或切换到全部角色。');
        }
        function homeView() {
            const chars = getMonitorCharacters(), stats = getMonitorStats(chars), latest = activity()[0];
            return `${heading('聊天，多一个视角。', '选择监控者，让角色参与剧情、发弹幕和提醒。')}
                <div class="mh-monitor-stats" aria-label="监控运行状态"><div><span>接入角色</span><strong>${stats.enabled}<small> / ${stats.total}</small></strong></div><div><span>本人 / 第三方</span><strong>${stats.persona}<small> / ${stats.observer}</small></strong></div><div class="${stats.errors ? 'has-error' : ''}"><span>待处理</span><strong>${stats.errors}<small> 条</small></strong></div></div>
                <section class="mh-monitor-live"><div><span class="mh-eyebrow">${icon('ri-chat-quote-line')}弹幕与提醒</span><h2>${latest ? '最近的一次反应' : '留意聊天里的小变化'}</h2><p>${latest ? escape(name(latest.char)) + '：' + escape(latest.text) : '角色会根据剧情和人设选择回应方式。'}</p></div><button type="button" class="mh-round-button" data-mh-tab="island" aria-label="查看弹幕与提醒">${icon('ri-arrow-right-line')}</button></section>
                <section class="mh-watchers"><div class="mh-section-heading"><h2>监控者</h2><button type="button" class="mh-text-button" data-mh-action="refresh">${icon('ri-refresh-line')}刷新状态</button></div>
                    <div class="mh-watcher-toolbar"><label class="mh-search">${icon('ri-search-line')}<input id="${appName}-watcher-search" type="search" aria-label="搜索监控者" placeholder="搜索角色" value="${attr(watcherQuery)}"></label><div class="mh-segmented" aria-label="监控者筛选">${[['all','全部'],['enabled','已接入']].map(([value,label]) => `<button type="button" data-mh-watch-filter="${value}" aria-pressed="${watcherFilter === value}">${label}</button>`).join('')}</div></div>
                    <div class="mh-watcher-grid" data-mh-watchers>${chars.length ? watcherCards() : empty('还没有角色', '先到微信添加角色，再选择谁来参与监控。', '<button type="button" class="mh-secondary" data-mh-action="contacts">添加角色</button>')}</div>
                </section>
                <details class="mh-about"><summary>监控怎样参与聊天？${icon('ri-arrow-down-s-line')}</summary><p>接入后，角色会旁观 BYND 内其他聊天。本人视角遵循角色人设与关系，第三方视角用于旁观吐槽。反应可能是顶部轻提醒、滚动弹幕或特别提醒，也可能保持安静。多个角色沿用各自的视角和弹幕速度。</p></details>`;
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
                    ${!bound || !isMonitorPetEnabled() ? `<p class="mh-inline-note">${!bound ? '绑定桌宠角色后，TA 才会回应画面。' : '桌宠已关闭。开启桌宠后，TA 才会回应画面。'}</p>` : ''}
                    <div class="mh-privacy-note">${icon('ri-shield-check-line')}<p>共享画面会发送给你配置的模型，用于角色回应。停止后不再读取；麦克风不会开启。</p></div>
                </div></div>`;
        }
        function libraryView() {
            return `${heading('遇见下一只小伙伴。', '先预览，喜欢就导入并使用。')}
                <div class="mh-library-intro"><span>${icon('ri-compass-3-line')}codex-pets 社区素材</span><a href="${MONITOR_PET_ORIGIN}" target="_blank" rel="noopener noreferrer">访问网站${icon('ri-external-link-line')}</a></div>
                ${renderMonitorPetLibrary(true)}`;
        }
        function petView() {
            const char = character();
            const config = char && window.ByndCharacterPet?.profile(char);
            const states = (config?.states || []).filter(item => item.enabled && item.assetKey);
            const bound = getMonitorPetBoundChar();
            const enabled = isMonitorPetEnabled();
            const saved = getMonitorPetLibrary();
            return `${heading('小小一只，陪在身边。', '挑选社区桌宠，或制作角色的专属形象。')}
                <div class="mh-pet-layout"><div>${stage(bound)}<div class="mh-pet-toggle-row"><span><strong>显示桌宠</strong><small>${bound ? `互动角色 · ${escape(name(bound))}` : '可直接展示，绑定角色后还能对话'}</small></span><button type="button" class="mh-switch" role="switch" aria-label="显示桌宠" aria-checked="${enabled}" data-mh-action="toggle-pet"><span></span></button></div>
                    <button type="button" class="mh-browse-entry" data-mh-tab="library">${icon('ri-compass-3-line')}逛逛在线素材${icon('ri-arrow-right-line')}</button></div>
                    <div class="mh-pet-tools"><div class="mh-section-heading"><h2>角色工作室</h2>${chooseButton(char)}</div>
                        <button type="button" class="mh-studio-entry" data-mh-action="studio">${icon('ri-magic-line')}<span><strong>${config?.baseKey ? '编辑角色桌宠' : '制作角色桌宠'}</strong><small>上传角色图，生成形象、姿势与表情</small></span>${icon('ri-arrow-right-s-line')}</button>
                        <div class="mh-state-strip">${states.length ? states.map(item => { const asset = window.ByndCharacterPet.cached(item.assetKey); const source = imageSource(asset?.posterUrl || asset?.url); return `<div class="mh-state-tile">${source ? `<img src="${attr(source)}" alt="${attr(item.label)}">` : icon('ri-emotion-line')}<span>${escape(item.label)}</span></div>`; }).join('') : '<div class="mh-state-empty">' + icon('ri-emotion-line') + '<span>从基础形象开始，慢慢添上坐姿、动作和表情。</span></div>'}</div>
                        <button type="button" class="mh-history-link" id="mh-pet-history" data-mh-action="history" ${!char ? 'disabled' : ''}>${icon('ri-history-line')}生成历史<span>PNG / GIF</span>${icon('ri-arrow-right-s-line')}</button>
                        <p class="mh-caption">动作沿用已确认素材，互动遵循角色人设。</p></div></div>
                <section class="mh-saved-pets"><div class="mh-section-heading"><h2>已导入桌宠</h2><span>${saved.length} 只小伙伴</span></div>
                    ${saved.length ? renderMonitorPetLibrary(false) : '<div class="mh-saved-empty"><span>' + icon('ri-bear-smile-line') + '</span><div><strong>收藏喜欢的小伙伴</strong><p>在线素材可直接使用，随时回来切换。</p></div><button type="button" class="mh-text-button" data-mh-tab="library">去挑选' + icon('ri-arrow-right-s-line') + '</button></div>'}
                </section>${!saved.length ? `<p class="mh-inline-note" data-mh-pet-status role="status">${escape(monitorPetStatus)}</p>` : ''}`;
        }
        function activityView() {
            const records = activity();
            const filtered = isPet ? records : records.filter(item => activityFilter === 'all' || (activityFilter === 'barrage' ? item.kind === 'barrage' : ['island', 'warning', 'error'].includes(item.kind)));
            return `${heading(isPet ? '互动的小瞬间。' : '弹幕与提醒', isPet ? '查看各角色最近一次桌宠互动。' : '查看监控角色对聊天剧情的反应。', '<button type="button" class="mh-icon-button" data-mh-action="refresh" aria-label="刷新记录">' + icon('ri-refresh-line') + '</button>')}
                ${isPet ? '' : `<div class="mh-notice-types"><span>${icon('ri-notification-3-line')}灵动岛轻提醒</span><span>${icon('ri-chat-quote-line')}聊天弹幕</span><span>${icon('ri-alarm-warning-line')}特别提醒</span></div><div class="mh-segmented" aria-label="动态筛选">${[['all','全部'],['notice','提醒'],['barrage','弹幕']].map(([value,label]) => `<button type="button" data-mh-filter="${value}" aria-pressed="${activityFilter === value}">${label}</button>`).join('')}</div>`}
                <div class="mh-activity-list">${filtered.map(item => activityCard(item)).join('') || empty('还没有这类记录', isPet ? '点击桌宠或和绑定角色聊天，互动后会显示在这里。' : '接入角色后，新的监控反应会显示在这里。', `<button type="button" class="mh-secondary" data-mh-tab="${isPet ? 'pet' : 'internal'}">${isPet ? '查看桌宠' : '管理监控者'}</button>`)}</div>
                <details class="mh-about"><summary>这些记录从哪里来？${icon('ri-arrow-down-s-line')}</summary><p>${isPet ? '这里显示各角色最近一次桌宠气泡，生成图与动作保存在桌宠图片历史中。' : '这里汇总已有的监控聊天记录、最近一次弹幕与请求异常。轻提醒显示在顶部，弹幕显示在聊天页，特别提醒会打开对应提示。'}刷新只更新显示，不会重新生成回应。</p></details>`;
        }
        function focusToken(element) {
            if (!element || !root()?.contains(element)) return null;
            if (element.id) return '#' + CSS.escape(element.id);
            if (element.dataset.monitorPetOperation) return `[data-monitor-pet-operation="${CSS.escape(element.dataset.monitorPetOperation)}"][data-monitor-pet-id="${CSS.escape(element.dataset.monitorPetId)}"]`;
            for (const key of ['data-mh-speed','data-mh-watch-filter','data-mh-role','data-mh-settings','data-mh-tab','data-mh-interval','data-mh-mode','data-mh-library','data-mh-filter','data-mh-action']) {
                if (element.hasAttribute(key)) return `${element.closest('.mh-sheet') ? '.mh-layer-host ' : ''}[${key}="${CSS.escape(element.getAttribute(key))}"]${element.dataset.mhChar ? `[data-mh-char="${CSS.escape(element.dataset.mhChar)}"]` : ''}`;
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
            if (!host || host.classList.contains('hidden') || !host.querySelector('.mh-shell')) return;
            if (!tabs.some(tab => tab.id === activeTab)) activeTab = tabs[0].id;
            bind(host);
            const focused = document.activeElement;
            const token = focusToken(focused), position = focused?.selectionStart;
            const content = host.querySelector('.mh-content'), scroll = content.scrollTop;
            const panel = host.querySelector('.mh-view');
            // Reuse the same image node when only a control changed, preserving a GIF loop.
            const pictures = new Map(Array.from(panel.querySelectorAll('[data-mh-visual]')).map(img => [img.dataset.mhVisual + ':' + img.dataset.mediaSource, img]));
            const stats = getMonitorStats(getMonitorCharacters());
            host.querySelector('.mh-overview').innerHTML = `<span class="mh-presence ${(isPet ? isMonitorPetEnabled() : stats.enabled) ? 'is-on' : ''}"><span aria-hidden="true"></span>${isPet ? (isMonitorPetEnabled() ? '已开启' : '已关闭') : `${stats.enabled} 位接入`}</span>`;
            host.querySelector('.mh-nav').innerHTML = tabs.map(tab => `<button type="button" id="${appName}-tab-${tab.id}" role="tab" aria-selected="${activeTab === tab.id}" aria-controls="${appName}-tool-panel" tabindex="${activeTab === tab.id ? 0 : -1}" data-mh-tab="${tab.id}">${icon(tab.icon)}<span>${tab.label}</span>${tab.id === 'phone' && isMonitorScreenSharingActive() ? '<b class="mh-nav-dot" aria-label="正在共享"></b>' : ''}</button>`).join('');
            panel.dataset.tool = activeTab;
            panel.setAttribute('aria-labelledby', appName + '-tab-' + activeTab);
            panel.innerHTML = activeTab === 'phone' ? screenView() : activeTab === 'library' ? libraryView() : activeTab === 'pet' ? petView() : activeTab === 'island' ? activityView() : homeView();
            for (const img of panel.querySelectorAll('[data-mh-visual]')) {
                const previous = pictures.get(img.dataset.mhVisual + ':' + img.dataset.mediaSource);
                if (previous) img.replaceWith(previous);
            }
            content.scrollTo({ top: scroll, behavior: 'instant' });
            const floating = document.querySelector('.phone-container > .monitor-pet-floating');
            if (floating && !monitorPetDragState) applyMonitorPetFloatPosition(floating.parentElement, floating, readMonitorPetFloatPosition());
            if (layer) renderLayer();
            restoreFocus(token, position);
            if (isPet) {
                watchScreen();
                host.querySelectorAll('[data-mh-action="roles"], [data-mh-action="screen-role"], [data-mh-action="toggle-pet"], [data-mh-action="studio"], [data-mh-action="unbind-pet"]').forEach(button => { button.disabled = !!monitorPetLibraryAction; });
                if (activeTab === 'library' && !libraryOpened) {
                    libraryOpened = true;
                    if (!monitorPetResults.length && !monitorPetLoading) searchMonitorPets(monitorPetQuery, monitorPetPage);
                }
            }
        }
        function queueRender() {
            if (renderQueued || !root()?.classList.contains('active')) return;
            renderQueued = true;
            requestAnimationFrame(() => { renderQueued = false; render(); });
        }
        function roleRows() {
            const chosenId = isPet && layer?.purpose === 'binding' ? getMonitorPetBoundChar()?.id : character()?.id;
            const query = roleQuery.trim().toLocaleLowerCase();
            const chars = getMonitorCharacters().filter(char => [name(char), char.name].some(value => String(value || '').toLocaleLowerCase().includes(query)));
            return chars.map(char => `<div class="mh-role-row ${chosenId === char.id ? 'is-selected' : ''}"><button type="button" class="mh-role-choice" data-mh-role="${attr(char.id)}" aria-pressed="${chosenId === char.id}">${avatar(char)}<span><strong>${escape(name(char))}</strong><small>${isPet ? (getMonitorPetBoundChar()?.id === char.id ? '当前绑定桌宠' : layer?.purpose === 'binding' ? '使用 TA 的人设与关系互动' : '制作或编辑专属桌宠') : (char.chatConfig?.monitorEnabled ? '已接入监控' : '待命')}</small></span>${chosenId === char.id ? icon('ri-check-line') : ''}</button>${isPet ? '' : `<button type="button" class="mh-icon-button" data-mh-settings="${attr(char.id)}" aria-label="设置 ${attr(name(char))}">${icon('ri-equalizer-line')}</button>`}</div>`).join('') || '<p class="mh-quiet-empty">没有找到角色，换个名字试试。</p>';
        }
        function settingsBody(char) {
            if (!char) return empty('还没有角色', '先到微信添加一位角色，再来接入监控。');
            return `<div class="mh-role-profile">${avatar(char)}<div><h3>${escape(name(char))}</h3><p>${char.chatConfig?.monitorEnabled ? '已接入监控' : '待命'}</p></div><button type="button" class="mh-switch" role="switch" aria-label="接入角色监控" aria-checked="${!!char.chatConfig?.monitorEnabled}" data-mh-action="toggle-watcher" data-mh-char="${attr(char.id)}" ${disabled()}><span></span></button></div>
                <p class="mh-sheet-intro">本人视角根据人设和关系回应；第三方视角以旁观者身份吐槽剧情。</p>${watcherControls(char)}
                <p class="mh-watcher-summary">${escape(getMonitorRecentSummary(char))}</p>
                ${char.chatConfig?.monitorState?.lastError ? `<div class="mh-error-note"><strong>最近一次请求未完成</strong><p>${escape(char.chatConfig.monitorState.lastError)}</p></div>` : ''}`;
        }
        function renderLayer() {
            const host = root()?.querySelector('.mh-layer-host');
            if (!host || !layer) return;
            const scroll = host.querySelector('.mh-sheet-body')?.scrollTop || 0;
            let title = '', body = '', footer = '';
            if (layer.type === 'roles') {
                title = isPet ? (layer.purpose === 'binding' ? '绑定互动角色' : '选择制作角色') : '监控角色设置';
                body = `<p class="mh-sheet-intro">${isPet ? (layer.purpose === 'binding' ? '桌宠会按这位角色的人设互动，不影响监控中的角色。' : '选择要制作或编辑桌宠的角色。') : '点击角色或右侧设置，管理接入状态、视角和弹幕速度。'}</p><label class="mh-search">${icon('ri-search-line')}<input id="${appName}-role-search" type="search" aria-label="搜索角色" placeholder="搜索角色名字" value="${attr(roleQuery)}"></label><div class="mh-role-list">${getMonitorCharacters().length ? roleRows() : empty('还没有角色', isPet ? '社区桌宠可直接使用；添加角色后还能按人设对话。' : '先到微信添加需要参与监控的角色。')}</div>${isPet && layer.purpose === 'binding' && getMonitorPetBoundChar() ? '<button type="button" class="mh-add-role" data-mh-action="unbind-pet">暂不绑定，只展示桌宠</button>' : ''}<button type="button" class="mh-add-role" data-mh-action="contacts">${icon('ri-user-add-line')}前往微信添加角色${icon('ri-arrow-right-s-line')}</button>`;
            } else if (layer.type === 'frequency') {
                title = '多久看一眼';
                const value = Math.round(getMonitorPetAutoObserveIntervalMs() / 1000);
                body = `<p class="mh-sheet-intro">共享开启后，按这个频率观察并回应。频率越高，模型调用越多。</p><div class="mh-frequency-options" role="radiogroup" aria-label="屏幕观察频率">${frequencies.map(item => `<button type="button" role="radio" aria-checked="${value === item.value}" data-mh-interval="${item.value}"><span><strong>${item.title}${item.recommended ? '<em>推荐</em>' : ''}</strong><small>${item.text}</small></span>${icon(value === item.value ? 'ri-radio-button-line' : 'ri-checkbox-blank-circle-line')}</button>`).join('')}</div>`;
            } else if (layer.type === 'pet-preview') {
                const saved = getMonitorPetLibrary().find(item => item.id === layer.charId);
                const pet = saved || monitorPetResults.find(item => item.id === layer.charId);
                title = pet?.displayName || '素材预览';
                body = `<div class="mh-asset-preview">${renderMonitorPetMedia(pet)}</div><p class="mh-asset-description">${escape(pet?.description || '暂无素材介绍')}</p><p class="mh-library-source">${escape(pet?.ownerName ? `创作者：${pet.ownerName}` : '社区桌宠素材')}</p>`;
                footer = `${pet ? `<div class="mh-preview-actions">${renderMonitorPetUseButton(pet, !!saved)}${!saved ? `<button type="button" class="mh-secondary" data-monitor-pet-id="${attr(pet.id)}" data-monitor-pet-operation="download" onclick="downloadMonitorPet(this.dataset.monitorPetId, this)" ${monitorPetLibraryAction ? 'disabled' : ''}>仅导入，稍后使用</button>` : ''}</div>` : ''}<p class="mh-inline-note" data-mh-pet-status role="status">${escape(monitorPetStatus)}</p>`;
            } else {
                title = '监控设置';
                body = settingsBody(getMonitorCharacters().find(char => char.id === layer.charId));
            }
            host.innerHTML = `<div class="mh-layer"><section class="mh-sheet" role="dialog" aria-modal="true" aria-labelledby="${appName}-sheet-title"><div class="mh-sheet-handle" aria-hidden="true"></div><header class="mh-sheet-heading">${layer.type === 'settings' ? '<button type="button" class="mh-icon-button" data-mh-action="roles" aria-label="返回角色列表">' + icon('ri-arrow-left-s-line') + '</button>' : ''}<h2 id="${appName}-sheet-title">${escape(title)}</h2><button type="button" id="${appName}-sheet-close" class="mh-icon-button" data-mh-action="close-layer" aria-label="关闭面板">${icon('ri-close-line')}</button></header><div class="mh-sheet-body">${body}</div>${footer ? `<footer class="mh-sheet-footer">${footer}</footer>` : ''}</section></div>`;
            host.querySelector('.mh-sheet-body').scrollTop = scroll;
            root().querySelector('.mh-shell').inert = true;
        }
        function openLayer(type, charId = '', purpose = 'view') {
            if (!layer) previousFocus = focusToken(document.activeElement);
            if (type === 'roles') roleQuery = '';
            layer = { type, charId, purpose };
            renderLayer();
            root().querySelector('[data-mh-action="close-layer"]')?.focus({ preventScroll: true });
        }
        function closeLayer(restore = true) {
            layer = null;
            const host = root();
            if (!host) return;
            host.querySelector('.mh-layer-host').replaceChildren();
            host.querySelector('.mh-shell').inert = false;
            if (restore) restoreFocus(previousFocus || '#' + appName + '-tab-' + activeTab);
            previousFocus = null;
        }
        function activeChar(button) {
            if (button?.dataset.mhChar) return getMonitorCharacters().find(char => char.id === button.dataset.mhChar);
            return layer?.type === 'settings' ? getMonitorCharacters().find(char => char.id === layer.charId) : character();
        }
        function notifyError(error) {
            const message = error?.message || '操作未完成，请重试。';
            if (typeof showWechatToast === 'function') showWechatToast(message);
        }
        async function act(button) {
            if (button.disabled) return;
            const char = activeChar(button);
            if (button.dataset.mhTab) { navigate(button.dataset.mhTab); return; }
            if (button.dataset.mhRole) {
                const chosen = getMonitorCharacters().find(item => item.id === button.dataset.mhRole);
                if (!chosen) return;
                if (layer?.purpose === 'binding') {
                    setMonitorPetBoundChar(chosen.id);
                }
                try { localStorage.setItem(selectionKey, button.dataset.mhRole); } catch (_) {}
                selectedId = button.dataset.mhRole;
                closeLayer(false); render();
                if (!isPet) { openLayer('settings', chosen.id); return; }
                if (getMonitorPetBoundChar()?.id === chosen.id) syncMonitorPetFloating();
                (root()?.querySelector('.mh-character-picker') || root()?.querySelector('[data-mh-action="screen-role"]'))?.focus({ preventScroll: true });
                return;
            }
            if (button.dataset.mhSettings) { openLayer('settings', button.dataset.mhSettings); return; }
            if (button.dataset.mhMode) { if (char) await setMonitorWatcherMode(char.id, button.dataset.mhMode); return; }
            if (button.dataset.mhInterval != null) { if (setMonitorPetObserveInterval(button.dataset.mhInterval)) closeLayer(); return; }
            if (button.dataset.mhFilter) { activityFilter = button.dataset.mhFilter; render(); return; }
            if (button.dataset.mhWatchFilter) { watcherFilter = button.dataset.mhWatchFilter; render(); return; }
            switch (button.dataset.mhAction) {
                case 'back': closeLayer(false); closeApp(appName); break;
                case 'roles': openLayer('roles'); break;
                case 'screen-role': openLayer('roles', '', 'binding'); break;
                case 'settings': openLayer(char ? 'settings' : 'roles', char?.id); break;
                case 'close-layer': closeLayer(); break;
                case 'toggle-watcher': if (char) await toggleMonitorWatcher(char.id); break;
                case 'toggle-pet': setMonitorPetEnabled(!isMonitorPetEnabled()); break;
                case 'bind-pet': if (char) { setMonitorPetBoundChar(char.id); syncMonitorPetFloating(); render(); showWechatToast('已绑定桌宠角色：' + name(char)); } break;
                case 'chat': if (char) { closeLayer(false); closeApp(appName); openApp('wechat'); openChat(char.id); } break;
                case 'contacts': closeLayer(false); closeApp(appName); openApp('wechat'); break;
                case 'studio': closeLayer(false); await openMonitorPetStudio(char?.id || ''); break;
                case 'history': if (char) await window.ByndPetHistory?.open(char, { host: root(), panel: root().querySelector('.mh-shell'), focusTarget: button, returnLabel: '返回我的桌宠' }); break;
                case 'library': navigate('library'); break;
                case 'pet-home': navigate('pet'); break;
                case 'unbind-pet': setMonitorPetBoundChar(''); closeLayer(); syncMonitorPetFloating(); render(); break;
                case 'start-screen': await startMonitorScreenShare(); render(); break;
                case 'stop-screen': stopMonitorScreenShare(); render(); break;
                case 'capture': { const frame = await captureMonitorScreenFrame(); if (!frame) updateMonitorScreenStatus('画面暂时未准备好，请稍后再试。'); screenChanged(); break; }
                case 'frequency': openLayer('frequency'); break;
                case 'refresh': render(); showWechatToast('已刷新当前状态'); break;
                case 'refresh-watcher': if (char) refreshMonitorWatcher(char.id); break;
                case 'open-pet-screen': closeLayer(false); closeApp(appName); openApp('pet'); window.ByndPetWorkspace?.navigate('phone'); break;
            }
        }
        function keydown(event) {
            const dialog = root()?.querySelector('.mh-sheet');
            if (dialog && event.key === 'Escape') { event.preventDefault(); closeLayer(); return; }
            if (dialog && event.key === 'Tab') {
                const controls = Array.from(dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')).filter(item => item.getClientRects().length);
                if (!controls.length) return;
                if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
                else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
            }
            const nav = event.target.closest('.mh-nav [role="tab"]');
            if (nav && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
                event.preventDefault();
                const index = tabs.findIndex(tab => tab.id === nav.dataset.mhTab);
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                navigate(tabs[next].id);
                document.getElementById(appName + '-tab-' + tabs[next].id)?.focus();
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
                if (event.target.id === appName + '-role-search') { roleQuery = event.target.value; root().querySelector('.mh-role-list').innerHTML = roleRows(); }
                if (event.target.id === appName + '-watcher-search') { watcherQuery = event.target.value; root().querySelector('[data-mh-watchers]').innerHTML = watcherCards(); }
                if (event.target.dataset.mhSpeed) {
                    const label = getMonitorSpeedText(event.target.value);
                    event.target.closest('label').querySelector('b').textContent = label;
                    event.target.setAttribute('aria-valuetext', label);
                }
            });
            host.addEventListener('change', event => {
                if (event.target.dataset.mhSpeed) setMonitorWatcherSpeed(event.target.dataset.mhSpeed, event.target.value).catch(notifyError);
            });
            host.addEventListener('keydown', keydown);
            host.addEventListener('error', event => {
                if (event.target.tagName !== 'IMG') return;
                // Shared pet media owns its fallback chain and visible loading/error state.
                if (event.target.closest('.monitor-pet-media')) return;
                const fallback = event.target.parentElement?.querySelector('.mh-image-fallback');
                if (fallback) fallback.hidden = false;
                event.target.remove();
            }, true);
        }
        function screenChanged() {
            const box = root()?.querySelector('[data-mh-screen-preview]');
            if (box) box.innerHTML = screenPreview();
            const status = root()?.querySelector('#monitor-screen-status');
            if (status) status.textContent = monitorScreenStatus;
        }
        function petChanged() {
            root()?.querySelectorAll('[data-mh-pet-status]').forEach(status => { status.textContent = monitorPetStatus; });
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
        function navigate(tabId) {
            const content = root()?.querySelector('.mh-content');
            if (content) scrollPositions.set(activeTab, content.scrollTop);
            closeLayer(false);
            activeTab = tabs.some(tab => tab.id === tabId) ? tabId : tabs[0].id;
            if (!isPet) monitorActiveTool = activeTab;
            try { localStorage.setItem(tabKey, activeTab); } catch (_) {}
            render();
            if (content) content.scrollTo({ top: scrollPositions.get(activeTab) || 0, behavior: 'instant' });
        }
        const api = {
            render, screenView, screenChanged, petChanged, activity, imageSource,
            previewPet(pet) { if (!root()?.classList.contains('active')) return false; openLayer('pet-preview', pet.id); return true; },
            setBusy(value) {
                if (value) busyFocus = focusToken(document.activeElement);
                busy = !!value;
                if (layer) renderLayer();
                root()?.querySelectorAll('[data-mh-action="toggle-watcher"], [data-mh-mode], [data-mh-speed]').forEach(button => { button.disabled = busy; });
                if (!value) {
                    restoreFocus(busyFocus); busyFocus = null;
                    const sheet = root()?.querySelector('.mh-sheet');
                    if (sheet && !sheet.contains(document.activeElement)) sheet.querySelector('[data-mh-action="close-layer"]')?.focus({ preventScroll: true });
                }
            },
            close() { if (root()?.querySelector('#pet-history')) window.ByndPetHistory?.close(false); closeLayer(false); clearTimeout(screenTimer); screenTimer = null; },
            navigate
        };
        if (isPet) window.addEventListener('bynd:character-pet', queueRender);
        return api;
    }
    window.ByndMonitor = createWorkspace('monitor');
    window.ByndPetWorkspace = createWorkspace('pet');
})();
