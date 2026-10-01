'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function invoke(args, baseUrl) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['scripts/prompt-lab.cjs', ...args], { cwd: root, env: { ...process.env,
            BYND_EVAL_BASE_URL: baseUrl, BYND_EVAL_MODEL: 'mock', BYND_EVAL_API_KEY: 'cli-test-key',
            BYND_EVAL_JUDGE_BASE_URL: baseUrl, BYND_EVAL_JUDGE_MODEL: 'mock-judge', BYND_EVAL_JUDGE_API_KEY: 'cli-test-key',
            BYND_EVAL_PROPOSER_BASE_URL: baseUrl, BYND_EVAL_PROPOSER_MODEL: 'mock-proposer', BYND_EVAL_PROPOSER_API_KEY: 'cli-test-key' } });
        let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
        child.on('error', reject); child.on('close', code => resolve({ code, output }));
    });
}
test('CLI live HTTP mock completes, persists JSONL, resumes without new calls and stops on HTTP failure', async () => {
    let calls = 0, fail = false;
    const server = http.createServer(async (request, response) => {
        calls++;
        const chunks = []; for await (const chunk of request) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        response.setHeader('Content-Type', 'application/json');
        if (fail) { response.statusCode = 429; response.end('{}'); return; }
        let content;
        const system = body.messages[0].content;
        if (system.includes('独立评审')) {
            const sample = JSON.parse(body.messages[1].content);
            content = JSON.stringify({ pass: sample.output === 'good', reason: 'mock grade', evidence: sample.output === 'good' ? '' : 'wrong' });
        } else if (system.includes('BYND Prompt 优化器')) {
            const sample = JSON.parse(body.messages[1].content);
            assert.ok(sample.failures.every(row => row.input.startsWith('dev')));
            content = JSON.stringify({ scope: sample.scope, text: '保持角色', hypothesis: 'mock hypothesis' });
        } else content = body.messages.some(m => m.content.includes('Prompt Lab 行为补充')) ? '<thinking>private</thinking>good' : 'wrong';
        response.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 25, completion_tokens: 5, total_tokens: 30 } }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = 'http://127.0.0.1:' + server.address().port + '/v1';
    const directory = path.join(root, 'artifacts/prompt-lab/runs', 'cli-mock-' + Date.now());
    fs.mkdirSync(directory, { recursive: true });
    const casesFile = path.join(directory, 'cases.json'), reportFile = path.join(directory, 'report.json');
    const cases = ['dev', 'validation', 'test'].flatMap(split => [0, 1, 2].map(index => ({ id: split + index, split, category: 'ooc', lane: 'chat', character: { id: 'lin', name: '林间', description: '管理员' }, input: split + index, rubric: '保持角色' })));
    fs.writeFileSync(casesFile, JSON.stringify(cases));
    try {
        const first = await invoke(['--run', '--cases', casesFile, '--rounds', '1', '--max-calls', '100', '--out', reportFile], baseUrl);
        assert.equal(first.code, 0, first.output);
        const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        assert.equal(report.status, 'complete'); assert.equal(report.eligible, true); assert.equal(report.calls, 73);
        assert.equal(calls, 73);
        assert.ok(report.rows.every(row => !row.trace.content.includes('<thinking>')));
        assert.ok(report.rows.some(row => row.judge.usage.total_tokens === 30));
        assert.equal(fs.readFileSync(reportFile, 'utf8').includes('cli-test-key'), false);
        assert.equal(fs.readFileSync(path.join(directory, 'report.results.jsonl'), 'utf8').trim().split('\n').length, report.rows.length);
        const resumed = await invoke(['--resume', reportFile, '--cases', casesFile], baseUrl);
        assert.equal(resumed.code, 0, resumed.output); assert.equal(calls, 73);
        fail = true;
        const failedFile = path.join(directory, 'failure.json');
        const failed = await invoke(['--run', '--cases', casesFile, '--rounds', '1', '--max-calls', '100', '--out', failedFile], baseUrl);
        assert.equal(failed.code, 2, failed.output);
        const failure = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
        assert.equal(failure.eligible, false); assert.match(failure.rows[0].error, /HTTP 429/);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
