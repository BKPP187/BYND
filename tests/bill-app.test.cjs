const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { sourceSection, memoryStorage } = require('./helpers/harness.cjs');

const plain = value => JSON.parse(JSON.stringify(value));

function loadBillApp() {
    const window = {};
    const context = vm.createContext({ window, console, setTimeout, clearTimeout, requestAnimationFrame: fn => fn(), document: { getElementById: () => null } });
    vm.runInContext(fs.readFileSync('modules/usage/bill-app.js', 'utf8'), context);
    return window.ByndBillApp._internal;
}

// Tiny in-memory stand-in for window.ByndUsageLedger (modules/usage/ledger.js).
function fakeLedger(entries, prices = {}) {
    const FEATURES = [
        { key: 'chat', label: '聊天' }, { key: 'forum', label: '论坛 Agent' }, { key: 'world', label: '世界轨迹' },
        { key: 'comic', label: '漫画导演' }, { key: 'other', label: '其他' }
    ];
    const sorted = entries.slice().sort((a, b) => a.at - b.at);
    const calls = [];
    return {
        FEATURES,
        calls,
        async list(query = {}) {
            calls.push(query);
            return sorted.filter(entry => (query.from == null || entry.at >= query.from)
                && (query.to == null || entry.at < query.to)
                && (!query.provider || entry.provider === query.provider)
                && (!query.model || entry.model === query.model)
                && (!query.feature || entry.feature === query.feature)
                && (!query.charId || entry.charId === query.charId));
        },
        async facets() {
            return {
                providers: [...new Set(sorted.map(e => e.provider))],
                models: [...new Set(sorted.map(e => e.model))],
                features: [...new Set(sorted.map(e => e.feature))],
                chars: [{ id: 'c1', name: '温今北' }]
            };
        },
        subscribe() { return () => {}; },
        getPrices() { return prices; },
        setPrice(model, price) { prices[model] = price; },
        costOf(entry) {
            const p = prices[entry.model];
            if (!p) return null;
            return ((entry.input - (entry.cacheRead || 0)) * (p.input || 0) + entry.output * (p.output || 0) + (entry.cacheRead || 0) * (p.cacheRead || 0)) / 1e6;
        }
    };
}

const at = (...parts) => new Date(...parts).getTime();
const entry = (time, extra = {}) => ({ at: time, feature: 'chat', provider: 'openai', model: 'gpt', input: 1000, output: 200, cacheRead: 0, cacheWrite: 0, estimated: false, ok: true, ...extra });

test('bucket math covers every granularity and auto-switches to seconds for a minute', () => {
    const b = loadBillApp();
    const years = b.buildRange([], { startYear: 2024, endYear: 2026 });
    assert.equal(years.unit, 'year');
    assert.deepEqual(plain(years.buckets.map(x => x.part)), [2024, 2025, 2026]);
    assert.equal(b.buildRange([2026]).buckets.length, 12);
    assert.equal(b.buildRange([2026]).unit, 'month');
    assert.equal(b.buildRange([2026, 8]).buckets.length, 30, 'September has 30 days');
    assert.equal(b.buildRange([2024, 1]).buckets.length, 29, 'leap February');
    assert.equal(b.buildRange([2026, 8, 24]).buckets.length, 24);
    const hour = b.buildRange([2026, 8, 24, 10]);
    assert.equal(hour.unit, 'minute');
    assert.equal(hour.buckets.length, 60);
    const minute = b.buildRange([2026, 8, 24, 10, 37]);
    assert.equal(minute.unit, 'second', 'a one-minute range charts seconds automatically');
    assert.equal(minute.buckets.length, 60);
    assert.equal(minute.from, at(2026, 8, 24, 10, 37, 0));
    assert.equal(minute.to, at(2026, 8, 24, 10, 38, 0));
    const leaf = b.buildRange([2026, 8, 24, 10, 37, 26]);
    assert.equal(leaf.unit, null);
    assert.equal(leaf.buckets.length, 0);
    assert.equal(leaf.to - leaf.from, 1000);

    const t = at(2026, 8, 24, 10, 37, 26);
    assert.equal(b.bucketIndexFor(t, years), 2);
    assert.equal(b.bucketIndexFor(t, b.buildRange([2026])), 8);
    assert.equal(b.bucketIndexFor(t, b.buildRange([2026, 8])), 23);
    assert.equal(b.bucketIndexFor(t, b.buildRange([2026, 8, 24])), 10);
    assert.equal(b.bucketIndexFor(t, hour), 37);
    assert.equal(b.bucketIndexFor(t, minute), 26);
    const day = b.buildRange([2026, 8, 24]);
    assert.equal(day.buckets[10].from, at(2026, 8, 24, 10));
    assert.equal(day.buckets[10].to, at(2026, 8, 24, 11));
});

test('breadcrumb drills down to one second and back up', () => {
    const b = loadBillApp();
    let path = [];
    const years = b.buildRange([], { startYear: 2024, endYear: 2026 });
    path = b.drillPath(path, years, 2);
    path = b.drillPath(path, b.buildRange(path), 8);
    path = b.drillPath(path, b.buildRange(path), 23);
    path = b.drillPath(path, b.buildRange(path), 10);
    path = b.drillPath(path, b.buildRange(path), 37);
    path = b.drillPath(path, b.buildRange(path), 26);
    assert.deepEqual(plain(path), [2026, 8, 24, 10, 37, 26]);
    assert.deepEqual(plain(b.drillPath(path, b.buildRange(path), 0)), plain(path), 'the second level is the leaf');
    assert.deepEqual(plain(b.crumbsFor(path).map(c => c.label)), ['全部年份', '2026 年', '9 月', '24 日', '10:00', '10:37', '10:37:26']);
    assert.deepEqual(plain(b.crumbPath(path, 3)), [2026, 8, 24]);
    assert.deepEqual(plain(b.crumbPath(path, 0)), []);

    // Granularity switch keeps the prefix and fills from the selected bucket.
    const month = b.buildRange([2026, 8]);
    assert.deepEqual(plain(b.unitPath([2026, 8], 'hour', { range: month, selected: 4, now: at(2030, 0, 1) })), [2026, 8, 5]);
    assert.deepEqual(plain(b.unitPath([2026, 8, 24, 10], 'month', {})), [2026]);
    assert.deepEqual(plain(b.unitPath([2026], 'year', {})), []);
    const inView = b.unitPath([2026], 'second', { range: b.buildRange([2026]), now: at(2026, 8, 24, 10, 37, 26) });
    assert.deepEqual(plain(inView), [2026, 8, 24, 10, 37]);
    const lastWithData = b.unitPath([2025], 'day', { range: b.buildRange([2025]), buckets: [{ from: at(2025, 2, 1), requests: 3 }, { from: at(2025, 6, 1), requests: 1 }, { from: at(2025, 7, 1), requests: 0 }], now: at(2026, 0, 1) });
    assert.deepEqual(plain(lastWithData), [2025, 6]);
});

test('summary totals, cache hit rate, estimated marker and partial cost', async () => {
    const b = loadBillApp();
    const ledger = fakeLedger([
        entry(at(2026, 8, 24, 10, 37, 26), { input: 100000, output: 5000, cacheRead: 96800, cacheWrite: 300, model: 'claude', provider: 'anthropic' }),
        entry(at(2026, 8, 24, 10, 37, 31), { input: 20000, output: 2000, cacheRead: 0, model: 'gemini', provider: 'google', estimated: true, feature: 'forum' }),
        entry(at(2026, 8, 24, 11, 0, 0), { input: 1, output: 1 })
    ], { claude: { input: 3, output: 15, cacheRead: 0.3 } });
    const view = { path: [2026, 8, 24, 10], metric: 'total', filters: {}, selected: null };
    const model = await b.buildViewModel(ledger, view, at(2026, 8, 24, 12));
    const s = model.summary;
    assert.equal(s.requests, 2, 'only the visible hour is aggregated');
    assert.equal(s.total, 127000);
    assert.equal(s.input, 120000);
    assert.equal(s.output, 7000);
    assert.equal(s.cacheRead, 96800);
    assert.equal(s.cacheWrite, 300);
    assert.ok(Math.abs(s.cacheHitRate - 96800 / 120000) < 1e-9);
    assert.equal(s.estimated, true);
    assert.equal(s.costState, 'partial');
    assert.deepEqual(plain(s.unpricedModels), ['gemini']);
    assert.ok(Math.abs(s.cost - ((3200 * 3 + 5000 * 15 + 96800 * 0.3) / 1e6)) < 1e-12);
    assert.equal(ledger.calls.at(-1).from, at(2026, 8, 24, 10));
    assert.equal(ledger.calls.at(-1).to, at(2026, 8, 24, 11), 'query only the visible range (to is exclusive)');
    assert.equal(model.buckets[37].requests, 2);
    const html = b.renderHtml(model, view, { width: 330 });
    assert.match(html, /TOKEN USAGE/);
    assert.match(html, /≈127,000/);
    assert.match(html, /命中率 80\.7%/);
    assert.match(html, /部分/);
    assert.match(html, /API REQUEST/);
    assert.match(html, /10:37:31/);
    for (const label of ['全部 Provider', '全部模型', '全部功能', '全部角色', '输入', '输出', 'Cache Read', 'Cache Write', '总 Token', '成本', '请求次数']) assert.ok(html.includes(label), label);

    const unpriced = await b.buildViewModel(fakeLedger([entry(at(2026, 8, 24, 10, 1))]), view, at(2026, 8, 24, 12));
    assert.equal(unpriced.summary.costState, 'none');
    const unpricedHtml = b.renderHtml(unpriced, view, {});
    assert.match(unpricedHtml, /估算成本<\/span><b>—<\/b>/);
    assert.match(unpricedHtml, /查不到公开价格/);
});

test('feature ranking sorts by the active metric and a feature filter narrows the query', async () => {
    const b = loadBillApp();
    const day = at(2026, 8, 24, 9);
    const ledger = fakeLedger([
        entry(day, { feature: 'forum', input: 18000000, output: 600000 }),
        entry(day + 1000, { feature: 'chat', input: 9000000, output: 200000 }),
        entry(day + 2000, { feature: 'world', input: 6000000, output: 100000 }),
        entry(day + 3000, { feature: 'comic', input: 4000000, output: 300000 }),
        entry(day + 4000, { feature: 'chat', input: 10, output: 10 }),
        entry(day + 5000, { feature: 'chat', input: 10, output: 10 })
    ]);
    const view = { path: [2026, 8, 24], metric: 'total', filters: {}, selected: null };
    const model = await b.buildViewModel(ledger, view, day);
    assert.deepEqual(plain(model.features.map(f => f.key)), ['forum', 'chat', 'world', 'comic']);
    assert.equal(model.features[0].amount, 18600000);
    const html = b.renderHtml(model, view, {});
    assert.match(html, /论坛 Agent<\/span><b>1860 万/);
    assert.match(html, /聊天<\/span><b>920 万/);
    const byRequests = await b.buildViewModel(ledger, { ...view, metric: 'requests' }, day);
    assert.equal(byRequests.features[0].key, 'chat');
    const filtered = await b.buildViewModel(ledger, { ...view, filters: { feature: 'world', provider: '' } }, day);
    assert.equal(ledger.calls.at(-1).feature, 'world');
    assert.equal('provider' in ledger.calls.at(-1), false, 'empty filters are not sent');
    assert.deepEqual(plain(filtered.features.map(f => f.key)), ['world']);
});

test('year overview shows recent years with data, and number formats use 万 / 亿', async () => {
    const b = loadBillApp();
    const ledger = fakeLedger([entry(at(2019, 3, 1)), entry(at(2024, 5, 1)), entry(at(2026, 8, 1))]);
    const model = await b.buildViewModel(ledger, { path: [], metric: 'total', filters: {}, selected: null }, at(2026, 8, 24));
    assert.deepEqual(plain(model.buckets.map(x => x.part)), [2021, 2022, 2023, 2024, 2025, 2026]);
    assert.equal(model.buckets[3].requests, 1);
    assert.equal(model.buckets[4].requests, 0, 'empty years stay visible');
    const fresh = await b.buildViewModel(fakeLedger([]), { path: [], metric: 'total', filters: {}, selected: null }, at(2026, 8, 24));
    assert.deepEqual(plain(fresh.buckets.map(x => x.part)), [2024, 2025, 2026]);
    assert.match(b.renderHtml(fresh, { path: [], metric: 'total', filters: {}, selected: null }, {}), /这段时间还没有 API 请求/);
    assert.match(b.renderHtml({ missing: true }, { path: [], metric: 'total', filters: {} }, {}), /账本还没准备好/);

    assert.equal(b.formatExact(158652152), '158,652,152');
    assert.equal(b.formatAbbr(18600000), '1860 万');
    assert.equal(b.formatAbbr(123456), '12.3 万');
    assert.equal(b.formatAbbr(158652152), '1.59 亿');
    assert.equal(b.formatAbbr(9999), '9,999');
    assert.equal(b.formatCost(12.345), '$12.35');
    assert.equal(b.formatCost(0.0034), '$0.0034');
    assert.equal(b.formatRate(0.968), '96.8%');
});

test('chart svg marks the selected bucket and keeps empty buckets', async () => {
    const b = loadBillApp();
    const ledger = fakeLedger([entry(at(2026, 8, 24, 10, 37, 5)), entry(at(2026, 8, 24, 10, 37, 26), { input: 5000 })]);
    const view = { path: [2026, 8, 24, 10, 37], metric: 'total', filters: {}, selected: 26 };
    const model = await b.buildViewModel(ledger, view, at(2026, 8, 24, 11));
    const svg = b.renderChart(model, view, 320);
    assert.equal((svg.match(/class="bill-hit"/g) || []).length, 60);
    assert.equal((svg.match(/class="bill-bar is-selected"/g) || []).length, 1);
    assert.equal((svg.match(/class="bill-bar is-dim"/g) || []).length, 1);
    assert.equal((svg.match(/class="bill-empty/g) || []).length, 58);
    assert.match(svg, /bill-value-label[^>]*>5,200</);
});

test('aggregating 100k entries stays a single fast pass', () => {
    const b = loadBillApp();
    const range = b.buildRange([2026]);
    const start = at(2026, 0, 1);
    const entries = Array.from({ length: 100000 }, (_, i) => entry(start + i * 300000, { feature: i % 3 ? 'chat' : 'forum' }));
    const began = Date.now();
    const result = b.aggregate(entries, range, { metric: 'total', costOf: () => null });
    assert.ok(Date.now() - began < 2000);
    assert.equal(result.summary.requests, 100000);
    assert.equal(result.buckets.reduce((sum, x) => sum + x.requests, 0), 100000);
});

function dockHarness(saved, domDock) {
    const localStorage = memoryStorage(saved ? { desktop_layout_v2: JSON.stringify(saved) } : {});
    const dock = { items: domDock.slice(), appendChild(item) { this.items.push(item.appId); } };
    const placed = [];
    const context = vm.createContext({
        window: { _folders: [] },
        localStorage,
        console,
        DESKTOP_LAYOUT_KEY: 'desktop_layout_v2',
        DESKTOP_DOCK_LAYOUT_MAX: 4,
        _desktopLayoutNeedsVisiblePersist: false,
        document: {
            querySelector: selector => selector === '#home-screen .dock-bar' ? dock : null,
            querySelectorAll: () => []
        },
        getDesktopAppIdFromElement: () => '',
        collectDesktopDockLayout: () => dock.items.slice(),
        createDesktopDockItem: appId => ({ appId }),
        refreshDesktopDockOrder() {},
        getDesktopAppDefinition: id => ({ id, name: '账单', icon: 'ri-bill-line' }),
        ensureDesktopPage: () => ({ querySelector: () => ({ classList: { contains: name => name === 'layout-canvas' } }) }),
        addDesktopAppAfterFolderPage: (app, area, offset) => { placed.push({ id: app.id, offset }); return {}; },
        hasDesktopMeasurableLayoutCanvas: () => true,
        persistDesktopLayoutRepair: () => true
    });
    vm.runInContext(sourceSection('script.js', 'function planDesktopBillDockEntry(', 'function cleanupRemovedWatchTogetherData('), context);
    return { context, localStorage, dock, placed };
}

test('existing saved layouts get 账单 appended to the dock without dropping user items', () => {
    const items = [{ id: 'app-wechat', page: 0, left: 10, top: 10 }, { id: 'custom-lovely-default', type: 'custom', kind: 'lovely', page: 0 }];
    const { context, localStorage, dock } = dockHarness({ items, dock: ['music', 'wechat', 'preset'], deletedBuiltins: [], pageCount: 2 }, ['music', 'wechat', 'preset']);
    assert.equal(context.migrateDesktopBillDockApp(), true);
    assert.deepEqual(dock.items, ['music', 'wechat', 'preset', 'bill']);
    const saved = JSON.parse(localStorage.getItem('desktop_layout_v2'));
    assert.deepEqual(saved.dock, ['music', 'wechat', 'preset', 'bill']);
    assert.deepEqual(saved.items, items, 'desktop items untouched');
    assert.equal(saved.pageCount, 2);
    assert.equal(localStorage.getItem('bynd_desktop_bill_dock_v1'), '1');
    assert.equal(context.migrateDesktopBillDockApp(), false, 'runs once');
    assert.deepEqual(dock.items, ['music', 'wechat', 'preset', 'bill']);
});

test('a full dock is never evicted; 账单 goes to an open desktop slot instead', () => {
    const { context, localStorage, dock, placed } = dockHarness({ items: [{ id: 'app-regex', page: 0 }], dock: ['music', 'camera', 'preset', 'wechat'] }, ['music', 'camera', 'preset', 'wechat']);
    assert.equal(context.migrateDesktopBillDockApp(), true);
    assert.deepEqual(dock.items, ['music', 'camera', 'preset', 'wechat']);
    assert.deepEqual(placed, [{ id: 'bill', offset: 2 }]);
    assert.equal(localStorage.getItem('bynd_desktop_bill_dock_v1'), '1');
});

test('dock plan leaves default and already-placed layouts alone', () => {
    const { context } = dockHarness(null, ['music', 'camera', 'preset', 'bill']);
    assert.equal(context.planDesktopBillDockEntry({}, [], false).action, 'default');
    assert.equal(context.planDesktopBillDockEntry({ items: [] }, [], false).action, 'default', 'no saved dock keeps the static dock HTML');
    assert.equal(context.planDesktopBillDockEntry({ items: [{ id: 'app-bill' }], dock: ['music'] }, ['music'], false).action, 'present');
    assert.equal(context.planDesktopBillDockEntry({ items: [], dock: ['music'] }, ['music'], true).action, 'present', 'inside a folder');
    assert.deepEqual(plain(context.planDesktopBillDockEntry({ dock: ['music', 'gone'] }, ['music'], false).dock), ['music', 'bill'], 'counts the rendered dock, not stale ids');
});

test('账单 is registered as a dock app with a themable icon slot and window wiring', () => {
    const script = fs.readFileSync('script.js', 'utf8');
    const html = fs.readFileSync('index.html', 'utf8');
    assert.match(script, /\{ id: 'bill', name: '账单', icon: 'ri-bill-line' \}/);
    assert.match(script, /else if \(appName === 'bill'\) winId = 'app-bill-window';/);
    assert.match(script, /window\.ByndBillApp\?\.open\(\)/);
    assert.match(script, /migrateDesktopBillDockApp\(\);/);
    assert.match(html, /<div class="dock-item" onclick="openApp\('bill'\)">/);
    assert.match(html, /<div id="app-bill-window" class="app-window hidden/);
    assert.match(html, /closeApp\('bill'\)/);
    assert.match(html, /styles\/bill-app\.css\?v=/);
    const ticket = html.indexOf('modules/wechat/api-ticket.js');
    const bill = html.indexOf('modules/usage/bill-app.js');
    assert.ok(ticket > 0 && bill > ticket, 'bill app loads after the receipt module');
    const ledger = html.indexOf('modules/usage/ledger.js');
    if (ledger > 0) assert.ok(bill > ledger, 'bill app loads after the ledger');
    const css = fs.readFileSync('styles/bill-app.css', 'utf8');
    const selectors = Array.from(css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g), m => m[1].trim()).filter(s => s && !s.startsWith('@'));
    assert.ok(selectors.length > 50);
    for (const group of selectors) for (const selector of group.split(',').map(s => s.trim()).filter(Boolean)) {
        assert.ok(selector.startsWith('#app-bill-window'), 'unscoped selector: ' + selector);
    }
});
