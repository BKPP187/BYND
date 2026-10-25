const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { memoryStorage } = require('./helpers/harness.cjs');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps/coreading/highlights.js'), 'utf8');
const CONTENT = '第一章\n她把书合上，窗外的雨还没有停。\n“我们明天再读吧。”他说。\n灯光落在纸页上，像一层很薄的雪。';

function harness() {
    const localStorage = memoryStorage();
    const toasts = [];
    const book = { id: 'book-1', title: '雨夜', content: CONTENT, page: 0 };
    const chars = [{ id: 'c1', name: '温今北', avatar: '' }];
    const context = vm.createContext({
        window: {}, localStorage, console: { warn() {} }, JSON, Math, Date, Promise,
        document: { addEventListener() {}, getElementById: () => null, querySelector: () => null },
        COREAD_PAGE_SIZE: 1000, COREAD_AI_REPLY_MAX_TOKENS: 300, DEFAULT_AVATAR: 'avatar',
        coreadActiveBookId: 'book-1', coreadActiveCharId: 'c1', coreadActiveTab: 'shelf',
        getCoReadBook: id => (id === book.id ? book : null),
        getCoReadCharacters: () => chars,
        getCoReadCharacterById: id => chars.find(char => char.id === id) || null,
        getCoReadCharName: char => char.name,
        musicEscapeHtml: value => String(value).replace(/[&<>"]/g, ch => `&#${ch.charCodeAt(0)};`),
        musicEscapeAttr: value => String(value).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`),
        showCoReadShelfToast: text => toasts.push(text),
        renderCoReadReaderOverview() {}, renderCoReadReader() {},
        buildCoReadCommentMessages: () => [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }],
        requestCoReadAiComment: async () => ({ ok: true, text: '这句像是在等你。' }),
        callChatApi: async () => ({ ok: false, error: 'no api' })
    });
    vm.runInContext(source, context);
    return { context, localStorage, toasts, book, chars };
}

test('highlight segments split at every edge and merge overlaps by owner', () => {
    const h = harness();
    const rows = [{ id: 'a', by: 'user', start: 2, end: 6 }, { id: 'b', by: 'char', start: 4, end: 9 }];
    const parts = h.context.splitCoReadTextByHighlights('0123456789', 0, rows).map(part => [part.text, [...part.ids].join(), [...part.owners].join()]);
    assert.deepEqual(JSON.parse(JSON.stringify(parts)), [['01', '', ''], ['23', 'a', 'user'], ['45', 'a,b', 'user,char'], ['678', 'b', 'char'], ['9', '', '']]);
    const offset = h.context.splitCoReadTextByHighlights('6789', 6, rows).map(part => part.text);
    assert.deepEqual(JSON.parse(JSON.stringify(offset)), ['678', '9'], 'segments respect the rendered stretch start offset');
});

test('user highlights persist, trim whitespace, dedupe and can be deleted', () => {
    const h = harness();
    const start = CONTENT.indexOf('窗外');
    const item = h.context.addCoReadHighlight(h.book, { by: 'user', start: start - 1, end: start + 9 });
    assert.equal(item.quote, CONTENT.slice(start - 1, start + 9));
    const padded = h.context.addCoReadHighlight(h.book, { by: 'user', start: 2, end: 4 });
    assert.equal(padded.quote, '章', 'leading and trailing whitespace is trimmed');
    h.context.deleteCoReadHighlight('book-1', padded.id);
    const again = h.context.addCoReadHighlight(h.book, { by: 'user', start: start - 1, end: start + 9 });
    assert.equal(again.id, item.id, 'same range is not duplicated');
    assert.equal(h.context.getCoReadHighlights('book-1').length, 1);
    h.context.updateCoReadHighlight('book-1', item.id, row => { row.note = '想起那天'; });
    assert.equal(h.context.getCoReadHighlights('book-1')[0].note, '想起那天');
    assert.equal(h.context.deleteCoReadHighlight('book-1', item.id).id, item.id);
    assert.equal(h.context.getCoReadHighlights('book-1').length, 0);
    assert.throws(() => h.context.addCoReadHighlight(h.book, { by: 'user', start: 3, end: 4 }), /选中/, 'whitespace-only range is rejected');
});

test('a failed write surfaces an error and never shows success', () => {
    const h = harness();
    h.context.coreadHighlightSelection = { bookId: 'book-1', start: 4, end: 10 };
    vm.runInContext('coreadHighlightSelection = { bookId: "book-1", start: 4, end: 10 };', h.context);
    h.localStorage.setItem = () => { throw new Error('quota'); };
    assert.equal(h.context.createCoReadHighlightFromSelection('mark'), null);
    assert.deepEqual(h.toasts, ['划线未保存：quota']);
    assert.equal(h.context.getCoReadHighlights('book-1').length, 0);
});

test('a corrupted highlight store is not overwritten', () => {
    const h = harness();
    h.localStorage.setItem('bynd_coread_highlights_v1', '{"version":9}');
    assert.throws(() => h.context.addCoReadHighlight(h.book, { by: 'user', start: 4, end: 10 }), /格式不正确/);
    assert.equal(h.localStorage.getItem('bynd_coread_highlights_v1'), '{"version":9}');
});

test('char highlights land on the quoted sentence of the current page only', async () => {
    const h = harness();
    h.context.callChatApi = async () => ({ ok: true, content: '```json\n{"highlights":[{"quote":"像一层很薄的雪","note":"你也这样安静"},{"quote":"不在书里的话","note":"x"}]}\n```' });
    assert.equal(await h.context.askCoReadCharHighlight(), true);
    const rows = h.context.getCoReadHighlights('book-1');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].by, 'char');
    assert.equal(rows[0].charId, 'c1');
    assert.equal(CONTENT.slice(rows[0].start, rows[0].end), '像一层很薄的雪');
    assert.equal(rows[0].note, '你也这样安静');
    const time = h.context.getCoReadReadingTimeSummary('book-1');
    assert.equal(time.chars[0].charId, 'c1');
    assert.ok(time.chars[0].solo > 0 && time.chars[0].withUser === 0);
});

test('char highlight failures report the reason and add nothing', async () => {
    const h = harness();
    h.context.callChatApi = async () => ({ ok: true, content: '{"highlights":[{"quote":"完全编造的句子","note":"x"}]}' });
    assert.equal(await h.context.askCoReadCharHighlight(), false);
    assert.equal(h.context.getCoReadHighlights('book-1').length, 0);
    assert.match(h.toasts.at(-1), /没能划线：.*不在这一页/);
    h.context.callChatApi = async () => ({ ok: false, error: '429' });
    assert.equal(await h.context.askCoReadCharHighlight(), false);
    assert.match(h.toasts.at(-1), /429/);
});

test('quotes are located despite whitespace and quote-mark differences', () => {
    const h = harness();
    const at = h.context.locateCoReadQuote(CONTENT, '我们明天再读吧。', 0, CONTENT.length);
    assert.equal(CONTENT.slice(at.start, at.end), '我们明天再读吧。');
    const loose = h.context.locateCoReadQuote(CONTENT, '"我们明天 再读吧。"', 0, CONTENT.length);
    assert.ok(loose && CONTENT.slice(loose.start, loose.end).includes('明天再读'));
    assert.equal(h.context.locateCoReadQuote(CONTENT, '灯光', 0, 5), null, 'outside the page window');
});

test('highlight discussion keeps the user message on failure and retry completes it', async () => {
    const h = harness();
    const item = h.context.addCoReadHighlight(h.book, { by: 'user', start: CONTENT.indexOf('灯光'), end: CONTENT.length });
    vm.runInContext(`coreadHighlightOpenId = ${JSON.stringify(item.id)};`, h.context);
    const input = { value: '你会想到什么？' };
    h.context.document.getElementById = id => (id === 'coread-hl-reply' ? input : null);
    h.context.requestCoReadAiComment = async () => ({ ok: false, error: '接口超时' });
    assert.equal(await h.context.window.sendCoReadHighlightDiscussion(), false);
    let saved = h.context.getCoReadHighlights('book-1')[0];
    assert.deepEqual(saved.discussion.map(row => row.role), ['user']);
    assert.match(vm.runInContext('coreadHighlightStatus', h.context), /没有回复：接口超时/);
    let seenReply = '';
    h.context.requestCoReadAiComment = async (char, book, extra) => { seenReply = extra.replyText; return { ok: true, text: '想到你在灯下。' }; };
    assert.equal(await h.context.window.retryCoReadHighlightDiscussion(), true);
    saved = h.context.getCoReadHighlights('book-1')[0];
    assert.equal(seenReply, '你会想到什么？');
    assert.deepEqual(saved.discussion.map(row => [row.role, row.text]), [['user', '你会想到什么？'], ['char', '想到你在灯下。']]);
});

test('user and char reading time are counted separately', () => {
    const h = harness();
    assert.equal(h.context.creditCoReadCompanionReading(h.book, 120), true);
    h.context.addCoReadCharReadingSeconds('c1', 'book-1', 30, 'solo');
    h.context.window.CoReadJournal = undefined;
    vm.runInContext('var CoReadJournal = { read: () => ({ days: [{ date: "2026-10-25", books: [{ id: "book-1", seconds: 300, pages: [0] }, { id: "other", seconds: 50, pages: [0] }] }] }) }; window.CoReadJournal = CoReadJournal;', h.context);
    const summary = h.context.getCoReadReadingTimeSummary('book-1');
    assert.equal(summary.userSeconds, 300);
    assert.deepEqual({ ...summary.chars[0] }, { charId: 'c1', withUser: 120, solo: 30, seconds: 150 });
    vm.runInContext('coreadActiveCharId = "";', h.context);
    assert.equal(h.context.creditCoReadCompanionReading(h.book, 60), false, 'no companion selected, no char time');
});

test('reader wiring: paragraphs carry offsets, journal credits the companion, marks do not turn pages', () => {
    const reviews = fs.readFileSync(path.join(root, 'apps/coreading/reviews.js'), 'utf8');
    assert.match(reviews, /data-coread-offset="\$\{textStart\}"/);
    assert.match(reviews, /renderCoReadHighlightedText\(book, textStart, text\)/);
    const journal = fs.readFileSync(path.join(root, 'apps/coreading/reading-journal.js'), 'utf8');
    assert.match(journal, /localStorage\.setItem\(key, JSON\.stringify\(data\)\);[^\n]*\n[^\n]*\n\s+if \(to > from && typeof window\.creditCoReadCompanionReading === 'function'\)/);
    const reader = fs.readFileSync(path.join(root, 'apps/coreading/reader.js'), 'utf8');
    assert.equal((reader.match(/closest\('button, \.coread-hl'\)/g) || []).length, 4);
    assert.match(reader, /id: 'highlights', label: '划线'/);
    const layout = require('../scripts/source-layout.cjs');
    assert.ok(layout.scriptParts.includes('apps/coreading/highlights.js'));
    assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /apps\/coreading\/highlights\.js\?v=/);
});
