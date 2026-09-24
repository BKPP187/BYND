/* Optional TypeSafe Jev decisions. BYND's existing agent remains the fallback. */
(function () {
    'use strict';

    const STORAGE_KEY = 'bynd_jev_config_v1';
    const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
    const PROXY_ENDPOINT = typeof location !== 'undefined' && location.hostname === 'bynd.ccwu.cc'
        ? `${location.origin}/jev/v1/systemone`
        : 'https://bynd-push.myluckylxy.workers.dev/jev/v1/systemone';
    const SCOPES = ['moment', 'momentEngagement', 'forumAction', 'forumReply', 'profile'];
    const defaults = () => ({ enabled: false, apiKey: '', scopes: Object.fromEntries(SCOPES.map(scope => [scope, true])) });

    function read() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!saved || typeof saved !== 'object') return defaults();
            return { enabled: saved.enabled === true, apiKey: String(saved.apiKey || ''), scopes: { ...defaults().scopes, ...(saved.scopes || {}) } };
        } catch (_) { return defaults(); }
    }

    function write(config) {
        const next = { enabled: config.enabled === true, apiKey: String(config.apiKey || '').trim(), scopes: Object.fromEntries(SCOPES.map(scope => [scope, config.scopes?.[scope] !== false])) };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
    }

    function available(scope) {
        const config = read();
        return SCOPES.includes(scope) && config.enabled && !!config.apiKey && config.scopes[scope] !== false;
    }

    async function request(apiKey, state, question, timeoutMs = 8000) {
        const payload = JSON.stringify({ model: 'jev-latest', state, questions: { decision: question } });
        if (payload.length > 30000) throw new Error('Jev 决策上下文过长');
        for (const endpoint of [ENDPOINT, PROXY_ENDPOINT]) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: payload,
                    signal: controller.signal
                });
                if (!response.ok) throw new Error(endpoint === PROXY_ENDPOINT && response.status === 404 ? 'Jev 转发服务尚未上线（HTTP 404），不是密钥格式问题' : `Jev HTTP ${response.status}`);
                const data = await response.json();
                try { window.ByndUsageLedger?.record({ feature: 'jev', provider: endpoint, apiName: 'Jev', model: 'jev-latest', usage: data?.usage || null, ok: !!data?.answers?.decision, ticket: null, source: null }); } catch (_) {}
                if (!data || typeof data !== 'object' || !data.answers?.decision) throw new Error('Jev 没有返回有效决策');
                return data.answers.decision;
            } catch (error) {
                if (endpoint === PROXY_ENDPOINT || (error?.name !== 'TypeError' && error?.name !== 'AbortError')) throw error;
            } finally { clearTimeout(timer); }
        }
        throw new Error('Jev 连接失败');
    }

    async function choose(scope, state, instructions, criteria) {
        if (!available(scope)) return null;
        const options = Object.keys(criteria || {});
        if (options.length < 2) return null;
        try {
            const answer = await request(read().apiKey, state, { type: 'choice', instructions, criteria });
            return answer.type === 'choice' && options.includes(answer.choice) ? answer.choice : null;
        } catch (error) {
            console.warn('Jev 决策不可用，沿用 BYND 角色决策：', error?.message || error);
            return null;
        }
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

    function renderSettings() {
        const root = document.getElementById('bynd-jev-settings');
        if (!root) return;
        const config = read();
        root.querySelector('#bynd-jev-enabled').checked = config.enabled;
        root.querySelector('#bynd-jev-key').value = config.apiKey;
        SCOPES.forEach(scope => { const input = root.querySelector(`[data-jev-scope="${scope}"]`); if (input) input.checked = config.scopes[scope] !== false; });
    }

    function saveSettings() {
        const root = document.getElementById('bynd-jev-settings');
        if (!root) return;
        const enabled = root.querySelector('#bynd-jev-enabled').checked;
        const apiKey = root.querySelector('#bynd-jev-key').value.trim();
        const status = root.querySelector('#bynd-jev-status');
        if (enabled && !apiKey) { status.textContent = '启用 Jev 前请填写密钥；未保存。'; return; }
        const scopes = Object.fromEntries(SCOPES.map(scope => [scope, root.querySelector(`[data-jev-scope="${scope}"]`)?.checked !== false]));
        try { write({ enabled, apiKey, scopes }); status.textContent = enabled ? '已保存。Jev 不可用时会自动沿用 BYND 决策。' : '已保存。当前只使用 BYND 决策。'; }
        catch (error) { status.textContent = `保存失败：${error.message}`; }
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

    window.ByndJev = { read, write, available, choose, testConnection, renderSettings, saveSettings, testSettings, storageKey: STORAGE_KEY };
})();
