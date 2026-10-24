const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { root } = require('./helpers/harness.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('link card text gets the whole row instead of the 50px icon column (every theme)', () => {
    const css = read('apps/wechat/chat/toolbar.css');
    assert.match(css, /\.msg-link-card \.msg-link-main \{\s*grid-column: 1 \/ -1;\s*display: flex;/);
});

test('money cards follow one theme-aware rule set', () => {
    const css = read('apps/wechat/ui/pay-cards.css');
    const layout = require(path.join(root, 'scripts/source-layout.cjs'));
    assert.equal(layout.styleParts.at(-1), 'apps/wechat/ui/pay-cards.css', 'loaded after every theme sheet');
    assert.match(read('ui/theme/style.css'), /pay-cards\.css\?v=[\d.]+"\);\s*$/, 'last import in style.css');
    // pending cards: gradient on both sides, white text
    assert.match(css, /\.msg-transfer-bubble:not\(\.msg-pay-receipt\):not\(\.msg-pay-returned\) \{ background: var\(--pay-transfer-bg\) !important; \}/);
    assert.match(css, /\.msg-redpacket-bubble:not\(\.msg-pay-receipt\):not\(\.msg-pay-returned\) \{ background: var\(--pay-redpacket-bg\) !important; \}/);
    // neutral states read the active theme's own colours
    assert.match(css, /background: var\(--wci-surface, #fff\) !important;/);
    assert.match(css, /--pay-quiet-text: color-mix\(in srgb, var\(--wci-text/);
    // hand-made themes are left alone except the invisible 亲密付 note
    assert.match(css, /:not\(\[data-wechat-ui-theme="pixel"\]\):not\(\[data-wechat-ui-theme="couple"\]\)/);
    assert.match(css, /\[data-wechat-ui-theme="claude"\] \{\s*--pay-transfer-bg/, 'Claude tunes the palette through variables');
    const themes = read('apps/wechat/ui/reference-themes.css');
    assert.doesNotMatch(themes, /wc-ui-theme-(?:claude|line) #wechat-chat-room \.msg-row \.msg-bubble\.msg-transfer-bubble/, 'no per-theme card state patches left behind');
    assert.match(themes, /wc-ui-theme-claude #wechat-chat-room \.msg-row\.left \.msg-voice-bubble/, 'character voice messages get a pill');
    assert.match(themes, /wc-ui-theme-claude :is\(\.wc-discover-icon, \.wc-me-menu-icon\) \{ stroke: #5c5650/, 'one ink colour for menu icons');
});

test('settings editors open as full pages without a grey mask', () => {
    const css = read('apps/settings/settings-layout.css');
    const ids = ['api-edit-modal', 'api-voice-modal', 'api-openai-voice-modal', 'api-novelai-image-modal', 'api-fish-voice-modal', 'api-elevenlabs-voice-modal', 'api-local-voice-modal'];
    const html = read('index.html');
    for (const id of ids) {
        assert.match(html, new RegExp(`id="${id}" class="wc-modal-overlay`), `${id} exists`);
        assert.ok(css.includes(`#${id}`), `${id} is covered`);
    }
    assert.match(css, /background: #f2f2f4 !important;\s*backdrop-filter: none !important;/);
});
