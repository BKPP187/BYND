/* Optional TypeSafe Jev decisions. BYND's built-in agent remains the fallback. */
(function () {
    'use strict';

    const STORAGE_KEY = 'bynd_jev_config_v1';
    const LOG_KEY = 'bynd_decision_log_v1';
    const LOG_LIMIT = 60;
    const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
    // TypeSafe refuses browser origins, so the page goes through BYND's relay on its own domain
    // (bynd.ccwu.cc/mcp/relay/*, see workers/DEPLOY.md). The APK calls the same address.
    const PROXY_ENDPOINTS = ['https://bynd.ccwu.cc/mcp/relay/jev/v1/systemone'];
    const PROXY_ENDPOINT = PROXY_ENDPOINTS[0];
    let directBlocked = typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
    const SCOPES = ['turn', 'toolGate', 'moment', 'momentEngagement', 'forumAction', 'forumReply', 'profile'];
    const DEFAULT_MIN_PROBABILITY = 0.55;
    const clampProbability = value => Math.min(0.95, Math.max(0.34, Number(value) || DEFAULT_MIN_PROBABILITY));
    const defaults = () => ({ enabled: false, apiKey: '', minProbability: DEFAULT_MIN_PROBABILITY, scopes: Object.fromEntries(SCOPES.map(scope => [scope, true])) });

    function read() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!saved || typeof saved !== 'object') return defaults();
            return {
                enabled: saved.enabled === true,
                apiKey: String(saved.apiKey || ''),
                minProbability: clampProbability(saved.minProbability ?? DEFAULT_MIN_PROBABILITY),
                scopes: { ...defaults().scopes, ...(saved.scopes || {}) }
            };
        } catch (_) { return defaults(); }
    }

    function write(config) {
        const next = {
            enabled: config.enabled === true,
            apiKey: String(config.apiKey || '').trim(),
            minProbability: clampProbability(config.minProbability ?? DEFAULT_MIN_PROBABILITY),
            scopes: Object.fromEntries(SCOPES.map(scope => [scope, config.scopes?.[scope] !== false]))
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
    }

    function available(scope) {
        const config = read();
        return SCOPES.includes(scope) && config.enabled && !!config.apiKey && config.scopes[scope] !== false;
    }

    // A short local record of every decision (Jev or BYND agent) so the user can judge whether they fit the character.
    function readLog() {
        try {
            const saved = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch (_) { return []; }
    }

    function logDecision(entry) {
        try {
            const next = [{ at: Date.now(), ...entry }, ...readLog()].slice(0, LOG_LIMIT);
            localStorage.setItem(LOG_KEY, JSON.stringify(next));
            if (typeof document !== 'undefined' && document.getElementById('bynd-jev-log')) renderLog();
        } catch (_) {}
    }

    async function requestQuestions(apiKey, state, questions, timeoutMs = 8000) {
        const payload = JSON.stringify({ model: 'jev-latest', state, questions });
        if (payload.length > 30000) throw new Error('Jev 决策上下文过长');
        const endpoints = directBlocked ? PROXY_ENDPOINTS : [ENDPOINT, ...PROXY_ENDPOINTS];
        for (const endpoint of endpoints) {
            const isLast = endpoint === endpoints[endpoints.length - 1];
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: payload,
                    signal: controller.signal
                });
                // A same-origin route that isn't attached answers 404/405 from the static host; try the next address.
                if (!isLast && endpoint !== ENDPOINT && (response.status === 404 || response.status === 405)) continue;
                if (!response.ok) throw new Error(endpoint === PROXY_ENDPOINT && response.status === 404 ? 'Jev 转发服务尚未上线（HTTP 404），不是密钥格式问题' : `Jev HTTP ${response.status}`);
                const data = await response.json();
                const answered = !!data?.answers && Object.keys(questions).every(key => data.answers[key]);
                try { window.ByndUsageLedger?.record({ feature: 'jev', provider: 'api.typesafe.ai', apiName: 'Jev', model: 'jev-latest', usage: data?.usage || null, ok: answered, ticket: null, source: null }); } catch (_) {}
                if (!data || typeof data !== 'object' || !answered) throw new Error('Jev 没有返回有效决策');
                return data.answers;
            } catch (error) {
                const networkLike = error?.name === 'TypeError' || error?.name === 'AbortError';
                if (endpoint === ENDPOINT && networkLike) directBlocked = true;
                if (isLast || !networkLike) throw error;
            } finally { clearTimeout(timer); }
        }
        throw new Error('Jev 连接失败');
    }

    async function request(apiKey, state, question, timeoutMs = 8000) {
        return (await requestQuestions(apiKey, state, { decision: question }, timeoutMs)).decision;
    }

    // Turns a raw Jev answer into { value, probability, confident }. Answers without probabilities are trusted as given.
    function interpret(question, answer, minProbability) {
        if (!answer || answer.type !== question.type) return null;
        if (question.type === 'choice') {
            if (!Object.prototype.hasOwnProperty.call(question.criteria || {}, answer.choice)) return null;
            const probability = Number(answer.probabilities?.[answer.choice]);
            const known = Number.isFinite(probability);
            return { value: answer.choice, probability: known ? probability : null, confident: !known || probability >= minProbability };
        }
        if (question.type === 'noul') {
            const probability = Number(answer.noul);
            if (!Number.isFinite(probability)) return null;
            const value = probability >= minProbability ? true : (probability <= 1 - minProbability ? false : null);
            return { value, probability, confident: value !== null };
        }
        if (question.type === 'score') {
            const score = Number(answer.score);
            return Number.isFinite(score) ? { value: score, probability: Number(answer.confidence) || null, confident: true } : null;
        }
        return null;
    }

    // Several typed questions in one request; returns { key: { value, probability, confident } } or null to fall back.
    async function ask(scope, state, questions, meta = {}) {
        if (!available(scope) || !questions || !Object.keys(questions).length) return null;
        const config = read();
        try {
            const answers = await requestQuestions(config.apiKey, state, questions);
            const result = {};
            for (const [key, question] of Object.entries(questions)) {
                result[key] = interpret(question, answers[key], config.minProbability);
                logDecision({ scope, route: 'jev', charName: meta.charName || '', key, label: meta.labels?.[key] || key, answer: result[key]?.value ?? null, probability: result[key]?.probability ?? null, applied: !!result[key]?.confident });
            }
            return result;
        } catch (error) {
            console.warn('Jev 决策不可用，沿用 BYND 角色决策：', error?.message || error);
            logDecision({ scope, route: 'jev-error', charName: meta.charName || '', key: 'error', label: '调用失败，已回到 BYND 路径', answer: String(error?.message || error).slice(0, 120), probability: null, applied: false });
            return null;
        }
    }

    async function choose(scope, state, instructions, criteria) {
        const options = Object.keys(criteria || {});
        if (options.length < 2) return null;
        const answers = await ask(scope, state, { decision: { type: 'choice', instructions, criteria } });
        const decision = answers?.decision;
        return decision?.confident ? decision.value : null;
    }

    async function testConnection(apiKey) {
        const key = String(apiKey || '').trim();
        if (!key) throw new Error('请先填写 Jev API Key。');
        const answer = await request(key, { sample: 'A person replied to a forum post with a question.' }, {
            type: 'choice', instructions: 'Should the author consider responding to this question?',
            criteria: { consider: 'The author may consider a response.', silence: 'The author can stay silent.' }
        });
        if (answer.type !== 'choice' || !['consider', 'silence'].includes(answer.choice)) throw new Error('Jev 返回格式无效。');
        return true;
    }

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const routeLabel = { jev: 'Jev', agent: 'BYND Agent', 'jev-error': 'Jev 失败' };

    function renderLog() {
        const box = typeof document !== 'undefined' ? document.getElementById('bynd-jev-log') : null;
        if (!box) return;
        const entries = readLog().slice(0, 20);
        box.innerHTML = entries.length ? entries.map(entry => {
            const time = new Date(entry.at || 0).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const answer = entry.answer === true ? '是' : entry.answer === false ? '否' : entry.answer == null ? '不确定' : String(entry.answer);
            const probability = Number.isFinite(Number(entry.probability)) && entry.probability !== null ? ` · ${Math.round(Number(entry.probability) * 100)}%` : '';
            return `<li class="${entry.applied ? 'is-applied' : ''}"><span>${escapeHtml(time)} · ${escapeHtml(routeLabel[entry.route] || entry.route)}${entry.charName ? ` · ${escapeHtml(entry.charName)}` : ''}</span><b>${escapeHtml(entry.label || entry.key)}：${escapeHtml(answer)}${probability}</b><small>${entry.applied ? '已执行' : '未执行，沿用原逻辑'}</small></li>`;
        }).join('') : '<li class="is-empty">还没有决策记录。聊天、朋友圈或论坛触发判断后会出现在这里。</li>';
    }

    function renderSettings() {
        const root = document.getElementById('bynd-jev-settings');
        if (!root) return;
        const config = read();
        root.querySelector('#bynd-jev-enabled').checked = config.enabled;
        root.querySelector('#bynd-jev-key').value = config.apiKey;
        const threshold = root.querySelector('#bynd-jev-threshold');
        if (threshold) threshold.value = String(Math.round(config.minProbability * 100));
        const thresholdLabel = root.querySelector('#bynd-jev-threshold-value');
        if (thresholdLabel) thresholdLabel.textContent = `${Math.round(config.minProbability * 100)}%`;
        SCOPES.forEach(scope => { const input = root.querySelector(`[data-jev-scope="${scope}"]`); if (input) input.checked = config.scopes[scope] !== false; });
        const route = root.querySelector('#bynd-jev-route');
        if (route) route.textContent = config.enabled && config.apiKey ? '当前路径：Jev 优先，失败或不确定时回到 BYND Agent' : '当前路径：BYND 内置 Agent（未启用 Jev）';
        renderLog();
    }

    function saveSettings() {
        const root = document.getElementById('bynd-jev-settings');
        if (!root) return;
        const enabled = root.querySelector('#bynd-jev-enabled').checked;
        const apiKey = root.querySelector('#bynd-jev-key').value.trim();
        const status = root.querySelector('#bynd-jev-status');
        if (enabled && !apiKey) { status.textContent = '启用 Jev 前请填写密钥；未保存。'; return; }
        const scopes = Object.fromEntries(SCOPES.map(scope => [scope, root.querySelector(`[data-jev-scope="${scope}"]`)?.checked !== false]));
        const thresholdInput = root.querySelector('#bynd-jev-threshold');
        const minProbability = thresholdInput ? Number(thresholdInput.value) / 100 : read().minProbability;
        try {
            write({ enabled, apiKey, scopes, minProbability });
            status.textContent = enabled ? '已保存。Jev 不可用或把握不足时会自动沿用 BYND 决策。' : '已保存。当前只使用 BYND 内置 Agent 决策。';
            renderSettings();
        } catch (error) { status.textContent = `保存失败：${error.message}`; }
    }

    async function testSettings() {
        const root = document.getElementById('bynd-jev-settings');
        if (!root) return;
        const status = root.querySelector('#bynd-jev-status');
        const button = root.querySelector('#bynd-jev-test');
        button.disabled = true;
        status.textContent = '正在测试 Jev 连接；此操作会消耗一次调用。';
        try { await testConnection(root.querySelector('#bynd-jev-key').value); status.textContent = '连接成功。点击“保存设置”才会启用。'; }
        catch (error) { status.textContent = `连接失败：${error.name === 'AbortError' ? '请求超时' : error.message}。BYND 原有决策仍可使用。`; }
        finally { button.disabled = false; }
    }

    function previewThreshold(value) {
        const label = typeof document !== 'undefined' ? document.getElementById('bynd-jev-threshold-value') : null;
        if (label) label.textContent = `${Math.round(Number(value) || 0)}%`;
    }

    window.ByndJev = { read, write, available, ask, choose, request, testConnection, renderSettings, saveSettings, testSettings, previewThreshold, readLog, logDecision, renderLog, storageKey: STORAGE_KEY, logKey: LOG_KEY, scopes: SCOPES.slice() };
})();
