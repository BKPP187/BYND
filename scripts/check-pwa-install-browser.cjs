'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname,'..');
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2' };
const server = http.createServer((req,res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
});
(async () => {
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const browser = await chromium.launch({channel:'msedge',headless:true});
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil:'domcontentloaded'});
        await page.waitForFunction(() => window.__byndCoreReady && navigator.serviceWorker.controller);
        const initial = await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); return { active: !!reg?.active, enabled: getProactiveNotifySettings().enabled }; });
        assert.deepEqual(initial, {active:true,enabled:false});
        await page.evaluate(() => cleanupByndServiceWorkerIfIdle());
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(() => navigator.serviceWorker.controller && window.__byndCoreReady);
        const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
        assert.equal(manifest.display,'standalone');
        await context.setOffline(true);
        const response = await page.reload({waitUntil:'domcontentloaded'});
        assert.equal(response.status(),503); assert.equal(await page.locator('h1').innerText(),'暂时没有网络');
        await context.setOffline(false); await page.locator('button').click();
        await page.waitForFunction(() => window.__byndCoreReady && navigator.serviceWorker.controller);
        console.log('Worker registered with push disabled, survived cleanup/reload, standalone manifest loaded, offline failure and retry verified. Samsung hardware installation still needs device validation.');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
