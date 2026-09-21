const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('photo-header contrast stays in the BYND default theme and QQ keeps its own layout', () => {
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    assert.match(css, /#app-wechat-window\.wc-ui-theme-bynd \.wc-chat-room\.has-custom-chat-bg \.wc-float-back/);
    assert.doesNotMatch(css, /#app-wechat-window\[class\*="wc-ui-theme-"\] \.wc-chat-room\.has-custom-chat-bg \.wc-float-back/);
    assert.match(css, /wc-ui-theme-qq \.wc-chat-room \.wc-rich-input\s*\{[\s\S]*?grid-column: 1 \/ 5 !important;/);
});

test('status ticket uses a concise generating label', () => {
    const source = fs.readFileSync(path.join(root, 'wechat.js'), 'utf8');
    assert.match(source, /generating \? '正在生成中'/);
    assert.doesNotMatch(source, /正在整理角色此刻想说但还没说出口的话/);
});

test('automatic reply follow-ups do not request status and memory in the same turn', () => {
    const source = fs.readFileSync(path.join(root, 'wechat.js'), 'utf8');
    assert.match(source, /const statusRequestWillRun = shouldDeferWechatMemoryAfterReply\(char\);/);
    assert.match(source, /if \(!statusRequestWillRun\) scheduleWechatMemoryExtraction\(char, 'after_reply'\);/);
});
