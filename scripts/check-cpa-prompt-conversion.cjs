'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
if (!process.env.BYND_CPA_CONFIG) throw Error('Set BYND_CPA_CONFIG; credentials are kept in memory and never printed.');
const config = fs.readFileSync(process.env.BYND_CPA_CONFIG, 'utf8');
const section = config.match(/^api-keys:\s*\r?\n([\s\S]*?)(?=^[A-Za-z]|$(?![\s\S]))/m)?.[1] || '';
const apiKey = section.match(/^\s*-\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!apiKey) throw Error('No local client key found.');
const root = path.resolve(__dirname, '..');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const attempts = [];
    await page.route('http://127.0.0.1:8317/v1/chat/completions', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        const request = route.request().postDataJSON();
        const started = Date.now();
        const response = await route.fetch({ timeout: 95000 });
        const json = await response.json();
        const message = json.choices?.[0]?.message;
        attempts.push({
            status: response.status(), model: request.model, maxTokens: request.max_tokens,
            elapsedMs: Date.now() - started, finishReason: json.choices?.[0]?.finish_reason || '',
            contentChars: typeof message?.content === 'string' ? message.content.length : null,
            reasoningChars: typeof message?.reasoning_content === 'string' ? message.reasoning_content.length : null,
            completionTokens: json.usage?.completion_tokens ?? null,
            reasoningTokens: json.usage?.completion_tokens_details?.reasoning_tokens ?? json.usage?.completion_thinking_tokens ?? null
        });
        await route.fulfill({ response });
    });
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof convertTextToNovelAiPrompt === 'function');
        const result = await page.evaluate(async apiKey => {
            await window.__byndCoreReady;
            getDefaultApi = () => ({ name: 'Local diagnostic', baseUrl: 'http://127.0.0.1:8317/v1', apiKey, model: 'kimi-k2.7' });
            const result = await convertTextToNovelAiPrompt('海边日落风景，橙色天空、平静海面、远处白色帆船，没有人物。');
            return { ok: result.ok, hasTags: !!result.prompt, error: result.error || '', finishReason: result.finishReason || '' };
        }, apiKey);
        assert.ok(attempts.length >= 1 && attempts.length <= 2);
        assert.equal(attempts[0].maxTokens, 900, 'Use the existing production conversion parameters');
        console.log(JSON.stringify({ scenario: 'sunset scenery, no people', result, attempts }, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
