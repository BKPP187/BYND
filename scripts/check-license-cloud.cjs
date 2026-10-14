'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), directory = path.join(root, '.bynd-license-secrets');
async function main() {
    const origin = new URL(process.env.BYND_LICENSE_URL || JSON.parse(fs.readFileSync(path.join(directory, 'cloudflare-origin.json'), 'utf8')).origin);
    if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.username || origin.password) throw Error('Cloud smoke test requires a HTTPS origin');
    const token = process.env.BYND_LICENSE_ADMIN_TOKEN || fs.readFileSync(path.join(directory, 'admin-token.txt'), 'utf8').trim();
    const stateFile = path.join(directory, 'cloud-smoke.json');
    let pending = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { origin: origin.origin, requestId: crypto.randomUUID() };
    if (pending.origin !== origin.origin) throw Error('Smoke test origin differs from the saved test record');
    fs.writeFileSync(stateFile, JSON.stringify(pending), { mode: 0o600 });
    async function fetchRetry(route, options) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try { return await fetch(origin.origin + route, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) }); }
            catch (error) { if (attempt === 2) throw Error('Cloud connection failed at ' + route + ': ' + (error.cause?.code || error.name)); }
        }
    }
    async function request(route, body, admin = true) {
        const headers = { 'Content-Type': 'application/json' }; if (admin) headers.Authorization = 'Bearer ' + token;
        const response = await fetchRetry(route, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
        const data = await response.json(); return { status: response.status, data, cors: response.headers.get('access-control-allow-origin') };
    }
    const checks = []; let licenseId;
    try {
        const page = await fetchRetry('/license-admin.html', {}); assert.equal(page.status, 200);
        assert.ok((await page.text()).includes('create-form')); checks.push('online management form is served with the Worker');
        const unauthorized = await request('/admin/v1/licenses', undefined, false); assert.equal(unauthorized.status, 401); assert.equal(unauthorized.cors, null);
        const config = await request('/admin/v1/config'); assert.equal(config.status, 200); assert.equal(config.data.saleOpen, false); assert.equal(config.data.activationEnabled, false);
        const payload = { requestId: pending.requestId, orderRef: 'CF-SMOKE-' + pending.requestId, email: null };
        const created = await request('/admin/v1/licenses', payload); assert.ok([200, 201].includes(created.status)); licenseId = created.data.id;
        assert.ok(/^BYND(?:-[0-9A-F]{4}){8}$/.test(created.data.licenseKey || ''), 'Returned activation code format is invalid');
        const again = await request('/admin/v1/licenses', payload); assert.equal(again.status, 200); assert.ok(again.data.licenseKey === created.data.licenseKey, 'Issuance retry changed the code');
        checks.push('authenticated remote D1 issuance is idempotent; unauthorized requests are rejected');
        async function inspect() { const data = await request('/admin/v1/licenses/' + licenseId); assert.equal(data.status, 200); return data.data.license; }
        async function action(kind) { const current = await inspect(); const body = { requestId: crypto.randomUUID(), expectedRevision: current.revision }; const response = await request('/admin/v1/licenses/' + licenseId + '/' + kind, body); assert.equal(response.status, 200); return body; }
        await action('disable'); assert.equal((await inspect()).status, 'disabled'); assert.equal((await request('/admin/v1/licenses/' + licenseId + '/recover', {})).status, 409);
        await action('enable'); assert.equal((await inspect()).status, 'active');
        const unbind = await action('unbind'), revision = (await inspect()).revision;
        assert.equal((await request('/admin/v1/licenses/' + licenseId + '/unbind', unbind)).status, 200); assert.equal((await inspect()).revision, revision);
        checks.push('disable, enable and replay-safe device unbind operate against remote D1');
        const recovered = await request('/admin/v1/licenses/' + licenseId + '/recover', {}); assert.ok(recovered.data.licenseKey === created.data.licenseKey, 'Remote recovery changed the original code');
        const delivery = await request('/admin/v1/licenses/' + licenseId + '/delivery', { requestId: crypto.randomUUID(), email: null }); assert.equal(delivery.status, 200);
        const link = new URL(delivery.data.receiptUrl); assert.equal(link.origin, origin.origin);
        const receipt = await request('/license/v1/receipt', { token: link.hash.slice(1) }, false); assert.equal(receipt.status, 200); assert.ok(receipt.data.licenseKey === created.data.licenseKey, 'Receipt code differs');
        checks.push('private cloud receipt and code recovery match the originally issued code');
        const list = await request('/admin/v1/licenses?q=' + encodeURIComponent(payload.orderRef)); assert.equal(list.data.licenses.length, 1);
        assert.equal(list.data.licenses[0].key_hash, undefined); assert.equal(list.data.licenses[0].licenseKey, undefined);
        checks.push('search finds the test record without exposing plaintext codes or lookup hashes');
    } finally {
        if (licenseId) {
            const current = await request('/admin/v1/licenses/' + licenseId);
            if (current.data.license.status === 'active') {
                const stopped = await request('/admin/v1/licenses/' + licenseId + '/disable', { requestId: crypto.randomUUID(), expectedRevision: current.data.license.revision });
                assert.equal(stopped.status, 200, 'Could not disable the smoke-test license');
            }
        }
    }
    const target = path.join(root, 'artifacts/license-cloud-checks.json');
    fs.writeFileSync(target, JSON.stringify({ origin: origin.origin, checks, testLicenseDisabled: true, saleOpen: false, activationEnabled: false, realEmailSent: false, checkedAt: new Date().toISOString() }, null, 2));
    console.log('Cloudflare license flow passed: ' + checks.length + ' checks; smoke-test license disabled; sales and activation remain closed.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
