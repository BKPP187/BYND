const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const html = fs.readFileSync('index.html', 'utf8');
const controller = html.match(/<script id="bynd-resource-loading-controller">([\s\S]*?)<\/script>/)[1];

function page({ native = false, early = false } = {}) {
    const classes = new Set(), listeners = new Map(), windowListeners = new Map();
    const status = { role: 'status', setAttribute(key, value) { this[key] = value; } };
    const message = { textContent: '' }, retry = { hidden: true };
    let available = !early;
    const layer = {
        removed: false,
        classList: { toggle(name, state) { this[name] = state; } },
        querySelector(selector) { return { '[data-loading-message]': message, '[data-loading-retry]': retry, '.bynd-loading-status': status }[selector]; },
        remove() { this.removed = true; }
    };
    const window = {
        ByndAndroid: native ? {} : undefined,
        addEventListener: (name, handler) => windowListeners.set(name, handler),
        removeEventListener: (name, handler) => { if (windowListeners.get(name) === handler) windowListeners.delete(name); }
    };
    const document = {
        documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
        getElementById: () => available && !layer.removed ? layer : null,
        addEventListener: (name, handler) => listeners.set(name, handler),
        removeEventListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); }
    };
    vm.runInNewContext(controller, { window, document, setTimeout() { assert.fail('loading UI must never schedule a delay'); }, setInterval() { assert.fail('loading UI must never schedule a slideshow'); } });
    return { window, layer, classes, message, retry, status, listeners, windowListeners, mount() { available = true; window.__byndResourceLoading.activate(); } };
}

test('loading view exits synchronously on real readiness and removes error handlers', () => {
    const proof = page();
    assert.equal(proof.classes.has('bynd-web-loading'), true);
    proof.window.__byndResourceLoading.initializing();
    assert.match(proof.message.textContent, /正在准备/);
    proof.window.__byndResourceLoading.ready();
    assert.equal(proof.layer.removed, true);
    assert.equal(proof.classes.has('bynd-web-loading'), false);
    assert.equal(proof.window.__byndResourceLoading, undefined);
    assert.equal(proof.listeners.size + proof.windowListeners.size, 0);
});

test('resource failure before body parsing survives mounting, repeated errors and readiness', () => {
    const proof = page({ early: true });
    proof.listeners.get('error')({ target: { tagName: 'SCRIPT', src: 'http://localhost/main.js', getAttribute: () => 'main.js?v=1' } });
    proof.mount();
    proof.window.__byndResourceLoading.fail();
    proof.window.__byndResourceLoading.initializing();
    proof.window.__byndResourceLoading.ready();
    assert.equal(proof.layer.removed, false);
    assert.equal(proof.retry.hidden, false);
    assert.equal(proof.status.role, 'alert');
    assert.match(proof.message.textContent, /加载未完成/);
});

test('optional remote resources and images do not block entry; core CSS errors do', () => {
    const proof = page();
    const error = proof.listeners.get('error');
    error({ target: { tagName: 'SCRIPT', src: 'https://cdn.test/optional.js', getAttribute: () => 'https://cdn.test/optional.js' } });
    error({ target: { tagName: 'IMG' } });
    error({ target: { tagName: 'LINK', hasAttribute: () => false } });
    assert.equal(proof.retry.hidden, true);
    error({ target: { tagName: 'LINK', hasAttribute: () => true } });
    assert.equal(proof.retry.hidden, false);
    proof.window.__byndResourceLoading.ready();
    assert.equal(proof.layer.removed, false);
});

test('initial script execution errors provide retry; Android does not create a second splash', () => {
    const proof = page();
    proof.windowListeners.get('error')({ error: new Error('script failed') });
    assert.equal(proof.retry.hidden, false);
    const native = page({ native: true });
    assert.equal(native.window.__byndResourceLoading, undefined);
    assert.equal(native.classes.size + native.listeners.size + native.windowListeners.size, 0);
});
