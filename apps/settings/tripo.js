(function () {
    'use strict';
    const storageKey = 'bynd_tripo_private_v1';
    const defaultUrl = 'https://openapi.tripo3d.ai/v3';
    const relay = 'https://bynd.ccwu.cc/mcp/relay/tripo/v3/account/balance';
    const el = id => document.getElementById('tripo-' + id);
    let revision = 0, pending = false;

    function normalize(value) {
        const baseUrl = String(value?.baseUrl || defaultUrl).trim().replace(/\/+$/, '');
        let url;
        try { url = new URL(baseUrl); } catch (_) { throw new Error('请填写有效的 HTTPS API 地址。'); }
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
            throw new Error('API 地址须使用 HTTPS，不能包含密码、查询参数或片段。');
        if (url.hostname === 'openapi.tripo3d.ai' && url.pathname !== '/v3')
            throw new Error('Tripo 官方地址请使用 https://openapi.tripo3d.ai/v3。');
        if (url.hostname === 'api.tripo3d.ai') throw new Error('请使用 Tripo v3 地址：https://openapi.tripo3d.ai/v3。');
        const apiKey = String(value?.apiKey || '').trim();
        if (/\s/.test(apiKey)) throw new Error('API Key 不能含有空格或换行，请只粘贴密钥。');
        return { baseUrl: url.href.replace(/\/+$/, ''), apiKey };
    }
    function read() {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return { baseUrl: defaultUrl, apiKey: '' };
        let value;
        try { value = JSON.parse(raw); } catch (_) { throw new Error('3D 连接设置无法读取，原数据已保留。请重新填写后保存。'); }
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('3D 连接设置格式错误，原数据已保留。');
        return normalize(value);
    }
    function write(value) {
        const config = normalize(value);
        if (!config.apiKey) throw new Error('请填写你自己的 Tripo API Key。');
        // Commit before reporting success. This secret never enters my_api_data or home saves.
        localStorage.setItem(storageKey, JSON.stringify(config));
        return config;
    }
    function draft() { return { baseUrl: el('url')?.value, apiKey: el('key')?.value }; }
    function status(message, error = false) {
        const node = el('status');
        if (node) { node.textContent = message; node.dataset.error = String(error); }
    }
    function renderSettings() {
        if (!el('url')) return;
        revision++;
        el('key').type = 'password';
        el('show').textContent = '显示'; el('show').setAttribute('aria-pressed', 'false');
        try {
            const config = read();
            el('url').value = config.baseUrl; el('key').value = config.apiKey;
            status(config.apiKey ? '已保存个人密钥；可测试连接。' : '填写你自己的 Tripo API Key。');
        } catch (error) { status(error.message, true); }
    }
    function saveSettings() {
        revision++;
        try { write(draft()); status('已保存到当前设备。'); }
        catch (_) { status('保存失败。请检查 API 地址、密钥或设备存储，原设置未更改。', true); }
    }
    function clearSettings() {
        revision++;
        try { localStorage.removeItem(storageKey); renderSettings(); status('已清除当前设备的 Tripo 密钥。'); }
        catch (_) { status('清除失败，原设置仍保留，请重试。', true); }
    }
    function toggleKey() {
        const visible = el('key').type === 'password';
        el('key').type = visible ? 'text' : 'password';
        el('show').textContent = visible ? '隐藏' : '显示';
        el('show').setAttribute('aria-pressed', String(visible));
    }
    async function testConnection(value) {
        const config = normalize(value);
        if (!config.apiKey) throw new Error('请先填写 Tripo API Key。');
        const official = config.baseUrl === defaultUrl;
        const url = official ? relay : config.baseUrl + '/account/balance';
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(url, { method: 'GET', headers: { Authorization: 'Bearer ' + config.apiKey, Accept: 'application/json' }, signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) throw new Error('密钥无效或没有 API 权限，请在 Tripo 开发者控制台检查。');
                if (official && response.status === 404) throw new Error('Tripo 转发接口尚未部署，设置可以保存，连接暂不可用。');
                throw new Error('连接失败（HTTP ' + response.status + '），请稍后重试。');
            }
            let result;
            try { result = await response.json(); } catch (_) { throw new Error('接口没有返回有效 JSON，请检查 API 地址。'); }
            if (result?.code !== 0) throw new Error('Tripo 返回失败，请检查密钥、权限和 API 账户。');
            if (typeof result.data?.balance !== 'number' || !Number.isFinite(result.data.balance) || result.data.balance < 0)
                throw new Error('接口未返回有效余额，不能确认连接成功。');
            return { balance: result.data.balance };
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('连接超时，请重试。');
            if (error instanceof TypeError) {
                // A missing relay rejects the authenticated CORS preflight, hiding its 404.
                // Probe without the user's key so that missing service is reported accurately.
                if (official && !controller.signal.aborted) {
                    let missing = false;
                    try {
                        const probe = await fetch(relay, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
                        missing = probe.status === 404;
                    } catch (_) { /* A failed unauthenticated probe cannot establish service availability. */ }
                    if (missing) throw new Error('Tripo 连接服务尚未上线，密钥可保留，暂时无法测试。');
                }
                if (controller.signal.aborted) throw new Error('连接超时，请重试。');
                throw new Error('网络或跨域连接失败，请检查网络和转发地址。');
            }
            // Never surface raw upstream bodies or echoed credentials.
            throw new Error(String(error.message || '连接失败。').split(config.apiKey).join('[密钥已隐藏]'));
        } finally { clearTimeout(timeout); }
    }
    async function testSettings() {
        if (pending) return;
        pending = true;
        const current = ++revision;
        el('test').disabled = true;
        status('正在查询 Tripo API 余额…');
        try {
            const result = await testConnection(draft());
            if (current === revision) status(result.balance === 0 ? '连接成功 · API 余额 0（暂无生成额度）。' : '连接成功 · 可用 ' + result.balance.toLocaleString('zh-CN') + ' 积分。');
        } catch (error) { if (current === revision) status(error.message, true); }
        finally { pending = false; el('test').disabled = false; }
    }
    function changed() { revision++; status('设置已修改，保存后在当前设备生效。'); }
    window.ByndTripo = { storageKey, defaultUrl, read, write, normalize, renderSettings, saveSettings, clearSettings, toggleKey, testConnection, testSettings, changed };
})();
