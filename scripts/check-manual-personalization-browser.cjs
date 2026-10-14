'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/manual-personalization');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof initManualApp === 'function' && typeof loadSavedSettings === 'function');
        await page.addStyleTag({ content: '.app-window { transition: none !important; }' });
        await page.evaluate(async () => {
            await byndStylesReady;
            unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            openApp('manual');
            ByndBuiltinLibrary?.close();
            document.getElementById('bynd-version-letter')?.remove();
        });
        await page.locator('#app-manual-window.active').waitFor();
        const sections = ['comic', 'home3d', 'role-tools', 'mcp', 'moon', 'world', 'bill'];
        for (const id of sections) {
            assert.equal(await page.locator(`#manual-${id}`).count(), 1, `${id}: independent chapter exists`);
        }
        for (const [term, id] of [
            ['漫画', 'comic'], ['小屋', 'home3d'], ['角色台', 'role-tools'], ['月伴', 'moon'],
            ['心意', 'world'], ['查看小票', 'bill'], ['每周连载', 'comic'], ['逐格', 'comic'],
            ['生活概况', 'role-tools'], ['不进入普通应用备份', 'role-tools'],
            ['MCP', 'mcp'], ['Streamable HTTP', 'mcp'], ['Bearer Token', 'mcp'],
            ['JSON 对象', 'mcp'], ['stdio', 'mcp'], ['Personal Access Token', 'mcp']
        ]) {
            await page.locator('#manual-search-input').fill(term);
            const result = await page.evaluate(id => ({
                visible: !document.getElementById(`manual-${id}`).hidden,
                open: document.getElementById(`manual-${id}`).open,
                marks: document.querySelectorAll(`#manual-${id} mark`).length,
                count: document.getElementById('manual-match-count').textContent
            }), id);
            assert.ok(result.visible && result.open && result.marks > 0, `${term}: search locates visible prose`);
            assert.ok(!result.count.endsWith('/0'), `${term}: match navigation is available`);
        }
        await page.locator('#manual-search-input').fill('根本不存在的说明书短语');
        assert.equal(await page.locator('#manual-no-results').isVisible(), true);
        await page.evaluate(() => clearManualSearch());
        for (const id of ['comic', 'home3d', 'role-tools', 'mcp']) {
            await page.locator(`.manual-quick-nav [onclick="manualGoToSection('manual-${id}')"]`).click();
            assert.equal(await page.locator(`#manual-${id}`).getAttribute('open'), '');
        }
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            for (const id of sections) {
                await page.evaluate(id => manualGoToSection(`manual-${id}`), id);
                await page.locator(`#manual-${id}`).scrollIntoViewIfNeeded();
                assert.equal(await page.locator('#manual-scroll').evaluate(el => el.scrollWidth <= el.clientWidth), true, `${id}: ${width}px manual has no horizontal overflow`);
                if ((width === 375 && ['comic', 'home3d', 'role-tools'].includes(id)) || (id === 'mcp' && width <= 375)) {
                    await page.screenshot({ path: path.join(output, `manual-${id}-${width}.png`), animations: 'disabled' });
                }
            }
            await page.evaluate(() => openApp('theme'));
            await page.locator('#app-theme-window.active').waitFor();
            const card = page.locator('.setting-card').filter({ has: page.locator('#lock-show-text') });
            await card.scrollIntoViewIfNeeded();
            const labels = await page.locator('.lock-visibility-grid .theme-check-card').evaluateAll(items => items.map(item => {
                const text = item.querySelector('span');
                const icon = item.querySelector('i, svg');
                const range = document.createRange();
                range.selectNodeContents(text);
                const rect = range.getBoundingClientRect();
                const bounds = item.getBoundingClientRect();
                return {
                    text: text.textContent, clipped: text.scrollWidth > text.clientWidth + 1,
                    gap: rect.left - icon.getBoundingClientRect().right,
                    fits: rect.left >= bounds.left && rect.right <= bounds.right,
                    placeholder: getComputedStyle(text, '::before').content
                };
            }));
            assert.equal(labels.length, 5);
            for (const label of labels) {
                assert.ok(!label.clipped && label.fits, `${width}px: ${label.text} is fully visible: ${JSON.stringify(label)}`);
                assert.ok(label.gap >= 0 && label.gap <= 5, `${label.text}: text stays beside its icon`);
                assert.equal(label.placeholder, 'none', `${label.text}: unused spacer is removed`);
            }
            await page.locator('label:has(#lock-show-text)').click();
            assert.equal(await page.locator('#lock-show-text').isChecked(), false);
            await page.locator('label:has(#lock-show-text)').click();
            assert.equal(await page.locator('#lock-show-text').isChecked(), true);
            assert.equal(await page.locator('#app-theme-window .window-content').evaluate(el => el.scrollWidth <= el.clientWidth), true);
            await page.screenshot({ path: path.join(output, `personalization-${width}.png`), animations: 'disabled' });
            await card.screenshot({ path: path.join(output, `lock-options-${width}.png`), animations: 'disabled' });
            await page.evaluate(() => openApp('manual'));
        }
        // Substitute env() only in the parent layout; child headers use its inherited ownership variable.
        await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'ui/theme/foundation-layout.css'), 'utf8').replaceAll('env(safe-area-inset-top', 'var(--proof-safe-top') });
        for (const app of ['manual', 'theme']) {
            await page.evaluate(app => openApp(app), app);
            await page.locator(`#app-${app}-window.active`).waitFor();
            for (const mode of ['parent', 'header']) {
                for (const safe of [47, 59]) {
                    await page.evaluate(({ mode, safe }) => {
                        document.documentElement.classList.toggle('bynd-display-fullscreen', mode === 'header');
                        document.documentElement.style.setProperty('--proof-safe-top', `${safe}px`);
                    }, { mode, safe });
                    const geometry = await page.locator(app === 'manual' ? '.manual-header' : '#app-theme-window > .window-header').evaluate(header => ({
                        top: header.getBoundingClientRect().top,
                        height: header.getBoundingClientRect().height,
                        padding: parseFloat(getComputedStyle(header).paddingTop),
                        control: header.querySelector('button, .close-btn').getBoundingClientRect().top
                    }));
                    assert.equal(geometry.top, mode === 'parent' ? safe : 0, `${app}: ${mode} reserves the inset in the correct container`);
                    assert.ok(geometry.control >= safe, `${app}: ${mode} controls clear the ${safe}px native status bar: ${JSON.stringify(geometry)}`);
                    const baseline = app === 'manual' ? 66 : 55;
                    assert.equal(geometry.height, baseline + (mode === 'header' ? safe : 0), `${app}: inset is reserved once`);
                    await page.screenshot({ path: path.join(output, `${app}-${mode}-safe-${safe}.png`), animations: 'disabled' });
                }
            }
        }
        assert.deepEqual(errors, []);
        console.log('Manual and personalization verified: seven chapters including MCP, search/navigation, five unclipped labels, checkbox controls, 320/375/430px and 47/59px parent/header safe areas.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
