'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function harness(entries = {}) {
    const store = new Map(Object.entries(entries));
    const content = { innerHTML: '' };
    const context = vm.createContext({
        console: { warn() {}, log() {}, error() {} }, JSON, Math, Date, Array, Object, String, Number, Promise,
        localStorage: { getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) },
        document: { getElementById: id => id === 'game-content' ? content : null, querySelector: () => null, querySelectorAll: () => [] },
        requestAnimationFrame() {}, setTimeout() {}, setInterval: () => 1, clearInterval() {},
        musicEscapeHtml: escape, musicEscapeAttr: escape, showWechatToast() {}
    });
    context.window = context;
    for (const file of ['apps/games/hub-wolfcha.js', 'apps/games/sync-cardmatch.js', 'apps/games/board-games.js', 'apps/games/cat-pot.js', 'apps/games/water-sort.js', 'apps/games/twenty-forty-eight.js', 'apps/games/jump.js']) {
        vm.runInContext(read(file), context, { filename: file });
    }
    return { context, content, store };
}

test('hub shows compact tiles grouped by category without a hero card', () => {
    const { context, content } = harness();
    context.renderGameHub(content);
    assert.doesNotMatch(content.innerHTML, /appstore-hero|game-hub-hero/);
    assert.match(content.innerHTML, /class="gh-tabs"/);
    const tiles = content.innerHTML.match(/class="gh-tile[ "]/g) || [];
    assert.equal(tiles.length, vm.runInContext('GAME_LIBRARY.length', context), 'every game has one tile');
    for (const label of ['和角色一起玩', '街机', '棋盘与益智']) assert.match(content.innerHTML, new RegExp(label));
    assert.match(content.innerHTML, /gh-tile coming/, 'reserved slots look disabled');
});

test('opening a game remembers it in the recent row; filters drop the section headings', () => {
    const { context, content, store } = harness();
    context.renderGameApp = () => {};
    context.openMiniGame('2048');
    context.openMiniGame('catpot');
    assert.deepEqual(JSON.parse(store.get('bynd_game_recent_v1')), ['catpot', '2048']);
    context.renderGameHub(content);
    assert.match(content.innerHTML, /class="gh-recent"[\s\S]*猫猫早餐锅[\s\S]*2048/);
    store.set('bynd_game_hub_filter_v1', 'arcade');
    context.renderGameHub(content);
    assert.doesNotMatch(content.innerHTML, /gh-section|gh-recent/);
    assert.ok((content.innerHTML.match(/class="gh-tile[ "]/g) || []).length >= 1);
});

test('mini games use the shared status row instead of a repeated title card', () => {
    const { context, content } = harness();
    for (const render of ['render2048Game', 'renderJumpGame', 'renderWaterSortGame']) {
        context[render](content);
        assert.match(content.innerHTML, /class="mini-hud"/, render);
        assert.doesNotMatch(content.innerHTML, /game2048-top|jump-top|water-top/, render);
    }
    context.renderJumpGame(content);
    assert.match(content.innerHTML, /id="jump-power-value"/, 'power readout keeps its live-update id');
});

test('water sort renders without throwing (regression: stray wolfcha speech code)', () => {
    const { context, content } = harness();
    assert.doesNotThrow(() => context.renderWaterSortGame(content));
    assert.match(content.innerHTML, /water-rack/);
});

test('cat pot lays out HUD, ticket, pot stage, four-column tray and actions in flow', () => {
    const { context, content } = harness();
    context.renderCatPotGame(content);
    const html = content.innerHTML;
    const order = ['catpot-hud', 'catpot-order-card', 'catpot-queue-strip', 'catpot-pot-stage', 'catpot-basket', 'catpot-actions'].map(cls => html.indexOf(`class="${cls}`));
    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), 'sections in reading order');
    assert.equal((html.match(/catpot-food-btn/g) || []).length, vm.runInContext('CATPOT_INGREDIENTS.length', context));
    assert.match(html, /data-catpot-time/);
    assert.match(html, /data-catpot-patience-text/);
    const css = read('apps/games/game-refresh.css');
    assert.match(css, /\.catpot-basket \{[^}]*grid-template-columns: repeat\(4/);
    assert.match(css, /\.catpot-game \{[^}]*safe-area-inset-bottom/);
    assert.doesNotMatch(read('apps/games/game-polish.css'), /catpot/, 'old absolute-position layers are gone');
});

test('the refresh stylesheet is loaded after the older game layers', () => {
    const style = read('ui/theme/style.css');
    const polish = style.indexOf('apps/games/game-polish.css');
    const board = style.indexOf('apps/games/board-games.css');
    const refresh = style.indexOf('apps/games/game-refresh.css');
    assert.ok(polish > 0 && board > polish && refresh > board);
    assert.ok(read('scripts/source-layout.cjs').includes("'apps/games/game-refresh.css'"));
});
