'use strict';
// Browser verification of the collector; it cannot verify Samsung's native window.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/pwa-display-check-browser');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const results = [];
    try {
        for (const [width, safe, query, denied] of [[320, 47, false, false], [375, 59, true, false], [320, 59, true, true], [375, 47, false, true]]) {
            const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true,
                userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S9280) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36 SamsungBrowser/27.0' });
            const cdp = await page.context().newCDPSession(page);
            await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: safe, bottom: 24, left: 0, right: 0 } });
            await page.route('https://**/*', route => route.abort());
            await page.addInitScript(({ version, denied }) => {
                const match = window.matchMedia.bind(window);
                window.matchMedia = q => q.startsWith('(display-mode:') ? { matches: q === '(display-mode: standalone)', addEventListener() {} } : match(q);
                localStorage.setItem('bynd_lastSeenVersion', version);
                localStorage.setItem('bynd_builtin_library_seen_v1', '1');
                localStorage.setItem('private-check-fixture', 'PRIVATE-SECRET');
                localStorage.setItem('my_theme_data', JSON.stringify({ lockEnabled: false, phoneStatusBarEnabled: true,
                    wpHome: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="375" height="844"><rect width="375" height="844" fill="#eedee8"/></svg>') }));
                window.__copied = [];
                Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => {
                    if (window.__denyCopy) throw new DOMException('denied', 'NotAllowedError');
                    window.__copied.push(text);
                } } });
                if (denied) Element.prototype.requestFullscreen = () => Promise.reject(new DOMException('PRIVATE-ERROR', 'NotAllowedError'));
            }, { version: require('./bump-version.cjs').currentVersion(), denied });
            await page.goto(pathToFileURL(path.join(root, 'index.html')).href + (query ? '?v=1.1.764&display-check=1' : ''), { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.__byndCoreReady && window.ByndDisplayCheck);
            await page.evaluate(async () => { await window.__byndCoreReady; ByndBuiltinLibrary?.close(); unlockPhone(); });
            if (!query) {
                assert.equal(await page.locator('#bynd-display-check').count(), 0);
                assert.equal(await page.locator('button[onclick="ByndDisplayCheck.open()"]').count(), 1);
                await page.evaluate(() => ByndDisplayCheck.open());
                // The existing recovery listener must not consume gestures inside the diagnostic.
                await page.locator('[data-display-copy]').tap();
                assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
            }
            await page.locator('#bynd-display-check').waitFor({ state: 'visible' });
            const initial = await page.locator('#bynd-display-check').boundingBox();
            assert.ok(initial.x >= 0 && initial.x + initial.width <= width);
            assert.ok(initial.y >= safe && initial.y + initial.height <= 844 - 24);
            await page.locator('[data-display-check]').tap();
            await page.waitForFunction(() => !document.querySelector('[data-display-check]').disabled);
            const report = await page.locator('#bynd-display-check textarea').inputValue().then(JSON.parse);
            assert.equal(report.before.phone.top, 0);
            assert.equal(report.before.bodyPaddingTop, 0);
            assert.equal(report.before.safeArea.top, safe);
            assert.equal(report.before.fullscreenElement, 'none');
            assert.equal(report.fullscreenRequest.outcome, denied ? 'rejected' : 'entered');
            assert.equal(report.after.fullscreenElement, denied ? 'none' : 'phone');
            assert.equal(report.after.statusBar.visible, true);
            assert.equal(report.appVersion, 'v' + require('./bump-version.cjs').currentVersion());
            const text = await page.evaluate(() => window.__copied.at(-1));
            assert.deepEqual(JSON.parse(text), report);
            assert.doesNotMatch(text, /PRIVATE|data:image|my_theme_data/);
            assert.equal(await page.evaluate(() => localStorage.getItem('private-check-fixture')), 'PRIVATE-SECRET');
            await page.evaluate(() => { window.__denyCopy = true; });
            await page.locator('[data-display-copy]').tap();
            await page.waitForFunction(() => document.querySelector('[data-display-status]').dataset.error === 'true');
            assert.match(await page.locator('[data-display-status]').innerText(), /未能复制/);
            assert.equal(await page.locator('#bynd-display-check textarea').isVisible(), true);
            await page.screenshot({ path: path.join(output, `${width}-${safe}-${denied ? 'rejected' : 'entered'}.png`) });
            await page.locator('[data-display-close]').tap();
            assert.equal(await page.locator('#bynd-display-check').count(), 0);
            results.push({ width, safe, query, denied, report });
            await page.close();
        }
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(results, null, 2));
        console.log('4 browser layouts passed: 320/375px, safe areas 47/59px, real fullscreen, denial and clipboard fallback. Samsung native window remains unverified.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
