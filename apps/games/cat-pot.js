function getCatPotState() {
    try {
        const state = JSON.parse(localStorage.getItem(CATPOT_STATE_KEY) || '{}');
        if (state && Array.isArray(state.placed)) {
            const normalized = normalizeCatPotState(state);
            if (JSON.stringify(normalized) !== JSON.stringify(state)) saveCatPotState(normalized);
            return normalized;
        }
    } catch (e) {}
    const state = createCatPotState();
    saveCatPotState(state);
    return state;
}

function saveCatPotState(state) {
    localStorage.setItem(CATPOT_STATE_KEY, JSON.stringify(state));
}

function getCatPotOrder(state) {
    if (!Array.isArray(state.orders) || !state.orders.some(isValidCatPotOrder)) {
        state.orders = createCatPotOrders(state.level || 1);
    }
    state.orders = state.orders.filter(isValidCatPotOrder);
    while (state.orders.length < CATPOT_CUSTOMER_COUNT) {
        state.orders.push(createCatPotOrder((state.level || 1) + state.orders.length));
    }
    state.order = state.orders[0];
    return state.order;
}

function getCatPotIngredient(id) {
    return CATPOT_INGREDIENTS.find(item => item.id === id) || CATPOT_INGREDIENTS[0];
}

function countCatPotPlaced(state) {
    return state.placed.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
    }, {});
}

function isCatPotOrderComplete(state) {
    const order = getCatPotOrder(state);
    const counts = countCatPotPlaced(state);
    return Object.entries(order.wants).every(([id, need]) => (counts[id] || 0) >= need);
}

function isCatPotPlateExactMatch(order, counts) {
    if (!isValidCatPotOrder(order)) return false;
    const wantedIds = Object.keys(order.wants);
    const plateIds = Object.keys(counts).filter(id => counts[id] > 0);
    if (wantedIds.length !== plateIds.length) return false;
    return wantedIds.every(id => (counts[id] || 0) === order.wants[id]);
}

function findCatPotMatchingOrder(state) {
    const counts = countCatPotPlaced(state);
    return (state.orders || []).find(order => isCatPotPlateExactMatch(order, counts)) || null;
}

function catPotPlaySound(type) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!window._catPotAudioCtx) window._catPotAudioCtx = new AudioCtx();
        const ctx = window._catPotAudioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        const notes = type === 'success' ? [523, 659, 784] : type === 'wrong' ? [196, 164] : type === 'drop' ? [392, 523] : [440];
        notes.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type === 'wrong' ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(freq, now + index * 0.07);
            gain.gain.setValueAtTime(0.0001, now + index * 0.07);
            gain.gain.exponentialRampToValueAtTime(type === 'success' ? 0.16 : 0.1, now + index * 0.07 + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.07 + 0.16);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + index * 0.07);
            osc.stop(now + index * 0.07 + 0.18);
        });
    } catch (e) {}
}

function catPotAddIngredient(id) {
    const item = getCatPotIngredient(id);
    const state = getCatPotState();
    if (state.finished) {
        resetCatPotGame();
        return;
    }
    const counts = countCatPotPlaced(state);
    if (state.placed.length >= 7) {
        state.feedback = '这份餐已经太满了，先上菜或清盘。';
        state.feedbackType = 'wrong';
        state.justCompleted = false;
        saveCatPotState(state);
        catPotPlaySound('wrong');
        renderGameApp();
        return;
    }
    state.placed.push(id);
    const matched = findCatPotMatchingOrder(state);
    state.justCompleted = !!matched;
    state.feedback = matched ? `这份餐匹配 ${matched.cat}，可以上菜。` : `${item.name} 已加入餐盘，继续对照顾客订单。`;
    state.feedbackType = state.justCompleted ? 'complete' : 'drop';
    saveCatPotState(state);
    catPotPlaySound(state.justCompleted ? 'success' : 'drop');
    renderGameApp();
}
window.catPotAddIngredient = catPotAddIngredient;

function catPotRemoveIngredient(index) {
    const state = getCatPotState();
    if (state.finished) return;
    if (index < 0 || index >= state.placed.length) return;
    const [removed] = state.placed.splice(index, 1);
    state.justCompleted = false;
    state.feedback = `${getCatPotIngredient(removed).name} 回到篮子里了。`;
    state.feedbackType = 'ready';
    saveCatPotState(state);
    catPotPlaySound('tap');
    renderGameApp();
}
window.catPotRemoveIngredient = catPotRemoveIngredient;

function catPotServe() {
    const state = getCatPotState();
    if (state.finished) {
        resetCatPotGame();
        return;
    }
    const matched = findCatPotMatchingOrder(state);
    if (!matched) {
        state.feedback = state.placed.length ? '错菜！这份餐不属于任何正在等的顾客，扣连击。' : '餐盘是空的，不能上菜。';
        state.feedbackType = 'wrong';
        state.justCompleted = false;
        state.streak = 0;
        state.wrongs = (state.wrongs || 0) + 1;
        state.roundEndsAt = Math.max(Date.now() + 8000, (state.roundEndsAt || Date.now()) - 3000);
        if (Array.isArray(state.orders) && state.orders[0]) {
            state.orders[0].bornAt = Math.max(Date.now() - (state.orders[0].patienceMs || CATPOT_CUSTOMER_PATIENCE_MS) + 5000, (state.orders[0].bornAt || Date.now()) - 3000);
        }
        saveCatPotState(state);
        catPotPlaySound('wrong');
        renderGameApp();
        return;
    }
    const wasFrontOrder = Array.isArray(state.orders) && state.orders[0] === matched;
    const next = createCatPotState((state.level || 1) + 1, state.score + 1, state.streak + 1);
    next.roundStartedAt = state.roundStartedAt;
    next.roundEndsAt = state.roundEndsAt;
    next.missed = state.missed || 0;
    next.wrongs = state.wrongs || 0;
    next.served = (state.served || state.score || 0) + 1;
    next.target = state.target || CATPOT_TARGET_CUSTOMERS;
    next.rush = Math.min(5, 1 + Math.floor((state.score + 1) / 3));
    next.orders = (state.orders || []).filter(order => order !== matched);
    while (next.orders.length < CATPOT_CUSTOMER_COUNT) next.orders.push(createCatPotOrder(next.level + next.orders.length));
    if (wasFrontOrder && next.orders[0]) next.orders[0].bornAt = Date.now();
    next.order = next.orders[0];
    const fast = getCatPotPatienceLeft(matched) >= 70;
    if (fast) {
        next.score += 1;
        next.feedback = `${matched.cat} 收到正确早餐，快速出餐 +1 小费。`;
    } else {
        next.feedback = `${matched.cat} 收到正确早餐，下一位马上来。`;
    }
    next.feedbackType = 'served';
    next.justCompleted = true;
    if (next.served >= next.target) {
        next.finished = true;
        next.placed = [];
        next.feedback = `营业结束：服务 ${next.served} 位猫猫，错菜 ${next.wrongs || 0} 次，走失 ${next.missed || 0} 位。`;
        next.feedbackType = 'served';
    }
    saveCatPotState(next);
    catPotPlaySound('success');
    renderGameApp();
}
window.catPotServe = catPotServe;

function resetCatPotGame() {
    const state = createCatPotState();
    saveCatPotState(state);
    catPotPlaySound('tap');
    renderGameApp();
}
window.resetCatPotGame = resetCatPotGame;

function catPotClearPlate() {
    const state = getCatPotState();
    state.placed = [];
    state.justCompleted = false;
    state.feedback = '餐盘已清空，重新按顾客订单制作。';
    state.feedbackType = 'ready';
    saveCatPotState(state);
    catPotPlaySound('tap');
    renderGameApp();
}
window.catPotClearPlate = catPotClearPlate;

function getCatPotTimeLeft(state) {
    return Math.max(0, Math.ceil(((state.roundEndsAt || Date.now()) - Date.now()) / 1000));
}

function getCatPotPatienceLeft(order) {
    const left = Math.max(0, (order.bornAt || Date.now()) + (order.patienceMs || CATPOT_CUSTOMER_PATIENCE_MS) - Date.now());
    return Math.max(0, Math.min(100, Math.round((left / (order.patienceMs || CATPOT_CUSTOMER_PATIENCE_MS)) * 100)));
}

function renderCatPotFoodIcon(item, extraClass = '') {
    return `<img class="catpot-food-img ${extraClass}" src="${musicEscapeAttr(item.asset)}" alt="${musicEscapeAttr(item.name)}">`;
}

function renderCatPotGame(el) {
    const state = getCatPotState();
    const order = getCatPotOrder(state);
    const counts = countCatPotPlaced(state);
    const complete = !!findCatPotMatchingOrder(state);
    const timeLeft = getCatPotTimeLeft(state);
    const patienceLeft = getCatPotPatienceLeft(order);
    const queueCount = Math.max(0, (state.target || CATPOT_TARGET_CUSTOMERS) - (state.served || 0));
    const placed = state.placed.map((id, index) => {
        const item = getCatPotIngredient(id);
        return `
            <button type="button" class="catpot-placed catpot-placed-${index}" onclick="catPotRemoveIngredient(${index})" title="拿回 ${musicEscapeAttr(item.name)}">
                ${renderCatPotFoodIcon(item, 'in-pot')}
            </button>
        `;
    }).join('');
    el.innerHTML = `
        <section class="catpot-game" data-catpot-order="${musicEscapeAttr(String(order.bornAt || ''))}" data-catpot-finished="${state.finished ? '1' : '0'}">
            <div class="catpot-bg"></div>
            <div class="catpot-order-card">
                <div class="catpot-cat">
                    <img class="catpot-cat-art" src="assets/cat-breakfast-pot/ui/cat-customer.png" alt="猫猫客人">
                    <div>
                        <span>早餐高峰</span>
                        <strong>按订单配餐</strong>
                    </div>
                </div>
                <div class="catpot-stats">
                    <span>时间 <b data-catpot-time>${timeLeft}s</b></span>
                    <span>营业 <b data-catpot-score>${state.served || 0}/${state.target || CATPOT_TARGET_CUSTOMERS}</b></span>
                    <span>待客 <b data-catpot-queue>${queueCount}</b></span>
                </div>
                <div class="catpot-patience"><i data-catpot-patience style="width:${patienceLeft}%"></i></div>
                <div class="catpot-ticket">
                    <div class="catpot-current-guest">
                        <span>当前 ${musicEscapeHtml(order.cat)}</span>
                        <b>${patienceLeft}%</b>
                    </div>
                    <div class="catpot-main-order-grid">
                        ${Object.entries(order.wants).map(([id, need]) => {
                            const item = getCatPotIngredient(id);
                            const done = counts[id] || 0;
                            return `
                                <div class="catpot-order-sticker ${done === need ? 'done' : ''} ${done > need ? 'over' : ''}">
                                    ${renderCatPotFoodIcon(item, 'order')}
                                    <b>${done}/${need}</b>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="catpot-queue-strip">
                        ${(state.orders || []).slice(1).map(guest => `
                            <span>${musicEscapeHtml(guest.cat)} 候餐</span>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="catpot-pot-wrap ${complete ? 'complete' : ''} ${state.feedbackType === 'wrong' ? 'shake' : ''} ${state.rush >= 3 ? 'rush' : ''}">
                <div class="catpot-pot">
                    <img class="catpot-pot-art" src="assets/cat-breakfast-pot/ui/pot-empty.png" alt="空猫耳早餐锅">
                    ${placed || '<div class="catpot-empty">把食材放进猫耳早餐锅</div>'}
                    <img class="catpot-sparkles" src="assets/cat-breakfast-pot/ui/sparkles.png" alt="">
                </div>
                <div class="catpot-feedback ${state.feedbackType}">${musicEscapeHtml(state.feedback)}</div>
            </div>
            <div class="catpot-basket">
                <img class="catpot-basket-art" src="assets/cat-breakfast-pot/ui/basket.png" alt="">
                ${CATPOT_INGREDIENTS.map(item => {
                    const disabled = state.placed.length >= 7;
                    return `
                        <button type="button" class="catpot-food-btn ${disabled ? 'muted' : ''}" onclick="catPotAddIngredient('${musicEscapeAttr(item.id)}')">
                            ${renderCatPotFoodIcon(item)}
                            <span>${musicEscapeHtml(item.name)}</span>
                        </button>
                    `;
                }).join('')}
            </div>
            <div class="catpot-actions">
                <button type="button" onclick="catPotClearPlate()"><i class="ri-delete-bin-line"></i> 清盘</button>
                <button type="button" class="catpot-serve ${complete ? 'ready' : ''}" onclick="catPotServe()"><i class="ri-paw-print-fill"></i> ${state.finished ? '再开一局' : '上菜'}</button>
            </div>
        </section>
    `;
    if (!window._catPotRushTimer) {
        window._catPotRushTimer = setInterval(() => {
            if (!getActiveGame || getActiveGame() !== 'catpot') return;
            const current = getCatPotState();
            const timeNode = document.querySelector('[data-catpot-time]');
            const scoreNode = document.querySelector('[data-catpot-score]');
            const queueNode = document.querySelector('[data-catpot-queue]');
            const patienceNode = document.querySelector('[data-catpot-patience]');
            if (timeNode) timeNode.textContent = `${getCatPotTimeLeft(current)}s`;
            if (scoreNode) scoreNode.textContent = `${current.served || 0}/${current.target || CATPOT_TARGET_CUSTOMERS}`;
            if (queueNode) queueNode.textContent = String(Math.max(0, (current.target || CATPOT_TARGET_CUSTOMERS) - (current.served || 0)));
            if (patienceNode) patienceNode.style.width = `${getCatPotPatienceLeft(getCatPotOrder(current))}%`;
            const root = document.querySelector('.catpot-game');
            const renderedOrder = root ? root.getAttribute('data-catpot-order') : '';
            const currentOrder = String(getCatPotOrder(current).bornAt || '');
            const renderedFinished = root ? root.getAttribute('data-catpot-finished') === '1' : false;
            if (current.finished !== renderedFinished || (currentOrder && renderedOrder && currentOrder !== renderedOrder)) renderGameApp();
        }, 1000);
    }
}

