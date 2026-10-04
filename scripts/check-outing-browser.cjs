'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/outing');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const server = http.createServer((req, res) => {
        const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
        const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
        fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(error ? '' : bytes); });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    const tileResults = [];
    page.on('requestfailed', request => { if (request.url().includes('tile.openstreetmap.org')) tileResults.push({ url: request.url(), error: request.failure() }); });
    page.on('response', response => { if (response.url().includes('tile.openstreetmap.org')) tileResults.push({ url: response.url(), status: response.status() }); });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.request().url().includes('tile.openstreetmap.org') ? route.continue() : route.abort());
    await page.route('https://overpass-api.de/api/interpreter', route => route.fulfill({ json: { elements: [
        { id: 1, type: 'node', lat: 31.2328, lon: 121.473, tags: { name: '咖啡馆（测试数据）', amenity: 'cafe' } },
        { id: 2, type: 'way', center: { lat: 31.229, lon: 121.471 }, tags: { name: '小公园（测试数据）', leisure: 'park' } }
    ] } }));
    try {
        await page.addInitScript(() => {
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            Object.defineProperty(navigator, 'geolocation', { value: {
                watchPosition: () => 1, clearWatch: () => {},
                getCurrentPosition: success => success({ coords: { latitude: 31.2304, longitude: 121.4737, accuracy: 15 } })
            } });
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openOutingEditor === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady;
            unlockPhone(); window.ByndBuiltinLibrary?.close();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'outing-proof', name: '江闻远', avatar: document.getElementById('wcs-user-avatar').src, history: [], chatConfig: {} }];
            window.saveCharactersToStorage = async () => true;
            window.queueWechatAutoReplyToChar = () => {};
            window.callChatApi = async () => ({ ok: true, content: '{"comment":"阳光落在这里，连这一刻都变得柔软了。想把今天好好留住。","keepPhoto":true}' });
            openApp('outing');
        });
        await page.addStyleTag({ content: '.app-window{transition:none !important;}.phone-container{margin:0!important;}.tapfx-burst{display:none!important;}.outing-content{scroll-behavior:auto!important;}' });
        await page.locator('#outing-map-placeholder button').click();
        await page.waitForFunction(() => getOutingState().nearby?.places.length === 2 && typeof outingMap !== 'undefined' && outingMap);
        await page.waitForFunction(() => document.querySelector('.leaflet-tile-loaded') || document.getElementById('outing-map-error').textContent, { timeout: 20000 });
        await page.waitForTimeout(600);
        fs.writeFileSync(path.join(output, 'tile-network.json'), JSON.stringify(tileResults, null, 2));
        await page.screenshot({ path: path.join(output, 'map-375.png') });
        await page.locator('#outing-destination-btn').click();
        await page.locator('#outing-editor-text').fill('去江边散散步');
        await page.screenshot({ path: path.join(output, 'destination-375.png') });
        await page.locator('#outing-editor-form').press('Enter');
        await page.locator('#outing-toggle-btn').click();
        await page.waitForFunction(() => getOutingState().active);
        await page.screenshot({ path: path.join(output, 'departure-375.png') });
        await page.evaluate(() => closeOutingDeparture());
        await page.locator('.outing-record-tools button').nth(0).click();
        await page.locator('#outing-mood-wheel').evaluate(el => { el.scrollTop = 3 * 76; });
        await page.waitForFunction(() => document.querySelector('[data-mood-index="3"]').getAttribute('aria-selected') === 'true');
        await page.screenshot({ path: path.join(output, 'mood-375.png') });
        await page.locator('#outing-editor-text').fill('风很舒服');
        await page.locator('.outing-save-btn').click();
        await page.locator('.outing-record-tools button').nth(1).click();
        await page.locator('#outing-editor-text').fill('江边的小路');
        await page.locator('.outing-sticker-picker button').nth(1).click();
        await page.locator('.outing-save-btn').click();
        await page.locator('.outing-record-tools button').nth(2).click();
        await page.locator('#outing-editor-text').fill('拿铁和热面包');
        await page.locator('.outing-save-btn').click();
        const photo = await page.evaluate(() => {
            const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 500;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#adc9dd'; ctx.fillRect(0, 0, 800, 500);
            ctx.fillStyle = '#d9d6bc'; ctx.fillRect(0, 300, 800, 200);
            ctx.fillStyle = '#faf6ed'; ctx.fillRect(85, 110, 230, 210); ctx.fillStyle = '#757e81';
            for (let i = 0; i < 4; i++) ctx.fillRect(115 + (i % 2) * 90, 140 + Math.floor(i / 2) * 70, 55, 44);
            ctx.fillStyle = '#9bb593'; ctx.beginPath(); ctx.arc(585, 215, 100, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#a5aaa1'; ctx.fillRect(575, 280, 18, 135);
            return canvas.toDataURL('image/png').split(',')[1];
        });
        await page.locator('#outing-camera-input').setInputFiles({ name: 'outing-test.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
        await page.waitForFunction(() => getOutingState().journey.entries.find(e => e.kind === 'photo')?.synced === true);
        await page.locator('.outing-photo-entry').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'photo-comment-375.png') });
        await page.locator('#outing-toggle-btn').click();
        await page.waitForFunction(() => getOutingState().trips[0]?.entries.find(e => e.kind === 'summary')?.synced);
        await page.locator('.outing-letter').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'letter-375.png') });
        await page.evaluate(() => switchOutingJournal('calendar'));
        await page.locator('.outing-calendar').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'calendar-375.png') });
        assert.equal(await page.evaluate(() => window.myCharacters[0].chatConfig.outingPhotos.length), 1);
        assert.ok(await page.evaluate(() => getWechatMemoryStore().chars['outing-proof'].segments.length >= 5));
        // Check both parents reserving safe area and headers reserving it, exactly once.
        const geometry = [];
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            for (const mode of ['parent', 'header']) for (const safe of [47, 59]) {
                const style = await page.addStyleTag({ content: `html.mobile-runtime body { padding:${mode === 'parent' ? safe : 0}px 0 0!important; } html.mobile-runtime .phone-container { --bynd-header-safe-top:${mode === 'header' ? safe : 0}px; width:100vw!important; height:${844 - (mode === 'parent' ? safe : 0)}px!important; }` });
                await page.locator('.outing-content').evaluate(el => { el.scrollTop = 0; });
                const result = await page.evaluate(() => {
                    const shell = document.querySelector('.outing-shell'), bar = document.querySelector('.outing-topbar'), button = bar.querySelector('button');
                    return { shellTop: shell.getBoundingClientRect().top, buttonTop: button.getBoundingClientRect().top, barHeight: bar.getBoundingClientRect().height, overflow: shell.scrollWidth - shell.clientWidth };
                });
                assert.ok(result.buttonTop >= safe, JSON.stringify({ width, mode, safe, result }));
                assert.ok(Math.abs(result.buttonTop - safe - 12) < 2, 'safe inset reserved once: ' + JSON.stringify({ width, mode, safe, result }));
                assert.ok(result.overflow <= 1, JSON.stringify(result));
                await page.screenshot({ path: path.join(output, `${mode}-${width}-${safe}.png`) });
                await page.evaluate(() => openOutingEditor('destination'));
                const dialog = await page.locator('.outing-dialog').boundingBox(); assert.ok(dialog.x >= 0 && dialog.x + dialog.width <= width);
                await page.evaluate(() => closeOutingModal());
                geometry.push({ width, mode, safe, result }); await style.evaluate(el => el.remove());
            }
        }
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady);
        assert.equal(await page.evaluate(() => getOutingState().trips.length), 1);
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'geometry.json'), JSON.stringify(geometry, null, 2));
        console.log('Outing UI flow, reload durability, photo/comment/album/memory and 12 safe-area layouts passed. Screenshots: ' + output);
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
