'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.qa-screenshots/character-elevenlabs');
fs.mkdirSync(output, { recursive: true });
const male = { voice_id: 'male-one', name: '温柔男声', category: 'professional', labels: { gender: 'male', language: 'zh' }, description: '温柔自然的普通话男声。', preview_url: 'https://preview.example.invalid/en.wav', verified_languages: [{ language: 'zh', preview_url: 'https://preview.example.invalid/zh.wav' }] };
const maleTwo = { ...male, voice_id: 'male-two', name: '低沉男声' };
const female = { ...male, voice_id: 'female-one', name: '清澈女声', labels: { gender: 'female', language: 'zh' } };
const english = { ...male, voice_id: 'english-one', name: 'English male', labels: { gender: 'male', language: 'en' }, verified_languages: [] };
const wav = Buffer.alloc(44 + 32000 * 5);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const report = { requests: [], synthesis: [], layouts: [], errors: [] };
    let statusCode = 200, delayed = false;
    page.on('pageerror', error => report.errors.push(error.message));
    await page.route('https://**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/v2/voices') {
            const query = Object.fromEntries(url.searchParams.entries());
            report.requests.push(query);
            assert.equal(route.request().headers()['xi-api-key'], 'character-example-key');
            const status = statusCode;
            if (delayed) await new Promise(resolve => setTimeout(resolve, 700));
            let voices = [male, female, english];
            if (query.next_page_token) voices = [maleTwo];
            if (query.gender) voices = voices.filter(voice => voice.labels.gender === query.gender);
            if (query.language) voices = voices.filter(voice => voice.labels.language === query.language);
            if (query.search) voices = voices.filter(voice => voice.name.includes(query.search));
            await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { voices, has_more: query.language !== 'en' && !query.next_page_token && !query.search && query.gender !== 'female', next_page_token: 'role-page-2' } : { detail: { message: 'Denied' } }) }).catch(() => {});
        } else if (url.hostname === 'preview.example.invalid') await route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
        else if (url.pathname.startsWith('/v1/text-to-speech/')) {
            report.synthesis.push({ id: decodeURIComponent(url.pathname.split('/').at(-1)), body: route.request().postDataJSON() });
            await route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
        } else await route.abort();
    });
    await page.addInitScript(version => {
        localStorage.setItem('bynd_lastSeenVersion', version);
        localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        if (!localStorage.getItem('my_characters_data')) localStorage.setItem('my_characters_data', JSON.stringify([{ id: 'voice-a', name: '南桓', history: [], chatConfig: {} }, { id: 'voice-b', name: '江闻远', history: [], chatConfig: {} }]));
        if (!localStorage.getItem('my_api_data')) localStorage.setItem('my_api_data', JSON.stringify({ elevenLabsVoiceApi: { enabled: true, apiKey: 'character-example-key', baseUrl: 'https://api.elevenlabs.io', voiceId: 'global-voice', voiceName: '全局音色', voiceModel: 'eleven_multilingual_v2' } }));
        const NativeAudio = window.Audio;
        window.__characterAudio = [];
        window.Audio = function (src) { const audio = new NativeAudio(src); window.__characterAudio.push(audio); return audio; };
    }, require('./bump-version.cjs').currentVersion());
    const picker = page.locator('#wcs-elevenlabs-picker');
    const waitLoaded = () => page.waitForFunction(() => !document.getElementById('wcs-elevenlabs-voices-load').disabled && document.getElementById('wcs-elevenlabs-voices-status').textContent.includes('已加载'));
    const openRole = async id => {
        await page.evaluate(id => { openApp('wechat'); openChat(id); openChatSettings(); openWechatChatSettingsPage('voice'); }, id);
        await page.locator('#wc-chat-settings-panel.active').waitFor();
    };
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndElevenLabsVoices);
        await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); });
        await openRole('voice-a');
        await page.locator('#wcs-char-voice-provider').selectOption('elevenlabs');
        await waitLoaded();
        assert.equal(await page.locator('#wcs-char-voice-id').inputValue(), '', 'new roles must choose their own voice instead of copying the global voice');
        assert.equal(await page.evaluate(() => document.getElementById('wcs-char-voice-advanced').open), false);
        assert.equal(await page.evaluate(() => saveChatSettings()), false, 'an empty ElevenLabs binding must not silently fall back to the global voice');
        await page.locator('#wcs-elevenlabs-voices-gender').selectOption('male'); await waitLoaded();
        await page.locator('#wcs-elevenlabs-voices-language').selectOption('zh'); await waitLoaded();
        await page.locator('#wcs-elevenlabs-voices-type').selectOption('community'); await waitLoaded();
        assert.equal(report.requests.at(-1).language, 'zh');
        assert.equal(report.requests.at(-1).gender, 'male');
        assert.equal(report.requests.at(-1).voice_type, 'community');
        await page.locator('#wcs-elevenlabs-voices-more').click(); await waitLoaded();
        assert.equal(report.requests.at(-1).next_page_token, 'role-page-2');
        assert.equal(report.requests.at(-1).language, 'zh');
        assert.equal(report.requests.at(-1).gender, 'male');
        assert.equal(await picker.locator('.elevenlabs-voice-item').count(), 2);
        await page.locator('#wcs-elevenlabs-voices-select').selectOption('male-two');
        assert.equal(await page.locator('#wcs-char-voice-id').inputValue(), 'male-two');
        await picker.getByRole('button', { name: '试听 低沉男声', exact: true }).click();
        await page.waitForFunction(() => window.__characterAudio.at(-1)?.paused === false && window.__characterAudio.at(-1)?.readyState >= 2);
        assert.equal(await page.evaluate(() => window.__characterAudio.at(-1).src), 'https://preview.example.invalid/zh.wav');
        await picker.getByRole('button', { name: '停止试听 低沉男声', exact: true }).click();
        // Actual settings save failures leave the draft available for retry.
        await page.evaluate(() => { window.__originalVoiceSave = window.saveCharactersToStorage; window.saveCharactersToStorage = async () => false; });
        assert.equal(await page.evaluate(() => saveChatSettings()), false);
        assert.equal(await page.locator('#wc-chat-settings-panel').evaluate(el => el.classList.contains('active')), true);
        await page.evaluate(() => { window.saveCharactersToStorage = window.__originalVoiceSave; });
        assert.equal(await page.evaluate(() => saveChatSettings()), true);
        await page.waitForFunction(() => !document.getElementById('wc-chat-settings-panel').classList.contains('active'));
        await openRole('voice-b');
        await page.locator('#wcs-char-voice-provider').selectOption('elevenlabs'); await waitLoaded();
        assert.equal(await page.locator('#wcs-char-voice-id').inputValue(), '');
        await page.locator('#wcs-elevenlabs-voices-gender').selectOption('female'); await waitLoaded();
        assert.equal(report.requests.at(-1).next_page_token, undefined);
        await page.locator('#wcs-elevenlabs-voices-select').selectOption('female-one');
        assert.equal(await page.evaluate(() => saveChatSettings()), true);
        await page.waitForFunction(() => !document.getElementById('wc-chat-settings-panel').classList.contains('active'));
        assert.deepEqual(await page.evaluate(() => myCharacters.map(char => ({ id: char.id, voice: char.chatConfig.voiceBinding?.voiceId, name: char.chatConfig.voiceBinding?.voiceName }))), [
            { id: 'voice-a', voice: 'male-two', name: '低沉男声' }, { id: 'voice-b', voice: 'female-one', name: '清澈女声' }
        ]);
        assert.equal(await page.evaluate(() => getApiData().elevenLabsVoiceApi.voiceId), 'global-voice');
        assert.equal(await page.evaluate(() => JSON.stringify(myCharacters).includes('character-example-key')), false);
        await page.evaluate(async () => { for (const char of myCharacters) await requestCharacterVoiceAudio('你好，今天过得怎么样？', char); });
        assert.deepEqual(report.synthesis.map(item => item.id), ['male-two', 'female-one']);
        assert.ok(report.synthesis.every(item => item.body.model_id === 'eleven_multilingual_v2'));

        // Real persisted bindings and names survive a full reload.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndElevenLabsVoices);
        await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); });
        await openRole('voice-a'); await waitLoaded();
        assert.match(await page.locator('#wcs-elevenlabs-voices-selected').innerText(), /低沉男声/);
        assert.equal(await page.locator('#wcs-char-voice-id').inputValue(), 'male-two');
        await page.locator('#wcs-elevenlabs-voices-language').selectOption('en'); await waitLoaded();
        assert.equal(await picker.locator('.elevenlabs-voice-item').count(), 1);
        await page.locator('#wcs-elevenlabs-voices-search').fill('没有这个音色');
        await page.waitForFunction(() => document.getElementById('wcs-elevenlabs-voices-status').textContent.includes('没有找到'));
        await page.locator('#wcs-elevenlabs-voices-search').fill('');
        await page.locator('#wcs-elevenlabs-voices-language').selectOption(''); await waitLoaded();
        for (const code of [401, 403]) {
            statusCode = code; await page.locator('#wcs-elevenlabs-voices-load').click();
            await page.waitForFunction(code => document.getElementById('wcs-elevenlabs-voices-status').textContent.includes(`HTTP ${code}`), code);
            assert.equal(await page.locator('#wcs-char-voice-id').inputValue(), 'male-two');
        }
        statusCode = 200;
        delayed = true;
        await page.evaluate(() => { void ByndElevenLabsVoices.character.load(); });
        await page.locator('#wcs-char-voice-provider').selectOption('openai');
        await page.waitForTimeout(800);
        assert.equal(await picker.isVisible(), false);
        await page.locator('#wcs-char-voice-provider').selectOption('elevenlabs');
        delayed = false; await waitLoaded();
        await page.locator('#wcs-elevenlabs-voices-gender').selectOption('male'); await waitLoaded();
        await page.locator('#wcs-elevenlabs-voices-language').selectOption('zh'); await waitLoaded();
        await page.locator('#wcs-elevenlabs-voices-select').selectOption('male-one');

        for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => {
                document.documentElement.classList.add('mobile-runtime');
                document.body.style.paddingTop = owner === 'parent' ? safe + 'px' : '0px';
                const phone = document.querySelector('.phone-container');
                phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? safe + 'px' : '0px');
                phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
                document.querySelector('#wc-chat-settings-panel .wcs-body').scrollTop = 0;
            }, { safe, owner });
            await page.waitForTimeout(100);
            const layout = await page.evaluate(() => {
                const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return { top: r.top, right: r.right, left: r.left, bottom: r.bottom }; };
                const picker = document.getElementById('wcs-elevenlabs-picker');
                return { back: rect('wcs-back-btn'), language: rect('wcs-elevenlabs-voices-language'), select: rect('wcs-elevenlabs-voices-select'), overflow: picker.scrollWidth - picker.clientWidth };
            });
            assert.ok(layout.back.top >= safe && layout.select.left >= 0 && layout.select.right <= width && layout.overflow <= 1, JSON.stringify({ width, safe, owner, layout }));
            report.layouts.push({ width, safe, owner, layout });
            await page.screenshot({ path: path.join(output, `${width}-${safe}-${owner}.png`) });
        }
        assert.deepEqual(report.errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(report, null, 2));
        console.log('Character ElevenLabs: language/gender/source search and pagination, dropdowns, Chinese previews, separate persisted role voices, global independence, per-role synthesis, storage/API errors, provider cancellation and 8 safe-area layouts passed.');
    } catch (error) {
        await page.screenshot({ path: path.join(output, 'failure.png') });
        console.error({ requests: report.requests, errors: report.errors, status: await page.locator('#wcs-elevenlabs-voices-status').textContent().catch(() => '') });
        throw error;
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
