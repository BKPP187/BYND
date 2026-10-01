const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const workerPromise = import('../workers/license/worker.mjs');
const root = path.resolve(__dirname, '..');
const signer = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

// Execute the production SQL, including the transactional binding, against SQLite.
class D1TestDatabase {
    constructor() {
        this.sqlite = new DatabaseSync(':memory:');
        this.sqlite.exec('PRAGMA foreign_keys = ON');
        this.sqlite.exec(fs.readFileSync(path.join(root, 'workers/license/migrations/0001_license.sql'), 'utf8'));
        this.failWrites = false;
    }
    prepare(sql) {
        const db = this;
        return { args: [], bind(...args) { this.args = args; return this; },
            async first() { return db.sqlite.prepare(sql).get(...this.args) || null; },
            async run() { return this.execute(); },
            execute() {
                if (db.failWrites) throw new Error('simulated disk failure');
                const result = db.sqlite.prepare(sql).run(...this.args);
                return { success: true, meta: { changes: Number(result.changes) } };
            }
        };
    }
    async batch(statements) {
        this.sqlite.exec('BEGIN');
        try { const results = statements.map(statement => statement.execute()); this.sqlite.exec('COMMIT'); return results; }
        catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
    }
}
function environment() {
    return { DB: new D1TestDatabase(), ADMIN_TOKEN: 'test-admin-' + 'a'.repeat(32), LICENSE_KEY_SECRET: 'test-issuer-' + 'b'.repeat(32),
        SIGNING_KEY_ID: 'test-key', SIGNING_PRIVATE_JWK: JSON.stringify(signer.privateKey.export({ format: 'jwk' })),
        LICENSE_ACTIVATION_ENABLED: 'true', APK_ALLOWED_HOSTS: 'bynd.ccwu.cc', ACTIVATION_RATE_LIMITER: { limit: async () => ({ success: true }) } };
}
async function request(env, route, body, admin = false) {
    const { default: worker } = await workerPromise;
    const headers = { 'Content-Type': 'application/json' };
    if (admin) headers.Authorization = 'Bearer ' + env.ADMIN_TOKEN;
    const response = await worker.fetch(new Request('https://bynd.ccwu.cc' + route, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
    return { status: response.status, body: response.status === 204 ? null : await response.json(), headers: response.headers };
}
async function issue(env, id = crypto.randomUUID(), orderRef = null) {
    const result = await request(env, '/admin/v1/licenses', { requestId: id, orderRef }, true);
    assert.ok(result.status === 200 || result.status === 201, JSON.stringify(result));
    return result.body;
}
function device() {
    const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    return { publicKey: keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64url'), privateKey: keys.privateKey };
}
async function activationBody(env, code, phone = device()) {
    const challenge = await request(env, '/license/v1/challenge', { licenseKey: code, publicKey: phone.publicKey });
    assert.equal(challenge.status, 200);
    return { licenseKey: code, publicKey: phone.publicKey, challengeId: challenge.body.challengeId,
        proof: crypto.sign('sha256', Buffer.from(challenge.body.challenge), phone.privateKey).toString('base64url') };
}
function verifyToken(token) {
    const [header, body, signature] = token.split('.');
    assert.equal(crypto.verify('sha256', Buffer.from(header + '.' + body), signer.publicKey, Buffer.from(signature, 'base64url')), true);
    return { header: JSON.parse(Buffer.from(header, 'base64url')), claims: JSON.parse(Buffer.from(body, 'base64url')) };
}

test('development defaults allow normal app use and public activation stays closed', async () => {
    const env = environment(); env.LICENSE_ACTIVATION_ENABLED = 'false';
    const result = await request(env, '/license/v1/challenge', {});
    assert.equal(result.status, 503); assert.equal(result.body.code, 'not_on_sale');
    assert.match(fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8'), /gradleProperty\('byndRequireLicense'\)\.orElse\('false'\)/);
    assert.match(fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8'), /gradleProperty\('byndEnableUpdates'\)\.orElse\('false'\)/);
    assert.equal((await request(env, '/updates/v1/android/stable')).status, 204);
});
test('management requires authorization, fails closed without config, and has no CORS exposure', async () => {
    const env = environment();
    const result = await request(env, '/admin/v1/licenses', { requestId: crypto.randomUUID() });
    assert.equal(result.status, 401); assert.equal(result.headers.get('access-control-allow-origin'), null);
    env.ADMIN_TOKEN = '';
    assert.equal((await request(env, '/admin/v1/licenses', {})).status, 503);
});
test('inspect returns operational metadata only and disabled service is explicit even before secrets exist', async () => {
    const env = environment(), license = await issue(env);
    const inspected = await request(env, '/admin/v1/licenses/' + license.id, undefined, true);
    assert.equal(inspected.status, 200); assert.equal(inspected.body.license.status, 'active');
    assert.equal(inspected.body.license.key_hash, undefined); assert.equal(inspected.body.license.licenseKey, undefined);
    assert.equal((await request(env, '/admin/v1/licenses/' + crypto.randomUUID(), undefined, true)).status, 404);
    env.LICENSE_ACTIVATION_ENABLED = 'false'; delete env.LICENSE_KEY_SECRET;
    assert.equal((await request(env, '/license/v1/challenge', {})).body.code, 'not_on_sale');
    assert.equal((await request(env, '/admin/v1/licenses/' + license.id + '/disable', {}, true)).status, 200);
});
test('manual issuance is recoverable after a lost response, stores no plaintext, and keeps order refs unique', async () => {
    const env = environment(), id = crypto.randomUUID();
    const first = await issue(env, id, 'manual-order-1'), again = await issue(env, id, 'manual-order-1');
    assert.deepEqual(first, again); assert.match(first.licenseKey, /^BYND(?:-[0-9A-F]{4}){8}$/);
    const row = env.DB.sqlite.prepare('SELECT * FROM licenses').get();
    assert.ok(!JSON.stringify(row).includes(first.licenseKey));
    assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM audit_logs').get().n, 1);
    assert.equal((await request(env, '/admin/v1/licenses', { requestId: id, orderRef: 'other' }, true)).status, 409);
    assert.equal((await request(env, '/admin/v1/licenses', { requestId: crypto.randomUUID(), orderRef: 'manual-order-1' }, true)).status, 409);
});
test('concurrent duplicate issuance cannot silently change the purchase record', async () => {
    const env = environment(), id = crypto.randomUUID();
    const results = await Promise.all(['one', 'two'].map(orderRef => request(env, '/admin/v1/licenses', { requestId: id, orderRef }, true)));
    assert.equal(results.filter(x => x.status === 201).length, 1);
    assert.equal(results.filter(x => x.status === 409).length, 1);
});
test('activation signs a permanent device-bound credential; same-device retries work, challenge replay fails', async () => {
    const env = environment(), license = await issue(env), phone = device();
    const body = await activationBody(env, license.licenseKey.toLowerCase(), phone);
    const activated = await request(env, '/license/v1/activate', body);
    assert.equal(activated.status, 200);
    const { header, claims } = verifyToken(activated.body.token);
    assert.equal(header.typ, 'BYND-LICENSE'); assert.equal(header.alg, 'RS256');
    assert.equal(claims.aud, 'cc.ccwu.bynd'); assert.equal(claims.licenseId, license.id); assert.equal(claims.entitlement, 'perpetual');
    assert.equal(claims.device, crypto.createHash('sha256').update(Buffer.from(phone.publicKey, 'base64url')).digest('base64url'));
    assert.equal(claims.exp, undefined);
    assert.equal((await request(env, '/license/v1/activate', body)).status, 409);
    assert.equal((await request(env, '/license/v1/activate', await activationBody(env, license.licenseKey, phone))).status, 200);
    const altered = activated.body.token.split('.'); altered[1] = Buffer.from(JSON.stringify({ ...claims, device: 'copied' })).toString('base64url');
    assert.equal(crypto.verify('sha256', Buffer.from(altered[0] + '.' + altered[1]), signer.publicKey, Buffer.from(altered[2], 'base64url')), false);
});
test('two devices racing for a single license get exactly one seat', async () => {
    const env = environment(), license = await issue(env);
    const bodies = await Promise.all([device(), device()].map(phone => activationBody(env, license.licenseKey, phone)));
    const results = await Promise.all(bodies.map(body => request(env, '/license/v1/activate', body)));
    assert.equal(results.filter(x => x.status === 200).length, 1); assert.equal(results.filter(x => x.status === 409).length, 1);
    assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM audit_logs WHERE action = 'activate'").get().n, 1);
});
test('device identity proof, unknown codes, expired challenges and rate limits are enforced', async () => {
    const env = environment(), license = await issue(env);
    const body = await activationBody(env, license.licenseKey);
    body.proof = crypto.sign('sha256', Buffer.from('wrong-message'), device().privateKey).toString('base64url');
    assert.equal((await request(env, '/license/v1/activate', body)).status, 403);
    env.DB.sqlite.prepare('UPDATE challenges SET expires_at = 0').run();
    assert.equal((await request(env, '/license/v1/activate', body)).status, 409);
    const unknown = await activationBody(env, 'BYND-' + 'F'.repeat(32));
    assert.equal((await request(env, '/license/v1/activate', unknown)).status, 403);
    env.ACTIVATION_RATE_LIMITER.limit = async () => ({ success: false });
    assert.equal((await request(env, '/license/v1/challenge', {})).status, 429);
    delete env.ACTIVATION_RATE_LIMITER;
    assert.equal((await request(env, '/license/v1/challenge', {})).status, 503);
});
test('signing and database failures never return success or bind a device', async () => {
    const env = environment(), license = await issue(env), body = await activationBody(env, license.licenseKey);
    const secret = env.SIGNING_PRIVATE_JWK; env.SIGNING_PRIVATE_JWK = '{}';
    assert.equal((await request(env, '/license/v1/activate', body)).status, 503);
    assert.equal(env.DB.sqlite.prepare('SELECT bound_device FROM licenses').get().bound_device, null);
    env.SIGNING_PRIVATE_JWK = secret; env.DB.failWrites = true;
    const failed = await request(env, '/license/v1/activate', body);
    assert.equal(failed.status, 503); assert.equal(failed.body.token, undefined);
    assert.equal(env.DB.sqlite.prepare('SELECT bound_device FROM licenses').get().bound_device, null);
    assert.equal(env.DB.sqlite.prepare('SELECT consumed_by FROM challenges').get().consumed_by, null);
});
test('unbind permits a new device, disable blocks later activations, neither promises offline revocation', async () => {
    const env = environment(), license = await issue(env), old = device();
    const activated = await request(env, '/license/v1/activate', await activationBody(env, license.licenseKey, old));
    assert.equal(activated.status, 200);
    const next = device();
    assert.equal((await request(env, '/license/v1/activate', await activationBody(env, license.licenseKey, next))).status, 409);
    const unbound = await request(env, `/admin/v1/licenses/${license.id}/unbind`, {}, true);
    assert.equal(unbound.status, 200); assert.equal(unbound.body.offlineCredentialRevoked, false);
    assert.equal((await request(env, '/license/v1/activate', await activationBody(env, license.licenseKey, next))).status, 200);
    const disabled = await request(env, `/admin/v1/licenses/${license.id}/disable`, {}, true);
    assert.equal(disabled.body.offlineCredentialRevoked, false);
    assert.equal((await request(env, '/license/v1/activate', await activationBody(env, license.licenseKey, next))).status, 403);
    verifyToken(activated.body.token);
});
function release(overrides = {}) {
    return { versionCode: 999, versionName: '1.2.3', size: 1024, sha256: 'a'.repeat(64), apkUrl: 'https://bynd.ccwu.cc/downloads/bynd-999.apk', changelog: { new: ['一封新来信'], improved: [], fixed: [] }, ...overrides };
}
test('updates are signed, monotonic, bounded and only accept trusted HTTPS downloads', async () => {
    const env = environment();
    assert.equal((await request(env, '/admin/v1/releases/android/stable', release(), true)).status, 200);
    const result = await request(env, '/updates/v1/android/stable');
    assert.equal(result.status, 200);
    const { header, claims } = verifyToken(result.body.token);
    assert.equal(header.typ, 'BYND-UPDATE'); assert.equal(claims.versionCode, 999); assert.equal(claims.size, 1024);
    assert.equal((await request(env, '/admin/v1/releases/android/stable', release(), true)).status, 409);
    for (const apkUrl of ['http://bynd.ccwu.cc/a.apk', 'https://evil.test/a.apk', 'https://user:pass@bynd.ccwu.cc/a.apk', 'https://bynd.ccwu.cc:8443/a.apk', 'https://bynd.ccwu.cc/a.html']) {
        assert.equal((await request(env, '/admin/v1/releases/android/stable', release({ versionCode: 1000, apkUrl }), true)).status, 400);
    }
    assert.equal((await request(env, '/admin/v1/releases/android/stable', release({ versionCode: 2147483648 }), true)).status, 400);
    assert.equal((await request(env, '/admin/v1/releases/android/stable', release({ size: -1 }), true)).status, 400);
    assert.equal((await request(env, '/admin/v1/releases/android/stable', release({ changelog: { new: ['<script>text remains inert</script>'] }, versionCode: 1000 }), true)).status, 200);
});
test('oversized and malformed bodies fail explicitly; database errors do not leak details', async () => {
    const { default: worker } = await workerPromise, env = environment();
    for (const [body, expected] of [['{', 400], [JSON.stringify({ x: 'a'.repeat(33000) }), 413]]) {
        const result = await worker.fetch(new Request('https://bynd.ccwu.cc/admin/v1/licenses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.ADMIN_TOKEN }, body }), env);
        assert.equal(result.status, expected);
    }
    env.DB.failWrites = true;
    const result = await request(env, '/admin/v1/licenses', { requestId: crypto.randomUUID() }, true);
    assert.equal(result.status, 503); assert.equal(JSON.stringify(result.body).includes('simulated'), false);
});
