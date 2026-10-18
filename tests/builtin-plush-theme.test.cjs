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
    const alerts = [];
    let failKey = '', assetFailure = false;
    const c = vm.createContext({
        window: { _folders: [], location: { href: '', pathname: '/index.html' } },
        document: { addEventListener() {}, querySelector: () => ({ clientWidth: 375 }), querySelectorAll: () => [] },
        localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => { if (key === failKey) { failKey = ''; throw new Error('storage full'); } store.set(key,value); }, removeItem: key => store.delete(key) },
        setTimeout, clearTimeout, Date, console, Set, Map,
        alert:message => alerts.push(message),
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
    return { c, store, status, alerts, failOn: key => { failKey = key; }, failAssets: () => { assetFailure = true; } };
}
test('the built-in preset covers every customization slot and all assets ship locally', () => {
    const { c } = setup();
    const item = c.getBuiltinThemeLibraryItem('builtin-cream-plush');
    assert.equal(item.name, '银粉蕾丝');
    assert.equal(c.window.BYND_BUILTIN_THEMES.length, 1);
    const data = item.themeData;
    assert.equal(data.icons.length, 26);
    for (const path of [data.wpHome, data.wpLock, data.l1, data.l2, data.d1, data.d2, ...data.icons]) assert.ok(fs.existsSync(path), path);
    const layout = c.buildPlushDesktopLayout();
    const ids = new Set([...layout.items.filter(item => item.type === 'app').map(item => item.id.slice(4)), ...layout.dock]);
    assert.deepEqual([...ids].sort(), appIds.filter(id=>id!=='events').sort());
    assert.equal(layout.items.filter(item => item.kind === 'plush').length, 4);
    assert.equal(layout.items.find(item => item.id === 'custom-plush-note').page, 1);
    assertNoOverlap(layout);
});
test('existing folders stay available and their apps are not duplicated in the preset or Dock', () => {
    const { c } = setup();
    c.window._folders = [{id:'books', apps:[{id:'worldbook'}, {id:'wechat'}]}];
    const layout = c.buildPlushDesktopLayout();
    assert.ok(layout.items.some(item => item.id === 'folder-books'));
    assert.ok(!layout.items.some(item => ['app-worldbook','app-wechat'].includes(item.id)));
    assert.ok(!layout.dock.includes('worldbook'));
});
test('large folders share the second page with apps when space is available', () => {
    const { c } = setup();
    c.window._folders = [{id:'books', size:'large', height:168, apps:[{id:'worldbook'}, {id:'mcp'}, {id:'role-tools'}, {id:'manual'}]}];
    const layout = c.buildPlushDesktopLayout();
    const folder = layout.items.find(item => item.id === 'folder-books');
    assert.ok(folder.width >= 142); assert.equal(folder.height,168);
    assert.equal(folder.page, 1);
    assert.equal(layout.pageCount, 2);
    assertNoOverlap(layout);
});

function assertNoOverlap(layout) {
    for (const a of layout.items) for (const b of layout.items) {
        if (a === b || a.page !== b.page) continue;
        assert.ok(a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + a.height <= b.top || b.top + b.height <= a.top, `${a.id} overlaps ${b.id}`);
        assert.ok(a.left >= 0 && a.left + a.width <= a.canvasWidth, a.id + ' horizontal bounds');
    }
    assert.equal(layout.pageCount, Math.max(...layout.items.map(item => item.page)) + 1);
}

test('small folders use free space on the second page instead of creating a third page', () => {
    const { c } = setup();
    c.window._folders = [{id:'tools', apps:[{id:'mcp'}, {id:'role-tools'}, {id:'settings'}, {id:'manual'}]}];
    const layout = c.buildPlushDesktopLayout();
    assert.equal(layout.items.find(item => item.id === 'folder-tools').page, 1);
    assert.equal(layout.pageCount, 2);
    assertNoOverlap(layout);
});

test('mixed folder sizes only add another page after the existing grid is full', () => {
    const { c } = setup();
    c.window._folders = Array.from({length:9}, (_, i) => ({id:'group-' + i, size:i % 2 ? 'small' : 'large', height:190, apps:[]}));
    const layout = c.buildPlushDesktopLayout();
    assert.ok(layout.pageCount > 2);
    assertNoOverlap(layout);
    assert.equal(layout.items.filter(item => item.id.startsWith('folder-')).length, 9);
    const ids = new Set([...layout.items.filter(item => item.id.startsWith('app-')).map(item => item.id.slice(4)), ...layout.dock]);
    assert.deepEqual([...ids].sort(), appIds.filter(id=>id!=='events').sort());
});
test('successful apply writes the complete theme and layout before reloading', async () => {
    const { c, store } = setup();
    const photos = {left:{src:'data:image/webp;base64,YWJj',shape:'circle'}};
    store.set('my_theme_data', JSON.stringify({ phoneStatusBarEnabled:false, plushSince:'2026-01-01',plushPhotos:photos }));
    await c.applyThemeLibraryItem('builtin-cream-plush');
    const data = JSON.parse(store.get('my_theme_data'));
    assert.equal(data.builtinTheme, 'cream-plush');
    assert.equal(data.phoneStatusBarEnabled, false);
    assert.equal(data.plushSince, '2026-01-01');
    assert.deepEqual(data.plushPhotos,photos);
    assert.equal(JSON.parse(store.get('desktop_layout_v2')).items.filter(item => item.kind === 'plush').length, 4);
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

test('the daily note preserves custom text but clears checks on the next local date', () => {
    const {c,store} = setup();
    store.set('bynd_ribbon_note_v1', JSON.stringify({date:'2026-10-17',items:[{text:'读书',done:true}]}));
    assert.equal(c.getRibbonNoteState(new Date(2026,9,17)).items[0].done,true);
    const next = c.getRibbonNoteState(new Date(2026,9,18));
    assert.equal(next.items[0].text,'读书'); assert.equal(next.items[0].done,false);
    assert.equal(next.items.length,3);
});

test('the built-in default hides the heartmail entry and keeps row clearance for folders', () => {
    const {c} = setup();
    c.window._folders = [{id:'tools',apps:['mcp','role-tools','settings','manual'].map(id => ({id}))}];
    const layout = c.buildPlushDesktopLayout();
    assert.ok(!layout.items.some(item => item.id==='app-events'));
    assert.ok(!layout.dock.includes('events'));
    const folder = layout.items.find(item => item.id==='folder-tools');
    const below = layout.items.find(item => item.page===folder.page && item.left===folder.left && item.top>folder.top);
    assert.ok(below.top >= folder.top+folder.height+8,'folders need the same 8px row clearance as desktop repair');
});

test('failed note writes retain durable state and report the error', () => {
    const {c,store,alerts,failOn} = setup();
    const old = JSON.stringify(c.getRibbonNoteState()); store.set('bynd_ribbon_note_v1',old);
    failOn('bynd_ribbon_note_v1');
    assert.equal(c.toggleRibbonNote(0),false);
    assert.equal(store.get('bynd_ribbon_note_v1'),old);
    assert.match(alerts.at(-1),/小笺保存失败/);
    c.prompt = () => '不要保存这行'; failOn('bynd_ribbon_note_v1');
    assert.equal(c.editRibbonNote(1),false);
    assert.equal(store.get('bynd_ribbon_note_v1'),old);
});

test('photo configuration keeps independent shapes and rejects unsafe image sources', () => {
    const {c} = setup();
    const data = {plushPhotos:{left:{src:'data:image/jpeg;base64,YWJj',shape:'circle'},right:{src:'javascript:alert(1)',shape:'bad'}}};
    assert.equal(c.getRibbonPhoto('left',data).shape,'circle');
    assert.equal(c.getRibbonPhoto('right',data).shape,'square');
    assert.equal(c.getRibbonPhoto('right',data).src,'assets/themes/cream-plush/toy-16.webp');
    assert.equal(c.getRibbonPhoto('unknown',data),null);
});

test('invalid or oversized photo files fail before starting image decoding', async () => {
    const {c} = setup();
    await assert.rejects(c.readRibbonPhotoFile({type:'text/plain',size:10}),/请选择图片/);
    await assert.rejects(c.readRibbonPhotoFile({type:'image/png',size:21*1024*1024}),/20MB/);
});
