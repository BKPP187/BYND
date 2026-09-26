function renderWechatAiPhoneAppScreen(activeTab, snapshot, char, isLoading) {
    if (activeTab === 'library') return renderCharPhoneLibrary(snapshot,char);
    const native = renderCharPhoneTemplate(activeTab, snapshot, char);
    if (native !== null) return native;
    const system = renderCharPhoneSystemApp(activeTab, snapshot, char, isLoading);
    if (system !== null) return system;
    const clock = getWechatAiPhoneClockParts();
    const charName = getWechatCharDisplayName(char);
    if (activeTab === 'chat') {
        return `
            <div class="wc-ai-phone-app-title"><strong>微信</strong><span>${isLoading ? '正在同步聊天记录' : `微信 · ${wcEscapeHtml(charName)}`}</span></div>
            <div class="wc-ai-phone-ios-search"><i class="ri-search-line"></i><span>搜索</span></div>
            <div class="wc-ai-phone-wechat-list">
                ${renderWechatAiPhoneChatRows(snapshot, char)}
            </div>
        `;
    }
    if (activeTab === 'wechatChat') {
        const chatIndex = Math.max(0, Number(window._wechatAiPhoneChatIndex || 0));
        const chats = Array.isArray(snapshot.chats) ? snapshot.chats : [];
        const contact = chats[chatIndex] || chats[0] || { name: getWechatAiPhoneUserDisplayName(char), text: '' };
        const userAvatar = ((typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char).avatar : '') || DEFAULT_AVATAR;
        const canProxyReply = chatIndex > 0 && !isLoading;
        return `
            <div class="wc-ai-phone-chat-room">
                <div class="wc-ai-phone-imessage-head">
                    <div class="wc-ai-phone-imessage-avatar ${chatIndex === 0 ? 'primary' : ''}">
                        ${chatIndex === 0
                            ? `<img src="${wcEscapeHtml(userAvatar)}" onerror="this.style.display='none';this.parentElement.textContent='${wcEscapeHtml(getWechatAiPhoneInitial(contact.name))}'">`
                            : wcEscapeHtml(getWechatAiPhoneInitial(contact.name))}
                    </div>
                    <strong>${wcEscapeHtml(contact.name || '联系人')}</strong>
                </div>
                <div class="wc-ai-phone-conversation">
                    ${renderWechatAiPhoneConversationRows(snapshot, char, chatIndex)}
                </div>
                ${canProxyReply ? `
                    <form class="wc-ai-phone-compose wc-ai-phone-compose-active" onsubmit="event.preventDefault(); submitWechatAiPhoneContactReply('${wcEscapeAttr(char.id)}', ${chatIndex});">
                        <i class="ri-add-circle-line"></i>
                        <input id="wc-ai-phone-contact-reply-input" type="text" placeholder="替 ${wcEscapeAttr(char.name || 'char')} 回复联系人">
                        <button type="submit" aria-label="发送"><i class="ri-send-plane-2-fill"></i></button>
                    </form>
                ` : `
                    <div class="wc-ai-phone-compose">
                        <i class="ri-add-circle-line"></i>
                        <span>${chatIndex === 0 ? '这是你和 char 的聊天' : '微信'}</span>
                        <i class="ri-mic-fill"></i>
                    </div>
                `}
            </div>
        `;
    }
    if (activeTab === 'memo') {
        const memoItems = getWechatAiPhoneMemoItems(snapshot);
        const memoIndex = Number.isInteger(window._wechatAiPhoneMemoIndex) ? window._wechatAiPhoneMemoIndex : -1;
        if (memoIndex >= 0 && memoItems[memoIndex]) return renderWechatAiPhoneMemoDetail(memoItems[memoIndex]);
        return `
            <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>备忘录</strong><span>iCloud · ${wcEscapeHtml(charName)}</span></div>
            <div class="wc-ai-phone-ios-search"><i class="ri-search-line"></i><span>搜索备忘录</span></div>
            <div class="wc-ai-phone-notes-folder">
                <div class="wc-ai-phone-folder-head"><i class="ri-folder-3-fill"></i><strong>置顶备忘录</strong><span>${memoItems.length}</span></div>
                ${renderWechatAiPhoneMemoRows(memoItems)}
            </div>
        `;
    }
    if (activeTab === 'schedule') {
        const rows = getWechatAiPhoneScheduleRows(snapshot, char);
        const first = rows[0] || null;
        return `
            <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>\u884c\u7a0b</strong><span>\u65e5\u5386 \u00b7 \u884c\u7a0b\u76d1\u63a7</span></div>
            <div class="wc-ai-phone-calendar-card">
                <span>${wcEscapeHtml(clock.date)}</span>
                <strong>${wcEscapeHtml(first ? `${first.time} ${first.title}` : '\u4eca\u65e5\u65e0\u5b89\u6392')}</strong>
                <p>${wcEscapeHtml(first ? (first.meta || '\u4eca\u5929') : '\u65e5\u5386\u6682\u65e0\u65b0\u63d0\u9192')}</p>
            </div>
            ${renderWechatAiPhoneScheduleRows(rows)}
        `;
    }
    if (activeTab === 'shopping') {
        const rows = getWechatAiPhoneShoppingRows(snapshot, char);
        return `
            <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>\u8d2d\u7269</strong><span>\u8ba2\u5355\u4e0e\u6536\u85cf</span></div>
            <div class="wc-ai-phone-order-card">
                <i class="ri-shopping-bag-3-fill"></i>
                <span>\u6700\u8fd1\u8ba2\u5355</span>
                <strong>${wcEscapeHtml(rows[0] ? rows[0].title : '\u6ca1\u6709\u65b0\u7684\u8d2d\u7269')}</strong>
                <p>${wcEscapeHtml(rows[0] ? rows[0].detail : '\u8d2d\u7269\u8bb0\u5f55\u4f1a\u6309\u7167\u89d2\u8272\u4eba\u8bbe\u6574\u7406')}</p>
            </div>
            ${renderWechatAiPhoneIosRows(rows, '\u6ca1\u6709\u8d2d\u7269\u8bb0\u5f55', 'ri-shopping-bag-line')}
        `;
    }
    if (activeTab === 'takeout') {
        const rows = getWechatAiPhoneTakeoutRows(snapshot, char);
        return `
            <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>\u5916\u5356</strong><span>\u70b9\u5355\u4e0e\u914d\u9001</span></div>
            <div class="wc-ai-phone-delivery-card">
                <div><i class="ri-riding-fill"></i><b></b><i class="ri-home-heart-fill"></i></div>
                <strong>${wcEscapeHtml(rows[0] ? rows[0].title : '\u5e38\u70b9\u5e97\u94fa')}</strong>
                <p>${wcEscapeHtml(rows[0] ? rows[0].detail : '\u8fd9\u91cc\u4f1a\u663e\u793a\u89d2\u8272\u6700\u8fd1\u70b9\u8fc7\u7684\u5916\u5356')}</p>
            </div>
            ${renderWechatAiPhoneIosRows(rows, '\u6ca1\u6709\u5916\u5356\u8bb0\u5f55', 'ri-restaurant-2-line')}
        `;
    }
    if (activeTab === 'games') {
        const rows = getWechatAiPhoneGameRows(snapshot, char);
        return `
            <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>\u6e38\u620f</strong><span>Game Center</span></div>
            <div class="wc-ai-phone-game-card">
                <span>GAME CENTER</span>
                <strong>${wcEscapeHtml(rows[0] ? rows[0].title : '\u6ca1\u6709\u6e38\u620f\u8bb0\u5f55')}</strong>
                <p>${wcEscapeHtml(rows[0] ? rows[0].detail : '\u8fd9\u4e2a\u89d2\u8272\u7684\u4eba\u8bbe\u4e0d\u592a\u50cf\u4f1a\u73a9\u6e38\u620f')}</p>
            </div>
            ${renderWechatAiPhoneIosRows(rows, '\u8fd9\u4e2a\u89d2\u8272\u6ca1\u6709\u6e38\u620f\u8bb0\u5f55', 'ri-gamepad-line')}
        `;
    }
    if (activeTab === 'browser') {
        const browserRows = getWechatAiPhoneBrowserRows(snapshot, char);
        const browserIndex = Number.isInteger(window._wechatAiPhoneBrowserIndex) ? window._wechatAiPhoneBrowserIndex : -1;
        if (browserIndex >= 0 && browserRows[browserIndex]) return renderWechatAiPhoneBrowserDetail(browserRows[browserIndex]);
        return `
            <div class="wc-ai-phone-safari-app">
                <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>Safari</strong><span>最近浏览</span></div>
                <div class="wc-ai-phone-safari-page-card">
                    <div class="wc-ai-phone-safari-toolbar"><i class="ri-lock-2-fill"></i><span>search.or.type.url</span><i class="ri-reload-line"></i></div>
                    ${renderWechatAiPhoneBrowserListRows(browserRows)}
                </div>
                <div class="wc-ai-phone-safari-bottom"><i class="ri-arrow-left-s-line"></i><i class="ri-arrow-right-s-line"></i><i class="ri-share-up-line"></i><i class="ri-book-open-line"></i><i class="ri-layout-grid-line"></i></div>
            </div>
        `;
    }
    if (activeTab === 'wallet') {
        const walletPass = getWechatAiPhoneWalletPassInfo(snapshot, char);
        const walletRows = getWechatAiPhoneWalletRows(snapshot, char);
        return `
            <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>钱包</strong><span>卡片与零钱</span></div>
            <div class="wc-ai-phone-wallet-pass">
                <span>BYND Wallet</span>
                <strong>${wcEscapeHtml(walletPass.amount)}</strong>
                <em>${wcEscapeHtml(walletPass.owner)}</em>
                <p>${wcEscapeHtml(walletPass.detail)}</p>
            </div>
            ${renderWechatAiPhoneIosRows(walletRows, '没有钱包记录', 'ri-bank-card-line')}
        `;
    }
    if (activeTab === 'diary') {
        return renderWechatAiPhoneDiaryMailbox(snapshot, char, !!window._wechatAiPhoneDiaryGenerating?.has(char.id), isLoading);
    }
    if (activeTab === 'footprints') {
        const places = getWechatAiPhoneFootprintRows(snapshot, char);
        return `
            <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>重要地点</strong><span>足迹 · 到过的位置</span></div>
            <div class="wc-ai-phone-map-preview">
                <div class="wc-ai-phone-map-route"><b></b><b></b><b></b><b></b></div>
                <i class="ri-route-line"></i>
                <span>${wcEscapeHtml(places[0] ? places[0].title : '尚未同步地点')}</span>
            </div>
            ${renderWechatAiPhoneIosRows(places, '没有新的足迹', 'ri-map-pin-time-fill')}
        `;
    }
    if (activeTab === 'usage') {
        const usage = getWechatAiPhoneUsageRows(snapshot, char);
        return `
            <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>屏幕使用时间</strong><span>App 使用记录</span></div>
            <div class="wc-ai-phone-screen-time-card">
                <span>今天</span>
                <strong>${getWechatAiPhoneUsageTotal(usage)} 分钟</strong>
                <div><i style="height:42%"></i><i style="height:76%"></i><i style="height:58%"></i><i style="height:88%"></i><i style="height:64%"></i></div>
            </div>
            ${renderWechatAiPhoneIosRows(usage, '没有使用记录', 'ri-history-fill')}
        `;
    }
    if (activeTab === 'clock') {
        const alarms = getWechatAiPhoneAlarmRows(snapshot, char);
        return `
            <div class="wc-ai-phone-clock-native">
                <div class="wc-ai-phone-clock-tabs"><button>世界时钟</button><button class="active">闹钟</button><button>秒表</button><button>计时器</button></div>
                <div class="wc-ai-phone-clock-large">${wcEscapeHtml(clock.time)}</div>
                ${renderWechatAiPhoneIosRows([
                    ...alarms,
                    { title: clock.date, detail: '当前设备时间', meta: '现在' }
                ], '没有闹钟', 'ri-alarm-line')}
            </div>
        `;
    }
    if (activeTab === 'settings') {
        const avatar = getWechatAiPhoneHomeAvatar(char);
        const homeSettings = getWechatAiPhoneHomeSettings(char);
        const charIdArgument = quoteWechatJsString(char.id);
        return `
            <section class="cp-native cp-system-designed cp-system-settings" data-app-layout="settings"><div class="cp-scroll">
            <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>设置</strong><span>${wcEscapeHtml(charName)} 的小手机</span></div>
            <div class="wc-ai-phone-settings-profile">
                <img src="${wcEscapeAttr(avatar)}" alt="" onerror="this.onerror=null;this.src=window.DEFAULT_AVATAR">
                <span><strong>${wcEscapeHtml(charName)}</strong><em>桌面与显示</em></span>
            </div>
            <div class="wc-ai-phone-ios-list wc-ai-phone-settings-list">
                <button type="button" class="wc-ai-phone-ios-row" aria-label="应用图标" onclick="openWechatAiPhoneIconEditor(${charIdArgument})">
                    <i class="ri-apps-2-line"></i>
                    <span><strong>应用图标</strong><em>选择图片，定制桌面和底栏图标</em></span>
                    <b class="ri-arrow-right-s-line"></b>
                </button>
                <button type="button" class="wc-ai-phone-ios-row" onclick="openWechatAiPhoneHomeEditor('${wcEscapeAttr(char.id)}')">
                    <i class="ri-gallery-line"></i>
                    <span><strong>桌面照片与头像</strong><em>编辑主图、照片组件和桌面头像</em></span>
                    <b class="ri-arrow-right-s-line"></b>
                </button>
                <button type="button" class="wc-ai-phone-ios-row wc-ai-phone-wallpaper-pick" onclick="this.nextElementSibling.click()">
                    <i class="ri-image-line"></i>
                    <span><strong>桌面壁纸</strong><em>${homeSettings.wallpaper ? '已设置壁纸，点击更换' : '选择图片并裁剪'}</em></span>
                    <b class="ri-arrow-right-s-line"></b>
                </button>
                <input class="hidden" type="file" accept="image/*" onchange="uploadWechatAiPhoneHomeWallpaper(this, ${charIdArgument})" tabindex="-1" aria-hidden="true">
                ${homeSettings.wallpaper ? `<button type="button" class="wc-ai-phone-ios-row" onclick="resetWechatAiPhoneHomeWallpaper(${charIdArgument})">
                    <i class="ri-refresh-line"></i>
                    <span><strong>恢复默认壁纸</strong><em>使用原来的浅色桌面</em></span>
                    <b class="ri-arrow-right-s-line"></b>
                </button>` : ''}
            </div>
            </div></section>
        `;
    }
    return '';
}

function renderWechatAiPhoneHome(snapshot, char, isLoading) {
    const apps = getWechatAiPhoneApps(char, snapshot);
    const dockApps = apps.filter(app => ['chat', 'browser', 'wallet', 'diary'].includes(app.key));
    const gridApps = apps.filter(app => !['chat', 'browser', 'wallet', 'diary'].includes(app.key));
    const pages = [gridApps.slice(0, 8)];
    for (let offset = 8; offset < gridApps.length; offset += 20) pages.push(gridApps.slice(offset, offset + 20));
    const pageIndex = Math.min(pages.length - 1, Math.max(0, window._charPhoneHomePage || 0));
    const syncError = stripWechatPromptText(snapshot && snapshot.syncError, 118);
    const diaryError = snapshot && snapshot.diarySyncError;
    const syncLabel = isLoading ? '正在同步' : (syncError ? '同步失败' : (diaryError ? '日记待同步' : (snapshot.generatedBy === 'api' ? `同步于 ${formatWechatSnapshotTime(snapshot.updatedAt)}` : '尚未同步')));
    const retryId = quoteWechatJsString(char && char.id);
    const syncPill = syncError
        ? `<button type="button" class="wc-ai-phone-sync is-error" onclick="event.stopPropagation(); openWechatAiPhoneErrorPrompt(${retryId})" aria-label="查看小手机同步失败原因">${wcEscapeHtml(syncLabel)}</button>`
        : (diaryError ? `<button type="button" class="wc-ai-phone-sync is-error" onclick="switchWechatAiPhoneTab('diary')" aria-label="查看日记同步失败原因">${wcEscapeHtml(syncLabel)}</button>`
            : (!isLoading && snapshot.syncRecovered ? `<button type="button" class="wc-ai-phone-sync" onclick="event.stopPropagation(); completeWechatAiPhoneSnapshot(${retryId})" aria-label="补全小手机缺少的内容" title="${wcEscapeHtml(snapshot.syncRecovered)}">补全</button>` : `<div class="wc-ai-phone-sync">${wcEscapeHtml(syncLabel)}</div>`));
    return `
        <div class="wc-ai-phone-home">
            <div class="wc-ai-phone-home-top">
                <button type="button" class="wc-ai-phone-close" onclick="closeWechatAiPhone()"><i class="ri-close-line"></i></button>
                ${syncPill}
                <div class="wc-ai-phone-home-actions">
                    <button type="button" class="wc-ai-phone-generate ${isLoading ? 'is-loading' : ''}" onclick="event.stopPropagation(); regenerateWechatAiPhoneSnapshot(${retryId})" aria-label="手动同步小手机" title="手动同步" ${isLoading ? 'disabled aria-busy="true"' : ''}>
                        <i class="${isLoading ? 'ri-loader-4-line' : 'ri-refresh-line'}"></i>
                    </button>
                </div>
            </div>
            <div class="cp-home-pages" data-page="${pageIndex}" onscroll="updateCharPhoneHomePage(this)">
                ${pages.map((items,index)=>`<section class="cp-home-page ${index === 0 ? 'has-widgets' : ''}" aria-label="桌面第 ${index+1} 页">
                    ${index === 0 ? renderWechatAiPhonePhotoWidget(char) : ''}
                    <div class="wc-ai-phone-grid">${items.map(app=>renderWechatAiPhoneAppButton(app,char)).join('')}</div>
                </section>`).join('')}
            </div>
            <div class="cp-home-dots" aria-label="桌面页码">${pages.map((_,index)=>`<button aria-label="第 ${index+1} 页" aria-current="${index===pageIndex}" onclick="goCharPhoneHomePage(${index})" class="${index===pageIndex?'active':''}"></button>`).join('')}</div>
            <div class="wc-ai-phone-dock">
                ${dockApps.map(app => renderWechatAiPhoneAppButton(app, char)).join('')}
            </div>
        </div>
    `;
}

function updateWechatAiPhoneWallpaperTone(image) {
    const phone = image?.closest('.wc-ai-phone-ios.has-custom-wallpaper');
    if (!phone || !image.naturalWidth) return;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 24;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, 24, 24);
        const pixels = context.getImageData(0, 0, 24, 24).data;
        let brightness = 0;
        for (let index = 0; index < pixels.length; index += 4) {
            brightness += pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
        }
        phone.classList.toggle('has-light-wallpaper', brightness / (pixels.length / 4) > 156);
    } catch {
        // Imported remote images may disallow canvas reads; keep the default light labels.
        phone.classList.remove('has-light-wallpaper');
    }
}

function renderWechatAiPhone(char) {
    const modal = document.getElementById('wc-ai-phone-overlay');
    if (!modal || !char) return;
    const snapshot = getWechatAiPhoneRenderSnapshot(char);
    const isLoading = !!(window._wechatAiPhoneGenerating && window._wechatAiPhoneGenerating.has(char.id));
    const activeTab = window._wechatAiPhoneTab || 'home';
    const clock = getWechatAiPhoneClockParts();
    const meta = getWechatAiPhoneAppMeta(activeTab === 'wechatChat' ? 'chat' : activeTab, char, snapshot);
    const isHome = activeTab === 'home';
    const wallpaper = isHome ? getWechatAiPhoneHomeSettings(char).wallpaper : '';
    const backTarget = activeTab === 'wechatChat' ? 'chat' : 'home';
    const backLabel = activeTab === 'wechatChat' ? '微信' : '桌面';
    modal.innerHTML = `
        <div class="wc-ai-phone wc-ai-phone-ios ${isHome ? 'is-home' : 'is-app'}${wallpaper ? ' has-custom-wallpaper' : ''}">
            <div class="wc-ai-phone-status">
                <span>${wcEscapeHtml(clock.time)}</span>
                <b></b>
                <span><i class="ri-signal-wifi-fill"></i><i class="ri-battery-2-charge-fill"></i></span>
            </div>
            <div class="wc-ai-phone-wallpaper">
                ${wallpaper ? `<img class="wc-ai-phone-wallpaper-image" src="${wcEscapeAttr(wallpaper)}" alt="" aria-hidden="true" onload="updateWechatAiPhoneWallpaperTone(this)">` : ''}
                ${isHome ? renderWechatAiPhoneHome(snapshot, char, isLoading) : `
                    <div class="wc-ai-phone-app-page tone-${meta.tone} ${activeTab!=='wechatChat'?'cp-brand-shell':''}">
                        <div class="wc-ai-phone-app-nav">
                            <button type="button" onclick="switchWechatAiPhoneTab('${backTarget}')"><i class="ri-arrow-left-s-line"></i><span>${wcEscapeHtml(backLabel)}</span></button>
                            <strong><i class="${meta.icon}"></i>${wcEscapeHtml(activeTab === 'wechatChat' ? '微信' : activeTab === 'library' ? 'App 资料库' : meta.label)}</strong>
                            <button type="button" onclick="closeWechatAiPhone()"><i class="ri-close-line"></i></button>
                        </div>
                        <div class="wc-ai-phone-app-body ${activeTab!=='wechatChat' ? 'cp-app-host' : ''}">
                            ${renderWechatAiPhoneAppScreen(activeTab, snapshot, char, isLoading)}
                        </div>
                    </div>
                `}
            </div>
            <div class="wc-ai-phone-home-indicator"></div>
        </div>
    `;
    const pager = modal.querySelector('.cp-home-pages');
    if (pager) {
        pager.scrollLeft = Number(pager.dataset.page || 0) * pager.clientWidth;
        bindCharPhoneHomeSwipe(pager);
    }

}

function switchWechatAiPhoneTab(tabName) {
    if(window._wechatAiPhoneTab==='clock')resetCharPhoneClock();
    const validTabs = [...CHAR_PHONE_EXTRA_APPS.map(a=>a.key), 'library', 'home', 'chat', 'wechatChat', 'memo', 'browser', 'wallet', 'diary', 'footprints', 'usage', 'clock', 'schedule', 'shopping', 'takeout', 'games', 'settings'];
    window._charPhoneDetail = null;
    window._wechatAiPhoneTab = validTabs.includes(tabName) ? tabName : 'home';
    if (window._wechatAiPhoneTab !== 'diary') window._wechatAiPhoneDiaryOpen = -1;
    if (window._wechatAiPhoneTab !== 'memo') window._wechatAiPhoneMemoIndex = -1;
    if (window._wechatAiPhoneTab !== 'browser') window._wechatAiPhoneBrowserIndex = -1;
    const char = (window.myCharacters || []).find(c => c.id === window._wechatAiPhoneOpenCharId);
    if (char) {
        recordWechatAiPhoneAppUsage(char, window._wechatAiPhoneTab);
    }
    if (window._wechatAiPhoneTab !== 'wechatChat' && window._wechatAiPhoneTab !== 'chat') {
        window._wechatAiPhoneChatIndex = 0;
    }
    if (char) {
        saveCharactersToStorage();
        renderWechatAiPhone(char);
    }
}

function switchWechatAiPhoneChat(index) {
    const safeIndex = Math.max(0, Number(index || 0));
    window._wechatAiPhoneChatIndex = safeIndex;
    window._wechatAiPhoneTab = 'wechatChat';
    window._wechatAiPhoneDiaryOpen = -1;
    window._wechatAiPhoneMemoIndex = -1;
    window._wechatAiPhoneBrowserIndex = -1;
    const char = (window.myCharacters || []).find(c => c.id === window._wechatAiPhoneOpenCharId);
    if (char) {
        recordWechatAiPhoneAppUsage(char, 'wechatChat');
        saveCharactersToStorage();
        renderWechatAiPhone(char);
    }
}

function openWechatAiPhoneDiaryLetter(index) {
    window._wechatAiPhoneDiaryOpen = Math.max(0, Number(index || 0));
    const char = (window.myCharacters || []).find(c => c.id === window._wechatAiPhoneOpenCharId);
    if (char) renderWechatAiPhone(char);
}

function closeWechatAiPhoneDiaryLetter() {
    window._wechatAiPhoneDiaryOpen = -1;
    const char = (window.myCharacters || []).find(c => c.id === window._wechatAiPhoneOpenCharId);
    if (char) renderWechatAiPhone(char);
}

function openWechatAiPhoneMemoItem(index) {
    window._wechatAiPhoneMemoIndex = Math.max(0, Number(index || 0));
    window._wechatAiPhoneTab = 'memo';
    const char = (window.myCharacters || []).find(c => c.id === window._wechatAiPhoneOpenCharId);
    if (char) renderWechatAiPhone(char);
}

function closeWechatAiPhoneMemoItem() {
    window._wechatAiPhoneMemoIndex = -1;
    const char = (window.myCharacters || []).find(c => c.id === window._wechatAiPhoneOpenCharId);
    if (char) renderWechatAiPhone(char);
}

function openWechatAiPhoneBrowserItem(index) {
    window._wechatAiPhoneBrowserIndex = Math.max(0, Number(index || 0));
    window._wechatAiPhoneTab = 'browser';
    const char = (window.myCharacters || []).find(c => c.id === window._wechatAiPhoneOpenCharId);
    if (char) renderWechatAiPhone(char);
}

function closeWechatAiPhoneBrowserItem() {
    window._wechatAiPhoneBrowserIndex = -1;
    const char = (window.myCharacters || []).find(c => c.id === window._wechatAiPhoneOpenCharId);
    if (char) renderWechatAiPhone(char);
}


function updateCharPhoneHomePage(pager) {
    if (!pager.clientWidth) return;
    const page = Math.round(pager.scrollLeft / pager.clientWidth);
    window._charPhoneHomePage = page;
    pager.parentElement.querySelectorAll('.cp-home-dots button').forEach((button,index)=>{
        button.classList.toggle('active',index===page);
        button.setAttribute('aria-current',String(index===page));
    });
}
function goCharPhoneHomePage(index) {
    const pager=document.querySelector('#wc-ai-phone-overlay .cp-home-pages');
    if(pager) pager.scrollTo({left:index*pager.clientWidth,behavior:'smooth'});
}

// Own the character phone's gesture so mouse dragging and touch swiping both
// work, including when the gesture starts on an app icon.
function bindCharPhoneHomeSwipe(pager) {
    let gesture = null;
    let suppressClickUntil = 0;
    pager.addEventListener('pointerdown', event => {
        if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
        gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,left:pager.scrollLeft,page:Math.round(pager.scrollLeft/pager.clientWidth),dragging:false};
    });
    pager.addEventListener('pointermove', event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (!gesture.dragging) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
            if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
            gesture.dragging = true;
            pager.classList.add('is-dragging');
            pager.setPointerCapture(event.pointerId);
        }
        event.preventDefault();
        event.stopPropagation();
        pager.scrollLeft = gesture.left - dx;
    });
    const finish = event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const current = gesture;
        gesture = null;
        if (!current.dragging) return;
        const dx = event.clientX - current.x;
        const threshold = Math.min(64, pager.clientWidth * .18);
        const last = pager.querySelectorAll('.cp-home-page').length - 1;
        const target = event.type === 'pointercancel' ? current.page : Math.max(0,Math.min(last,current.page + (Math.abs(dx)>threshold ? (dx<0?1:-1):0)));
        suppressClickUntil = Date.now() + 400;
        pager.classList.remove('is-dragging');
        if (pager.hasPointerCapture(event.pointerId)) pager.releasePointerCapture(event.pointerId);
        pager.scrollTo({left:target*pager.clientWidth,behavior:'smooth'});
    };
    pager.addEventListener('pointerup', finish);
    pager.addEventListener('pointercancel', finish);
    pager.addEventListener('lostpointercapture', () => { gesture=null; pager.classList.remove('is-dragging'); });
    pager.addEventListener('click', event => {
        if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    pager.addEventListener('dragstart', event => event.preventDefault());
}
