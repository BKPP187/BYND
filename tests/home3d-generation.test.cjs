'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { client, poll, downloadModel, main } = require('../scripts/generate-home3d-character.cjs');
const json = data => ({ ok: true, json: async () => ({ code: 0, data }) });

test('credentialed requests stay on fixed official endpoints and redact upstream failure bodies', async () => {
    const requests = [];
    const api = client('test-secret', async (url, options) => { requests.push({ url, options }); return { ok: false, status: 403, json: async () => ({ message: 'test-secret' }) }; });
    await assert.rejects(api.request('/generation/image-to-model', {}), /HTTP 403/);
    assert.equal(requests.length, 1, 'paid requests are never retried');
    assert.equal(requests[0].options.redirect, 'error');
    assert.equal(requests[0].url, 'https://openapi.tripo3d.ai/v3/generation/image-to-model');
    await assert.rejects(api.request('/unsupported', {}), /Unsupported/);
    assert.equal(requests.length, 1);
});

test('polling rejects failed, mismatched and unknown tasks; queued tasks can complete', async () => {
    for (const task of [{ task_id: 'other', status: 'success' }, { task_id: 'task_one', status: 'failed' }, { task_id: 'task_one', status: 'unknown' }]) await assert.rejects(poll({ request: async () => task }, 'task_one', { wait: async () => {} }));
    const tasks = [{ task_id: 'task_one', status: 'queued' }, { task_id: 'task_one', status: 'success', output: { model_url: 'https://cdn.tripo3d.ai/model.glb' } }];
    assert.equal((await poll({ request: async () => tasks.shift() }, 'task_one', { wait: async () => {} })).status, 'success');
});

test('CDN downloads receive no account key and reject failed responses', async () => {
    let options;
    await assert.rejects(downloadModel('http://cdn.tripo3d.ai/model.glb'), /Invalid/);
    await assert.rejects(downloadModel('https://cdn.tripo3d.ai/model.glb', async (_url, value) => { options = value; return { ok: false, status: 403 }; }), /download failed/);
    assert.equal(options.headers, undefined);
});

test('resuming a queued generation never repeats the paid submission, and changed references are rejected', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-model-generation-'));
    const input = path.join(directory, 'reference.png'), out = path.join(directory, 'result');
    fs.writeFileSync(input, Buffer.from('reference fixture'));
    const calls = [];
    const fetchImpl = async (url, options) => {
        calls.push({ url, method: options.method });
        if (url.endsWith('/files')) return json({ file_token: 'file_one' });
        if (url.endsWith('/generation/image-to-model')) return json({ task_id: 'task_one' });
        return json({ task_id: 'task_one', status: 'queued' });
    };
    const options = { apiKey: 'test-secret', fetchImpl, pollOptions: { attempts: 1, progress: () => {} } };
    await assert.rejects(main([input, out], options), /Polling limit/);
    await assert.rejects(main([input, out], options), /Polling limit/);
    assert.equal(calls.filter(call => call.method === 'POST' && call.url.endsWith('/generation/image-to-model')).length, 1);
    assert.equal(fs.readFileSync(path.join(out, 'generation.json'), 'utf8').includes('test-secret'), false);
    assert.equal(fs.existsSync(path.join(out, 'character.glb')), false, 'pending tasks never produce a fake model');
    const count = calls.length;
    fs.writeFileSync(input, 'different reference');
    await assert.rejects(main([input, out], options), /different reference/);
    assert.equal(calls.length, count);
});

let validatorAvailable = false;
try { require.resolve('../artifacts/home3d-tools/node_modules/gltf-validator'); validatorAvailable = true; } catch {}
test('completed mocked generation validates the downloaded GLB and preserves it on rerun', { skip: validatorAvailable ? false : 'Optional offline glTF validator is not installed.' }, async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-model-success-'));
    const input = path.join(directory, 'reference.png'), out = path.join(directory, 'result');
    fs.writeFileSync(input, 'reference fixture');
    const fixture = fs.readFileSync(path.join(__dirname, '../assets/home3d/furniture/q-Sofa.glb'));
    let calls = 0;
    const fetchImpl = async (url, options) => {
        calls++;
        if (url.endsWith('/files')) return json({ file_token: 'file_one' });
        if (url.endsWith('/generation/image-to-model')) return json({ task_id: 'task_one' });
        if (url.includes('/tasks/')) return json({ task_id: 'task_one', status: 'success', credits_consumed: 55, output: { model_url: 'https://cdn.tripo3d.ai/test.glb' } });
        assert.equal(options.headers, undefined);
        return new Response(fixture);
    };
    const options = { apiKey: 'test-secret', fetchImpl };
    await main([input, out], options);
    const record = JSON.parse(fs.readFileSync(path.join(out, 'generation.json'), 'utf8'));
    assert.equal(record.stage, 'validated-static-model');
    assert.equal(record.creditsConsumed, 55);
    assert.ok(fs.readFileSync(path.join(out, 'character.glb')).equals(fixture));
    const count = calls;
    await main([input, out], options);
    assert.equal(calls, count);
    fs.appendFileSync(path.join(out, 'character.glb'), 'changed');
    await assert.rejects(main([input, out], options), /missing or changed/);
    assert.equal(calls, count);
});
