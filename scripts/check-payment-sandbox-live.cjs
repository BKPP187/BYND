'use strict';
// Talks only to the local isolated server and Alipay's sandbox. Never submits payment.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..'), privateDirectory = path.join(root, '.bynd-license-dev/payment-sandbox');
const output = path.join(root, 'artifacts/payments');
async function main() {
    const origin = 'http://127.0.0.1:' + Number(process.env.BYND_PAYMENT_SANDBOX_PORT || 8994);
    let cookie = '', browser;
    async function api(route, body, payment = false) {
        const response = await fetch(origin + route, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
            headers: { Cookie: cookie, Origin: origin, 'X-BYND-Account': '1', 'X-BYND-Payment': '1', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
        const data = await response.json(); if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
        assert.ok(response.ok, 'Local ' + (payment ? 'payment' : 'account') + ' step failed with HTTP ' + response.status); return data;
    }
    const config = await api('/payment/v1/config'); assert.equal(config.mode, 'sandbox'); assert.equal(config.saleOpen, false);
    const email = 'sandbox-check-' + crypto.randomBytes(6).toString('hex') + '@example.invalid', password = crypto.randomBytes(32).toString('base64url');
    const registration = await api('/account/v1/register', { email, password, displayName: '支付测试小草' }); assert.equal(registration.mailMode, 'local');
    const messages = JSON.parse(fs.readFileSync(path.join(privateDirectory, 'account-emails.json'), 'utf8'));
    const mail = messages.find(message => message.to === email && message.purpose === 'register'); assert.ok(mail);
    await api('/account/v1/verify', { token: new URL(mail.link).hash.split('=')[1] });
    await api('/account/v1/login', { email, password });
    const created = await api('/payment/v1/orders', { requestId: crypto.randomUUID() }, true);
    assert.equal(new URL(created.paymentUrl).origin, 'https://openapi-sandbox.dl.alipaydev.com');
    const before = await api('/payment/v1/orders/' + created.order.id + '/check', {}, true);
    assert.equal(before.order.state, 'pending'); assert.equal(before.providerState, 'NOT_CREATED');
    // Keep the demo login local, separate from merchant secrets and all deployment artifacts.
    fs.writeFileSync(path.join(privateDirectory, 'test-login.json'), JSON.stringify({ purpose: '本机支付宝沙箱测试账号，不是正式官网账号', url: origin + '/account.html#login', email, password, checkout: origin + '/checkout.html?order=' + created.order.id }, null, 2), { mode: 0o600 });
    const result = { actualSandboxQuerySignatureVerified: true, beforeCashier: before.providerState, realCharge: false, simulatedPaymentSubmitted: false, demoLoginSavedPrivately: true, cashierLoaded: false };
    try {
        browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(created.paymentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.screenshot({ path: path.join(output, 'actual-sandbox-cashier.png'), fullPage: true });
        result.cashierTitle = await page.title(); result.cashierLoaded = true;
        // Page content is inspected visually; loading a cashier is not evidence of payment.
    } catch { result.cashierError = 'Sandbox cashier navigation did not complete; no payment was submitted.'; }
    finally { if (browser) await browser.close(); }
    const after = await api('/payment/v1/orders/' + created.order.id + '/check', {}, true);
    assert.equal(after.order.state, 'pending'); assert.equal(after.order.licenseId, null);
    result.afterCashier = after.providerState;
    fs.writeFileSync(path.join(output, 'actual-sandbox-check.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
}
main().catch(() => { console.error('Live sandbox check did not complete; no payment was submitted. Check local service and sandbox connectivity.'); process.exitCode = 1; });
