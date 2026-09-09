const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');
const style = fs.readFileSync('style.css', 'utf8');
const wechat = fs.readFileSync('wechat.js', 'utf8');
const theme = fs.readFileSync('theme.js', 'utf8');

assert.doesNotMatch(html, /bynd-startup|startup-enabled|startupEnabled/, 'HTML must not render or enable the retired web splash');
assert.doesNotMatch(style, /bynd-startup-wordmark|bynd-startup-breathe/, 'retired splash animations must be removed');
assert.match(style, /#bynd-startup\s*\{\s*display:\s*none\s*!important;/, 'new CSS must hide splash markup in cached HTML');
assert.match(html, /data-bynd-core-style media="all"/, 'main styles must apply before the first application paint');
assert.doesNotMatch(theme, /startup-enabled|startupEnabled/, 'theme settings must not recreate the retired splash preference');
assert.match(html, /class="phone-container"/, 'the regular phone frame must remain');
assert.ok(!wechat.includes('class="wc-ai-phone-edit-home"'), 'phone header edit button must stay removed');
assert.match(wechat, /key: 'settings', label: '设置'/, 'phone must expose a settings app');
assert.match(wechat, /activeTab === 'settings'/, 'phone settings app must render a page');
assert.match(wechat, /'games', 'settings'/, 'phone router must allow the settings app');
const avatarBottom = Number(style.match(/\.wc-ai-phone-photo-avatar\s*\{[^}]*bottom:\s*(-?[\d.]+)px;/s)?.[1]);
const photoStripMargin = Number(style.match(/\.wc-ai-phone-photo-strip\s*\{[^}]*margin-top:\s*([\d.]+)px;/s)?.[1]);
assert.ok(Number.isFinite(avatarBottom) && Number.isFinite(photoStripMargin) && photoStripMargin + avatarBottom >= 12, 'photo strip must leave a visible gap below the center avatar');
assert.match(script, /const previewText = record\.summary \|\| record\.text \|\| '';/, 'legacy dream text must render in previews');
assert.match(style, /\.dream-topbar\s*\{[^}]*min-height:\s*calc\(64px\s*\+\s*var\(--bynd-header-safe-top,\s*env\(safe-area-inset-top,\s*0px\)\)\)/s, 'dream header height must include the unreserved iPhone safe area');
assert.match(style, /\.dream-topbar\s*\{[^}]*padding:\s*calc\(12px\s*\+\s*var\(--bynd-header-safe-top,\s*env\(safe-area-inset-top,\s*0px\)\)\)/s, 'dream header content must start below the unreserved safe area');
assert.match(style, /html\.mobile-runtime \.phone-container\s*\{\s*--bynd-header-safe-top:\s*0px;/, 'headers must not duplicate the safe area already reserved by the mobile body');

console.log('ui regression tests passed');
