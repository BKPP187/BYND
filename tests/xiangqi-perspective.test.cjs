const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { sourceSection, memoryStorage } = require('./helpers/harness.cjs');

function createXiangqiHarness(firstPlayer) {
    const localStorage = memoryStorage();
    const context = vm.createContext({
        window: {}, localStorage,
        getBoardGameFirstPlayer: () => firstPlayer,
        getBoardGamePlayerSides: () => ({
            firstPlayer, firstSide: 'red',
            userSide: firstPlayer === 'user' ? 'red' : 'black',
            charSide: firstPlayer === 'user' ? 'black' : 'red'
        }),
        getBoardGameSideLabel: (_, side) => side === 'red' ? '红方' : '黑方',
        getBoardGameTurnText: (_, state) => state.turn === 'red' ? '你 · 红方' : '角色 · 红方',
        renderBoardGameCompanionBar: () => '',
        musicEscapeHtml: value => value,
        getBoardLegalMoves: () => []
    });
    vm.runInContext('const BOARD_GAME_STATE_PREFIX = "test_board_";', context);
    vm.runInContext(sourceSection('script.js', 'function getBoardGamePieceSide(', 'function isBoardCellInside('), context);
    vm.runInContext(sourceSection('script.js', 'function getInitialBoardGameState(', 'function clickBoardGameCell('), context);
    vm.runInContext(sourceSection('script.js', 'function renderBoardGame(el, type)', 'const CHICKEN_GAME_BEST_KEY'), context);
    return { context, localStorage };
}

test('xiangqi shows the user side at the bottom for either first player', () => {
    for (const firstPlayer of ['user', 'char']) {
        const { context } = createXiangqiHarness(firstPlayer);
        const el = { innerHTML: '' };
        context.renderBoardGame(el, 'xiangqi');
        const cells = [...el.innerHTML.matchAll(/<button type="button" class="([^"]*)" onclick="clickBoardGameCell\('xiangqi',(\d+),(\d+)\)" aria-label="([^"]*)"/g)];
        assert.equal(cells.length, 90);
        const bottom = cells.slice(-9);
        const expectedSide = firstPlayer === 'user' ? 'side-red' : 'side-black';
        assert.ok(bottom.every(cell => cell[1].includes(expectedSide)));
        assert.equal(Number(bottom[0][2]), firstPlayer === 'user' ? 0 : 9);
        assert.match(el.innerHTML, /你的(?:红方|黑方)在下方/);
    }
});

test('red rook and horse keep their side after crossing the river', () => {
    const { context } = createXiangqiHarness('user');
    const state = context.getInitialBoardGameState('xiangqi');
    assert.equal(context.getBoardGamePieceSide('xiangqi', state.board[0][0], 9), 'red');
    assert.equal(context.getBoardGamePieceSide('xiangqi', state.board[0][1], 9), 'red');
    assert.equal(context.getBoardGamePieceSide('xiangqi', state.board[9][0], 0), 'black');
    assert.equal(context.getBoardGamePieceSide('xiangqi', state.board[9][1], 0), 'black');
});

test('saved games migrate old red rook and horse glyphs without requiring a write while loading', () => {
    const { context, localStorage } = createXiangqiHarness('user');
    const oldState = context.getInitialBoardGameState('xiangqi');
    oldState.board[0][0] = '車';
    oldState.board[0][1] = '馬';
    localStorage.setItem('test_board_xiangqi', JSON.stringify(oldState));
    localStorage.setItem = () => { throw new Error('storage full'); };
    const loaded = context.getBoardGameState('xiangqi');
    assert.equal(loaded.board[0][0], '俥');
    assert.equal(loaded.board[0][1], '傌');
    assert.equal(loaded.board[9][0], '車');
    assert.equal(loaded.xiangqiDistinctPieces, true);
});

test('river label stays behind crossing pieces and character speech hides the API badge', () => {
    const css = fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
    assert.match(css,/\.classic-board\.xiangqi::after\s*\{[^}]*z-index:\s*2/s);
    assert.match(css,/\.classic-board\.xiangqi button\.has-piece\s*\{\s*z-index:\s*3;/);
    const context = vm.createContext({
        getBoardGameChar:() => ({ avatar:'',name:'阿林' }),
        getBoardGameChat:() => ({ source:'api',status:'ready',text:'该你走了。' }),
        getMusicCharName:char => char.name,
        getBoardGameState:() => ({ turn:'red' }),
        getBoardGameTurnText:() => '你 · 红方',
        musicEscapeAttr:value => value,
        musicEscapeHtml:value => value
    });
    vm.runInContext(sourceSection('script.js','function renderBoardGameCompanionBar(type)','function createGomokuState('),context);
    const markup = context.renderBoardGameCompanionBar('xiangqi');
    assert.match(markup,/该你走了。/);
    assert.doesNotMatch(markup,/API 角色发言|board-speech-source/);
});

test('board-game AI receives its recent remarks so it can avoid repetitive turn prompts', () => {
    const script = fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
    assert.match(script,/previousChat\.speakerId === char\.id/);
    assert.match(script,/recentComments\.slice\(-4\)/);
    assert.match(script,/不要每轮都催促“该你了”“到你了”/);
    assert.match(script,/recentComments: result\.ok && cleanText \? \[\.\.\.recentComments, cleanText\]\.slice\(-5\)/);
});
