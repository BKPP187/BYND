const WATER_SORT_COLORS = ['#ff5f7e', '#ffbf3d', '#47c97e', '#39a7ff', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#64748b', '#84cc16'];

function getWaterSortBestLevel() {
    return Math.max(1, parseInt(localStorage.getItem(WATER_SORT_BEST_LEVEL_KEY) || '1', 10) || 1);
}

function getWaterSortLevelConfig(level = getWaterSortBestLevel()) {
    const safeLevel = Math.max(1, parseInt(level, 10) || 1);
    const colorCount = Math.min(WATER_SORT_COLORS.length, 3 + Math.floor((safeLevel - 1) / 2));
    const emptyTubes = Math.min(4, 2 + Math.floor((safeLevel - 1) / 5));
    return { level: safeLevel, colorCount, emptyTubes, capacity: 4, tubeCount: colorCount + emptyTubes };
}

function createWaterSortState(level = getWaterSortBestLevel()) {
    const config = getWaterSortLevelConfig(level);
    const colors = WATER_SORT_COLORS.slice(0, config.colorCount);
    const pool = colors.flatMap(color => Array(4).fill(color));
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const tubes = [];
    for (let i = 0; i < config.colorCount; i += 1) tubes.push(pool.slice(i * config.capacity, i * config.capacity + config.capacity));
    for (let i = 0; i < config.emptyTubes; i += 1) tubes.push([]);
    return {
        level: config.level,
        capacity: config.capacity,
        colorCount: config.colorCount,
        tubes,
        selected: null,
        moves: 0,
        message: `第 ${config.level} 关：点一个瓶子，再点目标瓶子倒水。`,
        won: false
    };
}

function getWaterSortState() {
    try {
        const state = JSON.parse(localStorage.getItem(WATER_SORT_STATE_KEY) || '{}');
        if (Array.isArray(state.tubes)) {
            const level = Math.max(1, parseInt(state.level || getWaterSortBestLevel(), 10) || 1);
            return { ...createWaterSortState(level), ...state, level };
        }
    } catch (e) {}
    const state = createWaterSortState();
    saveWaterSortState(state);
    return state;
}

function saveWaterSortState(state) {
    localStorage.setItem(WATER_SORT_STATE_KEY, JSON.stringify(state));
}

function resetWaterSortGame() {
    clearTimeout(window._waterSortAutoNextTimer);
    const current = getWaterSortState();
    saveWaterSortState(createWaterSortState(current.level || getWaterSortBestLevel()));
    renderGameApp();
}
window.resetWaterSortGame = resetWaterSortGame;

function startWaterSortLevel(level) {
    clearTimeout(window._waterSortAutoNextTimer);
    const best = getWaterSortBestLevel();
    const safeLevel = Math.max(1, Math.min(best, parseInt(level, 10) || 1));
    saveWaterSortState(createWaterSortState(safeLevel));
    renderGameApp();
}
window.startWaterSortLevel = startWaterSortLevel;

function nextWaterSortLevel() {
    clearTimeout(window._waterSortAutoNextTimer);
    const state = getWaterSortState();
    const nextLevel = Math.max((state.level || 1) + 1, getWaterSortBestLevel());
    localStorage.setItem(WATER_SORT_BEST_LEVEL_KEY, String(nextLevel));
    saveWaterSortState(createWaterSortState(nextLevel));
    renderGameApp();
}
window.nextWaterSortLevel = nextWaterSortLevel;

function scheduleWaterSortAutoNextLevel(level) {
    clearTimeout(window._waterSortAutoNextTimer);
    window._waterSortAutoNextTimer = setTimeout(() => {
        const current = getWaterSortState();
        if (!current.won || Number(current.level || 1) !== Number(level || 1)) return;
        nextWaterSortLevel();
    }, 900);
}

function isWaterSortWon(tubes) {
    return tubes.every(tube => !tube.length || (tube.length === 4 && tube.every(color => color === tube[0])));
}

function pourWaterSort(tubes, fromIndex, toIndex) {
    const from = tubes[fromIndex] || [];
    const to = tubes[toIndex] || [];
    const capacity = 4;
    if (fromIndex === toIndex || !from.length || to.length >= capacity) return false;
    const color = from[from.length - 1];
    if (to.length && to[to.length - 1] !== color) return false;
    let amount = 0;
    for (let i = from.length - 1; i >= 0 && from[i] === color; i -= 1) amount += 1;
    const pourCount = Math.min(amount, capacity - to.length);
    for (let i = 0; i < pourCount; i += 1) to.push(from.pop());
    return pourCount > 0;
}

function selectWaterTube(index) {
    const state = getWaterSortState();
    if (state.won) return;
    if (state.selected === null || state.selected === undefined) {
        if ((state.tubes[index] || []).length) {
            state.selected = index;
            state.message = '再点一个瓶子倒过去。';
        }
        saveWaterSortState(state);
        renderGameApp();
        return;
    }
    if (state.selected === index) {
        state.selected = null;
        state.message = '已取消选择。';
        saveWaterSortState(state);
        renderGameApp();
        return;
    }
    const ok = pourWaterSort(state.tubes, state.selected, index);
    state.selected = null;
    if (ok) {
        playMiniGameSound('water');
        state.moves += 1;
        state.won = isWaterSortWon(state.tubes);
        if (state.won) {
            const unlocked = Math.max(getWaterSortBestLevel(), (state.level || 1) + 1);
            localStorage.setItem(WATER_SORT_BEST_LEVEL_KEY, String(unlocked));
            state.message = `第 ${state.level || 1} 关完成，正在进入下一关。`;
            setTimeout(() => playMiniGameSound('win'), 170);
            scheduleWaterSortAutoNextLevel(state.level || 1);
        } else {
            state.message = '倒好了，继续整理颜色。';
        }
    } else {
        state.message = '只能倒到空瓶，或倒到同色水上。';
    }
    saveWaterSortState(state);
    renderGameApp();
}
window.selectWaterTube = selectWaterTube;

function renderWaterSortGame(el) {
    const state = getWaterSortState();
    const bestLevel = getWaterSortBestLevel();
    const config = getWaterSortLevelConfig(state.level || 1);
    const columns = Math.min(4, Math.max(3, Math.ceil(Math.sqrt(state.tubes.length))));
    el.innerHTML = `
        <section class="mini-game-panel water-panel">
            <div class="water-top">
                <div><span>WATER SORT</span><strong>${state.won ? `第 ${state.level || 1} 关完成` : `倒水排序 Lv.${state.level || 1}`}</strong><p>${musicEscapeHtml(state.message || '把同色水倒在一起。')}</p></div>
                <button type="button" onclick="resetWaterSortGame()"><i class="ri-refresh-line"></i> 重开</button>
            </div>
            <div class="water-meta"><span>关卡 <b>${state.level || 1}</b></span><span>杯子 <b>${state.tubes.length}</b></span><span>步数 <b>${state.moves || 0}</b></span></div>
            <div class="water-level-actions">
                <button type="button" onclick="startWaterSortLevel(${Math.max(1, (state.level || 1) - 1)})" ${(state.level || 1) <= 1 ? 'disabled' : ''}>上一关</button>
                <span>${state.selected === null || state.selected === undefined ? `已解锁到 ${bestLevel}` : `已选 ${state.selected + 1}`}</span>
                ${state.won ? `<button type="button" class="primary" onclick="nextWaterSortLevel()">下一关</button>` : `<button type="button" onclick="startWaterSortLevel(${Math.min(bestLevel, (state.level || 1) + 1)})" ${bestLevel <= (state.level || 1) ? 'disabled' : ''}>下一关</button>`}
            </div>
            <div class="water-rack" style="--tube-cols:${columns};--tube-count:${state.tubes.length};">
                ${state.tubes.map((tube, index) => `
                    <button type="button" class="water-tube ${state.selected === index ? 'selected' : ''}" onclick="selectWaterTube(${index})">
                        ${Array.from({ length: config.capacity }).map((_, slot) => {
                            const color = tube[slot] || '';
                            return `<i style="${color ? `--water:${musicEscapeAttr(color)}` : ''}"></i>`;
                        }).reverse().join('')}
                    </button>
                `).join('')}
            </div>
        </section>
    `;
    if (waitingUserSpeech) {
        requestAnimationFrame(() => document.getElementById('wolfcha-user-speech-input')?.focus());
    }
}

