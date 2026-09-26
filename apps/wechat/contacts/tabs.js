// --- 📑 微信 Tab 切换 ---

function switchWcTab(tabName) {
    const root = document.getElementById('app-wechat-window');
    const targetView = document.getElementById('wc-view-' + tabName);
    const alreadyActive = !!(targetView && targetView.classList.contains('active'));
    const views = document.querySelectorAll('.wc-tab-view');
    views.forEach(v => v.classList.remove('active'));

    const tabs = document.querySelectorAll('.wc-tab-bar .wc-tab');
    tabs.forEach(t => t.classList.remove('active'));

    if (typeof applyWechatUiTheme === 'function') applyWechatUiTheme(undefined, { update: false });

    if (targetView) targetView.classList.add('active');

    const tabIndex = { chat: 0, contacts: 1, discover: 2, me: 3 };
    if (tabs[tabIndex[tabName]]) tabs[tabIndex[tabName]].classList.add('active');

    const header = document.querySelector('.wechat-header');
    const titleEl = header.querySelector('.wc-header-title');
    const rightEl = header.querySelector('.wc-header-right');

    const theme = getWechatUiTheme();
    titleEl.textContent = getWechatThemeTabMeta(tabName, theme).title || '微信';
    if (!alreadyActive || root?.dataset.lastThemeStructureTab !== tabName || root?.dataset.uiTheme !== theme.id) {
        updateWechatUiThemeStructure(theme);
        if (root) root.dataset.lastThemeStructureTab = tabName;
    }

    if (tabName === 'chat') {
        rightEl.style.display = '';
    } else {
        rightEl.style.display = 'none';
    }

    if (tabName === 'contacts') renderContacts();
    if (tabName === 'discover') renderWechatDiscoverTab();
    if (tabName === 'me') renderMePage();
}

// === Telegram reference tab renderers 20260525 ===
function isWechatTelegramTheme() {
    return getWechatUiThemeId() === 'telegram';
}

function isWechatLineTheme() {
    return getWechatUiThemeId() === 'line';
}

function syncWechatLineRoomHeader(theme = (typeof getWechatUiTheme === 'function' ? getWechatUiTheme() : { id: '' })) {
    const header = document.querySelector('#app-wechat-window .wc-chat-room .wc-room-header');
    if (!header) return;
    let actions = header.querySelector('.wc-line-room-actions');
    if (!theme || theme.id !== 'line') {
        actions?.remove();
        header.classList.remove('wc-line-room-header-ready');
        delete header.dataset.lineBackCount;
        const oldBackIcon = Array.from(header.children).find(child => child.tagName === 'I');
        oldBackIcon?.removeAttribute('data-line-back-count');
        return;
    }
    const currentId = window.currentChatCharId || '';
    const backCount = (window.myCharacters || []).reduce((sum, char) => {
        if (!char || char.id === currentId) return sum;
        return sum + getTelegramChatUnreadCount(char);
    }, 0);
    header.dataset.lineBackCount = backCount > 99 ? '99+' : (backCount > 0 ? String(backCount) : '');
    const backIcon = Array.from(header.children).find(child => child.tagName === 'I');
    if (backIcon) backIcon.dataset.lineBackCount = header.dataset.lineBackCount || '';
    if (!actions) {
        actions = document.createElement('div');
        actions.className = 'wc-line-room-actions';
        header.appendChild(actions);
    }
    actions.innerHTML = `
        <button type="button" onclick="closeApp('wechat')" aria-label="home"><i class="ri-arrow-left-line"></i></button>
        <button type="button" onclick="openWechatCurrentChatSearch()" aria-label="search"><i class="ri-search-line"></i></button>
        <button type="button" onclick="startWechatCall('voiceCall')" aria-label="call"><i class="ri-phone-line"></i></button>
        <button type="button" onclick="openChatSettings()" aria-label="menu"><i class="ri-menu-line"></i></button>
    `;
    header.classList.add('wc-line-room-header-ready');
}
window.syncWechatLineRoomHeader = syncWechatLineRoomHeader;

function isWechatXTheme() {
    return getWechatUiThemeId() === 'hallowrok';
}

function getWechatXPeople() {
    return (window.myCharacters || []).filter(char => char && char.id && !char.isGroupChat && !isWechatGroupNpcContact(char));
}

function renderWechatDiscoverTab() {
    const view = document.getElementById('wc-view-discover');
    if (!view) return;
    if (!window._wechatDefaultDiscoverHtml) window._wechatDefaultDiscoverHtml = view.innerHTML;
    if (isWechatLineTheme()) {
        renderLineHomePage(view);
        return;
    }
    if (isWechatXTheme()) {
        renderXNotificationsPage(view);
        return;
    }
    if (!isWechatTelegramTheme()) {
        if (view.dataset.telegramPage === '1' || view.dataset.linePage === '1' || view.dataset.xPage === '1') {
            view.innerHTML = window._wechatDefaultDiscoverHtml;
            delete view.dataset.telegramPage;
            delete view.dataset.linePage;
            delete view.dataset.xPage;
        }
        return;
    }
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const avatar = wcEscapeHtml(profile.avatar || DEFAULT_AVATAR);
    const name = wcEscapeHtml(profile.name || '\u6211');
    const signature = wcEscapeHtml(profile.signature || '\u70b9\u51fb\u8bbe\u7f6e\u4e2a\u6027\u7b7e\u540d');
    view.dataset.telegramPage = '1';
    delete view.dataset.linePage;
    view.innerHTML = `
        <div class="wc-telegram-page wc-telegram-settings-page">
            <div class="wc-telegram-top-profile">
                <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div><strong>${name}</strong><span>${signature}</span></div>
                <button type="button" onclick="openWechatMeSettings()" aria-label="edit"><i class="ri-edit-2-line"></i></button>
            </div>
            <button type="button" class="wc-telegram-confirm-card" onclick="openWechatUiThemeSettings()">
                <i class="ri-shield-check-line"></i>
                <div><strong>\u7535\u62a5\u98ce\u683c\u8bbe\u7f6e</strong><span>\u4fdd\u7559 Telegram \u7684\u767d\u8272\u5361\u7247\u3001\u7c89\u8272\u91cd\u70b9\u548c\u7d27\u51d1\u5217\u8868\u3002</span></div>
            </button>
            <div class="wc-telegram-settings-list">
                <button type="button" onclick="openWechatUiThemeSettings()"><b style="--tg-icon:#ff4aa2"><i class="ri-palette-line"></i></b><span>\u9875\u9762\u7f8e\u5316</span><em>\u4e3b\u9898</em></button>
                <button type="button" onclick="openWechatFavorites()"><b style="--tg-icon:#f5a623"><i class="ri-bookmark-3-line"></i></b><span>\u6536\u85cf\u4e0e\u5907\u5fd8</span><em>\u6536\u85cf</em></button>
                <button type="button" onclick="openWechatMoments()"><b style="--tg-icon:#39bdf8"><i class="ri-image-2-line"></i></b><span>\u52a8\u6001\u4e0e\u670b\u53cb\u5708</span><em>\u52a8\u6001</em></button>
                <button type="button" onclick="openWechatStickerStore()"><b style="--tg-icon:#8b5cf6"><i class="ri-emotion-happy-line"></i></b><span>\u8868\u60c5\u5305</span><em>\u8868\u60c5</em></button>
                <button type="button" onclick="openWechatShop()"><b style="--tg-icon:#10b981"><i class="ri-shopping-bag-3-line"></i></b><span>\u8d2d\u7269\u548c\u793c\u7269</span><em>\u793c\u7269</em></button>
                <button type="button" onclick="openWechatTakeout()"><b style="--tg-icon:#1677ff"><i class="ri-restaurant-2-line"></i></b><span>\u5916\u5356</span><em>\u9910\u98df</em></button>
            </div>
            <div class="wc-telegram-settings-actions">
                <button type="button" onclick="openWechatMeSettings()">\u7f16\u8f91\u8d44\u6599</button>
                <button type="button" onclick="openWechatUiThemeSettings()">\u5207\u6362\u4e3b\u9898</button>
            </div>
        </div>
    `;
}

function renderXNotificationsPage(view) {
    const people = getWechatXPeople();
    const unreadPeople = people
        .map(char => ({ char, count: getTelegramChatUnreadCount(char), time: formatWechatChatListTime(char) }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    view.dataset.xPage = '1';
    delete view.dataset.telegramPage;
    delete view.dataset.linePage;
    view.innerHTML = `
        <div class="wc-x-page wc-x-notifications-page">
            <div class="wc-x-page-head">
                <img src="${wcEscapeHtml(profile.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                <strong>通知</strong>
                <button type="button" onclick="openWechatUiThemeSettings()" aria-label="设置"><i class="ri-settings-3-line"></i></button>
            </div>
            <div class="wc-x-tabs">
                <button type="button" class="active" onclick="renderWechatDiscoverTab()">全部</button>
                <button type="button" onclick="openWechatMoments()">已认证</button>
                <button type="button" onclick="openWechatMoments()">提及</button>
            </div>
            <div class="wc-x-notification-list">
                ${unreadPeople.length ? unreadPeople.map(item => `
                    <button type="button" class="wc-x-notification-item" onclick="openChatFromContact(${quoteWechatJsString(item.char.id)})">
                        <img src="${wcEscapeHtml(item.char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                        <span><strong>${wcEscapeHtml((item.char.chatConfig && item.char.chatConfig.nickname) || item.char.name || '联系人')}</strong><em>给你发来了 ${item.count > 99 ? '99+' : item.count} 条新私信</em></span>
                        <time>${wcEscapeHtml(item.time)}</time>
                    </button>
                `).join('') : `
                    <div class="wc-x-empty-block">
                        <h2>这里暂时还没有通知</h2>
                        <p>当角色点赞、评论你的动态，或者给你发送新消息时，会显示在这里。</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderXContacts(query = '') {
    const list = document.getElementById('wc-contacts-list');
    if (!list) return;
    const rawQuery = String(query || '');
    const q = rawQuery.trim().toLowerCase();
    const people = getWechatXPeople();
    const filtered = q ? people.filter(char => {
        const haystack = [
            (char.chatConfig && char.chatConfig.nickname) || char.name || '',
            (char.chatConfig && char.chatConfig.signature) || '',
            getWechatProfileBio(char) || '',
            getChatPreview(char) || ''
        ].join(' ').toLowerCase();
        return haystack.includes(q);
    }) : people;
    list.innerHTML = `
        <div class="wc-x-page wc-x-search-page">
            <div class="wc-x-page-head">
                <button type="button" class="wc-x-backless" onclick="switchWcTab('chat')" aria-label="返回私信"><i class="ri-arrow-left-line"></i></button>
                <div class="wc-x-search-input-wrap">
                    <i class="ri-search-line"></i>
                    <input value="${wcEscapeHtml(rawQuery)}" placeholder="搜索" oninput="renderContacts(this.value)">
                </div>
            </div>
            <div class="wc-x-search-tabs"><span class="active">热门</span><span>最新</span><span>用户</span><span>媒体</span></div>
            <div class="wc-x-contact-list">
                ${filtered.length ? filtered.map(char => `
                    <button type="button" class="wc-x-contact-item" onclick="openWechatContactProfile(${quoteWechatJsString(char.id)})">
                        <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                        <span><strong>${wcEscapeHtml((char.chatConfig && char.chatConfig.nickname) || char.name || '联系人')}</strong><em>${wcEscapeHtml((char.chatConfig && char.chatConfig.signature) || getWechatProfileBio(char) || getChatPreview(char) || '点击查看资料')}</em></span>
                        <i class="ri-more-line"></i>
                    </button>
                `).join('') : `
                    <div class="wc-x-empty-block">
                        <h2>没有找到相关用户</h2>
                        <p>换个关键词，或者先导入角色卡添加联系人。</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderXMePage(page, profile) {
    const avatar = wcEscapeHtml(profile.avatar || DEFAULT_AVATAR);
    const name = wcEscapeHtml(profile.name || '我');
    const id = wcEscapeHtml(profile.wechatId || 'user');
    const signature = wcEscapeHtml(profile.signature || '点击设置个性签名');
    const coverStyle = profile.xCover ? `style="background-image:${getWechatCssUrl(profile.xCover)}"` : '';
    const people = getWechatXPeople();
    const followerCount = people.length ? Math.max(1, Math.round(people.length * 1.6)) : 0;
    const store = typeof getWechatMomentStore === 'function' ? getWechatMomentStore() : { posts: [] };
    const posts = Array.isArray(store.posts) ? store.posts.filter(post => post && !post.charId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
    const latestPost = posts[0] || null;
    const joinedAt = profile.joinedAt || profile.createdAt || profile.importedAt || '';
    const joinedDate = joinedAt && !Number.isNaN(new Date(joinedAt).getTime())
        ? `${new Date(joinedAt).getFullYear()}年${new Date(joinedAt).getMonth() + 1}月加入`
        : '加入 BYND';
    const birthday = profile.birthday || profile.birthDate || '';
    const postText = latestPost && String(latestPost.text || '').trim()
        ? wcEscapeHtml(String(latestPost.text).trim()).replace(/\n/g, '<br>')
        : '还没有发布动态，点这里写一条新的。';
    const postDate = latestPost && latestPost.createdAt ? formatWechatRelativeTime(latestPost.createdAt) : '现在';
    const postImages = latestPost && Array.isArray(latestPost.images) ? latestPost.images.filter(Boolean).slice(0, 2) : [];
    page.innerHTML = `
        <div class="wc-x-page wc-x-home-page">
            <div class="wc-x-profile-hero">
                <button type="button" class="wc-x-home-cover" ${coverStyle} onclick="openWechatXCoverSheet()" aria-label="更换 X 背景"></button>
                <div class="wc-x-hero-actions">
                    <button type="button" onclick="closeApp('wechat')" aria-label="返回桌面"><i class="ri-arrow-left-line"></i></button>
                    <span></span>
                    <button type="button" onclick="switchWcTab('contacts')" aria-label="搜索"><i class="ri-search-line"></i></button>
                    <button type="button" onclick="openWechatMomentCameraSheet()" aria-label="发布朋友圈"><i class="ri-edit-2-line"></i></button>
                    <button type="button" onclick="openWechatUiThemeSettings()" aria-label="更多"><i class="ri-more-2-fill"></i></button>
                </div>
            </div>
            <div class="wc-x-profile-body">
                <div class="wc-x-profile-main">
                    <button type="button" class="wc-x-profile-avatar-btn" onclick="openWechatMeAvatarSheet()" aria-label="更换头像">
                        <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
                    </button>
                    <button type="button" class="wc-x-profile-edit-btn" onclick="openWechatMeSettings()">编辑个人资料</button>
                </div>
                <div class="wc-x-profile-copy">
                    <div class="wc-x-name-row">
                        <strong data-wc-me-field="name">${name}</strong>
                        <button type="button" onclick="openWechatMeSettings()"><i class="ri-verified-badge-fill"></i><span>通过认证</span></button>
                    </div>
                    <span>@${id}</span>
                    <p data-wc-me-field="signature">${signature}</p>
                    <div class="wc-x-profile-meta">
                        ${birthday ? `<em><i class="ri-map-pin-line"></i>出生于 ${wcEscapeHtml(birthday)}</em>` : ''}
                        <em><i class="ri-calendar-line"></i>${wcEscapeHtml(joinedDate)}</em>
                    </div>
                    <div class="wc-x-follow-row"><b>${people.length}</b><span>正在关注</span><b>${followerCount}</b><span>关注者</span></div>
                </div>
            </div>
            <div class="wc-x-tabs profile">
                <button type="button" class="active" onclick="openWechatMoments()">帖子</button>
                <button type="button" onclick="openWechatMoments()">回复</button>
                <button type="button" onclick="openWechatFavorites()">亮点</button>
                <button type="button" onclick="openWechatMoments()">文章</button>
                <button type="button" onclick="openWechatFavorites()">媒体</button>
            </div>
            <button type="button" class="wc-x-profile-post" onclick="openWechatMoments()">
                <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
                <span>
                    <strong>${name} <em>@${id} · ${wcEscapeHtml(postDate)}</em></strong>
                    <p>${postText}</p>
                    ${postImages.length ? `<b>${postImages.map(src => `<img src="${wcEscapeHtml(src)}" onerror="this.style.opacity='0.35'">`).join('')}</b>` : ''}
                    <small><i class="ri-chat-3-line"></i><i class="ri-repeat-2-line"></i><i class="ri-heart-3-line"></i>${Math.max(people.length, posts.length || 1)}<i class="ri-bar-chart-line"></i>${Math.max(12, people.length * 8 + posts.length * 3)}</small>
                </span>
                <i class="ri-more-2-fill"></i>
            </button>
            <div class="wc-x-news-section">
                <div class="wc-x-news-title">
                    <h3>实时新闻</h3>
                    <button type="button" onclick="refreshWechatXRealtimeNews()"><i class="ri-refresh-line"></i>刷新</button>
                </div>
                <div id="wc-x-realtime-news-list" class="wc-x-news-list">
                    <div class="wc-x-news-loading">正在拉取真实新闻...</div>
                </div>
            </div>
            <button type="button" class="wc-x-profile-fab" onclick="openWechatMomentCameraSheet()" aria-label="发布朋友圈"><i class="ri-add-line"></i></button>
        </div>
    `;
    loadWechatXRealtimeNews(false);
}

const WECHAT_X_NEWS_CACHE_KEY = 'wechat_x_realtime_news_cache_v4';

function getWechatXNewsCache() {
    try {
        const cache = JSON.parse(localStorage.getItem(WECHAT_X_NEWS_CACHE_KEY) || 'null');
        return cache && Array.isArray(cache.items) ? cache : null;
    } catch (e) {
        return null;
    }
}

function saveWechatXNewsCache(items) {
    try {
        localStorage.setItem(WECHAT_X_NEWS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), items }));
    } catch (e) {}
}

function isWechatXChineseText(value) {
    return /[\u3400-\u9fff]/.test(String(value || ''));
}

function getWechatXNewsDisplayTitle(item) {
    return item.titleCn || item.title || '新闻标题读取中';
}

function isWechatXNewsNeedsTranslation(item) {
    return !!(item && item.title && !item.titleCn && !isWechatXChineseText(item.title));
}

function getWechatXNewsDisplayBody(item) {
    const body = item && (item.bodyCn || item.bodyOriginal);
    return String(body || '').trim();
}

function renderWechatXNewsInlineMarkdown(text) {
    return wcEscapeHtml(text)
        .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
}

function renderWechatXNewsBodyHtml(item) {
    const body = getWechatXNewsDisplayBody(item);
    if (body) {
        const paragraphs = body
            .split(/\n{2,}|\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .slice(0, 10);
        return `
            <div class="wc-x-news-body">
                <h3>${isWechatXChineseText(body) ? '正文' : '原文正文'}</h3>
                ${paragraphs.map(line => `<p>${renderWechatXNewsInlineMarkdown(line)}</p>`).join('')}
            </div>
        `;
    }
    if (item && item.detailLoading) {
        return '<div class="wc-x-news-body wc-x-news-body-state"><i class="ri-loader-4-line"></i><span>正在读取原文正文...</span></div>';
    }
    if (item && item.detailError) {
        return `<div class="wc-x-news-body wc-x-news-body-state error"><i class="ri-error-warning-line"></i><span>${wcEscapeHtml(item.detailError)}</span></div><button type="button" class="wc-x-news-open-link" onclick="retryWechatXNewsArticleDetail()"><i class="ri-refresh-line"></i><span>重新读取正文</span></button>`;
    }
    return '<div class="wc-x-news-body wc-x-news-body-state"><i class="ri-file-search-line"></i><span>点开后会读取真实原文正文。</span></div>';
}

function cleanWechatXReaderMarkdown(text) {
    const raw = String(text || '')
        .replace(/\r/g, '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/!\[[^\]]*]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/^\s*(?:Title|URL Source|Markdown Content|Published Time|Warning):.*$/gmi, '')
        .replace(/^\s*[-*_]{3,}\s*$/gm, '');
    const lines = raw.split('\n')
        .map(line => line.replace(/^#{1,6}\s*/, '').replace(/^\s*[-*+]\s+/, '').trim())
        .filter(line => line && !/^https?:\/\//i.test(line) && !/^(cookie|subscribe|advertisement|sign in|log in)$/i.test(line));
    const chunks = [];
    let buf = '';
    lines.forEach(line => {
        if (buf.length + line.length > 220) {
            if (buf) chunks.push(buf);
            buf = line;
        } else {
            buf = buf ? `${buf} ${line}` : line;
        }
    });
    if (buf) chunks.push(buf);
    return chunks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 4200);
}

async function translateWechatXNewsBodyIfNeeded(item) {
    if (!item || !item.bodyOriginal || item.bodyCn || isWechatXChineseText(item.bodyOriginal) || typeof callChatApi !== 'function') return;
    if (isWechatBackgroundApiPaused() || isWechatAiStatusGenerationActive()) return;
    const source = String(item.bodyOriginal || '').slice(0, 3600);
    const result = await callChatApi([
        { role: 'system', content: '你是新闻翻译编辑。把原文翻译成自然中文，只保留原文事实，不要编造，不要总结成一句话。输出 3 到 8 段正文，不要 Markdown 标题。' },
        { role: 'user', content: `标题：${item.title || ''}\n\n原文正文：\n${source}` }
    ], { background: true, usageFeature: 'discover' });
    if (result && result.ok && result.content && isWechatXChineseText(result.content)) {
        item.bodyCn = String(result.content).trim().slice(0, 2600);
    }
}

function persistWechatXNewsItems(items) {
    const list = Array.isArray(items) ? items : [];
    const cache = getWechatXNewsCache();
    try {
        localStorage.setItem(WECHAT_X_NEWS_CACHE_KEY, JSON.stringify({
            updatedAt: cache?.updatedAt || Date.now(),
            source: cache?.source || 'GDELT / HN',
            readerVersion: cache?.readerVersion || 0,
            items: list
        }));
    } catch (e) {}
}

function refreshWechatXNewsDetailIfOpen(item) {
    const body = document.getElementById('wc-feature-body');
    const title = document.getElementById('wc-feature-title');
    if (item && body && title && title.textContent === '新闻详情' && window._wechatXNewsDetailUrl === item.url) {
        body.innerHTML = renderWechatXNewsDetailHtml(item);
    }
}

async function loadWechatXNewsArticleDetail(item, items) {
    if (!item || !item.url || item.detailLoading || getWechatXNewsDisplayBody(item)) return;
    item.detailLoading = true;
    item.detailError = '';
    refreshWechatXNewsDetailIfOpen(item);
    try {
        const article = await window.ByndNewsReader.read(item.sourceUrl || item.url, url => {
            item.sourceUrl = url;
            item.domain = new URL(url).hostname.replace(/^www\./, '');
            if (String(item.source || '').includes('news.google.com')) item.source = item.domain;
        });
        const text = cleanWechatXReaderMarkdown(article.body);
        if (!text || text.length < 80) throw new Error('正文为空');
        item.bodyOriginal = text;
        if (isWechatXChineseText(text)) {
            item.bodyCn = text.slice(0, 2600);
        } else {
            await translateWechatXNewsBodyIfNeeded(item);
        }
    } catch (e) {
        item.detailError = '正文暂时无法读取，请重试或打开原文。';
        console.warn('[X news] article read failed:', e);
    } finally {
        item.detailLoading = false;
        item.detailLoadedAt = Date.now();
        persistWechatXNewsItems(items);
        refreshWechatXNewsDetailIfOpen(item);
    }
}

function retryWechatXNewsArticleDetail() {
    const items = window._wechatXRealtimeNewsItems || getWechatXNewsCache()?.items || [];
    const item = items.find(row => row.url === window._wechatXNewsDetailUrl);
    if (item) return loadWechatXNewsArticleDetail(item, items);
}
window.retryWechatXNewsArticleDetail = retryWechatXNewsArticleDetail;

function normalizeWechatXFullTextNews(data) {
    const seen = new Set();
    return (Array.isArray(data?.results) ? data.results : []).map(row => {
        const url = window.ByndNewsReader.safeUrl(row.url);
        const title = String(row.title || '').trim();
        const bodyOriginal = cleanWechatXReaderMarkdown(row.text || '');
        if (!url || !title || bodyOriginal.length < 80 || seen.has(url)) return null;
        seen.add(url);
        const domain = new URL(url).hostname.replace(/^www\./, '');
        return {
            title, titleCn: isWechatXChineseText(title) ? title : '', url, sourceUrl: url, domain,
            image: window.ByndNewsReader.safeUrl(row.image), time: row.published_at || row.crawled_at || '',
            source: row.sitename || domain, bodyOriginal,
            bodyCn: isWechatXChineseText(bodyOriginal) ? bodyOriginal : ''
        };
    }).filter(Boolean).slice(0, 8);
}

async function fetchWechatXFullTextNews() {
    const data = await fetchWechatXJson('https://freenewsapi.ai/v1/search?lang=zh&date=24h&size=100&sort=crawled&full_text=true', {
        timeoutMs: 8000, label: '中文新闻正文'
    });
    return normalizeWechatXFullTextNews(data);
}

function normalizeWechatXGdeltNews(data) {
    const rows = Array.isArray(data && data.articles) ? data.articles : [];
    const seen = new Set();
    return rows.map(item => {
        const url = String(item.url || '').trim();
        const title = String(item.title || '').trim();
        if (!url || !title || seen.has(url)) return null;
        seen.add(url);
        return {
            title,
            titleCn: isWechatXChineseText(title) ? title : '',
            url,
            domain: item.domain || '',
            image: item.socialimage || '',
            time: item.seendate || item.date || '',
            source: [item.domain, item.sourcecountry || item.language].filter(Boolean).join(' · ') || 'GDELT'
        };
    }).filter(Boolean).slice(0, 6);
}

function normalizeWechatXHackerNews(data) {
    const rows = Array.isArray(data && data.hits) ? data.hits : [];
    return rows.map(item => {
        const url = String(item.url || '').trim();
        const title = String(item.title || '').trim();
        if (!url || !title) return null;
        let domain = '';
        try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
        return {
            title,
            titleCn: '',
            url,
            domain,
            image: '',
            time: item.created_at || '',
            source: [domain || 'Hacker News', item.points ? `${item.points} points` : ''].filter(Boolean).join(' · ')
        };
    }).filter(Boolean).slice(0, 6);
}

function normalizeWechatXRss2JsonNews(data) {
    const rows = Array.isArray(data && data.items) ? data.items : [];
    const seen = new Set();
    return rows.map(item => {
        const url = String(item.link || item.guid || '').trim();
        const title = String(item.title || '').trim();
        if (!url || !title || seen.has(url)) return null;
        seen.add(url);
        let domain = '';
        try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
        return {
            title,
            titleCn: isWechatXChineseText(title) ? title : '',
            url,
            domain,
            image: item.thumbnail || item.enclosure && item.enclosure.link || '',
            time: item.pubDate || '',
            source: [domain || 'Google News', item.author || '中文新闻'].filter(Boolean).join(' · ')
        };
    }).filter(Boolean).slice(0, 8);
}

async function fetchWechatXJson(url, options = {}) {
    const timeoutMs = Number(options.timeoutMs || 6500);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const resp = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!resp.ok) throw new Error(`${options.label || 'API'} ${resp.status}`);
        return await resp.json();
    } finally {
        clearTimeout(timer);
    }
}

async function fetchWechatXGdeltNews(query, label, options = {}) {
    const params = new URLSearchParams({
        query,
        mode: 'artlist',
        format: 'json',
        timespan: options.timespan || '24h',
        sort: 'datedesc',
        maxrecords: String(options.maxrecords || 12)
    });
    const data = await fetchWechatXJson(`https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`, {
        timeoutMs: options.timeoutMs || 6500,
        label: label || 'GDELT'
    });
    return normalizeWechatXGdeltNews(data);
}

async function fetchWechatXHackerNews() {
    const data = await fetchWechatXJson('https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=8', {
        timeoutMs: 5500,
        label: 'Hacker News'
    });
    return normalizeWechatXHackerNews(data);
}

async function fetchWechatXGoogleNewsRss() {
    const rssUrl = 'https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans';
    const data = await fetchWechatXJson(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`, {
        timeoutMs: 6500,
        label: 'Google News RSS'
    });
    return normalizeWechatXRss2JsonNews(data);
}

function formatWechatXNewsTime(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '实时';
    return formatWechatRelativeTime(date.getTime());
}

function renderWechatXRealtimeNews(items, meta = {}) {
    const box = document.getElementById('wc-x-realtime-news-list');
    if (!box) return;
    if (!Array.isArray(items) || !items.length) {
        box.innerHTML = `<div class="wc-x-news-empty">${wcEscapeHtml(meta.message || '暂时没有拉到实时新闻，点刷新再试。')}</div>`;
        return;
    }
    const cards = items.map((item, index) => `
        <button type="button" class="wc-x-news-card" onclick="openWechatXNewsDetail(${index})">
            <div class="wc-x-news-thumb">
                ${item.image ? `<img src="${wcEscapeHtml(item.image)}" loading="lazy" onerror="this.closest('.wc-x-news-thumb').classList.add('no-image');this.remove();">` : ''}
                <span>${wcEscapeHtml((item.domain || 'NEWS').slice(0, 10).toUpperCase())}</span>
            </div>
            <strong>${wcEscapeHtml(getWechatXNewsDisplayTitle(item))}</strong>
            <em>${wcEscapeHtml(item.source || '实时新闻')} · ${wcEscapeHtml(formatWechatXNewsTime(item.time))}</em>
        </button>
    `).join('');
    box.innerHTML = `${cards}<div class="wc-x-news-source">真实新闻源：${wcEscapeHtml(meta.source || 'GDELT / HN')} · ${wcEscapeHtml(meta.cached ? '缓存' : '实时')}</div>`;
    window._wechatXRealtimeNewsItems = items;
    translateWechatXNewsItemsIfNeeded(items);
}

function openWechatXNewsDetail(index) {
    const items = Array.isArray(window._wechatXRealtimeNewsItems) ? window._wechatXRealtimeNewsItems : (getWechatXNewsCache()?.items || []);
    const item = items[index];
    if (!item) {
        showWechatToast('新闻还没加载好');
        return;
    }
    window._wechatXNewsDetailUrl = item.url || '';
    openWechatFeatureScreen('新闻详情', renderWechatXNewsDetailHtml(item));
    loadWechatXNewsArticleDetail(item, items);
    if (isWechatXNewsNeedsTranslation(item)) {
        translateWechatXNewsItemsIfNeeded(items, { render: true }).then(() => {
            const latest = Array.isArray(window._wechatXRealtimeNewsItems) ? window._wechatXRealtimeNewsItems[index] : item;
            const body = document.getElementById('wc-feature-body');
            const title = document.getElementById('wc-feature-title');
            if (body && title && title.textContent === '新闻详情' && window._wechatXNewsDetailUrl === item.url) {
                body.innerHTML = renderWechatXNewsDetailHtml(latest || item);
            }
        }).catch(() => {});
    }
}

function renderWechatXNewsDetailHtml(item) {
    const needsTranslation = isWechatXNewsNeedsTranslation(item);
    const original = item.titleCn && item.title && item.titleCn !== item.title
        ? `<p class="wc-x-news-original">原文：${wcEscapeHtml(item.title)}</p>`
        : (needsTranslation ? `<p class="wc-x-news-original">原文：${wcEscapeHtml(item.title)}</p>` : '');
    const title = wcEscapeHtml(getWechatXNewsDisplayTitle(item));
    const articleUrl = window.ByndNewsReader.safeUrl(item.sourceUrl || item.url);
    const url = wcEscapeHtml(articleUrl);
    const host = item.domain || (() => {
        try { return new URL(articleUrl).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
    })();
    return `
        <div class="wc-x-news-detail">
            ${item.image ? `<img class="wc-x-news-detail-image" src="${wcEscapeHtml(item.image)}" onerror="this.style.display='none'">` : ''}
            <h2>${title}</h2>
            ${original}
            <div class="wc-x-news-detail-meta">${wcEscapeHtml(item.source || '实时新闻')} · ${wcEscapeHtml(formatWechatXNewsTime(item.time))}</div>
            ${needsTranslation ? '<div class="wc-x-news-translating"><i class="ri-translate-2"></i><span>正在翻译标题，稍等一下...</span></div>' : ''}
            ${renderWechatXNewsBodyHtml(item)}
            ${articleUrl ? `<button type="button" class="wc-x-news-open-link" onclick="window.open(${quoteWechatJsString(articleUrl)}, '_blank', 'noopener,noreferrer')"><i class="ri-external-link-line"></i><span>打开原文链接</span></button>` : ''}
            ${url ? `<p class="wc-x-news-url">${wcEscapeHtml(host || '原文地址')} · ${url}</p>` : ''}
        </div>
    `;
}

async function translateWechatXNewsItemsIfNeeded(items, options = {}) {
    const list = Array.isArray(items) ? items : [];
    const pending = list
        .map((item, index) => ({ item, index }))
        .filter(row => row.item && row.item.title && !row.item.titleCn && !isWechatXChineseText(row.item.title))
        .slice(0, 6);
    if (!pending.length || typeof callChatApi !== 'function') return false;
    if (isWechatBackgroundApiPaused() || isWechatAiStatusGenerationActive()) return false;
    if (window._wechatXNewsTranslating) return false;
    window._wechatXNewsTranslating = true;
    try {
        const result = await callChatApi([
            { role: 'system', content: '你是新闻标题翻译器。只输出 JSON 数组，不要解释。把英文新闻标题翻译成简洁自然的中文，每项对应输入顺序。' },
            { role: 'user', content: JSON.stringify(pending.map(row => row.item.title)) }
        ], { background: true, usageFeature: 'discover' });
        if (!result || !result.ok) {
            return false;
        }
        const raw = String(result.content || '').replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return false;
        let changed = false;
        pending.forEach((row, i) => {
            const translated = String(arr[i] || '').trim();
            if (translated && isWechatXChineseText(translated)) {
                row.item.titleCn = translated.slice(0, 90);
                changed = true;
            }
        });
        if (changed) {
            const cache = getWechatXNewsCache();
            if (cache && Array.isArray(cache.items)) {
                localStorage.setItem(WECHAT_X_NEWS_CACHE_KEY, JSON.stringify({
                    ...cache,
                    items: list,
                    translatedAt: Date.now()
                }));
            }
            if (options.render !== false) {
                renderWechatXRealtimeNews(list, { source: cache?.source || 'GDELT / HN', cached: false });
            }
            const detailUrl = window._wechatXNewsDetailUrl || '';
            if (detailUrl) {
                const detailItem = list.find(item => item && item.url === detailUrl);
                const body = document.getElementById('wc-feature-body');
                const title = document.getElementById('wc-feature-title');
                if (detailItem && body && title && title.textContent === '新闻详情') {
                    body.innerHTML = renderWechatXNewsDetailHtml(detailItem);
                }
            }
        }
        return changed;
    } catch (e) {
        return false;
    } finally {
        window._wechatXNewsTranslating = false;
    }
}

window.openWechatXNewsDetail = openWechatXNewsDetail;

async function loadWechatXRealtimeNews(force = false) {
    const box = document.getElementById('wc-x-realtime-news-list');
    if (!box) return;
    const cache = getWechatXNewsCache();
    if (!force && cache?.readerVersion === 1 && Date.now() - Number(cache.updatedAt || 0) < 10 * 60 * 1000) {
        renderWechatXRealtimeNews(cache.items, { source: cache.source || 'GDELT', cached: true });
        return;
    }
    box.innerHTML = '<div class="wc-x-news-loading">正在拉取真实新闻...</div>';
    const sources = [
        {
            name: '中文新闻 · 来源正文',
            run: () => fetchWechatXFullTextNews()
        },
        {
            name: 'GDELT 中文综合',
            run: () => fetchWechatXGdeltNews('sourcelang:Chinese', 'GDELT 中文综合', { timespan: '12h', maxrecords: 14, timeoutMs: 6500 })
        },
        {
            name: 'Hacker News',
            run: () => fetchWechatXHackerNews()
        },
        {
            name: 'Google News 中文',
            run: () => fetchWechatXGoogleNewsRss()
        }
    ];
    const errors = [];
    try {
        for (const source of sources) {
            try {
                const items = await source.run();
                if (items && items.length) {
                    try {
                        localStorage.setItem(WECHAT_X_NEWS_CACHE_KEY, JSON.stringify({
                            updatedAt: Date.now(),
                            source: source.name,
                            readerVersion: 1,
                            items
                        }));
                    } catch (e) {}
                    renderWechatXRealtimeNews(items, { source: source.name, cached: false });
                    return;
                }
                errors.push(`${source.name}: empty`);
            } catch (sourceErr) {
                errors.push(`${source.name}: ${sourceErr && sourceErr.message || 'failed'}`);
            }
        }
        throw new Error(errors.join(' | '));
    } catch (err) {
        console.warn('x realtime news load failed:', err);
        if (cache && cache.items && cache.items.length) {
            renderWechatXRealtimeNews(cache.items, { source: cache.source || '缓存新闻', cached: true });
            return;
        }
        renderWechatXRealtimeNews([], { message: '实时新闻加载失败，没有使用假数据。请检查网络后刷新。' });
    }
}

function refreshWechatXRealtimeNews() {
    loadWechatXRealtimeNews(true);
}

window.refreshWechatXRealtimeNews = refreshWechatXRealtimeNews;

function getLineThemePeople() {
    return (window.myCharacters || []).filter(char => char && char.id && !char.isGroupChat && !isWechatGroupNpcContact(char));
}

function getLineBirthdayValues(char) {
    const config = (char && char.chatConfig) || {};
    const profile = getWechatAiContactProfile(char) || {};
    return [
        config.birthday,
        config.birthDate,
        config.birth,
        config.profileBirthday,
        config.contactProfile && config.contactProfile.birthday,
        profile.birthday,
        char && char.birthday,
        char && char.birthDate,
        char && char.birth,
        char && char.profile && char.profile.birthday,
        String(char && char.description || '').match(/(?:生日|出生|birth(?:day)?)[：:\s]*([12]\d{3}[-/.年]\d{1,2}[-/.月]\d{1,2}日?|\d{1,2}[-/.月]\d{1,2}日?)/i)?.[1]
    ].filter(Boolean).map(value => String(value).trim());
}

function isLineBirthdayToday(value, today = new Date()) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const normalized = raw.replace(/[年月.]/g, '-').replace(/日/g, '').replace(/\//g, '-');
    const dateMatch = normalized.match(/(?:^|\D)(?:(\d{4})-)?(\d{1,2})-(\d{1,2})(?:\D|$)/);
    if (dateMatch) {
        return Number(dateMatch[2]) === month && Number(dateMatch[3]) === day;
    }
    return new RegExp(`(?:^|\\D)${month}\\s*月\\s*${day}\\s*日(?:\\D|$)`).test(raw);
}

function getLineBirthdayPeople() {
    const today = new Date();
    return getLineThemePeople().filter(char => getLineBirthdayValues(char).some(value => isLineBirthdayToday(value, today)));
}

function getLineFavoritePeople() {
    return getLineThemePeople()
        .slice()
        .sort((a, b) => getTelegramChatUnreadCount(b) - getTelegramChatUnreadCount(a))
        .slice(0, 6);
}

function renderLineHomePage(view) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const avatar = wcEscapeHtml(profile.avatar || DEFAULT_AVATAR);
    const name = wcEscapeHtml(profile.name || '\u6211');
    const signature = wcEscapeHtml(profile.signature || '\u70b9\u51fb\u8bbe\u7f6e\u4e2a\u6027\u7b7e\u540d');
    const people = getLineThemePeople();
    const groups = (window.myCharacters || []).filter(char => char && char.isGroupChat);
    const favorites = getLineFavoritePeople();
    const birthdayPeople = getLineBirthdayPeople();
    const favoriteHtml = favorites.map(char => `
        <button type="button" class="wc-line-favorite" onclick="openChatFromContact(${quoteWechatJsString(char.id)})">
            <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
            <span>${wcEscapeHtml((char.chatConfig && char.chatConfig.nickname) || char.name || '\u597d\u53cb')}</span>
        </button>
    `).join('');
    view.dataset.linePage = '1';
    delete view.dataset.telegramPage;
    view.innerHTML = `
        <div class="wc-line-page wc-line-home-page">
            <div class="wc-line-home-top">
                <div class="wc-line-home-profile">
                    <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'" onclick="openWechatMeAvatarSheet()">
                    <button type="button" data-wc-me-field="signature">
                        <strong>${name}</strong>
                        <span>${signature}</span>
                    </button>
                </div>
                <div class="wc-line-home-actions">
                    <button type="button" onclick="closeApp('wechat')" aria-label="home"><i class="ri-arrow-left-line"></i></button>
                    <button type="button" onclick="showWechatToast('\u6682\u65e0\u65b0\u901a\u77e5')" aria-label="\u901a\u77e5"><i class="ri-notification-3-line"></i></button>
                    <button type="button" onclick="openWechatGroupCreator()" aria-label="\u6dfb\u52a0\u597d\u53cb"><i class="ri-user-add-line"></i></button>
                    <button type="button" onclick="openWechatMeSettings()" aria-label="\u8bbe\u7f6e"><i class="ri-settings-3-line"></i></button>
                </div>
            </div>
            <div class="wc-line-home-search"><i class="ri-search-line"></i><span>\u641c\u7d22</span></div>
            <div class="wc-line-section-list">
                ${birthdayPeople.length ? `<button type="button" onclick="renderContacts()"><span>\u4eca\u65e5\u5bff\u661f</span><em>${birthdayPeople.length}</em></button>` : ''}
                <button type="button" onclick="switchWcTab('chat')"><span>\u6211\u7684\u6700\u7231</span><em>${Math.max(1, favorites.length)}</em></button>
                <button type="button" onclick="openWechatGroupCreator()"><span>\u7fa4\u7ec4</span><em>${groups.length}</em></button>
                <button type="button" onclick="renderContacts()"><span>\u597d\u53cb</span><em>${people.length}</em></button>
            </div>
            ${favoriteHtml ? `<div class="wc-line-favorite-row">${favoriteHtml}</div>` : ''}
            <div class="wc-line-service-card">
                <div class="wc-line-section-title"><strong>\u670d\u52a1</strong><button type="button" onclick="openWechatUiThemeSettings()">\u7f16\u8f91</button></div>
                <div class="wc-line-service-grid">
                    <button type="button" onclick="openWechatStickerStore()"><i class="ri-emotion-happy-line"></i><span>\u8d34\u56fe\u5c0f\u94fa</span></button>
                    <button type="button" onclick="openWechatUiThemeSettings()"><i class="ri-palette-line"></i><span>\u4e3b\u9898\u5c0f\u94fa</span></button>
                    <button type="button" onclick="openWechatFavorites()"><i class="ri-shield-star-line"></i><span>\u5b98\u65b9\u5e10\u53f7</span></button>
                    <button type="button" onclick="openWechatTakeout()"><i class="ri-taxi-line"></i><span>LINE TAXI</span></button>
                    <button type="button" onclick="openApp('game')"><i class="ri-gamepad-line"></i><span>LINE GAME</span></button>
                    <button type="button" onclick="openApp('music')"><i class="ri-music-2-line"></i><span>LINE MUSIC</span></button>
                    <button type="button" onclick="openWechatMoments()"><i class="ri-tv-2-line"></i><span>LINE TV</span></button>
                    <button type="button" onclick="openWechatPlusMenu(event)"><i class="ri-add-circle-line"></i><span>\u65b0\u589e</span></button>
                </div>
            </div>
            <div class="wc-line-recommend-card">
                <div class="wc-line-section-title"><strong>\u63a8\u8350\u8d44\u8baf</strong><button type="button" onclick="openWechatMoments()">\u66f4\u591a</button></div>
                <div class="wc-line-recommend-row">
                    <button type="button" onclick="openWechatMoments()"><b>\u597d\u53cb\u52a8\u6001</b><span>\u67e5\u770b\u89d2\u8272\u6700\u8fd1\u7684\u670b\u53cb\u5708\u7559\u8a00</span></button>
                    <button type="button" onclick="openWechatShop()"><b>\u793c\u7269\u4e0e\u8d2d\u7269</b><span>\u4e70\u5230\u7684\u4e1c\u897f\u548c\u4ee3\u4ed8\u90fd\u5728\u8fd9\u91cc</span></button>
                </div>
            </div>
        </div>
    `;
}

function renderTelegramContacts(query = '') {
    const list = document.getElementById('wc-contacts-list');
    if (!list) return;
    const rawQuery = String(query || '');
    const q = rawQuery.trim().toLowerCase();
    const chars = getWechatGroupContacts({ includeGroupNpc: false });
    const filtered = q ? chars.filter(c => {
        const haystack = [
            (c.chatConfig && c.chatConfig.nickname) || c.name || '',
            (c.chatConfig && c.chatConfig.signature) || '',
            getWechatProfileBio(c) || '',
            getWechatContactId(c) || '',
            getWechatContactRegion(c) || ''
        ].join(' ').toLowerCase();
        return haystack.includes(q);
    }) : chars;
    const people = filtered.map(c => {
        const displayName = wcEscapeHtml((c.chatConfig && c.chatConfig.nickname) || c.name || '\u672a\u547d\u540d');
        const sub = wcEscapeHtml((c.chatConfig && c.chatConfig.signature) || getWechatProfileBio(c) || '\u70b9\u51fb\u67e5\u770b\u8d44\u6599');
        const avatar = wcEscapeHtml(c.avatar || DEFAULT_AVATAR);
        return `
            <button type="button" class="wc-telegram-contact-row" onclick="openWechatContactProfile(${quoteWechatJsString(c.id)})">
                <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
                <span><strong>${displayName}</strong><em>${sub}</em></span>
                <i class="ri-arrow-right-s-line"></i>
            </button>
        `;
    }).join('');
    list.innerHTML = `
        <div class="wc-telegram-page wc-telegram-contacts-page">
            <div class="wc-telegram-page-head">
                <h2>\u8054\u7cfb\u4eba</h2>
                <button type="button" onclick="openWechatGroupCreator()" aria-label="add"><i class="ri-user-add-line"></i></button>
            </div>
            <div class="wc-telegram-search"><i class="ri-search-line"></i><input value="${wcEscapeHtml(rawQuery)}" placeholder="\u641c\u7d22\u8054\u7cfb\u4eba" oninput="renderContacts(this.value)"></div>
            <div class="wc-telegram-contact-actions">
                <button type="button" onclick="openWechatGroupCreator()"><b><i class="ri-group-line"></i></b><span>\u65b0\u5efa\u7fa4\u804a</span></button>
                <button type="button" onclick="openWechatUiThemeSettings()"><b><i class="ri-palette-line"></i></b><span>\u9875\u9762\u7f8e\u5316</span></button>
            </div>
            <div class="wc-telegram-section-title">${q ? '\u641c\u7d22\u7ed3\u679c' : '\u6700\u8fd1\u8054\u7cfb\u4eba'}</div>
            <div class="wc-telegram-contact-card">${people || '<div class="wc-telegram-empty">\u6ca1\u6709\u627e\u5230\u8054\u7cfb\u4eba</div>'}</div>
            <button type="button" class="wc-telegram-floating-add" onclick="openWechatGroupCreator()"><i class="ri-add-line"></i></button>
        </div>
    `;
}

function renderTelegramMePage(page, profile) {
    const avatar = wcEscapeHtml(profile.avatar || DEFAULT_AVATAR);
    const name = wcEscapeHtml(profile.name || '\u6211');
    const id = wcEscapeHtml(profile.wechatId || '');
    const signature = wcEscapeHtml(profile.signature || '\u70b9\u51fb\u8bbe\u7f6e\u7b7e\u540d');
    page.innerHTML = `
        <div class="wc-telegram-page wc-telegram-profile-page">
            <div class="wc-telegram-profile-hero">
                <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'" onclick="openWechatMeAvatarSheet()">
                <strong>${name}</strong>
                <span>@${id}</span>
                <em>${signature}</em>
            </div>
            <div class="wc-telegram-profile-actions">
                <button type="button" onclick="openWechatMoments()"><i class="ri-image-line"></i><span>\u52a8\u6001</span></button>
                <button type="button" onclick="openWechatFavorites()"><i class="ri-bookmark-line"></i><span>\u6536\u85cf</span></button>
                <button type="button" onclick="openWechatMeSettings()"><i class="ri-settings-3-line"></i><span>\u8bbe\u7f6e</span></button>
            </div>
            <div class="wc-telegram-profile-card">
                <button type="button" data-wc-me-field="name"><span>\u6635\u79f0</span><strong>${name}</strong></button>
                <button type="button" data-wc-me-field="wechatId"><span>ID</span><strong>${id}</strong></button>
                <button type="button" data-wc-me-field="signature"><span>\u7b7e\u540d</span><strong>${signature}</strong></button>
            </div>
            <div class="wc-telegram-profile-tabs"><button class="active">\u52a8\u6001</button><button>\u5df2\u5f52\u6863\u7684\u52a8\u6001</button></div>
            <div class="wc-telegram-profile-empty">
                <i class="ri-chat-heart-line"></i>
                <strong>\u6682\u65f6\u8fd8\u6ca1\u6709\u52a8\u6001</strong>
                <span>\u53d1\u5e03\u4e00\u6761\u56fe\u6587\uff0c\u8ba9\u89d2\u8272\u4e5f\u80fd\u770b\u89c1\u4f60\u7684\u72b6\u6001\u3002</span>
                <button type="button" onclick="openWechatMoments()">\u6dfb\u52a0\u52a8\u6001</button>
            </div>
        </div>
    `;
}

function renderLineContacts(query = '') {
    const list = document.getElementById('wc-contacts-list');
    if (!list) return;
    const rawQuery = String(query || '');
    const q = rawQuery.trim().toLowerCase();
    const chars = getWechatGroupContacts({ includeGroupNpc: false });
    const groups = (window.myCharacters || []).filter(char => char && char.isGroupChat);
    const filtered = q ? chars.filter(c => {
        const haystack = [
            (c.chatConfig && c.chatConfig.nickname) || c.name || '',
            (c.chatConfig && c.chatConfig.signature) || '',
            getWechatProfileBio(c) || '',
            getWechatContactId(c) || ''
        ].join(' ').toLowerCase();
        return haystack.includes(q);
    }) : chars;
    const peopleHtml = filtered.map(c => `
        <button type="button" class="wc-line-contact-row" onclick="openWechatContactProfile(${quoteWechatJsString(c.id)})">
            <img src="${wcEscapeHtml(c.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
            <span><strong>${wcEscapeHtml((c.chatConfig && c.chatConfig.nickname) || c.name || '\u597d\u53cb')}</strong><em>${wcEscapeHtml((c.chatConfig && c.chatConfig.signature) || getWechatProfileBio(c) || '\u70b9\u51fb\u67e5\u770b\u8d44\u6599')}</em></span>
            <i class="ri-arrow-right-s-line"></i>
        </button>
    `).join('');
    list.innerHTML = `
        <div class="wc-line-page wc-line-contacts-page">
            <div class="wc-line-page-head">
                <h2>\u597d\u53cb</h2>
                <div>
                    <button type="button" onclick="openWechatGroupCreator()" aria-label="\u6dfb\u52a0"><i class="ri-user-add-line"></i></button>
                    <button type="button" onclick="openWechatSearch()" aria-label="\u641c\u7d22"><i class="ri-search-line"></i></button>
                </div>
            </div>
            <div class="wc-line-home-search"><i class="ri-search-line"></i><input value="${wcEscapeHtml(rawQuery)}" placeholder="\u641c\u7d22\u597d\u53cb" oninput="renderContacts(this.value)"></div>
            <div class="wc-line-section-list compact">
                <button type="button" onclick="openWechatGroupCreator()"><span>\u7fa4\u7ec4</span><em>${groups.length}</em></button>
                <button type="button" onclick="switchWcTab('chat')"><span>\u6700\u8fd1\u804a\u5929</span><em>${chars.length}</em></button>
                <button type="button" onclick="openWechatUiThemeSettings()"><span>\u4e3b\u9898\u4e0e\u8bbe\u7f6e</span><em><i class="ri-arrow-right-s-line"></i></em></button>
            </div>
            <div class="wc-line-section-title"><strong>${q ? '\u641c\u7d22\u7ed3\u679c' : '\u597d\u53cb'}</strong><small>${filtered.length}</small></div>
            <div class="wc-line-contact-list">${peopleHtml || '<div class="wc-line-empty">\u6ca1\u6709\u627e\u5230\u597d\u53cb</div>'}</div>
        </div>
    `;
}

function renderLineMePage(page, profile) {
    const avatar = wcEscapeHtml(profile.avatar || DEFAULT_AVATAR);
    const name = wcEscapeHtml(profile.name || '\u6211');
    const id = wcEscapeHtml(profile.wechatId || '');
    const signature = wcEscapeHtml(profile.signature || '\u70b9\u51fb\u8bbe\u7f6e\u7b7e\u540d');
    page.innerHTML = `
        <div class="wc-line-page wc-line-wallet-page">
            <div class="wc-line-page-head">
                <h2>\u8bbe\u7f6e</h2>
                <div>
                    <button type="button" onclick="openWechatUiThemeSettings()" aria-label="\u4e3b\u9898"><i class="ri-palette-line"></i></button>
                    <button type="button" onclick="openWechatMeSettings()" aria-label="\u8bbe\u7f6e"><i class="ri-settings-3-line"></i></button>
                </div>
            </div>
            <div class="wc-line-me-card">
                <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'" onclick="openWechatMeAvatarSheet()">
                <button type="button" data-wc-me-field="signature">
                    <strong>${name}</strong>
                    <span>ID: ${id || 'user'}</span>
                    <em>${signature}</em>
                </button>
                <i class="ri-arrow-right-s-line"></i>
            </div>
            <div class="wc-line-wallet-grid">
                <button type="button" onclick="openWechatShop()"><i class="ri-shopping-bag-3-line"></i><span>\u8d2d\u7269</span></button>
                <button type="button" onclick="openWechatTakeout()"><i class="ri-restaurant-2-line"></i><span>\u5916\u5356</span></button>
                <button type="button" onclick="openWechatFavorites()"><i class="ri-bookmark-3-line"></i><span>\u6536\u85cf</span></button>
                <button type="button" onclick="openWechatMoments()"><i class="ri-image-2-line"></i><span>\u52a8\u6001</span></button>
            </div>
            <div class="wc-line-settings-list">
                <button type="button" onclick="openWechatUiThemeSettings()"><b><i class="ri-palette-line"></i></b><span>\u9875\u9762\u7f8e\u5316</span><em>Line \u4e3b\u9898</em></button>
                <button type="button" onclick="openWechatStickerStore()"><b><i class="ri-emotion-happy-line"></i></b><span>\u8d34\u56fe\u4e0e\u8868\u60c5</span><em>\u8868\u60c5\u5305</em></button>
                <button type="button" onclick="openWechatMeSettings()"><b><i class="ri-user-settings-line"></i></b><span>\u6211\u7684\u8d44\u6599</span><em>\u7f16\u8f91</em></button>
            </div>
        </div>
    `;
}
// === End Telegram reference tab renderers 20260525 ===

function renderContacts(query = '') {
    if (isWechatTelegramTheme()) { renderTelegramContacts(query); return; }
    if (isWechatLineTheme()) { renderLineContacts(query); return; }
    if (isWechatXTheme()) { renderXContacts(query); return; }
    const list = document.getElementById('wc-contacts-list');
    if (!list) return;
    const rawQuery = String(query || '');
    const q = rawQuery.trim().toLowerCase();
    const chars = getWechatGroupContacts({ includeGroupNpc: false });
    const filtered = q ? chars.filter(c => {
        const haystack = [
            (c.chatConfig && c.chatConfig.nickname) || c.name || '',
            (c.chatConfig && c.chatConfig.signature) || '',
            getWechatProfileBio(c) || '',
            getWechatContactId(c) || '',
            getWechatContactRegion(c) || ''
        ].join(' ').toLowerCase();
        return haystack.includes(q);
    }) : chars;
    const searchHtml = `
        <div class="wc-contacts-search-box">
            <div class="wc-contacts-search-inner">
                <i class="ri-search-line"></i>
                <input value="${wcEscapeHtml(rawQuery)}" placeholder="搜索联系人" oninput="renderContacts(this.value)">
            </div>
        </div>
    `;
    if (chars.length === 0) {
        list.innerHTML = searchHtml + '<div class="wc-contacts-empty">还没有联系人<br>导入角色卡添加好友吧~<br><button type="button" onclick="ByndBuiltinLibrary?.open()" style="margin-top:14px; border:none; border-radius:14px; padding:10px 18px; background:#14171d; color:#fff; font-size:13px; font-weight:800;">从内置角色开始</button></div>';
        return;
    }
    if (filtered.length === 0) {
        list.innerHTML = searchHtml + '<div class="wc-contacts-empty">没有找到这个联系人</div>';
        return;
    }
    list.innerHTML = searchHtml + filtered.map(c => `
        <div class="wc-contact-item" onclick="openWechatContactProfile(${quoteWechatJsString(c.id)})">
            <img class="wc-contact-avatar" src="${c.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
            <div class="wc-contact-text">
                <span class="wc-contact-name">${wcEscapeHtml((c.chatConfig && c.chatConfig.nickname) || c.name || '未命名')}</span>
                <em>${wcEscapeHtml((c.chatConfig && c.chatConfig.signature) || getWechatProfileBio(c) || '点击查看朋友资料')}</em>
            </div>
        </div>
    `).join('');
}

function openChatFromContact(charId) {
    const screen = document.getElementById('wc-feature-screen');
    if (screen) {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    }
    switchWcTab('chat');
    openChat(charId);
}

window._wechatContactProfileGenerating = window._wechatContactProfileGenerating || new Set();

function getWechatAiContactProfile(char) {
    const profile = (char && char.chatConfig && char.chatConfig.contactProfile) || null;
    if (!profile || typeof profile !== 'object') return null;
    if (isWechatLegacyFakeContactProfile(profile)) return null;
    const hasContent = ['wechatId', 'region', 'bio', 'signature'].some(key => String(profile[key] || '').trim());
    return hasContent ? profile : null;
}

function getWechatContactProfileMissingFields(profile) {
    const missing = [];
    if (!profile || !String(profile.wechatId || '').trim()) missing.push('微信号');
    if (!profile || !String(profile.region || '').trim()) missing.push('地区');
    return missing;
}

function hasUsableWechatContactProfile(char) {
    const profile = getWechatAiContactProfile(char);
    return !!profile && getWechatContactProfileMissingFields(profile).length === 0;
}

function isWechatLegacyFakeContactProfile(profile) {
    const region = String((profile && profile.region) || '').replace(/\s+/g, ' ').trim();
    return ['广东 深圳', '浙江 杭州', '四川 成都', '江苏 苏州', '北京 朝阳'].includes(region);
}

function getWechatContactId(char) {
    return (getWechatAiContactProfile(char) || {}).wechatId || '';
}

function getWechatContactRegion(char) {
    return (getWechatAiContactProfile(char) || {}).region || '';
}

function parseWechatAiJsonObject(text) {
    const raw = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try {
            return JSON.parse(raw.slice(start, end + 1));
        } catch (e) {}
    }
    const data = {};
    raw.split(/[\n；;]+/).forEach(line => {
        const parts = line.split(/[:：]/);
        if (parts.length < 2) return;
        const key = parts.shift().trim();
        const value = parts.join(':').trim();
        if (/微信号|wechat|wxid|id/i.test(key)) data.wechatId = value;
        else if (/地区|region|城市|city/i.test(key)) data.region = value;
        else if (/资料|简介|bio|介绍/i.test(key)) data.bio = value;
        else if (/签名|signature/i.test(key)) data.signature = value;
    });
    return data;
}

function normalizeWechatAiContactProfile(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const compact = value => String(value || '')
        .replace(/\|\|\|/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const profile = {
        wechatId: compact(data.wechatId || data.wxid || data.wechat || data.id).slice(0, 32),
        region: compact(data.region || data.city || data.location).slice(0, 32),
        bio: compact(data.bio || data.profile || data.description || data.about).slice(0, 160),
        signature: compact(data.signature || data.status || data.sign).slice(0, 36),
        generatedAt: Date.now()
    };
    return ['wechatId', 'region', 'bio', 'signature'].some(key => profile[key]) ? profile : null;
}

async function requestWechatAiContactProfile(charId, force = false) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char || window._wechatContactProfileGenerating.has(charId)) return;
    char.chatConfig = char.chatConfig || {};
    if (!force && hasUsableWechatContactProfile(char)) return;
    if (!force && (isWechatAiRateLimitPaused() || isWechatBackgroundApiPaused())) return;

    window._wechatContactProfileGenerating.add(charId);
    char.chatConfig.contactProfileError = '';
    saveCharactersToStorage();
    refreshWechatContactProfileView(charId);

    let result = { ok: false, content: '' };
    try {
        result = await callChatApi([
            {
                role: 'system',
                content: `你就是「${char.name || '这个角色'}」。请由你自己决定微信联系人资料页公开展示的信息，不要套模板，不要解释。微信号和地区必须返回非空：微信号要像真实微信号但符合角色气质；地区要根据角色设定或世界观推断，不确定也要写一个模糊但真实可信的公开地区。只输出 JSON：{"wechatId":"非空微信号","region":"非空地区","bio":"朋友资料一句话","signature":"个性签名"}。`
            },
            {
                role: 'user',
                content: `角色设定：\n${String(char.description || '').slice(0, 6000)}\n\n请生成你的微信公开资料。`
            }
        ], { background: !force, usageFeature: 'other', usageChar: char });
    } catch (e) {
        console.warn('contact profile generation failed', e);
    }

    char.chatConfig = char.chatConfig || {};
    if (result.ok) {
        const profile = normalizeWechatAiContactProfile(parseWechatAiJsonObject(result.content));
        if (profile) {
            char.chatConfig.contactProfile = profile;
            const missing = getWechatContactProfileMissingFields(profile);
            char.chatConfig.contactProfileError = missing.length
                ? `AI 返回的${missing.join('和')}为空，点这里重试`
                : '';
            if (!char.chatConfig.signature && profile.signature) char.chatConfig.signature = profile.signature;
        } else {
            char.chatConfig.contactProfileError = 'AI 没有返回可用资料，点这里重试';
        }
    } else {
        char.chatConfig.contactProfileError = 'AI 资料生成失败，点这里重试';
    }

    window._wechatContactProfileGenerating.delete(charId);
    saveCharactersToStorage();
    refreshWechatContactProfileView(charId);
}

function refreshWechatContactProfileView(charId) {
    if (document.querySelector('#wc-view-contacts.active')) renderContacts();
    const screen = document.getElementById('wc-feature-screen');
    if (screen && screen.classList.contains('active') && window._wechatProfileCharId === charId) {
        openWechatContactProfile(charId);
    }
}

function getWechatCharMomentCover(char) {
    const config = (char && char.chatConfig) || {};
    const covers = Array.isArray(config.momentCovers) ? config.momentCovers.filter(Boolean) : [];
    if (covers.length) {
        const daySeed = Math.floor(Date.now() / 86400000);
        return covers[daySeed % covers.length];
    }
    return '';
}

function getWechatMomentCoverStyle(src, seed = '') {
    if (src) return `background-image:${getWechatCssUrl(src)}`;
    return 'background:#e9edf2';
}

function getWechatProfileBio(char) {
    const aiProfile = getWechatAiContactProfile(char);
    if (!aiProfile) return '微信资料待 AI 生成';
    const text = String(aiProfile.bio || aiProfile.signature || '暂无朋友资料').replace(/\s+/g, ' ').trim();
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function getWechatCharMoments(char) {
    return getWechatCharMomentPosts(char).slice(-4).reverse();
}

function buildWechatCharMomentPost(char, text, source, id = '', createdAt = 0) {
    return {
        id: id || 'mom_char_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        text,
        images: [],
        userName: getWechatCharDisplayName(char),
        userAvatar: char.avatar || DEFAULT_AVATAR,
        charId: char.id,
        source,
        cover: pickWechatCharMomentCover(char),
        comments: [],
        pending: [],
        createdAt: Number(createdAt) || Date.now()
    };
}

// The moment store is the single source of truth for a character's moments.
// Settings-only moments used to live in chatConfig.aiMoments and never reached the feed; move them in once.
// (AI moments were always written to both, so a missing one was deleted from the feed and stays deleted.)
function getWechatCharMomentPosts(char) {
    if (!char || !char.id) return [];
    const store = getWechatMomentStore();
    char.chatConfig = char.chatConfig || {};
    if (!char.chatConfig.aiMomentsMigrated) {
        const known = new Set(store.posts.map(post => post.id));
        const legacy = (Array.isArray(char.chatConfig.aiMoments) ? char.chatConfig.aiMoments : [])
            .filter(item => item && item.id && item.source === 'manual_moment' && String(item.text || '').trim() && !known.has(item.id));
        legacy.forEach(item => store.posts.push(buildWechatCharMomentPost(char, String(item.text).trim(), 'manual_moment', item.id, item.createdAt)));
        if (legacy.length) saveWechatMomentStore(store);
        char.chatConfig.aiMomentsMigrated = true;
        saveCharactersToStorage();
    }
    return store.posts
        .filter(post => post && post.charId === char.id && (post.source === 'ai_moment' || post.source === 'manual_moment'))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function renderWechatCharMoments(char) {
    const moments = getWechatCharMoments(char);
    return moments.map((item, index) => {
        const momentId = item.id || `idx_${index}`;
        return `
        <div class="wc-profile-moment">
            <div>${wcEscapeHtml(item.text || '')}</div>
            <div class="wc-profile-moment-actions">
                <span>${formatWechatRelativeTime(item.createdAt)}</span>
                <button onclick="event.stopPropagation();collectWechatCharMoment(${quoteWechatJsString(char.id)}, ${quoteWechatJsString(momentId)})">收藏</button>
            </div>
        </div>
    `;
    }).join('');
}

function renderWechatContactProfileMeta(char, profile, isGenerating) {
    const error = (char.chatConfig || {}).contactProfileError || '';
    if (profile) {
        const missing = getWechatContactProfileMissingFields(profile);
        const missingAction = missing.length
            ? `<span class="wc-profile-meta-action" onclick="event.stopPropagation();requestWechatAiContactProfile(${quoteWechatJsString(char.id)}, true)">${isGenerating ? 'AI 正在补全微信资料...' : `资料缺少${wcEscapeHtml(missing.join('和'))}，点这里让 AI 补全`}</span>`
            : '';
        return `
            ${profile.wechatId ? `<span>微信号：${wcEscapeHtml(profile.wechatId)}</span>` : ''}
            ${profile.region ? `<span>地区：${wcEscapeHtml(profile.region)}</span>` : ''}
            ${missingAction}
        `;
    }
    if (isGenerating) return '<span>AI 正在生成微信资料...</span>';
    if (error) return `<span class="wc-profile-meta-action" onclick="event.stopPropagation();requestWechatAiContactProfile(${quoteWechatJsString(char.id)}, true)">${wcEscapeHtml(error)}</span>`;
    return '<span>微信资料待 AI 生成</span>';
}

function appendWechatSystemNotice(char, text) {
    if (!char) return;
    char.history = Array.isArray(char.history) ? char.history : [];
    char.history.push({
        type: 'system_notice',
        isMe: false,
        content: text,
        timestamp: createMessageTimestamp()
    });
}

function openWechatCharMomentPage(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    const config = char.chatConfig || {};
    const displayName = config.nickname || char.name || '未命名';
    const contactProfile = getWechatAiContactProfile(char);
    const signature = stripWechatPromptText(config.signature || (contactProfile && contactProfile.signature) || '', 80);
    const cover = getWechatCharMomentCover(char);
    const momentsHtml = renderWechatCharMoments(char);
    openWechatFeatureScreen('朋友圈', `
        <div class="wc-profile-page wc-char-moments-page">
            <div class="wc-moment-cover" style="${getWechatMomentCoverStyle(cover, displayName)}">
                <div class="wc-moment-cover-name">${wcEscapeHtml(displayName)}</div>
                <img class="wc-moment-cover-avatar" src="${char.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                ${signature ? `<div class="wc-moment-cover-signature">${wcEscapeHtml(signature)}</div>` : ''}
            </div>
            <div class="wc-profile-moment-list wc-char-moment-list">${momentsHtml || '<div class="wc-profile-moment-empty">暂无朋友圈动态</div>'}</div>
        </div>
    `);
}

function openWechatContactProfile(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    window._wechatProfileCharId = charId;
    char.chatConfig = char.chatConfig || {};
    const config = char.chatConfig || {};
    const displayName = (config.nickname || char.name || '未命名');
    const isBlocked = !!config.blacklisted;
    const contactProfile = getWechatAiContactProfile(char);
    const isGeneratingProfile = window._wechatContactProfileGenerating.has(charId);
    const needsProfileCompletion = !hasUsableWechatContactProfile(char);
    openWechatFeatureScreen('详细资料', `
        <div class="wc-profile-page">
            <div class="wc-profile-card">
                <img class="wc-profile-avatar" src="${char.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div class="wc-profile-main">
                    <strong>${wcEscapeHtml(displayName)}</strong>
                    ${renderWechatContactProfileMeta(char, contactProfile, isGeneratingProfile)}
                </div>
            </div>
            <div class="wc-profile-section">
                <div class="wc-profile-section-title">朋友资料</div>
                <div class="wc-profile-bio">${wcEscapeHtml(getWechatProfileBio(char))}</div>
                ${(contactProfile && contactProfile.signature) || config.signature ? `<div class="wc-profile-signature">${wcEscapeHtml((contactProfile && contactProfile.signature) || config.signature)}</div>` : ''}
            </div>
            ${isBlocked ? `
                <div class="wc-profile-block-card">
                    <strong>已加入黑名单</strong>
                    <span>对方无法直接给你发送新消息。</span>
                    <div id="wc-profile-verify-reason">${config.friendRequestReason ? wcEscapeHtml(config.friendRequestReason) : '正在等待对方申请联系人认证...'}</div>
                    <div class="wc-profile-verify-actions">
                        <button onclick="acceptWechatFriendVerification(${quoteWechatJsString(char.id)})">同意添加</button>
                        <button onclick="rejectWechatFriendVerification(${quoteWechatJsString(char.id)})">拒绝</button>
                    </div>
                </div>
            ` : ''}
            <div class="wc-profile-actions">
                <button onclick="openChatFromContact(${quoteWechatJsString(char.id)})"><i class="ri-message-3-line"></i>发消息</button>
                <button onclick="openChatFromContact(${quoteWechatJsString(char.id)});setTimeout(()=>startWechatCall('videoCall'),260)"><i class="ri-video-chat-line"></i>音视频通话</button>
            </div>
        </div>
    `, `<i class="ri-more-2-fill" onclick="openWechatContactMoreSheet(${quoteWechatJsString(char.id)})"></i>`);
    if (needsProfileCompletion && !isGeneratingProfile && !config.contactProfileError) {
        setTimeout(() => requestWechatAiContactProfile(charId), 80);
    }
}

function openWechatContactMoreSheet(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    const isBlocked = !!(char.chatConfig && char.chatConfig.blacklisted);
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="hideActionSheet();openWechatCharMomentPage(${quoteWechatJsString(charId)})">
            <i class="ri-image-line"></i>
            <span>查看对方朋友圈</span>
        </div>
        <div class="wc-sheet-item danger" onclick="toggleWechatContactBlacklist(${quoteWechatJsString(charId)})">
            <i class="${isBlocked ? 'ri-user-follow-line' : 'ri-forbid-2-line'}"></i>
            <span>${isBlocked ? '移出黑名单' : '加入黑名单'}</span>
        </div>
    `);
}

async function toggleWechatContactBlacklist(charId) {
    hideActionSheet();
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.blacklisted = !char.chatConfig.blacklisted;
    if (!char.chatConfig.blacklisted) {
        char.chatConfig.friendRequestReason = '';
        char.chatConfig.friendRequestAt = 0;
        saveCharactersToStorage();
        openWechatContactProfile(charId);
        return;
    }
    char.chatConfig.friendRequestReason = '';
    char.chatConfig.friendRequestAt = Date.now();
    saveCharactersToStorage();
    openWechatContactProfile(charId);
    await requestWechatFriendVerification(charId);
}

async function requestWechatFriendVerification(charId, mode = 'initial') {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    let result = { ok: false, content: '' };
    try {
        result = await callChatApi([
            { role: 'system', content: `你是「${char.name}」。用户${mode === 'rejected' ? '拒绝了你的联系人认证申请，你需要重新说明情况' : '刚把你加入微信黑名单，你需要申请联系人认证'}。只输出一句自然的认证申请理由，36字以内，不要解释。` },
            { role: 'user', content: mode === 'rejected' ? '我拒绝了，你再说明为什么要重新添加？' : '你为什么要申请重新成为联系人？' }
        ], { usageFeature: 'agent', usageChar: char });
    } catch (e) {
        console.warn('friend verification failed', e);
    }
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.friendRequestReason = result.ok
        ? String(result.content || '').replace(/\|\|\|/g, ' ').replace(/<[^>]+>/g, '').trim().slice(0, 80)
        : `认证申请生成失败：${String(result.error || 'API 未返回').slice(0, 42)}`;
    char.chatConfig.friendRequestAt = Date.now();
    saveCharactersToStorage();
    openWechatContactProfile(charId);
}

function buildWechatMonitorBarrageBurst(phrases, level) {
    const targetCount = level === 'warning' ? 14 : 9;
    const seen = new Set();
    const result = (phrases || []).map(item => stripWechatPromptText(item, 72)).filter(Boolean).filter(item => {
        if (seen.has(item)) return false;
        seen.add(item);
        return true;
    });
    return result.slice(0, targetCount);
}

async function appendWechatRelationshipEventReply(char, eventText) {
    if (!char || typeof callChatApi !== 'function') {
        appendWechatSystemNotice(char, '关系事件回复失败：未配置聊天 API');
        return false;
    }
    try {
        const messages = [
            { role: 'system', content: typeof buildSystemPrompt === 'function' ? buildSystemPrompt(char) : `你是「${char.name || getWechatCharDisplayName(char)}」。保持角色设定。` },
            { role: 'system', content: typeof buildCurrentTimeAnchor === 'function' ? buildCurrentTimeAnchor(char) : `当前时间：${new Date().toLocaleString()}` },
            { role: 'system', content: `根据当前微信聊天上下文回应这个关系事件。要像真实微信消息，允许用"|||"分段。不要解释系统，不要输出 Markdown。` },
            { role: 'user', content: `${eventText}\n\n最近聊天：\n${buildWechatRecentHistoryForPrompt(char, 14)}` }
        ];
        const result = await callChatApi(messages, { usageFeature: 'chat', usageChar: char });
        if (!result || !result.ok) {
            appendWechatSystemNotice(char, `关系事件回复失败：${(result && result.error) || 'API 未返回'}`);
            return false;
        }
        appendWechatAiMessageParts(char, document.getElementById('chat-room-content'), result.content || '');
        return true;
    } catch (e) {
        appendWechatSystemNotice(char, `关系事件回复失败：${e && e.message ? e.message : 'API 异常'}`);
        return false;
    }
}

async function acceptWechatFriendVerification(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.blacklisted = false;
    char.chatConfig.friendRequestReason = '';
    char.chatConfig.friendRequestAt = 0;
    appendWechatSystemNotice(char, '你已重新添加联系人');
    saveCharactersToStorage();
    closeWechatFeatureScreen();
    switchWcTab('chat');
    openChat(charId);
    await appendWechatRelationshipEventReply(char, '用户刚刚同意重新添加你为联系人。请按你的人设和当前上下文，给用户发一条自然的微信消息。');
    saveCharactersToStorage();
    if (window.currentChatCharId === char.id) refreshChatView(char);
    renderChatList();
}

async function rejectWechatFriendVerification(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.friendRequestReason = '正在请求对方重新说明...';
    saveCharactersToStorage();
    openWechatContactProfile(charId);
    await requestWechatFriendVerification(charId, 'rejected');
}

async function blacklistCurrentWechatContact() {
    const char = getCurrentChatChar();
    if (!char) return;
    const displayName = getWechatCharDisplayName(char);
    if (!confirm(`确定拉黑「${displayName}」吗？\n拉黑后会触发一次角色按当前聊天上下文生成回复。`)) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.blacklisted = true;
    char.chatConfig.friendRequestReason = '';
    char.chatConfig.friendRequestAt = Date.now();
    appendWechatSystemNotice(char, `你已将 ${displayName} 加入黑名单`);
    saveCharactersToStorage();
    closeChatSettings();
    switchWcTab('chat');
    openChat(char.id);
    await appendWechatRelationshipEventReply(char, '用户刚刚把你拉黑了。请按你的人设、你们最近聊天的情景和真实情绪，生成一段自然微信回复。可以难过、困惑、嘴硬、吐槽或请求解释，但不要解释系统。');
    saveCharactersToStorage();
    refreshChatView(char);
    renderChatList();
}

function renderMePage() {
    const page = document.getElementById('wc-me-page');
    if (!page) return;
    const profile = getUserProfile();
    if (!profile.wechatId) {
        profile.wechatId = 'user_' + Date.now().toString(36).slice(-6);
        saveUserProfile(profile);
    }
    if (isWechatTelegramTheme()) { renderTelegramMePage(page, profile); return; }
    if (isWechatLineTheme()) { renderLineMePage(page, profile); return; }
    if (isWechatXTheme()) { renderXMePage(page, profile); return; }
    page.innerHTML = `
        <div class="wc-me-profile">
            <img class="wc-me-avatar wc-me-editable" src="${profile.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'" onclick="openWechatMeAvatarSheet()" title="更换头像">
            <div class="wc-me-info">
                <div class="wc-me-name wc-me-editable" onclick="promptWechatMeField('name')">${wcEscapeHtml(profile.name || '我')}</div>
                <div class="wc-me-id wc-me-editable" onclick="promptWechatMeField('wechatId')">微信号：${wcEscapeHtml(profile.wechatId)}</div>
                <div class="wc-me-status wc-me-editable" onclick="promptWechatMeField('signature')">${wcEscapeHtml(profile.signature || '点击设置签名~')}</div>
            </div>
        </div>
        <div class="wc-me-menu-item" onclick="openWechatFavorites()">
            <svg class="wc-me-menu-icon" viewBox="0 0 48 48" fill="none" stroke="#7C6EF7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M24 6l5.5 11 12.5 2-9 8.5 2 12.5L24 34l-11 6 2-12.5-9-8.5 12.5-2z"/></svg>
            <span class="wc-me-menu-name">收藏</span>
        </div>
        <div class="wc-me-menu-item" onclick="openWechatMoments()">
            <svg class="wc-me-menu-icon" viewBox="0 0 48 48" fill="none" stroke="#F97066" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="10" width="36" height="28" rx="4"/><circle cx="18" cy="22" r="4"/><path d="M6 34l10-8 6 5 10-9 10 8"/></svg>
            <span class="wc-me-menu-name">朋友圈</span>
        </div>
        <div class="wc-me-menu-item" onclick="openWechatStickerStore()">
            <svg class="wc-me-menu-icon" viewBox="0 0 48 48" fill="none" stroke="#34D399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="20"/><circle cx="17" cy="20" r="2" fill="#34D399" stroke="none"/><circle cx="31" cy="20" r="2" fill="#34D399" stroke="none"/><path d="M16 30c2 4 5 6 8 6s6-2 8-6"/></svg>
            <span class="wc-me-menu-name">表情</span>
        </div>
        <div class="wc-me-menu-item" onclick="openWechatMeSettings()">
            <svg class="wc-me-menu-icon" viewBox="0 0 48 48" fill="none" stroke="#64748B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="8"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M10 38l4-4M34 14l4-4"/></svg>
            <span class="wc-me-menu-name">设置</span>
        </div>
    `;
}

function openWechatMeAvatarSheet() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="promptWechatMeAvatarUrl()"><i class="ri-link"></i><span>使用图床 URL</span></div>
        <div class="wc-sheet-item" onclick="document.getElementById('wc-me-avatar-file').click()"><i class="ri-image-add-line"></i><span>从本地照片选择</span><input id="wc-me-avatar-file" type="file" accept="image/*" style="display:none" onchange="uploadWechatMeAvatar(this)"></div>
    `);
}

function promptWechatMeAvatarUrl() {
    hideActionSheet();
    const profile = getUserProfile();
    const url = prompt('输入头像图床 URL', profile.avatar || '');
    if (!url || !url.trim()) return;
    profile.avatar = url.trim();
    saveUserProfile(profile);
    renderMePage();
    if (typeof syncWechatTelegramTabAvatar === 'function') syncWechatTelegramTabAvatar();
    showWechatToast('头像已更新');
}

function uploadWechatMeAvatar(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const profile = getUserProfile();
        profile.avatar = e.target.result;
        saveUserProfile(profile);
        renderMePage();
        if (typeof syncWechatTelegramTabAvatar === 'function') syncWechatTelegramTabAvatar();
        showWechatToast('头像已更新');
    };
    reader.readAsDataURL(file);
    input.value = '';
    hideActionSheet();
}

function openWechatXCoverSheet() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="promptWechatXCoverUrl()"><i class="ri-link"></i><span>使用图床 URL 更换背景</span></div>
        <div class="wc-sheet-item" onclick="chooseWechatXCoverFile()"><i class="ri-image-add-line"></i><span>从本地照片选择背景</span></div>
        <div class="wc-sheet-item" onclick="resetWechatXCover()"><i class="ri-refresh-line"></i><span>恢复默认背景</span></div>
    `);
}

function chooseWechatXCoverFile() {
    let input = document.getElementById('wc-x-cover-file-input');
    if (!input) {
        input = document.createElement('input');
        input.id = 'wc-x-cover-file-input';
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.onchange = () => uploadWechatXCover(input);
        document.body.appendChild(input);
    }
    input.value = '';
    input.click();
}

function promptWechatXCoverUrl() {
    hideActionSheet();
    const profile = getUserProfile();
    const url = prompt('输入 X 背景图床 URL', profile.xCover || '');
    if (!url || !url.trim()) return;
    profile.xCover = url.trim();
    saveUserProfile(profile);
    renderMePage();
    showWechatToast('背景已更新');
}

function uploadWechatXCover(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        openWechatAvatarCropper(e.target.result, cropped => {
            const profile = getUserProfile();
            profile.xCover = cropped;
            saveUserProfile(profile);
            renderMePage();
            showWechatToast('背景已更新');
        }, {
            mode: 'cover',
            title: '裁剪 X 背景',
            helpText: '拖动图片调整位置，裁出横向长方形背景。',
            confirmText: '确认背景',
            cropWidth: 300,
            cropHeight: 112,
            outputWidth: 900,
            outputHeight: 336,
            quality: 0.78
        });
    };
    reader.readAsDataURL(file);
    input.value = '';
    hideActionSheet();
}

function resetWechatXCover() {
    hideActionSheet();
    const profile = getUserProfile();
    profile.xCover = '';
    saveUserProfile(profile);
    renderMePage();
    showWechatToast('背景已恢复默认');
}
window.openWechatXCoverSheet = openWechatXCoverSheet;
window.chooseWechatXCoverFile = chooseWechatXCoverFile;
window.promptWechatXCoverUrl = promptWechatXCoverUrl;
window.uploadWechatXCover = uploadWechatXCover;
window.resetWechatXCover = resetWechatXCover;

function promptWechatMeField(field) {
    const profile = getUserProfile();
    const config = {
        name: { title: '修改昵称', label: '昵称', value: profile.name || '我', max: 24, placeholder: '我', multiline: false },
        wechatId: { title: '修改 ID', label: 'ID', value: profile.wechatId || '', max: 32, placeholder: 'user_xxxxxx', multiline: false },
        bio: { title: '修改个人简介', label: '个人简介', value: profile.bio || '', max: 240, placeholder: '写一段个人简介', multiline: true },
        signature: { title: '修改签名', label: '签名', value: profile.signature || '', max: 120, placeholder: '点击设置签名', multiline: true }
    }[field];
    if (!config) return;
    const control = config.multiline
        ? `<textarea id="wc-me-field-editor" maxlength="${config.max}" placeholder="${wcEscapeHtml(config.placeholder)}">${wcEscapeHtml(config.value)}</textarea>`
        : `<input id="wc-me-field-editor" maxlength="${config.max}" value="${wcEscapeHtml(config.value)}" placeholder="${wcEscapeHtml(config.placeholder)}">`;
    openWechatFeatureScreen(config.title, `
        <div class="wc-me-field-editor-page">
            <label class="wc-compose-field">
                <span>${wcEscapeHtml(config.label)}</span>
                ${control}
            </label>
            <button type="button" class="wc-me-settings-save" onclick="saveWechatMeField(${quoteWechatJsString(field)})">保存</button>
        </div>
    `);
    setWechatFeatureLeftText('取消', 'closeWechatFeatureScreen()');
    requestAnimationFrame(() => document.getElementById('wc-me-field-editor')?.focus());
}

function saveWechatMeField(field) {
    const profile = getUserProfile();
    const config = {
        name: { max: 24 },
        wechatId: { max: 32 },
        bio: { max: 240 },
        signature: { max: 120 }
    }[field];
    if (!config) return;
    const value = document.getElementById('wc-me-field-editor')?.value || '';
    const next = value.trim().slice(0, config.max);
    if (field === 'name') profile.name = next || '我';
    if (field === 'wechatId') profile.wechatId = next || profile.wechatId;
    if (field === 'bio') profile.bio = next;
    if (field === 'signature') profile.signature = next;
    saveUserProfile(profile);
    renderMePage();
    renderChatList();
    if (isWechatTelegramTheme() || isWechatLineTheme()) {
        renderContacts();
        renderWechatDiscoverTab();
    }
    closeWechatFeatureScreen();
    showWechatToast('资料已更新');
}
window.promptWechatMeField = promptWechatMeField;
window.saveWechatMeField = saveWechatMeField;
window.selectWechatUiTheme = selectWechatUiTheme;
window.openWechatUiThemeSettings = openWechatUiThemeSettings;
window.renderContacts = renderContacts;
window.renderMePage = renderMePage;

document.addEventListener('click', event => {
    const fieldButton = event.target.closest('[data-wc-me-field]');
    if (!fieldButton || !fieldButton.closest('#app-wechat-window')) return;
    event.preventDefault();
    event.stopPropagation();
    promptWechatMeField(fieldButton.dataset.wcMeField || '');
}, true);
