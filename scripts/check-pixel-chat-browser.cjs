'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/pixel-chat');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof openChat === 'function');
        await page.evaluate(async () => {
            await byndStylesReady;
            unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'pixel-proof', name: '呆 >ω< 呆', avatar: document.getElementById('wcs-user-avatar').src, chatConfig: {}, history: [
                { type: 'text', isMe: false, content: '听着喜欢的歌，慢慢聊。', timestamp: Date.now() - 180000 },
                { type: 'text', isMe: true, content: '给你一颗小小的像素爱心 ♡', timestamp: Date.now() - 120000 },
                { type: 'sticker', isMe: false, content: 'assets/ui/pixel-chat/stickers/bunny-headphones.svg', stickerName: '听歌', timestamp: Date.now() - 60000 }
            ] }];
            openApp('wechat');
            selectWechatUiTheme('pixel');
            ByndBuiltinLibrary?.close();
            window.saveCharactersToStorage = async () => true;
        });
        await page.evaluate(() => {
            // A visible desktop makes accidental transparent app surfaces obvious.
            document.querySelector('.phone-container').style.background = 'repeating-linear-gradient(45deg, #f000ca 0 18px, #24ed8b 18px 36px)';
            document.getElementById('wc-toast')?.classList.remove('show');
        });
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            const surfaces = await page.evaluate(() => ['#app-wechat-window', '.wechat-header', '.wechat-content', '#wc-view-chat', '.wc-chat-item', '.wc-tab-bar'].map(selector => {
                const el = document.querySelector(selector);
                const style = getComputedStyle(el);
                return { selector, background: style.backgroundColor, opacity: style.opacity };
            }));
            for (const surface of surfaces) {
                assert.match(surface.background, /^rgb\(/, `${surface.selector} must be opaque at ${width}px: ${surface.background}`);
                assert.equal(surface.opacity, '1');
            }
            await page.screenshot({ path: path.join(output, `list-${width}.png`), animations: 'disabled' });
        }
        for (const tab of ['contacts', 'discover', 'me', 'chat']) {
            await page.evaluate(tab => switchWcTab(tab), tab);
            const active = page.locator('.wc-tab-view.active');
            assert.match(await active.evaluate(el => getComputedStyle(el).backgroundColor), /^rgb\(/, `${tab} has an opaque background`);
        }
        await page.evaluate(() => {
            openWechatUiThemeSettings();
            if (getComputedStyle(document.querySelector('.wc-feature-body')).backgroundColor !== 'rgb(214, 214, 217)') throw new Error('Feature page background is missing');
        });
        await page.evaluate(() => {
            closeWechatFeatureScreen();
            openChat('pixel-proof');
        });
        await page.locator('#wechat-chat-room.active').waitFor();
        await page.waitForTimeout(400);
        await page.evaluate(() => document.getElementById('wc-toast')?.classList.remove('show'));
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            const footer = page.locator('#wechat-chat-room .wc-room-footer');
            const tools = footer.locator('#wc-chat-toolbar');
            assert.ok(await tools.isVisible());
            assert.equal(await footer.locator('.wc-add-btn').isVisible(), false);
            assert.equal(await footer.evaluate(el => el.scrollWidth <= el.clientWidth), true);
            const toolBox = await tools.boundingBox();
            const input = await footer.locator('#wc-msg-input').boundingBox();
            assert.ok(toolBox.y + toolBox.height <= input.y, 'toolbar stays above input');
            const content = await page.locator('#chat-room-content').boundingBox();
            const footerBox = await footer.boundingBox();
            assert.ok(content.y + content.height <= footerBox.y + 1, 'messages have space above composer');
            assert.ok(footerBox.y + footerBox.height <= 845, 'composer fits viewport');
            await page.screenshot({ path: path.join(output, `chat-${width}.png`), animations: 'disabled' });
        }
        await page.setViewportSize({ width: 375, height: 844 });
        await page.evaluate(() => {
            window._pixelToolEvents = [];
            window._pixelOriginalTools = {};
            for (const key of ['triggerAiReply', 'openWechatComposer', 'triggerImagePick', 'triggerCamera', 'startWechatCall', 'startWechatScreenShare', 'openStickerManager', 'openWechatMemoryManager']) {
                _pixelOriginalTools[key] = window[key];
                window[key] = (...args) => _pixelToolEvents.push([key, ...args]);
            }
        });
        for (const label of ['AI回复', '图片', '拍照', '转账', '红包', '视频通话', '语音通话', '拍一拍', '震动', '音乐', '共享屏幕', '贴纸管理', '记忆']) {
            await page.locator(`#wc-chat-toolbar [aria-label="${label}"]`).press('Enter');
        }
        assert.deepEqual(await page.evaluate(() => _pixelToolEvents), [
            ['triggerAiReply'], ['triggerImagePick'], ['triggerCamera'], ['openWechatComposer', 'transfer'],
            ['openWechatComposer', 'redpacket'], ['startWechatCall', 'videoCall'], ['startWechatCall', 'voiceCall'],
            ['openWechatComposer', 'poke'], ['openWechatComposer', 'screen_shake'], ['openWechatComposer', 'music_card'],
            ['startWechatScreenShare'], ['openStickerManager'], ['openWechatMemoryManager']
        ]);
        await page.evaluate(() => Object.assign(window, _pixelOriginalTools));
        await page.locator('#wc-msg-input').fill('一行草稿\n第二行草稿\n第三行草稿');
        assert.ok(await page.locator('#wc-msg-input').evaluate(el => el.scrollHeight <= el.clientHeight + 1));
        await page.locator('.wc-room-footer .wc-voice-btn').click();
        assert.equal(await page.locator('#wc-voice-press-btn').isVisible(), true);
        const initialVoiceBox = await page.locator('#wc-voice-press-btn').boundingBox();
        const initialToolBox = await page.locator('#wc-chat-toolbar').boundingBox();
        assert.ok(initialVoiceBox.y >= initialToolBox.y + initialToolBox.height, 'voice composer must stay below toolbar');
        await page.locator('.wc-room-footer .wc-voice-btn').click();
        assert.equal(await page.locator('#wc-msg-input').inputValue(), '一行草稿\n第二行草稿\n第三行草稿');
        await page.locator('#wc-msg-input').fill('');
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
            for (const quoted of [false, true]) {
                await page.evaluate(quoted => {
                    if (quoted) quoteWechatMessage(0); else clearWechatReplyDraft();
                }, quoted);
                for (const entry of ['.wc-room-footer .wc-voice-btn', '#wc-chat-toolbar [aria-label="语音"]']) {
                    const textBox = await page.locator('#wc-msg-input').boundingBox();
                    await page.locator(entry).click();
                    const voiceBox = await page.locator('#wc-voice-press-btn').boundingBox();
                    const toolbarBox = await page.locator('#wc-chat-toolbar').boundingBox();
                    const sendBox = await page.locator('.wc-room-footer .wc-send-btn').boundingBox();
                    const micBox = await page.locator('.wc-room-footer .wc-voice-btn').boundingBox();
                    assert.ok(voiceBox.y >= toolbarBox.y + toolbarBox.height, `voice stays under toolbar (${width}px, quote=${quoted}, entry=${entry})`);
                    assert.ok(Math.abs(voiceBox.y - textBox.y) < 1, 'voice replaces text input in the same row');
                    assert.ok(Math.abs(voiceBox.x - textBox.x) < 1 && Math.abs(voiceBox.width - textBox.width) < 1, 'voice uses the input column');
                    assert.ok(Math.abs(voiceBox.y + voiceBox.height / 2 - sendBox.y - sendBox.height / 2) < 1, 'send stays beside voice composer');
                    assert.ok(Math.abs(voiceBox.y + voiceBox.height / 2 - micBox.y - micBox.height / 2) < 1, 'toggle stays beside voice composer');
                    if (quoted) {
                        const replyBox = await page.locator('#wc-reply-preview').boundingBox();
                        assert.ok(replyBox.y + replyBox.height <= voiceBox.y, 'reply preview stays above voice input');
                    }
                    await page.screenshot({ path: path.join(output, `voice-${width}${quoted ? '-quote' : ''}.png`), animations: 'disabled' });
                    await page.locator('.wc-room-footer .wc-voice-btn').click();
                }
            }
        }
        await page.evaluate(() => clearWechatReplyDraft());
        await page.setViewportSize({ width: 375, height: 844 });
        await page.locator('#wc-chat-toolbar [aria-label="表情"]').click();
        const grid = page.locator('#wc-sticker-grid');
        assert.equal(await grid.locator('img').count(), 40);
        await page.waitForFunction(() => [...document.querySelectorAll('#wc-sticker-grid img')].every(i => i.complete && i.naturalWidth));
        await page.screenshot({ path: path.join(output, 'stickers-375.png'), animations: 'disabled' });
        await page.evaluate(() => {
            const data = getStickerPacks();
            if (stripWechatBuiltinStickerPacks(data).packs.some(p => p.id === 'pack_pixel_builtin')) throw new Error('Built-in pack leaked into backup');
        });
        await grid.locator('img[title="害羞"]').click();
        assert.equal(await page.evaluate(() => myCharacters[0].history.at(-1).stickerName), '害羞');
        assert.ok(await page.locator('#wc-chat-toolbar').isVisible(), 'toolbar stays after send');

        for (const mode of ['false', 'throw']) {
            await page.evaluate(mode => {
                window._pixelBeforeHistory = myCharacters[0].history.length;
                window.saveCharactersToStorage = async () => { if (mode === 'throw') throw new Error('Disk full'); return false; };
                openStickerPicker();
            }, mode);
            assert.equal(await page.evaluate(() => sendSticker('assets/ui/pixel-chat/stickers/bunny-hello.svg', '你好')), false);
            assert.equal(await page.evaluate(() => myCharacters[0].history.length === _pixelBeforeHistory), true);
            assert.equal(await page.locator('#wc-sticker-picker').isVisible(), true, 'failed sends keep picker for retry');
        }
        await page.evaluate(() => { window.saveCharactersToStorage = async () => true; closeStickerPicker(); applyWechatUiTheme('qq'); });
        assert.equal(await page.locator('.wc-room-footer #wc-chat-toolbar').count(), 0);
        assert.equal(await page.locator('.wc-room-footer .wc-add-btn').isVisible(), true);
        await page.locator('.wc-room-footer .wc-add-btn').click();
        assert.equal(await page.locator('#wc-chat-toolbar').isVisible(), true);
        await page.evaluate(() => { localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, 'bynd'); applyWechatUiTheme('bynd'); });
        assert.equal(await page.evaluate(() => getStickerPacks().packs.some(p => p.id === 'pack_pixel_builtin')), false);
        await page.evaluate(() => {
            window._pixelToasts = [];
            window.showWechatToast = message => _pixelToasts.push(message);
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) { if (key === WECHAT_UI_THEME_STORAGE_KEY) throw new Error('Quota exceeded'); return original.call(this, key, value); };
            selectWechatUiTheme('pixel');
            Storage.prototype.setItem = original;
        });
        assert.equal(await page.locator('#app-wechat-window').getAttribute('data-ui-theme'), 'bynd');
        assert.match(await page.evaluate(() => _pixelToasts.join()), /未能保存/);

        await page.evaluate(async () => {
            // Earlier toolbar clicks can enter Chromium fullscreen, which iPhone
            // does not support. Exit it before emulating iOS/PWA layout classes.
            if (document.fullscreenElement) await document.exitFullscreen();
            localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, 'pixel'); applyWechatUiTheme('pixel');
            document.querySelector('.phone-container').style.removeProperty('background');
            document.getElementById('wc-toast')?.classList.remove('show');
        });
        // Override the real CSS env() values, exercising the parent/header contract
        // instead of injecting header padding alone. This is browser emulation.
        const cdp = await page.context().newCDPSession(page);
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
            for (const top of [0, 47, 59]) {
                await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, bottom: top ? 34 : 0, left: 0, right: 0 } });
                for (const mode of ['ios-native', 'ios-pwa', 'edge-to-edge']) {
                    await page.evaluate(({ mode, top }) => {
                        const html = document.documentElement;
                        html.classList.remove('bynd-ios', 'bynd-ios-pwa', 'bynd-display-fullscreen', 'bynd-android-app');
                        html.classList.add(...(mode === 'edge-to-edge' ? ['bynd-display-fullscreen'] : mode === 'ios-pwa' ? ['bynd-ios', 'bynd-ios-pwa'] : ['bynd-ios']));
                        let status = document.getElementById('pixel-test-native-status');
                        if (!status) {
                            status = document.createElement('div');
                            status.id = 'pixel-test-native-status';
                            status.textContent = '9:41';
                            document.body.appendChild(status);
                        }
                        status.style.cssText = `position:fixed;inset:0 0 auto;height:${top}px;background:#c3c3c5;z-index:99999;pointer-events:none;padding:12px 22px;font:600 14px sans-serif;display:${top ? 'block' : 'none'}`;
                    }, { mode, top });
                    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                    const label = `${mode}, ${width}px, safe=${top}px, classes=${await page.evaluate(() => document.documentElement.className)}`;
                    const headerBox = await page.locator('.wc-room-header').boundingBox();
                    const expectedHeight = 48 + (mode === 'edge-to-edge' ? top : 0);
                    assert.ok(Math.abs(headerBox.height - expectedHeight) < 1, `compact header without double safe padding (${label}): ${JSON.stringify(headerBox)}, ${await page.locator('.wc-room-header').evaluate(el => JSON.stringify({ padding: getComputedStyle(el).paddingTop, safe: getComputedStyle(el).getPropertyValue('--bynd-header-safe-top'), body: getComputedStyle(document.body).paddingTop }))}`);
                    assert.ok(Math.abs(headerBox.y - (mode === 'edge-to-edge' ? 0 : top)) < 1, `parent reserves native status bar once (${label})`);
                    for (const selector of ['.wc-room-header > i:first-child', '.wc-room-header > i:last-child', '.wc-room-title']) {
                        const control = await page.locator(selector).boundingBox();
                        assert.ok(control.y >= top && control.y + control.height <= headerBox.y + headerBox.height, `header control clears native status bar (${selector}, ${label})`);
                        assert.ok(control.x >= -0.5 && control.x + control.width <= width + 0.5, `header control fits narrow screen (${label}): ${JSON.stringify(control)}`);
                    }
                    const contentBox = await page.locator('#chat-room-content').boundingBox();
                    assert.ok(Math.abs(contentBox.y - headerBox.y - headerBox.height) < 1, `messages begin below header (${label})`);
                    const footerBox = await page.locator('.wc-room-footer').boundingBox();
                    const inputBox = await page.locator('#wc-msg-input').boundingBox();
                    const height = width === 320 ? 568 : 844;
                    assert.ok(footerBox.y + footerBox.height <= height + 1, `composer stays in viewport (${label})`);
                    assert.ok(inputBox.y + inputBox.height <= height - (top ? 34 : 0), `composer clears home indicator (${label})`);
                    if (top && mode !== 'edge-to-edge') {
                        await page.screenshot({ path: path.join(output, `${mode}-safe-${top}-${width}.png`), animations: 'disabled' });
                    }
                    await page.evaluate(() => closeChat());
                    await page.waitForFunction(() => document.getElementById('wechat-chat-room').classList.contains('hidden'));
                    const listHeader = await page.locator('.wechat-header').boundingBox();
                    assert.ok(Math.abs(listHeader.height - expectedHeight) < 1, `list header shares compact safe area contract (${label})`);
                    assert.ok(Math.abs(listHeader.y + listHeader.height - top - 48) < 1, `list reserves safe area once (${label})`);
                    if (top === 59 && mode === 'ios-pwa') {
                        await page.screenshot({ path: path.join(output, `ios-pwa-list-safe-${top}-${width}.png`), animations: 'disabled' });
                    }
                    await page.evaluate(() => openChat('pixel-proof'));
                    await page.waitForFunction(() => Math.abs(document.querySelector('.wc-room-header').getBoundingClientRect().x) < 0.5);
                }
            }
        }
        assert.deepEqual(errors, []);

        const sheet = await browser.newPage({ viewport: { width: 800, height: 1000 } });
        const entries = JSON.parse(fs.readFileSync(path.join(root, 'assets/ui/pixel-chat/stickers.json'), 'utf8'));
        await sheet.setContent(`<body style="margin:0;background:#eeeeeb;display:grid;grid-template-columns:repeat(8,1fr);gap:12px;padding:24px;font:12px sans-serif">${entries.map(s => `<div style="text-align:center"><img style="width:72px;height:72px;image-rendering:pixelated" src="data:image/svg+xml;base64,${fs.readFileSync(path.join(root, `assets/ui/pixel-chat/stickers/${s.id}.svg`)).toString('base64')}"><p>${s.name}</p></div>`).join('')}</body>`);
        await sheet.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
        await sheet.screenshot({ path: path.join(output, 'sticker-sheet.png'), fullPage: true });
        console.log('Pixel theme verified: opaque list/tabs/settings at 320/375/430px, toolbar, draft/voice, 40 local stickers, successful and failed sends, theme isolation, storage failure and native safe area.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
