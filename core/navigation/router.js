// --- 🌟 路由控制 (这里修复了！) ---

function openApp(appName) {
    window._activeAppOriginPageByApp = window._activeAppOriginPageByApp || {};
    window._activeAppOriginPageByApp[appName] = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
    document.querySelectorAll('.app-window.active').forEach(w => {
        w.classList.remove('active');
        w.classList.add('hidden');
    });
    // 1. 美化 App
    if (appName === 'theme') {
        const win = document.getElementById('app-theme-window');
        if (win) { 
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10); 
            if (typeof loadSavedSettings === 'function') loadSavedSettings();
        }
    }
    // 2. 微信 App
    else if (appName === 'wechat') {
        const win = document.getElementById('app-wechat-window');
        if (win) { 
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof renderChatList === 'function') renderChatList(); 
            // Built-in characters added before their artwork shipped get it filled in here too.
            setTimeout(() => { try { window.ByndBuiltinLibrary?.repair?.().then(result => { if (result && result.repaired.length && typeof renderChatList === 'function') renderChatList(); }); } catch (_) {} }, 300);
        }
    } 
    // 3. 📖 世界书 App (新增)
    else if (appName === 'worldbook') {
        const win = document.getElementById('app-worldbook-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initWorldBook === 'function') initWorldBook();
        }
    }
    // 4. 🛠️ 正则 App (新增)
    else if (appName === 'regex') {
        const win = document.getElementById('app-regex-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initRegexApp === 'function') initRegexApp();
        }
    }
    // 5. ⚙️ 设置 App
    else if (appName === 'settings') {
        const win = document.getElementById('app-settings-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initSettings === 'function') initSettings();
        }
    }
    // 6. 预设 App
    else if (appName === 'preset') {
        const win = document.getElementById('app-preset-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof renderPresetList === 'function') renderPresetList();
        }
    }
    // 7. 音乐 App
    else if (appName === 'music') {
        const win = document.getElementById('app-music-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initMusicApp();
        }
    }
    // 8. 学习 App
    else if (appName === 'study') {
        const win = document.getElementById('app-study-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initStudyApp();
        }
    }
    // 9. Game App
    else if (appName === 'game') {
        const win = document.getElementById('app-game-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initGameApp();
        }
    }
    // 10. 记账 App
    else if (appName === 'money') {
        const win = document.getElementById('app-money-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initMoneyApp();
        }
    }
    // 11. 盗梦空间
    else if (appName === 'dream') {
        const win = document.getElementById('app-dream-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initDreamApp();
        }
    }
    // 12. 监控
    else if (appName === 'monitor') {
        const win = document.getElementById('app-monitor-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => { win.classList.add('active'); initMonitorApp(); }, 10);
        }
    }
    else if (appName === 'pet') {
        const win = document.getElementById('app-pet-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => { win.classList.add('active'); window.ByndPetWorkspace?.render(); }, 10);
        }
    }
    // 13. 一起出门
    else if (appName === 'outing') {
        const win = document.getElementById('app-outing-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initOutingApp();
        }
    }
    // 14. 共读
    else if (appName === 'coread') {
        const win = document.getElementById('app-coread-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initCoReadApp();
        }
    }
    // 14.5 Living World / 论坛
    else if (appName === 'living-world') {
        const win = document.getElementById('app-living-world-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initLivingWorld === 'function') initLivingWorld();
        }
    }
    // 15. 相册
    else if (appName === 'album') {
        const win = document.getElementById('app-album-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initAlbumApp();
        }
    }
    else if (appName === 'comic') {
        const win = document.getElementById('app-comic-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            const source = window._comicPendingSource || null;
            window._comicPendingSource = null;
            window.ByndComic?.open(source);
        }
    }
    // 16. 说明书
    else if (appName === 'manual') {
        const win = document.getElementById('app-manual-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initManualApp();
        }
    }
    // 18. GitHub MCP
    else if (appName === 'mcp') {
        const win = document.getElementById('app-mcp-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            initMcpApp();
        }
    }
    // 18.5 账单 / Token usage
    else if (appName === 'bill') {
        const win = document.getElementById('app-bill-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            window.ByndBillApp?.open();
        }
    }
    // 19. System Camera
    else if (appName === 'camera') {
        openSystemCamera();
    }
    // 其他未开发
    else {
        alert("正在打开: " + appName + " (功能开发中...)");
    }
    if (typeof syncMonitorPetFloating === 'function') setTimeout(syncMonitorPetFloating, 40);
}

function openSystemCamera() {
    let input = document.getElementById('bynd-system-camera-input');
    if (!input) {
        input = document.createElement('input');
        input.id = 'bynd-system-camera-input';
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'environment');
        input.style.display = 'none';
        input.onchange = () => handleSystemCameraCapture(input);
        document.body.appendChild(input);
    }
    if (!input) {
        alert('当前页面没有找到相机入口');
        return;
    }
    input.value = '';
    input.click();
}
window.openSystemCamera = openSystemCamera;

function handleSystemCameraCapture(input) {
    const file = input?.files?.[0];
    if (!file) return;
    input.value = '';
    if (!/^image\//i.test(file.type)) {
        if (typeof showWechatToast === 'function') showWechatToast('相机入口只支持照片');
        return;
    }
    openByndCameraRecipientPicker(file);
}
window.handleSystemCameraCapture = handleSystemCameraCapture;

function getByndCameraRecipients() {
    const source = typeof getWechatSortedChatCharacters === 'function'
        ? getWechatSortedChatCharacters()
        : (Array.isArray(window.myCharacters) ? window.myCharacters : []);
    return (Array.isArray(source) ? source : [])
        .filter(char => char && !char.isGroupNpc && !char.groupNpc && !char.isGroupChat);
}

function closeByndCameraRecipientPicker() {
    const modal = document.getElementById('bynd-camera-recipient-modal');
    if (!modal) return;
    if (modal.dataset.sending === 'true') return;
    const preview = modal.querySelector('[data-camera-preview]');
    if (preview?.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
    modal.remove();
}
window.closeByndCameraRecipientPicker = closeByndCameraRecipientPicker;

function openByndCameraRecipientPicker(file) {
    if (window._byndCameraSendPromise) return;
    closeByndCameraRecipientPicker();
    const host = document.querySelector('.phone-container') || document.body;
    const modal = document.createElement('div');
    modal.id = 'bynd-camera-recipient-modal';
    modal.className = 'bynd-camera-recipient-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'bynd-camera-recipient-title');

    const panel = document.createElement('div');
    panel.className = 'bynd-camera-recipient-panel';
    const heading = document.createElement('div');
    heading.className = 'bynd-camera-recipient-heading';
    heading.innerHTML = '<div><span>CAMERA MESSAGE</span><strong id="bynd-camera-recipient-title">发给哪个角色？</strong></div>';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'bynd-camera-recipient-close';
    close.setAttribute('aria-label', '取消发送');
    close.innerHTML = '<i class="ri-close-line"></i>';
    close.addEventListener('click', closeByndCameraRecipientPicker);
    heading.appendChild(close);

    const preview = document.createElement('img');
    preview.className = 'bynd-camera-recipient-preview';
    preview.alt = '拍摄的照片预览';
    preview.dataset.cameraPreview = '1';
    preview.dataset.objectUrl = URL.createObjectURL(file);
    preview.src = preview.dataset.objectUrl;

    const list = document.createElement('div');
    list.className = 'bynd-camera-recipient-list';
    const recipients = getByndCameraRecipients();
    if (!recipients.length) {
        const empty = document.createElement('p');
        empty.className = 'bynd-camera-recipient-empty';
        empty.textContent = '请先导入角色卡';
        list.appendChild(empty);
    }
    recipients.forEach(char => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bynd-camera-recipient';
        const avatar = document.createElement('img');
        avatar.alt = '';
        avatar.src = typeof getWechatCharAvatarSource === 'function'
            ? getWechatCharAvatarSource(char, typeof DEFAULT_AVATAR === 'string' ? DEFAULT_AVATAR : '')
            : (char.avatar || '');
        avatar.addEventListener('error', () => {
            if (typeof DEFAULT_AVATAR === 'string') avatar.src = DEFAULT_AVATAR;
        }, { once: true });
        const name = document.createElement('span');
        name.textContent = typeof getWechatCharDisplayName === 'function'
            ? getWechatCharDisplayName(char)
            : (char.name || '角色');
        button.append(avatar, name);
        button.addEventListener('click', () => sendByndCameraFileToCharacter(file, char.id));
        list.appendChild(button);
    });

    const status = document.createElement('p');
    status.className = 'bynd-camera-recipient-status';
    status.dataset.cameraStatus = '1';
    status.setAttribute('role', 'status');
    panel.append(heading, preview, list, status);
    modal.appendChild(panel);
    modal.addEventListener('click', event => {
        if (event.target === modal) closeByndCameraRecipientPicker();
    });
    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeByndCameraRecipientPicker();
    });
    host.appendChild(modal);
    close.focus();
}
window.openByndCameraRecipientPicker = openByndCameraRecipientPicker;

function setByndCameraSending(modal, sending, message = '') {
    if (!modal) return;
    modal.dataset.sending = String(sending);
    modal.setAttribute('aria-busy', String(sending));
    modal.querySelectorAll('button').forEach(button => { button.disabled = sending; });
    const status = modal.querySelector('[data-camera-status]');
    if (status) status.textContent = message;
}

function sendByndCameraFileToCharacter(file, charId) {
    if (window._byndCameraSendPromise) return window._byndCameraSendPromise;
    const modal = document.getElementById('bynd-camera-recipient-modal');
    setByndCameraSending(modal, true, '正在发送照片…');
    window._byndCameraSendPromise = (async () => {
        let char;
        let message;
        let saved = false;
        let stage = 'read';
        try {
            if (!file) throw new Error('没有可发送的照片');
            if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
            const imageUrl = typeof compressWechatImageFile === 'function'
                ? await compressWechatImageFile(file)
                : await readByndCameraFile(file);
            if (!imageUrl) throw new Error('照片内容为空');
            char = getByndCameraRecipients().find(item => item.id === charId);
            if (!char) throw new Error('所选角色已不存在，请重新选择');
            stage = 'save';
            if (typeof saveCharactersToStorage !== 'function') throw new Error('角色存储尚未准备好');
            message = {
                type: 'image', isMe: true, content: imageUrl, imageUrl,
                description: '[用户从相机发送了一张照片]',
                timestamp: typeof createMessageTimestamp === 'function' ? createMessageTimestamp() : Date.now()
            };
            char.history = Array.isArray(char.history) ? char.history : [];
            char.history.push(message);
            saved = await saveCharactersToStorage() === true;
            if (!saved) throw new Error('照片未能保存');
            // Notify other modules only after the photo is durable.
            try {
                if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
                if (typeof notifyWechatMonitors === 'function') notifyWechatMonitors(char, message);
                if (window.currentChatCharId === char.id && typeof refreshChatView === 'function') refreshChatView(char);
                if (typeof renderChatList === 'function') renderChatList();
            } catch (error) {
                console.warn('照片已保存，界面刷新失败', error);
            }
            setByndCameraSending(modal, false);
            closeByndCameraRecipientPicker();
            if (typeof showWechatToast === 'function') showWechatToast(`照片已发给${typeof getWechatCharDisplayName === 'function' ? getWechatCharDisplayName(char) : char.name || '角色'}`);
            return true;
        } catch (error) {
            if (message && !saved) {
                const index = char.history.indexOf(message);
                if (index >= 0) char.history.splice(index, 1);
                // A later queued save may have observed the pending photo. Queue the rollback too.
                try { await saveCharactersToStorage(); } catch (_) {}
            }
            const hint = stage === 'save' ? '照片未发送，请检查存储空间后重试' : '照片读取或角色选择失败，请重试';
            setByndCameraSending(modal, false, hint);
            if (typeof showWechatToast === 'function') showWechatToast(hint);
            console.warn('camera image send failed:', error);
            return false;
        }
    })().finally(() => {
        window._byndCameraSendPromise = null;
        setByndCameraSending(modal, false, modal?.querySelector('[data-camera-status]')?.textContent || '');
    });
    return window._byndCameraSendPromise;
}
window.sendByndCameraFileToCharacter = sendByndCameraFileToCharacter;

function readByndCameraFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('camera image read failed'));
        reader.onabort = () => reject(new Error('camera image read cancelled'));
        reader.readAsDataURL(file);
    });
}

function closeApp(appName) {
    let winId = '';
    if (appName === 'theme') winId = 'app-theme-window';
    else if (appName === 'wechat') winId = 'app-wechat-window';
    else if (appName === 'worldbook') winId = 'app-worldbook-window';
    else if (appName === 'regex') winId = 'app-regex-window';
    else if (appName === 'settings') winId = 'app-settings-window';
    else if (appName === 'preset') winId = 'app-preset-window';
    else if (appName === 'music') winId = 'app-music-window';
    else if (appName === 'study') winId = 'app-study-window';
    else if (appName === 'game') winId = 'app-game-window';
    else if (appName === 'money') winId = 'app-money-window';
    else if (appName === 'dream') winId = 'app-dream-window';
    else if (appName === 'monitor') winId = 'app-monitor-window';
    else if (appName === 'pet') winId = 'app-pet-window';
    else if (appName === 'outing') winId = 'app-outing-window';
    else if (appName === 'coread') winId = 'app-coread-window';
    else if (appName === 'living-world') winId = 'app-living-world-window';
    else if (appName === 'album') winId = 'app-album-window';
    else if (appName === 'comic') winId = 'app-comic-window';
    else if (appName === 'manual') winId = 'app-manual-window';
    else if (appName === 'mcp') winId = 'app-mcp-window';
    else if (appName === 'bill') winId = 'app-bill-window';
    const win = document.getElementById(winId);
    if (win) {
        restoreDesktopPageAfterApp(appName);
        win.classList.remove('active');
        if (appName === 'monitor') window.ByndMonitor?.close();
        if (appName === 'pet') window.ByndPetWorkspace?.close();
        if (appName === 'manual') resetManualSearchState();
        if (appName === 'bill') window.ByndBillApp?.close();
        setTimeout(() => win.classList.add('hidden'), 300);

        if (appName === 'wechat' && typeof closeChat === 'function') {
            if (typeof collapseWechatMusicOverlaysToIsland === 'function') collapseWechatMusicOverlaysToIsland();
            setTimeout(closeChat, 300);
        }
        if (typeof syncMonitorPetFloating === 'function') setTimeout(syncMonitorPetFloating, 320);
    }
}

function restoreDesktopPageAfterApp(appName) {
    const page = window._activeAppOriginPageByApp && Number.isInteger(window._activeAppOriginPageByApp[appName])
        ? window._activeAppOriginPageByApp[appName]
        : 0;
    if (typeof window.goToDesktopPage === 'function') {
        window.goToDesktopPage(page);
        return;
    }
    if (page <= 0) resetDesktopToFirstPage();
}

