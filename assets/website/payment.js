(function () {
    'use strict';
    if (!['http:', 'https:'].includes(location.protocol)) return;
    const $ = id => document.getElementById(id), uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const state = { user: null, order: null, ready: false, creating: false, checking: false, epoch: 0, timer: null, failures: 0, requestId: crypto.randomUUID() };
    const names = { pending: '等待支付宝确认付款', issued: '测试付款已核验 · 激活码已保存到账号', closed: '测试订单已关闭，未发放激活码', refunded: '测试订单已退款，测试激活码已停用' };
    const refundPolicy = $('refund-policy');
    function openRefundPolicy() { if (location.hash === '#refund-policy') refundPolicy.open = true; }
    openRefundPolicy(); window.addEventListener('hashchange', openRefundPolicy);
    function message(text) { $('payment-status').textContent = text; }
    function clearCode() { $('payment-license').hidden = true; $('payment-code').value = ''; }
    function stop() { clearTimeout(state.timer); state.timer = null; }
    async function api(route, body) {
        const epoch = state.epoch, response = await ByndSiteApi.request('/payment/v1/' + route, { body, headers: { 'X-BYND-Payment': '1' } });
        if (epoch !== state.epoch) throw new Error('页面状态已变化，请重新操作。'); return response;
    }
    function paymentAddress(value) {
        const url = new URL(value);
        if (url.origin !== 'https://openapi-sandbox.dl.alipaydev.com' || url.pathname !== '/gateway.do' || url.username || url.password || url.hash) throw new Error('测试支付地址无效。');
        return url.href;
    }
    function render(order) {
        if (!order || !uuid.test(order.id) || order.mode !== 'sandbox' || ![1280, 1288, 1388].includes(order.amountFen) || !Object.hasOwn(names, order.state)) throw new Error('测试订单信息无效。');
        state.order = order; $('payment-order').hidden = false; $('payment-order-number').textContent = '测试订单 · ' + order.orderNo + ' · ¥' + (order.amountFen / 100).toFixed(2);
        $('payment-order-state').textContent = names[order.state]; $('payment-check').disabled = false;
        $('payment-new').hidden = order.state === 'pending' && order.expiresAt > Date.now() / 1000;
        $('payment-start').disabled = true; $('payment-start').textContent = order.state === 'issued' ? '已领取测试授权' : '当前已有测试订单';
        if (order.state !== 'pending') { stop(); $('payment-cashier').hidden = true; $('payment-cashier').removeAttribute('href'); }
        if (order.state !== 'issued') clearCode();
        $('payment-art-title').textContent = order.state === 'issued' ? '测试授权已送达 ♡' : order.state === 'pending' ? '等一个支付结果' : '这笔测试已结束';
        $('payment-art-note').textContent = order.state === 'issued' ? '回到账号，也能找到它。' : '仅模拟测试，不收取真钱。';
    }
    async function reveal(order) {
        const epoch = state.epoch;
        const data = await ByndSiteApi.request('/account/v1/licenses/' + order.licenseId + '/code', { body: {}, headers: { 'X-BYND-Account': '1' } });
        if (epoch !== state.epoch) return;
        if (!/^BYND(?:-[0-9A-F]{4}){8}$/.test(data.licenseKey || '')) throw new Error('测试激活码暂时无法读取，请在账号页查看。');
        $('payment-code').value = data.licenseKey; $('payment-license').hidden = false;
    }
    function schedule() {
        stop(); if (state.order?.state === 'pending' && state.failures < 3 && !document.hidden) state.timer = setTimeout(() => { void check(); }, 7000);
    }
    async function check() {
        if (!state.order || state.checking || !state.user) return;
        state.checking = true; $('payment-check').disabled = true;
        try {
            const data = await api('orders/' + state.order.id + '/check', {}); render(data.order); state.failures = 0;
            if (data.order.state === 'issued') { await reveal(data.order); message('支付宝沙箱付款已核验，测试激活码已自动保存到你的账号。'); }
            else if (data.order.state === 'pending') message(data.providerState === 'NOT_CREATED' ? '尚未发现付款记录。打开测试收银台完成模拟付款后，再来查询。' : '尚未确认付款，不会发放激活码。');
            else message(names[data.order.state]);
        } catch (error) { state.failures++; clearCode(); message(error.message || '付款结果尚未确认，请稍后重新查询，不要重复付款。'); }
        finally { state.checking = false; $('payment-check').disabled = false; schedule(); }
    }
    $('payment-start').onclick = async () => {
        if (!state.ready || !state.user || state.creating || state.order) return;
        state.creating = true; $('payment-start').disabled = true;
        try {
            const data = await api('orders', { requestId: state.requestId }); render(data.order);
            if (data.paymentUrl) { $('payment-cashier').href = paymentAddress(data.paymentUrl); $('payment-cashier').hidden = false; }
            history.replaceState(null, '', location.pathname + '?order=' + encodeURIComponent(data.order.id));
            message('测试订单已创建。请打开支付宝测试收银台，使用沙箱买家账号模拟付款。'); schedule();
        } catch (error) { message(error.message || '创建失败，请重试。'); if (!state.order) $('payment-start').disabled = false; }
        finally { state.creating = false; }
    };
    $('payment-check').onclick = () => { state.failures = 0; void check(); };
    $('payment-new').onclick = () => {
        if (!state.ready || !state.user || state.checking || state.creating) return;
        stop(); clearCode(); state.order = null; state.requestId = crypto.randomUUID(); state.failures = 0;
        $('payment-order').hidden = true; $('payment-start').textContent = '创建 ¥13.88 测试订单'; $('payment-start').disabled = false;
        history.replaceState(null, '', location.pathname); message('准备好后，可以创建下一笔模拟订单。');
    };
    $('payment-copy').onclick = () => { if ($('payment-code').value) void ByndSiteApi.copy($('payment-code').value, $('payment-code'), $('payment-status')); };
    async function connect() {
        const epoch = ++state.epoch; stop(); clearCode(); state.ready = false; state.user = null; state.order = null;
        $('payment-order').hidden = true; $('payment-start').disabled = true; $('payment-cashier').hidden = true; $('payment-cashier').removeAttribute('href');
        try {
            const config = await api('config'); if (config.mode !== 'sandbox') return;
            $('payment-environment').hidden = false; $('payment-art-badge').textContent = '沙箱测试';
            $('payment-art-title').textContent = '先试着，把喜欢带回家'; $('payment-art-note').textContent = '模拟支付，不收取真钱。';
            document.querySelector('.payment-art').setAttribute('aria-label', '支付宝沙箱测试窗口，不收取真钱');
            const me = await ByndSiteApi.request('/account/v1/me'); if (epoch !== state.epoch) return;
            $('payment-login').hidden = !!me.user; $('payment-identity').hidden = !me.user;
            if (!me.user) { $('payment-start').textContent = '登录后开始沙箱测试'; message('先登录并验证测试账号的邮箱，再回到这里。'); return; }
            state.user = me.user; state.ready = true; $('payment-identity').textContent = '测试账号 · ' + me.user.email;
            $('payment-start').textContent = '创建 ¥13.88 测试订单'; $('payment-start').disabled = false;
            const requested = new URL(location.href).searchParams.get('order');
            const saved = uuid.test(requested || '') ? (await api('orders/' + requested)).order : (await api('orders')).orders[0];
            if (saved) {
                render(saved);
                if (saved.state === 'issued') { await reveal(saved); message('已核验的测试激活码在这里，也已保存在账号中。'); }
                else if (saved.state === 'pending') {
                    // Resume the original server order; never create a second bill after a lost tab.
                    const data = await api('orders/' + saved.id);
                    if (data.paymentUrl) { $('payment-cashier').href = paymentAddress(data.paymentUrl); $('payment-cashier').hidden = false; }
                    message('已恢复你的测试订单，正在等待后端核验付款。'); schedule();
                } else message(names[saved.state]);
            } else message('这里只进行模拟支付。正式购买入口仍然关闭。');
        } catch (error) { if (epoch === state.epoch) { clearCode(); message(state.ready || !$('payment-environment').hidden ? (error.message || '暂时无法读取测试支付信息。') : '付款入口准备中，目前不收款。'); } }
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); clearCode(); } else void connect(); });
    window.addEventListener('pagehide', () => { state.epoch++; stop(); clearCode(); });
    window.addEventListener('pageshow', event => { if (event.persisted) void connect(); });
    void connect();
})();
