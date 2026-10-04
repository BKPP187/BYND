'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/jev-backup');
const version = require('./bump-version.cjs').currentVersion();
fs.mkdirSync(output, { recursive: true });

async function openSettings(page, tab) {
    await page.waitForFunction(() => window.__byndCoreReady && typeof openApp === 'function');
    await page.evaluate(async tab => {
        await window.__byndCoreReady;
        await window.byndStylesReady;
        unlockPhone();
        window.ByndBuiltinLibrary?.close();
        openApp('settings');
        openSettingsTab(tab);
    }, tab);
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    let requests = 0;
    const checks = [];
    try {
        const pc = await browser.newContext({ viewport: { width: 1280, height: 960 }, acceptDownloads: true });
        const mobile = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
        for (const context of [pc, mobile]) {
            await context.addInitScript(version => {
                localStorage.setItem('bynd_lastSeenVersion', version);
                localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            }, version);
            await context.route('https://**/*', async route => {
                if (route.request().url().includes('/v1/systemone')) {
                    requests++;
                    assert.equal(route.request().headers().authorization, 'Bearer apikey_browser_migration_test');
                    const payload = route.request().postDataJSON();
                    const answers = Object.fromEntries(Object.entries(payload.questions).map(([key, question]) => [key,
                        question.type === 'choice' ? { type: 'choice', choice: Object.keys(question.criteria)[0] } : { type: 'noul', noul: 0.99 }]));
                    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answers }) });
                } else await route.abort();
            });
        }
        const source = await pc.newPage();
        const target = await mobile.newPage();
        for (const page of [source, target]) page.on('dialog', dialog => dialog.accept());
        const url = pathToFileURL(path.join(root, 'index.html')).href;
        await source.goto(url, { waitUntil: 'domcontentloaded' });
        await openSettings(source, 'decision');
        await source.locator('#bynd-jev-key').fill('apikey_browser_migration_test');
        await source.locator('#bynd-jev-enabled').check();
        await source.locator('[data-jev-scope="moment"]').uncheck();
        await source.locator('[data-jev-scope="cycleReview"]').check();
        await source.locator('#bynd-jev-threshold').fill('78');
        await source.locator('button[onclick="ByndJev.saveSettings()"]').click();
        assert.match(await source.locator('#bynd-jev-status').innerText(), /已保存/);
        const expected = await source.evaluate(() => ByndJev.read());
        await source.evaluate(() => openSettingsTab('data'));
        const downloaded = source.waitForEvent('download');
        await source.locator('[onclick="exportAllData()"]').click();
        const backupFile = path.join(output, 'synthetic-backup.json');
        await (await downloaded).saveAs(backupFile);
        assert.deepEqual(JSON.parse(fs.readFileSync(backupFile, 'utf8')).bynd_jev_config_v1, expected);

        await target.goto(url, { waitUntil: 'domcontentloaded' });
        await openSettings(target, 'data');
        assert.equal(await target.evaluate(() => localStorage.getItem(ByndJev.storageKey)), null);
        await target.locator('#import-data-file').setInputFiles(backupFile);
        await target.waitForEvent('load');
        await openSettings(target, 'decision');
        assert.deepEqual(await target.evaluate(() => ByndJev.read()), expected);
        assert.equal(await target.locator('#bynd-jev-key').inputValue(), expected.apiKey);
        assert.equal(await target.locator('#bynd-jev-key').getAttribute('type'), 'password');
        assert.equal(await target.locator('#bynd-jev-enabled').isChecked(), true);
        assert.equal(await target.locator('[data-jev-scope="moment"]').isChecked(), false);
        assert.equal(await target.locator('#bynd-jev-threshold').inputValue(), '78');
        assert.equal(requests, 0, 'import must not spend an API call');
        await target.locator('#bynd-jev-test').click();
        await target.waitForFunction(() => document.getElementById('bynd-jev-status').textContent.includes('连接成功'));
        assert.equal(requests, 1, 'the restored key must be usable');
        await target.addStyleTag({ content: '#app-settings-window { transition: none !important; }' });
        for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await target.setViewportSize({ width, height: 844 });
            await target.evaluate(({ safe, owner }) => {
                const phone = document.querySelector('.phone-container');
                document.documentElement.classList.add('mobile-runtime');
                document.body.style.paddingTop = owner === 'parent' ? safe + 'px' : '0px';
                phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? safe + 'px' : '0px');
                phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
            }, { safe, owner });
            for (const tab of ['decision', 'data']) {
                await target.evaluate(tab => { openSettingsTab(tab); document.querySelector('#app-settings-window .window-content').scrollTop = 0; }, tab);
                if (tab === 'decision') await target.locator('.bynd-jev-privacy').scrollIntoViewIfNeeded();
                const layout = await target.evaluate(tab => {
                    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right, width: r.width }; };
                    const content = document.querySelector('#app-settings-window .window-content');
                    return { close: rect('#app-settings-window .close-btn'), contentWidth: content.clientWidth, scrollWidth: content.scrollWidth,
                        note: rect(tab === 'decision' ? '.bynd-jev-privacy' : '.set-data-hint') };
                }, tab);
                assert.ok(layout.close.top >= safe, JSON.stringify({ width, safe, owner, tab, layout }));
                assert.ok(layout.scrollWidth <= layout.contentWidth + 1, JSON.stringify(layout));
                assert.ok(layout.note.left >= 0 && layout.note.right <= width + 1, JSON.stringify(layout));
                checks.push({ width, safe, owner, tab, layout });
                await target.screenshot({ path: path.join(output, `${tab}-${width}-${safe}-${owner}.png`) });
            }
        }
        await target.evaluate(() => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key, value) {
                if (key === ByndJev.storageKey) throw new Error('simulated storage quota exceeded');
                return original.call(this, key, value);
            };
            try {
                document.getElementById('bynd-jev-key').value = 'apikey_unsaved_test';
                ByndJev.saveSettings();
            } finally { Storage.prototype.setItem = original; }
        });
        assert.match(await target.locator('#bynd-jev-status').innerText(), /保存失败.*simulated storage quota exceeded/);
        assert.deepEqual(await target.evaluate(() => ByndJev.read()), expected, 'a failed settings save must preserve the migrated key');
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ requests, checks }, null, 2));
        console.log('PC download -> fresh mobile import/reload -> restored key request and failed-save preservation passed; 16 settings safe-area layouts passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
