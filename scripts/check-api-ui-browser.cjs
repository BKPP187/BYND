'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/api-ui');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [], palettes = [];
    let modelRequests = 0, paidRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        if (route.request().method() === 'POST') { paidRequests++; return route.abort(); }
        return route.continue();
    });
    const iconCache = path.join(root, '.qa-screenshots/ui-audit-20261021');
    if (fs.existsSync(path.join(iconCache, 'remixicon.woff2'))) {
        await page.route('https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/**', route => {
            const font = route.request().url().includes('.woff2');
            return route.fulfill({ path: path.join(iconCache, font ? 'remixicon.woff2' : 'remixicon.css'), contentType: font ? 'font/woff2' : 'text/css', headers: { 'access-control-allow-origin': '*' } });
        });
    }
    await page.route('https://ui-fixture.test/**', route => {
        modelRequests++;
        return route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: { message: '测试密钥无效' } }) });
    });
    async function capture(name) {
        if (await page.locator('.tapfx-burst').count()) await page.waitForTimeout(1100);
        await page.screenshot({ path: path.join(output, `${name}.png`) });
    }
    async function inViewport(locator) { return locator.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0; }); }
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openChat === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady; await window._wechatCharactersLoadPromise;
            unlockPhone(); window.ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime');
            const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#c6d5cf"/><circle cx="50" cy="38" r="17" fill="#66847b"/><ellipse cx="50" cy="93" rx="37" ry="32" fill="#66847b"/></svg>');
            window.myCharacters = [{ id: 'ui-char', name: '林间', avatar, chatConfig: {}, history: [] }];
            saveApiData({ defaultId: 'ui-api', apis: [{ id: 'ui-api', name: '我的聊天接口', baseUrl: 'https://ui-fixture.test/v1', apiKey: 'fixture-key', model: 'fixture-chat', imageModel: '' }] });
            openApp('settings'); openSettingsTab('api');
        });
        await page.waitForTimeout(400);
        await page.evaluate(() => openApp('bill'));
        await page.waitForTimeout(30);
        await page.locator('#app-bill-window .bill-close').click();
        await page.waitForTimeout(30);
        assert(await page.locator('#app-settings-window').evaluate(el => el.classList.contains('active')), 'Closing the bill should return to settings');
        assert.equal(await page.locator('#app-bill-window').evaluate(el => el.classList.contains('active')), false);
        await page.evaluate(() => { window.__uiApiFixture = getApiData(); saveApiData({ apis: [] }); renderApiList(); });
        assert.match(await page.locator('#api-list-container').innerText(), /还没有接口/);
        await capture('api-empty');
        await page.evaluate(() => { saveApiData(window.__uiApiFixture); renderApiList(); });
        for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            assert.equal(await page.locator('.api-image-options').getAttribute('open'), null);
            assert(await inViewport(page.locator('.api-card').first()));
            assert.equal(await page.locator('#settings-tab-api button[onclick="openApiModal()"]:visible').count(), 1);
            await capture(`api-home-${width}`);
        }
        await page.locator('.api-image-options > summary').click();
        await page.evaluate(() => renderApiList());
        assert.equal(await page.locator('.api-image-options').evaluate(el => el.open), true);
        assert(await page.locator('.image-service button[onclick="openNovelAiImageModal()"]:visible').count());
        await capture('api-image-options');
        await page.locator('.api-image-options > summary').click();
        await page.locator('.api-card-more summary').click();
        assert(await page.locator('.api-card-menu button').first().isVisible());
        await page.locator('.api-list-heading h3').click();
        assert.equal(await page.locator('.api-card-more').evaluate(el => el.open), false);
        await page.evaluate(() => openApiModal('ui-api'));
        assert.equal(await page.locator('.api-model-trigger').first().innerText(), 'fixture-chat');
        for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            await capture(`api-editor-${width}`);
            const bounds = await page.locator('.api-editor-card').boundingBox();
            assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
            assert(await inViewport(page.locator('#api-edit-modal .api-save-button')));
        }
        await page.locator('.api-model-trigger').first().click();
        await page.locator('.api-model-option').first().click();
        await page.evaluate(() => {
            window.__uiSaveApiData = saveApiData;
            saveApiData = () => { throw Error('测试：存储空间不足 <b>保留输入</b>'); };
            saveApi();
        });
        assert(await page.locator('#api-edit-modal').isVisible());
        assert.match(await page.locator('#api-test-result').innerText(), /保存失败.*存储空间不足.*<b>保留输入<\/b>/);
        assert.equal(await page.locator('#api-test-result b').count(), 0);
        assert.equal(await page.locator('#api-edit-name').inputValue(), '我的聊天接口');
        await capture('api-save-failure');
        await page.evaluate(() => { saveApiData = window.__uiSaveApiData; });
        await page.locator('#api-edit-modal .api-test-button').click();
        await page.waitForFunction(() => /401|密钥/.test(document.getElementById('api-test-result').textContent));
        assert.doesNotMatch(await page.locator('#api-test-result').innerText(), /连接成功/);
        await capture('api-connection-failure');
        assert(modelRequests > 0);
        await page.locator('#api-edit-modal .api-save-button').click();
        assert.equal(await page.locator('#api-edit-modal').isVisible(), false);
        // Verify both possible owners of native iPhone top safe area.
        const cdp = await page.context().newCDPSession(page);
        for (const top of [47, 59]) for (const parentReserved of [false, true]) {
            await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, bottom: 24, left: 0, right: 0 } });
            await page.evaluate(({ parentReserved }) => {
                document.documentElement.classList.add('bynd-ios');
                document.body.style.paddingTop = parentReserved ? 'env(safe-area-inset-top)' : '0px';
                const phone = document.querySelector('.phone-container');
                phone.style.height = parentReserved ? 'calc(100dvh - env(safe-area-inset-top))' : '100dvh';
                phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : 'env(safe-area-inset-top)');
            }, { parentReserved });
            const header = await page.locator('#app-settings-window > .window-header').boundingBox();
            const close = await page.locator('#app-settings-window > .window-header .close-btn').boundingBox();
            assert(close.y >= top - 1, `Header overlaps ${top}px native area`);
            assert(Math.abs(header.y + header.height - (top + 52)) < 2, 'Top inset was reserved twice');
            await page.evaluate(() => openApiModal('ui-api'));
            const modal = await page.locator('.api-editor-card').boundingBox();
            assert(modal.y >= top && modal.y + modal.height <= 844 - 24);
            await capture(`api-safe-${top}-${parentReserved ? 'parent' : 'header'}`);
            await page.evaluate(() => closeApiModal());
        }
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 0, left: 0, right: 0 } });
        await page.evaluate(() => {
            document.documentElement.classList.remove('bynd-ios');
            document.body.style.paddingTop = '';
            const phone = document.querySelector('.phone-container'); phone.style.height = ''; phone.style.removeProperty('--bynd-header-safe-top');
            closeApp('settings'); openApp('wechat'); openChat('ui-char');
        });
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(theme => theme.id));
        await page.evaluate(() => { resolveWechatAiGeneratedImage = async () => {}; });
        for (const theme of themes) {
            await page.evaluate(theme => {
                selectWechatUiTheme(theme); window.ByndBuiltinLibrary?.close();
                window.myCharacters[0].history = [{ type: 'image', content: '', imageError: '整理生图标签失败：测试错误 <img src=x onerror=alert(1)>；图片生成请求尚未发出。', timestamp: Date.now() }];
                refreshChatView(window.myCharacters[0]);
            }, theme);
            await page.waitForTimeout(400);
            for (const width of [320, 375]) {
                await page.setViewportSize({ width, height: 844 });
                const status = page.locator('.wc-image-status');
                assert.equal(await status.locator('details').evaluate(el => el.open), false);
                assert.equal(await status.locator('img').count(), 0);
                assert.equal(await status.locator('strong').innerText(), '图片暂未生成');
                const bounds = await status.boundingBox();
                assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${theme} ${width}: ${JSON.stringify(bounds)}`);
                const style = await status.evaluate(el => { const s = getComputedStyle(el); return { background: s.backgroundColor, radius: s.borderRadius, font: s.fontFamily }; });
                palettes.push({ theme, width, ...style });
                if (theme === 'pixel') assert.equal(style.radius, '2px');
                await capture(`image-error-${theme}-${width}`);
                await page.evaluate(() => {
                    window.__uiErrorFixture = window.myCharacters[0].history[0];
                    window.myCharacters[0].history = [{ type: 'image', content: '', imagePending: true, timestamp: Date.now() }];
                    refreshChatView(window.myCharacters[0]);
                });
                assert.equal(await status.getAttribute('role'), 'status');
                assert(await status.isVisible());
                await capture(`image-pending-${theme}-${width}`);
                await page.evaluate(() => {
                    window.myCharacters[0].history = [{ type: 'image', content: window.myCharacters[0].avatar, timestamp: Date.now() }];
                    refreshChatView(window.myCharacters[0]);
                });
                await page.locator('.image-bubble img').waitFor({ state: 'visible' });
                assert.equal(await status.count(), 0);
                await capture(`image-success-${theme}-${width}`);
                await page.evaluate(() => { window.myCharacters[0].history = [window.__uiErrorFixture]; refreshChatView(window.myCharacters[0]); });
            }
        }
        assert(new Set(palettes.map(item => item.background)).size >= 4, 'Image status did not follow theme colors');
        await page.evaluate(() => { selectWechatUiTheme('bynd'); window.ByndBuiltinLibrary?.close(); });
        await page.locator('.wc-image-status-detail summary').click();
        assert.match(await page.locator('.wc-image-status-detail p').innerText(), /尚未发出/);
        await capture('image-error-details');
        await page.locator('.wc-image-status-actions button').click();
        assert(await page.locator('#settings-tab-api').isVisible());
        await page.evaluate(() => {
            closeApp('settings'); openApp('wechat'); openChat('ui-char');
            resolveWechatAiGeneratedImage = async () => {};
            window.myCharacters[0].history = [{ type: 'image', content: '', imagePending: true, timestamp: Date.now() }];
            refreshChatView(window.myCharacters[0]);
        });
        await page.waitForTimeout(400);
        assert(await page.locator('.wc-image-status').isVisible());
        assert.equal(await page.locator('.wc-image-status').getAttribute('role'), 'status');
        await capture('image-pending');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.locator('.wc-image-status-heading i').evaluate(el => getComputedStyle(el).animationName), 'none');
        await page.evaluate(() => {
            window.myCharacters[0].history[0] = { type: 'image', content: window.myCharacters[0].avatar, timestamp: Date.now() };
            refreshChatView(window.myCharacters[0]);
        });
        await page.locator('.image-bubble img').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.image-status-bubble').count(), 0);
        assert(await page.locator('.image-bubble img').isVisible());
        await capture('image-success');
        await page.evaluate(() => { closeApp('wechat'); });
        await page.waitForTimeout(330);
        await page.evaluate(() => openApp('bill'));
        await page.waitForTimeout(30);
        await page.locator('#app-bill-window .bill-close').click();
        await page.waitForTimeout(30);
        assert.equal(await page.locator('.app-window.active').count(), 0, 'Opening the bill from the desktop still closes to the desktop');
        assert.equal(paidRequests, 0);
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ themes, palettes, modelRequests, paidRequests, errors }, null, 2));
        console.log(`API UI checks passed: 320/375px, 47/59px safe areas, save/connection failures, ${themes.length} chat themes, image states, reduced motion and zero paid requests.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
