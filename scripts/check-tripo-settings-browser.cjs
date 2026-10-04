'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/tripo-settings');
const version = require('./bump-version.cjs').currentVersion();
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), checks = [];
    let requests = 0, bad = false;
    await page.route('https://**/*', async route => {
        if (route.request().url().endsWith('/mcp/relay/tripo/v3/account/balance')) {
            requests++;
            assert.equal(route.request().method(), 'GET');
            assert.equal(route.request().headers().authorization, 'Bearer browser-example-key');
            await route.fulfill({ status: bad ? 401 : 200, contentType: 'application/json', body: bad ? '{"code":2}' : '{"code":0,"data":{"balance":200}}' });
        } else await route.abort();
    });
    try {
        await page.addInitScript(version => {
            localStorage.setItem('bynd_lastSeenVersion', version);
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        }, version);
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openApp === 'function');
        await page.evaluate(async () => { await window.__byndCoreReady; unlockPhone(); ByndBuiltinLibrary?.close(); openApp('settings'); openSettingsTab('3d'); });
        await page.locator('#tripo-key').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#tripo-key').inputValue(), '');
        assert.equal(await page.locator('#tripo-key').getAttribute('type'), 'password');
        assert.equal(await page.locator('.tripo-heading a').getAttribute('href'), 'https://developers.tripo3d.ai/en/keys');
        await page.locator('#tripo-key').fill('browser-example-key');
        await page.locator('.tripo-save').click();
        await page.locator('#tripo-test').click();
        await page.waitForFunction(() => document.getElementById('tripo-status').textContent.includes('连接成功'));
        assert.equal(requests, 1);
        assert.equal(await page.evaluate(() => getBackupLocalStorageKeys().includes(ByndTripo.storageKey)), false);
        await page.screenshot({ path: path.join(output, 'connected-375.png') });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openApp === 'function');
        await page.evaluate(async () => { await window.__byndCoreReady; unlockPhone(); openApp('settings'); openSettingsTab('3d'); });
        await page.waitForTimeout(400);
        assert.equal(await page.locator('#tripo-key').inputValue(), 'browser-example-key');
        assert.equal(await page.locator('#tripo-key').getAttribute('type'), 'password');
        bad = true;
        await page.locator('#tripo-test').click();
        await page.waitForFunction(() => document.getElementById('tripo-status').dataset.error === 'true');
        assert.equal((await page.locator('#tripo-status').textContent()).includes('browser-example-key'), false);
        await page.addStyleTag({ content: '#app-settings-window { transition: none !important; }' });
        for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => {
                const phone = document.querySelector('.phone-container');
                document.documentElement.classList.add('mobile-runtime');
                document.body.style.paddingTop = owner === 'parent' ? safe + 'px' : '0px';
                phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? safe + 'px' : '0px');
                phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
                document.querySelector('#app-settings-window .window-content').scrollTop = 0;
            }, { safe, owner });
            await page.waitForTimeout(100);
            const layout = await page.evaluate(() => {
                const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width }; };
                const card = document.querySelector('.tripo-settings');
                return { close: rect('#app-settings-window .close-btn'), key: rect('#tripo-key'), card: rect('.tripo-settings'), scrollWidth: card.scrollWidth };
            });
            assert.ok(layout.close.top >= safe, JSON.stringify({ width, safe, owner, layout }));
            assert.ok(layout.key.left >= 0 && layout.key.right <= width + 1, JSON.stringify(layout));
            assert.ok(layout.scrollWidth <= layout.card.width + 1, JSON.stringify(layout));
            checks.push({ width, safe, owner, layout });
            await page.screenshot({ path: path.join(output, `${width}-${safe}-${owner}.png`) });
        }
        await page.locator('.tripo-guide summary').click();
        assert.equal(await page.locator('.tripo-guide a[href="https://platform.tripo3d.ai/billing"]').count(), 1);
        assert.match(await page.locator('.tripo-guide').innerText(), /Add to credit balance/);
        assert.match(await page.locator('.tripo-guide').innerText(), /14 天.*valid until/);
        await page.locator('.tripo-guide').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'trial-guide-375.png') });
        await page.locator('.tripo-clear').click();
        assert.equal(await page.evaluate(() => localStorage.getItem(ByndTripo.storageKey)), null);
        assert.equal(await page.locator('#tripo-key').inputValue(), '');
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ requests, checks }, null, 2));
        console.log('Tripo settings: save/reload, masked keys, read-only balance, failure, backup exclusion, clear and 8 narrow-screen safe-area layouts passed.');
    } catch (error) {
        console.error({ requests, status: await page.locator('#tripo-status').textContent().catch(() => ''), keyLength: (await page.locator('#tripo-key').inputValue().catch(() => '')).length });
        await page.screenshot({ path: path.join(output, 'failure.png') });
        throw error;
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
