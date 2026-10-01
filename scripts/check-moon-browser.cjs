'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/moon');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => !!window.ByndMoon && !!window.ByndLifeState);
        await page.evaluate(async () => {
            await byndStylesReady;
            unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'moon-proof', name: '林间', history: [], chatConfig: {} }];
            openApp('moon');
            ByndBuiltinLibrary?.close();
        });
        await page.locator('#app-moon-window.active .moon-page[data-moon-page="home"]').waitFor();
        assert.equal(await page.locator('#moon-nav button').count(), 4, 'moon has four bottom navigation destinations');
        assert.equal(await page.locator('.moon-hero').count(), 0, 'old pink empty-state hero is removed');
        assert.equal((await page.locator('#moon-content').innerText()).includes('先记下这一次'), false, 'old empty-state heading is removed');

        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            const layout = await page.evaluate(() => {
                const nav = document.getElementById('moon-nav').getBoundingClientRect();
                const header = document.querySelector('#app-moon-window .moon-header').getBoundingClientRect();
                const content = document.getElementById('moon-content').getBoundingClientRect();
                return { overflow: document.documentElement.scrollWidth > innerWidth, navLeft: nav.left, navRight: nav.right, navBottom: nav.bottom, headerBottom: header.bottom, contentTop: content.top, contentBottom: content.bottom };
            });
            assert.equal(layout.overflow, false, `${width}px moon viewport has no horizontal overflow`);
            assert.ok(layout.navLeft >= 0 && layout.navRight <= width, `${width}px bottom navigation fits`);
            assert.ok(layout.contentTop >= layout.headerBottom && layout.contentBottom <= layout.navBottom, `${width}px content sits between header and navigation`);
            if (width === 375) await page.screenshot({ path: path.join(output, 'home-empty-375.png'), animations: 'disabled' });
            if (width === 320) await page.screenshot({ path: path.join(output, 'home-empty-320.png'), animations: 'disabled' });
        }
        await page.setViewportSize({ width: 375, height: 844 });
        await page.locator('[data-moon-tab="records"]').click();
        assert.equal(await page.locator('.moon-page').getAttribute('data-moon-page'), 'records');
        assert.equal(await page.locator('#moon-start').isVisible(), true);
        const start = await page.evaluate(() => {
            const current = window.ByndLifeState.localDate();
            return new Date(Date.parse(`${current}T12:00:00Z`) - 5 * 86400000).toISOString().slice(0, 10);
        });
        await page.locator('#moon-start').fill(start);
        await page.locator('.moon-record-form button[type="submit"]').click();
        assert.equal(await page.evaluate(() => ByndMoon.read().records.length), 1, 'record is persisted from the new tab');
        assert.match(await page.locator('#moon-status').innerText(), /记录已保存/);
        await page.screenshot({ path: path.join(output, 'records-375.png'), animations: 'disabled' });

        const failedSave = await page.evaluate(() => {
            document.getElementById('moon-start').value = ByndLifeState.localDate();
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === ByndMoon.storageKey) throw new Error('模拟写入失败');
                return original.call(this, key, value);
            };
            try {
                ByndMoon.saveFromForm();
                return document.getElementById('moon-status').textContent;
            } finally {
                Storage.prototype.setItem = original;
            }
        });
        assert.match(failedSave, /操作失败.*模拟写入失败/, 'failed storage write does not report a saved record');
        assert.equal(await page.evaluate(() => ByndMoon.read().records.length), 1, 'failed storage write leaves existing records intact');

        await page.locator('[data-moon-tab="companion"]').click();
        await page.locator('#moon-level').selectOption('overview');
        await page.locator('#moon-remind').check();
        await page.locator('.moon-actions .moon-primary').click();
        assert.equal(await page.evaluate(() => ByndMoon.grant(myCharacters[0]).level), 'overview', 'companion grant persists');
        assert.equal(await page.evaluate(() => ByndMoon.grant(myCharacters[0]).remind), true, 'reminder choice persists');
        await page.screenshot({ path: path.join(output, 'companion-375.png'), animations: 'disabled' });

        await page.locator('[data-moon-tab="settings"]').click();
        await page.locator('#moon-cycle').fill('28');
        await page.locator('#moon-lead').selectOption('4');
        await page.locator('.moon-page[data-moon-page="settings"] .moon-primary').click();
        assert.equal(await page.evaluate(() => ByndMoon.read().cycleLength), 28, 'cycle preference persists');
        assert.equal(await page.evaluate(() => ByndMoon.read().leadDays), 4, 'lead days persist');
        assert.equal(await page.locator('.moon-disclosure summary').isVisible(), true);
        await page.screenshot({ path: path.join(output, 'settings-375.png'), animations: 'disabled' });
        await page.setViewportSize({ width: 375, height: 500 });
        await page.locator('#moon-content').evaluate(node => { node.scrollTop = node.scrollHeight; });
        const scrollLayout = await page.evaluate(() => {
            const content = document.getElementById('moon-content');
            const last = content.querySelector('.moon-disclosure:last-child').getBoundingClientRect();
            const nav = document.getElementById('moon-nav').getBoundingClientRect();
            return { lastBottom: last.bottom, navTop: nav.top, scrolled: content.scrollTop > 0 };
        });
        assert.equal(scrollLayout.scrolled, true, 'settings page scrolls inside the fixed shell');
        assert.ok(scrollLayout.lastBottom <= scrollLayout.navTop, 'last settings control remains reachable above navigation');
        await page.setViewportSize({ width: 375, height: 844 });
        await page.locator('[data-moon-tab="home"]').click();
        assert.equal(await page.locator('.moon-summary-cell').count(), 2);
        await page.screenshot({ path: path.join(output, 'home-recorded-375.png'), animations: 'disabled' });
        assert.deepEqual(errors, [], 'moon navigation and saves have no browser errors');
        console.log('Moon browser checks passed: four-tab navigation, save failure, scroll reachability, persistence, and 320–430px layout.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
