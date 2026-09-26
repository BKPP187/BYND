function getWechatShopProducts() {
    const store = getWechatShopStore();
    return [...store.sourceProducts, ...store.custom];
}

function getWechatShopAggregateSourceLabel(store) {
    const count = Array.isArray(store?.sourceProducts) ? store.sourceProducts.length : 0;
    const syncedAt = store?.sourceSyncedAt ? formatWechatRelativeTime(store.sourceSyncedAt) : '还未同步';
    return `${count ? `${count} 件商品` : '等待拉取'} · ${syncedAt}`;
}

function translateWechatShopCategory(value, name = '') {
    const text = `${value || ''} ${name || ''}`.toLowerCase();
    const cnCategories = ['美妆个护', '家居生活', '食品百货', '数码配件', '服饰穿搭', '运动出行', '精选好物'];
    const existingCn = cnCategories.find(category => String(value || '').includes(category));
    if (existingCn) return existingCn;
    const map = [
        [/beauty|makeup|lipstick|mascara|fragrance|perfume|skin|cream|serum|nail|powder/, '美妆个护'],
        [/furniture|sofa|chair|table|bed|decor|lamp|home/, '家居生活'],
        [/groceries|food|juice|oil|rice|fruit|vegetable|meat|drink/, '食品百货'],
        [/laptop|smartphone|tablet|phone|mobile|accessor|electronics|charger|case/, '数码配件'],
        [/shirt|top|dress|women|men|clothes|jacket|fashion|bag|shoe|watch|sunglasses|jewel/, '服饰穿搭'],
        [/sport|ball|fitness|bike|motorcycle|vehicle|car/, '运动出行']
    ];
    const matched = map.find(([re]) => re.test(text));
    return matched ? matched[1] : '精选好物';
}

function translateWechatShopName(value, category = '') {
    const source = String(value || '').trim();
    if (!source) return '';
    const lower = `${source} ${category || ''}`.toLowerCase();
    const nameMap = [
        [/mascara/, '纤长睫毛膏'],
        [/lipstick|lip colour|lipstick/, '柔雾口红'],
        [/foundation/, '轻透粉底液'],
        [/nail/, '亮泽美甲护理'],
        [/perfume|fragrance/, '香氛香水'],
        [/cream|serum|essence|skin/, '护肤精华'],
        [/phone case|case/, '手机保护壳'],
        [/charger|adapter|cable/, '快充配件'],
        [/smartphone|iphone|samsung|phone/, '智能手机'],
        [/laptop|macbook/, '轻薄笔记本电脑'],
        [/tablet|ipad/, '平板电脑'],
        [/watch/, '腕表'],
        [/bag|handbag|purse/, '通勤包'],
        [/shoe|sneaker|boot|heel/, '舒适鞋履'],
        [/shirt|t-shirt|top/, '日常上衣'],
        [/dress/, '气质连衣裙'],
        [/jacket|coat/, '外套'],
        [/sofa/, '客厅沙发'],
        [/chair/, '舒适单椅'],
        [/table|desk/, '桌面家具'],
        [/lamp|light/, '氛围灯'],
        [/coffee/, '咖啡饮品'],
        [/juice|drink/, '风味饮品'],
        [/oil/, '厨房食用油'],
        [/rice|grain/, '谷物食品'],
        [/ball|fitness|sport/, '运动装备']
    ];
    const matched = nameMap.find(([re]) => re.test(lower));
    if (matched) return matched[1];
    const clean = source
        .replace(/[-_]+/g, ' ')
        .replace(/\b(?:new|premium|classic|modern|stylish|women'?s|men'?s)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (/^[\x00-\x7F]+$/.test(clean)) {
        const cnCategory = translateWechatShopCategory(category, source);
        const suffixMap = {
            '美妆个护': '日常护理单品',
            '家居生活': '质感生活好物',
            '食品百货': '安心囤货好物',
            '数码配件': '实用数码配件',
            '服饰穿搭': '通勤穿搭单品',
            '运动出行': '轻便运动装备',
            '精选好物': '精选生活好物'
        };
        return suffixMap[cnCategory] || `${cnCategory}好物`;
    }
    return clean;
}

function translateWechatShopDescription(value, item = {}) {
    const text = String(value || '').trim();
    if (!text) {
        return `适合日常使用的${translateWechatShopCategory(item.category || item.tag, item.title || item.name)}，页面已按聚合源整理为中文展示。`;
    }
    if (!/^[\x00-\x7F\s.,;:!?'"()/-]+$/.test(text)) return text;
    const lower = `${item.title || item.name || ''} ${item.category || item.tag || ''} ${text}`.toLowerCase();
    const category = translateWechatShopCategory(item.category || item.tag, item.title || item.name);
    if (/beauty|fragrance|skin|lip|mascara|cream|serum/.test(lower)) return `质感细腻的${category}单品，适合日常护理、通勤或约会场景。`;
    if (/phone|laptop|tablet|charger|electronic|accessor/.test(lower)) return `实用型${category}，兼顾日常使用、外出携带和桌面收纳。`;
    if (/furniture|sofa|chair|table|lamp|home|decor/.test(lower)) return `耐看的${category}，适合卧室、书桌或客厅搭配。`;
    if (/shirt|dress|shoe|bag|watch|fashion|women|men/.test(lower)) return `简洁好搭的${category}，适合日常出门和轻正式场合。`;
    if (/food|grocery|juice|oil|rice|coffee|drink/.test(lower)) return `日常囤货型${category}，适合家庭、办公室或夜间补给。`;
    return `来自聚合商品源的${category}，已整理为中文标题和简短说明。`;
}

function normalizeWechatShopProductForDisplay(item, index = 0, sourceName = '聚合源') {
    if (!item || typeof item !== 'object') return null;
    const rawName = String(item.name || item.title || item.productName || '').trim();
    const price = Number(item.price || item.salePrice || item.amount || 0) || 0;
    if (!rawName || price <= 0) return null;
    const rawTag = item.category || item.brand || item.tag || sourceName;
    const tag = translateWechatShopCategory(rawTag, rawName);
    const name = translateWechatShopName(rawName, rawTag);
    const image = item.thumbnail || item.image || item.imageUrl || (Array.isArray(item.images) ? item.images[0] : '');
    return {
        ...item,
        id: String(item.id || item.productId || `src_${sourceName}_${index}`),
        name,
        price,
        tag,
        image: String(image || '').trim(),
        description: translateWechatShopDescription(item.description || item.desc || item.body || '', { ...item, category: rawTag, title: rawName }),
        gradient: item.gradient || getWechatGeneratedGradient(name + tag)[0],
        source: item.source || sourceName
    };
}

function normalizeWechatShopCartItem(item) {
    if (!item || typeof item !== 'object') return null;
    const qty = Math.max(1, Math.min(99, parseInt(item.qty || item.quantity || 1, 10) || 1));
    const price = Number(item.price || 0) || 0;
    const display = normalizeWechatShopProductForDisplay({ ...item, price }, 0, item.source || '购物车');
    if (!display) return null;
    return {
        id: String(item.id || item.productId || display.name),
        name: display.name,
        price,
        qty,
        tag: display.tag,
        image: display.image,
        description: display.description,
        gradient: display.gradient
    };
}

function getWechatShopCartCount(store) {
    return (store.cart || []).reduce((sum, item) => sum + (parseInt(item.qty || 1, 10) || 1), 0);
}

function getWechatShopCartTotal(store) {
    return (store.cart || []).reduce((sum, item) => sum + Number(item.price || 0) * (parseInt(item.qty || 1, 10) || 1), 0);
}

function getWechatShopCartSummary(items) {
    return (items || []).map(item => `${item.name} ×${item.qty || 1} ¥${(Number(item.price || 0) * (item.qty || 1)).toFixed(2)}`).join('；');
}

function getWechatShopStore() {
    const store = readWechatStore(WECHAT_SHOP_STORAGE_KEY, { cart: [], custom: [], orders: [], sourceProducts: [], sourceUrl: WECHAT_SHOP_AGGREGATE_SOURCE_ID, sourceSyncedAt: 0, intimatePay: {}, lastAddress: '', lastPayer: 'self' });
    store.cart = Array.isArray(store.cart) ? store.cart.map(normalizeWechatShopCartItem).filter(Boolean) : [];
    store.custom = Array.isArray(store.custom) ? store.custom : [];
    store.orders = Array.isArray(store.orders) ? store.orders : [];
    store.sourceProducts = Array.isArray(store.sourceProducts)
        ? store.sourceProducts.map((item, index) => normalizeWechatShopProductForDisplay(item, index, item?.source || '聚合源')).filter(Boolean)
        : [];
    store.sourceUrl = WECHAT_SHOP_AGGREGATE_SOURCE_ID;
    store.sourceSyncedAt = Number(store.sourceSyncedAt || 0) || 0;
    store.intimatePay = store.intimatePay && typeof store.intimatePay === 'object' ? store.intimatePay : {};
    store.lastAddress = typeof store.lastAddress === 'string' ? store.lastAddress : '';
    store.lastPayer = typeof store.lastPayer === 'string' ? store.lastPayer : 'self';
    return store;
}

function saveWechatShopStore(store) {
    writeWechatStore(WECHAT_SHOP_STORAGE_KEY, store);
}

function openWechatShop(seed = '') {
    window._wechatShopKeyword = decodeURIComponent(seed || '');
    window._wechatShopTab = 'home';
    renderWechatShop('home', window._wechatShopKeyword);
}

function renderWechatShop(tabOrKeyword = 'home', keywordArg) {
    const tabs = ['home', 'cart', 'me'];
    const isTab = tabs.includes(tabOrKeyword);
    const tab = isTab ? tabOrKeyword : (window._wechatShopTab || 'home');
    const keyword = isTab ? (keywordArg ?? window._wechatShopKeyword ?? '') : String(tabOrKeyword || '');
    window._wechatShopTab = tab;
    window._wechatShopKeyword = keyword;
    const store = getWechatShopStore();
    const products = getWechatShopProducts().filter(p => !keyword || `${p.name}${p.tag}`.toLowerCase().includes(keyword.toLowerCase()));
    const total = getWechatShopCartTotal(store);
    const cartCount = getWechatShopCartCount(store);
    const content = tab === 'cart'
        ? renderWechatShopCart(store, total)
        : (tab === 'me' ? renderWechatShopMe(store) : renderWechatShopHome(products, keyword));
    openWechatFeatureScreen('购物', `
        <div class="wc-shop-app">
            <div class="wc-shop-content">${content}</div>
            <div class="wc-shop-tabbar">
                <button class="${tab === 'home' ? 'active' : ''}" onclick="renderWechatShop('home')"><i class="ri-home-5-line"></i><span>首页</span></button>
                <button class="${tab === 'cart' ? 'active' : ''}" onclick="renderWechatShop('cart')"><i class="ri-shopping-cart-line"></i><span>购物车${cartCount ? `(${cartCount})` : ''}</span></button>
                <button class="${tab === 'me' ? 'active' : ''}" onclick="renderWechatShop('me')"><i class="ri-user-3-line"></i><span>我的</span></button>
            </div>
        </div>
    `, `<button type="button" class="wc-feature-cart-btn" onclick="renderWechatShop('cart')" aria-label="打开购物车"><i class="ri-shopping-cart-line"></i>${cartCount ? `<b>${cartCount}</b>` : ''}</button>`);
}

function scheduleWechatShopSourceLoad(keyword = '') {
    const store = getWechatShopStore();
    const stale = !store.sourceProducts.length || !store.sourceSyncedAt || Date.now() - store.sourceSyncedAt > 1000 * 60 * 60 * 6;
    if (!stale || window._wechatShopSourceLoading) return;
    window._wechatShopSourceLoading = true;
    setTimeout(() => {
        loadWechatShopSource({ silent: true, keyword }).finally(() => {
            window._wechatShopSourceLoading = false;
        });
    }, 80);
}

function getWechatShopProductById(productId) {
    return getWechatShopProducts().find(p => String(p.id) === String(productId));
}

function getWechatShopProductTone(product, index = 0) {
    const palette = [
        'linear-gradient(135deg,#fff4ee 0%,#ffd5c0 52%,#ff7a32 100%)',
        'linear-gradient(135deg,#f5fbff 0%,#cde7ff 54%,#72a8ff 100%)',
        'linear-gradient(135deg,#fffaf0 0%,#ffe1a8 58%,#f5a623 100%)',
        'linear-gradient(135deg,#f8fff8 0%,#c9f2d6 58%,#38bd7d 100%)',
        'linear-gradient(135deg,#fff7fb 0%,#ffd2e7 52%,#ff6ca8 100%)'
    ];
    return product?.gradient || palette[index % palette.length];
}

function renderWechatShopTextCover(product, index = 0, mode = '') {
    const tag = wcEscapeHtml(product.tag || '精选好物');
    const name = wcEscapeHtml(product.name || '商品');
    const source = wcEscapeHtml(product.source || 'BYND');
    return `
        <div class="wc-shop-text-cover ${mode}" style="background:${getWechatShopProductTone(product, index)}">
            <span>${tag}</span>
            <strong>${name}</strong>
            <em>${source}</em>
        </div>
    `;
}

function renderWechatShopProductCard(product, index = 0) {
    return `
        <article class="wc-shop-card" onclick="openWechatShopProduct(${quoteWechatJsString(product.id)})">
            ${renderWechatShopTextCover(product, index)}
            <div class="wc-shop-card-body">
                <div class="wc-shop-name">${wcEscapeHtml(product.name)}</div>
                ${product.description ? `<div class="wc-shop-desc">${wcEscapeHtml(product.description)}</div>` : ''}
                <div class="wc-shop-tag-row">
                    <span>${wcEscapeHtml(product.tag || '精选')}</span>
                    <span>文字图预览</span>
                </div>
                <div class="wc-shop-row">
                    <strong>¥${Number(product.price || 0).toFixed(2)}</strong>
                    <button onclick="event.stopPropagation(); addWechatShopCart(${quoteWechatJsString(product.id)})">加购</button>
                </div>
                <div class="wc-shop-mini-actions">
                    <button onclick="event.stopPropagation(); shareWechatShopProduct(${quoteWechatJsString(product.id)})"><i class="ri-share-forward-line"></i>转发</button>
                    <button onclick="event.stopPropagation(); sendWechatShopGift(${quoteWechatJsString(product.id)})"><i class="ri-gift-line"></i>送礼</button>
                </div>
            </div>
        </article>
    `;
}

function renderWechatShopCategoryPills(products, keyword) {
    const tags = ['全部', ...Array.from(new Set((products || []).map(p => p.tag || '精选好物'))).slice(0, 7)];
    return `
        <div class="wc-shop-cats">
            ${tags.map(tag => {
                const active = (!keyword && tag === '全部') || keyword === tag;
                const next = tag === '全部' ? '' : tag;
                return `<button class="${active ? 'active' : ''}" onclick="renderWechatShop('home', ${quoteWechatJsString(next)})">${wcEscapeHtml(tag)}</button>`;
            }).join('')}
        </div>
    `;
}

function renderWechatShopHome(products, keyword) {
    const store = getWechatShopStore();
    scheduleWechatShopSourceLoad(keyword);
    const allProducts = getWechatShopProducts();
    const visibleProducts = products.length ? products : allProducts;
    const featured = visibleProducts[0];
    return `
        <div class="wc-shop-taobao-head">
            <div class="wc-shop-search"><i class="ri-search-line"></i><input value="${wcEscapeHtml(keyword)}" placeholder="搜索宝贝、礼物、角色想买的东西" oninput="renderWechatShop('home', this.value)"></div>
            <button class="wc-shop-refresh-btn" onclick="loadWechatShopSource({ keyword: window._wechatShopKeyword || '' })" aria-label="换一批"><i class="ri-refresh-line"></i></button>
        </div>
        ${renderWechatShopCategoryPills(allProducts, keyword)}
        <section class="wc-shop-hero">
            <div>
                <span>BYND 逛逛</span>
                <strong>${featured ? wcEscapeHtml(featured.tag || '今日好物') : '今日好物'}</strong>
                <p>${featured ? wcEscapeHtml(featured.description || featured.name) : '正在整理适合聊天转发、送礼和亲密付的商品。'}</p>
            </div>
            ${featured ? renderWechatShopTextCover(featured, 0, 'hero') : '<i class="ri-shopping-bag-3-line"></i>'}
        </section>
        <details class="wc-shop-seller-tools">
            <summary><span>发布商品</span><em>AI 生成 / 手动添加</em><i class="ri-arrow-down-s-line"></i></summary>
            <div class="wc-shop-ai-card">
                <input id="wc-shop-ai-brief" placeholder="让 AI 生成商品，例如：适合深夜学习的桌面小灯">
                <button onclick="generateWechatShopProduct()">AI 生成</button>
            </div>
            <div class="wc-shop-custom">
                <input id="wc-shop-custom-name" placeholder="商品标题">
                <input id="wc-shop-custom-price" type="number" min="0" placeholder="价格">
                <input id="wc-shop-custom-tag" placeholder="分类">
                <input id="wc-shop-custom-image" placeholder="图片 URL / 图床链接">
                <textarea id="wc-shop-custom-desc" placeholder="商品内容描述"></textarea>
                <button onclick="addWechatCustomProduct()">添加产品</button>
            </div>
        </details>
        <div class="wc-shop-feed-title"><strong>猜你喜欢</strong><span>${store.sourceProducts.length ? '点击商品后查看真实图片' : (window._wechatShopSourceLoading ? '正在整理商品源' : '暂无商品源')}</span></div>
        <div class="wc-shop-products">
            ${products.length ? products.map((p, index) => renderWechatShopProductCard(p, index)).join('') : `<div class="wc-discover-empty" style="grid-column:1/-1;">${window._wechatShopSourceLoading ? '正在整理商品，稍等一下。' : '还没有商品，可以先用 AI 生成一个。'}</div>`}
        </div>
    `;
}

function openWechatShopProduct(productId) {
    const product = getWechatShopProductById(productId);
    if (!product) {
        showWechatToast('这个商品已经不在列表里了');
        return;
    }
    const cartCount = getWechatShopCartCount(getWechatShopStore());
    openWechatFeatureScreen('商品详情', `
        <div class="wc-shop-app wc-shop-detail-app">
            <div class="wc-shop-content">${renderWechatShopDetail(product)}</div>
            <div class="wc-shop-detail-bar">
                <button onclick="renderWechatShop('home')"><i class="ri-arrow-left-s-line"></i><span>返回</span></button>
                <button onclick="shareWechatShopProduct(${quoteWechatJsString(product.id)})"><i class="ri-share-forward-line"></i><span>转发</span></button>
                <button onclick="sendWechatShopGift(${quoteWechatJsString(product.id)})"><i class="ri-gift-line"></i><span>送礼</span></button>
                <button class="primary" onclick="addWechatShopCart(${quoteWechatJsString(product.id)})">加入购物车</button>
            </div>
        </div>
    `, `<button type="button" class="wc-feature-cart-btn" onclick="renderWechatShop('cart')" aria-label="打开购物车"><i class="ri-shopping-cart-line"></i>${cartCount ? `<b>${cartCount}</b>` : ''}</button>`);
    if (!product.image && !window._wechatShopImageGenerating?.[product.id]) {
        setTimeout(() => ensureWechatShopProductImage(product.id), 120);
    }
}

function renderWechatShopDetail(product) {
    const imageHtml = product.image
        ? `<img src="${wcEscapeHtml(product.image)}" loading="lazy" onerror="this.remove(); ensureWechatShopProductImage(${quoteWechatJsString(product.id)})">`
        : `${renderWechatShopTextCover(product, 0, 'detail')}<div class="wc-shop-image-status"><i class="ri-loader-4-line"></i><span>正在生成真实商品图</span></div>`;
    return `
        <section class="wc-shop-detail-cover">${imageHtml}</section>
        <section class="wc-shop-detail-card">
            <div class="wc-shop-detail-price">¥${Number(product.price || 0).toFixed(2)}</div>
            <h3>${wcEscapeHtml(product.name || '商品')}</h3>
            <div class="wc-shop-detail-meta">
                <span>${wcEscapeHtml(product.tag || '精选好物')}</span>
                <span>${wcEscapeHtml(product.source || 'BYND 购物')}</span>
            </div>
            ${product.description ? `<p>${wcEscapeHtml(product.description)}</p>` : ''}
        </section>
        <section class="wc-shop-detail-card compact">
            <h4>服务</h4>
            <div class="wc-shop-service-row"><span>可转发给联系人</span><span>可加入购物车</span><span>可让角色代付</span></div>
        </section>
    `;
}

function updateWechatShopProductImage(productId, imageUrl) {
    const store = getWechatShopStore();
    let changed = false;
    ['sourceProducts', 'custom'].forEach(key => {
        store[key] = (store[key] || []).map((item, index) => {
            const normalized = normalizeWechatShopProductForDisplay(item, index, item?.source || (key === 'custom' ? '自定义' : '聚合源'));
            if (normalized && String(normalized.id) === String(productId)) {
                changed = true;
                return { ...item, id: normalized.id, image: imageUrl, imageUrl };
            }
            return item;
        });
    });
    if (changed) saveWechatShopStore(store);
    return changed;
}

async function ensureWechatShopProductImage(productId) {
    const product = getWechatShopProductById(productId);
    if (!product || product.image) return product?.image || '';
    window._wechatShopImageGenerating = window._wechatShopImageGenerating || {};
    if (window._wechatShopImageGenerating[productId]) return '';
    window._wechatShopImageGenerating[productId] = true;
    const status = document.querySelector('.wc-shop-image-status');
    if (status) status.innerHTML = '<i class="ri-loader-4-line"></i><span>正在生成真实商品图</span>';
    const prompt = `淘宝风格真实商品主图，干净自然的手机电商详情页图片，主体清晰，浅色背景，商品：${product.name}，分类：${product.tag}，说明：${product.description || product.name}`;
    const result = typeof callWechatImageGenerationApi === 'function'
        ? await callWechatImageGenerationApi(prompt)
        : { ok: false, error: '未加载生图模块' };
    delete window._wechatShopImageGenerating[productId];
    if (result.ok && result.url) {
        updateWechatShopProductImage(productId, result.url);
        openWechatShopProduct(productId);
        return result.url;
    }
    if (status) status.innerHTML = `<i class="ri-error-warning-line"></i><span>${wcEscapeHtml(result.error || '真实图片生成失败')}</span><button onclick="ensureWechatShopProductImage(${quoteWechatJsString(productId)})">重试</button>`;
    return '';
}

function renderWechatShopCart(store, total) {
    const itemCount = getWechatShopCartCount(store);
    return `
        <div class="wc-shop-cart">
            <h4><span>购物车</span><em>${itemCount} 件商品</em></h4>
            ${store.cart.length ? store.cart.map((item, i) => `
                <div class="wc-shop-cart-row">
                    <div class="wc-shop-cart-thumb" style="background:${item.gradient || 'linear-gradient(135deg,#f8fafc,#e2e8f0)'}">${item.image ? `<img src="${wcEscapeHtml(item.image)}" loading="lazy" onerror="this.style.display='none'">` : ''}</div>
                    <div class="wc-shop-cart-main">
                        <strong>${wcEscapeHtml(item.name)}</strong>
                        <span>${wcEscapeHtml(item.tag || '商品')} · 单价 ¥${Number(item.price || 0).toFixed(2)}</span>
                        ${item.description ? `<p>${wcEscapeHtml(item.description)}</p>` : ''}
                    </div>
                    <div class="wc-shop-cart-side">
                        <b>¥${(Number(item.price || 0) * (item.qty || 1)).toFixed(2)}</b>
                        <div class="wc-shop-qty">
                            <button onclick="updateWechatShopCartQty(${i}, -1)">−</button>
                            <span>${item.qty || 1}</span>
                            <button onclick="updateWechatShopCartQty(${i}, 1)">+</button>
                        </div>
                        <button class="wc-shop-remove" onclick="removeWechatShopCart(${i})">删除</button>
                    </div>
                </div>
            `).join('') : '<div class="wc-discover-empty wc-shop-empty-cart"><i class="ri-shopping-bag-3-line"></i><span>购物车为空</span><p>先去挑几件想买的东西</p><button onclick="renderWechatShop(\'home\')">去逛逛</button></div>'}
            <div class="wc-shop-total"><span>共 ${itemCount} 件</span><strong>合计 ¥${total.toFixed(2)}</strong></div>
            <textarea id="wc-shop-address" placeholder="填写收货地址">${wcEscapeHtml(store.lastAddress || '')}</textarea>
            <div class="wc-shop-payer-picker">
                <input type="hidden" id="wc-shop-payer" value="${wcEscapeHtml(store.lastPayer || 'self')}">
                <button type="button" data-payer-id="self" class="${store.lastPayer === 'self' || !store.lastPayer ? 'active' : ''}" onclick="selectWechatShopPayer('self')"><i class="ri-wallet-3-line"></i><span>自己付款</span></button>
                ${(window.myCharacters || []).map(c => `<button type="button" data-payer-id="${wcEscapeHtml(c.id)}" class="${store.lastPayer === c.id ? 'active' : ''}" onclick="selectWechatShopPayer('${wcEscapeHtml(c.id)}')"><img src="${wcEscapeHtml(c.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'"><span>${wcEscapeHtml((c.chatConfig && c.chatConfig.nickname) || c.name)}</span></button>`).join('')}
            </div>
            <div class="wc-shop-cart-actions">
                <button onclick="renderWechatShop('home')">继续逛</button>
                <button onclick="clearWechatShopCart()" ${store.cart.length ? '' : 'disabled'}>清空</button>
            </div>
            <button class="wc-shop-checkout" onclick="checkoutWechatShop()" ${store.cart.length ? '' : 'disabled'}>结账 / 发送代付</button>
            <button class="wc-shop-intimate" onclick="requestWechatShopIntimatePay()" ${store.cart.length ? '' : 'disabled'}>让角色开通亲密付</button>
        </div>
    `;
}

function renderWechatShopMe(store) {
    return `
        <div class="wc-shop-me-card">
            <strong>我的购物</strong>
            <span>订单 ${store.orders.length} · 商品 ${store.custom.length}</span>
        </div>
        <div class="wc-shop-cart">
            <h4>亲密付</h4>
            ${Object.keys(store.intimatePay || {}).length ? Object.entries(store.intimatePay).map(([charId, item]) => {
                const char = (window.myCharacters || []).find(c => c.id === charId);
                return `<div class="wc-shop-order"><strong>¥${Number(item.limit || 0).toFixed(2)}</strong><span>${wcEscapeHtml(char ? getWechatCharDisplayName(char) : '角色')} · ${wcEscapeHtml(item.status || '已开通')}</span><em>${wcEscapeHtml(item.note || '可用于购物代付')}</em></div>`;
            }).join('') : '<div class="wc-discover-empty">还没有亲密付</div>'}
        </div>
        <div class="wc-shop-cart">
            <h4>订单记录</h4>
            ${store.orders.length ? store.orders.slice().reverse().map(order => `
                <div class="wc-shop-order">
                    <strong>¥${Number(order.total || 0).toFixed(2)}</strong>
                    <span>${formatWechatRelativeTime(order.createdAt)} · ${wcEscapeHtml(order.payer === 'self' ? '自己付款' : '代付请求')}</span>
                    <em>${wcEscapeHtml(getWechatShopCartSummary(order.items || []))}</em>
                </div>
            `).join('') : '<div class="wc-discover-empty">还没有订单</div>'}
        </div>
    `;
}

function addWechatShopCart(productId) {
    const product = getWechatShopProducts().find(p => p.id === productId);
    if (!product) return;
    const store = getWechatShopStore();
    const existing = store.cart.find(item => String(item.id) === String(product.id));
    if (existing) {
        existing.qty = Math.min(99, (parseInt(existing.qty || 1, 10) || 1) + 1);
    } else {
        store.cart.push(normalizeWechatShopCartItem({
            id: product.id,
            name: product.name,
            price: product.price,
            tag: product.tag,
            image: product.image,
            description: product.description,
            gradient: product.gradient
        }));
    }
    saveWechatShopStore(store);
    showWechatToast('已加入购物车');
    renderWechatShop(window._wechatShopTab === 'cart' ? 'cart' : 'home', document.querySelector('.wc-shop-search input')?.value || window._wechatShopKeyword || '');
}

function removeWechatShopCart(index) {
    const store = getWechatShopStore();
    store.cart.splice(index, 1);
    saveWechatShopStore(store);
    renderWechatShop('cart');
}

function updateWechatShopCartQty(index, delta) {
    const store = getWechatShopStore();
    const item = store.cart[index];
    if (!item) return;
    item.qty = (parseInt(item.qty || 1, 10) || 1) + delta;
    if (item.qty <= 0) store.cart.splice(index, 1);
    if (item.qty > 99) item.qty = 99;
    saveWechatShopStore(store);
    renderWechatShop('cart');
}

function clearWechatShopCart() {
    const store = getWechatShopStore();
    if (!store.cart.length) return;
    if (!confirm('确定清空购物车吗？')) return;
    store.cart = [];
    saveWechatShopStore(store);
    renderWechatShop('cart');
}

function normalizeWechatShopSourceProducts(payload, sourceName = '聚合源') {
    const rawList = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.products) ? payload.products : (Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload?.data) ? payload.data : [])));
    return rawList
        .map((item, index) => normalizeWechatShopProductForDisplay({
            ...item,
            id: `src_${sourceName}_${item.id || Date.now()}_${index}`,
            source: sourceName
        }, index, sourceName))
        .filter(item => item && item.price > 0)
        .slice(0, 40);
}

async function loadWechatShopSource(options = {}) {
    const btn = document.querySelector('.wc-shop-refresh-btn, .wc-shop-source-card button');
    const store = getWechatShopStore();
    const keyword = options.keyword ?? document.querySelector('.wc-shop-search input')?.value ?? window._wechatShopKeyword ?? '';
    const silent = !!options.silent;
    store.sourceUrl = WECHAT_SHOP_AGGREGATE_SOURCE_ID;
    saveWechatShopStore(store);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ri-loader-4-line"></i><span>更新中</span>';
    }
    try {
        const payloads = await Promise.allSettled(WECHAT_SHOP_AGGREGATE_SOURCES.map(async source => {
            const url = source.url.includes('{q}')
                ? source.url.replace(/\{q\}/g, encodeURIComponent(keyword || ''))
                : source.url;
            const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
            if (!resp.ok) throw new Error(`${source.name} 返回 ${resp.status}`);
            const json = await resp.json();
            return normalizeWechatShopSourceProducts(json, source.name);
        }));
        const products = payloads.flatMap(result => result.status === 'fulfilled' ? result.value : []);
        if (!products.length) throw new Error('没有解析到商品');
        const next = getWechatShopStore();
        next.sourceUrl = WECHAT_SHOP_AGGREGATE_SOURCE_ID;
        next.sourceSyncedAt = Date.now();
        next.sourceProducts = products.slice(0, 48);
        saveWechatShopStore(next);
        if (!silent) showWechatToast(`已更新 ${next.sourceProducts.length} 个商品`);
        renderWechatShop('home', keyword);
    } catch (e) {
        if (!silent) showWechatToast(e.message || '商品更新失败');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="ri-refresh-line"></i>';
        }
    }
}

function addWechatCustomProduct() {
    const name = (document.getElementById('wc-shop-custom-name')?.value || '').trim();
    const price = Number(document.getElementById('wc-shop-custom-price')?.value || 0);
    const tag = (document.getElementById('wc-shop-custom-tag')?.value || '自定义').trim();
    const image = (document.getElementById('wc-shop-custom-image')?.value || '').trim();
    const description = (document.getElementById('wc-shop-custom-desc')?.value || '').trim();
    if (!name || price <= 0) return;
    const store = getWechatShopStore();
    store.custom.push({ id: 'cp_' + Date.now(), name, price, tag, image, description, gradient: getWechatGeneratedGradient(name + tag)[0] });
    saveWechatShopStore(store);
    renderWechatShop('home');
}

async function generateWechatShopProduct() {
    const briefEl = document.getElementById('wc-shop-ai-brief');
    const btn = document.querySelector('.wc-shop-ai-card button');
    const brief = (briefEl?.value || '').trim() || '适合微信购物页的真实感商品';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中';
    }
    const result = await callChatApi([
        { role: 'system', content: '你是电商商品策划。只输出 JSON 对象，不要解释。字段：name、tag、price、description、imagePrompt，可选 imageUrl。标题和内容要像淘宝商品但不要夸张营销。' },
        { role: 'user', content: `生成一个商品：${brief}。如果不能直接生成图片 URL，就写 imagePrompt。` }
    ], { usageFeature: 'discover' });
    const parsed = result.ok ? parseWechatAiJsonPayload(result.content) : null;
    if (!result.ok || !parsed) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'AI 生成商品';
        }
        alert(result.ok ? 'AI 返回格式无法解析，再试一次。' : result.error);
        return;
    }
    const product = Array.isArray(parsed) ? parsed[0] : parsed;
    const name = String(product.name || product.title || '').trim();
    if (!name) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'AI 生成商品';
        }
        alert('AI 没有返回商品标题，再试一次。');
        return;
    }
    const imagePrompt = String(product.imagePrompt || product.prompt || product.description || name).trim();
    let image = String(product.imageUrl || product.image || '').trim();
    if (!image && imagePrompt) {
        const imageResult = await callWechatImageGenerationApi(`电商商品主图，干净真实，白底或浅色场景，主体清晰：${imagePrompt}`);
        if (imageResult.ok) image = imageResult.url;
    }
    const store = getWechatShopStore();
    store.custom.unshift({
        id: 'cp_ai_' + Date.now(),
        name,
        tag: String(product.tag || product.category || 'AI生成').trim(),
        price: Number(product.price || 99),
        description: String(product.description || product.content || imagePrompt || '').trim(),
        image,
        gradient: getWechatGeneratedGradient(name + brief)[0]
    });
    saveWechatShopStore(store);
    renderWechatShop('home');
}

