// --- 聊天背景集：内置角色自带几张，用户上传的也进这里，char 可用 [换背景:序号] 切换 ---
function renderWechatChatBgGallery(char) {
    const box = document.getElementById('wcs-bg-gallery');
    if (!box || !char) return;
    const config = char.chatConfig || {};
    const list = Array.isArray(config.chatBgGallery) ? config.chatBgGallery : [];
    const pending = window._tempChatBgImage || '';
    const current = pending || config.chatBgImage || '';
    box.innerHTML = list.map((url, i) => `
        <img class="wcs-bg-gallery-item ${url === current ? 'active' : ''}" src="${wcEscapeAttr(url)}" alt="聊天背景 ${i + 1}"
             onclick="selectWechatChatBg(${i})" oncontextmenu="event.preventDefault();removeWechatChatBg(${i})">
    `).join('') + (current && !list.includes(current) ? `<img class="wcs-bg-gallery-item active" src="${wcEscapeAttr(current)}" alt="当前背景">` : '');
    box.style.display = box.innerHTML.trim() ? '' : 'none';
    const clear = document.getElementById('wcs-bg-clear');
    if (clear) clear.style.display = current ? '' : 'none';
}

function selectWechatChatBg(index) {
    const char = getCurrentChatChar();
    const list = char?.chatConfig?.chatBgGallery;
    if (!char || !Array.isArray(list) || !list[index]) return;
    window._tempChatBgImage = list[index];
    document.getElementById('wcs-bg-img-hint').textContent = '已选择';
    renderWechatChatBgGallery(char);
}

function removeWechatChatBg(index) {
    const char = getCurrentChatChar();
    const list = char?.chatConfig?.chatBgGallery;
    if (!char || !Array.isArray(list) || !list[index]) return;
    const removed = list.splice(index, 1)[0];
    if (window._tempChatBgImage === removed) window._tempChatBgImage = null;
    if (char.chatConfig.chatBgImage === removed) { char.chatConfig.chatBgImage = list[0] || ''; applyChatConfig(char); }
    document.getElementById('wcs-bg-img-hint').textContent = (window._tempChatBgImage || char.chatConfig.chatBgImage) ? '已设置' : '未设置';
    saveCharactersToStorage();
    renderWechatChatBgGallery(char);
}

function clearWechatChatBg() {
    const char = getCurrentChatChar();
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    window._tempChatBgImage = null;
    char.chatConfig.chatBgImage = '';
    applyChatConfig(char);
    saveCharactersToStorage();
    document.getElementById('wcs-bg-img-hint').textContent = '未设置';
    renderWechatChatBgGallery(char);
}

function uploadChatBgImage(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxSide = 1600;
            const scale = Math.min(maxSide / Math.max(img.width, img.height), 1);
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            window._tempChatBgImage = canvas.toDataURL('image/jpeg', 0.9);
            document.getElementById('wcs-bg-img-hint').textContent = '已选择';
            const char = getCurrentChatChar();
            if (char) {
                char.chatConfig = char.chatConfig || {};
                if (!Array.isArray(char.chatConfig.chatBgGallery)) char.chatConfig.chatBgGallery = [];
                if (!char.chatConfig.chatBgGallery.includes(window._tempChatBgImage)) char.chatConfig.chatBgGallery.push(window._tempChatBgImage);
                renderWechatChatBgGallery(char);
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
}

function uploadUserAvatar(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        openWechatAvatarCropper(e.target.result, compressed => {
            document.getElementById('wcs-user-avatar').src = compressed;
        }, { outputSize: 200, quality: 0.7 });
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
}

function uploadCharAvatar(input) {
    if (!input.files || !input.files[0]) return;
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        openWechatAvatarCropper(e.target.result, compressed => {
            char.avatar = compressed;
            document.getElementById('wcs-char-avatar').src = compressed;
            saveCharactersToStorage();
            refreshChatView(char);
            renderChatList();
            const floatImg = document.getElementById('wc-float-avatar-img');
            if (floatImg) floatImg.src = compressed;
        }, { outputSize: 200, quality: 0.7 });
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
}

function compressWechatSettingsImage(file, maxWidth = 720, quality = 0.72, mimeType = 'image/jpeg') {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
        reader.onload = function(e) {
            const img = new Image();
            img.onerror = () => reject(new Error('图片加载失败'));
            img.onload = function() {
                const scale = Math.min(maxWidth / img.width, 1);
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL(mimeType, quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function updateWechatSettingsImagePreview(id, src, emptyText) {
    const img = document.getElementById(id);
    if (!img) return;
    const placeholder = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="36" fill="#eef2f7"/><path d="M48 98l22-24 17 16 12-12 25 25" fill="none" stroke="#9aa8ba" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="56" r="12" fill="#c8d1df"/></svg>');
    img.src = src || placeholder;
    img.classList.toggle('empty', !src);
    if (!src && emptyText) img.alt = emptyText;
}

async function uploadCharPortraitReference(input) {
    if (!input.files || !input.files[0]) return;
    const char = getCurrentChatChar();
    if (!char) return;
    try {
        const compressed = await compressWechatSettingsImage(input.files[0], 640, 0.76);
        char.chatConfig = char.chatConfig || {};
        char.chatConfig.imageReference = compressed;
        saveCharactersToStorage();
        updateWechatSettingsImagePreview('wcs-portrait-ref-preview', compressed, '未设置参考图');
    } finally {
        input.value = '';
    }
}

function clearCharPortraitReference() {
    const char = getCurrentChatChar();
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.imageReference = '';
    saveCharactersToStorage();
    updateWechatSettingsImagePreview('wcs-portrait-ref-preview', '', '未设置参考图');
}

async function uploadCharVideoCallBg(input) {
    if (!input.files || !input.files[0]) return;
    const char = getCurrentChatChar();
    if (!char) return;
    try {
        const compressed = await compressWechatSettingsImage(input.files[0], 900, 0.68);
        char.chatConfig = char.chatConfig || {};
        char.chatConfig.videoCallBg = compressed;
        saveCharactersToStorage();
        updateWechatSettingsImagePreview('wcs-video-bg-preview', compressed, '未设置视频通话背景');
        const hint = document.getElementById('wcs-video-bg-hint');
        if (hint) hint.textContent = '已设置视频通话背景';
    } finally {
        input.value = '';
    }
}

function clearCharVideoCallBg() {
    const char = getCurrentChatChar();
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.videoCallBg = '';
    saveCharactersToStorage();
    updateWechatSettingsImagePreview('wcs-video-bg-preview', '', '未设置视频通话背景');
    const hint = document.getElementById('wcs-video-bg-hint');
    if (hint) hint.textContent = '上传视频通话背景';
}

