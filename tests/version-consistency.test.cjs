const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { apply, currentVersion, LOCAL_ASSET, RULES } = require('../scripts/bump-version.cjs');

const root = path.resolve(__dirname, '..');

test('version updates preserve the desktop installation launch hint', () => {
    const transform = RULES.find(([file]) => file === 'manifest.webmanifest')[1];
    assert.equal(transform('{"start_url": "/?v=1.1.885&bynd-app=desktop"}', '1.1.886'), '{"start_url": "/?v=1.1.886&bynd-app=desktop"}');
});

test('every local asset, the service worker, the manifest and the APK share APP_VERSION', () => {
    const version = currentVersion();
    assert.deepEqual(apply(version, { dryRun: true, bumped: false }), [], 'run: node scripts/bump-version.cjs');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const keys = new Set([...html.matchAll(LOCAL_ASSET)].map(match => match[0].split('?v=')[1]));
    assert.deepEqual([...keys], [version]);
    assert.match(fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8'), new RegExp(`versionName '${version.replace(/\./g, '\.')}'`));
});
