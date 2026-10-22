const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { memoryStorage } = require('./helpers/harness.cjs');

const root = path.resolve(__dirname, '..');
const workerModule = import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.join(root, 'workers/bynd-push-worker.js'))).toString('base64'));
const endpoint = 'https://fcm.googleapis.com/fcm/send/abc';

function kv() {
    const values = new Map();
    return { values, get: async key => values.get(key) ?? null, put: async (key, value) => { values.set(key, value); }, delete: async key => { values.delete(key); }, list: async () => ({ keys: [...values.keys()].map(name => ({ name })) }) };
}
const post = (pathname, body) => new Request('https://bynd.ccwu.cc' + pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const subscribeBody = extra => ({ clientId: 'device-a', subscription: { endpoint, keys: { p256dh: 'p', auth: 'a' } }, settings: { enabled: true }, ...extra });

test('first subscribe issues a secret and stores only its hash', async () => {
    const { default: worker } = await workerModule;
    const env = { BYND_PUSH: kv() };
    const response = await worker.fetch(post('/subscribe', subscribeBody()), env);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.match(body.clientSecret, /^[A-Za-z0-9_-]{43}$/);
    const stored = env.BYND_PUSH.values.get('sub:device-a');
    assert.ok(!stored.includes(body.clientSecret), 'the secret itself is never stored');
    assert.match(JSON.parse(stored).secretHash, /^[A-Za-z0-9_-]{43}$/);
});

test('a subscribe or contact without the right secret cannot change the record', async () => {
    const { default: worker } = await workerModule;
    const env = { BYND_PUSH: kv() };
    const { clientSecret } = await (await worker.fetch(post('/subscribe', subscribeBody()), env)).json();
    const before = env.BYND_PUSH.values.get('sub:device-a');
    const hijack = subscribeBody({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/attacker', keys: { p256dh: 'p', auth: 'a' } } });
    for (const secret of [undefined, '', 'x'.repeat(43)]) {
        const response = await worker.fetch(post('/subscribe', { ...hijack, clientSecret: secret }), env);
        assert.equal(response.status, 403);
        assert.equal((await response.json()).code, 'client_secret_mismatch');
    }
    assert.equal((await worker.fetch(post('/contact', { clientId: 'device-a', charId: 'c', clientSecret: 'y'.repeat(43) }), env)).status, 403);
    assert.equal(env.BYND_PUSH.values.get('sub:device-a'), before);
    const own = await worker.fetch(post('/subscribe', subscribeBody({ clientSecret })), env);
    assert.equal(own.status, 200);
    assert.equal((await own.json()).clientSecret, undefined, 'an existing secret is kept, not rotated');
    assert.equal((await worker.fetch(post('/contact', { clientId: 'device-a', charId: 'c', clientSecret }), env)).status, 200);
});

test('records from before secrets existed are claimed by their next subscribe', async () => {
    const { default: worker } = await workerModule;
    const env = { BYND_PUSH: kv() };
    env.BYND_PUSH.values.set('sub:device-a', JSON.stringify({ clientId: 'device-a', subscription: { endpoint }, settings: { enabled: true }, state: {} }));
    assert.equal((await worker.fetch(post('/contact', { clientId: 'device-a', charId: 'c' }), env)).status, 200, 'legacy contact keeps working');
    const { clientSecret } = await (await worker.fetch(post('/subscribe', subscribeBody()), env)).json();
    assert.match(clientSecret, /^[A-Za-z0-9_-]{43}$/);
    assert.equal((await worker.fetch(post('/contact', { clientId: 'device-a', charId: 'c' }), env)).status, 403);
});

function clientHarness(responses) {
    const localStorage = memoryStorage({ bynd_proactive_notify_client_id_v1: 'restored-from-backup' });
    const requests = [];
    const statuses = [];
    const subscription = { endpoint };
    const context = vm.createContext({
        localStorage, console, Date, JSON, Error, Promise, location: { origin: 'https://bynd.ccwu.cc', pathname: '/' },
        window: { crypto: { randomUUID: () => 'fresh-id' }, PushManager: function () {}, Notification: { permission: 'granted' }, myCharacters: [] },
        navigator: { serviceWorker: {} }, Notification: { permission: 'granted' },
        fetch: async (url, options) => { requests.push(JSON.parse(options.body)); const next = responses.shift(); return { ok: next.status === 200, status: next.status, json: async () => next.body }; }
    });
    context.window.PushManager = function () {};
    vm.runInContext(fs.readFileSync(path.join(root, 'systems/proactive-notifications/notifications.js'), 'utf8'), context);
    Object.assign(context, {
        resolveProactiveNotifySettings: () => ({ enabled: true, workerEndpoint: 'https://bynd.ccwu.cc', vapidPublicKey: 'AAAA' }),
        ensureByndServiceWorker: async () => ({ pushManager: { getSubscription: async () => subscription } }),
        getProactiveNotifyState: () => ({}), buildProactiveNotifySyncPayload: () => ({ chars: [] }),
        updateProactiveNotifyStatus: text => statuses.push(text)
    });
    return { context, localStorage, requests, statuses };
}

test('the web client stores the issued secret and sends it back', async () => {
    const h = clientHarness([{ status: 200, body: { ok: true, clientSecret: 'S'.repeat(43) } }, { status: 200, body: { ok: true } }]);
    await h.context.syncProactivePushSubscription();
    assert.equal(h.localStorage.getItem('bynd_proactive_notify_client_secret_v1'), 'S'.repeat(43));
    await h.context.syncProactivePushSubscription();
    assert.equal(h.requests[1].clientSecret, 'S'.repeat(43));
});

test('a clientId owned by another device gets a fresh identity instead of overwriting it', async () => {
    const h = clientHarness([{ status: 403, body: { ok: false, code: 'client_secret_mismatch', error: 'client secret mismatch' } }, { status: 200, body: { ok: true, clientSecret: 'N'.repeat(43) } }]);
    await h.context.syncProactivePushSubscription();
    assert.deepEqual(h.requests.map(r => r.clientId), ['restored-from-backup', 'fresh-id']);
    assert.equal(h.localStorage.getItem('bynd_proactive_notify_client_id_v1'), 'fresh-id');
    assert.equal(h.localStorage.getItem('bynd_proactive_notify_client_secret_v1'), 'N'.repeat(43));
});

test('a failed subscribe is reported instead of claiming success', async () => {
    const h = clientHarness([{ status: 500, body: { ok: false, error: 'kv unavailable' } }]);
    await assert.rejects(h.context.syncProactivePushSubscription(), /云端订阅失败（500）：kv unavailable/);
    assert.ok(!h.statuses.includes('云端推送订阅已同步。'));
});

test('the push secret never travels in a backup', () => {
    const source = fs.readFileSync(path.join(root, 'core/storage/backup.js'), 'utf8');
    assert.equal((source.match(/'bynd_proactive_notify_client_secret_v1'/g) || []).length, 2, 'excluded from export and import');
});
