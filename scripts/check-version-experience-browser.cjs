const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/version-experience');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), errors = [], checks = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.addInitScript(() => {
            if (localStorage.getItem('proof-seeded')) return;
            localStorage.setItem('proof-seeded', '1');
            localStorage.setItem('bynd_lastSeenVersion', '1.1.704');
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        });
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.locator('#bynd-version-letter').waitFor();
        assert.match(await page.locator('.bynd-letter-title').textContent(), /BYND 更新来信/);
        assert.equal(await page.locator('.bynd-letter-art').evaluate(img => img.complete && img.naturalWidth > 0), true);
        const version = await page.evaluate(() => ByndVersionLetter.currentVersion);
        assert.equal(await page.evaluate(() => localStorage.getItem(ByndVersionLetter.storageKey)), version);
        await page.screenshot({ path: path.join(output, 'receipt-375.png') });
        await page.setViewportSize({ width: 375, height: 1300 });
        const receiptBottom = await page.locator('.bynd-letter-ticket').evaluate(node => node.getBoundingClientRect().bottom);
        await page.screenshot({ path: path.join(output, 'receipt-full.png'), clip: { x: 0, y: 0, width: 375, height: Math.min(1300, Math.ceil(receiptBottom + 30)) } });
        for (const [width, height] of [[320, 568], [430, 932]]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(() => document.querySelector('.phone-container').style.setProperty('--bynd-header-safe-top', '47px'));
            const dimensions = await page.locator('.bynd-letter-scroll').evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, top: node.getBoundingClientRect().top }));
            assert.ok(dimensions.scrollWidth <= dimensions.width + 1 && dimensions.top >= 47, JSON.stringify({ width, dimensions }));
            await page.screenshot({ path: path.join(output, `receipt-${width}.png`) });
        }
        await page.setViewportSize({ width: 375, height: 844 });
        await page.evaluate(() => document.querySelector('.phone-container').style.removeProperty('--bynd-header-safe-top'));
        await page.locator('.bynd-letter-go').click();
        assert.equal(await page.locator('#bynd-version-letter').count(), 0);
        await page.waitForFunction(() => document.querySelector('.bynd-feature-dot'));
        const dot = await page.locator('.bynd-feature-dot').first().evaluate(node => { const s = getComputedStyle(node), r = node.getBoundingClientRect(); return { width: r.width, height: r.height, color: s.backgroundColor, text: node.textContent }; });
        assert.ok(dot.width <= 9 && dot.height <= 9); assert.equal(dot.color, 'rgb(228, 91, 86)'); assert.equal(dot.text, '');
        await page.screenshot({ path: path.join(output, 'discovery-dot.png') });
        await page.evaluate(() => openApp('settings'));
        assert.equal(await page.locator('[data-app-id="settings"] .bynd-feature-dot, [data-layout-id="app-settings"] .bynd-feature-dot').count(), 0);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.ByndExperience && window.__byndCoreReady);
        await page.evaluate(async () => { await window.__byndCoreReady; unlockPhone(); });
        assert.equal(await page.locator('#bynd-version-letter').count(), 0);
        assert.equal(await page.locator('[data-app-id="settings"] .bynd-feature-dot, [data-layout-id="app-settings"] .bynd-feature-dot').count(), 0);
        await page.evaluate(() => {
            window.myCharacters = [{ id: 'proof', name: '林间', avatar: getUserProfile().avatar || document.getElementById('wcs-user-avatar').src, description: '喜欢阅读。', history: [{ type: 'text', isMe: true, content: '周年那天一起去海边', timestamp: Date.now() }], worldBook: [{ id: 'sea', name: '海边小城', content: '住在海边的小城。' }], chatConfig: { generatedImages: [{ id: 'photo-proof', charId: 'proof', charName: '林间', url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', createdAt: Date.now() }] } }];
            ByndBuiltinLibrary?.close();
        });
        const found = await page.evaluate(async () => {
            const queries = ['气泡', 'Token', '周年', '世界书', '海边小城'];
            const matches = {};
            for (const q of queries) matches[q] = (await ByndSearch.search(q)).map(item => ({ title: item.title, detail: item.detail }));
            return matches;
        });
        for (const q of Object.keys(found)) assert.ok(found[q].length, `search finds ${q}`);
        assert.equal(await page.locator('#home-screen .bynd-desktop-search').count(), 0);
        await page.evaluate(() => openApp('settings'));
        await page.locator('#app-settings-window .bynd-settings-search').click();
        await page.locator('#bynd-global-search input').fill('气泡');
        await page.locator('.bynd-search-result').first().waitFor();
        await page.screenshot({ path: path.join(output, 'search-bubble.png') });
        await page.locator('.bynd-search-result').filter({ hasText: '聊天外观' }).first().click();
        assert.equal(await page.locator('[data-chat-settings-page="appearance"]').isVisible(), true);
        await page.evaluate(() => { closeChatSettings(); openApp('settings'); openSettingsTab('about'); });
        await page.locator('.bynd-history-replay').click();
        await page.screenshot({ path: path.join(output, 'receipt-review.png') });
        await page.locator('.bynd-letter-go').click();
        assert.equal(await page.evaluate(() => localStorage.getItem(ByndVersionLetter.storageKey)), version);
        // Delete a favorite, add a new one, then Undo: later content must survive.
        await page.evaluate(() => {
            openApp('wechat');
            saveWechatFavoritesStore({ items: [{ id: 'old-fav', title: '旧收藏', text: '一张明信片' }] });
            openWechatFavorites(); deleteWechatFavorite('old-fav');
            saveWechatFavoritesStore({ items: [{ id: 'new-fav', title: '新收藏', text: '另一张明信片' }] });
        });
        await page.locator('#bynd-undo-tray button').click();
        assert.deepEqual(await page.evaluate(() => getWechatFavoritesStore().items.map(item => item.id).sort()), ['new-fav', 'old-fav']);
        // Force a real storage failure: no success banner, original favorite retained.
        await page.evaluate(() => {
            window._proofSet = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) { if (key === WECHAT_FAVORITES_STORAGE_KEY) throw Error('quota'); return window._proofSet.call(this, key, value); };
            window._proofRemove = deleteWechatFavorite('old-fav');
        });
        assert.equal(await page.evaluate(() => window._proofRemove), false);
        assert.ok(await page.evaluate(() => getWechatFavoritesStore().items.some(item => item.id === 'old-fav')));
        await page.evaluate(() => { Storage.prototype.setItem = window._proofSet; });
        checks.push({ receipt: 'passed', dots: dot, upgradeOnce: true, search: found, undo: 'passed', failedDeletePreserved: true });
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ version, checks, errors }, null, 2));
        console.log('Version receipt, discovery dots, global search and undo browser checks passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
