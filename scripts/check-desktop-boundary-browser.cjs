'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.resolve(__dirname, '../artifacts/desktop-boundary'); fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const checks = [];
    try {
        for (const viewport of [{ width: 1699, height: 901 }, { width: 375, height: 844 }]) {
            const page = await browser.newPage({ viewport });
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof enterEditMode === 'function');
            const original = await page.evaluate(async () => {
                await byndStylesReady; unlockPhone(); await new Promise(resolve => setTimeout(resolve, 250)); enterEditMode();
                const target = ensureDesktopPage(1).querySelector('.desktop-scroll-area');
                const source = ensureDesktopPage(2).querySelector('.desktop-scroll-area');
                const spare = ensureDesktopPage(3).querySelector('.desktop-scroll-area');
                [...target.querySelectorAll(':scope > .desktop-layout-item'), ...source.querySelectorAll(':scope > .desktop-layout-item')].forEach(item => spare.appendChild(item));
                const grab = id => document.querySelector('[data-layout-id="app-' + id + '"]');
                prepareDesktopLayoutItem(document.querySelector('[data-layout-id="custom-lovely-default"]'), target, { left: 16, top: 72, width: 327, height: 248 });
                ['pet', 'mcp', 'living-world', 'outing', 'monitor', 'dream', 'coread', 'manual'].forEach((id, index) => prepareDesktopLayoutItem(grab(id), target, { left: [12, 100, 187, 275][index % 4], top: index < 4 ? 328 : 418, width: 72, height: 82 }));
                const album = grab('album') || createDesktopAppElement(getDesktopAnyAppDefinition('album'));
                prepareDesktopLayoutItem(album, source, { left: 12, top: 328, width: 72, height: 82 });
                goToDesktopPage(2); selectDesktopLayoutItem(album);
                return { width: target.clientWidth, height: target.clientHeight, items: [...target.querySelectorAll(':scope > .desktop-layout-item')].map(item => ({ id: item.dataset.layoutId, rect: getDesktopRawStyleRect(item) })) };
            });
            assert.equal(original.width, 359); assert.equal(original.height, 590);
            await page.locator('[data-layout-id="app-album"] .desktop-item-move-page').click();
            await page.locator('.desktop-move-card select').selectOption('1');
            await page.locator('[data-move-confirm]').click(); await page.waitForTimeout(300);
            const result = await page.evaluate(() => {
                const item = document.querySelector('.desktop-layout-item[data-layout-id="app-album"]');
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
                const frame = area.getBoundingClientRect();
                const pixels = item.querySelector('.app-icon').getBoundingClientRect();
                const label = item.querySelector(':scope > span').getBoundingClientRect();
                return { page: getDesktopPageIndex(item.closest('.desktop-page')), rect: getDesktopRawStyleRect(item), slots: getDesktopFlowSlotRects(area).length, clear: [...area.querySelectorAll(':scope > .desktop-layout-item')].filter(other => other !== item).every(other => desktopAppRectsHaveClearance(getDesktopRawStyleRect(item), getDesktopRawStyleRect(other))), visible: pixels.bottom <= frame.bottom && label.bottom <= frame.bottom, items: [...area.querySelectorAll(':scope > .desktop-layout-item')].filter(other => other !== item).map(other => ({ id: other.dataset.layoutId, rect: getDesktopRawStyleRect(other) })) };
            });
            await page.screenshot({ path: path.join(output, 'reported-layout-' + viewport.width + '.png') });
            console.log(JSON.stringify({ viewport, result }));
            assert.equal(result.page, 1, 'the exact reported layout must accept album into screen two');
            assert.equal(result.rect.top, 508); assert.equal(result.slots, 12); assert.equal(result.clear, true); assert.equal(result.visible, true);
            assert.deepEqual(result.items, original.items, 'existing photo and eight icons keep their exact saved positions');
            assert.equal(await page.locator('.desktop-move-card').count(), 0);
            await page.evaluate(() => saveDesktopLayout());
            await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => typeof unlockPhone === 'function');
            await page.evaluate(async () => { await byndStylesReady; unlockPhone(); });
            await page.waitForFunction(() => document.querySelector('.desktop-layout-item[data-layout-id="app-album"]'));
            const reloaded = await page.evaluate(() => {
                const item = document.querySelector('.desktop-layout-item[data-layout-id="app-album"]');
                return { page: getDesktopPageIndex(item.closest('.desktop-page')), rect: getDesktopRawStyleRect(item) };
            });
            assert.equal(reloaded.page, 1); assert.deepEqual(reloaded.rect, result.rect);
            await page.evaluate(() => goToDesktopPage(1)); await page.waitForTimeout(300);
            const normal = await page.evaluate(() => {
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area'), viewport = document.getElementById('pages-container').getBoundingClientRect();
                const canvas = area.getBoundingClientRect(), album = area.querySelector(':scope > [data-layout-id="app-album"]');
                return { canvasBottom: canvas.bottom, viewportBottom: viewport.bottom, iconBottom: album.querySelector('.app-icon').getBoundingClientRect().bottom,
                    labelBottom: album.querySelector(':scope > span').getBoundingClientRect().bottom, search: document.querySelectorAll('#home-screen .bynd-desktop-search').length };
            });
            assert.equal(normal.search, 0);
            assert.ok(normal.canvasBottom <= normal.viewportBottom + 1, 'normal desktop must expose the full saved 590px canvas');
            assert.ok(normal.iconBottom <= normal.viewportBottom && normal.labelBottom <= normal.viewportBottom, 'last-row icon and label must remain fully visible outside edit mode');
            await page.screenshot({ path: path.join(output, 'full-desktop-' + viewport.width + '.png') });
            await page.evaluate(() => { enterEditMode(); goToDesktopPage(1); }); await page.waitForTimeout(300);
            // Real pointer movement and release must use the same last-row bounds.
            const start = await page.locator('.desktop-layout-item[data-layout-id="app-album"] .app-icon').boundingBox();
            const end = await page.evaluate(() => {
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area'), frame = area.getBoundingClientRect();
                const scale = frame.width / area.clientWidth;
                return { x: frame.left + 136 * scale, y: frame.top + 540 * scale };
            });
            await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
            await page.mouse.move(end.x, end.y, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(250);
            const dragged = await page.evaluate(() => getDesktopRawStyleRect(document.querySelector('.desktop-layout-item[data-layout-id="app-album"]')));
            assert.equal(dragged.left, 100); assert.equal(dragged.top, 508);
            // Reproduce the reported monitor/forum stack, including a stale
            // occupant ID while a real pointer drag is already in progress.
            await page.evaluate(() => captureDesktopPageSlotRects(getDesktopPages()[1].querySelector('.desktop-scroll-area')));
            await page.waitForTimeout(250);
            const monitor = page.locator('.desktop-layout-item[data-layout-id="app-monitor"] .app-icon');
            const forum = page.locator('.desktop-layout-item[data-layout-id="app-living-world"] .app-icon');
            const m = await monitor.boundingBox(), f = await forum.boundingBox();
            await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2); await page.mouse.down();
            await page.evaluate(() => { document.querySelector('.desktop-layout-item[data-layout-id="app-living-world"]').dataset.desktopSlot = '0'; });
            await page.mouse.move(f.x + f.width / 2, f.y + f.height + 8, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(250);
            const overlap = await page.evaluate(() => {
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
                const apps = [...area.querySelectorAll(':scope > .desktop-layout-item.layout-app')];
                return { monitor: getDesktopRawStyleRect(area.querySelector(':scope > .desktop-layout-item[data-layout-id="app-monitor"]')), forum: getDesktopRawStyleRect(area.querySelector(':scope > .desktop-layout-item[data-layout-id="app-living-world"]')), clear: apps.every(item => apps.filter(other => other !== item).every(other => desktopAppRectsHaveClearance(getDesktopRawStyleRect(item), getDesktopRawStyleRect(other)))) };
            });
            assert.equal(overlap.clear, true); assert.equal(overlap.monitor.left, 187); assert.equal(overlap.monitor.top, 328);
            await page.screenshot({ path: path.join(output, 'monitor-forum-separated-' + viewport.width + '.png') });
            // Old saves containing an actual stack must be repaired on reload.
            await page.evaluate(() => {
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
                setDesktopLayoutItemRect(area.querySelector(':scope > .desktop-layout-item[data-layout-id="app-living-world"]'), getDesktopRawStyleRect(area.querySelector(':scope > .desktop-layout-item[data-layout-id="app-monitor"]')));
                saveDesktopLayout();
            });
            await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => typeof unlockPhone === 'function');
            await page.evaluate(async () => { await byndStylesReady; unlockPhone(); });
            await page.waitForFunction(() => document.querySelector('.desktop-layout-item[data-layout-id="app-living-world"]'));
            await page.waitForTimeout(300);
            const repaired = await page.evaluate(() => {
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
                const items = [...area.querySelectorAll(':scope > .desktop-layout-item')];
                return { count: items.filter(item => item.classList.contains('layout-app')).length, clear: items.filter(item => item.classList.contains('layout-app')).every(item => items.filter(other => other !== item).every(other => desktopAppRectsHaveClearance(getDesktopRawStyleRect(item), getDesktopRawStyleRect(other)))) };
            });
            assert.equal(repaired.count, 9); assert.equal(repaired.clear, true);
            assert.deepEqual(errors, []); checks.push({ viewport, result, reloaded, dragged, overlap, repaired, errors }); await page.close();
        }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(checks, null, 2));
    console.log('Exact user diagnostic: bottom row, existing positions, visible labels, save/reload and dragging passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
