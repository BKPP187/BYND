const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.qa-screenshots/character-voice-send'); fs.mkdirSync(output, { recursive: true });
const wav = Buffer.alloc(44 + 32000 * 5); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const calls = [], errors = []; let status = 200;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname.includes('/text-to-speech/')) {
            calls.push({ id: url.pathname.split('/').at(-1), body: route.request().postDataJSON() });
            if (status === 200) return route.fulfill({ status, contentType: 'audio/wav', body: wav });
            return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ detail: { type: 'payment_required', code: 'subscription_required', message: 'Free users cannot use library voices via the API.' } }) });
        }
        return route.abort();
    });
    await page.addInitScript(version => {
        localStorage.setItem('bynd_lastSeenVersion', version); localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        if (!localStorage.getItem('my_api_data')) localStorage.setItem('my_api_data', JSON.stringify({ elevenLabsVoiceApi: { enabled: true, apiKey: 'send-test-key', voiceId: 'voice-a', voiceModel: 'eleven_multilingual_v2', voiceEndpoint: 'https://relay.invalid/v1/text-to-speech/voice-a', baseUrl: 'https://api.elevenlabs.io' } }));
        if (!localStorage.getItem('my_characters_data')) localStorage.setItem('my_characters_data', JSON.stringify(['a', 'b'].map(id => ({ id, name: `${id}测试员`, history: [], chatConfig: { voiceBinding: { provider: 'elevenlabs', voiceId: `voice-${id}`, voiceModel: 'eleven_multilingual_v2' } } }))));
    }, require('./bump-version.cjs').currentVersion());
    const ready = async () => {
        await page.waitForFunction(() => window.__byndCoreReady && window.queueWechatCharacterVoiceAudio);
        await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); openApp('wechat'); });
    };
    const send = async id => {
        await page.evaluate(id => {
            openChat(id); const char = myCharacters.find(char => char.id === id);
            appendWechatAiMessageParts(char, null, '[微信语音:5|收到，这是测试语音，听得清吗？]');
        }, id);
        await page.waitForFunction(id => {
            const msg = myCharacters.find(char => char.id === id).history.at(-1);
            return msg?.type === 'voice' && (msg.audioUrl || msg.voiceAudioState === 'failed');
        }, id);
    };
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' }); await ready();
        await send('a'); await send('b');
        assert.deepEqual(calls.map(call => call.id), ['voice-a', 'voice-b']);
        assert.equal(await page.locator('.msg-voice-bubble.has-audio').count(), 1);
        await page.locator('.msg-voice-bubble.has-audio').click();
        await page.waitForFunction(() => document.querySelector('.msg-voice-bubble audio')?.paused === false);
        status = 402; await send('b');
        const failed = page.locator('.msg-voice-bubble').filter({ hasText: '语音生成失败' });
        await failed.waitFor(); assert.match(await failed.innerText(), /Free 套餐不能通过 API 生成社区音色/);
        assert.match(await failed.innerText(), /subscription_required/);
        assert.equal(await failed.locator('audio').count(), 0);
        assert.equal(await failed.getByRole('button', { name: '重试生成语音' }).count(), 1);
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await page.evaluate(() => openChat('b'));
        await failed.waitFor(); assert.match(await failed.innerText(), /付费套餐/);
        const count = calls.length; await page.waitForTimeout(250); assert.equal(calls.length, count, 'opening failed history must not trigger paid retries');
        for (const theme of ['wechat', 'pixel']) for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await page.evaluate(theme => selectWechatUiTheme(theme), theme);
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => {
                document.documentElement.classList.add('mobile-runtime'); document.body.style.paddingTop = owner === 'parent' ? `${safe}px` : '0';
                const phone = document.querySelector('.phone-container'); phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? `${safe}px` : '0'); phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
            }, { safe, owner });
            const geometry = await failed.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, overflow: el.scrollWidth - el.clientWidth }; });
            assert.ok(geometry.left >= 0 && geometry.right <= width && geometry.overflow <= 1, JSON.stringify(geometry));
            await page.screenshot({ path: path.join(output, `${theme}-${width}-${safe}-${owner}.png`) });
        }
        status = 200;
        await page.evaluate(() => { myCharacters.find(char => char.id === 'b').chatConfig.voiceBinding.voiceId = 'new-voice-b'; });
        await failed.getByRole('button', { name: '重试生成语音' }).click();
        await page.waitForFunction(() => myCharacters.find(char => char.id === 'b').history.at(-1)?.audioUrl);
        assert.equal(calls.at(-1).id, 'new-voice-b');
        assert.equal(await page.locator('.msg-voice-retry').count(), 0);
        assert.equal(await page.locator('.msg-voice-bubble.has-audio').count(), 2);
        await page.locator('.msg-voice-bubble.has-audio').last().click();
        await page.waitForFunction(() => [...document.querySelectorAll('.msg-voice-bubble audio')].at(-1)?.paused === false);
        assert.equal(await page.evaluate(() => getApiData().elevenLabsVoiceApi.voiceId), 'voice-a');
        // Existing role bindings must not turn a missing/disabled account into error cards.
        const beforeUnconfigured = calls.length;
        for (const missing of ['key', 'enabled', 'binding']) {
            await page.evaluate(missing => {
                const api = getApiData(); api.elevenLabsVoiceApi.apiKey = missing === 'key' ? '' : 'send-test-key'; api.elevenLabsVoiceApi.enabled = missing !== 'enabled'; saveApiData(api);
                const char = myCharacters.find(char => char.id === 'b');
                char.chatConfig.voiceBinding = missing === 'binding' ? null : { provider: 'elevenlabs', voiceId: 'new-voice-b' };
                appendWechatAiMessageParts(char, null, '[微信语音:5|宝宝，这是没有配置语音服务时的文字语音。]');
            }, missing);
            const plain = page.locator('.msg-voice-bubble').last();
            assert.equal(await plain.locator('audio, .msg-voice-retry, .msg-voice-generation').count(), 0);
            assert.equal(await plain.locator('.msg-voice-transcript').isVisible(), false);
            await plain.click();
            assert.equal(await plain.locator('.msg-voice-transcript').isVisible(), true);
            assert.match(await plain.locator('.msg-voice-transcript').innerText(), /没有配置语音服务/);
            await plain.click(); assert.equal(await plain.locator('.msg-voice-transcript').isVisible(), false);
        }
        assert.equal(calls.length, beforeUnconfigured, 'unconfigured voices must not issue any synthesis requests');
        await page.locator('.msg-voice-bubble').last().click();
        await page.screenshot({ path: path.join(output, 'unconfigured-pixel-transcript.png') });
        assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ calls, errors }, null, 2));
        console.log('Character voice send: distinct voice IDs, playback/retry, missing-key/disabled/unbound plain voices with click-to-expand text, no synthesis requests and 16 narrow-screen layouts passed.');
    } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }); throw error; }
    finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
