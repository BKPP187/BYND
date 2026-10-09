'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function page(navigator = {}, bridge) {
    const events = new Map();
    const listen = (name, callback) => events.set(name, callback);
    const elements = Object.fromEntries(['battery-level', 'battery-icon', 'network-icon', 'network-label', 'clock-time-small'].map(id => [id, {
        textContent: '', hidden: false, className: '', attributes: {},
        style: { values: {}, setProperty(k, v) { this.values[k] = v; } },
        setAttribute(k, v) { this.attributes[k] = v; }
    }]));
    const fill = { attributes: {}, setAttribute(k, v) { this.attributes[k] = v; } };
    elements['battery-icon'].querySelector = () => fill;
    const classes = new Set();
    let observer, appOpen = false;
    const window = { ByndAndroid: bridge, addEventListener: listen };
    const document = { hidden: false, addEventListener: listen, getElementById: id => elements[id],
        documentElement: { classList: { add: name => classes.add(name), contains: name => classes.has(name) } },
        querySelector: () => appOpen ? {} : null };
    const context = vm.createContext({ window, document, navigator, console,
        setInterval() {}, MutationObserver: class { constructor(callback) { observer = callback; } observe() {} } });
    vm.runInContext(fs.readFileSync('ui/components/device.js', 'utf8'), context);
    return { elements, fill, events, classes, window, run: code => vm.runInContext(code, context),
        mutate: () => observer(), openApp: () => { appOpen = true; observer(); } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('battery follows charge changes and never substitutes full charge for unreadable state', async () => {
    const handlers = {};
    const battery = { level: .77, charging: false, addEventListener: (name, callback) => handlers[name] = callback };
    const p = page({ getBattery: async () => battery }); p.run('initBattery(); initBattery();'); await settle();
    assert.equal(p.elements['battery-level'].textContent, '77%');
    assert.equal(p.fill.attributes.width, '13.86', '77% leaves 23% of the chamber empty');
    battery.level = .12; handlers.levelchange();
    assert.equal(p.elements['battery-level'].textContent, '12%');
    assert.match(p.elements['battery-icon'].className, /is-low/);
    battery.charging = true; handlers.chargingchange();
    assert.match(p.elements['battery-icon'].className, /is-charging/);
    assert.equal(p.fill.attributes.width, '2.16', 'charging at 12% must not look full');
    for (const percent of [0, 25, 50, 77, 100]) {
        battery.level = percent / 100; handlers.levelchange();
        assert.equal(p.fill.attributes.width, (18 * percent / 100).toFixed(2));
    }
    battery.level = 1; handlers.levelchange(); assert.equal(p.elements['battery-level'].textContent, '100%');
    battery.level = NaN; handlers.levelchange();
    assert.equal(p.elements['battery-level'].textContent, '--%'); assert.equal(p.elements['battery-icon'].hidden, true);
    assert.equal(p.fill.attributes.width, '0');
    for (const navigator of [{}, { getBattery: () => Promise.reject(new Error('denied')) }, { getBattery: () => { throw new Error('unavailable'); } }]) {
        const q = page(navigator); q.run('initBattery()'); await settle();
        assert.equal(q.elements['battery-level'].textContent, '--%'); assert.equal(q.elements['battery-icon'].hidden, true);
    }
});

test('network reacts to Wi-Fi, mobile data and offline without treating throughput as signal strength', () => {
    const connection = { type: 'wifi', effectiveType: '4g', addEventListener(name, callback) { this.changed = callback; } };
    const navigator = { onLine: true, connection };
    const p = page(navigator); p.run('initDeviceNetwork()');
    assert.equal(p.elements['network-icon'].className, 'ri-wifi-line');
    connection.type = 'cellular'; connection.changed(); assert.equal(p.elements['network-label'].hidden, false);
    navigator.onLine = false; p.events.get('offline')(); assert.equal(p.elements['network-icon'].className, 'ri-wifi-off-line');
    navigator.onLine = true; connection.type = undefined; p.events.get('online')();
    assert.equal(p.elements['network-icon'].className, 'ri-global-line'); assert.equal(p.elements['network-label'].hidden, true);
});

test('native status bar responds to visibility and wallpaper, and stays readable inside apps', () => {
    const calls = [];
    const p = page({}, { setSystemStatusBar: (...args) => calls.push(args) }); p.run('initNativeStatusBar()');
    assert.equal(p.classes.has('bynd-native-statusbar'), true); assert.deepEqual(calls.at(-1), [true, false]);
    p.window.homeIsDark = true; p.mutate(); assert.deepEqual(calls.at(-1), [true, true]);
    p.openApp(); assert.deepEqual(calls.at(-1), [true, false]);
    p.classes.add('bynd-statusbar-hidden'); p.mutate(); assert.deepEqual(calls.at(-1), [false, false]);
    const before = calls.length; p.mutate(); assert.equal(calls.length, before);
});

test('installed PWA requests fullscreen while preserving fallback and iOS safe areas without forcing a page tap', () => {
    const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
    assert.equal(manifest.display, 'fullscreen');
    assert.deepEqual(manifest.display_override, ['fullscreen', 'standalone']);
    const source = fs.readFileSync('systems/proactive-notifications/notifications.js', 'utf8');
    for (const [mode, isIOS] of [['fullscreen', false], ['standalone', false], ['browser', false], ['fullscreen', true]]) {
        const events = [];
        const classes = new Set(['mobile-runtime', ...(isIOS ? ['bynd-ios'] : [])]);
        const p = vm.createContext({ window: { matchMedia: query => ({ matches: query === `(display-mode: ${mode})`, addEventListener() {} }), navigator: {} },
            document: { documentElement: { classList: { contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) } },
                addEventListener: name => events.push(name) }, ensureByndServiceWorker() {} });
        vm.runInContext(source.slice(source.indexOf('function isByndMobileRuntime()'), source.indexOf('function cleanupByndServiceWorkerIfIdle()')), p);
        vm.runInContext('initByndFullscreenRuntime()', p);
        assert.equal(classes.has('bynd-native-statusbar'), isIOS || mode !== 'fullscreen');
        assert.equal(classes.has('bynd-display-fullscreen'), !isIOS && mode === 'fullscreen');
        assert.ok(!events.includes('click') && !events.includes('touchend'));
    }
});
