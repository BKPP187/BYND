'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.qa-screenshots/elevenlabs-options');
fs.mkdirSync(output, { recursive: true });
const models = ['v4', 'v4_turbo', 'v3', 'v3_conversational', 'multilingual_v2'].map(id => ({ model_id: `eleven_${id}`, name: id === 'multilingual_v2' ? 'Multilingual v2' : id.replace('_', ' '), can_do_text_to_speech: true, languages: [{ language_id: 'zh', name: 'Chinese' }], token_cost_factor: id.includes('turbo') ? .5 : 1 }));
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [], calls = [], geometry = [];
    let modelStatus = 200, accountStatus = 200, historyStatus = 200, synthStatus = 200, hasId = true, late = false, accountUsed = 100;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        const url = new URL(route.request().url()), request = route.request(); calls.push({ path: url.pathname, query: url.search, body: request.postDataJSON() });
        const reply = (status, data, headers = {}) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'Access-Control-Expose-Headers': 'request-id, history-item-id', ...headers } }).catch(() => {});
        if (url.pathname === '/v1/models') {
            const status = modelStatus; if (late) await new Promise(resolve => setTimeout(resolve, 500));
            return reply(status, [...models, { model_id: 'conversion-only', name: 'Changer', can_do_text_to_speech: false }]);
        }
        if (url.pathname === '/v1/user/subscription') return reply(accountStatus, { tier: 'free', character_count: accountUsed, character_limit: 10000 });
        if (url.pathname === '/v2/voices') return reply(200, { voices: [{ voice_id: 'sample-voice', name: '温柔男声', labels: { language: 'zh', gender: 'male' } }], has_more: false });
        if (url.pathname.startsWith('/v1/text-to-speech/')) return reply(synthStatus, synthStatus === 200 ? { audio_url: 'https://sample.invalid/audio.mp3' } : { detail: { message: 'Synthesis denied' } }, hasId ? { 'request-id': 'exact-request' } : {});
        if (url.pathname === '/v1/history') return reply(historyStatus, { history: [
            { request_id: 'someone-else', character_count_change_from: 100, character_count_change_to: 999 },
            { request_id: 'exact-request', character_count_change_from: 100, character_count_change_to: 112 }
        ] });
        return route.abort();
    });
    await page.addInitScript(version => {
        localStorage.setItem('bynd_lastSeenVersion', version); localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        if (!localStorage.getItem('my_api_data')) localStorage.setItem('my_api_data', JSON.stringify({ elevenLabsVoiceApi: { enabled: true, apiKey: 'options-test-key', baseUrl: 'https://api.elevenlabs.io', voiceId: 'sample-voice', voiceName: '温柔男声', voiceModel: 'eleven_multilingual_v2' } }));
        if (!localStorage.getItem('my_characters_data')) localStorage.setItem('my_characters_data', JSON.stringify([{ id: 'model-role', name: '南桓', history: [], chatConfig: { voiceBinding: { provider: 'elevenlabs', model: 'eleven_v3', voiceId: 'sample-voice', voiceName: '温柔男声' } } }]));
    }, require('./bump-version.cjs').currentVersion());
    const ready = async () => {
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndElevenLabsOptions);
        await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); });
    };
    const choose = async (id, name) => {
        await page.locator(`#${id}-trigger`).click();
        await page.getByRole('option', { name, exact: true }).click();
        assert.equal(await page.locator('.elevenlabs-select-overlay').count(), 0);
    };
    const generate = () => page.evaluate(async () => { try { await requestElevenLabsVoiceAudio('宝宝，你今天开心吗？', getApiData().elevenLabsVoiceApi); return true; } catch (_) { return false; } });
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' }); await ready();
        await page.evaluate(() => { openApp('settings'); openApiElevenLabsVoiceModal(); });
        const globalPanel = page.locator('#api-elevenlabs-voice-modal .elevenlabs-account');
        await page.waitForFunction(() => document.getElementById('api-elevenlabs-models-select')?.options.length === 5);
        assert.match(await globalPanel.locator('[data-account-status]').innerText(), /9,900/);
        assert.equal(await page.locator('#api-elevenlabs-models-select option[value="conversion-only"]').count(), 0);
        await choose('api-elevenlabs-models-select', 'v4 turbo');
        assert.equal(await page.locator('#api-elevenlabs-voice-model').inputValue(), 'eleven_v4_turbo');
        assert.match(await globalPanel.locator('[data-model-status]').innerText(), /支持中文/);
        await page.locator('.elevenlabs-save').click();
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
        assert.equal(await page.evaluate(() => getApiData().elevenLabsVoiceApi.voiceModel), 'eleven_v4_turbo');
        await page.evaluate(() => { openApp('settings'); openApiElevenLabsVoiceModal(); });
        await page.waitForFunction(() => document.getElementById('api-elevenlabs-models-select')?.options.length === 5);
        assert.equal(await generate(), true);
        await page.waitForFunction(() => document.querySelector('[data-usage-status]').textContent.includes('12 积分（已核对'));
        assert.ok(!await globalPanel.locator('[data-usage-status]').innerText().then(text => text.includes('899')));
        assert.equal(calls.findLast(call => call.path.includes('/text-to-speech/')).body.model_id, 'eleven_v4_turbo');
        historyStatus = 403; accountStatus = 403;
        assert.equal(await generate(), true, 'optional billing failure must not break audio');
        await page.waitForFunction(() => document.querySelector('[data-usage-status]').textContent.includes('无法核对'));
        await page.waitForFunction(() => document.querySelector('[data-account-status]').textContent.includes('额度读取失败'));
        assert.ok(!(await globalPanel.locator('[data-account-status]').innerText()).includes('剩余额度 0'));
        hasId = false; historyStatus = 200; accountStatus = 200; accountUsed = 112;
        const beforeHistory = calls.filter(call => call.path === '/v1/history').length;
        assert.equal(await generate(), true);
        await page.waitForFunction(() => document.querySelector('[data-usage-status]').textContent.includes('无法核对'));
        assert.equal(calls.filter(call => call.path === '/v1/history').length, beforeHistory, 'no identifier must not guess from latest history');
        const beforeUsage = await globalPanel.locator('[data-usage-status]').innerText(); synthStatus = 401;
        assert.equal(await generate(), false);
        assert.equal(await globalPanel.locator('[data-usage-status]').innerText(), beforeUsage, 'failed synthesis must not claim a new successful usage');
        modelStatus = 403;
        await globalPanel.getByRole('button', { name: '刷新模型', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-model-status]').textContent.includes('模型加载失败'));
        assert.equal(await page.locator('#api-elevenlabs-voice-model').inputValue(), 'eleven_v4_turbo');
        modelStatus = 200; late = true;
        await globalPanel.getByRole('button', { name: '刷新模型', exact: true }).click();
        await page.locator('#api-elevenlabs-voice-key').fill('another-key');
        await page.waitForTimeout(700);
        assert.equal(await page.locator('#api-elevenlabs-models-select option').count(), 1, 'late models from previous key must not be restored');
        late = false; await page.locator('#api-elevenlabs-voice-key').fill('options-test-key');
        await globalPanel.getByRole('button', { name: '刷新模型', exact: true }).click();
        await page.waitForFunction(() => document.getElementById('api-elevenlabs-models-select').options.length === 5);
        for (const context of ['global', 'role']) {
            if (context === 'role') {
                await page.evaluate(() => { closeApiElevenLabsVoiceModal(); openApp('wechat'); openChat('model-role'); openChatSettings(); openWechatChatSettingsPage('voice'); });
                await page.waitForFunction(() => document.getElementById('wcs-elevenlabs-models-select')?.options.length === 6);
                await choose('wcs-elevenlabs-models-select', 'v4');
                assert.equal(await page.locator('#wcs-char-voice-model').inputValue(), 'eleven_v4');
                assert.equal(await page.evaluate(() => saveChatSettings()), true);
                await page.evaluate(() => { openChatSettings(); openWechatChatSettingsPage('voice'); });
                await page.waitForFunction(() => document.getElementById('wcs-elevenlabs-models-select')?.value === 'eleven_v4');
                assert.equal(await page.evaluate(() => getApiData().elevenLabsVoiceApi.voiceModel), 'eleven_v4_turbo');
            }
            const prefix = context === 'global' ? 'api-elevenlabs-' : 'wcs-elevenlabs-';
            for (const dimensions of [{ width: 1280, height: 1100, name: 'desktop-shell' }, { width: 320, height: 500, name: 'short-phone' }]) {
                await page.setViewportSize(dimensions);
                await page.evaluate(({ name }) => {
                    document.documentElement.classList.toggle('mobile-runtime', name !== 'desktop-shell');
                    document.body.style.paddingTop = '0';
                    const phone = document.querySelector('.phone-container');
                    phone.style.height = ''; phone.style.setProperty('--bynd-header-safe-top', '0');
                }, dimensions);
                await page.locator(`#${prefix}voices-language-trigger`).click();
                const bounds = await page.evaluate(() => {
                    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
                    const list = document.querySelector('.elevenlabs-select-list');
                    return { phone: rect('.phone-container'), sheet: rect('.elevenlabs-select-sheet'), scrollable: list.scrollHeight > list.clientHeight };
                });
                assert.ok(bounds.sheet.top >= bounds.phone.top && bounds.sheet.bottom <= bounds.phone.bottom && bounds.sheet.left >= bounds.phone.left && bounds.sheet.right <= bounds.phone.right, JSON.stringify(bounds));
                if (dimensions.name === 'short-phone') assert.ok(bounds.scrollable);
                geometry.push({ context, ...dimensions, bounds });
                await page.screenshot({ path: path.join(output, `${context}-${dimensions.name}.png`) });
                await page.getByRole('option', { name: '印地语', exact: true }).click();
                assert.equal(await page.locator(`#${prefix}voices-language`).inputValue(), 'hi');
            }
            for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
                await page.setViewportSize({ width, height: 844 });
                await page.evaluate(({ safe, owner }) => {
                    document.documentElement.classList.add('mobile-runtime');
                    document.body.style.paddingTop = owner === 'parent' ? `${safe}px` : '0';
                    const phone = document.querySelector('.phone-container');
                    phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? `${safe}px` : '0');
                    phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
                }, { safe, owner });
                await page.locator(`#${prefix}voices-language-trigger`).click();
                const bounds = await page.evaluate(() => {
                    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
                    const list = document.querySelector('.elevenlabs-select-list');
                    return { phone: rect('.phone-container'), sheet: rect('.elevenlabs-select-sheet'), scrollable: list.scrollHeight > list.clientHeight, overflow: list.scrollWidth - list.clientWidth };
                });
                assert.ok(bounds.sheet.top >= safe && bounds.sheet.bottom <= bounds.phone.bottom && bounds.sheet.left >= bounds.phone.left && bounds.sheet.right <= bounds.phone.right && bounds.overflow <= 1, JSON.stringify(bounds));
                geometry.push({ context, width, safe, owner, bounds });
                await page.screenshot({ path: path.join(output, `${context}-${width}-${safe}-${owner}.png`) });
                await page.getByRole('option', { name: '中文', exact: true }).click();
                assert.equal(await page.locator(`#${prefix}voices-language`).inputValue(), 'zh');
                await page.locator(`#${prefix}models-select-trigger`).click();
                await page.keyboard.press('Escape');
                assert.equal(await page.locator('.elevenlabs-select-overlay').count(), 0);
                assert.equal(await page.locator(`#${prefix}models-select-trigger`).getAttribute('aria-expanded'), 'false');
            }
        }
        assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ geometry, calls }, null, 2));
        console.log('ElevenLabs options: dynamic TTS models, saved global/role models, exact-request usage, missing IDs/permissions, synthesis failures, stale credentials and 20 contained orange dropdown layouts passed.');
    } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }); throw error; }
    finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
