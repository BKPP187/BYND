const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root } = require('./helpers/harness.cjs');

function harness() {
    const requests = [];
    let respond = () => new Response(JSON.stringify({ choices: [{ message: { content: '你好' }, finish_reason: 'stop' }], usage: { prompt_tokens: 41, completion_tokens: 7, total_tokens: 48 } }), { status: 200 });
    const context = vm.createContext({
        window: { myCharacters: [] }, Response, TextDecoder, TextEncoder, AbortSignal, setTimeout, clearTimeout,
        console: { warn() {}, error() {}, log() {} },
        getDefaultApi: () => ({ baseUrl: 'https://example.invalid/v1', model: 'debug-model' }),
        fetch: async (_url, options) => { requests.push(JSON.parse(options.body)); return respond(); }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'core/api/chat-api.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'systems/usage/api-ticket.js'), 'utf8'), context);
    return { context, requests, setRespond: fn => { respond = fn; } };
}

test('API ticket preserves provider usage and identifies injected world-book content from sent messages', async () => {
    const h = harness();
    const char = { name: '阿宁', description: '图书管理员', history: Array.from({ length: 34 }, () => ({ content: '旧消息' })), worldBook: [
        { name: '图书馆', key: '图书馆', content: '图书馆夜间闭馆' },
        { name: '港口', key: '港口', content: '港口在城南' }
    ] };
    const messages = [
        { role: 'system', content: '你是阿宁。图书管理员。图书馆夜间闭馆。' },
        { role: 'user', content: '图书馆今天开吗？' }
    ];
    const collector = [];
    const result = await h.context.callChatApi(messages, { usageCollector: collector, usageChar: char, skipStatusValidationRetry: true });
    assert.equal(result.ok, true);
    assert.equal(collector.length, 1);
    assert.equal(collector[0].usage.total, 48);
    assert.equal(h.context.window.ByndApiTicket.totalFor(collector).total, 48);
    assert.equal(collector[0].worldbook[0].injected, true);
    assert.equal(collector[0].worldbook[0].keywordHit, true);
    assert.equal(collector[0].worldbook[1].injected, false);
    assert.equal(collector[0].historyTruncated, true);
    assert.equal(collector[0].rows[0].preview.includes('图书馆夜间闭馆'), true);
});

test('streaming requests collect the final usage chunk even when choices is empty', async () => {
    const h = harness();
    const enc = new TextEncoder();
    h.setRespond(() => new Response(new ReadableStream({
        start(controller) {
            controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"你好"},"finish_reason":"stop"}]}\n\n'));
            controller.enqueue(enc.encode('data: {"choices":[],"usage":{"prompt_tokens":20,"completion_tokens":3,"total_tokens":23}}\n\ndata: [DONE]\n\n'));
            controller.close();
        }
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    const collector = [];
    const result = await h.context.callChatApi([{ role: 'user', content: '早' }], { stream: true, usageCollector: collector, skipStatusValidationRetry: true });
    assert.equal(result.ok, true);
    assert.equal(h.requests[0].stream_options.include_usage, true);
    assert.equal(collector[0].usage.total, 23);
    assert.equal(collector[0].status, '完成');
});

test('unsupported stream usage option retries once and keeps both request records', async () => {
    const h = harness();
    let count = 0;
    h.setRespond(() => ++count === 1
        ? new Response(JSON.stringify({ error: { message: 'Unknown parameter: stream_options' } }), { status: 400 })
        : new Response(JSON.stringify({ choices: [{ message: { content: '好' }, finish_reason: 'stop' }] }), { status: 200 }));
    const collector = [];
    const result = await h.context.callChatApi([{ role: 'user', content: '早' }], { stream: true, usageCollector: collector, skipStatusValidationRetry: true });
    assert.equal(result.ok, true);
    assert.equal(h.requests.length, 2);
    assert.equal(h.requests[1].stream_options, undefined);
    assert.equal(collector[0].status, '失败');
    assert.equal(collector[1].status, '完成');
    assert.equal(h.context.window.ByndApiTicket.totalFor(collector).estimated, true);
});

test('ticket entry chooses black for light backgrounds and white for dark image pixels', () => {
    const h = harness();
    const colors = new Map();
    const content = {
        parentElement: null,
        addEventListener() {},
        querySelectorAll: () => [ticket],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 640 })
    };
    const ticket = {
        closest: () => content,
        getBoundingClientRect: () => ({ left: 50, top: 300, width: 160, height: 20 }),
        style: { setProperty: (name, value) => colors.set(name, value) }
    };
    h.context.getComputedStyle = () => ({ backgroundColor: 'rgb(245, 245, 245)', backgroundImage: 'none' });
    h.context.window.ByndApiTicket.syncEntryTone(ticket, { chatConfig: {} });
    assert.equal(colors.get('--bynd-api-ticket-fg'), '#17212b');

    const darkPixels = Uint8ClampedArray.from(Array.from({ length: 144 }, () => [15, 18, 22, 255]).flat());
    h.context.document = { createElement: () => ({
        height: 0,
        getContext: () => ({ drawImage() {}, getImageData: () => ({ data: darkPixels }) })
    }) };
    h.context.Image = class {
        naturalWidth = 320;
        naturalHeight = 640;
        set src(_value) { this.onload(); }
    };
    h.context.window.ByndApiTicket.syncEntryTone(ticket, { chatConfig: { chatBgImage: 'data:image/png;base64,mock' } });
    assert.equal(colors.get('--bynd-api-ticket-fg'), '#ffffff');
});
