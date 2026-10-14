(function () {
    'use strict';
    async function request(route, { body, token, headers: additionalHeaders = {}, method = body === undefined ? 'GET' : 'POST' } = {}) {
        const headers = { 'Content-Type': 'application/json', ...additionalHeaders };
        if (token) headers.Authorization = 'Bearer ' + token;
        let response;
        try { response = await fetch(route, { method, headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000), body: body === undefined ? undefined : JSON.stringify(body) }); }
        catch { throw new Error('网络连接失败，请检查网络后重试。'); }
        let data;
        try { data = await response.json(); }
        catch { throw new Error('服务器返回了无效结果，请稍后重试。'); }
        if (!response.ok) {
            const error = new Error(data.message || '操作失败，请稍后重试。'); error.code = data.code; error.status = response.status; throw error;
        }
        return data;
    }
    function downloadUrl(value) {
        const url = new URL(value, location.href);
        if (url.username || url.password || !url.pathname.endsWith('.apk') || !(url.protocol === 'https:' || (url.origin === location.origin && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('下载地址无效，请稍后重试。');
        return url.href;
    }
    async function copy(value, input, status) {
        try { await navigator.clipboard.writeText(value); status.textContent = '已复制，请妥善保存。'; }
        catch { if (input) { input.focus(); input.select(); } status.textContent = '无法自动复制，请长按或选中后手动复制。'; }
    }
    function saveText(name, value) {
        const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function beginDownload(address, metadata, status, button) {
        const url = new URL(downloadUrl(address));
        if (button) button.disabled = true;
        try {
            if (url.origin === location.origin) {
                const response = await fetch(url, { method: 'HEAD', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
                if (!response.ok || !String(response.headers.get('content-type')).startsWith('application/vnd.android.package-archive') || Number(response.headers.get('content-length')) !== metadata.size) throw new Error('安装包暂时无法下载，请稍后重试。');
            }
            location.href = url.href;
        } catch (error) { status.textContent = error.message || '下载连接失败，请检查网络后重试。'; }
        finally { if (button) button.disabled = false; }
    }
    window.ByndSiteApi = { request, copy, saveText, downloadUrl, beginDownload };
})();
