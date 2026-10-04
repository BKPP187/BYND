'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/cycle-galaxy');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openChat === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady;
            unlockPhone(); ByndBuiltinLibrary?.close();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'galaxy-proof', name: '江闻远', avatar: document.getElementById('wcs-user-avatar').src, chatConfig: {}, history: [] }];
            window.saveCharactersToStorage = async () => true;
            ByndMoon.clear();
            const now = ByndLifeState.localDate(Date.now());
            const shift = days => new Date(Date.parse(now + 'T12:00:00Z') + days * 86400000).toISOString().slice(0,10);
            for (const days of [-112,-84,-56,-28]) ByndMoon.saveRecord({ start: shift(days), end: shift(days + 4) });
            window.cycleProof = { shift: [-10,-7].map(shift), current: now };
        });
        await page.addStyleTag({ content: '.app-window, .wc-compose-card { transition:none!important;animation:none!important; } .tapfx-layer,.wc-toast { display:none!important; }' });
        for (const width of [320,375,430]) {
            await page.setViewportSize({ width, height: 844 });
            for (const safe of [47,59]) for (const parentReserved of [false,true]) {
                await page.evaluate(({ safe, parentReserved }) => {
                    document.body.style.paddingTop = parentReserved ? `${safe}px` : '0px';
                    const phone = document.querySelector('.phone-container');
                    phone.style.height = `${844 - (parentReserved ? safe : 0)}px`;
                    phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : `${safe}px`);
                    openApp('moon'); ByndMoon.open();
                }, { safe, parentReserved });
                assert.equal(await page.locator('.moon-stat-grid strong').first().innerText(), '28 天');
                assert.ok(await page.locator('.is-predicted').count() >= 1);
                const bounds = await page.locator('#app-moon-window').evaluate(host => ({ overflow: host.scrollWidth - host.clientWidth, top: host.querySelector('.moon-header button').getBoundingClientRect().top }));
                assert.ok(bounds.overflow <= 1 && bounds.top >= safe, JSON.stringify({ width, safe, parentReserved, bounds }));
                await page.locator('.moon-heading-action').click();
                const dialog = page.locator('#moon-record-dialog');
                await dialog.waitFor({ state: 'visible' });
                const box = await dialog.boundingBox();
                assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= safe && box.y + box.height <= 844, JSON.stringify({width,safe,parentReserved,box}));
                assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
                if (!parentReserved && safe === 47) {
                    await page.screenshot({ path: path.join(output, `range-${width}.png`) });
                    await page.locator('.moon-dialog-close').click();
                    await page.screenshot({ path: path.join(output, `cycle-${width}.png`) });
                } else await page.locator('.moon-dialog-close').click();
            }
        }
        const days = await page.evaluate(() => cycleProof.shift);
        await page.evaluate(() => ByndMoon.openRecorder());
        await page.evaluate(day => ByndMoon.chooseDay(day), days[0]);
        await page.evaluate(day => ByndMoon.chooseDay(day), days[1]);
        assert.match(await page.locator('#moon-range-status').innerText(), /4 个经期天/);
        await page.locator('#moon-record-dialog button[type=submit]').click();
        assert.equal(await page.evaluate(() => ByndMoon.read().records.length), 5);
        await page.evaluate(() => ByndMoon.navigate('records'));
        assert.equal(await page.locator('.moon-data-table tbody tr').count(), 5);
        await page.screenshot({ path: path.join(output, 'records-430.png') });
        await page.evaluate(day => ByndMoon.openRecorder(day), days[0]);
        await page.locator('#moon-end').fill(days[0]);
        const failed = await page.evaluate(() => {
            const before = localStorage.getItem(ByndMoon.storageKey), original = Storage.prototype.setItem;
            try { Storage.prototype.setItem = function(key, value) { if (key === ByndMoon.storageKey) throw new Error('quota exceeded'); return original.call(this,key,value); };
                return { ok: ByndMoon.saveFromForm(), same: localStorage.getItem(ByndMoon.storageKey) === before };
            } finally { Storage.prototype.setItem = original; }
        });
        assert.deepEqual(failed, { ok: false, same: true });
        assert.match(await page.locator('#moon-record-error').innerText(), /保存失败.*quota/);
        assert.equal(await page.locator('#moon-end').inputValue(), days[0]);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#moon-record-dialog').count(), 0);
        await page.evaluate(() => ByndMoon.openRecorder());
        await page.locator('#moon-range-calendar button[aria-label="上个月"]').click();
        const lastMonth = await page.evaluate(() => { const day = cycleProof.current.slice(0,7) + '-01'; return new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10); });
        await page.locator(`#moon-range-calendar [data-day="${lastMonth}"]`).click();
        await page.locator('#moon-range-calendar button[aria-label="下个月"]').click();
        const current = await page.evaluate(() => cycleProof.current);
        await page.locator(`#moon-range-calendar [data-day="${current}"]`).click();
        assert.equal(await page.locator('#moon-start').inputValue(), lastMonth);
        assert.equal(await page.locator('#moon-end').inputValue(), current);
        await page.locator('.moon-dialog-close').click();
        await page.evaluate(() => {
            document.querySelectorAll('.app-window.active').forEach(el => el.classList.remove('active'));
            openApp('wechat'); selectWechatUiTheme('pixel'); openChat('galaxy-proof');
        });
        assert.equal(await page.locator('#wc-msg-input').getAttribute('placeholder'), 'BEYOND THE SCREEN');
        await page.evaluate(() => { openStickerPicker(); switchStickerPack('pack_pixel_builtin'); });
        assert.equal(await page.locator('.wc-sticker-captioned').count(), 40);
        assert.equal(await page.locator('.wc-sticker-captioned').first().innerText(), '魔法棒');
        for (const width of [320,375,430]) {
            await page.setViewportSize({ width, height: 844 });
            const measured = await page.locator('.wc-sticker-captioned').first().evaluate(el => ({ img: el.querySelector('img').getBoundingClientRect().bottom, label: el.querySelector('span').getBoundingClientRect().top }));
            assert.ok(measured.label >= measured.img);
            await page.screenshot({ path: path.join(output, `stickers-${width}.png`) });
        }
        await page.evaluate(() => {
            closeStickerPicker();
            const topics = ['共度夜晚','下雨的那天','生病时','第一次见面','旅行','日常碎片','争吵之后','互动模式'];
            saveWechatMemoryStore({ chars: { 'galaxy-proof': { segments: topics.map((topic,i) => ({ id: `proof-${i}`, title: topic, topic, content: ['阻止吃宵夜','一起回家','照顾你','初始记忆','海边的风','一些小事','和好','纵容你的管束'][i] })) } } });
            openWechatMemoryManager();
        });
        for (const width of [320,375,430]) {
            await page.setViewportSize({ width, height: 844 });
            const styles = await page.locator('.wc-memory-card').evaluate(el => ({ color: getComputedStyle(el).backgroundColor, overflow: el.scrollWidth - el.clientWidth }));
            assert.equal(styles.color, 'rgb(253, 254, 253)'); assert.ok(styles.overflow <= 1);
            assert.equal(await page.locator('.wc-memory-star strong').count(), 8);
            const clipped = await page.locator('.wc-memory-sky').evaluate(sky => { const box = sky.getBoundingClientRect(); return [...sky.querySelectorAll('.wc-memory-star')].some(el => { const b = el.getBoundingClientRect(); return b.left < box.left - 1 || b.right > box.right + 1 || b.top < box.top - 1 || b.bottom > box.bottom + 1; }); });
            assert.equal(clipped, false);
            const closeBox = await page.locator('.wc-memory-close').boundingBox();
            assert.ok(closeBox.y >= 59, 'Memory close control must clear the reserved top area');
            await page.screenshot({ path: path.join(output, `galaxy-${width}.png`) });
        }
        await page.locator('.wc-memory-body').evaluate(el => el.scrollTop = 430);
        await page.screenshot({ path: path.join(output, 'galaxy-cards-430.png') });
        await page.locator('.wc-memory-body').evaluate(el => el.scrollTop = 0);
        await page.locator('.wc-memory-star').first().click();
        assert.equal(await page.locator('#wc-memory-title').inputValue(), '共度夜晚');
        assert.equal(await page.locator('#wc-memory-content').inputValue(), '阻止吃宵夜');
        await page.locator('.wc-memory-close').click();
        assert.deepEqual(errors, []);
        console.log('Cycle calendar and range dialog passed 12 safe-area layouts, persistence failure retains draft, statistics/table rendered, 40 pixel captions and galaxy edit passed at 3 widths.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
