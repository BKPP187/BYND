const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

const theme = fs.readFileSync('theme.js', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');
const prefix = theme.slice(0, theme.indexOf('function migrateThemeIconData'));
const iconFunctions = script.slice(script.indexOf('function getDesktopThemeData('), script.indexOf('function renderDesktopAppIcon('));
const plain = value => JSON.parse(JSON.stringify(value));

function setup() {
    const elements = new Map();
    const store = new Map();
    const events = [];
    let fail = false;
    const noop = () => {};
    const context = vm.createContext({
        document: {
            getElementById: id => {
                if (!elements.has(id)) elements.set(id, { value: '', style: {}, innerHTML: '' });
                return elements.get(id);
            },
            querySelector: () => null,
            querySelectorAll: () => []
        },
        localStorage: {
            getItem: key => store.get(key) || null,
            setItem: (key, value) => {
                if (fail) throw new Error('QA storage full');
                store.set(key, value);
            },
            removeItem: key => store.delete(key)
        },
        getThemeCheckbox: () => false,
        getPhoneStatusBarEnabledFromInput: () => false,
        normalizeLockDecoIcon: value => value,
        getSavedLockClockColorMode: () => 'auto',
        normalizeThemeAccent: (value, fallback) => value || fallback,
        normalizeThemeWidgetStyle: value => value,
        normalizeLsShortcutAction: value => value,
        getCalTransparencyValue: () => 0,
        collectTapEffectDataFromInputs: () => ({}),
        checkImageBrightness: noop, applyLockscreenAdaptiveTheme: noop,
        applyByndAdaptiveTheme: noop, applyPhoneStatusBarEnabled: noop,
        setLockMusicText: noop, applyLockscreenOptions: noop, renderWidget: noop,
        refreshDesktopThemedIcons: data => events.push({ type: 'refresh', icons: data.icons }),
        applyGlobalTapEffectSettings: noop, applyLsShortcuts: noop,
        alert: text => events.push({ type: 'alert', text }),
        closeApp: app => events.push({ type: 'close', app })
    });
    vm.runInContext(prefix + '\n' + iconFunctions, context);
    vm.runInContext(theme.slice(theme.indexOf('function saveTheme()'), theme.indexOf('// 5. 初始化')), context);
    return { context, elements, store, events, failSaving: () => { fail = true; } };
}

test('all desktop and dock apps have matching customization slots, including MCP and pet', () => {
    const { context: c, elements } = setup();
    const desktop = script.slice(script.indexOf('const DESKTOP_APPS = ['), script.indexOf('normalizeDesktopFolders();', script.indexOf('const DESKTOP_APPS = [')));
    const dockStart = script.indexOf('const DESKTOP_DOCK_APP_DEFINITIONS = [');
    assert.ok(dockStart > 0);
    const dock = script.slice(dockStart, script.indexOf('];', dockStart) + 2);
    vm.runInContext(desktop + '\n' + dock, c);
    const apps = vm.runInContext('[...DESKTOP_APPS, ...DESKTOP_DOCK_APP_DEFINITIONS]', c);
    const targets = vm.runInContext('THEME_ICON_TARGETS', c);
    const icons = targets.map((target, index) => 'https://example.test/icon-' + index + '.png');
    for (const app of apps) {
        const index = targets.findIndex(target => target.n === app.name);
        assert.ok(index >= 0, 'missing theme entry for ' + app.name);
        assert.equal(c.getDesktopThemeIconUrl(app.id, { icons }), icons[index], app.id);
    }
    assert.equal(targets[17].n, 'MCP', 'keep the existing MCP mapping');
    assert.equal(targets[18].n, '桌宠');
    c.initIconGrid();
    assert.match(elements.get('icon-grid-container').innerHTML, /file-icon-17/);
    assert.match(elements.get('icon-grid-container').innerHTML, /file-icon-18/);
});

test('historical icon arrays keep original app and dock images after adding new slots', () => {
    const { context: c } = setup();
    for (const length of [11, 12, 13, 14, 16, 17, 18, 19]) {
        const icons = Array.from({ length }, (_, index) => 'old-' + index);
        const actual = plain(c.normalizeThemeIconList(icons));
        assert.equal(actual.length, 19);
        const desktopCount = ({ 11: 8, 12: 8, 13: 10, 14: 11 })[length] || length;
        assert.deepEqual(actual.slice(0, desktopCount), icons.slice(0, desktopCount));
        const dockIndices = ({ 11: [8, 9, 10], 12: [8, 10, 11], 13: [10, 11, 12], 14: [11, 12, 13] })[length] || [13, 14, 15];
        assert.deepEqual(actual.slice(13, 16), dockIndices.map(index => icons[index]));
        if (length < 18) assert.equal(actual[17], '');
        if (length < 19) assert.equal(actual[18], '');
    }
});

test('saving replacement icons persists and refreshes both new apps', () => {
    const { context: c, elements, store, events } = setup();
    c.document.getElementById('input-icon-17').value = 'data:image/png;base64,MCP';
    c.document.getElementById('input-icon-18').value = 'data:image/png;base64,PET';
    c.saveTheme();
    const saved = JSON.parse(store.get('my_theme_data'));
    assert.equal(c.getDesktopThemeIconUrl('mcp', saved), elements.get('input-icon-17').value);
    assert.equal(c.getDesktopThemeIconUrl('pet', saved), elements.get('input-icon-18').value);
    assert.equal(events.filter(event => event.type === 'refresh').length, 1);
    assert.ok(events.some(event => event.type === 'alert' && event.text.includes('保存成功')));
    assert.ok(events.some(event => event.type === 'close'));
});

test('a failed icon save preserves the previous theme and never refreshes or claims success', () => {
    const { context: c, store, events, failSaving } = setup();
    const previous = JSON.stringify({ icons: ['old-icon'], wpHome: 'old-wallpaper' });
    store.set('my_theme_data', previous);
    c.document.getElementById('input-icon-18').value = 'data:image/png;base64,PET';
    failSaving();
    c.saveTheme();
    assert.equal(store.get('my_theme_data'), previous);
    assert.ok(events.some(event => event.type === 'alert' && event.text.includes('错误')));
    assert.ok(!events.some(event => event.type === 'refresh' || event.type === 'close'));
    assert.ok(!events.some(event => event.text?.includes('保存成功')));
});
