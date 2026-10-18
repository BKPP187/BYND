#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { Readable } = require('node:stream');
const { createLocalEnvironment, createLocalRateLimiter } = require('./lib/license-dev-runtime.cjs');
const root = path.resolve(__dirname, '..');
async function start({ port = Number(process.env.BYND_LICENSE_DEV_PORT || 8993), directory = path.join(root, '.bynd-license-dev'), sandbox = null } = {}) {
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid port');
    if (sandbox) {
        if (path.resolve(directory) === path.join(root, '.bynd-license-dev')) throw Error('Sandbox must use its own database and signing keys');
        const { sandboxAlipay } = await import('../workers/license/alipay-sandbox.mjs'); sandboxAlipay(sandbox);
    }
    const { default: worker } = await import('../workers/license/worker.mjs');
    const { websiteCacheControl } = await import('../workers/license/assets.mjs');
    let env;
    const server = http.createServer(async (incoming, outgoing) => {
        try {
            const url = new URL(incoming.url, env.PUBLIC_ORIGIN), pathname = url.pathname;
            if (['/admin/v1/', '/account/v1/', '/license/v1/', '/updates/v1/', '/distribution/v1/', '/payment/v1/', '/downloads/'].some(prefix => pathname.startsWith(prefix))) {
                const headers = new Headers(incoming.headers); headers.set('CF-Connecting-IP', incoming.socket.remoteAddress || 'local');
                const request = new Request(url, { method: incoming.method, headers,
                    body: ['GET', 'HEAD'].includes(incoming.method) ? undefined : Readable.toWeb(incoming), duplex: 'half' });
                const response = await worker.fetch(request, env);
                outgoing.writeHead(response.status, Object.fromEntries(response.headers));
                if (response.body) { const stream = Readable.fromWeb(response.body); stream.on('error', () => outgoing.destroy()); stream.pipe(outgoing); }
                else outgoing.end();
                return;
            }
            let file;
            if (['/', '/shop.html', '/account.html', '/checkout.html', '/license-admin.html', '/license-receipt.html'].includes(pathname)) file = pathname === '/' ? 'shop.html' : pathname.slice(1);
            else if (/^\/assets\/website\/[a-z0-9-]+\.(css|js|png|webp)$/.test(pathname)) file = pathname.slice(1);
            if (!file || !['GET', 'HEAD'].includes(incoming.method) || !fs.existsSync(path.join(root, file))) { outgoing.writeHead(404); outgoing.end(); return; }
            const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.webp') ? 'image/webp' : 'image/png';
            outgoing.writeHead(200, { 'Content-Type': type, 'Cache-Control': websiteCacheControl(pathname), 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
                'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" });
            if (incoming.method === 'HEAD') outgoing.end(); else { const stream = fs.createReadStream(path.join(root, file)); stream.on('error', () => outgoing.destroy()); stream.pipe(outgoing); }
        } catch { if (!outgoing.headersSent) outgoing.writeHead(503, { 'Content-Type': 'application/json' }); outgoing.end(JSON.stringify({ message: '本地服务操作失败，请重试。' })); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    env = await createLocalEnvironment(directory, origin);
    if (sandbox) {
        Object.assign(env, sandbox, { PAYMENT_SANDBOX_ENABLED: 'true', PAYMENT_ISOLATION: 'sandbox-v1', PAYMENT_RATE_LIMITER: createLocalRateLimiter() });
    }
    return { server, env, origin, async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); env.DB.database.close(); } };
}
if (require.main === module) start().then(({ origin }) => console.log('BYND local distribution: ' + origin + '/shop.html\nManagement: ' + origin + '/license-admin.html\nLocal login token: .bynd-license-dev/admin-token.txt (not printed). Production unchanged.')).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { start };
