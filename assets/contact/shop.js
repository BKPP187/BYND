(function () {
    'use strict';
    if (!['http:', 'https:'].includes(location.protocol)) return;
    const download = document.querySelector('.download-row button');
    const status = document.getElementById('shop-status');
    async function load() {
        try {
            const data = await ByndSiteApi.request('/distribution/v1/store');
            document.querySelector('.price-row strong').textContent = data.priceLabel && data.priceLabel !== '待公布' ? data.priceLabel : '¥13.88';
            if (data.download) {
                const address = ByndSiteApi.downloadUrl(data.download.url);
                document.querySelector('.download-row div span').textContent = 'v' + data.download.versionName + ' · ' + (data.download.size / 1024 / 1024).toFixed(1) + ' MB';
                download.disabled = false; download.removeAttribute('aria-label');
                download.onclick = () => { void ByndSiteApi.beginDownload(address, data.download, status, download); };
                status.textContent = 'Android 安装包已准备好。购买与授权问题请联系 QQ。';
            } else status.textContent = 'Android 下载入口会在安装包准备好后开放。';
        } catch (error) {
            status.textContent = '暂时无法读取下载信息。' + error.message;
            document.getElementById('shop-retry').hidden = false;
        }
    }
    document.getElementById('shop-retry').onclick = () => { document.getElementById('shop-retry').hidden = true; void load(); };
    void load();
})();
