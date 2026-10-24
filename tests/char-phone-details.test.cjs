const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root } = require('./helpers/harness.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function load({ api, rows = {} } = {}) {
    const calls = [];
    const renders = [];
    const char = { id: 'c1', name: '林间', chatConfig: {} };
    const snapshot = { updatedAt: 1000, wallet: '¥100' };
    const context = vm.createContext({
        window: { myCharacters: [char], _wechatAiPhoneOpenCharId: 'c1', _wechatAiPhoneTab: 'wallet' },
        console: { log() {}, warn() {}, error() {} },
        Promise, JSON, Math, Date, Object, Array, Map, String, Number,
        wcEscapeHtml: escape, wcEscapeAttr: escape,
        getWechatCharDisplayName: c => c.name,
        getWechatAiPhoneHomeAvatar: () => 'a.png',
        getWechatCharacterPersonaText: () => '建筑设计师',
        stripWechatPromptText: (text, max) => String(text || '').slice(0, max),
        getWechatAiPhoneAllApps: () => [{ key: 'wallet', label: '钱包' }, { key: 'shopping', label: '购物' }],
        getWechatAiPhoneRenderSnapshot: () => snapshot,
        getWechatAiPhoneWalletRows: () => rows.wallet || [{ title: '山野咖啡 -¥36.50', detail: '拿铁', meta: '今天' }],
        getWechatAiPhoneShoppingRows: () => rows.shopping || [],
        getWechatAiPhoneTakeoutRows: () => [], getWechatAiPhoneScheduleRows: () => [],
        getWechatAiPhoneFootprintRows: () => [], getWechatAiPhoneGameRows: () => [],
        renderWechatAiPhone: () => renders.push(1),
        saveCharactersToStorage: async () => true,
        parseWechatJsonObject: text => { try { return JSON.parse(text); } catch { return null; } },
        callChatApi: async (messages, options) => { calls.push({ messages, options }); return api(messages, calls.length); }
    });
    vm.runInContext(read('apps/char-phone/details.js'), context);
    return { context, calls, renders, char, snapshot };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('every page and record type normalizes a model reply and renders without throwing', () => {
    const { context } = load({ api: () => ({ ok: false }) });
    const samples = {
        'wallet:bills': { month: '10月', items: [{ date: '10-21', merchant: '盒马', category: '购物', amount: '-128.3', method: '卡' }, { merchant: '工资', amount: 14200 }, { merchant: '', amount: 3 }, { merchant: '无金额' }] },
        'shopping:discover': { items: [{ title: '手冲壶', price: '¥189' }, { price: 'no title' }] },
        'shopping:video': { items: [{ title: '种草', body: 'x' }] },
        'shopping:messages': { items: [{ from: '顺丰', kind: '物流', text: '派送中' }] },
        'shopping:orders': { items: [{ title: '开衫', price: '¥299', qty: '2' }] },
        'takeout:discover': { items: [{ name: '粥铺', tags: ['夜宵', 3] }] },
        'takeout:saved': { items: [{ title: '红包', amount: '¥8' }] },
        'takeout:profile': { addresses: [{ label: '家', text: '文三路' }], favorites: [], month: { orders: 14 } },
        'games:library': { items: [{ title: '星露谷' }] },
        'games:profile': { nickname: '林间有风', achievements: [{ title: '温室' }], friends: [{ name: '阿杰' }] },
        'footprints:saved': { items: [{ name: '图书馆' }] },
        'footprints:profile': { summary: 's', cities: [{ name: '杭州', visits: 3 }] }
    };
    const specs = context.CHAR_PHONE_PAGE_SPECS ?? vm.runInContext('CHAR_PHONE_PAGE_SPECS', context);
    const renderers = vm.runInContext('CHAR_PHONE_PAGE_RENDERERS', context);
    assert.deepEqual(Object.keys(specs).sort(), Object.keys(samples).sort(), 'every page has a sample');
    assert.deepEqual(Object.keys(renderers).sort(), Object.keys(specs).sort(), 'every page has a renderer');
    for (const [id, sample] of Object.entries(samples)) {
        const data = specs[id].normalize(sample);
        assert.equal(specs[id].valid(data), true, id);
        assert.equal(typeof renderers[id](data, { name: '林间' }, {}), 'string', id);
    }
    const bills = specs['wallet:bills'].normalize(samples['wallet:bills']);
    assert.deepEqual(Array.from(bills.items, item => item.amount), [-128.3, 14200], 'rows without a merchant or an amount are dropped');

    const records = vm.runInContext('CHAR_PHONE_RECORD_SPECS', context);
    const recordRenderers = vm.runInContext('CHAR_PHONE_RECORD_RENDERERS', context);
    assert.deepEqual(Object.keys(recordRenderers).sort(), Object.keys(records).sort());
    const row = { title: '记录', detail: 'd', meta: 'm' };
    for (const app of Object.keys(records)) {
        const data = records[app].normalize({ items: [{ name: 'x', price: '¥1' }], merchant: 'm', game: 'g', place: 'p', title: 't' }, row);
        assert.equal(typeof recordRenderers[app](data, row, { name: '林间' }), 'string', app);
    }
});

test('generated text is escaped before it reaches the phone', () => {
    const { context } = load({ api: () => ({ ok: false }) });
    const spec = vm.runInContext("CHAR_PHONE_PAGE_SPECS['shopping:discover']", context);
    const html = vm.runInContext("CHAR_PHONE_PAGE_RENDERERS['shopping:discover']", context)(spec.normalize({ items: [{ title: '<img src=x onerror=alert(1)>' }] }));
    assert.doesNotMatch(html, /<img src=x/);
    assert.match(html, /&lt;img src=x/);
});

test('opening a record generates it once, saves it, and reopening does not call the API again', async () => {
    const receipt = { merchant: '杭州山野咖啡', amount: -36.5, status: '支付成功', invoice: { number: '2633', lines: [{ name: '*餐饮服务*餐费', amount: '34.43' }], total: '36.50' } };
    const { context, calls, char } = load({ api: () => ({ ok: true, content: JSON.stringify(receipt) }) });
    context.window._charPhoneRecord = { app: 'wallet', index: 0, source: 'list' };
    const first = vm.runInContext('renderCharPhoneRecordDetail', context)('wallet', {}, char);
    assert.match(first, /正在生成账单详情/);
    await settle(); await settle();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.presetOverride, null, 'chat presets do not shape the JSON request');
    assert.match(calls[0].messages[1].content, /山野咖啡 -¥36\.50/, 'the record being expanded is in the request');
    const stored = Object.values(char.chatConfig.aiPhoneDetails.records);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].data.invoice.number, '2633');
    const again = vm.runInContext('renderCharPhoneRecordDetail', context)('wallet', {}, char);
    assert.match(again, /查看电子发票/);
    assert.equal(calls.length, 1, 'saved detail is reused');
});

test('a failed request shows its reason and is only retried by the user', async () => {
    const { context, calls, char } = load({ api: () => ({ ok: false, error: '接口 429：请求太频繁' }) });
    context.window._wechatAiPhoneTab = 'wallet';
    context.window._charPhoneNativeViews = { wallet: 'bills' };
    const render = () => vm.runInContext('renderCharPhoneLazyPage', context)('wallet', 'bills', { updatedAt: 1000 }, char);
    render();
    await settle(); await settle();
    const failed = render();
    assert.match(failed, /账单没能生成/);
    assert.match(failed, /接口 429：请求太频繁/);
    render(); render();
    await settle();
    assert.equal(calls.length, 1, 'rendering again does not resend a failed request');
    vm.runInContext("retryCharPhoneDetail('page')", context);
    await settle(); await settle();
    assert.equal(calls.length, 2, 'retry sends it again');
});

test('pages remember which phone sync they belong to', async () => {
    const { context, char } = load({ api: () => ({ ok: true, content: JSON.stringify({ month: '10月', items: [{ merchant: '盒马', amount: -10 }] }) }) });
    const render = snapshot => vm.runInContext('renderCharPhoneLazyPage', context)('wallet', 'bills', snapshot, char);
    render({ updatedAt: 1000 });
    await settle(); await settle();
    assert.doesNotMatch(render({ updatedAt: 1000 }), /手机已重新同步/);
    assert.match(render({ updatedAt: 2000 }), /手机已重新同步，这页还是旧的/);
});

test('the detail store is capped', () => {
    const { context } = load({ api: () => ({ ok: false }) });
    const store = { pages: {}, records: {} };
    for (let index = 0; index < 120; index += 1) store.records[`k${index}`] = { at: index };
    vm.runInContext('pruneCharPhoneDetailStore', context)(store);
    assert.equal(Object.keys(store.records).length, 80);
    assert.ok(store.records.k119 && !store.records.k0, 'newest entries are kept');
});

test('system apps open details and second-level pages instead of expanding one line', () => {
    const source = read('apps/char-phone/system-apps.js');
    for (const app of ['schedule', 'games']) assert.match(source, new RegExp(`openCharPhoneRecord\\('${app}'`));
    assert.match(source, /openCharPhoneRecord\('\$\{key\}',\$\{index\}\)/, 'wallet and footprints rows open details');
    assert.match(source, /openCharPhoneRecord\('\$\{key\}',\$\{i\._index\}\)/, 'filtered orders keep their original index');
    assert.match(source, /\['bills','账单','ri-file-list-3-line'\]/, 'wallet has a bills tab');
    assert.doesNotMatch(source, /<details class="cp-(?:system-record|commerce-order|games-item|calendar-event)"/);
    const layout = require(path.join(root, 'scripts/source-layout.cjs'));
    assert.ok(layout.wechatParts.includes('apps/char-phone/details.js'));
    assert.ok(layout.styleParts.includes('apps/char-phone/details.css'));
    assert.match(read('index.html'), /apps\/char-phone\/details\.js/);
});

function loadWithNative(api) {
    const harness = load({ api });
    vm.runInContext(read('apps/char-phone/details-native.js'), harness.context);
    return harness;
}

test('persona apps: every page and record spec normalizes and renders, including empty replies', () => {
    const { context } = loadWithNative(() => ({ ok: false }));
    const pages = vm.runInContext('CHAR_PHONE_PAGE_SPECS', context);
    const pageRenderers = vm.runInContext('CHAR_PHONE_PAGE_RENDERERS', context);
    const records = vm.runInContext('CHAR_PHONE_RECORD_SPECS', context);
    const recordRenderers = vm.runInContext('CHAR_PHONE_RECORD_RENDERERS', context);
    for (const app of ['bank', 'stocks', 'funds', 'luxury', 'hotels', 'flights', 'golf', 'board', 'alipay']) {
        assert.ok(records[app] && recordRenderers[app], `${app} has a record spec and renderer`);
    }
    assert.deepEqual(Object.keys(pageRenderers).sort(), Object.keys(pages).sort(), 'every page has a renderer');
    const rich = {
        items: [{ name: '产品', title: '标题', model: '机型', service: '缴费', from: '客服', text: '内容', brand: '品牌', price: '¥1', amount: '¥2', merchant: '盒马', energy: '1g' }],
        indices: [{ name: '上证', value: '3000', change: '+1%' }], sectors: [], allocation: [{ name: '固收', percent: 40 }],
        manager: { name: '周经理' }, benefits: ['权益'], appointments: [], total: '¥1', energy: '10g', trees: ['梭梭树']
    };
    for (const [id, spec] of Object.entries(pages)) {
        if (id.startsWith('wallet:') || id.startsWith('shopping:') || id.startsWith('takeout:') || id.startsWith('games:') || id.startsWith('footprints:')) continue;
        const data = spec.normalize(id.endsWith(':bills') ? { items: [{ merchant: '盒马', amount: -1 }] } : rich);
        assert.equal(typeof pageRenderers[id](data, { name: '沈砚' }, {}, id.split(':')[0]), 'string', id);
        assert.equal(spec.valid(spec.normalize({})), false, `${id}: an empty reply counts as a failure`);
    }
    const row = { title: '记录', detail: 'd', meta: 'm', symbol: '300750', from: '杭州', to: '三亚' };
    for (const app of ['bank', 'stocks', 'funds', 'luxury', 'hotels', 'flights', 'golf', 'board', 'alipay']) {
        const data = records[app].normalize({ items: [{ name: 'x' }], points: [1, 2, 3], scores: [4, 5], position: { qty: '1' } }, row);
        assert.equal(typeof recordRenderers[app](data, row, { name: '沈砚' }), 'string', app);
    }
});

test('persona records open from the app item, include its fields in the request, and close cleanly', async () => {
    const quote = { name: '宁德时代', symbol: '300750', price: '186.20', changePct: '+2.31%', points: [1, 2, 3] };
    const { context, calls, char } = loadWithNative(() => ({ ok: true, content: JSON.stringify(quote) }));
    const snapshot = { appData: { stocks: { items: [{ title: '宁德时代', symbol: '300750', price: '186.20', change: '+2.31%' }] } } };
    context.window._charPhoneDetail = { key: 'stocks', index: 0 };
    const render = () => vm.runInContext('renderCharPhoneRecordDetail', context)('stocks', snapshot, char);
    assert.match(render(), /正在生成个股详情/);
    await settle(); await settle();
    assert.match(calls[0].messages[1].content, /"symbol":"300750"/, 'item fields reach the generator');
    const html = render();
    assert.match(html, /cpd-spark is-up/, 'rising points draw a red line');
    assert.match(html, /closeCharPhoneRecord\(\)/);
    vm.runInContext('closeCharPhoneRecord()', context);
    assert.equal(context.window._charPhoneDetail, null, 'closing clears the persona detail too');
    assert.equal(vm.runInContext("renderCharPhoneRecordDetail('mail', {}, window.myCharacters[0])", context), null, 'apps without a spec keep their own detail view');
});

test('trend colours follow Chinese market convention', () => {
    const { context } = loadWithNative(() => ({ ok: false }));
    const trend = vm.runInContext('cpdTrendClass', context);
    assert.equal(trend('+2.31%'), 'is-up');
    assert.equal(trend('-0.21%'), 'is-down');
    assert.equal(trend('−1.3%'), 'is-down');
    assert.equal(trend('0.00%'), '');
});

test('persona apps route detail and secondary tabs through the generator', () => {
    assert.match(read('apps/char-phone/catalog.js'), /renderCharPhoneRecordDetail\(key,snapshot,char\)/);
    assert.match(read('apps/char-phone/native-apps.js'), /charPhoneHasLazyPage\(key,view\)\?renderCharPhoneLazyPage/);
    assert.match(read('apps/char-phone/brand-screens.js'), /charPhoneHasLazyPage\('alipay',view\)/);
    const layout = require(path.join(root, 'scripts/source-layout.cjs'));
    const parts = layout.wechatParts;
    assert.ok(parts.indexOf('apps/char-phone/details-native.js') > parts.indexOf('apps/char-phone/details.js'));
    const html = read('index.html');
    assert.ok(html.indexOf('details-native.js') > html.indexOf('char-phone/details.js'));
});
