'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/music-island-feedback');
fs.mkdirSync(output, { recursive: true });
const rectOf = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof updateWechatMusicIsland === 'function');
        await page.evaluate(async () => {
            await byndStylesReady; unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'island-proof', name: '林间', avatar: DEFAULT_AVATAR, chatConfig: {}, history: [
                { type: 'text', isMe: false, content: '听这首歌吧', timestamp: Date.now() - 120000 },
                { type: 'text', isMe: true, content: '一起听', timestamp: Date.now() - 60000 }
            ] }];
            openApp('wechat'); openChat('island-proof'); ByndBuiltinLibrary?.close(); selectWechatUiTheme('pixel');
            openWechatMusicListenPlayer({ title: '花开一瞬间为爱沉醉一世间', artist: 'PP Krit', artwork: 'assets/ui/pixel-chat/wallpaper.svg' });
            // Simulate an already playing track without starting network audio during UI verification.
            window.getWechatMusicPlaybackState = () => ({ playing: true, currentTime: 0, duration: 200, url: '' });
            closeWechatMusicListenPlayer(); updateWechatMusicIsland();
            window.proofVibrations = [];
            navigator.vibrate = pattern => { proofVibrations.push(pattern); return true; };
        });
        await page.waitForTimeout(900);
        await page.evaluate(() => updateWechatMusicIsland());
        const island = page.locator('#wc-music-island');
        const initial = await island.evaluate(rectOf);
        const header = await page.locator('.wc-room-header').evaluate(rectOf);
        assert.ok(initial.y >= header.bottom + 7, `default music island clears back and more buttons: ${JSON.stringify({initial, header})}`);
        assert.ok(initial.x >= 8 && initial.right <= 367);
        await page.screenshot({ path: path.join(output, 'pixel-default-375.png'), animations: 'disabled' });
        const dragTo = async (x, y) => {
            const box = await island.evaluate(rectOf);
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down(); await page.mouse.move(x, y, { steps: 8 }); await page.mouse.up();
        };
        await dragTo(300, 520);
        const moved = await island.evaluate(rectOf);
        assert.ok(moved.y > initial.y + 200 && moved.x > initial.x, 'mouse drag moves horizontally and vertically');
        assert.ok(await page.locator('#wc-music-listen-player').evaluate(el => el.classList.contains('hidden')), 'drag release does not open player');
        await page.evaluate(() => { updateWechatMusicIsland(); selectWechatUiTheme('bynd'); updateWechatMusicIsland(); });
        const retained = await island.evaluate(rectOf);
        assert.ok(Math.abs(retained.y - moved.y) <= 1, 'track updates and theme switching preserve dragged position');
        await island.click();
        assert.equal(await page.locator('#wc-music-listen-player').evaluate(el => el.classList.contains('hidden')), false, 'a subsequent tap still opens player');
        await page.evaluate(() => { closeWechatMusicListenPlayer(); selectWechatUiTheme('pixel'); updateWechatMusicIsland(); });
        await dragTo(-200, -200);
        const upper = await island.evaluate(rectOf);
        assert.ok(upper.y >= header.bottom + 7 && upper.x >= 8, 'drag cannot cover navigation or leave the screen');
        const touch = await page.context().newCDPSession(page);
        const point = { x: upper.x + upper.width / 2, y: upper.y + upper.height / 2 };
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: 620, id: 1 }] });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.ok((await island.evaluate(rectOf)).y > 450, 'real touch drag works');
        assert.equal(await page.locator('#wc-music-listen-player').evaluate(el => el.classList.contains('hidden')), true, 'touch drag does not open player');
        await page.screenshot({ path: path.join(output, 'pixel-dragged-375.png'), animations: 'disabled' });
        await dragTo(700, 1500);
        await page.setViewportSize({ width: 320, height: 640 });
        await page.waitForTimeout(80);
        const resized = await island.evaluate(rectOf);
        assert.ok(resized.right <= 312 && resized.bottom <= 624, 'viewport resize clamps remembered position');
        await page.setViewportSize({ width: 375, height: 844 });
        await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'ui/theme/foundation-layout.css'), 'utf8').replaceAll('env(safe-area-inset-top', 'var(--proof-safe-top') });
        for (const mode of ['parent', 'header']) for (const safe of [47, 59]) for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ mode, safe }) => {
                document.documentElement.classList.toggle('bynd-display-fullscreen', mode === 'header');
                document.documentElement.style.setProperty('--proof-safe-top', `${safe}px`);
                updateWechatMusicIsland();
            }, { mode, safe });
            await dragTo(-100, -100);
            const geometry = await island.evaluate(rectOf);
            const nav = await page.locator('.wc-room-header').evaluate(rectOf);
            assert.ok(geometry.y >= nav.bottom + 7 && geometry.y >= safe + 64, `${mode}/${safe}/${width}: safe area and navigation remain clear`);
            assert.ok(geometry.x >= 8 && geometry.right <= width - 8 && geometry.bottom <= 844);
            if (safe === 59 && width === 320) await page.screenshot({ path: path.join(output, `pixel-${mode}-safe59-320.png`), animations: 'disabled' });
        }
        await page.evaluate(() => { hideWechatMusicIsland(); sendWechatPoke('肩膀'); });
        await page.waitForFunction(() => document.querySelector('.msg-row.left .wc-avatar-poke'));
        assert.equal(await page.locator('.msg-row.left .wc-avatar-poke').evaluate(el => getComputedStyle(el).animationName), 'wcAvatarPoke', 'poke has its own visible animation');
        assert.equal(await page.locator('#wechat-chat-room').evaluate(el => el.classList.contains('wc-screen-shake')), false, 'outgoing poke only animates peer avatar');
        assert.deepEqual(await page.evaluate(() => proofVibrations), [], 'poke does not vibrate the device');
        await page.waitForTimeout(400);
        await page.evaluate(() => {
            const msg = { type: 'poke', isMe: false, content: '脑袋', timestamp: Date.now() };
            myCharacters[0].history.push(msg);
            triggerWechatScreenFeedback('poke', msg);
            refreshChatView(myCharacters[0]);
        });
        await page.waitForFunction(() => document.querySelector('.msg-row.right .wc-avatar-poke'));
        assert.equal(await page.locator('.msg-row.left .wc-avatar-poke').count(), 0, 'received poke targets own avatar after refresh');
        await page.evaluate(() => sendWechatScreenShake('回神啦'));
        assert.equal(await page.locator('#wechat-chat-room').evaluate(el => el.classList.contains('wc-screen-shake')), true, 'shake still animates the whole chat');
        assert.equal(await page.locator('#wechat-chat-room').evaluate(el => getComputedStyle(el).animationName), 'wcScreenShake');
        assert.deepEqual(await page.evaluate(() => proofVibrations), [[42, 28, 42, 28, 42]], 'shake keeps device vibration');
        await page.waitForTimeout(500);
        assert.equal(await page.locator('.wc-screen-shake, .wc-avatar-poke').count(), 0, 'effects clean up after playback');
        assert.deepEqual(errors, []);
        console.log('Music island verified: mouse/touch drag, tap, update/theme retention, resize, navigation/safe areas; poke and shake verified in both directions.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
