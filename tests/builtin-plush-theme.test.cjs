const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const preset = fs.readFileSync('ui/theme/builtin-plush.js', 'utf8');
const theme = fs.readFileSync('ui/theme/theme.js', 'utf8');
const appIds = ['wechat','regex','worldbook','settings','role-tools','moon','theme','study','money','game','dream','monitor','pet','outing','coread','living-world','album','events','home3d','comic','manual','mcp','music','camera','preset','bill'];
function setup() {
    const store = new Map();
    const status = [];
    let failKey = '', assetFailure = false;
    const c = vm.createContext({
        window: { _folders: [], location: { href: '', pathname: '/index.html' } },
        document: { addEventListener() {}, querySelector: () => ({ clientWidth: 375 }), querySelectorAll: () => [] },
        localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => { if (key === failKey) { failKey = ''; throw new Error('storage full'); } store.set(key,value); }, removeItem: key => store.delete(key) },
        setTimeout, clearTimeout, Date, console, Set, Map,
        themeLibrarySaving: false,
        getSavedThemeData: () => JSON.parse(store.get('my_theme_data') || '{}'),
        getThemeLibraryStore: async () => [],
        setThemeLibraryStatus: (message, type) => status.push({message, type}),
        getDesktopAllAppDefinitions: () => appIds.map(id => ({id})),
        getDesktopFolderAppIds: () => new Set(c.window._folders.flatMap(folder => folder.apps.map(app => app.id))),
        Image: class { set src(value) { queueMicrotask(() => assetFailure ? this.onerror() : this.onload()); } }
    });
    vm.runInContext(preset, c);
    vm.runInContext(theme.slice(theme.indexOf('let themeLibraryApplying'), theme.indexOf('async function overwriteThemeLibraryItem')), c);
    return { c, store, status, failOn: key => { failKey = key; }, failAssets: () => { assetFailure = true; } };
}
test('the built-in preset covers every customization slot and all assets ship locally', () => {
    const { c } = setup();
    const data = c.getBuiltinThemeLibraryItem('builtin-cream-plush').themeData;
    assert.equal(data.icons.length, 26);
    for (const path of [data.wpHome, data.wpLock, ...data.icons]) assert.ok(fs.existsSync(path), path);
    const layout = c.buildPlushDesktopLayout();
    const ids = new Set([...layout.items.filter(item => item.type === 'app').map(item => item.id.slice(4)), ...layout.dock]);
    assert.deepEqual([...ids].sort(), appIds.sort());
    assert.equal(layout.items.filter(item => item.kind === 'plush').length, 3);
});
test('existing folders stay available and their apps are not duplicated in the preset or Dock', () => {
    const { c } = setup();
    c.window._folders = [{id:'books', apps:[{id:'worldbook'}, {id:'wechat'}]}];
    const layout = c.buildPlushDesktopLayout();
    assert.ok(layout.items.some(item => item.id === 'folder-books'));
    assert.ok(!layout.items.some(item => ['app-worldbook','app-wechat'].includes(item.id)));
    assert.ok(!layout.dock.includes('worldbook'));
});
test('large folders receive enough room for their previews on a separate page', () => {
    const { c } = setup();
    c.window._folders = [{id:'books', size:'large', height:168, apps:[{id:'worldbook'}]}];
    const layout = c.buildPlushDesktopLayout();
    const folder = layout.items.find(item => item.id === 'folder-books');
    assert.ok(folder.width >= 142); assert.equal(folder.height,168);
    assert.ok(folder.page > Math.max(...layout.items.filter(item => item.id.startsWith('app-')).map(item => item.page)));
});
test('successful apply writes the complete theme and layout before reloading', async () => {
    const { c, store } = setup();
    store.set('my_theme_data', JSON.stringify({ phoneStatusBarEnabled:false, plushSince:'2026-01-01' }));
    await c.applyThemeLibraryItem('builtin-cream-plush');
    const data = JSON.parse(store.get('my_theme_data'));
    assert.equal(data.builtinTheme, 'cream-plush');
    assert.equal(data.phoneStatusBarEnabled, false);
    assert.equal(data.plushSince, '2026-01-01');
    assert.equal(JSON.parse(store.get('desktop_layout_v2')).items.filter(item => item.kind === 'plush').length, 3);
    assert.match(c.window.location.href, /theme-/);
});
test('failure on the second write restores both original values and does not reload', async () => {
    const { c, store, status, failOn } = setup();
    const old = JSON.stringify({wpHome:'previous'}), layout = JSON.stringify({items:[{id:'previous'}]});
    store.set('my_theme_data',old); store.set('desktop_layout_v2',layout);
    failOn('desktop_layout_v2');
    await c.applyThemeLibraryItem('builtin-cream-plush');
    assert.equal(store.get('my_theme_data'),old); assert.equal(store.get('desktop_layout_v2'),layout);
    assert.equal(c.window.location.href,''); assert.equal(status.at(-1).type,'error');
});
test('failed image loading never starts storage writes or reloads', async () => {
    const { c, store, status, failAssets } = setup();
    const old = JSON.stringify({wpHome:'previous'}); store.set('my_theme_data',old); failAssets();
    await c.applyThemeLibraryItem('builtin-cream-plush');
    assert.equal(store.get('my_theme_data'),old); assert.equal(store.has('desktop_layout_v2'),false);
    assert.equal(c.window.location.href,''); assert.equal(status.at(-1).type,'error');
});
