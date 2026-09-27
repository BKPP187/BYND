/* Device-local life summaries. Filter by consent BEFORE interpreting or building a prompt. */
(() => {
    'use strict';
    const storageKey = 'bynd_life_state_private_v1';
    const HOUR = 3600000;
    const fields = {
        sleepMinutes: { label: '睡眠时长', unit: '分钟', min: 0, max: 1440 },
        bedtime: { label: '入睡时间', time: true },
        wakeTime: { label: '起床时间', time: true },
        awakenings: { label: '夜间醒来', unit: '次', min: 0, max: 100 },
        steps: { label: '步数', unit: '步', min: 0, max: 200000 },
        exerciseMinutes: { label: '运动时长', unit: '分钟', min: 0, max: 1440 },
        energy: { label: '自述精力', choices: { low: '有些疲惫', okay: '精力一般', good: '精力不错' } },
        mood: { label: '自述心情', choices: { low: '心情低落', steady: '心情平稳', good: '心情不错' } }
    };
    const sources = { healthkit: 'Apple 健康 · 原生读取', manual: '手动记录', 'apple-health': '导入文件 · Apple 健康', 'health-connect': '导入文件 · Health Connect', import: '导入文件' };
    const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    const localDate = (now = Date.now()) => {
        const d = new Date(now);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    function read() {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return { version: 1, paused: false, sleepGoal: 480, records: [], nativeRecords: [], grants: {} };
        const state = JSON.parse(raw);
        if (state?.version !== 1 || !Array.isArray(state.records) || state.records.some(record => !record || typeof record !== 'object' || typeof record.date !== 'string' || !record.metrics || typeof record.metrics !== 'object' || Array.isArray(record.metrics)) || !state.grants || typeof state.grants !== 'object' || Array.isArray(state.grants)) throw new Error('生活状态数据损坏，请清除后重新记录');
        if (state.nativeRecords !== undefined && (!Array.isArray(state.nativeRecords) || state.nativeRecords.some(record => !record || typeof record !== 'object' || typeof record.date !== 'string' || !record.metrics || typeof record.metrics !== 'object' || Array.isArray(record.metrics)))) throw new Error('原生健康记录损坏');
        return state;
    }
    function write(state) {
        localStorage.setItem(storageKey, JSON.stringify(state));
        return state;
    }
    function timestamp(value, label, now) {
        if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) throw new Error(`${label}需要带时区的 ISO 时间`);
        const day = value.slice(0, 10);
        if (!Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) throw new Error(`${label}日期无效`);
        const at = Date.parse(value);
        if (!Number.isFinite(at) || at > now + 5 * 60000) throw new Error(`${label}无效或在未来`);
        return new Date(at).toISOString();
    }
    function normalizeRecord(record, now = Date.now()) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('生活记录格式不正确');
        const date = record.date;
        if (typeof date !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > localDate(now)) throw new Error('记录日期无效或在未来');
        if (now - Date.parse(date + 'T00:00:00Z') > 32 * 24 * HOUR) throw new Error('只接收最近 30 天的生活汇总');
        const observedAt = timestamp(record.observedAt, '汇总时间', now);
        if (Math.abs(Date.parse(observedAt) - Date.parse(date + 'T12:00:00Z')) > 40 * HOUR) throw new Error('汇总时间与记录日期不符');
        const source = own(sources, record.source) ? record.source : 'import';
        const values = {};
        if (!record.values || typeof record.values !== 'object' || Array.isArray(record.values)) throw new Error('记录缺少 values');
        for (const [key, spec] of Object.entries(fields)) {
            if (!own(record.values, key)) continue;
            const value = record.values[key];
            if (value === null || value === '') continue;
            if (spec.time) values[key] = timestamp(value, spec.label, now);
            else if (spec.choices) {
                if (!own(spec.choices, value)) throw new Error(`${spec.label}选项无效`);
                values[key] = value;
            } else {
                if (typeof value !== 'number' || !Number.isFinite(value) || value < spec.min || value > spec.max || !Number.isInteger(value)) throw new Error(`${spec.label}必须为 ${spec.min}–${spec.max} 的整数`);
                values[key] = value;
            }
            if (spec.time && Math.abs(Date.parse(values[key]) - Date.parse(date + 'T12:00:00Z')) > 40 * HOUR) throw new Error(`${spec.label}与记录日期不符`);
        }
        if (!Object.keys(values).length) throw new Error('记录中没有支持的生活指标');
        if (values.bedtime && values.wakeTime && Date.parse(values.wakeTime) <= Date.parse(values.bedtime)) throw new Error('起床时间必须晚于入睡时间');
        for (const key of ['bedtime', 'wakeTime']) if (values[key] && Date.parse(values[key]) > Date.parse(observedAt)) throw new Error(`${fields[key].label}晚于汇总时间`);
        return { date, observedAt, source, values };
    }
    function importSummary(payload, now = Date.now()) {
        if (payload?.version !== 1 || !Array.isArray(payload.records) || !payload.records.length || payload.records.length > 60) throw new Error('需要 version: 1 和 1–60 条 records；不支持直接导入 Apple 健康 XML');
        // Validate the entire file before changing ANY stored data or consent.
        const incoming = payload.records.map(record => normalizeRecord({ ...record, source: record.source === 'healthkit' ? 'apple-health' : record.source }, now));
        const state = read();
        const merged = new Map();
        for (const record of [...state.records, ...incoming]) {
            const old = merged.get(record.date);
            const metrics = { ...(old?.metrics || {}) };
            for (const [key, value] of Object.entries(record.values || {})) {
                if (!metrics[key] || !Number.isFinite(Date.parse(metrics[key].observedAt)) || Date.parse(record.observedAt) >= Date.parse(metrics[key].observedAt)) metrics[key] = { value, observedAt: record.observedAt, source: record.source };
            }
            for (const [key, metric] of Object.entries(record.metrics || {})) {
                if (!metrics[key] || Date.parse(metric.observedAt) > Date.parse(metrics[key].observedAt)) metrics[key] = metric;
            }
            merged.set(record.date, { date: record.date, metrics });
        }
        const records = [...merged.values()].filter(record => now - Date.parse(record.date + 'T00:00:00Z') <= 32 * 24 * HOUR).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
        write({ ...state, records });
        return incoming.length;
    }
    function grantFor(state, char) {
        const grant = char && !char.isGroupChat && own(state.grants, String(char.id)) ? state.grants[String(char.id)] : null;
        const levels = Object.fromEntries(Object.keys(fields).map(key => [key, ['summary', 'detail'].includes(grant?.fields?.[key]) ? grant.fields[key] : 'off']));
        return { enabled: grant?.enabled === true, maxAgeHours: [12, 24, 36].includes(grant?.maxAgeHours) ? grant.maxAgeHours : 24, fields: levels };
    }
    function setGrant(char, grant) {
        if (!char?.id || char.isGroupChat || ['__proto__', 'constructor', 'prototype'].includes(String(char.id))) throw new Error('请先选择一个单聊角色');
        const state = read();
        const next = grantFor({ grants: { [char.id]: grant } }, char);
        write({ ...state, grants: { ...state.grants, [char.id]: next } });
        return next;
    }
    function settings(patch) {
        const state = read();
        if (own(patch, 'sleepGoal') && (!Number.isInteger(patch.sleepGoal) || patch.sleepGoal < 180 || patch.sleepGoal > 900)) throw new Error('个人睡眠目标需要为 3–15 小时');
        return write({ ...state, paused: own(patch, 'paused') ? patch.paused === true : state.paused, sleepGoal: patch.sleepGoal ?? state.sleepGoal });
    }
    const fmtTime = value => new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    function explain(key, value, state, detail, source) {
        const spec = fields[key];
        if (spec.choices) return `用户自述：${spec.choices[value]}`;
        if (spec.time) {
            const hour = new Date(value).getHours();
            const period = hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚间';
            const label = source === 'healthkit' ? key === 'bedtime' ? '睡眠样本最早开始' : '睡眠样本最后结束' : spec.label;
            const caveat = source === 'healthkit' ? '；样本边界不证明实际入睡或起床时刻' : '';
            return detail ? `${label}：${fmtTime(value)}${caveat}` : `${label}在${period}；具体时刻未授权${caveat}`;
        }
        if (key === 'sleepMinutes') {
            const goal = Number.isInteger(state.sleepGoal) ? state.sleepGoal : 480;
            const summary = value < goal - 60 ? '最近一次睡眠少于个人目标，可能需要多休息' : '最近一次睡眠时长接近或达到个人目标；不能据此判断睡眠质量';
            return detail ? `睡眠 ${Math.floor(value / 60)} 小时 ${value % 60} 分钟；${summary}` : summary;
        }
        if (key === 'awakenings') return detail ? `记录到夜间醒来 ${value} 次；不等于睡眠质量或疾病判断` : value > 0 ? '记录到睡眠中途醒来；原因未知' : '这份记录未记录到中途醒来；不代表睡得很好';
        if (key === 'steps') return detail ? `这次汇总累计 ${value} 步；不代表全天活动量` : value > 0 ? '这次汇总记录到了走动；不能据此推断所在位置、心情或忙闲' : '这次汇总步数为零；可能未佩戴设备，不能推断一直未活动';
        return detail ? `这次汇总运动 ${value} 分钟；不能推断具体运动或疲劳程度` : value > 0 ? '这次汇总记录到了运动' : '这次汇总未记录到运动；不代表整天没有运动';
    }
    function visible(char, now = Date.now(), { preview = false } = {}) {
        let state;
        try { state = read(); } catch (_) { return []; } // Corruption/storage denial MUST fail closed.
        const grant = grantFor(state, char);
        if (!char || char.isGroupChat || state.paused || (!preview && !grant.enabled)) return [];
        const items = [];
        for (const key of Object.keys(fields)) {
            if (grant.fields[key] === 'off') continue;
            const candidates = [...state.records, ...(state.nativeRecords || [])].flatMap(record => {
                const metric = record.metrics?.[key];
                if (!metric || !own(sources, metric.source)) return [];
                if (metric.source === 'healthkit') {
                    try {
                        const native = window.ByndNativeHealth;
                        const connection = native?.read();
                        const type = ['sleepMinutes', 'bedtime', 'wakeTime'].includes(key) ? 'sleep' : key === 'steps' ? 'steps' : key === 'exerciseMinutes' ? 'exercise' : null;
                        if (!native?.available() || !connection?.connected || !type || !connection.types.includes(type)) return [];
                    } catch (_) { return []; }
                }
                const age = now - Date.parse(metric.observedAt);
                // Activity and feelings belong to today. Sleep can describe the previous night.
                if (!Number.isFinite(age) || age < 0 || age > grant.maxAgeHours * HOUR || (['steps', 'exerciseMinutes', 'energy', 'mood'].includes(key) && record.date !== localDate(now))) return [];
                if (now - Date.parse(record.date + 'T00:00:00Z') > 60 * HOUR) return [];
                // Revalidate persisted values: backups, devtools or an older version cannot inject text.
                try { normalizeRecord({ date: record.date, observedAt: metric.observedAt, source: metric.source, values: { [key]: metric.value } }, now); } catch (_) { return []; }
                return [{ ...metric, date: record.date }];
            }).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
            const metric = candidates[0];
            if (metric) items.push({ key, label: fields[key].label, date: metric.date, observedAt: metric.observedAt, source: sources[metric.source], text: explain(key, metric.value, state, grant.fields[key] === 'detail', metric.source) });
        }
        return items;
    }
    function prompt(char, now = Date.now()) {
        const items = visible(char, now);
        if (!items.length) return '';
        return '【用户授权的现实生活状态】以下是用户现实中的生活参考，与剧情时间分开。只知道这里列出的内容，未列出的指标未知，不得反推未授权数据。\n'
            + items.map(item => `- ${item.label}（记录日期 ${item.date}，汇总于 ${fmtTime(item.observedAt)}，${item.source}）：${item.text}`).join('\n')
            + '\n这是生活观察，不是诊断。不要把睡眠少断言为生病，不要从活动推断情绪、位置、忙闲或当前正在睡觉。遵循角色人设和世界观自然回应，不必每轮提及，不要播报指标，不要监督、责备或强制建议。【生活状态参考结束】';
    }
    function replaceNativeSummary(payload, now = Date.now()) {
        if (payload?.version !== 1 || !Array.isArray(payload.records) || payload.records.length > 60) throw new Error('原生健康汇总格式不正确');
        const records = payload.records.map(record => normalizeRecord({ ...record, source: 'healthkit' }, now));
        const nativeRecords = records.map(record => ({ date: record.date, metrics: Object.fromEntries(Object.entries(record.values).map(([key, value]) => [key, { value, observedAt: record.observedAt, source: 'healthkit' }])) }));
        return write({ ...read(), nativeRecords });
    }
    function clear() { localStorage.removeItem(storageKey); }
    function revokeAll() { const state = read(); return write({ ...state, grants: {} }); }
    window.ByndLifeState = { storageKey, fields, sources, localDate, read, importSummary, normalizeRecord, replaceNativeSummary, grantFor, setGrant, settings, visible, prompt, clear, revokeAll };
})();
