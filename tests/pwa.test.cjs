const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const { sourceSection } = require('./helpers/harness.cjs');

test('install manifest supplies real 192 and 512 pixel PNG assets within app scope', () => {
    const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8').replace(/^\uFEFF/, ''));
    const base = new URL('https://bynd.ccwu.cc/');
    for (const size of [192, 512]) {
        const icon = manifest.icons.find(item => item.sizes === `${size}x${size}` && item.purpose === 'any');
        assert.ok(icon, `Missing ${size}px install icon`);
        assert.equal(icon.type, 'image/png');
        const url = new URL(icon.src, base);
        assert.equal(url.origin, base.origin);
        const png = fs.readFileSync(icon.src);
        assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        assert.equal(png.readUInt32BE(16), size);
        assert.equal(png.readUInt32BE(20), size);
    }
    assert.equal(manifest.id, '/');
    assert.equal(new URL(manifest.start_url, base).pathname, '/');
    assert.ok(['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display));
});

test('Apple home screen icon links to a real 180 pixel PNG', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const src = html.match(/<link rel="apple-touch-icon" sizes="180x180" href="([^"?]+)/)?.[1];
    assert.ok(src);
    const png = fs.readFileSync(src);
    assert.equal(png.readUInt32BE(16), 180);
    assert.equal(png.readUInt32BE(20), 180);
});

test('disabling push preserves the installation worker and deletes only notification cache', async () => {
    let removed = '', unregistered = false;
    const context = vm.createContext({ getProactiveNotifySettings: () => ({ enabled: false }), navigator: { serviceWorker: { getRegistrations: async () => [{ unregister: () => { unregistered = true; } }] } }, window: { caches: true }, caches: { delete: async name => { removed = name; } } });
    vm.runInContext(sourceSection('systems/proactive-notifications/notifications.js', 'function cleanupByndServiceWorkerIfIdle()', 'function ensureByndServiceWorker()'), context);
    vm.runInContext('cleanupByndServiceWorkerIfIdle()', context);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(unregistered, false); assert.equal(removed, 'bynd-notify-cache-v1');
});
test('PWA navigation passes through online responses, reports offline errors and never intercepts API requests', async () => {
    const listeners = new Map(); let offline = false;
    const online = new Response('online', { status: 200 });
    vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), { self: { location: { origin: 'https://bynd.ccwu.cc' }, addEventListener: (name, handler) => listeners.set(name, handler) }, URL, Response, fetch: async () => { if (offline) throw new Error('offline'); return online; } });
    const navigate = listeners.get('fetch'); let result;
    const request = { mode: 'navigate', url: 'https://bynd.ccwu.cc/' };
    navigate({ request, respondWith: promise => { result = promise; } }); assert.equal(await result, online);
    offline = true; navigate({ request, respondWith: promise => { result = promise; } });
    const response = await result; assert.equal(response.status, 503); assert.match(await response.text(), /暂时没有网络/);
    for (const request of [{ mode: 'cors', url: 'https://bynd.ccwu.cc/api/chat' }, { mode: 'navigate', url: 'https://other.example/' }]) navigate({ request, respondWith: () => assert.fail('API/cross-origin requests must remain untouched') });
});
