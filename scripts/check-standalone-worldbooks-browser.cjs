'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/standalone-worldbooks');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [], alerts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
    const ready = async () => {
        await page.waitForFunction(() => window.__byndCoreReady && typeof getStandaloneWorldBooks === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady; await window._wechatCharactersLoadPromise;
            unlockPhone(); window.ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime');
        });
    };
    const openBook = async () => {
        await page.evaluate(() => openApp('worldbook'));
        await page.locator('.wb-book').filter({ hasText: '表情包链接' }).click();
        await page.locator('.wb-character-bindings summary').waitFor();
    };
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await ready();
        await page.evaluate(async () => { window.myCharacters = []; await saveCharactersToStorage(); openApp('worldbook'); });
        await page.locator('#app-worldbook-window .ri-add-line').click();
        await page.locator('#wb-book-name').fill('表情包链接');
        await page.locator('#wb-create-book-modal button').click();
        assert.equal(await page.evaluate(() => window.myCharacters.length), 0);
        assert.equal(await page.locator('.wb-book').count(), 1, 'A library without contacts still displays independent books');
        await page.evaluate(async () => {
            const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#bdc7d1"/></svg>');
            window.myCharacters = [
                { id: 'wb-a', name: '林间', avatar, worldBook: [{ keys: ['居所'], content: '住在海边' }], history: [], chatConfig: { promptWorldBookIds: [] } },
                { id: 'wb-b', name: '未关联角色', avatar, worldBook: [], history: [], chatConfig: {} },
            ];
            if (!await saveCharactersToStorage()) throw Error('Fixture contacts were not saved');
            initWorldBook();
        });
        await openBook();
        await page.evaluate(() => chooseWorldBookImport());
        await page.locator('#wb-import-file').setInputFiles({ name: 'stickers.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ entries: [{ keys: ['表情'], content: '开心：https://i.postimg.cc/worldbook/happy.png' }, { keys: ['资料'], content: '共享资料来自独立世界书' }] })) });
        await page.waitForFunction(() => getStandaloneWorldBooks()[0].worldBook.length === 2);
        await page.locator('.wb-character-bindings summary').click();
        await page.locator('[data-wb-character-id="wb-a"]').check();
        await page.waitForFunction(() => getStandaloneWorldBooks()[0].characterIds.includes('wb-a'));
        const proof = await page.evaluate(async () => {
            const [a, b] = window.myCharacters;
            const backup = await buildByndBackupData();
            return {
                contacts: window.myCharacters.length,
                prompt: buildMessages(a, [{ isMe: true, type: 'text', content: '你好' }]).map(row => JSON.stringify(row.content)).join('\n'),
                otherPrompt: buildSystemPrompt(b),
                stickers: getWechatWorldBookStickerEntries(a),
                otherStickers: getWechatWorldBookStickerEntries(b),
                backup: backup.bynd_worldbooks_v1,
            };
        });
        assert.equal(proof.contacts, 2);
        assert.match(proof.prompt, /共享资料来自独立世界书/);
        assert.doesNotMatch(proof.otherPrompt, /共享资料来自独立世界书/);
        assert.equal(proof.stickers[0].url, 'https://i.postimg.cc/worldbook/happy.png');
        assert.equal(proof.otherStickers.length, 0);
        assert.equal(proof.backup[0].characterIds[0], 'wb-a');
        const cdp = await context.newCDPSession(page);
        for (const [width, safe, parentReserved] of [[320, 47, false], [375, 59, false], [320, 47, true], [375, 59, true]]) {
            await page.setViewportSize({ width, height: 844 });
            await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: safe, bottom: 24, left: 0, right: 0 } });
            await page.evaluate(parentReserved => {
                document.documentElement.classList.add('bynd-ios');
                document.body.style.paddingTop = parentReserved ? 'env(safe-area-inset-top)' : '0';
                const phone = document.querySelector('.phone-container');
                phone.style.height = parentReserved ? 'calc(100dvh - env(safe-area-inset-top))' : '100dvh';
                phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : 'env(safe-area-inset-top)');
            }, parentReserved);
            const geometry = await page.locator('#app-worldbook-window .window-header').evaluate(header => {
                const title = header.querySelector('h3').getBoundingClientRect();
                return { titleTop: title.top, right: header.getBoundingClientRect().right, overflow: header.scrollWidth > header.clientWidth + 1 };
            });
            assert.ok(geometry.titleTop >= safe && geometry.right <= width + 1 && !geometry.overflow, JSON.stringify(geometry));
            await page.screenshot({ path: path.join(output, `book-${width}-${safe}-parent-${parentReserved}.png`) });
        }
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 0, left: 0, right: 0 } });
        await page.evaluate(() => { document.body.style.paddingTop = '0'; closeApp('worldbook'); openApp('wechat'); openChat('wb-a'); openChatSettings(); openWechatChatSettingsPage('memory'); });
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(theme => theme.id));
        for (const theme of themes) {
            await page.evaluate(theme => { selectWechatUiTheme(theme); window.ByndBuiltinLibrary?.close(); }, theme);
            assert.equal(await page.locator('#wcs-prompt-worldbook-list [data-worldbook-shared="true"]:checked').count(), 2);
            for (const width of [320, 375]) {
                await page.setViewportSize({ width, height: 844 });
                await page.evaluate(() => window.ByndBuiltinLibrary?.close());
                const bounds = await page.locator('#wcs-prompt-worldbook-list').evaluate(node => ({ overflow: node.scrollWidth > node.clientWidth + 1 }));
                assert.ok(!bounds.overflow, theme);
                await page.screenshot({ path: path.join(output, `${theme}-${width}.png`) });
            }
        }
        await page.locator('#wcs-prompt-worldbook-list [data-worldbook-shared="true"]').first().uncheck();
        assert.equal(await page.evaluate(() => saveChatSettings()), true);
        assert.equal(await page.evaluate(() => getWechatWorldBookStickerEntries(window.myCharacters[0]).length), 0);
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
        assert.equal(await page.evaluate(() => window.myCharacters.length), 2);
        assert.equal(await page.evaluate(() => getStandaloneWorldBooks()[0].worldBook.length), 2);
        assert.equal(await page.evaluate(() => getCharacterWorldBookEntries(window.myCharacters[0]).length), 1);
        assert.deepEqual(errors, []);
        assert.ok(alerts.some(message => /已导入 2 条/.test(message)));
        console.log(`Standalone worldbooks passed: create without contacts, import, explicit association, prompt/sticker isolation, backup, saved selections and reload; ${themes.length} themes at 320/375px and 47/59px safe areas.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
