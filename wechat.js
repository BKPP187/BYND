// --- 🟢 wechat.js: 微信功能模块 ---

// 1. 角色数据库 (初始状态：完全空白)
let myCharacters = []; 

// 2. 渲染聊天列表
function renderChatList() {
    const listEl = document.getElementById('wc-chat-list');
    if (!listEl) return;
    
    listEl.innerHTML = ''; 

    // 空状态提示
    if (myCharacters.length === 0) {
        listEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; color:#ccc;">
                <i class="ri-chat-smile-2-line" style="font-size:48px; margin-bottom:10px;"></i>
                <span style="font-size:14px;">还没有添加角色</span>
                <span style="font-size:12px; margin-top:5px;">点击右上角 + 号导入或新建</span>
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
                    <span class="wc-msg">${char.lastMsg}</span>
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

    char.history.forEach(msg => {
        renderMessageBubble(contentEl, msg, char.avatar);
    });

    const room = document.getElementById('wechat-chat-room');
    room.classList.remove('hidden');
    setTimeout(() => room.classList.add('active'), 10);
}

// 4. 渲染消息气泡
function renderMessageBubble(container, msg, avatarUrl) {
    const row = document.createElement('div');
    
    if (msg.type === 'regex') {
        row.className = 'msg-row center-regex';
        row.innerHTML = `
            <div class="regex-container-demo">
                <div style="border: 1px solid #ddd; background: #fff; padding: 12px; border-radius: 8px; font-size: 13px; color: #555; text-align: left; line-height: 1.6;">
                    ${msg.content.replace(/\n/g, '<br>')}
                </div>
            </div>
        `;
    } else {
        row.className = `msg-row ${msg.isMe ? 'right' : 'left'}`;
        const myAvatar = 'https://images.unsplash.com/photo-1620662736427-b8a198f52a4d?w=200&auto=format&fit=crop&q=60';
        const currentAvatar = msg.isMe ? myAvatar : avatarUrl;

        if (msg.isMe) {
            row.innerHTML = `<div class="msg-bubble green">${msg.content}</div><img class="msg-avatar" src="${currentAvatar}">`;
        } else {
            row.innerHTML = `<img class="msg-avatar" src="${currentAvatar}"><div class="msg-bubble">${msg.content}</div>`;
        }
    }
    container.appendChild(row);
}

// 5. 关闭聊天
function closeChat() {
    const room = document.getElementById('wechat-chat-room');
    if (room) {
        room.classList.remove('active');
        setTimeout(() => room.classList.add('hidden'), 300);
    }
}

// 6. 交互逻辑 (Action Sheet & Import)

function testAddCharacter() { // 点击右上角+
    const sheet = document.getElementById('wc-action-sheet');
    sheet.classList.remove('hidden');
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
        const reader = new FileReader();
        
        reader.onload = function(e) {
            hideActionSheet();
            let guessName = file.name.replace(/\.[^/.]+$/, "");
            openCharModal({
                title: '导入角色确认',
                name: guessName,
                avatar: e.target.result,
                intro: '你好，我是' + guessName + '。' 
            });
            input.value = '';
        };
        reader.readAsDataURL(file);
    }
}

function openCreateModal() {
    hideActionSheet();
    openCharModal({
        title: '新建角色',
        name: '',
        // 这里换了一个默认头像占位符
        avatar: 'https://cdn-icons-png.flaticon.com/512/847/847969.png', 
        intro: ''
    });
}

function openCharModal(data) {
    const modal = document.getElementById('wc-char-modal');
    document.getElementById('modal-title').textContent = data.title;
    document.getElementById('modal-char-name').value = data.name;
    document.getElementById('modal-char-intro').value = data.intro;
    document.getElementById('modal-avatar-preview').src = data.avatar;
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
        history: [{ type: 'text', isMe: false, content: intro }]
    };
    
    myCharacters.push(newChar);
    renderChatList();
    closeCharModal();
}