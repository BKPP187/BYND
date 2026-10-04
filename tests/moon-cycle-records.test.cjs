const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { memoryStorage } = require('./helpers/harness.cjs');
function setup() {
    const storage = memoryStorage();
    const window = { ByndLifeState: { localDate: now => new Date(now).toISOString().slice(0, 10) }, crypto: require('node:crypto').webcrypto };
    vm.runInNewContext(fs.readFileSync('apps/moon/moon.js', 'utf8'), { window, localStorage: storage, Date, Math, document: { addEventListener() {} } });
    return { moon: window.ByndMoon, storage };
}
test('cycle summaries count inclusive actual days, average completed intervals and leave missing ends unknown', () => {
    const { moon } = setup();
    moon.saveRecord({ start: '2025-01-01', end: '2025-01-05' });
    moon.saveRecord({ start: '2025-01-29', end: '2025-02-03' });
    moon.saveRecord({ start: '2025-02-28' });
    const stats = moon.statistics();
    assert.equal(stats.averageCycle, 29); assert.equal(stats.averagePeriod, 5.5);
    assert.equal(stats.change, 2); assert.equal(stats.cycleSamples, 2); assert.equal(stats.periodSamples, 2);
    assert.equal(stats.rows[1].periodDays, 6); assert.equal(stats.rows[2].periodDays, null); assert.equal(stats.rows[2].cycleDays, null);
    assert.equal(moon.forecast().phase, 'unknown');
});
test('editing the start date replaces the original atomically and preserves the reminder identity', () => {
    const { moon, storage } = setup();
    const first = moon.saveRecord({ start: '2025-01-01', end: '2025-01-05' });
    moon.saveRecord({ start: '2025-01-29', end: '2025-02-02' });
    const edited = moon.saveRecord({ originalStart: '2025-01-01', start: '2024-12-31', end: '2025-01-04' });
    assert.equal(edited.reminderId, first.reminderId); assert.equal(moon.read().records.length, 2);
    const before = storage.getItem(moon.storageKey);
    assert.throws(() => moon.saveRecord({ originalStart: '2024-12-31', start: '2025-01-30', end: '2025-02-01' }), /重叠/);
    assert.equal(storage.getItem(moon.storageKey), before);
});
test('same-day and leap-day ranges count correctly, future, reversed and overlapping ranges never write', () => {
    const { moon, storage } = setup();
    moon.saveRecord({ start: '2024-02-28', end: '2024-03-01' });
    moon.saveRecord({ start: '2024-03-20', end: '2024-03-20' });
    assert.equal(moon.statistics().rows[0].periodDays, 3); assert.equal(moon.statistics().rows[1].periodDays, 1);
    const before = storage.getItem(moon.storageKey);
    for (const record of [{ start: '2024-02-29' }, { start: '2024-03-21', end: '2024-03-20' }, { start: '2099-01-01' }, { start: '2025-02-29' }]) assert.throws(() => moon.saveRecord(record));
    assert.equal(storage.getItem(moon.storageKey), before);
});
test('statistics use the last six observed samples and storage failures preserve saved records', () => {
    const { moon, storage } = setup();
    const starts = ['2024-01-01','2024-02-01','2024-03-01','2024-04-01','2024-05-01','2024-06-01','2024-07-01','2024-08-01'];
    starts.forEach(start => moon.saveRecord({ start, end: start }));
    assert.equal(moon.statistics().cycleSamples, 6); assert.equal(moon.statistics().periodSamples, 6);
    const before = storage.getItem(moon.storageKey);
    storage.setItem = () => { throw new Error('quota exceeded'); };
    assert.throws(() => moon.saveRecord({ originalStart: starts[0], start: '2023-12-31' }), /quota/);
    assert.equal(storage.getItem(moon.storageKey), before);
});

test('configured period duration extends across months without inventing an actual end or affecting observed averages', () => {
    const { moon } = setup();
    assert.equal(moon.usualPeriodDays(), null);
    moon.settings({ periodLength: 5 });
    const entry = moon.saveRecord({ start: '2026-09-28' });
    assert.equal(entry.end, null); assert.equal(entry.expectedDays, 5);
    assert.equal(moon.statistics().averagePeriod, null);
    moon.settings({ periodLength: 7 });
    assert.equal(moon.read().records[0].expectedDays, 5);
    moon.saveRecord({ originalStart: entry.start, start: entry.start, end: '2026-10-02' });
    assert.equal(moon.statistics().averagePeriod, 5);
    assert.equal(moon.read().records[0].expectedDays, null);
    moon.settings({ periodLength: null });
    assert.equal(moon.usualPeriodDays(), 5);
});

test('invalid duration and failed preference writes preserve previous saved settings', () => {
    const { moon, storage } = setup();
    moon.settings({ periodLength: 5 });
    const before = storage.getItem(moon.storageKey);
    for (const periodLength of [0, 31, -1, 2.5, '5', NaN]) assert.throws(() => moon.settings({ periodLength }));
    assert.equal(storage.getItem(moon.storageKey), before);
    storage.setItem = () => { throw new Error('quota'); };
    assert.throws(() => moon.settings({ periodLength: 7 }), /quota/);
    assert.equal(storage.getItem(moon.storageKey), before);
});
