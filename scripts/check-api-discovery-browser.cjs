'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/api-discovery');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const calls = [], errors = [];
    let imageFailure = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        const request = route.request(), url = request.url();
        if (url.startsWith('https://img.pipiwangcom.com/')) {
            calls.push({ url, method: request.method(), body: request.postDataJSON() });
            const generation = url.endsWith('/images/generations');
            return route.fulfill({ status: generation ? (imageFailure ? 503 : 200) : 401, contentType: 'application/json',
                body: JSON.stringify(generation ? (imageFailure ? { error: { message: 'upstream unavailable' } } : { data: [{ url: 'https://images.example/proof.png' }] }) : { detail: '未登录' }) });
        }
        if (url.startsWith('https://provider.example/')) {
            return route.fulfill({ status: url.endsWith('/api/v1/models') ? 200 : 404, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'image-model' }] }) });
        }
        return route.abort();
    });
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof testApiFromModal === 'function');
        await page.evaluate(async () => { await window.__byndCoreReady; await byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); openApp('settings'); });
        const cdp = await context.newCDPSession(page);
        for (const [width, safe, parentReserved] of [[320, 47, false], [375, 59, false], [320, 47, true], [375, 59, true]]) {
            await page.setViewportSize({ width, height: width === 320 ? 640 : 812 });
            await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: safe, bottom: 24, left: 0, right: 0 } });
            await page.evaluate(({ parentReserved }) => {
                document.documentElement.classList.add('mobile-runtime', 'bynd-ios');
                document.body.style.paddingTop = parentReserved ? 'env(safe-area-inset-top)' : '0';
                const phone = document.querySelector('.phone-container');
                phone.style.height = parentReserved ? 'calc(100dvh - env(safe-area-inset-top))' : '100dvh';
                phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : 'env(safe-area-inset-top)');
                openApiModal();
            }, { parentReserved });
            await page.locator('#api-edit-name').fill('生图测试');
            await page.locator('#api-edit-url').fill('https://img.pipiwangcom.com/v1');
            await page.locator('#api-edit-key').fill('test-key');
            await page.locator('#api-edit-modal button[onclick="testApiFromModal()"]').click();
            await page.waitForFunction(() => document.getElementById('api-test-result').textContent.includes('未验证'));
            assert.equal(await page.locator('#api-edit-url').inputValue(), 'https://img.pipiwangcom.com/api/v1');
            assert.equal(await page.locator('#api-edit-image-model').inputValue(), 'image-1');
            assert.equal(await page.locator('#api-edit-model').inputValue(), '');
            await page.waitForTimeout(350);
            const geometry = await page.locator('#api-edit-modal .wc-char-card').evaluate(card => {
                const bounds = card.getBoundingClientRect(), footer = card.querySelector('.wc-card-footer').getBoundingClientRect();
                return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, footerBottom: footer.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, overflow: card.scrollWidth > card.clientWidth + 1 };
            });
            assert.ok(geometry.left >= 0 && geometry.right <= width + 1 && geometry.bottom <= geometry.viewportHeight + 1 && !geometry.overflow, JSON.stringify(geometry));
            assert.ok(geometry.top >= safe && geometry.footerBottom <= geometry.viewportHeight - 24 + 1, JSON.stringify(geometry));
            await page.screenshot({ path: path.join(output, `api-${width}-safe-${safe}-parent-${parentReserved}.png`) });
        }
        await page.locator('#api-edit-modal button[onclick="saveApi()"]').click();
        const stored = await page.evaluate(() => getDefaultImageApi());
        assert.equal(stored.baseUrl, 'https://img.pipiwangcom.com/api/v1');
        assert.equal(stored.imageModel, 'image-1');
        assert.ok(calls.every(call => call.method === 'GET'), 'detection never starts image generation');
        const success = await page.evaluate(() => callWechatImageGenerationApi('a blue circle'));
        assert.equal(success.ok, true);
        assert.equal(calls.at(-1).url, 'https://img.pipiwangcom.com/api/v1/images/generations');
        imageFailure = true;
        const beforeFailure = calls.length;
        const failure = await page.evaluate(() => callWechatImageGenerationApi('a blue circle'));
        assert.equal(failure.ok, false);
        assert.equal(calls.length, beforeFailure + 1, 'upstream errors never silently retry a paid image request');
        await page.evaluate(() => openApiModal());
        await page.locator('#api-edit-url').fill('https://provider.example/v1');
        await page.locator('#api-edit-modal button[onclick="testApiFromModal()"]').click();
        await page.waitForFunction(() => document.getElementById('api-test-result').textContent.includes('连接成功'));
        assert.equal(await page.locator('#api-edit-url').inputValue(), 'https://provider.example/api/v1');
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ passed: true, screenshots: output, safeAreas: [47, 59], savedPathUsedByGeneration: true, failureNotRetried: true }));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
