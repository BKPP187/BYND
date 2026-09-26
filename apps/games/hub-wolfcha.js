// --- Game App / 小游戏大厅 + 狼人杀 ---
const GAME_STATE_KEY = 'bynd_game_wolfcha_state_v1';
const GAME_ACTIVE_KEY = 'bynd_game_active_v1';
const WOLFCHA_SETUP_KEY = 'bynd_game_wolfcha_setup_v1';
const WOLFCHA_ENTRY_KEY = 'bynd_game_wolfcha_entry_v1';
const GAME_HUB_FILTER_KEY = 'bynd_game_hub_filter_v1';
const SYNC_GAME_CHAR_KEY = 'bynd_game_sync_char_v1';
const SYNC_GAME_STATE_KEY = 'bynd_game_sync_state_v2';
const CARDMATCH_RULES_SKIP_KEY = 'bynd_game_cardmatch_rules_skip_date_v1';
const ACTING_GAME_STATE_KEY = 'bynd_game_acting_state_v1';
const GAME_2048_STATE_KEY = 'bynd_game_2048_state_v1';
const CATPOT_STATE_KEY = 'bynd_game_catpot_state_v5';
const CATPOT_ROUND_MS = 90000;
const CATPOT_CUSTOMER_PATIENCE_MS = 22000;
const CATPOT_CUSTOMER_COUNT = 3;
const CATPOT_TARGET_CUSTOMERS = 18;
const JUMP_GAME_STATE_KEY = 'bynd_game_jump_state_v1';
const JUMP_GAME_BEST_KEY = 'bynd_game_jump_best_v1';
const WATER_SORT_STATE_KEY = 'bynd_game_water_sort_state_v1';
const WATER_SORT_BEST_LEVEL_KEY = 'bynd_game_water_sort_best_level_v1';
const GOMOKU_STATE_KEY = 'bynd_game_gomoku_state_v1';
const BOARD_GAME_STATE_PREFIX = 'bynd_game_board_state_';
const BOARD_GAME_CHAR_KEY_PREFIX = 'bynd_game_board_char_';
const BOARD_GAME_READY_KEY_PREFIX = 'bynd_game_board_ready_';
const BOARD_GAME_CHAT_KEY_PREFIX = 'bynd_game_board_chat_';
const BOARD_GAME_FIRST_KEY_PREFIX = 'bynd_game_board_first_';
const BOARD_GAME_COMMENT_RATE_KEY_PREFIX = 'bynd_game_board_comment_rate_';
const BOARD_GAME_AUTO_TIMERS = {};
const BOARD_GAME_AUTO_COMMENT_EVERY_MOVES = 4;
const BOARD_GAME_AUTO_COMMENT_COOLDOWN_MS = 90 * 1000;
const BOARD_GAME_MANUAL_COMMENT_COOLDOWN_MS = 30 * 1000;
const BOARD_GAME_RATE_LIMIT_PAUSE_MS = 5 * 60 * 1000;
const GOMOKU_BOARD_SIZE = 15;
const GOMOKU_DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const GAME_ROLES = ['狼人', '预言家', '女巫', '守卫', '村民', '村民', '村民', '村民', '村民', '猎人'];
const CATPOT_INGREDIENTS = [
    { id: 'egg', name: '笑脸煎蛋', asset: 'assets/cat-breakfast-pot/food/egg.png', color: '#ffd95f' },
    { id: 'youtiao', name: '软乎油条', asset: 'assets/cat-breakfast-pot/food/youtiao.png', color: '#e8a94b' },
    { id: 'pawball', name: '猫爪包子', asset: 'assets/cat-breakfast-pot/food/pawball-direct-v11.png', color: '#ffb7c5' },
    { id: 'fish', name: '小鱼干', asset: 'assets/cat-breakfast-pot/food/fish.png', color: '#9db7c9' },
    { id: 'scallion', name: '迷你葱芽', asset: 'assets/cat-breakfast-pot/food/scallion.png', color: '#8edb82' },
    { id: 'carrot', name: '爱心胡萝卜', asset: 'assets/cat-breakfast-pot/food/carrot.png', color: '#ff985d' },
    { id: 'tofu', name: '星星豆腐', asset: 'assets/cat-breakfast-pot/food/tofu.png', color: '#ffe8a8' }
];
const CATPOT_CATS = [
    { cat: '橘子猫', mood: '想要暖暖早餐' },
    { cat: '奶盖猫', mood: '今天要软乎乎' },
    { cat: '花花猫', mood: '喜欢彩色摆盘' },
    { cat: '小围裙猫', mood: '想吃招牌早餐锅' },
    { cat: '三花猫', mood: '想要可爱一点' },
    { cat: '黑糖猫', mood: '肚子咕噜咕噜' }
];
const GAME_LIBRARY = [
    { id: 'wolfcha', title: 'BYND 狼人杀', tag: '多人推理', icon: 'ri-shield-star-fill', genre: 'Social deduction', category: 'role', accent: '#e5484d', desc: '先选择陪玩的角色，再随机身份开局。角色会按人设参与发言。' },
    { id: 'acting', title: '谁是演技派', tag: '沉浸剧本', icon: 'ri-movie-2-line', genre: 'Script roleplay', category: 'role', accent: '#c99b5d', desc: '选择角色，AI 生成非俗套剧本和你的报纸档案，旁白推动剧情。' },
    { id: 'chicken', title: '肥鸡大冒险', tag: '像素飞行', icon: 'ri-flight-takeoff-line', genre: 'Tap arcade', category: 'arcade', accent: '#22b8ff', desc: '点击让小角色飞起来，穿过砖墙空隙，吃金币刷新纪录。' },
    { id: 'catpot', title: '猫猫早餐锅', tag: '治愈摆盘', icon: 'ri-restaurant-2-line', genre: 'Cute cooking', category: 'arcade', accent: '#ff9f6e', desc: '按猫猫订单把煎蛋、油条和猫爪包子放进早餐锅，完成后会有啵啵反馈。' },
    { id: 'jump', title: '跳一跳', tag: '蓄力跳跃', icon: 'ri-arrow-up-circle-line', genre: 'Timing arcade', category: 'arcade', accent: '#111318', desc: '按住蓄力，松手跳到下一块平台，力度越准分数越高。' },
    { id: 'watersort', title: '倒水排序', tag: '颜色解谜', icon: 'ri-goblet-line', genre: 'Water Sort', category: 'board', accent: '#2f80ed', desc: '把同色水倒到一起，每个瓶子只能装同一种颜色。' },
    { id: '2048', title: '2048', tag: '数字合成', icon: 'ri-layout-grid-fill', genre: 'Number puzzle', category: 'board', accent: '#ffb02e', desc: '上下左右推动方块，合成更高数字，随时可重新开局。' },
    { id: 'gomoku', title: '五子棋', tag: '双人落子', icon: 'ri-grid-line', genre: 'Board duel', category: 'board', accent: '#111318', desc: '黑白双方轮流落子，任意方向先连成五子获胜。' },
    { id: 'chess', title: '国际象棋', tag: '棋盘对弈', icon: 'ri-vip-crown-2-line', genre: 'Classic board', category: 'board', accent: '#7c5cff', desc: '轻量棋盘模式，可选择棋子并移动，先用于角色共玩流程。' },
    { id: 'xiangqi', title: '中国象棋', tag: '楚河汉界', icon: 'ri-shield-cross-line', genre: 'Classic board', category: 'board', accent: '#d94b3d', desc: '九路十行棋盘，可选择棋子移动，后续可继续补完整规则。' },
    { id: 'sync', title: '默契问答', tag: 'AI互动', icon: 'ri-chat-smile-3-line', genre: 'Co-op talk', category: 'role', accent: '#5b7cfa', desc: '裁判出题，你和角色分别作答，再判定默契度。' },
    { id: 'cardmatch', title: '语言翻牌', tag: '学习联动', icon: 'ri-flashlight-line', genre: 'Study arcade', category: 'study', accent: '#34a853', desc: '用学习卡做小游戏，随机抽一张多语言卡来回忆。' },
    { id: 'coming-board', title: '桌游房间', tag: '即将开放', icon: 'ri-dice-5-line', genre: 'Board games', category: 'role', accent: '#ff9f0a', desc: '预留给真心话、抽卡、跑团类玩法，后续接入角色列表。', comingSoon: true },
    { id: 'coming-puzzle', title: '解谜档案', tag: '即将开放', icon: 'ri-folder-shield-2-line', genre: 'Mystery', category: 'role', accent: '#8e8e93', desc: '预留给多角色剧情推理和线索收集，不会只固定成狼人杀。', comingSoon: true }
];

function getActiveGame() {
    return localStorage.getItem(GAME_ACTIVE_KEY) || 'hub';
}

function setActiveGame(gameId) {
    localStorage.setItem(GAME_ACTIVE_KEY, gameId || 'hub');
}

function getGamePlayers() {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const userAvatar = profile.avatar || '';
    const chars = getWolfchaCharacters().slice(0, 9).map((char, index) => ({
        id: char.id,
        name: getMusicCharName(char),
        avatar: char.avatar || '',
        number: index + 2,
        isUser: false,
        role: ''
    }));
    return [{
        id: 'user',
        name: profile.name || '你',
        avatar: userAvatar,
        number: 1,
        isUser: true,
        role: ''
    }, ...chars];
}

function getWolfchaCharacters() {
    return Array.isArray(window.myCharacters) ? window.myCharacters.filter(char => char && char.id && !char.isGroupChat) : [];
}

function getWolfchaSetupIds() {
    const chars = getWolfchaCharacters();
    const allIds = chars.map(char => char.id);
    try {
        const saved = JSON.parse(localStorage.getItem(WOLFCHA_SETUP_KEY) || '[]');
        const valid = Array.isArray(saved) ? saved.filter(id => allIds.includes(id)) : [];
        if (valid.length) return valid.slice(0, 9);
    } catch (e) {}
    return allIds.slice(0, Math.min(5, allIds.length));
}

function saveWolfchaSetupIds(ids) {
    const allIds = getWolfchaCharacters().map(char => char.id);
    const valid = Array.isArray(ids) ? ids.filter((id, index) => allIds.includes(id) && ids.indexOf(id) === index).slice(0, 9) : [];
    localStorage.setItem(WOLFCHA_SETUP_KEY, JSON.stringify(valid));
}

function shuffleWolfchaList(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function normalizeWolfchaLogEntry(entry) {
    if (entry && typeof entry === 'object') return entry;
    return { type: 'narrator', name: '旁白', text: String(entry || '') };
}

function getWolfchaLastLog(state) {
    const logs = Array.isArray(state?.log) ? state.log.map(normalizeWolfchaLogEntry) : [];
    return logs[logs.length - 1] || { type: 'narrator', name: '旁白', text: '人到齐了，开始吧。' };
}

function pushWolfchaLog(state, entry) {
    if (!Array.isArray(state.log)) state.log = [];
    state.log.push(normalizeWolfchaLogEntry(entry));
    if (state.log.length > 80) state.log = state.log.slice(-80);
}

function getGameState() {
    try {
        const state = JSON.parse(localStorage.getItem(GAME_STATE_KEY) || '{}') || {};
        return state.phase ? state : null;
    } catch (e) {
        return null;
    }
}

function saveGameState(state) {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state || {}));
}

function initGameApp() {
    setActiveGame('hub');
    renderGameApp();
}

function openGameHub() {
    setActiveGame('hub');
    renderGameApp();
}
window.openGameHub = openGameHub;

function handleGameBack() {
    if (getActiveGame() === 'hub') {
        if (typeof closeApp === 'function') closeApp('game');
        return;
    }
    openGameHub();
}
window.handleGameBack = handleGameBack;

function openMiniGame(gameId) {
    const game = GAME_LIBRARY.find(item => item.id === gameId);
    if (game?.comingSoon) {
        if (typeof showWechatToast === 'function') showWechatToast('这个游戏位已经留好，后续可以继续接玩法。');
        return;
    }
    setActiveGame(gameId);
    if (gameId === 'wolfcha') {
        localStorage.removeItem(GAME_STATE_KEY);
        localStorage.setItem(WOLFCHA_ENTRY_KEY, 'opening');
    }
    if (gameId === 'acting') {
        localStorage.removeItem(ACTING_GAME_STATE_KEY);
    }
    if (isBoardCompanionGame(gameId)) {
        localStorage.removeItem(BOARD_GAME_READY_KEY_PREFIX + gameId);
    }
    renderGameApp();
}
window.openMiniGame = openMiniGame;

function updateGameHeader(mode) {
    const kicker = document.getElementById('game-header-kicker');
    const title = document.getElementById('game-header-title');
    if (kicker) kicker.textContent = mode === 'hub' ? 'GAME HUB' : 'PLAYING';
    if (title) title.textContent = mode === 'hub' ? '小游戏' : (GAME_LIBRARY.find(game => game.id === mode)?.title || '小游戏');
}

function resetWolfchaGame(shouldRender = true) {
    startWolfchaGame(getWolfchaSetupIds(), shouldRender);
}

function startWolfchaGame(charIds = getWolfchaSetupIds(), shouldRender = true) {
    const chars = getWolfchaCharacters();
    const selectedIds = Array.isArray(charIds) ? charIds : [];
    const selectedChars = selectedIds
        .map(id => chars.find(char => char.id === id))
        .filter(Boolean)
        .slice(0, 9);
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const players = [{
        id: 'user',
        name: profile.name || '你',
        avatar: profile.avatar || '',
        number: 1,
        isUser: true,
        role: '',
        alive: true
    }, ...selectedChars.map((char, index) => ({
        id: char.id,
        name: getMusicCharName(char),
        avatar: char.avatar || '',
        number: index + 2,
        isUser: false,
        role: '',
        alive: true
    }))];
    const roles = shuffleWolfchaList([...GAME_ROLES]).slice(0, players.length);
    const state = {
        phase: 'day',
        day: 1,
        turnMode: 'day_intro',
        speechQueue: players.map(player => player.id),
        speechIndex: -1,
        awaitingUserSpeech: false,
        aiSpeechBusyId: '',
        nightStep: 0,
        action: '旁白开场',
        selectedId: players[0]?.id || 'user',
        currentSpeakerId: players[0]?.id || 'user',
        log: [
            { type: 'narrator', name: '旁白', text: `人到齐了，${players.length} 名玩家入场，身份已随机分配。` },
            { type: 'narrator', name: '旁白', text: '第一天从警徽竞选发言开始。点击「旁白继续」，我会依次点名发言。' }
        ],
        players: players.map((player, index) => ({ ...player, role: roles[index] || '村民', alive: true }))
    };
    saveWolfchaSetupIds(selectedChars.map(char => char.id));
    saveGameState(state);
    if (shouldRender) renderGameApp();
}
window.resetWolfchaGame = resetWolfchaGame;
window.startWolfchaGame = startWolfchaGame;

function getWolfchaUserPlayer(state = null) {
    const players = Array.isArray(state?.players) ? state.players : [];
    return players.find(player => player && player.isUser) || null;
}

function isWolfchaRoleVisibleToUser(player, state = null) {
    if (!player) return false;
    if (player.isUser) return true;
    const userPlayer = getWolfchaUserPlayer(state);
    return !!(userPlayer && userPlayer.role === '狼人' && player.role === '狼人');
}

function getWolfchaPlayerRoleLabel(player, state = null) {
    if (!player) return '身份隐藏';
    if (isWolfchaRoleVisibleToUser(player, state)) return player.role || '未知身份';
    return player.alive === false ? '身份封存' : '身份隐藏';
}

function getWolfchaPlayerRoleClass(player, state = null) {
    if (!player) return 'hidden';
    if (!isWolfchaRoleVisibleToUser(player, state)) return 'hidden';
    return player.role === '狼人' ? 'wolf' : '';
}

function getWolfchaRoleIconForPlayer(player, state = null) {
    if (!isWolfchaRoleVisibleToUser(player, state)) return 'ri-lock-2-line';
    const role = player && player.role;
    if (role === '狼人') return 'ri-moon-clear-fill';
    if (role === '预言家') return 'ri-eye-2-fill';
    if (role === '女巫') return 'ri-flask-line';
    if (role === '守卫') return 'ri-shield-star-fill';
    if (role === '猎人') return 'ri-crosshair-2-line';
    return 'ri-user-smile-line';
}

function getWolfchaPublicLogText(entry, state = null) {
    const item = normalizeWolfchaLogEntry(entry);
    const players = Array.isArray(state?.players) ? state.players : [];
    const player = item.playerId ? players.find(row => row.id === item.playerId) : null;
    const text = String(item.text || '');
    if (player && !isWolfchaRoleVisibleToUser(player, state)) {
        return text.replace(/身份是\s*(狼人|预言家|女巫|守卫|猎人|村民)[。.!！]?/g, '身份已由裁判记录，玩家视角不公开。');
    }
    return text;
}

function getGameHubFilter() {
    const saved = localStorage.getItem(GAME_HUB_FILTER_KEY);
    return ['all', 'role', 'study', 'arcade', 'board'].includes(saved) ? saved : 'all';
}

function setGameHubFilter(filter) {
    localStorage.setItem(GAME_HUB_FILTER_KEY, ['all', 'role', 'study', 'arcade', 'board'].includes(filter) ? filter : 'all');
    renderGameApp();
}
window.setGameHubFilter = setGameHubFilter;

function getWolfchaEntryStep() {
    return localStorage.getItem(WOLFCHA_ENTRY_KEY) || 'opening';
}

function renderWolfchaOpening(el) {
    const chars = getWolfchaCharacters();
    const selectedCount = getWolfchaSetupIds().length;
    el.innerHTML = `
        <section class="wolfcha-opening">
            <div class="wolfcha-opening-bg" aria-hidden="true"></div>
            <div class="wolfcha-opening-orbit" aria-hidden="true"></div>
            <div class="wolfcha-opening-cards" aria-hidden="true">
                <span><i class="ri-moon-clear-fill"></i><b>狼人</b></span>
                <span><i class="ri-eye-2-fill"></i><b>预言家</b></span>
                <span><i class="ri-shield-star-fill"></i><b>守卫</b></span>
            </div>
            <div class="wolfcha-opening-copy">
                <span>MOONLIT TABLE</span>
                <strong>梦境牌局即将开启</strong>
                <p>午夜、身份、谎言和预言会在同一张桌上醒来。先召集角色，再由旁白引导入局。</p>
            </div>
            <div class="wolfcha-opening-meta">
                <span><b>${selectedCount || Math.min(chars.length, 9)}</b> 已候选</span>
                <span><b>${chars.length}</b> 可邀请</span>
            </div>
            <button type="button" class="wolfcha-opening-start" onclick="enterWolfchaSetup()">
                <i class="ri-sparkling-2-fill"></i>
                <span>召集入局</span>
            </button>
        </section>
    `;
}
window.renderWolfchaOpening = renderWolfchaOpening;

function enterWolfchaSetup() {
    localStorage.setItem(WOLFCHA_ENTRY_KEY, 'setup');
    localStorage.removeItem(GAME_STATE_KEY);
    renderGameApp();
}
window.enterWolfchaSetup = enterWolfchaSetup;

function renderWolfchaSetup(el) {
    const chars = getWolfchaCharacters();
    const selectedIds = getWolfchaSetupIds();
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    el.innerHTML = `
        <section class="wolfcha-setup">
            <div class="wolfcha-setup-hero">
                <div class="wolfcha-setup-sigil" aria-hidden="true"><i class="ri-moon-clear-fill"></i></div>
                <span>BYND WEREWOLF</span>
                <strong>选择陪你入局的角色</strong>
                <p>你会自动加入牌局。开局后只有你的身份可见；如果你是狼人，会额外看到同阵营狼人。其他身份由裁判持有。</p>
                <div class="wolfcha-setup-omens" aria-hidden="true">
                    <i></i><i></i><i></i><i></i>
                </div>
            </div>
            <div class="wolfcha-user-card">
                <div>${profile.avatar ? `<img src="${musicEscapeAttr(profile.avatar)}" alt="${musicEscapeAttr(profile.name || '你')}">` : '<i class="ri-user-smile-line"></i>'}</div>
                <span>玩家 1</span>
                <strong>${musicEscapeHtml(profile.name || '你')}</strong>
                <em>固定加入</em>
            </div>
            <div class="wolfcha-setup-head">
                <strong>AI 玩家</strong>
                <span>${selectedIds.length}/${Math.min(chars.length, 9)} 已选择</span>
            </div>
            <div class="wolfcha-setup-list">
                ${chars.length ? chars.map((char, index) => {
                    const selected = selectedIds.includes(char.id);
                    return `
                        <button type="button" class="wolfcha-setup-char ${selected ? 'selected' : ''}" onclick="toggleWolfchaSetupChar('${musicEscapeAttr(char.id)}')">
                            <div class="wolfcha-setup-avatar">${char.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(getMusicCharName(char))}">` : '<i class="ri-user-line"></i>'}</div>
                            <div>
                                <span>玩家 ${index + 2}</span>
                                <strong>${musicEscapeHtml(getMusicCharName(char))}</strong>
                            </div>
                            <i class="${selected ? 'ri-checkbox-circle-fill' : 'ri-add-circle-line'}"></i>
                        </button>
                    `;
                }).join('') : '<div class="wolfcha-setup-empty">先在微信里导入角色，再回来选择陪玩的 AI。</div>'}
            </div>
            <div class="wolfcha-setup-actions">
                <button type="button" onclick="selectFirstWolfchaChars()"><i class="ri-group-line"></i> 选前九个</button>
                <button type="button" class="primary" onclick="startWolfchaGameFromSetup()" ${selectedIds.length ? '' : 'disabled'}><i class="ri-play-fill"></i> 开始游戏</button>
            </div>
        </section>
    `;
}
window.renderWolfchaSetup = renderWolfchaSetup;

function openWolfchaSetup() {
    localStorage.removeItem(GAME_STATE_KEY);
    localStorage.setItem(WOLFCHA_ENTRY_KEY, 'setup');
    setActiveGame('wolfcha');
    renderGameApp();
}
window.openWolfchaSetup = openWolfchaSetup;

function toggleWolfchaSetupChar(id) {
    const selected = getWolfchaSetupIds();
    const exists = selected.includes(id);
    const next = exists ? selected.filter(item => item !== id) : [...selected, id].slice(0, 9);
    saveWolfchaSetupIds(next);
    renderGameApp();
}
window.toggleWolfchaSetupChar = toggleWolfchaSetupChar;

function selectFirstWolfchaChars() {
    saveWolfchaSetupIds(getWolfchaCharacters().slice(0, 9).map(char => char.id));
    renderGameApp();
}
window.selectFirstWolfchaChars = selectFirstWolfchaChars;

function startWolfchaGameFromSetup() {
    const selected = getWolfchaSetupIds();
    if (!selected.length) {
        if (typeof showWechatToast === 'function') showWechatToast('至少选择一个 AI 角色');
        return;
    }
    localStorage.setItem(WOLFCHA_ENTRY_KEY, 'playing');
    startWolfchaGame(selected, true);
}
window.startWolfchaGameFromSetup = startWolfchaGameFromSetup;

function renderGameApp() {
    const el = document.getElementById('game-content');
    if (!el) return;
    const activeGame = getActiveGame();
    const gameWindow = document.getElementById('app-game-window');
    if (gameWindow) {
        Array.from(gameWindow.classList).forEach(cls => { if (cls.startsWith('game-mode-')) gameWindow.classList.remove(cls); });
        gameWindow.classList.add(`game-mode-${activeGame}`);
    }
    if (activeGame !== 'chicken') {
        stopChickenGame(false);
        stopChickenBgm();
    }
    updateGameHeader(activeGame);
    if (activeGame === 'hub') {
        renderGameHub(el);
        return;
    }
    if (activeGame === 'sync') {
        renderSyncGame(el);
        return;
    }
    if (activeGame === 'cardmatch') {
        renderCardMatchGame(el);
        return;
    }
    if (activeGame === 'catpot') {
        renderCatPotGame(el);
        return;
    }
    if (activeGame === 'acting') {
        renderActingGame(el);
        return;
    }
    if (activeGame === 'chicken') {
        renderChickenGame(el);
        return;
    }
    if (activeGame === 'jump') {
        renderJumpGame(el);
        return;
    }
    if (activeGame === 'watersort') {
        renderWaterSortGame(el);
        return;
    }
    if (activeGame === '2048') {
        render2048Game(el);
        return;
    }
    if (activeGame === 'gomoku') {
        if (!isBoardGameReady(activeGame)) {
            renderBoardGameCompanionSetup(el, activeGame);
            return;
        }
        renderGomokuGame(el);
        return;
    }
    if (activeGame === 'chess' || activeGame === 'xiangqi') {
        if (!isBoardGameReady(activeGame)) {
            renderBoardGameCompanionSetup(el, activeGame);
            return;
        }
        renderBoardGame(el, activeGame);
        return;
    }
    if (activeGame === 'wolfcha' && !getGameState() && getWolfchaEntryStep() !== 'setup') {
        renderWolfchaOpening(el);
        return;
    }
    if (activeGame === 'wolfcha' && !getGameState()) {
        renderWolfchaSetup(el);
        return;
    }
    const state = getGameState() || { players: getGamePlayers(), log: [] };
    const players = state.players || getGamePlayers();
    const alive = players.filter(player => player.alive !== false).length;
    const selected = players.find(player => player.id === state.currentSpeakerId) || players.find(player => player.id === state.selectedId) || players[0];
    const lastLog = getWolfchaLastLog(state);
    const lastNarrator = (state.log || [])
        .map(normalizeWolfchaLogEntry)
        .filter(item => item.type === 'narrator')
        .slice(-1)[0];
    const waitingUserSpeech = !!state.awaitingUserSpeech && selected?.isUser;
    const phaseText = state.phase === 'night' ? '夜晚行动' : '白日发言';
    const selectedRole = getWolfchaPlayerRoleLabel(selected, state);
    const selectedRoleIcon = getWolfchaRoleIconForPlayer(selected, state);
    const dialogMetaText = lastNarrator?.text && lastNarrator.text !== lastLog.text ? lastNarrator.text : '';
    const dialogText = getWolfchaPublicLogText(lastLog, state);
    el.innerHTML = `
        <section class="wolfcha-stage ${state.phase === 'night' ? 'night' : ''}">
            <div class="wolfcha-table-aura" aria-hidden="true"></div>
            <div class="wolfcha-topline">
                <div class="wolfcha-status">
                    <span><small>第</small><b>${String(state.day || 1).padStart(2, '0')}</b><small>天</small></span>
                    <span><small>存活</small><b>${alive}/${players.length}</b></span>
                </div>
                <div class="wolfcha-top-actions">
                    <button type="button" onclick="openGameHub()"><i class="ri-apps-2-line"></i> 大厅</button>
                    <button type="button" onclick="openWolfchaSetup()"><i class="ri-group-line"></i> 换人</button>
                </div>
            </div>
            <div class="wolfcha-action-pill"><i class="ri-eye-line"></i><span>${musicEscapeHtml(state.action || '等待开始')}</span></div>
            <div class="wolfcha-center">
                ${waitingUserSpeech ? `
                    <div class="wolfcha-user-speech-box">
                        <textarea id="wolfcha-user-speech-input" maxlength="180" placeholder="轮到你发言，写下你的怀疑、站边或解释..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitWolfchaUserSpeech();}"></textarea>
                        <button type="button" onclick="submitWolfchaUserSpeech()"><i class="ri-send-plane-fill"></i> 发言</button>
                    </div>
                ` : ''}
                <div class="wolfcha-speaker-card">
                    <div class="wolfcha-role-card">
                        <span>${musicEscapeHtml(selectedRole)}</span>
                        <i class="${selectedRoleIcon}"></i>
                        <b>${musicEscapeHtml(phaseText)}</b>
                    </div>
                    <div class="wolfcha-avatar-large">${selected?.avatar ? `<img src="${musicEscapeAttr(selected.avatar)}" alt="${musicEscapeAttr(selected.name)}">` : '<i class="ri-user-smile-line"></i>'}</div>
                    <div>
                        <span>当前发言席</span>
                        <strong>${musicEscapeHtml(selected?.name || '旁白')}</strong>
                    </div>
                </div>
                <div class="wolfcha-dialog">
                    <strong>${musicEscapeHtml(lastLog.name || selected?.name || '旁白')}</strong>
                    <p>${musicEscapeHtml(dialogText || '人到齐了，开始吧。')}</p>
                    ${dialogMetaText ? `<span>${musicEscapeHtml(getWolfchaPublicLogText(lastNarrator, state))}</span>` : ''}
                </div>
            </div>
            <div class="wolfcha-actions">
                <button type="button" onclick="wolfchaNarratorStep()"><i class="ri-scroll-to-bottom-line"></i> 旁白继续</button>
                <button type="button" onclick="wolfchaNextSpeech()"><i class="ri-chat-voice-line"></i> ${waitingUserSpeech ? '写发言' : '当前发言'}</button>
                <button type="button" onclick="startWolfchaNight()"><i class="ri-moon-clear-line"></i> 入夜</button>
                <button type="button" onclick="wolfchaVoteSelected()"><i class="ri-skull-2-line"></i> 放逐</button>
            </div>
        </section>
        <section class="wolfcha-player-rail">
            ${players.map(player => `
                <button type="button" class="wolfcha-player ${player.id === state.selectedId ? 'active' : ''} ${player.alive === false ? 'dead' : ''}" onclick="selectWolfchaPlayer('${musicEscapeAttr(player.id)}')">
                    <span class="wolfcha-role ${getWolfchaPlayerRoleClass(player, state)}">${musicEscapeHtml(getWolfchaPlayerRoleLabel(player, state))}</span>
                    <div>${player.avatar ? `<img src="${musicEscapeAttr(player.avatar)}" alt="${musicEscapeAttr(player.name)}">` : '<i class="ri-user-line"></i>'}</div>
                    <strong><em>${player.number}</em>${musicEscapeHtml(player.name)}</strong>
                </button>
            `).join('')}
        </section>
    `;
}
window.renderGameApp = renderGameApp;

function renderGameHub(el) {
    const chars = window.myCharacters || [];
    const featured = GAME_LIBRARY[0];
    const playableCount = GAME_LIBRARY.filter(game => !game.comingSoon).length;
    const filter = getGameHubFilter();
    const tabs = [
        { id: 'all', label: '全部' },
        { id: 'role', label: '角色联机' },
        { id: 'study', label: '学习联动' },
        { id: 'arcade', label: '街机' },
        { id: 'board', label: '棋盘' }
    ];
    const games = GAME_LIBRARY.filter(game => filter === 'all' || game.category === filter);
    el.innerHTML = `
        <section class="game-hub">
            <div class="game-hub-hero appstore-hero" onclick="openMiniGame('${musicEscapeAttr(featured.id)}')">
                <div class="appstore-hero-copy">
                    <span>BYND GAME LIBRARY</span>
                    <strong>${musicEscapeHtml(featured.title)}</strong>
                    <p>${musicEscapeHtml(featured.desc)}</p>
                    <button type="button"><i class="ri-play-fill"></i> 开始游戏</button>
                </div>
                <div class="appstore-hero-art" style="--game-accent:${musicEscapeAttr(featured.accent || '#0a84ff')}">
                    <i class="${musicEscapeAttr(featured.icon)}"></i>
                    <em>${chars.length || 0} CHARS</em>
                </div>
            </div>
            <div class="game-hub-tabs">
                ${tabs.map(tab => `<button type="button" class="${filter === tab.id ? 'active' : ''}" onclick="setGameHubFilter('${musicEscapeAttr(tab.id)}')">${musicEscapeHtml(tab.label)}</button>`).join('')}
            </div>
            <div class="game-section-title">
                <strong>游戏库</strong>
                <span>${playableCount} playable · ${GAME_LIBRARY.length} slots</span>
            </div>
            <div class="game-library">
                ${games.map(game => `
                    <button type="button" class="game-library-card ${game.comingSoon ? 'coming' : ''}" style="--game-accent:${musicEscapeAttr(game.accent || '#0a84ff')}" onclick="openMiniGame('${musicEscapeAttr(game.id)}')">
                        <div class="game-card-cover"><i class="${musicEscapeAttr(game.icon)}"></i></div>
                        <div>
                            <span>${musicEscapeHtml(game.tag)}</span>
                            <strong>${musicEscapeHtml(game.title)}</strong>
                            <p>${musicEscapeHtml(game.desc)}</p>
                            <small>${musicEscapeHtml(game.genre || '')}</small>
                        </div>
                        <em class="${game.comingSoon ? 'ri-lock-2-line' : 'ri-arrow-right-s-line'}"></em>
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

