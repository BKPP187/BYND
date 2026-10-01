'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/pixel-chat');
fs.mkdirSync(output, { recursive: true });
const appearance = el => {
    const s = getComputedStyle(el), ornament = getComputedStyle(el, '::before');
    return { background: s.backgroundColor, gradient: s.backgroundImage, color: s.color, radius: s.borderRadius, border: s.borderTopWidth, shadow: s.boxShadow, ornament: ornament.backgroundImage, display: ornament.display };
};
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof openChat === 'function');
        await page.evaluate(async () => {
            await byndStylesReady; unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'pixel-bubble-proof', name: '林间', avatar: document.getElementById('wcs-user-avatar').src,
                chatConfig: { chatBgImage: 'assets/ui/pixel-chat/wallpaper.svg' },
                history: [
                    { type: 'text', isMe: false, content: '这个气泡的边框和颜色都要显示。', timestamp: Date.now() - 120000 },
                    { type: 'text', isMe: true, content: '还有我选择的猫爪和小猫 ♡', timestamp: Date.now() - 60000 }
                ] }];
            openApp('wechat'); selectWechatUiTheme('pixel'); openChat('pixel-bubble-proof');
            ByndBuiltinLibrary?.close(); window.saveCharactersToStorage = async () => true;
            document.getElementById('wc-toast')?.classList.remove('show');
        });
        const presets = await page.evaluate(() => BUBBLE_CSS_PRESETS.map(p => p.id));
        for (const id of presets) {
            await page.evaluate(id => { openChatSettings(); openWechatChatSettingsPage('appearance', { focus: false }); chooseBubblePreset(id); }, id);
            const aiPreview = await page.locator('.wcs-preview-bubble.ai').evaluate(appearance);
            const userPreview = await page.locator('.wcs-preview-bubble.user').evaluate(appearance);
            assert.equal(await page.evaluate(() => saveChatSettings()), true);
            const aiBubble = await page.locator('#chat-room-content .msg-row.left .wc-text-bubble').evaluate(appearance);
            const userBubble = await page.locator('#chat-room-content .msg-row.right .wc-text-bubble').evaluate(appearance);
            for (const [actual, expected] of [[aiBubble, aiPreview], [userBubble, userPreview]]) {
                assert.equal(actual.background, expected.background, `${id} preview and chat colors match`);
                assert.equal(actual.gradient, expected.gradient, `${id} preview and chat gradients match`);
                if (id !== 'default') {
                    assert.equal(actual.color, expected.color, `${id} text color matches`);
                    assert.equal(actual.radius, expected.radius, `${id} corners match`);
                    assert.equal(actual.border, expected.border, `${id} border matches`);
                    assert.equal(actual.shadow, expected.shadow, `${id} frame matches`);
                }
                if (id.startsWith('kawaii-')) {
                    assert.equal(actual.ornament, expected.ornament, `${id} decoration matches`);
                    assert.notEqual(actual.display, 'none', `${id} character decoration is visible`);
                }
            }
            if (['kawaii-kitten', 'kawaii-midnight', 'imessage', 'strawberry'].includes(id)) {
                await page.waitForTimeout(300);
                await page.screenshot({ path: path.join(output, `bubble-${id}-375.png`), animations: 'disabled' });
            }
        }
        await page.evaluate(() => {
            const char = myCharacters[0];
            char.chatConfig.customCss = ''; char.chatConfig.bubblePresetId = '';
            char.chatConfig.bubbleAi = '#ffeeaa'; char.chatConfig.bubbleUser = '#ccbbee';
            applyChatConfig(char);
        });
        assert.equal((await page.locator('#chat-room-content .msg-row.left .wc-text-bubble').evaluate(appearance)).background, 'rgb(255, 238, 170)', 'saved AI bubble color is respected');
        assert.equal((await page.locator('#chat-room-content .msg-row.right .wc-text-bubble').evaluate(appearance)).background, 'rgb(204, 187, 238)', 'saved user bubble color is respected');
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(() => { openChatSettings(); openWechatChatSettingsPage('appearance', { focus: false }); });
            await page.locator('#wcs-bubble-preset-trigger').scrollIntoViewIfNeeded();
            await page.locator('#wcs-bubble-preset-trigger').click();
            await page.waitForTimeout(200);
            const menu = page.locator('#wcs-bubble-preset-menu');
            assert.equal(await menu.evaluate(menu => {
                const r = menu.getBoundingClientRect(), body = menu.closest('.wcs-body').getBoundingClientRect();
                return r.top >= body.top && r.bottom <= body.bottom && menu.contains(document.elementFromPoint(r.left + r.width / 2, r.bottom - 8));
            }), true, `menu is above neighboring content and within scroll area at ${width}px`);
            const swatches = await page.evaluate(() => ['telegram', 'blue-pink', 'kakao-yellow', 'imessage', 'soft-paper', 'strawberry'].map(id => [...document.querySelectorAll(`[data-preset-id="${id}"] .wcs-bubble-option-swatch > i`)].map(el => getComputedStyle(el).backgroundColor)));
            assert.equal(new Set(swatches.map(pair => pair.join('|'))).size, swatches.length, 'old presets each show their own colors');
            const imessage = page.locator('.wcs-bubble-option[data-preset-id="imessage"]');
            await imessage.scrollIntoViewIfNeeded();
            await imessage.click();
            assert.equal(await page.locator('#wcs-bubble-preset').inputValue(), 'imessage');
            assert.equal(await page.evaluate(() => saveChatSettings()), true);
            await page.waitForTimeout(300);
            await page.screenshot({ path: path.join(output, `bubble-imessage-${width}.png`), animations: 'disabled' });
        }
        await page.evaluate(() => {
            const char = myCharacters[0];
            char.chatConfig.customCss = '.msg-bubble { background: #114477; color: #fff; border: 3px dashed #fafa00; border-radius: 9px; }';
            char.chatConfig.bubblePresetId = ''; applyChatConfig(char);
        });
        const custom = await page.locator('#chat-room-content .msg-row.left .wc-text-bubble').evaluate(appearance);
        assert.equal(custom.background, 'rgb(17, 68, 119)'); assert.equal(custom.border, '3px'); assert.equal(custom.radius, '9px');
        await page.evaluate(() => {
            const char = myCharacters[0];
            char.chatConfig.customCss = ''; char.chatConfig.bubblePresetId = '';
            delete char.chatConfig.bubbleAi; delete char.chatConfig.bubbleUser;
            applyChatConfig(char);
        });
        assert.equal((await page.locator('#chat-room-content .msg-row.left .wc-text-bubble').evaluate(appearance)).background, 'rgb(228, 228, 229)', 'clearing customizations restores pixel default');
        assert.deepEqual(errors, []);
        console.log(`Pixel bubbles verified: ${presets.length} presets, both preview/chat sides, saved colors, custom CSS, visible artwork, distinct swatches, menu stacking and 320/375/430px screenshots.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
