'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/moon-contained');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const errors = [];
    try {
        for (const mobile of [false, true]) {
            const page = await browser.newPage({ viewport: mobile ? { width: 375, height: 844 } : { width: 1280, height: 1000 }, isMobile: mobile, hasTouch: mobile });
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
            await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.__byndCoreReady && typeof openChat === 'function');
            await page.evaluate(async mobile => {
                await window.__byndCoreReady; await window.byndStylesReady;
                unlockPhone(); ByndBuiltinLibrary?.close();
                if (mobile) document.documentElement.classList.add('mobile-runtime');
                ByndMoon.clear();
                ByndMoon.saveRecord({ start: '2026-08-01', end: '2026-08-05' });
                ByndMoon.settings({ periodLength: 5, cycleLength: 28 });
                openApp('moon');
            }, mobile);
            await page.addStyleTag({ content: '.app-window { transition:none!important;animation:none!important; } .tapfx-layer,.wc-toast { display:none!important; }' });
            const widths = mobile ? [320, 375, 430] : [1280];
            for (const width of widths) {
                await page.setViewportSize({ width, height: mobile ? 844 : 1000 });
                for (const safe of [47, 59]) for (const parentReserved of [false, true]) {
                    await page.evaluate(({ safe, parentReserved, mobile }) => {
                        document.body.style.paddingTop = mobile && parentReserved ? `${safe}px` : '0px';
                        const phone = document.querySelector('.phone-container');
                        phone.style.height = `${(mobile ? 844 : 812) - (parentReserved ? safe : 0)}px`;
                        phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : `${safe}px`);
                        // A desktop shell already owns the inset; mobile parent reservation moves the shell itself.
                        if (!mobile) document.getElementById('app-moon-window').style.paddingTop = parentReserved ? `${safe}px` : '0px';
                        ByndMoon.open(); ByndMoon.openRecorder('2026-09-28');
                    }, { safe, parentReserved, mobile });
                    const bounds = await page.evaluate(() => {
                        const box = node => { const r = node.getBoundingClientRect(); return { left:r.left, top:r.top, right:r.right, bottom:r.bottom }; };
                        const phone = document.querySelector('.phone-container'), overlay = document.getElementById('moon-record-overlay'), dialog = document.getElementById('moon-record-dialog');
                        return { phone:box(phone), overlay:box(overlay), dialog:box(dialog), horizontal:dialog.scrollWidth-dialog.clientWidth, topInset:parseFloat(getComputedStyle(phone).getPropertyValue('--bynd-header-safe-top')) || 0 };
                    });
                    for (const key of ['overlay','dialog']) {
                        assert.ok(bounds[key].left >= bounds.phone.left - 1 && bounds[key].right <= bounds.phone.right + 1 && bounds[key].top >= bounds.phone.top - 1 && bounds[key].bottom <= bounds.phone.bottom + 1, JSON.stringify({ width,safe,parentReserved,bounds }));
                    }
                    assert.ok(bounds.dialog.top >= bounds.overlay.top + bounds.topInset, JSON.stringify(bounds));
                    assert.ok(bounds.horizontal <= 1);
                    assert.equal(await page.locator('#moon-range-calendar .is-selected').count(), 1);
                    assert.equal(await page.locator('#moon-range-calendar .is-selected-estimate').count(), 4);
                    assert.match(await page.locator('#moon-range-status').innerText(), /2026-10-02.*5 天/);
                    await page.screenshot({ path:path.join(output, `${mobile ? width : 'desktop'}-${safe}-${parentReserved ? 'parent' : 'header'}.png`) });
                    await page.keyboard.press('Escape');
                    assert.equal(await page.locator('#moon-record-overlay').count(), 0);
                    assert.equal(await page.locator('#app-moon-window > [inert]').count(), 0);
                }
            }
            await page.evaluate(() => { ByndMoon.openRecorder('2026-09-28'); ByndMoon.saveFromForm(); });
            const record = await page.evaluate(() => ByndMoon.read().records.at(-1));
            assert.equal(record.end, null); assert.equal(record.expectedDays, 5);
            await page.evaluate(() => ByndMoon.resetMonth());
            assert.equal(await page.locator('.moon-calendar-day[data-day="2026-10-02"].is-predicted').count(), 1);
            const color = await page.locator('.moon-calendar-day[data-day="2026-10-02"]').evaluate(node => getComputedStyle(node).backgroundColor);
            assert.equal(color, 'rgba(0, 0, 0, 0)');
            await page.evaluate(() => ByndMoon.navigate('settings'));
            assert.equal(await page.locator('#moon-period').inputValue(), '5');
            assert.equal(await page.locator('.moon-stat-grid strong').nth(1).innerText(), '5 天');
            await page.screenshot({path:path.join(output, `${mobile ? 'mobile' : 'desktop'}-settings.png`)});
            await page.evaluate(() => { ByndMoon.navigate('home'); ByndMoon.openRecorder('2026-09-28'); });
            await page.locator('#moon-end').fill('2026-10-02');
            const failed = await page.evaluate(() => {
                const before = localStorage.getItem(ByndMoon.storageKey), original = Storage.prototype.setItem;
                try {
                    Storage.prototype.setItem = function(key, value) { if (key === ByndMoon.storageKey) throw new Error('quota exceeded'); return original.call(this,key,value); };
                    return {ok:ByndMoon.saveFromForm(), unchanged:localStorage.getItem(ByndMoon.storageKey)===before};
                } finally { Storage.prototype.setItem = original; }
            });
            assert.deepEqual(failed, {ok:false, unchanged:true});
            assert.equal(await page.locator('#moon-end').inputValue(), '2026-10-02');
            assert.match(await page.locator('#moon-record-error').innerText(), /保存失败.*quota/);
            await page.locator('#moon-record-dialog button[type=submit]').click();
            assert.equal(await page.locator('#moon-record-dialog').count(), 0);
            assert.equal(await page.evaluate(() => ByndMoon.read().records.at(-1).end), '2026-10-02');
            await page.screenshot({path:path.join(output, `${mobile ? 'mobile' : 'desktop'}-calendar.png`)});
            await page.close();
        }
        assert.deepEqual(errors, []);
        console.log('Moon desktop containment, 320/375/430px, 47/59px safe areas, automatic range, actual/estimated distinction and failed saves: PASS');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
