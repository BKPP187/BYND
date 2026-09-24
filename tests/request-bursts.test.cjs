const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { sourceSection, memoryStorage, deferred, clone } = require('./helpers/harness.cjs');

// The user's relay answers a bare HTTP 429 to back-to-back requests: every
// feature here must keep to one request (plus at most one spaced retry).

function coReadHarness() {
    const state = { calls: [], gaps: 0, respond: async () => ({ ok: true, content: '这一段读得我有点在意。' }), fetches: 0, parse: async () => ({ content: '' }) };
    const localStorage = memoryStorage();
    const context = vm.createContext({
        localStorage, console: { warn() {} }, Date, Math, JSON, Set, Map, Promise, window: {},
        applyCoReadStoredProgress() {}, renderCoReadApp() {}, renderCoReadDashboard() {}, renderCoReadBookDetail() {}, renderCoReadThoughts() {},
        buildCoReadCommentMessages: (char, book, extra) => [{ role: 'user', content: JSON.stringify({ page: book.page, extra }) }],
        normalizeCoReadAiCommentText: text => String(text || '').trim(),
        waitForChatApiQuietGap: async () => { state.gaps += 1; },
        callChatApi: async (messages, options) => { state.calls.push({ messages, options }); return state.respond(messages, options); },
        isCoReadUrlTitle: () => false, isCoReadLikelyDirectoryContent: () => false,
        isCoReadUsefulContent: text => String(text || '').length > 20,
        extractCoReadReadableContent: async () => { state.fetches += 1; return state.parse(); },
        mergeCoReadMetadata() {}, ensureCoReadBookCover() {},
        fetchCoReadCoverFromMetadata: async () => state.cover.promise,
        buildCoReadGeneratedCoverUrl: () => 'data:image/svg+xml,cover',
        buildCoReadBookReviewMessages: () => [{ role: 'user', content: 'review' }],
        normalizeCoReadBookReviewItems: text => text ? [{ id: 'ai', text }] : [],
        getCoReadBookReviews: book => Array.isArray(book.reviews) ? book.reviews : [],
        getCoReadRecentPageContextText: book => `第 ${book.page} 页正文`,
        getCoReadCharName: char => char.name, DEFAULT_AVATAR: ''
    });
    vm.runInContext(`
        const COREAD_LIBRARY_KEY = 'bynd_coread_library_v1';
        const COREAD_AI_COMMENT_MAX_TOKENS = 1800, COREAD_AI_REPLY_MAX_TOKENS = 1800;
        const COREAD_RESOLVE_VERSION = 3, COREAD_META_VERSION = 1, COREAD_CHAPTER_VERSION = 1;
        const coreadResolvingBookIds = new Set();
        var coreadLibraryCache = null, coreadLibraryCacheRaw = '', coreadBookReviewBusyId = '', coreadActiveBookId = '', coreadActiveCharId = '';
        var coreadBusy = false, coreadCommentPanelOpen = false, coreadCommentStatusText = '';
    `, context);
    for (const [start, end] of [
        ['// Cover lookups in flight this session', 'function getCoReadProgressMap('],
        ['async function ensureCoReadBookCover(', 'function getCoReadCharName('],
        ['function shouldResolveCoReadBookContent(', 'function renderCoReadBookCard('],
        ['function createCoReadThoughtRecord(', 'function getCoReadRecentDiscussionContext('],
        ['async function requestCoReadAiComment(', 'function groupCoReadThoughtsByCharAndBook('],
        ['async function generateCoReadBookReviews(', 'function likeCoReadBookReview('],
        ['async function resolveCoReadBookContent(', 'async function readCoReadFileAsBook('],
        ['async function askCoReadComment(', 'window.askCoReadComment']
    ]) vm.runInContext(sourceSection('script.js', start, end), context);
    const saves = () => localStorage.writes.filter(([key]) => key === 'bynd_coread_library_v1').length;
    return { context, state, localStorage, saves, run: code => vm.runInContext(code, context) };
}

const char = { id: 'reader', name: '温今北' };

test('co-read comments stop at once on a rate limit instead of retrying back to back', async () => {
    const h = coReadHarness();
    h.state.respond = async () => ({ ok: false, rateLimited: true, httpStatus: 429, error: 'API 错误 (429)' });
    const result = await h.context.requestCoReadAiComment(char, { page: 0 });
    assert.equal(result.ok, false);
    assert.equal(result.rateLimited, true);
    assert.equal(h.state.calls.length, 1);
    assert.equal(h.state.gaps, 0);
});

test('an empty co-read comment gets exactly one retry, after the quiet gap', async () => {
    const h = coReadHarness();
    h.state.respond = async () => ({ ok: true, content: '' });
    const result = await h.context.requestCoReadAiComment(char, { page: 0 });
    assert.equal(result.ok, false);
    assert.equal(h.state.calls.length, 2, 'first request plus one retry');
    assert.equal(h.state.gaps, 1, 'the retry waits for the relay quiet gap');
    assert.ok(h.state.calls.every(call => call.options.skipEmptyLengthRetry && call.options.skipStatusValidationRetry && call.options.usageFeature === 'read'));
    h.state.calls.length = 0;
    h.state.respond = async () => h.state.calls.length === 1 ? { ok: true, content: '' } : { ok: true, content: '重试后的评论。' };
    assert.deepEqual(clone(await h.context.requestCoReadAiComment(char, { page: 0 })), { ok: true, text: '重试后的评论。' });
});

test('a link book that fails to parse is fetched once, not on every render, until a manual 重新解析', async () => {
    const h = coReadHarness();
    h.context.saveCoReadLibrary([{ id: 'link', title: '外链书', url: 'https://example.test/book', content: '', coverUrl: 'data:image/png;base64,x' }]);
    const writesBefore = h.saves();
    await h.context.resolveCoReadBookContent('link');
    const failed = h.context.getCoReadLibrary()[0];
    assert.equal(h.state.fetches, 1);
    assert.ok(failed.resolveFailedAt > 0);
    assert.equal(failed.resolveAttempts, 1);
    const writesAfterFailure = h.saves();
    for (let render = 0; render < 5; render += 1) {
        assert.equal(h.context.shouldResolveCoReadBookContent(h.context.getCoReadLibrary()[0]), false);
        await h.context.resolveCoReadBookContent('link');
    }
    assert.equal(h.state.fetches, 1, 'no re-fetch loop');
    assert.equal(h.saves(), writesAfterFailure, 'the library is not rewritten by renders');
    assert.ok(writesAfterFailure > writesBefore);

    h.state.parse = async () => { throw new Error('network'); };
    await h.context.retryCoReadBookContent('link');
    assert.equal(h.state.fetches, 2);
    assert.equal(h.context.getCoReadLibrary()[0].resolveAttempts, 2);
    h.state.parse = async () => ({ content: '这是一段足够长的正文内容，可以正常阅读下去了。' });
    await h.context.retryCoReadBookContent('link');
    const resolved = h.context.getCoReadLibrary()[0];
    assert.equal(h.state.fetches, 3);
    assert.equal(resolved.resolveFailedAt, undefined);
    assert.equal(resolved.resolveAttempts, undefined);
    assert.match(resolved.content, /正文内容/);
});

test('the transient coverResolving flag is never persisted and a reload does not keep it', async () => {
    const h = coReadHarness();
    h.state.cover = deferred();
    h.context.saveCoReadLibrary([{ id: 'b', title: '书', author: '' }]);
    const pending = h.context.ensureCoReadBookCover('b');
    assert.equal(h.context.getCoReadLibrary()[0].coverResolving, true, 'the running session still shows the lookup');
    assert.doesNotMatch(h.localStorage.getItem('bynd_coread_library_v1'), /coverResolving/);
    h.state.cover.resolve('https://example.test/cover.jpg');
    await pending;
    assert.equal(h.context.getCoReadLibrary()[0].coverUrl, 'https://example.test/cover.jpg');

    const legacy = coReadHarness();
    legacy.localStorage.setItem('bynd_coread_library_v1', JSON.stringify([{ id: 'old', title: '旧书', coverResolving: true }]));
    assert.equal(legacy.context.getCoReadLibrary()[0].coverResolving, undefined, 'a stale flag from an older save is cleared on load');
});

test('generated book reviews merge into the latest library instead of a stale snapshot', async () => {
    const h = coReadHarness();
    const gate = deferred();
    h.state.respond = () => gate.promise;
    h.context.saveCoReadLibrary([{ id: 'a', title: 'A', reviews: [] }, { id: 'b', title: 'B' }]);
    const running = h.context.generateCoReadBookReviews('a');
    const latest = clone(h.context.getCoReadLibrary());
    latest[0].page = 7;
    latest.push({ id: 'c', title: '等待期间加入的书' });
    h.context.saveCoReadLibrary(latest);
    gate.resolve({ ok: true, content: '好书' });
    await running;
    const saved = JSON.parse(h.localStorage.getItem('bynd_coread_library_v1'));
    assert.deepEqual(saved.map(book => book.id), ['a', 'b', 'c']);
    assert.equal(saved[0].page, 7);
    assert.equal(saved[0].reviews[0].text, '好书');
});

test('a co-read comment is saved against the page it was asked about', async () => {
    const h = coReadHarness();
    const gate = deferred();
    h.context.saveCoReadLibrary([{ id: 'book', title: '书', page: 3 }]);
    h.run(`coreadActiveBookId = 'book'; coreadActiveCharId = 'reader';`);
    Object.assign(h.context, {
        syncCoReadPageFromScrollPosition() {},
        getCoReadBook: id => h.context.getCoReadLibrary().find(book => book.id === id),
        getCoReadCharacters: () => [char]
    });
    h.state.respond = () => gate.promise;
    const asking = h.context.askCoReadComment();
    h.context.getCoReadLibrary()[0].page = 9; // the reader turns pages while waiting
    gate.resolve({ ok: true, content: '这一页的对白很妙。' });
    await asking;
    const thought = h.context.getCoReadLibrary()[0].thoughts[0];
    assert.equal(thought.page, 3);
    assert.equal(thought.pageText, '第 3 页正文');
    assert.match(h.state.calls[0].messages[0].content, /"page":3/);
});

function boardHarness() {
    const localStorage = memoryStorage();
    const state = { now: 1800000000000, calls: [], respond: async () => ({ ok: true, content: '好棋。' }), chats: [] };
    class Clock extends Date { static now() { return state.now; } }
    const context = vm.createContext({
        localStorage, Date: Clock, JSON, Math, Map, Set, console: { warn() {} }, window: { cleanChatApiVisibleContent: text => String(text || '').trim() },
        getBoardGameCharId: () => 'player', getBoardGameStateByType: () => ({ moves: 4 }),
        isBoardCompanionGame: () => true, getBoardGameChar: () => ({ id: 'player', name: '商桓', history: [] }),
        getBoardGameMeta: () => ({ title: '象棋' }), summarizeBoardGame: () => '局面', renderGameApp() {}, getActiveGame: () => 'xiangqi',
        getMusicCharName: c => c.name, showWechatToast() {},
        callChatApi: async (messages, options) => { state.calls.push({ messages, options }); return state.respond(messages, options); }
    });
    vm.runInContext(`
        const BOARD_GAME_COMMENT_RATE_KEY_PREFIX = 'rate_', BOARD_GAME_CHAT_KEY_PREFIX = 'chat_';
        const BOARD_GAME_AUTO_COMMENT_EVERY_MOVES = 4, BOARD_GAME_AUTO_COMMENT_COOLDOWN_MS = 90000;
        const BOARD_GAME_MANUAL_COMMENT_COOLDOWN_MS = 30000, BOARD_GAME_RATE_LIMIT_PAUSE_MS = 300000;
    `, context);
    for (const [start, end] of [
        ['function getBoardGameCommentRateKey(', 'function finishBoardGameMove('],
        ['function getBoardGameChat(type)', 'function summarizeBoardGame('],
        ['async function requestBoardGameAiComment(', 'window.requestBoardGameAiComment']
    ]) vm.runInContext(sourceSection('script.js', start, end), context);
    return { context, state };
}

test('board-game comments keep a quiet gap between requests', () => {
    const h = boardHarness();
    assert.equal(h.context.reserveBoardGameAiComment('xiangqi', 'start').allowed, true);
    h.state.now += 720;
    const blocked = h.context.reserveBoardGameAiComment('xiangqi', 'manual');
    assert.equal(blocked.allowed, false, 'a manual comment 720 ms after the opening comment would be a back-to-back request');
    assert.equal(blocked.reason, 'request-gap');
    h.state.now += 6000;
    assert.equal(h.context.reserveBoardGameAiComment('xiangqi', 'manual').allowed, true);
});

test('a win comment right after a move comment waits in the background queue, and nothing else starts meanwhile', async () => {
    const h = boardHarness();
    const gate = deferred();
    h.state.respond = () => gate.promise;
    const moveComment = h.context.requestBoardGameAiComment('xiangqi', 'char-move', { moveCount: 4 });
    await Promise.resolve();
    assert.equal(h.state.calls.length, 1);
    h.state.now += 720;
    assert.equal(h.context.reserveBoardGameAiComment('xiangqi', 'manual').reason, 'in-flight');
    h.state.now += 10000;
    assert.equal(h.context.reserveBoardGameAiComment('xiangqi', 'manual').reason, 'in-flight', 'nothing new starts while a comment is outstanding');
    const winComment = h.context.requestBoardGameAiComment('xiangqi', 'win', { moveCount: 5 });
    await Promise.resolve();
    assert.equal(h.state.calls.length, 2);
    assert.ok(h.state.calls.every(call => call.options.background === true && call.options.usageFeature === 'game'), 'the chat API queue spaces the two requests');
    gate.resolve({ ok: true, content: '赢了。' });
    await Promise.all([moveComment, winComment]);
    h.state.now += 7000;
    assert.equal(h.context.reserveBoardGameAiComment('xiangqi', 'manual').allowed, true);
});
