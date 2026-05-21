// --- 🟢 wechat.js: 核心数据源 & 微信 App 逻辑 ---

// 1. 全局数据中心 (所有 App 共用)
window.myCharacters = window.myCharacters || [];
window.TEMP_PARSED_DATA = null;
window.currentChatCharId = null;

const DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="100" fill="#f0f0f0"/><circle cx="100" cy="85" r="35" fill="#ccc"/><ellipse cx="100" cy="160" rx="50" ry="35" fill="#ccc"/></svg>');
window.DEFAULT_AVATAR = DEFAULT_AVATAR;
const WECHAT_AUTO_COLLAPSE_AFTER = 56;
const WECHAT_COLLAPSE_KEEP_RECENT = 32;
const WECHAT_MEMORY_STORAGE_KEY = 'wechat_memory_store';
const WECHAT_MEMORY_DEFAULTS = {
    segmentLimit: 8,
    longTermLimit: 8,
    keepRecent: 5
};
const WECHAT_MOMENTS_STORAGE_KEY = 'wechat_moments_store';
const WECHAT_VIDEO_STORAGE_KEY = 'wechat_video_state';
const WECHAT_LIVE_STORAGE_KEY = 'wechat_live_state';
const WECHAT_SHOP_STORAGE_KEY = 'wechat_shop_store';
const WECHAT_FAVORITES_STORAGE_KEY = 'wechat_favorites_store';
const WECHAT_AI_STATUS_FIELDS = [
    { key: 'innerMonologue', label: '内心独白' },
    { key: 'miniDiary', label: '小日记' },
    { key: 'thoughts', label: '想法' },
    { key: 'outfit', label: '服饰' },
    { key: 'posture', label: '姿势' },
    { key: 'action', label: '动作' },
    { key: 'gaze', label: '目光' },
    { key: 'penis', label: 'Penis' }
];

// --- 气泡CSS预设系统 ---
const BUBBLE_CSS_PRESETS = [
    { id: 'default', name: '默认', css: '' },
    { id: 'blue-pink', name: '蓝粉长条', css: '.msg-bubble { background: #CDECFF; color: #333; border-radius: 18px 18px 18px 6px; }\n.msg-bubble.green { background: #FFD2DD; color: #333; border-radius: 18px 18px 6px 18px; }' },
    { id: 'telegram', name: 'TG 清透', css: '.msg-bubble { background: #E8F2FF; color: #17212b; border-radius: 18px 18px 18px 7px; box-shadow: 0 1px 2px rgba(23,33,43,0.08); }\n.msg-bubble.green { background: #DDF7C8; color: #17212b; border-radius: 18px 18px 7px 18px; box-shadow: 0 1px 2px rgba(23,33,43,0.08); }\n.msg-meta { color: rgba(23,33,43,0.46); }' },
    { id: 'imessage', name: 'iMessage', css: '.msg-bubble { background: #E9EAEE; color: #101418; border-radius: 19px 19px 19px 7px; box-shadow: none; }\n.msg-bubble.green { background: #1688FF; color: #fff; border-radius: 19px 19px 7px 19px; box-shadow: none; }\n.msg-bubble.green .msg-meta { color: rgba(255,255,255,0.74); }' },
    { id: 'soft-paper', name: '柔纸', css: '.msg-bubble { background: #FFF7E8; color: #34251B; border: 1px solid rgba(160,118,75,0.18); border-radius: 16px 16px 16px 6px; box-shadow: 0 2px 8px rgba(94,65,39,0.07); }\n.msg-bubble.green { background: #E7F5EF; color: #20362C; border-color: rgba(70,130,103,0.18); border-radius: 16px 16px 6px 16px; }' },
    { id: 'glass', name: '玻璃', css: '.msg-bubble { background: rgba(255,255,255,0.68); color: #1e293b; border: 1px solid rgba(255,255,255,0.65); border-radius: 20px 20px 20px 8px; backdrop-filter: blur(14px) saturate(1.2); -webkit-backdrop-filter: blur(14px) saturate(1.2); box-shadow: 0 8px 22px rgba(15,23,42,0.10); }\n.msg-bubble.green { background: rgba(178,235,206,0.74); color: #17352b; border-color: rgba(255,255,255,0.58); border-radius: 20px 20px 8px 20px; }' },
    { id: 'white-blue', name: '白蓝清爽', css: '.msg-bubble { background: #FFFFFF; color: #263241; border: 1px solid rgba(148,163,184,0.18); border-radius: 20px 20px 20px 7px; box-shadow: 0 1px 2px rgba(15,23,42,0.06); }\n.msg-bubble.green { background: #D8E6FF; color: #263241; border: 1px solid rgba(135,163,199,0.18); border-radius: 20px 20px 7px 20px; box-shadow: 0 1px 2px rgba(91,116,148,0.08); }\n.msg-meta { color: rgba(38,50,65,0.46); }' },
    { id: 'mist-blue', name: '雾蓝长条', css: '.msg-bubble { background: #F7FAFF; color: #1f2a3a; border-radius: 22px 22px 22px 8px; box-shadow: 0 4px 14px rgba(110,136,170,0.08); }\n.msg-bubble.green { background: #D8E6FF; color: #1f2a3a; border-radius: 22px 22px 8px 22px; box-shadow: 0 4px 14px rgba(110,136,170,0.08); }\n.msg-meta { color: rgba(31,42,58,0.42); }' },
    { id: 'milk-clean', name: '奶白留白', css: '.msg-bubble { background: #FFFFFF; color: #202833; border-radius: 18px 18px 18px 6px; border: 1px solid rgba(226,232,240,0.9); box-shadow: none; }\n.msg-bubble.green { background: #EEF4FF; color: #202833; border-radius: 18px 18px 6px 18px; border: 1px solid rgba(216,230,255,0.9); box-shadow: none; }' },
    { id: 'strawberry', name: '草莓布丁', css: '.msg-bubble { color: #C75C83; background: #FDECF2; border: 2px dashed #F6A4C1; box-shadow: 0 3px 6px rgba(220,150,180,0.2); border-radius: 20px 20px 20px 8px; text-shadow: none; }\n.msg-bubble.green { color: #C75C83; background: #FDECF2; border: 2px dashed #F6A4C1; box-shadow: 0 3px 6px rgba(220,150,180,0.2); border-radius: 20px 20px 8px 20px; }' }
];
const BUBBLE_PRESETS_KEY = 'my_bubble_presets';

function getUserBubblePresets() {
    try {
        const raw = localStorage.getItem(BUBBLE_PRESETS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
}

function saveUserBubblePresets(list) {
    localStorage.setItem(BUBBLE_PRESETS_KEY, JSON.stringify(list));
}

function getAllBubblePresets() {
    return [...BUBBLE_CSS_PRESETS, ...getUserBubblePresets()];
}

function renderBubblePresetDropdown(selectedCss) {
    const sel = document.getElementById('wcs-bubble-preset');
    if (!sel) return;
    const all = getAllBubblePresets();
    sel.innerHTML = all.map(p =>
        `<option value="${p.id}">${p.name}</option>`
    ).join('');
    // 找到匹配当前CSS的预设
    const match = all.find(p => p.css.replace(/\s+/g, '') === (selectedCss || '').replace(/\s+/g, ''));
    sel.value = match ? match.id : 'default';
}

function applyBubblePreset(presetId) {
    const all = getAllBubblePresets();
    const preset = all.find(p => p.id === presetId);
    if (!preset) return;
    const textarea = document.getElementById('wcs-custom-css');
    if (textarea) {
        textarea.value = preset.css;
        previewBubbleCss(preset.css);
    }
}

function saveCurrentCssAsPreset() {
    const textarea = document.getElementById('wcs-custom-css');
    if (!textarea || !textarea.value.trim()) {
        alert('请先在下面的编辑框中输入CSS样式');
        return;
    }
    const name = prompt('给这个气泡样式起个名字：');
    if (!name || !name.trim()) return;
    const presets = getUserBubblePresets();
    const newPreset = {
        id: 'bp_' + Date.now(),
        name: name.trim(),
        css: textarea.value.trim()
    };
    presets.push(newPreset);
    saveUserBubblePresets(presets);
    renderBubblePresetDropdown(newPreset.css);
    const sel = document.getElementById('wcs-bubble-preset');
    if (sel) sel.value = newPreset.id;
}

function deleteSelectedPreset() {
    const sel = document.getElementById('wcs-bubble-preset');
    if (!sel) return;
    const id = sel.value;
    if (BUBBLE_CSS_PRESETS.find(p => p.id === id)) {
        alert('内置预设不能删除哦～');
        return;
    }
    const presets = getUserBubblePresets();
    const idx = presets.findIndex(p => p.id === id);
    if (idx === -1) return;
    if (!confirm(`确定删除预设「${presets[idx].name}」吗？`)) return;
    presets.splice(idx, 1);
    saveUserBubblePresets(presets);
    document.getElementById('wcs-custom-css').value = '';
    previewBubbleCss('');
    renderBubblePresetDropdown('');
}

// --- A. 微信界面渲染 ---

function renderChatList() {
    const listEl = document.getElementById('wc-chat-list');
    if (!listEl) return;
    listEl.innerHTML = ''; 

    if (window.myCharacters.length === 0) {
        listEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; color:#ccc;">
                <i class="ri-chat-smile-2-line" style="font-size:48px; margin-bottom:10px;"></i>
                <span style="font-size:14px;">暂无消息</span>
                <span style="font-size:12px; margin-top:5px;">点击右上角 + 导入角色卡</span>
            </div>
        `;
        return;
    }

    window.myCharacters.forEach(char => {
        const container = document.createElement('div');
        container.className = 'wc-swipe-container';
        container.dataset.charId = char.id;

        const item = document.createElement('div');
        item.className = 'wc-chat-item';
        const isGroup = !!char.isGroupChat;
        const displayName = isGroup ? (char.name || '群聊') : ((char.chatConfig && char.chatConfig.nickname) || char.name);
        const avatar = char.avatar || (isGroup ? buildWechatGroupAvatar(char) : DEFAULT_AVATAR);

        item.innerHTML = `
            <div class="wc-avatar ${isGroup ? 'wc-group-avatar' : ''}"><img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'"></div>
            <div class="wc-info">
                <div class="wc-top">
                    <span class="wc-name">${escapeHtml(displayName)}</span>
                    <span class="wc-time">刚刚</span>
                </div>
                <div class="wc-bottom">
                    <span class="wc-msg">${isGroup ? `[${(char.groupMembers || []).length}人] ` : ''}${escapeHtml(getChatPreview(char))}</span>
                </div>
            </div>
        `;

        const delBtn = document.createElement('div');
        delBtn.className = 'wc-delete-btn';
        delBtn.innerHTML = '<span>删除</span>';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteCharacter(char.id); };

        container.appendChild(item);
        container.appendChild(delBtn);
        listEl.appendChild(container);
    });

    initSwipeHandlers();
}

function getWechatGroupContacts() {
    return (window.myCharacters || []).filter(char => char && char.id && !char.isGroupChat);
}

function buildWechatGroupAvatar(group) {
    const members = Array.isArray(group?.groupMembers) ? group.groupMembers : [];
    const hue = Math.abs(String(group?.id || group?.name || 'group').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % 360;
    const label = members.length ? members.length : 'G';
    return 'data:image/svg+xml,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
            <rect width="120" height="120" rx="24" fill="hsl(${hue},70%,92%)"/>
            <rect x="18" y="18" width="38" height="38" rx="12" fill="hsl(${hue},70%,58%)"/>
            <rect x="64" y="18" width="38" height="38" rx="12" fill="hsl(${(hue + 36) % 360},70%,66%)"/>
            <rect x="18" y="64" width="38" height="38" rx="12" fill="hsl(${(hue + 72) % 360},68%,72%)"/>
            <rect x="64" y="64" width="38" height="38" rx="12" fill="#ffffff"/>
            <text x="83" y="88" text-anchor="middle" font-family="Arial" font-size="24" font-weight="800" fill="hsl(${hue},54%,34%)">${label}</text>
        </svg>
    `);
}

function closeWechatPlusMenu() {
    document.getElementById('wc-plus-menu')?.remove();
}

function openWechatPlusMenu(event) {
    event?.stopPropagation?.();
    const old = document.getElementById('wc-plus-menu');
    if (old) {
        old.remove();
        return;
    }
    const root = document.getElementById('app-wechat-window');
    if (!root) return;
    const menu = document.createElement('div');
    menu.id = 'wc-plus-menu';
    menu.className = 'wc-plus-menu';
    menu.innerHTML = `
        <button type="button" onclick="closeWechatPlusMenu();testAddCharacter()"><i class="ri-user-add-line"></i><span>导入角色</span></button>
        <button type="button" onclick="openWechatGroupCreator()"><i class="ri-group-line"></i><span>发起群聊</span></button>
    `;
    root.appendChild(menu);
    setTimeout(() => {
        const closer = (ev) => {
            if (!ev.target.closest('#wc-plus-menu, .wc-header-right')) {
                closeWechatPlusMenu();
                document.removeEventListener('click', closer, true);
            }
        };
        document.addEventListener('click', closer, true);
    }, 0);
}
window.openWechatPlusMenu = openWechatPlusMenu;
window.closeWechatPlusMenu = closeWechatPlusMenu;

function openWechatGroupCreator() {
    closeWechatPlusMenu();
    const contacts = getWechatGroupContacts();
    window._wechatGroupDraftIds = Array.isArray(window._wechatGroupDraftIds) ? window._wechatGroupDraftIds.filter(id => contacts.some(c => c.id === id)) : [];
    const html = `
        <div class="wc-group-create">
            <div class="wc-group-create-top">
                <strong>选择联系人</strong>
                <span>从现有 AI 联系人里拉进群聊，至少选择 2 个。</span>
            </div>
            <input id="wc-group-name-input" class="wc-group-name-input" maxlength="24" placeholder="群聊名称，可留空自动生成">
            <div class="wc-group-select-list">
                ${contacts.length ? contacts.map(char => `
                    <button type="button" class="wc-group-select-item ${window._wechatGroupDraftIds.includes(char.id) ? 'active' : ''}" onclick="toggleWechatGroupDraftMember(${quoteWechatJsString(char.id)})">
                        <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                        <span>${wcEscapeHtml((char.chatConfig && char.chatConfig.nickname) || char.name || '未命名')}</span>
                        <i class="${window._wechatGroupDraftIds.includes(char.id) ? 'ri-checkbox-circle-fill' : 'ri-add-circle-line'}"></i>
                    </button>
                `).join('') : '<div class="wc-contacts-empty">还没有可拉入群聊的联系人</div>'}
            </div>
            <button type="button" class="wc-group-create-btn" onclick="createWechatGroupChat()">创建群聊</button>
        </div>
    `;
    openWechatFeatureScreen('发起群聊', html);
}
window.openWechatGroupCreator = openWechatGroupCreator;

function toggleWechatGroupDraftMember(charId) {
    const ids = Array.isArray(window._wechatGroupDraftIds) ? window._wechatGroupDraftIds : [];
    window._wechatGroupDraftIds = ids.includes(charId) ? ids.filter(id => id !== charId) : [...ids, charId];
    openWechatGroupCreator();
}
window.toggleWechatGroupDraftMember = toggleWechatGroupDraftMember;

function createWechatGroupChat() {
    const ids = Array.isArray(window._wechatGroupDraftIds) ? window._wechatGroupDraftIds : [];
    const members = ids.map(id => getWechatGroupContacts().find(char => char.id === id)).filter(Boolean);
    if (members.length < 2) {
        if (typeof showWechatToast === 'function') showWechatToast('至少选择 2 个联系人');
        return;
    }
    const inputName = (document.getElementById('wc-group-name-input')?.value || '').trim();
    const name = inputName || members.slice(0, 3).map(char => (char.chatConfig && char.chatConfig.nickname) || char.name || '好友').join('、') + (members.length > 3 ? ` 等${members.length}人` : '');
    const group = {
        id: 'group_' + Date.now(),
        name,
        description: '微信联系人群聊',
        avatar: '',
        isGroupChat: true,
        groupMembers: members.map(char => char.id),
        groupCreatedAt: Date.now(),
        chatConfig: {},
        history: [
            { type: 'system_notice', isMe: false, content: `你邀请 ${members.map(char => (char.chatConfig && char.chatConfig.nickname) || char.name || '好友').join('、')} 加入了群聊`, timestamp: createMessageTimestamp() }
        ]
    };
    group.avatar = buildWechatGroupAvatar(group);
    window.myCharacters.unshift(group);
    window._wechatGroupDraftIds = [];
    saveCharactersToStorage();
    closeWechatFeatureScreen();
    switchWcTab('chat');
    renderChatList();
    openChat(group.id);
}
window.createWechatGroupChat = createWechatGroupChat;

function getChatPreview(char) {
    const history = char.history || [];
    const last = history[history.length - 1];
    if (!last) return char.description ? String(char.description).replace(/\s+/g, ' ').slice(0, 40) : '还没有聊天记录';
    if (last.type === 'image') return last.isMe ? '[图片]' : '[对方发来图片]';
    if (last.type === 'sticker') return last.isMe ? '[表情]' : '[对方发来表情]';
    if (isWechatSpecialMessage(last.type)) return getWechatMessageSummary(last);
    const text = String(last.content || last.dialogue || last.description || '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text || '[消息]';
}

function filterChatList(keyword) {
    const items = document.querySelectorAll('#wc-chat-list .wc-swipe-container');
    const kw = keyword.trim().toLowerCase();
    items.forEach(container => {
        const charId = container.dataset.charId;
        const char = window.myCharacters.find(c => c.id === charId);
        if (!char) return;
        const nickname = (char.chatConfig && char.chatConfig.nickname) || '';
        const match = !kw || char.name.toLowerCase().includes(kw) || nickname.toLowerCase().includes(kw);
        container.style.display = match ? '' : 'none';
    });
}

// 通用工具：正则替换 + Markdown 清洗
function getWechatDisplayUserName() {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    return (profile && profile.name) || '我';
}

function getWechatDisplayCharName(char) {
    if (!char) return '';
    return (char.chatConfig && char.chatConfig.nickname) || char.name || '';
}

function fillWechatRegexTemplate(value, char) {
    return String(value == null ? '' : value)
        .replace(/\{\{char\}\}/gi, getWechatDisplayCharName(char))
        .replace(/\{\{user\}\}/gi, getWechatDisplayUserName());
}

function getWechatRegexScriptField(script, keys) {
    if (!script || typeof script !== 'object') return '';
    for (const key of keys) {
        if (script[key] != null && script[key] !== '') return script[key];
    }
    return '';
}

function isWechatRegexScriptEnabled(script) {
    if (!script || typeof script !== 'object') return false;
    if (script.enabled === false || script.disabled === true || script.isDisabled === true) return false;
    if (String(script.enabled).toLowerCase() === 'false') return false;
    if (String(script.disabled).toLowerCase() === 'true') return false;
    return true;
}

function processMsgContent(content, char) {
    if (!content) return "";
    let text = cleanWechatVisibleContent(content);
    if (!text) return "";

    text = fillWechatRegexTemplate(text, char);

    // 1. 执行正则脚本
    const globalScripts = window.globalRegexScripts || [];
    const charScripts = char.regex || [];
    const allScripts = [...globalScripts, ...charScripts];

    allScripts.forEach(script => {
        if (!isWechatRegexScriptEnabled(script)) return; // 🔥 跳过已关闭的脚本
        try {
            const regexStr = getWechatRegexScriptField(script, ['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']);
            let replaceStr = getWechatRegexScriptField(script, ['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']);
            if (regexStr) {
                let pattern = fillWechatRegexTemplate(regexStr, char);
                let flags = 'g'; 
                if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
                    const lastSlash = pattern.lastIndexOf('/');
                    flags = pattern.substring(lastSlash + 1).replace(/[^gimsuy]/g, '');
                    pattern = pattern.substring(1, lastSlash);
                }
                const re = new RegExp(pattern, flags);
                if (replaceStr && typeof replaceStr === 'string') {
                    replaceStr = fillWechatRegexTemplate(replaceStr, char).replace(/\{\{match\}\}/gi, '$&');
                }
                text = text.replace(re, replaceStr);
            }
        } catch (e) { console.warn("正则执行失败:", script.name, e); }
    });

    text = cleanWechatVisibleContent(text);
    if (!text) return "";

    // 2. 剥离 Markdown 代码块包装（支持混合内容：文本 + 代码块）
    // 先处理内嵌的 ```html...``` 代码块，提取其中的HTML
    text = text.replace(/```(?:html|xml|markdown)?\s*([\s\S]*?)```/gi, function(match, code) {
        return code.trim();
    });

    // 如果处理后包含HTML标签，直接返回（不做换行转换，避免破坏HTML结构）
    if (/<(div|style|script|table|iframe|img|span|section|header|article|button)/i.test(text)) {
        return text;
    } else {
        return text.replace(/\n/g, '<br>'); 
    }
}

// 微信聊天窗口
function openChat(charId) {
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    window.currentChatCharId = charId;

    const config = char.chatConfig || {};
    document.getElementById('chat-room-title').textContent = config.nickname || char.name;
    const floatImg = document.getElementById('wc-float-avatar-img');
    const floatName = document.getElementById('wc-float-name');
    if (floatImg) floatImg.src = char.avatar || DEFAULT_AVATAR;
    if (floatName) floatName.textContent = config.nickname || char.name;
    let touchedMessageTime = false;
    (char.history || []).forEach(msg => {
        if (ensureMessageTimestamp(msg)) touchedMessageTime = true;
    });
    if (touchedMessageTime) saveCharactersToStorage();
    // 应用聊天配置（背景/气泡/字体）
    applyChatConfig(char);
    refreshChatView(char);

    const room = document.getElementById('wechat-chat-room');
    room.classList.remove('hidden');
    setTimeout(() => room.classList.add('active'), 10);
}

// 2. 修复切换开场白导致微信也变的问题 (数据分离)
function switchGreeting(direction) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    const allGreetings = [char.first_mes_original || char.first_mes, ...(char.alternates || [])].filter(t => t);
    
    if (typeof char.currentGreetingIndex === 'undefined') char.currentGreetingIndex = 0;

    let newIndex = char.currentGreetingIndex + direction;
    if (newIndex < 0) newIndex = allGreetings.length - 1; 
    if (newIndex >= allGreetings.length) newIndex = 0; 

    // 🔥 核心修改：只更新“索引”，绝对不去改 history 里的内容！
    // 微信读取的是 history，所以微信永远不变。
    // 当前问候语索引会影响角色开场白。
    char.currentGreetingIndex = newIndex;
    
    // 注意：这里不再调用 openChat 刷新微信，因为微信不需要变
}

function createMessageTimestamp() {
    return Date.now();
}

function padWechatDatePart(value) {
    return String(value).padStart(2, '0');
}

function toWechatDatetimeLocalValue(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return `${safeDate.getFullYear()}-${padWechatDatePart(safeDate.getMonth() + 1)}-${padWechatDatePart(safeDate.getDate())}T${padWechatDatePart(safeDate.getHours())}:${padWechatDatePart(safeDate.getMinutes())}`;
}

function formatWechatDateTimeForPrompt(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${safeDate.getFullYear()}年${safeDate.getMonth() + 1}月${safeDate.getDate()}日 ${weekdays[safeDate.getDay()]} ${padWechatDatePart(safeDate.getHours())}:${padWechatDatePart(safeDate.getMinutes())}`;
}

function getWechatCurrentTimeContext(char) {
    const config = (char && char.chatConfig) || {};
    const mode = config.timeMode === 'virtual' ? 'virtual' : 'real';
    const rawTime = mode === 'virtual' ? config.virtualTime : null;
    const date = rawTime ? new Date(rawTime) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return {
        mode,
        label: mode === 'virtual' ? '虚拟时间' : '真实世界时间',
        text: formatWechatDateTimeForPrompt(safeDate),
        iso: safeDate.toISOString()
    };
}

function ensureMessageTimestamp(msg) {
    if (!msg.timestamp && !msg.createdAt && !msg.time) {
        msg.timestamp = createMessageTimestamp();
        return true;
    }
    return false;
}

function formatMessageTime(msg) {
    const rawTime = msg.timestamp || msg.createdAt || msg.time;
    const date = rawTime ? new Date(rawTime) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return `${String(safeDate.getHours()).padStart(2, '0')}:${String(safeDate.getMinutes()).padStart(2, '0')}`;
}

function buildMessageMeta(msg) {
    const readIcon = '<i class="ri-check-double-line"></i>';
    return `<span class="msg-meta ${msg.isMe ? 'read' : 'delivered'}"><span>${formatMessageTime(msg)}</span>${readIcon}</span>`;
}

function parseWechatRgbColor(value) {
    const text = String(value || '').trim();
    if (!text || text === 'transparent') return null;
    const rgba = text.match(/^rgba?\(([^)]+)\)$/i);
    if (rgba) {
        const parts = rgba[1].split(',').map(part => parseFloat(part.trim()));
        if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
            const alpha = Number.isFinite(parts[3]) ? parts[3] : 1;
            if (alpha <= 0.02) return null;
            return { r: parts[0], g: parts[1], b: parts[2], a: alpha };
        }
    }
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        const raw = hex[1].length === 3
            ? hex[1].split('').map(ch => ch + ch).join('')
            : hex[1];
        return {
            r: parseInt(raw.slice(0, 2), 16),
            g: parseInt(raw.slice(2, 4), 16),
            b: parseInt(raw.slice(4, 6), 16),
            a: 1
        };
    }
    return null;
}

function getWechatColorLuminance(color) {
    const channel = value => {
        const normalized = Math.max(0, Math.min(255, value)) / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function findWechatPaintedBackground(el) {
    let current = el;
    while (current && current.nodeType === 1) {
        const style = getComputedStyle(current);
        const bg = parseWechatRgbColor(style.backgroundColor);
        if (bg) return bg;
        const imageColor = String(style.backgroundImage || '').match(/rgba?\([^)]+\)|#[0-9a-f]{3,6}/i);
        if (imageColor) {
            const parsed = parseWechatRgbColor(imageColor[0]);
            if (parsed) return parsed;
        }
        current = current.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
}

function applyWechatBubbleMetaContrast(scope) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;
    scope.querySelectorAll('.msg-bubble').forEach(bubble => {
        const color = findWechatPaintedBackground(bubble);
        const isDark = getWechatColorLuminance(color) < 0.48;
        bubble.style.setProperty('--msg-meta-color', isDark ? 'rgba(255,255,255,0.78)' : 'rgba(23,33,43,0.50)');
        bubble.style.setProperty('--msg-meta-icon-color', isDark ? 'rgba(255,255,255,0.88)' : '#4aa3ff');
    });
    scope.querySelectorAll('.msg-meta').forEach(meta => {
        const source = meta.closest('.msg-card-footer') || meta.closest('.msg-bubble') || meta;
        const color = findWechatPaintedBackground(source);
        const isDark = getWechatColorLuminance(color) < 0.48;
        const metaColor = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(23,33,43,0.50)';
        const iconColor = isDark ? 'rgba(255,255,255,0.88)' : '#4aa3ff';
        meta.style.setProperty('color', metaColor, 'important');
        meta.querySelectorAll('i').forEach(icon => icon.style.setProperty('color', iconColor, 'important'));
    });
}

function isRichMessageContent(content) {
    return /<(div|style|script|table|iframe|img|span|section|header|article|button|ul|ol|li|p|video|audio|svg|canvas)\b/i.test(content);
}

function cleanWechatVisibleContent(value) {
    const externalCleaner = typeof window.cleanChatApiVisibleContent === 'function'
        ? window.cleanChatApiVisibleContent
        : null;
    let text = externalCleaner ? externalCleaner(value) : String(value == null ? '' : value);
    if (!text) return '';

    const hiddenTags = [
        'thinking',
        'think',
        'thought',
        'execute_think',
        'cot',
        'analysis',
        'reasoning',
        'chain_of_thought'
    ];

    hiddenTags.forEach(tag => {
        text = text.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    });

    return text
        .replace(/<\/?(?:thinking|think|thought|execute_think|cot|analysis|reasoning|chain_of_thought)\b[^>]*>/gi, '')
        .replace(/<content\b[^>]*>([\s\S]*?)<\/content>/gi, '$1')
        .replace(/<\/?content\b[^>]*>/gi, '')
        .replace(/^\s*(?:思考完毕[，,。；;：:]?\s*)+/i, '')
        .replace(/^\s*(?:生成回复[，,。；;：:]?\s*)+/i, '')
        .trim();
}

function wcEscapeHtml(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value == null ? '' : String(value));
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function quoteWechatJsString(value) {
    const json = JSON.stringify(String(value == null ? '' : value)
    )
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    return json
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
}

function getWechatCssUrl(value) {
    const safe = String(value == null ? '' : value)
        .replace(/'/g, '%27')
        .replace(/"/g, '%22')
        .replace(/\)/g, '%29')
        .replace(/[\r\n]/g, '');
    return `url('${wcEscapeHtml(safe)}')`;
}

function isWechatSpecialMessage(type) {
    return ['voice', 'transfer', 'redpacket', 'voiceCall', 'videoCall'].includes(type);
}

function parseWechatAmountNumber(value) {
    const num = parseFloat(String(value || '').replace(/[^\d.]/g, ''));
    return Number.isFinite(num) && num > 0 ? num : null;
}

function normalizeWechatAmount(value, fallback = '0.00') {
    const num = parseWechatAmountNumber(value);
    if (num == null) return fallback;
    return num.toFixed(2);
}

function normalizeWechatDuration(value, fallback) {
    const num = parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(num) || num <= 0) return fallback;
    return Math.min(num, 5999);
}

function isWechatDurationArg(value) {
    return /^\s*\d+\s*(?:秒|s|S)?\s*$/.test(String(value || ''));
}

function formatWechatDuration(seconds) {
    const sec = normalizeWechatDuration(seconds, 1);
    if (sec < 60) return `${sec}秒`;
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return rest ? `${min}分${String(rest).padStart(2, '0')}秒` : `${min}分钟`;
}

function estimateWechatVoiceDuration(text) {
    const source = String(text || '').trim();
    if (!source) return 1;
    const cjkCount = (source.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
    const asciiText = source.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ');
    const wordTokens = (asciiText.match(/[A-Za-z0-9]+/g) || [])
        .reduce((sum, word) => sum + Math.max(1, Math.ceil(word.length / 4)), 0);
    const punctuationTokens = Math.ceil(((source.match(/[，。！？、,.!?;；:：]/g) || []).length) * 0.35);
    const tokenCount = Math.max(1, cjkCount + wordTokens + punctuationTokens);
    return Math.max(1, Math.min(90, Math.ceil(tokenCount / 3.8)));
}

function updateWechatVoiceDurationEstimate() {
    const transcript = document.getElementById('wc-compose-transcript')?.value || '';
    const duration = estimateWechatVoiceDuration(transcript);
    const label = document.getElementById('wc-compose-duration-estimate');
    if (label) label.textContent = `${duration}"`;
}

function toggleWechatVoiceTranscript(bubbleEl) {
    if (!bubbleEl || !bubbleEl.querySelector('.msg-voice-transcript')) return;
    bubbleEl.classList.toggle('show-transcript');
}

function getWechatCallDescription(msg) {
    const status = msg.status || '已结束';
    const duration = parseInt(msg.duration, 10);
    const reason = msg.reason || msg.note || '';
    if (status === '已结束' && Number.isFinite(duration) && duration > 0) {
        return reason ? `${status} · ${formatWechatDuration(duration)} · ${reason}` : `${status} · ${formatWechatDuration(duration)}`;
    }
    return reason ? `${status} · ${reason}` : status;
}

function getWechatMessageSummary(msg) {
    if (!msg) return '[消息]';
    if (msg.description) return msg.description;
    if (msg.type === 'voice') {
        const text = msg.transcript ? ` ${msg.transcript}` : '';
        return `[语音 ${formatWechatDuration(msg.duration || 8)}]${text}`;
    }
    if (msg.type === 'transfer') {
        const note = msg.note ? ` ${msg.note}` : '';
        return msg.receipt ? `[已收取转账 ¥${normalizeWechatAmount(msg.amount)}]${note}` : `[转账 ¥${normalizeWechatAmount(msg.amount)}]${note}`;
    }
    if (msg.type === 'redpacket') {
        const title = msg.title || msg.note || '恭喜发财，大吉大利';
        const status = msg.status ? ` ${msg.status}` : '';
        return msg.receipt ? `[已收取红包] ${title}` : `[红包${status}] ${title}`;
    }
    if (msg.type === 'voiceCall') {
        return `[语音通话] ${getWechatCallDescription(msg)}`;
    }
    if (msg.type === 'videoCall') {
        return `[视频通话] ${getWechatCallDescription(msg)}`;
    }
    return String(msg.content || '[消息]');
}

function syncWechatMessageDescription(msg) {
    if (!msg) return msg;
    if (isWechatSpecialMessage(msg.type)) {
        msg.description = getWechatMessageSummary({ ...msg, description: '' });
        if (!msg.content || msg.type !== 'voice') msg.content = msg.description;
    }
    return msg;
}

function splitWechatDirectiveArgs(raw) {
    return String(raw || '').split('|').map(part => part.trim());
}

function buildWechatMessageFromAiDirective(command, rawArgs) {
    const args = splitWechatDirectiveArgs(rawArgs);
    const base = { isMe: false, timestamp: createMessageTimestamp() };

    if (command === '微信转账') {
        if (parseWechatAmountNumber(args[0]) == null) return null;
        return syncWechatMessageDescription({
            ...base,
            type: 'transfer',
            amount: normalizeWechatAmount(args[0]),
            note: args.slice(1).join('|').trim()
        });
    }

    if (command === '微信红包') {
        const msg = {
            ...base,
            type: 'redpacket',
            title: args[0] || '恭喜发财，大吉大利',
            status: args[2] || '已领取'
        };
        if (parseWechatAmountNumber(args[1]) != null) msg.amount = normalizeWechatAmount(args[1]);
        return syncWechatMessageDescription(msg);
    }

    if (command === '微信语音') {
        const firstArgIsDuration = args.length > 1 && isWechatDurationArg(args[0]);
        const transcript = firstArgIsDuration ? args.slice(1).join('|').trim() : args.join('|').trim();
        const explicitDuration = firstArgIsDuration ? normalizeWechatDuration(args[0], 0) : 0;
        const duration = explicitDuration > 0 ? explicitDuration : estimateWechatVoiceDuration(transcript);
        return syncWechatMessageDescription({
            ...base,
            type: 'voice',
            duration,
            transcript,
            content: transcript || `[语音 ${formatWechatDuration(duration)}]`
        });
    }

    if (command === '微信语音电话' || command === '微信视频电话') {
        return syncWechatMessageDescription({
            ...base,
            type: command === '微信视频电话' ? 'videoCall' : 'voiceCall',
            status: '来电',
            reason: args.join('|').trim(),
            duration: 0
        });
    }

    return null;
}

function parseWechatAiMessageParts(text) {
    const source = cleanWechatVisibleContent(text);
    if (!source) return [];

    const parts = [];
    const directiveRe = /\[(微信转账|微信红包|微信语音电话|微信视频电话|微信语音)[：:]([^\]]*)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = directiveRe.exec(source)) !== null) {
        const before = source.slice(lastIndex, match.index).trim();
        if (before) parts.push({ kind: 'text', content: before });

        const msg = buildWechatMessageFromAiDirective(match[1], match[2]);
        if (msg) parts.push({ kind: 'special', msg });
        lastIndex = directiveRe.lastIndex;
    }

    const after = source.slice(lastIndex).trim();
    if (after) parts.push({ kind: 'text', content: after });
    return parts.length ? parts : [{ kind: 'text', content: source }];
}

function buildWechatSpecialBubble(msg) {
    const metaHtml = buildMessageMeta(msg);
    const sideClass = msg.isMe ? ' green' : '';

    if (msg.type === 'voice') {
        const duration = normalizeWechatDuration(msg.duration, 8);
        const width = Math.min(236, Math.max(110, 96 + duration * 2.2));
        const transcript = msg.transcript ? `<div class="msg-voice-transcript">${wcEscapeHtml(msg.transcript)}</div>` : '';
        return `
            <div class="msg-bubble msg-voice-bubble${sideClass}" style="--voice-width:${width}px;" onclick="event.stopPropagation();toggleWechatVoiceTranscript(this)">
                <div class="msg-voice-line">
                    <span class="msg-voice-waves"><b></b><b></b><b></b><b></b><b></b></span>
                    <span class="msg-voice-duration">${duration}"</span>
                </div>
                ${transcript}
                ${metaHtml}
            </div>
        `;
    }

    if (msg.type === 'transfer') {
        const amount = normalizeWechatAmount(msg.amount);
        const isReceipt = !!msg.receipt;
        const title = isReceipt ? '已收取转账' : '转账';
        const note = isReceipt ? (msg.note || '已存入零钱') : (msg.note || (msg.isMe ? '转账给对方' : '转账给你'));
        const footer = isReceipt ? '微信转账已收取' : '微信转账';
        return `
            <div class="msg-bubble msg-pay-bubble msg-transfer-bubble${isReceipt ? ' msg-pay-receipt' : ''}${sideClass}">
                <div class="msg-pay-main">
                    <div class="msg-pay-icon"><i class="ri-money-cny-circle-fill"></i></div>
                    <div class="msg-pay-info">
                        <div class="msg-pay-title">${title}</div>
                        <div class="msg-pay-amount">¥${wcEscapeHtml(amount)}</div>
                        <div class="msg-pay-note">${wcEscapeHtml(note)}</div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>${footer}</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'redpacket') {
        const title = msg.title || msg.note || '恭喜发财，大吉大利';
        const amount = msg.amount ? `<div class="msg-rp-amount">¥${wcEscapeHtml(normalizeWechatAmount(msg.amount))}</div>` : '';
        const isReceipt = !!msg.receipt;
        return `
            <div class="msg-bubble msg-pay-bubble msg-redpacket-bubble${isReceipt ? ' msg-pay-receipt' : ''}${sideClass}">
                <div class="msg-pay-main">
                    <div class="msg-pay-icon"><i class="ri-red-packet-fill"></i></div>
                    <div class="msg-pay-info">
                        <div class="msg-pay-title">${wcEscapeHtml(isReceipt ? '已收取红包' : title)}</div>
                        ${amount}
                        <div class="msg-pay-note">${wcEscapeHtml(isReceipt ? title : (msg.status || '微信红包'))}</div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>${isReceipt ? '微信红包已收取' : '微信红包'}</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'voiceCall' || msg.type === 'videoCall') {
        const isVideo = msg.type === 'videoCall';
        const title = isVideo ? '视频通话' : '语音通话';
        const icon = isVideo ? 'ri-video-chat-fill' : 'ri-phone-fill';
        const desc = getWechatCallDescription(msg);
        return `
            <div class="msg-bubble msg-call-bubble${sideClass}">
                <div class="msg-call-main">
                    <div class="msg-call-icon"><i class="${icon}"></i></div>
                    <div class="msg-call-info">
                        <div class="msg-call-title">${title}</div>
                        <div class="msg-call-desc">${wcEscapeHtml(desc)}</div>
                    </div>
                </div>
                ${metaHtml}
            </div>
        `;
    }

    return '';
}

// 🔥 微信渲染逻辑：只显示纯文本 (Clean & Simple)
function renderMessageBubble(container, msg, avatarUrl, charObj, msgIndex) {
    const row = document.createElement('div');
    row.className = `msg-row ${msg.isMe ? 'right' : 'left'}`;
    if (typeof msgIndex === 'number') row.dataset.msgIdx = msgIndex;

    if (msg.type === 'system_notice') {
        row.className = 'msg-row system';
        row.innerHTML = `<div class="msg-system-notice">${wcEscapeHtml(msg.content || '')}</div>`;
        container.appendChild(row);
        return;
    }

    const profile = getUserProfile();
    const myAvatar = profile.avatar || DEFAULT_AVATAR;

    const currentAvatar = msg.isMe ? myAvatar : avatarUrl;

    const config = charObj.chatConfig || {};
    const fontSize = config.fontSize || 15;

    let bubbleHtml = '';
    const avatarClass = msg.isMe ? 'msg-avatar' : 'msg-avatar msg-avatar-ai';
    const avatarHtml = `<img class="${avatarClass}" src="${currentAvatar}">`;

    if (msg.type === 'sticker') {
        const inner = `<div class="msg-bubble sticker"><img src="${msg.content}" alt="${msg.stickerName || ''}"><span class="msg-media-meta">${formatMessageTime(msg)}<i class="ri-check-double-line"></i></span></div>`;
        bubbleHtml = msg.isMe ? avatarHtml + inner : avatarHtml + `<div class="msg-bubble-shell media">${inner}</div>`;
    } else if (msg.type === 'image') {
        const inner = `<div class="msg-bubble image-bubble"><img src="${msg.content}"><span class="msg-media-meta">${formatMessageTime(msg)}<i class="ri-check-double-line"></i></span></div>`;
        bubbleHtml = msg.isMe ? avatarHtml + inner : avatarHtml + `<div class="msg-bubble-shell media">${inner}</div>`;
    } else if (isWechatSpecialMessage(msg.type)) {
        syncWechatMessageDescription(msg);
        const inner = buildWechatSpecialBubble(msg);
        bubbleHtml = msg.isMe ? avatarHtml + inner : avatarHtml + `<div class="msg-bubble-shell">${inner}</div>`;
    } else {
        let rawContent = processMsgContent(msg.content, charObj);
        const metaHtml = buildMessageMeta(msg);
        const isRich = isRichMessageContent(rawContent);
        const richClass = isRich ? ' rich' : '';

        if (msg.isMe) {
            bubbleHtml = avatarHtml + `<div class="msg-bubble green${richClass}" style="font-size:${fontSize}px;"><div class="msg-text${richClass}">${rawContent}</div>${metaHtml}</div>`;
        } else {
            bubbleHtml = avatarHtml + `<div class="msg-bubble-shell"><div class="msg-bubble${richClass}" style="font-size:${fontSize}px;"><div class="msg-text${richClass}">${rawContent}</div>${metaHtml}</div></div>`;
        }
    }

    row.innerHTML = bubbleHtml;
    container.appendChild(row);
    executeScriptsInElement(row);
    applyWechatBubbleMetaContrast(row);
    if (!msg.isMe) bindWechatAiAvatarInteractions(row, charObj);
    // 长按气泡弹出操作菜单
    if (typeof msgIndex === 'number') {
        let pressTimer = null;
        row.addEventListener('click', (e) => {
            if (!window._msgMultiSelectMode) return;
            e.preventDefault();
            e.stopPropagation();
            toggleMsgSelect(msgIndex, row);
        }, true);
        const startPress = (e) => {
            if (window._msgMultiSelectMode) return;
            if (isWechatRichInteractiveTarget(e.target)) return;
            pressTimer = setTimeout(() => {
                e.preventDefault();
                showMsgActionMenu(msgIndex, msg.isMe, row);
            }, 500);
        };
        const cancelPress = () => { clearTimeout(pressTimer); };
        row.addEventListener('touchstart', startPress, { passive: true });
        row.addEventListener('touchend', cancelPress);
        row.addEventListener('touchmove', cancelPress);
        row.addEventListener('mousedown', startPress);
        row.addEventListener('mouseup', cancelPress);
        row.addEventListener('mouseleave', cancelPress);
        row.addEventListener('dblclick', (e) => {
            if (window._msgMultiSelectMode) return;
            if (isWechatRichInteractiveTarget(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            clearTimeout(pressTimer);
            showMsgActionMenu(msgIndex, msg.isMe, row);
        });
    }
}

function bindWechatAiAvatarInteractions(row, charObj) {
    const avatarEl = row && row.querySelector ? row.querySelector('.msg-avatar-ai') : null;
    if (!avatarEl || !charObj) return;

    let clickTimer = null;
    const stopAvatarBubble = (event) => {
        event.stopPropagation();
    };
    avatarEl.addEventListener('mousedown', stopAvatarBubble);
    avatarEl.addEventListener('mouseup', stopAvatarBubble);
    avatarEl.addEventListener('touchstart', stopAvatarBubble, { passive: true });
    avatarEl.addEventListener('touchend', stopAvatarBubble);
    avatarEl.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => openWechatAiStatusTicket(charObj.id), 220);
    });
    avatarEl.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(clickTimer);
        openWechatAiPhone(charObj.id);
    });
}

function isWechatRichInteractiveTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    if (!target.closest('.msg-text.rich')) return false;
    return !!target.closest('a, button, input, select, textarea, label, summary, details, [role="button"], .wc-rich-clickable, [data-wc-rich-click]');
}

// ========== 气泡操作菜单（长按触发） ==========

window._msgMultiSelectMode = false;
window._msgSelectedIndexes = new Set();

function showMsgActionMenu(msgIdx, isMe, rowEl) {
    // 如果在多选模式，点击是切换选中
    if (window._msgMultiSelectMode) {
        toggleMsgSelect(msgIdx, rowEl);
        return;
    }
    // 关闭已有菜单
    closeMsgActionMenu();
    const menu = document.createElement('div');
    menu.className = 'msg-action-menu';
    menu.id = 'msg-action-menu';

    let html = `<div class="msg-action-item" onclick="editSingleMsg(${msgIdx})"><i class="ri-edit-line"></i> 编辑</div>`;
    html += `<div class="msg-action-item" onclick="deleteSingleMsg(${msgIdx})"><i class="ri-delete-bin-line"></i> 删除</div>`;
    if (!isMe) {
        html += `<div class="msg-action-item" onclick="collectWechatMessage(${msgIdx})"><i class="ri-star-line"></i> 收藏</div>`;
        html += `<div class="msg-action-item" onclick="rerollMsg(${msgIdx})"><i class="ri-refresh-line"></i> 重新roll</div>`;
    }
    html += `<div class="msg-action-item" onclick="enterMsgMultiSelect(${msgIdx})"><i class="ri-checkbox-multiple-line"></i> 多选删除</div>`;
    menu.innerHTML = html;

    rowEl.style.position = 'relative';
    rowEl.appendChild(menu);

    // 点击其他地方关闭
    setTimeout(() => {
        document.addEventListener('click', _closeMsgMenuHandler, { once: true });
    }, 50);
}

function _closeMsgMenuHandler(e) {
    const menu = document.getElementById('msg-action-menu');
    if (menu && !menu.contains(e.target)) closeMsgActionMenu();
}

function closeMsgActionMenu() {
    const menu = document.getElementById('msg-action-menu');
    if (menu) menu.remove();
}

function deleteSingleMsg(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history) return;
    if (msgIdx < 0 || msgIdx >= char.history.length) return;
    char.history.splice(msgIdx, 1);
    saveCharactersToStorage();
    refreshChatView(char);
}

function editSingleMsg(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history || msgIdx < 0 || msgIdx >= char.history.length) return;
    const msg = char.history[msgIdx];
    if (isWechatSpecialMessage(msg.type)) {
        openWechatComposer(msg.type, msgIdx);
        return;
    }
    openWechatMessageEditor(msgIdx);
}

function rerollMsg(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history) return;
    // 删掉这条及之后所有AI消息，重新触发AI
    // 找到这条消息，它应该是AI的
    if (msgIdx < 0 || msgIdx >= char.history.length) return;
    // 删掉从 msgIdx 开始的所有消息
    char.history.splice(msgIdx);
    saveCharactersToStorage();
    refreshChatView(char);
    // 重新触发AI回复
    const contentEl = document.getElementById('chat-room-content');
    triggerAiAfterMessage(char, contentEl);
}

function enterMsgMultiSelect(initialMsgIdx) {
    closeMsgActionMenu();
    window._msgMultiSelectMode = true;
    window._msgSelectedIndexes = new Set();
    // 显示底部多选操作栏
    const footer = document.querySelector('.wc-room-footer');
    if (footer) footer.classList.add('hidden');
    let bar = document.getElementById('msg-multiselect-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'msg-multiselect-bar';
        bar.className = 'msg-multiselect-bar';
        bar.innerHTML = `
            <span id="msg-select-count">已选 0 条</span>
            <div style="display:flex;gap:10px;">
                <span class="msg-ms-btn delete" onclick="deleteSelectedMsgs()">删除</span>
                <span class="msg-ms-btn cancel" onclick="exitMsgMultiSelect()">取消</span>
            </div>
        `;
        const room = document.getElementById('wechat-chat-room');
        room.appendChild(bar);
    }
    bar.classList.remove('hidden');
    if (Number.isInteger(initialMsgIdx)) {
        const initialRow = document.querySelector(`.msg-row[data-msg-idx="${initialMsgIdx}"]`);
        if (initialRow) toggleMsgSelect(initialMsgIdx, initialRow);
    }
}

function exitMsgMultiSelect() {
    window._msgMultiSelectMode = false;
    window._msgSelectedIndexes = new Set();
    const bar = document.getElementById('msg-multiselect-bar');
    if (bar) bar.classList.add('hidden');
    const footer = document.querySelector('.wc-room-footer');
    if (footer) footer.classList.remove('hidden');
    // 去掉所有选中样式
    document.querySelectorAll('.msg-row.selected').forEach(r => r.classList.remove('selected'));
}

function toggleMsgSelect(msgIdx, rowEl) {
    if (window._msgSelectedIndexes.has(msgIdx)) {
        window._msgSelectedIndexes.delete(msgIdx);
        rowEl.classList.remove('selected');
    } else {
        window._msgSelectedIndexes.add(msgIdx);
        rowEl.classList.add('selected');
    }
    const countEl = document.getElementById('msg-select-count');
    if (countEl) countEl.textContent = `已选 ${window._msgSelectedIndexes.size} 条`;
}

function deleteSelectedMsgs() {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history) return;
    if (window._msgSelectedIndexes.size === 0) return;
    if (!confirm(`确定删除 ${window._msgSelectedIndexes.size} 条消息吗？`)) return;
    // 从大到小删，避免索引错位
    const sorted = [...window._msgSelectedIndexes].sort((a, b) => b - a);
    sorted.forEach(idx => {
        if (idx >= 0 && idx < char.history.length) char.history.splice(idx, 1);
    });
    saveCharactersToStorage();
    exitMsgMultiSelect();
    refreshChatView(char);
}

function isWechatHistoryExpanded(char) {
    if (!char) return false;
    window._wechatExpandedHistoryIds = window._wechatExpandedHistoryIds || new Set();
    return window._wechatExpandedHistoryIds.has(char.id);
}

function appendWechatHistoryDivider(container, char, count, expanded) {
    const divider = document.createElement('div');
    divider.className = 'msg-collapse-divider';
    divider.innerHTML = expanded
        ? `<i class="ri-arrow-up-s-line"></i><span>收起早期消息</span>`
        : `<i class="ri-history-line"></i><span>已折叠 ${count} 条早期消息</span><b>展开</b>`;
    divider.onclick = () => toggleWechatCollapsedHistory(char.id);
    container.appendChild(divider);
}

function toggleWechatCollapsedHistory(charId) {
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    window._wechatExpandedHistoryIds = window._wechatExpandedHistoryIds || new Set();
    if (window._wechatExpandedHistoryIds.has(charId)) {
        window._wechatExpandedHistoryIds.delete(charId);
    } else {
        window._wechatExpandedHistoryIds.add(charId);
    }
    refreshChatView(char);
}

function refreshChatView(char) {
    const contentEl = document.getElementById('chat-room-content');
    if (!contentEl) return;
    contentEl.innerHTML = '';
    const history = char.history || [];
    const expanded = isWechatHistoryExpanded(char);
    let startIndex = 0;
    if (history.length > WECHAT_AUTO_COLLAPSE_AFTER) {
        const collapsedCount = Math.max(0, history.length - WECHAT_COLLAPSE_KEEP_RECENT);
        if (expanded) {
            appendWechatHistoryDivider(contentEl, char, collapsedCount, true);
        } else {
            startIndex = collapsedCount;
            appendWechatHistoryDivider(contentEl, char, collapsedCount, false);
        }
    }
    history.slice(startIndex).forEach((msg, offset) => {
        const index = startIndex + offset;
        renderMessageBubble(contentEl, msg, char.avatar, char, index);
    });
    contentEl.scrollTop = contentEl.scrollHeight;
    requestAnimationFrame(() => { contentEl.scrollTop = contentEl.scrollHeight; });
    setTimeout(() => { contentEl.scrollTop = contentEl.scrollHeight; }, 180);
}

function getWechatPaymentReceiptId(msg, index) {
    return msg.receiptFor || msg.paymentId || msg.timestamp || `${msg.type}_${index}`;
}

function buildWechatPaymentReceiptMessage(msg, receiptFor) {
    const receipt = {
        type: msg.type,
        isMe: false,
        receipt: true,
        receiptFor,
        amount: msg.amount,
        title: msg.title,
        note: msg.note,
        status: '已收取',
        timestamp: createMessageTimestamp()
    };
    if (msg.type === 'transfer' && !receipt.note) receipt.note = '已存入零钱';
    if (msg.type === 'redpacket' && !receipt.title) receipt.title = '恭喜发财，大吉大利';
    return syncWechatMessageDescription(receipt);
}

function markPendingUserPaymentsCollected(char) {
    if (!char || !Array.isArray(char.history)) return false;
    let changed = false;
    const existingReceipts = new Set(
        char.history
            .filter(msg => msg && msg.receipt && msg.receiptFor)
            .map(msg => msg.receiptFor)
    );
    const receipts = [];

    char.history.forEach((msg, index) => {
        if (!msg || msg.receipt || !msg.isMe || !['transfer', 'redpacket'].includes(msg.type)) return;
        const receiptFor = getWechatPaymentReceiptId(msg, index);
        if (!msg.receiptCreated) {
            ensureMessageTimestamp(msg);
            msg.status = '已收取';
            msg.receiptCreated = true;
            msg.collectedAt = createMessageTimestamp();
            syncWechatMessageDescription(msg);
            changed = true;
        }
        if (!existingReceipts.has(receiptFor)) {
            receipts.push(buildWechatPaymentReceiptMessage(msg, receiptFor));
            existingReceipts.add(receiptFor);
            changed = true;
        } else if (msg.type === 'redpacket' && (!msg.status || msg.status === '待收取')) {
            msg.status = '已收取';
            syncWechatMessageDescription(msg);
            changed = true;
        }
    });
    if (receipts.length) char.history.push(...receipts);
    return changed;
}

function appendWechatAiMessageParts(char, contentEl, text) {
    const parsedParts = parseWechatAiMessageParts(cleanWechatVisibleContent(text));
    parsedParts.forEach(part => {
        const aiMsg = part.kind === 'special'
            ? part.msg
            : { type: 'text', isMe: false, content: cleanWechatVisibleContent(part.content), timestamp: createMessageTimestamp() };
        if (!aiMsg || (!aiMsg.content && !isWechatSpecialMessage(aiMsg.type))) return;
        if (isWechatIncomingCallMessage(aiMsg)) {
            handleWechatIncomingCall(char, aiMsg);
            return;
        }
        char.history.push(aiMsg);
        refreshChatView(char);
    });
}

function findWechatRichFunction(element, functionName) {
    if (!element || !functionName) return null;
    let scope = element;
    while (scope) {
        if (typeof scope[functionName] === 'function') return scope[functionName].bind(scope);
        scope = scope.parentElement || (scope.getRootNode && scope.getRootNode().host) || null;
    }
    return typeof window[functionName] === 'function' ? window[functionName].bind(window) : null;
}

function closeWechatRichModal(modal) {
    if (!modal) return;
    modal.classList.remove('visible', 'active', 'show', 'open');
    modal.style.display = 'none';
}

function openWechatRichModal(trigger, rootElement) {
    const richRoot = (trigger && trigger.closest && trigger.closest('.msg-text.rich')) || rootElement;
    if (!richRoot || !richRoot.querySelector) return false;

    const modal = richRoot.querySelector('.modal-overlay, .secret-modal, [id*="secretModal"], [class*="modal"]');
    if (!modal) return false;

    const host = (typeof getWechatModalRoot === 'function' ? getWechatModalRoot() : document.body) || document.body;
    if (modal.parentElement !== host) host.appendChild(modal);

    modal.classList.add('visible', 'active', 'show', 'open');
    Object.assign(modal.style, {
        display: 'flex',
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        zIndex: '3800',
        maxWidth: 'none',
        maxHeight: 'none',
        pointerEvents: 'auto'
    });

    if (modal.dataset.wcRichModalBound !== '1') {
        modal.dataset.wcRichModalBound = '1';
        modal.addEventListener('click', event => {
            const target = event.target;
            if (target === modal || (target && target.closest && target.closest('.close-modal, .wc-rich-modal-close'))) {
                event.preventDefault();
                event.stopPropagation();
                closeWechatRichModal(modal);
            }
        });
    }
    return true;
}

function decryptWechatRichSection(trigger) {
    if (!trigger || typeof trigger.closest !== 'function') return false;
    const section = trigger.closest('.encrypted-section');
    const overlay = section
        ? (section.querySelector('.encrypted-overlay') || trigger.closest('.encrypted-overlay'))
        : trigger.closest('.encrypted-overlay');
    if (!overlay) return false;

    overlay.classList.add('decrypted');
    overlay.style.pointerEvents = 'none';
    const progressBar = section && section.querySelector('.progress-bar-value');
    if (progressBar) progressBar.style.width = progressBar.style.width;
    return true;
}

function findWechatRichDecryptTrigger(target) {
    if (!target || typeof target.closest !== 'function') return null;
    const direct = target.closest('.decrypt-button, [data-wc-rich-original-onclick*="decryptContent"], [onclick*="decryptContent"]');
    if (direct) return direct;

    const overlay = target.closest('.encrypted-overlay');
    if (overlay) {
        const overlayText = (overlay.textContent || '').replace(/\s+/g, '');
        if (/点击解密内心深处|解密.*内心/.test(overlayText)) return overlay;
    }
    return null;
}

function ensureWechatRichDecryptDelegation() {
    if (window.__wechatRichDecryptDelegationBound === '1') return;
    window.__wechatRichDecryptDelegationBound = '1';
    document.addEventListener('click', event => {
        const trigger = findWechatRichDecryptTrigger(event.target);
        if (!trigger) return;
        if (decryptWechatRichSection(trigger)) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
    }, true);
}

function bindWechatRichRevealFallbacks(element) {
    if (!element || !element.querySelectorAll) return;
    ensureWechatRichDecryptDelegation();
    const selectorCandidates = Array.from(element.querySelectorAll('.secret-note, .secret-note-container, .encrypted-overlay, .decrypt-button, [data-secret], [data-decrypt], [data-reveal], [onclick*="decryptContent"], [onclick*="showModal"], [onclick*="hideModal"], [onclick*="secretModal"]'));
    const candidates = Array.from(new Set(selectorCandidates));
    candidates.forEach(el => {
        if (el.dataset.wcRichRevealBound === '1') return;
        const text = (el.textContent || '').replace(/\s+/g, '');
        const originalClick = el.getAttribute('onclick') || el.dataset.wcRichOriginalOnclick || '';
        const looksReveal = /点击|查看|解密|展开|内心|深处|■■|涂黑|机密|秘密|隐藏/.test(text)
            || /secret|decrypt|decode|unlock|reveal/i.test(el.className || '')
            || /decryptContent|showModal|secretModal|hideModal|closeModal/i.test(originalClick);
        if (!looksReveal) return;
        el.classList.add('wc-rich-clickable');
        el.dataset.wcRichRevealBound = '1';
        el.dataset.wcRichClick = '1';
        el.setAttribute('role', el.getAttribute('role') || 'button');
        el.setAttribute('tabindex', el.getAttribute('tabindex') || '0');
        el.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (decryptWechatRichSection(el)) return;
            const openedByFallback = openWechatRichModal(el, element);
            const runner = openedByFallback ? null : (
                findWechatRichFunction(el, 'decryptContent')
                || findWechatRichFunction(el, 'decodeContent')
                || findWechatRichFunction(el, 'unlockContent')
                || findWechatRichFunction(el, 'showModal')
                || findWechatRichFunction(el, 'showSecret')
                || findWechatRichFunction(el, 'revealSecret')
                || findWechatRichFunction(el, 'openSecret')
            );
            if (runner) {
                try {
                    runner(event);
                } catch (err) {
                    console.warn('rich reveal runner failed:', err);
                    openWechatRichModal(el, element);
                }
            }
        });
    });
}

function bindWechatRichDetailsFallbacks(element) {
    if (!element || !element.querySelectorAll) return;
    element.querySelectorAll('.msg-text.rich details > summary').forEach(summary => {
        if (summary.dataset.wcRichDetailsBound === '1') return;
        summary.dataset.wcRichDetailsBound = '1';
        summary.dataset.wcRichClick = '1';
        summary.addEventListener('click', event => {
            const details = summary.parentElement;
            if (!details || details.tagName !== 'DETAILS') return;
            event.preventDefault();
            event.stopPropagation();
            details.open = !details.open;
        });
    });
}

// 🔥 通用工具：JS 脚本激活器 (供所有 App 使用)
function executeScriptsInElement(element) {
    // 1. 激活 <script> 标签
    const scripts = element.querySelectorAll('script');
    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    // 2. 激活 <audio> 元素 — 重新创建以确保浏览器识别
    const audios = element.querySelectorAll('audio');
    audios.forEach(oldAudio => {
        const newAudio = oldAudio.cloneNode(true);
        oldAudio.parentNode.replaceChild(newAudio, oldAudio);
        newAudio.load(); // 强制加载音频源
    });

    // 3. 修复 onclick 字符串属性的按钮/元素（innerHTML 不会自动绑定）
    element.querySelectorAll('[onclick]').forEach(el => {
        const handler = el.getAttribute('onclick');
        el.classList.add('wc-rich-clickable');
        el.dataset.wcRichClick = '1';
        el.dataset.wcRichOriginalOnclick = handler || '';
        el.removeAttribute('onclick');
        el.addEventListener('click', function(e) {
            const isDecryptHandler = /decryptContent/i.test(handler || '');
            if (isDecryptHandler && decryptWechatRichSection(this)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            const isModalHandler = /showModal|secretModal|hideModal|closeModal/i.test(handler || '');
            if (isModalHandler && openWechatRichModal(this, element)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            try {
                const result = new Function('event', `with (this) { ${handler} }`).call(this, e);
                if (result === false) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            } catch(err) {
                console.warn('onclick eval error:', err);
                if (isModalHandler) {
                    openWechatRichModal(this, element);
                }
            }
        });
    });

    bindWechatRichRevealFallbacks(element);
    bindWechatRichDetailsFallbacks(element);
}

// --- 🚀 微信发送消息（只发送；点闪光按钮才触发AI） ---
function sendWechatMessage() {
    if (window._wechatAiBusy) return;
    const inputEl = document.getElementById('wc-msg-input');
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;

    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    inputEl.value = '';
    closeChatToolbar();

    const userMsg = { type: 'text', isMe: true, content: text, timestamp: createMessageTimestamp() };
    if (!char.history) char.history = [];
    char.history.push(userMsg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    maybeCaptureWechatMemoryCommand(char, text);
    if (typeof window.captureMoneyExpensesFromText === 'function') {
        window.captureMoneyExpensesFromText(text, {
            source: 'wechat',
            charId: char.id,
            charName: (char.chatConfig && char.chatConfig.nickname) || char.name || ''
        });
    }

    refreshChatView(char);
    saveCharactersToStorage();
    renderChatList();
}

// --- ✨ AI 回复按钮（点击才触发AI回复） ---
async function triggerAiReply() {
    if (window._wechatAiBusy) return;
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    const inputEl = document.getElementById('wc-msg-input');
    const text = inputEl ? inputEl.value.trim() : '';
    const contentEl = document.getElementById('chat-room-content');
    if (!char.history) char.history = [];

    // 如果输入框有文字，先发送
    if (text) {
        inputEl.value = '';
        const userMsg = { type: 'text', isMe: true, content: text, timestamp: createMessageTimestamp() };
        char.history.push(userMsg);
        if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
        maybeCaptureWechatMemoryCommand(char, text);
        if (typeof window.captureMoneyExpensesFromText === 'function') {
            window.captureMoneyExpensesFromText(text, {
                source: 'wechat',
                charId: char.id,
                charName: (char.chatConfig && char.chatConfig.nickname) || char.name || ''
            });
        }
        refreshChatView(char);
        saveCharactersToStorage();
        renderChatList();
    }

    closeChatToolbar();
    await triggerAiAfterMessage(char, contentEl);
}

// --- 共享AI调用逻辑 ---
async function triggerAiAfterMessage(char, contentEl) {
    if (window._wechatAiBusy) return;
    window._wechatAiBusy = true;
    setWechatBusyState(true);

    // 标题栏显示"对方正在输入..."
    const titleEl = document.getElementById('wc-float-name') || document.getElementById('chat-room-title');
    const originalTitle = titleEl ? titleEl.textContent : '';
    if (titleEl) titleEl.textContent = '对方正在输入...';

    try {
        // 构建消息并调用API
        const messages = buildMessages(char, char.history || []);
        const result = await callChatApi(messages);

        // 恢复标题
        if (titleEl) titleEl.textContent = originalTitle;

        if (result.ok) {
            if (markPendingUserPaymentsCollected(char)) {
                refreshChatView(char);
            }
            const parts = result.content.split('|||').map(s => s.trim()).filter(s => s);
            for (let i = 0; i < parts.length; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
                let text = parts[i];
                const avatarMatch = text.match(/\[换头像[：:](\d+)\]/);
                if (avatarMatch && char.avatarGallery && char.avatarGallery.length > 1) {
                    const idx = parseInt(avatarMatch[1]) - 1;
                    if (idx >= 0 && idx < char.avatarGallery.length) {
                        char.avatar = char.avatarGallery[idx];
                    }
                    text = text.replace(/\[换头像[：:]\d+\]/, '').trim();
                }
                if (!text) continue;
                appendWechatAiMessageParts(char, contentEl, text);
            }
            requestWechatAiStatusSnapshot(char, { reason: 'after_reply' }).catch(e => {
                console.warn('ai status snapshot failed:', e);
            });
        } else {
            const errMsg = { type: 'text', isMe: false, content: `⚠️ ${result.error}`, timestamp: createMessageTimestamp() };
            char.history.push(errMsg);
            refreshChatView(char);
        }

        contentEl.scrollTop = contentEl.scrollHeight;
        saveCharactersToStorage();
        renderChatList();
    } finally {
        if (titleEl) titleEl.textContent = originalTitle;
        setWechatBusyState(false);
        window._wechatAiBusy = false;
    }
}

function setWechatBusyState(isBusy) {
    const inputEl = document.getElementById('wc-msg-input');
    const sendBtn = document.querySelector('.wc-send-btn');
    const aiBtn = document.querySelector('.wc-ai-btn');
    if (inputEl) {
        inputEl.disabled = isBusy;
        inputEl.placeholder = isBusy ? '对方正在输入...' : '发消息...';
    }
    [sendBtn, aiBtn].forEach(btn => {
        if (!btn) return;
        btn.classList.toggle('is-disabled', isBusy);
        btn.style.pointerEvents = isBusy ? 'none' : '';
    });
}

// --- 工具栏开关 ---
function toggleChatToolbar() {
    const toolbar = document.getElementById('wc-chat-toolbar');
    const picker = document.getElementById('wc-sticker-picker');
    if (picker && !picker.classList.contains('hidden')) picker.classList.add('hidden');
    toolbar.classList.toggle('hidden');
    const addBtn = document.querySelector('.wc-add-btn');
    if (addBtn) addBtn.classList.toggle('is-open', !toolbar.classList.contains('hidden'));
}

function closeChatToolbar() {
    const toolbar = document.getElementById('wc-chat-toolbar');
    if (toolbar && !toolbar.classList.contains('hidden')) toolbar.classList.add('hidden');
    const addBtn = document.querySelector('.wc-add-btn');
    if (addBtn) addBtn.classList.remove('is-open');
    const picker = document.getElementById('wc-sticker-picker');
    if (picker && !picker.classList.contains('hidden')) picker.classList.add('hidden');
}

function closeChat() {
    const room = document.getElementById('wechat-chat-room');
    if (room) {
        room.classList.remove('active');
        setTimeout(() => room.classList.add('hidden'), 300);
    }
    window.currentChatCharId = null;
}

// --- 微信语音/视频通话 ---
function getWechatCallLabel(type) {
    return type === 'videoCall' ? '视频通话' : '语音通话';
}

function getWechatCallIcon(type) {
    return type === 'videoCall' ? 'ri-video-chat-fill' : 'ri-phone-fill';
}

function isWechatIncomingCallMessage(msg) {
    return msg && (msg.type === 'voiceCall' || msg.type === 'videoCall') && msg.isMe === false && msg.status === '来电';
}

function isWechatChatPageActive(charId) {
    const win = document.getElementById('app-wechat-window');
    const room = document.getElementById('wechat-chat-room');
    return !!(win && room && win.classList.contains('active') && !win.classList.contains('hidden') && room.classList.contains('active') && window.currentChatCharId === charId);
}

function buildWechatCallEvent(char, msg, direction) {
    return {
        id: Date.now(),
        type: msg.type,
        charId: char.id,
        direction,
        startedAt: msg.timestamp || createMessageTimestamp(),
        acceptedAt: null,
        reason: msg.reason || msg.note || '',
        lines: [],
        ended: false
    };
}

function ensureWechatCallScreen() {
    let screen = document.getElementById('wc-call-screen');
    if (screen) return screen;
    screen = document.createElement('div');
    screen.id = 'wc-call-screen';
    screen.className = 'wc-call-screen hidden';
    screen.innerHTML = `
        <div class="wc-call-bg"><img id="wc-call-bg-img" src="" alt=""></div>
        <div class="wc-call-shade"></div>
        <video id="wc-call-camera-preview" class="wc-call-camera-preview hidden" autoplay muted playsinline></video>
        <div id="wc-call-ai-portrait" class="wc-call-ai-portrait hidden">
            <img id="wc-call-ai-portrait-img" src="" alt="">
            <span id="wc-call-ai-portrait-status">正在生成 AI 画面...</span>
        </div>
        <div class="wc-call-top">
            <img class="wc-call-avatar" id="wc-call-avatar" src="" alt="">
            <div class="wc-call-name" id="wc-call-name"></div>
            <div class="wc-call-status" id="wc-call-status">正在呼叫...</div>
            <div class="wc-call-timer hidden" id="wc-call-timer">00:00</div>
        </div>
        <div class="wc-call-log" id="wc-call-log"></div>
        <div class="wc-call-inputbar hidden" id="wc-call-inputbar">
            <input id="wc-call-input" type="text" placeholder="通话中说点什么..." onkeydown="if(event.key==='Enter'){event.preventDefault();sendWechatCallMessage();}">
            <button type="button" onclick="sendWechatCallMessage()"><i class="ri-send-plane-2-fill"></i></button>
        </div>
        <div class="wc-call-actions" id="wc-call-actions">
            <button type="button" class="wc-call-tool"><i class="ri-mic-line"></i><span>静音</span></button>
            <button type="button" class="wc-call-end" onclick="endWechatCall()"><i class="ri-phone-fill"></i></button>
            <button type="button" class="wc-call-tool"><i id="wc-call-kind-icon" class="ri-phone-fill"></i><span id="wc-call-kind-label">语音</span></button>
        </div>
    `;
    getWechatModalRoot().appendChild(screen);
    return screen;
}

function ensureWechatIncomingIsland() {
    let island = document.getElementById('wc-call-island');
    if (island) return island;
    island = document.createElement('div');
    island.id = 'wc-call-island';
    island.className = 'wc-call-island hidden';
    island.innerHTML = `
        <div class="wc-call-island-main" onclick="acceptWechatIncomingCall()">
            <img id="wc-call-island-avatar" src="" alt="">
            <div class="wc-call-island-text">
                <strong id="wc-call-island-name"></strong>
                <span id="wc-call-island-label"></span>
            </div>
        </div>
        <div class="wc-call-island-actions">
            <button type="button" class="reject" onclick="event.stopPropagation();rejectWechatIncomingCall()"><i class="ri-close-line"></i></button>
            <button type="button" class="accept" onclick="event.stopPropagation();acceptWechatIncomingCall()"><i class="ri-phone-fill"></i></button>
        </div>
    `;
    getWechatModalRoot().appendChild(island);
    return island;
}

function showWechatIncomingIsland(call) {
    const char = window.myCharacters.find(c => c.id === call.charId);
    if (!char) return;
    const island = ensureWechatIncomingIsland();
    document.getElementById('wc-call-island-avatar').src = char.avatar || DEFAULT_AVATAR;
    document.getElementById('wc-call-island-name').textContent = (char.chatConfig && char.chatConfig.nickname) || char.name;
    document.getElementById('wc-call-island-label').textContent = `来${getWechatCallLabel(call.type)}`;
    island.classList.remove('hidden');
}

function hideWechatIncomingIsland() {
    const island = document.getElementById('wc-call-island');
    if (island) island.classList.add('hidden');
}

function handleWechatIncomingCall(char, msg) {
    const call = buildWechatCallEvent(char, msg, 'incoming');
    window._wechatIncomingCall = call;
    if (isWechatChatPageActive(char.id)) {
        openWechatIncomingCallScreen(call);
    } else {
        showWechatIncomingIsland(call);
    }
}

function getWechatActiveCallChar() {
    const call = window._wechatActiveCall;
    if (!call) return null;
    return window.myCharacters.find(c => c.id === call.charId) || null;
}

function setWechatCallMode(mode) {
    const screen = ensureWechatCallScreen();
    screen.dataset.mode = mode;
    document.getElementById('wc-call-inputbar')?.classList.toggle('hidden', mode !== 'connected');
    document.getElementById('wc-call-timer')?.classList.toggle('hidden', mode !== 'connected');
}

function setWechatCallStatus(text) {
    const statusEl = document.getElementById('wc-call-status');
    if (statusEl) statusEl.textContent = text;
}

function formatWechatCallClock(seconds) {
    const sec = Math.max(0, Math.floor(seconds || 0));
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return `${String(min).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function updateWechatCallTimer() {
    const call = window._wechatActiveCall;
    const timer = document.getElementById('wc-call-timer');
    if (!call || !call.acceptedAt || !timer) return;
    timer.textContent = formatWechatCallClock((Date.now() - call.acceptedAt) / 1000);
}

function addWechatCallLine(role, text) {
    const call = window._wechatActiveCall;
    const log = document.getElementById('wc-call-log');
    const content = String(text || '').trim();
    if (!call || !log || !content) return;
    if (!call.lines) call.lines = [];
    call.lines.push({ role, content });
    const item = document.createElement('div');
    item.className = `wc-call-line ${role}`;
    item.innerHTML = wcEscapeHtml(content).replace(/\n/g, '<br>');
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
}

function parseWechatCallDecision(content) {
    const raw = String(content || '').replace(/\|\|\|/g, ' ').trim();
    const cleaned = raw
        .replace(/\[接听\]/g, '')
        .replace(/\[拒绝[：:]?([^\]]*)\]/g, '$1')
        .trim();
    const refused = /拒绝|不接|不方便|在忙|忙着|挂断|稍后|未接|没法|不能接/.test(raw) && !/接听|接了|可以接|我接|接吧/.test(raw);
    return {
        accepted: !refused,
        message: cleaned
    };
}

async function startWechatCall(type) {
    if (window._wechatAiBusy || window._wechatActiveCall) return;
    const char = getCurrentChatChar();
    if (!char) return;
    closeChatToolbar();
    closeStickerPicker();

    const label = getWechatCallLabel(type);
    const screen = ensureWechatCallScreen();
    window._wechatActiveCall = {
        id: Date.now(),
        type,
        charId: char.id,
        direction: 'outgoing',
        startedAt: Date.now(),
        acceptedAt: null,
        reason: '',
        lines: [],
        ended: false
    };

    setupWechatCallScreen(window._wechatActiveCall, char);
    setWechatCallStatus(`正在邀请对方加入${label}...`);
    screen.classList.remove('hidden');

    await requestWechatCallDecision(window._wechatActiveCall);
}

function setupWechatCallScreen(call, char) {
    ensureWechatCallScreen();
    const config = char.chatConfig || {};
    const bg = call.type === 'videoCall' ? (config.videoCallBg || config.imageReference || char.avatar || DEFAULT_AVATAR) : (char.avatar || DEFAULT_AVATAR);
    document.getElementById('wc-call-bg-img').src = bg;
    document.getElementById('wc-call-avatar').src = char.avatar || DEFAULT_AVATAR;
    document.getElementById('wc-call-name').textContent = (char.chatConfig && char.chatConfig.nickname) || char.name;
    document.getElementById('wc-call-kind-icon').className = getWechatCallIcon(call.type);
    document.getElementById('wc-call-kind-label').textContent = call.type === 'videoCall' ? '视频' : '语音';
    document.getElementById('wc-call-log').innerHTML = '';
    document.getElementById('wc-call-input').value = '';
    const screen = ensureWechatCallScreen();
    screen.classList.toggle('is-video-call', call.type === 'videoCall');
    const camera = document.getElementById('wc-call-camera-preview');
    const portrait = document.getElementById('wc-call-ai-portrait');
    if (camera) camera.classList.add('hidden');
    if (portrait) portrait.classList.toggle('hidden', call.type !== 'videoCall');
    const portraitImg = document.getElementById('wc-call-ai-portrait-img');
    const portraitStatus = document.getElementById('wc-call-ai-portrait-status');
    if (portraitImg) portraitImg.src = config.imageReference || char.avatar || DEFAULT_AVATAR;
    if (portraitStatus) portraitStatus.textContent = call.type === 'videoCall' ? '等待接通后生成 AI 画面' : '';
    setWechatCallMode('ringing');
}

async function requestWechatCallDecision(call) {
    const char = getWechatActiveCallChar();
    if (!call || !char) return;
    window._wechatAiBusy = true;
    setWechatBusyState(true);

    const label = getWechatCallLabel(call.type);
    try {
        const messages = buildMessages(char, char.history || []);
        messages.push({
            role: 'system',
            content: `当前用户正在给你发起${label}。你必须以角色身份决定是否接听。只回复一种格式：[接听]一句接通后的开场白，或 [拒绝:一句拒绝理由]。不要解释格式。`
        });
        messages.push({ role: 'user', content: `我正在给你打${label}，你接吗？` });
        const result = await callChatApi(messages);
        if (window._wechatActiveCall?.id !== call.id || call.ended) return;

        if (!result.ok) {
            setWechatCallStatus('暂时无法接通');
            addWechatCallRecord(call, '未接通', result.error);
            setTimeout(() => closeWechatCallScreen(call.id), 800);
            return;
        }

        const decision = parseWechatCallDecision(result.content);
        if (decision.accepted) {
            acceptWechatCall(call, decision.message);
        } else {
            setWechatCallStatus('对方已拒绝');
            if (decision.message) addWechatCallLine('assistant', decision.message);
            call.reason = decision.message;
            addWechatCallRecord(call, '已拒绝', decision.message);
            setTimeout(() => closeWechatCallScreen(call.id), 1100);
        }
    } finally {
        if (window._wechatActiveCall?.id === call.id) {
            window._wechatAiBusy = false;
            setWechatBusyState(false);
        }
    }
}

function acceptWechatCall(call, firstMessage) {
    if (!call || call.ended) return;
    call.acceptedAt = Date.now();
    setWechatCallMode('connected');
    setWechatCallStatus('通话中');
    updateWechatCallTimer();
    clearInterval(call.timerId);
    call.timerId = setInterval(updateWechatCallTimer, 1000);
    if (firstMessage) addWechatCallLine('assistant', firstMessage);
    const input = document.getElementById('wc-call-input');
    if (input) input.focus();
    if (call.type === 'videoCall') activateWechatVideoCallFeatures(call);
}

async function activateWechatVideoCallFeatures(call) {
    const char = getWechatActiveCallChar();
    if (!call || !char || call.ended) return;
    const config = char.chatConfig || {};
    const portraitStatus = document.getElementById('wc-call-ai-portrait-status');
    const portraitImg = document.getElementById('wc-call-ai-portrait-img');
    if (config.videoCallUseCamera) {
        startWechatCallCameraStream().catch(err => {
            addWechatCallLine('system', '真实相机没有打开：' + (err && err.message ? err.message : '浏览器未授权'));
        });
    }
    if (portraitStatus) portraitStatus.textContent = '正在生成 AI 视频画面...';
    const reference = config.imageReference || char.avatar || '';
    const prompt = [
        `生成${getWechatCharDisplayName(char)}正在视频通话中的实时画面。`,
        '手机竖屏自拍视角，真实光线，表情自然，像正在看着用户说话。',
        char.description ? `角色设定：${char.description.slice(0, 700)}` : '',
        config.signature ? `个性签名/气质：${config.signature}` : ''
    ].filter(Boolean).join('\n');
    const result = await callWechatImageGenerationApi(prompt, { referenceImage: reference, size: '1024x1024' });
    if (window._wechatActiveCall?.id !== call.id || call.ended) return;
    if (result.ok && result.url) {
        if (portraitImg) portraitImg.src = result.url;
        const bgImg = document.getElementById('wc-call-bg-img');
        if (bgImg && !config.videoCallBg) bgImg.src = result.url;
        if (portraitStatus) portraitStatus.textContent = 'AI 画面已生成';
    } else if (portraitStatus) {
        portraitStatus.textContent = result.error ? `生图失败：${String(result.error).slice(0, 42)}` : '未生成 AI 画面';
    }
}

async function startWechatCallCameraStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('当前浏览器不支持真实相机');
    }
    const video = document.getElementById('wc-call-camera-preview');
    if (!video) return;
    stopWechatCallCameraStream();
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
    });
    window._wechatCallCameraStream = stream;
    video.srcObject = stream;
    video.classList.remove('hidden');
}

function stopWechatCallCameraStream() {
    const stream = window._wechatCallCameraStream;
    if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach(track => track.stop());
    }
    window._wechatCallCameraStream = null;
    const video = document.getElementById('wc-call-camera-preview');
    if (video) {
        video.srcObject = null;
        video.classList.add('hidden');
    }
}

function openWechatIncomingCallScreen(call) {
    const char = window.myCharacters.find(c => c.id === call.charId);
    if (!char) return;
    hideWechatIncomingIsland();
    if (typeof openApp === 'function') openApp('wechat');
    if (window.currentChatCharId !== char.id) openChat(char.id);
    window._wechatIncomingCall = null;
    window._wechatActiveCall = call;
    setupWechatCallScreen(call, char);
    ensureWechatCallScreen().classList.remove('hidden');
    acceptWechatCall(call, call.reason);
}

function acceptWechatIncomingCall() {
    const call = window._wechatIncomingCall;
    if (!call || window._wechatActiveCall) return;
    openWechatIncomingCallScreen(call);
}

function rejectWechatIncomingCall() {
    const call = window._wechatIncomingCall;
    if (!call) return;
    hideWechatIncomingIsland();
    addWechatCallRecord(call, '已拒绝', '你已拒绝');
    window._wechatIncomingCall = null;
}

async function sendWechatCallMessage() {
    const call = window._wechatActiveCall;
    const char = getWechatActiveCallChar();
    const input = document.getElementById('wc-call-input');
    if (!call || !char || !input || call.ended || call.busy || !call.acceptedAt) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addWechatCallLine('user', text);

    call.busy = true;
    input.disabled = true;
    setWechatCallStatus('对方正在说话...');
    try {
        const messages = buildMessages(char, char.history || []);
        messages.push({
            role: 'system',
            content: `现在你和用户正在${getWechatCallLabel(call.type)}中。直接回复通话里会说的话，保持自然口语。不要输出微信特殊消息指令，不要写旁白。`
        });
        (call.lines || []).forEach(line => {
            if (line.role === 'user' || line.role === 'assistant') {
                messages.push({ role: line.role, content: line.content });
            }
        });
        const result = await callChatApi(messages);
        if (window._wechatActiveCall?.id !== call.id || call.ended) return;
        if (result.ok) {
            result.content.split('|||').map(s => s.trim()).filter(Boolean).forEach(part => {
                addWechatCallLine('assistant', part.replace(/\[换头像[：:]\d+\]/g, '').trim());
            });
        } else {
            addWechatCallLine('system', `通话信号不稳定：${result.error}`);
        }
    } finally {
        if (window._wechatActiveCall?.id === call.id && !call.ended) {
            call.busy = false;
            input.disabled = false;
            setWechatCallStatus('通话中');
            input.focus();
        }
    }
}

function addWechatCallRecord(call, status, reason = '') {
    const char = window.myCharacters.find(c => c.id === call.charId);
    if (!char) return;
    if (!char.history) char.history = [];
    const duration = call.acceptedAt ? Math.max(1, Math.round((Date.now() - call.acceptedAt) / 1000)) : 0;
    const msg = syncWechatMessageDescription({
        type: call.type,
        isMe: call.direction !== 'incoming',
        status,
        reason: reason || call.reason || '',
        duration,
        timestamp: call.startedAt || createMessageTimestamp()
    });
    char.history.push(msg);
    saveCharactersToStorage();
    if (window.currentChatCharId === char.id) refreshChatView(char);
    renderChatList();
}

function endWechatCall(status = '已结束') {
    const call = window._wechatActiveCall;
    if (!call || call.ended) return;
    call.ended = true;
    clearInterval(call.timerId);
    addWechatCallRecord(call, call.acceptedAt ? status : '已取消');
    closeWechatCallScreen(call.id);
}

function closeWechatCallScreen(callId) {
    const call = window._wechatActiveCall;
    if (call && callId && call.id !== callId) return;
    if (call) {
        call.ended = true;
        clearInterval(call.timerId);
    }
    const screen = document.getElementById('wc-call-screen');
    if (screen) screen.classList.add('hidden');
    stopWechatCallCameraStream();
    window._wechatActiveCall = null;
    window._wechatAiBusy = false;
    setWechatBusyState(false);
}

// --- B. PNG 解析器 ---
const CharacterCardParser = {
    decodeBase64ToUtf8: function(base64) {
        try {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) { return null; }
    },

    findField: function(obj, targets) {
        if (!obj || typeof obj !== 'object') return null;
        const keys = Object.keys(obj);
        for (let target of targets) {
            if (obj[target] !== undefined) return obj[target];
            const lowerTarget = target.toLowerCase();
            const foundKey = keys.find(k => k.toLowerCase() === lowerTarget);
            if (foundKey) return obj[foundKey];
        }
        return null;
    },

    parse: function(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        if (dataView.getUint32(0) !== 0x89504E47) throw new Error("不是 PNG");

        let offset = 8;
        let charData = null;
        let decoder = new TextDecoder('utf-8');

        while (offset < arrayBuffer.byteLength) {
            const length = dataView.getUint32(offset);
            let type = '';
            for(let i=0; i<4; i++) type += String.fromCharCode(dataView.getUint8(offset + 4 + i));
            
            if (type === 'tEXt' || type === 'iTXt') {
                const contentBytes = new Uint8Array(arrayBuffer, offset + 8, length);
                let nullIndex = -1;
                for(let i=0; i<length; i++) { if(contentBytes[i]===0){ nullIndex=i; break; } }
                
                if (nullIndex > -1) {
                    const key = decoder.decode(contentBytes.slice(0, nullIndex));
                    if (key === 'chara') {
                        let jsonStr = null;
                        if (type === 'tEXt') {
                            const val = decoder.decode(contentBytes.slice(nullIndex + 1));
                            jsonStr = this.decodeBase64ToUtf8(val);
                        } else {
                            const raw = decoder.decode(contentBytes);
                            const idx = raw.indexOf('eyJ'); 
                            if (idx > -1) jsonStr = this.decodeBase64ToUtf8(raw.slice(idx));
                        }
                        
                        if (jsonStr) {
                            try { 
                                const raw = JSON.parse(jsonStr);
                                const d = raw.data || raw; 
                                
                                let searchTargets = [raw];
                                if (raw.data) searchTargets.push(raw.data);
                                searchTargets.forEach(target => {
                                    if (target.extensions && typeof target.extensions === 'string') {
                                        try { target.extensions = JSON.parse(target.extensions); } catch(e) {}
                                    }
                                });

                                let rawScripts = [];

                                function findRegexArray(obj, depth = 0) {
                                    if (depth > 6 || !obj || typeof obj !== 'object') return null;
                                    const keys = Object.keys(obj);
                                    const scriptKey = keys.find(k => k.toLowerCase() === 'regex_scripts' || k.toLowerCase() === 'regexscripts');
                                    if (scriptKey && Array.isArray(obj[scriptKey])) return obj[scriptKey];
                                    
                                    for (let key in obj) {
                                        if (['character_book', 'history', 'story_string', 'alternate_greetings'].includes(key)) continue;
                                        const val = obj[key];
                                        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
                                            const firstKeys = Object.keys(val[0]).map(k => k.toLowerCase());
                                            if (firstKeys.some(k => k.includes('regex') || k.includes('pattern'))) {
                                                return val;
                                            }
                                        } else if (typeof val === 'object') {
                                            const found = findRegexArray(val, depth + 1);
                                            if (found) return found;
                                        }
                                    }
                                    return null;
                                }

                                const found = findRegexArray(raw);
                                if (found) rawScripts = found;

                                const normalizedScripts = rawScripts.map((s, idx) => {
                                    const get = (arr) => this.findField(s, arr) || "";
                                    return {
                                        name: get(['scriptName', 'name', 'label']) || `Script #${idx+1}`,
                                        regex: get(['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']), 
                                        replace: get(['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']),
                                        placement: "Global"
                                    };
                                }).filter(s => s.regex && s.regex.trim() !== "");

                                charData = {
                                    name: d.name,
                                    description: d.description,
                                    first_mes: d.first_mes,
                                    alternates: d.alternate_greetings || [],
                                    avatar: "", 
                                    worldBook: d.character_book?.entries || d.character_book || [],
                                    regex: normalizedScripts 
                                };
                            } catch(e) { console.error("JSON解析失败", e); }
                        }
                    }
                }
            }
            if (charData) break;
            offset += 4 + 4 + length + 4;
        }
        return charData;
    }
};

// --- C. 交互与导入系统 ---

function testAddCharacter() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="triggerImport()"><i class="ri-file-upload-line" style="color: #07c160;"></i><span>导入角色卡 (PNG)</span><input type="file" id="import-card-file" accept="image/*" style="display:none" onchange="handleFileSelect(this)"></div>
        <div class="wc-sheet-item" onclick="openCreateModal()"><i class="ri-user-add-line" style="color: #2b2b2b;"></i><span>手动新建角色</span></div>
    `);
}

function showWechatActionSheet(contentHtml) {
    const sheet = document.getElementById('wc-action-sheet');
    if (!sheet) return;
    sheet.innerHTML = `
        <div class="wc-sheet-content">
            ${contentHtml}
            <div class="wc-sheet-cancel" onclick="hideActionSheet()">取消</div>
        </div>
    `;
    sheet.classList.remove('hidden');
}

function hideActionSheet() {
    const sheet = document.getElementById('wc-action-sheet');
    if (sheet) sheet.classList.add('hidden');
}

function triggerImport() {
    const fileInput = document.getElementById('import-card-file');
    if (fileInput) fileInput.click();
    hideActionSheet(); 
}

function openCreateModal() {
    hideActionSheet();
    const modal = document.getElementById('wc-char-modal');
    document.getElementById('modal-title').innerText = "新角色";
    document.getElementById('modal-char-name').value = "";
    document.getElementById('modal-char-intro').value = "";
    document.getElementById('modal-avatar-preview').src = "";
    const infoBox = document.getElementById('parse-extra-info');
    if(infoBox) infoBox.innerHTML = "";
    window.TEMP_PARSED_DATA = null;
    if (modal) modal.classList.remove('hidden');
}

function closeCharModal() {
    const modal = document.getElementById('wc-char-modal');
    if (modal) modal.classList.add('hidden');
}

function previewModalAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('modal-avatar-preview').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function handleFileSelect(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const arrayBuffer = e.target.result;
            const charData = CharacterCardParser.parse(arrayBuffer);
            
            if (!charData) {
                alert("❌ 无法识别，请确保是 PNG 格式的角色卡");
                return;
            }

            const imgReader = new FileReader();
            imgReader.onload = function(evt) {
                // 🔥 压缩头像到200x200 JPEG，避免localStorage爆
                const origSrc = evt.target.result;
                const compImg = new Image();
                compImg.onload = function() {
                    const canvas = document.createElement('canvas');
                    const size = 200;
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(compImg, 0, 0, size, size);
                    const compressedAvatar = canvas.toDataURL('image/jpeg', 0.7);
                    
                    document.getElementById('modal-char-name').value = charData.name || "";
                    document.getElementById('modal-char-intro').value = charData.first_mes || "";
                    document.getElementById('modal-avatar-preview').src = compressedAvatar;
                    document.getElementById('modal-title').innerText = "解析成功";
                
                window.TEMP_PARSED_DATA = {
                    worldBook: charData.worldBook || [],
                    regex: charData.regex || [],
                    alternates: charData.alternates || [],
                    first_mes_original: charData.first_mes,
                    description: charData.description || ''
                };

                const altCount = window.TEMP_PARSED_DATA.alternates.length;
                const infoHtml = `
                    <div style="color:#07c160; font-size:14px; margin-bottom:8px; font-weight:bold; display:flex; align-items:center; gap:5px;">
                        <i class="ri-check-double-line"></i> 数据提取成功
                    </div>
                    <div class="detected-tags">
                        ${altCount > 0 ? `<div class="d-tag" style="background:#e8eaf6; color:#3f51b5;"><i class="ri-chat-history-line"></i> 备选开场: ${altCount}</div>` : ''}
                    </div>
                `;
                const infoBox = document.getElementById('parse-extra-info');
                if(infoBox) infoBox.innerHTML = infoHtml;

                document.getElementById('wc-char-modal').classList.remove('hidden');
                input.value = '';
                };
                compImg.src = origSrc;
            };
            imgReader.readAsDataURL(file);
        } catch (err) {
            console.error(err);
            alert("解析出错: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// --- 🟢 wechat.js 修改部分 ---

function confirmSaveCharacter() {
    const name = document.getElementById('modal-char-name').value;
    const intro = document.getElementById('modal-char-intro').value; 
    const avatar = document.getElementById('modal-avatar-preview').src;
    
    if (!name) { alert("起个名字吧！"); return; }
    
    let wb = [];
    let re = [];
    let alts = [];
    let originalFirst = "";
    let desc = "";

    if (window.TEMP_PARSED_DATA) {
        wb = window.TEMP_PARSED_DATA.worldBook || [];
        re = window.TEMP_PARSED_DATA.regex || [];
        alts = window.TEMP_PARSED_DATA.alternates || [];
        originalFirst = window.TEMP_PARSED_DATA.first_mes_original || intro;
        desc = window.TEMP_PARSED_DATA.description || "";
    }

    const newChar = {
        id: 'char_' + Date.now(),
        name: name,
        description: desc,
        avatar: avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 200 200%27%3E%3Cdefs%3E%3ClinearGradient id=%27bg%27 x1=%270%27 y1=%270%27 x2=%271%27 y2=%271%27%3E%3Cstop offset=%270%25%27 stop-color=%27%23f8c8dc%27/%3E%3Cstop offset=%27100%25%27 stop-color=%27%23d4a5f5%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%27200%27 height=%27200%27 rx=%27100%27 fill=%27url(%23bg)%27/%3E%3Ccircle cx=%27100%27 cy=%2780%27 r=%2735%27 fill=%27%23fff%27 opacity=%270.9%27/%3E%3Cellipse cx=%27100%27 cy=%27155%27 rx=%2750%27 ry=%2735%27 fill=%27%23fff%27 opacity=%270.9%27/%3E%3Ccircle cx=%2788%27 cy=%2775%27 r=%274%27 fill=%27%23555%27/%3E%3Ccircle cx=%27112%27 cy=%2775%27 r=%274%27 fill=%27%23555%27/%3E%3Cpath d=%27M92 90 Q100 98 108 90%27 stroke=%27%23e88%27 stroke-width=%272.5%27 fill=%27none%27 stroke-linecap=%27round%27/%3E%3C/svg%3E',
        lastMsg: intro,
        worldBook: wb,
        regex: re,
        alternates: alts,
        first_mes_original: originalFirst,
        currentGreetingIndex: 0,
        first_mes: intro,
        chatConfig: {},
        history: []
    };
    
    window.myCharacters.push(newChar);
    window.TEMP_PARSED_DATA = null;
    
    renderChatList();

    // 🔥 压缩头像后保存到本地存储
    compressAndSaveCharacters();
    
    closeCharModal();
}

// --- 左滑删除 ---

function deleteCharacter(charId) {
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    if (!confirm(`确定删除「${char.name}」吗？\n聊天记录将不可恢复`)) return;

    window.myCharacters = window.myCharacters.filter(c => c.id !== charId);
    if (window.currentChatCharId === charId) window.currentChatCharId = null;

    saveCharactersToStorage();
    renderChatList();
}

// 滑动手势处理
function initSwipeHandlers() {
    const containers = document.querySelectorAll('.wc-swipe-container');
    let openItem = null; // 当前打开的滑动项

    function closeOpenItem(animate) {
        if (!openItem) return;
        const chatItem = openItem.querySelector('.wc-chat-item');
        if (chatItem) {
            if (animate) chatItem.style.transition = 'transform 0.3s ease';
            chatItem.style.transform = 'translateX(0)';
            if (animate) setTimeout(() => { chatItem.style.transition = ''; }, 300);
        }
        openItem.classList.remove('swiping');
        openItem = null;
    }

    containers.forEach(container => {
        const chatItem = container.querySelector('.wc-chat-item');
        const charId = container.dataset.charId;
        let startX = 0, startY = 0, currentX = 0;
        let isSwiping = false, directionDecided = false, didSwipe = false;

        function onStart(x, y) {
            // 如果点到了其他地方且有打开项，先关闭
            if (openItem && openItem !== container) {
                closeOpenItem(true);
            }
            startX = x;
            startY = y;
            currentX = 0;
            isSwiping = false;
            directionDecided = false;
            didSwipe = false;
            chatItem.style.transition = '';
        }

        function onMove(x, y, e) {
            const dx = x - startX;
            const dy = y - startY;

            if (!directionDecided) {
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // 死区
                directionDecided = true;
                if (Math.abs(dy) > Math.abs(dx)) {
                    // 垂直滚动，放行
                    isSwiping = false;
                    return;
                }
                isSwiping = true;
                container.classList.add('swiping');
            }

            if (!isSwiping) return;
            if (e.cancelable) e.preventDefault();

            // 计算偏移（考虑已打开状态）
            const base = (openItem === container) ? -75 : 0;
            let tx = base + dx;
            tx = Math.max(-75, Math.min(0, tx));
            currentX = tx;
            chatItem.style.transform = `translateX(${tx}px)`;
        }

        function onEnd() {
            if (!isSwiping) {
                if (!didSwipe && !directionDecided) {
                    // 纯点击
                    if (openItem === container) {
                        closeOpenItem(true);
                    } else {
                        openChat(charId);
                    }
                }
                return;
            }
            didSwipe = true;
            chatItem.style.transition = 'transform 0.3s ease';

            if (currentX < -35) {
                // 吸附打开
                chatItem.style.transform = 'translateX(-75px)';
                openItem = container;
            } else {
                // 收回
                chatItem.style.transform = 'translateX(0)';
                if (openItem === container) openItem = null;
            }
            container.classList.remove('swiping');
            setTimeout(() => { chatItem.style.transition = ''; }, 300);
        }

        // 触摸事件
        container.addEventListener('touchstart', e => {
            const t = e.touches[0];
            onStart(t.clientX, t.clientY);
        }, { passive: true });

        container.addEventListener('touchmove', e => {
            const t = e.touches[0];
            onMove(t.clientX, t.clientY, e);
        }, { passive: false });

        container.addEventListener('touchend', () => onEnd());

        // 鼠标事件（桌面端）
        let mouseDown = false;
        container.addEventListener('mousedown', e => {
            mouseDown = true;
            onStart(e.clientX, e.clientY);
        });
        container.addEventListener('mousemove', e => {
            if (!mouseDown) return;
            onMove(e.clientX, e.clientY, e);
        });
        container.addEventListener('mouseup', () => {
            if (!mouseDown) return;
            mouseDown = false;
            onEnd();
        });
        container.addEventListener('mouseleave', () => {
            if (!mouseDown) return;
            mouseDown = false;
            onEnd();
        });
    });

    // 点击列表空白区域关闭已打开的滑动
    const chatList = document.getElementById('wc-chat-list');
    if (chatList) {
        chatList.addEventListener('click', (e) => {
            if (!e.target.closest('.wc-swipe-container') && openItem) {
                closeOpenItem(true);
            }
        });
    }
}

// --- D. 本地存储：角色数据持久化 ---

function saveCharactersToStorage() {
    try {
        const data = window.myCharacters.map(char => ({
            id: char.id,
            name: char.name,
            description: char.description || '',
            avatar: char._smallAvatar || char.avatar || '',
            lastMsg: char.lastMsg,
            worldBook: char.worldBook || [],
            regex: char.regex || [],
            alternates: char.alternates || [],
            first_mes_original: char.first_mes_original || '',
            first_mes: char.first_mes || '',
            currentGreetingIndex: char.currentGreetingIndex || 0,
            isGroupChat: !!char.isGroupChat,
            groupMembers: Array.isArray(char.groupMembers) ? char.groupMembers : [],
            groupCreatedAt: char.groupCreatedAt || 0,
            chatConfig: char.chatConfig || {},
            history: char.history || []
        }));
        const jsonStr = JSON.stringify(data);
        localStorage.setItem('my_characters_data', jsonStr);
        console.log("✅ 角色数据已保存，大小:", (jsonStr.length / 1024).toFixed(1) + "KB");
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            try {
                const data = window.myCharacters.map(char => ({
                    id: char.id, name: char.name, description: char.description || '', avatar: '',
                    lastMsg: char.lastMsg, worldBook: [], regex: char.regex || [],
                    alternates: char.alternates || [],
                    first_mes_original: char.first_mes_original || '',
                    first_mes: char.first_mes || '',
                    currentGreetingIndex: char.currentGreetingIndex || 0,
                    isGroupChat: !!char.isGroupChat,
                    groupMembers: Array.isArray(char.groupMembers) ? char.groupMembers : [],
                    groupCreatedAt: char.groupCreatedAt || 0,
                    chatConfig: char.chatConfig || {},
                    history: char.history || []
                }));
                localStorage.setItem('my_characters_data', JSON.stringify(data));
                console.warn("⚠️ 存储空间紧张，头像和世界书已省略");
            } catch (e2) {
                alert("❌ 存储空间不足，角色数据无法保存");
            }
        } else { console.error("保存角色数据失败:", e); }
    }
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
                const c = document.createElement('canvas');
                c.width = 200; c.height = 200;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0, 200, 200);
                char._smallAvatar = c.toDataURL('image/jpeg', 0.7);
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

function loadCharactersFromStorage() {
    try {
        const raw = localStorage.getItem('my_characters_data');
        if (!raw) { console.log("无已保存的角色数据"); return; }
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
            window.myCharacters = data;
            console.log("✅ 已加载", data.length, "个角色");
            renderChatList();
        }
    } catch (e) {
        console.error("加载角色数据失败:", e);
    }
}

// --- 📑 微信 Tab 切换 ---

function switchWcTab(tabName) {
    const views = document.querySelectorAll('.wc-tab-view');
    views.forEach(v => v.classList.remove('active'));

    const tabs = document.querySelectorAll('.wc-tab-bar .wc-tab');
    tabs.forEach(t => t.classList.remove('active'));

    const targetView = document.getElementById('wc-view-' + tabName);
    if (targetView) targetView.classList.add('active');

    const tabIndex = { chat: 0, contacts: 1, discover: 2, me: 3 };
    if (tabs[tabIndex[tabName]]) tabs[tabIndex[tabName]].classList.add('active');

    const header = document.querySelector('.wechat-header');
    const titleEl = header.querySelector('.wc-header-title');
    const rightEl = header.querySelector('.wc-header-right');

    const titles = { chat: '消息', contacts: '通讯录', discover: '发现', me: '我' };
    titleEl.textContent = titles[tabName] || '微信';

    if (tabName === 'chat') {
        rightEl.style.display = '';
    } else {
        rightEl.style.display = 'none';
    }

    if (tabName === 'contacts') renderContacts();
    if (tabName === 'me') renderMePage();
}

function renderContacts() {
    const list = document.getElementById('wc-contacts-list');
    if (!list) return;
    const chars = getWechatGroupContacts();
    if (chars.length === 0) {
        list.innerHTML = '<div class="wc-contacts-empty">还没有联系人<br>导入角色卡添加好友吧~</div>';
        return;
    }
    list.innerHTML = chars.map(c => `
        <div class="wc-contact-item" onclick="openWechatContactProfile(${quoteWechatJsString(c.id)})">
            <img class="wc-contact-avatar" src="${c.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
            <div class="wc-contact-text">
                <span class="wc-contact-name">${wcEscapeHtml((c.chatConfig && c.chatConfig.nickname) || c.name || '未命名')}</span>
                <em>${wcEscapeHtml((c.chatConfig && c.chatConfig.signature) || getWechatProfileBio(c) || '点击查看朋友资料')}</em>
            </div>
        </div>
    `).join('');
}

function openChatFromContact(charId) {
    const screen = document.getElementById('wc-feature-screen');
    if (screen) {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    }
    switchWcTab('chat');
    openChat(charId);
}

window._wechatContactProfileGenerating = window._wechatContactProfileGenerating || new Set();

function getWechatAiContactProfile(char) {
    const profile = (char && char.chatConfig && char.chatConfig.contactProfile) || null;
    if (!profile || typeof profile !== 'object') return null;
    if (isWechatLegacyFakeContactProfile(profile)) return null;
    const hasContent = ['wechatId', 'region', 'bio', 'signature'].some(key => String(profile[key] || '').trim());
    return hasContent ? profile : null;
}

function getWechatContactProfileMissingFields(profile) {
    const missing = [];
    if (!profile || !String(profile.wechatId || '').trim()) missing.push('微信号');
    if (!profile || !String(profile.region || '').trim()) missing.push('地区');
    return missing;
}

function hasUsableWechatContactProfile(char) {
    const profile = getWechatAiContactProfile(char);
    return !!profile && getWechatContactProfileMissingFields(profile).length === 0;
}

function isWechatLegacyFakeContactProfile(profile) {
    const region = String((profile && profile.region) || '').replace(/\s+/g, ' ').trim();
    return ['广东 深圳', '浙江 杭州', '四川 成都', '江苏 苏州', '北京 朝阳'].includes(region);
}

function getWechatContactId(char) {
    return (getWechatAiContactProfile(char) || {}).wechatId || '';
}

function getWechatContactRegion(char) {
    return (getWechatAiContactProfile(char) || {}).region || '';
}

function parseWechatAiJsonObject(text) {
    const raw = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try {
            return JSON.parse(raw.slice(start, end + 1));
        } catch (e) {}
    }
    const data = {};
    raw.split(/[\n；;]+/).forEach(line => {
        const parts = line.split(/[:：]/);
        if (parts.length < 2) return;
        const key = parts.shift().trim();
        const value = parts.join(':').trim();
        if (/微信号|wechat|wxid|id/i.test(key)) data.wechatId = value;
        else if (/地区|region|城市|city/i.test(key)) data.region = value;
        else if (/资料|简介|bio|介绍/i.test(key)) data.bio = value;
        else if (/签名|signature/i.test(key)) data.signature = value;
    });
    return data;
}

function normalizeWechatAiContactProfile(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const compact = value => String(value || '')
        .replace(/\|\|\|/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const profile = {
        wechatId: compact(data.wechatId || data.wxid || data.wechat || data.id).slice(0, 32),
        region: compact(data.region || data.city || data.location).slice(0, 32),
        bio: compact(data.bio || data.profile || data.description || data.about).slice(0, 160),
        signature: compact(data.signature || data.status || data.sign).slice(0, 36),
        generatedAt: Date.now()
    };
    return ['wechatId', 'region', 'bio', 'signature'].some(key => profile[key]) ? profile : null;
}

async function requestWechatAiContactProfile(charId, force = false) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char || window._wechatContactProfileGenerating.has(charId)) return;
    char.chatConfig = char.chatConfig || {};
    if (!force && hasUsableWechatContactProfile(char)) return;

    window._wechatContactProfileGenerating.add(charId);
    char.chatConfig.contactProfileError = '';
    saveCharactersToStorage();
    refreshWechatContactProfileView(charId);

    let result = { ok: false, content: '' };
    try {
        result = await callChatApi([
            {
                role: 'system',
                content: `你就是「${char.name || '这个角色'}」。请由你自己决定微信联系人资料页公开展示的信息，不要套模板，不要解释。微信号和地区必须返回非空：微信号要像真实微信号但符合角色气质；地区要根据角色设定或世界观推断，不确定也要写一个模糊但真实可信的公开地区。只输出 JSON：{"wechatId":"非空微信号","region":"非空地区","bio":"朋友资料一句话","signature":"个性签名"}。`
            },
            {
                role: 'user',
                content: `角色设定：\n${String(char.description || '').slice(0, 6000)}\n\n请生成你的微信公开资料。`
            }
        ]);
    } catch (e) {
        console.warn('contact profile generation failed', e);
    }

    char.chatConfig = char.chatConfig || {};
    if (result.ok) {
        const profile = normalizeWechatAiContactProfile(parseWechatAiJsonObject(result.content));
        if (profile) {
            char.chatConfig.contactProfile = profile;
            const missing = getWechatContactProfileMissingFields(profile);
            char.chatConfig.contactProfileError = missing.length
                ? `AI 返回的${missing.join('和')}为空，点这里重试`
                : '';
            if (!char.chatConfig.signature && profile.signature) char.chatConfig.signature = profile.signature;
        } else {
            char.chatConfig.contactProfileError = 'AI 没有返回可用资料，点这里重试';
        }
    } else {
        char.chatConfig.contactProfileError = 'AI 资料生成失败，点这里重试';
    }

    window._wechatContactProfileGenerating.delete(charId);
    saveCharactersToStorage();
    refreshWechatContactProfileView(charId);
}

function refreshWechatContactProfileView(charId) {
    if (document.querySelector('#wc-view-contacts.active')) renderContacts();
    const screen = document.getElementById('wc-feature-screen');
    if (screen && screen.classList.contains('active') && window._wechatProfileCharId === charId) {
        openWechatContactProfile(charId);
    }
}

function getWechatCharMomentCover(char) {
    const config = (char && char.chatConfig) || {};
    const covers = Array.isArray(config.momentCovers) ? config.momentCovers.filter(Boolean) : [];
    if (covers.length) {
        const daySeed = Math.floor(Date.now() / 86400000);
        return covers[daySeed % covers.length];
    }
    return '';
}

function getWechatMomentCoverStyle(src, seed = '') {
    if (src) return `background-image:${getWechatCssUrl(src)}`;
    return 'background:#e9edf2';
}

function getWechatProfileBio(char) {
    const config = (char && char.chatConfig) || {};
    const aiProfile = getWechatAiContactProfile(char);
    if (aiProfile && aiProfile.bio) return aiProfile.bio;
    const name = (config.nickname || (char && char.name) || '对方');
    const raw = String(config.profileBio || char.description || '')
        .replace(/<info[\s\S]*?<\/info>/gi, ' ')
        .replace(/<character[\s\S]*?<\/character>/gi, ' ')
        .replace(/<writing_rule[\s\S]*?<\/writing_rule>/gi, ' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/```[\s\S]*$/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const looksLikeCard = /\b(char_name|appearance|personality|background_story|NSFW|writing_rule)\b/i.test(raw.slice(0, 300));
    const text = (!raw || looksLikeCard) ? (config.signature || `${name}还没有填写公开资料。`) : raw;
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function getWechatCharMoments(char) {
    const config = (char && char.chatConfig) || {};
    const saved = Array.isArray(config.aiMoments)
        ? config.aiMoments.filter(item => item && (item.source === 'ai_moment' || item.source === 'manual_moment'))
        : [];
    if (saved.length) return saved.slice(-4).reverse();
    return [];
}

function renderWechatCharMoments(char) {
    const moments = getWechatCharMoments(char);
    return moments.map((item, index) => {
        const momentId = item.id || `idx_${index}`;
        return `
        <div class="wc-profile-moment">
            <div>${wcEscapeHtml(item.text || '')}</div>
            <div class="wc-profile-moment-actions">
                <span>${formatWechatRelativeTime(item.createdAt)}</span>
                <button onclick="event.stopPropagation();collectWechatCharMoment(${quoteWechatJsString(char.id)}, ${quoteWechatJsString(momentId)})">收藏</button>
            </div>
        </div>
    `;
    }).join('');
}

function renderWechatContactProfileMeta(char, profile, isGenerating) {
    const error = (char.chatConfig || {}).contactProfileError || '';
    if (profile) {
        const missing = getWechatContactProfileMissingFields(profile);
        const missingAction = missing.length
            ? `<span class="wc-profile-meta-action" onclick="event.stopPropagation();requestWechatAiContactProfile(${quoteWechatJsString(char.id)}, true)">${isGenerating ? 'AI 正在补全微信资料...' : `资料缺少${wcEscapeHtml(missing.join('和'))}，点这里让 AI 补全`}</span>`
            : '';
        return `
            ${profile.wechatId ? `<span>微信号：${wcEscapeHtml(profile.wechatId)}</span>` : ''}
            ${profile.region ? `<span>地区：${wcEscapeHtml(profile.region)}</span>` : ''}
            ${missingAction}
        `;
    }
    if (isGenerating) return '<span>AI 正在生成微信资料...</span>';
    if (error) return `<span class="wc-profile-meta-action" onclick="event.stopPropagation();requestWechatAiContactProfile(${quoteWechatJsString(char.id)}, true)">${wcEscapeHtml(error)}</span>`;
    return '<span>微信资料待 AI 生成</span>';
}

function appendWechatSystemNotice(char, text) {
    if (!char) return;
    char.history = Array.isArray(char.history) ? char.history : [];
    char.history.push({
        type: 'system_notice',
        isMe: false,
        content: text,
        timestamp: createMessageTimestamp()
    });
}

function openWechatCharMomentPage(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    const config = char.chatConfig || {};
    const displayName = config.nickname || char.name || '未命名';
    const cover = getWechatCharMomentCover(char);
    const momentsHtml = renderWechatCharMoments(char);
    openWechatFeatureScreen('朋友圈', `
        <div class="wc-profile-page wc-char-moments-page">
            <div class="wc-moment-cover" style="${getWechatMomentCoverStyle(cover, displayName)}">
                <div class="wc-moment-cover-name">${wcEscapeHtml(displayName)}</div>
                <img class="wc-moment-cover-avatar" src="${char.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
            </div>
            <div class="wc-profile-moment-list wc-char-moment-list">${momentsHtml || '<div class="wc-profile-moment-empty">暂无朋友圈动态</div>'}</div>
        </div>
    `);
}

function openWechatContactProfile(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    window._wechatProfileCharId = charId;
    char.chatConfig = char.chatConfig || {};
    const config = char.chatConfig || {};
    const displayName = (config.nickname || char.name || '未命名');
    const isBlocked = !!config.blacklisted;
    const contactProfile = getWechatAiContactProfile(char);
    const isGeneratingProfile = window._wechatContactProfileGenerating.has(charId);
    const needsProfileCompletion = !hasUsableWechatContactProfile(char);
    openWechatFeatureScreen('详细资料', `
        <div class="wc-profile-page">
            <div class="wc-profile-card">
                <img class="wc-profile-avatar" src="${char.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div class="wc-profile-main">
                    <strong>${wcEscapeHtml(displayName)}</strong>
                    ${renderWechatContactProfileMeta(char, contactProfile, isGeneratingProfile)}
                </div>
            </div>
            <div class="wc-profile-section">
                <div class="wc-profile-section-title">朋友资料</div>
                <div class="wc-profile-bio">${wcEscapeHtml(getWechatProfileBio(char))}</div>
                ${(contactProfile && contactProfile.signature) || config.signature ? `<div class="wc-profile-signature">${wcEscapeHtml((contactProfile && contactProfile.signature) || config.signature)}</div>` : ''}
            </div>
            ${isBlocked ? `
                <div class="wc-profile-block-card">
                    <strong>已加入黑名单</strong>
                    <span>对方无法直接给你发送新消息。</span>
                    <div id="wc-profile-verify-reason">${config.friendRequestReason ? wcEscapeHtml(config.friendRequestReason) : '正在等待对方申请联系人认证...'}</div>
                    <div class="wc-profile-verify-actions">
                        <button onclick="acceptWechatFriendVerification(${quoteWechatJsString(char.id)})">同意添加</button>
                        <button onclick="rejectWechatFriendVerification(${quoteWechatJsString(char.id)})">拒绝</button>
                    </div>
                </div>
            ` : ''}
            <div class="wc-profile-actions">
                <button onclick="openChatFromContact(${quoteWechatJsString(char.id)})"><i class="ri-message-3-line"></i>发消息</button>
                <button onclick="openChatFromContact(${quoteWechatJsString(char.id)});setTimeout(()=>startWechatCall('videoCall'),260)"><i class="ri-video-chat-line"></i>音视频通话</button>
            </div>
        </div>
    `, `<i class="ri-more-2-fill" onclick="openWechatContactMoreSheet(${quoteWechatJsString(char.id)})"></i>`);
    if (needsProfileCompletion && !isGeneratingProfile && !config.contactProfileError) {
        setTimeout(() => requestWechatAiContactProfile(charId), 80);
    }
}

function openWechatContactMoreSheet(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    const isBlocked = !!(char.chatConfig && char.chatConfig.blacklisted);
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="hideActionSheet();openWechatCharMomentPage(${quoteWechatJsString(charId)})">
            <i class="ri-image-line"></i>
            <span>查看对方朋友圈</span>
        </div>
        <div class="wc-sheet-item danger" onclick="toggleWechatContactBlacklist(${quoteWechatJsString(charId)})">
            <i class="${isBlocked ? 'ri-user-follow-line' : 'ri-forbid-2-line'}"></i>
            <span>${isBlocked ? '移出黑名单' : '加入黑名单'}</span>
        </div>
    `);
}

async function toggleWechatContactBlacklist(charId) {
    hideActionSheet();
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.blacklisted = !char.chatConfig.blacklisted;
    if (!char.chatConfig.blacklisted) {
        char.chatConfig.friendRequestReason = '';
        char.chatConfig.friendRequestAt = 0;
        saveCharactersToStorage();
        openWechatContactProfile(charId);
        return;
    }
    char.chatConfig.friendRequestReason = '';
    char.chatConfig.friendRequestAt = Date.now();
    saveCharactersToStorage();
    openWechatContactProfile(charId);
    await requestWechatFriendVerification(charId);
}

async function requestWechatFriendVerification(charId, mode = 'initial') {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    let result = { ok: false, content: '' };
    try {
        result = await callChatApi([
            { role: 'system', content: `你是「${char.name}」。用户${mode === 'rejected' ? '拒绝了你的联系人认证申请，你需要重新说明情况' : '刚把你加入微信黑名单，你需要申请联系人认证'}。只输出一句自然的认证申请理由，36字以内，不要解释。` },
            { role: 'user', content: mode === 'rejected' ? '我拒绝了，你再说明为什么要重新添加？' : '你为什么要申请重新成为联系人？' }
        ]);
    } catch (e) {
        console.warn('friend verification failed', e);
    }
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.friendRequestReason = result.ok
        ? String(result.content || '').replace(/\|\|\|/g, ' ').replace(/<[^>]+>/g, '').trim().slice(0, 80)
        : '我想重新和你说清楚，可以通过一下吗？';
    char.chatConfig.friendRequestAt = Date.now();
    saveCharactersToStorage();
    openWechatContactProfile(charId);
}

function acceptWechatFriendVerification(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.blacklisted = false;
    char.chatConfig.friendRequestReason = '';
    char.chatConfig.friendRequestAt = 0;
    appendWechatSystemNotice(char, '你已重新添加联系人');
    saveCharactersToStorage();
    closeWechatFeatureScreen();
    switchWcTab('chat');
    openChat(charId);
}

async function rejectWechatFriendVerification(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.friendRequestReason = '正在请求对方重新说明...';
    saveCharactersToStorage();
    openWechatContactProfile(charId);
    await requestWechatFriendVerification(charId, 'rejected');
}

function renderMePage() {
    const page = document.getElementById('wc-me-page');
    if (!page) return;
    const profile = getUserProfile();
    if (!profile.wechatId) {
        profile.wechatId = 'user_' + Date.now().toString(36).slice(-6);
        saveUserProfile(profile);
    }
    page.innerHTML = `
        <div class="wc-me-profile">
            <img class="wc-me-avatar wc-me-editable" src="${profile.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'" onclick="openWechatMeAvatarSheet()" title="更换头像">
            <div class="wc-me-info">
                <div class="wc-me-name wc-me-editable" onclick="promptWechatMeField('name')">${wcEscapeHtml(profile.name || '我')}</div>
                <div class="wc-me-id wc-me-editable" onclick="promptWechatMeField('wechatId')">微信号：${wcEscapeHtml(profile.wechatId)}</div>
                <div class="wc-me-status wc-me-editable" onclick="promptWechatMeField('bio')">${wcEscapeHtml(profile.bio || '点击设置签名~')}</div>
            </div>
        </div>
        <div class="wc-me-menu-item" onclick="openWechatFavorites()">
            <svg class="wc-me-menu-icon" viewBox="0 0 48 48" fill="none" stroke="#7C6EF7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M24 6l5.5 11 12.5 2-9 8.5 2 12.5L24 34l-11 6 2-12.5-9-8.5 12.5-2z"/></svg>
            <span class="wc-me-menu-name">收藏</span>
        </div>
        <div class="wc-me-menu-item" onclick="openWechatMoments()">
            <svg class="wc-me-menu-icon" viewBox="0 0 48 48" fill="none" stroke="#F97066" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="10" width="36" height="28" rx="4"/><circle cx="18" cy="22" r="4"/><path d="M6 34l10-8 6 5 10-9 10 8"/></svg>
            <span class="wc-me-menu-name">朋友圈</span>
        </div>
        <div class="wc-me-menu-item" onclick="openWechatStickerStore()">
            <svg class="wc-me-menu-icon" viewBox="0 0 48 48" fill="none" stroke="#34D399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="20"/><circle cx="17" cy="20" r="2" fill="#34D399" stroke="none"/><circle cx="31" cy="20" r="2" fill="#34D399" stroke="none"/><path d="M16 30c2 4 5 6 8 6s6-2 8-6"/></svg>
            <span class="wc-me-menu-name">表情</span>
        </div>
        <div class="wc-me-menu-item" onclick="openWechatMeSettings()">
            <svg class="wc-me-menu-icon" viewBox="0 0 48 48" fill="none" stroke="#64748B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="8"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M10 38l4-4M34 14l4-4"/></svg>
            <span class="wc-me-menu-name">设置</span>
        </div>
    `;
}

function openWechatMeAvatarSheet() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="promptWechatMeAvatarUrl()"><i class="ri-link"></i><span>使用图床 URL</span></div>
        <div class="wc-sheet-item" onclick="document.getElementById('wc-me-avatar-file').click()"><i class="ri-image-add-line"></i><span>从本地照片选择</span><input id="wc-me-avatar-file" type="file" accept="image/*" style="display:none" onchange="uploadWechatMeAvatar(this)"></div>
    `);
}

function promptWechatMeAvatarUrl() {
    hideActionSheet();
    const profile = getUserProfile();
    const url = prompt('输入头像图床 URL', profile.avatar || '');
    if (!url || !url.trim()) return;
    profile.avatar = url.trim();
    saveUserProfile(profile);
    renderMePage();
    showWechatToast('头像已更新');
}

function uploadWechatMeAvatar(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const profile = getUserProfile();
        profile.avatar = e.target.result;
        saveUserProfile(profile);
        renderMePage();
        showWechatToast('头像已更新');
    };
    reader.readAsDataURL(file);
    input.value = '';
    hideActionSheet();
}

function promptWechatMeField(field) {
    const profile = getUserProfile();
    const config = {
        name: ['修改昵称', profile.name || '我', 24],
        wechatId: ['修改微信号', profile.wechatId || '', 32],
        bio: ['修改个性签名', profile.bio || '', 120]
    }[field];
    if (!config) return;
    const value = prompt(config[0], config[1]);
    if (value === null) return;
    const next = value.trim().slice(0, config[2]);
    if (field === 'name') profile.name = next || '我';
    if (field === 'wechatId') profile.wechatId = next || profile.wechatId;
    if (field === 'bio') profile.bio = next;
    saveUserProfile(profile);
    renderMePage();
    showWechatToast('资料已更新');
}

// ========== 发现页：朋友圈 / 视频号 / 直播 / 购物 ==========

function readWechatStore(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function writeWechatStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function showWechatToast(text) {
    let toast = document.getElementById('wc-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'wc-toast';
        toast.className = 'wc-toast';
        getWechatModalRoot().appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(window._wechatToastTimer);
    window._wechatToastTimer = setTimeout(() => toast.classList.remove('show'), 1400);
}

function getWechatFavoritesStore() {
    const store = readWechatStore(WECHAT_FAVORITES_STORAGE_KEY, { items: [] });
    store.items = Array.isArray(store.items) ? store.items : [];
    return store;
}

function saveWechatFavoritesStore(store) {
    writeWechatStore(WECHAT_FAVORITES_STORAGE_KEY, store);
}

function addWechatFavorite(item) {
    const store = getWechatFavoritesStore();
    const sourceKey = item.sourceKey || '';
    if (sourceKey && store.items.some(existing => existing.sourceKey === sourceKey)) {
        showWechatToast('已在收藏里');
        return null;
    }
    const favorite = {
        id: item.id || ('fav_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
        type: item.type || 'text',
        title: item.title || '收藏',
        text: item.text || '',
        media: Array.isArray(item.media) ? item.media : [],
        sourceKey,
        createdAt: item.createdAt || Date.now(),
        updatedAt: item.updatedAt || Date.now()
    };
    store.items.unshift(favorite);
    saveWechatFavoritesStore(store);
    showWechatToast('已收藏');
    return favorite;
}

function deleteWechatFavorite(id) {
    const store = getWechatFavoritesStore();
    store.items = store.items.filter(item => item.id !== id);
    saveWechatFavoritesStore(store);
    renderWechatFavoriteList();
}

function collectWechatMessage(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const msg = char && Array.isArray(char.history) ? char.history[msgIdx] : null;
    if (!char || !msg || msg.isMe) return;
    const text = stripWechatPromptText(getWechatMessagePromptContent(msg), 520) || '[微信消息]';
    addWechatFavorite({
        type: 'message',
        title: `${getWechatCharDisplayName(char)} 的消息`,
        text,
        sourceKey: `message:${char.id}:${msg.timestamp || msg.createdAt || msgIdx}:${text.slice(0, 40)}`,
        createdAt: msg.timestamp || msg.createdAt || Date.now()
    });
}

function collectWechatMoment(postId) {
    const store = getWechatMomentStore();
    const post = store.posts.find(item => item.id === postId);
    if (!post) return;
    addWechatFavorite({
        type: 'moment',
        title: `${post.userName || '我'} 的朋友圈`,
        text: post.text || '[图片朋友圈]',
        media: (post.images || []).map(url => ({ type: /^data:video\//i.test(url) ? 'video' : 'image', url })),
        sourceKey: `moment:${post.id}`,
        createdAt: post.createdAt || Date.now()
    });
}

function collectWechatCharMoment(charId, momentId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const moments = getWechatCharMoments(char);
    const fallbackIndex = String(momentId || '').startsWith('idx_') ? parseInt(String(momentId).slice(4), 10) : -1;
    const item = moments.find(moment => moment.id === momentId) || (fallbackIndex >= 0 ? moments[fallbackIndex] : null);
    if (!char || !item) return;
    addWechatFavorite({
        type: 'moment',
        title: `${getWechatCharDisplayName(char)} 的朋友圈`,
        text: item.text || '',
        sourceKey: `charMoment:${char.id}:${item.id || momentId}`,
        createdAt: item.createdAt || Date.now()
    });
}

function getWechatFavoriteMediaHtml(media = []) {
    return media.length ? `<div class="wc-fav-media">${media.slice(0, 6).map(item => {
        const url = wcEscapeHtml(item.url || '');
        if (item.type === 'audio') return `<audio src="${url}" controls></audio>`;
        if (item.type === 'video') return `<video src="${url}" controls muted playsinline></video>`;
        return `<img src="${url}" onerror="this.style.opacity='0.35'">`;
    }).join('')}</div>` : '';
}

function openWechatFavorites() {
    openWechatFeatureScreen('收藏', `
        <div class="wc-fav-page">
            <div class="wc-fav-search"><i class="ri-search-line"></i><input id="wc-fav-search-input" placeholder="搜索收藏和笔记" oninput="renderWechatFavoriteList(this.value)"></div>
            <div id="wc-fav-list" class="wc-fav-list"></div>
        </div>
    `, '<i class="ri-add-line" onclick="openWechatFavoriteNoteEditor()"></i>');
    renderWechatFavoriteList();
}

function renderWechatFavoriteList(query = '') {
    const listEl = document.getElementById('wc-fav-list');
    if (!listEl) return;
    const q = String(query || document.getElementById('wc-fav-search-input')?.value || '').trim().toLowerCase();
    const items = getWechatFavoritesStore().items
        .filter(item => !q || `${item.title || ''} ${item.text || ''}`.toLowerCase().includes(q))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    listEl.innerHTML = items.length ? items.map(item => `
        <div class="wc-fav-item">
            <div class="wc-fav-main" onclick="${item.type === 'note' ? `openWechatFavoriteNoteEditor(${quoteWechatJsString(item.id)})` : ''}">
                <div class="wc-fav-title">${wcEscapeHtml(item.title || '收藏')}</div>
                <div class="wc-fav-text">${wcEscapeHtml(item.text || '').replace(/\n/g, '<br>') || ' '}</div>
                ${getWechatFavoriteMediaHtml(item.media || [])}
                <div class="wc-fav-time">${new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleString()}</div>
            </div>
            <div class="wc-fav-actions">
                <button onclick="shareWechatText(${quoteWechatJsString(item.title || '收藏')}, ${quoteWechatJsString(item.text || '[收藏内容]')})"><i class="ri-share-forward-line"></i></button>
                <button onclick="deleteWechatFavorite(${quoteWechatJsString(item.id)})"><i class="ri-delete-bin-line"></i></button>
            </div>
        </div>
    `).join('') : '<div class="wc-discover-empty">还没有收藏</div>';
}

function getWechatFavoriteById(id) {
    return getWechatFavoritesStore().items.find(item => item.id === id) || null;
}

function saveWechatFavoriteNoteDraft() {
    const id = window._wechatEditingFavoriteNoteId;
    const titleEl = document.getElementById('wc-note-title');
    const textEl = document.getElementById('wc-note-text');
    if (!id || !titleEl || !textEl) return;
    const store = getWechatFavoritesStore();
    const item = store.items.find(fav => fav.id === id);
    if (!item) return;
    item.title = titleEl.value.trim() || '未命名笔记';
    item.text = textEl.value;
    item.updatedAt = Date.now();
    saveWechatFavoritesStore(store);
}

function captureWechatNoteUndo() {
    const textEl = document.getElementById('wc-note-text');
    if (!textEl) return;
    window._wechatNoteUndo = window._wechatNoteUndo || [];
    window._wechatNoteRedo = [];
    const last = window._wechatNoteUndo[window._wechatNoteUndo.length - 1];
    if (last !== textEl.value) window._wechatNoteUndo.push(textEl.value);
    if (window._wechatNoteUndo.length > 50) window._wechatNoteUndo.shift();
}

function undoWechatFavoriteNote() {
    const textEl = document.getElementById('wc-note-text');
    if (!textEl || !window._wechatNoteUndo || !window._wechatNoteUndo.length) return;
    window._wechatNoteRedo = window._wechatNoteRedo || [];
    window._wechatNoteRedo.push(textEl.value);
    textEl.value = window._wechatNoteUndo.pop();
    saveWechatFavoriteNoteDraft();
}

function redoWechatFavoriteNote() {
    const textEl = document.getElementById('wc-note-text');
    if (!textEl || !window._wechatNoteRedo || !window._wechatNoteRedo.length) return;
    window._wechatNoteUndo = window._wechatNoteUndo || [];
    window._wechatNoteUndo.push(textEl.value);
    textEl.value = window._wechatNoteRedo.pop();
    saveWechatFavoriteNoteDraft();
}

function getWechatNoteActionHtml(type) {
    const icons = {
        undo: '<svg viewBox="0 0 48 48" fill="none"><path d="M11.2721 36.7279C14.5294 39.9853 19.0294 42 24 42C33.9411 42 42 33.9411 42 24C42 14.0589 33.9411 6 24 6C19.0294 6 14.5294 8.01472 11.2721 11.2721C9.61407 12.9301 6 17 6 17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 9V17H14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        redo: '<svg viewBox="0 0 48 48" fill="none"><path d="M36.7279 36.7279C33.4706 39.9853 28.9706 42 24 42C14.0589 42 6 33.9411 6 24C6 14.0589 14.0589 6 24 6C28.9706 6 33.4706 8.01472 36.7279 11.2721C38.3859 12.9301 42 17 42 17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 8V17H33" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        more: '<svg viewBox="0 0 48 48" fill="none"><circle cx="12" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="36" cy="24" r="3" fill="currentColor"/></svg>'
    };
    const labels = { undo: '撤销', redo: '重做', more: '转发' };
    const handlers = { undo: 'undoWechatFavoriteNote()', redo: 'redoWechatFavoriteNote()', more: 'shareWechatFavoriteNote()' };
    return `<button type="button" class="wc-note-action-btn" title="${labels[type]}" onclick="${handlers[type]}">${icons[type]}</button>`;
}

function openWechatFavoriteNoteEditor(noteId = '') {
    let note = noteId ? getWechatFavoriteById(noteId) : null;
    if (!note) {
        note = addWechatFavorite({ type: 'note', title: '新笔记', text: '', sourceKey: '' });
    }
    if (!note) return;
    window._wechatEditingFavoriteNoteId = note.id;
    window._wechatNoteUndo = [];
    window._wechatNoteRedo = [];
    openWechatFeatureScreen('笔记', `
        <div class="wc-note-page">
            <input id="wc-note-title" class="wc-note-title" value="${wcEscapeHtml(note.title || '')}" placeholder="标题" oninput="saveWechatFavoriteNoteDraft()">
            <textarea id="wc-note-text" class="wc-note-text" placeholder="记录文字、图片或者录音" onbeforeinput="captureWechatNoteUndo()" oninput="saveWechatFavoriteNoteDraft()">${wcEscapeHtml(note.text || '')}</textarea>
            <div class="wc-note-tools">
                <label><i class="ri-image-add-line"></i><span>图片</span><input type="file" accept="image/*" multiple onchange="handleWechatFavoriteNoteMedia(this, 'image')"></label>
                <label><i class="ri-mic-line"></i><span>录音</span><input type="file" accept="audio/*" onchange="handleWechatFavoriteNoteMedia(this, 'audio')"></label>
            </div>
            <div id="wc-note-media" class="wc-note-media">${getWechatFavoriteMediaHtml(note.media || [])}</div>
            <div class="wc-note-time">自动保存 · ${new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleString()}</div>
        </div>
    `, `${getWechatNoteActionHtml('undo')}${getWechatNoteActionHtml('redo')}${getWechatNoteActionHtml('more')}`);
    setWechatFeatureLeftText('收藏', 'openWechatFavorites()');
}

function handleWechatFavoriteNoteMedia(input, type) {
    const files = Array.from(input.files || []).slice(0, 6);
    const id = window._wechatEditingFavoriteNoteId;
    if (!files.length || !id) return;
    const store = getWechatFavoritesStore();
    const item = store.items.find(fav => fav.id === id);
    if (!item) return;
    item.media = Array.isArray(item.media) ? item.media : [];
    let remaining = files.length;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            item.media.push({ type, url: e.target.result, name: file.name });
            item.updatedAt = Date.now();
            remaining -= 1;
            if (remaining === 0) {
                saveWechatFavoritesStore(store);
                openWechatFavoriteNoteEditor(id);
            }
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function shareWechatFavoriteNote() {
    const item = getWechatFavoriteById(window._wechatEditingFavoriteNoteId);
    if (!item) return;
    saveWechatFavoriteNoteDraft();
    shareWechatText(item.title || '收藏笔记', item.text || '[图片/录音笔记]');
}

function openWechatStickerStore() {
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const activePackId = window._wechatStickerImportPackId || data.packs[0]?.id || '';
    const totalStickers = data.packs.reduce((sum, pack) => sum + ((pack.stickers || []).length), 0);
    const packOptions = data.packs.length
        ? data.packs.map(pack => `<option value="${wcEscapeHtml(pack.id)}" ${pack.id === activePackId ? 'selected' : ''}>${wcEscapeHtml(pack.name)}（${(pack.stickers || []).length}）</option>`).join('')
        : '<option value="">先创建一个贴纸包</option>';
    openWechatFeatureScreen('表情', `
        <div class="wc-sticker-store-page">
            <div class="wc-sticker-store-hero wc-sticker-soft-hero">
                <div class="wc-sticker-hero-icon"><i class="ri-emotion-happy-line"></i></div>
                <div>
                    <strong>我的表情</strong>
                    <span>${data.packs.length} 个分组 · ${totalStickers} 张贴纸</span>
                </div>
            </div>
            <div class="wc-sticker-quick-row">
                <button onclick="openStickerPackCreateModal()"><i class="ri-folder-add-line"></i><span>新建分组</span></button>
                <label><i class="ri-image-add-line"></i><span>本地图片</span><input type="file" accept="image/*" multiple onchange="importWechatStickerLocalFiles(this)"></label>
                <button onclick="openStickerManager()"><i class="ri-settings-3-line"></i><span>管理</span></button>
            </div>
            <div class="wc-sticker-import-card">
                <div class="wc-sticker-import-title">
                    <i class="ri-link-m"></i>
                    <div><strong>从图床导入</strong><span>选择分组，粘贴链接或输入新分组名</span></div>
                </div>
                <div class="wc-sticker-boltp-ready">
                    <div>
                        <strong>这狗</strong>
                        <span>已内置 Boltp 分享包，当前默认包会自动补到 176 张。</span>
                    </div>
                    <button onclick="importBoltpStickerShare()"><i class="ri-refresh-line"></i> 同步</button>
                </div>
                <div class="wc-sticker-import-target">
                    <select id="wc-sticker-import-pack" onchange="window._wechatStickerImportPackId=this.value">${packOptions}</select>
                    <input id="wc-sticker-new-pack-name" maxlength="24" placeholder="新贴纸包名">
                </div>
                <textarea id="wc-sticker-url-import" class="wc-sticker-import-text" placeholder="每行一个图床链接，支持：&#10;开心：https://example.com/happy.png&#10;https://example.com/sticker.webp"></textarea>
                <div class="wc-sticker-import-actions">
                    <button onclick="importWechatStickerUrls()"><i class="ri-link"></i><span>导入 URL</span></button>
                    <label><i class="ri-image-add-line"></i><span>本地图片</span><input type="file" accept="image/*" multiple onchange="importWechatStickerLocalFiles(this)"></label>
                </div>
                <div class="wc-sticker-share-import">
                    <input id="wc-sticker-share-url" value="https://www.boltp.com/shares/26c3884813ed4f4999b78e49d448f2e6" placeholder="粘贴 Boltp 分享链接">
                    <button onclick="importBoltpStickerShare()"><i class="ri-cloud-line"></i><span>导入图床分享</span></button>
                </div>
            </div>
            <div class="wc-sticker-pack-summary">
                <div class="wc-sticker-summary-head">
                    <strong>我的贴纸包</strong>
                    <button onclick="openStickerManager()">编辑</button>
                </div>
                ${data.packs.length ? data.packs.map(pack => `
                    <div class="wc-sticker-pack-row" onclick="openStickerManager()">
                        <div class="wc-sticker-pack-preview">
                            ${(pack.stickers || []).slice(0, 4).map(sticker => `<img src="${wcEscapeHtml(sticker.url)}" alt="${wcEscapeHtml(sticker.name || '')}" onerror="this.style.opacity='0.35'">`).join('') || '<span>空</span>'}
                        </div>
                        <div class="wc-sticker-pack-meta">
                            <strong>${wcEscapeHtml(pack.name || '未命名贴纸包')}</strong>
                            <span>${(pack.stickers || []).length} 张贴纸</span>
                        </div>
                        <i class="ri-arrow-right-s-line"></i>
                    </div>
                `).join('') : '<div class="wc-discover-empty">还没有贴纸包，先在上面创建一个</div>'}
            </div>
        </div>
    `);
}

function ensureWechatStickerImportPack() {
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const nameInput = document.getElementById('wc-sticker-new-pack-name');
    const select = document.getElementById('wc-sticker-import-pack');
    const newName = (nameInput?.value || '').trim();

    if (newName) {
        const pack = { id: 'pack_' + Date.now(), name: newName.slice(0, 24), stickers: [] };
        data.packs.push(pack);
        saveStickerPacks(data);
        window._wechatStickerImportPackId = pack.id;
        return pack;
    }

    const packId = select?.value || window._wechatStickerImportPackId || data.packs[0]?.id || '';
    const pack = data.packs.find(item => item.id === packId);
    if (pack) {
        window._wechatStickerImportPackId = pack.id;
        return pack;
    }

    const fallbackPack = { id: 'pack_' + Date.now(), name: '我的贴纸', stickers: [] };
    data.packs.push(fallbackPack);
    saveStickerPacks(data);
    window._wechatStickerImportPackId = fallbackPack.id;
    return fallbackPack;
}

function appendWechatStickersToPack(packId, stickers) {
    if (!stickers.length) return false;
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const pack = data.packs.find(item => item.id === packId);
    if (!pack) return false;
    pack.stickers = Array.isArray(pack.stickers) ? pack.stickers : [];
    const existingUrls = new Set(pack.stickers.map(item => item.url));
    const fresh = stickers.filter(item => item && item.url && !existingUrls.has(item.url));
    if (!fresh.length) {
        window._wechatStickerImportPackId = pack.id;
        window._activeStickerPackId = pack.id;
        refreshStickerSurfaces();
        return false;
    }
    pack.stickers.push(...fresh);
    saveStickerPacks(data);
    window._wechatStickerImportPackId = pack.id;
    window._activeStickerPackId = pack.id;
    refreshStickerSurfaces();
    return true;
}

function ensureWechatNamedStickerPack(name) {
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const packName = (name || '图床贴纸包').trim().slice(0, 24);
    let pack = data.packs.find(item => item.name === packName);
    if (!pack) {
        pack = { id: 'pack_' + Date.now(), name: packName, stickers: [] };
        data.packs.push(pack);
        saveStickerPacks(data);
    }
    window._wechatStickerImportPackId = pack.id;
    window._activeStickerPackId = pack.id;
    return pack;
}

function getBoltpShareSlug(url) {
    const text = String(url || '').trim();
    const match = text.match(/boltp\.com\/shares\/([^/?#]+)/i) || text.match(/^([a-f0-9]{24,64})$/i);
    return match ? match[1] : '';
}

async function importBoltpStickerShare() {
    const input = document.getElementById('wc-sticker-share-url');
    const rawUrl = input?.value || 'https://www.boltp.com/shares/26c3884813ed4f4999b78e49d448f2e6';
    const slug = getBoltpShareSlug(rawUrl);
    if (!slug) {
        showWechatToast('没有识别到 Boltp 分享链接');
        return;
    }
    showWechatToast('正在读取图床分享...');
    try {
        const detailRes = await fetch(`https://www.boltp.com/api/v2/shares/${encodeURIComponent(slug)}`, { credentials: 'omit' });
        const detail = await detailRes.json();
        const share = detail?.data || {};
        if (detail?.status === 'error' || share.is_valid === false) throw new Error(detail?.message || '分享不可访问');
        const packName = share.album?.name || share.content || '图床贴纸包';
        const stickers = [];
        let page = 1;
        let lastPage = 1;
        do {
            const res = await fetch(`https://www.boltp.com/api/v2/shares/${encodeURIComponent(slug)}/photos?page=${page}&per_page=100`, { credentials: 'omit' });
            const json = await res.json();
            if (json?.status === 'error') throw new Error(json?.message || '图片列表读取失败');
            const box = json?.data || {};
            const photos = Array.isArray(box.data) ? box.data : [];
            photos.forEach(photo => {
                const url = photo.public_url || photo.thumbnail_url;
                if (!url) return;
                stickers.push({
                    id: 'stk_boltp_' + photo.id,
                    name: photo.name || `贴纸${stickers.length + 1}`,
                    url
                });
            });
            lastPage = Number(box.meta?.last_page) || page;
            page += 1;
        } while (page <= lastPage && stickers.length < 500);
        if (!stickers.length) throw new Error('分享里没有可导入图片');
        const pack = ensureWechatNamedStickerPack(packName);
        const before = (pack.stickers || []).length;
        appendWechatStickersToPack(pack.id, stickers);
        const after = (getStickerPacks().packs.find(item => item.id === pack.id)?.stickers || []).length;
        showWechatToast(`已导入 ${Math.max(0, after - before)} 张到「${packName}」`);
        openWechatStickerStore();
    } catch (e) {
        showWechatToast(e.message || '图床分享导入失败');
    }
}
window.importBoltpStickerShare = importBoltpStickerShare;

function importWechatStickerUrls() {
    const textEl = document.getElementById('wc-sticker-url-import');
    const stickers = parseStickerBatchText(textEl?.value || '');
    if (!stickers.length) {
        showWechatToast('没有识别到图片 URL');
        return;
    }
    const pack = ensureWechatStickerImportPack();
    if (appendWechatStickersToPack(pack.id, stickers)) {
        showWechatToast(`已导入 ${stickers.length} 张`);
        openWechatStickerStore();
    }
}

function importWechatStickerLocalFiles(input) {
    const files = Array.from(input.files || []).filter(file => /^image\//i.test(file.type)).slice(0, 30);
    if (!files.length) return;
    const pack = ensureWechatStickerImportPack();
    let remaining = files.length;
    const stickers = [];
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            stickers.push({
                id: 'stk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                name: file.name.replace(/\.[^.]+$/, '') || '本地贴纸',
                url: e.target.result
            });
            remaining -= 1;
            if (remaining === 0) {
                appendWechatStickersToPack(pack.id, stickers);
                input.value = '';
                showWechatToast(`已导入 ${stickers.length} 张`);
                openWechatStickerStore();
            }
        };
        reader.readAsDataURL(file);
    });
}

function openWechatMeSettings() {
    const profile = getUserProfile();
    openWechatFeatureScreen('设置', `
        <div class="wc-me-settings-page">
            <div class="wc-me-settings-card">
                <label class="wc-compose-field">
                    <span>头像 URL</span>
                    <input id="wc-me-set-avatar" value="${wcEscapeHtml(profile.avatar || '')}" placeholder="粘贴头像图床 URL">
                </label>
                <label class="wc-compose-field">
                    <span>昵称</span>
                    <input id="wc-me-set-name" value="${wcEscapeHtml(profile.name || '我')}" maxlength="24" placeholder="我">
                </label>
                <label class="wc-compose-field">
                    <span>微信号</span>
                    <input id="wc-me-set-id" value="${wcEscapeHtml(profile.wechatId || '')}" maxlength="32" placeholder="user_xxxxxx">
                </label>
                <label class="wc-compose-field">
                    <span>个性签名</span>
                    <textarea id="wc-me-set-bio" maxlength="120" placeholder="写一句签名">${wcEscapeHtml(profile.bio || '')}</textarea>
                </label>
                <label class="wc-compose-field">
                    <span>朋友圈封面 URL</span>
                    <input id="wc-me-set-cover" value="${wcEscapeHtml(profile.momentCover || '')}" placeholder="可留空，朋友圈顶部会使用默认背景">
                </label>
                <button class="wc-me-settings-save" onclick="saveWechatMeSettings()">保存</button>
            </div>
            <div class="wc-me-settings-links">
                <button onclick="openWechatFavorites()"><i class="ri-star-line"></i><span>收藏和笔记</span></button>
                <button onclick="openWechatMoments()"><i class="ri-image-2-line"></i><span>我的朋友圈</span></button>
                <button onclick="openWechatStickerStore()"><i class="ri-emotion-line"></i><span>表情包</span></button>
            </div>
        </div>
    `);
}

function saveWechatMeSettings() {
    const prev = getUserProfile();
    const profile = {
        ...prev,
        avatar: (document.getElementById('wc-me-set-avatar')?.value || '').trim(),
        name: (document.getElementById('wc-me-set-name')?.value || '').trim() || '我',
        wechatId: (document.getElementById('wc-me-set-id')?.value || '').trim() || prev.wechatId,
        bio: (document.getElementById('wc-me-set-bio')?.value || '').trim(),
        momentCover: (document.getElementById('wc-me-set-cover')?.value || '').trim()
    };
    saveUserProfile(profile);
    renderMePage();
    showWechatToast('已保存');
}

function ensureWechatFeatureScreen() {
    let screen = document.getElementById('wc-feature-screen');
    if (screen) return screen;
    screen = document.createElement('div');
    screen.id = 'wc-feature-screen';
    screen.className = 'wc-feature-screen hidden';
    screen.innerHTML = `
        <div class="wc-feature-header">
            <i class="ri-arrow-left-s-line" onclick="closeWechatFeatureScreen()"></i>
            <span id="wc-feature-title"></span>
            <span id="wc-feature-action"></span>
        </div>
        <div class="wc-feature-body" id="wc-feature-body"></div>
    `;
    document.getElementById('app-wechat-window')?.appendChild(screen);
    return screen;
}

function openWechatFeatureScreen(title, html, actionHtml = '') {
    const screen = ensureWechatFeatureScreen();
    const backEl = screen.querySelector('.wc-feature-header > i');
    if (backEl) {
        backEl.className = 'ri-arrow-left-s-line';
        backEl.textContent = '';
        backEl.setAttribute('onclick', 'closeWechatFeatureScreen()');
    }
    document.getElementById('wc-feature-title').textContent = title;
    document.getElementById('wc-feature-action').innerHTML = actionHtml;
    document.getElementById('wc-feature-body').innerHTML = html;
    screen.classList.remove('hidden');
    screen.classList.add('active');
    requestAnimationFrame(() => screen.classList.add('active'));
}

function setWechatFeatureLeftText(text, handler) {
    const backEl = document.querySelector('#wc-feature-screen .wc-feature-header > i');
    if (!backEl) return;
    backEl.className = 'wc-feature-text-left';
    backEl.textContent = text;
    backEl.setAttribute('onclick', handler);
}

function closeWechatFeatureScreen() {
    const screen = document.getElementById('wc-feature-screen');
    if (!screen) return;
    screen.classList.remove('active');
    setTimeout(() => screen.classList.add('hidden'), 220);
}

function formatWechatRelativeTime(ts) {
    const diff = Math.max(0, Date.now() - (Number(ts) || Date.now()));
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min}分钟前`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}小时前`;
    return `${Math.floor(hour / 24)}天前`;
}

function getWechatMomentStore() {
    const store = readWechatStore(WECHAT_MOMENTS_STORAGE_KEY, { posts: [] });
    if (!Array.isArray(store.posts)) store.posts = [];
    return store;
}

function saveWechatMomentStore(store) {
    writeWechatStore(WECHAT_MOMENTS_STORAGE_KEY, store);
}

function getMomentTimeComment(ts) {
    const hour = new Date(ts || Date.now()).getHours();
    if (hour < 11) return '早上看到这个，还挺有精神的。';
    if (hour < 18) return '这个时间发出来刚刚好，我看到了。';
    return '晚上刷到这个，感觉很适合慢慢聊。';
}

function scheduleWechatMomentEngagement(post) {
    const chars = (window.myCharacters || []).slice(0, 6);
    const needsAsk = /[?？]|怎么|为什么|为啥|怎么办|不懂|纠结/.test(post.text || '');
    post.pending = chars.map((char, index) => ({
        charId: char.id,
        type: needsAsk && index === 0 ? 'ask' : 'comment',
        dueAt: Date.now() + 45000 + index * 35000 + Math.floor(Math.random() * 45000),
        done: false
    }));
}

function processWechatMomentQueue() {
    const store = getWechatMomentStore();
    let changed = false;
    store.posts.forEach(post => {
        (post.pending || []).forEach(task => {
            if (task.done || task.dueAt > Date.now()) return;
            const char = (window.myCharacters || []).find(c => c.id === task.charId);
            if (!char) {
                task.done = true;
                changed = true;
                return;
            }
            if (task.type === 'ask') {
                if (!char.history) char.history = [];
                char.history.push({
                    type: 'text',
                    isMe: false,
                    content: `我看到你朋友圈说「${(post.text || '这条动态').slice(0, 36)}」，我有点在意，能跟我说说吗？`,
                    timestamp: createMessageTimestamp()
                });
                if (window.currentChatCharId === char.id) refreshChatView(char);
                renderChatList();
            } else {
                post.comments = post.comments || [];
                post.comments.push({
                    id: 'mc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    charId: char.id,
                    name: (char.chatConfig && char.chatConfig.nickname) || char.name,
                    avatar: char.avatar || DEFAULT_AVATAR,
                    text: getMomentTimeComment(post.createdAt),
                    createdAt: Date.now()
                });
            }
            task.done = true;
            changed = true;
        });
    });
    if (changed) {
        saveWechatMomentStore(store);
        saveCharactersToStorage();
    }
}

function openWechatMoments() {
    processWechatMomentQueue();
    window._wechatMomentDraftImages = window._wechatMomentDraftImages || [];
    renderWechatMoments();
}

function renderWechatMoments() {
    const store = getWechatMomentStore();
    const profile = getUserProfile();
    const posts = store.posts.slice().sort((a, b) => b.createdAt - a.createdAt);
    const coverImage = profile.momentCover || '';
    openWechatFeatureScreen('朋友圈', `
        <div class="wc-moment-cover" style="${getWechatMomentCoverStyle(coverImage, profile.name || '我')}" onclick="handleWechatMomentCoverClick()" ondblclick="handleWechatMomentCoverDoubleClick()">
            <div class="wc-moment-cover-name">${wcEscapeHtml(profile.name || '我')}</div>
            <img class="wc-moment-cover-avatar" src="${profile.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
        </div>
        <div class="wc-moment-feed">
            ${posts.length ? posts.map(renderWechatMomentPost).join('') : '<div class="wc-discover-empty">还没有朋友圈动态</div>'}
        </div>
    `, '<i class="ri-camera-line" onclick="openWechatMomentCameraSheet()"></i>');
}

function renderWechatMomentPost(post) {
    const comments = post.comments || [];
    const waiting = (post.pending || []).filter(t => !t.done).length;
    const postId = quoteWechatJsString(post.id);
    return `
        <div class="wc-moment-post">
            <div class="wc-moment-avatar"><img src="${post.userAvatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'"></div>
            <div class="wc-moment-content">
                <div class="wc-moment-name">${wcEscapeHtml(post.userName || '我')}</div>
                ${post.text ? `<div class="wc-moment-text">${wcEscapeHtml(post.text).replace(/\n/g, '<br>')}</div>` : ''}
                ${(post.images || []).length ? `<div class="wc-moment-grid">${post.images.map(renderWechatMomentMedia).join('')}</div>` : ''}
                <div class="wc-moment-meta">
                    <span>${formatWechatRelativeTime(post.createdAt)}${post.location ? ` · ${wcEscapeHtml(post.location)}` : ''}${post.visibility === 'private' ? ' · 私密' : ''}</span>
                    <div class="wc-moment-meta-actions">
                        <button onclick="collectWechatMoment(${postId})">收藏</button>
                        <button onclick="shareWechatMomentPost(${postId})">转发</button>
                        <button onclick="editWechatMoment(${postId})">编辑</button>
                        <button onclick="deleteWechatMoment(${postId})">删除</button>
                    </div>
                </div>
                ${waiting ? `<div class="wc-moment-waiting"><i class="ri-time-line"></i>${waiting} 位好友稍后可能留言</div>` : ''}
                ${comments.length ? `<div class="wc-moment-comments">${comments.map(comment => renderWechatMomentComment(post.id, comment)).join('')}</div>` : ''}
            </div>
        </div>
    `;
}

function renderWechatMomentComment(postId, comment) {
    const postArg = quoteWechatJsString(postId);
    const commentArg = quoteWechatJsString(comment.id || '');
    const replyTo = comment.replyTo ? `<em>回复 ${wcEscapeHtml(comment.replyTo)}</em>` : '';
    return `
        <div class="wc-moment-comment">
            <div><strong>${wcEscapeHtml(comment.name || '好友')}</strong>${replyTo}：${wcEscapeHtml(comment.text || '')}</div>
            <button onclick="replyWechatMomentComment(${postArg}, ${commentArg})">回复</button>
        </div>
    `;
}

function renderWechatMomentMedia(src) {
    const safeSrc = wcEscapeHtml(src || '');
    if (/^data:video\//i.test(src || '') || /\.(mp4|webm|mov)(\?|#|$)/i.test(src || '')) {
        return `<video src="${safeSrc}" controls muted playsinline onerror="this.style.opacity='0.35'"></video>`;
    }
    return `<img src="${safeSrc}" onerror="this.style.opacity='0.35'">`;
}

function renderWechatMomentDraftPreview() {
    const box = document.getElementById('wc-moment-draft-preview');
    if (!box) return;
    const images = window._wechatMomentDraftImages || [];
    box.innerHTML = images.map((src, index) => `<div class="wc-moment-draft-img">${renderWechatMomentMedia(src)}<button onclick="removeWechatMomentDraftImage(${index})"><i class="ri-close-line"></i></button></div>`).join('');
}

function handleWechatMomentCoverClick() {
    clearTimeout(window._wechatMomentCoverClickTimer);
    window._wechatMomentCoverClickTimer = setTimeout(() => openWechatMomentCoverSheet(), 220);
}

function handleWechatMomentCoverDoubleClick() {
    clearTimeout(window._wechatMomentCoverClickTimer);
    openNewWechatMomentTextComposer();
}

function openWechatMomentCoverSheet() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="promptWechatMomentCoverUrl()"><i class="ri-link"></i><span>使用图床 URL 更换封面</span></div>
        <div class="wc-sheet-item" onclick="document.getElementById('wc-moment-cover-file').click()"><i class="ri-image-add-line"></i><span>从本地上传封面</span><input id="wc-moment-cover-file" type="file" accept="image/*" style="display:none" onchange="uploadWechatMomentCover(this)"></div>
    `);
}

function promptWechatMomentCoverUrl() {
    hideActionSheet();
    const old = getUserProfile().momentCover || '';
    const url = prompt('输入朋友圈封面图床 URL', old);
    if (!url || !url.trim()) return;
    saveWechatMomentCover(url.trim());
}

function uploadWechatMomentCover(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => saveWechatMomentCover(e.target.result);
    reader.readAsDataURL(file);
    input.value = '';
    hideActionSheet();
}

function saveWechatMomentCover(src) {
    const profile = getUserProfile();
    profile.momentCover = src;
    saveUserProfile(profile);
    renderWechatMoments();
}

function openWechatMomentCameraSheet() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="openNewWechatMomentTextComposer()"><i class="ri-edit-2-line"></i><span>发表文字</span></div>
        <div class="wc-sheet-item" onclick="document.getElementById('wc-moment-camera-file').click()"><i class="ri-camera-line"></i><span>拍摄（照片或者视频）</span><input id="wc-moment-camera-file" type="file" accept="image/*,video/*" capture style="display:none" onchange="handleWechatMomentCameraPick(this)"></div>
        <div class="wc-sheet-item" onclick="document.getElementById('wc-moment-album-file').click()"><i class="ri-image-line"></i><span>从手机相册选择</span><input id="wc-moment-album-file" type="file" accept="image/*,video/*" multiple style="display:none" onchange="handleWechatMomentCameraPick(this)"></div>
    `);
}

function handleWechatMomentCameraPick(input) {
    window._wechatMomentDraftImages = [];
    window._wechatEditingMomentId = '';
    handleWechatMomentImages(input);
    hideActionSheet();
    openWechatMomentTextComposer();
}

function openNewWechatMomentTextComposer() {
    window._wechatMomentDraftImages = [];
    window._wechatEditingMomentId = '';
    openWechatMomentTextComposer();
}

function openWechatMomentTextComposer(postId = '') {
    hideActionSheet();
    const store = getWechatMomentStore();
    const editingPost = postId ? store.posts.find(post => post.id === postId) : null;
    window._wechatEditingMomentId = editingPost ? editingPost.id : '';
    window._wechatMomentDraftImages = editingPost ? (editingPost.images || []).slice() : (window._wechatMomentDraftImages || []);
    const title = editingPost ? '编辑朋友圈' : '发表文字';
    const actionText = editingPost ? '保存' : '发表';
    openWechatFeatureScreen(title, `
        <div class="wc-moment-compose-page">
            <textarea id="wc-moment-text" class="wc-moment-compose-text" placeholder="这一刻的想法..." maxlength="500">${wcEscapeHtml(editingPost?.text || '')}</textarea>
            <div id="wc-moment-draft-preview" class="wc-moment-grid"></div>
            <div class="wc-moment-compose-row" onclick="promptWechatMomentLocation()">
                <i class="ri-map-pin-line"></i><span>所在位置</span><em id="wc-moment-location-text" data-value="${wcEscapeHtml(editingPost?.location || '')}">${editingPost?.location ? wcEscapeHtml(editingPost.location) : '不显示位置'}</em>
            </div>
            <div class="wc-moment-compose-row">
                <i class="ri-eye-line"></i><span>谁可以看</span>
                <div class="wc-moment-visibility">
                    <button type="button" class="${editingPost?.visibility === 'private' ? '' : 'active'}" data-value="public" onclick="setWechatMomentVisibility('public')">公开</button>
                    <button type="button" class="${editingPost?.visibility === 'private' ? 'active' : ''}" data-value="private" onclick="setWechatMomentVisibility('private')">私密</button>
                </div>
                <input type="hidden" id="wc-moment-visibility-value" value="${editingPost?.visibility === 'private' ? 'private' : 'public'}">
            </div>
            <label class="wc-moment-add-media"><i class="ri-image-add-line"></i><span>添加照片/视频</span><input type="file" accept="image/*,video/*" multiple onchange="handleWechatMomentImages(this)"></label>
        </div>
    `, `<button type="button" class="wc-feature-publish-btn" onclick="publishWechatMoment()">${actionText}</button>`);
    setWechatFeatureLeftText('取消', 'openWechatMoments()');
    renderWechatMomentDraftPreview();
}

function promptWechatMomentLocation() {
    const textEl = document.getElementById('wc-moment-location-text');
    const old = textEl && textEl.dataset.value ? textEl.dataset.value : '';
    const value = prompt('输入所在位置', old);
    if (!textEl) return;
    textEl.dataset.value = (value || '').trim();
    textEl.textContent = textEl.dataset.value || '不显示位置';
}

function setWechatMomentVisibility(value) {
    const safe = value === 'private' ? 'private' : 'public';
    const input = document.getElementById('wc-moment-visibility-value');
    if (input) input.value = safe;
    document.querySelectorAll('.wc-moment-visibility button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === safe);
    });
}

function handleWechatMomentImages(input) {
    const files = Array.from(input.files || []).slice(0, 9);
    window._wechatMomentDraftImages = window._wechatMomentDraftImages || [];
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            window._wechatMomentDraftImages.push(e.target.result);
            renderWechatMomentDraftPreview();
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function removeWechatMomentDraftImage(index) {
    window._wechatMomentDraftImages = window._wechatMomentDraftImages || [];
    window._wechatMomentDraftImages.splice(index, 1);
    renderWechatMomentDraftPreview();
}

function publishWechatMoment() {
    const text = (document.getElementById('wc-moment-text')?.value || '').trim();
    const images = (window._wechatMomentDraftImages || []).slice();
    if (!text && images.length === 0) return;
    const profile = getUserProfile();
    const visibility = document.getElementById('wc-moment-visibility-value')?.value === 'private' ? 'private' : 'public';
    const store = getWechatMomentStore();
    const editingId = window._wechatEditingMomentId || '';
    const editingPost = editingId ? store.posts.find(item => item.id === editingId) : null;
    if (editingPost) {
        editingPost.text = text;
        editingPost.images = images;
        editingPost.userName = profile.name || editingPost.userName || '我';
        editingPost.userAvatar = profile.avatar || editingPost.userAvatar || DEFAULT_AVATAR;
        editingPost.location = (document.getElementById('wc-moment-location-text')?.dataset.value || '').trim();
        editingPost.visibility = visibility;
        editingPost.updatedAt = Date.now();
        editingPost.comments = Array.isArray(editingPost.comments) ? editingPost.comments : [];
        editingPost.pending = visibility === 'private' ? [] : (Array.isArray(editingPost.pending) ? editingPost.pending : []);
        saveWechatMomentStore(store);
        window._wechatMomentDraftImages = [];
        window._wechatEditingMomentId = '';
        renderWechatMoments();
        return;
    }
    const post = {
        id: 'mom_' + Date.now(),
        text,
        images,
        userName: profile.name || '我',
        userAvatar: profile.avatar || DEFAULT_AVATAR,
        location: (document.getElementById('wc-moment-location-text')?.dataset.value || '').trim(),
        visibility,
        comments: [],
        pending: [],
        createdAt: Date.now()
    };
    if (visibility !== 'private') scheduleWechatMomentEngagement(post);
    store.posts.push(post);
    saveWechatMomentStore(store);
    window._wechatMomentDraftImages = [];
    window._wechatEditingMomentId = '';
    renderWechatMoments();
}

function editWechatMoment(id) {
    openWechatMomentTextComposer(id);
}

function shareWechatMomentPost(id) {
    const store = getWechatMomentStore();
    const post = store.posts.find(item => item.id === id);
    if (!post) return;
    const mediaText = (post.images || []).length ? `\n[${post.images.length} 个图片/视频]` : '';
    shareWechatText('朋友圈', `${post.userName || '我'} 的朋友圈：${post.text || '[图片朋友圈]'}${mediaText}`);
}

function replyWechatMomentComment(postId, commentId) {
    const store = getWechatMomentStore();
    const post = store.posts.find(item => item.id === postId);
    if (!post) return;
    const comments = Array.isArray(post.comments) ? post.comments : [];
    const target = comments.find(item => item.id === commentId) || comments[0];
    const value = prompt(target ? `回复 ${target.name || '好友'}` : '回复朋友圈', '');
    if (!value || !value.trim()) return;
    const profile = getUserProfile();
    comments.push({
        id: 'mc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: profile.name || '我',
        avatar: profile.avatar || DEFAULT_AVATAR,
        text: value.trim().slice(0, 240),
        replyTo: target?.name || '',
        user: true,
        createdAt: Date.now()
    });
    post.comments = comments;
    saveWechatMomentStore(store);
    renderWechatMoments();
}

function deleteWechatMoment(id) {
    if (!confirm('确定删除这条朋友圈吗？')) return;
    const store = getWechatMomentStore();
    store.posts = store.posts.filter(post => post.id !== id);
    saveWechatMomentStore(store);
    renderWechatMoments();
}

function parseWechatAiJsonPayload(content) {
    const text = String(content || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    if (!text) return null;
    try { return JSON.parse(text); } catch (_) {}
    const arrayStart = text.indexOf('[');
    const arrayEnd = text.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
        try { return JSON.parse(text.slice(arrayStart, arrayEnd + 1)); } catch (_) {}
    }
    const objectStart = text.indexOf('{');
    const objectEnd = text.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
        try { return JSON.parse(text.slice(objectStart, objectEnd + 1)); } catch (_) {}
    }
    return null;
}

function getWechatGeneratedGradient(seed = '') {
    const palettes = [
        ['#0f172a', '#38bdf8', '#f8fafc'],
        ['#111827', '#22c55e', '#facc15'],
        ['#2f1b45', '#e879f9', '#fef3c7'],
        ['#172554', '#f97316', '#f8fafc'],
        ['#064e3b', '#14b8a6', '#ecfeff'],
        ['#3b1d12', '#fb7185', '#fde68a'],
        ['#1e293b', '#a3e635', '#f8fafc']
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    const p = palettes[hash % palettes.length];
    return [
        `linear-gradient(135deg,${p[0]},${p[1]})`,
        `linear-gradient(135deg,${p[1]},${p[2]})`,
        `linear-gradient(135deg,${p[0]},${p[2]})`
    ];
}

function getWechatMediaFrameStyle(frame) {
    const value = String(frame || '').trim();
    if (/^(https?:|data:image)/i.test(value)) return `background-image:${getWechatCssUrl(value)}`;
    return `background:${wcEscapeHtml(value || getWechatGeneratedGradient('media')[0])}`;
}

function normalizeWechatChannelVideos(data) {
    const raw = Array.isArray(data) ? data : (data && (data.videos || data.items)) || [];
    return raw.slice(0, 4).map((item, index) => {
        const title = String(item.title || item.name || '').trim();
        const author = String(item.author || item.creator || 'AI 视频号').trim();
        const description = String(item.description || item.desc || item.copy || '').trim();
        const bullets = Array.isArray(item.bullets) ? item.bullets : (Array.isArray(item.danmaku) ? item.danmaku : []);
        const thumb = String(item.thumbnail || item.cover || item.image || '').trim();
        return {
            id: item.id || ('v_ai_' + Date.now() + '_' + index),
            author,
            title: title || `AI 生成视频 ${index + 1}`,
            description,
            frames: Array.isArray(item.frames) && item.frames.length ? item.frames.slice(0, 3) : (thumb ? [thumb, thumb, thumb] : getWechatGeneratedGradient(title + author + index)),
            bullets: bullets.map(b => String(b).trim()).filter(Boolean).slice(0, 5)
        };
    }).filter(video => video.title);
}

function getWechatVideoState() {
    const state = readWechatStore(WECHAT_VIDEO_STORAGE_KEY, { videos: [], likes: {}, favs: {}, comments: {}, generatedAt: 0, error: '' });
    state.videos = Array.isArray(state.videos) ? state.videos : [];
    state.likes = state.likes || {};
    state.favs = state.favs || {};
    state.comments = state.comments || {};
    state.error = state.error || '';
    return state;
}

function saveWechatVideoState(state) {
    writeWechatStore(WECHAT_VIDEO_STORAGE_KEY, state);
}

function openWechatChannels(force = true) {
    renderWechatChannels({ loading: true });
    if (force || !getWechatVideoState().videos.length) generateWechatChannelVideos();
    else renderWechatChannels();
}

function renderWechatChannels(status = {}) {
    const state = getWechatVideoState();
    const body = status.loading ? `
        <div class="wc-ai-loading"><i class="ri-sparkling-2-line"></i><span>正在生成本次视频号内容...</span></div>
    ` : state.error ? `
        <div class="wc-ai-loading error"><i class="ri-error-warning-line"></i><span>${wcEscapeHtml(state.error)}</span><button onclick="openWechatChannels(true)">重新生成</button></div>
    ` : !state.videos.length ? `
        <div class="wc-ai-loading"><i class="ri-movie-2-line"></i><span>点击右上角生成本次视频号内容</span></div>
    ` : `
        <div class="wc-channel-feed">
            ${state.videos.map(video => `
                <div class="wc-channel-card">
                    <div class="wc-channel-stage">
                        ${video.frames.map(bg => `<div class="wc-channel-frame" style="${getWechatMediaFrameStyle(bg)}"></div>`).join('')}
                        <div class="wc-channel-progress"></div>
                        <div class="wc-channel-danmaku">${(video.bullets || []).map((b, i) => `<span style="--i:${i}">${wcEscapeHtml(b)}</span>`).join('')}</div>
                    </div>
                    <div class="wc-channel-info"><strong>${wcEscapeHtml(video.author)}</strong><span>${wcEscapeHtml(video.title)}</span>${video.description ? `<em>${wcEscapeHtml(video.description)}</em>` : ''}</div>
                    <div class="wc-channel-actions">
                        <button class="${state.likes[video.id] ? 'active' : ''}" onclick="toggleWechatVideoLike('${video.id}')"><i class="ri-heart-3-line"></i>赞</button>
                        <button class="${state.favs[video.id] ? 'active' : ''}" onclick="toggleWechatVideoFav('${video.id}')"><i class="ri-star-line"></i>收藏</button>
                        <button onclick="commentWechatVideo('${video.id}')"><i class="ri-chat-3-line"></i>评论</button>
                        <button onclick="shareWechatText(${quoteWechatJsString('视频号')}, ${quoteWechatJsString('我转发了视频号：' + video.title)})"><i class="ri-share-forward-line"></i>转发</button>
                    </div>
                    ${(state.comments[video.id] || []).length ? `<div class="wc-channel-comments">${state.comments[video.id].map(c => `<div>${wcEscapeHtml(c)}</div>`).join('')}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
    openWechatFeatureScreen('视频号', `
        ${body}
    `, '<i class="ri-refresh-line" onclick="openWechatChannels(true)"></i>');
}

async function generateWechatChannelVideos() {
    const state = getWechatVideoState();
    state.error = '';
    saveWechatVideoState(state);
    const result = await callChatApi([
        { role: 'system', content: '你是微信视频号内容生成器。只输出 JSON 数组，不要解释。每条包含 author、title、description、bullets。bullets 是 3-5 条短弹幕。内容要像真实视频号刷到的，不要营销模板。' },
        { role: 'user', content: `生成 3 条彼此不同的视频号内容。本次随机种子：${Date.now()}。` }
    ]);
    const parsed = result.ok ? parseWechatAiJsonPayload(result.content) : null;
    const videos = parsed ? normalizeWechatChannelVideos(parsed) : [];
    if (!result.ok || !videos.length) {
        state.error = result.ok ? 'AI 返回格式无法解析，点右上角再生成一次。' : result.error;
        state.videos = [];
    } else {
        state.videos = videos;
        state.generatedAt = Date.now();
        state.error = '';
    }
    saveWechatVideoState(state);
    renderWechatChannels();
}

function toggleWechatVideoLike(id) {
    const state = getWechatVideoState();
    state.likes[id] = !state.likes[id];
    saveWechatVideoState(state);
    renderWechatChannels();
}

function toggleWechatVideoFav(id) {
    const state = getWechatVideoState();
    state.favs[id] = !state.favs[id];
    saveWechatVideoState(state);
    renderWechatChannels();
}

function commentWechatVideo(id) {
    const text = prompt('写一条评论');
    if (!text || !text.trim()) return;
    const state = getWechatVideoState();
    state.comments[id] = state.comments[id] || [];
    state.comments[id].push(text.trim());
    saveWechatVideoState(state);
    renderWechatChannels();
}

const WECHAT_LIVE_CATEGORIES = ['美妆', '电子产品', '穿搭', '家居', '美食', '游戏'];

function getWechatLiveState() {
    const state = readWechatStore(WECHAT_LIVE_STORAGE_KEY, { rooms: {}, error: '' });
    state.rooms = state.rooms || {};
    state.error = state.error || '';
    return state;
}

function saveWechatLiveState(state) {
    writeWechatStore(WECHAT_LIVE_STORAGE_KEY, state);
}

function normalizeWechatLiveRooms(data, category) {
    const raw = Array.isArray(data) ? data : (data && (data.rooms || data.items || data.lives)) || [];
    return raw.slice(0, 4).map((item, index) => {
        const title = String(item.title || item.name || '').trim();
        const host = String(item.host || item.anchor || item.author || 'AI 主播').trim();
        const lines = Array.isArray(item.lines) ? item.lines : (Array.isArray(item.chat) ? item.chat : []);
        const cover = String(item.cover || item.thumbnail || item.image || '').trim();
        return {
            id: item.id || ('live_ai_' + Date.now() + '_' + index),
            title: title || `${category}直播 ${index + 1}`,
            host,
            category,
            viewers: String(item.viewers || (1.1 + Math.random() * 3).toFixed(1) + '万人观看'),
            lines: lines.map(line => String(line).trim()).filter(Boolean).slice(0, 4),
            cover,
            gradient: getWechatGeneratedGradient(title + host + category)[0]
        };
    }).filter(room => room.title);
}

function openWechatLive(category = '美妆', force = true) {
    renderWechatLive(category, { loading: true });
    if (force || !(getWechatLiveState().rooms[category] || []).length) generateWechatLiveRooms(category);
    else renderWechatLive(category);
}

function renderWechatLive(category = '美妆', status = {}) {
    const state = getWechatLiveState();
    const rooms = state.rooms[category] || [];
    const body = status.loading ? `
        <div class="wc-ai-loading"><i class="ri-broadcast-line"></i><span>正在生成 ${wcEscapeHtml(category)} 直播间...</span></div>
    ` : state.error ? `
        <div class="wc-ai-loading error"><i class="ri-error-warning-line"></i><span>${wcEscapeHtml(state.error)}</span><button onclick="openWechatLive(${quoteWechatJsString(category)}, true)">重新生成</button></div>
    ` : !rooms.length ? `
        <div class="wc-ai-loading"><i class="ri-live-line"></i><span>点击右上角生成直播间</span></div>
    ` : `
        <div class="wc-live-grid">
            ${rooms.map(room => `
                <div class="wc-live-card">
                    <div class="wc-live-cover" style="${getWechatMediaFrameStyle(room.cover || room.gradient)}"><span>LIVE</span><strong>${wcEscapeHtml(room.title)}</strong></div>
                    <div class="wc-live-meta"><span>${wcEscapeHtml(room.host)} · ${wcEscapeHtml(room.category)}</span><b>${wcEscapeHtml(room.viewers)}</b></div>
                    <div class="wc-live-chat">${(room.lines || []).map(line => `<span>${wcEscapeHtml(line)}</span>`).join('')}</div>
                    <div class="wc-live-actions">
                        <button onclick="shareWechatText(${quoteWechatJsString('直播')}, ${quoteWechatJsString('我转发了直播间：' + room.title)})">转发</button>
                        <button onclick="openWechatShop(${quoteWechatJsString(category)})">逛同款</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    openWechatFeatureScreen('直播', `
        <div class="wc-live-tabs">${WECHAT_LIVE_CATEGORIES.map(c => `<button class="${c === category ? 'active' : ''}" onclick="openWechatLive(${quoteWechatJsString(c)}, true)">${c}</button>`).join('')}</div>
        ${body}
    `, `<i class="ri-refresh-line" onclick="openWechatLive(${quoteWechatJsString(category)}, true)"></i>`);
}

async function generateWechatLiveRooms(category) {
    const state = getWechatLiveState();
    state.error = '';
    saveWechatLiveState(state);
    const result = await callChatApi([
        { role: 'system', content: '你是微信直播间内容生成器。只输出 JSON 数组，不要解释。每条包含 title、host、viewers、lines。lines 是直播间内 2-4 条真实感短句，包含主播或观众发言。' },
        { role: 'user', content: `生成 3 个「${category}」区域直播间。本次随机种子：${Date.now()}。内容要像真实直播间，不要固定模板。` }
    ]);
    const parsed = result.ok ? parseWechatAiJsonPayload(result.content) : null;
    const rooms = parsed ? normalizeWechatLiveRooms(parsed, category) : [];
    if (!result.ok || !rooms.length) {
        state.error = result.ok ? 'AI 返回格式无法解析，点右上角再生成一次。' : result.error;
        state.rooms[category] = [];
    } else {
        state.rooms[category] = rooms;
        state.error = '';
    }
    saveWechatLiveState(state);
    renderWechatLive(category);
}

function getWechatShopProducts() {
    const store = getWechatShopStore();
    return store.custom;
}

function getWechatShopStore() {
    const store = readWechatStore(WECHAT_SHOP_STORAGE_KEY, { cart: [], custom: [], orders: [] });
    store.cart = Array.isArray(store.cart) ? store.cart : [];
    store.custom = Array.isArray(store.custom) ? store.custom : [];
    store.orders = Array.isArray(store.orders) ? store.orders : [];
    return store;
}

function saveWechatShopStore(store) {
    writeWechatStore(WECHAT_SHOP_STORAGE_KEY, store);
}

function openWechatShop(seed = '') {
    window._wechatShopKeyword = decodeURIComponent(seed || '');
    window._wechatShopTab = 'home';
    renderWechatShop('home', window._wechatShopKeyword);
}

function renderWechatShop(tabOrKeyword = 'home', keywordArg) {
    const tabs = ['home', 'cart', 'me'];
    const isTab = tabs.includes(tabOrKeyword);
    const tab = isTab ? tabOrKeyword : (window._wechatShopTab || 'home');
    const keyword = isTab ? (keywordArg ?? window._wechatShopKeyword ?? '') : String(tabOrKeyword || '');
    window._wechatShopTab = tab;
    window._wechatShopKeyword = keyword;
    const store = getWechatShopStore();
    const products = getWechatShopProducts().filter(p => !keyword || `${p.name}${p.tag}`.toLowerCase().includes(keyword.toLowerCase()));
    const total = store.cart.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const content = tab === 'cart'
        ? renderWechatShopCart(store, total)
        : (tab === 'me' ? renderWechatShopMe(store) : renderWechatShopHome(products, keyword));
    openWechatFeatureScreen('购物', `
        <div class="wc-shop-app">
            <div class="wc-shop-content">${content}</div>
            <div class="wc-shop-tabbar">
                <button class="${tab === 'home' ? 'active' : ''}" onclick="renderWechatShop('home')"><i class="ri-home-5-line"></i><span>首页</span></button>
                <button class="${tab === 'cart' ? 'active' : ''}" onclick="renderWechatShop('cart')"><i class="ri-shopping-cart-line"></i><span>购物车${store.cart.length ? `(${store.cart.length})` : ''}</span></button>
                <button class="${tab === 'me' ? 'active' : ''}" onclick="renderWechatShop('me')"><i class="ri-user-3-line"></i><span>我的</span></button>
            </div>
        </div>
    `, '<i class="ri-shopping-cart-line"></i>');
}

function renderWechatShopHome(products, keyword) {
    return `
        <div class="wc-shop-search"><i class="ri-search-line"></i><input value="${wcEscapeHtml(keyword)}" placeholder="搜索商品" oninput="renderWechatShop('home', this.value)"></div>
        <div class="wc-shop-ai-card">
            <input id="wc-shop-ai-brief" placeholder="让 AI 生成商品，例如：适合深夜学习的桌面小灯">
            <button onclick="generateWechatShopProduct()">AI 生成商品</button>
        </div>
        <div class="wc-shop-custom">
            <input id="wc-shop-custom-name" placeholder="商品标题">
            <input id="wc-shop-custom-price" type="number" min="0" placeholder="价格">
            <input id="wc-shop-custom-tag" placeholder="分类">
            <input id="wc-shop-custom-image" placeholder="图片 URL / 图床链接">
            <textarea id="wc-shop-custom-desc" placeholder="商品内容描述"></textarea>
            <button onclick="addWechatCustomProduct()">添加产品</button>
        </div>
        <div class="wc-shop-products">
            ${products.length ? products.map(p => `
                <div class="wc-shop-card">
                    <div class="wc-shop-cover" style="background:${p.gradient || 'linear-gradient(135deg,#f8fafc,#94a3b8)'}">${p.image ? `<img src="${p.image}">` : ''}</div>
                    <div class="wc-shop-name">${wcEscapeHtml(p.name)}</div>
                    <div class="wc-shop-tag">${wcEscapeHtml(p.tag || '自定义')}</div>
                    ${p.description ? `<div class="wc-shop-desc">${wcEscapeHtml(p.description)}</div>` : ''}
                    <div class="wc-shop-row"><strong>¥${Number(p.price || 0).toFixed(2)}</strong><button onclick="addWechatShopCart('${p.id}')">加入</button></div>
                    <button class="wc-shop-link" onclick="shareWechatText(${quoteWechatJsString('商品')}, ${quoteWechatJsString(`我转发了商品：${p.name}，价格 ¥${Number(p.price || 0).toFixed(2)}`)})">转发给好友</button>
                </div>
            `).join('') : '<div class="wc-discover-empty" style="grid-column:1/-1;">还没有商品，先手动添加或用 AI 生成</div>'}
        </div>
    `;
}

function renderWechatShopCart(store, total) {
    return `
        <div class="wc-shop-cart">
            <h4>购物车</h4>
            ${store.cart.length ? store.cart.map((item, i) => `<div class="wc-shop-cart-row"><span>${wcEscapeHtml(item.name)}</span><b>¥${Number(item.price || 0).toFixed(2)}</b><button onclick="removeWechatShopCart(${i})">删除</button></div>`).join('') : '<div class="wc-discover-empty">购物车为空</div>'}
            <div class="wc-shop-total">合计 ¥${total.toFixed(2)}</div>
            <textarea id="wc-shop-address" placeholder="填写收货地址"></textarea>
            <select id="wc-shop-payer">
                <option value="self">自己付款</option>
                ${(window.myCharacters || []).map(c => `<option value="${c.id}">让 ${wcEscapeHtml((c.chatConfig && c.chatConfig.nickname) || c.name)} 代付</option>`).join('')}
            </select>
            <button class="wc-shop-checkout" onclick="checkoutWechatShop()">结账</button>
        </div>
    `;
}

function renderWechatShopMe(store) {
    return `
        <div class="wc-shop-me-card">
            <strong>我的购物</strong>
            <span>订单 ${store.orders.length} · 商品 ${store.custom.length}</span>
        </div>
        <div class="wc-shop-cart">
            <h4>订单记录</h4>
            ${store.orders.length ? store.orders.slice().reverse().map(order => `
                <div class="wc-shop-order">
                    <strong>¥${Number(order.total || 0).toFixed(2)}</strong>
                    <span>${formatWechatRelativeTime(order.createdAt)} · ${wcEscapeHtml(order.payer === 'self' ? '自己付款' : '代付请求')}</span>
                    <em>${wcEscapeHtml((order.items || []).map(item => item.name).join('、'))}</em>
                </div>
            `).join('') : '<div class="wc-discover-empty">还没有订单</div>'}
        </div>
    `;
}

function addWechatShopCart(productId) {
    const product = getWechatShopProducts().find(p => p.id === productId);
    if (!product) return;
    const store = getWechatShopStore();
    store.cart.push({ id: product.id, name: product.name, price: product.price, tag: product.tag });
    saveWechatShopStore(store);
    renderWechatShop('home', document.querySelector('.wc-shop-search input')?.value || window._wechatShopKeyword || '');
}

function removeWechatShopCart(index) {
    const store = getWechatShopStore();
    store.cart.splice(index, 1);
    saveWechatShopStore(store);
    renderWechatShop('cart');
}

function addWechatCustomProduct() {
    const name = (document.getElementById('wc-shop-custom-name')?.value || '').trim();
    const price = Number(document.getElementById('wc-shop-custom-price')?.value || 0);
    const tag = (document.getElementById('wc-shop-custom-tag')?.value || '自定义').trim();
    const image = (document.getElementById('wc-shop-custom-image')?.value || '').trim();
    const description = (document.getElementById('wc-shop-custom-desc')?.value || '').trim();
    if (!name || price <= 0) return;
    const store = getWechatShopStore();
    store.custom.push({ id: 'cp_' + Date.now(), name, price, tag, image, description, gradient: getWechatGeneratedGradient(name + tag)[0] });
    saveWechatShopStore(store);
    renderWechatShop('home');
}

async function generateWechatShopProduct() {
    const briefEl = document.getElementById('wc-shop-ai-brief');
    const btn = document.querySelector('.wc-shop-ai-card button');
    const brief = (briefEl?.value || '').trim() || '适合微信购物页的真实感商品';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中';
    }
    const result = await callChatApi([
        { role: 'system', content: '你是电商商品策划。只输出 JSON 对象，不要解释。字段：name、tag、price、description、imagePrompt，可选 imageUrl。标题和内容要像淘宝商品但不要夸张营销。' },
        { role: 'user', content: `生成一个商品：${brief}。如果不能直接生成图片 URL，就写 imagePrompt。` }
    ]);
    const parsed = result.ok ? parseWechatAiJsonPayload(result.content) : null;
    if (!result.ok || !parsed) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'AI 生成商品';
        }
        alert(result.ok ? 'AI 返回格式无法解析，再试一次。' : result.error);
        return;
    }
    const product = Array.isArray(parsed) ? parsed[0] : parsed;
    const name = String(product.name || product.title || '').trim();
    if (!name) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'AI 生成商品';
        }
        alert('AI 没有返回商品标题，再试一次。');
        return;
    }
    const imagePrompt = String(product.imagePrompt || product.prompt || product.description || name).trim();
    let image = String(product.imageUrl || product.image || '').trim();
    if (!image && imagePrompt) {
        const imageResult = await callWechatImageGenerationApi(`电商商品主图，干净真实，白底或浅色场景，主体清晰：${imagePrompt}`);
        if (imageResult.ok) image = imageResult.url;
    }
    const store = getWechatShopStore();
    store.custom.unshift({
        id: 'cp_ai_' + Date.now(),
        name,
        tag: String(product.tag || product.category || 'AI生成').trim(),
        price: Number(product.price || 99),
        description: String(product.description || product.content || imagePrompt || '').trim(),
        image,
        gradient: getWechatGeneratedGradient(name + brief)[0]
    });
    saveWechatShopStore(store);
    renderWechatShop('home');
}

async function callWechatImageGenerationApi(prompt, options = {}) {
    const api = typeof getDefaultImageApi === 'function'
        ? getDefaultImageApi()
        : (typeof getDefaultApi === 'function' ? getDefaultApi() : null);
    if (!api || !api.baseUrl) return { ok: false, error: '未配置生图 API' };
    const baseUrl = api.baseUrl.replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (api.apiKey) headers.Authorization = `Bearer ${api.apiKey}`;
    const imageModel = String(api.imageModel || '').trim();
    if (!imageModel) {
        return { ok: false, error: '当前默认生图 API 没有选择生图模型。请在设置里测试 API 后从生图模型下拉选择，或单独添加一个生图 API。' };
    }
    const referenceImage = String(options.referenceImage || '').trim();
    const enhancedPrompt = [
        String(prompt || '').trim(),
        referenceImage ? '需要尽量保持参考图中的角色脸型、发型、气质和整体辨识度。' : ''
    ].filter(Boolean).join('\n');
    const buildBody = includeReference => {
        const body = {
            model: imageModel,
            prompt: enhancedPrompt,
            size: options.size || '1024x1024',
            response_format: 'b64_json'
        };
        if (includeReference && referenceImage) {
            body.image = referenceImage;
            body.reference_image = referenceImage;
            body.images = [referenceImage];
        }
        return body;
    };
    const parseImageResponse = async resp => {
        if (!resp.ok) return { ok: false, status: resp.status, error: await resp.text().catch(() => '图片生成失败') };
        const json = await resp.json();
        const first = json.data && json.data[0];
        if (first?.url) return { ok: true, url: first.url };
        if (first?.b64_json) return { ok: true, url: 'data:image/png;base64,' + first.b64_json };
        return { ok: false, error: '图片接口没有返回图片' };
    };
    try {
        const resp = await fetch(baseUrl + '/images/generations', {
            method: 'POST',
            headers,
            body: JSON.stringify(buildBody(!!referenceImage)),
            signal: AbortSignal.timeout(45000)
        });
        const result = await parseImageResponse(resp);
        if (!result.ok && referenceImage && result.status === 400) {
            const retry = await fetch(baseUrl + '/images/generations', {
                method: 'POST',
                headers,
                body: JSON.stringify(buildBody(false)),
                signal: AbortSignal.timeout(45000)
            });
            return parseImageResponse(retry);
        }
        return result;
    } catch (e) {
        return { ok: false, error: e.message || '图片生成失败' };
    }
}

function checkoutWechatShop() {
    const store = getWechatShopStore();
    if (!store.cart.length) return;
    const address = (document.getElementById('wc-shop-address')?.value || '').trim();
    if (!address) {
        alert('先填写收货地址');
        return;
    }
    const payer = document.getElementById('wc-shop-payer')?.value || 'self';
    const total = store.cart.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const summary = store.cart.map(item => `${item.name} ¥${Number(item.price || 0).toFixed(2)}`).join('；');
    const order = { id: 'ord_' + Date.now(), items: store.cart, address, total, payer, createdAt: Date.now() };
    store.orders.push(order);
    store.cart = [];
    saveWechatShopStore(store);
    if (payer === 'self') {
        alert('订单已提交，已选择自己付款。');
        renderWechatShop();
        return;
    }
    sendWechatTextToChar(payer, `我在购物里选好了这些：${summary}。合计 ¥${total.toFixed(2)}，地址：${address}。可以帮我代付吗？`);
}

function sendWechatTextToChar(charId, text) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    if (!char.history) char.history = [];
    char.history.push({ type: 'text', isMe: true, content: text, timestamp: createMessageTimestamp() });
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    saveCharactersToStorage();
    renderChatList();
    closeWechatFeatureScreen();
    switchWcTab('chat');
    openChat(char.id);
}

function shareWechatText(title, text) {
    const chars = window.myCharacters || [];
    if (!chars.length) {
        alert('还没有可转发的联系人');
        return;
    }
    let modal = document.getElementById('wc-share-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-share-modal';
        modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
        modal.innerHTML = `
            <div class="wc-compose-card wc-share-card">
                <div class="wc-compose-header">
                    <div class="wc-compose-title"><i class="ri-share-forward-line"></i><span>选择联系人</span></div>
                    <i class="ri-close-line" onclick="closeWechatShareModal()"></i>
                </div>
                <div class="wc-share-list" id="wc-share-list"></div>
            </div>
        `;
        getWechatModalRoot().appendChild(modal);
    }
    modal.dataset.shareTitle = title;
    modal.dataset.shareText = text;
    document.getElementById('wc-share-list').innerHTML = chars.map(char => `
        <div class="wc-share-contact" onclick="confirmWechatShare('${char.id}')">
            <img src="${char.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
            <span>${wcEscapeHtml((char.chatConfig && char.chatConfig.nickname) || char.name || '未命名')}</span>
        </div>
    `).join('');
    modal.classList.remove('hidden');
}

function closeWechatShareModal() {
    const modal = document.getElementById('wc-share-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmWechatShare(charId) {
    const modal = document.getElementById('wc-share-modal');
    if (!modal) return;
    const title = modal.dataset.shareTitle || '';
    const text = modal.dataset.shareText || '';
    closeWechatShareModal();
    sendWechatTextToChar(charId, `我转发了${title}给你：${text}`);
}

// --- 💬 聊天设置面板 ---

const USER_PROFILE_KEY = 'my_user_profile';

function getUserProfile() {
    try {
        const raw = localStorage.getItem(USER_PROFILE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { avatar: '', name: '我', bio: '', wechatId: '' };
}

function saveUserProfile(profile) {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
}

// CSS 气泡预览（实时）
function previewBubbleCss(cssText) {
    // 移除旧的预览样式
    let previewStyle = document.getElementById('wcs-css-preview-style');
    if (!previewStyle) {
        previewStyle = document.createElement('style');
        previewStyle.id = 'wcs-css-preview-style';
        document.head.appendChild(previewStyle);
    }
    // 把 .msg-bubble 替换成 .wcs-preview-bubble 用于预览
    let previewCss = cssText
        .replace(/\.msg-bubble\.green/g, '.wcs-preview-bubble.user')
        .replace(/\.msg-bubble/g, '.wcs-preview-bubble');
    previewStyle.textContent = previewCss;
}

function setWechatTimeModeControls(mode) {
    const safeMode = mode === 'virtual' ? 'virtual' : 'real';
    document.getElementById('wcs-time-real')?.classList.toggle('active', safeMode === 'real');
    document.getElementById('wcs-time-virtual')?.classList.toggle('active', safeMode === 'virtual');
    document.getElementById('wcs-time-virtual-row')?.classList.toggle('hidden', safeMode !== 'virtual');
    refreshWechatTimePreview();
}

function getWechatSettingsTimeMode() {
    return document.getElementById('wcs-time-virtual')?.classList.contains('active') ? 'virtual' : 'real';
}

function toggleWechatTimeMode(mode) {
    const safeMode = mode === 'virtual' ? 'virtual' : 'real';
    const virtualInput = document.getElementById('wcs-virtual-time');
    if (safeMode === 'virtual' && virtualInput && !virtualInput.value) {
        virtualInput.value = toWechatDatetimeLocalValue(new Date());
    }
    setWechatTimeModeControls(safeMode);
}

function refreshWechatTimePreview() {
    const preview = document.getElementById('wcs-time-preview');
    if (!preview) return;
    const mode = getWechatSettingsTimeMode();
    const value = document.getElementById('wcs-virtual-time')?.value;
    preview.textContent = mode === 'virtual'
        ? `AI 会认为现在是：${formatWechatDateTimeForPrompt(value || new Date())}`
        : `AI 会跟随真实时间：${formatWechatDateTimeForPrompt(new Date())}`;
}

function setWechatVirtualTimeNow() {
    const input = document.getElementById('wcs-virtual-time');
    if (input) input.value = toWechatDatetimeLocalValue(new Date());
    setWechatTimeModeControls('virtual');
}

function renderWechatMomentCoverGallery(char) {
    const gallery = document.getElementById('wcs-moment-cover-list');
    if (!gallery || !char) return;
    const covers = ((char.chatConfig && char.chatConfig.momentCovers) || []).filter(Boolean);
    gallery.innerHTML = covers.length ? covers.map((url, index) => `
        <div class="wcs-cover-thumb">
            <img src="${url}" onerror="this.style.opacity='0.35'">
            <button type="button" onclick="removeWechatMomentCover(${index})"><i class="ri-close-line"></i></button>
        </div>
    `).join('') : '<span class="wcs-cover-empty">还没有背景图</span>';
}

function addWechatMomentCovers(input) {
    const char = getCurrentChatChar();
    if (!char || !input.files || !input.files.length) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.momentCovers = Array.isArray(char.chatConfig.momentCovers) ? char.chatConfig.momentCovers : [];
    const files = Array.from(input.files).slice(0, 8);
    let pending = files.length;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxW = 720;
                const scale = Math.min(maxW / img.width, 1);
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                char.chatConfig.momentCovers.push(canvas.toDataURL('image/jpeg', 0.72));
                pending -= 1;
                if (pending === 0) {
                    saveCharactersToStorage();
                    renderWechatMomentCoverGallery(char);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function removeWechatMomentCover(index) {
    const char = getCurrentChatChar();
    if (!char || !char.chatConfig || !Array.isArray(char.chatConfig.momentCovers)) return;
    char.chatConfig.momentCovers.splice(index, 1);
    saveCharactersToStorage();
    renderWechatMomentCoverGallery(char);
}

function renderWechatAiMomentsEditor(char) {
    const list = document.getElementById('wcs-ai-moment-list');
    if (!list || !char) return;
    const moments = Array.isArray(char.chatConfig && char.chatConfig.aiMoments)
        ? char.chatConfig.aiMoments.filter(item => item && (item.source === 'ai_moment' || item.source === 'manual_moment'))
        : [];
    list.innerHTML = moments.length ? moments.slice().reverse().map(item => `
        <div class="wcs-ai-moment-item">
            <span>${wcEscapeHtml(item.text || '')}</span>
            <button type="button" onclick="deleteWechatAiMoment(${quoteWechatJsString(item.id)})"><i class="ri-close-line"></i></button>
        </div>
    `).join('') : '<div class="wcs-ai-moment-empty">还没有自定义动态</div>';
}

function addWechatAiMomentFromSettings() {
    const char = getCurrentChatChar();
    const input = document.getElementById('wcs-ai-moment-text');
    const text = (input && input.value || '').trim();
    if (!char || !text) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.aiMoments = Array.isArray(char.chatConfig.aiMoments) ? char.chatConfig.aiMoments : [];
    char.chatConfig.aiMoments.push({
        id: 'aim_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        text,
        source: 'manual_moment',
        createdAt: Date.now()
    });
    if (input) input.value = '';
    saveCharactersToStorage();
    renderWechatAiMomentsEditor(char);
}

async function generateWechatAiMoment() {
    const char = getCurrentChatChar();
    const input = document.getElementById('wcs-ai-moment-text');
    if (!char || !input) return;
    input.value = 'AI 正在写朋友圈...';
    char.chatConfig = char.chatConfig || {};
    const coverHint = Array.isArray(char.chatConfig.momentCovers) && char.chatConfig.momentCovers.length
        ? `用户已为你设置 ${char.chatConfig.momentCovers.length} 张朋友圈封面，你能看到并知道这是你的朋友圈背景。`
        : '用户还没有为你设置朋友圈封面。';
    const result = await callChatApi([
        { role: 'system', content: `你是「${char.name}」。请以你自己的口吻写一条微信朋友圈动态，28字以内，像真实朋友圈，不要解释。${coverHint}` },
        { role: 'user', content: `角色设定：\n${String(char.description || '').slice(0, 4000)}\n\n写一条你现在会发的朋友圈。` }
    ]);
    input.value = result.ok
        ? String(result.content || '').replace(/\|\|\|/g, ' ').replace(/<[^>]+>/g, '').replace(/["“”]/g, '').trim().slice(0, 80)
        : '';
}

function deleteWechatAiMoment(id) {
    const char = getCurrentChatChar();
    if (!char || !char.chatConfig || !Array.isArray(char.chatConfig.aiMoments)) return;
    char.chatConfig.aiMoments = char.chatConfig.aiMoments.filter(item => item.id !== id);
    saveCharactersToStorage();
    renderWechatAiMomentsEditor(char);
}

async function generateWechatSignature() {
    const char = getCurrentChatChar();
    const input = document.getElementById('wcs-char-signature');
    if (!char || !input) return;
    const oldValue = input.value;
    input.value = '正在生成...';
    const result = await callChatApi([
        { role: 'system', content: `你是「${char.name}」。给自己的微信资料写一句自然的个性签名，16字以内。只输出签名，不要解释。` },
        { role: 'user', content: '写一句你的微信个性签名。' }
    ]);
    input.value = result.ok
        ? String(result.content || '').replace(/\|\|\|/g, ' ').replace(/["“”]/g, '').trim().slice(0, 32)
        : oldValue;
}

function openChatSettings() {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    document.querySelector('.wc-float-back').style.display = 'none';
    document.querySelector('.wc-float-more').style.display = 'none';
    document.getElementById('wc-floating-avatar').style.display = 'none';

    const config = char.chatConfig || {};
    const profile = getUserProfile();

    // 填充外观设置
    document.getElementById('wcs-bg-img-hint').textContent = config.chatBgImage ? '已设置' : '未设置';

    const fontSize = config.fontSize || 15;
    document.getElementById('wcs-font-size').value = fontSize;
    document.getElementById('wcs-font-val').textContent = fontSize + 'px';

    // CSS 编辑器
    const cssEl = document.getElementById('wcs-custom-css');
    if (cssEl) {
        cssEl.value = config.customCss || '';
        previewBubbleCss(config.customCss || '');
        renderBubblePresetDropdown(config.customCss || '');
    }

    // 用户资料（全局）
    const userAvatarEl = document.getElementById('wcs-user-avatar');
    if (profile.avatar) userAvatarEl.src = profile.avatar;
    else userAvatarEl.src = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 200 200%27%3E%3Cdefs%3E%3ClinearGradient id=%27bg%27 x1=%270%27 y1=%270%27 x2=%271%27 y2=%271%27%3E%3Cstop offset=%270%25%27 stop-color=%27%23f8c8dc%27/%3E%3Cstop offset=%27100%25%27 stop-color=%27%23d4a5f5%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%27200%27 height=%27200%27 rx=%27100%27 fill=%27url(%23bg)%27/%3E%3Ccircle cx=%27100%27 cy=%2780%27 r=%2735%27 fill=%27%23fff%27 opacity=%270.9%27/%3E%3Cellipse cx=%27100%27 cy=%27155%27 rx=%2750%27 ry=%2735%27 fill=%27%23fff%27 opacity=%270.9%27/%3E%3Ccircle cx=%2788%27 cy=%2775%27 r=%274%27 fill=%27%23555%27/%3E%3Ccircle cx=%27112%27 cy=%2775%27 r=%274%27 fill=%27%23555%27/%3E%3Cpath d=%27M92 90 Q100 98 108 90%27 stroke=%27%23e88%27 stroke-width=%272.5%27 fill=%27none%27 stroke-linecap=%27round%27/%3E%3C/svg%3E';
    document.getElementById('wcs-user-name').value = profile.name || '我';
    document.getElementById('wcs-user-bio').value = profile.bio || '';

    // 角色资料
    document.getElementById('wcs-char-avatar').src = char.avatar || '';
    document.getElementById('wcs-char-name').textContent = char.name;
    const descText = char.description || '';
    document.getElementById('wcs-char-desc').value = descText;
    document.getElementById('wcs-char-bio-preview').textContent = descText ? descText.slice(0, 50) + (descText.length > 50 ? '...' : '') : '无简介';
    updateWechatSettingsImagePreview('wcs-portrait-ref-preview', config.imageReference || '', '未设置参考图');

    // 称呼 & 备注
    document.getElementById('wcs-user-title').value = config.userTitle || '我';
    document.getElementById('wcs-char-nickname').value = config.nickname || '';
    const memoryConfig = getWechatMemoryConfig(char);
    const segmentInput = document.getElementById('wcs-memory-segment');
    const longInput = document.getElementById('wcs-memory-long');
    const keepInput = document.getElementById('wcs-memory-keep');
    if (segmentInput) segmentInput.value = memoryConfig.segmentLimit;
    if (longInput) longInput.value = memoryConfig.longTermLimit;
    if (keepInput) keepInput.value = memoryConfig.keepRecent;
    const signatureInput = document.getElementById('wcs-char-signature');
    if (signatureInput) signatureInput.value = config.signature || '';
    const timeMode = config.timeMode === 'virtual' ? 'virtual' : 'real';
    const virtualInput = document.getElementById('wcs-virtual-time');
    if (virtualInput) virtualInput.value = toWechatDatetimeLocalValue(config.virtualTime || new Date());
    setWechatTimeModeControls(timeMode);
    updateWechatSettingsImagePreview('wcs-video-bg-preview', config.videoCallBg || '', '未设置视频通话背景');
    const videoBgHint = document.getElementById('wcs-video-bg-hint');
    if (videoBgHint) videoBgHint.textContent = config.videoCallBg ? '已设置视频通话背景' : '上传视频通话背景';
    const realCamera = document.getElementById('wcs-video-real-camera');
    if (realCamera) realCamera.checked = !!config.videoCallUseCamera;

    // 头像集
    renderAvatarGallery(char);
    renderWechatMomentCoverGallery(char);
    renderWechatAiMomentsEditor(char);

    // 滑入
    const panel = document.getElementById('wc-chat-settings-panel');
    panel.style.display = 'flex';
    setTimeout(() => panel.classList.add('active'), 10);
}

function closeChatSettings() {
    const panel = document.getElementById('wc-chat-settings-panel');
    panel.classList.remove('active');
    setTimeout(() => panel.style.display = 'none', 300);

    const backEl = document.querySelector('.wc-float-back');
    const moreEl = document.querySelector('.wc-float-more');
    const avatarEl = document.getElementById('wc-floating-avatar');
    if (backEl) backEl.style.display = '';
    if (moreEl) moreEl.style.display = '';
    if (avatarEl) avatarEl.style.display = '';
}

function uploadChatBgImage(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        // 压缩背景图
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxW = 400;
            const scale = Math.min(maxW / img.width, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            window._tempChatBgImage = canvas.toDataURL('image/jpeg', 0.6);
            document.getElementById('wcs-bg-img-hint').textContent = '已选择';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
}

function uploadUserAvatar(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = 200; canvas.height = 200;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 200, 200);
            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            document.getElementById('wcs-user-avatar').src = compressed;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
}

function uploadCharAvatar(input) {
    if (!input.files || !input.files[0]) return;
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = 200; canvas.height = 200;
            canvas.getContext('2d').drawImage(img, 0, 0, 200, 200);
            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            char.avatar = compressed;
            document.getElementById('wcs-char-avatar').src = compressed;
            saveCharactersToStorage();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
}

function compressWechatSettingsImage(file, maxWidth = 720, quality = 0.72) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
        reader.onload = function(e) {
            const img = new Image();
            img.onerror = () => reject(new Error('图片加载失败'));
            img.onload = function() {
                const scale = Math.min(maxWidth / img.width, 1);
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function updateWechatSettingsImagePreview(id, src, emptyText) {
    const img = document.getElementById(id);
    if (!img) return;
    const placeholder = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="36" fill="#eef2f7"/><path d="M48 98l22-24 17 16 12-12 25 25" fill="none" stroke="#9aa8ba" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="56" r="12" fill="#c8d1df"/></svg>');
    img.src = src || placeholder;
    img.classList.toggle('empty', !src);
    if (!src && emptyText) img.alt = emptyText;
}

async function uploadCharPortraitReference(input) {
    if (!input.files || !input.files[0]) return;
    const char = getCurrentChatChar();
    if (!char) return;
    try {
        const compressed = await compressWechatSettingsImage(input.files[0], 640, 0.76);
        char.chatConfig = char.chatConfig || {};
        char.chatConfig.imageReference = compressed;
        saveCharactersToStorage();
        updateWechatSettingsImagePreview('wcs-portrait-ref-preview', compressed, '未设置参考图');
    } finally {
        input.value = '';
    }
}

function clearCharPortraitReference() {
    const char = getCurrentChatChar();
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.imageReference = '';
    saveCharactersToStorage();
    updateWechatSettingsImagePreview('wcs-portrait-ref-preview', '', '未设置参考图');
}

async function uploadCharVideoCallBg(input) {
    if (!input.files || !input.files[0]) return;
    const char = getCurrentChatChar();
    if (!char) return;
    try {
        const compressed = await compressWechatSettingsImage(input.files[0], 900, 0.68);
        char.chatConfig = char.chatConfig || {};
        char.chatConfig.videoCallBg = compressed;
        saveCharactersToStorage();
        updateWechatSettingsImagePreview('wcs-video-bg-preview', compressed, '未设置视频通话背景');
        const hint = document.getElementById('wcs-video-bg-hint');
        if (hint) hint.textContent = '已设置视频通话背景';
    } finally {
        input.value = '';
    }
}

function clearCharVideoCallBg() {
    const char = getCurrentChatChar();
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.videoCallBg = '';
    saveCharactersToStorage();
    updateWechatSettingsImagePreview('wcs-video-bg-preview', '', '未设置视频通话背景');
    const hint = document.getElementById('wcs-video-bg-hint');
    if (hint) hint.textContent = '上传视频通话背景';
}

// --- 角色头像集 ---
function renderAvatarGallery(char) {
    const gallery = document.getElementById('wcs-avatar-gallery');
    if (!gallery) return;
    const avatars = char.avatarGallery || [];
    if (char.avatar && !avatars.includes(char.avatar)) avatars.unshift(char.avatar);
    gallery.innerHTML = avatars.map((url, i) => `
        <img class="wcs-avatar-gallery-item ${url === char.avatar ? 'active' : ''}"
             src="${url}" onclick="selectCharAvatar(${i})"
             oncontextmenu="event.preventDefault();removeGalleryAvatar(${i})">
    `).join('') || '<span style="font-size:12px;color:#bbb;">暂无头像</span>';
}

function selectCharAvatar(idx) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    const avatars = char.avatarGallery || [];
    if (char.avatar && !avatars.includes(char.avatar)) avatars.unshift(char.avatar);
    if (avatars[idx]) {
        char.avatar = avatars[idx];
        document.getElementById('wcs-char-avatar').src = avatars[idx];
        saveCharactersToStorage();
        renderAvatarGallery(char);
    }
}

function removeGalleryAvatar(idx) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.avatarGallery) return;
    char.avatarGallery.splice(idx, 1);
    saveCharactersToStorage();
    renderAvatarGallery(char);
}

function addCharAvatarToGallery(input) {
    if (!input.files || !input.files[0]) return;
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = 200; canvas.height = 200;
            canvas.getContext('2d').drawImage(img, 0, 0, 200, 200);
            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            if (!char.avatarGallery) char.avatarGallery = [];
            char.avatarGallery.push(compressed);
            saveCharactersToStorage();
            renderAvatarGallery(char);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
}

function saveChatSettings() {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    // 保存聊天配置到角色
    const prevConfig = char.chatConfig || {};
    char.chatConfig = {
        chatBg: prevConfig.chatBg || '#ededed',
        chatBgImage: window._tempChatBgImage || prevConfig.chatBgImage || '',
        bubbleAi: prevConfig.bubbleAi || '#ffffff',
        bubbleUser: prevConfig.bubbleUser || '#95ec69',
        fontSize: parseInt(document.getElementById('wcs-font-size').value) || 15,
        userTitle: document.getElementById('wcs-user-title').value.trim() || '我',
        nickname: document.getElementById('wcs-char-nickname').value.trim() || '',
        timeMode: getWechatSettingsTimeMode(),
        virtualTime: document.getElementById('wcs-virtual-time')?.value || prevConfig.virtualTime || '',
        memorySegmentLimit: normalizeWechatMemoryNumber(document.getElementById('wcs-memory-segment')?.value, prevConfig.memorySegmentLimit || WECHAT_MEMORY_DEFAULTS.segmentLimit, 3, 50),
        memoryLongTermLimit: normalizeWechatMemoryNumber(document.getElementById('wcs-memory-long')?.value, prevConfig.memoryLongTermLimit || WECHAT_MEMORY_DEFAULTS.longTermLimit, 3, 50),
        memoryKeepRecent: normalizeWechatMemoryNumber(document.getElementById('wcs-memory-keep')?.value, prevConfig.memoryKeepRecent || WECHAT_MEMORY_DEFAULTS.keepRecent, 1, 50),
        signature: document.getElementById('wcs-char-signature')?.value.trim() || prevConfig.signature || '',
        imageReference: prevConfig.imageReference || '',
        videoCallBg: prevConfig.videoCallBg || '',
        videoCallUseCamera: !!document.getElementById('wcs-video-real-camera')?.checked,
        momentCovers: Array.isArray(prevConfig.momentCovers) ? prevConfig.momentCovers : [],
        contactProfile: prevConfig.contactProfile || null,
        contactProfileError: prevConfig.contactProfileError || '',
        profileBio: prevConfig.profileBio || '',
        blacklisted: !!prevConfig.blacklisted,
        friendRequestReason: prevConfig.friendRequestReason || '',
        friendRequestAt: prevConfig.friendRequestAt || 0,
        aiMoments: Array.isArray(prevConfig.aiMoments) ? prevConfig.aiMoments : [],
        customCss: (document.getElementById('wcs-custom-css') || {}).value || ''
    };
    window._tempChatBgImage = null;

    // 保存角色描述
    char.description = document.getElementById('wcs-char-desc').value;

    // 保存用户资料（全局）
    const profile = {
        avatar: document.getElementById('wcs-user-avatar').src || '',
        name: document.getElementById('wcs-user-name').value.trim() || '我',
        bio: document.getElementById('wcs-user-bio').value.trim(),
        wechatId: getUserProfile().wechatId || '',
        momentCover: getUserProfile().momentCover || ''
    };
    saveUserProfile(profile);

    const memoryStore = getWechatMemoryStore();
    const memoryBucket = getWechatMemoryBucket(memoryStore, char.id);
    promoteWechatMemoryBucket(memoryBucket, char);
    saveWechatMemoryStore(memoryStore);

    // 应用配置到当前聊天
    applyChatConfig(char);

    // 保存到 localStorage
    saveCharactersToStorage();

    closeChatSettings();
}

function applyChatConfig(char) {
    const config = char.chatConfig || {};
    const contentEl = document.getElementById('chat-room-content');
    if (!contentEl) return;

    // 背景
    if (config.chatBgImage) {
        contentEl.style.backgroundImage = `url(${config.chatBgImage})`;
        contentEl.style.backgroundSize = 'cover';
        contentEl.style.backgroundPosition = 'center';
        contentEl.style.backgroundColor = '';
    } else {
        contentEl.style.backgroundImage = '';
        contentEl.style.backgroundColor = config.chatBg || '';
    }

    // 气泡颜色 + 字体大小（通过 CSS 变量注入）
    const room = document.getElementById('wechat-chat-room');
    if (room) {
        room.style.setProperty('--bubble-ai', config.bubbleAi || '#ffffff');
        room.style.setProperty('--bubble-user', config.bubbleUser || '#95ec69');
        room.style.setProperty('--chat-font-size', (config.fontSize || 15) + 'px');
    }

    // 自定义气泡 CSS
    let customStyle = document.getElementById('chat-custom-css');
    if (config.customCss) {
        if (!customStyle) {
            customStyle = document.createElement('style');
            customStyle.id = 'chat-custom-css';
            document.head.appendChild(customStyle);
        }
        customStyle.textContent = config.customCss;
    } else if (customStyle) {
        customStyle.remove();
    }

    // 清除预览样式
    const previewStyle = document.getElementById('wcs-css-preview-style');
    if (previewStyle) previewStyle.remove();

    requestAnimationFrame(() => applyWechatBubbleMetaContrast(contentEl));
}

// ========== 图片发送 ==========

function triggerCamera() {
    document.getElementById('wc-camera-input').click();
    closeChatToolbar();
}

function triggerImagePick() {
    document.getElementById('wc-image-input').click();
    closeChatToolbar();
}

function handleCameraCapture(input) {
    if (!input.files || !input.files[0]) return;
    processAndSendImage(input.files[0]);
    input.value = '';
}

function handleImagePick(input) {
    if (!input.files || !input.files[0]) return;
    processAndSendImage(input.files[0]);
    input.value = '';
}

function processAndSendImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxDim = 400;
            let w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
                const scale = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            sendImageMessage(compressed);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function sendImageMessage(imageUrl) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    const userMsg = { type: 'image', isMe: true, content: imageUrl, description: '[用户发送了一张图片]', timestamp: createMessageTimestamp() };
    if (!char.history) char.history = [];
    char.history.push(userMsg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);

    refreshChatView(char);
    saveCharactersToStorage();
    renderChatList();
}

// ========== 微信模拟消息：转账 / 红包 / 语音 / 通话 ==========

const WECHAT_COMPOSER_CONFIG = {
    voice: {
        title: '发送语音',
        icon: 'ri-mic-line',
        primary: '发送语音'
    },
    transfer: {
        title: '转账',
        icon: 'ri-money-cny-circle-line',
        primary: '确认转账'
    },
    redpacket: {
        title: '发送红包',
        icon: 'ri-red-packet-line',
        primary: '发送红包'
    },
    videoCall: {
        title: '视频电话',
        icon: 'ri-video-chat-line',
        primary: '生成视频电话记录'
    },
    voiceCall: {
        title: '语音电话',
        icon: 'ri-phone-line',
        primary: '生成语音电话记录'
    }
};

function getCurrentChatChar() {
    const charId = window.currentChatCharId;
    if (!charId) return null;
    return window.myCharacters.find(c => c.id === charId) || null;
}

function appendWechatMessage(msg) {
    const char = getCurrentChatChar();
    if (!char) return;
    if (!char.history) char.history = [];
    ensureMessageTimestamp(msg);
    syncWechatMessageDescription(msg);
    char.history.push(msg);
    if (msg.isMe && typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);

    refreshChatView(char);
    saveCharactersToStorage();
    renderChatList();
}

function getWechatModalRoot() {
    return document.querySelector('.phone-container') || document.body;
}

function getWechatCharDisplayName(char) {
    return (char && char.chatConfig && char.chatConfig.nickname) || (char && char.name) || '对方';
}

function stripWechatPromptText(value, maxLength = 360) {
    const text = cleanWechatVisibleContent(value)
        .replace(/<[^>]+>/g, '')
        .replace(/\|\|\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

function formatWechatSnapshotTime(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return `${padWechatDatePart(safeDate.getHours())}:${padWechatDatePart(safeDate.getMinutes())}`;
}

function getWechatStatusSerial(char) {
    const source = String((char && char.id) || (char && char.name) || 'wechat-status');
    const hash = source.split('').reduce((sum, ch) => ((sum * 31) + ch.charCodeAt(0)) >>> 0, 17);
    return `#${String(hash % 1000000).padStart(6, '0')}`;
}

function isWechatStatusPlaceholderValue(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return true;
    return [
        /^API\s*未返回$/i,
        /^等待.*生成/,
        /^状态.*生成/,
        /^生成失败/,
        /未.{0,4}描写/,
        /固定占位/,
        /模板化省略/
    ].some(pattern => pattern.test(text));
}

function getWechatStatusFieldDisplay(snapshot, item, isLoading, statusError) {
    if (isLoading) return '状态生成中';
    if (snapshot && snapshot.fields) {
        const value = snapshot.fields[item.key];
        if (!isWechatStatusPlaceholderValue(value)) return value;
        return '等待下一次状态生成';
    }
    return statusError ? '生成失败，等待下次状态生成' : '等待 AI 生成';
}

function buildWechatPreviousAiStatusPrompt(char) {
    const snapshot = char && char.chatConfig && char.chatConfig.aiStatusSnapshot;
    if (!snapshot || !snapshot.fields) return '';
    const useful = {};
    WECHAT_AI_STATUS_FIELDS.forEach(item => {
        const value = snapshot.fields[item.key];
        if (!isWechatStatusPlaceholderValue(value)) useful[item.key] = value;
    });
    return Object.keys(useful).length ? JSON.stringify(useful, null, 2) : '';
}

function buildWechatWorldBookPrompt(char, limit = 6) {
    const entries = Array.isArray(char && char.worldBook) ? char.worldBook : [];
    const enabled = entries
        .filter(entry => entry && entry.enabled !== false)
        .slice(0, limit)
        .map(entry => {
            const title = entry.name || entry.title || entry.key || '世界书';
            const content = entry.content || entry.text || entry.comment || '';
            return stripWechatPromptText(`${title}：${content}`, 420);
        })
        .filter(Boolean);
    return enabled.length ? `【世界书】\n${enabled.join('\n')}` : '';
}

function getWechatMessagePromptContent(msg) {
    if (!msg) return '';
    if (msg.type === 'image') return msg.description || '[图片]';
    if (msg.type === 'sticker') return `[表情] ${msg.stickerName || msg.name || ''}`;
    if (isWechatSpecialMessage(msg.type)) return msg.description || msg.content || '[微信特殊消息]';
    if (msg.type === 'system_notice') return `[系统提示] ${msg.content || ''}`;
    return msg.content || msg.dialogue || msg.description || '';
}

function buildWechatRecentHistoryForPrompt(char, limit = 12) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const userName = ((typeof getUserProfile === 'function' ? getUserProfile() : {}) || {}).name || '用户';
    const charName = getWechatCharDisplayName(char);
    const lines = history.slice(-limit).map(msg => {
        const role = msg.isMe ? userName : charName;
        const content = stripWechatPromptText(getWechatMessagePromptContent(msg), 220);
        return content ? `${role}: ${content}` : '';
    }).filter(Boolean);
    return lines.length ? lines.join('\n') : '暂无聊天记录。';
}

function parseWechatJsonObject(text) {
    const source = String(text || '').trim();
    if (!source) return null;
    const cleaned = source.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (_) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch (e) {
            return null;
        }
    }
}

function getWechatAiStatusFallback(char, reason = 'fallback') {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const userProfile = (typeof getUserProfile === 'function') ? getUserProfile() : { name: '用户' };
    const userName = userProfile.name || '用户';
    const charName = getWechatCharDisplayName(char);
    const lastAi = history.slice().reverse().find(msg => msg && !msg.isMe && msg.type !== 'system_notice');
    const lastUser = history.slice().reverse().find(msg => msg && msg.isMe);
    const lastAiText = stripWechatPromptText(getWechatMessagePromptContent(lastAi), 56);
    const lastUserText = stripWechatPromptText(getWechatMessagePromptContent(lastUser), 56);

    return {
        updatedAt: Date.now(),
        reason,
        generatedBy: 'local',
        fields: {
            innerMonologue: lastAiText ? `还停在刚才那句「${lastAiText}」的情绪里。` : `正在等${userName}先开口。`,
            miniDiary: lastUserText ? `想回头再和${userName}说清楚「${lastUserText}」这件事。` : `把和${userName}的聊天窗口留在最前面。`,
            thoughts: `在判断下一句话该不该更靠近一点。`,
            outfit: '沿用当前角色设定，聊天里没有新的服饰变化。',
            posture: '靠近手机，停在刚回复后的姿势。',
            action: '看着聊天窗口，等下一条消息。',
            gaze: `目光落在${userName}的聊天框上。`,
            penis: ''
        }
    };
}

function normalizeWechatAiStatusSnapshot(raw, char, reason = 'api') {
    if (!raw || typeof raw !== 'object') return null;
    const data = raw;
    const fieldsSource = data.fields && typeof data.fields === 'object' ? data.fields : data;
    const aliases = {
        innerMonologue: ['innerMonologue', 'inner_monologue', '内心独白', '内心声音'],
        miniDiary: ['miniDiary', 'mini_diary', '小日记'],
        thoughts: ['thoughts', 'thinking', '想法'],
        outfit: ['outfit', 'clothing', '服饰', '穿着'],
        posture: ['posture', 'pose', '姿势'],
        action: ['action', 'movement', '动作'],
        gaze: ['gaze', 'eyes', '目光', '视线'],
        penis: ['penis', 'Penis', '阴茎']
    };
    const fields = {};
    WECHAT_AI_STATUS_FIELDS.forEach(item => {
        const keys = aliases[item.key] || [item.key, item.label];
        const value = keys.map(key => fieldsSource[key]).find(v => v != null && String(v).trim());
        fields[item.key] = stripWechatPromptText(value || 'API 未返回', 180);
    });
    return {
        updatedAt: Date.now(),
        reason,
        generatedBy: 'api',
        fields
    };
}

function getWechatAiStatusSnapshot(char) {
    const snapshot = char && char.chatConfig && char.chatConfig.aiStatusSnapshot;
    if (snapshot && snapshot.fields && snapshot.generatedBy === 'api') return snapshot;
    return null;
}

function getWechatUserMomentsPromptForStatus() {
    if (typeof buildUserMomentsAnchor !== 'function') return '';
    try {
        return buildUserMomentsAnchor() || '';
    } catch (_) {
        return '';
    }
}

async function requestWechatAiStatusSnapshot(charOrId, options = {}) {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    if (!char) return null;
    char.chatConfig = char.chatConfig || {};
    window._wechatAiStatusGenerating = window._wechatAiStatusGenerating || new Map();
    if (window._wechatAiStatusGenerating.has(char.id)) {
        return window._wechatAiStatusGenerating.get(char.id);
    }

    const promise = (async () => {
        let snapshot = null;
        let errorText = '';
        try {
            const userProfile = (typeof getUserProfile === 'function') ? getUserProfile() : { name: '用户' };
            const momentsAnchor = getWechatUserMomentsPromptForStatus();
            const previousStatus = buildWechatPreviousAiStatusPrompt(char);
            const worldBookAnchor = buildWechatWorldBookPrompt(char);
            const memoryAnchor = typeof buildWechatMemoryPrompt === 'function' ? buildWechatMemoryPrompt(char) : '';
            const characterCard = stripWechatPromptText(char.description || '', 3000);
            const result = await callChatApi([
                {
                    role: 'system',
                    content: `你是「${char.name}」。根据当前微信聊天情景生成角色此刻状态。只返回 JSON，不要 Markdown，不要解释。JSON 字段必须包含：innerMonologue, miniDiary, thoughts, outfit, posture, action, gaze, penis。miniDiary 是想对用户说但没说出口的话。所有字段都要承接角色卡、世界书、最近聊天、朋友圈、已保存记忆和上一轮状态；不要使用固定占位、模板化省略或拒绝式套话；字段内容按上下文直接生成。`
                },
                {
                    role: 'user',
                    content: `用户：${userProfile.name || '用户'}\n角色：${getWechatCharDisplayName(char)}\n${characterCard ? `角色卡：\n${characterCard}\n` : ''}${worldBookAnchor ? `${worldBookAnchor}\n` : ''}${memoryAnchor ? `${memoryAnchor}\n` : ''}最近聊天：\n${buildWechatRecentHistoryForPrompt(char, 14)}\n${momentsAnchor ? `\n${momentsAnchor}` : ''}${previousStatus ? `\n上一轮状态：\n${previousStatus}` : ''}`
                }
            ]);
            if (result && result.ok) {
                snapshot = normalizeWechatAiStatusSnapshot(parseWechatJsonObject(result.content), char, options.reason || 'api');
                if (!snapshot) errorText = 'API 没有返回可解析的状态 JSON';
            } else {
                errorText = (result && result.error) || 'API 状态生成失败';
            }
        } catch (e) {
            console.warn('request ai status failed:', e);
            errorText = 'API 状态生成失败';
        }

        if (snapshot) {
            char.chatConfig.aiStatusSnapshot = snapshot;
            char.chatConfig.aiStatusError = '';
            char.chatConfig.aiStatusHistory = Array.isArray(char.chatConfig.aiStatusHistory) ? char.chatConfig.aiStatusHistory : [];
            char.chatConfig.aiStatusHistory.unshift(snapshot);
            char.chatConfig.aiStatusHistory = char.chatConfig.aiStatusHistory.slice(0, 20);
        } else if (errorText) {
            char.chatConfig.aiStatusError = errorText;
        }
        saveCharactersToStorage();
        if (window._wechatAiStatusOpenCharId === char.id) renderWechatAiStatusTicket(char);
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
        return snapshot;
    })();

    window._wechatAiStatusGenerating.set(char.id, promise);
    try {
        return await promise;
    } finally {
        window._wechatAiStatusGenerating.delete(char.id);
        if (window._wechatAiStatusOpenCharId === char.id) renderWechatAiStatusTicket(char);
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
    }
}

function openWechatAiStatusTicket(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    window._wechatAiStatusOpenCharId = charId;
    let modal = document.getElementById('wc-ai-status-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-ai-status-overlay';
        modal.className = 'wc-ai-status-overlay';
        modal.setAttribute('onclick', 'if(event.target===this) closeWechatAiStatusTicket()');
        getWechatModalRoot().appendChild(modal);
    }
    renderWechatAiStatusTicket(char);
    if (!getWechatAiStatusSnapshot(char)) {
        requestWechatAiStatusSnapshot(char, { reason: 'avatar_open' }).catch(e => console.warn('ai status open failed:', e));
    }
}

function renderWechatAiStatusTicket(char) {
    const modal = document.getElementById('wc-ai-status-overlay');
    if (!modal || !char) return;
    const snapshot = getWechatAiStatusSnapshot(char);
    const isLoading = !!(window._wechatAiStatusGenerating && window._wechatAiStatusGenerating.has(char.id));
    const statusError = char.chatConfig && char.chatConfig.aiStatusError;
    const charName = getWechatCharDisplayName(char);
    const statusTime = snapshot ? formatWechatSnapshotTime(snapshot.updatedAt) : formatWechatSnapshotTime(Date.now());
    const sourceLabel = snapshot ? (snapshot.generatedBy === 'api' ? 'API RECEIPT' : 'LOCAL RECEIPT') : (isLoading ? 'GENERATING' : 'EMPTY RECEIPT');
    const fieldsHtml = WECHAT_AI_STATUS_FIELDS.map((item, index) => {
        const value = getWechatStatusFieldDisplay(snapshot, item, isLoading, statusError);
        return `
        <div class="wc-ai-status-row">
            <div class="wc-ai-status-item-head">
                <b>#${String(index + 1).padStart(2, '0')}</b>
                <span>${wcEscapeHtml(item.label)}</span>
                <i></i>
                <em>${wcEscapeHtml(item.key)}</em>
            </div>
            <p>${wcEscapeHtml(value)}</p>
        </div>
    `;
    }).join('');
    const guestbookText = snapshot && snapshot.fields && !isWechatStatusPlaceholderValue(snapshot.fields.miniDiary)
        ? snapshot.fields.miniDiary
        : 'click refresh';
    modal.innerHTML = `
        <div class="wc-ai-status-ticket">
            <div class="wc-ai-status-top">
                <button type="button" onclick="closeWechatAiStatusTicket()" aria-label="关闭"><i class="ri-close-line"></i></button>
                <div>
                    <strong>${wcEscapeHtml(charName)}</strong>
                    <span>${wcEscapeHtml(sourceLabel)}</span>
                </div>
                <button type="button" onclick="openWechatAiStatusHistory(${quoteWechatJsString(char.id)})" aria-label="历史记录"><i class="ri-history-line"></i></button>
            </div>
            <div class="wc-ai-status-brand">
                <div class="wc-ai-status-logo"><i class="ri-cup-line"></i><span>STATUS</span></div>
                <h3>${wcEscapeHtml(charName)}</h3>
                <p>CHARACTER RECEIPT</p>
            </div>
            <div class="wc-ai-status-meta">
                <span>DATE</span><b>${wcEscapeHtml(statusTime)}</b>
                <span>SERIAL NUMBER</span><b>${wcEscapeHtml(getWechatStatusSerial(char))}</b>
            </div>
            <div class="wc-ai-status-bar">ITEM</div>
            <div class="wc-ai-status-fields">${fieldsHtml}</div>
            ${statusError && !snapshot ? `<div class="wc-ai-status-error">${wcEscapeHtml(statusError)}</div>` : ''}
            <div class="wc-ai-status-footer">
                <div><span>TOTAL</span><b>${WECHAT_AI_STATUS_FIELDS.length}</b></div>
                <div><span>AMOUNT</span><b>$0.00</b></div>
            </div>
            <div class="wc-ai-status-guestbook">
                <span>GUESTBOOK</span>
                <p>${wcEscapeHtml(guestbookText)}</p>
                <b>MESSAGE DATE: ${wcEscapeHtml(statusTime)}</b>
            </div>
            <div class="wc-ai-status-goodday">BEYOND THE SCREEN</div>
        </div>
    `;
}

function getWechatAiStatusHistory(char) {
    if (!char || !char.chatConfig) return [];
    const list = [];
    const seen = new Set();
    const pushSnapshot = snapshot => {
        if (!snapshot || !snapshot.fields) return;
        const key = `${snapshot.updatedAt || ''}_${snapshot.reason || ''}_${JSON.stringify(snapshot.fields)}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push(snapshot);
    };
    pushSnapshot(char.chatConfig.aiStatusSnapshot);
    (Array.isArray(char.chatConfig.aiStatusHistory) ? char.chatConfig.aiStatusHistory : []).forEach(pushSnapshot);
    return list.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 30);
}

function renderWechatAiStatusHistoryFields(snapshot) {
    const fields = snapshot && snapshot.fields ? snapshot.fields : {};
    return WECHAT_AI_STATUS_FIELDS.map((item, index) => {
        const value = fields[item.key];
        return `
            <div class="wc-ai-history-field">
                <b>#${String(index + 1).padStart(2, '0')} ${wcEscapeHtml(item.label)}</b>
                <p>${wcEscapeHtml(isWechatStatusPlaceholderValue(value) ? '未记录' : value)}</p>
            </div>
        `;
    }).join('');
}

function openWechatAiStatusHistory(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const modal = document.getElementById('wc-ai-status-overlay');
    if (!char || !modal) return;
    const history = getWechatAiStatusHistory(char);
    const charName = getWechatCharDisplayName(char);
    const historyHtml = history.length ? history.map((snapshot, index) => `
        <details class="wc-ai-history-item" ${index === 0 ? 'open' : ''}>
            <summary>
                <span>${index === 0 ? 'CURRENT' : `HISTORY ${String(index).padStart(2, '0')}`}</span>
                <b>${wcEscapeHtml(formatWechatSnapshotTime(snapshot.updatedAt))}</b>
                <em>${wcEscapeHtml(snapshot.reason || snapshot.generatedBy || 'status')}</em>
            </summary>
            <div class="wc-ai-history-fields">
                ${renderWechatAiStatusHistoryFields(snapshot)}
            </div>
        </details>
    `).join('') : `
        <div class="wc-ai-history-empty">
            <i class="ri-history-line"></i>
            <span>还没有状态历史</span>
            <p>AI 状态生成后会自动保存到这里。</p>
        </div>
    `;
    modal.innerHTML = `
        <div class="wc-ai-status-ticket wc-ai-status-history">
            <div class="wc-ai-status-top">
                <button type="button" onclick="backWechatAiStatusTicket(${quoteWechatJsString(char.id)})" aria-label="返回状态"><i class="ri-arrow-left-s-line"></i></button>
                <div>
                    <strong>${wcEscapeHtml(charName)}</strong>
                    <span>STATUS HISTORY · ${history.length}</span>
                </div>
                <button type="button" onclick="closeWechatAiStatusTicket()" aria-label="关闭"><i class="ri-close-line"></i></button>
            </div>
            <div class="wc-ai-status-brand">
                <div class="wc-ai-status-logo"><i class="ri-history-line"></i><span>HISTORY</span></div>
                <h3>${wcEscapeHtml(charName)}</h3>
                <p>ATTRIBUTE ARCHIVE</p>
            </div>
            <div class="wc-ai-status-bar">RECORDS</div>
            <div class="wc-ai-history-list">${historyHtml}</div>
            <div class="wc-ai-status-goodday">BEYOND THE SCREEN</div>
        </div>
    `;
}

function backWechatAiStatusTicket(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (char) renderWechatAiStatusTicket(char);
}

function refreshWechatAiStatusTicket(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    renderWechatAiStatusTicket(char);
    requestWechatAiStatusSnapshot(char, { reason: 'manual_refresh' }).catch(e => console.warn('manual status refresh failed:', e));
}

function closeWechatAiStatusTicket() {
    const modal = document.getElementById('wc-ai-status-overlay');
    if (modal) modal.remove();
    window._wechatAiStatusOpenCharId = '';
}

function normalizeWechatTextList(value, fallback = []) {
    if (Array.isArray(value)) return value.map(item => stripWechatPromptText(item, 120)).filter(Boolean).slice(0, 6);
    if (typeof value === 'string' && value.trim()) return value.split(/\n+/).map(item => stripWechatPromptText(item, 120)).filter(Boolean).slice(0, 6);
    return fallback;
}

function buildWechatAiPhoneFallback(char) {
    const status = getWechatAiStatusSnapshot(char);
    const fields = (status && status.fields) || {};
    const userProfile = (typeof getUserProfile === 'function') ? getUserProfile() : { name: '用户' };
    const userName = userProfile.name || '用户';
    const history = Array.isArray(char && char.history) ? char.history : [];
    const lastMsg = history.slice().reverse().find(msg => msg && msg.type !== 'system_notice');
    const lastText = stripWechatPromptText(getWechatMessagePromptContent(lastMsg), 62) || '还没有新消息';
    const otherChats = (window.myCharacters || [])
        .filter(c => c && c.id !== char.id)
        .slice(0, 2)
        .map(c => ({
            name: getWechatCharDisplayName(c),
            text: '通讯录联系人',
            time: '未读'
        }));

    return {
        updatedAt: Date.now(),
        generatedBy: 'local',
        chats: [
            { name: userName, text: lastText, time: formatWechatSnapshotTime(Date.now()) },
            ...otherChats
        ],
        memos: normalizeWechatTextList([fields.thoughts, fields.miniDiary].filter(Boolean), ['没有备忘录。']),
        browser: normalizeWechatTextList(['最近停在聊天页', fields.gaze].filter(Boolean), ['没有浏览记录。']),
        wallet: '零钱和卡包未授权查看。',
        footprints: normalizeWechatTextList([fields.action, fields.posture].filter(Boolean), ['没有新的足迹。']),
        usageRecords: normalizeWechatTextList([`消息数 ${history.length}`, `状态刷新 ${status ? formatWechatSnapshotTime(status.updatedAt) : '等待 API'}`], []),
        diary: fields.miniDiary || `今天把和${userName}的聊天重新看了一遍。`
    };
}

function normalizeWechatAiPhoneSnapshot(raw, char) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const fallback = buildWechatAiPhoneFallback(char);
    const normalizeChats = (value) => {
        if (!Array.isArray(value)) return fallback.chats;
        return value.map(item => {
            if (typeof item === 'string') return { name: item, text: '聊天', time: '' };
            return {
                name: stripWechatPromptText(item.name || item.with || item.contact || '联系人', 32),
                text: stripWechatPromptText(item.text || item.lastMessage || item.message || '', 82),
                time: stripWechatPromptText(item.time || item.status || '', 16)
            };
        }).filter(item => item.name).slice(0, 5);
    };

    return {
        updatedAt: Date.now(),
        generatedBy: raw ? 'api' : 'local',
        chats: normalizeChats(data.chats || data.chatList || data['聊天列表']),
        memos: normalizeWechatTextList(data.memos || data.memo || data['备忘录'], fallback.memos),
        browser: normalizeWechatTextList(data.browser || data.browserHistory || data['浏览器'], fallback.browser),
        wallet: stripWechatPromptText(data.wallet || data['钱包'] || fallback.wallet, 120),
        footprints: normalizeWechatTextList(data.footprints || data.traces || data['足迹'], fallback.footprints),
        usageRecords: normalizeWechatTextList(data.usageRecords || data.usage || data['使用记录'], fallback.usageRecords),
        diary: stripWechatPromptText(data.diary || data['日记'] || fallback.diary, 260)
    };
}

async function requestWechatAiPhoneSnapshot(charOrId) {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    if (!char) return null;
    char.chatConfig = char.chatConfig || {};
    window._wechatAiPhoneGenerating = window._wechatAiPhoneGenerating || new Map();
    if (window._wechatAiPhoneGenerating.has(char.id)) return window._wechatAiPhoneGenerating.get(char.id);

    const promise = (async () => {
        let snapshot = buildWechatAiPhoneFallback(char);
        try {
            const status = getWechatAiStatusSnapshot(char) || { fields: {} };
            const result = await callChatApi([
                {
                    role: 'system',
                    content: `你是「${char.name}」。根据当前情景生成这个角色手机里的可见内容。只返回 JSON，不要 Markdown。字段：chats(数组，每项 name/text/time), memos(数组), browser(数组), wallet(字符串), footprints(数组), usageRecords(数组), diary(字符串，写给用户但没有直接发出的认真日记)。`
                },
                {
                    role: 'user',
                    content: `最新状态：${JSON.stringify(status.fields || {})}\n最近聊天：\n${buildWechatRecentHistoryForPrompt(char, 12)}`
                }
            ]);
            if (result && result.ok) {
                snapshot = normalizeWechatAiPhoneSnapshot(parseWechatJsonObject(result.content), char);
            }
        } catch (e) {
            console.warn('request ai phone failed:', e);
        }
        char.chatConfig.aiPhoneSnapshot = snapshot;
        saveCharactersToStorage();
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
        return snapshot;
    })();

    window._wechatAiPhoneGenerating.set(char.id, promise);
    try {
        return await promise;
    } finally {
        window._wechatAiPhoneGenerating.delete(char.id);
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
    }
}

function openWechatAiPhone(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    window._wechatAiPhoneOpenCharId = charId;
    let modal = document.getElementById('wc-ai-phone-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-ai-phone-overlay';
        modal.className = 'wc-ai-phone-overlay';
        modal.setAttribute('onclick', 'if(event.target===this) closeWechatAiPhone()');
        getWechatModalRoot().appendChild(modal);
    }
    renderWechatAiPhone(char);
    const phoneSnapshot = char.chatConfig && char.chatConfig.aiPhoneSnapshot && char.chatConfig.aiPhoneSnapshot.generatedBy === 'api'
        ? char.chatConfig.aiPhoneSnapshot
        : null;
    const statusSnapshot = getWechatAiStatusSnapshot(char);
    if (!phoneSnapshot || (statusSnapshot && statusSnapshot.updatedAt > phoneSnapshot.updatedAt)) {
        requestWechatAiPhoneSnapshot(char).catch(e => console.warn('ai phone open failed:', e));
    }
}

function renderWechatAiPhone(char) {
    const modal = document.getElementById('wc-ai-phone-overlay');
    if (!modal || !char) return;
    const snapshot = (char.chatConfig && char.chatConfig.aiPhoneSnapshot && char.chatConfig.aiPhoneSnapshot.generatedBy === 'api')
        ? char.chatConfig.aiPhoneSnapshot
        : buildWechatAiPhoneFallback(char);
    const isLoading = !!(window._wechatAiPhoneGenerating && window._wechatAiPhoneGenerating.has(char.id));
    const activeTab = window._wechatAiPhoneTab || 'chat';
    const chatsHtml = (snapshot.chats || []).map(item => `
        <div class="wc-ai-phone-chat">
            <span>${wcEscapeHtml(item.name)}</span>
            <p>${wcEscapeHtml(item.text || ' ')}</p>
            <em>${wcEscapeHtml(item.time || '')}</em>
        </div>
    `).join('');
    const listHtml = (title, icon, items) => `
        <div class="wc-ai-phone-section">
            <h4><i class="${icon}"></i>${title}</h4>
            ${(items || []).map(item => `<p>${wcEscapeHtml(item)}</p>`).join('') || '<p>暂无记录</p>'}
        </div>
    `;
    const tabHtml = (() => {
        if (activeTab === 'memo') {
            return `
                ${listHtml('备忘录', 'ri-sticky-note-line', snapshot.memos)}
                <div class="wc-ai-phone-section wc-ai-phone-diary">
                    <h4><i class="ri-book-open-line"></i>日记</h4>
                    <p>${wcEscapeHtml(snapshot.diary || '还没有写下日记。')}</p>
                </div>
            `;
        }
        if (activeTab === 'browser') {
            return `
                ${listHtml('浏览器', 'ri-compass-3-line', snapshot.browser)}
                ${listHtml('足迹', 'ri-map-pin-time-line', snapshot.footprints)}
                ${listHtml('使用记录', 'ri-history-line', snapshot.usageRecords)}
            `;
        }
        if (activeTab === 'wallet') {
            return `
                <div class="wc-ai-phone-section wc-ai-phone-wallet">
                    <h4><i class="ri-wallet-3-line"></i>钱包</h4>
                    <p>${wcEscapeHtml(snapshot.wallet || '暂无记录')}</p>
                </div>
                ${listHtml('使用记录', 'ri-history-line', snapshot.usageRecords)}
            `;
        }
        return `
            <div class="wc-ai-phone-section wc-ai-phone-chatlist">
                <h4><i class="ri-message-3-line"></i>聊天列表</h4>
                ${chatsHtml || '<p>暂无聊天</p>'}
            </div>
        `;
    })();
    modal.innerHTML = `
        <div class="wc-ai-phone">
            <div class="wc-ai-phone-status"><span></span><b></b><span></span></div>
            <div class="wc-ai-phone-head">
                <img src="${char.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div>
                    <strong>${wcEscapeHtml(getWechatCharDisplayName(char))} 的手机</strong>
                    <span>${isLoading ? '正在同步手机内容' : `同步于 ${formatWechatSnapshotTime(snapshot.updatedAt)}`}</span>
                </div>
                <button onclick="closeWechatAiPhone()"><i class="ri-close-line"></i></button>
            </div>
            <div class="wc-ai-phone-apps">
                <button class="${activeTab === 'chat' ? 'active' : ''}" onclick="switchWechatAiPhoneTab('chat')"><i class="ri-chat-3-line"></i>聊天</button>
                <button class="${activeTab === 'memo' ? 'active' : ''}" onclick="switchWechatAiPhoneTab('memo')"><i class="ri-sticky-note-line"></i>备忘录</button>
                <button class="${activeTab === 'browser' ? 'active' : ''}" onclick="switchWechatAiPhoneTab('browser')"><i class="ri-compass-3-line"></i>浏览器</button>
                <button class="${activeTab === 'wallet' ? 'active' : ''}" onclick="switchWechatAiPhoneTab('wallet')"><i class="ri-wallet-3-line"></i>钱包</button>
            </div>
            <div class="wc-ai-phone-screen">
                ${tabHtml}
            </div>
        </div>
    `;
}

function switchWechatAiPhoneTab(tabName) {
    window._wechatAiPhoneTab = ['chat', 'memo', 'browser', 'wallet'].includes(tabName) ? tabName : 'chat';
    const char = (window.myCharacters || []).find(c => c.id === window._wechatAiPhoneOpenCharId);
    if (char) renderWechatAiPhone(char);
}

function closeWechatAiPhone() {
    const modal = document.getElementById('wc-ai-phone-overlay');
    if (modal) modal.remove();
    window._wechatAiPhoneOpenCharId = '';
    window._wechatAiPhoneTab = 'chat';
}

// ========== 微信记忆系统 ==========

function normalizeWechatMemoryStore(store) {
    const safe = (store && typeof store === 'object') ? store : {};
    const normalizeList = (list, tier, charId) => Array.isArray(list) ? list
        .filter(item => item && typeof item === 'object')
        .map(item => ({
            id: item.id || ('mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
            tier,
            charId: item.charId || charId || '',
            title: String(item.title || '').trim(),
            content: String(item.content || '').trim(),
            enabled: item.enabled !== false,
            sourceCount: Math.max(1, Number(item.sourceCount || 1)),
            createdAt: item.createdAt || Date.now(),
            updatedAt: item.updatedAt || item.createdAt || Date.now()
        }))
        .filter(item => item.content)
        : [];

    const normalizeBucket = (bucket, charId) => {
        if (Array.isArray(bucket)) {
            return {
                segments: normalizeList(bucket, 'segment', charId),
                longTerm: [],
                compressed: []
            };
        }
        return {
            segments: normalizeList(bucket && (bucket.segments || bucket.segment), 'segment', charId),
            longTerm: normalizeList(bucket && (bucket.longTerm || bucket.long || bucket.longterm), 'long', charId),
            compressed: normalizeList(bucket && (bucket.compressed || bucket.compress), 'compressed', charId)
        };
    };

    const chars = {};
    Object.keys(safe.chars || {}).forEach(charId => {
        chars[charId] = normalizeBucket(safe.chars[charId], charId);
    });
    return {
        chars
    };
}

function getWechatMemoryStore() {
    try {
        return normalizeWechatMemoryStore(JSON.parse(localStorage.getItem(WECHAT_MEMORY_STORAGE_KEY) || '{}'));
    } catch (e) {
        return normalizeWechatMemoryStore({});
    }
}

function saveWechatMemoryStore(store) {
    localStorage.setItem(WECHAT_MEMORY_STORAGE_KEY, JSON.stringify(normalizeWechatMemoryStore(store)));
}

function getWechatMemoryBucket(store, charId) {
    if (!store.chars[charId]) {
        store.chars[charId] = { segments: [], longTerm: [], compressed: [] };
    }
    return store.chars[charId];
}

function getWechatMemoryListForTier(store, tier, charId) {
    const bucket = getWechatMemoryBucket(store, charId);
    if (tier === 'compressed') return bucket.compressed;
    if (tier === 'long') return bucket.longTerm;
    return bucket.segments;
}

function normalizeWechatMemoryNumber(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

function getWechatMemoryConfig(charOrId) {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    const config = (char && char.chatConfig) || {};
    const segmentLimit = normalizeWechatMemoryNumber(config.memorySegmentLimit, WECHAT_MEMORY_DEFAULTS.segmentLimit, 3, 50);
    const longTermLimit = normalizeWechatMemoryNumber(config.memoryLongTermLimit, WECHAT_MEMORY_DEFAULTS.longTermLimit, 3, 50);
    const keepRecent = Math.min(
        segmentLimit,
        normalizeWechatMemoryNumber(config.memoryKeepRecent, WECHAT_MEMORY_DEFAULTS.keepRecent, 1, Math.max(1, segmentLimit))
    );
    return {
        segmentLimit,
        longTermLimit,
        keepRecent
    };
}

function getWechatMemoryTierLabel(tier) {
    if (tier === 'compressed') return '压缩记忆';
    if (tier === 'long') return '长期记忆';
    return '分段记忆';
}

function findWechatMemoryEntry(store, id) {
    for (const charId of Object.keys(store.chars || {})) {
        const bucket = getWechatMemoryBucket(store, charId);
        for (const tier of ['segments', 'longTerm', 'compressed']) {
            const list = bucket[tier] || [];
            const index = list.findIndex(item => item.id === id);
            if (index >= 0) return { list, index, item: list[index] };
        }
    }
    return null;
}

function buildWechatMemoryDigest(items, label) {
    const lines = items
        .filter(item => item && item.content)
        .map(item => {
            const title = item.title ? `${item.title}：` : '';
            return `${title}${item.content}`;
        });
    const text = lines.join('；');
    return text.length > 900 ? `${text.slice(0, 900)}...` : text;
}

function promoteWechatMemoryBucket(bucket, charOrId) {
    const memoryConfig = getWechatMemoryConfig(charOrId);
    const now = Date.now();
    if (bucket.segments.length > memoryConfig.segmentLimit) {
        const moveCount = Math.max(1, bucket.segments.length - memoryConfig.keepRecent);
        const moved = bucket.segments.splice(0, moveCount);
        bucket.longTerm.push({
            id: 'mem_long_' + now + '_' + Math.random().toString(36).slice(2, 7),
            tier: 'long',
            title: `阶段整理 ${new Date(now).toLocaleDateString()}`,
            content: buildWechatMemoryDigest(moved, '分段记忆'),
            enabled: true,
            sourceCount: moved.reduce((sum, item) => sum + Number(item.sourceCount || 1), 0),
            createdAt: now,
            updatedAt: now
        });
    }

    if (bucket.longTerm.length > memoryConfig.longTermLimit) {
        const keepLongTerm = Math.min(memoryConfig.keepRecent, memoryConfig.longTermLimit);
        const moveCount = Math.max(1, bucket.longTerm.length - keepLongTerm);
        const moved = bucket.longTerm.splice(0, moveCount);
        bucket.compressed.push({
            id: 'mem_zip_' + now + '_' + Math.random().toString(36).slice(2, 7),
            tier: 'compressed',
            title: `压缩记忆 ${new Date(now).toLocaleDateString()}`,
            content: buildWechatMemoryDigest(moved, '长期记忆'),
            enabled: true,
            sourceCount: moved.reduce((sum, item) => sum + Number(item.sourceCount || 1), 0),
            createdAt: now,
            updatedAt: now
        });
    }
}

function getWechatActiveMemories(char) {
    const store = getWechatMemoryStore();
    const charId = char && char.id;
    if (!charId) return { segments: [], longTerm: [], compressed: [] };
    const bucket = getWechatMemoryBucket(store, charId);
    const memoryConfig = getWechatMemoryConfig(char);
    return {
        segments: bucket.segments.filter(item => item.enabled).slice(-memoryConfig.segmentLimit),
        longTerm: bucket.longTerm.filter(item => item.enabled).slice(-memoryConfig.longTermLimit),
        compressed: bucket.compressed.filter(item => item.enabled).slice(-6)
    };
}

function buildWechatMemoryPrompt(char) {
    const memories = getWechatActiveMemories(char);
    const sections = [];
    const renderLines = list => list.map(item => {
        const title = item.title ? `${item.title}：` : '';
        return `- ${title}${item.content}`;
    }).join('\n');
    if (memories.compressed.length) sections.push(`【压缩记忆】\n${renderLines(memories.compressed)}`);
    if (memories.longTerm.length) sections.push(`【长期记忆】\n${renderLines(memories.longTerm)}`);
    if (memories.segments.length) sections.push(`【近期分段记忆】\n${renderLines(memories.segments)}`);
    if (!sections.length) return '';
    return `【当前聊天对象记忆】\n这些记忆只属于当前 AI 角色和用户的关系。回复时自然遵守，不要主动解释记忆系统。\n${sections.join('\n')}`;
}

function maybeCaptureWechatMemoryCommand(char, text) {
    const match = String(text || '').match(/^\s*(?:记住|记忆|remember)\s*[：:\s]\s*([\s\S]{2,})$/i);
    if (!match || !char) return false;
    const content = match[1].trim();
    if (!content) return false;
    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const list = bucket.segments;
    const now = Date.now();
    list.push({
        id: 'mem_' + now + '_' + Math.random().toString(36).slice(2, 7),
        tier: 'segment',
        charId: char.id,
        title: content.slice(0, 18),
        content,
        enabled: true,
        sourceCount: 1,
        createdAt: now,
        updatedAt: now
    });
    promoteWechatMemoryBucket(bucket, char);
    saveWechatMemoryStore(store);
    return true;
}

function ensureWechatMemoryManager() {
    let modal = document.getElementById('wc-memory-manager');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-memory-manager';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay wc-sticker-submodal';
    modal.style.zIndex = '3800';
    modal.innerHTML = `
        <div class="wc-compose-card wc-memory-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i class="ri-brain-line"></i><span>记忆</span></div>
                <i class="ri-close-line" onclick="closeWechatMemoryManager()"></i>
            </div>
            <div class="wc-compose-body wc-memory-body">
                <div class="wc-compose-segment wc-memory-tabs">
                    <button id="wc-memory-tab-segment" onclick="switchWechatMemoryTier('segment')">分段</button>
                    <button id="wc-memory-tab-long" onclick="switchWechatMemoryTier('long')">长期</button>
                    <button id="wc-memory-tab-compressed" onclick="switchWechatMemoryTier('compressed')">压缩</button>
                </div>
                <div id="wc-memory-stats" class="wc-memory-stats"></div>
                <div class="wc-memory-editor">
                    <input id="wc-memory-title" type="text" maxlength="32" placeholder="标题">
                    <textarea id="wc-memory-content" maxlength="900" placeholder="写入当前聊天对象需要记住的事实、偏好或关系状态"></textarea>
                </div>
                <div id="wc-memory-list" class="wc-memory-list"></div>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="clearWechatMemoryEditor()">清空</button>
                <button class="wc-compose-primary" id="wc-memory-save-btn" onclick="saveWechatMemoryFromEditor()">保存记忆</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function openWechatMemoryManager() {
    const char = getCurrentChatChar();
    if (!char) return;
    closeChatToolbar();
    closeStickerPicker();
    window._wechatMemoryTier = window._wechatMemoryTier || 'segment';
    const modal = ensureWechatMemoryManager();
    modal.dataset.editId = '';
    modal.classList.remove('hidden');
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

function closeWechatMemoryManager() {
    const modal = document.getElementById('wc-memory-manager');
    if (modal) modal.classList.add('hidden');
}

function switchWechatMemoryTier(tier) {
    window._wechatMemoryTier = tier === 'compressed' ? 'compressed' : (tier === 'long' ? 'long' : 'segment');
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

function switchWechatMemoryScope() {
    switchWechatMemoryTier('segment');
}

function clearWechatMemoryEditor(render = true) {
    const modal = document.getElementById('wc-memory-manager');
    if (modal) modal.dataset.editId = '';
    const title = document.getElementById('wc-memory-title');
    const content = document.getElementById('wc-memory-content');
    const saveBtn = document.getElementById('wc-memory-save-btn');
    if (title) title.value = '';
    if (content) content.value = '';
    if (saveBtn) saveBtn.textContent = '保存记忆';
    if (render) renderWechatMemoryManager();
}

function renderWechatMemoryManager() {
    const char = getCurrentChatChar();
    if (!char) return;
    const tier = window._wechatMemoryTier === 'compressed' ? 'compressed' : (window._wechatMemoryTier === 'long' ? 'long' : 'segment');
    document.getElementById('wc-memory-tab-segment')?.classList.toggle('active', tier === 'segment');
    document.getElementById('wc-memory-tab-long')?.classList.toggle('active', tier === 'long');
    document.getElementById('wc-memory-tab-compressed')?.classList.toggle('active', tier === 'compressed');

    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const list = getWechatMemoryListForTier(store, tier, char.id);
    const memoryConfig = getWechatMemoryConfig(char);
    const listEl = document.getElementById('wc-memory-list');
    if (!listEl) return;
    const statsEl = document.getElementById('wc-memory-stats');
    if (statsEl) {
        statsEl.innerHTML = `
            <span>分段 ${bucket.segments.length}/${memoryConfig.segmentLimit}</span>
            <span>长期 ${bucket.longTerm.length}/${memoryConfig.longTermLimit}</span>
            <span>压缩 ${bucket.compressed.length}</span>
        `;
    }

    if (!list.length) {
        listEl.innerHTML = `<div class="wc-memory-empty">暂无${getWechatMemoryTierLabel(tier)}</div>`;
        return;
    }

    listEl.innerHTML = list.slice().reverse().map(item => `
        <div class="wc-memory-item ${item.enabled ? '' : 'is-off'}">
            <div class="wc-memory-main" onclick="editWechatMemoryEntry('${item.id}')">
                <div class="wc-memory-title">${wcEscapeHtml(item.title || '未命名记忆')}</div>
                <div class="wc-memory-content">${wcEscapeHtml(item.content)}</div>
                <div class="wc-memory-meta">${getWechatMemoryTierLabel(item.tier || tier)} · ${item.sourceCount || 1} 段来源</div>
            </div>
            <div class="wc-memory-actions">
                <button onclick="toggleWechatMemoryEntry('${item.id}')" title="${item.enabled ? '停用' : '启用'}"><i class="${item.enabled ? 'ri-toggle-fill' : 'ri-toggle-line'}"></i></button>
                <button onclick="deleteWechatMemoryEntry('${item.id}')" title="删除"><i class="ri-delete-bin-6-line"></i></button>
            </div>
        </div>
    `).join('');
}

function saveWechatMemoryFromEditor() {
    const char = getCurrentChatChar();
    if (!char) return;
    const modal = document.getElementById('wc-memory-manager');
    const titleEl = document.getElementById('wc-memory-title');
    const contentEl = document.getElementById('wc-memory-content');
    const content = contentEl ? contentEl.value.trim() : '';
    if (!content) {
        contentEl?.focus();
        return;
    }

    const store = getWechatMemoryStore();
    const editId = modal ? modal.dataset.editId : '';
    const now = Date.now();
    if (editId) {
        const found = findWechatMemoryEntry(store, editId);
        if (found) {
            found.item.title = (titleEl?.value || '').trim() || content.slice(0, 18);
            found.item.content = content;
            found.item.updatedAt = now;
        }
    } else {
        const tier = window._wechatMemoryTier === 'compressed' ? 'compressed' : (window._wechatMemoryTier === 'long' ? 'long' : 'segment');
        const bucket = getWechatMemoryBucket(store, char.id);
        const list = getWechatMemoryListForTier(store, tier, char.id);
        list.push({
            id: 'mem_' + now + '_' + Math.random().toString(36).slice(2, 7),
            tier,
            charId: char.id,
            title: (titleEl?.value || '').trim() || content.slice(0, 18),
            content,
            enabled: true,
            sourceCount: 1,
            createdAt: now,
            updatedAt: now
        });
        promoteWechatMemoryBucket(bucket, char);
    }

    saveWechatMemoryStore(store);
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

function editWechatMemoryEntry(id) {
    const store = getWechatMemoryStore();
    const found = findWechatMemoryEntry(store, id);
    if (!found) return;
    const modal = ensureWechatMemoryManager();
    modal.dataset.editId = id;
    const title = document.getElementById('wc-memory-title');
    const content = document.getElementById('wc-memory-content');
    const saveBtn = document.getElementById('wc-memory-save-btn');
    if (title) title.value = found.item.title || '';
    if (content) content.value = found.item.content || '';
    if (saveBtn) saveBtn.textContent = '更新记忆';
    content?.focus();
}

function toggleWechatMemoryEntry(id) {
    const store = getWechatMemoryStore();
    const found = findWechatMemoryEntry(store, id);
    if (!found) return;
    found.item.enabled = !found.item.enabled;
    found.item.updatedAt = Date.now();
    saveWechatMemoryStore(store);
    renderWechatMemoryManager();
}

function deleteWechatMemoryEntry(id) {
    const store = getWechatMemoryStore();
    const found = findWechatMemoryEntry(store, id);
    if (!found) return;
    if (!confirm(`确定删除「${found.item.title || '这条记忆'}」吗？`)) return;
    found.list.splice(found.index, 1);
    saveWechatMemoryStore(store);
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

function ensureWechatComposerModal() {
    let modal = document.getElementById('wc-composer-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-composer-modal';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
    modal.innerHTML = `
        <div class="wc-compose-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i id="wc-compose-icon" class="ri-mic-line"></i><span id="wc-compose-title">发送消息</span></div>
                <i class="ri-close-line" onclick="closeWechatComposer()"></i>
            </div>
            <div class="wc-compose-body">
                <div id="wc-compose-fields"></div>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="closeWechatComposer()">取消</button>
                <button class="wc-compose-primary" id="wc-compose-submit" onclick="submitWechatComposer()">发送</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function composeField(type, msg) {
    const value = (key, fallback = '') => wcEscapeHtml(msg && msg[key] != null ? msg[key] : fallback);
    const char = getCurrentChatChar();
    const peerName = wcEscapeHtml((char && ((char.chatConfig && char.chatConfig.nickname) || char.name)) || '对方');
    const peerAvatar = wcEscapeHtml((char && char.avatar) || DEFAULT_AVATAR);
    if (type === 'voice') {
        const transcript = msg?.transcript || '';
        const duration = estimateWechatVoiceDuration(transcript);
        return `
            <div class="wc-voice-estimate">
                <div class="wc-voice-estimate-icon"><i class="ri-mic-fill"></i></div>
                <div>
                    <span>自动估算语音时长</span>
                    <strong id="wc-compose-duration-estimate">${duration}"</strong>
                </div>
            </div>
            <label class="wc-compose-field">
                <span>转文字内容</span>
                <textarea id="wc-compose-transcript" rows="3" placeholder="输入语音转文字内容" oninput="updateWechatVoiceDurationEstimate()">${value('transcript', '')}</textarea>
            </label>
        `;
    }
    if (type === 'transfer') {
        return `
            <div class="wc-transfer-pay">
                <div class="wc-transfer-peer">
                    <img src="${peerAvatar}" alt="">
                    <div>
                        <span>转账给</span>
                        <strong>${peerName}</strong>
                    </div>
                </div>
                <label class="wc-transfer-amount">
                    <span>¥</span>
                    <input id="wc-compose-amount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${value('amount', '')}" placeholder="0.00">
                </label>
                <label class="wc-compose-field">
                    <span>转账说明</span>
                    <input id="wc-compose-note" type="text" value="${value('note', '')}" placeholder="添加说明">
                </label>
                <div class="wc-transfer-method">
                    <span>付款方式</span>
                    <strong>零钱</strong>
                </div>
            </div>
        `;
    }
    if (type === 'redpacket') {
        return `
            <label class="wc-compose-field">
                <span>红包标题</span>
                <input id="wc-compose-title-input" type="text" value="${value('title', '恭喜发财，大吉大利')}" placeholder="恭喜发财，大吉大利">
            </label>
            <label class="wc-compose-field">
                <span>金额</span>
                <input id="wc-compose-amount" type="number" min="0.01" step="0.01" value="${value('amount', '')}" placeholder="可留空">
            </label>
            <div class="wc-compose-hint"><i class="ri-information-line"></i><span>发送后显示待收取，AI 回复后自动变为已收取。</span></div>
        `;
    }
    return `
        <label class="wc-compose-field">
            <span>通话状态</span>
            <select id="wc-compose-status">
                ${['已结束', '已取消', '未接通', '已拒绝'].map(status => `<option value="${status}" ${(msg && msg.status === status) ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
        </label>
        <label class="wc-compose-field">
            <span>通话时长</span>
            <input id="wc-compose-duration" type="number" min="1" max="5999" value="${value('duration', 60)}">
        </label>
    `;
}

function openWechatComposer(type, editIndex) {
    const config = WECHAT_COMPOSER_CONFIG[type];
    const char = getCurrentChatChar();
    if (!config || !char) return;
    closeChatToolbar();
    closeStickerPicker();

    const msg = Number.isInteger(editIndex) ? char.history?.[editIndex] : null;
    const modal = ensureWechatComposerModal();
    modal.dataset.type = type;
    modal.dataset.editIndex = Number.isInteger(editIndex) ? String(editIndex) : '';
    modal.querySelector('.wc-compose-card')?.classList.toggle('wc-transfer-compose-card', type === 'transfer');

    document.getElementById('wc-compose-icon').className = config.icon;
    document.getElementById('wc-compose-title').textContent = Number.isInteger(editIndex) ? `编辑${config.title.replace('发送', '')}` : config.title;
    document.getElementById('wc-compose-submit').textContent = Number.isInteger(editIndex) ? '保存修改' : config.primary;
    document.getElementById('wc-compose-fields').innerHTML = composeField(type, msg);
    modal.classList.remove('hidden');
}

function closeWechatComposer() {
    const modal = document.getElementById('wc-composer-modal');
    if (modal) modal.classList.add('hidden');
}

function buildWechatSpecialMessageFromComposer(type, existingMsg) {
    const msg = {
        type,
        isMe: existingMsg ? existingMsg.isMe : true,
        timestamp: existingMsg?.timestamp || createMessageTimestamp()
    };
    if (type === 'voice') {
        msg.transcript = (document.getElementById('wc-compose-transcript')?.value || '').trim();
        msg.duration = estimateWechatVoiceDuration(msg.transcript);
        msg.content = msg.transcript || `[语音 ${formatWechatDuration(msg.duration)}]`;
    } else if (type === 'transfer') {
        msg.amount = normalizeWechatAmount(document.getElementById('wc-compose-amount')?.value);
        msg.note = (document.getElementById('wc-compose-note')?.value || '').trim();
    } else if (type === 'redpacket') {
        msg.title = (document.getElementById('wc-compose-title-input')?.value || '').trim() || '恭喜发财，大吉大利';
        const amount = (document.getElementById('wc-compose-amount')?.value || '').trim();
        if (amount) msg.amount = normalizeWechatAmount(amount);
        msg.status = existingMsg?.status || '待收取';
    } else if (type === 'voiceCall' || type === 'videoCall') {
        msg.status = document.getElementById('wc-compose-status')?.value || '已结束';
        msg.duration = normalizeWechatDuration(document.getElementById('wc-compose-duration')?.value, 60);
    }
    return syncWechatMessageDescription(msg);
}

function submitWechatComposer() {
    const modal = document.getElementById('wc-composer-modal');
    const type = modal?.dataset.type;
    const char = getCurrentChatChar();
    if (!modal || !type || !char) return;

    const editIndex = modal.dataset.editIndex === '' ? null : parseInt(modal.dataset.editIndex, 10);
    const existingMsg = Number.isInteger(editIndex) ? char.history?.[editIndex] : null;
    if (type === 'transfer' && parseWechatAmountNumber(document.getElementById('wc-compose-amount')?.value) == null) {
        alert('请输入转账金额');
        return;
    }
    const msg = buildWechatSpecialMessageFromComposer(type, existingMsg);

    if (existingMsg) {
        char.history[editIndex] = { ...existingMsg, ...msg };
        saveCharactersToStorage();
        refreshChatView(char);
        renderChatList();
    } else {
        appendWechatMessage(msg);
    }
    closeWechatComposer();
}

function ensureWechatTextEditModal() {
    let modal = document.getElementById('wc-text-edit-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-text-edit-modal';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
    modal.innerHTML = `
        <div class="wc-compose-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i class="ri-edit-line"></i><span>编辑消息</span></div>
                <i class="ri-close-line" onclick="closeWechatMessageEditor()"></i>
            </div>
            <div class="wc-compose-body">
                <div class="wc-compose-segment" id="wc-edit-side">
                    <button type="button" data-side="me" class="active" onclick="selectWechatEditSide('me')">user</button>
                    <button type="button" data-side="char" onclick="selectWechatEditSide('char')">char</button>
                </div>
                <label class="wc-compose-field">
                    <span>消息内容</span>
                    <textarea id="wc-edit-content" rows="7"></textarea>
                </label>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="closeWechatMessageEditor()">取消</button>
                <button class="wc-compose-primary" onclick="submitWechatMessageEditor()">保存修改</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function selectWechatEditSide(side) {
    document.querySelectorAll('#wc-edit-side button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.side === side);
    });
}

function getWechatEditSide() {
    return document.querySelector('#wc-edit-side button.active')?.dataset.side || 'me';
}

function openWechatMessageEditor(msgIdx) {
    const char = getCurrentChatChar();
    if (!char || !char.history || msgIdx < 0 || msgIdx >= char.history.length) return;
    const msg = char.history[msgIdx];
    const modal = ensureWechatTextEditModal();
    modal.dataset.msgIdx = String(msgIdx);
    document.getElementById('wc-edit-content').value = msg.content || msg.dialogue || msg.description || '';
    selectWechatEditSide(msg.isMe === false ? 'char' : 'me');
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('wc-edit-content')?.focus(), 30);
}

function closeWechatMessageEditor() {
    const modal = document.getElementById('wc-text-edit-modal');
    if (modal) modal.classList.add('hidden');
}

function submitWechatMessageEditor() {
    const modal = document.getElementById('wc-text-edit-modal');
    const char = getCurrentChatChar();
    if (!modal || !char || !char.history) return;
    const msgIdx = parseInt(modal.dataset.msgIdx, 10);
    const msg = char.history[msgIdx];
    if (!msg) return;
    msg.content = document.getElementById('wc-edit-content').value;
    msg.description = msg.type === 'image' ? msg.description : '';
    msg.isMe = getWechatEditSide() === 'me';
    saveCharactersToStorage();
    refreshChatView(char);
    renderChatList();
    closeWechatMessageEditor();
}

// ========== 表情包系统 ==========

const STICKER_STORAGE_KEY = 'my_sticker_packs';

function getStickerPacks() {
    try {
        const raw = localStorage.getItem(STICKER_STORAGE_KEY);
        if (raw) return ensureDefaultBoltpStickerPack(JSON.parse(raw));
    } catch (e) {}
    return ensureDefaultBoltpStickerPack({ packs: [] });
}

function saveStickerPacks(data) {
    localStorage.setItem(STICKER_STORAGE_KEY, JSON.stringify(data));
}

function buildBoltpStickerList() {
    const share = window.BYND_BOLTP_STICKER_SHARE;
    const stickers = Array.isArray(share?.stickers) ? share.stickers : [];
    return stickers.map(item => ({
        id: 'stk_boltp_' + item.id,
        name: item.name || '贴纸',
        url: item.url
    })).filter(item => item.url);
}

function ensureDefaultBoltpStickerPack(data) {
    data = data && typeof data === 'object' ? data : { packs: [] };
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const share = window.BYND_BOLTP_STICKER_SHARE;
    const stickers = buildBoltpStickerList();
    if (!share || !stickers.length) return data;
    const packName = share.name || '图床贴纸包';
    let pack = data.packs.find(item => item.id === 'pack_boltp_26c3884813ed4f4999b78e49d448f2e6')
        || data.packs.find(item => item.name === packName);
    if (!pack) {
        pack = {
            id: 'pack_boltp_26c3884813ed4f4999b78e49d448f2e6',
            name: packName,
            total: Number(share.total) || stickers.length,
            stickers
        };
        data.packs.unshift(pack);
        localStorage.setItem(STICKER_STORAGE_KEY, JSON.stringify(data));
        return data;
    }
    pack.stickers = Array.isArray(pack.stickers) ? pack.stickers : [];
    const existing = new Set(pack.stickers.map(item => item.url));
    const fresh = stickers.filter(item => !existing.has(item.url));
    if (fresh.length) {
        pack.stickers.push(...fresh);
        localStorage.setItem(STICKER_STORAGE_KEY, JSON.stringify(data));
    }
    pack.total = Math.max(Number(pack.total) || 0, Number(share.total) || stickers.length, pack.stickers.length);
    return data;
}

function isWechatStickerStoreOpen() {
    const screen = document.getElementById('wc-feature-screen');
    const title = document.getElementById('wc-feature-title')?.textContent || '';
    return !!screen && screen.classList.contains('active') && title === '表情';
}

function refreshStickerSurfaces() {
    const manager = document.getElementById('wc-sticker-manager');
    if (manager && !manager.classList.contains('hidden')) renderStickerPackList();

    const picker = document.getElementById('wc-sticker-picker');
    if (picker && !picker.classList.contains('hidden')) renderStickerPicker();

    if (isWechatStickerStoreOpen()) openWechatStickerStore();
}

// --- 表情选择器 ---
function openStickerPicker() {
    closeChatToolbar();
    const picker = document.getElementById('wc-sticker-picker');
    if (!picker) return;
    picker.classList.remove('hidden');
    renderStickerPicker();
}

function closeStickerPicker() {
    const picker = document.getElementById('wc-sticker-picker');
    if (picker) picker.classList.add('hidden');
}

function renderStickerPicker() {
    const data = getStickerPacks();
    const tabsEl = document.getElementById('wc-sticker-tabs');
    const gridEl = document.getElementById('wc-sticker-grid');
    if (!tabsEl || !gridEl) return;

    if (!data.packs || data.packs.length === 0) {
        tabsEl.innerHTML = '';
        gridEl.innerHTML = '<div style="text-align:center;color:#999;padding:40px;grid-column:1/-1;font-size:13px;">还没有贴纸包哦～<br>点右上角设置添加</div>';
        return;
    }

    const activeId = window._activeStickerPackId || data.packs[0].id;

    tabsEl.innerHTML = data.packs.map(p =>
        `<div class="wc-sticker-tab ${p.id === activeId ? 'active' : ''}" onclick="switchStickerPack('${p.id}')">${escapeHtml(p.name)}</div>`
    ).join('');

    const pack = data.packs.find(p => p.id === activeId) || data.packs[0];
    if (pack && pack.stickers.length > 0) {
        gridEl.innerHTML = pack.stickers.map(s =>
            `<img src="${s.url}" alt="${escapeHtml(s.name)}" title="${escapeHtml(s.name)}" onclick="sendSticker('${s.url.replace(/'/g, "\\'")}', '${escapeHtml(s.name).replace(/'/g, "\\'")}')" loading="lazy" onerror="this.style.opacity='0.3'">`
        ).join('');
    } else {
        gridEl.innerHTML = '<div style="text-align:center;color:#999;padding:40px;grid-column:1/-1;font-size:13px;">这个包里还没有贴纸</div>';
    }
}

function switchStickerPack(packId) {
    window._activeStickerPackId = packId;
    renderStickerPicker();
}

function sendSticker(url, name) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    const msg = { type: 'sticker', isMe: true, content: url, stickerName: name || '', timestamp: createMessageTimestamp() };
    if (!char.history) char.history = [];
    char.history.push(msg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);

    refreshChatView(char);
    closeStickerPicker();
    saveCharactersToStorage();
}

// --- 贴纸包管理器 ---
function openStickerManager() {
    closeChatToolbar();
    closeStickerPicker();
    const manager = document.getElementById('wc-sticker-manager');
    if (!manager) return;
    const root = getWechatModalRoot();
    if (root && manager.parentElement !== root) root.appendChild(manager);
    manager.classList.add('wc-sticker-manager-overlay');
    manager.style.display = 'flex';
    manager.style.zIndex = '3600';
    manager.classList.remove('hidden');
    renderStickerPackList();
}

function closeStickerManager() {
    const manager = document.getElementById('wc-sticker-manager');
    if (!manager) return;
    manager.classList.add('hidden');
    manager.style.display = '';
}

function renderStickerPackList() {
    const data = getStickerPacks();
    const listEl = document.getElementById('sticker-pack-list');
    if (!listEl) return;

    if (!data.packs || data.packs.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;color:#999;padding:30px;font-size:13px;">还没有贴纸包<br>点下面按钮创建一个吧</div>';
        return;
    }

    listEl.innerHTML = data.packs.map(p => `
        <div class="sticker-pack-item">
            <div class="sticker-pack-info">
                ${p.stickers.length > 0 ? `<img class="sticker-pack-preview" src="${p.stickers[0].url}" onerror="this.style.opacity='0.3'">` : '<div class="sticker-pack-preview"></div>'}
                <div>
                    <div class="sticker-pack-name">${escapeHtml(p.name)}</div>
                    <div class="sticker-pack-count">${p.stickers.length} 张贴纸</div>
                </div>
            </div>
            <div class="sticker-pack-actions">
                <i class="ri-add-line" onclick="openBatchImport('${p.id}')" title="导入"></i>
                <i class="ri-edit-line" onclick="openPackDetail('${p.id}')" title="管理"></i>
                <i class="ri-delete-bin-6-line del-btn" onclick="deleteStickerPack('${p.id}')" title="删除"></i>
            </div>
        </div>
    `).join('');
}

function createStickerPack() {
    openStickerPackCreateModal();
}

function ensureStickerPackCreateModal() {
    let modal = document.getElementById('wc-sticker-pack-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-sticker-pack-modal';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
    modal.innerHTML = `
        <div class="wc-compose-card wc-sticker-create-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i class="ri-emotion-happy-line"></i><span>新建贴纸包</span></div>
                <i class="ri-close-line" onclick="closeStickerPackCreateModal()"></i>
            </div>
            <div class="wc-compose-body">
                <label class="wc-compose-field">
                    <span>贴纸包名称</span>
                    <input id="wc-sticker-pack-name" type="text" maxlength="24" placeholder="例如：猫猫、撒娇、摸鱼">
                </label>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="closeStickerPackCreateModal()">取消</button>
                <button class="wc-compose-primary" onclick="confirmCreateStickerPack()">创建</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function openStickerPackCreateModal() {
    const modal = ensureStickerPackCreateModal();
    const input = document.getElementById('wc-sticker-pack-name');
    if (input) input.value = '';
    modal.classList.add('wc-sticker-submodal');
    modal.style.zIndex = '3800';
    modal.classList.remove('hidden');
    setTimeout(() => input?.focus(), 30);
}

function closeStickerPackCreateModal() {
    const modal = document.getElementById('wc-sticker-pack-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmCreateStickerPack() {
    const input = document.getElementById('wc-sticker-pack-name');
    const name = input ? input.value.trim() : '';
    if (!name) {
        if (input) input.focus();
        return;
    }
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const pack = { id: 'pack_' + Date.now(), name: name.trim(), stickers: [] };
    data.packs.push(pack);
    saveStickerPacks(data);
    window._wechatStickerImportPackId = pack.id;
    window._activeStickerPackId = pack.id;
    refreshStickerSurfaces();
    closeStickerPackCreateModal();
    if (typeof showWechatToast === 'function') showWechatToast('已新建贴纸包');
}

function deleteStickerPack(packId) {
    const data = getStickerPacks();
    const pack = data.packs.find(p => p.id === packId);
    if (!pack) return;
    if (!confirm(`确定删除「${pack.name}」吗？\n共 ${pack.stickers.length} 张贴纸`)) return;
    data.packs = data.packs.filter(p => p.id !== packId);
    saveStickerPacks(data);
    if (window._wechatStickerImportPackId === packId) window._wechatStickerImportPackId = data.packs[0]?.id || '';
    if (window._activeStickerPackId === packId) window._activeStickerPackId = data.packs[0]?.id || '';
    refreshStickerSurfaces();
}

// --- 批量导入 ---
function openBatchImport(packId) {
    window._importTargetPackId = packId;
    let modal = document.getElementById('wc-batch-import-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-batch-import-modal';
        modal.className = 'wc-modal-overlay hidden wc-sticker-submodal';
        modal.style.zIndex = '3800';
        modal.innerHTML = `
            <div class="wc-char-card" style="max-height:85%;display:flex;flex-direction:column;background:#fffcf8;border:1.5px solid rgba(248,164,184,0.25);border-radius:24px;">
                <div class="wc-card-header" style="border-bottom-color:rgba(248,164,184,0.15);">
                    <span style="color:#d4749a;font-weight:700;">批量导入贴纸</span>
                    <i class="ri-close-line" onclick="closeBatchImport()" style="color:#c9a0b5;cursor:pointer;"></i>
                </div>
                <div class="wc-card-body" style="overflow-y:auto;flex:1;align-items:stretch;gap:10px;">
                    <div class="wc-form-group">
                        <label style="font-size:12px;color:#888;">每行一个，支持多种格式</label>
                        <textarea id="sticker-import-text" class="sticker-import-textarea" rows="6"
                            placeholder="支持格式举例：&#10;开心：https://example.com/happy.png&#10;难过 https://example.com/sad.png&#10;https://example.com/plain.png&#10;名称——URL&#10;表情包：URL"></textarea>
                    </div>
                    <button onclick="previewBatchImport()" style="width:100%;height:36px;background:#f0ad4e;color:white;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">预览解析结果</button>
                    <div id="sticker-import-preview" class="sticker-import-preview"></div>
                    <div id="sticker-import-count" style="text-align:center;font-size:12px;color:#888;"></div>
                </div>
                <div style="padding:12px 16px;border-top:1px solid rgba(248,164,184,0.1);">
                    <button onclick="confirmBatchImport()" style="width:100%;height:40px;background:#07c160;color:white;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">确认导入</button>
                </div>
            </div>
        `;
        getWechatModalRoot().appendChild(modal);
    }
    document.getElementById('sticker-import-text').value = '';
    document.getElementById('sticker-import-preview').innerHTML = '';
    document.getElementById('sticker-import-count').textContent = '';
    window._parsedStickers = [];
    modal.classList.remove('hidden');
}

function closeBatchImport() {
    const modal = document.getElementById('wc-batch-import-modal');
    if (modal) modal.classList.add('hidden');
}

// 灵活格式解析器
function parseStickerBatchText(text) {
    const results = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;

    for (const line of lines) {
        const urls = line.match(urlRegex);
        if (!urls || urls.length === 0) continue;

        for (const url of urls) {
            let name = line.replace(url, '').trim();
            // 去除各种分隔符
            name = name
                .replace(/^[：:—\-–\s\t,，、|~～]+/, '')
                .replace(/[：:—\-–\s\t,，、|~～]+$/, '')
                .replace(/^表情(包)?[：:—\-–\s]*/, '')
                .replace(/[：:—\-–\s]*表情(包)?$/, '')
                .trim();

            if (!name) {
                const urlPath = url.split('/').pop().split('?')[0];
                name = urlPath.replace(/\.[^.]+$/, '') || '贴纸';
            }

            results.push({
                id: 'stk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                name: name,
                url: url
            });
        }
    }
    return results;
}

function previewBatchImport() {
    const text = document.getElementById('sticker-import-text').value;
    const parsed = parseStickerBatchText(text);
    window._parsedStickers = parsed;

    const previewEl = document.getElementById('sticker-import-preview');
    const countEl = document.getElementById('sticker-import-count');

    if (parsed.length === 0) {
        previewEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#f87171;font-size:13px;">未识别到有效 URL</div>';
        countEl.textContent = '';
        return;
    }

    previewEl.innerHTML = parsed.map(s =>
        `<img src="${s.url}" alt="${escapeHtml(s.name)}" title="${escapeHtml(s.name)}" loading="lazy" onerror="this.style.border='2px solid #f87171'">`
    ).join('');
    countEl.textContent = `识别到 ${parsed.length} 张贴纸`;
}

function confirmBatchImport() {
    const stickers = window._parsedStickers || [];
    if (stickers.length === 0) { alert('没有可导入的贴纸，请先粘贴链接并预览'); return; }

    const packId = window._importTargetPackId;
    const data = getStickerPacks();
    const pack = data.packs.find(p => p.id === packId);
    if (!pack) { alert('目标贴纸包不存在'); return; }

    pack.stickers.push(...stickers);
    saveStickerPacks(data);
    window._wechatStickerImportPackId = pack.id;
    window._activeStickerPackId = pack.id;
    closeBatchImport();
    refreshStickerSurfaces();
    alert(`成功导入 ${stickers.length} 张贴纸到「${pack.name}」`);
}

// --- 贴纸包详情（查看/批量删除） ---
function openPackDetail(packId) {
    const data = getStickerPacks();
    const pack = data.packs.find(p => p.id === packId);
    if (!pack) return;

    window._detailPackId = packId;
    const listEl = document.getElementById('sticker-pack-list');

    listEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <i class="ri-arrow-left-s-line" style="font-size:22px;cursor:pointer;" onclick="renderStickerPackList()"></i>
            <span style="font-size:16px;font-weight:600;">${escapeHtml(pack.name)}</span>
            <span style="color:#999;font-size:12px;">(${pack.stickers.length})</span>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:12px;">
            <button onclick="openBatchImport('${packId}')" style="flex:1;height:36px;background:#07c160;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                <i class="ri-add-line"></i> 导入
            </button>
            <button onclick="toggleDeleteMode()" id="stk-del-mode-btn" style="flex:1;height:36px;background:#ff6b6b;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                <i class="ri-delete-bin-6-line"></i> 批量删除
            </button>
        </div>
        <div id="pack-sticker-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
            ${pack.stickers.map(s => `
                <div class="pack-sticker-cell" data-stk-id="${s.id}" onclick="toggleStickerSelect(this)">
                    <img src="${s.url}" style="width:100%;aspect-ratio:1;object-fit:contain;border-radius:6px;background:#f5f5f5;" onerror="this.style.opacity='0.3'" loading="lazy">
                </div>
            `).join('')}
        </div>
        ${pack.stickers.length === 0 ? '<div style="text-align:center;color:#999;padding:30px;font-size:13px;">还没有贴纸</div>' : ''}
        <div id="stk-del-bar" class="hidden" style="margin-top:12px;text-align:center;">
            <button onclick="confirmDeleteStickers()" style="width:100%;height:36px;background:#ff3b30;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">删除选中的贴纸</button>
        </div>
    `;
}

function toggleStickerSelect(cell) {
    const bar = document.getElementById('stk-del-bar');
    if (bar && !bar.classList.contains('hidden')) {
        cell.classList.toggle('selected');
    }
}

function toggleDeleteMode() {
    const bar = document.getElementById('stk-del-bar');
    if (!bar) return;
    bar.classList.toggle('hidden');
    // 退出删除模式时清除选中
    if (bar.classList.contains('hidden')) {
        document.querySelectorAll('.pack-sticker-cell.selected').forEach(el => el.classList.remove('selected'));
    }
}

function confirmDeleteStickers() {
    const selected = document.querySelectorAll('.pack-sticker-cell.selected');
    if (selected.length === 0) { alert('请先点击选择要删除的贴纸'); return; }
    if (!confirm(`确定删除 ${selected.length} 张贴纸吗？`)) return;

    const idsToDelete = new Set(Array.from(selected).map(el => el.dataset.stkId));
    const data = getStickerPacks();
    const pack = data.packs.find(p => p.id === window._detailPackId);
    if (pack) {
        pack.stickers = pack.stickers.filter(s => !idsToDelete.has(s.id));
        saveStickerPacks(data);
        window._wechatStickerImportPackId = pack.id;
        window._activeStickerPackId = pack.id;
        refreshStickerSurfaces();
    }
    openPackDetail(window._detailPackId);
}
