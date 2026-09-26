// --- D. 本地存储：角色数据持久化 ---

function getWechatCharacterStorageMeta() {
    try {
        const meta = JSON.parse(localStorage.getItem(WECHAT_CHARACTERS_META_KEY) || '{}');
        return meta && typeof meta === 'object' ? meta : {};
    } catch (e) {
        return {};
    }
}

function setWechatCharacterStorageMeta(meta) {
    try {
        localStorage.setItem(WECHAT_CHARACTERS_META_KEY, JSON.stringify(meta || {}));
        return true;
    } catch (e) {
        console.warn('角色存储状态写入失败', e);
        return false;
    }
}

function openWechatCharactersDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('当前浏览器不支持 IndexedDB'));
            return;
        }
        const req = indexedDB.open(WECHAT_CHARACTERS_DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(WECHAT_CHARACTERS_DB_STORE)) {
                req.result.createObjectStore(WECHAT_CHARACTERS_DB_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'));
    });
}

async function saveWechatCharactersToIndexedDb(characters, updatedAt = Date.now()) {
    const db = await openWechatCharactersDB();
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(WECHAT_CHARACTERS_DB_STORE, 'readwrite');
            tx.oncomplete = () => { db.close(); resolve({ updatedAt, characters }); };
            tx.onerror = tx.onabort = () => {
                db.close();
                reject(tx.error || new Error('IndexedDB 写入失败'));
            };
            tx.objectStore(WECHAT_CHARACTERS_DB_STORE).put({ updatedAt, characters }, WECHAT_CHARACTERS_DB_KEY);
        } catch (error) {
            db.close();
            reject(error);
        }
    });
}
window.saveWechatCharactersToIndexedDb = saveWechatCharactersToIndexedDb;

async function loadWechatCharactersFromIndexedDb() {
    const db = await openWechatCharactersDB();
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(WECHAT_CHARACTERS_DB_STORE, 'readonly');
            let record = null;
            tx.oncomplete = () => { db.close(); resolve(record); };
            tx.onerror = tx.onabort = () => {
                db.close();
                reject(tx.error || new Error('IndexedDB 读取失败'));
            };
            const req = tx.objectStore(WECHAT_CHARACTERS_DB_STORE).get(WECHAT_CHARACTERS_DB_KEY);
            req.onsuccess = () => { record = req.result || null; };
        } catch (error) {
            db.close();
            reject(error);
        }
    });
}
window.loadWechatCharactersFromIndexedDb = loadWechatCharactersFromIndexedDb;

function sanitizeWechatChatConfigForStorage(config = {}) {
    const safe = config && typeof config === 'object' ? { ...config } : {};
    const source = safe.voiceBinding && typeof safe.voiceBinding === 'object' ? safe.voiceBinding : {};
    const provider = ['minimax', 'openai', 'fish-audio', 'elevenlabs', 'local'].includes(source.provider)
        ? source.provider
        : '';
    const voiceBinding = provider ? {
        provider,
        voiceModel: String(source.voiceModel || source.model || '').trim().slice(0, 160),
        voiceId: String(source.voiceId || source.voice || source.referenceId || '').trim().slice(0, 240)
    } : null;
    if (voiceBinding) safe.voiceBinding = voiceBinding;
    else delete safe.voiceBinding;
    return safe;
}

function compactWechatChatConfigForLocal(config = {}) {
    const compact = sanitizeWechatChatConfigForStorage(config);
    [
        'chatBgImage',
        'chatBgGallery',
        'imageReference',
        'videoCallBg',
        'momentCovers',
        'xCover',
        'lineCover',
        'telegramCover',
        'customWallpaper',
        'backgroundImage',
        'generatedImages',
        'agentActivity',
        'agentTodos'
    ].forEach(key => delete compact[key]);
    return compact;
}

function serializeWechatCharacterForStorage(char) {
    normalizeWechatCharacterAvatarData(char);
    return {
        id: char.id,
        name: char.name,
        description: char.description || '',
        avatar: getWechatCharAvatarSource(char, ''),
        _smallAvatar: char._smallAvatar || '',
        avatarGallery: Array.isArray(char.avatarGallery) ? char.avatarGallery.filter(isWechatRealAvatarSource) : [],
        coverImage: char.coverImage || '',
        builtinId: char.builtinId || '',
        lastMsg: char.lastMsg,
        worldBook: char.worldBook || [],
        regex: char.regex || [],
        alternates: char.alternates || [],
        first_mes_original: char.first_mes_original || '',
        first_mes: char.first_mes || '',
        currentGreetingIndex: char.currentGreetingIndex || 0,
        isGroupNpc: !!char.isGroupNpc,
        groupNpc: !!char.groupNpc,
        npcOriginGroupId: char.npcOriginGroupId || '',
        npcCreatedByMemberId: char.npcCreatedByMemberId || '',
        npcCreatedAt: char.npcCreatedAt || 0,
        isGroupChat: !!char.isGroupChat,
        groupMembers: Array.isArray(char.groupMembers) ? char.groupMembers : [],
        groupCreatedAt: char.groupCreatedAt || 0,
        // Character data carries only a provider/model/voice reference. TTS credentials stay in Settings.
        chatConfig: sanitizeWechatChatConfigForStorage(char.chatConfig),
        history: (char.history || []).map(msg => {
            if (!msg || !Object.prototype.hasOwnProperty.call(msg, 'imageResolving')) return msg;
            const stored = { ...msg };
            delete stored.imageResolving;
            return stored;
        })
    };
}

function buildWechatCharacterStorageData(source = window.myCharacters || []) {
    return (Array.isArray(source) ? source : []).map(serializeWechatCharacterForStorage);
}

function compactWechatCharacterForLocal(char, updatedAt) {
    const avatar = getWechatCharAvatarSource(char, '');
    return {
        id: char.id,
        name: char.name,
        description: char.description || '',
        avatar,
        _smallAvatar: char._smallAvatar || '',
        avatarGallery: avatar ? [avatar] : [],
        builtinId: char.builtinId || '',
        lastMsg: char.lastMsg || '',
        isGroupNpc: !!char.isGroupNpc,
        groupNpc: !!char.groupNpc,
        npcOriginGroupId: char.npcOriginGroupId || '',
        npcCreatedByMemberId: char.npcCreatedByMemberId || '',
        npcCreatedAt: char.npcCreatedAt || 0,
        isGroupChat: !!char.isGroupChat,
        groupMembers: Array.isArray(char.groupMembers)
            ? char.groupMembers.map(member => ({
                id: member.id || '',
                name: member.name || '',
                nickname: member.nickname || '',
                remark: member.remark || '',
                title: member.title || '',
                role: member.role || '',
                avatar: getWechatFirstRealAvatarSource(member.avatar, member._smallAvatar) || ''
            }))
            : [],
        groupCreatedAt: char.groupCreatedAt || 0,
        chatConfig: compactWechatChatConfigForLocal(char.chatConfig || {}),
        history: [],
        worldBook: [],
        regex: [],
        alternates: [],
        first_mes_original: '',
        first_mes: '',
        currentGreetingIndex: char.currentGreetingIndex || 0,
        __indexedDbBacked: true,
        __storageUpdatedAt: updatedAt
    };
}

function isWechatCompactCharacterSnapshot(chars) {
    return Array.isArray(chars) && chars.some(char => char && char.__indexedDbBacked);
}

function isWechatCompleteCharacterSnapshot(chars) {
    return Array.isArray(chars) && chars.every(char => char && typeof char === 'object'
        && !Array.isArray(char) && !char.__indexedDbBacked);
}

function selectWechatCharacterSnapshot(localData, meta = {}, record = null) {
    const localComplete = isWechatCompleteCharacterSnapshot(localData) && meta.mode !== 'indexeddb';
    const indexedComplete = isWechatCompleteCharacterSnapshot(record?.characters);
    const localUpdatedAt = Math.max(0, Number(meta.updatedAt) || 0);
    const indexedUpdatedAt = Math.max(0, Number(record?.updatedAt) || 0);
    if (localComplete && (!indexedComplete || !localUpdatedAt || localUpdatedAt >= indexedUpdatedAt)) {
        return { characters: localData, updatedAt: localUpdatedAt, source: 'localStorage' };
    }
    if (indexedComplete) {
        if (!localComplete && indexedUpdatedAt < localUpdatedAt) {
            throw new Error('完整角色数据比本地索引旧，已暂停保存和导出，请恢复完整备份。');
        }
        return { characters: record.characters, updatedAt: indexedUpdatedAt, source: 'IndexedDB' };
    }
    if (meta.mode === 'indexeddb' || localData !== null || record !== null || Number(meta.count) > 0) {
        throw new Error('无法读取完整角色数据，已暂停保存和导出，请刷新重试或导入完整备份。');
    }
    return { characters: [], updatedAt: 0, source: 'empty' };
}

async function readWechatCharacterSnapshot({ includeMemory = false } = {}) {
    const pendingAtStart = window._wechatCharactersSavePromise;
    let localData = null;
    let localError = null;
    let meta = getWechatCharacterStorageMeta();
    try {
        const raw = localStorage.getItem(WECHAT_CHARACTERS_STORAGE_KEY);
        if (raw !== null) {
            localData = JSON.parse(raw);
            if (!isWechatCompleteCharacterSnapshot(localData)) localError = new Error('角色存储格式无效');
        }
    } catch (error) {
        localError = error;
    }
    const memory = includeMemory && window._wechatCharactersStorageState?.status === 'ready'
        ? window._wechatCharactersLatestSnapshot : null;
    let fromMemory = false;
    if (memory && isWechatCompleteCharacterSnapshot(memory.characters)
        && (localError || meta.mode === 'indexeddb' || !Array.isArray(localData)
            || Number(memory.updatedAt) >= Number(meta.updatedAt || 0))) {
        localData = memory.characters;
        meta = { mode: 'full', updatedAt: memory.updatedAt };
        localError = null;
        fromMemory = true;
    }
    let record = null;
    let indexedError = null;
    try {
        record = await loadWechatCharactersFromIndexedDb();
    } catch (error) {
        indexedError = error;
    }
    const localComplete = isWechatCompleteCharacterSnapshot(localData) && meta.mode !== 'indexeddb';
    if (!localComplete && (indexedError || (localError && !isWechatCompleteCharacterSnapshot(record?.characters)))) {
        throw new Error('无法读取完整角色数据，已暂停保存和导出，请刷新重试或导入完整备份。');
    }
    const snapshot = selectWechatCharacterSnapshot(localData, meta, record);
    // Promote a complete, newer snapshot only when no new save was queued during this read.
    if (snapshot.source === 'localStorage' && pendingAtStart === window._wechatCharactersSavePromise
        && (!isWechatCompleteCharacterSnapshot(record?.characters)
            || snapshot.updatedAt > Number(record.updatedAt || 0) || !snapshot.updatedAt)) {
        const updatedAt = snapshot.updatedAt || Date.now();
        try {
            await saveWechatCharactersToIndexedDb(snapshot.characters, updatedAt);
            snapshot.updatedAt = updatedAt;
            if (!fromMemory) setWechatCharacterStorageMeta({ ...meta, mode: 'full', updatedAt, count: snapshot.characters.length });
        } catch (error) {
            console.warn('角色 IndexedDB 同步失败，保留完整本地副本', error);
        }
    }
    if (fromMemory && snapshot.source === 'localStorage') snapshot.source = 'memory';
    return snapshot;
}

async function waitForWechatCharacterSaves() {
    let pending;
    while (window._wechatCharactersSavePromise && pending !== window._wechatCharactersSavePromise) {
        pending = window._wechatCharactersSavePromise;
        await pending;
    }
}

async function getWechatCharacterSnapshotForBackup() {
    if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
    await waitForWechatCharacterSaves();
    if (window._wechatCharactersStorageState?.status === 'error') {
        throw window._wechatCharactersStorageState.error;
    }
    return readWechatCharacterSnapshot({ includeMemory: true });
}
window.getWechatCharacterSnapshotForBackup = getWechatCharacterSnapshotForBackup;

function nextWechatCharacterStorageTimestamp() {
    return Math.max(Date.now(), Number(window._wechatCharactersLatestSnapshot?.updatedAt || 0) + 1,
        Number(getWechatCharacterStorageMeta().updatedAt || 0) + 1);
}

function writeWechatCharactersCompactLocal(data, updatedAt) {
    const compact = data.map(char => compactWechatCharacterForLocal(char, updatedAt));
    const json = JSON.stringify(compact);
    localStorage.setItem(WECHAT_CHARACTERS_STORAGE_KEY, json);
    setWechatCharacterStorageMeta({
        mode: 'indexeddb',
        updatedAt,
        count: data.length,
        localSize: json.length
    });
}

async function persistWechatCharactersSnapshot(data, updatedAt = Date.now(), options = {}) {
    if (!isWechatCompleteCharacterSnapshot(data)) {
        throw new Error('不能将轻量角色索引保存为完整数据');
    }
    const fullJson = JSON.stringify(data);
    const meta = getWechatCharacterStorageMeta();
    const preferIndexedDb = !!options.preferIndexedDb || meta.mode === 'indexeddb' || fullJson.length > 2400000;

    if (!preferIndexedDb) {
        try {
            localStorage.setItem(WECHAT_CHARACTERS_STORAGE_KEY, fullJson);
            const metadataSaved = setWechatCharacterStorageMeta({
                mode: 'full',
                updatedAt,
                count: data.length,
                localSize: fullJson.length
            });
            let indexedDbSaved = false;
            try {
                await saveWechatCharactersToIndexedDb(data, updatedAt);
                indexedDbSaved = true;
            } catch (err) {
                console.warn('角色 IndexedDB 备份失败，本地完整副本仍已保存', err);
            }
            if (!metadataSaved && !indexedDbSaved) throw new Error('角色存储版本和备份均未能写入');
            console.log("✅ 角色数据已保存，大小:", (fullJson.length / 1024).toFixed(1) + "KB");
            return true;
        } catch (e) {
            if (e.name !== 'QuotaExceededError') throw e;
        }
    }

    await saveWechatCharactersToIndexedDb(data, updatedAt);
    try {
        writeWechatCharactersCompactLocal(data, updatedAt);
    } catch (compactErr) {
        console.warn('角色轻量索引写入失败，完整数据已保存在 IndexedDB', compactErr);
        const metadataSaved = setWechatCharacterStorageMeta({
            mode: 'indexeddb',
            updatedAt,
            count: data.length,
            localSize: 0
        });
        if (!metadataSaved) throw new Error('完整角色数据已写入，但本地索引状态更新失败');
    }
    console.log("✅ 角色数据已保存到大容量存储，localStorage 仅保留轻量索引");
    return true;
}

function showWechatCharacterStorageError(err) {
    console.error('保存角色数据失败:', err);
    const message = err?.characterStorageUnavailable
        ? err.message
        : '角色数据暂时无法保存，请先导出备份，并检查设备的可用存储空间。';
    if (typeof showWechatToast === 'function') {
        showWechatToast(message);
    } else {
        alert('❌ ' + message);
    }
}

function saveCharactersToStorage() {
    if (window._wechatCharactersStorageState?.status !== 'ready' || isWechatCompactCharacterSnapshot(window.myCharacters)) {
        const error = new Error(window._wechatCharactersStorageState?.status === 'loading'
            ? '角色数据还在加载，请稍后重试。'
            : '完整角色数据尚未读取，已暂停保存，请刷新重试或导入完整备份。');
        error.characterStorageUnavailable = true;
        showWechatCharacterStorageError(error);
        return Promise.resolve(false);
    }
    let data;
    try {
        // Detach nested history/config objects now; later edits must not mutate a queued write.
        data = JSON.parse(JSON.stringify(buildWechatCharacterStorageData()));
    } catch (error) {
        showWechatCharacterStorageError(error);
        return Promise.resolve(false);
    }
    const updatedAt = nextWechatCharacterStorageTimestamp();
    window._wechatCharactersLatestSnapshot = { characters: data, updatedAt };
    window._wechatCharactersSavePromise = (window._wechatCharactersSavePromise || Promise.resolve())
        .catch(() => {})
        .then(() => persistWechatCharactersSnapshot(data, updatedAt))
        .catch(error => {
            showWechatCharacterStorageError(error);
            return false;
        });
    return window._wechatCharactersSavePromise;
}

// 异步压缩所有角色头像后再保存
function compressAndSaveCharacters() {
    let pending = 0;
    let hasLarge = false;
    
    window.myCharacters.forEach(char => {
        const av = char.avatar || '';
        if (av.length > 50000 && !char._smallAvatar) {
            hasLarge = true;
            pending++;
            const img = new Image();
            img.onload = function() {
                char._smallAvatar = compressWechatAvatarImage(img, 200, 0.7);
                pending--;
                if (pending === 0) saveCharactersToStorage();
            };
            img.onerror = function() {
                char._smallAvatar = '';
                pending--;
                if (pending === 0) saveCharactersToStorage();
            };
            img.src = av;
        }
    });
    
    if (!hasLarge) saveCharactersToStorage();
}

function applyLoadedWechatCharacters(data, sourceLabel) {
    let removedWatchTogetherData = false;
    window.myCharacters = data.map(item => {
        const char = normalizeWechatCharacterAvatarData(item);
        for (const msg of (char.history || [])) if (msg) delete msg.imageResolving;
        if (char?.chatConfig && Object.prototype.hasOwnProperty.call(char.chatConfig, 'aiPhoneWatch')) {
            delete char.chatConfig.aiPhoneWatch;
            removedWatchTogetherData = true;
        }
        return char;
    });
    if (removedWatchTogetherData) saveCharactersToStorage();
    console.log("✅ 已加载", data.length, "个角色", sourceLabel || '');
    applyWechatUiTheme();
    renderChatList();
    const currentChar = getCurrentChatChar?.();
    if (currentChar && document.getElementById('wechat-chat-room')?.classList.contains('active')) {
        refreshChatView(currentChar);
    }
}

function loadCharactersFromStorage() {
    window._wechatCharactersStorageState = { status: 'loading' };
    window._wechatCharactersLoadPromise = readWechatCharacterSnapshot().then(snapshot => {
        window._wechatCharactersStorageState = { status: 'ready' };
        window._wechatCharactersLatestSnapshot = JSON.parse(JSON.stringify(snapshot));
        applyLoadedWechatCharacters(snapshot.characters, `(${snapshot.source})`);
        // First launch without any character: offer the bundled originals so the app works out of the box.
        if (typeof setTimeout === 'function') setTimeout(() => { try { if (!window.ByndBuiltinLibrary?.maybePrompt()) window.ByndBuiltinLibrary?.repair?.(); } catch (_) {} }, 400);
        return snapshot;
    }, error => {
        error.characterStorageUnavailable = true;
        window._wechatCharactersStorageState = { status: 'error', error };
        showWechatCharacterStorageError(error);
        return null;
    });
    return window._wechatCharactersLoadPromise;
}

async function saveWechatImportedCharactersData(characters, updatedAt = Date.now()) {
    if (!Array.isArray(characters) || isWechatCompactCharacterSnapshot(characters)
        || characters.some(char => !char || typeof char !== 'object' || Array.isArray(char))) {
        throw new Error('备份中缺少完整角色数据，不能导入轻量索引');
    }
    if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
    await waitForWechatCharacterSaves();
    const data = JSON.parse(JSON.stringify(buildWechatCharacterStorageData(characters)));
    // Import is a new write, including an explicitly empty character list.
    updatedAt = Math.max(Number(updatedAt) || 0, nextWechatCharacterStorageTimestamp());
    await persistWechatCharactersSnapshot(data, updatedAt);
    window._wechatCharactersStorageState = { status: 'ready' };
    window._wechatCharactersLatestSnapshot = { characters: data, updatedAt };
    window.myCharacters = JSON.parse(JSON.stringify(data));
    return data;
}
window.saveWechatImportedCharactersData = saveWechatImportedCharactersData;

