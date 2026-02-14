// --- 📖 WorldBook.js: 世界书系统 ---

// 1. 初始化/打开世界书 App
function initWorldBook() {
    const container = document.getElementById('wb-content-area');
    if (!container) return;
    container.innerHTML = ''; // 清空之前的内容

    // 如果没有任何角色，提示导入
    if (!window.myCharacters || window.myCharacters.length === 0) {
        container.innerHTML = `
            <div class="wb-empty">
                <i class="ri-book-3-line" style="font-size:48px; opacity:0.5;"></i>
                <p>图书馆是空的...</p>
                <span style="font-size:12px; color:#999;">请先在微信导入带世界书的角色卡</span>
            </div>`;
        return;
    }

    // 渲染“书架视图”
    renderBookshelf(container);
}

// 2. 渲染书架 (展示所有角色的书)
function renderBookshelf(container) {
    const shelf = document.createElement('div');
    shelf.className = 'wb-shelf';
    
    window.myCharacters.forEach(char => {
        const book = document.createElement('div');
        book.className = 'wb-book';
        book.onclick = () => renderBookDetail(char); // 点击进入详情
        
        // 统计条目数量
        const entryCount = (char.worldBook && char.worldBook.length > 0) ? char.worldBook.length : 0;
        // 只有有内容的才显示颜色，没内容的显示灰色
        const coverColor = entryCount > 0 ? stringToColor(char.name) : '#ccc';
        
        book.innerHTML = `
            <div class="wb-cover" style="background-color: ${coverColor}">
                <img src="${char.avatar}">
                ${entryCount === 0 ? '<i class="ri-lock-2-line" style="color:white; font-size:20px; z-index:2;"></i>' : ''}
            </div>
            <div class="wb-title">${char.name}</div>
            <div style="font-size:10px; color:#999;">${entryCount} 条目</div>
        `;
        shelf.appendChild(book);
    });
    container.appendChild(shelf);
}

// 3. 渲染书籍详情 (阅读界面)
function renderBookDetail(char) {
    const container = document.getElementById('wb-content-area');
    
    // 头部导航栏 + 内容区
    container.innerHTML = `
        <div class="wb-nav-bar">
            <i class="ri-arrow-left-line" onclick="initWorldBook()"></i>
            <span>${char.name} 的世界书</span>
            <span style="width:20px;"></span> </div>
        <div class="wb-detail-scroll">
            <div class="wb-entry-list">
                ${generateEntryHtml(char.worldBook)}
            </div>
        </div>
    `;
}

// 4. 生成条目 HTML (处理 V1/V2 格式兼容)
function generateEntryHtml(entries) {
    if (!entries || entries.length === 0) {
        return `<div class="wb-empty">这本书是空白的...<br>(该角色卡没有附带世界书)</div>`;
    }
    
    return entries.map(entry => {
        // 兼容不同的 key 字段名 (keys 或 key)
        let keys = entry.keys || entry.key || [];
        if (Array.isArray(keys)) keys = keys.join(", ");
        
        // 兼容不同的 content 字段名
        const content = entry.content || entry.entry || "";
        // 兼容不同的 comment 字段名
        const comment = entry.comment || entry.name || "未命名条目";

        return `
            <div class="wb-entry-card">
                <div class="wb-card-header">
                    <span class="wb-card-title">${comment}</span>
                    <i class="ri-eye-line" style="opacity:0.3;"></i>
                </div>
                ${keys ? `<div class="wb-keys">🔑 ${keys}</div>` : ''}
                <div class="wb-text">${content}</div>
            </div>
        `;
    }).join('');
}

// 辅助：给书皮生成一个随机的“复古色”
function stringToColor(str) {
    const colors = ['#5d4037', '#795548', '#8d6e63', '#3e2723', '#6d4c41', '#4e342e'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}