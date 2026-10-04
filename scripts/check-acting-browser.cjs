'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/acting');
fs.mkdirSync(output, { recursive: true });
const fixture = {
    title: '鸢尾花与旧剧院之谜', genre: '复古奇幻 / 悬疑 / 浪漫',
    premise: '一家只在雨夜出现的旧剧院，据说能重演被遗忘的记忆。你带着神秘邀请函前来寻找真相，却发现台上的幻术师早已在等你。',
    openingNarration: '暴雨夜，你推开那扇名为“忘忧”的旧剧院大门。边缘烧焦的邀请函指引你来到二楼贵宾室。帷幕缓缓拉开，聚光灯下，那位戴着半脸银面具的幻术师如此熟悉。',
    userRole: { name: '上官落', identity: '收到匿名信的寻忆者', cover: '误入剧院的普通观众', secret: '在那场夺走双亲的车祸中，缺失了一段最关键的记忆。', goal: '找回记忆的真相，弄清邀请函的来源。', props: ['边缘烧焦的邀请函', '缺了一半的鸢尾花胸针'] },
    charRole: { name: '幻术师', identity: '守护旧剧院的人', relationship: '陪你寻找失落的记忆，掌握着剧院的秘密。', conflict: '选择说出真相，还是保护你。' },
    scenes: [
        { title: '贵宾室里的来信', narration: '唱针落下，留声机里传出一段陌生而熟悉的旋律。你在桌上看见了另一封写着自己名字的信。', charLine: '别急着拆开。有些故事，需要你亲自认出。', userCue: '问问他，为什么知道你的名字。', stageHint: '灯光落在信封上。' },
        { title: '后台藏着的空白页', narration: '幕布后面，是一本缺了最后一页的旧剧本。雨声终于停了。', charLine: '最后一句，应该由你来写。', userCue: '说出你想留下的结局。', stageHint: '把邀请函放在剧本旁。' }
    ]
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => typeof renderActingGame === 'function');
        await page.evaluate(async fixture => {
            await byndStylesReady;
            unlockPhone();
            document.documentElement.classList.add('mobile-runtime');
            window.myCharacters = [
                { id: 'acting-check', name: '温今北', description: '【角色描述】```yaml char_name: 温今北', avatar: 'assets/characters/builtin/wenjinbei.jpg' },
                { id: 'acting-empty', name: '测试', description: '', avatar: '' },
                { id: 'acting-other', name: '商桓', description: '法医，克制而温柔。', avatar: 'assets/characters/builtin/shanghuan.jpg' }
            ];
            window._actingCheckFixture = normalizeActingScript(fixture, window.myCharacters[0]);
            openApp('game');
            setActiveGame('acting');
            renderGameApp();
        }, fixture);
        await page.locator('#app-game-window.active').waitFor();
        await page.locator('#app-game-window').evaluate(async element => {
            await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
        });
        await page.evaluate(async () => {
            const image = new Image();
            image.src = 'assets/games/acting/archive-paper-v1.webp';
            await image.decode();
        });

        for (const phase of ['opening', 'select', 'generating', 'roleFile', 'stage', 'ending']) {
            for (const width of [320, 375, 430]) {
                await page.setViewportSize({ width, height: 844 });
                for (const safe of [47, 59]) {
                    for (const parentReserved of [false, true]) {
                        await page.evaluate(({ phase, safe, parentReserved }) => {
                            document.body.style.paddingTop = parentReserved ? safe + 'px' : '0px';
                            const phone = document.querySelector('.phone-container');
                            phone.style.setProperty('--bynd-header-safe-top', parentReserved ? '0px' : safe + 'px');
                            phone.style.height = parentReserved ? 'calc(100dvh - ' + safe + 'px)' : '100dvh';
                            saveActingGameState({
                                phase, selectedCharId: 'acting-check', script: window._actingCheckFixture, sceneIndex: 0,
                                userLines: phase === 'ending' ? [{ sceneIndex: 0, text: '你为什么知道我的名字？' }, { sceneIndex: 1, text: '这一次，我想和你一起走出去。' }] : []
                            });
                            renderGameApp();
                        }, { phase, safe, parentReserved });
                        const layout = await page.evaluate(() => {
                            const app = document.getElementById('app-game-window');
                            const rect = selector => app.querySelector(selector).getBoundingClientRect();
                            const header = rect('.game-header');
                            const scroll = rect('.acting-scroll');
                            const footer = app.querySelector('.acting-bottom-actions')?.getBoundingClientRect();
                            return {
                                overflow: app.scrollWidth > app.clientWidth,
                                innerOverflow: app.querySelector('.acting-scroll').scrollWidth > app.querySelector('.acting-scroll').clientWidth,
                                headBottom: header.bottom, buttonTop: rect('.game-header>button').top,
                                titleTop: rect('#game-header-title').top, scrollTop: scroll.top,
                                scrollBottom: scroll.bottom, footerTop: footer?.top, footerBottom: footer?.bottom
                            };
                        });
                        const label = phase + ' ' + width + 'px, safe=' + safe + ', parent=' + parentReserved;
                        assert.equal(layout.overflow, false, label + ' app fits');
                        assert.equal(layout.innerOverflow, false, label + ' content fits');
                        assert.ok(layout.buttonTop >= safe && layout.titleTop >= safe, label + ' clears native status');
                        assert.equal(layout.headBottom, 68 + safe, label + ' safe area reserved once');
                        assert.ok(layout.scrollTop >= layout.headBottom, label + ' body clears header');
                        if (layout.footerTop != null) {
                            assert.ok(layout.scrollBottom <= layout.footerTop + 1, label + ' footer does not cover text');
                            assert.ok(layout.footerBottom <= 845, label + ' actions fit');
                        }
                    }
                }
                await page.screenshot({ path: path.join(output, phase.toLowerCase() + '-' + width + '.png'), animations: 'disabled' });
            }
        }
        console.log('72 narrow-screen and safe-area layouts passed.');

        await page.setViewportSize({ width: 320, height: 844 });
        await page.evaluate(() => {
            window._actingCheckCalls = 0;
            callChatApi = async () => {
                window._actingCheckCalls += 1;
                return window._actingCheckCalls === 1
                    ? { ok: true, content: '剧情不是 JSON' }
                    : { ok: false, error: 'API 错误 (429): rate limit exceeded' };
            };
            saveActingGameState({ phase: 'select', selectedCharId: 'acting-check' });
            renderGameApp();
        });
        assert.equal(await page.locator('.acting-dossier-caption').filter({ hasText: 'yaml' }).count(), 0);
        await page.locator('.acting-dossier').nth(2).click();
        assert.equal(await page.locator('.acting-dossier[aria-pressed="true"]').count(), 1);
        assert.equal(await page.evaluate(() => getActingSelectedChar().id), 'acting-other');
        await page.locator('.acting-dossier').first().click();
        await page.locator('.acting-bottom-actions .primary').click();
        await page.locator('.acting-error').waitFor();
        assert.match(await page.locator('.acting-error').innerText(), /格式修复失败.*429/);
        assert.equal(await page.evaluate(() => window._actingCheckCalls), 2);

        await page.evaluate(() => { callChatApi = async () => ({ ok: true, content: JSON.stringify(window._actingCheckFixture) }); });
        await page.locator('.acting-bottom-actions .primary').click();
        await page.locator('.acting-newspaper').waitFor();
        assert.equal(await page.evaluate(() => getActingGameState().script.scenes.length), 1, 'only the first act is prepared');
        assert.match(await page.locator('.acting-script-card').innerText(), /鸢尾花/);
        await page.locator('.acting-secret summary').click();
        assert.match(await page.locator('.acting-secret[open]').innerText(), /缺失了一段/);
        await page.locator('.acting-bottom-actions .primary').click();
        await page.locator('#acting-user-line').fill('你为什么知道我的名字？');
        await page.evaluate(() => {
            window._actingStorageSet = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'bynd_game_acting_state_v1') throw new Error('模拟写入失败');
                return window._actingStorageSet.call(this, key, value);
            };
        });
        await page.locator('.acting-bottom-actions .primary').click();
        assert.match(await page.locator('#acting-line-status').innerText(), /台词没有保存/);
        assert.equal(await page.locator('#acting-user-line').inputValue(), '你为什么知道我的名字？');
        assert.equal(await page.evaluate(() => getActingGameState().userLines.length), 0);
        await page.evaluate(() => { Storage.prototype.setItem = window._actingStorageSet; });
        await page.evaluate(() => { callChatApi = async () => ({ ok: false, error: 'API 错误 (503): 暂时无法接戏' }); });
        await page.locator('.acting-bottom-actions .primary').click();
        await page.waitForFunction(() => getActingGameState().error?.includes('503'));
        assert.equal(await page.locator('#acting-user-line').inputValue(), '你为什么知道我的名字？');
        assert.equal(await page.evaluate(() => getActingGameState().sceneIndex), 0);
        await page.evaluate(() => {
            window._actingContinuationMessages = [];
            callChatApi = async messages => {
                window._actingContinuationMessages.push(messages);
                return new Promise(resolve => { window._actingResolve = resolve; });
            };
        });
        await page.locator('.acting-bottom-actions .primary').click();
        assert.equal(await page.locator('#acting-user-line').isDisabled(), true);
        assert.match(await page.locator('#acting-line-status').innerText(), /随你的回应/);
        await page.evaluate(() => { advanceActingScene(); finishActingPerformance(); });
        assert.equal(await page.evaluate(() => window._actingContinuationMessages.length), 1);
        await page.waitForFunction(() => !document.getElementById('wc-toast')?.classList.contains('show'));
        await page.screenshot({ path: path.join(output, 'responding-320.png'), animations: 'disabled' });
        await page.evaluate(() => {
            window._actingResolve({ ok: true, content: JSON.stringify({ scene: { ...window._actingCheckFixture.scenes[1], charLine: '邀请函上写着你的名字。我一直在等你问这一句。' } }) });
        });
        await page.waitForFunction(() => getActingGameState().sceneIndex === 1);
        assert.equal(await page.evaluate(() => getActingGameState().sceneIndex), 1);
        assert.equal(await page.evaluate(() => getActingGameState().script.scenes.length), 2);
        assert.match(await page.locator('.acting-char-line').innerText(), /邀请函上写着你的名字/);
        assert.equal(await page.locator('#acting-user-line').inputValue(), '');
        await page.locator('.acting-synopsis summary').click();
        assert.match(await page.locator('.acting-past-scene').innerText(), /你为什么知道我的名字/);
        assert.match(await page.evaluate(() => window._actingContinuationMessages[0][1].content), /用户本次台词或行动：你为什么知道我的名字/);
        await page.evaluate(() => {
            callChatApi = async messages => {
                window._actingContinuationMessages.push(messages);
                return { ok: true, content: JSON.stringify({ scene: { ...window._actingCheckFixture.scenes[1], narration: '你们并肩走出剧院，雨已经停了。', charLine: '好，这一次一起走。' } }) };
            };
        });
        await page.locator('#acting-user-line').fill('这一次，我想和你一起走出去。');
        await page.locator('.acting-bottom-actions button').first().click();
        await page.locator('.acting-ending-sheet').waitFor();
        assert.equal(await page.locator('.acting-archive-list>div').count(), 2);
        assert.match(await page.locator('.acting-opening-copy').innerText(), /一起走/);
        assert.match(await page.evaluate(() => window._actingContinuationMessages[1][1].content), /你为什么知道我的名字/);
        assert.match(await page.evaluate(() => window._actingContinuationMessages[1][1].content), /一起走出去/);
        await page.screenshot({ path: path.join(output, 'improvised-ending-320.png'), animations: 'disabled' });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.evaluate(async () => {
            await byndStylesReady;
            unlockPhone(); openApp('game');
            if (getActingGameState()?.phase !== 'ending') throw new Error('saved ending was lost on reload');
            setActiveGame('acting'); renderGameApp();
        });
        await page.locator('.acting-ending-sheet').waitFor();
        assert.equal(await page.locator('.acting-archive-list>div').count(), 2, 'transcript survives reload');
        assert.deepEqual(errors, []);
        console.log('Incremental acting, contextual replies, API/save failures, pending guards and reload checks passed; screenshots in ' + output);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
