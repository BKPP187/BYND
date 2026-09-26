const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { sourceSection, memoryStorage, deferred } = require('./helpers/harness.cjs');
const body = '这是一篇来自真实来源的新闻测试正文，用于验证正文读取失败后的恢复流程。'.repeat(6);
const googleUrl = 'https://news.google.com/rss/articles/CBMi_TEST?oc=5';
const sourceUrl = 'https://publisher.example/news/123';
const reply = (text, extra = {}) => ({ ok: true, url: sourceUrl, text: async () => text, json: async () => JSON.parse(text), ...extra });

function reader(fetch) {
    const timers = new Set();
    const context = vm.createContext({
        window: {}, URL, URLSearchParams, AbortController, fetch,
        setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: timer => timers.delete(timer)
    });
    vm.runInContext(fs.readFileSync('apps/wechat/contacts/news-reader.js', 'utf8'), context);
    return { api: context.window.ByndNewsReader, timers };
}

test('Google RSS detail resolves the publisher before requesting its body', async () => {
    const calls = [];
    const { api, timers } = reader(async (url, options) => {
        calls.push({ url, options });
        if (calls.length === 1) return reply('<div data-n-a-ts="1790397647" data-n-a-sg="valid_signature">', { url: googleUrl });
        if (calls.length === 2) return reply(")]}'\n\n" + JSON.stringify([['wrb.fr', 'Fbv4je', JSON.stringify(['garturlres', sourceUrl, 1])]]));
        return reply(JSON.stringify({ data: { content: body } }));
    });
    const resolved = [];
    const article = await api.read(googleUrl, url => resolved.push(url));
    assert.equal(article.url, sourceUrl);
    assert.equal(article.body, body);
    assert.deepEqual(resolved, [sourceUrl]);
    assert.equal(calls[1].options.method, 'POST');
    const rpc = JSON.parse(new URLSearchParams(calls[1].options.body).get('f.req'));
    assert.equal(JSON.parse(rpc[0][0][1])[2], 'CBMi_TEST');
    assert.equal(calls[2].url, `https://r.jina.ai/${sourceUrl}`);
    assert.equal(timers.size, 0);
});

test('reader failure uses indexed source body and keeps timeout through response parsing', async () => {
    const pending = deferred();
    let calls = 0;
    const { api, timers } = reader(async () => {
        calls += 1;
        if (calls === 1) return reply('', { ok: false, status: 403 });
        return reply('', { json: () => pending.promise });
    });
    const loading = api.read(sourceUrl);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 2);
    assert.equal(timers.size, 1, 'the response body is still covered by the timeout');
    pending.resolve({ text: body });
    assert.equal((await loading).body, body);
    assert.equal(timers.size, 0);
});

test('all failing sources reject without fabricating a body and release timers', async () => {
    const { api, timers } = reader(async () => { throw new Error('network unavailable'); });
    await assert.rejects(api.read(sourceUrl), /network unavailable/);
    await assert.rejects(api.resolveUrl('javascript:alert(1)'), /地址无效/);
    assert.equal(api.safeUrl('http://127.0.0.1/private'), '');
    assert.equal(timers.size, 0);
});

function newsHarness(read) {
    const window = { ByndNewsReader: { read, safeUrl: value => {
        try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
    } } };
    const context = vm.createContext({
        window, URL, localStorage: memoryStorage(), console: { warn() {} },
        document: { getElementById: () => null },
        wcEscapeHtml: value => String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;')
    });
    vm.runInContext(sourceSection('apps/wechat/contacts/tabs.js', "const WECHAT_X_NEWS_CACHE_KEY =", 'function normalizeWechatXGdeltNews('), context);
    return context;
}

test('failed article can be retried and cached Google items retain their stable detail identity', async () => {
    let calls = 0;
    const context = newsHarness(async (url, onResolved) => {
        calls += 1;
        if (calls === 1) throw new Error('403');
        onResolved(sourceUrl);
        return { url: sourceUrl, body };
    });
    const item = { url: googleUrl, title: '新闻测试', source: 'news.google.com · 中文新闻' };
    context.window._wechatXNewsDetailUrl = googleUrl;
    context.window._wechatXRealtimeNewsItems = [item];
    await context.loadWechatXNewsArticleDetail(item, [item]);
    assert.equal(item.bodyOriginal, undefined);
    assert.equal(item.detailLoading, false);
    assert.match(context.renderWechatXNewsBodyHtml(item), /重新读取正文/);
    await context.window.retryWechatXNewsArticleDetail();
    assert.equal(item.url, googleUrl);
    assert.equal(item.sourceUrl, sourceUrl);
    assert.equal(item.bodyOriginal, body);
    assert.equal(item.detailError, '');
    assert.equal(calls, 2);
});

test('news list prefers genuine full text and an untranslated article remains readable', () => {
    const context = newsHarness();
    const rows = context.normalizeWechatXFullTextNews({ results: [
        { url: sourceUrl, title: '真实新闻', text: body, sitename: '来源媒体' },
        { url: 'https://publisher.example/headline-only', title: '只有标题', text: '' }
    ] });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].bodyCn, context.cleanWechatXReaderMarkdown(body));
    assert.equal(rows[0].source, '来源媒体');
    assert.match(context.renderWechatXNewsBodyHtml({ bodyOriginal: 'An original English article.' }), /原文正文/);
    assert.match(context.renderWechatXNewsBodyHtml({ bodyOriginal: 'An original English article.' }), /An original English article/);
});
