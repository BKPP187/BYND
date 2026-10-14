'use strict';
// Safety/mechanism checks in Chromium. Samsung's native window is a separate acceptance test.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/pwa-cutout-recovery-browser');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const checks = [];
    try {
        for (const [width, safe, gap, samsung] of [[320, 0, 35, true], [375, 0, 35, true], [320, 47, 35, true], [375, 59, 35, true], [375, 0, 0, true], [375, 0, 35, false]]) {
            const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true,
                userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S9280) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36' + (samsung ? ' SamsungBrowser/27.0' : '') });
            const cdp = await page.context().newCDPSession(page);
            await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: width, screenHeight: 844 + gap });
            await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: safe, bottom: 0, left: 0, right: 0 } });
            await page.route('https://**/*', route => route.abort());
            await page.addInitScript(({ version }) => {
                const original = window.matchMedia.bind(window);
                window.matchMedia = query => query.startsWith('(display-mode:') ? { matches: query === '(display-mode: standalone)', addEventListener() {} } : original(query);
                localStorage.setItem('bynd_lastSeenVersion', version);
                localStorage.setItem('bynd_builtin_library_seen_v1', '1');
                localStorage.setItem('my_theme_data', JSON.stringify({ lockEnabled: false, phoneStatusBarEnabled: true,
                    wpHome: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="375" height="844"><rect width="375" height="844" fill="#eedee8"/></svg>') }));
                window.__viewportChanges = [];
                document.addEventListener('DOMContentLoaded', () => {
                    const meta = document.querySelector('meta[name="viewport"]');
                    new MutationObserver(records => { for (const record of records) window.__viewportChanges.push({ old: record.oldValue, next: meta.content }); })
                        .observe(meta, { attributes: true, attributeOldValue: true, attributeFilter: ['content'] });
                });
            }, { version: require('./bump-version.cjs').currentVersion() });
            await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.__byndCoreReady && window.ByndFullscreenRecovery);
            await page.evaluate(async () => {
                await window.__byndCoreReady; ByndBuiltinLibrary?.close(); unlockPhone();
                const button = document.createElement('button'); button.id = 'recovery-gesture'; button.textContent = 'Fullscreen test';
                button.style.cssText = 'position:absolute;top:120px;left:12px;width:140px;height:44px;z-index:10000';
                document.querySelector('.phone-container').appendChild(button);
            });
            assert.equal(await page.evaluate(() => window.ByndFullscreenRecovery.result()), null, 'no mutation before actual fullscreen');
            const originalViewport = await page.locator('meta[name="viewport"]').getAttribute('content');
            await page.locator('#recovery-gesture').tap();
            await page.waitForFunction(() => document.fullscreenElement === document.querySelector('.phone-container'));
            const expected = samsung && safe === 0 && gap === 35;
            if (expected) await page.waitForFunction(() => !!window.ByndFullscreenRecovery.result());
            else await page.waitForTimeout(450);
            const result = await page.evaluate(() => window.ByndFullscreenRecovery.result());
            assert.equal(!!result, expected, JSON.stringify({ width, safe, gap, samsung, result }));
            const mutations = await page.evaluate(() => window.__viewportChanges);
            assert.equal(mutations.length, expected ? 2 : 0);
            assert.equal(await page.locator('meta[name="viewport"]').getAttribute('content'), originalViewport);
            if (expected) {
                assert.match(mutations[0].next, /viewport-fit=auto/);
                assert.match(mutations[1].next, /viewport-fit=cover/);
                assert.equal(result.outcome, result.after.viewportHeight > result.before.viewportHeight + 1 ? 'expanded' : 'unchanged');
                await page.evaluate(() => { window.dispatchEvent(new Event('pageshow')); document.dispatchEvent(new Event('fullscreenchange')); });
                await page.waitForTimeout(300);
                assert.equal(await page.evaluate(() => window.__viewportChanges.length), 2, 'no repeated viewport pulses');
            }
            assert.equal(await page.locator('.status-bar').isVisible(), true);
            assert.equal(await page.locator('.phone-container').evaluate(node => node.getBoundingClientRect().top), 0);
            const visual = await page.evaluate(() => ({ viewport: window.visualViewport.height, phone: document.querySelector('.phone-container').getBoundingClientRect().height }));
            assert.ok(Math.abs(visual.viewport - visual.phone) < 1);
            await page.evaluate(() => document.getElementById('recovery-gesture').remove());
            await page.screenshot({ path: path.join(output, `${width}-${safe}-${gap}-${samsung ? 'samsung' : 'chrome'}.png`) });
            checks.push({ width, safe, gap, samsung, result, mutationCount: mutations.length, visual });
            await page.close();
        }
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(checks, null, 2));
        console.log('6 Chromium mechanism/guard checks passed. No Samsung native-window fix is claimed by these tests.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
