'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/wechat-shop-themes');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } }), errors = [], checks = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
        await page.waitForFunction(() => typeof openWechatShop === 'function');
        await page.addStyleTag({ content: '.tapfx-layer{visibility:hidden!important}' });
        await page.evaluate(async () => {
            await byndStylesReady; await window._wechatCharactersLoadPromise; unlockPhone();
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            window.myCharacters = []; openApp('wechat'); ByndBuiltinLibrary?.close();
            scheduleWechatShopSourceLoad = () => {};
            ensureWechatShopProductImage = async () => {};
            const products = [0, 1].map(i => ({ id: 'shop-theme-' + i, name: i ? '日常护理单品' : '纤长睫毛膏', price: 9.99 + i * 10, tag: '美妆个护', description: '日常护理、通勤或约会都可以使用。', source: '主题检查', gradient: 'linear-gradient(135deg,#ff8000,#dd70ab)', image: '' }));
            window._shopThemeProducts = products;
            saveWechatShopStore({ cart: [], custom: [], orders: [], sourceProducts: products, sourceSyncedAt: Date.now(), intimatePay: {}, lastAddress: '', lastPayer: 'self' });
            const phone = document.querySelector('.phone-container');
            phone.style.cssText += ';position:absolute!important;inset:0!important;width:100vw!important;max-width:none!important;height:100dvh!important;max-height:none!important;transform:none!important;border:0!important;border-radius:0!important;margin:0!important;--bynd-header-safe-top:59px;';
            openWechatShop();
        });
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(t => t.id));
        for (const width of [375, 320]) {
            await page.setViewportSize({ width, height: 844 });
            for (const theme of themes) {
                await page.evaluate(theme => { localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, theme); applyWechatUiTheme(theme); renderWechatShop('home'); }, theme);
                await page.screenshot({ path: path.join(output, `home-${theme}-${width}.png`) });
                const state = await page.evaluate(() => {
                    const root = document.getElementById('app-wechat-window'), bar = document.querySelector('.wc-shop-tabbar');
                    const probe = document.createElement('span'); probe.style.color = getComputedStyle(root).getPropertyValue('--wc-theme-accent'); root.appendChild(probe);
                    const expected = getComputedStyle(probe).color; probe.remove();
                    return { accent: getComputedStyle(bar.querySelector('.active')).color, expected, radius: getComputedStyle(bar).borderRadius, cardRadius: getComputedStyle(document.querySelector('.wc-shop-card')).borderRadius, background: getComputedStyle(document.querySelector('.wc-shop-app')).backgroundImage, barBottom: bar.getBoundingClientRect().bottom, frameBottom: document.getElementById('wc-feature-screen').getBoundingClientRect().bottom, overflow: document.querySelector('.wc-shop-app').scrollWidth > document.querySelector('.wc-shop-app').clientWidth };
                });
                assert.equal(state.accent, state.expected, theme + ': shop active colour follows theme');
                assert.equal(state.overflow, false);
                assert.ok(state.barBottom <= state.frameBottom + 1, 'navigation is not clipped');
                if (theme === 'pixel') { assert.equal(state.radius, '1px'); assert.equal(state.cardRadius, '1px'); assert.equal(state.background, 'none'); }
                checks.push({ theme, width, ...state });
                for (const tab of ['cart', 'me']) {
                    await page.evaluate(tab => renderWechatShop(tab), tab);
                    await page.screenshot({ path: path.join(output, `${tab}-${theme}-${width}.png`) });
                }
                await page.evaluate(() => { const s = getWechatShopStore(); s.cart = [{ ...window._shopThemeProducts[0], qty: 2 }]; saveWechatShopStore(s); renderWechatShop('cart'); });
                await page.screenshot({ path: path.join(output, `cart-filled-${theme}-${width}.png`) });
                await page.evaluate(() => openWechatShopProduct('shop-theme-0'));
                await page.screenshot({ path: path.join(output, `detail-${theme}-${width}.png`) });
                assert.equal(await page.locator('.wc-shop-app').evaluate(el => el.scrollWidth > el.clientWidth), false);
                await page.evaluate(() => { const s = getWechatShopStore(); s.cart = []; saveWechatShopStore(s); });
            }
        }
        for (const safe of [47, 59]) for (const mode of ['parent', 'header']) {
            await page.evaluate(({ safe, mode }) => {
                const phone = document.querySelector('.phone-container');
                phone.style.setProperty('top', (mode === 'parent' ? safe : 0) + 'px', 'important');
                phone.style.setProperty('height', `calc(100dvh - ${mode === 'parent' ? safe : 0}px)`, 'important');
                phone.style.setProperty('--bynd-header-safe-top', (mode === 'header' ? safe : 0) + 'px');
                renderWechatShop('home');
            }, { safe, mode });
            assert.ok((await page.locator('.wc-feature-header > i').boundingBox()).y >= safe);
            assert.equal(Math.round((await page.locator('.wc-feature-header').boundingBox()).height), 48 + (mode === 'header' ? safe : 0));
        }
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(checks, null, 2));
        assert.deepEqual(errors, []);
        console.log(`WeChat shop: ${themes.length} themes at 320/375px; home, empty/filled cart, me, detail, 47/59px safe areas passed.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
