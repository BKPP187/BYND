'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/novelai-settings');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    try {
        await page.route('https://**/*', route => route.abort());
        await page.addInitScript(version => {
            localStorage.setItem('bynd_lastSeenVersion', version);
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        }, require('./bump-version.cjs').currentVersion());
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openNovelAiImageModal === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady;
            unlockPhone(); ByndBuiltinLibrary?.close(); openApp('settings'); openNovelAiImageModal();
        });
        await page.locator('#api-nai-token').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#api-nai-advanced').getAttribute('open'), null);
        assert.equal(await page.locator('#api-nai-help').getAttribute('open'), null);
        assert.equal(await page.locator('#api-nai-steps').isVisible(), false);
        assert.equal(await page.locator('#api-nai-steps').inputValue(), '28');
        assert.equal(await page.locator('#api-nai-scale').inputValue(), '5');
        await page.screenshot({ path: path.join(output, 'basic-375.png') });
        await page.locator('#api-nai-token').fill('pst-draft-example');
        await page.locator('#api-nai-model').selectOption('nai-diffusion-3');
        await page.locator('#api-nai-opus-free').uncheck();
        await page.locator('#api-nai-advanced summary').click();
        await page.locator('#api-nai-steps').fill('40');
        await page.locator('#api-nai-scale').fill('');
        assert.equal(await page.evaluate(() => readNovelAiImageModal().scale), 5);
        await page.locator('#api-nai-negative').fill('watermark');
        await page.locator('.api-nai-reset-row button').click();
        assert.equal(await page.locator('#api-nai-token').inputValue(), 'pst-draft-example');
        assert.equal(await page.locator('#api-nai-model').inputValue(), 'nai-diffusion-3');
        assert.equal(await page.locator('#api-nai-opus-free').isChecked(), false);
        assert.equal(await page.locator('#api-nai-steps').inputValue(), '28');
        assert.equal(await page.locator('#api-nai-negative').inputValue(), '');
        await page.evaluate(() => {
            window.__naiOriginalSave = saveApiData;
            saveApiData = () => { throw new Error('模拟存储失败'); };
        });
        await page.locator('.api-nai-save-btn').click();
        assert.equal(await page.locator('#api-novelai-image-modal').isVisible(), true);
        assert.match(await page.locator('#api-nai-test-result').textContent(), /保存失败.*模拟存储失败/);
        await page.evaluate(() => { saveApiData = window.__naiOriginalSave; });
        await page.locator('.api-nai-save-btn').click();
        assert.equal(await page.locator('#api-novelai-image-modal').isVisible(), false);
        await page.evaluate(() => openNovelAiImageModal());
        assert.equal(await page.locator('#api-nai-model').inputValue(), 'nai-diffusion-3');
        assert.equal(await page.locator('#api-nai-advanced').getAttribute('open'), null);
        await page.locator('.api-nai-test-btn').click();
        await page.waitForFunction(() => !document.getElementById('api-nai-test-result').textContent.includes('正在连接'));
        assert.equal((await page.locator('#api-nai-test-result').textContent()).includes('✓'), false);
        assert.equal((await page.locator('#api-nai-test-result').textContent()).includes('pst-draft-example'), false);
        const checks = [];
        await page.addStyleTag({ content: '.wc-char-card { animation: none !important; }' });
        for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => {
                const phone = document.querySelector('.phone-container');
                document.documentElement.classList.add('mobile-runtime');
                document.body.style.paddingTop = owner === 'parent' ? safe + 'px' : '0px';
                phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? safe + 'px' : '0px');
                phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
                document.getElementById('api-nai-token').value = '';
                document.getElementById('api-nai-test-result').textContent = '';
                document.getElementById('api-nai-advanced').open = false;
                document.querySelector('#api-novelai-image-modal .wc-card-body').scrollTop = 0;
            }, { safe, owner });
            for (const expanded of [false, true]) {
                await page.evaluate(expanded => { document.getElementById('api-nai-advanced').open = expanded; }, expanded);
                const layout = await page.evaluate(() => {
                    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width }; };
                    const body = document.querySelector('#api-novelai-image-modal .wc-card-body');
                    return { header: rect('#api-novelai-image-modal .wc-card-header'), save: rect('.api-nai-save-btn'), body: rect('#api-novelai-image-modal .wc-card-body'), scrollWidth: body.scrollWidth };
                });
                assert.ok(layout.header.top >= safe, JSON.stringify({ width, safe, owner, expanded, layout }));
                assert.ok(layout.save.bottom <= 844 && layout.save.top >= safe, JSON.stringify(layout));
                assert.ok(layout.body.left >= 0 && layout.body.right <= width + 1, JSON.stringify(layout));
                assert.ok(layout.scrollWidth <= layout.body.width + 1, JSON.stringify(layout));
                checks.push({ width, safe, owner, expanded, layout });
                if (width === 375 || (safe === 59 && owner === 'header')) await page.screenshot({ path: path.join(output, `${width}-${safe}-${owner}-${expanded ? 'advanced' : 'basic'}.png`) });
            }
        }
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(checks, null, 2));
        console.log(`NovelAI browser checks passed: defaults, draft reset, persistence failure, network failure and ${checks.length} safe-area layouts.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
