    function renderPerspectiveSheet() { if (!perspectiveOpen) return '<div class="lw-sheet" hidden></div>'; const accounts = Object.values(loadState().accounts).filter(item => item && item.id); return `<div class="lw-sheet" role="dialog" aria-modal="true" onclick="if(event.target===this)LivingWorld.togglePerspective(false)"><section class="lw-sheet-panel"><h3>你正在透过谁的眼睛？</h3><p>切换只重排本地可见内容，不会重新生成论坛。</p>${accounts.map(item => `<button class="lw-perspective-option ${item.id === viewer().id ? 'active' : ''}" type="button" onclick="LivingWorld.setViewer('${escapeAttr(item.id)}')"><img src="${escapeAttr(item.avatar || DEFAULT_AVATAR)}" onerror="this.src='${escapeAttr(DEFAULT_AVATAR)}'"><span>${escapeHtml(item.name)}</span><small>${item.id === 'user' ? '我的视角' : '角色视角'}</small></button>`).join('')}</section></div>`; }

    function showToast(text) { const el = document.getElementById('lw-toast'); if (!el) return; el.textContent = text; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2400); }
    function setTab(tab) { if (tab === 'create') previousTab = activeTab; if (tab === 'notifications' && viewer().id !== 'user' && activeTab !== 'notifications') { try { mutate(next => { addEvent(next, 'forum_open_notification_as', 'user', next.viewerId, {}, 'private'); recordTrace(next, next.viewerId, 'open_notifications', 'medium'); }); } catch (error) { showToast(error.message); return; } } activeTab = tab; menuOpen = false; if (tab !== 'relationships') selectedRelationPair = null; if (tab !== 'create') communityPickerOpen = false; if (tab !== 'detail') activePostId = tab === 'profile' ? viewer().id : ''; if (tab === 'notifications') activityTab = 'notifications'; if (tab !== 'chat') activeThreadId = ''; render(); if (tab === 'profile' && viewer().id !== 'user') void ensureProfile(viewer().id); if (tab === 'media' && (!loadState().newsItems.length || now() - loadState().newsFetchedAt > 6 * 3600000)) void fetchRealNews(); }
    function toggleMenu(force) { menuOpen = typeof force === 'boolean' ? force : !menuOpen; render(); }
    function menuGo(tab) { menuOpen = false; setTab(tab); }
    function returnToDesktop() { menuOpen = false; if (typeof window.closeApp === 'function') window.closeApp('living-world'); else showToast('无法返回桌面。'); }
    function saveForumSettings() {
        const refreshMode = document.getElementById('lw-refresh-mode')?.value;
        const intervalHours = Number(document.getElementById('lw-refresh-hours')?.value);
        const profileMode = document.getElementById('lw-profile-mode')?.value;
        const replyMode = document.querySelector('input[name="lw-reply-mode"]:checked')?.value || loadState().forumSettings.replyMode;
        const promotionsEnabled = (document.getElementById('lw-promotion-enabled')?.value || 'yes') === 'yes';
        const promotionMinGap = Number(document.getElementById('lw-promotion-min')?.value ?? 8);
        const promotionMaxGap = Number(document.getElementById('lw-promotion-max')?.value ?? 15);
        if (!['manual','interval','smart'].includes(refreshMode) || ![3,6,12,24,48].includes(intervalHours) || !['economy','full'].includes(profileMode) || !['forum','app','off'].includes(replyMode) || !Number.isInteger(promotionMinGap) || !Number.isInteger(promotionMaxGap) || promotionMinGap < 4 || promotionMinGap > 30 || promotionMaxGap > 30 || promotionMinGap > promotionMaxGap) { showToast('设置项无效。'); return; }
        try {
            mutate(next => {
                const old = next.forumSettings;
                next.forumSettings = { ...old, refreshMode, intervalHours, profileMode, replyMode, replyReactionsEnabled:replyMode !== 'off', promotionsEnabled, promotionMinGap, promotionMaxGap, nextSmartAt: refreshMode === 'smart' && old.refreshMode !== 'smart' ? nextSmartTime(now()) : old.nextSmartAt };
                if (replyMode === 'off') {
                    next.interactionHandled.push(...next.interactionQueue.map(item => item.commentId));
                    next.interactionHandled = next.interactionHandled.slice(-160);
                    next.interactionQueue = [];
                }
            });
            render(); showToast('论坛设置已保存。');
        } catch (error) { showToast(error.message); }
    }
    function setPromotionEnabled(value) { const input = document.getElementById('lw-promotion-enabled'); if (input) input.value = value ? 'yes' : 'no'; document.querySelectorAll('.lw-promo-segment button').forEach((button,index) => button.classList.toggle('active',index === (value ? 0 : 1))); }
    function updatePromotionGap(kind,value) { const min = document.getElementById('lw-promotion-min'), max = document.getElementById('lw-promotion-max'); if (!min || !max) return; if (kind === 'min' && Number(value) > Number(max.value)) max.value = value; if (kind === 'max' && Number(value) < Number(min.value)) min.value = value; document.getElementById('lw-promotion-min-display').textContent = `${min.value} 条`; document.getElementById('lw-promotion-max-display').textContent = `${max.value} 条`; }
    function setCommunity(id) { activeCommunity = id || ''; activeTab = 'home'; render(); }
    function openCommunity(id) { activeCommunity = id; activeTab = 'home'; render(); }
    function openPost(id) { const post = loadState().posts.find(item => item.id === id); if (!post || !isVisible(post, viewer().id)) { showToast('帖子不可访问。'); return; } activePostId = id; replyTargetId = ''; replyComposerOpen = false; commentQuery = ''; commentSearchOpen = false; postActionSheetOpen = false; showPostTranslation = false; activeTab = 'detail'; render(); }
    function openProfile(id) { activePostId = id; activeTab = 'profile'; profileTab = 'posts'; profileEditOpen = false; render(); if (id !== 'user' && account(id).id !== 'unknown') void ensureProfile(id); }
    function refreshProfile(id) { void ensureProfile(id, true); }
    function back() { if (selectedRelationPair) { closeRelation(); return; } if (postActionSheetOpen) { togglePostActions(false); return; } if (replyComposerOpen) { closeReplyComposer(); return; } if (activeTab === 'chat' && activeThreadId) { activeThreadId = ''; activeTab = 'notifications'; activityTab = 'chat'; render(); } else if (activeTab === 'news-detail') { activeTab = 'media'; activeNewsId = ''; render(); } else if (activeTab === 'media' && mediaProfileId) { activeTab = 'profile'; activePostId = mediaProfileId; mediaProfileId = ''; render(); } else if (['detail','promotion','profile','communities','settings','relationships','media','chat','notifications'].includes(activeTab)) { activeTab = 'home'; activePostId = ''; render(); } else if (activeTab === 'create') setTab(previousTab === 'create' ? 'home' : previousTab); else returnToDesktop(); }
    function togglePerspective(force) { perspectiveOpen = typeof force === 'boolean' ? force : !perspectiveOpen; render(); }
    function toggleSearch(force) { searchOpen = typeof force === 'boolean' ? force : !searchOpen; render(); if (searchOpen) setTimeout(() => document.getElementById('lw-search-input')?.focus(), 0); }
    function submitSearch(event) { event.preventDefault(); const term = document.getElementById('lw-search-input')?.value.trim() || ''; if (term.startsWith('bynd://forum/post/')) { openPostLink(term); return false; } if (term) { try { mutate(next => { next.searches[next.viewerId] = [term.slice(0, 80), ...safeList(next.searches[next.viewerId]).filter(item => item !== term)].slice(0, 12); if (next.viewerId !== 'user') { addEvent(next, 'forum_search_as', 'user', next.viewerId, { query: term.slice(0, 80) }, 'private'); recordTrace(next, next.viewerId, 'search', 'high', { query: term.slice(0, 80) }); } }); } catch (error) { showToast(error.message); return false; } } searchQuery = term; activeTab = 'home'; activePostId = ''; render(); return false; }
    function searchFor(term) { const input = document.getElementById('lw-search-input'); if (input) input.value = term; submitSearch({ preventDefault() {} }); }
    function clearSearch() { searchQuery = ''; searchOpen = false; render(); }
    function openChat() { activeTab = 'chat'; activeThreadId = ''; activityTab = 'chat'; render(); }
    function setActivityTab(tab) { activityTab = tab === 'chat' ? 'chat' : 'notifications'; activeThreadId = ''; render(); }
    function setProfileTab(tab) { if (!['posts','replies','media','saved'].includes(tab)) return; if (tab === 'media') { mediaProfileId = activePostId || viewer().id; setTab('media'); return; } profileTab = tab; render(); }
    function editProfile(force) { profileEditOpen = typeof force === 'boolean' ? force : !profileEditOpen; if (!profileEditOpen) draftProfileAvatar = ''; render(); }
    function pickProfileAvatar(input) { const file = input?.files?.[0]; if (!file) return; if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type) || file.size > 1024 * 1024) { showToast('请选择小于 1 MB 的 PNG、JPG、WebP 或 GIF 头像。'); input.value = ''; return; } const reader = new FileReader(); reader.onload = () => { draftProfileAvatar = String(reader.result || ''); const note = document.createElement('small'); note.textContent = '已选择本地头像'; input.closest('label')?.after(note); }; reader.onerror = () => showToast('头像读取失败。'); reader.readAsDataURL(file); }
    function saveProfile(event) { event.preventDefault(); if (activeTab !== 'profile' || activePostId !== viewer().id) return false; const name = document.getElementById('lw-profile-name')?.value.trim(); const username = document.getElementById('lw-profile-username')?.value.trim() || viewer().username; const summary = document.getElementById('lw-profile-summary')?.value.trim() || ''; const avatarUrl = document.getElementById('lw-profile-avatar-url')?.value.trim() || ''; if (!name) { showToast('请填写显示名称。'); return false; } if (!/^@[\p{L}\p{N}_.-]{2,31}$/u.test(username)) { showToast('@ 昵称需以 @ 开头，后接 2–31 个字母、汉字、数字、下划线、点或横线。'); return false; } if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) { showToast('头像链接需以 http 或 https 开头。'); return false; } try { mutate(next => { const id = next.viewerId; const edit = { ...next.profileEdits[id], name: name.slice(0, 40), username, summary: summary.slice(0, 220) }; if (draftProfileAvatar || avatarUrl) edit.avatar = draftProfileAvatar || avatarUrl.slice(0, 800); next.profileEdits[id] = edit; next.accounts[id] = { ...next.accounts[id], ...edit }; }); profileEditOpen = false; draftProfileAvatar = ''; render(); showToast('论坛资料已保存。'); } catch (error) { showToast(error.message); } return false; }
    function toggleCommunityPicker(force) { communityPickerOpen = typeof force === 'boolean' ? force : !communityPickerOpen; document.querySelector('.lw-community-sheet')?.remove(); if (communityPickerOpen) document.querySelector('.lw-shell')?.insertAdjacentHTML('beforeend',renderComposeCommunityPicker()); }
    function selectComposeCommunity(id) { if (!loadState().communities.some(item => item.id === id)) return; composeCommunityId = id; activeCommunity = id; const select = document.getElementById('lw-post-community'); if (select) select.value = id; const picker = document.querySelector('.lw-community-picker'); if (picker) picker.firstChild.textContent = `${community(id).name} `; toggleCommunityPicker(false); updateCompose(); }
    function showComposeCommunityForm() { const form = document.getElementById('lw-compose-community-form'); if (form) { form.hidden = false; document.getElementById('lw-community-name')?.focus(); } }
    function updateCompose() { const title = document.getElementById('lw-post-title')?.value.trim(); const button = document.getElementById('lw-publish'); if (button) button.disabled = !title || !document.getElementById('lw-post-community')?.value; const picker = document.querySelector('.lw-community-picker'); if (picker) picker.firstChild.textContent = `${community(document.getElementById('lw-post-community')?.value).name} `; }
    function toggleLinkInput(kind = 'image') { const input = document.getElementById('lw-post-image'); if (input) { const sameOpen = !input.hidden && input.dataset.kind === kind; input.hidden = sameOpen; input.dataset.kind = kind === 'video' ? 'video' : 'image'; input.placeholder = kind === 'video' ? '视频链接（https://）' : '图片链接（https://）'; if (!input.hidden) input.focus(); } }
    function togglePoll() { const fields = document.getElementById('lw-poll-fields'); if (fields) { fields.hidden = !fields.hidden; if (!fields.hidden) fields.querySelector('input')?.focus(); } }
    function addPollOption() { const fields = document.getElementById('lw-poll-fields'); if (!fields || fields.querySelectorAll('.lw-poll-option').length >= 6) return; const input = document.createElement('input'); input.className = 'lw-poll-option'; input.maxLength = 80; input.placeholder = `选项 ${fields.querySelectorAll('.lw-poll-option').length + 1}`; fields.querySelector('button')?.before(input); input.focus(); }
    function toggleAma(force) { const button = document.getElementById('lw-ama-button'); const card = document.getElementById('lw-ama-card'); if (!button || !card) return; const open = typeof force === 'boolean' ? force : !button.classList.contains('selected'); button.classList.toggle('selected',open); card.hidden = !open; if (!open) closeAmaPicker(); if (open) card.scrollIntoView?.({ block:'nearest', behavior:'smooth' }); }
    function openAmaPicker(kind) {
        if (kind !== 'start' && kind !== 'duration') return;
        const sheet = document.getElementById('lw-ama-picker');
        if (!sheet) return;
        const current = document.getElementById(kind === 'start' ? 'lw-ama-start-mode' : 'lw-ama-duration')?.value || (kind === 'start' ? 'now' : '4');
        const choices = kind === 'start'
            ? [['now','立即开始','发布后立刻开放问答','ri-flashlight-line'],['later','设定时间','预约未来 30 天内的时间','ri-calendar-event-line']]
            : [1,2,4,8,12,24].map(hours => [String(hours),`${hours} 小时`,'','ri-time-line']);
        sheet.dataset.kind = kind;
        sheet.innerHTML = `<section class="lw-ama-picker-panel" role="dialog" aria-modal="true" aria-label="${kind === 'start' ? '选择开始时间' : '选择持续时间'}"><div class="lw-ama-picker-handle"></div><div class="lw-ama-picker-head"><div><h2>${kind === 'start' ? '什么时候开始？' : '问答持续多久？'}</h2><p>${kind === 'start' ? '选择 AMA 对社区开放的时间' : '到期后帖子会从公开页面消失'}</p></div><button type="button" onclick="LivingWorld.closeAmaPicker()" aria-label="关闭选项"><i class="ri-close-line"></i></button></div><div class="lw-ama-picker-options ${kind === 'duration' ? 'is-duration' : ''}">${choices.map(([value,label,description,icon]) => `<button type="button" class="lw-ama-picker-option ${value === current ? 'selected' : ''}" onclick="LivingWorld.selectAmaOption('${value}')" aria-pressed="${value === current}"><i class="${icon}" aria-hidden="true"></i><span><b>${label}</b>${description ? `<small>${description}</small>` : ''}</span><i class="ri-check-line lw-ama-picker-check" aria-hidden="true"></i></button>`).join('')}</div></section>`;
        sheet.hidden = false;
        sheet.onclick = event => { if (event.target === sheet) closeAmaPicker(); };
    }
    function closeAmaPicker() { const sheet = document.getElementById('lw-ama-picker'); if (sheet) { sheet.hidden = true; sheet.innerHTML = ''; } }
    function selectAmaOption(value) {
        const sheet = document.getElementById('lw-ama-picker');
        if (!sheet || sheet.hidden) return;
        if (sheet.dataset.kind === 'start' && ['now','later'].includes(value)) {
            document.getElementById('lw-ama-start-mode').value = value;
            document.getElementById('lw-ama-start-label').textContent = value === 'now' ? '立即开始' : '设定时间';
            updateAmaStart();
        } else if (sheet.dataset.kind === 'duration' && ['1','2','4','8','12','24'].includes(value)) {
            document.getElementById('lw-ama-duration').value = value;
            document.getElementById('lw-ama-duration-label').textContent = `${value} 小时`;
        } else return;
        closeAmaPicker();
    }
    function updateAmaStart() { const input = document.getElementById('lw-ama-start-at'); if (input) { input.hidden = document.getElementById('lw-ama-start-mode')?.value !== 'later'; if (!input.hidden && !input.value) { const start = new Date(now() + 3600000); input.value = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}T${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`; } } }
    function removeDraftImage() { draftImage = ''; document.querySelector('.lw-draft-image')?.remove(); }
    function pickImage(input) { const file = input?.files?.[0]; if (!file) return; if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type) || file.size > 20 * 1024 * 1024) { showToast('请选择小于 20 MB 的 PNG、JPG、WebP 或 GIF 图片。'); input.value = ''; return; } compressImageFile(file).then(dataUrl => { draftImage = dataUrl; document.querySelector('.lw-draft-image')?.remove(); const container = document.createElement('div'); container.className = 'lw-draft-image'; const img = document.createElement('img'); img.src = draftImage; img.alt = '待发布图片'; const button = document.createElement('button'); button.type = 'button'; button.textContent = '移除'; button.onclick = removeDraftImage; container.append(img, button); document.querySelector('.lw-compose-tools')?.before(container); }).catch(error => { if (input) input.value = ''; showToast(error?.message || '图片读取失败。'); }); }
    // Forum media lives inside the localStorage world state, so every picked image is downscaled to a JPEG first.
    function compressImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('图片读取失败。'));
            reader.onload = () => {
                const image = new Image();
                image.onerror = () => reject(new Error('图片无法读取。'));
                image.onload = () => {
                    try {
                        const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height; let side = MAX_IMAGE_SIDE;
                        for (const quality of [.82, .7, .58]) {
                            const scale = Math.min(1, side / Math.max(width, height, 1));
                            const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
                            const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
                            const result = canvas.toDataURL('image/jpeg', quality);
                            if (result.length <= MAX_IMAGE_DATA_URL) { resolve(result); return; }
                            side = Math.round(side * .75);
                        }
                        reject(new Error('图片压缩后仍然过大，请换一张较小的图片。'));
                    } catch (error) { reject(error); }
                };
                image.src = String(reader.result || '');
            };
            reader.readAsDataURL(file);
        });
    }
