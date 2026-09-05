const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');
const style = fs.readFileSync('style.css', 'utf8');
const wechat = fs.readFileSync('wechat.js', 'utf8');

assert.ok(!html.includes('bynd-startup-wordmark-edge'), 'startup logo must not render a cursor-like edge');
assert.ok(!style.includes('bynd-startup-edge-tension'), 'removed startup edge animation must not remain');
assert.ok(html.indexOf('<div class="phone-container">') < html.indexOf('id="bynd-startup"'), 'startup must be inside the phone frame');
assert.match(style, /\.bynd-startup\s*\{[^}]*position:\s*absolute;/s, 'startup must be constrained to the phone frame');
assert.match(html, /id="startup-enabled"/, 'theme settings must expose a startup toggle');
assert.match(script, /themeData\.startupEnabled !== false/, 'disabled startup preference must skip the animation');
assert.match(fs.readFileSync('theme.js', 'utf8'), /startupEnabled:\s*getThemeCheckbox\('startup-enabled'\)/, 'theme save must retain the startup preference');
assert.ok(!wechat.includes('class="wc-ai-phone-edit-home"'), 'phone header edit button must stay removed');
assert.match(wechat, /key: 'settings', label: '设置'/, 'phone must expose a settings app');
assert.match(wechat, /activeTab === 'settings'/, 'phone settings app must render a page');
assert.match(wechat, /'games', 'settings'/, 'phone router must allow the settings app');
assert.match(style, /\.wc-ai-phone-photo-strip\s*\{[^}]*margin-top:\s*52px;/s, 'photo strip must clear the center avatar');
assert.match(script, /const previewText = record\.summary \|\| record\.text \|\| '';/, 'legacy dream text must render in previews');

console.log('ui regression tests passed');
