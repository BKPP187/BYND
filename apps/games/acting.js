function getActingGameState() {
    try {
        const state = JSON.parse(localStorage.getItem(ACTING_GAME_STATE_KEY) || '{}') || {};
        return state.phase ? state : null;
    } catch (_) {
        return null;
    }
}

function saveActingGameState(state) {
    localStorage.setItem(ACTING_GAME_STATE_KEY, JSON.stringify(state || {}));
}

function resetActingGame() {
    localStorage.removeItem(ACTING_GAME_STATE_KEY);
    renderGameApp();
}
window.resetActingGame = resetActingGame;

function setActingPhase(phase, extra = {}) {
    const state = { ...(getActingGameState() || {}), ...extra, phase };
    saveActingGameState(state);
    renderGameApp();
}

function startActingGameSelection() {
    setActingPhase('select', { error: '' });
}
window.startActingGameSelection = startActingGameSelection;

function getActingSelectedChar() {
    const state = getActingGameState();
    const chars = getWolfchaCharacters();
    return chars.find(char => char.id === state?.selectedCharId) || null;
}

function selectActingGameChar(id) {
    if (!getWolfchaCharacters().some(char => char.id === id)) return;
    const state = getActingGameState() || { phase: 'select' };
    state.selectedCharId = id;
    state.error = '';
    saveActingGameState(state);
    renderGameApp();
}
window.selectActingGameChar = selectActingGameChar;

function extractActingJsonPayload(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const unfenced = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    const candidates = [unfenced];
    const objectStart = unfenced.indexOf('{');
    const objectEnd = unfenced.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) candidates.push(unfenced.slice(objectStart, objectEnd + 1));
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch (_) {}
    }
    return null;
}

function compactActingText(value, maxLength = 700) {
    const cleaner = typeof window.cleanChatApiVisibleContent === 'function'
        ? window.cleanChatApiVisibleContent
        : value => String(value == null ? '' : value);
    const text = cleaner(value)
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function getActingWorldBookText(char) {
    const entries = Array.isArray(char?.worldBook) ? char.worldBook : [];
    return entries.slice(0, 16).map(entry => {
        const key = entry.key || entry.keys || entry.keyword || entry.name || '';
        const content = compactActingText(entry.content || entry.entry || entry.value || '', 360);
        return content ? `${key ? `【${key}】` : ''}${content}` : '';
    }).filter(Boolean).join('\n');
}

function getActingRecentChatText(char) {
    const history = Array.isArray(char?.history) ? char.history : [];
    const charName = getMusicCharName(char);
    return history.slice(-12).map(msg => {
        const who = msg.isMe ? '用户' : charName;
        const text = compactActingText(msg.description || msg.content || msg.dialogue || '', 220);
        return text ? `${who}：${text}` : '';
    }).filter(Boolean).join('\n');
}

function buildActingGameMessages(char) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const charName = getMusicCharName(char);
    const description = compactActingText(char?.description || '', 3400);
    const worldBook = getActingWorldBookText(char);
    const recent = getActingRecentChatText(char) || '暂无最近聊天。';
    return [
        {
            role: 'system',
            content: [
                '你是 BYND 游戏「谁是演技派」的剧本导演，只输出 JSON 对象，不要 Markdown，不要解释。',
                '你要为用户和一个已导入角色生成沉浸式即兴剧本。剧情要华丽、梦幻、复古、带悬疑或奇幻感，但不要廉价狗血。',
                '禁止生成“霸道总裁爱上我”、强迫、羞辱、极端控制、未成年人或露骨性内容。可以参考但不要照搬这些方向：捡手机文学、快穿三千小世界、变成男主的小猫、错拿档案袋、旧剧院失忆夜、雨夜电台来信。',
                '字段必须是：title、genre、premise、openingNarration、userRole、charRole、scenes。',
                'userRole 字段：name、identity、cover、secret、goal、props(数组)。',
                'charRole 字段：name、identity、relationship、conflict。',
                'scenes 是 4-6 个数组项，每项必须有 title、narration、charLine、userCue、stageHint。',
                'charLine 必须按角色卡和最近聊天口吻写，像真实角色在剧本里表演；narration 由旁白推动剧情；userCue 是给用户下一句台词的方向。'
            ].join('\n')
        },
        {
            role: 'user',
            content: [
                `用户：${profile.name || '我'}`,
                profile.bio ? `用户资料：${compactActingText(profile.bio, 500)}` : '',
                `角色原名：${char?.name || charName}`,
                `用户给角色的备注名：${charName}`,
                description ? `角色卡：${description}` : '',
                worldBook ? `世界书：\n${worldBook}` : '',
                `最近聊天：\n${recent}`,
                '请生成一个完整剧本 JSON。'
            ].filter(Boolean).join('\n\n')
        }
    ];
}

function normalizeActingScript(raw, char) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const normalizeObject = value => (value && typeof value === 'object') ? value : {};
    const text = (value, fallback = '', max = 500) => compactActingText(value || fallback, max);
    const userRole = normalizeObject(data.userRole || data.user || data['用户角色']);
    const charRole = normalizeObject(data.charRole || data.characterRole || data['角色档案']);
    const scenesRaw = Array.isArray(data.scenes || data['场景']) ? (data.scenes || data['场景']) : [];
    const scenes = scenesRaw.map((scene, index) => {
        const safe = normalizeObject(scene);
        return {
            title: text(safe.title || safe.name, `第 ${index + 1} 场`, 34),
            narration: text(safe.narration || safe.aside || safe['旁白'], '', 620),
            charLine: text(safe.charLine || safe.line || safe['角色台词'], '', 420),
            userCue: text(safe.userCue || safe.prompt || safe['用户提示'], '用你的方式接住这一幕。', 180),
            stageHint: text(safe.stageHint || safe.hint || safe['舞台提示'], '', 180)
        };
    }).filter(scene => scene.narration || scene.charLine);

    return {
        title: text(data.title || data.name, '未命名剧本', 28),
        genre: text(data.genre || data.type, '梦幻即兴剧', 32),
        premise: text(data.premise || data.summary || data['设定'], '一份被误投的档案，把两个人卷进了同一场临时演出。', 360),
        openingNarration: text(data.openingNarration || data.opening || data['开场旁白'], '旧剧院的灯一盏盏亮起，档案袋在桌面上自动摊开。', 380),
        userRole: {
            name: text(userRole.name, '临时演员', 24),
            identity: text(userRole.identity, '被卷入剧本的证人', 80),
            cover: text(userRole.cover, '表面只是路过的人', 100),
            secret: text(userRole.secret, '你手里有剧情缺失的一页。', 140),
            goal: text(userRole.goal, '在不露馅的情况下走完第一幕。', 140),
            props: Array.isArray(userRole.props) ? userRole.props.map(item => text(item, '', 32)).filter(Boolean).slice(0, 5) : []
        },
        charRole: {
            name: text(charRole.name, getMusicCharName(char), 24),
            identity: text(charRole.identity, '剧本里的关键人物', 90),
            relationship: text(charRole.relationship, '和用户互相试探', 120),
            conflict: text(charRole.conflict, '他不确定该相信台词，还是相信你。', 140)
        },
        scenes: scenes.length ? scenes.slice(0, 6) : []
    };
}

async function generateActingScript() {
    const char = getActingSelectedChar();
    if (!char) {
        if (typeof showWechatToast === 'function') showWechatToast('先选择一个角色');
        return;
    }
    if (typeof callChatApi !== 'function') {
        setActingPhase('select', { error: '聊天 API 模块没有加载，无法生成剧本。' });
        return;
    }
    const pending = { ...(getActingGameState() || {}), phase: 'generating', error: '', selectedCharId: char.id };
    saveActingGameState(pending);
    renderGameApp();
    try {
        const result = await callChatApi(buildActingGameMessages(char), { usageFeature: 'game', usageChar: char });
        if (!result || !result.ok) throw new Error((result && result.error) || '剧本生成失败');
        const payload = extractActingJsonPayload(result.content);
        if (!payload) throw new Error('AI 没有返回可解析的剧本 JSON');
        const script = normalizeActingScript(payload, char);
        if (!script.scenes.length) throw new Error('剧本里没有可用场景');
        saveActingGameState({
            phase: 'roleFile',
            selectedCharId: char.id,
            script,
            sceneIndex: 0,
            userLines: [],
            error: ''
        });
    } catch (e) {
        saveActingGameState({
            phase: 'select',
            selectedCharId: char.id,
            error: `生成失败：${e.message || e}`
        });
    }
    renderGameApp();
}
window.generateActingScript = generateActingScript;

function enterActingStage() {
    const state = getActingGameState();
    if (!state?.script) return;
    state.phase = 'stage';
    state.sceneIndex = Number.isFinite(state.sceneIndex) ? state.sceneIndex : 0;
    saveActingGameState(state);
    renderGameApp();
}
window.enterActingStage = enterActingStage;

function advanceActingScene() {
    const state = getActingGameState();
    if (!state?.script) return;
    const count = state.script.scenes.length;
    state.sceneIndex = Math.min(count, (Number(state.sceneIndex) || 0) + 1);
    state.phase = state.sceneIndex >= count ? 'ending' : 'stage';
    saveActingGameState(state);
    renderGameApp();
}
window.advanceActingScene = advanceActingScene;

function submitActingUserLine() {
    const input = document.getElementById('acting-user-line');
    const text = String(input?.value || '').trim();
    if (!text) {
        input?.focus();
        return;
    }
    const state = getActingGameState();
    if (!state?.script) return;
    state.userLines = Array.isArray(state.userLines) ? state.userLines : [];
    state.userLines.push({
        sceneIndex: Number(state.sceneIndex) || 0,
        text,
        at: Date.now()
    });
    saveActingGameState(state);
    if (input) input.value = '';
    if (typeof showWechatToast === 'function') showWechatToast('台词已写入档案');
    renderGameApp();
}
window.submitActingUserLine = submitActingUserLine;

function renderActingOpening(el) {
    el.innerHTML = `
        <section class="acting-game acting-opening">
            <div class="acting-noise" aria-hidden="true"></div>
            <div class="acting-opening-aura" aria-hidden="true"></div>
            <div class="acting-opening-orbit" aria-hidden="true">
                ${Array.from({ length: 8 }).map((_, idx) => `
                    <span class="acting-orbit-card card-${idx + 1}">
                        <i class="${idx % 3 === 0 ? 'ri-movie-2-line' : idx % 3 === 1 ? 'ri-file-paper-2-line' : 'ri-sparkling-2-fill'}"></i>
                    </span>
                `).join('')}
            </div>
            <div class="acting-opening-mission">
                <span></span><span></span><span></span><strong>1</strong><span></span><span></span>
            </div>
            <div class="acting-opening-stage">
                <span class="acting-kicker">BYND CASTING ROOM</span>
                <strong>谁是演技派</strong>
                <p>抽取一张命运牌，AI 临场写下剧本。角色保留原本人设，只是被推进一场更像电影的戏里。</p>
                <button type="button" onclick="startActingGameSelection()"><i class="ri-sparkling-2-fill"></i> 开启剧场</button>
            </div>
            <div class="acting-floating-files" aria-hidden="true">
                <span>CASE 01</span><span>STAGE</span><span>DOSSIER</span><span>SECRET</span>
            </div>
        </section>
    `;
}

function renderActingSelection(el, state) {
    const chars = getWolfchaCharacters();
    const selectedId = state?.selectedCharId || '';
    el.innerHTML = `
        <section class="acting-game acting-select">
            <div class="acting-select-head">
                <span class="acting-kicker">CAST DOSSIER</span>
                <strong>选择一起演戏的角色</strong>
                <p>像翻阅演员档案一样选人。生成剧本后，角色会保留原人设，只是进入新的剧情壳子里。</p>
            </div>
            ${state?.error ? `<div class="acting-error"><i class="ri-error-warning-line"></i>${musicEscapeHtml(state.error)}</div>` : ''}
            <div class="acting-dossier-grid">
                ${chars.length ? chars.map(char => {
                    const selected = char.id === selectedId;
                    return `
                        <button type="button" class="acting-dossier ${selected ? 'selected' : ''}" onclick="selectActingGameChar('${musicEscapeAttr(char.id)}')">
                            <div class="acting-dossier-avatar">${char.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(getMusicCharName(char))}">` : '<i class="ri-user-smile-line"></i>'}</div>
                            <div>
                                <span>FILE / ${musicEscapeHtml((char.id || '').slice(-4).toUpperCase() || 'CHAR')}</span>
                                <strong>${musicEscapeHtml(getMusicCharName(char))}</strong>
                                <p>${musicEscapeHtml(compactActingText(char.description || '暂无角色简介', 70))}</p>
                            </div>
                            <i class="${selected ? 'ri-checkbox-circle-fill' : 'ri-add-circle-line'}"></i>
                        </button>
                    `;
                }).join('') : '<div class="acting-empty">先在微信里导入角色卡，再回来选演员。</div>'}
            </div>
            <div class="acting-bottom-actions">
                <button type="button" onclick="resetActingGame()">返回开场</button>
                <button type="button" class="primary" onclick="generateActingScript()" ${selectedId ? '' : 'disabled'}><i class="ri-sparkling-2-fill"></i> 生成剧本</button>
            </div>
        </section>
    `;
}

function renderActingGenerating(el, state) {
    const char = getActingSelectedChar();
    el.innerHTML = `
        <section class="acting-game acting-generating">
            <div class="acting-loader">
                <div>${char?.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(getMusicCharName(char))}">` : '<i class="ri-movie-2-line"></i>'}</div>
                <span>剧院灯光正在亮起</span>
                <strong>AI 正在写剧本</strong>
                <p>读取角色卡、世界书、最近聊天和用户档案，生成非俗套剧情与报纸式人物档案。</p>
            </div>
        </section>
    `;
}

function renderActingRoleFile(el, state) {
    const script = state.script;
    const char = getActingSelectedChar();
    const props = Array.isArray(script.userRole.props) && script.userRole.props.length ? script.userRole.props : ['旧报纸', '未署名钥匙'];
    el.innerHTML = `
        <section class="acting-game acting-rolefile">
            <div class="acting-script-card">
                <span class="acting-kicker">SCRIPT READY</span>
                <strong>${musicEscapeHtml(script.title)}</strong>
                <p>${musicEscapeHtml(script.premise)}</p>
            </div>
            <article class="acting-newspaper">
                <div class="acting-paper-head">
                    <span>BYND EVENING POST</span>
                    <b>${musicEscapeHtml(script.genre)}</b>
                </div>
                <h3>${musicEscapeHtml(script.userRole.name)}</h3>
                <h4>${musicEscapeHtml(script.userRole.identity)}</h4>
                <p>${musicEscapeHtml(script.openingNarration)}</p>
                <div class="acting-paper-columns">
                    <div><span>公开身份</span><strong>${musicEscapeHtml(script.userRole.cover)}</strong></div>
                    <div><span>隐藏秘密</span><strong>${musicEscapeHtml(script.userRole.secret)}</strong></div>
                    <div><span>本幕目标</span><strong>${musicEscapeHtml(script.userRole.goal)}</strong></div>
                    <div><span>对手戏</span><strong>${musicEscapeHtml(script.charRole.relationship || getMusicCharName(char))}</strong></div>
                </div>
                <div class="acting-props">
                    ${props.map(item => `<em>${musicEscapeHtml(item)}</em>`).join('')}
                </div>
            </article>
            <div class="acting-bottom-actions">
                <button type="button" onclick="startActingGameSelection()">重新选角</button>
                <button type="button" class="primary" onclick="enterActingStage()"><i class="ri-play-fill"></i> 开始第一幕</button>
            </div>
        </section>
    `;
}

function renderActingStage(el, state) {
    const script = state.script;
    const char = getActingSelectedChar();
    const index = Number(state.sceneIndex) || 0;
    const scene = script.scenes[index];
    const userLines = (Array.isArray(state.userLines) ? state.userLines : []).filter(item => item.sceneIndex === index);
    el.innerHTML = `
        <section class="acting-game acting-stage">
            <div class="acting-stage-top">
                <div>
                    <span class="acting-kicker">SCENE ${String(index + 1).padStart(2, '0')} / ${String(script.scenes.length).padStart(2, '0')}</span>
                    <strong>${musicEscapeHtml(scene.title)}</strong>
                </div>
                <button type="button" onclick="resetActingGame()"><i class="ri-restart-line"></i></button>
            </div>
            <div class="acting-stage-board">
                <div class="acting-narrator">
                    <span>旁白</span>
                    <p>${musicEscapeHtml(scene.narration || '灯光落下，新的幕布缓缓拉开。')}</p>
                    ${scene.stageHint ? `<em>${musicEscapeHtml(scene.stageHint)}</em>` : ''}
                </div>
                <div class="acting-char-line">
                    <div>${char?.avatar ? `<img src="${musicEscapeAttr(char.avatar)}" alt="${musicEscapeAttr(getMusicCharName(char))}">` : '<i class="ri-user-voice-line"></i>'}</div>
                    <p><strong>${musicEscapeHtml(script.charRole.name || getMusicCharName(char))}</strong>${musicEscapeHtml(scene.charLine || '……')}</p>
                </div>
                <div class="acting-user-cue">
                    <span>你的表演方向</span>
                    <strong>${musicEscapeHtml(scene.userCue)}</strong>
                    <textarea id="acting-user-line" maxlength="180" placeholder="写一句你要接的台词..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitActingUserLine();}"></textarea>
                    <button type="button" onclick="submitActingUserLine()"><i class="ri-send-plane-fill"></i> 写入档案</button>
                </div>
                ${userLines.length ? `<div class="acting-user-lines">${userLines.map(item => `<p>${musicEscapeHtml(item.text)}</p>`).join('')}</div>` : ''}
            </div>
            <div class="acting-bottom-actions">
                <button type="button" onclick="startActingGameSelection()">换剧本</button>
                <button type="button" class="primary" onclick="advanceActingScene()">${index + 1 >= script.scenes.length ? '收束演出' : '旁白推进'} <i class="ri-arrow-right-s-line"></i></button>
            </div>
        </section>
    `;
}

function renderActingEnding(el, state) {
    const script = state.script || {};
    const lines = Array.isArray(state.userLines) ? state.userLines : [];
    el.innerHTML = `
        <section class="acting-game acting-ending">
            <div class="acting-script-card">
                <span class="acting-kicker">CURTAIN CALL</span>
                <strong>${musicEscapeHtml(script.title || '演出结束')}</strong>
                <p>这场临时剧本已经走完。你的台词被收进档案，可以重新开一局生成新的剧情。</p>
            </div>
            <div class="acting-archive-list">
                ${lines.length ? lines.map((item, index) => `<p><b>${index + 1}</b>${musicEscapeHtml(item.text)}</p>`).join('') : '<p><b>0</b>这次你还没有写入台词。</p>'}
            </div>
            <div class="acting-bottom-actions">
                <button type="button" onclick="openGameHub()">返回大厅</button>
                <button type="button" class="primary" onclick="resetActingGame()">重新开场</button>
            </div>
        </section>
    `;
}

function renderActingGame(el) {
    const state = getActingGameState() || { phase: 'opening' };
    if (state.phase === 'select') return renderActingSelection(el, state);
    if (state.phase === 'generating') return renderActingGenerating(el, state);
    if (state.phase === 'roleFile' && state.script) return renderActingRoleFile(el, state);
    if (state.phase === 'stage' && state.script) return renderActingStage(el, state);
    if (state.phase === 'ending' && state.script) return renderActingEnding(el, state);
    return renderActingOpening(el);
}
window.renderActingGame = renderActingGame;

