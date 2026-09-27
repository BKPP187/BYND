'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.resolve(__dirname, '../artifacts/desktop-edge'); fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const results = [];
    try {
        for (const width of [375, 430]) {
            const page = await browser.newPage({ viewport: { width, height: 844 } });
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof enterEditMode === 'function');
            const initial = await page.evaluate(async () => {
                await byndStylesReady; unlockPhone();
                await new Promise(resolve => setTimeout(resolve, 250));
                enterEditMode();
                const target = ensureDesktopPage(1).querySelector('.desktop-scroll-area');
                const source = ensureDesktopPage(2).querySelector('.desktop-scroll-area');
                const spare = ensureDesktopPage(3).querySelector('.desktop-scroll-area');
                [...target.querySelectorAll(':scope > .desktop-layout-item'), ...source.querySelectorAll(':scope > .desktop-layout-item')].forEach(item => spare.appendChild(item));
                const grab = id => document.querySelector('[data-layout-id="app-' + id + '"]');
                const photo = document.querySelector('[data-layout-id="custom-lovely-default"]');
                prepareDesktopLayoutItem(photo, target, { left: 18, top: 48, width: target.clientWidth - 36, height: 248 });
                const m = getDesktopFourColumnAppGridMetrics(target);
                ['pet', 'mcp', 'living-world', 'outing', 'monitor', 'dream', 'coread', 'manual'].forEach((id, i) => prepareDesktopLayoutItem(grab(id), target, { left: Math.round(m.startX + i % 4 * (m.iconWidth + m.gapX)), top: 304 + Math.floor(i / 4) * 100, width: m.iconWidth, height: 82 }));
                const moved = grab('home3d');
                prepareDesktopLayoutItem(moved, source, { left: Math.round(m.startX + 3 * (m.iconWidth + m.gapX)), top: 304, width: m.iconWidth, height: 82 });
                prepareDesktopLayoutItem(grab('comic'), source, { left: 12, top: 304, width: m.iconWidth, height: 82 });
                captureDesktopPageSlotRects(target); captureDesktopPageSlotRects(source);
                goToDesktopPage(2); selectDesktopLayoutItem(moved);
                return [...target.querySelectorAll(':scope > .desktop-layout-item')].map(item => ({ id: item.dataset.layoutId, rect: getDesktopRawStyleRect(item) }));
            });
            await page.locator('[data-layout-id="app-home3d"] .desktop-item-move-page').click();
            await page.locator('.desktop-move-card select').selectOption('1');
            await page.locator('[data-move-confirm]').click();
            await page.waitForTimeout(250);
            const first = await page.evaluate(() => {
                const item = document.querySelector('[data-layout-id="app-home3d"]');
                return { page: getDesktopPageIndex(item.closest('.desktop-page')), rect: getDesktopRawStyleRect(item) };
            });
            assert.equal(first.page, 1); assert.equal(first.rect.top, 494);
            assert.equal(await page.locator('.desktop-move-card').count(), 0);
            const original = await page.evaluate(() => [...getDesktopPages()[1].querySelectorAll(':scope > .desktop-scroll-area > .desktop-layout-item')].filter(item => item.dataset.layoutId !== 'app-home3d').map(item => ({ id: item.dataset.layoutId, rect: getDesktopRawStyleRect(item) })));
            assert.deepEqual(original, initial, 'move picker preserves every existing row baseline');
            await page.evaluate(() => {
                const source = getDesktopPages()[2].querySelector('.desktop-scroll-area');
                const moved = document.querySelector('[data-layout-id="app-home3d"]');
                const m = getDesktopFourColumnAppGridMetrics(source);
                source.appendChild(moved); setDesktopLayoutItemRect(moved, { left: Math.round(m.startX + 3 * (m.iconWidth + m.gapX)), top: 304, width: m.iconWidth, height: 82 });
                captureDesktopPageSlotRects(source); delete getDesktopPages()[1].querySelector('.desktop-scroll-area')._desktopSlotRects;
                goToDesktopPage(2); selectDesktopLayoutItem(moved);
            });
            await page.waitForTimeout(250);
            const icon = await page.locator('[data-layout-id="app-home3d"] .app-icon').boundingBox();
            const frame = await page.locator('#pages-container').boundingBox();
            await page.mouse.move(icon.x + icon.width / 2, icon.y + icon.height / 2); await page.mouse.down();
            await page.mouse.move(frame.x + 3, icon.y + icon.height / 2, { steps: 15 });
            // No further pointermove: a stationary edge hover must switch pages.
            await page.waitForFunction(() => window._desktopCurrentPage === 1, { timeout: 2500 });
            await page.waitForTimeout(250);
            const drop = await page.evaluate(() => {
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
                const rect = area.getBoundingClientRect(), scale = rect.width / area.clientWidth;
                const m = getDesktopFourColumnAppGridMetrics(area);
                return { x: rect.left + (m.startX + m.iconWidth + m.gapX + m.iconWidth / 2) * scale, y: rect.top + (494 + 41) * scale };
            });
            await page.mouse.move(drop.x, drop.y); await page.mouse.up(); await page.waitForTimeout(100);
            const dragged = await page.evaluate(() => {
                const item = document.querySelector('[data-layout-id="app-home3d"]'), area = item.parentElement;
                return { page: getDesktopPageIndex(item.closest('.desktop-page')), rect: getDesktopRawStyleRect(item), clear: [...area.querySelectorAll(':scope > .desktop-layout-item')].filter(other => other !== item).every(other => desktopAppRectsHaveClearance(getDesktopRawStyleRect(item), getDesktopRawStyleRect(other))), dragging: item.classList.contains('desktop-layout-dragging') };
            });
            assert.equal(dragged.page, 1); assert.equal(dragged.rect.top, 494); assert.equal(dragged.clear, true); assert.equal(dragged.dragging, false);
            await page.screenshot({ path: path.join(output, 'dragged-' + width + '.png') });
            // Ending a drag before the dwell expires must cancel the pending flip.
            const box = await page.locator('[data-layout-id="app-home3d"] .app-icon').boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
            await page.mouse.move(frame.x + 3, box.y + box.height / 2, { steps: 8 });
            await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
            await page.mouse.up(); await page.waitForTimeout(900);
            assert.equal(await page.evaluate(() => window._desktopCurrentPage), 1);
            assert.equal(await page.locator('.desktop-layout-dragging').count(), 0);
            // Genuine full-screen failure exposes a safe clipboard fallback.
            await page.evaluate(() => {
                const area = ensureDesktopPage(2).querySelector('.desktop-scroll-area'); area.replaceChildren();
                const block = createDesktopCustomWidget('catalog', 'edge-test-full');
                prepareDesktopLayoutItem(block, area, { left: 8, top: 8, width: area.clientWidth - 16, height: area.clientHeight - 16 });
                selectDesktopLayoutItem(document.querySelector('[data-layout-id="app-home3d"]'));
                Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
            });
            await page.locator('[data-layout-id="app-home3d"] .desktop-item-move-page').click();
            await page.locator('.desktop-move-card select').selectOption('2');
            await page.locator('[data-move-confirm]').click();
            await page.locator('[data-move-diagnostic]').click();
            const diagnostic = await page.locator('[data-layout-diagnostic-text]').inputValue();
            assert.equal(JSON.parse(diagnostic).target.items[0].id, 'edge-test-full');
            assert.ok(!/apiKey|data:image|reference|chatHistory/.test(diagnostic));
            assert.deepEqual(errors, []);
            results.push({ width, first, dragged, errors }); await page.close();
        }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(results, null, 2));
    console.log('Uneven legacy rows, stationary edge dragging, cancellation and diagnostic fallback passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
