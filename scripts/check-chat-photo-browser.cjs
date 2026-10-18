'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/chat-photo');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
    const errors = [], requests = [], checks = [];
    let fixtures;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        if (route.request().url() === 'https://image-api.example/v1/images/generations') {
            const body = route.request().postDataJSON();
            requests.push(body);
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ b64_json: fixtures[body.size].split(',')[1] }] }) });
        }
        return route.abort();
    });
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof buildWechatChatImagePlan === 'function');
        fixtures = await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close();
            const images = {};
            for (const [width, height] of [[2048, 3072], [1536, 1024], [1024, 1024]]) {
                const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e1d8ca'; ctx.fillRect(0, 0, width, height);
                for (let row = 0; row < 5; row++) {
                    ctx.fillStyle = '#6c746a'; ctx.fillRect(0, height * (row + 0.8) / 6, width, height / 60);
                    for (let col = 0; col < 7; col++) {
                        ctx.fillStyle = ['#a95d49', '#d0b75f', '#60817b'][col % 3];
                        ctx.fillRect(width * (col + 0.12) / 7, height * (row + 0.15) / 6, width / 9, height / 11);
                    }
                }
                ctx.fillStyle = '#fff'; ctx.font = `${Math.round(width / 20)}px sans-serif`; ctx.fillText(`${width} x ${height}`, width / 12, height * 0.95);
                images[`${width}x${height}`] = canvas.toDataURL('image/png');
            }
            getDefaultImageApi = () => ({ baseUrl: 'https://image-api.example/v1', imageModel: 'custom-image' });
            const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#bdc7d1"/></svg>');
            window.myCharacters = [{ id: 'photo-proof', name: '林间', avatar, description: '银发灰瞳的年轻男子', chatConfig: {}, history: [] }];
            openApp('wechat'); openChat('photo-proof');
            return images;
        });
        await page.evaluate(async () => {
            const char = window.myCharacters[0];
            const msg = { type: 'image', isMe: false, imagePending: true, imagePrompt: '角色本人在超市自拍，乙女 CG', description: '超市货架', timestamp: Date.now() };
            char.history = [{ type: 'text', isMe: true, content: '拍下超市货架，竖图，尺寸2048x3072', timestamp: Date.now() }, msg];
            await resolveWechatAiGeneratedImage(char, msg);
            if (msg.imageError) throw new Error(msg.imageError);
        });
        assert.equal(requests.length, 1);
        assert.equal(requests[0].size, '2048x3072');
        assert.match(requests[0].prompt, /真实摄影/);
        assert.equal(requests[0].images, undefined);
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(theme => theme.id));
        for (const theme of themes) for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(theme => { closeWechatImagePreview(); selectWechatUiTheme(theme); }, theme);
            const bubble = page.locator('#chat-room-content .image-bubble img').last();
            await bubble.waitFor();
            await bubble.evaluate(img => img.decode());
            await bubble.click();
            const preview = page.locator('#wc-image-preview-overlay .wc-image-preview-stage img');
            await preview.evaluate(img => img.decode());
            const state = await preview.evaluate(img => {
                const box = img.getBoundingClientRect();
                return { width: img.naturalWidth, height: img.naturalHeight, renderedRatio: box.width / box.height, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
            });
            assert.equal(state.width, 2048); assert.equal(state.height, 3072);
            assert.ok(Math.abs(state.renderedRatio - 2 / 3) < 0.01, JSON.stringify(state));
            assert.ok(state.left >= 0 && state.right <= width + 1 && state.top >= 0 && state.bottom <= 844, JSON.stringify(state));
            await page.screenshot({ path: path.join(output, `${theme}-${width}-portrait.png`) });
            checks.push({ theme, width, naturalSize: '2048x3072', aspectPreserved: true });
        }
        await page.evaluate(async () => {
            closeWechatImagePreview();
            const char = window.myCharacters[0];
            const msg = { type: 'image', isMe: false, imagePending: true, imagePrompt: '横版街景照片', description: '街景', timestamp: Date.now() };
            char.history.push({ type: 'text', isMe: true, content: '拍张横版街景', timestamp: Date.now() }, msg);
            await resolveWechatAiGeneratedImage(char, msg);
            if (msg.imageError) throw new Error(msg.imageError);
            openWechatImagePreview(msg.content, msg.description);
        });
        assert.equal(requests.at(-1).size, '1536x1024');
        const preview = page.locator('#wc-image-preview-overlay .wc-image-preview-stage img');
        await preview.evaluate(img => img.decode());
        assert.equal(await preview.evaluate(img => img.naturalWidth / img.naturalHeight), 1.5);
        await page.screenshot({ path: path.join(output, 'landscape.png') });
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, requests: requests.map(body => ({ size: body.size, reference: !!body.images })), errors }, null, 2));
        console.log(JSON.stringify({ passed: true, themes: themes.length, narrowScreenChecks: checks.length, dimensions: ['2048x3072', '1536x1024'], output }));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
