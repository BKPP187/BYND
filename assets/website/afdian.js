(function () {
    'use strict';
    if (!['https:', 'http:'].includes(location.protocol)) return;
    const $ = id => document.getElementById(id), root = '/license/v1/pay/afdian/';
    let timer, active = false, busy = false, failures = 0, epoch = 0, previousOrders = null;
    const callback = new URL(location.href).searchParams;
    const code = callback.get('code'), oauthState = callback.get('state');
    // Do not retain OAuth credentials in history or pass them to other sites.
    if (code || oauthState) history.replaceState(null, '', location.pathname);
    const api = (route, body) => ByndSiteApi.request(root + route, { body, headers: { 'X-BYND-Payment': '1' } });
    function say(text) { $('afdian-status').textContent = text; }
    function providerUrl(value, path) {
        const url = new URL(value);
        if (url.origin !== 'https://afdian.com' || url.username || url.password || (path && url.pathname !== path)) throw Error('付款地址无效。');
        return url.href;
    }
    function stop() { clearTimeout(timer); }
    async function refresh() {
        if (!active || busy || document.hidden) return;
        busy = true; const generation = epoch;
        try {
            const data = await api('status'); if (generation !== epoch) return;
            $('payment-login').hidden = true;
            $('afdian-link').hidden = data.linked; $('afdian-buy').hidden = !data.linked;
            if (data.purchaseUrl) $('afdian-buy').href = providerUrl(data.purchaseUrl);
            const receipts = $('afdian-receipts'); receipts.replaceChildren();
            let nextReceipt = null;
            for (const order of data.orders) {
                const link = document.createElement('a'); link.className = 'plain-button';
                const url = new URL(order.receiptUrl || 'account.html', location.href);
                if (url.origin !== location.origin || !['/license-receipt.html','/account.html'].includes(url.pathname)) throw Error('领取地址无效。');
                link.href = url.href; link.textContent = '领取激活码 · ' + order.orderNo; receipts.append(link);
                if (order.receiptUrl && previousOrders && !previousOrders.has(order.orderNo)) nextReceipt = url.href;
            }
            previousOrders = new Set(data.orders.map(order => order.orderNo));
            if (nextReceipt) { active = false; location.assign(nextReceipt); return; }
            say(data.orders.length ? '已核验的授权已保存到账号，点击领取即可。' : data.linked ? '尚未查到已发放的授权；付款后会自动刷新，也可以输入订单号核对。' : '先关联爱发电付款账号，再去购买。');
            failures = 0;
        } catch (error) {
            if (generation !== epoch) return;
            failures++; $('afdian-receipts').replaceChildren(); $('afdian-buy').hidden = true;
            say(error.message || '暂时无法确认到账，请稍后重试。');
            if (error.status === 401) active = false;
        } finally {
            busy = false; stop();
            if (active && failures < 3 && !document.hidden) timer = setTimeout(refresh, 10000);
        }
    }
    $('afdian-link').onclick = async () => {
        $('afdian-link').disabled = true;
        try { const data = await api('link', {}); location.assign(providerUrl(data.url, '/oauth2/authorize')); }
        catch (error) { say(error.message); } finally { $('afdian-link').disabled = false; }
    };
    $('afdian-refresh').onclick = () => { failures = 0; void refresh(); };
    $('afdian-check-form').onsubmit = async event => {
        event.preventDefault(); const button = event.submitter; button.disabled = true;
        try { const result = await api('check', { orderNo: $('afdian-order-no').value.trim() }); say(result.message); await refresh(); }
        catch (error) { say(error.message); } finally { button.disabled = false; }
    };
    document.addEventListener('visibilitychange', () => {
        stop(); epoch++; $('afdian-receipts').replaceChildren();
        if (!document.hidden) void refresh();
    });
    async function init() {
        try {
            const config = await api('config'); if (!config.saleOpen) return;
            $('afdian-payment').hidden = false;
            $('payment-start').hidden = true; $('payment-status').hidden = true;
            document.querySelector('.refund-notice').hidden = true; $('refund-policy').hidden = true;
            $('payment-art-title').textContent = '给喜欢，留个位置';
            $('payment-art-note').textContent = '通过爱发电完成付款，授权会保存在你的账号。';
            $('payment-art-badge').textContent = '永久授权 · ¥13.88';
            if (code && oauthState) await api('callback', { code, state: oauthState });
            active = true; await refresh();
        } catch (error) { $('afdian-payment').hidden = false; say(error.message || '暂时无法连接付款服务。'); }
    }
    void init();
})();
