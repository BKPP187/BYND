const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function harness(fetchImpl = async () => { throw new Error('unexpected request'); }) {
    const values = new Map();
    const window = {};
    const context = { window, localStorage:{ getItem:key => values.get(key) || null, setItem:(key,value) => values.set(key,value) }, fetch:fetchImpl, AbortController, setTimeout, clearTimeout, console:{ warn() {} } };
    vm.runInNewContext(read('modules/decision/jev.js'), context);
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

test('the settings backup excludes the locally saved Jev secret', () => {
    const settings = read('settings.js');
    assert.match(settings, /keys\.delete\(jevStorageKey\)/);
    assert.match(settings, /key !== \(window\.ByndJev\?\.storageKey \|\| 'bynd_jev_config_v1'\)/);
});

test('all BYND decision entry points keep their agent fallback', () => {
    const wechat = read('wechat.js');
    const forum = read('modules/living-world/living-world.js');
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
