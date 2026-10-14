'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/reference-bubbles');
fs.mkdirSync(output, { recursive: true });

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
            window.myCharacters = [{ id: 'reference-bubbles', name: '小满', avatar: document.getElementById('wcs-user-avatar').src, chatConfig: {}, history: [
                { type: 'text', isMe: false, content: '今天也要开开心心呀 ♡', timestamp: Date.now() - 240000 },
                { type: 'text', isMe: true, content: '好呀！', timestamp: Date.now() - 180000 },
                { type: 'text', isMe: false, content: '把一点点好运气放进消息里，明天见面时再送你一个惊喜。长长的消息也要装进完整的气泡里。', timestamp: Date.now() - 120000 },
                { type: 'text', isMe: true, content: '嗯', timestamp: Date.now() - 60000 }
            ] }];
            openApp('wechat');
            openChat('reference-bubbles');
            ByndBuiltinLibrary?.close();
            openChatSettings();
            openWechatChatSettingsPage('appearance', { focus: false });
        });
        const ids = await page.evaluate(() => REFERENCE_BUBBLE_DESIGNS.map(design => design.id));
        assert.equal(ids.length, 9);
        assert.equal(await page.evaluate(() => getBubblePresetSwatchAppearance('.msg-bubble::before { background-image: url("http://["); }')[0].mainArt), 'none', 'invalid custom artwork URL does not break the preset picker');
        for (const width of [375, 320]) {
            await page.setViewportSize({ width, height: 844 });
            for (const id of ids) {
                await page.evaluate(id => {
                    openChatSettings();
                    openWechatChatSettingsPage('appearance', { focus: false });
                    chooseBubblePreset(id);
                }, id);
                await page.locator('#wcs-bubble-preset-trigger').scrollIntoViewIfNeeded();
                await page.locator('#wcs-bubble-preset-trigger').click();
                const option = page.locator(`.wcs-bubble-option[data-preset-id="${id}"]`);
                await option.scrollIntoViewIfNeeded();
                await page.waitForTimeout(180);
                const samples = await option.locator('.wcs-bubble-option-swatch').evaluate(swatch => {
                    const bounds = swatch.getBoundingClientRect();
                    return [...swatch.children].map(sample => {
                        const rect = sample.getBoundingClientRect();
                        const style = getComputedStyle(sample);
                        const before = getComputedStyle(sample, '::before');
                        const after = getComputedStyle(sample, '::after');
                        return {
                            inside: rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom,
                            background: style.backgroundImage,
                            main: before.backgroundImage,
                            charm: after.backgroundImage,
                            artInside: rect.top + parseFloat(before.top) >= bounds.top && rect.bottom + 2 <= bounds.bottom
                        };
                    });
                });
                assert.equal(samples.length, 2, `${id}: two complete preview bubbles`);
                assert.ok(samples.every(sample => sample.inside && sample.artInside), `${id}: frames and art fit inside the thumbnail`);
                assert.notEqual(samples[0].background, samples[1].background, `${id}: sides retain their own colors`);
                assert.ok(samples.every(sample => sample.main.includes('.svg') && sample.charm.includes('.svg')), `${id}: thumbnail shows both corner ornaments`);
                const thumbnailArt = await page.evaluate(async urls => Promise.all(urls.map(url => new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(img.naturalWidth > 0);
                    img.onerror = () => resolve(false);
                    img.src = url.match(/url\("?([^"\)]+)"?\)/)[1];
                }))), samples.flatMap(sample => [sample.main, sample.charm]));
                assert.deepEqual(thumbnailArt, [true, true, true, true], `${id}: thumbnail art actually loads`);
                if (['ins-pink', 'ribbon-cat', 'ribbon-bow'].includes(id)) {
                    await page.screenshot({ path: path.join(output, `picker-${id}-${width}.png`), animations: 'disabled' });
                }
                await option.click();
                assert.equal(await page.locator('#wcs-bubble-preset').inputValue(), id);
                if (id === 'ribbon-pink-cat') {
                    await page.locator('.wcs-bubble-preview').screenshot({ path: path.join(output, `hello-kitty-preview-${width}.png`), animations: 'disabled' });
                }
                for (const side of ['ai', 'user']) {
                    const urls = await page.locator(`.wcs-preview-bubble.${side}`).evaluate(bubble => [
                        getComputedStyle(bubble, '::before').backgroundImage,
                        getComputedStyle(bubble, '::after').backgroundImage
                    ]);
                    const loaded = await page.evaluate(async urls => Promise.all(urls.map(url => new Promise(resolve => {
                        const img = new Image();
                        img.onload = () => resolve(img.naturalWidth > 0);
                        img.onerror = () => resolve(false);
                        img.src = url.match(/url\("?([^"\)]+)"?\)/)[1];
                    }))), urls);
                    assert.deepEqual(loaded, [true, true], `${id}: preview art loads`);
                }
                assert.equal(await page.evaluate(() => saveChatSettings()), true, `${id}: saves successfully`);
                const geometry = await page.locator('#chat-room-content .wc-text-bubble').evaluateAll(bubbles => bubbles.map(bubble => {
                    const rect = bubble.getBoundingClientRect();
                    const style = getComputedStyle(bubble);
                    const before = getComputedStyle(bubble, '::before');
                    const after = getComputedStyle(bubble, '::after');
                    const isMe = bubble.classList.contains('green');
                    const artLeft = isMe ? rect.right - parseFloat(before.right) - parseFloat(before.width) : rect.left + parseFloat(before.left);
                    const charmLeft = isMe ? rect.left + parseFloat(after.left) : rect.right - parseFloat(after.right) - parseFloat(after.width);
                    return {
                        left: Math.min(rect.left, artLeft, charmLeft),
                        right: Math.max(rect.right, artLeft + parseFloat(before.width), charmLeft + parseFloat(after.width)),
                        top: rect.top + parseFloat(before.top),
                        bottom: rect.bottom - parseFloat(after.bottom),
                        frameBottom: rect.bottom,
                        width: rect.width,
                        clipped: [...bubble.querySelectorAll('.msg-text')].some(text => text.scrollWidth > text.clientWidth + 1),
                        background: style.backgroundImage,
                        main: before.backgroundImage,
                        charm: after.backgroundImage
                    };
                }));
                assert.equal(geometry.length, 4);
                await page.screenshot({ path: path.join(output, `chat-${id}-${width}.png`), animations: 'disabled' });
                geometry.forEach((bubble, index) => {
                    assert.ok(bubble.left >= 0 && bubble.right <= width, `${id}: ${width}px bubble ${index} and ornaments stay in view`);
                    assert.ok(bubble.width <= 252 && !bubble.clipped, `${id}: short and wrapped message ${index} fits the frame: ${JSON.stringify(bubble)}`);
                    assert.ok(bubble.main.includes('.svg') && bubble.charm.includes('.svg'), `${id}: art applies to real chat`);
                    if (index) assert.ok(bubble.top >= geometry[index - 1].bottom, `${id}: ornaments clear the preceding message`);
                });
                await page.evaluate(() => {
                    openChatSettings();
                    openWechatChatSettingsPage('appearance', { focus: false });
                });
                assert.equal(await page.locator('#wcs-bubble-preset').inputValue(), id, `${id}: saved selection reopens correctly`);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${id}: no horizontal overflow`);
                // Selection and preview are drafts until save.
                const isolation = await page.evaluate(() => {
                    const before = myCharacters[0].chatConfig.customCss;
                    chooseBubblePreset('default');
                    return { same: before === myCharacters[0].chatConfig.customCss, stored: myCharacters[0].chatConfig.bubblePresetId };
                });
                assert.equal(isolation.same, true);
                assert.equal(isolation.stored, id);
            }
        }
        for (const id of ids) {
            const decorated = await page.evaluate(id => {
                myCharacters[0].chatConfig.customCss = BUBBLE_CSS_PRESETS.find(preset => preset.id === id).css;
                applyChatConfig(myCharacters[0]);
                const card = document.createElement('div');
                card.className = 'msg-bubble msg-pay-bubble';
                document.getElementById('chat-room-content').append(card);
                const result = getComputedStyle(card, '::before').backgroundImage.includes('chat-bubbles/');
                card.remove();
                return result;
            }, id);
            assert.equal(decorated, false, `${id}: payment cards keep their own appearance`);
        }
        for (const failure of ['false', 'throw', 'memory-throw']) {
            const result = await page.evaluate(async failure => {
                openChatSettings();
                openWechatChatSettingsPage('appearance', { focus: false });
                chooseBubblePreset('ribbon-cat');
                const before = myCharacters[0].chatConfig.customCss;
                const description = myCharacters[0].description;
                const persist = window.saveCharactersToStorage;
                const memoryPersist = window.saveWechatMemoryStore;
                try {
                    if (failure === 'memory-throw') window.saveWechatMemoryStore = () => { throw new Error('memory storage unavailable'); };
                    window.saveCharactersToStorage = async () => {
                        if (failure === 'throw') throw new Error('storage unavailable');
                        return false;
                    };
                    return { saved: await saveChatSettings(), restored: myCharacters[0].chatConfig.customCss === before && myCharacters[0].description === description };
                } finally {
                    window.saveCharactersToStorage = persist;
                    window.saveWechatMemoryStore = memoryPersist;
                }
            }, failure);
            assert.deepEqual(result, { saved: false, restored: true }, `${failure}: failed save restores the previous style`);
            assert.equal(await page.locator('#wc-chat-settings-panel').isVisible(), true);
            assert.match(await page.locator('#wc-toast').textContent(), /保存失败/);
        }
        assert.deepEqual(errors, []);
        console.log('Nine reference bubble styles verified at 375px/320px: full thumbnails, loaded vector art, short/long messages, saving/reopening, draft isolation and failed-save rollback.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
