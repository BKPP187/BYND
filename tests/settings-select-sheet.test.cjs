const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { root } = require('./helpers/harness.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const layout = require(path.join(root, 'scripts/source-layout.cjs'));

test('sheet picker loads before the settings code that enhances selects', () => {
    const sheet = html.indexOf('apps/settings/select-sheet.js');
    const fonts = html.indexOf('apps/settings/fonts.js');
    assert.ok(sheet > 0 && sheet < fonts, 'select-sheet.js is loaded before fonts.js');
    const parts = layout.settingsParts;
    assert.ok(parts.indexOf('apps/settings/select-sheet.js') >= 0 && parts.indexOf('apps/settings/select-sheet.js') < parts.indexOf('apps/settings/fonts.js'));
});

test('font and call-voice pickers use the sheet instead of the native popup', () => {
    const fonts = read('apps/settings/fonts.js');
    assert.match(fonts, /ByndSheetSelect\?\.enhance\(select, \{ title: '选择字体', optionStyle: fontPreviewStyle \}\)/);
    const voice = read('apps/wechat/chat/call-voice.js');
    assert.match(voice, /enhance\(root\.querySelector\('#call-voice-engine'\)/);
    assert.match(voice, /enhance\(select, \{ title: '转写接口' \}\)/);
    const sheet = read('apps/settings/select-sheet.js');
    assert.match(sheet, /dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/, 'choosing fires the native change handler');
    assert.match(sheet, /new MutationObserver/, 'label follows re-rendered options');
});

test('silence delay field states its unit and spells out the doubling', () => {
    assert.match(html, /<div class="call-voice-unit"><input id="call-voice-silence"[^>]*><span aria-hidden="true">秒<\/span><\/div>/);
    assert.match(html, /id="call-voice-silence-hint"/);
    assert.match(read('apps/wechat/chat/call-voice.js'), /安静 \$\{first\} 秒后角色开口；你还没回应，就再等 \$\{first \* 2\} 秒、\$\{first \* 4\} 秒/);
});
