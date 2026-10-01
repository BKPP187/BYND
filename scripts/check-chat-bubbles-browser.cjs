'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/chat-bubbles');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => typeof openChatSettings === 'function');
        await page.evaluate(async () => {
            await byndStylesReady;
            unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{
                id: 'bubble-proof', name: '林间', avatar: document.getElementById('wcs-user-avatar').src, chatConfig: {},
                history: [
                    { id: 'bubble-1', type: 'text', isMe: false, content: '看到这只猫爪就想起你。今天也要开开心心呀。', timestamp: Date.now() - 240000 },
                    { id: 'bubble-2', type: 'text', isMe: true, content: '好可爱！这个聊天框像软软的糖霜。', timestamp: Date.now() - 180000 },
                    { id: 'bubble-3', type: 'text', isMe: false, content: '那我把一点点好运气也放进消息里，明天见面时再送你一个惊喜。', timestamp: Date.now() - 120000 },
                    { id: 'bubble-4', type: 'text', isMe: true, content: '说好了，不许偷偷忘记哦 ♡', timestamp: Date.now() - 60000 }
                ]
            }];
            openApp('wechat');
            openChat('bubble-proof');
            ByndBuiltinLibrary?.close();
            openChatSettings();
            openWechatChatSettingsPage('appearance', { focus: false });
        });
        await page.locator('#wcs-page-appearance:not([hidden])').waitFor();
        await page.locator('#wcs-bubble-preset-trigger').scrollIntoViewIfNeeded();
        await page.locator('#wcs-bubble-preset-trigger').click();
        const ids = ['kawaii-kitten', 'kawaii-paw', 'kawaii-bat', 'kawaii-midnight'];
        for (const id of ids) {
            assert.equal(await page.locator(`.wcs-bubble-option[data-preset-id="${id}"]`).isVisible(), true, `${id} is in the preset picker`);
        }
        await page.waitForTimeout(220);
        assert.equal(await page.locator('#wcs-bubble-preset-menu').evaluate(menu => {
            const rect = menu.getBoundingClientRect();
            return menu.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 8));
        }), true, 'preset menu stays interactive beyond the settings card');
        await page.screenshot({ path: path.join(output, 'bubble-picker-375.png'), animations: 'disabled' });

        for (const id of ids) {
            await page.locator(`.wcs-bubble-option[data-preset-id="${id}"]`).click();
            assert.equal(await page.locator('#wcs-bubble-preset').inputValue(), id);
            await page.waitForTimeout(220);
            const appearance = await page.locator('.wcs-bubble-preview').evaluate(el => {
                const ai = el.querySelector('.wcs-preview-bubble.ai');
                const user = el.querySelector('.wcs-preview-bubble.user');
                return {
                    aiBackground: getComputedStyle(ai).backgroundImage,
                    userBackground: getComputedStyle(user).backgroundImage,
                    aiOrnament: getComputedStyle(ai, '::before').backgroundImage,
                    userOrnament: getComputedStyle(user, '::before').backgroundImage,
                    aiCharm: getComputedStyle(ai, '::after').backgroundImage,
                    userCharm: getComputedStyle(user, '::after').backgroundImage
                };
            });
            assert.notEqual(appearance.aiBackground, appearance.userBackground, `${id} previews both sides distinctly`);
            assert.ok(appearance.aiOrnament.includes('.png') && appearance.userOrnament.includes('.png'), `${id} shows illustrated characters on both sides`);
            assert.ok(appearance.aiCharm.includes('.png') && appearance.userCharm.includes('.png'), `${id} shows illustrated charms on both sides`);
            await page.locator('.wcs-bubble-preview').screenshot({ path: path.join(output, `${id}-375.png`), animations: 'disabled' });
            if (id !== ids[ids.length - 1]) await page.locator('#wcs-bubble-preset-trigger').click();
        }
        await page.setViewportSize({ width: 320, height: 844 });
        await page.locator('.wcs-bubble-preview').scrollIntoViewIfNeeded();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '320px settings viewport does not overflow');
        await page.screenshot({ path: path.join(output, 'bubble-settings-320.png') });
        const advanced = page.locator('.wcs-bubble-css-details');
        assert.equal(await advanced.getAttribute('open'), null, 'advanced CSS starts collapsed');
        await advanced.locator('summary').click();
        assert.equal(await page.locator('#wcs-custom-css').isVisible(), true, 'advanced CSS remains editable');
        await advanced.locator('summary').click();
        const saved = await page.evaluate(async () => saveChatSettings());
        assert.equal(saved, true, 'selected style saves to the chat');
        const applied = await page.evaluate(() => {
            const css = window.myCharacters.find(char => char.id === 'bubble-proof')?.chatConfig?.customCss || '';
            const bubble = document.createElement('div');
            bubble.className = 'msg-bubble green wc-text-bubble';
            bubble.textContent = '预设已应用';
            document.getElementById('chat-room-content').appendChild(bubble);
            const result = {
                stored: css.includes('bat-heart.png'),
                presetId: window.myCharacters.find(char => char.id === 'bubble-proof')?.chatConfig?.bubblePresetId,
                background: getComputedStyle(bubble).backgroundImage,
                color: getComputedStyle(bubble).color,
                ornament: getComputedStyle(bubble, '::before').backgroundImage
            };
            bubble.remove();
            return result;
        });
        assert.equal(applied.stored, true, 'selected style persists in chat settings');
        assert.equal(applied.presetId, 'kawaii-midnight', 'selected built-in preset keeps its identity for future updates');
        assert.ok(applied.background.includes('linear-gradient'), 'saved style colors the real chat bubble');
        assert.equal(applied.color, 'rgb(255, 250, 252)', 'dark style keeps text readable');
        assert.ok(applied.ornament.includes('bat-heart.png'), 'saved style decorates the real chat bubble');
        assert.equal(await page.evaluate(() => {
            const card = document.createElement('div');
            card.className = 'msg-bubble msg-pay-bubble';
            document.getElementById('chat-room-content').appendChild(card);
            const decorated = getComputedStyle(card, '::before').backgroundImage.includes('chat-bubbles/');
            card.remove();
            return decorated;
        }), false, 'illustrated presets do not decorate payment cards');
        await page.setViewportSize({ width: 375, height: 844 });
        await page.locator('#chat-room-content .msg-bubble.wc-text-bubble').first().waitFor();
        assert.equal(await page.locator('#chat-room-content .msg-bubble.wc-text-bubble').count(), 4);
        await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(output, 'kawaii-chat-375.png'), animations: 'disabled' });
        await page.evaluate(() => {
            openChatSettings();
            openWechatChatSettingsPage('appearance', { focus: false });
            chooseBubblePreset('kawaii-kitten');
        });
        assert.equal(await page.evaluate(async () => saveChatSettings()), true, 'pink kitten style saves to the chat');
        await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(output, 'kawaii-chat-pink-375.png'), animations: 'disabled' });
        await page.evaluate(() => {
            const char = window.myCharacters.find(item => item.id === 'bubble-proof');
            char.history = [
                { id: 'bubble-short-1', type: 'text', isMe: true, content: '呜呜你混蛋！', timestamp: Date.now() - 180000 },
                { id: 'bubble-short-2', type: 'text', isMe: true, content: '都订婚了还回来干嘛？', timestamp: Date.now() - 120000 },
                { id: 'bubble-short-3', type: 'text', isMe: true, content: '你当我是什么？', timestamp: Date.now() - 60000 }
            ];
            openChat('bubble-proof');
        });
        for (const id of ids) {
            await page.evaluate(id => {
                const char = window.myCharacters.find(item => item.id === 'bubble-proof');
                char.chatConfig.customCss = BUBBLE_CSS_PRESETS.find(preset => preset.id === id).css;
                applyChatConfig(char);
            }, id);
            const layout = await page.locator('#chat-room-content .msg-bubble.wc-text-bubble').evaluateAll(bubbles => bubbles.map((bubble, index) => {
                const rect = bubble.getBoundingClientRect();
                const ornament = getComputedStyle(bubble, '::before');
                const previous = index ? bubbles[index - 1].getBoundingClientRect() : null;
                return {
                    width: rect.width,
                    ornamentWidth: parseFloat(ornament.width),
                    ornamentTop: rect.top + parseFloat(ornament.top),
                    previousBottom: previous?.bottom ?? null
                };
            }));
            assert.equal(layout.length, 3, `${id} renders three consecutive short messages`);
            for (const [index, bubble] of layout.entries()) {
                assert.ok(bubble.width <= 252, `${id} short bubble ${index + 1} stays compact: ${bubble.width}px`);
                assert.ok(bubble.ornamentWidth <= 40, `${id} decoration ${index + 1} stays small`);
                if (index) assert.ok(bubble.ornamentTop - bubble.previousBottom >= 4, `${id} decoration ${index + 1} clears the previous bubble by at least 4px`);
            }
            await page.screenshot({ path: path.join(output, `kawaii-short-${id}-375.png`), animations: 'disabled' });
            await page.setViewportSize({ width: 320, height: 844 });
            const narrowLayout = await page.locator('#chat-room-content .msg-bubble.wc-text-bubble').evaluateAll(bubbles => ({
                overflow: document.documentElement.scrollWidth > innerWidth,
                bubbles: bubbles.map((bubble, index) => {
                    const rect = bubble.getBoundingClientRect();
                    const previous = index ? bubbles[index - 1].getBoundingClientRect() : null;
                    return {
                        right: rect.right,
                        width: rect.width,
                        ornamentGap: previous ? rect.top + parseFloat(getComputedStyle(bubble, '::before').top) - previous.bottom : null
                    };
                })
            }));
            assert.equal(narrowLayout.overflow, false, `${id} 320px chat viewport does not overflow`);
            for (const bubble of narrowLayout.bubbles) {
                assert.ok(bubble.right <= 320 && bubble.width <= 252, `${id} 320px short bubble remains inside the viewport`);
                if (bubble.ornamentGap !== null) assert.ok(bubble.ornamentGap >= 4, `${id} 320px decoration clears the previous bubble`);
            }
            await page.screenshot({ path: path.join(output, `kawaii-short-${id}-320.png`), animations: 'disabled' });
            await page.setViewportSize({ width: 375, height: 844 });
        }
        const migrated = await page.evaluate(() => {
            const char = window.myCharacters.find(item => item.id === 'bubble-proof');
            const results = KAWAII_BUBBLE_LEGACY_CSS.map(oldPreset => {
                char.chatConfig = { customCss: oldPreset.css };
                applyChatConfig(char);
                const bubble = document.querySelector('#chat-room-content .msg-bubble.wc-text-bubble');
                return {
                    id: oldPreset.id,
                    selected: getActiveKawaiiBubblePreset(char.chatConfig)?.id,
                    appliedWidth: getComputedStyle(bubble).maxWidth,
                    appliedDecoration: getComputedStyle(bubble, '::before').width
                };
            });
            char.chatConfig = { customCss: '.msg-bubble { color: tomato; }' };
            const customPreserved = getEffectiveBubbleCss(char.chatConfig) === char.chatConfig.customCss;
            return { results, customPreserved };
        });
        assert.equal(migrated.results.length, 8, 'both previously saved versions of all four styles are covered');
        for (const entry of migrated.results) {
            assert.equal(entry.selected, entry.id, `${entry.id} saved CSS resolves to its original preset`);
            assert.ok(entry.appliedWidth.includes('252px'), `${entry.id} saved CSS receives the compact width`);
            assert.equal(entry.appliedDecoration, '40px', `${entry.id} saved CSS receives the smaller decoration`);
        }
        assert.equal(migrated.customPreserved, true, 'hand-edited CSS is not replaced by a built-in preset');
        for (const id of ids) {
            await page.evaluate(id => {
                const char = window.myCharacters.find(item => item.id === 'bubble-proof');
                char.chatConfig = { customCss: KAWAII_BUBBLE_LEGACY_CSS.find(preset => preset.id === id).css };
                openChatSettings();
                openWechatChatSettingsPage('appearance', { focus: false });
            }, id);
            assert.equal(await page.locator('#wcs-bubble-preset').inputValue(), id, `${id} previously saved selection opens as the same preset`);
            assert.ok((await page.locator('#wcs-custom-css').inputValue()).includes('margin-top: 14px'), `${id} settings editor shows the updated style`);
            await page.evaluate(() => closeChatSettings());
        }
        assert.deepEqual(errors, []);
        console.log('Bubble presets browser checks passed: all four styles at 375px/320px, separated short messages, and saved-style upgrades.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
