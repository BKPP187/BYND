'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/outing-map-fix');
fs.mkdirSync(output, { recursive: true });
const styleUrl = 'https://tiles.openfreemap.org/styles/positron';
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const requests = [], errors = [], queries = [];
    await context.route('https://**/*', route => {
        const url = route.request().url();
        if (url.includes('/api/interpreter')) queries.push(url);
        return url.startsWith('https://tiles.openfreemap.org/') ? route.continue() : route.abort();
    });
    await context.addInitScript(() => {
        localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {}, getCurrentPosition: success => success({ coords: { latitude: 31.2304, longitude: 121.4737, accuracy: 20 } }) } });
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('tiles.openfreemap.org') || request.url().includes('tile.openstreetmap.org')) requests.push({ url: request.url(), referer: request.headers().referer || '' }); });
    const open = async () => {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof retryOutingMap === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); window.ByndBuiltinLibrary?.close();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'map-proof', name: '地图测试', avatar: '', history: [], chatConfig: {} }];
            window.saveCharactersToStorage = async () => true; window.queueWechatAutoReplyToChar = () => {};
            openApp('outing');
        });
        await page.addStyleTag({ content: '.tapfx-burst{display:none!important;}.outing-content{scroll-behavior:auto!important;}' });
        await page.evaluate(() => window.refreshOutingLocation());
    };
    const waitMap = () => page.waitForFunction(() => {
        const gl = outingBasemapLayer?.getMaplibreMap();
        return gl?.isStyleLoaded() && gl.isSourceLoaded('openmaptiles') && gl.queryRenderedFeatures().length > 0 && !outingMapFailed;
    }, null, { timeout: 40000 });
    try {
        // Real file:// requests carry no Referer. Both old nearby services are blocked.
        await open(); await waitMap();
        await page.waitForFunction(() => getOutingState().nearby?.source === 'map' && getOutingState().nearby.places.length > 0, null, { timeout: 20000 });
        const live = await page.evaluate(() => ({ places: getOutingState().nearby.places.map(p => ({ name: p.name, category: p.category, distance: p.distance })), messages: window.myCharacters[0].history.map(m => m.content), mapError: document.getElementById('outing-map-error').textContent }));
        assert.ok(live.places.length > 0); assert.equal(live.mapError, ''); assert.ok(live.messages.some(m => m.includes(live.places[0].name)));
        assert.ok(requests.some(r => r.url.includes('/planet/') && !r.referer), 'actual vector tiles load with no Referer');
        assert.ok(requests.every(r => !r.url.includes('tile.openstreetmap.org')));
        await page.screenshot({ path: path.join(output, 'file-live-375.png') });
        // A service may return an error image with HTTP 200. It must not reach the UI.
        const blockedPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWAAAAABJRU5ErkJggg==', 'base64');
        await page.route(styleUrl, route => route.fulfill({ status: 200, contentType: 'image/png', body: blockedPng }));
        await open();
        await page.waitForFunction(() => !document.getElementById('outing-map-unavailable').hidden);
        assert.equal(await page.locator('#outing-live-map img[src^="https://"]').count(), 0);
        assert.doesNotMatch(await page.locator('.outing-map-card').innerText(), /Access blocked|403|Failed to fetch/);
        await page.screenshot({ path: path.join(output, 'error-image-suppressed-375.png') });
        await page.unroute(styleUrl);
        await page.locator('#outing-map-unavailable button').click(); await waitMap();
        await page.waitForFunction(() => document.getElementById('outing-map-unavailable').hidden);
        // Real HTTP 403, not just a network error, also gets a recoverable Chinese state.
        await page.route(styleUrl, route => route.fulfill({ status: 403, body: 'Access blocked' }));
        await open(); await page.waitForFunction(() => !document.getElementById('outing-map-unavailable').hidden);
        await page.unroute(styleUrl); await page.locator('#outing-map-unavailable button').click(); await waitMap();
        // No vector POIs + blocked primary and secondary APIs: honest error, no fake success.
        await page.evaluate(async () => { window.queryOutingVectorPlaces = async () => null; window.readOutingVectorPlaces = () => null; await loadOutingNearby(true); });
        const errorText = await page.locator('#outing-nearby-list').innerText();
        assert.match(errorText, /连接失败/); assert.doesNotMatch(errorText, /Failed to fetch/);
        assert.ok(queries.some(url => url.includes('overpass-api.de')) && queries.some(url => url.includes('overpass.private.coffee')));
        assert.match(errorText, /上次查到/);
        await page.locator('#outing-toggle-btn').click(); await page.evaluate(() => closeOutingDeparture());
        await page.evaluate(() => openOutingEditor('food'));
        await page.locator('#outing-editor-text').fill('地图断开时也能记录的热面包'); await page.locator('.outing-save-btn').click();
        await page.waitForFunction(() => getOutingState().journey.entries.some(e => e.kind === 'food' && e.synced));
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify({ live, requests, queries, errors }, null, 2));
        console.log('Real file:// vector maps and POIs passed without Referer; HTTP 403, HTTP-200 error images, retries, blocked nearby endpoints, retained cache and independent journal passed. ' + output);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
