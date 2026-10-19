const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { LocalD1 } = require('../scripts/lib/license-dev-runtime.cjs');
const root = path.resolve(__dirname, '..');
function fixture() {
    const env = { DB: new LocalD1(), PUBLIC_ORIGIN: 'http://127.0.0.1:8994', ADMIN_TOKEN: 'retirement-test-' + 'a'.repeat(40) };
    const id = crypto.randomUUID();
    env.DB.database.prepare('INSERT INTO accounts(id,email,display_name,password_hash,created_at,verified_at) VALUES (?,?,?,?,?,?)')
        .run(id, 'retirement@example.invalid', 'Test', 'unused', 1, 1);
    env.users = [{ id }];
    return env;
}
async function call(env, route, { body } = {}) {
    const headers = { 'Content-Type': 'application/json', Origin: env.PUBLIC_ORIGIN, 'X-BYND-Payment': '1' };
    if (route.startsWith('/admin/')) headers.Authorization = 'Bearer ' + env.ADMIN_TOKEN;
    const worker = (await import('../workers/license/worker.mjs')).default;
    const response = await worker.fetch(new Request(env.PUBLIC_ORIGIN + route, {
        method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body)
    }), env);
    return { status: response.status, body: await response.json() };
}

test('retired payment endpoints cannot query or issue orders even with old provider switches', async () => {
    const env = fixture();
    Object.assign(env, { PAYMENT_SANDBOX_ENABLED: 'true', PAYMENT_ISOLATION: 'sandbox-v1', AFDIAN_ENABLED: 'true', SALES_ENABLED: 'true' });
    const originalFetch = global.fetch;
    global.fetch = async () => { throw Error('Retired endpoints must not contact a provider'); };
    try {
        const id = crypto.randomUUID(), now = Math.floor(Date.now() / 1000);
        env.DB.database.prepare(`INSERT INTO sandbox_payment_orders
            (id,user_id,request_id,order_no,app_id,seller_id,amount_fen,created_at,expires_at)
            VALUES (?,?,?,?,?,?,1388,?,?)`).run(id, env.users[0].id, crypto.randomUUID(), 'ARCHIVED_ORDER', 'old-app', 'old-seller', now, now + 1800);
        const before = env.DB.database.prepare('SELECT * FROM sandbox_payment_orders').all();
        env.DB.database.prepare('INSERT INTO afdian_accounts VALUES (?,?,?)').run(env.users[0].id, 'old-buyer', now);
        env.DB.database.prepare('INSERT INTO afdian_jobs(out_trade_no,next_at) VALUES (?,?)').run('OLD_AFDIAN_ORDER', now);
        const jobs = env.DB.database.prepare('SELECT * FROM afdian_jobs').all();
        const bindings = env.DB.database.prepare('SELECT * FROM afdian_accounts').all();
        for (const origin of ['http://127.0.0.1:8994', 'https://bynd.ccwu.cc']) {
            env.PUBLIC_ORIGIN = origin;
            for (const [route, body] of [
                ['/payment/v1/config'], ['/payment/v1/orders'], ['/payment/v1/orders', { requestId: crypto.randomUUID() }],
                ['/payment/v1/orders/' + id], ['/payment/v1/orders/' + id + '/check', {}],
                ['/payment/v1/alipay/notify', { trade_status: 'TRADE_SUCCESS', out_trade_no: 'ARCHIVED_ORDER' }],
                ['/license/v1/pay/afdian/config'], ['/license/v1/pay/afdian/status'],
                ['/license/v1/pay/afdian/link', {}], ['/license/v1/pay/afdian/callback', { code: 'old-code', state: 'old-state' }],
                ['/license/v1/pay/afdian/check', { orderNo: 'OLD_AFDIAN_ORDER' }],
                ['/license/v1/pay/afdian/webhook?key=old-secret', { out_trade_no: 'OLD_AFDIAN_ORDER' }],
                ['/admin/v1/pay/afdian/recheck', { orderNo: 'OLD_AFDIAN_ORDER' }]
            ]) {
                const result = await call(env, route, { body });
                assert.equal(result.status, 404, route);
                assert.equal(result.body.code, 'not_found');
            }
        }
        assert.deepEqual(env.DB.database.prepare('SELECT * FROM sandbox_payment_orders').all(), before);
        assert.deepEqual(env.DB.database.prepare('SELECT * FROM afdian_jobs').all(), jobs);
        assert.deepEqual(env.DB.database.prepare('SELECT * FROM afdian_accounts').all(), bindings);
        assert.equal((await import('../workers/license/worker.mjs')).default.scheduled, undefined);
        assert.equal(env.DB.database.prepare('SELECT count(*) n FROM licenses').get().n, 0);
    } finally { global.fetch = originalFetch; env.DB.database.close(); }
});

test('all applied payment migrations remain byte-identical after newline normalization', () => {
    const hashes = {
        '0005_sandbox_payment.sql': 'f6b51c601cde388c271a2cad695d53d8783a3b8a6afd87639984f0e4901c98b5',
        '0006_sandbox_payment_price.sql': '57076dfe0f753e4860ec2c5ff7b68a0d974f23d1a8fe17af66cdf8cd281d403b',
        '0007_unified_payment_price.sql': '277e3d8da505aacfd0a73d7a865e793a639a96ae67380803197e1bf60cb7aa35',
        '0008_afdian.sql': '18cc13a557dc171a7d812b3f0c1cbf98747d2711a95b0c9c5cfed152680baecb'
    };
    for (const [file, hash] of Object.entries(hashes)) {
        const text = fs.readFileSync(path.join(root, 'workers/license/migrations', file), 'utf8').replace(/\r\n/g, '\n');
        assert.equal(crypto.createHash('sha256').update(text).digest('hex'), hash, file);
    }
});

test('QQ contact replaces provider clients and retains the exact supplied contact image', () => {
    const html = fs.readFileSync(path.join(root, 'checkout.html'), 'utf8');
    assert.doesNotMatch(html, /支付宝|爱发电|payment-cashier|payment-order-number|payment-code|assets\/website\/payment\.js/);
    for (const file of fs.readdirSync(path.join(root, 'assets/website')).filter(name => name.endsWith('.js'))) {
        assert.doesNotMatch(fs.readFileSync(path.join(root, 'assets/website', file), 'utf8'), /\/payment\/v1\/|alipaydev\.com|\/pay\/afdian\//, file);
    }
    assert.match(html, /id="qq-number" value="3648068162"/);
    const image = fs.readFileSync(path.join(root, 'assets/website/bynd-qq-contact-ca44cdaaaaa9.png'));
    assert.equal(crypto.createHash('sha256').update(image).digest('hex'), 'ca44cdaaaaa911127f20eea036a8ad4f0cc4973e3cd40c73f1ab302aaf12088d');
});
