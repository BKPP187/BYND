'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function fixture({ search = '', fullscreen = 'success', clipboard = 'success', ua = 'Android SamsungBrowser PRIVATE-UA', native = false } = {}) {
    const nodes = new Map();
    const copied = [];
    const calls = [];
    function node() {
        return { style: {}, dataset: {}, isConnected: false, disabled: false,
            bounds: { top: 0, left: 0, width: 375, height: 844, bottom: 844 },
            setAttribute() {}, addEventListener() {},
            getBoundingClientRect() { return this.bounds; },
            appendChild(child) { child.isConnected = true; },
            insertBefore(child) { child.isConnected = true; },
            remove() { this.isConnected = false; },
            querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); },
            querySelectorAll() { return [this.querySelector('[data-display-check]'), this.querySelector('[data-display-copy]'), this.querySelector('[data-display-close]')]; }
        };
    }
    const phone = node(), bar = node(), home = node(), body = node();
    bar.bounds = { top: 0, left: 0, width: 375, height: 83, bottom: 83 };
    const document = { readyState: 'complete', body,
        documentElement: { classList: { contains: name => name === 'bynd-android-pwa' } },
        querySelector: selector => selector === '.phone-container' ? phone : selector === '.status-bar' ? bar : null,
        getElementById: id => id === 'home-screen' ? home : null,
        createElement: () => node(), addEventListener() {}, fullscreenEnabled: true
    };
    if (fullscreen !== 'unsupported') phone.requestFullscreen = options => {
        calls.push(options);
        if (fullscreen === 'denied') return Promise.reject(Object.assign(new Error('secret-key private-error'), { name: 'NotAllowedError' }));
        if (fullscreen === 'already') return Promise.reject(new Error('should not request'));
        document.fullscreenElement = phone;
        return Promise.resolve();
    };
    if (fullscreen === 'already') document.fullscreenElement = phone;
    if (fullscreen !== 'unsupported') document.documentElement.requestFullscreen = options => {
        calls.push(options);
        if (fullscreen === 'denied') return Promise.reject(Object.assign(new Error('PRIVATE-ROOT-ERROR'), { name: 'NotAllowedError' }));
        document.fullscreenElement = document.documentElement;
        return Promise.resolve();
    };
    const window = { location: { search }, innerWidth: 375, innerHeight: 844, devicePixelRatio: 3,
        ByndAndroid: native ? {} : null,
        screen: { width: 375, height: 915, availHeight: 890 }, visualViewport: { height: 844, offsetTop: 0, scale: 1 },
        navigator: { userAgent: ua, clipboard: { writeText: async text => {
            if (clipboard === 'denied') throw new Error('denied');
            copied.push(text);
        } } },
        matchMedia: query => ({ matches: query === '(display-mode: standalone)' }),
        localStorage: { getItem() { throw new Error('must not read storage'); } },
        fetch() { throw new Error('must not upload'); }
    };
    let modeUpdates = 0;
    const context = vm.createContext({ window, document, APP_VERSION: 'v1.1.888',
        getComputedStyle: el => ({ paddingTop: el === body ? '0px' : '59px', paddingBottom: '24px', paddingLeft: '0px', paddingRight: '0px', display: 'flex', visibility: 'visible', opacity: '1', backgroundImage: 'url(PRIVATE-WALLPAPER)' }),
        requestAnimationFrame: callback => callback(), setTimeout(callback, ms) { if (ms) queueMicrotask(callback); }, markByndDisplayMode() { modeUpdates++; }
    });
    vm.runInContext(fs.readFileSync('core/diagnostics/display-check.js', 'utf8'), context);
    return { api: window.ByndDisplayCheck, nodes, phone, calls, copied, document, modeUpdates: () => modeUpdates,
        message: () => nodes.get('[data-display-status]')?.textContent };
}

test('display check is inactive during normal use and can open inside an existing installed app', () => {
    const p = fixture();
    assert.equal(p.api.requested(), false);
    assert.equal(p.api.active(), false);
    const panel = p.api.open();
    assert.equal(p.api.active(), true);
    assert.equal(p.api.open(), panel);
    panel.remove();
    assert.equal(p.api.active(), false);
});

test('display report records before and after actual fullscreen without exposing arbitrary strings', async () => {
    const p = fixture({ search: '?v=1.1.764&secret=PRIVATE-QUERY&display-check=1' });
    p.api.open();
    const report = await p.api.check();
    assert.equal(report.appVersion, 'v1.1.888');
    assert.equal(report.launchVersion, '1.1.764');
    assert.equal(report.before.fullscreenElement, 'none');
    assert.equal(report.after.fullscreenElement, 'phone');
    assert.equal(report.after.safeArea.top, 59);
    assert.equal(report.after.phone.top, 0);
    assert.equal(report.after.statusBar.visible, true);
    assert.equal(report.fullscreenRequest.outcome, 'entered');
    assert.equal(p.calls[0].navigationUI, 'hide');
    assert.equal(p.modeUpdates(), 1);
    assert.equal(p.copied.length, 1);
    assert.doesNotMatch(p.copied[0], /PRIVATE|secret-key/);
    assert.match(p.message(), /已复制/);
});

test('fullscreen denial is reported without claiming a fix, leaking exception text or losing baseline', async () => {
    const p = fixture({ fullscreen: 'denied' }); p.api.open();
    const result = await p.api.check();
    assert.equal(result.fullscreenRequest.outcome, 'rejected');
    assert.equal(result.fullscreenRequest.errorType, 'NotAllowedError');
    assert.equal(result.before.fullscreenElement, 'none');
    assert.equal(result.after.fullscreenElement, 'none');
    assert.doesNotMatch(p.copied[0], /secret-key|private-error/);
    assert.doesNotMatch(p.message(), /已修复|全屏成功/);
});

test('unavailable and already active fullscreen produce distinct outcomes without needless requests', async () => {
    for (const [fullscreen, expected] of [['unsupported', 'unsupported'], ['already', 'already_fullscreen']]) {
        const p = fixture({ fullscreen }); p.api.open();
        assert.equal((await p.api.check()).fullscreenRequest.outcome, expected);
        assert.equal(p.calls.length, 0);
    }
});

test('clipboard failure shows selectable result and never reports copying success', async () => {
    const p = fixture({ clipboard: 'denied' }); p.api.open();
    assert.equal(await p.api.copy(), false);
    assert.equal(p.nodes.get('textarea').hidden, false);
    assert.equal(JSON.parse(p.nodes.get('textarea').value).fullscreenRequest.outcome, 'not_requested');
    assert.match(p.message(), /未能复制/);
    assert.doesNotMatch(p.message(), /已复制/);
});

test('measurement failure restores the button and does not create a success report', async () => {
    const p = fixture(); p.api.open(); p.phone.getBoundingClientRect = () => { throw new Error('unavailable'); };
    assert.equal(await p.api.check(), null);
    assert.equal(p.nodes.get('[data-display-check]').disabled, false);
    assert.equal(p.copied.length, 0);
    assert.match(p.message(), /未完成/);
    assert.equal(await p.api.copy(), false);
});

test('whole-page comparison switches from a fullscreen phone to the document and records both targets', async () => {
    const p = fixture({ fullscreen: 'already' }); p.api.open();
    const result = await p.api.checkPage();
    assert.equal(result.before.fullscreenElement, 'phone');
    assert.equal(result.after.fullscreenElement, 'document');
    assert.equal(result.fullscreenRequest.target, 'document');
    assert.equal(result.fullscreenRequest.outcome, 'entered');
    assert.equal(p.calls.length, 1);
    assert.equal(p.calls[0].navigationUI, 'hide');
    assert.doesNotMatch(p.message(), /已修复/);
});

test('whole-page comparison handles denial and stays unavailable in other browsers or the APK', async () => {
    const p = fixture({ fullscreen: 'denied' }); p.api.open();
    const denied = await p.api.checkPage();
    assert.equal(denied.fullscreenRequest.outcome, 'rejected');
    assert.equal(denied.fullscreenRequest.errorType, 'NotAllowedError');
    assert.doesNotMatch(p.copied[0], /PRIVATE-ROOT-ERROR/);
    for (const options of [{ ua: 'Android Chrome/142.0.8071.1' }, { native: true }, { ua: 'iPhone Safari' }]) {
        const q = fixture(options); q.api.open();
        assert.equal((await q.api.checkPage()).fullscreenRequest.outcome, 'unsupported');
        assert.equal(q.calls.length, 0);
    }
});

test('browser versions export bounded numeric components and no raw user agent text', () => {
    const p = fixture({ ua: 'Android SamsungBrowser/29.0 Chrome/142.0.8071.20 PRIVATE-UA' });
    const snapshot = p.api.snapshot();
    assert.equal(snapshot.browserVersion, '29.0');
    assert.equal(snapshot.chromiumVersion, '142.0.8071.20');
    assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE-UA/);
    assert.equal(fixture({ ua: 'Android SamsungBrowser/SECRET Chrome/SECRET' }).api.snapshot().browserVersion, null);
});

test('diagnostic mode avoids the automatic gesture request so the baseline remains observable', () => {
    const source = fs.readFileSync('systems/proactive-notifications/notifications.js', 'utf8');
    const events = [];
    const classes = new Set(['mobile-runtime']);
    const context = vm.createContext({ window: {
        location: { search: '?bynd-app=desktop&display-check=1' }, navigator: { userAgent: 'Android SamsungBrowser' },
        matchMedia: query => ({ matches: query === '(display-mode: standalone)', addEventListener() {} })
    }, document: { documentElement: { classList: { contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) } },
        addEventListener: name => events.push(name)
    }, ensureByndServiceWorker() {} });
    vm.runInContext(source.slice(source.indexOf('function isByndMobileRuntime()'), source.indexOf('function cleanupByndServiceWorkerIfIdle()')), context);
    vm.runInContext('initByndFullscreenRuntime()', context);
    assert.equal(classes.has('bynd-android-pwa'), true);
    assert.ok(events.includes('fullscreenchange'));
    assert.ok(!events.includes('pointerup'));
    assert.ok(!events.includes('touchend'));
});
