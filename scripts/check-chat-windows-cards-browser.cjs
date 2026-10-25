'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/chat-windows-cards');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof createWechatChatWindow === 'function');
        await page.addStyleTag({ content: '.app-window{transition:none!important;animation:none!important}.tapfx-layer{display:none!important}' });
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady; await window._wechatCharactersLoadPromise;
            unlockPhone(); window.ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime');
            const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#8fa89a"/></svg>');
            window.myCharacters.splice(0, window.myCharacters.length,
                { id: 'qa_a', name: '温今北', description: '图书管理员，说话很轻。', avatar, first_mes_original: '你来啦。', first_mes: '你来啦。', worldBook: [{ keys: ['图书馆'], content: '城东老图书馆' }], regex: [], alternates: [], chatConfig: { nickname: '北北' }, history: [{ type: 'text', isMe: true, content: '主窗口剧情', timestamp: Date.now() - 1000 }] },
                { id: 'qa_b', name: '商桓', description: '冷面律师。', avatar, first_mes: '有事？', worldBook: [], regex: [], alternates: [], chatConfig: {}, history: [] });
            await saveCharactersToStorage();
            openApp('wechat');
            renderChatList();
            openChat('qa_a');
        });

        // Create a second window from chat settings → 聊天管理.
        await page.evaluate(() => { openChatSettings(); openWechatChatSettingsPage('management'); });
        await page.locator('#wcs-chat-windows .wcs-window-new').waitFor({ state: 'visible' });
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(output, 'settings-management.png') });
        await page.locator('#wcs-chat-windows .wcs-window-new').click();
        await page.waitForFunction(() => getWechatChatWindowFamily('qa_a').length === 2 && isWechatChatWindow(myCharacters.find(c => c.id === currentChatCharId)));
        const windowId = await page.evaluate(() => currentChatCharId);
        assert.match(await page.locator('#chat-room-title').innerText(), /窗口 2/);
        assert.match(await page.locator('#wc-float-name').innerText(), /窗口 2/);
        const isolated = await page.evaluate(id => JSON.stringify(myCharacters.find(c => c.id === id).history), windowId);
        assert.doesNotMatch(isolated, /主窗口剧情/);
        await page.screenshot({ path: path.join(output, 'window-2-chat.png') });

        // The chat list shows both windows; contacts still show one person.
        await page.evaluate(() => { closeChat(); renderChatList(); });
        assert.equal(await page.locator('#wc-chat-list .wc-window-badge').count(), 2);
        assert.deepEqual(await page.evaluate(() => getWechatGroupContacts().map(c => c.id)), ['qa_a', 'qa_b']);
        assert.equal(await page.evaluate(() => getMonitorCharacters().length), 3, 'monitoring keeps every window');
        assert.match(await page.evaluate(id => getMonitorCharName(myCharacters.find(c => c.id === id)), windowId), /北北 · 窗口 2/);

        // Theme sweep: badge colour follows each theme's list text colour.
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(t => t.id));
        for (const theme of themes) {
            const state = await page.evaluate(theme => {
                localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, theme); applyWechatUiTheme(theme); renderChatList();
                const badge = document.querySelector('#wc-chat-list .wc-window-badge');
                const name = badge?.closest('.wc-name');
                return { badge: !!badge, color: badge && getComputedStyle(badge).color, nameColor: name && getComputedStyle(name).color, overflow: name ? name.scrollWidth > name.clientWidth + 2 && getComputedStyle(name).overflow === 'visible' : false };
            }, theme);
            assert.ok(state.badge, `${theme}: badge rendered`);
            assert.equal(state.color, state.nameColor, `${theme}: badge follows the theme text colour`);
            await page.screenshot({ path: path.join(output, `list-${theme}.png`) });
        }
        await page.evaluate(() => { localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, 'wechat'); applyWechatUiTheme('wechat'); renderChatList(); });

        // Export the single card and import it back through the add-contact file input.
        await page.evaluate(() => { openChat('qa_a'); openChatSettings(); openWechatChatSettingsPage('management'); });
        const [pngDownload] = await Promise.all([page.waitForEvent('download'), page.locator('.wcs-export-row button').click()]);
        const pngPath = path.join(output, 'exported-card.png');
        await pngDownload.saveAs(pngPath);
        assert.equal(pngDownload.suggestedFilename(), '温今北.png');
        await page.evaluate(() => { closeChatSettings?.(); testAddCharacter(); });
        await page.locator('#import-card-file').setInputFiles(pngPath);
        await page.evaluate(() => hideActionSheet());
        await page.locator('#wc-char-modal:not(.hidden)').waitFor();
        assert.equal(await page.locator('#modal-char-name').inputValue(), '温今北');
        assert.equal(await page.evaluate(() => window.TEMP_PARSED_DATA.description), '图书管理员，说话很轻。');
        assert.equal(await page.evaluate(() => window.TEMP_PARSED_DATA.worldBook[0].content), '城东老图书馆');
        assert.equal(await page.locator('#wc-avatar-cropper-modal').isVisible(), true, 'the card image opens in the avatar cropper');
        await page.evaluate(() => closeWechatAvatarCropper());
        await page.screenshot({ path: path.join(output, 'import-single.png') });
        await page.evaluate(() => { closeCharModal(); window.TEMP_PARSED_DATA = null; });

        // Group card round trip.
        await page.evaluate(async () => {
            const group = { id: 'qa_group', name: '读书会', description: '周五见', avatar: '', isGroupChat: true, groupMembers: ['qa_a', 'qa_b'], chatConfig: {}, history: [] };
            myCharacters.unshift(group); await saveCharactersToStorage();
            openChat('qa_group'); openChatSettings(); openWechatChatSettingsPage('management');
        });
        assert.equal(await page.locator('#wcs-card-export-title').innerText(), '导出群聊卡');
        assert.equal(await page.locator('#wcs-chat-windows-wrap').isHidden(), true, 'groups have no window list');
        const [groupDownload] = await Promise.all([page.waitForEvent('download'), page.locator('.wcs-export-row button').click()]);
        const groupPath = path.join(output, 'exported-group.json');
        await groupDownload.saveAs(groupPath);
        const bundle = JSON.parse(fs.readFileSync(groupPath, 'utf8'));
        assert.equal(bundle.spec, 'bynd_group_card');
        assert.deepEqual(bundle.members.map(row => row.card.data.name), ['温今北', '商桓']);
        assert.doesNotMatch(JSON.stringify(bundle), /主窗口剧情/);
        const before = await page.evaluate(() => myCharacters.length);
        await page.evaluate(() => { closeChatSettings?.(); testAddCharacter(); });
        await page.locator('#import-card-file').setInputFiles(groupPath);
        await page.evaluate(() => hideActionSheet());
        await page.waitForFunction(n => myCharacters.length === n + 1, before);
        const imported = await page.evaluate(() => { const g = myCharacters.find(c => c.isGroupChat && c.id !== 'qa_group'); return { name: g.name, members: g.groupMembers }; });
        assert.equal(imported.name, '读书会');
        assert.deepEqual(imported.members, ['qa_a', 'qa_b'], 'identical contacts are reused');

        // Failure path: storage refuses the group, nothing is left behind.
        const failed = await page.evaluate(async bundle => {
            const original = window.saveCharactersToStorage; const count = myCharacters.length;
            window.saveCharactersToStorage = async () => false;
            try { await importByndCardJsonText(JSON.stringify({ ...bundle, members: bundle.members.map(row => ({ ...row, card: { ...row.card, data: { ...row.card.data, description: row.card.data.description + '（新版）', extensions: {} } } })) })); return 'imported'; }
            catch (error) { return { message: error.message, same: myCharacters.length === count }; }
            finally { window.saveCharactersToStorage = original; }
        }, bundle);
        assert.match(failed.message, /没有保存成功/);
        assert.equal(failed.same, true);

        // Safe-area check for the settings page header at 47px / 59px.
        for (const safe of [47, 59]) {
            await page.evaluate(value => { document.querySelector('.phone-container').style.setProperty('--bynd-header-safe-top', `${value}px`); openChat('qa_a'); openChatSettings(); openWechatChatSettingsPage('management'); }, safe);
            const top = await page.locator('#wcs-back-btn').evaluate(node => node.getBoundingClientRect().top);
            assert.ok(top >= safe - 1, `back button ${top} under status bar ${safe}`);
            await page.screenshot({ path: path.join(output, `management-safe-${safe}.png`) });
        }
        assert.deepEqual(errors, []);
        console.log('chat windows and card export browser check passed');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
