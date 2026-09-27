'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/home3d-background'); fs.mkdirSync(output, { recursive: true });
const source = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/home3d/characters/default-user-v1.png')).toString('base64');
const server = http.createServer((request, response) => {
    const file = path.resolve(root, '.' + decodeURIComponent(request.url.split('?')[0]));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
    const mime = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png' };
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(response);
});
(async () => {
    await new Promise(resolve => server.listen(8797, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const checks = [];
    try {
        for (const origin of ['file', 'http']) {
            const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
            const errors = [], requests = [], publicRequests = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('request', request => { if (/pet-background-worker|ort-wasm|ort\.wasm|u2netp/.test(request.url())) requests.push(request.url()); });
            await page.route('https://bynd.ccwu.cc/**', route => { publicRequests.push(route.request().url()); return route.fulfill({ status: 404, body: 'Blocked public mirror for local regression test' }); });
            await page.goto(origin === 'file' ? pathToFileURL(path.join(root, 'index.html')).href : 'http://127.0.0.1:8797/index.html', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.ByndPetBackground && window.ByndPetStudio && window.ByndCharacterPet);
            const started = Date.now();
            const result = await page.evaluate(async source => {
                const art = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source; });
                const canvas = document.createElement('canvas'); canvas.width = canvas.height = 400;
                const context = canvas.getContext('2d'); context.fillStyle = '#f8f3e9'; context.fillRect(0, 0, 400, 400);
                const ratio = Math.min(380 / art.naturalWidth, 380 / art.naturalHeight);
                context.drawImage(art, (400 - art.naturalWidth * ratio) / 2, (400 - art.naturalHeight * ratio) / 2, art.naturalWidth * ratio, art.naturalHeight * ratio);
                window.opaquePortraitSource = canvas.toDataURL('image/png');
                const original = context.getImageData(0, 0, 400, 400).data;
                const image = await ByndPetBackground.remove(window.opaquePortraitSource);
                const decoded = await new Promise(resolve => { const node = new Image(); node.onload = () => resolve(node); node.src = image.url; });
                context.clearRect(0, 0, 400, 400); context.drawImage(decoded, 0, 0);
                const pixels = context.getImageData(0, 0, 400, 400).data;
                const alpha = ByndCharacterPet.analyzeAlpha(pixels, 400, 400);
                let visible = 0, changedOpaqueColors = 0;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i + 3] > 20) visible++;
                    // Canvas discards RGB under alpha=0 and rounds partial-alpha
                    // premultiplication; compare only fully opaque subject pixels.
                    if (pixels[i + 3] === 255 && [0, 1, 2].some(channel => pixels[i + channel] !== original[i + channel])) changedOpaqueColors++;
                }
                return { width: image.width, height: image.height, transparent: alpha.transparent, coverage: visible / 160000, changedOpaqueColors, scriptNodes: document.querySelectorAll('script[src*="pet-background-worker.js.js"],script[src*="pet-background/"][src$=".js"]').length };
            }, source);
            assert.equal(result.transparent, true); assert.equal(result.width, 400); assert.equal(result.height, 400);
            assert.ok(result.coverage > 0.05 && result.coverage < 0.8); assert.equal(result.changedOpaqueColors, 0); assert.equal(result.scriptNodes, 0);
            assert.equal(publicRequests.length, 0, 'the failed public mirror must not be needed');
            if (origin === 'file') {
                await page.evaluate(async () => {
                    if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
                    window.myCharacters = [{ id: 'matting-proof', name: '小林', history: [], chatConfig: { imageReference: window.opaquePortraitSource } }];
                    window.callWechatImageGenerationApi = async () => ({ ok: true, url: window.opaquePortraitSource });
                    unlockPhone(); openApp('home3d');
                });
                await page.locator('[data-action="enter"]').click();
                await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2);
                await page.evaluate(() => ByndHome3D.State.update(data => { data.user.reference = window.opaquePortraitSource; }));
                await page.locator('[data-action="settings"]').click();
                assert.equal(await page.locator('.home3d-sheet-head h2').count(), 0);
                assert.equal(await page.locator('.home3d-sheet').getAttribute('aria-label'), '小屋设置');
                await page.locator('[data-action="generate-user"]').click();
                await page.waitForFunction(() => ByndHome3D.State.load().user.portraitDraft, null, { timeout: 120000 });
                assert.equal(await page.evaluate(() => !!ByndHome3D.State.load().user.portrait), false);
                await page.screenshot({ path: path.join(output, 'transparent-preview.png') });
                await page.locator('[data-action="confirm-portrait"][data-who="user"]').click();
                await page.waitForFunction(() => ByndHome3D.State.load().user.portrait && !ByndHome3D.State.load().user.portraitDraft);
                await page.evaluate(() => ByndHome3D.close());
            }
            assert.deepEqual(errors, []); assert.equal(publicRequests.length, 0);
            checks.push({ origin, ...result, elapsedMs: Date.now() - started, requests, errors });
            console.log(JSON.stringify({ origin, ...result, elapsedMs: Date.now() - started })); await page.close();
        }
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(checks, null, 2));
        console.log('Real local U2NETP matting and home portrait confirmation passed with the public mirror blocked.');
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
