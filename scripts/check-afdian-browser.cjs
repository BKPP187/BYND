'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {fixture,provider,orderNo,root:api}=require('./lib/afdian-test-fixture.cjs');
const {chromium}=require(process.env.BYND_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/payments/afdian');
async function main(){
    fs.mkdirSync(output,{recursive:true});const env=fixture(),mock=provider(env),originalFetch=global.fetch;
    const worker=(await import('../workers/license/worker.mjs')).default,errors=[],checks=[];
    global.fetch=mock.fetch;
    env.ASSETS={fetch:async request=>{const pathname=new URL(request.url).pathname;
        if(!/^\/(?:[a-z-]+\.html|assets\/website\/[a-z0-9-]+\.(?:js|css|webp|png))$/.test(pathname))return new Response('',{status:404});
        const file=path.join(root,pathname.slice(1));if(!fs.existsSync(file))return new Response('',{status:404});
        const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};
        return new Response(fs.readFileSync(file),{headers:{'Content-Type':types[path.extname(file)]}});
    }};
    const server=http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);
        const request=new Request(env.PUBLIC_ORIGIN+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
        const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch{res.writeHead(503);res.end('{}');}});
    let browser;
    try{
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));env.PUBLIC_ORIGIN='http://127.0.0.1:'+server.address().port;
        browser=await chromium.launch({channel:'msedge',headless:true});
        const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
        env.SALES_ENABLED='false';await page.goto(env.PUBLIC_ORIGIN+'/checkout.html?paid=true');
        await page.waitForLoadState('networkidle');assert.equal(await page.locator('#afdian-payment').isHidden(),true);
        assert.equal(await page.locator('#payment-start').isDisabled(),true);checks.push('closed sale and fake return parameter grant nothing');
        await page.screenshot({path:path.join(output,'closed-mobile.png'),fullPage:true});
        env.SALES_ENABLED='true';await context.addCookies([{name:'bynd_account_local',value:env.users[0].cookie,url:env.PUBLIC_ORIGIN}]);
        await page.route('https://afdian.com/oauth2/authorize?**',async route=>{const state=new URL(route.request().url()).searchParams.get('state');
            await route.fulfill({status:302,headers:{location:env.PUBLIC_ORIGIN+'/checkout.html?code=fixture-code&state='+state},body:''});});
        await page.goto(env.PUBLIC_ORIGIN+'/checkout.html');await page.locator('#afdian-link').waitFor();await page.locator('#afdian-link').click();
        await page.locator('#afdian-buy').waitFor();assert.equal(new URL(page.url()).search,'');checks.push('browser OAuth state exchange links the signed-in account');
        assert.equal(await page.locator('#afdian-buy').getAttribute('href'),env.AFDIAN_PURCHASE_URL);
        for(const width of [320,390])for(const inset of [47,59])for(const parent of [false,true]){
            await page.setViewportSize({width,height:844});
            await page.evaluate(({inset,parent})=>{document.body.style.paddingTop=parent?inset+'px':'0';const header=document.querySelector('.site-header');header.style.paddingTop=parent?'0':inset+'px';header.style.height='auto';header.style.minHeight=(parent?70:70+inset)+'px';}, {inset,parent});
            const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,top:document.querySelector('.wordmark').getBoundingClientRect().top+scrollY}));
            assert.equal(layout.overflow,false);assert.ok(layout.top>=inset);checks.push('mobile '+width+' safe-area '+inset+' parent '+parent);
        }
        await page.screenshot({path:path.join(output,'checkout-mobile.png'),fullPage:true});
        await page.locator('#afdian-check-form').evaluate(form=>form.parentElement.open=true);
        await page.locator('#afdian-order-no').fill(orderNo);
        const submit=page.locator('#afdian-check-form button');mock.order.status=0;await submit.click();
        await page.getByText('付款状态、金额或方案不匹配，未发放激活码。',{exact:true}).waitFor();assert.equal(env.DB.database.prepare('SELECT count(*) n FROM licenses').get().n,0);
        mock.order.status=2;mock.order.total_amount='12.88';await Promise.all([page.waitForResponse(r=>r.url().endsWith(api+'check')),submit.click()]);
        assert.equal(env.DB.database.prepare('SELECT count(*) n FROM licenses').get().n,0);checks.push('unpaid and short payment fail in the rendered form');
        mock.order.total_amount='13.88';mock.fail=true;await submit.click();await page.getByText('爱发电暂时无法核验，请稍后重试，不要重复付款。',{exact:true}).waitFor();
        mock.fail=false;await submit.click();await page.waitForURL('**/license-receipt.html**');await page.locator('#receipt-content').waitFor();
        assert.match(await page.locator('#receipt-code').inputValue(),/^BYND(?:-[0-9A-F]{4}){8}$/);checks.push('paid recovery redirects to the existing receipt and reveals one code');
        await page.screenshot({path:path.join(output,'receipt-mobile.png'),fullPage:true});
        await page.goto(env.PUBLIC_ORIGIN+'/license-admin.html');await page.locator('#admin-token').fill(env.ADMIN_TOKEN);await page.locator('#login-form button').click();
        await page.locator('#admin-workspace').waitFor();await page.locator('#afdian-admin-order').fill(orderNo);await page.locator('#afdian-admin-form button').click();
        await page.locator('#license-detail').waitFor();assert.equal(env.DB.database.prepare('SELECT count(*) n FROM licenses').get().n,1);checks.push('admin recheck opens existing license without duplication');
        await page.screenshot({path:path.join(output,'admin-mobile.png'),fullPage:true});
        assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify({checks,errors,externalRequestsIntercepted:true,realPayment:false},null,2));
        console.log('Afdian browser checks passed: '+checks.length+'; no real payment.');
    }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));global.fetch=originalFetch;env.DB.database.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
