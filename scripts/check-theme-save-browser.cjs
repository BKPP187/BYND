'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/theme-save');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
    let nativeDialogs = 0;
    page.on('dialog', async dialog => { nativeDialogs++; await dialog.dismiss(); });
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
        await page.waitForFunction(() => typeof saveTheme === 'function' && typeof unlockPhone === 'function');
        await page.evaluate(async () => {
            await byndStylesReady;
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            document.documentElement.classList.add('mobile-runtime');
            unlockPhone();
            window.ByndBuiltinLibrary?.close();
            openApp('theme');
        });
        const dialog = page.locator('#theme-save-feedback');
        const save = () => page.locator('#app-theme-window .save-btn').click();
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            for (const safe of [47, 59]) {
                for (const parentReservesSafeArea of [false, true]) {
                    await page.evaluate(({ safe, parentReservesSafeArea }) => {
                        const phone = document.querySelector('.phone-container');
                        phone.style.setProperty('--bynd-header-safe-top', parentReservesSafeArea ? '0px' : `${safe}px`);
                        phone.style.marginTop = parentReservesSafeArea ? `${safe}px` : '0';
                        phone.style.height = `calc(100dvh - ${parentReservesSafeArea ? safe : 0}px)`;
                        openApp('theme');
                    }, { safe, parentReservesSafeArea });
                    await save();
                    await dialog.waitFor({ state: 'visible' });
                    assert.equal(await dialog.locator('h2').innerText(), '保存成功');
                    assert.equal(await dialog.locator('button').evaluate(node => node === document.activeElement), true);
                    const bounds = await dialog.boundingBox();
                    assert.ok(bounds.x >= 20 && bounds.x + bounds.width <= width - 20);
                    assert.ok(bounds.y > safe && bounds.y + bounds.height < 844);
                    assert.ok(await page.evaluate(() => !!JSON.parse(localStorage.getItem('my_theme_data'))));
                    if (width === 375 && safe === 59 && !parentReservesSafeArea) {
                        await page.screenshot({ path: path.join(output, 'success-375.png') });
                    }
                    await dialog.locator('button').click();
                    await dialog.waitFor({ state: 'detached' });
                    assert.equal(await page.locator('#app-theme-window').evaluate(node => node.classList.contains('active')), false);
                }
            }
        }

        const previous = await page.evaluate(() => localStorage.getItem('my_theme_data'));
        for (const name of ['QuotaExceededError', 'SecurityError']) {
            await page.evaluate(name => {
                openApp('theme');
                window._themeProofSetItem = Storage.prototype.setItem;
                Storage.prototype.setItem = function (key, value) {
                    if (key === 'my_theme_data') throw new DOMException('QA storage failure', name);
                    return window._themeProofSetItem.call(this, key, value);
                };
            }, name);
            await save();
            await dialog.waitFor({ state: 'visible' });
            assert.equal(await dialog.locator('h2').innerText(), '暂时无法保存');
            assert.equal(await page.evaluate(() => localStorage.getItem('my_theme_data')), previous);
            assert.equal(await page.locator('#app-theme-window').evaluate(node => node.classList.contains('hidden')), false);
            if (name === 'QuotaExceededError') {
                assert.match(await dialog.innerText(), /存储空间不足/);
                await page.setViewportSize({ width: 375, height: 844 });
                await page.screenshot({ path: path.join(output, 'failure-375.png') });
                await dialog.locator('button').click();
            } else {
                await page.keyboard.press('Escape');
            }
            await dialog.waitFor({ state: 'detached' });
            assert.equal(await page.locator('#app-theme-window').evaluate(node => node.classList.contains('hidden')), false);
            await page.evaluate(() => { Storage.prototype.setItem = window._themeProofSetItem; });
        }
        await save();
        await dialog.waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        assert.equal(await page.locator('#app-theme-window').evaluate(node => node.classList.contains('active')), false);
        assert.equal(nativeDialogs, 0, 'saving must never open a native alert');
        console.log('Theme save browser checks passed: narrow screens, safe areas, success, storage failures, keyboard dismissal and retry.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
