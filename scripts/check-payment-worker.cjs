'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { Miniflare, Response: WorkerResponse, convertV4MiniflareOptions } = require(process.env.BYND_MINIFLARE || 'miniflare');
const root = path.resolve(__dirname, '..'), source = path.join(root, 'workers/license'), origin = 'http://127.0.0.1:8994';
async function main() {
    const merchant = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), provider = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const { canonical } = await import('../workers/license/alipay-sandbox.mjs');
    let status = 'WAIT_BUYER_PAY', calls = 0;
    const options = { workers: [{ name: 'payments-runtime-test', modulesRoot: source,
        modules: ['worker.mjs', 'accounts.mjs', 'distribution.mjs', 'assets.mjs', 'payments.mjs', 'alipay-sandbox.mjs', 'afdian.mjs', 'afdian-client.mjs'].map(file => ({ type: 'ESModule', path: path.join(source, file) })),
        compatibilityDate: '2026-09-30', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'],
        ratelimits: { PAYMENT_RATE_LIMITER: { namespace_id: '1004', simple: { limit: 30, period: 60 } } },
        bindings: { PUBLIC_ORIGIN: origin, ACCOUNTS_ENABLED: 'true', ACCOUNT_SECRET: 'runtime-account-' + 'a'.repeat(40), LICENSE_KEY_SECRET: 'runtime-sandbox-issuer-' + 'b'.repeat(40),
            PAYMENT_SANDBOX_ENABLED: 'true', PAYMENT_ISOLATION: 'sandbox-v1', ALIPAY_SANDBOX_APP_ID: '9021000000000001', ALIPAY_SANDBOX_SELLER_ID: '2088000000000001',
            ALIPAY_SANDBOX_PRIVATE_KEY: merchant.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
            ALIPAY_SANDBOX_PUBLIC_KEY: provider.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') },
        outboundService: async request => {
            assert.equal(request.url, 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'); calls++;
            const parameters = Object.fromEntries(new URLSearchParams(await request.text()));
            assert.equal(crypto.verify('RSA-SHA256', Buffer.from(canonical(parameters)), merchant.publicKey, Buffer.from(parameters.sign, 'base64')), true);
            const orderNo = JSON.parse(parameters.biz_content).out_trade_no;
            const value = JSON.stringify({ code: '10000', out_trade_no: orderNo, trade_no: 'TRADE_' + orderNo, total_amount: '13.88', trade_status: status }, null, 2);
            const signature = crypto.sign('RSA-SHA256', Buffer.from(value), provider.privateKey).toString('base64');
            return new WorkerResponse('{"alipay_trade_query_response":' + value + ',"sign":' + JSON.stringify(signature) + '}', { headers: { 'Content-Type': 'application/json' } });
        }
    }] };
    const mf = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
    try {
        const db = await mf.getD1Database('DB'), created = Math.floor(Date.now() / 1000), user = crypto.randomUUID(), cookie = crypto.randomBytes(32).toString('base64url');
        for (const name of fs.readdirSync(path.join(source, 'migrations')).filter(name => name.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(path.join(source, 'migrations', name), 'utf8').replace(/--[^\n]*/g, '').replace(/\r?\n/g, ' '));
        await db.prepare('INSERT INTO accounts (id,email,display_name,password_hash,created_at,verified_at) VALUES (?,?,?,?,?,?)').bind(user, 'runtime-sandbox@example.invalid', 'Test', 'fixture', created, created).run();
        await db.prepare('INSERT INTO account_sessions VALUES (?,?,?,?,?)').bind(crypto.createHash('sha256').update(cookie).digest('base64url'), user, 0, created, created + 1000).run();
        async function call(route, body) {
            const response = await mf.dispatchFetch(origin + route, { method: body === undefined ? 'GET' : 'POST',
                headers: { Cookie: 'bynd_account_local=' + cookie, Origin: origin, 'X-BYND-Payment': '1', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
            const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data;
        }
        const order = (await call('/payment/v1/orders', { requestId: crypto.randomUUID() })).order;
        assert.equal((await call('/payment/v1/orders/' + order.id + '/check', {})).order.state, 'pending');
        assert.equal((await db.prepare('SELECT count(*) AS n FROM licenses').first()).n, 0);
        status = 'TRADE_SUCCESS';
        for (let index = 0; index < 2; index++) assert.equal((await call('/payment/v1/orders/' + order.id + '/check', {})).order.state, 'issued');
        assert.equal((await db.prepare('SELECT count(*) AS n FROM licenses').first()).n, 1);
        assert.equal((await db.prepare('SELECT user_id FROM account_licenses').first()).user_id, user);
        const checks = ['Node RSA key parsing/signing and exact raw response verification in workerd', 'real D1 paid transaction and account ownership', 'unpaid and duplicate checks cannot over-issue'];
        const directory = path.join(root, 'artifacts/payments'); fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, 'sandbox-workerd.json'), JSON.stringify({ checks, outboundQueries: calls, externalCallsIntercepted: true, realCharge: false }, null, 2));
        console.log('Sandbox workerd checks passed: ' + checks.length + '; all external requests intercepted.');
    } finally { await mf.dispose(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
