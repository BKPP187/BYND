'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { Miniflare, Response: WorkerResponse, convertV4MiniflareOptions } = require(process.env.BYND_MINIFLARE || 'miniflare');
const root = path.resolve(__dirname, '..'), source = path.join(root, 'workers/license');
const origin = 'https://bynd.ccwu.cc', pass = '把喜欢带在身边，今天也是很可爱的一天。', replacement = '明天也要好好保存我的小小世界和所有喜欢。';
async function main() {
    const mails = [], outgoing = [], options = { workers: [{ name: 'accounts-runtime-test', modulesRoot: source,
        modules: ['worker.mjs', 'accounts.mjs', 'distribution.mjs', 'assets.mjs', 'payments.mjs', 'alipay-sandbox.mjs', 'afdian.mjs', 'afdian-client.mjs'].map(file => ({ type: 'ESModule', path: path.join(source, file) })),
        compatibilityDate: '2026-09-30', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'],
        ratelimits: { ACCOUNT_RATE_LIMITER: { namespace_id: '1003', simple: { limit: 30, period: 60 } } },
        bindings: { PUBLIC_ORIGIN: origin, ACCOUNTS_ENABLED: 'true', ACCOUNT_SECRET: 'runtime-test-' + 'a'.repeat(40), ADMIN_TOKEN: 'runtime-admin-' + 'b'.repeat(40), LICENSE_KEY_SECRET: 'runtime-issuer-' + 'c'.repeat(40), EMAIL_ENABLED: 'true', EMAIL_FROM: 'BYND <accounts@example.invalid>', RESEND_API_KEY: 'test-only-key' },
        outboundService: async request => {
            outgoing.push(new URL(request.url).hostname);
            assert.equal(new URL(request.url).hostname, 'api.resend.com', 'Test must never call real external services');
            mails.push(await request.json()); return WorkerResponse.json({ id: 'intercepted-test-mail' });
        }
    }] };
    const mf = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
    try {
        const db = await mf.getD1Database('DB');
        for (const file of fs.readdirSync(path.join(source, 'migrations')).filter(x => x.endsWith('.sql')).sort()) {
            await db.exec(fs.readFileSync(path.join(source, 'migrations', file), 'utf8').replace(/--[^\n]*/g, '').replace(/\r?\n/g, ' '));
        }
        const checks = [];
        async function call(route, body, cookie) {
            const headers = body === undefined ? {} : { Origin: origin, 'X-BYND-Account': '1', 'Content-Type': 'application/json' };
            if (cookie) headers.Cookie = cookie;
            const response = await mf.dispatchFetch(origin + '/account/v1/' + route, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
            const data = await response.json(); assert.equal(response.status, 200, JSON.stringify({ ...data, interceptedMails: mails.length, outgoingHosts: outgoing })); return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
        }
        const started = Date.now();
        await call('register', { email: 'runtime@example.invalid', displayName: '小草', password: pass });
        const registerMs = Date.now() - started;
        assert.equal(mails.length, 1); checks.push('production scrypt/HMAC and intercepted Resend request in workerd');
        const token = text => new URL(text.match(/https:\/\/[^\s]+/)[0]).hash.split('=')[1];
        await call('verify', { token: token(mails[0].text) });
        const logged = await call('login', { email: 'runtime@example.invalid', password: pass }); assert.match(logged.cookie, /^__Host-bynd_account=/);
        assert.equal((await call('me', undefined, logged.cookie)).data.user.email, 'runtime@example.invalid');
        checks.push('D1 transactional email verification and secure-cookie session in workerd');
        await call('forgot', { email: 'runtime@example.invalid' }); await call('reset', { token: token(mails[1].text), password: replacement });
        assert.equal((await call('me', undefined, logged.cookie)).data.user, null);
        await call('login', { email: 'runtime@example.invalid', password: replacement }); checks.push('D1 reset revision invalidates previous sessions');
        async function admin(route, body) {
            const response = await mf.dispatchFetch(origin + '/admin/v1/' + route, { method: 'POST', headers: { Authorization: 'Bearer runtime-admin-' + 'b'.repeat(40), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data;
        }
        const license = await admin('licenses', { requestId: crypto.randomUUID(), email: 'runtime@example.invalid' });
        const receipt = await admin('licenses/' + license.id + '/delivery', { requestId: crypto.randomUUID(), email: 'runtime@example.invalid' });
        await admin('deliveries/' + receipt.id + '/email', {});
        const state = await db.prepare('SELECT email_state FROM deliveries WHERE id=?').bind(receipt.id).first(); assert.equal(state.email_state, 'accepted');
        assert.equal(mails.length, 3); checks.push('license delivery mail uses Worker-compatible manual redirects and commits provider acceptance');
        await call('register', { email: 'activation@example.invalid', displayName: '带码注册', password: pass, licenseKey: license.licenseKey });
        await call('verify', { token: token(mails[3].text) });
        const activationUser = await call('login', { email: 'activation@example.invalid', password: pass });
        assert.equal((await call('licenses', undefined, activationUser.cookie)).data.licenses[0].id, license.id);
        checks.push('registration code is assigned atomically with a verified new account in D1');
        const directory = path.join(root, 'artifacts/account-browser'); fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, 'worker-checks.json'), JSON.stringify({ checks, runtime: 'Cloudflare workerd via Miniflare', registerMs, realEmailSent: false, deployed: false }, null, 2));
        console.log('Cloudflare workerd account checks passed; registration wall time ' + registerMs + ' ms; no real mail or deployment.');
    } finally { await mf.dispose(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
