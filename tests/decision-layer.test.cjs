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
        localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
    };
    vm.runInNewContext(read('modules/decision/jev.js'), context);
    vm.runInNewContext(read('modules/decision/decider.js'), context);
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
    assert.equal(decider.replyInstructions(char({ isGroupChat: true })), '');
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
    assert.equal(decider.replyInstructions(char()), '', 'the reply does not spend tokens on verdicts Jev will give');
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

test('fewer than two labelled avatars never asks about mood; group chats are left alone', async () => {
    const { decider } = harness();
    assert.equal(decider.moodOptions(char({ avatarMoods: { 'a.png': '冷淡' } })).length, 0);
    assert.equal(decider.turnQuestions(char({ avatarMoods: {} })).questions.avatar, undefined);
    assert.equal((await decider.afterReply(char({ isGroupChat: true }), { replyDecisions: { status: true } })).route, 'none');
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
    const tools = read('modules/wechat/agent-tools.js');
    assert.match(wechat, /void runWechatTurnFollowUps\(char, \{ replyDecisions, textOnly: !!options\.textOnly, webSearched: !!webSearchContext\?\.sources\?\.length \}\);/);
    assert.match(wechat, /turn\?\.moment !== false\) void considerWechatCharMomentAfterReply\(char\)/);
    assert.match(wechat, /if \(snapshotAt && !options\.decided && now - snapshotAt < WECHAT_AI_STATUS_AUTO_REFRESH_COOLDOWN_MS\) return true;/);
    assert.match(wechat, /bynd_\(\?:summary\|tool\|pet\|decide\)/);
    assert.match(tools, /window\.ByndDecider\?\.replyInstructions\(char\)/);
    assert.match(tools, /decisions: decided\.decisions/);
    assert.match(read('index.html'), /modules\/decision\/decider\.js/);
    assert.match(read('index.html'), /console\.typesafe\.ai/);
});
