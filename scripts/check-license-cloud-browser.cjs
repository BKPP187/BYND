'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), secrets = path.join(root, '.bynd-license-secrets'), output = path.join(root, 'artifacts/license-cloud-browser');
async function main() {
    const origin = JSON.parse(fs.readFileSync(path.join(secrets, 'cloudflare-origin.json'), 'utf8')).origin;
    const token = fs.readFileSync(path.join(secrets, 'admin-token.txt'), 'utf8').trim();
    fs.mkdirSync(output, { recursive: true }); let browser, id;
    async function api(route, body) {
        const response = await fetch(origin + route, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20000), body: body === undefined ? undefined : JSON.stringify(body) });
        if (!response.ok) throw Error('Cloud browser cleanup API failed: ' + response.status); return response.json();
    }
    try {
        browser = await chromium.launch({ channel: 'msedge', headless: true });
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = [];
        page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
        for (let attempt = 0; attempt < 3; attempt++) {
            try { await page.goto(origin + '/license-admin.html', { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
            catch (error) { if (attempt === 2) throw error; }
        }
        await page.locator('#admin-token').fill(token); await page.getByRole('button', { name: '进入管理', exact: true }).click();
        await page.locator('#admin-workspace').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#admin-token').inputValue(), '');
        assert.equal(await page.evaluate(value => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(x => x.includes(value)), token), false);
        await page.locator('#order-ref').fill('CF-UI-SMOKE-' + crypto.randomUUID()); await page.getByRole('button', { name: '创建激活码', exact: true }).click();
        await page.locator('#admin-code').waitFor({ state: 'visible' });
        assert.ok(/^BYND(?:-[0-9A-F]{4}){8}$/.test(await page.locator('#admin-code').inputValue()), 'Online form returned invalid code');
        id = await page.locator('#license-facts dd').first().textContent();
        await page.getByRole('button', { name: '禁用授权', exact: true }).click(); await page.getByRole('button', { name: '恢复授权', exact: true }).waitFor();
        assert.equal((await api('/admin/v1/licenses/' + id)).license.status, 'disabled');
        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 844 });
            for (const top of [47, 59]) for (const parent of [false, true]) {
                await page.evaluate(({ top, parent }) => { document.documentElement.style.setProperty('--safe-top', top + 'px'); document.body.classList.toggle('safe-area-from-parent', parent); window.scrollTo({ top: 0, behavior: 'instant' }); }, { top, parent });
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                assert.ok(await page.locator('.wordmark').evaluate((e, safe) => e.getBoundingClientRect().top >= safe, top));
            }
            await page.evaluate(() => { document.documentElement.style.setProperty('--safe-top', '0px'); document.body.classList.remove('safe-area-from-parent'); });
            await page.screenshot({ path: path.join(output, 'admin-' + width + '.png'), fullPage: true });
        }
        await page.locator('#admin-logout').click(); assert.equal(await page.locator('#admin-code').inputValue(), '');
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify({ origin, creationFromForm: true, testLicenseDisabled: true, tokenStoredInBrowser: false, safeAreas: [47, 59], widths: [320, 390], errors }, null, 2));
        console.log('Cloudflare management form verified in browser; created and disabled one labeled test license.');
    } finally {
        if (id) { const current = (await api('/admin/v1/licenses/' + id)).license; if (current.status === 'active') await api('/admin/v1/licenses/' + id + '/disable', { requestId: crypto.randomUUID(), expectedRevision: current.revision }); }
        if (browser) await browser.close();
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
