const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'core/api/chat-api.js'), 'utf8');

function load() {
    const context = vm.createContext({ window: {}, console: { log() {}, warn() {}, error() {} }, localStorage: { getItem: () => null, setItem() {} } });
    vm.runInContext(source, context);
    return context;
}

const history = () => [
    { isMe: true, type: 'text', content: '发张图', timestamp: 1 },
    { isMe: false, type: 'image', imageUrl: 'https://img.example/old.png', description: '旧图', timestamp: 2 },
    { isMe: true, type: 'text', content: '好看', timestamp: 3 },
    { isMe: false, type: 'image', imageUrl: 'https://img.example/new.png', description: '照片', imagePrompt: '本人自拍', timestamp: 4 },
    { isMe: true, type: 'text', content: '你看不见你生出来的图片吗？', timestamp: 5 }
];

test('the character sees the pixels of the picture it just sent', () => {
    const ctx = load();
    const char = { name: '商桓', history: history() };
    const messages = ctx.buildMessages(char, char.history, 10);
    const lastUser = messages.filter(m => m.role === 'user').pop();
    assert.ok(Array.isArray(lastUser.content));
    const urls = lastUser.content.filter(p => p.type === 'image_url').map(p => p.image_url.url);
    assert.deepEqual([...urls], ['https://img.example/new.png']);
    const own = messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n');
    assert.match(own, /你发出了一张图片：画面要求：本人自拍/);
});

test('a text-only model gets the same turn without the character pictures', () => {
    const ctx = load();
    const char = { name: '商桓', history: history() };
    const messages = ctx.buildMessages(char, char.history, 10);
    const stripped = ctx.stripChatApiCharacterImages(messages);
    assert.ok(stripped);
    const lastUser = stripped.filter(m => m.role === 'user').pop();
    assert.equal(typeof lastUser.content, 'string');
    assert.match(lastUser.content, /你看不见你生出来的图片吗/);
    assert.equal(ctx.stripChatApiCharacterImages(stripped), null);
});
