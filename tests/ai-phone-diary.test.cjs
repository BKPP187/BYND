const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { sourceSection, clone } = require('./helpers/harness.cjs');

function harness() {
    const context = vm.createContext({ cleanWechatVisibleContent: value => String(value || '') });
    vm.runInContext(sourceSection('wechat.js', 'function cleanWechatJsonCandidate(', 'function isWechatAiStatusSnapshotComplete('), context);
    vm.runInContext(sourceSection('wechat.js', 'function stripWechatPromptText(', 'function formatWechatSnapshotTime('), context);
    vm.runInContext(sourceSection('wechat.js', 'function cleanWechatAiPhoneBlockText(', 'function normalizeWechatAiPhoneMemoList('), context);
    vm.runInContext(sourceSection('wechat.js', 'function isWechatAiPhoneDiaryPlaceholder(', 'function renderWechatAiPhoneDiaryMailbox('), context);
    return context;
}

const body = '你上次说“等有空就去河边走走”，我一直记在心里。今天路过那间茶馆，看到窗边正好空着一张桌子，便想起了这个约定。店员说最近暂无新茶，不过旧茶也很好，我们可以慢慢挑。\n我已经把这周的工作排好了，不急着催你确定时间。等手头的事都处理完，就带上读到一半的书来坐一会儿。到时候沿着河岸散步，天色晚了再找家小店吃饭，怎样都好。';
const letter = (extra = {}) => ({
    title: '河边散步', subtitle: '关于“有空”的约定', meta: '九月的窗边',
    salutation: '小林：', greeting: '今天过得好吗？', body,
    closing: '祝你', wish: '一切顺利！', signature: '陈安', date: '2026年9月9日', ...extra
});
const pair = () => [letter(), letter({ title: '沿河晚风', body: body.replace('那间茶馆', '街角书店') })];

test('valid JSON preserves Chinese quotation marks and does not salvage only the title', () => {
    const h = harness();
    const raw = { diaryLetters: pair() };
    const parsed = h.parseWechatJsonObject(JSON.stringify(raw));
    assert.deepEqual(clone(parsed), raw);
    assert.equal(h.getWechatAiPhoneDiaryLetters(parsed).length, 2);
    assert.equal(h.getWechatAiPhoneDiaryLetters(parsed)[0].body, body);
});

test('fenced and prefixed JSON preserves punctuation, escapes, apostrophes and literal delimiters', () => {
    const h = harness();
    const raw = { title: '中文“引号”和‘单引号’', body: '他说："A,} B,] C"；it\'s fine。路径 C:\\notes\\letter。', list: [1, 2] };
    const fence = String.fromCharCode(96).repeat(3);
    for (const text of [JSON.stringify(raw), '说明：\n' + JSON.stringify(raw) + '\n完毕', fence + 'json\n' + JSON.stringify(raw) + '\n' + fence]) {
        assert.deepEqual(clone(h.parseWechatJsonObject(text)), raw);
    }
    assert.deepEqual(clone(h.parseWechatJsonObject('{“title”:“河边散步”,“list”:[1,2,],}')), { title: '河边散步', list: [1, 2] });
    assert.deepEqual(clone(h.parseWechatJsonObject("{title:'河边散步', list:[1,2,],}")), { title: '河边散步', list: [1, 2] });
    assert.deepEqual(clone(h.parseWechatJsonObject('{ // user\'s notes\n"title":"河边“散步”", /* a \' comment */ "list":[1,2,],}')), { title: '河边“散步”', list: [1, 2] });
});

test('complete letter content survives absent envelope decoration and ordinary words', () => {
    const h = harness();
    const raw = letter();
    delete raw.title;
    delete raw.subtitle;
    delete raw.meta;
    const result = h.normalizeWechatAiPhoneDiaryLetterList([raw]);
    assert.equal(result.length, 1);
    assert.equal(result[0].body, body, 'the ordinary word 暂无 is not a placeholder');
    assert.ok(result[0].title);
    assert.equal(h.normalizeWechatAiPhoneDiaryLetterList([letter({ title: '未寄出的信', subtitle: 'For 小林', meta: 'PRIVATE' })]).length, 1);
});

test('character-specific pronouns and a shorter complete body are not mechanical failures', () => {
    const h = harness();
    const prose = '见字如晤。今日案牍已毕，曾沿城南行过一程，桥边桂树开得正好。想着卿前日提及的旧书，便托掌柜另留一册。\n待府中诸事安定，某愿与卿同往，不必催问归期。若途中遇雨，仍可借檐听水，闲谈近日所见，亦是一桩乐事。';
    assert.ok(prose.replace(/\s/g, '').length < 120);
    const result = h.normalizeWechatAiPhoneDiaryLetterList([letter({ body: prose })]);
    assert.equal(result.length, 1);
    assert.equal(result[0].body, prose);
});

test('combined sign-offs and common field/date variants preserve generated content', () => {
    const h = harness();
    const raw = {
        '标题': '河边散步', '称谓': '小林', '问候语': '今天过得好吗?',
        '正文': body.split('\n').map(text => ({ text })),
        '祝颂语': '祝你一切顺利！', '落款': '陈安', '日期': '2026-09-09T14:00:00+08:00'
    };
    const result = h.normalizeWechatAiPhoneDiaryLetterList([raw]);
    assert.equal(result.length, 1);
    assert.equal(result[0].body, body);
    assert.equal(result[0].closing + result[0].wish, '祝你一切顺利！');
    assert.equal(result[0].signature, '陈安');
    assert.equal(result[0].date, '2026年9月9日');
});

test('diary extraction handles nested and encoded containers, keyed letters and root objects', () => {
    const h = harness();
    const rows = pair();
    for (const raw of [
        rows, JSON.stringify({ diaryLetters: rows }), JSON.stringify(JSON.stringify({ letters: rows })),
        { data: { result: { diary_letters: rows } } },
        { phoneData: JSON.stringify({ mailbox: { letters: rows } }) },
        { diaryLetters: { letter1: rows[0], letter2: rows[1] } },
        { diaryLetters: [], data: { letters: rows } },
        { letters: rows, diaryLetters: rows }
    ]) {
        assert.equal(h.getWechatAiPhoneDiaryLetters(raw).length, 2, JSON.stringify(raw));
    }
    assert.equal(h.getWechatAiPhoneDiaryLetters(rows[0]).length, 1);
});

test('unrelated phone records, duplicates and cyclic containers are not counted as letters', () => {
    const h = harness();
    assert.equal(h.getWechatAiPhoneDiaryLetters({ chats: pair(), memos: pair(), diary: '今天去河边散步。' }).length, 0);
    assert.equal(h.getWechatAiPhoneDiaryLetters({ letters: [letter(), letter({ title: '另一标题' })] }).length, 1);
    const cyclic = { diaryLetters: [] };
    cyclic.data = cyclic;
    assert.equal(h.getWechatAiPhoneDiaryLetters(cyclic).length, 0);
});

test('missing letter content is rejected with a specific reason while valid letters remain readable', () => {
    const h = harness();
    const report = {};
    const rows = h.getWechatAiPhoneDiaryLetters({ diaryLetters: [letter(), letter({ signature: '', body: '待补充' })] }, report);
    assert.equal(rows.length, 1);
    assert.equal(report.candidateCount, 2);
    assert.match(report.issues.join('；'), /署名/);
    assert.match(report.issues.join('；'), /正文/);
    for (const extra of [{ body: '我想你了。' }, { date: '2026-02-30' }, { signature: '未填写' }]) {
        assert.equal(h.normalizeWechatAiPhoneDiaryLetterList([letter(extra)]).length, 0);
    }
});
