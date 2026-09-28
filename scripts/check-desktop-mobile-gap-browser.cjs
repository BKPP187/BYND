'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 384, height: 832 }, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof enterEditMode === 'function');
        await page.evaluate(async () => {
            await byndStylesReady; unlockPhone(); enterEditMode();
            const target = ensureDesktopPage(1).querySelector('.desktop-scroll-area');
            const source = ensureDesktopPage(2).querySelector('.desktop-scroll-area');
            const spare = ensureDesktopPage(3).querySelector('.desktop-scroll-area');
            [...target.querySelectorAll(':scope > .desktop-layout-item'), ...source.querySelectorAll(':scope > .desktop-layout-item')].forEach(item => spare.appendChild(item));
            const grab = id => document.querySelector('[data-layout-id="app-' + id + '"]') || createDesktopAppElement(getDesktopAnyAppDefinition(id));
            const lovely = document.querySelector('[data-layout-id="custom-lovely-default"]') || createDesktopCustomWidget('lovely', 'custom-lovely-default');
            prepareDesktopLayoutItem(lovely, target, { left: 17, top: 72, width: 349, height: 248 });
            ['outing', 'monitor', 'album', 'dream', 'coread', 'manual', 'mcp', 'living-world'].forEach((id, index) => {
                prepareDesktopLayoutItem(grab(id), target, { left: [12, 108, 204, 300][index % 4], top: index < 4 ? 400 : 500, width: 72, height: 82 });
            });
            prepareDesktopLayoutItem(grab('moon'), source, { left: 12, top: 328, width: 72, height: 82 });
            localStorage.setItem('bynd_desktop_page2_custom_v1', '1');
            repairDesktopLayoutOverlaps();
            goToDesktopPage(2);
        });
        const before = await page.evaluate(() => {
            const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
            return { width: area.clientWidth, height: area.clientHeight, widget: getDesktopRawStyleRect(area.querySelector('[data-layout-id="custom-lovely-default"]')), slots: getDesktopFlowSlotRects(area),
                icons: [...area.querySelectorAll(':scope > .desktop-layout-item.layout-app:not(.is-folder)')].map(item => ({ id: item.dataset.layoutId, rect: getDesktopRawStyleRect(item) })) };
        });
        assert.equal(before.width, 384); assert.equal(before.height, 590);
        assert.deepEqual(before.widget, { left: 17, top: 72, width: 349, height: 248 });
        assert.equal(before.slots.length, 12);
        assert.deepEqual([...new Set(before.slots.map(slot => slot.top))], [328, 418, 508]);
        assert.equal(before.icons.length, 8);
        assert.ok(before.icons.every(item => [418, 508].includes(item.rect.top)), 'old icons snap into the three-row grid');
        await page.evaluate(() => selectDesktopLayoutItem(document.querySelector('[data-layout-id="app-moon"]')));
        await page.locator('[data-layout-id="app-moon"] .desktop-item-move-page').click();
        await page.locator('.desktop-move-card select').selectOption('1');
        await page.locator('[data-move-confirm]').click();
        const transferred = await page.evaluate(() => {
            const item = document.querySelector('[data-layout-id="app-moon"]');
            return { page: getDesktopPageIndex(item.closest('.desktop-page')), rect: getDesktopRawStyleRect(item) };
        });
        assert.equal(transferred.page, 1); assert.equal(transferred.rect.top, 328);
        await page.evaluate(() => goToDesktopPage(1));
        const start = await page.locator('[data-layout-id="app-monitor"] .app-icon').boundingBox();
        const destination = await page.evaluate(() => {
            const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
            const frame = area.getBoundingClientRect(), scale = frame.width / area.clientWidth;
            return { x: frame.left + 144 * scale, y: frame.top + 369 * scale };
        });
        const cdp = await context.newCDPSession(page);
        const origin = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] });
        for (let step = 1; step <= 8; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: origin.x + (destination.x - origin.x) * step / 8, y: origin.y + (destination.y - origin.y) * step / 8 }] });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
        const after = await page.evaluate(() => {
            const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
            const apps = [...area.querySelectorAll(':scope > .desktop-layout-item.layout-app:not(.is-folder)')];
            return { monitor: getDesktopRawStyleRect(area.querySelector('[data-layout-id="app-monitor"]')), count: apps.length,
                clear: apps.every(item => [...area.querySelectorAll(':scope > .desktop-layout-item')].filter(other => other !== item).every(other => desktopAppRectsHaveClearance(getDesktopRawStyleRect(item), getDesktopRawStyleRect(other)))) };
        });
        assert.equal(after.monitor.top, 328); assert.equal(after.monitor.left, 108);
        assert.equal(after.count, 9); assert.equal(after.clear, true);
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ before: { width: before.width, height: before.height, rows: [...new Set(before.slots.map(slot => slot.top))] }, transferred, after, errors }));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
