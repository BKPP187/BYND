// --- 🛠️ regular.js: 正则脚本管理器 ---

// 预设的全局正则 (你可以自己加)
const globalRegexScripts = [
    { name: "Markdown 加粗优化", regex: "\\*\\*", replace: "<b>", placement: "Global" },
    { name: "去除多余空行", regex: "\\n\\n+", replace: "\\n", placement: "Global" }
];

let currentRegexTab = 'global'; // 当前标签页: 'global' 或 'local'
let selectedLocalCharId = null; // 当前查看的角色 ID

// 1. 初始化正则 App
function initRegexApp() {
    // 默认打开全局
    switchRegexTab('global');
}

// 2. 切换标签页
function switchRegexTab(tab) {
    currentRegexTab = tab;
    
    // 更新顶部按钮样式
    const tabs = document.querySelectorAll('.re-tab');
    if(tabs.length > 0) {
        tabs.forEach(t => t.classList.remove('active'));
        const activeBtn = document.querySelector(`.re-tab[data-tab="${tab}"]`);
        if(activeBtn) activeBtn.classList.add('active');
    }

    renderRegexContent();
}

// 3. 渲染内容区
function renderRegexContent() {
    const container = document.getElementById('re-content-area');
    if (!container) return;
    container.innerHTML = '';

    // --- A. 全局模式 ---
    if (currentRegexTab === 'global') {
        renderScriptList(container, globalRegexScripts, "全局脚本");
    } 
    // --- B. 局部模式 (角色专属) ---
    else {
        // 如果没有角色
        if (!window.myCharacters || window.myCharacters.length === 0) {
            container.innerHTML = `<div class="re-empty">请先在微信导入角色</div>`;
            return;
        }

        // 1. 渲染角色选择器 (类似酒馆顶部的头像栏)
        const charSelector = document.createElement('div');
        charSelector.className = 're-char-selector';
        
        // 默认选中第一个角色，或者之前选中的
        if (!selectedLocalCharId && window.myCharacters.length > 0) {
            selectedLocalCharId = window.myCharacters[0].id;
        }

        let avatarsHtml = '';
        window.myCharacters.forEach(char => {
            const isActive = char.id === selectedLocalCharId ? 'active' : '';
            avatarsHtml += `
                <img src="${char.avatar}" 
                     class="re-char-avatar ${isActive}" 
                     onclick="selectRegexChar('${char.id}')"
                     title="${char.name}">
            `;
        });
        charSelector.innerHTML = avatarsHtml;
        container.appendChild(charSelector);

        // 2. 获取当前选中角色的脚本
        const currentChar = window.myCharacters.find(c => c.id === selectedLocalCharId);
        if (currentChar) {
            const scripts = currentChar.regex || [];
            if (scripts.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 're-empty';
                emptyMsg.innerText = `${currentChar.name} 没有携带正则脚本`;
                container.appendChild(emptyMsg);
            } else {
                renderScriptList(container, scripts, `${currentChar.name} 的专属脚本`);
            }
        }
    }
}

// 4. 切换查看的角色
window.selectRegexChar = function(charId) {
    selectedLocalCharId = charId;
    renderRegexContent(); // 重新渲染
}

// 5. 通用：渲染脚本卡片列表
function renderScriptList(container, scripts, title) {
    // 标题
    const titleEl = document.createElement('div');
    titleEl.className = 're-list-title';
    titleEl.innerText = title;
    container.appendChild(titleEl);

    scripts.forEach(script => {
        // 兼容不同格式 (SillyTavern 格式 vs 简化格式)
        const name = script.scriptName || script.name || "未命名脚本";
        const regexStr = script.regex || "";
        const replaceStr = script.replace || "";
        const placement = script.placement ? `<span class="re-tag">${script.placement}</span>` : '';

        const card = document.createElement('div');
        card.className = 're-script-card';
        card.innerHTML = `
            <div class="re-card-header">
                <span class="re-name">${name}</span>
                ${placement}
            </div>
            <div class="re-code-row">
                <span class="re-label">Regex:</span>
                <code class="re-code">/${escapeHtml(regexStr)}/g</code>
            </div>
            <div class="re-code-row">
                <span class="re-label">Repl:</span>
                <code class="re-code">"${escapeHtml(replaceStr)}"</code>
            </div>
        `;
        container.appendChild(card);
    });
}

// 辅助：防止 HTML 注入
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}