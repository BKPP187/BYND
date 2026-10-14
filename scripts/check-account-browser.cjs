'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { start } = require('./license-dev-server.cjs');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/account-browser'); fs.mkdirSync(output, { recursive: true });
const pass = '把喜欢带在身边，今天也是很可爱的一天。', newPass = '明天也要好好保存我的小小世界和所有喜欢。';
async function main() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-account-browser-'));
    let service, browser; const checks = [], errors = [];
    try {
        service = await start({ port: 0, directory });
        browser = await chromium.launch({ channel: 'msedge', headless: true });
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
        const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } }); });
        async function status(text) {
            try { await page.waitForFunction(value => document.getElementById('account-status').textContent.includes(value), text); }
            catch (error) { console.error(await page.evaluate(() => ({ title: document.getElementById('account-title').textContent, status: document.getElementById('account-status').textContent, fields: [...document.querySelectorAll('#account-form input')].map(x => ({ id: x.id, disabled: x.disabled, required: x.required, valid: x.validity.valid, length: x.value.length })) }))); throw error; }
        }
        async function login(password) { await page.locator('#account-email').fill('browser@example.invalid'); await page.locator('#account-password').fill(password); await page.locator('#account-submit').click(); }
        async function layouts(kind) {
            for (const width of [320, 390, 430, 1280]) {
                await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 });
                for (const safe of [0, 47, 59]) for (const parent of [false, true]) {
                    await page.evaluate(({ safe, parent }) => { document.documentElement.style.setProperty('--safe-top', safe + 'px'); document.body.classList.toggle('safe-area-from-parent', parent); }, { safe, parent });
                    const box = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth, top: document.querySelector('.wordmark').getBoundingClientRect().top, headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom }));
                    const expectedPadding = width <= 760 ? 17 : 25;
                    assert.ok(box.scroll <= box.width, JSON.stringify({ kind, width, safe, parent, box }));
                    assert.ok(Math.abs(box.top - safe - expectedPadding) <= 1, JSON.stringify({ kind, width, safe, parent, box }));
                }
                await page.evaluate(() => { document.documentElement.style.setProperty('--safe-top', '0px'); document.body.classList.remove('safe-area-from-parent'); });
                if ([320, 390, 1280].includes(width)) await page.screenshot({ path: path.join(output, kind + '-' + width + '.png'), fullPage: true });
            }
            await page.setViewportSize({ width: 390, height: 844 });
        }
        await page.goto(service.origin + '/shop.html'); await page.locator('nav a[href="account.html"]').click();
        await page.locator('#account-name').waitFor(); await layouts('register');
        await page.locator('#account-name').fill('小草'); await page.locator('#account-email').fill('browser@example.invalid');
        await page.locator('#account-password').fill(pass); await page.locator('#account-confirm').fill(newPass); await page.locator('#account-submit').click(); await status('两次密码不一样');
        assert.equal((await service.env.ACCOUNT_DEV_MAIL.read()).length, 0);
        await page.locator('#account-confirm').fill(pass); await page.locator('#account-submit').click(); await status('本机测试模式');
        assert.equal(service.env.DB.database.prepare('SELECT count(*) n FROM accounts').get().n, 0);
        const mail = (await service.env.ACCOUNT_DEV_MAIL.read())[0]; assert.equal(mail.purpose, 'register');
        assert.equal((await fetch(service.origin + '/admin/v1/account-mail')).status, 401);
        checks.push('registration entry, confirmation mismatch and mailbox ownership before account creation');
        const admin = await context.newPage(); admin.on('pageerror', error => errors.push(error.message));
        await admin.goto(service.origin + '/license-admin.html'); await admin.locator('#admin-token').fill(service.env.ADMIN_TOKEN); await admin.getByRole('button', { name: '进入管理' }).click();
        await admin.locator('#admin-workspace').waitFor({ state: 'visible' }); await admin.locator('#account-mail-panel summary').click(); await admin.locator('#account-mail-refresh').click();
        await admin.locator('#account-mail-list a').waitFor(); assert.equal(await admin.locator('#account-mail-list a').getAttribute('href'), mail.link);
        await admin.locator('#admin-logout').click(); assert.equal(await admin.locator('#account-mail-list a').count(), 0);
        checks.push('local inbox requires admin login and clears private links on logout');
        await page.goto(mail.link); await layouts('verify');
        service.env.DB.failWrites = true; await page.locator('#account-submit').click(); await status('服务暂时不可用');
        assert.equal(service.env.DB.database.prepare('SELECT used_at FROM account_tokens').get().used_at, null);
        service.env.DB.failWrites = false; await page.locator('#account-submit').click(); await status('邮箱验证成功');
        assert.equal(await page.locator('#account-password').inputValue(), '');
        await layouts('login'); await login(newPass); await status('邮箱或密码不正确'); await login(pass); await page.locator('#account-home').waitFor({ state: 'visible' });
        const cookies = await context.cookies(); const session = cookies.find(x => x.name === 'bynd_account_local'); assert.equal(session.httpOnly, true); assert.equal(session.sameSite, 'Strict');
        assert.equal(await page.evaluate(() => document.cookie.includes('bynd_account')), false);
        assert.equal(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(x => x.includes('scrypt') || x.includes('把喜欢带在身边'))), false);
        checks.push('verification storage failure retries safely; incorrect password fails; session is HttpOnly');
        await page.reload(); await page.locator('#account-home').waitFor({ state: 'visible' });
        const issuance = await fetch(service.origin + '/admin/v1/licenses', { method: 'POST', headers: { Authorization: 'Bearer ' + service.env.ADMIN_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: crypto.randomUUID(), email: 'browser@example.invalid' }) });
        assert.equal(issuance.status, 201); const licensed = await issuance.json();
        assert.equal(service.env.DB.database.prepare('SELECT count(*) n FROM account_licenses').get().n, 0);
        await page.locator('#claim-section summary').click(); await page.locator('#claim-code').fill(licensed.licenseKey);
        service.env.DB.failWrites = true; await page.locator('#claim-submit').click(); await status('服务暂时不可用'); assert.equal(await page.locator('#claim-code').inputValue(), licensed.licenseKey);
        service.env.DB.failWrites = false; await page.locator('#claim-submit').click(); await status('授权已保存');
        await page.getByRole('button', { name: '查看激活码', exact: true }).click(); await status('妥善保存');
        assert.equal(await page.locator('.account-license textarea').inputValue(), licensed.licenseKey);
        await page.getByRole('button', { name: '复制激活码', exact: true }).click(); await status('手动复制');
        const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: '保存文本 ↓' }).click(); const saved = await downloading;
        assert.ok(fs.readFileSync(await saved.path(), 'utf8').includes(licensed.licenseKey));
        await layouts('my-licenses');
        checks.push('claim does not trust email; DB failure retains input; reveal/copy-denial/text save work');
        service.env.DB.failWrites = true; await page.locator('#account-logout').click(); await status('服务暂时不可用'); assert.equal(await page.locator('#account-home').isVisible(), true);
        service.env.DB.failWrites = false; await page.locator('#account-logout').click(); await status('已经退出'); assert.equal(await page.locator('.account-license textarea').count(), 0);
        await page.locator('#account-forgot').click(); await layouts('forgot'); await page.locator('#account-email').fill('browser@example.invalid'); await page.locator('#account-submit').click(); await status('本机测试模式');
        const reset = (await service.env.ACCOUNT_DEV_MAIL.read())[0]; assert.equal(reset.purpose, 'reset');
        await page.goto(reset.link); await layouts('reset'); await page.locator('#account-password').fill(newPass); await page.locator('#account-confirm').fill(newPass); await page.locator('#account-submit').click(); await status('密码已重设');
        await login(pass); await status('邮箱或密码不正确'); await login(newPass); await page.locator('#account-home').waitFor({ state: 'visible' });
        await page.reload(); await page.locator('#account-home').waitFor({ state: 'visible' }); assert.equal(await page.locator('.account-license').count(), 1);
        checks.push('failed logout stays honest; successful logout clears code; password reset and ownership survive reload');
        // Revoke the session on the server; a private refresh returns to login.
        service.env.DB.database.prepare('DELETE FROM account_sessions').run(); await page.locator('#license-refresh').click(); await status('请先登录');
        assert.equal(await page.locator('#account-home').isVisible(), false); assert.equal(await page.locator('.account-license').count(), 0);
        checks.push('expired/revoked session clears all private authorization content');
        await page.locator('#tab-register').click();
        await page.locator('#account-name').fill('带码注册'); await page.locator('#account-email').fill('activation@example.invalid'); await page.locator('#account-password').fill(pass); await page.locator('#account-confirm').fill(pass);
        await page.locator('#account-activation').fill(licensed.licenseKey); await page.locator('#account-submit').click(); await status('激活码无效');
        assert.equal(await page.locator('#account-activation').inputValue(), licensed.licenseKey);
        const freshResponse = await fetch(service.origin + '/admin/v1/licenses', { method: 'POST', headers: { Authorization: 'Bearer ' + service.env.ADMIN_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: crypto.randomUUID() }) });
        assert.equal(freshResponse.status, 201); const fresh = await freshResponse.json();
        await page.locator('#account-activation').fill(fresh.licenseKey); await page.locator('#account-submit').click(); await status('本机测试模式');
        assert.equal(await page.locator('#account-activation').inputValue(), '');
        const activationMail = (await service.env.ACCOUNT_DEV_MAIL.read())[0]; await page.goto(activationMail.link); await page.locator('#account-submit').click(); await status('激活码已保存');
        await page.locator('#account-email').fill('activation@example.invalid'); await page.locator('#account-password').fill(pass); await page.locator('#account-submit').click(); await page.locator('#account-home').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.account-license').count(), 1); assert.equal(await page.locator('#account-activation').isVisible(), false);
        checks.push('registration activation-code field rejects claimed codes and saves valid authorization upon verification');
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ checks, widths: [320, 390, 430, 1280], safeAreas: [0, 47, 59], reservation: ['header', 'parent'], errors, realEmailSent: false }, null, 2));
        console.log('Account browser flow passed: ' + checks.length + ' groups; register/login/verify/reset/claim/logout, narrow screens and safe areas. No real email sent.');
    } finally { if (browser) await browser.close(); if (service) await service.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
