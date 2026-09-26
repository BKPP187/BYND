const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('photo-header contrast stays in the BYND default theme and QQ keeps its own layout', () => {
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    const themeOverrides = fs.readFileSync(path.join(root, 'apps/wechat/ui/base-overrides.css'), 'utf8');
    assert.match(css, /#app-wechat-window\.wc-ui-theme-bynd \.wc-chat-room\.has-custom-chat-bg \.wc-float-back/);
    assert.doesNotMatch(css, /#app-wechat-window\[class\*="wc-ui-theme-"\] \.wc-chat-room\.has-custom-chat-bg \.wc-float-back/);
    assert.match(css, /wc-ui-theme-qq \.wc-chat-room \.wc-rich-input\s*\{[\s\S]*?grid-column: 1 \/ 5 !important;/);
    assert.match(themeOverrides, /wc-ui-theme-claude[\s\S]*?has-custom-chat-bg[\s\S]*?background: rgba\(255, 253, 249, 0\.90\) !important/);
    assert.match(themeOverrides, /wc-ui-theme-claude[\s\S]*?has-custom-chat-bg[\s\S]*?\.msg-text[\s\S]*?color: inherit !important/);
});

test('status ticket uses a concise generating label', () => {
    const source = fs.readFileSync(path.join(root, 'wechat.js'), 'utf8');
    assert.match(source, /generating \? '正在生成中'/);
    assert.doesNotMatch(source, /正在整理角色此刻想说但还没说出口的话/);
});

test('automatic reply follow-ups do not request status and memory in the same turn', () => {
    const source = fs.readFileSync(path.join(root, 'wechat.js'), 'utf8');
    assert.match(source, /const statusRequestWillRun = !skipStatus && shouldDeferWechatMemoryAfterReply\(char\);/);
    assert.match(source, /if \(statusRequestWillRun && context\.webSearched && turn\?\.memory === true\)/);
    assert.match(source, /void statusJob\?\.then\(\(\) => scheduleWechatMemoryExtraction\(char, 'web_search'\)\)/);
    assert.match(source, /else if \(!statusRequestWillRun && turn\?\.memory !== false\)/);
});

test('status snapshots are compact, while the generating receipt keeps its real failure reason', () => {
    const source = fs.readFileSync(path.join(root, 'wechat.js'), 'utf8');
    assert.match(source, /getWechatCharacterPersonaText\(char, 3000\)/);
    assert.match(source, /buildWechatRecentHistoryForPrompt\(char, 12\)/);
    assert.match(source, /max_tokens: 2200 \+ attempt \* 400/);
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

test('Rednote and WeChat composers keep compact controls while voice transcription stays available', () => {
    const rednote = fs.readFileSync(path.join(root, 'apps/wechat/ui/reference-themes.css'), 'utf8');
    const themeOverrides = fs.readFileSync(path.join(root, 'apps/wechat/ui/base-overrides.css'), 'utf8');
    const source = fs.readFileSync(path.join(root, 'wechat.js'), 'utf8');
    assert.match(rednote, /wc-ui-theme-rednote[\s\S]*?\.wc-input\s*\{[\s\S]*?font-size: 14px !important;[\s\S]*?font-weight: 650 !important;/);
    assert.match(themeOverrides, /WeChat hold-to-transcribe overlay[\s\S]*?\.wc-room-footer\s*\{[\s\S]*?height: 56px !important;[\s\S]*?gap: 7px !important;/);
    assert.match(themeOverrides, /wc-ui-theme-wechat[\s\S]*?\.wc-rich-input\s*\{[\s\S]*?height: 32px !important;[\s\S]*?font-size: 15px !important;/);
    assert.match(themeOverrides, /wc-ui-theme-wechat[\s\S]*?\.wc-voice-btn,[\s\S]*?\.wc-add-btn\s*\{[\s\S]*?width: 28px !important;/);
    assert.match(themeOverrides, /\.wc-hold-voice-overlay\s*\{/);
    assert.match(themeOverrides, /\.wc-hold-voice-transcript\s*\{[\s\S]*?font-size: clamp\(16px, 4\.6vw, 20px\);/);
    assert.match(themeOverrides, /\.wc-hold-voice-prompt\s*\{[\s\S]*?font-size: 14px;/);
    assert.match(themeOverrides, /\.wc-hold-voice-actions button\s*\{[\s\S]*?font-size: 15px;/);
    assert.match(source, /微信主题的输入框始终保持可编辑：[\s\S]*?const nextActive = useDirectHold \? false : !!active;/);
    assert.match(source, /function toggleWechatVoiceInputMode\(force\) \{[\s\S]*?if \(isWechatNativeVoiceTheme\(\)\) \{[\s\S]*?setWechatVoiceInputMode\(false, \{ keepDraft: true \}\);/);
    assert.match(source, /else if \(isWechatNativeVoiceTheme\(\) && surface\) \{[\s\S]*?surface\.dataset\.placeholder = getWechatChatInputPlaceholder\(\);/);
    assert.match(source, /function handleWechatVoiceInputPointerMove\(event\) \{[\s\S]*?deltaX >= 72[\s\S]*?editRequested \? '松开 编辑' : '松手 发送'/);
    assert.match(source, /finishWechatHoldVoice\(event, hold\?\.editRequested \? \{ edit: true \} : undefined\);/);
    assert.match(source, /startX: event\?\.clientX \?\? null,[\s\S]*?startY: event\?\.clientY \?\? null,/);
    assert.match(source, /clientX: pending\.startX, clientY: pending\.startY/);
    assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /id="wc-rich-msg-input"[\s\S]*?onpointermove="handleWechatVoiceInputPointerMove\(event\)"/);
});

test('inline emoji and Android backups use native representations instead of leaking markers or fake downloads', () => {
    const source = fs.readFileSync(path.join(root, 'wechat.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    const settings = fs.readFileSync(path.join(root, 'apps/settings/settings.js'), 'utf8');
    const activity = fs.readFileSync(path.join(root, 'android/app/src/main/java/cc/ccwu/bynd/MainActivity.java'), 'utf8');
    assert.match(source, /renderWechatAiPhoneInlineEmojiHtml/);
    assert.match(source, /wc-ai-phone-inline-emoji/);
    assert.match(css, /\.msg-bubble\.wechat-emoji-text \.wc-inline-wechat-emoji/);
    assert.match(settings, /bridge\.beginBackupExport/);
    assert.match(settings, /bridge\.appendBackupExportChunk/);
    assert.match(settings, /accepted !== true && accepted !== 'true'/);
    assert.match(settings, /bynd:backup-export/);
    assert.match(activity, /Intent\.ACTION_CREATE_DOCUMENT/);
    assert.match(activity, /BACKUP_EXPORT_REQUEST/);
    assert.match(activity, /appendBackupExportChunk/);
    assert.match(activity, /public boolean appendBackupExportChunk/);
    assert.match(activity, /return MainActivity\.this\.appendBackupExportChunk\(id, base64Chunk\)/);
});
