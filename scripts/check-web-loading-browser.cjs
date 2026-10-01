const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/web-loading');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
        if (error) { response.writeHead(404).end(); return; }
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
        response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
        response.end(data);
    });
});

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
    await context.route('https://**/*', route => route.abort());
    const results = [];
    try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let releaseStyle;
        const styleGate = new Promise(resolve => { releaseStyle = resolve; });
        await page.route('**/ui/theme/style.css?*', async route => { await styleGate; await route.continue(); });
        await page.goto(origin, { waitUntil: 'commit' });
        const loader = page.locator('#bynd-resource-loading');
        await loader.waitFor({ state: 'visible' });
        assert.equal(await page.locator('.bynd-loading-book h1').innerText(), 'Beyond\nThe Code');
        assert.equal(await page.locator('.bynd-lyric-note').count(), 9);
        assert.equal(await page.locator('.bynd-loading-retry').isVisible(), false, JSON.stringify(errors));
        await page.screenshot({ path: path.join(output, 'loading-375.png') });
        // The loader reserves only the safe area not already reserved by its parent.
        for (const width of [320, 375, 430]) {
            for (const safeTop of [47, 59]) {
                for (const parentReserved of [false, true]) {
                    await page.setViewportSize({ width, height: 844 });
                    await page.evaluate(({ safeTop, parentReserved }) => {
                        document.body.style.paddingTop = parentReserved ? `${safeTop}px` : '0px';
                        document.querySelector('.phone-container').style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : `${safeTop}px`);
                        document.querySelector('.phone-container').style.height = parentReserved ? `${844 - safeTop}px` : '844px';
                    }, { safeTop, parentReserved });
                    const geometry = await loader.evaluate(layer => {
                        const scroll = layer.querySelector('.bynd-loading-scroll');
                        const book = layer.querySelector('.bynd-loading-book').getBoundingClientRect();
                        const status = layer.querySelector('.bynd-loading-status').getBoundingClientRect();
                        return { left: book.left, right: book.right, top: book.top, statusBottom: status.bottom, scrollWidth: scroll.scrollWidth, width: scroll.clientWidth };
                    });
                    assert.ok(geometry.left >= 0 && geometry.right <= width && geometry.top >= safeTop && geometry.top < safeTop + 30 && geometry.scrollWidth <= geometry.width + 1 && geometry.statusBottom <= 844, JSON.stringify({ width, safeTop, parentReserved, geometry }));
                    if (!parentReserved && width !== 375) await page.screenshot({ path: path.join(output, `loading-${width}-safe-${safeTop}.png`) });
                }
            }
        }
        await page.locator('.bynd-loading-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
        assert.equal(await page.locator('.bynd-loading-signature').isVisible(), true);
        await page.screenshot({ path: path.join(output, 'lyrics-outro.png') });
        await page.waitForFunction(() => typeof loadCharactersFromStorage === 'function' && !!window.__byndCoreReady);
        await page.evaluate(() => {
            window.loadCharactersFromStorage = () => new Promise(resolve => { window.resolveProofCharacters = resolve; });
        });
        releaseStyle();
        await page.waitForFunction(() => window.resolveProofCharacters);
        assert.equal(await loader.isVisible(), true, 'character hydration is a real pending dependency');
        await page.evaluate(() => {
            // Observe readiness in the same microtask turn: there must be no timeout or exit animation.
            window.__byndCoreReady.then(() => { window.proofClosedAtReady = !document.getElementById('bynd-resource-loading'); });
            window.resolveProofCharacters();
        });
        await loader.waitFor({ state: 'detached' });
        assert.equal(await page.evaluate(() => window.proofClosedAtReady), true);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('bynd-web-loading')), false);
        assert.deepEqual(errors, []);
        results.push('First paint before CSS; full lyrics scroll; 12 safe-area/width combinations without duplicate padding; immediate exit after hydration.');
        await page.unroute('**/ui/theme/style.css?*');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady);
        await page.evaluate(() => window.__byndCoreReady);
        assert.equal(await loader.count(), 0, 'repeat visits must not add a playback delay');
        results.push('Repeat visit exits immediately when core readiness resolves.');

        const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        await desktopContext.route('https://**/*', route => route.abort());
        const desktop = await desktopContext.newPage();
        let releaseDesktopStyle;
        const desktopGate = new Promise(resolve => { releaseDesktopStyle = resolve; });
        await desktop.route('**/ui/theme/style.css?*', async route => { await desktopGate; await route.continue(); });
        await desktop.goto(origin, { waitUntil: 'commit' });
        await desktop.locator('#bynd-resource-loading').waitFor({ state: 'visible' });
        const frame = await desktop.evaluate(() => {
            const phone = document.querySelector('.phone-container').getBoundingClientRect();
            const loader = document.querySelector('#bynd-resource-loading').getBoundingClientRect();
            return { phone: { x: phone.x, y: phone.y, width: phone.width, height: phone.height }, loader: { x: loader.x, y: loader.y, width: loader.width, height: loader.height }, overflow: document.documentElement.scrollHeight > innerHeight };
        });
        assert.deepEqual(frame.phone, { x: 532.5, y: 94, width: 375, height: 812 });
        assert.deepEqual(frame.loader, { x: 540.5, y: 102, width: 359, height: 796 });
        assert.equal(frame.overflow, false);
        const scrollbar = await desktop.locator('.bynd-loading-scroll').evaluate(node => ({
            width: getComputedStyle(node).scrollbarWidth,
            display: getComputedStyle(node, '::-webkit-scrollbar').display,
            gutter: node.offsetWidth - node.clientWidth
        }));
        assert.deepEqual(scrollbar, { width: 'none', display: 'none', gutter: 0 }, 'scrollbar must be hidden even before application CSS loads');
        await desktop.screenshot({ path: path.join(output, 'loading-desktop.png') });
        await desktop.locator('.bynd-loading-scroll').hover();
        await desktop.mouse.wheel(0, 500);
        await desktop.waitForFunction(() => document.querySelector('.bynd-loading-scroll').scrollTop > 0);
        releaseDesktopStyle();
        await desktop.locator('#bynd-resource-loading').waitFor({ state: 'detached' });
        await desktopContext.close();
        results.push('Desktop loading stays inside the centered 375 × 812 phone frame; scrollbar is hidden before CSS loads and wheel scrolling works.');

        for (const failure of ['css', 'script', 'initialize']) {
            const failed = await context.newPage();
            const pattern = failure === 'css' ? '**/ui/theme/style.css?*' : failure === 'script' ? '**/systems/usage/ledger.js?*' : '**/main.js?*';
            await failed.route(pattern, async route => {
                if (failure !== 'initialize') { await route.abort(); return; }
                const response = await route.fetch();
                await route.fulfill({ response, body: (await response.text()).replace('function initializeByndApp() {', 'function initializeByndApp() { throw new Error("proof initialization failure");') });
            });
            await failed.goto(origin, { waitUntil: 'domcontentloaded' });
            await failed.locator('#bynd-resource-loading.is-error').waitFor();
            assert.equal(await failed.locator('.bynd-loading-retry').isVisible(), true);
            assert.match(await failed.locator('[data-loading-message]').innerText(), /加载未完成/);
            await failed.evaluate(() => window.__byndResourceLoading?.ready());
            assert.equal(await failed.locator('#bynd-resource-loading').isVisible(), true, 'failure must never become a fake success');
            if (failure === 'css') await failed.screenshot({ path: path.join(output, 'loading-failure.png') });
            await failed.unroute(pattern);
            await failed.locator('.bynd-loading-retry').click();
            await failed.waitForFunction(() => window.__byndCoreReady && !document.getElementById('bynd-resource-loading'));
            results.push(`${failure} failure remains visible and reload recovers.`);
            await failed.close();
        }
        const native = await context.newPage();
        await native.addInitScript(() => { window.ByndAndroid = {}; });
        await native.goto(origin, { waitUntil: 'domcontentloaded' });
        assert.equal(await native.locator('#bynd-resource-loading').isVisible(), false);
        assert.equal(await native.evaluate(() => window.__byndResourceLoading), undefined);
        results.push('Android native wrapper does not gain a web loading overlay.');
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(results, null, 2));
        console.log(results.join('\n'));
    } finally {
        await context.close();
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
