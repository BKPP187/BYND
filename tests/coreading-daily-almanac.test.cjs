const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
    let now = new Date(2026, 9, 17, 12).getTime();
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
    const saved = new Map();
    const context = vm.createContext({ Date: Clock, console, AbortController, setTimeout, clearTimeout,
        window: {}, renderCoReadDaily() {},
        localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) },
        fetch: async () => { throw new Error('offline'); },
        DOMParser: class { parseFromString() { return {
            querySelector: () => ({ textContent: '大事记' }),
            querySelectorAll: () => ['2000年：历史事件甲的说明。', '1900年：历史事件乙的说明。', '1800年：历史事件丙的说明。', '2027年：未来事件不能出现。'].map(textContent => ({textContent, querySelector: () => null, querySelectorAll: () => []}))
        }; } }
    });
    const lunar = fs.readFileSync('core/api/chat-api.js', 'utf8');
    vm.runInContext(lunar.slice(lunar.indexOf('function getChatApiLunarDateParts('), lunar.indexOf('function getChatApiFestivalName(')), context);
    for (const file of ['reading-journal', 'daily-almanac', 'daily-literature']) vm.runInContext(fs.readFileSync(`apps/coreading/${file}.js`, 'utf8'), context);
    return { context, almanac: context.window.CoReadAlmanac, saved, setDate: date => { now = date.getTime(); } };
}
const response = (day = '10月17日') => ({ok: true, json: async () => ({code: 200, data: [`2000年${day} 历史事件甲的说明。`, `1900年${day} 历史事件乙的说明。`, `1800年${day} 历史事件丙的说明。`, `2027年${day} 未来事件不能出现。`]})});

test('daily title prioritizes actual festivals, then solar terms, then lunar days', () => {
    const { almanac } = setup();
    for (const [month, day, title] of [[2,14,'情人节'],[6,19,'端午'],[10,1,'国庆'],[10,8,'寒露'],[10,23,'霜降'],[10,17,'初八'],[2,25,'初九'],[10,18,'重阳'],[2,16,'除夕'],[2,17,'春节']]) {
        assert.equal(almanac.model(new Date(2026, month - 1, day)).title, title);
    }
    assert.match(almanac.model(new Date(2026,9,17)).subtitle, /九月初八/);
    assert.equal(almanac.model(new Date(2026,9,17)).kind, 'lunar');
    assert.equal(almanac.model(new Date(2026,9,23)).kind, 'term');
    assert.equal(almanac.model(new Date(2026,9,1)).kind, 'festival');
    for (const [day, text] of [[1,'初一'],[9,'初九'],[10,'初十'],[11,'十一'],[19,'十九'],[20,'二十'],[21,'廿一'],[29,'廿九'],[30,'三十'],[0,''],[31,'']]) assert.equal(almanac.lunarDay(day), text);
});

test('all 24 solar terms are present each year, including leap years and adjacent-year boundaries', () => {
    const { almanac } = setup();
    for (let year = 2020; year <= 2040; year++) {
        const terms = [];
        for (let day = new Date(year,0,1); day.getFullYear() === year; day.setDate(day.getDate() + 1)) {
            const term = almanac.solarTerm(day); if (term) terms.push(term);
        }
        assert.equal(new Set(terms).size, 24, String(year));
        assert.equal(terms[0], '小寒'); assert.equal(terms.at(-1), '冬至');
    }
    assert.equal(almanac.solarTerm(new Date(2024,3,4)), '清明');
    assert.equal(almanac.solarTerm(new Date(2026,3,5)), '清明');
    assert.equal(almanac.solarTerm(new Date(2026,9,9)), '');
});

test('history requests are deduplicated, cached per day and reject mismatched dates', async () => {
    const { almanac, context, setDate } = setup(); let calls = 0;
    context.fetch = async () => { calls++; return response(); };
    await Promise.all([almanac.refreshHistory(), almanac.refreshHistory()]);
    assert.equal(calls, 1); assert.equal(almanac.history().events.length, 3);
    assert.ok(almanac.history().events.every(event => event.year !== '2027'));
    await almanac.refreshHistory(); assert.equal(calls, 1);
    setDate(new Date(2026,9,18,12)); assert.equal(almanac.history(), null);
    assert.equal(await almanac.refreshHistory(), null); assert.match(almanac.historyStatus, /重试/);
});

test('history failures do not loop on rerenders, can retry, and report quota failures', async () => {
    const { almanac, context, saved } = setup(); let calls = 0;
    context.fetch = async () => { calls++; throw new Error('offline'); };
    await almanac.refreshHistory();
    almanac.history();
    assert.equal(calls, 3); assert.equal(almanac.history(), null); assert.match(almanac.historyStatus, /重试/);
    context.fetch = async () => response();
    context.localStorage.setItem = () => { throw new Error('quota'); };
    await almanac.refreshHistory(true);
    assert.equal(almanac.history().events.length, 3); assert.match(almanac.historyStatus, /未能缓存/);
    assert.equal(saved.has(almanac.historyKey), false);
});

test('midnight discards an old history response and never shows yesterday as today', async () => {
    const { almanac, context, setDate, saved } = setup(); let resolve;
    context.fetch = () => new Promise(done => { resolve = done; });
    const pending = almanac.refreshHistory();
    setDate(new Date(2026,9,18,0,1)); resolve(response());
    assert.equal(await pending, null); assert.equal(almanac.history(), null);
    assert.equal(almanac.historyStatus, ''); assert.equal(saved.has(almanac.historyKey), false);
});

test('unverified or offline out-of-range solar terms fall back to lunar dates', async () => {
    const { almanac, context, setDate } = setup();
    setDate(new Date(2041,9,8,12)); await almanac.refreshTerms();
    assert.equal(almanac.solarTerm(new Date(2041,9,8)), '');
    assert.equal(almanac.model().kind, 'lunar');
    context.getChatApiLunarDateParts = () => ({month: 5, day: 5, isLeap: true});
    assert.equal(almanac.model().title, '初五');
});

test('XXAPI validates business success, exact month/day, duplicates, unsafe text and all returned events', () => {
    const {almanac} = setup(), date = new Date(2026,9,17);
    const rows = Array.from({length: 15}, (_,i) => `${2000-i}年10月17日 第${i+1}件历史事件的摘要。`);
    const events = almanac.parseXXHistory({code:200, data:[...rows, rows[0], '1990年10月17日 <img onerror=alert(1)>', 'not an event']}, date);
    assert.equal(events.length, 15);
    assert.equal(events[0].year, '2000');
    assert.throws(() => almanac.parseXXHistory({code:500, data:rows}, date), /失败/);
    assert.throws(() => almanac.parseXXHistory({code:200, data:['1990年10月16日 错误日期的事件。']}, date), /日期/);
    assert.throws(() => almanac.parseXXHistory({code:200, data:[]}, date), /暂无/);
});

test('HTTP success with an API error falls back to a dated source instead of caching success', async () => {
    const {almanac, context} = setup(); const calls = [];
    context.fetch = async url => {
        calls.push(url);
        if (url.includes('xxapi.cn')) return {ok:true,json:async()=>({code:500,msg:'error'})};
        if (url.includes('historiqly.com')) throw new Error('offline');
        return {ok:true,json:async()=>({parse:{title:'10月17日',text:{'*':'<h2>大事记</h2>'}}})};
    };
    const result = await almanac.refreshHistory();
    assert.equal(result.provider, '维基百科');
    assert.equal(calls.length, 3); assert.equal(almanac.historyStatus, '');
});
