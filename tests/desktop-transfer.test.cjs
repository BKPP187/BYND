'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { sourceSection } = require('./helpers/harness.cjs');
function harness(width = 375, height = 590) {
    const node = (rect, app = true) => ({ style: Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, value + 'px'])), classList: { contains: name => name === 'layout-app' && app } });
    const items = [], area = { clientWidth: width, clientHeight: height, querySelectorAll: selector => items.filter(item => selector.includes(':not(.layout-app)') ? !item.classList.contains('layout-app') : selector.includes('.layout-app') ? item.classList.contains('layout-app') : true) };
    const context = vm.createContext({});
    vm.runInContext(sourceSection('ui/components/desktop-layout.js', 'function clampDesktopLayoutRect(', 'function desktopRectsDiffer('), context);
    vm.runInContext(sourceSection('ui/components/desktop-layout.js', 'function getDesktopFourColumnAppGridMetrics(', 'function normalizeSecondPageAppGrid('), context);
    vm.runInContext(sourceSection('ui/components/desktop-layout.js', 'function getDesktopFlowSlotRects(', 'function getNearestDesktopFlowSlotIndex('), context);
    vm.runInContext(sourceSection('ui/components/desktop-layout.js', 'function desktopAppRectsHaveClearance(', 'function findDesktopComicBesidePetRect('), context);
    vm.runInContext(sourceSection('ui/components/desktop-widgets.js', 'function getDesktopTransferFootprint(', 'function promptDesktopMovePage('), context);
    return { node, items, area, slots: () => context.getDesktopFlowSlotRects(area), find: item => context.findDesktopTransferRect(area, item), clear: context.desktopAppRectsHaveClearance };
}
test('mobile saved rows below a wide widget expose all three possible rows', () => {
    const h = harness(384, 590);
    h.items.push(h.node({ left: 17, top: 72, width: 349, height: 248 }, false));
    for (const top of [400, 500]) for (const left of [12, 108, 204, 300]) h.items.push(h.node({ left, top, width: 72, height: 82 }));
    const before = JSON.stringify(h.items);
    const slots = h.slots();
    assert.equal(slots.length, 12);
    assert.deepEqual([...new Set(slots.map(slot => slot.top))], [328, 418, 508]);
    assert.equal(JSON.stringify(h.items), before, 'slot discovery does not mutate the saved layout');
});
test('cross-screen placement fills an icon-row hole instead of covering the header photo', () => {
    const h = harness();
    h.items.push(h.node({ left: 18, top: 30, width: 339, height: 248 }, false));
    for (const top of [286, 386, 486]) for (const left of [12, 105, 198, 291]) {
        if (top === 386 && left === 105) continue;
        h.items.push(h.node({ left, top, width: 72, height: 82 }));
    }
    const before = JSON.stringify(h.items);
    const moved = h.node({ left: 24, top: 64, width: 72, height: 82 });
    moved.dataset = { desktopSlot: '0' };
    const rect = h.find(moved);
    assert.equal(rect.left, 105); assert.equal(rect.top, 386);
    assert.equal(JSON.stringify(h.items), before, 'existing widgets and icons do not move');
    for (const item of h.items) assert.ok(h.clear(rect, Object.fromEntries(Object.entries(item.style).map(([key, value]) => [key, parseFloat(value)]))));
});
test('a photo header leaves all twelve cells available even when only two old rows are occupied', () => {
    const h = harness();
    h.items.push(h.node({ left: 18, top: 30, width: 339, height: 248 }, false));
    for (const top of [410, 518]) for (const left of [12, 105, 198, 291]) h.items.push(h.node({ left, top, width: 72, height: 82 }));
    const rect = h.find(h.node({ left: 24, top: 64, width: 72, height: 140 }));
    assert.equal(rect.top, 286, 'the empty first row is usable');
    assert.equal(rect.height, 82);
});
test('legacy mixed-height icon rows normalize once without moving their horizontal positions', () => {
    const h = harness();
    h.items.push(h.node({ left: 18, top: 240, width: 72, height: 140 }));
    h.items.push(h.node({ left: 106, top: 240, width: 72, height: 82 }));
    const context = vm.createContext({ getDesktopRawStyleRect: item => Object.fromEntries(Object.entries(item.style).map(([key, value]) => [key, parseFloat(value)])), setDesktopLayoutItemRect: (item, rect) => { const changed = Object.entries(rect).some(([key, value]) => item.style[key] !== Math.round(value) + 'px'); Object.assign(item.style, Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, Math.round(value) + 'px']))); return changed; } });
    vm.runInContext(sourceSection('ui/components/desktop-widgets.js', 'function normalizeDesktopIconRows(', 'function getDesktopTransferFootprint('), context);
    assert.equal(context.normalizeDesktopIconRows(h.area), true);
    assert.equal(h.items[0].style.top, '269px'); assert.equal(h.items[1].style.top, '269px');
    assert.equal(h.items[0].style.left, '18px'); assert.equal(h.items[1].style.left, '106px');
    assert.equal(context.normalizeDesktopIconRows(h.area), false);
});
test('a full target screen has no fallback that overlaps existing content', () => {
    const h = harness();
    h.items.push(h.node({ left: 8, top: 8, width: 359, height: 574 }, false));
    assert.equal(h.find(h.node({ left: 24, top: 64, width: 72, height: 82 })), null);
    const short = harness(320, 96);
    assert.equal(short.find(short.node({ left: 24, top: 64, width: 72, height: 82 })), null);
});
test('narrow target screens and transferred components stay within measured canvas bounds', () => {
    for (const width of [320, 375, 430]) {
        const h = harness(width);
        const rect = h.find(h.node({ left: 280, top: 64, width: 322, height: 128 }, false));
        assert.ok(rect);
        assert.ok(rect.left >= 8 && rect.top >= 8);
        assert.ok(rect.left + rect.width <= width - 8);
        assert.ok(rect.top + rect.height <= h.area.clientHeight - 8);
    }
});

test('an unspecified preferred cell uses the nearest position rather than forcing cell zero', () => {
    const context = vm.createContext({ getDesktopStyleRect: item => item.rect });
    vm.runInContext(sourceSection('ui/components/desktop-layout.js', 'function getNearestDesktopFlowSlotIndex(', 'function getDesktopFallbackSlotRect('), context);
    const slots = [0, 1, 2].map(index => ({ left: index * 90, top: 300, width: 72, height: 82 }));
    const item = { rect: slots[2] };
    assert.equal(context.getNearestDesktopFlowSlotIndex({}, item, slots, new Set(), null), 2);
    assert.equal(context.getNearestDesktopFlowSlotIndex({}, item, slots, new Set(), 0), 0);
});

test('slot capture retains empty first and third rows and pointer picking reaches them', () => {
    const slots = Array.from({ length: 12 }, (_, index) => ({ left: 12 + (index % 4) * 93, top: 304 + Math.floor(index / 4) * 90, width: 72, height: 82 }));
    const item = { rect: slots[5], dataset: {}, classList: { contains: () => false } };
    const area = { getBoundingClientRect: () => ({ left: 0, top: 0 }), scrollLeft: 0, scrollTop: 0 };
    const context = vm.createContext({ getDesktopFlowSlotRects: () => slots, getDesktopOrderedSlotItems: () => [item], getDesktopStyleRect: node => node.rect, getDesktopRawStyleRect: node => node.rect, getDesktopEditScale: () => 0.72 });
    vm.runInContext(sourceSection('ui/components/desktop-layout.js', 'function getNearestDesktopFlowSlotIndex(', 'function getDesktopFallbackSlotRect('), context);
    vm.runInContext(sourceSection('ui/components/desktop-layout.js', 'function captureDesktopPageSlotRects(', 'function clearDesktopPageSlotRects('), context);
    vm.runInContext(sourceSection('ui/components/desktop-layout.js', 'function getDesktopSlotIndexFromPoint(', 'function applyDesktopSlotOrder('), context);
    assert.equal(context.captureDesktopPageSlotRects(area).length, 12);
    assert.equal(item.dataset.desktopSlot, '5');
    for (const index of [2, 11]) {
        const slot = slots[index];
        assert.equal(context.getDesktopSlotIndexFromPoint(area, { x: (slot.left + 36) * 0.72, y: (slot.top + 41) * 0.72 }, item), index);
    }
});
test('uneven legacy row spacing leaves the last visible row usable without moving its neighbors', () => {
    const h = harness();
    h.items.push(h.node({ left: 18, top: 48, width: 339, height: 248 }, false));
    for (const top of [304, 404]) for (const left of [12, 105, 198, 291]) h.items.push(h.node({ left, top, width: 72, height: 82 }));
    const before = JSON.stringify(h.items);
    const rect = h.find(h.node({ left: 24, top: 64, width: 72, height: 82 }));
    assert.ok(rect, 'the physically empty bottom row must be found');
    assert.equal(rect.top, 494);
    assert.equal(rect.height, 82);
    assert.equal(JSON.stringify(h.items), before);
});

test('occupancy uses unscaled CSS dimensions instead of phantom legacy widget sizes', () => {
    const context = vm.createContext({});
    vm.runInContext(sourceSection('ui/components/desktop-layout.js', 'function getDesktopRawStyleRect(', 'function desktopRectsDiffer('), context);
    const item = { style: { left: '18px', top: '48px', width: '339px', height: '300px' }, offsetWidth: 339, offsetHeight: 248 };
    assert.equal(context.getDesktopRawStyleRect(item).height, 248);
    assert.equal(context.getDesktopRawStyleRect(item).top, 48);
    // While the whole home is hidden, retain stored dimensions until measurable.
    item.offsetHeight = 0; item.offsetWidth = 0;
    assert.equal(context.getDesktopRawStyleRect(item).height, 300);
});

test('reported 359px canvas fits a third row ending exactly at its 590px bottom', () => {
    const h = harness(359, 590);
    h.items.push(h.node({ left: 16, top: 72, width: 327, height: 248 }, false));
    for (const top of [328, 418]) for (const left of [12, 100, 187, 275]) h.items.push(h.node({ left, top, width: 72, height: 82 }));
    const before = JSON.stringify(h.items);
    const rect = h.find(h.node({ left: 24, top: 64, width: 72, height: 82 }));
    assert.ok(rect, 'the user diagnostic has one full visible row left');
    assert.equal(rect.top, 508); assert.equal(rect.top + rect.height, 590);
    assert.equal(JSON.stringify(h.items), before);
    // An actually clipped card must still be rejected.
    h.area.clientHeight = 589;
    assert.equal(h.find(h.node({ left: 24, top: 64, width: 72, height: 82 })), null);
});

function slotTransactionHarness() {
    const slots = [12, 100, 187, 275].map(left => ({ left, top: 328, width: 72, height: 82 }));
    const items = [];
    const make = (index, advertised = index, classes = ['layout-app']) => {
        const item = { rect: { ...slots[index] }, dataset: { desktopSlot: String(advertised) }, classList: { contains: name => classes.includes(name) } };
        items.push(item); return item;
    };
    const area = { querySelectorAll: () => items };
    const context = vm.createContext({
        ensureDesktopPageSlotRects: () => slots,
        getDesktopFallbackSlotMetrics: () => ({ iconWidth: 72, iconHeight: 82 }),
        getDesktopOrderedSlotItems: () => items.filter(item => item.classList.contains('layout-app')),
        getDesktopSlotRect: (_, index) => ({ ...slots[index] }),
        getDesktopTransferFootprint: item => ({ ...item.rect }),
        getDesktopRawStyleRect: item => ({ ...item.rect }),
        normalizeDesktopLayoutAppSlotSize: () => {},
        setDesktopLayoutItemRect: (item, rect) => { item.rect = { ...rect }; return true; }
    });
    vm.runInContext(sourceSection('ui/components/desktop-layout.js', 'function desktopAppRectsHaveClearance(', 'function findDesktopComicBesidePetRect('), context);
    vm.runInContext(sourceSection('ui/components/desktop-layout.js', 'function applyDesktopSlotOrder(', 'function normalizeDesktopLayoutAppSlotSize('), context);
    return { slots, items, make, apply: (item, index) => context.applyDesktopSlotOrder(area, item, index) };
}

test('occupied-cell swapping checks physical rectangles when an icon advertises a stale slot', () => {
    const h = slotTransactionHarness();
    const dragged = h.make(3), neighbor = h.make(2, 0);
    h.make(0); h.make(1);
    assert.equal(h.apply(dragged, 2), true);
    assert.deepEqual(dragged.rect, h.slots[2]);
    assert.deepEqual(neighbor.rect, h.slots[3], 'the actual occupant must move out of the drop rectangle');
});

test('an outdated previous slot cannot displace an icon onto another physical occupant', () => {
    const h = slotTransactionHarness();
    const dragged = h.make(3, 0), neighbor = h.make(2);
    const other = h.make(0, 3); h.make(1);
    assert.equal(h.apply(dragged, 2), true);
    assert.deepEqual(neighbor.rect, h.slots[3]);
    assert.deepEqual(other.rect, h.slots[0]);
});

test('dropping onto a fixed component returns failure without partially moving its neighbors', () => {
    const h = slotTransactionHarness();
    const dragged = h.make(3); h.make(2, 2, []);
    h.make(0); h.make(1);
    const before = JSON.stringify(h.items);
    assert.equal(h.apply(dragged, 2), false);
    assert.equal(JSON.stringify(h.items), before);
});

test('snapping a transiently expanded drag card uses the normal icon footprint', () => {
    const h = slotTransactionHarness();
    const dragged = h.make(3);
    dragged.rect.width = 76; dragged.rect.height = 84;
    assert.equal(h.apply(dragged, 2), true);
    assert.deepEqual(dragged.rect, h.slots[2]);
});

test('multiple blocking icons are not partially relocated if only one free cell exists', () => {
    const h = slotTransactionHarness();
    const dragged = h.make(3); h.make(2); h.make(2); h.make(0); h.make(1);
    const before = JSON.stringify(h.items);
    assert.equal(h.apply(dragged, 2), false);
    assert.equal(JSON.stringify(h.items), before);
});
