const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root } = require('./helpers/harness.cjs');

const source = fs.readFileSync(path.join(root, 'systems/agent-runtime/web-search.js'), 'utf8');
function harness({ answer = '{"search":true,"query":"今天新闻"}', fetchResult, fetchError } = {}) {
    const calls = [];
    const window = {
        callChatApi: async (messages, options) => { calls.push({ messages, options }); return { ok: true, content: answer }; },
        ByndDecider: { gate: async () => ({ allow: true }) }
    };
    const context = vm.createContext({ window, URL, Date, AbortSignal,
        fetch: async url => { calls.push({ url }); if (fetchError) throw fetchError; return { ok: true, json: async () => fetchResult || { results: [{ title: '新闻', url: 'https://example.org/news', snippet: '已发布' }] } }; }
    });
    vm.runInContext(source, context);
    const char = { id: 'c1', name: '角色', description: '生活在现代', history: [] };
    return { api: window.ByndWebSearch, char, calls };
}

test('a real-world question is decided before search and validated sources enter the reply context', async () => {
    const h = harness();
    const result = await h.api.prepare(h.char, [{ isMe: true, content: '今天有什么新闻？' }]);
    assert.equal(result.sources.length, 1);
    assert.match(result.prompt, /外部网页摘要/);
    assert.equal(h.calls.filter(call => call.messages).length, 1);
    assert.equal(h.calls.filter(call => call.url).length, 1);
});

test('search failure never fabricates sources or tells the character that a search succeeded', async () => {
    const h = harness({ fetchError: new Error('offline') });
    const result = await h.api.prepare(h.char, [{ isMe: true, content: '今天有什么新闻？' }]);
    assert.equal(result.sources.length, 0);
    assert.match(result.prompt, /不要编造最新事实或来源/);
    assert.equal(h.api.safeSource({ title: 'bad', url: 'javascript:alert(1)' }), null);
});

test('casual chat and a no-search decision do not reach the public search service', async () => {
    const casual = harness();
    assert.equal(await casual.api.prepare(casual.char, [{ isMe: true, content: '晚安呀' }]), null);
    assert.equal(casual.calls.length, 0);
    const noSearch = harness({ answer: '{"search":false,"query":""}' });
    assert.equal(await noSearch.api.prepare(noSearch.char, [{ isMe: true, content: '你喜欢什么电影？' }]), null);
    assert.equal(noSearch.calls.filter(call => call.url).length, 0);
});

test('private text and stale user turns are never sent to the search decision or provider', async () => {
    const h = harness();
    assert.equal(await h.api.prepare(h.char, [{ isMe: true, content: '今天新闻？我的 API 密钥 sk-1234567890abcdef' }]), null);
    assert.equal(await h.api.prepare(h.char, [{ isMe: true, content: '今天新闻？' }, { isMe: false, content: '晚安' }]), null);
    assert.equal(h.calls.length, 0);
});
