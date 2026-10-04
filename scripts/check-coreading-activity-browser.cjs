'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'.qa-screenshots/reading-activity');
fs.mkdirSync(output,{recursive:true});
(async () => {
    const browser = await chromium.launch({channel:'msedge',headless:true});
    const page = await browser.newPage({viewport:{width:375,height:844},isMobile:true,hasTouch:true});
    const errors = []; let quoteRequests=0, offline=false;
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.addInitScript(() => {
            localStorage.setItem('bynd_builtin_library_seen_v1','1');
            const NativeDate=Date, start=NativeDate.now(), base=new NativeDate(2026,9,2,12).getTime();
            window.Date=class extends NativeDate { constructor(...args){super(...(args.length?args:[base+NativeDate.now()-start]));} static now(){return base+NativeDate.now()-start;} };
        });
        await page.route('https://v1.jinrishici.com/**',async route=> {
            quoteRequests++;
            if(offline) return route.abort();
            await route.fulfill({contentType:'application/json',body:JSON.stringify({content:'浊酒不销忧国泪，救时应仗出群才。',author:'秋瑾',origin:'黄海舟中日人索句并见日俄战争地图'})});
        });
        await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.__byndCoreReady && typeof openChat==='function');
        await page.evaluate(async()=> { await window.__byndCoreReady; await window.byndStylesReady;
            unlockPhone(); ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime'); openApp('coread'); });
        await page.locator('.coread-quote-byline a').waitFor();
        assert.match(await page.locator('.coread-sense-card em').innerText(),/忧国/);
        assert.equal(await page.locator('.coread-sense-title-text').innerText(),'国庆');
        assert.match(await page.locator('.coread-quote-byline').innerText(),/秋瑾/);
        assert.equal(quoteRequests,1);
        await page.screenshot({path:path.join(output,'daily-375.png')});
        offline=true; await page.evaluate(()=>CoReadLiterature.refresh(true));
        assert.match(await page.locator('.coread-quote-byline button').innerText(),/更新失败/);
        assert.match(await page.locator('.coread-sense-card em').innerText(),/忧国/); offline=false;
        const quota = await page.evaluate(async()=> {
            const original=Storage.prototype.setItem, before=localStorage.getItem(CoReadLiterature.key);
            Storage.prototype.setItem=function(key,value){if(key===CoReadLiterature.key)throw new Error('quota');return original.call(this,key,value);};
            try { await CoReadLiterature.refresh(true); return {same:before===localStorage.getItem(CoReadLiterature.key),status:CoReadLiterature.status}; }
            finally {Storage.prototype.setItem=original;}
        });
        assert.equal(quota.same,true); assert.match(quota.status,/缓存未保存/);
        await page.evaluate(()=> {
            const cover=(title,color)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="145"><rect width="100" height="145" fill="${color}"/><text x="50" y="75" text-anchor="middle" font-size="19" fill="white">${title}</text></svg>`);
            const books=[{id:'qa-reading-1',title:'荷塘月色',author:'朱自清',tags:['散文'],rating:4,coverUrl:cover('荷塘月色','#859d8f')},
                {id:'qa-reading-2',title:'春水',author:'冰心',tags:['诗歌'],rating:5,coverUrl:cover('春水','#c795ad')},
                {id:'qa-reading-3',title:'背影',author:'朱自清',tags:['散文'],rating:0,coverUrl:cover('背影','#7f8198')}]
                .map(book=>({...book,content:'这是用于界面检查的阅读正文。'.repeat(75),page:0,createdAt:Date.now()}));
            saveCoReadLibrary(books);
            for(let day=1;day<=27;day++) {
                const at=new Date(2026,8,day,12).getTime(), book=books[Math.floor((day-1)/9)];
                for(let page=0;page<getCoReadPageCount(book);page++) CoReadJournal.record(book,page,at+page*60000,at+(page+1)*60000);
            }
            const at=new Date(2026,9,1,12).getTime();
            CoReadJournal.record(books[0],0,at,at+60000);CoReadJournal.record(books[1],0,at,at+60000);
            setCoReadTab('me'); coreadCalendarMonth=new Date(2026,8,1); coreadCalendarDay='2026-09-10'; renderCoReadCalendarStats();
        });
        await page.addStyleTag({content:'.app-window {transition:none!important;animation:none!important;}'});
        for(const width of [320,375,430]) {
            await page.setViewportSize({width,height:844});
            for(const safe of [47,59]) for(const parentReserved of [false,true]) {
                await page.evaluate(({safe,parentReserved})=> {
                    document.body.style.paddingTop=parentReserved?`${safe}px`:'0px';
                    const phone=document.querySelector('.phone-container');phone.style.height=`${844-(parentReserved?safe:0)}px`;
                    phone.style.setProperty('--bynd-header-safe-top',parentReserved?'0px':`${safe}px`);
                },{safe,parentReserved});
                const layout=await page.locator('#app-coread-window').evaluate(host=>({top:host.querySelector('.coread-topbar button').getBoundingClientRect().top,overflow:host.scrollWidth-host.clientWidth,
                    cards:[...host.querySelectorAll('.coread-activity-card')].map(card=>card.scrollWidth-card.clientWidth)}));
                assert.ok(layout.top>=safe,JSON.stringify({width,safe,parentReserved,layout}));
                assert.ok(layout.overflow<=1 && layout.cards.every(value=>value<=1),JSON.stringify({width,safe,parentReserved,layout}));
                const frames=await page.locator('#coread-reading-calendar').evaluate(host=>({outer:getComputedStyle(host).borderTopWidth, cards:[...host.querySelectorAll('.coread-activity-card')].map(card=>getComputedStyle(card).borderTopWidth)}));
                assert.equal(frames.outer,'0px'); assert.ok(frames.cards.every(border=>border==='2px'));
                assert.equal(await page.locator('.coread-book-calendar .has-reading').count(),27);
                assert.equal(await page.locator('.coread-streak b').innerText(),'27');
                if(safe===47&&!parentReserved) {
                    await page.locator('.coread-activity-card').first().scrollIntoViewIfNeeded();
                    await page.screenshot({path:path.join(output,`calendar-${width}.png`)});
                    await page.locator('.coread-finished-chart').scrollIntoViewIfNeeded();
                    await page.screenshot({path:path.join(output,`charts-${width}.png`)});
                    await page.locator('.coread-genre-chart').scrollIntoViewIfNeeded();
                    await page.screenshot({path:path.join(output,`genres-${width}.png`)});
                }
            }
        }
        await page.locator('.coread-book-calendar [data-day="2026-09-19"]').click();
        assert.match(await page.locator('.coread-activity-day').innerText(),/背影/);
        const failedRating=await page.evaluate(()=> {
            const before=localStorage.getItem(COREAD_LIBRARY_KEY), original=Storage.prototype.setItem;
            Storage.prototype.setItem=function(key,value){if(key===COREAD_LIBRARY_KEY)throw new Error('quota');return original.call(this,key,value);};
            try {rateCoReadActivityBook('qa-reading-3',2);return before===localStorage.getItem(COREAD_LIBRARY_KEY);}
            finally {Storage.prototype.setItem=original;}
        });
        assert.equal(failedRating,true);assert.match(await page.locator('#coread-activity-error').innerText(),/未保存.*quota/);
        assert.equal(await page.locator('select[data-book-id="qa-reading-3"]').inputValue(),'0');
        await page.evaluate(()=> {rateCoReadActivityBook('qa-reading-3',3);startCoReadBook('qa-reading-3');});
        await page.waitForFunction(()=>CoReadJournal.entries().some(row=>row.date==='2026-10-02'));
        assert.equal(await page.evaluate(()=>CoReadJournal.entries().filter(row=>row.date==='2026-10-02').length),1);
        await page.waitForTimeout(5500);
        await page.evaluate(()=>setCoReadTab('me'));
        const time=await page.evaluate(()=>CoReadJournal.entries().filter(row=>row.date==='2026-10-02').reduce((sum,row)=>sum+row.seconds,0));
        assert.ok(time>=5 && time<15,`actual foreground seconds ${time}`);
        await page.evaluate(()=> {coreadCalendarMonth=new Date(2026,9,1);coreadCalendarDay='2026-10-01';renderCoReadCalendarStats();});
        assert.equal(await page.locator('.coread-activity-day .coread-activity-book').count(),2);
        await page.locator('.coread-finished-chart [data-month="8"]').click();
        assert.match(await page.locator('.coread-activity-head').innerText(),/2026 \/ 09/);
        await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof initCoReadApp==='function'&&window.__byndCoreReady);
        assert.ok(await page.evaluate(()=>CoReadJournal.entries().some(row=>row.date==='2026-10-02')));
        assert.deepEqual(errors,[]);
        fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({safeAreaCases:12,widths:[320,375,430],actualSeconds:time,quoteRequests,errors},null,2));
        console.log('Reading browser checks passed: 12 safe-area layouts, daily online quote state, cover calendar, day details, charts, actual foreground time, reload, quota failures.');
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
