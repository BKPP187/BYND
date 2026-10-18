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
                        return { text: card.querySelector('.wc-monitor-comment-text')?.textContent, initial: card.querySelector('.wc-monitor-initial')?.textContent,
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
                assert.equal(card.initial, '林');
                assert.ok(card.heart && card.left >= -2 && card.right <= width + 2, JSON.stringify(card));
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
        await page.locator('#wc-monitor-barrage').evaluate(node => node.remove());
        await page.clock.install();
        const longText = '认真吃瓜的路人：' + '这是一张需要慢慢阅读的完整弹幕卡片，点开之后可以停下来看到最后。'.repeat(30) + '全文结束。';
        const readerPhrases = [longText, '第二位观众：这一条也可以完整查看。', '第三位观众：不用再追着闪过的卡片看了。'];
        const cdp = await context.newCDPSession(page);
        for (const [width, safe, parentReserved] of [[320, 47, false], [375, 59, false], [320, 47, true], [375, 59, true]]) {
            await page.setViewportSize({ width, height: 700 });
            await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: safe, bottom: 24, left: 0, right: 0 } });
            await page.evaluate(({ parentReserved }) => {
                document.documentElement.classList.add('mobile-runtime', 'bynd-ios');
                const phone = document.querySelector('.phone-container');
                document.body.style.paddingTop = parentReserved ? 'env(safe-area-inset-top)' : '0';
                phone.style.height = parentReserved ? 'calc(100dvh - env(safe-area-inset-top))' : '100dvh';
                phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : 'env(safe-area-inset-top)');
            }, { parentReserved });
            await page.evaluate(({ avatar, readerPhrases }) => {
                showWechatMonitorBarrage({ id: 'barrage-reader', name: '林间', avatar, chatConfig: {} }, readerPhrases);
                // Park the real animation in its visible interval for a deterministic tap.
                const card = document.querySelector('.wc-monitor-comment');
                const animation = card.getAnimations()[0];
                if (animation) { animation.pause(); animation.currentTime = 1800; }
            }, { avatar, readerPhrases });
            assert.equal(await page.locator('.wc-monitor-comment').first().evaluate(node => getComputedStyle(node).pointerEvents), 'auto');
            await page.locator('.wc-monitor-comment').first().tap({ position: { x: 35, y: 25 } });
            const reader = page.locator('#wc-monitor-reader');
            await reader.waitFor({ state: 'visible' });
            assert.equal(await reader.locator('.wc-monitor-card-head, .wc-monitor-initial').count(), 0, 'details start directly with the barrage text');
            assert.equal(await reader.locator('img').count(), 0, 'the initial avatar does not depend on an image');
            assert.equal(await reader.locator('.wc-monitor-reader-text').textContent(), longText, 'the long card is not truncated at 72 characters');
            assert.equal(await reader.locator('[data-reader-count]').textContent(), '1 / 3');
            assert.equal(await reader.locator('[data-reader-prev]').isDisabled(), true);
            const geometry = await reader.evaluate(node => {
                const rect = element => { const r = element.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left, right:r.right }; };
                const content = node.querySelector('.wc-monitor-reader-content');
                return { card:rect(node.querySelector('.wc-monitor-reader-card')), close:rect(node.querySelector('[data-reader-close]')), footer:rect(node.querySelector('footer')), overflow:node.scrollWidth-node.clientWidth, scrollable:content.scrollHeight>content.clientHeight };
            });
            assert.ok(geometry.close.top >= safe && geometry.footer.bottom <= 700 - 24);
            assert.ok(geometry.card.left >= 0 && geometry.card.right <= width && geometry.overflow <= 1);
            assert.equal(geometry.scrollable, true, 'long content scrolls inside the fixed reader');
            await page.screenshot({ path: path.join(output, `reader-long-${width}-${safe}-${parentReserved?'parent':'header'}.png`) });
            await reader.locator('.wc-monitor-reader-content').evaluate(node => { node.scrollTop = node.scrollHeight; });
            assert.ok(await reader.locator('.wc-monitor-reader-content').evaluate(node => node.scrollTop > 0));
            await page.clock.fastForward(20000);
            assert.equal(await reader.isVisible(), true, 'reading survives the original barrage expiration');
            await page.evaluate(avatar => showWechatMonitorBarrage({ id:'new-watcher',name:'另一位',avatar,chatConfig:{} }, ['新来的弹幕']), avatar);
            assert.equal(await reader.locator('.wc-monitor-reader-text').textContent(), longText, 'new bursts do not replace an open reader');
            await reader.locator('[data-reader-next]').click();
            assert.equal(await reader.locator('.wc-monitor-reader-text').textContent(), readerPhrases[1]);
            assert.equal(await reader.locator('.wc-monitor-reader-content').evaluate(node => node.scrollTop), 0);
            await reader.locator('[data-reader-next]').click();
            assert.equal(await reader.locator('[data-reader-next]').isDisabled(), true);
            await reader.locator('[data-reader-prev]').click();
            await page.screenshot({ path: path.join(output, `reader-${width}-${safe}-${parentReserved?'parent':'header'}.png`) });
            await reader.locator('[data-reader-close]').click();
            assert.equal(await reader.count(), 0);
            checks.push({ width, safe, parentReserved, reader: true, timeoutSurvived:true, scrollable:true });
            await page.locator('#wc-monitor-barrage').evaluate(node => node.remove());
        }
        // Keyboard activation and focus containment use the same production card handlers.
        await page.evaluate(avatar => {
            showWechatMonitorBarrage({id:'keyboard-reader',name:'林间',avatar,chatConfig:{}}, ['键盘也能打开']);
        }, avatar);
        await page.locator('.wc-monitor-comment').first().focus();
        await page.locator('.wc-monitor-comment').first().press('Enter');
        await page.locator('[data-reader-close]').press('Shift+Tab');
        assert.equal(await page.evaluate(() => document.activeElement.matches('.wc-monitor-reader-content')), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#wc-monitor-reader').count(), 0);
        const shortPhrases = ['吃瓜一号：这瓜保熟吗', '路过二号：俺也一样', '困困三号：突然对上脑电波', '奶茶四号：我的外卖怎么还没来', '围观五号：嘴角先谈上了', '弹幕六号：这俩有点东西'];
        for (const [width, safe, parentReserved, crowded] of [[320,47,false,false], [375,59,false,true], [320,47,true,true], [375,59,true,false]]) {
            await page.setViewportSize({ width, height: 700 });
            await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets:{top:safe,bottom:24,left:0,right:0} });
            await page.evaluate(({parentReserved, crowded, shortPhrases}) => {
                const phone = document.querySelector('.phone-container');
                document.body.style.paddingTop = parentReserved ? 'env(safe-area-inset-top)' : '0';
                phone.style.height = parentReserved ? 'calc(100dvh - env(safe-area-inset-top))' : '100dvh';
                phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : 'env(safe-area-inset-top)');
                const target = window.myCharacters[0];
                target.chatConfig.monitorBarrageStyle = 'scroll';
                showWechatMonitorBarrage({id:'watcher',name:'林间',chatConfig:{}}, shortPhrases, {targetChar:target,chorus:crowded?shortPhrases[1]:''});
                document.querySelectorAll('.wc-monitor-flying-text').forEach(button => { const animation = button.getAnimations()[0]; animation.pause(); animation.currentTime = 10000; });
            }, {parentReserved, crowded, shortPhrases});
            const state = await page.locator('#wc-monitor-barrage').evaluate(node => {
                const bounds = node.getBoundingClientRect();
                return {top:bounds.top, bottom:bounds.bottom, height:bounds.height, background:getComputedStyle(node).backgroundImage, pointer:getComputedStyle(node).pointerEvents,
                    entries:[...node.querySelectorAll('button')].map(button => ({text:button.textContent,lane:button.dataset.lane,duration:parseFloat(getComputedStyle(button).animationDuration),delay:parseFloat(getComputedStyle(button).animationDelay),width:button.getBoundingClientRect().width}))};
            });
            const headerBottom = await page.locator('#wc-floating-avatar').evaluate(node => node.getBoundingClientRect().bottom);
            assert.ok(state.top >= Math.max(safe, headerBottom) + 7, `flow starts below the real chat header and safe area: ${JSON.stringify({state,headerBottom,safe})}`);
            assert.ok(state.bottom < 700 - 100, 'flow leaves the composer and lower chat usable');
            assert.equal(state.background, 'none', 'flow does not dim or cover the chat');
            assert.equal(state.pointer, 'none');
            assert.equal(state.entries.length, crowded ? 24 : 6);
            assert.ok(state.entries.every(entry => !entry.text.includes('：') && entry.text.length <= 25));
            assert.ok(state.entries.every(entry => entry.duration >= 18), 'slow flight remains slow during a chorus');
            const initialX = await page.locator('.wc-monitor-flying-text').first().evaluate(button => button.getBoundingClientRect().left);
            await page.locator('.wc-monitor-flying-text').first().evaluate(button => { button.getAnimations()[0].currentTime = 12000; });
            const laterX = await page.locator('.wc-monitor-flying-text').first().evaluate(button => button.getBoundingClientRect().left);
            assert.ok(laterX < initialX - 20 && laterX > initialX - 60, 'text slowly moves from right to left');
            for (const time of [5000,10000,18000,24000,30000]) {
                const collisions = await page.locator('#wc-monitor-barrage').evaluate((node,time) => {
                    const bounds = node.getBoundingClientRect();
                    const visible = [...node.querySelectorAll('button')].map(button => {
                        button.getAnimations()[0].currentTime = time;
                        const rect = button.getBoundingClientRect();
                        return {lane:button.dataset.lane,left:rect.left,right:rect.right};
                    }).filter(rect => rect.left < bounds.right && rect.right > bounds.left);
                    return visible.filter((rect,index) => visible.some((other,j) => j>index && rect.lane===other.lane && rect.left<other.right && other.left<rect.right));
                }, time);
                assert.deepEqual(collisions, [], 'same-lane text stays separated even in a chorus');
            }
            await page.locator('#wc-monitor-barrage').evaluate(node => node.querySelectorAll('button').forEach(button => {button.getAnimations()[0].currentTime=10000;}));
            await page.screenshot({path:path.join(output,`scroll-${width}-${safe}-${parentReserved?'parent':'header'}-${crowded?'chorus':'calm'}.png`)});
            await page.locator('.wc-monitor-flying-text').first().click();
            assert.equal(await page.locator('.wc-monitor-reader-text').textContent(), shortPhrases[0]);
            assert.equal(await page.locator('[data-reader-count]').textContent(),'1 / 6','chorus copies do not flood the full-text reader');
            await page.locator('[data-reader-close]').click();
            checks.push({width,safe,parentReserved,scroll:true,crowded,entries:state.entries.length,motion:true,noCollisions:true});
        }
        // Respect reduced-motion while keeping readable comments and the full reader.
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.evaluate(shortPhrases => showWechatMonitorBarrage({name:'林间',chatConfig:{}},shortPhrases,{chorus:shortPhrases[1]}),shortPhrases);
        assert.ok(await page.locator('.wc-monitor-flying-text').count() <= 8);
        assert.equal(await page.locator('.wc-monitor-flying-text').first().evaluate(button=>getComputedStyle(button).animationName),'none');
        await page.locator('.wc-monitor-flying-text').first().click();
        await page.locator('[data-reader-close]').click();
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.evaluate(shortPhrases => {showWechatMonitorBarrage({name:'林间',chatConfig:{}},shortPhrases);closeChat();},shortPhrases);
        assert.equal(await page.locator('#wc-monitor-barrage').count(),0,'leaving chat cleans up the longer-lived flow');
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log('Monitor barrage passed: card reader, slow drifting text, contextual chorus, no lane collisions, reduced motion, navigation and 47/59px safe-area ownership.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
