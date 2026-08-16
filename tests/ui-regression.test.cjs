const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');
const style = fs.readFileSync('style.css', 'utf8');
const wechat = fs.readFileSync('wechat.js', 'utf8');

assert.ok(!html.includes('bynd-startup-wordmark-edge'), 'startup logo must not render a cursor-like edge');
assert.ok(!style.includes('bynd-startup-edge-tension'), 'removed startup edge animation must not remain');
assert.ok(!wechat.includes('class="wc-ai-phone-edit-home"'), 'phone header edit button must stay removed');
assert.match(wechat, /key: 'settings', label: '设置'/, 'phone must expose a settings app');
assert.match(wechat, /activeTab === 'settings'/, 'phone settings app must render a page');
assert.match(wechat, /'games', 'settings'/, 'phone router must allow the settings app');
assert.match(style, /\.wc-ai-phone-photo-strip\s*\{[^}]*margin-top:\s*52px;/s, 'photo strip must clear the center avatar');
assert.match(script, /const previewText = record\.summary \|\| record\.text \|\| '';/, 'legacy dream text must render in previews');

console.log('ui regression tests passed');
