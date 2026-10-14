const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { LocalD1 } = require('../scripts/lib/license-dev-runtime.cjs');
const workerPromise = import('../workers/license/worker.mjs');
const pass = '把喜欢带在身边，今天也是很可爱的一天。', newPass = '明天也要好好保存我的小小世界和所有喜欢。';
function env(t) {
    const db = new LocalD1(), messages = [];
    t.after(() => db.database.close());
    return { DB: db, PUBLIC_ORIGIN: 'http://127.0.0.1:4000', ACCOUNTS_ENABLED: 'true', ACCOUNT_SECRET: 'account-' + 'a'.repeat(40),
        ADMIN_TOKEN: 'admin-' + 'b'.repeat(40), LICENSE_KEY_SECRET: 'license-' + 'c'.repeat(40),
        ACCOUNT_RATE_LIMITER: { limit: async () => ({ success: true }) },
        ACCOUNT_DEV_MAIL: { messages, send: async mail => messages.push(mail), read: async () => messages }, EMAIL_ENABLED: 'false' };
}
async function call(e, route, body, options = {}) {
    const method = options.method || (body === undefined ? 'GET' : 'POST');
    const headers = { 'CF-Connecting-IP': options.ip || '127.0.0.1', ...options.headers };
    if (method === 'POST') { headers.Origin ??= e.PUBLIC_ORIGIN; headers['X-BYND-Account'] ??= '1'; headers['Content-Type'] = 'application/json'; }
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.admin) headers.Authorization = 'Bearer ' + e.ADMIN_TOKEN;
    const response = await (await workerPromise).default.fetch(new Request(e.PUBLIC_ORIGIN + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), e);
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie'), headers: response.headers };
}
function token(e, index = e.ACCOUNT_DEV_MAIL.messages.length - 1) { return new URL(e.ACCOUNT_DEV_MAIL.messages[index].link).hash.split('=')[1]; }
async function register(e, email = 'owner@example.invalid', name = '小草') { return call(e, '/account/v1/register', { email, password: pass, displayName: name }); }
async function user(e, email = 'owner@example.invalid') {
    assert.equal((await register(e, email)).status, 200);
    assert.equal((await call(e, '/account/v1/verify', { token: token(e) })).status, 200);
    const logged = await call(e, '/account/v1/login', { email, password: pass }); assert.equal(logged.status, 200);
    return { ...logged.body.user, cookie: logged.cookie.split(';')[0] };
}
async function issue(e, email = null) { const result = await call(e, '/admin/v1/licenses', { requestId: crypto.randomUUID(), email }, { admin: true }); assert.equal(result.status, 201); return result.body; }

test('registration optionally saves a validated activation code atomically after email verification, never stores the code or binds a device', async t => {
    const e = env(t), license = await issue(e);
    const submitted = await call(e, '/account/v1/register', { email: 'owner@example.invalid', password: pass, displayName: '小草', licenseKey: license.licenseKey });
    assert.equal(submitted.status, 200);
    const pending = e.DB.database.prepare('SELECT * FROM account_tokens').get(); assert.equal(pending.register_license_id, license.id); assert.ok(!JSON.stringify(pending).includes(license.licenseKey));
    assert.equal(e.DB.database.prepare('SELECT count(*) n FROM account_licenses').get().n, 0);
    assert.equal((await call(e, '/account/v1/verify', { token: token(e) })).status, 200);
    const logged = await call(e, '/account/v1/login', { email: 'owner@example.invalid', password: pass });
    const rows = (await call(e, '/account/v1/licenses', undefined, { cookie: logged.cookie.split(';')[0] })).body.licenses; assert.equal(rows[0].id, license.id);
    assert.equal(e.DB.database.prepare('SELECT bound_device FROM licenses').get().bound_device, null);
});
test('invalid, disabled and already-owned registration codes fail before mailing; two pending registrants cannot both claim one license', async t => {
    const e = env(t), license = await issue(e);
    const input = { email: 'owner@example.invalid', password: pass, displayName: '小草' };
    assert.equal((await call(e, '/account/v1/register', { ...input, licenseKey: 'oops' })).status, 400);
    assert.equal((await call(e, '/account/v1/register', { ...input, licenseKey: 'BYND-' + 'ABCD-'.repeat(7) + 'ABCD' })).status, 409);
    e.DB.database.prepare("UPDATE licenses SET status='disabled'").run();
    assert.equal((await call(e, '/account/v1/register', { ...input, licenseKey: license.licenseKey })).status, 409); assert.equal(e.ACCOUNT_DEV_MAIL.messages.length, 0);
    e.DB.database.prepare("UPDATE licenses SET status='active'").run();
    assert.equal((await call(e, '/account/v1/register', { ...input, licenseKey: license.licenseKey })).status, 200); const first = token(e);
    assert.equal((await call(e, '/account/v1/register', { ...input, email: 'other@example.invalid', licenseKey: license.licenseKey })).status, 200); const second = token(e);
    const verified = await Promise.all([call(e, '/account/v1/verify', { token: first }), call(e, '/account/v1/verify', { token: second })]);
    assert.deepEqual(verified.map(x => x.status).sort(), [200, 409]);
    assert.equal(e.DB.database.prepare('SELECT count(*) n FROM accounts').get().n, 1); assert.equal(e.DB.database.prepare('SELECT count(*) n FROM account_licenses').get().n, 1);
    assert.equal(e.DB.database.prepare('SELECT count(*) n FROM account_tokens WHERE used_at IS NULL').get().n, 1);
    assert.equal((await call(e, '/account/v1/register', { ...input, email: 'third@example.invalid', licenseKey: license.licenseKey })).status, 409);
});
test('registration rolls back account creation and token consumption when ownership storage fails', async t => {
    const e = env(t), license = await issue(e);
    await call(e, '/account/v1/register', { email: 'owner@example.invalid', password: pass, displayName: '小草', licenseKey: license.licenseKey }); const verification = token(e);
    const prepare = e.DB.prepare.bind(e.DB);
    e.DB.prepare = sql => { const statement = prepare(sql); if (sql.startsWith('INSERT INTO account_licenses')) statement.execute = () => { throw Error('simulated ownership write failure'); }; return statement; };
    assert.equal((await call(e, '/account/v1/verify', { token: verification })).status, 503);
    assert.equal(e.DB.database.prepare('SELECT count(*) n FROM accounts').get().n, 0); assert.equal(e.DB.database.prepare('SELECT used_at FROM account_tokens').get().used_at, null);
    e.DB.prepare = prepare;
    assert.equal((await call(e, '/account/v1/verify', { token: verification })).status, 200);
});

test('registration verifies mailbox possession before creating an account, never stores plain passwords or returns mail tokens', async t => {
    const e = env(t); const result = await register(e, ' Owner@Example.Invalid ');
    assert.equal(result.status, 200); assert.equal(result.body.mailMode, 'local'); assert.equal(result.body.token, undefined); assert.equal(result.body.link, undefined);
    assert.equal(e.DB.database.prepare('SELECT count(*) n FROM accounts').get().n, 0);
    assert.equal((await call(e, '/account/v1/login', { email: 'owner@example.invalid', password: pass })).status, 401);
    const pending = e.DB.database.prepare('SELECT * FROM account_tokens').get(); assert.match(pending.password_hash, /^scrypt-v1\$/); assert.equal(pending.email, 'owner@example.invalid');
    assert.ok(!JSON.stringify(pending).includes(pass)); assert.ok(!JSON.stringify(pending).includes(token(e)));
    const verified = await call(e, '/account/v1/verify', { token: token(e) }); assert.equal(verified.status, 200); assert.equal(verified.cookie, null);
    const logged = await call(e, '/account/v1/login', { email: 'OWNER@example.invalid', password: pass }); assert.equal(logged.status, 200);
    assert.match(logged.cookie, /HttpOnly; SameSite=Strict; Max-Age=604800$/);
    const cookie = logged.cookie.split(';')[0]; assert.equal((await call(e, '/account/v1/me', undefined, { cookie })).body.user.displayName, '小草');
    assert.ok(!JSON.stringify(logged.body).includes('password')); assert.ok(!e.DB.database.prepare('SELECT token_hash FROM account_sessions').get().token_hash.includes(cookie.split('=')[1]));
});
test('invalid, expired, reused and competing verification tokens cannot replace a registered password', async t => {
    const e = env(t); await register(e); const first = token(e); await register(e); const second = token(e);
    assert.equal((await call(e, '/account/v1/verify', { token: 'x'.repeat(43) })).status, 400);
    assert.equal((await call(e, '/account/v1/verify', { token: first })).status, 200);
    assert.equal((await call(e, '/account/v1/verify', { token: first })).status, 400);
    assert.equal((await call(e, '/account/v1/verify', { token: second })).status, 409);
    const saved = e.DB.database.prepare('SELECT password_hash FROM accounts').get().password_hash;
    await register(e); assert.equal(e.ACCOUNT_DEV_MAIL.messages.length, 2); assert.equal(e.DB.database.prepare('SELECT password_hash FROM accounts').get().password_hash, saved);
    await register(e, 'expired@example.invalid'); e.DB.database.prepare('UPDATE account_tokens SET expires_at=0 WHERE used_at IS NULL').run();
    assert.equal((await call(e, '/account/v1/verify', { token: token(e) }, { ip: 'second-ip' })).status, 400);
});
test('license ownership requires a code, is idempotent and cannot be inferred from customer email or stolen by another account', async t => {
    const e = env(t), owner = await user(e), license = await issue(e, owner.email);
    assert.deepEqual((await call(e, '/account/v1/licenses', undefined, { cookie: owner.cookie })).body.licenses, []);
    assert.equal((await call(e, '/account/v1/claim', { licenseKey: license.licenseKey }, { cookie: owner.cookie })).status, 200);
    assert.equal((await call(e, '/account/v1/claim', { licenseKey: license.licenseKey }, { cookie: owner.cookie })).status, 200);
    assert.equal(e.DB.database.prepare('SELECT count(*) n FROM account_licenses').get().n, 1);
    assert.equal(e.DB.database.prepare('SELECT bound_device FROM licenses').get().bound_device, null);
    const rows = (await call(e, '/account/v1/licenses', undefined, { cookie: owner.cookie })).body.licenses; assert.equal(rows.length, 1); assert.equal(rows[0].key_hash, undefined);
    const other = await user(e, 'other@example.invalid');
    assert.equal((await call(e, '/account/v1/claim', { licenseKey: license.licenseKey }, { cookie: other.cookie })).status, 409);
    assert.equal((await call(e, '/account/v1/licenses/' + license.id + '/code', {}, { cookie: other.cookie })).status, 404);
    assert.equal((await call(e, '/account/v1/licenses/' + license.id + '/code', {}, { cookie: owner.cookie })).body.licenseKey, license.licenseKey);
    assert.equal((await call(e, '/admin/v1/licenses', undefined, { cookie: owner.cookie })).status, 401);
    e.LICENSE_KEY_SECRET = 'wrong-' + 'd'.repeat(40);
    assert.equal((await call(e, '/account/v1/licenses/' + license.id + '/code', {}, { cookie: owner.cookie })).status, 503);
});
test('password reset is one-use, rejects old tokens after revision changes and revokes every prior session', async t => {
    const e = env(t), owner = await user(e);
    const second = await call(e, '/account/v1/login', { email: owner.email, password: pass });
    await call(e, '/account/v1/forgot', { email: owner.email }); const reset = token(e);
    await call(e, '/account/v1/forgot', { email: owner.email }); const concurrent = token(e);
    assert.equal((await call(e, '/account/v1/reset', { token: reset, password: newPass })).status, 200);
    assert.equal((await call(e, '/account/v1/me', undefined, { cookie: owner.cookie })).body.user, null);
    assert.equal((await call(e, '/account/v1/me', undefined, { cookie: second.cookie.split(';')[0] })).body.user, null);
    assert.equal((await call(e, '/account/v1/reset', { token: concurrent, password: pass })).status, 400);
    assert.equal((await call(e, '/account/v1/reset', { token: reset, password: pass })).status, 400);
    assert.equal((await call(e, '/account/v1/login', { email: owner.email, password: pass })).status, 401);
    assert.equal((await call(e, '/account/v1/login', { email: owner.email, password: newPass })).status, 200);
    const count = e.ACCOUNT_DEV_MAIL.messages.length;
    assert.equal((await call(e, '/account/v1/forgot', { email: 'unknown@example.invalid' })).status, 200);
    assert.equal(e.ACCOUNT_DEV_MAIL.messages.length, count);
});
test('cross-origin writes, absent CSRF headers, duplicate cookies, expired sessions and disabled service are rejected', async t => {
    const e = env(t), owner = await user(e);
    assert.equal((await call(e, '/account/v1/logout', {}, { cookie: owner.cookie, headers: { Origin: 'https://evil.invalid' } })).status, 403);
    assert.equal((await call(e, '/account/v1/logout', {}, { cookie: owner.cookie, headers: { 'X-BYND-Account': '' } })).status, 403);
    assert.equal((await call(e, '/account/v1/logout', {}, { cookie: owner.cookie, headers: { Origin: '' } })).status, 403);
    assert.equal((await call(e, '/account/v1/me', undefined, { cookie: owner.cookie + '; ' + owner.cookie })).body.user, null);
    e.DB.database.prepare('UPDATE account_sessions SET expires_at=0').run(); assert.equal((await call(e, '/account/v1/licenses', undefined, { cookie: owner.cookie })).status, 401);
    e.ACCOUNTS_ENABLED = 'false'; assert.equal((await call(e, '/account/v1/me')).status, 503);
});
test('real-origin mail is opt-in, local mail never bypasses HTTPS config and secure cookies are host-only', async t => {
    const e = env(t); e.PUBLIC_ORIGIN = 'https://bynd.ccwu.cc';
    assert.equal((await register(e)).status, 503); assert.equal(e.ACCOUNT_DEV_MAIL.messages.length, 0);
    e.EMAIL_ENABLED = 'true'; e.EMAIL_FROM = 'BYND <accounts@example.invalid>'; e.RESEND_API_KEY = 'fake-key';
    const actualFetch = global.fetch, sent = []; t.after(() => { global.fetch = actualFetch; });
    global.fetch = async (url, opts) => { assert.equal(url, 'https://api.resend.com/emails'); assert.equal(opts.redirect, 'manual'); sent.push(JSON.parse(opts.body)); return Response.json({ id: 'provider-test-id' }); };
    assert.equal((await register(e)).status, 200); assert.equal(e.ACCOUNT_DEV_MAIL.messages.length, 0);
    const link = sent[0].text.match(/https:\/\/[^\s]+/)[0]; assert.equal((await call(e, '/account/v1/verify', { token: new URL(link).hash.split('=')[1] })).status, 200);
    const logged = await call(e, '/account/v1/login', { email: 'owner@example.invalid', password: pass });
    assert.match(logged.cookie, /^__Host-bynd_account=/); assert.match(logged.cookie, /; Secure$/); assert.ok(!logged.cookie.includes('Domain='));
    global.fetch = async () => Response.json({ message: 'simulated failure' }, { status: 503 });
    assert.equal((await register(e, 'failed@example.invalid')).body.code, 'account_email_failed');
    global.fetch = async () => { throw Error('timeout with secret'); };
    const fail = await call(e, '/account/v1/forgot', { email: 'owner@example.invalid' }); assert.equal(fail.status, 503); assert.ok(!JSON.stringify(fail.body).includes('secret'));
    global.fetch = async () => new Response(null, { status: 302, headers: { Location: 'https://evil.invalid' } });
    assert.equal((await register(e, 'redirect@example.invalid')).body.code, 'account_email_failed');
});
test('database, mail and logout failures never claim success, consume verification or silently save ownership', async t => {
    const e = env(t);
    e.DB.failWrites = true; assert.equal((await register(e)).status, 503); assert.equal(e.ACCOUNT_DEV_MAIL.messages.length, 0);
    e.DB.failWrites = false; await register(e); const savedToken = token(e);
    e.DB.failWrites = true; assert.equal((await call(e, '/account/v1/verify', { token: savedToken })).status, 503);
    assert.equal(e.DB.database.prepare('SELECT used_at FROM account_tokens').get().used_at, null);
    e.DB.failWrites = false; assert.equal((await call(e, '/account/v1/verify', { token: savedToken })).status, 200);
    const logged = await call(e, '/account/v1/login', { email: 'owner@example.invalid', password: pass }), cookie = logged.cookie.split(';')[0], license = await issue(e);
    e.DB.failWrites = true; assert.equal((await call(e, '/account/v1/claim', { licenseKey: license.licenseKey }, { cookie })).status, 503);
    assert.equal(e.DB.database.prepare('SELECT count(*) n FROM account_licenses').get().n, 0);
    const failedLogout = await call(e, '/account/v1/logout', {}, { cookie }); assert.equal(failedLogout.status, 503); assert.equal(failedLogout.cookie, null);
    e.DB.failWrites = false; assert.equal((await call(e, '/account/v1/logout', {}, { cookie })).status, 200);
    assert.equal((await call(e, '/account/v1/me', undefined, { cookie })).body.user, null);
    e.ACCOUNT_DEV_MAIL.send = async () => { throw Error('local disk full'); };
    assert.equal((await register(e, 'mailfail@example.invalid')).status, 503);
    assert.equal(e.DB.database.prepare("SELECT count(*) n FROM accounts WHERE email='mailfail@example.invalid'").get().n, 0);
});
test('account and distributed-email rate limits fail closed before allowing more guesses', async t => {
    const e = env(t); e.ACCOUNT_RATE_LIMITER = { limit: async () => ({ success: false }) };
    assert.equal((await register(e)).status, 429); assert.equal(e.ACCOUNT_DEV_MAIL.messages.length, 0);
    e.ACCOUNT_RATE_LIMITER = { limit: async () => ({ success: true }) };
    for (let i = 0; i < 10; i++) assert.equal((await call(e, '/account/v1/login', { email: 'missing@example.invalid', password: pass }, { ip: 'ip-' + i })).status, 401);
    assert.equal((await call(e, '/account/v1/login', { email: 'missing@example.invalid', password: pass }, { ip: 'ip-11' })).status, 429);
    delete e.ACCOUNT_RATE_LIMITER; assert.equal((await register(e)).status, 503);
});
test('test inbox requires admin authorization and is unavailable on the public HTTPS service', async t => {
    const e = env(t); await register(e);
    assert.equal((await call(e, '/admin/v1/account-mail')).status, 401);
    assert.equal((await call(e, '/admin/v1/account-mail', undefined, { admin: true })).body.messages.length, 1);
    e.PUBLIC_ORIGIN = 'https://bynd.ccwu.cc'; assert.equal((await call(e, '/admin/v1/account-mail', undefined, { admin: true })).status, 404);
});
test('reset storage failures leave the old password and sessions intact; concurrent use changes a password only once', async t => {
    const e = env(t), owner = await user(e);
    await call(e, '/account/v1/forgot', { email: owner.email }); const reset = token(e);
    e.DB.failWrites = true;
    assert.equal((await call(e, '/account/v1/reset', { token: reset, password: newPass })).status, 503);
    assert.equal((await call(e, '/account/v1/me', undefined, { cookie: owner.cookie })).body.user.id, owner.id);
    e.DB.failWrites = false;
    const results = await Promise.all([call(e, '/account/v1/reset', { token: reset, password: newPass }), call(e, '/account/v1/reset', { token: reset, password: pass })]);
    assert.deepEqual(results.map(x => x.status).sort(), [200, 400]);
    assert.equal(e.DB.database.prepare('SELECT password_revision FROM accounts').get().password_revision, 1);
    const winner = results[0].status === 200 ? newPass : pass;
    assert.equal((await call(e, '/account/v1/login', { email: owner.email, password: winner })).status, 200);
});
