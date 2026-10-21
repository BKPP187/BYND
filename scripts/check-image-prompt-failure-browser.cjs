'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/image-prompt-failure');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    let imageRequests = 0, chatRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://nai-prompt-stage.test/**', async route => { imageRequests++; await route.fulfill({ status: 500, body: '{}' }); });
    await page.route('https://prompt-retry.test/**', async route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' } });
        chatRequests++;
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: '' }, finish_reason: chatRequests === 1 ? 'length' : 'content_filter' }] }) });
    });
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof resolveWechatAiGeneratedImage === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady; await window._wechatCharactersLoadPromise;
            unlockPhone(); window.ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime');
            const msg = { type: 'image', isMe: false, content: '', imagePending: true, imagePrompt: '海边的日落风景，没有人物', timestamp: Date.now() };
            window.myCharacters = [{ id: 'image-prompt-failure', name: '林间', history: [{ type: 'text', isMe: true, content: '画一张日落风景', timestamp: Date.now() }], chatConfig: {} }];
            getDefaultImageApi = () => ({ baseUrl: 'https://nai-prompt-stage.test/v1', imageModel: 'nai-diffusion-4-5-full' });
            getImageRouteForFeature = () => null;
            getDefaultApi = () => ({ baseUrl: 'https://prompt-retry.test/v1', model: 'fixture' });
            openApp('wechat'); openChat('image-prompt-failure');
            window.myCharacters[0].history.push(msg);
            await resolveWechatAiGeneratedImage(window.myCharacters[0], msg);
            if (msg.imagePending || msg.imageUrl) throw Error('Failed conversion must not create or finish an image');
        });
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(theme => theme.id));
        for (const theme of themes) {
            await page.evaluate(theme => selectWechatUiTheme(theme), theme);
            const text = await page.locator('#chat-room-content').textContent();
            assert.match(text, /整理生图标签失败/);
            assert.match(text, /图片生成请求尚未发出/);
            assert.match(text, /可能被模型安全策略拦截/);
            assert.doesNotMatch(text, /模型输出被截断/);
            for (const width of [320, 375]) {
                await page.setViewportSize({ width, height: 844 });
                await page.screenshot({ path: path.join(output, `${theme}-${width}.png`) });
            }
        }
        assert.equal(imageRequests, 0);
        assert.equal(chatRequests, 2);
        assert.deepEqual(errors, []);
        console.log(`Prompt-conversion failure checks passed: ${themes.length} themes, 320/375px, explicit stage text, no image submission and no false success.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
