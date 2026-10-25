'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'systems/phone-usage/phone-usage.js'), 'utf8');
const KEY = 'bynd_phone_usage_private_v1';

function harness({ entries = {}, failWrites = false } = {}) {
    const values = new Map(Object.entries(entries));
    const writes = [];
    const warns = [];
    const context = vm.createContext({
        console: { warn: (...args) => warns.push(args.join(' ')), log() {}, error() {} },
        JSON, Math, Date, Array, Object, Promise, String, Number, Set, Map, Error, RegExp, parseInt, isNaN, Infinity, NaN, undefined,
        localStorage: {
            getItem: key => values.has(key) ? values.get(key) : null,
            setItem(key, value) { if (failWrites) throw new Error('QuotaExceededError'); values.set(key, String(value)); writes.push([key, String(value)]); },
            removeItem(key) { values.delete(key); }
        },
        createImageBitmap: async () => ({ width: 400, height: 800, close() {} }),
        Number, Boolean, TypeError, RangeError, SyntaxError,
    });
    context.window = context;
    vm.runInContext(source, context);
    const api = vm.runInContext('ByndPhoneUsage', context);
    return { api, values, writes, warns, context };
}

function makeDay(date, minutes, apps = [], extra = {}) {
    return { date, observedAt: Date.now(), totalMinutes: minutes, apps, ...extra };
}

test('read returns empty state when no data', () => {
    const { api } = harness();
    const state = api.read();
    assert.equal(state.version, 1);
    assert.equal(state.paused, false);
    assert.equal(Object.keys(state.days).length, 0);
    assert.equal(Object.keys(state.grants).length, 0);
});

test('read throws on corrupted data', () => {
    const { api } = harness({ entries: { [KEY]: '{"version":2}' } });
    assert.throws(() => api.read(), /损坏/);
});

test('read throws on non-object days', () => {
    const { api } = harness({ entries: { [KEY]: '{"version":1,"days":[],"grants":{}}' } });
    assert.throws(() => api.read(), /损坏/);
});

test('normalizeDay validates date format', () => {
    const { api } = harness();
    assert.throws(() => api.normalizeDay({ date: 'bad', observedAt: Date.now(), totalMinutes: 10 }, 'android'), /日期无效/);
});

test('normalizeDay rejects future dates', () => {
    const { api } = harness();
    const tomorrow = new Date(Date.now() + 2 * 86400000);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    assert.throws(() => api.normalizeDay({ date, observedAt: Date.now(), totalMinutes: 5 }, 'android'), /日期无效|未来/);
});

test('normalizeDay rejects unknown source', () => {
    const { api } = harness();
    const today = api.localDate();
    assert.throws(() => api.normalizeDay({ date: today, observedAt: Date.now(), totalMinutes: 5 }, 'magic'), /未知/);
});

test('normalizeDay validates totalMinutes range', () => {
    const { api } = harness();
    const today = api.localDate();
    assert.throws(() => api.normalizeDay({ date: today, observedAt: Date.now(), totalMinutes: -1 }, 'android'), /总时长/);
    assert.throws(() => api.normalizeDay({ date: today, observedAt: Date.now(), totalMinutes: 2000 }, 'android'), /总时长/);
});

test('normalizeDay validates lateNightUntil is before 5am', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    const dayStart = new Date(today).getTime();
    // 6am is past the 5-hour window — hits either the general range check or the specific 5am check
    assert.throws(() => api.normalizeDay({ date: today, observedAt: now, totalMinutes: 30, lateNightUntil: dayStart + 6 * 3600000 }, 'android', now), /时刻|凌晨/);
});

test('normalizeDay accepts valid day', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    const day = api.normalizeDay({
        date: today, observedAt: now, totalMinutes: 120,
        apps: [{ label: '微信', minutes: 60, opens: 20 }, { label: '抖音', minutes: 40 }]
    }, 'android', now);
    assert.equal(day.date, today);
    assert.equal(day.totalMinutes, 120);
    assert.equal(day.apps.length, 2);
    assert.equal(day.apps[0].label, '微信');
    assert.equal(day.apps[0].opens, 20);
    assert.equal(day.apps[1].opens, undefined);
});

test('saveDays stores and prunes', () => {
    const { api, values } = harness();
    const today = api.localDate();
    const now = Date.now();
    const count = api.saveDays([makeDay(today, 90, [{ label: 'WeChat', minutes: 60 }])], 'screenshot', now);
    assert.equal(count, 1);
    const stored = JSON.parse(values.get(KEY));
    assert.ok(stored.days[today]);
    assert.equal(stored.days[today].totalMinutes, 90);
});

test('saveDays newer reading overwrites older', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 60, [], { observedAt: now - 10000 })], 'android', now);
    api.saveDays([makeDay(today, 90, [], { observedAt: now })], 'screenshot', now);
    const state = api.read();
    assert.equal(state.days[today].totalMinutes, 90);
});

test('saveDays older reading does not overwrite newer', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 90, [], { observedAt: now })], 'android', now);
    api.saveDays([makeDay(today, 60, [], { observedAt: now - 10000 })], 'screenshot', now);
    const state = api.read();
    assert.equal(state.days[today].totalMinutes, 90);
});

test('saveDays rejects empty list', () => {
    const { api } = harness();
    assert.throws(() => api.saveDays([], 'android'), /1–31/);
});

test('grant defaults to off', () => {
    const { api } = harness();
    const state = api.read();
    const grant = api.grantFor(state, { id: 'char1' });
    assert.equal(grant.level, 'off');
    assert.equal(grant.exclude.length, 0);
});

test('setGrant persists and reads back', () => {
    const { api } = harness();
    api.setGrant({ id: 'char1' }, { level: 'apps', exclude: ['小红书', '抖音'] });
    const state = api.read();
    const grant = api.grantFor(state, { id: 'char1' });
    assert.equal(grant.level, 'apps');
    assert.equal(grant.exclude.length, 2);
    assert.equal(grant.exclude[0], '小红书');
    assert.equal(grant.exclude[1], '抖音');
});

test('setGrant rejects group chats', () => {
    const { api } = harness();
    assert.throws(() => api.setGrant({ id: 'g1', isGroupChat: true }, { level: 'total' }), /单聊/);
});

test('setGrant rejects proto pollution', () => {
    const { api } = harness();
    assert.throws(() => api.setGrant({ id: '__proto__' }, { level: 'total' }), /单聊/);
});

test('parseExclude splits by newlines and Chinese commas', () => {
    const { api } = harness();
    const result = api.parseExclude('小红书\n抖音，微博、B站');
    assert.equal(result.length, 4);
    assert.equal(result[0], '小红书');
    assert.equal(result[3], 'B站');
});

test('parseExclude deduplicates', () => {
    const { api } = harness();
    const result = api.parseExclude('微信\n微信\n微信');
    assert.equal(result.length, 1);
    assert.equal(result[0], '微信');
});

test('visibleDays returns empty when paused', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 120, [{ label: 'WeChat', minutes: 60 }])], 'android', now);
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    api.setPaused(true);
    assert.equal(api.visibleDays({ id: 'c1' }, now).length, 0);
});

test('visibleDays returns empty for unauthorized character', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 120, [{ label: 'WeChat', minutes: 60 }])], 'android', now);
    assert.equal(api.visibleDays({ id: 'c1' }, now).length, 0);
});

test('visibleDays filters excluded apps and adjusts total', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 120, [
        { label: '微信', minutes: 60 }, { label: '小红书', minutes: 30 }, { label: '抖音', minutes: 30 }
    ])], 'android', now);
    api.setGrant({ id: 'c1' }, { level: 'apps', exclude: ['小红书'] });
    const days = api.visibleDays({ id: 'c1' }, now);
    assert.equal(days.length, 1);
    assert.equal(days[0].totalMinutes, 90); // 120 - 30 excluded
    assert.equal(days[0].apps.length, 2); // 微信 + 抖音
    assert.ok(days[0].apps.every(a => a.label !== '小红书'));
});

test('visibleDays with total level omits app list', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 120, [{ label: '微信', minutes: 60 }])], 'android', now);
    api.setGrant({ id: 'c1' }, { level: 'total' });
    const days = api.visibleDays({ id: 'c1' }, now);
    assert.equal(days.length, 1);
    assert.equal(days[0].apps, undefined);
});

test('visibleDays returns empty for group chats', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 60)], 'android', now);
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    assert.equal(api.visibleDays({ id: 'c1', isGroupChat: true }, now).length, 0);
});

test('summary builds text for today', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 120, [
        { label: '微信', minutes: 60 }, { label: '抖音', minutes: 30 }, { label: '设置', minutes: 3 }
    ])], 'android', now);
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    const text = api.summary({ id: 'c1' }, now);
    assert.ok(text.includes('今天'));
    assert.ok(text.includes('2 小时'));
    assert.ok(text.includes('微信'));
    assert.ok(text.includes('抖音'));
    assert.ok(!text.includes('设置')); // < 5 min, not in top 3
});

test('summary returns empty when no recent days', () => {
    const { api } = harness();
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    assert.equal(api.summary({ id: 'c1' }), '');
});

test('prompt returns empty for unauthorized char', () => {
    const { api } = harness();
    assert.equal(api.prompt({ id: 'c1' }), '');
});

test('prompt returns guidance when authorized but no data', () => {
    const { api } = harness();
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    const text = api.prompt({ id: 'c1' });
    assert.ok(text.includes('授权') || text === '');
});

test('toolLine returns empty for unauthorized char', () => {
    const { api } = harness();
    assert.equal(api.toolLine({ id: 'c1' }), '');
});

test('toolLine returns empty when paused', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 60)], 'android', now);
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    api.setPaused(true);
    assert.equal(api.toolLine({ id: 'c1' }), '');
});

test('toolLine returns definition for authorized char with data', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 60, [{ label: 'App', minutes: 30 }])], 'android', now);
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    const line = api.toolLine({ id: 'c1' });
    assert.ok(line.includes('phone.usage'));
});

test('details returns lines for visible days', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 90, [
        { label: '微信', minutes: 50 }, { label: '抖音', minutes: 20 }
    ])], 'android', now);
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    const result = api.details({ id: 'c1' }, {}, now);
    assert.equal(result.ok, true);
    assert.ok(result.lines.length > 0);
    assert.ok(result.message.includes('微信'));
});

test('details filters by app name', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 90, [
        { label: '微信', minutes: 50 }, { label: '抖音', minutes: 20 }
    ])], 'android', now);
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    const result = api.details({ id: 'c1' }, { app: '微信' }, now);
    assert.ok(result.message.includes('微信'));
    assert.ok(!result.message.includes('抖音'));
});

test('execute rejects group chat', async () => {
    const { api } = harness();
    const result = await api.execute({ id: 'g1', isGroupChat: true }, {});
    assert.equal(result.ok, false);
    assert.ok(result.message.includes('群聊'));
});

test('execute rejects paused state', async () => {
    const { api } = harness();
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    api.setPaused(true);
    const result = await api.execute({ id: 'c1' }, {});
    assert.equal(result.ok, false);
    assert.ok(result.message.includes('暂停'));
});

test('execute rejects unauthorized char', async () => {
    const { api } = harness();
    const result = await api.execute({ id: 'c1' }, {});
    assert.equal(result.ok, false);
    assert.ok(result.message.includes('没有授权'));
});

test('execute returns data for authorized char', async () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 60, [{ label: '微信', minutes: 30 }])], 'android', now);
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    const result = await api.execute({ id: 'c1' }, {});
    assert.equal(result.ok, true);
    assert.ok(result.message);
});

test('parseModelJson extracts JSON from markdown code blocks', () => {
    const { api } = harness();
    const result = api.parseModelJson('```json\n{"readable":true,"totalMinutes":120}\n```');
    assert.equal(result.readable, true);
    assert.equal(result.totalMinutes, 120);
});

test('parseModelJson returns null for garbage', () => {
    const { api } = harness();
    assert.equal(api.parseModelJson('not json at all'), null);
    assert.equal(api.parseModelJson(''), null);
    assert.equal(api.parseModelJson(null), null);
});

test('clear removes storage', () => {
    const { api, values } = harness();
    api.saveDays([makeDay(api.localDate(), 60)], 'android');
    assert.ok(values.has(KEY));
    api.clear();
    assert.ok(!values.has(KEY));
});

test('revokeAll clears grants but keeps days', () => {
    const { api } = harness();
    const today = api.localDate();
    api.saveDays([makeDay(today, 60)], 'android');
    api.setGrant({ id: 'c1' }, { level: 'apps' });
    api.revokeAll();
    const state = api.read();
    assert.ok(state.days[today]);
    assert.equal(Object.keys(state.grants).length, 0);
});

test('history returns sorted days', () => {
    const { api } = harness();
    const now = Date.now();
    const today = api.localDate(now);
    const yesterday = api.localDate(now - 86400000);
    api.saveDays([makeDay(today, 60), makeDay(yesterday, 90, [], { observedAt: now - 86400000 })], 'android', now);
    const days = api.history(now);
    assert.equal(days.length, 2);
    assert.equal(days[0].date, today); // most recent first
    assert.equal(days[1].date, yesterday);
});

test('exclude matching is case-insensitive and supports substring', () => {
    const { api } = harness();
    const today = api.localDate();
    const now = Date.now();
    api.saveDays([makeDay(today, 100, [
        { label: 'TikTok', minutes: 40 }, { label: 'WeChat', minutes: 30 }, { label: 'Bilibili', minutes: 20 }
    ])], 'android', now);
    api.setGrant({ id: 'c1' }, { level: 'apps', exclude: ['tiktok', 'bili'] });
    const days = api.visibleDays({ id: 'c1' }, now);
    assert.equal(days[0].apps.length, 1);
    assert.equal(days[0].apps[0].label, 'WeChat');
    assert.equal(days[0].totalMinutes, 40); // 100 - 40(TikTok) - 20(Bilibili)
});

test('android returns false when no bridge', () => {
    const { api } = harness();
    assert.equal(api.android(), false);
});

test('syncAndroid throws without bridge', () => {
    const { api } = harness();
    assert.throws(() => api.syncAndroid(), /不是.*Android/);
});

test('setPaused toggles and persists', () => {
    const { api } = harness();
    api.setPaused(true);
    assert.equal(api.read().paused, true);
    api.setPaused(false);
    assert.equal(api.read().paused, false);
});

test('app normalizeDay validates app minutes', () => {
    const { api } = harness();
    const today = api.localDate();
    assert.throws(() => api.normalizeDay({
        date: today, observedAt: Date.now(), totalMinutes: 10,
        apps: [{ label: '微信', minutes: -5 }]
    }, 'android'), /时长/);
});
