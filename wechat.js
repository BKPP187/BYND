// --- 🟢 wechat.js: 核心数据源 & 微信 App 逻辑 ---

// 1. 全局数据中心 (所有 App 共用)
window.myCharacters = window.myCharacters || []; 
window.TEMP_PARSED_DATA = null;
window.currentChatCharId = null;

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
                <span style="font-size:12px; margin-top:5px;">点击右上角 + 导入真实酒馆卡</span>
            </div>
        `;
        return;
    }

    window.myCharacters.forEach(char => {
        const item = document.createElement('div');
        item.className = 'wc-chat-item';
        item.onclick = () => openChat(char.id); 
        
        // 🔥 微信列表：强制隐藏内容，只显示名字和头像
        let previewMsg = ""; 

        item.innerHTML = `
            <div class="wc-avatar"><img src="${char.avatar}"></div>
            <div class="wc-info">
                <div class="wc-top">
                    <span class="wc-name">${char.name}</span>
                    <span class="wc-time">刚刚</span>
                </div>
                <div class="wc-bottom">
                    <span class="wc-msg">${previewMsg}</span>
                </div>
            </div>
        `;
        listEl.appendChild(item);
    });
}

// 🔥 通用工具：正则替换 + Markdown清洗 (供 Wechat 和 SillyTavern 共用)
function processMsgContent(content, char) {
    if (!content) return "";
    let text = content;

    text = text.replace(/\{\{char\}\}/gi, char.name);
    text = text.replace(/\{\{user\}\}/gi, "我");

    // 1. 执行正则脚本
    const globalScripts = window.globalRegexScripts || [];
    const charScripts = char.regex || [];
    const allScripts = [...globalScripts, ...charScripts];

    allScripts.forEach(script => {
        try {
            const regexStr = script.regex;
            let replaceStr = script.replace || "";
            if (regexStr) {
                let pattern = regexStr;
                let flags = 'g'; 
                if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
                    const lastSlash = pattern.lastIndexOf('/');
                    flags = pattern.substring(lastSlash + 1).replace(/[^gimsuy]/g, '');
                    pattern = pattern.substring(1, lastSlash);
                }
                const re = new RegExp(pattern, flags);
                if (replaceStr && typeof replaceStr === 'string') {
                    replaceStr = replaceStr.replace(/\{\{match\}\}/gi, '$&');
                }
                text = text.replace(re, replaceStr);
            }
        } catch (e) { console.warn("正则执行失败:", script.name, e); }
    });

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

    document.getElementById('chat-room-title').textContent = char.name;
    const contentEl = document.getElementById('chat-room-content');
    contentEl.innerHTML = ''; 

    char.history.forEach((msg, index) => {
        renderMessageBubble(contentEl, msg, char.avatar, char);
    });

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
    // 酒馆读取的是 currentGreetingIndex，所以酒馆会变。
    char.currentGreetingIndex = newIndex;
    
    // 注意：这里不再调用 openChat 刷新微信，因为微信不需要变
}

// 🔥 微信渲染逻辑：只显示纯文本 (Clean & Simple)
function renderMessageBubble(container, msg, avatarUrl, charObj) {
    const row = document.createElement('div');
    
    // 1. 获取原始内容
    let rawContent = processMsgContent(msg.content, charObj);
    
    // 2. ✂️ 暴力去除所有 HTML 标签，只保留文字
    let cleanText = rawContent.replace(/<[^>]+>/g, "").trim();
    
    if (!cleanText && rawContent.includes('<')) {
        cleanText = "📄 [交互式剧情卡片]";
    }

    row.className = `msg-row ${msg.isMe ? 'right' : 'left'}`;
    const myAvatar = 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&auto=format&fit=crop&q=60';
    const currentAvatar = msg.isMe ? myAvatar : avatarUrl;

    let bubbleHtml = '';
    
    if (msg.isMe) {
        bubbleHtml = `<div class="msg-bubble green">${cleanText}</div><img class="msg-avatar" src="${currentAvatar}">`;
    } else {
        bubbleHtml = `
            <img class="msg-avatar" src="${currentAvatar}">
            <div style="display:flex; flex-direction:column; max-width:70%;">
                <div class="msg-bubble">${cleanText}</div>
            </div>
        `;
    }
    
    row.innerHTML = bubbleHtml;
    container.appendChild(row);
}

// 🔥 通用工具：JS 脚本激活器 (供所有 App 使用)
function executeScriptsInElement(element) {
    const scripts = element.querySelectorAll('script');
    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
}

function closeChat() {
    const room = document.getElementById('wechat-chat-room');
    if (room) {
        room.classList.remove('active');
        setTimeout(() => room.classList.add('hidden'), 300);
    }
    window.currentChatCharId = null;
}

// --- B. PNG 解析器 ---
const TavernCardParser = {
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
    const sheet = document.getElementById('wc-action-sheet');
    if (sheet) sheet.classList.remove('hidden');
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
            const charData = TavernCardParser.parse(arrayBuffer);
            
            if (!charData) {
                alert("❌ 无法识别，请确保是 PNG 格式的酒馆卡");
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
                    first_mes_original: charData.first_mes 
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

// 1. 修复导入后酒馆不显示的问题
function confirmSaveCharacter() {
    const name = document.getElementById('modal-char-name').value;
    const intro = document.getElementById('modal-char-intro').value; 
    const avatar = document.getElementById('modal-avatar-preview').src;
    
    if (!name) { alert("起个名字吧！"); return; }
    
    let wb = [];
    let re = [];
    let alts = [];
    let originalFirst = "";
    
    if (window.TEMP_PARSED_DATA) {
        wb = window.TEMP_PARSED_DATA.worldBook || [];
        re = window.TEMP_PARSED_DATA.regex || [];
        alts = window.TEMP_PARSED_DATA.alternates || [];
        originalFirst = window.TEMP_PARSED_DATA.first_mes_original || intro;
    }

    const newChar = {
        id: 'char_' + Date.now(),
        name: name,
        avatar: avatar || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&auto=format&fit=crop&q=60', 
        lastMsg: intro, 
        worldBook: wb,
        regex: re, 
        alternates: alts,
        first_mes_original: originalFirst,
        currentGreetingIndex: 0,
        first_mes: intro,
        tavernHistory: [{ type: 'text', isMe: false, content: intro }],
        history: []
    };
    
    window.myCharacters.push(newChar);
    window.TEMP_PARSED_DATA = null;
    
    // 刷新微信列表
    renderChatList();
    
    // 🔥 新增：如果酒馆的初始化函数存在，强制刷新酒馆列表！
    if (typeof window.initSillyTavern === 'function') {
        window.initSillyTavern();
    }
    
    // 🔥 压缩头像后保存到本地存储
    compressAndSaveCharacters();
    
    closeCharModal();
}

// --- D. 本地存储：角色数据持久化 ---

function saveCharactersToStorage() {
    try {
        const data = window.myCharacters.map(char => ({
            id: char.id,
            name: char.name,
            avatar: char._smallAvatar || char.avatar || '',
            lastMsg: char.lastMsg,
            worldBook: char.worldBook || [],
            regex: char.regex || [],
            alternates: char.alternates || [],
            first_mes_original: char.first_mes_original || '',
            first_mes: char.first_mes || '',
            currentGreetingIndex: char.currentGreetingIndex || 0,
            tavernHistory: char.tavernHistory || [],
            history: char.history || []
        }));
        const jsonStr = JSON.stringify(data);
        localStorage.setItem('my_characters_data', jsonStr);
        console.log("✅ 角色数据已保存，大小:", (jsonStr.length / 1024).toFixed(1) + "KB");
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            try {
                const data = window.myCharacters.map(char => ({
                    id: char.id, name: char.name, avatar: '',
                    lastMsg: char.lastMsg, worldBook: [], regex: char.regex || [],
                    alternates: char.alternates || [],
                    first_mes_original: char.first_mes_original || '',
                    first_mes: char.first_mes || '',
                    currentGreetingIndex: char.currentGreetingIndex || 0,
                    tavernHistory: char.tavernHistory || [], history: char.history || []
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
            if (typeof window.initSillyTavern === 'function') {
                window.initSillyTavern();
            }
        }
    } catch (e) {
        console.error("加载角色数据失败:", e);
    }
}