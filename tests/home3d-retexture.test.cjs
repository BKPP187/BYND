'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { createHash } = require('node:crypto');
const { main } = require('../scripts/retexture-home3d-character.cjs');
const { client } = require('../scripts/generate-home3d-character.cjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = data => ({ ok: true, json: async () => ({ code: 0, data }) });
function fixture() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-retexture-')), reference = path.join(directory, 'ref.png'), source = path.join(directory, 'source'), out = path.join(directory, 'out');
    fs.mkdirSync(source); fs.writeFileSync(reference, 'reference fixture');
    const model = fs.readFileSync(path.join(__dirname, '../assets/home3d/furniture/q-Sofa.glb'));
    fs.writeFileSync(path.join(source, 'character.glb'), model);
    fs.writeFileSync(path.join(source, 'generation.json'), JSON.stringify({ stage: 'validated-static-model', taskId: 'source_one', sha256: hash(model), referenceHash: hash(fs.readFileSync(reference)) }));
    return { source, reference, out, model, args: [source, reference, out] };
}
test('balance and task endpoints reject POST without sending a request', async () => {
    let calls = 0; const api = client('fake', async () => { calls++; return json({}); });
    await assert.rejects(api.request('/account/balance', {}), /read-only/);
    await assert.rejects(api.request('/tasks/test', {}), /read-only/); assert.equal(calls, 0);
});
test('insufficient balance and changed source stop before upload or paid submission', async () => {
    const f = fixture(), calls = [];
    const options = { apiKey: 'fake-secret', fetchImpl: async url => { calls.push(url); return json({ balance: 0 }); } };
    await assert.rejects(main(f.args, options), /30 available/); assert.equal(calls.length, 1); assert.ok(calls[0].endsWith('/account/balance'));
    fs.appendFileSync(path.join(f.source, 'character.glb'), 'changed');
    await assert.rejects(main(f.args, options), /Source model/); assert.equal(calls.length, 1);
});
test('ambiguous paid response is never retried and credentials are absent from saved state', async () => {
    const f = fixture(); let paid = 0;
    const options = { apiKey: 'fake-secret', fetchImpl: async url => {
        if (url.endsWith('/account/balance')) return json({ balance: 570 });
        if (url.endsWith('/files')) return json({ file_token: 'file_one' });
        paid++; throw new Error('network interrupted');
    } };
    await assert.rejects(main(f.args, options), /network interrupted/);
    await assert.rejects(main(f.args, options), /Prior submission/); assert.equal(paid, 1);
    assert.equal(fs.readFileSync(path.join(f.out, 'texture.json'), 'utf8').includes('fake-secret'), false);
    assert.equal(fs.existsSync(path.join(f.out, 'character.glb')), false);
});
test('resume polls the saved texture task without another paid submission', async () => {
    const f = fixture(); let paid = 0;
    const options = { apiKey: 'fake-secret', pollOptions: { attempts: 1, progress: () => {} }, fetchImpl: async (url, options) => {
        if (url.endsWith('/account/balance')) return json({ balance: 570 });
        if (url.endsWith('/files')) return json({ file_token: 'file_one' });
        if (url.endsWith('/models/texture')) { paid++; const body = JSON.parse(options.body); assert.equal(body.texture_quality, 'extreme'); assert.equal(body.input, 'source_one'); return json({ task_id: 'texture_one' }); }
        return json({ task_id: 'texture_one', status: 'queued' });
    } };
    await assert.rejects(main(f.args, options), /Polling limit/);
    await assert.rejects(main(f.args, options), /Polling limit/); assert.equal(paid, 1);
    fs.writeFileSync(f.reference, 'other reference'); await assert.rejects(main(f.args, options), /same PNG/); assert.equal(paid, 1);
});
let validatorAvailable = false;
try { require.resolve('../artifacts/home3d-tools/node_modules/gltf-validator'); validatorAvailable = true; } catch {}
test('failed download can resume without charging again and never receives the account credential', { skip: validatorAvailable ? false : 'Optional offline glTF validator is not installed.' }, async () => {
    const f = fixture(); let paid = 0, downloadFails = true;
    const options = { apiKey: 'fake-secret', fetchImpl: async (url, options) => {
        if (url.endsWith('/account/balance')) return json({ balance: 570 });
        if (url.endsWith('/files')) return json({ file_token: 'file_one' });
        if (url.endsWith('/models/texture')) { paid++; return json({ task_id: 'texture_one' }); }
        if (url.includes('/tasks/')) return json({ task_id: 'texture_one', status: 'success', credits_consumed: 30, output: { model_url: 'https://cdn.tripo3d.ai/test.glb' } });
        assert.equal(options.headers, undefined);
        return downloadFails ? { ok: false, status: 503 } : new Response(f.model);
    } };
    await assert.rejects(main(f.args, options), /download failed/);
    assert.equal(fs.existsSync(path.join(f.out, 'character.glb')), false);
    downloadFails = false;
    await main(f.args, options); assert.equal(paid, 1);
    assert.ok(fs.readFileSync(path.join(f.source, 'character.glb')).equals(f.model));
    assert.ok(fs.readFileSync(path.join(f.out, 'character.glb')).equals(f.model));
    const record = JSON.parse(fs.readFileSync(path.join(f.out, 'texture.json'), 'utf8'));
    assert.equal(record.stage, 'validated-HD-texture-for-review'); assert.equal(record.creditsConsumed, 30);
    await main(f.args, options); assert.equal(paid, 1);
    fs.appendFileSync(path.join(f.out, 'character.glb'), 'changed');
    await assert.rejects(main(f.args, options), /missing or changed/); assert.equal(paid, 1);
});
