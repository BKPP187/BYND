'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'systems/onboarding/onboarding.js'), 'utf8');
const KEY = 'bynd_onboarding_v1';

// Just enough DOM for the tour: elements, classes, attributes, listeners and fixed rectangles.
function fakeElement(tag, document) {
    const listeners = {};
    const attributes = {};
    const classes = new Set();
    const node = {
        tagName: tag.toUpperCase(), children: [], parent: null, style: { setProperty() {} }, dataset: {}, hidden: false, disabled: false,
        textContent: '', id: '', type: '', rect: { left: 0, top: 0, right: 320, bottom: 120, width: 320, height: 120 },
        get isConnected() { let n = node; while (n.parent) n = n.parent; return n === document.root; },
        get className() { return [...classes].join(' '); },
        set className(value) { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
        classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle: (c, on) => (on ?? !classes.has(c)) ? classes.add(c) : classes.delete(c) },
        get offsetHeight() { return 160; },
        setAttribute: (name, value) => { attributes[name] = String(value); },
        getAttribute: name => attributes[name] ?? null,
        addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
        dispatch(type, event = {}) { (listeners[type] || []).forEach(fn => fn({ preventDefault() {}, target: node, ...event })); },
        click() { node.dispatch('click'); },
        focus() { document.activeElement = node; },
        append(...items) { items.forEach(item => node.appendChild(item)); },
        appendChild(item) { item.parent = node; node.children.push(item); return item; },
        insertBefore(item, ref) { item.parent = node; const i = ref ? node.children.indexOf(ref) : -1; i < 0 ? node.children.push(item) : node.children.splice(i, 0, item); return item; },
        remove() { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = null; },
        contains(other) { for (let n = other; n; n = n.parent) if (n === node) return true; return false; },
        getBoundingClientRect: () => node.rect,
        querySelector: selector => document.find(selector, node)[0] || null,
        querySelectorAll: selector => document.find(selector, node)
    };
    return node;
}

function harness({ entries = {}, failWrites = false, locked = false } = {}) {
    const values = new Map(Object.entries(entries));
    const writes = [];
    const toasts = [];
    const calls = [];
    const document = { readyState: 'complete', visibilityState: 'visible', activeElement: null };
    document.root = fakeElement('html', document);
    const make = (tag, cls, id) => { const n = fakeElement(tag, document); if (cls) n.className = cls; if (id) n.id = id; return n; };
    const phone = document.root.appendChild(make('div', 'phone-container'));
    phone.rect = { left: 0, top: 0, right: 375, bottom: 812, width: 375, height: 812 };
    const lock = phone.appendChild(make('div', locked ? 'lock-screen' : 'lock-screen unlocked', 'lock-screen'));
    const home = phone.appendChild(make('div', '', 'home-screen'));
    const wechat = home.appendChild(make('div', 'app-item'));
    wechat.dataset.appId = 'wechat';
    wechat.rect = { left: 12, top: 286, right: 94, bottom: 362, width: 82, height: 76 };
    const about = phone.appendChild(make('div', 'bynd-about-card'));
    about.appendChild(make('h3'));
    document.createElement = tag => fakeElement(tag, document);
    document.getElementById = id => document.find('#' + id)[0] || null;
    document.addEventListener = () => {};
    // Supports the handful of selectors the tour uses.
    document.find = (selector, scope = document.root) => {
        const all = [];
        const walk = n => { n.children.forEach(c => { all.push(c); walk(c); }); };
        walk(scope);
        return selector.split(',').map(s => s.trim()).flatMap(s => all.filter(n => {
            if (s === '.phone-container') return n.classList.contains('phone-container');
            if (s.startsWith('#') && !s.includes(' ')) return n.id === s.slice(1);
            if (s === '.app-item[data-app-id="wechat"]') return n.dataset.appId === 'wechat';
            if (s === '#settings-tab-about .bynd-about-card') return n.classList.contains('bynd-about-card');
            if (s === '.bynd-tour-replay') return n.classList.contains('bynd-tour-replay');
            if (s === 'h3') return n.tagName === 'H3';
            if (s === '[aria-modal="true"]') return n.getAttribute('aria-modal') === 'true' && n.id !== 'bynd-tour';
            if (s === '.app-window.active, #bynd-version-letter' || s === '.app-window.active') return n.classList.contains('app-window') && n.classList.contains('active');
            return false;
        }));
    };
    document.querySelector = selector => document.find(selector)[0] || null;
    document.querySelectorAll = selector => document.find(selector);
    const timers = [];
    const context = vm.createContext({
        console: { warn() {}, log() {}, error() {} }, JSON, Math, Date, Array, Object, Promise, String, Number, Set,
        document,
        localStorage: {
            getItem: key => values.has(key) ? values.get(key) : null,
            setItem(key, value) { if (failWrites) throw new Error('QuotaExceededError'); values.set(key, String(value)); writes.push([key, String(value)]); }
        },
        getComputedStyle: () => ({ paddingTop: '47px' }),
        setTimeout: fn => { timers.push(fn); return timers.length; },
        setInterval: fn => { timers.push(fn); return 99; }, clearInterval() {},
        showWechatToast: text => toasts.push(text),
        openApp: name => calls.push('open:' + name), closeApp: name => calls.push('close:' + name),
        openSettingsTab: name => calls.push('tab:' + name), resetDesktopToFirstPage: () => calls.push('desktop')
    });
    context.window = context;
    context.addEventListener = () => {}; context.removeEventListener = () => {};
    vm.runInContext(source, context);
    const flush = () => { while (timers.length) timers.shift()(); };
    return { api: context.ByndOnboarding, values, writes, toasts, calls, flush, document, lock, phone };
}

const tour = h => h.document.getElementById('bynd-tour');
const button = (h, cls) => {
    const all = [];
    const walk = n => n.children.forEach(c => { all.push(c); walk(c); });
    walk(tour(h));
    return all.find(n => n.classList.contains(cls));
};

test('a fresh install starts the tour once the desktop is unlocked', () => {
    const h = harness({ locked: true });
    assert.equal(h.api.shouldAutoStart(), true);
    h.flush();
    assert.equal(h.api.active, null, 'locked screen keeps the tour waiting');
    h.lock.classList.add('unlocked');
    assert.equal(h.api.init(), true);
    h.flush();
    assert.equal(h.api.active.step, 'welcome');
    assert.equal(JSON.parse(h.values.get(KEY)).status, 'seen', 'marked as shown immediately so a relaunch will not repeat it');
    assert.equal(h.api.shouldAutoStart(), false);
});

test('existing installations and remembered states never auto start', () => {
    assert.equal(harness({ entries: { my_api_data: '[]' } }).api.shouldAutoStart(), false);
    assert.equal(harness({ entries: { [KEY]: JSON.stringify({ status: 'skipped' }) } }).api.shouldAutoStart(), false);
    assert.equal(harness({ entries: { [KEY]: 'not json' } }).api.readState().status, 'unknown');
    assert.equal(harness({ entries: { [KEY]: 'not json' } }).api.shouldAutoStart(), false);
});

test('next walks every step and finish remembers done and returns to the desktop', () => {
    const h = harness();
    assert.equal(h.api.start(), true);
    h.flush();
    const ids = Array.from(h.api.steps, step => step.id);
    assert.deepEqual(ids, ['welcome', 'wechat', 'apps', 'tools', 'pages', 'dock', 'api', 'done']);
    const next = button(h, 'bynd-tour-next');
    assert.equal(next.textContent, '开始');
    for (let i = 1; i < ids.length; i++) {
        next.click();
        h.flush();
        assert.equal(h.api.active.step, ids[i]);
    }
    assert.ok(h.calls.includes('open:settings') && h.calls.includes('tab:api'), 'API step opens 设置 → API');
    assert.equal(next.textContent, '完成');
    h.calls.length = 0;
    next.click();
    assert.equal(h.api.active, null);
    assert.equal(tour(h), null, 'overlay removed');
    assert.equal(JSON.parse(h.values.get(KEY)).status, 'done');
    assert.ok(h.calls.includes('desktop'));
});

test('skip is remembered and back is hidden on the first step', () => {
    const h = harness();
    h.api.start();
    h.flush();
    assert.equal(button(h, 'bynd-tour-back').hidden, true);
    button(h, 'bynd-tour-next').click();
    h.flush();
    assert.equal(button(h, 'bynd-tour-back').hidden, false);
    button(h, 'bynd-tour-back').click();
    h.flush();
    assert.equal(h.api.active.step, 'welcome');
    button(h, 'bynd-tour-skip').click();
    assert.equal(h.api.active, null);
    assert.equal(JSON.parse(h.values.get(KEY)).status, 'skipped');
});

test('a failed save is reported instead of pretending the state was kept', () => {
    const h = harness({ failWrites: true });
    h.api.start({ automatic: true });
    h.flush();
    assert.match(button(h, 'bynd-tour-status').textContent, /未能保存/);
    assert.equal(h.api.close('done'), false);
    assert.equal(h.toasts.length, 1);
    assert.match(h.toasts[0], /没有保存成功/);
});

test('the about page gets a replay button that restarts the tour', () => {
    const h = harness({ entries: { [KEY]: JSON.stringify({ status: 'done' }) } });
    const about = h.document.find('#settings-tab-about .bynd-about-card')[0];
    const replay = about.children.find(n => n.classList.contains('bynd-tour-replay'));
    assert.ok(replay, 'replay button rendered');
    assert.equal(replay.textContent, '重新播放新手指引');
    assert.equal(about.children.indexOf(replay), 0, 'placed before the update history heading');
    replay.click();
    h.flush();
    assert.equal(h.api.active.step, 'welcome');
    h.api.renderReplayButton();
    assert.equal(about.children.filter(n => n.classList.contains('bynd-tour-replay')).length, 1, 'never duplicated');
});

test('the tour is wired into the page and covers the main entries', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /<script src="systems\/onboarding\/onboarding\.js\?v=[\d.]+"><\/script>/);
    assert.match(html, /href="systems\/onboarding\/onboarding\.css\?v=[\d.]+"/);
    assert.ok(html.indexOf('systems/onboarding/onboarding.js') < html.indexOf('main.js?v='), 'loaded before main.js initializes defaults');
    const css = fs.readFileSync(path.join(root, 'systems/onboarding/onboarding.css'), 'utf8');
    assert.match(css, /--bynd-header-safe-top/, 'bubble placement reads the native safe area');
    assert.match(css, /prefers-reduced-motion/);
});
