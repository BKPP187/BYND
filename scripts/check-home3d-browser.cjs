'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/home3d'); fs.mkdirSync(output, { recursive: true });
const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/vendor/remixicon/remixicon.css"><link rel="stylesheet" href="/apps/home3d/home3d.css"><style>html,body{margin:0;width:100%;height:100%;font-family:Arial,'Microsoft Yahei',sans-serif}.app-window{height:100%;width:100%;position:relative}.hidden{display:none}</style></head><body><div id="app-home3d-window" class="app-window active"><div id="home3d-root"></div></div><script>window.myCharacters=[{id:'proof',name:'林间',personality:'温柔，喜欢阅读和游戏',history:[],chatConfig:{}}];window.openApp=id=>{window.destination=id;ByndHome3D.close();document.getElementById('app-home3d-window').classList.remove('active')};window.closeApp=window.openApp;window.getLivingWorldRelevantEventsForChar=()=>[];window.getWechatMemoryStore=()=>({chars:{proof:{longTerm:[{id:'rain',title:'一起听过的雨',content:'那天我们窝在沙发上听雨，把毯子分了一半给彼此。',enabled:true}],segments:[],compressed:[]}}});</script><script src="/apps/home3d/home3d.js"></script><script>ByndHome3D.open();</script></body></html>`;
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/__home3d__') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fixture); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': (mime[path.extname(file)] || 'application/octet-stream') + (['.js', '.css', '.html'].includes(path.extname(file)) ? '; charset=utf-8' : '') }); fs.createReadStream(file).pipe(res);
});
(async () => {
    await new Promise(resolve => server.listen(8793, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'warning') console.log('BROWSER', msg.text().slice(0, 200)); });
    try {
        await page.goto('http://127.0.0.1:8793/__home3d__');
        await page.waitForSelector('[data-action="enter"]'); await page.screenshot({ path: path.join(output, 'setup.png') });
        await page.locator('[data-action="enter"]').click();
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2);
        await page.evaluate(async () => { ByndHome3D.State.withHome(home => { home.activity = { action: 'Use Phone', room: 'living_room', target: 'sofa', reason: '沙发上的位置给你留了一半', until: Date.now() + 600000 }; }); await ByndHome3D.UI.loadRoom('living_room'); });
        await page.waitForTimeout(450); await page.screenshot({ path: path.join(output, 'living-room.png') });
        console.log('LIVING', await page.evaluate(() => ByndHome3D.runtime.stats()));
        assert.equal(await page.locator('.home3d-scene-error').isVisible(), false);
        await page.evaluate(() => ByndHome3D.Interactions.perform('sofa', 'Sit'));
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'user').action === 'Sit');
        assert.equal(await page.evaluate(() => ByndHome3D.State.home().moments.at(-1).action), 'Sit');
        await page.screenshot({ path: path.join(output, 'together.png') });
        await page.locator('[data-action="memories"]').click(); await page.locator('[data-action="keep-memory"]').click();
        assert.equal(await page.evaluate(() => ByndHome3D.State.home().keepsakes.length), 1);
        await page.locator('[data-action="dismiss"]').click();
        await page.route('**/q-Desk.glb', route => route.abort());
        await page.locator('[data-action="room"][data-room="game_room"]').click();
        await page.waitForSelector('.home3d-scene-error:not([hidden])');
        assert.ok((await page.locator('.home3d-scene-error').textContent()).includes('工作桌'));
        await page.unroute('**/q-Desk.glb'); await page.locator('[data-action="retry"]').click();
        await page.waitForFunction(() => !document.querySelector('#home3d-scene').classList.contains('is-loading'));
        assert.equal(await page.locator('.home3d-scene-error').isVisible(), false);
        for (const room of ['bedroom', 'game_room']) {
            await page.locator('[data-action="room"][data-room="' + room + '"]').click();
            await page.waitForFunction(id => ByndHome3D.runtime?.stats().room === id && ByndHome3D.runtime.stats().actors.length === 2, room);
            assert.equal(await page.locator('.home3d-scene-error').isVisible(), false);
            await page.screenshot({ path: path.join(output, room + '.png') }); console.log(room, await page.evaluate(() => ByndHome3D.runtime.stats()));
        }
        await page.evaluate(async () => { ByndHome3D.State.withHome(home => { home.activity = { action: 'Sleep', room: 'bedroom', target: 'bed', reason: '晚安', until: Date.now() + 600000 }; }); await ByndHome3D.UI.loadRoom('bedroom'); });
        await page.evaluate(() => ByndHome3D.Interactions.perform('bed', 'Sleep'));
        await page.waitForFunction(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'user').action === 'Sleep');
        assert.ok((await page.evaluate(() => { try { ByndHome3D.Interactions.perform('bed', 'Hug'); return ''; } catch (error) { return error.message; } })).includes('醒来'));
        await page.screenshot({ path: path.join(output, 'sleep.png') });
        await page.locator('[data-action="settings"]').click(); await page.locator('[data-action="theme"][data-theme="night"]').click();
        await page.locator('[data-action="dismiss"]').click(); await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(output, 'night.png') });
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 812 });
            await page.evaluate(() => document.getElementById('app-home3d-window').style.setProperty('--bynd-header-safe-top', '47px'));
            await page.waitForTimeout(100);
            const layout = await page.evaluate(() => ({ root: document.getElementById('home3d-root').clientWidth, width: document.getElementById('home3d-root').scrollWidth, header: document.querySelector('.home3d-header button').getBoundingClientRect().top, footer: document.querySelector('.home3d-footer').getBoundingClientRect().bottom }));
            assert.equal(layout.width, layout.root); assert.ok(layout.header >= 47); assert.ok(layout.footer <= 812.1);
            await page.screenshot({ path: path.join(output, 'safe-area-' + width + '.png') });
        }
        await page.evaluate(() => { window.callChatApi = async () => ({ ok: false, error: '测试 HTTP 429' }); });
        await page.locator('[data-action="char"]').first().click(); await page.locator('[data-action="decide"]').click();
        await page.waitForFunction(() => document.querySelector('.home3d-notice').textContent.includes('429'));
        assert.equal(await page.evaluate(() => ByndHome3D.State.home().activity.action), 'Sleep');
        await page.evaluate(async () => {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16; canvas.getContext('2d').fillRect(0, 0, 16, 16);
            const reference = canvas.toDataURL(); window.myCharacters[0].chatConfig.imageReference = reference;
            ByndHome3D.State.update(next => { next.user.reference = reference; });
            window.imageCalls = 0; window.avatarCalls = 0;
            window.callChatApi = async () => { window.avatarCalls++; throw new Error('Portraits must use the image API'); };
            window.callWechatImageGenerationApi = async (prompt, options) => { window.imageCalls++; window.lastImageOptions = options; return { ok: true, url: ByndHome3D.initialPortraits.char }; };
            ByndHome3D.close(); await ByndHome3D.open(); await ByndHome3D.UI.arrive();
        });
        assert.equal(await page.evaluate(() => imageCalls), 0, 'entering the home never starts a paid image request automatically');
        assert.equal(await page.evaluate(() => avatarCalls), 0);
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.every(actor => actor.visual === 'portrait')), true);
        await page.locator('[data-action="settings"]').click();
        await page.locator('[data-action="generate-char"]').click();
        await page.waitForFunction(() => ByndHome3D.State.home().portraitDraft);
        assert.equal(await page.evaluate(() => !!ByndHome3D.State.home().portrait), false, 'a generated preview does not replace the active art');
        assert.equal(await page.evaluate(() => lastImageOptions.requireReference && lastImageOptions.editOnly && lastImageOptions.background === 'transparent'), true);
        await page.locator('[data-action="confirm-portrait"][data-who="char"]').click();
        await page.waitForFunction(() => ByndHome3D.State.home().portrait && !ByndHome3D.State.home().portraitDraft);
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(output, 'portrait-settings.png') });
        await page.locator('[data-action="dismiss"]').click();
        await page.evaluate(async () => { await ByndHome3D.UI.loadRoom('living_room'); });
        await page.waitForTimeout(250); await page.screenshot({ path: path.join(output, 'portrait-living-room.png') });
        const savedPortrait = await page.evaluate(() => JSON.stringify(ByndHome3D.State.home().portrait));
        await page.evaluate(() => { window.callWechatImageGenerationApi = async () => { window.imageCalls++; return { ok: false, status: 429, error: '测试生图 429 rate limit exceeded' }; }; });
        await page.locator('[data-action="settings"]').click(); await page.locator('[data-action="generate-char"]').click();
        await page.waitForFunction(() => ByndHome3D.Portraits.cooldownRemaining() > 0);
        assert.equal(await page.evaluate(() => JSON.stringify(ByndHome3D.State.home().portrait)), savedPortrait);
        assert.equal(await page.locator('[data-action="generate-user"]').isDisabled(), true);
        assert.equal(await page.locator('[data-action="generate-char"]').isDisabled(), true);
        assert.match(await page.locator('[data-image-cooldown]').textContent(), /当前形象已保留/);
        await page.evaluate(async () => { ByndHome3D.close(); await ByndHome3D.open(); await ByndHome3D.UI.arrive(); });
        await page.locator('[data-action="settings"]').click();
        assert.equal(await page.locator('[data-action="generate-user"]').isDisabled(), true);
        assert.equal(await page.evaluate(() => imageCalls), 2, 'reopening cannot bypass an image cooldown');
        await page.evaluate(() => {
            window.realDateNow = Date.now; Date.now = () => window.realDateNow() + 61000;
            window.callWechatImageGenerationApi = async () => { window.imageCalls++; return { ok: true, url: ByndHome3D.initialPortraits.user }; };
        });
        await page.waitForFunction(() => !document.querySelector('[data-action="generate-user"]').disabled);
        await page.locator('[data-action="generate-user"]').click();
        await page.waitForFunction(() => ByndHome3D.State.load().user.portraitDraft);
        await page.locator('[data-action="confirm-portrait"][data-who="user"]').click();
        await page.waitForFunction(() => ByndHome3D.State.load().user.portrait);
        await page.waitForFunction(() => !document.querySelector('#home3d-scene').classList.contains('is-loading') && !document.querySelector('[data-action="generate-user"]').disabled);
        await page.evaluate(() => { window.pendingCalls = 0; window.callWechatImageGenerationApi = () => { window.pendingCalls++; return new Promise(resolve => { window.finishPortrait = resolve; }); }; });
        await page.locator('[data-action="generate-user"]').click();
        await page.waitForFunction(() => window.pendingCalls === 1);
        await page.evaluate(async () => { ByndHome3D.close(); await ByndHome3D.open(); await ByndHome3D.UI.arrive(); });
        await page.locator('[data-action="settings"]').click();
        assert.equal(await page.locator('[data-action="generate-user"]').isDisabled(), true);
        await page.evaluate(() => window.finishPortrait({ ok: true, url: ByndHome3D.initialPortraits.user }));
        await page.waitForFunction(() => !document.querySelector('[data-action="generate-user"]').disabled);
        assert.equal(await page.evaluate(() => pendingCalls), 1);
        await page.evaluate(() => { Date.now = window.realDateNow; });
        await page.evaluate(async () => { ByndHome3D.close(); await ByndHome3D.open(); await ByndHome3D.UI.arrive(); });
        assert.equal(await page.evaluate(() => !!ByndHome3D.State.load().user.portrait && !!ByndHome3D.State.home().portrait), true);
        await page.evaluate(() => { ByndHome3D.close(); }); assert.equal(await page.locator('canvas').count(), 0);
        assert.deepEqual(errors, []);
        const integration = [];
        for (const url of ['http://127.0.0.1:8793/index.html', pathToFileURL(path.join(root, 'index.html')).href]) {
            const actual = await browser.newPage({ viewport: { width: 375, height: 812 } });
            const pageErrors = []; actual.on('pageerror', error => pageErrors.push(error.message));
            await actual.goto(url, { waitUntil: 'domcontentloaded' });
            await actual.waitForFunction(() => typeof openApp === 'function' && window.ByndHome3D);
            await actual.evaluate(async () => {
                if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
                window.myCharacters = [{ id: 'integration', name: '林间', description: '温柔，喜欢阅读', history: [], chatConfig: {} }];
                await byndStylesReady;
                window.unlockPhone?.(); window.goToDesktopPage?.(1);
            });
            const entry = actual.locator('#pages-container [data-layout-id="app-home3d"]:visible').first();
            await entry.waitFor({ state: 'visible' }); await entry.click();
            await actual.waitForSelector('[data-action="enter"]'); await actual.locator('[data-action="enter"]').click();
            await actual.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2);
            assert.equal(await actual.locator('.home3d-scene-error').isVisible(), false);
            if (url.startsWith('file:')) {
                const counts = await actual.evaluate(() => ({ loaded: ByndHome3D.Furniture.cacheInfo().models, total: ByndHome3D.catalogs.furnitureCatalog.items.filter(item => item.model).length }));
                assert.ok(counts.loaded > 0 && counts.loaded < counts.total, 'ordinary file browsers load only visited room furniture');
                // A missing script is still an error, and a later retry reads it again.
                // Playwright cannot route local disk requests. Simulate a failed
                // script element without moving any shared workspace resources.
                await actual.evaluate(() => {
                    window.homeAppendChild = document.head.appendChild;
                    document.head.appendChild = function (node) {
                        if (String(node.src).includes('/q-Desk.glb.js')) { queueMicrotask(() => node.dispatchEvent(new Event('error'))); return node; }
                        return window.homeAppendChild.call(this, node);
                    };
                });
                await actual.locator('[data-action="room"][data-room="game_room"]').click();
                await actual.waitForSelector('.home3d-scene-error:not([hidden])');
                assert.match(await actual.locator('.home3d-scene-error').textContent(), /工作桌/);
                await actual.evaluate(() => { document.head.appendChild = window.homeAppendChild; delete window.homeAppendChild; });
                await actual.locator('[data-action="retry"]').click();
                await actual.waitForFunction(() => !document.querySelector('#home3d-scene').classList.contains('is-loading'));
                assert.equal(await actual.locator('.home3d-scene-error').isVisible(), false);
                for (const room of ['bedroom', 'living_room']) {
                    await actual.locator('[data-action="room"][data-room="' + room + '"]').click();
                    await actual.waitForFunction(() => !document.querySelector('#home3d-scene').classList.contains('is-loading'));
                    assert.equal(await actual.locator('.home3d-scene-error').isVisible(), false);
                }
                assert.equal(await actual.locator('script[src*="furniture/"]').count(), 0, 'local model script nodes are released');
            }
            assert.ok(await actual.evaluate(() => getBackupLocalStorageKeys().includes('bynd_home3d_v1')));
            await actual.screenshot({ path: path.join(output, url.startsWith('file:') ? 'actual-file-app.png' : 'actual-http-app.png') });
            await actual.evaluate(() => openApp('album'));
            await actual.waitForFunction(() => !ByndHome3D.runtime);
            assert.equal(await actual.locator('#home3d-root canvas').count(), 0);
            if (url.startsWith('http')) {
                await actual.evaluate(() => localStorage.setItem('desktop_layout_v2', JSON.stringify({ pageCount: 2, items: [{ id: 'app-settings', type: 'builtin', page: 0, left: 18, top: 240, width: 72, height: 82, canvasWidth: 375 }], dock: ['music', 'camera', 'preset', 'bill'], deletedBuiltins: [] })));
                await actual.reload({ waitUntil: 'domcontentloaded' });
                await actual.evaluate(async () => { await byndStylesReady; window.unlockPhone?.(); window.goToDesktopPage?.(1); });
                await actual.locator('#pages-container [data-layout-id="app-home3d"]:visible').first().waitFor({ state: 'visible' });
                await actual.waitForFunction(() => JSON.parse(localStorage.getItem('desktop_layout_v2')).items.some(item => item.id === 'app-home3d'));
                assert.ok(await actual.evaluate(() => JSON.parse(localStorage.getItem('desktop_layout_v2')).items.some(item => item.id === 'app-home3d')), 'new home entry migrates into an existing saved desktop');
            }
            integration.push({ origin: url.startsWith('file:') ? 'file' : 'http', pageErrors }); await actual.close();
        }
        fs.writeFileSync(path.join(output, 'browser-checks.json'), JSON.stringify({ errors, result: 'passed', viewports: [320, 375, 390, 430], integration }, null, 2));
        console.log('Home3D browser checks passed.');
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
