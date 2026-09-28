'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        for (const viewport of [{ width: 1699, height: 901 }, { width: 375, height: 844 }]) {
            const page = await browser.newPage({ viewport });
            await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof enterEditMode === 'function');
            await page.evaluate(async () => {
                await byndStylesReady; unlockPhone(); await new Promise(resolve => setTimeout(resolve, 200)); enterEditMode();
                const area = ensureDesktopPage(1).querySelector('.desktop-scroll-area');
                const spare = ensureDesktopPage(3).querySelector('.desktop-scroll-area');
                [...area.querySelectorAll(':scope > .desktop-layout-item')].forEach(item => spare.appendChild(item));
                const lovely = document.querySelector('[data-layout-id="custom-lovely-default"]');
                prepareDesktopLayoutItem(lovely, area, { left: 0, top: 72, width: 359, height: 248 });
                for (const [index, id] of ['outing', 'album', 'dream', 'living-world'].entries()) {
                    const item = document.querySelector('.desktop-layout-item[data-layout-id="app-' + id + '"]') || createDesktopAppElement(getDesktopAnyAppDefinition(id));
                    prepareDesktopLayoutItem(item, area, { left: [12, 100, 187, 275][index], top: 304, width: 72, height: 82 });
                }
                captureDesktopPageSlotRects(area);
                saveDesktopLayout();
                const saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY));
                saved.items.find(item => item.id === 'custom-lovely-default').height = 332;
                localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(saved));
                goToDesktopPage(1);
            });
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof unlockPhone === 'function');
            await page.evaluate(async () => { await byndStylesReady; unlockPhone(); goToDesktopPage(1); });
            await page.waitForTimeout(300);
            const result = await page.evaluate(() => {
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
                const widget = area.querySelector(':scope > .desktop-widget-lovely');
                const firstRow = [...area.querySelectorAll(':scope > .desktop-layout-item.layout-app')].filter(item => ['app-outing', 'app-album', 'app-dream', 'app-living-world'].includes(item.dataset.layoutId));
                const title = widget.querySelector('.lcw-title-row').getBoundingClientRect();
                const iconTop = Math.min(...firstRow.map(item => item.querySelector('.app-icon').getBoundingClientRect().top));
                const labelTop = Math.min(...firstRow.map(item => item.querySelector(':scope > span').getBoundingClientRect().top));
                return { widget: widget.getBoundingClientRect().toJSON(), title: title.toJSON(), iconTop, labelTop, gap: iconTop - title.bottom, apps: firstRow.length,
                    raw: { widget: getDesktopRawStyleRect(widget), row: Math.min(...firstRow.map(item => getDesktopRawStyleRect(item).top)) } };
            });
            console.log(JSON.stringify({ viewport, result }));
            assert.equal(result.apps, 4);
            assert.ok(result.gap >= 4, 'the widget title must leave visible space above the first icon row');
            assert.ok(result.raw.row >= result.raw.widget.top + result.raw.widget.height + 8, 'legacy saved icons must move below the migrated widget');
            await page.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
