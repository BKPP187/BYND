'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.qa-screenshots/character-events');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const report = { layouts: [], errors: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
        await page.addInitScript(version => {
            localStorage.setItem('bynd_lastSeenVersion', version); localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            localStorage.setItem('my_characters_data', JSON.stringify([{ id: 'events-browser', name: '南桓', history: [], chatConfig: {} }]));
        }, require('./bump-version.cjs').currentVersion());
        await page.route('https://**/*', route => route.abort());
        page.on('pageerror', error => report.errors.push(error.message));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndEventInbox);
        await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); openApp('role-tools'); });
        await page.locator('.role-event-entry').click();
        await page.waitForSelector('#app-events-window.active');
        await page.locator('.event-header > button').click();
        await page.waitForFunction(() => document.getElementById('app-events-window').classList.contains('hidden'));
        assert.equal(await page.locator('#app-events-window').evaluate(n => n.classList.contains('active')), false);
        await page.evaluate(() => { openApp('events'); ByndEventInbox.showPreview('letter'); });
        await page.waitForSelector('#app-events-window.active');
        await page.evaluate(() => openApp('role-tools'));
        assert.equal(await page.locator('#event-viewer').evaluate(n => n.hidden), true);
        assert.equal(await page.locator('.event-content').evaluate(n => n.inert), false);
        await page.locator('.role-event-entry').click();
        await page.waitForSelector('#app-events-window.active');
        await page.evaluate(async () => {
            const now = Date.now();
            const events = [
                { id: 'mail-1', type: 'letter', title: '终于寄出去的信', body: '展信好。\n\n窗边那盆植物长出了新叶。想等你来的时候再说，想了想，还是先写给你。\n\n等你有空，我们再慢慢聊。' },
                { id: 'news-1', type: 'newspaper', title: '寻人启事：一位熟悉的读者', body: '本报今日留出一栏，寻找那位总在傍晚出现的读者。\n\n桌上的书还停在上次那一页。若你路过，随时可以继续读下去。' },
                { id: 'bottle-1', type: 'bottle', title: '攒了一小瓶的话', body: '这些零零碎碎的小事，想等你有空时说给你听。', words: ['新长出的叶子', '今天的晚霞', '那首没听完的歌', '窗外下雨了', '想和你说晚安', '等你有空'] }
            ].map(e => ({ ...e, charId: 'events-browser', createdAt: now, unread: true }));
            ByndCharacterEvents.importEvents(JSON.stringify({ version: 1, events }));
            for (const e of events) await ByndCharacterEvents.retryDelivery(e.id);
            document.getElementById('event-arrival').hidden = true;
        });
        assert.equal(await page.locator('.event-row').count(), 3);
        await page.evaluate(() => ByndEventInbox.showId('mail-1'));
        assert.equal(await page.evaluate(() => ByndCharacterEvents.eventById('mail-1').unread), true);
        await page.locator('.event-story-skip').click();
        await page.locator('.event-seal').click();
        await page.waitForFunction(() => !ByndCharacterEvents.eventById('mail-1').unread);
        assert.equal(await page.evaluate(() => ByndCharacterEvents.eventById('mail-1').unread), false);
        await page.keyboard.press('Escape');
        for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => {
                document.documentElement.classList.add('mobile-runtime');
                document.body.style.paddingTop = owner === 'parent' ? safe + 'px' : '0';
                const phone = document.querySelector('.phone-container');
                phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? safe + 'px' : '0px');
                phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
            }, { safe, owner });
            for (const mode of ['inbox', 'letter', 'newspaper', 'bottle', 'doodle']) {
                await page.evaluate(mode => { ByndEventInbox.closeViewer(); if (mode !== 'inbox') ByndEventInbox.showPreview(mode); if (mode === 'letter') ByndEventInbox.finishLetterIntro(); }, mode);
                const layout = await page.evaluate(mode => {
                    const header = document.querySelector(mode === 'inbox' ? '.event-header button' : '.event-viewer-header button').getBoundingClientRect();
                    const content = document.querySelector(mode === 'inbox' ? '.event-content' : '.event-viewer-scroll');
                    return { top: header.top, right: content.getBoundingClientRect().right, width: content.clientWidth, scroll: content.scrollWidth };
                }, mode);
                assert.ok(layout.top >= safe && layout.top < safe + 22, JSON.stringify({ width, safe, owner, mode, layout }));
                assert.ok(layout.scroll <= layout.width + 1 && layout.right <= width + 1, JSON.stringify(layout));
                report.layouts.push({ width, safe, owner, mode, layout });
                if (width === 375 && safe === 59 && owner === 'header') {
                    await page.waitForTimeout(mode === 'bottle' ? 4300 : 500);
                    await page.screenshot({ path: path.join(output, mode + '-375.png') });
                    if (mode === 'letter') { await page.locator('.event-seal').click(); await page.waitForFunction(() => document.getElementById('event-viewer').dataset.phase === 'read'); await page.waitForTimeout(650); await page.screenshot({ path: path.join(output, 'letter-open-375.png') }); }
                }
            }
        }
        await page.evaluate(() => { const s = ByndCharacterEvents.read(); s.events.find(e => e.id === 'mail-1').unread = true; localStorage.setItem(ByndCharacterEvents.storageKey, JSON.stringify(s)); ByndEventInbox.showId('mail-1'); });
        for (const phase of ['ribbon', 'calendar', 'verse', 'envelope']) {
            await page.waitForFunction(phase => document.getElementById('event-viewer').dataset.phase === phase, phase);
            await page.waitForTimeout(phase === 'ribbon' ? 1500 : phase === 'calendar' ? 750 : 600);
            assert.equal(await page.evaluate(() => ByndCharacterEvents.eventById('mail-1').unread), true);
            await page.screenshot({ path: path.join(output, `letter-${phase}-375.png`) });
        }
        await page.locator('.event-seal').click();
        await page.waitForFunction(() => document.getElementById('event-viewer').dataset.phase === 'read');
        await page.locator('.event-story-replay').click();
        assert.equal(await page.evaluate(() => document.getElementById('event-viewer').dataset.phase), 'ribbon');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(7000);
        assert.equal(await page.locator('#event-viewer').evaluate(n => n.hidden), true);
        assert.equal(await page.locator('.event-story-scene').count(), 0);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => ByndEventInbox.showPreview('letter'));
        assert.equal(await page.evaluate(() => document.getElementById('event-viewer').dataset.phase), 'envelope');
        await page.locator('.event-seal').click();
        assert.equal(await page.evaluate(() => document.getElementById('event-viewer').dataset.phase), 'read');
        await page.evaluate(() => ByndEventInbox.showPreview('bottle'));
        assert.equal(await page.locator('.event-bottle-words.is-falling').count(), 0);
        await page.evaluate(async () => {
            ByndCharacterEvents.importEvents(JSON.stringify({ version: 1, events: [{ id: 'bottle-limit', type: 'bottle', charId: 'events-browser', title: '装得下的想念', body: '每句话都留着。', words: Array.from({ length: 24 }, (_, i) => String(i + 1) + '想把今天遇见的这些小事都慢慢说给你听以后我们再一起看晚霞'.slice(0, 26)), createdAt: Date.now() }] }));
            await ByndCharacterEvents.retryDelivery('bottle-limit'); ByndEventInbox.showId('bottle-limit');
        });
        const bounds = await page.evaluate(() => {
            const bottle = document.querySelector('.event-bottle').getBoundingClientRect();
            return [...document.querySelectorAll('.event-bottle-words span')].every(n => { const r = n.getBoundingClientRect(); return r.left >= bottle.left && r.right <= bottle.right && r.bottom < bottle.bottom && r.top > bottle.top; });
        });
        assert.equal(bounds, true, 'all 24 long phrases remain inside the bottle at narrow width');
        await page.locator('.event-bottle-replay').click();
        assert.equal(await page.locator('.event-bottle-words.is-falling').count(), 0);
        await page.evaluate(() => { const s = ByndCharacterEvents.read(); s.events = s.events.filter(e => e.id !== 'bottle-limit'); localStorage.setItem(ByndCharacterEvents.storageKey, JSON.stringify(s)); document.getElementById('event-arrival').hidden = true; });
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => ByndEventInbox.closeViewer());
        await page.locator('.event-options').evaluate(n => n.open = true);
        const download = page.waitForEvent('download'); await page.locator('button[onclick="ByndEventInbox.exportFile()"]').click();
        const backup = path.join(output, 'synthetic-heartmail.json'); await (await download).saveAs(backup);
        assert.equal(JSON.parse(fs.readFileSync(backup, 'utf8')).events.length, 3);
        await page.locator('#event-import').setInputFiles(backup);
        await page.waitForFunction(() => document.getElementById('event-status').textContent.includes('已导入 0 条'));
        await page.locator('#event-import').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
        await page.waitForFunction(() => document.getElementById('event-status').textContent.includes('导入失败'));
        await page.evaluate(() => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(k, v) { if (k === ByndCharacterEvents.storageKey) throw new Error('simulated quota'); return original.call(this, k, v); };
            try { document.getElementById('event-enabled').checked = false; ByndEventInbox.configure(); } finally { Storage.prototype.setItem = original; }
        });
        assert.match(await page.locator('#event-status').innerText(), /保存失败/);
        assert.equal(await page.evaluate(() => ByndCharacterEvents.read().enabled), true);
        await page.evaluate(() => {
            window._eventSave = saveCharactersToStorage; saveCharactersToStorage = async () => false;
            ByndCharacterEvents.importEvents(JSON.stringify({ version: 1, events: [{ id: 'failed-message', type: 'message', charId: 'events-browser', title: '测试失败', body: '不应发出', createdAt: Date.now() }] }));
        });
        assert.equal(await page.evaluate(async () => { try { await ByndCharacterEvents.retryDelivery('failed-message'); return false; } catch (_) { return true; } }), true);
        assert.equal(await page.evaluate(() => myCharacters[0].history.some(m => m.eventId === 'failed-message')), false);
        await page.evaluate(() => { saveCharactersToStorage = window._eventSave; });
        await page.evaluate(async () => { await ByndCharacterEvents.retryDelivery('failed-message'); await ByndCharacterEvents.retryDelivery('failed-message'); });
        assert.equal(await page.evaluate(() => myCharacters[0].history.filter(m => m.eventId === 'failed-message').length), 1);

        // Exercise the actual character persistence hook and Agent/image dispatch using local responses.
        const integration = await page.evaluate(async () => {
            const char = myCharacters.find(c => c.id === 'events-browser'), day = 86400000;
            const original = { persist: persistWechatCharactersSnapshot, chat: callChatApi, image: callWechatImageGenerationApi, jev: ByndJev };
            const replies = [], image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=';
            try {
                char.history.push({ type: 'text', isMe: true, content: '记得窗边的小花吗', timestamp: Date.now() - 10 * day });
                persistWechatCharactersSnapshot = async () => { throw new Error('simulated character write failure'); };
                const failedSave = await saveCharactersToStorage();
                const interactionAfterFailure = ByndCharacterEvents.read().characters[char.id];
                persistWechatCharactersSnapshot = original.persist;
                const saved = await saveCharactersToStorage();
                const interactionAfterSave = ByndCharacterEvents.read().characters[char.id];
                window.ByndJev = { ...original.jev, available: () => false };
                let type = 'message', imageCalls = 0;
                callChatApi = async messages => {
                    replies.push(JSON.parse(messages[1].content));
                    return { ok: true, content: JSON.stringify({ version: 1, action: 'act', events: [{ type, charId: char.id, title: '窗边的小花', body: '今天又长了一片叶子。', ...(type === 'album' ? { imagePrompt: '窗台的小花，柔和的晨光' } : {}) }] }) };
                };
                callWechatImageGenerationApi = async () => { imageCalls++; return { ok: true, url: image }; };
                for (const carrier of ['message', 'album']) {
                    type = carrier;
                    const state = ByndCharacterEvents.read();
                    state.lastActiveAt = Date.now() - 7 * day;
                    state.characters[char.id].evaluatedThrough = 0;
                    state.characters[char.id].lastAttemptAt = 0;
                    localStorage.setItem(ByndCharacterEvents.storageKey, JSON.stringify(state));
                    ByndCharacterEvents.captureReturn(); await ByndCharacterEvents.processPending();
                    ByndCharacterEvents.captureReturn(); await ByndCharacterEvents.processPending();
                    // Give the second absence its own timestamp, as it would have after another visit.
                    await new Promise(resolve => setTimeout(resolve, 5));
                }
                const events = ByndCharacterEvents.read().events.filter(e => e.trigger);
                const messageEvent = events.find(e => e.type === 'message'), albumEvent = events.find(e => e.type === 'album');
                return {
                    failedSave, interactionAfterFailure: !!interactionAfterFailure, saved, recorded: !!interactionAfterSave?.firstInteractionAt,
                    calls: replies.length, offlineDays: replies.map(r => r.environment.offlineDays), imageCalls,
                    delivered: events.map(e => e.delivery), messageCount: char.history.filter(m => m.eventId === messageEvent?.id).length,
                    albumCount: getChatAlbumStore().filter(row => row.eventId === albumEvent?.id && row.url === image).length,
                    chatUnread: getTelegramChatUnreadCount(char)
                };
            } finally {
                persistWechatCharactersSnapshot = original.persist; callChatApi = original.chat;
                callWechatImageGenerationApi = original.image; window.ByndJev = original.jev;
            }
        });
        assert.deepEqual(integration, { failedSave: false, interactionAfterFailure: false, saved: true, recorded: true, calls: 2, offlineDays: [7, 7], imageCalls: 1, delivered: ['delivered', 'delivered'], messageCount: 1, albumCount: 1, chatUnread: 1 });
        report.integration = integration;

        // A full backup can contain untrusted strings even though the event-only importer validates drawings.
        await page.evaluate(() => {
            const state = ByndCharacterEvents.read();
            state.events.push({ id: 'escaped-drawing', type: 'doodle', charId: 'events-browser', charName: '测试', title: '安全绘制', body: '引用中的文字', createdAt: Date.now(), unread: true, delivery: 'delivered', strokes: [{ color: '#333333\"/><script>window._eventInjected=true</script><polyline stroke=\"', points: [[1, 2], [3, 4]] }] });
            localStorage.setItem(ByndCharacterEvents.storageKey, JSON.stringify(state));
            ByndEventInbox.showId('escaped-drawing');
        });
        assert.equal(await page.locator('#event-viewer script').count(), 0);
        assert.equal(await page.evaluate(() => !!window._eventInjected), false);
        await page.evaluate(() => { const state = ByndCharacterEvents.read(); state.events = state.events.filter(e => e.id !== 'escaped-drawing'); localStorage.setItem(ByndCharacterEvents.storageKey, JSON.stringify(state)); ByndEventInbox.closeViewer(); });
        assert.deepEqual(report.errors, []);
        report.motion = { phases: ['ribbon', 'pause', 'calendar', 'verse', 'envelope', 'read'], unreadUntilUnsealed: true, replayAndClose: true, reducedMotion: true, maximumBottleWords: 24 };
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(report, null, 2));
        console.log('40 safe-area layouts, letter sequence/replay/cancellation/unread/reduced-motion, 24 bottle phrases, persistence/Agent/chat/album integration, export/import and failed writes passed.');
        if (process.argv.includes('--video')) {
            const motionPage = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true, recordVideo: { dir: output, size: { width: 375, height: 844 } } });
            await motionPage.addInitScript(version => { localStorage.setItem('bynd_lastSeenVersion', version); localStorage.setItem('bynd_builtin_library_seen_v1', '1'); }, require('./bump-version.cjs').currentVersion());
            await motionPage.route('https://**/*', route => route.abort());
            await motionPage.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
            await motionPage.waitForFunction(() => window.__byndCoreReady && window.ByndEventInbox);
            await motionPage.evaluate(async () => {
                await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close();
                document.documentElement.classList.add('mobile-runtime'); document.body.style.paddingTop = '0';
                const phone = document.querySelector('.phone-container'); phone.style.setProperty('--bynd-header-safe-top', '59px'); phone.style.height = '100dvh';
                openApp('events'); ByndEventInbox.showPreview('letter');
            });
            await motionPage.waitForFunction(() => document.getElementById('event-viewer').dataset.phase === 'envelope');
            await motionPage.waitForTimeout(900); await motionPage.locator('.event-seal').click();
            await motionPage.waitForFunction(() => document.getElementById('event-viewer').dataset.phase === 'read');
            await motionPage.waitForTimeout(1400);
            await motionPage.evaluate(() => ByndEventInbox.showPreview('bottle')); await motionPage.waitForTimeout(5200);
            const video = motionPage.video(); await motionPage.close();
            fs.copyFileSync(await video.path(), path.join(output, 'letter-and-bottle-motion.webm'));
            console.log('Recorded letter-and-bottle-motion.webm');
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
