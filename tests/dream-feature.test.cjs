const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('script.js', 'utf8');
const start = source.indexOf('// --- Dream Vault / 盗梦空间 ---');
const end = source.indexOf('// --- BYND Monitor / 内部监控剧情入口 ---');
assert.ok(start >= 0 && end > start, 'dream module markers must exist');

const store = new Map();
const context = vm.createContext({
    URL,
    console,
    confirm: () => true,
    document: {
        getElementById: () => null,
        querySelectorAll: () => []
    },
    localStorage: {
        getItem: key => store.get(key) || null,
        setItem: (key, value) => store.set(key, value)
    },
    musicEscapeAttr: value => String(value || ''),
    musicEscapeHtml: value => String(value || ''),
    getWechatSortedChatCharacters: () => context.window.myCharacters,
    getWechatCharDisplayName: char => char.chatConfig?.nickname || char.name,
    getWechatCharAvatarSource: (char, fallback) => char.avatar || fallback,
    getWechatImageReferenceForChar: char => char.chatConfig?.imageReference || char.avatar || '',
    getWechatChatUserProfile: () => ({ name: 'User A' }),
    buildWechatIdentityContextPrompt: () => 'IDENTITY_CONTEXT',
    getWechatCharacterPersonaText: () => 'PERSONA_AND_WORLD_BOOK',
    buildWechatMemoryPrompt: () => 'LONG_TERM_MEMORY',
    buildWechatRecentHistoryForPrompt: () => 'RECENT_CHAT_CONTEXT',
    callChatApi: async () => ({ ok: false }),
    window: {
        DEFAULT_AVATAR: 'data:image/svg+xml,default',
        location: { href: 'http://127.0.0.1:4173/', origin: 'http://127.0.0.1:4173/' },
        myCharacters: []
    }
});

vm.runInContext(source.slice(start, end), context);

context.window.myCharacters = [
    { id: 'real', name: '江闻远', avatar: 'data:image/png;base64,AAAA', history: [] },
    { id: 'empty-avatar', name: '测试', avatar: 'http://127.0.0.1:4173/', history: [] },
    { id: 'group', name: '群聊', isGroupChat: true },
    { id: 'npc', name: '群 NPC', isGroupNpc: true }
];

assert.deepEqual(
    vm.runInContext('getDreamCharacters().map(char => char.id)', context),
    ['real', 'empty-avatar']
);

const fallbackAvatar = vm.runInContext('getDreamCharAvatar(window.myCharacters[1])', context);
assert.match(fallbackAvatar, /^data:image\/svg\+xml,/);
assert.ok(!fallbackAvatar.includes('127.0.0.1'));

context.window.myCharacters[0].chatConfig = { imageReference: 'data:image/png;base64,REFERENCE' };
assert.equal(
    vm.runInContext('getDreamCharReferenceImage(window.myCharacters[0])', context),
    'data:image/png;base64,REFERENCE'
);

const messages = vm.runInContext('buildDreamGenerationMessages(window.myCharacters[0])', context);
const prompt = messages.map(message => message.content).join('\n');
for (const required of ['IDENTITY_CONTEXT', 'PERSONA_AND_WORLD_BOOK', 'LONG_TERM_MEMORY', 'RECENT_CHAT_CONTEXT', 'charAction']) {
    assert.ok(prompt.includes(required), `prompt must include ${required}`);
}

const generated = vm.runInContext(`validateDreamGenerationPayload({
    title: '夜航',
    summary: '梦境梗概',
    intent: '未竟之意',
    openingScene: '开场',
    charAction: '角色先伸出手',
    choices: ['握住', '停在原地'],
    imagePrompt: 'moonlit platform'
})`, context);
assert.equal(generated.charAction, '角色先伸出手');
assert.throws(
    () => vm.runInContext("validateDreamGenerationPayload({ title: '残缺' })", context),
    /缺少字段/
);
assert.throws(
    () => vm.runInContext(`validateDreamGenerationPayload({
        title: '错误选项', summary: '梗概', intent: '意图', openingScene: '开场',
        charAction: '动作', choices: [{ label: '不应被渲染' }], imagePrompt: 'prompt'
    })`, context),
    /choices/
);

context.recordForSession = generated;
const session = vm.runInContext('createDreamSessionFromRecord(recordForSession)', context);
assert.equal(session.currentCharAction, '角色先伸出手');
assert.deepEqual(Array.from(session.choices), ['握住', '停在原地']);

const ending = vm.runInContext(`validateDreamTurnPayload({
    scene: '天光落下',
    charAction: '角色松开手',
    choices: [],
    isEnding: true,
    endingTitle: '梦醒时分'
})`, context);
assert.equal(ending.isEnding, true);

console.log('dream feature tests passed');
