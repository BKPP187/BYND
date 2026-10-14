'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/music-search');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const workerSource = fs.readFileSync(path.join(root, 'workers/bynd-netease-audio-worker.js'), 'utf8');
    const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(workerSource).toString('base64'));
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    let offline = false, playable = false;
    const nativeQueries = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/netease/api/search') {
            if (offline) return route.abort();
            nativeQueries.push(url.searchParams.get('keywords'));
            // Exercise the saved Worker against the real public catalog, without deploying it.
            const response = await worker.fetch(new Request(url), {});
            return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
        }
        if (url.pathname.startsWith('/netease/api/song/url')) {
            if (offline) return route.abort();
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: [{ id: 1492362609, url: playable ? 'https://example.org/authorized.mp3' : null }] }) });
        }
        if (url.hostname === 'meting.mikus.ink') return route.fulfill({ contentType: 'application/json', body: '[]' });
        if (url.hostname === 'archive.org' && url.pathname.includes('advancedsearch')) {
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ response: { docs: [{ identifier: 'unrelated', title: 'Reading 1 Volume 6', creator: 'Lemoness' }] } }) });
        }
        if (url.hostname === 'archive.org' && url.pathname.startsWith('/metadata/')) {
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ metadata: { title: 'Reading 1 Volume 6', creator: 'Lemoness' }, files: [{ name: 'reading.mp3', format: 'MP3' }] }) });
        }
        return route.abort();
    });
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openChat === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady;
            unlockPhone(); ByndBuiltinLibrary?.close();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'music-search-proof', name: '测试', avatar: DEFAULT_AVATAR, chatConfig: {}, history: [] }];
            openApp('wechat'); openChat('music-search-proof'); selectWechatUiTheme('pixel'); openWechatComposer('music_card');
        });
        await page.addStyleTag({ content: '.app-window {transition:none!important;animation:none!important;}' });
        for (const query of ['如何', 'PP Krit', 'pp']) {
            await page.locator('#wc-compose-music-query').fill(query);
            await page.evaluate(() => searchWechatMusicForComposer());
            const found = await page.evaluate(() => window._wechatMusicComposeResults.find(track => track.remoteId === '1492362609'));
            assert.equal(found.artist, 'PP Krit'); assert.match(found.title, /如何/);
            assert.equal(await page.locator('.wc-music-result-item').filter({ hasText: 'Internet Archive' }).count(), 0);
            assert.match(await page.locator('#wc-compose-music-status').innerText(), /部分音乐源连接失败/);
        }
        for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            for (const safe of [47, 59]) for (const parentReserved of [false, true]) {
                await page.evaluate(({ safe, parentReserved }) => {
                    document.body.style.paddingTop = parentReserved ? `${safe}px` : '0px';
                    const phone = document.querySelector('.phone-container');
                    phone.style.height = `${844 - (parentReserved ? safe : 0)}px`;
                    phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : `${safe}px`);
                }, { safe, parentReserved });
                const layout = await page.locator('.wc-compose-card').evaluate(el => {
                    const rect = el.getBoundingClientRect();
                    return { top: rect.top, right: rect.right, bottom: rect.bottom, overflow: el.scrollWidth - el.clientWidth };
                });
                assert.ok(layout.top >= safe && layout.right <= width + 1 && layout.bottom <= 844 && layout.overflow <= 1, JSON.stringify({ width, safe, parentReserved, layout }));
                await page.screenshot({ path: path.join(output, `pp-${width}-${safe}-${parentReserved ? 'parent' : 'header'}.png`) });
            }
        }
        const selectPP = async () => page.evaluate(async () => {
            await selectWechatMusicComposeTrack(window._wechatMusicComposeResults.findIndex(track => track.remoteId === '1492362609'));
        });
        await selectPP();
        assert.match(await page.locator('#wc-compose-music-status').innerText(), /没有可播放音频/);
        await page.evaluate(() => submitWechatComposer());
        assert.equal(await page.evaluate(() => getCurrentChatChar().history.length), 0);
        assert.equal(await page.locator('#wc-composer-modal').evaluate(el => el.classList.contains('hidden')), false);
        await page.screenshot({ path: path.join(output, 'audio-unavailable-375.png') });
        playable = true;
        await selectPP();
        await page.evaluate(() => submitWechatComposer());
        const message = await page.evaluate(() => getCurrentChatChar().history.at(-1));
        assert.equal(message.type, 'music_card'); assert.equal(message.artist, 'PP Krit');
        assert.equal(message.audioUrl, 'https://example.org/authorized.mp3');
        await page.evaluate(() => openWechatComposer('music_card'));
        offline = true;
        await page.locator('#wc-compose-music-query').fill('如何');
        await page.evaluate(() => searchWechatMusicForComposer());
        assert.match(await page.locator('#wc-compose-music-status').innerText(), /连接失败/);
        assert.equal(await page.locator('.wc-music-result-item').count(), 0);
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ nativeQueries, safeAreaCases: 8, errors, missingAudioBlocked: true, authorizedAudioSent: true, failedSourceVisible: true }, null, 2));
        console.log('Music search browser checks passed: real catalog finds PP Krit via 如何/PP Krit/pp, 8 narrow layouts, unrelated Archive results removed, failed source visible, missing audio blocks sending.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
