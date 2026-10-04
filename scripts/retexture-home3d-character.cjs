'use strict';
const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { client, taskId, poll, downloadModel } = require('./generate-home3d-character.cjs');
const { inspect } = require('./check-home3d-character-model.cjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const configuration = Object.freeze({ model: 'v3.5-20260815', texture_quality: 'extreme', texture_alignment: 'geometry', pbr: true, bake: true, delight: true, texture_seed: 20261002 });
function save(file, data) {
    fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(file + '.tmp', file);
}
async function main(args = process.argv.slice(2), { apiKey = process.env.TRIPO_API_KEY, fetchImpl = fetch, pollOptions = {} } = {}) {
    if (args.length !== 3) throw new Error('Usage: node scripts/retexture-home3d-character.cjs <generation-directory> <reference.png> <output-directory>');
    const source = path.resolve(args[0]), reference = path.resolve(args[1]), directory = path.resolve(args[2]);
    if (source === directory) throw new Error('Use a separate output directory; the source must be preserved.');
    const generation = JSON.parse(fs.readFileSync(path.join(source, 'generation.json'), 'utf8'));
    const sourceHash = hash(fs.readFileSync(path.join(source, 'character.glb')));
    if (generation.stage !== 'validated-static-model' || generation.sha256 !== sourceHash) throw new Error('Source model is not validated or has changed.');
    taskId(generation.taskId);
    const bytes = fs.readFileSync(reference), referenceHash = hash(bytes);
    if (!/\.png$/i.test(reference) || !bytes.length || bytes.length > 20 * 1024 * 1024 || generation.referenceHash !== referenceHash) throw new Error('Use the same PNG reference as the source generation (maximum 20 MB).');
    const api = client(apiKey, fetchImpl), manifest = path.join(directory, 'texture.json'), modelFile = path.join(directory, 'character.glb');
    fs.mkdirSync(directory, { recursive: true });
    let job;
    if (fs.existsSync(manifest)) {
        job = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        if (job.version !== 1 || job.sourceHash !== sourceHash || job.referenceHash !== referenceHash || job.sourceTaskId !== generation.taskId || JSON.stringify(job.configuration) !== JSON.stringify(configuration)) throw new Error('Output belongs to a different texture job.');
        if (job.stage === 'validated-HD-texture-for-review') {
            if (!fs.existsSync(modelFile) || hash(fs.readFileSync(modelFile)) !== job.sha256) throw new Error('Previously validated texture model is missing or changed.');
            console.log('Existing texture preserved; no task submitted.'); return;
        }
        if (!job.taskId) throw new Error('Prior submission may have reached Tripo. Check its console before another paid submission.');
        taskId(job.taskId);
    } else {
        if (fs.existsSync(modelFile)) throw new Error('Output model already exists.');
        const balance = await api.request('/account/balance');
        if (!Number.isFinite(balance.balance) || balance.balance < 30) throw new Error('At least 30 available credits are required; no texture task submitted.');
        const form = new FormData(); form.append('file', new Blob([bytes], { type: 'image/png' }), path.basename(reference));
        const uploaded = await api.request('/files', form);
        if (typeof uploaded.file_token !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(uploaded.file_token)) throw new Error('Invalid uploaded reference token.');
        job = { version: 1, sourceHash, sourceTaskId: generation.taskId, referenceHash, configuration, quotedCredits: 30, balanceBefore: balance.balance, stage: 'submitting', createdAt: new Date().toISOString() };
        save(manifest, job); // Persist BEFORE the paid POST; ambiguous responses must never trigger a retry.
        const created = await api.request('/models/texture', { input: generation.taskId, ...configuration, texture_prompt: { image: { type: 'png', file_token: uploaded.file_token } } });
        job.taskId = taskId(created.task_id); job.stage = 'submitted'; save(manifest, job);
        console.log('Created one 8K texture task:', job.taskId);
    }
    const task = await poll(api, job.taskId, { progress: state => console.log(state.status + ' ' + state.progress + '%'), ...pollOptions });
    job.stage = 'textured'; job.creditsConsumed = task.credits_consumed ?? null; save(manifest, job);
    if (typeof task.output?.model_url !== 'string') throw new Error('Texture task did not return a model URL.');
    if (fs.existsSync(modelFile)) {
        const previous = JSON.parse(fs.readFileSync(path.join(directory, 'intake.json'), 'utf8'));
        if (!previous.ok || previous.sha256 !== hash(fs.readFileSync(modelFile))) throw new Error('Existing model does not match its intake report.');
        job.bytes = previous.bytes; job.sha256 = previous.sha256;
    } else {
        const model = await downloadModel(task.output.model_url, fetchImpl), report = await inspect(model);
        save(path.join(directory, 'intake.json'), report);
        if (!report.ok) throw new Error('HD texture model failed intake; inspect intake.json.');
        fs.writeFileSync(modelFile, model, { flag: 'wx' }); job.bytes = model.length; job.sha256 = report.sha256;
    }
    if (hash(fs.readFileSync(path.join(source, 'character.glb'))) !== sourceHash) throw new Error('Source model changed during texturing.');
    job.stage = 'validated-HD-texture-for-review'; save(manifest, job);
    console.log('Saved actual HD model for appearance review:', modelFile);
    console.log('Actual credits consumed:', job.creditsConsumed);
}
module.exports = { main, configuration };
if (require.main === module) main().catch(error => {
    const secret = process.env.TRIPO_API_KEY;
    console.error(secret ? String(error.message).split(secret).join('[redacted]') : error.message); process.exitCode = 1;
});
