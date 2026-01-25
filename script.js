document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initBattery();
    initDate();
    initLockScreen();
    initCalendar();
    initIconGrid();
    initTheme(); 
});

// --- 基础功能 ---
function initClock() {
    const timeEl = document.getElementById('clock-time-small');
    if (!timeEl) return;
    setInterval(() => {
        const now = new Date();
        timeEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }, 1000);
}

function initBattery() {
    const levelEl = document.getElementById('battery-level');
    const iconEl = document.getElementById('battery-icon');
    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            const update = () => {
                levelEl.textContent = `${Math.round(battery.level * 100)}%`;
                iconEl.className = battery.charging ? "ri-battery-2-charge-fill" : "ri-battery-fill";
            };
            update();
        });
    } else {
        levelEl.textContent = "100%";
    }
}

function initLockScreen() {
    const bigClock = document.getElementById('ls-big-clock');
    const updateTime = () => {
        const now = new Date();
        if(bigClock) bigClock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    };
    setInterval(updateTime, 1000);
    updateTime();
}

function initDate() {
    const dateEl = document.getElementById('ls-date');
    if (dateEl) dateEl.textContent = new Date().toDateString().slice(0, 10) + " ☁️ 24°";
}

function unlockPhone() {
    document.getElementById('lock-screen').classList.add('unlocked');
    document.getElementById('home-screen').classList.remove('hidden');
}

function initCalendar() {
    const dayNameEl = document.getElementById('cal-day-name');
    const dateNumEl = document.getElementById('cal-date-num');
    const monthNameEl = document.getElementById('cal-month-name');
    const gridEl = document.getElementById('cal-grid');

    if (!dateNumEl) return;

    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    dayNameEl.textContent = days[now.getDay()];
    dateNumEl.textContent = now.getDate();
    monthNameEl.textContent = months[now.getMonth()];

    gridEl.innerHTML = ''; 
    const today = now.getDate();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); 

    for (let i = 1; i <= totalDays; i++) {
        const dot = document.createElement('div');
        dot.className = 'cal-dot';
        dot.textContent = i;
        if (i === today) dot.classList.add('active');
        gridEl.appendChild(dot);
    }
}

function initIconGrid() {
    const container = document.getElementById('icon-grid-container');
    if (!container) return;

    const icons = [
        {i:'ri-wechat-line', n:'微信'}, {i:'ri-code-s-slash-line', n:'正则'}, 
        {i:'ri-book-read-line', n:'世界书'}, {i:'ri-settings-4-line', n:'设置'},
        {i:'ri-palette-line', n:'美化'}, {i:'ri-graduation-cap-line', n:'学习'},
        {i:'ri-money-cny-box-line', n:'记账'}, {i:'ri-gamepad-line', n:'Game'},
        {i:'ri-music-2-fill', n:'音乐'}, {i:'ri-safari-line', n:'浏览器'},
        {i:'ri-camera-lens-line', n:'相机'}, {i:'ri-question-mark', n:'说明'}
    ];

    let htmlContent = '';
    icons.forEach((item, index) => {
        htmlContent += `
            <div class="pretty-icon-item" onclick="document.getElementById('file-icon-${index}').click()">
                <div class="icon-preview" id="preview-icon-${index}">
                    <i class="${item.i}"></i>
                </div>
                <span class="icon-name">${item.n}</span>
                <input type="text" id="input-icon-${index}" style="display:none">
                <input type="file" id="file-icon-${index}" accept="image/*" style="display:none" onchange="convertFile(this, 'input-icon-${index}')">
            </div>
        `;
    });
    container.innerHTML = htmlContent;
}

// --- 🟢 微信动态角色系统 (正式版) ---

// 1. 角色数据库 (初始状态：完全空白！)
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
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200', 
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


// --- 统一的路由 ---
function openApp(appName) {
    if (appName === 'theme') {
        const win = document.getElementById('app-theme-window');
        if (win) { win.classList.remove('hidden'); setTimeout(() => win.classList.add('active'), 10); loadSavedSettings(); }
    } 
    else if (appName === 'wechat') {
        const win = document.getElementById('app-wechat-window');
        if (win) { 
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10);
            renderChatList(); // 渲染列表
        }
    } 
    else if (appName === 'preset') {
        alert("预设功能开发中... \n这里将配置正则和API！");
    } 
    else {
        alert("正在打开: " + appName);
    }
}

function closeApp(appName) {
    if (appName === 'theme') {
        const win = document.getElementById('app-theme-window');
        if (win) { win.classList.remove('active'); setTimeout(() => win.classList.add('hidden'), 300); }
    } 
    else if (appName === 'wechat') {
        const win = document.getElementById('app-wechat-window');
        if (win) { 
            win.classList.remove('active'); 
            setTimeout(() => win.classList.add('hidden'), 300);
            setTimeout(() => closeChat(), 300);
        }
    }
}

function convertFile(input, targetInputId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const inputEl = document.getElementById(targetInputId);
            inputEl.value = e.target.result;
            const previewId = targetInputId.replace('input-', 'preview-');
            const previewEl = document.getElementById(previewId);
            if(previewEl) previewEl.innerHTML = `<img src="${e.target.result}">`;
            inputEl.parentElement.style.background = "#fff0f3"; 
            inputEl.parentElement.style.borderColor = "#ffc2d1";
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function loadSavedSettings() {
    const data = JSON.parse(localStorage.getItem('my_theme_data'));
    if (!data) return;

    if (data.music) document.getElementById('input-music-text').value = data.music;
    if (data.vibe) document.getElementById('input-vibe-text').value = data.vibe;

    if (data.l1) document.getElementById('input-lock-img-1').value = data.l1;
    if (data.l2) document.getElementById('input-lock-img-2').value = data.l2;
    if (data.d1) document.getElementById('input-desk-img-1').value = data.d1;
    if (data.d2) document.getElementById('input-desk-img-2').value = data.d2;

    if (data.icons) {
        data.icons.forEach((url, index) => {
            const inputEl = document.getElementById('input-icon-' + index);
            if (inputEl) {
                inputEl.value = url;
                if(url && url.length > 0) {
                    const previewEl = document.getElementById('preview-icon-' + index);
                    if(previewEl) previewEl.innerHTML = `<img src="${url}">`;
                }
            }
        });
    }
}

function saveTheme() {
    const musicText = document.getElementById('input-music-text').value;
    const vibeText = document.getElementById('input-vibe-text').value; 
    
    const lockImg1 = document.getElementById('input-lock-img-1').value;
    const lockImg2 = document.getElementById('input-lock-img-2').value;
    const deskImg1 = document.getElementById('input-desk-img-1').value;
    const deskImg2 = document.getElementById('input-desk-img-2').value;

    if(musicText) {
        const marquee = document.querySelector('.music-pill marquee');
        if(marquee) marquee.textContent = musicText;
    }
    if(vibeText) {
        const vibeEl = document.getElementById('ls-vibe-text');
        if(vibeEl) vibeEl.textContent = vibeText;
    }
    if(lockImg1) document.querySelector('.user-img-1').src = lockImg1;
    if(lockImg2) document.querySelector('.user-img-2').src = lockImg2;
    if(deskImg1) document.querySelector('.desktop-img-1').src = deskImg1;
    
    const allDeskImgs = document.querySelectorAll('.photo-large img');
    if(allDeskImgs.length > 1 && deskImg2) {
        allDeskImgs[1].src = deskImg2;
    }

    const iconInputs = [];
    for(let i=0; i<12; i++) {
        const el = document.getElementById('input-icon-' + i);
        iconInputs.push(el ? el.value : "");
    }

    const desktopIcons = document.querySelectorAll('.apps-quad .app-icon');
    const dockIcons = document.querySelectorAll('.dock-item');

    iconInputs.forEach((url, index) => {
        if (!url) return; 

        if (index < 8) { 
            if (desktopIcons[index]) {
                desktopIcons[index].innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:cover;">`;
                desktopIcons[index].style.padding = "0";
                desktopIcons[index].style.background = "transparent";
            }
        } else { 
            const dockIndex = index - 8;
            if (dockIcons[dockIndex]) {
                const iconBox = dockIcons[dockIndex].querySelector('.dock-icon-box');
                if (iconBox) {
                    iconBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:10px; object-fit:cover;">`;
                }
            }
        }
    });

    const themeData = {
        music: musicText,
        vibe: vibeText, 
        l1: lockImg1, l2: lockImg2,
        d1: deskImg1, d2: deskImg2,
        icons: iconInputs
    };
    localStorage.setItem('my_theme_data', JSON.stringify(themeData));
    
    alert("设置已保存！");
    closeApp('theme');
}

function initTheme() {
    const data = JSON.parse(localStorage.getItem('my_theme_data'));
    if (!data) return;

    if(data.music) {
        const marquee = document.querySelector('.music-pill marquee');
        if(marquee) marquee.textContent = data.music;
    }
    if(data.vibe) {
        const vibeEl = document.getElementById('ls-vibe-text');
        if(vibeEl) vibeEl.textContent = data.vibe;
    }
    if(data.l1) document.querySelector('.user-img-1').src = data.l1;
    if(data.l2) document.querySelector('.user-img-2').src = data.l2;
    if(data.d1) document.querySelector('.desktop-img-1').src = data.d1;
    
    const allDeskImgs = document.querySelectorAll('.photo-large img');
    if(allDeskImgs.length > 1 && data.d2) {
        allDeskImgs[1].src = data.d2;
    }

    const desktopIcons = document.querySelectorAll('.apps-quad .app-icon');
    const dockIcons = document.querySelectorAll('.dock-item');
    
    if (data.icons) {
        data.icons.forEach((url, index) => {
            if (!url) return;
            if (index < 8 && desktopIcons[index]) {
                desktopIcons[index].innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:cover;">`;
                desktopIcons[index].style.padding = "0"; 
                desktopIcons[index].style.background = "transparent";
            } else if (index >= 8) {
                const dockIndex = index - 8;
                if(dockIcons[dockIndex]) {
                    const iconBox = dockIcons[dockIndex].querySelector('.dock-icon-box');
                    if (iconBox) {
                        iconBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:10px; object-fit:cover;">`;
                    }
                }
            }
        });
    }
}