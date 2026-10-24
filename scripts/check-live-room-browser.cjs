'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/live-room');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
        await page.waitForFunction(() => !!window.ByndLiveMedia && !!window.ByndVivix);
        await page.evaluate(async () => {
            await byndStylesReady; await window._wechatCharactersLoadPromise;
            localStorage.removeItem(WECHAT_LIVE_STORAGE_KEY); localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            unlockPhone(); openApp('wechat'); ByndBuiltinLibrary?.close();
            const portrait = window.ByndBuiltinArtwork?.['assets/characters/builtin/shanghuan.jpg'];
            if (!portrait) throw new Error('Bundled portrait fixture missing');
            window._livePortrait = portrait;
            window.myCharacters = [{ id: 'live-char', name: '商桓', avatar: portrait, description: '音乐人，正在琴房排练新歌。', chatConfig: { imageReference: portrait }, history: [], worldBook: [{ content: '小陆是商桓的朋友，负责排练室的灯光，爱在弹幕接梗。' }] }];
            document.querySelector('.phone-container').style.cssText += ';position:absolute!important;inset:0!important;width:100vw!important;max-width:none!important;height:100dvh!important;max-height:none!important;transform:none!important;border:0!important;border-radius:0!important;margin:0!important;--bynd-header-safe-top:59px;';
            window._liveTest = { creates: 0, closes: 0, pictures: 0, renders: 0, destroys: 0, videoFail: false, imageFail: false, imageEnabled: true, holdCreate: false };
            const test = window._liveTest;
            const fetchOriginal = window.fetch;
            window.fetch = async (url, options) => {
                if (String(url).startsWith(ByndVivix.relay)) {
                    if (String(url).endsWith('/images')) return { ok: true, status: 200, json: async () => ({ code: 0, data: { url: 'https://fixture.invalid/portrait.jpg' } }) };
                    if (String(url).endsWith('/close')) { test.closes++; return { ok: true, status: 200, json: async () => ({ code: 0, data: { status: 'closing' } }) }; }
                    if (String(url).endsWith('/sessions')) {
                        test.creates++;
                        if (test.holdCreate) await new Promise(resolve => { window._releaseCreate = resolve; });
                        return { ok: !test.videoFail, status: test.videoFail ? 500 : 200, json: async () => ({ code: test.videoFail ? 1 : 0, data: { session_id: 'live-session-' + test.creates, control: { url: 'wss://live-fixture.invalid', client_secret: 'test-control' }, delivery: { media: { trtc: { sdk_app_id: 1, publisher_user_id: 'host', user_id: 'viewer', user_sig: 'fixture', room_id: 'room' } } } } }) };
                    }
                    throw new Error('Unexpected test media request');
                }
                return fetchOriginal(url, options);
            };
            class Socket {
                constructor() { this.readyState = 0; queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
                send(json) { const item = JSON.parse(json); test.renders++; queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ type: 'response.done', request_event_id: item.event_id, response: { status: 'completed' } }) })); }
                close() { this.readyState = 3; this.onclose?.(); }
            }
            window.WebSocket = Socket;
            window.TRTC = { EVENT: { ERROR: 'error', AUTOPLAY_FAILED: 'blocked', REMOTE_VIDEO_AVAILABLE: 'remote', FIRST_VIDEO_FRAME: 'frame' }, TYPE: { SCENE_RTC: 'rtc' }, create() {
                const events = {}; test.events = events;
                return { on(type, callback) { events[type] = callback; }, async muteRemoteAudio() {}, async enterRoom() { queueMicrotask(() => events.remote({ userId: 'host', streamType: 'main' })); },
                    async startRemoteVideo({ view }) { const node = document.getElementById(view); const image = new Image(); image.src = portrait; image.style.cssText = 'width:100%;height:100%;object-fit:cover'; node.append(image); queueMicrotask(() => events.frame({ userId: 'host' })); },
                    async exitRoom() {}, destroy() { test.destroys++; }
                };
            } };
            getImageRouteForFeature = () => test.imageEnabled ? { provider: 'api', api: { baseUrl: 'https://image-fixture.invalid', imageModel: 'fixture-image' } } : { provider: 'none' };
            callWechatImageGenerationApi = async () => { test.pictures++; if (test.holdImage) await new Promise(resolve => { window._releaseImage = resolve; }); return test.imageFail ? { ok: false, error: 'fixture image failure' } : { ok: true, url: portrait }; };
            callChatApi = async messages => {
                const task = JSON.parse(messages[1].content).task, actor = { charId: 'live-char' };
                return { ok: true, content: JSON.stringify('requestedTopic' in task
                    ? { needed: true, title: '琴房的晚间排练', category: '音乐', caption: '暖色灯光落在钢琴上，商桓坐在镜头前，抬手试了几个和弦。', lines: [{ actor, text: '晚上好，今天先唱你们想听的那首。' }, { actor: { name: '小陆', sourceEntryIndexes: [0] }, text: '前排坐好了，今晚不许忘词！' }], choices: ['先弹前奏', '聊聊新歌'] }
                    : { caption: task.action === 'end' ? '商桓放下琴谱，向镜头挥手。' : '商桓看见弹幕，笑着调整了琴谱。', lines: [{ actor, text: '看到你的' + task.action + '了：' + task.userText }, { actor: { name: '小陆', sourceEntryIndexes: [0] }, text: '这一段我也想再听一遍！' }], choices: ['再唱一遍', '聊聊下一首'], privateMessage: task.action === 'end' ? '刚才你点的歌，我记着啦。' : '' }) };
            };
            ByndVivix.write({ apiKey: 'live-test-key', prepareScene: false });
            await ByndLive.publish('live-char'); await ByndLive.enter(ByndLive.state().rooms[0].id);
        });
        const action = name => page.locator(`[data-ds-action="${name}"]`);
        await page.waitForFunction(() => ByndLiveMedia.status().kind === 'video');
        assert.equal(await page.locator('.wc-live-rtc img').isVisible(), true, 'the received media really occupies the room');
        assert.ok((await page.locator('.wc-live-rtc img').boundingBox()).height > 700);
        assert.equal(await page.evaluate(() => _liveTest.pictures), 0, 'configured video wins without calling the image provider');
        assert.equal(await page.locator('.wc-feature-header').isVisible(), false, 'no duplicate header or world selector');
        assert.equal(await page.locator('#wc-ds-live-source').count(), 0);
        await page.evaluate(() => { window._liveMediaNode = document.querySelector('[data-live-media]'); });
        await page.locator('#wc-ds-live-input').fill('先弹副歌好吗'); await action('send').click();
        await page.waitForFunction(() => ByndLive.state().rooms[0].version === 2);
        assert.equal(await page.evaluate(() => window._liveMediaNode === document.querySelector('[data-live-media]')), true, 'reply repaint retains RTC DOM');
        assert.equal(await page.evaluate(() => _liveTest.creates), 1);
        await page.waitForFunction(() => document.querySelector('#wc-live-barrage').textContent.includes('副歌'));
        await page.locator('#wc-live-barrage .wc-live-barrage-line').first().waitFor();
        await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(item => item.effect?.target?.classList.contains('wc-live-barrage-line')).map(item => item.finished)); });
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(item => item.id));
        for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            for (const theme of themes) {
                await page.evaluate(theme => { applyWechatUiTheme(theme, { update: false }); ByndDiscoverStory.refresh(); }, theme);
                const layout = await page.locator('.wc-live-room').evaluate(node => ({ overflow: node.scrollWidth > node.clientWidth, compose: node.querySelector('.wc-live-compose').getBoundingClientRect().bottom, bottom: node.getBoundingClientRect().bottom, font: getComputedStyle(node).fontFamily }));
                assert.equal(layout.overflow, false); assert.ok(layout.compose <= layout.bottom);
                if (theme === 'pixel') assert.match(layout.font, /Courier/);
                await page.screenshot({ path: path.join(output, `video-${theme}-${width}.png`) });
            }
        }
        // A running transport failure closes video and produces one B image.
        await page.evaluate(() => _liveTest.events.error());
        await page.waitForFunction(() => ByndLiveMedia.status().kind === 'image' && !ByndLiveMedia.status().phase);
        assert.equal(await page.locator('.wc-live-media > img').isVisible(), true, 'B displays the actual generated image');
        assert.equal(await page.evaluate(() => _liveTest.pictures), 1);
        assert.ok(await page.evaluate(() => _liveTest.closes) >= 1);
        assert.match(await page.evaluate(() => ByndLive.state().rooms[0].visual.url), /^data:image\/webp/);
        for (const theme of themes) {
            await page.evaluate(theme => { applyWechatUiTheme(theme, { update: false }); ByndDiscoverStory.refresh(); }, theme);
            const controls = await page.locator('.wc-live-compose').evaluate(node => ({ bottom: node.getBoundingClientRect().bottom, roomBottom: node.closest('.wc-live-room').getBoundingClientRect().bottom, fields: [...node.children].map(field => ({ tag: field.tagName, color: getComputedStyle(field).color, opacity: getComputedStyle(field).opacity, text: field.textContent, top: field.getBoundingClientRect().top, height: field.getBoundingClientRect().height })) }));
            assert.ok(controls.bottom <= controls.roomBottom, theme + ': B controls fit below the barrage');
            fs.writeFileSync(path.join(output, `image-controls-${theme}.json`), JSON.stringify(controls));
            await page.screenshot({ path: path.join(output, `image-${theme}-375.png`) });
        }
        // B remains usable after reload/backup-style restore; reopening does not redraw it.
        await page.evaluate(() => { ByndVivix.clearSettings(); window._cachedLive = ByndLive.state(); });
        await action('back').click(); await action('enter').click();
        await page.waitForFunction(() => ByndLiveMedia.status().kind === 'image');
        assert.equal(await page.evaluate(() => _liveTest.pictures), 1);
        // Image-only configuration really draws B, and failed persistence reports C rather than success.
        await page.evaluate(() => { ByndLiveMedia.leave(); ByndDiscoverStory.change('live', s => { delete s.rooms[0].visual; }); window._storeLive = writeWechatStore; writeWechatStore = () => { throw new Error('fixture storage failure'); }; ByndDiscoverStory.refresh(); });
        await page.waitForFunction(() => ByndLiveMedia.status().kind === 'text' && !ByndLiveMedia.status().phase);
        assert.match(await page.locator('.wc-live-status').textContent(), /暂不可用/);
        await page.evaluate(() => { writeWechatStore = window._storeLive; });
        // Both providers fail -> C, with the same live chat still operating.
        await page.evaluate(() => { ByndLiveMedia.leave(); ByndDiscoverStory.change('live', s => { delete s.rooms[0].visual; }); _liveTest.videoFail = true; _liveTest.imageFail = true; ByndVivix.write({ apiKey: 'live-test-key' }); ByndDiscoverStory.refresh(); });
        await page.waitForFunction(() => ByndLiveMedia.status().kind === 'text' && !ByndLiveMedia.status().phase);
        await page.locator('#wc-ds-live-input').fill('头像直播也能收到吗？'); await action('send').click();
        await page.waitForFunction(() => ByndLive.state().rooms[0].version === 3);
        await page.waitForFunction(() => document.querySelector('#wc-live-barrage').textContent.includes('头像直播'));
        await page.waitForFunction(() => [...document.querySelectorAll('#wc-live-barrage .wc-live-barrage-line')].some(node => Number(getComputedStyle(node).opacity) > .9));
        for (const theme of themes) {
            await page.evaluate(theme => { applyWechatUiTheme(theme, { update: false }); ByndDiscoverStory.refresh(); }, theme);
            await page.screenshot({ path: path.join(output, `fallback-${theme}-375.png`) });
        }
        // Unconfigured customers make no media calls at all.
        const count = await page.evaluate(() => { ByndLiveMedia.leave(); ByndVivix.clearSettings(); _liveTest.imageEnabled = false; return [_liveTest.creates, _liveTest.pictures]; });
        await page.evaluate(() => ByndDiscoverStory.refresh());
        assert.deepEqual(await page.evaluate(() => [_liveTest.creates, _liveTest.pictures]), count);
        // Safe area is owned once, whether the parent or this room reserves it.
        for (const safe of [47, 59]) for (const mode of ['parent', 'header']) {
            await page.evaluate(({ safe, mode }) => { const phone = document.querySelector('.phone-container'); phone.style.setProperty('top', (mode === 'parent' ? safe : 0) + 'px', 'important'); phone.style.setProperty('height', `calc(100dvh - ${mode === 'parent' ? safe : 0}px)`, 'important'); phone.style.setProperty('--bynd-header-safe-top', (mode === 'header' ? safe : 0) + 'px'); ByndDiscoverStory.refresh(); }, { safe, mode });
            const top = (await action('back').boundingBox()).y;
            assert.ok(top >= safe && top < safe + 35, 'safe area reserved exactly once');
        }
        // A late create result after leaving is closed and can never mount a video.
        await page.evaluate(() => { ByndLiveMedia.leave(); _liveTest.videoFail = false; _liveTest.holdCreate = true; ByndVivix.write({ apiKey: 'live-test-key' }); ByndDiscoverStory.refresh(); });
        await page.waitForFunction(() => !!window._releaseCreate);
        const closes = await page.evaluate(() => _liveTest.closes);
        await action('back').click(); await page.evaluate(() => { _liveTest.holdCreate = false; _releaseCreate(); });
        await page.waitForFunction(count => _liveTest.closes > count, closes);
        assert.equal(await page.locator('[data-live-media]').count(), 0);
        // An image completing after exit cannot overwrite the saved room or reappear.
        await page.evaluate(() => { ByndVivix.clearSettings(); _liveTest.imageEnabled = true; _liveTest.imageFail = false; _liveTest.holdImage = true; ByndDiscoverStory.change('live', s => { delete s.rooms[0].visual; }); });
        await action('enter').click(); await page.waitForFunction(() => !!window._releaseImage);
        await action('back').click(); await page.evaluate(() => { _liveTest.holdImage = false; _releaseImage(); });
        assert.equal(await page.evaluate(() => ByndLive.state().rooms[0].visual), undefined);
        assert.equal(await page.locator('[data-live-media]').count(), 0);
        assert.deepEqual(errors, []);
        console.log(`Live room browser passed: real Vivix transport adapter with mocked REST/RTC, A→B→C, no APIs, cached image, continuous barrage, DOM retention, late-session cleanup, ${themes.length} themes and 47/59px safe areas.`);
    } catch (error) {
        console.error(await page.evaluate(() => ({ media: window.ByndLiveMedia?.status(), calls: window._liveTest && { creates: _liveTest.creates, closes: _liveTest.closes, pictures: _liveTest.pictures, destroys: _liveTest.destroys }, active: document.querySelector('#app-wechat-window')?.className, text: document.querySelector('.wc-live-status')?.textContent })));
        await page.screenshot({ path: path.join(output, 'failure.png') });
        throw error;
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
