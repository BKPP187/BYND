const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { sourceSection } = require('./helpers/harness.cjs');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const themeWindow = html.slice(html.indexOf('<div id="app-theme-window"'), html.indexOf('<div id="app-worldbook-window"'));

test('personalization home tiles cover every settings card exactly', () => {
    const tiles = [...themeWindow.matchAll(/data-theme-open="([a-z]+)"/g)].map(match => match[1]);
    const cards = [...themeWindow.matchAll(/<div class="setting-card"( data-theme-section="([a-z]+)")?>/g)];
    assert.equal(cards.length, 9);
    assert.ok(cards.every(card => card[2]), 'every card belongs to a section');
    assert.deepEqual([...new Set(cards.map(card => card[2]))].sort(), [...tiles].sort());
    assert.equal(tiles.length, 6, 'six tiles fill a three-row two-column grid');
    assert.match(themeWindow, /onclick="handleThemeHeaderBack\(\)"/);
});

function sectionHarness() {
    const node = (extra = {}) => ({ hidden: false, textContent: '', innerHTML: '', attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }, ...extra });
    const cards = ['wallpaper', 'library', 'effects', 'lock', 'lock', 'desktop', 'desktop', 'lock', 'icons'].map(key => node({ dataset: { themeSection: key } }));
    const classes = new Set();
    const content = node({ scrollTop: 300 });
    const win = { classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) }, querySelectorAll: () => cards, querySelector: () => content };
    const ids = { 'app-theme-window': win, 'theme-home': node(), 'theme-header-title': node(), 'theme-header-back': node() };
    const closed = [];
    const context = vm.createContext({
        window: {}, Promise, localStorage: { getItem: () => null },
        document: { getElementById: id => ids[id] || null, querySelector: () => null },
        closeApp: name => closed.push(name), updateThemeHomeSummaries() {}
    });
    vm.runInContext(sourceSection('ui/theme/theme.js', '// --- 个性化设置：宫格首页 + 二级页 ---', '// Short live summaries'), context);
    return { context, cards, classes, ids, content, closed };
}

test('opening a section shows only its cards and the back button returns home first', () => {
    const h = sectionHarness();
    assert.equal(h.context.openThemeSection('lock'), true);
    assert.deepEqual(h.cards.filter(card => !card.hidden).map(card => card.dataset.themeSection), ['lock', 'lock', 'lock']);
    assert.equal(h.ids['theme-home'].hidden, true);
    assert.equal(h.ids['theme-header-title'].textContent, '锁屏');
    assert.match(h.ids['theme-header-back'].innerHTML, /返回/);
    assert.equal(h.content.scrollTop, 0);
    assert.ok(h.classes.has('theme-section-open'));
    h.context.handleThemeHeaderBack();
    assert.equal(h.closed.length, 0, 'first back returns to the grid');
    assert.equal(h.ids['theme-home'].hidden, false);
    assert.ok(h.cards.every(card => card.hidden));
    assert.equal(h.ids['theme-header-title'].textContent, '个性化设置');
    h.context.handleThemeHeaderBack();
    assert.deepEqual(h.closed, ['theme']);
});

test('unknown section names fall back to the home grid', () => {
    const h = sectionHarness();
    h.context.openThemeSection('__proto__');
    assert.equal(h.ids['theme-home'].hidden, false);
    assert.ok(!h.classes.has('theme-section-open'));
});

test('opening the theme app always starts on the grid', () => {
    const router = fs.readFileSync(path.join(root, 'core/navigation/router.js'), 'utf8');
    assert.match(router, /loadSavedSettings\(\);\r?\n\s+if \(typeof openThemeSection === 'function'\) openThemeSection\(''\);/);
});
