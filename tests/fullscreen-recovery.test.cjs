'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function fixture(options = {}) {
    let content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
    let reads = 0;
    const mutations = [], events = new Map();
    const classes = new Set(['bynd-android-pwa', ...(options.ios ? ['bynd-ios'] : [])]);
    const window = {
        ByndAndroid: options.native ? {} : null,
        ByndDisplayCheck: { active: () => !!options.diagnostic },
        navigator: { userAgent: options.ua || 'Android SamsungBrowser/29.0' },
        screen: { width: 385, height: 833 }, innerWidth: 384, innerHeight: 798,
        visualViewport: { height: options.height ?? 797.87, scale: options.scale ?? 1 },
        addEventListener: (event, fn) => events.set(event, fn)
    };
    const meta = { getAttribute: () => content, setAttribute(_, value) {
        content = value; mutations.push(value);
        if (mutations.length === 2 && options.expand) window.visualViewport.height = 833;
        if (mutations.length === 1 && options.concurrent) content = options.concurrent;
    } };
    const document = {
        readyState: 'loading', hidden: !!options.hidden, activeElement: { tagName: options.focus || 'BODY' },
        fullscreenElement: options.noFullscreen ? null : {},
        documentElement: { classList: { contains: name => classes.has(name) } },
        body: { appendChild() {} }, createElement: () => ({ style: {}, remove() {} }),
        querySelector: () => meta, addEventListener: (event, fn) => events.set(event, fn)
    };
    const context = vm.createContext({ window, document,
        setTimeout: fn => { queueMicrotask(fn); },
        getComputedStyle() { reads++; if (options.failAfter && reads >= 3) throw Error('no metrics'); return { paddingTop: (options.safeTop ?? 0) + 'px' }; }
    });
    vm.runInContext(fs.readFileSync('core/diagnostics/fullscreen-recovery.js', 'utf8'), context);
    return { api: window.ByndFullscreenRecovery, window, document, events, mutations, content: () => content };
}

test('affected Samsung fullscreen viewport pulses auto then cover, preserving original viewport settings', async () => {
    const p = fixture({ expand: true });
    const original = p.content();
    const a = p.api.check(), b = p.api.check();
    assert.equal(a, b, 'duplicate calls share the pending attempt');
    const report = await a;
    assert.equal(report.outcome, 'expanded');
    assert.equal(report.before.viewportHeight, 797.87);
    assert.equal(report.after.viewportHeight, 833);
    assert.equal(p.mutations.length, 2);
    assert.match(p.mutations[0], /viewport-fit=auto/);
    assert.equal(p.content(), original);
    assert.equal(await p.api.check(), report);
    assert.equal(p.mutations.length, 2, 'there is only one attempt per page load');
});

test('unchanged Samsung viewport is recorded as unchanged, not repaired', async () => {
    const p = fixture();
    assert.equal((await p.api.check()).outcome, 'unchanged');
    assert.equal(p.api.result().after.viewportHeight, 797.87);
});

test('guard excludes other browsers, native APK, iOS, keyboard, zoom and non-affected window sizes', async () => {
    for (const options of [{ ua: 'Android Chrome' }, { native: true }, { ios: true }, { focus: 'INPUT' }, { focus: 'TEXTAREA' },
        { hidden: true }, { diagnostic: true }, { scale: 1.2 }, { height: 833 }, { height: 510 }, { safeTop: 35 }, { noFullscreen: true }]) {
        const p = fixture(options);
        assert.equal(await p.api.check(), null, JSON.stringify(options));
        assert.equal(p.mutations.length, 0);
    }
});

test('recovery restores cover even when the post-transition measurement fails', async () => {
    const p = fixture({ failAfter: true });
    const original = p.content();
    assert.equal((await p.api.check()).outcome, 'failed');
    assert.equal(p.content(), original);
});

test('recovery does not overwrite a concurrent viewport edit', async () => {
    const p = fixture({ concurrent: 'width=device-width, initial-scale=1.0, viewport-fit=contain' });
    await p.api.check();
    assert.match(p.content(), /viewport-fit=contain/);
    assert.equal(p.mutations.length, 1);
});

test('fullscreen and resume events schedule at most one native layout recalculation', async () => {
    const p = fixture();
    p.events.get('fullscreenchange')();
    p.events.get('webkitfullscreenchange')();
    p.events.get('pageshow')();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(p.mutations.length, 2);
    p.events.get('visibilitychange')();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(p.mutations.length, 2);
});

test('a keyboard guard does not consume the only attempt before the normal viewport returns', async () => {
    const p = fixture({ focus: 'INPUT' });
    assert.equal(await p.api.check(), null);
    p.document.activeElement = { tagName: 'BODY' };
    assert.equal((await p.api.check()).outcome, 'unchanged');
    assert.equal(p.mutations.length, 2);
});
