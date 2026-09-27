'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/chat-toolbar');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
    const errors = [], checks = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    const metadata = () => page.locator('#chat-room-content .msg-meta, #chat-room-content .msg-media-meta, #chat-room-content .msg-sticker-meta').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node);
        return { type: node.className, text: node.textContent, display: style.display, visibility: style.visibility, opacity: style.opacity, color: style.color, checks: node.querySelectorAll('.ri-check-double-line').length };
    }));
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof toggleChatToolbar === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady;
            unlockPhone(); ByndBuiltinLibrary?.close();
            const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#e4e8f0"/></svg>');
            window.myCharacters = [{ id: 'toolbar-proof', name: '林间', avatar: image, history: [
                { type: 'text', isMe: false, content: '消息时间应该一直保留。', timestamp: '2026-09-27T08:50:00+08:00' },
                { type: 'text', isMe: true, content: '打开功能栏也能看到。', timestamp: '2026-09-27T08:51:00+08:00' },
                { type: 'image', isMe: false, content: image, timestamp: '2026-09-27T08:52:00+08:00' },
                { type: 'sticker', isMe: false, content: image, stickerName: '测试表情', timestamp: '2026-09-27T08:53:00+08:00' }
            ], chatConfig: {} }];
            openApp('wechat'); openChat('toolbar-proof');
        });
        for (const theme of ['bynd', 'telegram']) for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(theme => { closeChatToolbar(); applyWechatUiTheme(theme); refreshChatView(window.myCharacters[0]); }, theme);
            const before = await metadata();
            assert.equal(before.length, 4);
            assert.ok(before.every(row => row.visibility === 'visible' && row.display !== 'none' && row.checks === 1));
            const saved = await page.evaluate(() => JSON.stringify(window.myCharacters[0].history));
            await page.locator('#wechat-chat-room .wc-add-btn').click();
            assert.equal(await page.locator('#wc-chat-toolbar').isVisible(), true);
            assert.deepEqual(await metadata(), before, `${theme} ${width}: opening must preserve message metadata`);
            assert.equal(await page.evaluate(() => JSON.stringify(window.myCharacters[0].history)), saved);
            if (width === 375) await page.screenshot({ path: path.join(output, `${theme}-open.png`) });
            await page.locator('#wechat-chat-room .wc-add-btn').click();
            assert.equal(await page.locator('#wc-chat-toolbar').isVisible(), false);
            assert.deepEqual(await metadata(), before, `${theme} ${width}: closing must preserve message metadata`);
            checks.push({ theme, width, messages: before.length, passed: true });
        }
        // Use a real scrolled photo stack to check paint order, not just z-index values.
        await page.evaluate(() => {
            const char = window.myCharacters[0], image = char.history[2].content;
            const text = index => ({ type: 'text', isMe: false, content: `用于检查滚动的消息 ${index}`, timestamp: '2026-09-27T08:50:00+08:00' });
            char.history = [...Array.from({ length: 14 }, (_, index) => text(index)),
                { type: 'image_stack', isMe: false, images: Array(9).fill(image), timestamp: '2026-09-27T08:52:00+08:00' },
                ...Array.from({ length: 14 }, (_, index) => text(index + 14))];
        });
        for (const theme of ['telegram', 'qq', 'wechat', 'line']) for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(theme => {
                localStorage.setItem('wechat_ui_theme_v1', theme); applyWechatUiTheme(theme);
                document.querySelector('.phone-container').style.setProperty('--bynd-header-safe-top', '47px');
                refreshChatView(window.myCharacters[0]);
                document.getElementById('chat-room-content').scrollTop = 0;
            }, theme);
            await page.locator('.wc-image-stack').focus();
            await page.locator('.wc-image-stack').press('ArrowRight');
            assert.equal(await page.locator('.wc-image-stack-count').textContent(), '2/9');
            for (const selector of ['.image-stack-bubble .msg-media-meta', '.wc-image-stack-count', '.wc-image-stack-card.active']) {
                // Some themes intentionally omit per-message times even before scrolling.
                if (await page.locator(selector).evaluate(node => getComputedStyle(node).display === 'none')) continue;
                const hit = await page.evaluate(selector => {
                    const target = document.querySelector(selector), header = document.querySelector('.wc-room-header');
                    const content = document.getElementById('chat-room-content');
                    const rect = target.getBoundingClientRect(), bar = header.getBoundingClientRect();
                    content.scrollTop += rect.y + rect.height / 2 - (bar.y + bar.height / 2);
                    const moved = target.getBoundingClientRect(), x = moved.x + moved.width / 2, y = moved.y + moved.height / 2;
                    const layers = document.elementsFromPoint(x, y);
                    const headerIndex = layers.findIndex(node => node === header || header.contains(node));
                    const targetIndex = layers.findIndex(node => node === target || target.contains(node));
                    return { insideHeader: y >= bar.y && y < bar.bottom, headerIndex, targetIndex, y, bar: { y: bar.y, bottom: bar.bottom }, scrollTop: content.scrollTop, scrollHeight: content.scrollHeight, clientHeight: content.clientHeight };
                }, selector);
                assert.ok(hit.insideHeader && hit.headerIndex >= 0 && (hit.targetIndex < 0 || hit.headerIndex < hit.targetIndex), `${theme} ${width} ${selector}: ${JSON.stringify(hit)}`);
                if (theme === 'telegram' && width === 375 && selector.includes('msg-media-meta')) await page.screenshot({ path: path.join(output, 'stack-under-header.png') });
            }
            checks.push({ theme, width, stackHeaderLayer: 'passed', stackKeyboard: 'passed' });
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log('Chat timestamps remain visible with the toolbar; photo stacks stay below headers across themes and widths.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
