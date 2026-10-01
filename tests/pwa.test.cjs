const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('install manifest supplies real 192 and 512 pixel PNG assets within app scope', () => {
    const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8').replace(/^\uFEFF/, ''));
    const base = new URL('https://bynd.ccwu.cc/');
    for (const size of [192, 512]) {
        const icon = manifest.icons.find(item => item.sizes === `${size}x${size}` && item.purpose === 'any');
        assert.ok(icon, `Missing ${size}px install icon`);
        assert.equal(icon.type, 'image/png');
        const url = new URL(icon.src, base);
        assert.equal(url.origin, base.origin);
        const png = fs.readFileSync(icon.src);
        assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        assert.equal(png.readUInt32BE(16), size);
        assert.equal(png.readUInt32BE(20), size);
    }
    assert.equal(manifest.id, '/');
    assert.equal(new URL(manifest.start_url, base).pathname, '/');
    assert.ok(['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display));
});

test('Apple home screen icon links to a real 180 pixel PNG', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const src = html.match(/<link rel="apple-touch-icon" sizes="180x180" href="([^"?]+)/)?.[1];
    assert.ok(src);
    const png = fs.readFileSync(src);
    assert.equal(png.readUInt32BE(16), 180);
    assert.equal(png.readUInt32BE(20), 180);
});
