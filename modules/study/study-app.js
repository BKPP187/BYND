// BYND 学习 App：由角色本人陪你学语言。角色人设优先，学习是相处的一部分。
(() => {
    const KEYS = {
        cards: 'bynd_study_cards_v1',
        progress: 'bynd_study_progress_v1',
        languages: 'bynd_study_languages_v1',
        checkins: 'bynd_study_checkins_v1',
        settings: 'bynd_study_settings_v1',
        chats: 'bynd_study_chats_v1',
        tab: 'bynd_study_tab_v1'
    };
    const PRESET_LANGUAGES = [
        { id: 'cn', label: '中文', short: '中', code: 'zh-CN', placeholder: '我今天想认真学习。' },
        { id: 'en', label: 'English', short: '英', code: 'en-US', placeholder: 'I want to study properly today.' },
        { id: 'ja', label: '日本語', short: '日', code: 'ja-JP', placeholder: '今日は真面目に勉強したい。' },
        { id: 'ko', label: '한국어', short: '韩', code: 'ko-KR', placeholder: '오늘은 제대로 공부하고 싶어요.' },
        { id: 'fr', label: 'Français', short: '法', code: 'fr-FR', placeholder: "Aujourd'hui je veux bien étudier." },
        { id: 'de', label: 'Deutsch', short: '德', code: 'de-DE', placeholder: 'Heute möchte ich richtig lernen.' },
        { id: 'es', label: 'Español', short: '西', code: 'es-ES', placeholder: 'Hoy quiero estudiar en serio.' },
        { id: 'th', label: 'ไทย', short: '泰', code: 'th-TH', placeholder: 'วันนี้ฉันอยากตั้งใจเรียน' }
    ];
    const DEFAULT_LANGUAGES = PRESET_LANGUAGES.filter(lang => ['cn', 'ja', 'th'].includes(lang.id));
    const LEVELS = [
        { id: 'beginner', label: '入门', hint: '短句、常用词，多给母语提示' },
        { id: 'intermediate', label: '进阶', hint: '自然口语，适度纠错' },
        { id: 'fluent', label: '流利', hint: '不迁就，像和母语者聊天' }
    ];
    const STRICTNESS = [
        { id: 'gentle', label: '温和', hint: '只纠明显错误' },
        { id: 'normal', label: '正常', hint: '错误和不地道都提' },
        { id: 'strict', label: '严格', hint: '连语气和用词习惯也挑' }
    ];
    const TABS = [
        { id: 'chat', label: '对话', icon: 'ri-chat-3-line' },
        { id: 'words', label: '词本', icon: 'ri-book-mark-line' },
        { id: 'review', label: '复习', icon: 'ri-calendar-check-line' },
        { id: 'me', label: '我', icon: 'ri-user-smile-line' }
    ];
    const CHAT_LIMIT = 120;
    const MOODS = [
        { id: 'clear', label: '开心', tone: '#ff9f43' },
        { id: 'calm', label: '平稳', tone: '#34c759' },
        { id: 'tired', label: '疲惫', tone: '#8e8e93' },
        { id: 'focus', label: '燃起', tone: '#5b7cfa' }
    ];

    const state = { tab: 'chat', busy: false, status: '', quiz: null, wordQuery: '', editingCard: null, translationOpen: {} };

    // ---------- helpers ----------
    const escapeHtml = value => (typeof musicEscapeHtml === 'function' ? musicEscapeHtml(value) : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])));
    const escapeAttr = value => (typeof musicEscapeAttr === 'function' ? musicEscapeAttr(value) : escapeHtml(value));
    const clean = (value, limit = 400) => String(value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, limit);
    const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
    const readJson = (key, fallback) => {
        try {
            const raw = localStorage.getItem(key);
            if (raw == null) return fallback;
            const value = JSON.parse(raw);
            return value == null ? fallback : value;
        } catch (_) { return fallback; }
    };
    const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const byId = id => document.getElementById(id);
    // Readings ride inside the text as {漢字|かんじ}; rendering turns them into <ruby>, storage and speech drop them.
    const RUBY = /\{([^{}|\n]{1,40})\|([^{}|\n]{1,80})\}/g;
    const plainText = value => String(value ?? '').replace(RUBY, '$1');
    const rubyHtml = value => escapeHtml(value).replace(/\{([^{}|\n]{1,40})\|([^{}|\n]{1,80})\}/g, '<ruby>$1<rt>$2</rt></ruby>');
    const scriptNeedsReadings = lang => !!lang && ['ja', 'cn'].includes(lang.id);
    const dateKey = (date = new Date()) => {
        const safe = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
        return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, '0')}-${String(safe.getDate()).padStart(2, '0')}`;
    };
    const timeText = ts => {
        const date = new Date(Number(ts) || Date.now());
        return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    // ---------- languages ----------
    function normalizeLanguage(lang) {
        if (!lang) return null;
        const label = String(lang.label || lang.name || '').trim();
        if (!label) return null;
        const id = String(lang.id || label.toLowerCase().replace(/\s+/g, '_')).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'lang_' + Date.now();
        const preset = PRESET_LANGUAGES.find(item => item.id === id);
        return {
            id,
            label: label.slice(0, 24),
            short: String(lang.short || preset?.short || label.slice(0, 1)).trim().slice(0, 3) || label.slice(0, 1),
            code: String(lang.code || preset?.code || '').slice(0, 12),
            placeholder: String(lang.placeholder || preset?.placeholder || `写一行${label}`).slice(0, 80)
        };
    }
    function allLanguages() {
        const saved = readJson(KEYS.languages, null);
        const list = Array.isArray(saved) && saved.length ? saved.map(normalizeLanguage).filter(Boolean) : DEFAULT_LANGUAGES.map(normalizeLanguage);
        return list.slice(0, 12);
    }
    function saveAllLanguages(list) {
        const safe = (Array.isArray(list) ? list : []).map(normalizeLanguage).filter(Boolean).slice(0, 12);
        writeJson(KEYS.languages, safe.length ? safe : DEFAULT_LANGUAGES);
    }
    function language(id) {
        return allLanguages().find(item => item.id === id) || PRESET_LANGUAGES.find(item => item.id === id) || null;
    }

    // ---------- settings ----------
    function defaultSettings() {
        const langs = allLanguages();
        const nativeId = langs.some(lang => lang.id === 'cn') ? 'cn' : langs[0].id;
        return {
            tutorId: '',
            nativeId,
            targetIds: langs.filter(lang => lang.id !== nativeId).map(lang => lang.id),
            level: 'beginner',
            autoTranslate: true,
            strictness: 'normal',
            voice: true
        };
    }
    function getSettings() {
        const base = defaultSettings();
        const saved = readJson(KEYS.settings, null);
        if (!saved || typeof saved !== 'object') return base;
        const langs = allLanguages();
        const nativeId = langs.some(lang => lang.id === saved.nativeId) ? saved.nativeId : base.nativeId;
        const targetIds = (Array.isArray(saved.targetIds) ? saved.targetIds : base.targetIds).filter(id => id !== nativeId && langs.some(lang => lang.id === id));
        return {
            tutorId: typeof saved.tutorId === 'string' ? saved.tutorId : '',
            nativeId,
            targetIds: targetIds.length ? targetIds : base.targetIds.filter(id => id !== nativeId),
            level: LEVELS.some(item => item.id === saved.level) ? saved.level : 'beginner',
            autoTranslate: saved.autoTranslate !== false,
            strictness: STRICTNESS.some(item => item.id === saved.strictness) ? saved.strictness : 'normal',
            voice: saved.voice !== false
        };
    }
    function saveSettings(patch) {
        const next = { ...getSettings(), ...patch };
        writeJson(KEYS.settings, next);
        return next;
    }
    // Languages the rest of the app (flip-card game) sees: native first, then targets, then the rest.
    function getStudyLanguages() {
        const settings = getSettings();
        const langs = allLanguages();
        const order = [settings.nativeId, ...settings.targetIds];
        return [...order.map(id => langs.find(lang => lang.id === id)).filter(Boolean), ...langs.filter(lang => !order.includes(lang.id))];
    }
    function primaryTarget() {
        const settings = getSettings();
        return language(settings.targetIds[0]) || allLanguages().find(lang => lang.id !== settings.nativeId) || null;
    }
    function targetLabel(settings = getSettings()) {
        return settings.targetIds.map(language).filter(Boolean).map(lang => lang.label).join('、') || '学习语言';
    }

    // ---------- cards ----------
    function normalizeCard(card) {
        const lines = { ...(card?.lines || {}) };
        ['cn', 'ja', 'th'].forEach(key => { if (card?.[key] && !lines[key]) lines[key] = card[key]; });
        return {
            ...card,
            id: card?.id || uid('study'),
            lines,
            cn: lines.cn || card?.cn || '',
            ja: lines.ja || card?.ja || '',
            th: lines.th || card?.th || '',
            note: card?.note || '',
            source: card?.source || 'manual',
            charId: card?.charId || '',
            stats: card?.stats && typeof card.stats === 'object' ? card.stats : { asked: 0, correct: 0, lastAsked: 0 },
            createdAt: card?.createdAt || Date.now()
        };
    }
    function getStudyCards() {
        const cards = readJson(KEYS.cards, []);
        return Array.isArray(cards) ? cards.map(normalizeCard) : [];
    }
    function saveStudyCards(cards) {
        writeJson(KEYS.cards, (Array.isArray(cards) ? cards : []).map(normalizeCard));
    }
    function addCard(card) {
        const cards = getStudyCards();
        const next = normalizeCard(card);
        cards.unshift(next);
        saveStudyCards(cards);
        return next;
    }
    function updateCard(id, patch) {
        const cards = getStudyCards();
        const index = cards.findIndex(card => card.id === id);
        if (index < 0) return null;
        cards[index] = normalizeCard({ ...cards[index], ...patch, updatedAt: Date.now() });
        saveStudyCards(cards);
        return cards[index];
    }
    function seedCardsIfEmpty() {
        if (getStudyCards().length) return;
        saveStudyCards([
            { id: 'study_seed_1', cn: '我想慢慢变得更稳定。', ja: '少しずつ安定した自分になりたい。', th: 'ฉันอยากค่อยๆ เป็นคนที่มั่นคงขึ้น', note: '中文的“慢慢”偏过程；日语用少しずつ；泰语用ค่อยๆ。', createdAt: Date.now(), source: 'seed' },
            { id: 'study_seed_2', cn: '今天先学十分钟就好。', ja: '今日はまず十分だけ勉強すればいい。', th: 'วันนี้เรียนแค่สิบนาทีก่อนก็พอ', note: '“就好/ก็พอ”都有降低压力的语气，适合做每日学习目标。', createdAt: Date.now() - 1000, source: 'seed' }
        ]);
    }

    // ---------- progress / check-ins ----------
    const getProgress = () => readJson(KEYS.progress, {}) || {};
    const saveProgress = value => writeJson(KEYS.progress, value || {});
    const getCheckins = () => { const value = readJson(KEYS.checkins, {}); return value && typeof value === 'object' ? value : {}; };
    const saveCheckins = value => writeJson(KEYS.checkins, value && typeof value === 'object' ? value : {});
    function bumpProgress() {
        const progress = getProgress();
        const today = new Date().toLocaleDateString('zh-CN');
        progress[today] = (progress[today] || 0) + 1;
        saveProgress(progress);
    }

    // ---------- characters ----------
    function characters() {
        let list = [];
        if (typeof getWechatSortedChatCharacters === 'function') list = getWechatSortedChatCharacters();
        else if (Array.isArray(window.myCharacters)) list = window.myCharacters;
        return list.filter(char => char && char.id && !char.isGroupChat && !(typeof isWechatGroupNpcContact === 'function' ? isWechatGroupNpcContact(char) : (char.isGroupNpc || char.groupNpc || char.npcOriginGroupId)));
    }
    const charName = char => (typeof getWechatCharDisplayName === 'function' ? getWechatCharDisplayName(char) : ((char?.chatConfig?.nickname) || char?.name || '角色'));
    const charAvatar = char => (typeof getWechatCharAvatarSource === 'function' ? getWechatCharAvatarSource(char, '') : (char?.avatar || '')) || fallbackAvatar(char);
    function fallbackAvatar(char) {
        const initial = Array.from(charName(char).trim())[0] || '学';
        return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="100" fill="#e9ecf2"/><text x="100" y="118" text-anchor="middle" font-family="serif" font-size="80" font-weight="700" fill="#1c2230">${initial.replace(/[<>&"']/g, '')}</text></svg>`);
    }
    function tutor() {
        const list = characters();
        const settings = getSettings();
        return list.find(char => char.id === settings.tutorId) || list[0] || null;
    }

    // ---------- chats ----------
    function getChats() { const value = readJson(KEYS.chats, {}); return value && typeof value === 'object' ? value : {}; }
    function getChat(charId) {
        const chat = getChats()[charId];
        return chat && Array.isArray(chat.messages) ? chat : { messages: [], updatedAt: 0 };
    }
    function saveChat(charId, chat) {
        const chats = getChats();
        chats[charId] = { messages: chat.messages.slice(-CHAT_LIMIT), updatedAt: Date.now() };
        writeJson(KEYS.chats, chats);
    }
    function appendMessage(charId, message) {
        const chat = getChat(charId);
        chat.messages.push(message);
        saveChat(charId, chat);
        return message;
    }
    function patchMessage(charId, messageId, patch) {
        const chat = getChat(charId);
        const index = chat.messages.findIndex(message => message.id === messageId);
        if (index < 0) return null;
        chat.messages[index] = { ...chat.messages[index], ...patch };
        saveChat(charId, chat);
        return chat.messages[index];
    }
    function clearChat(charId) {
        const chats = getChats();
        delete chats[charId];
        writeJson(KEYS.chats, chats);
    }

    // ---------- prompts ----------
    function parseJson(text) {
        if (typeof parseWechatJsonObject === 'function') {
            const parsed = parseWechatJsonObject(text);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        }
        const source = String(text || '');
        for (let start = source.indexOf('{'); start >= 0; start = source.indexOf('{', start + 1)) {
            let depth = 0, quoted = false;
            for (let index = start; index < source.length; index++) {
                const ch = source[index];
                if (quoted) { if (ch === '\\') index++; else if (ch === '"') quoted = false; continue; }
                if (ch === '"') quoted = true;
                else if (ch === '{') depth++;
                else if (ch === '}' && --depth === 0) {
                    try { const value = JSON.parse(source.slice(start, index + 1)); if (value && typeof value === 'object') return value; } catch (_) {}
                    break;
                }
            }
        }
        return null;
    }
    function personaBlock(char) {
        const parts = [];
        const persona = typeof getWechatCharacterPersonaText === 'function' ? getWechatCharacterPersonaText(char, 9000) : clean(char.description, 9000);
        if (persona) parts.push(persona);
        if (typeof buildWechatIdentityContextPrompt === 'function') { try { const identity = buildWechatIdentityContextPrompt(char); if (identity) parts.push(identity); } catch (_) {} }
        if (typeof buildWechatMemoryPrompt === 'function') { try { const memory = String(buildWechatMemoryPrompt(char) || '').slice(0, 3000); if (memory) parts.push(memory); } catch (_) {} }
        if (typeof buildWechatRecentHistoryForPrompt === 'function') { try { const recent = String(buildWechatRecentHistoryForPrompt(char, 8) || '').slice(0, 2400); if (recent) parts.push('【最近微信聊天，用于保持关系与近况一致】\n' + recent); } catch (_) {} }
        return parts.join('\n\n');
    }
    function studyRules(char, settings) {
        const native = language(settings.nativeId);
        const targets = settings.targetIds.map(language).filter(Boolean);
        const target = targets[0] || native;
        const level = LEVELS.find(item => item.id === settings.level) || LEVELS[0];
        const strict = STRICTNESS.find(item => item.id === settings.strictness) || STRICTNESS[1];
        const name = charName(char);
        return [
            `【你是谁】你就是${name}本人，不是语言老师，也不是 AI 助手。保持你的性格、口吻、与用户的关系和边界；帮用户学语言只是你们相处的一部分，用你自己的方式教，不要变成教科书语气。`,
            `【语言安排】用户的母语是${native?.label || '中文'}；正在学：${targets.map(item => item.label).join('、') || target?.label}（水平：${level.label}，${level.hint}）。reply 用${target?.label}写。${targets.length > 1 ? 'versions 里再给出同一段话的其它学习语言版本，键用语言代码：' + targets.slice(1).map(item => `"${item.id}" 为 ${item.label}`).join('，') + '；每种语言都要出现，缺一不可。' : 'versions 留空对象。'}不要在 reply 里逐句附${native?.label || '中文'}翻译，翻译只放 translation；需要解释时才夹一句${native?.label || '中文'}。`,
            targets.some(scriptNeedsReadings) || scriptNeedsReadings(native) ? `【读音标注】reply、versions、correction.better 和 words.term 里凡是${targets.filter(scriptNeedsReadings).map(item => item.id === 'ja' ? '日语汉字' : '汉字').join('、') || '汉字'}都要标读音，格式 {漢字|かんじ}（日语用平假名，中文用拼音），按词标注，假名、拉丁字母和标点不标。` : '',
            `【纠错】严格度：${strict.label}，${strict.hint}。用户这条消息若用学习语言写，检查有没有错误或不地道之处：有则填 correction（original 用户原句、better 更自然的说法、note 一句${native?.label || '中文'}说明，语气要像你本人），没有则 correction 为 null。用户用母语写时 correction 为 null，但你可以顺手在 reply 里教 ta 那句话用${target?.label}怎么说。`,
            `【生词】words 里放 0 到 3 个 reply 中值得记的词或短语：term 原文、reading 读音（假名、罗马音、音标或拼音，没有就留空）、meaning 用${native?.label || '中文'}解释。`,
            `【翻译】translation 是 reply 的完整${native?.label || '中文'}翻译，自然通顺，不加解释。`,
            '【输出】只输出一个 JSON 对象：{"reply":"","versions":{},"translation":"","correction":{"original":"","better":"","note":""} 或 null,"words":[{"term":"","reading":"","meaning":""}]}。reply 可以带括号里的动作神态，但不要输出 JSON 之外的任何文字。'
        ].filter(Boolean).join('\n');
    }
    function buildTurnMessages(char, settings, chat, userText, kind) {
        const messages = [
            { role: 'system', content: personaBlock(char) },
            { role: 'system', content: studyRules(char, settings) }
        ];
        chat.messages.slice(-12).forEach(message => {
            if (message.role === 'user') messages.push({ role: 'user', content: message.text });
            else messages.push({ role: 'assistant', content: JSON.stringify({ reply: message.text, versions: message.versions || {}, translation: message.translation || '', correction: message.correction || null, words: message.words || [] }) });
        });
        if (kind === 'opening') {
            messages.push({ role: 'user', content: '（用户刚打开和你的语言练习对话。请你先按自己的性格用学习语言打个招呼，接一句和你们近况有关的话，再问一个简单的问题开始今天的练习。这条不是用户说的话，不要纠错。）' });
        } else {
            messages.push({ role: 'user', content: userText });
        }
        return messages;
    }
    function normalizeTurn(raw, settings = getSettings()) {
        if (!raw || typeof raw !== 'object') return null;
        const reply = clean(raw.reply ?? raw.text ?? raw.message, 2000);
        if (!reply) return null;
        const versions = {};
        const extra = settings.targetIds.slice(1);
        const rawVersions = raw.versions && typeof raw.versions === 'object' && !Array.isArray(raw.versions) ? raw.versions : {};
        extra.forEach(id => { const text = clean(rawVersions[id], 2000); if (text) versions[id] = text; });
        const correctionRaw = raw.correction && typeof raw.correction === 'object' ? raw.correction : null;
        const correction = correctionRaw && clean(correctionRaw.better, 600) ? { original: clean(correctionRaw.original, 600), better: clean(correctionRaw.better, 600), note: clean(correctionRaw.note, 400) } : null;
        const words = (Array.isArray(raw.words) ? raw.words : []).map(item => item && typeof item === 'object' ? { term: clean(item.term, 80), reading: clean(item.reading, 80), meaning: clean(item.meaning, 160) } : null).filter(item => item && item.term).slice(0, 3);
        return { reply, versions, translation: clean(raw.translation, 2000), correction, words };
    }
    function failureText(result) {
        if (!result) return '没有收到回复。';
        if (result.quotaExceeded) return '聊天接口额度不足，请检查接口后再试。';
        if (result.rateLimited || result.deferred) return result.retryAfterMs > 0 ? `接口要求等待约 ${Math.ceil(result.retryAfterMs / 1000)} 秒。` : '接口请求过于频繁，稍后再发一条。';
        return result.error || '回复失败，请稍后再试。';
    }

    // ---------- API turn ----------
    async function requestTurn(char, settings, chat, userText, kind = 'chat') {
        if (typeof callChatApi !== 'function') throw new Error('聊天 API 模块没有加载。');
        const result = await callChatApi(buildTurnMessages(char, settings, chat, userText, kind), { usageFeature: 'study', usageChar: char, temperature: 0.8, max_tokens: Math.min(5000, 1400 + 600 * Math.max(0, settings.targetIds.length - 1)), skipLengthContinuation: true, skipStatusValidationRetry: true, skipEmptyLengthRetry: true });
        if (!result || !result.ok) throw new Error(failureText(result));
        const turn = normalizeTurn(parseJson(result.content), settings);
        if (!turn) throw new Error('这次回复不是要求的格式，请再发一次。');
        return turn;
    }
    async function send(text, kind = 'chat') {
        const char = tutor();
        const message = clean(text, 1200);
        if (!char) { setStatus('先在小手机里添加一个角色。', 'warn'); return false; }
        if (state.busy) return false;
        if (kind === 'chat' && !message) return false;
        const settings = getSettings();
        const chat = getChat(char.id);
        let userMessage = null;
        if (kind === 'chat') {
            userMessage = appendMessage(char.id, { id: uid('u'), role: 'user', text: message, createdAt: Date.now() });
        }
        state.busy = true;
        setStatus(`${charName(char)} 正在回复…`, 'busy');
        render();
        try {
            const turn = await requestTurn(char, settings, getChat(char.id), message, kind);
            const reply = appendMessage(char.id, { id: uid('c'), role: 'char', text: turn.reply, versions: turn.versions, translation: turn.translation, correction: turn.correction, words: turn.words, createdAt: Date.now(), inReplyTo: userMessage?.id || '' });
            if (turn.correction && userMessage) patchMessage(char.id, userMessage.id, { corrected: true });
            const missing = settings.targetIds.slice(1).filter(id => !turn.versions[id]).map(id => language(id)?.label || id);
            setStatus(missing.length ? `这次回复缺少${missing.join('、')}版本，可以请 TA 补充。` : '', 'warn');
            state.busy = false;
            render();
            if (settings.voice) speak(plainText(turn.reply), primaryTarget()?.code);
            return reply;
        } catch (error) {
            state.busy = false;
            setStatus(error.message || String(error), 'error');
            render();
            return false;
        }
    }

    // ---------- voice ----------
    let activeVoiceAudio = null;

    function canSpeak() {
        return !!(
            typeof requestCharacterVoiceAudio === 'function'
            || (window.ByndAndroid && typeof window.ByndAndroid.speakText === 'function')
            || (typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance === 'function')
        );
    }

    function stopVoice() {
        if (activeVoiceAudio) {
            try { activeVoiceAudio.pause(); activeVoiceAudio.currentTime = 0; } catch (_) {}
            activeVoiceAudio = null;
        }
        try { window.ByndAndroid?.stopTts?.(); } catch (_) {}
        try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (_) {}
    }

    function speakWithSystemVoice(text, code) {
        const speechText = plainText(text).replace(/（[^）]*）|\([^)]*\)/g, ' ').trim() || plainText(text);
        if (!speechText) return false;
        if (window.ByndAndroid && typeof window.ByndAndroid.speakText === 'function') {
            try {
                const raw = window.ByndAndroid.speakText(speechText, code || '', 0.92);
                const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (result?.status === 'queued') return true;
                if (result?.status === 'missing-data') setStatus(`系统还没有安装 ${language(primaryTarget()?.id)?.label || code || '该语言'} 语音，请到手机的文字转语音设置中下载。`, 'warn');
                else if (result?.status === 'not-supported') setStatus(`当前系统 TTS 不支持 ${language(primaryTarget()?.id)?.label || code || '该语言'}。`, 'warn');
                else setStatus('系统语音正在初始化，请稍后再试。', 'warn');
                render();
                return false;
            } catch (_) {
                // Browser/PWA fallback below.
            }
        }
        if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance !== 'function') {
            setStatus('当前设备没有可用的系统语音。', 'warn');
            render();
            return false;
        }
        try {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(speechText);
            if (code) utterance.lang = code;
            const voices = speechSynthesis.getVoices?.() || [];
            const voice = voices.find(item => code && item.lang && item.lang.toLowerCase().startsWith(code.toLowerCase().slice(0, 2)));
            if (code && voices.length && !voice) {
                setStatus(`浏览器里没有 ${language(primaryTarget()?.id)?.label || code} 的系统语音。`, 'warn');
                render();
                return false;
            }
            if (voice) utterance.voice = voice;
            utterance.rate = 0.92;
            speechSynthesis.speak(utterance);
            return true;
        } catch (_) {
            setStatus('系统语音播放失败，请检查该语言的语音包。', 'warn');
            render();
            return false;
        }
    }

    async function speak(text, code) {
        if (!canSpeak() || !text) return false;
        stopVoice();
        const char = tutor();
        const binding = typeof getCharacterVoiceBinding === 'function' ? getCharacterVoiceBinding(char) : null;
        if (binding && typeof requestCharacterVoiceAudio === 'function') {
            try {
                const result = await requestCharacterVoiceAudio(plainText(text), char);
                if (!result?.audioUrl || typeof Audio !== 'function') throw new Error('没有可播放的音频');
                activeVoiceAudio = new Audio(result.audioUrl);
                activeVoiceAudio.onended = () => { activeVoiceAudio = null; };
                await activeVoiceAudio.play();
                return true;
            } catch (error) {
                console.warn('角色付费音色不可用，改用学习 App 的系统语音：', error);
                setStatus('角色付费音色暂不可用，已改用系统语音。', 'warn');
                render();
            }
        }
        return speakWithSystemVoice(text, code);
    }

    // ---------- saving from chat ----------
    function saveSentence(messageId) {
        const char = tutor();
        if (!char) return;
        const message = getChat(char.id).messages.find(item => item.id === messageId);
        if (!message || message.role !== 'char') return;
        const settings = getSettings();
        const target = primaryTarget();
        const lines = {};
        const sentence = value => plainText(value).replace(/（[^）]*）|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
        if (target) lines[target.id] = sentence(message.text);
        Object.entries(message.versions || {}).forEach(([id, text]) => { if (language(id) && sentence(text)) lines[id] = sentence(text); });
        if (message.translation) lines[settings.nativeId] = message.translation;
        if (!Object.keys(lines).length) return;
        const card = addCard({ lines, note: `来自和${charName(char)}的对话`, source: 'chat', charId: char.id });
        patchMessage(char.id, messageId, { savedCardId: card.id });
        toast('已存入词本');
        render();
    }
    function saveWord(messageId, index) {
        const char = tutor();
        if (!char) return;
        const message = getChat(char.id).messages.find(item => item.id === messageId);
        const word = message?.words?.[Number(index)];
        if (!word) return;
        const settings = getSettings();
        const target = primaryTarget();
        const lines = {};
        if (target) lines[target.id] = plainText(word.term);
        if (word.meaning) lines[settings.nativeId] = word.meaning;
        const card = addCard({ lines, note: [word.reading ? `读音：${word.reading}` : '', `出自：${clean(plainText(message.text), 120)}`].filter(Boolean).join('\n'), source: 'chat', charId: char.id });
        const savedWords = Array.isArray(message.savedWords) ? message.savedWords.slice() : [];
        savedWords[Number(index)] = card.id;
        patchMessage(char.id, messageId, { savedWords });
        toast(`已收藏「${word.term}」`);
        render();
    }
    function saveCorrection(messageId) {
        const char = tutor();
        if (!char) return;
        const message = getChat(char.id).messages.find(item => item.id === messageId);
        if (!message?.correction) return;
        const settings = getSettings();
        const target = primaryTarget();
        // A correction becomes an error-fixing drill: the prompt shows what was written, the answer is the natural form.
        const lines = {};
        if (target) lines[target.id] = plainText(message.correction.better);
        lines[settings.nativeId] = message.correction.original ? `改错：${plainText(message.correction.original)}` : (message.correction.note || '改错');
        const card = addCard({ lines, note: message.correction.note || '', source: 'correction', charId: char.id });
        patchMessage(char.id, messageId, { savedCorrectionId: card.id });
        toast('已把纠正存入词本');
        render();
    }

    // ---------- quiz ----------
    function pickQuizCard() {
        const cards = getStudyCards().filter(card => Object.keys(card.lines || {}).length >= 2);
        if (!cards.length) return null;
        const score = card => {
            const stats = card.stats || {};
            const wrongness = (stats.asked || 0) - (stats.correct || 0);
            const recency = card.createdAt > Date.now() - 3 * 86400000 ? 2 : 0;
            const stale = stats.lastAsked ? Math.min(3, (Date.now() - stats.lastAsked) / 86400000) : 3;
            return wrongness * 2 + recency + stale + Math.random();
        };
        return cards.slice().sort((a, b) => score(b) - score(a))[0];
    }
    function startQuiz() {
        const card = pickQuizCard();
        if (!card) { setStatus('词本里还没有两种语言都有的卡，先去对话里收藏几句。', 'warn'); render(); return; }
        const settings = getSettings();
        const langs = getStudyLanguages().filter(lang => card.lines[lang.id]);
        const prompt = langs.find(lang => lang.id === settings.nativeId) || langs[0];
        const answer = langs.find(lang => lang.id !== prompt.id) || langs[1];
        state.quiz = { cardId: card.id, promptLang: prompt, answerLang: answer, answer: '', result: null, revealed: false };
        setStatus('');
        render();
    }
    function revealQuiz() {
        if (!state.quiz) return;
        state.quiz.revealed = true;
        render();
    }
    function markQuiz(correct) {
        if (!state.quiz) return;
        const card = getStudyCards().find(item => item.id === state.quiz.cardId);
        if (card) updateCard(card.id, { stats: { asked: (card.stats.asked || 0) + 1, correct: (card.stats.correct || 0) + (correct ? 1 : 0), lastAsked: Date.now() } });
        bumpProgress();
        state.quiz = null;
        toast(correct ? '记住了' : '下次再抽一次');
        render();
    }
    async function gradeQuiz() {
        const quiz = state.quiz;
        const char = tutor();
        const card = quiz && getStudyCards().find(item => item.id === quiz.cardId);
        if (!quiz || !card || !char || state.busy) return;
        const answer = clean(byId('study-quiz-input')?.value, 400);
        if (!answer) { setStatus('先写下你的答案。', 'warn'); render(); return; }
        if (typeof callChatApi !== 'function') { quiz.revealed = true; render(); return; }
        state.busy = true;
        quiz.answer = answer;
        setStatus(`${charName(char)} 正在看你的答案…`, 'busy');
        render();
        try {
            const messages = [
                { role: 'system', content: personaBlock(char) },
                { role: 'system', content: `你就是${charName(char)}本人，用你的性格和口吻点评用户的翻译练习，不要变成老师腔。只输出 JSON：{"correct":true或false,"feedback":"一两句${language(getSettings().nativeId)?.label || '中文'}点评，像你本人在说话","better":"更地道的写法，没有就留空"}。意思对、只是不够地道也算 correct:true。` },
                { role: 'user', content: `题目（${quiz.promptLang.label}）：${card.lines[quiz.promptLang.id]}\n参考答案（${quiz.answerLang.label}）：${card.lines[quiz.answerLang.id]}\n我的答案：${answer}` }
            ];
            const result = await callChatApi(messages, { usageFeature: 'study', usageChar: char, temperature: 0.6, max_tokens: 500, skipLengthContinuation: true, skipStatusValidationRetry: true, skipEmptyLengthRetry: true });
            if (!result || !result.ok) throw new Error(failureText(result));
            const parsed = parseJson(result.content);
            if (!parsed) throw new Error('这次点评不是要求的格式，请再试一次。');
            quiz.result = { correct: parsed.correct === true, feedback: clean(parsed.feedback, 400), better: clean(parsed.better, 400) };
            quiz.revealed = true;
            setStatus('');
        } catch (error) {
            setStatus(error.message || String(error), 'error');
        } finally {
            state.busy = false;
            render();
        }
    }

    // ---------- check-ins ----------
    function recentDays(count = 21) {
        return Array.from({ length: count }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (count - 1 - index)); return { date, key: dateKey(date) }; });
    }
    function curvePath(days, checkins) {
        const width = 290, height = 88;
        return days.map((day, index) => {
            const progress = Math.max(0, Math.min(100, Number(checkins[day.key]?.progress || 0)));
            const x = days.length === 1 ? width / 2 : (index / (days.length - 1)) * width;
            const y = height - (progress / 100) * 68 - 10;
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(' ');
    }
    function setMood(moodId) {
        if (!MOODS.some(mood => mood.id === moodId)) return;
        const checkins = getCheckins();
        const key = dateKey();
        checkins[key] = { ...(checkins[key] || {}), mood: moodId, updatedAt: Date.now() };
        saveCheckins(checkins);
        render();
    }
    function saveCheckin() {
        const checkins = getCheckins();
        const key = dateKey();
        const prev = checkins[key] || {};
        const progress = Math.max(0, Math.min(100, Number(byId('study-check-progress-input')?.value || prev.progress || 0)));
        const note = clean(byId('study-check-note')?.value, 120);
        checkins[key] = { ...prev, done: true, mood: prev.mood || 'calm', progress, note, updatedAt: Date.now() };
        saveCheckins(checkins);
        toast(`今日打卡已保存：${progress}%`);
        render();
    }

    // ---------- UI ----------
    function toast(text) {
        if (typeof showWechatToast === 'function') showWechatToast(text);
        else setStatus(text, 'done');
    }
    function setStatus(text, tone = '') {
        state.status = text ? { text, tone } : null;
    }
    function setTab(tab) {
        if (!TABS.some(item => item.id === tab)) return;
        state.tab = tab;
        try { localStorage.setItem(KEYS.tab, tab); } catch (_) {}
        setStatus('');
        render();
    }
    function init() {
        // A full localStorage must not keep the app from opening; saving surfaces its own error later.
        try { seedCardsIfEmpty(); } catch (_) {}
        try { if (!localStorage.getItem(KEYS.languages)) saveAllLanguages(DEFAULT_LANGUAGES); } catch (_) {}
        try { if (!localStorage.getItem(KEYS.settings)) saveSettings({}); } catch (_) {}
        const saved = localStorage.getItem(KEYS.tab);
        state.tab = TABS.some(item => item.id === saved) ? saved : 'chat';
        state.quiz = null;
        setStatus('');
        render();
        if (canSpeak() && typeof speechSynthesis.getVoices === 'function') speechSynthesis.getVoices();
    }
    function render() {
        const shell = byId('study-shell');
        const content = byId('study-content');
        const tabbar = byId('study-tabbar');
        if (!shell || !content || !tabbar) return;
        shell.dataset.tab = state.tab;
        const char = tutor();
        const settings = getSettings();
        const target = primaryTarget();
        const title = byId('study-topbar-title');
        if (title) title.innerHTML = `<span>BYND STUDY</span><strong>${escapeHtml(char ? `${charName(char)} · ${targetLabel(settings)}` : '学习')}</strong>`;
        tabbar.innerHTML = TABS.map(tab => `<button type="button" class="${tab.id === state.tab ? 'active' : ''}" onclick="ByndStudy.setTab('${tab.id}')" aria-pressed="${tab.id === state.tab}"><i class="${tab.icon}"></i><span>${tab.label}</span></button>`).join('');
        const statusHtml = state.status ? `<p class="study-status" data-tone="${escapeAttr(state.status.tone)}" role="status">${escapeHtml(state.status.text)}</p>` : '';
        if (state.tab === 'chat') content.innerHTML = renderChat(char, settings, statusHtml);
        else if (state.tab === 'words') content.innerHTML = renderWords(statusHtml);
        else if (state.tab === 'review') content.innerHTML = renderReview(char, statusHtml);
        else content.innerHTML = renderMe(char, settings, statusHtml);
        if (state.tab === 'chat') {
            const list = byId('study-chat-list');
            if (list) list.scrollTop = list.scrollHeight;
        }
    }
    function renderChat(char, settings, statusHtml) {
        if (!char) return `<div class="study-empty-state"><i class="ri-user-add-line"></i><strong>还没有角色</strong><p>先在小手机里导入或添加一个角色，TA 会用自己的方式陪你学。</p></div>`;
        const target = primaryTarget();
        const native = language(settings.nativeId);
        const chat = getChat(char.id);
        const messages = chat.messages;
        const bubbles = messages.map(message => message.role === 'user' ? renderUserBubble(message) : renderCharBubble(char, message, settings)).join('');
        const empty = !messages.length ? `
            <div class="study-chat-empty">
                <img src="${escapeAttr(charAvatar(char))}" alt="">
                <strong>${escapeHtml(charName(char))}</strong>
                <p>用 ${escapeHtml(targetLabel(settings))} 和 TA 聊天${settings.targetIds.length > 1 ? '，每种语言的回复会一起显示' : ''}，${escapeHtml(native?.label || '中文')} 翻译会自动附在下面；写错了 TA 会顺手纠正。</p>
                <button type="button" class="study-primary" ${state.busy ? 'disabled' : ''} onclick="ByndStudy.start()"><i class="ri-chat-smile-3-line"></i><span>让 ${escapeHtml(charName(char))} 先开口</span></button>
            </div>` : '';
        return `
            <div class="study-chat-list" id="study-chat-list">
                ${empty}${bubbles}
                ${state.busy ? `<div class="study-typing"><span></span><span></span><span></span></div>` : ''}
            </div>
            ${statusHtml}
            <div class="study-composer">
                <div class="study-chips">
                    <button type="button" onclick="ByndStudy.askHowToSay()"><i class="ri-translate-2"></i>这句怎么说</button>
                    <button type="button" onclick="ByndStudy.quick('换个话题吧。')"><i class="ri-shuffle-line"></i>换个话题</button>
                    <button type="button" onclick="ByndStudy.quick('说简单一点，我没跟上。')"><i class="ri-speed-down-line"></i>简单一点</button>
                </div>
                <div class="study-composer-row">
                    <textarea id="study-input" rows="1" placeholder="用 ${escapeAttr(targetLabel(settings))} 或${escapeAttr(native?.label || '中文')}都可以" ${state.busy ? 'disabled' : ''} onkeydown="ByndStudy.onKey(event)"></textarea>
                    <button type="button" class="study-send" ${state.busy ? 'disabled' : ''} onclick="ByndStudy.submit()" aria-label="发送"><i class="ri-send-plane-2-fill"></i></button>
                </div>
            </div>`;
    }
    function renderUserBubble(message) {
        return `<div class="study-msg is-user"><div class="study-bubble">${escapeHtml(message.text)}</div><time>${escapeHtml(timeText(message.createdAt))}</time></div>`;
    }
    function renderCharBubble(char, message, settings) {
        const open = state.translationOpen[message.id] ?? settings.autoTranslate;
        const target = primaryTarget();
        const correction = message.correction ? `
            <div class="study-correction">
                <span><i class="ri-pencil-ruler-2-line"></i>纠正</span>
                ${message.correction.original ? `<p class="is-original">${escapeHtml(message.correction.original)}</p>` : ''}
                <p class="is-better">${rubyHtml(message.correction.better)}</p>
                ${message.correction.note ? `<p class="is-note">${escapeHtml(message.correction.note)}</p>` : ''}
                <button type="button" ${message.savedCorrectionId ? 'disabled' : ''} onclick="ByndStudy.saveCorrection('${escapeAttr(message.id)}')">${message.savedCorrectionId ? '已存入词本' : '存入词本'}</button>
            </div>` : '';
        const words = message.words && message.words.length ? `
            <div class="study-words">
                ${message.words.map((word, index) => `<button type="button" class="${message.savedWords?.[index] ? 'is-saved' : ''}" onclick="ByndStudy.saveWord('${escapeAttr(message.id)}', ${index})"><b>${rubyHtml(word.term)}</b>${word.reading ? `<i>${escapeHtml(word.reading)}</i>` : ''}<span>${escapeHtml(word.meaning)}</span><em>${message.savedWords?.[index] ? '已收藏' : '+ 收藏'}</em></button>`).join('')}
            </div>` : '';
        return `
            <div class="study-msg is-char">
                <img src="${escapeAttr(charAvatar(char))}" alt="">
                <div class="study-msg-body">
                    ${correction}
                    <div class="study-bubble">${rubyHtml(message.text)}</div>
                    ${Object.entries(message.versions || {}).filter(([id]) => language(id)).map(([id, text]) => `<div class="study-version"><b>${escapeHtml(language(id).short)}</b><p>${rubyHtml(text)}</p></div>`).join('')}
                    ${message.translation ? `<div class="study-translation${open ? ' is-open' : ''}"><button type="button" onclick="ByndStudy.toggleTranslation('${escapeAttr(message.id)}')"><i class="ri-translate-2"></i>${open ? '收起翻译' : '看翻译'}</button>${open ? `<p>${escapeHtml(message.translation)}</p>` : ''}</div>` : ''}
                    ${words}
                    <div class="study-msg-actions">
                        ${canSpeak() ? `<button type="button" onclick="ByndStudy.speakMessage('${escapeAttr(message.id)}')"><i class="ri-volume-up-line"></i>听一遍</button>` : ''}
                        <button type="button" ${message.savedCardId ? 'disabled' : ''} onclick="ByndStudy.saveSentence('${escapeAttr(message.id)}')"><i class="ri-bookmark-line"></i>${message.savedCardId ? '已存整句' : '存整句'}</button>
                        <time>${escapeHtml(timeText(message.createdAt))}</time>
                    </div>
                </div>
            </div>`;
    }
    function renderWords(statusHtml) {
        const langs = getStudyLanguages();
        const query = state.wordQuery.trim().toLowerCase();
        const cards = getStudyCards().filter(card => !query || Object.values(card.lines || {}).some(line => String(line).toLowerCase().includes(query)) || String(card.note || '').toLowerCase().includes(query));
        const editor = state.editingCard ? renderCardEditor(state.editingCard, langs) : '';
        return `
            <div class="study-page">
                <div class="study-page-head">
                    <div><span>WORD BOOK</span><strong>词本 · ${cards.length}</strong></div>
                    <button type="button" class="study-ghost" onclick="ByndStudy.editCard('')"><i class="ri-add-line"></i>手动添加</button>
                </div>
                <label class="study-search"><i class="ri-search-line"></i><input type="search" value="${escapeAttr(state.wordQuery)}" placeholder="搜索词句或备注" oninput="ByndStudy.searchWords(this.value)"></label>
                ${statusHtml}
                ${editor}
                ${cards.length ? cards.map(card => renderCard(card, langs)).join('') : '<div class="study-empty-state"><i class="ri-book-mark-line"></i><strong>词本还是空的</strong><p>在对话里点「收藏」或「存整句」，或者手动添加一条。</p></div>'}
            </div>`;
    }
    function renderCard(card, langs) {
        const stats = card.stats || {};
        const source = { chat: '来自对话', correction: '来自纠正', seed: '示例', manual: '手动' }[card.source] || '';
        return `
            <article class="study-card">
                <div class="study-card-lines">${langs.filter(lang => card.lines?.[lang.id]).map(lang => `<p><b>${escapeHtml(lang.short)}</b><span>${escapeHtml(card.lines[lang.id])}</span></p>`).join('')}</div>
                ${card.note ? `<p class="study-card-note">${escapeHtml(card.note)}</p>` : ''}
                <div class="study-card-foot">
                    <span>${escapeHtml(source)}${stats.asked ? ` · 抽查 ${stats.asked} 次，对 ${stats.correct || 0} 次` : ''}</span>
                    ${canSpeak() ? `<button type="button" onclick="ByndStudy.speakCard('${escapeAttr(card.id)}')" aria-label="朗读"><i class="ri-volume-up-line"></i></button>` : ''}
                    <button type="button" onclick="ByndStudy.editCard('${escapeAttr(card.id)}')" aria-label="编辑"><i class="ri-edit-line"></i></button>
                    <button type="button" onclick="ByndStudy.deleteCard('${escapeAttr(card.id)}')" aria-label="删除"><i class="ri-delete-bin-line"></i></button>
                </div>
            </article>`;
    }
    function renderCardEditor(card, langs) {
        return `
            <form class="study-card-editor" onsubmit="event.preventDefault();ByndStudy.saveCardForm()">
                <strong>${card.id ? '编辑这条' : '新建一条'}</strong>
                ${langs.map(lang => `<label><span>${escapeHtml(lang.label)}</span><input type="text" data-study-lang="${escapeAttr(lang.id)}" value="${escapeAttr(card.lines?.[lang.id] || '')}" placeholder="${escapeAttr(lang.placeholder)}"></label>`).join('')}
                <label><span>备注</span><textarea id="study-card-note" rows="2" placeholder="读音、场景、易错点…">${escapeHtml(card.note || '')}</textarea></label>
                <div class="study-card-editor-actions"><button type="button" class="study-ghost" onclick="ByndStudy.cancelEdit()">取消</button><button type="submit" class="study-primary">保存</button></div>
            </form>`;
    }
    function renderReview(char, statusHtml) {
        const checkins = getCheckins();
        const todayKey = dateKey();
        const today = checkins[todayKey] || {};
        const days = recentDays(21);
        const checkedDays = days.filter(day => checkins[day.key]).length;
        const progressValue = Math.max(0, Math.min(100, Number(today.progress || 0)));
        const progress = getProgress();
        const todayCount = progress[new Date().toLocaleDateString('zh-CN')] || 0;
        const quiz = state.quiz;
        const card = quiz && getStudyCards().find(item => item.id === quiz.cardId);
        const quizHtml = quiz && card ? `
            <section class="study-panel study-quiz">
                <div class="study-panel-head"><span>QUIZ</span><strong>${escapeHtml(quiz.promptLang.label)} → ${escapeHtml(quiz.answerLang.label)}</strong></div>
                <p class="study-quiz-prompt">${escapeHtml(card.lines[quiz.promptLang.id])}</p>
                ${quiz.revealed ? `
                    <p class="study-quiz-answer"><b>参考</b>${escapeHtml(card.lines[quiz.answerLang.id])}</p>
                    ${quiz.answer ? `<p class="study-quiz-mine"><b>我写的</b>${escapeHtml(quiz.answer)}</p>` : ''}
                    ${quiz.result ? `<div class="study-quiz-feedback ${quiz.result.correct ? 'is-correct' : 'is-wrong'}"><span>${char ? escapeHtml(charName(char)) : '点评'}</span><p>${escapeHtml(quiz.result.feedback)}</p>${quiz.result.better ? `<p class="is-better">${escapeHtml(quiz.result.better)}</p>` : ''}</div>` : ''}
                    <div class="study-quiz-actions"><button type="button" class="study-ghost" onclick="ByndStudy.markQuiz(false)">没记住</button><button type="button" class="study-primary" onclick="ByndStudy.markQuiz(true)">记住了</button></div>
                ` : `
                    <input type="text" id="study-quiz-input" placeholder="写下你的 ${escapeAttr(quiz.answerLang.label)}" ${state.busy ? 'disabled' : ''} onkeydown="if(event.key==='Enter'){event.preventDefault();ByndStudy.gradeQuiz();}">
                    <div class="study-quiz-actions"><button type="button" class="study-ghost" onclick="ByndStudy.revealQuiz()">看答案</button><button type="button" class="study-primary" ${state.busy || !char ? 'disabled' : ''} onclick="ByndStudy.gradeQuiz()">${char ? `让 ${escapeHtml(charName(char))} 批改` : '批改'}</button></div>
                `}
            </section>` : `
            <section class="study-panel">
                <div class="study-panel-head"><span>QUIZ</span><strong>抽查一张</strong></div>
                <p class="study-panel-text">优先抽最近收藏和答错过的卡，${char ? `由 ${escapeHtml(charName(char))} 按 TA 的方式点评` : '需要一个角色来点评'}。今天已经做了 ${todayCount} 题。</p>
                <button type="button" class="study-primary" onclick="ByndStudy.startQuiz()"><i class="ri-question-answer-line"></i><span>开始抽查</span></button>
            </section>`;
        return `
            <div class="study-page">
                <div class="study-page-head"><div><span>REVIEW</span><strong>复习</strong></div></div>
                ${statusHtml}
                ${quizHtml}
                <section class="study-panel">
                    <div class="study-panel-head"><span>DAILY CHECK-IN</span><strong>${today.done ? '今日已打卡' : '今日还未打卡'}</strong><em>最近 21 天 ${checkedDays} 天</em></div>
                    <div class="study-calendar">${days.map(day => { const item = checkins[day.key]; const tone = MOODS.find(mood => mood.id === item?.mood)?.tone || '#d0d5dd'; return `<div class="${item ? 'active' : ''} ${day.key === todayKey ? 'today' : ''}" title="${day.key}"><b>${day.date.getMonth() + 1}/${day.date.getDate()}</b><span style="--mood:${tone}"></span></div>`; }).join('')}</div>
                    <div class="study-moods">${MOODS.map(mood => `<button type="button" class="${today.mood === mood.id ? 'active' : ''}" style="--mood:${mood.tone}" onclick="ByndStudy.setMood('${mood.id}')"><i></i><span>${mood.label}</span></button>`).join('')}</div>
                    <div class="study-progress"><div><span>今日进度</span><b id="study-progress-value">${progressValue}%</b></div><input id="study-check-progress-input" type="range" min="0" max="100" step="5" value="${progressValue}" oninput="ByndStudy.previewProgress(this.value)"></div>
                    <div class="study-curve"><div><span>记忆曲线</span><b>${checkedDays}/21</b></div><svg viewBox="0 0 290 88" preserveAspectRatio="none" aria-hidden="true"><path class="study-curve-bg" d="M0 78 C46 44 84 72 126 46 C172 18 216 48 290 22"></path><path class="study-curve-main" d="${curvePath(days, checkins) || 'M0 78 L290 78'}"></path></svg></div>
                    <textarea id="study-check-note" maxlength="120" placeholder="今天学了什么、心情如何，可以写一句。">${escapeHtml(today.note || '')}</textarea>
                    <button type="button" class="study-primary" onclick="ByndStudy.saveCheckin()"><i class="ri-check-line"></i><span>保存打卡</span></button>
                </section>
            </div>`;
    }
    function renderMe(char, settings, statusHtml) {
        const list = characters();
        const langs = allLanguages();
        const customs = langs.filter(lang => !PRESET_LANGUAGES.some(item => item.id === lang.id));
        return `
            <div class="study-page">
                <div class="study-page-head"><div><span>ME</span><strong>我的学习</strong></div></div>
                ${statusHtml}
                <section class="study-panel">
                    <div class="study-panel-head"><span>PARTNER</span><strong>陪我学的人</strong></div>
                    ${list.length ? `<div class="study-tutor-grid">${list.map(item => `<button type="button" class="${char && item.id === char.id ? 'active' : ''}" onclick="ByndStudy.setTutor('${escapeAttr(item.id)}')"><img src="${escapeAttr(charAvatar(item))}" alt=""><span>${escapeHtml(charName(item))}</span></button>`).join('')}</div>` : '<p class="study-panel-text">小手机里还没有角色。</p>'}
                    ${char ? `<button type="button" class="study-ghost is-danger" onclick="ByndStudy.clearChat()"><i class="ri-delete-bin-line"></i>清空和 ${escapeHtml(charName(char))} 的练习记录</button>` : ''}
                </section>
                <section class="study-panel">
                    <div class="study-panel-head"><span>LANGUAGES</span><strong>语言</strong></div>
                    <label class="study-field"><span>我的母语</span><select onchange="ByndStudy.setNative(this.value)">${langs.map(lang => `<option value="${escapeAttr(lang.id)}" ${lang.id === settings.nativeId ? 'selected' : ''}>${escapeHtml(lang.label)}</option>`).join('')}</select></label>
                    <div class="study-field"><span>正在学（可多选，第一个是主要语言）</span><div class="study-lang-chips">${langs.filter(lang => lang.id !== settings.nativeId).map(lang => { const index = settings.targetIds.indexOf(lang.id); return `<button type="button" class="${index >= 0 ? 'active' : ''}" onclick="ByndStudy.toggleTarget('${escapeAttr(lang.id)}')"><b>${escapeHtml(lang.short)}</b>${escapeHtml(lang.label)}${index >= 0 ? `<em>${index + 1}</em>` : ''}</button>`; }).join('')}<button type="button" class="is-add" onclick="ByndStudy.addLanguage()"><i class="ri-add-line"></i>自定义</button></div></div>
                    ${customs.length ? `<div class="study-field"><span>自定义语言</span><div class="study-lang-chips">${customs.map(lang => `<button type="button" class="is-custom" onclick="ByndStudy.removeLanguage('${escapeAttr(lang.id)}')"><b>${escapeHtml(lang.short)}</b>${escapeHtml(lang.label)}<i class="ri-close-line"></i></button>`).join('')}</div></div>` : ''}
                </section>
                <section class="study-panel">
                    <div class="study-panel-head"><span>STYLE</span><strong>怎么教我</strong></div>
                    <div class="study-field"><span>我的水平</span><div class="study-segment">${LEVELS.map(level => `<button type="button" class="${settings.level === level.id ? 'active' : ''}" onclick="ByndStudy.setLevel('${level.id}')">${level.label}</button>`).join('')}</div><small>${escapeHtml(LEVELS.find(level => level.id === settings.level)?.hint || '')}</small></div>
                    <div class="study-field"><span>纠错严格度</span><div class="study-segment">${STRICTNESS.map(item => `<button type="button" class="${settings.strictness === item.id ? 'active' : ''}" onclick="ByndStudy.setStrictness('${item.id}')">${item.label}</button>`).join('')}</div><small>${escapeHtml(STRICTNESS.find(item => item.id === settings.strictness)?.hint || '')}</small></div>
                    <label class="study-switch"><span>自动展开翻译</span><input type="checkbox" ${settings.autoTranslate ? 'checked' : ''} onchange="ByndStudy.setAutoTranslate(this.checked)"><i></i></label>
                    ${canSpeak() ? `<label class="study-switch"><span>收到回复自动朗读</span><input type="checkbox" ${settings.voice ? 'checked' : ''} onchange="ByndStudy.setVoice(this.checked)"><i></i></label>` : ''}
                </section>
            </div>`;
    }

    // ---------- handlers ----------
    function submit() {
        const input = byId('study-input');
        const text = clean(input?.value, 1200);
        if (!text) return;
        if (input) input.value = '';
        send(text, 'chat');
    }
    function onKey(event) {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
    }
    function quick(text) { send(text, 'chat'); }
    function askHowToSay() {
        const label = targetLabel();
        const sentence = typeof prompt === 'function' ? prompt(`想用${label}说什么？`) : '';
        const text = clean(sentence, 400);
        if (!text) return;
        send(`「${text}」用${label}分别怎么说？`, 'chat');
    }
    function start() { return send('', 'opening'); }
    function toggleTranslation(id) {
        const char = tutor();
        const message = char && getChat(char.id).messages.find(item => item.id === id);
        const current = state.translationOpen[id] ?? getSettings().autoTranslate;
        state.translationOpen[id] = !current;
        if (message) render();
    }
    function speakMessage(id) {
        const char = tutor();
        const message = char && getChat(char.id).messages.find(item => item.id === id);
        if (message) speak(message.text, primaryTarget()?.code);
    }
    function speakCard(id) {
        const card = getStudyCards().find(item => item.id === id);
        const target = primaryTarget();
        const line = card && (card.lines[target?.id] || Object.values(card.lines)[0]);
        if (line) speak(line, target?.code);
    }
    function setTutor(id) {
        if (!characters().some(char => char.id === id)) return;
        saveSettings({ tutorId: id });
        setStatus('');
        render();
    }
    function clearChatConfirm() {
        const char = tutor();
        if (!char) return;
        if (typeof confirm === 'function' && !confirm(`清空和「${charName(char)}」的练习记录？词本里已收藏的内容会保留。`)) return;
        clearChat(char.id);
        toast('已清空');
        render();
    }
    function setNative(id) {
        if (!language(id)) return;
        const settings = getSettings();
        saveSettings({ nativeId: id, targetIds: settings.targetIds.filter(item => item !== id) });
        render();
    }
    function toggleTarget(id) {
        const settings = getSettings();
        if (!language(id) || id === settings.nativeId) return;
        const targetIds = settings.targetIds.includes(id) ? settings.targetIds.filter(item => item !== id) : [...settings.targetIds, id];
        if (!targetIds.length) { setStatus('至少保留一种正在学的语言。', 'warn'); render(); return; }
        saveSettings({ targetIds });
        render();
    }
    function addLanguage() {
        const label = typeof prompt === 'function' ? prompt('要学习哪种语言？例如：意大利语、粤语、Русский') : '';
        if (!label || !label.trim()) return;
        const preset = PRESET_LANGUAGES.find(item => item.label.toLowerCase() === label.trim().toLowerCase());
        const langs = allLanguages();
        if (preset) {
            if (!langs.some(item => item.id === preset.id)) { langs.push(preset); saveAllLanguages(langs); }
            toggleTarget(preset.id);
            return;
        }
        const short = (typeof prompt === 'function' ? prompt('给它一个短标签，例如：意、粤、俄') : '') || label.trim().slice(0, 1);
        let id = label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') || 'lang_' + Date.now().toString(36);
        while (langs.some(lang => lang.id === id)) id += '_' + Math.random().toString(16).slice(2, 5);
        langs.push(normalizeLanguage({ id, label: label.trim(), short }));
        saveAllLanguages(langs);
        toggleTarget(id);
    }
    function removeLanguage(id) {
        const langs = allLanguages();
        if (PRESET_LANGUAGES.some(item => item.id === id) || langs.length <= 2) return;
        const settings = getSettings();
        saveAllLanguages(langs.filter(lang => lang.id !== id));
        saveSettings({ targetIds: settings.targetIds.filter(item => item !== id) });
        render();
    }
    function setLevel(id) { if (LEVELS.some(level => level.id === id)) { saveSettings({ level: id }); render(); } }
    function setStrictness(id) { if (STRICTNESS.some(item => item.id === id)) { saveSettings({ strictness: id }); render(); } }
    function setAutoTranslate(value) { saveSettings({ autoTranslate: !!value }); state.translationOpen = {}; render(); }
    function setVoice(value) { saveSettings({ voice: !!value }); render(); }
    function searchWords(value) {
        state.wordQuery = String(value || '');
        const page = byId('study-content');
        if (!page) return;
        const input = page.querySelector('.study-search input');
        const position = input ? input.selectionStart : null;
        render();
        const next = byId('study-content')?.querySelector('.study-search input');
        if (next) { next.focus(); if (position != null) next.setSelectionRange(position, position); }
    }
    function editCard(id) {
        state.editingCard = id ? (getStudyCards().find(card => card.id === id) || null) : { id: '', lines: {}, note: '' };
        setStatus('');
        render();
        byId('study-content')?.querySelector('.study-card-editor input')?.focus();
    }
    function cancelEdit() { state.editingCard = null; render(); }
    function saveCardForm() {
        const editing = state.editingCard;
        if (!editing) return;
        const lines = {};
        document.querySelectorAll('#study-content [data-study-lang]').forEach(input => { const value = clean(input.value, 300); if (value) lines[input.dataset.studyLang] = value; });
        if (!Object.keys(lines).length) { setStatus('至少写一行内容。', 'warn'); render(); return; }
        const note = clean(byId('study-card-note')?.value, 400);
        try {
            if (editing.id) updateCard(editing.id, { lines, note });
            else addCard({ lines, note, source: 'manual' });
        } catch (error) {
            setStatus(`没有保存：${error.message || error}`, 'error');
            render();
            return;
        }
        state.editingCard = null;
        toast('已保存');
        render();
    }
    function deleteCard(id) {
        const card = getStudyCards().find(item => item.id === id);
        if (!card) return;
        if (typeof confirm === 'function' && !confirm('删除这条词卡？')) return;
        saveStudyCards(getStudyCards().filter(item => item.id !== id));
        render();
    }
    function previewProgress(value) {
        const el = byId('study-progress-value');
        if (el) el.textContent = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
    }

    // Globals kept for the flip-card game and older callers.
    window.getStudyCards = getStudyCards;
    window.saveStudyCards = saveStudyCards;
    window.getStudyLanguages = getStudyLanguages;
    window.initStudyApp = init;
    window.ByndStudy = {
        init, render, setTab, submit, onKey, quick, askHowToSay, start, send, toggleTranslation, speakMessage, speakCard, speak,
        saveSentence, saveWord, saveCorrection, setTutor, clearChat: clearChatConfirm, setNative, toggleTarget, addLanguage, removeLanguage,
        setLevel, setStrictness, setAutoTranslate, setVoice, searchWords, editCard, cancelEdit, saveCardForm, deleteCard,
        startQuiz, revealQuiz, markQuiz, gradeQuiz, setMood, saveCheckin, previewProgress,
        // exposed for tests
        getSettings, saveSettings, getChat, buildTurnMessages, normalizeTurn, parseJson, tutor, characters, primaryTarget, allLanguages, language, plainText, rubyHtml, PRESET_LANGUAGES, LEVELS, STRICTNESS
    };
})();
