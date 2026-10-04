'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/wolfcha');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => typeof renderWolfchaSetup === 'function');
        await page.evaluate(async () => {
            await byndStylesReady;
            unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = ['温今北', '商桓', '沈清舟', '陆时安', '林晚', '许知远', '夏映月', '顾言', '祁川', '测试很长的角色名字'].map((name, index) => ({
                id: 'wolf-check-' + index, name, description: '',
                avatar: index === 0 ? 'assets/characters/builtin/wenjinbei.jpg' : index === 1 ? 'assets/characters/builtin/shanghuan.jpg' : ''
            }));
            saveWolfchaSetupIds(window.myCharacters.slice(0, 9).map(char => char.id));
            window._wolfToasts = [];
            showWechatToast = text => window._wolfToasts.push(text);
            openApp('game');
            setActiveGame('wolfcha');
            localStorage.removeItem(GAME_STATE_KEY);
            localStorage.setItem(WOLFCHA_ENTRY_KEY, 'opening');
            renderGameApp();
            const image = new Image();
            image.src = 'assets/games/wolfcha/moonlit-clock-v1.webp';
            await image.decode();
            await document.fonts.ready;
        });
        await page.locator('#app-game-window.active').waitFor();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.game-header button i'), '::before').content !== 'none');
        await page.evaluate(() => document.fonts.ready);
        await page.locator('#app-game-window').evaluate(async el => {
            await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {})));
        });

        let layouts = 0;
        for (const phase of ['opening', 'setup', 'day', 'night', 'speaking', 'long', 'sound']) {
            for (const width of [320, 375, 430]) {
                await page.setViewportSize({ width, height: 844 });
                for (const safe of [47, 59]) {
                    for (const parentReserved of [false, true]) {
                        await page.evaluate(({ phase, safe, parentReserved }) => {
                            document.body.style.paddingTop = parentReserved ? safe + 'px' : '0px';
                            const phone = document.querySelector('.phone-container');
                            phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : safe + 'px');
                            phone.style.height = parentReserved ? 'calc(100dvh - ' + safe + 'px)' : '100dvh';
                            if (phase === 'opening' || phase === 'setup') {
                                localStorage.removeItem(GAME_STATE_KEY);
                                localStorage.setItem(WOLFCHA_ENTRY_KEY, phase);
                            } else {
                                startWolfchaGame(window.myCharacters.slice(0, 9).map(char => char.id), false);
                                const state = getGameState();
                                state.players[0].role = '村民';
                                state.players[1].role = '狼人';
                                state.players[2].role = '预言家';
                                state.phase = phase === 'night' ? 'night' : 'day';
                                state.awaitingUserSpeech = phase === 'speaking';
                                state.turnMode = phase === 'speaking' ? 'speaking' : 'day_intro';
                                if (phase === 'long') {
                                    state.players[0].name = '这是一位名字特别长的测试玩家';
                                    state.log.push({ type: 'speech', name: '温今北', playerId: state.players[1].id, text: '我想先听听大家的判断，再决定这一轮站在哪一边。'.repeat(36) });
                                }
                                saveGameState(state);
                            }
                            renderGameApp();
                            if (WolfchaAudio.panelOpen !== (phase === 'sound')) WolfchaAudio.togglePanel();
                        }, { phase, safe, parentReserved });
                        const layout = await page.evaluate(() => {
                            const app = document.getElementById('app-game-window');
                            const rect = selector => app.querySelector(selector).getBoundingClientRect();
                            const scroll = app.querySelector('.wolfcha-scroll');
                            return {
                                overflow: app.scrollWidth > app.clientWidth,
                                innerOverflow: scroll.scrollWidth > scroll.clientWidth,
                                scrollbar: getComputedStyle(scroll).scrollbarWidth,
                                topActionsFit: Array.from(app.querySelectorAll('.wolfcha-top-actions button')).every(button => getComputedStyle(button).whiteSpace === 'nowrap' && button.scrollWidth <= button.clientWidth),
                                alignment: (() => {
                                    const button = app.querySelector('.wolfcha-dialog-heading button');
                                    const label = app.querySelector('.wolfcha-dialog-heading > span');
                                    if (!button) return null;
                                    const a = button.getBoundingClientRect(), b = label.getBoundingClientRect();
                                    return { delta: Math.abs(a.y + a.height / 2 - b.y - b.height / 2),
                                        labelRect: {top:b.top,height:b.height}, buttonRect:{top:a.top,height:a.height}, labelSize: getComputedStyle(label).fontSize, buttonSize: getComputedStyle(button).fontSize,
                                        labelLine: getComputedStyle(label).lineHeight, buttonLine: getComputedStyle(button).lineHeight };
                                })(),
                                headerBottom: rect('.game-header').bottom,
                                buttonTop: rect('.game-header > button').top,
                                titleTop: rect('#game-header-title').top,
                                scrollTop: scroll.getBoundingClientRect().top,
                                scrollBottom: scroll.getBoundingClientRect().bottom,
                                footerTop: rect('.wolfcha-footer').top,
                                footerBottom: rect('.wolfcha-footer').bottom
                            };
                        });
                        const label = `${phase} ${width}px safe=${safe} parent=${parentReserved}`;
                        assert.equal(layout.overflow, false, label + ' app fits');
                        assert.equal(layout.innerOverflow, false, label + ' content fits');
                        assert.equal(layout.scrollbar, 'none', label + ' scrollbar hidden');
                        assert.equal(layout.topActionsFit, true, label + ' top actions stay on one line');
                        assert.ok(layout.buttonTop >= safe && layout.titleTop >= safe, label + ' native status clear');
                        assert.equal(layout.headerBottom, 68 + safe, label + ' safe area reserved once');
                        assert.ok(layout.scrollTop >= layout.headerBottom, label + ' body below header');
                        assert.ok(layout.scrollBottom <= layout.footerTop + 1, label + ' footer does not cover content');
                        assert.ok(layout.footerBottom <= 845, label + ' controls fit');
                        if (layout.alignment) {
                            assert.ok(layout.alignment.delta < 0.5, label + ' read label centered ' + JSON.stringify(layout.alignment));
                            assert.equal(layout.alignment.labelSize, layout.alignment.buttonSize, label + ' read label typography');
                            assert.equal(layout.alignment.labelLine, layout.alignment.buttonLine, label + ' read label line height');
                        }
                        layouts++;
                    }
                }
                if (phase !== 'long') await page.screenshot({ path: path.join(output, `${phase}-${width}.png`), animations: 'disabled' });
                if (phase === 'long' && width === 320) {
                    await page.locator('.wolfcha-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
                    assert.ok(await page.locator('.wolfcha-scroll').evaluate(el => el.scrollTop > 0), 'hidden scrollbar preserves scrolling');
                    await page.screenshot({ path: path.join(output, 'long-bottom-320.png'), animations: 'disabled' });
                }
            }
        }
        console.log(`${layouts} narrow-screen and safe-area layouts passed.`);

        await page.setViewportSize({ width: 320, height: 568 });
        await page.evaluate(() => { localStorage.removeItem(GAME_STATE_KEY); localStorage.setItem(WOLFCHA_ENTRY_KEY, 'opening'); renderGameApp(); });
        await page.locator('.wolfcha-help summary').click();
        assert.ok(await page.locator('.wolfcha-opening-start').isVisible());
        await page.screenshot({ path: path.join(output, 'opening-short-320.png'), animations: 'disabled' });
        await page.locator('.wolfcha-opening-start').click();
        assert.equal(await page.locator('.wolfcha-setup-char[aria-pressed="true"]').count(), 9);
        await page.evaluate(() => window.myCharacters.slice(0, 9).forEach(char => toggleWolfchaSetupChar(char.id)));
        assert.equal(await page.locator('.wolfcha-setup-char[aria-pressed="true"]').count(), 0, 'empty selection persists');
        assert.ok(await page.locator('.wolfcha-setup-actions .primary').isDisabled());
        await page.locator('.wolfcha-setup-char').first().click();
        assert.equal(await page.locator('.wolfcha-setup-char[aria-pressed="true"]').count(), 1);

        await page.evaluate(() => {
            window._wolfStorageSet = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === WOLFCHA_SETUP_KEY || key === GAME_STATE_KEY) throw new Error('模拟空间不足');
                return window._wolfStorageSet.call(this, key, value);
            };
            toggleWolfchaSetupChar(window.myCharacters[1].id);
        });
        assert.equal(await page.locator('.wolfcha-setup-char[aria-pressed="true"]').count(), 1);
        assert.match(await page.evaluate(() => window._wolfToasts.at(-1)), /未保存/);
        await page.locator('.wolfcha-setup-actions .primary').click();
        assert.equal(await page.locator('.wolfcha-playing').count(), 0, 'failed save cannot enter table');
        assert.match(await page.evaluate(() => window._wolfToasts.at(-1)), /未能保存/);
        await page.evaluate(() => { Storage.prototype.setItem = window._wolfStorageSet; selectFirstWolfchaChars(); });
        await page.locator('.wolfcha-setup-actions .primary').click();
        assert.equal(await page.locator('.wolfcha-player').count(), 10);
        await page.evaluate(() => {
            const state = getGameState();
            state.players[0].role = '村民'; state.players[1].role = '狼人';
            state.log.push({ type: 'narrator', name: '旁白', playerId: state.players[1].id, text: '身份是 狼人。' });
            saveGameState(state); renderGameApp();
        });
        assert.equal(await page.locator('.wolfcha-player .wolfcha-role.wolf').count(), 0);
        assert.equal(await page.locator('.wolfcha-history').innerText().then(text => text.includes('身份是 狼人')), false);
        assert.equal(await page.locator('.wolfcha-player').nth(1).getAttribute('aria-label').then(text => text.includes('狼人')), false);
        await page.evaluate(() => {
            const state = getGameState(); state.players[0].role = '狼人'; saveGameState(state); renderGameApp();
        });
        assert.ok(await page.locator('.wolfcha-player .wolfcha-role.wolf').count() >= 2, 'wolf teammates visible');

        await page.locator('.wolfcha-actions .primary').click();
        await page.locator('#wolfcha-user-speech-input').fill('我先听二号的判断。');
        await page.locator('.wolfcha-player').nth(1).click();
        assert.equal(await page.locator('#wolfcha-user-speech-input').inputValue(), '我先听二号的判断。', 'seat selection retains speech draft');
        await page.evaluate(() => {
            Storage.prototype.setItem = function(key, value) {
                if (key === GAME_STATE_KEY) throw new Error('模拟写入失败');
                return window._wolfStorageSet.call(this, key, value);
            };
        });
        await page.locator('.wolfcha-user-speech-box button').click();
        assert.equal(await page.locator('#wolfcha-user-speech-input').inputValue(), '我先听二号的判断。');
        assert.equal(await page.evaluate(() => getGameState().awaitingUserSpeech), true);
        assert.match(await page.evaluate(() => window._wolfToasts.at(-1)), /未保存/);
        await page.evaluate(() => { Storage.prototype.setItem = window._wolfStorageSet; });
        await page.locator('.wolfcha-user-speech-box button').click();
        assert.equal(await page.evaluate(() => getGameState().awaitingUserSpeech), false);
        assert.ok(await page.evaluate(() => getGameState().log.some(log => log.text === '我先听二号的判断。')));

        await page.evaluate(() => { callChatApi = () => new Promise(resolve => { window._wolfResolve = resolve; }); });
        await page.locator('.wolfcha-actions .primary').click();
        await page.waitForFunction(() => !!window._wolfResolve);
        assert.equal(await page.locator('.wolfcha-actions button:disabled').count(), 4, 'pending AI cannot be skipped or duplicated');
        await page.evaluate(() => window._wolfResolve({ ok: false, error: 'API 错误 (503): 暂时不可用' }));
        await page.waitForFunction(() => !getGameState().aiSpeechBusyId);
        assert.match(await page.locator('.wolfcha-dialog').innerText(), /失败.*503/);
        await page.setViewportSize({ width: 375, height: 844 });
        await page.screenshot({ path: path.join(output, 'api-failure-375.png'), animations: 'disabled' });
        await page.locator('.wolfcha-rules summary').click();
        assert.match(await page.locator('.wolfcha-rules').innerText(), /守卫 → 狼人 → 女巫 → 预言家/);
        assert.match(await page.locator('.wolfcha-rules').innerText(), /尚未结算/);
        assert.equal(await page.locator('.wolfcha-rules a').getAttribute('href'), 'https://langrensha.ijinshan.com/pages/guide/rules/index.html');
        await page.locator('.wolfcha-rules').evaluate(el => el.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: path.join(output, 'rules-375.png'), animations: 'disabled' });
        await page.locator('.wolfcha-rules summary').click();
        await page.locator('.wolfcha-player').nth(1).click();
        assert.match(await page.locator('.wolfcha-vote-target').innerText(), /2 号/);
        await page.locator('.wolfcha-exile').click();
        assert.ok(await page.locator('.wolfcha-player').nth(1).evaluate(el => el.classList.contains('dead')));
        assert.ok(await page.locator('.wolfcha-exile').isDisabled());

        await page.evaluate(() => {
            window._wolfSpoken = [];
            window._wolfCanceled = 0;
            Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
                getVoices: () => [{ lang: 'zh-CN', name: '测试中文' }],
                speak: utterance => window._wolfSpoken.push(utterance),
                cancel: () => { window._wolfCanceled++; }
            } });
            window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
            window._wolfContexts = [];
            window._wolfClips = [];
            const BaseAudio = window.Audio;
            window.Audio = function(url) { const audio = new BaseAudio(url); window._wolfClips.push(audio); return audio; };
            window.Audio.prototype = BaseAudio.prototype;
            const BaseContext = window.AudioContext;
            window.AudioContext = class extends BaseContext {
                constructor(...args) { super(...args); window._wolfContexts.push(this); }
            };
            startWolfchaGame(window.myCharacters.slice(0, 4).map(char => char.id), false);
            renderGameApp();
            if (!WolfchaAudio.panelOpen) WolfchaAudio.togglePanel();
        });
        const narratorToggle = page.locator('.wolfcha-sound-row input[type="checkbox"]').nth(0);
        const ambienceToggle = page.locator('.wolfcha-sound-row input[type="checkbox"]').nth(1);
        await narratorToggle.check();
        assert.equal(await page.evaluate(() => window._wolfSpoken.length), 1);
        await page.locator('.wolfcha-player').nth(1).click();
        assert.equal(await page.evaluate(() => window._wolfSpoken.length), 1, 'selection never repeats narration');
        await ambienceToggle.check();
        await page.waitForFunction(() => window._wolfContexts[0]?.state === 'running');
        await page.waitForFunction(() => window._wolfClips.some(audio => !audio.paused && audio.currentTime > 0 && audio.readyState >= 2));
        assert.equal(await page.evaluate(() => WolfchaAudio.status.includes('素材未能播放')), false, 'bundled CC0 bell plays');
        await page.locator('.wolfcha-sound-row input[type="range"]').fill('55');
        await page.locator('.wolfcha-sound-row input[type="range"]').dispatchEvent('change');
        assert.equal(await page.evaluate(() => WolfchaAudio.settings.volume), 0.55);
        await page.setViewportSize({ width: 320, height: 844 });
        await page.locator('.wolfcha-scroll').evaluate(el => { el.scrollTop = 0; });
        await page.screenshot({ path: path.join(output, 'sound-enabled-320.png'), animations: 'disabled' });
        await page.locator('.wolfcha-sound-buttons button').nth(1).click();
        assert.match(await page.locator('[data-wolfcha-audio-status]').innerText(), /已停止/);
        assert.ok(await page.evaluate(() => window._wolfCanceled > 0));
        await narratorToggle.uncheck();
        assert.equal(await page.locator('.wolfcha-sound-row select').count(), 0, 'system voice needs no TTS selector');
        await page.evaluate(() => {
            window.speechSynthesis.getVoices = () => [{ lang: 'en-US' }];
            requestDefaultVoiceAudio = () => { throw new Error('TTS API must not be called'); };
            requestCharacterVoiceAudio = () => { throw new Error('TTS API must not be called'); };
        });
        await page.locator('.wolfcha-sound-buttons button').first().click();
        await page.waitForFunction(() => WolfchaAudio.status.includes('没有中文'));
        assert.match(await page.locator('[data-wolfcha-audio-status]').innerText(), /未能播放.*没有中文/);
        await page.evaluate(() => { const state = getGameState(); state.phase = 'night'; saveGameState(state); renderGameApp(); });
        await page.waitForFunction(() => window._wolfClips.at(-1)?.playbackRate === 0.72 && !window._wolfClips.at(-1).paused);
        assert.equal(await page.evaluate(() => window._wolfClips.at(-1).preservesPitch), false);
        await page.evaluate(() => closeApp('game'));
        await page.waitForFunction(() => window._wolfContexts[0].state === 'closed');
        assert.equal(await page.evaluate(() => window._wolfClips.every(audio => audio.paused)), true, 'leaving stops sampled sounds');
        await page.evaluate(() => {
            openApp('game'); setActiveGame('wolfcha'); renderGameApp();
        });
        await page.locator('#app-game-window.active').waitFor();
        await page.evaluate(() => {
            WolfchaAudio.configure('ambience', false);
        });

        await page.evaluate(() => {
            const state = getGameState(); const player = state.players[1];
            state.phase = 'day'; state.turnMode = 'speaking';
            state.currentSpeakerId = player.id; state.aiSpeechBusyId = player.id;
            saveGameState(state);
            callChatApi = () => new Promise(resolve => { window._wolfLateResolve = resolve; });
            window._wolfLatePending = runWolfchaAiSpeech(player.id);
        });
        await page.waitForFunction(() => !!window._wolfLateResolve);
        const restarted = await page.evaluate(async () => {
            startWolfchaGame(window.myCharacters.slice(0, 4).map(char => char.id), false);
            const before = getGameState();
            window._wolfLateResolve({ ok: true, content: '这条旧回复不应进入新局。' });
            await window._wolfLatePending;
            renderGameApp();
            return { before, after: getGameState() };
        });
        assert.deepEqual(restarted.before, restarted.after, 'restarting discards late AI speech');

        await page.evaluate(() => { openWolfchaSetup(); window.myCharacters = []; renderGameApp(); });
        assert.match(await page.locator('.wolfcha-setup-empty').innerText(), /导入角色/);
        assert.ok(await page.locator('.wolfcha-setup-actions .primary').isDisabled());
        assert.deepEqual(errors, [], 'no runtime errors');
        console.log('Selection, privacy, rules, speech, API/save failures, restart isolation, system narration, real CC0 bell playback, and Web Audio lifecycle passed.');
        console.log('Screenshots: ' + output);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
