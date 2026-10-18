'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/npc-friends');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
        await page.waitForFunction(() => !!window.ByndNpcFriends);
        await page.evaluate(async () => {
            await byndStylesReady;
            await window._wechatCharactersLoadPromise;
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            unlockPhone();
            window._npcGenerationCalls = 0;
            window._npcReplyVerdict = false;
            getDefaultApi = () => null;
            window.ByndWebSearch = { prepare: async () => null };
            window.myCharacters = [{ id: 'npc-browser-source', name: '林舟', avatar: DEFAULT_AVATAR, description: '书店老板', history: [], chatConfig: {}, worldBook: [{ comment: '书店同事', content: '许青是林舟的书店同事。', enabled: true }] }];
            callChatApi = async messages => {
                if (messages[0]?.content.includes('你负责为正在进行的微信剧情补全')) {
                    window._npcGenerationCalls++;
                    return { ok: true, content: JSON.stringify({ needed: true, card: { name: '许青', description: '在林舟书店工作的店员，开朗，喜欢推理小说。', firstMessage: '你好呀，林舟说你想查一下新书。', worldBook: [{ keys: ['书店'], comment: '工作', content: '和林舟一起经营书店。' }] }, relationship: '林舟的书店同事', reason: '你好，我是许青，林舟书店的店员。他把你的微信推给了我，说你想了解新书，我来和你对接一下。', sourceEntryIndexes: [0], sourceMessageIndexes: [myCharacters[0].history.findLastIndex(row => !row.isMe)], storyEvidence: '我把你的微信推给许青' }) };
                }
                return { ok: true, content: (window._npcReplyVerdict ? '好，我把你的微信推给许青，让她加你聊新书。' : '今天在整理书架，刚忙完。') + '<bynd_decide>' + JSON.stringify({ status: false, memory: false, moment: false, npcFriend: window._npcReplyVerdict }) + '</bynd_decide>' };
            };
            openApp('wechat');
            ByndBuiltinLibrary?.close();
            openWechatPlusMenu();
        });
        assert.equal(await page.locator('#wc-plus-menu').getByText('NPC 好友申请').count(), 0);
        await page.evaluate(() => { closeWechatPlusMenu(); switchWcTab('contacts'); });
        await page.locator('.wc-npc-entry').click();
        assert.equal(await page.locator('.wc-npc-header h2').textContent(), '新的朋友');
        assert.equal(await page.locator('#bynd-npc-friends').locator('select, [data-npc-action="generate"], #wc-npc-enabled').count(), 0);
        assert.equal(await page.locator('.wc-npc-row').count(), 0);
        await page.screenshot({ path: path.join(output, 'new-friends-empty.png') });
        const themeIds = await page.evaluate(() => WECHAT_UI_THEMES.map(theme => theme.id));
        for (const themeId of themeIds) {
            await page.evaluate(themeId => { localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, themeId); applyWechatUiTheme(themeId, { update: false }); ByndNpcFriends.refresh(); }, themeId);
            await page.screenshot({ path: path.join(output, `empty-${themeId}.png`) });
        }
        await page.evaluate(() => { localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, 'wechat'); applyWechatUiTheme('wechat', { update: false }); ByndNpcFriends.refresh(); });
        assert.equal(await page.evaluate(() => window._npcGenerationCalls), 0, 'opening the inbox is inert');
        await page.locator('[data-npc-action="back"]').click();
        await page.evaluate(() => { switchWcTab('chat'); openChat('npc-browser-source'); });
        const fillMessage = async text => {
            const rich = page.locator('#wc-rich-msg-input');
            await (await rich.isVisible() ? rich : page.locator('#wc-msg-input')).fill(text);
        };
        await fillMessage('今天忙吗？');
        await page.locator('.wc-send-btn').click();
        await page.evaluate(async () => triggerAiAfterMessage(myCharacters[0], document.getElementById('chat-room-content')));
        assert.equal(await page.evaluate(() => window._npcGenerationCalls), 0, 'ordinary conversation never generates a request');
        await fillMessage('想请许青帮我查一下新书，可以让她微信联系我吗？');
        await page.locator('.wc-send-btn').click();
        await page.evaluate(async () => { window._npcReplyVerdict = true; await triggerAiAfterMessage(myCharacters[0], document.getElementById('chat-room-content')); });
        await page.waitForFunction(() => ByndNpcFriends.pendingCount() === 1);
        assert.equal(await page.evaluate(() => myCharacters.length), 1);
        assert.equal(await page.evaluate(() => window._npcGenerationCalls), 1);
        assert.ok(!(await page.locator('#chat-room-content').textContent()).includes('npcFriend'));
        await page.evaluate(() => { closeChat(); switchWcTab('contacts'); });
        assert.equal(await page.locator('.wc-npc-entry b').textContent(), '1');
        await page.locator('.wc-npc-entry').click();
        await page.locator('.wc-npc-row').waitFor();
        await page.locator('#wc-npc-search').fill('找不到的人');
        assert.equal(await page.locator('.wc-npc-row').count(), 0);
        await page.locator('#wc-npc-search').fill('许青');
        assert.equal(await page.locator('.wc-npc-row').count(), 1);
        await page.locator('#wc-npc-search').fill('');
        for (const safe of [47, 59]) {
            for (const mode of ['parent', 'header']) {
                await page.evaluate(({ safe, mode }) => {
                    const phone = document.querySelector('.phone-container');
                    phone.style.cssText += `;position:absolute!important;inset:auto!important;left:0!important;top:${mode === 'parent' ? safe : 0}px!important;width:100vw!important;max-width:none!important;height:calc(100dvh - ${mode === 'parent' ? safe : 0}px)!important;max-height:none!important;transform:none!important;border:0!important;border-radius:0!important;margin:0!important;--bynd-header-safe-top:${mode === 'parent' ? 0 : safe}px;`;
                }, { safe, mode });
                const rect = await page.locator('.wc-npc-header button').first().boundingBox();
                assert.ok(rect.y >= safe, `${safe}/${mode}: header is below native status bar`);
                const header = await page.locator('.wc-npc-header').boundingBox();
                assert.equal(Math.round(header.height), 57 + (mode === 'header' ? safe : 0), 'safe area applied once');
                assert.equal(await page.locator('#bynd-npc-friends').evaluate(node => node.scrollWidth <= node.clientWidth), true);
                await page.screenshot({ path: path.join(output, `new-friends-375-safe-${safe}-${mode}.png`) });
            }
        }
        await page.setViewportSize({ width: 320, height: 740 });
        assert.equal(await page.locator('#bynd-npc-friends').evaluate(node => node.scrollWidth <= node.clientWidth), true);
        await page.screenshot({ path: path.join(output, 'new-friends-320-safe-59-header.png') });
        const themeResults = [];
        for (const width of [375, 320]) {
            await page.setViewportSize({ width, height: 844 });
            for (const themeId of themeIds) {
                await page.evaluate(themeId => { localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, themeId); applyWechatUiTheme(themeId, { update: false }); renderContacts(); ByndNpcFriends.refresh(); }, themeId);
                const appearance = await page.evaluate(() => {
                    const root = document.getElementById('app-wechat-window');
                    const inbox = document.getElementById('bynd-npc-friends');
                    const parent = inbox.parentElement;
                    const styles = getComputedStyle(inbox);
                    const probe = document.createElement('span');
                    probe.style.color = getComputedStyle(root).getPropertyValue('--wc-theme-text');
                    probe.style.position = 'absolute';
                    probe.style.visibility = 'hidden';
                    inbox.appendChild(probe);
                    const expectedText = getComputedStyle(probe).color;
                    probe.remove();
                    return { theme: parent.dataset.wechatUiTheme, text: styles.color, expectedText,
                        bg: styles.backgroundColor, image: styles.backgroundImage,
                        font: styles.fontFamily, headerImage: getComputedStyle(inbox.querySelector('.wc-npc-header')).backgroundImage,
                        avatarRadius: getComputedStyle(inbox.querySelector('.wc-npc-avatar')).borderRadius,
                        buttonShadow: getComputedStyle(inbox.querySelector('.wc-npc-accept')).boxShadow,
                        entryColor: getComputedStyle(document.querySelector('.wc-npc-entry')).color,
                        overflow: inbox.scrollWidth > inbox.clientWidth, headerY: inbox.querySelector('.wc-npc-header button').getBoundingClientRect().y };
                });
                assert.equal(appearance.theme, themeId);
                await page.waitForFunction(() => [...document.querySelectorAll('.wc-npc-avatar')].every(img => img.complete && img.naturalWidth > 0));
                assert.equal(appearance.text, appearance.expectedText, `${themeId}: inherited text palette`);
                assert.equal(appearance.entryColor, appearance.expectedText, `${themeId}: themed contacts entry`);
                assert.equal(appearance.overflow, false, `${themeId}/${width}: no horizontal overflow`);
                assert.ok(appearance.headerY >= 59, `${themeId}/${width}: top safe area`);
                if (themeId === 'pixel') { assert.match(appearance.font, /Courier/); assert.equal(appearance.avatarRadius, '1px'); assert.notEqual(appearance.buttonShadow, 'none'); }
                if (['qq', 'telegram', 'line', 'hallowrok', 'douyin', 'rednote'].includes(themeId)) assert.equal(appearance.avatarRadius, '50%');
                if (themeId === 'qq') assert.match(appearance.headerImage, /linear-gradient/);
                if (themeId === 'couple') assert.match(appearance.image, /linear-gradient/);
                themeResults.push({ width, ...appearance });
                await page.locator('#wc-npc-search').blur();
                await page.screenshot({ path: path.join(output, `theme-${themeId}-${width}.png`) });
                await page.locator('[data-npc-action="detail"]').click();
                await page.screenshot({ path: path.join(output, `detail-${themeId}-${width}.png`) });
                await page.locator('[data-npc-action="back"]').click();
            }
        }
        fs.writeFileSync(path.join(output, 'theme-checks.json'), JSON.stringify(themeResults, null, 2));
        await page.evaluate(() => { localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, 'wechat'); applyWechatUiTheme('wechat', { update: false }); ByndNpcFriends.refresh(); });
        await page.locator('[data-npc-action="detail"]').click();
        await page.screenshot({ path: path.join(output, 'verification-detail.png') });
        const id = await page.evaluate(() => ByndNpcFriends.rows()[0].request.id);
        const longOpening = '上官小姐你好啊！通过得挺快嘛。我是谢昭南，就江闻远那块木头的发小。前两天聚餐时听他提起要找我拿份材料/留几张内场通行证给你，顺手把你的联系方式推给我了。在燕京有什么想玩的或者需要帮忙的尽管提，我这儿管够！';
        await page.evaluate(text => { ByndNpcFriends.rows()[0].request.card.firstMessage = text; }, longOpening);
        await page.evaluate(() => { window._npcOriginalSave = saveCharactersToStorage; saveCharactersToStorage = async () => false; });
        await page.locator('[data-npc-action="accept"]').click();
        await page.locator('.wc-npc-error').waitFor();
        assert.equal(await page.evaluate(() => myCharacters.length), 1);
        assert.equal(await page.evaluate(() => ByndNpcFriends.pendingCount()), 1);
        await page.screenshot({ path: path.join(output, 'new-friends-save-failure.png') });
        await page.evaluate(() => { saveCharactersToStorage = window._npcOriginalSave; });
        await page.locator('[data-npc-action="accept"]').click();
        await page.locator('[data-npc-action="chat"]').waitFor();
        assert.equal(await page.evaluate(() => myCharacters.length), 2);
        assert.equal(await page.evaluate(() => ByndNpcFriends.pendingCount()), 0);
        await page.locator('[data-npc-action="chat"]').click();
        assert.equal(await page.evaluate(() => window.currentChatCharId), 'world_' + id);
        const openingParts = await page.evaluate(text => ByndNpcFriends.splitOpening(text), longOpening);
        assert.ok(openingParts.length >= 3);
        assert.deepEqual(await page.locator('#chat-room-content .msg-text').allTextContents(), openingParts, 'new contacts show independent opening bubbles');
        assert.equal(await page.evaluate(() => myCharacters.find(char => char.id === currentChatCharId).history.length), openingParts.length, 'each new bubble is an actual saved message');
        await page.evaluate(text => {
            const char = myCharacters.find(char => char.id === currentChatCharId);
            // Emulate an older saved contact with a single long opening record.
            char.history = [{ ...char.history[0], content: text }];
            char.first_mes = text;
            char.first_mes_original = text;
        }, longOpening);
        for (const themeId of themeIds) {
            await page.evaluate(themeId => {
                localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, themeId);
                applyWechatUiTheme(themeId);
                refreshChatView(myCharacters.find(char => char.id === currentChatCharId));
            }, themeId);
            assert.deepEqual(await page.locator('#chat-room-content .msg-text').allTextContents(), openingParts, `${themeId}: legacy opening is separate bubbles`);
            assert.equal(await page.locator('#chat-room-content .msg-row.left').count(), openingParts.length, `${themeId}: independent message rows`);
            assert.equal(await page.evaluate(() => myCharacters.find(char => char.id === currentChatCharId).history.length), 1, 'display compatibility does not rewrite old history');
            assert.equal(await page.evaluate(() => myCharacters.find(char => char.id === currentChatCharId).history[0].content), longOpening, 'original content is preserved');
            await page.screenshot({ path: path.join(output, `opening-bubbles-${themeId}-320.png`) });
        }
        const legacySegments = ['上官小姐你好啊！通过得挺快嘛。我是谢昭南，就江闻远那块木头的发小。', '前两天聚餐时听他提起要找我拿份材料/留几张内场通行证给你，顺手把你的联系方式推给我了。', '在燕京有什么想玩的或者需要帮忙的尽管提，我这儿管够！'];
        const slashParts = await page.evaluate(parts => {
            const char = myCharacters.find(char => char.id === currentChatCharId);
            char.history = parts.map(content => ({ type: 'text', isMe: false, content, timestamp: Date.now() }));
            char.first_mes = parts.join(''); char.first_mes_original = char.first_mes;
            return parts.flatMap(text => ByndNpcFriends.splitOpening(text));
        }, legacySegments);
        assert.equal(slashParts.length, 4);
        for (const themeId of themeIds) {
            await page.evaluate(themeId => {
                localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, themeId); applyWechatUiTheme(themeId);
                refreshChatView(myCharacters.find(char => char.id === currentChatCharId));
            }, themeId);
            assert.deepEqual(await page.locator('#chat-room-content .msg-text').allTextContents(), slashParts, `${themeId}: slash in a middle opening record becomes independent bubbles`);
            assert.deepEqual(await page.locator('#chat-room-content .msg-row.left').evaluateAll(rows => rows.map(row => row.dataset.msgIdx)), ['0', '1', '1', '2'], 'bubble actions retain the original history index');
            assert.deepEqual(await page.evaluate(() => myCharacters.find(char => char.id === currentChatCharId).history.map(msg => msg.content)), legacySegments, 'display compatibility preserves saved history');
            await page.screenshot({ path: path.join(output, `opening-slash-${themeId}-320.png`) });
        }
        // Decode every bundled fallback offline. Generated data URLs exercise canvas below.
        await page.evaluate(async () => {
            for (const src of ByndNpcFriends.defaultAvatars) {
                const image = new Image(); image.src = src; await image.decode();
                if (image.naturalWidth !== 256 || image.naturalHeight !== 256) throw new Error('Invalid default dimensions: ' + src);
            }
            await ByndNpcFriends.open();
        });
        await page.locator('[data-npc-action="detail"]').click();
        await page.evaluate(() => {
            window._npcImageCalls = 0;
            window.getImageRouteForFeature = () => ({ provider: 'api', api: { baseUrl: 'https://fixture.invalid', imageModel: 'fixture-image' } });
            window.callWechatImageGenerationApi = () => {
                window._npcImageCalls++;
                return new Promise(resolve => { window._npcFinishImage = resolve; });
            };
            window._npcAvatarWork = ByndNpcFriends.ensureAvatar(ByndNpcFriends.rows()[0].request.id);
        });
        await page.waitForFunction(() => typeof window._npcFinishImage === 'function');
        for (const themeId of themeIds) {
            await page.evaluate(themeId => { localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, themeId); applyWechatUiTheme(themeId, { update: false }); ByndNpcFriends.refresh(); }, themeId);
            assert.equal(await page.locator('#bynd-npc-friends').evaluate(node => node.parentElement.dataset.wechatUiTheme), themeId);
            assert.equal(await page.locator('.wc-npc-avatar-note').textContent(), '头像生成中…');
            assert.equal(await page.locator('#bynd-npc-friends').evaluate(node => node.scrollWidth <= node.clientWidth), true);
            await page.screenshot({ path: path.join(output, `avatar-pending-${themeId}-320.png`) });
        }
        await page.evaluate(async () => { window._npcFinishImage({ ok: false, error: '测试：生图服务暂时不可用' }); await window._npcAvatarWork; });
        for (const themeId of themeIds) {
            await page.evaluate(themeId => { localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, themeId); applyWechatUiTheme(themeId, { update: false }); ByndNpcFriends.refresh(); }, themeId);
            assert.equal(await page.locator('#bynd-npc-friends').evaluate(node => node.parentElement.dataset.wechatUiTheme), themeId);
            await page.locator('[data-npc-action="avatar"]').waitFor();
            assert.equal(await page.locator('.wc-npc-avatar').evaluate(img => img.complete && img.naturalWidth === 256), true);
            await page.screenshot({ path: path.join(output, `avatar-error-${themeId}-320.png`) });
        }
        const fixture = 'data:image/webp;base64,' + fs.readFileSync(path.join(root, 'assets/avatars/npc-default-paw-v1.webp')).toString('base64');
        await page.evaluate(fixture => {
            window.callWechatImageGenerationApi = async () => { window._npcImageCalls++; return { ok: true, url: fixture }; };
            window._npcOriginalSave = saveCharactersToStorage;
            let writes = 0;
            saveCharactersToStorage = async () => ++writes === 1 ? window._npcOriginalSave() : false;
        }, fixture);
        await page.locator('[data-npc-action="avatar"]').click();
        await page.waitForFunction(() => document.querySelector('.wc-npc-error')?.textContent.includes('保存失败'));
        assert.notEqual(await page.evaluate(() => ByndNpcFriends.rows()[0].request.avatarState), 'ready');
        await page.locator('[data-npc-action="avatar"]').waitFor();
        await page.screenshot({ path: path.join(output, 'avatar-storage-failure-320.png') });
        await page.evaluate(() => { saveCharactersToStorage = window._npcOriginalSave; });
        await page.locator('[data-npc-action="avatar"]').click();
        await page.waitForFunction(() => ByndNpcFriends.rows()[0].request.avatarState === 'ready');
        for (const themeId of themeIds) {
            await page.evaluate(themeId => { localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, themeId); applyWechatUiTheme(themeId, { update: false }); ByndNpcFriends.refresh(); }, themeId);
            assert.equal(await page.locator('#bynd-npc-friends').evaluate(node => node.parentElement.dataset.wechatUiTheme), themeId);
            await page.waitForFunction(() => { const img = document.querySelector('.wc-npc-avatar'); return img?.complete && img.naturalWidth > 0; });
            assert.equal(await page.locator('.wc-npc-avatar').evaluate(img => img.src.startsWith('data:image/')), true);
            assert.equal(await page.locator('.wc-npc-error').count(), 0, 'successful retry clears previous avatar errors');
            assert.equal(await page.evaluate(() => myCharacters[1].avatar === ByndNpcFriends.rows()[0].request.avatar), true);
            await page.screenshot({ path: path.join(output, `avatar-ready-${themeId}-320.png`) });
        }
        await page.locator('[data-npc-action="chat"]').click();
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('#chat-room-content .msg-row.left img')].some(img => img.src === myCharacters[1].avatar)), true);
        assert.equal(await page.evaluate(() => window._npcImageCalls), 3, 'one initial failure plus two explicit retries');
        assert.deepEqual(errors, []);
        console.log(`New friends browser checks passed: contacts-only inbox, real chat reply/hidden decision, silence on ordinary chat, search, storage failure/retry, acceptance/chat; ${themeIds.length} themes in empty/list states at 320/375px, live theme switching and 47/59px safe areas.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
