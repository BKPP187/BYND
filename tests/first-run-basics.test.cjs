const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, memoryStorage } = require('./helpers/harness.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Minimal element: enough for the guide, the hint and the preset box.
function element(tag = 'div') {
    const node = {
        tagName: tag.toUpperCase(), children: [], attributes: {}, dataset: {}, style: {}, listeners: {}, className: '', innerHTML: '', value: '', hidden: false, parentNode: null, focused: false,
        setAttribute(name, value) { node.attributes[name] = String(value); },
        getAttribute(name) { return node.attributes[name]; },
        appendChild(child) { child.parentNode = node; node.children.push(child); return child; },
        insertBefore(child, before) { child.parentNode = node; node.children.splice(Math.max(0, node.children.indexOf(before)), 0, child); return child; },
        remove() { if (node.parentNode) node.parentNode.children = node.parentNode.children.filter(item => item !== node); node.parentNode = null; },
        addEventListener(type, fn) { (node.listeners[type] = node.listeners[type] || []).push(fn); },
        dispatchEvent(event) { (node.listeners[event.type] || []).forEach(fn => fn(event)); return true; },
        focus() { node.focused = true; },
        getBoundingClientRect: () => ({ top: 700, right: 360, bottom: 740, left: 330 }),
        querySelector: () => null,
        querySelectorAll: () => [],
        closest: () => null
    };
    return node;
}

test('a card greeting starts an empty chat once, with the user and character names filled in', () => {
    const context = vm.createContext({ getUserProfile: () => ({ name: '小薇' }) });
    vm.runInContext(read('core/character/card-parser.js'), context);
    const char = { name: '温今北', first_mes: '  {{user}}，我是{{char}}。 ', history: [] };
    assert.equal(context.seedWechatCharacterGreeting(char), true);
    assert.equal(char.history.length, 1);
    assert.equal(char.history[0].content, '小薇，我是温今北。');
    assert.equal(char.history[0].isMe, false);
    assert.equal(char.history[0].type, 'text');
    assert.equal(context.seedWechatCharacterGreeting(char), false, 'a chat that already has messages is left alone');
    assert.equal(char.history.length, 1);
    assert.equal(context.seedWechatCharacterGreeting({ name: '群', isGroupChat: true, first_mes: '大家好', history: [] }), false, 'group chats get no greeting');
    assert.equal(context.seedWechatCharacterGreeting({ name: '空', first_mes: '   ', history: [] }), false, 'a blank greeting adds nothing');
});

test('imported cards seed the greeting before the contact is saved', () => {
    const source = read('apps/wechat/character/import.js');
    assert.ok(source.indexOf('seedWechatCharacterGreeting(newChar)') < source.indexOf('window.myCharacters.push(newChar)'));
});

test('picking a common provider fills the address, keeps a custom name and links to its key page', () => {
    const nodes = new Map();
    const group = element(), body = element();
    body.appendChild(group);
    for (const id of ['api-edit-name', 'api-edit-url', 'api-edit-key']) nodes.set(id, element('input'));
    nodes.get('api-edit-name').closest = () => group;
    const urlInputs = [];
    nodes.get('api-edit-url').addEventListener('input', () => urlInputs.push(nodes.get('api-edit-url').value));
    const context = vm.createContext({
        document: {
            getElementById: id => nodes.get(id) || null,
            createElement: tag => {
                const node = element(tag);
                node.querySelectorAll = () => [];
                node.querySelector = selector => selector === '.api-editor-preset-guide' ? (node.guide = node.guide || element('p')) : null;
                return node;
            }
        },
        Event: class { constructor(type) { this.type = type; } },
        escapeHtml: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
    });
    vm.runInContext(read('apps/settings/api-edit.js'), context);
    for (const preset of vm.runInContext('SETTINGS_API_PRESETS', context)) {
        assert.match(preset.baseUrl, /^https:\/\//, preset.name);
        assert.match(preset.keyUrl, /^https:\/\//, preset.name);
    }
    context.renderSettingsApiPresets(true);
    const box = body.children[0];
    nodes.set('api-edit-presets', box);
    assert.equal(box.id, 'api-edit-presets');
    assert.equal(box.hidden, false);
    assert.match(box.innerHTML, /data-api-preset="deepseek"/);

    context.applySettingsApiPreset('deepseek');
    assert.equal(nodes.get('api-edit-name').value, 'DeepSeek');
    assert.equal(nodes.get('api-edit-url').value, 'https://api.deepseek.com');
    assert.deepEqual(urlInputs, ['https://api.deepseek.com'], 'the form reacts as if the address was typed');
    assert.match(box.guide.innerHTML, /href="https:\/\/platform\.deepseek\.com\/api_keys"[^>]*target="_blank"/);
    assert.equal(nodes.get('api-edit-key').focused, true, 'the key field is next');

    context.applySettingsApiPreset('siliconflow');
    assert.equal(nodes.get('api-edit-name').value, '硅基流动', 'a preset name is replaced by the next preset');
    nodes.get('api-edit-name').value = '我的聊天';
    context.applySettingsApiPreset('moonshot');
    assert.equal(nodes.get('api-edit-name').value, '我的聊天', 'a name the user typed is kept');

    context.renderSettingsApiPresets(false);
    assert.equal(box.hidden, true, 'editing an existing API hides the presets');
    assert.match(read('apps/settings/api-edit.js'), /renderSettingsApiPresets\(!editId\);/);
});

function streamingHarness({ api = null, apis = [] } = {}) {
    const room = element();
    room.querySelector = selector => selector === '.wc-api-guide' ? room.children.find(child => child.className === 'wc-api-guide') || null : null;
    const calls = [];
    const context = vm.createContext({
        window: { currentChatCharId: 'c1' },
        document: { getElementById: id => id === 'wechat-chat-room' ? room : null, createElement: tag => element(tag), addEventListener() {}, removeEventListener() {} },
        getDefaultApi: () => api,
        getApiData: () => ({ apis }),
        openApp: name => calls.push('openApp:' + name),
        openApiModal: () => calls.push('openApiModal')
    });
    context.window.openSettingsTab = tab => calls.push('tab:' + tab);
    vm.runInContext(read('apps/wechat/chat/streaming.js'), context);
    return { context, room, calls };
}

test('without an API the reply button opens a setup guide instead of saving an error as the character', async () => {
    const h = streamingHarness();
    const char = { id: 'c1', history: [{ type: 'text', isMe: true, content: '你好' }] };
    await h.context.triggerAiAfterMessage(char, null);
    assert.equal(char.history.length, 1, 'no warning bubble is stored in the chat');
    assert.equal(h.context.window._wechatAiBusy, undefined, 'the chat is not left busy');
    const guide = h.room.children.find(child => child.className === 'wc-api-guide');
    assert.ok(guide, 'the guide is shown');
    assert.equal(guide.attributes.role, 'dialog');
    assert.match(guide.innerHTML, /去设置 API/);

    guide.listeners.click[0]({ target: { closest: () => ({ dataset: { apiGuide: 'setup' } }) } });
    assert.deepEqual(h.calls, ['openApp:settings', 'tab:api', 'openApiModal'], 'with no API yet, the add form opens directly');
    assert.equal(h.room.children.includes(guide), false, 'the guide closes');

    const background = streamingHarness();
    await background.context.triggerAiAfterMessage({ id: 'c1', history: [] }, null, { background: true });
    assert.equal(background.room.children.length, 0, 'background replies stay silent');

    const elsewhere = streamingHarness();
    elsewhere.context.window.currentChatCharId = 'other';
    await elsewhere.context.triggerAiAfterMessage({ id: 'c1', history: [] }, null);
    assert.equal(elsewhere.room.children.length, 0, 'no guide over a different chat');
});

test('the setup guide goes to the API list when one already exists', () => {
    const h = streamingHarness({ apis: [{ id: 'a' }] });
    h.context.showWechatMissingApiGuide();
    h.room.children[0].listeners.click[0]({ target: { closest: () => ({ dataset: { apiGuide: 'setup' } }) } });
    assert.deepEqual(h.calls, ['openApp:settings', 'tab:api']);
});

test('the first send shows a one-time hint pointing at the reply button', () => {
    const room = element();
    const button = element();
    room.getBoundingClientRect = () => ({ top: 0, right: 375, bottom: 812, left: 0 });
    room.querySelector = selector => selector === '.wc-ai-btn' ? button : selector === '.wc-reply-hint' ? room.children.find(child => child.className === 'wc-reply-hint') || null : null;
    const storage = memoryStorage({});
    const timers = [];
    const context = vm.createContext({
        localStorage: storage,
        document: {
            getElementById: id => id === 'wechat-chat-room' ? room : null,
            createElement: tag => { const node = element(tag); node.querySelector = () => node.closeButton = node.closeButton || element('button'); return node; },
            querySelectorAll: selector => selector === '.wc-reply-hint' ? room.children.filter(child => child.className === 'wc-reply-hint') : []
        },
        setTimeout: fn => { timers.push(fn); return timers.length; },
        clearTimeout: () => {}
    });
    vm.runInContext(read('apps/wechat/chat/send.js'), context);
    context.maybeShowWechatReplyHint();
    const hint = room.children[0];
    assert.equal(hint.className, 'wc-reply-hint');
    assert.match(hint.innerHTML, /点 ✨ 让 Ta 回复/);
    assert.equal(hint.style.right, '9px');
    assert.equal(hint.style.bottom, '122px', 'the hint sits just above the button');
    assert.equal(storage.getItem('bynd_wechat_reply_hint_seen_v1'), '1');

    context.dismissWechatReplyHint();
    assert.equal(room.children.length, 0);
    context.maybeShowWechatReplyHint();
    assert.equal(room.children.length, 0, 'it is only shown once');
    assert.match(read('apps/wechat/chat/reply.js'), /async function triggerAiReply\(\) \{\s+if \(typeof dismissWechatReplyHint === 'function'\) dismissWechatReplyHint\(\);/);
});
