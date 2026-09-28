'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/qq-toolbar');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const controls = [
        ['.wc-voice-btn', '语音'],
        ['.wc-qq-image-btn', '图片'],
        ['.wc-qq-camera-btn', '相机'],
        ['.wc-ai-btn', 'AI 回复'],
        ['.wc-sticker-btn', '表情'],
        ['.wc-add-btn', '更多']
    ];
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => typeof openChat === 'function');
        await page.evaluate(async () => {
            await byndStylesReady;
            unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'qq-toolbar-proof', name: '林间', avatar: document.getElementById('wcs-user-avatar').src, history: [], chatConfig: {} }];
            openApp('wechat');
            openChat('qq-toolbar-proof');
            applyWechatUiTheme('qq');
            ByndBuiltinLibrary?.close();
        });
        await page.locator('#wechat-chat-room:not(.hidden)').waitFor();
        await page.waitForFunction(() => document.querySelector('.wc-room-footer')?.getBoundingClientRect().left === 0);

        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            const footer = page.locator('#wechat-chat-room .wc-room-footer');
            assert.equal(await footer.evaluate(el => el.scrollWidth <= el.clientWidth), true, `QQ footer overflows at ${width}px`);
            const boxes = [];
            const iconWidths = [];
            const iconCenters = [];
            for (const [selector, label] of controls) {
                const control = page.locator(`#wechat-chat-room .wc-room-footer ${selector}`);
                assert.equal(await control.getAttribute('aria-label'), label);
                assert.equal(await control.isVisible(), true, `${label} is visible at ${width}px`);
                const icon = selector === '.wc-ai-btn'
                    ? footer.locator('.wc-qq-ai-overlay')
                    : control.locator('.wc-qq-source-icon');
                assert.equal(await icon.isVisible(), true, `${label} source icon is visible`);
                const iconBox = await icon.boundingBox();
                iconWidths.push(iconBox.width);
                iconCenters.push(iconBox.x + iconBox.width / 2);
                const box = await control.boundingBox();
                assert.ok(box.x >= 0 && box.x + box.width <= width, `${label} stays inside ${width}px`);
                boxes.push(box);
            }
            assert.ok(boxes.every((box, i) => i === 0 || box.x > boxes[i - 1].x), `QQ tools follow reference order at ${width}px`);
            assert.ok(Math.max(...iconWidths) - Math.min(...iconWidths) < 1, `QQ tool icons share one size at ${width}px`);
            const gaps = iconCenters.slice(1).map((center, i) => center - iconCenters[i]);
            assert.ok(Math.max(...gaps) - Math.min(...gaps) < 1, `QQ tool icon centers are evenly spaced at ${width}px: ${gaps.join(', ')}`);
            if (width === 375) {
                await page.screenshot({ path: path.join(output, 'qq-375.png') });
                await footer.screenshot({ path: path.join(output, 'qq-footer-375.png') });
            }
        }

        await page.evaluate(() => {
            window._qqToolbarEvents = [];
            window.triggerImagePick = () => _qqToolbarEvents.push('image');
            window.triggerCamera = () => _qqToolbarEvents.push('camera');
            window.triggerAiReply = () => _qqToolbarEvents.push('ai');
            window.openStickerPicker = () => _qqToolbarEvents.push('sticker');
        });
        for (const selector of ['.wc-qq-image-btn', '.wc-qq-camera-btn', '.wc-ai-btn', '.wc-sticker-btn']) {
            await page.locator(`#wechat-chat-room .wc-room-footer ${selector}`).click();
        }
        assert.deepEqual(await page.evaluate(() => _qqToolbarEvents), ['image', 'camera', 'ai', 'sticker']);
        await page.setViewportSize({ width: 375, height: 844 });
        await page.locator('#wechat-chat-room .wc-room-footer .wc-voice-btn').click();
        assert.equal(await page.locator('#wechat-chat-room').evaluate(el => el.classList.contains('is-voice-input')), true);
        await page.locator('#wc-voice-toggle-icon').waitFor({ state: 'visible' });
        const press = page.locator('#wc-voice-press-btn');
        const send = page.locator('#wechat-chat-room .wc-room-footer .wc-send-btn');
        assert.equal(await send.isVisible(), true, 'QQ voice mode keeps the send button beside long press');
        const pressBox = await press.boundingBox();
        const sendBox = await send.boundingBox();
        assert.ok(sendBox.x >= pressBox.x + pressBox.width, 'send button is to the right of long press');
        await page.waitForTimeout(900);
        await page.locator('#wechat-chat-room .wc-room-footer').screenshot({ path: path.join(output, 'qq-voice-footer-375.png') });
        await page.locator('#wechat-chat-room .wc-room-footer .wc-voice-btn').click();
        assert.equal(await page.locator('#wechat-chat-room').evaluate(el => el.classList.contains('is-voice-input')), false);
        await page.locator('#wechat-chat-room .wc-room-footer .wc-add-btn').click();
        assert.equal(await page.locator('#wc-chat-toolbar').evaluate(el => el.classList.contains('hidden')), false);
        await page.evaluate(() => applyWechatUiTheme('wechat'));
        assert.equal(await page.locator('#wechat-chat-room .wc-room-footer .wc-qq-source-icon').filter({ visible: true }).count(), 0);
        assert.deepEqual(errors, []);
        console.log('QQ toolbar browser checks passed: six reference icons, equal spacing at 320–430px, actions, voice toggle, and theme isolation.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
