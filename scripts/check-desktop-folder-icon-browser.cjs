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
        const result = await page.evaluate(async () => {
            await byndStylesReady; unlockPhone(); enterEditMode();
            const area = ensureDesktopPage(3).querySelector('.desktop-scroll-area');
            const folder = { id: 'folder_visual_check', name: '工具', size: 'small', apps: [{ id: 'mcp' }, { id: 'role-tools' }, { id: 'settings' }, { id: 'manual' }] };
            window._folders.push(folder);
            const folderItem = createDesktopFolderElement(folder);
            const appItem = createDesktopAppElement(getDesktopAnyAppDefinition('game'));
            prepareDesktopLayoutItem(folderItem, area, { left: 12, top: 328, width: 110, height: 120 });
            prepareDesktopLayoutItem(appItem, area, { left: 108, top: 328, width: 72, height: 82 });
            goToDesktopPage(3);
            const measure = item => {
                const rect = getDesktopRawStyleRect(item);
                const icon = item.querySelector(':scope > .app-icon');
                const label = item.querySelector(':scope > span');
                const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
                return { rect, outer: box(item), icon: box(icon), label: box(label), background: getComputedStyle(item).backgroundColor };
            };
            selectDesktopLayoutItem(folderItem);
            return { folder: measure(folderItem), app: measure(appItem), resizeHandles: folderItem.querySelectorAll(':scope > .desktop-resize-handle').length,
                miniBackgrounds: [...folderItem.querySelectorAll('.folder-mini-icon')].map(item => getComputedStyle(item).backgroundColor) };
        });
        const near = (a, b) => Math.abs(a - b) <= 1;
        assert.equal(result.folder.rect.width, 72); assert.equal(result.folder.rect.height, 82);
        assert.ok(near(result.folder.outer.width, result.app.outer.width));
        assert.ok(near(result.folder.outer.height, result.app.outer.height));
        assert.ok(near(result.folder.icon.width, result.app.icon.width));
        assert.ok(near(result.folder.icon.height, result.app.icon.height));
        assert.ok(near(result.folder.icon.top, result.app.icon.top));
        assert.ok(near(result.folder.label.top, result.app.label.top));
        assert.equal(result.resizeHandles, 0, 'small folders keep their standard icon size');
        assert.ok(result.miniBackgrounds.every(color => color === 'rgba(0, 0, 0, 0)'));
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.resolve(__dirname, '../artifacts/desktop-folder-small.png') });
        console.log(JSON.stringify(result));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
