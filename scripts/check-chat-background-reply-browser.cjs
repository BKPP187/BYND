'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/background-reply');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof triggerAiReply === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady; await window._wechatCharactersLoadPromise;
            unlockPhone(); window.ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = ['first', 'second'].map(id => ({ id, name: id === 'first' ? '林间' : '江闻远', description: '喜欢阅读，讲话简洁。', chatConfig: {}, history: [{ type: 'text', isMe: true, content: '等你回复', timestamp: Date.now() }] }));
            window.ByndWebSearch = { prepare: async () => null };
            runWechatTurnFollowUps = async () => {};
            window.__requests = 0;
            callChatApi = async () => { window.__requests++; return new Promise(resolve => { window.__releaseReply = resolve; }); };
            openApp('wechat'); openChat('first');
        });
        async function start() {
            await page.evaluate(() => { window.__replyTask = triggerAiReply(); });
            await page.waitForFunction(() => !!window.__releaseReply);
        }
        async function finish(content = '我在这儿|||慢慢来') {
            await page.evaluate(async content => {
                const release = window.__releaseReply; window.__releaseReply = null;
                release({ ok: true, content }); await window.__replyTask;
            }, content);
        }
        await start();
        await page.evaluate(() => closeApp('wechat'));
        await page.waitForFunction(() => window.currentChatCharId === null);
        await finish();
        let history = await page.evaluate(() => window.myCharacters[0].history);
        assert.ok(history.some(m => !m.isMe && m.content === '我在这儿'), 'Returning to the BYND desktop must retain the pending reply');
        assert.equal(await page.evaluate(() => window._wechatAiBusy), false);
        await page.evaluate(() => { openApp('wechat'); openChat('first'); });
        await page.screenshot({ path: path.join(output, 'returned-to-chat-375.png') });
        await start();
        await page.evaluate(() => { closeChat(); openChat('second'); });
        await finish('这是第一位角色的回复');
        history = await page.evaluate(() => window.myCharacters[0].history);
        assert.ok(history.some(m => m.content === '这是第一位角色的回复'), 'Switching conversations must retain the original reply');
        assert.ok(!await page.locator('#chat-room-content').textContent().then(text => text.includes('这是第一位角色的回复')), 'The other conversation must not show the pending reply');
        await page.evaluate(() => { closeChat(); openChat('first'); });
        await start();
        await page.evaluate(() => closeApp('wechat'));
        await page.waitForFunction(() => window.currentChatCharId === null);
        await page.evaluate(() => { openApp('wechat'); openChat('first'); });
        await finish('重新打开之前发起的回复也应该保留');
        history = await page.evaluate(() => window.myCharacters[0].history);
        assert.ok(history.some(m => m.content === '重新打开之前发起的回复也应该保留'), 'Reopening the same conversation while a request is pending must not discard its reply');
        assert.deepEqual(errors, []);
        console.log('Pending replies survive returning to the BYND desktop and switching conversations.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
