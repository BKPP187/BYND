const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.qa-screenshots/wechat-call-audio'); fs.mkdirSync(output, { recursive: true });
const wav = Buffer.alloc(44 + 16000 * 2); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 44; i < wav.length; i += 2) wav.writeInt16LE(Math.round(200 * Math.sin((i - 44) * Math.PI * 220 / 16000)), i);
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const requests = [], errors = []; let delay = false, failure = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.host === 'tts.fixture.invalid' || url.host === 'api.elevenlabs.io') {
            requests.push({ url: url.href, body: request.postDataJSON() });
            if (delay) await new Promise(resolve => setTimeout(resolve, 700));
            return failure ? route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ detail: { type: 'payment_required', code: 'insufficient_credits', message: 'Insufficient credits fixture-key' } }) }) : route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
        }
        return route.abort();
    });
    await page.addInitScript(version => {
        localStorage.setItem('bynd_lastSeenVersion', version); localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        localStorage.setItem('my_api_data', JSON.stringify({ voiceDefaultProvider: 'local', localVoiceApi: { enabled: true, endpoint: 'https://tts.fixture.invalid/speech', voiceFormat: 'wav', voiceId: 'global' }, elevenLabsVoiceApi: { enabled: true, baseUrl: 'https://api.elevenlabs.io', apiKey: 'fixture-key', voiceModel: 'eleven_multilingual_v2', voiceId: 'global-eleven' } }));
        localStorage.setItem('my_characters_data', JSON.stringify([{ id: 'a', name: '全局声音测试员', history: [], chatConfig: {} }, { id: 'b', name: '角色声音测试员', history: [], chatConfig: { voiceBinding: { provider: 'elevenlabs', voiceId: 'role-b', voiceModel: 'eleven_v3' } } }]));
        const NativeAudio = window.Audio; window._qaAudioPlayers = []; window._qaAudioStarts = 0;
        window.Audio = class extends NativeAudio { constructor(...args) { super(...args); window._qaAudioPlayers.push(this); } play() { if ((this.src || '').length > 100) window._qaAudioStarts++; return super.play(); } };
    }, require('./bump-version.cjs').currentVersion());
    const waitPlayed = () => page.waitForFunction(() => document.querySelector('#wc-call-log .assistant[data-voice-state="played"]'));
    const prepare = async (id, type) => {
        await page.evaluate(({ id, type }) => { openApp('wechat'); openChat(id); window._qaReply = '[接听]接电话。'; window._qaType = type; callChatApi = async () => ({ ok: true, content: window._qaReply }); callWechatImageGenerationApi = async () => ({ ok: false, error: '测试画面不调用生成接口' }); queueWechatAutoReplyToChar = () => {}; const button = document.createElement('button'); button.id = 'qa-call-start'; button.textContent = '开始测试通话'; button.style.cssText = 'position:fixed;top:5px;left:5px;z-index:999999'; button.onclick = () => startWechatCall(window._qaType); document.body.append(button); }, { id, type });
        await page.locator('#qa-call-start').click(); await page.evaluate(() => document.getElementById('qa-call-start').remove());
        await page.waitForFunction(() => window._wechatActiveCall?.acceptedAt);
        await page.waitForFunction(() => document.querySelector('#wc-call-log .assistant[data-voice-state="playing"]'));
        assert.equal(await page.locator('#wc-call-typing').isVisible(), true);
        assert.equal(await page.locator('#wc-call-typing').innerText(), '对方正在说话…');
        await waitPlayed(); assert.equal(await page.locator('#wc-call-typing').isVisible(), false);
    };
    const send = async text => { await page.locator('#wc-call-input').fill(text); await page.locator('#wc-call-inputbar button').click(); };
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndWechatCallAudio);
        await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); });
        await prepare('a', 'voiceCall'); assert.equal(requests[0].body.text, '接电话。'); assert.equal(requests[0].body.voice, 'global');
        assert.equal(await page.evaluate(() => _qaAudioStarts), 1);
        await page.evaluate(() => { window._qaReply = '第一句。||第二句。'; callChatApi = () => new Promise(resolve => window._qaResolveCallReply = resolve); }); await send('老公');
        assert.equal(await page.locator('#wc-call-typing').isVisible(), true);
        assert.equal(await page.locator('#wc-call-typing').innerText(), '对方正在说话…');
        await page.screenshot({ path: path.join(output, 'tts-speaking-pending.png') });
        await page.evaluate(() => { window._qaResolveCallReply({ ok: true, content: window._qaReply }); callChatApi = async () => ({ ok: true, content: window._qaReply }); });
        await page.waitForFunction(() => document.querySelectorAll('#wc-call-log .assistant[data-voice-state="playing"]').length > 0);
        assert.equal(await page.locator('#wc-call-typing').isVisible(), true);
        assert.equal(await page.locator('#wc-call-typing').innerText(), '对方正在说话…');
        await page.waitForFunction(() => document.querySelectorAll('#wc-call-log .assistant[data-voice-state="played"]').length === 3);
        assert.deepEqual(requests.slice(1).map(request => request.body.text), ['第一句。', '第二句。']);
        assert.equal(await page.locator('#wc-call-typing').isVisible(), false);
        await page.evaluate(() => endWechatCall()); assert.equal(await page.evaluate(() => _qaAudioPlayers.every(audio => audio.paused)), true);
        await prepare('b', 'videoCall'); assert.equal(new URL(requests.at(-1).url).pathname, '/v1/text-to-speech/role-b'); assert.equal(requests.at(-1).body.model_id, 'eleven_v3');
        failure = true; await page.evaluate(() => window._qaReply = '失败也要有提示。'); await send('测试失败');
        await page.waitForFunction(() => document.querySelector('#wc-call-log [data-voice-state="failed"]'));
        assert.match(await page.locator('#wc-call-log .assistant').last().innerText(), /积分不足/); assert.doesNotMatch(await page.locator('#wc-call-log .assistant').last().innerText(), /fixture-key/);
        failure = false; const countBeforeRetry = requests.length;
        await page.locator('.wc-call-voice-action').click(); await page.waitForFunction(() => document.querySelectorAll('#wc-call-log .assistant[data-voice-state="played"]').length === 2);
        assert.equal(requests.length, countBeforeRetry + 1);
        // Inspect both call layouts with header-owned and parent-owned iPhone safe areas.
        for (const type of ['voiceCall', 'videoCall']) {
            await page.evaluate(() => endWechatCall()); await prepare('b', type);
            for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
                await page.setViewportSize({ width, height: 844 });
                await page.evaluate(({ safe, owner }) => { document.documentElement.classList.add('mobile-runtime'); document.body.style.paddingTop = owner === 'parent' ? `${safe}px` : '0'; const phone = document.querySelector('.phone-container'); phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? `${safe}px` : '0'); phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh'; }, { safe, owner });
                await page.evaluate(() => setWechatCallTyping(true));
                assert.equal(await page.locator('#wc-call-typing').innerText(), '对方正在说话…');
                const geometry = await page.locator('#wc-call-inputbar').evaluate(el => { const r = el.getBoundingClientRect(), p = el.closest('.phone-container').getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom, parentBottom: p.bottom, overflow: el.scrollWidth - el.clientWidth }; });
                assert.ok(geometry.left >= 0 && geometry.right <= width && geometry.bottom <= geometry.parentBottom && geometry.overflow <= 1, JSON.stringify(geometry));
                await page.screenshot({ path: path.join(output, `${type}-${width}-${safe}-${owner}.png`) });
                await page.evaluate(() => setWechatCallTyping(false));
            }
        }
        // A character farewell is spoken fully before the call closes.
        await page.evaluate(() => { window._qaReply = '晚安，我先挂了。'; window._qaVoiceCountBeforeEnd = _qaAudioStarts; }); await send('晚安');
        await page.waitForFunction(() => _qaAudioStarts > window._qaVoiceCountBeforeEnd);
        assert.equal(await page.evaluate(() => !!window._wechatActiveCall), true);
        await page.waitForFunction(() => !window._wechatActiveCall); assert.equal(await page.evaluate(() => _qaAudioPlayers.every(audio => audio.paused)), true);
        // Hanging up during synthesis cannot play the late response.
        await prepare('a', 'voiceCall'); delay = true; await page.evaluate(() => window._qaReply = '晚到的声音。'); const beforeLate = await page.evaluate(() => _qaAudioStarts);
        await send('挂断测试'); await page.waitForFunction(() => document.querySelector('#wc-call-log .assistant[data-voice-state="pending"]'));
        await page.evaluate(() => endWechatCall()); await page.waitForTimeout(850); assert.equal(await page.evaluate(() => _qaAudioStarts), beforeLate); delay = false;
        // Incoming calls are primed by the accept gesture too.
        await page.evaluate(() => { const char = myCharacters.find(char => char.id === 'b'); handleWechatIncomingCall(char, { type: 'voiceCall', isMe: false, status: '来电', reason: '你在吗？', timestamp: Date.now() }); });
        await page.locator('#wc-call-island .accept').click(); await waitPlayed(); assert.equal(new URL(requests.at(-1).url).pathname, '/v1/text-to-speech/role-b'); await page.evaluate(() => endWechatCall());
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ requests, errors, actualAudioStarts: await page.evaluate(() => _qaAudioStarts) }, null, 2));
        console.log('Call TTS: real audio in voice/video/incoming calls, global/role voices, ordered replies, failure+retry, farewell-before-close and no late sound after hangup; 16 narrow safe-area screenshots passed (mock providers).');
    } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }); throw error; }
    finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
