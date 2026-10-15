'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/comic-buttons');
const luminance = rgb => rgb.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const report = { checks: [], errors: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await page.route('https://**/*', route => route.abort());
        page.on('pageerror', error => report.errors.push(error.message));
        await page.addInitScript(version => { localStorage.setItem('bynd_lastSeenVersion', version); localStorage.setItem('bynd_builtin_library_seen_v1', '1'); }, require('./bump-version.cjs').currentVersion());
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndComic);
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window._wechatCharactersLoadPromise; await byndStylesReady;
            document.documentElement.classList.add('mobile-runtime'); unlockPhone(); ByndBuiltinLibrary?.close();
            window.myCharacters = [{ id: 'comic-label-proof', name: '小林', history: [], chatConfig: {} }];
            const now = Date.now();
            await ByndComic.storage.put('series', { id: 'comic-label-proof', type: 'webtoon', title: '雨后的小故事', charId: 'comic-label-proof', charName: '小林', userName: '我', status: 'draft', createdAt: now, updatedAt: now, chapters: [{ id: 'chapter-proof', title: '第1话', createdAt: now, updatedAt: now, state: 'failed', planError: 'API 错误 (503): 测试服务维护中。', panels: [], comments: [] }] });
            openApp('comic'); await ByndComic.openBook('comic-label-proof');
        });
        for (const width of [320, 390, 430]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => {
                document.body.style.paddingTop = owner === 'parent' ? safe + 'px' : '0px';
                const phone = document.querySelector('.phone-container');
                phone.style.height = (844 - (owner === 'parent' ? safe : 0)) + 'px';
                phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? safe + 'px' : '0px');
            }, { safe, owner });
            for (const view of ['series', 'failed-editor', 'complete-series']) {
                await page.evaluate(async view => {
                    const book = await ByndComic.storage.get('series', 'comic-label-proof');
                    book.chapters[0].panels = view === 'complete-series' ? [{ id: 'panel-proof', shot: 'wide', imageKey: 'fixture', bubbles: [] }] : [];
                    book.chapters[0].state = view === 'complete-series' ? 'done' : 'failed';
                    await ByndComic.storage.put('series', book); await ByndComic.openBook(book.id);
                }, view);
                if (view === 'failed-editor') await page.locator('.ct-series-actions [data-action="edit-chapter"]').click();
                const button = page.locator(view === 'failed-editor' ? '.ct-planning.failed .ct-primary' : '.ct-series-actions .ct-primary').first();
                await button.waitFor({ state: 'visible' });
                const measured = await button.evaluate(el => {
                    const style = getComputedStyle(el), box = el.getBoundingClientRect();
                    const rgb = color => color.match(/[\d.]+/g).map(Number);
                    return { text: el.textContent.trim(), color: rgb(style.color), background: rgb(style.backgroundColor), opacity: style.opacity, width: box.width, headerTop: document.querySelector('.ct-header button').getBoundingClientRect().top, headerHeight: document.querySelector('.ct-header').getBoundingClientRect().height, overflow: document.getElementById('app-comic-window').scrollWidth > innerWidth };
                });
                const [a, b] = [luminance(measured.color), luminance(measured.background)].sort((x, y) => y - x);
                measured.contrast = (a + .05) / (b + .05);
                report.checks.push({ width, safe, owner, view, ...measured });
                if (width === 390 && safe === 59 && owner === 'header' && view !== 'complete-series') await page.screenshot({ path: path.join(output, view + '-390.png'), animations: 'disabled' });
                assert.equal(measured.text, view === 'failed-editor' ? '重新生成分镜' : view === 'series' ? '继续创作第一话' : '第一话');
                assert.ok(measured.contrast >= 4.5, `${view}: label contrast ${measured.contrast.toFixed(2)}; ${JSON.stringify(measured)}`);
                assert.equal(measured.opacity, '1'); assert.ok(measured.width > 0); assert.equal(measured.overflow, false);
                assert.ok(measured.headerTop >= safe && measured.headerTop < safe + 20, 'top controls clear the safe area without double padding');
            }
        }
        assert.deepEqual(report.errors, []);
        console.log('Comic primary button labels are readable in draft, failed storyboard and completed series; 320/390/430px with 47/59px parent/header safe areas.');
    } finally { fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(report, null, 2)); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
