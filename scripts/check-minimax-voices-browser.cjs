const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.qa-screenshots/minimax-voices'); fs.mkdirSync(output, { recursive: true });
const voices = { system_voice: [
    { voice_id: 'Chinese (Mandarin)_Gentleman', voice_name: 'Gentleman', description: ['Calm male Mandarin voice'] },
    { voice_id: 'Chinese (Mandarin)_Reliable_Executive', voice_name: 'Reliable Executive', description: ['Reliable male Mandarin voice'] },
    { voice_id: 'Chinese (Mandarin)_Warm_Girl', voice_name: 'Warm Girl', description: ['Warm female Mandarin voice'] },
    { voice_id: 'English_CalmWoman', voice_name: 'Calm Woman', description: ['Female English voice'] }
], voice_cloning: [{ voice_id: 'account-clone', voice_name: '我的克隆声音' }], voice_generation: [{ voice_id: 'account-design', voice_name: '我的设计声音' }], base_resp: { status_code: 0 } };
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    let responseStatus = 200, invalid = false, delay = false; const requests = [], synthesis = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname.endsWith('/get_voice')) {
            requests.push({ url: url.href, body: request.postDataJSON(), auth: request.headers().authorization });
            const status = responseStatus, body = invalid ? {} : voices;
            if (delay) await new Promise(resolve => setTimeout(resolve, 200));
            return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        }
        if (url.pathname.endsWith('/t2a_v2')) {
            synthesis.push(request.postDataJSON());
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { audio: '4944330000' }, extra_info: { audio_length: 5000 }, base_resp: { status_code: 0 } }) });
        }
        return route.abort();
    });
    await page.addInitScript(version => {
        localStorage.setItem('bynd_lastSeenVersion', version); localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        if (!localStorage.getItem('my_api_data')) localStorage.setItem('my_api_data', JSON.stringify({ voiceApi: { enabled: true, apiKey: 'minimax-example-key', baseUrl: 'https://api.minimax.io', voiceModel: 'speech-2.8-turbo', voiceId: '' } }));
        if (!localStorage.getItem('my_characters_data')) localStorage.setItem('my_characters_data', JSON.stringify(['a', 'b'].map(id => ({ id, name: `${id}测试员`, history: [], chatConfig: {} }))));
    }, require('./bump-version.cjs').currentVersion());
    const ready = async () => {
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndMiniMaxVoices);
        await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); });
    };
    const loaded = prefix => page.waitForFunction(prefix => document.getElementById(`${prefix}-status`).textContent.includes('账户返回'), prefix);
    const role = async id => {
        await page.evaluate(id => { openApp('wechat'); openChat(id); openChatSettings(); openWechatChatSettingsPage('voice'); }, id);
        await page.locator('#wcs-char-voice-provider').selectOption('minimax'); await loaded('wcs-minimax-picker');
    };
    const screenshots = async (context, prefix) => {
        for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => {
                document.documentElement.classList.add('mobile-runtime'); document.body.style.paddingTop = owner === 'parent' ? `${safe}px` : '0';
                const phone = document.querySelector('.phone-container'); phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? `${safe}px` : '0'); phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
            }, { safe, owner });
            for (const kind of ['model', 'voice']) {
                await page.locator(`#${prefix}-${kind}-trigger`).click();
                const geometry = await page.locator('.minimax-select-overlay .elevenlabs-select-sheet').evaluate(el => { const r = el.getBoundingClientRect(), p = el.closest('.phone-container').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, parentTop: p.top, parentBottom: p.bottom, overflow: el.scrollWidth - el.clientWidth }; });
                assert.ok(geometry.left >= 0 && geometry.right <= width && geometry.top >= geometry.parentTop + (owner === 'header' ? safe : 0) && geometry.bottom <= geometry.parentBottom && geometry.overflow <= 1, JSON.stringify(geometry));
                await page.screenshot({ path: path.join(output, `${context}-${kind}-${width}-${safe}-${owner}.png`) });
                await page.keyboard.press('Escape');
            }
        }
    };
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' }); await ready();
        await page.evaluate(() => { openApp('settings'); openApiVoiceModal(); }); await loaded('api-minimax-picker');
        assert.equal(await page.locator('#api-voice-model').inputValue(), 'speech-2.8-turbo');
        assert.equal(await page.locator('#api-voice-id').inputValue(), '');
        assert.equal(await page.locator('#api-voice-modal details').first().getAttribute('open'), null);
        await page.locator('#api-minimax-picker-gender').selectOption('female');
        await page.locator('#api-minimax-picker-language').selectOption('zh');
        assert.equal(await page.locator('#api-minimax-picker-voice option').count(), 2);
        await page.locator('#api-minimax-picker-voice-trigger').click();
        await page.locator('.minimax-select-overlay').getByRole('option', { name: /温暖女孩/ }).click();
        assert.equal(await page.locator('#api-voice-id').inputValue(), 'Chinese (Mandarin)_Warm_Girl');
        await page.locator('#api-minimax-picker-search').fill('没有匹配');
        assert.equal(await page.locator('#api-voice-id').inputValue(), 'Chinese (Mandarin)_Warm_Girl', 'filtering cannot erase the selected voice');
        await page.locator('#api-minimax-picker-search').fill('');
        assert.equal(synthesis.length, 0, 'loading/filtering/selecting never synthesizes charged audio');
        await screenshots('global', 'api-minimax-picker');
        responseStatus = 401; await page.locator('#api-minimax-picker-load').click();
        await page.waitForFunction(() => document.getElementById('api-minimax-picker-status').textContent.includes('HTTP 401'));
        assert.equal(await page.locator('#api-voice-id').inputValue(), 'Chinese (Mandarin)_Warm_Girl');
        responseStatus = 200; invalid = true; await page.locator('#api-minimax-picker-load').click();
        await page.waitForFunction(() => document.getElementById('api-minimax-picker-status').textContent.includes('无效列表')); invalid = false;
        // A credential change discards the prior account's list; late requests cannot replace the draft.
        delay = true; await page.locator('#api-minimax-picker-load').click();
        await page.locator('#api-voice-key').fill('changed-key');
        await page.waitForTimeout(250);
        assert.doesNotMatch(await page.locator('#api-minimax-picker-voice').textContent(), /我的克隆声音/);
        assert.match(await page.locator('#api-minimax-picker-status').innerText(), /未核验账户/);
        delay = false; await page.locator('#api-minimax-picker-load').click(); await loaded('api-minimax-picker');
        assert.equal(requests.at(-1).auth, 'Bearer changed-key');
        const realSave = await page.evaluateHandle(() => saveApiData);
        await page.evaluate(() => { window._qaOriginalSaveApi = saveApiData; saveApiData = () => { throw new Error('full'); }; });
        assert.equal(await page.evaluate(() => saveApiVoiceSettings()), false);
        assert.equal(await page.locator('#api-voice-modal').isVisible(), true);
        assert.match(await page.locator('#api-voice-test-result').innerText(), /保存失败/);
        await page.evaluate(() => { saveApiData = window._qaOriginalSaveApi; delete window._qaOriginalSaveApi; }); await realSave.dispose();
        assert.equal(await page.evaluate(() => saveApiVoiceSettings()), true);
        await role('a');
        await page.locator('#wcs-minimax-picker-gender').selectOption('male'); await page.locator('#wcs-minimax-picker-language').selectOption('zh');
        await page.locator('#wcs-minimax-picker-voice').selectOption('Chinese (Mandarin)_Gentleman');
        await page.locator('#wcs-minimax-picker-model').selectOption('speech-2.8-hd');
        await screenshots('role', 'wcs-minimax-picker');
        assert.equal(await page.evaluate(() => saveChatSettings()), true);
        await role('b'); await page.locator('#wcs-minimax-picker-voice').selectOption('Chinese (Mandarin)_Reliable_Executive');
        assert.equal(await page.evaluate(() => saveChatSettings()), true);
        assert.deepEqual(await page.evaluate(() => myCharacters.map(char => char.chatConfig.voiceBinding.voiceId)), ['Chinese (Mandarin)_Gentleman', 'Chinese (Mandarin)_Reliable_Executive']);
        assert.equal(await page.evaluate(() => JSON.stringify(myCharacters).includes('changed-key')), false);
        assert.equal(await page.evaluate(() => getApiData().voiceApi.voiceId), 'Chinese (Mandarin)_Warm_Girl');
        await page.evaluate(async () => { for (const char of myCharacters) await requestCharacterVoiceAudio('你好，今天过得怎么样？', char); });
        assert.deepEqual(synthesis.map(body => body.voice_setting.voice_id), ['Chinese (Mandarin)_Gentleman', 'Chinese (Mandarin)_Reliable_Executive']);
        assert.equal(synthesis[0].model, 'speech-2.8-hd');
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
        assert.deepEqual(await page.evaluate(() => myCharacters.map(char => char.chatConfig.voiceBinding.voiceId)), ['Chinese (Mandarin)_Gentleman', 'Chinese (Mandarin)_Reliable_Executive']);
        await page.evaluate(() => { openApp('wechat'); openChat('a'); openChatSettings(); openWechatChatSettingsPage('voice'); }); await loaded('wcs-minimax-picker');
        assert.match(await page.locator('#wcs-minimax-picker-selected').innerText(), /温润绅士/);
        await page.locator('#wcs-char-voice-provider').selectOption('elevenlabs');
        assert.equal(await page.locator('#wcs-minimax-picker').isVisible(), false);
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ listRequests: requests.length, synthesis, errors }, null, 2));
        console.log('MiniMax: models and voice filters, distinct saved role voices, account errors, stale keys, storage failures, reload and 32 contained safe-area dropdown screenshots passed (mock provider).');
    } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }); throw error; }
    finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
