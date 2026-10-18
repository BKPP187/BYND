'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/self-sticker');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
    const errors = [], requests = [], checks = [];
    // An optional user-supplied reference is used only as a mocked response to
    // inspect rendering. This check never calls a live generation service.
    const reference = process.env.BYND_STICKER_FIXTURE;
    let encoded = reference ? fs.readFileSync(reference).toString('base64') : '';
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        if (route.request().url() === 'https://image-api.example/v1/images/edits') {
            requests.push(route.request().postDataJSON());
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ b64_json: encoded }] }) });
        }
        return route.abort();
    });
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof isWechatCharacterStickerImage === 'function');
        const setup = await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close();
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 400;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 400, 400); ctx.fillStyle = '#222';
            for (const x of [155, 245]) { ctx.beginPath(); ctx.ellipse(x, 170, 26, 35, 0, 0, 7); ctx.fill(); }
            const fallback = canvas.toDataURL('image/png').split(',')[1];
            getDefaultImageApi = () => ({ baseUrl: 'https://image-api.example/v1', imageModel: 'custom-image' });
            getWechatImageReferenceForChar = () => 'https://identity.example/current-role.png';
            window.myCharacters = [{ id: 'sticker-proof', name: '林间', avatar: canvas.toDataURL('image/png'), description: '银发灰色眼睛的年轻男子', chatConfig: { agentPreferences: { allowImages: true } }, history: [] }];
            openApp('wechat'); openChat('sticker-proof');
            return { fallback, proactive: buildSystemPrompt(window.myCharacters[0]) };
        });
        if (!encoded) encoded = setup.fallback;
        assert.match(setup.proactive, /偶尔自绘表情/);
        assert.match(setup.proactive, /不要每轮生成/);
        await page.evaluate(async () => {
            const char = window.myCharacters[0];
            const msg = buildWechatGeneratedImageMessage('角色本人Q版自画像表情包，委屈捧一朵小花', '给你小花', char);
            char.history.push(msg);
            await resolveWechatAiGeneratedImage(char, msg);
            if (msg.imageError) throw new Error(msg.imageError);
        });
        assert.equal(requests.length, 1);
        assert.equal(requests[0].size, '1024x1024');
        assert.equal(requests[0].images[0].image_url, 'https://identity.example/current-role.png');
        assert.match(requests[0].prompt, /黑白极简手绘线稿/);
        assert.ok(requests[0].prompt.length < 650);
        const followup = await page.evaluate(() => buildSystemPrompt(window.myCharacters[0]));
        assert.match(followup, /最近已经发过自绘表情/);
        const denied = await page.evaluate(() => {
            const char = window.myCharacters[0];
            char.chatConfig.agentPreferences.allowImages = false;
            const prompt = buildSystemPrompt(char);
            char.chatConfig.agentPreferences.allowImages = true;
            return prompt;
        });
        assert.doesNotMatch(denied, /【偶尔自绘表情】/);
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(theme => theme.id));
        for (const theme of themes) for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(theme => { closeWechatImagePreview(); selectWechatUiTheme(theme); }, theme);
            const sticker = page.locator('#chat-room-content .msg-bubble.sticker img');
            await sticker.waitFor(); await sticker.evaluate(img => img.decode());
            assert.equal(await page.locator('#chat-room-content .image-bubble').count(), 0);
            const box = await sticker.boundingBox();
            assert.ok(box.width <= 200 && box.x >= 0 && box.x + box.width <= width + 1, JSON.stringify(box));
            await page.screenshot({ path: path.join(output, `${theme}-${width}.png`) });
            checks.push({ theme, width, stickerWidth: box.width });
        }
        await page.evaluate(() => {
            const char = window.myCharacters[0];
            char.history.push({ type: 'image', imageKind: 'character-sticker', isMe: false, imagePending: true, description: '待生成', timestamp: Date.now() });
            refreshChatView(char);
        });
        assert.match(await page.locator('#chat-room-content .msg-image-placeholder').last().innerText(), /正在画表情/);
        await page.evaluate(() => {
            const char = window.myCharacters[0], msg = char.history.at(-1);
            msg.imagePending = false; msg.imageError = '测试：生图服务失败'; refreshChatView(char);
        });
        assert.match(await page.locator('#chat-room-content .msg-image-placeholder.error').innerText(), /生图服务失败/);
        assert.equal(await page.locator('#chat-room-content .msg-bubble.sticker img').count(), 1);
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, promptLength: requests[0].prompt.length, referenceResponseIsMocked: true, errors }, null, 2));
        console.log(JSON.stringify({ passed: true, themes: themes.length, narrowScreenChecks: checks.length, actualPromptLength: requests[0].prompt.length, output }));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
