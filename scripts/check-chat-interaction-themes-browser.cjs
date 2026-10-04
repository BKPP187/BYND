'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/chat-interaction-themes');
fs.mkdirSync(output, { recursive: true });
const styleOf = el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return { background: s.backgroundColor, color: s.color, radius: s.borderRadius, shadow: s.boxShadow, blur: s.backdropFilter, top: r.top, bottom: r.bottom, left: r.left, right: r.right, overflow: el.scrollWidth - el.clientWidth };
};
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof openWechatMusicListenPlayer === 'function' && typeof applyWechatUiTheme === 'function');
        await page.evaluate(async () => {
            await byndStylesReady; unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'interaction-proof', name: '林间', avatar: DEFAULT_AVATAR, chatConfig: {}, history: [
                { type: 'poke', content: '拍了拍肩膀', isMe: true },
                { type: 'screen_shake', content: '晚安', isMe: false },
                { type: 'link_card', title: '一起看这篇文章', url: 'https://example.com/story', note: '分享给你', isMe: false },
                { type: 'music_card', title: '夜间电台', artist: 'BYND', music: { title: '夜间电台', artist: 'BYND' }, isMe: true },
                { type: 'videoCall', status: '已结束', duration: 42, isMe: true }
            ].map((msg, index) => ({ ...msg, timestamp: Date.now() - 60000 * (6 - index) })) }];
            openApp('wechat'); openChat('interaction-proof'); ByndBuiltinLibrary?.close();
        });
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(t => t.id));
        const results = [];
        for (const theme of themes) {
            await page.evaluate(theme => {
                selectWechatUiTheme(theme);
                openWechatMusicListenPlayer({ title: '夜间电台 · 与你一起听', artist: 'BYND', artwork: 'assets/ui/pixel-chat/wallpaper.svg' });
                document.getElementById('wc-toast')?.classList.remove('show');
            }, theme);
            const player = await page.locator('#wc-music-listen-player').evaluate(styleOf);
            assert.equal(await page.locator('.phone-container').getAttribute('data-wechat-ui-theme'), theme);
            assert.equal(player.overflow <= 1 && player.left >= 0 && player.right <= 375, true, `${theme}: player fits narrow screen`);
            assert.ok(player.top >= 0 && player.bottom <= 844, `${theme}: player stays inside screen`);
            const accent = await page.evaluate(() => getComputedStyle(document.getElementById('app-wechat-window')).getPropertyValue('--wc-theme-accent').trim());
            const normalizedAccent = await page.evaluate(color => { const node = document.createElement('span'); node.style.color = color; document.body.append(node); const value = getComputedStyle(node).color; node.remove(); return value; }, accent);
            assert.equal(await page.locator('.wc-music-listen-progress span').evaluate(el => getComputedStyle(el).backgroundColor), normalizedAccent, `${theme}: music uses actual theme accent`);
            assert.equal(await page.locator('.msg-link-icon').evaluate(el => getComputedStyle(el).color), normalizedAccent, `${theme}: link icon follows accent`);
            assert.equal((await page.locator('.msg-link-card').evaluate(styleOf)).background, player.background, `${theme}: link card matches the theme surface`);
            await page.evaluate(() => toggleWechatMusicQueuePanel());
            assert.equal(await page.locator('.wc-music-queue-panel').isVisible(), true);
            await page.evaluate(() => toggleWechatMusicQueuePanel());
            await page.evaluate(() => {
                const lyrics = ensureWechatMusicLyricsFloat();
                lyrics.querySelector('.wc-music-lyrics-lines').innerHTML = '<p class="wc-music-lyric-line active">与你一起听夜间电台</p>';
                lyrics.classList.remove('hidden');
            });
            assert.equal(await page.locator('.wc-music-lyric-line.active').evaluate(el => getComputedStyle(el).color), normalizedAccent, `${theme}: lyrics follow the theme accent`);
            await page.evaluate(() => hideWechatMusicLyricsFloat());
            if (theme === 'pixel') {
                assert.equal(player.radius, '2px'); assert.equal(player.blur, 'none'); assert.ok(player.shadow.includes('inset'));
                assert.equal((await page.locator('.msg-link-card').evaluate(styleOf)).radius, '1px');
                await page.screenshot({ path: path.join(output, 'pixel-music-375.png'), animations: 'disabled' });
            }
            if (['bynd', 'wechat', 'claude', 'couple'].includes(theme)) await page.screenshot({ path: path.join(output, `${theme}-music-375.png`), animations: 'disabled' });
            await page.evaluate(() => closeWechatMusicListenPlayer());
            for (const type of ['poke', 'screen_shake', 'music_card', 'videoCall', 'voice']) {
                await page.evaluate(type => openWechatComposer(type), type);
                const composer = await page.locator('#wc-composer-modal .wc-compose-card').evaluate(styleOf);
                assert.equal(composer.radius, player.radius, `${theme}: ${type} composer matches music frame`);
                if (theme === 'pixel' && ['poke', 'screen_shake'].includes(type)) await page.screenshot({ path: path.join(output, `pixel-${type}-375.png`), animations: 'disabled' });
                await page.evaluate(() => closeWechatComposer());
            }
            await page.evaluate(() => {
                window._wechatActiveCall = { id: 'video-proof', type: 'videoCall', charId: 'interaction-proof' };
                setupWechatCallScreen(window._wechatActiveCall, myCharacters[0]);
                setWechatCallMode('connected');
                const screen = ensureWechatCallScreen(); screen.classList.remove('hidden');
                document.getElementById('wc-call-log').innerHTML = '<div class="wc-call-line user">听得见吗？</div><div class="wc-call-line assistant">听得见。</div>';
            });
            const videoControl = await page.locator('#wc-call-screen .wc-call-tool i').first().evaluate(styleOf);
            await page.evaluate(() => toggleWechatCallControl('mute'));
            assert.equal(await page.locator('[data-wc-call-control="mute"]').evaluate(el => el.classList.contains('active')), true, 'themed video mute control still responds');
            if (theme === 'pixel') {
                assert.equal(videoControl.radius, '1px');
                await page.screenshot({ path: path.join(output, 'pixel-video-375.png'), animations: 'disabled' });
            }
            results.push({ theme, player, videoControl });
            await page.evaluate(() => { document.getElementById('wc-call-screen').classList.add('hidden'); window._wechatActiveCall = null; });
        }
        // Existing overlays update immediately without being recreated.
        await page.evaluate(() => { selectWechatUiTheme('pixel'); openWechatMusicListenPlayer({ title: '切换主题时保持当前音乐' }); });
        const firstHandle = await page.locator('#wc-music-listen-player').elementHandle();
        await page.evaluate(() => selectWechatUiTheme('bynd'));
        assert.equal(await firstHandle.evaluate(el => el === document.getElementById('wc-music-listen-player')), true);
        assert.equal((await page.locator('#wc-music-listen-player').evaluate(styleOf)).radius, '20px');
        await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'ui/theme/foundation-layout.css'), 'utf8').replaceAll('env(safe-area-inset-top', 'var(--proof-safe-top') });
        for (const mode of ['parent', 'header']) {
            for (const safe of [47, 59]) {
                for (const width of [320, 375]) {
                    await page.setViewportSize({ width, height: 844 });
                    await page.evaluate(({ mode, safe }) => {
                        document.documentElement.classList.toggle('bynd-display-fullscreen', mode === 'header');
                        document.documentElement.style.setProperty('--proof-safe-top', `${safe}px`);
                        selectWechatUiTheme('pixel');
                        openWechatMusicListenPlayer({ title: '夜间电台', artist: 'BYND' });
                        document.getElementById('wc-toast')?.classList.remove('show');
                    }, { mode, safe });
                    const geometry = await page.locator('#wc-music-listen-player').evaluate(styleOf);
                    assert.equal(Math.round(geometry.top), safe + 70, `${mode}/${safe}: player reserves safe area once`);
                    assert.ok(geometry.bottom <= 844 && geometry.overflow <= 1 && geometry.right <= width, `${mode}/${safe}/${width}: player fits`);
                    if (width === 320 && safe === 59) await page.screenshot({ path: path.join(output, `pixel-music-${mode}-safe59-320.png`), animations: 'disabled' });
                    await page.evaluate(() => {
                        closeWechatMusicListenPlayer();
                        openWechatComposer('poke');
                    });
                    const composer = await page.locator('#wc-composer-modal .wc-compose-card').evaluate(styleOf);
                    assert.ok(composer.top >= safe && composer.bottom <= 844, 'composer clears native status bar');
                    await page.evaluate(() => {
                        closeWechatComposer();
                        window._wechatActiveCall = { id: 'safe-video', type: 'videoCall', charId: 'interaction-proof' };
                        setupWechatCallScreen(window._wechatActiveCall, myCharacters[0]); setWechatCallMode('connected');
                        document.getElementById('wc-call-screen').classList.remove('hidden');
                    });
                    const tile = await page.locator('#wc-video-local-tile').evaluate(styleOf);
                    assert.equal(Math.round(tile.top), safe + 58, 'video tile reserves inset once');
                    const controls = await page.locator('#wc-call-actions').evaluate(styleOf);
                    assert.ok(controls.left >= 0 && controls.right <= width && controls.bottom <= 844, 'video controls fit narrow screen');
                    if (width === 320 && safe === 59) await page.screenshot({ path: path.join(output, `pixel-video-${mode}-safe59-320.png`), animations: 'disabled' });
                    await page.evaluate(() => { document.getElementById('wc-call-screen').classList.add('hidden'); window._wechatActiveCall = null; });
                }
            }
        }
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
        assert.deepEqual(errors, []);
        console.log(`Chat interaction themes verified: ${themes.length} themes, music/composers/link cards/video, live switching and 320/375px safe areas.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
