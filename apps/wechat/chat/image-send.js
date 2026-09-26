// ========== 图片发送 ==========

function triggerCamera() {
    document.getElementById('wc-camera-input').click();
    closeChatToolbar();
}

function triggerImagePick() {
    document.getElementById('wc-image-input').click();
    closeChatToolbar();
}

function handleCameraCapture(input) {
    if (!input.files || !input.files[0]) return;
    processAndSendImage(input.files[0]);
    input.value = '';
}

function handleImagePick(input) {
    if (!input.files || !input.files[0]) return;
    const files = Array.from(input.files || []).filter(file => file && /^image\//i.test(file.type)).slice(0, 18);
    if (files.length <= 1) {
        processAndSendImage(files[0] || input.files[0]);
    } else {
        processAndSendImageStack(files);
    }
    input.value = '';
}

function compressWechatImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxDim = 960;
            let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
            if (w > maxDim || h > maxDim) {
                const scale = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            canvas.width = w;
            canvas.height = h;
            const context = canvas.getContext('2d');
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            context.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.84));
        };
            img.onerror = () => reject(new Error('image decode failed'));
        img.src = e.target.result;
    };
        reader.onerror = () => reject(new Error('image read failed'));
        reader.readAsDataURL(file);
    });
}

function processAndSendImage(file) {
    if (!file) return;
    compressWechatImageFile(file).then(sendImageMessage).catch(() => showWechatToast('图片读取失败'));
}

async function processAndSendImageStack(files) {
    const urls = [];
    for (const file of files) {
        try {
            urls.push(await compressWechatImageFile(file));
        } catch (_) {}
    }
    if (!urls.length) {
        showWechatToast('图片读取失败');
        return;
    }
    if (urls.length === 1) sendImageMessage(urls[0]);
    else sendImageStackMessage(urls);
}

function sendImageMessage(imageUrl) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    if (isWechatQQGroupSpeechMuted(char)) {
        showWechatToast('当前群已开启全员禁言');
        return;
    }

    const userMsg = { type: 'image', isMe: true, content: imageUrl, imageUrl, description: '[用户发送了一张图片]', timestamp: createMessageTimestamp() };
    if (!char.history) char.history = [];
    char.history.push(userMsg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    notifyWechatMonitors(char, userMsg);

    refreshChatView(char);
    saveCharactersToStorage();
    renderChatList();
}

function sendImageStackMessage(imageUrls) {
    const images = (Array.isArray(imageUrls) ? imageUrls : []).map(item => String(item || '').trim()).filter(Boolean).slice(0, 18);
    if (!images.length) return;
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    if (isWechatQQGroupSpeechMuted(char)) {
        showWechatToast('当前群已开启全员禁言');
        return;
    }

    const userMsg = {
        type: 'image_stack',
        isMe: true,
        content: images[0],
        imageUrl: images[0],
        images,
        description: `[用户发送了 ${images.length} 张图片]`,
        timestamp: createMessageTimestamp()
    };
    if (!char.history) char.history = [];
    char.history.push(userMsg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    notifyWechatMonitors(char, userMsg);

    refreshChatView(char);
    saveCharactersToStorage();
    renderChatList();
}

