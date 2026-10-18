'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/coreading-reviews');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({channel:'msedge',headless:true});
    const page = await browser.newPage({viewport:{width:375,height:844},isMobile:true,hasTouch:true});
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1','1'));
        await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(() => window.__byndCoreReady && typeof openCoReadBookDetail === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady;
            unlockPhone(); window.ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime');
            const content = ['第 1 章 紧急迫降指南','最后，她只是说：“路上小心。”','梁域“嗯”了一声，穿好鞋，拉开门，又忽然回头看了她一眼：“说明书留在这，别弄丢了。”',
                '门关上了。理由站在玄关，安静了几秒，然后转身走回客厅。她看着那个半成品的猫爬架，底座稳固，几根柱子笔直地立着。',
                '她走过去，伸手摸了摸那块被他打磨得结实的木板。原来一个人的耐心，可以具体到这种程度。'].join('\n\n');
            const cover = 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="145"><rect width="100" height="145" fill="#d7dfd9"/><text x="50" y="60" text-anchor="middle" font-size="15" fill="#47534c">行星坠落</text><text x="50" y="85" text-anchor="middle" font-size="15" fill="#47534c">说明书</text></svg>');
            saveCoReadLibrary([{id:'review-qa',title:'行星坠落说明书',author:'一勺苏打',description:'关于如何处理坠落的行星、走失的耐心和一些悄悄萌芽的心事。',content:content+'\n\n'+content.repeat(5),coverUrl:cover,tags:['日常','温馨治愈'],reviews:[
                {id:'seed-a',nickname:'人间观察员',text:'这句“路上小心”好克制，像把关心藏进了日常里。[流泪]',likes:179,createdAt:Date.now()-3600000,source:'api'},
                {id:'seed-b',nickname:'急死我了',text:'谢谢只是嘴上说说，留下来的猫爬架才是答案。',likes:205,createdAt:Date.now()-7200000,source:'api'}]}]);
            openApp('coread'); openCoReadBookDetail('review-qa');
            window.__reviewApiCalls=0;
            window.callChatApi=async()=>{window.__reviewApiCalls++;return {ok:true,content:'{"text":"是呀，行动比台词更动人！[爱心]"}'};};
        });
        await page.addStyleTag({content:'.app-window{transition:none!important;animation:none!important}.tapfx-layer{display:none!important}'});
        const input = page.locator('#coread-book-review-input');
        await input.fill('慢慢读才看见这些细节。');
        await page.locator('#coread-book-detail button[type=submit]').click();
        assert.equal(await page.locator('#coread-book-detail .coread-book-review').count(),3);
        await page.locator('[data-review-id="seed-b"] button[aria-label="回复"]').click();
        await input.fill('同意，行动比台词更动人。');
        await page.locator('#coread-book-detail button[type=submit]').click();
        await page.waitForFunction(()=>getCoReadBook('review-qa').reviews.filter(item=>item.parentId==='seed-b').length===2);
        assert.equal(await page.locator('#coread-book-detail .is-reply').count(),2);
        assert.equal(await page.evaluate(()=>window.__reviewApiCalls),1);
        assert.match(await page.locator('[data-review-id="seed-a"] p').innerText(),/😢/);
        assert.match(await page.locator('#coread-book-detail .is-reply p').last().innerText(),/❤️/);
        assert.equal(await page.locator('.coread-book-review img').count(),0);
        assert.doesNotMatch(await page.locator('#coread-book-detail').innerText(),/模拟读者观点|AI 模拟读者|我的评论/);
        const composerLayout=await page.locator('#coread-book-detail').evaluate(host=>({
            position:getComputedStyle(host.querySelector('.coread-review-compose')).position,
            listTop:host.querySelector('.coread-book-review-list').getBoundingClientRect().top,
            composeBottom:host.querySelector('.coread-review-compose').getBoundingClientRect().bottom,
            shellScroll:document.querySelector('.coread-shell').scrollTop
        }));
        assert.equal(composerLayout.position,'static'); assert.ok(composerLayout.composeBottom<=composerLayout.listTop);
        assert.equal(composerLayout.shellScroll,0);
        assert.equal(await page.locator('#coread-book-detail').getByRole('button',{name:'讨论',exact:true}).innerText(),'讨论');
        await page.locator('[data-review-id="seed-b"] button[aria-label="赞"]').click();
        assert.equal(await page.locator('[data-review-id="seed-b"] button[aria-label="赞"]').getAttribute('aria-pressed'),'true');
        await page.getByRole('button',{name:'最新',exact:true}).click();
        assert.match(await page.locator('#coread-book-detail .coread-book-review').first().innerText(),/慢慢读/);
        await page.evaluate(()=>{
            const content=document.querySelector('.coread-content'), panel=document.querySelector('#coread-book-detail .coread-book-review-panel');
            content.scrollTop+=panel.getBoundingClientRect().top-content.getBoundingClientRect().top;
        });
        await page.screenshot({path:path.join(output,'book-375.png')});
        await page.getByRole('button',{name:'开始阅读',exact:true}).last().click();
        const current = await page.evaluate(() => getCoReadBook('review-qa').page || 0);
        await page.locator('.coread-paragraph-count').nth(1).tap();
        assert.equal(await page.evaluate(() => getCoReadBook('review-qa').page || 0),current,'Opening a paragraph must not turn the page');
        assert.match(await page.locator('.coread-review-quote').innerText(),/路上小心/);
        await page.locator('#coread-paragraph-review-input').fill('这句很温柔。');
        await page.locator('#coread-paragraph-reviews button[type=submit]').tap();
        assert.equal(await page.locator('#coread-paragraph-reviews .coread-book-review').count(),1);
        await page.evaluate(() => { window.callChatApi=async()=>({ok:true,content:'[{"nickname":"晚风","text":"她没有多说，却把关心留住了。[流泪]","likes":12}]'}); });
        await page.getByRole('button',{name:'讨论',exact:true}).tap();
        await page.waitForFunction(() => getCoReadScopedReviews(getCoReadBook('review-qa'), coreadReviewAnchor).length === 2);
        assert.match(await page.locator('#coread-paragraph-reviews .coread-book-review p').filter({hasText:'她没有多说'}).innerText(),/😢/);
        assert.equal(await page.locator('#coread-paragraph-reviews .coread-book-review img').count(),0);
        assert.doesNotMatch(await page.locator('#coread-paragraph-reviews').innerText(),/模拟读者观点|AI 模拟读者|我的评论/);
        for (const width of [320,375,430]) {
            await page.setViewportSize({width,height:844});
            for (const safe of [47,59]) for (const parentReserved of [false,true]) {
                await page.evaluate(({safe,parentReserved}) => {
                    document.body.style.paddingTop=parentReserved?`${safe}px`:'0px';
                    const phone=document.querySelector('.phone-container');phone.style.height=`${844-(parentReserved?safe:0)}px`;
                    phone.style.setProperty('--bynd-header-safe-top',parentReserved?'0px':`${safe}px`);
                },{safe,parentReserved});
                const layout = await page.locator('#app-coread-window').evaluate(host => {
                    const sheet=host.querySelector('.coread-review-sheet'), input=host.querySelector('#coread-paragraph-review-input');
                    return {top:host.querySelector('.coread-topbar button').getBoundingClientRect().top,overflow:host.scrollWidth-host.clientWidth,
                        sheetOverflow:sheet.scrollWidth-sheet.clientWidth,inputBottom:input.getBoundingClientRect().bottom};
                });
                assert.ok(layout.top>=safe && layout.overflow<=1 && layout.sheetOverflow<=1 && layout.inputBottom<=844,JSON.stringify({width,safe,parentReserved,layout}));
                await page.screenshot({path:path.join(output,`paragraph-${width}-${safe}-${parentReserved?'parent':'header'}.png`)});
                await page.locator('#coread-paragraph-reviews').getByRole('button',{name:'投喂',exact:true}).tap();
                await page.locator('#coread-author-support-message').fill('喜欢你笔下的日常，继续写下去吧。');
                const modal=await page.locator('.coread-author-support-card').evaluate(el=>({
                    top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,overflow:el.scrollWidth-el.clientWidth
                }));
                assert.ok(modal.top>=safe && modal.bottom<=844 && modal.overflow<=1,JSON.stringify({width,safe,parentReserved,modal}));
                assert.equal(await page.locator('#coread-paragraph-reviews').evaluate(el=>el.inert),true);
                await page.screenshot({path:path.join(output,`feed-${width}-${safe}-${parentReserved?'parent':'header'}.png`)});
                await page.locator('.coread-author-support-card button[aria-label="关闭作者支持"]').tap();
                assert.equal(await page.locator('#coread-paragraph-reviews').evaluate(el=>el.inert),false);
            }
        }
        await page.evaluate(()=>{window.callChatApi=async messages=>{
            const prompt=JSON.parse(messages[1].content);window.__reviewLastPrompt=prompt;
            return {ok:true,content:JSON.stringify({text:prompt.giftRecipient==='author'?'谢谢投喂和支持，我会继续写下去！':'一起继续读，这段后劲很大。'})};
        };});
        const readerId=await page.evaluate(()=>getCoReadScopedReviews(getCoReadBook('review-qa'),coreadReviewAnchor).find(item=>item.source==='api').id);
        await page.locator(`#coread-paragraph-reviews [data-review-id="${readerId}"] button[aria-label="回复"]`).tap();
        await page.locator('#coread-paragraph-review-input').fill('给读者的回复草稿');
        await page.locator('#coread-paragraph-reviews').getByRole('button',{name:'投喂',exact:true}).tap();
        assert.equal(await page.locator('#coread-author-support-message').inputValue(),'喜欢你笔下的日常，继续写下去吧。');
        const failedFeed=await page.evaluate(async()=>{
            const native=Storage.prototype.setItem, before=localStorage.getItem(COREAD_LIBRARY_KEY);
            Storage.prototype.setItem=function(key,value){if(key===COREAD_LIBRARY_KEY)throw new Error('quota');return native.call(this,key,value);};
            try { await submitCoReadAuthorSupport(); return {same:before===localStorage.getItem(COREAD_LIBRARY_KEY),hidden:document.getElementById('coread-author-support').hidden,
                message:document.getElementById('coread-author-support-message').value,error:coreadAuthorSupport.error}; }
            finally {Storage.prototype.setItem=native;}
        });
        assert.equal(failedFeed.same,true); assert.equal(failedFeed.hidden,false); assert.match(failedFeed.error,/quota/);assert.match(failedFeed.message,/继续写/);
        await page.keyboard.press('Escape');
        await page.locator('#coread-author-support').waitFor({state:'hidden'});
        await page.locator('#coread-paragraph-reviews').getByRole('button',{name:'投喂',exact:true}).tap();
        await page.locator('#coread-author-support-message').fill('把这份鼓励投喂给作者。');
        await page.locator('#coread-author-support-confirm').tap();
        await page.waitForFunction(()=>getCoReadScopedReviews(getCoReadBook('review-qa'),coreadReviewAnchor).length===4);
        await page.locator('#coread-author-support').waitFor({state:'hidden'});
        assert.equal(await page.locator('#coread-paragraph-review-input').inputValue(),'给读者的回复草稿');
        assert.equal(await page.evaluate(()=>window.__reviewLastPrompt.nickname),'一勺苏打');
        assert.equal(await page.evaluate(()=>window.__reviewLastPrompt.giftRecipient),'author');
        assert.equal(await page.evaluate(()=>window.__reviewLastPrompt.giftMessage),'把这份鼓励投喂给作者。');
        assert.match(await page.locator('#coread-paragraph-reviews .coread-book-review').filter({hasText:'谢谢投喂和支持'}).innerText(),/一勺苏打.*作者/s);
        assert.equal(await page.evaluate(()=>getCoReadBook('review-qa').reviews.find(item=>item.kind==='author-gift').parentId||''),'');
        await page.locator('#coread-paragraph-reviews button[type=submit]').tap();
        await page.waitForFunction(()=>getCoReadScopedReviews(getCoReadBook('review-qa'),coreadReviewAnchor).length===6);
        assert.equal(await page.evaluate(()=>window.__reviewLastPrompt.nickname),'晚风');
        await page.evaluate(()=>{window.callChatApi=async()=>({ok:false,error:'reply offline'});});
        await page.locator(`#coread-paragraph-reviews [data-review-id="${readerId}"] button[aria-label="回复"]`).tap();
        await page.locator('#coread-paragraph-review-input').fill('失败也要保留这条回复');
        await page.locator('#coread-paragraph-reviews button[type=submit]').tap();
        await page.getByRole('button',{name:'重试回复',exact:true}).waitFor();
        assert.match(await page.locator('#coread-paragraph-reviews .coread-review-status').innerText(),/评论已保存.*reply offline/);
        await page.evaluate(()=>{window.callChatApi=async()=>({ok:true,content:'{"text":"我又回来啦，继续聊。"}'});});
        await page.getByRole('button',{name:'重试回复',exact:true}).tap();
        await page.waitForFunction(()=>getCoReadScopedReviews(getCoReadBook('review-qa'),coreadReviewAnchor).length===8);
        for(const [label,count] of [['充电',10],['月卡',12]]) {
            await page.locator('#coread-paragraph-reviews').getByRole('button',{name:label,exact:true}).tap();
            assert.equal(await page.locator('#coread-author-support-message').count(),0);
            await page.locator('#coread-author-support-confirm').tap();
            await page.waitForFunction(count=>getCoReadScopedReviews(getCoReadBook('review-qa'),coreadReviewAnchor).length===count,count);
            await page.locator('#coread-author-support').waitFor({state:'hidden'});
        }
        assert.equal(await page.locator('.coread-shell').evaluate(el=>el.scrollTop),0,'Reply focus must not scroll the entire app and hide the sheet title');
        assert.ok(await page.locator('.coread-review-sheet-head strong').evaluate(el=>el.getBoundingClientRect().top>=59));
        await page.screenshot({path:path.join(output,'reply-and-gift-430.png')});
        await page.setViewportSize({width:320,height:844});
        await page.evaluate(()=>{
            document.body.style.paddingTop='0px'; const phone=document.querySelector('.phone-container');
            phone.style.height='844px';phone.style.setProperty('--bynd-header-safe-top','59px');
        });
        const longThread=await page.locator('.coread-review-sheet').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,
            title:el.querySelector('.coread-review-sheet-head').getBoundingClientRect().top,
            input:el.querySelector('textarea').getBoundingClientRect().bottom,scroll:document.querySelector('.coread-shell').scrollTop}));
        assert.ok(longThread.title>=59 && longThread.input<=844 && longThread.overflow<=1 && longThread.scroll===0,JSON.stringify(longThread));
        await page.screenshot({path:path.join(output,'reply-and-gift-320.png')});
        const failed = await page.evaluate(() => {
            const native=Storage.prototype.setItem, before=localStorage.getItem(COREAD_LIBRARY_KEY);
            document.getElementById('coread-paragraph-review-input').value='存储失败时必须留下的草稿';
            Storage.prototype.setItem=function(key,value){if(key===COREAD_LIBRARY_KEY)throw new Error('quota');return native.call(this,key,value);};
            try { addCoReadUserBookReview('review-qa',true); return {same:before===localStorage.getItem(COREAD_LIBRARY_KEY),text:document.getElementById('coread-paragraph-review-input').value,status:document.querySelector('#coread-paragraph-reviews [role=status]').textContent}; }
            finally { Storage.prototype.setItem=native; }
        });
        assert.equal(failed.same,true); assert.match(failed.text,/草稿/); assert.match(failed.status,/发送失败.*quota/);
        await page.evaluate(() => { window.callChatApi=async()=>({ok:false,error:'offline'}); });
        await page.getByRole('button',{name:'讨论',exact:true}).tap();
        assert.match(await page.locator('#coread-paragraph-reviews [role=status]').innerText(),/评论未保存.*offline/);
        await page.locator('.coread-review-close').tap();
        assert.equal(await page.locator('.coread-content').evaluate(el=>el.inert),false);
        await page.locator('.coread-paragraph-count').nth(1).tap();
        assert.match(await page.locator('#coread-paragraph-review-input').inputValue(),/草稿/);
        await page.locator('.coread-review-close').tap();
        await page.evaluate(() => saveCoReadReaderSettings({pageMode:'scroll'}));
        await page.locator('.coread-paragraph-count').nth(1).tap();
        assert.equal(await page.locator('#coread-paragraph-reviews .coread-book-review').count(),12);
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>typeof getCoReadBook==='function');
        assert.equal(await page.evaluate(()=>getCoReadBook('review-qa').reviews.length),17);
        await page.setViewportSize({width:375,height:844});
        await page.evaluate(async()=>{
            await window.__byndCoreReady;await window.byndStylesReady;
            unlockPhone();window.ByndBuiltinLibrary?.close();document.documentElement.classList.add('mobile-runtime');
            saveCoReadReviewMutation('review-qa',book=>{book.title='《垂耳兔热事》';book.author='';book.description='小说角色甩甩兔耳朵。';});
            openApp('coread');coreadReviewSort='latest';openCoReadBookDetail('review-qa');
            window.callChatApi=async messages=>{window.__authorIdentityPrompt=JSON.parse(messages[1].content);return {ok:true,content:'{"text":"垂耳兔热事甩甩耳朵给你比心！"}'};};
        });
        await page.locator('#coread-book-detail').getByRole('button',{name:'投喂',exact:true}).tap();
        assert.match(await page.locator('[data-review-id="seed-a"] p').innerText(),/😢/);
        await page.locator('#coread-author-support-message').fill('感谢作者写了这么好的故事');
        await page.locator('#coread-author-support-confirm').tap();
        await page.locator('#coread-author-support').waitFor({state:'hidden'});
        assert.equal(await page.evaluate(()=>getCoReadBook('review-qa').reviews.length),18);
        assert.equal(await page.evaluate(()=>window.__authorIdentityPrompt.book),undefined);
        assert.equal(await page.evaluate(()=>window.__authorIdentityPrompt.original),undefined);
        assert.equal(await page.evaluate(()=>window.__authorIdentityPrompt.nickname),'作者');
        assert.equal(await page.locator('#coread-book-detail .coread-book-review p').filter({hasText:'垂耳兔热事甩甩耳朵'}).count(),0);
        await page.evaluate(()=>{window.callChatApi=async()=>({ok:true,content:'{"text":"谢谢你的鼓励，我会继续认真写下去！"}'});});
        await page.getByRole('button',{name:'重试回复',exact:true}).tap();
        await page.waitForFunction(()=>getCoReadBook('review-qa').reviews.length===19);
        const cleanAuthor=page.locator('#coread-book-detail .coread-book-review').filter({hasText:'谢谢你的鼓励，我会继续认真写下去'});
        assert.match(await cleanAuthor.locator('header').innerText(),/作者/);
        await page.addStyleTag({content:'.tapfx-layer{display:none!important}'});
        await cleanAuthor.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(output,'author-identity-375.png')});
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({ok:true,safeAreaLayouts:12,feedModalLayouts:12,savedReviews:19,authorIdentity:true,staticComposer:true,apiReplyAndRetry:true,giftsToAuthor:true,noPublicNotes:true,noAvatars:true,screenshots:output}));
    } finally { await browser.close(); }
})().catch(error=>{ console.error(error);process.exitCode=1; });
