const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.qa-screenshots/elevenlabs-access'); fs.mkdirSync(output, { recursive: true });
const voices = [
    { voice_id: 'jin', name: 'Jin - Clear, Warm and Casual', category: 'professional', available_for_tiers: ['starter', 'creator', 'pro', 'enterprise'], sharing: { free_users_allowed: false }, description: '中文男声' },
    { voice_id: 'free-one', name: 'Callum - Husky Trickster', category: 'premade', available_for_tiers: ['free', 'starter', 'creator'] },
    { voice_id: 'unknown', name: '未提供权限的音色', category: 'professional' },
    { voice_id: 'xinghe', name: 'Xinghe Jiang - Magnetic Conversational', category: 'professional', is_owner: false, available_for_tiers: ['free', 'creator'], sharing: { free_users_allowed: true, original_voice_id: 'library-original' } },
    { voice_id: 'vincent', name: 'Vincent - Clear, Brisk and Mature', category: 'professional', sharing: { free_users_allowed: true, enabled_in_library: true } }
];
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true }); const errors = []; let synthesis = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        const url = new URL(route.request().url()); let data;
        if (url.pathname === '/v2/voices') data = { voices, has_more: false };
        else if (url.pathname === '/v1/user/subscription') data = { tier: 'free', character_count: 100, character_limit: 10000 };
        else if (url.pathname === '/v1/models') data = [{ model_id: 'eleven_multilingual_v2', can_do_text_to_speech: true }];
        else { if (url.pathname.includes('text-to-speech')) synthesis++; return route.abort(); }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.addInitScript(version => {
        localStorage.setItem('bynd_lastSeenVersion', version); localStorage.setItem('bynd_builtin_library_seen_v1', '1');
        localStorage.setItem('my_api_data', JSON.stringify({ elevenLabsVoiceApi: { enabled: true, apiKey: 'access-key', voiceId: 'jin', baseUrl: 'https://api.elevenlabs.io', voiceModel: 'eleven_multilingual_v2' } }));
        localStorage.setItem('my_characters_data', JSON.stringify([{ id: 'b', name: 'b测试员', history: [], chatConfig: { voiceBinding: { provider: 'elevenlabs', voiceId: 'xinghe', voiceName: 'Xinghe Jiang - Magnetic Conversational' } } }]));
    }, require('./bump-version.cjs').currentVersion());
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndElevenLabsVoices);
        await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); openApp('settings'); openApiElevenLabsVoiceModal(); });
        for (const context of ['global', 'role']) {
            if (context === 'role') await page.evaluate(() => { closeApiElevenLabsVoiceModal(); openApp('wechat'); openChat('b'); openChatSettings(); openWechatChatSettingsPage('voice'); });
            const prefix = context === 'global' ? 'api-elevenlabs-' : 'wcs-elevenlabs-';
            const list = page.locator(`#${prefix}voices-list`);
            await page.waitForFunction(prefix => document.getElementById(`${prefix}voices-list`)?.textContent.includes('当前 Free 不可用'), prefix);
            assert.match(await list.locator('.elevenlabs-voice-item').nth(0).innerText(), /需付费套餐/);
            assert.match(await list.locator('.elevenlabs-voice-item').nth(0).innerText(), /starter \/ creator/);
            assert.match(await list.locator('.elevenlabs-voice-item').nth(1).innerText(), /内置音色 · 生成扣积分/);
            assert.match(await list.locator('.elevenlabs-voice-item').nth(2).innerText(), /API 套餐权限待确认/);
            for (const index of [3, 4]) {
                assert.match(await list.locator('.elevenlabs-voice-item').nth(index).innerText(), /社区音色 · API 需付费 · 当前 Free 不可用/);
                assert.doesNotMatch(await list.locator('.elevenlabs-voice-item').nth(index).innerText(), /免费套餐可用|可用套餐：free/);
            }
            assert.match(await page.locator(`#${prefix}voices-selected`).innerText(), context === 'role' ? /Xinghe.*社区音色 · API 需付费/ : /需付费套餐/);
            await page.locator(`#${prefix}voices-select-trigger`).click();
            assert.match(await page.locator('.elevenlabs-select-list').getByRole('option').nth(1).innerText(), /需付费套餐/);
            await page.keyboard.press('Escape');
            for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
                await page.setViewportSize({ width, height: 844 });
                await page.evaluate(({ safe, owner }) => {
                    document.documentElement.classList.add('mobile-runtime'); document.body.style.paddingTop = owner === 'parent' ? `${safe}px` : '0';
                    const phone = document.querySelector('.phone-container'); phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? `${safe}px` : '0'); phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
                }, { safe, owner });
                await list.locator('.elevenlabs-voice-access').first().scrollIntoViewIfNeeded();
                const rect = await list.locator('.elevenlabs-voice-item').first().evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, overflow: el.scrollWidth - el.clientWidth }; });
                assert.ok(rect.left >= 0 && rect.right <= width && rect.overflow <= 1, JSON.stringify(rect));
                await page.screenshot({ path: path.join(output, `${context}-${width}-${safe}-${owner}.png`) });
            }
        }
        assert.equal(synthesis, 0, 'billing labels must not generate paid test audio'); assert.deepEqual(errors, []);
        console.log('ElevenLabs access: paid/free-tier/unknown labels in global and role cards, dropdowns and saved selection; 16 safe-area screenshots; no paid generation passed.');
    } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }); throw error; }
    finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
