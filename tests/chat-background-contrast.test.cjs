const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sourceSection } = require('./helpers/harness.cjs');

const root = path.resolve(__dirname, '..');

test('chat photo controls choose white on dark pixels and black on light pixels', () => {
    const context = vm.createContext({});
    vm.runInContext(sourceSection('wechat.js', 'function getWechatChatForegroundTone(', 'function applyChatConfig('), context);
    assert.equal(context.getWechatChatForegroundTone([30, 4, 2, 255]).color, '#ffffff');
    assert.equal(context.getWechatChatForegroundTone([248, 248, 248, 255]).color, '#111827');
    assert.equal(context.getWechatChatForegroundTone([95, 18, 12, 255]).color, '#ffffff');
});

test('chat photo control colours override theme defaults independently', () => {
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    assert.match(css, /--wc-chat-back-color, #fff\) !important/);
    assert.match(css, /--wc-chat-more-color, #fff\) !important/);
    assert.match(css, /--wc-chat-title-color, #fff\) !important/);
    assert.match(css, /--wc-chat-back-shadow/);
    assert.match(css, /--wc-chat-more-shadow/);
});
