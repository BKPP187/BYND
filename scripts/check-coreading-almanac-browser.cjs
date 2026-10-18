'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.qa-screenshots/daily-almanac');
fs.mkdirSync(output, {recursive:true});
(async () => {
    const browser = await chromium.launch({channel:'msedge',headless:true});
    const page = await browser.newPage({viewport:{width:375,height:844},isMobile:true,hasTouch:true});
    const errors = []; let historyCalls=0, offline=false, badPrimary=false, live=false;
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.addInitScript(() => {
            localStorage.setItem('bynd_builtin_library_seen_v1','1');
            const NativeDate=Date; window.almanacNativeDate=NativeDate; window.almanacTestNow=new NativeDate(2026,9,17,12).getTime();
            window.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[window.almanacTestNow]));} static now(){return window.almanacTestNow;}};
        });
        await page.route(/^https:\/\/(?:v2\.xxapi\.cn|today\.historiqly\.com|v1\.hitokoto\.cn|v1\.jinrishici\.com|zh\.wikipedia\.org|www\.googleapis\.com)\//,async route => {
            const url=route.request().url();
            const quote='大树有大树的长法，小草有小草的长法；这世上大部分的人，都是小草。你不是孤独的。';
            if(url.startsWith('https://v1.hitokoto.cn/')) return route.fulfill({contentType:'application/json',body:JSON.stringify({hitokoto:quote,from_who:'龙应台',from:'亲爱的安德烈'})});
            if(url.startsWith('https://v1.jinrishici.com/')) return route.fulfill({contentType:'application/json',body:JSON.stringify({content:quote,author:'测试作者',origin:'测试出处'})});
            if(url.startsWith('https://v2.xxapi.cn/')) {
                historyCalls++;
                if(live) return route.continue();
                if(offline) return route.abort();
                if(badPrimary) return route.fulfill({contentType:'application/json',body:JSON.stringify({code:500,msg:'failure'})});
                const data=Array.from({length:15},(_,i)=>`${2000-i}年10月17日 第${i+1}件历史事件。`+'用于验证长事件内容可以完整滚动阅读。'.repeat(14));
                data.push('2027年10月17日 未来事件不能出现。','1990年10月17日 <img onerror=alert(1)>不可信内容');
                return route.fulfill({contentType:'application/json',body:JSON.stringify({code:200,data})});
            }
            if(url.startsWith('https://today.historiqly.com/')) {
                if(offline) return route.abort();
                return route.fulfill({contentType:'text/html',body:`<link rel="canonical" href="${url}"><section id="featured"><span class="featured-year-badge">1777</span><h2 class="featured-title">焦点事件标题</h2><p class="featured-description">焦点事件的中文详情。</p></section><section id="events"><article class="timeline-item" id="event-0"><span class="tl-year">1900</span><h3 class="tl-title">另一件历史事件</h3><p class="tl-desc">历史事件的中文详情。</p></article></section>`});
            }
            return route.abort();
        });
        await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.__byndCoreReady && typeof openChat==='function');
        await page.addStyleTag({content:'.app-window {transition:none!important;animation:none!important;}'});
        await page.evaluate(async()=>{await __byndCoreReady;await byndStylesReady;unlockPhone();window.ByndBuiltinLibrary?.close();document.documentElement.classList.add('mobile-runtime');openApp('coread');});
        await page.waitForFunction(()=>CoReadAlmanac.history()?.events.length===15);
        await page.waitForFunction(()=>document.getElementById('app-coread-window').getBoundingClientRect().top<1);
        assert.equal(historyCalls,1);
        assert.equal(await page.locator('.coread-history-event').count(),15);
        assert.equal(await page.locator('.coread-history summary').count(),0);
        assert.doesNotMatch(await page.locator('.coread-history-body').innerText(),/2027|不可信/);
        assert.equal(await page.locator('.coread-history-body img, .coread-history-body script').count(),0);
        await page.screenshot({path:path.join(output,'events-initial-375.png')});

        // A genuine finger gesture must move the scroll container. scrollIntoView can
        // programmatically move overflow:hidden ancestors, concealing this regression.
        const cdp=await page.context().newCDPSession(page);
        const scrollBefore=await page.locator('.coread-content').evaluate(el=>el.scrollTop);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:660}]});
        for(let y=640;y>=250;y-=30){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y}]});await new Promise(done=>setTimeout(done,16));}
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await page.waitForFunction(before=>document.querySelector('.coread-content').scrollTop>before+100,scrollBefore);
        // Let the touch fling finish before switching to desktop wheel input.
        await new Promise(done=>setTimeout(done,1000));
        await page.mouse.move(180,400);
        for(let i=0;i<8;i++){await page.mouse.wheel(0,2000);await new Promise(done=>setTimeout(done,120));}
        await page.waitForFunction(()=>{const el=document.querySelector('.coread-content');return el.scrollHeight-el.clientHeight-el.scrollTop<2;});
        const layout=await page.locator('.coread-history-more').evaluate(element=>{
            const bottom=element.getBoundingClientRect().bottom, nav=document.querySelector('.coread-bottom-nav').getBoundingClientRect().top;
            const clips=[];
            for(let node=element.parentElement;node&&!node.classList.contains('coread-content');node=node.parentElement){if(['hidden','clip'].includes(getComputedStyle(node).overflowY)&&bottom>node.getBoundingClientRect().bottom+1)clips.push(node.className);}
            return {bottom,nav,clips};
        });
        assert.deepEqual(layout.clips,[]); assert.ok(layout.bottom<=layout.nav,JSON.stringify(layout));
        await page.screenshot({path:path.join(output,'events-bottom-375.png')});
        await page.evaluate(()=>renderCoReadDaily()); assert.equal(historyCalls,1);

        badPrimary=true;
        await page.evaluate(()=>CoReadAlmanac.refreshHistory(true));
        assert.equal(await page.evaluate(()=>CoReadAlmanac.history().provider),'HistorIQly');
        assert.match(await page.locator('.coread-history-body').innerText(),/焦点事件标题.*焦点事件的中文详情/s);
        offline=true;
        await page.evaluate(()=>{window.almanacTestNow=new Date(2026,9,18,12).getTime();return CoReadAlmanac.refreshHistory(true);});
        assert.equal(await page.locator('.coread-history-event').count(),0);
        assert.match(await page.locator('.coread-history-status').innerText(),/重试/);
        const callsAfterFailure=historyCalls; await page.evaluate(()=>renderCoReadDaily()); assert.equal(historyCalls,callsAfterFailure);
        offline=false; badPrimary=false;
        await page.evaluate(()=>{window.almanacTestNow=new Date(2026,9,17,12).getTime();return CoReadAlmanac.refreshHistory(true);});
        await page.waitForFunction(()=>CoReadAlmanac.history()?.provider==='小小API');

        for(const [month,day,title] of [[2,14,'情人节'],[6,19,'端午'],[10,1,'国庆'],[10,8,'寒露'],[10,23,'霜降'],[2,25,'初九']]){
            await page.evaluate(({month,day})=>{window.almanacTestNow=new Date(2026,month-1,day,12).getTime();renderCoReadDaily();},{month,day});
            assert.equal(await page.locator('.coread-sense-title-text').innerText(),title);
        }
        await page.addStyleTag({content:'.app-window {transition:none!important;animation:none!important;}'});
        for(const width of [320,375,430]){
            await page.setViewportSize({width,height:844});
            for(const safe of [47,59])for(const parentReserved of [false,true]){
                await page.evaluate(({safe,parentReserved})=>{
                    document.body.style.paddingTop=parentReserved?`${safe}px`:'0px';
                    const phone=document.querySelector('.phone-container');phone.style.height=`${844-(parentReserved?safe:0)}px`;
                    phone.style.setProperty('--bynd-header-safe-top',parentReserved?'0px':`${safe}px`);
                    document.querySelector('.coread-content').scrollTop=0;
                },{safe,parentReserved});
                const box=await page.locator('#app-coread-window').evaluate(host=>({top:host.querySelector('.coread-topbar button').getBoundingClientRect().top,overflow:host.scrollWidth-host.clientWidth}));
                assert.ok(box.top>=safe&&box.overflow<=1,JSON.stringify({width,safe,parentReserved,box}));
                await page.screenshot({path:path.join(output,`events-safe-${width}-${safe}-${parentReserved?'parent':'header'}.png`)});
            }
        }
        // Verify the actual user-supplied API from the app's browser origin as well.
        live=true;
        await page.evaluate(()=>{
            const native=new window.almanacNativeDate(); window.almanacTestNow=native.getTime();
            document.body.style.paddingTop='0'; const phone=document.querySelector('.phone-container');phone.style.height='844px';phone.style.setProperty('--bynd-header-safe-top','0px');
            return CoReadAlmanac.refreshHistory(true);
        });
        const actual=await page.evaluate(()=>({provider:CoReadAlmanac.history()?.provider,count:CoReadAlmanac.history()?.events.length,status:CoReadAlmanac.historyStatus}));
        assert.equal(actual.provider,'小小API',JSON.stringify(actual)); assert.ok(actual.count>0);
        await page.locator('.coread-content').evaluate(el=>{el.scrollTop=550;});
        await page.screenshot({path:path.join(output,'events-live-api.png')});
        assert.deepEqual(errors,[]);
        console.log(`Almanac browser checks: real touch and wheel scrolling, 15 long events, API/fallback/failure/retry, 12 safe-area layouts, live API (${actual.count} events) passed.`);
    }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
