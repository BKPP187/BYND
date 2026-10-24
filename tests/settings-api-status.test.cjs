const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root } = require('./helpers/harness.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function probe(status, body) {
    const context = vm.createContext({
        URL, AbortSignal, console,
        resolveByndApiBaseUrl: url => url, isByndProxiedApiBaseUrl: () => false,
        getApiProxyHint: () => '', parseSettingsApiJsonResponseText: JSON.parse,
        fetch: async () => ({ ok: status === 200, status, text: async () => body })
    });
    vm.runInContext(read('apps/settings/api-test.js'), context);
    return vm.runInContext('doTestApi', context)('https://relay.example.com', 'sk-x');
}

test('a rejected key shows the relay\'s own reason without its request id, plus a hint', async () => {
    const result = await probe(401, JSON.stringify({ error: { message: '该令牌额度已用尽 (request id: 20261022)', type: 'new_api_error' } }));
    assert.equal(result.ok, false);
    assert.match(result.error, /^接口拒绝了这个 API Key \(401\)：该令牌额度已用尽/);
    assert.doesNotMatch(result.error, /request id/);
    assert.match(result.hint, /令牌 \/ API Keys/);
});

test('plain-text and HTML 401 bodies are handled', async () => {
    assert.match((await probe(401, 'Invalid token')).error, /：Invalid token/);
    assert.doesNotMatch((await probe(401, '<!DOCTYPE html><html>login</html>')).error, /html/i, 'login pages are not shown as the reason');
    assert.match((await probe(403, JSON.stringify({ message: '您的 IP 不在令牌允许访问的列表中' }))).error, /403\)：您的 IP/);
});

test('API and voice test results use line icons, not emoji', () => {
    const modal = read('apps/settings/api-test-modal.js');
    assert.doesNotMatch(modal, /[⏳✅❌]/u);
    assert.doesNotMatch(modal, /style="color:#(?:f87171|66d9a0|fbbf24|b7791f);"/);
    assert.match(modal, /function settingsStatusHtml\(kind, html\)/);
    assert.match(read('apps/settings/settings-layout.css'), /\.set-status-spinner/);
});
