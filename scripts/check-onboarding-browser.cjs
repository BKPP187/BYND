'use strict';
// Walks the first-run tour on narrow phones with 47/59px native safe areas (reserved by the
// parent or by the container) and checks it starts once, stays on screen and is remembered.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/onboarding');
fs.mkdirSync(output, { recursive: true });
const url = pathToFileURL(path.join(root, 'index.html')).href;

async function freshPage(browser, width) {
    const page = await browser.newPage({ viewport: { width, height: 812 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.ByndOnboarding && typeof unlockPhone === 'function');
    await page.evaluate(async () => { await byndStylesReady; document.documentElement.classList.add('mobile-runtime'); });
    return { page, errors };
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        // Starts by itself only after unlocking, and only once.
        const { page, errors } = await freshPage(browser, 375);
        await page.waitForTimeout(1600);
        assert.equal(await page.evaluate(() => ByndOnboarding.active), null, 'tour waits for the lock screen');
        await page.evaluate(() => unlockPhone());
        await page.waitForFunction(() => ByndOnboarding.active?.step === 'welcome', null, { timeout: 5000 });
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(ByndOnboarding.storageKey)).status), 'seen');

        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 812 });
            for (const safe of [47, 59]) {
                for (const parentReserved of [false, true]) {
                    await page.evaluate(({ safe, parentReserved }) => {
                        document.body.style.paddingTop = parentReserved ? safe + 'px' : '0px';
                        const phone = document.querySelector('.phone-container');
                        phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : safe + 'px');
                        phone.style.height = parentReserved ? 'calc(100dvh - ' + safe + 'px)' : '100dvh';
                        if (!ByndOnboarding.active) ByndOnboarding.start();
                    }, { safe, parentReserved });
                    const steps = await page.evaluate(() => ByndOnboarding.steps.map(step => step.id));
                    for (let i = 0; i < steps.length; i++) {
                        if (i > 0) await page.click('.bynd-tour-next');
                        await page.waitForTimeout(650);
                        const box = await page.evaluate(() => {
                            const tour = document.getElementById('bynd-tour').getBoundingClientRect();
                            const bubble = document.querySelector('.bynd-tour-bubble').getBoundingClientRect();
                            const spotNode = document.querySelector('.bynd-tour-spot');
                            const spot = document.getElementById('bynd-tour').classList.contains('no-target') ? null : spotNode.getBoundingClientRect();
                            const native = parseFloat(document.body.style.paddingTop) || 0;
                            return { step: ByndOnboarding.active.step, tour: { top: tour.top, left: tour.left, right: tour.right, bottom: tour.bottom }, bubble: { top: bubble.top, left: bubble.left, right: bubble.right, bottom: bubble.bottom }, spot: spot && { top: spot.top, bottom: spot.bottom, left: spot.left, right: spot.right }, native };
                        });
                        const label = `${box.step} ${width}px safe=${safe} parent=${parentReserved}`;
                        assert.equal(box.step, steps[i], label + ' order');
                        assert.ok(box.bubble.left >= box.tour.left && box.bubble.right <= box.tour.right + 0.5, label + ' bubble fits horizontally');
                        assert.ok(box.bubble.bottom <= box.tour.bottom + 0.5, label + ' bubble fits vertically');
                        assert.ok(box.bubble.top >= safe, label + ' bubble clears native status bar');
                        if (!['welcome', 'done'].includes(box.step)) {
                            assert.ok(box.spot, label + ' has a spotlight');
                            const overlap = Math.min(box.bubble.bottom, box.spot.bottom) - Math.max(box.bubble.top, box.spot.top);
                            if (box.step !== 'apps') assert.ok(overlap <= 1, label + ' bubble does not cover the target');
                        }
                        if (width === 375 && safe === 47 && !parentReserved) {
                            await page.screenshot({ path: path.join(output, `${String(i + 1).padStart(2, '0')}-${box.step}.png`) });
                        }
                    }
                    await page.click('.bynd-tour-next');
                    await page.waitForTimeout(400);
                    assert.equal(await page.evaluate(() => ByndOnboarding.active), null, 'finish closes the tour');
                    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(ByndOnboarding.storageKey)).status), 'done');
                    assert.equal(await page.evaluate(() => !!document.querySelector('.app-window.active')), false, 'finish returns to the desktop');
                }
            }
        }
        console.log('48 tour walks across widths and safe areas passed.');

        // Skipping is remembered; a reload never restarts it; the about page can replay it.
        await page.evaluate(() => ByndOnboarding.start());
        await page.click('.bynd-tour-skip');
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(ByndOnboarding.storageKey)).status), 'skipped');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.ByndOnboarding && typeof unlockPhone === 'function');
        await page.evaluate(() => unlockPhone());
        await page.waitForTimeout(1500);
        assert.equal(await page.evaluate(() => ByndOnboarding.active), null, 'reload after skip stays quiet');
        await page.evaluate(() => { openApp('settings'); openSettingsTab('about'); });
        await page.waitForTimeout(500);
        await page.click('.bynd-tour-replay');
        await page.waitForTimeout(500);
        assert.equal(await page.evaluate(() => ByndOnboarding.active?.step), 'welcome', 'about page replays the tour');
        await page.screenshot({ path: path.join(output, 'replay-from-about.png') });
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => ByndOnboarding.active), null, 'Escape skips');
        assert.deepEqual(errors, []);
        await page.close();

        // An existing installation (data saved before this version) is not interrupted.
        const existing = await browser.newPage({ viewport: { width: 375, height: 812 } });
        await existing.goto(url, { waitUntil: 'domcontentloaded' });
        await existing.evaluate(() => { localStorage.clear(); localStorage.setItem('my_api_data', '[]'); });
        await existing.reload({ waitUntil: 'domcontentloaded' });
        await existing.waitForFunction(() => window.ByndOnboarding && typeof unlockPhone === 'function');
        await existing.evaluate(() => unlockPhone());
        await existing.waitForTimeout(1600);
        assert.equal(await existing.evaluate(() => ByndOnboarding.active), null, 'existing installs are not toured automatically');
        await existing.close();
        console.log('Onboarding browser checks passed; screenshots in', output);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
