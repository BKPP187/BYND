const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { apply, currentVersion, LOCAL_ASSET } = require('../scripts/bump-version.cjs');

const root = path.resolve(__dirname, '..');

test('every local asset, the service worker, the manifest and the APK share APP_VERSION', () => {
    const version = currentVersion();
    assert.deepEqual(apply(version, { dryRun: true, bumped: false }), [], 'run: node scripts/bump-version.cjs');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const keys = new Set([...html.matchAll(LOCAL_ASSET)].map(match => match[0].split('?v=')[1]));
    assert.deepEqual([...keys], [version]);
    assert.match(fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8'), new RegExp(`versionName '${version.replace(/\./g, '\.')}'`));
});
