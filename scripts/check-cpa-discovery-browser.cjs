'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/cpa-discovery');
fs.mkdirSync(output, { recursive: true });
if (!process.env.BYND_CPA_CONFIG) throw Error('Set BYND_CPA_CONFIG to the local CPA config; credentials are never printed.');
const config = fs.readFileSync(process.env.BYND_CPA_CONFIG, 'utf8');
const section = config.match(/^api-keys:\s*\r?\n([\s\S]*?)(?=^[A-Za-z]|$(?![\s\S]))/m)?.[1] || '';
const clientKey = section.match(/^\s*-\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!clientKey) throw Error('Expected a legacy client key in the local test configuration.');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [], calls = [];
    page.on('pageerror', error => errors.push(error.message));
    // Real local /models calls; fail any unexpected inference call without spending quota.
    await page.route('http://127.0.0.1:8317/**', async route => {
        const request = route.request(); calls.push({ url: request.url(), method: request.method() });
        if (request.method() === 'POST') return route.abort();
        return route.continue();
    });
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openApiModal === 'function');
        await page.evaluate(async () => { await window.__byndCoreReady; await byndStylesReady; unlockPhone(); window.ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime'); openApp('settings'); openApiModal(); });
        await page.locator('#api-edit-name').fill('CPA 测试');
        await page.locator('#api-edit-url').fill('http://127.0.0.1:8317');
        await page.locator('#api-edit-key').fill('invalid-test-key');
        await page.locator('#api-edit-modal button[onclick="testApiFromModal()"]').click();
        await page.waitForFunction(() => document.getElementById('api-test-result').textContent.includes('(401)'));
        await page.locator('.api-discovery-details summary').click();
        assert.match(await page.locator('.api-discovery-details').textContent(), /8317\/v1\/models：HTTP 401/);
        for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(await page.locator('#api-edit-modal .wc-char-card').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
            await page.screenshot({ path: path.join(output, `auth-error-${width}.png`) });
        }
        await page.locator('#api-edit-key').fill(clientKey);
        const startedAt = performance.now();
        await page.locator('#api-edit-modal button[onclick="testApiFromModal()"]').click();
        await page.waitForFunction(() => document.getElementById('api-test-result').textContent.includes('连接成功'));
        const elapsedMs = Math.round(performance.now() - startedAt);
        assert.ok(elapsedMs < 5000, `Local model discovery took ${elapsedMs}ms`);
        assert.match(await page.locator('#api-test-result').textContent(), /聊天和生图尚未实测/);
        assert.equal(await page.locator('#api-edit-url').inputValue(), 'http://127.0.0.1:8317/v1');
        const models = await page.locator('#api-edit-model option').count();
        assert.ok(models > 1);
        for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(() => window.ByndBuiltinLibrary?.close());
            await page.screenshot({ path: path.join(output, `auto-v1-success-${width}.png`) });
        }
        assert.ok(calls.some(call => call.url.endsWith('/v1/models')));
        assert.ok(calls.every(call => call.method === 'GET'), 'Discovery must not generate chat or images');
        assert.deepEqual(errors, []);
        console.log(`CPA discovery checks passed: real root /models=404 and /v1/models=401/200; valid client key auto-fills /v1 and loads ${models - 1} models in ${elapsedMs}ms. GET only; no chat or image generation.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
