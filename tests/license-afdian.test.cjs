const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,bind,call,root,orderNo,provider,now}=require('../scripts/lib/afdian-test-fixture.cjs');
const originalFetch=global.fetch;
function scenario(name,fn) { test('Afdian: '+name,async()=>{const env=fixture(),mock=provider(env);global.fetch=mock.fetch;
    try {await fn(env,mock);} finally {global.fetch=originalFetch;env.DB.database.close();}}); }
const count=env=>env.DB.database.prepare('SELECT count(*) n FROM licenses').get().n;
const check=(env,options={})=>call(env,root+'check',{body:{orderNo},...options});
const notify=(env,extra={},ctx)=>call(env,root+'webhook?key='+env.AFDIAN_WEBHOOK_SECRET,{user:null,ctx,body:{data:{type:'order',order:{out_trade_no:orderNo,...extra}}}});
scenario('closed sale/configuration refuses every fulfillment path',async(env,mock)=>{
    bind(env);
    for(const override of [{SALES_ENABLED:'false'},{AFDIAN_ENABLED:'false'},{AFDIAN_API_TOKEN:''},{AFDIAN_CLIENT_SECRET:''},{AFDIAN_PURCHASE_URL:'https://evil.invalid'}]) {
        const e={...env,...override}; assert.equal((await call(e,root+'config')).body.saleOpen,false);
        assert.equal((await notify(e)).status,503); assert.equal((await check(e)).status,503);
        assert.equal((await call(e,'/admin/v1/pay/afdian/recheck',{admin:true,body:{orderNo}})).status,503);
    } assert.equal(count(env),0);assert.equal(mock.calls,0);
});
scenario('signature matches the official example',async()=>{
    const {afdianSignature}=await import('../workers/license/afdian-client.mjs');
    assert.equal(afdianSignature('123','{"a":333}',1624339905,'abc'),'a4acc28b81598b7e5d84ebdc3e91710c');
});
scenario('fake notification fields never establish payment, owner or price',async(env,mock)=>{
    bind(env); mock.order.status=0;
    assert.equal((await notify(env,{status:2,total_amount:'13.88',user_id:env.users[0].providerId})).body.ec,200);
    assert.equal(mock.calls,1);assert.equal(count(env),0);
    assert.equal(env.DB.database.prepare('SELECT state FROM afdian_jobs').get().state,'rejected');
});
scenario('amount, plan, status, redemption, term and SKU mismatches cannot issue',async(env,mock)=>{
    bind(env);const good={...mock.order};
    for(const bad of [{total_amount:'0.00'},{total_amount:'12.88'},{total_amount:'13.05'},{total_amount:'13.8800'},
        {plan_id:'other'},{status:1},{status:'2'},{redeem_id:'coupon'},{month:2},{product_type:1}]) {
        mock.order={...good,...bad};assert.equal((await check(env)).status,409);assert.equal(count(env),0);
    }
    env.AFDIAN_PRODUCT_TYPE='1';env.AFDIAN_SKU_ID='sku-one';
    mock.order={...good,product_type:1,sku_detail:[{sku_id:'sku-one',count:2}]};assert.equal((await check(env)).status,409);
    mock.order.sku_detail=[{sku_id:'wrong',count:1}];assert.equal((await check(env)).status,409);
    mock.order.sku_detail=[{sku_id:'sku-one',count:1}];assert.equal((await check(env)).status,200);assert.equal(count(env),1);
});
scenario('lost/invalid/redirected/oversized provider responses fail closed and remain retryable',async(env,mock)=>{
    bind(env);
    for(const flag of ['fail','redirect','badJson','oversized']) {
        mock[flag]=true;const result=await check(env);assert.equal(result.status,503);assert.equal(JSON.stringify(result).includes('DO NOT LEAK'),false);mock[flag]=false;
    }
    for(const list of [[],[{...mock.order,out_trade_no:'other'}],[mock.order,mock.order]]) {mock.list=list;assert.equal((await check(env)).status,503);}
    mock.list=null;mock.ec=400005;assert.equal((await check(env)).status,503);mock.ec=200;
    assert.equal(count(env),0);assert.equal((await check(env)).status,200);assert.equal(count(env),1);
});
scenario('OAuth links only a verified single-use state for the same account and session',async(env,mock)=>{
    const start=await call(env,root+'link',{body:{}});assert.equal(start.status,200);
    const state=new URL(start.body.url).searchParams.get('state');
    const body={code:'fixture-code',state};
    assert.equal((await call(env,root+'callback',{body,user:1})).status,403);assert.equal(mock.calls,0);
    const crypto=require('node:crypto'),otherCookie=crypto.randomBytes(32).toString('base64url');
    env.DB.database.prepare('INSERT INTO account_sessions VALUES (?,?,?,?,?)').run(crypto.createHash('sha256').update(otherCookie).digest('base64url'),env.users[0].id,0,now(),now()+600);
    assert.equal((await call(env,root+'callback',{body,headers:{Cookie:'bynd_account_local='+otherCookie}})).status,403);
    assert.equal((await call(env,root+'callback',{body,headers:{Origin:'https://evil.invalid'}})).status,403);
    assert.equal((await call(env,root+'callback',{body})).status,200);
    assert.equal((await call(env,root+'callback',{body})).status,403);
    assert.equal(env.DB.database.prepare('SELECT provider_user_id FROM afdian_accounts').get().provider_user_id,env.users[0].providerId);
    assert.equal(count(env),0);
});
scenario('expired, failed or already-associated OAuth identities cannot change ownership',async(env,mock)=>{
    async function start(user=0) {return new URL((await call(env,root+'link',{body:{},user})).body.url).searchParams.get('state');}
    let state=await start();env.DB.database.exec('UPDATE afdian_oauth_states SET expires_at=1');
    assert.equal((await call(env,root+'callback',{body:{code:'x',state}})).status,403);
    state=await start();mock.fail=true;assert.equal((await call(env,root+'callback',{body:{code:'x',state}})).status,503);
    mock.fail=false;assert.equal((await call(env,root+'callback',{body:{code:'x',state}})).status,403);
    bind(env);state=await start(1);assert.equal((await call(env,root+'callback',{body:{code:'x',state},user:1})).status,409);
    state=await start();mock.oauthUser=env.users[1].providerId;
    assert.equal((await call(env,root+'callback',{body:{code:'x',state}})).status,409);
});
scenario('unbound buyer and stolen order number cannot grant to attacker',async env=>{
    assert.equal((await check(env)).status,503);bind(env);
    assert.equal((await check(env,{user:1})).status,409);assert.equal(count(env),0);
    assert.equal((await check(env,{user:null})).status,401);
    assert.equal((await check(env,{headers:{Origin:'https://evil.invalid'}})).status,403);
    assert.equal((await check(env,{body:{orderNo,paid:true}})).status,400);
});
scenario('replayed and concurrent notifications/checks produce one owned license and one receipt',async env=>{
    bind(env);
    const results=await Promise.all([notify(env),notify(env),check(env),check(env),check(env)]);
    results.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.body)));assert.equal(count(env),1);
    for(const table of ['account_licenses','deliveries','audit_logs','afdian_orders']) assert.equal(env.DB.database.prepare('SELECT count(*) n FROM '+table).get().n,1);
    assert.equal(env.DB.database.prepare('SELECT user_id FROM account_licenses').get().user_id,env.users[0].id);
    const status=(await call(env,root+'status')).body; assert.equal(status.orders.length,1);
    const token=new URL(status.orders[0].receiptUrl).hash.slice(1);
    const receipt=await call(env,'/license/v1/receipt',{body:{token}});
    assert.equal(receipt.status,200,JSON.stringify(receipt));assert.match(receipt.body.licenseKey,/^BYND(?:-[0-9A-F]{4}){8}$/);
    assert.deepEqual((await call(env,root+'status',{user:1})).body.orders,[]);
    env.DB.database.exec("UPDATE licenses SET status='disabled'");
    assert.equal((await call(env,root+'status')).body.orders[0].receiptUrl,null);
    assert.equal((await call(env,'/license/v1/receipt',{body:{token}})).status,403);
});
scenario('database failure rolls back every issuance write, and retry recovers once',async env=>{
    bind(env);env.DB.database.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON deliveries BEGIN SELECT RAISE(FAIL,'private db failure'); END");
    assert.equal((await check(env)).status,503);assert.equal(count(env),0);
    assert.equal(env.DB.database.prepare('SELECT count(*) n FROM account_licenses').get().n,0);
    assert.equal(env.DB.database.prepare('SELECT state FROM afdian_orders').get().state,'verified');
    env.DB.database.exec('DROP TRIGGER fail_receipt');assert.equal((await check(env)).status,200);assert.equal(count(env),1);
});
scenario('acknowledgement follows durable storage; outage retries through scheduled worker',async(env,mock)=>{
    bind(env);mock.fail=true;
    env.DB.failWrites=true;assert.equal((await notify(env)).status,503);env.DB.failWrites=false;
    const tasks=[];assert.equal((await notify(env,{}, {waitUntil:task=>tasks.push(task)})).body.ec,200);
    await Promise.all(tasks);assert.equal(count(env),0);
    assert.equal(env.DB.database.prepare('SELECT state FROM afdian_jobs').get().state,'pending');
    env.DB.database.exec('UPDATE afdian_jobs SET next_at=0');mock.fail=false;
    const worker=(await import('../workers/license/worker.mjs')).default;
    const runs=[];await worker.scheduled({},env,{waitUntil:p=>runs.push(p)});await Promise.all(runs);
    assert.equal(count(env),1);assert.equal(env.DB.database.prepare('SELECT state FROM afdian_jobs').get().state,'done');
});
scenario('crashed processing lease recovers and sales gate also stops scheduled issuance',async(env,mock)=>{
    bind(env);env.DB.database.prepare("INSERT INTO afdian_jobs(out_trade_no,state,next_at,lease) VALUES (?,'processing',0,'dead-process')").run(orderNo);
    const worker=(await import('../workers/license/worker.mjs')).default;
    async function tick(){const tasks=[];await worker.scheduled({},env,{waitUntil:p=>tasks.push(p)});await Promise.all(tasks);}
    env.SALES_ENABLED='false';await tick();assert.equal(count(env),0);assert.equal(mock.calls,0);
    env.SALES_ENABLED='true';await tick();assert.equal(count(env),1);
    await tick();assert.equal(count(env),1);
});
scenario('admin compensation is authenticated and re-queries authoritative payment',async(env,mock)=>{
    bind(env);const route='/admin/v1/pay/afdian/recheck';
    assert.equal((await call(env,route,{body:{orderNo}})).status,401);assert.equal(mock.calls,0);
    mock.order.status=0;assert.equal((await call(env,route,{body:{orderNo},admin:true})).status,409);assert.equal(count(env),0);
    mock.order.status=2;assert.equal((await call(env,route,{body:{orderNo},admin:true})).status,200);assert.equal(count(env),1);
    assert.equal((await call(env,route,{body:{orderNo},admin:true})).status,200);assert.equal(count(env),1);
});
scenario('rate limits reject invalid webhook traffic without query and storefront routes through checkout',async(env,mock)=>{
    assert.equal((await call(env,root+'webhook',{user:null,body:{data:{type:'order',order:{out_trade_no:orderNo}}}})).status,403);
    assert.equal((await notify(env,{out_trade_no:'https://evil.invalid'})).status,400);assert.equal(mock.calls,0);
    const store=await call(env,'/distribution/v1/store');assert.equal(store.body.purchaseUrl,env.PUBLIC_ORIGIN+'/checkout.html');assert.equal(store.body.priceLabel,'¥13.88');
    env.PAYMENT_RATE_LIMITER={limit:async()=>({success:false})};assert.equal((await notify(env)).status,429);assert.equal(mock.calls,0);
});
