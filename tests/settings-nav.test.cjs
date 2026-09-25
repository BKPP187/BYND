const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, sourceSection, memoryStorage } = require('./helpers/harness.cjs');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const settingsWindow = sourceSection('index.html', '<div id="app-settings-window"', '<div id="api-edit-modal"');
const attrs = (source, name) => Array.from(source.matchAll(new RegExp(`${name}="([^"]+)"`, 'g')), match => match[1]);
const panelSource = name => {
    const start = settingsWindow.indexOf(`data-settings-panel="${name}"`);
    assert.ok(start >= 0, `panel ${name} exists`);
    const next = settingsWindow.indexOf('data-settings-panel="', start + 1);
    return settingsWindow.slice(start, next < 0 ? undefined : next);
};

test('every settings panel has exactly one nav tab and vice versa', () => {
    const panels = attrs(settingsWindow, 'data-settings-panel');
    const tabs = attrs(settingsWindow, 'data-settings-tab');
    assert.ok(panels.length >= 6);
    assert.deepEqual([...tabs].sort(), [...panels].sort());
    assert.equal(new Set(panels).size, panels.length);
    for (const name of panels) {
        assert.match(settingsWindow, new RegExp(`id="settings-tab-${name}"[^>]*data-settings-panel="${name}"`));
        assert.match(settingsWindow, new RegExp(`data-settings-tab="${name}"[^>]*aria-controls="settings-tab-${name}"`));
    }
    const navEnd = settingsWindow.indexOf('</nav>');
    assert.ok(settingsWindow.indexOf('class="set-nav"') < navEnd && navEnd < settingsWindow.indexOf('class="window-content"'),
        'nav sits between the window header and the scrolling content');
});

test('existing settings markup keeps its ids inside the matching panel', () => {
    assert.match(panelSource('api'), /id="api-route-panel"[\s\S]*id="api-list-container"[\s\S]*onclick="openApiModal\(\)"/);
    assert.match(panelSource('voice'), /id="api-voice-route-panel"/);
    assert.match(panelSource('decision'), /id="bynd-jev-settings"/);
    assert.match(panelSource('tools'), /<div id="bynd-tools-settings"><\/div>/);
    assert.match(panelSource('notify'), /id="notify-enabled"[\s\S]*id="notify-interval"/);
    assert.match(panelSource('font'), /id="font-select"[\s\S]*id="font-file-input"/);
    assert.match(panelSource('data'), /onclick="exportAllData\(\)"[\s\S]*id="import-data-file"[\s\S]*clearInvalidCache\(\)/);
    for (const id of ['api-route-panel', 'bynd-jev-settings', 'bynd-tools-settings', 'notify-enabled', 'font-select', 'import-data-file']) {
        assert.equal(html.split(`id="${id}"`).length, 2, `${id} stays unique`);
    }
});

test('usage tab has a live dashboard mount instead of an empty promise', () => {
    const usage = panelSource('usage');
    assert.match(settingsWindow, /id="settings-tab-usage" data-settings-panel="usage"/);
    assert.match(usage, /<div id="bynd-usage-dashboard"><\/div>/);
    assert.doesNotMatch(usage, /即将上线/);
    assert.match(fs.readFileSync(path.join(root, 'settings.js'), 'utf8'), /if \(target === 'usage'\) void renderSettingsUsageDashboard\(\)/);
});

function fakeSettingsWindow(names) {
    const el = (dataset, extra = {}) => ({
        dataset, hidden: false, tabIndex: 0, offsetLeft: 0, offsetWidth: 60, attributes: {},
        classList: { values: new Set(), toggle(name, on) { on ? this.values.add(name) : this.values.delete(name); }, contains(name) { return this.values.has(name); } },
        setAttribute(key, value) { this.attributes[key] = value; },
        ...extra
    });
    const panels = names.map(name => el({ settingsPanel: name }));
    const tabs = names.map(name => el({ settingsTab: name }));
    const content = { scrollTop: 120 };
    const nav = { clientWidth: 360, scrolls: [], scrollTo(options) { this.scrolls.push(options); } };
    const win = {
        querySelectorAll: selector => selector === '[data-settings-panel]' ? panels : selector === '[data-settings-tab]' ? tabs : [],
        querySelector: selector => selector === '.window-content' ? content : selector === '.set-nav' ? nav : null
    };
    return { win, panels, tabs, content, nav };
}

function runTabNav(entries = {}) {
    const localStorage = memoryStorage(entries);
    const dom = fakeSettingsWindow(['api', 'voice', 'decision', 'tools', 'notify', 'font', 'data', 'usage']);
    const context = vm.createContext({
        window: {}, localStorage,
        document: { getElementById: id => id === 'app-settings-window' ? dom.win : null }
    });
    vm.runInContext(sourceSection('settings.js', '// --- Settings tab navigation ---', '// --- /Settings tab navigation ---'), context);
    return { context, localStorage, dom };
}

test('tab switching shows one panel, resets scroll and persists to bynd_settings_tab_v1', () => {
    const { context, localStorage, dom } = runTabNav();
    assert.equal(context.readSettingsTab(), 'api', 'defaults to the API tab');
    assert.equal(context.window.openSettingsTab, context.openSettingsTab, 'exposed on window');

    assert.equal(context.window.openSettingsTab('notify'), 'notify');
    assert.deepEqual(dom.panels.filter(panel => !panel.hidden).map(panel => panel.dataset.settingsPanel), ['notify']);
    const active = dom.tabs.filter(tab => tab.classList.contains('active'));
    assert.deepEqual(active.map(tab => tab.dataset.settingsTab), ['notify']);
    assert.equal(active[0].attributes['aria-selected'], 'true');
    assert.equal(dom.content.scrollTop, 0);
    assert.deepEqual(localStorage.writes.at(-1), ['bynd_settings_tab_v1', 'notify']);
    assert.equal(context.readSettingsTab(), 'notify');

    assert.equal(context.openSettingsTab('missing-tab'), 'api', 'unknown tabs fall back to API');
    const writes = localStorage.writes.length;
    context.openSettingsTab('data', { persist: false });
    assert.equal(localStorage.writes.length, writes, 'restoring on open does not rewrite storage');
});

test('opening settings restores the stored tab', () => {
    const { context } = runTabNav({ bynd_settings_tab_v1: 'font' });
    assert.equal(context.readSettingsTab(), 'font');
    const initSettings = sourceSection('settings.js', 'function initSettings()', '// --- Settings tab navigation ---');
    assert.match(initSettings, /openSettingsTab\(readSettingsTab\(\), \{ persist: false/);
    assert.match(initSettings, /window\.ByndCharacterTools\?\.renderSettings\(\)/);
    assert.match(fs.readFileSync(path.join(root, 'modules/monitor/pet-studio.js'), 'utf8'), /openApp\('settings'\); window\.openSettingsTab\?\.\('api'\)/);
});
