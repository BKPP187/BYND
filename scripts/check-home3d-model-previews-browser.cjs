'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), vm = require('node:vm');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/home3d-renderer');
async function main() {
    const context = { window: { ByndHome3D: {} } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/home3d/characters/initial-model-previews.js'), 'utf8'), context);
    for (const who of ['user', 'char']) assert.equal(context.window.ByndHome3D.initialModelPortraits[who], 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/home3d/characters/model-' + who + '-preview-v1.png')).toString('base64'));
    const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/room');
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
        const open = async () => { await page.locator('[data-action="settings"]').click(); await page.locator('.home3d-sheet details').evaluateAll(nodes => nodes.forEach(node => { if (node.querySelector('.home3d-portrait-preview')) node.open = true; })); };
        await open();
        assert.deepEqual(await page.locator('.home3d-portrait-preview img').evaluateAll(nodes => nodes.map((n, i) => n.src === ByndHome3D.initialModelPortraits[i ? 'char' : 'user'])), [true, true]);
        await page.waitForFunction(() => Array.from(document.querySelectorAll('.home3d-portrait-preview img')).every(image => image.complete && image.naturalWidth === 512));
        await page.locator('.home3d-portrait-preview').first().scrollIntoViewIfNeeded();
        fs.mkdirSync(output, { recursive: true }); await page.screenshot({ path: path.join(output, 'model-preview-user-settings.png') });
        await page.locator('.home3d-portrait-preview').last().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'model-preview-char-settings.png') });
        // An explicitly saved portrait must survive both the model selector and preview change.
        await page.evaluate(() => ByndHome3D.State.update(data => { data.user.modelId = 'bunny-blue-v1'; data.user.portrait = { url: ByndHome3D.initialPortraits.user }; }));
        await page.locator('[data-action="dismiss"]').click(); await open();
        assert.equal(await page.locator('.home3d-portrait-preview img').first().getAttribute('src'), await page.evaluate(() => ByndHome3D.initialPortraits.user));
        await page.evaluate(() => ByndHome3D.State.update(data => { data.user.portraitDraft = { url: ByndHome3D.initialPortraits.char }; }));
        await page.locator('[data-action="dismiss"]').click(); await open();
        assert.equal(await page.locator('.home3d-portrait-preview img').first().getAttribute('src'), await page.evaluate(() => ByndHome3D.initialPortraits.char));
        assert.equal(await page.locator('#home3d-user-model').inputValue(), 'bunny-blue-v1');
        assert.deepEqual(errors, []);
        console.log('Matching model previews, offline byte mirrors, saved portrait and draft precedence passed at 390px.');
    } finally { await browser.close(); server.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
