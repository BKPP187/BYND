'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'artifacts/home3d-life-extension'); fs.mkdirSync(out, { recursive: true });
async function main() {
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report = { errors: [], safeAreas: [] };
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    page.setDefaultTimeout(90000); page.on('pageerror', error => report.errors.push(error.message));
    try {
        await page.addInitScript(version => {
            localStorage.setItem('bynd_lastSeenVersion', version); localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            localStorage.setItem('my_characters_data', JSON.stringify([{ id: 'home-expand-proof', name: '林间', personality: '温柔，喜欢阅读。热爱园艺。', history: [{ id: 'home-fixture-chat', timestamp: Date.now() - 60000, isMe: true, content: '今天去逛了书店，带回来一本书。' }], chatConfig: {} }]));
        }, require('./bump-version.cjs').currentVersion());
        await page.route('https://**/*', route => route.abort());
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof openWechatAiPhone === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); document.getElementById('bynd-version-letter')?.remove(); document.documentElement.classList.add('mobile-runtime');
            shouldAutoSyncWechatAiPhone = () => false; scheduleWechatAiPhoneDiaryFollowUp = () => false;
            window.homeApiCalls = 0; callChatApi = async () => { homeApiCalls++; return { ok: false, error: '测试不调用外部 API' }; };
            openApp('home3d');
        });
        await page.waitForSelector('#home3d-bind-char');
        await page.evaluate(async () => {
            const H = ByndHome3D; H.State.bind('home-expand-proof');
            H.State.withHome(home => { home.activity = { action: 'Read', room: 'living_room', target: 'sofa', until: Date.now() + 3600000, since: Date.now(), reason: '想把新书翻一翻', source: 'local' }; });
            await H.UI.arrive();
            const tick = H.Animation.tick; H.Animation.tick = (actor, time, dt, reduced) => tick(actor, time, dt * 6, reduced);
        });
        await page.waitForFunction(() => ByndHome3D.runtime?.stats().actors.length === 2 && !document.querySelector('.home3d-scene.is-loading'));
        assert.equal(await page.evaluate(() => ByndHome3D.State.home().executions.char.phase), 'acting');
        assert.equal(await page.evaluate(() => { const H = ByndHome3D, before = H.State.home().executions.char.id; H.runtime.setCharActivity({ ...H.State.home().activity, until: Date.now() + 3700000 }); return H.State.home().executions.char.id === before && H.runtime.stats().actors.find(a => a.who === 'char').path === 0; }), true);
        await page.locator('.home3d-presence [data-action="char"]').first().click(); await page.locator('[data-action="life-preferences"]').click();
        await page.locator('[data-life-preference="Read"]').selectOption('like'); await page.locator('[data-life-preference="Game"]').selectOption('avoid');
        const receiptBefore = await page.evaluate(() => ByndHome3D.State.home().executions.char.id);
        await page.locator('[data-action="life-preferences-save"]').click();
        assert.equal(await page.evaluate(() => ByndHome3D.State.home().preferences.Read), 'like');
        assert.equal(await page.evaluate(() => ByndHome3D.State.home().executions.char.id), receiptBefore);
        await page.locator('.home3d-presence [data-action="char"]').first().click(); await page.locator('[data-action="life-preferences"]').click();
        for (const safe of [47, 59]) for (const parent of [false, true]) {
            await page.setViewportSize({ width: 320, height: 740 });
            await page.evaluate(({ safe, parent }) => { const win = document.getElementById('app-home3d-window'); win.style.paddingTop = parent ? safe + 'px' : '0'; win.style.boxSizing = 'border-box'; document.getElementById('home3d-root').style.setProperty('--bynd-header-safe-top', (parent ? 0 : safe) + 'px'); }, { safe, parent });
            const close = await page.locator('.home3d-sheet-head button').boundingBox();
            assert.ok(close.y >= safe); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.locator('[data-action="life-preferences-save"]').scrollIntoViewIfNeeded();
            const save = await page.locator('[data-action="life-preferences-save"]').boundingBox(); assert.ok(save.x >= 0 && save.x + save.width <= 320 && save.y + save.height <= 740);
            report.safeAreas.push({ safe, parent, closeTop: close.y, saveBottom: save.y + save.height });
        }
        await page.screenshot({ path: path.join(out, 'preferences-320-safe59.png') });
        await page.locator('[data-action="dismiss"]').click();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => { document.getElementById('app-home3d-window').style.paddingTop = '0'; document.getElementById('home3d-root').style.setProperty('--bynd-header-safe-top', '0px'); });
        report.walking = await page.evaluate(() => {
            const H = ByndHome3D, next = { ...H.State.home().activity, action: 'Use Phone', reason: '看一眼手机' };
            H.State.withHome(home => { home.activity = next; }); const before = H.State.home().moments.length; H.runtime.setCharActivity(next);
            return { phase: H.State.home().executions.char.phase, before, after: H.State.home().moments.length };
        });
        assert.equal(report.walking.phase, 'walking'); assert.equal(report.walking.before, report.walking.after);
        await page.waitForFunction(() => ByndHome3D.State.home().executions.char.phase === 'acting');
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'char').action), 'Use Phone');
        report.blocked = await page.evaluate(() => {
            const H = ByndHome3D, approach = H.Animation.approach, before = H.State.home().moments.length;
            H.Animation.approach = () => null;
            try { H.runtime.setCharActivity({ action: 'Drink', room: 'living_room', target: 'coffee', source: 'local' }); }
            finally { H.Animation.approach = approach; }
            return { record: H.State.home().executions.char, before, after: H.State.home().moments.length, status: document.getElementById('home3d-presence').textContent };
        });
        assert.equal(report.blocked.record.phase, 'blocked'); assert.equal(report.blocked.before, report.blocked.after); assert.match(report.blocked.status, /暂时过不去/);
        // Exercise the real manual interaction adapter and its arrival callback.
        await page.evaluate(async () => {
            const H = ByndHome3D; H.runtime.setCharActivity({ action: 'Idle', room: 'living_room', source: 'local' });
            const row = H.runtime.worldFurniture().find(row => row.area === 'living_room' && row.local.id === 'sofa');
            await H.Interactions.perform(row.placement.id, 'Read');
        });
        assert.equal(await page.evaluate(() => ByndHome3D.State.home().executions.user.phase), 'walking');
        await page.waitForFunction(() => ByndHome3D.State.home().executions.user.phase === 'acting');
        assert.equal(await page.evaluate(() => ByndHome3D.runtime.stats().actors.find(a => a.who === 'user').action), 'Read');
        await page.evaluate(() => ByndHome3D.runtime.stopAction());
        assert.equal(await page.evaluate(() => ByndHome3D.State.home().executions.user.phase), 'finished'); report.manualArrival = true;
        // Fail only the home save at arrival, retaining the old serialized state.
        await page.evaluate(async () => {
            const H = ByndHome3D, row = H.runtime.worldFurniture().find(row => row.area === 'living_room' && row.local.id === 'sofa');
            await H.Interactions.perform(row.placement.id, 'Use Phone');
            window.homeSaveBeforeFailure = localStorage.getItem(H.State.key); window.homeOriginalSet = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key, value) { if (key === H.State.key) throw Error('quota fixture'); return homeOriginalSet.call(this, key, value); };
        });
        await page.waitForFunction(() => document.querySelector('.home3d-notice')?.textContent.includes('没有保存成功'));
        report.saveFailure = await page.evaluate(() => {
            const H = ByndHome3D, result = { preserved: localStorage.getItem(H.State.key) === homeSaveBeforeFailure, action: H.runtime.stats().actors.find(a => a.who === 'user').action, phase: H.State.home().executions.user.phase };
            Storage.prototype.setItem = homeOriginalSet; H.Interactions.cancel(); return result;
        });
        assert.equal(report.saveFailure.preserved, true); assert.equal(report.saveFailure.action, 'Idle'); assert.equal(report.saveFailure.phase, 'walking');
        await page.locator('.home3d-presence [data-action="char"]').first().click(); await page.locator('[data-action="life-records"]').click();
        assert.match(await page.locator('.home3d-sheet-body').textContent(), /未能到达/);
        await page.locator('.home3d-life-details summary').click(); assert.match(await page.locator('.home3d-sheet-body').textContent(), /带回来一本书/);
        await page.screenshot({ path: path.join(out, 'life-records.png') });
        report.apiCalls = await page.evaluate(() => homeApiCalls); assert.equal(report.apiCalls, 0);
        assert.deepEqual(report.errors, []);
        await page.evaluate(() => ByndHome3D.close());
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
    } catch (error) { await page.screenshot({ path: path.join(out, 'failure.png') }); console.error(JSON.stringify(report, null, 2)); throw error; }
    finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
