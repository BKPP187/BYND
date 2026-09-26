function getWechatAiPhoneClockParts() {
    const now = new Date();
    return {
        time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        date: now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })
    };
}

function getWechatAiPhoneAllApps() {
    return [
        { key: 'chat', label: '微信', icon: 'ri-wechat-fill', tone: 'green' },
        { key: 'memo', label: '备忘录', icon: 'ri-sticky-note-fill', tone: 'yellow' },
        { key: 'schedule', label: '行程', icon: 'ri-calendar-check-fill', tone: 'blue' },
        { key: 'shopping', label: '购物', icon: 'ri-shopping-bag-3-fill', tone: 'orange' },
        { key: 'takeout', label: '外卖', icon: 'ri-restaurant-2-fill', tone: 'green' },
        { key: 'games', label: '游戏', icon: 'ri-gamepad-fill', tone: 'purple' },
        { key: 'browser', label: '浏览器', icon: 'ri-safari-fill', tone: 'blue' },
        { key: 'wallet', label: '钱包', icon: 'ri-wallet-3-fill', tone: 'black' },
        { key: 'diary', label: '日记', icon: 'ri-book-2-fill', tone: 'pink' },
        { key: 'footprints', label: '足迹', icon: 'ri-map-pin-time-fill', tone: 'purple' },
        { key: 'usage', label: '使用记录', icon: 'ri-history-fill', tone: 'gray' },
        { key: 'clock', label: '时钟', icon: 'ri-time-fill', tone: 'orange' },
        { key: 'settings', label: '设置', icon: 'ri-settings-3-fill', tone: 'gray' }
    ];
}

function getWechatAiPhoneApps(char = null, snapshot = null) {
    return getWechatAiPhoneAllApps().filter(app => app.key !== 'games' || shouldWechatAiPhoneShowGames(char, snapshot));
}

function getWechatAiPhoneAppMeta(tabName, char = null, snapshot = null) {
    return getWechatAiPhoneApps(char, snapshot).find(app => app.key === tabName)
        || getWechatAiPhoneAllApps().find(app => app.key === tabName)
        || getWechatAiPhoneAllApps()[0];
}

function renderWechatAiPhoneAppIcon(app, char) {
    const source = getWechatAiPhoneHomeSettings(char).icons[app.key];
    return `<span class="wc-ai-phone-icon-image"><i class="${app.icon}"></i>${source ? `<img src="${wcEscapeAttr(source)}" alt="" onerror="this.remove()">` : ''}</span>`;
}

function renderWechatAiPhoneAppButton(app, char) {
    return `
        <button type="button" class="wc-ai-phone-app-icon tone-${app.tone}" onclick="switchWechatAiPhoneTab('${app.key}')" aria-label="${wcEscapeAttr(app.label)}">
            ${renderWechatAiPhoneAppIcon(app, char)}
            <b>${wcEscapeHtml(app.label)}</b>
        </button>
    `;
}

function getWechatAiPhoneHomeSettings(char) {
    const raw = char && char.chatConfig && char.chatConfig.aiPhoneHomeSettings;
    const safe = raw && typeof raw === 'object' ? raw : {};
    const validImage = value => {
        const source = String(value || '').trim();
        return /^(?:data:image\/|blob:|https?:\/\/)/i.test(source) ? source : '';
    };
    const photos = Array.isArray(safe.photos) ? safe.photos : [];
    const icons = {};
    getWechatAiPhoneAllApps().forEach(app => {
        const source = validImage(safe.icons && safe.icons[app.key]);
        if (source) icons[app.key] = source;
    });
    return {
        avatar: validImage(safe.avatar),
        wallpaper: validImage(safe.wallpaper),
        photos: Array.from({ length: 4 }, (_, index) => validImage(photos[index])),
        icons
    };
}

function getWechatAiPhoneHomeAvatar(char) {
    const settings = getWechatAiPhoneHomeSettings(char);
    const avatar = settings.avatar || getWechatCharAvatarSource(char, DEFAULT_AVATAR);
    return /^(?:data:image\/|blob:|https?:\/\/|\/|\.\.?\/)/i.test(String(avatar || '').trim())
        ? avatar
        : DEFAULT_AVATAR;
}

function renderWechatAiPhonePhotoSlot(source, className, label, editIndex = null) {
    if (Number.isInteger(editIndex)) {
        const action = `${source ? '更换' : '添加'}${label}`;
        return `
            <span class="${className} is-editing${source ? '' : ' is-empty'}" data-photo-index="${editIndex}">
                <button type="button" class="wc-ai-phone-photo-pick" onclick="this.nextElementSibling.click()" aria-label="${wcEscapeAttr(action)}" title="${wcEscapeAttr(action)}">
                    ${source ? `<img src="${wcEscapeAttr(source)}" alt="">` : '<i class="ri-image-add-line"></i>'}
                </button>
                <input type="file" accept="image/*" onchange="uploadWechatAiPhoneHomePhoto(this, ${editIndex})" tabindex="-1" aria-hidden="true">
                ${source ? `<button type="button" class="wc-ai-phone-photo-remove" onclick="clearWechatAiPhoneHomePhoto(${editIndex})" aria-label="清除${wcEscapeAttr(label)}" title="清除${wcEscapeAttr(label)}"><i class="ri-delete-bin-6-line"></i></button>` : ''}
            </span>
        `;
    }
    return source
        ? `<span class="${className}"><img src="${wcEscapeAttr(source)}" alt="${wcEscapeAttr(label)}"></span>`
        : `<span class="${className} is-empty" aria-label="${wcEscapeAttr(label)}"><i class="ri-image-add-line"></i></span>`;
}

function renderWechatAiPhonePhotoWidget(char) {
    const settings = getWechatAiPhoneHomeSettings(char);
    const avatar = getWechatAiPhoneHomeAvatar(char);
    return `
        <section class="wc-ai-phone-photo-widget" aria-label="${wcEscapeAttr(getWechatCharDisplayName(char))} 的桌面照片">
            <div class="wc-ai-phone-photo-hero">
                ${renderWechatAiPhonePhotoSlot(settings.photos[0], 'wc-ai-phone-photo-main', '主照片')}
                <span class="wc-ai-phone-photo-avatar"><img src="${wcEscapeAttr(avatar)}" alt="" onerror="this.onerror=null;this.src=window.DEFAULT_AVATAR"></span>
            </div>
            <span class="wc-ai-phone-photo-strip">
                ${settings.photos.slice(1).map((source, index) => renderWechatAiPhonePhotoSlot(source, 'wc-ai-phone-photo-small', `照片 ${index + 2}`)).join('')}
            </span>
        </section>
    `;
}

function renderWechatAiPhoneHomeEditor(char) {
    const modal = document.getElementById('wc-ai-phone-home-editor');
    if (!modal || !char) return;
    const settings = getWechatAiPhoneHomeSettings(char);
    const avatar = getWechatAiPhoneHomeAvatar(char);
    modal.dataset.charId = char.id;
    modal.innerHTML = `
        <div class="wc-ai-phone-home-editor-card" onclick="event.stopPropagation()">
            <div class="wc-ai-phone-home-editor-head">
                <span><strong>编辑桌面照片</strong><small>${wcEscapeHtml(getWechatCharDisplayName(char))} 的小手机</small></span>
                <button type="button" onclick="closeWechatAiPhoneHomeEditor()" aria-label="完成"><i class="ri-check-line"></i></button>
            </div>
            <div class="wc-ai-phone-home-editor-preview">
                <div class="wc-ai-phone-photo-hero">
                    ${renderWechatAiPhonePhotoSlot(settings.photos[0], 'wc-ai-phone-photo-main', '主照片', 0)}
                    <label class="wc-ai-phone-photo-avatar is-editing" title="更换独立头像">
                        <img src="${wcEscapeAttr(avatar)}" alt="桌面头像" onerror="this.onerror=null;this.src=window.DEFAULT_AVATAR">
                        <i class="ri-camera-line"></i>
                        <input type="file" accept="image/*" onchange="uploadWechatAiPhoneHomeAvatar(this)">
                    </label>
                </div>
                <span class="wc-ai-phone-photo-strip">
                    ${settings.photos.slice(1).map((source, index) => renderWechatAiPhonePhotoSlot(source, 'wc-ai-phone-photo-small', `照片 ${index + 2}`, index + 1)).join('')}
                </span>
            </div>
            <div class="wc-ai-phone-home-editor-actions">
                <button type="button" onclick="resetWechatAiPhoneHomeAvatar()"><i class="ri-user-follow-line"></i><span>头像跟随角色</span></button>
                <button type="button" onclick="clearWechatAiPhoneHomePhotos()"><i class="ri-delete-bin-6-line"></i><span>清空照片</span></button>
            </div>
        </div>
    `;
}

function openWechatAiPhoneHomeEditor(charId) {
    const char = (window.myCharacters || []).find(item => item.id === (charId || window._wechatAiPhoneOpenCharId));
    if (!char) return;
    let modal = document.getElementById('wc-ai-phone-home-editor');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-ai-phone-home-editor';
        modal.className = 'wc-ai-phone-home-editor';
        modal.setAttribute('onclick', 'if(event.target===this) closeWechatAiPhoneHomeEditor()');
        getWechatModalRoot().appendChild(modal);
    }
    renderWechatAiPhoneHomeEditor(char);
}
window.openWechatAiPhoneHomeEditor = openWechatAiPhoneHomeEditor;

function closeWechatAiPhoneHomeEditor() {
    document.getElementById('wc-ai-phone-home-editor')?.remove();
}
window.closeWechatAiPhoneHomeEditor = closeWechatAiPhoneHomeEditor;

function renderWechatAiPhoneIconEditor(char) {
    const modal = document.getElementById('wc-ai-phone-icon-editor');
    if (!modal || !char) return;
    const settings = getWechatAiPhoneHomeSettings(char);
    const apps = getWechatAiPhoneApps(char, getWechatAiPhoneRenderSnapshot(char));
    modal.dataset.charId = char.id;
    modal.innerHTML = `
        <div class="wc-ai-phone-home-editor-card" onclick="event.stopPropagation()">
            <div class="wc-ai-phone-home-editor-head">
                <span><strong>更换应用图标</strong><small>${wcEscapeHtml(getWechatCharDisplayName(char))} 的小手机 · 点图标选择图片</small></span>
                <button type="button" onclick="closeWechatAiPhoneIconEditor()" aria-label="完成"><i class="ri-check-line"></i></button>
            </div>
            <div class="wc-ai-phone-icon-editor-grid">
                ${apps.map(app => `
                    <div class="wc-ai-phone-icon-edit-item" data-app-key="${app.key}">
                        <button type="button" class="wc-ai-phone-app-icon tone-${app.tone}" onclick="this.nextElementSibling.click()" aria-label="更换${wcEscapeAttr(app.label)}图标">
                            ${renderWechatAiPhoneAppIcon(app, char)}
                            <b>${wcEscapeHtml(app.label)}</b>
                        </button>
                        <input type="file" accept="image/*" onchange="uploadWechatAiPhoneAppIcon(this, '${app.key}')" hidden tabindex="-1" aria-hidden="true">
                        ${settings.icons[app.key] ? `<button type="button" class="wc-ai-phone-icon-reset" onclick="resetWechatAiPhoneAppIcon('${app.key}')" aria-label="恢复${wcEscapeAttr(app.label)}默认图标">恢复默认</button>` : ''}
                    </div>
                `).join('')}
            </div>
            <button type="button" class="wc-ai-phone-icons-reset-all" onclick="resetWechatAiPhoneAppIcon()" ${Object.keys(settings.icons).length ? '' : 'disabled'}>恢复全部默认图标</button>
        </div>
    `;
}

function openWechatAiPhoneIconEditor(charId) {
    const char = (window.myCharacters || []).find(item => item.id === (charId || window._wechatAiPhoneOpenCharId));
    if (!char) return;
    let modal = document.getElementById('wc-ai-phone-icon-editor');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-ai-phone-icon-editor';
        modal.className = 'wc-ai-phone-home-editor';
        modal.setAttribute('onclick', 'if(event.target===this) closeWechatAiPhoneIconEditor()');
        getWechatModalRoot().appendChild(modal);
    }
    renderWechatAiPhoneIconEditor(char);
}

function closeWechatAiPhoneIconEditor() {
    document.getElementById('wc-ai-phone-icon-editor')?.remove();
}

async function uploadWechatAiPhoneAppIcon(input, appKey) {
    const file = input?.files?.[0];
    const modal = document.getElementById('wc-ai-phone-icon-editor');
    const char = (window.myCharacters || []).find(item => item.id === modal?.dataset.charId);
    const app = getWechatAiPhoneAllApps().find(item => item.key === appKey);
    if (!file || !char || !app) return;
    try {
        const image = await compressWechatSettingsImage(file, 1024, 0.94, 'image/png');
        if (document.getElementById('wc-ai-phone-icon-editor')?.dataset.charId !== char.id) return;
        openWechatAvatarCropper(image, cropped => updateWechatAiPhoneHomeSettings(char, current => ({
            ...current, icons: { ...current.icons, [appKey]: cropped }
        })), {
            ...getWechatAiPhoneHomeCropOptions('icon'),
            title: `裁剪${app.label}图标`, confirmText: '设为图标', outputWidth: 384, outputHeight: 384
        });
    } catch (error) {
        if (typeof showWechatToast === 'function') showWechatToast(error?.message || '图标读取失败');
    } finally {
        input.value = '';
    }
}

function resetWechatAiPhoneAppIcon(appKey) {
    const modal = document.getElementById('wc-ai-phone-icon-editor');
    const char = (window.myCharacters || []).find(item => item.id === modal?.dataset.charId);
    if (appKey !== undefined && !getWechatAiPhoneAllApps().some(app => app.key === appKey)) return false;
    return updateWechatAiPhoneHomeSettings(char, current => {
        if (appKey === undefined) current.icons = {};
        else delete current.icons[appKey];
        return current;
    });
}

async function updateWechatAiPhoneHomeSettings(char, updater) {
    if (!char) return false;
    // Serialize edits so a failed save cannot roll back a later photo change.
    const saves = window._wechatAiPhoneHomeSaves = window._wechatAiPhoneHomeSaves || new Map();
    const promise = (saves.get(char.id) || Promise.resolve()).then(async () => {
        char.chatConfig = char.chatConfig || {};
        const previous = char.chatConfig.aiPhoneHomeSettings;
        try {
            const current = getWechatAiPhoneHomeSettings(char);
            const next = typeof updater === 'function' ? updater(current) : current;
            char.chatConfig.aiPhoneHomeSettings = getWechatAiPhoneHomeSettings({ chatConfig: { aiPhoneHomeSettings: next } });
            if (await saveCharactersToStorage() === false) throw new Error('桌面设置保存失败，请重试');
        } catch (error) {
            if (previous === undefined) delete char.chatConfig.aiPhoneHomeSettings;
            else char.chatConfig.aiPhoneHomeSettings = previous;
            if (typeof showWechatToast === 'function') showWechatToast(error?.message || '桌面设置保存失败，请重试');
            return false;
        }
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
        if (document.getElementById('wc-ai-phone-home-editor')?.dataset.charId === char.id) renderWechatAiPhoneHomeEditor(char);
        if (document.getElementById('wc-ai-phone-icon-editor')?.dataset.charId === char.id) renderWechatAiPhoneIconEditor(char);
        return true;
    });
    saves.set(char.id, promise);
    try {
        return await promise;
    } finally {
        if (saves.get(char.id) === promise) saves.delete(char.id);
    }
}

function getWechatAiPhoneHomeCropOptions(kind) {
    const wallpaper = kind === 'wallpaper';
    const mainPhoto = kind === 'main';
    const screen = document.querySelector('#wc-ai-phone-overlay .wc-ai-phone-wallpaper')?.getBoundingClientRect();
    const aspect = wallpaper ? (screen?.width && screen?.height ? screen.width / screen.height : 9 / 19.5) : (mainPhoto ? 11 / 5 : 1);
    const root = getWechatModalRoot();
    const maxWidth = Math.min(mainPhoto ? 264 : 240, Math.max(120, (root.clientWidth || window.innerWidth) - 72));
    const maxHeight = Math.min(320, Math.max(120, (root.clientHeight || window.innerHeight) - 260));
    const cropWidth = Math.min(maxWidth, maxHeight * aspect);
    const cropHeight = cropWidth / aspect;
    const outputHeight = wallpaper ? 1440 : (mainPhoto ? 500 : 720);
    return {
        mode: 'cover',
        title: wallpaper ? '裁剪桌面壁纸' : (mainPhoto ? '裁剪主照片' : '裁剪方形照片'),
        helpText: '拖动图片调整位置，拉动缩放条选择保留的画面。',
        confirmText: wallpaper ? '设为壁纸' : '保存照片',
        cropWidth,
        cropHeight,
        outputWidth: Math.round(outputHeight * aspect),
        outputHeight,
        quality: 0.86
    };
}

async function uploadWechatAiPhoneHomePhoto(input, index) {
    const file = input && input.files && input.files[0];
    const modal = document.getElementById('wc-ai-phone-home-editor');
    const char = (window.myCharacters || []).find(item => item.id === (modal && modal.dataset.charId));
    if (!file || !char || !Number.isInteger(index) || index < 0 || index > 3) return;
    try {
        const image = await compressWechatSettingsImage(file, 1600, 0.94);
        if (document.getElementById('wc-ai-phone-home-editor')?.dataset.charId !== char.id) return;
        openWechatAvatarCropper(image, cropped => updateWechatAiPhoneHomeSettings(char, current => {
            current.photos[index] = cropped;
            return current;
        }), getWechatAiPhoneHomeCropOptions(index === 0 ? 'main' : 'photo'));
    } catch (error) {
        if (typeof showWechatToast === 'function') showWechatToast(error && error.message ? error.message : '照片读取失败');
    } finally {
        input.value = '';
    }
}
window.uploadWechatAiPhoneHomePhoto = uploadWechatAiPhoneHomePhoto;

function uploadWechatAiPhoneHomeAvatar(input) {
    const file = input && input.files && input.files[0];
    const modal = document.getElementById('wc-ai-phone-home-editor');
    const char = (window.myCharacters || []).find(item => item.id === (modal && modal.dataset.charId));
    if (!file || !char) return;
    const reader = new FileReader();
    reader.onload = event => {
        openWechatAvatarCropper(event.target.result, compressed => {
            updateWechatAiPhoneHomeSettings(char, current => ({ ...current, avatar: compressed }));
        }, { outputSize: 320, quality: 0.82 });
    };
    reader.onerror = () => {
        if (typeof showWechatToast === 'function') showWechatToast('头像读取失败');
    };
    reader.readAsDataURL(file);
    input.value = '';
}
window.uploadWechatAiPhoneHomeAvatar = uploadWechatAiPhoneHomeAvatar;

async function uploadWechatAiPhoneHomeWallpaper(input, charId) {
    const file = input && input.files && input.files[0];
    const char = (window.myCharacters || []).find(item => item.id === charId);
    if (!file || !char) return;
    try {
        const image = await compressWechatSettingsImage(file, 1600, 0.94);
        if (window._wechatAiPhoneOpenCharId !== char.id) return;
        openWechatAvatarCropper(image, cropped => updateWechatAiPhoneHomeSettings(char, current => ({ ...current, wallpaper: cropped })), getWechatAiPhoneHomeCropOptions('wallpaper'));
    } catch (error) {
        if (typeof showWechatToast === 'function') showWechatToast(error?.message || '壁纸读取失败');
    } finally {
        input.value = '';
    }
}
window.uploadWechatAiPhoneHomeWallpaper = uploadWechatAiPhoneHomeWallpaper;

function resetWechatAiPhoneHomeWallpaper(charId) {
    const char = (window.myCharacters || []).find(item => item.id === charId);
    return updateWechatAiPhoneHomeSettings(char, current => ({ ...current, wallpaper: '' }));
}
window.resetWechatAiPhoneHomeWallpaper = resetWechatAiPhoneHomeWallpaper;

function clearWechatAiPhoneHomePhoto(index) {
    const modal = document.getElementById('wc-ai-phone-home-editor');
    const char = (window.myCharacters || []).find(item => item.id === (modal && modal.dataset.charId));
    if (!char || index < 0 || index > 3) return;
    updateWechatAiPhoneHomeSettings(char, current => {
        current.photos[index] = '';
        return current;
    });
}
window.clearWechatAiPhoneHomePhoto = clearWechatAiPhoneHomePhoto;

function clearWechatAiPhoneHomePhotos() {
    const modal = document.getElementById('wc-ai-phone-home-editor');
    const char = (window.myCharacters || []).find(item => item.id === (modal && modal.dataset.charId));
    if (!char) return;
    updateWechatAiPhoneHomeSettings(char, current => ({ ...current, photos: ['', '', '', ''] }));
}
window.clearWechatAiPhoneHomePhotos = clearWechatAiPhoneHomePhotos;

function resetWechatAiPhoneHomeAvatar() {
    const modal = document.getElementById('wc-ai-phone-home-editor');
    const char = (window.myCharacters || []).find(item => item.id === (modal && modal.dataset.charId));
    if (!char) return;
    updateWechatAiPhoneHomeSettings(char, current => ({ ...current, avatar: '' }));
}
window.resetWechatAiPhoneHomeAvatar = resetWechatAiPhoneHomeAvatar;

