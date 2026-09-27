'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/desktop-grid');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const results = [];
    try {
        for (const width of [320, 375, 430]) {
            const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true });
            const page = await context.newPage();
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
            await page.waitForFunction(() => typeof enterEditMode === 'function');
            await page.evaluate(async () => { await byndStylesReady; unlockPhone(); });
            await page.waitForTimeout(250);
            await page.evaluate(() => {
                enterEditMode();
                const target = ensureDesktopPage(1).querySelector('.desktop-scroll-area');
                const spare = ensureDesktopPage(3).querySelector('.desktop-scroll-area'); spare.classList.add('layout-canvas');
                [...target.querySelectorAll(':scope > .desktop-layout-item')].forEach(item => spare.appendChild(item));
                const grab = id => document.querySelector('.desktop-layout-item[data-layout-id="app-' + id + '"]') || createDesktopAppElement(getDesktopAnyAppDefinition(id));
                const lovely = document.querySelector('[data-layout-id="custom-lovely-default"]');
                prepareDesktopLayoutItem(lovely, target, { left: 18, top: 48, width: target.clientWidth - 36, height: 248 });
                const m = getDesktopFourColumnAppGridMetrics(target);
                ['dream', 'monitor', 'coread', 'manual', 'pet', 'mcp'].forEach((id, i) => prepareDesktopLayoutItem(grab(id), target, {
                    left: Math.round(m.startX + (i % 4) * (m.iconWidth + m.gapX)), top: i < 4 ? 394 : i === 4 ? 484 : 505, width: m.iconWidth, height: 82
                }));
                localStorage.setItem('bynd_desktop_page2_custom_v1', '1');
                repairDesktopAppOverlaps(target); captureDesktopPageSlotRects(target); goToDesktopPage(1);
            });
            await page.waitForTimeout(250);
            const initial = await page.evaluate(() => {
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
                const iconTop = id => area.querySelector('[data-layout-id="app-' + id + '"] .app-icon').getBoundingClientRect().top;
                return { capacity: ensureDesktopPageSlotRects(area).length, aligned: Math.abs(iconTop('pet') - iconTop('mcp')), height: area.clientHeight };
            });
            assert.equal(initial.capacity, 12); assert.equal(initial.height, 590); assert.ok(initial.aligned < 1);
            async function drag(id, index, touch = false) {
                const start = await page.locator('.desktop-layout-item[data-layout-id="app-' + id + '"] .app-icon').boundingBox();
                const end = await page.evaluate(index => {
                    const area = getDesktopPages()[1].querySelector('.desktop-scroll-area'), slot = ensureDesktopPageSlotRects(area)[index];
                    const frame = area.getBoundingClientRect(), scale = frame.width / area.clientWidth;
                    return { x: frame.left + (slot.left + slot.width / 2) * scale, y: frame.top + (slot.top + 67) * scale };
                }, index);
                const x = start.x + start.width / 2, y = start.y + start.height / 2;
                if (touch) {
                    const cdp = await context.newCDPSession(page);
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                    await cdp.detach();
                } else {
                    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(end.x, end.y); await page.mouse.up();
                }
                await page.waitForTimeout(250);
                const state = await page.evaluate(id => {
                    const area = getDesktopPages()[1].querySelector('.desktop-scroll-area'), item = area.querySelector('[data-layout-id="app-' + id + '"]');
                    return { rect: getDesktopRawStyleRect(item), slot: ensureDesktopPageSlotRects(area)[Number(item.dataset.desktopSlot)], index: Number(item.dataset.desktopSlot) };
                }, id);
                if (state.index !== index) console.log('Drop diagnostic', errors, JSON.stringify(await page.evaluate(index => {
                    const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
                    const slot = ensureDesktopPageSlotRects(area)[index];
                    return { slot, items: [...area.querySelectorAll(':scope > .desktop-layout-item')].map(item => ({ id: item.dataset.layoutId, slot: item.dataset.desktopSlot, rect: getDesktopRawStyleRect(item), footprint: getDesktopTransferFootprint(item, area), clear: desktopAppRectsHaveClearance(slot, getDesktopTransferFootprint(item, area)) })) };
                }, index)));
                assert.equal(state.index, index); assert.deepEqual(state.rect, state.slot);
            }
            await drag('mcp', 2); // Empty first row, beyond the old occupied-slot table.
            await drag('monitor', 11, true); // Native touch into an empty third-row cell.
            const fill = ['comic', 'outing', 'game', 'theme', 'role-tools', 'home3d'];
            for (const id of fill) await page.evaluate(id => {
                const item = document.querySelector('.desktop-layout-item[data-layout-id="app-' + id + '"]');
                selectDesktopLayoutItem(item);
                if (!moveSelectedDesktopItemToOtherPage(1)) throw new Error('A real free cell was rejected for ' + id);
            }, id);
            await page.waitForTimeout(250);
            const full = await page.evaluate(() => {
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area');
                const apps = [...area.querySelectorAll(':scope > .desktop-layout-item.layout-app')];
                const tops = apps.map(item => getDesktopRawStyleRect(item).top);
                return { count: apps.length, rows: [...new Set(tops)].map(top => tops.filter(value => value === top).length), clear: apps.every(item => [...area.querySelectorAll(':scope > .desktop-layout-item')].filter(other => other !== item).every(other => getDesktopRectIntersectionRatio(getDesktopTransferFootprint(item, area), getDesktopTransferFootprint(other, area)) === 0)) };
            });
            assert.equal(full.count, 12); assert.deepEqual(full.rows.sort(), [4, 4, 4]); assert.equal(full.clear, true);
            const denied = await page.evaluate(() => {
                const item = document.querySelector('.desktop-layout-item[data-layout-id="app-settings"]'), source = item.parentElement;
                selectDesktopLayoutItem(item);
                return { moved: moveSelectedDesktopItemToOtherPage(1), kept: item.parentElement === source };
            });
            assert.equal(denied.moved, false); assert.equal(denied.kept, true);
            await drag('mcp', 5, true); // Occupied cell: exchange positions, preserve all twelve icons.
            await page.screenshot({ path: path.join(output, 'three-rows-' + width + '.png') });
            const before = await page.evaluate(() => { saveDesktopLayout(); return collectDesktopLayout().filter(item => item.page === 1); });
            await page.reload(); await page.waitForFunction(() => typeof unlockPhone === 'function');
            await page.evaluate(async () => { await byndStylesReady; unlockPhone(); });
            await page.waitForTimeout(350);
            const after = await page.evaluate(() => collectDesktopLayout().filter(item => item.page === 1));
            assert.deepEqual(after, before, 'saved rows survive reopening at width ' + width);
            assert.deepEqual(errors, []);
            results.push({ width, capacity: initial.capacity, full, saved: true, nativeTouch: true });
            await context.close();
        }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(results, null, 2));
    console.log('Three-row grid, empty-cell dragging, native touch, full-grid collision and persistence passed at 320/375/430px.');
})().catch(error => { console.error(error); process.exitCode = 1; });
