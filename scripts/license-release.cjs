#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { inspectApk } = require('./lib/apk-inspect.cjs');
async function main(args = process.argv.slice(2)) {
    const [command, file, notesFile] = args;
    if (!['inspect', 'upload'].includes(command) || !file) throw Error('用法：node scripts/license-release.cjs inspect|upload <正式签名APK> [更新内容.json]');
    const metadata = inspectApk(file);
    if (command === 'inspect') { console.log(JSON.stringify(metadata, null, 2)); return metadata; }
    if (metadata.size > 100000000) throw Error('此包超过单次 Worker 上传限制，请先配置更大文件的分发方案。');
    const origin = new URL(process.env.BYND_LICENSE_URL || 'https://bynd.ccwu.cc');
    if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) throw Error('服务来源无效。');
    const token = process.env.BYND_LICENSE_ADMIN_TOKEN;
    if (!token || token.length < 32) throw Error('请在本机设置 BYND_LICENSE_ADMIN_TOKEN。');
    const changelog = notesFile ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : { new: [], improved: [], fixed: [] };
    // Upload does not publish: review the generated manifest before choosing publish.
    const result = await fetch(new URL('/admin/v1/artifacts/' + metadata.sha256, origin), { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(180000),
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/vnd.android.package-archive', 'Content-Length': String(metadata.size), 'X-BYND-Artifact': JSON.stringify(metadata) },
        body: fs.createReadStream(path.resolve(file)), duplex: 'half' });
    const data = await result.json(); if (!result.ok) throw Error(data.message || '上传失败。');
    const apkOrigin = new URL(process.env.BYND_PUBLIC_APK_ORIGIN || 'https://bynd.ccwu.cc');
    if (apkOrigin.protocol !== 'https:' || apkOrigin.username || apkOrigin.password || apkOrigin.pathname !== '/' || apkOrigin.search || apkOrigin.hash) throw Error('APK 公开来源必须是 HTTPS。');
    const manifest = { versionCode: metadata.versionCode, versionName: metadata.versionName, size: metadata.size, sha256: metadata.sha256,
        apkUrl: new URL('/downloads/' + data.artifact.filename, apkOrigin).href, changelog };
    const directory = path.resolve(__dirname, '../artifacts/distribution'); fs.mkdirSync(directory, { recursive: true });
    const output = path.join(directory, 'BYND-v' + metadata.versionName + '.manifest.json'); fs.writeFileSync(output, JSON.stringify(manifest, null, 2));
    console.log('APK 已上传校验，尚未发布。更新清单：' + output); return manifest;
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
