'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/discover-story');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
        await page.waitForFunction(() => !!window.ByndChannels && !!window.ByndLive);
        await page.addStyleTag({ content: '.tapfx-layer { visibility:hidden!important; }' });
        await page.evaluate(async () => {
            await byndStylesReady; await window._wechatCharactersLoadPromise;
            localStorage.removeItem(WECHAT_VIDEO_STORAGE_KEY); localStorage.removeItem(WECHAT_LIVE_STORAGE_KEY);
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            unlockPhone(); openApp('wechat'); ByndBuiltinLibrary?.close();
            window.myCharacters = [{ id: 'discover-lin', name: '林舟', description: '温和的书店老板，喜欢推理小说。', avatar: 'assets/avatars/npc-default-pearl-v1.webp', history: [{ type: 'text', isMe: true, content: '今天在书店直播聊新书吗？', timestamp: 1 }, { type: 'text', isMe: false, content: '刚摆好书架，准备给大家介绍一下。', timestamp: 2 }], worldBook: [{ content: '许青是林舟的同事，活泼，常来店里帮忙。' }], chatConfig: {} }];
            const phone = document.querySelector('.phone-container');
            phone.style.cssText += ';position:absolute!important;inset:0!important;width:100vw!important;max-width:none!important;height:100dvh!important;max-height:none!important;transform:none!important;border:0!important;border-radius:0!important;margin:0!important;--bynd-header-safe-top:59px;';
            window._discoverCalls = [];
            window._discoverFail = false;
            callChatApi = async messages => {
                const task = JSON.parse(messages[1].content).task;
                window._discoverCalls.push(task);
                if (window._discoverFail) return { ok: false, error: '测试：暂时无法连接' };
                if (window._discoverHold) await new Promise(resolve => { window._discoverRelease = resolve; });
                const actor = { charId: 'discover-lin' };
                let data;
                if ('previous' in task && !('requestedTopic' in task)) data = { needed: true, videos: [{ author: actor, title: '书店新书到了', description: '下班前，整理一下窗边的书。', scenes: [{ caption: '这一本留给喜欢推理的你。', visual: '夕阳照在窗边的书架上' }, { caption: '下一页就不剧透了。', visual: '林舟轻轻翻开封面' }], comments: [{ actor: { name: '许青', sourceEntryIndexes: [0] }, text: '我已经帮你摆好啦。' }] }] };
                else if ('requestedTopic' in task) data = { needed: true, title: '书店晚间闲谈', category: '访谈', caption: '林舟搬来一把椅子，坐在书架旁。', lines: [{ actor, text: '晚上好，今天聊聊刚到的新书。' }, { actor: { name: '许青', sourceEntryIndexes: [0] }, text: '我来抢前排！' }], choices: ['先聊推理小说', '看看窗边书架'] };
                else if (task.action?.startsWith('watch')) data = { reply: '一起看：' + task.userText, privateMessage: task.action === 'watch-end' ? '刚才一起看的那本，我帮你留一份。' : '' };
                else if (task.action === 'user-post') data = { replies: [{ actor, text: '你读的是窗边那本吗？下次一起聊结局。' }, { actor: { name: '许青', sourceEntryIndexes: [0] }, text: '我也喜欢这本，忍住不剧透。' }], likes: [actor], privateMessage: '' };
                else if (task.action === 'like' || task.action === 'comment') data = { replies: task.action === 'comment' ? [{ actor, text: task.replyTo ? '接着你回复许青的话：她也想看这本。' : '你问的这本，我给你留着。' }] : [], privateMessage: task.action === 'like' ? '看到你给我的作品点赞啦。' : '' };
                else data = { caption: task.action === 'end' ? '林舟合上书，和大家道别。' : '直播继续：' + task.userText, lines: [{ actor, text: '回应你的' + task.action + '：' + task.userText }, { actor: { name: '许青', sourceEntryIndexes: [0] }, text: '我也来聊两句！' }], choices: ['接着读简介', '看看另一本'], privateMessage: task.action === 'end' ? '收播啦，刚才你点的歌下次单独唱给你听。' : '' };
                return { ok: true, content: JSON.stringify(data) };
            };
            openWechatChannels();
        });
        const action = name => page.locator(`[data-ds-action="${name}"]`);
        assert.equal(await page.evaluate(() => window._discoverCalls.length), 0, 'opening does not regenerate');
        await action('publish').click();
        await page.locator('.wc-ds-card').waitFor();
        assert.equal(await page.evaluate(() => ByndChannels.state().videos.length), 1);
        await action('perspective').click();
        await page.getByRole('dialog').waitFor();
        assert.equal(await page.locator('[data-ds-action="perspective-select"][data-id="user"]').count(), 1);
        await page.locator('[data-ds-action="perspective-select"][data-id="discover-lin"]').click();
        await page.getByText('林舟的视角', { exact: true }).waitFor();
        assert.match(await page.evaluate(() => buildSystemPrompt(myCharacters[0])), /来看了林舟的视频号视角/);
        assert.equal(await action('follow').count(), 0, 'own works never offer self-follow');
        await action('comments').click();
        assert.match(await page.locator('.wc-ds-input-label').textContent(), /写评论 · 林舟/);
        await page.locator('.wc-ds-comment-row .wc-ds-comment-text').first().click();
        assert.match(await page.locator('.wc-ds-input-label').textContent(), /回复 许青 · 林舟/);
        await page.locator('#wc-ds-comment').fill('许青，帮你把这一本留下。'); await action('comment-send').click();
        await page.waitForFunction(() => ByndChannels.state().events.every(item => item.status === 'done'));
        assert.equal(await page.evaluate(() => ByndChannels.state().comments[ByndChannels.state().videos[0].id][0].actor.charId), 'discover-lin');
        assert.equal(await page.evaluate(() => myCharacters[0].history.filter(msg => msg.discoverEventId).length), 0);
        await page.evaluate(() => ByndChannels.setPerspective('user'));
        await action('follow').click(); await action('fav').click();
        await action('like').click();
        await page.waitForFunction(() => myCharacters[0].history.some(msg => msg.discoverEventId));
        assert.notEqual(await page.evaluate(() => ByndChannels.state().events.find(item => item.kind === 'like').actor.name), '林舟', 'switching back to user restores the user identity');
        assert.equal(await page.evaluate(() => myCharacters[0].history.filter(msg => msg.discoverEventId).length), 1);
        await action('comments').click();
        await page.locator('#wc-ds-comment').fill('可以给我留这本书吗？');
        await action('comment-send').click();
        await page.getByText('你问的这本，我给你留着。', { exact: false }).waitFor();
        await page.evaluate(() => { window._discoverFail = true; });
        await page.locator('#wc-ds-comment').fill('第二本呢？');
        await action('comment-send').click(); await action('retry').waitFor();
        await page.screenshot({ path: path.join(output, 'comment-error-375.png') });
        await page.evaluate(() => { window._discoverFail = false; });
        await action('retry').click();
        await page.waitForFunction(() => ByndChannels.state().events.every(event => event.status === 'done'));
        assert.equal(await page.evaluate(() => ByndChannels.state().comments[ByndChannels.state().videos[0].id].filter(comment => comment.user).length), 2);
        await page.evaluate(() => { window._discoverHold = true; });
        await page.locator('#wc-ds-comment').fill('第一条先发送'); await action('comment-send').click();
        await page.waitForFunction(() => typeof window._discoverRelease === 'function');
        await page.locator('#wc-ds-comment').fill('回应期间新写的草稿不要丢');
        await page.evaluate(() => { window._discoverHold = false; window._discoverRelease(); window._discoverRelease = null; });
        await page.waitForFunction(() => ByndChannels.state().events.every(event => event.status === 'done'));
        assert.equal(await page.locator('#wc-ds-comment').inputValue(), '回应期间新写的草稿不要丢');
        await action('reply').first().click();
        assert.equal(await page.locator('#wc-ds-comment').inputValue(), '回应期间新写的草稿不要丢');
        await page.locator('#wc-ds-comment').fill('许青，你最推荐哪本？'); await action('comment-send').click();
        await page.getByText('接着你回复许青的话：她也想看这本。', { exact: false }).waitFor();
        assert.equal(await page.evaluate(() => window._discoverCalls.at(-1).replyTo.name), '许青');
        await page.locator('#wc-ds-comment').fill('回应期间新写的草稿不要丢');
        await page.evaluate(() => { window._discoverWrite = writeWechatStore; writeWechatStore = () => { throw new Error('测试：存储已满'); }; });
        await action('comment-send').click();
        await page.getByRole('alert').waitFor();
        assert.equal(await page.locator('#wc-ds-comment').inputValue(), '回应期间新写的草稿不要丢', 'a failed initial save keeps the draft');
        await page.evaluate(() => { writeWechatStore = window._discoverWrite; });
        await action('back').click(); await action('invite').click(); await action('watch-start').click();
        await page.waitForFunction(() => Object.values(ByndChannels.state().watches)[0]?.messages.length === 2);
        await page.locator('#wc-ds-watch-input').fill('这个镜头真好看'); await action('watch-send').click();
        await page.waitForFunction(() => Object.values(ByndChannels.state().watches)[0]?.messages.length === 4);
        await action('watch-next').click(); await page.waitForFunction(() => Object.values(ByndChannels.state().watches)[0]?.sceneIndex === 1);
        await page.screenshot({ path: path.join(output, 'watch-375.png') });
        await action('watch-end').click(); await page.waitForFunction(() => Object.values(ByndChannels.state().watches)[0]?.status === 'ended');
        await page.evaluate(() => openWechatLive()); await action('publish').click();
        await page.locator('.wc-ds-live-card').waitFor(); await action('enter').click();
        await page.waitForFunction(() => ByndLive.state().rooms[0].version === 1);
        await page.locator('#wc-ds-live-input').fill('先看窗边那本书'); await action('send').click();
        await page.waitForFunction(() => ByndLive.state().rooms[0].version === 2);
        assert.match(await page.locator('.wc-ds-live-stage').textContent(), /先看窗边那本书/);
        await page.locator('#wc-ds-live-kind').selectOption('song'); await page.locator('#wc-ds-live-input').fill('唱一段轻松的歌吧'); await action('send').click();
        await page.waitForFunction(() => ByndLive.state().rooms[0].version === 3);
        await action('options').click(); await action('choice').first().click(); await page.waitForFunction(() => ByndLive.state().rooms[0].version === 4);
        await page.screenshot({ path: path.join(output, 'live-interactive-375.png') });
        const themes = await page.evaluate(() => WECHAT_UI_THEMES.map(item => item.id));
        for (const width of [375, 320]) {
            await page.setViewportSize({ width, height: 844 });
            for (const theme of themes) {
                await page.evaluate(theme => { localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, theme); applyWechatUiTheme(theme, { update: false }); ByndDiscoverStory.refresh(); }, theme);
                for (const view of ['live', 'video', 'comments', 'watch', 'invite']) {
                    if (view === 'live') await page.evaluate(async () => { openWechatLive(); await ByndLive.enter(ByndLive.state().rooms[0].id); });
                    if (view === 'video') await page.evaluate(() => openWechatChannels());
                    if (view === 'comments') await action('comments').click();
                    if (view === 'watch') { await page.evaluate(async () => { await ByndChannels.startWatch(ByndChannels.state().videos[0].id, 'discover-lin'); }); }
                    if (view === 'invite') { await page.evaluate(() => openWechatChannels()); await action('invite').click(); }
                    const metrics = await page.locator('.wc-ds').evaluate(node => {
                        const card = node.querySelector('.wc-ds-card'), avatar = node.querySelector('.wc-ds-avatar');
                        return { overflow: node.scrollWidth > node.clientWidth, bodyOverflow: document.getElementById('wc-feature-body').scrollWidth > document.getElementById('wc-feature-body').clientWidth, font: getComputedStyle(node).fontFamily, radius: card ? getComputedStyle(card).borderRadius : '', avatarRadius: avatar ? getComputedStyle(avatar).borderRadius : '' };
                    });
                    assert.equal(metrics.overflow || metrics.bodyOverflow, false, theme + '/' + view + ': no horizontal clipping');
                    if (theme === 'pixel') { assert.match(metrics.font, /Courier/); if (metrics.radius) assert.equal(metrics.radius, '1px'); }
                    if (theme === 'couple' && metrics.radius) assert.equal(metrics.radius, '22px');
                    await page.screenshot({ path: path.join(output, `${view}-${theme}-${width}.png`) });
                }
                await page.evaluate(() => openWechatChannels()); await action('perspective').click();
                const panel = page.getByRole('dialog');
                assert.ok((await panel.boundingBox()).width <= width);
                assert.equal(await panel.evaluate(node => node.scrollWidth > node.clientWidth), false);
                assert.match(await panel.textContent(), /我的视角/);
                await page.screenshot({ path: path.join(output, `perspective-${theme}-${width}.png`) });
                await page.keyboard.press('Escape'); assert.equal(await panel.count(), 0);
                await page.evaluate(() => ByndChannels.setPerspective('discover-lin'));
                assert.equal(await action('follow').count(), 0);
                assert.equal(await action('like').getAttribute('aria-pressed'), 'false', 'role does not inherit user likes');
                assert.equal(await action('fav').getAttribute('aria-pressed'), 'false', 'role does not inherit user favourites');
                await page.screenshot({ path: path.join(output, `role-own-${theme}-${width}.png`) });
                await action('comments').click();
                assert.match(await page.locator('.wc-ds-input-label').textContent(), /写评论 · 林舟/);
                assert.equal(await page.locator('.wc-ds-comment-row > button').count(), 0);
                assert.equal(await action('reply').first().getAttribute('type'), 'button');
                await page.locator('.wc-ds-feed').evaluate(node => { node.scrollTop = node.scrollHeight; });
                await page.screenshot({ path: path.join(output, `role-comments-${theme}-${width}.png`) });
                await page.evaluate(() => ByndChannels.setPerspective('user'));
                await page.evaluate(() => { window._visualVideoState = ByndChannels.state(); ByndDiscoverStory.save('video', { ...window._visualVideoState, videos: [], watches: {} }); openWechatChannels(); });
                await page.screenshot({ path: path.join(output, `empty-${theme}-${width}.png`) });
                await page.evaluate(() => {
                    ByndDiscoverStory.save('video', window._visualVideoState);
                    ByndDiscoverStory.event('video', { id: 'visual-failed-event', kind: 'comment', targetId: ByndChannels.state().videos[0].id, text: '这条评论尚未收到回应', status: 'error', error: '暂时无法连接，请重试' });
                    openWechatChannels();
                });
                await action('retry').waitFor();
                await page.screenshot({ path: path.join(output, `error-${theme}-${width}.png`) });
                await page.evaluate(() => {
                    ByndDiscoverStory.save('video', window._visualVideoState); openWechatChannels();
                    window._visualJob = ByndDiscoverStory.run('publish:video:discover-lin', () => new Promise(resolve => { window._releaseVisual = resolve; }), ByndDiscoverStory.refresh);
                });
                await page.waitForFunction(() => typeof window._releaseVisual === 'function');
                assert.equal(await action('publish').isDisabled(), true);
                await page.screenshot({ path: path.join(output, `loading-${theme}-${width}.png`) });
                await page.evaluate(async () => { window._releaseVisual(true); await window._visualJob; window._releaseVisual = null; });
            }
        }
        // User is a publisher in the same world; actor/NPC replies stay public and feed ordinary private-chat context.
        await page.evaluate(() => openWechatChannels()); await action('compose').click();
        await page.locator('#wc-ds-post').fill('今天在窗边读完了那本推理小说，结局比想象中温柔。');
        await action('audience').click(); await action('picker-close').click();
        assert.match(await page.locator('#wc-ds-post').inputValue(), /结局比想象中温柔/);
        await action('post-send').click();
        await page.waitForFunction(() => ByndChannels.state().events.filter(item => item.kind === 'user-post').every(item => item.status === 'done'));
        assert.equal(await page.evaluate(() => ByndChannels.state().videos.at(-1).author.key), 'user');
        assert.match(await page.locator('.wc-ds-feed').textContent(), /林舟 赞过/);
        await action('comments').click();
        await page.getByText('我也喜欢这本，忍住不剧透。', { exact: false }).waitFor();
        assert.match(await page.evaluate(() => buildSystemPrompt(myCharacters[0])), /结局比想象中温柔/);
        for (const theme of ['pixel', 'couple']) {
            await page.evaluate(theme => { applyWechatUiTheme(theme, { update: false }); ByndDiscoverStory.refresh(); }, theme);
            await page.locator('.wc-ds-feed').evaluate(node => { node.scrollTop = 0; });
            await page.screenshot({ path: path.join(output, `user-work-${theme}-320.png`) });
        }
        await action('share').click(); await action('share-send').click();
        await page.waitForFunction(() => ByndChannels.state().outbox.some(item => item.messages.some(msg => msg.card?.source === '视频号 · 转发') && item.status === 'sent'));
        assert.match(await page.evaluate(() => buildSystemPrompt(myCharacters[0])), /转发了这条作品/);
        await page.evaluate(async () => { openWechatLive(); await ByndLive.enter(ByndLive.state().rooms[0].id); });
        // Save failure during delivery must retain a visible retry with no ghost message.
        const before = await page.evaluate(() => myCharacters[0].history.length);
        await page.evaluate(() => { window._discoverSave = saveCharactersToStorage; saveCharactersToStorage = async () => false; });
        await action('media-options').click(); await action('end').click(); await action('delivery').waitFor();
        assert.equal(await page.evaluate(() => myCharacters[0].history.length), before);
        await page.screenshot({ path: path.join(output, 'live-delivery-failure.png') });
        await page.evaluate(() => { saveCharactersToStorage = window._discoverSave; });
        await action('delivery').click();
        await page.waitForFunction(() => ByndLive.state().outbox.every(item => item.status === 'sent'));
        assert.equal(await page.evaluate(() => myCharacters[0].history.length), before + 1);
        await page.evaluate(async () => { await ByndDiscoverStory.deliver('live'); });
        assert.equal(await page.evaluate(() => myCharacters[0].history.length), before + 1);
        for (const safe of [47, 59]) for (const mode of ['parent', 'header']) {
            await page.evaluate(({ safe, mode }) => { const phone = document.querySelector('.phone-container'); phone.style.setProperty('top', (mode === 'parent' ? safe : 0) + 'px', 'important'); phone.style.setProperty('height', `calc(100dvh - ${mode === 'parent' ? safe : 0}px)`, 'important'); phone.style.setProperty('--bynd-header-safe-top', (mode === 'header' ? safe : 0) + 'px'); openWechatChannels(); }, { safe, mode });
            assert.ok((await page.locator('.wc-feature-header > i').boundingBox()).y >= safe);
            assert.equal(Math.round((await page.locator('.wc-feature-header').boundingBox()).height), 48 + (mode === 'header' ? safe : 0));
        }
        // Persisted keys reopen without API calls; unfinished interactions remain available.
        const callCount = await page.evaluate(() => window._discoverCalls.length);
        await page.evaluate(() => { openWechatChannels(); openWechatLive(); });
        assert.equal(await page.evaluate(() => window._discoverCalls.length), callCount);
        await page.evaluate(() => { closeWechatFeatureScreen(); openChat('discover-lin'); });
        assert.match(await page.locator('#chat-room-content').textContent(), /看到你给我的作品点赞/);
        assert.match(await page.locator('#chat-room-content').textContent(), /收播啦/);
        await page.reload();
        await page.waitForFunction(() => !!window.ByndLive && !!window.ByndChannels);
        await page.evaluate(async () => { await window._wechatCharactersLoadPromise; callChatApi = async () => { throw new Error('重新打开历史不应该请求 API'); }; openApp('wechat'); openWechatChannels(); });
        assert.equal(await page.evaluate(() => ByndChannels.state().videos.length), 2);
        // The prompt is bounded to recent facts. The initial visit may fall out
        // after this long scenario, but must remain in persisted history.
        assert.equal(await page.evaluate(() => ByndChannels.state().activity.some(row => row.kind === 'visit' && row.actor?.user && row.knownBy?.includes('discover-lin'))), true);
        assert.match(await page.evaluate(() => buildSystemPrompt(myCharacters.find(char => char.id === 'discover-lin'))), /"kind":"comment","actor":\{"key":"char:discover-lin"/);
        assert.equal(await page.evaluate(() => ByndLive.state().rooms[0].status), 'ended');
        assert.ok(await page.evaluate(() => myCharacters.find(char => char.id === 'discover-lin').history.some(msg => msg.discoverEventId)));
        assert.deepEqual(errors, []);
        console.log(`Discovery story browser passed: comments/retry, likes/private chat, shared watch, live actions/choices/song/end/delivery, ${themes.length} themes at 320/375px, 47/59px safe areas.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
