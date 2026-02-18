// --- 🛠️ regular.js: 正则脚本管理器 (可编辑版) ---

window.globalRegexScripts = [
    { name: "Markdown 加粗", regex: "\\*\\*", replace: "<b>", placement: "Global" },
];

let currentRegexTab = 'global'; 
let selectedLocalCharId = null; 
let editingScriptIndex = -1; // 记录正在编辑哪一个

function initRegexApp() {
    switchRegexTab('global');
}

function switchRegexTab(tab) {
    currentRegexTab = tab;
    document.querySelectorAll('.re-tab').forEach(t => t.classList.remove('active'));
    const btn = document.querySelector(`.re-tab[data-tab="${tab}"]`);
    if(btn) btn.classList.add('active');
    renderRegexContent();
}

function renderRegexContent() {
    const container = document.getElementById('re-content-area');
    if (!container) return;
    container.innerHTML = '';

    if (currentRegexTab === 'global') {
        renderScriptList(container, window.globalRegexScripts, "全局脚本", true);
    } else {
        if (!window.myCharacters || window.myCharacters.length === 0) {
            container.innerHTML = `<div class="re-empty">请先在微信导入角色</div>`;
            return;
        }

        const charSelector = document.createElement('div');
        charSelector.className = 're-char-selector';
        
        if (!selectedLocalCharId && window.myCharacters.length > 0) {
            selectedLocalCharId = window.myCharacters[0].id;
        }

        window.myCharacters.forEach(char => {
            const isActive = char.id === selectedLocalCharId ? 'active' : '';
            charSelector.innerHTML += `
                <img src="${char.avatar}" 
                     class="re-char-avatar ${isActive}" 
                     onclick="selectRegexChar('${char.id}')">
            `;
        });
        container.appendChild(charSelector);

        const currentChar = window.myCharacters.find(c => c.id === selectedLocalCharId);
        if (currentChar) {
            const scripts = currentChar.regex || [];
            if (scripts.length === 0) {
                container.innerHTML += `<div class="re-empty">${currentChar.name} 无脚本<br><span onclick="openCreateRegexModal()" style="color:#07c160">新建</span></div>`;
            } else {
                renderScriptList(container, scripts, `${currentChar.name} 的脚本`, false);
            }
        }
    }
}

window.selectRegexChar = function(charId) {
    selectedLocalCharId = charId;
    renderRegexContent(); 
}

// ⚡️ 渲染列表 (加了 onclick 事件 + 开关)
function renderScriptList(container, scripts, title, isGlobal) {
    const titleEl = document.createElement('div');
    titleEl.className = 're-list-title';
    titleEl.innerText = title;
    container.appendChild(titleEl);

    scripts.forEach((script, index) => {
        if (typeof script.enabled === 'undefined') script.enabled = true;
        
        const name = script.name || "未命名";
        const regexStr = script.regex || "";
        const replaceStr = script.replace || "";
        const isOn = script.enabled !== false;
        
        const card = document.createElement('div');
        card.className = 're-script-card';
        card.style.opacity = isOn ? '1' : '0.5';
        
        card.innerHTML = `
            <div class="re-card-header">
                <span class="re-name" style="flex:1; cursor:pointer;">${name}</span>
                <label class="re-switch" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isOn ? 'checked' : ''} onchange="toggleRegexScript(${index}, ${isGlobal}, this.checked)">
                    <span class="re-slider"></span>
                </label>
            </div>
            <div class="re-code-row" onclick="openEditRegex(${index}, ${isGlobal})" style="cursor:pointer;">
                <span class="re-label">Re:</span>
                <code class="re-code">/${escapeHtml(regexStr.toString().substring(0, 30))}.../</code>
            </div>
        `;
        container.appendChild(card);
    });
}

// 🔥 开关切换
function toggleRegexScript(index, isGlobal, enabled) {
    let script;
    if (isGlobal) {
        script = window.globalRegexScripts[index];
    } else {
        const char = window.myCharacters.find(c => c.id === selectedLocalCharId);
        if (char && char.regex) script = char.regex[index];
    }
    if (script) {
        script.enabled = enabled;
    }
    renderRegexContent();
}

function escapeHtml(text) {
    if (!text) return "";
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

// --- 编辑/新建 逻辑 ---

function openCreateRegexModal() {
    editingScriptIndex = -1; // -1 代表新建
    document.getElementById('re-new-name').value = '';
    document.getElementById('re-new-regex').value = '';
    document.getElementById('re-new-repl').value = '';
    document.getElementById('re-add-modal').classList.remove('hidden');
}

// ⚡️ 打开编辑弹窗
function openEditRegex(index, isGlobal) {
    editingScriptIndex = index;
    // 找到对应的数据
    let script;
    if (isGlobal) script = window.globalRegexScripts[index];
    else {
        const char = window.myCharacters.find(c => c.id === selectedLocalCharId);
        script = char.regex[index];
    }

    document.getElementById('re-new-name').value = script.name;
    document.getElementById('re-new-regex').value = script.regex;
    document.getElementById('re-new-repl').value = script.replace;
    
    // 顺便把作用域选对
    document.getElementById('re-new-scope').value = isGlobal ? 'global' : 'local';
    toggleReCharSelect();
    
    document.getElementById('re-add-modal').classList.remove('hidden');
}

function saveNewRegex() {
    const scope = document.getElementById('re-new-scope').value;
    const name = document.getElementById('re-new-name').value;
    const regex = document.getElementById('re-new-regex').value;
    const repl = document.getElementById('re-new-repl').value;
    
    if (!regex) { alert("正则不能为空"); return; }

    const scriptData = {
        name: name,
        regex: regex,
        replace: repl,
        placement: scope === 'global' ? 'Global' : 'Character'
    };

    // 保存逻辑：新建 vs 更新
    if (scope === 'global') {
        if (editingScriptIndex > -1 && currentRegexTab === 'global') {
            window.globalRegexScripts[editingScriptIndex] = scriptData; // 更新
        } else {
            window.globalRegexScripts.push(scriptData); // 新增
        }
    } else {
        const charId = document.getElementById('re-new-char-select').value || selectedLocalCharId;
        const char = window.myCharacters.find(c => c.id === charId);
        if (char) {
            if (!char.regex) char.regex = [];
            if (editingScriptIndex > -1 && currentRegexTab === 'local') {
                char.regex[editingScriptIndex] = scriptData; // 更新
            } else {
                char.regex.push(scriptData); // 新增
            }
        }
    }
    
    document.getElementById('re-add-modal').classList.add('hidden');
    renderRegexContent();
}

// 辅助：切换下拉框显隐 (需要 HTML 配合)
window.toggleReCharSelect = function() {
    const scope = document.getElementById('re-new-scope').value;
    const charGroup = document.getElementById('re-char-select-group');
    const charSelect = document.getElementById('re-new-char-select');

    if (scope === 'local') {
        charGroup.classList.remove('hidden');
        charSelect.innerHTML = '';
        if (window.myCharacters && window.myCharacters.length > 0) {
            window.myCharacters.forEach(char => {
                const opt = document.createElement('option');
                opt.value = char.id;
                opt.innerText = char.name;
                charSelect.appendChild(opt);
            });
            if (selectedLocalCharId) charSelect.value = selectedLocalCharId;
        }
    } else {
        charGroup.classList.add('hidden');
    }
}