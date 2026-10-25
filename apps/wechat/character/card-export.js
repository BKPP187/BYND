// --- 角色卡导出与导入 ---
// 单人角色导出为 SillyTavern V2 兼容的 PNG 角色卡（tEXt chara），群聊导出为 BYND 群聊卡 JSON（含全部成员角色卡）。
// 两种文件都能从“添加角色”重新导入；导入群聊卡时成员和群聊一次保存，失败整体回滚。
const BYND_GROUP_CARD_SPEC = 'bynd_group_card';
const BYND_CARD_CONFIG_KEYS = ['nickname', 'signature', 'charSignature', 'gender', 'region', 'contactRegion'];

function toByndCardKeys(value) {
    const list = Array.isArray(value) ? value : String(value || '').split(/[,，、]/);
    return list.map(item => String(item || '').trim()).filter(Boolean).slice(0, 24);
}

function pickByndCardConfig(config) {
    const out = {};
    for (const key of BYND_CARD_CONFIG_KEYS) if (config && typeof config[key] === 'string' && config[key].trim()) out[key] = config[key];
    return out;
}

function buildByndCharacterCardV2(char) {
    if (!char || char.isGroupChat) throw new Error('只能导出单人角色');
    const name = String(char.name || '').trim() || '未命名角色';
    const entries = (Array.isArray(char.worldBook) ? char.worldBook : []).map((entry, index) => {
        if (!entry || typeof entry !== 'object') return null;
        const content = String(entry.content ?? entry.text ?? entry.entry ?? entry.value ?? '').trim();
        if (!content) return null;
        return {
            id: index, keys: toByndCardKeys(entry.keys ?? entry.key), content,
            comment: String(entry.comment || entry.name || entry.title || ''),
            enabled: entry.enabled !== false, constant: !!entry.constant,
            insertion_order: Number(entry.insertion_order ?? entry.order ?? index) || 0,
            selective: !!entry.selective, secondary_keys: toByndCardKeys(entry.secondary_keys), extensions: {}
        };
    }).filter(Boolean);
    const regex = (Array.isArray(char.regex) ? char.regex : []).filter(item => item && item.regex).map(item => ({
        scriptName: String(item.name || 'Script'), findRegex: String(item.regex), replaceString: String(item.replace || ''),
        trimStrings: [], placement: [1, 2], disabled: false, markdownOnly: false, promptOnly: false, runOnEdit: true
    }));
    const firstMessage = String(char.first_mes_original || char.first_mes || '');
    return {
        spec: 'chara_card_v2', spec_version: '2.0',
        data: {
            name, description: String(char.description || ''), personality: String(char.personality || ''),
            scenario: String(char.scenario || ''), first_mes: firstMessage, mes_example: '',
            creator_notes: '由 BYND 导出', system_prompt: '', post_history_instructions: '',
            alternate_greetings: (Array.isArray(char.alternates) ? char.alternates : []).map(item => String(item || '')).filter(Boolean),
            ...(entries.length ? { character_book: { name: `${name} 世界书`, entries, extensions: {} } } : {}),
            tags: [], creator: 'BYND', character_version: '1',
            extensions: {
                regex_scripts: regex,
                // Lets BYND restore its own fields verbatim; other apps ignore this block.
                bynd: { version: 1, description: String(char.description || ''), first_mes: firstMessage, chatConfig: pickByndCardConfig(char.chatConfig) }
            }
        }
    };
}
window.buildByndCharacterCardV2 = buildByndCharacterCardV2;

function encodeByndUtf8Base64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

const BYND_CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function byndCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = BYND_CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Inserts a tEXt "chara" chunk (base64 JSON, the SillyTavern convention) before IEND, replacing any old one.
function embedByndCardInPng(pngBytes, card) {
    const source = pngBytes instanceof Uint8Array ? pngBytes : new Uint8Array(pngBytes);
    const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
    if (source.length < 20 || view.getUint32(0) !== 0x89504E47) throw new Error('头像图片不是 PNG');
    const kept = [];
    let offset = 8, iend = -1;
    while (offset + 12 <= source.length) {
        const length = view.getUint32(offset);
        const type = String.fromCharCode(...source.subarray(offset + 4, offset + 8));
        const end = offset + 12 + length;
        if (end > source.length) throw new Error('头像 PNG 已损坏');
        if (type === 'IEND') { iend = offset; break; }
        const keyword = type === 'tEXt' || type === 'iTXt' ? new TextDecoder().decode(source.subarray(offset + 8, offset + 8 + Math.min(length, 8))).split('\0')[0] : '';
        if (!['chara', 'ccv3'].includes(keyword)) kept.push(source.subarray(offset, end));
        offset = end;
    }
    if (iend < 0) throw new Error('头像 PNG 缺少结束块');
    const payload = new TextEncoder().encode('chara\0' + encodeByndUtf8Base64(JSON.stringify(card)));
    const chunk = new Uint8Array(12 + payload.length);
    const chunkView = new DataView(chunk.buffer);
    chunkView.setUint32(0, payload.length);
    chunk.set([0x74, 0x45, 0x58, 0x74], 4); // tEXt
    chunk.set(payload, 8);
    chunkView.setUint32(8 + payload.length, byndCrc32(chunk.subarray(4, 8 + payload.length)));
    const tail = source.subarray(iend);
    const parts = [source.subarray(0, 8), ...kept, chunk, tail];
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of parts) { out.set(part, at); at += part.length; }
    return out;
}
window.embedByndCardInPng = embedByndCardInPng;

function loadByndCardImage(src) {
    return new Promise((resolve, reject) => {
        if (!src) { reject(new Error('没有头像')); return; }
        const image = new Image();
        if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('头像读取失败'));
        image.src = src;
    });
}

// Renders the avatar to a PNG; a tainted or missing avatar falls back to a plain initial card.
async function renderByndCardPortrait(char, size = 512, type = 'image/png') {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const source = typeof getWechatCharAvatarSource === 'function' ? getWechatCharAvatarSource(char) : char.avatar;
    const fallback = () => {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = '#e9e7e2'; ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#3b3833'; ctx.font = `600 ${Math.round(size * 0.42)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(Array.from(String(char.name || '角'))[0], size / 2, size / 2 + size * 0.02);
    };
    try {
        const image = await loadByndCardImage(source);
        const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
        canvas.toDataURL(); // throws when the canvas is tainted
    } catch (_) { fallback(); }
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('角色卡图片生成失败')), type, 0.86));
}

async function buildByndCharacterCardPng(char) {
    const card = buildByndCharacterCardV2(char);
    const portrait = await renderByndCardPortrait(char, 512, 'image/png');
    return new Blob([embedByndCardInPng(new Uint8Array(await portrait.arrayBuffer()), card)], { type: 'image/png' });
}
window.buildByndCharacterCardPng = buildByndCharacterCardPng;

function blobToByndDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('图片读取失败'));
        reader.readAsDataURL(blob);
    });
}

async function buildByndGroupCardBundle(group) {
    if (!group || !group.isGroupChat) throw new Error('只能导出群聊');
    const ids = Array.isArray(group.groupMembers) ? group.groupMembers : [];
    const all = window.myCharacters || [];
    const members = ids.map(id => all.find(char => char && char.id === id && !char.isGroupChat)).filter(Boolean);
    if (!members.length) throw new Error('群里还没有可导出的角色');
    const rows = [];
    for (const member of members) {
        let avatar = '';
        try { avatar = await blobToByndDataUrl(await renderByndCardPortrait(member, 256, 'image/jpeg')); } catch (_) {}
        rows.push({ sourceId: member.id, avatar, card: buildByndCharacterCardV2(member) });
    }
    const groupAvatar = /^data:image\//i.test(String(group.avatar || '')) && String(group.avatar).length < 400000 ? group.avatar : '';
    return {
        spec: BYND_GROUP_CARD_SPEC, spec_version: '1.0', exportedAt: new Date().toISOString(),
        group: { name: String(group.name || '群聊'), description: String(group.description || ''), avatar: groupAvatar },
        members: rows
    };
}
window.buildByndGroupCardBundle = buildByndGroupCardBundle;

function byndCardFileName(name, extension) {
    const safe = String(name || '角色').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 60) || '角色';
    return `${safe}${extension}`;
}

// Saves through the Android document picker when available, otherwise a browser download.
function saveByndCardFile(blob, filename, type) {
    const bridge = window.ByndAndroid;
    if (bridge?.beginDocumentExport && bridge?.appendBackupExportChunk && bridge?.finishBackupExport) {
        return new Promise((resolve, reject) => {
            const token = `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            let done = false;
            const cleanup = () => {
                window.removeEventListener('bynd:backup-export-ready', ready);
                window.removeEventListener('bynd:backup-export', finished);
                clearTimeout(timer);
            };
            const fail = error => {
                if (done) return;
                done = true; cleanup();
                try { bridge.abortBackupExport?.(token); } catch (_) {}
                reject(error instanceof Error ? error : new Error(String(error)));
            };
            const finished = event => {
                if (event.detail?.id !== token || done) return;
                if (!event.detail.ok) { fail(new Error(event.detail.message || '导出失败')); return; }
                done = true; cleanup(); resolve(event.detail.message || '文件已保存');
            };
            const ready = async event => {
                if (event.detail?.id !== token || done) return;
                try {
                    for (let offset = 0; offset < blob.size; offset += 192 * 1024) {
                        const base64 = (await blobToByndDataUrl(blob.slice(offset, offset + 192 * 1024))).split(',')[1] || '';
                        if (done) return;
                        const accepted = bridge.appendBackupExportChunk(token, base64);
                        if (accepted !== true && accepted !== 'true') throw new Error('导出分段写入失败');
                        await new Promise(next => setTimeout(next, 0));
                    }
                    bridge.finishBackupExport(token);
                } catch (error) { fail(error); }
            };
            const timer = setTimeout(() => fail(new Error('系统文件选择或写入超时')), 120000);
            window.addEventListener('bynd:backup-export-ready', ready);
            window.addEventListener('bynd:backup-export', finished);
            try { bridge.beginDocumentExport(token, filename, type); } catch (error) { fail(error); }
        });
    }
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor);
    anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return Promise.resolve('已开始下载');
}

let byndCardExporting = false;
async function exportCurrentWechatCharacterCard(charId = window.currentChatCharId) {
    if (byndCardExporting) return false;
    const char = (window.myCharacters || []).find(item => item && item.id === charId);
    if (!char) { showWechatToast?.('找不到当前聊天'); return false; }
    byndCardExporting = true;
    try {
        if (char.isGroupChat) {
            const bundle = await buildByndGroupCardBundle(char);
            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
            await saveByndCardFile(blob, byndCardFileName(bundle.group.name, '.bynd-group.json'), 'application/json');
            showWechatToast?.(`群聊卡已导出（${bundle.members.length} 位成员）`);
        } else {
            const base = typeof getWechatChatWindowFamily === 'function' ? getWechatChatWindowFamily(char)[0] || char : char;
            const blob = await buildByndCharacterCardPng(base);
            await saveByndCardFile(blob, byndCardFileName(base.name, '.png'), 'image/png');
            showWechatToast?.('角色卡已导出');
        }
        return true;
    } catch (error) {
        console.error('角色卡导出失败', error);
        showWechatToast?.(`导出失败：${error.message || error}`);
        return false;
    } finally { byndCardExporting = false; }
}
window.exportCurrentWechatCharacterCard = exportCurrentWechatCharacterCard;

function syncWechatCardExportRow(char = (window.myCharacters || []).find(item => item.id === window.currentChatCharId)) {
    const title = document.getElementById('wcs-card-export-title');
    const hint = document.getElementById('wcs-card-export-hint');
    if (!title || !char) return;
    title.textContent = char.isGroupChat ? '导出群聊卡' : '导出角色卡';
    if (hint) hint.textContent = char.isGroupChat
        ? '群聊和全部成员的角色卡打包成一个 JSON 文件，可在“添加角色”里导入。'
        : 'PNG 角色卡，兼容 SillyTavern，可在“添加角色”里重新导入。';
}
window.syncWechatCardExportRow = syncWechatCardExportRow;

// --- 导入 ---
function findByndExistingCardChar(data) {
    return (window.myCharacters || []).find(char => char && !char.isGroupChat
        && !(typeof isWechatChatWindow === 'function' && isWechatChatWindow(char))
        && String(char.name || '') === String(data.name || '') && String(char.description || '') === String(data.description || '')) || null;
}

function buildByndCharFromCardData(data, avatar, now) {
    const first = String(data.first_mes || '');
    const char = {
        id: `char_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: String(data.name || '未命名角色'), description: String(data.description || ''),
        avatar: avatar || (typeof DEFAULT_AVATAR === 'string' ? DEFAULT_AVATAR : ''),
        lastMsg: '', worldBook: data.worldBook || [], regex: data.regex || [], alternates: data.alternates || [],
        first_mes_original: first, currentGreetingIndex: 0, first_mes: first,
        chatConfig: data.chatConfig && typeof data.chatConfig === 'object' ? { ...data.chatConfig } : {}, history: []
    };
    if (typeof seedWechatCharacterGreeting === 'function') seedWechatCharacterGreeting(char);
    return char;
}

function parseByndGroupCardBundle(value) {
    if (!value || value.spec !== BYND_GROUP_CARD_SPEC || !Array.isArray(value.members)) throw new Error('不是 BYND 群聊卡');
    const members = value.members.map(row => {
        const data = CharacterCardParser.fromCardObject(row && row.card);
        if (!data || !data.name) return null;
        return { data, avatar: /^data:image\//i.test(String(row.avatar || '')) ? row.avatar : '' };
    }).filter(Boolean);
    if (members.length < 1) throw new Error('群聊卡里没有可导入的角色');
    return { group: value.group && typeof value.group === 'object' ? value.group : {}, members };
}

async function importByndGroupCardBundle(value, now = Date.now()) {
    const parsed = parseByndGroupCardBundle(value);
    const list = window.myCharacters;
    const added = [];
    const memberIds = [];
    parsed.members.forEach((row, index) => {
        const existing = findByndExistingCardChar(row.data);
        if (existing) { memberIds.push(existing.id); return; }
        const char = buildByndCharFromCardData(row.data, row.avatar, now + index);
        added.push(char);
        memberIds.push(char.id);
    });
    const names = parsed.members.map(row => row.data.name).join('、');
    const ownerId = typeof WECHAT_QQ_GROUP_USER_ID === 'string' ? WECHAT_QQ_GROUP_USER_ID : 'user';
    const group = {
        id: `group_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(parsed.group.name || names.slice(0, 30) || '群聊'), description: String(parsed.group.description || '导入的群聊'),
        avatar: '', isGroupChat: true, groupMembers: [...new Set(memberIds)], groupOwnerId: ownerId, groupCreatedAt: now,
        chatConfig: { qqGroupSettings: { ownerId } },
        history: [{ type: 'system_notice', isMe: false, content: `你导入了群聊，成员：${names}`, timestamp: now }]
    };
    group.avatar = /^data:image\//i.test(String(parsed.group.avatar || '')) ? parsed.group.avatar
        : (typeof buildWechatGroupAvatar === 'function' ? buildWechatGroupAvatar(group) : '');
    list.push(...added);
    list.unshift(group);
    let saved = false;
    try { saved = (await saveCharactersToStorage()) !== false; } catch (_) { saved = false; }
    if (!saved) {
        for (const char of [group, ...added]) { const index = list.indexOf(char); if (index >= 0) list.splice(index, 1); }
        throw new Error('群聊没有保存成功，已撤回本次导入，请重试');
    }
    return { group, added, reused: memberIds.length - added.length };
}
window.importByndGroupCardBundle = importByndGroupCardBundle;

// JSON card files: a BYND group card is imported directly; a single JSON card opens the usual confirm dialog.
async function importByndCardJsonText(text) {
    let value;
    try { value = JSON.parse(String(text || '').trim()); } catch (_) { throw new Error('文件不是有效的 JSON'); }
    if (value && value.spec === BYND_GROUP_CARD_SPEC) {
        const result = await importByndGroupCardBundle(value);
        if (typeof renderChatList === 'function') renderChatList();
        showWechatToast?.(`已导入群聊「${result.group.name}」${result.added.length ? `，新增 ${result.added.length} 位角色` : ''}`);
        return { type: 'group', ...result };
    }
    const data = CharacterCardParser.fromCardObject(value);
    if (!data) throw new Error('无法识别这个角色卡');
    return { type: 'single', data };
}
window.importByndCardJsonText = importByndCardJsonText;
