'use strict';
const crypto = require('node:crypto');
const { LocalD1 } = require('./license-dev-runtime.cjs');
const now = () => Math.floor(Date.now()/1000);
function fixture(origin = 'http://127.0.0.1:8995') {
    const env = { DB: new LocalD1(), PUBLIC_ORIGIN: origin, SALES_ENABLED: 'true', AFDIAN_ENABLED: 'true', ACCOUNTS_ENABLED: 'true',
        AFDIAN_USER_ID: 'fixture-creator', AFDIAN_API_TOKEN: 'fixture-api-token', AFDIAN_PLAN_ID: 'fixture-plan', AFDIAN_PRODUCT_TYPE: '0', AFDIAN_WEBHOOK_SECRET: 'fixture-hook-'+'h'.repeat(40),
        AFDIAN_CLIENT_ID: 'fixture-client', AFDIAN_CLIENT_SECRET: 'fixture-oauth-secret', AFDIAN_PURCHASE_URL: 'https://afdian.com/a/fixture',
        LICENSE_KEY_SECRET: 'fixture-issuer-'+'x'.repeat(40), ACCOUNT_SECRET: 'fixture-account-'+'a'.repeat(40), ADMIN_TOKEN: 'fixture-admin-'+'b'.repeat(40),
        PAYMENT_RATE_LIMITER: { limit: async () => ({ success: true }) }, RECEIPT_RATE_LIMITER: { limit: async () => ({ success: true }) } };
    env.users = [0,1].map(index => {
        const id = crypto.randomUUID(), cookie = crypto.randomBytes(32).toString('base64url');
        const sessionHash = crypto.createHash('sha256').update(cookie).digest('base64url');
        env.DB.database.prepare('INSERT INTO accounts(id,email,display_name,password_hash,created_at,verified_at) VALUES (?,?,?,?,?,?)')
            .run(id, 'fixture'+index+'@example.invalid', 'Test', 'unused', now(), now());
        env.DB.database.prepare('INSERT INTO account_sessions VALUES (?,?,?,?,?)').run(sessionHash, id, 0, now(), now()+3600);
        return { id, cookie, sessionHash, providerId: 'fixture-buyer-'+index };
    });
    return env;
}
function bind(env, index=0) {
    const user = env.users[index];
    env.DB.database.prepare('INSERT INTO afdian_accounts VALUES (?,?,?)').run(user.id, user.providerId, now());
}
async function call(env, route, {body, user=0, admin=false, headers={}, ctx}={}) {
    const defaults = { 'Content-Type': 'application/json', Origin: env.PUBLIC_ORIGIN, 'X-BYND-Payment':'1' };
    if (user !== null) defaults.Cookie = 'bynd_account_local='+env.users[user].cookie;
    if (admin) defaults.Authorization = 'Bearer '+env.ADMIN_TOKEN;
    const worker = (await import('../../workers/license/worker.mjs')).default;
    const response = await worker.fetch(new Request(env.PUBLIC_ORIGIN+route, {method:body===undefined?'GET':'POST',
        headers:{...defaults,...headers},body:body===undefined?undefined:JSON.stringify(body)}),env,ctx);
    return {status:response.status,body:await response.json()};
}
const root='/license/v1/pay/afdian/';
const orderNo='202610170000000000000001';
function provider(env) {
    const assert = require('node:assert/strict');
    const state = { calls:0, fail:false, redirect:false, badJson:false, oversized:false, ec:200, oauthUser:env.users[0].providerId,
        order:{out_trade_no:orderNo,user_id:env.users[0].providerId,plan_id:env.AFDIAN_PLAN_ID,status:2,total_amount:'13.88',show_amount:'13.88',month:1,product_type:0,redeem_id:''} };
    state.fetch=async (url, options) => {
        state.calls++; assert.equal(options.redirect,'manual'); assert.ok(options.signal);
        if(state.fail) throw Error('DO NOT LEAK: secret fixture diagnostics');
        if(state.redirect) return new Response(null,{status:302,headers:{Location:'https://evil.invalid'}});
        if(state.badJson) return new Response('not-json');
        if(state.oversized) return new Response('x'.repeat(65537));
        if(url==='https://afdian.com/api/oauth2/access_token') {
            const form=new URLSearchParams(options.body); assert.equal(form.get('client_secret'),env.AFDIAN_CLIENT_SECRET);
            assert.equal(form.get('redirect_uri'),env.PUBLIC_ORIGIN+'/checkout.html');
            return Response.json({ec:state.ec,data:{user_id:state.oauthUser}});
        }
        assert.equal(url,'https://afdian.com/api/open/query-order');
        const data=JSON.parse(options.body);
        assert.equal(data.user_id,env.AFDIAN_USER_ID);
        const expected=crypto.createHash('md5').update(env.AFDIAN_API_TOKEN+'params'+data.params+'ts'+data.ts+'user_id'+data.user_id).digest('hex');
        assert.equal(data.sign,expected); assert.equal(JSON.parse(data.params).out_trade_no,orderNo);
        return Response.json({ec:state.ec,data:{list:state.list||[state.order]}});
    };
    return state;
}
module.exports={fixture,bind,call,root,orderNo,provider,now};
