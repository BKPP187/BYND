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

function createPage(savedTheme = '{}', { storageError = false, displayMode = 'browser', iosStandalone = false, androidApp = false, userAgent = 'Mozilla/5.0', stylesheets = [], legacy = false } = {}) {
    const timers = [];
    const storageWrites = [];
    const listeners = new Map();
    const errors = [];
    const classList = makeClassList();
    const layer = legacy ? { removed: false, remove() { this.removed = true; } } : null;
    const document = {
        readyState: 'loading',
        documentElement: { classList },
        head: { appendChild() {} },
        createElement: () => ({}),
        getElementById: id => id === 'bynd-startup' && !layer?.removed ? layer : null,
        addEventListener: (name, handler) => {
            const handlers = listeners.get(name) || [];
            handlers.push(handler);
            listeners.set(name, handlers);
        },
        querySelectorAll: selector => selector === 'link[data-bynd-core-style]' ? stylesheets : []
    };
    const window = {
        navigator: { standalone: iosStandalone },
        ByndAndroid: androidApp ? {} : undefined,
        location: { search: '?bynd-intro=first' },
        matchMedia: query => ({ matches: query === `(display-mode: ${displayMode})` }),
        setTimeout: (...args) => timers.push(args)
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
        URLSearchParams,
        Promise,
        setTimeout: window.setTimeout
    });
    vm.runInContext(headScript, context);
    return {
        window, document, layer, classList, context, timers, listeners, storageWrites, errors,
        loadRuntime() { vm.runInContext(script, context); }
    };
}

async function main() {
    for (const data of ['{}', '{"startupEnabled":true}', '{"startupEnabled":false}', '{', null]) {
        const page = createPage(data);
        assert.equal(page.window.__byndStartup, undefined, 'HTML must not create a web splash controller');
        assert.equal(page.classList.contains('bynd-startup-loading'), false);
        assert.equal(page.classList.contains('bynd-styles-pending'), false, 'current HTML must not hide the home screen during loading');
        assert.equal(page.timers.length, 0);
        page.loadRuntime();
        assert.equal(page.document.getElementById('bynd-startup'), null);
        assert.equal(page.window.__byndStartup, undefined, 'stored preferences must not recreate the retired splash');
        assert.equal(page.storageWrites.some(([key]) => ['my_theme_data', 'bynd_startup_seen_v1'].includes(key)), false, 'splash removal must not rewrite theme data or playback markers');
    }

    const unavailable = createPage(null, { storageError: true });
    assert.equal(unavailable.classList.contains('bynd-startup-loading'), false);
    assert.equal(unavailable.timers.length, 0);

    for (const runtime of [
        { displayMode: 'fullscreen', userAgent: 'Android' },
        { displayMode: 'standalone', userAgent: 'Android' },
        { iosStandalone: true, userAgent: 'iPhone' },
        { displayMode: 'fullscreen', userAgent: 'iPhone' },
        { androidApp: true, userAgent: 'Android' }
    ]) {
        for (const storageError of [false, true]) {
            const installed = createPage('{"startupEnabled":true}', { ...runtime, storageError });
            assert.equal(installed.classList.contains('mobile-runtime'), true);
            assert.equal(installed.classList.contains('bynd-startup-loading'), false);
            assert.equal(installed.window.__byndStartup, undefined);
            assert.equal(installed.timers.length, 0);
            if (runtime.androidApp) assert.equal(installed.classList.contains('bynd-android-app'), true);
            if (runtime.userAgent === 'iPhone') {
                assert.equal(installed.classList.contains('bynd-ios-pwa'), true, 'safe-area detection must survive unavailable storage');
                if (!storageError) assert.equal(installed.classList.contains('bynd-statusbar-hidden'), true);
            }
        }
    }

    const mobileBrowser = createPage('{}', { userAgent: 'iPhone' });
    assert.equal(mobileBrowser.classList.contains('mobile-runtime'), true);
    assert.equal(mobileBrowser.classList.contains('bynd-ios'), true);
    assert.equal(mobileBrowser.classList.contains('bynd-ios-pwa'), false);
    assert.equal(mobileBrowser.classList.contains('bynd-statusbar-hidden'), false);
    const explicitStatusBar = createPage('{"phoneStatusBarEnabled":true}', { userAgent: 'iPhone', iosStandalone: true });
    assert.equal(explicitStatusBar.classList.contains('bynd-statusbar-hidden'), false);
    const hiddenStatusBar = createPage('{"phoneStatusBarEnabled":false}');
    assert.equal(hiddenStatusBar.classList.contains('bynd-statusbar-hidden'), true);

    for (const hasController of [false, true]) {
        const legacy = createPage('{}', { legacy: true });
        legacy.classList.add('bynd-startup-loading', 'bynd-startup-disabled');
        let readyCalls = 0;
        if (hasController) legacy.window.__byndStartup = { markReady() { readyCalls += 1; } };
        legacy.loadRuntime();
        assert.equal(legacy.layer.removed, true, 'an older cached HTML shell must lose its retired overlay immediately');
        assert.equal(legacy.classList.contains('bynd-startup-loading'), false);
        assert.equal(legacy.classList.contains('bynd-startup-disabled'), false);
        assert.equal(readyCalls, hasController ? 1 : 0);
    }

    const core = createPage();
    core.loadRuntime();
    for (const name of [
        'initClock', 'initBattery', 'initDate', 'initLockScreen', 'initCalendar',
        'initByndFullscreenRuntime', 'initIconGrid', 'initTheme', 'initLockscreenWeatherRuntime',
        'initOutingAppRuntime', 'initDesktopStatusWidgetRuntime', 'initProactiveNotify', 'syncMonitorPetFloating'
    ]) core.context[name] = () => {};
    let resolveCharacters;
    let notifyCharacterRequest;
    const charactersRequested = new Promise(resolve => { notifyCharacterRequest = resolve; });
    core.context.loadCharactersFromStorage = () => {
        notifyCharacterRequest();
        return new Promise(resolve => { resolveCharacters = resolve; });
    };
    core.document.fonts = { get ready() { assert.fail('optional fonts must not block core initialization'); } };
    core.listeners.get('DOMContentLoaded')[0]();
    let coreReady = false;
    core.window.__byndCoreReady.then(() => { coreReady = true; });
    await charactersRequested;
    assert.equal(coreReady, false, 'core readiness must still include character hydration');
    resolveCharacters();
    await core.window.__byndCoreReady;
    assert.equal(coreReady, true);

    const failed = createPage();
    failed.loadRuntime();
    failed.context.initializeByndApp = () => { throw new Error('initialization failed'); };
    failed.listeners.get('DOMContentLoaded')[0]();
    await assert.rejects(failed.window.__byndCoreReady, /initialization failed/);
    assert.equal(failed.errors.length, 1, 'initialization failures must still be reported');

    function stylesheet(media = 'print') {
        const handlers = new Map();
        return {
            media,
            addEventListener: (name, handler) => handlers.set(name, handler),
            finish(event) {
                this.media = 'all';
                handlers.get(event)?.();
            }
        };
    }
    for (const event of ['load', 'error']) {
        const mainStyle = stylesheet();
        const themeStyle = stylesheet();
        const styled = createPage('{}', { stylesheets: [mainStyle, themeStyle], legacy: true });
        styled.classList.add('bynd-styles-pending');
        styled.loadRuntime();
        let initializations = 0;
        styled.context.initializeByndApp = () => { initializations += 1; };
        styled.listeners.get('DOMContentLoaded')[0]();
        assert.equal(styled.layer.removed, true, 'legacy splash removal must not wait for CSS');
        assert.equal(initializations, 0, 'legacy asynchronous stylesheets must still settle before layout initialization');
        mainStyle.finish('load');
        await Promise.resolve();
        assert.equal(initializations, 0);
        themeStyle.finish(event);
        await styled.window.__byndCoreReady;
        assert.equal(initializations, 1);
        assert.equal(styled.classList.contains('bynd-styles-pending'), false, 'cached HTML must not leave the home screen hidden after load or error');
    }
    const cachedStyles = createPage('{}', { stylesheets: [stylesheet('all')] });
    cachedStyles.loadRuntime();
    let initializations = 0;
    cachedStyles.context.initializeByndApp = () => { initializations += 1; };
    cachedStyles.listeners.get('DOMContentLoaded')[0]();
    await cachedStyles.window.__byndCoreReady;
    assert.equal(initializations, 1, 'ordinary blocking stylesheets must not stall initialization');

    console.log('startup feature tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
