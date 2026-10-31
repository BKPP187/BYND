'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/editorial-companions');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://**/*', route => route.abort());
        await page.addInitScript(() => {
            localStorage.setItem('bynd_onboarding_v1', '{"status":"skipped"}');
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        });
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openApp === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady;
            document.documentElement.classList.add('mobile-runtime');
            unlockPhone(); ByndBuiltinLibrary?.close();
            document.getElementById('bynd-version-letter')?.remove();
            window.myCharacters = [{ id: 'editorial-a', name: '第一位角色的长长名称', chatConfig: {}, history: [] },
                { id: 'editorial-b', name: '第二位', chatConfig: {}, history: [] }];
            openApp('theme'); openThemeSection('lock');
        });
        await page.addStyleTag({ content: '.app-window{transition:none!important}.tapfx-layer{display:none!important}' });
        const trigger = id => page.locator(`#${id} + .bynd-sheet-trigger`);
        const openPicker = async id => { await trigger(id).click(); await page.locator('.bynd-sheet').waitFor({ state: 'visible' }); };
        await trigger('ls-shortcut-left').waitFor();
        assert.equal(await page.locator('#ls-shortcut-left').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
        await page.evaluate(() => {
            window._sheetChanges = 0;
            document.getElementById('ls-shortcut-left').addEventListener('change', () => window._sheetChanges++);
        });
        await openPicker('ls-shortcut-left');
        assert.equal(await page.locator('.bynd-sheet-option').count(), 6);
        const optionStyles = await page.locator('.bynd-sheet-option').evaluateAll(options => options.map(option => ({ position: getComputedStyle(option, '::before').position, border: getComputedStyle(option, '::before').borderTopWidth, whiteSpace: getComputedStyle(option.querySelector('span')).whiteSpace })));
        assert.ok(optionStyles.every(style => style.position === 'static' && style.border === '0px' && style.whiteSpace === 'normal'));
        await page.screenshot({ path: path.join(output, 'shortcut-picker-375.png'), animations: 'disabled' });
        await page.locator('.bynd-sheet-option').filter({ hasText: '音乐' }).click();
        assert.equal(await page.locator('#ls-shortcut-left').inputValue(), 'music');
        assert.equal(await page.evaluate(() => window._sheetChanges), 1);
        assert.equal(await trigger('ls-shortcut-left').evaluate(el => el === document.activeElement), true);
        await openPicker('ls-shortcut-left');
        for (let n = 0; n < 9; n++) {
            await page.keyboard.press('Tab');
            assert.equal(await page.locator('.bynd-sheet').evaluate(el => el.contains(document.activeElement)), true);
        }
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.bynd-sheet-layer').count(), 0);
        assert.equal(await trigger('ls-shortcut-left').evaluate(el => el === document.activeElement), true);
        await openPicker('ls-shortcut-left');
        await page.evaluate(() => document.getElementById('ls-shortcut-left').disabled = true);
        await page.locator('.bynd-sheet-layer').waitFor({ state: 'detached' });
        assert.equal(await trigger('ls-shortcut-left').isDisabled(), true);
        await page.evaluate(() => {
            const select = document.getElementById('ls-shortcut-left'); select.disabled = false;
            const group = document.createElement('optgroup'); group.disabled = true; group.label = '不可用';
            group.innerHTML = '<option value="disabled-proof">不可选择的项</option>'; select.append(group);
        });
        await openPicker('ls-shortcut-left');
        assert.equal(await page.locator('.bynd-sheet-option').filter({ hasText: '不可选择的项' }).isDisabled(), true);
        await page.keyboard.press('Escape');
        await page.evaluate(() => document.getElementById('ls-shortcut-left').querySelector('optgroup').remove());
        await page.locator('#app-theme-window .save-btn').click();
        await page.locator('#theme-save-feedback').waitFor();
        assert.equal(await page.locator('#theme-save-feedback h2').innerText(), '保存成功');
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('my_theme_data')).lsLeft), 'music');
        await page.locator('#theme-save-feedback button').click();
        await page.evaluate(() => { openApp('theme'); openThemeSection('lock'); });
        await trigger('ls-shortcut-left').waitFor();
        assert.match(await trigger('ls-shortcut-left').innerText(), /音乐/);

        await page.evaluate(() => { openApp('role-tools'); ByndRoleTools.tab('permissions'); });
        await trigger('role-selected-char').waitFor();
        await openPicker('role-selected-char');
        await page.locator('.bynd-sheet-option').filter({ hasText: '第二位' }).click();
        assert.equal(await page.locator('#role-selected-char').inputValue(), 'editorial-b');
        assert.equal(await trigger('role-selected-char').evaluate(el => el === document.activeElement), true);
        await openPicker('role-grant-age');
        await page.evaluate(() => openApp('manual'));
        await page.locator('.bynd-sheet-layer').waitFor({ state: 'detached' });
        await page.locator('#manual-search-input').fill('MCP');
        assert.equal(await page.locator('#manual-mcp').evaluate(el => el.open && !el.hidden), true);
        assert.ok(await page.locator('#manual-mcp mark').count() > 0);
        await page.evaluate(() => clearManualSearch());
        await page.evaluate(() => { openApp('settings'); openSettingsTab('notify'); });
        assert.equal(await page.locator('#notify-interval-preset + .bynd-sheet-trigger').count(), 0, 'Keep the existing custom reminder picker as the single trigger.');

        const containers = { manual: '#manual-scroll', mcp: '.mcp-scroll', 'role-tools': '#app-role-tools-window .role-tools-content' };
        for (const width of [320, 375, 430]) for (const font of ['Arial,sans-serif', 'Verdana,sans-serif']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(font => setAppFontFamily(font), font);
            for (const [app, selector] of Object.entries(containers)) {
                await page.evaluate(app => openApp(app), app);
                await page.locator(`#app-${app}-window.active`).waitFor();
                if (app === 'mcp') assert.equal(await page.locator('.mcp-shell').evaluate(el => getComputedStyle(el, '::before').display), 'block');
                assert.equal(await page.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `${app} ${width}px ${font}`);
                if (width === 375 && font.startsWith('Arial')) await page.screenshot({ path: path.join(output, `${app}-375.png`), animations: 'disabled' });
            }
        }
        await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'ui/theme/foundation-layout.css'), 'utf8').replaceAll('env(safe-area-inset-top', 'var(--proof-safe-top') });
        for (const mode of ['parent', 'header']) for (const safe of [47, 59]) {
            await page.evaluate(({ mode, safe }) => {
                document.documentElement.classList.toggle('bynd-display-fullscreen', mode === 'header');
                document.documentElement.style.setProperty('--proof-safe-top', safe + 'px');
                openApp('theme'); openThemeSection('lock');
            }, { mode, safe });
            await openPicker('ls-shortcut-left');
            const bounds = await page.locator('.bynd-sheet').boundingBox();
            assert.ok(bounds.y >= safe && bounds.x >= 0 && bounds.x + bounds.width <= 430 && bounds.y + bounds.height <= 844 + 1);
            await page.keyboard.press('Escape');
        }
        await page.setViewportSize({ width: 375, height: 844 });
        await page.evaluate(() => {
            document.documentElement.classList.remove('bynd-display-fullscreen');
            document.documentElement.style.setProperty('--proof-safe-top', '0px');
            applyByndAdaptivePalette([18, 22, 30], [80, 100, 160]);
        });
        await openPicker('ls-shortcut-left');
        assert.notEqual(await page.locator('.bynd-sheet').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
        await page.screenshot({ path: path.join(output, 'shortcut-picker-dark-375.png'), animations: 'disabled' });
        await page.keyboard.press('Escape');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await openPicker('ls-shortcut-left');
        assert.equal(await page.locator('.bynd-sheet').evaluate(el => getComputedStyle(el).animationName), 'none');
        await page.keyboard.press('Escape');
        assert.deepEqual(errors, []);
        console.log('PASS: custom picker choice/change/save/reopen, disabled groups/updates, keyboard trap/Escape/focus, dynamic character rerender, app-switch dismissal, manual search; three pages at 320/375/430px and two global fonts; safe areas and reduced motion.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
