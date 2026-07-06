// Regex script manager

const GLOBAL_REGEX_STORAGE_KEY = 'my_global_regex_scripts';

function loadGlobalRegexFromStorage() {
    try {
        const raw = localStorage.getItem(GLOBAL_REGEX_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
        console.warn('全局正则规则读取失败，使用默认规则', e);
        return null;
    }
}

function saveGlobalRegexToStorage() {
    try {
        localStorage.setItem(GLOBAL_REGEX_STORAGE_KEY, JSON.stringify(window.globalRegexScripts || []));
    } catch (e) {
        console.warn('全局正则规则保存失败', e);
    }
}
window.saveGlobalRegexToStorage = saveGlobalRegexToStorage;

window.globalRegexScripts = loadGlobalRegexFromStorage() || window.globalRegexScripts || [
    { name: "Markdown 加粗", regex: "\\*\\*(.*?)\\*\\*", replace: "<b>$1</b>", placement: "Global", enabled: true },
];

let currentRegexTab = 'global';
let selectedLocalCharId = null;
let editingScriptIndex = -1;

function getRegexCharId(char, index) {
    if (char && char.id != null && String(char.id).trim()) return String(char.id);
    return `idx-${index}`;
}

function findRegexCharById(charId) {
    const chars = Array.isArray(window.myCharacters) ? window.myCharacters : [];
    return chars.find((char, index) => getRegexCharId(char, index) === String(charId));
}

function initRegexApp() {
    window.currentRegexTab = currentRegexTab;
    window.selectedLocalCharId = selectedLocalCharId;
    switchRegexTab(currentRegexTab || 'global');
}

function switchRegexTab(tab) {
    currentRegexTab = tab === 'local' ? 'local' : 'global';
    window.currentRegexTab = currentRegexTab;
    document.querySelectorAll('.re-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentRegexTab));
    renderRegexContent();
}

function renderRegexContent() {
    const container = document.getElementById('re-content-area');
    if (!container) return;
    container.innerHTML = '';

    if (currentRegexTab === 'global') {
        renderScriptList(container, window.globalRegexScripts, '全局规则', true);
        return;
    }

    const chars = Array.isArray(window.myCharacters) ? window.myCharacters : [];
    if (!chars.length) {
        container.innerHTML = `
            <div class="re-empty">
                <i class="ri-user-search-line"></i>
                <strong>还没有可配置的角色</strong>
                <span>先在微信里导入角色卡，再回来给某个角色单独设置正则。</span>
            </div>
        `;
        return;
    }

    if (!selectedLocalCharId || !chars.some((char, index) => getRegexCharId(char, index) === String(selectedLocalCharId))) {
        selectedLocalCharId = getRegexCharId(chars[0], 0);
    }
    selectedLocalCharId = String(selectedLocalCharId);
    window.selectedLocalCharId = selectedLocalCharId;

    const selector = document.createElement('div');
    selector.className = 're-char-selector';
    selector.innerHTML = chars.map((char, index) => {
        const charId = getRegexCharId(char, index);
        return `
        <button type="button" class="re-char-pill ${charId === String(selectedLocalCharId) ? 'active' : ''}" data-char-id="${escapeAttr(charId)}">
            <img src="${escapeAttr(char.avatar || '')}" onerror="this.style.opacity='0.35'">
            <span>${escapeHtml(char.name || '角色')}</span>
        </button>
    `}).join('');
    selector.addEventListener('click', (event) => {
        const btn = event.target.closest('.re-char-pill');
        if (!btn) return;
        event.preventDefault();
        selectRegexChar(btn.dataset.charId || '');
    });
    container.appendChild(selector);

    const currentChar = findRegexCharById(selectedLocalCharId);
    const scripts = currentChar && Array.isArray(currentChar.regex) ? currentChar.regex : [];
    renderScriptList(container, scripts, `${currentChar?.name || '角色'} 的规则`, false);
}

window.selectRegexChar = function(charId) {
    if (!findRegexCharById(charId)) return;
    selectedLocalCharId = String(charId);
    window.selectedLocalCharId = selectedLocalCharId;
    renderRegexContent();
};

function renderScriptList(container, scripts, title, isGlobal) {
    const safeScripts = Array.isArray(scripts) ? scripts : [];
    const enabledCount = safeScripts.filter(script => script.enabled !== false).length;
    const scopeText = isGlobal ? '所有聊天都会尝试套用' : '只作用在当前角色的消息';

    const head = document.createElement('div');
    head.className = 're-list-head';
    head.innerHTML = `
        <div>
            <span>${escapeHtml(title)}</span>
            <em>${enabledCount}/${safeScripts.length} 启用</em>
        </div>
        <small>${scopeText}</small>
    `;
    container.appendChild(head);

    if (!safeScripts.length) {
        const empty = document.createElement('div');
        empty.className = 're-empty';
        empty.innerHTML = `
            <i class="ri-code-s-slash-line"></i>
            <strong>这里还没有规则</strong>
            <span>新建一条规则，用来隐藏、替换或渲染 AI 输出里的固定格式。</span>
            <button onclick="openCreateRegexModal()">新建规则</button>
        `;
        container.appendChild(empty);
        return;
    }

    safeScripts.forEach((script, index) => {
        if (typeof script.enabled === 'undefined') script.enabled = true;

        const name = script.name || '未命名规则';
        const regexStr = script.regex || '';
        const replaceStr = script.replace || '';
        const isOn = script.enabled !== false;

        const card = document.createElement('div');
        card.className = `re-script-card ${isOn ? '' : 'disabled'}`;
        card.innerHTML = `
            <div class="re-card-header">
                <div class="re-title-group" onclick="openEditRegex(${index}, ${isGlobal})">
                    <strong>${escapeHtml(name)}</strong>
                    <span>${isGlobal ? 'Global' : 'Character'}</span>
                </div>
                <label class="re-switch" onclick="event.stopPropagation()" title="${isOn ? '关闭' : '启用'}">
                    <input type="checkbox" ${isOn ? 'checked' : ''} onchange="toggleRegexScript(${index}, ${isGlobal}, this.checked)">
                    <span class="re-slider"></span>
                </label>
            </div>
            <div class="re-code-stack" onclick="openEditRegex(${index}, ${isGlobal})">
                <div class="re-code-row">
                    <span>匹配</span>
                    <code>${escapeHtml(shortenRegex(regexStr))}</code>
                </div>
                <div class="re-code-row">
                    <span>替换</span>
                    <code>${escapeHtml(shortenRegex(replaceStr || '删除匹配内容'))}</code>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function toggleRegexScript(index, isGlobal, enabled) {
    let script;
    if (isGlobal) {
        script = window.globalRegexScripts[index];
    } else {
        const char = findRegexCharById(selectedLocalCharId);
        if (char && Array.isArray(char.regex)) script = char.regex[index];
    }
    if (script) script.enabled = enabled;
    if (isGlobal) saveGlobalRegexToStorage();
    if (!isGlobal && typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    renderRegexContent();
}

function openCreateRegexModal() {
    editingScriptIndex = -1;
    const modal = document.getElementById('re-add-modal');
    document.getElementById('re-new-name').value = '';
    document.getElementById('re-new-regex').value = '';
    document.getElementById('re-new-repl').value = '';
    document.getElementById('re-new-scope').value = currentRegexTab === 'local' ? 'local' : 'global';
    toggleReCharSelect();
    const title = document.getElementById('re-modal-title');
    if (title) title.textContent = '新建规则';
    modal.classList.remove('hidden');
}

function openEditRegex(index, isGlobal) {
    editingScriptIndex = index;
    let script;
    if (isGlobal) {
        script = window.globalRegexScripts[index];
    } else {
        const char = findRegexCharById(selectedLocalCharId);
        script = char && Array.isArray(char.regex) ? char.regex[index] : null;
    }
    if (!script) return;

    document.getElementById('re-new-name').value = script.name || '';
    document.getElementById('re-new-regex').value = script.regex || '';
    document.getElementById('re-new-repl').value = script.replace || '';
    document.getElementById('re-new-scope').value = isGlobal ? 'global' : 'local';
    toggleReCharSelect();
    const title = document.getElementById('re-modal-title');
    if (title) title.textContent = '编辑规则';
    document.getElementById('re-add-modal').classList.remove('hidden');
}

function saveNewRegex() {
    const scope = document.getElementById('re-new-scope').value === 'local' ? 'local' : 'global';
    const name = document.getElementById('re-new-name').value.trim() || '未命名规则';
    const regex = document.getElementById('re-new-regex').value.trim();
    const repl = document.getElementById('re-new-repl').value;

    if (!regex) {
        alert('正则不能为空');
        return;
    }

    try {
        new RegExp(regex);
    } catch (err) {
        alert('正则格式不正确：' + err.message);
        return;
    }

    const scriptData = {
        name,
        regex,
        replace: repl,
        enabled: true,
        placement: scope === 'global' ? 'Global' : 'Character'
    };

    if (scope === 'global') {
        if (editingScriptIndex > -1 && currentRegexTab === 'global') {
            window.globalRegexScripts[editingScriptIndex] = {
                ...window.globalRegexScripts[editingScriptIndex],
                ...scriptData
            };
        } else {
            window.globalRegexScripts.push(scriptData);
        }
        saveGlobalRegexToStorage();
    } else {
        const charId = document.getElementById('re-new-char-select').value || selectedLocalCharId;
        const char = findRegexCharById(charId);
        if (!char) return;
        if (!Array.isArray(char.regex)) char.regex = [];
        if (editingScriptIndex > -1 && currentRegexTab === 'local' && getRegexCharId(char, (window.myCharacters || []).indexOf(char)) === String(selectedLocalCharId)) {
            char.regex[editingScriptIndex] = {
                ...char.regex[editingScriptIndex],
                ...scriptData
            };
        } else {
            char.regex.push(scriptData);
        }
        selectedLocalCharId = getRegexCharId(char, (window.myCharacters || []).indexOf(char));
        window.selectedLocalCharId = selectedLocalCharId;
    }

    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    document.getElementById('re-add-modal').classList.add('hidden');
    switchRegexTab(scope);
}

window.toggleReCharSelect = function() {
    const scope = document.getElementById('re-new-scope').value;
    const charGroup = document.getElementById('re-char-select-group');
    const charSelect = document.getElementById('re-new-char-select');
    if (!charGroup || !charSelect) return;

    if (scope === 'local') {
        charGroup.classList.remove('hidden');
        charSelect.innerHTML = '';
        (window.myCharacters || []).forEach((char, index) => {
            const opt = document.createElement('option');
            opt.value = getRegexCharId(char, index);
            opt.textContent = char.name || '角色';
            charSelect.appendChild(opt);
        });
        if (selectedLocalCharId) charSelect.value = selectedLocalCharId;
    } else {
        charGroup.classList.add('hidden');
    }
};

function shortenRegex(text) {
    const value = String(text || '');
    return value.length > 78 ? value.slice(0, 76) + '...' : value;
}

function quoteRegexJsString(value) {
    return JSON.stringify(String(value || ''));
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(text) {
    return escapeHtml(text).replace(/`/g, '&#96;');
}
