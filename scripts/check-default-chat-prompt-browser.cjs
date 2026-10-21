'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/default-chat-prompt');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const requests = [], errors = [];
    let fail = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://default-prompt-fixture.invalid/**', async route => {
        const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        requests.push(route.request().postDataJSON());
        await route.fulfill({ status: fail ? 503 : 200, headers, contentType: 'application/json', body: JSON.stringify(fail
            ? { error: { message: 'fixture relay unavailable' } }
            : { choices: [{ message: { content: '我也想你了|||刚刚还在想什么时候能见你' }, finish_reason: 'stop' }] }) });
    });
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof buildMessages === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady; await window._wechatCharactersLoadPromise;
            unlockPhone(); window.ByndBuiltinLibrary?.close();
            document.documentElement.classList.add('mobile-runtime');
            localStorage.removeItem('my_presets_data');
            const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#bdc7d1"/></svg>');
            window.myCharacters = [{ id: 'default-prompt-proof', name: '林间', avatar, description: '性格寡言的摄影师，讲话直接。', worldBook: [{ key: '居所', content: '住在海边。' }], chatConfig: {}, history: [{ type: 'text', isMe: true, content: '我想你了', timestamp: Date.now() }] }];
            openApp('wechat'); openChat('default-prompt-proof');
        });
        await page.addStyleTag({ content: '.tapfx-layer { visibility:hidden !important; }' });
        const send = () => page.evaluate(async () => {
            const char = window.myCharacters[0];
            return callChatApi(buildMessages(char, char.history), { apiOverride: { baseUrl: 'https://default-prompt-fixture.invalid/v1', model: 'fixture' }, stream: false, skipStatusValidationRetry: true });
        });
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(theme => theme.id));
        for (const theme of themes) {
            await page.evaluate(theme => selectWechatUiTheme(theme), theme);
            const result = await send();
            assert.equal(result.ok, true, theme);
            const body = requests.at(-1);
            const system = body.messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
            assert.match(system, /【BYND 默认角色互动】/);
            assert.match(system, /虚构作品里的描写不等于赞同/);
            assert.match(system, /寡言的摄影师/);
            assert.match(system, /住在海边/);
            assert.doesNotMatch(system, /不需要用户先导入预设/);
            assert.ok(!body.stream, 'Non-streaming requests include the defaults too');
        }
        await page.evaluate(() => {
            const char = window.myCharacters[0];
            char.history.push({ type: 'text', isMe: false, content: '我也想你了', timestamp: Date.now() });
            refreshChatView(char);
        });
        for (const width of [320, 375]) {
            await page.setViewportSize({ width, height: 844 });
            await page.screenshot({ path: path.join(output, `chat-${width}.png`) });
        }
        await page.evaluate(() => localStorage.setItem('my_presets_data', JSON.stringify({ activeId: 'custom', presets: [{ id: 'custom', prompts: [{ enabled: true, content: '自定义测试正文 {{char}}' }], temperature: 0.8, max_tokens: 1800 }] })));
        assert.equal((await send()).ok, true);
        const custom = requests.at(-1).messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        assert.match(custom, /自定义测试正文 林间/);
        assert.doesNotMatch(custom, /【BYND 默认角色互动】/);
        fail = true;
        const failure = await send();
        assert.equal(failure.ok, false);
        assert.equal(failure.httpStatus, 503);
        assert.deepEqual(errors, []);
        console.log(`Default prompt wire checks passed: ${themes.length} themes, non-streaming request bodies, custom preset selection, relay failure, and 320/375px screenshots. Mock responses verify transport only, not model behavior.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
