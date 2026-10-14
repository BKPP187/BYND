#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

async function main(args = process.argv.slice(2)) {
    const [command, ...values] = args;
    if (command === 'keygen') {
        const directory = path.resolve(__dirname, '../.bynd-license-secrets');
        fs.mkdirSync(directory, { recursive: true });
        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
        const kid = 'bynd-' + new Date().toISOString().slice(0, 10);
        const files = {
            'signing-private.jwk': JSON.stringify(privateKey.export({ format: 'jwk' })),
            'public-keys.json': JSON.stringify({ [kid]: publicKey.export({ type: 'spki', format: 'der' }).toString('base64url') }, null, 2),
            'admin-token.txt': crypto.randomBytes(32).toString('hex'),
            'license-key-secret.txt': crypto.randomBytes(32).toString('hex'),
            'signing-key-id.txt': kid
        };
        for (const name of Object.keys(files)) if (fs.existsSync(path.join(directory, name))) throw new Error('密钥已存在，拒绝覆盖。请保留原密钥及离线备份。');
        for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), text, { flag: 'wx', mode: 0o600 });
        console.log('已生成本地密钥文件：' + directory + '（未上传，不打印密钥）。请限制 Windows 文件权限并保存加密备份。');
        return;
    }
    if (!['create', 'inspect', 'disable', 'enable', 'unbind', 'publish', 'delivery', 'email', 'list'].includes(command)) throw new Error('用法：keygen | create <UUID-v4> [购买记录] | list [搜索] | inspect <License-ID> | disable|enable|unbind <License-ID> [UUID-v4] | delivery <License-ID> <UUID-v4> [邮箱] | email <领取记录ID> | publish <清单.json>');
    const base = new URL(process.env.BYND_LICENSE_URL || 'https://bynd.ccwu.cc');
    if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('服务地址必须是 HTTPS 来源；仅本机测试允许 HTTP。');
    const token = process.env.BYND_LICENSE_ADMIN_TOKEN;
    if (!token || token.length < 32) throw new Error('请在本机设置 BYND_LICENSE_ADMIN_TOKEN，勿将管理令牌放入命令参数。');
    let endpoint, body, method = 'POST';
    if (command === 'create') {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(values[0] || '')) throw new Error('请提供 UUID v4；网络失败后使用相同编号重试，避免重复发码。');
        endpoint = '/admin/v1/licenses'; body = { requestId: values[0], orderRef: values[1] || null };
    } else if (command === 'publish') {
        endpoint = '/admin/v1/releases/android/stable'; body = JSON.parse(fs.readFileSync(values[0], 'utf8'));
    } else if (command === 'list') {
        endpoint = '/admin/v1/licenses?q=' + encodeURIComponent(values[0] || ''); method = 'GET';
    } else if (command === 'email') {
        if (!/^[0-9a-f-]{36}$/i.test(values[0] || '')) throw new Error('领取记录ID无效。');
        endpoint = '/admin/v1/deliveries/' + values[0] + '/email'; body = {};
    } else if (command === 'delivery') {
        if (!/^[0-9a-f-]{36}$/i.test(values[0] || '') || !/^[0-9a-f-]{36}$/i.test(values[1] || '')) throw new Error('需要 License-ID 和稳定的 UUID v4 请求编号。');
        endpoint = '/admin/v1/licenses/' + values[0] + '/delivery'; body = { requestId: values[1], email: values[2] || null };
    } else {
        if (!/^[0-9a-f-]{36}$/i.test(values[0] || '')) throw new Error('License-ID 无效。');
        endpoint = '/admin/v1/licenses/' + values[0] + (command === 'inspect' ? '' : '/' + command); body = {};
        if (command === 'inspect') method = 'GET';
        else {
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(values[1] || '')) throw new Error('管理修改需要稳定 UUID v4；失败后使用相同编号重试，避免重复解绑。');
            body.requestId = values[1];
        }
    }
    const response = await fetch(new URL(endpoint, base), { method, redirect: 'error',
        signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: method === 'GET' ? undefined : JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '操作失败：HTTP ' + response.status);
    console.log(JSON.stringify(data, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
