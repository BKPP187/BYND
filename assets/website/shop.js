(function () {
    'use strict';
    if (!['http:', 'https:'].includes(location.protocol)) return;
    const button = document.querySelector('.purchase-button'), download = document.querySelector('.download-row button');
    const status = document.getElementById('shop-status');
    async function load() {
        try {
            const data = await ByndSiteApi.request('/distribution/v1/store');
            document.querySelector('.price-row strong').textContent = data.priceLabel && data.priceLabel !== '待公布' ? data.priceLabel : '¥13.88';
            if (data.saleOpen && data.purchaseUrl) {
                const url = new URL(data.purchaseUrl);
                if (url.protocol !== 'https:' || url.username || url.password) throw new Error('购买入口地址无效。');
                button.disabled = false; button.textContent = '购买 BYND ↗';
                button.onclick = () => { location.href = url.href; };
                document.querySelector('.status-badge').textContent = '正式开售';
                document.querySelector('.ticket-footnote').textContent = '按购买页面说明完成付款与领取。';
            }
            if (data.download) {
                const address = ByndSiteApi.downloadUrl(data.download.url);
                document.querySelector('.download-row div span').textContent = 'v' + data.download.versionName + ' · ' + (data.download.size / 1024 / 1024).toFixed(1) + ' MB';
                download.disabled = false; download.removeAttribute('aria-label');
                download.onclick = () => { void ByndSiteApi.beginDownload(address, data.download, status, download); };
                status.textContent = data.saleOpen ? '已购买？下载安装后按应用提示激活。' : 'Android 安装包已准备好，目前尚未开售。安装后按应用内提示使用。';
            } else status.textContent = 'Android 下载入口会在安装包准备好后开放。';
        } catch (error) {
            status.textContent = '暂时无法读取下载信息。' + error.message;
            document.getElementById('shop-retry').hidden = false;
        }
    }
    document.getElementById('shop-retry').onclick = () => { document.getElementById('shop-retry').hidden = true; void load(); };
    void load();
})();
