'use strict';
const fs = require('node:fs'), path = require('node:path');
const { start } = require('./license-dev-server.cjs');
const root = path.resolve(__dirname, '..');
function configuration() {
    const file = path.join(root, '.bynd-license-secrets/alipay-sandbox.json'), value = JSON.parse(fs.readFileSync(file, 'utf8'));
    const expected = ['ALIPAY_SANDBOX_APP_ID', 'ALIPAY_SANDBOX_SELLER_ID', 'ALIPAY_SANDBOX_PRIVATE_KEY', 'ALIPAY_SANDBOX_PUBLIC_KEY'];
    if (Object.keys(value).length !== expected.length || !expected.every(name => typeof value[name] === 'string' && value[name])) throw Error('Sandbox configuration is incomplete');
    return value;
}
async function launch({ port = Number(process.env.BYND_PAYMENT_SANDBOX_PORT || 8994) } = {}) {
    return start({ port, directory: path.join(root, '.bynd-license-dev/payment-sandbox'), sandbox: configuration() });
}
if (require.main === module) launch().then(({ origin }) => console.log('BYND sandbox checkout: ' + origin + '/checkout.html\nSandbox accounts: ' + origin + '/account.html\nOnly simulated payments. Production sales remain closed.')).catch(() => { console.error('Cannot start sandbox. Check the private configuration and port.'); process.exitCode = 1; });
module.exports = { launch, configuration };
