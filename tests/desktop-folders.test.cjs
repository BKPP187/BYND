'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const { sourceSection } = require('./helpers/harness.cjs');
test('saved folder members cannot reappear as loose icons while repairing a legacy layout', () => {
    const context = vm.createContext({
        window: { _folders: [{ apps: [{ id: 'living-world' }, { id: 'comic' }, 'monitor'] }] },
        isDesktopStaticPage2AppLayoutId: () => false, DESKTOP_CUSTOM_WIDGET_KINDS: new Set(['lovely']), DESKTOP_DEFAULT_PRINCESS_ID: 'princess'
    });
    vm.runInContext(sourceSection('ui/components/desktop-edit.js', 'function getDesktopFolderAppIds(', 'function hasDesktopMeasurableLayoutCanvas('), context);
    const records = ['app-living-world', 'app-comic', 'app-monitor', 'app-mcp', 'folder-one', 'custom-photo', 'app-music'].map(id => ({ id, page: 1 }));
    const result = context.normalizeDesktopSavedLayoutItems(records, ['music']);
    assert.deepEqual(Array.from(result, record => record.id), ['app-mcp', 'folder-one', 'custom-photo']);
    assert.equal(records.length, 7, 'repair does not mutate the original save');
    context.window._folders = [];
    assert.equal(context.normalizeDesktopSavedLayoutItems(records).length, 7, 'loose icons stay available when no folder owns them');
});
