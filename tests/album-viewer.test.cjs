const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { sourceSection } = require('./helpers/harness.cjs');

function viewerContext() {
    const context = vm.createContext({ window: {}, Math, Number });
    vm.runInContext(sourceSection('apps/album/album.js', 'const ALBUM_VIEWER_MAX_SCALE', 'function openAlbumViewer('), context);
    return context;
}

test('album viewer zoom stays between fit and 4x', () => {
    const v = viewerContext();
    assert.equal(v.albumViewerClampScale(0.3), 1);
    assert.equal(v.albumViewerClampScale(2.2), 2.2);
    assert.equal(v.albumViewerClampScale(9), 4);
    assert.equal(v.albumViewerClampScale('bad'), 1);
});

test('album viewer pan cannot drag a zoomed photo off its frame', () => {
    const v = viewerContext();
    const box = { width: 300, height: 600 };
    assert.deepEqual({ ...v.albumViewerClampPan(500, -900, 2, box) }, { x: 150, y: -300 });
    assert.deepEqual({ ...v.albumViewerClampPan(40, 40, 1, box) }, { x: 0, y: 0 });
});

test('album viewer swipe moves one photo and never past the ends', () => {
    const v = viewerContext();
    assert.equal(v.albumViewerSwipeTarget(1, 5, -120, 375), 2);
    assert.equal(v.albumViewerSwipeTarget(1, 5, 120, 375), 0);
    assert.equal(v.albumViewerSwipeTarget(1, 5, -30, 375), 1, 'short drag snaps back');
    assert.equal(v.albumViewerSwipeTarget(1, 5, -30, 375, -0.8), 2, 'quick flick counts');
    assert.equal(v.albumViewerSwipeTarget(4, 5, -200, 375), 4);
    assert.equal(v.albumViewerSwipeTarget(0, 5, 200, 375), 0);
});

test('album grid opens photos in the viewer and reopening the app closes it', () => {
    const source = sourceSection('apps/album/album.js', 'function renderAlbumApp()', 'const ALBUM_VIEWER_MAX_SCALE');
    assert.match(source, /data-open-photo=/);
    assert.match(source, /openAlbumViewer\(button\.dataset\.openPhoto, rows\)/);
    assert.match(source, /async function initAlbumApp\(\) \{\n\s+if \(typeof closeAlbumViewer === 'function'\) closeAlbumViewer\(\);/);
});
