'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/study');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => !!window.ByndStudy);
        await page.evaluate(async () => {
            await byndStylesReady;
            unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            openApp('study');
            ByndStudy.setTab('words');
            ByndStudy.setLearningView('cards');
        });
        await page.locator('.study-learn-card').waitFor();
        assert.match(await page.locator('.study-learn-card').innerText(), /少しずつ/);
        await page.locator('.study-learn-card button:has-text("详情")').click();
        await page.locator('#study-mnemonic-input').fill('把少しずつ和一点点联系起来');
        await page.locator('.study-learn-detail button:has-text("保存联想")').click();
        assert.equal(await page.evaluate(() => getStudyCards()[0].mnemonic), '把少しずつ和一点点联系起来');
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            const layout = await page.evaluate(() => {
                const app = document.getElementById('app-study-window');
                const head = app.querySelector('.study-topbar').getBoundingClientRect();
                const content = app.querySelector('.study-content').getBoundingClientRect();
                const nav = app.querySelector('.study-tabbar').getBoundingClientRect();
                return { overflow: app.scrollWidth > app.clientWidth, headBottom: head.bottom, contentTop: content.top, navLeft: nav.left, navRight: nav.right };
            });
            assert.equal(layout.overflow, false, `${width}px study has no horizontal overflow`);
            assert.ok(layout.contentTop >= layout.headBottom, `${width}px content clears header`);
            assert.ok(layout.navLeft >= 0 && layout.navRight <= width, `${width}px navigation fits`);
            if (width === 320 || width === 375) await page.screenshot({ path: path.join(output, `cards-${width}.png`), animations: 'disabled' });
        }
        await page.setViewportSize({ width: 320, height: 844 });
        await page.evaluate(() => { ByndStudy.setLearningView('guide'); ByndStudy.setFoundationLang('ja'); });
        assert.match(await page.locator('.study-foundation').innerText(), /平假名/);
        await page.screenshot({ path: path.join(output, 'guide-320.png'), animations: 'disabled' });
        await page.evaluate(() => { ByndStudy.setFoundationLang('th'); ByndStudy.setFoundationGroup(1); });
        assert.equal(await page.locator('.study-foundation-grid button').count(), 44, 'Thai full consonant chart is present');
        assert.equal(await page.evaluate(() => document.getElementById('app-study-window').scrollWidth > document.getElementById('app-study-window').clientWidth), false);
        await page.screenshot({ path: path.join(output, 'thai-chart-320.png'), animations: 'disabled' });
        await page.evaluate(() => ByndStudy.setFoundationLang('ja'));
        await page.evaluate(() => ByndStudy.setLearningView('trace'));
        const canvas = page.locator('#study-trace-canvas');
        const rect = await canvas.boundingBox();
        await page.mouse.move(rect.x + rect.width * .3, rect.y + rect.height * .4);
        await page.mouse.down();
        await page.mouse.move(rect.x + rect.width * .65, rect.y + rect.height * .55, { steps: 8 });
        await page.mouse.up();
        await page.screenshot({ path: path.join(output, 'trace-320.png'), animations: 'disabled' });
        await page.locator('.study-trace-panel > button:has-text("完成描写")').click();
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('bynd_study_trace_v1')).ja['あ']), 1);
        const retryRect = await page.locator('#study-trace-canvas').boundingBox();
        await page.mouse.move(retryRect.x + retryRect.width * .3, retryRect.y + retryRect.height * .4);
        await page.mouse.down();
        await page.mouse.move(retryRect.x + retryRect.width * .6, retryRect.y + retryRect.height * .6, { steps: 5 });
        await page.mouse.up();
        const failedTrace = await page.evaluate(() => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'bynd_study_trace_v1') throw new Error('模拟写入失败');
                return original.call(this, key, value);
            };
            try { ByndStudy.finishTrace(); return document.querySelector('.study-status')?.textContent || ''; }
            finally { Storage.prototype.setItem = original; }
        });
        assert.match(failedTrace, /描写记录没有保存.*模拟写入失败/);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('bynd_study_trace_v1')).ja['あ']), 1);
        await page.evaluate(() => ByndStudy.setTab('review'));
        await page.screenshot({ path: path.join(output, 'focus-320.png'), animations: 'disabled' });
        const day = page.locator('.study-activity-grid button:not([disabled])').first();
        await day.click();
        assert.match(await day.getAttribute('class'), /selected/);
        assert.match(await page.locator('.study-activity-detail').innerText(), /轮专注/);
        await page.evaluate(() => { ByndStudy.startFocus(); ByndStudy.tickFocus(Date.now() + 5000); ByndStudy.pauseFocus(); });
        assert.ok((await page.evaluate(() => Object.values(ByndStudy.getFocusData().days)[0].seconds)) >= 5);
        assert.deepEqual(errors, []);
        console.log(`Study browser checks passed; screenshots in ${output}`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
