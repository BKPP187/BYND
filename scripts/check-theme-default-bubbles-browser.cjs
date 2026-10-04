'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/theme-default-bubbles');
fs.mkdirSync(output, { recursive: true });
const appearance = el => {
    const style = getComputedStyle(el);
    return Object.fromEntries(['backgroundColor', 'backgroundImage', 'color', 'borderRadius', 'borderTopWidth', 'borderTopColor', 'boxShadow'].map(property => [property, style[property]]));
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof openChatSettings === 'function');
        await page.evaluate(async () => {
            await byndStylesReady;
            unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'theme-bubble-proof', name: '林间', avatar: '', chatConfig: {}, history: [
                { type: 'text', isMe: false, content: '角色气泡', timestamp: Date.now() - 120000 },
                { type: 'text', isMe: true, content: '我的气泡', timestamp: Date.now() - 60000 }
            ] }];
            openApp('wechat');
            openChat('theme-bubble-proof');
            ByndBuiltinLibrary?.close();
        });
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(theme => theme.id));
        for (const theme of themes) {
            await page.evaluate(theme => {
                selectWechatUiTheme(theme);
                const char = myCharacters[0];
                char.chatConfig.customCss = '';
                char.chatConfig.bubblePresetId = '';
                applyChatConfig(char);
                openChatSettings();
                openWechatChatSettingsPage('appearance', { focus: false });
            }, theme);
            const expected = await Promise.all(['left', 'right'].map(side => page.locator(`#chat-room-content .msg-row.${side} .wc-text-bubble`).evaluate(appearance)));
            for (const preset of ['default', 'imessage', 'default']) {
                await page.evaluate(preset => chooseBubblePreset(preset), preset);
                if (preset === 'imessage') {
                    assert.equal((await page.locator('.wcs-preview-bubble.user').evaluate(appearance)).backgroundColor, 'rgb(22, 136, 255)', `${theme}: explicit preset overrides the theme`);
                    continue;
                }
                for (const [index, side] of ['ai', 'user'].entries()) {
                    assert.deepEqual(await page.locator(`.wcs-preview-bubble.${side}`).evaluate(appearance), expected[index], `${theme}: default ${side} preview matches chat`);
                }
                const swatches = await page.locator('[data-preset-id="default"] .wcs-bubble-option-swatch > i').evaluateAll(els => els.map(el => getComputedStyle(el).backgroundColor));
                assert.deepEqual(swatches, expected.map(style => style.backgroundColor), `${theme}: default swatches match chat`);
            }
            // A saved preset must not contaminate the default preview, swatch, or live chat.
            await page.evaluate(() => {
                const char = myCharacters[0];
                char.chatConfig.customCss = '.msg-bubble { background: #abcdef !important; color: #010203 !important; }';
                applyChatConfig(char);
                openChatSettings();
                openWechatChatSettingsPage('appearance', { focus: false });
                chooseBubblePreset('default');
            });
            assert.equal(await page.evaluate(() => document.getElementById('chat-custom-css').sheet.disabled), false, 'saved stylesheet stays enabled');
            assert.equal((await page.locator('#chat-room-content .msg-row.left .wc-text-bubble').evaluate(appearance)).backgroundColor, 'rgb(171, 205, 239)', 'preview does not change the live chat');
            for (const [index, side] of ['ai', 'user'].entries()) {
                assert.deepEqual(await page.locator(`.wcs-preview-bubble.${side}`).evaluate(appearance), expected[index], `${theme}: saved preset does not leak into default preview`);
            }
            assert.deepEqual(await page.locator('[data-preset-id="default"] .wcs-bubble-option-swatch > i').evaluateAll(els => els.map(el => getComputedStyle(el).backgroundColor)), expected.map(style => style.backgroundColor), `${theme}: saved preset does not leak into default swatches`);
            assert.equal(await page.evaluate(() => saveChatSettings()), true);
            assert.equal(await page.evaluate(() => myCharacters[0].chatConfig.customCss), '');
            assert.deepEqual(await page.locator('#chat-room-content .msg-row.right .wc-text-bubble').evaluate(appearance), expected[1], `${theme}: saving default restores the theme`);
            if (theme === 'bynd') {
                assert.equal(expected[1].backgroundColor, 'rgb(17, 24, 39)', 'BYND uses its dark user bubble');
                assert.equal(expected[1].color, 'rgb(255, 255, 255)', 'BYND uses white user text');
                await page.evaluate(() => { openChatSettings(); openWechatChatSettingsPage('appearance', { focus: false }); });
                await page.locator('#wcs-bubble-preset-trigger').scrollIntoViewIfNeeded();
                await page.locator('#wcs-bubble-preset-trigger').click();
                await page.screenshot({ path: path.join(output, 'bynd-default-picker-375.png'), animations: 'disabled' });
                await page.evaluate(() => closeBubblePresetPicker());
                await page.locator('.wcs-bubble-preview').screenshot({ path: path.join(output, 'bynd-default-preview-375.png') });
            }
        }
        for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(() => { selectWechatUiTheme('bynd'); openChatSettings(); openWechatChatSettingsPage('appearance', { focus: false }); });
            await page.locator('.wcs-bubble-preview').scrollIntoViewIfNeeded();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px: no horizontal overflow`);
            await page.screenshot({ path: path.join(output, `bynd-default-settings-${width}.png`), animations: 'disabled' });
        }
        await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'ui/theme/foundation-layout.css'), 'utf8').replaceAll('env(safe-area-inset-top', 'var(--proof-safe-top') });
        for (const mode of ['parent', 'header']) {
            for (const safe of [47, 59]) {
                await page.evaluate(({ mode, safe }) => {
                    document.documentElement.classList.toggle('bynd-display-fullscreen', mode === 'header');
                    document.documentElement.style.setProperty('--proof-safe-top', `${safe}px`);
                }, { mode, safe });
                const geometry = await page.locator('.wcs-header').evaluate(header => ({
                    top: header.getBoundingClientRect().top,
                    height: header.getBoundingClientRect().height,
                    controlTop: document.getElementById('wcs-back-btn').getBoundingClientRect().top
                }));
                assert.equal(geometry.top, mode === 'parent' ? safe : 0, `${mode}: panel uses the correct inset owner`);
                assert.equal(geometry.height, 58 + (mode === 'header' ? safe : 0), `${mode}: inset is reserved once`);
                assert.ok(geometry.controlTop >= safe, `${mode}: controls clear the status bar`);
                await page.screenshot({ path: path.join(output, `bynd-default-${mode}-safe-${safe}.png`), animations: 'disabled' });
            }
        }
        for (const failure of ['false', 'throw']) {
            const result = await page.evaluate(async failure => {
                const persist = window.saveCharactersToStorage;
                try {
                    window.saveCharactersToStorage = async () => {
                        if (failure === 'throw') throw new Error('storage unavailable');
                        return false;
                    };
                    chooseBubblePreset('default');
                    return await saveChatSettings();
                } finally { window.saveCharactersToStorage = persist; }
            }, failure);
            assert.equal(result, false, `${failure}: failed persistence is not reported as success`);
            assert.equal(await page.locator('#wc-chat-settings-panel').isVisible(), true, 'failed save keeps settings open');
            assert.match(await page.locator('#wc-toast').textContent(), /保存失败/);
        }
        assert.deepEqual(errors, []);
        console.log(`Default bubbles verified for ${themes.length} themes: preview/chat styles, swatches, preset overrides, saved preset isolation, restoring defaults, save failures, narrow screens and 47/59px safe areas.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
