'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.resolve(__dirname, '../artifacts/desktop-legacy-transfer'); fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const results = [];
    try {
        for (const height of [248, 300, 332]) {
            const page = await browser.newPage({ viewport: { width: 375, height: 844 }, hasTouch: true });
            page.setDefaultTimeout(15000);
            page.setDefaultNavigationTimeout(60000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof enterEditMode === 'function');
            await page.evaluate(async () => { await byndStylesReady; unlockPhone(); });
            await page.waitForTimeout(250);
            const before = await page.evaluate(height => {
                enterEditMode();
                const target = getDesktopPages()[1].querySelector('.desktop-scroll-area');
                const source = ensureDesktopPage(2).querySelector('.desktop-scroll-area');
                const spare = ensureDesktopPage(3).querySelector('.desktop-scroll-area'); spare.classList.add('layout-canvas');
                [...target.querySelectorAll(':scope > .desktop-layout-item'), ...source.querySelectorAll(':scope > .desktop-layout-item')].forEach(item => spare.appendChild(item));
                const grab = id => document.querySelector('[data-layout-id="app-' + id + '"]');
                const lovely = document.querySelector('[data-layout-id="custom-lovely-default"]');
                prepareDesktopLayoutItem(lovely, target, { left: 18, top: 48, width: 339, height });
                const m = getDesktopFourColumnAppGridMetrics(target);
                const ids = ['pet', 'mcp', 'living-world', 'outing', 'monitor', 'dream', 'coread', 'manual'];
                ids.forEach((id, i) => prepareDesktopLayoutItem(grab(id), target, { left: Math.round(m.startX + i % 4 * (m.iconWidth + m.gapX)), top: 394 + Math.floor(i / 4) * 90, width: m.iconWidth, height: 82 }));
                const moved = grab('home3d'); prepareDesktopLayoutItem(moved, source, { left: 24, top: 64, width: 72, height: 82 });
                goToDesktopPage(2); selectDesktopLayoutItem(moved);
                return { stored: lovely.style.height, actual: lovely.offsetHeight, capacity: getDesktopFlowSlotRects(target).length };
            }, height);
            await page.locator('[data-layout-id="app-home3d"] .desktop-item-move-page').click();
            await page.locator('.desktop-move-card select').selectOption('1');
            await page.locator('[data-move-confirm]').click();
            await page.waitForTimeout(300);
            const after = await page.evaluate(() => {
                const item = document.querySelector('[data-layout-id="app-home3d"]'), area = item.parentElement;
                const footprint = getDesktopTransferFootprint(item, area);
                return { page: getDesktopPageIndex(area.closest('.desktop-page')), rect: getDesktopRawStyleRect(item), clear: [...area.querySelectorAll(':scope > .desktop-layout-item')].filter(other => other !== item).every(other => getDesktopRectIntersectionRatio(footprint, getDesktopTransferFootprint(other, area)) === 0), popup: !!document.querySelector('.desktop-move-card') };
            });
            await page.screenshot({ path: path.join(output, 'stored-height-' + height + '.png') });
            console.log(JSON.stringify({ height, before, after }));
            assert.equal(after.page, 1, 'CSS-sized photo with stale stored height ' + height + ' must leave its visible empty row usable');
            assert.equal(after.rect.top, 304); assert.equal(after.clear, true); assert.equal(after.popup, false);
            // Also load a genuine legacy save, rather than only changing a live
            // CSS box. Repair must retain the user's existing two icon rows.
            await page.evaluate(height => {
                saveDesktopLayout();
                const saved = JSON.parse(localStorage.getItem('desktop_layout_v2'));
                saved.items.find(item => item.id === 'custom-lovely-default').height = height;
                localStorage.setItem('desktop_layout_v2', JSON.stringify(saved));
            }, height);
            await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => typeof unlockPhone === 'function');
            await page.evaluate(async () => { await byndStylesReady; unlockPhone(); });
            await page.waitForFunction(() => document.querySelector('.desktop-layout-item[data-layout-id="app-home3d"]')).catch(async error => {
                console.log('Reload diagnostic', await page.evaluate(() => ({ stored: JSON.parse(localStorage.getItem('desktop_layout_v2') || '{}'), applied: typeof _desktopLayoutApplied === 'undefined' ? null : _desktopLayoutApplied, home: [...document.querySelectorAll('[data-layout-id="app-home3d"]')].map(item => ({ className: item.className, style: item.getAttribute('style') })) })), errors);
                throw error;
            });
            await page.waitForTimeout(300);
            const reloaded = await page.evaluate(() => {
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
                const lovely = area.querySelector('[data-layout-id="custom-lovely-default"]');
                const moved = area.querySelector(':scope > .desktop-layout-item[data-layout-id="app-home3d"]');
                return { height: getDesktopRawStyleRect(lovely).height, top: getDesktopRawStyleRect(moved).top, capacity: getDesktopFlowSlotRects(area).length };
            });
            assert.equal(reloaded.height, 248); assert.equal(reloaded.top, 304); assert.equal(reloaded.capacity, 12);
            results.push({ height, before, after }); await page.close();
        }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(results, null, 2));
    console.log('Actual move-page dialog accepts empty rows below legacy CSS-sized widgets.');
})().catch(error => { console.error(error); process.exitCode = 1; });
