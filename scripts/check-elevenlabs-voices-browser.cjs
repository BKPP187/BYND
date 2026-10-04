'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.qa-screenshots/elevenlabs-voices');
const version = require('./bump-version.cjs').currentVersion();
fs.mkdirSync(output, { recursive: true });
// A real, decodable WAV exercises the browser media element instead of mocking play().
const wav = Buffer.alloc(44 + 16000 * 2 * 8);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const first = { voice_id: 'voice-first', name: '清澈女声', category: 'generated', labels: { language: 'zh', gender: 'female' }, description: '自然温柔，适合日常聊天与轻声朗读。', preview_url: 'https://preview.example.invalid/first.wav' };
const noPreview = { voice_id: 'voice-custom', name: '我的克隆音色', category: 'cloned', labels: { language: 'zh' }, description: '尚无现成样音，可选用后测试语音。' };
const next = { voice_id: 'voice-next', name: '沉稳男声', category: 'professional', labels: { language: 'zh', gender: 'male' }, description: '沉稳清晰，适合故事与长篇朗读。', preview_url: 'https://preview.example.invalid/next.wav' };
const maleNext = { ...next, voice_id: 'voice-male-next', name: '清朗男声' };
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const requests = [], geometry = [], errors = [];
    let responseStatus = 200, previewError = false, delay = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/v2/voices')) {
            requests.push({ method: route.request().method(), path: url.pathname, search: url.searchParams.get('search'), type: url.searchParams.get('voice_type'), gender: url.searchParams.get('gender'), language: url.searchParams.get('language'), token: url.searchParams.get('next_page_token') });
            assert.equal(route.request().headers()['xi-api-key'], 'browser-example-key');
            const status = responseStatus;
            if (delay) await new Promise(resolve => setTimeout(resolve, 700));
            const search = url.searchParams.get('search');
            const gender = url.searchParams.get('gender');
            let voices = search === '空' ? [] : search === '男' ? [next] : search === 'unsafe' ? [{ ...first, name: '" onclick="window.injected=1"><img src=x onerror="window.injected=1">' }] : url.searchParams.has('next_page_token') ? [first, next] : [first, noPreview];
            if (gender === 'male') voices = search && search !== '男' ? [] : url.searchParams.has('next_page_token') ? [next, maleNext] : [next];
            if (gender === 'female') voices = search === '男' || search === '空' ? [] : [first];
            if (url.searchParams.get('language') === 'en') voices = [{ ...first, voice_id: 'voice-english', name: 'English voice', labels: { language: 'en', gender: 'female' } }];
            await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { voices, has_more: gender !== 'female' && !search && !url.searchParams.has('next_page_token'), next_page_token: 'next/+page' } : { detail: { message: 'Denied' } }) }).catch(() => {});
        } else if (url.hostname === 'preview.example.invalid') {
            await route.fulfill({ status: previewError ? 404 : 200, contentType: 'audio/wav', body: previewError ? Buffer.from('missing') : wav });
        } else if (url.pathname.includes('/text-to-speech/')) {
            await route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":{"message":"Invalid API key"}}' });
        } else await route.abort();
    });
    try {
        await page.addInitScript(version => {
            localStorage.setItem('bynd_lastSeenVersion', version);
            localStorage.setItem('bynd_builtin_library_seen_v1', '1');
            const NativeAudio = window.Audio;
            window.__voiceAudio = [];
            window.Audio = function (src) { const audio = new NativeAudio(src); window.__voiceAudio.push(audio); return audio; };
        }, version);
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndElevenLabsVoices);
        await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); openApp('settings'); openApiElevenLabsVoiceModal(); });
        const load = page.locator('#api-elevenlabs-voices-load'), status = page.locator('#api-elevenlabs-voices-status');
        const items = page.locator('.elevenlabs-voice-item'), search = page.locator('#api-elevenlabs-voices-search');
        await load.click();
        await page.waitForFunction(() => document.getElementById('api-elevenlabs-voices-status').dataset.error === 'true');
        assert.equal(requests.length, 0);
        await page.locator('#api-elevenlabs-voice-key').fill('browser-example-key');
        await load.click();
        await items.first().waitFor();
        assert.equal(await items.count(), 2);
        assert.equal(await items.nth(1).getByRole('button', { name: '无试听 我的克隆音色', exact: true }).isDisabled(), true);
        await page.locator('#api-elevenlabs-voices-more').click();
        await page.waitForFunction(() => document.querySelectorAll('.elevenlabs-voice-item').length === 3);
        assert.equal(requests[1].token, 'next/+page');
        assert.equal(await page.locator('#api-elevenlabs-voices-more').isVisible(), false);
        await items.first().getByRole('button', { name: '选用', exact: true }).click();
        assert.equal(await page.locator('#api-elevenlabs-voice-id').inputValue(), first.voice_id);
        assert.match(await page.locator('#api-elevenlabs-voices-selected').innerText(), /清澈女声/);
        await items.first().getByRole('button', { name: '试听 清澈女声', exact: true }).click();
        await page.waitForFunction(() => window.__voiceAudio.at(-1)?.paused === false && window.__voiceAudio.at(-1)?.readyState >= 2);
        await items.nth(2).getByRole('button', { name: '试听 沉稳男声', exact: true }).click();
        await page.waitForFunction(() => window.__voiceAudio.length >= 2 && window.__voiceAudio.at(-1)?.paused === false);
        assert.equal(await page.evaluate(() => window.__voiceAudio[0].paused), true);
        await items.nth(2).getByRole('button', { name: '停止试听 沉稳男声', exact: true }).click();
        assert.equal(await page.evaluate(() => window.__voiceAudio.at(-1).paused), true);
        previewError = true;
        await items.first().getByRole('button', { name: '试听 清澈女声', exact: true }).click();
        await page.waitForFunction(() => document.getElementById('api-elevenlabs-voices-status').textContent.includes('试听播放失败'));
        previewError = false;

        // Query changes and late responses cannot restore voices from old credentials.
        delay = true;
        await page.evaluate(() => { void ByndElevenLabsVoices.load(); });
        await page.waitForFunction(() => document.getElementById('api-elevenlabs-voices-load').disabled);
        await page.locator('#api-elevenlabs-voice-key').fill('');
        await page.waitForTimeout(800);
        assert.equal(await items.count(), 0);
        assert.match(await status.innerText(), /填写 API Key/);
        delay = false;
        await page.locator('#api-elevenlabs-voice-key').fill('browser-example-key');
        for (const code of [401, 403, 429]) {
            responseStatus = code; await load.click();
            await page.waitForFunction(code => document.getElementById('api-elevenlabs-voices-status').textContent.includes(`HTTP ${code}`), code);
            assert.equal(await items.count(), 0);
            assert.ok(!(await status.innerText()).includes('browser-example-key'));
        }
        responseStatus = 200;
        await search.fill('男');
        await page.waitForFunction(() => document.querySelector('.elevenlabs-voice-info strong')?.textContent === '沉稳男声');
        assert.equal(requests.at(-1).search, '男');
        await page.locator('#api-elevenlabs-voices-type').selectOption('personal');
        await page.waitForFunction(() => !document.getElementById('api-elevenlabs-voices-load').disabled);
        assert.equal(requests.at(-1).type, 'personal');
        await search.fill('空');
        await page.waitForFunction(() => document.getElementById('api-elevenlabs-voices-status').textContent.includes('没有找到'));
        await search.fill('unsafe'); await items.first().waitFor();
        assert.equal(await items.locator('img').count(), 0);
        assert.equal(await items.locator('[onclick*="window.injected"]').count(), 0);
        assert.equal(await page.evaluate(() => window.injected), undefined);
        await search.fill('');
        await page.locator('#api-elevenlabs-voices-type').selectOption('');
        await page.waitForFunction(() => document.querySelectorAll('.elevenlabs-voice-item').length === 2);

        // Gender filtering reaches the server and remains active across pagination and combined searches.
        const gender = page.locator('#api-elevenlabs-voices-gender');
        await gender.selectOption('male');
        await page.waitForFunction(() => document.querySelectorAll('.elevenlabs-voice-item').length === 1 && document.querySelector('.elevenlabs-voice-info strong')?.textContent === '沉稳男声');
        assert.equal(requests.at(-1).gender, 'male');
        assert.equal(requests.at(-1).token, null);
        await page.locator('#api-elevenlabs-voices-more').click();
        await page.waitForFunction(() => document.querySelectorAll('.elevenlabs-voice-item').length === 2);
        assert.equal(requests.at(-1).gender, 'male');
        assert.equal(requests.at(-1).token, 'next/+page');
        assert.match(await items.nth(1).innerText(), /清朗男声/);
        await gender.selectOption('female');
        await page.waitForFunction(() => document.querySelectorAll('.elevenlabs-voice-item').length === 1 && document.querySelector('.elevenlabs-voice-info strong')?.textContent === '清澈女声');
        assert.equal(requests.at(-1).gender, 'female');
        assert.equal(requests.at(-1).token, null);
        assert.equal(await page.locator('#api-elevenlabs-voices-more').isVisible(), false);
        await gender.selectOption('male');
        await page.waitForFunction(() => !document.getElementById('api-elevenlabs-voices-load').disabled);
        await search.fill('男');
        await page.waitForFunction(() => document.getElementById('api-elevenlabs-voices-search').value === '男' && document.getElementById('api-elevenlabs-voices-status').textContent.includes('已加载'));
        await page.locator('#api-elevenlabs-voices-type').selectOption('personal');
        await page.waitForFunction(() => !document.getElementById('api-elevenlabs-voices-load').disabled);
        assert.deepEqual({ search: requests.at(-1).search, type: requests.at(-1).type, gender: requests.at(-1).gender }, { search: '男', type: 'personal', gender: 'male' });
        await gender.selectOption('female');
        await page.waitForFunction(() => document.getElementById('api-elevenlabs-voices-status').textContent.includes('没有找到'));
        await search.fill('');
        await page.locator('#api-elevenlabs-voices-type').selectOption('');
        await gender.selectOption('');
        await page.waitForFunction(() => document.querySelectorAll('.elevenlabs-voice-item').length === 2);
        assert.equal(requests.at(-1).gender, null);

        await page.locator('#api-elevenlabs-voices-language').selectOption('zh');
        await page.waitForFunction(() => !document.getElementById('api-elevenlabs-voices-load').disabled);
        assert.equal(requests.at(-1).language, 'zh');
        await page.locator('#api-elevenlabs-voices-select').selectOption(first.voice_id);
        assert.equal(await page.locator('#api-elevenlabs-voice-id').inputValue(), first.voice_id);
        await page.locator('#api-elevenlabs-voices-language').selectOption('en');
        await page.waitForFunction(() => document.querySelector('.elevenlabs-voice-info strong')?.textContent === 'English voice');
        assert.equal(requests.at(-1).language, 'en');
        await page.locator('#api-elevenlabs-voices-select').selectOption('voice-english');
        assert.equal(await page.locator('#api-elevenlabs-voice-id').inputValue(), 'voice-english');
        await page.locator('#api-elevenlabs-voices-language').selectOption('');
        await page.waitForFunction(() => document.querySelectorAll('.elevenlabs-voice-item').length === 2);
        assert.equal(requests.at(-1).language, null);
        await page.locator('#api-elevenlabs-voices-select').selectOption(first.voice_id);

        // Storage errors leave the modal open and preserve the unsaved selection.
        await page.locator('#api-elevenlabs-voice-enabled').check();
        await page.evaluate(() => {
            window.__voiceStorageSet = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key, value) { if (key === 'my_api_data') throw new DOMException('Full', 'QuotaExceededError'); return window.__voiceStorageSet.call(this, key, value); };
        });
        await page.locator('.elevenlabs-save').click();
        assert.match(await page.locator('#api-elevenlabs-voice-test-result').innerText(), /保存失败/);
        assert.equal(await page.locator('#api-elevenlabs-voice-modal').isVisible(), true);
        await page.evaluate(() => { Storage.prototype.setItem = window.__voiceStorageSet; });
        await page.locator('.elevenlabs-save').click();
        assert.equal(await page.locator('#api-elevenlabs-voice-modal').isVisible(), false);
        assert.deepEqual(await page.evaluate(() => { const api = getApiData().elevenLabsVoiceApi; return { id: api.voiceId, name: api.voiceName }; }), { id: first.voice_id, name: first.name });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && window.ByndElevenLabsVoices);
        await page.evaluate(async () => { await window.__byndCoreReady; await window.byndStylesReady; unlockPhone(); ByndBuiltinLibrary?.close(); openApp('settings'); openApiElevenLabsVoiceModal(); });
        await items.first().waitFor();
        assert.match(await page.locator('#api-elevenlabs-voices-selected').innerText(), /清澈女声/);
        await page.locator('.elevenlabs-footer button').first().click();
        await page.waitForFunction(() => document.getElementById('api-elevenlabs-voice-test-result').textContent.includes('API Key 无效'));
        assert.ok(!(await page.locator('#api-elevenlabs-voice-test-result').innerText()).includes('可用'));
        await page.evaluate(() => { document.getElementById('api-elevenlabs-voice-test-result').textContent = ''; });

        // Modal inset belongs to the overlay if the parent did not already reserve it.
        for (const width of [320, 375]) for (const safe of [47, 59]) for (const owner of ['parent', 'header']) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(({ safe, owner }) => {
                document.documentElement.classList.add('mobile-runtime');
                const phone = document.querySelector('.phone-container');
                document.body.style.paddingTop = owner === 'parent' ? `${safe}px` : '0px';
                phone.style.setProperty('--bynd-header-safe-top', owner === 'header' ? `${safe}px` : '0px');
                phone.style.height = owner === 'parent' ? `calc(100dvh - ${safe}px)` : '100dvh';
                document.querySelector('#api-elevenlabs-voice-modal .wc-card-body').scrollTop = 0;
            }, { safe, owner });
            await page.waitForTimeout(100);
            const layout = await page.evaluate(() => {
                const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
                const card = document.querySelector('.api-elevenlabs-voice-modal-card');
                return { close: rect('.elevenlabs-close'), footer: rect('.elevenlabs-footer'), search: rect('.elevenlabs-voices-search'), overflow: card.scrollWidth - card.clientWidth, top: card.getBoundingClientRect().top };
            });
            assert.ok(layout.close.top >= safe && layout.footer.bottom <= 844, JSON.stringify({ width, safe, owner, layout }));
            assert.ok(layout.search.left >= 0 && layout.search.right <= width && layout.overflow <= 1, JSON.stringify(layout));
            geometry.push({ width, safe, owner, layout });
            await page.screenshot({ path: path.join(output, `${width}-${safe}-${owner}.png`) });
        }
        assert.equal(geometry[0].layout.top, geometry[1].layout.top, 'Parent and overlay must reserve the top inset exactly once');
        await page.locator('.elevenlabs-advanced summary').filter({ hasText: '高级设置' }).click();
        await page.locator('#api-elevenlabs-voice-id').fill('manual-id');
        assert.equal(await page.locator('#api-elevenlabs-voice-id').getAttribute('data-voice-name'), '');
        await page.locator('.elevenlabs-save').click();
        assert.equal(await page.evaluate(() => getApiData().elevenLabsVoiceApi.voiceName), '');
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ requests, geometry }, null, 2));
        console.log('ElevenLabs voices: search, category/gender filters, filtered pagination, native audio, selection persistence, manual IDs, storage/API/media failures, late-response cancellation, escaped names and 8 safe-area layouts passed.');
    } catch (error) {
        await page.screenshot({ path: path.join(output, 'failure.png') });
        console.error({ requests, status: await page.locator('#api-elevenlabs-voices-status').textContent().catch(() => ''), errors });
        throw error;
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
