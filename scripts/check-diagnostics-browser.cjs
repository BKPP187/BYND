'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/diagnostics');
const version = require('./bump-version.cjs').currentVersion();
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
    const checks = [];
    await page.route('https://**/*', async route => {
        if (route.request().url().includes('api.openai.com/v1/chat/completions')) await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"message":"private-chat-text secret-key-browser"}}' });
        else await route.abort();
    });
    try {
        await page.addInitScript(version => {
            localStorage.setItem('bynd_lastSeenVersion', version);
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            localStorage.setItem('my_api_data', JSON.stringify({ defaultId: 'test', apis: [{ id: 'test', model: 'test', apiKey: 'secret-key-browser', name: 'private-chat-text', baseUrl: 'https://api.openai.com/v1' }] }));
        }, version);
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndDiagnostics && typeof openApp === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window._wechatCharactersLoadPromise;
            unlockPhone(); window.ByndBuiltinLibrary?.close(); openApp('settings'); openSettingsTab('data');
            const result = await callChatApi([{ role: 'user', content: 'private-chat-text' }]);
            if (result.ok) throw new Error('Expected mocked HTTP failure');
        });
        await page.locator('.set-diagnostics-export').waitFor({ state: 'visible' });
        const pendingDownload = page.waitForEvent('download');
        await page.locator('.set-diagnostics-export').click();
        const download = await pendingDownload;
        const pack = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
        assert.equal(pack.format, 'BYND_REDACTED_DIAGNOSTICS');
        assert.equal(pack.appVersion, 'v' + version);
        assert.ok(pack.recentErrors.some(item => item.module === 'chat' && item.httpStatus === 401 && item.provider === 'openai'));
        for (const privateText of ['secret-key-browser', 'private-chat-text']) assert.equal(JSON.stringify(pack).includes(privateText), false);
        await page.locator('.set-diagnostics details').nth(0).locator('summary').click();
        await page.waitForFunction(() => document.getElementById('bynd-diagnostics-preview').textContent.includes('BYND_REDACTED_DIAGNOSTICS'));
        await page.locator('.set-diagnostics details').nth(0).locator('summary').click();

        await page.evaluate(async () => {
            window.myCharacters = [{ id: 'diagnostic-proof', name: '小林', history: [], chatConfig: {} }];
            if (await saveCharactersToStorage() !== true) throw new Error('Setup character save failed');
        });
        await page.locator('.set-diagnostics details').nth(1).locator('summary').click();
        await page.locator('#bynd-diagnostics-character').selectOption('diagnostic-proof');
        await page.evaluate(() => {
            window._diagnosticOriginalSave = window.saveCharactersToStorage;
            window.saveCharactersToStorage = async () => false;
        });
        await page.locator('.set-diagnostics details button').click();
        await page.waitForFunction(() => document.getElementById('bynd-diagnostics-status').textContent.includes('未发送'));
        assert.equal(await page.evaluate(() => window.myCharacters[0].history.length), 0);
        await page.evaluate(() => { window.saveCharactersToStorage = window._diagnosticOriginalSave; });
        await page.locator('.set-diagnostics details button').click();
        await page.waitForFunction(() => window.currentChatCharId === 'diagnostic-proof');
        const shared = await page.evaluate(async () => {
            const snapshot = await readWechatCharacterSnapshot();
            return snapshot.characters.find(char => char.id === 'diagnostic-proof').history.at(-1).content;
        });
        assert.match(shared, /BYND_REDACTED_DIAGNOSTICS/);
        assert.equal(shared.includes('secret-key-browser'), false);
        assert.equal(shared.includes('private-chat-text'), false);
        await page.evaluate(() => { openApp('settings'); openSettingsTab('data'); });
        await page.waitForTimeout(1600);
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
                document.querySelectorAll('.set-diagnostics details').forEach(node => { node.open = false; });
                document.getElementById('bynd-diagnostics-status').textContent = '';
            }, { safe, owner });
            await page.waitForTimeout(100);
            const layout = await page.evaluate(() => {
                const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width }; };
                return { close: rect('#app-settings-window .close-btn'), card: rect('.set-diagnostics'), button: rect('.set-diagnostics-export'), scrollWidth: document.querySelector('.set-diagnostics').scrollWidth };
            });
            assert.ok(layout.close.top >= safe - 1, JSON.stringify({ width, safe, owner, layout }));
            assert.ok(layout.card.left >= 0 && layout.card.right <= width + 1, JSON.stringify(layout));
            assert.ok(layout.scrollWidth <= layout.card.width + 1, JSON.stringify(layout));
            assert.ok(layout.button.bottom <= 844, 'export remains on first screen');
            checks.push({ width, safe, owner, layout });
            await page.screenshot({ path: path.join(output, `${width}-${safe}-${owner}.png`) });
        }
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ version, checks }, null, 2));
        console.log('Diagnostics: downloaded JSON privacy, HTTP metadata, preview, failed-save rollback, persisted character share, and 8 narrow-screen safe-area layouts passed.');
    } catch (error) {
        await page.screenshot({ path: path.join(output, 'failure.png') });
        throw error;
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
