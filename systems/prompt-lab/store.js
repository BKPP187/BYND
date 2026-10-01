(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
    else root.ByndPromptStore = factory(root.ByndPromptEval);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
    'use strict';
    const KEY = 'bynd_prompt_lab_v1';
    const PREFIX = '\u0000BYND-LAB:';
    function experimentSettings(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('实验配置格式无效');
        if (!['builtin', 'custom'].includes(value.draftMode)) throw new Error('实验策略类型无效');
        const modelPreferences = Object.fromEntries(['experiment', 'judge', 'proposer'].map(key => {
            const id = value.modelPreferences?.[key];
            if (typeof id !== 'string' || id.length > 1024) throw new Error('实验模型选择格式无效');
            return [key, id];
        }));
        const config = value.config;
        if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('实验预算格式无效');
        const budget = Object.fromEntries(['rounds', 'repeats', 'maxCalls', 'maxMinutes', 'minGain', 'patience'].filter(key => Object.hasOwn(config, key)).map(key => [key, config[key]]));
        return { config: E.config(budget), modelPreferences, draftMode: value.draftMode };
    }
    function pack(data) {
        const strings = [], seen = new Map();
        function encode(value) {
            if (typeof value === 'string' && (value.length >= 80 || value.startsWith(PREFIX))) {
                if (!seen.has(value)) { seen.set(value, strings.length); strings.push(value); }
                return PREFIX + seen.get(value);
            }
            if (Array.isArray(value)) return value.map(encode);
            if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
            return value;
        }
        const payload = encode(data);
        return { version: 1, format: 'strings-v1', strings, payload };
    }
    function unpack(saved) {
        if (saved.format !== 'strings-v1') return saved;
        if (!Array.isArray(saved.strings) || saved.strings.some(value => typeof value !== 'string')) throw new Error('实验记录字符串表损坏');
        function decode(value) {
            if (typeof value === 'string' && value.startsWith(PREFIX)) {
                const index = value.slice(PREFIX.length);
                if (!/^\d+$/.test(index) || !Object.hasOwn(saved.strings, index)) throw new Error('实验记录引用损坏');
                return saved.strings[index];
            }
            if (Array.isArray(value)) return value.map(decode);
            if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
            return value;
        }
        return decode(saved.payload);
    }
    function create(storage, defaults) {
        const empty = () => ({ version: 1, draft: E.BASELINE, cases: E.clone(defaults), report: null, active: null, history: [] });
        function read() {
            const raw = storage.getItem(KEY);
            if (!raw) return empty();
            const data = unpack(JSON.parse(raw));
            if (data.version !== 1) throw new Error('Prompt Lab 数据版本不兼容');
            E.candidate(data.draft); E.suite(data.cases);
            return data;
        }
        function write(data) {
            E.candidate(data.draft); E.suite(data.cases);
            // One atomic setItem: on failure, the previously saved revision survives.
            storage.setItem(KEY, JSON.stringify(pack(data)));
            return data;
        }
        function update(fn) { const data = read(); fn(data); return write(data); }
        function saveDraft(value, mode = 'custom') {
            if (!['builtin', 'custom'].includes(mode)) throw new Error('无效策略类型');
            const draft = E.candidate(value);
            return update(data => { data.draft = draft; data.draftMode = mode; });
        }
        function eligible(report, runtime) {
            if (report?.status !== 'complete' || report.eligible !== true || report.identity !== E.fingerprint({ version: E.VERSION, cases: E.suite(read().cases), limits: E.config(report.config), initial: E.candidate(report.initial), runtime })) return false;
            const before = report.rows.filter(r => r.split === 'test' && r.candidateId === E.fingerprint(report.initial));
            const after = report.rows.filter(r => r.split === 'test' && r.candidateId === E.fingerprint(report.best));
            const allBest = E.summarize(report.rows.filter(r => r.candidateId === E.fingerprint(report.best)));
            return !allBest.errors && !allBest.hardFailures && E.comparison(before, after, report.config.minGain).accept;
        }
        function activate(runtime) {
            return update(data => {
                if (!eligible(data.report, runtime)) throw new Error('需要本机完整评测、留出集提升且无分类退步才能启用');
                const next = { policy: E.candidate(data.report.best), model: runtime.target, preset: runtime.preset, reportId: data.report.id, at: Date.now() };
                data.history = [...data.history, data.active].slice(-10);
                data.active = next;
            });
        }
        function rollback() { return update(data => { if (!data.history.length) throw new Error('没有可回滚版本'); data.active = data.history.pop(); }); }
        function disable() { return update(data => { data.history = [...data.history, data.active].slice(-10); data.active = null; }); }
        function exportData(settings) {
            const data = read();
            if (settings !== undefined) data.experimentSettings = experimentSettings(settings);
            return JSON.stringify(data, null, 2);
        }
        function importData(text) {
            if (typeof text !== 'string' || text.length > 10000000) throw new Error('导入文件超过 10 MB');
            const imported = JSON.parse(text);
            const cases = E.suite(imported.cases), draft = E.candidate(imported.draft);
            const settings = imported.experimentSettings === undefined ? null : experimentSettings(imported.experimentSettings);
            return update(data => { data.cases = cases; data.draft = draft; data.draftMode = settings?.draftMode || 'custom'; data.experimentSettings = settings; data.report = null; });
        }
        return { read, write, update, saveDraft, activate, rollback, disable, exportData, importData, eligible };
    }
    return Object.freeze({ KEY, create });
});
