const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function harness() {
    const advanceCalls = [];
    const stores = {};
    const char = {
        id: 'char_a', name: '温今北', description: '图书管理员', avatar: 'a.png',
        chatConfig: {}, isGroupChat: false,
        history: Array.from({ length: 10 }, (_, i) => ({
            type: 'text', isMe: i % 2 === 0, content: `消息${i}`, timestamp: Date.now() - (10 - i) * 60000
        }))
    };
    const context = vm.createContext({
        window: {
            myCharacters: [char],
            LivingWorld: {
                advanceWorld: async (opts) => { advanceCalls.push(opts); return true; },
                getState: () => ({ posts: [] })
            }
        },
        console: { warn() {}, log() {} },
        JSON, Math, Date, Promise, Array, Object, String, Number, Set, Map, RegExp,
        setTimeout, clearTimeout,
        DEFAULT_AVATAR: 'default.png',
        readWechatStore: (key, fallback) => stores[key] ?? fallback,
        writeWechatStore: (key, value) => { stores[key] = value; },
        getWechatCharDisplayName: c => c?.chatConfig?.nickname || c?.name || '',
        stripWechatPromptText: (t, n) => String(t).slice(0, n),
        getWechatMomentStore: () => ({ posts: [] }),
        saveWechatMomentStore: () => {},
        saveCharactersToStorage: async () => true,
        isWechatMomentsScreenOpen: () => false,
        renderWechatMoments: () => {},
        splitWechatDirectiveArgs: a => String(a).split('|'),
        cleanWechatVisibleContent: t => t,
        normalizeWechatRegexPayloadSource: t => t,
        shouldDropWechatAiPipeStatusPayload: () => false,
        buildWechatLooseStickerDirectiveMessageFromText: () => null,
        isWechatStandaloneRichOrRegexSource: () => false,
        hasWechatAiDirectiveSource: () => false,
        getWechatAiParseEvents: () => [],
        appendWechatPlainAiTextParts: () => {},
        splitWechatOfflinePlainText: () => [],
        appendWechatNarrationContentParts: () => {},
        appendWechatDirectivePart: () => {},
        buildWechatWorldBookPrompt: () => '',
        createMessageTimestamp: () => Date.now(),
        quoteWechatJsString: s => JSON.stringify(s),
        wcEscapeHtml: s => s,
        getWechatModalRoot: () => ({ appendChild() {} }),
        isWechatHiddenChatSurfaceMessage: () => false,
        getWechatTextMessageVisibleText: () => '',
        buildWechatMessageFromAiDirective: () => null
    });
    context.window.callChatApi = async () => ({ ok: true, content: '{"post":false}' });
    const WECHAT_CHAR_MOMENT_ACTIVITY_KEY = 'bynd_char_moment_activity';
    context.WECHAT_CHAR_MOMENT_ACTIVITY_KEY = WECHAT_CHAR_MOMENT_ACTIVITY_KEY;
    vm.runInContext(read('apps/wechat/moments/reply-actions.js'), context);
    return { context, char, advanceCalls, stores };
}

test('forum key is in TURN_KEYS and the decider template includes it', () => {
    const src = read('systems/agent-runtime/decider.js');
    assert.match(src, /'forum'/);
    assert.match(src, /forum: '论坛动态'/);
    assert.match(src, /"forum":true或false/);
    assert.match(src, /forum: verdict\('forum'\)/);
    assert.match(src, /forum: reply\.forum \?\? null/);
    assert.match(src, /forum: null/);
    assert.match(src, /hoursSinceLastForumPost/);
});

test('ai-reply wires forum follow-up on turn.forum === true', () => {
    const src = read('core/api/ai-reply.js');
    assert.match(src, /turn\?\.forum === true\) void considerWechatCharForumPostAfterReply/);
});

test('considerWechatCharForumPostAfterReply calls advanceWorld with the char account id', async () => {
    const h = harness();
    const result = await h.context.considerWechatCharForumPostAfterReply(h.char);
    assert.equal(result, true);
    assert.equal(h.advanceCalls.length, 1);
    assert.equal(h.advanceCalls[0].actorId, 'char:char_a');
});

test('forum post is skipped when LivingWorld is unavailable', async () => {
    const h = harness();
    h.context.window.LivingWorld = null;
    assert.equal(await h.context.considerWechatCharForumPostAfterReply(h.char), false);
    assert.equal(h.advanceCalls.length, 0);
});

test('forum post is skipped for group chats', async () => {
    const h = harness();
    h.char.isGroupChat = true;
    assert.equal(await h.context.considerWechatCharForumPostAfterReply(h.char), false);
});

test('forum post is skipped when recent forum post exists within 12h', async () => {
    const h = harness();
    h.context.window.LivingWorld.getState = () => ({
        posts: [{ authorId: 'char:char_a', createdAt: Date.now() - 6 * 3600000 }]
    });
    assert.equal(await h.context.considerWechatCharForumPostAfterReply(h.char), false);
});

test('forum post is skipped when fewer than 4 user messages in recent history', async () => {
    const h = harness();
    h.char.history = [
        { type: 'text', isMe: true, content: '消息1', timestamp: Date.now() },
        { type: 'text', isMe: false, content: '回复', timestamp: Date.now() }
    ];
    assert.equal(await h.context.considerWechatCharForumPostAfterReply(h.char), false);
});

test('forum post is skipped within 10h activity cooldown', async () => {
    const h = harness();
    h.stores['bynd_char_forum_activity'] = { char_a: Date.now() - 5 * 3600000 };
    assert.equal(await h.context.considerWechatCharForumPostAfterReply(h.char), false);
});

test('concurrent calls are deduplicated', async () => {
    const h = harness();
    let resolve;
    const gate = new Promise(r => { resolve = r; });
    h.context.window.LivingWorld.advanceWorld = async (opts) => { h.advanceCalls.push(opts); await gate; return true; };
    const first = h.context.considerWechatCharForumPostAfterReply(h.char);
    const second = h.context.considerWechatCharForumPostAfterReply(h.char);
    assert.equal(await second, false);
    resolve();
    assert.equal(await first, true);
    assert.equal(h.advanceCalls.length, 1);
});
