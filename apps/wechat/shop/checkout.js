function selectWechatShopPayer(payerId) {
    const input = document.getElementById('wc-shop-payer');
    if (input) input.value = payerId || 'self';
    document.querySelectorAll('.wc-shop-payer-picker button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.payerId === String(payerId || 'self'));
    });
}
window.selectWechatShopPayer = selectWechatShopPayer;

function appendWechatShoppingContextRecord(order, kind = 'shop') {
    const store = getWechatShopStore();
    store.recentContext = Array.isArray(store.recentContext) ? store.recentContext : [];
    const label = kind === 'takeout' ? '外卖' : '购物';
    store.recentContext.unshift({
        id: order.id || `${kind}_${Date.now()}`,
        kind,
        text: `${label}：${order.summary || getWechatShopCartSummary(order.items || []) || order.shopName || ''}，合计 ¥${Number(order.total || 0).toFixed(2)}`,
        payer: order.payer || 'self',
        createdAt: order.createdAt || Date.now()
    });
    store.recentContext = store.recentContext.slice(0, 12);
    saveWechatShopStore(store);
}

function sendWechatShopPayRequest(charId, order) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    sendWechatMessageToChar(charId, {
        type: 'share_card',
        isMe: true,
        card: {
            action: 'shop_pay',
            title: '帮我代付这单',
            text: getWechatShopCartSummary(order.items || []),
            source: 'BYND 购物',
            order
        }
    });
}

function checkoutWechatShop() {
    const store = getWechatShopStore();
    if (!store.cart.length) return;
    const address = (document.getElementById('wc-shop-address')?.value || '').trim();
    if (!address) {
        alert('先填写收货地址');
        return;
    }
    const payer = document.getElementById('wc-shop-payer')?.value || 'self';
    const total = getWechatShopCartTotal(store);
    const summary = getWechatShopCartSummary(store.cart);
    const order = { id: 'ord_' + Date.now(), items: store.cart.map(item => ({ ...item })), address, total, payer, createdAt: Date.now() };
    store.orders.push(order);
    store.lastAddress = address;
    store.lastPayer = payer;
    store.cart = [];
    saveWechatShopStore(store);
    appendWechatShoppingContextRecord({ ...order, summary }, 'shop');
    if (payer === 'self') {
        showWechatToast('订单已提交，已选择自己付款');
        renderWechatShop('me');
        return;
    }
    sendWechatShopPayRequest(payer, { ...order, summary });
    renderWechatShop('me');
}

