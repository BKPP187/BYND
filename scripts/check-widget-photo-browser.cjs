'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/widget-photo');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
        await page.route('https://**/*', route => route.abort());
        await page.addInitScript(() => {
            localStorage.setItem('bynd_onboarding_v1', '{"status":"skipped"}');
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        });
        const open = async () => {
            await page.evaluate(async () => {
                await __byndCoreReady; await byndStylesReady;
                document.documentElement.classList.add('mobile-runtime');
                unlockPhone(); ByndBuiltinLibrary?.close();
                document.getElementById('bynd-version-letter')?.remove();
                openApp('theme'); openThemeSection('desktop');
            });
            await page.locator('.desktop-widget-settings').waitFor({ state: 'visible' });
        };
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openThemeSection === 'function');
        await open();
        await page.addStyleTag({ content: '.app-window{transition:none!important}.tapfx-layer{display:none!important}' });
        const editor = page.locator('.desktop-widget-settings');
        const data = await page.evaluate(() => {
            const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 180;
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 160, 180);
            gradient.addColorStop(0, '#c5e2f3'); gradient.addColorStop(1, '#516b80');
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, 160, 180);
            ctx.fillStyle = '#e8f3f9'; ctx.beginPath(); ctx.arc(115, 38, 18, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#7895a7'; ctx.beginPath(); ctx.moveTo(0, 160); ctx.lineTo(58, 66); ctx.lineTo(160, 180); ctx.fill();
            return canvas.toDataURL('image/png');
        });
        const upload = slot => page.locator(`#file-desk-${slot}`).setInputFiles({ name: `photo-${slot}.png`, mimeType: 'image/png', buffer: Buffer.from(data.split(',')[1], 'base64') });
        const value = slot => page.locator(`#input-desk-img-${slot}`).inputValue();
        for (const slot of [1, 2]) {
            const chooser = page.waitForEvent('filechooser');
            await editor.locator('.widget-photo-change').nth(slot - 1).click();
            assert.equal(await (await chooser).element().getAttribute('id'), `file-desk-${slot}`);
            await upload(slot);
            await page.waitForFunction(slot => document.getElementById(`input-desk-img-${slot}`).value.startsWith('data:image/jpeg'), slot);
            await editor.locator('.widget-photo-preview img').nth(slot - 1).waitFor({ state: 'visible' });
        }
        const first = await value(1), second = await value(2);
        assert.equal(await editor.getByText(/data:image/).count(), 0, 'Image encoding must never be rendered as copy');
        for (const slot of [1, 2]) assert.equal(await page.locator(`#input-desk-img-${slot}`).isVisible(), false);
        // Invalid files must not replace an already selected photo.
        await page.locator('#file-desk-1').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
        await page.waitForFunction(() => document.querySelector('.widget-photo-picker [role="status"]')?.textContent.includes('失败') || document.querySelector('.widget-photo-picker [role="status"]')?.textContent.includes('无法'));
        assert.equal(await value(1), first);
        assert.equal(await value(2), second);
        await upload(1);
        await page.locator('#app-theme-window .save-btn').click();
        await page.locator('#theme-save-feedback').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#theme-save-feedback h2').innerText(), '保存成功');
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('my_theme_data')).d1), first);
        await page.locator('#theme-save-feedback button').click();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openThemeSection === 'function');
        await open();
        assert.equal(await value(1), first); assert.equal(await value(2), second);
        await page.waitForFunction(() => [...document.querySelectorAll('.widget-photo-preview img')].every(img => img.complete && img.naturalWidth > 0));
        let layouts = 0;
        for (const width of [320, 375, 430]) for (const font of ['Arial,sans-serif', 'Georgia,serif']) for (const dark of [false, true]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ font, dark }) => {
                setAppFontFamily(font);
                document.documentElement.setAttribute('data-bynd-tone', dark ? 'dark' : 'light');
                document.querySelector('#app-theme-window .window-content').scrollTop = 0;
            }, { font, dark });
            const result = await editor.evaluate(card => {
                const bounds = card.getBoundingClientRect();
                const items = [...card.querySelectorAll('.widget-config-item')];
                return {
                    overflow: card.scrollWidth > card.clientWidth + 1,
                    outside: [...card.querySelectorAll('.widget-photo-picker, .widget-photo-change, .bynd-sheet-trigger')].some(el => {
                        const b = el.getBoundingClientRect(); return b.left < bounds.left || b.right > bounds.right + 1;
                    }),
                    heights: items.map(el => el.getBoundingClientRect().height),
                    background: getComputedStyle(items[0]).backgroundColor,
                    buttons: [...card.querySelectorAll('.widget-photo-change')].every(el => el.getBoundingClientRect().height >= 43.5)
                };
            });
            assert.equal(result.overflow, false, JSON.stringify({ width, font, dark, result }));
            assert.equal(result.outside, false); assert.equal(result.buttons, true);
            assert.ok(result.heights.every(height => height < 240), `Compact editor: ${result.heights}`);
            assert.match(result.background, /^rgba\(/, 'Translucent card, including dark mode');
            if (width === 375 && font.startsWith('Arial')) await page.screenshot({ path: path.join(output, dark ? 'dark-375.png' : 'light-375.png'), animations: 'disabled' });
            layouts++;
        }
        console.log(`Widget photos: upload routing, invalid-image preservation, save/reload, hidden encoding and ${layouts} layouts passed.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
