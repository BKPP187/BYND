'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/monitor-ui');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndMonitor);
        await page.evaluate(async () => {
            await window.__byndCoreReady;
            await window.byndStylesReady;
            unlockPhone();
            ByndBuiltinLibrary?.close();
            window.myCharacters = [
                { id: 'monitor-ui-a', name: '小星', avatar: '', chatConfig: { monitorEnabled: true, monitorMode: 'persona', monitorBarrageSpeed: 1 }, history: [] },
                { id: 'monitor-ui-b', name: '阿云', avatar: '', chatConfig: { monitorEnabled: false, monitorMode: 'observer', monitorBarrageSpeed: 1 }, history: [] }
            ];
            openApp('monitor');
            ByndMonitor.render();
        });
        for (const scenario of [
            { width: 375, height: 844, safe: 47, parentReserved: false },
            { width: 320, height: 568, safe: 59, parentReserved: false },
            { width: 320, height: 568, safe: 0, parentReserved: true },
            { width: 430, height: 932, safe: 47, parentReserved: false }
        ]) {
            await page.setViewportSize({ width: scenario.width, height: scenario.height });
            await page.evaluate(({ safe, parentReserved }) => {
                const host = document.querySelector('#app-monitor-window');
                host.style.setProperty('--bynd-header-safe-top', `${safe}px`);
                host.style.paddingTop = parentReserved ? '59px' : '0';
            }, scenario);
            const measured = await page.evaluate(() => {
                const host = document.querySelector('#app-monitor-window');
                const top = host.querySelector('.mh-topbar').getBoundingClientRect();
                const nav = host.querySelector('.mh-nav').getBoundingClientRect();
                const first = host.querySelector('.mh-heading h1').getBoundingClientRect();
                const styles = getComputedStyle(host);
                const bounds = host.getBoundingClientRect();
                return { horizontalOverflow: host.scrollWidth - host.clientWidth, hostTop: bounds.top, hostBottom: bounds.bottom,
                    top: top.top, topBottom: top.bottom, navBottom: nav.bottom, firstTop: first.top, background: styles.backgroundColor };
            });
            assert.ok(measured.horizontalOverflow <= 2, JSON.stringify({ scenario, measured }));
            assert.ok(measured.firstTop >= measured.topBottom - 2, JSON.stringify({ scenario, measured }));
            assert.ok(measured.navBottom <= measured.hostBottom + 2, JSON.stringify({ scenario, measured }));
            assert.equal(measured.background, 'rgb(255, 247, 238)');
            await page.locator('#app-monitor-window').screenshot({ path: path.join(output, `monitor-${scenario.width}-${scenario.safe}-${scenario.parentReserved ? 'parent' : 'header'}.png`) });
        }
        await page.locator('#monitor-toolbar [data-mh-tab="island"]').click();
        assert.equal(await page.locator('#monitor-tool-panel').getAttribute('data-tool'), 'island');
        await page.locator('#monitor-toolbar [data-mh-tab="internal"]').click();
        assert.equal(await page.locator('#monitor-tool-panel .mh-watcher-card').count(), 2);
        assert.deepEqual(errors, []);
        console.log('Monitor reference UI passed narrow-screen, safe-area, and tab checks.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
