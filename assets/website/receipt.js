(function () {
    'use strict';
    let token = location.hash.slice(1);
    const status = document.getElementById('receipt-status'), input = document.getElementById('receipt-code');
    // Tab-scoped storage supports a reload. If storage is blocked, keep the original
    // fragment: fragments never go to the server or into HTTP Referer headers.
    try {
        if (token) sessionStorage.setItem('bynd_receipt_token_v1', token);
        else token = sessionStorage.getItem('bynd_receipt_token_v1') || '';
        if (sessionStorage.getItem('bynd_receipt_token_v1') === token) history.replaceState(null, '', location.pathname + location.search);
    } catch { }
    let code = '';
    async function load() {
        document.getElementById('receipt-content').hidden = true;
        document.getElementById('receipt-retry').hidden = true;
        if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { status.textContent = '请使用你收到的完整领取链接。链接丢失时，请联系支持重新领取。'; return; }
        status.textContent = '正在读取你的激活码…';
        try {
            const data = await ByndSiteApi.request('/license/v1/receipt', { body: { token } });
            if (!/^BYND(?:-[0-9A-F]{4}){8}$/.test(data.licenseKey || '')) throw new Error('激活码内容无效，请联系支持。');
            code = data.licenseKey; input.value = code;
            document.getElementById('receipt-content').hidden = false;
            status.textContent = '这是只属于你的激活码，请妥善保存。';
            if (data.download) {
                const link = document.getElementById('receipt-download'); link.href = ByndSiteApi.downloadUrl(data.download.url); link.hidden = false;
                link.onclick = event => { event.preventDefault(); void ByndSiteApi.beginDownload(link.href, data.download, status); };
                document.getElementById('receipt-download-info').textContent = 'Android · v' + data.download.versionName;
            } else document.getElementById('receipt-download-info').textContent = '安装包尚未开放下载，你可以先保存激活码。';
        } catch (error) { status.textContent = error.message; document.getElementById('receipt-retry').hidden = error.status === 403; }
    }
    document.getElementById('receipt-copy').onclick = () => { void ByndSiteApi.copy(code, input, status); };
    document.getElementById('receipt-save').onclick = () => {
        try { ByndSiteApi.saveText('BYND-永久激活码.txt', 'BYND 永久激活码\n\n' + code + '\n\n请妥善保存。首次激活需要联网，之后本机可离线验证。换机请联系支持。\n'); }
        catch { status.textContent = '保存文件失败，请复制激活码后手动保存。'; }
    };
    document.getElementById('receipt-retry').onclick = () => { void load(); };
    void load();
})();
