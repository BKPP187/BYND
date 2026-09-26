function sendWechatPoke(content = '') {
    closeChatToolbar();
    if (!content) {
        openWechatComposer('poke');
        return;
    }
    appendWechatMessage(syncWechatMessageDescription({
        type: 'poke',
        isMe: true,
        content,
        note: content,
        timestamp: createMessageTimestamp()
    }));
    triggerWechatScreenFeedback('poke');
}

function sendWechatScreenShake(content = '') {
    closeChatToolbar();
    if (!content) {
        openWechatComposer('screen_shake');
        return;
    }
    appendWechatMessage(syncWechatMessageDescription({
        type: 'screen_shake',
        isMe: true,
        content,
        note: content,
        timestamp: createMessageTimestamp()
    }));
    triggerWechatScreenFeedback('shake');
}

function sendWechatMusicCard(draft = null) {
    closeChatToolbar();
    if (!draft) {
        openWechatComposer('music_card');
        return;
    }
    appendWechatMessage(syncWechatMessageDescription({
        type: 'music_card',
        isMe: true,
        music: draft,
        title: draft.title,
        artist: draft.artist,
        url: draft.url,
        timestamp: createMessageTimestamp()
    }));
}

function drawWechatImageCover(ctx, img, targetWidth, targetHeight, fillStyle = '#f8fafc') {
    const sourceWidth = img.naturalWidth || img.width || targetWidth;
    const sourceHeight = img.naturalHeight || img.height || targetHeight;
    const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const drawX = (targetWidth - drawWidth) / 2;
    const drawY = (targetHeight - drawHeight) / 2;

    ctx.clearRect(0, 0, targetWidth, targetHeight);
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
    }
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

function compressWechatAvatarImage(img, size = 200, quality = 0.72) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    drawWechatImageCover(canvas.getContext('2d'), img, size, size);
    return canvas.toDataURL('image/jpeg', quality);
}

function ensureWechatAvatarCropperModal() {
    let modal = document.getElementById('wc-avatar-cropper-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-avatar-cropper-modal';
    modal.className = 'wc-modal-overlay hidden wc-avatar-cropper-overlay';
    modal.innerHTML = `
        <div class="wc-avatar-cropper-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i class="ri-crop-2-line"></i><span id="wc-avatar-crop-title">裁剪头像</span></div>
                <i class="ri-close-line" onclick="closeWechatAvatarCropper()"></i>
            </div>
            <div class="wc-avatar-cropper-body">
                <div class="wc-avatar-crop-stage" id="wc-avatar-crop-stage">
                    <img id="wc-avatar-crop-img" alt="">
                    <div class="wc-avatar-crop-grid"></div>
                </div>
                <div class="wc-avatar-crop-help" id="wc-avatar-crop-help">拖动图片调整位置，拉动缩放条裁出头像。</div>
                <label class="wc-avatar-crop-range">
                    <i class="ri-image-line"></i>
                    <input id="wc-avatar-crop-scale" type="range" min="1" max="4" step="0.01" value="1">
                    <i class="ri-image-2-line"></i>
                </label>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="resetWechatAvatarCropper()">重置</button>
                <button class="wc-compose-primary" id="wc-avatar-crop-confirm" onclick="confirmWechatAvatarCropper()">确认头像</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function getWechatAvatarCropperState() {
    window._wechatAvatarCropper = window._wechatAvatarCropper || {};
    return window._wechatAvatarCropper;
}

function clampWechatAvatarCropperOffset() {
    const state = getWechatAvatarCropperState();
    if (!state.img) return;
    const cropWidth = state.cropWidth || state.cropSize || 240;
    const cropHeight = state.cropHeight || state.cropSize || 240;
    const baseScale = Math.max(cropWidth / state.img.naturalWidth, cropHeight / state.img.naturalHeight);
    const drawW = state.img.naturalWidth * baseScale * state.zoom;
    const drawH = state.img.naturalHeight * baseScale * state.zoom;
    const maxX = Math.max(0, (drawW - cropWidth) / 2);
    const maxY = Math.max(0, (drawH - cropHeight) / 2);
    state.x = Math.max(-maxX, Math.min(maxX, state.x || 0));
    state.y = Math.max(-maxY, Math.min(maxY, state.y || 0));
}

function renderWechatAvatarCropper() {
    const state = getWechatAvatarCropperState();
    const imgEl = document.getElementById('wc-avatar-crop-img');
    const range = document.getElementById('wc-avatar-crop-scale');
    if (!state.img || !imgEl) return;
    clampWechatAvatarCropperOffset();
    const cropWidth = state.cropWidth || state.cropSize || 240;
    const cropHeight = state.cropHeight || state.cropSize || 240;
    const baseScale = Math.max(cropWidth / state.img.naturalWidth, cropHeight / state.img.naturalHeight);
    const drawW = state.img.naturalWidth * baseScale * state.zoom;
    const drawH = state.img.naturalHeight * baseScale * state.zoom;
    const left = (cropWidth - drawW) / 2 + (state.x || 0);
    const top = (cropHeight - drawH) / 2 + (state.y || 0);
    imgEl.style.width = `${drawW}px`;
    imgEl.style.height = `${drawH}px`;
    imgEl.style.transform = `translate(${left}px, ${top}px)`;
    if (range) range.value = String(state.zoom);
}

function bindWechatAvatarCropperEvents() {
    const stage = document.getElementById('wc-avatar-crop-stage');
    const range = document.getElementById('wc-avatar-crop-scale');
    if (!stage || stage.dataset.bound === '1') return;
    stage.dataset.bound = '1';
    stage.addEventListener('pointerdown', event => {
        const state = getWechatAvatarCropperState();
        state.dragging = true;
        state.startX = event.clientX;
        state.startY = event.clientY;
        state.originX = state.x || 0;
        state.originY = state.y || 0;
        stage.setPointerCapture?.(event.pointerId);
    });
    stage.addEventListener('pointermove', event => {
        const state = getWechatAvatarCropperState();
        if (!state.dragging) return;
        state.x = state.originX + event.clientX - state.startX;
        state.y = state.originY + event.clientY - state.startY;
        renderWechatAvatarCropper();
    });
    const stopDrag = () => {
        getWechatAvatarCropperState().dragging = false;
    };
    stage.addEventListener('pointerup', stopDrag);
    stage.addEventListener('pointercancel', stopDrag);
    stage.addEventListener('wheel', event => {
        event.preventDefault();
        const state = getWechatAvatarCropperState();
        state.zoom = Math.max(1, Math.min(4, (state.zoom || 1) + (event.deltaY > 0 ? -0.08 : 0.08)));
        renderWechatAvatarCropper();
    }, { passive: false });
    range?.addEventListener('input', () => {
        const state = getWechatAvatarCropperState();
        state.zoom = parseFloat(range.value) || 1;
        renderWechatAvatarCropper();
    });
}

function openWechatAvatarCropper(src, onConfirm, options = {}) {
    if (!src) return;
    const modal = ensureWechatAvatarCropperModal();
    const imgEl = document.getElementById('wc-avatar-crop-img');
    const stage = document.getElementById('wc-avatar-crop-stage');
    const title = document.getElementById('wc-avatar-crop-title');
    const help = document.getElementById('wc-avatar-crop-help');
    const confirm = document.getElementById('wc-avatar-crop-confirm');
    const img = new Image();
    img.onload = function() {
        const state = getWechatAvatarCropperState();
        const cropWidth = options.cropWidth || options.cropSize || 240;
        const cropHeight = options.cropHeight || options.cropSize || cropWidth;
        state.src = src;
        state.img = img;
        state.onConfirm = typeof onConfirm === 'function' ? onConfirm : null;
        state.outputSize = options.outputSize || 200;
        state.outputWidth = options.outputWidth || options.outputSize || 200;
        state.outputHeight = options.outputHeight || options.outputSize || state.outputWidth;
        state.quality = options.quality || 0.72;
        state.cropSize = Math.max(cropWidth, cropHeight);
        state.cropWidth = cropWidth;
        state.cropHeight = cropHeight;
        state.zoom = 1;
        state.x = 0;
        state.y = 0;
        if (imgEl) imgEl.src = src;
        if (stage) {
            stage.style.width = `${cropWidth}px`;
            stage.style.height = `${cropHeight}px`;
        }
        modal.classList.toggle('wc-cover-cropper-overlay', options.mode === 'cover');
        if (title) title.textContent = options.title || '裁剪头像';
        if (help) help.textContent = options.helpText || '拖动图片调整位置，拉动缩放条裁出头像。';
        if (confirm) confirm.textContent = options.confirmText || '确认头像';
        modal.classList.remove('hidden');
        bindWechatAvatarCropperEvents();
        renderWechatAvatarCropper();
    };
    img.src = src;
}

function closeWechatAvatarCropper() {
    const modal = document.getElementById('wc-avatar-cropper-modal');
    if (modal) modal.classList.add('hidden');
    const state = getWechatAvatarCropperState();
    state.dragging = false;
}

function resetWechatAvatarCropper() {
    const state = getWechatAvatarCropperState();
    state.zoom = 1;
    state.x = 0;
    state.y = 0;
    renderWechatAvatarCropper();
}

function confirmWechatAvatarCropper() {
    const state = getWechatAvatarCropperState();
    if (!state.img) return;
    clampWechatAvatarCropperOffset();
    const cropWidth = state.cropWidth || state.cropSize || 240;
    const cropHeight = state.cropHeight || state.cropSize || 240;
    const outputWidth = state.outputWidth || state.outputSize || 200;
    const outputHeight = state.outputHeight || state.outputSize || outputWidth;
    const baseScale = Math.max(cropWidth / state.img.naturalWidth, cropHeight / state.img.naturalHeight);
    const drawW = state.img.naturalWidth * baseScale * state.zoom;
    const drawH = state.img.naturalHeight * baseScale * state.zoom;
    const left = (cropWidth - drawW) / 2 + (state.x || 0);
    const top = (cropHeight - drawH) / 2 + (state.y || 0);
    const ratioX = outputWidth / cropWidth;
    const ratioY = outputHeight / cropHeight;
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(state.img, left * ratioX, top * ratioY, drawW * ratioX, drawH * ratioY);
    const result = canvas.toDataURL('image/jpeg', state.quality || 0.72);
    const callback = state.onConfirm;
    state.onConfirm = null;
    closeWechatAvatarCropper();
    if (callback) callback(result);
}

