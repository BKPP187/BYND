'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa-screenshots/coreading-highlights');
fs.mkdirSync(output, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.addInitScript(() => localStorage.setItem('bynd_builtin_library_seen_v1', '1'));
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__byndCoreReady && typeof askCoReadCharHighlight === 'function');
        await page.evaluate(async () => {
            await window.__byndCoreReady; await window.byndStylesReady;
            if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
            unlockPhone(); window.ByndBuiltinLibrary?.close(); document.documentElement.classList.add('mobile-runtime');
            if (!window.myCharacters.some(char => char.id === 'qa_reader')) window.myCharacters.push({ id: 'qa_reader', name: '温今北', history: [], chatConfig: {} });
            const content = ['第 1 章 雨夜', '她把书合上，窗外的雨还没有停。', '“我们明天再读吧。”他说，声音很轻。', '灯光落在纸页上，像一层很薄的雪。她忽然觉得，读书这件事，有人陪着就不一样了。'].join('\n\n');
            saveCoReadLibrary([{ id: 'hl-qa', title: '雨夜', author: '测试', content: content + '\n\n' + content.repeat(3), page: 0, createdAt: Date.now() }]);
            openApp('coread');
            coreadActiveBookId = 'hl-qa'; coreadActiveCharId = 'qa_reader';
            setCoReadTab('reader');
            window.__calls = [];
            window.callChatApi = async (messages) => {
                window.__calls.push(messages.at(-1).content.slice(-80));
                if (/highlights/.test(messages.at(-1).content)) return { ok: true, content: '{"highlights":[{"quote":"像一层很薄的雪","note":"你读书的样子也这样安静。"}]}' };
                return { ok: true, content: '因为“明天”说明他还想和她一起读下去。' };
            };
        });
        await page.addStyleTag({ content: '.app-window{transition:none!important;animation:none!important}.tapfx-layer{display:none!important}' });
        await page.locator('#coread-reader-body [data-coread-offset]').first().waitFor();

        // Select "窗外的雨还没有停" inside the second paragraph and use the toolbar.
        await page.evaluate(() => {
            const span = [...document.querySelectorAll('#coread-reader-body [data-coread-offset]')].find(node => node.textContent.includes('窗外'));
            const text = span.firstChild, at = text.nodeValue.indexOf('窗外');
            const range = document.createRange(); range.setStart(text, at); range.setEnd(text, at + 8);
            const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        });
        await page.locator('#coread-hl-toolbar').waitFor();
        await page.screenshot({ path: path.join(output, 'select-toolbar.png') });
        await page.locator('#coread-hl-toolbar [data-hl-action="mark"]').click();
        await page.locator('#coread-reader-body mark.coread-hl.is-user').waitFor();
        assert.equal(await page.locator('#coread-reader-body mark.coread-hl.is-user').first().innerText(), '窗外的雨还没有停');
        assert.equal(await page.locator('#coread-hl-toolbar').count(), 0);

        // Tapping the mark opens the sheet instead of turning the page.
        const pageBefore = await page.evaluate(() => getCoReadBook('hl-qa').page);
        await page.locator('#coread-reader-body mark.coread-hl').first().click();
        await page.locator('#coread-highlight-sheet .coread-hl-sheet').waitFor();
        assert.equal(await page.evaluate(() => getCoReadBook('hl-qa').page), pageBefore);
        await page.locator('#coread-hl-note').fill('雨声和他的“明天”连在一起。');
        await page.locator('.coread-hl-save-note').click();
        assert.equal(await page.evaluate(() => getCoReadHighlights('hl-qa')[0].note), '雨声和他的“明天”连在一起。');
        await page.locator('#coread-hl-reply').fill('你觉得他为什么说明天？');
        await page.locator('.coread-hl-reply button').click();
        await page.waitForFunction(() => getCoReadHighlights('hl-qa')[0].discussion.length === 2, null, { timeout: 5000 }).catch(async error => { console.log(await page.evaluate(() => JSON.stringify({ d: getCoReadHighlights('hl-qa')[0].discussion, s: coreadHighlightStatus, calls: window.__calls }))); throw error; });
        assert.match(await page.locator('.coread-hl-thread').innerText(), /还想和她一起读下去/);
        await page.screenshot({ path: path.join(output, 'sheet-discussion.png') });

        // Failure path: the API fails, the user message stays and a retry is offered.
        await page.evaluate(() => { window.callChatApi = async () => ({ ok: false, error: '接口超时' }); });
        await page.locator('#coread-hl-reply').fill('那你呢？');
        await page.locator('.coread-hl-reply button').click();
        await page.locator('.coread-hl-status').waitFor();
        assert.match(await page.locator('.coread-hl-status').innerText(), /没有回复：接口超时/);
        assert.equal(await page.evaluate(() => getCoReadHighlights('hl-qa')[0].discussion.at(-1).role), 'user');
        await page.locator('#coread-highlight-sheet .coread-review-close').click();
        assert.equal(await page.locator('#coread-highlight-sheet').isHidden(), true);

        // The char highlights the current page; the 划线 tab shows both reading times.
        await page.evaluate(() => {
            window.callChatApi = async () => ({ ok: true, content: '{"highlights":[{"quote":"像一层很薄的雪","note":"你读书的样子也这样安静。"}]}' });
            CoReadJournal.record(getCoReadBook('hl-qa'), 0, Date.now() - 600000, Date.now() - 300000);
        });
        await page.locator('.coread-reader-tools button[aria-label="划线"]').click();
        await page.locator('.coread-reader-overview.open[data-reader-panel-tab="highlights"]').waitFor();
        await page.locator('.coread-hl-panel-actions button').click();
        await page.waitForFunction(() => getCoReadHighlights('hl-qa').some(item => item.by === 'char'));
        await page.locator('.coread-hl-row.is-char').waitFor();
        assert.equal(await page.locator('.coread-hl-row').count(), 2);
        const times = await page.locator('.coread-hl-time').innerText();
        assert.match(times, /你\s*5 分钟/);
        assert.match(times, /温今北/);
        assert.match(times, /陪你 5 分钟/);
        await page.screenshot({ path: path.join(output, 'panel-highlights.png') });
        await page.evaluate(() => closeCoReadReaderPanel());
        await page.locator('#coread-reader-body mark.coread-hl.is-char').first().waitFor();
        await page.screenshot({ path: path.join(output, 'reader-marks.png') });

        // Delete the user's highlight from its sheet.
        await page.locator('#coread-reader-body mark.coread-hl.is-user').first().click();
        await page.locator('.coread-hl-sheet-actions .danger').click();
        assert.equal(await page.locator('#coread-reader-body mark.coread-hl.is-user').count(), 0);
        assert.deepEqual(await page.evaluate(() => getCoReadHighlights('hl-qa').map(item => item.by)), ['char']);

        // Safe areas: the sheet stays below the status bar at 47px and 59px.
        await page.locator('#coread-reader-body mark.coread-hl.is-char').first().click();
        for (const safe of [47, 59]) {
            await page.evaluate(value => document.querySelector('.phone-container').style.setProperty('--bynd-header-safe-top', `${value}px`), safe);
            const top = await page.locator('.coread-hl-sheet').evaluate(node => node.getBoundingClientRect().top);
            assert.ok(top >= safe, `sheet top ${top} under status bar ${safe}`);
        }
        await page.screenshot({ path: path.join(output, 'char-sheet.png') });
        assert.deepEqual(errors, []);
        console.log('coreading highlights browser check passed');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
