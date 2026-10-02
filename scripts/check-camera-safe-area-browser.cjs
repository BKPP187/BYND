'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/camera-safe-area');
fs.mkdirSync(output, { recursive: true });
const apps = [
    ['wechat', '.wechat-header'], ['study', '.study-topbar'], ['pet', '.mh-topbar'],
    ['mcp', '.mcp-topbar'], ['moon', '.moon-header'], ['manual', '.manual-header'],
    ['home3d', '.home3d-header'], ['role-tools', '.role-tools-header'],
    ['monitor', '.mh-topbar'], ['comic', '.ct-header']
];
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.addInitScript(() => {
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            window.ByndAndroid = { getSafeAreaTop: () => 32 };
        });
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndStudy && window.ByndComic);
        await page.evaluate(async () => {
            await window.__byndCoreReady;
            await window.byndStylesReady;
            unlockPhone();
            window.ByndBuiltinLibrary?.close();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'safe-proof', name: '江闻远', avatar: '', history: [], chatConfig: {} }];
        });
        assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--bynd-native-safe-top')), '32px', 'Native inset must be available on first paint');
        // Substitute CSS env values because desktop Chromium cannot simulate a physical camera cutout.
        await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'ui/theme/foundation-layout.css'), 'utf8').replaceAll('env(safe-area-inset-top', 'var(--proof-web-safe-top') + '\n.app-window { transition: none !important; }' });
        const results = [];
        for (const mode of ['native', 'web-fullscreen', 'parent']) {
            for (const width of [320, 412]) {
                for (const safe of [0, 32, 47, 59]) {
                    await page.setViewportSize({ width, height: 892 });
                    await page.evaluate(({ mode, safe }) => {
                        const html = document.documentElement;
                        html.classList.toggle('bynd-android-app', mode === 'native');
                        html.classList.toggle('bynd-display-fullscreen', mode === 'web-fullscreen');
                        window.ByndSafeArea.setTop(mode === 'native' ? safe : 0);
                        html.style.setProperty('--proof-web-safe-top', mode === 'native' ? '0px' : `${safe}px`);
                    }, { mode, safe });
                    for (const [app, header] of apps) {
                        await page.evaluate(app => {
                            document.querySelectorAll('.app-window.active').forEach(win => win.classList.remove('active'));
                            openApp(app);
                            if (app === 'wechat') document.getElementById('app-wechat-window').classList.add('wc-ui-theme-wechat');
                        }, app);
                        const host = page.locator(`#app-${app}-window`);
                        await page.waitForFunction(id => document.getElementById(id)?.classList.contains('active'), `app-${app}-window`);
                        await host.locator(header).waitFor({ state: 'visible' });
                        const geometry = await host.locator(header).evaluate(el => {
                            const box = el.getBoundingClientRect();
                            const controls = [...el.children].map(child => child.getBoundingClientRect()).filter(r => r.width && r.height);
                            const phone = document.querySelector('.phone-container').getBoundingClientRect();
                            return { top: box.top, height: box.height, first: Math.min(...controls.map(r => r.top)),
                                bottom: Math.max(...controls.map(r => r.bottom)), overflow: el.scrollWidth - el.clientWidth,
                                phoneTop: phone.top, phoneBottom: phone.bottom };
                        });
                        assert.equal(geometry.phoneTop, mode === 'parent' ? safe : 0, JSON.stringify({ mode, app, width, safe, geometry }));
                        assert.equal(geometry.phoneBottom, 892, 'Bottom of page must remain in screen bounds');
                        assert.equal(geometry.top, mode === 'parent' ? safe : 0, 'Fullscreen header background must reach the top edge');
                        assert.ok(geometry.first >= safe && geometry.bottom <= geometry.top + geometry.height + 1, JSON.stringify({ mode, app, width, safe, geometry }));
                        assert.ok(geometry.overflow <= 1, JSON.stringify({ mode, app, width, safe, geometry }));
                        const baseline = results.find(r => r.mode === mode && r.app === app && r.width === width && r.safe === 0);
                        if (baseline) assert.ok(Math.abs(geometry.first - baseline.geometry.first - safe) <= 1, 'Inset must be reserved exactly once: ' + JSON.stringify({ mode, app, width, safe, geometry, baseline }));
                        results.push({ mode, app, width, safe, geometry });
                        if ((width === 412 && safe === 32 && mode === 'native') || (width === 320 && safe === 59 && mode === 'web-fullscreen')) await page.screenshot({ path: path.join(output, `${mode}-${app}-${width}-${safe}.png`) });
                    }
                }
            }
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'geometry.json'), JSON.stringify(results, null, 2));
        console.log('240 camera safe-area checks passed: fullscreen background, toolbar clearance, native first paint, and no duplicate spacing. Screenshots: ' + output);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
