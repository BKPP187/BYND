// --- 🟢 wechat.js: 微信 & 酒馆角色系统 (修复清洗版) ---

// 1. 角色数据库
let myCharacters = []; 

// 2. 渲染聊天列表
function renderChatList() {
    const listEl = document.getElementById('wc-chat-list');
    if (!listEl) return;
    listEl.innerHTML = ''; 

    if (myCharacters.length === 0) {
        listEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; color:#ccc;">
                <i class="ri-chat-smile-2-line" style="font-size:48px; margin-bottom:10px;"></i>
                <span style="font-size:14px;">暂无消息</span>
                <span style="font-size:12px; margin-top:5px;">点击右上角 + 导入真实酒馆卡</span>
            </div>
        `;
        return;
    }

    myCharacters.forEach(char => {
        const item = document.createElement('div');
        item.className = 'wc-chat-item';
        item.onclick = () => openChat(char.id); 
        
        item.innerHTML = `
            <div class="wc-avatar"><img src="${char.avatar}"></div>
            <div class="wc-info">
                <div class="wc-top">
                    <span class="wc-name">${char.name}</span>
                    <span class="wc-time">刚刚</span>
                </div>
                <div class="wc-bottom">
                    <span class="wc-msg">${char.lastMsg.replace(/\{\{char\}\}/gi, char.name).replace(/\{\{user\}\}/gi, "我")}</span>
                </div>
            </div>
        `;
        listEl.appendChild(item);
    });
}

// 3. 打开聊天窗口
function openChat(charId) {
    const char = myCharacters.find(c => c.id === charId);
    if (!char) return;

    document.getElementById('chat-room-title').textContent = char.name;
    const contentEl = document.getElementById('chat-room-content');
    contentEl.innerHTML = ''; 

    // 显示配置胶囊
    if ((char.worldBook && char.worldBook.length > 0) || (char.regex && char.regex.length > 0)) {
        const wbCount = char.worldBook ? char.worldBook.length : 0;
        const reCount = char.regex ? char.regex.length : 0;
        
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

    // 渲染历史记录
    char.history.forEach(msg => {
        renderMessageBubble(contentEl, msg, char.avatar, char.name);
    });

    const room = document.getElementById('wechat-chat-room');
    room.classList.remove('hidden');
    setTimeout(() => room.classList.add('active'), 10);
}

// 4. 辅助：处理文本替换
function processMsgContent(content, charName) {
    if (!content) return "";
    let text = content;
    // 替换 {{char}} 为角色名
    text = text.replace(/\{\{char\}\}/gi, charName);
    text = text.replace(/\{\{user\}\}/gi, "我");
    // 替换 <br> 换行
    text = text.replace(/\n/g, '<br>');
    return text;
}

// 5. 渲染消息气泡
function renderMessageBubble(container, msg, avatarUrl, charName) {
    const row = document.createElement('div');
    
    // 处理文本替换
    const displayContent = processMsgContent(msg.content, charName);

    if (msg.type === 'regex') {
        row.className = 'msg-row center-regex';
        row.innerHTML = `
            <div class="regex-container-demo">
                <div style="border: 1px solid #ddd; background: #fff; padding: 12px; border-radius: 8px; font-size: 13px; color: #555; text-align: left; line-height: 1.6;">
                    ${displayContent}
                </div>
            </div>
        `;
    } else {
        row.className = `msg-row ${msg.isMe ? 'right' : 'left'}`;
        const myAvatar = 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&auto=format&fit=crop&q=60';
        const currentAvatar = msg.isMe ? myAvatar : avatarUrl;

        if (msg.isMe) {
            row.innerHTML = `<div class="msg-bubble green">${displayContent}</div><img class="msg-avatar" src="${currentAvatar}">`;
        } else {
            row.innerHTML = `<img class="msg-avatar" src="${currentAvatar}"><div class="msg-bubble">${displayContent}</div>`;
        }
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

// --- 🌟 强力 PNG 解析核心 ---
const TavernCardParser = {
    decodeBase64ToUtf8: function(base64) {
        try {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) {
            console.error("UTF-8 解码失败:", e);
            return null;
        }
    },

    parse: function(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        if (dataView.getUint32(0) !== 0x89504E47) throw new Error("不是有效的 PNG 图片");

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
                            const valueBase64 = decoder.decode(contentBytes.slice(nullIndex + 1));
                            jsonStr = this.decodeBase64ToUtf8(valueBase64);
                        } else {
                            const rawText = decoder.decode(contentBytes);
                            const jsonStartIndex = rawText.indexOf('eyJ'); 
                            if (jsonStartIndex > -1) {
                                const base64Str = rawText.slice(jsonStartIndex);
                                jsonStr = this.decodeBase64ToUtf8(base64Str);
                            }
                        }
                        
                        if (jsonStr) {
                            try { 
                                const raw = JSON.parse(jsonStr);
                                const dataRoot = raw.data || raw; 
                                charData = {
                                    name: dataRoot.name,
                                    description: dataRoot.description,
                                    personality: dataRoot.personality,
                                    scenario: dataRoot.scenario,
                                    first_mes: dataRoot.first_mes,
                                    mes_example: dataRoot.mes_example,
                                    character_book: dataRoot.character_book, 
                                    regex_scripts: (dataRoot.extensions && dataRoot.extensions.regex_scripts) ? dataRoot.extensions.regex_scripts : []
                                };
                            } catch(e) { console.error("JSON 解析错误", e); }
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

// --- 交互逻辑 ---

function testAddCharacter() { 
    document.getElementById('wc-action-sheet').classList.remove('hidden');
}
function hideActionSheet() {
    document.getElementById('wc-action-sheet').classList.add('hidden');
}
function triggerImport() {
    document.getElementById('import-card-file').click();
}

function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const readerURL = new FileReader();
        readerURL.onload = function(e) {
            const base64Avatar = e.target.result;
            const readerBuffer = new FileReader();
            
            readerBuffer.onload = function(bufEvent) {
                hideActionSheet();
                const arrayBuffer = bufEvent.target.result;
                try {
                    const parsedData = TavernCardParser.parse(arrayBuffer);
                    if (parsedData) {
                        openCharModal({
                            title: '解析成功',
                            name: parsedData.name || "未命名角色",
                            intro: parsedData.first_mes || parsedData.description || "...", 
                            avatar: base64Avatar,
                            rawWorldBook: parsedData.character_book,
                            rawRegex: parsedData.regex_scripts,
                            details: parsedData, 
                            isSuccess: true
                        });
                    } else {
                        alert("图片中未发现角色数据，已作为普通图片导入。");
                        openCreateModal(base64Avatar); 
                    }
                } catch (err) {
                    console.error(err);
                    alert("解析出错：" + err.message);
                    openCreateModal(base64Avatar);
                }
            };
            readerBuffer.readAsArrayBuffer(file);
        };
        readerURL.readAsDataURL(file);
        input.value = ''; 
    }
}

let tempAdvancedData = null;

function openCreateModal(avatarUrl = null) {
    hideActionSheet();
    openCharModal({
        title: '新建角色',
        name: '',
        avatar: avatarUrl || 'https://cdn-icons-png.flaticon.com/512/847/847969.png', 
        intro: '',
        isSuccess: false
    });
}

function openCharModal(data) {
    const modal = document.getElementById('wc-char-modal');
    const body = modal.querySelector('.wc-card-body');
    const oldTags = document.getElementById('detected-tags-area');
    if(oldTags) oldTags.remove();

    document.getElementById('modal-title').textContent = data.title;
    document.getElementById('modal-char-name').value = data.name;
    document.getElementById('modal-char-intro').value = data.intro;
    document.getElementById('modal-avatar-preview').src = data.avatar;
    
    if (data.isSuccess) {
        tempAdvancedData = {
            description: data.details?.description || "",
            scenario: data.details?.scenario || "",
            personality: data.details?.personality || "",
            worldBook: data.rawWorldBook || [],
            regex: data.rawRegex || [] 
        };

        const tagArea = document.createElement('div');
        tagArea.id = 'detected-tags-area';
        tagArea.className = 'detected-tags';
        
        let tagsHtml = `<div style="width:100%; font-size:12px; color:#07c160; margin-bottom:5px;">
            <i class="ri-check-double-line"></i> 数据提取成功
        </div>`;
        
        const wb = data.rawWorldBook;
        let wbCount = 0;
        if (wb && wb.entries) wbCount = wb.entries.length;
        
        const re = data.rawRegex;
        let reCount = re ? re.length : 0;

        if (wbCount > 0 || reCount > 0) {
             if(wbCount > 0) tagsHtml += `<span class="d-tag wb"><i class="ri-book-2-line"></i> WorldBook: ${wbCount}</span>`;
             if(reCount > 0) tagsHtml += `<span class="d-tag re"><i class="ri-code-s-slash-line"></i> Regex: ${reCount}</span>`;
        } else {
             tagsHtml += `<span class="d-tag" style="background:#f0f0f0; color:#999;">无附加数据</span>`;
        }
        
        tagArea.innerHTML = tagsHtml;
        body.appendChild(tagArea);
    } else {
        tempAdvancedData = null;
    }
    
    modal.classList.remove('hidden');
}

function closeCharModal() {
    document.getElementById('wc-char-modal').classList.add('hidden');
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

function confirmSaveCharacter() {
    const name = document.getElementById('modal-char-name').value;
    const intro = document.getElementById('modal-char-intro').value;
    const avatar = document.getElementById('modal-avatar-preview').src;
    
    if (!name) { alert("起个名字吧！"); return; }
    
    const newChar = {
        id: 'char_' + Date.now(),
        name: name,
        avatar: avatar,
        lastMsg: intro, 
        description: tempAdvancedData ? tempAdvancedData.description : "",
        scenario: tempAdvancedData ? tempAdvancedData.scenario : "",
        personality: tempAdvancedData ? tempAdvancedData.personality : "",
        worldBook: tempAdvancedData ? (tempAdvancedData.worldBook?.entries || []) : [],
        regex: tempAdvancedData ? (tempAdvancedData.regex || []) : [],
        history: [
            { type: 'text', isMe: false, content: intro } 
        ]
    };
    
    myCharacters.push(newChar);
    renderChatList();
    closeCharModal();
}