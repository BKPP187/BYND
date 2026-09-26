function getSyncGameCharId() {
    const chars = getWolfchaCharacters();
    const saved = localStorage.getItem(SYNC_GAME_CHAR_KEY);
    return chars.some(char => char.id === saved) ? saved : '';
}

function getSyncGameChar() {
    const selectedId = getSyncGameCharId();
    return getWolfchaCharacters().find(char => char.id === selectedId) || null;
}

function selectSyncGameChar(id) {
    if (!getWolfchaCharacters().some(char => char.id === id)) return;
    localStorage.setItem(SYNC_GAME_CHAR_KEY, id);
    clearSyncGameState();
    renderGameApp();
}
window.selectSyncGameChar = selectSyncGameChar;

function getSyncGameState() {
    try {
        const state = JSON.parse(localStorage.getItem(SYNC_GAME_STATE_KEY) || '{}') || {};
        return state.phase ? state : null;
    } catch (e) {
        return null;
    }
}

function saveSyncGameState(state) {
    localStorage.setItem(SYNC_GAME_STATE_KEY, JSON.stringify(state || {}));
}

function clearSyncGameState() {
    localStorage.removeItem(SYNC_GAME_STATE_KEY);
}

function getSyncFallbackQuestions() {
    return [
        { question: '如果今晚只能留下一样东西陪你们，你们会选热饮、音乐还是一盏灯？', judgeTip: '看核心选择是否一致，也允许同义表达。' },
        { question: '如果要一起临时出门，你们会先确认路线、天气还是对方的心情？', judgeTip: '判断优先级是否一致。' },
        { question: '收到一张空白明信片时，你们会先写地点、日期还是一句想说的话？', judgeTip: '比较第一反应。' },
        { question: '如果把今天存成一张照片，你们觉得画面里最重要的会是什么？', judgeTip: '比较画面重点和情绪重点。' }
    ];
}

function pickSyncFallbackQuestion() {
    const list = getSyncFallbackQuestions();
    return list[Math.floor(Math.random() * list.length)] || list[0];
}

function extractSyncJsonPayload(text) {
    if (typeof extractActingJsonPayload === 'function') return extractActingJsonPayload(text);
    const raw = String(text || '').trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const candidates = [raw, start >= 0 && end > start ? raw.slice(start, end + 1) : ''].filter(Boolean);
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch (_) {}
    }
    return null;
}

function cleanSyncGameText(value, maxLength = 180) {
    const text = compactActingText(value, maxLength);
    return text || '';
}

function getSyncGameContext(char) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const charName = getMusicCharName(char);
    const userName = profile.name || '用户';
    const persona = cleanSyncGameText([
        char?.description,
        char?.personality,
        char?.scenario,
        char?.system_prompt || char?.systemPrompt
    ].filter(Boolean).join('\n'), 900);
    const world = typeof getActingWorldBookText === 'function' ? cleanSyncGameText(getActingWorldBookText(char), 700) : '';
    const recent = typeof getActingRecentChatText === 'function' ? cleanSyncGameText(getActingRecentChatText(char), 700) : '';
    return { profile, charName, userName, persona, world, recent };
}

function buildSyncJudgeQuestionMessages(char) {
    const ctx = getSyncGameContext(char);
    return [
        {
            role: 'system',
            content: '你是 BYND 小游戏「默契问答」的系统裁判，只负责出题。只返回 JSON，不要 Markdown，不要解释。格式：{"question":"一个双方都能独立作答的问题","judgeTip":"判定一致性的标准"}。问题必须轻松、具体、可由用户和角色分别作答；不要让角色猜用户；不要要求现实隐私；不要出现血腥、露骨或高风险内容。'
        },
        {
            role: 'user',
            content: `用户名：${ctx.userName}\n角色名：${ctx.charName}\n【角色人设】${ctx.persona || '无'}\n${ctx.world ? `【世界书】${ctx.world}\n` : ''}${ctx.recent ? `【最近聊天】${ctx.recent}\n` : ''}请裁判出一道适合他们同时作答的默契题。`
        }
    ];
}

function buildSyncCharAnswerMessages(char, question) {
    const base = typeof buildMessages === 'function'
        ? buildMessages(char, Array.isArray(char.history) ? char.history.slice(-8) : [])
        : [{ role: 'system', content: `你是${getMusicCharName(char)}。` }];
    base.push({
        role: 'user',
        content: `我们正在玩「默契问答」。系统裁判的问题是：「${question}」\n请你以${getMusicCharName(char)}本人身份独立作答，不要猜用户会怎么答，也不要询问用户。只返回 JSON：{"answer":"你的答案，30字以内","reason":"一句很短的理由，可留空"}。`
    });
    return base;
}

function buildSyncJudgeResultMessages(state) {
    return [
        {
            role: 'system',
            content: '你是 BYND 小游戏「默契问答」的系统裁判，只负责比较两份答案是否默契一致。只返回 JSON，不要 Markdown，不要解释。格式：{"matched":true或false,"score":0到100,"verdict":"一句裁判播报","reason":"为什么一致或不一致"}。语义一致即可判 true，不要求逐字相同；明显不同、优先级不同或对象不同判 false。'
        },
        {
            role: 'user',
            content: `题目：${state.question}\n判定标准：${state.judgeTip || '语义和优先级是否一致'}\n用户答案：${state.userAnswer}\n角色答案：${state.charAnswer}\n请裁判判定。`
        }
    ];
}

function normalizeSyncQuestionPayload(payload) {
    const fallback = pickSyncFallbackQuestion();
    return {
        question: cleanSyncGameText(payload?.question || payload?.title || payload?.text || fallback.question, 120) || fallback.question,
        judgeTip: cleanSyncGameText(payload?.judgeTip || payload?.standard || payload?.rule || fallback.judgeTip, 120) || fallback.judgeTip
    };
}

function normalizeSyncCharAnswerPayload(payload, char) {
    const fallback = `${getMusicCharName(char)}会先按自己的直觉选一个最在意的答案。`;
    return {
        answer: cleanSyncGameText(payload?.answer || payload?.text || payload?.content || fallback, 60) || fallback,
        reason: cleanSyncGameText(payload?.reason || payload?.why || '', 90)
    };
}

function normalizeSyncJudgePayload(payload, state) {
    const normalize = value => String(value || '').replace(/\s+/g, '').toLowerCase();
    const user = normalize(state.userAnswer);
    const char = normalize(state.charAnswer);
    const fallbackMatched = !!user && !!char && (user === char || user.includes(char) || char.includes(user));
    const matched = typeof payload?.matched === 'boolean'
        ? payload.matched
        : /^(true|yes|一致|相同|默契|match)$/i.test(String(payload?.matched || payload?.result || '').trim()) || fallbackMatched;
    const score = Number.isFinite(Number(payload?.score)) ? Math.max(0, Math.min(100, Number(payload.score))) : (matched ? 88 : 42);
    return {
        matched,
        score,
        verdict: cleanSyncGameText(payload?.verdict || payload?.title || (matched ? '裁判判定：默契命中' : '裁判判定：这题没对上'), 60),
        reason: cleanSyncGameText(payload?.reason || payload?.comment || (matched ? '两边答案的重点基本一致。' : '两边答案的重点不在同一处。'), 140)
    };
}

function renderSyncGameRound(char, state) {
    const charName = char ? getMusicCharName(char) : '角色';
    if (!state || state.phase === 'idle') {
        return `
            <div class="mini-game-card sync-game-round">
                <span>默契问答</span>
                <strong>裁判出题，你和 ${musicEscapeHtml(charName)} 分别作答</strong>
                <p>系统裁判会先抽一题；${musicEscapeHtml(charName)} 会暗中作答，你也写下自己的答案，最后由裁判判断是否一致。</p>
                <button type="button" onclick="startSyncMiniGame()" ${char ? '' : 'disabled'}><i class="ri-sparkling-2-line"></i> 裁判出题</button>
            </div>
        `;
    }
    if (state.phase === 'asking') {
        return `
            <div class="mini-game-card sync-game-round">
                <span>系统裁判</span>
                <strong>正在出题</strong>
                <p>裁判会出一道双方都能独立回答的问题，不会让 ${musicEscapeHtml(charName)} 猜你。</p>
                <div class="sync-game-loading"><i class="ri-loader-4-line"></i><em>Preparing question</em></div>
            </div>
        `;
    }
    if (state.phase === 'answering' || state.phase === 'judging') {
        const busy = state.phase === 'judging';
        return `
            <div class="mini-game-card sync-game-round">
                <span>系统裁判出题</span>
                <strong>${musicEscapeHtml(state.question || '这一题还没准备好')}</strong>
                <p>${musicEscapeHtml(state.judgeTip || '两边独立作答后，裁判比较答案重点是否一致。')}</p>
                <div class="sync-answer-status">
                    <span><i class="ri-user-smile-line"></i>${musicEscapeHtml(charName)} 已暗中作答</span>
                    <span><i class="ri-user-heart-line"></i>等待你的答案</span>
                </div>
                <label class="sync-answer-box">
                    <span>你的答案</span>
                    <textarea id="sync-user-answer" maxlength="80" rows="3" placeholder="写下你的第一反应" ${busy ? 'disabled' : ''}>${musicEscapeHtml(state.userAnswer || '')}</textarea>
                </label>
                <div class="sync-game-actions">
                    <button type="button" onclick="submitSyncGameAnswer()" ${busy ? 'disabled' : ''}><i class="${busy ? 'ri-loader-4-line' : 'ri-scales-3-line'}"></i> ${busy ? '裁判判定中' : '提交给裁判'}</button>
                    <button type="button" class="ghost" onclick="resetSyncMiniGame()" ${busy ? 'disabled' : ''}>换一题</button>
                </div>
            </div>
        `;
    }
    if (state.phase === 'result') {
        const result = state.result || {};
        return `
            <div class="mini-game-card sync-game-round">
                <span>${result.matched ? '默契命中' : '差一点点'}</span>
                <strong>${musicEscapeHtml(result.verdict || '裁判结果')}</strong>
                <p>${musicEscapeHtml(state.question || '')}</p>
                <div class="sync-result-score ${result.matched ? 'matched' : 'missed'}">
                    <b>${Math.round(Number(result.score) || 0)}</b><span>默契度</span>
                </div>
                <div class="sync-answer-compare">
                    <article><span>你的答案</span><p>${musicEscapeHtml(state.userAnswer || '空')}</p></article>
                    <article><span>${musicEscapeHtml(charName)} 的答案</span><p>${musicEscapeHtml(state.charAnswer || '空')}</p>${state.charReason ? `<em>${musicEscapeHtml(state.charReason)}</em>` : ''}</article>
                </div>
                <p class="sync-judge-reason">${musicEscapeHtml(result.reason || '')}</p>
                <div class="sync-game-actions">
                    <button type="button" onclick="startSyncMiniGame()"><i class="ri-sparkling-2-line"></i> 再来一题</button>
                    <button type="button" class="ghost" onclick="resetSyncMiniGame()">重新准备</button>
                </div>
            </div>
        `;
    }
    if (state.phase === 'error') {
        return `
            <div class="mini-game-card sync-game-round">
                <span>默契问答</span>
                <strong>这一题暂时失败</strong>
                <p>${musicEscapeHtml(state.error || '没有生成成功。')}</p>
                <button type="button" onclick="startSyncMiniGame()" ${char ? '' : 'disabled'}><i class="ri-refresh-line"></i> 重试</button>
            </div>
        `;
    }
    return '';
}

function renderSyncGame(el) {
    const chars = getWolfchaCharacters();
    const selectedId = getSyncGameCharId();
    const char = getSyncGameChar();
    const savedState = getSyncGameState();
    const state = char && savedState?.selectedCharId === char.id ? savedState : null;
    el.innerHTML = `
        <section class="mini-game-panel">
            <div class="sync-player-card">
                <span>选择陪玩的角色</span>
                <div class="sync-player-list">
                    ${chars.length ? chars.map(item => `
                        <button type="button" class="${item.id === selectedId ? 'active' : ''}" onclick="selectSyncGameChar('${musicEscapeAttr(item.id)}')">
                            <div>${item.avatar ? `<img src="${musicEscapeAttr(item.avatar)}" alt="${musicEscapeAttr(getMusicCharName(item))}">` : '<i class="ri-user-smile-line"></i>'}</div>
                            <strong>${musicEscapeHtml(getMusicCharName(item))}</strong>
                        </button>
                    `).join('') : '<p>先在微信导入角色，再一起玩默契问答。</p>'}
                </div>
            </div>
            ${renderSyncGameRound(char, state)}
        </section>
    `;
}

async function startSyncMiniGame() {
    const char = getSyncGameChar();
    if (!char) {
        if (typeof showWechatToast === 'function') showWechatToast('先选择一个陪你玩的角色');
        return;
    }
    saveSyncGameState({ phase: 'asking', selectedCharId: char.id, startedAt: Date.now() });
    renderGameApp();
    try {
        let questionData = pickSyncFallbackQuestion();
        if (typeof callChatApi === 'function') {
            const questionResult = await callChatApi(buildSyncJudgeQuestionMessages(char), { max_tokens: 520, temperature: 0.72, usageFeature: 'game', usageChar: char });
            if (questionResult && questionResult.ok) questionData = normalizeSyncQuestionPayload(extractSyncJsonPayload(questionResult.content));
        }
        let charData = normalizeSyncCharAnswerPayload(null, char);
        if (typeof callChatApi === 'function') {
            const charResult = await callChatApi(buildSyncCharAnswerMessages(char, questionData.question), { max_tokens: 420, temperature: 0.68, usageFeature: 'game', usageChar: char });
            if (charResult && charResult.ok) charData = normalizeSyncCharAnswerPayload(extractSyncJsonPayload(charResult.content) || { answer: charResult.content }, char);
        }
        saveSyncGameState({
            phase: 'answering',
            selectedCharId: char.id,
            question: questionData.question,
            judgeTip: questionData.judgeTip,
            charAnswer: charData.answer,
            charReason: charData.reason,
            userAnswer: '',
            startedAt: Date.now()
        });
    } catch (e) {
        saveSyncGameState({ phase: 'error', selectedCharId: char.id, error: `这一题暂时没连上裁判：${e.message || e}` });
    }
    renderGameApp();
}
window.startSyncMiniGame = startSyncMiniGame;

async function submitSyncGameAnswer() {
    const char = getSyncGameChar();
    const state = getSyncGameState();
    const input = document.getElementById('sync-user-answer');
    const answer = cleanSyncGameText(input && input.value, 90);
    if (!char || !state || state.phase !== 'answering') return;
    if (!answer) {
        if (typeof showWechatToast === 'function') showWechatToast('先写下你的答案');
        return;
    }
    const judgingState = { ...state, userAnswer: answer, phase: 'judging' };
    saveSyncGameState(judgingState);
    renderGameApp();
    try {
        let resultData = normalizeSyncJudgePayload(null, judgingState);
        if (typeof callChatApi === 'function') {
            const result = await callChatApi(buildSyncJudgeResultMessages(judgingState), { max_tokens: 520, temperature: 0.35, usageFeature: 'game', usageChar: char });
            if (result && result.ok) resultData = normalizeSyncJudgePayload(extractSyncJsonPayload(result.content), judgingState);
        }
        saveSyncGameState({ ...judgingState, phase: 'result', result: resultData });
    } catch (e) {
        const resultData = normalizeSyncJudgePayload(null, judgingState);
        resultData.reason = `裁判 API 暂时不可用，先按文本相似度判定：${resultData.reason}`;
        saveSyncGameState({ ...judgingState, phase: 'result', result: resultData });
    }
    renderGameApp();
}
window.submitSyncGameAnswer = submitSyncGameAnswer;

function resetSyncMiniGame() {
    clearSyncGameState();
    renderGameApp();
}
window.resetSyncMiniGame = resetSyncMiniGame;

function getTodayDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function shouldShowCardMatchRules() {
    return localStorage.getItem(CARDMATCH_RULES_SKIP_KEY) !== getTodayDateKey();
}

function closeCardMatchRules(skipToday = false) {
    if (skipToday) localStorage.setItem(CARDMATCH_RULES_SKIP_KEY, getTodayDateKey());
    document.getElementById('cardmatch-rules-overlay')?.classList.add('hidden');
}
window.closeCardMatchRules = closeCardMatchRules;

function renderCardMatchGame(el) {
    const cards = getStudyCards();
    const card = cards.length ? cards[Math.floor(Math.random() * cards.length)] : null;
    const languages = getStudyLanguages().filter(lang => card?.lines?.[lang.id]);
    const showRules = shouldShowCardMatchRules();
    el.innerHTML = `
        <section class="mini-game-panel">
            <div class="mini-game-card">
                <span>语言翻牌</span>
                <strong>${card ? '回忆这张学习卡' : '还没有学习卡'}</strong>
                <div class="mini-card-lines">
                    ${card ? languages.map((lang, index) => `
                        <p class="${index === 0 ? 'show' : ''}"><b>${musicEscapeHtml(lang.short)}</b>${index === 0 ? musicEscapeHtml(card.lines[lang.id]) : '点击刷新后自己回忆这一行'}</p>
                    `).join('') : '<p class="show"><b>+</b>先去学习页保存一张多语言卡。</p>'}
                </div>
                <button type="button" onclick="renderGameApp()"><i class="ri-refresh-line"></i> 换一张</button>
            </div>
            <div id="cardmatch-rules-overlay" class="cardmatch-rules-overlay ${showRules ? '' : 'hidden'}">
                <div class="cardmatch-rules-card">
                    <span>语言翻牌规则</span>
                    <strong>先看第一行，再自己回忆其他语言</strong>
                    <p>每次随机抽一张学习卡。第一行会显示出来，其他行先遮住，你先在心里回忆，再点换一张继续练习。</p>
                    <div>
                        <button type="button" onclick="closeCardMatchRules(false)">开始游戏</button>
                        <button type="button" class="primary" onclick="closeCardMatchRules(true)">今日不再提示</button>
                    </div>
                </div>
            </div>
        </section>
    `;
}

function createCatPotOrder(level = 1) {
    const shuffled = [...CATPOT_INGREDIENTS].sort(() => Math.random() - 0.5);
    const kindCount = Math.min(4, 2 + Math.floor(Math.max(1, level) / 4));
    const maxTotal = Math.min(6, 3 + Math.floor(Math.max(1, level) / 5));
    const wants = {};
    let total = 0;
    shuffled.slice(0, kindCount).forEach((item, index) => {
        const canDouble = level > 1 && total < maxTotal - 1 && (index === 0 || Math.random() > 0.62);
        const count = canDouble ? 2 : 1;
        wants[item.id] = count;
        total += count;
    });
    const guest = CATPOT_CATS[Math.floor(Math.random() * CATPOT_CATS.length)] || CATPOT_CATS[0];
    return { ...guest, wants, bornAt: Date.now(), patienceMs: Math.max(12000, CATPOT_CUSTOMER_PATIENCE_MS - Math.min(7000, level * 420)) };
}

function isValidCatPotOrder(order) {
    return order && order.wants && Object.keys(order.wants).some(id => CATPOT_INGREDIENTS.some(item => item.id === id));
}

function createCatPotOrders(level = 1, count = CATPOT_CUSTOMER_COUNT) {
    return Array.from({ length: count }, (_, index) => createCatPotOrder(level + index));
}

function createCatPotState(level = 1, score = 0, streak = 0, order = null) {
    const now = Date.now();
    return {
        level: Math.max(1, Number(level) || 1),
        order: isValidCatPotOrder(order) ? order : createCatPotOrder(level),
        orders: isValidCatPotOrder(order) ? [order, ...createCatPotOrders(level + 1, CATPOT_CUSTOMER_COUNT - 1)] : createCatPotOrders(level),
        placed: [],
        score,
        streak,
        missed: 0,
        wrongs: 0,
        served: score,
        target: CATPOT_TARGET_CUSTOMERS,
        roundStartedAt: now,
        roundEndsAt: now + CATPOT_ROUND_MS,
        rush: 1,
        finished: false,
        feedback: '早餐高峰开始啦，连续给猫猫们出餐。',
        feedbackType: 'ready',
        justCompleted: false
    };
}

function normalizeCatPotState(state) {
    const now = Date.now();
    const level = Math.max(1, Number(state.level) || Number(state.orderIndex) + 1 || 1);
    const normalized = {
        ...createCatPotState(level, Number(state.score) || 0, Number(state.streak) || 0, state.order),
        ...state,
        level,
        score: Number(state.score) || 0,
        streak: Number(state.streak) || 0,
        missed: Number(state.missed) || 0,
        wrongs: Number(state.wrongs) || 0,
        served: Number(state.served) || Number(state.score) || 0,
        target: Number(state.target) || CATPOT_TARGET_CUSTOMERS,
        rush: Number(state.rush) || 1,
        roundStartedAt: Number(state.roundStartedAt) || now,
        roundEndsAt: Number(state.roundEndsAt) || (now + CATPOT_ROUND_MS),
        orders: Array.isArray(state.orders) && state.orders.some(isValidCatPotOrder) ? state.orders.filter(isValidCatPotOrder).slice(0, CATPOT_CUSTOMER_COUNT) : (isValidCatPotOrder(state.order) ? [state.order] : createCatPotOrders(level)),
        placed: Array.isArray(state.placed) ? state.placed.filter(id => CATPOT_INGREDIENTS.some(item => item.id === id)).slice(0, 9) : []
    };
    while (normalized.orders.length < CATPOT_CUSTOMER_COUNT) normalized.orders.push(createCatPotOrder(normalized.level + normalized.orders.length));
    normalized.order = normalized.orders[0];
    if (!Number(normalized.order.bornAt)) normalized.order.bornAt = now;
    if (!Number(normalized.order.patienceMs)) normalized.order.patienceMs = Math.max(12000, CATPOT_CUSTOMER_PATIENCE_MS - Math.min(7000, level * 420));
    if (now >= normalized.roundEndsAt) {
        normalized.finished = true;
        normalized.placed = [];
        normalized.feedback = `营业结束：服务 ${normalized.served || 0} 位猫猫，错菜 ${normalized.wrongs || 0} 次，走失 ${normalized.missed || 0} 位。`;
        normalized.feedbackType = (normalized.served || 0) >= 8 ? 'served' : 'ready';
    } else if (!normalized.finished) {
        const activeOrder = normalized.orders[0];
        const activePatience = activeOrder.patienceMs || CATPOT_CUSTOMER_PATIENCE_MS;
        const activeExpired = now - (activeOrder.bornAt || now) > activePatience;
        if (activeExpired) {
            normalized.orders.shift();
            normalized.missed += 1;
            normalized.streak = 0;
            normalized.level += 1;
            while (normalized.orders.length < CATPOT_CUSTOMER_COUNT) normalized.orders.push(createCatPotOrder(normalized.level + normalized.orders.length));
            if (normalized.orders[0]) normalized.orders[0].bornAt = now;
            normalized.order = normalized.orders[0];
            normalized.feedback = '有猫猫等太久走掉了，别让下一位空等。';
            normalized.feedbackType = 'wrong';
        }
        normalized.order = normalized.orders[0];
    }
    return normalized;
}

