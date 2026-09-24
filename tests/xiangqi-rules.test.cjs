const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { sourceSection, memoryStorage } = require('./helpers/harness.cjs');

// Board orientation matches tests/xiangqi-perspective.test.cjs: red (俥傌相仕帥炮兵)
// starts on rows 0-3 and advances toward row 9; black starts on rows 6-9.
function harness() {
    const calls = [];
    const context = vm.createContext({
        localStorage: memoryStorage(), window: {}, console: { warn() {} },
        renderGameApp() {}, saveBoardGameState() {},
        getBoardGameSideLabel: (_, side) => ({ red: '红方', black: '黑方', white: '白方' }[side] || side),
        requestBoardGameAiComment: (...args) => calls.push(args)
    });
    vm.runInContext(sourceSection('script.js', 'function getBoardGamePieceSide(', 'function getBoardGameCommentRateKey('), context);
    return { context, calls };
}
const empty = () => Array.from({ length: 10 }, () => Array(9).fill(''));
const targets = (h, board, row, col) => Array.from(h.context.getBoardLegalMoves('xiangqi', { board }, row, col), move => move.to.join(',')).sort();
const withGenerals = (board, red = [0, 4], black = [9, 3]) => { board[red[0]][red[1]] = '帥'; board[black[0]][black[1]] = '將'; return board; };

test('車 slides along ranks and files and captures the first piece it meets', () => {
    const h = harness();
    const board = withGenerals(empty());
    board[4][4] = '俥'; board[4][7] = '卒'; board[4][1] = '兵'; board[7][4] = '砲';
    assert.deepEqual(targets(h, board, 4, 4), ['1,4', '2,4', '3,4', '4,2', '4,3', '4,5', '4,6', '4,7', '5,4', '6,4', '7,4'].sort());
});

test('馬 moves in an L and is blocked by 蹩马腿', () => {
    const h = harness();
    const board = withGenerals(empty());
    board[4][4] = '傌';
    assert.equal(targets(h, board, 4, 4).length, 8);
    board[5][4] = '兵'; // blocks both forward jumps
    assert.deepEqual(targets(h, board, 4, 4), ['2,3', '2,5', '3,2', '3,6', '5,2', '5,6'].sort());
});

test('相/象 move two diagonally, respect 塞象眼 and never cross the river', () => {
    const h = harness();
    const board = withGenerals(empty());
    board[4][2] = '相';
    assert.deepEqual(targets(h, board, 4, 2), ['2,0', '2,4'].sort(), 'red elephant stays on rows 0-4');
    board[3][1] = '兵';
    assert.deepEqual(targets(h, board, 4, 2), ['2,4']);
    board[5][6] = '象';
    assert.deepEqual(targets(h, board, 5, 6), ['7,4', '7,8'].sort(), 'black elephant stays on rows 5-9');
});

test('仕/士 and 帥/將 stay inside the palace', () => {
    const h = harness();
    const board = withGenerals(empty(), [0, 3], [9, 5]);
    board[1][4] = '仕';
    assert.deepEqual(targets(h, board, 1, 4), ['0,5', '2,3', '2,5'].sort());
    assert.deepEqual(targets(h, board, 0, 3), ['0,4', '1,3']);
    board[8][4] = '士';
    assert.deepEqual(targets(h, board, 8, 4), ['7,3', '7,5', '9,3'].sort());
});

test('炮 moves like 車 but captures only by jumping exactly one screen', () => {
    const h = harness();
    const board = withGenerals(empty());
    board[2][1] = '炮'; board[5][1] = '兵'; board[8][1] = '馬'; board[9][1] = '車';
    const moves = targets(h, board, 2, 1);
    assert.ok(moves.includes('8,1'), 'captures over one screen');
    assert.ok(!moves.includes('5,1') && !moves.includes('9,1'));
    assert.ok(moves.includes('3,1') && moves.includes('4,1'));
    assert.ok(moves.includes('2,0') && moves.includes('2,8'));
});

test('兵/卒 advance one step and may move sideways only after the river', () => {
    const h = harness();
    const board = withGenerals(empty());
    board[3][0] = '兵';
    assert.deepEqual(targets(h, board, 3, 0), ['4,0']);
    board[5][6] = '兵';
    assert.deepEqual(targets(h, board, 5, 6), ['5,5', '5,7', '6,6'].sort());
    board[6][2] = '卒';
    assert.deepEqual(targets(h, board, 6, 2), ['5,2']);
    board[4][7] = '卒';
    assert.deepEqual(targets(h, board, 4, 7), ['3,7', '4,6', '4,8'].sort());
});

test('generals may not face each other on an open file', () => {
    const h = harness();
    const board = withGenerals(empty(), [0, 4], [9, 4]);
    board[5][4] = '俥';
    const rook = targets(h, board, 5, 4);
    assert.ok(rook.every(to => to.endsWith(',4')), 'the only screen may not leave the file');
    const general = targets(h, empty().map((line, r) => r === 0 ? ['', '', '', '', '帥', '', '', '', ''] : r === 9 ? ['', '', '', '將', '', '', '', '', ''] : line), 0, 4);
    assert.ok(!general.includes('0,3'), 'the general cannot step onto the enemy general\'s file');
});

test('the initial position has the standard 44 opening moves for each side', () => {
    const h = harness();
    vm.runInContext(sourceSection('script.js', 'function getInitialBoardGameState(', 'function getBoardGameState('), h.context);
    h.context.getBoardGamePlayerSides = () => ({ firstPlayer: 'user', firstSide: 'red', userSide: 'red', charSide: 'black' });
    const state = h.context.getInitialBoardGameState('xiangqi', 'user');
    assert.equal(h.context.getBoardSideLegalMoves('xiangqi', state, 'red').length, 44);
    assert.equal(h.context.getBoardSideLegalMoves('xiangqi', state, 'black').length, 44);
});

// Black's general, advisors and elephants are boxed in by their own pieces and blocked elephant eyes.
function boxedBlack() {
    const board = empty();
    board[0][4] = '帥'; board[2][0] = '俥';
    board[9][3] = '將'; board[8][3] = '士'; board[9][4] = '士'; board[7][4] = '象'; board[8][5] = '象';
    board[6][3] = '兵'; board[6][5] = '兵'; board[7][6] = '兵';
    return board;
}

test('capturing the general wins and a side with no legal move loses', () => {
    const h = harness();
    const board = withGenerals(empty(), [0, 4], [9, 3]);
    board[5][3] = '俥';
    const state = { board, turn: 'red', moves: 0 };
    h.context.applyClassicBoardMove('xiangqi', state, { from: [5, 3], to: [9, 3], piece: '俥', capturedPiece: '將' });
    assert.equal(state.winner, 'red');

    const boxed = { board: boxedBlack(), turn: 'red', moves: 0 };
    assert.equal(h.context.getBoardSideLegalMoves('xiangqi', boxed, 'black').length, 0);
    h.context.applyClassicBoardMove('xiangqi', boxed, { from: [2, 0], to: [2, 1], piece: '俥', capturedPiece: '' });
    assert.equal(boxed.winner, 'red', 'black has nothing to move and loses');
});

test('the character never freezes the game when it has no legal move', () => {
    const h = harness();
    Object.assign(h.context, {
        clearBoardGameAutoTurn() {}, isBoardGameReady: () => true, getActiveGame: () => 'xiangqi',
        getBoardGameTurnOwner: () => 'char', finishBoardGameMove() {}
    });
    vm.runInContext(sourceSection('script.js', 'function executeBoardGameAutoMove(', 'function openBoardGameCompanionSetup('), h.context);
    const state = { board: boxedBlack(), turn: 'black', charSide: 'black', userSide: 'red', moves: 12 };
    h.context.getBoardGameStateByType = () => state;
    h.context.executeBoardGameAutoMove('xiangqi');
    assert.equal(state.winner, 'red');
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0][1], 'win');
});

test('the xiangqi AI takes the general and never leaves its own general capturable', () => {
    const h = harness();
    const board = withGenerals(empty(), [0, 4], [9, 3]);
    board[4][3] = '俥';
    assert.equal(h.context.chooseClassicBoardAutoMove('xiangqi', { board, charSide: 'red', turn: 'red' }).to.join(','), '9,3');

    const guard = withGenerals(empty(), [0, 3], [9, 5]);
    guard[5][3] = '車'; guard[1][3] = '仕'; guard[2][8] = '炮';
    const move = h.context.chooseClassicBoardAutoMove('xiangqi', { board: guard, charSide: 'red', turn: 'red' });
    assert.notEqual(move.from.join(','), '1,3', 'the advisor screening the general stays put');
});

test('the chess AI prefers non-repeating quiet moves instead of shuffling a rook', () => {
    const h = harness();
    const board = Array.from({ length: 8 }, () => Array(8).fill(''));
    board[7][4] = '♔'; board[3][7] = '♚'; board[7][0] = '♖';
    const state = { board, charSide: 'white', turn: 'white', charRecentMoves: [] };
    const visited = [];
    for (let turn = 0; turn < 6; turn += 1) {
        const move = h.context.chooseClassicBoardAutoMove('chess', state);
        assert.ok(move);
        visited.push(`${move.from.join(',')}>${move.to.join(',')}`);
        state.board[move.to[0]][move.to[1]] = move.piece;
        state.board[move.from[0]][move.from[1]] = '';
        state.charRecentMoves = [...state.charRecentMoves, { from: move.from, to: move.to }].slice(-6);
    }
    for (let index = 1; index < visited.length; index += 1) {
        const [prevFrom, prevTo] = visited[index - 1].split('>');
        const [from, to] = visited[index].split('>');
        assert.ok(!(from === prevTo && to === prevFrom), `move ${index} undoes the previous move: ${visited.join(' ')}`);
    }
});
