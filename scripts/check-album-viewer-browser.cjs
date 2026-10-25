'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/album-viewer');
fs.mkdirSync(output, { recursive: true });
const photo = (label, color) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="${color}"/><circle cx="300" cy="400" r="120" fill="#fff" opacity=".5"/><text x="300" y="420" text-anchor="middle" font-size="64" fill="#fff">${label}</text></svg>`);

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openApp === 'function');
        await page.evaluate(async photos => {
            await window.__byndCoreReady; await window.byndStylesReady;
            unlockPhone(); ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime');
            if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
            let char = window.myCharacters.find(item => !item.isGroupChat);
            if (!char) { char = { id: 'qa_album_char', name: '测试角色', history: [], chatConfig: {} }; window.myCharacters.push(char); }
            char.chatConfig = char.chatConfig || {};
            char.chatConfig.generatedImages = photos.map((url, index) => ({ id: `qa_photo_${index}`, charId: char.id, charName: char.name, url, description: `第 ${index + 1} 张测试照片`, createdAt: Date.now() - index * 60000 }));
            openApp('album');
        }, [photo('一', '#6b8f7a'), photo('二', '#b07a8f'), photo('三', '#5f6f9c')]);
        await page.addStyleTag({ content: '.app-window{transition:none!important;animation:none!important}' });
        await page.locator('[data-open-photo="qa_photo_0"]').waitFor();
        await page.screenshot({ path: path.join(output, 'grid.png') });
        await page.locator('[data-open-photo="qa_photo_0"]').click();
        await page.locator('.album-viewer').waitFor();
        assert.equal(await page.locator('.album-viewer-count').innerText(), '1 / 3');
        const cover = await page.locator('.album-viewer').evaluate(node => { const r = node.getBoundingClientRect(); return { w: r.width, h: r.height }; });
        assert.ok(cover.w >= 374 && cover.h >= 800, JSON.stringify(cover));
        await page.screenshot({ path: path.join(output, 'viewer.png') });

        const stage = page.locator('.album-viewer-stage');
        const swipe = async (from, to) => {
            await stage.dispatchEvent('pointerdown', { pointerId: 1, clientX: from, clientY: 400, isPrimary: true, pointerType: 'touch' });
            for (let step = 1; step <= 5; step++) await stage.dispatchEvent('pointermove', { pointerId: 1, clientX: from + (to - from) * step / 5, clientY: 400, pointerType: 'touch' });
            await stage.dispatchEvent('pointerup', { pointerId: 1, clientX: to, clientY: 400, pointerType: 'touch' });
            await page.waitForTimeout(320);
        };
        await swipe(300, 80);
        assert.equal(await page.locator('.album-viewer-count').innerText(), '2 / 3');
        await swipe(80, 320);
        assert.equal(await page.locator('.album-viewer-count').innerText(), '1 / 3');
        await swipe(80, 320);
        assert.equal(await page.locator('.album-viewer-count').innerText(), '1 / 3', 'first photo stays put');

        // Two taps 80ms apart, timed inside the page so the round trips do not stretch the gap.
        const doubleTap = (x, y) => page.evaluate(({ x, y }) => new Promise(resolve => {
            const el = document.querySelector('.album-viewer-stage');
            const tap = () => { for (const type of ['pointerdown', 'pointerup']) el.dispatchEvent(new PointerEvent(type, { pointerId: 2, clientX: x, clientY: y, pointerType: 'touch', bubbles: true })); };
            tap(); setTimeout(() => { tap(); resolve(); }, 80);
        }), { x, y });
        await doubleTap(190, 400);
        await page.waitForTimeout(260);
        assert.equal(await page.locator('.album-viewer').evaluate(node => node.classList.contains('is-zoomed')), true, 'double tap zooms');
        await page.screenshot({ path: path.join(output, 'zoomed.png') });
        // A one-finger drag while zoomed pans instead of changing photo.
        await swipe(300, 80);
        assert.equal(await page.locator('.album-viewer-count').innerText(), '1 / 3');
        await doubleTap(190, 400); await page.waitForTimeout(260);
        assert.equal(await page.locator('.album-viewer').evaluate(node => node.classList.contains('is-zoomed')), false, 'double tap again restores');

        // Pinch with two pointers.
        await stage.dispatchEvent('pointerdown', { pointerId: 3, clientX: 150, clientY: 400, pointerType: 'touch' });
        await stage.dispatchEvent('pointerdown', { pointerId: 4, clientX: 230, clientY: 400, pointerType: 'touch' });
        await stage.dispatchEvent('pointermove', { pointerId: 3, clientX: 90, clientY: 400, pointerType: 'touch' });
        await stage.dispatchEvent('pointermove', { pointerId: 4, clientX: 290, clientY: 400, pointerType: 'touch' });
        const pinched = await page.locator('.album-viewer-slide[data-offset="0"] img').evaluate(img => img.style.transform);
        assert.match(pinched, /scale\(2\.5\)/, pinched);
        await stage.dispatchEvent('pointerup', { pointerId: 3, clientX: 90, clientY: 400, pointerType: 'touch' });
        await stage.dispatchEvent('pointerup', { pointerId: 4, clientX: 290, clientY: 400, pointerType: 'touch' });

        await page.locator('.album-viewer-reset').click();
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('.album-viewer-count').innerText(), '2 / 3');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.album-viewer').count(), 0);
        await page.locator('[data-open-photo="qa_photo_2"]').click();
        assert.equal(await page.locator('.album-viewer-count').innerText(), '3 / 3');
        await page.locator('.album-viewer-close').click();
        assert.equal(await page.locator('.album-viewer').count(), 0);
        assert.deepEqual(errors, []);
        console.log('album viewer browser check passed');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
