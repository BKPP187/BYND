// --- Dream Vault / 盗梦空间 ---
const DREAM_RECORDS_KEY = 'bynd_dream_records_v1';
const DREAM_WRITING_KEY = 'bynd_dream_writing_v1';
const DREAM_WRITING_DEFAULTS = { style: 'prose', viewpoint: 'character' };
const DREAM_WRITING_LEGACY = { style: 'fiction', viewpoint: 'second' };
const DREAM_WRITING_STYLES = [
    { value: 'prose', label: '散文', hint: '景物、感官与心绪交织', icon: 'ri-quill-pen-line' },
    { value: 'fiction', label: '细腻情感小说', hint: '对白、细节与情绪拉扯', icon: 'ri-book-open-line' }
];
const DREAM_WRITING_VIEWPOINTS = [
    { value: 'character', label: '角色主视角', hint: '用「我」讲述心事' },
    { value: 'second', label: '第二人称', hint: '以「你」入梦 · 全景' },
    { value: 'forum', label: '第三人称', hint: '旁观者见闻' }
];
let dreamGenerating = false;
let dreamEntering = false;
let dreamAdvancing = false;
let dreamSelectedCharId = '';
let dreamPreviewRecordId = '';
let dreamActiveRecordId = '';

function normalizeDreamWritingSettings(value, fallback = DREAM_WRITING_DEFAULTS) {
    const input = value && typeof value === 'object' ? value : {};
    return {
        style: DREAM_WRITING_STYLES.some(item => item.value === input.style) ? input.style : fallback.style,
        viewpoint: DREAM_WRITING_VIEWPOINTS.some(item => item.value === input.viewpoint) ? input.viewpoint : fallback.viewpoint
    };
}

function getDreamWritingPreferences() {
    try {
        return normalizeDreamWritingSettings(JSON.parse(localStorage.getItem(DREAM_WRITING_KEY) || 'null'));
    } catch (_) {
        return normalizeDreamWritingSettings(null);
    }
}

function saveDreamWritingPreferences(value) {
    const writing = normalizeDreamWritingSettings(value);
    localStorage.setItem(DREAM_WRITING_KEY, JSON.stringify(writing));
    return writing;
}

function getDreamRecordWriting(record) {
    return normalizeDreamWritingSettings(record && record.writing, DREAM_WRITING_LEGACY);
}

function syncDreamWritingControls() {
    const writing = getDreamWritingPreferences();
    document.querySelectorAll('#dream-writing-controls input[data-dream-writing]').forEach(input => {
        input.checked = writing[input.dataset.dreamWriting] === input.value;
        input.disabled = dreamGenerating;
    });
}

function renderDreamWritingControls() {
    const container = document.getElementById('dream-writing-controls');
    if (!container) return;
    container.innerHTML = [
        { key: 'style', label: '文风', options: DREAM_WRITING_STYLES },
        { key: 'viewpoint', label: '叙述视角', options: DREAM_WRITING_VIEWPOINTS }
    ].map(group => `<fieldset class="dream-writing-group">
        <legend>${group.label}</legend>
        <div class="dream-writing-options dream-writing-${group.key}">${group.options.map(option => `<label class="dream-writing-option">
            <input type="radio" name="dream-writing-${group.key}" value="${option.value}" data-dream-writing="${group.key}" onchange="setDreamWritingPreference('${group.key}', this.value)">
            <span>${option.icon ? `<i class="${option.icon}" aria-hidden="true"></i>` : ''}<strong>${option.label}</strong><small>${option.hint}</small></span>
        </label>`).join('')}</div>
    </fieldset>`).join('');
    syncDreamWritingControls();
}

function setDreamWritingPreference(key, value) {
    const options = key === 'style' ? DREAM_WRITING_STYLES : key === 'viewpoint' ? DREAM_WRITING_VIEWPOINTS : [];
    if (dreamGenerating || !options.some(item => item.value === value)) {
        syncDreamWritingControls();
        return false;
    }
    try {
        saveDreamWritingPreferences({ ...getDreamWritingPreferences(), [key]: value });
        setDreamStatus('');
        syncDreamWritingControls();
        return true;
    } catch (e) {
        syncDreamWritingControls();
        setDreamStatus(`选择未保存：${e.message || e}`, 'error');
        return false;
    }
}
window.setDreamWritingPreference = setDreamWritingPreference;

function renderDreamWritingCaption(record) {
    if (!record || !record.writing) return '';
    const writing = getDreamRecordWriting(record);
    const style = DREAM_WRITING_STYLES.find(item => item.value === writing.style);
    const viewpoint = DREAM_WRITING_VIEWPOINTS.find(item => item.value === writing.viewpoint);
    return `<p class="dream-writing-caption"><i class="${style.icon}" aria-hidden="true"></i>${style.label}<span aria-hidden="true">·</span>${viewpoint.label}</p>`;
}

function buildDreamWritingPrompt(value) {
    const writing = normalizeDreamWritingSettings(value);
    const style = writing.style === 'prose'
        ? '【文风：散文】从一两件具体景物、声音、气味或触感进入，让景物的变化承接心绪。长短句有呼吸，叙事与抒情自然交织，保留情节中的动作与对白。比喻少而准确，不堆砌月光、星海、温柔等抽象意象，不写成散文诗排句或景点说明。'
        : '【文风：细腻情感小说】用短而有变化的自然段、贴合人物的对白、停顿、小动作和有限心理描写推进关系。一句话没有说完、一个动作收住，都应有前因后果；情绪通过细节让读者感到，不逐句解释，不滥用脸红、心跳、咬唇等固定反应。回忆只在眼前细节触发时短暂进入，随后回到当前场景。';
    const viewpoint = {
        character: '【视角：角色第一人称】openingScene、scene 与 charAction 中的「我」始终是做梦的角色，用户以名字或「你」出现。让读者读到角色没说出口的心事、自我掩饰和判断；只能推测用户心意，不能把推测写成已知。不要切到用户的第一人称或全知旁白。',
        second: '【视角：第二人称全景】openingScene、scene 与 charAction 以「你」称呼用户，角色用姓名或他／她。叙述镜头可以展开环境与角色未说出口的心理，保持第二人称的临场感；不要替用户认定爱意、答应邀约或作出尚未选择的回应。',
        forum: '【视角：第三人称旁观者论坛体】叙述者是梦中的旁观者，角色与用户用姓名或第三人称。像自然的论坛见闻帖，带一点「我在场看见」「后来听人说」「这只是我的猜测」的转述口吻，靠目击、传闻与一两句评论拼出关系。明确区分亲眼所见、听来的事和猜测，不全知读取两人的私下心理。charAction 也写成旁观者看到或听到的动作对白，不突然换回角色独白；不输出用户名表、Markdown 楼层或额外 JSON 字段。'
    }[writing.viewpoint];
    return [
        '【共同叙事原则】角色卡、世界书和现实关系阶段优先于文风。梦可以放大情绪、改变场景与时间，不能抹掉角色的脾气、价值观、惯用表达和矛盾。保留他原本的克制、锋芒、嘴硬或直白，不把所有角色都写成体贴的恋人。',
        '从白天一件未说出口、未能完成的具体事长出梦境。按已有关系呈现求而不得、试探、吃醋、担忧或热恋时更直接的思念与情绪；不强行安排恋爱，也不一遇矛盾就互相告白。角色单方面喜欢时，可以梦到被回应，也可以梦到落空，但这些是角色的愿望与梦中经历，不代表现实中的用户已经动心。',
        '梦中进展不等于现实关系升级，梦中事件不写成现实共同记忆。进入互动后，用户是否回应、靠近或退开由用户选项决定；不要把拒绝当作同意。亲密感通过心理、对白、拥抱、亲吻和留白表现，不描写露骨性行为、性器官或未成年人性内容。',
        style,
        viewpoint,
        '所有视角下，choices 都描述用户本人的下一步反应，不替角色作决定，也不变成论坛旁观者的操作。每个选项要有实际不同的态度或行动，不能全都导向同一种亲密回应。',
        '正文按场景与情绪变化自然分段，段间用 JSON 字符串中的 \\n\\n；对白可独立成段，不把整段文字挤成一个长段落。charAction 承接场景，不能重复正文。不要照抄任何范文的句子或人物，不使用「卸下所有枷锁」「给你最确定的答案」一类通用安慰套话，不在正文输出这些写作规则、模式介绍或说教总结。'
    ].join('\n');
}

function getDreamRecords() {
    try {
        const records = JSON.parse(localStorage.getItem(DREAM_RECORDS_KEY) || '[]');
        return Array.isArray(records) ? records.filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

// Generated dream images are megabyte-sized data URLs; keeping them in localStorage
// exhausted its quota after a few dreams. They live in IndexedDB, records keep a key.
const DREAM_IMAGE_DB_NAME = 'bynd_dream_images_v1';
const DREAM_IMAGE_DB_STORE = 'images';
const DREAM_RECORD_LIMIT = 80;
const dreamImageCache = new Map();
let dreamImageMigration = null;

function isDreamQuotaError(error) {
    return !!error && (error.name === 'QuotaExceededError'
        || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        || error.code === 22
        || error.code === 1014
        || /exceeded the quota|quota/i.test(String(error.message || '')));
}

function openDreamImageDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('当前环境不支持 IndexedDB')); return; }
        const req = indexedDB.open(DREAM_IMAGE_DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(DREAM_IMAGE_DB_STORE)) req.result.createObjectStore(DREAM_IMAGE_DB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('梦境图片库打开失败'));
    });
}

async function runDreamImageTransaction(mode, action) {
    const db = await openDreamImageDb();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(DREAM_IMAGE_DB_STORE, mode);
            const request = action(tx.objectStore(DREAM_IMAGE_DB_STORE));
            let value;
            if (request) request.onsuccess = () => { value = request.result; };
            tx.oncomplete = () => resolve(value);
            tx.onerror = () => reject(tx.error || new Error('梦境图片读写失败'));
            tx.onabort = () => reject(tx.error || new Error('梦境图片读写中断'));
        });
    } finally {
        db.close();
    }
}

async function saveDreamImage(key, dataUrl) {
    await runDreamImageTransaction('readwrite', store => store.put(dataUrl, key));
    dreamImageCache.set(key, dataUrl);
    return key;
}

async function loadDreamImage(key) {
    if (!key) return '';
    if (dreamImageCache.has(key)) return dreamImageCache.get(key);
    const value = await runDreamImageTransaction('readonly', store => store.get(key));
    const url = typeof value === 'string' ? value : '';
    if (url) dreamImageCache.set(key, url);
    return url;
}

async function deleteDreamImage(key) {
    if (!key) return;
    dreamImageCache.delete(key);
    await runDreamImageTransaction('readwrite', store => store.delete(key));
}

// Records of removed characters no longer carry a copied avatar; draw an initial instead.
function getDreamRecordAvatar(record) {
    if (record && isDreamAvatarSourceUsable(record.avatar)) return record.avatar;
    return getDreamCharFallbackAvatar({ name: (record && record.charName) || '' });
}

function getDreamRecordImageKey(record) {
    return record && typeof record.imageKey === 'string' ? record.imageKey : '';
}

function isDreamInlineImage(value) {
    return /^data:image\//i.test(String(value || ''));
}

// Records keep only what the archive needs. Avatars are re-read from the character;
// a data-URL avatar copied into every record is the other quota sink.
function compactDreamRecord(record) {
    if (!record || typeof record !== 'object') return record;
    const next = { ...record };
    if (isDreamInlineImage(next.avatar)) delete next.avatar;
    return next;
}

function saveDreamRecords(records) {
    const list = (Array.isArray(records) ? records : []).filter(Boolean);
    const kept = list.slice(0, DREAM_RECORD_LIMIT).map(compactDreamRecord);
    localStorage.setItem(DREAM_RECORDS_KEY, JSON.stringify(kept));
    list.slice(DREAM_RECORD_LIMIT).forEach(record => {
        const key = getDreamRecordImageKey(record);
        if (key) deleteDreamImage(key).catch(error => console.warn('旧梦境图片清理失败', error));
    });
}

// Move legacy inline images out of localStorage. Each image is stripped only after
// IndexedDB has confirmed the write, so a failed move never loses a picture.
async function migrateDreamImagesToDb() {
    if (dreamImageMigration) return dreamImageMigration;
    dreamImageMigration = (async () => {
        const records = getDreamRecords();
        let moved = 0;
        let failed = 0;
        for (const record of records) {
            if (!isDreamInlineImage(record.imageUrl)) continue;
            const key = getDreamRecordImageKey(record) || `dream_img_${record.id || Date.now()}`;
            try {
                await saveDreamImage(key, record.imageUrl);
                record.imageKey = key;
                delete record.imageUrl;
                moved += 1;
            } catch (error) {
                failed += 1;
                console.warn('梦境图片迁移失败', error);
            }
        }
        const stripped = records.some(record => isDreamInlineImage(record.avatar));
        if (moved || stripped) saveDreamRecords(records);
        return { moved, failed };
    })().finally(() => { dreamImageMigration = null; });
    return dreamImageMigration;
}

async function resolveDreamRecordImage(record) {
    if (!record) return '';
    if (isDreamInlineImage(record.imageUrl)) return record.imageUrl;
    const key = getDreamRecordImageKey(record);
    if (!key) return '';
    try {
        return await loadDreamImage(key);
    } catch (error) {
        console.warn('梦境图片读取失败', error);
        return '';
    }
}

function getDreamCharacters() {
    let characters = [];
    if (typeof getWechatSortedChatCharacters === 'function') {
        characters = getWechatSortedChatCharacters();
    } else if (typeof getWechatGroupContacts === 'function') {
        characters = getWechatGroupContacts({ includeGroupNpc: false });
    } else if (Array.isArray(window.myCharacters)) {
        characters = window.myCharacters;
    }
    return characters.filter(char => (
        char
        && char.id
        && !char.isGroupChat
        && !(typeof isWechatGroupNpcContact === 'function'
            ? isWechatGroupNpcContact(char)
            : (char.isGroupNpc || char.groupNpc || char.npcOriginGroupId))
    ));
}

function getDreamCharName(char) {
    if (typeof getWechatCharDisplayName === 'function') return getWechatCharDisplayName(char);
    return (char && char.chatConfig && char.chatConfig.nickname) || (char && char.name) || '对方';
}

function getDreamCharFallbackAvatar(char) {
    const name = getDreamCharName(char).trim();
    const initial = Array.from(name)[0] || '梦';
    return 'data:image/svg+xml,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="100" fill="#f3f3f0"/><text x="100" y="112" text-anchor="middle" font-family="serif" font-size="72" font-weight="700" fill="#0a0a0a">${initial.replace(/[<>&"']/g, '')}</text></svg>`
    );
}

function isDreamAvatarSourceUsable(value) {
    const source = String(value || '').trim();
    if (!source || source === 'undefined' || source === 'null') return false;
    if (/^data:image\//i.test(source) || /^blob:/i.test(source)) return true;
    try {
        const candidate = new URL(source, window.location.href);
        const current = new URL(window.location.href);
        if (candidate.origin === current.origin && candidate.pathname === '/' && !candidate.search && !candidate.hash) return false;
    } catch (_) {
        return false;
    }
    return true;
}

function getDreamCharAvatar(char) {
    const fallback = getDreamCharFallbackAvatar(char);
    const source = typeof getWechatCharAvatarSource === 'function'
        ? getWechatCharAvatarSource(char, '')
        : (char && char.avatar);
    return isDreamAvatarSourceUsable(source) ? source : fallback;
}

function getDreamCharReferenceImage(char) {
    const source = typeof getWechatImageReferenceForChar === 'function'
        ? getWechatImageReferenceForChar(char)
        : ((char && char.chatConfig && char.chatConfig.imageReference) || (char && char.avatar));
    if (!isDreamAvatarSourceUsable(source) || source === window.DEFAULT_AVATAR) return '';
    return source;
}

function getDreamTimeText(ts) {
    if (typeof formatWechatRelativeTime === 'function') return formatWechatRelativeTime(ts);
    const date = new Date(ts || Date.now());
    return Number.isNaN(date.getTime()) ? '刚刚' : `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function setDreamStatus(text, tone = '') {
    const el = document.getElementById('dream-status');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.tone = tone || '';
}

function extractDreamJsonPayload(text) {
    if (typeof parseWechatJsonObject === 'function') return parseWechatJsonObject(text);
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

function getDreamPromptContext(char) {
    const userProfile = typeof getWechatChatUserProfile === 'function'
        ? getWechatChatUserProfile(char)
        : (typeof getUserProfile === 'function' ? getUserProfile() : {});
    const identity = typeof buildWechatIdentityContextPrompt === 'function'
        ? buildWechatIdentityContextPrompt(char, userProfile)
        : '';
    const persona = typeof getWechatCharacterPersonaText === 'function'
        ? getWechatCharacterPersonaText(char, 12000)
        : String(char && char.description || '').trim();
    const memory = typeof buildWechatMemoryPrompt === 'function' ? buildWechatMemoryPrompt(char) : '';
    const recent = typeof buildWechatRecentHistoryForPrompt === 'function'
        ? buildWechatRecentHistoryForPrompt(char, 18)
        : '';
    return { userProfile, identity, persona, memory, recent };
}

function buildDreamGenerationMessages(char, writing = getDreamWritingPreferences()) {
    const context = getDreamPromptContext(char);
    const charName = getDreamCharName(char);
    const userName = context.userProfile.name || '用户';
    return [
        {
            role: 'system',
            content: [
                '你是 BYND 的梦境叙事引擎。只输出一个严格 JSON 对象，不要解释，不要 Markdown。',
                'JSON 必须且只能包含：title、summary、intent、openingScene、charAction、choices、imagePrompt。',
                'title 是简短梦名；summary 是梦境梗概；intent 是角色在白日未完成、想在梦里对用户继续做的事；openingScene 是用户刚进入梦境时看见的场景叙述；charAction 是角色入梦后的第一个主动动作或对白；choices 是由 2 到 4 个非空字符串组成的数组，每项都是用户对该动作的反应；imagePrompt 是梦境主视觉生成提示。',
                `梦境的主导者是 ${charName}，${charName} 的愿望、犹豫与行动推动情节；用户只能选择自己的反应，不能替 ${charName} 做决定。`,
                '必须忠于角色卡、世界书、关系记忆和聊天上下文。只有资料中明确发生过的事才能写成既成事实；推断出的未完成念头必须写成角色的梦中愿望、担忧或假设，不能伪造共同经历。',
                'title 用简短而具体的梦名；summary 约 50 到 100 字；openingScene 用 4 到 7 个自然段、约 260 到 480 字；charAction 约 40 到 100 字；imagePrompt 只描写适合展示的梦境环境与角色形象。',
                buildDreamWritingPrompt(writing)
            ].join('\n')
        },
        {
            role: 'user',
            content: [
                context.identity,
                context.persona ? `【角色卡与世界设定】\n${context.persona}` : '',
                context.memory,
                context.recent ? `【最近聊天上下文】\n${context.recent}` : '',
                `请生成由 ${charName} 主导、${userName} 可以进入并互动的梦境开场。严格输出指定 JSON。`
            ].filter(Boolean).join('\n\n')
        }
    ];
}

function normalizeDreamChoices(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean);
}

function validateDreamGenerationPayload(payload) {
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('AI 返回的梦境格式不是 JSON 对象');
    const normalized = {
        title: String(payload.title || '').trim(),
        summary: String(payload.summary || '').trim(),
        intent: String(payload.intent || '').trim(),
        openingScene: String(payload.openingScene || '').trim(),
        charAction: String(payload.charAction || '').trim(),
        choices: normalizeDreamChoices(payload.choices),
        imagePrompt: String(payload.imagePrompt || '').trim()
    };
    const missing = ['title', 'summary', 'intent', 'openingScene', 'charAction', 'imagePrompt'].filter(key => !normalized[key]);
    if (missing.length) throw new Error(`AI 返回缺少字段：${missing.join('、')}`);
    if (normalized.choices.length < 2 || normalized.choices.length > 4) throw new Error('AI 返回的 choices 必须是 2 到 4 个非空选项');
    return normalized;
}

function validateDreamTurnPayload(payload) {
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('AI 返回的互动格式不是 JSON 对象');
    const normalized = {
        scene: String(payload.scene || '').trim(),
        charAction: String(payload.charAction || '').trim(),
        choices: normalizeDreamChoices(payload.choices),
        isEnding: payload.isEnding === true,
        endingTitle: String(payload.endingTitle || '').trim()
    };
    if (!normalized.scene) throw new Error('AI 返回缺少 scene');
    if (!normalized.charAction) throw new Error('AI 返回缺少 charAction');
    if (normalized.isEnding) {
        if (!normalized.endingTitle) throw new Error('梦境结束时必须返回 endingTitle');
        if (normalized.choices.length > 4) throw new Error('AI 返回了过多结局选项');
    } else if (normalized.choices.length < 2 || normalized.choices.length > 4) {
        throw new Error('未结束的互动必须返回 2 到 4 个 choices');
    }
    return normalized;
}

function getDreamRecordById(id) {
    return getDreamRecords().find(record => record && record.id === id) || null;
}

function updateDreamRecord(id, updater) {
    const records = getDreamRecords();
    const index = records.findIndex(record => record && record.id === id);
    if (index < 0) return null;
    const next = typeof updater === 'function' ? updater(records[index]) : updater;
    if (!next) return null;
    records[index] = next;
    saveDreamRecords(records);
    return next;
}

function renderDreamEmpty() {
    return '<div class="dream-empty"><i class="ri-archive-line"></i><strong>还没有梦境档案</strong><span>返回选择角色，生成第一段梦境。</span></div>';
}

function renderDreamList() {
    const list = document.getElementById('dream-list');
    if (!list) return;
    const records = getDreamRecords().sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
    if (!records.length) {
        list.innerHTML = renderDreamEmpty();
        return;
    }
    list.innerHTML = records.map(record => {
        const char = getDreamCharacters().find(item => item.id === record.charId);
        const charName = char ? getDreamCharName(char) : record.charName;
        const avatar = char ? getDreamCharAvatar(char) : getDreamRecordAvatar(record);
        return `
        <article class="dream-record">
            <img class="dream-record-avatar" src="${musicEscapeAttr(avatar || '')}" alt="">
            <div class="dream-record-body">
                <div class="dream-record-meta">
                    <span>${musicEscapeHtml(charName || '角色已移除')}</span>
                    <em>${musicEscapeHtml(getDreamTimeText(record.createdAt))}</em>
                </div>
                ${record.title ? `<strong>${musicEscapeHtml(record.title)}</strong>` : '<strong>旧记录内容不完整</strong>'}
                ${record.summary || record.text ? `<p>${musicEscapeHtml(record.summary || record.text)}</p>` : ''}
                <button type="button" class="dream-record-enter" onclick="enterDreamRecord('${musicEscapeAttr(record.id)}')"><i class="ri-footprint-line"></i><span>${record.session ? (record.session.status === 'ended' ? '查看结局' : '继续入梦') : '进入梦境'}</span></button>
            </div>
            <button type="button" class="dream-record-open" onclick="openDreamPreview('${musicEscapeAttr(record.id)}')" aria-label="查看梦境"><i class="ri-arrow-right-line"></i></button>
            <button type="button" class="dream-delete" onclick="deleteDreamRecord('${musicEscapeAttr(record.id)}')" aria-label="删除梦境"><i class="ri-delete-bin-line"></i></button>
        </article>
    `;
    }).join('');
}

function showDreamView(viewId) {
    document.querySelectorAll('#app-dream-window .dream-view').forEach(view => {
        view.classList.toggle('hidden', view.id !== viewId);
    });
}

function getDreamSelectedCharacter() {
    const chars = getDreamCharacters();
    return chars.find(char => char.id === dreamSelectedCharId) || chars[0] || null;
}

function getLatestDreamRecord(charId = '') {
    return getDreamRecords()
        .filter(record => !charId || record.charId === charId)
        .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))[0] || null;
}

function renderDreamLatestLink() {
    const link = document.getElementById('dream-latest-link');
    const title = document.getElementById('dream-latest-title');
    if (!link || !title) return;
    const latest = getLatestDreamRecord(dreamSelectedCharId);
    link.classList.toggle('hidden', !latest);
    title.textContent = latest ? (latest.title || '内容不完整，打开查看') : '';
}

function renderDreamCharacterStrip() {
    const strip = document.getElementById('dream-char-strip');
    const count = document.getElementById('dream-char-count');
    const chars = getDreamCharacters();
    const selected = getDreamSelectedCharacter();
    if (selected) dreamSelectedCharId = selected.id;
    if (count) count.textContent = chars.length ? `${chars.length} CHARACTERS` : '';
    if (strip) {
        strip.innerHTML = chars.length ? chars.map(char => {
            const active = char.id === dreamSelectedCharId;
            const name = getDreamCharName(char);
            const avatar = getDreamCharAvatar(char);
            const fallback = getDreamCharFallbackAvatar(char);
            return `<button type="button" class="dream-char-item${active ? ' active' : ''}" onclick="selectDreamChar('${musicEscapeAttr(char.id)}')" aria-label="选择 ${musicEscapeAttr(name)}" aria-pressed="${active}">
                <img src="${musicEscapeAttr(avatar)}" data-fallback="${musicEscapeAttr(fallback)}" alt="" onerror="this.onerror=null;this.src=this.dataset.fallback">
                <span>${musicEscapeHtml(name)}</span>
            </button>`;
        }).join('') : '<p class="dream-no-characters">小手机里还没有可用角色</p>';
    }
    const avatar = document.getElementById('dream-selected-avatar');
    const name = document.getElementById('dream-selected-name');
    const generateButton = document.getElementById('dream-generate-button');
    if (avatar) {
        const fallback = selected ? getDreamCharFallbackAvatar(selected) : '';
        avatar.onerror = selected ? () => {
            avatar.onerror = null;
            avatar.src = fallback;
        } : null;
        avatar.src = selected ? getDreamCharAvatar(selected) : '';
        avatar.alt = selected ? getDreamCharName(selected) : '';
        avatar.classList.toggle('hidden', !selected);
    }
    if (name) name.textContent = selected ? getDreamCharName(selected) : '请先在小手机中添加角色';
    if (generateButton) generateButton.disabled = !selected || dreamGenerating;
    renderDreamLatestLink();
}

function initDreamApp() {
    const chars = getDreamCharacters();
    if (!chars.some(char => char.id === dreamSelectedCharId)) dreamSelectedCharId = chars[0]?.id || '';
    setDreamStatus(chars.length ? '' : '小手机里还没有可生成梦境的角色。', chars.length ? '' : 'warn');
    showDreamEntry();
    renderDreamList();
    if (getDreamRecords().some(record => isDreamInlineImage(record.imageUrl) || isDreamInlineImage(record.avatar))) {
        migrateDreamImagesToDb().then(result => {
            if (result.moved) renderDreamList();
        }).catch(error => console.warn('梦境图片迁移失败', error));
    }
}
window.initDreamApp = initDreamApp;

function showDreamEntry() {
    dreamPreviewRecordId = '';
    showDreamView('dream-entry-view');
    renderDreamCharacterStrip();
    renderDreamWritingControls();
}
window.showDreamEntry = showDreamEntry;

function selectDreamChar(charId) {
    if (!getDreamCharacters().some(char => char.id === charId)) return false;
    dreamSelectedCharId = charId;
    renderDreamCharacterStrip();
    return false;
}
window.selectDreamChar = selectDreamChar;

function openLatestDreamPreview() {
    const record = getLatestDreamRecord(dreamSelectedCharId);
    if (record) openDreamPreview(record.id);
}
window.openLatestDreamPreview = openLatestDreamPreview;

function renderDreamPreview(record) {
    const content = document.getElementById('dream-preview-content');
    if (!content || !record) return;
    const char = getDreamCharacters().find(item => item.id === record.charId);
    const charName = char ? getDreamCharName(char) : record.charName;
    const avatar = char ? getDreamCharAvatar(char) : getDreamRecordAvatar(record);
    const complete = !!(record.title && record.summary && record.intent && record.openingScene && record.charAction && normalizeDreamChoices(record.choices).length >= 2);
    const session = record.session && typeof record.session === 'object' ? record.session : null;
    const actionLabel = session ? (session.status === 'ended' ? '查看结局' : '继续入梦') : (complete ? '进入梦境' : '由 AI 重建入口并入梦');
    const previewText = record.summary || record.text || '';
    const inlineImage = isDreamInlineImage(record.imageUrl) ? record.imageUrl : '';
    const cachedImage = inlineImage || dreamImageCache.get(getDreamRecordImageKey(record)) || '';
    const pendingImage = !cachedImage && !!getDreamRecordImageKey(record);
    content.innerHTML = `
        <div class="dream-preview-media${cachedImage ? '' : ' avatar-only'}${pendingImage ? ' loading' : ''}" id="dream-preview-media">
            <img src="${musicEscapeAttr(cachedImage || avatar || '')}" alt="">
        </div>
        <div class="dream-preview-identity">
            <img src="${musicEscapeAttr(avatar || '')}" alt="">
            <span><em>DREAMER</em><strong>${musicEscapeHtml(charName || '角色已移除')}</strong></span>
            <time>${musicEscapeHtml(getDreamTimeText(record.createdAt))}</time>
        </div>
        ${record.title ? `<h2>${musicEscapeHtml(record.title)}</h2>` : '<p class="dream-incomplete">这条旧记录缺少标题，需要由 AI 重建入梦入口。</p>'}
        ${renderDreamWritingCaption(record)}
        ${previewText ? `<section class="dream-preview-section"><span>THE DREAM</span><p>${musicEscapeHtml(previewText)}</p></section>` : ''}
        ${record.openingScene ? `<section class="dream-preview-section"><span>OPENING SCENE</span><p>${musicEscapeHtml(record.openingScene)}</p></section>` : ''}
        ${record.imageError ? `<p class="dream-image-error">梦境图生成失败：${musicEscapeHtml(record.imageError)}</p>` : ''}
        <p class="dream-preview-status" id="dream-preview-status" role="status"></p>
        <div class="dream-preview-actions">
            <button type="button" class="dream-primary-button" id="dream-enter-button" onclick="enterDreamRecord('${musicEscapeAttr(record.id)}')"><i class="ri-footprint-line"></i><span>${musicEscapeHtml(actionLabel)}</span></button>
            ${char ? `<button type="button" class="dream-secondary-button" onclick="prepareDreamRegeneration('${musicEscapeAttr(record.id)}', true)"><i class="ri-refresh-line"></i><span>重新生成</span></button>
            <button type="button" class="dream-secondary-button" onclick="openDreamRecordInComic('${musicEscapeAttr(record.id)}')"><i class="ri-booklet-line"></i><span>画成漫画</span></button>
            <button type="button" class="dream-writing-edit" onclick="prepareDreamRegeneration('${musicEscapeAttr(record.id)}')"><i class="ri-quill-pen-line"></i><span>调整文风与视角</span></button>` : ''}
        </div>`;
}

function openDreamPreview(id) {
    const record = getDreamRecordById(id);
    if (!record) return;
    dreamPreviewRecordId = id;
    renderDreamPreview(record);
    showDreamView('dream-preview-view');
    const key = getDreamRecordImageKey(record);
    if (key && !dreamImageCache.has(key) && !isDreamInlineImage(record.imageUrl)) {
        resolveDreamRecordImage(record).then(url => {
            if (dreamPreviewRecordId !== id) return;
            const media = document.getElementById('dream-preview-media');
            const img = media && media.querySelector('img');
            if (!media || !img) return;
            media.classList.remove('loading');
            if (!url) return;
            media.classList.remove('avatar-only');
            img.src = url;
        });
    }
}
window.openDreamPreview = openDreamPreview;

function openDreamRecordInComic(recordId) {
    const record = getDreamRecordById(recordId);
    if (!record) return;
    window.ByndComic?.fromSource('dream', record.charId, [record.title, record.summary, record.openingScene, record.charAction].filter(Boolean).join('\n\n'));
}
window.openDreamRecordInComic = openDreamRecordInComic;

function prepareDreamRegeneration(id, generateNow = false) {
    if (dreamGenerating) return false;
    const record = getDreamRecordById(id);
    if (!record || !getDreamCharacters().some(char => char.id === record.charId)) return false;
    try {
        saveDreamWritingPreferences(getDreamRecordWriting(record));
    } catch (e) {
        setDreamPreviewStatus(`选择未保存：${e.message || e}`, 'error');
        return false;
    }
    dreamSelectedCharId = record.charId;
    showDreamEntry();
    setDreamStatus('');
    if (generateNow) generateDreamRecord();
    return true;
}
window.prepareDreamRegeneration = prepareDreamRegeneration;

async function generateDreamRecord() {
    if (dreamGenerating) return;
    const char = getDreamSelectedCharacter();
    if (!char) {
        setDreamStatus('小手机里还没有可生成梦境的角色。', 'warn');
        return;
    }
    if (typeof callChatApi !== 'function') {
        setDreamStatus('聊天 API 模块没有加载，无法生成梦境文字。', 'error');
        return;
    }
    const writing = getDreamWritingPreferences();
    dreamGenerating = true;
    renderDreamCharacterStrip();
    syncDreamWritingControls();
    setDreamStatus('正在读取角色记忆与最近聊天...', 'busy');
    try {
        const result = await callChatApi(buildDreamGenerationMessages(char, writing), { temperature: 0.86, max_tokens: 2600, usageFeature: 'dream', usageChar: char });
        if (!result.ok) throw new Error(result.error || '梦境文字生成失败');
        const payload = validateDreamGenerationPayload(extractDreamJsonPayload(result.content));

        let imageUrl = '';
        let imageError = '';
        if (typeof callWechatImageGenerationApi === 'function') {
            setDreamStatus('梦境已经成形，正在生成梦境图...', 'busy');
            const imageResult = await callWechatImageGenerationApi(
                payload.imagePrompt,
                { referenceImage: getDreamCharReferenceImage(char), size: '1024x1024', usageChar: char }
            );
            if (imageResult.ok && imageResult.url) imageUrl = imageResult.url;
            else imageError = imageResult.error || '图片接口没有返回图片';
        } else {
            imageError = '未找到生图 API 函数';
        }

        const id = `dream_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
        let imageKey = '';
        if (imageUrl) {
            setDreamStatus('正在保存梦境图...', 'busy');
            try {
                imageKey = await saveDreamImage(`dream_img_${id}`, imageUrl);
            } catch (error) {
                imageError = `梦境图未能保存到本机：${error.message || error}`;
                console.warn('梦境图片保存失败', error);
            }
        }
        const record = {
            id,
            charId: char.id,
            charName: getDreamCharName(char),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            ...payload,
            writing,
            imageKey,
            imageError,
            session: null
        };
        try {
            await saveDreamRecordWithRecovery(record);
        } catch (error) {
            if (imageKey) await deleteDreamImage(imageKey).catch(() => {});
            throw error;
        }
        renderDreamList();
        setDreamStatus('');
        openDreamPreview(record.id);
    } catch (e) {
        setDreamStatus(`生成失败：${describeDreamSaveError(e)}`, 'error');
    } finally {
        dreamGenerating = false;
        renderDreamCharacterStrip();
        syncDreamWritingControls();
    }
}
window.generateDreamRecord = generateDreamRecord;

function describeDreamSaveError(error) {
    if (isDreamQuotaError(error)) return '本机存储空间不足，梦境没有保存。请删除一些旧梦境或清理其它数据后重试。';
    return error && error.message ? error.message : String(error);
}

// Prepend the new record; if localStorage is full, first move legacy inline images
// out of it and try once more. The record is never reported saved unless setItem succeeded.
async function saveDreamRecordWithRecovery(record) {
    try {
        saveDreamRecords([record, ...getDreamRecords()]);
        return;
    } catch (error) {
        if (!isDreamQuotaError(error)) throw error;
        const result = await migrateDreamImagesToDb().catch(() => ({ moved: 0, failed: 1 }));
        if (!result.moved && !getDreamRecords().some(item => isDreamInlineImage(item.avatar))) throw error;
    }
    saveDreamRecords([record, ...getDreamRecords()]);
}

function buildDreamInteractionMessages(char, record, session, selectedChoice = '', bootstrap = false) {
    const context = getDreamPromptContext(char);
    const transcript = Array.isArray(session && session.turns) ? session.turns.slice(-16).map((turn, index) => [
        `第 ${index + 1} 轮用户反应：${turn.choice}`,
        `场景推进：${turn.scene}`,
        `角色行动/对白：${turn.charAction}`,
        turn.isEnding ? `结局：${turn.endingTitle}` : ''
    ].filter(Boolean).join('\n')).join('\n\n') : '';
    const recordSource = {
        title: record.title || '',
        summary: record.summary || record.text || '',
        intent: record.intent || '',
        openingScene: record.openingScene || '',
        charAction: record.charAction || '',
        choices: normalizeDreamChoices(record.choices)
    };
    const currentState = session && session.currentScene ? {
        scene: session.currentScene,
        charAction: session.currentCharAction || '',
        choices: normalizeDreamChoices(session.options || session.choices)
    } : null;
    return [
        {
            role: 'system',
            content: [
                '你是 BYND 的梦境互动叙事引擎。只输出一个严格 JSON 对象，不要解释，不要 Markdown。',
                'JSON 必须且只能包含：scene、charAction、choices、isEnding、endingTitle。',
                'scene 是新的场景叙述；charAction 是角色主动完成的动作、对白或情绪推进；choices 是由 2 到 4 个非空字符串组成的数组，每项都是用户可以选择的反应；isEnding 是布尔值；只有 isEnding=true 时 endingTitle 才能是非空结局名。',
                `情节必须由 ${getDreamCharName(char)} 的未完成意图推动。选项描述用户如何回应当前角色行动，不能替角色选择、说话或行动。`,
                '严格延续原梦境和已发生的互动，不跳出角色，不把资料里不存在的现实往事写成事实，不复述提示词。',
                'scene 用 3 到 6 个自然段、约 180 到 360 字推进当前一幕；charAction 保留一个清晰的回应节点。不要无限拖延：在合适的情节节点可以自然结束梦境。',
                buildDreamWritingPrompt(getDreamRecordWriting(record))
            ].join('\n')
        },
        {
            role: 'user',
            content: [
                context.identity,
                context.persona ? `【角色卡与世界设定】\n${context.persona}` : '',
                context.memory,
                context.recent ? `【现实中的最近聊天，仅作梦境来源】\n${context.recent}` : '',
                `【原梦境档案】\n${JSON.stringify(recordSource, null, 2)}`,
                transcript ? `【已发生的入梦互动】\n${transcript}` : '',
                currentState ? `【当前互动状态】\n${JSON.stringify(currentState, null, 2)}` : '',
                bootstrap
                    ? '这是一条旧梦境记录，缺少可互动入口。请依据现有档案和角色真实上下文重建第一个可互动场景。'
                    : `【用户本轮选择的反应】\n${selectedChoice}\n请推进下一幕。`
            ].filter(Boolean).join('\n\n')
        }
    ];
}

function createDreamSessionFromRecord(record) {
    return {
        status: 'active',
        startedAt: Date.now(),
        updatedAt: Date.now(),
        currentScene: record.openingScene,
        currentCharAction: record.charAction,
        choices: normalizeDreamChoices(record.choices),
        options: normalizeDreamChoices(record.choices),
        turns: [],
        endingTitle: ''
    };
}

function setDreamPreviewStatus(text, tone = '') {
    const el = document.getElementById('dream-preview-status');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.tone = tone || '';
}

function setDreamSessionStatus(text, tone = '') {
    const el = document.getElementById('dream-session-status');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.tone = tone || '';
}

async function enterDreamRecord(id) {
    if (dreamEntering || dreamAdvancing) return;
    let record = getDreamRecordById(id);
    if (!record) return;
    const previewView = document.getElementById('dream-preview-view');
    if (!previewView || previewView.classList.contains('hidden')) {
        openDreamPreview(id);
        record = getDreamRecordById(id);
        if (!record) return;
    }
    const char = getDreamCharacters().find(item => item.id === record.charId);
    if (!char) {
        setDreamPreviewStatus('角色已从小手机删除，无法继续生成互动。', 'error');
        return;
    }
    dreamActiveRecordId = id;
    if (record.session && record.session.currentScene) {
        renderDreamSession(record);
        showDreamView('dream-session-view');
        return;
    }
    const complete = !!(record.openingScene && record.charAction && normalizeDreamChoices(record.choices).length >= 2);
    if (complete) {
        try {
            record = updateDreamRecord(id, current => ({ ...current, updatedAt: Date.now(), session: createDreamSessionFromRecord(current) }));
            renderDreamSession(record);
            showDreamView('dream-session-view');
            renderDreamList();
        } catch (e) {
            setDreamPreviewStatus(`入梦未保存：${e.message || e}`, 'error');
        }
        return;
    }
    if (!(record.summary || record.text)) {
        setDreamPreviewStatus('这条旧记录缺少可用于重建的正文，请重新生成梦境。', 'error');
        return;
    }
    if (typeof callChatApi !== 'function') {
        setDreamPreviewStatus('聊天 API 模块没有加载，无法重建入梦入口。', 'error');
        return;
    }
    dreamEntering = true;
    const button = document.getElementById('dream-enter-button');
    if (button) button.disabled = true;
    setDreamPreviewStatus('正在由 AI 重建这条旧梦境的互动入口...', 'busy');
    try {
        const result = await callChatApi(buildDreamInteractionMessages(char, record, null, '', true), { temperature: 0.82, max_tokens: 1800, usageFeature: 'dream', usageChar: char });
        if (!result.ok) throw new Error(result.error || '入梦入口重建失败');
        const payload = validateDreamTurnPayload(extractDreamJsonPayload(result.content));
        const session = {
            status: payload.isEnding ? 'ended' : 'active',
            startedAt: Date.now(),
            updatedAt: Date.now(),
            currentScene: payload.scene,
            currentCharAction: payload.charAction,
            choices: payload.choices,
            options: payload.choices,
            turns: [],
            endingTitle: payload.endingTitle
        };
        record = updateDreamRecord(id, current => ({ ...current, updatedAt: Date.now(), session }));
        renderDreamSession(record);
        showDreamView('dream-session-view');
        renderDreamList();
    } catch (e) {
        setDreamPreviewStatus(`重建失败：${e.message || e}`, 'error');
    } finally {
        dreamEntering = false;
        if (button) button.disabled = false;
    }
}
window.enterDreamRecord = enterDreamRecord;

function renderDreamSession(record) {
    const content = document.getElementById('dream-session-content');
    const title = document.getElementById('dream-session-header-title');
    if (!content || !record || !record.session) return;
    const char = getDreamCharacters().find(item => item.id === record.charId);
    const charName = char ? getDreamCharName(char) : record.charName;
    const avatar = char ? getDreamCharAvatar(char) : getDreamRecordAvatar(record);
    const session = record.session;
    const ended = session.status === 'ended';
    if (title) title.textContent = record.title || '入梦';
    content.innerHTML = `
        <div class="dream-session-identity">
            <img src="${musicEscapeAttr(avatar || '')}" alt="">
            <span><em>DREAMER</em><strong>${musicEscapeHtml(charName || '角色已移除')}</strong></span>
            <small>${Array.isArray(session.turns) ? session.turns.length + 1 : 1}</small>
        </div>
        ${renderDreamWritingCaption(record)}
        <article class="dream-scene">
            <span>SCENE</span>
            ${ended && session.endingTitle ? `<h2>${musicEscapeHtml(session.endingTitle)}</h2>` : ''}
            <p>${musicEscapeHtml(session.currentScene || '')}</p>
        </article>
        ${session.currentCharAction ? `<section class="dream-char-action"><span>${musicEscapeHtml(charName || '角色')}</span><p>${musicEscapeHtml(session.currentCharAction)}</p></section>` : ''}
        <p class="dream-session-status" id="dream-session-status" role="status"></p>
        ${ended ? `<button type="button" class="dream-primary-button" onclick="exitDreamSession()"><i class="ri-sun-line"></i><span>醒来</span></button>` : `
            <div class="dream-choice-list" aria-label="选择你的反应">
                ${normalizeDreamChoices(session.options || session.choices).map((choice, index) => `<button type="button" onclick="advanceDreamSession(${index})"><span>${musicEscapeHtml(choice)}</span><i class="ri-arrow-right-line"></i></button>`).join('')}
            </div>`}
    `;
}

async function advanceDreamSession(choiceIndex) {
    if (dreamAdvancing || dreamEntering) return;
    let record = getDreamRecordById(dreamActiveRecordId);
    if (!record || !record.session || record.session.status === 'ended') return;
    const char = getDreamCharacters().find(item => item.id === record.charId);
    if (!char) {
        setDreamSessionStatus('角色已从小手机删除，无法继续梦境。', 'error');
        return;
    }
    const choices = normalizeDreamChoices(record.session.options || record.session.choices);
    const selectedChoice = choices[Number(choiceIndex)];
    if (!selectedChoice) return;
    if (typeof callChatApi !== 'function') {
        setDreamSessionStatus('聊天 API 模块没有加载，无法继续梦境。', 'error');
        return;
    }
    dreamAdvancing = true;
    document.querySelectorAll('#dream-session-content button').forEach(button => button.disabled = true);
    setDreamSessionStatus('梦境正在回应你的选择...', 'busy');
    try {
        const result = await callChatApi(buildDreamInteractionMessages(char, record, record.session, selectedChoice, false), { temperature: 0.86, max_tokens: 1800, usageFeature: 'dream', usageChar: char });
        if (!result.ok) throw new Error(result.error || '梦境推进失败');
        const payload = validateDreamTurnPayload(extractDreamJsonPayload(result.content));
        record = updateDreamRecord(record.id, current => {
            const previousSession = current.session || {};
            const turns = Array.isArray(previousSession.turns) ? previousSession.turns.slice() : [];
            turns.push({
                choice: selectedChoice,
                scene: payload.scene,
                charAction: payload.charAction,
                choices: payload.choices,
                isEnding: payload.isEnding,
                endingTitle: payload.endingTitle,
                createdAt: Date.now()
            });
            return {
                ...current,
                updatedAt: Date.now(),
                session: {
                    ...previousSession,
                    status: payload.isEnding ? 'ended' : 'active',
                    updatedAt: Date.now(),
                    currentScene: payload.scene,
                    currentCharAction: payload.charAction,
                    choices: payload.choices,
                    options: payload.choices,
                    turns,
                    endingTitle: payload.endingTitle
                }
            };
        });
        renderDreamSession(record);
        renderDreamList();
    } catch (e) {
        setDreamSessionStatus(`推进失败：${e.message || e}`, 'error');
        document.querySelectorAll('#dream-session-content button').forEach(button => button.disabled = false);
    } finally {
        dreamAdvancing = false;
    }
}
window.advanceDreamSession = advanceDreamSession;

function exitDreamSession() {
    const id = dreamActiveRecordId;
    dreamActiveRecordId = '';
    if (id && getDreamRecordById(id)) openDreamPreview(id);
    else showDreamArchive();
}
window.exitDreamSession = exitDreamSession;

function showDreamArchive() {
    renderDreamList();
    showDreamView('dream-archive-view');
}
window.showDreamArchive = showDreamArchive;

function deleteDreamRecord(id) {
    const record = getDreamRecords().find(item => item.id === id);
    if (!record) return;
    if (!confirm(`删除「${record.title || '这条梦境'}」？`)) return;
    saveDreamRecords(getDreamRecords().filter(item => item.id !== id));
    const imageKey = getDreamRecordImageKey(record);
    if (imageKey) deleteDreamImage(imageKey).catch(error => console.warn('梦境图片删除失败', error));
    if (dreamPreviewRecordId === id || dreamActiveRecordId === id) {
        dreamPreviewRecordId = '';
        dreamActiveRecordId = '';
        showDreamArchive();
    }
    renderDreamList();
    setDreamStatus('已删除一条梦境档案。', 'done');
}
window.deleteDreamRecord = deleteDreamRecord;

