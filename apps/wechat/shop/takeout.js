const WECHAT_TAKEOUT_RESTAURANTS = [
    { id: 'noodle', name: '蓝骑士牛肉面', tag: '面馆', score: 4.8, time: '28分钟', fee: 3, gradient: 'linear-gradient(135deg,#e8f3ff,#1677ff)', dishes: [
        { id: 'n1', name: '番茄牛腩面', price: 24.8 }, { id: 'n2', name: '溏心蛋', price: 4 }, { id: 'n3', name: '冰豆浆', price: 7 }
    ]},
    { id: 'tea', name: '月光奶茶研究所', tag: '奶茶甜品', score: 4.7, time: '22分钟', fee: 2, gradient: 'linear-gradient(135deg,#fff7ed,#fb923c)', dishes: [
        { id: 't1', name: '茉莉奶绿', price: 16 }, { id: 't2', name: '芋泥波波', price: 19 }, { id: 't3', name: '芝士草莓', price: 22 }
    ]},
    { id: 'rice', name: '轻食便当局', tag: '便当轻食', score: 4.9, time: '35分钟', fee: 4, gradient: 'linear-gradient(135deg,#f0fdf4,#22c55e)', dishes: [
        { id: 'r1', name: '照烧鸡腿饭', price: 29.9 }, { id: 'r2', name: '虾仁沙拉', price: 32 }, { id: 'r3', name: '味噌汤', price: 6 }
    ]},
    { id: 'hotpot', name: '深夜麻辣烫', tag: '夜宵', score: 4.6, time: '31分钟', fee: 5, gradient: 'linear-gradient(135deg,#fff1f2,#ef4444)', dishes: [
        { id: 'h1', name: '自选麻辣烫套餐', price: 35 }, { id: 'h2', name: '肥牛加份', price: 12 }, { id: 'h3', name: '酸梅汤', price: 8 }
    ]}
];

function getWechatTakeoutStore() {
    const store = readWechatStore(WECHAT_TAKEOUT_STORAGE_KEY, { cart: [], orders: [], customShops: [], images: {}, lastAddress: '', lastPayer: 'self' });
    store.cart = Array.isArray(store.cart) ? store.cart : [];
    store.orders = Array.isArray(store.orders) ? store.orders : [];
    store.customShops = Array.isArray(store.customShops) ? store.customShops : [];
    store.images = store.images && typeof store.images === 'object' ? store.images : {};
    store.lastAddress = typeof store.lastAddress === 'string' ? store.lastAddress : '';
    store.lastPayer = typeof store.lastPayer === 'string' ? store.lastPayer : 'self';
    return store;
}

function saveWechatTakeoutStore(store) {
    writeWechatStore(WECHAT_TAKEOUT_STORAGE_KEY, store);
}

function openWechatTakeout() {
    renderWechatTakeout('home');
}
window.openWechatTakeout = openWechatTakeout;

function normalizeWechatTakeoutShop(shop, index = 0) {
    if (!shop || typeof shop !== 'object') return null;
    const name = String(shop.name || shop.shopName || '').trim();
    if (!name) return null;
    const dishes = Array.isArray(shop.dishes) ? shop.dishes.map((dish, dishIndex) => {
        const dishName = String(dish && (dish.name || dish.title) || '').trim();
        if (!dishName) return null;
        return {
            id: String(dish.id || `dish_${index}_${dishIndex}_${dishName}`).replace(/\s+/g, '_'),
            name: dishName,
            price: Number(dish.price || dish.amount || 18 + dishIndex * 4) || 18,
            desc: String(dish.desc || dish.description || '').trim(),
            image: String(dish.image || dish.imageUrl || '').trim()
        };
    }).filter(Boolean) : [];
    return {
        ...shop,
        id: String(shop.id || `takeout_${index}_${name}`).replace(/\s+/g, '_'),
        name,
        tag: String(shop.tag || shop.category || '外卖').trim(),
        score: Number(shop.score || 4.7),
        time: String(shop.time || shop.deliveryTime || `${24 + index * 3}分钟`).trim(),
        fee: Number(shop.fee || shop.deliveryFee || 3) || 0,
        gradient: shop.gradient || getWechatGeneratedGradient(name + (shop.tag || '外卖'))[0],
        dishes
    };
}

function getWechatTakeoutRestaurants() {
    const store = getWechatTakeoutStore();
    const custom = (store.customShops || []).map((shop, index) => normalizeWechatTakeoutShop(shop, 100 + index)).filter(Boolean);
    return [...WECHAT_TAKEOUT_RESTAURANTS.map((shop, index) => normalizeWechatTakeoutShop(shop, index)).filter(Boolean), ...custom];
}

function getWechatTakeoutShop(shopId) {
    return getWechatTakeoutRestaurants().find(shop => String(shop.id) === String(shopId));
}

function getWechatTakeoutDish(shopId, dishId) {
    const shop = getWechatTakeoutShop(shopId);
    const dish = shop && shop.dishes.find(item => String(item.id) === String(dishId));
    return shop && dish ? { shop, dish } : null;
}

function getWechatTakeoutImageKey(shopId, dishId = '') {
    return `${shopId}::${dishId || 'shop'}`;
}

function getWechatTakeoutSavedImage(shopId, dishId = '') {
    const store = getWechatTakeoutStore();
    return store.images[getWechatTakeoutImageKey(shopId, dishId)] || '';
}

function renderWechatTakeoutTextCover(shop, dish = null, mode = '') {
    const title = dish ? dish.name : shop.name;
    const sub = dish ? shop.name : shop.tag;
    const image = dish ? (dish.image || getWechatTakeoutSavedImage(shop.id, dish.id)) : getWechatTakeoutSavedImage(shop.id);
    if (image) {
        return `<div class="wc-takeout-text-cover ${mode} has-image"><img src="${wcEscapeHtml(image)}" loading="lazy" onerror="this.closest('.wc-takeout-text-cover').classList.remove('has-image');this.remove()"></div>`;
    }
    return `
        <div class="wc-takeout-text-cover ${mode}" style="background:${shop.gradient || getWechatGeneratedGradient(title + sub)[0]}">
            <span>${wcEscapeHtml(shop.tag || '外卖')}</span>
            <strong>${wcEscapeHtml(title)}</strong>
            <em>${wcEscapeHtml(sub || 'BYND 外卖')}</em>
        </div>
    `;
}

function renderWechatTakeout(tab = 'home') {
    const store = getWechatTakeoutStore();
    const count = store.cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    const content = tab === 'cart' ? renderWechatTakeoutCart(store) : renderWechatTakeoutHome(store);
    openWechatFeatureScreen('外卖', `
        <div class="wc-takeout-app">
            <div class="wc-takeout-content">${content}</div>
            <div class="wc-takeout-tabbar">
                <button class="${tab === 'home' ? 'active' : ''}" onclick="renderWechatTakeout('home')"><i class="ri-store-2-line"></i><span>外卖</span></button>
                <button class="${tab === 'cart' ? 'active' : ''}" onclick="renderWechatTakeout('cart')"><i class="ri-shopping-basket-2-line"></i><span>购物车${count ? `(${count})` : ''}</span></button>
            </div>
        </div>
    `);
}

function renderWechatTakeoutHome() {
    const shops = getWechatTakeoutRestaurants();
    return `
        <section class="wc-takeout-hero">
            <div><span>ELE STYLE</span><strong>今天想吃什么</strong><p>附近好店、热卖小吃和角色代点都放在这里，想吃什么先丢进篮子。</p></div>
            <i class="ri-riding-line"></i>
        </section>
        <div class="wc-takeout-search"><i class="ri-search-line"></i><input placeholder="搜索商家、菜品"></div>
        <div class="wc-takeout-cats"><button class="active">全部</button><button>奶茶</button><button>夜宵</button><button>轻食</button><button>热卖</button></div>
        <details class="wc-takeout-ai-panel">
            <summary><span>AI 生成外卖店</span><em>先生成文字菜单，点菜品后再生成真实图片</em><i class="ri-arrow-down-s-line"></i></summary>
            <div>
                <input id="wc-takeout-ai-brief" placeholder="例如：雨夜适合两个人吃的热汤外卖">
                <button type="button" onclick="generateWechatTakeoutShop()">AI 生成</button>
            </div>
        </details>
        <div class="wc-takeout-list">
            ${shops.map(shop => `
                <article class="wc-takeout-shop" onclick="openWechatTakeoutShop(${quoteWechatJsString(shop.id)})">
                    ${renderWechatTakeoutTextCover(shop, null, 'shop')}
                    <div class="wc-takeout-main">
                        <div class="wc-takeout-title"><strong>${wcEscapeHtml(shop.name)}</strong><span>${wcEscapeHtml(shop.time)}</span></div>
                        <p>${wcEscapeHtml(shop.tag)} · ${shop.score} 分 · 配送 ¥${shop.fee}</p>
                        <div class="wc-takeout-dishes">
                            ${shop.dishes.map(dish => `<button onclick="event.stopPropagation();openWechatTakeoutDish(${quoteWechatJsString(shop.id)}, ${quoteWechatJsString(dish.id)})"><span>${wcEscapeHtml(dish.name)}</span><b>¥${dish.price.toFixed(2)}</b></button>`).join('')}
                        </div>
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

function openWechatTakeoutShop(shopId) {
    const shop = getWechatTakeoutShop(shopId);
    if (!shop) return;
    openWechatFeatureScreen('外卖店铺', `
        <div class="wc-takeout-app wc-takeout-detail-app">
            <div class="wc-takeout-content">
                <section class="wc-takeout-shop-detail-head">
                    ${renderWechatTakeoutTextCover(shop, null, 'detail')}
                    <div>
                        <span>${wcEscapeHtml(shop.tag)} · ${shop.score} 分</span>
                        <h3>${wcEscapeHtml(shop.name)}</h3>
                        <p>${wcEscapeHtml(shop.time)} · 配送 ¥${Number(shop.fee || 0).toFixed(0)} · 图片会在菜品详情里生成</p>
                    </div>
                </section>
                <div class="wc-takeout-detail-dishes">
                    ${shop.dishes.map(dish => `
                        <button type="button" onclick="openWechatTakeoutDish(${quoteWechatJsString(shop.id)}, ${quoteWechatJsString(dish.id)})">
                            ${renderWechatTakeoutTextCover(shop, dish, 'mini')}
                            <span><strong>${wcEscapeHtml(dish.name)}</strong><em>${wcEscapeHtml(dish.desc || shop.tag)}</em></span>
                            <b>¥${Number(dish.price || 0).toFixed(2)}</b>
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `);
    setWechatFeatureLeftText('外卖', 'renderWechatTakeout("home")');
}

function openWechatTakeoutDish(shopId, dishId) {
    const found = getWechatTakeoutDish(shopId, dishId);
    if (!found) return;
    const { shop, dish } = found;
    openWechatFeatureScreen('菜品详情', renderWechatTakeoutDishDetail(shop, dish), `<button type="button" class="wc-feature-cart-btn" onclick="renderWechatTakeout('cart')" aria-label="打开外卖购物车"><i class="ri-shopping-basket-2-line"></i></button>`);
    setWechatFeatureLeftText('店铺', () => openWechatTakeoutShop(shop.id));
    if (!dish.image && !getWechatTakeoutSavedImage(shop.id, dish.id) && !window._wechatTakeoutImageGenerating?.[getWechatTakeoutImageKey(shop.id, dish.id)]) {
        setTimeout(() => ensureWechatTakeoutDishImage(shop.id, dish.id), 120);
    }
}

function renderWechatTakeoutDishDetail(shop, dish) {
    const image = dish.image || getWechatTakeoutSavedImage(shop.id, dish.id);
    return `
        <div class="wc-takeout-app wc-takeout-detail-app">
            <div class="wc-takeout-content">
                <section class="wc-takeout-dish-cover">
                    ${image ? `<img src="${wcEscapeHtml(image)}" loading="lazy" onerror="this.remove(); ensureWechatTakeoutDishImage(${quoteWechatJsString(shop.id)}, ${quoteWechatJsString(dish.id)})">` : `${renderWechatTakeoutTextCover(shop, dish, 'detail')}<div class="wc-takeout-image-status"><i class="ri-loader-4-line"></i><span>正在生成真实菜品图</span></div>`}
                </section>
                <section class="wc-takeout-dish-card">
                    <div><span>${wcEscapeHtml(shop.name)}</span><b>¥${Number(dish.price || 0).toFixed(2)}</b></div>
                    <h3>${wcEscapeHtml(dish.name)}</h3>
                    <p>${wcEscapeHtml(dish.desc || `${shop.tag} · ${shop.time} · 配送 ¥${shop.fee}`)}</p>
                    <button type="button" onclick="addWechatTakeoutCart(${quoteWechatJsString(shop.id)}, ${quoteWechatJsString(dish.id)})"><i class="ri-add-line"></i><span>加入外卖购物车</span></button>
                </section>
            </div>
        </div>
    `;
}

function saveWechatTakeoutImage(shopId, dishId, imageUrl) {
    const store = getWechatTakeoutStore();
    store.images[getWechatTakeoutImageKey(shopId, dishId)] = imageUrl;
    store.customShops = (store.customShops || []).map(shop => {
        if (String(shop.id) !== String(shopId)) return shop;
        return {
            ...shop,
            dishes: (shop.dishes || []).map(dish => String(dish.id) === String(dishId) ? { ...dish, image: imageUrl } : dish)
        };
    });
    saveWechatTakeoutStore(store);
}

async function ensureWechatTakeoutDishImage(shopId, dishId) {
    const found = getWechatTakeoutDish(shopId, dishId);
    if (!found) return '';
    const key = getWechatTakeoutImageKey(shopId, dishId);
    if (getWechatTakeoutSavedImage(shopId, dishId)) return getWechatTakeoutSavedImage(shopId, dishId);
    window._wechatTakeoutImageGenerating = window._wechatTakeoutImageGenerating || {};
    if (window._wechatTakeoutImageGenerating[key]) return '';
    window._wechatTakeoutImageGenerating[key] = true;
    const status = document.querySelector('.wc-takeout-image-status');
    if (status) status.innerHTML = '<i class="ri-loader-4-line"></i><span>正在生成真实菜品图</span>';
    const { shop, dish } = found;
    const prompt = `真实外卖平台菜品照片，手机外卖详情页主图，食物清晰诱人，干净自然光，浅色背景，店铺：${shop.name}，菜品：${dish.name}，类型：${shop.tag}，说明：${dish.desc || dish.name}`;
    const result = await callWechatImageGenerationApi(prompt, { size: '1024x1024' });
    delete window._wechatTakeoutImageGenerating[key];
    if (result.ok && result.url) {
        saveWechatTakeoutImage(shopId, dishId, result.url);
        openWechatTakeoutDish(shopId, dishId);
        return result.url;
    }
    if (status) status.innerHTML = `<i class="ri-error-warning-line"></i><span>${wcEscapeHtml(result.error || '菜品图片生成失败')}</span><button type="button" onclick="ensureWechatTakeoutDishImage(${quoteWechatJsString(shopId)}, ${quoteWechatJsString(dishId)})">重试</button>`;
    return '';
}

async function generateWechatTakeoutShop() {
    const briefEl = document.getElementById('wc-takeout-ai-brief');
    const btn = document.querySelector('.wc-takeout-ai-panel button');
    const brief = (briefEl?.value || '').trim() || '适合今晚吃的外卖';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中';
    }
    try {
        const result = await callChatApi([
            { role: 'system', content: '你是外卖菜单策划。只输出 JSON 对象，不要解释。字段：name、tag、score、time、fee、dishes。dishes 是 3 到 5 个菜品，每项字段 id、name、price、desc。不要生成图片 URL。名字和菜品要像真实外卖平台。' },
            { role: 'user', content: `生成一个外卖店和菜单：${brief}` }
        ], { usageFeature: 'discover' });
        const parsed = result.ok ? parseWechatAiJsonPayload(result.content) : null;
        if (!result.ok || !parsed) throw new Error(result.error || 'AI 返回格式无法解析');
        const shop = normalizeWechatTakeoutShop({
            ...parsed,
            id: 'take_ai_' + Date.now(),
            gradient: getWechatGeneratedGradient(`${parsed.name || brief}${parsed.tag || ''}`)[0]
        }, 300);
        if (!shop || !shop.dishes.length) throw new Error('AI 没有返回可用菜单');
        const store = getWechatTakeoutStore();
        store.customShops.unshift(shop);
        store.customShops = store.customShops.slice(0, 16);
        saveWechatTakeoutStore(store);
        showWechatToast('已生成外卖店');
        renderWechatTakeout('home');
    } catch (e) {
        alert(e.message || '生成失败');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'AI 生成';
        }
    }
}

function addWechatTakeoutCart(shopId, dishId) {
    const found = getWechatTakeoutDish(shopId, dishId);
    if (!found) return;
    const { shop, dish } = found;
    const store = getWechatTakeoutStore();
    const existing = store.cart.find(item => item.shopId === shopId && item.id === dishId);
    if (existing) existing.qty = Math.min(20, (existing.qty || 1) + 1);
    else store.cart.push({ ...dish, image: dish.image || getWechatTakeoutSavedImage(shop.id, dish.id), shopId, shopName: shop.name, fee: shop.fee, qty: 1 });
    saveWechatTakeoutStore(store);
    showWechatToast('已加入外卖购物车');
}
window.addWechatTakeoutCart = addWechatTakeoutCart;
window.openWechatTakeoutShop = openWechatTakeoutShop;
window.openWechatTakeoutDish = openWechatTakeoutDish;
window.ensureWechatTakeoutDishImage = ensureWechatTakeoutDishImage;
window.generateWechatTakeoutShop = generateWechatTakeoutShop;

function renderWechatTakeoutCart(store) {
    const total = store.cart.reduce((sum, item) => sum + Number(item.price || 0) * (item.qty || 1), 0) + (store.cart[0]?.fee || 0);
    const summary = store.cart.map(item => `${item.name} ×${item.qty || 1}`).join('、');
    return `
        <div class="wc-takeout-cart-card">
            <h4>外卖购物车 <em>${store.cart.length} 种</em></h4>
            ${store.cart.length ? store.cart.map((item, index) => `
                <div class="wc-takeout-cart-row">
                    <div class="wc-takeout-cart-thumb" style="background:${wcEscapeHtml(getWechatGeneratedGradient((item.shopName || '') + item.name)[0])}">${item.image ? `<img src="${wcEscapeHtml(item.image)}" loading="lazy" onerror="this.style.display='none'">` : `<span>${wcEscapeHtml(String(item.name || '餐').slice(0, 1))}</span>`}</div>
                    <div><strong>${wcEscapeHtml(item.name)}</strong><span>${wcEscapeHtml(item.shopName)} · ¥${Number(item.price || 0).toFixed(2)}</span></div>
                    <b>×${item.qty || 1}</b>
                    <button onclick="removeWechatTakeoutCart(${index})">删除</button>
                </div>
            `).join('') : '<div class="wc-discover-empty">还没有点餐</div>'}
            <textarea id="wc-takeout-address" placeholder="填写收餐地址">${wcEscapeHtml(store.lastAddress || '')}</textarea>
            <div class="wc-shop-payer-picker wc-takeout-payer-picker">
                <input type="hidden" id="wc-takeout-payer" value="${wcEscapeHtml(store.lastPayer || 'self')}">
                <button type="button" data-payer-id="self" class="${store.lastPayer === 'self' || !store.lastPayer ? 'active' : ''}" onclick="selectWechatTakeoutPayer('self')"><i class="ri-wallet-3-line"></i><span>自己下单</span></button>
                ${(window.myCharacters || []).map(c => `<button type="button" data-payer-id="${wcEscapeHtml(c.id)}" class="${store.lastPayer === c.id ? 'active' : ''}" onclick="selectWechatTakeoutPayer('${wcEscapeHtml(c.id)}')"><img src="${wcEscapeHtml(c.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'"><span>${wcEscapeHtml(getWechatCharDisplayName(c))}</span></button>`).join('')}
            </div>
            <div class="wc-shop-total"><span>${wcEscapeHtml(summary || '未选择菜品')}</span><strong>¥${total.toFixed(2)}</strong></div>
            <button class="wc-shop-checkout" onclick="checkoutWechatTakeout()" ${store.cart.length ? '' : 'disabled'}>下单 / 让角色帮点</button>
        </div>
    `;
}

function selectWechatTakeoutPayer(payerId) {
    const input = document.getElementById('wc-takeout-payer');
    if (input) input.value = payerId || 'self';
    document.querySelectorAll('.wc-takeout-payer-picker button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.payerId === String(payerId || 'self'));
    });
}
window.selectWechatTakeoutPayer = selectWechatTakeoutPayer;

function removeWechatTakeoutCart(index) {
    const store = getWechatTakeoutStore();
    store.cart.splice(index, 1);
    saveWechatTakeoutStore(store);
    renderWechatTakeout('cart');
}
window.removeWechatTakeoutCart = removeWechatTakeoutCart;

function checkoutWechatTakeout() {
    const store = getWechatTakeoutStore();
    if (!store.cart.length) return;
    const address = (document.getElementById('wc-takeout-address')?.value || '').trim();
    if (!address) { alert('先填写收餐地址'); return; }
    const payer = document.getElementById('wc-takeout-payer')?.value || 'self';
    const total = store.cart.reduce((sum, item) => sum + Number(item.price || 0) * (item.qty || 1), 0) + (store.cart[0]?.fee || 0);
    const summary = store.cart.map(item => `${item.name} ×${item.qty || 1}`).join('、');
    const order = { id: 'take_' + Date.now(), items: store.cart.map(item => ({ ...item })), shopName: store.cart[0]?.shopName || '外卖', summary, address, total, payer, createdAt: Date.now() };
    store.orders.push(order);
    store.lastAddress = address;
    store.lastPayer = payer;
    store.cart = [];
    saveWechatTakeoutStore(store);
    appendWechatShoppingContextRecord(order, 'takeout');
    if (payer !== 'self') {
        sendWechatMessageToChar(payer, { type: 'share_card', isMe: true, card: { action: 'takeout_pay', title: '帮我点外卖', text: summary, source: 'BYND 外卖', order } });
        queueWechatAutoReplyToChar(payer);
        showWechatToast('已发给角色，等待回复');
        return;
    } else {
        showWechatToast('外卖订单已提交');
    }
    renderWechatTakeout('home');
}
window.checkoutWechatTakeout = checkoutWechatTakeout;

async function startWechatScreenShare() {
    closeWechatPlusMenu();
    if (!window.currentChatCharId) {
        showWechatToast('先打开一个聊天，再共享屏幕');
        return;
    }
    const charId = window.currentChatCharId;
    const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    if (!supported) {
        sendWechatMessageToChar(charId, { type: 'share_card', isMe: true, card: { action: 'screen_share', title: '共享屏幕不可用', text: '当前浏览器没有开放屏幕共享权限，可以换支持屏幕共享的浏览器或桌面端再试。', source: '共享屏幕' } });
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        window._wechatScreenShareStream = stream;
        sendWechatMessageToChar(charId, { type: 'share_card', isMe: true, card: { action: 'screen_share', title: '我开始共享屏幕了', text: '浏览器已授权共享当前屏幕/标签页，角色会结合你接下来发来的内容继续互动。', source: '共享屏幕' } });
        stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => showWechatToast('屏幕共享已结束')));
    } catch (e) {
        showWechatToast('已取消共享屏幕');
    }
}
window.startWechatScreenShare = startWechatScreenShare;

function sendWechatShopGift(productId) {
    const product = getWechatShopProducts().find(p => p.id === productId);
    if (!product) return;
    shareWechatText('礼物', `送你一份礼物：${product.name}`, {
        action: 'gift',
        title: '礼物',
        text: product.name,
        source: 'BYND 购物',
        product
    });
}

function shareWechatShopProduct(productId) {
    const product = getWechatShopProducts().find(p => p.id === productId);
    if (!product) {
        showWechatToast('这个商品已经不在列表里了');
        return;
    }
    shareWechatText('商品', `${product.name || '商品'} ¥${Number(product.price || 0).toFixed(2)}`, {
        action: 'product',
        title: product.name || '商品',
        text: product.description || product.tag || '',
        source: 'BYND 购物',
        images: product.image ? [product.image] : [],
        product: {
            id: product.id,
            name: product.name || '商品',
            price: product.price || 0,
            tag: product.tag || '精选好物',
            image: product.image || '',
            description: product.description || ''
        }
    });
}

function requestWechatShopIntimatePay() {
    const payer = document.getElementById('wc-shop-payer')?.value || '';
    if (!payer || payer === 'self') {
        showWechatToast('先在付款人里选择一个角色');
        return;
    }
    const total = getWechatShopCartTotal(getWechatShopStore());
    const limit = Math.max(100, Math.ceil(total || 520));
    sendWechatMessageToChar(payer, {
        type: 'intimatePay',
        isMe: true,
        amount: limit.toFixed(2),
        status: '待开通',
        note: `我想让你给我开通亲密付，额度 ¥${limit.toFixed(2)}`
    });
}

function sendWechatTextToChar(charId, text) {
    sendWechatMessageToChar(charId, { type: 'text', isMe: true, content: text });
}

function queueWechatAutoReplyToChar(charId, attempt = 0, options = {}) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    window._wechatAutoReplyTimers = window._wechatAutoReplyTimers || {};
    window._wechatAutoReplyInFlight = window._wechatAutoReplyInFlight || {};
    window._wechatAutoReplyLastAt = window._wechatAutoReplyLastAt || {};
    const key = String(charId);
    if (!options.force) {
        if (isWechatAiRateLimitPaused()) return;
        if (window._wechatAutoReplyTimers[key] || window._wechatAutoReplyInFlight[key]) return;
        const lastAt = Number(window._wechatAutoReplyLastAt[key]) || 0;
        if (attempt === 0 && Date.now() - lastAt < 1200) return;
    }
    const delay = attempt ? 900 : 420;
    window._wechatAutoReplyTimers[key] = setTimeout(() => {
        delete window._wechatAutoReplyTimers[key];
        if (isWechatAiRateLimitPaused() && !options.force) return;
        if (window._wechatAiBusy) {
            if (attempt < 8) queueWechatAutoReplyToChar(charId, attempt + 1, options);
            return;
        }
        if (window._wechatAutoReplyInFlight[key] && !options.force) return;
        const contentEl = document.getElementById('chat-room-content');
        if (!contentEl) return;
        window._wechatAutoReplyInFlight[key] = true;
        window._wechatAutoReplyLastAt[key] = Date.now();
        triggerAiAfterMessage(char, contentEl, options).catch(err => {
            console.warn('wechat queued ai reply failed:', err);
        }).finally(() => {
            delete window._wechatAutoReplyInFlight[key];
            window._wechatAutoReplyLastAt[key] = Date.now();
        });
    }, delay);
}

function sendWechatMessageToChar(charId, msg) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    if (!char.history) char.history = [];
    const nextMsg = {
        ...msg,
        isMe: msg && typeof msg.isMe === 'boolean' ? msg.isMe : true,
        timestamp: msg && msg.timestamp ? msg.timestamp : createMessageTimestamp()
    };
    syncWechatMessageDescription(nextMsg);
    char.history.push(nextMsg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    if (nextMsg.isMe) notifyWechatMonitors(char, nextMsg);
    saveCharactersToStorage();
    renderChatList();
    closeWechatFeatureScreen();
    switchWcTab('chat');
    openChat(char.id);
}

window.createMessageTimestamp = createMessageTimestamp;
window.syncWechatMessageDescription = syncWechatMessageDescription;
window.refreshChatView = refreshChatView;
window.notifyWechatMonitors = notifyWechatMonitors;
window.queueWechatAutoReplyToChar = queueWechatAutoReplyToChar;
window.sendWechatMessageToChar = sendWechatMessageToChar;
window.renderChatList = renderChatList;
window.saveCharactersToStorage = saveCharactersToStorage;
window.openChat = openChat;

function shareWechatText(title, text, payload = null) {
    const chars = window.myCharacters || [];
    if (!chars.length) {
        alert('还没有可转发的联系人');
        return;
    }
    let modal = document.getElementById('wc-share-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-share-modal';
        modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
        modal.innerHTML = `
            <div class="wc-compose-card wc-share-card">
                <div class="wc-compose-header">
                    <div class="wc-compose-title"><i class="ri-share-forward-line"></i><span>选择联系人</span></div>
                    <i class="ri-close-line" onclick="closeWechatShareModal()"></i>
                </div>
                <div class="wc-share-list" id="wc-share-list"></div>
            </div>
        `;
        getWechatModalRoot().appendChild(modal);
    }
    modal.dataset.shareTitle = title;
    modal.dataset.shareText = text;
    if (payload && typeof payload === 'object') modal.dataset.sharePayload = JSON.stringify(payload);
    else delete modal.dataset.sharePayload;
    document.getElementById('wc-share-list').innerHTML = chars.map(char => `
        <div class="wc-share-contact" onclick="confirmWechatShare(${quoteWechatJsString(char.id)})">
            <img src="${char.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
            <span>${wcEscapeHtml((char.chatConfig && char.chatConfig.nickname) || char.name || '未命名')}</span>
        </div>
    `).join('');
    modal.classList.remove('hidden');
}

function closeWechatShareModal() {
    const modal = document.getElementById('wc-share-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmWechatShare(charId) {
    const modal = document.getElementById('wc-share-modal');
    if (!modal) return;
    const title = modal.dataset.shareTitle || '';
    const text = modal.dataset.shareText || '';
    let payload = null;
    try {
        payload = modal.dataset.sharePayload ? JSON.parse(modal.dataset.sharePayload) : null;
    } catch (e) {
        payload = null;
    }
    closeWechatShareModal();
    if (payload && typeof payload === 'object') {
        if (payload.action === 'message_forward' && payload.message) {
            const forwarded = cloneWechatMessageForForward(payload.message);
            if (forwarded) {
                sendWechatMessageToChar(charId, forwarded);
                return;
            }
        }
        if (payload.action === 'gift' && payload.product) {
            const product = payload.product;
            sendWechatMessageToChar(charId, {
                type: 'gift',
                isMe: true,
                status: '待收取',
                item: {
                    name: product.name || '礼物',
                    price: product.price || '',
                    image: product.image || '',
                    description: product.description || ''
                },
                note: `送给你：${product.name || '礼物'}`
            });
            return;
        }
        sendWechatMessageToChar(charId, {
            type: 'share_card',
            isMe: true,
            card: {
                title: payload.title || title || '转发',
                text: payload.text || text || '',
                source: payload.source || title || '转发',
                images: Array.isArray(payload.images) ? payload.images.filter(Boolean).slice(0, 9) : [],
                action: payload.action || '',
                product: payload.product && typeof payload.product === 'object' ? payload.product : null,
                order: payload.order && typeof payload.order === 'object' ? payload.order : null
            }
        });
        return;
    }
    sendWechatTextToChar(charId, `我转发了${title}给你：${text}`);
}

