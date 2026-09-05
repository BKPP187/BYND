const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');

function makeClassList() {
    const values = new Set();
    return {
        add: (...names) => names.forEach(name => values.add(name)),
        remove: (...names) => names.forEach(name => values.delete(name)),
        contains: name => values.has(name)
    };
}

function runHeadPrefetch(savedTheme, { getItemError = false } = {}) {
    const classList = makeClassList();
    const appended = [];
    const localStorage = {
        getItem() {
            if (getItemError) throw new Error('storage unavailable');
            return savedTheme;
        }
    };
    const document = {
        documentElement: { classList },
        head: { appendChild: node => appended.push(node) },
        createElement: () => ({})
    };
    const window = {
        ByndAndroid: false,
        navigator: { standalone: false },
        matchMedia: () => ({ matches: false })
    };
    const context = vm.createContext({
        window,
        navigator: { userAgent: 'Mozilla/5.0', maxTouchPoints: 0 },
        screen: { width: 1280, height: 800 },
        innerWidth: 1280,
        innerHeight: 800,
        localStorage,
        document
    });
    window.window = window;
    vm.runInContext(html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)[1], context);
    return { classList, appended };
}

assert.equal(runHeadPrefetch('{"startupEnabled":false}').classList.contains('bynd-startup-disabled'), true);
assert.equal(runHeadPrefetch('{"startupEnabled":true}').classList.contains('bynd-startup-disabled'), false);
assert.equal(runHeadPrefetch('{}').classList.contains('bynd-startup-disabled'), false);
assert.equal(runHeadPrefetch('{').classList.contains('bynd-startup-disabled'), false, 'malformed theme data must not disable startup');
assert.equal(runHeadPrefetch(null, { getItemError: true }).classList.contains('bynd-startup-disabled'), false, 'storage errors must preserve startup');

function runDisabledStartupController() {
    const classList = makeClassList();
    const layer = {
        hidden: false,
        attributes: new Map(),
        classList: makeClassList(),
        setAttribute(name, value) { this.attributes.set(name, value); },
        getAttribute(name) { return this.attributes.get(name); }
    };
    const listeners = new Map();
    let timeoutCalls = 0;
    const document = {
        readyState: 'loading',
        documentElement: { classList },
        getElementById: id => id === 'bynd-startup' ? layer : null,
        addEventListener: (name, handler) => listeners.set(name, handler),
        querySelectorAll: () => []
    };
    const window = {
        setTimeout: () => { timeoutCalls += 1; },
        clearTimeout() {},
        location: { search: '' },
        matchMedia: () => ({ matches: false })
    };
    const context = vm.createContext({
        window,
        document,
        navigator: {},
        localStorage: { getItem: () => '{"startupEnabled":false}', setItem() {} },
        performance: { now: () => 0 },
        console,
        URLSearchParams,
        Promise,
        setTimeout: window.setTimeout
    });
    window.window = window;
    vm.runInContext(`${script}\nglobalThis.__startupController = byndStartupController;`, context);
    return { context, layer, classList, listeners, getTimeoutCalls: () => timeoutCalls };
}

const disabled = runDisabledStartupController();
assert.equal(disabled.layer.hidden, true, 'disabled startup must hide synchronously');
assert.equal(disabled.layer.getAttribute('aria-hidden'), 'true');
assert.equal(disabled.classList.contains('bynd-startup-disabled'), false, 'runtime cleanup must remove pre-render class');
assert.ok(disabled.listeners.has('DOMContentLoaded'), 'core initialization should remain deferred until DOMContentLoaded');
assert.equal(disabled.getTimeoutCalls(), 0, 'disabled startup must not schedule animation timers');
vm.runInContext('__startupController.markReady()', disabled.context);
assert.equal(disabled.getTimeoutCalls(), 0, 'disabled markReady must remain a no-op');

console.log('startup feature tests passed');
