'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/screen-companion');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndPetWorkspace);
        await page.evaluate(async () => {
            await __byndCoreReady; await byndStylesReady;
            unlockPhone(); ByndBuiltinLibrary?.close();
            window.companionSettingsOpened = [];
            window.ByndAndroid = {
                companionStatus: () => JSON.stringify({ overlay: true, usage: false, notifications: true, battery: false, oem: 'samsung', sdk: 36, running: true }),
                setCompanionConfig() {},
                openCompanionSetting(kind) { companionSettingsOpened.push(kind); return 'opened'; }
            };
            localStorage.setItem('bynd_screen_companion_v1', JSON.stringify({ enabled: true }));
            openApp('pet'); ByndPetWorkspace.navigate('phone');
        });
        await page.waitForFunction(() => !document.documentElement.classList.contains('bynd-web-loading'));
        for (const safe of [47, 59]) for (const parent of [false, true]) {
            await page.setViewportSize({ width: 320, height: 720 });
            await page.evaluate(({ safe, parent }) => {
                const host = document.querySelector('#app-pet-window');
                host.style.boxSizing = 'border-box';
                host.style.setProperty('--bynd-header-safe-top', `${parent ? 0 : safe}px`);
                host.style.paddingTop = parent ? `${safe}px` : '0px';
                ByndPetWorkspace.navigate('phone');
            }, { safe, parent });
            const help = page.locator('#app-pet-window .sc-restricted');
            await help.locator('summary').click();
            await help.scrollIntoViewIfNeeded();
            const bounds = await page.evaluate(() => {
                const host = document.querySelector('#app-pet-window');
                return { hostTop: host.getBoundingClientRect().top, backTop: host.querySelector('[data-mh-action="back"]').getBoundingClientRect().top,
                    overflow: host.scrollWidth - host.clientWidth,
                    clipped: [...host.querySelectorAll('.sc-section button, .sc-check')].some(el => el.getBoundingClientRect().right > host.getBoundingClientRect().right + 1) };
            });
            assert.ok(bounds.overflow <= 2 && !bounds.clipped, JSON.stringify(bounds));
            assert.ok(bounds.backTop >= bounds.hostTop + safe && bounds.backTop < bounds.hostTop + safe + 20, JSON.stringify(bounds));
            await page.locator('#app-pet-window').screenshot({ path: path.join(output, `samsung-${safe}-${parent ? 'parent' : 'header'}.png`), animations: 'disabled' });
        }
        await page.locator('[data-sc-open="restricted"]').click();
        assert.deepEqual(await page.evaluate(() => companionSettingsOpened), ['restricted']);
        assert.equal(await page.locator('[data-sc-open="autostart"]').count(), 0);
        console.log('Samsung permission help: 320px, 47/59px safe areas in both ownership modes, and app-details action passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
