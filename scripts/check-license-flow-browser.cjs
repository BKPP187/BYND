'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { start } = require('./license-dev-server.cjs');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/distribution-browser'); fs.mkdirSync(output, { recursive: true });
async function main() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-browser-license-'));
    let service, browser;
    const checks = [];
    try {
        service = await start({ port: 0, directory }); service.env.APK_SIGNER_SHA256 = 'c'.repeat(64);
        browser = await chromium.launch({ channel: 'msedge', headless: true });
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
        const admin = await context.newPage(), errors = [];
        for (const page of [admin]) page.on('pageerror', error => errors.push(error.message));
        admin.on('dialog', dialog => dialog.accept());
        await admin.goto(service.origin + '/license-admin.html');
        await admin.locator('#admin-token').fill(service.env.ADMIN_TOKEN); await admin.getByRole('button', { name: '进入管理' }).click();
        await admin.locator('#admin-workspace').waitFor({ state: 'visible' });
        assert.equal(await admin.locator('#admin-token').inputValue(), '');
        assert.equal(await admin.evaluate(token => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(x => x.includes(token)), service.env.ADMIN_TOKEN), false);
        checks.push('admin login keeps credentials out of browser storage');
        // Lose a successful issuance response, then retry the same real request.
        let lost = false;
        await admin.route('**/admin/v1/licenses', async route => {
            if (route.request().method() === 'POST' && !lost) { lost = true; await route.fetch(); await route.abort(); }
            else await route.continue();
        });
        await admin.locator('#order-ref').fill('browser-test-order'); await admin.locator('#customer-email').fill('browser@example.invalid');
        await admin.getByRole('button', { name: '创建激活码', exact: true }).click();
        await admin.waitForFunction(() => document.getElementById('admin-status').textContent.includes('网络连接失败'));
        assert.equal(service.env.DB.database.prepare('SELECT count(*) AS n FROM licenses').get().n, 1);
        await admin.getByRole('button', { name: '创建激活码', exact: true }).click();
        await admin.locator('#admin-code').waitFor({ state: 'visible' });
        const code = await admin.locator('#admin-code').inputValue(); assert.match(code, /^BYND(?:-[0-9A-F]{4}){8}$/);
        assert.equal(service.env.DB.database.prepare('SELECT count(*) AS n FROM licenses').get().n, 1);
        checks.push('lost issuance response retries without duplicate licenses');
        await admin.getByRole('button', { name: '生成领取链接', exact: true }).click();
        await admin.locator('#delivery-result').waitFor({ state: 'visible' }); const receiptUrl = await admin.locator('#delivery-link').inputValue();
        await admin.getByRole('button', { name: '发送领取邮件', exact: true }).click();
        await admin.waitForFunction(() => document.getElementById('delivery-status').textContent.includes('尚未配置'));
        assert.equal(service.env.DB.database.prepare('SELECT email_state FROM deliveries').get().email_state, 'ready');
        checks.push('unconfigured email shows failure, never delivery success');
        const receipt = await context.newPage(); receipt.on('pageerror', error => errors.push(error.message));
        await receipt.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } }); });
        await receipt.goto(receiptUrl); await receipt.locator('#receipt-content').waitFor({ state: 'visible' });
        assert.equal(await receipt.locator('#receipt-code').inputValue(), code);
        await receipt.reload(); await receipt.locator('#receipt-content').waitFor({ state: 'visible' }); assert.equal(await receipt.locator('#receipt-code').inputValue(), code);
        await receipt.locator('#receipt-copy').click(); await receipt.waitForFunction(() => document.getElementById('receipt-status').textContent.includes('手动复制'));
        const saved = receipt.waitForEvent('download'); await receipt.locator('#receipt-save').click(); const savedDownload = await saved;
        assert.ok(fs.readFileSync(await savedDownload.path(), 'utf8').includes(code));
        checks.push('receipt survives reload, clipboard denial has fallback, saved code matches');
        // Real streamed HTTP upload of test bytes, then publish a signed test manifest.
        const bytes = Buffer.from('browser test APK bytes; not an installable package'), sha = crypto.createHash('sha256').update(bytes).digest('hex');
        const meta = { sha256: sha, packageName: 'cc.ccwu.bynd', versionCode: 1000, versionName: '1.2.0', size: bytes.length, signerSha256: 'c'.repeat(64) };
        const uploaded = await fetch(service.origin + '/admin/v1/artifacts/' + sha, { method: 'POST', headers: { Authorization: 'Bearer ' + service.env.ADMIN_TOKEN, 'X-BYND-Artifact': JSON.stringify(meta), 'Content-Length': String(bytes.length) }, body: bytes });
        assert.equal(uploaded.status, 200); const artifact = (await uploaded.json()).artifact;
        const manifest = { ...meta, apkUrl: 'https://bynd.ccwu.cc/downloads/' + artifact.filename, changelog: { new: ['测试版本来信'], improved: [], fixed: [] } };
        const manifestFile = path.join(directory, 'manifest.json'); fs.writeFileSync(manifestFile, JSON.stringify(manifest));
        await admin.locator('#release-manifest').setInputFiles(manifestFile); await admin.getByRole('button', { name: '发布更新清单', exact: true }).click();
        await admin.waitForFunction(() => document.getElementById('admin-status').textContent.includes('更新清单已发布'));
        const shop = await context.newPage(); shop.on('pageerror', error => errors.push(error.message));
        await shop.goto(service.origin + '/shop.html'); await shop.waitForFunction(() => !document.querySelector('.download-row button').disabled);
        assert.equal(await shop.locator('.purchase-button').isDisabled(), true);
        assert.equal(await shop.locator('#shop-retry').isVisible(), false);
        const download = shop.waitForEvent('download'); await shop.locator('.download-row button').click(); const apk = await download;
        assert.deepEqual(fs.readFileSync(await apk.path()), bytes);
        const savedHead = service.env.APK_BUCKET.head.bind(service.env.APK_BUCKET);
        service.env.APK_BUCKET.head = async () => null;
        await shop.locator('.download-row button').click();
        await shop.waitForFunction(() => document.getElementById('shop-status').textContent.includes('无法下载'));
        assert.equal(new URL(shop.url()).pathname, '/shop.html');
        service.env.APK_BUCKET.head = savedHead;
        await shop.reload(); await shop.waitForFunction(() => !document.querySelector('.download-row button').disabled);
        checks.push('closed sale with live APK download; upload and signed publication reach the website');
        await receipt.reload(); await receipt.locator('#receipt-download').waitFor({ state: 'visible' });
        for (const page of [shop, receipt, admin]) {
            for (const width of [320, 390, 430, 1280]) {
                await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 });
                for (const parent of [false, true]) for (const safe of [47, 59]) {
                    await page.evaluate(async ({ safe, parent }) => { document.activeElement?.blur(); document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important'); document.documentElement.style.setProperty('--safe-top', safe + 'px'); document.body.classList.toggle('safe-area-from-parent', parent); await new Promise(resolve => requestAnimationFrame(resolve)); window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, { safe, parent });
                    await page.waitForFunction(() => scrollY === 0);
                    const box = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, top: document.querySelector('.wordmark').getBoundingClientRect().top, page: location.pathname }));
                    assert.ok(box.scroll <= box.width, JSON.stringify({ width, safe, parent, ...box }));
                    assert.ok(box.top >= safe && box.top <= safe + 35, JSON.stringify({ width, safe, parent, ...box }));
                }
                await page.evaluate(() => { document.body.classList.remove('safe-area-from-parent'); document.documentElement.style.setProperty('--safe-top', '0px'); });
                if (width === 390 || width === 1280) await page.screenshot({ path: path.join(output, `${new URL(page.url()).pathname.slice(1).replace('.html', '')}-${width}.png`), fullPage: true });
            }
        }
        checks.push('320/390/430/1280px layouts cover 47/59px safe areas reserved by header or parent');
        await admin.getByRole('button', { name: '禁用授权', exact: true }).click();
        await admin.getByRole('button', { name: '恢复授权', exact: true }).waitFor();
        await receipt.reload(); await receipt.waitForFunction(() => document.getElementById('receipt-status').textContent.includes('已停用'));
        assert.equal(await receipt.locator('#receipt-content').isVisible(), false);
        await admin.getByRole('button', { name: '恢复授权', exact: true }).click();
        await admin.getByRole('button', { name: '禁用授权', exact: true }).waitFor();
        await receipt.reload(); await receipt.locator('#receipt-content').waitFor({ state: 'visible' });
        checks.push('disable and restore are reflected in receipt access');
        service.env.DB.failWrites = true;
        await admin.locator('details.panel').filter({ hasText: '购买页配置' }).locator('summary').click(); await admin.locator('#price-label').fill('失败路径测试');
        await admin.getByRole('button', { name: '保存页面配置', exact: true }).click();
        await admin.waitForFunction(() => document.getElementById('admin-status').textContent.includes('服务暂时不可用'));
        assert.equal(service.env.DB.database.prepare('SELECT price_label FROM storefront').get().price_label, '待公布'); service.env.DB.failWrites = false;
        await admin.locator('#admin-logout').click(); assert.equal(await admin.locator('#admin-code').inputValue(), '');
        for (const route of ['/.bynd-license-dev/local-config.json', '/workers/license/worker.mjs', '/android/keystore.properties']) assert.equal((await fetch(service.origin + route)).status, 404);
        assert.deepEqual(errors, []);
        checks.push('save failure preserves old config; logout and local server do not expose secrets');
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(checks, null, 2)); console.log(checks.join('\n'));
    } finally {
        if (browser) await browser.close(); if (service) await service.close();
        if (path.dirname(directory) === path.resolve(os.tmpdir()) && path.basename(directory).startsWith('bynd-browser-license-')) fs.rmSync(directory, { recursive: true, force: true });
    }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
