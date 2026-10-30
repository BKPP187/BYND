'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/atelier-title');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 940 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://**/*', route => route.abort());
        await page.addInitScript(() => {
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            localStorage.setItem('bynd_onboarding_v1', '{"status":"skipped"}');
        });
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof setAppFontFamily === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady;
            unlockPhone(); ByndBuiltinLibrary?.close();
            document.getElementById('bynd-version-letter')?.remove();
        });
        await page.addStyleTag({ content: '.app-window{transition:none!important}.tapfx-layer{display:none!important}' });
        const failures = [], cases = [];
        for (const mode of ['frame', 'mobile']) {
            for (const width of mode === 'frame' ? [1024, 1440] : [320, 375, 430]) {
                await page.setViewportSize({ width, height: mode === 'frame' ? 940 : 844 });
                await page.evaluate(mode => document.documentElement.classList.toggle('mobile-runtime', mode === 'mobile'), mode);
                for (const font of ['Arial, sans-serif', 'Verdana, sans-serif', 'Georgia, serif', '"Courier New", monospace']) {
                    await page.evaluate(async font => { setAppFontFamily(font); await document.fonts.ready; }, font);
                    for (const app of ['settings', 'theme']) {
                        await page.evaluate(app => openApp(app), app);
                        const bounds = await page.locator(`#app-${app}-window .atelier-cover-composition`).evaluate(cover => {
                            const clip = cover.getBoundingClientRect();
                            return [...cover.querySelectorAll('.atelier-cover-word, .atelier-cover-reflection')].map(title => {
                                let rect;
                                const svgText = title.querySelector('text');
                                if (svgText) rect = svgText.getBoundingClientRect();
                                else {
                                    const range = document.createRange(); range.selectNodeContents(title);
                                    rect = range.getBoundingClientRect();
                                }
                                return { text: title.textContent.trim(), reflection: title.classList.contains('atelier-cover-reflection'),
                                    font: getComputedStyle(svgText || title).fontFamily,
                                    left: rect.left - clip.left, right: clip.right - rect.right,
                                    textWidth: rect.width, available: clip.width };
                            });
                        });
                        cases.push({ mode, width, font, app, bounds });
                        for (const bound of bounds) {
                            assert.equal(bound.text, app === 'settings' ? 'SETTINGS' : 'ATELIER');
                            assert.ok(bound.textWidth >= bound.available * .7, 'The fix must retain the oversized headline, not hide or shrink it to ordinary text.');
                            if (bound.left < 4 || bound.right < 4) failures.push({ mode, width, app, ...bound });
                        }
                        if (font.startsWith('Arial') && (width === 375 || width === 1440)) {
                            const screenshot = { path: path.join(output, `${app}-${mode}-${width}.png`), animations: 'disabled' };
                            if (mode === 'frame') await page.locator('.phone-container').screenshot(screenshot);
                            else await page.screenshot(screenshot);
                        }
                    }
                }
            }
        }
        fs.writeFileSync(path.join(output, 'bounds.json'), JSON.stringify(cases, null, 2));
        if (failures.length) console.error(JSON.stringify(failures.slice(0, 4), null, 2));
        assert.equal(failures.length, 0, `${failures.length} title/reflection runs clipped; see ${path.join(output, 'bounds.json')}`);
        assert.deepEqual(errors, []);
        console.log(`PASS: ${cases.length * 2} title/reflection bounds across framed 1024/1440px and mobile 320/375/430px, four actual global font overrides, all with at least 4px clearance.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
