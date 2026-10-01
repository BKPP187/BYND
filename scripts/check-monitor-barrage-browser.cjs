'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/monitor-barrage');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [], checks = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof showWechatMonitorBarrage === 'function');
        await page.evaluate(async () => { await window.__byndCoreReady; await byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); });
        const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><rect width="90" height="90" rx="45" fill="#d8e2ee"/><circle cx="45" cy="36" r="15" fill="#485e76"/><path d="M15 85Q45 48 75 85" fill="#485e76"/></svg>');
        await page.evaluate(avatar => {
            window.myCharacters = [{ id: 'chat-proof', name: '南风', avatar, chatConfig: {}, history: [{ type: 'text', isMe: false, content: '你刚才说的，我都听见了。', timestamp: '2026-09-28T09:00:00+08:00' }] }];
            openApp('wechat'); openChat('chat-proof'); ByndBuiltinLibrary?.close();
            document.querySelector('.phone-container').style.setProperty('--bynd-header-safe-top', '47px');
        }, avatar);
        const phrases = ['我刚刚看到这段对话了。', '这个转折有点突然。', '你们两个怎么又绕回原点了？', '等一下，他刚才明明不是这么说的。', '这一句我得记下来。', '先别急，让我看看接下来会怎样。'];
        for (const [width, height] of [[375, 844], [320, 568], [430, 932]]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(({ avatar, phrases }) => {
                const watcher = { id: 'barrage-proof', name: '林间', avatar, chatConfig: { monitorBarrageSpeed: 1 } };
                showWechatMonitorBarrage(watcher, phrases);
            }, { avatar, phrases });
            await page.locator('.wc-monitor-comment').first().waitFor();
            await page.waitForTimeout(2450);
            await page.locator('.wc-monitor-comment').evaluateAll(cards => cards.forEach(card => { card.style.animationPlayState = 'paused'; }));
            const state = await page.locator('#wc-monitor-barrage').evaluate(root => {
                const layer = getComputedStyle(root), cards = [...root.querySelectorAll('.wc-monitor-comment')];
                return { count: cards.length, pointerEvents: layer.pointerEvents, cardBackground: getComputedStyle(cards[0]).backgroundColor,
                    width: root.clientWidth, height: root.clientHeight, top: root.getBoundingClientRect().top, viewportHeight: innerHeight, scrollWidth: root.scrollWidth, cards: cards.map(card => {
                        const bounds = card.getBoundingClientRect();
                        return { text: card.querySelector('.wc-monitor-comment-text')?.textContent, avatar: card.querySelector('img')?.complete,
                            name: card.querySelector('strong')?.textContent, heart: !!card.querySelector('.wc-monitor-comment-heart'), delay: getComputedStyle(card).animationDelay,
                            left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
                    }) };
            });
            assert.equal(state.count, phrases.length);
            assert.equal(state.pointerEvents, 'none');
            assert.equal(state.cardBackground, 'rgb(255, 255, 255)');
            assert.ok(state.scrollWidth <= state.width + 1, JSON.stringify(state));
            assert.ok(state.cards[0].top >= 47, 'comments stay below the native status-bar area');
            if (height < 650) assert.ok(parseFloat(state.cards[4].delay) >= 4, 'short screens show the last cards in a second wave');
            for (let index = 0; index < state.cards.length; index++) {
                const card = state.cards[index];
                assert.equal(card.text, phrases[index]);
                assert.equal(card.name, '林间');
                assert.ok(card.avatar && card.heart && card.left >= -2 && card.right <= width + 2, JSON.stringify(card));
                assert.ok(card.top >= 0 && card.bottom <= height + 3, JSON.stringify({card, state}));
            }
            await page.screenshot({ path: path.join(output, `barrage-${width}.png`) });
            checks.push({ width, height, cards: state.count, passed: true });
            await page.locator('#wc-monitor-barrage').evaluate(node => node.remove());
        }
        await page.evaluate(avatar => showWechatMonitorBarrage({ id: 'barrage-proof', name: '林间', avatar, chatConfig: { monitorBarrageSpeed: 1 } }, []), avatar);
        assert.equal(await page.locator('#wc-monitor-barrage').count(), 0, 'empty reactions do not cover the chat');
        const faster = await page.evaluate(avatar => {
            showWechatMonitorBarrage({ id: 'barrage-proof', name: '林间', avatar, chatConfig: { monitorBarrageSpeed: 1.6 } }, ['快一点']);
            return parseFloat(getComputedStyle(document.querySelector('.wc-monitor-comment')).animationDuration);
        }, avatar);
        assert.ok(faster < 6.2, `speed preference should shorten the animation (${faster}s)`);
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log('Monitor barrage comment cards passed browser layout checks.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
