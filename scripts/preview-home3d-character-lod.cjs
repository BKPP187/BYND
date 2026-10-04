'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '..'), directory = path.join(root, 'artifacts/home3d-models/silver-red-v1/hd-texture-v1/review-lods-v3');
function createServer() {
    return http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const allowed = ['/assets/vendor/home3d/engine.js', '/apps/home3d/character-lod.js'];
        let file;
        if (pathname === '/' || pathname === '/preview') file = path.join(root, 'docs/design/home3d/character-lod-preview.html');
        else if (allowed.includes(pathname) || /^\/artifacts\/home3d-models\/silver-red-v1\/(character\.glb|(?:lod-v2|hd-texture-v1\/review-lods-v3)\/(near\.glb|middle\.glb|far\.glb|lod-manifest\.json))$/.test(pathname)) file = path.join(root, pathname);
        if (!file || !fs.existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json' })[path.extname(file)], 'Cache-Control': 'no-store' });
        fs.createReadStream(file).pipe(res);
    });
}
async function verify(server) {
    const assert = require('node:assert/strict');
    const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const result = { checks: [], comparisons: [], errors: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 375, height: 844 } }); page.on('pageerror', error => result.errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/preview');
        await page.waitForFunction(() => window.CharacterLODPreview?.ready || window.CharacterLODPreviewFailure, null, { timeout: 90000 });
        assert.equal(await page.evaluate(() => window.CharacterLODPreviewFailure), undefined);
        for (const view of ['room', 'body', 'face', 'hand']) {
            await page.evaluate(view => CharacterLODPreview.setView(view), view);
            const stats = await page.evaluate(() => CharacterLODPreview.stats());
            assert.equal(stats.mode, 'auto'); assert.equal(stats.level, view === 'room' ? 'far' : view === 'body' ? 'middle' : 'near'); assert.ok(stats.cache.length <= 2); result.checks.push({ view, ...stats });
            await page.screenshot({ path: path.join(directory, view + '-mobile.png') });
        }
        for (const view of ['face', 'hand', 'body']) {
            await page.evaluate(view => CharacterLODPreview.setView(view), view);
            await page.evaluate(() => CharacterLODPreview.setMode('original'));
            const original = await page.evaluate(() => CharacterLODPreview.capturePixels());
            await page.screenshot({ path: path.join(directory, view + '-original.png') });
            await page.evaluate(() => CharacterLODPreview.setMode('auto'));
            const optimized = await page.evaluate(() => CharacterLODPreview.capturePixels());
            let difference = 0, changed = 0;
            for (let i = 0; i < original.length; i += 4) { let pixel = 0; for (let channel = 0; channel < 3; channel++) pixel += Math.abs(original[i + channel] - optimized[i + channel]); difference += pixel; if (pixel > 30) changed++; }
            result.comparisons.push({ view, meanAbsoluteRGBError: difference / (original.length / 4 * 3), fractionChangedOver10RGB: changed / (original.length / 4), level: (await page.evaluate(() => CharacterLODPreview.stats())).level });
        }
        await page.evaluate(() => CharacterLODPreview.setView('face')); await page.evaluate(() => CharacterLODPreview.rotate(Math.PI / 2));
        await page.screenshot({ path: path.join(directory, 'face-side-mobile.png') });
        for (const width of [320, 375]) for (const safe of [47, 59]) for (const parentReserves of [false, true]) {
            await page.setViewportSize({ width, height: 844 }); await page.evaluate(({ safe, parentReserves }) => {
                document.body.style.setProperty('--safe-top', (parentReserves ? 0 : safe) + 'px');
                document.querySelector('main').style.paddingTop = (parentReserves ? safe : 0) + 'px';
            }, { safe, parentReserves });
            await page.evaluate(() => CharacterLODPreview.setView('face'));
            const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, header: document.querySelector('header').getBoundingClientRect().top, controls: document.querySelector('.views').getBoundingClientRect().right }));
            assert.equal(layout.overflow, false); assert.equal(layout.header, safe); assert.ok(layout.controls <= width); result.checks.push({ width, safe, parentReserves, layout });
            if (width === 320 && safe === 59 && !parentReserves) await page.screenshot({ path: path.join(directory, 'face-safe-320.png'), fullPage: true });
        }
        await page.evaluate(async () => { await Promise.all([CharacterLODPreview.setView('room'), CharacterLODPreview.setView('face'), CharacterLODPreview.setView('body'), CharacterLODPreview.setView('face')]); });
        assert.equal(await page.evaluate(() => CharacterLODPreview.stats().level), 'near');
        assert.ok((await page.evaluate(() => CharacterLODPreview.stats().cache)).length <= 2);
        // A failed optional original-model download must retain the displayed optimized model.
        await page.route('**/character.glb', route => route.fulfill({ status: 503, body: 'unavailable' }));
        // Evict the original by visiting two optimized levels first.
        await page.evaluate(() => CharacterLODPreview.setView('room')); await page.evaluate(() => CharacterLODPreview.setView('face'));
        await page.evaluate(() => CharacterLODPreview.setMode('original'));
        assert.equal(await page.evaluate(() => CharacterLODPreview.stats().level), 'near'); assert.match(await page.locator('#status').innerText(), /失败.*保留/);
        assert.equal(result.errors.length, 0);
        fs.writeFileSync(path.join(directory, 'browser-review.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
    } finally { await browser.close(); }
}
async function main() {
    if (!fs.existsSync(path.join(directory, 'lod-manifest.json'))) throw new Error('Generate the reviewed local LOD models first.');
    const server = createServer(); await new Promise(resolve => server.listen(process.argv.includes('--check') ? 0 : 8796, '127.0.0.1', resolve));
    if (process.argv.includes('--check')) { try { await verify(server); } finally { server.close(); } }
    else console.log('Local static-model preview: http://127.0.0.1:8796/preview');
}
module.exports = { createServer, verify };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
