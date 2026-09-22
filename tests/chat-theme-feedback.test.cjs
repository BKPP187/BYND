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

test('status snapshots are compact, while the generating receipt keeps its real failure reason', () => {
    const source = fs.readFileSync(path.join(root, 'wechat.js'), 'utf8');
    assert.match(source, /getWechatCharacterPersonaText\(char, 3000\)/);
    assert.match(source, /buildWechatRecentHistoryForPrompt\(char, 12\)/);
    assert.match(source, /max_tokens: 1200 \+ attempt \* 200/);
    assert.match(source, /stripWechatPromptText\(buildWechatWorldBookPrompt\(char\), 1800\)/);
});

test('voice mode stays in the composer, monitor text is bounded, and the poke helper is not shown to users', () => {
    const source = fs.readFileSync(path.join(root, 'wechat.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    assert.match(source, /if \(panel\) panel\.classList\.add\('hidden'\)/);
    assert.match(source, /stripWechatPromptText\(phrase, 72\)/);
    assert.doesNotMatch(html, /填写“的”后面的内容/);
    assert.match(css, /\.wc-message-island-text span\s*\{[\s\S]*?-webkit-line-clamp: 2/);
    assert.match(css, /\.wc-monitor-barrage span\s*\{[\s\S]*?white-space: normal/);
});

test('inline emoji and Android backups use native representations instead of leaking markers or fake downloads', () => {
    const source = fs.readFileSync(path.join(root, 'wechat.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    const settings = fs.readFileSync(path.join(root, 'settings.js'), 'utf8');
    const activity = fs.readFileSync(path.join(root, 'android/app/src/main/java/cc/ccwu/bynd/MainActivity.java'), 'utf8');
    assert.match(source, /renderWechatAiPhoneInlineEmojiHtml/);
    assert.match(source, /wc-ai-phone-inline-emoji/);
    assert.match(css, /\.msg-bubble\.wechat-emoji-text \.wc-inline-wechat-emoji/);
    assert.match(settings, /bridge\.exportBackup/);
    assert.match(settings, /bynd:backup-export/);
    assert.match(activity, /Intent\.ACTION_CREATE_DOCUMENT/);
    assert.match(activity, /BACKUP_EXPORT_REQUEST/);
});
