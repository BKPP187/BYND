const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function harness(fetchImpl = async () => { throw new Error('unexpected request'); }) {
    const values = new Map();
    const window = {};
    const context = {
        window, fetch: fetchImpl, AbortController, setTimeout, clearTimeout, console: { warn() {} },
        localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
    };
    vm.runInNewContext(read('systems/agent-runtime/jev.js'), context);
    vm.runInNewContext(read('systems/agent-runtime/decider.js'), context);
    return { jev: window.ByndJev, decider: window.ByndDecider, values };
}

const char = (extra = {}) => ({
    id: 'c1', name: '商桓', description: '毒舌冷淡的法医', avatar: 'a.png',
    avatarGallery: ['a.png', 'b.png', 'c.png'], avatarMoods: { 'a.png': '冷淡', 'b.png': '吃醋' },
    history: [{ isMe: true, type: 'text', content: '和顾野去吃云南菜了' }, { isMe: false, type: 'text', content: '挺好。' }],
    chatConfig: {}, ...extra
});
const jevAnswer = answers => async () => ({ ok: true, json: async () => ({ answers, usage: { input_tokens: 600, output_tokens: 100 } }) });

test('without Jev the chat reply carries hidden verdicts that are stripped from the visible text', async () => {
    const { decider, jev } = harness();
    assert.match(decider.replyInstructions(char()), /<bynd_decide>/);
    const { content, decisions } = decider.extractReplyDecisions('挺好。\n<bynd_decide>{"status":true,"memory":false,"moment":false}</bynd_decide>');
    assert.equal(content.trim(), '挺好。');
    assert.deepEqual({ ...decisions }, { status: true, memory: false, moment: false });
    assert.equal(decider.extractReplyDecisions('收到。<bynd_decide>{"status":tr').content, '收到。');
    const turn = await decider.afterReply(char(), { replyDecisions: decisions });
    assert.equal(turn.route, 'agent');
    assert.equal(turn.status, true);
    assert.equal(turn.memory, false);
    assert.equal(jev.readLog().length, 3);
});

test('with Jev one request answers every turn question and a confident mood switches the avatar', async () => {
    let body;
    const { decider, jev } = harness(async (_url, options) => {
        body = JSON.parse(options.body);
        return jevAnswer({
            status: { type: 'noul', noul: 0.82 },
            memory: { type: 'noul', noul: 0.1 },
            moment: { type: 'noul', noul: 0.5 },
            avatar: { type: 'choice', choice: '吃醋', probabilities: { '冷淡': 0.3, '吃醋': 0.7 } }
        })();
    });
    jev.write({ enabled: true, apiKey: 'test-key', scopes: {} });
    assert.match(decider.replyInstructions(char()), /<bynd_decide>/, 'the reply still carries verdicts so unsure Jev answers have a fallback');
    const turn = await decider.afterReply(char(), { replyDecisions: { status: false } });
    assert.deepEqual(Object.keys(body.questions).sort(), ['avatar', 'memory', 'moment', 'status']);
    assert.deepEqual(Object.keys(body.questions.avatar.criteria).sort(), ['冷淡', '吃醋'].sort());
    assert.equal(turn.route, 'jev');
    assert.equal(turn.status, true);
    assert.equal(turn.memory, false);
    assert.equal(turn.moment, null, 'an unsure verdict keeps the original behaviour');
    assert.deepEqual({ ...turn.avatar }, { index: 1, label: '吃醋' });
});

test('below the threshold or on errors Jev falls back to the reply verdicts', async () => {
    const unsure = harness(jevAnswer({ status: { type: 'noul', noul: 0.6 }, memory: { type: 'noul', noul: 0.6 }, moment: { type: 'noul', noul: 0.6 }, avatar: { type: 'choice', choice: '吃醋', probabilities: { '吃醋': 0.51, '冷淡': 0.49 } } }));
    unsure.jev.write({ enabled: true, apiKey: 'k', scopes: {}, minProbability: 0.7 });
    const turn = await unsure.decider.afterReply(char());
    assert.equal(turn.status, null);
    assert.equal(turn.avatar, null);
    const broken = harness(async () => { throw new Error('boom'); });
    broken.jev.write({ enabled: true, apiKey: 'k', scopes: {} });
    const fallback = await broken.decider.afterReply(char(), { replyDecisions: { memory: true } });
    assert.equal(fallback.route, 'agent');
    assert.equal(fallback.memory, true);
    assert.equal(broken.jev.readLog().some(entry => entry.route === 'jev-error'), true);
});

test('fewer than two labelled avatars never asks about mood', async () => {
    const { decider } = harness();
    assert.equal(decider.moodOptions(char({ avatarMoods: { 'a.png': '冷淡' } })).length, 0);
    assert.equal(decider.turnQuestions(char({ avatarMoods: {} })).questions.avatar, undefined);
});

test('group chats decide only the status snapshot and memory, by reply block or by Jev', async () => {
    const group = () => char({ id: 'g1', name: '研究所群', isGroupChat: true });
    const plain = harness();
    const instructions = plain.decider.replyInstructions(group());
    assert.match(instructions, /<bynd_decide>\{"status":true或false,"memory":true或false\}<\/bynd_decide>/);
    assert.doesNotMatch(instructions, /moment|avatar|npcFriend/);
    const { decisions } = plain.decider.extractReplyDecisions('【商桓】收到。\n<bynd_decide>{"status":false,"memory":true,"moment":true}</bynd_decide>');
    const turn = await plain.decider.afterReply(group(), { replyDecisions: decisions });
    assert.equal(turn.route, 'agent');
    assert.equal(turn.status, false);
    assert.equal(turn.memory, true);
    assert.equal(turn.moment, null, 'groups never decide a moment');
    assert.equal(turn.avatar, null);
    assert.deepEqual([...plain.jev.readLog().map(entry => entry.key)].sort(), ['memory', 'status']);

    let body;
    const withJev = harness(async (_url, options) => { body = JSON.parse(options.body); return jevAnswer({ status: { type: 'noul', noul: 0.9 }, memory: { type: 'noul', noul: 0.1 } })(); });
    withJev.jev.write({ enabled: true, apiKey: 'k', scopes: {} });
    const jevTurn = await withJev.decider.afterReply(group(), { replyDecisions: { status: false } });
    assert.deepEqual(Object.keys(body.questions).sort(), ['memory', 'status']);
    assert.equal(body.state.group.name, '研究所群');
    assert.equal(body.state.character, undefined);
    assert.equal(jevTurn.route, 'jev');
    assert.equal(jevTurn.status, true);
    assert.equal(jevTurn.memory, false);
});

test('the decision log keeps a summary and can be cleared', async () => {
    const { decider, jev } = harness();
    decider.replyInstructions(char());
    await decider.afterReply(char(), { replyDecisions: null });
    await decider.afterReply(char(), { replyDecisions: { status: true, memory: false } });
    const summary = jev.summarizeLog();
    assert.equal(summary.total, 3);
    assert.equal(summary.agent, 2);
    assert.equal(summary.missing, 1);
    jev.clearLog();
    assert.equal(jev.readLog().length, 0);
    for (let i = 0; i < 250; i++) jev.logDecision({ route: 'agent', key: 'k' + i });
    assert.equal(jev.readLog().length, 200);
});

test('the tool gate blocks only a confident out-of-character verdict', async () => {
    const no = harness(jevAnswer({ inCharacter: { type: 'noul', noul: 0.08 } }));
    no.jev.write({ enabled: true, apiKey: 'k', scopes: {} });
    assert.equal((await no.decider.gate(char(), '在淘宝搜索粉色蝴蝶结发夹')).allow, false);
    const off = harness();
    assert.equal((await off.decider.gate(char(), '查天气')).allow, true);
});

test('chat follow-ups honour the decisions and the reply parser/preview strip the hidden block', () => {
    const wechat = read('wechat.js');
    const tools = read('systems/agent-runtime/agent-tools.js');
    assert.match(wechat, /void runWechatTurnFollowUps\(char, \{ replyDecisions, textOnly: !!options\.textOnly, webSearched: !!webSearchContext\?\.sources\?\.length \}\);/);
    assert.match(wechat, /turn\?\.moment !== false\) void considerWechatCharMomentAfterReply\(char\)/);
    assert.match(wechat, /if \(snapshotAt && !options\.decided && now - snapshotAt < WECHAT_AI_STATUS_AUTO_REFRESH_COOLDOWN_MS\) return true;/);
    assert.match(wechat, /bynd_\(\?:summary\|tool\|pet\|decide\)/);
    assert.match(tools, /window\.ByndDecider\?\.replyInstructions\(char\)/);
    assert.match(tools, /decisions: decided\.decisions/);
    assert.match(read('index.html'), /systems\/agent-runtime\/decider\.js/);
    assert.match(read('index.html'), /console\.typesafe\.ai/);
});

test('a reply that ignores or garbles the verdict block is logged instead of silently falling back', async () => {
    const { decider, jev } = harness();
    decider.replyInstructions(char());
    const missing = await decider.afterReply(char(), { replyDecisions: null });
    assert.equal(missing.route, 'none');
    assert.equal(jev.readLog()[0].route, 'agent-missing');
    assert.match(jev.readLog()[0].label, /没有附上判断/);
    const garbled = decider.extractReplyDecisions('好。<bynd_decide>{status: yes}</bynd_decide>');
    assert.equal(garbled.content, '好。');
    assert.equal(garbled.decisions.invalid, true);
    assert.deepEqual({ ...garbled.decisions }, {}, 'the flag is not enumerable');
    decider.replyInstructions(char());
    await decider.afterReply(char(), { replyDecisions: garbled.decisions });
    assert.match(jev.readLog()[0].label, /格式有误/);
    const before = jev.readLog().length;
    await decider.afterReply(char(), { replyDecisions: null });
    assert.equal(jev.readLog().length, before, 'replies that were never asked for a block log nothing');
});

test('without Jev the reply can switch the avatar mood, but only to a labelled, different picture', async () => {
    const { decider, jev } = harness();
    const instructions = decider.replyInstructions(char());
    assert.match(instructions, /"avatar"/);
    assert.match(instructions, /「冷淡」、「吃醋」/);
    assert.doesNotMatch(decider.replyInstructions(char({ avatarMoods: { 'a.png': '冷淡' } })), /"avatar"/);
    const { decisions } = decider.extractReplyDecisions('嗯。<bynd_decide>{"status":false,"memory":false,"moment":false,"avatar":"吃醋"}</bynd_decide>');
    const turn = await decider.afterReply(char(), { replyDecisions: decisions });
    assert.deepEqual({ ...turn.avatar }, { index: 1, label: '吃醋' });
    assert.equal(jev.readLog().some(entry => entry.key === 'avatar' && entry.answer === '吃醋'), true);
    for (const avatar of ['冷淡', '开心', '']) {
        const same = await decider.afterReply(char(), { replyDecisions: { avatar } });
        assert.equal(same.avatar, null, `${avatar || 'empty'} keeps the current avatar`);
    }
});

test('where Jev is unsure the reply verdict fills in, and the turn request uses a short timeout', async () => {
    let timeoutSeen = null;
    const realSetTimeout = setTimeout;
    const { decider, jev } = harness(jevAnswer({ status: { type: 'noul', noul: 0.9 }, memory: { type: 'noul', noul: 0.5 }, moment: { type: 'noul', noul: 0.5 }, avatar: { type: 'choice', choice: '吃醋', probabilities: { '吃醋': 0.5, '冷淡': 0.5 } } }));
    jev.write({ enabled: true, apiKey: 'k', scopes: {}, minProbability: 0.7 });
    const ask = jev.ask;
    jev.ask = (scope, state, questions, meta) => { timeoutSeen = meta.timeoutMs; return ask(scope, state, questions, meta); };
    const turn = await decider.afterReply(char(), { replyDecisions: { status: false, memory: true, avatar: '吃醋' } });
    assert.equal(timeoutSeen, 5000);
    assert.equal(turn.route, 'jev');
    assert.equal(turn.status, true, 'a confident Jev verdict wins over the reply');
    assert.equal(turn.memory, true, 'an unsure Jev verdict uses the reply');
    assert.equal(turn.moment, null, 'no verdict anywhere keeps the default');
    assert.deepEqual({ ...turn.avatar }, { index: 1, label: '吃醋' });
    assert.equal(jev.readLog().some(entry => /Jev 不确定/.test(entry.label)), true);
    void realSetTimeout;
});
