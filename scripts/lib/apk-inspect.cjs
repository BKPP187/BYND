'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
function zipEntries(bytes) {
    let end = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) { end = offset; break; }
    if (end < 0) throw Error('APK ZIP directory missing');
    const count = bytes.readUInt16LE(end + 10), entries = new Map(); let offset = bytes.readUInt32LE(end + 16);
    if (count === 65535) throw Error('ZIP64 APKs are unsupported');
    for (let index = 0; index < count; index++) {
        if (bytes.readUInt32LE(offset) !== 0x02014b50) throw Error('Invalid APK ZIP directory');
        const method = bytes.readUInt16LE(offset + 10), compressed = bytes.readUInt32LE(offset + 20), size = bytes.readUInt32LE(offset + 24);
        const length = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32), local = bytes.readUInt32LE(offset + 42);
        const name = bytes.subarray(offset + 46, offset + 46 + length).toString('utf8');
        if (entries.has(name) || name.split('/').includes('..') || name.includes('\\') || name.startsWith('/')) throw Error('Duplicate or unsafe APK entry');
        entries.set(name, () => {
            if (bytes.readUInt32LE(local) !== 0x04034b50) throw Error('Invalid APK entry');
            const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28), data = bytes.subarray(start, start + compressed);
            const decoded = method === 0 ? data : method === 8 ? zlib.inflateRawSync(data, { maxOutputLength: Math.max(size, 1) }) : null;
            if (!decoded || decoded.length !== size) throw Error('Invalid APK compression'); return decoded;
        });
        offset += 46 + length + extra + comment;
    }
    return entries;
}
function inspectApk(file, { verifyResources = true } = {}) {
    file = path.resolve(file); const bytes = fs.readFileSync(file);
    const tools = process.env.BYND_ANDROID_TOOLS || 'D:/000000000000000/BYND_build_tools';
    const java = path.join(process.env.JAVA_HOME || path.join(tools, 'jdk17/jdk-17.0.19+10'), 'bin/java.exe');
    const sdk = process.env.ANDROID_HOME || path.join(tools, 'android-sdk');
    const build = path.join(sdk, 'build-tools/35.0.0');
    const signed = execFileSync(java, ['-jar', path.join(build, 'lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', file], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    const cert = /Signer #1 certificate SHA-256 digest: ([a-fA-F0-9]{64})/.exec(signed)?.[1]?.toLowerCase();
    if (!cert || !/Verified using v2 scheme .*: true/.test(signed)) throw Error('APK must have a verified v2 release signature');
    if (/Signer #2 certificate/.test(signed)) throw Error('Multiple APK signers are unsupported');
    const badging = execFileSync(path.join(build, 'aapt.exe'), ['dump', 'badging', file], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    const identity = /package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/.exec(badging);
    if (!identity || identity[1] !== 'cc.ccwu.bynd' || !/^\d+\.\d+\.\d+$/.test(identity[3])) throw Error('Unexpected APK identity');
    const entries = zipEntries(bytes), staged = path.join(root, 'android/app/build/generated/assets/www'); let verifiedFiles = 0;
    if (verifyResources) {
        require('../check-android-asset-dedup.cjs').verify(root, staged);
        for (const [name, read] of entries) {
            if (!name.startsWith('assets/www/') || name.endsWith('/')) continue;
            const relative = name.slice('assets/www/'.length);
            if (/^assets\/(website|contact)\//.test(relative) || ['shop.html', 'license-admin.html', 'license-receipt.html'].includes(relative)) throw Error('Website-only asset found in APK');
            const source = path.join(root, relative), stage = path.join(staged, relative), content = read();
            if (!fs.existsSync(stage) || !fs.readFileSync(stage).equals(content) || !fs.existsSync(source) || !fs.readFileSync(source).equals(content)) throw Error('APK resource differs from current source: ' + relative);
            verifiedFiles++;
        }
        function walk(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const target = path.join(directory, entry.name); if (entry.isDirectory()) walk(target); else if (entry.isFile() && !entries.has('assets/www/' + path.relative(staged, target).split(path.sep).join('/'))) throw Error('Missing staged APK resource: ' + entry.name); } }
        walk(staged);
        const version = require('../bump-version.cjs').currentVersion();
        if (identity[3] !== version) throw Error('APK version does not match current app sources');
    }
    return { packageName: identity[1], versionCode: Number(identity[2]), versionName: identity[3], sha256: crypto.createHash('sha256').update(bytes).digest('hex'), size: bytes.length, signerSha256: cert, resourcesVerified: verifiedFiles };
}
module.exports = { inspectApk, zipEntries };
