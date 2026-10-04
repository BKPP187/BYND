'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { main } = require('../scripts/rig-home3d-character.cjs');
const fixture = () => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-rig-')), input = path.resolve(__dirname, '../assets/home3d/furniture/q-Sofa.glb'), out = path.join(directory, 'out'); return { directory, input, out }; };
const json = data => ({ ok: true, json: async () => ({ code: 0, data }) });
test('failed compatibility check stops before any paid rig', async () => {
    const f = fixture(), calls = [];
    try {
        await assert.rejects(main([f.input, f.out], { apiKey: 'fake', fetchImpl: async url => { calls.push(url); if (url.endsWith('/files')) return json({ file_token: 'file_one' }); if (url.endsWith('/rig-check')) return json({ task_id: 'check_one' }); return json({ task_id: 'check_one', status: 'success', output: { riggable: false, rig_type: 'biped' } }); } }), /no paid rig/);
        assert.equal(calls.filter(url => url.endsWith('/animations/rig')).length, 0);
    } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});
test('rig download failure resumes the same paid task and validates actual joints', async () => {
    const f = fixture(), calls = [], rig = fs.readFileSync(path.resolve(__dirname, '../assets/home3d/characters/bunny-blue-v1/far.glb')); let downloadFails = true;
    const fetchImpl = async (url, options) => {
        calls.push(url);
        if (url.endsWith('/files')) return json({ file_token: 'file_one' });
        if (url.endsWith('/rig-check')) return json({ task_id: 'check_one' });
        if (url.endsWith('/tasks/check_one')) return json({ task_id: 'check_one', status: 'success', output: { riggable: true, rig_type: 'biped' } });
        if (url.endsWith('/animations/rig')) return json({ task_id: 'rig_one' });
        if (url.endsWith('/tasks/rig_one')) return json({ task_id: 'rig_one', status: 'success', output: { model_url: 'https://cdn.tripo3d.ai/test.glb' }, credits_consumed: 25 });
        assert.equal(options.headers, undefined, 'no API credential on CDN download');
        return downloadFails ? { ok: false, status: 403 } : { ok: true, headers: new Map(), body: [rig] };
    };
    try {
        await assert.rejects(main([f.input, f.out], { apiKey: 'fake', fetchImpl }), /download failed/);
        downloadFails = false; await main([f.input, f.out], { apiKey: 'fake', fetchImpl });
        assert.equal(calls.filter(url => url.endsWith('/animations/rig')).length, 1);
        assert.equal(JSON.parse(fs.readFileSync(path.join(f.out, 'rigging.json'))).stage, 'validated-rig');
        const before = calls.length; await main([f.input, f.out], { apiKey: 'fake', fetchImpl }); assert.equal(calls.length, before);
    } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});
