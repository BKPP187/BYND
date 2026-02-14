// --- 📖 WorldBook.js: 世界书系统 (列表视图 + 编辑修复版) ---

let currentReadingChar = null; 
let currentEntryIndex = -1; // 记录当前正在编辑哪一条

// 1. 初始化
function initWorldBook() {
    currentReadingChar = null;
    currentEntryIndex = -1;
    const container = document.getElementById('wb-content-area');
    if (!container) return;
    container.innerHTML = ''; 

    if (!window.myCharacters || window.myCharacters.length === 0) {
        container.innerHTML = `
            <div class="wb-empty">
                <i class="ri-book-3-line" style="font-size:48px; opacity:0.5;"></i>
                <p>图书馆是空的...</p>
                <span style="font-size:12px; color:#999;">点击右上角 + 创建第一本书</span>
            </div>`;
        return;
    }
    renderBookshelf(container);
}

// 2. 渲染书架
function renderBookshelf(container) {
    const shelf = document.createElement('div');
    shelf.className = 'wb-shelf';
    
    window.myCharacters.forEach(char => {
        const book = document.createElement('div');
        book.className = 'wb-book';
        book.onclick = () => renderBookDetail(char);
        
        const entryCount = (char.worldBook && char.worldBook.length > 0) ? char.worldBook.length : 0;
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

// 3. 渲染详情 (纯列表模式)
function renderBookDetail(char) {
    currentReadingChar = char; 
    const container = document.getElementById('wb-content-area');
    
    container.innerHTML = `
        <div class="wb-nav-bar">
            <i class="ri-arrow-left-line" onclick="initWorldBook()"></i>
            <span>${char.name} 的世界书</span>
            <i class="ri-add-circle-line" onclick="openCreateWBModal()" style="font-size:24px;"></i>
        </div>
        <div class="wb-detail-scroll">
            <div class="wb-list-container">
                ${generateListHtml(char.worldBook)}
            </div>
        </div>
    `;
}

// ✨ 生成紧凑列表 HTML
function generateListHtml(entries) {
    if (!entries || entries.length === 0) {
        return `<div class="wb-empty">这本书是空白的...<br>点击右上角 + 添加设定</div>`;
    }
    
    return entries.map((entry, index) => {
        // 兼容 keys 可能是数组或字符串
        let keys = entry.keys || entry.key || [];
        if (Array.isArray(keys)) keys = keys.join(", ");
        
        // 智能标题：优先显示 comment，没有则显示 keys
        let title = entry.comment || entry.name;
        if (!title || title.trim() === "") {
            title = keys.length > 0 ? keys : "未命名条目";
        }

        return `
            <div class="wb-list-item" onclick="openEntryDetail(${index})">
                <div class="wb-item-left">
                    <span class="wb-item-title">${title}</span>
                    <span class="wb-item-keys">🔑 ${keys}</span>
                </div>
                <div class="wb-item-right">
                    <i class="ri-edit-2-line" style="font-size:16px; color:#ccc;"></i>
                </div>
            </div>
        `;
    }).join('');
}

// 4. 打开详情编辑弹窗
function openEntryDetail(index) {
    if (!currentReadingChar || !currentReadingChar.worldBook[index]) return;
    
    currentEntryIndex = index; // 锁定当前编辑的索引
    const entry = currentReadingChar.worldBook[index];
    const modal = document.getElementById('wb-detail-modal');
    
    // 填充数据到弹窗
    let keys = entry.keys || entry.key || [];
    if (Array.isArray(keys)) keys = keys.join(", ");
    
    document.getElementById('wb-detail-key').value = keys;
    document.getElementById('wb-detail-content').value = entry.content || entry.entry || "";
    
    modal.classList.remove('hidden');
}

// ✨ 5. 保存编辑内容
function saveEntryDetail() {
    if (currentEntryIndex === -1 || !currentReadingChar) return;

    const keysStr = document.getElementById('wb-detail-key').value;
    const content = document.getElementById('wb-detail-content').value;
    
    // 更新内存数据
    const entry = currentReadingChar.worldBook[currentEntryIndex];
    entry.keys = keysStr.split(/,|，/).map(k => k.trim()).filter(k => k);
    entry.content = content;
    
    // 关闭弹窗并刷新列表
    closeWBDetailModal();
    renderBookDetail(currentReadingChar);
}

function closeWBDetailModal() {
    document.getElementById('wb-detail-modal').classList.add('hidden');
    currentEntryIndex = -1;
}

// 辅助函数
function stringToColor(str) {
    const colors = ['#5d4037', '#795548', '#8d6e63', '#3e2723', '#6d4c41', '#4e342e'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

// --- 新建书/条目逻辑 (保持不变) ---
function openCreateWBModal() {
    if (currentReadingChar) {
        document.getElementById('wb-new-key').value = '';
        document.getElementById('wb-new-content').value = '';
        document.getElementById('wb-add-entry-modal').classList.remove('hidden');
    } else {
        document.getElementById('wb-book-name').value = '';
        document.getElementById('wb-create-book-modal').classList.remove('hidden');
    }
}

function saveNewWBEntry() {
    const keysStr = document.getElementById('wb-new-key').value;
    const content = document.getElementById('wb-new-content').value;
    
    if (!content) { alert("内容不能为空！"); return; }
    
    const newEntry = {
        keys: keysStr.split(/,|，/).map(k => k.trim()).filter(k => k),
        content: content,
        comment: "手动添加条目",
        enabled: true
    };
    
    if (!currentReadingChar.worldBook) currentReadingChar.worldBook = [];
    currentReadingChar.worldBook.push(newEntry);
    
    document.getElementById('wb-add-entry-modal').classList.add('hidden');
    renderBookDetail(currentReadingChar); 
}

function confirmCreateBook() {
    const name = document.getElementById('wb-book-name').value;
    if (!name) { alert("书名不能为空！"); return; }

    const newChar = {
        id: 'char_' + Date.now(),
        name: name,
        avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        lastMsg: "...",
        worldBook: [],
        regex: [],
        history: []
    };

    window.myCharacters.push(newChar);
    document.getElementById('wb-create-book-modal').classList.add('hidden');
    initWorldBook(); 
}