'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/chat-window-greeting');
fs.mkdirSync(output, { recursive: true });
const greeting = '（{{char}}穿着一件白大褂，戴着口罩和手套，拿着刀解剖鸡。那只鸡被他解剖得各个细节都有，而且还非常整齐地归类在桌子上。内脏、肌肉、骨骼分得清清楚楚，摆放得整整齐齐：肝脏颜色鲜艳、纹理清晰；肌肉丝丝分明、富有弹性；骨骼洁白光滑，没有一点瑕疵。这手法，这技术，简直像一场艺术表演。看到你拖着行李进来，他停下手中的动作，慢悠悠地放下刀，用他那一贯优雅的语调说）好久不见。';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    const ready = async () => {
        await page.waitForFunction(() => window.__byndCoreReady && typeof createWechatChatWindow === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady; await window._wechatCharactersLoadPromise;
            unlockPhone(); window.ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime');
            openApp('wechat');
        });
        await page.addStyleTag({ content: '.app-window{transition:none!important;animation:none!important}.tapfx-layer{display:none!important}' });
    };
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await ready();
        await page.evaluate(async greeting => {
            const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#8fa89a"/></svg>');
            window.myCharacters.splice(0, window.myCharacters.length, {
                id: 'qa_greeting', name: '商桓', description: '说话优雅。', avatar,
                first_mes: greeting, first_mes_original: greeting, regex: [], worldBook: [], alternates: [],
                chatConfig: {}, history: [{ type: 'text', isMe: true, content: '主窗口的秘密', timestamp: 1 }]
            });
            await saveCharactersToStorage(); renderChatList(); openChat('qa_greeting');
            openChatSettings(); openWechatChatSettingsPage('management');
        }, greeting);
        await page.locator('#wcs-chat-windows .wcs-window-new').click();
        await page.waitForFunction(() => isWechatChatWindow(myCharacters.find(c => c.id === currentChatCharId)));
        const windowId = await page.evaluate(() => currentChatCharId);
        // Use the shared chat content host, independent of the theme's shell.
        const hostId = await page.evaluate(() => document.querySelector('.msg-row.left')?.parentElement?.id);
        assert.ok(hostId, 'chat host exists');
        const selector = `#${hostId} .msg-row.left .wc-text-bubble`;
        const narrationSelector = `#${hostId} .msg-row.narration .msg-offline-narration`;
        const expected = await page.evaluate(id => myCharacters.find(c => c.id === id).history.map(m => m.content), windowId);
        assert.ok(expected.length >= 3);
        assert.equal(expected.at(-1), '好久不见。');
        assert.equal(expected.join(''), greeting.replace('{{char}}', '商桓'));
        assert.equal(await page.locator(selector).count(), 1, 'only spoken dialogue gets a speech bubble');
        assert.equal(await page.locator(narrationSelector).count(), expected.length - 1, 'scene chunks get narration bubbles');

        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(t => t.id));
        for (const theme of themes) {
            await page.evaluate(({ theme, id }) => {
                localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, theme); applyWechatUiTheme(theme); openChat(id);
            }, { theme, id: windowId });
            assert.equal(await page.locator(selector).count(), 1, `${theme}: one spoken message`);
            assert.equal(await page.locator(narrationSelector).count(), expected.length - 1, `${theme}: scene narration`);
            const layout = await page.locator(`${selector}, ${narrationSelector}`).evaluateAll(nodes => nodes.map(node => {
                const rect = node.getBoundingClientRect();
                return { left: rect.left, right: rect.right, width: rect.width, overflow: node.scrollWidth - node.clientWidth };
            }));
            assert.ok(layout.every(rect => rect.width > 0 && rect.width <= 375 && rect.overflow <= 2), `${theme}: narrow-screen bubbles fit`);
            await page.screenshot({ path: path.join(output, `window-2-${theme}.png`) });
        }

        // Upgrade the previous fix's all-text bubbles through the real open hook.
        await page.evaluate(async id => {
            const char = myCharacters.find(c => c.id === id);
            char.history.forEach(msg => { msg.type = 'text'; });
            await saveCharactersToStorage(); openChat(id);
        }, windowId);
        assert.equal(await page.locator(selector).count(), 1, 'previously split greeting keeps only dialogue as speech');
        assert.equal(await page.locator(narrationSelector).count(), expected.length - 1, 'previously split scene becomes narration');

        // Persist an old one-bubble window, then exercise the open hook after a reload.
        await page.evaluate(async id => {
            const char = myCharacters.find(c => c.id === id);
            char.history = [{ type: 'text', isMe: false, content: getWechatCharacterGreetingContent(char), timestamp: 123 }];
            await saveCharactersToStorage();
            localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, 'wechat');
        }, windowId);
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
        await page.evaluate(id => openChat(id), windowId);
        assert.equal(await page.locator(selector).count(), 1, 'legacy dialogue repaired after reload');
        assert.equal(await page.locator(narrationSelector).count(), expected.length - 1, 'legacy narration repaired after reload');
        await page.waitForTimeout(300);
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
        const persisted = await page.evaluate(id => myCharacters.find(c => c.id === id).history.map(m => ({ type: m.type, content: m.content, timestamp: m.timestamp })), windowId);
        assert.deepEqual(persisted.map(m => m.content), expected);
        assert.ok(persisted.every(m => m.timestamp === 123));
        assert.ok(persisted.slice(0, -1).every(m => m.type === 'offline_narration'));
        assert.equal(persisted.at(-1).type, 'text');
        await page.evaluate(id => openChat(id), windowId);
        assert.equal(await page.locator(selector).count(), 1, 'reopening does not duplicate dialogue');
        assert.equal(await page.locator(narrationSelector).count(), expected.length - 1, 'reopening does not duplicate narration');
        await page.screenshot({ path: path.join(output, 'window-2-restored.png') });
        assert.deepEqual(await page.evaluate(() => myCharacters.find(c => c.id === 'qa_greeting').history.map(m => m.content)), ['主窗口的秘密']);
        const failedUpgrade = await page.evaluate(async id => {
            const char = myCharacters.find(c => c.id === id);
            char.history.forEach(msg => { msg.type = 'text'; });
            const before = JSON.stringify(char.history);
            const save = window.saveCharactersToStorage;
            window.saveCharactersToStorage = async () => false;
            try {
                const repairing = repairWechatChatWindowGreeting(char);
                refreshChatView(char); // Includes the real narration normalization pass.
                return { result: await repairing, restored: JSON.stringify(char.history) === before };
            } finally { window.saveCharactersToStorage = save; }
        }, windowId);
        assert.deepEqual(failedUpgrade, { result: false, restored: true }, 'save failure rolls back even after rendering cloned the narration');
        assert.deepEqual(errors, []);
        console.log(`chat window greeting browser check passed (${themes.length} themes, 375px, legacy repair and reload)`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
