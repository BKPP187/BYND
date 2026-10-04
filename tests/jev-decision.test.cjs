const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { clone, storageHarness, addBackupModule } = require('./helpers/harness.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function harness(fetchImpl = async () => { throw new Error('unexpected request'); }) {
    const values = new Map();
    const window = {};
    const context = { window, localStorage:{ getItem:key => values.get(key) || null, setItem:(key,value) => values.set(key,value) }, fetch:fetchImpl, AbortController, setTimeout, clearTimeout, console:{ warn() {} } };
    vm.runInNewContext(read('systems/agent-runtime/jev.js'), context);
    return { api:window.ByndJev, values };
}

test('Jev is opt-in and returns to BYND when disabled', async () => {
    const { api } = harness();
    assert.equal(api.available('moment'), false);
    assert.equal(await api.choose('moment', {}, 'Choose', { post:'Post', silence:'Stay quiet' }), null);
    api.write({ enabled:true, apiKey:'test-key', scopes:{ moment:false } });
    assert.equal(api.available('moment'), false);
    assert.equal(api.available('forumReply'), true);
});

test('Jev sends a typed choice and accepts only declared answers', async () => {
    let request;
    const { api } = harness(async (_url, options) => {
        request = options;
        return { ok:true, json:async () => ({ answers:{ decision:{ type:'choice', choice:'reply' } } }) };
    });
    api.write({ enabled:true, apiKey:'test-key', scopes:{} });
    assert.equal(await api.choose('forumReply', { ageMinutes:14 }, 'Reply?', { reply:'Respond', silence:'No' }), 'reply');
    assert.equal(request.headers.Authorization, 'Bearer test-key');
    assert.equal(JSON.parse(request.body).questions.decision.type, 'choice');
    assert.equal(JSON.parse(request.body).state.ageMinutes, 14);
});

test('Jev errors or undeclared choices fall back without publishing an action', async () => {
    const unavailable = harness(async () => { throw new Error('network unavailable'); });
    unavailable.api.write({ enabled:true, apiKey:'test-key', scopes:{} });
    assert.equal(await unavailable.api.choose('moment', {}, 'Choose', { post:'Post', silence:'No' }), null);
    const malformed = harness(async () => ({ ok:true, json:async () => ({ answers:{ decision:{ type:'choice', choice:'delete_everything' } } }) }));
    malformed.api.write({ enabled:true, apiKey:'test-key', scopes:{} });
    assert.equal(await malformed.api.choose('moment', {}, 'Choose', { post:'Post', silence:'No' }), null);
});

test('a browser CORS failure retries through the fixed BYND proxy', async () => {
    const urls = [];
    const { api } = harness(async (url) => {
        urls.push(url);
        if (urls.length === 1) throw new TypeError('Failed to fetch');
        return { ok:true, json:async () => ({ answers:{ decision:{ type:'choice', choice:'silence' } } }) };
    });
    api.write({ enabled:true, apiKey:'test-key', scopes:{} });
    assert.equal(await api.choose('forumReply', {}, 'Reply?', { reply:'Yes', silence:'No' }), 'silence');
    assert.match(urls[0], /api\.typesafe\.ai\/v1\/systemone/);
    assert.match(urls[1], /bynd\.ccwu\.cc\/mcp\/relay\/jev\/v1\/systemone/);
});

test('missing Jev proxy reports deployment status without blaming the key', async () => {
    let calls = 0;
    const { api } = harness(async () => {
        calls += 1;
        if (calls === 1) throw new TypeError('Failed to fetch');
        return { ok:false, status:404 };
    });
    await assert.rejects(api.testConnection('test-key'), /转发服务尚未上线.*不是密钥格式问题/);
});

function backupHarness(entries = {}) {
    const h = addBackupModule(storageHarness({ local: [], entries }));
    h.reloads = 0;
    h.context.confirm = () => true;
    h.context.location = { reload() { h.reloads++; } };
    return h;
}

const importBackup = (h, data) => h.context.importAllData({ value: 'file', files: [{ text: async () => JSON.stringify(data) }] });

test('Jev key and all decision settings survive JSON export and import on a fresh device', async () => {
    const source = backupHarness();
    vm.runInContext(read('systems/agent-runtime/jev.js'), source.context);
    const config = clone(source.context.window.ByndJev.write({ enabled: true, apiKey: 'apikey_migration_test', minProbability: 0.78,
        scopes: { moment: false, forumReply: false, cycleReview: true } }));
    const backup = await source.context.buildByndBackupData();
    assert.deepEqual(clone(backup.bynd_jev_config_v1), config);
    for (const moduleLoaded of [false, true]) {
        const target = backupHarness();
        if (moduleLoaded) vm.runInContext(read('systems/agent-runtime/jev.js'), target.context);
        await importBackup(target, backup);
        assert.equal(target.reloads, 1);
        if (!moduleLoaded) vm.runInContext(read('systems/agent-runtime/jev.js'), target.context);
        const api = target.context.window.ByndJev;
        assert.deepEqual(clone(api.read()), config);
        assert.equal(api.available('turn'), true);
        assert.equal(api.available('moment'), false);
        assert.equal(api.available('cycleReview'), true);
    }
});

test('an old backup without Jev settings keeps the destination device configuration', async () => {
    const saved = JSON.stringify({ enabled: true, apiKey: 'apikey_existing', minProbability: 0.65, scopes: { moment: false } });
    const target = backupHarness({ bynd_jev_config_v1: saved });
    await importBackup(target, { _version: 'v1.1.801', my_characters_data: [] });
    assert.equal(target.localStorage.getItem('bynd_jev_config_v1'), saved);
    assert.equal(target.reloads, 1);
});

test('a Jev storage read failure prevents export and a success message', async () => {
    const h = backupHarness({ bynd_jev_config_v1: '{"apiKey":"apikey_test"}' });
    const getItem = h.localStorage.getItem.bind(h.localStorage);
    h.localStorage.getItem = key => {
        if (key === 'bynd_jev_config_v1') throw new Error('Jev storage unavailable');
        return getItem(key);
    };
    let downloads = 0;
    h.context.document.createElement = () => ({ click() { downloads++; } });
    assert.equal(await h.context.exportAllData(), false);
    assert.equal(downloads, 0);
    assert.match(h.notices.at(-1), /导出失败.*Jev storage unavailable/);
    assert.equal(h.notices.some(message => message.includes('成功')), false);
});

test('a Jev storage write failure prevents import success and reload and retains the old key', async () => {
    const saved = '{"apiKey":"apikey_existing"}';
    const h = backupHarness({ bynd_jev_config_v1: saved });
    const setItem = h.localStorage.setItem.bind(h.localStorage);
    h.localStorage.setItem = (key, value) => {
        if (key === 'bynd_jev_config_v1') throw new Error('storage quota exceeded');
        setItem(key, value);
    };
    await importBackup(h, { _version: 'test', bynd_jev_config_v1: { enabled: true, apiKey: 'apikey_new' } });
    assert.equal(h.reloads, 0);
    assert.equal(h.localStorage.getItem('bynd_jev_config_v1'), saved);
    assert.match(h.notices.at(-1), /导入失败.*storage quota exceeded/);
    assert.equal(h.notices.some(message => message.includes('成功')), false);
});

test('all BYND decision entry points keep their agent fallback', () => {
    const wechat = read('wechat.js');
    const forum = read('systems/living-world/living-world.js');
    assert.match(wechat, /ByndJev\?\.choose\('moment'/);
    assert.match(wechat, /ByndJev\?\.choose\('momentEngagement'/);
    assert.match(forum, /ByndJev\?\.choose\('forumAction'/);
    assert.match(forum, /ByndJev\?\.choose\('forumReply'/);
    assert.match(forum, /ByndJev\?\.choose\('profile'/);
    assert.match(wechat, /jevChoice === 'post'[\s\S]*: '你只决定角色是否会/);
    assert.match(wechat, /"action":"comment"[\s\S]*"action":"silence"/);
    assert.match(wechat, /"action":"ask"[\s\S]*"action":"silence"/);
    assert.match(forum, /jevAction \? `Jev 已选择 action=/);
});
