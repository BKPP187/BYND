const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { LocalD1 } = require('../scripts/lib/license-dev-runtime.cjs');
const workerPromise = import('../workers/license/worker.mjs');
const signer = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
class Bucket {
    constructor() { this.objects = new Map(); this.failPut = false; this.corrupt = false; }
    async put(key, stream, options) {
        if (this.failPut) throw Error('simulated upload failure');
        const bytes = Buffer.from(await new Response(stream).arrayBuffer());
        if (crypto.createHash('sha256').update(bytes).digest('hex') !== options.sha256) throw Error('checksum mismatch');
        const object = { bytes, size: bytes.length, customMetadata: options.customMetadata }; this.objects.set(key, object); return object;
    }
    async head(key) { const object = this.objects.get(key); return object ? { size: object.size, customMetadata: this.corrupt ? { sha256: 'wrong' } : object.customMetadata } : null; }
    async get(key, options) { const object = this.objects.get(key); if (!object) return null; const range = options?.range; return { ...(await this.head(key)), range, body: range ? object.bytes.subarray(range.offset, range.offset + range.length) : object.bytes }; }
}
function env() {
    return { DB: new LocalD1(), APK_BUCKET: new Bucket(), ADMIN_TOKEN: 'admin-' + 'a'.repeat(40), LICENSE_KEY_SECRET: 'issuer-' + 'b'.repeat(40),
        SIGNING_KEY_ID: 'test-key', SIGNING_PRIVATE_JWK: JSON.stringify(signer.privateKey.export({ format: 'jwk' })),
        PUBLIC_ORIGIN: 'https://bynd.ccwu.cc', LICENSE_ACTIVATION_ENABLED: 'true', SALES_ENABLED: 'false', EMAIL_ENABLED: 'false',
        APK_SIGNER_SHA256: 'c'.repeat(64), APK_ALLOWED_HOSTS: 'bynd.ccwu.cc',
        ACTIVATION_RATE_LIMITER: { limit: async () => ({ success: true }) }, RECEIPT_RATE_LIMITER: { limit: async () => ({ success: true }) } };
}
async function raw(environment, route, { body, admin = true, headers = {}, method = body === undefined ? 'GET' : 'POST' } = {}) {
    const { default: worker } = await workerPromise;
    if (admin) headers.Authorization = 'Bearer ' + environment.ADMIN_TOKEN;
    if (body !== undefined && !Buffer.isBuffer(body)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    return worker.fetch(new Request('https://bynd.ccwu.cc' + route, { method, headers, body }), environment);
}
async function call(environment, route, body, admin = true) { const response = await raw(environment, route, { body, admin }); return { status: response.status, body: await response.json() }; }
async function issue(environment, email = null) { const response = await call(environment, '/admin/v1/licenses', { requestId: crypto.randomUUID(), orderRef: null, email }); assert.equal(response.status, 201); return response.body; }
async function delivery(environment, license, email = null, id = crypto.randomUUID()) { const response = await call(environment, '/admin/v1/licenses/' + license.id + '/delivery', { requestId: id, email }); assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body; }
function uploadBody(data = Buffer.from('APK fixture checksum and ranged download')) {
    return { data, metadata: { packageName: 'cc.ccwu.bynd', versionCode: 1000, versionName: '1.2.0', size: data.length,
        sha256: crypto.createHash('sha256').update(data).digest('hex'), signerSha256: 'c'.repeat(64) } };
}
async function upload(environment, fixture = uploadBody()) {
    const response = await raw(environment, '/admin/v1/artifacts/' + fixture.metadata.sha256, { body: fixture.data,
        headers: { 'content-length': String(fixture.metadata.size), 'x-bynd-artifact': JSON.stringify(fixture.metadata) } });
    return { status: response.status, body: await response.json(), fixture };
}
test('store defaults closed, saved purchase info remains editable, malformed links do not open sales', async () => {
    const environment = env();
    assert.equal((await call(environment, '/distribution/v1/store', undefined, false)).body.saleOpen, false);
    const saved = await call(environment, '/admin/v1/store', { priceLabel: '测试价格', purchaseUrl: 'https://example.com/manual-order' });
    assert.equal(saved.status, 200); assert.equal(saved.body.saleOpen, false); assert.equal(saved.body.purchaseUrl, '');
    assert.equal((await call(environment, '/admin/v1/config')).body.configuredPurchaseUrl, 'https://example.com/manual-order');
    assert.equal((await call(environment, '/admin/v1/store', { priceLabel: 'x', purchaseUrl: 'javascript:alert(1)' })).status, 400);
    environment.SALES_ENABLED = 'true'; assert.equal((await call(environment, '/distribution/v1/store', undefined, false)).body.saleOpen, true);
});
test('receipt flow creates a recoverable private link, survives retries and changing contact email, and reveals no lookup hash', async () => {
    const environment = env(), requestId = crypto.randomUUID();
    const licensed = await call(environment, '/admin/v1/licenses', { requestId, orderRef: 'order', email: 'first@example.invalid' });
    const link = await delivery(environment, licensed.body, 'new@example.invalid');
    const again = await delivery(environment, licensed.body, 'new@example.invalid', link.id); assert.deepEqual(again, link);
    assert.equal((await call(environment, '/admin/v1/licenses', { requestId, orderRef: 'order', email: 'first@example.invalid' })).status, 200);
    const token = new URL(link.receiptUrl).hash.slice(1);
    const redeemed = await call(environment, '/license/v1/receipt', { token }, false);
    assert.equal(redeemed.status, 200); assert.equal(redeemed.body.licenseKey, licensed.body.licenseKey); assert.equal(redeemed.body.key_hash, undefined);
    assert.equal((await call(environment, '/admin/v1/licenses/' + licensed.body.id + '/recover', {})).body.licenseKey, licensed.body.licenseKey);
    const list = (await call(environment, '/admin/v1/licenses?q=new%40example.invalid')).body.licenses;
    assert.equal(list.length, 1); assert.equal(list[0].key_hash, undefined);
    assert.equal((await call(environment, '/admin/v1/licenses/' + licensed.body.id + '/delivery', { requestId: link.id, email: 'different@example.invalid' })).status, 409);
    assert.equal((await call(environment, '/admin/v1/licenses/' + licensed.body.id)).body.license.customer_email, 'new@example.invalid');
});
test('expired, disabled, tampered and rate-limited receipt links cannot reveal an activation code', async () => {
    const environment = env(), license = await issue(environment), link = await delivery(environment, license);
    const token = new URL(link.receiptUrl).hash.slice(1);
    assert.equal((await call(environment, '/license/v1/receipt', { token: 'x'.repeat(43) }, false)).status, 403);
    environment.DB.database.prepare('UPDATE deliveries SET expires_at = 0').run();
    assert.equal((await call(environment, '/license/v1/receipt', { token }, false)).status, 403);
    environment.DB.database.prepare('UPDATE deliveries SET expires_at = ?').run(Math.floor(Date.now() / 1000) + 1000);
    await call(environment, '/admin/v1/licenses/' + license.id + '/disable', {});
    assert.equal((await call(environment, '/license/v1/receipt', { token }, false)).status, 403);
    assert.equal((await call(environment, '/admin/v1/licenses/' + license.id + '/recover', {})).status, 409);
    environment.RECEIPT_RATE_LIMITER.limit = async () => ({ success: false });
    assert.equal((await call(environment, '/license/v1/receipt', { token }, false)).status, 429);
});
test('changing the issuance secret never recovers or emails a plausible but invalid code', async () => {
    const environment = env(), license = await issue(environment), link = await delivery(environment, license, 'recipient@example.invalid');
    environment.LICENSE_KEY_SECRET = 'wrong-issuer-' + 'x'.repeat(40);
    for (const [route, body, admin] of [
        ['/admin/v1/licenses/' + license.id + '/recover', {}, true],
        ['/admin/v1/licenses/' + license.id + '/delivery', { requestId: crypto.randomUUID(), email: null }, true],
        ['/license/v1/receipt', { token: new URL(link.receiptUrl).hash.slice(1) }, false],
        ['/admin/v1/deliveries/' + link.id + '/email', {}, true]
    ]) { const result = await call(environment, route, body, admin); assert.equal(result.status, 503); assert.equal(result.body.licenseKey, undefined); }
    assert.equal(environment.DB.database.prepare('SELECT email_state FROM deliveries WHERE id = ?').get(link.id).email_state, 'ready');
});
test('lost unbind response cannot unbind a newly activated phone; stale revisions never report success', async () => {
    const environment = env(), license = await issue(environment), id = crypto.randomUUID();
    const operation = { requestId: id, expectedRevision: 0 };
    assert.equal((await call(environment, '/admin/v1/licenses/' + license.id + '/unbind', operation)).status, 200);
    environment.DB.database.prepare('UPDATE licenses SET bound_device = ? WHERE id = ?').run('new-phone', license.id);
    assert.equal((await call(environment, '/admin/v1/licenses/' + license.id + '/unbind', operation)).status, 200);
    assert.equal((await call(environment, '/admin/v1/licenses/' + license.id)).body.license.bound_device, 'new-phone');
    assert.equal((await call(environment, '/admin/v1/licenses/' + license.id + '/unbind', { ...operation, expectedRevision: 1 })).status, 409);
    assert.equal((await call(environment, '/admin/v1/licenses/' + license.id + '/disable', { requestId: crypto.randomUUID(), expectedRevision: 0 })).status, 409);
    assert.equal((await call(environment, '/admin/v1/licenses/' + license.id)).body.license.status, 'active');
    assert.equal(environment.DB.database.prepare("SELECT count(*) AS n FROM audit_logs WHERE action='unbind'").get().n, 1);
});
test('R2 upload verifies bytes, idempotently resumes, gates publication, and supports APK downloads and ranges', async () => {
    const environment = env(), uploaded = await upload(environment), artifact = uploaded.body.artifact;
    assert.equal(uploaded.status, 200); assert.equal(artifact.state, 'ready');
    assert.equal((await upload(environment, uploaded.fixture)).status, 200);
    const manifest = { versionCode: artifact.version_code, versionName: artifact.version_name, size: artifact.size, sha256: artifact.sha256,
        apkUrl: 'https://bynd.ccwu.cc/downloads/' + artifact.filename, changelog: { new: ['测试来信'], improved: [], fixed: [] } };
    assert.equal((await call(environment, '/admin/v1/releases/android/stable', { ...manifest, size: artifact.size + 1 })).status, 409);
    assert.equal((await call(environment, '/admin/v1/releases/android/stable', manifest)).status, 200);
    assert.equal((await call(environment, '/distribution/v1/store', undefined, false)).body.download.url, '/downloads/' + artifact.filename);
    const full = await raw(environment, '/downloads/' + artifact.filename, { admin: false }); assert.equal(full.status, 200); assert.deepEqual(Buffer.from(await full.arrayBuffer()), uploaded.fixture.data);
    const ranged = await raw(environment, '/downloads/' + artifact.filename, { admin: false, headers: { Range: 'bytes=3-8' } });
    assert.equal(ranged.status, 206); assert.equal(ranged.headers.get('content-range'), 'bytes 3-8/' + artifact.size); assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), uploaded.fixture.data.subarray(3, 9));
    const suffix = await raw(environment, '/downloads/' + artifact.filename, { admin: false, headers: { Range: 'bytes=-5' } }); assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), uploaded.fixture.data.subarray(-5));
    assert.equal((await raw(environment, '/downloads/' + artifact.filename, { admin: false, headers: { Range: 'bytes=999-1000' } })).status, 416);
    const head = await raw(environment, '/downloads/' + artifact.filename, { admin: false, method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
    assert.equal((await raw(environment, '/downloads/' + artifact.filename, { admin: false, headers: { 'If-None-Match': head.headers.get('etag') } })).status, 304);
    environment.APK_BUCKET.corrupt = true; assert.equal((await raw(environment, '/downloads/' + artifact.filename, { admin: false })).status, 503);
});
test('upload, checksum, database and signing errors never publish or expose a broken APK', async () => {
    const environment = env(), fixture = uploadBody(); environment.APK_BUCKET.failPut = true;
    assert.equal((await upload(environment, fixture)).status, 503);
    assert.equal((await call(environment, '/admin/v1/artifacts')).body.artifacts.length, 0);
    environment.APK_BUCKET.failPut = false;
    assert.equal((await upload(environment, { ...fixture, data: Buffer.alloc(fixture.data.length) })).status, 503);
    const uploaded = await upload(environment, fixture); assert.equal(uploaded.status, 200);
    environment.DB.failWrites = true;
    assert.equal((await call(environment, '/admin/v1/releases/android/stable', { versionCode: 1000, versionName: '1.2.0', size: fixture.data.length, sha256: fixture.metadata.sha256, apkUrl: 'https://bynd.ccwu.cc/downloads/' + uploaded.body.artifact.filename, changelog: {} })).status, 503);
    assert.equal((await raw(environment, '/updates/v1/android/stable', { admin: false })).status, 204);
});
test('email is opt-in, provider acceptance is distinct from delivery, duplicate sends are idempotent', async () => {
    const environment = env(), license = await issue(environment), link = await delivery(environment, license, 'recipient@example.invalid');
    assert.equal((await call(environment, '/admin/v1/deliveries/' + link.id + '/email', {})).body.code, 'email_unavailable');
    environment.EMAIL_ENABLED = 'true'; environment.RESEND_API_KEY = 'test-only'; environment.EMAIL_FROM = 'BYND <test@example.invalid>';
    const original = global.fetch; let calls = 0;
    global.fetch = async (url, options) => {
        assert.equal(url, 'https://api.resend.com/emails'); calls++;
        assert.equal(options.headers['Idempotency-Key'], 'bynd-license/' + link.id);
        assert.ok(JSON.parse(options.body).text.includes(license.licenseKey)); return Response.json({ id: 'test-provider-id' });
    };
    try {
        assert.equal((await call(environment, '/admin/v1/deliveries/' + link.id + '/email', {})).body.emailState, 'accepted');
        assert.equal((await call(environment, '/admin/v1/deliveries/' + link.id + '/email', {})).body.emailState, 'accepted'); assert.equal(calls, 1);
    } finally { global.fetch = original; }
});
test('email timeout and provider failures retain a retryable stable payload without claiming success', async () => {
    const environment = env(), license = await issue(environment), link = await delivery(environment, license, 'recipient@example.invalid');
    environment.EMAIL_ENABLED = 'true'; environment.RESEND_API_KEY = 'test-only'; environment.EMAIL_FROM = 'BYND <test@example.invalid>';
    const original = global.fetch; let firstBody;
    global.fetch = async (url, options) => { firstBody = options.body; throw Error('timeout'); };
    try {
        const result = await call(environment, '/admin/v1/deliveries/' + link.id + '/email', {}); assert.equal(result.status, 503); assert.equal(result.body.code, 'email_unknown');
        environment.PUBLIC_ORIGIN = 'https://other.example'; environment.EMAIL_FROM = 'Changed <changed@example.invalid>';
        global.fetch = async (url, options) => { assert.equal(options.body, firstBody); return Response.json({ error: 'rejected' }, { status: 401 }); };
        assert.equal((await call(environment, '/admin/v1/deliveries/' + link.id + '/email', {})).body.code, 'email_failed');
        global.fetch = async () => Response.json({ missing: 'id' });
        assert.equal((await call(environment, '/admin/v1/deliveries/' + link.id + '/email', {})).body.code, 'email_unknown');
        const state = environment.DB.database.prepare('SELECT email_state FROM deliveries WHERE id = ?').get(link.id); assert.equal(state.email_state, 'unknown');
        environment.DB.database.prepare('UPDATE deliveries SET email_first_attempt_at = 1').run();
        assert.equal((await call(environment, '/admin/v1/deliveries/' + link.id + '/email', {})).status, 409);
    } finally { global.fetch = original; }
});
test('email concurrency and post-send storage failure retain an honest pending state', async () => {
    const environment = env(), license = await issue(environment), link = await delivery(environment, license, 'recipient@example.invalid');
    environment.EMAIL_ENABLED = 'true'; environment.RESEND_API_KEY = 'test-only'; environment.EMAIL_FROM = 'BYND <test@example.invalid>';
    const original = global.fetch; let release, entered;
    const called = new Promise(resolve => { entered = resolve; });
    global.fetch = async () => { entered(); return new Promise(resolve => { release = () => resolve(Response.json({ id: 'provider-result' })); }); };
    try {
        const first = call(environment, '/admin/v1/deliveries/' + link.id + '/email', {}); await called;
        assert.equal((await call(environment, '/admin/v1/deliveries/' + link.id + '/email', {})).status, 409);
        environment.DB.failWrites = true; release(); assert.equal((await first).status, 503);
        assert.equal(environment.DB.database.prepare('SELECT email_state FROM deliveries WHERE id = ?').get(link.id).email_state, 'sending');
    } finally { global.fetch = original; }
});
