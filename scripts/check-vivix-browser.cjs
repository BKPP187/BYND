'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/vivix');
fs.mkdirSync(output, { recursive: true });
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const audioBytes = Buffer.alloc(44 + 3200); audioBytes.write('RIFF'); audioBytes.writeUInt32LE(audioBytes.length-8,4); audioBytes.write('WAVEfmt ',8); audioBytes.writeUInt32LE(16,16); audioBytes.writeUInt16LE(1,20); audioBytes.writeUInt16LE(1,22); audioBytes.writeUInt32LE(16000,24); audioBytes.writeUInt32LE(32000,28); audioBytes.writeUInt16LE(2,32); audioBytes.writeUInt16LE(16,34); audioBytes.write('data',36); audioBytes.writeUInt32LE(3200,40);
const ttsAudio = 'data:audio/wav;base64,' + audioBytes.toString('base64');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), requests = [], errors = [];
    let bad = false, delayedCreate = false, failClose = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (!url.pathname.startsWith('/mcp/relay/vivix/')) return route.abort();
        const body = request.postDataJSON(); requests.push({ path: url.pathname, method: request.method(), body });
        if (bad) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"code":1}' });
        let data;
        if (url.pathname.endsWith('/v1/voices')) data = { voices: [{ voice_id: 'voice-a', name: '音色 A' }, { voice_id: 'voice-b', name: '音色 B' }] };
        else if (url.pathname.endsWith('/images')) data = { url: 'https://bynd.ccwu.cc/mcp/relay/vivix/images/' + 'a'.repeat(64) };
        else if (url.pathname.endsWith('/close')) {
            if (failClose) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":5}' });
            data = { status: 'closing' };
        } else if (url.pathname.endsWith('/sessions')) {
            if (delayedCreate) await new Promise(resolve => setTimeout(resolve, 900));
            data = { session_id: 'session-' + requests.length, control: { url: 'wss://api.vivix.ai/control', client_secret: 'ctl_mock' }, delivery: { media: { trtc: { sdk_app_id: '1', user_id: 'user', user_sig: 'mock', room_id: 'room', publisher_user_id: 'character' } } } };
        } else throw new Error('unexpected route ' + url.pathname);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data }) });
    });
    await page.addInitScript(({ version, png }) => {
        localStorage.setItem('bynd_lastSeenVersion', version); localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        localStorage.setItem('my_characters_data', JSON.stringify([{ id: 'vivix-a', name: '夜班医生', description: '医生', scenario: '医院值班室', history: [{ type: 'text', isMe: false, content: '我穿着白大褂在医院值班室，夜里有点困。' }], chatConfig: { imageReference: png } }]));
        window._qaRtc = []; window._qaEvents = []; window._qaRenderFailure = false;
        window.WebSocket = class {
            constructor(url) { this.url = url; this.readyState = 0; setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 5); }
            close() { this.readyState = 3; this.onclose?.(); }
            send(json) {
                const event = JSON.parse(json); window._qaEvents.push(event);
                const emit = data => this.onmessage?.({ data: JSON.stringify(data) });
                if (event.type === 'response.create') {
                    setTimeout(() => { if (window._qaRenderFailure) return emit({ type: 'error', error: { message: 'mock failure' } });
                        emit({ type: 'response.created', request_event_id: event.event_id, response: { id: event.event_id } });
                        setTimeout(() => emit({ type: 'response.done', response: { id: event.event_id, status: 'completed' } }), 30);
                    }, 10);
                } else if (event.type === 'avatar.add') setTimeout(() => emit({ type: 'avatar.added', avatars: event.avatars }), 5);
                else if (event.type === 'session.update') setTimeout(() => emit({ type: 'session.update.done', request_event_id: event.event_id, status: 'completed' }), 5);
            }
        };
        const EVENT = { AUTOPLAY_FAILED: 'autoplay', ERROR: 'error', REMOTE_VIDEO_AVAILABLE: 'video', FIRST_VIDEO_FRAME: 'frame' };
        window.TRTC = { EVENT, TYPE: { SCENE_RTC: 'rtc' }, create() {
            const handlers = {}, rtc = { destroyed: false, mic: false,
                on: (type, fn) => handlers[type] = fn,
                enterRoom: async options => { rtc.enterOptions = options; setTimeout(() => { if (!rtc.destroyed) handlers.video?.({ userId: 'character', streamType: 'main' }); }, 10); },
                muteRemoteAudio: async (userId, mute) => { rtc.remoteMuted = mute; },
                startRemoteVideo: async ({ view }) => {
                    document.getElementById(view).innerHTML = '<div style="height:100%;background:linear-gradient(#626d75,#19222b);display:grid;place-items:center;color:white;font-size:22px">模拟 RTC 视频帧</div>';
                    handlers.frame?.({ userId: 'character' });
                }, startLocalAudio: async () => { if (window._qaMicFailure) throw new Error('permission denied'); rtc.mic = true; }, stopLocalAudio: async () => { rtc.mic = false; },
                exitRoom: async () => { rtc.mic = false; }, destroy: () => { rtc.destroyed = true; } };
            window._qaRtc.push(rtc); return rtc;
        } };
    }, { version: require('./bump-version.cjs').currentVersion(), png });
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndVivix);
        await page.evaluate(async () => { await __byndCoreReady; unlockPhone(); openApp('settings'); openSettingsTab('video'); });
        await page.locator('#vivix-key').fill('browser-test-key'); await page.locator('.vivix-actions button').last().click();
        assert.equal(await page.evaluate(() => ByndVivix.selected(myCharacters[0])), true, 'saved global Vivix settings apply without a second per-role switch');
        await page.locator('#vivix-test').click(); await page.waitForFunction(() => document.getElementById('vivix-status').textContent.includes('连接成功'));
        assert.equal(requests.length, 1); assert.equal(requests[0].method, 'GET');
        assert.equal(await page.locator('#vivix-voices').evaluate(node => node.tagName), 'SELECT');
        assert.equal(await page.locator('#vivix-voices option').count(), 15, 'official built-ins and both account voices remain available');
        assert.match(await page.locator('#vivix-voices option[value="longanhuan_v3.6"]').innerText(), /女声.*活泼/);
        assert.match(await page.locator('#vivix-voices option[value="longchuanshu_v3.6"]').innerText(), /男声.*四川/);
        assert.match(await page.locator('#vivix-voices option[value="voice-b"]').innerText(), /性别未提供/);
        assert.equal(await page.locator('#vivix-voices').isEnabled(), true);
        await page.locator('#vivix-voices').click(); await page.keyboard.press('Escape');
        await page.locator('#vivix-voices').selectOption('voice-b');
        assert.equal(await page.locator('#vivix-voice').inputValue(), 'voice-b');
        await page.locator('.vivix-actions button').last().click(); await page.evaluate(() => ByndVivix.renderSettings());
        assert.equal(await page.locator('#vivix-voices').inputValue(), 'voice-b');
        assert.equal(await page.evaluate(() => ByndVivix.read().voiceId), 'voice-b');
        await page.locator('#vivix-voice').fill('manual-voice');
        assert.equal(await page.locator('#vivix-voices option').count(), 15);
        assert.equal(await page.locator('#vivix-voices').inputValue(), '');
        await page.locator('#vivix-voices').selectOption('voice-b'); await page.locator('.vivix-actions button').last().click();
        assert.equal(await page.evaluate(() => getBackupLocalStorageKeys().includes(ByndVivix.storageKey)), false);
        bad = true; await page.locator('#vivix-test').click(); await page.waitForFunction(() => document.getElementById('vivix-status').dataset.error === 'true');
        assert.doesNotMatch(await page.locator('#vivix-status').innerText(), /browser-test-key/); bad = false;
        assert.equal(await page.locator('#vivix-voices').isDisabled(), true);
        assert.equal(await page.locator('#vivix-voice').inputValue(), 'voice-b');
        await page.locator('#vivix-test').click(); await page.waitForFunction(() => document.getElementById('vivix-status').textContent.includes('连接成功'));
        await page.evaluate(() => ByndVivix.renderSettings());
        for (const width of [320,375]) for (const safe of [47,59]) for (const owner of ['parent','header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => {
                document.documentElement.classList.add('mobile-runtime'); document.body.style.paddingTop = owner === 'parent' ? safe + 'px' : '0';
                const phone = document.querySelector('.phone-container'); phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? safe + 'px' : '0');
                phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
                document.querySelector('#app-settings-window .window-content').scrollTop = 0;
            }, { safe, owner });
            await page.waitForTimeout(120);
            const geometry = await page.evaluate(() => {
                const close = document.querySelector('#app-settings-window .close-btn').getBoundingClientRect();
                const key = document.getElementById('vivix-key').getBoundingClientRect();
                const card = document.querySelector('.vivix-settings');
                return { top: close.top, left: key.left, right: key.right, overflow: card.scrollWidth - card.clientWidth };
            });
            assert.ok(geometry.top >= safe && geometry.left >= 0 && geometry.right <= width && geometry.overflow <= 1, JSON.stringify({ width,safe,owner,geometry }));
            await page.screenshot({ path: path.join(output, `settings-${width}-${safe}-${owner}.png`) });
            await page.locator('#vivix-voices').scrollIntoViewIfNeeded();
            await page.locator('#vivix-voice').scrollIntoViewIfNeeded();
            const voiceBounds = await page.locator('#vivix-voices').boundingBox();
            assert.ok(voiceBounds.x >= 0 && voiceBounds.x + voiceBounds.width <= width + 1 && voiceBounds.height >= 44);
            await page.screenshot({ path: path.join(output, `voice-picker-${width}-${safe}-${owner}.png`) });
            if (safe === 59 && owner === 'header') {
                for (const [gender, voice] of [['female', 'longanhuan_v3.6'], ['male', 'longchuanshu_v3.6']]) {
                    await page.locator('#vivix-voices').selectOption(voice);
                    assert.equal(await page.locator('#vivix-voice').inputValue(), voice);
                    await page.screenshot({ path: path.join(output, `voice-${gender}-${width}.png`) });
                }
                await page.locator('#vivix-voices').selectOption('voice-b');
            }
        }
        await page.evaluate(png => {
            openApp('wechat'); openChat('vivix-a'); queueWechatAutoReplyToChar = () => {};
            _qaTtsEnqueues = 0; const enqueue = ByndWechatCallAudio.enqueue;
            ByndWechatCallAudio.enqueue = (...args) => { _qaTtsEnqueues++; return enqueue(...args); };
            window._qaChatFailure = false; window._qaSceneChange = false; window._qaImageCount = 0; window._qaImageFailure = false;
            callChatApi = async (messages, options) => {
                window._qaChatRequest = { messages, options };
                if (window._qaChatFailure && messages.at(-1).content.includes('提取角色当前')) return { ok: false, error: window._qaChatFailure };
                if (messages.at(-1).content.includes('提取角色当前')) return { ok: true, content: JSON.stringify({ scene: '医院值班室，夜晚，白大褂，疲惫' }) };
                if (messages.at(-1).content.includes('你接吗')) return { ok: true, content: '[接听]刚下夜班，你还醒着？' };
                window._qaReplyRequests = (window._qaReplyRequests || 0) + 1;
                if (window._qaPlainReplies > 0) { window._qaPlainReplies--; return { ok: true, content: '我就在窗边。' }; }
                return { ok: true, content: JSON.stringify({ speech: '我去窗边看看。', action: '走到窗边，转头拿起杯子', scene: _qaSceneChange ? '医院走廊，夜晚，白大褂' : '', endCall: false }) };
            };
            callWechatImageGenerationApi = async (prompt, options) => { _qaImageCount++; window._qaImageOptions = options; return _qaImageFailure ? { ok: false, error: typeof _qaImageFailure === 'string' ? _qaImageFailure : 'mock image failure' } : { ok: true, url: png }; };
        }, png);
        const start = () => page.evaluate(() => startWechatCall('videoCall'));
        const ready = () => page.waitForFunction(() => _wechatActiveCall?.vivix?.ready && _wechatActiveCall.vivix.firstFrame && !document.getElementById('wc-call-ai-portrait-status').textContent);
        await start(); await ready();
        assert.equal(requests.filter(r => r.path.endsWith('/sessions')).length, 1);
        assert.equal(requests.find(r => r.path.endsWith('/sessions')).body.pipeline_config.tts_config.tts_voice_id, 'voice-b', 'the saved selection reaches the actual session request');
        assert.equal(await page.evaluate(() => _qaImageOptions.requireReference), true);
        assert.match(requests.find(r => r.path.endsWith('/sessions')).body.avatars[0].visual.source_images[0].description, /医院值班室.*白大褂/);
        await page.evaluate(() => sendWechatCallMessage('看看窗外')); assert.equal(requests.filter(r => r.path.endsWith('/sessions')).length, 1);
        assert.equal(await page.evaluate(() => _qaEvents.at(-1).response.script.visual.prompt), '走到窗边，转头拿起杯子');
        await page.locator('[data-wc-call-control=mute]').click(); assert.equal(await page.evaluate(() => _qaRtc.at(-1).mic), true);
        assert.equal(await page.locator('[data-wc-call-control=mute]').innerText(), '静音');
        const userLines = await page.evaluate(() => _wechatActiveCall.lines.filter(line => line.role === 'user').length);
        await page.evaluate(() => { document.getElementById('wc-call-input').value = '尚未发送的草稿'; _wechatActiveCall.vivix.ws.onmessage({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', transcript: '你累了吗？' }) }); });
        await page.waitForFunction(count => _wechatActiveCall.lines.filter(line => line.role === 'user').length > count && !_wechatActiveCall.busy, userLines);
        assert.equal(await page.locator('#wc-call-input').inputValue(), '尚未发送的草稿');
        await page.evaluate(() => _wechatActiveCall.vivix.ws.onmessage({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.failed' }) }));
        assert.match(await page.locator('#wc-call-log').innerText(), /语音识别失败/);
        assert.equal(await page.evaluate(() => _wechatActiveCall.vivix.ready), true);
        await page.locator('[data-wc-call-control=mute]').click(); assert.equal(await page.evaluate(() => _qaRtc.at(-1).mic), false);
        await page.evaluate(() => _wechatActiveCall.vivix.ws.onmessage({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', transcript: '静音时不可提交' }) }));
        assert.equal(await page.evaluate(() => _wechatActiveCall.lines.some(line => line.content === '静音时不可提交')), false);
        await page.evaluate(() => _qaMicFailure = true); await page.locator('[data-wc-call-control=mute]').click();
        assert.equal(await page.evaluate(() => _wechatActiveCall.muted), true);
        assert.match(await page.locator('#wc-call-log').innerText(), /浏览器权限/); await page.evaluate(() => _qaMicFailure = false);
        await page.evaluate(() => { _qaSceneChange = true; }); await page.evaluate(() => sendWechatCallMessage('去走廊')); await page.evaluate(() => _qaSceneChange = false);
        assert.equal(await page.evaluate(() => _qaEvents.filter(e => e.type === 'session.update').length), 1);
        assert.equal(requests.filter(r => r.path.endsWith('/sessions')).length, 1);
        // Exercise the reported JSON failure through the real call UI on every theme.
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(theme => theme.id));
        await page.setViewportSize({ width: 375, height: 844 });
        for (const theme of themes) {
            await page.evaluate(theme => { applyWechatUiTheme(theme, { update: false }); _qaPlainReplies = 2; }, theme);
            const before = await page.evaluate(() => ({ sent: _qaEvents.length, requests: _qaReplyRequests || 0 }));
            await page.evaluate(() => sendWechatCallMessage('啥地方呀'));
            assert.match(await page.locator('#wc-call-log').innerText(), /角色回复失败.*JSON/);
            assert.equal(await page.evaluate(() => _qaEvents.length), before.sent);
            assert.equal(await page.evaluate(() => _qaReplyRequests), before.requests + 2);
            await page.screenshot({ path: path.join(output, `json-error-${theme}-375.png`) });
            await page.evaluate(() => _qaPlainReplies = 1);
            await page.evaluate(() => sendWechatCallMessage('再说一次'));
            assert.equal(await page.evaluate(() => _qaEvents.length), before.sent + 1);
            assert.equal(await page.evaluate(() => _qaChatRequest.options.presetOverride), null);
            await page.screenshot({ path: path.join(output, `json-recovered-${theme}-375.png`) });
        }
        await page.evaluate(() => applyWechatUiTheme('default', { update: false }));
        for (const width of [320,375]) for (const safe of [47,59]) for (const owner of ['parent','header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => {
                document.body.style.paddingTop = owner === 'parent' ? safe + 'px' : '0'; const phone = document.querySelector('.phone-container');
                phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? safe + 'px' : '0');
                phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
            }, { safe, owner });
            const bounds = await page.locator('#wc-call-inputbar').evaluate(el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom }; });
            assert.ok(bounds.left >= 0 && bounds.right <= width && bounds.top >= safe && bounds.bottom <= 844, JSON.stringify(bounds));
            await page.screenshot({ path: path.join(output, `call-${width}-${safe}-${owner}.png`) });
        }
        await page.evaluate(() => _qaRenderFailure = true); await page.evaluate(() => sendWechatCallMessage('拿杯子'));
        assert.match(await page.locator('#wc-call-log').innerText(), /未能执行/); await page.evaluate(() => _qaRenderFailure = false);
        failClose = true; await page.evaluate(() => endWechatCall()); await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => _qaRtc.at(-1).destroyed), true);
        failClose = false; await page.evaluate(() => ByndVivix.retryClose());
        // Ordinary video retains the old image/TTS flow and creates no Vivix session.
        const count = requests.length; await page.evaluate(() => { myCharacters[0].chatConfig.videoCallProvider = 'ordinary'; });
        await start(); await page.waitForFunction(() => _wechatActiveCall?.acceptedAt); await page.waitForTimeout(80);
        assert.equal(requests.length, count); await page.evaluate(() => endWechatCall());
        // A late create result after hangup is closed and never joins RTC.
        delayedCreate = true; await page.evaluate(() => myCharacters[0].chatConfig.videoCallProvider = 'vivix');
        const rtcCount = await page.evaluate(() => _qaRtc.length); await start();
        await page.waitForFunction(() => document.getElementById('wc-call-ai-portrait-status').textContent.includes('创建实时会话'));
        await page.waitForTimeout(150); await page.evaluate(() => endWechatCall()); await page.waitForTimeout(1100);
        assert.equal(await page.evaluate(() => _qaRtc.length), rtcCount); assert.ok(requests.at(-1).path.endsWith('/close')); delayedCreate = false;
        // Scene preparation failure must not create a billable session.
        const beforeFailure = requests.filter(r => r.path.endsWith('/sessions')).length;
        await page.evaluate(() => _qaImageFailure = '生图服务不支持参考图编辑（HTTP 404）'); await start();
        await page.waitForFunction(() => _wechatActiveCall?.vivix?.failed);
        assert.match(await page.locator('#wc-call-log').innerText(), /开场场景生成失败/);
        assert.match(await page.locator('#wc-call-log').innerText(), /不支持参考图编辑.*404/);
        assert.match(await page.locator('#wc-call-log').innerText(), /原参考图重拨/);
        for (const width of [320,375]) for (const theme of themes) {
            await page.setViewportSize({ width, height:844 });
            await page.evaluate(theme => applyWechatUiTheme(theme, { update:false }), theme);
            await page.screenshot({ path:path.join(output, `image-error-${theme}-${width}.png`) });
        }
        await page.evaluate(() => applyWechatUiTheme('bynd', { update:false }));
        assert.equal(requests.filter(r => r.path.endsWith('/sessions')).length, beforeFailure); await page.evaluate(() => endWechatCall());
        // The reported black-screen scene error must retain the upstream reason
        // once and must not present a usable microphone before RTC connects.
        await page.evaluate(() => { _qaImageFailure = false; _qaChatFailure = 'API 额度不足 (429): insufficient quota'; }); await start();
        await page.waitForFunction(() => _wechatActiveCall?.vivix?.failed);
        const failedText = await page.locator('#wc-call-log').innerText();
        assert.match(failedText, /提取通话场景失败：API 额度不足 \(429\): insufficient quota/);
        assert.equal((failedText.match(/提取通话场景失败/g) || []).length, 1);
        assert.equal(await page.locator('#wc-call-ai-portrait-status').innerText(), 'AI 视频未连接');
        assert.equal(await page.locator('[data-wc-call-control=mute]').isDisabled(), true);
        assert.equal(await page.locator('[data-wc-call-control=mute]').innerText(), '未连接');
        assert.equal(requests.filter(r => r.path.endsWith('/sessions')).length, beforeFailure);
        const extraction = await page.evaluate(() => ({ messages: _qaChatRequest.messages, options: { stream:_qaChatRequest.options.stream, skipStatusValidationRetry:_qaChatRequest.options.skipStatusValidationRetry } }));
        assert.ok(extraction.messages.every(message => typeof message.content === 'string'));
        assert.equal(extraction.options.stream, false); assert.equal(extraction.options.skipStatusValidationRetry, true);
        await page.screenshot({ path:path.join(output,'scene-failure-375.png') });
        await page.evaluate(() => { myCharacters[0].chatConfig.userTitle = '大小姐'; endWechatCall(); _qaChatFailure = false; });
        assert.equal(await page.evaluate(() => myCharacters[0].history.filter(msg => msg.type === 'videoCall').at(-1).reason), '大小姐挂断了电话');
        await page.evaluate(() => {
            myCharacters[0].history.push({ type:'videoCall', isMe:false, status:'已结束', duration:97, reason:'用户挂断了电话', timestamp:Date.now() });
            refreshChatView(myCharacters[0]);
        });
        assert.ok((await page.locator('.msg-call-desc').allTextContents()).some(text => text.includes('1分37秒') && text.includes('大小姐挂断了电话')));
        await page.screenshot({ path:path.join(output,'hangup-remark-375.png') });
        // Disabling scene generation uses the reference and bypasses the failing
        // image API; it never silently changes the user's saved preference.
        const imageCount = await page.evaluate(() => _qaImageCount);
        await page.evaluate(() => { ByndVivix.write({ ...ByndVivix.read(), prepareScene:false }); _qaImageFailure = true; });
        await start(); await ready();
        assert.equal(await page.evaluate(() => _qaImageCount), imageCount);
        assert.equal(requests.filter(r => r.path.endsWith('/sessions')).length, beforeFailure + 1);
        await page.evaluate(() => { endWechatCall(); ByndVivix.write({ ...ByndVivix.read(), prepareScene:true }); _qaImageFailure = false; });
        // Character-originated video calls use the same selected provider.
        const ttsBeforeIncoming = await page.evaluate(() => _qaTtsEnqueues);
        await page.evaluate(() => { _qaImageFailure = false; const char = myCharacters.find(c => c.id === 'vivix-a'); char.chatConfig.videoCallProvider = 'inherit'; handleWechatIncomingCall(char, { type: 'videoCall', isMe: false, status: '来电', reason: '下夜班了，你在吗？', timestamp: Date.now() }); });
        assert.equal(await page.evaluate(() => ByndWechatCallRingtone.isAudible(_wechatIncomingCall)), true);
        const pendingIncoming = await page.evaluate(() => _wechatIncomingCall.id);
        await page.locator('#wc-call-screen .wc-call-answer').click(); await ready();
        assert.equal(await page.evaluate(() => _wechatActiveCall.videoProvider), 'vivix');
        assert.equal(await page.evaluate(() => ByndWechatCallRingtone.isRinging(_wechatActiveCall)), false);
        assert.equal(await page.evaluate(() => _qaTtsEnqueues), ttsBeforeIncoming);
        assert.equal(await page.evaluate(() => _wechatActiveCall.id), pendingIncoming);
        await page.evaluate(() => endWechatCall());
        // A desktop/island answer must reset even a visible stale ordinary screen.
        const beforeIsland = requests.filter(r => r.path.endsWith('/sessions')).length;
        await page.evaluate(() => {
            openApp('settings'); ensureWechatCallScreen().classList.remove('hidden', 'is-vivix-call');
            handleWechatIncomingCall(myCharacters[0], { type: 'videoCall', isMe: false, status: '来电', reason: '从桌面接听测试', timestamp: Date.now() });
        });
        assert.equal(await page.evaluate(() => ByndWechatCallRingtone.isAudible(_wechatIncomingCall)), true);
        await page.locator('#wc-call-island .accept').click(); await ready();
        assert.equal(requests.filter(r => r.path.endsWith('/sessions')).length, beforeIsland + 1);
        assert.equal(await page.evaluate(() => _wechatActiveCall.videoProvider), 'vivix');
        assert.equal(await page.evaluate(() => _qaTtsEnqueues), ttsBeforeIncoming);
        await page.evaluate(() => endWechatCall());
        // Rejecting ordinary voice/video incoming calls also stops local ringing.
        for (const type of ['voiceCall', 'videoCall']) {
            await page.evaluate(type => handleWechatIncomingCall(myCharacters[0], { type, isMe: false, status: '来电', timestamp: Date.now() }), type);
            assert.equal(await page.evaluate(() => ByndWechatCallRingtone.isAudible(_wechatIncomingCall)), true);
            await page.locator('#wc-call-screen .wc-call-decline').click();
            assert.equal(await page.evaluate(() => _wechatIncomingCall), null);
        }
        // Review the real role form, including provider overrides and save/reopen.
        await page.evaluate(() => { openChatSettings(); openWechatChatSettingsPage('voice'); });
        assert.equal(await page.locator('#wcs-video-provider').inputValue(), 'inherit');
        assert.match(await page.locator('#wcs-video-provider-status').innerText(), /当前使用 Vivix/);
        for (const width of [320,375]) for (const safe of [47,59]) for (const owner of ['parent','header']) {
            await page.setViewportSize({ width, height:844 });
            await page.evaluate(({ safe, owner }) => {
                document.body.style.paddingTop = owner === 'parent' ? safe + 'px' : '0';
                const phone = document.querySelector('.phone-container');
                phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? safe + 'px' : '0');
                phone.style.height = owner === 'parent' ? 'calc(100dvh - ' + safe + 'px)' : '100dvh';
            }, { safe, owner });
            await page.locator('#wcs-video-provider').scrollIntoViewIfNeeded(); await page.waitForTimeout(100);
            const rect = await page.locator('#wcs-video-provider').boundingBox();
            assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1 && rect.height >= 44);
            await page.screenshot({ path:path.join(output, 'role-provider-' + width + '-' + safe + '-' + owner + '.png') });
        }
        await page.locator('#wcs-video-provider').selectOption('ordinary');
        assert.match(await page.locator('#wcs-video-provider-status').innerText(), /当前使用普通视频/);
        assert.equal(await page.locator('#wcs-video-call-grid').isVisible(), true);
        await page.locator('#wcs-video-provider').scrollIntoViewIfNeeded();
        await page.screenshot({ path:path.join(output, 'role-provider-ordinary-375.png') });
        await page.locator('#wcs-save-settings').click();
        await page.waitForFunction(() => myCharacters[0].chatConfig.videoCallProvider === 'ordinary');
        await page.evaluate(() => { openChatSettings(); openWechatChatSettingsPage('voice'); });
        assert.equal(await page.locator('#wcs-video-provider').inputValue(), 'ordinary');
        await page.locator('#wcs-video-provider').selectOption('vivix'); await page.locator('#wcs-save-settings').click();
        await page.waitForFunction(() => myCharacters[0].chatConfig.videoCallProvider === 'vivix');
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('my_characters_data'))[0].chatConfig.videoCallProvider), 'vivix');
        // All sound choices share the same video connection, without local TTS playback.
        await page.evaluate(audio => {
            _qaTtsRequests = []; _qaTtsFailure = false;
            ByndWechatCallAudio.apiForChar = () => ({ provider:'minimax', apiKey:'mock-tts-secret', voiceId:'role-a' });
            requestVoiceAudioWithConfig = async (text, api, char, options) => {
                _qaTtsRequests.push({ text, voiceId:api.voiceId, charId:char.id, hasSignal:!!options.signal });
                if (_qaTtsFailure) throw new Error('mock-tts-secret insufficient balance');
                return { audioUrl:audio, duration:0.1 };
            };
        }, ttsAudio);
        const localTtsBeforeSound = await page.evaluate(() => _qaTtsEnqueues);
        for (const sound of ['vivix', 'tts', 'silent']) {
            await page.evaluate(sound => { const char = myCharacters[0]; char.chatConfig.vivixSoundSource = sound; char.chatConfig.vivixVoiceId = 'role-vivix-voice'; }, sound);
            const ttsCount = await page.evaluate(() => _qaTtsRequests.length);
            await start(); await ready();
            const create = requests.filter(request => request.path.endsWith('/sessions')).at(-1);
            if (sound === 'vivix') assert.equal(create.body.pipeline_config.tts_config.tts_voice_id, 'role-vivix-voice');
            else assert.equal(create.body.pipeline_config.tts_config, undefined);
            assert.equal(await page.evaluate(() => _qaRtc.at(-1).enterOptions.autoReceiveAudio), sound !== 'silent');
            if (sound === 'silent') assert.equal(await page.evaluate(() => _qaRtc.at(-1).remoteMuted), true);
            await page.evaluate(() => sendWechatCallMessage('用选定的声音回答')); 
            const vocal = await page.evaluate(() => _qaEvents.filter(event => event.type === 'response.create').at(-1).response.script.vocal);
            assert.equal(vocal?.type, sound === 'silent' ? undefined : sound === 'tts' ? 'audio' : 'speech');
            if (sound === 'tts') { assert.equal(vocal.mime_type, 'audio/wav'); assert.equal(vocal.text, undefined); }
            assert.equal(await page.evaluate(() => _qaTtsRequests.length), ttsCount + (sound === 'tts' ? 2 : 0));
            assert.equal(await page.evaluate(() => _qaTtsEnqueues), localTtsBeforeSound);
            await page.evaluate(() => endWechatCall());
        }
        // Incoming TTS has the same first-line routing; generation failure never falls back.
        await page.evaluate(() => { myCharacters[0].chatConfig.vivixSoundSource = 'tts'; handleWechatIncomingCall(myCharacters[0], { type:'videoCall', isMe:false, status:'来电', reason:'使用我的声音接听', timestamp:Date.now() }); });
        await page.locator('#wc-call-screen .wc-call-answer').click(); await ready();
        assert.equal(await page.evaluate(() => _qaEvents.filter(event => event.type === 'response.create').at(-1).response.script.vocal.type), 'audio');
        await page.evaluate(() => endWechatCall());
        const eventsBeforeTtsFailure = await page.evaluate(() => _qaEvents.filter(event => event.type === 'response.create').length);
        await page.evaluate(() => _qaTtsFailure = true); await start();
        await page.waitForFunction(() => _wechatActiveCall?.vivix?.failed);
        assert.match(await page.locator('#wc-call-log').innerText(), /角色 TTS 生成失败/);
        assert.doesNotMatch(await page.locator('#wc-call-log').innerText(), /mock-tts-secret/);
        assert.equal(await page.evaluate(() => _qaEvents.filter(event => event.type === 'response.create').length), eventsBeforeTtsFailure);
        assert.equal(await page.evaluate(() => _qaTtsEnqueues), localTtsBeforeSound);
        await page.evaluate(() => { _qaTtsFailure = false; endWechatCall(); });
        // Persist and reopen global and role sound controls, then inspect phone layouts.
        for (const width of [320,375]) for (const sound of ['vivix','tts','silent']) {
            await page.setViewportSize({ width,height:844 });
            await page.evaluate(() => { openApp('settings'); openSettingsTab('video'); });
            await page.locator('#vivix-sound').selectOption(sound); await page.locator('.vivix-actions button').last().click();
            await page.evaluate(() => ByndVivix.renderSettings());
            assert.equal(await page.locator('#vivix-sound').inputValue(), sound);
            assert.equal(await page.locator('#vivix-voice').isVisible(), sound === 'vivix');
            await page.locator('#vivix-sound').scrollIntoViewIfNeeded();
            await page.screenshot({ path:path.join(output, 'sound-global-' + width + '-' + sound + '.png') });
            await page.evaluate(() => { openApp('wechat'); openChatSettings(); openWechatChatSettingsPage('voice'); });
            await page.locator('#wcs-vivix-sound').selectOption(sound); await page.locator('#wcs-save-settings').click();
            await page.waitForFunction(sound => myCharacters[0].chatConfig.vivixSoundSource === sound, sound);
            await page.evaluate(() => { openChatSettings(); openWechatChatSettingsPage('voice'); });
            assert.equal(await page.locator('#wcs-vivix-sound').inputValue(), sound);
            assert.equal(await page.locator('#wcs-vivix-voice').isVisible(), sound === 'vivix');
            await page.locator('#wcs-vivix-sound').scrollIntoViewIfNeeded();
            await page.locator('#wcs-vivix-sound').evaluate(node => { node.closest('.wcs-body').scrollTop += 200; });
            await page.waitForTimeout(850);
            await page.screenshot({ path:path.join(output, 'sound-role-' + width + '-' + sound + '.png') });
            await page.evaluate(() => closeChatSettings());
        }
        // Confirm the vendored SDK itself loads in a real browser independently of mocks.
        await page.evaluate(() => delete window.TRTC); await page.addScriptTag({ path: path.join(root,'assets/vendor/trtc/trtc.js') });
        assert.equal(await page.evaluate(() => typeof TRTC.create), 'function');
        assert.equal(await page.evaluate(() => { const rtc = TRTC.create(); const type = typeof rtc.muteRemoteAudio; rtc.destroy(); return type; }), 'function');
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output,'checks.json'), JSON.stringify({ requests, errors, sdkLoaded:true, screenshots:51 + themes.length * 4, jsonReplyThemes:themes }, null, 2));
        console.log(`Vivix: opening image errors retain provider reasons on ${themes.length} themes; explicit reference-only calls bypass image failures; voice selection/save/session payload, JSON recovery, provider/sound selection, TTS/silent calls, incoming routing, microphone/transcripts, SDK and ${51 + themes.length * 4} narrow safe-area screenshots passed (mock Vivix/RTC/TTS).`);
    } catch (error) { await page.screenshot({ path: path.join(output,'failure.png') }); throw error; }
    finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
