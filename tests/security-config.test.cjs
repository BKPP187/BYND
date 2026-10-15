'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), read = file => fs.readFileSync(path.join(root, file), 'utf8');
const aiWorker = import('data:text/javascript;base64,' + Buffer.from(read('workers/bynd-ai-proxy-worker.js')).toString('base64'));

test('AI proxy rejects foreign preflights and requests before contacting upstream, and requires caller credentials', async () => {
    const { default: worker } = await aiWorker;
    const oldFetch = globalThis.fetch, calls = [];
    globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response('data: test\n\n', { headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*', Vary: 'Accept' } }); };
    const endpoint = 'https://proxy.example/v1/chat/completions';
    const request = (origin, method = 'POST', token = 'Bearer fixture-token') => new Request(endpoint, { method, headers: { Cookie: 'bynd-session=fixture-private', ...(origin === undefined ? {} : { Origin: origin }), ...(token ? { Authorization: token } : {}) }, ...(method === 'POST' ? { body: '{}' } : {}) });
    try {
        for (const origin of ['https://evil.example', 'https://bynd.ccwu.cc.evil.example', undefined]) for (const method of ['OPTIONS', 'POST']) {
            const response = await worker.fetch(request(origin, method), {});
            assert.equal(response.status, 403); assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
        }
        assert.equal(calls.length, 0);
        assert.equal((await worker.fetch(request('https://bynd.ccwu.cc', 'POST', ''), {})).status, 401);
        for (const origin of ['https://bynd.ccwu.cc', 'https://proxy.example', 'null']) {
            const preflight = await worker.fetch(request(origin, 'OPTIONS'), {});
            assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
            const response = await worker.fetch(request(origin), {});
            assert.equal(response.status, 200); assert.equal(await response.text(), 'data: test\n\n');
            assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
            assert.equal(response.headers.get('Cache-Control'), 'no-store');
            assert.match(response.headers.get('Vary'), /Accept/); assert.match(response.headers.get('Vary'), /Origin/);
        }
        assert.equal(calls.length, 3); assert.ok(calls.every(call => call.init.headers.get('Authorization') === 'Bearer fixture-token'));
        assert.ok(calls.every(call => call.init.headers.get('Cookie') === null && call.init.headers.get('Origin') === null), 'app cookies never leak to the provider');
        assert.equal(calls[0].url, 'https://integrate.api.nvidia.com/v1/chat/completions');
        const models = await worker.fetch(new Request('https://proxy.example/v1/models', { headers: { Origin: 'https://bynd.ccwu.cc', Authorization: 'Bearer fixture-token' } }), { UPSTREAM_API_BASE_URL: 'https://custom-relay.example/v1' });
        assert.equal(models.status, 200);
        assert.equal(calls.at(-1).url, 'https://custom-relay.example/v1/models', 'BYND can still reach an external configured provider through the Worker');
        assert.equal(calls.at(-1).init.method, 'GET');
        globalThis.fetch = async () => new Response('{"error":"provider unavailable"}', { status: 503 });
        const failure = await worker.fetch(request('https://bynd.ccwu.cc'), {});
        assert.equal(failure.status, 503); assert.equal(failure.headers.get('Access-Control-Allow-Origin'), 'https://bynd.ccwu.cc');
        assert.match(await failure.text(), /provider unavailable/);
    } finally { globalThis.fetch = oldFetch; }
});

test('Android blocks external cleartext and excludes WebView data from cloud backup and device transfer', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    assert.match(manifest, /android:allowBackup="false"/);
    assert.match(manifest, /android:usesCleartextTraffic="false"/);
    assert.match(manifest, /android:fullBackupContent="@xml\/backup_rules"/);
    assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
    const network = read('android/app/src/main/res/xml/network_security_config.xml');
    assert.match(network, /<base-config cleartextTrafficPermitted="false"/);
    for (const section of network.matchAll(/<domain-config\s+cleartextTrafficPermitted="true">([\s\S]*?)<\/domain-config>/g)) {
        const domains = [...section[1].matchAll(/<domain includeSubdomains="false">([^<]+)<\/domain>/g)].map(match => match[1]);
        assert.ok(domains.length); assert.ok(domains.every(domain => ['127.0.0.1', 'localhost'].includes(domain)));
    }
    const legacy = read('android/app/src/main/res/xml/backup_rules.xml');
    const modern = read('android/app/src/main/res/xml/data_extraction_rules.xml');
    for (const section of [legacy, modern.match(/<cloud-backup>([\s\S]*?)<\/cloud-backup>/)[1], modern.match(/<device-transfer>([\s\S]*?)<\/device-transfer>/)[1]]) {
        for (const domain of ['root', 'file', 'database', 'sharedpref', 'external']) assert.ok(section.includes(`<exclude domain="${domain}" path="." />`), `${domain} must not enter automatic backup`);
    }
});
