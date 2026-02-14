// --- 🟢 wechat.js: 微信 & 酒馆角色系统 (完美适配版) ---

window.myCharacters = window.myCharacters || []; 
window.TEMP_PARSED_DATA = null;

// --- A. 界面渲染 ---

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
        
        let previewMsg = char.lastMsg || "";
        previewMsg = previewMsg.replace(/\{\{char\}\}/gi, char.name).replace(/\{\{user\}\}/gi, "我");

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

function processMsgContent(content, char) {
    if (!content) return "";
    let text = content;

    text = text.replace(/\{\{char\}\}/gi, char.name);
    text = text.replace(/\{\{user\}\}/gi, "我");

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
                
                // 处理 /abc/gim 格式
                if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
                    const lastSlash = pattern.lastIndexOf('/');
                    const flagStr = pattern.substring(lastSlash + 1);
                    flags = flagStr.replace(/[^gimsuy]/g, '');
                    pattern = pattern.substring(1, lastSlash);
                }

                const re = new RegExp(pattern, flags);

                // 酒馆语法 {{match}} 转 JS 语法 $&
                if (replaceStr && typeof replaceStr === 'string') {
                    replaceStr = replaceStr.replace(/\{\{match\}\}/gi, '$&');
                }

                text = text.replace(re, replaceStr);
            }
        } catch (e) {
            console.warn("正则执行失败:", script.name, e);
        }
    });

    text = text.replace(/\n/g, '<br>');
    return text;
}

function openChat(charId) {
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    document.getElementById('chat-room-title').textContent = char.name;
    const contentEl = document.getElementById('chat-room-content');
    contentEl.innerHTML = ''; 

    const wbCount = char.worldBook ? (Array.isArray(char.worldBook) ? char.worldBook.length : 0) : 0;
    const reCount = char.regex ? char.regex.length : 0;
    
    if (wbCount > 0 || reCount > 0) {
        const configDiv = document.createElement('div');
        configDiv.style.textAlign = 'center';
        configDiv.innerHTML = `
            <div class="chat-config-pill">
                <span><i class="ri-book-read-line"></i> 世界书: ${wbCount}</span>
                <span style="width:1px; height:10px; background:#ccc;"></span>
                <span><i class="ri-code-s-slash-line"></i> 正则: ${reCount}</span>
            </div>
        `;
        contentEl.appendChild(configDiv);
    }

    char.history.forEach(msg => {
        renderMessageBubble(contentEl, msg, char.avatar, char);
    });

    const room = document.getElementById('wechat-chat-room');
    room.classList.remove('hidden');
    setTimeout(() => room.classList.add('active'), 10);
}

function renderMessageBubble(container, msg, avatarUrl, charObj) {
    const row = document.createElement('div');
    const displayContent = processMsgContent(msg.content, charObj);

    row.className = `msg-row ${msg.isMe ? 'right' : 'left'}`;
    const myAvatar = 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&auto=format&fit=crop&q=60';
    const currentAvatar = msg.isMe ? myAvatar : avatarUrl;

    if (msg.isMe) {
        row.innerHTML = `<div class="msg-bubble green">${displayContent}</div><img class="msg-avatar" src="${currentAvatar}">`;
    } else {
        row.innerHTML = `<img class="msg-avatar" src="${currentAvatar}"><div class="msg-bubble">${displayContent}</div>`;
    }
    container.appendChild(row);
}

function closeChat() {
    const room = document.getElementById('wechat-chat-room');
    if (room) {
        room.classList.remove('active');
        setTimeout(() => room.classList.add('hidden'), 300);
    }
}

// --- B. PNG 解析器 (已适配 findRegex / replaceString) ---
const TavernCardParser = {
    decodeBase64ToUtf8: function(base64) {
        try {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) { return null; }
    },

    // 辅助：查找任意匹配的键值
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
                                
                                // 解包 extensions
                                let searchTargets = [raw];
                                if (raw.data) searchTargets.push(raw.data);
                                searchTargets.forEach(target => {
                                    if (target.extensions && typeof target.extensions === 'string') {
                                        try { target.extensions = JSON.parse(target.extensions); } catch(e) {}
                                    }
                                });

                                let rawScripts = [];

                                // 递归查找脚本数组
                                function findRegexArray(obj, depth = 0) {
                                    if (depth > 6 || !obj || typeof obj !== 'object') return null;
                                    
                                    // 优先匹配标准键
                                    const keys = Object.keys(obj);
                                    const scriptKey = keys.find(k => k.toLowerCase() === 'regex_scripts' || k.toLowerCase() === 'regexscripts');
                                    if (scriptKey && Array.isArray(obj[scriptKey])) return obj[scriptKey];
                                    
                                    // 遍历
                                    for (let key in obj) {
                                        if (['character_book', 'history', 'story_string'].includes(key)) continue;
                                        const val = obj[key];
                                        // 鸭子类型：检查数组元素是否包含 'findRegex' 或 'regex'
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

                                // 🔥 映射逻辑：加入 findRegex 和 replaceString
                                const normalizedScripts = rawScripts.map((s, idx) => {
                                    const get = (arr) => this.findField(s, arr) || "";
                                    
                                    return {
                                        name: get(['scriptName', 'name', 'label']) || `Script #${idx+1}`,
                                        // 这里加入了 findRegex
                                        regex: get(['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']), 
                                        // 这里加入了 replaceString
                                        replace: get(['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']),
                                        // 简单的位置判断
                                        placement: "Global"
                                    };
                                });

                                // 过滤无效项
                                const validScripts = normalizedScripts.filter(s => s.regex && s.regex.trim() !== "");

                                charData = {
                                    name: d.name,
                                    description: d.description,
                                    first_mes: d.first_mes,
                                    avatar: "", 
                                    worldBook: d.character_book?.entries || d.character_book || [],
                                    regex: validScripts 
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

// --- C. 交互系统 ---

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
                document.getElementById('modal-char-name').value = charData.name || "";
                document.getElementById('modal-char-intro').value = charData.first_mes || "";
                document.getElementById('modal-avatar-preview').src = evt.target.result;
                document.getElementById('modal-title').innerText = "解析成功";
                
                window.TEMP_PARSED_DATA = {
                    worldBook: charData.worldBook || [],
                    regex: charData.regex || []
                };

                const wbCount = window.TEMP_PARSED_DATA.worldBook.length;
                const reCount = window.TEMP_PARSED_DATA.regex.length;

                const infoHtml = `
                    <div style="color:#07c160; font-size:14px; margin-bottom:8px; font-weight:bold; display:flex; align-items:center; gap:5px;">
                        <i class="ri-check-double-line"></i> 数据提取成功
                    </div>
                    <div class="detected-tags">
                        ${wbCount > 0 ? `<div class="d-tag wb"><i class="ri-book-read-line"></i> WorldBook: ${wbCount}</div>` : ''}
                        ${reCount > 0 ? `<div class="d-tag re"><i class="ri-code-s-slash-line"></i> Regex: ${reCount}</div>` : ''}
                    </div>
                `;
                const infoBox = document.getElementById('parse-extra-info');
                if(infoBox) infoBox.innerHTML = infoHtml;

                document.getElementById('wc-char-modal').classList.remove('hidden');
                input.value = '';
            };
            imgReader.readAsDataURL(file);
        } catch (err) {
            console.error(err);
            alert("解析出错: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function confirmSaveCharacter() {
    const name = document.getElementById('modal-char-name').value;
    const intro = document.getElementById('modal-char-intro').value;
    const avatar = document.getElementById('modal-avatar-preview').src;
    if (!name) { alert("起个名字吧！"); return; }
    
    let wb = [];
    let re = [];
    if (window.TEMP_PARSED_DATA) {
        wb = window.TEMP_PARSED_DATA.worldBook || [];
        re = window.TEMP_PARSED_DATA.regex || [];
    }

    const newChar = {
        id: 'char_' + Date.now(),
        name: name,
        avatar: avatar || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&auto=format&fit=crop&q=60', 
        lastMsg: intro, 
        worldBook: wb,
        regex: re, 
        history: [{ type: 'text', isMe: false, content: intro }]
    };
    
    window.myCharacters.push(newChar);
    window.TEMP_PARSED_DATA = null;
    renderChatList();
    closeCharModal();
}