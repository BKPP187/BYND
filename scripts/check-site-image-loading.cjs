'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
async function main() {
    const { website } = await import('../workers/license/assets.mjs');
    const rows = [];
    for (const [file, budget] of [['account.html', 150000], ['license-receipt.html', 150000], ['shop.html', 250000]]) {
        const html = fs.readFileSync(path.join(root, file), 'utf8'), match = html.match(/src="(assets\/website\/bynd-companion[^" ]+)"/);
        assert.ok(match, 'Missing image on ' + file);
        const bytes = fs.statSync(path.join(root, match[1])).size;
        const response = await website(new Request('https://bynd.ccwu.cc/' + match[1]), { ASSETS: { fetch: async () => new Response('fixture', { headers: { 'Content-Type': match[1].endsWith('.webp') ? 'image/webp' : 'image/png' } }) } });
        const cacheControl = response.headers.get('cache-control'); rows.push({ page: file, resource: match[1], bytes, cacheControl });
        assert.ok(bytes <= budget, file + ': illustration is ' + bytes + ' bytes, budget is ' + budget);
        assert.match(cacheControl, /public.*max-age=31536000.*immutable/, file + ': reusable illustration must be cached');
    }
    const privatePage = await website(new Request('https://bynd.ccwu.cc/account.html'), { ASSETS: { fetch: async () => new Response('<html>account</html>') } });
    assert.equal(privatePage.headers.get('cache-control'), 'no-store');
    const missing = await website(new Request('https://bynd.ccwu.cc/assets/website/bynd-companion-256-000000000000.webp'), { ASSETS: { fetch: async () => new Response('missing', { status: 404 }) } });
    assert.equal(missing.headers.get('cache-control'), 'no-store');
    console.log(JSON.stringify(rows, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
