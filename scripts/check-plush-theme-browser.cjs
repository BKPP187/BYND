'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.resolve(__dirname, '../.qa-screenshots/plush-theme');
fs.mkdirSync(output, { recursive: true });
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
async function ready(page) {
    await page.waitForFunction(() => typeof applyThemeLibraryItem === 'function' && typeof unlockPhone === 'function');
    await page.evaluate(async () => { await byndStylesReady; });
    await page.waitForTimeout(350);
    if (await page.locator('#bynd-version-letter').isVisible()) await page.keyboard.press('Escape');
}
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const context = await browser.newContext({ viewport: {width:375,height:844}, isMobile:true, hasTouch:true });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url, { waitUntil:'domcontentloaded' }); await ready(page);
        await page.evaluate(async () => { localStorage.clear(); saveFolders(); localStorage.setItem('bynd_lastSeenVersion', ByndVersionLetter.currentVersion); unlockPhone(); openApp('theme'); await renderThemeLibrary(); });
        await page.locator('.theme-builtin-card').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(output,'library.png')});
        assert.equal(await page.locator('.theme-builtin-card').count(),1);
        await Promise.all([page.waitForNavigation({ waitUntil:'domcontentloaded' }), page.locator('.theme-builtin-card .apply').click()]);
        await ready(page);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.builtinTheme),'cream-plush');
        await page.screenshot({path:path.join(output,'lock.png')});
        await page.evaluate(() => { unlockPhone(); goToDesktopPage(0); }); await page.waitForTimeout(350);
        await page.screenshot({path:path.join(output,'desktop.png')});
        const result = await page.evaluate(() => {
            const area = getDesktopPages()[0].querySelector('.desktop-scroll-area');
            const items = [...area.querySelectorAll(':scope > .desktop-layout-item')].map(el => ({id:el.dataset.layoutId,...el.getBoundingClientRect().toJSON()}));
            const overlaps = [];
            for (let i=0;i<items.length;i++) for(let j=i+1;j<items.length;j++) {
                const a=items[i],b=items[j];
                if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2) overlaps.push([a.id,b.id]);
            }
            return {items,overlaps,canvas:area.getBoundingClientRect().toJSON(),widgets:document.querySelectorAll('.desktop-widget-plush').length,
                broken:[...document.querySelectorAll('#home-screen img, #theme-library-list img')].filter(img => img.getAttribute('src') && (!img.complete || !img.naturalWidth)).map(img=>img.src)};
        });
        console.log(JSON.stringify({widgets:result.widgets, overlaps:result.overlaps, broken:result.broken, canvas:result.canvas}));
        assert.equal(result.widgets,3); assert.deepEqual(result.overlaps,[]); assert.deepEqual(result.broken,[]);
        const reachable = await page.evaluate(() => {
            const apps = new Set([...getDesktopFolderAppIds(), ...collectDesktopDockLayout()]);
            document.querySelectorAll('.desktop-layout-item.layout-app[data-app-id]').forEach(item => apps.add(item.dataset.appId));
            return { actual:[...apps].sort(), expected:getDesktopAllAppDefinitions().map(app=>app.id).sort() };
        });
        assert.deepEqual(reachable.actual,reachable.expected);
        await page.evaluate(() => { openApp('theme'); });
        await page.evaluate(async () => {
            document.getElementById('theme-library-name').value = '我的奶绒';
            await saveCurrentThemeLibraryItem();
        });
        const saved = await page.evaluate(async () => (await getThemeLibraryStore()).find(item => item.name === '我的奶绒'));
        assert.equal(saved.themeData.builtinTheme,'cream-plush');
        assert.equal(saved.desktopLayout.items.filter(item=>item.kind==='plush').length,3);
        await page.evaluate(() => { closeApp('theme'); });
        page.once('dialog', dialog => dialog.accept('2026-01-01'));
        await page.locator('[data-plush-days]').click();
        assert.equal(await page.evaluate(() => getSavedThemeData().plushSince),'2026-01-01');
        await page.locator('.plush-player-buttons button').nth(1).click();
        assert.equal(await page.evaluate(() => document.getElementById('app-music-window').classList.contains('hidden')),false);
        await page.evaluate(() => { closeApp('music'); });
        await page.reload({waitUntil:'domcontentloaded'}); await ready(page);
        await page.evaluate(() => { unlockPhone(); }); await page.waitForTimeout(250);
        assert.equal(await page.locator('.desktop-widget-plush').count(),3);
        assert.ok((await page.locator('[data-plush-days]').textContent()).includes('Day'));

        for (const width of [320,390]) for (const safe of [47,59]) for (const owner of ['parent','header']) {
            await page.setViewportSize({width,height:844});
            const metrics = await page.evaluate(({safe,owner}) => {
                const phone=document.querySelector('.phone-container');
                document.body.style.paddingTop=owner==='parent'?safe+'px':'0px';
                phone.style.height=owner==='parent'?`calc(100dvh - ${safe}px)`:'100dvh';
                phone.style.setProperty('--bynd-header-safe-top',owner==='header'?safe+'px':'0px');
                document.getElementById('lock-screen').style.transition = 'none';
                document.getElementById('lock-screen').classList.remove('unlocked');
                return {clock:document.querySelector('.ls-header').getBoundingClientRect().toJSON(),phone:phone.getBoundingClientRect().toJSON(),padding:parseFloat(getComputedStyle(document.getElementById('lock-screen')).paddingTop)};
            },{safe,owner});
            assert.ok(metrics.clock.top>=safe+69, 'clock must sit below the native safe area: '+JSON.stringify({width,safe,owner,metrics}));
            assert.equal(metrics.padding,70+(owner==='header'?safe:0), 'safe area must be reserved exactly once');
            await page.screenshot({path:path.join(output,`lock-${width}-${safe}-${owner}.png`)});
            await page.evaluate(() => { unlockPhone(); goToDesktopPage(0); }); await page.waitForTimeout(180);
            const layout = await page.evaluate(() => {
                const area=getDesktopPages()[0].querySelector('.desktop-scroll-area');
                const box=area.getBoundingClientRect();
                return {left:box.left,right:box.right,items:[...area.querySelectorAll(':scope > .desktop-layout-item')].map(el=>({id:el.dataset.layoutId,...el.getBoundingClientRect().toJSON()}))};
            });
            for(const item of layout.items) {assert.ok(item.left>=layout.left-1,item.id+' left');assert.ok(item.right<=layout.right+1,item.id+' right');}
            for(let i=0;i<layout.items.length;i++) for(let j=i+1;j<layout.items.length;j++) {
                const a=layout.items[i],b=layout.items[j];
                assert.ok(Math.min(a.right,b.right)-Math.max(a.left,b.left)<=2 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=2, a.id+' overlaps '+b.id);
            }
            await page.screenshot({path:path.join(output,`desktop-${width}-${safe}-${owner}.png`)});
            await page.evaluate(async () => { openApp('theme'); await renderThemeLibrary(); });
            await page.locator('.theme-builtin-card').scrollIntoViewIfNeeded();
            const header = await page.locator('#app-theme-window .window-header').boundingBox();
            const title = await page.locator('#app-theme-window .window-header h3').boundingBox();
            assert.ok(title.y>=safe, 'theme library title must clear the native status bar: '+JSON.stringify({width,safe,owner,header,title}));
            assert.ok(title.y<header.y+header.height, 'title must fit its header');
            await page.screenshot({path:path.join(output,`library-${width}-${safe}-${owner}.png`)});
            await page.evaluate(() => { closeApp('theme'); });
            await page.waitForTimeout(400);
        }
        assert.deepEqual(errors,[]);
        console.log('Plush theme: library apply, local assets, layout, personal save, anniversary, music, reload and 47/59px safe areas passed.');
        await context.close();
    } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
