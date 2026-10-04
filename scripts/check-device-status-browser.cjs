'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/device-status');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.addInitScript(() => {
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            const battery = new EventTarget(); battery.level = .77; battery.charging = false;
            const connection = new EventTarget(); connection.type = 'wifi';
            Object.defineProperty(navigator, 'getBattery', { value: async () => battery, configurable: true });
            Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
            window.testBattery = battery; window.testConnection = connection;
        });
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady);
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady;
            unlockPhone(); window.ByndBuiltinLibrary?.close();
            document.documentElement.classList.add('mobile-runtime');
            applyPhoneStatusBarEnabled(true);
        });
        await page.locator('#battery-level').filter({ hasText: '77%' }).waitFor();
        for (const width of [320, 375]) for (const safe of [47, 59]) for (const parent of [true, false]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, parent }) => {
                document.documentElement.classList.remove('bynd-native-statusbar');
                document.body.style.paddingTop = parent ? `${safe}px` : '0px';
                const phone = document.querySelector('.phone-container');
                phone.style.height = `${844 - (parent ? safe : 0)}px`;
                phone.style.setProperty('--bynd-header-safe-top', parent ? '0px' : `${safe}px`);
            }, { safe, parent });
            const geometry = await page.locator('.status-bar').evaluate(bar => {
                const children = [...bar.children].map(el => el.getBoundingClientRect());
                return { first: Math.min(...children.map(r => r.top)), last: Math.max(...children.map(r => r.bottom)),
                    bottom: bar.getBoundingClientRect().bottom, overflow: bar.scrollWidth - bar.clientWidth };
            });
            assert.ok(geometry.first >= safe && geometry.last <= geometry.bottom && geometry.overflow <= 1, JSON.stringify({ width, safe, parent, geometry }));
            if (width === 320 && safe === 59) await page.screenshot({ path: path.join(output, `web-${parent ? 'parent' : 'header'}-320-59.png`) });
        }
        await page.evaluate(() => { testBattery.level = .12; testBattery.charging = true; testBattery.dispatchEvent(new Event('levelchange')); testBattery.dispatchEvent(new Event('chargingchange')); });
        assert.equal(await page.locator('#battery-level').innerText(), '12%');
        assert.ok(await page.locator('#battery-icon').evaluate(el => el.classList.contains('is-charging')));
        assert.equal(await page.locator('[data-battery-fill]').getAttribute('width'), '2.16');
        await page.screenshot({ path: path.join(output, 'web-charging-320.png') });
        const previews = [];
        for (const [percent, charging, dark, label] of [
            [77, false, false, '77% · 未充电'], [77, true, false, '77% · 充电中'],
            [77, true, true, '77% · 深色背景'], [12, true, false, '12% · 充电中'],
            [100, false, false, '100% · 满电'], [0, false, false, '0% · 空电量']
        ]) {
            await page.evaluate(({ percent, charging, dark }) => {
                testBattery.level = percent / 100; testBattery.charging = charging;
                testBattery.dispatchEvent(new Event('levelchange'));
                testBattery.dispatchEvent(new Event('chargingchange'));
                document.querySelector('.status-bar').classList.toggle('white-text', dark);
            }, { percent, charging, dark });
            const geometry = await page.locator('[data-battery-fill]').evaluate(el => el.getBoundingClientRect().width);
            assert.ok(Math.abs(geometry - 18 * percent / 100) < .02, `SVG must fill ${percent}% even while charging`);
            const boltVisible = await page.locator('.device-battery-bolt').evaluate(el => getComputedStyle(el).display !== 'none');
            assert.equal(boltVisible, charging);
            previews.push({ dark, label, markup: await page.locator('.battery-group').evaluate(el => el.outerHTML) });
            if (percent === 77 && charging && !dark) await page.screenshot({ path: path.join(output, 'web-77-charging-320.png') });
        }
        await page.evaluate(() => {
            testBattery.level = NaN; testBattery.dispatchEvent(new Event('levelchange'));
        });
        assert.equal(await page.locator('#battery-icon').isVisible(), false, 'unreadable battery must not show a full icon');
        assert.equal(await page.locator('#battery-level').innerText(), '--%');
        await page.evaluate(() => { testConnection.type = 'cellular'; testConnection.dispatchEvent(new Event('change')); });
        assert.equal(await page.locator('#network-label').innerText(), '蜂窝');
        await page.evaluate(() => {
            window.nativeCalls = [];
            window.ByndAndroid = { setSystemStatusBar: (...args) => nativeCalls.push(args) };
            initNativeStatusBar();
        });
        assert.equal(await page.locator('.status-bar').isVisible(), false, 'native and web indicators must never overlap');
        await page.evaluate(() => applyPhoneStatusBarEnabled(false));
        await page.waitForFunction(() => nativeCalls.at(-1)?.[0] === false);
        await page.evaluate(() => applyPhoneStatusBarEnabled(true));
        await page.waitForFunction(() => nativeCalls.at(-1)?.[0] === true);
        assert.equal(await page.locator('.status-bar').isVisible(), false);
        assert.deepEqual(errors, []);
        const preview = await browser.newPage({ viewport: { width: 375, height: 392 }, deviceScaleFactor: 2 });
        await preview.setContent(`<style>${fs.readFileSync(path.join(root, 'ui/components/status-bar.css'), 'utf8')}
            body { margin: 0; background: #f3f3f3; font-family: system-ui, sans-serif; }
            .preview-row { display: flex; justify-content: space-between; align-items: center; height: 60px; padding: 0 24px; border-bottom: 1px solid #ddd; background: #fff; color: #555; font-size: 12px; }
            .preview-row.dark { background: #171717; color: #eee; border-color: #171717; }
            .preview-row .status-bar { position: static; width: auto; height: auto; padding: 0; font-size: 16px; }
            .battery-group { gap: 6px; }
            .caption { padding: 8px 24px; color: #777; font-size: 11px; }
        </style>${previews.map(item => `<div class="preview-row ${item.dark ? 'dark' : ''}"><span>${item.label}</span><div class="status-bar ${item.dark ? 'white-text' : ''}">${item.markup}</div></div>`).join('')}<div class="caption">图标预览 · 电量使用受控测试数据</div>`);
        await preview.screenshot({ path: path.join(output, 'battery-svg-preview.png') });
        await preview.close();
        console.log('8 narrow-screen safe-area layouts, proportional SVG fill in 6 battery states, charging/transport updates, unreadable state and native visibility passed. Screenshots: ' + output);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
