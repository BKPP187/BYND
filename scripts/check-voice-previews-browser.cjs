// Real browser/audio playback against fixture providers; no account credits are consumed.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.qa-screenshots/voice-previews'); fs.mkdirSync(output, { recursive: true });
const wav = Buffer.alloc(44 + 16000 * 2 * 6); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 44; i < wav.length; i += 2) wav.writeInt16LE(Math.round(200 * Math.sin((i - 44) * Math.PI * 220 / 16000)), i);
const mini = { system_voice: ['Gentleman', 'Reliable_Executive'].map(voice => ({ voice_id: `Chinese (Mandarin)_${voice}`, voice_name: voice })), base_resp: { status_code: 0 } };
const fishVoice = (id, title, sample = true) => ({ _id: id, title, state: 'trained', languages: ['zh'], tags: ['男声'], description: '温暖自然的中文声音，用于测试名称搜索和角色独立音色。', samples: sample ? [{ audio: `https://samples.invalid/${id}.wav` }] : [] });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const generated = [], lists = [], errors = []; let balance = false, delayGenerate = false, listFail = false, delayList = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.host === 'samples.invalid') return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
        if (url.pathname.endsWith('/get_voice')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mini) });
        if (url.pathname.endsWith('/model')) {
            lists.push({ query: Object.fromEntries(url.searchParams), auth: request.headers().authorization });
            const query = url.searchParams.get('title') || '', mine = url.searchParams.get('self') === 'true', next = url.searchParams.get('page_number') === '2';
            const items = query === '无结果' ? [] : mine ? [fishVoice('private-b', '我的私人音色')] : query ? [fishVoice('search-b', `搜索结果 ${query}`)] : next ? [fishVoice('page-b', '第二页声音')] : [fishVoice('voice-a', '沉稳中文男声'), fishVoice('voice-b', '温柔中文男声', false)];
            const body = JSON.stringify(listFail ? { message: 'denied' } : { total: items.length + (!mine && !query ? 1 : 0), items, has_more: !mine && !query && !next });
            const status = listFail ? 401 : 200;
            if (delayList) await new Promise(resolve => setTimeout(resolve, 450));
            return route.fulfill({ status, contentType: 'application/json', body });
        }
        if (url.pathname.endsWith('/t2a_v2') || url.pathname.endsWith('/audio/speech')) {
            const body = request.postDataJSON(); generated.push({ url: url.href, body });
            const bad = balance;
            if (delayGenerate) await new Promise(resolve => setTimeout(resolve, 450));
            if (url.pathname.endsWith('/t2a_v2')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bad ? { base_resp: { status_code: 1008, status_msg: 'insufficient balance' } } : { data: { audio: wav.toString('hex') }, extra_info: { audio_length: 6000 }, base_resp: { status_code: 0 } }) });
            return bad ? route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ message: 'insufficient balance' }) }) : route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
        }
        return route.abort();
    });
    await page.addInitScript(version => {
        localStorage.setItem('bynd_lastSeenVersion', version); localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        if (!localStorage.getItem('my_api_data')) localStorage.setItem('my_api_data', JSON.stringify({ voiceApi: { enabled: true, baseUrl: 'https://api.minimax.io', apiKey: 'mini-key', voiceModel: 'speech-2.8-turbo', voiceId: '', voiceFormat: 'wav' }, fishAudioVoiceApi: { enabled: true, baseUrl: 'https://api.fish.audio/compat/v1', apiKey: 'fish-key', voiceModel: 'fish-audio/s2.1-pro-free', voiceId: 'original', voiceFormat: 'wav' } }));
        if (!localStorage.getItem('my_characters_data')) localStorage.setItem('my_characters_data', JSON.stringify(['a', 'b'].map(id => ({ id, name: `${id}测试员`, history: [], chatConfig: {} }))));
        const Original = window.Audio; window._qaAudios = [];
        window.Audio = class extends Original { constructor(...args) { super(...args); window._qaAudios.push(this); } };
    }, require('./bump-version.cjs').currentVersion());
    const ready = async () => { await page.waitForFunction(() => window.__byndCoreReady && window.ByndFishVoices); await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); }); };
    const playing = () => page.waitForFunction(() => window._qaAudios.at(-1)?.paused === false);
    const stopped = () => page.waitForFunction(() => window._qaAudios.every(audio => audio.paused));
    const loaded = prefix => page.waitForFunction(prefix => /已加载|账户返回/.test(document.getElementById(`${prefix}-status`).textContent), prefix);
    const role = async (id, provider) => { await page.evaluate(id => { openApp('wechat'); openChat(id); openChatSettings(); openWechatChatSettingsPage('voice'); }, id); await page.locator('#wcs-char-voice-provider').selectOption(provider); await loaded(provider === 'minimax' ? 'wcs-minimax-picker' : 'wcs-fish-picker'); };
    const fishButton = (id, kind, prefix = 'api-fish-picker') => page.locator(`#${prefix}-list [data-${kind}="${id}"]`);
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' }); await ready();
        await page.evaluate(() => { openApp('settings'); openApiVoiceModal(); }); await loaded('api-minimax-picker');
        assert.equal(generated.length, 0);
        await page.locator('#api-minimax-picker-voice-trigger').click();
        const miniListen = page.locator('.minimax-select-overlay .minimax-voice-listen').first();
        await miniListen.click(); await playing(); assert.equal(generated.length, 1); assert.equal(await page.locator('#api-voice-id').inputValue(), '', 'preview never selects a voice');
        await miniListen.click(); await stopped(); await miniListen.click(); await playing(); assert.equal(generated.length, 1, 'replay reuses cached audio');
        await page.keyboard.press('Escape'); await stopped();
        await page.locator('#api-minimax-picker-voice').selectOption('Chinese (Mandarin)_Gentleman');
        await page.locator('#api-minimax-picker-preview-selected').click(); await playing(); assert.equal(generated.length, 1);
        await page.locator('#api-minimax-picker-model').selectOption('speech-2.8-hd'); await stopped();
        await page.locator('#api-minimax-picker-preview-selected').click(); await playing(); assert.equal(generated.at(-1).body.model, 'speech-2.8-hd');
        await page.evaluate(() => closeApiVoiceModal()); await stopped();
        // Balance failure is readable; no cached audio from another voice/model is played.
        balance = true; await page.evaluate(() => openApiVoiceModal()); await loaded('api-minimax-picker');
        await page.locator('#api-minimax-picker-voice').selectOption('Chinese (Mandarin)_Reliable_Executive');
        const audioCount = await page.evaluate(() => _qaAudios.length);
        await page.locator('#api-minimax-picker-preview-selected').click();
        await page.waitForFunction(() => document.getElementById('api-minimax-picker-preview-status').textContent.includes('余额不足'));
        assert.equal(await page.evaluate(() => _qaAudios.length), audioCount); balance = false;
        // Closing a pending generation cannot play a late result.
        delayGenerate = true; await page.locator('#api-minimax-picker-preview-selected').click();
        await page.waitForFunction(() => document.getElementById('api-minimax-picker-preview-selected').textContent.includes('生成中'));
        await page.evaluate(() => closeApiVoiceModal()); await page.waitForTimeout(550); await stopped(); assert.equal(await page.evaluate(() => _qaAudios.length), audioCount); delayGenerate = false;
        await role('a', 'minimax'); await page.locator('#wcs-minimax-picker-model').selectOption('speech-2.8-hd'); await page.locator('#wcs-minimax-picker-voice').selectOption('Chinese (Mandarin)_Reliable_Executive');
        await page.locator('#wcs-minimax-picker-preview-selected').click(); await playing();
        assert.equal(generated.at(-1).body.voice_setting.voice_id, 'Chinese (Mandarin)_Reliable_Executive'); assert.equal(generated.at(-1).body.model, 'speech-2.8-hd');
        await page.evaluate(() => closeChatSettings()); await stopped();
        await page.evaluate(() => { openApp('settings'); openApiFishAudioVoiceModal(); }); await loaded('api-fish-picker');
        assert.equal(await page.locator('#api-fish-voice-modal details').first().getAttribute('open'), null);
        const beforeSample = generated.length;
        await fishButton('voice-a', 'preview').click(); await playing(); assert.equal(generated.length, beforeSample); assert.equal(await page.locator('#api-fish-voice-id').inputValue(), 'original');
        await fishButton('voice-b', 'preview').click(); await playing(); assert.equal(generated.length, beforeSample + 1); assert.equal(generated.at(-1).body.voice, 'voice-b');
        await fishButton('voice-b', 'preview').click(); await stopped(); await fishButton('voice-b', 'preview').click(); await playing(); assert.equal(generated.length, beforeSample + 1);
        await fishButton('voice-b', 'select').click(); await stopped(); assert.equal(await page.locator('#api-fish-voice-id').inputValue(), 'voice-b');
        balance = true;
        await page.evaluate(() => { const model = document.getElementById('api-fish-voice-model'); model.value = 'fish-audio/s2.1-pro'; model.dispatchEvent(new Event('input')); });
        const fishAudioCount = await page.evaluate(() => _qaAudios.length);
        await fishButton('voice-b', 'preview').click(); await page.waitForFunction(() => document.getElementById('api-fish-picker-preview-status').textContent.includes('余额不足'));
        assert.equal(await page.evaluate(() => _qaAudios.length), fishAudioCount); balance = false;
        await page.evaluate(() => { const model = document.getElementById('api-fish-voice-model'); model.value = 'fish-audio/s2.1-pro-free'; model.dispatchEvent(new Event('input')); });
        await page.locator('#api-fish-picker-more').click(); await page.waitForSelector('[data-select="page-b"]'); assert.equal(lists.at(-1).query.page_number, '2');
        await page.locator('#api-fish-picker-search').fill('温柔'); await page.waitForSelector('[data-select="search-b"]'); assert.equal(lists.at(-1).query.title, '温柔'); assert.equal(lists.at(-1).query.page_number, '1'); assert.equal(await page.locator('#api-fish-voice-id').inputValue(), 'voice-b');
        await page.locator('#api-fish-picker-search').fill('无结果'); await page.waitForFunction(() => document.getElementById('api-fish-picker-status').textContent.includes('没有匹配')); assert.equal(await page.locator('#api-fish-voice-id').inputValue(), 'voice-b');
        await page.locator('#api-fish-picker-search').fill(''); await loaded('api-fish-picker');
        await page.locator('#api-fish-picker-source').selectOption('mine'); await page.waitForSelector('[data-select="private-b"]'); assert.equal(lists.at(-1).query.self, 'true');
        listFail = true; await page.locator('#api-fish-picker-load').click(); await page.waitForFunction(() => document.getElementById('api-fish-picker-status').textContent.includes('HTTP 401')); assert.equal(await page.locator('#api-fish-voice-id').inputValue(), 'voice-b'); listFail = false;
        // Changing credentials invalidates private metadata and cancels stale responses.
        delayList = true; await page.locator('#api-fish-picker-load').click(); await page.locator('#api-fish-voice-key').fill('changed-fish-key'); await page.waitForTimeout(550); assert.equal(await page.locator('#api-fish-picker-list article').count(), 0); delayList = false;
        await page.locator('#api-fish-picker-source').selectOption(''); await loaded('api-fish-picker'); assert.equal(lists.at(-1).auth, 'Bearer changed-fish-key');
        // Failed storage never closes the editor or reports success.
        await page.evaluate(() => { window._qaSave = saveApiData; saveApiData = () => false; }); assert.equal(await page.evaluate(() => saveApiFishAudioVoiceSettings()), false); assert.equal(await page.locator('#api-fish-voice-modal').isVisible(), true);
        await page.evaluate(() => { saveApiData = window._qaSave; });
        const newKeyCount = generated.length; await fishButton('voice-b', 'preview').click(); await playing(); assert.equal(generated.length, newKeyCount + 1, 'changing API Key invalidates the previous sample cache'); await fishButton('voice-b', 'preview').click(); await stopped();
        // Check narrow layouts and contained menus under both safe-area owners.
        for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => { document.documentElement.classList.add('mobile-runtime'); document.body.style.paddingTop = owner === 'parent' ? `${safe}px` : '0'; const phone = document.querySelector('.phone-container'); phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? `${safe}px` : '0'); phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh'; }, { safe, owner });
            await page.locator('#api-fish-picker-search').scrollIntoViewIfNeeded();
            const geometry = await page.locator('#api-fish-voice-modal .api-voice-modal-card').evaluate(el => { const r = el.getBoundingClientRect(), p = el.closest('.phone-container').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, parentTop: p.top, parentBottom: p.bottom, overflow: el.scrollWidth - el.clientWidth }; });
            assert.ok(geometry.left >= 0 && geometry.right <= width && geometry.top >= geometry.parentTop + (owner === 'header' ? safe : 0) && geometry.bottom <= geometry.parentBottom && geometry.overflow <= 1, JSON.stringify(geometry));
            await page.screenshot({ path: path.join(output, `fish-global-${width}-${safe}-${owner}.png`) });
            await page.locator('#api-fish-picker-language-trigger').click(); await page.screenshot({ path: path.join(output, `fish-menu-${width}-${safe}-${owner}.png`) }); await page.keyboard.press('Escape');
        }
        const advanced = page.locator('#api-fish-voice-modal details').first();
        await advanced.locator('summary').click(); await page.locator('#api-fish-voice-model').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('#api-fish-voice-model').isVisible(), true); assert.equal(await page.locator('#api-fish-voice-id').inputValue(), 'voice-b');
        await page.screenshot({ path: path.join(output, 'fish-advanced-375-59-header.png') }); await advanced.locator('summary').click();
        assert.equal(await page.evaluate(() => saveApiFishAudioVoiceSettings()), true);
        await role('a', 'fish-audio'); await fishButton('voice-a', 'select', 'wcs-fish-picker').click(); assert.equal(await page.evaluate(() => saveChatSettings()), true);
        await role('b', 'fish-audio'); await fishButton('voice-b', 'select', 'wcs-fish-picker').click();
        for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => { document.documentElement.classList.add('mobile-runtime'); document.body.style.paddingTop = owner === 'parent' ? `${safe}px` : '0'; const phone = document.querySelector('.phone-container'); phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? `${safe}px` : '0'); phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh'; }, { safe, owner });
            await page.locator('#wcs-fish-picker-search').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `fish-role-${width}-${safe}-${owner}.png`) });
            await page.locator('#wcs-fish-picker-language-trigger').click();
            const box = await page.locator('.fish-select-overlay .elevenlabs-select-sheet').evaluate(el => { const r = el.getBoundingClientRect(), p = el.closest('.phone-container').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, parentTop: p.top, parentBottom: p.bottom, overflow: el.scrollWidth - el.clientWidth }; });
            assert.ok(box.left >= 0 && box.right <= width && box.top >= box.parentTop + (owner === 'header' ? safe : 0) && box.bottom <= box.parentBottom && box.overflow <= 1, JSON.stringify(box));
            await page.screenshot({ path: path.join(output, `fish-role-menu-${width}-${safe}-${owner}.png`) }); await page.keyboard.press('Escape');
        }
        assert.equal(await page.evaluate(() => saveChatSettings()), true);
        assert.deepEqual(await page.evaluate(() => myCharacters.map(char => char.chatConfig.voiceBinding.voiceId)), ['voice-a', 'voice-b']);
        assert.equal(await page.evaluate(() => getApiData().fishAudioVoiceApi.voiceId), 'voice-b'); assert.equal(await page.evaluate(() => JSON.stringify(myCharacters).includes('changed-fish-key')), false);
        await page.evaluate(async () => { for (const char of myCharacters) await requestCharacterVoiceAudio('角色独立声音', char); });
        assert.deepEqual(generated.slice(-2).map(item => item.body.voice), ['voice-a', 'voice-b']);
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); assert.deepEqual(await page.evaluate(() => myCharacters.map(char => char.chatConfig.voiceBinding.voiceId)), ['voice-a', 'voice-b']);
        assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ generationCount: generated.length, listCount: lists.length, errors }, null, 2));
        console.log('Voice previews: real audio playback/cache/cancel/balance errors; Fish server search/paging/samples/advanced/storage failure and independent saved role voices; narrow safe-area screenshots passed (mock providers).');
    } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }); throw error; }
    finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
