'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openChat === 'function');
        await page.evaluate(async () => {
            await byndStylesReady;
            await window._wechatCharactersLoadPromise;
            unlockPhone();
            window.myCharacters = ['first', 'second'].map(id => ({ id, name: id, history: [], chatConfig: {} }));
            openApp('wechat'); openChat('first');
        });
        await page.locator('#wechat-chat-room.active').waitFor();
        const assertOpen = async id => {
            await page.waitForTimeout(400); // Outlive both 300ms close animations.
            assert.equal(await page.locator('#wechat-chat-room').isVisible(), true, 'reopened chat remains visible after the old animation');
            assert.equal(await page.locator('#wechat-chat-room').evaluate(el => el.classList.contains('active')), true);
            assert.equal(await page.evaluate(() => currentChatCharId), id);
        };
        await page.evaluate(() => { closeChat(); openChat('second'); });
        await assertOpen('second');
        await page.evaluate(() => closeApp('wechat'));
        await page.waitForTimeout(100);
        await page.evaluate(() => { openApp('wechat'); openChat('first'); });
        await assertOpen('first');
        assert.equal(await page.locator('#app-wechat-window').isVisible(), true);
        await page.evaluate(() => closeApp('wechat'));
        await page.waitForTimeout(650);
        assert.equal(await page.locator('#wechat-chat-room').isVisible(), false, 'ordinary close still completes');
        assert.equal(await page.evaluate(() => currentChatCharId), null);
        assert.deepEqual(errors, []);
        console.log('Chat and app close animations cannot hide a newly reopened conversation; normal close still completes.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
