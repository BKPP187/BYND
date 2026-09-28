'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/desktop-folder');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const checks = [];
    try {
        for (const touch of [false, true]) {
            const context = await browser.newContext({ viewport: touch ? { width: 375, height: 844 } : { width: 1699, height: 901 }, hasTouch: touch });
            const page = await context.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof enterEditMode === 'function');
            await page.evaluate(async () => {
                await byndStylesReady; unlockPhone(); await new Promise(resolve => setTimeout(resolve, 250)); enterEditMode();
                const area = ensureDesktopPage(1).querySelector('.desktop-scroll-area');
                const spare = ensureDesktopPage(3).querySelector('.desktop-scroll-area');
                [...area.querySelectorAll(':scope > .desktop-layout-item')].forEach(item => spare.appendChild(item));
                prepareDesktopLayoutItem(document.querySelector('[data-layout-id="custom-lovely-default"]'), area, { left: 16, top: 72, width: 327, height: 248 });
                ['pet', 'mcp', 'living-world', 'outing', 'monitor', 'dream', 'coread', 'manual'].forEach((id, i) => {
                    const app = document.querySelector('.desktop-layout-item[data-layout-id="app-' + id + '"]') || createDesktopAppElement(getDesktopAnyAppDefinition(id));
                    prepareDesktopLayoutItem(app, area, { left: [12, 100, 187, 275][i % 4], top: i < 4 ? 328 : 418, width: 72, height: 82 });
                });
                captureDesktopPageSlotRects(area); goToDesktopPage(1);
            });
            await page.waitForTimeout(300);
            const cdp = touch ? await context.newCDPSession(page) : null;
            async function pointer(type, point) {
                if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touch' + type, touchPoints: ['End', 'Cancel'].includes(type) ? [] : [point] });
                else if (type === 'Start') { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
                else if (type === 'Move') await page.mouse.move(point.x, point.y, { steps: 8 });
                else await page.mouse.up();
            }
            const rect = id => page.evaluate(id => getDesktopRawStyleRect(getDesktopPages()[1].querySelector('.desktop-scroll-area').querySelector(':scope > [data-layout-id="' + id + '"]')), id);
            const icon = id => page.locator('.desktop-layout-item[data-layout-id="' + id + '"] .app-icon').boundingBox();
            const centre = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
            async function denyFolderWrite(action) {
                await page.evaluate(() => {
                    window._folderOriginalSetItem = Storage.prototype.setItem;
                    Storage.prototype.setItem = function(key, value) {
                        if (key === DESKTOP_FOLDER_STORAGE_KEY) throw new DOMException('Storage full', 'QuotaExceededError');
                        return window._folderOriginalSetItem.call(this, key, value);
                    };
                });
                try { await action(); } finally {
                    await page.evaluate(() => { Storage.prototype.setItem = window._folderOriginalSetItem; delete window._folderOriginalSetItem; });
                }
            }
            const manualBefore = await rect('app-manual'), coreadBefore = await rect('app-coread');
            await denyFolderWrite(async () => {
                await pointer('Start', centre(await icon('app-manual'))); await pointer('Move', centre(await icon('app-coread'))); await pointer('End');
            });
            await page.waitForTimeout(250);
            assert.equal(await page.evaluate(() => window._folders.length), 0, 'failed creation must not leave phantom membership');
            assert.deepEqual(await rect('app-manual'), manualBefore); assert.deepEqual(await rect('app-coread'), coreadBefore);
            assert.equal(await page.locator('.desktop-folder-drop-hint, .desktop-folder-merge-target, .desktop-layout-dragging').count(), 0);
            const targetBefore = await rect('app-living-world');
            const target = await icon('app-living-world'), source = await icon('app-monitor');
            await pointer('Start', centre(source));
            await pointer('Move', { x: target.x + target.width / 2, y: target.y + target.height + 8 });
            assert.deepEqual(await rect('app-living-world'), targetBefore, 'destination must stay still when approaching its cell');
            await pointer('Move', centre(target));
            assert.equal(await page.locator('.desktop-folder-drop-hint').textContent(), '松开组成文件夹');
            assert.deepEqual(await rect('app-living-world'), targetBefore, 'destination must stay still while merge is indicated');
            await page.screenshot({ path: path.join(output, touch ? 'merge-cue-touch.png' : 'merge-cue-mouse.png') });
            await pointer('End'); // No dwell delay: release immediately after entering the centre.
            await page.waitForTimeout(450);
            if (!await page.locator('.desktop-layout-item.is-folder').count()) console.log('Folder drop diagnostic', errors, await page.evaluate(() => ({ folders: window._folders, apps: [...getDesktopPages()[1].querySelector('.desktop-scroll-area').querySelectorAll(':scope > .desktop-layout-item')].map(item => ({ id: item.dataset.layoutId, class: item.className, rect: getDesktopRawStyleRect(item) })) })));
            const created = await page.evaluate(() => {
                const folder = window._folders[0], item = getDesktopPages()[1].querySelector('.desktop-scroll-area').querySelector(':scope > .is-folder');
                return { folder, id: item.dataset.layoutId, rect: getDesktopRawStyleRect(item) };
            });
            assert.deepEqual(created.folder.apps.map(app => app.id).sort(), ['living-world', 'monitor']);
            assert.deepEqual(created.rect, targetBefore, 'new folder stays at the destination instead of rearranging the desktop');
            // Off-centre pickup must use the projected icon centre, not the finger location.
            const dream = await icon('app-dream'), folderBox = await icon(created.id);
            const pickup = { x: dream.x + 8, y: dream.y + 8 };
            const drop = { x: folderBox.x + folderBox.width / 2 - (dream.width / 2 - 8), y: folderBox.y + folderBox.height / 2 - (dream.height / 2 - 8) };
            await pointer('Start', pickup); await pointer('Move', drop);
            assert.equal(await page.locator('.desktop-folder-drop-hint').textContent(), '松开放入文件夹');
            await pointer('End'); await page.waitForTimeout(450);
            assert.deepEqual(await rect(created.id), created.rect);
            assert.deepEqual(await page.evaluate(() => window._folders[0].apps.map(app => app.id).sort()), ['dream', 'living-world', 'monitor']);
            const deniedMcpBefore = await rect('app-mcp');
            await denyFolderWrite(async () => {
                await pointer('Start', centre(await icon('app-mcp'))); await pointer('Move', centre(await icon(created.id))); await pointer('End');
            });
            await page.waitForTimeout(250);
            assert.deepEqual(await rect('app-mcp'), deniedMcpBefore);
            assert.equal(await page.evaluate(() => window._folders[0].apps.length), 3, 'failed addition must restore membership and retain the loose icon');
            // Aborting a touch or mouse drag must clear the cue without changing membership.
            const mcpBefore = await rect('app-mcp'), mcp = await icon('app-mcp'), folderNow = await icon(created.id);
            await pointer('Start', centre(mcp)); await pointer('Move', centre(folderNow));
            assert.equal(await page.locator('.desktop-folder-drop-hint').count(), 1);
            if (touch) await pointer('Cancel');
            else {
                await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })));
                await pointer('End');
            }
            await page.waitForTimeout(250);
            assert.equal(await page.locator('.desktop-folder-drop-hint, .desktop-folder-merge-target').count(), 0);
            assert.deepEqual(await rect('app-mcp'), mcpBefore);
            assert.equal(await page.evaluate(() => window._folders[0].apps.length), 3);
            // A centre merge near the page edge wins over the edge paging timer,
            // including when the icon was picked up at its left corner.
            const edgeSource = await icon('app-mcp'), edgeTarget = await icon('app-pet');
            await pointer('Start', { x: edgeSource.x + 8, y: edgeSource.y + 8 });
            await pointer('Move', { x: edgeTarget.x + edgeTarget.width / 2 - (edgeSource.width / 2 - 8), y: edgeTarget.y + edgeTarget.height / 2 - (edgeSource.height / 2 - 8) });
            await page.waitForTimeout(900);
            assert.equal(await page.evaluate(() => getDesktopPageIndex(document.querySelector('.desktop-layout-item[data-layout-id="app-mcp"]').closest('.desktop-page'))), 1);
            assert.equal(await page.locator('.desktop-folder-drop-hint').textContent(), '松开组成文件夹');
            await pointer('End'); await page.waitForTimeout(450);
            assert.deepEqual(await page.evaluate(() => window._folders[1].apps.map(app => app.id).sort()), ['mcp', 'pet']);
            await page.evaluate(() => { saveDesktopLayout(); exitEditMode(true); });
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof unlockPhone === 'function');
            await page.evaluate(async () => { await byndStylesReady; unlockPhone(); goToDesktopPage(1); });
            await page.waitForTimeout(300);
            const saved = await page.evaluate(id => {
                const area = getDesktopPages()[1].querySelector('.desktop-scroll-area'), items = [...area.querySelectorAll(':scope > .desktop-layout-item')];
                const item = area.querySelector(':scope > [data-layout-id="' + id + '"]');
                return { folders: window._folders, rect: getDesktopRawStyleRect(item), duplicates: items.filter(item => ['app-monitor', 'app-dream', 'app-living-world'].includes(item.dataset.layoutId)).length,
                    clear: items.filter(item => item.classList.contains('layout-app')).every(item => items.filter(other => other !== item).every(other => desktopAppRectsHaveClearance(getDesktopRawStyleRect(item), getDesktopRawStyleRect(other)))) };
            }, created.id);
            if (!saved.rect || saved.duplicates) console.log('Reload folder diagnostic', created, saved, await page.evaluate(() => ({ layout: localStorage.getItem(DESKTOP_LAYOUT_KEY), folderItems: [...document.querySelectorAll('.desktop-layout-item.is-folder')].map(item => ({ id: item.dataset.layoutId, page: getDesktopPageIndex(item.closest('.desktop-page')), rect: getDesktopRawStyleRect(item) })) })));
            assert.deepEqual(saved.rect, created.rect); assert.equal(saved.duplicates, 0); assert.equal(saved.clear, true);
            assert.deepEqual(saved.folders[0].apps.map(app => app.id).sort(), ['dream', 'living-world', 'monitor']);
            assert.deepEqual(saved.folders[1].apps.map(app => app.id).sort(), ['mcp', 'pet']);
            await page.screenshot({ path: path.join(output, touch ? 'folder-touch.png' : 'folder-mouse.png') });
            const folderLocator = page.locator('.desktop-layout-item[data-layout-id="' + created.id + '"] .app-icon');
            if (touch) await folderLocator.tap(); else await folderLocator.click();
            await page.waitForTimeout(250);
            assert.equal(await page.locator('#folder-overlay').evaluate(el => el.classList.contains('hidden')), false);
            assert.deepEqual((await page.locator('#folder-grid .folder-grid-item').evaluateAll(items => items.map(item => item.dataset.appId))).sort(), ['dream', 'living-world', 'monitor']);
            assert.equal(await page.locator('#folder-overlay .folder-size-toggle, #folder-overlay .folder-move-out-btn, #folder-overlay .folder-resize-handle').count(), 0,
                'normal viewing does not expose folder editing controls');
            await page.screenshot({ path: path.join(output, touch ? 'folder-open-touch.png' : 'folder-open-mouse.png') });
            await page.evaluate(id => {
                const before = window._folders.find(folder => folder.id === id).size;
                toggleDesktopFolderSize(id);
                if (window._folders.find(folder => folder.id === id).size !== before) throw new Error('folder size changed outside edit mode');
                closeFolderOverlay(); enterEditMode(); goToDesktopPage(1);
            }, created.folder.id);
            if (touch) await folderLocator.tap(); else await folderLocator.click();
            await page.waitForTimeout(150);
            assert.equal(await page.locator('#folder-overlay').evaluate(el => el.classList.contains('hidden')), false,
                'folder editing controls are shown in the open folder');
            assert.equal(await page.locator('#folder-overlay .folder-size-toggle').isVisible(), true);
            assert.equal(await page.locator('#folder-overlay .folder-size-toggle').count(), 1);
            assert.equal(await page.locator('#folder-overlay .folder-move-out-btn').count(), 3);
            assert.equal(await page.locator('#folder-overlay .folder-resize-handle').count(), 1);
            await page.screenshot({ path: path.join(output, touch ? 'folder-edit-touch.png' : 'folder-edit-mouse.png') });
            await page.evaluate(() => exitEditMode(true));
            assert.equal(await page.locator('#folder-overlay').evaluate(el => el.classList.contains('hidden')), true,
                'leaving edit mode closes an open folder with editing controls');
            assert.deepEqual(errors, []); checks.push({ touch, created, saved, errors });
            if (cdp) await cdp.detach(); await context.close();
        }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(checks, null, 2));
    console.log('Mouse/native touch: stable destination, instant folder creation, off-centre addition, failed writes, cancellation and save/reload passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
