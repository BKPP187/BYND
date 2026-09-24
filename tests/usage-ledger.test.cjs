const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, memoryStorage } = require('./helpers/harness.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const ok = (content, usage, finish = 'stop') => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: finish }], usage }), { status: 200 });

// chat-api.js + api-ticket.js + ledger.js in one vm; no indexedDB, so the ledger uses its in-memory store.
function harness({ withLedger = true, storage = memoryStorage() } = {}) {
    const requests = [];
    let respond = () => ok('你好', { prompt_tokens: 120, completion_tokens: 8, total_tokens: 128, prompt_tokens_details: { cached_tokens: 100 } });
    const window = { myCharacters: [] };
    const context = vm.createContext({
        window, localStorage: storage, Response, TextDecoder, TextEncoder, AbortSignal, URL, setTimeout, clearTimeout,
        console: { warn() {}, error() {}, log() {} },
        getDefaultApi: () => ({ name: '我的中转', baseUrl: 'https://l0veyou.com/v1', model: 'claude-test', apiKey: 'sk-secretsecretsecret123' }),
        fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return respond(requests.length); }
    });
    vm.runInContext(read('chat-api.js'), context);
    vm.runInContext(read('modules/wechat/api-ticket.js'), context);
    if (withLedger) vm.runInContext(read('modules/usage/ledger.js'), context);
    return { context, window, requests, storage, ledger: window.ByndUsageLedger, setRespond: fn => { respond = fn; } };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('a successful request records provider, model, feature, char and real usage including cached tokens', async () => {
    const h = harness();
    const char = { id: 'c1', name: '温今北', chatConfig: { nickname: '北北' }, history: [] };
    const seen = [];
    h.ledger.subscribe(event => seen.push(event.type));
    const result = await h.context.callChatApi([{ role: 'user', content: '早' }], { usageFeature: 'chat', usageChar: char, skipStatusValidationRetry: true });
    assert.equal(result.ok, true);
    await settle();
    const [entry] = await h.ledger.list();
    assert.equal(entry.provider, 'l0veyou.com');
    assert.equal(entry.apiName, '我的中转');
    assert.equal(entry.model, 'claude-test');
    assert.equal(entry.feature, 'chat');
    assert.equal(entry.charId, 'c1');
    assert.equal(entry.charName, '北北');
    assert.deepEqual([entry.input, entry.output, entry.cacheRead, entry.cacheWrite, entry.total], [120, 8, 100, 0, 128]);
    assert.equal(entry.estimated, false);
    assert.equal(entry.ok, true);
    assert.equal(typeof entry.durationMs, 'number');
    assert.deepEqual(seen, ['record']);
    const full = await h.ledger.get(entry.id);
    assert.equal(full.ticket.rows[0].preview, '早');
    assert.equal(JSON.stringify(full).includes('sk-secret'), false, 'API key never stored');
    assert.equal(full.ticket.usage.total, 128);
});

test('anthropic-style usage and an unknown feature are normalised', async () => {
    const h = harness();
    h.setRespond(() => ok('嗯', { input_tokens: 20, output_tokens: 5, cache_read_input_tokens: 300, cache_creation_input_tokens: 40 }));
    await h.context.callChatApi([{ role: 'user', content: 'hi' }], { usageFeature: 'nope', skipStatusValidationRetry: true });
    await settle();
    const [entry] = await h.ledger.list();
    assert.equal(entry.feature, 'other');
    assert.deepEqual([entry.input, entry.output, entry.cacheRead, entry.cacheWrite, entry.total], [360, 5, 300, 40, 365]);
    assert.equal(entry.charId, '');
});

test('an error response records ok:false with the provider error', async () => {
    const h = harness();
    h.setRespond(() => new Response(JSON.stringify({ error: { message: 'bad model' } }), { status: 400 }));
    const result = await h.context.callChatApi([{ role: 'user', content: 'x' }], { usageFeature: 'status' });
    assert.equal(result.ok, false);
    await settle();
    const [entry] = await h.ledger.list();
    assert.equal(entry.ok, false);
    assert.equal(entry.feature, 'status');
    assert.match(entry.error, /HTTP 400/);
    assert.equal(entry.estimated, true);
});

test('a length continuation is recorded as a second request with the same feature', async () => {
    const h = harness();
    h.setRespond(n => n === 1
        ? ok('第一段', { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 }, 'length')
        : ok('第二段', { prompt_tokens: 70, completion_tokens: 12, total_tokens: 82 }));
    const ids = [];
    const result = await h.context.callChatApi([{ role: 'user', content: '讲个故事' }], { usageFeature: 'comic', usageLedgerIds: ids, skipStatusValidationRetry: true });
    assert.equal(result.ok, true);
    assert.equal(h.requests.length, 2);
    await settle();
    const entries = await h.ledger.list();
    assert.equal(entries.length, 2);
    assert.deepEqual(plain(entries.map(item => [item.feature, item.total])), [['comic', 60], ['comic', 82]]);
    const resolved = await Promise.all(ids);
    assert.deepEqual(plain(resolved).sort(), plain(entries.map(item => item.id)).sort());
    await h.ledger.update(resolved[0], { source: { charId: 'c1', msgIndex: 4 } });
    assert.deepEqual(plain((await h.ledger.get(resolved[0])).source), { charId: 'c1', msgIndex: 4 });
    assert.equal((await h.ledger.get(resolved[0])).estimated, false, 'update keeps the usage flags');
});

test('chat-api works unchanged when the ledger module is not loaded', async () => {
    const h = harness({ withLedger: false });
    const result = await h.context.callChatApi([{ role: 'user', content: 'x' }], { usageFeature: 'chat', skipStatusValidationRetry: true });
    assert.equal(result.ok, true);
    assert.equal(h.window.ByndUsageLedger, undefined);
});

test('costOf uses per-1M prices, falls back to the input price for cache, and is null without a price', async () => {
    const h = harness();
    const entry = { model: 'gpt-x', input: 1000000, output: 500000, cacheRead: 400000, cacheWrite: 100000 };
    assert.equal(h.ledger.costOf(entry), null);
    h.ledger.setPrice('gpt-x', { input: 2, output: 8 });
    assert.equal(h.ledger.costOf(entry), 2 + 4);
    h.ledger.setPrice('GPT-X', { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 2.5 });
    h.ledger.setPrice('gpt-x', null);
    assert.equal(h.ledger.costOf(entry), (500000 * 2 + 500000 * 8 + 400000 * 0.5 + 100000 * 2.5) / 1e6, 'case-insensitive model match');
    assert.ok(JSON.parse(h.storage.getItem('bynd_usage_prices_v1'))['GPT-X']);
    assert.equal(h.ledger.costOf({ model: 'other', input: 1 }), null);
});

test('list filters by provider, model, feature, char and time range; facets list what occurs', async () => {
    const h = harness();
    const base = Date.UTC(2026, 8, 1);
    const rows = [
        { at: base, feature: 'chat', provider: 'https://a.example/v1', model: 'm1', charId: 'c1', charName: '甲', input: 10, output: 1 },
        { at: base + 1000, feature: 'forum', provider: 'b.example', model: 'm2', input: 20, output: 2 },
        { at: base + 2000, feature: 'chat', provider: 'a.example', model: 'm2', charId: 'c2', charName: '乙', input: 30, output: 3 },
        { at: base + 3000, feature: 'image', provider: 'a.example', model: 'img', input: 0, output: 0, estimated: true }
    ];
    for (const row of rows.slice().reverse()) await h.ledger.record(row);
    assert.deepEqual(plain((await h.ledger.list()).map(item => item.at - base)), [0, 1000, 2000, 3000]);
    assert.equal((await h.ledger.list({ provider: 'a.example' })).length, 3);
    assert.equal((await h.ledger.list({ model: 'm2' })).length, 2);
    assert.equal((await h.ledger.list({ feature: 'chat', charId: 'c2' }))[0].total, 33);
    assert.deepEqual(plain((await h.ledger.list({ from: base + 1000, to: base + 3000 })).map(item => item.at - base)), [1000, 2000]);
    assert.deepEqual(plain((await h.ledger.list({ limit: 2 })).map(item => item.at - base)), [2000, 3000]);
    const facets = await h.ledger.facets();
    assert.deepEqual(plain(facets.providers), ['a.example', 'b.example']);
    assert.deepEqual(plain(facets.features), ['chat', 'forum', 'image']);
    assert.deepEqual(plain(facets.chars).map(c => c.id).sort(), ['c1', 'c2']);
    assert.equal(h.ledger.FEATURES[0].key, 'chat');
    assert.ok(h.ledger.FEATURES.every(item => item.key && item.label && item.icon));
});

test('large tickets are trimmed and never keep image data', async () => {
    const h = harness();
    const big = 'x'.repeat(3000);
    const ticket = { at: 1, rows: Array.from({ length: 150 }, (_, i) => ({ role: 'user', source: 'history', tokens: 9, preview: i === 5 ? 'data:image/png;base64,AAAA' + big : big })), worldbook: [], sources: {} };
    const id = await h.ledger.record({ feature: 'chat', ticket });
    const stored = (await h.ledger.get(id)).ticket;
    assert.ok(JSON.stringify(stored).length < 12000);
    assert.equal(JSON.stringify(stored).includes('data:image'), false);
});

test('backfill imports message apiUsageRecords once, pointing at their message', async () => {
    const storage = memoryStorage();
    const h = harness({ storage });
    const ticket = { at: Date.now() - 86400000, model: 'old-model', usage: { input: 90, output: 10, total: 100, cached: 30 }, inputEstimate: 80, outputEstimate: 9, status: '完成', rows: [], worldbook: [], sources: {} };
    const chars = [{ id: 'c9', name: '商桓', history: [{ isMe: true, content: 'hi' }, { isMe: false, content: 'yo', apiUsageRecords: [ticket, { ...ticket, usage: null, status: '失败', error: 'boom' }] }] }];
    assert.equal(await h.ledger.backfill(chars), 2);
    assert.equal(await h.ledger.backfill(chars), 0, 'flagged after the first run');
    assert.ok(storage.getItem('bynd_usage_backfill_v1'));
    const entries = await h.ledger.list();
    assert.equal(entries.length, 2);
    assert.deepEqual(plain(entries[0].source), { charId: 'c9', msgIndex: 1 });
    assert.equal(entries[0].backfilled, true);
    assert.deepEqual([entries[0].input, entries[0].cacheRead, entries[0].output, entries[0].total, entries[0].estimated], [90, 30, 10, 100, false]);
    assert.deepEqual([entries[1].ok, entries[1].estimated, entries[1].input], [false, true, 80]);
    assert.equal((await h.ledger.get(entries[0].id)).ticket.model, 'old-model');
});

test('entries older than 400 days are pruned lazily', async () => {
    const h = harness();
    await h.ledger.record({ id: 'ancient', at: Date.now() - 401 * 86400000, feature: 'chat' });
    await h.ledger.record({ id: 'fresh', feature: 'chat' });
    const ids = (await h.ledger.list()).map(item => item.id);
    assert.equal(ids.includes('ancient'), false);
    assert.equal(ids.includes('fresh'), true);
});

test('in-memory fallback keeps working without indexedDB and backup round-trips without tickets', async () => {
    const h = harness();
    assert.equal(typeof h.context.indexedDB, 'undefined');
    const id = await h.ledger.record({ feature: 'voice', provider: 'api.minimax.io', ticket: { rows: [] } });
    assert.ok(id);
    assert.equal((await h.ledger.update('missing', { ok: false })), null);
    const dump = await h.ledger.exportForBackup();
    assert.equal(dump.length, 1);
    assert.equal('ticket' in dump[0], false);
    const other = harness();
    assert.equal(await other.ledger.importFromBackup(dump), 1);
    assert.equal(await other.ledger.importFromBackup(dump), 0, 'merge by id');
    assert.equal((await other.ledger.list())[0].feature, 'voice');
});
