'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/voice-hold');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    const button = page.locator('#wc-voice-press-btn');
    const start = async () => {
        const box = await button.boundingBox();
        assert.ok(box && box.width > 30 && box.height > 20);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] });
    };
    const release = type => cdp.send('Input.dispatchTouchEvent', { type: type || 'touchEnd', touchPoints: [] });
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
        await page.waitForFunction(() => typeof toggleWechatVoiceInputMode === 'function');
        await page.evaluate(async () => {
            await byndStylesReady;
            unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [{ id: 'voice-proof', name: '林间', description: '喜欢聊天', avatar: document.getElementById('wcs-user-avatar').src, history: [], chatConfig: {} }];
            openApp('wechat'); openChat('voice-proof');
            ByndBuiltinLibrary?.close();
            window._voiceProof = { requests: 0, stopped: 0, messages: [], toasts: [], mode: 'ok' };
            window.showWechatToast = text => _voiceProof.toasts.push(text);
            window.appendWechatMessage = message => _voiceProof.messages.push(message);
            window.SpeechRecognition = window.webkitSpeechRecognition = undefined;
            Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
                getUserMedia: async () => {
                    _voiceProof.requests++;
                    if (_voiceProof.mode === 'denied') throw new DOMException('Microphone denied', 'NotAllowedError');
                    return { getTracks: () => [{ stop: () => { _voiceProof.stopped++; } }] };
                }
            } });
            window.MediaRecorder = class {
                static isTypeSupported() { return true; }
                constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; }
                start() { this.state = 'recording'; }
                stop() {
                    this.state = 'inactive';
                    this.ondataavailable?.({ data: new Blob(['test audio'], { type: this.mimeType }) });
                    queueMicrotask(() => this.onstop?.());
                }
            };
            window.analyzeWechatVoiceMeta = async () => null;
            window.readWechatBlobAsDataUrl = async () => {
                if (_voiceProof.mode === 'read-failed') throw new Error('Cannot read audio');
                return 'data:audio/webm;base64,dGVzdA==';
            };
        });
        for (const theme of ['bynd', 'douyin', 'qq', 'couple', 'telegram', 'line', 'rednote', 'claude']) {
            for (const width of [320, 430]) {
                await page.setViewportSize({ width, height: 844 });
                await page.evaluate(theme => {
                    setWechatVoiceInputMode(false, { keepDraft: true });
                    localStorage.setItem('wechat_ui_theme_v1', theme); applyWechatUiTheme(theme);
                    document.getElementById('wc-msg-input').value = '切换语音前的文字草稿';
                    document.getElementById('wc-rich-msg-input').textContent = '切换语音前的文字草稿';
                    setWechatVoiceInputMode(true);
                }, theme);
                await page.waitForTimeout(350);
                assert.equal(await button.isVisible(), true, `${theme} ${width}: recording button visible`);
                assert.equal(await page.locator('#wc-msg-input').isVisible(), false);
                assert.equal(await page.locator('#wc-rich-msg-input').isVisible(), false);
                const props = await button.evaluate(node => ({ tag: node.tagName, editable: node.isContentEditable, select: getComputedStyle(node).userSelect, touch: getComputedStyle(node).touchAction }));
                assert.deepEqual(props, { tag: 'BUTTON', editable: false, select: 'none', touch: 'none' });
                const rect = await button.boundingBox();
                assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= 845,
                    `${theme} ${width}: recording button bounds ${JSON.stringify(rect)}`);
                assert.equal(await button.evaluate(node => node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))), false);
                assert.equal(await button.evaluate(node => node.dispatchEvent(new Event('selectstart', { bubbles: true, cancelable: true }))), false);
                await page.evaluate(() => setWechatVoiceInputMode(false, { keepDraft: true }));
                assert.equal(await button.isVisible(), false);
                assert.equal(await page.evaluate(() => getWechatMessageInputValue({ markers: false })), '切换语音前的文字草稿');
            }
        }
        await page.setViewportSize({ width: 375, height: 844 });
        await page.evaluate(() => { localStorage.setItem('wechat_ui_theme_v1', 'couple'); applyWechatUiTheme('couple'); setWechatVoiceInputMode(true); });
        await start();
        await page.waitForTimeout(100);
        await release();
        assert.equal(await page.evaluate(() => _voiceProof.requests), 0, 'short tap does not start recording');
        await start();
        await page.waitForFunction(() => window._wechatVoiceHold?.recorder?.state === 'recording');
        assert.equal(await page.evaluate(() => document.activeElement.matches('textarea,[contenteditable="true"]')), false);
        await release();
        await page.waitForFunction(() => _voiceProof.messages.length === 1);
        assert.equal(await button.textContent(), '长按说话');
        assert.equal(await page.evaluate(() => _voiceProof.stopped), 1);
        assert.equal(await page.evaluate(() => _voiceProof.messages[0].type), 'voice');
        await start();
        await page.waitForFunction(() => window._wechatVoiceHold?.recorder?.state === 'recording');
        await release('touchCancel');
        assert.equal(await page.evaluate(() => _voiceProof.messages.length), 1, 'cancel never sends audio');
        assert.equal(await page.evaluate(() => _voiceProof.stopped), 2);
        await page.evaluate(() => { _voiceProof.mode = 'denied'; });
        await start();
        await page.waitForFunction(() => _voiceProof.toasts.includes('请允许麦克风权限'));
        await release();
        assert.equal(await page.evaluate(() => _voiceProof.messages.length), 1, 'permission denial never sends audio');
        await page.evaluate(() => { _voiceProof.mode = 'read-failed'; });
        await start();
        await page.waitForFunction(() => window._wechatVoiceHold?.recorder?.state === 'recording');
        await release();
        await page.waitForFunction(() => _voiceProof.toasts.includes('录音保存失败'));
        assert.equal(await page.evaluate(() => _voiceProof.messages.length), 1, 'failed audio read never reports a sent message');
        await page.evaluate(() => { _voiceProof.mode = 'ok'; });
        await start();
        await page.waitForFunction(() => window._wechatVoiceHold?.recorder?.state === 'recording');
        await page.evaluate(() => setWechatVoiceInputMode(false, { keepDraft: true }));
        await release();
        assert.equal(await page.evaluate(() => window._wechatVoiceHold), null);
        assert.equal(await page.evaluate(() => _voiceProof.messages.length), 1, 'switching away cancels recording');
        await page.evaluate(() => setWechatVoiceInputMode(true));
        await page.screenshot({ path: path.join(output, 'couple-button-375.png') });
        await page.evaluate(() => { setWechatVoiceInputMode(false, { keepDraft: true }); localStorage.setItem('wechat_ui_theme_v1', 'wechat'); applyWechatUiTheme('wechat'); toggleWechatVoiceInputMode(); });
        assert.equal(await button.isVisible(), false, 'native WeChat direct hold composer keeps normal text editing');
        assert.equal(await page.locator('#wc-rich-msg-input').getAttribute('contenteditable'), 'true');
        assert.deepEqual(errors, []);
        console.log('Voice browser checks passed: real touch recording/send/cancel, permission/read failures, draft restoration, 8 themes × 2 widths and normal text editing.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
