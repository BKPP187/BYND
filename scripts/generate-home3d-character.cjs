'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { inspect } = require('./check-home3d-character-model.cjs');
const BASE = 'https://openapi.tripo3d.ai/v3';

function client(apiKey, fetchImpl = fetch) {
    if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('Set TRIPO_API_KEY in the current process; do not put it in a project file.');
    async function request(route, body) {
        const readOnly = route === '/account/balance' || /^\/tasks\/[A-Za-z0-9_-]+$/.test(route);
        if (!['/files', '/generation/image-to-model', '/models/texture', '/animations/rig-check', '/animations/rig'].includes(route) && !readOnly) throw new Error('Unsupported Tripo endpoint.');
        if (readOnly && body !== undefined) throw new Error('This Tripo endpoint is read-only.');
        const multipart = body instanceof FormData;
        const response = await fetchImpl(BASE + route, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { Authorization: 'Bearer ' + apiKey.trim(), Accept: 'application/json', ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}) },
            body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
            signal: AbortSignal.timeout(90000), redirect: 'error'
        });
        if (!response.ok) throw new Error('Tripo HTTP ' + response.status + '; no paid request will be automatically retried.');
        let result;
        try { result = await response.json(); } catch (_) { throw new Error('Tripo returned invalid JSON.'); }
        if (result?.code !== 0 || !result.data || typeof result.data !== 'object') throw new Error('Tripo rejected the request; inspect its developer console for the task or credit error.');
        return result.data;
    }
    return { request };
}

function taskId(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(value)) throw new Error('Tripo did not return a valid task ID.');
    return value;
}

async function poll(api, id, { wait = ms => new Promise(resolve => setTimeout(resolve, ms)), progress = () => {}, attempts = 120 } = {}) {
    taskId(id);
    for (let i = 0; i < attempts; i++) {
        const task = await api.request('/tasks/' + id);
        if (task.task_id !== id) throw new Error('Tripo returned a different task ID.');
        if (task.status === 'success') return task;
        if (['failed', 'cancelled'].includes(task.status)) throw new Error('Model task ' + task.status + '; no replacement task was created.');
        if (!['queued', 'running', 'waiting'].includes(task.status)) throw new Error('Unknown Tripo task status.');
        progress({ status: task.status, progress: Number.isFinite(task.progress) ? task.progress : 0 });
        if (i + 1 < attempts) await wait(5000);
    }
    throw new Error('Polling limit reached. Run the same command to resume the saved task without submitting another generation.');
}

async function downloadModel(url, fetchImpl = fetch) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Invalid model download URL.');
    // Signed CDN downloads must never receive the account credential.
    const response = await fetchImpl(target.href, { signal: AbortSignal.timeout(90000), redirect: 'follow' });
    if (!response.ok) throw new Error('Model download failed (HTTP ' + response.status + '). Resume the task to refresh its link.');
    const limit = 100 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > limit) throw new Error('Model exceeds the 100 MB intake limit.');
    const chunks = []; let length = 0;
    for await (const chunk of response.body) {
        length += chunk.length;
        if (length > limit) throw new Error('Model exceeds the 100 MB intake limit.');
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

function saveJson(file, data) {
    const temporary = file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
}

async function main(args = process.argv.slice(2), { apiKey = process.env.TRIPO_API_KEY, fetchImpl = fetch, pollOptions = {} } = {}) {
    if (args.length !== 2) throw new Error('Usage: node scripts/generate-home3d-character.cjs <reference.png> <output-directory>');
    const api = client(apiKey, fetchImpl);
    const image = path.resolve(args[0]), directory = path.resolve(args[1]);
    if (!/\.(png|jpe?g)$/i.test(image)) throw new Error('Use a single-character PNG or JPEG reference.');
    const bytes = fs.readFileSync(image);
    if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('Reference must be between 1 byte and 20 MB.');
    const hash = createHash('sha256').update(bytes).digest('hex');
    fs.mkdirSync(directory, { recursive: true });
    const manifest = path.join(directory, 'generation.json'), modelFile = path.join(directory, 'character.glb');
    let job;
    if (fs.existsSync(manifest)) {
        job = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        if (job.version !== 1 || job.referenceHash !== hash) throw new Error('Output directory belongs to a different reference or job version.');
        if (job.stage === 'validated-static-model') {
            if (!fs.existsSync(modelFile) || createHash('sha256').update(fs.readFileSync(modelFile)).digest('hex') !== job.sha256) throw new Error('Previously validated model is missing or changed.');
            console.log('Existing model preserved; no generation was submitted.'); return;
        }
        if (!job.taskId) throw new Error('Prior submission may have reached Tripo. Check its console; use another directory only after confirming that no task was created.');
    } else {
        if (fs.existsSync(modelFile)) throw new Error('Output model already exists and will not be overwritten.');
        const form = new FormData();
        form.append('file', new Blob([bytes], { type: /\.png$/i.test(image) ? 'image/png' : 'image/jpeg' }), path.basename(image));
        const upload = await api.request('/files', form);
        if (typeof upload.file_token !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(upload.file_token)) throw new Error('Upload did not return a valid file token.');
        job = { version: 1, referenceHash: hash, model: 'v3.1-20260211', stage: 'submitting', createdAt: new Date().toISOString() };
        saveJson(manifest, job);
        const created = await api.request('/generation/image-to-model', { input: upload.file_token, model: job.model, texture: true, pbr: true });
        job.taskId = taskId(created.task_id); job.stage = 'submitted'; saveJson(manifest, job);
        console.log('Created one model task:', job.taskId);
    }
    const task = await poll(api, job.taskId, { progress: state => console.log(state.status + ' ' + state.progress + '%'), ...pollOptions });
    job.stage = 'generated'; job.creditsConsumed = task.credits_consumed ?? null; saveJson(manifest, job);
    if (typeof task.output?.model_url !== 'string') throw new Error('Successful task did not include a model URL.');
    if (fs.existsSync(modelFile)) {
        const previous = JSON.parse(fs.readFileSync(path.join(directory, 'intake.json'), 'utf8'));
        if (!previous.ok || previous.sha256 !== createHash('sha256').update(fs.readFileSync(modelFile)).digest('hex')) throw new Error('Existing model does not match its validated intake report.');
        job.stage = 'validated-static-model'; job.bytes = previous.bytes; job.sha256 = previous.sha256; saveJson(manifest, job);
        console.log('Recovered previously validated model without replacing it.'); return;
    }
    const modelBytes = await downloadModel(task.output.model_url, fetchImpl);
    const report = await inspect(modelBytes);
    saveJson(path.join(directory, 'intake.json'), report);
    if (!report.ok) throw new Error('Generated file failed 3D model intake; inspect intake.json.');
    fs.writeFileSync(modelFile, modelBytes, { flag: 'wx' });
    job.stage = 'validated-static-model'; job.bytes = modelBytes.length; job.sha256 = report.sha256; saveJson(manifest, job);
    console.log('Downloaded and validated:', modelFile);
    console.log('Static model requires appearance review, rigging and room integration.');
}
module.exports = { client, taskId, poll, downloadModel, main };
if (require.main === module) main().catch(error => {
    const secret = process.env.TRIPO_API_KEY;
    console.error(secret ? String(error.message).split(secret).join('[redacted]') : error.message);
    process.exitCode = 1;
});
