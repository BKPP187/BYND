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
async function checkFolderPage(page, suffix) {
    await page.evaluate(() => { goToDesktopPage(1); });
    await page.waitForTimeout(400);
    const result = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('desktop_layout_v2'));
        const pages = getDesktopPages();
        const area = pages[1].querySelector('.desktop-scroll-area');
        const note = area.querySelector('[data-ribbon-note]');
        return {pageCount:saved.pageCount, folderPage:saved.items.find(item => item.id === 'folder-qa-tools').page,
            note:note.getBoundingClientRect().toJSON(),noteCalendar:note.querySelector('[data-ribbon-calendar]').getBoundingClientRect().toJSON(),noteList:note.querySelector('.ribbon-note-list').getBoundingClientRect().toJSON(),
            bounds:area.getBoundingClientRect().toJSON(),
            items:[...area.querySelectorAll(':scope > .desktop-layout-item')].map(el => ({id:el.dataset.layoutId,...el.getBoundingClientRect().toJSON()}))};
    });
    assert.equal(result.pageCount,2);
    assert.equal(result.folderPage,1);
    assert.ok(result.items.some(item => item.id === 'folder-qa-tools'));
    assert.ok(result.items.some(item => item.id === 'custom-plush-note'));
    const icons = result.items.filter(item => item.id.startsWith('app-') || item.id.startsWith('folder-')).sort((a,b) => Math.abs(a.top-b.top)>8 ? a.top-b.top : a.left-b.left);
    const firstRow = icons.filter(item => Math.abs(item.top-icons[0].top)<8);
    const columns = firstRow.map(item => item.left+item.width/2);
    // Folder and app cards have different widths; a small center offset is not
    // a missing cell. A skipped column moves by a full column pitch.
    const columnTolerance = Math.abs(columns[1]-columns[0]) * .35;
    for (let index=0;index<icons.length;index++) assert.ok(Math.abs(icons[index].left+icons[index].width/2-columns[index%4])<columnTolerance,JSON.stringify({suffix,id:icons[index].id,message:'gap inside icon grid',icons}));
    assert.ok(!icons.some(item => item.id==='app-events'),'心意 must be hidden in the built-in default layout');
    for (const child of [result.noteCalendar,result.noteList]) assert.ok(child.left>=result.note.left && child.right<=result.note.right && child.bottom<=result.note.bottom,'note content must fit inside its card');
    for (const a of result.items) {
        assert.ok(a.left >= result.bounds.left - 1 && a.right <= result.bounds.right + 1, a.id + ' horizontal bounds');
        assert.ok(a.bottom <= result.bounds.bottom + 1, a.id + ' must stay above the page dots and Dock');
        for (const b of result.items) if(a !== b) assert.ok(Math.min(a.right,b.right)-Math.max(a.left,b.left)<=2 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=2, a.id+' overlaps '+b.id);
    }
    await page.screenshot({path:path.join(output,`folders-second-page-${suffix}.png`)});
    await page.evaluate(() => { goToDesktopPage(0); });
    await page.waitForTimeout(400);
}
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const context = await browser.newContext({ viewport: {width:375,height:844}, isMobile:true, hasTouch:true });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url, { waitUntil:'domcontentloaded' }); await ready(page);
        await page.evaluate(async () => {
            localStorage.clear();
            window._folders = [{id:'qa-tools',name:'工具',size:'small',apps:['mcp','role-tools','settings','manual'].map(id => ({id}))}];
            saveFolders(); localStorage.setItem('bynd_lastSeenVersion', ByndVersionLetter.currentVersion);
            unlockPhone(); openApp('theme'); await renderThemeLibrary();
        });
        await page.locator('.theme-builtin-card').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(output,'library.png')});
        assert.equal(await page.locator('.theme-builtin-card').count(),1);
        assert.ok((await page.locator('.theme-builtin-meta strong').textContent()).includes('银粉蕾丝'));
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
        assert.equal(result.widgets,4); assert.deepEqual(result.overlaps,[]); assert.deepEqual(result.broken,[]);
        const reachable = await page.evaluate(() => {
            const apps = new Set([...getDesktopFolderAppIds(), ...collectDesktopDockLayout()]);
            document.querySelectorAll('.desktop-layout-item.layout-app[data-app-id]').forEach(item => apps.add(item.dataset.appId));
            return { actual:[...apps].sort(), expected:getDesktopAllAppDefinitions().filter(app=>app.id!=='events').map(app=>app.id).sort() };
        });
        assert.deepEqual(reachable.actual,reachable.expected);
        await checkFolderPage(page,'375');

        // The note is editable, persistent and independent from theme decoration.
        await page.evaluate(() => { goToDesktopPage(1); }); await page.waitForTimeout(250);
        await page.locator('[data-ribbon-check="0"]').click();
        assert.equal(await page.locator('[data-ribbon-check="0"]').getAttribute('aria-pressed'),'true');
        page.once('dialog', dialog => dialog.accept('今天读十页书'));
        await page.locator('[data-ribbon-text="1"]').click();
        assert.equal(await page.locator('[data-ribbon-text="1"]').textContent(),'今天读十页书');
        await page.evaluate(() => { goToDesktopPage(0); }); await page.waitForTimeout(250);

        // All three visible photos support local uploads; each companion keeps its own shape.
        for (const [slot,shape,file] of [['portrait','square','lock.webp'],['left','circle','toy-9.webp'],['right','square','toy-2.webp']]) {
            await page.locator(`[data-ribbon-photo="${slot}"]`).click();
            await page.locator('#ribbon-photo-editor input').setInputFiles(path.resolve(__dirname,'../assets/themes/cream-plush',file));
            await page.waitForFunction(() => document.querySelector('[data-ribbon-photo-status]').textContent === '预览确认后保存');
            if (slot !== 'portrait') await page.locator(`[data-ribbon-shape="${shape}"]`).click();
            await page.locator('[data-ribbon-photo-save]').click();
            const photo = await page.evaluate(slot => getRibbonPhoto(slot),slot);
            assert.match(photo.src,/^data:image\/(webp|png);base64,/);
            assert.equal(photo.shape,shape);
            if (slot !== 'portrait') {
                const transparent = await page.evaluate(async slot => {
                    const img = document.querySelector(`[data-ribbon-photo="${slot}"] img`); await img.decode();
                    const canvas=document.createElement('canvas'); canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
                    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
                    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
                    for(let i=3;i<pixels.length;i+=4) if(pixels[i]===0) return true;
                    return false;
                },slot);
                assert.equal(transparent,true,'uploaded stickers must retain transparent pixels');
            }
        }
        await page.screenshot({path:path.join(output,'custom-photos.png')});
        assert.equal(await page.locator('[data-ribbon-photo="left"]').evaluate(el => getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
        assert.equal(await page.locator('[data-ribbon-photo="right"]').evaluate(el => getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
        const photoState = await page.evaluate(() => getSavedThemeData().plushPhotos);
        await page.locator('[data-ribbon-photo="left"]').click();
        await page.locator('#ribbon-photo-editor input').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
        await page.waitForFunction(() => document.querySelector('[data-ribbon-photo-status]').textContent.includes('无法读取'));
        assert.deepEqual(await page.evaluate(() => getSavedThemeData().plushPhotos),photoState);
        await page.locator('[data-ribbon-shape="square"]').click();
        await page.evaluate(() => {
            window._qaPhotoSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key,value) { if(key==='my_theme_data') throw new Error('quota'); return window._qaPhotoSetItem.call(this,key,value); };
        });
        await page.locator('[data-ribbon-photo-save]').click();
        assert.ok(await page.locator('#ribbon-photo-editor').isVisible());
        assert.ok((await page.locator('[data-ribbon-photo-status]').textContent()).includes('照片保存失败'));
        assert.deepEqual(await page.evaluate(() => getSavedThemeData().plushPhotos),photoState);
        await page.evaluate(() => { Storage.prototype.setItem=window._qaPhotoSetItem;delete window._qaPhotoSetItem;closeRibbonPhotoEditor(); });
        await page.evaluate(() => { openApp('theme'); });
        await page.evaluate(async () => {
            document.getElementById('theme-library-name').value = '我的银粉蕾丝';
            await saveCurrentThemeLibraryItem();
        });
        const saved = await page.evaluate(async () => (await getThemeLibraryStore()).find(item => item.name === '我的银粉蕾丝'));
        assert.equal(saved.themeData.builtinTheme,'cream-plush');
        assert.equal(saved.desktopLayout.items.filter(item=>item.kind==='plush').length,4);
        assert.deepEqual(saved.themeData.plushPhotos,photoState);
        await page.evaluate(() => { closeApp('theme'); });
        page.once('dialog', dialog => dialog.accept('2026-01-01'));
        await page.locator('[data-plush-days]').click();
        assert.equal(await page.evaluate(() => getSavedThemeData().plushSince),'2026-01-01');
        await page.locator('.plush-player-buttons button').nth(1).click();
        assert.equal(await page.evaluate(() => document.getElementById('app-music-window').classList.contains('hidden')),false);
        await page.evaluate(() => { closeApp('music'); });
        await page.reload({waitUntil:'domcontentloaded'}); await ready(page);
        await page.evaluate(() => { unlockPhone(); }); await page.waitForTimeout(250);
        assert.equal(await page.locator('.desktop-widget-plush').count(),4);
        assert.ok((await page.locator('[data-plush-days]').textContent()).includes('Day'));
        assert.deepEqual(await page.evaluate(() => getSavedThemeData().plushPhotos),photoState);
        assert.equal(await page.locator('[data-ribbon-photo="left"]').getAttribute('data-photo-shape'),'circle');
        assert.equal(await page.locator('[data-ribbon-photo="right"]').getAttribute('data-photo-shape'),'square');
        assert.equal(await page.locator('[data-ribbon-check="0"]').getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('[data-ribbon-text="1"]').textContent(),'今天读十页书');

        await page.evaluate(() => {
            window._qaNoteSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key,value) { if(key==='bynd_ribbon_note_v1') throw new Error('quota'); return window._qaNoteSetItem.call(this,key,value); };
            goToDesktopPage(1);
        }); await page.waitForTimeout(250);
        page.once('dialog', dialog => dialog.accept());
        await page.locator('[data-ribbon-check="0"]').click();
        assert.equal(await page.locator('[data-ribbon-check="0"]').getAttribute('aria-pressed'),'true');
        await page.evaluate(() => { Storage.prototype.setItem=window._qaNoteSetItem;delete window._qaNoteSetItem;goToDesktopPage(0); });
        await page.waitForTimeout(250);

        // Failed widget writes must preserve the saved value and displayed state.
        await page.evaluate(() => {
            window._qaOriginalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'my_theme_data') throw new Error('quota');
                return window._qaOriginalSetItem.call(this, key, value);
            };
        });
        for (const [selector, value, message] of [
            ['[data-plush-days]', '2026-02-02', '纪念日保存失败'],
            ['[data-plush-bubble="left"]', '不要保存这条', '气泡文字保存失败']
        ]) {
            const before = await page.locator(selector).textContent();
            const messages = [];
            const handle = async dialog => { messages.push(dialog.message()); if(dialog.type()==='prompt') await dialog.accept(value); else await dialog.accept(); };
            page.on('dialog',handle);
            await page.locator(selector).click();
            page.off('dialog',handle);
            assert.ok(messages.some(text => text.includes(message)));
            assert.equal(await page.locator(selector).textContent(),before);
        }
        await page.evaluate(() => { Storage.prototype.setItem = window._qaOriginalSetItem; delete window._qaOriginalSetItem; });
        assert.equal(await page.evaluate(() => getSavedThemeData().plushSince),'2026-01-01');

        const themeSwitch = await page.evaluate(() => {
            applyBuiltinThemeAppearance({});
            const reset = document.documentElement.dataset.builtinTheme;
            applyBuiltinThemeAppearance(getSavedThemeData());
            return {reset, restored:document.documentElement.dataset.builtinTheme};
        });
        assert.deepEqual(themeSwitch,{reset:'',restored:'cream-plush'});

        // A personal library copy restores the photos and the added second-page widget.
        await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.evaluate(id => applyThemeLibraryItem(id),saved.id)]);
        await ready(page); await page.evaluate(() => { unlockPhone(); }); await page.waitForTimeout(250);
        assert.deepEqual(await page.evaluate(() => getSavedThemeData().plushPhotos),photoState);
        assert.equal(await page.locator('[data-ribbon-note]').count(),1);

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
            await page.locator('[data-ribbon-photo="left"]').click();
            const photoDialog = await page.locator('#ribbon-photo-editor').boundingBox();
            assert.ok(photoDialog.y >= safe && photoDialog.x >= 0 && photoDialog.x+photoDialog.width<=width+1,'photo editor must clear the safe area and fit narrow screens');
            await page.screenshot({path:path.join(output,`photo-editor-${width}-${safe}-${owner}.png`)});
            await page.evaluate(() => { closeRibbonPhotoEditor(); });
            await checkFolderPage(page,`${width}-${safe}-${owner}`);
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
        console.log('Silver Ribbon: daily note, editable photos, independent shapes, transparent uploads, failure recovery, personal library restore, narrow screens and 47/59px safe areas passed.');
        await context.close();
    } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
