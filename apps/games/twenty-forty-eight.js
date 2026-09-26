function create2048State() {
    const state = { board: Array.from({ length: 4 }, () => Array(4).fill(0)), score: 0, moves: 0, over: false };
    add2048Tile(state);
    add2048Tile(state);
    return state;
}

function get2048State() {
    try {
        const state = JSON.parse(localStorage.getItem(GAME_2048_STATE_KEY) || '{}');
        if (Array.isArray(state.board) && state.board.length === 4) return state;
    } catch (e) {}
    const state = create2048State();
    save2048State(state);
    return state;
}

function save2048State(state) {
    localStorage.setItem(GAME_2048_STATE_KEY, JSON.stringify(state));
}

function add2048Tile(state) {
    const empty = [];
    state.board.forEach((row, r) => row.forEach((value, c) => { if (!value) empty.push([r, c]); }));
    if (!empty.length) return false;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    state.board[r][c] = Math.random() < 0.9 ? 2 : 4;
    return true;
}

function compress2048Line(line, state) {
    const nums = line.filter(Boolean);
    const result = [];
    for (let i = 0; i < nums.length; i += 1) {
        if (nums[i] && nums[i] === nums[i + 1]) {
            const merged = nums[i] * 2;
            result.push(merged);
            state.score += merged;
            i += 1;
        } else {
            result.push(nums[i]);
        }
    }
    while (result.length < 4) result.push(0);
    return result;
}

function canMove2048(state) {
    for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 4; c += 1) {
            if (!state.board[r][c]) return true;
            if (r < 3 && state.board[r][c] === state.board[r + 1][c]) return true;
            if (c < 3 && state.board[r][c] === state.board[r][c + 1]) return true;
        }
    }
    return false;
}

function move2048(direction) {
    const state = get2048State();
    if (state.over) return;
    const before = JSON.stringify(state.board);
    if (direction === 'left' || direction === 'right') {
        state.board = state.board.map(row => {
            const source = direction === 'right' ? [...row].reverse() : [...row];
            const merged = compress2048Line(source, state);
            return direction === 'right' ? merged.reverse() : merged;
        });
    } else {
        for (let c = 0; c < 4; c += 1) {
            const source = [];
            for (let r = 0; r < 4; r += 1) source.push(state.board[r][c]);
            const merged = compress2048Line(direction === 'down' ? source.reverse() : source, state);
            const finalLine = direction === 'down' ? merged.reverse() : merged;
            for (let r = 0; r < 4; r += 1) state.board[r][c] = finalLine[r];
        }
    }
    if (JSON.stringify(state.board) !== before) {
        state.moves += 1;
        add2048Tile(state);
        state.over = !canMove2048(state);
        save2048State(state);
        renderGameApp();
    }
}
window.move2048 = move2048;

function reset2048Game() {
    const state = create2048State();
    save2048State(state);
    renderGameApp();
}
window.reset2048Game = reset2048Game;

function bind2048Gestures() {
    const board = document.getElementById('game-2048-board');
    if (!board || board.dataset.bound) return;
    board.dataset.bound = '1';
    let sx = 0;
    let sy = 0;
    board.addEventListener('pointerdown', event => {
        sx = event.clientX;
        sy = event.clientY;
    });
    board.addEventListener('pointerup', event => {
        const dx = event.clientX - sx;
        const dy = event.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
        move2048(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    if (!window._bynd2048KeyboardBound) {
        window._bynd2048KeyboardBound = true;
        window.addEventListener('keydown', event => {
            if (getActiveGame() !== '2048') return;
            const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
            if (!map[event.key]) return;
            event.preventDefault();
            move2048(map[event.key]);
        });
    }
}

function render2048Game(el) {
    const state = get2048State();
    const maxTile = Math.max(...state.board.flat(), 0);
    el.innerHTML = `
        <section class="mini-game-panel game2048-panel">
            <div class="game2048-top">
                <div><span>2048</span><strong>${state.over ? '本局结束' : '合成更高数字'}</strong><p>滑动棋盘或点方向键移动。</p></div>
                <button type="button" onclick="reset2048Game()"><i class="ri-refresh-line"></i> 新局</button>
            </div>
            <div class="game2048-stats"><span>分数 <b>${state.score || 0}</b></span><span>最高 <b>${maxTile}</b></span><span>步数 <b>${state.moves || 0}</b></span></div>
            <div id="game-2048-board" class="game2048-board">
                ${state.board.flat().map(value => `<div class="tile-${value || 0}">${value || ''}</div>`).join('')}
            </div>
            <div class="game2048-controls">
                <button type="button" onclick="move2048('up')"><i class="ri-arrow-up-s-line"></i></button>
                <button type="button" onclick="move2048('left')"><i class="ri-arrow-left-s-line"></i></button>
                <button type="button" onclick="move2048('down')"><i class="ri-arrow-down-s-line"></i></button>
                <button type="button" onclick="move2048('right')"><i class="ri-arrow-right-s-line"></i></button>
            </div>
        </section>
    `;
    requestAnimationFrame(bind2048Gestures);
}

function playMiniGameSound(kind = 'tap') {
    const audio = typeof unlockChickenAudio === 'function' ? unlockChickenAudio() : null;
    const ctx = audio?.ctx || (typeof getChickenAudioContext === 'function' ? getChickenAudioContext() : null);
    if (!ctx) return;
    const run = () => {
        try {
            const now = ctx.currentTime;
            const sounds = {
                coin: [
                    { f: 920, to: 1180, t: 0, d: 0.085, v: 0.15, type: 'sine' },
                    { f: 1540, t: 0.055, d: 0.10, v: 0.12, type: 'triangle' }
                ],
                bigCoin: [
                    { f: 760, to: 1220, t: 0, d: 0.12, v: 0.16, type: 'sine' },
                    { f: 1320, to: 1760, t: 0.08, d: 0.15, v: 0.14, type: 'triangle' },
                    { f: 2090, t: 0.18, d: 0.12, v: 0.10, type: 'sine' }
                ],
                jump: [
                    { f: 240, to: 560, t: 0, d: 0.20, v: 0.09, type: 'triangle' }
                ],
                land: [
                    { f: 320, to: 220, t: 0, d: 0.16, v: 0.10, type: 'sine' }
                ],
                fail: [
                    { f: 180, to: 96, t: 0, d: 0.26, v: 0.11, type: 'sawtooth' }
                ],
                water: [
                    { f: 430, to: 250, t: 0, d: 0.38, v: 0.075, type: 'sine' },
                    { f: 280, to: 170, t: 0.05, d: 0.42, v: 0.05, type: 'triangle' }
                ],
                win: [
                    { f: 523.25, t: 0, d: 0.11, v: 0.12, type: 'sine' },
                    { f: 659.25, t: 0.1, d: 0.11, v: 0.12, type: 'sine' },
                    { f: 783.99, t: 0.2, d: 0.16, v: 0.13, type: 'triangle' }
                ]
            };
            const notes = sounds[kind] || sounds.coin;
            const master = ctx.createGain();
            master.gain.setValueAtTime(0.0001, now);
            master.gain.exponentialRampToValueAtTime(0.95, now + 0.012);
            master.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(...notes.map(note => note.t + note.d)) + 0.08);
            master.connect(ctx.destination);
            notes.forEach(note => {
                const start = now + note.t;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = note.type || 'sine';
                osc.frequency.setValueAtTime(note.f, start);
                if (note.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, note.to), start + note.d);
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(note.v, start + 0.012);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + note.d);
                osc.connect(gain);
                gain.connect(master);
                osc.start(start);
                osc.stop(start + note.d + 0.04);
            });
            setTimeout(() => {
                try { master.disconnect(); } catch (e) {}
            }, Math.ceil((Math.max(...notes.map(note => note.t + note.d)) + 0.18) * 1000));
        } catch (e) {}
    };
    if (ctx.state === 'suspended') {
        audio?.resume?.then(run);
    } else {
        run();
    }
}

