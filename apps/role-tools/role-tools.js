/* 角色台: the desktop workspace for character capabilities and life-state consent. */
(() => {
    'use strict';
    let selectedId = '';
    let writing = false;
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const el = id => document.getElementById(id);
    const life = () => window.ByndLifeState;
    const chars = () => (window.myCharacters || []).filter(char => char?.id && !char.isGroupChat);
    const selected = () => chars().find(char => String(char.id) === selectedId);
    const name = char => window.getWechatCharDisplayName?.(char) || char.name || '角色';
    const status = (text, error = false) => {
        const root = el('role-tools-status');
        if (root) { root.textContent = text; root.classList.toggle('is-error', error); }
    };
    function tab(key) {
        el('app-role-tools-window')?.querySelectorAll('[data-role-panel]').forEach(panel => { panel.hidden = panel.dataset.rolePanel !== key; });
        el('app-role-tools-window')?.querySelectorAll('[data-role-tab]').forEach(button => {
            const active = button.dataset.roleTab === key;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
        });
        const content = el('app-role-tools-window')?.querySelector('.role-tools-content');
        if (content) content.scrollTop = 0;
    }
    function renderLife() {
        const state = life().read();
        el('role-life-panel').innerHTML = `<section class="role-life-control"><label class="role-toggle role-pause-control"><span><strong>暂停所有角色读取</strong><small>保留记录和授权，需要时再恢复</small></span><input type="checkbox" id="role-life-paused" ${state.paused ? 'checked' : ''} onchange="ByndRoleTools.pause(this)"></label></section>
        <section class="role-card role-source-card"><div class="role-section-heading"><span>DATA SOURCES</span><h3>数据来源</h3></div><div class="role-source-grid"><div><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2.5" width="14" height="19" rx="3"/><path d="M9 18h6M10 5.5h4"/></svg><strong>Android / 手表</strong><span>Health Connect · Android 14+ 可读取经期</span></div><div><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l.7 3H8.3L9 3Zm-.7 15h7.4L15 21H9l-.7-3Z"/><rect x="5" y="6" width="14" height="12" rx="4"/><path d="M10 12h4"/></svg><strong>iPhone / Apple Watch</strong><span>Apple 健康 · 原生版本可连接</span></div></div><div id="role-native-health"></div><details><summary>三星 Galaxy Watch 怎么同步？</summary><p>先把手表同步到手机 Samsung Health，在 Samsung Health 设置 → Health Connect → 应用权限中允许 Samsung Health 写入；BYND 还需独立的读取权限。Android 14 及以上原生版可独立授权读取经期日期；其他生活汇总可用手动记录或 JSON 文件导入。月经记录是否导出取决于来源和版本，月伴可独立记录。</p></details><div class="role-actions"><label class="role-file-button">导入汇总 JSON<input type="file" id="role-life-import" accept=".json,application/json" onchange="ByndRoleTools.importFile(this)"></label><button type="button" onclick="ByndRoleTools.template()">下载格式示例</button></div><details><summary>iPhone 快捷指令怎么准备文件？</summary><p>在快捷指令中查找睡眠与步数的健康样本，先按天汇总，再按示例字段生成 JSON 并保存到“文件”。睡眠阶段只累计实际睡着的时间，排除卧床与清醒阶段；有多个设备记录时先去重。这里接收处理后的汇总，不接收 Apple 健康完整 XML 导出。</p></details></section>
        <details class="role-card role-form-card"><summary class="role-expand-summary"><span class="role-expand-symbol" aria-hidden="true">+</span><span><strong>手动记录</strong><small>睡眠、活动与自述感受</small></span></summary><div class="role-expand-body"><p>只填你想记录的项。心情和精力由你自己填写。</p><form id="role-life-form" onsubmit="event.preventDefault();ByndRoleTools.saveRecord()"><div class="role-form-grid"><label>记录日期<input type="date" id="role-life-date" value="${life().localDate()}" max="${life().localDate()}" required></label><label>睡眠时长（分钟）<input id="role-life-sleepMinutes" type="number" min="0" max="1440" step="1" placeholder="例如 420"></label><label>入睡时间<input id="role-life-bedtime" type="datetime-local"></label><label>起床时间<input id="role-life-wakeTime" type="datetime-local"></label><label>夜间醒来（次）<input id="role-life-awakenings" type="number" min="0" max="100" step="1" placeholder="未记录可留空"></label><label>累计步数<input id="role-life-steps" type="number" min="0" max="200000" step="1"></label><label>运动时长（分钟）<input id="role-life-exerciseMinutes" type="number" min="0" max="1440" step="1"></label>${['energy', 'mood'].map(key => `<label>${life().fields[key].label}<select id="role-life-${key}"><option value="">不记录</option>${Object.entries(life().fields[key].choices).map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`).join('')}</div><p>睡眠填醒来那天的日期。更早的记录请通过汇总文件导入，保留当时的汇总时间。</p><button class="role-primary" type="submit">保存生活记录</button></form></div></details>
        <section class="role-card"><div class="role-section-heading"><span>03 / PERSONAL</span><h3>我的睡眠目标</h3></div><p>只用于比较你自己设定的目标，不使用医学诊断阈值。</p><div class="role-actions"><label>小时<input type="number" id="role-life-goal" min="3" max="15" step="0.5" value="${(state.sleepGoal || 480) / 60}"></label><button type="button" onclick="ByndRoleTools.saveGoal()">保存目标</button></div></section>
        <section class="role-card"><div class="role-section-heading"><span>04 / HISTORY</span><h3>本机最近的汇总</h3></div><div id="role-life-records"></div><p>记录与生活授权只留在本机，不包含在普通应用备份中。授权后的文字会随聊天请求发给你配置的模型；撤销只阻止后续读取，不能撤回已发送的内容。</p><button type="button" class="role-danger" onclick="ByndRoleTools.clearRecords()">清除生活记录与全部生活授权</button></section>`;
        renderNative();
        renderRecords();
    }
    function renderRecords() {
        const state = life().read();
        const records = [...state.records, ...(state.nativeRecords || [])].sort((a, b) => a.date.localeCompare(b.date));
        el('role-life-records').innerHTML = records.length ? records.slice(-7).reverse().map(record => `<details><summary>${escape(record.date)} · ${Object.keys(record.metrics).length} 项记录</summary>${Object.entries(record.metrics).filter(([key]) => life().fields[key]).map(([key, metric]) => `<div class="role-record"><strong>${escape(life().fields[key].label)}</strong><span>${escape(life().fields[key].time ? new Date(metric.value).toLocaleString('zh-CN') : life().fields[key].choices?.[metric.value] || `${metric.value} ${life().fields[key].unit || ''}`)}</span><small>${escape(life().sources[metric.source] || '未知来源')} · ${escape(new Date(metric.observedAt).toLocaleString('zh-CN'))}</small></div>`).join('')}</details>`).join('') : '<p class="role-empty">还没有记录。保存或导入后，可在「角色授权」预览 TA 能看到的状态。</p>';
    }
    function renderNative() {
        const bridge = window.ByndNativeHealth;
        const root = el('role-native-health');
        if (!root) return;
        if (!bridge?.available()) { root.innerHTML = '<p>系统健康连接支持 iPhone 原生版的 Apple 健康，以及 Android 14 及以上原生版的 Health Connect 经期日期。网页和较旧 Android 可使用手动记录或汇总文件导入。</p>'; return; }
        const state = bridge.read();
        root.innerHTML = `<h4>连接 ${escape(bridge.provider())}</h4><p>系统授权只允许本机读取，不会自动告诉角色。可以单独选择月经样本，预计日期仍由你确认记录。</p><div class="role-grant-fields">${Object.entries({ sleep: '睡眠与作息', steps: '步数', exercise: '运动分钟', cycle: '经期日期样本' }).filter(([key]) => bridge.supportedTypes().includes(key)).map(([key, label]) => `<label>${label}<input type="checkbox" data-native-type="${key}" ${state.types.includes(key) ? 'checked' : ''}></label>`).join('')}</div><div class="role-actions"><button type="button" data-native-action onclick="ByndRoleTools.healthAction('connect')">${state.connected ? '修改读取类别／重新授权' : '连接并选择系统授权'}</button>${state.connected ? '<button type="button" data-native-action onclick="ByndRoleTools.healthAction(\'sync\')">刷新汇总</button><button type="button" data-native-action onclick="ByndRoleTools.healthAction(\'disconnect\')">断开并清除原生汇总</button>' : ''}</div><p>${state.lastSync ? '最近读取：' + escape(new Date(state.lastSync).toLocaleString('zh-CN')) : '尚未读取'}。没有数据时，无法区分未授权与未记录，不会补零或推断。</p>`;
    }
    async function healthAction(action) {
        const buttons = [...el('role-native-health').querySelectorAll('[data-native-action]')];
        buttons.forEach(button => { button.disabled = true; });
        try {
            let result;
            if (action === 'connect') result = await window.ByndNativeHealth.connect([...el('role-native-health').querySelectorAll('[data-native-type]:checked')].map(input => input.dataset.nativeType));
            else if (action === 'sync') result = await window.ByndNativeHealth.sync();
            else if (action === 'disconnect') window.ByndNativeHealth.disconnect();
            else throw new Error('不支持的连接操作');
            renderNative(); renderRecords(); renderPreview();
            status(action === 'disconnect' ? '已断开，并清除原生汇总。系统授权可在手机的健康数据权限中关闭。' : result.empty ? '没有读取到数据；可能未授权、未记录或尚未同步。旧的原生汇总已清除。' : `已读取 ${result.count} 条生活汇总和 ${result.flowDays} 个有月经流量记录的日期，角色授权保持原样。`);
            return true;
        } catch (error) { renderNative(); renderRecords(); renderPreview(); status(`健康读取未完成：${error.message}`, true); return false; }
        finally { buttons.forEach(button => { button.disabled = false; }); }
    }
    function renderRoles() {
        const list = chars();
        if (!list.some(char => String(char.id) === selectedId)) selectedId = String(list[0]?.id || '');
        const char = selected();
        const root = el('role-permissions-panel');
        if (!char) { root.innerHTML = '<section class="role-card role-empty"><h3>还没有单聊角色</h3><p>先在微信添加角色，再为 TA 单独选择能力。群聊不会读取这些生活状态。</p><button type="button" onclick="openApp(\'wechat\')">打开微信</button></section>'; return; }
        const state = life().read();
        const grant = life().grantFor(state, char);
        const prefs = window.getWechatAgentPreferences?.(char) || {};
        const toolFields = { allowTools: '允许使用现实工具', toolWeather: '查天气', toolPlaces: '找店和地点', toolMovies: '查电影', toolShop: '淘宝搜索', toolMcp: 'MCP 工具' };
        const catalog = window.ByndCharacterTools?.mcpCatalog?.();
        const picked = char.chatConfig?.agentMcpTools?.[catalog?.key] || [];
        root.innerHTML = `<section class="role-card"><label class="role-select">当前角色<select id="role-selected-char" onchange="ByndRoleTools.select(this.value)">${list.map(item => `<option value="${escape(item.id)}" ${String(item.id) === selectedId ? 'selected' : ''}>${escape(name(item))}</option>`).join('')}</select></label><p>下面的改动仅对 ${escape(name(char))} 生效。</p></section>
        <section class="role-card"><h3>生活状态授权</h3><label class="role-toggle"><span><strong>在聊天时提供生活状态</strong><small>仅分享下方授权的状态</small></span><input id="role-grant-enabled" type="checkbox" ${grant.enabled ? 'checked' : ''}></label><details><summary>概况与具体数据有什么区别？</summary><p>「生活概况」只提供解释；「具体数据」可见数值或具体时间。未授权项不会进入这个角色的解释结果或聊天请求。</p></details><label class="role-select">只使用多久内的汇总<select id="role-grant-age">${[12,24,36].map(hours => `<option value="${hours}" ${grant.maxAgeHours === hours ? 'selected' : ''}>${hours} 小时</option>`).join('')}</select></label><div class="role-grant-fields">${Object.entries(life().fields).map(([key, spec]) => `<label>${spec.label}<select id="role-grant-${key}">${Object.entries({ off: '不允许', summary: '生活概况', detail: '具体数据' }).map(([value, text]) => `<option value="${value}" ${grant.fields[key] === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`).join('')}</div><div class="role-actions"><button type="button" class="role-primary" onclick="ByndRoleTools.saveGrant()">保存 ${escape(name(char))} 的授权</button><button type="button" onclick="ByndRoleTools.revoke()">撤销 TA 的生活授权</button></div><div class="role-preview"><h4>TA 实际能看到什么</h4><div id="role-life-preview"></div></div></section>
        <section class="role-card"><h3>现实工具权限</h3><p>和聊天设置中的权限同步。生活状态独立授权，不随「允许使用现实工具」自动开启。</p>${Object.entries(toolFields).map(([key, text]) => `<label class="role-toggle"><span><strong>${text}</strong></span><input type="checkbox" data-role-tool="${key}" ${prefs[key] ? 'checked' : ''}></label>`).join('')}${catalog ? `<h4>${escape(catalog.name)} · 可用 MCP 工具</h4>${catalog.tools.map(tool => `<label class="role-toggle"><span><strong>${escape(tool.name)}</strong><small>${escape(tool.blocked ? '已拦截：可能修改数据或涉及隐私' : tool.description || '只读工具')}</small></span><input type="checkbox" data-role-mcp="${escape(tool.name)}" ${!tool.blocked && picked.includes(tool.name) ? 'checked' : ''} ${tool.blocked ? 'disabled' : ''}></label>`).join('')}` : '<p>如需 MCP 工具，请先在 MCP 应用连接服务。</p>'}<button type="button" onclick="ByndRoleTools.saveTools(this)">保存工具权限</button></section>`;
        renderPreview();
    }
    function renderPreview() {
        const char = selected();
        const root = el('role-life-preview');
        if (!root || !char) return;
        const state = life().read();
        const grant = life().grantFor(state, char);
        const items = life().visible(char);
        root.innerHTML = items.length ? items.map(item => `<p><strong>${escape(item.label)}</strong><span>${escape(item.text)}</span><small>${escape(item.date)} · ${escape(item.source)} · 汇总于 ${escape(new Date(item.observedAt).toLocaleString('zh-CN'))}</small></p>`).join('') : `<p>${state.paused ? '所有角色的生活读取已暂停。' : !grant.enabled ? '尚未开启生活读取，TA 看不到任何生活状态。' : '没有已授权且仍有效的记录。缺失或过期的数据不会发送给 TA。'}</p>`;
    }
    function open() {
        try { window.ByndCharacterTools?.renderSettings(); renderLife(); renderRoles(); tab('life'); status(''); }
        catch (error) {
            el('role-life-panel').innerHTML = '<section class="role-card"><h3>生活状态读取失败</h3><p>为保护你的数据，角色暂时不能读取。可清除本机生活记录与生活授权后重新记录。</p><button type="button" onclick="ByndRoleTools.clearRecords()">清除生活记录与授权</button></section>';
            tab('life'); status(`读取失败：${error.message}`, true);
        }
    }
    function saveRecord() {
        try {
            const values = {};
            for (const [key, spec] of Object.entries(life().fields)) {
                const value = el(`role-life-${key}`).value;
                if (value !== '') values[key] = spec.time ? new Date(value).toISOString() : spec.choices ? value : Number(value);
            }
            if (el('role-life-date').value !== life().localDate()) throw new Error('手动记录请选今天；历史记录通过文件保留原汇总时间');
            life().importSummary({ version: 1, records: [{ date: el('role-life-date').value, observedAt: new Date().toISOString(), source: 'manual', values }] });
            renderRecords(); renderPreview(); status('生活记录已保存。只对已授权的角色提供。');
            return true;
        } catch (error) { status(`未保存：${error.message}`, true); return false; }
    }
    async function importFile(input) {
        const file = input.files?.[0];
        if (!file) return false;
        input.disabled = true;
        try {
            if (file.size > 512 * 1024) throw new Error('汇总文件不能超过 512 KB');
            const count = life().importSummary(JSON.parse(await file.text()));
            renderRecords(); renderPreview(); status(`已导入 ${count} 条汇总，角色授权保持原样。`);
            return true;
        } catch (error) { status(`未导入：${error.message}`, true); return false; }
        finally { input.value = ''; input.disabled = false; }
    }
    function saveGrant() {
        try {
            const char = selected();
            life().setGrant(char, { enabled: el('role-grant-enabled').checked, maxAgeHours: Number(el('role-grant-age').value), fields: Object.fromEntries(Object.keys(life().fields).map(key => [key, el(`role-grant-${key}`).value])) });
            renderPreview(); status(`${name(char)} 的生活授权已保存。未选择的项不会提供给 TA。`); return true;
        } catch (error) { status(`授权未保存：${error.message}`, true); return false; }
    }
    function revoke() {
        try { const char = selected(); life().setGrant(char, { enabled: false, fields: {} }); renderRoles(); status('已撤销这个角色的全部生活授权，后续聊天停止读取。'); return true; }
        catch (error) { status(`撤销失败：${error.message}`, true); return false; }
    }
    function pause(input) {
        try { life().settings({ paused: input.checked }); renderPreview(); status(input.checked ? '已暂停所有角色读取。' : '已恢复按角色授权读取。'); }
        catch (error) { input.checked = !input.checked; status(`操作失败：${error.message}`, true); }
    }
    function saveGoal() {
        try { life().settings({ sleepGoal: Number(el('role-life-goal').value) * 60 }); renderPreview(); status('个人睡眠目标已保存。'); }
        catch (error) { status(`目标未保存：${error.message}`, true); }
    }
    async function saveTools(button) {
        const char = selected();
        if (!char || writing) return false;
        writing = true; button.disabled = true;
        char.chatConfig = char.chatConfig || {};
        const before = { preferences: char.chatConfig.agentPreferences, mcp: char.chatConfig.agentMcpTools };
        try {
            if (typeof window.saveCharactersToStorage !== 'function') throw new Error('角色存储尚未准备好');
            const prefs = Object.fromEntries([...el('role-permissions-panel').querySelectorAll('[data-role-tool]')].map(input => [input.dataset.roleTool, input.checked]));
            char.chatConfig.agentPreferences = { ...before.preferences, ...prefs };
            const catalog = window.ByndCharacterTools?.mcpCatalog?.();
            if (catalog) {
                const picks = [...el('role-permissions-panel').querySelectorAll('[data-role-mcp]:checked')].map(input => input.dataset.roleMcp).filter(key => catalog.tools.some(tool => tool.name === key && !tool.blocked));
                char.chatConfig.agentMcpTools = { ...before.mcp, [catalog.key]: picks };
            }
            if (await window.saveCharactersToStorage() === false) throw new Error('角色保存失败，请重试');
            status(`${name(char)} 的工具权限已保存。`); return true;
        } catch (error) {
            if (before.preferences === undefined) delete char.chatConfig.agentPreferences; else char.chatConfig.agentPreferences = before.preferences;
            if (before.mcp === undefined) delete char.chatConfig.agentMcpTools; else char.chatConfig.agentMcpTools = before.mcp;
            status(`权限未保存：${error.message}`, true); return false;
        } finally { writing = false; button.disabled = false; }
    }
    function clearRecords() {
        if (!window.confirm('清除本机全部生活记录和生活授权？现实工具权限会保留。')) return;
        try { life().clear(); renderLife(); renderRoles(); status('本机生活记录与生活授权已清除。'); }
        catch (error) { status(`清除失败：${error.message}`, true); }
    }
    function template() {
        let url;
        try {
            const example = { version: 1, records: [{ date: life().localDate(), observedAt: new Date().toISOString(), source: 'import', values: { sleepMinutes: 420, steps: 3200 } }] };
            url = URL.createObjectURL(new Blob([JSON.stringify(example, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a'); link.href = url; link.download = 'BYND-life-summary-example.json'; link.click();
            status('已请求下载格式示例，示例数值不是你的实际健康数据。');
        } catch (error) { status(`无法下载：${error.message}`, true); }
        finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 2000); }
    }
    window.ByndRoleTools = { open, tab, select: id => { if (writing) return; selectedId = String(id); renderRoles(); }, saveRecord, importFile, saveGrant, revoke, pause, saveGoal, saveTools, clearRecords, template, healthAction };
})();
