let jumpChargeTimer = 0;
let jumpAnimating = false;

const JUMP_FIELD_W = 344;
const JUMP_FIELD_H = 430;
const JUMP_PLATFORM_H = 36;
const JUMP_PLAYER_H = 42;
const JUMP_CURRENT_BASE = { x: 88, y: 86, w: 92, h: JUMP_PLATFORM_H, type: 'start', label: 'BYND' };
const JUMP_SCENES = [
    { name: '清晨街角', skyA: '#a9dcff', skyB: '#f8fcff', groundA: '#c8efbf', groundB: '#78d8b0', accent: '#ffb34d' },
    { name: '雨后便利店', skyA: '#cbd9ff', skyB: '#f7faff', groundA: '#d7e5ff', groundB: '#92ace8', accent: '#5e7ce2' },
    { name: '海边公路', skyA: '#a7f0f3', skyB: '#f6fffb', groundA: '#b7eadf', groundB: '#47b4c6', accent: '#ff7a59' },
    { name: '天台霓虹', skyA: '#9da7ff', skyB: '#f4f0ff', groundA: '#d8d3ff', groundB: '#6d6bd6', accent: '#ff5fa2' },
    { name: '午后公园', skyA: '#ffe0aa', skyB: '#fffaf2', groundA: '#d8f0a2', groundB: '#88cb72', accent: '#2fa66a' },
    { name: '午夜车站', skyA: '#18233f', skyB: '#7e8fc8', groundA: '#ccd8f4', groundB: '#54637f', accent: '#ffe16a' }
];
const JUMP_PLATFORM_TYPES = [
    { type: 'store', label: '24H' },
    { type: 'gift', label: 'BOX' },
    { type: 'clock', label: 'TIME' },
    { type: 'music', label: 'PLAY' },
    { type: 'coffee', label: 'CAFE' },
    { type: 'book', label: 'BOOK' },
    { type: 'star', label: 'STAR' }
];

function clampJumpNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getJumpScene(score = 0) {
    return JUMP_SCENES[Math.floor(Math.max(0, score || 0) / 4) % JUMP_SCENES.length];
}

function normalizeJumpPlatform(platform, fallback = JUMP_CURRENT_BASE) {
    const base = platform || fallback;
    return {
        x: Number.isFinite(base.x) ? base.x : fallback.x,
        y: Number.isFinite(base.y) ? base.y : fallback.y,
        w: Number.isFinite(base.w) ? clampJumpNumber(base.w, 54, 112) : fallback.w,
        h: Number.isFinite(base.h) ? base.h : JUMP_PLATFORM_H,
        type: base.type || fallback.type || 'start',
        label: base.label || fallback.label || 'BYND'
    };
}

function createJumpCurrentPlatform(fromTarget = null) {
    const target = fromTarget ? normalizeJumpPlatform(fromTarget, JUMP_CURRENT_BASE) : null;
    return {
        ...JUMP_CURRENT_BASE,
        w: target ? clampJumpNumber(target.w, 58, 104) : JUMP_CURRENT_BASE.w,
        type: target?.type || JUMP_CURRENT_BASE.type,
        label: target?.label || JUMP_CURRENT_BASE.label
    };
}

function createJumpTarget(score = 0) {
    const type = JUMP_PLATFORM_TYPES[(Math.floor(Math.random() * JUMP_PLATFORM_TYPES.length) + Math.max(0, score || 0)) % JUMP_PLATFORM_TYPES.length];
    const widthBase = 88 - Math.min(18, Math.floor((score || 0) / 5) * 2);
    const targetW = clampJumpNumber(widthBase + Math.round(Math.random() * 18) - 7, 58, 98);
    const targetX = 224 + Math.round(Math.random() * 56);
    const targetY = 178 + Math.round(Math.random() * 86);
    return {
        x: targetX,
        y: targetY,
        w: targetW,
        h: JUMP_PLATFORM_H,
        type: type.type,
        label: type.label
    };
}

function createJumpState() {
    const current = createJumpCurrentPlatform();
    return {
        score: 0,
        best: Math.max(0, parseInt(localStorage.getItem(JUMP_GAME_BEST_KEY) || '0', 10) || 0),
        power: 0,
        combo: 0,
        step: 0,
        current,
        target: createJumpTarget(0),
        landing: null,
        message: '按住蓄力，松手跳到前方下一块。',
        over: false
    };
}

function getJumpState() {
    try {
        const state = JSON.parse(localStorage.getItem(JUMP_GAME_STATE_KEY) || '{}');
        if (state && Number.isFinite(state.score) && state.current && state.target) {
            const defaults = createJumpState();
            const merged = { ...defaults, ...state };
            merged.current = normalizeJumpPlatform(merged.current, defaults.current);
            merged.target = normalizeJumpPlatform(merged.target, defaults.target);
            merged.landing = merged.landing && Number.isFinite(merged.landing.x) && Number.isFinite(merged.landing.y) ? merged.landing : null;
            merged.combo = Math.max(0, parseInt(merged.combo || '0', 10) || 0);
            merged.step = Math.max(0, parseInt(merged.step || '0', 10) || 0);
            return merged;
        }
    } catch (e) {}
    const state = createJumpState();
    saveJumpState(state);
    return state;
}

function saveJumpState(state) {
    localStorage.setItem(JUMP_GAME_STATE_KEY, JSON.stringify(state));
}

function resetJumpGame() {
    clearInterval(jumpChargeTimer);
    jumpChargeTimer = 0;
    jumpAnimating = false;
    saveJumpState(createJumpState());
    renderGameApp();
}
window.resetJumpGame = resetJumpGame;

function beginJumpCharge() {
    if (jumpAnimating) return;
    let state = getJumpState();
    if (state.over) {
        state = createJumpState();
        saveJumpState(state);
        const field = document.getElementById('jump-field');
        if (field) {
            applyJumpFieldVars(field, state);
            field.classList.remove('jump-success', 'jump-fail', 'is-jumping');
        }
        document.querySelector('.jump-player')?.classList.remove('fallen');
    }
    clearInterval(jumpChargeTimer);
    state.power = 10;
    state.message = '蓄力中...';
    saveJumpState(state);
    document.getElementById('jump-field')?.classList.add('is-charging');
    renderJumpPower(state.power);
    jumpChargeTimer = setInterval(() => {
        const next = getJumpState();
        next.power = Math.min(100, (next.power || 0) + 4.2);
        saveJumpState(next);
        renderJumpPower(next.power);
    }, 45);
}
window.beginJumpCharge = beginJumpCharge;

function releaseJumpCharge() {
    clearInterval(jumpChargeTimer);
    jumpChargeTimer = 0;
    const state = getJumpState();
    if (state.over || jumpAnimating) return;
    document.getElementById('jump-field')?.classList.remove('is-charging');
    const current = normalizeJumpPlatform(state.current, JUMP_CURRENT_BASE);
    const target = normalizeJumpPlatform(state.target, createJumpTarget(state.score || 0));
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const targetDistance = Math.max(1, Math.hypot(dx, dy));
    const jumpDistance = (state.power || 0) * 2.45;
    const ratio = jumpDistance / targetDistance;
    const landingX = current.x + dx * ratio;
    const landingY = current.y + dy * ratio;
    const distanceError = jumpDistance - targetDistance;
    const hitTolerance = Math.max(24, target.w * 0.42);
    const perfect = Math.abs(distanceError) <= 10;
    const nextState = { ...state, power: 0 };
    if (Math.abs(distanceError) <= hitTolerance) {
        const combo = perfect ? Math.min(10, (state.combo || 0) + 2) : 0;
        nextState.combo = combo;
        nextState.score += perfect ? combo : 1;
        nextState.best = Math.max(nextState.best || 0, nextState.score || 0);
        localStorage.setItem(JUMP_GAME_BEST_KEY, String(nextState.best));
        nextState.current = createJumpCurrentPlatform(target);
        nextState.target = createJumpTarget(nextState.score);
        nextState.step = (state.step || 0) + 1;
        nextState.landing = null;
        nextState.message = perfect ? `中心落点，连中 +${combo}。` : '落稳了，镜头继续向前。';
    } else {
        nextState.over = true;
        nextState.combo = 0;
        nextState.landing = {
            x: clampJumpNumber(landingX, 24, JUMP_FIELD_W - 24),
            y: clampJumpNumber(landingY, 34, JUMP_FIELD_H - 86)
        };
        nextState.message = distanceError < 0 ? '差一点，跳短了。' : '用力过猛，跳过啦。';
    }
    animateJumpResult({ x: landingX, y: landingY }, !nextState.over, nextState, current, target);
}
window.releaseJumpCharge = releaseJumpCharge;

function getJumpPlayerPoint(state, current = normalizeJumpPlatform(state.current, JUMP_CURRENT_BASE)) {
    if (state.over && state.landing) {
        return {
            x: clampJumpNumber(state.landing.x, 24, JUMP_FIELD_W - 24),
            bottom: clampJumpNumber(state.landing.y + JUMP_PLATFORM_H + 2, 48, JUMP_FIELD_H - JUMP_PLAYER_H)
        };
    }
    return {
        x: current.x,
        bottom: current.y + current.h + 2
    };
}

function applyJumpFieldVars(field, state) {
    if (!field) return;
    const current = normalizeJumpPlatform(state.current, JUMP_CURRENT_BASE);
    const target = normalizeJumpPlatform(state.target, createJumpTarget(state.score || 0));
    const player = getJumpPlayerPoint(state, current);
    const scene = getJumpScene(state.score || 0);
    const vars = {
        '--scene-sky-a': scene.skyA,
        '--scene-sky-b': scene.skyB,
        '--scene-ground-a': scene.groundA,
        '--scene-ground-b': scene.groundB,
        '--scene-accent': scene.accent,
        '--current-x': `${current.x}px`,
        '--current-y': `${current.y}px`,
        '--current-w': `${current.w}px`,
        '--target-x': `${target.x}px`,
        '--target-y': `${target.y}px`,
        '--target-w': `${target.w}px`,
        '--player-x': `${player.x}px`,
        '--player-bottom': `${player.bottom}px`
    };
    Object.entries(vars).forEach(([name, value]) => field.style.setProperty(name, value));
}

function animateJumpResult(landing, success, nextState, current, target) {
    jumpAnimating = true;
    playMiniGameSound('jump');
    const field = document.getElementById('jump-field');
    const startBottom = current.y + current.h + 2;
    const landingX = success ? clampJumpNumber(landing.x, target.x - target.w / 2 + 8, target.x + target.w / 2 - 8) : clampJumpNumber(landing.x, 22, JUMP_FIELD_W - 22);
    const landingY = success ? target.y + target.h + 2 : clampJumpNumber(landing.y + JUMP_PLATFORM_H + 2, 44, JUMP_FIELD_H - JUMP_PLAYER_H);
    const midX = (current.x + landingX) / 2;
    const midY = Math.max(startBottom, landingY) + 92;
    if (field) {
        field.style.setProperty('--jump-start-x', `${current.x}px`);
        field.style.setProperty('--jump-start-y', `${startBottom}px`);
        field.style.setProperty('--jump-land-x', `${landingX}px`);
        field.style.setProperty('--jump-land-y', `${landingY}px`);
        field.style.setProperty('--jump-mid-x', `${midX}px`);
        field.style.setProperty('--jump-mid-y', `${Math.min(JUMP_FIELD_H - 24, midY)}px`);
        field.classList.remove('jump-success', 'jump-fail', 'is-jumping');
        field.classList.add(success ? 'jump-success' : 'jump-fail', 'is-jumping');
    }
    setTimeout(() => {
        playMiniGameSound(success ? 'land' : 'fail');
        if (success && field) {
            field.classList.remove('is-jumping');
            field.classList.add('camera-shift');
            setTimeout(() => {
                jumpAnimating = false;
                saveJumpState(nextState);
                renderGameApp();
            }, 260);
            return;
        }
        jumpAnimating = false;
        saveJumpState(nextState);
        renderGameApp();
    }, 520);
}

function renderJumpPower(power) {
    const fill = document.getElementById('jump-power-fill');
    const value = document.getElementById('jump-power-value');
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, power || 0))}%`;
    if (value) value.textContent = `${Math.round(power || 0)}%`;
}

function bindJumpGameInput() {
    const field = document.getElementById('jump-field');
    if (!field || field.dataset.bound) return;
    field.dataset.bound = '1';
    let chargingPointerId = null;
    field.addEventListener('pointerdown', event => {
        if (event.target.closest('button')) return;
        event.preventDefault();
        chargingPointerId = event.pointerId;
        field.setPointerCapture?.(event.pointerId);
        beginJumpCharge();
    });
    field.addEventListener('pointerup', event => {
        event.preventDefault();
        if (chargingPointerId !== null && event.pointerId !== chargingPointerId) return;
        chargingPointerId = null;
        releaseJumpCharge();
    });
    field.addEventListener('pointercancel', () => {
        chargingPointerId = null;
        releaseJumpCharge();
    });
}

function renderJumpGame(el) {
    const state = getJumpState();
    const current = normalizeJumpPlatform(state.current, JUMP_CURRENT_BASE);
    const target = normalizeJumpPlatform(state.target, createJumpTarget(state.score || 0));
    const scene = getJumpScene(state.score || 0);
    const player = getJumpPlayerPoint(state, current);
    const fieldStyle = [
        `--scene-sky-a:${scene.skyA}`,
        `--scene-sky-b:${scene.skyB}`,
        `--scene-ground-a:${scene.groundA}`,
        `--scene-ground-b:${scene.groundB}`,
        `--scene-accent:${scene.accent}`,
        `--current-x:${current.x}px`,
        `--current-y:${current.y}px`,
        `--current-w:${current.w}px`,
        `--target-x:${target.x}px`,
        `--target-y:${target.y}px`,
        `--target-w:${target.w}px`,
        `--player-x:${player.x}px`,
        `--player-bottom:${player.bottom}px`
    ].join(';');
    el.innerHTML = `
        <section class="mini-game-panel jump-panel">
            <div class="jump-top">
                <div><span>JUMP</span><strong>${state.over ? '本局结束' : '跳一跳'}</strong><p>${musicEscapeHtml(state.message || '按住屏幕蓄力。')}</p></div>
                <button type="button" onclick="resetJumpGame()"><i class="ri-refresh-line"></i> 新局</button>
            </div>
            <div class="jump-stats"><span>分数 <b>${state.score || 0}</b></span><span>最高 <b>${state.best || 0}</b></span><span id="jump-power-value">${Math.round(state.power || 0)}%</span></div>
            <div id="jump-field" class="jump-field ${state.over ? 'is-over' : ''}" style="${fieldStyle}">
                <div class="jump-sun"></div>
                <div class="jump-cloud c1"></div>
                <div class="jump-cloud c2"></div>
                <div class="jump-scene-name">${musicEscapeHtml(scene.name)}</div>
                <div class="jump-track"></div>
                <div class="jump-platform start ${musicEscapeHtml(current.type)}"><b>${musicEscapeHtml(current.label)}</b></div>
                <div class="jump-platform target ${musicEscapeHtml(target.type)}"><b>${musicEscapeHtml(target.label)}</b></div>
                <div class="jump-player ${state.over ? 'fallen' : ''}"></div>
                <div class="jump-power"><i id="jump-power-fill" style="width:${Math.round(state.power || 0)}%"></i></div>
            </div>
        </section>
    `;
    requestAnimationFrame(bindJumpGameInput);
}

