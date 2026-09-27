'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/chat-settings');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
        await page.waitForFunction(() => typeof openChatSettings === 'function');
        await page.evaluate(async () => {
            await byndStylesReady;
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            unlockPhone();
            window.myCharacters = [{ id: 'settings-proof', name: '林间', avatar: getUserProfile().avatar || document.getElementById('wcs-user-avatar').src,
                description: '喜欢阅读，温柔而认真。', history: [], worldBook: [{ id: 'world', name: '生活背景', content: '住在海边的小城。' }], chatConfig: {} }];
            openApp('wechat');
            openChat('settings-proof');
            openChatSettings();
        });
        await page.locator('#wc-chat-settings-panel.active').waitFor();
        await page.evaluate(() => ByndBuiltinLibrary?.close());
        const entry = name => page.locator(`[data-chat-settings-entry="${name}"]`);
        const activePage = () => page.locator('[data-chat-settings-page]:visible');
        assert.equal(await activePage().getAttribute('data-chat-settings-page'), 'home');
        assert.equal(await page.locator('.wcs-category-row:visible').count(), 8);
        await page.waitForFunction(() => {
            const icons = [...document.querySelectorAll('img.wcs-category-icon')];
            return icons.length === 8 && icons.every(icon => icon.complete && icon.naturalWidth > 0);
        });
        assert.equal(await page.locator('#wcs-font-size').isVisible(), false);
        await entry('profile').click();
        await page.locator('#wcs-user-name').fill('小满');
        await page.locator('#wcs-user-bio').fill('跨分类保留的人设草稿');
        await page.evaluate(() => { document.querySelector('.wcs-body').scrollTop = 130; });
        const scroll = await page.locator('.wcs-body').evaluate(node => node.scrollTop);
        await page.locator('#wcs-back-btn').click();
        assert.equal(await activePage().getAttribute('data-chat-settings-page'), 'home');
        await entry('appearance').click();
        await page.locator('#wcs-font-size').fill('18');
        await page.locator('#wcs-custom-css').fill('.msg-bubble { border-radius: 20px; }');
        await page.locator('#wcs-back-btn').click();
        await entry('memory').click();
        await page.locator('#wcs-memory-segment').fill('12');
        await page.locator('#wcs-back-btn').click();
        await entry('profile').click();
        assert.equal(await page.locator('#wcs-user-name').inputValue(), '小满');
        assert.equal(await page.locator('#wcs-user-bio').inputValue(), '跨分类保留的人设草稿');
        assert.equal(await page.locator('.wcs-body').evaluate(node => node.scrollTop), scroll);
        await page.locator('#wcs-back-btn').click();

        // Test the actual form save path while forcing the final persistence step to fail.
        await page.evaluate(() => {
            window._settingsProofSave = window.saveCharactersToStorage;
            window._settingsProofToast = window.showWechatToast;
            window.showWechatToast = text => { window._settingsProofMessage = text; };
            window.saveCharactersToStorage = async () => false;
        });
        await page.locator('#wcs-save-settings').click();
        await page.waitForFunction(() => !document.getElementById('wcs-save-settings').disabled);
        assert.equal(await page.evaluate(() => document.getElementById('wc-chat-settings-panel').classList.contains('active')), true);
        assert.match(await page.evaluate(() => window._settingsProofMessage), /保存失败/);
        assert.equal(await page.locator('#wcs-user-name').inputValue(), '小满');
        await page.evaluate(() => { window.saveCharactersToStorage = window._settingsProofSave; });
        await page.locator('#wcs-save-settings').click();
        await page.waitForFunction(() => !document.getElementById('wc-chat-settings-panel').classList.contains('active'));
        const saved = await page.evaluate(() => window.myCharacters[0].chatConfig);
        assert.equal(saved.userProfile.name, '小满');
        assert.equal(saved.fontSize, 18);
        assert.equal(saved.memorySegmentLimit, 12);
        await page.evaluate(() => { window.showWechatToast = window._settingsProofToast; openChatSettings(); });
        await entry('appearance').click();
        assert.equal(await page.locator('#wcs-font-size').inputValue(), '18');
        await page.locator('#wcs-back-btn').click();

        for (const theme of ['wechat', 'telegram', 'couple']) {
            for (const width of [320, 375, 430]) {
                await page.setViewportSize({ width, height: 844 });
                await page.evaluate(theme => {
                    document.documentElement.classList.add('mobile-runtime');
                    applyWechatUiTheme(theme);
                    document.querySelector('.phone-container').style.setProperty('--bynd-header-safe-top', '47px');
                    openWechatChatSettingsPage('home', { focus: false, reset: true });
                }, theme);
                assert.equal(await page.locator('#app-wechat-window').getAttribute('data-ui-theme'), theme);
                const header = await page.locator('.wcs-back-btn').boundingBox();
                const panel = await page.locator('#wc-chat-settings-panel').boundingBox();
                assert.ok(header.y >= panel.y + 47, 'native status bar must not cover the back button');
                assert.equal(await page.locator('.wcs-body').evaluate(node => node.scrollWidth <= node.clientWidth), true);
                if (width === 375) {
                    assert.equal(await page.locator('.wcs-body').evaluate(node => node.scrollHeight <= node.clientHeight), true, 'all categories fit a normal-height screen');
                }
                for (const name of ['profile', 'appearance', 'interaction', 'memory', 'voice', 'abilities', 'moments', 'management']) {
                    await entry(name).click();
                    assert.equal(await activePage().getAttribute('data-chat-settings-page'), name);
                    assert.equal(await page.locator('.wcs-body').evaluate(node => node.scrollWidth <= node.clientWidth), true, `${theme} ${width} ${name} has no horizontal overflow`);
                    const save = await page.locator('#wcs-save-settings').boundingBox();
                    assert.ok(save.y + save.height <= 844);
                    if (theme === 'wechat' && width === 375 && ['appearance', 'memory'].includes(name)) {
                        await page.waitForTimeout(900);
                        await page.screenshot({ path: path.join(output, `${name}-375.png`) });
                    }
                    await page.locator('#wcs-back-btn').click();
                }
                await page.waitForTimeout(900);
                await page.screenshot({ path: path.join(output, `${theme}-${width}.png`) });
            }
        }
        // iOS reserves the top safe area in the parent; the header must not add it twice.
        await page.evaluate(() => document.querySelector('.phone-container').style.setProperty('--bynd-header-safe-top', '0px'));
        assert.equal(await page.locator('.wcs-header').evaluate(node => Math.round(node.getBoundingClientRect().height)), 58);
        await page.setViewportSize({ width: 320, height: 568 });
        assert.equal(await page.locator('.wcs-body').evaluate(node => node.scrollHeight > node.clientHeight), true);
        await entry('management').click();
        await page.evaluate(() => closeChat());
        assert.equal(await activePage().getAttribute('data-chat-settings-page'), 'home', 'back returns to categories first');
        await page.evaluate(() => closeChat());
        assert.equal(await page.evaluate(() => document.getElementById('wc-chat-settings-panel').classList.contains('active')), false);
        assert.deepEqual(errors, []);
        console.log('Chat settings browser checks passed: 8 categories, draft/scroll retention, save failure/retry, 3 themes × 3 widths, safe areas and short screens.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
