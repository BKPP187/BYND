// --- 🍷 sillytavern.js: 酒馆专业版 App 逻辑 ---

// 1. 初始化酒馆：显示角色列表
function initSillyTavern() {
    const listEl = document.getElementById('st-char-list');
    const chatView = document.getElementById('st-chat-view');
    if (!listEl) return;
    
    // 重置视图
    listEl.classList.remove('hidden');
    chatView.classList.add('hidden');
    listEl.innerHTML = '';

    if (!window.myCharacters || window.myCharacters.length === 0) {
        listEl.innerHTML = `<div style="grid-column:span 2; text-align:center; padding-top:100px; color:#555;">暂无角色<br>请先在微信导入</div>`;
        return;
    }

    // 渲染酒馆风格的角色卡片
    window.myCharacters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'st-char-card';
        card.onclick = () => openTavernChat(char.id);
        card.innerHTML = `
            <img src="${char.avatar}" class="st-card-img">
            <div class="st-card-name">${char.name}</div>
        `;
        listEl.appendChild(card);
    });
}

// 2. 进入酒馆聊天室
function openTavernChat(charId) {
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    window.currentChatCharId = charId; // 绑定当前角色 (与微信共享状态)

    // 切换视图
    document.getElementById('st-char-list').classList.add('hidden');
    const chatView = document.getElementById('st-chat-view');
    chatView.classList.remove('hidden');

    const logEl = document.getElementById('st-chat-log');
    logEl.innerHTML = '';

    // 渲染历史记录 (使用酒馆风格)
    char.history.forEach((msg, index) => {
        // 第一条消息如果是角色发的，且有备选开场白，显示切换按钮
        const showControls = (index === 0 && !msg.isMe);
        renderTavernMessage(logEl, msg, char, showControls);
    });
    
    // 滚动到底部
    setTimeout(() => logEl.scrollTop = logEl.scrollHeight, 50);
}

// --- 🍷 sillytavern.js 修改部分 ---

// 3. 渲染单条酒馆消息 (支持动态开场白)
function renderTavernMessage(container, msg, charObj, showControls = false) {
    const row = document.createElement('div');
    row.className = 'st-msg-row';

    const myAvatar = 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&auto=format&fit=crop&q=60';
    const avatarSrc = msg.isMe ? myAvatar : charObj.avatar;
    const name = msg.isMe ? "You" : charObj.name;

    // 🔥 核心修改：如果是第一条消息(开场白)，不要读 msg.content，而是读当前选中的开场白
    let rawContent = msg.content;
    
    if (showControls) { // showControls 为 true 说明是第一条且是角色发的
        const allGreetings = [charObj.first_mes_original || charObj.first_mes, ...(charObj.alternates || [])].filter(t => t);
        const idx = charObj.currentGreetingIndex || 0;
        if (allGreetings[idx]) {
            rawContent = allGreetings[idx]; // 动态替换为当前选中的开场白
        }
    }

    // 调用通用处理函数
    let contentHtml = "";
    if (typeof processMsgContent === 'function') {
        contentHtml = processMsgContent(rawContent, charObj);
    } else {
        contentHtml = rawContent;
    }
    
    // 检测是否包含复杂的 HTML 标签
    const isRichCard = /<(div|style|script|table|iframe|img)/i.test(contentHtml);
    const contentClass = isRichCard ? "st-text-block raw-html" : "st-text-block";

    // 备选开场白切换器
    let controlsHtml = '';
    if (showControls && charObj.alternates && charObj.alternates.length > 0) {
        const current = (charObj.currentGreetingIndex || 0) + 1;
        const total = charObj.alternates.length + 1;
        controlsHtml = `
            <div style="font-size:12px; color:#666; margin-left: auto; display:flex; gap:10px;">
                <span onclick="switchGreetingTavern(-1)" style="cursor:pointer; color:#9f7aea; transition:0.2s;">◀ Prev</span>
                <span style="font-family:monospace;">${current}/${total}</span>
                <span onclick="switchGreetingTavern(1)" style="cursor:pointer; color:#9f7aea; transition:0.2s;">Next ▶</span>
            </div>
        `;
    }

    row.innerHTML = `
        <img src="${avatarSrc}" class="st-avatar">
        <div class="st-msg-content">
            <div class="st-name-label">
                ${name} 
                ${controlsHtml}
            </div>
            <div class="${contentClass}">${contentHtml}</div>
        </div>
    `;

    container.appendChild(row);

    // 激活脚本
    if (isRichCard && typeof executeScriptsInElement === 'function') {
        const block = row.querySelector('.st-text-block');
        if (block) executeScriptsInElement(block);
    }
}

// 4. 酒馆里的开场白切换
function switchGreetingTavern(direction) {
    // 调用 wechat.js 里的核心切换逻辑修改数据
    if (typeof switchGreeting === 'function') {
        switchGreeting(direction); 
    }
    // 重新打开当前聊天以刷新 Tavern 界面
    openTavernChat(window.currentChatCharId);
}