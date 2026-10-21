'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/preset-import');
fs.mkdirSync(output, { recursive: true });
const valid = { name: '完整预设', prompts: [{ identifier: 'main', name: '角色对话', role: 'system', content: '以 {{char}} 的身份自然对话。', enabled: true }, { identifier: 'extra', name: '可选风格', content: '简短回复。', enabled: false }], openai_max_tokens: 4096 };
const extensionExport = { extensions: { regex_scripts: [{ scriptName: '显示样式', findRegex: 'x', replaceString: '</textarea><script>window.__presetExtensionExecuted=true</script><div>display</div>' }], SPreset: { RegexBinding: { regexes: [] } }, entryGrouping: [] } };

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [], dialogs = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { if (dialog.type() === 'alert') dialogs.push(dialog.message()); await dialog.accept(); });
    async function importJson(json, name) {
        const count = dialogs.length;
        await page.locator('#import-preset-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) });
        await page.waitForFunction(() => document.getElementById('import-preset-file').value === '');
        await page.waitForFunction(() => !document.querySelector('#import-preset-file').files.length);
        // Wait for the asynchronous FileReader and its alert to complete.
        await page.waitForFunction(() => window.__presetImportFinished);
        assert.equal(dialogs.length, count + 1);
        await page.evaluate(() => { window.__presetImportFinished = false; });
    }
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof parsePromptPreset === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady;
            unlockPhone(); window.ByndBuiltinLibrary?.close();
            document.documentElement.classList.add('mobile-runtime');
            localStorage.setItem('my_presets_data', JSON.stringify({ presets: [{ id: 'old', name: '🍏蛇果v1.35（哈）', prompts: [], temperature: 0.8 }], activeId: 'old' }));
            openApp('preset');
            const original = window.alert;
            window.alert = message => { original(message); window.__presetImportFinished = true; };
        });
        await page.addStyleTag({ content: '.tapfx-layer { visibility:hidden !important; } .app-window { transition:none !important; }' });
        await page.evaluate(async () => { await document.fonts.load('20px remixicon'); await document.fonts.ready; });
        await page.locator('.preset-card-header').click();
        await page.getByRole('button', { name: '重新导入原文件' }).waitFor();
        assert.equal(await page.evaluate(() => getActivePreset()), null);
        await page.screenshot({ path: path.join(output, 'empty-record-375.png') });
        const before = await page.evaluate(() => localStorage.getItem('my_presets_data'));
        await importJson({ prompts: [] }, 'empty.json');
        assert.match(dialogs.at(-1), /没有识别到可读取的预设或扩展配置/);
        assert.equal(await page.evaluate(() => localStorage.getItem('my_presets_data')), before);
        await importJson(extensionExport, 'extensions.json');
        assert.match(dialogs.at(-1), /可展开查看扩展内容/);
        assert.deepEqual(await page.evaluate(() => getPresetData().presets.at(-1).extensions), extensionExport.extensions);
        assert.equal(await page.evaluate(() => getActivePreset()), null);
        await page.locator('.preset-extension-section > summary').first().click();
        await page.locator('.preset-extension-item > summary').first().click();
        assert.equal(await page.locator('.preset-extensions textarea').first().inputValue(), JSON.stringify(extensionExport.extensions.regex_scripts[0], null, 2));
        assert.equal(await page.evaluate(() => window.__presetExtensionExecuted), undefined);
        assert.equal(await page.locator('#app-preset-window script').count(), 0);
        await page.screenshot({ path: path.join(output, 'extension-content-375.png') });
        await importJson(valid, 'complete.json');
        assert.match(dialogs.at(-1), /导入成功/);
        await page.locator('.preset-card.active .preset-prompt-header').first().click();
        const textarea = page.locator('.preset-card.active textarea');
        assert.equal(await textarea.inputValue(), valid.prompts[0].content);
        await textarea.fill('以 {{char}} 的身份简洁对话。'); await textarea.blur();
        assert.equal(await page.evaluate(() => getActivePreset().prompts[0].content), '以 {{char}} 的身份简洁对话。');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof renderPresetList === 'function');
        await page.evaluate(async () => {
            await byndStylesReady; unlockPhone(); window.ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime');
            openApp('preset'); togglePresetExpand(getActivePreset().id); togglePromptExpand(getActivePreset().id, 0);
            const original = window.alert;
            window.alert = message => { original(message); window.__presetImportFinished = true; };
            await document.fonts.load('20px remixicon'); await document.fonts.ready;
        });
        assert.equal(await page.locator('.preset-card.active textarea').inputValue(), '以 {{char}} 的身份简洁对话。');
        assert.deepEqual(await page.evaluate(() => getPresetData().presets.find(p => p.name === 'extensions').extensions), extensionExport.extensions);
        await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'ui/theme/foundation-layout.css'), 'utf8').replaceAll('env(safe-area-inset-top', 'var(--proof-web-safe-top') + '\n.app-window { transition:none !important; } .tapfx-layer { visibility:hidden !important; }' });
        const geometry = [];
        for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            for (const mode of ['parent', 'web-fullscreen']) {
                for (const safe of [0, 47, 59]) {
                    await page.evaluate(({ mode, safe }) => {
                        document.documentElement.classList.toggle('bynd-display-fullscreen', mode === 'web-fullscreen');
                        document.documentElement.style.setProperty('--proof-web-safe-top', `${safe}px`);
                    }, { mode, safe });
                    const box = await page.locator('#app-preset-window .window-header').evaluate(el => {
                        const r = el.getBoundingClientRect(), children = [...el.children].map(c => c.getBoundingClientRect());
                        const content = document.querySelector('#app-preset-window .window-content');
                        return { top: r.top, height: r.height, first: Math.min(...children.map(c => c.top)), bottom: Math.max(...children.map(c => c.bottom)), overflow: content.scrollWidth - content.clientWidth };
                    });
                    assert.equal(box.top, mode === 'parent' ? safe : 0);
                    assert.ok(box.first >= safe && box.bottom <= box.top + box.height + 1, JSON.stringify({ width, mode, safe, box }));
                    assert.ok(box.overflow <= 1, 'Preset page fits narrow screen');
                    const baseline = geometry.find(g => g.width === width && g.mode === mode && g.safe === 0);
                    if (baseline) assert.ok(Math.abs(box.first - baseline.box.first - safe) <= 1, 'Safe area is reserved once: ' + JSON.stringify({ width, mode, safe, box, baseline }));
                    geometry.push({ width, mode, safe, box });
                    if (safe === 59) await page.screenshot({ path: path.join(output, `complete-${width}-${mode}.png`) });
                }
            }
        }
        // Optional private source directory: inspect real exports without copying them into the repo.
        if (process.env.BYND_PRESET_DIR) {
            for (const file of fs.readdirSync(process.env.BYND_PRESET_DIR).filter(f => f.endsWith('.json'))) {
                const json = JSON.parse(fs.readFileSync(path.join(process.env.BYND_PRESET_DIR, file), 'utf8'));
                const expected = Array.isArray(json.prompts) ? json.prompts.filter(p => typeof p.content === 'string' && p.content.trim()) : [];
                const parsed = await page.evaluate(({ json, file }) => parsePromptPreset(json, file), { json, file });
                const activeBeforeImport = await page.evaluate(() => getActivePreset());
                await importJson(json, file);
                if (!expected.length) {
                    assert.ok(JSON.stringify(parsed.extensions) === JSON.stringify(json.extensions), 'Extension parser preserves every field');
                    assert.match(dialogs.at(-1), /可展开查看扩展内容/);
                    assert.deepEqual(await page.evaluate(() => getActivePreset()), activeBeforeImport);
                    const storedExtensions = await page.evaluate(() => getPresetData().presets.find(p => p.id === window._expandedPresetId).extensions);
                    assert.ok(JSON.stringify(storedExtensions) === JSON.stringify(json.extensions), 'Imported extension content is stored without loss');
                    await page.setViewportSize({ width: 375, height: 844 });
                    await page.locator('.preset-extensions').last().locator('.preset-extension-section > summary').first().click();
                    const rules = page.locator('.preset-extensions').last().locator('.preset-extension-section').first().locator('.preset-extension-item');
                    assert.equal(await rules.count(), json.extensions.regex_scripts.length);
                    await rules.first().locator('summary').click();
                    assert.equal(await rules.first().locator('textarea').inputValue(), JSON.stringify(json.extensions.regex_scripts[0], null, 2));
                    for (const width of [320, 375]) {
                        await page.setViewportSize({ width, height: 844 });
                        assert.ok(await page.locator('#app-preset-window .window-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Extension content fits narrow screen');
                        await page.screenshot({ path: path.join(output, `real-extension-content-${width}.png`) });
                    }
                    console.log(`Real extension export verified: ${file}, all extensions preserved and viewable.`);
                    continue;
                }
                assert.deepEqual(parsed.prompts.map(p => p.content), expected.map(p => p.content));
                assert.deepEqual(await page.evaluate(() => getActivePreset().prompts.map(p => p.content)), expected.map(p => p.content));
                assert.equal(await page.locator('.preset-card.active .preset-prompt-item').count(), expected.length);
                console.log(`Real export verified: ${file}, ${parsed.prompts.length} prompts, all text preserved.`);
            }
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'geometry.json'), JSON.stringify(geometry, null, 2));
        console.log('Preset import browser checks passed: prompt/extension import and rejection, text-only viewing, edit/reload, 320/375px and 47/59px safe areas.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
