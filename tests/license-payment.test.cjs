const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { LocalD1 } = require('../scripts/lib/license-dev-runtime.cjs');
const worker = import('../workers/license/worker.mjs'), alipay = import('../workers/license/alipay-sandbox.mjs');
const merchant = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), provider = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const originalFetch = global.fetch, now = () => Math.floor(Date.now() / 1000);
function environment() {
    const env = { DB: new LocalD1(), PUBLIC_ORIGIN: 'http://127.0.0.1:8994', PAYMENT_SANDBOX_ENABLED: 'true', PAYMENT_ISOLATION: 'sandbox-v1',
        ALIPAY_SANDBOX_APP_ID: '9021000000000001', ALIPAY_SANDBOX_SELLER_ID: '2088000000000001',
        ALIPAY_SANDBOX_PRIVATE_KEY: merchant.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
        ALIPAY_SANDBOX_PUBLIC_KEY: provider.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
        ACCOUNTS_ENABLED: 'true', LICENSE_KEY_SECRET: 'sandbox-issuer-' + 's'.repeat(40), ACCOUNT_SECRET: 'account-' + 'a'.repeat(40),
        ADMIN_TOKEN: 'admin-' + 'a'.repeat(40), PAYMENT_RATE_LIMITER: { limit: async () => ({ success: true }) } };
    const users = [1, 2].map(number => {
        const id = crypto.randomUUID(), cookie = crypto.randomBytes(32).toString('base64url');
        env.DB.database.prepare('INSERT INTO accounts (id,email,display_name,password_hash,created_at,verified_at) VALUES (?,?,?,?,?,?)').run(id, 'user' + number + '@example.invalid', 'Test', 'fixture-only-unused', now(), now());
        env.DB.database.prepare('INSERT INTO account_sessions VALUES (?,?,?,?,?)').run(crypto.createHash('sha256').update(cookie).digest('base64url'), id, 0, now(), now() + 1000);
        return { id, cookie };
    });
    env.users = users; return env;
}
async function raw(env, route, { body, method = body === undefined ? 'GET' : 'POST', user = 0, headers = {}, form } = {}) {
    const defaults = { Origin: env.PUBLIC_ORIGIN, 'X-BYND-Payment': '1', 'X-BYND-Account': '1', 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' };
    if (user !== null) defaults.Cookie = 'bynd_account_local=' + env.users[user].cookie;
    return (await worker).default.fetch(new Request(env.PUBLIC_ORIGIN + route, { method, headers: { ...defaults, ...headers }, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) }), env);
}
async function call(env, route, options) { const response = await raw(env, route, options); return { status: response.status, body: await response.json() }; }
async function create(env, options = {}) { const response = await call(env, '/payment/v1/orders', { body: { requestId: crypto.randomUUID() }, ...options }); assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body; }
const orderRoute = order => '/payment/v1/orders/' + order.id;
const check = (env, order, options = {}) => call(env, orderRoute(order) + '/check', { body: {}, ...options });
const count = env => env.DB.database.prepare('SELECT count(*) AS n FROM licenses').get().n;
function simulator(env, response = {}, options = {}) {
    const state = { calls: 0, response, options };
    global.fetch = async (address, request) => {
        assert.equal(address, (await alipay).SANDBOX_GATEWAY); assert.equal(request.redirect, 'manual'); assert.ok(request.signal);
        const parameters = Object.fromEntries(new URLSearchParams(request.body));
        assert.equal(parameters.app_id, env.ALIPAY_SANDBOX_APP_ID); assert.equal(parameters.method, 'alipay.trade.query');
        assert.equal(crypto.verify('RSA-SHA256', Buffer.from((await alipay).canonical(parameters)), merchant.publicKey, Buffer.from(parameters.sign, 'base64')), true);
        const biz = JSON.parse(parameters.biz_content); state.calls++;
        if (state.options.fail) throw Error('sensitive internal provider failure');
        if (state.options.redirect) return new Response(null, { status: 302, headers: { Location: 'https://attacker.invalid/steal' } });
        const value = typeof state.response === 'function' ? state.response(biz) : {
            code: '10000', out_trade_no: biz.out_trade_no, total_amount: '13.88', trade_status: 'WAIT_BUYER_PAY', trade_no: 'TRADE_' + biz.out_trade_no, ...state.response };
        const content = state.options.spaces ? JSON.stringify(value, null, 2) : JSON.stringify(value);
        const signature = crypto.sign('RSA-SHA256', Buffer.from(content), state.options.badSignature ? merchant.privateKey : provider.privateKey).toString('base64');
        const name = 'alipay_trade_query_response';
        const text = '{"' + name + '":' + content + (state.options.duplicate ? ',"' + name + '":' + content : '') + ',"sign":' + JSON.stringify(state.options.noSignature ? '' : signature) + '}';
        return new Response(text, { headers: { 'Content-Type': 'application/json' } });
    };
    return state;
}
async function notification(env, order, overrides = {}, options = {}) {
    const parameters = { app_id: env.ALIPAY_SANDBOX_APP_ID, seller_id: env.ALIPAY_SANDBOX_SELLER_ID, out_trade_no: order.orderNo,
        total_amount: '13.88', trade_no: 'TRADE_' + order.orderNo, trade_status: 'TRADE_SUCCESS', sign_type: 'RSA2', ...overrides };
    parameters.sign = crypto.sign('RSA-SHA256', Buffer.from((await alipay).canonical(parameters, true)), options.fake ? merchant.privateKey : provider.privateKey).toString('base64');
    const form = new URLSearchParams(parameters).toString() + (options.duplicate ? '&total_amount=0.01' : '');
    return raw(env, '/payment/v1/alipay/notify', { form, method: 'POST', user: null });
}
function scenario(name, run) {
    test(name, async () => { const env = environment(); try { await run(env); } finally { global.fetch = originalFetch; env.DB.database.close(); } });
}
scenario('sandbox payments remain unavailable on production origins, disabled modes and missing isolation marker', async env => {
    for (const change of [{ PUBLIC_ORIGIN: 'https://bynd.ccwu.cc' }, { PAYMENT_SANDBOX_ENABLED: 'false' }, { PAYMENT_ISOLATION: '' }]) {
        const modified = { ...env, ...change };
        assert.equal((await call(modified, '/payment/v1/config', { user: null })).body.mode, 'disabled');
        assert.equal((await call(modified, '/payment/v1/orders', { body: { requestId: crypto.randomUUID() } })).status, 503);
    }
    assert.equal(count(env), 0);
});
scenario('sandbox checkout requires account, same origin and server-only price; lost create responses retry the same order', async env => {
    assert.equal((await call(env, '/payment/v1/orders', { body: { requestId: crypto.randomUUID() }, user: null })).status, 401);
    assert.equal((await call(env, '/payment/v1/orders', { body: { requestId: crypto.randomUUID() }, headers: { Origin: 'https://attacker.invalid' } })).status, 403);
    for (const extra of [{ amountFen: 1 }, { paid: true }, { userId: env.users[1].id }]) assert.equal((await call(env, '/payment/v1/orders', { body: { requestId: crypto.randomUUID(), ...extra } })).status, 400);
    const requestId = crypto.randomUUID(), first = await create(env, { body: { requestId } }), again = await create(env, { body: { requestId } });
    assert.deepEqual(first.order, again.order); assert.equal(first.order.amountFen, 1388); assert.equal(first.order.state, 'pending');
    const url = new URL(first.paymentUrl), values = Object.fromEntries(url.searchParams), biz = JSON.parse(values.biz_content);
    assert.equal(url.origin + url.pathname, (await alipay).SANDBOX_GATEWAY); assert.equal(biz.total_amount, '13.88'); assert.equal(biz.seller_id, env.ALIPAY_SANDBOX_SELLER_ID);
    assert.equal(crypto.verify('RSA-SHA256', Buffer.from((await alipay).canonical(values)), merchant.publicKey, Buffer.from(values.sign, 'base64')), true);
    assert.equal(count(env), 0);
});
scenario('unpaid, uncreated and canceled trades never issue a license; customer success fields cannot settle', async env => {
    const { order } = await create(env), mock = simulator(env);
    assert.equal((await check(env, order)).body.order.state, 'pending');
    mock.response = { code: '40004', sub_code: 'ACQ.TRADE_NOT_EXIST' };
    assert.equal((await check(env, order)).body.order.state, 'pending');
    assert.equal((await check(env, order, { body: { paid: true } })).status, 400);
    mock.response = { trade_status: 'TRADE_CLOSED' }; assert.equal((await check(env, order)).body.order.state, 'closed');
    assert.equal(count(env), 0); assert.equal(mock.calls, 3);
});
scenario('price migration preserves existing orders and checks their original amount while new orders use 1388 fen', async env => {
    const fs = require('node:fs'), path = require('node:path');
    const migration = name => fs.readFileSync(path.join(__dirname, '../workers/license/migrations', name), 'utf8');
    const db = env.DB.database, id = crypto.randomUUID(), orderNo = 'BYNDS' + id.replace(/-/g, '');
    db.exec('DROP TABLE sandbox_payment_orders'); db.exec(migration('0005_sandbox_payment.sql'));
    db.prepare(`INSERT INTO sandbox_payment_orders (id,user_id,request_id,order_no,app_id,seller_id,amount_fen,created_at,expires_at)
        VALUES (?,?,?,?,?,?,1280,?,?)`).run(id, env.users[0].id, crypto.randomUUID(), orderNo, env.ALIPAY_SANDBOX_APP_ID, env.ALIPAY_SANDBOX_SELLER_ID, now(), now() + 1800);
    db.exec(migration('0006_sandbox_payment_price.sql'));
    const previousId = crypto.randomUUID(), previousOrderNo = 'BYNDS' + previousId.replace(/-/g, '');
    db.prepare(`INSERT INTO sandbox_payment_orders (id,user_id,request_id,order_no,app_id,seller_id,amount_fen,created_at,expires_at)
        VALUES (?,?,?,?,?,?,1288,?,?)`).run(previousId, env.users[0].id, crypto.randomUUID(), previousOrderNo, env.ALIPAY_SANDBOX_APP_ID, env.ALIPAY_SANDBOX_SELLER_ID, now(), now() + 1800);
    db.exec(migration('0007_unified_payment_price.sql'));
    const saved = await call(env, orderRoute({ id })); assert.equal(saved.status, 200); assert.equal(saved.body.order.amountFen, 1280);
    assert.equal(JSON.parse(new URL(saved.body.paymentUrl).searchParams.get('biz_content')).total_amount, '12.80');
    simulator(env, { trade_status: 'TRADE_SUCCESS', total_amount: '12.80' });
    assert.equal((await notification(env, saved.body.order)).status, 409); assert.equal(count(env), 0);
    assert.equal((await notification(env, saved.body.order, { total_amount: '12.80' })).status, 200); assert.equal(count(env), 1);
    const previous = await call(env, orderRoute({ id: previousId })); assert.equal(previous.status, 200); assert.equal(previous.body.order.amountFen, 1288);
    assert.equal(JSON.parse(new URL(previous.body.paymentUrl).searchParams.get('biz_content')).total_amount, '12.88');
    simulator(env, { trade_status: 'TRADE_SUCCESS', total_amount: '12.88' });
    assert.equal((await notification(env, previous.body.order, { total_amount: '12.88' })).status, 200); assert.equal(count(env), 2);
    const fresh = await create(env); assert.equal(fresh.order.amountFen, 1388);
    assert.throws(() => db.prepare('UPDATE sandbox_payment_orders SET amount_fen=1 WHERE id=?').run(fresh.order.id));
});
scenario('verified payment atomically issues one license owned by the purchasing account, including concurrent retry', async env => {
    const { order } = await create(env); simulator(env, { trade_status: 'TRADE_SUCCESS' }, { spaces: true });
    const responses = await Promise.all([check(env, order), check(env, order), check(env, order)]);
    responses.forEach(response => { assert.equal(response.status, 200); assert.equal(response.body.order.state, 'issued'); });
    assert.equal(count(env), 1); assert.equal(env.DB.database.prepare("SELECT count(*) AS n FROM audit_logs WHERE action='sandbox-payment'").get().n, 1);
    assert.equal(env.DB.database.prepare('SELECT user_id FROM account_licenses').get().user_id, env.users[0].id);
    const code = await call(env, '/account/v1/licenses/' + order.id + '/code', { body: {} }); assert.match(code.body.licenseKey, /^BYND(?:-[0-9A-F]{4}){8}$/);
    assert.equal((await check(env, order, { user: 1 })).status, 404);
    assert.equal((await call(env, '/account/v1/licenses/' + order.id + '/code', { body: {}, user: 1 })).status, 404);
});
scenario('unsigned, forged, duplicated and redirected provider responses fail closed without leaking errors', async env => {
    const { order } = await create(env);
    for (const options of [{ badSignature: true }, { noSignature: true }, { duplicate: true }, { redirect: true }, { fail: true }]) {
        const mock = simulator(env, { trade_status: 'TRADE_SUCCESS' }, options), response = await check(env, order);
        assert.equal(response.status, 503); assert.equal(count(env), 0); assert.equal(mock.calls, 1); assert.equal(JSON.stringify(response.body).includes('sensitive'), false);
    }
});
scenario('mismatched order, amount, merchant, app or unsupported status can never grant a license', async env => {
    const { order } = await create(env);
    for (const change of [{ out_trade_no: 'another-order' }, { total_amount: '0.01' }, { total_amount: '12.80' }, { total_amount: '12.88' }, { total_amount: '13.8801' }, { seller_id: '2088000000000999' }, { app_id: '9021000000000999' }, { trade_status: 'SUCCESS' }, { trade_no: '' }]) {
        simulator(env, { trade_status: 'TRADE_SUCCESS', ...change });
        assert.ok((await check(env, order)).status >= 400); assert.equal(count(env), 0);
    }
});
scenario('failed ownership write rolls back payment, license and audit; retry fulfills exactly once', async env => {
    const { order } = await create(env); simulator(env, { trade_status: 'TRADE_SUCCESS' });
    env.DB.database.exec("CREATE TRIGGER fail_owner BEFORE INSERT ON account_licenses BEGIN SELECT RAISE(FAIL,'simulated storage error'); END;");
    assert.equal((await check(env, order)).status, 503); assert.equal(count(env), 0);
    const saved = env.DB.database.prepare('SELECT state,trade_no FROM sandbox_payment_orders').get(); assert.equal(saved.state, 'pending'); assert.equal(saved.trade_no, null);
    env.DB.database.exec('DROP TRIGGER fail_owner'); assert.equal((await check(env, order)).body.order.state, 'issued'); assert.equal(count(env), 1);
});
scenario('fake and repeated-field notifications are rejected before any provider query', async env => {
    const { order } = await create(env), mock = simulator(env, { trade_status: 'TRADE_SUCCESS' });
    assert.equal((await notification(env, order, {}, { fake: true })).status, 403);
    assert.equal((await notification(env, order, {}, { duplicate: true })).status, 400);
    for (const fields of [{ app_id: '9021000000000999' }, { seller_id: '2088000000000999' }, { total_amount: '0.01' }]) assert.equal((await notification(env, order, fields)).status, 409);
    assert.equal(mock.calls, 0); assert.equal(count(env), 0);
});
scenario('signed notification still requires matching authoritative query; acknowledged retries never issue twice', async env => {
    const { order } = await create(env), mock = simulator(env);
    assert.equal((await notification(env, order)).status, 503); assert.equal(count(env), 0);
    mock.response = { trade_status: 'TRADE_SUCCESS' };
    assert.equal((await notification(env, order, { trade_no: 'WRONG_TRANSACTION' })).status, 409); assert.equal(count(env), 0);
    for (let index = 0; index < 2; index++) { const response = await notification(env, order); assert.equal(response.status, 200); assert.equal(await response.text(), 'success'); }
    assert.equal(count(env), 1);
});
scenario('one provider transaction cannot fulfill two accounts or orders', async env => {
    const first = (await create(env)).order, second = (await create(env, { user: 1 })).order;
    simulator(env, { trade_status: 'TRADE_SUCCESS', trade_no: 'SAME_TRANSACTION_1234' });
    assert.equal((await check(env, first)).status, 200); assert.equal((await check(env, second, { user: 1 })).status, 503); assert.equal(count(env), 1);
    assert.equal((await call(env, orderRoute(second), { user: 1 })).body.order.state, 'pending');
});
scenario('expired unpaid links cannot reopen checkout; late confirmed payment can still be recovered', async env => {
    const requestId = crypto.randomUUID(), { order } = await create(env, { body: { requestId } });
    env.DB.database.prepare('UPDATE sandbox_payment_orders SET expires_at=? WHERE id=?').run(now() - 1, order.id);
    assert.equal((await create(env, { body: { requestId } })).paymentUrl, null);
    simulator(env, { trade_status: 'TRADE_SUCCESS' }); assert.equal((await check(env, order)).body.order.state, 'issued');
});
scenario('closed or refunded orders cannot be resurrected and verified refund disables the test license', async env => {
    const { order } = await create(env), mock = simulator(env, { trade_status: 'TRADE_SUCCESS' });
    assert.equal((await check(env, order)).body.order.state, 'issued');
    mock.response = { trade_status: 'TRADE_CLOSED' }; assert.equal((await check(env, order)).body.order.state, 'refunded');
    assert.equal(env.DB.database.prepare('SELECT status FROM licenses').get().status, 'disabled');
    assert.equal((await call(env, '/account/v1/licenses/' + order.id + '/code', { body: {} })).status, 404);
    mock.response = { trade_status: 'TRADE_SUCCESS' }; assert.equal((await check(env, order)).status, 409); assert.equal(count(env), 1);
});
