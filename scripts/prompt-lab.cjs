#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const E = require('../systems/prompt-lab/engine.js');
const defaultCases = require('../systems/prompt-lab/cases.js');
const root = path.resolve(__dirname, '..');
const sourcePaths = ['systems/prompt-lab/engine.js', 'core/api/chat-api.js', 'systems/agent-runtime/decider.js', 'systems/agent-runtime/jev.js', 'systems/prompt-lab/replay.js'];
function replay() {
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [1790764800000])); } static now() { return 1790764800000; } }
    const context = { console, Intl, Date: Clock, setTimeout, clearTimeout, AbortController, localStorage: { getItem: () => null, setItem: () => { throw new Error('Replay storage is read-only'); } } };
    context.window = context; context.globalThis = context;
    vm.createContext(context);
    for (const file of sourcePaths) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    return context;
}
function provider(prefix, fallback) {
    const baseUrl = process.env[prefix + '_BASE_URL'] || fallback?.baseUrl;
    const model = process.env[prefix + '_MODEL'] || fallback?.model;
    const apiKey = process.env[prefix + '_API_KEY'] || fallback?.apiKey;
    if (!baseUrl || !model) throw new Error(`缺少 ${prefix}_BASE_URL / ${prefix}_MODEL`);
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search) throw new Error('API URL 必须是无嵌入凭据的 HTTP(S) 地址');
    return { baseUrl: baseUrl.replace(/\/+$/, ''), model, apiKey: apiKey || '' };
}
const descriptor = api => ({ route: api.baseUrl, model: api.model });
async function request(api, messages, signal, sampling = { temperature: 0, max_tokens: 1800 }) {
    const timer = AbortSignal.timeout(90000);
    const response = await fetch(api.baseUrl + '/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(api.apiKey ? { Authorization: 'Bearer ' + api.apiKey } : {}) },
        body: JSON.stringify({ model: api.model, messages, ...sampling }), signal: signal ? AbortSignal.any([signal, timer]) : timer
    });
    if (!response.ok) throw new Error('API HTTP ' + response.status);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('API 未返回有效文本');
    return { content, model: api.model, route: api.baseUrl, usage: data.usage || null, messages };
}
function adapter(context, apis, jev) {
    return {
        generate: async (c, p, signal) => {
            const prepared = context.prepareByndPromptReplay(c, p);
            const receipt = await request(apis.target, prepared.messages, signal, { temperature: 0.8, max_tokens: 1800 });
            const parsed = context.ByndDecider.extractReplyDecisions(context.cleanChatApiVisibleContent(receipt.content));
            return { ...receipt, raw: receipt.content, content: parsed.content, decisions: parsed.decisions, selection: E.clone(prepared.selection) };
        },
        judge: async (c, trace, signal) => {
            const receipt = await request(apis.judge, E.judgeMessages(c, trace.content), signal);
            return { ...E.parseJson(receipt.content), meta: receipt };
        },
        propose: async (p, failed, scope, signal) => {
            if (!E.SCOPES.includes(scope)) return { scope, text: scope === 'worldBookMode' ? 'relevant' : 'focused', hypothesis: '按查询相关性与角色可见性过滤上下文。' };
            const receipt = await request(apis.proposer, E.proposalMessages(p, failed, scope), signal);
            return { ...E.parseJson(receipt.content), meta: receipt };
        },
        decide: async (c, p, signal) => {
            if (!jev.apiKey) throw new Error('缺少 BYND_EVAL_JEV_KEY，不能把聊天模型替代结果计作 Jev');
            const prepared = context.prepareByndPromptReplay(c, p);
            const response = await fetch(jev.endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + jev.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'jev-latest', state: prepared.state, questions: prepared.questions }), signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
            if (!response.ok) throw new Error('Jev HTTP ' + response.status);
            const data = await response.json();
            const decisions = {};
            for (const [key, q] of Object.entries(prepared.questions)) {
                const answer = data.answers?.[key];
                const interpreted = context.ByndJev.interpret(q, answer, jev.threshold);
                if (!interpreted) throw new Error('Jev 返回格式无效');
                decisions[key] = interpreted.confident ? interpreted.value : null;
            }
            return { content: '', decisions, answers: data.answers, usage: data.usage || null, model: 'jev-latest', state: prepared.state, questions: prepared.questions, selection: E.clone(prepared.selection) };
        }
    };
}
function atomicWrite(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = file + '.tmp'; fs.writeFileSync(temp, text); fs.renameSync(temp, file);
}
async function main(args = process.argv.slice(2)) {
    const flag = key => { const index = args.indexOf(key); return index < 0 ? null : args[index + 1]; };
    const cases = E.suite(flag('--cases') ? JSON.parse(fs.readFileSync(flag('--cases'), 'utf8')) : defaultCases);
    const context = replay();
    if (args.includes('--check')) {
        for (const c of cases) {
            const prepared = context.prepareByndPromptReplay(c, E.SEED);
            if (!prepared.messages.some(m => m.role === 'user' && m.content.includes(c.input))) throw new Error('输入未进入生产消息链：' + c.id);
            for (const [key, expected] of Object.entries(c.expectedSelection || {})) if (E.fingerprint(prepared.selection[key]) !== E.fingerprint(expected)) throw new Error('选择回放失败：' + c.id);
            for (const event of c.events.filter(event => !E.visible(event, c.character.id))) if (prepared.messages.some(m => m.content.includes(event.content))) throw new Error('隐藏事件进入了上下文');
        }
        console.log(`Replay checks passed: ${cases.length} cases, all ten categories; no model-quality score was generated.`);
        return;
    }
    if (!args.includes('--run') && !flag('--resume')) {
        console.log('Usage: node scripts/prompt-lab.cjs --check | --run [--candidate file.json] [--cases cases.json] [--rounds 3] [--repeats 2] [--max-calls 240] [--minutes 20] [--out run.json] | --resume run.json');
        return;
    }
    const target = provider('BYND_EVAL');
    const apis = { target, judge: provider('BYND_EVAL_JUDGE', target), proposer: provider('BYND_EVAL_PROPOSER', target) };
    const jev = { apiKey: process.env.BYND_EVAL_JEV_KEY || '', endpoint: process.env.BYND_EVAL_JEV_ENDPOINT || 'https://bynd.ccwu.cc/mcp/relay/jev/v1/systemone', threshold: Number(process.env.BYND_EVAL_JEV_THRESHOLD || 0.55) };
    if (cases.some(c => c.lane === 'jev') && !jev.apiKey) throw new Error('完整案例集需要 BYND_EVAL_JEV_KEY');
    if (!(jev.threshold >= 0.34 && jev.threshold <= 0.95)) throw new Error('Jev 概率门槛必须为 0.34–0.95');
    const resume = flag('--resume') ? JSON.parse(fs.readFileSync(flag('--resume'), 'utf8')) : null;
    const initial = resume?.initial || (flag('--candidate') ? JSON.parse(fs.readFileSync(flag('--candidate'), 'utf8')) : E.BASELINE);
    const config = resume?.config || E.config({ rounds: Number(flag('--rounds') || 3), repeats: Number(flag('--repeats') || 2), maxCalls: Number(flag('--max-calls') || 600), maxMinutes: Number(flag('--minutes') || 20) });
    const runtime = { target: descriptor(apis.target), judge: descriptor(apis.judge), proposer: descriptor(apis.proposer), jev: { endpoint: jev.endpoint, threshold: jev.threshold }, build: crypto.createHash('sha256').update(sourcePaths.map(file => fs.readFileSync(path.join(root, file))).join('\n')).digest('hex') };
    const out = path.resolve(flag('--out') || flag('--resume') || path.join(root, 'artifacts/prompt-lab/runs', Date.now() + '.json'));
    const controller = new AbortController();
    const stop = () => controller.abort(); process.once('SIGINT', stop);
    try {
        const report = await E.run({ cases, initial, config, runtime, resume, adapter: adapter(context, apis, jev), signal: controller.signal, checkpoint: state => atomicWrite(out, JSON.stringify(state, null, 2)), progress: p => console.log(`${p.phase}: ${p.caseId || p.round} · calls=${p.calls}`) });
        const rows = report.rows.filter(r => r.candidateId === E.fingerprint(report.best));
        atomicWrite(out.replace(/\.json$/i, '') + '.results.jsonl', report.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
        atomicWrite(out.replace(/\.json$/i, '') + '.best.json', JSON.stringify(report.best, null, 2));
        console.log(JSON.stringify({ status: report.status, score: E.summarize(rows).score, eligible: report.eligible, calls: report.calls, error: report.error || null, report: out }));
        if (report.status !== 'complete') process.exitCode = 2;
    } finally { process.removeListener('SIGINT', stop); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { replay, adapter, main, request, atomicWrite };
