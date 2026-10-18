'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const { start } = require('./license-dev-server.cjs');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/website-image-loading');
async function main() {
    fs.mkdirSync(output, { recursive: true });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-image-loading-'));
    let service, browser;
    try {
        service = await start({ port: 0, directory }); browser = await chromium.launch({ channel: 'msedge', headless: true });
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage(), cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 125000, uploadThroughput: 125000 });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        async function imageMetrics() {
            await page.locator('.account-heading img').evaluate(image => image.decode());
            return page.evaluate(() => {
                const image = document.querySelector('.account-heading img'), timing = performance.getEntriesByType('resource').find(entry => entry.name === image.currentSrc);
                return { bytes: timing.decodedBodySize, transferBytes: timing.transferSize, durationMs: Math.round(timing.duration), source: new URL(image.currentSrc).pathname, naturalWidth: image.naturalWidth };
            });
        }
        await page.goto(service.origin + '/account.html', { waitUntil: 'domcontentloaded' }); const cold = await imageMetrics();
        assert.ok(cold.bytes < 150000, 'Account image exceeds transfer budget'); assert.ok(cold.naturalWidth >= 252, 'Image should cover a 3x 84px display');
        const baseline = await page.evaluate(async () => { const begin = performance.now(), response = await fetch('/assets/website/bynd-companion.png', { cache: 'no-store' }), bytes = (await response.arrayBuffer()).byteLength; return { bytes, durationMs: Math.round(performance.now() - begin) }; });
        assert.ok(cold.durationMs < baseline.durationMs / 4, 'Optimized image must materially improve the same throttled connection');
        await page.goto(service.origin + '/account.html?image-check=warm', { waitUntil: 'domcontentloaded' }); const warm = await imageMetrics();
        assert.equal(warm.transferBytes, 0, 'Second visit must reuse the cached image');
        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 844 });
            for (const safe of [47, 59]) for (const parent of [false, true]) {
                await page.evaluate(({ safe, parent }) => { document.documentElement.style.setProperty('--safe-top', safe + 'px'); document.body.classList.toggle('safe-area-from-parent', parent); scrollTo({ top: 0, behavior: 'instant' }); }, { safe, parent });
                const box = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, top: document.querySelector('.wordmark').getBoundingClientRect().top }));
                assert.ok(box.scrollWidth <= box.width); assert.ok(Math.abs(box.top - safe - 17) <= 1);
            }
            await page.evaluate(() => { document.documentElement.style.setProperty('--safe-top', '0px'); document.body.classList.remove('safe-area-from-parent'); });
            await page.screenshot({ path: path.join(output, 'account-' + width + '.png'), fullPage: true });
        }
        assert.deepEqual(errors, []);
        const result = { bandwidthMbps: 1, baseline, cold, warm, errors };
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
    } finally { if (browser) await browser.close(); if (service) await service.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
