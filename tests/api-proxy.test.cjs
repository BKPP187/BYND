const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection } = require('./helpers/harness.cjs');

// The Worker is an ES module; load it once through a data: URL so the test
// never needs a bundler or wrangler.
const workerSource = fs.readFileSync(path.join(root, 'workers/bynd-push-worker.js'), 'utf8');
const workerModule = import('data:text/javascript;base64,' + Buffer.from(workerSource).toString('base64'));

test('public search returns bounded real sources and rejects foreign origins and oversized queries', async () => {
    const { default: worker } = await workerModule;
    const original = globalThis.fetch;
    const upstream = [];
    globalThis.fetch = async url => {
        upstream.push(String(url));
        return new Response('<?xml version="1.0"?><rss><channel><item><title>新闻 &amp; 事实</title><link>https://example.org/news</link><description>今天更新的资料</description></item><item><title>坏链接</title><link>javascript:alert(1)</link><description>不能展示</description></item></channel></rss>', { headers: { 'Content-Type': 'text/xml' } });
    };
    try {
        const url = 'https://bynd.ccwu.cc/mcp/web-search?q=' + encodeURIComponent('今天的新闻');
        const response = await worker.fetch(new Request(url, { headers: { Origin: 'https://bynd.ccwu.cc' } }), {});
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(data.results.length, 1);
        assert.equal(data.results[0].title, '新闻 & 事实');
        assert.equal(data.results[0].url, 'https://example.org/news');
        assert.equal(upstream.length, 1);
        assert.equal((await worker.fetch(new Request(url, { headers: { Origin: 'https://evil.example' } }), {})).status, 403);
        assert.equal((await worker.fetch(new Request('https://bynd.ccwu.cc/mcp/web-search?q=' + 'x'.repeat(181)), {})).status, 400);
        assert.equal(upstream.length, 1);
    } finally { globalThis.fetch = original; }
});

test('BYND example MCP connects without credentials and only exposes read-only sample tools', async () => {
    const { default: worker } = await workerModule;
    const url = 'https://bynd.ccwu.cc/mcp/demo';
    const call = async (method, params = {}) => {
        const response = await worker.fetch(new Request(url, { method: 'POST', headers: { Origin: 'https://bynd.ccwu.cc', 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }), {});
        return { response, body: await response.json() };
    };
    assert.equal((await call('initialize')).body.result.serverInfo.name, 'BYND 示例工具');
    const listed = (await call('tools/list')).body.result.tools;
    assert.deepEqual(listed.map(tool => tool.name), ['current_time', 'bynd_guide']);
    assert.ok(listed.every(tool => tool.annotations?.readOnlyHint === true));
    assert.match((await call('tools/call', { name: 'current_time', arguments: {} })).body.result.content[0].text, /UTC/);
    assert.equal((await call('tools/call', { name: 'delete_file' })).body.error.code, -32601);
});

test('sticker relay requires its configured upstream and rejects unrelated paths', async () => {
    const { default: worker } = await workerModule;
    const url = 'https://bynd.ccwu.cc/mcp/relay/giphy/stickers/trending';
    const request = new Request(url, { headers: { Origin: 'https://bynd.ccwu.cc' } });
    assert.equal((await worker.fetch(request, {})).status, 503);
    const realFetch = globalThis.fetch;
    const upstreamCalls = [];
    globalThis.fetch = async target => { upstreamCalls.push(String(target)); return new Response('{"items":[]}', { headers: { 'Content-Type': 'application/json' } }); };
    try {
        const env = { GIPHY_PROXY_ORIGIN: 'https://stickers.example.org/' };
        assert.equal((await worker.fetch(request, env)).status, 200);
        assert.equal(upstreamCalls[0], 'https://stickers.example.org/stickers/trending?limit=30');
        assert.equal((await worker.fetch(new Request(url.replace('trending', 'delete'), { headers: { Origin: 'https://bynd.ccwu.cc' } }), env)).status, 404);
        assert.equal((await worker.fetch(new Request(url, { headers: { Origin: 'https://evil.example' } }), env)).status, 403);
        assert.equal(upstreamCalls.length, 1);
    } finally { globalThis.fetch = realFetch; }
});

function settingsHarness(hostname = 'localhost', protocol = 'http:') {
    const context = vm.createContext({ window: {}, URL, location: { protocol, hostname, origin: `${protocol}//${hostname}` } });
    vm.runInContext(sourceSection('settings.js', '// Sites that refuse browser requests', '// 10. 核心测试逻辑'), context);
    return context;
}

test('official l0veyou and Wisart base URLs resolve to the BYND proxy, everything else stays direct', () => {
    const local = settingsHarness();
    assert.equal(local.resolveByndApiBaseUrl('https://l0veyou.com/v1'), 'https://bynd.ccwu.cc/mcp/relay/l0veyou/v1');
    assert.equal(local.resolveByndApiBaseUrl('https://www.l0veyou.com/v1/'), 'https://bynd.ccwu.cc/mcp/relay/l0veyou/v1');
    assert.equal(local.resolveByndApiBaseUrl('https://wisart.kuaileshifu.com/v1'), 'https://bynd.ccwu.cc/mcp/relay/wisart/v1');
    assert.equal(local.resolveByndApiBaseUrl('https://api.openai.com/v1'), 'https://api.openai.com/v1');
    assert.equal(local.resolveByndApiBaseUrl('https://l0veyou.com/v2'), 'https://l0veyou.com/v2', 'only the documented /v1 root is proxied');
    assert.equal(local.resolveByndApiBaseUrl('http://l0veyou.com/v1'), 'http://l0veyou.com/v1');
    assert.equal(local.isWisartApiBaseUrl('https://wisart.kuaileshifu.com/v1'), true);
    assert.equal(local.isWisartApiBaseUrl('https://l0veyou.com/v1'), false);
    assert.equal(local.isByndProxiedApiBaseUrl('https://l0veyou.com/v1'), true);
    assert.match(local.getApiProxyHint('https://l0veyou.com/v1'), /固定代理连接 l0veyou\.com/);

    const production = settingsHarness('bynd.ccwu.cc', 'https:');
    assert.equal(production.resolveByndApiBaseUrl('https://l0veyou.com/v1'), 'https://bynd.ccwu.cc/mcp/relay/l0veyou/v1');
    assert.equal(production.resolveByndApiBaseUrl('https://wisart.kuaileshifu.com/v1'), 'https://bynd.ccwu.cc/mcp/relay/wisart/v1');
});

test('the Worker route table and the web resolver agree on every pinned proxy', () => {
    const toml = fs.readFileSync(path.join(root, 'workers/wrangler.toml'), 'utf8');
    for (const prefix of ['wisart', 'l0veyou', 'jev']) {
        assert.match(toml, new RegExp(`pattern = "bynd\\.ccwu\\.cc/${prefix}/\\*"`), `${prefix} needs a production route`);
        assert.match(workerSource, new RegExp(`\\['/${prefix}', \\{`), `${prefix} needs a pinned upstream`);
    }
});

test('Jev proxy is pinned to TypeSafe System One and never stores the user key', async () => {
    const { default: worker } = await workerModule;
    const realFetch = globalThis.fetch;
    const upstreamCalls = [];
    globalThis.fetch = async (url, init) => {
        upstreamCalls.push({ url:String(url), init });
        return new Response(JSON.stringify({ answers:{ decision:{ type:'choice', choice:'silence' } } }), { headers:{ 'Content-Type':'application/json' } });
    };
    try {
        const url = 'https://bynd.ccwu.cc/mcp/relay/jev/v1/systemone';
        const headers = { Origin:'https://bynd.ccwu.cc', Authorization:'Bearer example-user-key', 'Content-Type':'application/json' };
        const response = await worker.fetch(new Request(url,{ method:'POST', headers, body:'{"model":"jev-latest","state":{},"questions":{}}' }),{});
        assert.equal(response.status,200);
        assert.equal(upstreamCalls[0].url,'https://api.typesafe.ai/v1/systemone');
        assert.equal(upstreamCalls[0].init.headers.get('Authorization'),'Bearer example-user-key');
        assert.equal((await response.json()).answers.decision.choice,'silence');
        assert.equal((await worker.fetch(new Request(url.replace('/v1/systemone','/v1/chat/completions'),{ method:'POST', headers, body:'{}' }),{})).status,404);
        assert.equal((await worker.fetch(new Request(url,{ method:'POST', headers:{ ...headers, Origin:'https://evil.example' }, body:'{}' }),{})).status,403);
        assert.equal(upstreamCalls.length,1);
    } finally { globalThis.fetch = realFetch; }
});

test('the Worker proxies only the documented l0veyou endpoints with CORS, passes streams through, and keeps keys client-provided', async () => {
    const { default: worker } = await workerModule;
    const upstreamCalls = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
        upstreamCalls.push({ url: String(url), init });
        if (String(url).endsWith('/v1/chat/completions')) {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n'));
                    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                    controller.close();
                }
            });
            return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Set-Cookie': 'leak=1' } });
        }
        return new Response(JSON.stringify({ data: [{ id: 'model-a' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    try {
        const origin = 'https://bynd.ccwu.cc';
        const preflight = await worker.fetch(new Request('https://bynd.ccwu.cc/mcp/relay/l0veyou/v1/chat/completions', {
            method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' }
        }), {});
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
        assert.equal(upstreamCalls.length, 0, 'preflights never reach the upstream');

        const chat = await worker.fetch(new Request('https://bynd.ccwu.cc/mcp/relay/l0veyou/v1/chat/completions', {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: 'Bearer user-key', Accept: 'text/event-stream', Cookie: 'session=abc' },
            body: JSON.stringify({ model: 'model-a', stream: true, messages: [] })
        }), {});
        assert.equal(chat.status, 200);
        assert.equal(chat.headers.get('Content-Type'), 'text/event-stream');
        assert.equal(chat.headers.get('Access-Control-Allow-Origin'), origin);
        assert.equal(chat.headers.get('Set-Cookie'), null, 'upstream cookies are not relayed');
        assert.equal(await chat.text(), 'data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n');
        assert.equal(upstreamCalls[0].url, 'https://l0veyou.com/v1/chat/completions');
        assert.equal(upstreamCalls[0].init.headers.get('Authorization'), 'Bearer user-key');
        assert.equal(upstreamCalls[0].init.headers.get('Accept'), 'text/event-stream');
        assert.equal(upstreamCalls[0].init.headers.get('Cookie'), null);
        assert.equal(upstreamCalls[0].init.headers.get('Origin'), null);

        const models = await worker.fetch(new Request('https://bynd.ccwu.cc/mcp/relay/l0veyou/v1/models', { headers: { Origin: 'http://127.0.0.1:8771', Authorization: 'Bearer k' } }), {});
        assert.equal(models.status, 200);
        assert.equal(models.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:8771');
        assert.equal(upstreamCalls.at(-1).url, 'https://l0veyou.com/v1/models');

        const denied = await worker.fetch(new Request('https://bynd.ccwu.cc/mcp/relay/l0veyou/v1/models', { headers: { Origin: 'https://evil.example' } }), {});
        assert.equal(denied.status, 403);
        const unknown = await worker.fetch(new Request('https://bynd.ccwu.cc/mcp/relay/l0veyou/v1/embeddings', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' }), {});
        assert.equal(unknown.status, 404);
        const wrongMethod = await worker.fetch(new Request('https://bynd.ccwu.cc/mcp/relay/l0veyou/v1/models', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' }), {});
        assert.equal(wrongMethod.status, 405);
        const wisart = await worker.fetch(new Request('https://bynd.ccwu.cc/mcp/relay/wisart/v1/chat/completions', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' }), {});
        assert.equal(wisart.status, 404, 'Wisart keeps its image-only route table');
        assert.equal(upstreamCalls.length, 2, 'rejected requests never reach any upstream');
    } finally {
        globalThis.fetch = realFetch;
    }
});

test('pinned proxies also answer under bynd.ccwu.cc/mcp/relay so the page never shows the workers.dev host', async () => {
    const { default: worker } = await workerModule;
    const realFetch = globalThis.fetch;
    const upstreamCalls = [];
    globalThis.fetch = async url => { upstreamCalls.push(String(url)); return new Response('{"answers":{"d":{"type":"noul","noul":0.9}}}', { headers:{ 'Content-Type':'application/json' } }); };
    try {
        const headers = { Origin:'https://bynd.ccwu.cc', Authorization:'Bearer k', 'Content-Type':'application/json' };
        const relay = await worker.fetch(new Request('https://bynd.ccwu.cc/mcp/relay/jev/v1/systemone', { method:'POST', headers, body:'{}' }), {});
        assert.equal(relay.status, 200);
        assert.equal(upstreamCalls[0], 'https://api.typesafe.ai/v1/systemone');
        assert.equal((await worker.fetch(new Request('https://bynd.ccwu.cc/mcp/relay/unknown/v1/x', { method:'POST', headers, body:'{}' }), {})).status, 404);
        assert.equal((await worker.fetch(new Request('https://bynd.ccwu.cc/mcp/anything', { method:'POST', headers, body:'{}' }), {})).status, 404);
    } finally { globalThis.fetch = realFetch; }
    for (const file of ['modules/decision/jev.js', 'settings.js']) {
        assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /workers\.dev/, `${file} must not expose the Worker host`);
    }
});
