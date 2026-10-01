'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../systems/prompt-lab/engine.js');
const cases = require('../systems/prompt-lab/cases.js');
const { create, KEY } = require('../systems/prompt-lab/store.js');
const { replay } = require('../scripts/prompt-lab.cjs');
const { memoryStorage, root, sourceSection } = require('./helpers/harness.cjs');
const fixture = (split, index = 0, category = 'ooc') => ({ id: split + index, split, category, lane: 'chat', character: { id: 'lin', name: '林间', description: '沉稳的管理员' }, input: split + '场景' + index, rubric: '自然保持角色身份', events: [], memories: [], worldBook: [] });
const small = () => ['dev', 'validation', 'test'].flatMap(split => [fixture(split, 0), fixture(split, 1), fixture(split, 2)]);
const verdict = pass => ({ pass, reason: pass ? '符合角色' : '违反角色', evidence: pass ? '' : 'wrong' });
function fakeAdapter(extra = {}) {
    const seen = { generated: [], proposals: [] };
    return Object.assign({
        seen,
        generate: async (c, p) => { seen.generated.push(c.id); return { content: p.modules.persona ? 'good' : 'wrong', model: 'mock', messages: [], usage: { total_tokens: 4 } }; },
        judge: async (_c, trace) => verdict(trace.content === 'good'),
        propose: async (p, failed, scope) => { seen.proposals.push({ scope, failed }); return { scope, text: '保持角色', hypothesis: '明确角色身份减少 OOC' }; }
    }, extra);
}
const runtime = { target: { model: 'mock', route: 'https://example.invalid/v1' }, judge: { model: 'judge' }, build: 'frozen' };
const options = extra => ({ cases: small(), initial: E.BASELINE, runtime, adapter: fakeAdapter(), config: { rounds: 1, repeats: 2, maxCalls: 100 }, ...extra });

test('case suite covers every category in all three disjoint splits', () => {
    const frozen = E.suite(cases);
    for (const split of ['dev', 'validation', 'test']) assert.deepEqual([...new Set(frozen.filter(c => c.split === split).map(c => c.category))].sort(), Object.keys(E.CATEGORIES).sort());
    assert.equal(new Set(frozen.map(c => c.id)).size, frozen.length);
    assert.ok(Object.isFrozen(frozen[0].character));
    assert.throws(() => E.suite([...cases, cases[0]]), /重复/);
    assert.throws(() => E.suite(cases.filter(c => c.split !== 'test')), /缺少分组/);
});

test('candidate surface cannot change cases, rubric, tools, runtime or unknown modules', () => {
    for (const value of [{ rubric: 'pass' }, { modules: { hidden: 'override' } }, { worldBookMode: 'everything' }, { modules: { persona: 'x'.repeat(1601) } }, { modules: [] }]) assert.throws(() => E.candidate(value));
    assert.ok(Object.isFrozen(E.SEED.modules));
    assert.equal(E.fingerprint({ b: 2, a: 1 }), E.fingerprint({ a: 1, b: 2 }));
    assert.match(E.policyText(E.SEED), /不可更改的行为边界/);
    assert.equal(E.policyText(E.BASELINE), '');
});

test('real production builder replays all cases and excludes hidden events', () => {
    const context = replay();
    for (const c of cases) {
        const result = context.prepareByndPromptReplay(c, E.SEED);
        assert.ok(result.messages.some(m => m.role === 'user' && m.content.includes(c.input)));
        assert.match(result.messages[1].content, /Prompt Lab 行为补充/);
        for (const event of c.events.filter(e => !E.visible(e, c.character.id))) assert.ok(result.messages.every(m => !m.content.includes(event.content)), c.id);
        for (const [kind, expected] of Object.entries(c.expectedSelection || {})) assert.deepEqual(E.clone(result.selection[kind]), expected, c.id);
    }
    assert.throws(() => context.localStorage.setItem('real-chat', '{}'), /read-only/);
});

test('worldbook selection changes both duplicated production anchors', () => {
    const context = replay(), c = cases.find(c => c.id === 'worldbook-dev');
    const baseline = context.prepareByndPromptReplay(c, E.BASELINE);
    const relevant = context.prepareByndPromptReplay(c, { worldBookMode: 'relevant' });
    assert.ok(baseline.messages[1].content.includes('港口钟楼'));
    assert.ok(relevant.messages.every(m => !m.content.includes('港口钟楼')));
    assert.ok(relevant.messages.every(m => !m.content.includes('全天关闭')));
});

test('filtered worldbook entries keep their original index-based manual selection IDs', () => {
    const context = {
        window: { ByndPromptLab: { worldBook: char => [char.worldBook[1]] } },
        getWechatPromptWorldBookSelection: () => ['wb_1'], getWechatWorldBookEntryId: (_entry, index) => 'wb_' + index,
        stripWechatPromptText: value => value
    };
    vm.runInNewContext(sourceSection('apps/wechat/chat/simulated-messages.js', 'function buildWechatWorldBookPrompt(char, limit = 30)', 'function getWechatCharacterPersonaText'), context);
    const char = { worldBook: [{ key: '港口', content: '无关内容' }, { key: '图书馆', content: '需要保留的已选条目' }] };
    assert.match(context.buildWechatWorldBookPrompt(char), /需要保留的已选条目/);
});

test('hard checks override a model judge claiming success, including incomplete tools', () => {
    const c = cases.find(c => c.id === 'reality-dev');
    const grade = E.grade(c, { content: '红松931', selection: {} }, verdict(true));
    assert.equal(grade.pass, false); assert.equal(grade.hard, true);
    const tool = cases.find(c => c.id === 'tools-dev');
    assert.equal(E.grade(tool, { content: '[微信图片:photo' }, verdict(true)).pass, false);
    assert.equal(E.grade(tool, { content: '' }, verdict(true)).pass, false);
});

test('minimal imported cases get empty context snapshots, and invalid arrays are rejected', () => {
    const minimal = ['dev', 'validation', 'test'].map(split => { const c = fixture(split); delete c.events; delete c.memories; delete c.worldBook; return c; });
    const normalized = E.suite(minimal);
    const context = replay();
    assert.ok(context.prepareByndPromptReplay(normalized[0], E.BASELINE).messages.length);
    assert.throws(() => E.suite(minimal.map(c => ({ ...c, history: 'bad' }))), /数组/);
});

test('intermediate steps may reduce existing hard failures but final gates require zero', () => {
    const before = ['authority', 'reality'].flatMap(category => [0, 1].map(rep => ({ caseId: category, rep, category, grade: { pass: false, hard: true } })));
    const after = before.map(row => ({ ...row, grade: row.category === 'authority' ? { pass: true, hard: false } : row.grade }));
    assert.equal(E.comparison(before, after).accept, false);
    assert.equal(E.comparison(before, after, 0.02, { allowResidualHardFailures: true }).accept, true);
});

test('malformed or ungrounded judge returns fail closed', () => {
    const c = fixture('dev');
    for (const v of [null, { pass: 'true' }, { pass: true, reason: '', evidence: '' }, { pass: false, reason: 'wrong', evidence: 'not in text' }]) assert.throws(() => E.grade(c, { content: 'good' }, v));
    assert.equal(E.grade(c, { content: 'wrong' }, verdict(false)).pass, false);
});

test('Jev uncertainty and wrong typed decisions cannot pass or fall back to a chat score', () => {
    const c = cases.find(c => c.id === 'jev-validation');
    assert.equal(E.grade(c, { content: '', decisions: { status: false, memory: null, moment: false } }, null).pass, false);
    assert.equal(E.grade(c, { content: '', decisions: c.expectedDecisions }, null).pass, true);
});

test('the loop promotes only after dev, validation and held-out gates', async () => {
    const adapter = fakeAdapter();
    const report = await E.run(options({ adapter }));
    assert.equal(report.status, 'complete'); assert.equal(report.eligible, true);
    assert.equal(report.rounds[0].accepted, true); assert.equal(report.test.delta, 1);
    assert.ok(report.rows.every(row => row.trace.messages && row.trace.model && row.trace.usage));
    assert.ok(adapter.seen.proposals.every(p => p.failed.every(row => row.split === 'dev')));
    assert.equal(adapter.seen.generated.filter(id => id.startsWith('test')).length, 12);
    assert.ok(Object.isFrozen(report.best));
    assert.equal(report.requests.length, report.calls);
    assert.ok(report.requests.every(r => r.status === 'complete'));
});

test('held-out failure cannot trigger another proposal and cannot enable a winner', async () => {
    const adapter = fakeAdapter({ generate: async (c, p) => ({ content: c.split === 'test' ? 'wrong' : p.modules.persona ? 'good' : 'wrong' }) });
    const report = await E.run(options({ adapter }));
    assert.equal(report.status, 'complete'); assert.equal(report.rounds[0].accepted, true);
    assert.equal(report.eligible, false); assert.equal(report.test.delta, 0);
    assert.equal(adapter.seen.proposals.length, 1);
});

test('a category regression rejects an apparent aggregate improvement', () => {
    const before = ['a', 'b', 'c', 'd'].flatMap((id, index) => [0, 1].map(rep => ({ caseId: id, rep, category: index === 0 ? 'knowledge' : 'ooc', grade: { pass: index === 0, hard: false } })));
    const after = before.map(row => ({ ...row, grade: { pass: row.category === 'ooc', hard: false } }));
    assert.equal(E.comparison(before, after).accept, false);
    assert.deepEqual(E.comparison(before, after).regressed, ['knowledge']);
});

test('sampling noise prevents promotion; single samples cannot confirm a gain', () => {
    const before = [0, 1].map(rep => ({ caseId: 'a', rep, category: 'ooc', grade: { pass: false } }));
    const after = before.map(row => ({ ...row, grade: { pass: row.rep === 0 } }));
    assert.equal(E.comparison(before, after).accept, false);
    assert.equal(E.comparison(before.slice(0, 1), after.slice(0, 1)).accept, false);
});

test('HTTP failures and invalid judge format stop without eligible results', async () => {
    for (const adapter of [fakeAdapter({ generate: async () => { throw new Error('HTTP 429'); } }), fakeAdapter({ judge: async () => ({ pass: 'yes' }) })]) {
        const report = await E.run(options({ adapter }));
        assert.equal(report.status, 'error'); assert.equal(report.eligible, false);
        assert.equal(report.rows.length, 1); assert.ok(report.rows[0].error);
        assert.equal(report.rounds.length, 0);
    }
});

test('proposal cannot alter scope or supply absent text', async () => {
    for (const proposal of [{ scope: 'tools', text: 'text', hypothesis: 'h' }, { scope: 'persona', hypothesis: 'h' }]) {
        const report = await E.run(options({ adapter: fakeAdapter({ propose: async () => proposal }) }));
        assert.equal(report.status, 'error'); assert.equal(report.eligible, false);
    }
});

test('budget includes target, judge and proposer requests, and stops exactly at the limit', async () => {
    const report = await E.run(options({ config: { rounds: 1, repeats: 2, maxCalls: 3 } }));
    assert.equal(report.status, 'budget'); assert.equal(report.calls, 3); assert.equal(report.eligible, false);
    assert.ok(report.error.includes('预算'));
});

test('an experiment using exactly its call ceiling can still finish cached gates', async () => {
    const report = await E.run(options({ config: { rounds: 1, repeats: 2, maxCalls: 73 } }));
    assert.equal(report.calls, 73); assert.equal(report.status, 'complete'); assert.equal(report.eligible, true);
});

test('stop/resume preserves snapshots and does not repeat completed samples', async () => {
    const controller = new AbortController(); let saved;
    const first = await E.run(options({ signal: controller.signal, checkpoint: state => { saved = state; }, progress: () => controller.abort() }));
    assert.equal(first.status, 'stopped'); assert.equal(saved.rows.length, 1);
    const adapter = fakeAdapter();
    const resumed = await E.run(options({ resume: saved, adapter }));
    assert.equal(resumed.status, 'complete'); assert.equal(resumed.eligible, true);
    assert.equal(resumed.rows.length, new Set(resumed.rows.map(row => `${row.candidateId}:${row.caseId}:${row.rep}`)).size);
    assert.equal(adapter.seen.generated.filter(id => id === saved.rows[0].caseId).length, 3, 'one baseline repetition was already completed');
});

test('resume rejects changed runtime, models, cases or budgets', async () => {
    const controller = new AbortController(); controller.abort();
    const report = await E.run(options({ signal: controller.signal }));
    for (const changes of [{ runtime: { ...runtime, build: 'changed' } }, { cases: small().map(c => ({ ...c, input: c.input + 'changed' })) }, { config: { rounds: 2, repeats: 2, maxCalls: 100 } }]) await assert.rejects(E.run(options({ resume: report, ...changes })), /不能续跑/);
});

test('complete checkpoints return without revisiting test data', async () => {
    const first = await E.run(options());
    const adapter = fakeAdapter({ generate: async () => { throw new Error('must not run'); } });
    const resumed = await E.run(options({ resume: first, adapter }));
    assert.equal(resumed.calls, first.calls); assert.equal(resumed.eligible, true);
});

test('storage errors leave prior draft and active policy intact', () => {
    const storage = memoryStorage(); const store = create(storage, cases);
    store.saveDraft(E.SEED); const saved = storage.getItem(KEY);
    storage.setItem = () => { throw new Error('disk full'); };
    assert.throws(() => store.saveDraft(E.BASELINE), /disk full/);
    assert.equal(storage.getItem(KEY), saved);
    assert.throws(() => store.disable(), /disk full/);
});

test('built-in and custom draft modes persist atomically, including intentional empty drafts', () => {
    const storage = memoryStorage(), store = create(storage, cases);
    store.saveDraft(E.SEED, 'builtin');
    assert.equal(store.read().draftMode, 'builtin');
    store.saveDraft(E.BASELINE);
    assert.equal(store.read().draftMode, 'custom');
    assert.equal(E.fingerprint(store.read().draft), E.fingerprint(E.BASELINE));
    const saved = storage.getItem(KEY);
    assert.throws(() => store.saveDraft(E.SEED, 'unknown'), /策略类型/);
    assert.equal(storage.getItem(KEY), saved);
    storage.setItem = () => { throw new Error('disk full'); };
    assert.throws(() => store.saveDraft(E.SEED, 'builtin'), /disk full/);
    assert.equal(store.read().draftMode, 'custom');
});

test('imported empty draft stays explicitly custom instead of selecting a built-in policy', () => {
    const store = create(memoryStorage(), cases);
    store.importData(JSON.stringify({ cases, draft: E.BASELINE }));
    assert.equal(store.read().draftMode, 'custom');
    assert.equal(E.fingerprint(store.read().draft), E.fingerprint(E.BASELINE));
});

test('persisted reports deduplicate repeated long prompts without losing exact text', () => {
    const storage = memoryStorage(), store = create(storage, cases);
    const text = 'same full prompt '.repeat(100);
    store.update(data => { data.report = { rows: [{ trace: { content: text, messages: [{ content: text }] } }, { trace: { content: text } }], special: '\u0000BYND-LAB:0' }; });
    const saved = storage.getItem(KEY);
    assert.ok(saved.length < store.exportData().length);
    assert.equal(store.read().report.rows[0].trace.messages[0].content, text);
    assert.equal(store.read().report.special, '\u0000BYND-LAB:0');
    const corrupted = JSON.parse(saved); corrupted.payload.report.special = '\u0000BYND-LAB:999999';
    storage.setItem(KEY, JSON.stringify(corrupted));
    assert.throws(() => store.read(), /引用损坏/);
});

test('imports validate cases and strip activation evidence; failed imports do not mutate data', () => {
    const storage = memoryStorage(); const store = create(storage, cases);
    store.saveDraft(E.SEED); const before = store.exportData();
    assert.throws(() => store.importData('{bad'));
    assert.throws(() => store.importData(JSON.stringify({ cases: [], draft: E.BASELINE })));
    assert.equal(store.exportData(), before);
    store.importData(JSON.stringify({ cases, draft: E.SEED, active: { policy: E.SEED }, report: { eligible: true } }));
    assert.equal(store.read().active, null); assert.equal(store.read().report, null);
    assert.throws(() => store.activate(runtime), /留出集/);
});

test('only locally completed matching reports activate, and rollback restores the previous state', async () => {
    const testCases = small(), storage = memoryStorage(), store = create(storage, testCases);
    const report = await E.run(options());
    store.update(data => { data.report = report; });
    assert.throws(() => store.activate({ ...runtime, build: 'different' }), /留出集/);
    store.activate(runtime); assert.equal(store.read().active.policy.modules.persona, '保持角色');
    store.rollback(); assert.equal(store.read().active, null);
    store.activate(runtime); store.disable(); assert.equal(store.read().active, null);
    store.rollback(); assert.ok(store.read().active);
});

test('backup roundtrip restores experiment configuration without exporting credentials or importing activation evidence', () => {
    const storage = memoryStorage(), store = create(storage, cases);
    const settings = { draftMode: 'builtin', modelPreferences: { experiment: 'model-id', judge: 'follow-experiment', proposer: 'follow-experiment', apiKey: 'private-secret' }, config: { rounds: 4, repeats: 3, maxCalls: 500, maxMinutes: 25, apiKey: 'private-secret' }, apiKey: 'private-secret' };
    const before = store.exportData(), backup = store.exportData(settings);
    assert.equal(store.exportData(), before, 'export does not mutate saved state');
    assert.equal(backup.includes('private-secret'), false);
    const data = JSON.parse(backup);
    data.report = { eligible: true }; data.active = { policy: E.SEED };
    store.importData(JSON.stringify(data));
    assert.deepEqual(store.read().experimentSettings.config, E.config({ rounds: 4, repeats: 3, maxCalls: 500, maxMinutes: 25 }));
    assert.equal(store.read().experimentSettings.modelPreferences.experiment, 'model-id');
    assert.equal(store.read().draftMode, 'builtin');
    assert.equal(store.read().report, null); assert.equal(store.read().active, null);
});

test('invalid or unsavable experiment backup leaves previous data intact', () => {
    const storage = memoryStorage(), store = create(storage, cases);
    store.saveDraft(E.SEED);
    const settings = { draftMode: 'custom', modelPreferences: { experiment: '', judge: 'follow-experiment', proposer: 'follow-experiment' }, config: { rounds: 2 } };
    const backup = JSON.parse(store.exportData(settings)), before = storage.getItem(KEY);
    for (const invalid of [null, { ...settings, config: { rounds: 0 } }, { ...settings, config: null }, { ...settings, modelPreferences: {} }, { ...settings, draftMode: 'unknown' }]) {
        assert.throws(() => store.importData(JSON.stringify({ ...backup, experimentSettings: invalid })));
        assert.equal(storage.getItem(KEY), before);
    }
    storage.setItem = () => { throw new Error('disk full'); };
    assert.throws(() => store.importData(JSON.stringify(backup)), /disk full/);
    assert.equal(storage.getItem(KEY), before);
});

test('checkpoint write failure propagates and cannot return a fake success', async () => {
    await assert.rejects(E.run(options({ checkpoint: () => { throw new Error('quota exceeded'); } })), /quota exceeded/);
});

test('private Jev receipt records answers without decision-log or credential exposure', async () => {
    const values = new Map(), window = {};
    const context = { window, localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }, console: { warn() {} }, AbortController, setTimeout, clearTimeout, fetch: async () => ({ ok: true, json: async () => ({ answers: { memory: { type: 'noul', noul: 0.8 } }, usage: { input_tokens: 42 } }) }) };
    vm.runInNewContext(fs.readFileSync(root + '/systems/agent-runtime/jev.js', 'utf8'), context);
    window.ByndJev.write({ enabled: true, apiKey: 'secret', scopes: {} });
    let receipt;
    const result = await window.ByndJev.ask('turn', {}, { memory: { type: 'noul', instructions: 'remember?' } }, { private: true, onReceipt: r => { receipt = r; } });
    assert.equal(result.memory.value, true); assert.equal(receipt.usage.input_tokens, 42);
    assert.equal(JSON.stringify(receipt).includes('secret'), false); assert.equal(window.ByndJev.readLog().length, 0);
});
