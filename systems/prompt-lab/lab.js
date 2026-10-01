/* Settings UI, model adapters and opt-in production policy routing. */
(function () {
    'use strict';
    const E = window.ByndPromptEval;
    const store = window.ByndPromptStore.create(localStorage, window.ByndPromptCases);
    const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    let busy = false, importing = false, controller = null, runtime = null, frame = null;
    let lastRun = null;
    let transientError = '';
    let replayProxy = null;
    const moduleLabels = { persona: '角色一致性', knowledge: '知识边界', tools: '工具与权限', initiative: '主动程度', context: '世界书与记忆', decision: '智能决策', reality: '现实事件可见性' };
    const FOLLOW = 'follow-experiment';
    async function runtimeDescriptor(replay, apis, cases, initial, preset) {
        const samples = [];
        for (const c of cases) samples.push(await replay.prepareByndPromptReplay(c, initial));
        return { target: model(apis.target), judge: model(apis.judge), proposer: model(apis.proposer), jev: { enabled: ByndJev.available('turn'), threshold: ByndJev.read().minProbability, scopes: Object.fromEntries([...new Set(cases.filter(c => c.lane === 'jev').map(c => c.jevScope || 'turn'))].map(scope => [scope, ByndJev.available(scope)])) }, preset: E.fingerprint(preset),
            build: E.fingerprint([samples, replay.signature, ...Object.values(E).filter(v => typeof v === 'function').map(fn => fn.toString()), E.CATEGORIES, E.CRITICAL]) };
    }
    function model(api) {
        if (!api?.model || !api?.baseUrl) throw new Error('请在 API 设置里配置模型');
        const url = new URL(api.baseUrl);
        return { model: api.model, route: url.origin + url.pathname };
    }
    function activePolicy() {
        try {
            const active = store.read().active;
            if (!active || E.fingerprint(active.model) !== E.fingerprint(model(getDefaultApi()))) return E.BASELINE;
            if (active.preset !== E.fingerprint(typeof getActivePreset === 'function' ? getActivePreset() : null)) return E.BASELINE;
            return E.candidate(active.policy);
        } catch (error) { console.warn('Prompt Lab 行为补充不可用：', error.message); return E.BASELINE; }
    }
    function prompt() { return E.policyText(activePolicy()); }
    function decisionPrompt() { return E.policyText(activePolicy(), 'jev'); }
    function worldBook(char) { return E.select(char?.worldBook, char || {}, activePolicy().worldBookMode); }
    function memories(char, original) {
        const p = activePolicy();
        return Object.fromEntries(Object.entries(original).map(([key, list]) => [key, E.select(list, char, p.memoryMode)]));
    }
    function status(message) { const box = document.getElementById('prompt-lab-status'); if (box) box.textContent = message; }
    function handle(action) { try { action(); } catch (error) { status('操作失败：' + error.message); } }
    function apiOptions(selected, follow = false) {
        const apis = typeof getApiData === 'function' ? getApiData().apis.filter(api => api.model) : [];
        return (follow ? `<option value="${FOLLOW}" ${selected === FOLLOW ? 'selected' : ''}>跟随实验模型</option>` : '') + `<option value="" ${selected === '' ? 'selected' : ''}>默认聊天模型</option>` + apis.map(api => `<option value="${escape(api.id)}" ${api.id === selected ? 'selected' : ''}>${escape(api.name || api.model)} · ${escape(api.model)}</option>`).join('');
    }
    function modelPreferences(report) {
        if (report?.modelPreferences) return report.modelPreferences;
        const ids = report?.apiIds || { target: '', judge: '', proposer: '' };
        return { experiment: ids.target, judge: ids.judge === ids.target ? FOLLOW : ids.judge, proposer: ids.proposer === ids.target ? FOLLOW : ids.proposer };
    }
    function draftMode(data) {
        return data.draftMode || ([E.BASELINE, E.SEED].some(p => E.fingerprint(p) === E.fingerprint(data.draft)) ? 'builtin' : 'custom');
    }
    function render() {
        const box = document.getElementById('bynd-prompt-lab');
        if (!box || busy) return;
        try {
            const data = store.read();
            const report = data.report;
            const preferences = report ? modelPreferences(report) : data.experimentSettings?.modelPreferences || modelPreferences(report);
            const limits = report?.config || data.experimentSettings?.config;
            const mode = draftMode(data), editor = mode === 'builtin' ? E.SEED : data.draft;
            const bestRows = report?.rows.filter(row => row.candidateId === E.fingerprint(report.best)) || [];
            const metrics = E.summarize(bestRows);
            const activeLabel = !data.active ? '使用原有 Prompt' : E.fingerprint(activePolicy()) === E.fingerprint(E.BASELINE) ? '行为补充已暂停 · 请检查模型与预设' : '行为补充已启用';
            box.innerHTML = `<div class="lab-top"><strong>Prompt Lab</strong><span>${activeLabel}</span></div>
                <label class="lab-experiment">实验模型<select id="lab-experiment">${apiOptions(preferences.experiment)}</select></label>
                <details class="lab-model-config" id="lab-model-config"><summary>高级模型配置</summary><div class="lab-models"><label>被测模型<select id="lab-target">${apiOptions(preferences.experiment)}</select></label><label>评分模型<select id="lab-judge">${apiOptions(preferences.judge, true)}</select></label><label>优化模型<select id="lab-proposer">${apiOptions(preferences.proposer, true)}</select></label></div><p class="lab-note">评分和优化默认跟随实验模型，分别使用新请求与独立上下文。</p></details>
                <div class="lab-actions lab-primary"><button type="button" data-lab="run">评测并自动优化</button>${report?.status === 'stopped' ? '<button type="button" data-lab="resume">继续实验</button>' : ''}</div>
                <p class="lab-note lab-start-note">${mode === 'builtin' ? '使用内置行为策略' : '使用已保存的自定义策略'}，会产生 API 调用费用。</p>
                <details id="lab-options"><summary>高级实验选项</summary>
                <div class="lab-budget"><label>轮数<input id="lab-rounds" type="number" min="1" max="20" value="${limits?.rounds || 3}"></label><label>每例采样<input id="lab-repeats" type="number" min="1" max="5" value="${limits?.repeats || 2}"></label><label>调用上限<input id="lab-calls" type="number" min="1" max="5000" value="${limits?.maxCalls || 600}"></label><label>分钟预算<input id="lab-minutes" type="number" min="1" max="120" value="${limits?.maxMinutes || 20}"></label></div>
                <label>行为策略<select id="lab-policy"><option value="builtin" ${mode === 'builtin' ? 'selected' : ''}>内置行为策略</option><option value="custom" ${mode === 'custom' ? 'selected' : ''}>自定义策略</option></select></label>
                <p class="lab-note">内置策略覆盖角色、知识、权限、主动程度、世界书与记忆、智能决策和现实事件，无需手动填写。</p>
                <details id="lab-custom-policy" ${mode === 'custom' ? '' : 'hidden'}><summary>手动编辑策略</summary><div class="lab-editor">${E.SCOPES.map(key => `<label>${moduleLabels[key]}<textarea data-lab-module="${key}" maxlength="1600" rows="3">${escape(editor.modules[key])}</textarea></label>`).join('')}<label>世界书选择<select id="lab-worldbook"><option value="existing" ${editor.worldBookMode === 'existing' ? 'selected' : ''}>原有方式</option><option value="relevant" ${editor.worldBookMode === 'relevant' ? 'selected' : ''}>关键词匹配与角色隔离</option></select></label><label>记忆选择<select id="lab-memory"><option value="existing" ${editor.memoryMode === 'existing' ? 'selected' : ''}>原有方式</option><option value="focused" ${editor.memoryMode === 'focused' ? 'selected' : ''}>相关记忆补充过滤</option></select></label></div><div class="lab-actions"><button type="button" data-lab="draft">保存草稿</button></div></details>
                <div class="lab-actions"><button type="button" data-lab="seed">恢复内置策略</button></div>
                <p class="lab-note">${data.cases.length} 个案例 · 开发 / 验证 / 留出三组。Jev 案例使用智能决策配置。工具只记录，不执行。</p></details>
                <p id="prompt-lab-status" role="status" aria-live="polite">${escape(report ? `${report.status === 'complete' ? '实验完成' : report.status === 'stopped' ? '实验已停止' : '实验未完成'} · ${report.calls} 次调用${report.error ? ' · ' + report.error : ''}` : '准备就绪，点击开始。')}</p>
                ${report || data.active || data.history.length ? `<div class="lab-actions"><button type="button" data-lab="activate" ${report?.eligible ? '' : 'disabled'}>启用最佳版本</button><button type="button" data-lab="disable" ${data.active ? '' : 'disabled'}>停用</button><button type="button" data-lab="rollback" ${data.history.length ? '' : 'disabled'}>回滚</button></div>` : ''}
                ${report ? `<div class="lab-summary"><span>最佳宏平均 <b>${Math.round(metrics.score * 100)}%</b></span><span>硬门槛失败 <b>${metrics.hardFailures}</b></span><span>留出提升 <b>${report.test ? (report.test.delta * 100).toFixed(1) + '%' : '未验证'}</b></span></div><div class="lab-categories">${Object.entries(metrics.categories).map(([key, b]) => `<div><span>${E.CATEGORIES[key]}</span><b>${b.passed}/${b.total}</b></div>`).join('')}</div>
                <details><summary>候选与失败案例</summary>${report.rounds.map(r => `<p>第 ${r.round + 1} 轮 · ${escape(r.scope)} · ${r.complete ? r.accepted ? '保留' : '未保留' : '进行中'}<br>${escape(r.hypothesis || '')}<br>${escape(r.development?.reason || '')}</p>`).join('')}${bestRows.filter(r => !r.grade?.pass).map(r => `<details><summary>${escape(r.caseId)} · ${r.error ? '调用失败' : '未通过'}</summary><p>${escape(r.input)}</p><pre>${escape(r.trace?.content || '')}</pre><p>${escape(r.error || r.grade?.failures.join('；'))}</p></details>`).join('')}</details>` : ''}
                <section class="lab-data" aria-labelledby="lab-data-title"><h4 id="lab-data-title">实验数据</h4><p class="lab-note">备份或恢复 Prompt Lab 的测试案例与实验配置</p><div class="lab-actions"><button type="button" data-lab="export">导出备份</button><button type="button" data-lab="import">导入备份</button></div><input id="lab-backup-file" type="file" accept=".json,application/json" aria-label="选择 Prompt Lab 备份文件" hidden></section>
                <details><summary>评测说明</summary><p class="lab-note">使用隔离的生产聊天 Prompt 构造器，固定日期和合成角色。世界书走共享选择函数；记忆来源与事件权限用案例快照替代真实存储。Jev 走真实接口。评分规则锁定，优化器仅看到开发组失败。启用需要留出集提升超过配对噪声估计、无分类退步和硬门槛失败。小样本可能无法确认改善，需要扩充独立案例。通过不代表所有真实角色都通过。</p></details>`;
            box.querySelectorAll('[data-lab]').forEach(button => button.addEventListener('click', () => action(button.dataset.lab)));
            document.getElementById('lab-backup-file').addEventListener('change', event => { void importBackup(event.target); });
            document.getElementById('lab-experiment').addEventListener('change', event => { document.getElementById('lab-target').value = event.target.value; });
            document.getElementById('lab-target').addEventListener('change', event => { document.getElementById('lab-experiment').value = event.target.value; });
            document.getElementById('lab-policy').addEventListener('change', event => {
                document.getElementById('lab-custom-policy').hidden = event.target.value !== 'custom';
                box.querySelector('.lab-start-note').textContent = (event.target.value === 'builtin' ? '使用内置行为策略' : '使用已保存的自定义策略') + '，会产生 API 调用费用。';
            });
        } catch (error) { box.textContent = '读取 Prompt Lab 失败：' + error.message; }
    }
    async function sandbox() {
        if (replayProxy) return replayProxy;
        if (frame) frame.remove();
        frame = document.createElement('iframe');
        frame.hidden = true;
        frame.src = 'systems/prompt-lab/sandbox.html?v=' + (typeof APP_VERSION === 'string' ? APP_VERSION : E.VERSION);
        const ready = new Promise((resolve, reject) => {
            const timer = setTimeout(() => { cleanup(); reject(new Error('隔离评测环境加载超时')); }, 15000);
            let nextId = 0;
            function request(command, payload) {
                const id = ++nextId;
                return new Promise((done, fail) => {
                    const timeout = setTimeout(() => { window.removeEventListener('message', receive); fail(new Error('隔离回放请求超时')); }, 10000);
                    const receive = event => {
                        if (event.source !== frame.contentWindow || event.data?.byndPromptReplay !== 'response' || event.data.id !== id) return;
                        clearTimeout(timeout); window.removeEventListener('message', receive);
                        if (event.data.error) fail(new Error(event.data.error)); else done(event.data.result);
                    };
                    window.addEventListener('message', receive);
                    frame.contentWindow.postMessage({ byndPromptReplay: 'request', id, command, payload: E.clone(payload) }, '*');
                });
            }
            const listener = event => {
                if (event.source === frame.contentWindow && event.data?.byndPromptReplay === 'ready') {
                    cleanup();
                    replayProxy = { signature: '', prepareByndPromptReplay: (testCase, policy) => request('prepare', { testCase, policy }), setByndPromptReplayPreset: async value => { replayProxy.signature = await request('preset', value); } };
                    resolve(replayProxy);
                }
            };
            function cleanup() { clearTimeout(timer); window.removeEventListener('message', listener); }
            window.addEventListener('message', listener);
        });
        document.body.appendChild(frame);
        return ready;
    }
    function selectedApi(id) { const api = id ? getApiData().apis.find(api => api.id === id) : getDefaultApi(); if (!api) throw new Error('所选 API 不存在'); return E.clone(api); }
    async function start(resume = false) {
        if (busy || importing) return;
        try {
            const preferences = { experiment: document.getElementById('lab-experiment').value, judge: document.getElementById('lab-judge').value, proposer: document.getElementById('lab-proposer').value };
            const apiIds = { target: preferences.experiment, ...Object.fromEntries(['judge', 'proposer'].map(key => [key, preferences[key] === FOLLOW ? preferences.experiment : preferences[key]])) };
            const apis = Object.fromEntries(Object.entries(apiIds).map(([key, id]) => [key, selectedApi(id)]));
            const data = store.read();
            const initial = resume ? data.report.initial : document.getElementById('lab-policy').value === 'builtin' ? E.SEED : data.draft;
            const preset = typeof getActivePreset === 'function' ? E.clone(getActivePreset() || null) : null;
            const settings = E.config({ rounds: Number(document.getElementById('lab-rounds').value), repeats: Number(document.getElementById('lab-repeats').value), maxCalls: Number(document.getElementById('lab-calls').value), maxMinutes: Number(document.getElementById('lab-minutes').value) });
            for (const api of Object.values(apis)) model(api);
            const missingScopes = [...new Set(data.cases.filter(c => c.lane === 'jev').map(c => c.jevScope || 'turn'))].filter(scope => !window.ByndJev?.available(scope));
            if (missingScopes.length) throw new Error('请先在智能决策里配置并启用 Jev 场景：' + missingScopes.join('、'));
            transientError = ''; busy = true; controller = new AbortController();
            status('正在准备隔离评测…');
            const stop = document.createElement('button'); stop.type = 'button'; stop.textContent = '停止实验'; stop.onclick = () => { controller.abort(); status('已请求停止，当前 API 请求结束后停止。'); }; document.getElementById('bynd-prompt-lab').prepend(stop);
            const replay = await sandbox();
            await replay.setByndPromptReplayPreset(preset);
            runtime = await runtimeDescriptor(replay, apis, data.cases, initial, preset);
            async function request(messages, api, signal) {
                if (signal?.aborted) throw new Error('实验已停止');
                const usage = [];
                const result = await callChatApi(messages, { apiOverride: api, presetOverride: preset, temperature: api === apis.target ? (preset?.temperature ?? 0.8) : 0, ...(api === apis.target ? {} : { max_tokens: 1800 }), privateUsage: true, usageFeature: 'prompt-lab', usageCollector: usage, skipStatusValidationRetry: true, skipEmptyLengthRetry: true, respectRateLimitPause: true, canSend: () => !signal?.aborted });
                if (!result.ok) throw new Error(result.error || 'API 调用失败');
                return { content: result.content, model: api.model, usage: usage.map(item => ({ actualUsage: item.actualUsage || item.usage || null, inputEstimate: item.inputEstimate ?? null, outputEstimate: item.outputEstimate ?? null })), route: model(api).route };
            }
            const adapter = {
                generate: async (c, p, signal) => {
                    const prepared = await replay.prepareByndPromptReplay(c, p);
                    const result = await request(prepared.messages, apis.target, signal);
                    const parsed = ByndDecider.extractReplyDecisions(result.content);
                    return { ...result, raw: result.content, content: parsed.content, decisions: parsed.decisions, messages: E.clone(prepared.messages), selection: E.clone(prepared.selection) };
                },
                judge: async (c, trace, signal) => {
                    const messages = E.judgeMessages(c, trace.content);
                    const receipt = await request(messages, apis.judge, signal);
                    return { ...E.parseJson(receipt.content), meta: { ...receipt, messages } };
                },
                propose: async (p, failures, scope, signal) => {
                    if (!E.SCOPES.includes(scope)) return { scope, text: scope === 'worldBookMode' ? 'relevant' : 'focused', hypothesis: '相关性与角色可见性过滤减少无关或越界上下文。' };
                    const messages = E.proposalMessages(p, failures, scope);
                    const receipt = await request(messages, apis.proposer, signal);
                    return { ...E.parseJson(receipt.content), meta: { ...receipt, messages } };
                },
                decide: async (c, p) => {
                    if (ByndJev.read().minProbability !== runtime.jev.threshold) throw new Error('Jev 门槛已变化，请重新开始实验');
                    const prepared = await replay.prepareByndPromptReplay(c, p);
                    let receipt = null;
                    const answers = await ByndJev.ask(c.jevScope || 'turn', E.clone(prepared.state), E.clone(prepared.questions), { private: true, onReceipt: value => { receipt = value; } });
                    if (!answers) throw new Error('Jev 失败或未配置；未把 fallback 算作成功');
                    return { ...receipt, content: '', decisions: Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, value?.confident ? value.value : null])), state: E.clone(prepared.state), questions: E.clone(prepared.questions), selection: E.clone(prepared.selection) };
                }
            };
            const result = await E.run({ cases: data.cases, initial, config: settings, runtime, adapter, signal: controller.signal, resume: resume ? data.report : null,
                checkpoint: report => { lastRun = report; store.update(next => { next.report = { ...report, apiIds, modelPreferences: preferences }; }); },
                progress: progress => status(progress.phase === 'round' ? `第 ${progress.round} 轮${progress.accepted ? '保留' : '未保留'} · ${progress.calls} 次调用` : `${progress.phase} · ${progress.caseId} · ${progress.calls} 次调用`) });
            lastRun = result;
        } catch (error) { transientError = '实验失败：' + error.message; }
        finally { busy = false; controller = null; render(); if (transientError) status(transientError); }
    }
    function action(name) {
        if (importing) { status('正在导入备份，请稍候。'); return; }
        if (name === 'run' || name === 'resume') { void start(name === 'resume'); return; }
        if (busy) { status('实验运行中，请先停止。'); return; }
        handle(() => {
            if (name === 'draft') {
                const modules = Object.fromEntries([...document.querySelectorAll('[data-lab-module]')].map(input => [input.dataset.labModule, input.value]));
                store.saveDraft({ modules, worldBookMode: document.getElementById('lab-worldbook').value, memoryMode: document.getElementById('lab-memory').value }); render(); status('草稿已保存，尚未启用。');
            }
            if (name === 'seed') { store.saveDraft(E.SEED, 'builtin'); render(); status('已恢复内置策略，需评测后才能启用。'); }
            if (name === 'activate') { void activate(); }
            if (name === 'disable') { store.disable(); render(); status('行为补充已停用。'); }
            if (name === 'rollback') { store.rollback(); render(); status('已回滚到上一版本。'); }
            if (name === 'import') { document.getElementById('lab-backup-file').click(); }
            if (name === 'export') {
                const settings = { draftMode: document.getElementById('lab-policy').value, modelPreferences: Object.fromEntries(['experiment', 'judge', 'proposer'].map(key => [key, document.getElementById('lab-' + key).value])), config: { rounds: Number(document.getElementById('lab-rounds').value), repeats: Number(document.getElementById('lab-repeats').value), maxCalls: Number(document.getElementById('lab-calls').value), maxMinutes: Number(document.getElementById('lab-minutes').value) } };
                const blob = new Blob([store.exportData(settings)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                try { const link = document.createElement('a'); link.href = url; link.download = 'BYND-prompt-lab.json'; document.body.appendChild(link); try { link.click(); } finally { link.remove(); } }
                finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
                status('已发起备份下载。');
            }
        });
    }
    async function importBackup(input) {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        if (busy || importing) { status('实验或导入正在运行，请稍后再导入。'); return; }
        importing = true;
        status('正在读取备份…');
        try {
            if (file.size > 10000000) throw new Error('导入文件超过 10 MB');
            const text = await file.text();
            store.importData(text);
            render();
            status('实验数据已导入，需要重新评测。');
        } catch (error) { status('导入失败：' + error.message); }
        finally { importing = false; }
    }
    async function activate() {
        try {
            const data = store.read(), report = data.report;
            if (!report) throw new Error('没有完整评测');
            const apis = Object.fromEntries(['target', 'judge', 'proposer'].map(key => [key, selectedApi(report.apiIds[key])]));
            const preset = typeof getActivePreset === 'function' ? E.clone(getActivePreset() || null) : null;
            const replay = await sandbox(); await replay.setByndPromptReplayPreset(preset);
            const current = await runtimeDescriptor(replay, apis, data.cases, report.initial, preset);
            store.activate(current); render(); status('最佳版本已启用；只用于评测时的聊天模型。');
        } catch (error) { status('启用失败：' + error.message); }
    }
    window.ByndPromptLab = { render, prompt, decisionPrompt, worldBook, memories, store, start, action, activePolicy, lastRun: () => lastRun };
})();
