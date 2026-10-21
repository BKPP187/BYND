'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

// Mirrors the supplied v1.35 file's shape without copying third-party prompts.
const extensionsOnly = { extensions: { regex_scripts: [{ scriptName: 'display', findRegex: 'x', replaceString: '<div>display only</div>' }], SPreset: { RegexBinding: { regexes: [] } }, entryGrouping: [] } };
function harness(initial = { presets: [], activeId: null }) {
    const storage = new Map([['my_presets_data', JSON.stringify(initial)]]);
    const alerts = [];
    const container = { innerHTML: '' };
    let reader;
    const c = vm.createContext({
        window: {}, alert: text => alerts.push(text), confirm: () => true,
        document: { getElementById: id => id === 'preset-list-container' ? container : null },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        escapeHtml: value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
        escapeJsString: value => String(value),
        FileReader: class { constructor() { reader = this; } readAsText() {} }
    });
    vm.runInContext(fs.readFileSync('apps/settings/presets.js', 'utf8'), c);
    return { c, alerts, storage, container, import(json) {
        c.importPresetFile({ files: [{ name: 'sample.json' }], value: 'sample.json' });
        reader.onload({ target: { result: typeof json === 'string' ? json : JSON.stringify(json) } });
    }, failRead() {
        c.importPresetFile({ files: [{ name: 'sample.json' }], value: 'sample.json' });
        assert.equal(typeof reader.onerror, 'function'); reader.onerror();
    } };
}

test('extension exports retain their content for inspection without replacing the active chat preset', () => {
    const h = harness({ presets: [{ id: 'valid', name: 'Existing', prompts: [{ content: 'Keep me', enabled: true }] }], activeId: 'valid' });
    const parsed = h.c.parsePromptPreset(extensionsOnly, 'sample.json');
    assert.deepEqual(JSON.parse(JSON.stringify(parsed.extensions)), extensionsOnly.extensions);
    h.import(extensionsOnly);
    assert.equal(h.c.getActivePreset().id, 'valid');
    const saved = JSON.parse(h.storage.get('my_presets_data')).presets[1];
    assert.deepEqual(saved.extensions, extensionsOnly.extensions);
    assert.equal(saved.importSource.purpose, 'testing');
    assert.equal(saved.importSource.fileName, 'sample.json');
    assert.match(h.alerts[0], /可展开查看扩展内容/);
    assert.match(h.container.innerHTML, /regex_scripts/);
    assert.match(h.container.innerHTML, /&lt;div&gt;display only&lt;\/div&gt;/);
    assert.ok(!h.container.innerHTML.includes('<div>display only</div>'));
    assert.ok(!h.container.innerHTML.includes('0/0 prompts'));
    h.c.setActivePreset(saved.id);
    assert.equal(h.c.getActivePreset().id, 'valid');
    assert.match(h.alerts.at(-1), /扩展配置请展开查看/);
});

test('mixed exports preserve both prompts and extension data without merging extension text into prompts', () => {
    const h = harness();
    h.import({ ...extensionsOnly, prompts: [{ content: 'Main', enabled: true }] });
    const preset = h.c.getActivePreset();
    assert.equal(preset.prompts.length, 1);
    assert.equal(preset.prompts[0].content, 'Main');
    assert.deepEqual(JSON.parse(JSON.stringify(preset.extensions)), extensionsOnly.extensions);
});

test('extension-only replacement clears its own previous active record and keeps unrelated records', () => {
    const h = harness({ presets: [{ id: 'old', name: 'sample', prompts: [{ content: 'Old', enabled: true }] }, { id: 'other', name: 'Other', prompts: [{ content: 'Other', enabled: true }] }], activeId: 'old' });
    h.import(extensionsOnly);
    assert.equal(h.c.getActivePreset(), null);
    const data = JSON.parse(h.storage.get('my_presets_data'));
    assert.equal(data.activeId, null);
    assert.equal(data.presets[1].id, 'other');
    assert.deepEqual(data.presets[0].extensions, extensionsOnly.extensions);
});

test('complete exports keep all prompt text, disabled entries and sampling parameters', () => {
    const h = harness();
    const result = h.c.parsePromptPreset({ prompts: [
        { identifier: 'a', name: 'First', role: 'system', content: 'A\n{{char}}', enabled: true },
        { identifier: 'b', content: 'B', enabled: true }, { marker: true }, { content: 123 }
    ], prompt_order: [{ character_id: 100001, order: [{ identifier: 'a', enabled: true }, { identifier: 'b', enabled: false }] }], temperature: 0, openai_max_tokens: 4096 }, 'complete.json');
    assert.equal(result.prompts.length, 2);
    assert.equal(result.prompts[0].content, 'A\n{{char}}');
    assert.equal(result.prompts[1].enabled, false);
    assert.equal(result.temperature, 0);
    assert.equal(result.max_tokens, 4096);
    h.import({ prompts: [{ content: 'Complete prompt' }] });
    assert.equal(h.c.getActivePreset().prompts[0].content, 'Complete prompt');
    assert.match(h.alerts[0], /导入成功/);
    assert.equal(h.c.window._expandedPresetId, h.c.getActivePreset().id);
    assert.match(h.container.innerHTML, /1\/1 prompts/);
    h.c.togglePromptExpand(h.c.getActivePreset().id, 0);
    assert.match(h.container.innerHTML, /Complete prompt<\/textarea>/);
});

test('legacy presets and BOM-prefixed JSON remain importable', () => {
    const h = harness();
    h.import('\uFEFF' + JSON.stringify({ main_prompt: 'Main', jailbreak_prompt: 'Extra', nsfw_prompt: 'Style' }));
    assert.equal(h.c.getActivePreset().prompts.length, 3);
});

test('unsupported and malformed inputs do not save an empty record', () => {
    for (const json of [null, [], 'null', '{', {}, { prompts: [] }, { prompts: [{ content: '   ' }] }, { main_prompt: 7 }, { extensions: {} }, { extensions: [] }]) {
        const h = harness();
        const before = h.storage.get('my_presets_data');
        h.import(json);
        assert.equal(h.storage.get('my_presets_data'), before);
        assert.equal(h.alerts.length, 1);
        assert.ok(!h.alerts[0].includes('成功'));
    }
});

test('read and storage failures never report import success or replace active data', () => {
    const h = harness();
    const before = h.storage.get('my_presets_data');
    h.failRead();
    assert.match(h.alerts[0], /读取失败/);
    h.c.localStorage.setItem = () => { throw new Error('storage full'); };
    h.import({ main_prompt: 'Main' });
    assert.match(h.alerts[1], /storage full/);
    h.import(extensionsOnly);
    assert.match(h.alerts[2], /storage full/);
    assert.ok(!h.alerts.some(text => text.includes('成功')));
    assert.equal(h.storage.get('my_presets_data'), before);
});

test('previously imported empty presets explain recovery and cannot be activated', () => {
    const h = harness({ presets: [{ id: 'empty', name: 'Old empty export', prompts: [], temperature: 0.8 }], activeId: 'empty' });
    assert.equal(h.c.getActivePreset(), null);
    h.c.togglePresetExpand('empty');
    assert.match(h.container.innerHTML, /没有可查看的内容/);
    assert.match(h.container.innerHTML, /重新导入原文件/);
    assert.ok(!h.container.innerHTML.includes('0/0 prompts'));
    assert.ok(!h.container.innerHTML.includes("setActivePreset('empty')"));
    h.c.setActivePreset('empty');
    assert.equal(h.c.getActivePreset(), null);
    assert.match(h.alerts[0], /没有可启用的聊天提示词/);
});
