'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/redesign', process.argv[2] || 'before');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__byndCoreReady && typeof openApp === 'function');
    await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime'); openApp('theme'); });
    await page.addStyleTag({ content: '.app-window{transition:none!important;animation:none!important}' });
    await page.waitForTimeout(600);
    const content = page.locator('#app-theme-window .window-content');
    const total = await content.evaluate(el => el.scrollHeight);
    console.log('scrollHeight', total);
    for (let y = 0, i = 0; y < total && i < 12; y += 700, i++) {
        await content.evaluate((el, y) => { el.scrollTop = y; }, y);
        await page.waitForTimeout(100);
        await page.screenshot({ path: path.join(output, `theme-${i}.png`) });
    }
    if (await page.evaluate(() => typeof openThemeSection === 'function')) {
        for (const section of ['wallpaper', 'lock', 'desktop', 'icons', 'effects', 'library']) {
            await page.evaluate(key => openThemeSection(key), section);
            await page.waitForTimeout(150);
            const height = await content.evaluate(el => el.scrollHeight);
            console.log(section, 'scrollHeight', height);
            await page.screenshot({ path: path.join(output, `section-${section}.png`) });
        }
        await page.locator('#theme-header-back').click();
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(output, 'home-after-back.png') });
    }
    console.log('errors', errors);
    await browser.close();
})();
