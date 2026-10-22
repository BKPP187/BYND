const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const moduleFrom = file => import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.join(root, file))).toString('base64'));
const post = (url, headers = {}, body = '{"prompt":"x"}') => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });

async function withFetch(fake, run) {
    const original = globalThis.fetch;
    globalThis.fetch = fake;
    try { return await run(); } finally { globalThis.fetch = original; }
}

test('image worker never spends the server key without the proxy token', async () => {
    const { default: worker } = await moduleFrom('workers/bynd-image-worker.js');
    const calls = [];
    const fake = async (url, options) => { calls.push({ url, options }); return new Response('{"data":[]}', { headers: { 'Content-Type': 'application/json' } }); };
    const env = { IMAGE_API_KEY: 'sk-server', IMAGE_PROXY_TOKEN: 'p'.repeat(40) };
    await withFetch(fake, async () => {
        const url = 'https://img.example/images/generations';
        assert.equal((await worker.fetch(post(url), env)).status, 401);
        assert.equal((await worker.fetch(post(url, { Authorization: 'Bearer guess' }), env)).status, 401);
        assert.equal((await worker.fetch(post(url, { Authorization: 'Bearer ' + env.IMAGE_PROXY_TOKEN }), { IMAGE_API_KEY: 'sk-server' })).status, 503, 'a server key without a proxy token is refused');
        assert.equal((await worker.fetch(post(url, { Origin: 'https://evil.example', Authorization: 'Bearer ' + env.IMAGE_PROXY_TOKEN }), env)).status, 403);
        assert.equal(calls.length, 0);
        const ok = await worker.fetch(post(url, { Authorization: 'Bearer ' + env.IMAGE_PROXY_TOKEN, Cookie: 'session=secret' }), env);
        assert.equal(ok.status, 200);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer sk-server');
        assert.equal(calls[0].options.headers.get('Cookie'), null, 'browser cookies are not forwarded');
        assert.equal(ok.headers.get('Access-Control-Allow-Origin'), null);
    });
});

test('image worker without a server key only relays the caller key', async () => {
    const { default: worker } = await moduleFrom('workers/bynd-image-worker.js');
    const calls = [];
    await withFetch(async (url, options) => { calls.push(options); return new Response('{}'); }, async () => {
        const url = 'https://img.example/images/generations';
        assert.equal((await worker.fetch(post(url), {})).status, 401);
        assert.equal((await worker.fetch(post(url, { Origin: 'https://bynd.ccwu.cc', Authorization: 'Bearer sk-user' }), {})).status, 200);
        assert.equal(calls[0].headers.get('Authorization'), 'Bearer sk-user');
    });
});

test('push contact endpoint rejects oversized bodies before parsing', async () => {
    const { default: worker } = await moduleFrom('workers/bynd-push-worker.js');
    const env = { BYND_PUSH: { get: async () => null, put: async () => { throw new Error('must not write'); } } };
    const big = JSON.stringify({ clientId: 'abc', charId: 'c', pad: 'x'.repeat(64 * 1024) });
    const response = await worker.fetch(post('https://bynd.ccwu.cc/contact', {}, big), env);
    assert.equal(response.status, 413);
});

test('license activation reports malformed base64 as bad input', async () => {
    const { unbase64url } = await import(require('node:url').pathToFileURL(path.join(root, 'workers/license/worker.mjs')).href);
    assert.throws(() => unbase64url('A'), error => error.status === 400 && error.code === 'invalid_encoding');
    assert.deepEqual([...unbase64url('AQID')], [1, 2, 3]);
});

test('bubble preset names are rendered as text, not HTML', () => {
    const source = fs.readFileSync(path.join(root, 'apps/wechat/ui/bubble-presets.js'), 'utf8');
    const start = source.indexOf('function renderBubblePresetDropdown');
    const end = source.indexOf('\nfunction ', start + 10);
    const created = [];
    const select = { value: '', replaceChildren(...children) { this.children = children; }, set innerHTML(_) { throw new Error('innerHTML must not be used'); } };
    const context = vm.createContext({
        document: { getElementById: () => select, createElement: () => { const el = {}; created.push(el); return el; } },
        getAllBubblePresets: () => [{ id: 'default', name: '默认', css: '' }, { id: 'x"><img src=x onerror=alert(1)>', name: '<img src=x onerror=alert(1)>', css: 'a' }],
        renderBubblePresetPicker() {}
    });
    vm.runInContext(source.slice(start, end), context);
    context.renderBubblePresetDropdown('');
    assert.equal(select.children.length, 2);
    assert.equal(select.children[1].textContent, '<img src=x onerror=alert(1)>');
    assert.equal(select.children[1].value, 'x"><img src=x onerror=alert(1)>');
});
