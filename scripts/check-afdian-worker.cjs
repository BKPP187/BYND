'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {fixture,provider,orderNo,root:api,now}=require('./lib/afdian-test-fixture.cjs');
const {Miniflare,Response:WorkerResponse,convertV4MiniflareOptions}=require(process.env.BYND_MINIFLARE||'miniflare');
async function main(){
    const env=fixture(),mock=provider(env),source=path.resolve(__dirname,'../workers/license');
    const bindings=Object.fromEntries(Object.entries(env).filter(([,value])=>typeof value==='string'));
    const options={workers:[{name:'afdian-runtime-test',modulesRoot:source,
        modules:['worker.mjs',...fs.readdirSync(source).filter(file=>file.endsWith('.mjs')&&file!=='worker.mjs')].map(file=>({type:'ESModule',path:path.join(source,file)})),
        compatibilityDate:'2026-09-30',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings,
        ratelimits:{PAYMENT_RATE_LIMITER:{namespace_id:'1004',simple:{limit:100,period:60}}},
        outboundService:async request=>{const response=await mock.fetch(request.url,{body:await request.text(),redirect:'manual',signal:request.signal});return new WorkerResponse(await response.text(),{status:response.status,headers:response.headers});}
    }]};
    const mf=new Miniflare(convertV4MiniflareOptions?convertV4MiniflareOptions(options):options);
    try{
        const db=await mf.getD1Database('DB'),user=env.users[0];
        for(const name of fs.readdirSync(path.join(source,'migrations')).filter(x=>x.endsWith('.sql')).sort())
            await db.exec(fs.readFileSync(path.join(source,'migrations',name),'utf8').replace(/--[^\n]*/g,'').replace(/\r?\n/g,' '));
        await db.prepare('INSERT INTO accounts(id,email,display_name,password_hash,created_at,verified_at) VALUES (?,?,?,?,?,?)').bind(user.id,'runtime@example.invalid','Test','unused',now(),now()).run();
        await db.prepare('INSERT INTO account_sessions VALUES (?,?,?,?,?)').bind(user.sessionHash,user.id,0,now(),now()+3600).run();
        async function call(route,body){const response=await mf.dispatchFetch(env.PUBLIC_ORIGIN+route,{method:body===undefined?'GET':'POST',headers:{Cookie:'bynd_account_local='+user.cookie,Origin:env.PUBLIC_ORIGIN,'X-BYND-Payment':'1','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await response.text(); try {return {status:response.status,data:JSON.parse(text)};} catch {throw Error(text.slice(0,1200));}}
        const start=await call(api+'link',{});assert.equal(start.status,200);
        const state=new URL(start.data.url).searchParams.get('state');assert.equal((await call(api+'callback',{state,code:'fixture-code'})).status,200);
        mock.order.status=0;assert.equal((await call(api+'check',{orderNo})).status,409);
        assert.equal((await db.prepare('SELECT count(*) n FROM licenses').first()).n,0);
        mock.order.status=2;
        const results=await Promise.all([call(api+'check',{orderNo}),call(api+'check',{orderNo}),call(api+'check',{orderNo})]);
        results.forEach(result=>assert.equal(result.status,200,JSON.stringify(result)));
        for(const table of ['licenses','account_licenses','deliveries','audit_logs','afdian_orders']) assert.equal((await db.prepare('SELECT count(*) n FROM '+table).first()).n,1);
        const report={checks:['OAuth exchange in workerd','official MD5 protocol in nodejs_compat','unpaid rejected','concurrent real D1 batch issues one license and receipt'],externalRequestsIntercepted:true,realPayment:false};
        const output=path.resolve(__dirname,'../artifacts/payments/afdian');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'workerd.json'),JSON.stringify(report,null,2));
        console.log('Afdian workerd checks passed: '+report.checks.length+'; no external payment.');
    }finally{await mf.dispose();env.DB.database.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
