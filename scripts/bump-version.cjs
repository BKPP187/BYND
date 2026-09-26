#!/usr/bin/env node
// Bumps the BYND app version everywhere it appears and gives every local asset the same cache key.
// Usage: node scripts/bump-version.cjs            (next patch, e.g. 1.1.685 -> 1.1.686)
//        node scripts/bump-version.cjs 1.2.0     (explicit version)
//        node scripts/bump-version.cjs --check   (report drift, change nothing)
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, text) => fs.writeFileSync(path.join(root, file), text);

function currentVersion() {
    const match = read('core/storage/backup.js').match(/const APP_VERSION = 'v(\d+\.\d+\.\d+)';/);
    if (!match) throw new Error('core/storage/backup.js APP_VERSION not found');
    return match[1];
}

function nextPatch(version) {
    const [major, minor, patch] = version.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
}

// A local asset reference: relative path (no scheme) ending in a cacheable extension, followed by ?v=...
const LOCAL_ASSET = /((?:src|href)=["'])(?![a-z]+:|\/\/)([^"'?#]+\.(?:js|css|png|webmanifest|json))\?v=[^"'#]+/g;

// Each rule: [file, transform(text, version) -> text]. Rules must be idempotent.
const RULES = [
    ['index.html', (text, v) => text
        .replace(LOCAL_ASSET, (_, prefix, file) => `${prefix}${file}?v=${v}`)
        .replace(/Beyond Screen v\d+\.\d+\.\d+/g, `Beyond Screen v${v}`)],
    ['ui/theme/style.css', (text, v) => text.replace(/(@import url\(["']?[^"')?]+\.css)\?v=[^"')]+/g, `$1?v=${v}`)],
    ['ui/theme/foundation.css', (text, v) => text.replace(/(@import url\(["']?[^"')?]+\.css)\?v=[^"')]+/g, `$1?v=${v}`)],
    ['manifest.webmanifest', (text, v) => text.replace(/("start_url": "\/\?v=)[^"]+"/, `$1${v}"`)],
    ['core/storage/backup.js', (text, v) => text.replace(/const APP_VERSION = 'v\d+\.\d+\.\d+';/, `const APP_VERSION = 'v${v}';`)],
    ['systems/proactive-notifications/notifications.js', (text, v) => text
        .replace(/register\('sw\.js\?v=[^']+'\)/, `register('sw.js?v=${v}')`)],
    ['apps/coreading/library.js', (text, v) => text
        .replace(/(assets\/coread-book-sources\.json\?v=)[^']+'/, `$1${v}'`)],
    ['core/api/mcp.js', (text, v) => text
        .replace(/(clientInfo: \{ name: 'BYND MCP', version: ')[^']+'/, `$1${v}'`)],
    ['apps/monitor/pet-background.js', (text, v) => text.replace(/(path\.startsWith\(assetRoot\) \? '[^']+' : ')[^']+'/, `$1${v}'`)],
    ['android/app/build.gradle', (text, v, bumped) => {
        let next = text.replace(/versionName '[^']+'/, `versionName '${v}'`);
        if (bumped) next = next.replace(/versionCode (\d+)/, (_, code) => `versionCode ${Number(code) + 1}`);
        return next;
    }]
];

function apply(version, { dryRun, bumped }) {
    const changed = [];
    for (const [file, transform] of RULES) {
        const before = read(file);
        const after = transform(before, version, bumped);
        if (after !== before) {
            changed.push(file);
            if (!dryRun) write(file, after);
        }
    }
    return changed;
}

function main() {
    const arg = process.argv[2];
    const current = currentVersion();
    if (arg === '--check') {
        const drift = apply(current, { dryRun: true, bumped: false });
        if (drift.length) {
            console.error(`Version drift from ${current} in: ${drift.join(', ')}`);
            process.exit(1);
        }
        console.log(`All versions match ${current}`);
        return;
    }
    const target = arg || nextPatch(current);
    if (!/^\d+\.\d+\.\d+$/.test(target)) throw new Error(`Invalid version: ${target}`);
    const changed = apply(target, { dryRun: false, bumped: target !== current });
    console.log(`${current} -> ${target}; updated ${changed.length ? changed.join(', ') : 'nothing'}`);
}

if (require.main === module) main();
module.exports = { RULES, LOCAL_ASSET, apply, currentVersion, nextPatch };
