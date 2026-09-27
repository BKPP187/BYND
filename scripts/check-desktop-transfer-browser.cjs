'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/desktop-transfer'); fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, hasTouch: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
        await page.waitForFunction(() => typeof enterEditMode === 'function');
        const initial = await page.evaluate(async () => {
            await byndStylesReady; unlockPhone(); enterEditMode();
            await new Promise(resolve => setTimeout(resolve, 250));
            for (const area of document.querySelectorAll('.desktop-scroll-area.layout-canvas')) {
                const all = [...area.querySelectorAll(':scope > .desktop-layout-item')];
                for (const item of all.filter(node => node.classList.contains('layout-app'))) {
                    const footprint = getDesktopTransferFootprint(item, area);
                    if (all.some(other => other !== item && getDesktopRectIntersectionRatio(footprint, getDesktopTransferFootprint(other, area)) > 0.001)) throw new Error('Default layout overlap: ' + item.dataset.layoutId);
                }
            }
            const target = ensureDesktopPage(1).querySelector('.desktop-scroll-area');
            const source = ensureDesktopPage(2).querySelector('.desktop-scroll-area');
            const ids = ['comic', 'coread', 'living-world', 'role-tools', 'outing', 'pet', 'dream', 'manual', 'mcp'];
            const grab = id => document.querySelector('.desktop-layout-item[data-layout-id="app-' + id + '"]') || createDesktopAppElement(getDesktopAnyAppDefinition(id));
            const items = ids.map(grab), moved = grab('home3d');
            const lovely = document.querySelector('.desktop-layout-item[data-layout-id="custom-lovely-default"]') || createDesktopCustomWidget('lovely', 'custom-lovely-default');
            const spare = ensureDesktopPage(3).querySelector('.desktop-scroll-area'); spare.classList.add('layout-canvas');
            [...target.children, ...source.children].filter(node => node.classList.contains('desktop-layout-item')).forEach(node => spare.appendChild(node));
            target.replaceChildren(); source.replaceChildren();
            prepareDesktopLayoutItem(lovely, target, { left: 18, top: 48, width: target.clientWidth - 36, height: 248 });
            const metrics = getDesktopFourColumnAppGridMetrics(target), rowTop = 304, step = 90;
            const slots = [0, 1, 2, 3, 4, 6, 7, 8, 9];
            items.forEach((item, i) => {
                const slot = slots[i];
                prepareDesktopLayoutItem(item, target, { left: metrics.startX + (slot % 4) * (metrics.iconWidth + metrics.gapX), top: rowTop + Math.floor(slot / 4) * step, width: metrics.iconWidth, height: 82 });
            });
            prepareDesktopLayoutItem(moved, source, { left: 24, top: 64, width: metrics.iconWidth, height: 82 });
            localStorage.setItem('bynd_desktop_page2_custom_v1', '1');
            captureDesktopPageSlotRects(target); captureDesktopPageSlotRects(source);
            goToDesktopPage(2); selectDesktopLayoutItem(moved);
            // Leave controls on this item while another item is selected, as in
            // the reported screenshot. The clicked control must retain ownership.
            selectDesktopLayoutItem(items[0]);
            return { expected: { left: Math.round(metrics.startX + metrics.iconWidth + metrics.gapX), top: rowTop + step }, others: Object.fromEntries([lovely, ...items].map(item => [item.dataset.layoutId, getDesktopRawStyleRect(item)])) };
        });
        await page.evaluate(() => { document.getElementById('pages-container').scrollLeft = 74; });
        await page.locator('#page-dots .page-dot').nth(1).tap();
        assert.equal(await page.evaluate(() => window._desktopCurrentPage), 1, 'tapping the second dot switches screens while editing');
        await page.waitForTimeout(50);
        assert.equal(await page.evaluate(() => document.getElementById('pages-container').scrollLeft), 0, 'native focus scrolling cannot offset the desktop carousel');
        await page.locator('#page-dots .page-dot').nth(2).tap();
        assert.equal(await page.evaluate(() => window._desktopCurrentPage), 2);
        // Exercise an actual swipe through the empty third screen as well.
        await page.mouse.move(90, 200); await page.mouse.down(); await page.mouse.move(285, 200, { steps: 12 }); await page.mouse.up();
        assert.equal(await page.evaluate(() => window._desktopCurrentPage), 1);
        await page.locator('#page-dots .page-dot').nth(2).tap();
        await page.locator('.desktop-layout-item[data-layout-id="app-home3d"] .desktop-item-move-page').click();
        await page.locator('.desktop-move-card select').selectOption('1');
        await page.screenshot({ path: path.join(output, 'choose-page.png') });
        await page.locator('[data-move-confirm]').click();
        const moved = await page.evaluate(() => {
            const item = document.querySelector('.desktop-layout-item[data-layout-id="app-home3d"]'), area = item.closest('.desktop-scroll-area');
            return { page: getDesktopPageIndex(item.closest('.desktop-page')), rect: getDesktopRawStyleRect(item), clear: [...area.querySelectorAll(':scope > .desktop-layout-item')].filter(other => other !== item).every(other => desktopAppRectsHaveClearance(getDesktopRawStyleRect(item), getDesktopRawStyleRect(other))), others: Object.fromEntries([...area.querySelectorAll(':scope > .desktop-layout-item')].filter(other => other !== item).map(other => [other.dataset.layoutId, getDesktopRawStyleRect(other)])) };
        });
        assert.equal(moved.page, 1); assert.equal(moved.clear, true);
        assert.equal(moved.rect.left, initial.expected.left); assert.equal(moved.rect.top, initial.expected.top);
        assert.deepEqual(moved.others, initial.others);
        await page.screenshot({ path: path.join(output, 'moved-into-gap.png') });
        await page.evaluate(() => saveDesktopLayout());
        await page.reload(); await page.waitForFunction(() => typeof unlockPhone === 'function');
        await page.evaluate(async () => { await byndStylesReady; unlockPhone(); });
        await page.waitForFunction(() => document.querySelector('.desktop-layout-item[data-layout-id="app-home3d"]')?.classList.contains('desktop-layout-item'), null, { timeout: 5000 }).catch(async error => {
            console.log('Reload diagnostic', await page.evaluate(() => ({ saved: JSON.parse(localStorage.getItem('desktop_layout_v2') || '{}').items?.find(item => item.id === 'app-home3d'), applied: typeof _desktopLayoutApplied === 'undefined' ? null : _desktopLayoutApplied, nodes: [...document.querySelectorAll('.desktop-layout-item[data-layout-id="app-home3d"]')].map(item => item.className) })), errors);
            throw error;
        });
        const restored = await page.evaluate(() => {
            const item = document.querySelector('.desktop-layout-item[data-layout-id="app-home3d"]');
            return { page: getDesktopPageIndex(item.closest('.desktop-page')), rect: getDesktopRawStyleRect(item) };
        });
        assert.equal(restored.page, 1); assert.deepEqual(restored.rect, moved.rect);
        // A full destination must leave the source item and its saved layout intact.
        await page.evaluate(() => {
            enterEditMode();
            const target = ensureDesktopPage(2).querySelector('.desktop-scroll-area'); target.replaceChildren();
            const block = createDesktopCustomWidget('catalog', 'transfer-full-screen');
            prepareDesktopLayoutItem(block, target, { left: 8, top: 8, width: target.clientWidth - 16, height: target.clientHeight - 16 });
            goToDesktopPage(1); selectDesktopLayoutItem(document.querySelector('.desktop-layout-item[data-layout-id="app-home3d"]'));
        });
        const saved = await page.evaluate(() => localStorage.getItem('desktop_layout_v2'));
        await page.locator('.desktop-layout-item[data-layout-id="app-home3d"] .desktop-item-move-page').click();
        await page.locator('.desktop-move-card select').selectOption('2');
        await page.locator('[data-move-confirm]').click();
        assert.equal(await page.evaluate(() => getDesktopPageIndex(document.querySelector('.desktop-layout-item[data-layout-id="app-home3d"]').closest('.desktop-page'))), 1);
        assert.equal(await page.evaluate(() => localStorage.getItem('desktop_layout_v2')), saved);
        assert.equal(await page.locator('.desktop-move-card').isVisible(), true);
        await page.locator('[data-move-cancel]').click();
        await page.evaluate(() => exitEditMode(false));
        // Match the reported first screen: a calendar, one full icon row,
        // taller legacy Game/Theme boxes, and a photo below the second row.
        const firstStage = await page.evaluate(() => {
            enterEditMode();
            const area = getDesktopPages()[0].querySelector('.desktop-scroll-area');
            const third = ensureDesktopPage(2).querySelector('.desktop-scroll-area');
            const grab = id => document.querySelector('.desktop-layout-item[data-layout-id="app-' + id + '"]') || createDesktopAppElement(getDesktopAnyAppDefinition(id));
            const apps = ['worldbook', 'regex', 'wechat', 'settings', 'game', 'theme'].map(grab), role = grab('role-tools');
            const calendar = document.querySelector('.calendar-widget');
            const photo = document.querySelector('.photo-large') || document.createElement('div');
            photo.classList.add('photo-large'); photo.dataset.layoutId = 'widget-photo-2';
            area.replaceChildren();
            prepareDesktopLayoutItem(calendar, area, { left: 18, top: 8, width: area.clientWidth - 36, height: 180 });
            prepareDesktopLayoutItem(photo, area, { left: 18, top: 482, width: area.clientWidth - 36, height: 100 });
            const m = getDesktopFourColumnAppGridMetrics(area);
            apps.forEach((item, i) => prepareDesktopLayoutItem(item, area, { left: m.startX + ((i < 4 ? i : i === 4 ? 0 : 3) * (m.iconWidth + m.gapX)), top: i < 4 ? 220 : 326, width: m.iconWidth, height: i < 4 ? 82 : 140 }));
            prepareDesktopLayoutItem(role, third, { left: 24, top: 64, width: 72, height: 82 });
            repairDesktopAppOverlaps(area);
            captureDesktopPageSlotRects(area); captureDesktopPageSlotRects(third);
            goToDesktopPage(2); selectDesktopLayoutItem(role);
            return Object.fromEntries([calendar, photo].map(item => [item.dataset.layoutId, getDesktopRawStyleRect(item)]));
        });
        await page.locator('.desktop-layout-item[data-layout-id="app-role-tools"] .desktop-item-move-page').click();
        await page.locator('.desktop-move-card select').selectOption('0'); await page.locator('[data-move-confirm]').click();
        await page.waitForTimeout(250);
        const firstResult = await page.evaluate(() => {
            const area = getDesktopPages()[0].querySelector('.desktop-scroll-area');
            const top = id => area.querySelector('[data-layout-id="app-' + id + '"] .app-icon').getBoundingClientRect().top;
            const role = area.querySelector('[data-layout-id="app-role-tools"]'), rect = getDesktopTransferFootprint(role, area);
            return { aligned: Math.max(top('game'), top('theme'), top('role-tools')) - Math.min(top('game'), top('theme'), top('role-tools')), clear: [...area.querySelectorAll(':scope > .desktop-layout-item')].filter(item => item !== role).every(item => getDesktopRectIntersectionRatio(rect, getDesktopTransferFootprint(item, area)) === 0), widgets: Object.fromEntries([...area.querySelectorAll(':scope > .desktop-layout-item:not(.layout-app)')].map(item => [item.dataset.layoutId, getDesktopRawStyleRect(item)])) };
        });
        assert.ok(firstResult.aligned < 1, 'first-screen icons share the same visible horizontal line');
        assert.equal(firstResult.clear, true); assert.deepEqual(firstResult.widgets, firstStage);
        const viewportAlignment = await page.evaluate(() => {
            const container = document.getElementById('pages-container'), first = getDesktopPages()[0];
            return { scrollLeft: container.scrollLeft, offset: Math.abs(first.getBoundingClientRect().left - container.getBoundingClientRect().left), visible: [...first.querySelectorAll('.app-icon')].every(node => { const r = node.getBoundingClientRect(), frame = container.getBoundingClientRect(); return r.left >= frame.left && r.right <= frame.right; }) };
        });
        assert.equal(viewportAlignment.scrollLeft, 0); assert.ok(viewportAlignment.offset < 1); assert.equal(viewportAlignment.visible, true, 'all first-screen icons are visible inside the page viewport');
        await page.screenshot({ path: path.join(output, 'first-screen-aligned.png') });
        await page.evaluate(() => saveDesktopLayout());
        await page.reload(); await page.waitForFunction(() => typeof unlockPhone === 'function');
        await page.evaluate(async () => { await byndStylesReady; unlockPhone(); });
        await page.waitForFunction(() => document.querySelector('.desktop-layout-item[data-layout-id="app-role-tools"]'));
        await page.locator('#page-dots .page-dot').nth(1).tap();
        assert.equal(await page.evaluate(() => window._desktopCurrentPage), 1, 'second-screen dots remain usable after saving and reopening');
        await page.locator('#page-dots .page-dot').nth(0).tap();
        const savedAlignment = await page.evaluate(() => {
            const area = getDesktopPages()[0].querySelector('.desktop-scroll-area');
            const tops = ['game', 'theme', 'role-tools'].map(id => area.querySelector('[data-layout-id="app-' + id + '"] .app-icon').getBoundingClientRect().top);
            return Math.max(...tops) - Math.min(...tops);
        });
        assert.ok(savedAlignment < 1, 'first-screen rows remain aligned after reopening');
        for (const width of [320, 430]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(() => { document.getElementById('home-screen').style.setProperty('--bynd-header-safe-top', '47px'); enterEditMode(); goToDesktopPage(1); selectDesktopLayoutItem(document.querySelector('.desktop-layout-item[data-layout-id="app-home3d"]')); });
            await page.locator('.desktop-layout-item[data-layout-id="app-home3d"] .desktop-item-move-page').click();
            const bounds = await page.locator('.desktop-move-card').boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y >= 47);
            await page.locator('[data-move-cancel]').click(); await page.evaluate(() => exitEditMode(false));
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ result: 'passed', moved, restored, firstResult, errors }, null, 2));
        console.log('Desktop cross-screen movement browser checks passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
