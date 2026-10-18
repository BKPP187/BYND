'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/rich-message-security');
(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await page.route('https://**/*', route => route.abort());
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof renderMessageBubble === 'function');
        await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
        await page.evaluate(async () => {
            await window.__byndCoreReady; await byndStylesReady;
            localStorage.setItem('bynd_security_canary', 'fixture-secret');
            window.__byndSecurityReads = [];
            window.securityCardRole = { id: 'security-fixture', name: '测试角色', history: [], chatConfig: {}, regex: [] };
            window.myCharacters = [securityCardRole]; unlockPhone(); ByndBuiltinLibrary?.close();
            openApp('wechat'); openChat(securityCardRole.id);
            const host = document.createElement('div'); host.id = 'security-card-host'; document.getElementById('chat-room-content').appendChild(host);
            const payloads = [
                '<div>脚本卡片<script>try{parent.__byndSecurityReads.push(localStorage.getItem("bynd_security_canary"))}catch(e){}</script></div>',
                '<div><button onclick="parent.__byndSecurityReads.push(parent.localStorage.getItem(\'bynd_security_canary\'))">unsafe click</button></div>',
                '<span onmouseover="parent.__byndSecurityReads.push(parent.localStorage.getItem(\'bynd_security_canary\'))">unsafe inline</span>',
                '<div><img src="invalid-fixture-image" onerror="parent.__byndSecurityReads.push(parent.localStorage.getItem(\'bynd_security_canary\'))"></div>'
            ];
            for (const content of payloads) renderMessageBubble(host, { type: 'text', content, isMe: false }, '', securityCardRole, 0);
        });
        await page.waitForTimeout(200);
        await page.locator('#security-card-host button').evaluateAll(elements => elements.forEach(el => el.click()));
        await page.locator('#security-card-host [onmouseover]').evaluateAll(elements => elements.forEach(el => el.dispatchEvent(new MouseEvent('mouseover'))));
        assert.deepEqual(await page.evaluate(() => __byndSecurityReads), [], 'untrusted messages must not read the host storage from scripts, handlers or inline HTML');
        const frames = page.locator('#security-card-host iframe.wc-rich-frame');
        assert.equal(await frames.count(), 4, 'all authored HTML is isolated before it reaches the host DOM');
        for (const frame of await frames.all()) {
            assert.equal(await frame.getAttribute('sandbox'), 'allow-scripts');
            assert.equal(await frame.getAttribute('referrerpolicy'), 'no-referrer');
            const child = await (await frame.elementHandle()).contentFrame();
            assert.deepEqual(await child.evaluate(() => {
                const blocked = fn => { try { fn(); return false; } catch (_) { return true; } };
                return [blocked(() => parent.document.body), blocked(() => parent.localStorage), blocked(() => localStorage.getItem('bynd_security_canary'))];
            }), [true, true, true]);
            await child.locator('button').evaluateAll(elements => elements.forEach(el => el.click()));
            await child.locator('[onmouseover]').evaluateAll(elements => elements.forEach(el => el.dispatchEvent(new MouseEvent('mouseover'))));
        }
        assert.deepEqual(await page.evaluate(() => __byndSecurityReads), []);
        await page.evaluate(() => {
            const host = document.getElementById('security-card-host');
            host.replaceChildren();
            renderMessageBubble(host, { type: 'text', isMe: false, content: '<style>.demo{padding:16px;border:1px solid #ddd;border-radius:12px}button{padding:10px}details{margin-top:12px}</style><div class="demo"><b>互动卡片</b><p>内容在隔离环境里显示。</p><button id="counter" onclick="this.textContent=\'已点击\'">点我</button><details><summary>展开详情</summary><p>这是展开后的内容。</p></details></div>' }, '', securityCardRole, 0);
        });
        const interactive = await (await page.locator('#security-card-host iframe').elementHandle()).contentFrame();
        await page.waitForFunction(() => parseFloat(document.querySelector('#security-card-host iframe').style.height) > 120);
        await interactive.locator('#counter').click();
        await interactive.waitForFunction(() => document.getElementById('counter').textContent === '已点击', null, { timeout: 3000 });
        await interactive.locator('summary').click();
        await interactive.waitForFunction(() => document.querySelector('details').open);
        for (const width of [320, 390, 430]) {
            await page.setViewportSize({ width, height: 844 });
            await page.waitForTimeout(80);
            const bounds = await page.locator('#security-card-host iframe').boundingBox();
            assert.ok(bounds.width > 0 && bounds.width <= width && bounds.height > 120 && bounds.height <= 1200, JSON.stringify(bounds));
            await page.screenshot({ path: path.join(output, `card-${width}.png`), animations: 'disabled' });
        }
        // A forged host message has neither the frame source nor its channel.
        const height = await page.locator('#security-card-host iframe').evaluate(el => el.style.height);
        await page.evaluate(() => dispatchEvent(new MessageEvent('message', { origin: 'null', source: window, data: { type: 'bynd-rich-size', channel: 'forged', height: 1200 } })));
        assert.equal(await page.locator('#security-card-host iframe').evaluate(el => el.style.height), height);
        // Native mode blocks authored JS because Android bridges exist in all frames.
        await page.evaluate(() => {
            window.ByndAndroid = {};
            const host = document.getElementById('security-card-host'); host.replaceChildren();
            renderMessageBubble(host, { type: 'text', isMe: false, content: '<div class="encrypted-section"><p>可见正文</p><div class="encrypted-overlay"><button class="decrypt-button" onclick="decryptContent(this);window.nativeAttack=1">解密</button></div></div><script>window.nativeAttack=1</script><a href="https://evil.example">不能跳转到外部页</a>' }, '', securityCardRole, 0);
        });
        const native = await (await page.locator('#security-card-host iframe').elementHandle()).contentFrame();
        await native.locator('.decrypt-button').click();
        await native.locator('.encrypted-overlay').waitFor({ state: 'hidden' });
        assert.equal(await native.evaluate(() => window.nativeAttack || 0), 0);
        assert.equal(await native.locator('script').count(), 1, 'only the nonced runtime executes in native mode');
        const nativeUrl = await native.evaluate(() => location.href); await native.locator('a').click();
        await page.waitForTimeout(80); assert.equal(await native.evaluate(() => location.href), nativeUrl);
        assert.equal(await native.locator('.encrypted-section').count(), 1);
        await page.evaluate(() => {
            const host = document.getElementById('security-card-host'); host.replaceChildren();
            const maliciousRole = { ...securityCardRole, chatConfig: { fontSize: '15px;" onmouseover="window.__byndSecurityReads.push(\'font\')' } };
            renderMessageBubble(host, { type: 'text', isMe: false, content: '普通文字' }, '', maliciousRole, 0);
            renderMessageBubble(host, { type: 'image', isMe: false, content: 'broken" onerror="window.__byndSecurityReads.push(\'image\')' }, '', securityCardRole, 1);
        });
        assert.equal(await page.locator('#security-card-host [onmouseover]').count(), 0);
        assert.equal(await page.locator('#security-card-host [onerror]').evaluateAll(elements => elements.some(el => el.getAttribute('onerror').includes('__byndSecurityReads'))), false);
        assert.equal(await page.locator('#security-card-host .wc-text-bubble').evaluate(el => el.style.fontSize), '15px');
        assert.deepEqual(await page.evaluate(() => __byndSecurityReads), []);
        console.log('Rich messages cannot execute scripts or event handlers in the host page.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
