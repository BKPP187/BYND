const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');
const headScript = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)[1];

function makeClassList() {
    const values = new Set();
    return {
        add: (...names) => names.forEach(name => values.add(name)),
        remove: (...names) => names.forEach(name => values.delete(name)),
        contains: name => values.has(name)
    };
}

function createPage(savedTheme = '{}', { storageError = false, runHead = true, displayMode = 'browser', iosStandalone = false, androidApp = false, userAgent = 'Mozilla/5.0' } = {}) {
    let now = 0;
    let nextTimerId = 0;
    const timers = new Map();
    const storageWrites = [];
    const listeners = new Map();
    const errors = [];
    const classList = makeClassList();
    const layer = {
        hidden: false,
        attributes: new Map(),
        setAttribute(name, value) { this.attributes.set(name, value); }
    };
    const document = {
        readyState: 'loading',
        documentElement: { classList },
        head: { appendChild() {} },
        createElement: () => ({}),
        getElementById: id => id === 'bynd-startup' ? layer : null,
        addEventListener: (name, handler) => {
            const handlers = listeners.get(name) || [];
            handlers.push(handler);
            listeners.set(name, handlers);
        },
        querySelectorAll: () => []
    };
    const window = {
        navigator: { standalone: iosStandalone },
        ByndAndroid: androidApp ? {} : undefined,
        location: { search: '?bynd-intro=first' },
        matchMedia: query => ({ matches: query === `(display-mode: ${displayMode})` }),
        setTimeout(callback, delay) {
            const id = ++nextTimerId;
            timers.set(id, { callback, due: now + delay });
            return id;
        },
        clearTimeout: id => timers.delete(id)
    };
    const context = vm.createContext({
        window,
        document,
        navigator: { userAgent, maxTouchPoints: 0 },
        screen: { width: 1280, height: 800 },
        innerWidth: 1280,
        innerHeight: 800,
        localStorage: {
            getItem(key) {
                if (storageError) throw new Error('storage unavailable');
                return key === 'my_theme_data' ? savedTheme : '1';
            },
            setItem: (...args) => storageWrites.push(args)
        },
        console: { ...console, error: (...args) => errors.push(args) },
        performance: { now: () => now },
        URLSearchParams,
        Promise,
        setTimeout: window.setTimeout
    });
    if (runHead) vm.runInContext(headScript, context);
    return {
        window, document, layer, classList, context, timers, listeners, storageWrites, errors,
        advance(duration) {
            now += duration;
            for (const [id, timer] of timers) {
                if (timer.due > now) continue;
                timers.delete(id);
                timer.callback();
            }
        },
        loadRuntime() {
            vm.runInContext(`${script}\nglobalThis.__controller = byndStartupController;`, context);
            return context.__controller;
        }
    };
}

async function main() {
    for (const data of ['{}', '{"startupEnabled":true}', '{', null]) {
        const page = createPage(data);
        assert.equal(page.classList.contains('bynd-startup-loading'), false);
        page.advance(299);
        assert.equal(page.classList.contains('bynd-startup-loading'), false);
        page.advance(1);
        assert.equal(page.classList.contains('bynd-startup-loading'), true, 'slow downloads must show loading before application scripts run');
        const controller = page.loadRuntime();
        assert.equal(controller, page.window.__byndStartup, 'runtime must reuse the HTML loading lifecycle');
        controller.markReady();
        assert.equal(page.classList.contains('bynd-startup-loading'), false);
        assert.equal(page.layer.hidden, true, 'ready must hide immediately without a minimum duration or exit timer');
        assert.equal(page.layer.attributes.get('aria-hidden'), 'true');
        assert.equal(page.timers.size, 0);
        controller.markReady();
        page.advance(10000);
        assert.equal(page.classList.contains('bynd-startup-loading'), false, 'loading must never replay after ready');
        assert.equal(page.storageWrites.some(([key]) => key === 'bynd_startup_seen_v1'), false, 'loading must not use a first-visit playback marker');
    }

    const unavailable = createPage(null, { storageError: true });
    unavailable.advance(300);
    assert.equal(unavailable.classList.contains('bynd-startup-loading'), true);

    for (const runtime of [
        { displayMode: 'fullscreen', userAgent: 'Android' },
        { displayMode: 'standalone', userAgent: 'Android' },
        { iosStandalone: true, userAgent: 'iPhone' },
        { displayMode: 'fullscreen', userAgent: 'iPhone' },
        { androidApp: true, userAgent: 'Android' }
    ]) {
        for (const storageError of [false, true]) {
            const installed = createPage('{"startupEnabled":true}', { ...runtime, storageError });
            assert.equal(installed.classList.contains('bynd-startup-disabled'), true, 'system launch screens must not be followed by a web intro');
            assert.equal(installed.timers.size, 0, 'installed runtimes must never schedule the second loading screen');
            installed.advance(10000);
            assert.equal(installed.classList.contains('bynd-startup-loading'), false);
            if (runtime.userAgent === 'iPhone') assert.equal(installed.classList.contains('bynd-ios-pwa'), true, 'safe-area detection must survive unavailable storage');
            if (!storageError) installed.loadRuntime();
            installed.window.__byndStartup.markReady();
            assert.equal(installed.layer.hidden, true);
        }
    }

    const mobileBrowser = createPage('{}', { userAgent: 'Android', displayMode: 'browser' });
    mobileBrowser.advance(300);
    assert.equal(mobileBrowser.classList.contains('bynd-startup-loading'), true, 'ordinary mobile tabs still need their loading indicator');

    const fast = createPage();
    fast.advance(100);
    fast.loadRuntime().markReady();
    fast.advance(10000);
    assert.equal(fast.classList.contains('bynd-startup-loading'), false, 'fast loads must skip the logo entirely');
    assert.equal(fast.timers.size, 0);

    const disabled = createPage('{"startupEnabled":false}');
    assert.equal(disabled.classList.contains('bynd-startup-disabled'), true);
    assert.equal(disabled.timers.size, 0, 'disabled loading must not schedule a timer');
    disabled.advance(10000);
    disabled.loadRuntime().markReady();
    assert.equal(disabled.classList.contains('bynd-startup-loading'), false);
    assert.equal(disabled.layer.hidden, true);

    const legacy = createPage('{}', { runHead: false });
    legacy.loadRuntime().markReady();
    assert.equal(legacy.layer.hidden, true, 'an older cached HTML shell must still dismiss its overlay');

    const core = createPage();
    core.loadRuntime();
    for (const name of [
        'initClock', 'initBattery', 'initDate', 'initLockScreen', 'initCalendar',
        'initByndFullscreenRuntime', 'initIconGrid', 'initTheme', 'initLockscreenWeatherRuntime',
        'initOutingAppRuntime', 'initDesktopStatusWidgetRuntime', 'initProactiveNotify', 'syncMonitorPetFloating'
    ]) core.context[name] = () => {};
    let resolveCharacters;
    core.context.loadCharactersFromStorage = () => new Promise(resolve => { resolveCharacters = resolve; });
    core.document.fonts = { get ready() { assert.fail('optional fonts must not hold the loading screen'); } };
    core.listeners.get('DOMContentLoaded')[0]();
    await Promise.resolve();
    await Promise.resolve();
    core.advance(300);
    assert.equal(core.classList.contains('bynd-startup-loading'), true, 'character hydration must complete before leaving loading');
    resolveCharacters();
    await core.window.__byndCoreReady;
    assert.equal(core.layer.hidden, true);

    const failed = createPage();
    failed.loadRuntime();
    failed.context.initializeByndApp = () => { throw new Error('initialization failed'); };
    failed.advance(300);
    failed.listeners.get('DOMContentLoaded')[0]();
    await assert.rejects(failed.window.__byndCoreReady, /initialization failed/);
    assert.equal(failed.layer.hidden, true, 'initialization errors must not leave a permanent loading overlay');
    assert.equal(failed.errors.length, 1);

    console.log('startup feature tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
