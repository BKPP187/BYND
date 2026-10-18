'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { sourceSection } = require('./helpers/harness.cjs');

const context = vm.createContext({});
vm.runInContext([
    sourceSection('apps/settings/api-test.js', 'function escapeHtml(', '// 获取当前默认 API'),
    sourceSection('ui/theme/theme.js', 'function themeEscapeHtml(', 'function normalizeThemeWidgetStyle('),
    sourceSection('apps/settings/api-list.js', 'function escapeJsString(', 'function toggleApiRouteMenu(')
].join('\n'), context);

test('settings and desktop HTML escaping protects quoted attributes as well as text', () => {
    for (const escape of [context.escapeHtml, context.themeEscapeHtml]) {
        assert.equal(escape('"\'&<>'), '&quot;&#39;&amp;&lt;&gt;');
        assert.equal(escape(null), '');
        assert.equal(escape(0), '0');
        assert.equal(escape('&quot;'), '&amp;quot;', 'literal entity text is not treated as markup');
        assert.equal(escape('中文与 emoji 🌱'), '中文与 emoji 🌱');
    }
});

test('inline settings handlers round-trip identifiers without executing identifier contents', () => {
    const identifiers = [
        'plain', '中文 🌱', '"\'\\\r\n\u2028\u2029', '&quot;&amp;&#39;',
        "'); attack(); //", 'broken" onerror="attack()', '<img src=x onerror=attack()>'
    ];
    const entities = { amp: '&', quot: '"', lt: '<', gt: '>' };
    for (const id of identifiers) {
        const escaped = context.escapeJsString(id);
        assert.doesNotMatch(escaped, /["<>\r\n\u2028\u2029]/, 'the double-quoted HTML attribute stays intact');
        // HTML parses entities once before the browser compiles an inline event handler.
        const decoded = escaped.replace(/&(amp|quot|lt|gt);/g, (_, name) => entities[name]);
        const handler = vm.createContext({ selected: null, attacked: false });
        vm.runInContext(`function capture(value) { selected = value; } function attack() { attacked = true; } capture('${decoded}');`, handler);
        assert.equal(handler.selected, id);
        assert.equal(handler.attacked, false);
    }
});
