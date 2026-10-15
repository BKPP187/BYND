'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createServer } = require('./check-home3d-renderer-browser.cjs');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.resolve(__dirname, '../artifacts/home3d-theme');

async function main() {
    fs.mkdirSync(output, { recursive: true });
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    const report = { errors: [], changes: [] };
    try {
        browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        page.on('pageerror', error => report.errors.push(error.message));
        const ready = () => page.waitForFunction(() => window.ByndHome3D?.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'), null, { timeout: 90000 });
        await page.goto(`http://127.0.0.1:${server.address().port}/room?villa=1`);
        await ready();
        assert.equal(await page.locator('.home3d-survey-badge').count(), 1, 'exercise the retained floor badge');
        for (const theme of ['cream', 'night']) {
            await page.locator('[data-action="settings"]').click();
            await page.locator(`[data-action="theme"][data-theme="${theme}"]`).click();
            await ready();
            const result = await page.evaluate(() => ({ theme: ByndHome3D.State.home().theme, actors: ByndHome3D.runtime.stats().actors.length }));
            assert.deepEqual(result, { theme, actors: 2 });
            report.changes.push(result);
            await page.locator('.home3d-modal [data-action="dismiss"]').first().click();
        }
        await page.locator('[data-action="settings"]').click();
        await page.locator('[data-action="rebind"]').click();
        await ready();
        report.rebind = await page.evaluate(() => ({ actors: ByndHome3D.runtime.stats().actors.length, character: ByndHome3D.State.load().activeCharId }));
        assert.equal(report.rebind.actors, 2);
        assert.equal(report.rebind.character, 'room-demo');
        assert.deepEqual(report.errors, []);
        await page.screenshot({ path: path.join(output, 'rebuilt-390.png') });
        console.log('Home theme changes and character rebind rebuild the villa with both actors and no stale-camera error.');
    } finally {
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(report, null, 2));
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
