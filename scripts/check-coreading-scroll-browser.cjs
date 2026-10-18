'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'), output=path.join(root,'.qa-screenshots/coreading-scroll');
const reviewCount=process.argv.includes('--long')?18:3;
fs.mkdirSync(output,{recursive:true});
(async()=>{
    const browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:375,height:844},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://**/*',route=>route.abort());
    try {
        await page.addInitScript(()=>localStorage.setItem('bynd_builtin_library_seen_v1','1'));
        await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.__byndCoreReady && typeof openCoReadBookDetail==='function');
        await page.evaluate(async(reviewCount)=>{
            await window.__byndCoreReady;await window.byndStylesReady;
            unlockPhone();window.ByndBuiltinLibrary?.close();document.documentElement.classList.add('mobile-runtime');
            const reviews=Array.from({length:reviewCount},(_,i)=>({id:`scroll-${i}`,nickname:`读者${i}`,text:'这段里的细节很温柔，想接着读下去。'.repeat(3),likes:50-i,createdAt:Date.now()-i*60000,source:'api'}));
            reviews.push({id:'tail-gift',nickname:'上官落',text:'向作者赠送了糖果',gift:'candy',source:'user',likes:0,createdAt:1},
                {id:'tail-reply',nickname:'作者',personaRole:'author',source:'api',parentId:'tail-gift',replyTo:'上官落',likes:0,createdAt:2,
                    text:'谢谢上官落送的小糖果！收到投喂超开心，今天码字动力瞬间拉满。'.repeat(7)+'【这句是回复的结尾】'});
            saveCoReadLibrary([{id:'scroll-book',title:'末条回复滚动检查',author:'作者',content:'阅读正文。'.repeat(120),reviews,
                coverUrl:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="145"><rect width="100" height="145" fill="#ddd"/></svg>')}]);
            openApp('coread');coreadReviewSort='hot';openCoReadBookDetail('scroll-book');
        },reviewCount);
        await page.addStyleTag({content:'.app-window{transition:none!important;animation:none!important}.tapfx-layer{display:none!important}'});
        const results=[];
        for(const width of [320,375,430]) {
            await page.setViewportSize({width,height:844});
            for(const safe of [47,59]) for(const parentReserved of [false,true]) {
                await page.evaluate(({safe,parentReserved})=>{
                    document.body.style.paddingTop=parentReserved?`${safe}px`:'0px';
                    const phone=document.querySelector('.phone-container');phone.style.height=`${844-(parentReserved?safe:0)}px`;
                    phone.style.setProperty('--bynd-header-safe-top',parentReserved?'0px':`${safe}px`);
                    const content=document.querySelector('.coread-content');content.scrollTop=content.scrollHeight;
                },{safe,parentReserved});
                const geometry=await page.locator('#app-coread-window').evaluate(host=>{
                    const content=host.querySelector('.coread-content'),last=host.querySelector('[data-review-id="tail-reply"]');
                    const detail=host.querySelector('.coread-book-detail'),panel=host.querySelector('.coread-book-review-panel');
                    const nav=host.querySelector('.coread-bottom-nav').getBoundingClientRect(),end=last.querySelector('footer').getBoundingClientRect();
                    return {navTop:nav.top,lastBottom:last.getBoundingClientRect().bottom,textBottom:last.querySelector('p').getBoundingClientRect().bottom,
                        controlsBottom:end.bottom,scrollTop:content.scrollTop,maxScroll:content.scrollHeight-content.clientHeight,
                        paddingBottom:getComputedStyle(content).paddingBottom,detailHeight:detail.clientHeight,detailScrollHeight:detail.scrollHeight,
                        detailShrink:getComputedStyle(detail).flexShrink,panelOverflow:getComputedStyle(panel).overflowY,
                        headerTop:host.querySelector('.coread-topbar button').getBoundingClientRect().top,overflow:host.scrollWidth-host.clientWidth};
                });
                results.push({width,safe,parentReserved,...geometry});
                await page.screenshot({path:path.join(output,`bottom-${reviewCount}-${width}-${safe}-${parentReserved?'parent':'header'}.png`)});
            }
        }
        const clipped=results.filter(item=>item.controlsBottom>item.navTop-10 || item.textBottom>item.navTop-10);
        assert.equal(clipped.length,0,`Last author reply is clipped in ${clipped.length} layouts: ${JSON.stringify(clipped[0])}`);
        assert.ok(results.every(item=>item.headerTop>=item.safe && item.overflow<=1 && Math.abs(item.maxScroll-item.scrollTop)<=1));
        await page.setViewportSize({width:1280,height:1000});
        await page.evaluate(()=>{
            document.documentElement.classList.remove('mobile-runtime');document.body.style.paddingTop='0px';
            const phone=document.querySelector('.phone-container');phone.style.height='844px';phone.style.removeProperty('--bynd-header-safe-top');
            const content=document.querySelector('.coread-content');content.scrollTop=content.scrollHeight;
        });
        const desktop=await page.locator('#app-coread-window').evaluate(host=>({
            navTop:host.querySelector('.coread-bottom-nav').getBoundingClientRect().top,
            controlsBottom:host.querySelector('[data-review-id="tail-reply"] footer').getBoundingClientRect().bottom
        }));
        assert.ok(desktop.controlsBottom<=desktop.navTop-10,JSON.stringify(desktop));
        await page.screenshot({path:path.join(output,`bottom-${reviewCount}-desktop.png`)});
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({ok:true,reviews:reviewCount,layouts:results.length,desktop:true,minimumClearance:Math.min(...results.map(item=>item.navTop-item.controlsBottom)),screenshots:output}));
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
