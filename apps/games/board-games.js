function isBoardCompanionGame(type) {
    return ['gomoku', 'chess', 'xiangqi'].includes(type);
}

function getBoardGameMeta(type) {
    return GAME_LIBRARY.find(game => game.id === type) || { id: type, title: '棋盘游戏', tag: 'Board duel', accent: '#171a22' };
}

function getBoardGameCharId(type) {
    const chars = getWolfchaCharacters();
    const saved = localStorage.getItem(BOARD_GAME_CHAR_KEY_PREFIX + type);
    return chars.some(char => char.id === saved) ? saved : '';
}

function getBoardGameChar(type) {
    const selectedId = getBoardGameCharId(type);
    return getWolfchaCharacters().find(char => char.id === selectedId) || null;
}

function isBoardGameReady(type) {
    return isBoardCompanionGame(type) && localStorage.getItem(BOARD_GAME_READY_KEY_PREFIX + type) === '1' && !!getBoardGameChar(type);
}

function selectBoardGameChar(type, id) {
    if (!isBoardCompanionGame(type)) return;
    if (!getWolfchaCharacters().some(char => char.id === id)) return;
    localStorage.setItem(BOARD_GAME_CHAR_KEY_PREFIX + type, id);
    renderGameApp();
}
window.selectBoardGameChar = selectBoardGameChar;

function getBoardGameFirstPlayer(type) {
    const saved = localStorage.getItem(BOARD_GAME_FIRST_KEY_PREFIX + type);
    return saved === 'char' ? 'char' : 'user';
}

function setBoardGameFirstPlayer(type, player) {
    if (!isBoardCompanionGame(type)) return;
    localStorage.setItem(BOARD_GAME_FIRST_KEY_PREFIX + type, player === 'char' ? 'char' : 'user');
    renderGameApp();
}
window.setBoardGameFirstPlayer = setBoardGameFirstPlayer;

function getBoardGameFirstSide(type) {
    if (type === 'gomoku') return 'black';
    if (type === 'xiangqi') return 'red';
    return 'white';
}

function getBoardGameSecondSide(type) {
    if (type === 'gomoku') return 'white';
    if (type === 'xiangqi') return 'black';
    return 'black';
}

function getBoardGameSideLabel(type, side) {
    if (type === 'gomoku') return side === 'black' ? '黑棋' : '白棋';
    if (type === 'xiangqi') return side === 'red' ? '红方' : '黑方';
    return side === 'white' ? '白方' : '黑方';
}

function getBoardGamePlayerSides(type, firstPlayer = getBoardGameFirstPlayer(type)) {
    const firstSide = getBoardGameFirstSide(type);
    const secondSide = getBoardGameSecondSide(type);
    const normalizedFirst = firstPlayer === 'char' ? 'char' : 'user';
    return {
        firstPlayer: normalizedFirst,
        firstSide,
        userSide: normalizedFirst === 'user' ? firstSide : secondSide,
        charSide: normalizedFirst === 'char' ? firstSide : secondSide
    };
}

function getBoardGameTurnOwner(type, state) {
    if (!state) return 'user';
    const sides = {
        userSide: state.userSide || getBoardGamePlayerSides(type).userSide,
        charSide: state.charSide || getBoardGamePlayerSides(type).charSide
    };
    return state.turn === sides.charSide ? 'char' : 'user';
}

function getBoardGameTurnText(type, state) {
    const char = getBoardGameChar(type);
    const owner = getBoardGameTurnOwner(type, state);
    const ownerName = owner === 'char' ? getMusicCharName(char) : '你';
    return `${ownerName} · ${getBoardGameSideLabel(type, state?.turn)}`;
}

function getBoardGameStateByType(type) {
    return type === 'gomoku' ? getGomokuState() : getBoardGameState(type);
}

function saveBoardGameStateByType(type, state) {
    if (type === 'gomoku') saveGomokuState(state);
    else saveBoardGameState(type, state);
}

function clearBoardGameAutoTurn(type) {
    if (BOARD_GAME_AUTO_TIMERS[type]) {
        clearTimeout(BOARD_GAME_AUTO_TIMERS[type]);
        BOARD_GAME_AUTO_TIMERS[type] = 0;
    }
}

function scheduleBoardGameAutoTurn(type, reason = 'turn') {
    if (!isBoardCompanionGame(type) || !isBoardGameReady(type)) return;
    clearBoardGameAutoTurn(type);
    const state = getBoardGameStateByType(type);
    if (!state || state.winner || getBoardGameTurnOwner(type, state) !== 'char') return;
    BOARD_GAME_AUTO_TIMERS[type] = setTimeout(() => executeBoardGameAutoMove(type, reason), 720);
}

function isGomokuInside(row, col) {
    return row >= 0 && row < GOMOKU_BOARD_SIZE && col >= 0 && col < GOMOKU_BOARD_SIZE;
}

function getGomokuCandidateCells(state) {
    const board = state.board || [];
    const occupied = [];
    board.forEach((row, r) => row.forEach((stone, c) => {
        if (stone) occupied.push([r, c]);
    }));
    if (!occupied.length) return [[7, 7]];
    const seen = new Set();
    const cells = [];
    occupied.forEach(([r, c]) => {
        for (let dr = -3; dr <= 3; dr += 1) {
            for (let dc = -3; dc <= 3; dc += 1) {
                const nr = r + dr;
                const nc = c + dc;
                const key = `${nr},${nc}`;
                if (!isGomokuInside(nr, nc) || board[nr]?.[nc] || seen.has(key)) continue;
                seen.add(key);
                cells.push([nr, nc]);
            }
        }
    });
    return cells.sort((a, b) => {
        const da = Math.abs(a[0] - 7) + Math.abs(a[1] - 7);
        const db = Math.abs(b[0] - 7) + Math.abs(b[1] - 7);
        return da - db;
    });
}

function countGomokuDirection(board, row, col, stone, dr, dc) {
    let count = 0;
    let r = row + dr;
    let c = col + dc;
    while (isGomokuInside(r, c) && board[r]?.[c] === stone) {
        count += 1;
        r += dr;
        c += dc;
    }
    return { count, endRow: r, endCol: c };
}

function scoreGomokuLine(total, openEnds) {
    if (total >= 5) return 1000000;
    if (total === 4 && openEnds === 2) return 260000;
    if (total === 4 && openEnds === 1) return 120000;
    if (total === 3 && openEnds === 2) return 36000;
    if (total === 3 && openEnds === 1) return 9000;
    if (total === 2 && openEnds === 2) return 2600;
    if (total === 2 && openEnds === 1) return 900;
    return total * 80 + openEnds * 45;
}

function scoreGomokuWindow(board, row, col, stone, dr, dc) {
    let score = 0;
    for (let start = -4; start <= 0; start += 1) {
        const cells = [];
        let hasCandidate = false;
        let blocked = false;
        for (let offset = 0; offset < 5; offset += 1) {
            const step = start + offset;
            const r = row + dr * step;
            const c = col + dc * step;
            if (!isGomokuInside(r, c)) {
                blocked = true;
                break;
            }
            if (step === 0) hasCandidate = true;
            const value = step === 0 ? stone : board[r]?.[c];
            if (value && value !== stone) {
                blocked = true;
                break;
            }
            cells.push(value === stone ? 'stone' : 'empty');
        }
        if (blocked || !hasCandidate) continue;
        const stones = cells.filter(value => value === 'stone').length;
        const beforeRow = row + dr * (start - 1);
        const beforeCol = col + dc * (start - 1);
        const afterRow = row + dr * (start + 5);
        const afterCol = col + dc * (start + 5);
        const openEnds = Number(isGomokuInside(beforeRow, beforeCol) && !board[beforeRow]?.[beforeCol])
            + Number(isGomokuInside(afterRow, afterCol) && !board[afterRow]?.[afterCol]);
        if (stones === 4) score += openEnds === 2 ? 90000 : 42000;
        else if (stones === 3) score += openEnds === 2 ? 15000 : 5200;
        else if (stones === 2) score += openEnds === 2 ? 1800 : 500;
    }
    return score;
}

function scoreGomokuPlacement(state, row, col, stone) {
    const board = state.board || [];
    if (!isGomokuInside(row, col) || board[row]?.[col]) return -Infinity;
    let score = 0;
    let openFour = 0;
    let blockedFour = 0;
    let openThree = 0;
    let strongLines = 0;
    for (const [dr, dc] of GOMOKU_DIRECTIONS) {
        const forward = countGomokuDirection(board, row, col, stone, dr, dc);
        const backward = countGomokuDirection(board, row, col, stone, -dr, -dc);
        const total = forward.count + backward.count + 1;
        const openEnds = Number(isGomokuInside(forward.endRow, forward.endCol) && !board[forward.endRow]?.[forward.endCol])
            + Number(isGomokuInside(backward.endRow, backward.endCol) && !board[backward.endRow]?.[backward.endCol]);
        const lineScore = scoreGomokuLine(total, openEnds);
        score += lineScore + scoreGomokuWindow(board, row, col, stone, dr, dc);
        if (total >= 5) strongLines += 4;
        else if (total === 4 && openEnds === 2) {
            openFour += 1;
            strongLines += 3;
        } else if (total === 4 && openEnds === 1) {
            blockedFour += 1;
            strongLines += 2;
        } else if (total === 3 && openEnds === 2) {
            openThree += 1;
            strongLines += 1;
        }
    }
    if (openFour) score += 180000 * openFour;
    if (blockedFour >= 2) score += 140000;
    if (openThree >= 2) score += 110000;
    if (openThree && blockedFour) score += 90000;
    if (strongLines >= 4) score += 50000;
    const centerDistance = Math.abs(row - 7) + Math.abs(col - 7);
    score += Math.max(0, 14 - centerDistance) * 55;
    return score;
}

function findGomokuTacticalMove(state, stone) {
    const candidates = getGomokuCandidateCells(state);
    for (const [r, c] of candidates) {
        state.board[r][c] = stone;
        const wins = checkGomokuWin(state.board, r, c, stone);
        state.board[r][c] = '';
        if (wins) return { row: r, col: c };
    }
    return null;
}

function chooseGomokuAutoMove(state) {
    const charStone = state.charSide || state.turn;
    const userStone = state.userSide || (charStone === 'black' ? 'white' : 'black');
    const win = findGomokuTacticalMove(state, charStone);
    if (win) return win;
    const block = findGomokuTacticalMove(state, userStone);
    if (block) return block;
    const candidates = getGomokuCandidateCells(state);
    const ranked = candidates.map(([row, col]) => {
        const attack = scoreGomokuPlacement(state, row, col, charStone);
        const defense = scoreGomokuPlacement(state, row, col, userStone);
        const centerDistance = Math.abs(row - 7) + Math.abs(col - 7);
        return {
            row,
            col,
            attack,
            defense,
            score: attack + defense * 1.08 - centerDistance * 6
        };
    }).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.attack !== a.attack) return b.attack - a.attack;
        return (Math.abs(a.row - 7) + Math.abs(a.col - 7)) - (Math.abs(b.row - 7) + Math.abs(b.col - 7));
    });
    const urgentDefense = ranked.find(move => move.defense >= 120000);
    const bestAttack = ranked[0];
    if (urgentDefense && (!bestAttack || bestAttack.attack < urgentDefense.defense * 1.15)) {
        return { row: urgentDefense.row, col: urgentDefense.col };
    }
    return bestAttack ? { row: bestAttack.row, col: bestAttack.col } : null;
}

function getBoardGamePieceSide(type, piece, row) {
    if (!piece) return '';
    if (type === 'chess') {
        if ('♙♖♘♗♕♔'.includes(piece)) return 'white';
        if ('♟♜♞♝♛♚'.includes(piece)) return 'black';
    }
    if (type === 'xiangqi') {
        if ('俥傌兵炮相仕帥'.includes(piece)) return 'red';
        if ('車馬卒砲象士將'.includes(piece)) return 'black';
    }
    return '';
}

function isBoardCellInside(type, row, col) {
    const maxRow = type === 'xiangqi' ? 10 : 8;
    const maxCol = type === 'xiangqi' ? 9 : 8;
    return row >= 0 && row < maxRow && col >= 0 && col < maxCol;
}

function getChessPieceKind(piece) {
    const map = {
        '♙': 'pawn', '♟': 'pawn',
        '♖': 'rook', '♜': 'rook',
        '♘': 'knight', '♞': 'knight',
        '♗': 'bishop', '♝': 'bishop',
        '♕': 'queen', '♛': 'queen',
        '♔': 'king', '♚': 'king'
    };
    return map[piece] || '';
}

function isChessPathClear(board, fromRow, fromCol, toRow, toCol) {
    const dr = Math.sign(toRow - fromRow);
    const dc = Math.sign(toCol - fromCol);
    let row = fromRow + dr;
    let col = fromCol + dc;
    while (row !== toRow || col !== toCol) {
        if (board[row]?.[col]) return false;
        row += dr;
        col += dc;
    }
    return true;
}

function isChessMoveShapeLegal(board, piece, fromRow, fromCol, toRow, toCol) {
    if (!isBoardCellInside('chess', toRow, toCol)) return false;
    const side = getBoardGamePieceSide('chess', piece, fromRow);
    const target = board[toRow]?.[toCol] || '';
    if (!side || (target && getBoardGamePieceSide('chess', target, toRow) === side)) return false;
    const kind = getChessPieceKind(piece);
    const dr = toRow - fromRow;
    const dc = toCol - fromCol;
    const absR = Math.abs(dr);
    const absC = Math.abs(dc);
    if (kind === 'pawn') {
        const dir = side === 'white' ? -1 : 1;
        const startRow = side === 'white' ? 6 : 1;
        if (dc === 0 && dr === dir && !target) return true;
        if (dc === 0 && fromRow === startRow && dr === dir * 2 && !target && !board[fromRow + dir]?.[fromCol]) return true;
        if (absC === 1 && dr === dir && target && getBoardGamePieceSide('chess', target, toRow) !== side) return true;
        return false;
    }
    if (kind === 'rook') return (dr === 0 || dc === 0) && isChessPathClear(board, fromRow, fromCol, toRow, toCol);
    if (kind === 'bishop') return absR === absC && isChessPathClear(board, fromRow, fromCol, toRow, toCol);
    if (kind === 'queen') return (dr === 0 || dc === 0 || absR === absC) && isChessPathClear(board, fromRow, fromCol, toRow, toCol);
    if (kind === 'knight') return (absR === 2 && absC === 1) || (absR === 1 && absC === 2);
    if (kind === 'king') return Math.max(absR, absC) === 1;
    return false;
}

function getChessLegalMoves(state, row, col) {
    const board = state.board || [];
    const piece = board[row]?.[col] || '';
    if (!piece) return [];
    const side = getBoardGamePieceSide('chess', piece, row);
    if (!side) return [];
    const moves = [];
    for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
            if (!isChessMoveShapeLegal(board, piece, row, col, r, c)) continue;
            const capturedPiece = board[r]?.[c] || '';
            moves.push({ from: [row, col], to: [r, c], piece, capturedPiece, row: r, col: c });
        }
    }
    return moves;
}

const XIANGQI_PIECE_KINDS = {
    '俥': 'rook', '車': 'rook', '傌': 'horse', '馬': 'horse', '相': 'elephant', '象': 'elephant',
    '仕': 'advisor', '士': 'advisor', '帥': 'general', '將': 'general', '炮': 'cannon', '砲': 'cannon', '兵': 'soldier', '卒': 'soldier'
};

function getXiangqiPieceKind(piece) {
    return XIANGQI_PIECE_KINDS[piece] || '';
}

// Red starts on rows 0-4 and advances toward row 9; black the reverse. The river
// lies between rows 4 and 5 and each palace spans columns 3-5.
function getXiangqiPseudoMoves(board, row, col) {
    const piece = board[row]?.[col] || '';
    const side = getBoardGamePieceSide('xiangqi', piece, row);
    const kind = getXiangqiPieceKind(piece);
    if (!side || !kind) return [];
    const forward = side === 'red' ? 1 : -1;
    const ownHalf = r => side === 'red' ? r <= 4 : r >= 5;
    const inPalace = (r, c) => c >= 3 && c <= 5 && (side === 'red' ? r >= 0 && r <= 2 : r >= 7 && r <= 9);
    const inside = (r, c) => isBoardCellInside('xiangqi', r, c);
    const at = (r, c) => board[r]?.[c] || '';
    const enemy = (r, c) => !!at(r, c) && getBoardGamePieceSide('xiangqi', at(r, c), r) !== side;
    const targets = [];
    const add = (r, c) => { if (inside(r, c) && (!at(r, c) || enemy(r, c))) targets.push([r, c]); };
    const orthogonal = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if (kind === 'rook' || kind === 'cannon') {
        for (const [dr, dc] of orthogonal) {
            let screened = false;
            for (let r = row + dr, c = col + dc; inside(r, c); r += dr, c += dc) {
                if (!at(r, c)) { if (!screened) targets.push([r, c]); continue; }
                // 車 captures the first piece; 炮 needs exactly one screen before its capture.
                if (kind === 'rook' || screened) { if (enemy(r, c)) targets.push([r, c]); break; }
                screened = true;
            }
        }
    } else if (kind === 'horse') {
        for (const [dr, dc] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) {
            const legRow = Math.abs(dr) === 2 ? row + dr / 2 : row;
            const legCol = Math.abs(dc) === 2 ? col + dc / 2 : col;
            if (!at(legRow, legCol)) add(row + dr, col + dc); // 蹩马腿
        }
    } else if (kind === 'elephant') {
        for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
            if (ownHalf(row + dr) && inside(row + dr, col + dc) && !at(row + dr / 2, col + dc / 2)) add(row + dr, col + dc); // 塞象眼, no river crossing
        }
    } else if (kind === 'advisor') {
        for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (inPalace(row + dr, col + dc)) add(row + dr, col + dc);
    } else if (kind === 'general') {
        for (const [dr, dc] of orthogonal) if (inPalace(row + dr, col + dc)) add(row + dr, col + dc);
    } else if (kind === 'soldier') {
        add(row + forward, col);
        if (!ownHalf(row)) { add(row, col - 1); add(row, col + 1); }
    }
    return targets.map(([r, c]) => ({ from: [row, col], to: [r, c], piece, capturedPiece: at(r, c), row: r, col: c }));
}

function findXiangqiGeneral(board, side) {
    for (let r = 0; r < board.length; r += 1) {
        for (let c = 0; c < (board[r] || []).length; c += 1) {
            const piece = board[r][c];
            if (getXiangqiPieceKind(piece) === 'general' && getBoardGamePieceSide('xiangqi', piece, r) === side) return [r, c];
        }
    }
    return null;
}

function areXiangqiGeneralsFacing(board) {
    const red = findXiangqiGeneral(board, 'red');
    const black = findXiangqiGeneral(board, 'black');
    if (!red || !black || red[1] !== black[1]) return false;
    for (let r = Math.min(red[0], black[0]) + 1; r < Math.max(red[0], black[0]); r += 1) {
        if (board[r]?.[red[1]]) return false;
    }
    return true;
}

function getXiangqiLegalMoves(state, row, col) {
    const board = state.board || [];
    return getXiangqiPseudoMoves(board, row, col).filter(move => {
        if (getXiangqiPieceKind(move.capturedPiece) === 'general') return true;
        const next = board.map(line => line.slice());
        next[move.to[0]][move.to[1]] = move.piece;
        next[row][col] = '';
        return !areXiangqiGeneralsFacing(next); // 将帅不能照面
    });
}

function getBoardSideLegalMoves(type, state, side) {
    const moves = [];
    (state.board || []).forEach((line, r) => line.forEach((piece, c) => {
        if (piece && getBoardGamePieceSide(type, piece, r) === side) moves.push(...getBoardLegalMoves(type, state, r, c));
    }));
    return moves;
}

function getBoardLegalMoves(type, state, row, col) {
    if (type === 'chess') return getChessLegalMoves(state, row, col);
    if (type === 'xiangqi') return getXiangqiLegalMoves(state, row, col);
    return [];
}

const BOARD_AI_PIECE_VALUES = {
    chess: { king: 999, queen: 90, rook: 50, bishop: 32, knight: 31, pawn: 10 },
    xiangqi: { general: 999, rook: 90, cannon: 45, horse: 40, elephant: 20, advisor: 20, soldier: 10 }
};

function getBoardPieceKind(type, piece) {
    return type === 'xiangqi' ? getXiangqiPieceKind(piece) : getChessPieceKind(piece);
}

function getBoardAiPieceValue(type, piece) {
    if (!piece) return 0;
    return BOARD_AI_PIECE_VALUES[type]?.[getBoardPieceKind(type, piece)] || 1;
}

function isBoardLeaderPiece(type, piece) {
    return ['king', 'general'].includes(getBoardPieceKind(type, piece));
}

function getOppositeBoardSide(type, side) {
    if (type === 'xiangqi') return side === 'red' ? 'black' : 'red';
    return side === 'white' ? 'black' : 'white';
}

function chooseClassicBoardAutoMove(type, state) {
    const ownSide = state.charSide || state.turn;
    const enemySide = getOppositeBoardSide(type, ownSide);
    const forward = type === 'xiangqi' ? (ownSide === 'red' ? 1 : -1) : (ownSide === 'white' ? -1 : 1);
    const recent = Array.isArray(state.charRecentMoves) ? state.charRecentMoves.slice(-6) : [];
    const last = recent[recent.length - 1];
    const sameSquare = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
    const scored = getBoardSideLegalMoves(type, state, ownSide).map((move, index) => {
        let score = getBoardAiPieceValue(type, move.capturedPiece) * 10;
        if (isBoardLeaderPiece(type, move.capturedPiece)) score += 100000;
        else {
            const board = state.board.map(line => line.slice());
            board[move.to[0]][move.to[1]] = move.piece;
            board[move.from[0]][move.from[1]] = '';
            const replies = getBoardSideLegalMoves(type, { ...state, board }, enemySide);
            // Never leave the king/general capturable; avoid dropping the piece just moved.
            if (replies.some(reply => isBoardLeaderPiece(type, reply.capturedPiece))) score -= 50000;
            else if (replies.some(reply => sameSquare(reply.to, move.to))) score -= getBoardAiPieceValue(type, move.piece) * 5;
        }
        // Without a capture, shuffling a piece back and forth is the worst kind of quiet move.
        if (recent.some(item => sameSquare(item.from, move.to))) score -= 30;
        if (last && sameSquare(last.to, move.from)) score -= 8;
        score += (move.to[0] - move.from[0]) * forward;
        return { move, score, index };
    });
    scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
    return scored[0]?.move || null;
}

function promoteChessPieceIfNeeded(piece, toRow) {
    if (piece === '♙' && toRow === 0) return '♕';
    if (piece === '♟' && toRow === 7) return '♛';
    return piece;
}

function applyClassicBoardMove(type, state, move) {
    const from = move.from;
    const to = move.to;
    const movingPiece = move.piece || state.board[from[0]]?.[from[1]] || '';
    const capturedPiece = move.capturedPiece || state.board[to[0]]?.[to[1]] || '';
    state.board[to[0]][to[1]] = type === 'chess' ? promoteChessPieceIfNeeded(movingPiece, to[0]) : movingPiece;
    state.board[from[0]][from[1]] = '';
    state.selected = null;
    state.moves = (state.moves || 0) + 1;
    const moverSide = getBoardGamePieceSide(type, movingPiece, from[0]);
    if (isBoardLeaderPiece(type, capturedPiece)) {
        state.winner = moverSide;
    } else {
        state.turn = getOppositeBoardSide(type, state.turn);
        // In xiangqi a side left without any legal move (checkmate or stalemate) loses.
        if (type === 'xiangqi' && !getBoardSideLegalMoves(type, state, state.turn).length) state.winner = moverSide;
    }
    return { ...move, piece: movingPiece, capturedPiece };
}

function getBoardGameCommentRateKey(type) {
    return `${BOARD_GAME_COMMENT_RATE_KEY_PREFIX}${type}_${getBoardGameCharId(type) || 'default'}`;
}

function getBoardGameCommentRate(type) {
    try {
        const data = JSON.parse(localStorage.getItem(getBoardGameCommentRateKey(type)) || '{}');
        if (data && typeof data === 'object') return data;
    } catch (e) {}
    return {};
}

function saveBoardGameCommentRate(type, data) {
    localStorage.setItem(getBoardGameCommentRateKey(type), JSON.stringify(data || {}));
}

function isBoardGameAutoCommentReason(reason) {
    return reason === 'char-move' || reason === 'user-move';
}

function getBoardGameMoveCountForComment(type, payload = {}) {
    if (Number.isFinite(payload.moveCount)) return Number(payload.moveCount);
    const state = payload.state || getBoardGameStateByType(type);
    return Number(state?.moves || 0);
}

// The relay rejects back-to-back calls: board comments keep one request at a time
// with a quiet gap, and only the final win comment may queue behind another.
const BOARD_GAME_MIN_REQUEST_GAP_MS = 6000;
const boardGameCommentInFlight = new Map();

function reserveBoardGameAiComment(type, reason, payload = {}) {
    const now = Date.now();
    const rate = getBoardGameCommentRate(type);
    if (rate.pauseUntil && now < rate.pauseUntil) {
        return { allowed: false, reason: 'paused', retryMs: rate.pauseUntil - now };
    }
    if (reason !== 'win') {
        if (boardGameCommentInFlight.has(type)) return { allowed: false, reason: 'in-flight' };
        const sinceLast = now - Number(rate.lastRequestAt || 0);
        if (sinceLast >= 0 && sinceLast < BOARD_GAME_MIN_REQUEST_GAP_MS) {
            return { allowed: false, reason: 'request-gap', retryMs: BOARD_GAME_MIN_REQUEST_GAP_MS - sinceLast };
        }
    }
    if (reason === 'manual') {
        if (now - Number(rate.lastManualAt || 0) < BOARD_GAME_MANUAL_COMMENT_COOLDOWN_MS) {
            return { allowed: false, reason: 'manual-cooldown' };
        }
        rate.lastManualAt = now;
    } else if (isBoardGameAutoCommentReason(reason)) {
        const moveCount = getBoardGameMoveCountForComment(type, payload);
        if (!moveCount || moveCount % BOARD_GAME_AUTO_COMMENT_EVERY_MOVES !== 0) {
            return { allowed: false, reason: 'move-spacing' };
        }
        if (now - Number(rate.lastAutoAt || 0) < BOARD_GAME_AUTO_COMMENT_COOLDOWN_MS) {
            return { allowed: false, reason: 'auto-cooldown' };
        }
        rate.lastAutoAt = now;
    } else if (reason === 'start' || reason === 'reset') {
        if (now - Number(rate.lastSetupAt || 0) < BOARD_GAME_AUTO_COMMENT_COOLDOWN_MS) {
            return { allowed: false, reason: 'setup-cooldown' };
        }
        rate.lastSetupAt = now;
    } else if (reason === 'win') {
        const moveCount = getBoardGameMoveCountForComment(type, payload);
        if (rate.lastWinMove === moveCount && now - Number(rate.lastWinAt || 0) < BOARD_GAME_AUTO_COMMENT_COOLDOWN_MS) {
            return { allowed: false, reason: 'win-cooldown' };
        }
        rate.lastWinAt = now;
        rate.lastWinMove = moveCount;
    }
    rate.lastRequestAt = now;
    saveBoardGameCommentRate(type, rate);
    return { allowed: true };
}

function isBoardGameRateLimitError(value) {
    return /429|rate.?limit|too many|请求限制|请求过于频繁|达到.*限制/i.test(String(value || ''));
}

function pauseBoardGameAiComments(type) {
    const rate = getBoardGameCommentRate(type);
    rate.pauseUntil = Date.now() + BOARD_GAME_RATE_LIMIT_PAUSE_MS;
    saveBoardGameCommentRate(type, rate);
}

function finishBoardGameMove(type, state, move, actor) {
    saveBoardGameStateByType(type, state);
    renderGameApp();
    const row = Number.isInteger(move.row) ? move.row : move.to?.[0];
    const col = Number.isInteger(move.col) ? move.col : move.to?.[1];
    const sideText = getBoardGameSideLabel(type, move.side || move.placedStone || state.charSide || state.turn);
    const reason = state.winner ? 'win' : (actor === 'char' ? 'char-move' : 'user-move');
    const action = state.winner
        ? `${sideText}获胜了，请按人设对这一局说一句收尾气泡。`
        : actor === 'char'
        ? `你刚刚替自己下了${sideText}，位置是第${(row || 0) + 1}行第${(col || 0) + 1}列。请按人设对这一步说一句话。`
        : `用户刚刚下了${sideText}。请自然评价这一手。`;
    requestBoardGameAiComment(type, reason, { action, actor, row, col, move, moveCount: state.moves || 0 });
    if (!state.winner && getBoardGameTurnOwner(type, state) === 'char') scheduleBoardGameAutoTurn(type, 'after-move');
}

function executeBoardGameAutoMove(type, reason = 'auto') {
    clearBoardGameAutoTurn(type);
    if (!isBoardGameReady(type) || getActiveGame() !== type) return;
    const state = getBoardGameStateByType(type);
    if (!state || state.winner || getBoardGameTurnOwner(type, state) !== 'char') return;
    if (type === 'gomoku') {
        const move = chooseGomokuAutoMove(state);
        if (!move) return;
        const placedStone = state.turn;
        state.board[move.row][move.col] = placedStone;
        state.moves = (state.moves || 0) + 1;
        if (checkGomokuWin(state.board, move.row, move.col, placedStone)) {
            state.winner = placedStone;
        } else {
            state.turn = placedStone === 'black' ? 'white' : 'black';
        }
        finishBoardGameMove(type, state, { ...move, placedStone }, 'char');
        return;
    }
    const move = chooseClassicBoardAutoMove(type, state);
    if (!move) {
        // A side with nothing to move must not freeze the game: in xiangqi it loses.
        if (type !== 'xiangqi') return;
        state.winner = getOppositeBoardSide(type, state.charSide || state.turn);
        saveBoardGameState(type, state);
        renderGameApp();
        requestBoardGameAiComment(type, 'win', { action: `你已经无子可走，${getBoardGameSideLabel(type, state.winner)}获胜了，请按人设对这一局说一句收尾气泡。`, moveCount: state.moves || 0 });
        return;
    }
    const applied = applyClassicBoardMove(type, state, move);
    state.charRecentMoves = [...(Array.isArray(state.charRecentMoves) ? state.charRecentMoves : []), { from: applied.from, to: applied.to }].slice(-6);
    finishBoardGameMove(type, state, { ...applied, side: state.charSide }, 'char');
}

function openBoardGameCompanionSetup(type) {
    if (!isBoardCompanionGame(type)) return;
    localStorage.removeItem(BOARD_GAME_READY_KEY_PREFIX + type);
    setActiveGame(type);
    renderGameApp();
}
window.openBoardGameCompanionSetup = openBoardGameCompanionSetup;

function startBoardGameWithChar(type) {
    const char = getBoardGameChar(type);
    if (!char) {
        if (typeof showWechatToast === 'function') showWechatToast('先选择一位陪玩的角色');
        return;
    }
    const firstPlayer = getBoardGameFirstPlayer(type);
    if (type === 'gomoku') {
        saveGomokuState(createGomokuState(firstPlayer));
    } else {
        saveBoardGameState(type, getInitialBoardGameState(type, firstPlayer));
    }
    const sides = getBoardGamePlayerSides(type, firstPlayer);
    const firstName = firstPlayer === 'char' ? getMusicCharName(char) : '你';
    localStorage.setItem(BOARD_GAME_READY_KEY_PREFIX + type, '1');
    saveBoardGameChat(type, {
        status: 'idle',
        text: `棋局已创建，${firstName}先手。`,
        updatedAt: Date.now()
    });
    renderGameApp();
    requestBoardGameAiComment(type, 'start', {
        action: `刚进入${getBoardGameMeta(type).title}棋局，${firstName}先手，用户执${getBoardGameSideLabel(type, sides.userSide)}，你执${getBoardGameSideLabel(type, sides.charSide)}，请开局说一句头像旁边的小气泡。`
    });
    scheduleBoardGameAutoTurn(type, 'start');
}
window.startBoardGameWithChar = startBoardGameWithChar;

function getBoardGameChat(type) {
    try {
        const data = JSON.parse(localStorage.getItem(BOARD_GAME_CHAT_KEY_PREFIX + type) || '{}');
        if (data && typeof data === 'object') return normalizeBoardGameChat(data);
    } catch (e) {}
    return normalizeBoardGameChat({ status: 'idle', text: '等待真实角色发言。', updatedAt: 0 });
}

function normalizeBoardGameChat(data = {}) {
    const status = data.status || 'idle';
    return {
        ...data,
        status,
        source: data.source || (status === 'done' ? 'api' : 'system')
    };
}

function saveBoardGameChat(type, data) {
    localStorage.setItem(BOARD_GAME_CHAT_KEY_PREFIX + type, JSON.stringify(normalizeBoardGameChat(data || {})));
}

function summarizeBoardGame(type, payload = {}) {
    if (type === 'gomoku') {
        const state = getGomokuState();
        const black = state.board.flat().filter(value => value === 'black').length;
        const white = state.board.flat().filter(value => value === 'white').length;
        const status = state.winner ? `${state.winner === 'black' ? '黑棋' : '白棋'}已经获胜` : `当前轮到${state.turn === 'black' ? '黑棋' : '白棋'}`;
        return `${status}；总步数${state.moves || 0}；黑棋${black}，白棋${white}；${payload.action || ''}`;
    }
    const state = getBoardGameState(type);
    const pieces = state.board.flat().filter(Boolean).length;
    const turn = type === 'xiangqi'
        ? (state.turn === 'red' ? '红方' : '黑方')
        : (state.turn === 'white' ? '白方' : '黑方');
    return `当前轮到${turn}；棋盘上还有${pieces}枚棋子；${payload.action || ''}`;
}

async function requestBoardGameAiComment(type, reason = 'manual', payload = {}) {
    if (!isBoardCompanionGame(type)) return;
    const char = getBoardGameChar(type);
    if (!char) {
        saveBoardGameChat(type, { status: 'error', text: '先选择一位陪玩的角色。', updatedAt: Date.now() });
        renderGameApp();
        return;
    }
    const meta = getBoardGameMeta(type);
    const reserved = reserveBoardGameAiComment(type, reason, payload);
    if (!reserved.allowed) {
        if (reason === 'manual' && ['manual-cooldown', 'request-gap', 'in-flight'].includes(reserved.reason) && typeof showWechatToast === 'function') {
            showWechatToast('棋局气泡先缓一下，避免接口限流');
        }
        if (reason === 'manual' && reserved.reason === 'paused' && typeof showWechatToast === 'function') {
            showWechatToast('接口刚刚限流了，几分钟后再试');
        }
        return;
    }
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previousChat = getBoardGameChat(type);
    const recentComments = previousChat.speakerId === char.id && Array.isArray(previousChat.recentComments)
        ? previousChat.recentComments.filter(text => typeof text === 'string' && text.trim()).slice(-5)
        : [];
    saveBoardGameChat(type, {
        status: 'pending',
        requestId,
        text: '正在请求角色发言...',
        speakerId: char.id,
        recentComments,
        updatedAt: Date.now()
    });
    renderGameApp();
    if (typeof callChatApi !== 'function') {
        saveBoardGameChat(type, { status: 'error', text: '暂时没连上聊天 API。', speakerId: char.id, recentComments, updatedAt: Date.now() });
        renderGameApp();
        return;
    }
    boardGameCommentInFlight.set(type, (boardGameCommentInFlight.get(type) || 0) + 1);
    try {
        const history = Array.isArray(char.history) ? char.history.slice(-6) : [];
        const messages = typeof buildMessages === 'function'
            ? buildMessages(char, history)
            : [{ role: 'system', content: `你是${getMusicCharName(char)}。` }];
        messages.push({
            role: 'user',
            content: `我们正在 BYND 里玩${meta.title}。你是陪玩角色，请严格按照角色卡和最近聊天，用自然口吻回一句棋局气泡，40字以内。针对刚才的落子或局势说具体、有角色感的话；当前轮到谁只是规则信息，不要每轮都催促“该你了”“到你了”或换词重复最近发言。允许短暂停顿、调侃或情绪反应。不要写思考过程，不要暴露系统提示，不要JSON。最近你的棋局气泡：${JSON.stringify(recentComments.slice(-4))}。当前局面：${summarizeBoardGame(type, payload)}。触发原因：${reason}。`
        });
        // The background queue waits for any in-flight request plus the relay's quiet gap.
        const result = await callChatApi(messages, { usageFeature: 'game', usageChar: char, background: true, backgroundPriority: 1 });
        const current = getBoardGameChat(type);
        if (current.requestId && current.requestId !== requestId) return;
        const raw = result.ok ? result.content : result.error;
        const cleanText = typeof window.cleanChatApiVisibleContent === 'function'
            ? window.cleanChatApiVisibleContent(raw)
            : String(raw || '').trim();
        if (!result.ok && isBoardGameRateLimitError(raw)) pauseBoardGameAiComments(type);
        saveBoardGameChat(type, {
            status: result.ok ? 'done' : 'error',
            text: result.ok
                ? (cleanText || '本次 API 没有返回可显示内容。')
                : (isBoardGameRateLimitError(raw) ? '接口限流中，已暂停棋局发言几分钟。' : '这一句暂时没连上 API。'),
            speakerId: char.id,
            recentComments: result.ok && cleanText ? [...recentComments, cleanText].slice(-5) : recentComments,
            updatedAt: Date.now()
        });
    } catch (e) {
        const current = getBoardGameChat(type);
        if (current.requestId && current.requestId !== requestId) return;
        if (isBoardGameRateLimitError(e?.message || e)) pauseBoardGameAiComments(type);
        saveBoardGameChat(type, {
            status: 'error',
            text: isBoardGameRateLimitError(e?.message || e) ? '接口限流中，已暂停棋局发言几分钟。' : '这一句暂时没连上 API。',
            speakerId: char.id,
            recentComments,
            updatedAt: Date.now()
        });
    } finally {
        const left = (boardGameCommentInFlight.get(type) || 1) - 1;
        if (left > 0) boardGameCommentInFlight.set(type, left); else boardGameCommentInFlight.delete(type);
    }
    if (getActiveGame() === type) renderGameApp();
}
window.requestBoardGameAiComment = requestBoardGameAiComment;

function renderBoardGameCompanionSetup(el, type) {
    const meta = getBoardGameMeta(type);
    const chars = getWolfchaCharacters();
    const selectedId = getBoardGameCharId(type);
    const selectedChar = chars.find(char => char.id === selectedId);
    const firstPlayer = getBoardGameFirstPlayer(type);
    const sides = getBoardGamePlayerSides(type, firstPlayer);
    const charName = selectedChar ? getMusicCharName(selectedChar) : '角色';
    el.innerHTML = `
        <section class="mini-game-panel board-companion-setup">
            <div class="board-companion-hero" style="--game-accent:${musicEscapeAttr(meta.accent || '#171a22')}">
                <span>${musicEscapeHtml(meta.genre || 'BOARD DUEL')}</span>
                <strong>${musicEscapeHtml(meta.title)}</strong>
                <p>先选择一位角色陪你玩。进入棋局后，对方会根据角色卡和最近聊天，用文字气泡回应你的落子。</p>
            </div>
            <div class="board-companion-list">
                ${chars.length ? chars.map(char => {
                    const active = char.id === selectedId;
                    return `
                        <button type="button" class="${active ? 'active' : ''}" onclick="selectBoardGameChar('${musicEscapeAttr(type)}','${musicEscapeAttr(char.id)}')">
                            <div>${char.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(getMusicCharName(char))}">` : '<i class="ri-user-smile-line"></i>'}</div>
                            <strong>${musicEscapeHtml(getMusicCharName(char))}</strong>
                            <span>${active ? '已选择' : '选择陪玩'}</span>
                        </button>
                    `;
                }).join('') : '<div class="board-companion-empty">先在微信导入角色，再回来选择陪玩的 AI。</div>'}
            </div>
            <div class="board-first-picker">
                <div>
                    <span>先手</span>
                    <strong>谁先下棋</strong>
                </div>
                <button type="button" class="${firstPlayer === 'user' ? 'active' : ''}" onclick="setBoardGameFirstPlayer('${musicEscapeAttr(type)}','user')">
                    <b>我先</b><small>${musicEscapeHtml(getBoardGameSideLabel(type, getBoardGameFirstSide(type)))}</small>
                </button>
                <button type="button" class="${firstPlayer === 'char' ? 'active' : ''}" onclick="setBoardGameFirstPlayer('${musicEscapeAttr(type)}','char')" ${selectedId ? '' : 'disabled'}>
                    <b>${musicEscapeHtml(charName)}先</b><small>${musicEscapeHtml(getBoardGameSideLabel(type, getBoardGameFirstSide(type)))}</small>
                </button>
                <em>你：${musicEscapeHtml(getBoardGameSideLabel(type, sides.userSide))} / ${musicEscapeHtml(charName)}：${musicEscapeHtml(getBoardGameSideLabel(type, sides.charSide))}</em>
            </div>
            <div class="board-companion-actions">
                <button type="button" onclick="openGameHub()">先返回</button>
                <button type="button" class="primary" onclick="startBoardGameWithChar('${musicEscapeAttr(type)}')" ${selectedId ? '' : 'disabled'}><i class="ri-play-fill"></i> 进入棋局</button>
            </div>
        </section>
    `;
}

function renderBoardGameCompanionBar(type) {
    const char = getBoardGameChar(type);
    const chat = getBoardGameChat(type);
    const name = char ? getMusicCharName(char) : 'AI 陪玩';
    const text = chat.text || '真实角色发言会显示在这里。';
    const isApiSpeech = chat.source === 'api';
    const state = type === 'gomoku' ? getGomokuState() : getBoardGameState(type);
    const turnText = getBoardGameTurnText(type, state);
    return `
        <div class="board-companion-card">
            <div class="board-companion-avatar">${char?.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(name)}">` : '<i class="ri-user-smile-line"></i>'}</div>
            <div class="board-companion-main">
                <div class="board-companion-head">
                    <div class="board-companion-copy">
                        <span>${musicEscapeHtml(turnText)}</span>
                        <strong>${musicEscapeHtml(name)}</strong>
                    </div>
                    <button type="button" onclick="openBoardGameCompanionSetup('${musicEscapeAttr(type)}')">换人</button>
                </div>
                <div class="board-inline-speech ${isApiSpeech ? 'api' : 'system'} ${chat.status === 'pending' ? 'thinking' : ''} ${chat.status === 'error' ? 'error' : ''}">
                    ${isApiSpeech ? '' : '<span class="board-speech-source">系统状态</span>'}
                    <p>${musicEscapeHtml(text)}</p>
                    <button type="button" aria-label="让角色说一句" onclick="requestBoardGameAiComment('${musicEscapeAttr(type)}','manual',{ action: '用户想听你对当前棋局说一句话。' })"><i class="ri-chat-smile-3-line"></i></button>
                </div>
            </div>
        </div>
    `;
}

function createGomokuState(firstPlayer = getBoardGameFirstPlayer('gomoku')) {
    const sides = getBoardGamePlayerSides('gomoku', firstPlayer);
    return {
        board: Array.from({ length: 15 }, () => Array(15).fill('')),
        turn: sides.firstSide,
        winner: '',
        moves: 0,
        firstPlayer: sides.firstPlayer,
        userSide: sides.userSide,
        charSide: sides.charSide
    };
}

function getGomokuState() {
    try {
        const state = JSON.parse(localStorage.getItem(GOMOKU_STATE_KEY) || '{}');
        if (Array.isArray(state.board) && state.board.length === 15) {
            const sides = getBoardGamePlayerSides('gomoku', state.firstPlayer || getBoardGameFirstPlayer('gomoku'));
            state.firstPlayer = state.firstPlayer || sides.firstPlayer;
            state.userSide = state.userSide || sides.userSide;
            state.charSide = state.charSide || sides.charSide;
            return state;
        }
    } catch (e) {}
    const state = createGomokuState();
    saveGomokuState(state);
    return state;
}

function saveGomokuState(state) {
    localStorage.setItem(GOMOKU_STATE_KEY, JSON.stringify(state));
}

function checkGomokuWin(board, row, col, stone) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    return dirs.some(([dr, dc]) => {
        let count = 1;
        for (const sign of [-1, 1]) {
            let r = row + dr * sign;
            let c = col + dc * sign;
            while (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === stone) {
                count += 1;
                r += dr * sign;
                c += dc * sign;
            }
        }
        return count >= 5;
    });
}

function placeGomokuStone(row, col) {
    const state = getGomokuState();
    if (state.winner || state.board[row]?.[col]) return;
    if (getBoardGameTurnOwner('gomoku', state) === 'char') {
        if (typeof showWechatToast === 'function') showWechatToast('等对方下完这一手');
        scheduleBoardGameAutoTurn('gomoku', 'blocked-user-tap');
        return;
    }
    const placedStone = state.turn;
    state.board[row][col] = placedStone;
    state.moves += 1;
    if (checkGomokuWin(state.board, row, col, placedStone)) {
        state.winner = placedStone;
    } else {
        state.turn = state.turn === 'black' ? 'white' : 'black';
    }
    finishBoardGameMove('gomoku', state, { row, col, placedStone }, 'user');
}
window.placeGomokuStone = placeGomokuStone;

function resetGomokuGame() {
    saveGomokuState(createGomokuState());
    const char = getBoardGameChar('gomoku');
    const firstName = getBoardGameFirstPlayer('gomoku') === 'char' ? getMusicCharName(char) : '你';
    saveBoardGameChat('gomoku', { status: 'idle', text: `棋局已重开，${firstName}先手。`, updatedAt: Date.now() });
    renderGameApp();
    requestBoardGameAiComment('gomoku', 'reset', { action: '五子棋重新开局，请说一句开局气泡。' });
    scheduleBoardGameAutoTurn('gomoku', 'reset');
}
window.resetGomokuGame = resetGomokuGame;

function renderGomokuGame(el) {
    const state = getGomokuState();
    const label = state.winner ? `${getBoardGameSideLabel('gomoku', state.winner)}获胜` : `${getBoardGameTurnText('gomoku', state)}落子`;
    el.innerHTML = `
        <section class="mini-game-panel board-panel gomoku-panel">
            ${renderBoardGameCompanionBar('gomoku')}
            <div class="board-game-top"><div><span>GOMOKU</span><strong>${label}</strong><p>先连成五子的一方获胜。</p></div><button type="button" onclick="resetGomokuGame()">重开</button></div>
            <div class="gomoku-board">
                ${state.board.map((row, r) => row.map((stone, c) => `
                    <button type="button" class="${stone || ''}" onclick="placeGomokuStone(${r},${c})">${stone ? '<i></i>' : ''}</button>
                `).join('')).join('')}
            </div>
        </section>
    `;
}

function getInitialBoardGameState(type, firstPlayer = getBoardGameFirstPlayer(type)) {
    const sides = getBoardGamePlayerSides(type, firstPlayer);
    if (type === 'xiangqi') {
        return {
            selected: null,
            turn: sides.firstSide,
            firstPlayer: sides.firstPlayer,
            userSide: sides.userSide,
            charSide: sides.charSide,
            board: [
                ['俥','傌','相','仕','帥','仕','相','傌','俥'],
                ['', '', '', '', '', '', '', '', ''],
                ['', '炮', '', '', '', '', '', '炮', ''],
                ['兵', '', '兵', '', '兵', '', '兵', '', '兵'],
                ['', '', '', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', '', ''],
                ['卒', '', '卒', '', '卒', '', '卒', '', '卒'],
                ['', '砲', '', '', '', '', '', '砲', ''],
                ['', '', '', '', '', '', '', '', ''],
                ['車','馬','象','士','將','士','象','馬','車']
            ]
        };
    }
    return {
        selected: null,
        turn: sides.firstSide,
        firstPlayer: sides.firstPlayer,
        userSide: sides.userSide,
        charSide: sides.charSide,
        board: [
            ['♜','♞','♝','♛','♚','♝','♞','♜'],
            ['♟','♟','♟','♟','♟','♟','♟','♟'],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['♙','♙','♙','♙','♙','♙','♙','♙'],
            ['♖','♘','♗','♕','♔','♗','♘','♖']
        ]
    };
}

function getBoardGameState(type) {
    const key = BOARD_GAME_STATE_PREFIX + type;
    try {
        const state = JSON.parse(localStorage.getItem(key) || '{}');
        if (Array.isArray(state.board)) {
            const sides = getBoardGamePlayerSides(type, state.firstPlayer || getBoardGameFirstPlayer(type));
            state.firstPlayer = state.firstPlayer || sides.firstPlayer;
            state.userSide = state.userSide || sides.userSide;
            state.charSide = state.charSide || sides.charSide;
            // Older games used the same 車/馬 glyphs for both sides. Migrate in
            // memory; the next successful game save persists the distinct pieces.
            if (type === 'xiangqi' && !state.xiangqiDistinctPieces) {
                state.board.forEach((row, r) => {
                    if (r > 4) return;
                    row.forEach((piece, c) => {
                        if (piece === '車') row[c] = '俥';
                        if (piece === '馬') row[c] = '傌';
                    });
                });
                state.xiangqiDistinctPieces = true;
            }
            return state;
        }
    } catch (e) {}
    const state = getInitialBoardGameState(type);
    localStorage.setItem(key, JSON.stringify(state));
    return state;
}

function saveBoardGameState(type, state) {
    localStorage.setItem(BOARD_GAME_STATE_PREFIX + type, JSON.stringify(state));
}

function clickBoardGameCell(type, row, col) {
    const state = getBoardGameState(type);
    if (state.winner) return;
    if (getBoardGameTurnOwner(type, state) === 'char') {
        if (typeof showWechatToast === 'function') showWechatToast('等对方走完这一手');
        scheduleBoardGameAutoTurn(type, 'blocked-user-tap');
        return;
    }
    const piece = state.board[row]?.[col] || '';
    let moved = null;
    if (!state.selected) {
        if (piece && getBoardGamePieceSide(type, piece, row) === state.userSide) {
            const legalMoves = getBoardLegalMoves(type, state, row, col);
            if (!legalMoves.length) {
                if (typeof showWechatToast === 'function') showWechatToast('这个棋子现在没有可走位置');
            } else {
                state.selected = { row, col };
            }
        } else if (piece && typeof showWechatToast === 'function') {
            showWechatToast('只能移动自己的棋子');
        }
    } else {
        const { row: sr, col: sc } = state.selected;
        if (sr === row && sc === col) {
            state.selected = null;
        } else if (piece && getBoardGamePieceSide(type, piece, row) === state.userSide) {
            const legalMoves = getBoardLegalMoves(type, state, row, col);
            state.selected = legalMoves.length ? { row, col } : null;
        } else {
            const legalMoves = getBoardLegalMoves(type, state, sr, sc);
            const move = legalMoves.find(item => item.to[0] === row && item.to[1] === col);
            if (!move) {
                if (typeof showWechatToast === 'function') {
                    showWechatToast(type === 'chess' ? '这一步不符合国际象棋走法' : '这一步不能走');
                }
                return;
            }
            moved = applyClassicBoardMove(type, state, move);
        }
    }
    saveBoardGameState(type, state);
    renderGameApp();
    if (moved) {
        finishBoardGameMove(type, state, { from: moved.from, to: moved.to, side: state.userSide, piece: moved.piece, capturedPiece: moved.capturedPiece }, 'user');
    }
}
window.clickBoardGameCell = clickBoardGameCell;

function resetBoardGame(type) {
    saveBoardGameState(type, getInitialBoardGameState(type));
    const char = getBoardGameChar(type);
    const firstName = getBoardGameFirstPlayer(type) === 'char' ? getMusicCharName(char) : '你';
    saveBoardGameChat(type, { status: 'idle', text: `棋局已重开，${firstName}先手。`, updatedAt: Date.now() });
    renderGameApp();
    requestBoardGameAiComment(type, 'reset', { action: `${getBoardGameMeta(type).title}重新开局，请说一句开局气泡。` });
    scheduleBoardGameAutoTurn(type, 'reset');
}
window.resetBoardGame = resetBoardGame;

function renderBoardGame(el, type) {
    const state = getBoardGameState(type);
    const isXiangqi = type === 'xiangqi';
    const title = isXiangqi ? '中国象棋' : '国际象棋';
    const turnLabel = state.winner ? `${getBoardGameSideLabel(type, state.winner)}获胜` : getBoardGameTurnText(type, state);
    const cols = isXiangqi ? 9 : 8;
    const rotateForUser = isXiangqi && state.userSide === 'red';
    const selectedMoves = state.selected ? getBoardLegalMoves(type, state, state.selected.row, state.selected.col) : [];
    const legalKeys = new Set(selectedMoves.map(move => `${move.to[0]},${move.to[1]}`));
    const chessHelp = isXiangqi ? '' : `
        <div class="chess-rule-card">
            <div class="chess-rule-head">
                <span>新手规则</span>
                <strong>轮流走棋，吃到对方的王就获胜</strong>
            </div>
            <div class="chess-rule-strip">
                <span><b>兵</b>直走，斜吃，首步可走两格</span>
                <span><b>车</b>横竖走任意格</span>
                <span><b>马</b>走 L 形，可跳子</span>
                <span><b>象</b>斜线走任意格</span>
                <span><b>后</b>横竖斜都能走</span>
                <span><b>王</b>每次走一格</span>
            </div>
            <div class="chess-rule-notes">
                <span>点自己的棋子后，绿色格可以走，红色格可以吃。</span>
                <span>兵走到最后一排会自动升后。</span>
                <span>当前轻量版先做基础走法，暂不处理王车易位、吃过路兵和将军判定。</span>
            </div>
        </div>
    `;
    el.innerHTML = `
        <section class="mini-game-panel board-panel ${isXiangqi ? 'xiangqi-panel' : 'chess-panel'}">
            ${renderBoardGameCompanionBar(type)}
            <div class="board-game-top"><div><span>${isXiangqi ? 'XIANGQI' : 'CHESS'}</span><strong>${title}</strong><p>${musicEscapeHtml(turnLabel)}。${isXiangqi ? '点击棋子选中，再点击目标格移动。' : '点棋子会亮出能走的位置，绿色可走，红色可吃。'}</p></div><button type="button" onclick="resetBoardGame('${type}')">重开</button></div>
            ${chessHelp}
            <div class="classic-board ${isXiangqi ? 'xiangqi' : 'chess'}" style="--cols:${cols}" aria-label="${title}棋盘${isXiangqi ? `，你的${getBoardGameSideLabel(type, state.userSide)}在下方` : ''}">
                ${state.board.map((_, viewRow) => Array.from({ length: cols }, (_, viewCol) => {
                    const r = rotateForUser ? state.board.length - 1 - viewRow : viewRow;
                    const c = rotateForUser ? cols - 1 - viewCol : viewCol;
                    const piece = state.board[r][c];
                    const side = piece ? getBoardGamePieceSide(type, piece, r) : '';
                    const selected = state.selected && state.selected.row === r && state.selected.col === c;
                    const legal = legalKeys.has(`${r},${c}`);
                    const capturable = legal && !!piece;
                    return `<button type="button" class="${selected ? 'selected' : ''} ${piece ? `has-piece side-${side}` : ''} ${legal ? 'legal-move' : ''} ${capturable ? 'capture-move' : ''}" onclick="clickBoardGameCell('${type}',${r},${c})" aria-label="${piece ? `${getBoardGameSideLabel(type, side)}${piece}` : '空位'}"><span>${musicEscapeHtml(piece)}</span></button>`;
                }).join('')).join('')}
            </div>
        </section>
    `;
}
const CHICKEN_GAME_BEST_KEY = 'bynd_game_chicken_best_v1';
const CHICKEN_AVATAR_KEY = 'bynd_game_chicken_avatar_v1';
let chickenGame = null;
let chickenRaf = 0;
let chickenBgm = null;

const CHICKEN_AVATARS = [
    { id: 'chicken', label: '肥鸡', icon: '🐔', body: '#ffd25a', accent: '#f05a28' },
    { id: 'cat', label: '小猫', icon: '🐱', body: '#ffcf8a', accent: '#3d2b1f' },
    { id: 'dog', label: '小狗', icon: '🐶', body: '#d99b5f', accent: '#5a3927' },
    { id: 'bird', label: '小鸟', icon: '🐦', body: '#62c7ff', accent: '#245b8c' },
    { id: 'mushroom', label: '蘑菇', icon: '🍄', body: '#fff1d0', accent: '#e94444' }
];

function getChickenAvatarId() {
    const saved = localStorage.getItem(CHICKEN_AVATAR_KEY);
    return CHICKEN_AVATARS.some(item => item.id === saved) ? saved : 'chicken';
}

function setChickenAvatar(id) {
    if (!CHICKEN_AVATARS.some(item => item.id === id)) return;
    localStorage.setItem(CHICKEN_AVATAR_KEY, id);
    if (chickenGame) chickenGame.avatarId = id;
    renderGameApp();
}
window.setChickenAvatar = setChickenAvatar;

function getChickenBest() {
    return Math.max(0, parseInt(localStorage.getItem(CHICKEN_GAME_BEST_KEY) || '0', 10) || 0);
}

function stopChickenGame(clearState = false) {
    if (chickenRaf) cancelAnimationFrame(chickenRaf);
    chickenRaf = 0;
    if (chickenGame) chickenGame.running = false;
    stopChickenBgm();
    if (clearState) chickenGame = null;
}
window.stopChickenGame = stopChickenGame;

function getChickenAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!window._byndChickenAudioContext) window._byndChickenAudioContext = new AudioCtx();
    return window._byndChickenAudioContext;
}

function unlockChickenAudio() {
    const ctx = getChickenAudioContext();
    if (!ctx) return null;
    const resume = ctx.state === 'suspended' && typeof ctx.resume === 'function'
        ? ctx.resume().catch(() => {})
        : Promise.resolve();
    if (!window._byndChickenAudioUnlocked) {
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.025);
            window._byndChickenAudioUnlocked = true;
        } catch (e) {}
    }
    return { ctx, resume };
}

function startChickenBgm() {
    const audio = unlockChickenAudio();
    const ctx = audio?.ctx;
    if (!ctx) return;
    if (!chickenBgm) {
        const master = ctx.createGain();
        master.gain.value = 0.42;
        master.connect(ctx.destination);
        chickenBgm = { ctx, master, timer: 0, step: 0, playing: false, bassOsc: null, bassGain: null };
    }
    if (chickenBgm.playing) return;
    chickenBgm.playing = true;
    const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 587.33, 659.25, 783.99];
    const startBass = () => {
        if (!chickenBgm?.playing || chickenBgm.bassOsc) return;
        try {
            const now = ctx.currentTime;
            const bassOsc = ctx.createOscillator();
            const bassGain = ctx.createGain();
            bassOsc.type = 'triangle';
            bassOsc.frequency.setValueAtTime(130.81, now);
            bassGain.gain.setValueAtTime(0.0001, now);
            bassGain.gain.linearRampToValueAtTime(0.026, now + 0.12);
            bassOsc.connect(bassGain);
            bassGain.connect(chickenBgm.master);
            bassOsc.start(now);
            chickenBgm.bassOsc = bassOsc;
            chickenBgm.bassGain = bassGain;
        } catch (e) {}
    };
    const tick = () => {
        if (!chickenBgm?.playing) return;
        const now = ctx.currentTime;
        const freq = notes[chickenBgm.step % notes.length];
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = chickenBgm.step % 4 === 0 ? 'triangle' : 'square';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.connect(gain);
        gain.connect(chickenBgm.master);
        osc.start(now);
        osc.stop(now + 0.2);
        chickenBgm.step += 1;
        chickenBgm.timer = setTimeout(tick, chickenBgm.step % 4 === 0 ? 235 : 185);
    };
    const begin = () => {
        if (!chickenBgm?.playing || chickenBgm.timer) return;
        startBass();
        tick();
    };
    if (ctx.state === 'suspended') {
        audio.resume?.then(begin);
        setTimeout(begin, 140);
    } else {
        begin();
    }
}

function stopChickenBgm() {
    if (!chickenBgm) return;
    chickenBgm.playing = false;
    if (chickenBgm.timer) clearTimeout(chickenBgm.timer);
    chickenBgm.timer = 0;
    if (chickenBgm.bassGain) {
        try {
            const now = chickenBgm.ctx.currentTime;
            chickenBgm.bassGain.gain.cancelScheduledValues(now);
            chickenBgm.bassGain.gain.setValueAtTime(chickenBgm.bassGain.gain.value || 0.0001, now);
            chickenBgm.bassGain.gain.linearRampToValueAtTime(0.0001, now + 0.08);
        } catch (e) {}
    }
    if (chickenBgm.bassOsc) {
        try { chickenBgm.bassOsc.stop(chickenBgm.ctx.currentTime + 0.09); } catch (e) {}
        try { chickenBgm.bassOsc.disconnect(); } catch (e) {}
    }
    if (chickenBgm.bassGain) {
        setTimeout(() => {
            try { chickenBgm?.bassGain?.disconnect(); } catch (e) {}
        }, 120);
    }
    chickenBgm.bassOsc = null;
    chickenBgm.bassGain = null;
}

function createChickenGameState(canvas) {
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width || 320));
    const height = Math.max(480, Math.round(rect.height || 520));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return {
        canvas,
        ctx,
        width,
        height,
        avatarId: getChickenAvatarId(),
        bird: { x: 74, y: height * 0.48, size: 30, vy: 0, angle: 0 },
        gravity: 0.34,
        flap: -6.2,
        speed: 2.25,
        score: 0,
        coins: 0,
        distance: 0,
        best: getChickenBest(),
        obstacles: [],
        particles: [],
        clouds: [
            { x: 36, y: 78, s: 0.76 },
            { x: 186, y: 132, s: 1.12 },
            { x: 284, y: 258, s: 0.78 },
            { x: 92, y: 360, s: 1.0 }
        ],
        lastTime: 0,
        running: false,
        started: false,
        over: false,
        spawnX: width + 80
    };
}

function resetChickenGame(canvas) {
    stopChickenGame(false);
    const target = canvas || document.getElementById('chicken-canvas');
    if (!target) return;
    chickenGame = createChickenGameState(target);
    drawChickenFrame(chickenGame);
    updateChickenHud();
}

function startChickenGame() {
    unlockChickenAudio();
    const canvas = document.getElementById('chicken-canvas');
    if (!canvas) return;
    if (!chickenGame || chickenGame.canvas !== canvas || chickenGame.over) {
        resetChickenGame(canvas);
    }
    chickenGame.started = true;
    chickenGame.running = true;
    chickenGame.over = false;
    chickenGame.lastTime = performance.now();
    chickenGame.bird.vy = chickenGame.flap;
    startChickenBgm();
    chickenGameLoop(chickenGame.lastTime);
    updateChickenHud();
}
window.startChickenGame = startChickenGame;

function flapChickenGame() {
    unlockChickenAudio();
    if (!chickenGame) return;
    if (chickenGame.over) {
        resetChickenGame(chickenGame.canvas);
        startChickenGame();
        return;
    }
    if (!chickenGame.started) {
        startChickenGame();
        return;
    }
    chickenGame.bird.vy = chickenGame.flap;
    chickenGame.particles.push({ x: chickenGame.bird.x - 11, y: chickenGame.bird.y + 8, life: 18, color: 'rgba(255,255,255,0.82)' });
}
window.flapChickenGame = flapChickenGame;

function createChickenCoins(game, top, gap) {
    const count = 3 + Math.floor(Math.random() * 3);
    const center = top + gap / 2;
    const coins = [];
    const bigIndex = Math.floor(Math.random() * count);
    for (let i = 0; i < count; i += 1) {
        const big = i === bigIndex;
        const yOffset = (Math.sin(i * 0.85 + Math.random() * 0.7) * 34) + (Math.random() * 16 - 8);
        coins.push({
            x: game.width + 72 + i * 32,
            y: Math.max(top + 24, Math.min(top + gap - 24, center + yOffset)),
            taken: false,
            big,
            value: big ? 3 : 1,
            scale: big ? 1.18 : 0.78 + Math.random() * 0.12
        });
    }
    return coins;
}

function spawnChickenObstacle(game) {
    const gap = Math.max(138, Math.min(178, game.height * 0.31));
    const topMin = 82;
    const topMax = Math.max(topMin + 20, game.height - gap - 120);
    const top = Math.round(topMin + Math.random() * (topMax - topMin));
    game.obstacles.push({
        x: game.width + 26,
        width: 46,
        top,
        gap,
        passed: false,
        coins: createChickenCoins(game, top, gap)
    });
}

function chickenGameLoop(time) {
    if (!chickenGame || !chickenGame.running) return;
    const game = chickenGame;
    const delta = Math.min(34, time - (game.lastTime || time));
    game.lastTime = time;
    const step = delta / 16.67;
    updateChickenGame(game, step);
    drawChickenFrame(game);
    updateChickenHud();
    if (game.running) chickenRaf = requestAnimationFrame(chickenGameLoop);
}

function updateChickenGame(game, step) {
    const bird = game.bird;
    bird.vy += game.gravity * step;
    bird.y += bird.vy * step;
    bird.angle = Math.max(-0.45, Math.min(0.72, bird.vy / 10));
    game.distance += game.speed * step;
    game.spawnX -= game.speed * step;
    if (game.spawnX < game.width - 130) {
        spawnChickenObstacle(game);
        game.spawnX = game.width + 116 + Math.random() * 42;
    }
    game.obstacles.forEach(ob => {
        ob.x -= game.speed * step;
        const coins = Array.isArray(ob.coins) ? ob.coins : (ob.coin ? [ob.coin] : []);
        ob.coins = coins;
        coins.forEach(coin => { coin.x -= game.speed * step; });
        if (!ob.passed && ob.x + ob.width < bird.x - bird.size * 0.35) {
            ob.passed = true;
            game.score += 1;
        }
        coins.forEach(coin => {
            if (!coin.taken) {
                const dx = coin.x - bird.x;
                const dy = coin.y - bird.y;
                const radius = bird.size * 0.66 + (coin.big ? 9 : 3);
                if (Math.sqrt(dx * dx + dy * dy) < radius) {
                    coin.taken = true;
                    const value = coin.value || (coin.big ? 3 : 1);
                    game.coins += value;
                    game.score += value * 2;
                    playMiniGameSound(coin.big ? 'bigCoin' : 'coin');
                    game.particles.push({ x: coin.x, y: coin.y, life: coin.big ? 32 : 24, color: coin.big ? '#ffb21f' : '#ffe16a' });
                }
            }
        });
    });
    game.obstacles = game.obstacles.filter(ob => ob.x + ob.width > -40);
    game.clouds.forEach(cloud => {
        cloud.x -= (0.25 + cloud.s * 0.12) * step;
        if (cloud.x < -90) {
            cloud.x = game.width + 40 + Math.random() * 120;
            cloud.y = 64 + Math.random() * (game.height - 190);
        }
    });
    game.particles.forEach(p => {
        p.x -= 0.7 * step;
        p.y -= 0.4 * step;
        p.life -= step;
    });
    game.particles = game.particles.filter(p => p.life > 0);
    const groundY = game.height - 36;
    if (bird.y + bird.size * 0.5 > groundY || bird.y - bird.size * 0.5 < 12) endChickenGame();
    const hit = game.obstacles.some(ob => chickenHitObstacle(game, ob));
    if (hit) endChickenGame();
}

function chickenHitObstacle(game, ob) {
    const b = game.bird;
    const pad = 7;
    const left = b.x - b.size * 0.38 + pad;
    const right = b.x + b.size * 0.42 - pad;
    const top = b.y - b.size * 0.42 + pad;
    const bottom = b.y + b.size * 0.42 - pad;
    const withinX = right > ob.x && left < ob.x + ob.width;
    if (!withinX) return false;
    return top < ob.top || bottom > ob.top + ob.gap;
}

function endChickenGame() {
    if (!chickenGame || chickenGame.over) return;
    chickenGame.running = false;
    chickenGame.over = true;
    const best = Math.max(chickenGame.best, chickenGame.score);
    chickenGame.best = best;
    localStorage.setItem(CHICKEN_GAME_BEST_KEY, String(best));
    stopChickenBgm();
    drawChickenFrame(chickenGame);
    updateChickenHud();
}

function drawPixelRect(ctx, x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(w) - 2, Math.round(h) - 2);
    }
}

function drawChickenCloud(ctx, x, y, s, face = true) {
    const blocks = [[0,14,58,24], [12,0,36,30], [44,10,34,26], [-10,22,25,20]];
    blocks.forEach(b => drawPixelRect(ctx, x + b[0] * s, y + b[1] * s, b[2] * s, b[3] * s, 'rgba(255,255,255,0.94)'));
    drawPixelRect(ctx, x + 2 * s, y + 34 * s, 70 * s, 7 * s, 'rgba(180,238,255,0.42)');
    if (face) {
        drawPixelRect(ctx, x + 23 * s, y + 24 * s, 5 * s, 10 * s, '#315577');
        drawPixelRect(ctx, x + 46 * s, y + 24 * s, 5 * s, 10 * s, '#315577');
        drawPixelRect(ctx, x + 34 * s, y + 34 * s, 9 * s, 4 * s, '#315577');
        drawPixelRect(ctx, x + 16 * s, y + 35 * s, 7 * s, 4 * s, 'rgba(255,160,176,0.55)');
        drawPixelRect(ctx, x + 53 * s, y + 35 * s, 7 * s, 4 * s, 'rgba(255,160,176,0.55)');
    }
}

function drawChickenBrickColumn(ctx, x, y, w, h) {
    drawPixelRect(ctx, x - 3, y, w + 6, h, '#2f2a34');
    const brickH = 18;
    for (let row = 0; row < Math.ceil(h / brickH); row += 1) {
        const by = y + row * brickH;
        const offset = row % 2 ? -13 : 0;
        for (let bx = x + offset; bx < x + w; bx += 26) {
            drawPixelRect(ctx, bx, by + 2, 24, brickH - 4, '#b9563e', '#70372e');
            drawPixelRect(ctx, bx + 3, by + 5, 13, 3, 'rgba(255,164,97,0.38)');
        }
    }
}

function drawChickenCoin(ctx, x, y, scale = 1) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    drawPixelRect(ctx, -9 * scale, -9 * scale, 18 * scale, 18 * scale, '#ffcf2f', '#9c6d14');
    drawPixelRect(ctx, -5 * scale, -5 * scale, 10 * scale, 10 * scale, '#ffe572');
    drawPixelRect(ctx, -1 * scale, -6 * scale, 3 * scale, 12 * scale, '#c98d18');
    ctx.restore();
}

function drawChickenAvatar(ctx, avatarId, x, y, size, angle) {
    const avatar = CHICKEN_AVATARS.find(item => item.id === avatarId) || CHICKEN_AVATARS[0];
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle || 0);
    const s = size / 32;
    if (avatar.id === 'mushroom') {
        drawPixelRect(ctx, -11*s, -3*s, 22*s, 18*s, '#fff1d0', '#5b3626');
        drawPixelRect(ctx, -16*s, -15*s, 32*s, 17*s, avatar.accent, '#5b1e1e');
        drawPixelRect(ctx, -10*s, -12*s, 7*s, 7*s, '#fff6dc');
        drawPixelRect(ctx, 5*s, -10*s, 7*s, 7*s, '#fff6dc');
        drawPixelRect(ctx, -5*s, 4*s, 3*s, 7*s, '#3c2b24');
        drawPixelRect(ctx, 5*s, 4*s, 3*s, 7*s, '#3c2b24');
    } else if (avatar.id === 'cat' || avatar.id === 'dog') {
        drawPixelRect(ctx, -13*s, -10*s, 26*s, 24*s, avatar.body, '#5b3626');
        if (avatar.id === 'cat') {
            drawPixelRect(ctx, -14*s, -17*s, 8*s, 10*s, avatar.body, '#5b3626');
            drawPixelRect(ctx, 6*s, -17*s, 8*s, 10*s, avatar.body, '#5b3626');
        } else {
            drawPixelRect(ctx, -18*s, -8*s, 8*s, 14*s, '#8b5b3a', '#5b3626');
            drawPixelRect(ctx, 10*s, -8*s, 8*s, 14*s, '#8b5b3a', '#5b3626');
        }
        drawPixelRect(ctx, -6*s, -1*s, 4*s, 6*s, '#1e293b');
        drawPixelRect(ctx, 5*s, -1*s, 4*s, 6*s, '#1e293b');
        drawPixelRect(ctx, -1*s, 6*s, 5*s, 3*s, avatar.accent);
    } else {
        drawPixelRect(ctx, -14*s, -10*s, 28*s, 22*s, avatar.body, '#4a3425');
        drawPixelRect(ctx, -22*s, -4*s, 12*s, 13*s, avatar.id === 'bird' ? '#b7e9ff' : '#fff0a6', '#4a3425');
        drawPixelRect(ctx, 10*s, -1*s, 11*s, 8*s, '#ff9f1a', '#6b3d10');
        drawPixelRect(ctx, -7*s, -1*s, 4*s, 7*s, '#1f2937');
        drawPixelRect(ctx, 4*s, -1*s, 4*s, 7*s, '#1f2937');
        if (avatar.id === 'chicken') {
            drawPixelRect(ctx, -8*s, -18*s, 6*s, 8*s, avatar.accent, '#692114');
            drawPixelRect(ctx, -2*s, -20*s, 6*s, 10*s, avatar.accent, '#692114');
            drawPixelRect(ctx, 4*s, -17*s, 6*s, 7*s, avatar.accent, '#692114');
        }
    }
    ctx.restore();
}

function drawChickenFrame(game) {
    const { ctx, width, height } = game;
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#47c8ff');
    sky.addColorStop(0.58, '#5ed7ff');
    sky.addColorStop(1, '#9befff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 0; x < width; x += 8) ctx.fillRect(x, 0, 1, height);
    for (let y = 0; y < height; y += 8) ctx.fillRect(0, y, width, 1);
    game.clouds.forEach((cloud, index) => drawChickenCloud(ctx, cloud.x, cloud.y, cloud.s, index % 2 === 1));
    game.obstacles.forEach(ob => {
        drawChickenBrickColumn(ctx, ob.x, 0, ob.width, ob.top);
        drawChickenBrickColumn(ctx, ob.x, ob.top + ob.gap, ob.width, height - ob.top - ob.gap - 34);
        (Array.isArray(ob.coins) ? ob.coins : (ob.coin ? [ob.coin] : [])).forEach(coin => {
            if (!coin.taken) drawChickenCoin(ctx, coin.x, coin.y, coin.scale || (coin.big ? 1.18 : 0.86));
        });
    });
    game.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / 24);
        drawPixelRect(ctx, p.x, p.y, 8, 8, p.color || '#fff');
        ctx.globalAlpha = 1;
    });
    drawChickenAvatar(ctx, game.avatarId, game.bird.x, game.bird.y, game.bird.size, game.bird.angle);
    const groundY = height - 36;
    drawPixelRect(ctx, 0, groundY, width, 36, '#72df3b');
    drawPixelRect(ctx, 0, groundY + 10, width, 26, '#38b92b');
    for (let x = -20; x < width; x += 18) {
        drawPixelRect(ctx, x + ((Math.floor(game.distance / 10) % 18)), groundY + 20, 12, 5, '#11662a');
    }
    if (!game.started || game.over) drawChickenOverlay(game);
}

function drawChickenOverlay(game) {
    const { ctx, width, height } = game;
    ctx.save();
    ctx.fillStyle = 'rgba(5,20,32,0.18)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = game.over ? '#ffdf4c' : '#ffffff';
    ctx.strokeStyle = '#2a2f3a';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.font = '900 30px system-ui, sans-serif';
    const title = game.over ? '撞墙啦' : '点击屏幕开始';
    ctx.strokeText(title, width / 2, height * 0.44);
    ctx.fillText(title, width / 2, height * 0.44);
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(game.over ? '再点一下重新起飞' : '吃金币，穿过砖墙，不要落地', width / 2, height * 0.44 + 30);
    ctx.restore();
}

function updateChickenHud() {
    if (!chickenGame) return;
    const coinEl = document.getElementById('chicken-coin-count');
    const scoreEl = document.getElementById('chicken-score-count');
    const bestEl = document.getElementById('chicken-best-count');
    const startBtn = document.querySelector('.chicken-start-btn');
    if (coinEl) coinEl.textContent = String(chickenGame.coins || 0);
    if (scoreEl) scoreEl.textContent = String(chickenGame.score || 0);
    if (bestEl) bestEl.textContent = String(chickenGame.best || getChickenBest());
    if (startBtn) {
        startBtn.classList.toggle('is-playing', chickenGame.started && chickenGame.running && !chickenGame.over);
        startBtn.textContent = chickenGame.over ? '重新开始' : '点击起飞';
    }
}

function renderChickenGame(el) {
    const activeAvatar = getChickenAvatarId();
    const best = getChickenBest();
    stopChickenGame(false);
    el.innerHTML = `
        <section class="chicken-game-shell">
            <div class="chicken-game-canvas-wrap">
                <canvas id="chicken-canvas" aria-label="肥鸡大冒险"></canvas>
                <div class="chicken-hud left"><i class="ri-coin-fill"></i><b id="chicken-coin-count">0</b></div>
                <div class="chicken-hud right"><i class="ri-trophy-fill"></i><b id="chicken-best-count">${best}</b></div>
                <button type="button" class="chicken-start-btn" onclick="flapChickenGame()">点击屏幕开始</button>
                <div class="chicken-avatar-row">
                    ${CHICKEN_AVATARS.map(item => `
                        <button type="button" class="${item.id === activeAvatar ? 'active' : ''}" onclick="setChickenAvatar('${musicEscapeAttr(item.id)}')">
                            <span>${item.icon}</span><b>${musicEscapeHtml(item.label)}</b>
                        </button>
                    `).join('')}
                </div>
            </div>
        </section>
    `;
    const canvas = document.getElementById('chicken-canvas');
    if (!canvas) return;
    resetChickenGame(canvas);
    const wrap = canvas.closest('.chicken-game-canvas-wrap');
    const onTap = (ev) => {
        if (ev.target.closest('.chicken-start-btn, .chicken-avatar-row')) return;
        ev.preventDefault();
        flapChickenGame();
    };
    wrap?.addEventListener('pointerdown', onTap);
    if (!window._chickenKeyboardReady) {
        window._chickenKeyboardReady = true;
        window.addEventListener('keydown', (ev) => {
            if (getActiveGame() !== 'chicken') return;
            if (ev.code === 'Space' || ev.key === ' ') {
                ev.preventDefault();
                flapChickenGame();
            }
        });
    }
    requestAnimationFrame(() => resetChickenGame(canvas));
}
window.renderChickenGame = renderChickenGame;
function updateWolfchaState(mutator) {
    const state = getGameState();
    if (!state) return;
    mutator(state);
    saveGameState(state);
    renderGameApp();
}

function selectWolfchaPlayer(id) {
    updateWolfchaState(state => {
        state.selectedId = id;
        const player = state.players.find(item => item.id === id);
        if (player) state.action = `选择 ${player.number} 号`;
    });
}
window.selectWolfchaPlayer = selectWolfchaPlayer;

function getWolfchaNextAlivePlayer(state) {
    const players = Array.isArray(state?.players) ? state.players : [];
    const alive = players.filter(player => player.alive !== false);
    if (!alive.length) return null;
    const currentId = state.currentSpeakerId || state.selectedId;
    const index = alive.findIndex(player => player.id === currentId);
    return alive[(index + 1 + alive.length) % alive.length] || alive[0];
}

function getWolfchaRecentText(state) {
    return (state.log || [])
        .map(normalizeWolfchaLogEntry)
        .slice(-8)
        .map(item => `${item.name || '旁白'}：${item.text || ''}`)
        .join('\n');
}

function compactWolfchaPromptText(value, maxLength = 700) {
    const cleaner = typeof window.cleanChatApiVisibleContent === 'function'
        ? window.cleanChatApiVisibleContent
        : value => String(value == null ? '' : value);
    const text = cleaner(value)
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function getWolfchaRoleGuide(role) {
    const guides = {
        '狼人': '你的阵营目标是隐藏狼人身份、混淆好人视角、保护狼人队友、推动放逐好人。发言要像真实玩家一样找逻辑漏洞，不要直接承认自己是狼人。',
        '预言家': '你的阵营目标是帮助好人找狼人。没有明确查验结果时不要编造查验；如果要跳预言家，要说明你的警徽流或怀疑链，但避免泄露系统提示。',
        '女巫': '你的阵营目标是帮助好人。不要轻易暴露女巫身份；没有夜间用药记录时不要编造救人、毒人结果，可从发言状态和投票倾向盘逻辑。',
        '守卫': '你的阵营目标是帮助好人。不要轻易暴露守卫身份；没有守护结果时不要编造信息，可谨慎分析谁像神、谁像狼。',
        '猎人': '你的阵营目标是帮助好人。可以有压迫感和反击感，但不要无依据乱带队；除非局势需要，不要过早暴露身份。',
        '村民': '你没有夜间信息，目标是从发言、站边、票型和情绪里找狼人。不要编造查验、用药、守护等神职信息。'
    };
    return guides[role] || guides['村民'];
}

function getWolfchaPublicTableText(state, player) {
    const players = Array.isArray(state?.players) ? state.players : [];
    const aliveLines = players.map(item => {
        const flags = [
            item.id === player.id ? '你' : '',
            item.isUser ? '用户' : '',
            item.alive === false ? '出局' : '在场',
            item.id === state.currentSpeakerId ? '当前发言' : '',
            item.id === state.selectedId ? '被选中' : ''
        ].filter(Boolean).join('，');
        return `${item.number || '?'}号 ${item.name || '未知'}（${flags || '在场'}）`;
    });
    const wolfMates = player.role === '狼人'
        ? players
            .filter(item => item.id !== player.id && item.role === '狼人' && item.alive !== false)
            .map(item => `${item.number}号 ${item.name}`)
        : [];
    return [
        aliveLines.join('\n'),
        wolfMates.length ? `你的狼人队友：${wolfMates.join('、')}` : ''
    ].filter(Boolean).join('\n');
}

function getWolfchaSpeechHistoryText(state) {
    const logs = Array.isArray(state?.log) ? state.log.map(normalizeWolfchaLogEntry) : [];
    const lines = logs
        .filter(item => item && item.status !== 'pending' && item.text)
        .slice(-14)
        .map(item => {
            const type = item.type === 'speech' ? '发言' : '流程';
            return `【${type}】${item.name || '旁白'}：${compactWolfchaPromptText(item.text, 220)}`;
        });
    return lines.length ? lines.join('\n') : '暂无有效发言。';
}

function buildWolfchaAiSpeechPrompt(state, player, char) {
    const userProfile = typeof getUserProfile === 'function' ? getUserProfile() : { name: '我' };
    const role = player.role || '村民';
    const phase = state.phase === 'night' ? '夜晚' : '白天';
    const nickname = char?.chatConfig?.nickname ? `用户给你的备注名：${char.chatConfig.nickname}` : '';
    const userInfo = [
        `用户名：${userProfile.name || '我'}`,
        userProfile.bio ? `用户资料：${compactWolfchaPromptText(userProfile.bio, 220)}` : ''
    ].filter(Boolean).join('\n');
    return `【BYND 狼人杀发言任务】
现在不是微信聊天，而是游戏内发言。你必须继续扮演角色「${player.name}」，保留角色卡的人设、语气、关系和表达习惯，但发言内容必须符合狼人杀规则和当前局势。

【你的牌面】
- 玩家编号：${player.number || '?'}号
- 游戏身份：${role}
- 当前阶段：第 ${state.day || 1} 天，${phase}，轮到你发言
- 角色策略：${getWolfchaRoleGuide(role)}
${nickname ? `- ${nickname}\n` : ''}${userInfo ? `- ${userInfo}\n` : ''}
【公开场上信息】
${getWolfchaPublicTableText(state, player)}

【最近流程和发言】
${getWolfchaSpeechHistoryText(state)}

【发言要求】
- 只输出「${player.name}」的一段玩家发言，不要写旁白、舞台说明、系统说明、JSON、Markdown 或引号。
- 不要输出微信特殊指令，不要使用 ||| 分段。
- 你只知道自己的身份，以及规则允许你知道的信息；裁判拥有上帝视角，但你不能用上帝视角发言。
- 按你的身份目标说话：狼人要伪装和带节奏，好人要找狼、站边、质疑或保护关键玩家。
- 不要编造未发生的查验、救药、毒药、守护、枪击、投票结果；只能基于上面的公开信息和你的身份推理。
- 发言要像真实狼人杀玩家，允许有角色口吻、情绪、试探、拉踩、反问，但不要自曝隐藏身份，除非符合当前策略。
- 60-140 字，中文。`;
}

function cleanWolfchaAiSpeechContent(value, playerName) {
    const cleaner = typeof window.cleanChatApiVisibleContent === 'function'
        ? window.cleanChatApiVisibleContent
        : value => String(value == null ? '' : value);
    let text = cleaner(value)
        .replace(/\[微信(?:转账|红包|语音|表情|语音电话|视频电话)[^\]]*\]/g, '')
        .replace(/\|\|\|/g, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const labels = ['旁白', '系统', '法官', '主持人', '玩家发言', '发言', playerName].filter(Boolean)
        .map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (labels.length) {
        text = text.replace(new RegExp(`^(?:${labels.join('|')})[：:]\\s*`, 'i'), '').trim();
    }
    return text.length > 220 ? `${text.slice(0, 219)}…` : text;
}

const WOLFCHA_NIGHT_STEPS = [
    { key: 'werewolf', role: '狼人', text: '狼人请睁眼，确认队友并选择今晚的目标。' },
    { key: 'seer', role: '预言家', text: '预言家请睁眼，选择一名玩家查验身份。' },
    { key: 'witch', role: '女巫', text: '女巫请睁眼，选择是否使用解药或毒药。' },
    { key: 'guard', role: '守卫', text: '守卫请睁眼，选择今晚要守护的对象。' }
];

function getWolfchaAlivePlayers(state) {
    return (Array.isArray(state?.players) ? state.players : []).filter(player => player.alive !== false);
}

function prepareWolfchaSpeechQueue(state) {
    const alive = getWolfchaAlivePlayers(state);
    state.speechQueue = alive.map(player => player.id);
    state.speechIndex = -1;
}

function getWolfchaCurrentSpeaker(state) {
    const players = Array.isArray(state?.players) ? state.players : [];
    return players.find(player => player.id === state.currentSpeakerId)
        || players.find(player => player.id === state.selectedId)
        || getWolfchaAlivePlayers(state)[0]
        || null;
}

function beginWolfchaSpeechTurn(state, player) {
    if (!player) return;
    state.turnMode = 'speaking';
    state.currentSpeakerId = player.id;
    state.selectedId = player.id;
    state.awaitingUserSpeech = !!player.isUser;
    state.aiSpeechBusyId = player.isUser ? '' : player.id;
    state.action = `${player.number} 号发言`;
    pushWolfchaLog(state, {
        type: 'narrator',
        name: '旁白',
        playerId: player.id,
        text: player.isUser
            ? `轮到 ${player.name} 发言。请在头像上方输入你的发言。`
            : `轮到 ${player.number} 号 ${player.name} 发言。`
    });
    if (!player.isUser) {
        pushWolfchaLog(state, {
            type: 'speech',
            name: player.name,
            playerId: player.id,
            status: 'pending',
            text: '正在整理发言...'
        });
    }
}

function moveWolfchaToNextSpeech(state) {
    const alive = getWolfchaAlivePlayers(state);
    if (!Array.isArray(state.speechQueue) || !state.speechQueue.length) {
        state.speechQueue = alive.map(player => player.id);
        state.speechIndex = -1;
    }
    let nextIndex = Number.isFinite(state.speechIndex) ? state.speechIndex + 1 : 0;
    while (nextIndex < state.speechQueue.length) {
        const player = alive.find(item => item.id === state.speechQueue[nextIndex]);
        if (player) {
            state.speechIndex = nextIndex;
            beginWolfchaSpeechTurn(state, player);
            return player;
        }
        nextIndex += 1;
    }
    state.turnMode = 'vote';
    state.awaitingUserSpeech = false;
    state.aiSpeechBusyId = '';
    state.action = '放逐投票';
    pushWolfchaLog(state, {
        type: 'narrator',
        name: '旁白',
        text: '本轮发言结束。请选择你怀疑的玩家，然后点击「放逐」。'
    });
    return null;
}

function getWolfchaPendingSpeechIndex(logs, playerId) {
    return logs
        .map((item, index) => ({ item, index }))
        .reverse()
        .find(({ item }) => item.playerId === playerId && item.status === 'pending')?.index;
}

async function runWolfchaAiSpeech(playerId) {
    const state = getGameState();
    if (!state) return;
    const player = (state.players || []).find(item => item.id === playerId && item.alive !== false);
    if (!player || player.isUser) return;
    const char = (window.myCharacters || []).find(item => item.id === player.id);
    if (!char || typeof callChatApi !== 'function') {
        updateWolfchaState(next => {
            next.aiSpeechBusyId = '';
            next.turnMode = 'speech_done';
            next.action = `${player.number} 号发言未完成`;
            const logs = Array.isArray(next.log) ? next.log.map(normalizeWolfchaLogEntry) : [];
            const pendingIndex = getWolfchaPendingSpeechIndex(logs, player.id);
            if (pendingIndex != null) logs.splice(pendingIndex, 1);
            next.log = logs;
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `${player.name} 暂时无法接入 API 发言，请点击旁白继续。` });
        });
        return;
    }
    try {
        const latest = getGameState() || state;
        const messages = typeof buildMessages === 'function'
            ? buildMessages(char, Array.isArray(char.history) ? char.history.slice(-6) : [])
            : [{ role: 'system', content: `你是${player.name}。` }];
        messages.push({
            role: 'user',
            content: buildWolfchaAiSpeechPrompt(latest, player, char)
        });
        const result = await callChatApi(messages, { usageFeature: 'game', usageChar: char });
        updateWolfchaState(next => {
            const logs = Array.isArray(next.log) ? next.log.map(normalizeWolfchaLogEntry) : [];
            const pendingIndex = getWolfchaPendingSpeechIndex(logs, player.id);
            if (result.ok) {
                const cleanText = cleanWolfchaAiSpeechContent(result.content, player.name);
                const speech = { type: 'speech', name: player.name, playerId: player.id, text: cleanText || '……' };
                if (pendingIndex != null) logs[pendingIndex] = speech;
                else logs.push(speech);
                next.log = logs;
                next.turnMode = 'speech_done';
                next.action = `${player.number} 号发言结束`;
            } else {
                if (pendingIndex != null) logs.splice(pendingIndex, 1);
                next.log = logs;
                next.turnMode = 'speech_done';
                next.action = `${player.number} 号发言未完成`;
                pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `${player.name} 的 API 发言失败：${result.error}` });
            }
            next.aiSpeechBusyId = '';
            next.awaitingUserSpeech = false;
        });
    } catch (e) {
        updateWolfchaState(next => {
            const logs = Array.isArray(next.log) ? next.log.map(normalizeWolfchaLogEntry) : [];
            const pendingIndex = getWolfchaPendingSpeechIndex(logs, player.id);
            if (pendingIndex != null) logs.splice(pendingIndex, 1);
            next.log = logs;
            next.aiSpeechBusyId = '';
            next.awaitingUserSpeech = false;
            next.turnMode = 'speech_done';
            next.action = `${player.number} 号发言未完成`;
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `${player.name} 的 API 发言没有接通：${e.message || '未知错误'}` });
        });
    }
}

function wolfchaNarratorStep() {
    const state = getGameState();
    if (!state) return;
    if (state.aiSpeechBusyId) {
        if (typeof showWechatToast === 'function') showWechatToast('AI 正在发言，稍等一下');
        return;
    }
    let aiToSpeak = '';
    updateWolfchaState(next => {
        if (next.awaitingUserSpeech) {
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: '请先完成你的发言，再继续流程。' });
            return;
        }
        const mode = next.turnMode || 'day_intro';
        if (mode === 'day_intro') {
            next.phase = 'day';
            prepareWolfchaSpeechQueue(next);
            next.action = next.day === 1 ? '警徽竞选发言' : `第 ${next.day} 天发言`;
            pushWolfchaLog(next, {
                type: 'narrator',
                name: '旁白',
                text: next.day === 1
                    ? '警徽竞选开始。旁白将按顺序点名，轮到 AI 会自动发言，轮到你会出现输入框。'
                    : `第 ${next.day} 天开始，所有存活玩家依次发言。`
            });
            const player = moveWolfchaToNextSpeech(next);
            if (player && !player.isUser) aiToSpeak = player.id;
            return;
        }
        if (mode === 'speech_done' || mode === 'speaking') {
            const player = moveWolfchaToNextSpeech(next);
            if (player && !player.isUser) aiToSpeak = player.id;
            return;
        }
        if (mode === 'vote') {
            next.action = '等待投票';
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: '请在下方点选一名玩家，再点击「放逐」。如果暂时不想放逐，可以点击「入夜」。' });
            return;
        }
        if (mode === 'night_intro') {
            next.phase = 'night';
            next.nightStep = 0;
            next.turnMode = 'night_action';
            next.action = `第 ${next.day || 1} 夜`;
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `天黑请闭眼。${WOLFCHA_NIGHT_STEPS[0].text}` });
            return;
        }
        if (mode === 'night_action') {
            const step = Number.isFinite(next.nightStep) ? next.nightStep + 1 : 1;
            if (step < WOLFCHA_NIGHT_STEPS.length) {
                next.nightStep = step;
                next.action = WOLFCHA_NIGHT_STEPS[step].role + '行动';
                pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: WOLFCHA_NIGHT_STEPS[step].text });
                return;
            }
            next.phase = 'day';
            next.day = (next.day || 1) + 1;
            next.turnMode = 'day_intro';
            next.nightStep = 0;
            next.action = `第 ${next.day} 天天亮`;
            pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `天亮了。第 ${next.day} 天开始，点击旁白继续进入发言轮。` });
            return;
        }
        next.turnMode = 'day_intro';
        pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: '流程已整理，点击旁白继续开始下一步。' });
    });
    if (aiToSpeak) setTimeout(() => runWolfchaAiSpeech(aiToSpeak), 300);
}
window.wolfchaNarratorStep = wolfchaNarratorStep;

function startWolfchaNight() {
    updateWolfchaState(state => {
        state.phase = 'night';
        state.turnMode = 'night_intro';
        state.awaitingUserSpeech = false;
        state.aiSpeechBusyId = '';
        state.action = '第 ' + state.day + ' 夜，天黑请闭眼';
        pushWolfchaLog(state, {
            type: 'narrator',
            name: '旁白',
            text: '夜幕降临。点击「旁白继续」，我会按狼人、预言家、女巫、守卫的顺序引导。'
        });
    });
}
window.startWolfchaNight = startWolfchaNight;

async function wolfchaNextSpeech() {
    const state = getGameState();
    if (!state) return;
    if (state.awaitingUserSpeech) {
        const input = document.getElementById('wolfcha-user-speech-input');
        input?.focus();
        if (typeof showWechatToast === 'function') showWechatToast('轮到你发言，先输入内容');
        return;
    }
    const player = getWolfchaCurrentSpeaker(state);
    if (player && !player.isUser && (state.turnMode === 'speaking' || state.aiSpeechBusyId === player.id)) {
        runWolfchaAiSpeech(player.id);
        return;
    }
    wolfchaNarratorStep();
}
window.wolfchaNextSpeech = wolfchaNextSpeech;

function submitWolfchaUserSpeech() {
    const input = document.getElementById('wolfcha-user-speech-input');
    const text = String(input?.value || '').trim();
    const state = getGameState();
    if (!state || !state.awaitingUserSpeech) return;
    const player = getWolfchaCurrentSpeaker(state);
    if (!player || !player.isUser) return;
    if (!text) {
        if (typeof showWechatToast === 'function') showWechatToast('先写一句发言');
        input?.focus();
        return;
    }
    updateWolfchaState(next => {
        next.awaitingUserSpeech = false;
        next.turnMode = 'speech_done';
        next.aiSpeechBusyId = '';
        next.action = `${player.number} 号发言结束`;
        pushWolfchaLog(next, { type: 'speech', name: player.name, playerId: player.id, text });
        pushWolfchaLog(next, { type: 'narrator', name: '旁白', text: `${player.name} 发言结束。点击「旁白继续」进入下一位。` });
    });
}
window.submitWolfchaUserSpeech = submitWolfchaUserSpeech;

function wolfchaVoteSelected() {
    updateWolfchaState(state => {
        const player = state.players.find(item => item.id === state.selectedId);
        if (!player || player.alive === false) {
            pushWolfchaLog(state, { type: 'narrator', name: '旁白', text: '请选择一名仍在场的玩家再放逐。' });
            return;
        }
        player.alive = false;
        state.phase = 'day';
        state.turnMode = 'night_intro';
        state.awaitingUserSpeech = false;
        state.aiSpeechBusyId = '';
        state.action = `${player.number} 号被放逐`;
        state.currentSpeakerId = getWolfchaNextAlivePlayer(state)?.id || 'user';
        pushWolfchaLog(state, {
            type: 'narrator',
            name: '旁白',
            playerId: player.id,
            text: isWolfchaRoleVisibleToUser(player, state)
                ? `${player.name} 被投票出局，身份是 ${player.role}。`
                : `${player.name} 被投票出局，身份已由裁判记录，玩家视角不公开。`
        });
        pushWolfchaLog(state, { type: 'narrator', name: '旁白', text: '放逐结束，接下来进入夜晚。点击「旁白继续」开始夜间行动。' });
    });
}
window.wolfchaVoteSelected = wolfchaVoteSelected;

function resetDesktopToFirstPage() {
    if (typeof window.goToDesktopPage === 'function') {
        window.goToDesktopPage(0);
        return;
    }

    const pages = document.querySelectorAll('#pages-container .desktop-page');
    pages.forEach(p => {
        p.style.transition = '';
        p.style.transform = 'translateX(0%)';
    });
    document.querySelectorAll('#page-dots .page-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === 0);
    });
    window._desktopCurrentPage = 0;
}

