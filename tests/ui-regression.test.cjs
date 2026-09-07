const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');
const style = fs.readFileSync('style.css', 'utf8');
const wechat = fs.readFileSync('wechat.js', 'utf8');
const startupStyle = html.match(/<style id="bynd-startup-styles">([\s\S]*?)<\/style>/)[1];

assert.ok(!html.includes('bynd-startup-wordmark-edge'), 'startup logo must not render a cursor-like edge');
assert.ok(!style.includes('bynd-startup-edge-tension'), 'removed startup edge animation must not remain');
assert.ok(html.indexOf('<div class="phone-container">') < html.indexOf('id="bynd-startup"'), 'startup must be inside the phone frame');
assert.match(startupStyle, /\.bynd-startup\s*\{[^}]*position:\s*absolute;/s, 'initial startup styles must constrain the loader to the phone frame');
assert.match(html, /id="startup-enabled"/, 'theme settings must expose a startup toggle');
assert.match(html, /savedTheme\.startupEnabled === false/, 'disabled startup preference must be read before application scripts download');
assert.match(startupStyle, /\.bynd-startup\s*\{[^}]*display:\s*none;/s, 'completed or disabled loading must not display an overlay');
assert.match(startupStyle, /\.bynd-startup-loading \.bynd-startup\s*\{\s*display:\s*grid;/, 'pending document loads must render without downloading external CSS first');
assert.match(html, /data-bynd-core-style media="print"/, 'main stylesheets must not block the loading shell from painting');
assert.ok(!script.includes('BYND_STARTUP_STORAGE_KEY'), 'startup must not replay from a first-visit marker');
assert.match(script, /window\.__byndCoreReady\.then\(\(\) => byndStartupController\.markReady\(\)/, 'core initialization must dismiss loading when ready');
assert.match(fs.readFileSync('theme.js', 'utf8'), /startupEnabled:\s*getThemeCheckbox\('startup-enabled'\)/, 'theme save must retain the startup preference');
assert.ok(!wechat.includes('class="wc-ai-phone-edit-home"'), 'phone header edit button must stay removed');
assert.match(wechat, /key: 'settings', label: '设置'/, 'phone must expose a settings app');
assert.match(wechat, /activeTab === 'settings'/, 'phone settings app must render a page');
assert.match(wechat, /'games', 'settings'/, 'phone router must allow the settings app');
assert.match(style, /\.wc-ai-phone-photo-strip\s*\{[^}]*margin-top:\s*52px;/s, 'photo strip must clear the center avatar');
assert.match(script, /const previewText = record\.summary \|\| record\.text \|\| '';/, 'legacy dream text must render in previews');
assert.match(style, /\.dream-topbar\s*\{[^}]*min-height:\s*calc\(64px\s*\+\s*var\(--bynd-header-safe-top,\s*env\(safe-area-inset-top,\s*0px\)\)\)/s, 'dream header height must include the unreserved iPhone safe area');
assert.match(style, /\.dream-topbar\s*\{[^}]*padding:\s*calc\(12px\s*\+\s*var\(--bynd-header-safe-top,\s*env\(safe-area-inset-top,\s*0px\)\)\)/s, 'dream header content must start below the unreserved safe area');
assert.match(style, /html\.mobile-runtime \.phone-container\s*\{\s*--bynd-header-safe-top:\s*0px;/, 'headers must not duplicate the safe area already reserved by the mobile body');

console.log('ui regression tests passed');
