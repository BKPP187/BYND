function openWechatMeSettings() {
    const profile = getUserProfile();
    openWechatFeatureScreen('设置', `
        <div class="wc-me-settings-page">
            <div class="wc-me-settings-card">
                <label class="wc-compose-field">
                    <span>头像 URL</span>
                    <input id="wc-me-set-avatar" value="${wcEscapeHtml(profile.avatar || '')}" placeholder="粘贴头像图床 URL">
                </label>
                <label class="wc-compose-field">
                    <span>昵称</span>
                    <input id="wc-me-set-name" value="${wcEscapeHtml(profile.name || '我')}" maxlength="24" placeholder="我">
                </label>
                <label class="wc-compose-field">
                    <span>微信号</span>
                    <input id="wc-me-set-id" value="${wcEscapeHtml(profile.wechatId || '')}" maxlength="32" placeholder="user_xxxxxx">
                </label>
                <label class="wc-compose-field">
                    <span>个性签名</span>
                    <textarea id="wc-me-set-signature" maxlength="120" placeholder="写一句签名">${wcEscapeHtml(profile.signature || '')}</textarea>
                </label>
                <label class="wc-compose-field">
                    <span>朋友圈封面 URL</span>
                    <input id="wc-me-set-cover" value="${wcEscapeHtml(profile.momentCover || '')}" placeholder="可留空，朋友圈顶部会使用默认背景">
                </label>
                <button class="wc-me-settings-save" onclick="saveWechatMeSettings()">保存</button>
            </div>
            <div class="wc-me-settings-links">
                <button onclick="openWechatUiThemeSettings()"><i class="ri-palette-line"></i><span>页面美化</span></button>
                <button onclick="openWechatFavorites()"><i class="ri-star-line"></i><span>收藏和笔记</span></button>
                <button onclick="openWechatMoments()"><i class="ri-image-2-line"></i><span>我的朋友圈</span></button>
                <button onclick="openWechatStickerStore()"><i class="ri-emotion-line"></i><span>表情包</span></button>
            </div>
        </div>
    `);
}

function saveWechatMeSettings() {
    const prev = getUserProfile();
    const profile = {
        ...prev,
        avatar: (document.getElementById('wc-me-set-avatar')?.value || '').trim(),
        name: (document.getElementById('wc-me-set-name')?.value || '').trim() || '我',
        wechatId: (document.getElementById('wc-me-set-id')?.value || '').trim() || prev.wechatId,
        signature: (document.getElementById('wc-me-set-signature')?.value || '').trim(),
        momentCover: (document.getElementById('wc-me-set-cover')?.value || '').trim()
    };
    saveUserProfile(profile);
    renderMePage();
    if (typeof syncWechatTelegramTabAvatar === 'function') syncWechatTelegramTabAvatar();
    showWechatToast('已保存');
}

function ensureWechatFeatureScreen() {
    let screen = document.getElementById('wc-feature-screen');
    if (screen) return screen;
    screen = document.createElement('div');
    screen.id = 'wc-feature-screen';
    screen.className = 'wc-feature-screen hidden';
    screen.innerHTML = `
        <div class="wc-feature-header">
            <i class="ri-arrow-left-s-line" onclick="closeWechatFeatureScreen()"></i>
            <span id="wc-feature-title"></span>
            <span id="wc-feature-action"></span>
        </div>
        <div class="wc-feature-body" id="wc-feature-body"></div>
    `;
    document.getElementById('app-wechat-window')?.appendChild(screen);
    return screen;
}

function openWechatFeatureScreen(title, html, actionHtml = '') {
    const screen = ensureWechatFeatureScreen();
    const backEl = screen.querySelector('.wc-feature-header > i');
    if (backEl) {
        backEl.className = 'ri-arrow-left-s-line';
        backEl.textContent = '';
        backEl.onclick = null;
        backEl.setAttribute('onclick', 'closeWechatFeatureScreen()');
    }
    document.getElementById('wc-feature-title').textContent = title;
    document.getElementById('wc-feature-action').innerHTML = actionHtml;
    document.getElementById('wc-feature-body').innerHTML = html;
    screen.classList.remove('hidden');
    screen.classList.add('active');
    requestAnimationFrame(() => screen.classList.add('active'));
}

function setWechatFeatureLeftText(text, handler) {
    const backEl = document.querySelector('#wc-feature-screen .wc-feature-header > i');
    if (!backEl) return;
    backEl.className = 'wc-feature-text-left';
    backEl.textContent = text;
    backEl.onclick = null;
    if (typeof handler === 'function') {
        backEl.removeAttribute('onclick');
        backEl.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            handler(event);
        };
    } else {
        backEl.setAttribute('onclick', handler);
    }
}

function closeWechatFeatureScreen() {
    const screen = document.getElementById('wc-feature-screen');
    if (!screen) return;
    screen.classList.remove('active');
    setTimeout(() => screen.classList.add('hidden'), 220);
}

