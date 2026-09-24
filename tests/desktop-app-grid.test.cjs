const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { sourceSection } = require('./helpers/harness.cjs');

test('second-page app grid remains four centered columns on narrow screens', () => {
    const context = vm.createContext({});
    vm.runInContext(sourceSection('script.js', 'function getDesktopFourColumnAppGridMetrics(', 'function normalizeSecondPageAppGrid('), context);

    for (const width of [320, 360, 430]) {
        const metrics = context.getDesktopFourColumnAppGridMetrics({ clientWidth: width });
        const usedWidth = metrics.iconWidth * metrics.columns + metrics.gapX * (metrics.columns - 1);
        assert.equal(metrics.columns, 4);
        assert.ok(metrics.startX >= 8, `left inset at ${width}`);
        assert.ok(metrics.startX + usedWidth <= width - 8, `right inset at ${width}`);
        assert.ok(Math.abs(metrics.startX - (width - (metrics.startX + usedWidth))) < 0.01, `centred at ${width}`);
    }
});

test('saved layouts migrate Living World directly below PageMate instead of hiding the new entry', () => {
    const source = require('node:fs').readFileSync('script.js', 'utf8');
    assert.match(source, /const hasLivingWorld = savedItems\.some\(item => item\?\.id === 'app-living-world'\)/);
    assert.match(source, /getDesktopAppIdFromElement\(item\) === 'coread'/);
    assert.match(source, /top: \(mateRect\?\.top .* \+ .*metrics\.gapY/);
    assert.match(source, /savedItemsSanitized \|\| repaired \|\| livingWorldAdded/);
});

test('comic migration selects an empty slot when the preferred slot belongs to Dream', () => {
    const dream = { id: 'dream', rect: { left: 286, top: 118, width: 72, height: 82 } };
    const album = { id: 'album', rect: { left: 198, top: 18, width: 72, height: 82 } };
    const comic = { id: 'comic', style: {} };
    const area = {
        clientWidth: 375,
        clientHeight: 590,
        querySelectorAll() { return [dream, album]; }
    };
    const context = vm.createContext({
        getDesktopFallbackSlotMetrics: () => ({ iconWidth: 72, iconHeight: 82 }),
        getDesktopAppIdFromElement: item => item.id,
        getDesktopStyleRect: item => item?.rect || null,
        clampDesktopLayoutRect: rect => rect,
        getDesktopFlowSlotRects: () => [
            { left: 286, top: 118, width: 72, height: 82 },
            { left: 198, top: 118, width: 72, height: 82 },
            { left: 110, top: 118, width: 72, height: 82 }
        ]
    });
    vm.runInContext(sourceSection('script.js', 'function desktopAppRectsHaveClearance(', 'function repairDesktopAppOverlaps('), context);
    const preferred = { ...dream.rect };
    const actual = context.findDesktopComicClearRect(area, comic, preferred);
    assert.equal(actual.left, 198);
    assert.equal(actual.top, 118);
    assert.equal(context.desktopAppRectsHaveClearance(actual, dream.rect), true);
});

test('already saved comic overlap moves only comic and keeps Dream in place', () => {
    const dream = { id: 'dream', rect: { left: 286, top: 118, width: 72, height: 82 } };
    const comic = { id: 'comic', rect: { ...dream.rect }, style: {} };
    const area = {
        clientWidth: 375,
        clientHeight: 590,
        querySelectorAll() { return [dream, comic]; }
    };
    let captures = 0;
    const context = vm.createContext({
        location: { search: '' },
        hasDesktopUsableLayoutBounds: () => true,
        getDesktopAppIdFromElement: item => item.id,
        getDesktopStyleRect: item => item?.rect || null,
        getDesktopFallbackSlotMetrics: () => ({ iconWidth: 72, iconHeight: 82 }),
        clampDesktopLayoutRect: rect => rect,
        getDesktopFlowSlotRects: () => [
            { left: 286, top: 118, width: 72, height: 82 },
            { left: 198, top: 118, width: 72, height: 82 }
        ],
        desktopRectsDiffer: (a, b) => a.left !== b.left || a.top !== b.top,
        setDesktopLayoutItemRect: (item, rect) => { item.rect = rect; },
        captureDesktopPageSlotRects: () => { captures += 1; }
    });
    vm.runInContext(sourceSection('script.js', 'function desktopAppRectsHaveClearance(', 'function repairDesktopAppOverlaps('), context);
    assert.equal(context.repairDesktopComicOverlap(area), true);
    assert.equal(comic.rect.left, 198);
    assert.equal(dream.rect.left, 286);
    assert.equal(context.repairDesktopComicOverlap(area), false);
    assert.equal(captures, 1);
});

test('comic uses the empty slot beside pet even when a broad widget blocks generic flow slots', () => {
    const positions = [32, 164, 296, 428];
    const firstRow = positions.map((left, index) => ({ id: `top-${index}`, rect: { left, top: 24, width: 72, height: 82 } }));
    const secondRow = positions.map((left, index) => ({ id: `middle-${index}`, rect: { left, top: 174, width: 72, height: 82 } }));
    const pet = { id: 'pet', rect: { left: 32, top: 324, width: 72, height: 82 } };
    const widget = { id: 'widget', rect: { left: 18, top: 300, width: 520, height: 130 } };
    const comic = { id: 'comic', style: {} };
    const apps = [...firstRow, ...secondRow, pet];
    const area = {
        clientWidth: 550,
        clientHeight: 590,
        querySelectorAll(selector) {
            if (selector.includes(':not(.layout-app)')) return [widget];
            if (selector.endsWith('.layout-app')) return apps;
            return [...apps, widget];
        }
    };
    const context = vm.createContext({
        getDesktopAppIdFromElement: item => item.id,
        getDesktopStyleRect: item => item?.rect || null,
        getDesktopRectIntersectionRatio: (a, b) => {
            const w = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
            const h = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
            return w * h / Math.min(a.width * a.height, b.width * b.height);
        },
        getDesktopFallbackSlotMetrics: () => ({ iconWidth: 72, iconHeight: 82 }),
        clampDesktopLayoutRect: rect => rect,
        getDesktopFlowSlotRects: () => []
    });
    vm.runInContext(sourceSection('script.js', 'function desktopAppRectsHaveClearance(', 'function repairDesktopAppOverlaps('), context);
    const rect = context.findDesktopComicClearRect(area, comic, { ...firstRow[3].rect });
    assert.equal(rect.left, 164);
    assert.equal(rect.top, pet.rect.top);
    assert.equal(context.desktopAppRectsHaveClearance(rect, pet.rect), true);
});

test('a crowded saved second screen reflows its ten apps before comic can overflow to page three', () => {
    const ids = ['outing', 'monitor', 'album', 'dream', 'living-world', 'coread', 'manual', 'mcp', 'pet', 'comic'];
    const apps = ids.map(id => ({ id, rect: { left: 12, top: 318, width: 72, height: 82 } }));
    const comic = apps.at(-1);
    const page = {};
    const area = {
        clientWidth: 359,
        clientHeight: 605,
        dataset: {},
        closest: () => page,
        querySelectorAll: () => apps
    };
    let normalized = 0;
    let createdPage = 0;
    const context = vm.createContext({
        DESKTOP_PAGE2_APP_IDS: new Set(ids),
        hasDesktopUsableLayoutBounds: () => true,
        getDesktopAppIdFromElement: item => item.id,
        getDesktopPageIndex: () => 1,
        getDesktopStyleRect: item => item.rect,
        getDesktopOrderedSlotItems: () => apps,
        findDesktopComicClearRect: () => normalized ? comic.rect : null,
        normalizeSecondPageAppGrid: () => {
            normalized += 1;
            comic.rect = { left: 100, top: 514, width: 72, height: 82 };
            return true;
        },
        desktopRectsDiffer: (a, b) => a.left !== b.left || a.top !== b.top,
        setDesktopLayoutItemRect: (item, rect) => { item.rect = rect; },
        captureDesktopPageSlotRects: () => {},
        ensureDesktopPage: () => { createdPage += 1; return null; }
    });
    vm.runInContext(sourceSection('script.js', 'function repairDesktopComicOverlap(', 'function repairDesktopAppOverlaps('), context);
    assert.equal(context.repairDesktopComicOverlap(area), true);
    assert.equal(normalized, 1);
    assert.equal(createdPage, 0);
    assert.equal(comic.rect.top, 514);
});
