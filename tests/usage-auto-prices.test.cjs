const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, memoryStorage } = require('./helpers/harness.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const OPENROUTER = {
    data: [
        { id: 'google/gemini-3.1-pro-preview:batch', pricing: { prompt: '0.000001', completion: '0.000006' } },
        { id: 'google/gemini-3.1-pro-preview', pricing: { prompt: '0.000002', completion: '0.000012', input_cache_read: '0.0000002', input_cache_write: '0.000000375' } },
        { id: 'anthropic/claude-opus-5.5', pricing: { prompt: '0.000004', completion: '0.00002', input_cache_read: '0.0000002', input_cache_write: '0.000005' } },
        { id: 'openrouter/auto', pricing: { prompt: '-1', completion: '-1' } }
    ]
};

function harness({ fetchImpl } = {}) {
    const storage = memoryStorage();
    const calls = [];
    const window = { myCharacters: [] };
    const context = vm.createContext({
        window, localStorage: storage, URL, setTimeout, clearTimeout, console: { warn() {}, error() {}, log() {} },
        fetch: fetchImpl || (async url => { calls.push(url); return { ok: true, json: async () => OPENROUTER }; })
    });
    vm.runInContext(read('modules/usage/ledger.js'), context);
    return { ledger: window.ByndUsageLedger, storage, calls };
}

test('OpenRouter prices are converted to USD per 1M tokens and batch variants never replace the base price', () => {
    const { ledger } = harness();
    const map = ledger.parseOpenRouterPrices(OPENROUTER.data);
    assert.deepEqual({ ...map['gemini-3-1-pro-preview'] }, { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 0.375, id: 'google/gemini-3.1-pro-preview' });
    assert.equal(map['auto'], undefined, 'variable (-1) prices are skipped');
});

test('relay model names match the OpenRouter id despite provider prefixes, dots and dates', async () => {
    const { ledger, calls } = harness();
    await ledger.refreshAutoPrices();
    assert.equal(calls.length, 1);
    assert.equal(ledger.resolvePrice('gemini-3.1-pro-preview').source, 'openrouter');
    assert.equal(ledger.resolvePrice('google/gemini-3.1-pro-preview').price.input, 2);
    assert.equal(ledger.resolvePrice('claude-opus-5-5').matchedId, 'anthropic/claude-opus-5.5');
    assert.equal(ledger.resolvePrice('claude-opus-5.5-20260801').matchedId, 'anthropic/claude-opus-5.5');
    assert.equal(ledger.resolvePrice('my-relay-custom-model'), null);
    assert.equal(ledger.resolvePrice('jev-latest').source, 'builtin');
    await ledger.refreshAutoPrices();
    assert.equal(calls.length, 1, 'the list is fetched at most once a day');
});

test('costs use automatic prices with cache rates, and a manual price overrides them', async () => {
    const { ledger } = harness();
    await ledger.refreshAutoPrices();
    const entry = { model: 'gemini-3.1-pro-preview', input: 1_000_000, cacheRead: 500_000, cacheWrite: 0, output: 100_000 };
    // 500k uncached × $2 + 500k cached × $0.2 + 100k output × $12, per 1M
    assert.equal(Math.round(ledger.costOf(entry) * 1e6) / 1e6, 1 + 0.1 + 1.2);
    ledger.setPrice('gemini-3.1-pro-preview', { input: 1, output: 1 });
    assert.equal(ledger.resolvePrice('gemini-3.1-pro-preview').source, 'manual');
    assert.equal(Math.round(ledger.costOf(entry) * 1e6) / 1e6, 0.5 + 0.5 + 0.1);
    assert.equal(ledger.costOf({ model: 'jev-latest', input: 1_000_000, output: 5000 }), 0.042);
});

test('a failed price fetch keeps the previous list and never throws', async () => {
    const { ledger } = harness({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
    const info = await ledger.refreshAutoPrices({ force: true });
    assert.equal(Object.keys(info.map).length, 0);
    assert.equal(ledger.resolvePrice('gemini-3.1-pro-preview'), null);
    assert.equal(ledger.autoPriceInfo().count, 0);
});

test('the bill shows automatic prices read-only and only asks for a manual price when none is found', () => {
    const bill = read('modules/usage/bill-app.js');
    assert.match(bill, /OpenRouter 自动/);
    assert.match(bill, /查不到公开价格/);
    assert.match(bill, /data-action="refresh-prices"/);
    assert.match(bill, /ledger\?\.refreshAutoPrices\?\.\(\)/);
});
