'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/prompt-lab');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, deviceScaleFactor: 2 });
    const errors = [], requests = [];
    let mode = 'normal';
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://eval.invalid/**', async route => {
        const body = route.request().postDataJSON(); requests.push(body);
        if (mode === 'http') { await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { message: 'mock rate limit' } }) }); return; }
        const system = body.messages[0]?.content || '';
        let content;
        if (system.includes('独立评审')) {
            const sample = JSON.parse(body.messages[1].content);
            content = mode === 'judge' ? '{"pass":"yes"}' : JSON.stringify({ pass: sample.output === 'good', reason: sample.output === 'good' ? '符合角色' : '偏离角色', evidence: sample.output === 'good' ? '' : 'wrong' });
        } else if (system.includes('BYND Prompt 优化器')) {
            const sample = JSON.parse(body.messages[1].content);
            assert.ok(sample.failures.every(row => row.input.startsWith('dev')), 'optimizer only sees development cases');
            content = JSON.stringify({ scope: sample.scope, text: '保持角色', hypothesis: '明确行为以避免 OOC' });
        } else content = body.messages.some(m => m.content.includes('Prompt Lab 行为补充')) ? 'good' : 'wrong';
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } }) });
    });
    try {
        await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => !!window.ByndPromptLab && typeof openSettingsTab === 'function');
        await page.evaluate(async () => { await byndStylesReady; unlockPhone(); document.documentElement.classList.add('mobile-runtime'); openApp('settings'); ByndBuiltinLibrary?.close(); openSettingsTab('lab'); });
        await page.locator('#lab-target').waitFor();
        for (const width of [320, 375, 430]) {
            await page.setViewportSize({ width, height: 844 });
            const bounds = await page.evaluate(() => {
                const root = document.getElementById('bynd-prompt-lab').getBoundingClientRect();
                const header = document.querySelector('#app-settings-window .window-header h3').getBoundingClientRect();
                return { width: innerWidth, left: root.left, right: root.right, headerTop: header.top, overflow: document.documentElement.scrollWidth > innerWidth };
            });
            assert.ok(bounds.left >= 0 && bounds.right <= bounds.width + 1, 'lab fits narrow screen');
            assert.equal(bounds.overflow, false, 'page does not overflow horizontally');
            assert.ok(bounds.headerTop >= 10, 'settings heading remains inside the visible header');
            await page.screenshot({ path: path.join(output, `lab-${width}.png`), animations: 'disabled' });
        }
        await page.setViewportSize({ width: 375, height: 844 });
        const safeArea = await page.evaluate(() => {
            const title = document.querySelector('#app-settings-window .window-header h3');
            const before = title.getBoundingClientRect().top;
            document.body.style.paddingTop = '47px';
            document.querySelector('.phone-container').style.height = 'calc(100dvh - 47px)';
            return { before, after: title.getBoundingClientRect().top };
        });
        assert.ok(Math.abs(safeArea.after - safeArea.before - 47) < 1, 'parent safe area is reserved exactly once');
        await page.screenshot({ path: path.join(output, 'lab-safe-area-375.png'), animations: 'disabled' });
        await page.evaluate(() => { document.body.style.paddingTop = ''; document.querySelector('.phone-container').style.height = ''; });
        const failedSave = await page.evaluate(() => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key, value) { if (key === ByndPromptStore.KEY) throw new Error('模拟磁盘满'); return original.call(this, key, value); };
            try { ByndPromptLab.action('seed'); return document.getElementById('prompt-lab-status').textContent; } finally { Storage.prototype.setItem = original; }
        });
        assert.match(failedSave, /操作失败.*模拟磁盘满/);
        await page.evaluate(() => ByndPromptLab.action('import'));
        assert.match(await page.locator('#prompt-lab-status').innerText(), /操作失败/);
        const failedExport = await page.evaluate(() => { const original = URL.createObjectURL; URL.createObjectURL = () => { throw new Error('下载不可用'); }; try { ByndPromptLab.action('export'); return document.getElementById('prompt-lab-status').textContent; } finally { URL.createObjectURL = original; } });
        assert.match(failedExport, /操作失败.*下载不可用/);
        await page.evaluate(() => {
            saveApiData({ apis: [{ id: 'mock-target', name: '本地测试', baseUrl: 'https://eval.invalid/v1', model: 'mock-target', apiKey: 'test-secret' }], defaultId: 'mock-target' });
            const cases = ['dev', 'validation', 'test'].flatMap(split => [0, 1, 2].map(index => ({ id: split + index, split, category: 'ooc', lane: 'chat', character: { id: 'mock-lin', name: '林间', description: '沉稳的图书管理员' }, input: split + '角色场景' + index, rubric: '保持角色', events: [], memories: [], worldBook: [] })));
            ByndPromptLab.store.update(data => { data.cases = cases; data.draft = ByndPromptEval.BASELINE; data.report = null; });
            ByndPromptLab.render(); document.getElementById('lab-rounds').value = '1';
        });
        await page.evaluate(() => ByndPromptLab.start());
        if (!await page.evaluate(() => ByndPromptLab.store.read().report)) throw new Error(await page.locator('#prompt-lab-status').innerText());
        assert.equal(await page.evaluate(() => ByndPromptLab.store.read().report.status), 'complete');
        assert.equal(await page.evaluate(() => ByndPromptLab.store.read().report.eligible), true);
        assert.ok(requests.some(r => r.temperature === 0.8), 'target uses production sampling');
        assert.ok(requests.some(r => r.temperature === 0), 'judge uses fixed sampling');
        assert.equal(await page.evaluate(() => ByndPromptLab.store.exportData().includes('test-secret')), false);
        assert.ok(await page.evaluate(() => ByndPromptLab.store.read().report.rows.some(row => row.judge?.usage?.[0]?.actualUsage?.total === 110)), 'judge receipt carries actual usage');
        await page.screenshot({ path: path.join(output, 'lab-results-375.png'), animations: 'disabled' });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.evaluate(async () => { await byndStylesReady; unlockPhone(); document.documentElement.classList.add('mobile-runtime'); openApp('settings'); ByndBuiltinLibrary?.close(); openSettingsTab('lab'); });
        await page.locator('[data-lab="activate"]').click();
        await page.waitForFunction(() => !!ByndPromptLab.store.read().active);
        assert.match(await page.evaluate(() => ByndPromptLab.prompt()), /保持角色/);
        await page.locator('[data-lab="rollback"]').click();
        assert.equal(await page.evaluate(() => ByndPromptLab.prompt()), '');
        await page.locator('[data-lab="activate"]').click();
        await page.waitForFunction(() => !!ByndPromptLab.store.read().active);
        await page.locator('[data-lab="disable"]').click();
        assert.equal(await page.evaluate(() => ByndPromptLab.prompt()), '');
        for (const failure of ['http', 'judge']) {
            mode = failure;
            await page.evaluate(() => { ByndPromptLab.store.saveDraft(ByndPromptEval.BASELINE); ByndPromptLab.render(); document.getElementById('lab-rounds').value = '1'; });
            await page.evaluate(() => ByndPromptLab.start());
            const report = await page.evaluate(() => ByndPromptLab.store.read().report);
            assert.equal(report.status, 'error'); assert.equal(report.eligible, false);
            assert.ok(report.rows[0].error);
            await page.screenshot({ path: path.join(output, `lab-failure-${failure}-375.png`), animations: 'disabled' });
            await page.evaluate(() => { chatApiRateLimitPauses.clear(); });
        }
        assert.deepEqual(errors, [], 'no browser script errors');
        console.log('Prompt Lab browser checks passed: 320/375/430px, live HTTP mock adapters, usage receipts, held-out promotion, reload activation, rollback, save/import/export/API/judge failures. All model responses were mocked; no live quality score claimed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
