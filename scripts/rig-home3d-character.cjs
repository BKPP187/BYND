'use strict';
// One resumable check + rig job. No automatic replacement paid requests.
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const { client, poll, taskId, downloadModel } = require('./generate-home3d-character.cjs');
const { inspect } = require('./check-home3d-character-model.cjs');
async function main(args = process.argv.slice(2), { apiKey = process.env.TRIPO_API_KEY, fetchImpl = fetch, pollOptions = {} } = {}) {
    if (args.length !== 2) throw Error('Usage: rig-home3d-character.cjs <reviewed-static.glb> <new-output-directory>');
    const input = path.resolve(args[0]), output = path.resolve(args[1]), bytes = fs.readFileSync(input), hash = b => createHash('sha256').update(b).digest('hex');
    const inputHash = hash(bytes), api = client(apiKey, fetchImpl), manifest = path.join(output, 'rigging.json');
    const sourceReport = await inspect(bytes); if (!sourceReport.ok || sourceReport.model.skins) throw Error('Expected validated static model.');
    fs.mkdirSync(output, { recursive: true });
    let job = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest)) : null;
    if (job && (job.version !== 1 || job.inputHash !== inputHash)) throw Error('Rig input changed; previous job preserved.');
    const save = () => { const temp = manifest + '.tmp'; fs.writeFileSync(temp, JSON.stringify(job, null, 2)); fs.renameSync(temp, manifest); };
    const modelFile = path.join(output, 'character.glb');
    if (job?.stage === 'validated-rig') { if (hash(fs.readFileSync(modelFile)) !== job.sha256) throw Error('Rig output changed.'); console.log('Existing validated rig; no paid request.'); return; }
    if (!job) {
        const form = new FormData(); form.append('file', new Blob([bytes], { type: 'model/gltf-binary' }), 'character.glb');
        const upload = await api.request('/files', form); if (typeof upload.file_token !== 'string' || !upload.file_token) throw Error('Model upload rejected.');
        job = { version: 1, inputHash, fileToken: upload.file_token, stage: 'submitting-check' }; save();
        job.checkTaskId = taskId((await api.request('/animations/rig-check', { input: job.fileToken })).task_id); job.stage = 'checking'; save();
    }
    if (!job.checkTaskId) throw Error('Check submission ambiguous; inspect console before retrying.');
    if (!job.rigTaskId) {
        if (job.stage === 'submitting-rig') throw Error('Rig submission ambiguous; inspect console instead of creating another paid job.');
        const check = await poll(api, job.checkTaskId, pollOptions);
        if (check.output?.riggable !== true || check.output.rig_type !== 'biped') { job.stage = 'not-riggable'; save(); throw Error('Model did not pass biped compatibility check; no paid rig submitted.'); }
        job.stage = 'submitting-rig'; save();
        job.rigTaskId = taskId((await api.request('/animations/rig', { input: job.fileToken, model: 'v1.0-20240301', rig_type: 'biped', spec: 'mixamo', out_format: 'glb' })).task_id); job.stage = 'rigging'; save();
        console.log('Submitted one rig:', job.rigTaskId);
    }
    const task = await poll(api, job.rigTaskId, pollOptions); job.creditsConsumed = task.credits_consumed; job.stage = 'generated'; save();
    if (!task.output?.model_url) throw Error('Rig has no model output.');
    const rig = fs.existsSync(modelFile) ? fs.readFileSync(modelFile) : await downloadModel(task.output.model_url, fetchImpl), report = await inspect(rig, { requireRig: true });
    if (!report.ok || !report.model.skins || !report.model.joints) throw Error('Rig GLB failed skeleton validation; source retained.');
    if (!fs.existsSync(modelFile)) fs.writeFileSync(modelFile, rig, { flag: 'wx' });
    fs.writeFileSync(path.join(output, 'intake.json'), JSON.stringify(report, null, 2));
    job.stage = 'validated-rig'; job.sha256 = hash(rig); job.bytes = rig.length; save();
    console.log('Validated rig:', JSON.stringify({ bytes: rig.length, joints: report.model.joints, creditsConsumed: job.creditsConsumed }));
}
module.exports = { main };
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
