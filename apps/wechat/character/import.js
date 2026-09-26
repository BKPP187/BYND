// --- C. 交互与导入系统 ---

function testAddCharacter() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="triggerImport()"><i class="ri-file-upload-line" style="color: #07c160;"></i><span>导入角色卡 (PNG)</span><input type="file" id="import-card-file" accept="image/*" style="display:none" onchange="handleFileSelect(this)"></div>
        <div class="wc-sheet-item" onclick="openCreateModal()"><i class="ri-user-add-line" style="color: #2b2b2b;"></i><span>手动新建角色</span></div>
        <div class="wc-sheet-item" onclick="hideActionSheet();ByndBuiltinLibrary?.open()"><i class="ri-star-smile-line" style="color: #e0a800;"></i><span>内置角色库</span></div>
    `);
}

function showWechatActionSheet(contentHtml) {
    const sheet = document.getElementById('wc-action-sheet');
    if (!sheet) return;
    sheet.innerHTML = `
        <div class="wc-sheet-content">
            ${contentHtml}
            <div class="wc-sheet-cancel" onclick="hideActionSheet()">取消</div>
        </div>
    `;
    sheet.classList.remove('hidden');
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
            openWechatAvatarCropper(e.target.result, cropped => {
                document.getElementById('modal-avatar-preview').src = cropped;
            }, { outputSize: 200, quality: 0.72 });
        };
        reader.readAsDataURL(input.files[0]);
        input.value = '';
    }
}

function handleFileSelect(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const arrayBuffer = e.target.result;
            const charData = CharacterCardParser.parse(arrayBuffer);
            
            if (!charData) {
                alert("❌ 无法识别，请确保是 PNG 格式的角色卡");
                return;
            }

            const imgReader = new FileReader();
            imgReader.onload = function(evt) {
                const origSrc = evt.target.result;
                document.getElementById('modal-char-name').value = charData.name || "";
                document.getElementById('modal-char-intro').value = charData.first_mes || "";
                document.getElementById('modal-avatar-preview').src = "";
                document.getElementById('modal-title').innerText = "解析成功";
                
                window.TEMP_PARSED_DATA = {
                    worldBook: charData.worldBook || [],
                    regex: charData.regex || [],
                    alternates: charData.alternates || [],
                    first_mes_original: charData.first_mes,
                    description: charData.description || ''
                };

                const altCount = window.TEMP_PARSED_DATA.alternates.length;
                const infoHtml = `
                    <div style="color:#07c160; font-size:14px; margin-bottom:8px; font-weight:bold; display:flex; align-items:center; gap:5px;">
                        <i class="ri-check-double-line"></i> 数据提取成功
                    </div>
                    <div class="detected-tags">
                        ${altCount > 0 ? `<div class="d-tag" style="background:#e8eaf6; color:#3f51b5;"><i class="ri-chat-history-line"></i> 备选开场: ${altCount}</div>` : ''}
                    </div>
                `;
                const infoBox = document.getElementById('parse-extra-info');
                if(infoBox) infoBox.innerHTML = infoHtml;

                document.getElementById('wc-char-modal').classList.remove('hidden');
                openWechatAvatarCropper(origSrc, cropped => {
                    document.getElementById('modal-avatar-preview').src = cropped;
                }, { outputSize: 200, quality: 0.72 });
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

// --- 🟢 wechat.js 修改部分 ---

function confirmSaveCharacter() {
    const name = document.getElementById('modal-char-name').value;
    const intro = document.getElementById('modal-char-intro').value; 
    const avatar = document.getElementById('modal-avatar-preview').src;
    
    if (!name) { alert("起个名字吧！"); return; }
    
    let wb = [];
    let re = [];
    let alts = [];
    let originalFirst = "";
    let desc = "";

    if (window.TEMP_PARSED_DATA) {
        wb = window.TEMP_PARSED_DATA.worldBook || [];
        re = window.TEMP_PARSED_DATA.regex || [];
        alts = window.TEMP_PARSED_DATA.alternates || [];
        originalFirst = window.TEMP_PARSED_DATA.first_mes_original || intro;
        desc = window.TEMP_PARSED_DATA.description || "";
    }

    const newChar = {
        id: 'char_' + Date.now(),
        name: name,
        description: desc,
        avatar: avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 200 200%27%3E%3Cdefs%3E%3ClinearGradient id=%27bg%27 x1=%270%27 y1=%270%27 x2=%271%27 y2=%271%27%3E%3Cstop offset=%270%25%27 stop-color=%27%23f8c8dc%27/%3E%3Cstop offset=%27100%25%27 stop-color=%27%23d4a5f5%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%27200%27 height=%27200%27 rx=%27100%27 fill=%27url(%23bg)%27/%3E%3Ccircle cx=%27100%27 cy=%2780%27 r=%2735%27 fill=%27%23fff%27 opacity=%270.9%27/%3E%3Cellipse cx=%27100%27 cy=%27155%27 rx=%2750%27 ry=%2735%27 fill=%27%23fff%27 opacity=%270.9%27/%3E%3Ccircle cx=%2788%27 cy=%2775%27 r=%274%27 fill=%27%23555%27/%3E%3Ccircle cx=%27112%27 cy=%2775%27 r=%274%27 fill=%27%23555%27/%3E%3Cpath d=%27M92 90 Q100 98 108 90%27 stroke=%27%23e88%27 stroke-width=%272.5%27 fill=%27none%27 stroke-linecap=%27round%27/%3E%3C/svg%3E',
        lastMsg: '',
        worldBook: wb,
        regex: re,
        alternates: alts,
        first_mes_original: originalFirst,
        currentGreetingIndex: 0,
        first_mes: intro,
        chatConfig: {},
        history: []
    };
    
    window.myCharacters.push(newChar);
    window.TEMP_PARSED_DATA = null;
    
    renderChatList();

    // 🔥 压缩头像后保存到本地存储
    compressAndSaveCharacters();
    
    closeCharModal();
}

