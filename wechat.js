// --- 🟢 wechat.js: 核心数据源 & 微信 App 逻辑 ---

// 1. 全局数据中心 (所有 App 共用)
window.myCharacters = window.myCharacters || [];
window.TEMP_PARSED_DATA = null;
window.currentChatCharId = null;

const DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="100" fill="#f0f0f0"/><circle cx="100" cy="85" r="35" fill="#ccc"/><ellipse cx="100" cy="160" rx="50" ry="35" fill="#ccc"/></svg>');
window.DEFAULT_AVATAR = DEFAULT_AVATAR;
const WECHAT_AUTO_COLLAPSE_AFTER = 56;
const WECHAT_COLLAPSE_KEEP_RECENT = 32;
const WECHAT_MEMORY_STORAGE_KEY = 'wechat_memory_store';
const WECHAT_MEMORY_DEFAULTS = {
    segmentLimit: 8,
    longTermLimit: 8,
    keepRecent: 5,
    extractEvery: 4
};
const WECHAT_MOMENTS_STORAGE_KEY = 'wechat_moments_store';
const WECHAT_VIDEO_STORAGE_KEY = 'wechat_video_state';
const WECHAT_LIVE_STORAGE_KEY = 'wechat_live_state';
const WECHAT_SHOP_STORAGE_KEY = 'wechat_shop_store';
const WECHAT_TAKEOUT_STORAGE_KEY = 'wechat_takeout_store';
const WECHAT_SHOP_AGGREGATE_SOURCE_ID = 'bynd-aggregate';
const WECHAT_SHOP_AGGREGATE_SOURCES = [
    { id: 'dummyjson', name: 'DummyJSON', url: 'https://dummyjson.com/products/search?q={q}&limit=24' },
    { id: 'fakestore', name: 'Fake Store', url: 'https://fakestoreapi.com/products' }
];
const WECHAT_FAVORITES_STORAGE_KEY = 'wechat_favorites_store';
const WECHAT_UI_THEME_STORAGE_KEY = 'wechat_ui_theme_v1';
const WECHAT_TAB_KEYS = ['chat', 'contacts', 'discover', 'me'];
const WECHAT_UI_THEME_DEFAULT_ID = 'bynd';
const WECHAT_UI_THEMES = [
    {
        id: 'qq',
        name: 'QQ 主题',
        tone: '蓝紫',
        desc: '头像资料区、QQ 式消息列表、频道/联系人/动态底栏和圆润聊天页。',
        accent: '#2f7bf6',
        preview: ['#eef4ff', '#d8e6ff', '#7c6ef7'],
        searchPlaceholder: '搜索聊天内容或联系人',
        tabs: {
            chat: { label: '消息', title: '消息', icon: 'ri-chat-smile-3-fill' },
            contacts: { label: '联系人', title: '联系人', icon: 'ri-user-smile-line' },
            discover: { label: '频道', title: '频道', icon: 'ri-hashtag' },
            me: { label: '动态', title: '动态', icon: 'ri-refresh-line' }
        }
    },
    {
        id: 'rednote',
        name: '小红书主题',
        tone: '红白',
        desc: '笔记卡片、红色互动重点、瀑布流感的列表和更软的聊天气泡。',
        accent: '#ff2442',
        preview: ['#fff7f8', '#ffffff', '#ff2442'],
        searchPlaceholder: '搜索笔记、联系人和聊天',
        tabs: {
            chat: { label: '消息', title: '消息', icon: 'ri-message-3-fill' },
            contacts: { label: '关注', title: '关注', icon: 'ri-heart-3-line' },
            discover: { label: '发现', title: '发现', icon: 'ri-compass-3-line' },
            me: { label: '我', title: '我', icon: 'ri-user-heart-line' }
        }
    },
    {
        id: 'douyin',
        name: '抖音主题',
        tone: '白底',
        desc: '白底抖音消息页、横向朋友动态、互动消息和五栏底部导航。',
        accent: '#fe2c55',
        preview: ['#ffffff', '#f3f3f5', '#fe2c55'],
        searchPlaceholder: '搜索私信和好友',
        tabs: {
            chat: { label: '首页', title: '消息', icon: 'ri-home-5-fill' },
            contacts: { label: '朋友', title: '朋友', icon: 'ri-group-line' },
            discover: { label: '消息', title: '消息', icon: 'ri-message-3-fill' },
            me: { label: '我', title: '我', icon: 'ri-user-3-fill' }
        }
    },
    {
        id: 'telegram',
        name: 'Telegram 主题',
        tone: '清蓝',
        desc: 'Telegram 品牌顶栏、圆头像消息流、底部胶囊导航和悬浮操作按钮。',
        accent: '#ea3d8c',
        preview: ['#ffffff', '#e9f6ff', '#ea3d8c'],
        searchPlaceholder: '搜索聊天',
        tabs: {
            chat: { label: '聊天', title: 'Telegram', icon: 'ri-chat-3-fill' },
            contacts: { label: '联系人', title: '联系人', icon: 'ri-user-3-line' },
            discover: { label: '设置', title: '设置', icon: 'ri-settings-3-line' },
            me: { label: '个人资料', title: '个人资料', icon: 'ri-user-smile-line' }
        }
    },
    {
        id: 'line',
        name: 'Line 主题',
        tone: '青绿',
        desc: '青绿色顶栏、好友式列表、轻社交底栏和柔和聊天页。',
        accent: '#06c755',
        preview: ['#effbf2', '#ffffff', '#06c755'],
        searchPlaceholder: '搜索好友或聊天',
        tabs: {
            chat: { label: '聊天', title: '聊天', icon: 'ri-chat-3-fill' },
            contacts: { label: '好友', title: '好友', icon: 'ri-user-5-line' },
            discover: { label: '主页', title: '主页', icon: 'ri-home-smile-line' },
            me: { label: '钱包', title: '钱包', icon: 'ri-wallet-3-line' }
        }
    },
    {
        id: 'hallowrok',
        name: 'X 主题',
        tone: '黑白',
        desc: '按 X 个人页和私信页重做：白底资料页、帖子信息流、实时新闻、底部五栏和蓝色发布按钮。',
        accent: '#1d9bf0',
        preview: ['#ffffff', '#0f1419', '#1d9bf0'],
        searchPlaceholder: '搜索私信',
        tabs: {
            chat: { label: '', title: '聊天', icon: 'ri-chat-1-fill' },
            contacts: { label: '', title: '搜索', icon: 'ri-search-line' },
            discover: { label: '', title: '通知', icon: 'ri-notification-3-line' },
            me: { label: '', title: '首页', icon: 'ri-home-5-line' }
        }
    },
    {
        id: 'wechat',
        name: '微信主题',
        tone: '微信',
        desc: '按微信重新做：灰底列表、方圆头像、通讯录/发现/我页面、微信底栏和经典绿白聊天气泡。',
        accent: '#07c160',
        preview: ['#ededed', '#ffffff', '#95ec69'],
        searchPlaceholder: '搜索',
        tabs: {
            chat: { label: '微信', title: '微信', icon: 'ri-chat-3-line' },
            contacts: { label: '通讯录', title: '通讯录', icon: 'ri-contacts-book-line' },
            discover: { label: '发现', title: '发现', icon: 'ri-compass-3-line' },
            me: { label: '我', title: '我', icon: 'ri-user-3-line' }
        }
    },
    {
        id: 'bynd',
        name: 'BYND 默认',
        tone: '默认',
        desc: '保留 BYND 当前悬浮输入框、轻玻璃和黑白高级感。',
        accent: '#111827',
        preview: ['#ffffff', '#111827', '#f4f6f8'],
        searchPlaceholder: '搜索',
        tabs: {
            chat: { label: '微信', title: '消息', icon: 'ri-chat-smile-2-line' },
            contacts: { label: '通讯录', title: '通讯录', icon: 'ri-contacts-line' },
            discover: { label: '发现', title: '发现', icon: 'ri-compass-3-line' },
            me: { label: '我', title: '我', icon: 'ri-user-3-line' }
        }
    }
];

function getWechatUiThemeId() {
    try {
        const saved = localStorage.getItem(WECHAT_UI_THEME_STORAGE_KEY) || WECHAT_UI_THEME_DEFAULT_ID;
        return WECHAT_UI_THEMES.some(theme => theme.id === saved) ? saved : WECHAT_UI_THEME_DEFAULT_ID;
    } catch (e) {
        return WECHAT_UI_THEME_DEFAULT_ID;
    }
}

function getWechatUiTheme(themeId = getWechatUiThemeId()) {
    return WECHAT_UI_THEMES.find(theme => theme.id === themeId) || WECHAT_UI_THEMES.find(theme => theme.id === WECHAT_UI_THEME_DEFAULT_ID) || WECHAT_UI_THEMES[0];
}

function applyWechatUiTheme(themeId = getWechatUiThemeId()) {
    const root = document.getElementById('app-wechat-window');
    if (!root) return;
    const theme = getWechatUiTheme(themeId);
    WECHAT_UI_THEMES.forEach(item => root.classList.remove(`wc-ui-theme-${item.id}`));
    root.classList.add(`wc-ui-theme-${theme.id}`);
    root.dataset.uiTheme = theme.id;
    updateWechatUiThemeStructure(theme);
}

function getWechatThemeTabMeta(tabName, theme = getWechatUiTheme()) {
    const fallback = (getWechatUiTheme(WECHAT_UI_THEME_DEFAULT_ID).tabs || {})[tabName] || {};
    return (theme.tabs && theme.tabs[tabName]) || fallback || { label: tabName, title: tabName, icon: 'ri-circle-line' };
}

function updateWechatQqChannelTopbar() {
    const avatarEl = document.getElementById('wc-qq-channel-avatar');
    if (!avatarEl) return;
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    avatarEl.src = profile.avatar || DEFAULT_AVATAR;
}

function updateWechatUiThemeStructure(theme = getWechatUiTheme()) {
    const root = document.getElementById('app-wechat-window');
    if (!root) return;
    updateWechatQqChannelTopbar();
    const headerLeftIcon = root.querySelector('.wc-header-left i');
    const headerLeftText = root.querySelector('.wc-header-left span');
    const headerRight = root.querySelector('.wc-header-right');
    if (theme.id === 'douyin') {
        if (headerLeftIcon) headerLeftIcon.className = 'ri-menu-line';
        if (headerLeftText) headerLeftText.textContent = '';
        if (headerRight) {
            headerRight.innerHTML = `
                <i class="ri-search-line" onclick="openWechatSearch()" aria-label="搜索"></i>
                <i class="ri-add-circle-line" onclick="openWechatPlusMenu(event)" aria-label="新建"></i>
            `;
        }
    } else {
        if (headerLeftIcon) headerLeftIcon.className = 'ri-arrow-left-s-line';
        if (headerLeftText) headerLeftText.textContent = '微信';
        if (headerRight) headerRight.innerHTML = `<i class="ri-add-line" onclick="openWechatPlusMenu(event)" style="font-size: 26px;"></i>`;
    }
    const tabs = root.querySelectorAll('.wc-tab-bar .wc-tab');
    WECHAT_TAB_KEYS.forEach((key, index) => {
        const tab = tabs[index];
        if (!tab) return;
        const meta = getWechatThemeTabMeta(key, theme);
        tab.dataset.tabKey = key;
        const oldIcon = tab.querySelector('svg, .wc-theme-tab-icon');
        const iconClass = meta.icon || 'ri-circle-line';
        const iconHtml = `<i class="${iconClass} wc-theme-tab-icon"></i>`;
        if (oldIcon) oldIcon.outerHTML = iconHtml;
        else tab.insertAdjacentHTML('afterbegin', iconHtml);
        const span = tab.querySelector('span');
        if (span) span.textContent = meta.label || key;
    });
    syncWechatXTabBar(theme);
    const searchInput = document.getElementById('wc-search-input');
    if (searchInput) searchInput.placeholder = theme.searchPlaceholder || '搜索';
    const activeTab = root.querySelector('.wc-tab-bar .wc-tab.active')?.dataset.tabKey || 'chat';
    const titleEl = root.querySelector('.wc-header-title');
    if (titleEl) titleEl.textContent = getWechatThemeTabMeta(activeTab, theme).title || '消息';
    const msgInput = document.getElementById('wc-msg-input');
    if (msgInput && !msgInput.disabled) msgInput.placeholder = getWechatChatInputPlaceholder(theme.id);
    renderWechatThemeChatHeader();
    syncWechatLineRoomHeader(theme);
}

function syncWechatXTabBar(theme = getWechatUiTheme()) {
    const bar = document.querySelector('#app-wechat-window .wc-tab-bar');
    if (!bar) return;
    const old = bar.querySelector('.wc-x-center-tab');
    if (theme.id !== 'hallowrok') {
        old?.remove();
        return;
    }
    if (old) return;
    const center = document.createElement('button');
    center.type = 'button';
    center.className = 'wc-x-center-tab';
    center.setAttribute('aria-label', 'Grok');
    center.innerHTML = '<i class="ri-bard-line"></i>';
    center.onclick = () => showWechatToast('Grok 入口准备中');
    const tabs = bar.querySelectorAll('.wc-tab');
    if (tabs[2]) bar.insertBefore(center, tabs[2]);
    else bar.appendChild(center);
}

function syncWechatLineRoomHeader(theme = getWechatUiTheme()) {
    const header = document.querySelector('#app-wechat-window .wc-chat-room .wc-room-header');
    if (!header) return;
    let actions = header.querySelector('.wc-line-room-actions');
    if (theme.id !== 'line') {
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
        <button type="button" onclick="openWechatCurrentChatSearch()" aria-label="搜索消息"><i class="ri-search-line"></i></button>
        <button type="button" onclick="startWechatCall('voiceCall')" aria-label="通话"><i class="ri-phone-line"></i></button>
        <button type="button" onclick="openChatSettings()" aria-label="菜单"><i class="ri-menu-line"></i></button>
    `;
    header.classList.add('wc-line-room-header-ready');
}

function getWechatChatInputPlaceholder(themeId = getWechatUiThemeId()) {
    if (themeId === 'telegram') return '\u8f93\u5165\u6d88\u606f';
    return themeId === 'douyin' ? '\u53d1\u9001\u6d88\u606f' : '\u53d1\u6d88\u606f...';
}

function getWechatTimestampValue(value) {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getWechatMessageTimestampValue(msg) {
    return getWechatTimestampValue(msg && (msg.timestamp || msg.createdAt || msg.time));
}

function getWechatDouyinStoryCharacters() {
    return (window.myCharacters || [])
        .filter(char => char && !char.isGroupChat)
        .slice()
        .sort((a, b) => {
            const scoreDiff = getWechatDouyinSparkScore(b) - getWechatDouyinSparkScore(a);
            if (scoreDiff) return scoreDiff;
            return getWechatTimestampValue(getWechatChatListTimestamp(b)) - getWechatTimestampValue(getWechatChatListTimestamp(a));
        })
        .slice(0, 3);
}

function getWechatDouyinSparkScore(char) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    let userMessages = 0;
    let charMessages = 0;
    const activeDays = new Set();
    history.forEach(msg => {
        if (!msg || msg.type === 'system_notice') return;
        const time = getWechatMessageTimestampValue(msg);
        if (msg.isMe) {
            userMessages += 1;
            if (time) activeDays.add(new Date(time).toDateString());
        } else {
            charMessages += 1;
        }
    });
    const stored = Number(char && char.chatConfig && char.chatConfig.douyinSparkScore) || 0;
    const score = userMessages * 8 + Math.min(charMessages * 2, userMessages * 4) + activeDays.size * 18;
    return Math.max(0, Math.min(9999, Math.round(Math.max(stored, score))));
}

function getWechatDouyinUnreadCount(char) {
    if (!char) return 0;
    if (typeof isWechatChatPageActive === 'function' && isWechatChatPageActive(char.id)) return 0;
    const explicit = Number(char.unreadCount ?? char.chatConfig?.unreadCount ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return Math.min(99, Math.floor(explicit));
    const history = Array.isArray(char.history) ? char.history : [];
    const lastReadAt = Number(char.chatConfig && char.chatConfig.lastReadAt) || 0;
    let count = 0;
    if (lastReadAt > 0) {
        history.forEach(msg => {
            if (!msg || msg.type === 'system_notice' || msg.isMe) return;
            if (getWechatMessageTimestampValue(msg) > lastReadAt) count += 1;
        });
        return Math.min(99, count);
    }
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.type === 'system_notice') continue;
        if (msg.isMe) break;
        count += 1;
    }
    return Math.min(99, count);
}

function markWechatCharMessagesRead(char) {
    if (!char) return false;
    char.chatConfig = char.chatConfig || {};
    const now = Date.now();
    const prev = Number(char.chatConfig.lastReadAt) || 0;
    const hadUnread = Number(char.unreadCount ?? char.chatConfig.unreadCount ?? 0) > 0 || getWechatDouyinUnreadCount(char) > 0;
    char.chatConfig.lastReadAt = now;
    char.chatConfig.unreadCount = 0;
    char.unreadCount = 0;
    return hadUnread || Math.abs(now - prev) > 1000;
}

function getWechatLatestDouyinInteraction() {
    const store = typeof getWechatMomentStore === 'function'
        ? getWechatMomentStore()
        : readWechatStore(WECHAT_MOMENTS_STORAGE_KEY, { posts: [] });
    const posts = Array.isArray(store.posts) ? store.posts : [];
    let latest = null;
    const updateLatest = item => {
        if (!item || !item.createdAt) return;
        if (!latest || item.createdAt > latest.createdAt) latest = item;
    };
    posts.forEach(post => {
        (Array.isArray(post.comments) ? post.comments : []).forEach(comment => {
            if (!comment || comment.user) return;
            const createdAt = getWechatTimestampValue(comment.createdAt) || getWechatTimestampValue(post.createdAt) || Date.now();
            const name = comment.name || '好友';
            const text = stripWechatPromptText(comment.text || '', 42);
            updateLatest({
                createdAt,
                name,
                action: '评论了你的动态',
                text: text ? `${name}：${text}` : `${name} 评论了你的动态`
            });
        });
        const likes = Array.isArray(post.likes) ? post.likes : (Array.isArray(post.reactions) ? post.reactions : []);
        likes.forEach(like => {
            if (!like || like.user) return;
            const createdAt = getWechatTimestampValue(like.createdAt || like.time) || getWechatTimestampValue(post.createdAt) || Date.now();
            const name = like.name || like.charName || '好友';
            updateLatest({
                createdAt,
                name,
                action: '赞了你的动态',
                text: `${name} 赞了你的动态`
            });
        });
    });
    return latest;
}

function getWechatThemeHeroHtml(theme = getWechatUiTheme()) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const name = wcEscapeHtml(profile.name || '我');
    const avatar = wcEscapeHtml(profile.avatar || DEFAULT_AVATAR);
    const bio = wcEscapeHtml(profile.bio || '点击设置签名~');
    if (['rednote'].includes(theme.id)) return '';
    if (theme.id === 'qq') {
        return `
            <div class="wc-theme-hero-main">
                <img class="wc-theme-hero-avatar" src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
                <button type="button" class="wc-theme-hero-user wc-theme-hero-edit" onclick="promptWechatMeField('bio')">
                    <strong>${name}</strong>
                    <span>♡ ${bio}</span>
                </button>
                <div class="wc-theme-hero-mascot"><i class="ri-bear-smile-line"></i></div>
                <button type="button" class="wc-theme-hero-plus" onclick="openWechatPlusMenu(event)" aria-label="新建"><i class="ri-add-line"></i></button>
            </div>
            <div class="wc-theme-device-row"><i class="ri-tablet-line"></i><span>已登陆 iPad</span></div>
        `;
    }
    if (theme.id === 'rednote') {
        return `
            <div class="wc-theme-hero-main">
                <img class="wc-theme-hero-avatar" src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div class="wc-theme-hero-user"><strong>消息</strong><span>${name} · ${bio}</span></div>
                <button type="button" class="wc-theme-hero-plus" onclick="openWechatPlusMenu(event)"><i class="ri-add-line"></i></button>
            </div>
            <div class="wc-theme-chip-row"><span>全部</span><span>评论</span><span>赞和收藏</span><span>新增关注</span></div>
        `;
    }
    if (theme.id === 'douyin') {
        const signature = wcEscapeHtml(profile.bio || '点击设置个性签名');
        const contacts = getWechatDouyinStoryCharacters().map((char, index) => ({
            avatar: wcEscapeHtml(char.avatar || DEFAULT_AVATAR),
            label: wcEscapeHtml(index === 0 ? '限时日常' : ((char.chatConfig && char.chatConfig.nickname) || char.name || '朋友'))
        }));
        const storyItems = [
            { avatar, label: 'You', add: true },
            ...contacts
        ];
        const interaction = getWechatLatestDouyinInteraction();
        return `
            <button type="button" class="wc-douyin-user-signature" onclick="promptWechatMeField('bio')">${signature}</button>
            <div class="wc-douyin-story-row">
                ${storyItems.map(item => `
                    <button type="button" class="wc-douyin-story">
                        <span><img src="${item.avatar}" onerror="this.src='${DEFAULT_AVATAR}'">${item.add ? '<b><i class="ri-add-line"></i></b>' : ''}</span>
                        <em>${item.label}</em>
                    </button>
                `).join('')}
            </div>
            ${interaction ? `<div class="wc-douyin-interaction-card">
                <div class="wc-douyin-interaction-icon"><i class="ri-messenger-fill"></i></div>
                <div>
                    <strong>互动消息</strong>
                    <span>${wcEscapeHtml(interaction.text || `${interaction.name} ${interaction.action}`)}</span>
                </div>
                <time>${formatMessageTime({ timestamp: interaction.createdAt })}</time>
            </div>` : ''}
        `;
    }
    if (theme.id === 'telegram') {
        return `
            <div class="wc-telegram-hero">
                <div class="wc-telegram-brand">
                    <div class="wc-telegram-logo"><i class="ri-telegram-line"></i></div>
                    <strong>Telegram</strong>
                    <button type="button" class="wc-telegram-more" onclick="openWechatPlusMenu(event)" aria-label="更多"><i class="ri-more-2-fill"></i></button>
                </div>
                <div class="wc-telegram-floating-actions">
                    <button type="button" class="wc-telegram-float-camera" onclick="triggerCamera()" aria-label="相机"><i class="ri-camera-line"></i></button>
                    <button type="button" class="wc-telegram-float-compose" onclick="openWechatPlusMenu(event)" aria-label="新聊天"><i class="ri-chat-new-line"></i></button>
                </div>
            </div>
        `;
    }
    if (theme.id === 'line') {
        const chars = getWechatGroupContacts();
        const unreadTotal = chars.reduce((sum, char) => sum + getTelegramChatUnreadCount(char), 0);
        return `
            <div class="wc-line-chat-titlebar">
                <button type="button" class="wc-line-title-btn"><span>聊天</span><i class="ri-arrow-down-s-line"></i></button>
                <div class="wc-line-title-actions">
                    <button type="button" onclick="openWechatSearch()" aria-label="搜索"><i class="ri-search-line"></i></button>
                    <button type="button" onclick="openWechatGroupCreator()" aria-label="新聊天"><i class="ri-chat-new-line"></i></button>
                </div>
            </div>
            <div class="wc-line-search-pill"><i class="ri-search-line"></i><span>搜索</span></div>
            <button type="button" class="wc-line-weather-card" onclick="openWechatMoments()">
                <i class="ri-sun-cloudy-line"></i>
                <span><strong>今天有 ${chars.length || 0} 位好友在列表中</strong><em>${unreadTotal > 0 ? `${unreadTotal} 条新消息等你查看` : `${name} · ${bio}`}</em></span>
                <b>LINE</b>
            </button>
        `;
    }
    if (theme.id === 'hallowrok') {
        const hasInbox = getWechatGroupContacts().length > 0 || (window.myCharacters || []).some(char => char && char.isGroupChat);
        return `
            <div class="wc-x-inbox-shell">
                <div class="wc-x-topbar">
                    <button type="button" class="wc-x-avatar-btn" onclick="switchWcTab('me')" aria-label="个人主页">
                        <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
                    </button>
                    <strong>聊天</strong>
                    <button type="button" class="wc-x-filter-btn" onclick="showWechatToast('已显示全部私信')">
                        <span>全部</span><i class="ri-arrow-down-s-line"></i>
                    </button>
                </div>
                    <button type="button" class="wc-x-search-pill" onclick="switchWcTab('contacts')">
                        <i class="ri-search-line"></i><span>搜索</span>
                    </button>
                ${hasInbox ? '' : `<div class="wc-x-empty-inbox">
                    <h2>欢迎来到你的收件箱！</h2>
                    <p>在 X 上和别人进行私密对话，大家互发私信、分享帖子等。</p>
                    <button type="button" onclick="openWechatPlusMenu(event)">写一封私信</button>
                </div>`}
                <button type="button" class="wc-x-compose-fab" onclick="openWechatPlusMenu(event)" aria-label="写私信">
                    <i class="ri-chat-new-line"></i>
                </button>
            </div>
        `;
    }
    return '';
}

function getWechatXFabHtml() {
    return `
        <button type="button" class="wc-x-compose-fab wc-x-compose-fab-list" onclick="openWechatPlusMenu(event)" aria-label="写私信">
            <i class="ri-chat-new-line"></i>
        </button>
    `;
}

function renderWechatThemeChatHeader() {
    const chatView = document.getElementById('wc-view-chat');
    if (!chatView) return;
    const theme = getWechatUiTheme();
    let hero = document.getElementById('wc-theme-chat-hero');
    const html = getWechatThemeHeroHtml(theme);
    if (!html) {
        if (hero) hero.remove();
        return;
    }
    if (!hero) {
        hero = document.createElement('div');
        hero.id = 'wc-theme-chat-hero';
        const searchBox = chatView.querySelector('.wc-search-box');
        chatView.insertBefore(hero, searchBox || chatView.firstChild);
    }
    hero.className = `wc-theme-chat-hero wc-theme-chat-hero-${theme.id}`;
    hero.innerHTML = html;
}

function selectWechatUiTheme(themeId) {
    const theme = getWechatUiTheme(themeId);
    try {
        localStorage.setItem(WECHAT_UI_THEME_STORAGE_KEY, theme.id);
    } catch (e) {}
    applyWechatUiTheme(theme.id);
    document.querySelectorAll('.wc-ui-theme-card').forEach(card => {
        card.classList.toggle('active', card.dataset.themeId === theme.id);
    });
    const label = document.getElementById('wc-ui-theme-current');
    if (label) label.textContent = theme.name;
    renderChatList();
    const activeView = document.querySelector('.wc-tab-view.active');
    if (activeView?.id === 'wc-view-contacts') renderContacts();
    if (activeView?.id === 'wc-view-discover') renderWechatDiscoverTab();
    if (activeView?.id === 'wc-view-me') renderMePage();
    showWechatToast(`已切换为${theme.name}`);
}

function openWechatUiThemeSettings() {
    const current = getWechatUiThemeId();
    const cards = WECHAT_UI_THEMES.map(theme => `
        <button type="button" class="wc-ui-theme-card ${theme.id === current ? 'active' : ''}" data-theme-id="${wcEscapeHtml(theme.id)}" onclick="selectWechatUiTheme(${quoteWechatJsString(theme.id)})">
            <span class="wc-ui-theme-preview">
                <i style="background:${wcEscapeHtml(theme.preview[0])}"></i>
                <i style="background:${wcEscapeHtml(theme.preview[1])}"></i>
                <i style="background:${wcEscapeHtml(theme.preview[2])}"></i>
            </span>
            <span class="wc-ui-theme-copy">
                <strong>${wcEscapeHtml(theme.name)}</strong>
                <em>${wcEscapeHtml(theme.tone)}</em>
                <small>${wcEscapeHtml(theme.desc)}</small>
            </span>
            <b><i class="ri-check-line"></i></b>
        </button>
    `).join('');
    openWechatFeatureScreen('页面美化', `
        <div class="wc-ui-theme-page">
            <div class="wc-ui-theme-hero">
                <div>
                    <span>当前主题</span>
                    <strong id="wc-ui-theme-current">${wcEscapeHtml(getWechatUiTheme(current).name)}</strong>
                </div>
                <i class="ri-palette-line"></i>
            </div>
            <div class="wc-ui-theme-list">${cards}</div>
        </div>
    `);
    setWechatFeatureLeftText('设置', 'openWechatMeSettings()');
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => applyWechatUiTheme());
}

const WECHAT_AI_STATUS_FIELDS = [
    { key: 'innerMonologue', label: '内心独白' },
    { key: 'miniDiary', label: '小日记' },
    { key: 'thoughts', label: '想法' },
    { key: 'outfit', label: '服饰' },
    { key: 'posture', label: '姿势' },
    { key: 'action', label: '动作' },
    { key: 'gaze', label: '目光' },
    { key: 'penis', label: 'Penis' }
];

// --- 气泡CSS预设系统 ---
const BUBBLE_CSS_PRESETS = [
    { id: 'default', name: '默认', css: '' },
    { id: 'blue-pink', name: '蓝粉长条', css: '.msg-bubble { background: #CDECFF; color: #333; border-radius: 18px 18px 18px 6px; }\n.msg-bubble.green { background: #FFD2DD; color: #333; border-radius: 18px 18px 6px 18px; }' },
    { id: 'telegram', name: 'TG 清透', css: '.msg-bubble { background: #E8F2FF; color: #17212b; border-radius: 18px 18px 18px 7px; box-shadow: 0 1px 2px rgba(23,33,43,0.08); }\n.msg-bubble.green { background: #DDF7C8; color: #17212b; border-radius: 18px 18px 7px 18px; box-shadow: 0 1px 2px rgba(23,33,43,0.08); }\n.msg-meta { color: rgba(23,33,43,0.46); }' },
    { id: 'blue-white-chat', name: '蓝白轻聊', css: '.msg-bubble { background: #FFFFFF; color: #182334; border: 1px solid rgba(15,23,42,0.045); border-radius: 15px 15px 15px 5px; box-shadow: 0 1px 3px rgba(15,23,42,0.075); padding: 7px 10px 5px 12px; font-weight: 650; }\n.msg-bubble.green { background: #D8ECFF; color: #101927; border: 1px solid rgba(99,154,214,0.12); border-radius: 10px 10px 4px 10px; box-shadow: 0 1px 3px rgba(75,132,190,0.10); padding: 7px 10px 5px 12px; font-weight: 650; }\n.msg-meta { color: rgba(79,91,107,0.56); font-weight: 500; }\n.msg-bubble.green .msg-meta { color: rgba(55,86,126,0.62); }' },
    { id: 'kakao-yellow', name: '黄白轻语', css: '.wc-room-content { background: #AFC2CF; }\n.wcs-bubble-preview { background: #AFC2CF; }\n.msg-bubble { background: #FFFFFF; color: #1F2933; border: 1px solid rgba(49,70,86,0.045); border-radius: 13px 13px 13px 4px; box-shadow: 0 1px 2px rgba(31,49,66,0.08); padding: 7px 10px 5px 11px; font-weight: 650; }\n.msg-bubble.green { background: #FFE100; color: #1B1B18; border: 1px solid rgba(154,128,0,0.10); border-radius: 12px 12px 4px 12px; box-shadow: 0 1px 2px rgba(85,78,24,0.10); padding: 7px 10px 5px 11px; font-weight: 650; }\n.msg-meta { color: rgba(45,61,74,0.62); font-weight: 520; }\n.msg-bubble.green .msg-meta { color: rgba(54,50,20,0.56); }' },
    { id: 'imessage', name: 'iMessage', css: '.msg-bubble { background: #E9EAEE; color: #101418; border-radius: 19px 19px 19px 7px; box-shadow: none; }\n.msg-bubble.green { background: #1688FF; color: #fff; border-radius: 19px 19px 7px 19px; box-shadow: none; }\n.msg-bubble.green .msg-meta { color: rgba(255,255,255,0.74); }' },
    { id: 'soft-paper', name: '柔纸', css: '.msg-bubble { background: #FFF7E8; color: #34251B; border: 1px solid rgba(160,118,75,0.18); border-radius: 16px 16px 16px 6px; box-shadow: 0 2px 8px rgba(94,65,39,0.07); }\n.msg-bubble.green { background: #E7F5EF; color: #20362C; border-color: rgba(70,130,103,0.18); border-radius: 16px 16px 6px 16px; }' },
    { id: 'strawberry', name: '草莓布丁', css: '.msg-bubble { color: #C75C83; background: #FDECF2; border: 2px dashed #F6A4C1; box-shadow: 0 3px 6px rgba(220,150,180,0.2); border-radius: 20px 20px 20px 8px; text-shadow: none; }\n.msg-bubble.green { color: #C75C83; background: #FDECF2; border: 2px dashed #F6A4C1; box-shadow: 0 3px 6px rgba(220,150,180,0.2); border-radius: 20px 20px 8px 20px; }' }
];
const BUBBLE_PRESETS_KEY = 'my_bubble_presets';

function getUserBubblePresets() {
    try {
        const raw = localStorage.getItem(BUBBLE_PRESETS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
}

function saveUserBubblePresets(list) {
    localStorage.setItem(BUBBLE_PRESETS_KEY, JSON.stringify(list));
}

function getAllBubblePresets() {
    return [...BUBBLE_CSS_PRESETS, ...getUserBubblePresets()];
}

function renderBubblePresetDropdown(selectedCss) {
    const sel = document.getElementById('wcs-bubble-preset');
    if (!sel) return;
    const all = getAllBubblePresets();
    sel.innerHTML = all.map(p =>
        `<option value="${p.id}">${p.name}</option>`
    ).join('');
    // 找到匹配当前CSS的预设
    const match = all.find(p => p.css.replace(/\s+/g, '') === (selectedCss || '').replace(/\s+/g, ''));
    sel.value = match ? match.id : 'default';
    renderBubblePresetPicker(all, sel.value);
}

function renderBubblePresetPicker(all, selectedId) {
    const label = document.getElementById('wcs-bubble-preset-label');
    const menu = document.getElementById('wcs-bubble-preset-menu');
    if (!label || !menu) return;
    const selected = all.find(p => p.id === selectedId) || all[0];
    label.textContent = selected ? selected.name : '默认';
    menu.innerHTML = all.map(p => `
        <button type="button" class="wcs-bubble-option ${p.id === selectedId ? 'active' : ''}" data-preset-id="${wcEscapeHtml(p.id)}">
            <span>${wcEscapeHtml(p.name)}</span>
            ${p.id === selectedId ? '<i class="ri-check-line"></i>' : ''}
        </button>
    `).join('');
    menu.querySelectorAll('.wcs-bubble-option').forEach(btn => {
        btn.onclick = () => chooseBubblePreset(btn.dataset.presetId || 'default');
    });
}

function toggleBubblePresetPicker(event) {
    if (event) event.stopPropagation();
    const wrap = document.querySelector('.wcs-bubble-preset-wrap');
    if (!wrap) return;
    wrap.classList.toggle('open');
}

function closeBubblePresetPicker() {
    const wrap = document.querySelector('.wcs-bubble-preset-wrap');
    if (wrap) wrap.classList.remove('open');
}

function chooseBubblePreset(presetId) {
    const sel = document.getElementById('wcs-bubble-preset');
    if (sel) sel.value = presetId;
    applyBubblePreset(presetId);
    closeBubblePresetPicker();
}

function applyBubblePreset(presetId) {
    const all = getAllBubblePresets();
    const preset = all.find(p => p.id === presetId);
    if (!preset) return;
    const textarea = document.getElementById('wcs-custom-css');
    if (textarea) {
        textarea.value = preset.css;
        previewBubbleCss(preset.css);
    }
    const sel = document.getElementById('wcs-bubble-preset');
    if (sel) sel.value = preset.id;
    renderBubblePresetPicker(all, preset.id);
}

function saveCurrentCssAsPreset() {
    const textarea = document.getElementById('wcs-custom-css');
    if (!textarea || !textarea.value.trim()) {
        alert('请先在下面的编辑框中输入CSS样式');
        return;
    }
    const name = prompt('给这个气泡样式起个名字：');
    if (!name || !name.trim()) return;
    const presets = getUserBubblePresets();
    const newPreset = {
        id: 'bp_' + Date.now(),
        name: name.trim(),
        css: textarea.value.trim()
    };
    presets.push(newPreset);
    saveUserBubblePresets(presets);
    renderBubblePresetDropdown(newPreset.css);
    const sel = document.getElementById('wcs-bubble-preset');
    if (sel) sel.value = newPreset.id;
}

function deleteSelectedPreset() {
    const sel = document.getElementById('wcs-bubble-preset');
    if (!sel) return;
    const id = sel.value;
    if (BUBBLE_CSS_PRESETS.find(p => p.id === id)) {
        alert('内置预设不能删除哦～');
        return;
    }
    const presets = getUserBubblePresets();
    const idx = presets.findIndex(p => p.id === id);
    if (idx === -1) return;
    if (!confirm(`确定删除预设「${presets[idx].name}」吗？`)) return;
    presets.splice(idx, 1);
    saveUserBubblePresets(presets);
    document.getElementById('wcs-custom-css').value = '';
    previewBubbleCss('');
    renderBubblePresetDropdown('');
}

function clearBubbleCssPreset() {
    const textarea = document.getElementById('wcs-custom-css');
    if (textarea) textarea.value = '';
    previewBubbleCss('');
    renderBubblePresetDropdown('');
}

document.addEventListener('click', event => {
    if (!event.target.closest('.wcs-bubble-preset-wrap')) closeBubblePresetPicker();
});

// --- A. 微信界面渲染 ---

function renderChatList() {
    renderWechatThemeChatHeader();
    const listEl = document.getElementById('wc-chat-list');
    if (!listEl) return;
    listEl.innerHTML = ''; 
    const themeId = getWechatUiThemeId();
    const isXTheme = themeId === 'hallowrok';

    if (window.myCharacters.length === 0) {
        if (isXTheme) return;
        listEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; color:#ccc;">
                <i class="ri-chat-smile-2-line" style="font-size:48px; margin-bottom:10px;"></i>
                <span style="font-size:14px;">暂无消息</span>
                <span style="font-size:12px; margin-top:5px;">点击右上角 + 导入角色卡</span>
            </div>
        `;
        return;
    }

    const isDouyinTheme = themeId === 'douyin';
    const isLineTheme = themeId === 'line';
    window.myCharacters.forEach(char => {
        const container = document.createElement('div');
        container.className = 'wc-swipe-container';
        container.dataset.charId = char.id;

        const item = document.createElement('div');
        item.className = 'wc-chat-item';
        let pointerStartX = 0;
        let pointerStartY = 0;
        const openFromListItem = (event) => {
            if (event?.target?.closest('.wc-delete-btn')) return;
            if (container.classList.contains('swiping') || container.classList.contains('swipe-open')) return;
            const lastOpenAt = Number(container.dataset.openingAt || 0);
            if (Date.now() - lastOpenAt < 360) return;
            container.dataset.openingAt = String(Date.now());
            event?.preventDefault?.();
            event?.stopPropagation?.();
            openChat(char.id);
        };
        item.addEventListener('pointerdown', (event) => {
            pointerStartX = event.clientX;
            pointerStartY = event.clientY;
        }, { passive: true });
        item.addEventListener('pointerup', (event) => {
            if (event.pointerType === 'mouse') return;
            if (Math.abs(event.clientX - pointerStartX) < 18 && Math.abs(event.clientY - pointerStartY) < 18) {
                openFromListItem(event);
            }
        });
        item.addEventListener('click', openFromListItem);
        const isGroup = !!char.isGroupChat;
        const displayName = isGroup ? (char.name || '群聊') : ((char.chatConfig && char.chatConfig.nickname) || char.name);
        const avatar = char.avatar || (isGroup ? buildWechatGroupAvatar(char) : DEFAULT_AVATAR);
        const douyinUnread = isDouyinTheme ? getWechatDouyinUnreadCount(char) : 0;
        const douyinSpark = isDouyinTheme ? getWechatDouyinSparkScore(char) : 0;
        const douyinUnreadHtml = isDouyinTheme && douyinUnread > 0
            ? `<span class="wc-douyin-unread">${douyinUnread > 99 ? '99+' : douyinUnread}</span>`
            : '';
        const douyinSparkHtml = isDouyinTheme && douyinSpark > 0
            ? `<span class="wc-douyin-spark">🔥 ${douyinSpark}</span>`
            : '';

        const telegramTime = formatTelegramChatListTime(char);
        const telegramUnread = getTelegramChatUnreadCount(char);
        const telegramUnreadHtml = telegramUnread > 0
            ? `<span class="wc-telegram-unread">${telegramUnread > 99 ? '99+' : telegramUnread}</span>`
            : '';
        const lineUnread = isLineTheme ? getTelegramChatUnreadCount(char) : 0;
        const lineUnreadHtml = lineUnread > 0
            ? `<span class="wc-line-unread">${lineUnread > 99 ? '99+' : lineUnread}</span>`
            : '';

        item.innerHTML = `
            <div class="wc-avatar ${isGroup ? 'wc-group-avatar' : ''}"><img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">${douyinUnreadHtml}</div>
            <div class="wc-info">
                <div class="wc-top">
                    <span class="wc-name">${escapeHtml(displayName)}${douyinSparkHtml}</span>
                    <span class="wc-time">${escapeHtml(formatWechatChatListTime(char))}</span>
                    <span class="wc-line-list-side">
                        <span class="wc-line-date">${escapeHtml(formatWechatChatListTime(char))}</span>
                        ${lineUnreadHtml}
                    </span>
                    <span class="wc-telegram-list-meta">
                        <span class="wc-telegram-date"><i class="ri-pushpin-2-fill"></i>${escapeHtml(telegramTime)}</span>
                        ${telegramUnreadHtml}
                    </span>
                </div>
                <div class="wc-bottom">
                    <span class="wc-msg">${isGroup ? `[${(char.groupMembers || []).length}人] ` : ''}${escapeHtml(getChatPreview(char))}</span>
                </div>
            </div>
        `;

        const delBtn = document.createElement('div');
        delBtn.className = 'wc-delete-btn';
        delBtn.innerHTML = '<span>删除</span>';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteCharacter(char.id); };

        container.appendChild(item);
        container.appendChild(delBtn);
        listEl.appendChild(container);
    });

    initSwipeHandlers();
}

function getWechatGroupContacts() {
    return (window.myCharacters || []).filter(char => char && char.id && !char.isGroupChat);
}

function buildWechatGroupAvatar(group) {
    const members = Array.isArray(group?.groupMembers) ? group.groupMembers : [];
    const hue = Math.abs(String(group?.id || group?.name || 'group').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % 360;
    const label = members.length ? members.length : 'G';
    return 'data:image/svg+xml,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
            <rect width="120" height="120" rx="24" fill="hsl(${hue},70%,92%)"/>
            <rect x="18" y="18" width="38" height="38" rx="12" fill="hsl(${hue},70%,58%)"/>
            <rect x="64" y="18" width="38" height="38" rx="12" fill="hsl(${(hue + 36) % 360},70%,66%)"/>
            <rect x="18" y="64" width="38" height="38" rx="12" fill="hsl(${(hue + 72) % 360},68%,72%)"/>
            <rect x="64" y="64" width="38" height="38" rx="12" fill="#ffffff"/>
            <text x="83" y="88" text-anchor="middle" font-family="Arial" font-size="24" font-weight="800" fill="hsl(${hue},54%,34%)">${label}</text>
        </svg>
    `);
}

function closeWechatPlusMenu() {
    document.getElementById('wc-plus-menu')?.remove();
}

function openWechatPlusMenu(event) {
    event?.stopPropagation?.();
    const old = document.getElementById('wc-plus-menu');
    if (old) {
        old.remove();
        return;
    }
    const root = document.getElementById('app-wechat-window');
    if (!root) return;
    const menu = document.createElement('div');
    menu.id = 'wc-plus-menu';
    const fromXFab = !!(event && event.currentTarget && event.currentTarget.closest && event.currentTarget.closest('.wc-x-compose-fab'));
    menu.className = `wc-plus-menu${fromXFab ? ' wc-plus-menu-x-fab' : ''}`;
    menu.innerHTML = `
        <button type="button" onclick="closeWechatPlusMenu();testAddCharacter()"><i class="ri-user-add-line"></i><span>导入角色</span></button>
        <button type="button" onclick="openWechatGroupCreator()"><i class="ri-group-line"></i><span>发起群聊</span></button>
        <button type="button" onclick="startWechatScreenShare()"><i class="ri-cast-line"></i><span>共享屏幕</span></button>
    `;
    root.appendChild(menu);
    setTimeout(() => {
        const closer = (ev) => {
            if (!ev.target.closest('#wc-plus-menu, .wc-header-right')) {
                closeWechatPlusMenu();
                document.removeEventListener('click', closer, true);
            }
        };
        document.addEventListener('click', closer, true);
    }, 0);
}
window.openWechatPlusMenu = openWechatPlusMenu;
window.closeWechatPlusMenu = closeWechatPlusMenu;

function openWechatSearch() {
    const root = document.getElementById('app-wechat-window');
    const input = document.getElementById('wc-search-input');
    if (!root || !input) return;
    closeWechatPlusMenu();
    root.classList.add('wc-search-open');
    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });
}

function closeWechatSearch() {
    const root = document.getElementById('app-wechat-window');
    const input = document.getElementById('wc-search-input');
    if (input) input.value = '';
    filterChatList('');
    if (root) root.classList.remove('wc-search-open');
}

function getWechatMessageSearchText(msg) {
    if (!msg) return '';
    if (isWechatSpecialMessage(msg.type)) return getWechatMessageSummary(msg);
    if (msg.type === 'image') return '[图片]';
    if (msg.type === 'sticker') return msg.stickerName ? `[表情] ${msg.stickerName}` : '[表情]';
    if (msg.type === 'system_notice') return msg.content || '';
    return stripWechatPromptText(msg.content || msg.dialogue || msg.description || '', 260);
}

function renderWechatCurrentChatSearchResults(query = '') {
    const list = document.getElementById('wc-chat-message-search-results');
    if (!list) return;
    const char = getCurrentChatChar();
    if (!char) {
        list.innerHTML = '<div class="wc-chat-search-empty">没有打开聊天</div>';
        return;
    }
    const q = String(query || '').trim().toLowerCase();
    const history = Array.isArray(char.history) ? char.history : [];
    const rows = history
        .map((msg, index) => ({ msg, index, text: getWechatMessageSearchText(msg) }))
        .filter(item => item.text && item.msg && item.msg.type !== 'system_notice')
        .filter(item => !q || item.text.toLowerCase().includes(q))
        .slice(q ? 0 : Math.max(0, history.length - 24), q ? 80 : history.length)
        .reverse();
    if (!rows.length) {
        list.innerHTML = `<div class="wc-chat-search-empty">${q ? '没有搜到相关消息' : '还没有可搜索的消息'}</div>`;
        return;
    }
    list.innerHTML = rows.map(item => {
        const side = item.msg.isMe ? '你' : getWechatCharDisplayName(char);
        const time = formatMessageTime(item.msg);
        return `
            <button type="button" class="wc-chat-search-result" onclick="openWechatSearchResult(${Number(item.index)})">
                <b>${wcEscapeHtml(side)}</b>
                <span>${wcEscapeHtml(item.text)}</span>
                <em>${wcEscapeHtml(time)}</em>
            </button>
        `;
    }).join('');
}

function openWechatCurrentChatSearch() {
    const char = getCurrentChatChar();
    if (!char) {
        showWechatToast('先打开一个聊天');
        return;
    }
    closeChatToolbar();
    openWechatFeatureScreen('搜索消息', `
        <div class="wc-chat-search-page">
            <label class="wc-chat-search-box">
                <i class="ri-search-line"></i>
                <input id="wc-chat-message-search-input" placeholder="搜索当前聊天记录" oninput="renderWechatCurrentChatSearchResults(this.value)">
            </label>
            <div id="wc-chat-message-search-results" class="wc-chat-search-results"></div>
        </div>
    `);
    setWechatFeatureLeftText('取消', 'closeWechatFeatureScreen()');
    requestAnimationFrame(() => {
        document.getElementById('wc-chat-message-search-input')?.focus();
        renderWechatCurrentChatSearchResults('');
    });
}

function openWechatSearchResult(msgIdx) {
    const char = getCurrentChatChar();
    if (!char) return;
    window._wechatExpandedHistoryIds = window._wechatExpandedHistoryIds || new Set();
    window._wechatExpandedHistoryIds.add(char.id);
    closeWechatFeatureScreen();
    refreshChatView(char);
    setTimeout(() => {
        const row = document.querySelector(`.msg-row[data-msg-idx="${Number(msgIdx)}"]`);
        if (!row) return;
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        row.classList.add('msg-source-highlight');
        setTimeout(() => row.classList.remove('msg-source-highlight'), 1600);
    }, 260);
}

window.openWechatSearch = openWechatSearch;
window.closeWechatSearch = closeWechatSearch;
window.openWechatCurrentChatSearch = openWechatCurrentChatSearch;
window.renderWechatCurrentChatSearchResults = renderWechatCurrentChatSearchResults;
window.openWechatSearchResult = openWechatSearchResult;

function openWechatGroupCreator() {
    closeWechatPlusMenu();
    const contacts = getWechatGroupContacts();
    window._wechatGroupDraftIds = Array.isArray(window._wechatGroupDraftIds) ? window._wechatGroupDraftIds.filter(id => contacts.some(c => c.id === id)) : [];
    const html = `
        <div class="wc-group-create">
            <div class="wc-group-create-top">
                <strong>选择联系人</strong>
                <span>从现有 AI 联系人里拉进群聊，至少选择 2 个。</span>
            </div>
            <input id="wc-group-name-input" class="wc-group-name-input" maxlength="24" placeholder="群聊名称，可留空自动生成">
            <div class="wc-group-select-list">
                ${contacts.length ? contacts.map(char => `
                    <button type="button" class="wc-group-select-item ${window._wechatGroupDraftIds.includes(char.id) ? 'active' : ''}" onclick="toggleWechatGroupDraftMember(${quoteWechatJsString(char.id)})">
                        <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                        <span>${wcEscapeHtml((char.chatConfig && char.chatConfig.nickname) || char.name || '未命名')}</span>
                        <i class="${window._wechatGroupDraftIds.includes(char.id) ? 'ri-checkbox-circle-fill' : 'ri-add-circle-line'}"></i>
                    </button>
                `).join('') : '<div class="wc-contacts-empty">还没有可拉入群聊的联系人</div>'}
            </div>
            <button type="button" class="wc-group-create-btn" onclick="createWechatGroupChat()">创建群聊</button>
        </div>
    `;
    openWechatFeatureScreen('发起群聊', html);
}
window.openWechatGroupCreator = openWechatGroupCreator;
window.openWechatGroupCreate = openWechatGroupCreator;

function toggleWechatGroupDraftMember(charId) {
    const ids = Array.isArray(window._wechatGroupDraftIds) ? window._wechatGroupDraftIds : [];
    window._wechatGroupDraftIds = ids.includes(charId) ? ids.filter(id => id !== charId) : [...ids, charId];
    openWechatGroupCreator();
}
window.toggleWechatGroupDraftMember = toggleWechatGroupDraftMember;

function createWechatGroupChat() {
    const ids = Array.isArray(window._wechatGroupDraftIds) ? window._wechatGroupDraftIds : [];
    const members = ids.map(id => getWechatGroupContacts().find(char => char.id === id)).filter(Boolean);
    if (members.length < 2) {
        if (typeof showWechatToast === 'function') showWechatToast('至少选择 2 个联系人');
        return;
    }
    const inputName = (document.getElementById('wc-group-name-input')?.value || '').trim();
    const name = inputName || members.slice(0, 3).map(char => (char.chatConfig && char.chatConfig.nickname) || char.name || '好友').join('、') + (members.length > 3 ? ` 等${members.length}人` : '');
    const group = {
        id: 'group_' + Date.now(),
        name,
        description: '微信联系人群聊',
        avatar: '',
        isGroupChat: true,
        groupMembers: members.map(char => char.id),
        groupCreatedAt: Date.now(),
        chatConfig: {},
        history: [
            { type: 'system_notice', isMe: false, content: `你邀请 ${members.map(char => (char.chatConfig && char.chatConfig.nickname) || char.name || '好友').join('、')} 加入了群聊`, timestamp: createMessageTimestamp() }
        ]
    };
    group.avatar = buildWechatGroupAvatar(group);
    window.myCharacters.unshift(group);
    window._wechatGroupDraftIds = [];
    saveCharactersToStorage();
    closeWechatFeatureScreen();
    switchWcTab('chat');
    renderChatList();
    openChat(group.id);
}
window.createWechatGroupChat = createWechatGroupChat;

function getWechatChatListTimestamp(char) {
    const msg = getWechatLastChatMessage(char);
    const raw = msg && (msg.timestamp || msg.createdAt || msg.time);
    if (raw) return raw;
    return char?.importedAt || char?.createdAt || char?.created_at || char?.importTime || char?.updatedAt || '';
}

function formatWechatChatListTime(char) {
    const raw = getWechatChatListTimestamp(char);
    if (!raw) return '现在';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '现在';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))}分钟前`;
    const sameDay = date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
    if (sameDay) return `${padWechatDatePart(date.getHours())}:${padWechatDatePart(date.getMinutes())}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getFullYear() === yesterday.getFullYear()
        && date.getMonth() === yesterday.getMonth()
        && date.getDate() === yesterday.getDate();
    if (isYesterday) return '昨天';
    if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}/${date.getDate()}`;
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function getChatPreview(char) {
    const history = char.history || [];
    const last = history[history.length - 1];
    if (!last) return char.description ? String(char.description).replace(/\s+/g, ' ').slice(0, 40) : '还没有聊天记录';
    if (last.type === 'image') return last.isMe ? '[图片]' : '[对方发来图片]';
    if (last.type === 'sticker') return last.isMe ? '[表情]' : '[对方发来表情]';
    if (isWechatSpecialMessage(last.type)) return getWechatMessageSummary(last);
    const text = String(last.content || last.dialogue || last.description || '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text || '[消息]';
}

function filterChatList(keyword) {
    const items = document.querySelectorAll('#wc-chat-list .wc-swipe-container');
    const kw = keyword.trim().toLowerCase();
    items.forEach(container => {
        const charId = container.dataset.charId;
        const char = window.myCharacters.find(c => c.id === charId);
        if (!char) return;
        const nickname = (char.chatConfig && char.chatConfig.nickname) || '';
        const match = !kw || char.name.toLowerCase().includes(kw) || nickname.toLowerCase().includes(kw);
        container.style.display = match ? '' : 'none';
    });
}

// 通用工具：正则替换 + Markdown 清洗
function getWechatDisplayUserName() {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    return (profile && profile.name) || '我';
}

function getWechatDisplayCharName(char) {
    if (!char) return '';
    return (char.chatConfig && char.chatConfig.nickname) || char.name || '';
}

function fillWechatRegexTemplate(value, char) {
    return String(value == null ? '' : value)
        .replace(/\{\{char\}\}/gi, getWechatDisplayCharName(char))
        .replace(/\{\{user\}\}/gi, getWechatDisplayUserName());
}

function getWechatRegexScriptField(script, keys) {
    if (!script || typeof script !== 'object') return '';
    for (const key of keys) {
        if (script[key] != null && script[key] !== '') return script[key];
    }
    const common = {
        findRegex: ['find_regex', 'find', 'match', 'matcher', 'regexPattern', 'regex_pattern'],
        replaceString: ['replace_string', 'replaceWith', 'replace_with', 'replacement', 'substitute_regex', 'substituteRegex']
    };
    for (const key of keys) {
        const aliases = common[key] || [];
        for (const alias of aliases) {
            if (script[alias] != null && script[alias] !== '') return script[alias];
        }
    }
    if (script.script && typeof script.script === 'object') {
        return getWechatRegexScriptField(script.script, keys);
    }
    return '';
}

function isWechatRegexScriptEnabled(script) {
    if (!script || typeof script !== 'object') return false;
    if (script.enabled === false || script.disabled === true || script.isDisabled === true) return false;
    if (script.use_regex === false || script.useRegex === false) return false;
    if (String(script.enabled).toLowerCase() === 'false') return false;
    if (String(script.disabled).toLowerCase() === 'true') return false;
    if (String(script.use_regex).toLowerCase() === 'false') return false;
    if (String(script.useRegex).toLowerCase() === 'false') return false;
    return true;
}

function renderWechatMarkdownLite(text) {
    let html = wcEscapeHtml(text);
    const codeSpans = [];
    html = html.replace(/`([^`\n]+)`/g, (match, code) => {
        const key = `__WC_CODE_${codeSpans.length}__`;
        codeSpans.push(`<code>${code}</code>`);
        return key;
    });
    html = html.replace(/\*\*([^*\n][\s\S]*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    codeSpans.forEach((value, index) => {
        html = html.replace(`__WC_CODE_${index}__`, value);
    });
    return html.replace(/\n/g, '<br>');
}

function processMsgContent(content, char) {
    if (!content) return "";
    let text = cleanWechatVisibleContent(content);
    if (!text) return "";

    text = fillWechatRegexTemplate(text, char);

    // 1. 执行正则脚本
    const globalScripts = window.globalRegexScripts || [];
    const charScripts = char.regex || [];
    const allScripts = [...globalScripts, ...charScripts];

    allScripts.forEach(script => {
        if (!isWechatRegexScriptEnabled(script)) return; // 🔥 跳过已关闭的脚本
        try {
            const regexStr = getWechatRegexScriptField(script, ['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']);
            let replaceStr = getWechatRegexScriptField(script, ['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']);
            if (regexStr) {
                let pattern = fillWechatRegexTemplate(regexStr, char);
                let flags = 'g'; 
                if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
                    const lastSlash = pattern.lastIndexOf('/');
                    flags = pattern.substring(lastSlash + 1).replace(/[^gimsuy]/g, '');
                    pattern = pattern.substring(1, lastSlash);
                }
                const re = new RegExp(pattern, flags);
                if (replaceStr && typeof replaceStr === 'string') {
                    replaceStr = fillWechatRegexTemplate(replaceStr, char).replace(/\{\{match\}\}/gi, '$&');
                }
                text = text.replace(re, replaceStr);
            }
        } catch (e) { console.warn("正则执行失败:", script.name, e); }
    });

    text = cleanWechatVisibleContent(text);
    if (!text) return "";

    // 2. 剥离 Markdown 代码块包装（支持混合内容：文本 + 代码块）
    // 先处理内嵌的 ```html...``` 代码块，提取其中的HTML
    text = text.replace(/```(?:html|xml|markdown)?\s*([\s\S]*?)```/gi, function(match, code) {
        return code.trim();
    });
    // 如果处理后包含HTML/正则渲染块，直接返回，避免把结构化 UI 拆成旁白或 <br>
    if (isRichMessageContent(text)) {
        return text;
    } else {
        return renderWechatMarkdownLite(text); 
    }
}

// 微信聊天窗口
function openChat(charId) {
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    window.currentChatCharId = charId;
    clearWechatReplyDraft();
    let touchedMessageTime = false;
    (char.history || []).forEach(msg => {
        if (ensureMessageTimestamp(msg)) touchedMessageTime = true;
    });
    const readStateChanged = markWechatCharMessagesRead(char);

    const config = char.chatConfig || {};
    document.getElementById('chat-room-title').textContent = config.nickname || char.name;
    const floatImg = document.getElementById('wc-float-avatar-img');
    const floatName = document.getElementById('wc-float-name');
    const roomHeaderAvatar = document.getElementById('chat-room-header-avatar');
    if (floatImg) floatImg.src = char.avatar || DEFAULT_AVATAR;
    if (floatName) floatName.textContent = config.nickname || char.name;
    if (roomHeaderAvatar) roomHeaderAvatar.src = char.avatar || DEFAULT_AVATAR;
    syncWechatLineRoomHeader();
    if (touchedMessageTime || readStateChanged) saveCharactersToStorage();
    if (readStateChanged) renderChatList();
    // 应用聊天配置（背景/气泡/字体）
    applyChatConfig(char);
    refreshChatView(char);
    setWechatVoiceInputMode(false, { keepDraft: true });
    syncWechatDraftState();

    const room = document.getElementById('wechat-chat-room');
    const inputEl = document.getElementById('wc-msg-input');
    if (inputEl) inputEl.placeholder = isWechatXTheme() ? '私信' : '发消息...';
    room.classList.remove('hidden');
    setTimeout(() => room.classList.add('active'), 10);
}


function openWechatMessageSource(charId, msgKey) {
    if (!charId) return;
    if (typeof openApp === 'function') openApp('wechat');
    closeWechatFeatureScreen();
    setTimeout(() => {
        openChat(charId);
        requestAnimationFrame(() => {
            const char = window.myCharacters.find(c => c.id === charId);
            const history = Array.isArray(char && char.history) ? char.history : [];
            const index = history.findIndex((msg, idx) => getWechatMessageSourceKey(charId, msg, idx) === msgKey);
            const row = index >= 0 ? document.querySelector(`.msg-row[data-msg-idx="${index}"]`) : null;
            if (row) {
                row.scrollIntoView({ block: 'center', behavior: 'smooth' });
                row.classList.add('msg-source-highlight');
                setTimeout(() => row.classList.remove('msg-source-highlight'), 1600);
            }
        });
    }, 80);
}

function getWechatMessageSourceKey(charId, msg, msgIdx) {
    return `message:${charId}:${msg?.id || msg?.timestamp || msg?.createdAt || msgIdx}`;
}

// 2. 修复切换开场白导致微信也变的问题 (数据分离)
function switchGreeting(direction) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    const allGreetings = [char.first_mes_original || char.first_mes, ...(char.alternates || [])].filter(t => t);
    
    if (typeof char.currentGreetingIndex === 'undefined') char.currentGreetingIndex = 0;

    let newIndex = char.currentGreetingIndex + direction;
    if (newIndex < 0) newIndex = allGreetings.length - 1; 
    if (newIndex >= allGreetings.length) newIndex = 0; 

    // 🔥 核心修改：只更新“索引”，绝对不去改 history 里的内容！
    // 微信读取的是 history，所以微信永远不变。
    // 当前问候语索引会影响角色开场白。
    char.currentGreetingIndex = newIndex;
    
    // 注意：这里不再调用 openChat 刷新微信，因为微信不需要变
}

function createMessageTimestamp() {
    return Date.now();
}

function padWechatDatePart(value) {
    return String(value).padStart(2, '0');
}

function toWechatDatetimeLocalValue(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return `${safeDate.getFullYear()}-${padWechatDatePart(safeDate.getMonth() + 1)}-${padWechatDatePart(safeDate.getDate())}T${padWechatDatePart(safeDate.getHours())}:${padWechatDatePart(safeDate.getMinutes())}`;
}

function formatWechatDateTimeForPrompt(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${safeDate.getFullYear()}年${safeDate.getMonth() + 1}月${safeDate.getDate()}日 ${weekdays[safeDate.getDay()]} ${padWechatDatePart(safeDate.getHours())}:${padWechatDatePart(safeDate.getMinutes())}`;
}

function getWechatCurrentTimeContext(char) {
    const config = (char && char.chatConfig) || {};
    const mode = config.timeMode === 'virtual' ? 'virtual' : 'real';
    const rawTime = mode === 'virtual' ? config.virtualTime : null;
    const date = rawTime ? new Date(rawTime) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return {
        mode,
        label: mode === 'virtual' ? '虚拟时间' : '真实世界时间',
        text: formatWechatDateTimeForPrompt(safeDate),
        iso: safeDate.toISOString()
    };
}

function ensureMessageTimestamp(msg) {
    if (!msg.timestamp && !msg.createdAt && !msg.time) {
        msg.timestamp = createMessageTimestamp();
        return true;
    }
    return false;
}

function formatMessageTime(msg) {
    const rawTime = msg.timestamp || msg.createdAt || msg.time;
    const date = rawTime ? new Date(rawTime) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return `${String(safeDate.getHours()).padStart(2, '0')}:${String(safeDate.getMinutes()).padStart(2, '0')}`;
}

function buildMessageMeta(msg) {
    const readIcon = '<i class="ri-check-double-line"></i>';
    return `<span class="msg-meta ${msg.isMe ? 'read' : 'delivered'}"><span>${formatMessageTime(msg)}</span>${readIcon}</span>`;
}

function getWechatLastChatMessage(char) {
    const history = Array.isArray(char?.history) ? char.history : [];
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg && msg.type !== 'system_notice') return msg;
    }
    return null;
}

function formatTelegramChatListTime(char) {
    const msg = getWechatLastChatMessage(char);
    const raw = msg && (msg.timestamp || msg.createdAt || msg.time);
    if (!raw) return '现在';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '现在';
    const now = new Date();
    const sameDay = date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
    if (sameDay) return `${padWechatDatePart(date.getHours())}:${padWechatDatePart(date.getMinutes())}`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getTelegramChatUnreadCount(char) {
    if (!char) return 0;
    if (typeof isWechatChatPageActive === 'function' && isWechatChatPageActive(char.id)) return 0;
    const explicit = Number(char?.unreadCount ?? char?.chatConfig?.unreadCount ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return Math.min(999, Math.floor(explicit));
    const history = Array.isArray(char?.history) ? char.history : [];
    const lastReadAt = Number(char?.chatConfig?.lastReadAt) || 0;
    let count = 0;
    if (lastReadAt > 0) {
        history.forEach(msg => {
            if (!msg || msg.type === 'system_notice' || msg.isMe) return;
            if (getWechatMessageTimestampValue(msg) > lastReadAt) count += 1;
        });
    } else {
        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            if (!msg || msg.type === 'system_notice') continue;
            if (msg.isMe) break;
            count += 1;
        }
    }
    return Math.min(999, count);
}


function getWechatMessageDate(msg) {
    const raw = msg && (msg.timestamp || msg.createdAt || msg.time);
    const date = raw ? new Date(raw) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildWechatCollectedAtText(msg) {
    const rawTime = msg.collectedAt || msg.timestamp || msg.createdAt || msg.time;
    return rawTime ? `已于 ${formatMessageTime({ timestamp: rawTime })} 收取` : '已收取';
}

function getWechatMessagePlainSummary(msg, maxLength = 92) {
    const raw = getWechatMessageSummary(msg)
        .replace(/<[^>]+>/g, '')
        .replace(/\|\|\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!raw) return '[消息]';
    return raw.length > maxLength ? raw.slice(0, maxLength - 1) + '…' : raw;
}

function getWechatMessageSenderName(msg, char) {
    if (msg && msg.isMe) {
        const profile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : ((typeof getUserProfile === 'function') ? getUserProfile() : null);
        return (profile && profile.name) || '我';
    }
    return getWechatCharDisplayName(char);
}

function renderWechatXChatProfileIntro(char) {
    if (!char || !isWechatXTheme()) return '';
    const name = wcEscapeHtml(getWechatCharDisplayName(char));
    const avatar = wcEscapeHtml(char.avatar || DEFAULT_AVATAR);
    const handleSource = getWechatContactId(char) || String(char.name || 'contact').replace(/\s+/g, '').slice(0, 18) || 'contact';
    const handle = wcEscapeHtml(handleSource.startsWith('@') ? handleSource : `@${handleSource}`);
    const createdAt = char.importedAt || char.createdAt || char.addedAt || Date.now();
    const date = new Date(createdAt);
    const joined = Number.isNaN(date.getTime())
        ? '加入于今天'
        : `加入于 ${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    return `
        <div class="wc-x-chat-profile-intro" onclick="openWechatContactProfile(${quoteWechatJsString(char.id)})">
            <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
            <strong>${name}</strong>
            <span>${handle}</span>
            <em>${wcEscapeHtml(joined)}</em>
            <button type="button" onclick="event.stopPropagation();openWechatContactProfile(${quoteWechatJsString(char.id)})">查看个人资料</button>
        </div>
    `;
}

function buildWechatReplySnapshot(msg, char, msgIdx) {
    if (!msg) return null;
    return {
        msgId: msg.id || '',
        msgIdx: Number.isInteger(msgIdx) ? msgIdx : null,
        isMe: !!msg.isMe,
        sender: getWechatMessageSenderName(msg, char),
        text: getWechatMessagePlainSummary(msg, 120),
        type: msg.type || 'text',
        timestamp: msg.timestamp || msg.createdAt || msg.time || ''
    };
}

function findWechatMessageForAiQuote(char, query) {
    if (!char || !Array.isArray(char.history) || !char.history.length) return null;
    const history = char.history;
    const raw = String(query || '').trim();
    if (/^\d+$/.test(raw)) {
        const index = Math.max(0, Math.min(history.length - 1, parseInt(raw, 10) - 1));
        return { msg: history[index], index };
    }
    const normalized = raw.replace(/^(?:最后|上一条|最近|last)$/i, '').trim();
    if (!normalized) {
        for (let i = history.length - 1; i >= 0; i -= 1) {
            const msg = history[i];
            if (msg && msg.type !== 'system_notice' && msg.isMe) return { msg, index: i };
        }
    }
    for (let i = history.length - 1; i >= 0; i -= 1) {
        const msg = history[i];
        if (!msg || msg.type === 'system_notice') continue;
        const summary = getWechatMessagePlainSummary(msg, 180);
        if (!normalized || summary.includes(normalized) || getWechatMessageSenderName(msg, char).includes(normalized)) {
            return { msg, index: i };
        }
    }
    return null;
}

function renderWechatMessageQuote(replyTo) {
    if (!replyTo || !replyTo.text) return '';
    const sender = wcEscapeHtml(replyTo.sender || (replyTo.isMe ? '我' : '对方'));
    const text = wcEscapeHtml(replyTo.text || '[消息]');
    return `<div class="msg-quote"><strong>${sender}</strong><span>${text}</span></div>`;
}

function appendWechatTimeDivider(container, date) {
    if (!container) return;
    const divider = document.createElement('div');
    divider.className = 'msg-row time';
    divider.innerHTML = `<div class="msg-time-divider">${wcEscapeHtml(formatWechatDateTimeDivider(date))}</div>`;
    container.appendChild(divider);
}

function formatWechatDateTimeDivider(date) {
    const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const today = new Date();
    const isSameDay = safeDate.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dayText = isSameDay
        ? ''
        : (safeDate.toDateString() === yesterday.toDateString()
            ? '昨天 '
            : `${safeDate.getMonth() + 1}月${safeDate.getDate()}日 `);
    return `${dayText}${String(safeDate.getHours()).padStart(2, '0')}:${String(safeDate.getMinutes()).padStart(2, '0')}`;
}

function shouldShowWechatTimeDivider(prevMsg, msg) {
    const raw = msg && (msg.timestamp || msg.createdAt || msg.time);
    const date = raw ? new Date(raw) : new Date();
    if (Number.isNaN(date.getTime())) return false;
    if (!prevMsg) return true;
    const prevRaw = prevMsg.timestamp || prevMsg.createdAt || prevMsg.time;
    const prevDate = prevRaw ? new Date(prevRaw) : null;
    if (!prevDate || Number.isNaN(prevDate.getTime())) return true;
    const gap = date.getTime() - prevDate.getTime();
    if (gap >= 10 * 60 * 1000) return true;
    return date.getMinutes() === 0 && date.getHours() !== prevDate.getHours();
}

function parseWechatRgbColor(value) {
    const text = String(value || '').trim();
    if (!text || text === 'transparent') return null;
    const rgba = text.match(/^rgba?\(([^)]+)\)$/i);
    if (rgba) {
        const parts = rgba[1].split(',').map(part => parseFloat(part.trim()));
        if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
            const alpha = Number.isFinite(parts[3]) ? parts[3] : 1;
            if (alpha <= 0.02) return null;
            return { r: parts[0], g: parts[1], b: parts[2], a: alpha };
        }
    }
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        const raw = hex[1].length === 3
            ? hex[1].split('').map(ch => ch + ch).join('')
            : hex[1];
        return {
            r: parseInt(raw.slice(0, 2), 16),
            g: parseInt(raw.slice(2, 4), 16),
            b: parseInt(raw.slice(4, 6), 16),
            a: 1
        };
    }
    return null;
}

function getWechatColorLuminance(color) {
    const channel = value => {
        const normalized = Math.max(0, Math.min(255, value)) / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function findWechatPaintedBackground(el) {
    let current = el;
    while (current && current.nodeType === 1) {
        const style = getComputedStyle(current);
        const bg = parseWechatRgbColor(style.backgroundColor);
        if (bg) return bg;
        const imageColor = String(style.backgroundImage || '').match(/rgba?\([^)]+\)|#[0-9a-f]{3,6}/i);
        if (imageColor) {
            const parsed = parseWechatRgbColor(imageColor[0]);
            if (parsed) return parsed;
        }
        current = current.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
}

function applyWechatBubbleMetaContrast(scope) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;
    scope.querySelectorAll('.msg-bubble').forEach(bubble => {
        const color = findWechatPaintedBackground(bubble);
        const isDark = getWechatColorLuminance(color) < 0.48;
        bubble.style.setProperty('--msg-meta-color', isDark ? 'rgba(255,255,255,0.78)' : 'rgba(23,33,43,0.50)');
        bubble.style.setProperty('--msg-meta-icon-color', isDark ? 'rgba(255,255,255,0.88)' : '#4aa3ff');
    });
    scope.querySelectorAll('.msg-meta').forEach(meta => {
        const source = meta.closest('.msg-card-footer') || meta.closest('.msg-bubble') || meta;
        const color = findWechatPaintedBackground(source);
        const isDark = getWechatColorLuminance(color) < 0.48;
        const metaColor = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(23,33,43,0.50)';
        const iconColor = isDark ? 'rgba(255,255,255,0.88)' : '#4aa3ff';
        meta.style.setProperty('color', metaColor, 'important');
        meta.querySelectorAll('i').forEach(icon => icon.style.setProperty('color', iconColor, 'important'));
    });
}

function isRichMessageContent(content) {
    const source = String(content || '');
    return /```(?:html|xml|markdown)?\s*[\s\S]*?```/i.test(source)
        || /<\s*\/?\s*(?:div|style|script|table|iframe|img|span|section|header|article|button|ul|ol|li|p|video|audio|svg|canvas)\b/i.test(source)
        || /<\s*\/?\s*[a-z][\w:-]*\b[^>]*>/i.test(source);
}

function cleanWechatVisibleContent(value) {
    const externalCleaner = typeof window.cleanChatApiVisibleContent === 'function'
        ? window.cleanChatApiVisibleContent
        : null;
    let text = externalCleaner ? externalCleaner(value) : String(value == null ? '' : value);
    if (!text) return '';

    const hiddenTags = [
        'thinking',
        'think',
        'thought',
        'execute_think',
        'cot',
        'analysis',
        'reasoning',
        'chain_of_thought'
    ];

    hiddenTags.forEach(tag => {
        text = text.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    });

    return text
        .replace(/<\/?(?:thinking|think|thought|execute_think|cot|analysis|reasoning|chain_of_thought)\b[^>]*>/gi, '')
        .replace(/<content\b[^>]*>([\s\S]*?)<\/content>/gi, '$1')
        .replace(/<\/?content\b[^>]*>/gi, '')
        .replace(/^\s*(?:思考完毕[，,。；;：:]?\s*)+/i, '')
        .replace(/^\s*(?:生成回复[，,。；;：:]?\s*)+/i, '')
        .trim();
}

function wcEscapeHtml(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value == null ? '' : String(value));
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function quoteWechatJsString(value) {
    const json = JSON.stringify(String(value == null ? '' : value)
    )
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    return json
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
}

function getWechatCssUrl(value) {
    const safe = String(value == null ? '' : value)
        .replace(/'/g, '%27')
        .replace(/"/g, '%22')
        .replace(/\)/g, '%29')
        .replace(/[\r\n]/g, '');
    return `url('${wcEscapeHtml(safe)}')`;
}

function isWechatSpecialMessage(type) {
    return ['voice', 'transfer', 'redpacket', 'voiceCall', 'videoCall', 'share_card', 'gift', 'intimatePay', 'poke', 'screen_shake', 'music_card', 'link_card'].includes(type);
}

function normalizeWechatUrl(value) {
    let raw = String(value || '').trim();
    raw = raw.replace(/[，。；、\s]+$/g, '');
    if (!raw) return '';
    if (/^www\./i.test(raw)) raw = `https://${raw}`;
    if (!/^https?:\/\//i.test(raw)) return '';
    return raw.replace(/^http:\/\//i, 'https://');
}

function extractWechatFirstUrl(value) {
    const source = String(value || '');
    const match = source.match(/https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+/i);
    return match ? normalizeWechatUrl(match[0]) : '';
}

function parseWechatAmountNumber(value) {
    const num = parseFloat(String(value || '').replace(/[^\d.]/g, ''));
    return Number.isFinite(num) && num > 0 ? num : null;
}

function normalizeWechatAmount(value, fallback = '0.00') {
    const num = parseWechatAmountNumber(value);
    if (num == null) return fallback;
    return num.toFixed(2);
}

function normalizeWechatDuration(value, fallback) {
    const num = parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(num) || num <= 0) return fallback;
    return Math.min(num, 5999);
}

function isWechatDurationArg(value) {
    return /^\s*\d+\s*(?:秒|s|S)?\s*$/.test(String(value || ''));
}

function formatWechatDuration(seconds) {
    const sec = normalizeWechatDuration(seconds, 1);
    if (sec < 60) return `${sec}秒`;
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return rest ? `${min}分${String(rest).padStart(2, '0')}秒` : `${min}分钟`;
}

function estimateWechatVoiceDuration(text) {
    const source = String(text || '').trim();
    if (!source) return 1;
    const cjkCount = (source.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
    const asciiText = source.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ');
    const wordTokens = (asciiText.match(/[A-Za-z0-9]+/g) || [])
        .reduce((sum, word) => sum + Math.max(1, Math.ceil(word.length / 4)), 0);
    const punctuationTokens = Math.ceil(((source.match(/[，。！？、,.!?;；:：]/g) || []).length) * 0.35);
    const tokenCount = Math.max(1, cjkCount + wordTokens + punctuationTokens);
    return Math.max(1, Math.min(90, Math.ceil(tokenCount / 3.8)));
}

function updateWechatVoiceDurationEstimate() {
    const transcript = document.getElementById('wc-compose-transcript')?.value || '';
    const duration = estimateWechatVoiceDuration(transcript);
    const label = document.getElementById('wc-compose-duration-estimate');
    if (label) label.textContent = `${duration}"`;
}

function toggleWechatVoiceTranscript(bubbleEl) {
    if (!bubbleEl || !bubbleEl.querySelector('.msg-voice-transcript')) return;
    bubbleEl.classList.toggle('show-transcript');
}

function getWechatCallDescription(msg) {
    const status = msg.status || '已结束';
    const duration = parseInt(msg.duration, 10);
    const reason = msg.reason || msg.note || '';
    if (status === '已结束' && Number.isFinite(duration) && duration > 0) {
        return reason ? `${status} · ${formatWechatDuration(duration)} · ${reason}` : `${status} · ${formatWechatDuration(duration)}`;
    }
    return reason ? `${status} · ${reason}` : status;
}

function getWechatMessageSummary(msg) {
    if (!msg) return '[消息]';
    if (msg.description) return msg.description;
    if (msg.type === 'voice') {
        const text = msg.transcript ? ` ${msg.transcript}` : '';
        return `[语音 ${formatWechatDuration(msg.duration || 8)}]${text}`;
    }
    if (msg.type === 'transfer') {
        const note = msg.note ? ` ${msg.note}` : '';
        return msg.receipt ? `[已收取转账 ¥${normalizeWechatAmount(msg.amount)}]${note}` : `[转账 ¥${normalizeWechatAmount(msg.amount)}]${note}`;
    }
    if (msg.type === 'redpacket') {
        const title = msg.title || msg.note || '恭喜发财，大吉大利';
        const status = msg.status ? ` ${msg.status}` : '';
        return msg.receipt ? `[已收取红包] ${title}` : `[红包${status}] ${title}`;
    }
    if (msg.type === 'gift') {
        const item = msg.item && typeof msg.item === 'object' ? msg.item : {};
        const name = item.name || msg.title || '礼物';
        const status = msg.status ? ` ${msg.status}` : '';
        return msg.receipt ? `[已收取礼物] ${name}` : `[礼物${status}] ${name}`;
    }
    if (msg.type === 'intimatePay') {
        const status = msg.status ? ` ${msg.status}` : '';
        return `[亲密付${status}] ${msg.note || '邀请开通'}`;
    }
    if (msg.type === 'poke') {
        return `[拍一拍] ${msg.content || msg.note || '拍了拍对方'}`;
    }
    if (msg.type === 'screen_shake') {
        return `[震动屏幕] ${msg.content || msg.note || '发送了一次屏幕震动'}`;
    }
    if (msg.type === 'music_card') {
        const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
        const title = music.title || msg.title || '音乐';
        const artist = music.artist || msg.artist || '';
        return `[音乐卡片] ${title}${artist ? ` - ${artist}` : ''}`;
    }
    if (msg.type === 'link_card') {
        const title = msg.title || msg.url || '链接';
        return `[链接] ${title} ${msg.url || ''}`.trim();
    }
    if (msg.type === 'voiceCall') {
        return `[语音通话] ${getWechatCallDescription(msg)}`;
    }
    if (msg.type === 'videoCall') {
        return `[视频通话] ${getWechatCallDescription(msg)}`;
    }
    if (msg.type === 'share_card') {
        const card = msg.card && typeof msg.card === 'object' ? msg.card : {};
        const title = card.title || msg.title || '转发';
        const text = card.text || msg.text || msg.content || '';
        return `[${title}] ${String(text || '').replace(/<[^>]+>/g, '').slice(0, 80)}`;
    }
    return String(msg.content || '[消息]');
}

function syncWechatMessageDescription(msg) {
    if (!msg) return msg;
    if (msg.type === 'share_card') {
        msg.description = getWechatMessageSummary({ ...msg, description: '' });
        return msg;
    }
    if (isWechatSpecialMessage(msg.type)) {
        msg.description = getWechatMessageSummary({ ...msg, description: '' });
        if (msg.type === 'poke' || msg.type === 'screen_shake' || msg.type === 'music_card' || msg.type === 'link_card') {
            if (!msg.content && msg.note) msg.content = msg.note;
        } else if (!msg.content || msg.type !== 'voice') {
            msg.content = msg.description;
        }
    }
    return msg;
}

function getWechatLinkHost(url) {
    try {
        return new URL(normalizeWechatUrl(url)).hostname.replace(/^www\./i, '');
    } catch (_) {
        return String(url || '').replace(/^https?:\/\//i, '').split('/')[0] || '链接';
    }
}

function buildWechatUserTextMessage(text) {
    const url = extractWechatFirstUrl(text);
    if (!url) return { type: 'text', isMe: true, content: text, timestamp: createMessageTimestamp() };
    const note = String(text || '').replace(url, '').trim();
    return syncWechatMessageDescription({
        type: 'link_card',
        isMe: true,
        url,
        title: note || getWechatLinkHost(url),
        note,
        timestamp: createMessageTimestamp()
    });
}

function triggerWechatScreenFeedback(kind = 'shake') {
    const root = document.getElementById('wechat-chat-room') || document.querySelector('.phone-screen') || document.body;
    if (root) {
        root.classList.remove('wc-screen-shake');
        void root.offsetWidth;
        root.classList.add('wc-screen-shake');
        setTimeout(() => root.classList.remove('wc-screen-shake'), 460);
    }
    if (navigator.vibrate) navigator.vibrate(kind === 'poke' ? [22, 24, 22] : [42, 28, 42, 28, 42]);
}

function openWechatLinkCard(url) {
    const safeUrl = normalizeWechatUrl(url);
    if (!safeUrl) return;
    window.open(safeUrl, '_blank', 'noopener,noreferrer');
}

let wechatMusicCardPlaySeq = 0;

function getWechatMusicAudioPlayer() {
    if (!window._wechatMusicCardAudio) {
        const existing = document.getElementById('wechat-music-card-audio');
        const audio = existing instanceof HTMLAudioElement ? existing : document.createElement('audio');
        audio.id = 'wechat-music-card-audio';
        audio.preload = 'auto';
        audio.removeAttribute('crossorigin');
        audio.playsInline = true;
        audio.muted = false;
        audio.volume = 1;
        audio.style.position = 'fixed';
        audio.style.left = '0';
        audio.style.bottom = '0';
        audio.style.width = '44px';
        audio.style.height = '24px';
        audio.style.opacity = '0.001';
        audio.style.pointerEvents = 'none';
        audio.style.zIndex = '2147483000';
        if (!audio.parentElement) document.body.appendChild(audio);
        audio.addEventListener('ended', () => {
            document.querySelectorAll('.msg-music-card.playing').forEach(card => card.classList.remove('playing'));
        });
        audio.addEventListener('error', () => {
            document.querySelectorAll('.msg-music-card.playing, .msg-music-card.loading').forEach(card => card.classList.remove('playing', 'loading'));
        });
        window._wechatMusicCardAudio = audio;
    }
    window._wechatMusicCardAudio.muted = false;
    window._wechatMusicCardAudio.volume = 1;
    return window._wechatMusicCardAudio;
}

function getWechatMusicAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!window._wechatMusicAudioContext) window._wechatMusicAudioContext = new AudioCtx();
    return window._wechatMusicAudioContext;
}

function stopWechatMusicBufferPlayback() {
    const playback = window._wechatMusicBufferPlayback;
    if (playback?.source) {
        try { playback.source.onended = null; playback.source.stop(0); } catch (e) {}
    }
    window._wechatMusicBufferPlayback = null;
}

function isWechatMusicBufferPlaying(safeUrl) {
    const playback = window._wechatMusicBufferPlayback;
    return !!(playback && playback.safeUrl === safeUrl && playback.source);
}

function isWechatMusicProxyUrl(url) {
    const safeUrl = normalizeWechatUrl(url || '');
    return /[?&]type=url\b/i.test(safeUrl) || /meting/i.test(safeUrl);
}

function isWechatTemporaryMusicCdnUrl(url) {
    const safeUrl = normalizeWechatUrl(url || '');
    return /(^https:\/\/m\d+\.music\.126\.net\/|\.music\.126\.net\/)/i.test(safeUrl)
        || /[?&](vuutv|authSecret|token|expires?)=/i.test(safeUrl);
}

function markWechatMusicCardNeedsTap(card, text = '音源准备好了，再点一次播放') {
    if (!card) return;
    card.classList.remove('loading');
    card.classList.add('needs-tap');
    card.dataset.playHint = text;
}

async function prepareWechatMusicCardPlayableUrl(card) {
    if (!card || card.dataset.playablePreparing === '1') return card?.dataset.audioUrl || '';
    const sourceUrl = normalizeWechatUrl(card.dataset.sourceUrl || card.dataset.audioUrl || '');
    if (!sourceUrl) return '';
    if (!isWechatMusicProxyUrl(sourceUrl)) {
        card.dataset.audioUrl = sourceUrl;
        card.dataset.sourceUrl = sourceUrl;
        card.dataset.playableReady = '1';
        return sourceUrl;
    }
    card.dataset.audioUrl = sourceUrl;
    card.dataset.sourceUrl = sourceUrl;
    card.dataset.playableReady = '1';
    return sourceUrl;
}

function getWechatResolvedMusicCache(url) {
    const cache = window._wechatResolvedMusicUrls || {};
    const item = cache[url];
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (Date.now() - Number(item.time || 0) > 3 * 60 * 1000) return '';
    return item.url || '';
}

function setWechatResolvedMusicCache(url, resolvedUrl) {
    if (!url || !resolvedUrl) return;
    window._wechatResolvedMusicUrls = window._wechatResolvedMusicUrls || {};
    window._wechatResolvedMusicUrls[url] = { url: resolvedUrl, time: Date.now() };
}

async function resolveWechatPlayableMusicUrl(url) {
    const safeUrl = normalizeWechatUrl(String(url || '').replace(/\\u0026/gi, '&'));
    if (!safeUrl) return '';
    const cached = getWechatResolvedMusicCache(safeUrl);
    if (cached) return cached;
    if (!/[?&]type=url\b/i.test(safeUrl) && !/meting/i.test(safeUrl)) {
        setWechatResolvedMusicCache(safeUrl, safeUrl);
        return safeUrl;
    }
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const resp = await fetch(safeUrl, { method: 'HEAD', redirect: 'follow', cache: 'no-store', signal: controller.signal });
        clearTimeout(timer);
        const contentType = resp.headers.get('content-type') || '';
        const finalUrl = normalizeWechatUrl(resp.url || '');
        if (resp.ok && finalUrl && (finalUrl !== safeUrl || /^audio\//i.test(contentType) || /\.(m4a|mp3|flac|aac|ogg)(\?|$)/i.test(finalUrl))) {
            setWechatResolvedMusicCache(safeUrl, finalUrl);
            return finalUrl;
        }
    } catch (e) {}
    setWechatResolvedMusicCache(safeUrl, safeUrl);
    return safeUrl;
}

function updateWechatMusicCardPlayingState(audioUrl, playing, loading = false) {
    document.querySelectorAll('.msg-music-card').forEach(card => {
        const matched = card.dataset.audioUrl === audioUrl;
        card.classList.toggle('playing', !!playing && matched);
        card.classList.toggle('loading', !!loading && matched);
        if (!matched) card.classList.remove('playing', 'loading');
    });
}


function isWechatIncomingMusicInvite(msg) {
    if (!msg || msg.type !== 'music_card' || msg.isMe) return false;
    const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
    return music.invite !== false && msg.musicInvite !== false;
}

function isWechatMusicInviteAccepted(msg) {
    const music = msg && msg.music && typeof msg.music === 'object' ? msg.music : {};
    return !!(music.inviteAccepted || msg.musicInviteAccepted || music.coListening);
}

function getWechatMusicInvitePlayableUrl(msg) {
    const info = getWechatMusicMessageInfo(msg);
    return normalizeWechatUrl(info.audioUrl || info.playableUrl || info.sourceAudioUrl || msg?.url || '');
}

function startWechatMusicCoListenFromMessage(char, msg, options = {}) {
    if (!char || !msg || msg.type !== 'music_card' || typeof window.startMusicCoListenFromWechat !== 'function') return false;
    const info = getWechatMusicMessageInfo(msg);
    const audioUrl = getWechatMusicInvitePlayableUrl(msg);
    if (!audioUrl) return false;
    return !!window.startMusicCoListenFromWechat({
        id: msg.timestamp || `wechat:${info.title}:${audioUrl}`,
        trackName: info.title,
        title: info.title,
        artistName: info.artist,
        artist: info.artist,
        collectionName: '\u5fae\u4fe1\u4e00\u8d77\u542c\u6b4c',
        artworkUrl100: info.artwork,
        artwork: info.artwork,
        audioUrl,
        trackViewUrl: msg.url || '',
        sourceName: info.sourceName || '\u5fae\u4fe1\u97f3\u4e50'
    }, char.id, { autoplay: false, queueAi: !!options.queueAi, reason: options.reason || 'wechat-invite' });
}

async function acceptWechatMusicInvite(msgIndex) {
    const index = Number(msgIndex);
    const char = getCurrentChatChar();
    if (!char || !Array.isArray(char.history) || !Number.isInteger(index)) return;
    const msg = char.history[index];
    if (!msg || msg.type !== 'music_card' || msg.isMe) return;
    msg.music = msg.music && typeof msg.music === 'object' ? msg.music : {};
    msg.music.invite = true;
    msg.music.inviteAccepted = true;
    msg.music.coListening = true;
    msg.music.acceptedAt = Date.now();
    msg.musicInviteAccepted = true;
    syncWechatMessageDescription(msg);
    saveCharactersToStorage();
    refreshChatView(char);
    renderChatList();
    if (typeof showWechatToast === 'function') showWechatToast('\u5df2\u540c\u610f\u4e00\u8d77\u542c\u6b4c');

    let playableUrl = getWechatMusicInvitePlayableUrl(msg);
    if (!playableUrl || msg.music.pendingSearch || msg.music.lookupFailed) {
        await enrichWechatMusicCardMessage(char, msg, { force: true, reason: 'music_invite_accept' });
        playableUrl = getWechatMusicInvitePlayableUrl(msg);
    }
    if (!playableUrl) {
        if (typeof showWechatToast === 'function') showWechatToast('\u8fd9\u9996\u6b4c\u8fd8\u6ca1\u627e\u5230\u53ef\u64ad\u653e\u97f3\u6e90\uff0c\u6362\u4e2a\u5173\u952e\u8bcd\u8bd5\u8bd5');
        refreshChatView(char);
        return;
    }
    startWechatMusicCoListenFromMessage(char, msg, { reason: 'wechat-invite-accepted' });
    const info = getWechatMusicMessageInfo(msg);
    const card = document.querySelector(`.msg-row[data-msg-idx="${index}"] .msg-music-card`);
    await playWechatMusicCard(playableUrl, info.title, info.artist, card);
}
window.acceptWechatMusicInvite = acceptWechatMusicInvite;

function bindWechatMusicCardPlayback(scope) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;
    scope.querySelectorAll('.msg-music-card').forEach(card => {
        if (card.dataset.musicPlaybackBound === '1') return;
        card.dataset.musicPlaybackBound = '1';
        prepareWechatMusicCardPlayableUrl(card).catch(() => {});
        card.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const title = card.dataset.title || card.querySelector('.msg-music-main strong')?.textContent || '一起听歌';
            const artist = card.dataset.artist || card.querySelector('.msg-music-main em')?.textContent || '';
            playWechatMusicCard(card.dataset.audioUrl || '', title, artist, card);
        });
        card.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            const title = card.dataset.title || card.querySelector('.msg-music-main strong')?.textContent || '一起听歌';
            const artist = card.dataset.artist || card.querySelector('.msg-music-main em')?.textContent || '';
            playWechatMusicCard(card.dataset.audioUrl || '', title, artist, card);
        });
    });
}

function playWechatAudioUrl(audio, url, safeUrl) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const startTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const cleanup = () => {
            audio.removeEventListener('playing', onMaybePlaying);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('error', onError);
        };
        const finish = (ok, error) => {
            if (settled) return;
            settled = true;
            cleanup();
            ok ? resolve() : reject(error || audio.error || new Error('audio play failed'));
        };
        const hasAdvanced = () => !audio.paused && !audio.error && Number.isFinite(audio.currentTime) && audio.currentTime > startTime + 0.08;
        const onTimeUpdate = () => {
            if (hasAdvanced()) finish(true);
        };
        const onMaybePlaying = () => setTimeout(() => {
            if (hasAdvanced()) finish(true);
        }, 450);
        const onError = () => finish(false, audio.error || new Error('audio source error'));
        audio.addEventListener('playing', onMaybePlaying, { once: true });
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('error', onError, { once: true });
        audio.dataset.cardUrl = safeUrl;
        audio.muted = false;
        audio.volume = 1;
        if (audio.src !== url) {
            audio.src = url;
            audio.load();
        }
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(() => setTimeout(() => {
                if (hasAdvanced()) finish(true);
            }, 900)).catch(err => finish(false, err));
        }
        setTimeout(() => finish(false, new Error('audio clock stalled')), 2600);
    });
}

async function playWechatAudioBufferUrl(url, safeUrl) {
    const context = getWechatMusicAudioContext();
    if (!context) throw new Error('Web Audio is not supported');
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') throw new Error('Web Audio is suspended');
    const playableUrl = await resolveWechatPlayableMusicUrl(url);
    const resp = await fetch(playableUrl || url, { cache: 'no-store', redirect: 'follow' });
    if (!resp.ok) throw new Error('audio fetch failed');
    const buffer = await context.decodeAudioData(await resp.arrayBuffer());
    stopWechatMusicBufferPlayback();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    window._wechatMusicBufferPlayback = { source, context, safeUrl, startedAt: context.currentTime, duration: buffer.duration };
    source.onended = () => {
        if (window._wechatMusicBufferPlayback?.source === source) {
            window._wechatMusicBufferPlayback = null;
            document.querySelectorAll('.msg-music-card.playing').forEach(card => card.classList.remove('playing'));
        }
    };
    source.start(0);
}

function getWechatMusicMessageInfo(msg) {
    const music = msg && msg.music && typeof msg.music === 'object' ? msg.music : {};
    return {
        title: music.title || msg?.title || '一起听歌',
        artist: music.artist || msg?.artist || '',
        audioUrl: normalizeWechatUrl(music.audioUrl || msg?.audioUrl || music.playableUrl || msg?.playableUrl || music.url || msg?.url || ''),
        playableUrl: normalizeWechatUrl(music.playableUrl || msg?.playableUrl || music.audioUrl || msg?.audioUrl || music.url || msg?.url || ''),
        sourceAudioUrl: normalizeWechatUrl(music.sourceAudioUrl || msg?.sourceAudioUrl || music.audioUrl || msg?.audioUrl || music.url || msg?.url || ''),
        artwork: music.artwork || msg?.artwork || '',
        sourceName: music.sourceName || msg?.sourceName || ''
    };
}

function isWechatMusicMessagePlayable(msg) {
    const info = getWechatMusicMessageInfo(msg);
    return !!(info.audioUrl || info.playableUrl || info.sourceAudioUrl);
}

async function findWechatMusicTrackForCard(title, artist, avoidUrl = '') {
    const searcher = typeof window.searchAcrossMusicSources === 'function' ? window.searchAcrossMusicSources : null;
    if (!searcher || !title) return null;
    try {
        const mode = typeof window.getMusicSourceMode === 'function' ? window.getMusicSourceMode() : 'smart';
        const query = [title, artist].filter(Boolean).join(' ');
        const rows = await searcher(query, mode || 'smart');
        const avoid = normalizeWechatUrl(avoidUrl || '');
        const normalized = (Array.isArray(rows) ? rows : [])
            .map(item => normalizeWechatMusicDraftTrack(item))
            .filter(item => item && item.audioUrl && item.audioUrl !== avoid);
        if (!normalized.length) return null;
        const titleKey = String(title || '').trim().toLowerCase();
        const artistKey = String(artist || '').trim().toLowerCase();
        const exact = normalized.find(item => {
            const itemTitle = String(item.title || '').trim().toLowerCase();
            const itemArtist = String(item.artist || '').trim().toLowerCase();
            return itemTitle === titleKey && (!artistKey || itemArtist.includes(artistKey) || artistKey.includes(itemArtist));
        });
        return exact || normalized[0];
    } catch (e) {
        console.warn('wechat music search failed:', e);
        return null;
    }
}

function applyWechatMusicTrackToMessage(msg, track) {
    if (!msg || !track) return false;
    const normalized = normalizeWechatMusicDraftTrack(track);
    if (!normalized) return false;
    const sourceAudioUrl = normalized.sourceAudioUrl || normalized.audioUrl;
    const selectedCardUrl = isWechatMusicProxyUrl(sourceAudioUrl)
        ? sourceAudioUrl
        : (normalized.playableUrl || normalized.audioUrl);
    const previousMusic = msg.music && typeof msg.music === 'object' ? msg.music : {};
    msg.music = {
        title: normalized.title,
        artist: normalized.artist || '',
        audioUrl: selectedCardUrl,
        playableUrl: normalized.playableUrl || normalized.audioUrl,
        sourceAudioUrl,
        url: normalized.url || '',
        artwork: normalized.artwork || '',
        sourceName: normalized.sourceName || '',
        sourceMeta: normalized.sourceMeta || '',
        invite: !!previousMusic.invite,
        inviteAccepted: !!previousMusic.inviteAccepted,
        acceptedAt: previousMusic.acceptedAt || 0,
        coListening: !!previousMusic.coListening
    };
    msg.title = normalized.title;
    msg.artist = normalized.artist || '';
    msg.audioUrl = selectedCardUrl;
    msg.playableUrl = normalized.playableUrl || normalized.audioUrl;
    msg.sourceAudioUrl = sourceAudioUrl;
    msg.url = normalized.url || '';
    msg.artwork = normalized.artwork || '';
    syncWechatMessageDescription(msg);
    return true;
}

async function enrichWechatMusicCardMessage(char, msg, options = {}) {
    if (!char || !msg || msg.type !== 'music_card') return false;
    msg.music = msg.music && typeof msg.music === 'object' ? msg.music : {};
    if (!options.force && isWechatMusicMessagePlayable(msg) && !msg.music.pendingSearch) return true;
    if (msg.music.resolving) return false;
    const info = getWechatMusicMessageInfo(msg);
    if (!info.title) return false;
    msg.music.resolving = true;
    msg.music.pendingSearch = true;
    syncWechatMessageDescription(msg);
    if (window.currentChatCharId === char.id) refreshChatView(char);
    try {
        const track = await findWechatMusicTrackForCard(info.title, info.artist, info.audioUrl || info.sourceAudioUrl);
        if (track && applyWechatMusicTrackToMessage(msg, track)) {
            msg.music.pendingSearch = false;
            msg.music.resolving = false;
            saveCharactersToStorage();
            if (window.currentChatCharId === char.id) refreshChatView(char);
            renderChatList();
            return true;
        }
        msg.music.pendingSearch = false;
        msg.music.resolving = false;
        msg.music.lookupFailed = true;
        syncWechatMessageDescription(msg);
        saveCharactersToStorage();
        if (window.currentChatCharId === char.id) refreshChatView(char);
        renderChatList();
        return false;
    } catch (e) {
        msg.music.pendingSearch = false;
        msg.music.resolving = false;
        msg.music.lookupFailed = true;
        saveCharactersToStorage();
        console.warn('wechat music enrich failed:', e);
        return false;
    }
}

function scheduleWechatMusicReaction(char, msg) {
    if (!char || !msg || msg.type !== 'music_card' || !msg.isMe || msg.musicReactionRequested) return;
    msg.musicReactionRequested = createMessageTimestamp();
    saveCharactersToStorage();
    setTimeout(() => requestWechatMusicReaction(char.id, msg.timestamp), 650);
}

async function requestWechatMusicReaction(charOrId, msgTimestamp) {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    if (!char || typeof callChatApi !== 'function') return;
    if (window._wechatAiBusy) {
        setTimeout(() => requestWechatMusicReaction(char.id, msgTimestamp), 1500);
        return;
    }
    const musicMsg = (char.history || []).find(item => item && item.type === 'music_card' && item.isMe && item.timestamp === msgTimestamp);
    if (!musicMsg || musicMsg.musicReactionDone) return;
    musicMsg.musicReactionDone = true;
    const info = getWechatMusicMessageInfo(musicMsg);
    const titleEl = document.getElementById('wc-float-name') || document.getElementById('chat-room-title');
    const contentEl = document.getElementById('chat-room-content');
    window._wechatAiBusy = true;
    setWechatBusyState(true);
    if (titleEl && window.currentChatCharId === char.id) titleEl.textContent = '正在听歌...';
    try {
        const messages = typeof buildMessages === 'function'
            ? buildMessages(char, char.history || [], 26)
            : [{ role: 'system', content: `你是${getWechatCharDisplayName(char)}，按人设回复。` }];
        messages.push({
            role: 'system',
            content: `用户刚给你发了一张音乐卡片：《${info.title}》${info.artist ? ` - ${info.artist}` : ''}。你要像真的在微信里一起听歌一样，按你的人设、心情、记忆和最近上下文评价这首歌。喜欢就自然回复；如果你不喜欢、觉得不合气氛，或人设上会想掌控歌单，可以切歌。切歌时先用一条短消息说理由，再单独输出一段 [微信音乐:你想换的歌名|歌手|]，第三栏 URL 可以留空，系统会搜索可播放音源。不要每次都切歌，不要编造不存在的 URL。`
        });
        const result = await callChatApi(messages);
        if (result && result.ok) {
            const parts = splitWechatAiResponseSegments(result.content, char);
            let appended = 0;
            for (let i = 0; i < parts.length; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 260 + Math.random() * 260));
                appended += appendWechatAiMessageParts(char, contentEl, parts[i]) || 0;
            }
            if (appended > 0) showWechatDesktopMessageIsland(char);
            requestWechatAiStatusSnapshot(char, { reason: 'music_reaction' }).catch(e => console.warn('ai status snapshot failed:', e));
            scheduleWechatMemoryExtraction(char, 'music_reaction');
        }
    } catch (e) {
        console.warn('wechat music reaction failed:', e);
    } finally {
        saveCharactersToStorage();
        renderChatList();
        if (window.currentChatCharId === char.id) {
            if (titleEl) titleEl.textContent = getWechatCharDisplayName(char);
            if (contentEl) contentEl.scrollTop = contentEl.scrollHeight;
        }
        setWechatBusyState(false);
        window._wechatAiBusy = false;
    }
}

async function recoverWechatMusicCardUrl(title, artist, currentUrl) {
    const searcher = typeof window.searchAcrossMusicSources === 'function' ? window.searchAcrossMusicSources : null;
    if (!searcher || !title) return '';
    try {
        const mode = typeof window.getMusicSourceMode === 'function' ? window.getMusicSourceMode() : 'smart';
        const rows = await searcher([title, artist].filter(Boolean).join(' '), mode || 'smart');
        const normalizedRows = (Array.isArray(rows) ? rows : [])
            .map(item => normalizeWechatMusicDraftTrack(item))
            .filter(item => item && item.audioUrl && item.audioUrl !== currentUrl);
        const titleKey = String(title || '').trim().toLowerCase();
        const artistKey = String(artist || '').trim().toLowerCase();
        const exact = normalizedRows.find(item => {
            const itemTitle = String(item.title || '').trim().toLowerCase();
            const itemArtist = String(item.artist || '').trim().toLowerCase();
            return itemTitle === titleKey && (!artistKey || itemArtist.includes(artistKey) || artistKey.includes(itemArtist));
        });
        return (exact || normalizedRows[0])?.audioUrl || '';
    } catch (e) {
        return '';
    }
}

async function playWechatMusicCard(audioUrl, title, artist, cardEl = null) {
    const safeUrl = normalizeWechatUrl(String(audioUrl || '').replace(/\\u0026/gi, '&'));
    if (!safeUrl) {
        if (typeof showWechatToast === 'function') showWechatToast('这张音乐卡片没有可播放音频，先搜索选歌再发送');
        return;
    }
    const now = Date.now();
    const lastTap = window._wechatMusicCardLastTap || {};
    if (lastTap.url === safeUrl && now - Number(lastTap.time || 0) < 700) return;
    window._wechatMusicCardLastTap = { url: safeUrl, time: now };
    const sourceUrl = normalizeWechatUrl(cardEl?.dataset?.sourceUrl || safeUrl);
    if (cardEl && isWechatMusicProxyUrl(safeUrl) && cardEl.dataset.playableReady !== '1') {
        prepareWechatMusicCardPlayableUrl(cardEl).then(playable => {
            const nextUrl = normalizeWechatUrl(playable || '');
            if (nextUrl && nextUrl !== safeUrl && !isWechatTemporaryMusicCdnUrl(nextUrl)) {
                cardEl.dataset.audioUrl = nextUrl;
                cardEl.dataset.playableReady = '1';
                cardEl.classList.remove('loading');
            }
        }).catch(() => {});
    }
    const context = getWechatMusicAudioContext();
    if (context?.state === 'suspended') context.resume().catch(() => {});
    const audio = getWechatMusicAudioPlayer();
    if ((audio.dataset.cardUrl === safeUrl && !audio.paused) || isWechatMusicBufferPlaying(safeUrl)) {
        audio.pause();
        stopWechatMusicBufferPlayback();
        updateWechatMusicCardPlayingState(safeUrl, false);
        return;
    }
    stopWechatMusicBufferPlayback();
    const seq = ++wechatMusicCardPlaySeq;
    updateWechatMusicCardPlayingState(safeUrl, false, true);
    const candidates = [];
    const addCandidate = value => {
        const nextUrl = normalizeWechatUrl(value || '');
        if (nextUrl && !candidates.includes(nextUrl)) candidates.push(nextUrl);
    };
    const cached = getWechatResolvedMusicCache(sourceUrl || safeUrl);
    addCandidate(cached);
    addCandidate(safeUrl);
    if (!cardEl && isWechatMusicProxyUrl(safeUrl)) {
        try {
            const resolvedFirst = await resolveWechatPlayableMusicUrl(safeUrl);
            addCandidate(resolvedFirst);
        } catch (e) {}
    }
    let lastError = null;
    let nativeFallbackUrl = candidates.find(Boolean) || safeUrl;
    for (const candidate of candidates) {
        nativeFallbackUrl = candidate || nativeFallbackUrl;
        try {
            await playWechatAudioUrl(audio, candidate, safeUrl);
            if (seq === wechatMusicCardPlaySeq) {
                updateWechatMusicCardPlayingState(safeUrl, true);
            }
            return;
        } catch (e) {
            lastError = e;
        }
        if (!cardEl) {
            try {
                audio.pause();
                await playWechatAudioBufferUrl(candidate, safeUrl);
                if (seq === wechatMusicCardPlaySeq) {
                    updateWechatMusicCardPlayingState(safeUrl, true);
                }
                return;
            } catch (e) {
                lastError = e;
            }
        }
    }
    const resolved = await resolveWechatPlayableMusicUrl(safeUrl);
    if (resolved && !candidates.includes(resolved)) {
        nativeFallbackUrl = resolved;
        try {
            await playWechatAudioUrl(audio, resolved, safeUrl);
            if (seq === wechatMusicCardPlaySeq) updateWechatMusicCardPlayingState(safeUrl, true);
            return;
        } catch (e) {
            lastError = e;
        }
        try {
            audio.pause();
            await playWechatAudioBufferUrl(resolved, safeUrl);
            if (seq === wechatMusicCardPlaySeq) updateWechatMusicCardPlayingState(safeUrl, true);
            return;
        } catch (e) {
            lastError = e;
        }
    }
    const recovered = await recoverWechatMusicCardUrl(title, artist, safeUrl);
    if (recovered) {
        const nextUrl = normalizeWechatUrl(recovered);
        nativeFallbackUrl = nextUrl || nativeFallbackUrl;
        if (cardEl && nextUrl) cardEl.dataset.audioUrl = nextUrl;
        try {
            await playWechatAudioUrl(audio, nextUrl, nextUrl);
            if (seq === wechatMusicCardPlaySeq) updateWechatMusicCardPlayingState(nextUrl, true);
            return;
        } catch (e) {
            lastError = e;
        }
        try {
            audio.pause();
            await playWechatAudioBufferUrl(nextUrl, nextUrl);
            if (seq === wechatMusicCardPlaySeq) updateWechatMusicCardPlayingState(nextUrl, true);
            return;
        } catch (e) {
            lastError = e;
        }
    }
    window._wechatMusicLastError = {
        name: lastError?.name || '',
        message: lastError?.message || String(lastError || ''),
        url: safeUrl,
        time: Date.now()
    };
    updateWechatMusicCardPlayingState(safeUrl, false);
    const errorName = lastError?.name || '';
    if (typeof showWechatToast === 'function') {
        showWechatToast(errorName === 'NotAllowedError' ? '浏览器拦截了播放，请再点一次音乐卡片' : '播放失败，换一首或换一个音乐源试试');
    }
}

function normalizeWechatMusicDraftTrack(track) {
    if (!track || typeof track !== 'object') return null;
    const title = track.trackName || track.title || track.name || '';
    if (!title) return null;
    const audioUrl = normalizeWechatUrl(track.audioUrl || track.musicUrl || track.playUrl || track.src || '');
    const sourceAudioUrl = normalizeWechatUrl(track.sourceAudioUrl || track.sourceUrl || audioUrl);
    return {
        title,
        artist: track.artistName || track.artist || track.singer || '',
        audioUrl,
        playableUrl: normalizeWechatUrl(track.playableUrl || track.resolvedAudioUrl || audioUrl),
        sourceAudioUrl,
        url: normalizeWechatUrl(track.trackViewUrl || track.pageUrl || track.shareUrl || ''),
        artwork: track.artworkUrl100 || track.artwork || track.cover || track.pic || '',
        sourceName: track.sourceName || track.collectionName || '',
        sourceMeta: track.sourceMeta || '',
        raw: track
    };
}

function getWechatMusicCardDraft() {
    const track = typeof window.getCurrentMusicTrack === 'function' ? window.getCurrentMusicTrack() : null;
    const normalized = normalizeWechatMusicDraftTrack(track);
    if (normalized) return normalized;
    const inputValue = document.getElementById('music-search-input')?.value || '';
    return {
        title: inputValue.trim() || '一起听歌',
        artist: '',
        url: '',
        artwork: ''
    };
}

function getWechatMusicComposeOptions(existingMsg = null) {
    const options = [];
    const add = track => {
        const normalized = normalizeWechatMusicDraftTrack(track);
        if (!normalized) return;
        const key = `${normalized.title}|${normalized.artist}|${normalized.url}`.toLowerCase();
        if (options.some(item => item.key === key)) return;
        options.push({ ...normalized, key });
    };
    if (existingMsg) add(existingMsg.music || existingMsg);
    add(getWechatMusicCardDraft());
    try {
        const favorites = typeof getMusicFavoritesStore === 'function'
            ? getMusicFavoritesStore()
            : JSON.parse(localStorage.getItem('bynd_music_favorites_v1') || '[]');
        (Array.isArray(favorites) ? favorites : []).slice(0, 24).forEach(add);
    } catch (e) {}
    return options.length ? options : [getWechatMusicCardDraft()];
}

function renderWechatMusicComposeResults() {
    const list = document.getElementById('wc-compose-music-results');
    const status = document.getElementById('wc-compose-music-status');
    if (!list) return;
    const results = Array.isArray(window._wechatMusicComposeResults) ? window._wechatMusicComposeResults : [];
    const selected = window._wechatMusicComposeSelected || null;
    if (status) status.textContent = selected?.resolving ? '正在解析可播放地址...' : (selected?.audioUrl ? '已选择：' + selected.title : (results.length ? '请选择一首可播放音乐' : '搜索后选择一首歌再发送'));
    list.innerHTML = results.length ? results.map((track, index) => {
        const active = selected && selected.audioUrl === track.audioUrl && selected.title === track.title;
        return `
            <button type="button" class="wc-music-result-item ${active ? 'active' : ''}" onclick="selectWechatMusicComposeTrack(${index})">
                <div class="wc-music-result-cover">${track.artwork ? `<img src="${wcEscapeHtml(track.artwork)}" onerror="this.remove()">` : '<i class="ri-music-2-line"></i>'}</div>
                <div>
                    <strong>${wcEscapeHtml(track.title)}</strong>
                    <span>${wcEscapeHtml([track.artist, track.sourceName].filter(Boolean).join(' · ') || '音乐源')}</span>
                </div>
                <i class="${active ? 'ri-checkbox-circle-fill' : 'ri-play-circle-line'}"></i>
            </button>
        `;
    }).join('') : '<div class="wc-music-result-empty">输入歌名或歌手，点搜索。</div>';
}

async function selectWechatMusicComposeTrack(index) {
    const results = Array.isArray(window._wechatMusicComposeResults) ? window._wechatMusicComposeResults : [];
    const track = results[index];
    if (!track || !track.audioUrl) {
        if (typeof showWechatToast === 'function') showWechatToast('这首没有可播放音频，换一个结果');
        return;
    }
    window._wechatMusicComposeSelected = { ...track, resolving: true };
    renderWechatMusicComposeResults();
    const sourceAudioUrl = track.sourceAudioUrl || track.audioUrl;
    let playableUrl = track.playableUrl || '';
    try {
        playableUrl = await resolveWechatPlayableMusicUrl(sourceAudioUrl);
    } catch (e) {
        playableUrl = track.audioUrl;
    }
    const primaryAudioUrl = isWechatMusicProxyUrl(sourceAudioUrl) ? sourceAudioUrl : (playableUrl || track.audioUrl);
    const nextTrack = { ...track, sourceAudioUrl, playableUrl: playableUrl || track.audioUrl, audioUrl: primaryAudioUrl, resolving: false };
    window._wechatMusicComposeResults[index] = nextTrack;
    window._wechatMusicComposeSelected = nextTrack;
    renderWechatMusicComposeResults();
}
window.selectWechatMusicComposeTrack = selectWechatMusicComposeTrack;

async function searchWechatMusicForComposer() {
    const input = document.getElementById('wc-compose-music-query');
    const status = document.getElementById('wc-compose-music-status');
    const query = String(input?.value || '').trim();
    if (!query) {
        if (typeof showWechatToast === 'function') showWechatToast('先输入歌名或歌手');
        return;
    }
    if (status) status.textContent = '正在搜索音乐...';
    window._wechatMusicComposeSelected = null;
    try {
        const mode = typeof window.getMusicSourceMode === 'function' ? window.getMusicSourceMode() : 'smart';
        const searcher = typeof window.searchAcrossMusicSources === 'function' ? window.searchAcrossMusicSources : null;
        let tracks = searcher ? await searcher(query, mode || 'smart') : [];
        tracks = (Array.isArray(tracks) ? tracks : []).map(normalizeWechatMusicDraftTrack).filter(item => item && item.audioUrl);
        window._wechatMusicComposeResults = tracks.slice(0, 18);
        if (status) status.textContent = tracks.length ? '搜索完成，选择一首后发送' : '没有搜到可播放音频，换关键词试试';
    } catch (e) {
        window._wechatMusicComposeResults = [];
        if (status) status.textContent = '搜索失败，换关键词或音乐源再试';
    }
    renderWechatMusicComposeResults();
}
window.searchWechatMusicForComposer = searchWechatMusicForComposer;

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

window._wechatReplyDraft = null;

function updateWechatReplyPreview() {
    const preview = document.getElementById('wc-reply-preview');
    if (!preview) return;
    const draft = window._wechatReplyDraft;
    if (!draft || !draft.text) {
        preview.classList.add('hidden');
        preview.innerHTML = '';
        return;
    }
    preview.classList.remove('hidden');
    preview.innerHTML = `
        <div class="wc-reply-preview-main">
            <i class="ri-reply-line"></i>
            <div>
                <strong>引用 ${wcEscapeHtml(draft.sender || '消息')}</strong>
                <span>${wcEscapeHtml(draft.text)}</span>
            </div>
        </div>
        <button type="button" onclick="clearWechatReplyDraft()" aria-label="取消引用"><i class="ri-close-line"></i></button>
    `;
}

function clearWechatReplyDraft() {
    window._wechatReplyDraft = null;
    updateWechatReplyPreview();
}

function quoteWechatMessage(msgIdx) {
    closeMsgActionMenu();
    const char = getCurrentChatChar();
    if (!char || !Array.isArray(char.history) || msgIdx < 0 || msgIdx >= char.history.length) return;
    const snapshot = buildWechatReplySnapshot(char.history[msgIdx], char, msgIdx);
    if (!snapshot) return;
    window._wechatReplyDraft = snapshot;
    updateWechatReplyPreview();
    document.getElementById('wc-msg-input')?.focus();
}

function splitWechatDirectiveArgs(raw) {
    return String(raw || '').split('|').map(part => part.trim());
}

function buildWechatMessageFromAiDirective(command, rawArgs, char) {
    const args = splitWechatDirectiveArgs(rawArgs);
    const base = { isMe: false, timestamp: createMessageTimestamp() };

    if (command === '旁白' || command === '微信旁白') {
        const content = args.join('|').trim();
        if (!content) return null;
        return {
            ...base,
            type: 'text',
            content: looksLikeWechatRichOrRegexSource(content, char)
                ? content
                : normalizeWechatOfflineNarrationText(content)
        };
    }

    if (command === '微信引用') {
        const target = findWechatMessageForAiQuote(char, args[0] || '');
        const content = args.slice(1).join('|').trim();
        if (!target || !content) return null;
        return {
            ...base,
            type: 'text',
            content,
            replyTo: buildWechatReplySnapshot(target.msg, char, target.index)
        };
    }

    if (command === '微信记忆') {
        const content = args.join('|').trim();
        if (content) addWechatAutoMemory(char, content, '角色主动记忆');
        return null;
    }

    if (command === '微信改用户备注') {
        return applyWechatUserTitleDirective(rawArgs, char);
    }

    if (command === '微信拉黑') {
        return applyWechatCharBlacklistDirective(rawArgs, char);
    }

    if (command === '微信转账') {
        if (parseWechatAmountNumber(args[0]) == null) return null;
        return syncWechatMessageDescription({
            ...base,
            type: 'transfer',
            amount: normalizeWechatAmount(args[0]),
            note: args.slice(1).join('|').trim()
        });
    }

    if (command === '微信红包') {
        const msg = {
            ...base,
            type: 'redpacket',
            title: args[0] || '恭喜发财，大吉大利',
            status: args[2] || '待领取'
        };
        if (parseWechatAmountNumber(args[1]) != null) msg.amount = normalizeWechatAmount(args[1]);
        return syncWechatMessageDescription(msg);
    }

    if (command === '微信礼物' || command === '微信送礼物') {
        const title = args[0] || '一份礼物';
        const price = parseWechatAmountNumber(args[1]);
        const image = args[2] || '';
        const note = args.slice(3).join('|').trim();
        return syncWechatMessageDescription({
            ...base,
            type: 'gift',
            status: '待收取',
            item: {
                name: title,
                price: price == null ? '' : price.toFixed(2),
                image,
                description: note
            },
            note
        });
    }

    if (command === '微信亲密付') {
        const limit = parseWechatAmountNumber(args[0]);
        const note = args.slice(1).join('|').trim();
        return syncWechatMessageDescription({
            ...base,
            type: 'intimatePay',
            status: '待开通',
            amount: limit == null ? '' : limit.toFixed(2),
            note: note || '邀请你开通亲密付'
        });
    }

    if (command === '微信拍一拍' || command === '拍一拍') {
        const content = args.join('|').trim() || '拍了拍你';
        return syncWechatMessageDescription({
            ...base,
            type: 'poke',
            content,
            note: content
        });
    }

    if (command === '微信震动' || command === '震动屏幕') {
        const content = args.join('|').trim() || '发来一次屏幕震动';
        return syncWechatMessageDescription({
            ...base,
            type: 'screen_shake',
            content,
            note: content
        });
    }

    if (command === '\u5fae\u4fe1\u97f3\u4e50' || command === '\u97f3\u4e50\u5361\u7247') {
        const title = args[0] || '\u4e00\u8d77\u542c\u6b4c';
        const artist = args[1] || '';
        const url = normalizeWechatUrl(args[2] || '');
        return syncWechatMessageDescription({
            ...base,
            type: 'music_card',
            music: {
                title,
                artist,
                url,
                audioUrl: url,
                playableUrl: url,
                sourceAudioUrl: url,
                pendingSearch: !url,
                invite: !base.isMe,
                inviteAccepted: !!base.isMe,
                coListening: false
            },
            musicInvite: !base.isMe,
            musicInviteAccepted: !!base.isMe,
            title,
            artist,
            url,
            audioUrl: url,
            playableUrl: url,
            sourceAudioUrl: url
        });
    }

    if (command === '微信链接' || command === '链接卡片') {
        const url = normalizeWechatUrl(args[0] || '');
        if (!url) return null;
        const title = args[1] || url.replace(/^https?:\/\//i, '').slice(0, 42);
        const note = args.slice(2).join('|').trim();
        return syncWechatMessageDescription({
            ...base,
            type: 'link_card',
            url,
            title,
            note
        });
    }

    if (command === '微信语音') {
        const firstArgIsDuration = args.length > 1 && isWechatDurationArg(args[0]);
        const transcript = firstArgIsDuration ? args.slice(1).join('|').trim() : args.join('|').trim();
        const explicitDuration = firstArgIsDuration ? normalizeWechatDuration(args[0], 0) : 0;
        const duration = explicitDuration > 0 ? explicitDuration : estimateWechatVoiceDuration(transcript);
        return syncWechatMessageDescription({
            ...base,
            type: 'voice',
            duration,
            transcript,
            content: transcript || `[语音 ${formatWechatDuration(duration)}]`
        });
    }

    if (command === '微信表情') {
        const query = args[0] || '';
        const sticker = findWechatStickerForAi(char, query, args.slice(1).join('|').trim());
        if (!sticker || !sticker.url) return null;
        const isEmoji = sticker.emoji || sticker.source === 'wechatEmoji' || sticker.source === 'qqEmoji' || isWechatBuiltinEmojiUrl(sticker.url);
        return {
            ...base,
            type: 'sticker',
            content: sticker.url,
            stickerName: sticker.name || query || '贴纸',
            stickerKind: isEmoji ? 'wechatEmoji' : 'sticker',
            emoji: !!isEmoji
        };
    }

    if (command === '微信语音电话' || command === '微信视频电话') {
        return syncWechatMessageDescription({
            ...base,
            type: command === '微信视频电话' ? 'videoCall' : 'voiceCall',
            status: '来电',
            reason: args.join('|').trim(),
            duration: 0
        });
    }

    return null;
}

function getWechatChatPresenceMode(char) {
    const mode = char && char.chatConfig && char.chatConfig.chatPresenceMode;
    return ['online', 'offline'].includes(mode) ? mode : 'auto';
}

function looksLikeWechatRegexPayloadSource(text) {
    const source = String(text || '');
    return /\|\^&\^|\^&\^|!\^!\^|【REGEX】|<regex\b/i.test(source);
}

function willWechatRegexRenderRich(text, char) {
    const source = String(text || '');
    if (!source) return false;
    const scripts = [
        ...(window.globalRegexScripts || []),
        ...((char && Array.isArray(char.regex)) ? char.regex : [])
    ].filter(isWechatRegexScriptEnabled);
    return scripts.some(script => {
        try {
            const regexStr = getWechatRegexScriptField(script, ['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']);
            const replaceStr = getWechatRegexScriptField(script, ['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']);
            if (!regexStr) return false;
            let pattern = fillWechatRegexTemplate(regexStr, char);
            let flags = 'g';
            if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
                const lastSlash = pattern.lastIndexOf('/');
                flags = pattern.substring(lastSlash + 1).replace(/[^gimsuy]/g, '') || 'g';
                pattern = pattern.substring(1, lastSlash);
            }
            const re = new RegExp(pattern, flags);
            return re.test(source) && (isRichMessageContent(replaceStr) || looksLikeWechatRegexPayloadSource(source));
        } catch (_) {
            return false;
        }
    });
}

function looksLikeWechatRichOrRegexSource(text, char) {
    return /```[\s\S]*?```/.test(text)
        || /<\s*\/?\s*[A-Za-z][\w:-]*\b[^>]*>/.test(text)
        || isRichMessageContent(text)
        || looksLikeWechatRegexPayloadSource(text)
        || willWechatRegexRenderRich(text, char);
}

function hasWechatAiDirectiveSource(text) {
    return /\[(?:微信转账|微信红包|微信礼物|微信送礼物|微信亲密付|微信表情|微信语音电话|微信视频电话|微信语音|微信引用|微信记忆|微信改用户备注|微信改备注|微信拉黑|微信监控|开启监控|关闭监控|微信拍一拍|拍一拍|微信震动|震动屏幕|微信音乐|音乐卡片|微信链接|链接卡片|微信朋友圈|微信删除联系人|微信旁白|旁白)[：:\]]/.test(String(text || ''));
}

function createWechatAiDirectiveRegex() {
    return /\[(微信转账|微信红包|微信礼物|微信送礼物|微信亲密付|微信表情|微信语音电话|微信视频电话|微信语音|微信引用|微信记忆|微信改用户备注|微信改备注|微信拉黑|微信监控|开启监控|关闭监控|微信拍一拍|拍一拍|微信震动|震动屏幕|微信音乐|音乐卡片|微信链接|链接卡片|微信朋友圈|微信删除联系人|微信旁白|旁白)[：:]([^\]]*)\]|\[(微信旁白|旁白)\]/g;
}

function hasWechatUnclosedDirectiveTail(text) {
    return /\[(?:微信转账|微信红包|微信礼物|微信送礼物|微信亲密付|微信表情|微信语音电话|微信视频电话|微信语音|微信引用|微信记忆|微信改用户备注|微信改备注|微信拉黑|微信监控|开启监控|关闭监控|微信拍一拍|拍一拍|微信震动|震动屏幕|微信音乐|音乐卡片|微信链接|链接卡片|微信朋友圈|微信删除联系人|微信旁白|旁白)[：:][^\]]*$/i.test(String(text || '').trim());
}

function isWechatStandaloneRichOrRegexSource(text, char) {
    const source = cleanWechatVisibleContent(text);
    if (!source || !looksLikeWechatRichOrRegexSource(source, char)) return false;
    if (/^```[\s\S]*?```\s*$/.test(source)) return true;
    if (/^<\s*([A-Za-z][\w:-]*)\b[\s\S]*<\/\s*\1\s*>\s*$/.test(source)) return true;
    if (/^<\s*(?:html|div|section|article|style|script|table|svg|canvas)\b[\s\S]*$/i.test(source)) return true;
    if (looksLikeWechatRegexPayloadSource(source) && !/[。！？!?]\s*\S{2,}/.test(source.replace(/\|\^&\^|\^&\^|!\^!\^|【REGEX】/g, ''))) return true;
    return willWechatRegexRenderRich(source, char) && !/\n{2,}/.test(source);
}

function addWechatMixedRange(ranges, start, end) {
    if (start == null || end == null || end <= start) return;
    ranges.push({ start, end });
}

function getWechatRichCandidateRanges(source) {
    const text = String(source || '');
    const ranges = [];
    const collect = re => {
        let match;
        while ((match = re.exec(text)) !== null) {
            addWechatMixedRange(ranges, match.index, re.lastIndex);
        }
    };
    collect(/```(?:html|xml|markdown)?\s*[\s\S]*?```/gi);
    collect(/<\s*(jwy|status|state)\b[^>]*>[\s\S]*?<\/\s*\1\s*>(?:\s*(?:\r?\n)+\s*[^<\n]{1,220}\|[^\n]*){0,6}/gi);
    collect(/<\s*html\b[\s\S]*?<\/\s*html\s*>/gi);
    collect(/<\s*([A-Za-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi);

    let lineStart = 0;
    text.split(/\r?\n/).forEach(line => {
        const lineEnd = lineStart + line.length;
        if (looksLikeWechatRegexPayloadSource(line)) addWechatMixedRange(ranges, lineStart, lineEnd);
        lineStart = lineEnd + 1;
    });

    return ranges
        .sort((a, b) => a.start - b.start || b.end - a.end)
        .reduce((merged, range) => {
            const last = merged[merged.length - 1];
            if (!last || range.start > last.end) {
                merged.push({ ...range });
            } else if (range.end > last.end) {
                last.end = range.end;
            }
            return merged;
        }, []);
}

function appendWechatExpandedTextParts(target, content, char) {
    const source = cleanWechatVisibleContent(content);
    if (!source) return;
    const ranges = getWechatRichCandidateRanges(source);
    if (!ranges.length) {
        target.push(...splitWechatOfflinePlainText(source, char));
        return;
    }
    let cursor = 0;
    ranges.forEach(range => {
        const before = source.slice(cursor, range.start).trim();
        if (before) target.push(...splitWechatOfflinePlainText(before, char));
        const rich = source.slice(range.start, range.end).trim();
        if (rich) target.push({ kind: 'text', content: rich });
        cursor = range.end;
    });
    const after = source.slice(cursor).trim();
    if (after) target.push(...splitWechatOfflinePlainText(after, char));
}

function parseWechatLegacyCallSummaryMessage(text) {
    const source = cleanWechatVisibleContent(text);
    const match = source.match(/^\s*\[(语音通话|视频通话)\]\s*([^\n]*)$/);
    if (!match) return null;
    const chunks = match[2].split('·').map(item => item.trim()).filter(Boolean);
    const status = chunks[0] || '已结束';
    let duration = 0;
    const reasonParts = [];
    chunks.slice(1).forEach(chunk => {
        if (!duration && /(?:\d+\s*(?:秒|分钟|分|s)|\d+:\d+)/i.test(chunk)) {
            duration = normalizeWechatDuration(chunk, 0);
        } else {
            reasonParts.push(chunk);
        }
    });
    return syncWechatMessageDescription({
        type: match[1] === '视频通话' ? 'videoCall' : 'voiceCall',
        isMe: false,
        status,
        duration,
        reason: reasonParts.join(' · '),
        timestamp: createMessageTimestamp()
    });
}

function appendWechatPlainAiTextParts(target, content, char) {
    const source = cleanWechatVisibleContent(content);
    if (!source) return;
    const legacyMsg = parseWechatLegacyCallSummaryMessage(source);
    if (legacyMsg) {
        target.push({ kind: 'special', msg: legacyMsg });
        return;
    }
    appendWechatExpandedTextParts(target, source, char);
}

function hasWechatRichTag(text) {
    return /<\s*\/?\s*[A-Za-z][\w:-]*\b[^>]*>/.test(String(text || ''));
}

function isWechatRichFragmentComplete(text) {
    const source = String(text || '');
    if (!hasWechatRichTag(source)) return true;
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    const stack = [];
    source.replace(/<\s*(\/?)([A-Za-z][\w:-]*)\b[^>]*?>/g, (full, slash, rawName) => {
        const name = String(rawName || '').toLowerCase();
        if (!name || voidTags.has(name) || /\/\s*>$/.test(full)) return full;
        if (slash) {
            const idx = stack.lastIndexOf(name);
            if (idx >= 0) stack.splice(idx, 1);
        } else {
            stack.push(name);
        }
        return full;
    });
    return stack.length === 0;
}

function normalizeWechatMergedRichContent(parts) {
    const raw = parts.map(item => String(item || '').trim()).filter(Boolean).join('\n');
    return cleanWechatVisibleContent(raw)
        .replace(/^[\s|｜，,。.;；:：、]+(?=<\s*[A-Za-z][\w:-]*\b)/, '')
        .trim();
}

function pushWechatSplitTextPart(target, kind, content) {
    const text = kind === 'narration'
        ? normalizeWechatOfflineNarrationText(content)
        : cleanWechatVisibleContent(content);
    if (!text) return;
    target.push({ kind: 'text', content: text });
}

function normalizeWechatOfflineNarrationText(value) {
    const normalized = cleanWechatVisibleContent(value)
        .replace(/^\s*\[(?:微信旁白|旁白)\]\s*/i, '')
        .replace(/^\s*(?:微信旁白|旁白)\s*[：:]\s*/i, '')
        .replace(/^[\s，,。.;；:：、]+/, '')
        .trim();
    return stripWechatUserAgencyFromNarration(normalized);
}

function isWechatUserAgencySentence(text) {
    const source = String(text || '').trim();
    if (!source) return false;
    return /(?:^|[。！？!?；;\s])你(?:只来得及|来得及|下意识|本能地|不由|忍不住|意识到|发现|觉得|想起|想要|试图|刚想|终于|已经|还没|伸手|抬手|握住|抓住|拽住|推开|躲开|退开|靠近|站起|坐下|走近|跑开|开口|说|喊|叫|发出|回答|回复|沉默|呼吸|喘|心跳|视野|眼前|脑海|身体|指尖|手腕|肩膀|腰|腿|脚)/.test(source)
        || /(?:你的|你那|你自己|你整个人|你身体|你视野|你意识|你脑海|你心里|你下意识|你本能地)(?:[^。！？!?；;]{0,18})(?:想|觉得|意识到|发现|伸手|开口|说|喊|动|退|躲|靠|抓|握|呼吸|心跳|发软|僵住|颤|愣)/.test(source);
}

function stripWechatUserAgencyFromNarration(value) {
    const source = String(value || '').trim();
    if (!source) return '';
    const sentences = source.match(/[^。！？!?；;]+[。！？!?；;]?|[\s\S]+$/g) || [source];
    const kept = sentences
        .map(item => item.trim())
        .filter(item => item && !isWechatUserAgencySentence(item));
    return kept.join('').trim();
}

function buildWechatOfflineNarrationPart(content) {
    const text = normalizeWechatOfflineNarrationText(content);
    if (!text) return null;
    return { kind: 'text', content: text };
}

function buildWechatHistoryMessageFromParsedPart(part, baseMsg, char) {
    if (!part) return null;
    const timestamp = baseMsg && baseMsg.timestamp ? baseMsg.timestamp : createMessageTimestamp();
    const base = { timestamp };
    if (baseMsg && baseMsg.replyTo) base.replyTo = baseMsg.replyTo;
    if (part.kind === 'special') {
        const msg = part.msg ? { ...part.msg } : null;
        if (!msg) return null;
        if (baseMsg && baseMsg.timestamp) msg.timestamp = timestamp;
        else if (!msg.timestamp) msg.timestamp = timestamp;
        return syncWechatMessageDescription(msg);
    }
    const content = cleanWechatVisibleContent(part.content || '');
    if (!content) return null;
    const stickerMsg = buildWechatStickerDirectiveMessageFromText(content, char);
    if (stickerMsg && stickerMsg.content) {
        return {
            ...stickerMsg,
            timestamp: stickerMsg.timestamp || timestamp
        };
    }
    return {
        ...base,
        type: 'text',
        isMe: false,
        content,
        description: ''
    };
}

function shouldMigrateWechatMixedAiHistoryMessage(msg) {
    if (!msg || msg.isMe || msg.type === 'system_notice') return false;
    const type = msg.type || 'text';
    if (!['text', 'offline_narration'].includes(type)) return false;
    const raw = cleanWechatVisibleContent(msg.content || msg.description || '');
    if (!raw) return false;
    if (hasWechatUnclosedDirectiveTail(raw)) return true;
    if (/^\s*\]/.test(raw)) return true;
    if (/\[(?:语音通话|视频通话)\]/.test(raw)) return true;
    if (/\[(?:微信旁白|旁白)\]/.test(raw)) return true;
    if (/\[(?:微信监控|开启监控|关闭监控|微信改备注|微信改用户备注|微信表情|微信语音|微信转账|微信红包|微信礼物|微信亲密付|微信拍一拍|拍一拍|微信震动|震动屏幕|微信音乐|音乐卡片|微信链接|链接卡片|微信朋友圈|微信删除联系人)[：:]/.test(raw)) return true;
    return type === 'offline_narration' && looksLikeWechatRichOrRegexSource(raw, null);
}

function migrateWechatMixedAiHistory(char) {
    if (!char || !Array.isArray(char.history)) return false;
    let changed = false;
    const nextHistory = [];
    let pending = null;

    const flushPending = () => {
        if (!pending) return;
        const combined = pending.parts.join('\n').trim();
        const parsedParts = parseWechatAiMessageParts(combined, char);
        if (parsedParts.length) {
            parsedParts.forEach(part => {
                const msg = buildWechatHistoryMessageFromParsedPart(part, pending.base, char);
                if (msg) nextHistory.push(msg);
            });
        } else {
            nextHistory.push({ ...pending.base, content: combined });
        }
        pending = null;
        changed = true;
    };

    char.history.forEach(msg => {
        if (!msg) return;

        if (pending) {
            if (!msg.isMe && (msg.type || 'text') === 'text' && /^\s*\]/.test(cleanWechatVisibleContent(msg.content || msg.description || ''))) {
                const raw = cleanWechatVisibleContent(msg.content || msg.description || '');
                pending.parts.push(raw.replace(/^\s*\]\s*/, ']'));
                flushPending();
                return;
            }
            flushPending();
        }

        if (!shouldMigrateWechatMixedAiHistoryMessage(msg)) {
            nextHistory.push(msg);
            return;
        }

        const raw = cleanWechatVisibleContent(msg.content || msg.description || '');
        if (hasWechatUnclosedDirectiveTail(raw)) {
            pending = { base: { ...msg, type: 'text', isMe: false, description: '' }, parts: [raw] };
            changed = true;
            return;
        }

        const parsedParts = parseWechatAiMessageParts(raw, char);
        const nextMsgs = parsedParts
            .map(part => buildWechatHistoryMessageFromParsedPart(part, msg, char))
            .filter(Boolean);
        if (!nextMsgs.length) {
            nextHistory.push(msg);
            return;
        }

        if (nextMsgs.length !== 1
            || nextMsgs[0].type !== msg.type
            || cleanWechatVisibleContent(nextMsgs[0].content || nextMsgs[0].description || '') !== raw) {
            changed = true;
        }
        nextHistory.push(...nextMsgs);
    });

    flushPending();
    if (changed) char.history = nextHistory;
    return changed;
}

function migrateWechatNarrationHistory(char) {
    if (!char || !Array.isArray(char.history)) return false;
    let changed = false;
    const nextHistory = [];
    let richBuffer = null;
    const flushRichBuffer = () => {
        if (!richBuffer) return;
        const content = normalizeWechatMergedRichContent(richBuffer.parts);
        if (content) {
            nextHistory.push({
                ...richBuffer.base,
                type: 'text',
                isMe: false,
                content,
                description: ''
            });
        }
        richBuffer = null;
        changed = true;
    };
    char.history.forEach(msg => {
        if (!msg) return;
        if (richBuffer) {
            if (!msg.isMe && ['offline_narration', 'text'].includes(msg.type || 'text')) {
                const piece = msg.content || msg.description || '';
                if (hasWechatRichTag(piece) || /^\s*[^<\n]{1,220}\|[^\n]*/.test(String(piece))) {
                    richBuffer.parts.push(piece);
                    if (isWechatRichFragmentComplete(richBuffer.parts.join('\n'))) flushRichBuffer();
                    return;
                }
            }
            flushRichBuffer();
        }
        if (msg.type === 'offline_narration') {
            const rawNarration = String(msg.content || msg.description || '');
            if (hasWechatRichTag(rawNarration)) {
                richBuffer = {
                    base: {
                        ...msg,
                        type: 'text',
                        description: ''
                    },
                    parts: [rawNarration]
                };
                if (isWechatRichFragmentComplete(rawNarration)) flushRichBuffer();
                changed = true;
                return;
            }
            const normalized = normalizeWechatOfflineNarrationText(rawNarration);
            if (!normalized) {
                changed = true;
                return;
            }
            nextHistory.push({
                ...msg,
                type: 'text',
                isMe: false,
                content: normalized,
                description: ''
            });
            changed = true;
            return;
        }
        if (!msg.isMe && (msg.type || 'text') === 'text') {
            const raw = cleanWechatVisibleContent(msg.content || '');
            if (/^\s*\[(?:微信旁白|旁白)\]\s*$/i.test(raw)) {
                changed = true;
                return;
            }
            if (/^\s*(?:\[(?:微信旁白|旁白)\]|(?:微信旁白|旁白)\s*[：:])/.test(raw)) {
                const normalized = normalizeWechatOfflineNarrationText(raw);
                if (!normalized) {
                    changed = true;
                    return;
                }
                msg.content = normalized;
                delete msg.description;
                changed = true;
            }
        }
        nextHistory.push(msg);
    });
    flushRichBuffer();
    if (changed) char.history = nextHistory;
    return changed;
}

function splitWechatSentenceChunks(text, maxLength = 92) {
    const source = cleanWechatVisibleContent(text);
    if (!source) return [];
    const sentences = source.match(/[^。！？!?；;]+[。！？!?；;]?|[\s\S]+$/g) || [source];
    const chunks = [];
    let current = '';
    sentences.forEach(sentence => {
        const next = sentence.trim();
        if (!next) return;
        if ((current + next).length > maxLength && current) {
            chunks.push(current.trim());
            current = next;
        } else {
            current += next;
        }
    });
    if (current.trim()) chunks.push(current.trim());
    return chunks.length ? chunks : [source];
}

function isWechatOfflineNarrationSentence(text) {
    const source = String(text || '').trim();
    if (!source) return false;
    if (/^[*（(【\[]/.test(source) || /[*）)】\]]$/.test(source)) return true;
    if (/^(旁白|动作|场景|镜头|环境)[：:]/.test(source)) return true;
    if (/[他她]|[A-Za-z\u4e00-\u9fa5]{1,12}/.test(source) && /(抬眼|垂眼|低头|靠近|退开|伸手|握住|松开|停下|走近|坐下|起身|笑了|皱眉|沉默|呼吸|窗外|灯光|雨声|房间|空气|指尖|视线|肩膀|衣角|门口)/.test(source)) return true;
    return false;
}

function splitWechatOfflinePlainText(content, char) {
    const source = cleanWechatVisibleContent(content);
    if (!source) return [];
    if (isWechatStandaloneRichOrRegexSource(source, char)) return [{ kind: 'text', content: source }];
    const mode = getWechatChatPresenceMode(char);
    const shouldSplit = mode === 'offline'
        || source.length > 120
        || /\r?\n/.test(source)
        || (mode === 'auto' && (source.length > 90 || /[“「『][\s\S]+[”」』]/.test(source) || isWechatOfflineNarrationSentence(source)));
    if (!shouldSplit) return [{ kind: 'text', content: source }];

    const parts = [];
    const paragraphs = source.split(/\n{2,}|\r?\n/).map(item => item.trim()).filter(Boolean);
    const sources = paragraphs.length ? paragraphs : [source];
    sources.forEach(paragraph => {
        let cursor = 0;
        const quoteRe = /[“「『]([^”」』]{1,260})[”」』]/g;
        let match;
        let hadQuote = false;
        while ((match = quoteRe.exec(paragraph)) !== null) {
            hadQuote = true;
            const before = paragraph.slice(cursor, match.index).trim();
            splitWechatSentenceChunks(before).forEach(chunk => pushWechatSplitTextPart(parts, 'narration', chunk));
            splitWechatSentenceChunks(match[1]).forEach(chunk => pushWechatSplitTextPart(parts, 'text', chunk));
            cursor = quoteRe.lastIndex;
        }
        const rest = paragraph.slice(cursor).trim();
        if (hadQuote) {
            splitWechatSentenceChunks(rest).forEach(chunk => pushWechatSplitTextPart(parts, 'narration', chunk));
            return;
        }
        splitWechatSentenceChunks(paragraph, mode === 'offline' ? 82 : 118).forEach(chunk => {
            pushWechatSplitTextPart(parts, isWechatOfflineNarrationSentence(chunk) ? 'narration' : 'text', chunk);
        });
    });
    return parts.length ? parts : [{ kind: 'text', content: source }];
}

function buildWechatStickerDirectiveMessageFromText(text, char) {
    const source = cleanWechatVisibleContent(text);
    const match = source.match(/^\s*\[(?:微信表情|发送了表情)\s*[：:]\s*([^\]]+)\]\s*$/);
    return match ? buildWechatMessageFromAiDirective('微信表情', match[1], char) : null;
}

function isWechatIndexInsideRanges(index, ranges) {
    return ranges.some(range => index >= range.start && index < range.end);
}

function getWechatAiParseEvents(source) {
    const text = String(source || '');
    const richRanges = getWechatRichCandidateRanges(text).map(range => ({
        type: 'rich',
        start: range.start,
        end: range.end
    }));
    const directiveRe = createWechatAiDirectiveRegex();
    const events = [...richRanges];
    let match;
    while ((match = directiveRe.exec(text)) !== null) {
        if (isWechatIndexInsideRanges(match.index, richRanges)) continue;
        events.push({
            type: 'directive',
            start: match.index,
            end: directiveRe.lastIndex,
            command: match[1] || match[3],
            args: match[2] || '',
            standaloneNarration: !!match[3]
        });
    }
    return events.sort((a, b) => a.start - b.start || (a.type === 'rich' ? -1 : 1));
}

function appendWechatNarrationContentParts(target, content, char) {
    const source = cleanWechatVisibleContent(content);
    if (!source) return;
    if (isWechatStandaloneRichOrRegexSource(source, char)) {
        target.push({ kind: 'text', content: source });
        return;
    }
    splitWechatSentenceChunks(normalizeWechatOfflineNarrationText(source), 92)
        .forEach(chunk => pushWechatSplitTextPart(target, 'narration', chunk));
}

function appendWechatDirectivePart(target, command, args, char) {
    if (command === '微信改备注') {
        const msg = applyWechatNicknameDirective(args, char);
        if (msg) target.push({ kind: 'special', msg });
        return;
    }
    if (command === '微信监控' || command === '开启监控' || command === '关闭监控') {
        const msg = applyWechatMonitorDirective(command, args, char);
        if (msg) target.push({ kind: 'special', msg });
        return;
    }
    if (command === '微信朋友圈') {
        const msg = applyWechatCharMomentDirective(args, char);
        if (msg) target.push({ kind: 'special', msg });
        return;
    }
    if (command === '微信删除联系人') {
        const msg = applyWechatContactDeleteDirective(args, char);
        if (msg) target.push({ kind: 'special', msg });
        return;
    }
    const msg = buildWechatMessageFromAiDirective(command, args, char);
    if (msg) target.push({ kind: 'special', msg });
}

function migrateWechatStickerDirectiveHistory(char) {
    if (!char || !Array.isArray(char.history)) return false;
    let changed = false;
    char.history.forEach(msg => {
        if (!msg || msg.isMe || msg.type !== 'text') return;
        const stickerMsg = buildWechatStickerDirectiveMessageFromText(msg.content || '', char);
        if (!stickerMsg || !stickerMsg.content) return;
        msg.type = 'sticker';
        msg.content = stickerMsg.content;
        msg.stickerName = stickerMsg.stickerName || '贴纸';
        delete msg.description;
        changed = true;
    });
    return changed;
}

function applyWechatNicknameDirective(rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const nextNickname = String(args[0] || '').trim().slice(0, 24);
    if (!nextNickname) return null;

    if (!char.chatConfig) char.chatConfig = {};
    const previous = char.chatConfig.nickname || char.name || '对方';
    if (previous === nextNickname) return null;

    char.chatConfig.nickname = nextNickname;
    updateWechatCurrentChatHeader(char);
    const reason = args.slice(1).join('|').trim();
    return {
        type: 'system_notice',
        isMe: false,
        content: reason
            ? `已修改：${char.name || '对方'}把备注改成了「${nextNickname}」：${reason}`
            : `已修改：${char.name || '对方'}把备注改成了「${nextNickname}」`,
        timestamp: createMessageTimestamp()
    };
}

function splitWechatAiResponseSegments(content, char) {
    const source = cleanWechatVisibleContent(content);
    if (!source) return [];
    if (isWechatStandaloneRichOrRegexSource(source, char) && !hasWechatAiDirectiveSource(source) && !source.includes('|||')) return [source];
    const segments = [];
    let buffer = '';
    let quote = null;
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        const next2 = source.slice(i, i + 3);
        if (!quote && next2 === '|||') {
            if (buffer.trim()) segments.push(buffer.trim());
            buffer = '';
            i += 2;
            continue;
        }
        if (!quote && source.slice(i, i + 3) === '```') {
            quote = '```';
            buffer += '```';
            i += 2;
            continue;
        }
        if (quote === '```' && source.slice(i, i + 3) === '```') {
            quote = null;
            buffer += '```';
            i += 2;
            continue;
        }
        if (!quote && (ch === '"' || ch === "'" || ch === '`')) {
            quote = ch;
        } else if (quote === ch) {
            quote = null;
        }
        buffer += ch;
    }
    if (buffer.trim()) segments.push(buffer.trim());
    return segments;
}

function getWechatLastAiBatchStartIndex(history, msgIdx) {
    if (!Array.isArray(history) || msgIdx < 0 || msgIdx >= history.length) return msgIdx;
    let start = msgIdx;
    for (let i = msgIdx - 1; i >= 0; i -= 1) {
        const msg = history[i];
        if (!msg || msg.isMe || msg.type === 'system_notice' || msg.monitorEvent) break;
        start = i;
    }
    return start;
}

function applyWechatUserTitleDirective(rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const nextTitle = String(args[0] || '').trim().slice(0, 24);
    if (!nextTitle) return null;
    char.chatConfig = char.chatConfig || {};
    const previous = char.chatConfig.userTitle || '我';
    if (previous === nextTitle) return null;
    char.chatConfig.userTitle = nextTitle;
    const reason = args.slice(1).join('|').trim();
    return {
        type: 'system_notice',
        isMe: false,
        content: reason
            ? `已修改：${getWechatCharDisplayName(char)}把对你的称呼改成了「${nextTitle}」：${reason}`
            : `已修改：${getWechatCharDisplayName(char)}把对你的称呼改成了「${nextTitle}」`,
        timestamp: createMessageTimestamp()
    };
}

function normalizeWechatMonitorDirectiveMode(command, rawMode) {
    const commandText = String(command || '');
    const text = String(rawMode || '').trim().toLowerCase();
    if (/关闭/.test(commandText) || /^(关|关闭|off|false|0|disable|disabled)$/.test(text)) return { enabled: false, mode: 'persona' };
    if (/第三|上帝|磕糖|观众|吐槽|弹幕|observer|god|cp/.test(text)) return { enabled: true, mode: 'observer' };
    return { enabled: true, mode: 'persona' };
}

function applyWechatMonitorDirective(command, rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const state = normalizeWechatMonitorDirectiveMode(command, args[0] || '');
    const reason = args.slice(1).join('|').trim();
    char.chatConfig = char.chatConfig || {};
    const label = WECHAT_MONITOR_MODE_LABELS[state.mode] || WECHAT_MONITOR_MODE_LABELS.persona;

    if (!state.enabled) {
        char.chatConfig.monitorEnabled = false;
        char.chatConfig.monitorMode = state.mode;
        char.chatConfig.monitorChangedByCharAt = Date.now();
        if (reason) char.chatConfig.monitorReason = reason;
        if (typeof updateWechatChatSettings === 'function') updateWechatChatSettings(char);
        return {
            type: 'system_notice',
            isMe: false,
            content: reason ? `已修改：监控剧情已关闭：${reason}` : '已修改：监控剧情已关闭',
            timestamp: createMessageTimestamp()
        };
    }

    const request = {
        id: `monitor_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        enabled: true,
        mode: state.mode,
        reason,
        requestedAt: Date.now()
    };
    char.chatConfig.pendingMonitorRequest = request;
    if (window.currentChatCharId === char.id && typeof showWechatMonitorRequestModal === 'function') {
        setTimeout(() => showWechatMonitorRequestModal(char.id, request.id), 0);
    }
    return {
        type: 'system_notice',
        isMe: false,
        monitorRequestId: request.id,
        content: reason
            ? `${getWechatCharDisplayName(char)}想要开启监控（${label}）：${reason}`
            : `${getWechatCharDisplayName(char)}想要开启监控（${label}）`,
        timestamp: createMessageTimestamp()
    };
}

function pickWechatCharMomentCover(char) {
    const covers = Array.isArray(char?.chatConfig?.momentCovers) ? char.chatConfig.momentCovers.filter(Boolean) : [];
    if (!covers.length) return '';
    const seed = Math.floor(Date.now() / 86400000) + String(char.id || '').length;
    return covers[seed % covers.length];
}

function applyWechatCharMomentDirective(rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const text = String(args[0] || '').trim().slice(0, 500);
    const images = args.slice(1).map(item => String(item || '').trim()).filter(item => /^(https?:|data:image|data:video)/i.test(item)).slice(0, 9);
    if (!text && !images.length) return null;
    const store = getWechatMomentStore();
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.aiMoments = Array.isArray(char.chatConfig.aiMoments) ? char.chatConfig.aiMoments : [];
    const post = {
        id: 'mom_char_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        text,
        images,
        userName: getWechatCharDisplayName(char),
        userAvatar: char.avatar || DEFAULT_AVATAR,
        charId: char.id,
        source: 'ai_moment',
        cover: pickWechatCharMomentCover(char),
        comments: [],
        pending: [],
        createdAt: Date.now()
    };
    store.posts.push(post);
    char.chatConfig.aiMoments.push({ id: post.id, text, source: 'ai_moment', createdAt: post.createdAt });
    saveWechatMomentStore(store);
    saveCharactersToStorage();
    if (isWechatMomentsScreenOpen()) renderWechatMoments();
    return {
        type: 'system_notice',
        isMe: false,
        content: `${getWechatCharDisplayName(char)} 发了一条朋友圈`,
        timestamp: createMessageTimestamp()
    };
}

function findWechatContactByNameOrId(value, exceptId = '') {
    const query = String(value || '').trim();
    if (!query) return null;
    return (window.myCharacters || []).find(item => {
        if (!item || item.id === exceptId || item.isGroupChat) return false;
        const display = getWechatCharDisplayName(item);
        return item.id === query || item.name === query || display === query || (item.chatConfig && item.chatConfig.nickname === query);
    }) || null;
}

function applyWechatContactDeleteDirective(rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const target = findWechatContactByNameOrId(args[0] || '', char.id);
    const reason = args.slice(1).join('|').trim();
    if (!target) return null;
    const request = {
        id: `delete_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        targetId: target.id,
        targetName: getWechatCharDisplayName(target),
        reason,
        requestedAt: Date.now()
    };
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.pendingContactDeleteRequest = request;
    setTimeout(() => showWechatContactDeleteRequestModal(char.id, request.id), 0);
    return {
        type: 'system_notice',
        isMe: false,
        contactDeleteRequestId: request.id,
        content: reason
            ? `${getWechatCharDisplayName(char)}想要删除「${request.targetName}」：${reason}`
            : `${getWechatCharDisplayName(char)}想要删除「${request.targetName}」`,
        timestamp: createMessageTimestamp()
    };
}

function showWechatContactDeleteRequestModal(charId, requestId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const request = char?.chatConfig?.pendingContactDeleteRequest;
    if (!char || !request || request.id !== requestId) return;
    const host = getWechatModalRoot();
    let modal = document.getElementById('wc-contact-delete-request');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-contact-delete-request';
        modal.className = 'wc-modal-overlay wc-contact-delete-request hidden';
        host.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="wc-monitor-request-card wc-contact-delete-card">
            <div class="wc-monitor-request-head">
                <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div><strong>${wcEscapeHtml(getWechatCharDisplayName(char))}</strong><span>联系人删除请求</span></div>
            </div>
            <p>${wcEscapeHtml(getWechatCharDisplayName(char))} 想要从你的联系人列表里删除「${wcEscapeHtml(request.targetName)}」。${request.reason ? wcEscapeHtml(request.reason) : ''}</p>
            <div class="wc-monitor-request-actions">
                <button type="button" onclick="rejectWechatContactDeleteRequest(${quoteWechatJsString(charId)}, ${quoteWechatJsString(requestId)})">不允许</button>
                <button type="button" class="primary danger" onclick="approveWechatContactDeleteRequest(${quoteWechatJsString(charId)}, ${quoteWechatJsString(requestId)})">允许删除</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function rejectWechatContactDeleteRequest(charId, requestId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (char?.chatConfig?.pendingContactDeleteRequest?.id === requestId) delete char.chatConfig.pendingContactDeleteRequest;
    saveCharactersToStorage();
    document.getElementById('wc-contact-delete-request')?.classList.add('hidden');
    showWechatToast('已拒绝删除联系人');
}

function approveWechatContactDeleteRequest(charId, requestId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const request = char?.chatConfig?.pendingContactDeleteRequest;
    if (!char || !request || request.id !== requestId) return;
    const targetName = request.targetName;
    window.myCharacters = (window.myCharacters || []).filter(c => c.id !== request.targetId);
    delete char.chatConfig.pendingContactDeleteRequest;
    saveCharactersToStorage();
    document.getElementById('wc-contact-delete-request')?.classList.add('hidden');
    renderChatList();
    renderContacts();
    showWechatToast(`已删除 ${targetName}`);
}
window.approveWechatContactDeleteRequest = approveWechatContactDeleteRequest;
window.rejectWechatContactDeleteRequest = rejectWechatContactDeleteRequest;
window.applyWechatCharMomentDirective = applyWechatCharMomentDirective;

function applyWechatCharBlacklistDirective(rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const reason = args.join('|').trim();
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.charBlacklistedUser = true;
    char.chatConfig.charBlacklistReason = reason || '';
    return {
        type: 'system_notice',
        isMe: false,
        content: reason
            ? `${getWechatCharDisplayName(char)}把你拉黑了：${reason}`
            : `${getWechatCharDisplayName(char)}把你拉黑了`,
        timestamp: createMessageTimestamp()
    };
}

function parseWechatAiMessageParts(text, char) {
    const source = cleanWechatVisibleContent(text);
    if (!source) return [];
    if (isWechatStandaloneRichOrRegexSource(source, char) && !hasWechatAiDirectiveSource(source)) {
        return [{ kind: 'text', content: source }];
    }

    const parts = [];
    const events = getWechatAiParseEvents(source);
    if (!events.length) {
        appendWechatPlainAiTextParts(parts, source, char);
        return parts.length ? parts : splitWechatOfflinePlainText(source, char);
    }

    let lastIndex = 0;
    events.forEach((event, eventIndex) => {
        if (event.start < lastIndex) return;
        const before = source.slice(lastIndex, event.start).trim();
        if (before) appendWechatPlainAiTextParts(parts, before, char);

        if (event.type === 'rich') {
            const rich = source.slice(event.start, event.end).trim();
            if (rich) parts.push({ kind: 'text', content: rich });
            lastIndex = event.end;
            return;
        }

        if (event.standaloneNarration) {
            const nextStart = events[eventIndex + 1] ? events[eventIndex + 1].start : source.length;
            appendWechatNarrationContentParts(parts, source.slice(event.end, nextStart), char);
            lastIndex = nextStart;
            return;
        }

        appendWechatDirectivePart(parts, event.command, event.args, char);
        lastIndex = event.end;
    });

    const after = source.slice(lastIndex).trim();
    if (after) appendWechatPlainAiTextParts(parts, after, char);
    return parts.length ? parts : splitWechatOfflinePlainText(source, char);
}

function renderWechatShareCard(msg, quoteHtml = '') {
    const card = msg.card && typeof msg.card === 'object' ? msg.card : {};
    const title = card.title || msg.title || '转发';
    const text = card.text || msg.text || msg.content || '';
    const source = card.source || msg.source || '';
    const product = card.product && typeof card.product === 'object' ? card.product : null;
    if (card.action === 'shop_pay') {
        const order = card.order && typeof card.order === 'object' ? card.order : {};
        const items = Array.isArray(order.items) ? order.items : [];
        const cover = items.find(item => item && item.image)?.image || '';
        const total = Number(order.total || 0);
        return `
            <div class="msg-bubble wc-share-product-card wc-shop-pay-card${msg.isMe ? ' green' : ''}">
                ${quoteHtml}
                <div class="wc-share-product-head"><i class="ri-bank-card-line"></i><span>购物代付请求</span></div>
                <div class="wc-share-product-main">
                    <div class="wc-share-product-thumb">${cover ? `<img src="${wcEscapeHtml(cover)}" loading="lazy" onerror="this.remove()">` : '<i class="ri-shopping-cart-2-line"></i>'}</div>
                    <div class="wc-share-product-info">
                        <strong>${wcEscapeHtml(card.title || '帮我代付这单')}</strong>
                        <span>${wcEscapeHtml(card.text || getWechatShopCartSummary(items) || '购物订单')}</span>
                        <div><em>${total > 0 ? `¥${total.toFixed(2)}` : '金额待定'}</em><b>${wcEscapeHtml(order.address ? '含收货地址' : '待补地址')}</b></div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>购物代付</span>${buildMessageMeta(msg)}</div>
            </div>
        `;
    }
    if (card.action === 'takeout_pay') {
        const order = card.order && typeof card.order === 'object' ? card.order : {};
        const total = Number(order.total || 0);
        return `
            <div class="msg-bubble wc-share-product-card wc-takeout-pay-card${msg.isMe ? ' green' : ''}">
                ${quoteHtml}
                <div class="wc-share-product-head"><i class="ri-riding-line"></i><span>外卖代点请求</span></div>
                <div class="wc-share-product-main">
                    <div class="wc-share-product-thumb"><i class="ri-restaurant-2-line"></i></div>
                    <div class="wc-share-product-info">
                        <strong>${wcEscapeHtml(order.shopName || card.title || '帮我点外卖')}</strong>
                        <span>${wcEscapeHtml(card.text || order.summary || '外卖订单')}</span>
                        <div><em>${total > 0 ? `¥${total.toFixed(2)}` : '金额待定'}</em><b>${wcEscapeHtml(order.address ? '送到地址' : '待补地址')}</b></div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>外卖代点</span>${buildMessageMeta(msg)}</div>
            </div>
        `;
    }
    if (card.action === 'screen_share') {
        return `
            <div class="msg-bubble msg-link-card${msg.isMe ? ' green' : ''}">
                ${quoteHtml}
                <div class="msg-link-main">
                    <div class="msg-link-icon"><i class="ri-cast-line"></i></div>
                    <div class="msg-link-info"><span>共享屏幕</span><strong>${wcEscapeHtml(card.title || '屏幕共享')}</strong><p>${wcEscapeHtml(text || '等待浏览器授权后共享当前标签页/屏幕。')}</p></div>
                </div>
                <div class="msg-card-footer"><span>实时共享</span>${buildMessageMeta(msg)}</div>
            </div>
        `;
    }
    if (card.action === 'product' || product) {
        const productName = product?.name || title || '商品';
        const productTag = product?.tag || card.tag || '精选好物';
        const productDesc = product?.description || text || '';
        const price = Number(product?.price || card.price || 0);
        const image = product?.image || card.image || (Array.isArray(card.images) ? card.images.find(Boolean) : '');
        return `
            <div class="msg-bubble wc-share-product-card${msg.isMe ? ' green' : ''}">
                ${quoteHtml}
                <div class="wc-share-product-head">
                    <i class="ri-shopping-bag-3-line"></i>
                    <span>${wcEscapeHtml(source || 'BYND 购物')}</span>
                </div>
                <div class="wc-share-product-main">
                    <div class="wc-share-product-thumb">
                        ${image ? `<img src="${wcEscapeHtml(image)}" loading="lazy" onerror="this.closest('.wc-share-product-thumb')?.classList.add('is-empty');this.remove()">` : '<i class="ri-store-2-line"></i>'}
                    </div>
                    <div class="wc-share-product-info">
                        <strong>${wcEscapeHtml(productName)}</strong>
                        <span>${wcEscapeHtml(productDesc || productTag)}</span>
                        <div><em>${price > 0 ? `¥${price.toFixed(2)}` : '价格待定'}</em><b>${wcEscapeHtml(productTag)}</b></div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>商品卡片</span>${buildMessageMeta(msg)}</div>
            </div>
        `;
    }
    const images = Array.isArray(card.images) ? card.images.filter(Boolean).slice(0, 4) : [];
    const imageHtml = images.length ? `
        <div class="wc-share-moment-images count-${images.length}">
            ${images.map(src => `<img src="${wcEscapeHtml(src)}" loading="lazy" onerror="this.style.display='none'">`).join('')}
        </div>
    ` : '';
    return `
        <div class="msg-bubble wc-share-moment-card${msg.isMe ? ' green' : ''}">
            ${quoteHtml}
            <div class="wc-share-moment-head">
                <i class="ri-share-forward-line"></i>
                <span>${wcEscapeHtml(title)}</span>
            </div>
            ${text ? `<div class="wc-share-moment-text">${wcEscapeHtml(text).replace(/\n/g, '<br>')}</div>` : ''}
            ${imageHtml}
            <div class="msg-card-footer"><span>${wcEscapeHtml(source || title)}</span>${buildMessageMeta(msg)}</div>
        </div>
    `;
}

function getWechatLiteActionContent(msg, kind) {
    const fallback = kind === 'poke'
        ? (msg.isMe ? '你拍了拍对方' : '对方拍了拍你')
        : (msg.isMe ? '你震动了对方的屏幕' : '对方震动了你的屏幕');
    let value = String(msg.note || msg.content || fallback).trim();
    const label = kind === 'poke' ? '拍一拍' : '震动屏幕';
    value = value
        .replace(new RegExp(`^\\s*(?:\\[${label}\\]|\\[${kind === 'poke' ? '拍一拍' : '屏幕震动'}\\]|\\[${kind === 'poke' ? '微信拍一拍' : '微信震动'}\\])\\s*`, 'i'), '')
        .replace(new RegExp(`^\\s*(?:${label}|\\[${label}\\])\\s*[：:]?\\s*`, 'i'), '')
        .trim();
    return value || fallback;
}

function buildWechatSpecialBubble(msg, quoteHtml = '', msgIndex = -1, charObj = null) {
    const metaHtml = buildMessageMeta(msg);
    const sideClass = msg.isMe ? ' green' : '';

    if (msg.type === 'share_card') {
        return renderWechatShareCard(msg, quoteHtml);
    }

    if (msg.type === 'poke') {
        const text = getWechatLiteActionContent(msg, 'poke');
        return `
            <div class="msg-bubble msg-lite-action-bubble msg-poke-bubble${sideClass}">
                ${quoteHtml}
                <div class="msg-lite-action-main">
                    <div class="msg-lite-action-icon"><i class="ri-hand-heart-line"></i></div>
                    <div class="msg-lite-action-info">
                        <strong>拍一拍</strong>
                        <span>${wcEscapeHtml(text)}</span>
                    </div>
                </div>
                ${metaHtml}
            </div>
        `;
    }

    if (msg.type === 'screen_shake') {
        const text = getWechatLiteActionContent(msg, 'screen_shake');
        return `
            <div class="msg-bubble msg-lite-action-bubble msg-shake-bubble${sideClass}">
                ${quoteHtml}
                <div class="msg-lite-action-main">
                    <div class="msg-lite-action-icon"><i class="ri-shake-hands-line"></i></div>
                    <div class="msg-lite-action-info">
                        <strong>屏幕震动</strong>
                        <span>${wcEscapeHtml(text)}</span>
                    </div>
                </div>
                ${metaHtml}
            </div>
        `;
    }

    if (msg.type === 'music_card') {
        const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
        const title = music.title || msg.title || '\u4e00\u8d77\u542c\u6b4c';
        const artist = music.artist || msg.artist || '';
        const sourceUrl = normalizeWechatUrl(music.sourceAudioUrl || msg.sourceAudioUrl || '');
        const savedUrl = normalizeWechatUrl(music.playableUrl || msg.playableUrl || music.audioUrl || msg.audioUrl || music.url || msg.url || '');
        const audioUrl = (sourceUrl && isWechatMusicProxyUrl(sourceUrl)) ? sourceUrl : (savedUrl || sourceUrl);
        const artwork = music.artwork || msg.artwork || '';
        const pending = !!(music.pendingSearch || music.resolving);
        const failed = !!music.lookupFailed && !audioUrl;
        const incomingInvite = isWechatIncomingMusicInvite(msg);
        const inviteAccepted = isWechatMusicInviteAccepted(msg);
        const charName = getWechatCharDisplayName(charObj);
        if (incomingInvite && !inviteAccepted) {
            const actionHtml = Number.isInteger(Number(msgIndex)) && Number(msgIndex) >= 0
                ? `<button type="button" onclick="event.stopPropagation();acceptWechatMusicInvite(${Number(msgIndex)})">\u540c\u610f\u4e00\u8d77\u542c</button>`
                : '<button type="button" disabled>\u7b49\u5f85\u6253\u5f00\u804a\u5929</button>';
            return `
                <div class="msg-bubble msg-music-invite-card${sideClass}${pending ? ' resolving' : ''}" data-audio-url="${wcEscapeHtml(audioUrl)}" data-source-url="${wcEscapeHtml(sourceUrl)}">
                    ${quoteHtml}
                    <div class="msg-music-invite-head">
                        <div class="msg-music-art">${artwork ? `<img src="${wcEscapeHtml(artwork)}" onerror="this.remove()">` : '<i class="ri-headphone-fill"></i>'}</div>
                        <div class="msg-music-main">
                            <span>${pending ? '\u6b63\u5728\u51c6\u5907\u9080\u8bf7' : '\u4e00\u8d77\u542c\u6b4c\u9080\u8bf7'}</span>
                            <strong>${wcEscapeHtml(title)}</strong>
                            <em>${wcEscapeHtml(artist || music.sourceName || 'BYND Music')}</em>
                        </div>
                    </div>
                    <p class="msg-music-invite-copy">${wcEscapeHtml(charName)} \u60f3\u548c\u4f60\u4e00\u8d77\u542c\u8fd9\u9996\u6b4c\u3002</p>
                    <div class="msg-music-invite-actions">
                        ${actionHtml}
                        <span>${pending ? '\u540c\u610f\u540e\u81ea\u52a8\u627e\u53ef\u64ad\u653e\u97f3\u6e90' : (failed ? '\u5f53\u524d\u97f3\u6e90\u672a\u627e\u5230\uff0c\u53ef\u8ba9 TA \u6362\u4e00\u9996' : '\u540c\u610f\u540e\u7acb\u5373\u64ad\u653e')}</span>
                    </div>
                    <div class="msg-card-footer"><span>\u97f3\u4e50\u9080\u8bf7</span>${metaHtml}</div>
                </div>
            `;
        }
        const cardLabel = incomingInvite ? '\u6b63\u5728\u4e00\u8d77\u542c' : (pending ? '\u6b63\u5728\u627e\u6b4c' : (failed ? '\u672a\u627e\u5230\u97f3\u6e90' : '\u97f3\u4e50\u5361\u7247'));
        const footerLabel = pending ? '\u6b63\u5728\u641c\u7d22\u53ef\u64ad\u653e\u97f3\u6e90' : (failed ? '\u9700\u8981\u6362\u4e2a\u5173\u952e\u8bcd' : (incomingInvite ? '\u5df2\u540c\u610f\u4e00\u8d77\u542c' : '\u4e00\u8d77\u542c\u6b4c'));
        return `
            <div class="msg-bubble msg-music-card${incomingInvite ? ' accepted-invite' : ''}${sideClass}${pending ? ' resolving' : ''}" data-audio-url="${wcEscapeHtml(audioUrl)}" data-source-url="${wcEscapeHtml(sourceUrl)}" data-title="${wcEscapeHtml(title)}" data-artist="${wcEscapeHtml(artist)}" role="button" tabindex="0">
                ${quoteHtml}
                <div class="msg-music-art">${artwork ? `<img src="${wcEscapeHtml(artwork)}" onerror="this.remove()">` : '<i class="ri-music-2-fill"></i>'}</div>
                <div class="msg-music-main">
                    <span>${cardLabel}</span>
                    <strong>${wcEscapeHtml(title)}</strong>
                    <em>${wcEscapeHtml(artist || music.sourceName || 'BYND Music')}</em>
                </div>
                <i class="${pending ? 'ri-loader-4-line' : 'ri-play-circle-fill'} msg-music-play"></i>
                <div class="msg-card-footer"><span>${footerLabel}</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'link_card') {
        const url = normalizeWechatUrl(msg.url || msg.content || '');
        const title = msg.title || getWechatLinkHost(url) || '链接';
        const note = msg.note || msg.text || '';
        const host = getWechatLinkHost(url);
        return `
            <div class="msg-bubble msg-link-card${sideClass}" role="button" tabindex="0" onclick="event.stopPropagation();openWechatLinkCard(${quoteWechatJsString(url)})">
                ${quoteHtml}
                <div class="msg-link-main">
                    <div class="msg-link-icon"><i class="ri-links-line"></i></div>
                    <div class="msg-link-info">
                        <span>${wcEscapeHtml(host)}</span>
                        <strong>${wcEscapeHtml(title)}</strong>
                        ${note ? `<p>${wcEscapeHtml(note)}</p>` : ''}
                    </div>
                </div>
                <div class="msg-card-footer"><span>链接卡片</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'voice') {
        const duration = normalizeWechatDuration(msg.duration, 8);
        const width = Math.min(236, Math.max(110, 96 + duration * 2.2));
        const transcript = msg.transcript ? `<div class="msg-voice-transcript">${wcEscapeHtml(msg.transcript)}</div>` : '';
        return `
            <div class="msg-bubble msg-voice-bubble${sideClass}" style="--voice-width:${width}px;" onclick="event.stopPropagation();toggleWechatVoiceTranscript(this)">
                ${quoteHtml}
                <div class="msg-voice-line">
                    <span class="msg-voice-waves"><b></b><b></b><b></b><b></b><b></b></span>
                    <span class="msg-voice-duration">${duration}"</span>
                </div>
                ${transcript}
                ${metaHtml}
            </div>
        `;
    }

    if (msg.type === 'transfer') {
        const amount = normalizeWechatAmount(msg.amount);
        const isReceipt = !!msg.receipt;
        const title = isReceipt ? '已收取转账' : (msg.status === '已被领取' ? '转账已被领取' : '转账');
        const note = isReceipt
            ? (msg.note || buildWechatCollectedAtText(msg))
            : (msg.note || (msg.status === '已被领取' ? '对方已收款' : (msg.isMe ? '待对方收款' : '转账给你')));
        const footer = isReceipt ? '微信转账已收取' : '微信转账';
        return `
            <div class="msg-bubble msg-pay-bubble msg-transfer-bubble${isReceipt ? ' msg-pay-receipt' : ''}${sideClass}">
                ${quoteHtml}
                <div class="msg-pay-main">
                    <div class="msg-pay-icon"><i class="ri-money-cny-circle-fill"></i></div>
                    <div class="msg-pay-info">
                        <div class="msg-pay-title">${title}</div>
                        <div class="msg-pay-amount">¥${wcEscapeHtml(amount)}</div>
                        <div class="msg-pay-note">${wcEscapeHtml(note)}</div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>${footer}</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'redpacket') {
        const title = msg.title || msg.note || '恭喜发财，大吉大利';
        const amount = msg.amount ? `<div class="msg-rp-amount">¥${wcEscapeHtml(normalizeWechatAmount(msg.amount))}</div>` : '';
        const isReceipt = !!msg.receipt;
        const displayStatus = isReceipt ? buildWechatCollectedAtText(msg) : (msg.status === '已被领取' ? '对方已领取' : (msg.status || '待收取'));
        return `
            <div class="msg-bubble msg-pay-bubble msg-redpacket-bubble${isReceipt ? ' msg-pay-receipt' : ''}${sideClass}">
                ${quoteHtml}
                <div class="msg-pay-main">
                    <div class="msg-pay-icon"><i class="ri-red-packet-fill"></i></div>
                    <div class="msg-pay-info">
                        <div class="msg-pay-title">${wcEscapeHtml(isReceipt ? '已收取红包' : title)}</div>
                        ${amount}
                        <div class="msg-pay-note">${wcEscapeHtml(displayStatus)}</div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>${isReceipt ? '微信红包已收取' : '微信红包'}</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'gift') {
        const item = msg.item && typeof msg.item === 'object' ? msg.item : {};
        const name = item.name || msg.title || '一份礼物';
        const image = item.image || msg.image || '';
        const amount = item.price || msg.amount || '';
        const isReceipt = !!msg.receipt;
        const note = isReceipt
            ? (msg.note || buildWechatCollectedAtText(msg))
            : (msg.note || item.description || (msg.isMe ? '等待对方收取' : '送给你的礼物'));
        return `
            <div class="msg-bubble msg-gift-bubble${isReceipt ? ' msg-gift-receipt' : ''}${sideClass}">
                ${quoteHtml}
                <div class="msg-gift-cover">
                    ${image ? `<img src="${wcEscapeHtml(image)}" loading="lazy" onerror="this.style.display='none'">` : '<i class="ri-gift-2-fill"></i>'}
                </div>
                <div class="msg-gift-info">
                    <span>${wcEscapeHtml(isReceipt ? '已收取礼物' : '送你一份礼物')}</span>
                    <strong>${wcEscapeHtml(name)}</strong>
                    ${amount ? `<em>¥${wcEscapeHtml(normalizeWechatAmount(amount))}</em>` : ''}
                    <p>${wcEscapeHtml(note)}</p>
                </div>
                <div class="msg-card-footer"><span>BYND 礼物</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'intimatePay') {
        const isReceipt = !!msg.receipt || msg.status === '已开通';
        const amount = msg.amount ? normalizeWechatAmount(msg.amount) : '';
        const note = msg.note || (isReceipt ? '亲密付已开通' : '邀请你开通亲密付');
        return `
            <div class="msg-bubble msg-intimate-pay-bubble${isReceipt ? ' msg-pay-receipt' : ''}${sideClass}">
                ${quoteHtml}
                <div class="msg-pay-main">
                    <div class="msg-pay-icon"><i class="ri-bank-card-fill"></i></div>
                    <div class="msg-pay-info">
                        <div class="msg-pay-title">${isReceipt ? '亲密付已开通' : '开通亲密付'}</div>
                        ${amount ? `<div class="msg-pay-amount">¥${wcEscapeHtml(amount)}</div>` : ''}
                        <div class="msg-pay-note">${wcEscapeHtml(note)}</div>
                    </div>
                </div>
                <div class="msg-card-footer"><span>BYND 亲密付</span>${metaHtml}</div>
            </div>
        `;
    }

    if (msg.type === 'voiceCall' || msg.type === 'videoCall') {
        const isVideo = msg.type === 'videoCall';
        const title = isVideo ? '视频通话' : '语音通话';
        const icon = isVideo ? 'ri-video-chat-fill' : 'ri-phone-fill';
        const desc = getWechatCallDescription(msg);
        return `
            <div class="msg-bubble msg-call-bubble${sideClass}">
                ${quoteHtml}
                <div class="msg-call-main">
                    <div class="msg-call-icon"><i class="${icon}"></i></div>
                    <div class="msg-call-info">
                        <div class="msg-call-title">${title}</div>
                        <div class="msg-call-desc">${wcEscapeHtml(desc)}</div>
                    </div>
                </div>
                ${metaHtml}
            </div>
        `;
    }

    return '';
}

// 🔥 微信渲染逻辑：只显示纯文本 (Clean & Simple)
function renderMessageBubble(container, msg, avatarUrl, charObj, msgIndex) {
    const row = document.createElement('div');
    row.className = `msg-row ${msg.isMe ? 'right' : 'left'}`;
    if (typeof msgIndex === 'number') row.dataset.msgIdx = msgIndex;

    if (msg.type === 'system_notice') {
        row.className = 'msg-row system';
        row.innerHTML = `<div class="msg-system-notice">${wcEscapeHtml(msg.content || '')}</div>`;
        container.appendChild(row);
        return;
    }

    const profile = getWechatChatUserProfile(charObj);
    const myAvatar = profile.avatar || DEFAULT_AVATAR;

    const currentAvatar = msg.isMe ? myAvatar : avatarUrl;

    const config = charObj.chatConfig || {};
    const fontSize = config.fontSize || 15;
    const quoteHtml = renderWechatMessageQuote(msg.replyTo);

    let bubbleHtml = '';
    const avatarClass = msg.isMe ? 'msg-avatar' : 'msg-avatar msg-avatar-ai';
    const avatarHtml = `<img class="${avatarClass}" src="${currentAvatar}">`;

    if (msg.type === 'sticker') {
        const isWechatEmoji = msg.emoji || msg.stickerKind === 'wechatEmoji' || isWechatBuiltinEmojiUrl(msg.content);
        const emojiClass = isWechatEmoji ? ' wechat-emoji' : '';
        const inner = `<div class="msg-bubble sticker${emojiClass}">${quoteHtml}<img src="${wcEscapeHtml(msg.content)}" alt="${wcEscapeHtml(msg.stickerName || '')}"><span class="msg-media-meta">${formatMessageTime(msg)}<i class="ri-check-double-line"></i></span></div>`;
        bubbleHtml = msg.isMe ? avatarHtml + inner : avatarHtml + `<div class="msg-bubble-shell media">${inner}</div>`;
    } else if (msg.type === 'image') {
        const inner = `<div class="msg-bubble image-bubble">${quoteHtml}<img src="${msg.content}"><span class="msg-media-meta">${formatMessageTime(msg)}<i class="ri-check-double-line"></i></span></div>`;
        bubbleHtml = msg.isMe ? avatarHtml + inner : avatarHtml + `<div class="msg-bubble-shell media">${inner}</div>`;
    } else if (isWechatSpecialMessage(msg.type)) {
        syncWechatMessageDescription(msg);
        const inner = buildWechatSpecialBubble(msg, quoteHtml, msgIndex, charObj);
        bubbleHtml = msg.isMe ? avatarHtml + inner : avatarHtml + `<div class="msg-bubble-shell">${inner}</div>`;
    } else {
        let rawContent = processMsgContent(msg.content, charObj);
        const metaHtml = buildMessageMeta(msg);
        const isRich = isRichMessageContent(rawContent);
        const richClass = isRich ? ' rich' : '';

        if (msg.isMe) {
            bubbleHtml = avatarHtml + `<div class="msg-bubble green${richClass}" style="font-size:${fontSize}px;">${quoteHtml}<div class="msg-text${richClass}">${rawContent}</div>${metaHtml}</div>`;
        } else {
            bubbleHtml = avatarHtml + `<div class="msg-bubble-shell"><div class="msg-bubble${richClass}" style="font-size:${fontSize}px;">${quoteHtml}<div class="msg-text${richClass}">${rawContent}</div>${metaHtml}</div></div>`;
        }
    }

    row.innerHTML = bubbleHtml;
    container.appendChild(row);
    executeScriptsInElement(row);
    bindWechatMusicCardPlayback(row);
    applyWechatBubbleMetaContrast(row);
    if (typeof msgIndex === 'number' && !msg.isMe && !msg.receipt && ['transfer', 'redpacket', 'gift', 'intimatePay'].includes(msg.type) && msg.status !== '已被领取' && msg.status !== '已收取' && msg.status !== '已开通') {
        row.classList.add('msg-row-pay-collectable');
        const payBubble = row.querySelector('.msg-pay-bubble, .msg-gift-bubble, .msg-intimate-pay-bubble');
        if (payBubble) {
            payBubble.setAttribute('role', 'button');
            payBubble.setAttribute('tabindex', '0');
            payBubble.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                collectWechatIncomingPayment(msgIndex);
            });
        }
    }
    if (!msg.isMe) bindWechatAiAvatarInteractions(row, charObj);
    // 长按气泡弹出操作菜单
    if (typeof msgIndex === 'number') {
        let pressTimer = null;
        row.addEventListener('click', (e) => {
            if (!window._msgMultiSelectMode) return;
            e.preventDefault();
            e.stopPropagation();
            toggleMsgSelect(msgIndex, row);
        }, true);
        const startPress = (e) => {
            if (window._msgMultiSelectMode) return;
            if (isWechatRichInteractiveTarget(e.target)) return;
            pressTimer = setTimeout(() => {
                e.preventDefault();
                showMsgActionMenu(msgIndex, msg.isMe, row);
            }, 500);
        };
        const cancelPress = () => { clearTimeout(pressTimer); };
        row.addEventListener('touchstart', startPress, { passive: true });
        row.addEventListener('touchend', cancelPress);
        row.addEventListener('touchmove', cancelPress);
        row.addEventListener('mousedown', startPress);
        row.addEventListener('mouseup', cancelPress);
        row.addEventListener('mouseleave', cancelPress);
        row.addEventListener('dblclick', (e) => {
            if (window._msgMultiSelectMode) return;
            if (isWechatRichInteractiveTarget(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            clearTimeout(pressTimer);
            showMsgActionMenu(msgIndex, msg.isMe, row);
        });
    }
}

function bindWechatAiAvatarInteractions(row, charObj) {
    const avatarEl = row && row.querySelector ? row.querySelector('.msg-avatar-ai') : null;
    if (!avatarEl || !charObj) return;

    let clickTimer = null;
    const stopAvatarBubble = (event) => {
        event.stopPropagation();
    };
    avatarEl.addEventListener('mousedown', stopAvatarBubble);
    avatarEl.addEventListener('mouseup', stopAvatarBubble);
    avatarEl.addEventListener('touchstart', stopAvatarBubble, { passive: true });
    avatarEl.addEventListener('touchend', stopAvatarBubble);
    avatarEl.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => openWechatAiStatusTicket(charObj.id), 220);
    });
    avatarEl.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(clickTimer);
        openWechatAiPhone(charObj.id);
    });
}

function isWechatRichInteractiveTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    if (!target.closest('.msg-text.rich')) return false;
    return !!target.closest('a, button, input, select, textarea, label, summary, details, [role="button"], .wc-rich-clickable, [data-wc-rich-click]');
}

// ========== 气泡操作菜单（长按触发） ==========

window._msgMultiSelectMode = false;
window._msgSelectedIndexes = new Set();

function showMsgActionMenu(msgIdx, isMe, rowEl) {
    // 如果在多选模式，点击是切换选中
    if (window._msgMultiSelectMode) {
        toggleMsgSelect(msgIdx, rowEl);
        return;
    }
    // 关闭已有菜单
    closeMsgActionMenu();
    const menu = document.createElement('div');
    menu.className = 'msg-action-menu';
    menu.id = 'msg-action-menu';

    const char = getCurrentChatChar();
    const msg = char && Array.isArray(char.history) ? char.history[msgIdx] : null;
    const isNarration = false;
    let html = `<div class="msg-action-item" onclick="editSingleMsg(${msgIdx})"><i class="ri-edit-line"></i> 编辑</div>`;
    if (!isNarration) html += `<div class="msg-action-item" onclick="quoteWechatMessage(${msgIdx})"><i class="ri-reply-line"></i> 引用</div>`;
    html += `<div class="msg-action-item" onclick="deleteSingleMsg(${msgIdx})"><i class="ri-delete-bin-line"></i> 删除</div>`;
    if (!isMe && !isNarration) {
        html += `<div class="msg-action-item" onclick="collectWechatMessage(${msgIdx})"><i class="ri-star-line"></i> 收藏</div>`;
        html += `<div class="msg-action-item" onclick="rerollMsg(${msgIdx})"><i class="ri-refresh-line"></i> 重新roll</div>`;
    }
    html += `<div class="msg-action-item" onclick="enterMsgMultiSelect(${msgIdx})"><i class="ri-checkbox-multiple-line"></i> 多选删除</div>`;
    menu.innerHTML = html;

    rowEl.style.position = 'relative';
    rowEl.appendChild(menu);

    // 点击其他地方关闭
    setTimeout(() => {
        document.addEventListener('click', _closeMsgMenuHandler, { once: true });
    }, 50);
}

function _closeMsgMenuHandler(e) {
    const menu = document.getElementById('msg-action-menu');
    if (menu && !menu.contains(e.target)) closeMsgActionMenu();
}

function closeMsgActionMenu() {
    const menu = document.getElementById('msg-action-menu');
    if (menu) menu.remove();
}

function deleteSingleMsg(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history) return;
    if (msgIdx < 0 || msgIdx >= char.history.length) return;
    char.history.splice(msgIdx, 1);
    saveCharactersToStorage();
    refreshChatView(char);
}

function editSingleMsg(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history || msgIdx < 0 || msgIdx >= char.history.length) return;
    const msg = char.history[msgIdx];
    if (isWechatSpecialMessage(msg.type)) {
        openWechatComposer(msg.type, msgIdx);
        return;
    }
    openWechatMessageEditor(msgIdx);
}

function rerollMsg(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history) return;
    if (msgIdx < 0 || msgIdx >= char.history.length) return;
    const startIdx = getWechatLastAiBatchStartIndex(char.history, msgIdx);
    char.history.splice(startIdx);
    saveCharactersToStorage();
    refreshChatView(char);
    const contentEl = document.getElementById('chat-room-content');
    triggerAiAfterMessage(char, contentEl);
}

function enterMsgMultiSelect(initialMsgIdx) {
    closeMsgActionMenu();
    window._msgMultiSelectMode = true;
    window._msgSelectedIndexes = new Set();
    // 显示底部多选操作栏
    const footer = document.querySelector('.wc-room-footer');
    if (footer) footer.classList.add('hidden');
    let bar = document.getElementById('msg-multiselect-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'msg-multiselect-bar';
        bar.className = 'msg-multiselect-bar';
        bar.innerHTML = `
            <span id="msg-select-count">已选 0 条</span>
            <div style="display:flex;gap:10px;">
                <span class="msg-ms-btn delete" onclick="deleteSelectedMsgs()">删除</span>
                <span class="msg-ms-btn cancel" onclick="exitMsgMultiSelect()">取消</span>
            </div>
        `;
        const room = document.getElementById('wechat-chat-room');
        room.appendChild(bar);
    }
    bar.classList.remove('hidden');
    if (Number.isInteger(initialMsgIdx) && isWechatMsgSelectable(initialMsgIdx)) {
        const initialRow = document.querySelector(`.msg-row[data-msg-idx="${initialMsgIdx}"]`);
        if (initialRow) toggleMsgSelect(initialMsgIdx, initialRow);
    }
}

function exitMsgMultiSelect() {
    window._msgMultiSelectMode = false;
    window._msgSelectedIndexes = new Set();
    const bar = document.getElementById('msg-multiselect-bar');
    if (bar) bar.classList.add('hidden');
    const footer = document.querySelector('.wc-room-footer');
    if (footer) footer.classList.remove('hidden');
    // 去掉所有选中样式
    document.querySelectorAll('.msg-row.selected').forEach(r => r.classList.remove('selected'));
}

function toggleMsgSelect(msgIdx, rowEl) {
    if (!isWechatMsgSelectable(msgIdx)) {
        if (typeof showWechatToast === 'function') showWechatToast('这条消息不能多选删除');
        return;
    }
    if (window._msgSelectedIndexes.has(msgIdx)) {
        window._msgSelectedIndexes.delete(msgIdx);
        rowEl.classList.remove('selected');
    } else {
        window._msgSelectedIndexes.add(msgIdx);
        rowEl.classList.add('selected');
    }
    const countEl = document.getElementById('msg-select-count');
    if (countEl) countEl.textContent = `已选 ${window._msgSelectedIndexes.size} 条`;
}

function deleteSelectedMsgs() {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history) return;
    if (window._msgSelectedIndexes.size === 0) return;
    if (!confirm(`确定删除 ${window._msgSelectedIndexes.size} 条消息吗？`)) return;
    // 从大到小删，避免索引错位
    const sorted = [...window._msgSelectedIndexes].sort((a, b) => b - a);
    sorted.forEach(idx => {
        if (idx >= 0 && idx < char.history.length) char.history.splice(idx, 1);
    });
    saveCharactersToStorage();
    exitMsgMultiSelect();
    refreshChatView(char);
}

function isWechatHistoryExpanded(char) {
    if (!char) return false;
    window._wechatExpandedHistoryIds = window._wechatExpandedHistoryIds || new Set();
    return window._wechatExpandedHistoryIds.has(char.id);
}

function appendWechatHistoryDivider(container, char, count, expanded) {
    const divider = document.createElement('div');
    divider.className = 'msg-collapse-divider';
    divider.innerHTML = expanded
        ? `<i class="ri-arrow-up-s-line"></i><span>收起早期消息</span>`
        : `<i class="ri-history-line"></i><span>已折叠 ${count} 条早期消息</span><b>展开</b>`;
    divider.onclick = () => toggleWechatCollapsedHistory(char.id);
    container.appendChild(divider);
}

function toggleWechatCollapsedHistory(charId) {
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    window._wechatExpandedHistoryIds = window._wechatExpandedHistoryIds || new Set();
    if (window._wechatExpandedHistoryIds.has(charId)) {
        window._wechatExpandedHistoryIds.delete(charId);
    } else {
        window._wechatExpandedHistoryIds.add(charId);
    }
    refreshChatView(char);
}

function refreshChatView(char) {
    const contentEl = document.getElementById('chat-room-content');
    if (!contentEl) return;
    const history = char.history || [];
    const migratedMixedAi = migrateWechatMixedAiHistory(char);
    const migratedNarration = migrateWechatNarrationHistory(char);
    const migratedStickerDirectives = migrateWechatStickerDirectiveHistory(char);
    contentEl.innerHTML = '';
    const hasRealChatMessage = history.some(msg => msg && msg.type !== 'system_notice');
    if (isWechatXTheme() && !hasRealChatMessage) {
        contentEl.insertAdjacentHTML('beforeend', renderWechatXChatProfileIntro(char));
    }
    const expanded = isWechatHistoryExpanded(char);
    let startIndex = 0;
    if (history.length > WECHAT_AUTO_COLLAPSE_AFTER) {
        const collapsedCount = Math.max(0, history.length - WECHAT_COLLAPSE_KEEP_RECENT);
        if (expanded) {
            appendWechatHistoryDivider(contentEl, char, collapsedCount, true);
        } else {
            startIndex = collapsedCount;
            appendWechatHistoryDivider(contentEl, char, collapsedCount, false);
        }
    }
    let prevVisibleMsg = null;
    history.slice(startIndex).forEach((msg, offset) => {
        const index = startIndex + offset;
        if (msg && msg.type !== 'system_notice' && shouldShowWechatTimeDivider(prevVisibleMsg, msg)) {
            appendWechatTimeDivider(contentEl, getWechatMessageDate(msg));
        }
        renderMessageBubble(contentEl, msg, char.avatar, char, index);
        if (msg && msg.type !== 'system_notice') prevVisibleMsg = msg;
    });
    contentEl.scrollTop = contentEl.scrollHeight;
    requestAnimationFrame(() => { contentEl.scrollTop = contentEl.scrollHeight; });
    setTimeout(() => { contentEl.scrollTop = contentEl.scrollHeight; }, 180);
    if (migratedMixedAi || migratedNarration || migratedStickerDirectives) saveCharactersToStorage();
}

function getWechatPaymentReceiptId(msg, index) {
    return msg.receiptFor || msg.paymentId || msg.timestamp || `${msg.type}_${index}`;
}

function buildWechatPaymentReceiptMessage(msg, receiptFor, isMe = false) {
    const collectedAt = msg.collectedAt || createMessageTimestamp();
    const receipt = {
        type: msg.type,
        isMe,
        receipt: true,
        receiptFor,
        amount: msg.amount,
        title: msg.title,
        note: msg.note,
        status: '已收取',
        timestamp: collectedAt,
        collectedAt
    };
    if (msg.type === 'transfer' && !receipt.note) receipt.note = '已存入零钱';
    if (msg.type === 'redpacket' && !receipt.title) receipt.title = '恭喜发财，大吉大利';
    if (msg.type === 'gift') {
        receipt.item = msg.item;
        receipt.note = msg.note || '已放入礼物盒';
    }
    if (msg.type === 'intimatePay') {
        receipt.note = msg.note || '亲密付已开通';
        receipt.status = '已开通';
    }
    return syncWechatMessageDescription(receipt);
}

function isWechatMsgSelectable(msgIdx) {
    const char = getCurrentChatChar();
    const msg = char && Array.isArray(char.history) ? char.history[msgIdx] : null;
    if (!msg) return false;
    return msg.type !== 'system_notice';
}

function markPendingUserPaymentsCollected(char) {
    if (!char || !Array.isArray(char.history)) return false;
    let changed = false;
    const existingReceipts = new Set(
        char.history
            .filter(msg => msg && msg.receipt && msg.receiptFor)
            .map(msg => msg.receiptFor)
    );
    const receipts = [];

    char.history.forEach((msg, index) => {
        if (!msg || msg.receipt || !msg.isMe || !['transfer', 'redpacket', 'gift', 'intimatePay'].includes(msg.type)) return;
        const receiptFor = getWechatPaymentReceiptId(msg, index);
        if (!msg.receiptCreated) {
            ensureMessageTimestamp(msg);
            msg.status = msg.type === 'intimatePay' ? '已开通' : '已被领取';
            msg.receiptCreated = true;
            msg.collectedAt = createMessageTimestamp();
            syncWechatMessageDescription(msg);
            changed = true;
        }
        if (!existingReceipts.has(receiptFor)) {
            receipts.push(buildWechatPaymentReceiptMessage(msg, receiptFor));
            existingReceipts.add(receiptFor);
            changed = true;
        } else if (['redpacket', 'gift', 'intimatePay'].includes(msg.type) && (!msg.status || msg.status === '待收取' || msg.status === '待开通')) {
            msg.status = '已被领取';
            if (msg.type === 'intimatePay') msg.status = '已开通';
            syncWechatMessageDescription(msg);
            changed = true;
        }
    });
    if (receipts.length) char.history.push(...receipts);
    return changed;
}

function collectWechatIncomingPayment(msgIdx) {
    const char = getCurrentChatChar();
    if (!char || !Array.isArray(char.history)) return;
    const msg = char.history[msgIdx];
    if (!msg || msg.isMe || msg.receipt || !['transfer', 'redpacket', 'gift', 'intimatePay'].includes(msg.type)) return;
    if (msg.status === '已被领取' || msg.status === '已收取' || msg.status === '已开通') return;
    const receiptFor = getWechatPaymentReceiptId(msg, msgIdx);
    const hasReceipt = char.history.some(item => item && item.receipt && item.receiptFor === receiptFor);
    ensureMessageTimestamp(msg);
    msg.status = msg.type === 'intimatePay' ? '已开通' : '已被领取';
    msg.receiptCreated = true;
    msg.collectedAt = createMessageTimestamp();
    syncWechatMessageDescription(msg);
    if (msg.type === 'intimatePay') {
        const store = getWechatShopStore();
        store.intimatePay[char.id] = {
            limit: parseWechatAmountNumber(msg.amount) || 0,
            status: '已开通',
            note: msg.note || '亲密付已开通',
            updatedAt: Date.now()
        };
        saveWechatShopStore(store);
    }
    if (!hasReceipt) {
        char.history.push(buildWechatPaymentReceiptMessage(msg, receiptFor, true));
    }
    saveCharactersToStorage();
    refreshChatView(char);
    renderChatList();
}

function appendWechatAiMessageParts(char, contentEl, text) {
    const parsedParts = parseWechatAiMessageParts(cleanWechatVisibleContent(text), char);
    let appendedCount = 0;
    parsedParts.forEach(part => {
        const stickerDirectiveMsg = part.kind === 'text'
            ? buildWechatStickerDirectiveMessageFromText(part.content, char)
            : null;
        const aiMsg = part.kind === 'special'
            ? part.msg
            : (stickerDirectiveMsg || { type: 'text', isMe: false, content: cleanWechatVisibleContent(part.content), timestamp: createMessageTimestamp() });
        if (!aiMsg || (!aiMsg.content && !isWechatSpecialMessage(aiMsg.type))) return;
        if (isWechatIncomingCallMessage(aiMsg)) {
            handleWechatIncomingCall(char, aiMsg);
            return;
        }
        char.history.push(aiMsg);
        appendedCount += 1;
        if (aiMsg.type === 'music_card') {
            enrichWechatMusicCardMessage(char, aiMsg, { reason: 'ai_music' }).catch(e => console.warn('ai music enrich failed:', e));
        }
        if (aiMsg.type === 'poke') {
            triggerWechatScreenFeedback('poke');
        } else if (aiMsg.type === 'screen_shake') {
            triggerWechatScreenFeedback('shake');
        }
        refreshChatView(char);
    });
    return appendedCount;
}

function findWechatRichFunction(element, functionName) {
    if (!element || !functionName) return null;
    let scope = element;
    while (scope) {
        if (typeof scope[functionName] === 'function') return scope[functionName].bind(scope);
        scope = scope.parentElement || (scope.getRootNode && scope.getRootNode().host) || null;
    }
    return typeof window[functionName] === 'function' ? window[functionName].bind(window) : null;
}

function closeWechatRichModal(modal) {
    if (!modal) return;
    modal.classList.remove('visible', 'active', 'show', 'open');
    modal.style.display = 'none';
}

function openWechatRichModal(trigger, rootElement) {
    const richRoot = (trigger && trigger.closest && trigger.closest('.msg-text.rich')) || rootElement;
    if (!richRoot || !richRoot.querySelector) return false;

    const modal = richRoot.querySelector('.modal-overlay, .secret-modal, [id*="secretModal"], [class*="modal"]');
    if (!modal) return false;

    const host = (typeof getWechatModalRoot === 'function' ? getWechatModalRoot() : document.body) || document.body;
    if (modal.parentElement !== host) host.appendChild(modal);

    modal.classList.add('visible', 'active', 'show', 'open');
    Object.assign(modal.style, {
        display: 'flex',
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        zIndex: '3800',
        maxWidth: 'none',
        maxHeight: 'none',
        pointerEvents: 'auto'
    });

    if (modal.dataset.wcRichModalBound !== '1') {
        modal.dataset.wcRichModalBound = '1';
        modal.addEventListener('click', event => {
            const target = event.target;
            if (target === modal || (target && target.closest && target.closest('.close-modal, .wc-rich-modal-close'))) {
                event.preventDefault();
                event.stopPropagation();
                closeWechatRichModal(modal);
            }
        });
    }
    return true;
}

function decryptWechatRichSection(trigger) {
    if (!trigger || typeof trigger.closest !== 'function') return false;
    const section = trigger.closest('.encrypted-section');
    const overlay = section
        ? (section.querySelector('.encrypted-overlay') || trigger.closest('.encrypted-overlay'))
        : trigger.closest('.encrypted-overlay');
    if (!overlay) return false;

    overlay.classList.add('decrypted');
    overlay.style.pointerEvents = 'none';
    const progressBar = section && section.querySelector('.progress-bar-value');
    if (progressBar) progressBar.style.width = progressBar.style.width;
    return true;
}

function findWechatRichDecryptTrigger(target) {
    if (!target || typeof target.closest !== 'function') return null;
    const direct = target.closest('.decrypt-button, [data-wc-rich-original-onclick*="decryptContent"], [onclick*="decryptContent"]');
    if (direct) return direct;

    const overlay = target.closest('.encrypted-overlay');
    if (overlay) {
        const overlayText = (overlay.textContent || '').replace(/\s+/g, '');
        if (/点击解密内心深处|解密.*内心/.test(overlayText)) return overlay;
    }
    return null;
}

function ensureWechatRichDecryptDelegation() {
    if (window.__wechatRichDecryptDelegationBound === '1') return;
    window.__wechatRichDecryptDelegationBound = '1';
    document.addEventListener('click', event => {
        const trigger = findWechatRichDecryptTrigger(event.target);
        if (!trigger) return;
        if (decryptWechatRichSection(trigger)) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
    }, true);
}

function bindWechatRichRevealFallbacks(element) {
    if (!element || !element.querySelectorAll) return;
    ensureWechatRichDecryptDelegation();
    const selectorCandidates = Array.from(element.querySelectorAll('.secret-note, .secret-note-container, .encrypted-overlay, .decrypt-button, [data-secret], [data-decrypt], [data-reveal], [onclick*="decryptContent"], [onclick*="showModal"], [onclick*="hideModal"], [onclick*="secretModal"]'));
    const candidates = Array.from(new Set(selectorCandidates));
    candidates.forEach(el => {
        if (el.dataset.wcRichRevealBound === '1') return;
        const text = (el.textContent || '').replace(/\s+/g, '');
        const originalClick = el.getAttribute('onclick') || el.dataset.wcRichOriginalOnclick || '';
        const looksReveal = /点击|查看|解密|展开|内心|深处|■■|涂黑|机密|秘密|隐藏/.test(text)
            || /secret|decrypt|decode|unlock|reveal/i.test(el.className || '')
            || /decryptContent|showModal|secretModal|hideModal|closeModal/i.test(originalClick);
        if (!looksReveal) return;
        el.classList.add('wc-rich-clickable');
        el.dataset.wcRichRevealBound = '1';
        el.dataset.wcRichClick = '1';
        el.setAttribute('role', el.getAttribute('role') || 'button');
        el.setAttribute('tabindex', el.getAttribute('tabindex') || '0');
        el.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (decryptWechatRichSection(el)) return;
            const openedByFallback = openWechatRichModal(el, element);
            const runner = openedByFallback ? null : (
                findWechatRichFunction(el, 'decryptContent')
                || findWechatRichFunction(el, 'decodeContent')
                || findWechatRichFunction(el, 'unlockContent')
                || findWechatRichFunction(el, 'showModal')
                || findWechatRichFunction(el, 'showSecret')
                || findWechatRichFunction(el, 'revealSecret')
                || findWechatRichFunction(el, 'openSecret')
            );
            if (runner) {
                try {
                    runner(event);
                } catch (err) {
                    console.warn('rich reveal runner failed:', err);
                    openWechatRichModal(el, element);
                }
            }
        });
    });
}

function bindWechatRichDetailsFallbacks(element) {
    if (!element || !element.querySelectorAll) return;
    element.querySelectorAll('.msg-text.rich details > summary').forEach(summary => {
        if (summary.dataset.wcRichDetailsBound === '1') return;
        summary.dataset.wcRichDetailsBound = '1';
        summary.dataset.wcRichClick = '1';
        summary.addEventListener('click', event => {
            const details = summary.parentElement;
            if (!details || details.tagName !== 'DETAILS') return;
            event.preventDefault();
            event.stopPropagation();
            details.open = !details.open;
        });
    });
}

// 🔥 通用工具：JS 脚本激活器 (供所有 App 使用)
function executeScriptsInElement(element) {
    // 1. 激活 <script> 标签
    const scripts = element.querySelectorAll('script');
    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    // 2. 激活 <audio> 元素 — 重新创建以确保浏览器识别
    const audios = element.querySelectorAll('audio');
    audios.forEach(oldAudio => {
        const newAudio = oldAudio.cloneNode(true);
        oldAudio.parentNode.replaceChild(newAudio, oldAudio);
        newAudio.load(); // 强制加载音频源
    });

    // 3. 修复 onclick 字符串属性的按钮/元素（innerHTML 不会自动绑定）
    element.querySelectorAll('[onclick]').forEach(el => {
        const handler = el.getAttribute('onclick');
        el.classList.add('wc-rich-clickable');
        el.dataset.wcRichClick = '1';
        el.dataset.wcRichOriginalOnclick = handler || '';
        el.removeAttribute('onclick');
        el.addEventListener('click', function(e) {
            const isDecryptHandler = /decryptContent/i.test(handler || '');
            if (isDecryptHandler && decryptWechatRichSection(this)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            const isModalHandler = /showModal|secretModal|hideModal|closeModal/i.test(handler || '');
            if (isModalHandler && openWechatRichModal(this, element)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            try {
                const result = new Function('event', `with (this) { ${handler} }`).call(this, e);
                if (result === false) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            } catch(err) {
                console.warn('onclick eval error:', err);
                if (isModalHandler) {
                    openWechatRichModal(this, element);
                }
            }
        });
    });

    bindWechatRichRevealFallbacks(element);
    bindWechatRichDetailsFallbacks(element);
}

// --- 🚀 微信发送消息（只发送；点闪光按钮才触发AI） ---
function sendWechatMessage() {
    if (window._wechatAiBusy) return;
    const inputEl = document.getElementById('wc-msg-input');
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;

    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    inputEl.value = '';
    syncWechatDraftState();
    closeChatToolbar();

    const userMsg = buildWechatUserTextMessage(text);
    if (window._wechatReplyDraft) {
        userMsg.replyTo = { ...window._wechatReplyDraft };
        clearWechatReplyDraft();
    }
    if (!char.history) char.history = [];
    char.history.push(userMsg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    notifyWechatMonitors(char, userMsg);
    maybeCaptureWechatMemoryCommand(char, text);
    if (typeof window.captureMoneyExpensesFromText === 'function') {
        window.captureMoneyExpensesFromText(text, {
            source: 'wechat',
            charId: char.id,
            charName: (char.chatConfig && char.chatConfig.nickname) || char.name || ''
        });
    }

    refreshChatView(char);
    saveCharactersToStorage();
    renderChatList();
}

// --- ✨ AI 回复按钮（点击才触发AI回复） ---
async function triggerAiReply() {
    if (window._wechatAiBusy) return;
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    const inputEl = document.getElementById('wc-msg-input');
    const text = inputEl ? inputEl.value.trim() : '';
    const contentEl = document.getElementById('chat-room-content');
    if (!char.history) char.history = [];

    // 如果输入框有文字，先发送
    if (text) {
        inputEl.value = '';
        syncWechatDraftState();
        const userMsg = buildWechatUserTextMessage(text);
        if (window._wechatReplyDraft) {
            userMsg.replyTo = { ...window._wechatReplyDraft };
            clearWechatReplyDraft();
        }
        char.history.push(userMsg);
        if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
        notifyWechatMonitors(char, userMsg);
        maybeCaptureWechatMemoryCommand(char, text);
        if (typeof window.captureMoneyExpensesFromText === 'function') {
            window.captureMoneyExpensesFromText(text, {
                source: 'wechat',
                charId: char.id,
                charName: (char.chatConfig && char.chatConfig.nickname) || char.name || ''
            });
        }
        refreshChatView(char);
        saveCharactersToStorage();
        renderChatList();
    }

    closeChatToolbar();
    await triggerAiAfterMessage(char, contentEl);
}

// --- 共享AI调用逻辑 ---
async function triggerAiAfterMessage(char, contentEl) {
    if (window._wechatAiBusy) return;
    window._wechatAiBusy = true;
    setWechatBusyState(true);

    // 标题栏显示"对方正在输入..."
    const titleEl = document.getElementById('wc-float-name') || document.getElementById('chat-room-title');
    const originalTitle = titleEl ? titleEl.textContent : '';
    if (titleEl) titleEl.textContent = '对方正在输入...';

    try {
        // 构建消息并调用API
        const messages = buildMessages(char, char.history || []);
        const result = await callChatApi(messages);

        // 恢复标题，备注可能会在 AI 指令里被角色主动修改。
        if (titleEl) titleEl.textContent = getWechatCharDisplayName(char);

        if (result.ok) {
            if (markPendingUserPaymentsCollected(char)) {
                refreshChatView(char);
            }
            const parts = splitWechatAiResponseSegments(result.content, char);
            let newAiMessageCount = 0;
            for (let i = 0; i < parts.length; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
                let text = parts[i];
                const avatarMatch = text.match(/\[换头像[：:](\d+)\]/);
                if (avatarMatch && char.avatarGallery && char.avatarGallery.length > 1) {
                    const idx = parseInt(avatarMatch[1]) - 1;
                    if (idx >= 0 && idx < char.avatarGallery.length) {
                        char.avatar = char.avatarGallery[idx];
                    }
                    text = text.replace(/\[换头像[：:]\d+\]/, '').trim();
                }
                if (!text) continue;
                newAiMessageCount += appendWechatAiMessageParts(char, contentEl, text) || 0;
            }
            if (newAiMessageCount > 0) showWechatDesktopMessageIsland(char);
            requestWechatAiStatusSnapshot(char, { reason: 'after_reply' }).catch(e => {
                console.warn('ai status snapshot failed:', e);
            });
            scheduleWechatMemoryExtraction(char, 'after_reply');
        } else {
            const errMsg = { type: 'text', isMe: false, content: `⚠️ ${result.error}`, timestamp: createMessageTimestamp() };
            char.history.push(errMsg);
            refreshChatView(char);
        }

        contentEl.scrollTop = contentEl.scrollHeight;
        saveCharactersToStorage();
        renderChatList();
    } finally {
        if (titleEl) titleEl.textContent = getWechatCharDisplayName(char);
        setWechatBusyState(false);
        window._wechatAiBusy = false;
    }
}

function syncWechatDraftState() {
    const room = document.getElementById('wechat-chat-room');
    const inputEl = document.getElementById('wc-msg-input');
    if (!room || !inputEl) return;
    room.classList.toggle('has-draft', !!inputEl.value.trim());
}

function isWechatVoiceInputMode() {
    return !!document.getElementById('wechat-chat-room')?.classList.contains('is-voice-input');
}

function setWechatVoiceToolMode(mode) {
    const nextMode = mode === 'tts' ? 'tts' : 'speech';
    document.querySelectorAll('.wc-voice-mode-tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === nextMode);
    });
    document.getElementById('wc-voice-speech-panel')?.classList.toggle('hidden', nextMode !== 'speech');
    document.getElementById('wc-voice-tts-panel')?.classList.toggle('hidden', nextMode !== 'tts');
    const status = document.getElementById('wc-voice-status');
    if (status) status.textContent = nextMode === 'tts' ? '输入文字后发送成语音气泡' : '按住底栏按钮说话，松开发送';
}

function setWechatVoiceInputMode(active, options = {}) {
    const room = document.getElementById('wechat-chat-room');
    const panel = document.getElementById('wc-voice-mode-panel');
    const pressBtn = document.getElementById('wc-voice-press-btn');
    const inputEl = document.getElementById('wc-msg-input');
    const icon = document.getElementById('wc-voice-toggle-icon');
    if (!room) return;
    room.classList.toggle('is-voice-input', !!active);
    if (panel) panel.classList.toggle('hidden', !active);
    if (pressBtn) pressBtn.classList.toggle('hidden', !active);
    if (icon) icon.className = active ? 'ri-keyboard-line' : 'ri-mic-line';
    if (active) {
        closeChatToolbar();
        closeStickerPicker();
        inputEl?.blur();
        setWechatVoiceToolMode('speech');
    } else if (!options.keepDraft) {
        cancelWechatHoldVoice();
    }
    syncWechatDraftState();
}

function toggleWechatVoiceInputMode(force) {
    const active = typeof force === 'boolean' ? force : !isWechatVoiceInputMode();
    setWechatVoiceInputMode(active);
}

function clearWechatVoiceDraft() {
    const speech = document.getElementById('wc-voice-recognized-text');
    const tts = document.getElementById('wc-voice-tts-input');
    if (speech) speech.value = '';
    if (tts) tts.value = '';
    const status = document.getElementById('wc-voice-status');
    if (status) status.textContent = '按住底栏按钮说话，松开发送';
}

function startWechatHoldVoice(event) {
    if (window._wechatAiBusy) return;
    const btn = event?.currentTarget || document.getElementById('wc-voice-press-btn');
    if (!btn) return;
    if (event && btn.setPointerCapture && event.pointerId != null) {
        try { btn.setPointerCapture(event.pointerId); } catch (e) {}
    }
    window._wechatVoiceHold = {
        startedAt: Date.now(),
        pointerId: event?.pointerId ?? null,
        cancelled: false
    };
    btn.classList.add('is-recording');
    btn.textContent = '松开 发送';
    const status = document.getElementById('wc-voice-status');
    if (status) status.textContent = '正在说话，松开发送';
}

function maybeCancelWechatHoldVoice(event) {
    const hold = window._wechatVoiceHold;
    if (!hold || hold.pointerId == null || event?.buttons) return;
    cancelWechatHoldVoice(event);
}

function cancelWechatHoldVoice(event) {
    const btn = document.getElementById('wc-voice-press-btn');
    if (event && btn?.releasePointerCapture && event.pointerId != null) {
        try { btn.releasePointerCapture(event.pointerId); } catch (e) {}
    }
    window._wechatVoiceHold = null;
    if (btn) {
        btn.classList.remove('is-recording');
        btn.textContent = '按住 说话';
    }
    const status = document.getElementById('wc-voice-status');
    if (status) status.textContent = '已取消，按住底栏按钮重新说话';
}

function finishWechatHoldVoice(event) {
    const hold = window._wechatVoiceHold;
    const btn = document.getElementById('wc-voice-press-btn');
    if (!hold) return;
    if (event && btn?.releasePointerCapture && event.pointerId != null) {
        try { btn.releasePointerCapture(event.pointerId); } catch (e) {}
    }
    const elapsed = Math.max(1, Math.min(90, Math.round((Date.now() - hold.startedAt) / 1000) || 1));
    window._wechatVoiceHold = null;
    if (btn) {
        btn.classList.remove('is-recording');
        btn.textContent = '按住 说话';
    }
    const transcriptEl = document.getElementById('wc-voice-recognized-text');
    const transcript = (transcriptEl?.value || '').trim();
    appendWechatMessage({
        type: 'voice',
        isMe: true,
        duration: transcript ? estimateWechatVoiceDuration(transcript) : elapsed,
        transcript,
        content: transcript || `[语音 ${formatWechatDuration(elapsed)}]`,
        timestamp: createMessageTimestamp()
    });
    if (transcriptEl) transcriptEl.value = '';
    const status = document.getElementById('wc-voice-status');
    if (status) status.textContent = '已发送语音';
}

function sendWechatTypedVoice() {
    const input = document.getElementById('wc-voice-tts-input');
    const text = (input?.value || '').trim();
    if (!text) {
        if (typeof showWechatToast === 'function') showWechatToast('先输入要转成语音的文字');
        return;
    }
    appendWechatMessage({
        type: 'voice',
        isMe: true,
        duration: estimateWechatVoiceDuration(text),
        transcript: text,
        content: text,
        timestamp: createMessageTimestamp()
    });
    if (input) input.value = '';
    const status = document.getElementById('wc-voice-status');
    if (status) status.textContent = '已发送文字转语音';
}

function startWechatSpeechRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const target = document.getElementById('wc-voice-recognized-text');
    const status = document.getElementById('wc-voice-status');
    if (!Recognition || !target) {
        if (status) status.textContent = '当前浏览器不支持实时语音转文字，可直接按住说话发送语音';
        if (typeof showWechatToast === 'function') showWechatToast('当前浏览器不支持实时语音转文字');
        return;
    }
    try {
        if (window._wechatSpeechRecognition) {
            window._wechatSpeechRecognition.stop();
            window._wechatSpeechRecognition = null;
        }
        const recognition = new Recognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.onresult = event => {
            let finalText = '';
            let interimText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const part = event.results[i][0]?.transcript || '';
                if (event.results[i].isFinal) finalText += part;
                else interimText += part;
            }
            target.value = (target.value.replace(/\s*…[^\n]*$/g, '') + finalText + (interimText ? `…${interimText}` : '')).trim();
        };
        recognition.onstart = () => { if (status) status.textContent = '正在转文字...'; };
        recognition.onend = () => { if (status) status.textContent = '转文字结束，可按住发送语音'; window._wechatSpeechRecognition = null; };
        recognition.onerror = () => { if (status) status.textContent = '转文字失败，可直接按住发送语音'; };
        window._wechatSpeechRecognition = recognition;
        recognition.start();
    } catch (e) {
        if (status) status.textContent = '转文字启动失败，可直接按住发送语音';
    }
}

function setWechatBusyState(isBusy) {
    const inputEl = document.getElementById('wc-msg-input');
    const sendBtn = document.querySelector('.wc-send-btn');
    const aiBtn = document.querySelector('.wc-ai-btn');
    const voiceBtn = document.querySelector('.wc-voice-btn');
    const stickerBtn = document.querySelector('.wc-sticker-btn');
    const addBtn = document.querySelector('.wc-add-btn');
    if (inputEl) {
        inputEl.disabled = isBusy;
        inputEl.placeholder = isBusy ? '对方正在输入...' : getWechatChatInputPlaceholder();
    }
    const pressBtn = document.getElementById('wc-voice-press-btn');
    [sendBtn, aiBtn, voiceBtn, stickerBtn, addBtn, pressBtn].forEach(btn => {
        if (!btn) return;
        btn.classList.toggle('is-disabled', isBusy);
        btn.style.pointerEvents = isBusy ? 'none' : '';
    });
    syncWechatDraftState();
}

// --- 工具栏开关 ---
function toggleChatToolbar() {
    const toolbar = document.getElementById('wc-chat-toolbar');
    const picker = document.getElementById('wc-sticker-picker');
    if (picker && !picker.classList.contains('hidden')) picker.classList.add('hidden');
    if (isWechatVoiceInputMode()) setWechatVoiceInputMode(false, { keepDraft: true });
    toolbar.classList.toggle('hidden');
    const addBtn = document.querySelector('.wc-add-btn');
    if (addBtn) addBtn.classList.toggle('is-open', !toolbar.classList.contains('hidden'));
}

function closeChatToolbar() {
    const toolbar = document.getElementById('wc-chat-toolbar');
    if (toolbar && !toolbar.classList.contains('hidden')) toolbar.classList.add('hidden');
    const addBtn = document.querySelector('.wc-add-btn');
    if (addBtn) addBtn.classList.remove('is-open');
    const picker = document.getElementById('wc-sticker-picker');
    if (picker && !picker.classList.contains('hidden')) picker.classList.add('hidden');
}

function closeChat() {
    const settingsPanel = document.getElementById('wc-chat-settings-panel');
    if (settingsPanel) {
        settingsPanel.classList.remove('active');
        settingsPanel.style.display = 'none';
    }
    closeChatToolbar();
    setWechatVoiceInputMode(false, { keepDraft: true });
    const room = document.getElementById('wechat-chat-room');
    if (room) {
        room.classList.remove('active');
        setTimeout(() => room.classList.add('hidden'), 300);
    }
    window.currentChatCharId = null;
}

// --- 微信语音/视频通话 ---
function getWechatCallLabel(type) {
    return type === 'videoCall' ? '视频通话' : '语音通话';
}

function getWechatCallIcon(type) {
    return type === 'videoCall' ? 'ri-video-chat-fill' : 'ri-phone-fill';
}

function isWechatIncomingCallMessage(msg) {
    return msg && (msg.type === 'voiceCall' || msg.type === 'videoCall') && msg.isMe === false && msg.status === '来电';
}

function isWechatChatPageActive(charId) {
    const win = document.getElementById('app-wechat-window');
    const room = document.getElementById('wechat-chat-room');
    return !!(win && room && win.classList.contains('active') && !win.classList.contains('hidden') && room.classList.contains('active') && window.currentChatCharId === charId);
}

function isByndDesktopVisible() {
    const home = document.getElementById('home-screen');
    const activeWindow = document.querySelector('.app-window.active:not(.hidden)');
    return !!(home && !home.classList.contains('hidden') && !activeWindow);
}

function playWechatMessageIslandTone() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = window._wechatMessageIslandAudioCtx || new AudioCtx();
        window._wechatMessageIslandAudioCtx = ctx;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        [660, 880].forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, now + index * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.045, now + index * 0.09 + 0.016);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.13);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + index * 0.09);
            osc.stop(now + index * 0.09 + 0.15);
        });
    } catch (e) {}
}

function showWechatDesktopMessageIsland(char) {
    if (!char || isWechatChatPageActive(char.id) || !isByndDesktopVisible()) return;
    const host = getWechatModalRoot();
    let island = document.getElementById('wc-message-island');
    if (!island) {
        island = document.createElement('div');
        island.id = 'wc-message-island';
        island.className = 'wc-message-island';
        host.appendChild(island);
    }
    const name = getWechatCharDisplayName(char);
    const preview = getChatPreview(char).replace(/\s+/g, ' ').slice(0, 42);
    island.innerHTML = `
        <div class="wc-message-island-main">
            <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
            <div class="wc-message-island-text">
                <strong>${wcEscapeHtml(name)}</strong>
                <span>${wcEscapeHtml(preview || '发来一条消息')}</span>
            </div>
        </div>
        <i class="ri-wechat-line"></i>
    `;
    island.onclick = () => {
        island.classList.remove('show');
        if (typeof openApp === 'function') openApp('wechat');
        setTimeout(() => openChat(char.id), 80);
    };
    clearTimeout(window._wechatMessageIslandTimer);
    island.classList.remove('show');
    requestAnimationFrame(() => island.classList.add('show'));
    playWechatMessageIslandTone();
    window._wechatMessageIslandTimer = setTimeout(() => {
        island.classList.remove('show');
    }, 5200);
}

const WECHAT_MONITOR_COOLDOWN_MS = 14000;
const WECHAT_MONITOR_MAX_WATCHERS = 3;
const WECHAT_MONITOR_LEVELS = ['silent', 'island', 'barrage', 'warning'];
const WECHAT_MONITOR_MODE_LABELS = {
    persona: '按角色人设',
    observer: '第三视角吐槽'
};
window._wechatMonitorLastRequestAt = window._wechatMonitorLastRequestAt || {};

function getWechatMonitorEventId(targetChar, msg) {
    if (!msg) return '';
    if (!msg.monitorEventId) {
        msg.monitorEventId = `mon_${targetChar?.id || 'chat'}_${msg.timestamp || Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    return msg.monitorEventId;
}

function isWechatMonitorableUserMessage(msg) {
    if (!msg || msg.isMe !== true || msg.monitorEvent || msg.type === 'system_notice') return false;
    return ['text', 'image', 'sticker', 'voice', 'transfer', 'redpacket', 'gift', 'intimatePay', 'voiceCall', 'videoCall'].includes(msg.type || 'text');
}

function getWechatMonitorState(char) {
    char.chatConfig = char.chatConfig || {};
    const state = char.chatConfig.monitorState && typeof char.chatConfig.monitorState === 'object'
        ? char.chatConfig.monitorState
        : {};
    state.processedIds = Array.isArray(state.processedIds) ? state.processedIds.slice(-40) : [];
    char.chatConfig.monitorState = state;
    return state;
}

function getWechatMonitorMode(char) {
    const mode = char && char.chatConfig && char.chatConfig.monitorMode;
    if (mode === 'god' || mode === 'cp') return 'observer';
    return Object.prototype.hasOwnProperty.call(WECHAT_MONITOR_MODE_LABELS, mode) ? mode : 'persona';
}

function getWechatMonitorModePrompt(mode) {
    if (mode === 'observer') return '采用第三视角吐槽，包含上帝视角、磕糖观众和看剧弹幕感：像观众在看 user 和角色演出的剧，轻松点评、捕捉误会和张力，可以好嗑、吐槽、旁白，但不要攻击用户，也不要走控制或威胁路线。';
    return '采用角色本人视角，必须贴合角色卡、人设、关系和记忆，可吃味、嘴硬或吐槽，但默认是娱乐化反应，不要偏激。';
}

function getWechatMonitorWatchers(targetChar) {
    const targetId = targetChar && targetChar.id;
    return (window.myCharacters || [])
        .filter(char => char && char.id !== targetId && !char.isGroupChat && char.chatConfig && char.chatConfig.monitorEnabled)
        .slice(0, WECHAT_MONITOR_MAX_WATCHERS);
}

function notifyWechatMonitors(targetChar, userMsg) {
    if (!targetChar || !isWechatMonitorableUserMessage(userMsg)) return;
    const watchers = getWechatMonitorWatchers(targetChar);
    if (!watchers.length) return;
    const eventId = getWechatMonitorEventId(targetChar, userMsg);
    watchers.forEach((watcher, index) => {
        window.setTimeout(() => {
            requestWechatMonitorReaction(watcher, targetChar, userMsg, eventId).catch(err => {
                console.warn('wechat monitor reaction failed:', err);
            });
        }, index * 700);
    });
}

function buildWechatMonitorMessages(watcher, targetChar, userMsg) {
    const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(targetChar) : ((typeof getUserProfile === 'function') ? getUserProfile() : { name: '用户' });
    const byndContacts = (window.myCharacters || [])
        .filter(char => char && !char.isGroupChat)
        .map(char => getWechatCharDisplayName(char))
        .filter(Boolean);
    const watcherName = getWechatCharDisplayName(watcher);
    const targetName = getWechatCharDisplayName(targetChar);
    const observed = stripWechatPromptText(getWechatMessagePromptContent(userMsg), 520);
    const watcherHistory = buildWechatRecentHistoryForPrompt(watcher, 10);
    const targetHistory = buildWechatRecentHistoryForPrompt(targetChar, 10);
    const watcherWorldBook = buildWechatWorldBookPrompt(watcher, 30);
    const memoryAnchor = typeof buildWechatMemoryPrompt === 'function' ? buildWechatMemoryPrompt(watcher) : '';
    const monitorMode = getWechatMonitorMode(watcher);
    const monitorModeLabel = WECHAT_MONITOR_MODE_LABELS[monitorMode] || WECHAT_MONITOR_MODE_LABELS.persona;
    const monitorModePrompt = getWechatMonitorModePrompt(monitorMode);
    const systemPrompt = typeof buildSystemPrompt === 'function'
        ? buildSystemPrompt(watcher)
        : `你是「${watcher.name || watcherName}」。请保持角色设定。`;

    return [
        {
            role: 'system',
            content: systemPrompt
        },
        {
            role: 'system',
            content: `这是 BYND 应用内部的虚构娱乐剧情功能「监控」，只允许观察 BYND 内部微信角色聊天记录，不能声称访问真实手机联系人、真实微信、系统短信或外部设备。你正在以「${watcherName}」的身份看到用户刚刚给另一个 BYND 角色「${targetName}」发的消息。监控吐槽视角：${monitorModeLabel}。${monitorModePrompt} 请按人设、关系、世界书、记忆和当前聊天气氛反应。不要写极端威胁、封锁、强控制、恐吓、惩罚或黑客攻击；本质是像观众看剧一样的弹幕吐槽、磕糖、吃味、嘴硬或旁白。只返回 JSON，不要 Markdown，不要解释。JSON 字段：level, island, warning, barrage, deleteContact。level 只能是 silent/island/barrage/warning。island 是灵动岛短句 8-30 字；warning 是弹窗提示 12-70 字；barrage 是 0-10 条随机飞字短句数组。deleteContact 可为空；如果角色按人设强烈想删除某个 BYND 内部联系人，返回 {"name":"联系人名或备注","reason":"原因"}，系统会弹窗征求用户允许。普通消息可 silent/island；有戏剧张力时优先用 barrage，像观众刷弹幕；只有用户明确要求严肃提醒或剧情已经非常尖锐时才 warning。`
        },
        {
            role: 'user',
            content: `用户：${userProfile.name || '用户'}\nBYND 内部联系人数量：${byndContacts.length}\nBYND 联系人：${byndContacts.slice(0, 24).join('、') || '暂无'}\n监控角色：${watcherName}\n被观察聊天对象：${targetName}\n监控吐槽视角：${monitorModeLabel}\n${watcherWorldBook ? `${watcherWorldBook}\n` : ''}${memoryAnchor ? `${memoryAnchor}\n` : ''}用户刚刚发给 ${targetName} 的消息：${observed || '[非文字消息]'}\n\n${watcherName} 与用户最近聊天：\n${watcherHistory}\n\n用户与 ${targetName} 最近聊天：\n${targetHistory}`
        }
    ];
}

function normalizeWechatMonitorLevel(level) {
    const text = String(level || '').trim().toLowerCase();
    return WECHAT_MONITOR_LEVELS.includes(text) ? text : 'island';
}

function getWechatMonitorLevelIndex(level) {
    return Math.max(0, WECHAT_MONITOR_LEVELS.indexOf(normalizeWechatMonitorLevel(level)));
}

function normalizeWechatMonitorReaction(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const level = normalizeWechatMonitorLevel(raw.level);
    const island = stripWechatPromptText(raw.island || raw.message || raw.text || '', 42);
    const warning = stripWechatPromptText(raw.warning || raw.warn || island || '', 90);
    const barrage = Array.isArray(raw.barrage)
        ? raw.barrage.map(item => stripWechatPromptText(item, 32)).filter(Boolean).slice(0, 10)
        : [];
    const deleteRaw = raw.deleteContact && typeof raw.deleteContact === 'object' ? raw.deleteContact : null;
    const deleteContact = deleteRaw ? {
        name: stripWechatPromptText(deleteRaw.name || deleteRaw.target || '', 36),
        reason: stripWechatPromptText(deleteRaw.reason || '', 80)
    } : null;
    if (level !== 'silent' && !island && !warning && !barrage.length && !(deleteContact && deleteContact.name)) return null;
    return { level, island, warning, barrage, deleteContact };
}

function escalateWechatMonitorLevel(state, reaction, targetChar) {
    let level = reaction.level;
    const now = Date.now();
    const sameTarget = state.lastTargetId === targetChar.id && state.lastAt && now - state.lastAt < 10 * 60 * 1000;
    const suspicion = sameTarget ? Math.min(10, Number(state.suspicion || 0) + Math.max(1, getWechatMonitorLevelIndex(level))) : getWechatMonitorLevelIndex(level);
    if (sameTarget && suspicion >= 3 && getWechatMonitorLevelIndex(level) < getWechatMonitorLevelIndex('barrage')) level = 'barrage';
    state.suspicion = suspicion;
    state.lastTargetId = targetChar.id;
    state.lastAt = now;
    state.lastLevel = level;
    return level;
}

async function requestWechatMonitorReaction(watcher, targetChar, userMsg, eventId) {
    if (!watcher || !targetChar || !eventId || typeof callChatApi !== 'function') return;
    const state = getWechatMonitorState(watcher);
    if (state.processedIds.includes(eventId)) return;
    const requestKey = `${watcher.id}:${targetChar.id}`;
    const now = Date.now();
    if (window._wechatMonitorLastRequestAt[requestKey] && now - window._wechatMonitorLastRequestAt[requestKey] < WECHAT_MONITOR_COOLDOWN_MS) {
        return;
    }
    window._wechatMonitorLastRequestAt[requestKey] = now;

    const result = await callChatApi(buildWechatMonitorMessages(watcher, targetChar, userMsg));
    if (!result || !result.ok) {
        state.lastError = (result && result.error) || '监控剧情 API 调用失败';
        saveCharactersToStorage();
        return;
    }

    const reaction = normalizeWechatMonitorReaction(parseWechatJsonObject(result.content));
    if (!reaction) {
        state.lastError = '监控剧情 API 没有返回可解析 JSON';
        saveCharactersToStorage();
        return;
    }

    const level = escalateWechatMonitorLevel(state, reaction, targetChar);
    state.processedIds.push(eventId);
    state.processedIds = state.processedIds.slice(-40);
    state.lastError = '';
    appendWechatMonitorRecord(watcher, targetChar, userMsg, reaction, level);
    maybeApplyWechatMonitorContactDelete(watcher, reaction);
    saveCharactersToStorage();
    renderChatList();
    if (window.currentChatCharId === watcher.id) refreshChatView(watcher);
    presentWechatMonitorReaction(watcher, targetChar, reaction, level);
}

function appendWechatMonitorRecord(watcher, targetChar, userMsg, reaction, level) {
    const text = reaction.warning || reaction.island || reaction.barrage[0] || '';
    if (!text) return;
    const targetName = getWechatCharDisplayName(targetChar);
    const observed = getWechatMessagePlainSummary(userMsg, 80);
    if (!watcher.history) watcher.history = [];
    watcher.history.push({
        type: 'text',
        isMe: false,
        content: `【旁观吐槽：你和${targetName}】${text}`,
        description: `[监控] 看到你发给${targetName}：${observed}`,
        monitorEvent: true,
        monitorLevel: level,
        monitorTargetId: targetChar.id,
        timestamp: createMessageTimestamp()
    });
}


function maybeApplyWechatMonitorContactDelete(watcher, reaction) {
    const request = reaction && reaction.deleteContact;
    if (!watcher || !request || !request.name) return;
    const msg = applyWechatContactDeleteDirective(`${request.name}|${request.reason || '监控剧情触发'}`, watcher);
    if (!msg) return;
    if (!watcher.history) watcher.history = [];
    watcher.history.push(msg);
}

function presentWechatMonitorReaction(watcher, targetChar, reaction, level) {
    if (level === 'silent') return;
    const islandText = reaction.island || reaction.warning || reaction.barrage[0] || '我看见了。';
    showWechatMonitorIsland(watcher, targetChar, islandText);
    if (level === 'warning') {
        showWechatMonitorWarning(watcher, reaction.warning || islandText);
    }
    if (['barrage', 'warning'].includes(level)) {
        const basePhrases = reaction.barrage.length ? reaction.barrage : [islandText, reaction.warning || islandText];
        showWechatMonitorBarrage(watcher, buildWechatMonitorBarrageBurst(basePhrases, level));
    }
    if (navigator.vibrate && ['warning', 'barrage'].includes(level)) {
        navigator.vibrate([45, 25, 65]);
    }
}

function showWechatMonitorIsland(watcher, targetChar, text) {
    if (!watcher || isWechatChatPageActive(watcher.id)) return;
    const host = getWechatModalRoot();
    let island = document.getElementById('wc-monitor-island');
    if (!island) {
        island = document.createElement('div');
        island.id = 'wc-monitor-island';
        island.className = 'wc-message-island wc-monitor-island';
        host.appendChild(island);
    }
    const watcherName = getWechatCharDisplayName(watcher);
    const targetName = getWechatCharDisplayName(targetChar);
    island.innerHTML = `
        <div class="wc-message-island-main">
            <img src="${wcEscapeHtml(watcher.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
            <div class="wc-message-island-text">
                <strong>${wcEscapeHtml(watcherName)} 发来吐槽</strong>
                <span>${wcEscapeHtml(targetName)} · ${wcEscapeHtml(text)}</span>
            </div>
        </div>
        <i class="ri-eye-line"></i>
    `;
    island.onclick = () => {
        island.classList.remove('show');
        if (typeof openApp === 'function') openApp('wechat');
        setTimeout(() => openChat(watcher.id), 80);
    };
    clearTimeout(window._wechatMonitorIslandTimer);
    island.classList.remove('show');
    requestAnimationFrame(() => island.classList.add('show'));
    playWechatMessageIslandTone();
    window._wechatMonitorIslandTimer = setTimeout(() => island.classList.remove('show'), 6200);
}

function showWechatMonitorWarning(watcher, text) {
    const host = getWechatModalRoot();
    let modal = document.getElementById('wc-monitor-warning');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-monitor-warning';
        modal.className = 'wc-monitor-warning';
        host.appendChild(modal);
    }
    const name = getWechatCharDisplayName(watcher);
    modal.innerHTML = `
        <div class="wc-monitor-card">
            <div class="wc-monitor-card-head">
                <img src="${wcEscapeHtml(watcher.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div><strong>${wcEscapeHtml(name)}</strong><span>监控剧情警告</span></div>
            </div>
            <p>${wcEscapeHtml(text)}</p>
            <div class="wc-monitor-card-actions">
                <button type="button" onclick="document.getElementById('wc-monitor-warning')?.classList.remove('show')">知道了</button>
                <button type="button" class="primary" onclick="openWechatMonitorChat(${quoteWechatJsString(watcher.id)})">去找TA</button>
            </div>
        </div>
    `;
    requestAnimationFrame(() => modal.classList.add('show'));
}

function openWechatMonitorChat(charId) {
    document.getElementById('wc-monitor-warning')?.classList.remove('show');
    document.getElementById('wc-monitor-lockdown')?.remove();
    if (typeof openApp === 'function') openApp('wechat');
    setTimeout(() => openChat(charId), 80);
}

function showWechatMonitorBarrage(watcher, phrases) {
    const host = getWechatModalRoot();
    const old = document.getElementById('wc-monitor-barrage');
    if (old) old.remove();
    const barrage = document.createElement('div');
    barrage.id = 'wc-monitor-barrage';
    barrage.className = 'wc-monitor-barrage';
    const safePhrases = (phrases || []).filter(Boolean).slice(0, 16);
    barrage.innerHTML = safePhrases.map((phrase, index) => `
        <span style="--i:${index};--top:${12 + Math.round(Math.random() * 66)}%;--dur:${4.8 + Math.random() * 1.7}s;">${wcEscapeHtml(phrase)}</span>
    `).join('');
    host.appendChild(barrage);
    setTimeout(() => barrage.remove(), 7600);
}

function showWechatMonitorLockdown(watcher, text) {
    const host = getWechatModalRoot();
    document.getElementById('wc-monitor-lockdown')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'wc-monitor-lockdown';
    overlay.className = 'wc-monitor-lockdown';
    const name = getWechatCharDisplayName(watcher);
    const lines = Array.from({ length: 14 }, (_, index) => {
        const seed = `${watcher.id || 'bynd'}${Date.now()}${index}`;
        const code = Array.from(seed).reduce((sum, ch) => sum + ch.charCodeAt(0), 0).toString(16).toUpperCase();
        return `<span>BYND/MONITOR/${String(index + 1).padStart(2, '0')} :: ${wcEscapeHtml(code)} :: ${wcEscapeHtml(text).slice(0, 34)}</span>`;
    }).join('');
    overlay.innerHTML = `
        <div class="wc-monitor-noise">${lines}</div>
        <div class="wc-monitor-lock-card">
            <img src="${wcEscapeHtml(watcher.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
            <strong>${wcEscapeHtml(name)} 已接管屏幕</strong>
            <p>${wcEscapeHtml(text)}</p>
            <button type="button" onpointerdown="startWechatMonitorUnlockHold(this)" onpointerup="cancelWechatMonitorUnlockHold()" onpointerleave="cancelWechatMonitorUnlockHold()">长按解除</button>
        </div>
    `;
    host.appendChild(overlay);
}

function startWechatMonitorUnlockHold(button) {
    if (button) button.classList.add('holding');
    clearTimeout(window._wechatMonitorUnlockTimer);
    window._wechatMonitorUnlockTimer = setTimeout(() => {
        document.getElementById('wc-monitor-lockdown')?.remove();
        clearTimeout(window._wechatMonitorUnlockTimer);
    }, 1100);
}

function cancelWechatMonitorUnlockHold() {
    document.querySelector('#wc-monitor-lockdown button')?.classList.remove('holding');
    clearTimeout(window._wechatMonitorUnlockTimer);
}

function buildWechatCallEvent(char, msg, direction) {
    return {
        id: Date.now(),
        type: msg.type,
        charId: char.id,
        direction,
        startedAt: msg.timestamp || createMessageTimestamp(),
        acceptedAt: null,
        reason: msg.reason || msg.note || '',
        lines: [],
        ended: false
    };
}

function ensureWechatCallScreen() {
    let screen = document.getElementById('wc-call-screen');
    if (screen) return screen;
    screen = document.createElement('div');
    screen.id = 'wc-call-screen';
    screen.className = 'wc-call-screen hidden';
    screen.innerHTML = `
        <div class="wc-call-bg"><img id="wc-call-bg-img" src="" alt=""></div>
        <div class="wc-call-shade"></div>
        <video id="wc-call-camera-preview" class="wc-call-camera-preview hidden" autoplay muted playsinline></video>
        <div id="wc-call-ai-portrait" class="wc-call-ai-portrait hidden">
            <img id="wc-call-ai-portrait-img" src="" alt="">
            <span id="wc-call-ai-portrait-status">正在生成 AI 画面...</span>
        </div>
        <div class="wc-call-top">
            <img class="wc-call-avatar" id="wc-call-avatar" src="" alt="">
            <div class="wc-call-name" id="wc-call-name"></div>
            <div class="wc-call-status" id="wc-call-status">正在呼叫...</div>
            <div class="wc-call-timer hidden" id="wc-call-timer">00:00</div>
        </div>
        <div class="wc-call-log" id="wc-call-log"></div>
        <div class="wc-call-inputbar hidden" id="wc-call-inputbar">
            <input id="wc-call-input" type="text" placeholder="通话中说点什么..." onkeydown="if(event.key==='Enter'){event.preventDefault();sendWechatCallMessage();}">
            <button type="button" onclick="sendWechatCallMessage()"><i class="ri-send-plane-2-fill"></i></button>
        </div>
        <div class="wc-call-actions" id="wc-call-actions">
            <button type="button" class="wc-call-tool"><i class="ri-mic-line"></i><span>静音</span></button>
            <button type="button" class="wc-call-end" onclick="endWechatCall()"><i class="ri-phone-fill"></i></button>
            <button type="button" class="wc-call-tool"><i id="wc-call-kind-icon" class="ri-phone-fill"></i><span id="wc-call-kind-label">语音</span></button>
        </div>
    `;
    getWechatModalRoot().appendChild(screen);
    return screen;
}

function ensureWechatIncomingIsland() {
    let island = document.getElementById('wc-call-island');
    if (island) return island;
    island = document.createElement('div');
    island.id = 'wc-call-island';
    island.className = 'wc-call-island hidden';
    island.innerHTML = `
        <div class="wc-call-island-main" onclick="acceptWechatIncomingCall()">
            <img id="wc-call-island-avatar" src="" alt="">
            <div class="wc-call-island-text">
                <strong id="wc-call-island-name"></strong>
                <span id="wc-call-island-label"></span>
            </div>
        </div>
        <div class="wc-call-island-actions">
            <button type="button" class="reject" onclick="event.stopPropagation();rejectWechatIncomingCall()"><i class="ri-close-line"></i></button>
            <button type="button" class="accept" onclick="event.stopPropagation();acceptWechatIncomingCall()"><i class="ri-phone-fill"></i></button>
        </div>
    `;
    getWechatModalRoot().appendChild(island);
    return island;
}

function showWechatIncomingIsland(call) {
    const char = window.myCharacters.find(c => c.id === call.charId);
    if (!char) return;
    const island = ensureWechatIncomingIsland();
    document.getElementById('wc-call-island-avatar').src = char.avatar || DEFAULT_AVATAR;
    document.getElementById('wc-call-island-name').textContent = (char.chatConfig && char.chatConfig.nickname) || char.name;
    document.getElementById('wc-call-island-label').textContent = `来${getWechatCallLabel(call.type)}`;
    island.classList.remove('hidden');
}

function hideWechatIncomingIsland() {
    const island = document.getElementById('wc-call-island');
    if (island) island.classList.add('hidden');
}

function handleWechatIncomingCall(char, msg) {
    const call = buildWechatCallEvent(char, msg, 'incoming');
    window._wechatIncomingCall = call;
    if (isWechatChatPageActive(char.id)) {
        openWechatIncomingCallScreen(call);
    } else {
        showWechatIncomingIsland(call);
    }
}

function getWechatActiveCallChar() {
    const call = window._wechatActiveCall;
    if (!call) return null;
    return window.myCharacters.find(c => c.id === call.charId) || null;
}

function setWechatCallMode(mode) {
    const screen = ensureWechatCallScreen();
    screen.dataset.mode = mode;
    document.getElementById('wc-call-inputbar')?.classList.toggle('hidden', mode !== 'connected');
    document.getElementById('wc-call-timer')?.classList.toggle('hidden', mode !== 'connected');
}

function setWechatCallStatus(text) {
    const statusEl = document.getElementById('wc-call-status');
    if (statusEl) statusEl.textContent = text;
}

function formatWechatCallClock(seconds) {
    const sec = Math.max(0, Math.floor(seconds || 0));
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return `${String(min).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function updateWechatCallTimer() {
    const call = window._wechatActiveCall;
    const timer = document.getElementById('wc-call-timer');
    if (!call || !call.acceptedAt || !timer) return;
    timer.textContent = formatWechatCallClock((Date.now() - call.acceptedAt) / 1000);
}

function addWechatCallLine(role, text) {
    const call = window._wechatActiveCall;
    const log = document.getElementById('wc-call-log');
    const content = String(text || '').trim();
    if (!call || !log || !content) return;
    if (!call.lines) call.lines = [];
    call.lines.push({ role, content });
    const item = document.createElement('div');
    item.className = `wc-call-line ${role}`;
    item.innerHTML = wcEscapeHtml(content).replace(/\n/g, '<br>');
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
}

function parseWechatCallDecision(content) {
    const raw = String(content || '').replace(/\|\|\|/g, ' ').trim();
    const cleaned = raw
        .replace(/\[接听\]/g, '')
        .replace(/\[拒绝[：:]?([^\]]*)\]/g, '$1')
        .trim();
    const refused = /拒绝|不接|不方便|在忙|忙着|挂断|稍后|未接|没法|不能接/.test(raw) && !/接听|接了|可以接|我接|接吧/.test(raw);
    return {
        accepted: !refused,
        message: cleaned
    };
}

async function startWechatCall(type) {
    if (window._wechatAiBusy || window._wechatActiveCall) return;
    const char = getCurrentChatChar();
    if (!char) return;
    closeChatToolbar();
    closeStickerPicker();

    const label = getWechatCallLabel(type);
    const screen = ensureWechatCallScreen();
    window._wechatActiveCall = {
        id: Date.now(),
        type,
        charId: char.id,
        direction: 'outgoing',
        startedAt: Date.now(),
        acceptedAt: null,
        reason: '',
        lines: [],
        ended: false
    };

    setupWechatCallScreen(window._wechatActiveCall, char);
    setWechatCallStatus(`正在邀请对方加入${label}...`);
    screen.classList.remove('hidden');

    await requestWechatCallDecision(window._wechatActiveCall);
}

function setupWechatCallScreen(call, char) {
    ensureWechatCallScreen();
    const config = char.chatConfig || {};
    const bg = call.type === 'videoCall' ? (config.videoCallBg || config.imageReference || char.avatar || DEFAULT_AVATAR) : (char.avatar || DEFAULT_AVATAR);
    document.getElementById('wc-call-bg-img').src = bg;
    document.getElementById('wc-call-avatar').src = char.avatar || DEFAULT_AVATAR;
    document.getElementById('wc-call-name').textContent = (char.chatConfig && char.chatConfig.nickname) || char.name;
    document.getElementById('wc-call-kind-icon').className = getWechatCallIcon(call.type);
    document.getElementById('wc-call-kind-label').textContent = call.type === 'videoCall' ? '视频' : '语音';
    document.getElementById('wc-call-log').innerHTML = '';
    document.getElementById('wc-call-input').value = '';
    const screen = ensureWechatCallScreen();
    screen.classList.toggle('is-video-call', call.type === 'videoCall');
    const camera = document.getElementById('wc-call-camera-preview');
    const portrait = document.getElementById('wc-call-ai-portrait');
    if (camera) camera.classList.add('hidden');
    if (portrait) portrait.classList.toggle('hidden', call.type !== 'videoCall');
    const portraitImg = document.getElementById('wc-call-ai-portrait-img');
    const portraitStatus = document.getElementById('wc-call-ai-portrait-status');
    if (portraitImg) portraitImg.src = config.imageReference || char.avatar || DEFAULT_AVATAR;
    if (portraitStatus) portraitStatus.textContent = call.type === 'videoCall' ? '等待接通后生成 AI 画面' : '';
    setWechatCallMode('ringing');
}

async function requestWechatCallDecision(call) {
    const char = getWechatActiveCallChar();
    if (!call || !char) return;
    window._wechatAiBusy = true;
    setWechatBusyState(true);

    const label = getWechatCallLabel(call.type);
    try {
        const messages = buildMessages(char, char.history || []);
        messages.push({
            role: 'system',
            content: `当前用户正在给你发起${label}。你必须以角色身份决定是否接听。只回复一种格式：[接听]一句接通后的开场白，或 [拒绝:一句拒绝理由]。不要解释格式。`
        });
        messages.push({ role: 'user', content: `我正在给你打${label}，你接吗？` });
        const result = await callChatApi(messages);
        if (window._wechatActiveCall?.id !== call.id || call.ended) return;

        if (!result.ok) {
            setWechatCallStatus('暂时无法接通');
            addWechatCallRecord(call, '未接通', result.error);
            setTimeout(() => closeWechatCallScreen(call.id), 800);
            return;
        }

        const decision = parseWechatCallDecision(result.content);
        if (decision.accepted) {
            acceptWechatCall(call, decision.message);
        } else {
            setWechatCallStatus('对方已拒绝');
            if (decision.message) addWechatCallLine('assistant', decision.message);
            call.reason = decision.message;
            addWechatCallRecord(call, '已拒绝', decision.message);
            setTimeout(() => closeWechatCallScreen(call.id), 1100);
        }
    } finally {
        if (window._wechatActiveCall?.id === call.id) {
            window._wechatAiBusy = false;
            setWechatBusyState(false);
        }
    }
}

function acceptWechatCall(call, firstMessage) {
    if (!call || call.ended) return;
    call.acceptedAt = Date.now();
    setWechatCallMode('connected');
    setWechatCallStatus('通话中');
    updateWechatCallTimer();
    clearInterval(call.timerId);
    call.timerId = setInterval(updateWechatCallTimer, 1000);
    if (firstMessage) addWechatCallLine('assistant', firstMessage);
    const input = document.getElementById('wc-call-input');
    if (input) input.focus();
    if (call.type === 'videoCall') activateWechatVideoCallFeatures(call);
}

async function activateWechatVideoCallFeatures(call) {
    const char = getWechatActiveCallChar();
    if (!call || !char || call.ended) return;
    const config = char.chatConfig || {};
    const portraitStatus = document.getElementById('wc-call-ai-portrait-status');
    const portraitImg = document.getElementById('wc-call-ai-portrait-img');
    if (config.videoCallUseCamera) {
        startWechatCallCameraStream().catch(err => {
            addWechatCallLine('system', '真实相机没有打开：' + (err && err.message ? err.message : '浏览器未授权'));
        });
    }
    if (portraitStatus) portraitStatus.textContent = '正在生成 AI 视频画面...';
    const reference = config.imageReference || char.avatar || '';
    const prompt = [
        `生成${getWechatCharDisplayName(char)}正在视频通话中的实时画面。`,
        '手机竖屏自拍视角，真实光线，表情自然，像正在看着用户说话。',
        char.description ? `角色设定：${char.description.slice(0, 700)}` : '',
        config.signature ? `个性签名/气质：${config.signature}` : ''
    ].filter(Boolean).join('\n');
    const result = await callWechatImageGenerationApi(prompt, { referenceImage: reference, size: '1024x1024' });
    if (window._wechatActiveCall?.id !== call.id || call.ended) return;
    if (result.ok && result.url) {
        if (portraitImg) portraitImg.src = result.url;
        const bgImg = document.getElementById('wc-call-bg-img');
        if (bgImg && !config.videoCallBg) bgImg.src = result.url;
        if (portraitStatus) portraitStatus.textContent = 'AI 画面已生成';
    } else if (portraitStatus) {
        portraitStatus.textContent = result.error ? `生图失败：${String(result.error).slice(0, 42)}` : '未生成 AI 画面';
    }
}

async function startWechatCallCameraStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('当前浏览器不支持真实相机');
    }
    const video = document.getElementById('wc-call-camera-preview');
    if (!video) return;
    stopWechatCallCameraStream();
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
    });
    window._wechatCallCameraStream = stream;
    video.srcObject = stream;
    video.classList.remove('hidden');
}

function stopWechatCallCameraStream() {
    const stream = window._wechatCallCameraStream;
    if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach(track => track.stop());
    }
    window._wechatCallCameraStream = null;
    const video = document.getElementById('wc-call-camera-preview');
    if (video) {
        video.srcObject = null;
        video.classList.add('hidden');
    }
}

function openWechatIncomingCallScreen(call) {
    const char = window.myCharacters.find(c => c.id === call.charId);
    if (!char) return;
    hideWechatIncomingIsland();
    if (typeof openApp === 'function') openApp('wechat');
    if (window.currentChatCharId !== char.id) openChat(char.id);
    window._wechatIncomingCall = null;
    window._wechatActiveCall = call;
    setupWechatCallScreen(call, char);
    ensureWechatCallScreen().classList.remove('hidden');
    acceptWechatCall(call, call.reason);
}

function acceptWechatIncomingCall() {
    const call = window._wechatIncomingCall;
    if (!call || window._wechatActiveCall) return;
    openWechatIncomingCallScreen(call);
}

function rejectWechatIncomingCall() {
    const call = window._wechatIncomingCall;
    if (!call) return;
    hideWechatIncomingIsland();
    addWechatCallRecord(call, '已拒绝', '你已拒绝');
    window._wechatIncomingCall = null;
}

async function sendWechatCallMessage() {
    const call = window._wechatActiveCall;
    const char = getWechatActiveCallChar();
    const input = document.getElementById('wc-call-input');
    if (!call || !char || !input || call.ended || call.busy || !call.acceptedAt) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addWechatCallLine('user', text);

    call.busy = true;
    input.disabled = true;
    setWechatCallStatus('对方正在说话...');
    try {
        const messages = buildMessages(char, char.history || []);
        messages.push({
            role: 'system',
            content: `现在你和用户正在${getWechatCallLabel(call.type)}中。直接回复通话里会说的话，保持自然口语。不要输出微信特殊消息指令，不要写旁白。`
        });
        (call.lines || []).forEach(line => {
            if (line.role === 'user' || line.role === 'assistant') {
                messages.push({ role: line.role, content: line.content });
            }
        });
        const result = await callChatApi(messages);
        if (window._wechatActiveCall?.id !== call.id || call.ended) return;
        if (result.ok) {
            result.content.split('|||').map(s => s.trim()).filter(Boolean).forEach(part => {
                addWechatCallLine('assistant', part.replace(/\[换头像[：:]\d+\]/g, '').trim());
            });
        } else {
            addWechatCallLine('system', `通话信号不稳定：${result.error}`);
        }
    } finally {
        if (window._wechatActiveCall?.id === call.id && !call.ended) {
            call.busy = false;
            input.disabled = false;
            setWechatCallStatus('通话中');
            input.focus();
        }
    }
}

function addWechatCallRecord(call, status, reason = '') {
    const char = window.myCharacters.find(c => c.id === call.charId);
    if (!char) return;
    if (!char.history) char.history = [];
    const duration = call.acceptedAt ? Math.max(1, Math.round((Date.now() - call.acceptedAt) / 1000)) : 0;
    const msg = syncWechatMessageDescription({
        type: call.type,
        isMe: call.direction !== 'incoming',
        status,
        reason: reason || call.reason || '',
        duration,
        timestamp: call.startedAt || createMessageTimestamp()
    });
    char.history.push(msg);
    saveCharactersToStorage();
    if (window.currentChatCharId === char.id) refreshChatView(char);
    renderChatList();
}

function endWechatCall(status = '已结束') {
    const call = window._wechatActiveCall;
    if (!call || call.ended) return;
    call.ended = true;
    clearInterval(call.timerId);
    addWechatCallRecord(call, call.acceptedAt ? status : '已取消');
    closeWechatCallScreen(call.id);
}

function closeWechatCallScreen(callId) {
    const call = window._wechatActiveCall;
    if (call && callId && call.id !== callId) return;
    if (call) {
        call.ended = true;
        clearInterval(call.timerId);
    }
    const screen = document.getElementById('wc-call-screen');
    if (screen) screen.classList.add('hidden');
    stopWechatCallCameraStream();
    window._wechatActiveCall = null;
    window._wechatAiBusy = false;
    setWechatBusyState(false);
}

// --- B. PNG 解析器 ---
const CharacterCardParser = {
    decodeBase64ToUtf8: function(base64) {
        try {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) { return null; }
    },

    findField: function(obj, targets) {
        if (!obj || typeof obj !== 'object') return null;
        const keys = Object.keys(obj);
        for (let target of targets) {
            if (obj[target] !== undefined) return obj[target];
            const lowerTarget = target.toLowerCase();
            const foundKey = keys.find(k => k.toLowerCase() === lowerTarget);
            if (foundKey) return obj[foundKey];
        }
        return null;
    },

    parse: function(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        if (dataView.getUint32(0) !== 0x89504E47) throw new Error("不是 PNG");

        let offset = 8;
        let charData = null;
        let decoder = new TextDecoder('utf-8');

        while (offset < arrayBuffer.byteLength) {
            const length = dataView.getUint32(offset);
            let type = '';
            for(let i=0; i<4; i++) type += String.fromCharCode(dataView.getUint8(offset + 4 + i));
            
            if (type === 'tEXt' || type === 'iTXt') {
                const contentBytes = new Uint8Array(arrayBuffer, offset + 8, length);
                let nullIndex = -1;
                for(let i=0; i<length; i++) { if(contentBytes[i]===0){ nullIndex=i; break; } }
                
                if (nullIndex > -1) {
                    const key = decoder.decode(contentBytes.slice(0, nullIndex));
                    if (key === 'chara') {
                        let jsonStr = null;
                        if (type === 'tEXt') {
                            const val = decoder.decode(contentBytes.slice(nullIndex + 1));
                            jsonStr = this.decodeBase64ToUtf8(val);
                        } else {
                            const raw = decoder.decode(contentBytes);
                            const idx = raw.indexOf('eyJ'); 
                            if (idx > -1) jsonStr = this.decodeBase64ToUtf8(raw.slice(idx));
                        }
                        
                        if (jsonStr) {
                            try { 
                                const raw = JSON.parse(jsonStr);
                                const d = raw.data || raw; 
                                
                                let searchTargets = [raw];
                                if (raw.data) searchTargets.push(raw.data);
                                searchTargets.forEach(target => {
                                    if (target.extensions && typeof target.extensions === 'string') {
                                        try { target.extensions = JSON.parse(target.extensions); } catch(e) {}
                                    }
                                });

                                let rawScripts = [];

                                function findRegexArray(obj, depth = 0) {
                                    if (depth > 6 || !obj || typeof obj !== 'object') return null;
                                    const keys = Object.keys(obj);
                                    const scriptKey = keys.find(k => k.toLowerCase() === 'regex_scripts' || k.toLowerCase() === 'regexscripts');
                                    if (scriptKey && Array.isArray(obj[scriptKey])) return obj[scriptKey];
                                    
                                    for (let key in obj) {
                                        if (['character_book', 'history', 'story_string', 'alternate_greetings'].includes(key)) continue;
                                        const val = obj[key];
                                        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
                                            const firstKeys = Object.keys(val[0]).map(k => k.toLowerCase());
                                            if (firstKeys.some(k => k.includes('regex') || k.includes('pattern'))) {
                                                return val;
                                            }
                                        } else if (typeof val === 'object') {
                                            const found = findRegexArray(val, depth + 1);
                                            if (found) return found;
                                        }
                                    }
                                    return null;
                                }

                                const found = findRegexArray(raw);
                                if (found) rawScripts = found;

                                const normalizedScripts = rawScripts.map((s, idx) => {
                                    const get = (arr) => this.findField(s, arr) || "";
                                    return {
                                        name: get(['scriptName', 'name', 'label']) || `Script #${idx+1}`,
                                        regex: get(['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']), 
                                        replace: get(['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']),
                                        placement: "Global"
                                    };
                                }).filter(s => s.regex && s.regex.trim() !== "");

                                charData = {
                                    name: d.name,
                                    description: d.description,
                                    first_mes: d.first_mes,
                                    alternates: d.alternate_greetings || [],
                                    avatar: "", 
                                    worldBook: d.character_book?.entries || d.character_book || [],
                                    regex: normalizedScripts 
                                };
                            } catch(e) { console.error("JSON解析失败", e); }
                        }
                    }
                }
            }
            if (charData) break;
            offset += 4 + 4 + length + 4;
        }
        return charData;
    }
};

// --- C. 交互与导入系统 ---

function testAddCharacter() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="triggerImport()"><i class="ri-file-upload-line" style="color: #07c160;"></i><span>导入角色卡 (PNG)</span><input type="file" id="import-card-file" accept="image/*" style="display:none" onchange="handleFileSelect(this)"></div>
        <div class="wc-sheet-item" onclick="openCreateModal()"><i class="ri-user-add-line" style="color: #2b2b2b;"></i><span>手动新建角色</span></div>
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
        lastMsg: intro,
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

// --- 左滑删除 ---

function deleteCharacter(charId) {
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    if (!confirm(`确定删除「${char.name}」吗？\n聊天记录将不可恢复`)) return;

    window.myCharacters = window.myCharacters.filter(c => c.id !== charId);
    if (window.currentChatCharId === charId) window.currentChatCharId = null;

    saveCharactersToStorage();
    renderChatList();
}

// 滑动手势处理
function initSwipeHandlers() {
    const containers = document.querySelectorAll('.wc-swipe-container');
    let openItem = null; // 当前打开的滑动项

    function closeOpenItem(animate) {
        if (!openItem) return;
        const chatItem = openItem.querySelector('.wc-chat-item');
        if (chatItem) {
            if (animate) chatItem.style.transition = 'transform 0.3s ease';
            chatItem.style.transform = 'translateX(0)';
            if (animate) setTimeout(() => { chatItem.style.transition = ''; }, 300);
        }
        openItem.classList.remove('swiping');
        openItem.classList.remove('swipe-open');
        openItem = null;
    }

    containers.forEach(container => {
        const chatItem = container.querySelector('.wc-chat-item');
        const charId = container.dataset.charId;
        let startX = 0, startY = 0, currentX = 0, moveX = 0, moveY = 0;
        let isSwiping = false, directionDecided = false, didSwipe = false, didOpenChatOnEnd = false;

        function onStart(x, y) {
            // 如果点到了其他地方且有打开项，先关闭
            if (openItem && openItem !== container) {
                closeOpenItem(true);
            }
            startX = x;
            startY = y;
            currentX = 0;
            moveX = 0;
            moveY = 0;
            isSwiping = false;
            directionDecided = false;
            didSwipe = false;
            chatItem.style.transition = '';
        }

        function onMove(x, y, e) {
            const dx = x - startX;
            const dy = y - startY;
            moveX = dx;
            moveY = dy;

            if (!directionDecided) {
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // 死区
                directionDecided = true;
                if (Math.abs(dy) > Math.abs(dx)) {
                    // 垂直滚动，放行
                    isSwiping = false;
                    return;
                }
                isSwiping = true;
                container.classList.add('swiping');
            }

            if (!isSwiping) return;
            if (e.cancelable) e.preventDefault();

            // 计算偏移（考虑已打开状态）
            const base = (openItem === container) ? -75 : 0;
            let tx = base + dx;
            tx = Math.max(-75, Math.min(0, tx));
            currentX = tx;
            chatItem.style.transform = `translateX(${tx}px)`;
        }

        function onEnd() {
            if (!isSwiping) {
                const tapLike = !didSwipe && Math.abs(moveX) < 18 && Math.abs(moveY) < 18;
                if (tapLike) {
                    // 纯点击
                    if (openItem === container) {
                        closeOpenItem(true);
                    } else {
                        if (Date.now() - Number(container.dataset.openingAt || 0) < 360) return;
                        container.dataset.openingAt = String(Date.now());
                        didOpenChatOnEnd = true;
                        openChat(charId);
                        setTimeout(() => { didOpenChatOnEnd = false; }, 0);
                    }
                }
                return;
            }
            didSwipe = true;
            chatItem.style.transition = 'transform 0.3s ease';

            if (currentX < -35) {
                // 吸附打开
                chatItem.style.transform = 'translateX(-75px)';
                container.classList.add('swipe-open');
                openItem = container;
            } else {
                // 收回
                chatItem.style.transform = 'translateX(0)';
                container.classList.remove('swipe-open');
                if (openItem === container) openItem = null;
            }
            container.classList.remove('swiping');
            setTimeout(() => { chatItem.style.transition = ''; }, 300);
        }

        // 触摸事件
        container.addEventListener('touchstart', e => {
            const t = e.touches[0];
            onStart(t.clientX, t.clientY);
        }, { passive: true });

        container.addEventListener('touchmove', e => {
            const t = e.touches[0];
            onMove(t.clientX, t.clientY, e);
        }, { passive: false });

        container.addEventListener('touchend', () => onEnd());

        // 鼠标事件（桌面端）
        let mouseDown = false;
        container.addEventListener('mousedown', e => {
            mouseDown = true;
            onStart(e.clientX, e.clientY);
        });
        container.addEventListener('mousemove', e => {
            if (!mouseDown) return;
            onMove(e.clientX, e.clientY, e);
        });
        container.addEventListener('mouseup', () => {
            if (!mouseDown) return;
            mouseDown = false;
            onEnd();
        });
        container.addEventListener('mouseleave', () => {
            if (!mouseDown) return;
            mouseDown = false;
            onEnd();
        });
        container.addEventListener('click', e => {
            if (didOpenChatOnEnd) return;
            if (e.defaultPrevented || e.target.closest('.wc-delete-btn')) return;
            if (container.classList.contains('swiping') || container.classList.contains('swipe-open')) return;
            if (isSwiping || didSwipe || Math.abs(moveX) >= 18 || Math.abs(moveY) >= 18 || Math.abs(currentX) > 4) return;
            if (Date.now() - Number(container.dataset.openingAt || 0) < 360) return;
            container.dataset.openingAt = String(Date.now());
            openChat(charId);
        });
    });

    // 点击列表空白区域关闭已打开的滑动
    const chatList = document.getElementById('wc-chat-list');
    if (chatList) {
        chatList.addEventListener('click', (e) => {
            if (!e.target.closest('.wc-swipe-container') && openItem) {
                closeOpenItem(true);
            }
        });
    }
}

// --- D. 本地存储：角色数据持久化 ---

function saveCharactersToStorage() {
    try {
        const data = window.myCharacters.map(char => ({
            id: char.id,
            name: char.name,
            description: char.description || '',
            avatar: char._smallAvatar || char.avatar || '',
            lastMsg: char.lastMsg,
            worldBook: char.worldBook || [],
            regex: char.regex || [],
            alternates: char.alternates || [],
            first_mes_original: char.first_mes_original || '',
            first_mes: char.first_mes || '',
            currentGreetingIndex: char.currentGreetingIndex || 0,
            isGroupChat: !!char.isGroupChat,
            groupMembers: Array.isArray(char.groupMembers) ? char.groupMembers : [],
            groupCreatedAt: char.groupCreatedAt || 0,
            chatConfig: char.chatConfig || {},
            history: char.history || []
        }));
        const jsonStr = JSON.stringify(data);
        localStorage.setItem('my_characters_data', jsonStr);
        console.log("✅ 角色数据已保存，大小:", (jsonStr.length / 1024).toFixed(1) + "KB");
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            try {
                const data = window.myCharacters.map(char => ({
                    id: char.id, name: char.name, description: char.description || '', avatar: '',
                    lastMsg: char.lastMsg, worldBook: [], regex: char.regex || [],
                    alternates: char.alternates || [],
                    first_mes_original: char.first_mes_original || '',
                    first_mes: char.first_mes || '',
                    currentGreetingIndex: char.currentGreetingIndex || 0,
                    isGroupChat: !!char.isGroupChat,
                    groupMembers: Array.isArray(char.groupMembers) ? char.groupMembers : [],
                    groupCreatedAt: char.groupCreatedAt || 0,
                    chatConfig: char.chatConfig || {},
                    history: char.history || []
                }));
                localStorage.setItem('my_characters_data', JSON.stringify(data));
                console.warn("⚠️ 存储空间紧张，头像和世界书已省略");
            } catch (e2) {
                alert("❌ 存储空间不足，角色数据无法保存");
            }
        } else { console.error("保存角色数据失败:", e); }
    }
}

// 异步压缩所有角色头像后再保存
function compressAndSaveCharacters() {
    let pending = 0;
    let hasLarge = false;
    
    window.myCharacters.forEach(char => {
        const av = char.avatar || '';
        if (av.length > 50000 && !char._smallAvatar) {
            hasLarge = true;
            pending++;
            const img = new Image();
            img.onload = function() {
                char._smallAvatar = compressWechatAvatarImage(img, 200, 0.7);
                pending--;
                if (pending === 0) saveCharactersToStorage();
            };
            img.onerror = function() {
                char._smallAvatar = '';
                pending--;
                if (pending === 0) saveCharactersToStorage();
            };
            img.src = av;
        }
    });
    
    if (!hasLarge) saveCharactersToStorage();
}

function loadCharactersFromStorage() {
    try {
        const raw = localStorage.getItem('my_characters_data');
        if (!raw) { console.log("无已保存的角色数据"); return; }
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
            window.myCharacters = data;
            console.log("✅ 已加载", data.length, "个角色");
            applyWechatUiTheme();
            renderChatList();
        }
    } catch (e) {
        console.error("加载角色数据失败:", e);
    }
}

// --- 📑 微信 Tab 切换 ---

function switchWcTab(tabName) {
    const views = document.querySelectorAll('.wc-tab-view');
    views.forEach(v => v.classList.remove('active'));

    const tabs = document.querySelectorAll('.wc-tab-bar .wc-tab');
    tabs.forEach(t => t.classList.remove('active'));

    applyWechatUiTheme();

    const targetView = document.getElementById('wc-view-' + tabName);
    if (targetView) targetView.classList.add('active');

    const tabIndex = { chat: 0, contacts: 1, discover: 2, me: 3 };
    if (tabs[tabIndex[tabName]]) tabs[tabIndex[tabName]].classList.add('active');

    const header = document.querySelector('.wechat-header');
    const titleEl = header.querySelector('.wc-header-title');
    const rightEl = header.querySelector('.wc-header-right');

    const theme = getWechatUiTheme();
    titleEl.textContent = getWechatThemeTabMeta(tabName, theme).title || '微信';
    updateWechatUiThemeStructure(theme);

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

function isWechatXTheme() {
    return getWechatUiThemeId() === 'hallowrok';
}

function getWechatXPeople() {
    return (window.myCharacters || []).filter(char => char && char.id && !char.isGroupChat);
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
    const bio = wcEscapeHtml(profile.bio || '\u70b9\u51fb\u8bbe\u7f6e\u4e2a\u6027\u7b7e\u540d');
    view.dataset.telegramPage = '1';
    delete view.dataset.linePage;
    view.innerHTML = `
        <div class="wc-telegram-page wc-telegram-settings-page">
            <div class="wc-telegram-top-profile">
                <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div><strong>${name}</strong><span>${bio}</span></div>
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
    const bio = wcEscapeHtml(profile.bio || '点击设置个性签名');
    const coverStyle = profile.xCover ? `style="background-image:${getWechatCssUrl(profile.xCover)}"` : '';
    const people = getWechatXPeople();
    const followerCount = people.length ? Math.max(1, Math.round(people.length * 1.6)) : 0;
    const store = typeof getWechatMomentStore === 'function' ? getWechatMomentStore() : { posts: [] };
    const posts = Array.isArray(store.posts) ? store.posts.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
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
                    <p data-wc-me-field="bio">${bio}</p>
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

const WECHAT_X_NEWS_CACHE_KEY = 'wechat_x_realtime_news_cache_v2';

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
    return item.titleCn || (isWechatXChineseText(item.title) ? item.title : '正在翻译新闻标题...');
}

function isWechatXNewsNeedsTranslation(item) {
    return !!(item && item.title && !item.titleCn && !isWechatXChineseText(item.title));
}

function getWechatXNewsDisplayBody(item) {
    const body = item && (item.bodyCn || (isWechatXChineseText(item.bodyOriginal) ? item.bodyOriginal : ''));
    return String(body || '').trim();
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
                <h3>正文</h3>
                ${paragraphs.map(line => `<p>${wcEscapeHtml(line)}</p>`).join('')}
            </div>
        `;
    }
    if (item && item.detailLoading) {
        return '<div class="wc-x-news-body wc-x-news-body-state"><i class="ri-loader-4-line"></i><span>正在读取原文正文...</span></div>';
    }
    if (item && item.detailError) {
        return `<div class="wc-x-news-body wc-x-news-body-state error"><i class="ri-error-warning-line"></i><span>${wcEscapeHtml(item.detailError)}</span></div>`;
    }
    return '<div class="wc-x-news-body wc-x-news-body-state"><i class="ri-file-search-line"></i><span>点开后会读取真实原文正文。</span></div>';
}

function cleanWechatXReaderMarkdown(text) {
    const raw = String(text || '')
        .replace(/\r/g, '')
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
    const source = String(item.bodyOriginal || '').slice(0, 3600);
    const result = await callChatApi([
        { role: 'system', content: '你是新闻翻译编辑。把原文翻译成自然中文，只保留原文事实，不要编造，不要总结成一句话。输出 3 到 8 段正文，不要 Markdown 标题。' },
        { role: 'user', content: `标题：${item.title || ''}\n\n原文正文：\n${source}` }
    ]);
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
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 14000);
        const readerUrl = `https://r.jina.ai/${item.url}`;
        const resp = await fetch(readerUrl, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(`Reader ${resp.status}`);
        const text = cleanWechatXReaderMarkdown(await resp.text());
        if (!text || text.length < 80) throw new Error('正文为空');
        item.bodyOriginal = text;
        if (isWechatXChineseText(text)) {
            item.bodyCn = text.slice(0, 2600);
        } else {
            await translateWechatXNewsBodyIfNeeded(item);
        }
        if (!getWechatXNewsDisplayBody(item)) {
            item.detailError = '已经读取到原文，但当前没有可用的中文正文；请检查聊天 API 后重试翻译。';
        }
    } catch (e) {
        item.detailError = '没有从原文抓到完整正文，只保留真实标题和原文链接。';
    } finally {
        item.detailLoading = false;
        item.detailLoadedAt = Date.now();
        persistWechatXNewsItems(items);
        refreshWechatXNewsDetailIfOpen(item);
    }
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
            if (body && title && title.textContent === '新闻详情') {
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
    const url = wcEscapeHtml(item.url || '');
    const host = item.domain || (() => {
        try { return new URL(item.url || '').hostname.replace(/^www\./, ''); } catch (e) { return ''; }
    })();
    return `
        <div class="wc-x-news-detail">
            ${item.image ? `<img class="wc-x-news-detail-image" src="${wcEscapeHtml(item.image)}" onerror="this.style.display='none'">` : ''}
            <h2>${title}</h2>
            ${original}
            <div class="wc-x-news-detail-meta">${wcEscapeHtml(item.source || '实时新闻')} · ${wcEscapeHtml(formatWechatXNewsTime(item.time))}</div>
            ${needsTranslation ? '<div class="wc-x-news-translating"><i class="ri-translate-2"></i><span>正在翻译标题，稍等一下...</span></div>' : ''}
            ${renderWechatXNewsBodyHtml(item)}
            <button type="button" class="wc-x-news-open-link" onclick="window.open(${quoteWechatJsString(item.url)}, '_blank')"><i class="ri-external-link-line"></i><span>打开原文链接</span></button>
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
    if (window._wechatXNewsTranslating) return false;
    window._wechatXNewsTranslating = true;
    try {
        const result = await callChatApi([
            { role: 'system', content: '你是新闻标题翻译器。只输出 JSON 数组，不要解释。把英文新闻标题翻译成简洁自然的中文，每项对应输入顺序。' },
            { role: 'user', content: JSON.stringify(pending.map(row => row.item.title)) }
        ]);
        if (!result || !result.ok) return false;
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
    if (!force && cache && Date.now() - Number(cache.updatedAt || 0) < 10 * 60 * 1000) {
        renderWechatXRealtimeNews(cache.items, { source: cache.source || 'GDELT', cached: true });
        return;
    }
    box.innerHTML = '<div class="wc-x-news-loading">正在拉取真实新闻...</div>';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    try {
        const gdeltQuery = encodeURIComponent('(科技 OR 人工智能 OR 游戏 OR 音乐 OR 电影 OR 国际 OR 财经) sourcelang:Chinese');
        const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${gdeltQuery}&mode=artlist&format=json&timespan=6h&sort=datedesc&maxrecords=12`;
        const gdeltResp = await fetch(gdeltUrl, { signal: controller.signal, cache: 'no-store' });
        if (!gdeltResp.ok) throw new Error(`GDELT ${gdeltResp.status}`);
        const gdeltData = await gdeltResp.json();
        const gdeltItems = normalizeWechatXGdeltNews(gdeltData);
        if (gdeltItems.length) {
            saveWechatXNewsCache(gdeltItems);
            const saved = getWechatXNewsCache();
            if (saved) saved.source = 'GDELT';
            try { localStorage.setItem(WECHAT_X_NEWS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), source: 'GDELT', items: gdeltItems })); } catch (e) {}
            renderWechatXRealtimeNews(gdeltItems, { source: 'GDELT', cached: false });
            return;
        }
        throw new Error('GDELT empty');
    } catch (err) {
        try {
            const hnResp = await fetch('https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=8', { cache: 'no-store' });
            if (!hnResp.ok) throw new Error(`HN ${hnResp.status}`);
            const hnItems = normalizeWechatXHackerNews(await hnResp.json());
            if (hnItems.length) {
                try { localStorage.setItem(WECHAT_X_NEWS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), source: 'Hacker News', items: hnItems })); } catch (e) {}
                renderWechatXRealtimeNews(hnItems, { source: 'Hacker News', cached: false });
                return;
            }
        } catch (fallbackErr) {}
        if (cache && cache.items && cache.items.length) {
            renderWechatXRealtimeNews(cache.items, { source: cache.source || '缓存新闻', cached: true });
            return;
        }
        renderWechatXRealtimeNews([], { message: '实时新闻加载失败，没有使用假数据。请检查网络后刷新。' });
    } finally {
        clearTimeout(timer);
    }
}

function refreshWechatXRealtimeNews() {
    loadWechatXRealtimeNews(true);
}

window.refreshWechatXRealtimeNews = refreshWechatXRealtimeNews;

function getLineThemePeople() {
    return (window.myCharacters || []).filter(char => char && char.id && !char.isGroupChat);
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
    const bio = wcEscapeHtml(profile.bio || '\u70b9\u51fb\u8bbe\u7f6e\u4e2a\u6027\u7b7e\u540d');
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
                    <button type="button" data-wc-me-field="bio">
                        <strong>${name}</strong>
                        <span>${bio}</span>
                    </button>
                </div>
                <div class="wc-line-home-actions">
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
    const chars = getWechatGroupContacts();
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
    const bio = wcEscapeHtml(profile.bio || '\u70b9\u51fb\u8bbe\u7f6e\u7b7e\u540d');
    page.innerHTML = `
        <div class="wc-telegram-page wc-telegram-profile-page">
            <div class="wc-telegram-profile-hero">
                <img src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'" onclick="openWechatMeAvatarSheet()">
                <strong>${name}</strong>
                <span>@${id}</span>
                <em>${bio}</em>
            </div>
            <div class="wc-telegram-profile-actions">
                <button type="button" onclick="openWechatMoments()"><i class="ri-image-line"></i><span>\u52a8\u6001</span></button>
                <button type="button" onclick="openWechatFavorites()"><i class="ri-bookmark-line"></i><span>\u6536\u85cf</span></button>
                <button type="button" onclick="openWechatMeSettings()"><i class="ri-settings-3-line"></i><span>\u8bbe\u7f6e</span></button>
            </div>
            <div class="wc-telegram-profile-card">
                <button type="button" data-wc-me-field="name"><span>\u6635\u79f0</span><strong>${name}</strong></button>
                <button type="button" data-wc-me-field="wechatId"><span>ID</span><strong>${id}</strong></button>
                <button type="button" data-wc-me-field="bio"><span>\u7b7e\u540d</span><strong>${bio}</strong></button>
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
    const chars = getWechatGroupContacts();
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
    const bio = wcEscapeHtml(profile.bio || '\u70b9\u51fb\u8bbe\u7f6e\u7b7e\u540d');
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
                <button type="button" data-wc-me-field="bio">
                    <strong>${name}</strong>
                    <span>ID: ${id || 'user'}</span>
                    <em>${bio}</em>
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
    const chars = getWechatGroupContacts();
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
        list.innerHTML = searchHtml + '<div class="wc-contacts-empty">还没有联系人<br>导入角色卡添加好友吧~</div>';
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
        ]);
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
    const config = (char && char.chatConfig) || {};
    const aiProfile = getWechatAiContactProfile(char);
    if (aiProfile && aiProfile.bio) return aiProfile.bio;
    const name = (config.nickname || (char && char.name) || '对方');
    const raw = String(config.profileBio || char.description || '')
        .replace(/<info[\s\S]*?<\/info>/gi, ' ')
        .replace(/<character[\s\S]*?<\/character>/gi, ' ')
        .replace(/<writing_rule[\s\S]*?<\/writing_rule>/gi, ' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/```[\s\S]*$/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const looksLikeCard = /\b(char_name|appearance|personality|background_story|NSFW|writing_rule)\b/i.test(raw.slice(0, 300));
    const text = (!raw || looksLikeCard) ? (config.signature || `${name}还没有填写公开资料。`) : raw;
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function getWechatCharMoments(char) {
    const config = (char && char.chatConfig) || {};
    const saved = Array.isArray(config.aiMoments)
        ? config.aiMoments.filter(item => item && (item.source === 'ai_moment' || item.source === 'manual_moment'))
        : [];
    if (saved.length) return saved.slice(-4).reverse();
    return [];
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
    const cover = getWechatCharMomentCover(char);
    const momentsHtml = renderWechatCharMoments(char);
    openWechatFeatureScreen('朋友圈', `
        <div class="wc-profile-page wc-char-moments-page">
            <div class="wc-moment-cover" style="${getWechatMomentCoverStyle(cover, displayName)}">
                <div class="wc-moment-cover-name">${wcEscapeHtml(displayName)}</div>
                <img class="wc-moment-cover-avatar" src="${char.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
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
        ]);
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
    const extras = ['这集开始有意思了', '前排围观', '怎么突然这么像连续剧', '镜头给到这里', '弹幕已经坐好', '这句值得回放', '气氛不对劲了', '他肯定看见了'];
    const targetCount = level === 'warning' ? 14 : 9;
    const result = (phrases || []).filter(Boolean).slice(0, targetCount);
    let i = 0;
    while (result.length < targetCount && i < extras.length * 2) {
        result.push(extras[i % extras.length]);
        i += 1;
    }
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
        const result = await callChatApi(messages);
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
                <div class="wc-me-status wc-me-editable" onclick="promptWechatMeField('bio')">${wcEscapeHtml(profile.bio || '点击设置签名~')}</div>
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
        bio: { title: '修改签名', label: '签名', value: profile.bio || '', max: 120, placeholder: '点击设置签名', multiline: true }
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
        bio: { max: 120 }
    }[field];
    if (!config) return;
    const value = document.getElementById('wc-me-field-editor')?.value || '';
    const next = value.trim().slice(0, config.max);
    if (field === 'name') profile.name = next || '我';
    if (field === 'wechatId') profile.wechatId = next || profile.wechatId;
    if (field === 'bio') profile.bio = next;
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

// ========== 发现页：朋友圈 / 视频号 / 直播 / 购物 ==========

function readWechatStore(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function writeWechatStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function showWechatToast(text) {
    let toast = document.getElementById('wc-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'wc-toast';
        toast.className = 'wc-toast';
        getWechatModalRoot().appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(window._wechatToastTimer);
    window._wechatToastTimer = setTimeout(() => toast.classList.remove('show'), 1400);
}

function getWechatFavoritesStore() {
    const store = readWechatStore(WECHAT_FAVORITES_STORAGE_KEY, { items: [] });
    store.items = Array.isArray(store.items) ? store.items : [];
    return store;
}

function saveWechatFavoritesStore(store) {
    writeWechatStore(WECHAT_FAVORITES_STORAGE_KEY, store);
}

function addWechatFavorite(item) {
    const store = getWechatFavoritesStore();
    const sourceKey = item.sourceKey || '';
    if (sourceKey && store.items.some(existing => existing.sourceKey === sourceKey)) {
        showWechatToast('已在收藏里');
        return null;
    }
    const favorite = {
        id: item.id || ('fav_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
        type: item.type || 'text',
        title: item.title || '收藏',
        text: item.text || '',
        media: Array.isArray(item.media) ? item.media : [],
        sourceKey,
        source: item.source && typeof item.source === 'object' ? item.source : null,
        message: item.message && typeof item.message === 'object' ? item.message : null,
        createdAt: item.createdAt || Date.now(),
        updatedAt: item.updatedAt || Date.now()
    };
    store.items.unshift(favorite);
    saveWechatFavoritesStore(store);
    showWechatToast('已收藏');
    return favorite;
}

function deleteWechatFavorite(id) {
    const store = getWechatFavoritesStore();
    store.items = store.items.filter(item => item.id !== id);
    saveWechatFavoritesStore(store);
    renderWechatFavoriteList();
}

function cloneWechatMessageForFavorite(msg) {
    if (!msg || typeof msg !== 'object') return null;
    try {
        const clone = JSON.parse(JSON.stringify(msg));
        delete clone.monitorEvent;
        delete clone.monitorEventId;
        delete clone.receiptCreated;
        return clone;
    } catch (e) {
        return null;
    }
}

function cloneWechatMessageForForward(msg) {
    const clone = cloneWechatMessageForFavorite(msg);
    if (!clone) return null;
    clone.isMe = true;
    clone.timestamp = createMessageTimestamp();
    delete clone.receipt;
    delete clone.receiptFor;
    delete clone.collectedAt;
    delete clone.status;
    if (clone.type === 'voice') {
        clone.duration = normalizeWechatDuration(clone.duration, estimateWechatVoiceDuration(clone.transcript || clone.content || ''));
        clone.content = clone.transcript || clone.content || `[语音 ${formatWechatDuration(clone.duration)}]`;
    }
    return syncWechatMessageDescription(clone);
}

function collectWechatMessage(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const msg = char && Array.isArray(char.history) ? char.history[msgIdx] : null;
    if (!char || !msg || msg.isMe) return;
    const text = stripWechatPromptText(getWechatMessagePromptContent(msg), 520) || '[微信消息]';
    const msgKey = getWechatMessageSourceKey(char.id, msg, msgIdx);
    addWechatFavorite({
        type: 'message',
        title: `${getWechatCharDisplayName(char)} 的消息`,
        text,
        message: cloneWechatMessageForFavorite(msg),
        sourceKey: msgKey,
        source: { kind: 'message', charId: char.id, msgKey },
        createdAt: msg.timestamp || msg.createdAt || Date.now()
    });
}

function collectWechatMoment(postId) {
    const store = getWechatMomentStore();
    const post = store.posts.find(item => item.id === postId);
    if (!post) return;
    addWechatFavorite({
        type: 'moment',
        title: `${post.userName || '我'} 的朋友圈`,
        text: post.text || '[图片朋友圈]',
        media: (post.images || []).map(url => ({ type: /^data:video\//i.test(url) ? 'video' : 'image', url })),
        sourceKey: `moment:${post.id}`,
        createdAt: post.createdAt || Date.now()
    });
}

function collectWechatCharMoment(charId, momentId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const moments = getWechatCharMoments(char);
    const fallbackIndex = String(momentId || '').startsWith('idx_') ? parseInt(String(momentId).slice(4), 10) : -1;
    const item = moments.find(moment => moment.id === momentId) || (fallbackIndex >= 0 ? moments[fallbackIndex] : null);
    if (!char || !item) return;
    addWechatFavorite({
        type: 'moment',
        title: `${getWechatCharDisplayName(char)} 的朋友圈`,
        text: item.text || '',
        sourceKey: `charMoment:${char.id}:${item.id || momentId}`,
        createdAt: item.createdAt || Date.now()
    });
}

function getWechatFavoriteMediaHtml(media = []) {
    return media.length ? `<div class="wc-fav-media">${media.slice(0, 6).map(item => {
        const url = wcEscapeHtml(item.url || '');
        if (item.type === 'audio') return `<audio src="${url}" controls></audio>`;
        if (item.type === 'video') return `<video src="${url}" controls muted playsinline></video>`;
        return `<img src="${url}" onerror="this.style.opacity='0.35'">`;
    }).join('')}</div>` : '';
}

function openWechatFavorites() {
    openWechatFeatureScreen('收藏', `
        <div class="wc-fav-page">
            <div class="wc-fav-search"><i class="ri-search-line"></i><input id="wc-fav-search-input" placeholder="搜索收藏和笔记" oninput="renderWechatFavoriteList(this.value)"></div>
            <div id="wc-fav-list" class="wc-fav-list"></div>
        </div>
    `, '<i class="ri-add-line" onclick="openWechatFavoriteNoteEditor()"></i>');
    renderWechatFavoriteList();
}

function renderWechatFavoriteList(query = '') {
    const listEl = document.getElementById('wc-fav-list');
    if (!listEl) return;
    const q = String(query || document.getElementById('wc-fav-search-input')?.value || '').trim().toLowerCase();
    const items = getWechatFavoritesStore().items
        .filter(item => !q || `${item.title || ''} ${item.text || ''}`.toLowerCase().includes(q))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    listEl.innerHTML = items.length ? items.map(item => `
        <div class="wc-fav-item">
            <div class="wc-fav-main" onclick="${getWechatFavoriteOpenAction(item)}">
                <div class="wc-fav-title">${wcEscapeHtml(item.title || '收藏')}</div>
                <div class="wc-fav-text">${wcEscapeHtml(item.text || '').replace(/\n/g, '<br>') || ' '}</div>
                ${getWechatFavoriteMediaHtml(item.media || [])}
                <div class="wc-fav-time">${new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleString()}</div>
            </div>
            <div class="wc-fav-actions">
                <button onclick="shareWechatFavorite(${quoteWechatJsString(item.id)})"><i class="ri-share-forward-line"></i></button>
                <button onclick="deleteWechatFavorite(${quoteWechatJsString(item.id)})"><i class="ri-delete-bin-line"></i></button>
            </div>
        </div>
    `).join('') : '<div class="wc-discover-empty">还没有收藏</div>';
}

function getWechatFavoriteOpenAction(item) {
    if (item.type === 'note') return `openWechatFavoriteNoteEditor(${quoteWechatJsString(item.id)})`;
    if (item.type === 'message') {
        const source = item.source || {};
        let charId = source.charId || '';
        let msgKey = source.msgKey || item.sourceKey || '';
        if (!charId && item.sourceKey && item.sourceKey.startsWith('message:')) {
            const parts = item.sourceKey.split(':');
            charId = parts[1] || '';
            msgKey = parts.slice(0, 3).join(':');
        }
        if (charId && msgKey) return `openWechatMessageSource(${quoteWechatJsString(charId)}, ${quoteWechatJsString(msgKey)})`;
    }
    return '';
}

function getWechatFavoriteById(id) {
    return getWechatFavoritesStore().items.find(item => item.id === id) || null;
}

function saveWechatFavoriteNoteDraft() {
    const id = window._wechatEditingFavoriteNoteId;
    const titleEl = document.getElementById('wc-note-title');
    const textEl = document.getElementById('wc-note-text');
    if (!id || !titleEl || !textEl) return;
    const store = getWechatFavoritesStore();
    const item = store.items.find(fav => fav.id === id);
    if (!item) return;
    item.title = titleEl.value.trim() || '未命名笔记';
    item.text = textEl.value;
    item.updatedAt = Date.now();
    saveWechatFavoritesStore(store);
}

function captureWechatNoteUndo() {
    const textEl = document.getElementById('wc-note-text');
    if (!textEl) return;
    window._wechatNoteUndo = window._wechatNoteUndo || [];
    window._wechatNoteRedo = [];
    const last = window._wechatNoteUndo[window._wechatNoteUndo.length - 1];
    if (last !== textEl.value) window._wechatNoteUndo.push(textEl.value);
    if (window._wechatNoteUndo.length > 50) window._wechatNoteUndo.shift();
}

function undoWechatFavoriteNote() {
    const textEl = document.getElementById('wc-note-text');
    if (!textEl || !window._wechatNoteUndo || !window._wechatNoteUndo.length) return;
    window._wechatNoteRedo = window._wechatNoteRedo || [];
    window._wechatNoteRedo.push(textEl.value);
    textEl.value = window._wechatNoteUndo.pop();
    saveWechatFavoriteNoteDraft();
}

function redoWechatFavoriteNote() {
    const textEl = document.getElementById('wc-note-text');
    if (!textEl || !window._wechatNoteRedo || !window._wechatNoteRedo.length) return;
    window._wechatNoteUndo = window._wechatNoteUndo || [];
    window._wechatNoteUndo.push(textEl.value);
    textEl.value = window._wechatNoteRedo.pop();
    saveWechatFavoriteNoteDraft();
}

function getWechatNoteActionHtml(type) {
    const icons = {
        undo: '<svg viewBox="0 0 48 48" fill="none"><path d="M11.2721 36.7279C14.5294 39.9853 19.0294 42 24 42C33.9411 42 42 33.9411 42 24C42 14.0589 33.9411 6 24 6C19.0294 6 14.5294 8.01472 11.2721 11.2721C9.61407 12.9301 6 17 6 17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 9V17H14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        redo: '<svg viewBox="0 0 48 48" fill="none"><path d="M36.7279 36.7279C33.4706 39.9853 28.9706 42 24 42C14.0589 42 6 33.9411 6 24C6 14.0589 14.0589 6 24 6C28.9706 6 33.4706 8.01472 36.7279 11.2721C38.3859 12.9301 42 17 42 17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 8V17H33" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        more: '<svg viewBox="0 0 48 48" fill="none"><circle cx="12" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="36" cy="24" r="3" fill="currentColor"/></svg>'
    };
    const labels = { undo: '撤销', redo: '重做', more: '转发' };
    const handlers = { undo: 'undoWechatFavoriteNote()', redo: 'redoWechatFavoriteNote()', more: 'shareWechatFavoriteNote()' };
    return `<button type="button" class="wc-note-action-btn" title="${labels[type]}" onclick="${handlers[type]}">${icons[type]}</button>`;
}

function openWechatFavoriteNoteEditor(noteId = '') {
    let note = noteId ? getWechatFavoriteById(noteId) : null;
    if (!note) {
        note = addWechatFavorite({ type: 'note', title: '新笔记', text: '', sourceKey: '' });
    }
    if (!note) return;
    window._wechatEditingFavoriteNoteId = note.id;
    window._wechatNoteUndo = [];
    window._wechatNoteRedo = [];
    openWechatFeatureScreen('笔记', `
        <div class="wc-note-page">
            <input id="wc-note-title" class="wc-note-title" value="${wcEscapeHtml(note.title || '')}" placeholder="标题" oninput="saveWechatFavoriteNoteDraft()">
            <textarea id="wc-note-text" class="wc-note-text" placeholder="记录文字、图片或者录音" onbeforeinput="captureWechatNoteUndo()" oninput="saveWechatFavoriteNoteDraft()">${wcEscapeHtml(note.text || '')}</textarea>
            <div class="wc-note-tools">
                <label><i class="ri-image-add-line"></i><span>图片</span><input type="file" accept="image/*" multiple onchange="handleWechatFavoriteNoteMedia(this, 'image')"></label>
                <label><i class="ri-mic-line"></i><span>录音</span><input type="file" accept="audio/*" onchange="handleWechatFavoriteNoteMedia(this, 'audio')"></label>
            </div>
            <div id="wc-note-media" class="wc-note-media">${getWechatFavoriteMediaHtml(note.media || [])}</div>
            <div class="wc-note-time">自动保存 · ${new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleString()}</div>
        </div>
    `, `${getWechatNoteActionHtml('undo')}${getWechatNoteActionHtml('redo')}${getWechatNoteActionHtml('more')}`);
    setWechatFeatureLeftText('收藏', 'openWechatFavorites()');
}

function handleWechatFavoriteNoteMedia(input, type) {
    const files = Array.from(input.files || []).slice(0, 6);
    const id = window._wechatEditingFavoriteNoteId;
    if (!files.length || !id) return;
    const store = getWechatFavoritesStore();
    const item = store.items.find(fav => fav.id === id);
    if (!item) return;
    item.media = Array.isArray(item.media) ? item.media : [];
    let remaining = files.length;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            item.media.push({ type, url: e.target.result, name: file.name });
            item.updatedAt = Date.now();
            remaining -= 1;
            if (remaining === 0) {
                saveWechatFavoritesStore(store);
                openWechatFavoriteNoteEditor(id);
            }
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function shareWechatFavorite(itemId) {
    const item = getWechatFavoriteById(itemId);
    if (!item) return;
    if (item.message) {
        shareWechatText(item.title || '收藏消息', item.text || '[微信消息]', {
            action: 'message_forward',
            title: item.title || '收藏消息',
            text: item.text || '',
            source: '微信收藏',
            message: item.message
        });
        return;
    }
    shareWechatText(item.title || '收藏', item.text || '[收藏内容]');
}

function shareWechatFavoriteNote() {
    const item = getWechatFavoriteById(window._wechatEditingFavoriteNoteId);
    if (!item) return;
    saveWechatFavoriteNoteDraft();
    shareWechatFavorite(item.id);
}

function openWechatStickerStore() {
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const totalStickers = data.packs.reduce((sum, pack) => sum + ((pack.stickers || []).length), 0);
    const editablePacks = getEditableStickerPacks(data);
    const activePackId = window._wechatStickerImportPackId || editablePacks[0]?.id || '';
    const packOptions = editablePacks.length
        ? editablePacks.map(pack => `<option value="${wcEscapeHtml(pack.id)}" ${pack.id === activePackId ? 'selected' : ''}>${wcEscapeHtml(pack.name)}（${(pack.stickers || []).length}）</option>`).join('')
        : '<option value="">先创建一个贴纸包</option>';
    openWechatFeatureScreen('表情', `
        <div class="wc-sticker-store-page">
            <div class="wc-sticker-store-hero wc-sticker-soft-hero">
                <div class="wc-sticker-hero-icon"><i class="ri-emotion-happy-line"></i></div>
                <div>
                    <strong>我的表情</strong>
                    <span>${data.packs.length} 个分组 · ${totalStickers} 张贴纸</span>
                </div>
            </div>
            <div class="wc-sticker-quick-row">
                <button onclick="openStickerPackCreateModal()"><i class="ri-folder-add-line"></i><span>新建分组</span></button>
                <label><i class="ri-image-add-line"></i><span>本地图片</span><input type="file" accept="image/*" multiple onchange="importWechatStickerLocalFiles(this)"></label>
                <button onclick="openStickerManager()"><i class="ri-settings-3-line"></i><span>管理</span></button>
            </div>
            <div class="wc-sticker-import-card">
                <div class="wc-sticker-import-title">
                    <i class="ri-link-m"></i>
                    <div><strong>从图床导入</strong><span>选择分组，粘贴链接或输入新分组名</span></div>
                </div>
                <div class="wc-sticker-boltp-ready">
                    <div>
                        <strong>这狗</strong>
                        <span>已内置 Boltp 分享包，当前默认包会自动补到 176 张。</span>
                    </div>
                    <button onclick="importBoltpStickerShare()"><i class="ri-refresh-line"></i> 同步</button>
                </div>
                <div class="wc-sticker-import-target">
                    <select id="wc-sticker-import-pack" onchange="window._wechatStickerImportPackId=this.value">${packOptions}</select>
                    <input id="wc-sticker-new-pack-name" maxlength="24" placeholder="新贴纸包名">
                </div>
                <textarea id="wc-sticker-url-import" class="wc-sticker-import-text" placeholder="每行一个图床链接，支持：&#10;开心：https://example.com/happy.png&#10;https://example.com/sticker.webp"></textarea>
                <div class="wc-sticker-import-actions">
                    <button onclick="importWechatStickerUrls()"><i class="ri-link"></i><span>导入 URL</span></button>
                    <label><i class="ri-image-add-line"></i><span>本地图片</span><input type="file" accept="image/*" multiple onchange="importWechatStickerLocalFiles(this)"></label>
                </div>
                <div class="wc-sticker-share-import">
                    <input id="wc-sticker-share-url" value="https://www.boltp.com/shares/26c3884813ed4f4999b78e49d448f2e6" placeholder="粘贴 Boltp 分享链接">
                    <button onclick="importBoltpStickerShare()"><i class="ri-cloud-line"></i><span>导入图床分享</span></button>
                </div>
            </div>
            <div class="wc-sticker-pack-summary">
                <div class="wc-sticker-summary-head">
                    <strong>我的贴纸包</strong>
                    <button onclick="openStickerManager()">编辑</button>
                </div>
                ${data.packs.length ? data.packs.map(pack => `
                    <div class="wc-sticker-pack-row" onclick="openStickerManager()">
                        <div class="wc-sticker-pack-preview">
                            ${(pack.stickers || []).slice(0, 4).map(sticker => `<img src="${wcEscapeHtml(sticker.url)}" alt="${wcEscapeHtml(sticker.name || '')}" onerror="this.style.opacity='0.35'">`).join('') || '<span>空</span>'}
                        </div>
                        <div class="wc-sticker-pack-meta">
                            <strong>${wcEscapeHtml(pack.name || '未命名贴纸包')}</strong>
                            <span>${(pack.stickers || []).length} 张贴纸</span>
                        </div>
                        <i class="ri-arrow-right-s-line"></i>
                    </div>
                `).join('') : '<div class="wc-discover-empty">还没有贴纸包，先在上面创建一个</div>'}
            </div>
        </div>
    `);
}

function ensureWechatStickerImportPack() {
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const nameInput = document.getElementById('wc-sticker-new-pack-name');
    const select = document.getElementById('wc-sticker-import-pack');
    const newName = (nameInput?.value || '').trim();

    if (newName) {
        const pack = { id: 'pack_' + Date.now(), name: newName.slice(0, 24), stickers: [] };
        data.packs.push(pack);
        saveStickerPacks(data);
        window._wechatStickerImportPackId = pack.id;
        return pack;
    }

    const editablePacks = getEditableStickerPacks(data);
    const packId = select?.value || window._wechatStickerImportPackId || editablePacks[0]?.id || '';
    const pack = editablePacks.find(item => item.id === packId);
    if (pack) {
        window._wechatStickerImportPackId = pack.id;
        return pack;
    }

    const fallbackPack = { id: 'pack_' + Date.now(), name: '我的贴纸', stickers: [] };
    data.packs.push(fallbackPack);
    saveStickerPacks(data);
    window._wechatStickerImportPackId = fallbackPack.id;
    return fallbackPack;
}

function appendWechatStickersToPack(packId, stickers) {
    if (!stickers.length) return false;
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    if (isWechatBuiltinStickerPackId(packId)) return false;
    const pack = getEditableStickerPacks(data).find(item => item.id === packId);
    if (!pack) return false;
    pack.stickers = Array.isArray(pack.stickers) ? pack.stickers : [];
    const existingUrls = new Set(pack.stickers.map(item => item.url));
    const fresh = stickers.filter(item => item && item.url && !existingUrls.has(item.url));
    if (!fresh.length) {
        window._wechatStickerImportPackId = pack.id;
        window._activeStickerPackId = pack.id;
        refreshStickerSurfaces();
        return false;
    }
    pack.stickers.push(...fresh);
    saveStickerPacks(data);
    window._wechatStickerImportPackId = pack.id;
    window._activeStickerPackId = pack.id;
    refreshStickerSurfaces();
    return true;
}

function ensureWechatNamedStickerPack(name) {
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const packName = (name || '图床贴纸包').trim().slice(0, 24);
    let pack = data.packs.find(item => item.name === packName);
    if (!pack) {
        pack = { id: 'pack_' + Date.now(), name: packName, stickers: [] };
        data.packs.push(pack);
        saveStickerPacks(data);
    }
    window._wechatStickerImportPackId = pack.id;
    window._activeStickerPackId = pack.id;
    return pack;
}

function getBoltpShareSlug(url) {
    const text = String(url || '').trim();
    const match = text.match(/boltp\.com\/shares\/([^/?#]+)/i) || text.match(/^([a-f0-9]{24,64})$/i);
    return match ? match[1] : '';
}

async function importBoltpStickerShare() {
    const input = document.getElementById('wc-sticker-share-url');
    const rawUrl = input?.value || 'https://www.boltp.com/shares/26c3884813ed4f4999b78e49d448f2e6';
    const slug = getBoltpShareSlug(rawUrl);
    if (!slug) {
        showWechatToast('没有识别到 Boltp 分享链接');
        return;
    }
    showWechatToast('正在读取图床分享...');
    try {
        const detailRes = await fetch(`https://www.boltp.com/api/v2/shares/${encodeURIComponent(slug)}`, { credentials: 'omit' });
        const detail = await detailRes.json();
        const share = detail?.data || {};
        if (detail?.status === 'error' || share.is_valid === false) throw new Error(detail?.message || '分享不可访问');
        const packName = share.album?.name || share.content || '图床贴纸包';
        const stickers = [];
        let page = 1;
        let lastPage = 1;
        do {
            const res = await fetch(`https://www.boltp.com/api/v2/shares/${encodeURIComponent(slug)}/photos?page=${page}&per_page=100`, { credentials: 'omit' });
            const json = await res.json();
            if (json?.status === 'error') throw new Error(json?.message || '图片列表读取失败');
            const box = json?.data || {};
            const photos = Array.isArray(box.data) ? box.data : [];
            photos.forEach(photo => {
                const url = photo.public_url || photo.thumbnail_url;
                if (!url) return;
                stickers.push({
                    id: 'stk_boltp_' + photo.id,
                    name: photo.name || `贴纸${stickers.length + 1}`,
                    url
                });
            });
            lastPage = Number(box.meta?.last_page) || page;
            page += 1;
        } while (page <= lastPage && stickers.length < 500);
        if (!stickers.length) throw new Error('分享里没有可导入图片');
        const pack = ensureWechatNamedStickerPack(packName);
        const before = (pack.stickers || []).length;
        appendWechatStickersToPack(pack.id, stickers);
        const after = (getStickerPacks().packs.find(item => item.id === pack.id)?.stickers || []).length;
        showWechatToast(`已导入 ${Math.max(0, after - before)} 张到「${packName}」`);
        openWechatStickerStore();
    } catch (e) {
        showWechatToast(e.message || '图床分享导入失败');
    }
}
window.importBoltpStickerShare = importBoltpStickerShare;

function importWechatStickerUrls() {
    const textEl = document.getElementById('wc-sticker-url-import');
    const stickers = parseStickerBatchText(textEl?.value || '');
    if (!stickers.length) {
        showWechatToast('没有识别到图片 URL');
        return;
    }
    const pack = ensureWechatStickerImportPack();
    if (appendWechatStickersToPack(pack.id, stickers)) {
        showWechatToast(`已导入 ${stickers.length} 张`);
        openWechatStickerStore();
    }
}

function importWechatStickerLocalFiles(input) {
    const files = Array.from(input.files || []).filter(file => /^image\//i.test(file.type)).slice(0, 30);
    if (!files.length) return;
    const pack = ensureWechatStickerImportPack();
    let remaining = files.length;
    const stickers = [];
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            stickers.push({
                id: 'stk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                name: file.name.replace(/\.[^.]+$/, '') || '本地贴纸',
                url: e.target.result
            });
            remaining -= 1;
            if (remaining === 0) {
                appendWechatStickersToPack(pack.id, stickers);
                input.value = '';
                showWechatToast(`已导入 ${stickers.length} 张`);
                openWechatStickerStore();
            }
        };
        reader.readAsDataURL(file);
    });
}

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
                    <textarea id="wc-me-set-bio" maxlength="120" placeholder="写一句签名">${wcEscapeHtml(profile.bio || '')}</textarea>
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
        bio: (document.getElementById('wc-me-set-bio')?.value || '').trim(),
        momentCover: (document.getElementById('wc-me-set-cover')?.value || '').trim()
    };
    saveUserProfile(profile);
    renderMePage();
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
    backEl.setAttribute('onclick', handler);
}

function closeWechatFeatureScreen() {
    const screen = document.getElementById('wc-feature-screen');
    if (!screen) return;
    screen.classList.remove('active');
    setTimeout(() => screen.classList.add('hidden'), 220);
}

function formatWechatRelativeTime(ts) {
    const diff = Math.max(0, Date.now() - (Number(ts) || Date.now()));
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min}分钟前`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}小时前`;
    return `${Math.floor(hour / 24)}天前`;
}

function getWechatMomentStore() {
    const store = readWechatStore(WECHAT_MOMENTS_STORAGE_KEY, { posts: [] });
    if (!Array.isArray(store.posts)) store.posts = [];
    return store;
}

function saveWechatMomentStore(store) {
    writeWechatStore(WECHAT_MOMENTS_STORAGE_KEY, store);
}

function isWechatOldMomentTemplateComment(text) {
    const value = String(text || '').trim();
    return [
        '早上看到这个，还挺有精神的。',
        '这个时间发出来刚刚好，我看到了。',
        '晚上刷到这个，感觉很适合慢慢聊。'
    ].includes(value);
}

function migrateWechatMomentTemplateComments(store) {
    if (!store || !Array.isArray(store.posts)) return false;
    let changed = false;
    store.posts.forEach(post => {
        if (!Array.isArray(post.comments)) return;
        const removed = [];
        post.comments = post.comments.filter(comment => {
            if (!comment) return false;
            if (comment.user) return true;
            if (!comment.charId) return true;
            if (comment.generatedBy === 'api' && !isWechatOldMomentTemplateComment(comment.text)) return true;
            if (comment.charId) removed.push(comment.charId);
            changed = true;
            return false;
        });
        if (removed.length) {
            post.pending = Array.isArray(post.pending) ? post.pending : [];
            removed.forEach((charId, index) => {
                const exists = post.pending.some(task => task && task.charId === charId && task.type === 'comment' && !task.done);
                if (exists) return;
                post.pending.push({
                    id: 'mqt_retry_' + (post.id || Date.now()) + '_' + charId + '_' + index,
                    charId,
                    type: 'comment',
                    dueAt: Date.now(),
                    done: false,
                    apiOnly: true
                });
            });
        }
    });
    return changed;
}

function scheduleWechatMomentEngagement(post) {
    const chars = (window.myCharacters || []).slice(0, 6);
    const needsAsk = /[?？]|怎么|为什么|为啥|怎么办|不懂|纠结/.test(post.text || '');
    post.pending = chars.map((char, index) => ({
        id: 'mqt_' + (post.id || Date.now()) + '_' + char.id + '_' + index,
        charId: char.id,
        type: needsAsk && index === 0 ? 'ask' : 'comment',
        dueAt: Date.now() + 45000 + index * 35000 + Math.floor(Math.random() * 45000),
        done: false
    }));
}

function isWechatMomentsScreenOpen() {
    const screen = document.getElementById('wc-feature-screen');
    const title = document.getElementById('wc-feature-title');
    return !!screen && screen.classList.contains('active') && title && title.textContent === '朋友圈';
}

function normalizeWechatMomentGeneratedComment(value) {
    const parsed = parseWechatJsonObject(value);
    let text = parsed && typeof parsed === 'object'
        ? (parsed.comment || parsed.text || parsed.reply || '')
        : String(value || '');
    text = cleanWechatVisibleContent(text)
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\|\|\|/g, ' ')
        .replace(/^\s*(?:朋友圈)?评论\s*[：:]\s*/i, '')
        .replace(/^\s*["'“”‘’]+|["'“”‘’]+\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return '';
    const firstLine = text.split(/\r?\n/).map(item => item.trim()).filter(Boolean)[0] || '';
    return firstLine.length > 44 ? firstLine.slice(0, 43) + '…' : firstLine;
}

async function generateWechatMomentPersonaComment(post, char, usedTexts = new Set()) {
    if (typeof callChatApi !== 'function') return '';
    const profile = getUserProfile();
    const postText = stripWechatPromptText(post?.text || '', 180) || (post?.images?.length ? '[图片朋友圈]' : '[空动态]');
    const imageHint = Array.isArray(post?.images) && post.images.length ? `含 ${post.images.length} 张图片` : '无图片';
    const charName = getWechatCharDisplayName(char);
    const userName = profile.name || '用户';
    try {
        const result = await callChatApi([
            {
                role: 'system',
                content: typeof buildSystemPrompt === 'function'
                    ? buildSystemPrompt(char)
                    : `你是「${charName}」。保持角色卡、人设、世界书和最近聊天关系。`
            },
            {
                role: 'system',
                content: `你正在浏览「${userName}」刚发的微信朋友圈。只输出一条朋友圈评论，8-36字，像真实微信留言。必须按「${charName}」的人设、口吻、关系距离和世界书反应；不要和其他角色同质化；不要解释，不要 Markdown，不要 JSON，不要替用户说话或替用户行动。`
            },
            {
                role: 'user',
                content: `朋友圈内容：${postText}\n图片：${imageHint}\n发布时间：${formatWechatRelativeTime(post?.createdAt)}\n\n世界书：\n${buildWechatWorldBookPrompt(char, 12)}\n\n最近聊天：\n${buildWechatRecentHistoryForPrompt(char, 10)}`
            }
        ]);
        const text = result && result.ok ? normalizeWechatMomentGeneratedComment(result.content) : '';
        if (text && !usedTexts.has(text) && !isWechatOldMomentTemplateComment(text)) return text;
    } catch (e) {
        console.warn('moment persona comment failed:', e);
    }
    return '';
}

function appendWechatMomentCommentToStore(store, post, task, char, text) {
    post.comments = post.comments || [];
    const safeText = String(text || '').trim();
    if (!safeText) {
        task.generating = false;
        task.error = 'API 未生成朋友圈评论';
        task.dueAt = Date.now() + 5 * 60000;
        return false;
    }
    post.comments.push({
        id: 'mc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        charId: char.id,
        name: (char.chatConfig && char.chatConfig.nickname) || char.name,
        avatar: char.avatar || DEFAULT_AVATAR,
        text: safeText,
        generatedBy: 'api',
        createdAt: Date.now()
    });
    task.done = true;
    task.generating = false;
    task.generatedAt = Date.now();
    delete task.error;
    return true;
}

function queueWechatMomentCommentGeneration(postId, taskId) {
    window._wechatMomentCommentJobs = window._wechatMomentCommentJobs || new Set();
    const jobKey = `${postId}:${taskId}`;
    if (window._wechatMomentCommentJobs.has(jobKey)) return;
    window._wechatMomentCommentJobs.add(jobKey);
    (async () => {
        try {
            const store = getWechatMomentStore();
            const post = store.posts.find(item => item.id === postId);
            const task = post && (post.pending || []).find(item => item.id === taskId);
            const char = task && (window.myCharacters || []).find(c => c.id === task.charId);
            if (!post || !task || !char || task.done) return;
            const used = new Set((post.comments || []).map(comment => String(comment && comment.text || '').trim()).filter(Boolean));
            const text = await generateWechatMomentPersonaComment(post, char, used);
            appendWechatMomentCommentToStore(store, post, task, char, text);
            saveWechatMomentStore(store);
            saveCharactersToStorage();
            if (isWechatMomentsScreenOpen()) renderWechatMoments();
        } finally {
            window._wechatMomentCommentJobs.delete(jobKey);
        }
    })();
}

function normalizeWechatMomentGeneratedChat(value) {
    const parsed = parseWechatJsonObject(value);
    let text = parsed && typeof parsed === 'object'
        ? (parsed.message || parsed.text || parsed.reply || '')
        : String(value || '');
    text = cleanWechatVisibleContent(text)
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\|\|\|/g, ' ')
        .replace(/^\s*(?:询问|消息|回复)\s*[：:]\s*/i, '')
        .replace(/^\s*["'“”‘’]+|["'“”‘’]+\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > 90 ? text.slice(0, 89) + '…' : text;
}

async function generateWechatMomentAskMessage(post, char) {
    if (typeof callChatApi !== 'function') return '';
    const profile = getUserProfile();
    const postText = stripWechatPromptText(post?.text || '', 220) || (post?.images?.length ? '[图片朋友圈]' : '[空动态]');
    try {
        const result = await callChatApi([
            {
                role: 'system',
                content: typeof buildSystemPrompt === 'function'
                    ? buildSystemPrompt(char)
                    : `你是「${getWechatCharDisplayName(char)}」。保持角色卡、人设、世界书和最近聊天关系。`
            },
            {
                role: 'system',
                content: `你看到「${profile.name || '用户'}」刚发的朋友圈后有疑惑，准备把这条朋友圈转发到微信聊天里问一句。只输出你会发给用户的一句自然消息，12-60字。必须按人设、关系和世界书说话；不要解释，不要 Markdown，不要替用户说话或替用户行动。`
            },
            {
                role: 'user',
                content: `朋友圈内容：${postText}\n图片数量：${Array.isArray(post?.images) ? post.images.length : 0}\n\n世界书：\n${buildWechatWorldBookPrompt(char, 12)}\n\n最近聊天：\n${buildWechatRecentHistoryForPrompt(char, 10)}`
            }
        ]);
        return result && result.ok ? normalizeWechatMomentGeneratedChat(result.content) : '';
    } catch (e) {
        console.warn('moment ask generation failed:', e);
        return '';
    }
}

function appendWechatMomentAskToChar(char, post, task, text) {
    const safeText = String(text || '').trim();
    if (!safeText) {
        task.generating = false;
        task.error = 'API 未生成朋友圈询问';
        task.dueAt = Date.now() + 5 * 60000;
        return false;
    }
    if (!char.history) char.history = [];
    char.history.push({
        type: 'share_card',
        isMe: false,
        card: {
            type: 'moment',
            title: `${post.userName || '我'} 的朋友圈`,
            text: post.text || '[图片朋友圈]',
            source: '朋友圈',
            images: Array.isArray(post.images) ? post.images.filter(Boolean).slice(0, 9) : []
        },
        timestamp: createMessageTimestamp()
    });
    char.history.push({
        type: 'text',
        isMe: false,
        content: safeText,
        timestamp: createMessageTimestamp()
    });
    task.done = true;
    task.generating = false;
    task.generatedAt = Date.now();
    delete task.error;
    if (window.currentChatCharId === char.id) refreshChatView(char);
    renderChatList();
    return true;
}

function queueWechatMomentAskGeneration(postId, taskId) {
    window._wechatMomentAskJobs = window._wechatMomentAskJobs || new Set();
    const jobKey = `${postId}:${taskId}`;
    if (window._wechatMomentAskJobs.has(jobKey)) return;
    window._wechatMomentAskJobs.add(jobKey);
    (async () => {
        try {
            const store = getWechatMomentStore();
            const post = store.posts.find(item => item.id === postId);
            const task = post && (post.pending || []).find(item => item.id === taskId);
            const char = task && (window.myCharacters || []).find(c => c.id === task.charId);
            if (!post || !task || !char || task.done) return;
            const text = await generateWechatMomentAskMessage(post, char);
            appendWechatMomentAskToChar(char, post, task, text);
            saveWechatMomentStore(store);
            saveCharactersToStorage();
            if (isWechatMomentsScreenOpen()) renderWechatMoments();
        } finally {
            window._wechatMomentAskJobs.delete(jobKey);
        }
    })();
}

function processWechatMomentQueue() {
    const store = getWechatMomentStore();
    let changed = migrateWechatMomentTemplateComments(store);
    store.posts.forEach(post => {
        (post.pending || []).forEach(task => {
            if (task.done || task.dueAt > Date.now()) return;
            if (!task.id) {
                task.id = 'mqt_' + (post.id || Date.now()) + '_' + (task.charId || 'char') + '_' + Math.random().toString(36).slice(2, 7);
                changed = true;
            }
            const char = (window.myCharacters || []).find(c => c.id === task.charId);
            if (!char) {
                task.done = true;
                changed = true;
                return;
            }
            if (task.generating && (!task.startedAt || Date.now() - Number(task.startedAt) > 120000)) {
                task.generating = false;
                task.error = task.error || '生成超时，等待重试';
                changed = true;
            }
            if (task.type === 'ask') {
                if (task.generating) return;
                task.generating = true;
                task.startedAt = Date.now();
                queueWechatMomentAskGeneration(post.id, task.id);
                changed = true;
                return;
            } else {
                if (task.generating) return;
                task.generating = true;
                task.startedAt = Date.now();
                queueWechatMomentCommentGeneration(post.id, task.id);
                changed = true;
                return;
            }
            task.done = true;
            changed = true;
        });
    });
    if (changed) {
        saveWechatMomentStore(store);
        saveCharactersToStorage();
    }
}

function openWechatMoments() {
    processWechatMomentQueue();
    window._wechatMomentDraftImages = window._wechatMomentDraftImages || [];
    renderWechatMoments();
}

function renderWechatMoments() {
    const store = getWechatMomentStore();
    const profile = getUserProfile();
    const posts = store.posts.slice().sort((a, b) => b.createdAt - a.createdAt);
    const coverImage = profile.momentCover || '';
    openWechatFeatureScreen('朋友圈', `
        <div class="wc-moment-cover" style="${getWechatMomentCoverStyle(coverImage, profile.name || '我')}" onclick="handleWechatMomentCoverClick()" ondblclick="handleWechatMomentCoverDoubleClick()">
            <div class="wc-moment-cover-name">${wcEscapeHtml(profile.name || '我')}</div>
            <img class="wc-moment-cover-avatar" src="${profile.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
        </div>
        <div class="wc-moment-feed">
            ${posts.length ? posts.map(renderWechatMomentPost).join('') : '<div class="wc-discover-empty">还没有朋友圈动态</div>'}
        </div>
    `, '<i class="ri-camera-line" onclick="openWechatMomentCameraSheet()"></i>');
}

function renderWechatMomentPost(post) {
    const comments = post.comments || [];
    const waiting = (post.pending || []).filter(t => !t.done).length;
    const postId = quoteWechatJsString(post.id);
    return `
        <div class="wc-moment-post">
            <div class="wc-moment-avatar"><img src="${post.userAvatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'"></div>
            <div class="wc-moment-content">
                <div class="wc-moment-name">${wcEscapeHtml(post.userName || '我')}</div>
                ${post.text ? `<div class="wc-moment-text">${wcEscapeHtml(post.text).replace(/\n/g, '<br>')}</div>` : ''}
                ${(post.images || []).length ? `<div class="wc-moment-grid">${post.images.map(renderWechatMomentMedia).join('')}</div>` : ''}
                <div class="wc-moment-meta">
                    <span>${formatWechatRelativeTime(post.createdAt)}${post.location ? ` · ${wcEscapeHtml(post.location)}` : ''}${post.visibility === 'private' ? ' · 私密' : ''}</span>
                    <div class="wc-moment-meta-actions">
                        <button onclick="collectWechatMoment(${postId})">收藏</button>
                        <button onclick="shareWechatMomentPost(${postId})">转发</button>
                        <button onclick="editWechatMoment(${postId})">编辑</button>
                        <button onclick="deleteWechatMoment(${postId})">删除</button>
                    </div>
                </div>
                ${waiting ? `<div class="wc-moment-waiting"><i class="ri-time-line"></i>${waiting} 位好友稍后可能留言</div>` : ''}
                ${comments.length ? `<div class="wc-moment-comments">${comments.map(comment => renderWechatMomentComment(post.id, comment)).join('')}</div>` : ''}
            </div>
        </div>
    `;
}

function renderWechatMomentComment(postId, comment) {
    const postArg = quoteWechatJsString(postId);
    const commentArg = quoteWechatJsString(comment.id || '');
    const replyTo = comment.replyTo ? `<em>回复 ${wcEscapeHtml(comment.replyTo)}</em>` : '';
    return `
        <div class="wc-moment-comment">
            <div><strong>${wcEscapeHtml(comment.name || '好友')}</strong>${replyTo}：${wcEscapeHtml(comment.text || '')}</div>
            <button onclick="replyWechatMomentComment(${postArg}, ${commentArg})">回复</button>
        </div>
    `;
}

function renderWechatMomentMedia(src) {
    const safeSrc = wcEscapeHtml(src || '');
    if (/^data:video\//i.test(src || '') || /\.(mp4|webm|mov)(\?|#|$)/i.test(src || '')) {
        return `<video src="${safeSrc}" controls muted playsinline onerror="this.style.opacity='0.35'"></video>`;
    }
    return `<img src="${safeSrc}" onerror="this.style.opacity='0.35'">`;
}

function renderWechatMomentDraftPreview() {
    const box = document.getElementById('wc-moment-draft-preview');
    if (!box) return;
    const images = window._wechatMomentDraftImages || [];
    box.innerHTML = images.map((src, index) => `<div class="wc-moment-draft-img">${renderWechatMomentMedia(src)}<button onclick="removeWechatMomentDraftImage(${index})"><i class="ri-close-line"></i></button></div>`).join('');
}

function handleWechatMomentCoverClick() {
    clearTimeout(window._wechatMomentCoverClickTimer);
    window._wechatMomentCoverClickTimer = setTimeout(() => openWechatMomentCoverSheet(), 220);
}

function handleWechatMomentCoverDoubleClick() {
    clearTimeout(window._wechatMomentCoverClickTimer);
    openNewWechatMomentTextComposer();
}

function openWechatMomentCoverSheet() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="promptWechatMomentCoverUrl()"><i class="ri-link"></i><span>使用图床 URL 更换封面</span></div>
        <div class="wc-sheet-item" onclick="document.getElementById('wc-moment-cover-file').click()"><i class="ri-image-add-line"></i><span>从本地上传封面</span><input id="wc-moment-cover-file" type="file" accept="image/*" style="display:none" onchange="uploadWechatMomentCover(this)"></div>
    `);
}

function promptWechatMomentCoverUrl() {
    hideActionSheet();
    const old = getUserProfile().momentCover || '';
    const url = prompt('输入朋友圈封面图床 URL', old);
    if (!url || !url.trim()) return;
    saveWechatMomentCover(url.trim());
}

function uploadWechatMomentCover(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => saveWechatMomentCover(e.target.result);
    reader.readAsDataURL(file);
    input.value = '';
    hideActionSheet();
}

function saveWechatMomentCover(src) {
    const profile = getUserProfile();
    profile.momentCover = src;
    saveUserProfile(profile);
    renderWechatMoments();
}

function openWechatMomentCameraSheet() {
    showWechatActionSheet(`
        <div class="wc-sheet-item" onclick="openNewWechatMomentTextComposer()"><i class="ri-edit-2-line"></i><span>发表文字</span></div>
        <div class="wc-sheet-item" onclick="document.getElementById('wc-moment-camera-file').click()"><i class="ri-camera-line"></i><span>拍摄（照片或者视频）</span><input id="wc-moment-camera-file" type="file" accept="image/*,video/*" capture style="display:none" onchange="handleWechatMomentCameraPick(this)"></div>
        <div class="wc-sheet-item" onclick="document.getElementById('wc-moment-album-file').click()"><i class="ri-image-line"></i><span>从手机相册选择</span><input id="wc-moment-album-file" type="file" accept="image/*,video/*" multiple style="display:none" onchange="handleWechatMomentCameraPick(this)"></div>
    `);
}

function handleWechatMomentCameraPick(input) {
    window._wechatMomentDraftImages = [];
    window._wechatEditingMomentId = '';
    handleWechatMomentImages(input);
    hideActionSheet();
    openWechatMomentTextComposer();
}

function openNewWechatMomentTextComposer() {
    window._wechatMomentDraftImages = [];
    window._wechatEditingMomentId = '';
    openWechatMomentTextComposer();
}

function openWechatMomentTextComposer(postId = '') {
    hideActionSheet();
    const store = getWechatMomentStore();
    const editingPost = postId ? store.posts.find(post => post.id === postId) : null;
    window._wechatEditingMomentId = editingPost ? editingPost.id : '';
    window._wechatMomentDraftImages = editingPost ? (editingPost.images || []).slice() : (window._wechatMomentDraftImages || []);
    const title = editingPost ? '编辑朋友圈' : '发表文字';
    const actionText = editingPost ? '保存' : '发表';
    openWechatFeatureScreen(title, `
        <div class="wc-moment-compose-page">
            <textarea id="wc-moment-text" class="wc-moment-compose-text" placeholder="这一刻的想法..." maxlength="500">${wcEscapeHtml(editingPost?.text || '')}</textarea>
            <div id="wc-moment-draft-preview" class="wc-moment-grid"></div>
            <div class="wc-moment-compose-row" onclick="promptWechatMomentLocation()">
                <i class="ri-map-pin-line"></i><span>所在位置</span><em id="wc-moment-location-text" data-value="${wcEscapeHtml(editingPost?.location || '')}">${editingPost?.location ? wcEscapeHtml(editingPost.location) : '不显示位置'}</em>
            </div>
            <div class="wc-moment-compose-row">
                <i class="ri-eye-line"></i><span>谁可以看</span>
                <div class="wc-moment-visibility">
                    <button type="button" class="${editingPost?.visibility === 'private' ? '' : 'active'}" data-value="public" onclick="setWechatMomentVisibility('public')">公开</button>
                    <button type="button" class="${editingPost?.visibility === 'private' ? 'active' : ''}" data-value="private" onclick="setWechatMomentVisibility('private')">私密</button>
                </div>
                <input type="hidden" id="wc-moment-visibility-value" value="${editingPost?.visibility === 'private' ? 'private' : 'public'}">
            </div>
            <label class="wc-moment-add-media"><i class="ri-image-add-line"></i><span>添加照片/视频</span><input type="file" accept="image/*,video/*" multiple onchange="handleWechatMomentImages(this)"></label>
        </div>
    `, `<button type="button" class="wc-feature-publish-btn" onclick="publishWechatMoment()">${actionText}</button>`);
    setWechatFeatureLeftText('取消', 'openWechatMoments()');
    renderWechatMomentDraftPreview();
}

function promptWechatMomentLocation() {
    const textEl = document.getElementById('wc-moment-location-text');
    const old = textEl && textEl.dataset.value ? textEl.dataset.value : '';
    const value = prompt('输入所在位置', old);
    if (!textEl) return;
    textEl.dataset.value = (value || '').trim();
    textEl.textContent = textEl.dataset.value || '不显示位置';
}

function setWechatMomentVisibility(value) {
    const safe = value === 'private' ? 'private' : 'public';
    const input = document.getElementById('wc-moment-visibility-value');
    if (input) input.value = safe;
    document.querySelectorAll('.wc-moment-visibility button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === safe);
    });
}

function handleWechatMomentImages(input) {
    const files = Array.from(input.files || []).slice(0, 9);
    window._wechatMomentDraftImages = window._wechatMomentDraftImages || [];
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            window._wechatMomentDraftImages.push(e.target.result);
            renderWechatMomentDraftPreview();
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function removeWechatMomentDraftImage(index) {
    window._wechatMomentDraftImages = window._wechatMomentDraftImages || [];
    window._wechatMomentDraftImages.splice(index, 1);
    renderWechatMomentDraftPreview();
}

function publishWechatMoment() {
    const text = (document.getElementById('wc-moment-text')?.value || '').trim();
    const images = (window._wechatMomentDraftImages || []).slice();
    if (!text && images.length === 0) return;
    const profile = getUserProfile();
    const visibility = document.getElementById('wc-moment-visibility-value')?.value === 'private' ? 'private' : 'public';
    const store = getWechatMomentStore();
    const editingId = window._wechatEditingMomentId || '';
    const editingPost = editingId ? store.posts.find(item => item.id === editingId) : null;
    if (editingPost) {
        editingPost.text = text;
        editingPost.images = images;
        editingPost.userName = profile.name || editingPost.userName || '我';
        editingPost.userAvatar = profile.avatar || editingPost.userAvatar || DEFAULT_AVATAR;
        editingPost.location = (document.getElementById('wc-moment-location-text')?.dataset.value || '').trim();
        editingPost.visibility = visibility;
        editingPost.updatedAt = Date.now();
        editingPost.comments = Array.isArray(editingPost.comments) ? editingPost.comments : [];
        editingPost.pending = visibility === 'private' ? [] : (Array.isArray(editingPost.pending) ? editingPost.pending : []);
        saveWechatMomentStore(store);
        window._wechatMomentDraftImages = [];
        window._wechatEditingMomentId = '';
        renderWechatMoments();
        return;
    }
    const post = {
        id: 'mom_' + Date.now(),
        text,
        images,
        userName: profile.name || '我',
        userAvatar: profile.avatar || DEFAULT_AVATAR,
        location: (document.getElementById('wc-moment-location-text')?.dataset.value || '').trim(),
        visibility,
        comments: [],
        pending: [],
        createdAt: Date.now()
    };
    if (visibility !== 'private') scheduleWechatMomentEngagement(post);
    store.posts.push(post);
    saveWechatMomentStore(store);
    window._wechatMomentDraftImages = [];
    window._wechatEditingMomentId = '';
    renderWechatMoments();
}

function editWechatMoment(id) {
    openWechatMomentTextComposer(id);
}

function shareWechatMomentPost(id) {
    const store = getWechatMomentStore();
    const post = store.posts.find(item => item.id === id);
    if (!post) return;
    shareWechatText('朋友圈', `${post.userName || '我'} 的朋友圈：${post.text || '[图片朋友圈]'}`, {
        type: 'moment',
        title: `${post.userName || '我'} 的朋友圈`,
        text: post.text || '[图片朋友圈]',
        source: '朋友圈',
        images: Array.isArray(post.images) ? post.images.filter(Boolean) : []
    });
}

function replyWechatMomentComment(postId, commentId) {
    const store = getWechatMomentStore();
    const post = store.posts.find(item => item.id === postId);
    if (!post) return;
    const comments = Array.isArray(post.comments) ? post.comments : [];
    const target = comments.find(item => item.id === commentId) || comments[0];
    const value = prompt(target ? `回复 ${target.name || '好友'}` : '回复朋友圈', '');
    if (!value || !value.trim()) return;
    const profile = getUserProfile();
    comments.push({
        id: 'mc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: profile.name || '我',
        avatar: profile.avatar || DEFAULT_AVATAR,
        text: value.trim().slice(0, 240),
        replyTo: target?.name || '',
        user: true,
        createdAt: Date.now()
    });
    post.comments = comments;
    saveWechatMomentStore(store);
    renderWechatMoments();
}

function deleteWechatMoment(id) {
    if (!confirm('确定删除这条朋友圈吗？')) return;
    const store = getWechatMomentStore();
    store.posts = store.posts.filter(post => post.id !== id);
    saveWechatMomentStore(store);
    renderWechatMoments();
}

function parseWechatAiJsonPayload(content) {
    const text = String(content || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    if (!text) return null;
    try { return JSON.parse(text); } catch (_) {}
    const arrayStart = text.indexOf('[');
    const arrayEnd = text.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
        try { return JSON.parse(text.slice(arrayStart, arrayEnd + 1)); } catch (_) {}
    }
    const objectStart = text.indexOf('{');
    const objectEnd = text.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
        try { return JSON.parse(text.slice(objectStart, objectEnd + 1)); } catch (_) {}
    }
    return null;
}

function getWechatGeneratedGradient(seed = '') {
    const palettes = [
        ['#0f172a', '#38bdf8', '#f8fafc'],
        ['#111827', '#22c55e', '#facc15'],
        ['#2f1b45', '#e879f9', '#fef3c7'],
        ['#172554', '#f97316', '#f8fafc'],
        ['#064e3b', '#14b8a6', '#ecfeff'],
        ['#3b1d12', '#fb7185', '#fde68a'],
        ['#1e293b', '#a3e635', '#f8fafc']
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    const p = palettes[hash % palettes.length];
    return [
        `linear-gradient(135deg,${p[0]},${p[1]})`,
        `linear-gradient(135deg,${p[1]},${p[2]})`,
        `linear-gradient(135deg,${p[0]},${p[2]})`
    ];
}

function getWechatMediaFrameStyle(frame) {
    const value = String(frame || '').trim();
    if (/^(https?:|data:image)/i.test(value)) return `background-image:${getWechatCssUrl(value)}`;
    return `background:${wcEscapeHtml(value || getWechatGeneratedGradient('media')[0])}`;
}

function normalizeWechatChannelVideos(data) {
    const raw = Array.isArray(data) ? data : (data && (data.videos || data.items)) || [];
    return raw.slice(0, 4).map((item, index) => {
        const title = String(item.title || item.name || '').trim();
        const author = String(item.author || item.creator || 'AI 视频号').trim();
        const description = String(item.description || item.desc || item.copy || '').trim();
        const bullets = Array.isArray(item.bullets) ? item.bullets : (Array.isArray(item.danmaku) ? item.danmaku : []);
        const thumb = String(item.thumbnail || item.cover || item.image || '').trim();
        return {
            id: item.id || ('v_ai_' + Date.now() + '_' + index),
            author,
            title: title || `AI 生成视频 ${index + 1}`,
            description,
            frames: Array.isArray(item.frames) && item.frames.length ? item.frames.slice(0, 3) : (thumb ? [thumb, thumb, thumb] : getWechatGeneratedGradient(title + author + index)),
            bullets: bullets.map(b => String(b).trim()).filter(Boolean).slice(0, 5)
        };
    }).filter(video => video.title);
}

function getWechatVideoState() {
    const state = readWechatStore(WECHAT_VIDEO_STORAGE_KEY, { videos: [], likes: {}, favs: {}, comments: {}, generatedAt: 0, error: '' });
    state.videos = Array.isArray(state.videos) ? state.videos : [];
    state.likes = state.likes || {};
    state.favs = state.favs || {};
    state.comments = state.comments || {};
    state.error = state.error || '';
    return state;
}

function saveWechatVideoState(state) {
    writeWechatStore(WECHAT_VIDEO_STORAGE_KEY, state);
}

function openWechatChannels(force = true) {
    renderWechatChannels({ loading: true });
    if (force || !getWechatVideoState().videos.length) generateWechatChannelVideos();
    else renderWechatChannels();
}

function renderWechatChannels(status = {}) {
    const state = getWechatVideoState();
    const body = status.loading ? `
        <div class="wc-ai-loading"><i class="ri-sparkling-2-line"></i><span>正在生成本次视频号内容...</span></div>
    ` : state.error ? `
        <div class="wc-ai-loading error"><i class="ri-error-warning-line"></i><span>${wcEscapeHtml(state.error)}</span><button onclick="openWechatChannels(true)">重新生成</button></div>
    ` : !state.videos.length ? `
        <div class="wc-ai-loading"><i class="ri-movie-2-line"></i><span>点击右上角生成本次视频号内容</span></div>
    ` : `
        <div class="wc-channel-feed">
            ${state.videos.map(video => `
                <div class="wc-channel-card">
                    <div class="wc-channel-stage">
                        ${video.frames.map(bg => `<div class="wc-channel-frame" style="${getWechatMediaFrameStyle(bg)}"></div>`).join('')}
                        <div class="wc-channel-progress"></div>
                        <div class="wc-channel-danmaku">${(video.bullets || []).map((b, i) => `<span style="--i:${i}">${wcEscapeHtml(b)}</span>`).join('')}</div>
                    </div>
                    <div class="wc-channel-info"><strong>${wcEscapeHtml(video.author)}</strong><span>${wcEscapeHtml(video.title)}</span>${video.description ? `<em>${wcEscapeHtml(video.description)}</em>` : ''}</div>
                    <div class="wc-channel-actions">
                        <button class="${state.likes[video.id] ? 'active' : ''}" onclick="toggleWechatVideoLike('${video.id}')"><i class="ri-heart-3-line"></i>赞</button>
                        <button class="${state.favs[video.id] ? 'active' : ''}" onclick="toggleWechatVideoFav('${video.id}')"><i class="ri-star-line"></i>收藏</button>
                        <button onclick="commentWechatVideo('${video.id}')"><i class="ri-chat-3-line"></i>评论</button>
                        <button onclick="shareWechatText(${quoteWechatJsString('视频号')}, ${quoteWechatJsString('我转发了视频号：' + video.title)})"><i class="ri-share-forward-line"></i>转发</button>
                    </div>
                    ${(state.comments[video.id] || []).length ? `<div class="wc-channel-comments">${state.comments[video.id].map(c => `<div>${wcEscapeHtml(c)}</div>`).join('')}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
    openWechatFeatureScreen('视频号', `
        ${body}
    `, '<i class="ri-refresh-line" onclick="openWechatChannels(true)"></i>');
}

async function generateWechatChannelVideos() {
    const state = getWechatVideoState();
    state.error = '';
    saveWechatVideoState(state);
    const result = await callChatApi([
        { role: 'system', content: '你是微信视频号内容生成器。只输出 JSON 数组，不要解释。每条包含 author、title、description、bullets。bullets 是 3-5 条短弹幕。内容要像真实视频号刷到的，不要营销模板。' },
        { role: 'user', content: `生成 3 条彼此不同的视频号内容。本次随机种子：${Date.now()}。` }
    ]);
    const parsed = result.ok ? parseWechatAiJsonPayload(result.content) : null;
    const videos = parsed ? normalizeWechatChannelVideos(parsed) : [];
    if (!result.ok || !videos.length) {
        state.error = result.ok ? 'AI 返回格式无法解析，点右上角再生成一次。' : result.error;
        state.videos = [];
    } else {
        state.videos = videos;
        state.generatedAt = Date.now();
        state.error = '';
    }
    saveWechatVideoState(state);
    renderWechatChannels();
}

function toggleWechatVideoLike(id) {
    const state = getWechatVideoState();
    state.likes[id] = !state.likes[id];
    saveWechatVideoState(state);
    renderWechatChannels();
}

function toggleWechatVideoFav(id) {
    const state = getWechatVideoState();
    state.favs[id] = !state.favs[id];
    saveWechatVideoState(state);
    renderWechatChannels();
}

function commentWechatVideo(id) {
    const text = prompt('写一条评论');
    if (!text || !text.trim()) return;
    const state = getWechatVideoState();
    state.comments[id] = state.comments[id] || [];
    state.comments[id].push(text.trim());
    saveWechatVideoState(state);
    renderWechatChannels();
}

const WECHAT_LIVE_CATEGORIES = ['美妆', '电子产品', '穿搭', '家居', '美食', '游戏'];

function getWechatLiveState() {
    const state = readWechatStore(WECHAT_LIVE_STORAGE_KEY, { rooms: {}, error: '' });
    state.rooms = state.rooms || {};
    state.error = state.error || '';
    return state;
}

function saveWechatLiveState(state) {
    writeWechatStore(WECHAT_LIVE_STORAGE_KEY, state);
}

function normalizeWechatLiveRooms(data, category) {
    const raw = Array.isArray(data) ? data : (data && (data.rooms || data.items || data.lives)) || [];
    return raw.slice(0, 4).map((item, index) => {
        const title = String(item.title || item.name || '').trim();
        const host = String(item.host || item.anchor || item.author || 'AI 主播').trim();
        const lines = Array.isArray(item.lines) ? item.lines : (Array.isArray(item.chat) ? item.chat : []);
        const cover = String(item.cover || item.thumbnail || item.image || '').trim();
        return {
            id: item.id || ('live_ai_' + Date.now() + '_' + index),
            title: title || `${category}直播 ${index + 1}`,
            host,
            category,
            viewers: String(item.viewers || (1.1 + Math.random() * 3).toFixed(1) + '万人观看'),
            lines: lines.map(line => String(line).trim()).filter(Boolean).slice(0, 4),
            cover,
            gradient: getWechatGeneratedGradient(title + host + category)[0]
        };
    }).filter(room => room.title);
}

function openWechatLive(category = '美妆', force = true) {
    renderWechatLive(category, { loading: true });
    if (force || !(getWechatLiveState().rooms[category] || []).length) generateWechatLiveRooms(category);
    else renderWechatLive(category);
}

function renderWechatLive(category = '美妆', status = {}) {
    const state = getWechatLiveState();
    const rooms = state.rooms[category] || [];
    const body = status.loading ? `
        <div class="wc-ai-loading"><i class="ri-broadcast-line"></i><span>正在生成 ${wcEscapeHtml(category)} 直播间...</span></div>
    ` : state.error ? `
        <div class="wc-ai-loading error"><i class="ri-error-warning-line"></i><span>${wcEscapeHtml(state.error)}</span><button onclick="openWechatLive(${quoteWechatJsString(category)}, true)">重新生成</button></div>
    ` : !rooms.length ? `
        <div class="wc-ai-loading"><i class="ri-live-line"></i><span>点击右上角生成直播间</span></div>
    ` : `
        <div class="wc-live-grid">
            ${rooms.map(room => `
                <div class="wc-live-card">
                    <div class="wc-live-cover" style="${getWechatMediaFrameStyle(room.cover || room.gradient)}"><span>LIVE</span><strong>${wcEscapeHtml(room.title)}</strong></div>
                    <div class="wc-live-meta"><span>${wcEscapeHtml(room.host)} · ${wcEscapeHtml(room.category)}</span><b>${wcEscapeHtml(room.viewers)}</b></div>
                    <div class="wc-live-chat">${(room.lines || []).map(line => `<span>${wcEscapeHtml(line)}</span>`).join('')}</div>
                    <div class="wc-live-actions">
                        <button onclick="shareWechatText(${quoteWechatJsString('直播')}, ${quoteWechatJsString('我转发了直播间：' + room.title)})">转发</button>
                        <button onclick="openWechatShop(${quoteWechatJsString(category)})">逛同款</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    openWechatFeatureScreen('直播', `
        <div class="wc-live-tabs">${WECHAT_LIVE_CATEGORIES.map(c => `<button class="${c === category ? 'active' : ''}" onclick="openWechatLive(${quoteWechatJsString(c)}, true)">${c}</button>`).join('')}</div>
        ${body}
    `, `<i class="ri-refresh-line" onclick="openWechatLive(${quoteWechatJsString(category)}, true)"></i>`);
}

async function generateWechatLiveRooms(category) {
    const state = getWechatLiveState();
    state.error = '';
    saveWechatLiveState(state);
    const result = await callChatApi([
        { role: 'system', content: '你是微信直播间内容生成器。只输出 JSON 数组，不要解释。每条包含 title、host、viewers、lines。lines 是直播间内 2-4 条真实感短句，包含主播或观众发言。' },
        { role: 'user', content: `生成 3 个「${category}」区域直播间。本次随机种子：${Date.now()}。内容要像真实直播间，不要固定模板。` }
    ]);
    const parsed = result.ok ? parseWechatAiJsonPayload(result.content) : null;
    const rooms = parsed ? normalizeWechatLiveRooms(parsed, category) : [];
    if (!result.ok || !rooms.length) {
        state.error = result.ok ? 'AI 返回格式无法解析，点右上角再生成一次。' : result.error;
        state.rooms[category] = [];
    } else {
        state.rooms[category] = rooms;
        state.error = '';
    }
    saveWechatLiveState(state);
    renderWechatLive(category);
}

function getWechatShopProducts() {
    const store = getWechatShopStore();
    return [...store.sourceProducts, ...store.custom];
}

function getWechatShopAggregateSourceLabel(store) {
    const count = Array.isArray(store?.sourceProducts) ? store.sourceProducts.length : 0;
    const syncedAt = store?.sourceSyncedAt ? formatWechatRelativeTime(store.sourceSyncedAt) : '还未同步';
    return `${count ? `${count} 件商品` : '等待拉取'} · ${syncedAt}`;
}

function translateWechatShopCategory(value, name = '') {
    const text = `${value || ''} ${name || ''}`.toLowerCase();
    const cnCategories = ['美妆个护', '家居生活', '食品百货', '数码配件', '服饰穿搭', '运动出行', '精选好物'];
    const existingCn = cnCategories.find(category => String(value || '').includes(category));
    if (existingCn) return existingCn;
    const map = [
        [/beauty|makeup|lipstick|mascara|fragrance|perfume|skin|cream|serum|nail|powder/, '美妆个护'],
        [/furniture|sofa|chair|table|bed|decor|lamp|home/, '家居生活'],
        [/groceries|food|juice|oil|rice|fruit|vegetable|meat|drink/, '食品百货'],
        [/laptop|smartphone|tablet|phone|mobile|accessor|electronics|charger|case/, '数码配件'],
        [/shirt|top|dress|women|men|clothes|jacket|fashion|bag|shoe|watch|sunglasses|jewel/, '服饰穿搭'],
        [/sport|ball|fitness|bike|motorcycle|vehicle|car/, '运动出行']
    ];
    const matched = map.find(([re]) => re.test(text));
    return matched ? matched[1] : '精选好物';
}

function translateWechatShopName(value, category = '') {
    const source = String(value || '').trim();
    if (!source) return '';
    const lower = `${source} ${category || ''}`.toLowerCase();
    const nameMap = [
        [/mascara/, '纤长睫毛膏'],
        [/lipstick|lip colour|lipstick/, '柔雾口红'],
        [/foundation/, '轻透粉底液'],
        [/nail/, '亮泽美甲护理'],
        [/perfume|fragrance/, '香氛香水'],
        [/cream|serum|essence|skin/, '护肤精华'],
        [/phone case|case/, '手机保护壳'],
        [/charger|adapter|cable/, '快充配件'],
        [/smartphone|iphone|samsung|phone/, '智能手机'],
        [/laptop|macbook/, '轻薄笔记本电脑'],
        [/tablet|ipad/, '平板电脑'],
        [/watch/, '腕表'],
        [/bag|handbag|purse/, '通勤包'],
        [/shoe|sneaker|boot|heel/, '舒适鞋履'],
        [/shirt|t-shirt|top/, '日常上衣'],
        [/dress/, '气质连衣裙'],
        [/jacket|coat/, '外套'],
        [/sofa/, '客厅沙发'],
        [/chair/, '舒适单椅'],
        [/table|desk/, '桌面家具'],
        [/lamp|light/, '氛围灯'],
        [/coffee/, '咖啡饮品'],
        [/juice|drink/, '风味饮品'],
        [/oil/, '厨房食用油'],
        [/rice|grain/, '谷物食品'],
        [/ball|fitness|sport/, '运动装备']
    ];
    const matched = nameMap.find(([re]) => re.test(lower));
    if (matched) return matched[1];
    const clean = source
        .replace(/[-_]+/g, ' ')
        .replace(/\b(?:new|premium|classic|modern|stylish|women'?s|men'?s)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (/^[\x00-\x7F]+$/.test(clean)) {
        const cnCategory = translateWechatShopCategory(category, source);
        const suffixMap = {
            '美妆个护': '日常护理单品',
            '家居生活': '质感生活好物',
            '食品百货': '安心囤货好物',
            '数码配件': '实用数码配件',
            '服饰穿搭': '通勤穿搭单品',
            '运动出行': '轻便运动装备',
            '精选好物': '精选生活好物'
        };
        return suffixMap[cnCategory] || `${cnCategory}好物`;
    }
    return clean;
}

function translateWechatShopDescription(value, item = {}) {
    const text = String(value || '').trim();
    if (!text) {
        return `适合日常使用的${translateWechatShopCategory(item.category || item.tag, item.title || item.name)}，页面已按聚合源整理为中文展示。`;
    }
    if (!/^[\x00-\x7F\s.,;:!?'"()/-]+$/.test(text)) return text;
    const lower = `${item.title || item.name || ''} ${item.category || item.tag || ''} ${text}`.toLowerCase();
    const category = translateWechatShopCategory(item.category || item.tag, item.title || item.name);
    if (/beauty|fragrance|skin|lip|mascara|cream|serum/.test(lower)) return `质感细腻的${category}单品，适合日常护理、通勤或约会场景。`;
    if (/phone|laptop|tablet|charger|electronic|accessor/.test(lower)) return `实用型${category}，兼顾日常使用、外出携带和桌面收纳。`;
    if (/furniture|sofa|chair|table|lamp|home|decor/.test(lower)) return `耐看的${category}，适合卧室、书桌或客厅搭配。`;
    if (/shirt|dress|shoe|bag|watch|fashion|women|men/.test(lower)) return `简洁好搭的${category}，适合日常出门和轻正式场合。`;
    if (/food|grocery|juice|oil|rice|coffee|drink/.test(lower)) return `日常囤货型${category}，适合家庭、办公室或夜间补给。`;
    return `来自聚合商品源的${category}，已整理为中文标题和简短说明。`;
}

function normalizeWechatShopProductForDisplay(item, index = 0, sourceName = '聚合源') {
    if (!item || typeof item !== 'object') return null;
    const rawName = String(item.name || item.title || item.productName || '').trim();
    const price = Number(item.price || item.salePrice || item.amount || 0) || 0;
    if (!rawName || price <= 0) return null;
    const rawTag = item.category || item.brand || item.tag || sourceName;
    const tag = translateWechatShopCategory(rawTag, rawName);
    const name = translateWechatShopName(rawName, rawTag);
    const image = item.thumbnail || item.image || item.imageUrl || (Array.isArray(item.images) ? item.images[0] : '');
    return {
        ...item,
        id: String(item.id || item.productId || `src_${sourceName}_${index}`),
        name,
        price,
        tag,
        image: String(image || '').trim(),
        description: translateWechatShopDescription(item.description || item.desc || item.body || '', { ...item, category: rawTag, title: rawName }),
        gradient: item.gradient || getWechatGeneratedGradient(name + tag)[0],
        source: item.source || sourceName
    };
}

function normalizeWechatShopCartItem(item) {
    if (!item || typeof item !== 'object') return null;
    const qty = Math.max(1, Math.min(99, parseInt(item.qty || item.quantity || 1, 10) || 1));
    const price = Number(item.price || 0) || 0;
    const display = normalizeWechatShopProductForDisplay({ ...item, price }, 0, item.source || '购物车');
    if (!display) return null;
    return {
        id: String(item.id || item.productId || display.name),
        name: display.name,
        price,
        qty,
        tag: display.tag,
        image: display.image,
        description: display.description,
        gradient: display.gradient
    };
}

function getWechatShopCartCount(store) {
    return (store.cart || []).reduce((sum, item) => sum + (parseInt(item.qty || 1, 10) || 1), 0);
}

function getWechatShopCartTotal(store) {
    return (store.cart || []).reduce((sum, item) => sum + Number(item.price || 0) * (parseInt(item.qty || 1, 10) || 1), 0);
}

function getWechatShopCartSummary(items) {
    return (items || []).map(item => `${item.name} ×${item.qty || 1} ¥${(Number(item.price || 0) * (item.qty || 1)).toFixed(2)}`).join('；');
}

function getWechatShopStore() {
    const store = readWechatStore(WECHAT_SHOP_STORAGE_KEY, { cart: [], custom: [], orders: [], sourceProducts: [], sourceUrl: WECHAT_SHOP_AGGREGATE_SOURCE_ID, sourceSyncedAt: 0, intimatePay: {}, lastAddress: '', lastPayer: 'self' });
    store.cart = Array.isArray(store.cart) ? store.cart.map(normalizeWechatShopCartItem).filter(Boolean) : [];
    store.custom = Array.isArray(store.custom) ? store.custom : [];
    store.orders = Array.isArray(store.orders) ? store.orders : [];
    store.sourceProducts = Array.isArray(store.sourceProducts)
        ? store.sourceProducts.map((item, index) => normalizeWechatShopProductForDisplay(item, index, item?.source || '聚合源')).filter(Boolean)
        : [];
    store.sourceUrl = WECHAT_SHOP_AGGREGATE_SOURCE_ID;
    store.sourceSyncedAt = Number(store.sourceSyncedAt || 0) || 0;
    store.intimatePay = store.intimatePay && typeof store.intimatePay === 'object' ? store.intimatePay : {};
    store.lastAddress = typeof store.lastAddress === 'string' ? store.lastAddress : '';
    store.lastPayer = typeof store.lastPayer === 'string' ? store.lastPayer : 'self';
    return store;
}

function saveWechatShopStore(store) {
    writeWechatStore(WECHAT_SHOP_STORAGE_KEY, store);
}

function openWechatShop(seed = '') {
    window._wechatShopKeyword = decodeURIComponent(seed || '');
    window._wechatShopTab = 'home';
    renderWechatShop('home', window._wechatShopKeyword);
}

function renderWechatShop(tabOrKeyword = 'home', keywordArg) {
    const tabs = ['home', 'cart', 'me'];
    const isTab = tabs.includes(tabOrKeyword);
    const tab = isTab ? tabOrKeyword : (window._wechatShopTab || 'home');
    const keyword = isTab ? (keywordArg ?? window._wechatShopKeyword ?? '') : String(tabOrKeyword || '');
    window._wechatShopTab = tab;
    window._wechatShopKeyword = keyword;
    const store = getWechatShopStore();
    const products = getWechatShopProducts().filter(p => !keyword || `${p.name}${p.tag}`.toLowerCase().includes(keyword.toLowerCase()));
    const total = getWechatShopCartTotal(store);
    const cartCount = getWechatShopCartCount(store);
    const content = tab === 'cart'
        ? renderWechatShopCart(store, total)
        : (tab === 'me' ? renderWechatShopMe(store) : renderWechatShopHome(products, keyword));
    openWechatFeatureScreen('购物', `
        <div class="wc-shop-app">
            <div class="wc-shop-content">${content}</div>
            <div class="wc-shop-tabbar">
                <button class="${tab === 'home' ? 'active' : ''}" onclick="renderWechatShop('home')"><i class="ri-home-5-line"></i><span>首页</span></button>
                <button class="${tab === 'cart' ? 'active' : ''}" onclick="renderWechatShop('cart')"><i class="ri-shopping-cart-line"></i><span>购物车${cartCount ? `(${cartCount})` : ''}</span></button>
                <button class="${tab === 'me' ? 'active' : ''}" onclick="renderWechatShop('me')"><i class="ri-user-3-line"></i><span>我的</span></button>
            </div>
        </div>
    `, `<button type="button" class="wc-feature-cart-btn" onclick="renderWechatShop('cart')" aria-label="打开购物车"><i class="ri-shopping-cart-line"></i>${cartCount ? `<b>${cartCount}</b>` : ''}</button>`);
}

function scheduleWechatShopSourceLoad(keyword = '') {
    const store = getWechatShopStore();
    const stale = !store.sourceProducts.length || !store.sourceSyncedAt || Date.now() - store.sourceSyncedAt > 1000 * 60 * 60 * 6;
    if (!stale || window._wechatShopSourceLoading) return;
    window._wechatShopSourceLoading = true;
    setTimeout(() => {
        loadWechatShopSource({ silent: true, keyword }).finally(() => {
            window._wechatShopSourceLoading = false;
        });
    }, 80);
}

function getWechatShopProductById(productId) {
    return getWechatShopProducts().find(p => String(p.id) === String(productId));
}

function getWechatShopProductTone(product, index = 0) {
    const palette = [
        'linear-gradient(135deg,#fff4ee 0%,#ffd5c0 52%,#ff7a32 100%)',
        'linear-gradient(135deg,#f5fbff 0%,#cde7ff 54%,#72a8ff 100%)',
        'linear-gradient(135deg,#fffaf0 0%,#ffe1a8 58%,#f5a623 100%)',
        'linear-gradient(135deg,#f8fff8 0%,#c9f2d6 58%,#38bd7d 100%)',
        'linear-gradient(135deg,#fff7fb 0%,#ffd2e7 52%,#ff6ca8 100%)'
    ];
    return product?.gradient || palette[index % palette.length];
}

function renderWechatShopTextCover(product, index = 0, mode = '') {
    const tag = wcEscapeHtml(product.tag || '精选好物');
    const name = wcEscapeHtml(product.name || '商品');
    const source = wcEscapeHtml(product.source || 'BYND');
    return `
        <div class="wc-shop-text-cover ${mode}" style="background:${getWechatShopProductTone(product, index)}">
            <span>${tag}</span>
            <strong>${name}</strong>
            <em>${source}</em>
        </div>
    `;
}

function renderWechatShopProductCard(product, index = 0) {
    return `
        <article class="wc-shop-card" onclick="openWechatShopProduct(${quoteWechatJsString(product.id)})">
            ${renderWechatShopTextCover(product, index)}
            <div class="wc-shop-card-body">
                <div class="wc-shop-name">${wcEscapeHtml(product.name)}</div>
                ${product.description ? `<div class="wc-shop-desc">${wcEscapeHtml(product.description)}</div>` : ''}
                <div class="wc-shop-tag-row">
                    <span>${wcEscapeHtml(product.tag || '精选')}</span>
                    <span>文字图预览</span>
                </div>
                <div class="wc-shop-row">
                    <strong>¥${Number(product.price || 0).toFixed(2)}</strong>
                    <button onclick="event.stopPropagation(); addWechatShopCart(${quoteWechatJsString(product.id)})">加购</button>
                </div>
                <div class="wc-shop-mini-actions">
                    <button onclick="event.stopPropagation(); shareWechatShopProduct(${quoteWechatJsString(product.id)})"><i class="ri-share-forward-line"></i>转发</button>
                    <button onclick="event.stopPropagation(); sendWechatShopGift(${quoteWechatJsString(product.id)})"><i class="ri-gift-line"></i>送礼</button>
                </div>
            </div>
        </article>
    `;
}

function renderWechatShopCategoryPills(products, keyword) {
    const tags = ['全部', ...Array.from(new Set((products || []).map(p => p.tag || '精选好物'))).slice(0, 7)];
    return `
        <div class="wc-shop-cats">
            ${tags.map(tag => {
                const active = (!keyword && tag === '全部') || keyword === tag;
                const next = tag === '全部' ? '' : tag;
                return `<button class="${active ? 'active' : ''}" onclick="renderWechatShop('home', ${quoteWechatJsString(next)})">${wcEscapeHtml(tag)}</button>`;
            }).join('')}
        </div>
    `;
}

function renderWechatShopHome(products, keyword) {
    const store = getWechatShopStore();
    scheduleWechatShopSourceLoad(keyword);
    const allProducts = getWechatShopProducts();
    const visibleProducts = products.length ? products : allProducts;
    const featured = visibleProducts[0];
    return `
        <div class="wc-shop-taobao-head">
            <div class="wc-shop-search"><i class="ri-search-line"></i><input value="${wcEscapeHtml(keyword)}" placeholder="搜索宝贝、礼物、角色想买的东西" oninput="renderWechatShop('home', this.value)"></div>
            <button class="wc-shop-refresh-btn" onclick="loadWechatShopSource({ keyword: window._wechatShopKeyword || '' })" aria-label="换一批"><i class="ri-refresh-line"></i></button>
        </div>
        ${renderWechatShopCategoryPills(allProducts, keyword)}
        <section class="wc-shop-hero">
            <div>
                <span>BYND 逛逛</span>
                <strong>${featured ? wcEscapeHtml(featured.tag || '今日好物') : '今日好物'}</strong>
                <p>${featured ? wcEscapeHtml(featured.description || featured.name) : '正在整理适合聊天转发、送礼和亲密付的商品。'}</p>
            </div>
            ${featured ? renderWechatShopTextCover(featured, 0, 'hero') : '<i class="ri-shopping-bag-3-line"></i>'}
        </section>
        <details class="wc-shop-seller-tools">
            <summary><span>发布商品</span><em>AI 生成 / 手动添加</em><i class="ri-arrow-down-s-line"></i></summary>
            <div class="wc-shop-ai-card">
                <input id="wc-shop-ai-brief" placeholder="让 AI 生成商品，例如：适合深夜学习的桌面小灯">
                <button onclick="generateWechatShopProduct()">AI 生成</button>
            </div>
            <div class="wc-shop-custom">
                <input id="wc-shop-custom-name" placeholder="商品标题">
                <input id="wc-shop-custom-price" type="number" min="0" placeholder="价格">
                <input id="wc-shop-custom-tag" placeholder="分类">
                <input id="wc-shop-custom-image" placeholder="图片 URL / 图床链接">
                <textarea id="wc-shop-custom-desc" placeholder="商品内容描述"></textarea>
                <button onclick="addWechatCustomProduct()">添加产品</button>
            </div>
        </details>
        <div class="wc-shop-feed-title"><strong>猜你喜欢</strong><span>${store.sourceProducts.length ? '点击商品后查看真实图片' : (window._wechatShopSourceLoading ? '正在整理商品源' : '暂无商品源')}</span></div>
        <div class="wc-shop-products">
            ${products.length ? products.map((p, index) => renderWechatShopProductCard(p, index)).join('') : `<div class="wc-discover-empty" style="grid-column:1/-1;">${window._wechatShopSourceLoading ? '正在整理商品，稍等一下。' : '还没有商品，可以先用 AI 生成一个。'}</div>`}
        </div>
    `;
}

function openWechatShopProduct(productId) {
    const product = getWechatShopProductById(productId);
    if (!product) {
        showWechatToast('这个商品已经不在列表里了');
        return;
    }
    const cartCount = getWechatShopCartCount(getWechatShopStore());
    openWechatFeatureScreen('商品详情', `
        <div class="wc-shop-app wc-shop-detail-app">
            <div class="wc-shop-content">${renderWechatShopDetail(product)}</div>
            <div class="wc-shop-detail-bar">
                <button onclick="renderWechatShop('home')"><i class="ri-arrow-left-s-line"></i><span>返回</span></button>
                <button onclick="shareWechatShopProduct(${quoteWechatJsString(product.id)})"><i class="ri-share-forward-line"></i><span>转发</span></button>
                <button onclick="sendWechatShopGift(${quoteWechatJsString(product.id)})"><i class="ri-gift-line"></i><span>送礼</span></button>
                <button class="primary" onclick="addWechatShopCart(${quoteWechatJsString(product.id)})">加入购物车</button>
            </div>
        </div>
    `, `<button type="button" class="wc-feature-cart-btn" onclick="renderWechatShop('cart')" aria-label="打开购物车"><i class="ri-shopping-cart-line"></i>${cartCount ? `<b>${cartCount}</b>` : ''}</button>`);
    if (!product.image && !window._wechatShopImageGenerating?.[product.id]) {
        setTimeout(() => ensureWechatShopProductImage(product.id), 120);
    }
}

function renderWechatShopDetail(product) {
    const imageHtml = product.image
        ? `<img src="${wcEscapeHtml(product.image)}" loading="lazy" onerror="this.remove(); ensureWechatShopProductImage(${quoteWechatJsString(product.id)})">`
        : `${renderWechatShopTextCover(product, 0, 'detail')}<div class="wc-shop-image-status"><i class="ri-loader-4-line"></i><span>正在生成真实商品图</span></div>`;
    return `
        <section class="wc-shop-detail-cover">${imageHtml}</section>
        <section class="wc-shop-detail-card">
            <div class="wc-shop-detail-price">¥${Number(product.price || 0).toFixed(2)}</div>
            <h3>${wcEscapeHtml(product.name || '商品')}</h3>
            <div class="wc-shop-detail-meta">
                <span>${wcEscapeHtml(product.tag || '精选好物')}</span>
                <span>${wcEscapeHtml(product.source || 'BYND 购物')}</span>
            </div>
            ${product.description ? `<p>${wcEscapeHtml(product.description)}</p>` : ''}
        </section>
        <section class="wc-shop-detail-card compact">
            <h4>服务</h4>
            <div class="wc-shop-service-row"><span>可转发给联系人</span><span>可加入购物车</span><span>可让角色代付</span></div>
        </section>
    `;
}

function updateWechatShopProductImage(productId, imageUrl) {
    const store = getWechatShopStore();
    let changed = false;
    ['sourceProducts', 'custom'].forEach(key => {
        store[key] = (store[key] || []).map((item, index) => {
            const normalized = normalizeWechatShopProductForDisplay(item, index, item?.source || (key === 'custom' ? '自定义' : '聚合源'));
            if (normalized && String(normalized.id) === String(productId)) {
                changed = true;
                return { ...item, id: normalized.id, image: imageUrl, imageUrl };
            }
            return item;
        });
    });
    if (changed) saveWechatShopStore(store);
    return changed;
}

async function ensureWechatShopProductImage(productId) {
    const product = getWechatShopProductById(productId);
    if (!product || product.image) return product?.image || '';
    window._wechatShopImageGenerating = window._wechatShopImageGenerating || {};
    if (window._wechatShopImageGenerating[productId]) return '';
    window._wechatShopImageGenerating[productId] = true;
    const status = document.querySelector('.wc-shop-image-status');
    if (status) status.innerHTML = '<i class="ri-loader-4-line"></i><span>正在生成真实商品图</span>';
    const prompt = `淘宝风格真实商品主图，干净自然的手机电商详情页图片，主体清晰，浅色背景，商品：${product.name}，分类：${product.tag}，说明：${product.description || product.name}`;
    const result = typeof callWechatImageGenerationApi === 'function'
        ? await callWechatImageGenerationApi(prompt)
        : { ok: false, error: '未加载生图模块' };
    delete window._wechatShopImageGenerating[productId];
    if (result.ok && result.url) {
        updateWechatShopProductImage(productId, result.url);
        openWechatShopProduct(productId);
        return result.url;
    }
    if (status) status.innerHTML = `<i class="ri-error-warning-line"></i><span>${wcEscapeHtml(result.error || '真实图片生成失败')}</span><button onclick="ensureWechatShopProductImage(${quoteWechatJsString(productId)})">重试</button>`;
    return '';
}

function renderWechatShopCart(store, total) {
    const itemCount = getWechatShopCartCount(store);
    return `
        <div class="wc-shop-cart">
            <h4><span>购物车</span><em>${itemCount} 件商品</em></h4>
            ${store.cart.length ? store.cart.map((item, i) => `
                <div class="wc-shop-cart-row">
                    <div class="wc-shop-cart-thumb" style="background:${item.gradient || 'linear-gradient(135deg,#f8fafc,#e2e8f0)'}">${item.image ? `<img src="${wcEscapeHtml(item.image)}" loading="lazy" onerror="this.style.display='none'">` : ''}</div>
                    <div class="wc-shop-cart-main">
                        <strong>${wcEscapeHtml(item.name)}</strong>
                        <span>${wcEscapeHtml(item.tag || '商品')} · 单价 ¥${Number(item.price || 0).toFixed(2)}</span>
                        ${item.description ? `<p>${wcEscapeHtml(item.description)}</p>` : ''}
                    </div>
                    <div class="wc-shop-cart-side">
                        <b>¥${(Number(item.price || 0) * (item.qty || 1)).toFixed(2)}</b>
                        <div class="wc-shop-qty">
                            <button onclick="updateWechatShopCartQty(${i}, -1)">−</button>
                            <span>${item.qty || 1}</span>
                            <button onclick="updateWechatShopCartQty(${i}, 1)">+</button>
                        </div>
                        <button class="wc-shop-remove" onclick="removeWechatShopCart(${i})">删除</button>
                    </div>
                </div>
            `).join('') : '<div class="wc-discover-empty wc-shop-empty-cart"><i class="ri-shopping-bag-3-line"></i><span>购物车为空</span><p>先去挑几件想买的东西</p><button onclick="renderWechatShop(\'home\')">去逛逛</button></div>'}
            <div class="wc-shop-total"><span>共 ${itemCount} 件</span><strong>合计 ¥${total.toFixed(2)}</strong></div>
            <textarea id="wc-shop-address" placeholder="填写收货地址">${wcEscapeHtml(store.lastAddress || '')}</textarea>
            <div class="wc-shop-payer-picker">
                <input type="hidden" id="wc-shop-payer" value="${wcEscapeHtml(store.lastPayer || 'self')}">
                <button type="button" data-payer-id="self" class="${store.lastPayer === 'self' || !store.lastPayer ? 'active' : ''}" onclick="selectWechatShopPayer('self')"><i class="ri-wallet-3-line"></i><span>自己付款</span></button>
                ${(window.myCharacters || []).map(c => `<button type="button" data-payer-id="${wcEscapeHtml(c.id)}" class="${store.lastPayer === c.id ? 'active' : ''}" onclick="selectWechatShopPayer('${wcEscapeHtml(c.id)}')"><img src="${wcEscapeHtml(c.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'"><span>${wcEscapeHtml((c.chatConfig && c.chatConfig.nickname) || c.name)}</span></button>`).join('')}
            </div>
            <div class="wc-shop-cart-actions">
                <button onclick="renderWechatShop('home')">继续逛</button>
                <button onclick="clearWechatShopCart()" ${store.cart.length ? '' : 'disabled'}>清空</button>
            </div>
            <button class="wc-shop-checkout" onclick="checkoutWechatShop()" ${store.cart.length ? '' : 'disabled'}>结账 / 发送代付</button>
            <button class="wc-shop-intimate" onclick="requestWechatShopIntimatePay()" ${store.cart.length ? '' : 'disabled'}>让角色开通亲密付</button>
        </div>
    `;
}

function renderWechatShopMe(store) {
    return `
        <div class="wc-shop-me-card">
            <strong>我的购物</strong>
            <span>订单 ${store.orders.length} · 商品 ${store.custom.length}</span>
        </div>
        <div class="wc-shop-cart">
            <h4>亲密付</h4>
            ${Object.keys(store.intimatePay || {}).length ? Object.entries(store.intimatePay).map(([charId, item]) => {
                const char = (window.myCharacters || []).find(c => c.id === charId);
                return `<div class="wc-shop-order"><strong>¥${Number(item.limit || 0).toFixed(2)}</strong><span>${wcEscapeHtml(char ? getWechatCharDisplayName(char) : '角色')} · ${wcEscapeHtml(item.status || '已开通')}</span><em>${wcEscapeHtml(item.note || '可用于购物代付')}</em></div>`;
            }).join('') : '<div class="wc-discover-empty">还没有亲密付</div>'}
        </div>
        <div class="wc-shop-cart">
            <h4>订单记录</h4>
            ${store.orders.length ? store.orders.slice().reverse().map(order => `
                <div class="wc-shop-order">
                    <strong>¥${Number(order.total || 0).toFixed(2)}</strong>
                    <span>${formatWechatRelativeTime(order.createdAt)} · ${wcEscapeHtml(order.payer === 'self' ? '自己付款' : '代付请求')}</span>
                    <em>${wcEscapeHtml(getWechatShopCartSummary(order.items || []))}</em>
                </div>
            `).join('') : '<div class="wc-discover-empty">还没有订单</div>'}
        </div>
    `;
}

function addWechatShopCart(productId) {
    const product = getWechatShopProducts().find(p => p.id === productId);
    if (!product) return;
    const store = getWechatShopStore();
    const existing = store.cart.find(item => String(item.id) === String(product.id));
    if (existing) {
        existing.qty = Math.min(99, (parseInt(existing.qty || 1, 10) || 1) + 1);
    } else {
        store.cart.push(normalizeWechatShopCartItem({
            id: product.id,
            name: product.name,
            price: product.price,
            tag: product.tag,
            image: product.image,
            description: product.description,
            gradient: product.gradient
        }));
    }
    saveWechatShopStore(store);
    showWechatToast('已加入购物车');
    renderWechatShop(window._wechatShopTab === 'cart' ? 'cart' : 'home', document.querySelector('.wc-shop-search input')?.value || window._wechatShopKeyword || '');
}

function removeWechatShopCart(index) {
    const store = getWechatShopStore();
    store.cart.splice(index, 1);
    saveWechatShopStore(store);
    renderWechatShop('cart');
}

function updateWechatShopCartQty(index, delta) {
    const store = getWechatShopStore();
    const item = store.cart[index];
    if (!item) return;
    item.qty = (parseInt(item.qty || 1, 10) || 1) + delta;
    if (item.qty <= 0) store.cart.splice(index, 1);
    if (item.qty > 99) item.qty = 99;
    saveWechatShopStore(store);
    renderWechatShop('cart');
}

function clearWechatShopCart() {
    const store = getWechatShopStore();
    if (!store.cart.length) return;
    if (!confirm('确定清空购物车吗？')) return;
    store.cart = [];
    saveWechatShopStore(store);
    renderWechatShop('cart');
}

function normalizeWechatShopSourceProducts(payload, sourceName = '聚合源') {
    const rawList = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.products) ? payload.products : (Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload?.data) ? payload.data : [])));
    return rawList
        .map((item, index) => normalizeWechatShopProductForDisplay({
            ...item,
            id: `src_${sourceName}_${item.id || Date.now()}_${index}`,
            source: sourceName
        }, index, sourceName))
        .filter(item => item && item.price > 0)
        .slice(0, 40);
}

async function loadWechatShopSource(options = {}) {
    const btn = document.querySelector('.wc-shop-refresh-btn, .wc-shop-source-card button');
    const store = getWechatShopStore();
    const keyword = options.keyword ?? document.querySelector('.wc-shop-search input')?.value ?? window._wechatShopKeyword ?? '';
    const silent = !!options.silent;
    store.sourceUrl = WECHAT_SHOP_AGGREGATE_SOURCE_ID;
    saveWechatShopStore(store);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ri-loader-4-line"></i><span>更新中</span>';
    }
    try {
        const payloads = await Promise.allSettled(WECHAT_SHOP_AGGREGATE_SOURCES.map(async source => {
            const url = source.url.includes('{q}')
                ? source.url.replace(/\{q\}/g, encodeURIComponent(keyword || ''))
                : source.url;
            const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
            if (!resp.ok) throw new Error(`${source.name} 返回 ${resp.status}`);
            const json = await resp.json();
            return normalizeWechatShopSourceProducts(json, source.name);
        }));
        const products = payloads.flatMap(result => result.status === 'fulfilled' ? result.value : []);
        if (!products.length) throw new Error('没有解析到商品');
        const next = getWechatShopStore();
        next.sourceUrl = WECHAT_SHOP_AGGREGATE_SOURCE_ID;
        next.sourceSyncedAt = Date.now();
        next.sourceProducts = products.slice(0, 48);
        saveWechatShopStore(next);
        if (!silent) showWechatToast(`已更新 ${next.sourceProducts.length} 个商品`);
        renderWechatShop('home', keyword);
    } catch (e) {
        if (!silent) showWechatToast(e.message || '商品更新失败');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="ri-refresh-line"></i>';
        }
    }
}

function addWechatCustomProduct() {
    const name = (document.getElementById('wc-shop-custom-name')?.value || '').trim();
    const price = Number(document.getElementById('wc-shop-custom-price')?.value || 0);
    const tag = (document.getElementById('wc-shop-custom-tag')?.value || '自定义').trim();
    const image = (document.getElementById('wc-shop-custom-image')?.value || '').trim();
    const description = (document.getElementById('wc-shop-custom-desc')?.value || '').trim();
    if (!name || price <= 0) return;
    const store = getWechatShopStore();
    store.custom.push({ id: 'cp_' + Date.now(), name, price, tag, image, description, gradient: getWechatGeneratedGradient(name + tag)[0] });
    saveWechatShopStore(store);
    renderWechatShop('home');
}

async function generateWechatShopProduct() {
    const briefEl = document.getElementById('wc-shop-ai-brief');
    const btn = document.querySelector('.wc-shop-ai-card button');
    const brief = (briefEl?.value || '').trim() || '适合微信购物页的真实感商品';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中';
    }
    const result = await callChatApi([
        { role: 'system', content: '你是电商商品策划。只输出 JSON 对象，不要解释。字段：name、tag、price、description、imagePrompt，可选 imageUrl。标题和内容要像淘宝商品但不要夸张营销。' },
        { role: 'user', content: `生成一个商品：${brief}。如果不能直接生成图片 URL，就写 imagePrompt。` }
    ]);
    const parsed = result.ok ? parseWechatAiJsonPayload(result.content) : null;
    if (!result.ok || !parsed) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'AI 生成商品';
        }
        alert(result.ok ? 'AI 返回格式无法解析，再试一次。' : result.error);
        return;
    }
    const product = Array.isArray(parsed) ? parsed[0] : parsed;
    const name = String(product.name || product.title || '').trim();
    if (!name) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'AI 生成商品';
        }
        alert('AI 没有返回商品标题，再试一次。');
        return;
    }
    const imagePrompt = String(product.imagePrompt || product.prompt || product.description || name).trim();
    let image = String(product.imageUrl || product.image || '').trim();
    if (!image && imagePrompt) {
        const imageResult = await callWechatImageGenerationApi(`电商商品主图，干净真实，白底或浅色场景，主体清晰：${imagePrompt}`);
        if (imageResult.ok) image = imageResult.url;
    }
    const store = getWechatShopStore();
    store.custom.unshift({
        id: 'cp_ai_' + Date.now(),
        name,
        tag: String(product.tag || product.category || 'AI生成').trim(),
        price: Number(product.price || 99),
        description: String(product.description || product.content || imagePrompt || '').trim(),
        image,
        gradient: getWechatGeneratedGradient(name + brief)[0]
    });
    saveWechatShopStore(store);
    renderWechatShop('home');
}

async function callWechatImageGenerationApi(prompt, options = {}) {
    const api = typeof getDefaultImageApi === 'function'
        ? getDefaultImageApi()
        : (typeof getDefaultApi === 'function' ? getDefaultApi() : null);
    if (!api || !api.baseUrl) return { ok: false, error: '未配置生图 API' };
    const baseUrl = api.baseUrl.replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (api.apiKey) headers.Authorization = `Bearer ${api.apiKey}`;
    const imageModel = String(api.imageModel || '').trim();
    if (!imageModel) {
        return { ok: false, error: '当前默认生图 API 没有选择生图模型。请在设置里测试 API 后从生图模型下拉选择，或单独添加一个生图 API。' };
    }
    const referenceImage = String(options.referenceImage || '').trim();
    const enhancedPrompt = [
        String(prompt || '').trim(),
        referenceImage ? '需要尽量保持参考图中的角色脸型、发型、气质和整体辨识度。' : ''
    ].filter(Boolean).join('\n');
    const buildBody = includeReference => {
        const body = {
            model: imageModel,
            prompt: enhancedPrompt,
            size: options.size || '1024x1024',
            response_format: 'b64_json'
        };
        if (includeReference && referenceImage) {
            body.image = referenceImage;
            body.reference_image = referenceImage;
            body.images = [referenceImage];
        }
        return body;
    };
    const parseImageResponse = async resp => {
        if (!resp.ok) return { ok: false, status: resp.status, error: await resp.text().catch(() => '图片生成失败') };
        const json = await resp.json();
        const first = json.data && json.data[0];
        if (first?.url) return { ok: true, url: first.url };
        if (first?.b64_json) return { ok: true, url: 'data:image/png;base64,' + first.b64_json };
        return { ok: false, error: '图片接口没有返回图片' };
    };
    try {
        const resp = await fetch(baseUrl + '/images/generations', {
            method: 'POST',
            headers,
            body: JSON.stringify(buildBody(!!referenceImage)),
            signal: AbortSignal.timeout(45000)
        });
        const result = await parseImageResponse(resp);
        if (!result.ok && referenceImage && result.status === 400) {
            const retry = await fetch(baseUrl + '/images/generations', {
                method: 'POST',
                headers,
                body: JSON.stringify(buildBody(false)),
                signal: AbortSignal.timeout(45000)
            });
            return parseImageResponse(retry);
        }
        return result;
    } catch (e) {
        return { ok: false, error: e.message || '图片生成失败' };
    }
}

function selectWechatShopPayer(payerId) {
    const input = document.getElementById('wc-shop-payer');
    if (input) input.value = payerId || 'self';
    document.querySelectorAll('.wc-shop-payer-picker button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.payerId === String(payerId || 'self'));
    });
}
window.selectWechatShopPayer = selectWechatShopPayer;

function appendWechatShoppingContextRecord(order, kind = 'shop') {
    const store = getWechatShopStore();
    store.recentContext = Array.isArray(store.recentContext) ? store.recentContext : [];
    const label = kind === 'takeout' ? '外卖' : '购物';
    store.recentContext.unshift({
        id: order.id || `${kind}_${Date.now()}`,
        kind,
        text: `${label}：${order.summary || getWechatShopCartSummary(order.items || []) || order.shopName || ''}，合计 ¥${Number(order.total || 0).toFixed(2)}`,
        payer: order.payer || 'self',
        createdAt: order.createdAt || Date.now()
    });
    store.recentContext = store.recentContext.slice(0, 12);
    saveWechatShopStore(store);
}

function sendWechatShopPayRequest(charId, order) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    sendWechatMessageToChar(charId, {
        type: 'share_card',
        isMe: true,
        card: {
            action: 'shop_pay',
            title: '帮我代付这单',
            text: getWechatShopCartSummary(order.items || []),
            source: 'BYND 购物',
            order
        }
    });
}

function checkoutWechatShop() {
    const store = getWechatShopStore();
    if (!store.cart.length) return;
    const address = (document.getElementById('wc-shop-address')?.value || '').trim();
    if (!address) {
        alert('先填写收货地址');
        return;
    }
    const payer = document.getElementById('wc-shop-payer')?.value || 'self';
    const total = getWechatShopCartTotal(store);
    const summary = getWechatShopCartSummary(store.cart);
    const order = { id: 'ord_' + Date.now(), items: store.cart.map(item => ({ ...item })), address, total, payer, createdAt: Date.now() };
    store.orders.push(order);
    store.lastAddress = address;
    store.lastPayer = payer;
    store.cart = [];
    saveWechatShopStore(store);
    appendWechatShoppingContextRecord({ ...order, summary }, 'shop');
    if (payer === 'self') {
        showWechatToast('订单已提交，已选择自己付款');
        renderWechatShop('me');
        return;
    }
    sendWechatShopPayRequest(payer, { ...order, summary });
    renderWechatShop('me');
}

const WECHAT_TAKEOUT_RESTAURANTS = [
    { id: 'noodle', name: '蓝骑士牛肉面', tag: '面馆', score: 4.8, time: '28分钟', fee: 3, gradient: 'linear-gradient(135deg,#e8f3ff,#1677ff)', dishes: [
        { id: 'n1', name: '番茄牛腩面', price: 24.8 }, { id: 'n2', name: '溏心蛋', price: 4 }, { id: 'n3', name: '冰豆浆', price: 7 }
    ]},
    { id: 'tea', name: '月光奶茶研究所', tag: '奶茶甜品', score: 4.7, time: '22分钟', fee: 2, gradient: 'linear-gradient(135deg,#fff7ed,#fb923c)', dishes: [
        { id: 't1', name: '茉莉奶绿', price: 16 }, { id: 't2', name: '芋泥波波', price: 19 }, { id: 't3', name: '芝士草莓', price: 22 }
    ]},
    { id: 'rice', name: '轻食便当局', tag: '便当轻食', score: 4.9, time: '35分钟', fee: 4, gradient: 'linear-gradient(135deg,#f0fdf4,#22c55e)', dishes: [
        { id: 'r1', name: '照烧鸡腿饭', price: 29.9 }, { id: 'r2', name: '虾仁沙拉', price: 32 }, { id: 'r3', name: '味噌汤', price: 6 }
    ]},
    { id: 'hotpot', name: '深夜麻辣烫', tag: '夜宵', score: 4.6, time: '31分钟', fee: 5, gradient: 'linear-gradient(135deg,#fff1f2,#ef4444)', dishes: [
        { id: 'h1', name: '自选麻辣烫套餐', price: 35 }, { id: 'h2', name: '肥牛加份', price: 12 }, { id: 'h3', name: '酸梅汤', price: 8 }
    ]}
];

function getWechatTakeoutStore() {
    const store = readWechatStore(WECHAT_TAKEOUT_STORAGE_KEY, { cart: [], orders: [], customShops: [], images: {}, lastAddress: '', lastPayer: 'self' });
    store.cart = Array.isArray(store.cart) ? store.cart : [];
    store.orders = Array.isArray(store.orders) ? store.orders : [];
    store.customShops = Array.isArray(store.customShops) ? store.customShops : [];
    store.images = store.images && typeof store.images === 'object' ? store.images : {};
    store.lastAddress = typeof store.lastAddress === 'string' ? store.lastAddress : '';
    store.lastPayer = typeof store.lastPayer === 'string' ? store.lastPayer : 'self';
    return store;
}

function saveWechatTakeoutStore(store) {
    writeWechatStore(WECHAT_TAKEOUT_STORAGE_KEY, store);
}

function openWechatTakeout() {
    renderWechatTakeout('home');
}
window.openWechatTakeout = openWechatTakeout;

function normalizeWechatTakeoutShop(shop, index = 0) {
    if (!shop || typeof shop !== 'object') return null;
    const name = String(shop.name || shop.shopName || '').trim();
    if (!name) return null;
    const dishes = Array.isArray(shop.dishes) ? shop.dishes.map((dish, dishIndex) => {
        const dishName = String(dish && (dish.name || dish.title) || '').trim();
        if (!dishName) return null;
        return {
            id: String(dish.id || `dish_${index}_${dishIndex}_${dishName}`).replace(/\s+/g, '_'),
            name: dishName,
            price: Number(dish.price || dish.amount || 18 + dishIndex * 4) || 18,
            desc: String(dish.desc || dish.description || '').trim(),
            image: String(dish.image || dish.imageUrl || '').trim()
        };
    }).filter(Boolean) : [];
    return {
        ...shop,
        id: String(shop.id || `takeout_${index}_${name}`).replace(/\s+/g, '_'),
        name,
        tag: String(shop.tag || shop.category || '外卖').trim(),
        score: Number(shop.score || 4.7),
        time: String(shop.time || shop.deliveryTime || `${24 + index * 3}分钟`).trim(),
        fee: Number(shop.fee || shop.deliveryFee || 3) || 0,
        gradient: shop.gradient || getWechatGeneratedGradient(name + (shop.tag || '外卖'))[0],
        dishes
    };
}

function getWechatTakeoutRestaurants() {
    const store = getWechatTakeoutStore();
    const custom = (store.customShops || []).map((shop, index) => normalizeWechatTakeoutShop(shop, 100 + index)).filter(Boolean);
    return [...WECHAT_TAKEOUT_RESTAURANTS.map((shop, index) => normalizeWechatTakeoutShop(shop, index)).filter(Boolean), ...custom];
}

function getWechatTakeoutShop(shopId) {
    return getWechatTakeoutRestaurants().find(shop => String(shop.id) === String(shopId));
}

function getWechatTakeoutDish(shopId, dishId) {
    const shop = getWechatTakeoutShop(shopId);
    const dish = shop && shop.dishes.find(item => String(item.id) === String(dishId));
    return shop && dish ? { shop, dish } : null;
}

function getWechatTakeoutImageKey(shopId, dishId = '') {
    return `${shopId}::${dishId || 'shop'}`;
}

function getWechatTakeoutSavedImage(shopId, dishId = '') {
    const store = getWechatTakeoutStore();
    return store.images[getWechatTakeoutImageKey(shopId, dishId)] || '';
}

function renderWechatTakeoutTextCover(shop, dish = null, mode = '') {
    const title = dish ? dish.name : shop.name;
    const sub = dish ? shop.name : shop.tag;
    const image = dish ? (dish.image || getWechatTakeoutSavedImage(shop.id, dish.id)) : getWechatTakeoutSavedImage(shop.id);
    if (image) {
        return `<div class="wc-takeout-text-cover ${mode} has-image"><img src="${wcEscapeHtml(image)}" loading="lazy" onerror="this.closest('.wc-takeout-text-cover').classList.remove('has-image');this.remove()"></div>`;
    }
    return `
        <div class="wc-takeout-text-cover ${mode}" style="background:${shop.gradient || getWechatGeneratedGradient(title + sub)[0]}">
            <span>${wcEscapeHtml(shop.tag || '外卖')}</span>
            <strong>${wcEscapeHtml(title)}</strong>
            <em>${wcEscapeHtml(sub || 'BYND 外卖')}</em>
        </div>
    `;
}

function renderWechatTakeout(tab = 'home') {
    const store = getWechatTakeoutStore();
    const count = store.cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    const content = tab === 'cart' ? renderWechatTakeoutCart(store) : renderWechatTakeoutHome(store);
    openWechatFeatureScreen('外卖', `
        <div class="wc-takeout-app">
            <div class="wc-takeout-content">${content}</div>
            <div class="wc-takeout-tabbar">
                <button class="${tab === 'home' ? 'active' : ''}" onclick="renderWechatTakeout('home')"><i class="ri-store-2-line"></i><span>外卖</span></button>
                <button class="${tab === 'cart' ? 'active' : ''}" onclick="renderWechatTakeout('cart')"><i class="ri-shopping-basket-2-line"></i><span>购物车${count ? `(${count})` : ''}</span></button>
            </div>
        </div>
    `);
}

function renderWechatTakeoutHome() {
    const shops = getWechatTakeoutRestaurants();
    return `
        <section class="wc-takeout-hero">
            <div><span>ELE STYLE</span><strong>今天想吃什么</strong><p>附近好店、热卖小吃和角色代点都放在这里，想吃什么先丢进篮子。</p></div>
            <i class="ri-riding-line"></i>
        </section>
        <div class="wc-takeout-search"><i class="ri-search-line"></i><input placeholder="搜索商家、菜品"></div>
        <div class="wc-takeout-cats"><button class="active">全部</button><button>奶茶</button><button>夜宵</button><button>轻食</button><button>热卖</button></div>
        <details class="wc-takeout-ai-panel">
            <summary><span>AI 生成外卖店</span><em>先生成文字菜单，点菜品后再生成真实图片</em><i class="ri-arrow-down-s-line"></i></summary>
            <div>
                <input id="wc-takeout-ai-brief" placeholder="例如：雨夜适合两个人吃的热汤外卖">
                <button type="button" onclick="generateWechatTakeoutShop()">AI 生成</button>
            </div>
        </details>
        <div class="wc-takeout-list">
            ${shops.map(shop => `
                <article class="wc-takeout-shop" onclick="openWechatTakeoutShop(${quoteWechatJsString(shop.id)})">
                    ${renderWechatTakeoutTextCover(shop, null, 'shop')}
                    <div class="wc-takeout-main">
                        <div class="wc-takeout-title"><strong>${wcEscapeHtml(shop.name)}</strong><span>${wcEscapeHtml(shop.time)}</span></div>
                        <p>${wcEscapeHtml(shop.tag)} · ${shop.score} 分 · 配送 ¥${shop.fee}</p>
                        <div class="wc-takeout-dishes">
                            ${shop.dishes.map(dish => `<button onclick="event.stopPropagation();openWechatTakeoutDish(${quoteWechatJsString(shop.id)}, ${quoteWechatJsString(dish.id)})"><span>${wcEscapeHtml(dish.name)}</span><b>¥${dish.price.toFixed(2)}</b></button>`).join('')}
                        </div>
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

function openWechatTakeoutShop(shopId) {
    const shop = getWechatTakeoutShop(shopId);
    if (!shop) return;
    openWechatFeatureScreen('外卖店铺', `
        <div class="wc-takeout-app wc-takeout-detail-app">
            <div class="wc-takeout-content">
                <section class="wc-takeout-shop-detail-head">
                    ${renderWechatTakeoutTextCover(shop, null, 'detail')}
                    <div>
                        <span>${wcEscapeHtml(shop.tag)} · ${shop.score} 分</span>
                        <h3>${wcEscapeHtml(shop.name)}</h3>
                        <p>${wcEscapeHtml(shop.time)} · 配送 ¥${Number(shop.fee || 0).toFixed(0)} · 图片会在菜品详情里生成</p>
                    </div>
                </section>
                <div class="wc-takeout-detail-dishes">
                    ${shop.dishes.map(dish => `
                        <button type="button" onclick="openWechatTakeoutDish(${quoteWechatJsString(shop.id)}, ${quoteWechatJsString(dish.id)})">
                            ${renderWechatTakeoutTextCover(shop, dish, 'mini')}
                            <span><strong>${wcEscapeHtml(dish.name)}</strong><em>${wcEscapeHtml(dish.desc || shop.tag)}</em></span>
                            <b>¥${Number(dish.price || 0).toFixed(2)}</b>
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `);
}

function openWechatTakeoutDish(shopId, dishId) {
    const found = getWechatTakeoutDish(shopId, dishId);
    if (!found) return;
    const { shop, dish } = found;
    openWechatFeatureScreen('菜品详情', renderWechatTakeoutDishDetail(shop, dish), `<button type="button" class="wc-feature-cart-btn" onclick="renderWechatTakeout('cart')" aria-label="打开外卖购物车"><i class="ri-shopping-basket-2-line"></i></button>`);
    if (!dish.image && !getWechatTakeoutSavedImage(shop.id, dish.id) && !window._wechatTakeoutImageGenerating?.[getWechatTakeoutImageKey(shop.id, dish.id)]) {
        setTimeout(() => ensureWechatTakeoutDishImage(shop.id, dish.id), 120);
    }
}

function renderWechatTakeoutDishDetail(shop, dish) {
    const image = dish.image || getWechatTakeoutSavedImage(shop.id, dish.id);
    return `
        <div class="wc-takeout-app wc-takeout-detail-app">
            <div class="wc-takeout-content">
                <section class="wc-takeout-dish-cover">
                    ${image ? `<img src="${wcEscapeHtml(image)}" loading="lazy" onerror="this.remove(); ensureWechatTakeoutDishImage(${quoteWechatJsString(shop.id)}, ${quoteWechatJsString(dish.id)})">` : `${renderWechatTakeoutTextCover(shop, dish, 'detail')}<div class="wc-takeout-image-status"><i class="ri-loader-4-line"></i><span>正在生成真实菜品图</span></div>`}
                </section>
                <section class="wc-takeout-dish-card">
                    <div><span>${wcEscapeHtml(shop.name)}</span><b>¥${Number(dish.price || 0).toFixed(2)}</b></div>
                    <h3>${wcEscapeHtml(dish.name)}</h3>
                    <p>${wcEscapeHtml(dish.desc || `${shop.tag} · ${shop.time} · 配送 ¥${shop.fee}`)}</p>
                    <button type="button" onclick="addWechatTakeoutCart(${quoteWechatJsString(shop.id)}, ${quoteWechatJsString(dish.id)})"><i class="ri-add-line"></i><span>加入外卖购物车</span></button>
                </section>
            </div>
        </div>
    `;
}

function saveWechatTakeoutImage(shopId, dishId, imageUrl) {
    const store = getWechatTakeoutStore();
    store.images[getWechatTakeoutImageKey(shopId, dishId)] = imageUrl;
    store.customShops = (store.customShops || []).map(shop => {
        if (String(shop.id) !== String(shopId)) return shop;
        return {
            ...shop,
            dishes: (shop.dishes || []).map(dish => String(dish.id) === String(dishId) ? { ...dish, image: imageUrl } : dish)
        };
    });
    saveWechatTakeoutStore(store);
}

async function ensureWechatTakeoutDishImage(shopId, dishId) {
    const found = getWechatTakeoutDish(shopId, dishId);
    if (!found) return '';
    const key = getWechatTakeoutImageKey(shopId, dishId);
    if (getWechatTakeoutSavedImage(shopId, dishId)) return getWechatTakeoutSavedImage(shopId, dishId);
    window._wechatTakeoutImageGenerating = window._wechatTakeoutImageGenerating || {};
    if (window._wechatTakeoutImageGenerating[key]) return '';
    window._wechatTakeoutImageGenerating[key] = true;
    const status = document.querySelector('.wc-takeout-image-status');
    if (status) status.innerHTML = '<i class="ri-loader-4-line"></i><span>正在生成真实菜品图</span>';
    const { shop, dish } = found;
    const prompt = `真实外卖平台菜品照片，手机外卖详情页主图，食物清晰诱人，干净自然光，浅色背景，店铺：${shop.name}，菜品：${dish.name}，类型：${shop.tag}，说明：${dish.desc || dish.name}`;
    const result = await callWechatImageGenerationApi(prompt, { size: '1024x1024' });
    delete window._wechatTakeoutImageGenerating[key];
    if (result.ok && result.url) {
        saveWechatTakeoutImage(shopId, dishId, result.url);
        openWechatTakeoutDish(shopId, dishId);
        return result.url;
    }
    if (status) status.innerHTML = `<i class="ri-error-warning-line"></i><span>${wcEscapeHtml(result.error || '菜品图片生成失败')}</span><button type="button" onclick="ensureWechatTakeoutDishImage(${quoteWechatJsString(shopId)}, ${quoteWechatJsString(dishId)})">重试</button>`;
    return '';
}

async function generateWechatTakeoutShop() {
    const briefEl = document.getElementById('wc-takeout-ai-brief');
    const btn = document.querySelector('.wc-takeout-ai-panel button');
    const brief = (briefEl?.value || '').trim() || '适合今晚吃的外卖';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中';
    }
    try {
        const result = await callChatApi([
            { role: 'system', content: '你是外卖菜单策划。只输出 JSON 对象，不要解释。字段：name、tag、score、time、fee、dishes。dishes 是 3 到 5 个菜品，每项字段 id、name、price、desc。不要生成图片 URL。名字和菜品要像真实外卖平台。' },
            { role: 'user', content: `生成一个外卖店和菜单：${brief}` }
        ]);
        const parsed = result.ok ? parseWechatAiJsonPayload(result.content) : null;
        if (!result.ok || !parsed) throw new Error(result.error || 'AI 返回格式无法解析');
        const shop = normalizeWechatTakeoutShop({
            ...parsed,
            id: 'take_ai_' + Date.now(),
            gradient: getWechatGeneratedGradient(`${parsed.name || brief}${parsed.tag || ''}`)[0]
        }, 300);
        if (!shop || !shop.dishes.length) throw new Error('AI 没有返回可用菜单');
        const store = getWechatTakeoutStore();
        store.customShops.unshift(shop);
        store.customShops = store.customShops.slice(0, 16);
        saveWechatTakeoutStore(store);
        showWechatToast('已生成外卖店');
        renderWechatTakeout('home');
    } catch (e) {
        alert(e.message || '生成失败');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'AI 生成';
        }
    }
}

function addWechatTakeoutCart(shopId, dishId) {
    const found = getWechatTakeoutDish(shopId, dishId);
    if (!found) return;
    const { shop, dish } = found;
    const store = getWechatTakeoutStore();
    const existing = store.cart.find(item => item.shopId === shopId && item.id === dishId);
    if (existing) existing.qty = Math.min(20, (existing.qty || 1) + 1);
    else store.cart.push({ ...dish, image: dish.image || getWechatTakeoutSavedImage(shop.id, dish.id), shopId, shopName: shop.name, fee: shop.fee, qty: 1 });
    saveWechatTakeoutStore(store);
    showWechatToast('已加入外卖购物车');
}
window.addWechatTakeoutCart = addWechatTakeoutCart;
window.openWechatTakeoutShop = openWechatTakeoutShop;
window.openWechatTakeoutDish = openWechatTakeoutDish;
window.ensureWechatTakeoutDishImage = ensureWechatTakeoutDishImage;
window.generateWechatTakeoutShop = generateWechatTakeoutShop;

function renderWechatTakeoutCart(store) {
    const total = store.cart.reduce((sum, item) => sum + Number(item.price || 0) * (item.qty || 1), 0) + (store.cart[0]?.fee || 0);
    const summary = store.cart.map(item => `${item.name} ×${item.qty || 1}`).join('、');
    return `
        <div class="wc-takeout-cart-card">
            <h4>外卖购物车 <em>${store.cart.length} 种</em></h4>
            ${store.cart.length ? store.cart.map((item, index) => `
                <div class="wc-takeout-cart-row">
                    <div class="wc-takeout-cart-thumb" style="background:${wcEscapeHtml(getWechatGeneratedGradient((item.shopName || '') + item.name)[0])}">${item.image ? `<img src="${wcEscapeHtml(item.image)}" loading="lazy" onerror="this.style.display='none'">` : `<span>${wcEscapeHtml(String(item.name || '餐').slice(0, 1))}</span>`}</div>
                    <div><strong>${wcEscapeHtml(item.name)}</strong><span>${wcEscapeHtml(item.shopName)} · ¥${Number(item.price || 0).toFixed(2)}</span></div>
                    <b>×${item.qty || 1}</b>
                    <button onclick="removeWechatTakeoutCart(${index})">删除</button>
                </div>
            `).join('') : '<div class="wc-discover-empty">还没有点餐</div>'}
            <textarea id="wc-takeout-address" placeholder="填写收餐地址">${wcEscapeHtml(store.lastAddress || '')}</textarea>
            <div class="wc-shop-payer-picker wc-takeout-payer-picker">
                <input type="hidden" id="wc-takeout-payer" value="${wcEscapeHtml(store.lastPayer || 'self')}">
                <button type="button" data-payer-id="self" class="${store.lastPayer === 'self' || !store.lastPayer ? 'active' : ''}" onclick="selectWechatTakeoutPayer('self')"><i class="ri-wallet-3-line"></i><span>自己下单</span></button>
                ${(window.myCharacters || []).map(c => `<button type="button" data-payer-id="${wcEscapeHtml(c.id)}" class="${store.lastPayer === c.id ? 'active' : ''}" onclick="selectWechatTakeoutPayer('${wcEscapeHtml(c.id)}')"><img src="${wcEscapeHtml(c.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'"><span>${wcEscapeHtml(getWechatCharDisplayName(c))}</span></button>`).join('')}
            </div>
            <div class="wc-shop-total"><span>${wcEscapeHtml(summary || '未选择菜品')}</span><strong>¥${total.toFixed(2)}</strong></div>
            <button class="wc-shop-checkout" onclick="checkoutWechatTakeout()" ${store.cart.length ? '' : 'disabled'}>下单 / 让角色帮点</button>
        </div>
    `;
}

function selectWechatTakeoutPayer(payerId) {
    const input = document.getElementById('wc-takeout-payer');
    if (input) input.value = payerId || 'self';
    document.querySelectorAll('.wc-takeout-payer-picker button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.payerId === String(payerId || 'self'));
    });
}
window.selectWechatTakeoutPayer = selectWechatTakeoutPayer;

function removeWechatTakeoutCart(index) {
    const store = getWechatTakeoutStore();
    store.cart.splice(index, 1);
    saveWechatTakeoutStore(store);
    renderWechatTakeout('cart');
}
window.removeWechatTakeoutCart = removeWechatTakeoutCart;

function checkoutWechatTakeout() {
    const store = getWechatTakeoutStore();
    if (!store.cart.length) return;
    const address = (document.getElementById('wc-takeout-address')?.value || '').trim();
    if (!address) { alert('先填写收餐地址'); return; }
    const payer = document.getElementById('wc-takeout-payer')?.value || 'self';
    const total = store.cart.reduce((sum, item) => sum + Number(item.price || 0) * (item.qty || 1), 0) + (store.cart[0]?.fee || 0);
    const summary = store.cart.map(item => `${item.name} ×${item.qty || 1}`).join('、');
    const order = { id: 'take_' + Date.now(), items: store.cart.map(item => ({ ...item })), shopName: store.cart[0]?.shopName || '外卖', summary, address, total, payer, createdAt: Date.now() };
    store.orders.push(order);
    store.lastAddress = address;
    store.lastPayer = payer;
    store.cart = [];
    saveWechatTakeoutStore(store);
    appendWechatShoppingContextRecord(order, 'takeout');
    if (payer !== 'self') {
        sendWechatMessageToChar(payer, { type: 'share_card', isMe: true, card: { action: 'takeout_pay', title: '帮我点外卖', text: summary, source: 'BYND 外卖', order } });
    } else {
        showWechatToast('外卖订单已提交');
    }
    renderWechatTakeout('home');
}
window.checkoutWechatTakeout = checkoutWechatTakeout;

async function startWechatScreenShare() {
    closeWechatPlusMenu();
    if (!window.currentChatCharId) {
        showWechatToast('先打开一个聊天，再共享屏幕');
        return;
    }
    const charId = window.currentChatCharId;
    const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    if (!supported) {
        sendWechatMessageToChar(charId, { type: 'share_card', isMe: true, card: { action: 'screen_share', title: '共享屏幕不可用', text: '当前浏览器没有开放屏幕共享权限，可以换支持屏幕共享的浏览器或桌面端再试。', source: '共享屏幕' } });
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        window._wechatScreenShareStream = stream;
        sendWechatMessageToChar(charId, { type: 'share_card', isMe: true, card: { action: 'screen_share', title: '我开始共享屏幕了', text: '浏览器已授权共享当前屏幕/标签页，角色会结合你接下来发来的内容继续互动。', source: '共享屏幕' } });
        stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => showWechatToast('屏幕共享已结束')));
    } catch (e) {
        showWechatToast('已取消共享屏幕');
    }
}
window.startWechatScreenShare = startWechatScreenShare;

function sendWechatShopGift(productId) {
    const product = getWechatShopProducts().find(p => p.id === productId);
    if (!product) return;
    shareWechatText('礼物', `送你一份礼物：${product.name}`, {
        action: 'gift',
        title: '礼物',
        text: product.name,
        source: 'BYND 购物',
        product
    });
}

function shareWechatShopProduct(productId) {
    const product = getWechatShopProducts().find(p => p.id === productId);
    if (!product) {
        showWechatToast('这个商品已经不在列表里了');
        return;
    }
    shareWechatText('商品', `${product.name || '商品'} ¥${Number(product.price || 0).toFixed(2)}`, {
        action: 'product',
        title: product.name || '商品',
        text: product.description || product.tag || '',
        source: 'BYND 购物',
        images: product.image ? [product.image] : [],
        product: {
            id: product.id,
            name: product.name || '商品',
            price: product.price || 0,
            tag: product.tag || '精选好物',
            image: product.image || '',
            description: product.description || ''
        }
    });
}

function requestWechatShopIntimatePay() {
    const payer = document.getElementById('wc-shop-payer')?.value || '';
    if (!payer || payer === 'self') {
        showWechatToast('先在付款人里选择一个角色');
        return;
    }
    const total = getWechatShopCartTotal(getWechatShopStore());
    const limit = Math.max(100, Math.ceil(total || 520));
    sendWechatMessageToChar(payer, {
        type: 'intimatePay',
        isMe: true,
        amount: limit.toFixed(2),
        status: '待开通',
        note: `我想让你给我开通亲密付，额度 ¥${limit.toFixed(2)}`
    });
}

function sendWechatTextToChar(charId, text) {
    sendWechatMessageToChar(charId, { type: 'text', isMe: true, content: text });
}

function sendWechatMessageToChar(charId, msg) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    if (!char.history) char.history = [];
    const nextMsg = {
        ...msg,
        isMe: msg && typeof msg.isMe === 'boolean' ? msg.isMe : true,
        timestamp: msg && msg.timestamp ? msg.timestamp : createMessageTimestamp()
    };
    syncWechatMessageDescription(nextMsg);
    char.history.push(nextMsg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    if (nextMsg.isMe) notifyWechatMonitors(char, nextMsg);
    saveCharactersToStorage();
    renderChatList();
    closeWechatFeatureScreen();
    switchWcTab('chat');
    openChat(char.id);
}

function shareWechatText(title, text, payload = null) {
    const chars = window.myCharacters || [];
    if (!chars.length) {
        alert('还没有可转发的联系人');
        return;
    }
    let modal = document.getElementById('wc-share-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-share-modal';
        modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
        modal.innerHTML = `
            <div class="wc-compose-card wc-share-card">
                <div class="wc-compose-header">
                    <div class="wc-compose-title"><i class="ri-share-forward-line"></i><span>选择联系人</span></div>
                    <i class="ri-close-line" onclick="closeWechatShareModal()"></i>
                </div>
                <div class="wc-share-list" id="wc-share-list"></div>
            </div>
        `;
        getWechatModalRoot().appendChild(modal);
    }
    modal.dataset.shareTitle = title;
    modal.dataset.shareText = text;
    if (payload && typeof payload === 'object') modal.dataset.sharePayload = JSON.stringify(payload);
    else delete modal.dataset.sharePayload;
    document.getElementById('wc-share-list').innerHTML = chars.map(char => `
        <div class="wc-share-contact" onclick="confirmWechatShare(${quoteWechatJsString(char.id)})">
            <img src="${char.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
            <span>${wcEscapeHtml((char.chatConfig && char.chatConfig.nickname) || char.name || '未命名')}</span>
        </div>
    `).join('');
    modal.classList.remove('hidden');
}

function closeWechatShareModal() {
    const modal = document.getElementById('wc-share-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmWechatShare(charId) {
    const modal = document.getElementById('wc-share-modal');
    if (!modal) return;
    const title = modal.dataset.shareTitle || '';
    const text = modal.dataset.shareText || '';
    let payload = null;
    try {
        payload = modal.dataset.sharePayload ? JSON.parse(modal.dataset.sharePayload) : null;
    } catch (e) {
        payload = null;
    }
    closeWechatShareModal();
    if (payload && typeof payload === 'object') {
        if (payload.action === 'message_forward' && payload.message) {
            const forwarded = cloneWechatMessageForForward(payload.message);
            if (forwarded) {
                sendWechatMessageToChar(charId, forwarded);
                return;
            }
        }
        if (payload.action === 'gift' && payload.product) {
            const product = payload.product;
            sendWechatMessageToChar(charId, {
                type: 'gift',
                isMe: true,
                status: '待收取',
                item: {
                    name: product.name || '礼物',
                    price: product.price || '',
                    image: product.image || '',
                    description: product.description || ''
                },
                note: `送给你：${product.name || '礼物'}`
            });
            return;
        }
        sendWechatMessageToChar(charId, {
            type: 'share_card',
            isMe: true,
            card: {
                title: payload.title || title || '转发',
                text: payload.text || text || '',
                source: payload.source || title || '转发',
                images: Array.isArray(payload.images) ? payload.images.filter(Boolean).slice(0, 9) : [],
                action: payload.action || '',
                product: payload.product && typeof payload.product === 'object' ? payload.product : null,
                order: payload.order && typeof payload.order === 'object' ? payload.order : null
            }
        });
        return;
    }
    sendWechatTextToChar(charId, `我转发了${title}给你：${text}`);
}

// --- 💬 聊天设置面板 ---

const USER_PROFILE_KEY = 'my_user_profile';
const WECHAT_USER_PERSONA_LIBRARY_KEY = 'wechat_user_persona_library_v1';

function getUserProfile() {
    try {
        const raw = localStorage.getItem(USER_PROFILE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { avatar: '', name: '我', bio: '', wechatId: '' };
}

function saveUserProfile(profile) {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
}

function getWechatChatUserProfile(char) {
    const globalProfile = getUserProfile();
    const scoped = char && char.chatConfig && char.chatConfig.userProfile;
    return {
        avatar: scoped?.avatar || globalProfile.avatar || '',
        name: scoped?.name || globalProfile.name || '我',
        bio: scoped?.bio || '',
        signature: scoped?.signature || '',
        personaId: scoped?.personaId || '',
        wechatId: globalProfile.wechatId || '',
        momentCover: globalProfile.momentCover || ''
    };
}

function saveWechatChatUserProfile(char, profile) {
    if (!char) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.userProfile = {
        avatar: profile.avatar || '',
        name: profile.name || '我',
        bio: profile.bio || '',
        signature: profile.signature || '',
        personaId: profile.personaId || ''
    };
}

function getWechatUserPersonaLibrary() {
    try {
        const raw = localStorage.getItem(WECHAT_USER_PERSONA_LIBRARY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function saveWechatUserPersonaLibrary(list) {
    localStorage.setItem(WECHAT_USER_PERSONA_LIBRARY_KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, 30) : []));
}

function renderWechatUserPersonaLibrary(activeId = '') {
    const list = document.getElementById('wcs-user-persona-list');
    if (!list) return;
    const personas = getWechatUserPersonaLibrary();
    list.innerHTML = personas.length ? personas.map(item => `
        <button type="button" class="${item.id === activeId ? 'active' : ''}" onclick="applyWechatUserPersona(${quoteWechatJsString(item.id)})">
            <strong>${wcEscapeHtml(item.name || '未命名人设')}</strong>
            <span>${wcEscapeHtml((item.bio || item.signature || '').slice(0, 42) || '点击套用到当前聊天')}</span>
        </button>
    `).join('') : '<div class="wcs-persona-empty">还没有保存过 user 人设</div>';
}

function saveCurrentWechatUserPersona() {
    const name = (document.getElementById('wcs-user-name')?.value || '我').trim() || '我';
    const bio = (document.getElementById('wcs-user-bio')?.value || '').trim();
    const signature = (document.getElementById('wcs-user-signature')?.value || '').trim();
    if (!bio && !signature) {
        showWechatToast('先写个人简介或个性签名');
        return;
    }
    const personas = getWechatUserPersonaLibrary();
    const item = {
        id: 'persona_' + Date.now(),
        name,
        bio,
        signature,
        updatedAt: Date.now()
    };
    personas.unshift(item);
    saveWechatUserPersonaLibrary(personas);
    const char = getCurrentChatChar();
    if (char) {
        char.chatConfig = char.chatConfig || {};
        char.chatConfig.userProfile = {
            ...(char.chatConfig.userProfile || {}),
            name,
            bio,
            signature,
            personaId: item.id
        };
        saveCharactersToStorage();
    }
    renderWechatUserPersonaLibrary(item.id);
    showWechatToast('已保存到人设库');
}

function applyWechatUserPersona(personaId) {
    const item = getWechatUserPersonaLibrary().find(persona => persona.id === personaId);
    if (!item) return;
    const nameEl = document.getElementById('wcs-user-name');
    const bioEl = document.getElementById('wcs-user-bio');
    const signatureEl = document.getElementById('wcs-user-signature');
    if (nameEl) nameEl.value = item.name || '我';
    if (bioEl) bioEl.value = item.bio || '';
    if (signatureEl) signatureEl.value = item.signature || '';
    const char = getCurrentChatChar();
    if (char) {
        char.chatConfig = char.chatConfig || {};
        char.chatConfig.userProfile = {
            ...(char.chatConfig.userProfile || {}),
            name: item.name || '我',
            bio: item.bio || '',
            signature: item.signature || '',
            personaId
        };
        saveCharactersToStorage();
    }
    renderWechatUserPersonaLibrary(personaId);
    showWechatToast('已套用到当前聊天');
}

// CSS 气泡预览（实时）

function scopeWechatChatCustomCss(cssText) {
    const raw = String(cssText || '').trim();
    if (!raw) return '';
    const scope = '#app-wechat-window #wechat-chat-room';
    return raw.replace(/(^|})(\s*)([^@{}][^{}]*)\{/g, (match, closeBrace, space, selectorText) => {
        const scoped = selectorText.split(',').map(selector => {
            const trimmed = selector.trim();
            if (!trimmed) return '';
            if (trimmed.startsWith(scope) || trimmed.startsWith('#wechat-chat-room') || trimmed.startsWith('#app-wechat-window')) {
                return trimmed;
            }
            return `${scope} ${trimmed}`;
        }).filter(Boolean).join(', ');
        return `${closeBrace}${space}${scoped} {`;
    });
}

function previewBubbleCss(cssText) {
    // 移除旧的预览样式
    let previewStyle = document.getElementById('wcs-css-preview-style');
    if (!previewStyle) {
        previewStyle = document.createElement('style');
        previewStyle.id = 'wcs-css-preview-style';
        document.head.appendChild(previewStyle);
    }
    // 预览里区分左右气泡，避免角色预览被 .wcs-preview-bubble.ai 默认色覆盖。
    let previewCss = cssText
        .replace(/\.msg-bubble\.green/g, '.wcs-preview-bubble.user')
        .replace(/\.msg-bubble/g, '.wcs-preview-bubble.ai');
    previewStyle.textContent = previewCss;
}

function setWechatTimeModeControls(mode) {
    const safeMode = mode === 'virtual' ? 'virtual' : 'real';
    document.getElementById('wcs-time-real')?.classList.toggle('active', safeMode === 'real');
    document.getElementById('wcs-time-virtual')?.classList.toggle('active', safeMode === 'virtual');
    document.getElementById('wcs-time-virtual-row')?.classList.toggle('hidden', safeMode !== 'virtual');
    refreshWechatTimePreview();
}

function getWechatSettingsTimeMode() {
    return document.getElementById('wcs-time-virtual')?.classList.contains('active') ? 'virtual' : 'real';
}

function toggleWechatTimeMode(mode) {
    const safeMode = mode === 'virtual' ? 'virtual' : 'real';
    const virtualInput = document.getElementById('wcs-virtual-time');
    if (safeMode === 'virtual' && virtualInput && !virtualInput.value) {
        virtualInput.value = toWechatDatetimeLocalValue(new Date());
    }
    setWechatTimeModeControls(safeMode);
}

function refreshWechatTimePreview() {
    const preview = document.getElementById('wcs-time-preview');
    if (!preview) return;
    const mode = getWechatSettingsTimeMode();
    const value = document.getElementById('wcs-virtual-time')?.value;
    preview.textContent = mode === 'virtual'
        ? `AI 会认为现在是：${formatWechatDateTimeForPrompt(value || new Date())}`
        : `AI 会跟随真实时间：${formatWechatDateTimeForPrompt(new Date())}`;
}

function setWechatVirtualTimeNow() {
    const input = document.getElementById('wcs-virtual-time');
    if (input) input.value = toWechatDatetimeLocalValue(new Date());
    setWechatTimeModeControls('virtual');
}

function renderWechatMomentCoverGallery(char) {
    const gallery = document.getElementById('wcs-moment-cover-list');
    if (!gallery || !char) return;
    const covers = ((char.chatConfig && char.chatConfig.momentCovers) || []).filter(Boolean);
    gallery.innerHTML = covers.length ? covers.map((url, index) => `
        <div class="wcs-cover-thumb">
            <img src="${url}" onerror="this.style.opacity='0.35'">
            <button type="button" onclick="removeWechatMomentCover(${index})"><i class="ri-close-line"></i></button>
        </div>
    `).join('') : '<span class="wcs-cover-empty">还没有背景图</span>';
}

function addWechatMomentCovers(input) {
    const char = getCurrentChatChar();
    if (!char || !input.files || !input.files.length) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.momentCovers = Array.isArray(char.chatConfig.momentCovers) ? char.chatConfig.momentCovers : [];
    const files = Array.from(input.files).slice(0, 8);
    let pending = files.length;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxW = 720;
                const scale = Math.min(maxW / img.width, 1);
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                char.chatConfig.momentCovers.push(canvas.toDataURL('image/jpeg', 0.72));
                pending -= 1;
                if (pending === 0) {
                    saveCharactersToStorage();
                    renderWechatMomentCoverGallery(char);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function removeWechatMomentCover(index) {
    const char = getCurrentChatChar();
    if (!char || !char.chatConfig || !Array.isArray(char.chatConfig.momentCovers)) return;
    char.chatConfig.momentCovers.splice(index, 1);
    saveCharactersToStorage();
    renderWechatMomentCoverGallery(char);
}

function renderWechatAiMomentsEditor(char) {
    const list = document.getElementById('wcs-ai-moment-list');
    if (!list || !char) return;
    const moments = Array.isArray(char.chatConfig && char.chatConfig.aiMoments)
        ? char.chatConfig.aiMoments.filter(item => item && (item.source === 'ai_moment' || item.source === 'manual_moment'))
        : [];
    list.innerHTML = moments.length ? moments.slice().reverse().map(item => `
        <div class="wcs-ai-moment-item">
            <span>${wcEscapeHtml(item.text || '')}</span>
            <button type="button" onclick="deleteWechatAiMoment(${quoteWechatJsString(item.id)})"><i class="ri-close-line"></i></button>
        </div>
    `).join('') : '<div class="wcs-ai-moment-empty">还没有自定义动态</div>';
}

function addWechatAiMomentFromSettings() {
    const char = getCurrentChatChar();
    const input = document.getElementById('wcs-ai-moment-text');
    const text = (input && input.value || '').trim();
    if (!char || !text) return;
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.aiMoments = Array.isArray(char.chatConfig.aiMoments) ? char.chatConfig.aiMoments : [];
    char.chatConfig.aiMoments.push({
        id: 'aim_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        text,
        source: 'manual_moment',
        createdAt: Date.now()
    });
    if (input) input.value = '';
    saveCharactersToStorage();
    renderWechatAiMomentsEditor(char);
}

async function generateWechatAiMoment() {
    const char = getCurrentChatChar();
    const input = document.getElementById('wcs-ai-moment-text');
    if (!char || !input) return;
    input.value = 'AI 正在写朋友圈...';
    char.chatConfig = char.chatConfig || {};
    const coverHint = Array.isArray(char.chatConfig.momentCovers) && char.chatConfig.momentCovers.length
        ? `用户已为你设置 ${char.chatConfig.momentCovers.length} 张朋友圈封面，你能看到并知道这是你的朋友圈背景。`
        : '用户还没有为你设置朋友圈封面。';
    const result = await callChatApi([
        { role: 'system', content: `你是「${char.name}」。请以你自己的口吻写一条微信朋友圈动态，28字以内，像真实朋友圈，不要解释。${coverHint}` },
        { role: 'user', content: `角色设定：\n${String(char.description || '').slice(0, 4000)}\n\n写一条你现在会发的朋友圈。` }
    ]);
    input.value = result.ok
        ? String(result.content || '').replace(/\|\|\|/g, ' ').replace(/<[^>]+>/g, '').replace(/["“”]/g, '').trim().slice(0, 80)
        : '';
}

function deleteWechatAiMoment(id) {
    const char = getCurrentChatChar();
    if (!char || !char.chatConfig || !Array.isArray(char.chatConfig.aiMoments)) return;
    char.chatConfig.aiMoments = char.chatConfig.aiMoments.filter(item => item.id !== id);
    saveCharactersToStorage();
    renderWechatAiMomentsEditor(char);
}

async function generateWechatSignature() {
    const char = getCurrentChatChar();
    const input = document.getElementById('wcs-char-signature');
    if (!char || !input) return;
    const oldValue = input.value;
    input.value = '正在生成...';
    const result = await callChatApi([
        { role: 'system', content: `你是「${char.name}」。给自己的微信资料写一句自然的个性签名，16字以内。只输出签名，不要解释。` },
        { role: 'user', content: '写一句你的微信个性签名。' }
    ]);
    input.value = result.ok
        ? String(result.content || '').replace(/\|\|\|/g, ' ').replace(/["“”]/g, '').trim().slice(0, 32)
        : oldValue;
}

function setWechatMonitorModeOption(mode) {
    const safe = mode === 'observer' ? 'observer' : 'persona';
    const input = document.getElementById('wcs-monitor-mode');
    if (input) input.value = safe;
    document.querySelectorAll('#wcs-monitor-mode-options button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === safe);
    });
}
window.setWechatMonitorModeOption = setWechatMonitorModeOption;

function openChatSettings() {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    document.querySelector('.wc-float-back').style.display = 'none';
    document.querySelector('.wc-float-more').style.display = 'none';
    document.getElementById('wc-floating-avatar').style.display = 'none';

    const config = char.chatConfig || {};
    const profile = getWechatChatUserProfile(char);

    // 填充外观设置
    document.getElementById('wcs-bg-img-hint').textContent = config.chatBgImage ? '已设置' : '未设置';

    const fontSize = config.fontSize || 15;
    document.getElementById('wcs-font-size').value = fontSize;
    document.getElementById('wcs-font-val').textContent = fontSize + 'px';

    // CSS 编辑器
    const cssEl = document.getElementById('wcs-custom-css');
    if (cssEl) {
        cssEl.value = config.customCss || '';
        previewBubbleCss(config.customCss || '');
        renderBubblePresetDropdown(config.customCss || '');
    }

    // 用户资料（当前聊天独立）
    const userAvatarEl = document.getElementById('wcs-user-avatar');
    if (profile.avatar) userAvatarEl.src = profile.avatar;
    else userAvatarEl.src = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 200 200%27%3E%3Cdefs%3E%3ClinearGradient id=%27bg%27 x1=%270%27 y1=%270%27 x2=%271%27 y2=%271%27%3E%3Cstop offset=%270%25%27 stop-color=%27%23f8c8dc%27/%3E%3Cstop offset=%27100%25%27 stop-color=%27%23d4a5f5%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%27200%27 height=%27200%27 rx=%27100%27 fill=%27url(%23bg)%27/%3E%3Ccircle cx=%27100%27 cy=%2780%27 r=%2735%27 fill=%27%23fff%27 opacity=%270.9%27/%3E%3Cellipse cx=%27100%27 cy=%27155%27 rx=%2750%27 ry=%2735%27 fill=%27%23fff%27 opacity=%270.9%27/%3E%3Ccircle cx=%2788%27 cy=%2775%27 r=%274%27 fill=%27%23555%27/%3E%3Ccircle cx=%27112%27 cy=%2775%27 r=%274%27 fill=%27%23555%27/%3E%3Cpath d=%27M92 90 Q100 98 108 90%27 stroke=%27%23e88%27 stroke-width=%272.5%27 fill=%27none%27 stroke-linecap=%27round%27/%3E%3C/svg%3E';
    document.getElementById('wcs-user-name').value = profile.name || '我';
    document.getElementById('wcs-user-bio').value = profile.bio || '';
    const userSignatureEl = document.getElementById('wcs-user-signature');
    if (userSignatureEl) userSignatureEl.value = profile.signature || '';
    renderWechatUserPersonaLibrary(profile.personaId || '');

    // 角色资料
    document.getElementById('wcs-char-avatar').src = char.avatar || '';
    document.getElementById('wcs-char-name').textContent = char.name;
    const descText = char.description || '';
    document.getElementById('wcs-char-desc').value = descText;
    document.getElementById('wcs-char-bio-preview').textContent = descText ? descText.slice(0, 50) + (descText.length > 50 ? '...' : '') : '无简介';
    updateWechatSettingsImagePreview('wcs-portrait-ref-preview', config.imageReference || '', '未设置参考图');

    // 称呼 & 备注
    document.getElementById('wcs-user-title').value = config.userTitle || '我';
    document.getElementById('wcs-char-nickname').value = config.nickname || '';
    const presenceMode = document.getElementById('wcs-chat-presence-mode');
    if (presenceMode) presenceMode.value = ['online', 'offline'].includes(config.chatPresenceMode) ? config.chatPresenceMode : 'auto';
    const memoryConfig = getWechatMemoryConfig(char);
    const segmentInput = document.getElementById('wcs-memory-segment');
    const longInput = document.getElementById('wcs-memory-long');
    const keepInput = document.getElementById('wcs-memory-keep');
    const extractInput = document.getElementById('wcs-memory-extract');
    if (segmentInput) segmentInput.value = memoryConfig.segmentLimit;
    if (longInput) longInput.value = memoryConfig.longTermLimit;
    if (keepInput) keepInput.value = memoryConfig.keepRecent;
    if (extractInput) extractInput.value = memoryConfig.extractEvery;
    const signatureInput = document.getElementById('wcs-char-signature');
    if (signatureInput) signatureInput.value = config.signature || '';
    const timeMode = config.timeMode === 'virtual' ? 'virtual' : 'real';
    const virtualInput = document.getElementById('wcs-virtual-time');
    if (virtualInput) virtualInput.value = toWechatDatetimeLocalValue(config.virtualTime || new Date());
    setWechatTimeModeControls(timeMode);
    updateWechatSettingsImagePreview('wcs-video-bg-preview', config.videoCallBg || '', '未设置视频通话背景');
    const videoBgHint = document.getElementById('wcs-video-bg-hint');
    if (videoBgHint) videoBgHint.textContent = config.videoCallBg ? '已设置视频通话背景' : '上传视频通话背景';
    const realCamera = document.getElementById('wcs-video-real-camera');
    if (realCamera) realCamera.checked = !!config.videoCallUseCamera;
    const monitorEnabled = document.getElementById('wcs-monitor-enabled');
    if (monitorEnabled) monitorEnabled.checked = !!config.monitorEnabled;
    setWechatMonitorModeOption(getWechatMonitorMode(char));

    // 头像集
    renderAvatarGallery(char);
    renderWechatMomentCoverGallery(char);
    renderWechatAiMomentsEditor(char);

    // 婊戝叆
    const panel = document.getElementById('wc-chat-settings-panel');
    if (panel) {
        panel.style.display = 'flex';
        panel.classList.remove('active');
        requestAnimationFrame(() => panel.classList.add('active'));
    }
}

function closeChatSettings() {
    const panel = document.getElementById('wc-chat-settings-panel');
    if (panel) {
        panel.classList.remove('active');
        setTimeout(() => {
            if (!panel.classList.contains('active')) panel.style.display = 'none';
        }, 300);
    }

    const room = document.getElementById('wechat-chat-room');
    if (room && window.currentChatCharId) {
        room.classList.remove('hidden');
        room.classList.add('active');
    }

    const backEl = document.querySelector('.wc-float-back');
    const moreEl = document.querySelector('.wc-float-more');
    const avatarEl = document.getElementById('wc-floating-avatar');
    if (backEl) backEl.style.display = '';
    if (moreEl) moreEl.style.display = '';
    if (avatarEl) avatarEl.style.display = '';
}

function uploadChatBgImage(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        // 压缩背景图
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxW = 400;
            const scale = Math.min(maxW / img.width, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            window._tempChatBgImage = canvas.toDataURL('image/jpeg', 0.6);
            document.getElementById('wcs-bg-img-hint').textContent = '已选择';
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

function compressWechatSettingsImage(file, maxWidth = 720, quality = 0.72) {
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
                resolve(canvas.toDataURL('image/jpeg', quality));
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

// --- 角色头像集 ---
function renderAvatarGallery(char) {
    const gallery = document.getElementById('wcs-avatar-gallery');
    if (!gallery) return;
    const avatars = char.avatarGallery || [];
    if (char.avatar && !avatars.includes(char.avatar)) avatars.unshift(char.avatar);
    gallery.innerHTML = avatars.map((url, i) => `
        <img class="wcs-avatar-gallery-item ${url === char.avatar ? 'active' : ''}"
             src="${url}" onclick="selectCharAvatar(${i})"
             oncontextmenu="event.preventDefault();removeGalleryAvatar(${i})">
    `).join('') || '<span style="font-size:12px;color:#bbb;">暂无头像</span>';
}

function selectCharAvatar(idx) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    const avatars = char.avatarGallery || [];
    if (char.avatar && !avatars.includes(char.avatar)) avatars.unshift(char.avatar);
    if (avatars[idx]) {
        char.avatar = avatars[idx];
        document.getElementById('wcs-char-avatar').src = avatars[idx];
        saveCharactersToStorage();
        renderAvatarGallery(char);
    }
}

function removeGalleryAvatar(idx) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.avatarGallery) return;
    char.avatarGallery.splice(idx, 1);
    saveCharactersToStorage();
    renderAvatarGallery(char);
}

function addCharAvatarToGallery(input) {
    if (!input.files || !input.files[0]) return;
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        openWechatAvatarCropper(e.target.result, compressed => {
            if (!char.avatarGallery) char.avatarGallery = [];
            char.avatarGallery.push(compressed);
            saveCharactersToStorage();
            renderAvatarGallery(char);
        }, { outputSize: 200, quality: 0.7 });
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
}

function saveChatSettings() {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    // 保存聊天配置到角色
    const prevConfig = char.chatConfig || {};
    char.chatConfig = {
        chatBg: prevConfig.chatBg || '#ededed',
        chatBgImage: window._tempChatBgImage || prevConfig.chatBgImage || '',
        bubbleAi: prevConfig.bubbleAi || '#ffffff',
        bubbleUser: prevConfig.bubbleUser || '#95ec69',
        fontSize: parseInt(document.getElementById('wcs-font-size').value) || 15,
        userTitle: document.getElementById('wcs-user-title').value.trim() || '我',
        nickname: document.getElementById('wcs-char-nickname').value.trim() || '',
        chatPresenceMode: ['online', 'offline'].includes(document.getElementById('wcs-chat-presence-mode')?.value)
            ? document.getElementById('wcs-chat-presence-mode').value
            : 'auto',
        timeMode: getWechatSettingsTimeMode(),
        virtualTime: document.getElementById('wcs-virtual-time')?.value || prevConfig.virtualTime || '',
        memorySegmentLimit: normalizeWechatMemoryNumber(document.getElementById('wcs-memory-segment')?.value, prevConfig.memorySegmentLimit || WECHAT_MEMORY_DEFAULTS.segmentLimit, 3, 50),
        memoryLongTermLimit: normalizeWechatMemoryNumber(document.getElementById('wcs-memory-long')?.value, prevConfig.memoryLongTermLimit || WECHAT_MEMORY_DEFAULTS.longTermLimit, 3, 50),
        memoryKeepRecent: normalizeWechatMemoryNumber(document.getElementById('wcs-memory-keep')?.value, prevConfig.memoryKeepRecent || WECHAT_MEMORY_DEFAULTS.keepRecent, 1, 50),
        memoryExtractEvery: normalizeWechatMemoryNumber(document.getElementById('wcs-memory-extract')?.value, prevConfig.memoryExtractEvery || WECHAT_MEMORY_DEFAULTS.extractEvery, 2, 30),
        signature: document.getElementById('wcs-char-signature')?.value.trim() || prevConfig.signature || '',
        imageReference: prevConfig.imageReference || '',
        videoCallBg: prevConfig.videoCallBg || '',
        videoCallUseCamera: !!document.getElementById('wcs-video-real-camera')?.checked,
        momentCovers: Array.isArray(prevConfig.momentCovers) ? prevConfig.momentCovers : [],
        contactProfile: prevConfig.contactProfile || null,
        contactProfileError: prevConfig.contactProfileError || '',
        profileBio: prevConfig.profileBio || '',
        blacklisted: !!prevConfig.blacklisted,
        friendRequestReason: prevConfig.friendRequestReason || '',
        friendRequestAt: prevConfig.friendRequestAt || 0,
        charBlacklistedUser: !!prevConfig.charBlacklistedUser,
        charBlacklistReason: prevConfig.charBlacklistReason || '',
        monitorEnabled: !!document.getElementById('wcs-monitor-enabled')?.checked,
        monitorMode: getWechatMonitorMode({ chatConfig: { monitorMode: document.getElementById('wcs-monitor-mode')?.value } }),
        monitorState: prevConfig.monitorState || null,
        pendingMonitorRequest: prevConfig.pendingMonitorRequest || null,
        pendingContactDeleteRequest: prevConfig.pendingContactDeleteRequest || null,
        aiMoments: Array.isArray(prevConfig.aiMoments) ? prevConfig.aiMoments : [],
        aiStatusSnapshot: prevConfig.aiStatusSnapshot || null,
        aiStatusError: prevConfig.aiStatusError || '',
        aiStatusHistory: Array.isArray(prevConfig.aiStatusHistory) ? prevConfig.aiStatusHistory : [],
        aiPhoneSnapshot: prevConfig.aiPhoneSnapshot || null,
        userProfile: prevConfig.userProfile || null,
        customCss: (document.getElementById('wcs-custom-css') || {}).value || ''
    };
    window._tempChatBgImage = null;

    // 保存角色描述
    char.description = document.getElementById('wcs-char-desc').value;

    // 保存用户资料（当前聊天独立）
    const scopedProfile = {
        avatar: document.getElementById('wcs-user-avatar').src || '',
        name: document.getElementById('wcs-user-name').value.trim() || '我',
        bio: document.getElementById('wcs-user-bio').value.trim(),
        signature: document.getElementById('wcs-user-signature')?.value.trim() || '',
        personaId: prevConfig.userProfile?.personaId || ''
    };
    saveWechatChatUserProfile(char, scopedProfile);

    const memoryStore = getWechatMemoryStore();
    const memoryBucket = getWechatMemoryBucket(memoryStore, char.id);
    promoteWechatMemoryBucket(memoryBucket, char);
    saveWechatMemoryStore(memoryStore);

    // 应用配置到当前聊天
    applyChatConfig(char);

    // 保存到 localStorage
    saveCharactersToStorage();
    refreshChatView(char);
    renderChatList();

    closeChatSettings();
}

function clearCurrentWechatChatHistory() {
    const char = getCurrentChatChar();
    if (!char) return;
    const displayName = (char.chatConfig && char.chatConfig.nickname) || char.name || '该角色';
    if (!confirm(`确定删除「${displayName}」的所有聊天记录吗？\n这个操作不会删除角色卡、记忆、贴纸包和聊天设置。`)) return;
    char.history = [];
    char.lastMsg = '';
    if (char.chatConfig) {
        char.chatConfig.aiStatusSnapshot = null;
        char.chatConfig.aiStatusHistory = [];
        char.chatConfig.aiStatusError = '';
        char.chatConfig.aiStatusLoading = false;
    }
    window._wechatExpandedHistoryIds?.delete?.(char.id);
    saveCharactersToStorage();
    refreshChatView(char);
    renderChatList();
    closeChatSettings();
    if (typeof showWechatToast === 'function') showWechatToast('已删除该角色聊天记录');
}

function applyChatConfig(char) {
    const config = char.chatConfig || {};
    const contentEl = document.getElementById('chat-room-content');
    if (!contentEl) return;

    // 背景
    if (config.chatBgImage) {
        contentEl.style.backgroundImage = `url(${config.chatBgImage})`;
        contentEl.style.backgroundSize = 'cover';
        contentEl.style.backgroundPosition = 'center';
        contentEl.style.backgroundColor = '';
    } else {
        contentEl.style.backgroundImage = '';
        contentEl.style.backgroundColor = config.chatBg || '';
    }

    // 气泡颜色 + 字体大小（通过 CSS 变量注入）
    const room = document.getElementById('wechat-chat-room');
    if (room) {
        room.style.setProperty('--bubble-ai', config.bubbleAi || '#ffffff');
        room.style.setProperty('--bubble-user', config.bubbleUser || '#95ec69');
        room.style.setProperty('--chat-font-size', (config.fontSize || 15) + 'px');
    }

    // 自定义气泡 CSS
    let customStyle = document.getElementById('chat-custom-css');
    if (config.customCss) {
        if (!customStyle) {
            customStyle = document.createElement('style');
            customStyle.id = 'chat-custom-css';
            document.head.appendChild(customStyle);
        }
        customStyle.textContent = scopeWechatChatCustomCss(config.customCss);
    } else if (customStyle) {
        customStyle.remove();
    }

    // 清除预览样式
    const previewStyle = document.getElementById('wcs-css-preview-style');
    if (previewStyle) previewStyle.remove();

    requestAnimationFrame(() => applyWechatBubbleMetaContrast(contentEl));
}

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
    processAndSendImage(input.files[0]);
    input.value = '';
}

function processAndSendImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxDim = 400;
            let w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
                const scale = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            sendImageMessage(compressed);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function sendImageMessage(imageUrl) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    const userMsg = { type: 'image', isMe: true, content: imageUrl, imageUrl, description: '[用户发送了一张图片]', timestamp: createMessageTimestamp() };
    if (!char.history) char.history = [];
    char.history.push(userMsg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    notifyWechatMonitors(char, userMsg);

    refreshChatView(char);
    saveCharactersToStorage();
    renderChatList();
}

// ========== 微信模拟消息：转账 / 红包 / 语音 / 通话 ==========

const WECHAT_COMPOSER_CONFIG = {
    voice: {
        title: '发送语音',
        icon: 'ri-mic-line',
        primary: '发送语音'
    },
    transfer: {
        title: '转账',
        icon: 'ri-money-cny-circle-line',
        primary: '确认转账'
    },
    redpacket: {
        title: '发送红包',
        icon: 'ri-red-packet-line',
        primary: '发送红包'
    },
    videoCall: {
        title: '视频电话',
        icon: 'ri-video-chat-line',
        primary: '生成视频电话记录'
    },
    voiceCall: {
        title: '语音电话',
        icon: 'ri-phone-line',
        primary: '生成语音电话记录'
    },
    poke: {
        title: '拍一拍',
        icon: 'ri-hand-heart-line',
        primary: '发送拍一拍'
    },
    screen_shake: {
        title: '屏幕震动',
        icon: 'ri-shake-hands-line',
        primary: '发送震动'
    },
    music_card: {
        title: '发送音乐',
        icon: 'ri-music-2-line',
        primary: '发送音乐卡片'
    }
};

function getCurrentChatChar() {
    const charId = window.currentChatCharId;
    if (!charId) return null;
    return window.myCharacters.find(c => c.id === charId) || null;
}

function appendWechatMessage(msg) {
    const char = getCurrentChatChar();
    if (!char) return;
    if (!char.history) char.history = [];
    if (window._wechatReplyDraft) {
        msg.replyTo = { ...window._wechatReplyDraft };
        clearWechatReplyDraft();
    }
    ensureMessageTimestamp(msg);
    syncWechatMessageDescription(msg);
    char.history.push(msg);
    if (msg.isMe && typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);
    if (msg.isMe) notifyWechatMonitors(char, msg);

    refreshChatView(char);
    saveCharactersToStorage();
    renderChatList();
}

function getWechatModalRoot() {
    return document.querySelector('.phone-container') || document.body;
}

function getWechatCharDisplayName(char) {
    return (char && char.chatConfig && char.chatConfig.nickname) || (char && char.name) || '对方';
}

function closeWechatMonitorRequestModal() {
    const modal = document.getElementById('wc-monitor-request-modal');
    if (modal) modal.classList.add('hidden');
}

function showWechatMonitorRequestModal(charId, requestId) {
    const char = (window.myCharacters || []).find(item => item && item.id === charId);
    if (!char || !char.chatConfig || !char.chatConfig.pendingMonitorRequest) return;
    const request = char.chatConfig.pendingMonitorRequest;
    if (requestId && request.id !== requestId) return;
    const label = WECHAT_MONITOR_MODE_LABELS[request.mode] || WECHAT_MONITOR_MODE_LABELS.persona;
    const name = getWechatCharDisplayName(char);
    let modal = document.getElementById('wc-monitor-request-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-monitor-request-modal';
        modal.className = 'wc-modal-overlay hidden wc-monitor-request-overlay';
        getWechatModalRoot().appendChild(modal);
    }
    modal.dataset.charId = charId;
    modal.dataset.requestId = request.id;
    modal.innerHTML = `
        <div class="wc-monitor-request-card">
            <div class="wc-monitor-request-head">
                <img src="${wcEscapeHtml(char.avatar || DEFAULT_AVATAR)}" alt="">
                <div>
                    <span>监控剧情请求</span>
                    <strong>${wcEscapeHtml(name)}想要开启监控</strong>
                </div>
            </div>
            <div class="wc-monitor-request-mode">
                <i class="ri-radar-line"></i>
                <div><b>${wcEscapeHtml(label)}</b><p>${wcEscapeHtml(request.reason || '角色想根据当前剧情观察 BYND 内部聊天动态。')}</p></div>
            </div>
            <div class="wc-monitor-request-actions">
                <button type="button" onclick="rejectWechatMonitorRequest()">拒绝</button>
                <button type="button" class="primary" onclick="approveWechatMonitorRequest()">允许</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function resolveWechatMonitorRequestFromModal() {
    const modal = document.getElementById('wc-monitor-request-modal');
    if (!modal) return null;
    const charId = modal.dataset.charId;
    const requestId = modal.dataset.requestId;
    const char = (window.myCharacters || []).find(item => item && item.id === charId);
    const request = char && char.chatConfig && char.chatConfig.pendingMonitorRequest;
    if (!char || !request || request.id !== requestId) return null;
    return { char, request };
}

function approveWechatMonitorRequest() {
    const resolved = resolveWechatMonitorRequestFromModal();
    if (!resolved) {
        closeWechatMonitorRequestModal();
        return;
    }
    const { char, request } = resolved;
    const label = WECHAT_MONITOR_MODE_LABELS[request.mode] || WECHAT_MONITOR_MODE_LABELS.persona;
    char.chatConfig.monitorEnabled = true;
    char.chatConfig.monitorMode = request.mode;
    char.chatConfig.monitorReason = request.reason || '';
    char.chatConfig.monitorChangedByCharAt = Date.now();
    delete char.chatConfig.pendingMonitorRequest;
    if (!Array.isArray(char.history)) char.history = [];
    char.history.push({
        type: 'system_notice',
        isMe: false,
        content: `已允许：监控剧情已开启（${label}）`,
        timestamp: createMessageTimestamp()
    });
    closeWechatMonitorRequestModal();
    if (typeof updateWechatChatSettings === 'function') updateWechatChatSettings(char);
    saveCharactersToStorage();
    if (window.currentChatCharId === char.id) refreshChatView(char);
    renderChatList();
}

function rejectWechatMonitorRequest() {
    const resolved = resolveWechatMonitorRequestFromModal();
    if (!resolved) {
        closeWechatMonitorRequestModal();
        return;
    }
    const { char } = resolved;
    const name = getWechatCharDisplayName(char);
    delete char.chatConfig.pendingMonitorRequest;
    if (!Array.isArray(char.history)) char.history = [];
    char.history.push({
        type: 'system_notice',
        isMe: false,
        content: `已拒绝：没有允许${name}开启监控`,
        timestamp: createMessageTimestamp()
    });
    closeWechatMonitorRequestModal();
    saveCharactersToStorage();
    if (window.currentChatCharId === char.id) refreshChatView(char);
    renderChatList();
}

window.showWechatMonitorRequestModal = showWechatMonitorRequestModal;
window.closeWechatMonitorRequestModal = closeWechatMonitorRequestModal;
window.approveWechatMonitorRequest = approveWechatMonitorRequest;
window.rejectWechatMonitorRequest = rejectWechatMonitorRequest;

function updateWechatCurrentChatHeader(char) {
    if (!char || window.currentChatCharId !== char.id) return;
    const displayName = getWechatCharDisplayName(char);
    const title = document.getElementById('chat-room-title');
    const floatName = document.getElementById('wc-float-name');
    if (title) title.textContent = displayName;
    if (floatName) floatName.textContent = displayName;
    renderChatList();
}

function stripWechatPromptText(value, maxLength = 360) {
    const text = cleanWechatVisibleContent(value)
        .replace(/<[^>]+>/g, '')
        .replace(/\|\|\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

function formatWechatSnapshotTime(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return `${padWechatDatePart(safeDate.getHours())}:${padWechatDatePart(safeDate.getMinutes())}`;
}

function getWechatStatusSerial(char) {
    const source = String((char && char.id) || (char && char.name) || 'wechat-status');
    const hash = source.split('').reduce((sum, ch) => ((sum * 31) + ch.charCodeAt(0)) >>> 0, 17);
    return `#${String(hash % 1000000).padStart(6, '0')}`;
}

function isWechatStatusPlaceholderValue(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return true;
    return [
        /^API\s*未返回$/i,
        /^等待.*生成/,
        /^状态.*生成/,
        /^生成失败/,
        /未.{0,4}描写/,
        /固定占位/,
        /模板化省略/
    ].some(pattern => pattern.test(text));
}

function getWechatStatusFieldDisplay(snapshot, item, isLoading, statusError) {
    if (isLoading) return '状态生成中';
    if (snapshot && snapshot.fields) {
        const value = snapshot.fields[item.key];
        if (!isWechatStatusPlaceholderValue(value)) return value;
        return '等待下一次状态生成';
    }
    return statusError ? '生成失败，等待下次状态生成' : '等待 AI 生成';
}

function buildWechatPreviousAiStatusPrompt(char) {
    const snapshot = char && char.chatConfig && char.chatConfig.aiStatusSnapshot;
    if (!snapshot || !snapshot.fields) return '';
    const useful = {};
    WECHAT_AI_STATUS_FIELDS.forEach(item => {
        const value = snapshot.fields[item.key];
        if (!isWechatStatusPlaceholderValue(value)) useful[item.key] = value;
    });
    return Object.keys(useful).length ? JSON.stringify(useful, null, 2) : '';
}

function buildWechatWorldBookPrompt(char, limit = 30) {
    const entries = Array.isArray(char && char.worldBook) ? char.worldBook : [];
    const enabled = entries
        .filter(entry => entry && entry.enabled !== false)
        .slice(0, limit)
        .map(entry => {
            const title = entry.name || entry.title || entry.key || '世界书';
            const content = entry.content || entry.text || entry.comment || '';
            return stripWechatPromptText(`${title}：${content}`, 420);
        })
        .filter(Boolean);
    return enabled.length ? `【世界书】\n${enabled.join('\n')}` : '';
}

function getWechatMessagePromptContent(msg) {
    if (!msg) return '';
    if (msg.type === 'image') return msg.description || '[图片]';
    if (msg.type === 'sticker') return `[表情] ${msg.stickerName || msg.name || ''}`;
    if (isWechatSpecialMessage(msg.type)) return msg.description || msg.content || '[微信特殊消息]';
    if (msg.type === 'system_notice') return `[系统提示] ${msg.content || ''}`;
    return msg.content || msg.dialogue || msg.description || '';
}

function buildWechatRecentHistoryForPrompt(char, limit = 12) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const userName = ((typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : (typeof getUserProfile === 'function' ? getUserProfile() : {})) || {}).name || '用户';
    const charName = getWechatCharDisplayName(char);
    const lines = history.slice(-limit).map(msg => {
        const role = msg.isMe ? userName : charName;
        const content = stripWechatPromptText(getWechatMessagePromptContent(msg), 220);
        return content ? `${role}: ${content}` : '';
    }).filter(Boolean);
    return lines.length ? lines.join('\n') : '暂无聊天记录。';
}

function parseWechatJsonObject(text) {
    const source = String(text || '').trim();
    if (!source) return null;
    const cleaned = source.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (_) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch (e) {
            return null;
        }
    }
}

function getWechatAiStatusFallback(char, reason = 'fallback') {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : ((typeof getUserProfile === 'function') ? getUserProfile() : { name: '用户' });
    const userName = userProfile.name || '用户';
    const charName = getWechatCharDisplayName(char);
    const lastAi = history.slice().reverse().find(msg => msg && !msg.isMe && msg.type !== 'system_notice');
    const lastUser = history.slice().reverse().find(msg => msg && msg.isMe);
    const lastAiText = stripWechatPromptText(getWechatMessagePromptContent(lastAi), 56);
    const lastUserText = stripWechatPromptText(getWechatMessagePromptContent(lastUser), 56);

    return {
        updatedAt: Date.now(),
        reason,
        generatedBy: 'local',
        fields: {
            innerMonologue: lastAiText ? `还停在刚才那句「${lastAiText}」的情绪里。` : `正在等${userName}先开口。`,
            miniDiary: lastUserText ? `想回头再和${userName}说清楚「${lastUserText}」这件事。` : `把和${userName}的聊天窗口留在最前面。`,
            thoughts: `在判断下一句话该不该更靠近一点。`,
            outfit: '沿用当前角色设定，聊天里没有新的服饰变化。',
            posture: '靠近手机，停在刚回复后的姿势。',
            action: '看着聊天窗口，等下一条消息。',
            gaze: `目光落在${userName}的聊天框上。`,
            penis: ''
        }
    };
}

function normalizeWechatAiStatusSnapshot(raw, char, reason = 'api') {
    if (!raw || typeof raw !== 'object') return null;
    const data = raw;
    const fieldsSource = data.fields && typeof data.fields === 'object' ? data.fields : data;
    const aliases = {
        innerMonologue: ['innerMonologue', 'inner_monologue', '内心独白', '内心声音'],
        miniDiary: ['miniDiary', 'mini_diary', '小日记'],
        thoughts: ['thoughts', 'thinking', '想法'],
        outfit: ['outfit', 'clothing', '服饰', '穿着'],
        posture: ['posture', 'pose', '姿势'],
        action: ['action', 'movement', '动作'],
        gaze: ['gaze', 'eyes', '目光', '视线'],
        penis: ['penis', 'Penis', '阴茎']
    };
    const fields = {};
    WECHAT_AI_STATUS_FIELDS.forEach(item => {
        const keys = aliases[item.key] || [item.key, item.label];
        const value = keys.map(key => fieldsSource[key]).find(v => v != null && String(v).trim());
        fields[item.key] = stripWechatPromptText(value || 'API 未返回', 180);
    });
    return {
        updatedAt: Date.now(),
        reason,
        generatedBy: 'api',
        fields
    };
}

function getWechatAiStatusSnapshot(char) {
    const snapshot = char && char.chatConfig && char.chatConfig.aiStatusSnapshot;
    if (snapshot && snapshot.fields && snapshot.generatedBy === 'api') return snapshot;
    return null;
}

function buildWechatIdentityContextPrompt(char, userProfile = null) {
    const profile = userProfile || ((typeof getWechatChatUserProfile === 'function')
        ? getWechatChatUserProfile(char)
        : ((typeof getUserProfile === 'function') ? getUserProfile() : {}));
    const config = (char && char.chatConfig) || {};
    const originalName = (char && char.name) || '未命名角色';
    const nickname = config.nickname || '';
    const displayName = getWechatCharDisplayName(char);
    const userName = (profile && profile.name) || '用户';
    const userTitle = config.userTitle || userName;
    const rows = [
        `- 角色原名：${originalName}`,
        `- 当前聊天显示名：${displayName}`,
        nickname
            ? `- 用户给角色设置的备注名：${nickname}（这是用户给角色的备注，不是用户本人名字，也不是当前聊天话题）`
            : '- 用户尚未给角色设置备注名',
        `- 用户名字：${userName}`,
        `- 角色对用户的称呼/备注：${userTitle}`,
        profile && profile.bio ? `- 用户简介：${stripWechatPromptText(profile.bio, 260)}` : '',
        profile && profile.signature ? `- 用户个性签名/当前人设：${stripWechatPromptText(profile.signature, 260)}` : ''
    ].filter(Boolean);
    return `【身份与称呼上下文】\n${rows.join('\n')}`;
}

function buildWechatPresetPromptForStatus(char) {
    try {
        const preset = (typeof getActivePreset === 'function') ? getActivePreset() : null;
        if (!preset || !Array.isArray(preset.prompts) || !preset.prompts.length) return '';
        const enabled = preset.prompts
            .filter(item => item && item.enabled !== false && item.content)
            .slice(0, 8)
            .map((item, index) => {
                const title = item.name || item.title || `预设${index + 1}`;
                let content = String(item.content || '');
                const profile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : {};
                content = content
                    .replace(/\{\{char\}\}/gi, (char && char.name) || getWechatCharDisplayName(char))
                    .replace(/\{\{user\}\}/gi, (profile && profile.name) || '用户')
                    .replace(/\{\{description\}\}/gi, String((char && char.description) || '').slice(0, 900))
                    .replace(/\{\{personality\}\}/gi, String((char && char.description) || '').slice(0, 900));
                return `- ${stripWechatPromptText(title, 40)}：${stripWechatPromptText(content, 520)}`;
            })
            .filter(Boolean);
        return enabled.length ? `【当前启用预设】\n${enabled.join('\n')}` : '';
    } catch (e) {
        console.warn('build status preset prompt failed:', e);
        return '';
    }
}

function buildWechatRegexPromptForStatus(char) {
    if (typeof buildRegexAnchor !== 'function') return '';
    try {
        return buildRegexAnchor(char) || '';
    } catch (e) {
        console.warn('build status regex prompt failed:', e);
        return '';
    }
}

function getWechatUserMomentsPromptForStatus() {
    if (typeof buildUserMomentsAnchor !== 'function') return '';
    try {
        return buildUserMomentsAnchor() || '';
    } catch (_) {
        return '';
    }
}

async function requestWechatAiStatusSnapshot(charOrId, options = {}) {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    if (!char) return null;
    char.chatConfig = char.chatConfig || {};
    window._wechatAiStatusGenerating = window._wechatAiStatusGenerating || new Map();
    if (window._wechatAiStatusGenerating.has(char.id)) {
        return window._wechatAiStatusGenerating.get(char.id);
    }

    const promise = (async () => {
        let snapshot = null;
        let errorText = '';
        try {
            const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : ((typeof getUserProfile === 'function') ? getUserProfile() : { name: '用户' });
            const identityAnchor = buildWechatIdentityContextPrompt(char, userProfile);
            const presetAnchor = buildWechatPresetPromptForStatus(char);
            const regexAnchor = buildWechatRegexPromptForStatus(char);
            const momentsAnchor = getWechatUserMomentsPromptForStatus();
            const previousStatus = buildWechatPreviousAiStatusPrompt(char);
            const worldBookAnchor = buildWechatWorldBookPrompt(char);
            const memoryAnchor = typeof buildWechatMemoryPrompt === 'function' ? buildWechatMemoryPrompt(char) : '';
            const characterCard = stripWechatPromptText(char.description || '', 3000);
            const result = await callChatApi([
                {
                    role: 'system',
                    content: `你是 BYND 的微信角色状态收据生成器。你的任务不是继续聊天，而是根据真实上下文生成「${char.name || '角色'}」此刻的状态快照。只返回 JSON，不要 Markdown，不要解释。JSON 字段必须包含：innerMonologue, miniDiary, thoughts, outfit, posture, action, gaze, penis。miniDiary 是想对用户说但没说出口的话。必须综合角色卡、人设、启用预设、正则设定、世界书、当前聊天备注/称呼、记忆、朋友圈、最近聊天和上一轮状态。用户给角色设置的备注只是身份元信息，不是用户名字，也不一定是聊天主题；如果最近聊天没有谈到名字/备注/称呼，不要让内心独白、小日记或想法围绕备注展开。不要编造用户没有说过的名字争议。所有字段都按最近聊天情绪和角色人设自然生成，禁止固定占位、模板化省略、拒绝式套话或“未特别描写”。`
                },
                {
                    role: 'user',
                    content: `${identityAnchor}\n${characterCard ? `\n【角色卡/人设】\n${characterCard}\n` : ''}${presetAnchor ? `\n${presetAnchor}\n` : ''}${regexAnchor ? `\n${regexAnchor}\n` : ''}${worldBookAnchor ? `\n${worldBookAnchor}\n` : ''}${memoryAnchor ? `\n${memoryAnchor}\n` : ''}\n【最近聊天上下文】\n${buildWechatRecentHistoryForPrompt(char, 24)}\n${momentsAnchor ? `\n${momentsAnchor}` : ''}${previousStatus ? `\n【上一轮状态】\n${previousStatus}` : ''}`
                }
            ]);
            if (result && result.ok) {
                snapshot = normalizeWechatAiStatusSnapshot(parseWechatJsonObject(result.content), char, options.reason || 'api');
                if (!snapshot) errorText = 'API 没有返回可解析的状态 JSON';
            } else {
                errorText = (result && result.error) || 'API 状态生成失败';
            }
        } catch (e) {
            console.warn('request ai status failed:', e);
            errorText = 'API 状态生成失败';
        }

        if (snapshot) {
            char.chatConfig.aiStatusSnapshot = snapshot;
            char.chatConfig.aiStatusError = '';
            char.chatConfig.aiStatusHistory = Array.isArray(char.chatConfig.aiStatusHistory) ? char.chatConfig.aiStatusHistory : [];
            char.chatConfig.aiStatusHistory.unshift(snapshot);
            char.chatConfig.aiStatusHistory = char.chatConfig.aiStatusHistory.slice(0, 20);
        } else if (errorText) {
            char.chatConfig.aiStatusError = errorText;
        }
        saveCharactersToStorage();
        if (window._wechatAiStatusOpenCharId === char.id) renderWechatAiStatusTicket(char);
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
        return snapshot;
    })();

    window._wechatAiStatusGenerating.set(char.id, promise);
    try {
        return await promise;
    } finally {
        window._wechatAiStatusGenerating.delete(char.id);
        if (window._wechatAiStatusOpenCharId === char.id) renderWechatAiStatusTicket(char);
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
    }
}

function openWechatAiStatusTicket(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    window._wechatAiStatusOpenCharId = charId;
    let modal = document.getElementById('wc-ai-status-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-ai-status-overlay';
        modal.className = 'wc-ai-status-overlay';
        modal.setAttribute('onclick', 'if(event.target===this) closeWechatAiStatusTicket()');
        getWechatModalRoot().appendChild(modal);
    }
    renderWechatAiStatusTicket(char);
    if (!getWechatAiStatusSnapshot(char)) {
        requestWechatAiStatusSnapshot(char, { reason: 'avatar_open' }).catch(e => console.warn('ai status open failed:', e));
    }
}

function renderWechatAiStatusTicket(char) {
    const modal = document.getElementById('wc-ai-status-overlay');
    if (!modal || !char) return;
    const snapshot = getWechatAiStatusSnapshot(char);
    const isLoading = !!(window._wechatAiStatusGenerating && window._wechatAiStatusGenerating.has(char.id));
    const statusError = char.chatConfig && char.chatConfig.aiStatusError;
    const charName = getWechatCharDisplayName(char);
    const statusTime = snapshot ? formatWechatSnapshotTime(snapshot.updatedAt) : formatWechatSnapshotTime(Date.now());
    const sourceLabel = snapshot ? (snapshot.generatedBy === 'api' ? 'API RECEIPT' : 'LOCAL RECEIPT') : (isLoading ? 'GENERATING' : 'EMPTY RECEIPT');
    const fieldsHtml = WECHAT_AI_STATUS_FIELDS.map((item, index) => {
        const value = getWechatStatusFieldDisplay(snapshot, item, isLoading, statusError);
        return `
        <div class="wc-ai-status-row">
            <div class="wc-ai-status-item-head">
                <b>#${String(index + 1).padStart(2, '0')}</b>
                <span>${wcEscapeHtml(item.label)}</span>
                <i></i>
                <em>${wcEscapeHtml(item.key)}</em>
            </div>
            <p>${wcEscapeHtml(value)}</p>
        </div>
    `;
    }).join('');
    const guestbookText = snapshot && snapshot.fields && !isWechatStatusPlaceholderValue(snapshot.fields.miniDiary)
        ? snapshot.fields.miniDiary
        : 'click refresh';
    modal.innerHTML = `
        <div class="wc-ai-status-ticket">
            <div class="wc-ai-status-top">
                <button type="button" onclick="closeWechatAiStatusTicket()" aria-label="关闭"><i class="ri-close-line"></i></button>
                <div>
                    <strong>${wcEscapeHtml(charName)}</strong>
                    <span>${wcEscapeHtml(sourceLabel)}</span>
                </div>
                <button type="button" onclick="openWechatAiStatusHistory(${quoteWechatJsString(char.id)})" aria-label="历史记录"><i class="ri-history-line"></i></button>
            </div>
            <div class="wc-ai-status-brand">
                <div class="wc-ai-status-logo"><i class="ri-cup-line"></i><span>STATUS</span></div>
                <h3>${wcEscapeHtml(charName)}</h3>
                <p>CHARACTER RECEIPT</p>
            </div>
            <div class="wc-ai-status-meta">
                <span>DATE</span><b>${wcEscapeHtml(statusTime)}</b>
                <span>SERIAL NUMBER</span><b>${wcEscapeHtml(getWechatStatusSerial(char))}</b>
            </div>
            <div class="wc-ai-status-bar">ITEM</div>
            <div class="wc-ai-status-fields">${fieldsHtml}</div>
            ${statusError && !snapshot ? `<div class="wc-ai-status-error">${wcEscapeHtml(statusError)}</div>` : ''}
            <div class="wc-ai-status-footer">
                <div><span>TOTAL</span><b>${WECHAT_AI_STATUS_FIELDS.length}</b></div>
                <div><span>AMOUNT</span><b>$0.00</b></div>
            </div>
            <div class="wc-ai-status-guestbook">
                <span>GUESTBOOK</span>
                <p>${wcEscapeHtml(guestbookText)}</p>
                <b>MESSAGE DATE: ${wcEscapeHtml(statusTime)}</b>
            </div>
            <div class="wc-ai-status-goodday">BEYOND THE SCREEN</div>
        </div>
    `;
}

function getWechatAiStatusHistory(char) {
    if (!char || !char.chatConfig) return [];
    const list = [];
    const seen = new Set();
    const pushSnapshot = snapshot => {
        if (!snapshot || !snapshot.fields) return;
        const key = `${snapshot.updatedAt || ''}_${snapshot.reason || ''}_${JSON.stringify(snapshot.fields)}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push(snapshot);
    };
    pushSnapshot(char.chatConfig.aiStatusSnapshot);
    (Array.isArray(char.chatConfig.aiStatusHistory) ? char.chatConfig.aiStatusHistory : []).forEach(pushSnapshot);
    return list.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 30);
}

function renderWechatAiStatusHistoryFields(snapshot) {
    const fields = snapshot && snapshot.fields ? snapshot.fields : {};
    return WECHAT_AI_STATUS_FIELDS.map((item, index) => {
        const value = fields[item.key];
        return `
            <div class="wc-ai-history-field">
                <b>#${String(index + 1).padStart(2, '0')} ${wcEscapeHtml(item.label)}</b>
                <p>${wcEscapeHtml(isWechatStatusPlaceholderValue(value) ? '未记录' : value)}</p>
            </div>
        `;
    }).join('');
}

function openWechatAiStatusHistory(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    const modal = document.getElementById('wc-ai-status-overlay');
    if (!char || !modal) return;
    const history = getWechatAiStatusHistory(char);
    const charName = getWechatCharDisplayName(char);
    const historyHtml = history.length ? history.map((snapshot, index) => `
        <details class="wc-ai-history-item" ${index === 0 ? 'open' : ''}>
            <summary>
                <span>${index === 0 ? 'CURRENT' : `HISTORY ${String(index).padStart(2, '0')}`}</span>
                <b>${wcEscapeHtml(formatWechatSnapshotTime(snapshot.updatedAt))}</b>
                <em>${wcEscapeHtml(snapshot.reason || snapshot.generatedBy || 'status')}</em>
            </summary>
            <div class="wc-ai-history-fields">
                ${renderWechatAiStatusHistoryFields(snapshot)}
            </div>
        </details>
    `).join('') : `
        <div class="wc-ai-history-empty">
            <i class="ri-history-line"></i>
            <span>还没有状态历史</span>
            <p>AI 状态生成后会自动保存到这里。</p>
        </div>
    `;
    modal.innerHTML = `
        <div class="wc-ai-status-ticket wc-ai-status-history">
            <div class="wc-ai-status-top">
                <button type="button" onclick="backWechatAiStatusTicket(${quoteWechatJsString(char.id)})" aria-label="返回状态"><i class="ri-arrow-left-s-line"></i></button>
                <div>
                    <strong>${wcEscapeHtml(charName)}</strong>
                    <span>STATUS HISTORY · ${history.length}</span>
                </div>
                <button type="button" onclick="closeWechatAiStatusTicket()" aria-label="关闭"><i class="ri-close-line"></i></button>
            </div>
            <div class="wc-ai-status-brand">
                <div class="wc-ai-status-logo"><i class="ri-history-line"></i><span>HISTORY</span></div>
                <h3>${wcEscapeHtml(charName)}</h3>
                <p>ATTRIBUTE ARCHIVE</p>
            </div>
            <div class="wc-ai-status-bar">RECORDS</div>
            <div class="wc-ai-history-list">${historyHtml}</div>
            <div class="wc-ai-status-goodday">BEYOND THE SCREEN</div>
        </div>
    `;
}

function backWechatAiStatusTicket(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (char) renderWechatAiStatusTicket(char);
}

function refreshWechatAiStatusTicket(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    renderWechatAiStatusTicket(char);
    requestWechatAiStatusSnapshot(char, { reason: 'manual_refresh' }).catch(e => console.warn('manual status refresh failed:', e));
}

function closeWechatAiStatusTicket() {
    const modal = document.getElementById('wc-ai-status-overlay');
    if (modal) modal.remove();
    window._wechatAiStatusOpenCharId = '';
}

function normalizeWechatTextList(value, fallback = []) {
    if (Array.isArray(value)) return value.map(item => stripWechatPromptText(item, 120)).filter(Boolean).slice(0, 6);
    if (typeof value === 'string' && value.trim()) return value.split(/\n+/).map(item => stripWechatPromptText(item, 120)).filter(Boolean).slice(0, 6);
    return fallback;
}

function getWechatPersonaContactSeeds(char) {
    const source = [
        char && char.description,
        Array.isArray(char && char.worldBook) ? char.worldBook.map(entry => `${entry.key || entry.keys || ''} ${entry.content || entry.entry || entry.value || ''}`).join('\n') : ''
    ].join('\n');
    if (/公司|集团|总裁|助理|秘书|项目|会议|客户|董事|办公室|合同/.test(source)) {
        return [
            { name: '沈助理', text: '明早会议材料已放到桌面', time: '08:20' },
            { name: '周秘书', text: '董事会临时改到下午', time: '昨天' },
            { name: '项目群', text: '等你确认最终版本', time: '周二' }
        ];
    }
    if (/校园|学生|老师|同学|社团|图书馆|考试|课程|实验室/.test(source)) {
        return [
            { name: '同桌', text: '作业拍你了，别忘交', time: '10:12' },
            { name: '社团群', text: '今晚排练照旧', time: '昨天' },
            { name: '图书馆管理员', text: '预约座位即将到时', time: '周三' }
        ];
    }
    if (/魔法|王国|骑士|神|祭司|宫廷|龙|巫|异能|末日|组织/.test(source)) {
        return [
            { name: '旧城信使', text: '密函已经送到', time: '薄暮' },
            { name: '档案室', text: '禁阅卷宗被重新封存', time: '昨日' },
            { name: '巡夜人', text: '北侧钟塔有异常光', time: '午夜' }
        ];
    }
    if (/乐队|舞台|演员|经纪|剧组|粉丝|音乐|画室|摄影|直播|偶像/.test(source)) {
        return [
            { name: '经纪人', text: '采访时间又提前了', time: '09:35' },
            { name: '录音室', text: 'demo 已经导出', time: '昨天' },
            { name: '剧组统筹', text: '下一场换到 B 棚', time: '周一' }
        ];
    }
    return [
        { name: '置顶备忘', text: '有些话还没发出去', time: '刚刚' },
        { name: '旧联系人', text: '很久没有回复', time: '昨天' },
        { name: '未命名群聊', text: '新的消息被折叠了', time: '周二' }
    ];
}

function buildWechatAiPhoneFallback(char) {
    const status = getWechatAiStatusSnapshot(char);
    const fields = (status && status.fields) || {};
    const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : ((typeof getUserProfile === 'function') ? getUserProfile() : { name: '\u7528\u6237' });
    const userName = getWechatAiPhoneUserDisplayName(char, userProfile);
    const history = Array.isArray(char && char.history) ? char.history : [];
    const lastMsg = history.slice().reverse().find(msg => msg && msg.type !== 'system_notice');
    const lastText = stripWechatPromptText(getWechatMessagePromptContent(lastMsg), 62) || '\u8fd8\u6ca1\u6709\u65b0\u6d88\u606f';
    const personaContacts = getWechatPersonaContactSeeds(char);

    return {
        updatedAt: Date.now(),
        generatedBy: 'local',
        chats: [
            { name: userName, text: lastText, time: formatWechatSnapshotTime(Date.now()) },
            ...personaContacts
        ],
        memos: normalizeWechatTextList([fields.thoughts, fields.miniDiary].filter(Boolean), ['\u6ca1\u6709\u5907\u5fd8\u5f55\u3002']),
        browser: getWechatAiPhoneBrowserRows(null, char),
        wallet: getWechatAiPhoneWalletSummary(null, char),
        footprints: getWechatAiPhoneLikelyPlaceRows(char, fields, status),
        usageRecords: getWechatAiPhoneUsageRows(null, char),
        scheduleRecords: getWechatAiPhoneScheduleRows(null, char),
        shoppingRecords: getWechatAiPhoneShoppingRows(null, char),
        takeoutRecords: getWechatAiPhoneTakeoutRows(null, char),
        gameRecords: getWechatAiPhoneGameRows(null, char),
        diary: fields.miniDiary || `\u4eca\u5929\u628a\u548c${userName}\u7684\u804a\u5929\u91cd\u65b0\u770b\u4e86\u4e00\u904d\u3002`
    };
}

function getWechatAiPhoneUserDisplayName(char, profile) {
    return getWechatAiPhoneUserRemark(char, profile);
}

function getWechatAiPhoneUserRemark(char, profile) {
    char = char || {};
    const config = char.chatConfig || {};
    const saved = stripWechatPromptText(config.aiPhoneUserRemark, 24);
    if (saved) return saved;
    const source = getWechatAiPhonePersonaSource(char);
    if (/总裁|老板|上司|秘书|助理|项目|会议|客户|办公室/.test(source)) return '重要联系人';
    if (/校园|学生|同学|老师|社团|图书馆|课程/.test(source)) return '同桌';
    if (/乐队|舞台|演员|偶像|音乐|经纪|剧组|摄影/.test(source)) return '特别关注';
    if (/魔法|王国|骑士|祭司|宫廷|异能|组织/.test(source)) return '契约人';
    return '置顶的人';
}

function setWechatAiPhoneUserRemark(char, value) {
    if (!char) return '';
    const next = stripWechatPromptText(value, 24);
    if (!next || /^(我|用户|user)$/i.test(next)) return getWechatAiPhoneUserRemark(char);
    char.chatConfig = char.chatConfig || {};
    char.chatConfig.aiPhoneUserRemark = next;
    return next;
}

function normalizeWechatAiPhoneRecordList(value, fallback = [], limit = 8) {
    const parseRecord = (item, index) => {
        if (!item) return null;
        if (typeof item === 'object') {
            const title = stripWechatPromptText(
                item.title || item.name || item.place || item.location || item.app || item.application || item.label || item.text || '',
                40
            );
            const detail = stripWechatPromptText(
                item.detail || item.address || item.reason || item.summary || item.note || item.description || item.text || '',
                92
            );
            const meta = stripWechatPromptText(
                item.meta || item.time || item.duration || item.lastUsed || item.count || item.value || '',
                20
            );
            if (!title && !detail && !meta) return null;
            return {
                title: title || detail || `记录 ${index + 1}`,
                detail: detail && detail !== title ? detail : '',
                meta
            };
        }
        const text = stripWechatPromptText(item, 140);
        if (!text) return null;
        const parts = text.split(/[｜|]/).map(part => stripWechatPromptText(part, 80)).filter(Boolean);
        if (parts.length >= 3) return { title: parts[0], detail: parts.slice(2).join(' · '), meta: parts[1] };
        if (parts.length === 2) return { title: parts[0], detail: parts[1], meta: '' };
        const softParts = text.split(/\s+[·•]\s+|\s+-\s+|\s+—\s+/).map(part => stripWechatPromptText(part, 80)).filter(Boolean);
        if (softParts.length >= 2) return { title: softParts[0], detail: softParts.slice(1).join(' · '), meta: '' };
        return { title: text, detail: '', meta: '' };
    };

    let source = [];
    if (Array.isArray(value)) source = value;
    else if (typeof value === 'string' && value.trim()) source = value.split(/\n+/);
    const parsed = source.map(parseRecord).filter(Boolean).slice(0, limit);
    if (parsed.length) return parsed;
    return Array.isArray(fallback) ? fallback.slice(0, limit) : [];
}

function isWechatAiPhoneScheduleNarrative(value) {
    const text = stripWechatPromptText(value, 120);
    if (!text) return false;
    if (text.length > 34) return true;
    return /后脑|发根|指腹|摩挲|唇|呼吸|腰|腿|胸|暧昧|姿势|动作|视线|目光|小夜灯|床|衣角|手指|掌心|安抚|贴近|压低|颤|喘|亲|吻/.test(text);
}

function getWechatAiPhoneScheduleTime(row, fallbackIndex = 0) {
    const source = [row && row.time, row && row.title, row && row.meta, row && row.detail].map(item => String(item || '')).join(' ');
    const match = source.match(/([01]?\d|2[0-3])[:：][0-5]\d/);
    if (match) return match[0].replace('：', ':').padStart(5, '0');
    return ['09:30', '14:00', '20:30', '22:30'][fallbackIndex] || '09:00';
}

function cleanWechatAiPhoneScheduleTitle(value, fallback) {
    if (isWechatAiPhoneScheduleNarrative(value)) return fallback;
    const text = stripWechatPromptText(value, 28)
        .replace(/^([01]?\d|2[0-3])[:：][0-5]\d\s*/, '')
        .replace(/^(今天|明天|上午|下午|晚上|今晚|稍后|现在)\s*/, '')
        .trim();
    if (!text || isWechatAiPhoneScheduleNarrative(text)) return fallback;
    return text;
}

function cleanWechatAiPhoneScheduleMeta(value, fallback = '今天') {
    if (isWechatAiPhoneScheduleNarrative(value)) return fallback;
    const text = stripWechatPromptText(value, 12);
    if (!text || isWechatAiPhoneScheduleNarrative(text)) return fallback;
    if (/现在|当前/.test(text)) return '现在';
    if (/明天/.test(text)) return '明天';
    if (/下午/.test(text)) return '下午';
    if (/晚上|今晚/.test(text)) return '晚上';
    if (/稍后/.test(text)) return '稍后';
    if (/本周/.test(text)) return '本周';
    if (/今天|上午|中午/.test(text)) return text;
    return fallback;
}

function normalizeWechatAiPhoneScheduleRows(rows) {
    const defaults = ['当前安排', '日历提醒', '私人时间', '睡前提醒'];
    return (Array.isArray(rows) ? rows : []).map((row, index) => {
        const source = row && typeof row === 'object'
            ? row
            : normalizeWechatAiPhoneRecordList([row], [], 1)[0];
        if (!source) return null;
        const time = getWechatAiPhoneScheduleTime(source, index);
        const title = cleanWechatAiPhoneScheduleTitle(source.title || source.detail || '', defaults[index] || `行程 ${index + 1}`);
        const meta = cleanWechatAiPhoneScheduleMeta(source.meta || source.time || source.detail || '', index === 0 ? '今天' : '稍后');
        return { time, title, meta };
    }).filter(Boolean).slice(0, 6);
}

function getWechatAiPhonePersonaSource(char) {
    return [
        char && char.description,
        Array.isArray(char && char.worldBook)
            ? char.worldBook.map(entry => `${entry.key || entry.keys || entry.name || ''} ${entry.content || entry.entry || entry.value || entry.text || ''}`).join('\n')
            : ''
    ].join('\n');
}

function getWechatAiPhoneLikelyPlaceRows(char, fields = {}, status = null) {
    const source = getWechatAiPhonePersonaSource(char);
    const time = status && status.updatedAt ? formatWechatSnapshotTime(status.updatedAt) : formatWechatSnapshotTime(Date.now());
    const explicitPlace = [
        fields.location,
        fields.place,
        fields.scene,
        fields.address,
        fields.area
    ].map(item => stripWechatPromptText(item, 34)).find(Boolean);
    const recentHint = stripWechatPromptText(fields.action || fields.gaze || '', 48);
    const withMeta = (rows) => rows.map((row, index) => ({
        title: row.title,
        meta: row.meta || (index === 0 ? `今天 ${time}` : row.when || '最近'),
        detail: row.detail || (recentHint && index === 0 ? `最近状态：${recentHint}` : row.fallbackDetail || '系统定位记录')
    }));

    if (explicitPlace) {
        return withMeta([
            { title: explicitPlace, detail: recentHint ? `最近在这里停留：${recentHint}` : '最近到过的位置' },
            { title: '常去地点', detail: '由手机定位整理的日常活动范围', when: '本周' },
            { title: '回程路线', detail: '地图建议的常用路线', when: '昨天' }
        ]);
    }
    if (/公司|集团|总裁|助理|秘书|项目|会议|客户|董事|办公室|合同/.test(source)) {
        return withMeta([
            { title: '公司大楼', detail: '上午进入办公区，停留约 2 小时 40 分钟' },
            { title: '会议室楼层', detail: '日程显示有早会和项目确认', when: '今天 09:30' },
            { title: '地下停车场', detail: '下班前短暂停留', when: '昨天' }
        ]);
    }
    if (/校园|学生|老师|同学|社团|图书馆|考试|课程|实验室/.test(source)) {
        return withMeta([
            { title: '图书馆', detail: '靠窗座位附近停留较久' },
            { title: '教学楼', detail: '上午课程路线', when: '今天 10:05' },
            { title: '社团活动室', detail: '晚间活动记录', when: '昨天' }
        ]);
    }
    if (/乐队|舞台|演员|经纪|剧组|粉丝|音乐|画室|摄影|直播|偶像/.test(source)) {
        return withMeta([
            { title: '录音室', detail: '设备连接记录与音乐 App 使用时间重合' },
            { title: '摄影棚', detail: '工作日程显示拍摄/排练', when: '今天 14:20' },
            { title: '后台化妆间', detail: '演出前后常用路线', when: '昨天' }
        ]);
    }
    if (/魔法|王国|骑士|神|祭司|宫廷|龙|巫|异能|末日|组织/.test(source)) {
        return withMeta([
            { title: '旧城钟塔', detail: '夜间巡行路线留下的定位点' },
            { title: '档案室', detail: '封存记录附近停留', when: '昨日' },
            { title: '南侧城门', detail: '常用出入路线', when: '本周' }
        ]);
    }
    return withMeta([
        { title: '家附近', detail: '日常停留时间最长的位置' },
        { title: '常去咖啡店', detail: '短暂停留并打开过聊天' },
        { title: '便利店路口', detail: '回程路线经过', when: '昨天' }
    ]);
}

function isWechatAiPhonePlaceLike(row) {
    const text = `${row && row.title || ''} ${row && row.detail || ''}`;
    return /家|公司|学校|图书馆|咖啡|餐厅|店|路|街|楼|室|馆|站|机场|车站|公园|商场|酒店|门口|附近|办公室|教室|棚|城|塔|宫|院|工作室|录音|地点|位置|路线|定位/.test(text);
}

function getWechatAiPhoneFootprintRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && snapshot.footprints, [], 6);
    if (rawRows.some(isWechatAiPhonePlaceLike)) return rawRows.slice(0, 5);
    const status = getWechatAiStatusSnapshot(char);
    return getWechatAiPhoneLikelyPlaceRows(char, (status && status.fields) || {}, status).slice(0, 5);
}


function getWechatAiPhoneSourceText(char) {
    return String(getWechatAiPhonePersonaSource(char) || '');
}

function shouldWechatAiPhoneShowGames(char, snapshot = null) {
    const rawGames = normalizeWechatAiPhoneRecordList(snapshot && (snapshot.gameRecords || snapshot.games || snapshot['\u6e38\u620f']), [], 5);
    if (rawGames.length) return true;
    const source = getWechatAiPhoneSourceText(char);
    if (/\u6e38\u620f|\u7535\u7ade|\u624b\u6e38|\u7f51\u6e38|\u4e3b\u673a|Switch|steam|Steam|PS5|\u684c\u6e38|\u72fc\u4eba\u6740|\u4e94\u5b50\u68cb|\u8c61\u68cb|\u68cb|\u724c|\u5b85|\u7f51\u5427|\u76f4\u64ad|\u4e3b\u64ad|\u5b66\u751f|\u6821\u56ed|\u540c\u5b66|\u793e\u56e2|\u4f11\u95f2/.test(source)) return true;
    if (/\u603b\u88c1|\u96c6\u56e2|\u8463\u4e8b|\u5f8b\u5e08|\u533b\u751f|\u519b\u5b98|\u8b66\u5bdf|\u6559\u6388|\u796d\u53f8|\u79d8\u4e66|\u529e\u516c\u5ba4/.test(source)) return false;
    return /\u5c11\u5e74|\u5c11\u5973|\u670b\u53cb|\u5468\u672b|\u624b\u673a|\u591c\u665a|\u65e0\u804a|\u5192\u9669/.test(source);
}

function getWechatAiPhoneScheduleRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && (snapshot.scheduleRecords || snapshot.schedule || snapshot.calendar || snapshot['\u884c\u7a0b'] || snapshot['\u65e5\u7a0b']), [], 8);
    if (rawRows.length) return normalizeWechatAiPhoneScheduleRows(rawRows);
    const source = getWechatAiPhoneSourceText(char);
    const nowText = formatWechatSnapshotTime(Date.now());
    if (/\u516c\u53f8|\u96c6\u56e2|\u603b\u88c1|\u52a9\u7406|\u79d8\u4e66|\u9879\u76ee|\u4f1a\u8bae|\u5ba2\u6237|\u8463\u4e8b|\u529e\u516c\u5ba4|\u5408\u540c/.test(source)) {
        return normalizeWechatAiPhoneScheduleRows([
            { time: '09:30', title: '\u65e9\u4f1a', meta: '\u4eca\u5929' },
            { time: '14:00', title: '\u9879\u76ee\u786e\u8ba4', meta: '\u7a0d\u540e' },
            { time: '20:30', title: '\u79c1\u4eba\u65f6\u95f4', meta: '\u665a\u4e0a' }
        ]);
    }
    if (/\u6821\u56ed|\u5b66\u751f|\u8001\u5e08|\u540c\u5b66|\u793e\u56e2|\u56fe\u4e66\u9986|\u8003\u8bd5|\u8bfe\u7a0b|\u5b9e\u9a8c\u5ba4/.test(source)) {
        return normalizeWechatAiPhoneScheduleRows([
            { time: '08:20', title: '\u7b2c\u4e00\u8282\u8bfe', meta: '\u4eca\u5929' },
            { time: '13:10', title: '\u56fe\u4e66\u9986', meta: '\u4e0b\u5348' },
            { time: '19:00', title: '\u793e\u56e2\u6216\u81ea\u4e60', meta: '\u665a\u4e0a' }
        ]);
    }
    if (/\u4e50\u961f|\u821e\u53f0|\u6f14\u5458|\u7ecf\u7eaa|\u5267\u7ec4|\u7c89\u4e1d|\u97f3\u4e50|\u753b\u5ba4|\u6444\u5f71|\u76f4\u64ad|\u5076\u50cf/.test(source)) {
        return normalizeWechatAiPhoneScheduleRows([
            { time: '10:30', title: '\u6392\u7ec3/\u62cd\u6444', meta: '\u4eca\u5929' },
            { time: '15:40', title: '\u9020\u578b\u786e\u8ba4', meta: '\u4e0b\u5348' },
            { time: '21:00', title: '\u6536\u5de5\u540e\u56de\u6d88\u606f', meta: '\u665a\u4e0a' }
        ]);
    }
    return normalizeWechatAiPhoneScheduleRows([
        { time: nowText, title: '\u5f53\u524d\u72b6\u6001', meta: '\u73b0\u5728' },
        { time: '18:30', title: '\u665a\u95f4\u5b89\u6392', meta: '\u4eca\u5929' },
        { time: '22:30', title: '\u7761\u524d\u63d0\u9192', meta: '\u4eca\u665a' }
    ]);
}

function getWechatAiPhoneShoppingRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && (snapshot.shoppingRecords || snapshot.shopping || snapshot.orders || snapshot['\u8d2d\u7269'] || snapshot['\u8d2d\u7269\u8bb0\u5f55']), [], 8);
    if (rawRows.length) return rawRows.slice(0, 6);
    const history = Array.isArray(char && char.history) ? char.history : [];
    const rows = history.slice().reverse().reduce((list, msg) => {
        if (list.length >= 5 || !msg) return list;
        if (msg.type === 'gift') {
            const item = msg.item && typeof msg.item === 'object' ? msg.item : {};
            list.push({ title: item.name || msg.title || '\u793c\u7269\u8ba2\u5355', detail: msg.isMe ? '\u7528\u6237\u53d1\u6765\u7684\u793c\u7269\u8bb0\u5f55' : '\u89d2\u8272\u9001\u51fa\u7684\u793c\u7269\u8bb0\u5f55', meta: formatMessageTime(msg) });
        } else if (msg.type === 'share_card' && msg.card && (msg.card.action === 'product' || msg.card.product)) {
            const product = msg.card.product || {};
            list.push({ title: product.name || msg.card.title || '\u5546\u54c1\u5361\u7247', detail: product.description || msg.card.text || '\u4ece\u8d2d\u7269\u9875\u8f6c\u53d1\u7684\u5546\u54c1', meta: formatMessageTime(msg) });
        } else if (msg.type === 'intimatePay') {
            list.push({ title: '\u4eb2\u5bc6\u4ed8\u8bb0\u5f55', detail: msg.note || msg.description || '\u4eb2\u5bc6\u4ed8\u76f8\u5173\u8d26\u5355', meta: formatMessageTime(msg) });
        }
        return list;
    }, []);
    if (rows.length) return rows;
    return [
        { title: '\u6700\u8fd1\u8d2d\u7269', detail: '\u6309\u89d2\u8272\u4eba\u8bbe\u6574\u7406\u7684\u8ba2\u5355\u6458\u8981', meta: '\u4eca\u5929' },
        { title: '\u6536\u85cf\u5939', detail: '\u53ef\u80fd\u60f3\u9001\u7ed9\u7528\u6237\u7684\u5c0f\u4e1c\u897f', meta: '\u672c\u5468' }
    ];
}

function getWechatAiPhoneTakeoutRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && (snapshot.takeoutRecords || snapshot.takeout || snapshot.foodDelivery || snapshot['\u5916\u5356'] || snapshot['\u5916\u5356\u8bb0\u5f55']), [], 8);
    if (rawRows.length) return rawRows.slice(0, 6);
    const rows = [];
    try {
        const store = typeof readWechatStore === 'function'
            ? readWechatStore(WECHAT_TAKEOUT_STORAGE_KEY, { orders: [] })
            : JSON.parse(localStorage.getItem(WECHAT_TAKEOUT_STORAGE_KEY) || '{"orders":[]}');
        (Array.isArray(store.orders) ? store.orders : []).slice(-3).reverse().forEach(order => {
            rows.push({
                title: order.shopName || order.storeName || '\u5916\u5356\u8ba2\u5355',
                detail: order.summary || order.note || '\u6700\u8fd1\u70b9\u8fc7\u7684\u5916\u5356',
                meta: order.time || order.status || '\u6700\u8fd1'
            });
        });
    } catch (e) {}
    if (rows.length) return rows.slice(0, 4);
    return [
        { title: '\u5e38\u70b9\u5e97\u94fa', detail: '\u6700\u8fd1\u4e00\u6b21\u5916\u5356\u8bb0\u5f55', meta: '\u4eca\u5929' },
        { title: '\u5907\u7528\u5730\u5740', detail: '\u5bb6/\u5de5\u4f5c\u5730\u70b9\u7684\u914d\u9001\u5730\u5740', meta: '\u5df2\u4fdd\u5b58' }
    ];
}

function getWechatAiPhoneGameRows(snapshot, char) {
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && (snapshot.gameRecords || snapshot.games || snapshot['\u6e38\u620f'] || snapshot['\u73a9\u7684\u6e38\u620f']), [], 8);
    if (rawRows.length) return rawRows.slice(0, 6);
    if (!shouldWechatAiPhoneShowGames(char, snapshot)) return [];
    const source = getWechatAiPhoneSourceText(char);
    if (/\u68cb|\u724c|\u72fc\u4eba\u6740|\u63a8\u7406|\u684c\u6e38/.test(source)) {
        return [
            { title: 'BYND \u72fc\u4eba\u6740', detail: '\u4e0a\u6b21\u73a9\u5230\u53d1\u8a00\u9636\u6bb5', meta: '12\u5206\u949f' },
            { title: '\u4e94\u5b50\u68cb', detail: '\u6b8b\u5c40\u8fd8\u6ca1\u6709\u7ed3\u675f', meta: '6\u5206\u949f' }
        ];
    }
    return [
        { title: '\u4f11\u95f2\u5c0f\u6e38\u620f', detail: '\u7b49\u4eba\u6216\u7761\u524d\u6253\u5f00\u8fc7', meta: '9\u5206\u949f' },
        { title: '2048', detail: '\u4eca\u5929\u6700\u9ad8\u5206\u8fd8\u6ca1\u5237\u65b0', meta: '4\u5206\u949f' }
    ];
}

function getWechatAiPhoneAppUsageLabel(tabName) {
    const map = {
        home: '主屏幕',
        chat: '信息',
        wechatChat: '信息',
        memo: '备忘录',
        browser: 'Safari',
        wallet: '钱包',
        diary: '日记',
        footprints: '地图',
        usage: '屏幕使用时间',
        clock: '时钟',
        schedule: '日历',
        shopping: '购物',
        takeout: '外卖',
        games: '游戏'
    };
    return map[tabName] || '应用';
}

function recordWechatAiPhoneAppUsage(char, tabName) {
    if (!char || !tabName) return;
    char.chatConfig = char.chatConfig || {};
    const key = tabName === 'wechatChat' ? 'chat' : tabName;
    if (key === 'home') return;
    const label = getWechatAiPhoneAppUsageLabel(tabName);
    const list = Array.isArray(char.chatConfig.aiPhoneUsageLog) ? char.chatConfig.aiPhoneUsageLog : [];
    const now = Date.now();
    const existing = list.find(item => item && item.key === key);
    if (existing) {
        existing.count = Number(existing.count || 0) + 1;
        existing.lastAt = now;
        existing.minutes = Math.min(240, Number(existing.minutes || 0) + 1);
        existing.label = label;
    } else {
        list.unshift({ key, label, count: 1, lastAt: now, minutes: 1 });
    }
    char.chatConfig.aiPhoneUsageLog = list
        .filter(Boolean)
        .sort((a, b) => Number(b.lastAt || 0) - Number(a.lastAt || 0))
        .slice(0, 12);
}

function getWechatAiPhoneUsageRows(snapshot, char) {
    const history = Array.isArray(char && char.history) ? char.history.filter(msg => msg && msg.type !== 'system_notice') : [];
    const lastMsg = history[history.length - 1];
    const usageLog = Array.isArray(char && char.chatConfig && char.chatConfig.aiPhoneUsageLog) ? char.chatConfig.aiPhoneUsageLog : [];
    const rows = usageLog.map(item => ({
        title: item.label || getWechatAiPhoneAppUsageLabel(item.key),
        meta: `${Math.max(1, Number(item.minutes || 1))}分钟`,
        detail: `${formatWechatSnapshotTime(item.lastAt)} 打开 · ${Number(item.count || 1)} 次`
    }));
    const ensureRow = (title, detail, meta) => {
        if (!rows.some(row => row.title === title)) rows.push({ title, detail, meta });
    };
    ensureRow('信息', lastMsg ? `最近消息 ${formatMessageTime(lastMsg)} · 共 ${history.length} 条` : '还没有新的聊天', `${Math.max(4, Math.min(68, history.length * 2 || 4))}分钟`);
    if (snapshot && Array.isArray(snapshot.browser) && snapshot.browser.length) ensureRow('Safari', `最近浏览 ${snapshot.browser.length} 条`, `${Math.max(3, snapshot.browser.length * 4)}分钟`);
    if (snapshot && Array.isArray(snapshot.memos) && snapshot.memos.length) ensureRow('备忘录', `备忘录 ${snapshot.memos.length} 条`, `${Math.max(2, snapshot.memos.length * 3)}分钟`);
    if (history.some(msg => msg && msg.type === 'music_card')) ensureRow('音乐', '最近打开过一起听歌卡片', '8分钟');
    if (history.some(msg => msg && ['transfer', 'redpacket', 'gift', 'intimatePay'].includes(msg.type))) ensureRow('钱包', '查看过转账、红包或礼物记录', '5分钟');
    if (snapshot && Array.isArray(snapshot.scheduleRecords) && snapshot.scheduleRecords.length) ensureRow('日历', '查看过行程监控', '4分钟');
    if (snapshot && Array.isArray(snapshot.shoppingRecords) && snapshot.shoppingRecords.length) ensureRow('购物', '查看过购物记录', '5分钟');
    if (snapshot && Array.isArray(snapshot.takeoutRecords) && snapshot.takeoutRecords.length) ensureRow('外卖', '查看过外卖记录', '3分钟');
    if (snapshot && Array.isArray(snapshot.gameRecords) && snapshot.gameRecords.length) ensureRow('游戏', '打开过游戏记录', '7分钟');
    if (snapshot && snapshot.diary) ensureRow('日记', '写过没有发出去的话', '6分钟');
    return rows.slice(0, 10);
}

function getWechatAiPhoneUsageTotal(rows) {
    const total = (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
        const match = String(row && row.meta || '').match(/\d+/);
        return sum + (match ? Number(match[0]) : 0);
    }, 0);
    return Math.max(12, total || 12);
}

function getWechatAiPhoneBrowserRows(snapshot, char) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const rawRows = normalizeWechatAiPhoneRecordList(snapshot && snapshot.browser, [], 8);
    const badPattern = /视线|目光|姿势|动作|呼吸|小夜灯|额前|唇|体温|卧室|身边|腰|腿|胸|暧昧|心跳|手臂/;
    const rows = rawRows.filter(row => {
        const text = `${row.title || ''} ${row.detail || ''}`;
        return !badPattern.test(text);
    });

    history.slice().reverse().forEach(msg => {
        if (rows.length >= 6) return;
        if (!msg || msg.type === 'system_notice') return;
        if (msg.type === 'link_card' && msg.url) {
            rows.push({
                title: msg.title || getWechatLinkHost(msg.url),
                detail: getWechatLinkHost(msg.url),
                meta: formatMessageTime(msg)
            });
        } else if (msg.type === 'share_card' && msg.card) {
            const card = msg.card || {};
            rows.push({
                title: card.title || card.source || '转发内容',
                detail: stripWechatPromptText(card.text || card.source || '从聊天里打开的转发卡片', 72),
                meta: formatMessageTime(msg)
            });
        } else if (msg.type === 'music_card') {
            const music = msg.music || {};
            rows.push({
                title: music.title || msg.title || '音乐卡片',
                detail: music.artist ? `搜索音乐：${music.artist}` : '从聊天里打开的音乐',
                meta: formatMessageTime(msg)
            });
        }
    });

    if (rows.length) return rows.slice(0, 6);
    const userName = getWechatAiPhoneUserDisplayName(char);
    return [
        { title: 'BYND 聊天记录', detail: `最近打开和${userName}的对话`, meta: '今天' },
        { title: '搜索记录', detail: '查找最近保存的链接和音乐', meta: '最近' }
    ];
}


function cleanWechatAiPhoneWalletText(value) {
    return stripWechatPromptText(value, 120)
        .replace(/^\[/, '')
        .replace(/\]\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getWechatAiPhoneWalletSummary(snapshot, char) {
    const raw = stripWechatPromptText(snapshot && snapshot.wallet, 120);
    if (raw && !/未授权|无权|无法查看|不能查看|不可查看/.test(raw)) return raw;
    const history = Array.isArray(char && char.history) ? char.history : [];
    const walletMsgs = history.filter(msg => msg && ['transfer', 'redpacket', 'gift', 'intimatePay'].includes(msg.type));
    const seed = String((char && char.id) || (char && char.name) || 'wallet')
        .split('')
        .reduce((sum, ch) => (sum + ch.charCodeAt(0)) % 997, 31);
    const balance = (88 + (seed % 420) + ((seed % 9) / 10)).toFixed(2);
    if (!walletMsgs.length) return `零钱 ¥${balance} · 最近没有新的账单`;
    const last = walletMsgs[walletMsgs.length - 1];
    const summary = cleanWechatAiPhoneWalletText(getWechatMessageSummary(last));
    return `零钱 ¥${balance} · 最近${summary}`;
}

function getWechatAiPhoneWalletRows(snapshot, char) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const rows = history
        .filter(msg => msg && ['transfer', 'redpacket', 'gift', 'intimatePay'].includes(msg.type))
        .slice(-4)
        .reverse()
        .map(msg => ({
            title: cleanWechatAiPhoneWalletText(getWechatMessageSummary(msg)),
            detail: msg.isMe ? '用户发起' : `${getWechatCharDisplayName(char)}发起`,
            meta: formatMessageTime(msg)
        }));
    return rows.length ? rows : [
        { title: '交易记录', detail: '账单、转账和收款', meta: '最近' },
        { title: '卡包', detail: '银行卡与凭证', meta: '2张' },
        { title: '亲密付', detail: '亲密付状态与代付记录', meta: '可用' }
    ];
}

function getWechatAiPhoneDiaryLetters(snapshot, char) {
    const clock = getWechatAiPhoneClockParts();
    const charName = getWechatCharDisplayName(char);
    const diary = stripWechatPromptText(snapshot && snapshot.diary, 520) || '今天还没有写下日记。';
    const status = getWechatAiStatusSnapshot(char);
    const fields = (status && status.fields) || {};
    const thought = stripWechatPromptText(fields.thoughts || fields.innerMonologue || '', 420);
    const memo = stripWechatPromptText(fields.miniDiary || '', 420);
    return [
        {
            title: '没有发出去的话',
            subtitle: `Letter From ${charName}`,
            meta: clock.date,
            content: diary
        },
        {
            title: '夜里的草稿',
            subtitle: 'Unsent Draft',
            meta: 'PRIVATE',
            content: thought || diary
        },
        {
            title: '折起来的便签',
            subtitle: 'Saved Note',
            meta: 'BYND',
            content: memo || diary
        }
    ];
}

function renderWechatAiPhoneDiaryMailbox(snapshot, char) {
    const letters = getWechatAiPhoneDiaryLetters(snapshot, char);
    const openIndex = Number.isInteger(window._wechatAiPhoneDiaryOpen) ? window._wechatAiPhoneDiaryOpen : -1;
    if (openIndex >= 0 && letters[openIndex]) {
        const letter = letters[openIndex];
        return `
            <div class="wc-ai-phone-diary-open">
                <button type="button" class="wc-ai-phone-letter-back" onclick="closeWechatAiPhoneDiaryLetter()"><i class="ri-arrow-left-s-line"></i>信件</button>
                <div class="wc-ai-phone-open-envelope">
                    <div class="wc-ai-phone-envelope-flap"></div>
                    <article class="wc-ai-phone-letter-paper">
                        <header>
                            <span>FOURTEEN</span>
                            <em>${wcEscapeHtml(letter.meta)}</em>
                        </header>
                        <h3>${wcEscapeHtml(letter.title)}</h3>
                        <small>${wcEscapeHtml(letter.subtitle)}</small>
                        <p>${wcEscapeHtml(letter.content)}</p>
                        <footer>
                            <span>Dear</span>
                            <b>${wcEscapeHtml(getWechatAiPhoneUserDisplayName(char))}</b>
                        </footer>
                    </article>
                </div>
            </div>
        `;
    }
    return `
        <div class="wc-ai-phone-diary-mailbox">
            <div class="wc-ai-phone-letter-hero">
                <span>Letter From ${wcEscapeHtml(getWechatCharDisplayName(char))}</span>
                <strong>未寄出的信</strong>
                <em>轻点信封展开</em>
            </div>
            <div class="wc-ai-phone-letter-list">
                ${letters.map((letter, index) => `
                    <button type="button" class="wc-ai-phone-letter-card card-${index}" onclick="openWechatAiPhoneDiaryLetter(${index})">
                        <span>${wcEscapeHtml(letter.meta)}</span>
                        <strong>${wcEscapeHtml(letter.title)}</strong>
                        <em>${wcEscapeHtml(letter.subtitle)}</em>
                        <i>BYND</i>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function getWechatAiPhoneAlarmRows(char) {
    const source = getWechatAiPhonePersonaSource(char);
    if (/公司|集团|总裁|助理|秘书|项目|会议|客户|董事|办公室|合同/.test(source)) {
        return [
            { title: '明天 07:30', detail: '早会', meta: '开启' },
            { title: '今天 14:00', detail: '项目会', meta: '稍后' }
        ];
    }
    if (/校园|学生|老师|同学|社团|图书馆|考试|课程|实验室/.test(source)) {
        return [
            { title: '明天 07:10', detail: '起床', meta: '开启' },
            { title: '明天 09:00', detail: '上课', meta: '提醒' }
        ];
    }
    if (/乐队|舞台|演员|经纪|剧组|粉丝|音乐|画室|摄影|直播|偶像/.test(source)) {
        return [
            { title: '明天 10:30', detail: '排练', meta: '开启' },
            { title: '今天 19:00', detail: '直播/拍摄', meta: '稍后' }
        ];
    }
    return [
        { title: '明天 08:00', detail: '起床', meta: '开启' },
        { title: '今天 22:30', detail: '睡前回消息', meta: '提醒' }
    ];
}

function getWechatAiPhoneAvatarHtml(src, fallbackText, className = '') {
    const safeSrc = src || DEFAULT_AVATAR;
    return `
        <div class="wc-ai-phone-mini-avatar ${className}">
            <img src="${wcEscapeHtml(safeSrc)}" onerror="this.replaceWith(document.createTextNode('${wcEscapeHtml(getWechatAiPhoneInitial(fallbackText))}'))">
        </div>
    `;
}

function normalizeWechatAiPhoneSnapshot(raw, char) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const fallback = buildWechatAiPhoneFallback(char);
    const explicitRemark = stripWechatPromptText(data.userRemark || data.userAlias || data.userContactName || data['用户备注'] || data['用户通讯录备注'], 24);
    const userDisplayName = explicitRemark ? setWechatAiPhoneUserRemark(char, explicitRemark) : getWechatAiPhoneUserRemark(char);
    const reservedByndNames = new Set((window.myCharacters || [])
        .filter(item => item && item.id !== (char && char.id))
        .flatMap(item => [item.name, item.chatConfig && item.chatConfig.nickname])
        .filter(Boolean)
        .map(name => String(name).trim()));
    const normalizeChats = (value) => {
        if (!Array.isArray(value)) return fallback.chats;
        const list = value.map((item, index) => {
            if (typeof item === 'string') return { name: index === 0 ? userDisplayName : item, text: '聊天', time: '' };
            return {
                name: stripWechatPromptText(index === 0 ? (item.name || item.with || item.contact || userDisplayName) : (item.name || item.with || item.contact || '联系人'), 32),
                text: stripWechatPromptText(item.text || item.lastMessage || item.message || '', 82),
                time: stripWechatPromptText(item.time || item.status || '', 16)
            };
        }).filter((item, index) => item.name && (index === 0 || !reservedByndNames.has(item.name))).slice(0, 5);
        if (list.length) list[0].name = userDisplayName;
        return list.length ? list : fallback.chats;
    };

    const chats = normalizeChats(data.chats || data.chatList || data['聊天列表']);
    if (chats.length) chats[0].name = userDisplayName;

    return {
        updatedAt: Date.now(),
        generatedBy: raw ? 'api' : 'local',
        userRemark: userDisplayName,
        chats,
        memos: normalizeWechatTextList(data.memos || data.memo || data['备忘录'], fallback.memos),
        browser: getWechatAiPhoneBrowserRows({ browser: data.browser || data.browserHistory || data['浏览器'] }, char),
        wallet: getWechatAiPhoneWalletSummary({ wallet: data.wallet || data['钱包'] || fallback.wallet }, char),
        footprints: normalizeWechatAiPhoneRecordList(data.footprints || data.traces || data.locations || data['足迹'] || data['地点记录'], fallback.footprints, 6),
        usageRecords: normalizeWechatAiPhoneRecordList(data.usageRecords || data.usage || data.appUsage || data['使用记录'] || data['应用使用'], fallback.usageRecords, 10),
        scheduleRecords: getWechatAiPhoneScheduleRows({ scheduleRecords: data.scheduleRecords || data.schedule || data.calendar || data['行程'] || data['日程'] }, char),
        shoppingRecords: getWechatAiPhoneShoppingRows({ shoppingRecords: data.shoppingRecords || data.shopping || data.orders || data['购物'] || data['购物记录'] }, char),
        takeoutRecords: getWechatAiPhoneTakeoutRows({ takeoutRecords: data.takeoutRecords || data.takeout || data.foodDelivery || data['外卖'] || data['外卖记录'] }, char),
        gameRecords: getWechatAiPhoneGameRows({ gameRecords: data.gameRecords || data.games || data['游戏'] || data['玩的游戏'] }, char),
        diary: stripWechatPromptText(data.diary || data['日记'] || fallback.diary, 260)
    };
}

async function requestWechatAiPhoneSnapshot(charOrId) {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    if (!char) return null;
    char.chatConfig = char.chatConfig || {};
    window._wechatAiPhoneGenerating = window._wechatAiPhoneGenerating || new Map();
    if (window._wechatAiPhoneGenerating.has(char.id)) return window._wechatAiPhoneGenerating.get(char.id);

    const promise = (async () => {
        let snapshot = buildWechatAiPhoneFallback(char);
        try {
            const status = getWechatAiStatusSnapshot(char) || { fields: {} };
            const result = await callChatApi([
                {
                    role: 'system',
                    content: `你是「${char.name}」。根据角色卡、世界书和当前情景生成这个角色自己的小手机内容。只返回 JSON，不要 Markdown。字段：userRemark(字符串，代表你在自己手机通讯录里给用户保存的备注名，不等于用户在设置里写的称呼), chats(数组，每项 name/text/time), memos(数组), browser(数组), wallet(字符串), footprints(数组，每项是到过的地点/位置记录，可用 title/detail/meta 或“地点｜时间｜原因”，禁止写成姿势/动作流水账), usageRecords(数组，每项是这个角色手机里的 App 使用记录，例如 信息/Safari/备忘录/钱包/音乐 + 使用时长/最近行为), scheduleRecords(数组，角色自己的行程监控/日历提醒), shoppingRecords(数组，角色自己的购物记录), takeoutRecords(数组，角色点过的外卖), gameRecords(数组，角色玩过的游戏；如果人设明显不玩游戏就返回空数组), diary(字符串，写给用户但没有直接发出的认真日记)。聊天列表第一项必须是用户，name 使用你自己手机里给用户存的备注名；如果你不确定，可把 userRemark 设置为自然的亲昵称呼或用户本名，禁止直接复用用户在设置里写的“角色对你的称呼”。除第一项用户外，其余联系人必须是该角色世界里会真实存在的联系人、群聊或机构，按人设和世界书捏造；禁止复用 BYND 用户通讯录里的其他角色名字。`
                },
                {
                    role: 'user',
                    content: `角色卡：\n${String(char.description || '').slice(0, 2200)}\n\n世界书：\n${buildWechatWorldBookPrompt(char, 12)}\n\n最新状态：${JSON.stringify(status.fields || {})}\n最近聊天：\n${buildWechatRecentHistoryForPrompt(char, 12)}`
                }
            ]);
            if (result && result.ok) {
                snapshot = normalizeWechatAiPhoneSnapshot(parseWechatJsonObject(result.content), char);
            }
        } catch (e) {
            console.warn('request ai phone failed:', e);
        }
        char.chatConfig.aiPhoneSnapshot = snapshot;
        saveCharactersToStorage();
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
        return snapshot;
    })();

    window._wechatAiPhoneGenerating.set(char.id, promise);
    try {
        return await promise;
    } finally {
        window._wechatAiPhoneGenerating.delete(char.id);
        if (window._wechatAiPhoneOpenCharId === char.id) renderWechatAiPhone(char);
    }
}

function openWechatAiPhone(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    window._wechatAiPhoneOpenCharId = charId;
    window._wechatAiPhoneTab = 'home';
    window._wechatAiPhoneChatIndex = 0;
    window._wechatAiPhoneMemoIndex = -1;
    window._wechatAiPhoneBrowserIndex = -1;
    let modal = document.getElementById('wc-ai-phone-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-ai-phone-overlay';
        modal.className = 'wc-ai-phone-overlay';
        modal.setAttribute('onclick', 'if(event.target===this) closeWechatAiPhone()');
        getWechatModalRoot().appendChild(modal);
    }
    renderWechatAiPhone(char);
    const phoneSnapshot = char.chatConfig && char.chatConfig.aiPhoneSnapshot && char.chatConfig.aiPhoneSnapshot.generatedBy === 'api'
        ? char.chatConfig.aiPhoneSnapshot
        : null;
    const statusSnapshot = getWechatAiStatusSnapshot(char);
    if (!phoneSnapshot || (statusSnapshot && statusSnapshot.updatedAt > phoneSnapshot.updatedAt)) {
        requestWechatAiPhoneSnapshot(char).catch(e => console.warn('ai phone open failed:', e));
    }
}

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
        { key: 'clock', label: '时钟', icon: 'ri-time-fill', tone: 'orange' }
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

function renderWechatAiPhoneAppButton(app) {
    return `
        <button type="button" class="wc-ai-phone-app-icon tone-${app.tone}" onclick="switchWechatAiPhoneTab('${app.key}')">
            <span><i class="${app.icon}"></i></span>
            <b>${wcEscapeHtml(app.label)}</b>
        </button>
    `;
}

function renderWechatAiPhoneSection(title, icon, items, emptyText = '暂无记录') {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    return `
        <section class="wc-ai-phone-ios-card">
            <h4><i class="${icon}"></i>${wcEscapeHtml(title)}</h4>
            ${list.length
                ? list.map(item => `<p>${wcEscapeHtml(item)}</p>`).join('')
                : `<p>${wcEscapeHtml(emptyText)}</p>`}
        </section>
    `;
}

function getWechatAiPhoneInitial(name) {
    const source = String(name || '').trim();
    return wcEscapeHtml(source ? Array.from(source)[0] : '聊');
}

function getWechatAiPhoneMessageText(msg) {
    if (!msg) return '';
    if (msg.type === 'image') return msg.description || '[图片]';
    if (msg.type === 'sticker') return msg.stickerName ? `[表情：${msg.stickerName}]` : '[表情]';
    if (msg.type === 'voice') return msg.transcript || msg.description || '[语音]';
    if (msg.type === 'music_card') {
        const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
        const title = music.title || msg.title || '音乐';
        const artist = music.artist || msg.artist || '';
        return `[音乐卡片] ${title}${artist ? ` - ${artist}` : ''}`;
    }
    if (msg.type && msg.type !== 'text') {
        const synced = (typeof syncWechatMessageDescription === 'function')
            ? syncWechatMessageDescription({ ...msg })
            : msg;
        return synced.description || synced.content || msg.description || msg.content || `[${msg.type}]`;
    }
    return stripWechatPromptText(getWechatMessagePromptContent(msg), 120) || msg.content || '';
}

function resolveWechatAiPhoneSticker(item, char) {
    const msg = item && item.msg ? item.msg : {};
    if (msg.type === 'sticker' && msg.content) {
        return {
            url: msg.content,
            name: msg.stickerName || msg.name || '表情',
            emoji: !!(msg.emoji || msg.stickerKind === 'wechatEmoji' || isWechatBuiltinEmojiUrl(msg.content))
        };
    }
    const raw = String((item && item.text) || msg.content || msg.description || '').trim();
    const match = raw.match(/^\s*\[(?:微信表情|表情|发送了表情)\s*[：:]\s*([^\]]+)\]\s*$/);
    if (!match) return null;
    const args = splitWechatDirectiveArgs(match[1] || '');
    const query = args[0] || match[1] || '';
    const explicit = args.slice(1).join('|').trim();
    const sticker = (typeof findWechatStickerForAi === 'function')
        ? findWechatStickerForAi(char, query, explicit)
        : null;
    if (!sticker || !sticker.url) return null;
    return {
        url: sticker.url,
        name: sticker.name || query || '表情',
        emoji: !!(sticker.emoji || sticker.source === 'wechatEmoji' || sticker.source === 'qqEmoji' || isWechatBuiltinEmojiUrl(sticker.url))
    };
}

function renderWechatAiPhoneMiniSticker(item, char) {
    const sticker = resolveWechatAiPhoneSticker(item, char);
    if (!sticker) return '';
    const emojiClass = sticker.emoji ? ' is-emoji' : '';
    return `
        <div class="wc-ai-phone-mini-sticker${emojiClass}">
            <img src="${wcEscapeHtml(sticker.url)}" alt="${wcEscapeHtml(sticker.name || '表情')}" loading="lazy" onerror="this.closest('.wc-ai-phone-mini-sticker')?.classList.add('is-broken');this.remove()">
            <span>${wcEscapeHtml(sticker.name || '表情')}</span>
            ${item.time ? `<time>${wcEscapeHtml(item.time)}</time>` : ''}
        </div>
    `;
}

function renderWechatAiPhoneMiniMusicCard(item) {
    const msg = item.msg || {};
    const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
    const title = music.title || msg.title || '音乐';
    const artist = music.artist || msg.artist || '未知歌手';
    const source = music.sourceName || music.source || 'BYND Music';
    return `
        <div class="wc-ai-phone-mini-music-card">
            <div class="wc-ai-phone-mini-music-cover"><i class="ri-music-2-fill"></i></div>
            <div class="wc-ai-phone-mini-music-main">
                <strong>${wcEscapeHtml(title)}</strong>
                <span>${wcEscapeHtml(artist)}</span>
                <em>${wcEscapeHtml(source)}</em>
            </div>
            <button type="button" aria-label="播放音乐"><i class="ri-play-fill"></i></button>
            ${item.time ? `<time>${wcEscapeHtml(item.time)}</time>` : ''}
        </div>
    `;
}

function renderWechatAiPhoneMessageContent(item, char) {
    if (item.type === 'music_card') return renderWechatAiPhoneMiniMusicCard(item);
    const stickerHtml = renderWechatAiPhoneMiniSticker(item, char);
    if (stickerHtml) return stickerHtml;
    return `
        <p>${wcEscapeHtml(item.text)}</p>
        ${item.time ? `<time>${wcEscapeHtml(item.time)}</time>` : ''}
    `;
}

function renderWechatAiPhoneChatRows(snapshot, char) {
    const chats = Array.isArray(snapshot.chats) ? snapshot.chats : [];
    if (!chats.length) return '<div class="wc-ai-phone-empty">还没有聊天记录</div>';
    return chats.map((item, index) => `
        <button type="button" class="wc-ai-phone-chat-row" onclick="switchWechatAiPhoneChat(${index})">
            <div class="wc-ai-phone-chat-avatar ${index === 0 ? 'primary' : ''}">${getWechatAiPhoneInitial(item.name)}</div>
            <div class="wc-ai-phone-chat-main">
                <strong>${wcEscapeHtml(item.name || '联系人')}</strong>
                <span>${wcEscapeHtml(item.text || ' ')}</span>
            </div>
            <em>${wcEscapeHtml(item.time || '')}</em>
            <i class="ri-arrow-right-s-line"></i>
        </button>
    `).join('');
}

function renderWechatAiPhoneConversationRows(snapshot, char, index) {
    const chats = Array.isArray(snapshot.chats) ? snapshot.chats : [];
    const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : ((typeof getUserProfile === 'function') ? getUserProfile() : {});
    const userName = getWechatAiPhoneUserDisplayName(char, userProfile);
    const charName = getWechatCharDisplayName(char);
    const contact = chats[index] || chats[0] || {
        name: userName,
        text: '还没有新的聊天',
        time: ''
    };
    const history = Array.isArray(char && char.history) ? char.history : [];
    let rows = [];

    if (index === 0) {
        rows = history
            .filter(msg => msg && msg.type !== 'system_notice')
            .slice(-22)
            .map(msg => ({
                isCharSide: !msg.isMe,
                text: getWechatAiPhoneMessageText(msg),
                time: formatMessageTime(msg),
                type: msg.type || 'text',
                msg
            }))
            .filter(item => item.text || item.type === 'music_card');
    }

    if (!rows.length) {
        rows = [
            { isCharSide: false, text: contact.text || '这条聊天还停在预览里。', time: contact.time || '', type: 'text' },
            { isCharSide: true, text: index === 0 ? '我看到了。' : '先放在这里，晚点再回。', time: '', type: 'text' }
        ];
    }

    return rows.map(item => {
        const sideClass = item.isCharSide ? 'is-self' : 'is-other';
        const avatarName = item.isCharSide ? charName : (index === 0 ? userName : contact.name);
        const avatarSrc = item.isCharSide ? (char.avatar || DEFAULT_AVATAR) : (index === 0 ? (userProfile.avatar || DEFAULT_AVATAR) : DEFAULT_AVATAR);
        const avatarHtml = getWechatAiPhoneAvatarHtml(avatarSrc, avatarName, item.isCharSide ? 'is-char' : 'is-contact');
        const hasSticker = !!resolveWechatAiPhoneSticker(item, char);
        const bubbleClass = [
            'wc-ai-phone-msg-bubble',
            item.type === 'voice' ? 'is-voice' : '',
            item.type === 'music_card' ? 'is-music-card' : '',
            hasSticker ? 'is-sticker' : ''
        ].filter(Boolean).join(' ');
        return `
            <div class="wc-ai-phone-msg ${sideClass}">
                ${item.isCharSide ? '' : avatarHtml}
                <div class="${bubbleClass}">
                    ${renderWechatAiPhoneMessageContent(item)}
                </div>
                ${item.isCharSide ? avatarHtml : ''}
            </div>
        `;
    }).join('');
}

function renderWechatAiPhoneIosRows(items, emptyText = '暂无记录', icon = 'ri-circle-fill') {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return `<div class="wc-ai-phone-empty">${wcEscapeHtml(emptyText)}</div>`;
    return `
        <div class="wc-ai-phone-ios-list">
            ${list.map((item, index) => {
                const row = typeof item === 'object'
                    ? item
                    : normalizeWechatAiPhoneRecordList([item], [], 1)[0];
                const text = typeof item === 'string' ? item : (item.text || item.title || '');
                const title = stripWechatPromptText(row && row.title || text, 34) || `记录 ${index + 1}`;
                const detail = stripWechatPromptText(row && row.detail || (typeof item === 'string' ? text : ''), 92);
                const meta = stripWechatPromptText(row && row.meta || '', 20);
                return `
                    <button type="button" class="wc-ai-phone-ios-row">
                        <i class="${icon}"></i>
                        <span><strong>${wcEscapeHtml(title)}</strong><em>${wcEscapeHtml(detail || title)}</em></span>
                        ${meta ? `<small>${wcEscapeHtml(meta)}</small>` : '<b class="ri-arrow-right-s-line"></b>'}
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

function getWechatAiPhoneMemoItems(snapshot) {
    const raw = Array.isArray(snapshot && snapshot.memos) ? snapshot.memos : [];
    return raw.map((item, index) => {
        if (item && typeof item === 'object') {
            const content = stripWechatPromptText(item.content || item.detail || item.note || item.text || item.title || '', 620);
            const title = stripWechatPromptText(item.title || item.name || content, 26) || `备忘录 ${index + 1}`;
            const detail = stripWechatPromptText(item.detail || item.summary || item.note || content, 72);
            const meta = stripWechatPromptText(item.meta || item.time || item.updatedAt || '', 18) || '今天';
            return { title, detail: detail && detail !== title ? detail : content, meta, content: content || detail || title };
        }
        const content = stripWechatPromptText(item, 620);
        if (!content) return null;
        const title = stripWechatPromptText(content.split(/[。.!！?？\n]/).find(Boolean) || content, 26) || `备忘录 ${index + 1}`;
        return { title, detail: stripWechatPromptText(content, 72), meta: '今天', content };
    }).filter(Boolean).slice(0, 10);
}

function renderWechatAiPhoneMemoRows(items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return `<div class="wc-ai-phone-empty">没有备忘录</div>`;
    return `
        <div class="wc-ai-phone-ios-list">
            ${list.map((item, index) => `
                <button type="button" class="wc-ai-phone-ios-row" onclick="openWechatAiPhoneMemoItem(${index})">
                    <i class="ri-sticky-note-fill"></i>
                    <span><strong>${wcEscapeHtml(item.title || `备忘录 ${index + 1}`)}</strong><em>${wcEscapeHtml(item.detail || item.content || item.title || '')}</em></span>
                    <small>${wcEscapeHtml(item.meta || '今天')}</small>
                </button>
            `).join('')}
        </div>
    `;
}

function renderWechatAiPhoneMemoDetail(item) {
    return `
        <div class="wc-ai-phone-note-detail">
            <button type="button" class="wc-ai-phone-detail-back" onclick="closeWechatAiPhoneMemoItem()"><i class="ri-arrow-left-s-line"></i>备忘录</button>
            <article class="wc-ai-phone-note-paper">
                <time>${wcEscapeHtml(item.meta || '今天')}</time>
                <h3>${wcEscapeHtml(item.title || '备忘录')}</h3>
                <p>${wcEscapeHtml(item.content || item.detail || item.title || '')}</p>
            </article>
        </div>
    `;
}

function renderWechatAiPhoneBrowserListRows(items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return `<div class="wc-ai-phone-empty">没有浏览记录</div>`;
    return `
        <div class="wc-ai-phone-ios-list">
            ${list.map((item, index) => `
                <button type="button" class="wc-ai-phone-ios-row" onclick="openWechatAiPhoneBrowserItem(${index})">
                    <i class="ri-compass-3-fill"></i>
                    <span><strong>${wcEscapeHtml(item.title || `网页 ${index + 1}`)}</strong><em>${wcEscapeHtml(item.detail || item.url || item.title || '')}</em></span>
                    ${item.meta ? `<small>${wcEscapeHtml(item.meta)}</small>` : '<b class="ri-arrow-right-s-line"></b>'}
                </button>
            `).join('')}
        </div>
    `;
}

function renderWechatAiPhoneBrowserDetail(item) {
    const title = stripWechatPromptText(item && item.title, 42) || 'Safari';
    const detail = stripWechatPromptText((item && (item.detail || item.url || item.summary)) || '', 180);
    const host = detail && /^[a-z0-9.-]+\.[a-z]{2,}/i.test(detail) ? detail : 'reader.safari';
    return `
        <div class="wc-ai-phone-safari-reader">
            <div class="wc-ai-phone-safari-toolbar"><i class="ri-lock-2-fill"></i><span>${wcEscapeHtml(host)}</span><i class="ri-reload-line"></i></div>
            <button type="button" class="wc-ai-phone-detail-back" onclick="closeWechatAiPhoneBrowserItem()"><i class="ri-arrow-left-s-line"></i>最近浏览</button>
            <article class="wc-ai-phone-safari-article">
                <span>${wcEscapeHtml(item && item.meta || '最近')}</span>
                <h3>${wcEscapeHtml(title)}</h3>
                ${detail ? `<p>${wcEscapeHtml(detail)}</p>` : ''}
                <div><i class="ri-book-open-line"></i><em>阅读器视图</em></div>
            </article>
        </div>
    `;
}

function renderWechatAiPhoneScheduleRows(items) {
    const list = normalizeWechatAiPhoneScheduleRows(items);
    if (!list.length) return `<div class="wc-ai-phone-empty">没有行程记录</div>`;
    return `
        <div class="wc-ai-phone-schedule-list">
            ${list.map(row => `
                <button type="button" class="wc-ai-phone-schedule-row">
                    <span class="wc-ai-phone-schedule-time">${wcEscapeHtml(row.time || '--:--')}</span>
                    <span class="wc-ai-phone-schedule-main">
                        <strong>${wcEscapeHtml(row.title || '日历提醒')}</strong>
                        <em>${wcEscapeHtml(row.meta || '今天')}</em>
                    </span>
                    <i class="ri-calendar-event-fill"></i>
                </button>
            `).join('')}
        </div>
    `;
}

function renderWechatAiPhoneAppScreen(activeTab, snapshot, char, isLoading) {
    const clock = getWechatAiPhoneClockParts();
    const charName = getWechatCharDisplayName(char);
    if (activeTab === 'chat') {
        return `
            <div class="wc-ai-phone-app-title"><strong>信息</strong><span>${isLoading ? '正在同步聊天记录' : `iMessage · ${wcEscapeHtml(charName)}`}</span></div>
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
                <div class="wc-ai-phone-compose">
                    <i class="ri-add-circle-line"></i>
                    <span>iMessage</span>
                    <i class="ri-mic-fill"></i>
                </div>
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
        const walletSummary = getWechatAiPhoneWalletSummary(snapshot, char);
        const walletRows = getWechatAiPhoneWalletRows(snapshot, char);
        return `
            <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>钱包</strong><span>卡片与零钱</span></div>
            <div class="wc-ai-phone-wallet-pass">
                <span>BYND Wallet</span>
                <strong>${wcEscapeHtml(charName)}</strong>
                <p>${wcEscapeHtml(walletSummary)}</p>
            </div>
            ${renderWechatAiPhoneIosRows(walletRows, '没有钱包记录', 'ri-bank-card-line')}
        `;
    }
    if (activeTab === 'diary') {
        return renderWechatAiPhoneDiaryMailbox(snapshot, char);
    }
    if (activeTab === 'footprints') {
        const places = getWechatAiPhoneFootprintRows(snapshot, char);
        return `
            <div class="wc-ai-phone-app-title wc-ai-phone-app-title-compact"><strong>重要地点</strong><span>足迹 · 到过的位置</span></div>
            <div class="wc-ai-phone-map-preview">
                <div class="wc-ai-phone-map-route"><b></b><b></b><b></b><b></b></div>
                <i class="ri-route-line"></i>
                <span>${wcEscapeHtml(places[0] ? places[0].title : `${charName} 的常去地点`)}</span>
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
        const alarms = getWechatAiPhoneAlarmRows(char);
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
    return '';
}

function renderWechatAiPhoneHome(snapshot, char, isLoading) {
    const clock = getWechatAiPhoneClockParts();
    const apps = getWechatAiPhoneApps(char, snapshot);
    const dockApps = apps.filter(app => ['chat', 'browser', 'wallet', 'diary'].includes(app.key));
    const gridApps = apps.filter(app => !['chat', 'browser', 'wallet', 'diary'].includes(app.key));
    const latestChat = Array.isArray(snapshot.chats) && snapshot.chats.length ? snapshot.chats[0] : null;
    return `
        <div class="wc-ai-phone-home">
            <div class="wc-ai-phone-home-top">
                <button type="button" class="wc-ai-phone-close" onclick="closeWechatAiPhone()"><i class="ri-close-line"></i></button>
                <div class="wc-ai-phone-sync">${isLoading ? '正在同步' : `同步于 ${formatWechatSnapshotTime(snapshot.updatedAt)}`}</div>
            </div>
            <section class="wc-ai-phone-clock-widget" onclick="switchWechatAiPhoneTab('clock')">
                <span>${wcEscapeHtml(clock.date)}</span>
                <strong>${wcEscapeHtml(clock.time)}</strong>
                <p>${wcEscapeHtml(getWechatCharDisplayName(char))} 的手机</p>
            </section>
            <section class="wc-ai-phone-widget-stack" onclick="switchWechatAiPhoneTab('chat')">
                <div><i class="ri-wechat-fill"></i><span>微信</span></div>
                <strong>${wcEscapeHtml(latestChat ? latestChat.name : '聊天记录')}</strong>
                <p>${wcEscapeHtml(latestChat ? latestChat.text : '还没有新的聊天')}</p>
            </section>
            <div class="wc-ai-phone-grid">
                ${gridApps.map(renderWechatAiPhoneAppButton).join('')}
            </div>
            <div class="wc-ai-phone-dock">
                ${dockApps.map(renderWechatAiPhoneAppButton).join('')}
            </div>
        </div>
    `;
}

function renderWechatAiPhone(char) {
    const modal = document.getElementById('wc-ai-phone-overlay');
    if (!modal || !char) return;
    const snapshot = (char.chatConfig && char.chatConfig.aiPhoneSnapshot && char.chatConfig.aiPhoneSnapshot.generatedBy === 'api')
        ? char.chatConfig.aiPhoneSnapshot
        : buildWechatAiPhoneFallback(char);
    const isLoading = !!(window._wechatAiPhoneGenerating && window._wechatAiPhoneGenerating.has(char.id));
    const activeTab = window._wechatAiPhoneTab || 'home';
    const clock = getWechatAiPhoneClockParts();
    const meta = getWechatAiPhoneAppMeta(activeTab === 'wechatChat' ? 'chat' : activeTab, char, snapshot);
    const isHome = activeTab === 'home';
    const backTarget = activeTab === 'wechatChat' ? 'chat' : 'home';
    const backLabel = activeTab === 'wechatChat' ? '微信' : '桌面';
    modal.innerHTML = `
        <div class="wc-ai-phone wc-ai-phone-ios ${isHome ? 'is-home' : 'is-app'}">
            <div class="wc-ai-phone-status">
                <span>${wcEscapeHtml(clock.time)}</span>
                <b></b>
                <span><i class="ri-signal-wifi-fill"></i><i class="ri-battery-2-charge-fill"></i></span>
            </div>
            <div class="wc-ai-phone-wallpaper">
                ${isHome ? renderWechatAiPhoneHome(snapshot, char, isLoading) : `
                    <div class="wc-ai-phone-app-page tone-${meta.tone}">
                        <div class="wc-ai-phone-app-nav">
                            <button type="button" onclick="switchWechatAiPhoneTab('${backTarget}')"><i class="ri-arrow-left-s-line"></i><span>${wcEscapeHtml(backLabel)}</span></button>
                            <strong><i class="${meta.icon}"></i>${wcEscapeHtml(activeTab === 'wechatChat' ? '信息' : meta.label)}</strong>
                            <button type="button" onclick="closeWechatAiPhone()"><i class="ri-close-line"></i></button>
                        </div>
                        <div class="wc-ai-phone-app-body">
                            ${renderWechatAiPhoneAppScreen(activeTab, snapshot, char, isLoading)}
                        </div>
                    </div>
                `}
            </div>
            <div class="wc-ai-phone-home-indicator"></div>
        </div>
    `;
}

function switchWechatAiPhoneTab(tabName) {
    const validTabs = ['home', 'chat', 'wechatChat', 'memo', 'browser', 'wallet', 'diary', 'footprints', 'usage', 'clock', 'schedule', 'shopping', 'takeout', 'games'];
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

function closeWechatAiPhone() {
    const modal = document.getElementById('wc-ai-phone-overlay');
    if (modal) modal.remove();
    window._wechatAiPhoneOpenCharId = '';
    window._wechatAiPhoneTab = 'home';
    window._wechatAiPhoneChatIndex = 0;
    window._wechatAiPhoneMemoIndex = -1;
    window._wechatAiPhoneBrowserIndex = -1;
}

// ========== 微信记忆系统 ==========

function normalizeWechatMemoryStore(store) {
    const safe = (store && typeof store === 'object') ? store : {};
    const normalizeList = (list, tier, charId) => Array.isArray(list) ? list
        .filter(item => item && typeof item === 'object')
        .map(item => ({
            id: item.id || ('mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
            tier,
            charId: item.charId || charId || '',
            category: String(item.category || item.type || item.memoryType || '').trim(),
            topic: String(item.topic || '').trim(),
            title: String(item.title || '').trim(),
            content: String(item.content || '').trim(),
            confidence: Math.min(1, Math.max(0, Number(item.confidence || 0.72))),
            auto: !!item.auto,
            enabled: item.enabled !== false,
            sourceCount: Math.max(1, Number(item.sourceCount || 1)),
            sourceStart: Number.isFinite(Number(item.sourceStart)) ? Number(item.sourceStart) : null,
            sourceEnd: Number.isFinite(Number(item.sourceEnd)) ? Number(item.sourceEnd) : null,
            createdAt: item.createdAt || Date.now(),
            updatedAt: item.updatedAt || item.createdAt || Date.now()
        }))
        .filter(item => item.content)
        : [];

    const normalizeMeta = meta => {
        const source = (meta && typeof meta === 'object') ? meta : {};
        return {
            lastExtractedIndex: Math.max(0, Number(source.lastExtractedIndex || 0)),
            lastExtractedAt: Math.max(0, Number(source.lastExtractedAt || 0)),
            extractionBusy: false,
            extractionError: String(source.extractionError || '').slice(0, 180)
        };
    };

    const normalizeBucket = (bucket, charId) => {
        if (Array.isArray(bucket)) {
            return {
                segments: normalizeList(bucket, 'segment', charId),
                longTerm: [],
                compressed: [],
                meta: normalizeMeta(null)
            };
        }
        return {
            segments: normalizeList(bucket && (bucket.segments || bucket.segment), 'segment', charId),
            longTerm: normalizeList(bucket && (bucket.longTerm || bucket.long || bucket.longterm), 'long', charId),
            compressed: normalizeList(bucket && (bucket.compressed || bucket.compress), 'compressed', charId),
            meta: normalizeMeta(bucket && bucket.meta)
        };
    };

    const chars = {};
    Object.keys(safe.chars || {}).forEach(charId => {
        chars[charId] = normalizeBucket(safe.chars[charId], charId);
    });
    return {
        chars
    };
}

function getWechatMemoryStore() {
    try {
        return normalizeWechatMemoryStore(JSON.parse(localStorage.getItem(WECHAT_MEMORY_STORAGE_KEY) || '{}'));
    } catch (e) {
        return normalizeWechatMemoryStore({});
    }
}

function saveWechatMemoryStore(store) {
    localStorage.setItem(WECHAT_MEMORY_STORAGE_KEY, JSON.stringify(normalizeWechatMemoryStore(store)));
}

function getWechatMemoryBucket(store, charId) {
    if (!store.chars[charId]) {
        store.chars[charId] = {
            segments: [],
            longTerm: [],
            compressed: [],
            meta: { lastExtractedIndex: 0, lastExtractedAt: 0, extractionBusy: false, extractionError: '' }
        };
    }
    store.chars[charId].meta = store.chars[charId].meta || { lastExtractedIndex: 0, lastExtractedAt: 0, extractionBusy: false, extractionError: '' };
    return store.chars[charId];
}

function addWechatAutoMemory(char, content, title = '角色主动记忆') {
    if (!char || !char.id) return false;
    const text = String(content || '').trim();
    if (!text) return false;
    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const now = Date.now();
    bucket.segments.push({
        id: 'mem_auto_' + now + '_' + Math.random().toString(36).slice(2, 7),
        tier: 'segment',
        charId: char.id,
        category: 'relationship',
        topic: String(title || '角色主动记忆').slice(0, 32),
        title: String(title || '角色主动记忆').slice(0, 32),
        content: text.slice(0, 900),
        confidence: 0.9,
        auto: true,
        enabled: true,
        sourceCount: 1,
        sourceStart: null,
        sourceEnd: Array.isArray(char.history) ? char.history.length : null,
        createdAt: now,
        updatedAt: now
    });
    promoteWechatMemoryBucket(bucket, char);
    saveWechatMemoryStore(store);
    return true;
}

function getWechatMemoryListForTier(store, tier, charId) {
    const bucket = getWechatMemoryBucket(store, charId);
    if (tier === 'compressed') return bucket.compressed;
    if (tier === 'long') return bucket.longTerm;
    return bucket.segments;
}

function normalizeWechatMemoryNumber(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

function getWechatMemoryConfig(charOrId) {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    const config = (char && char.chatConfig) || {};
    const segmentLimit = normalizeWechatMemoryNumber(config.memorySegmentLimit, WECHAT_MEMORY_DEFAULTS.segmentLimit, 3, 50);
    const longTermLimit = normalizeWechatMemoryNumber(config.memoryLongTermLimit, WECHAT_MEMORY_DEFAULTS.longTermLimit, 3, 50);
    const keepRecent = Math.min(
        segmentLimit,
        normalizeWechatMemoryNumber(config.memoryKeepRecent, WECHAT_MEMORY_DEFAULTS.keepRecent, 1, Math.max(1, segmentLimit))
    );
    const extractEvery = normalizeWechatMemoryNumber(config.memoryExtractEvery, WECHAT_MEMORY_DEFAULTS.extractEvery, 2, 30);
    return {
        segmentLimit,
        longTermLimit,
        keepRecent,
        extractEvery
    };
}

function getWechatMemoryTierLabel(tier) {
    if (tier === 'compressed') return '压缩记忆';
    if (tier === 'long') return '长期记忆';
    return '分段记忆';
}

function findWechatMemoryEntry(store, id) {
    for (const charId of Object.keys(store.chars || {})) {
        const bucket = getWechatMemoryBucket(store, charId);
        for (const tier of ['segments', 'longTerm', 'compressed']) {
            const list = bucket[tier] || [];
            const index = list.findIndex(item => item.id === id);
            if (index >= 0) return { list, index, item: list[index] };
        }
    }
    return null;
}

function buildWechatMemoryDigest(items, label) {
    const lines = items
        .filter(item => item && item.content)
        .map(item => {
            const title = item.title ? `${item.title}：` : '';
            const category = item.category ? `【${item.category}】` : '';
            return `${category}${title}${item.content}`;
        });
    const text = lines.join('；');
    return text.length > 900 ? `${text.slice(0, 900)}...` : text;
}

function promoteWechatMemoryBucket(bucket, charOrId) {
    const memoryConfig = getWechatMemoryConfig(charOrId);
    const now = Date.now();
    if (bucket.segments.length > memoryConfig.segmentLimit) {
        const moveCount = Math.max(1, bucket.segments.length - memoryConfig.keepRecent);
        const moved = bucket.segments.splice(0, moveCount);
        bucket.longTerm.push({
            id: 'mem_long_' + now + '_' + Math.random().toString(36).slice(2, 7),
            tier: 'long',
            title: `阶段整理 ${new Date(now).toLocaleDateString()}`,
            content: buildWechatMemoryDigest(moved, '分段记忆'),
            enabled: true,
            sourceCount: moved.reduce((sum, item) => sum + Number(item.sourceCount || 1), 0),
            createdAt: now,
            updatedAt: now
        });
    }

    if (bucket.longTerm.length > memoryConfig.longTermLimit) {
        const keepLongTerm = Math.min(memoryConfig.keepRecent, memoryConfig.longTermLimit);
        const moveCount = Math.max(1, bucket.longTerm.length - keepLongTerm);
        const moved = bucket.longTerm.splice(0, moveCount);
        bucket.compressed.push({
            id: 'mem_zip_' + now + '_' + Math.random().toString(36).slice(2, 7),
            tier: 'compressed',
            title: `压缩记忆 ${new Date(now).toLocaleDateString()}`,
            content: buildWechatMemoryDigest(moved, '长期记忆'),
            enabled: true,
            sourceCount: moved.reduce((sum, item) => sum + Number(item.sourceCount || 1), 0),
            createdAt: now,
            updatedAt: now
        });
    }
}

function getWechatActiveMemories(char) {
    const store = getWechatMemoryStore();
    const charId = char && char.id;
    if (!charId) return { segments: [], longTerm: [], compressed: [] };
    const bucket = getWechatMemoryBucket(store, charId);
    const memoryConfig = getWechatMemoryConfig(char);
    const recallQuery = buildWechatMemoryRecallQuery(char);
    const pickRelevant = (list, limit, alwaysRecent = 2) => {
        const enabled = list.filter(item => item && item.enabled);
        const recent = enabled.slice(-alwaysRecent);
        const recentIds = new Set(recent.map(item => item.id));
        const scored = enabled
            .filter(item => !recentIds.has(item.id))
            .map(item => ({ item, score: scoreWechatMemoryRelevance(item, recallQuery) }))
            .filter(pair => pair.score > 0)
            .sort((a, b) => b.score - a.score || (b.item.updatedAt || 0) - (a.item.updatedAt || 0))
            .slice(0, Math.max(0, limit - recent.length))
            .map(pair => pair.item);
        return [...scored, ...recent].slice(-limit);
    };
    return {
        segments: pickRelevant(bucket.segments, memoryConfig.segmentLimit, Math.min(3, memoryConfig.keepRecent)),
        longTerm: pickRelevant(bucket.longTerm, memoryConfig.longTermLimit, Math.min(2, memoryConfig.keepRecent)),
        compressed: bucket.compressed.filter(item => item.enabled).slice(-6)
    };
}

function buildWechatMemoryPrompt(char) {
    const memories = getWechatActiveMemories(char);
    const sections = [];
    const renderLines = list => list.map(item => {
        const title = item.title ? `${item.title}：` : '';
        const meta = [item.category, item.topic].filter(Boolean).join('/');
        return `- ${meta ? `【${meta}】` : ''}${title}${item.content}`;
    }).join('\n');
    if (memories.compressed.length) sections.push(`【压缩记忆】\n${renderLines(memories.compressed)}`);
    if (memories.longTerm.length) sections.push(`【长期记忆】\n${renderLines(memories.longTerm)}`);
    if (memories.segments.length) sections.push(`【近期分段记忆】\n${renderLines(memories.segments)}`);
    if (!sections.length) return '';
    return `【当前聊天对象记忆】\n这些记忆只属于当前 AI 角色和用户的关系。压缩记忆是关系底色，长期记忆是稳定事实/偏好，近期分段记忆是新鲜但可能需要继续校准的信息。回复时自然遵守，不要主动解释记忆系统；如果记忆和最新聊天冲突，以最新聊天为准，并可用 [微信记忆:...] 主动更新。\n${sections.join('\n')}`;
}

function getWechatMemoryCategoryLabel(category) {
    const key = String(category || '').trim();
    const labels = {
        relationship: '关系',
        preference: '偏好',
        fact: '事实',
        boundary: '边界',
        plot: '剧情',
        task: '待办',
        correction: '修正'
    };
    return labels[key] || key || '记忆';
}

function buildWechatMemoryRecallQuery(char) {
    const profile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : {};
    const history = Array.isArray(char && char.history) ? char.history : [];
    const lines = history.slice(-12).map(msg => getWechatMessagePromptContent(msg)).filter(Boolean);
    return [
        (char && char.name) || '',
        (char && char.chatConfig && char.chatConfig.nickname) || '',
        profile.name || '',
        profile.bio || '',
        profile.signature || '',
        ...lines
    ].join('\n');
}

function getWechatMemoryRecallTokens(value) {
    const compact = String(value || '')
        .toLowerCase()
        .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, ' ')
        .trim();
    if (!compact) return [];
    const tokens = compact.split(/\s+/).filter(item => item.length >= 2 && item.length <= 28);
    const dense = compact.replace(/\s+/g, '');
    for (let i = 0; i < dense.length - 1 && tokens.length < 120; i += 2) {
        const token = dense.slice(i, i + 2);
        if (token && token.length === 2) tokens.push(token);
    }
    return Array.from(new Set(tokens)).slice(0, 120);
}

function scoreWechatMemoryRelevance(item, query) {
    if (!item || !query) return 0;
    const haystack = `${item.category || ''} ${item.topic || ''} ${item.title || ''} ${item.content || ''}`.toLowerCase();
    const tokens = getWechatMemoryRecallTokens(query);
    let score = 0;
    tokens.forEach(token => {
        if (!token) return;
        if (haystack.includes(token)) score += token.length > 2 ? 3 : 1;
    });
    const ageHours = Math.max(0, (Date.now() - Number(item.updatedAt || item.createdAt || 0)) / 3600000);
    if (ageHours < 24) score += 3;
    if (item.category === 'relationship' || item.category === 'boundary') score += 2;
    return score;
}

function buildWechatMemoryExtractionTranscript(char, startIndex, maxCount = 18) {
    const history = Array.isArray(char && char.history) ? char.history : [];
    const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : {};
    const userName = userProfile.name || '用户';
    const charName = getWechatCharDisplayName(char);
    const rows = [];
    for (let i = Math.max(0, startIndex); i < history.length && rows.length < maxCount; i += 1) {
        const msg = history[i];
        if (!msg || msg.type === 'system_notice' || msg.monitorEvent) continue;
        const content = stripWechatPromptText(getWechatMessagePromptContent(msg), 360);
        if (!content) continue;
        rows.push({
            index: i,
            role: msg.isMe ? 'user' : 'char',
            line: `#${i + 1} ${msg.isMe ? userName : charName}: ${content}`
        });
    }
    return rows;
}

function buildWechatMemoryExistingManifest(bucket) {
    const all = [
        ...(bucket.compressed || []).slice(-6),
        ...(bucket.longTerm || []).slice(-12),
        ...(bucket.segments || []).slice(-18)
    ].filter(item => item && item.content);
    if (!all.length) return '暂无已有记忆。';
    return all.map(item => {
        const tier = getWechatMemoryTierLabel(item.tier || 'segment');
        const category = getWechatMemoryCategoryLabel(item.category);
        const title = item.title || item.topic || '未命名';
        return `- ${tier}/${category}/${title}：${stripWechatPromptText(item.content, 160)}`;
    }).join('\n');
}

function parseWechatMemoryExtractionJson(text) {
    const raw = parseWechatJsonObject(text);
    const list = Array.isArray(raw) ? raw : (Array.isArray(raw && raw.memories) ? raw.memories : []);
    const validCategories = new Set(['relationship', 'preference', 'fact', 'boundary', 'plot', 'task', 'correction']);
    return list.map(item => {
        if (!item || typeof item !== 'object') return null;
        const content = stripWechatPromptText(item.content || item.memory || item.note || '', 900);
        if (content.length < 4) return null;
        const category = String(item.category || item.type || 'relationship').trim();
        const title = stripWechatPromptText(item.title || item.topic || content.slice(0, 18), 36);
        return {
            category: validCategories.has(category) ? category : 'relationship',
            topic: stripWechatPromptText(item.topic || title, 36),
            title,
            content,
            confidence: Math.min(1, Math.max(0.35, Number(item.confidence || 0.72)))
        };
    }).filter(Boolean).slice(0, 6);
}

function getWechatMemoryDuplicateScore(existing, candidate) {
    const a = `${existing.topic || ''} ${existing.title || ''} ${existing.content || ''}`.toLowerCase();
    const b = `${candidate.topic || ''} ${candidate.title || ''} ${candidate.content || ''}`.toLowerCase();
    if (!a || !b) return 0;
    if ((existing.topic && candidate.topic && existing.topic === candidate.topic) || (existing.title && candidate.title && existing.title === candidate.title)) return 100;
    if (a.includes(candidate.content.toLowerCase()) || b.includes(String(existing.content || '').toLowerCase())) return 90;
    const tokens = getWechatMemoryRecallTokens(b).slice(0, 80);
    if (!tokens.length) return 0;
    const hits = tokens.filter(token => a.includes(token)).length;
    return hits / tokens.length * 100;
}

function mergeWechatMemoryContent(oldContent, newContent) {
    const oldText = String(oldContent || '').trim();
    const newText = String(newContent || '').trim();
    if (!oldText) return newText.slice(0, 900);
    if (!newText || oldText.includes(newText)) return oldText;
    if (newText.includes(oldText)) return newText.slice(0, 900);
    return `${oldText}；${newText}`.slice(0, 900);
}

function upsertWechatExtractedMemory(bucket, candidate, char, sourceStart, sourceEnd) {
    const now = Date.now();
    const searchable = [...(bucket.segments || []), ...(bucket.longTerm || [])];
    let duplicate = null;
    let duplicateScore = 0;
    searchable.forEach(item => {
        const score = getWechatMemoryDuplicateScore(item, candidate);
        if (score > duplicateScore) {
            duplicate = item;
            duplicateScore = score;
        }
    });
    if (duplicate && duplicateScore >= 62) {
        duplicate.category = candidate.category || duplicate.category;
        duplicate.topic = candidate.topic || duplicate.topic || candidate.title;
        duplicate.title = candidate.title || duplicate.title || candidate.topic;
        duplicate.content = mergeWechatMemoryContent(duplicate.content, candidate.content);
        duplicate.confidence = Math.max(Number(duplicate.confidence || 0), Number(candidate.confidence || 0.72));
        duplicate.sourceCount = Math.max(1, Number(duplicate.sourceCount || 1)) + 1;
        duplicate.sourceStart = duplicate.sourceStart == null ? sourceStart : Math.min(duplicate.sourceStart, sourceStart);
        duplicate.sourceEnd = duplicate.sourceEnd == null ? sourceEnd : Math.max(duplicate.sourceEnd, sourceEnd);
        duplicate.updatedAt = now;
        duplicate.auto = true;
        return duplicate;
    }
    const item = {
        id: 'mem_ext_' + now + '_' + Math.random().toString(36).slice(2, 7),
        tier: 'segment',
        charId: char.id,
        category: candidate.category || 'relationship',
        topic: candidate.topic || candidate.title || '自动整理',
        title: candidate.title || candidate.topic || '自动整理',
        content: candidate.content.slice(0, 900),
        confidence: Number(candidate.confidence || 0.72),
        auto: true,
        enabled: true,
        sourceCount: 1,
        sourceStart,
        sourceEnd,
        createdAt: now,
        updatedAt: now
    };
    bucket.segments.push(item);
    return item;
}

function getWechatExtractableMessageCount(history, startIndex) {
    return history.slice(Math.max(0, startIndex)).filter(msg => msg && msg.type !== 'system_notice' && !msg.monitorEvent).length;
}

function scheduleWechatMemoryExtraction(char, reason = 'after_reply') {
    if (!char || !char.id || typeof callChatApi !== 'function') return;
    const history = Array.isArray(char.history) ? char.history : [];
    if (!history.length) return;
    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const config = getWechatMemoryConfig(char);
    const cursor = Math.min(history.length, Math.max(0, Number(bucket.meta?.lastExtractedIndex || 0)));
    if (getWechatExtractableMessageCount(history, cursor) < config.extractEvery) return;
    window._wechatMemoryExtractionTimers = window._wechatMemoryExtractionTimers || new Map();
    const oldTimer = window._wechatMemoryExtractionTimers.get(char.id);
    if (oldTimer) clearTimeout(oldTimer);
    const timer = setTimeout(() => {
        window._wechatMemoryExtractionTimers.delete(char.id);
        requestWechatMemoryExtraction(char.id, reason).catch(e => console.warn('wechat memory extraction failed:', e));
    }, 700);
    window._wechatMemoryExtractionTimers.set(char.id, timer);
}

async function requestWechatMemoryExtraction(charOrId, reason = 'manual') {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    if (!char || !char.id || typeof callChatApi !== 'function') return null;
    window._wechatMemoryExtractionBusy = window._wechatMemoryExtractionBusy || new Set();
    if (window._wechatMemoryExtractionBusy.has(char.id)) return null;
    const history = Array.isArray(char.history) ? char.history : [];
    if (!history.length) return null;

    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const config = getWechatMemoryConfig(char);
    let startIndex = Math.min(history.length, Math.max(0, Number(bucket.meta?.lastExtractedIndex || 0)));
    const maxWindow = Math.max(12, config.extractEvery * 4);
    if (startIndex === 0 && history.length > maxWindow) startIndex = history.length - maxWindow;
    const transcriptRows = buildWechatMemoryExtractionTranscript(char, startIndex, maxWindow);
    if (transcriptRows.length < config.extractEvery && reason !== 'manual') return null;
    if (!transcriptRows.length) return null;

    window._wechatMemoryExtractionBusy.add(char.id);
    try {
        const userProfile = (typeof getWechatChatUserProfile === 'function') ? getWechatChatUserProfile(char) : {};
        const result = await callChatApi([
            {
                role: 'system',
                content: `你是 BYND 微信记忆整理子代理，参照 Claude Code 的记忆方式：只分析提供的新增聊天片段，抽取值得长期影响后续互动的记忆；按主题组织，先检查已有记忆，避免重复。只返回 JSON，不要 Markdown。格式：{"memories":[{"category":"relationship|preference|fact|boundary|plot|task|correction","topic":"主题","title":"短标题","content":"一条可直接给角色使用的记忆","confidence":0.35到1}]}。保存标准：用户明确要求记住的事、稳定偏好、关系变化、边界/雷点、正在推进的剧情、承诺和待办、对旧记忆的修正。不要保存：普通寒暄、一次性情绪、无意义细节、未确认猜测、隐私敏感内容、模型自己的思考过程。content 必须来自新增聊天片段，不要编造。没有值得记的内容就返回 {"memories":[]}。`
            },
            {
                role: 'user',
                content: `${buildWechatIdentityContextPrompt(char, userProfile)}\n\n【已有记忆清单】\n${buildWechatMemoryExistingManifest(bucket)}\n\n【新增聊天片段】\n${transcriptRows.map(row => row.line).join('\n')}`
            }
        ]);

        const freshStore = getWechatMemoryStore();
        const freshBucket = getWechatMemoryBucket(freshStore, char.id);
        const sourceStart = transcriptRows[0].index;
        const sourceEnd = transcriptRows[transcriptRows.length - 1].index;
        if (result && result.ok) {
            const memories = parseWechatMemoryExtractionJson(result.content);
            memories.forEach(memory => upsertWechatExtractedMemory(freshBucket, memory, char, sourceStart, sourceEnd));
            promoteWechatMemoryBucket(freshBucket, char);
            freshBucket.meta.lastExtractedIndex = history.length;
            freshBucket.meta.lastExtractedAt = Date.now();
            freshBucket.meta.extractionError = '';
            saveWechatMemoryStore(freshStore);
            if (window._wechatMemoryTier && document.getElementById('wc-memory-manager') && !document.getElementById('wc-memory-manager').classList.contains('hidden')) {
                renderWechatMemoryManager();
            }
            return memories;
        }
        freshBucket.meta.extractionError = (result && result.error) || '记忆整理失败';
        saveWechatMemoryStore(freshStore);
        return null;
    } finally {
        window._wechatMemoryExtractionBusy.delete(char.id);
    }
}

function maybeCaptureWechatMemoryCommand(char, text) {
    const match = String(text || '').match(/^\s*(?:记住|记忆|remember)\s*[：:\s]\s*([\s\S]{2,})$/i);
    if (!match || !char) return false;
    const content = match[1].trim();
    if (!content) return false;
    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const list = bucket.segments;
    const now = Date.now();
    list.push({
        id: 'mem_' + now + '_' + Math.random().toString(36).slice(2, 7),
        tier: 'segment',
        charId: char.id,
        title: content.slice(0, 18),
        content,
        enabled: true,
        sourceCount: 1,
        createdAt: now,
        updatedAt: now
    });
    promoteWechatMemoryBucket(bucket, char);
    saveWechatMemoryStore(store);
    return true;
}

function ensureWechatMemoryManager() {
    let modal = document.getElementById('wc-memory-manager');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-memory-manager';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay wc-sticker-submodal';
    modal.style.zIndex = '3800';
    modal.innerHTML = `
        <div class="wc-compose-card wc-memory-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i class="ri-brain-line"></i><span>记忆</span></div>
                <i class="ri-close-line" onclick="closeWechatMemoryManager()"></i>
            </div>
            <div class="wc-compose-body wc-memory-body">
                <div class="wc-compose-segment wc-memory-tabs">
                    <button id="wc-memory-tab-segment" onclick="switchWechatMemoryTier('segment')">分段</button>
                    <button id="wc-memory-tab-long" onclick="switchWechatMemoryTier('long')">长期</button>
                    <button id="wc-memory-tab-compressed" onclick="switchWechatMemoryTier('compressed')">压缩</button>
                </div>
                <div id="wc-memory-stats" class="wc-memory-stats"></div>
                <div class="wc-memory-editor">
                    <input id="wc-memory-title" type="text" maxlength="32" placeholder="标题">
                    <textarea id="wc-memory-content" maxlength="900" placeholder="写入当前聊天对象需要记住的事实、偏好或关系状态"></textarea>
                </div>
                <div id="wc-memory-list" class="wc-memory-list"></div>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="clearWechatMemoryEditor()">清空</button>
                <button class="wc-compose-secondary" onclick="runWechatMemoryExtractionNow(event)">整理最近</button>
                <button class="wc-compose-primary" id="wc-memory-save-btn" onclick="saveWechatMemoryFromEditor()">保存记忆</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function openWechatMemoryManager() {
    const char = getCurrentChatChar();
    if (!char) return;
    closeChatToolbar();
    closeStickerPicker();
    window._wechatMemoryTier = window._wechatMemoryTier || 'segment';
    const modal = ensureWechatMemoryManager();
    modal.dataset.editId = '';
    modal.classList.remove('hidden');
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

function closeWechatMemoryManager() {
    const modal = document.getElementById('wc-memory-manager');
    if (modal) modal.classList.add('hidden');
}

function switchWechatMemoryTier(tier) {
    window._wechatMemoryTier = tier === 'compressed' ? 'compressed' : (tier === 'long' ? 'long' : 'segment');
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

function switchWechatMemoryScope() {
    switchWechatMemoryTier('segment');
}

function clearWechatMemoryEditor(render = true) {
    const modal = document.getElementById('wc-memory-manager');
    if (modal) modal.dataset.editId = '';
    const title = document.getElementById('wc-memory-title');
    const content = document.getElementById('wc-memory-content');
    const saveBtn = document.getElementById('wc-memory-save-btn');
    if (title) title.value = '';
    if (content) content.value = '';
    if (saveBtn) saveBtn.textContent = '保存记忆';
    if (render) renderWechatMemoryManager();
}

function renderWechatMemoryManager() {
    const char = getCurrentChatChar();
    if (!char) return;
    const tier = window._wechatMemoryTier === 'compressed' ? 'compressed' : (window._wechatMemoryTier === 'long' ? 'long' : 'segment');
    document.getElementById('wc-memory-tab-segment')?.classList.toggle('active', tier === 'segment');
    document.getElementById('wc-memory-tab-long')?.classList.toggle('active', tier === 'long');
    document.getElementById('wc-memory-tab-compressed')?.classList.toggle('active', tier === 'compressed');

    const store = getWechatMemoryStore();
    const bucket = getWechatMemoryBucket(store, char.id);
    const list = getWechatMemoryListForTier(store, tier, char.id);
    const memoryConfig = getWechatMemoryConfig(char);
    const listEl = document.getElementById('wc-memory-list');
    if (!listEl) return;
    const statsEl = document.getElementById('wc-memory-stats');
    if (statsEl) {
        statsEl.innerHTML = `
            <span>分段 ${bucket.segments.length}/${memoryConfig.segmentLimit}</span>
            <span>长期 ${bucket.longTerm.length}/${memoryConfig.longTermLimit}</span>
            <span>压缩 ${bucket.compressed.length}</span>
        `;
    }

    if (!list.length) {
        listEl.innerHTML = `<div class="wc-memory-empty">暂无${getWechatMemoryTierLabel(tier)}</div>`;
        return;
    }

    listEl.innerHTML = list.slice().reverse().map(item => `
        <div class="wc-memory-item ${item.enabled ? '' : 'is-off'}">
            <div class="wc-memory-main" onclick="editWechatMemoryEntry('${item.id}')">
                <div class="wc-memory-title">${wcEscapeHtml(item.title || '未命名记忆')}</div>
                <div class="wc-memory-content">${wcEscapeHtml(item.content)}</div>
                <div class="wc-memory-meta">${getWechatMemoryTierLabel(item.tier || tier)} · ${item.sourceCount || 1} 段来源</div>
            </div>
            <div class="wc-memory-actions">
                <button onclick="toggleWechatMemoryEntry('${item.id}')" title="${item.enabled ? '停用' : '启用'}"><i class="${item.enabled ? 'ri-toggle-fill' : 'ri-toggle-line'}"></i></button>
                <button onclick="deleteWechatMemoryEntry('${item.id}')" title="删除"><i class="ri-delete-bin-6-line"></i></button>
            </div>
        </div>
    `).join('');
}

function saveWechatMemoryFromEditor() {
    const char = getCurrentChatChar();
    if (!char) return;
    const modal = document.getElementById('wc-memory-manager');
    const titleEl = document.getElementById('wc-memory-title');
    const contentEl = document.getElementById('wc-memory-content');
    const content = contentEl ? contentEl.value.trim() : '';
    if (!content) {
        contentEl?.focus();
        return;
    }

    const store = getWechatMemoryStore();
    const editId = modal ? modal.dataset.editId : '';
    const now = Date.now();
    if (editId) {
        const found = findWechatMemoryEntry(store, editId);
        if (found) {
            found.item.title = (titleEl?.value || '').trim() || content.slice(0, 18);
            found.item.content = content;
            found.item.updatedAt = now;
        }
    } else {
        const tier = window._wechatMemoryTier === 'compressed' ? 'compressed' : (window._wechatMemoryTier === 'long' ? 'long' : 'segment');
        const bucket = getWechatMemoryBucket(store, char.id);
        const list = getWechatMemoryListForTier(store, tier, char.id);
        list.push({
            id: 'mem_' + now + '_' + Math.random().toString(36).slice(2, 7),
            tier,
            charId: char.id,
            title: (titleEl?.value || '').trim() || content.slice(0, 18),
            content,
            enabled: true,
            sourceCount: 1,
            createdAt: now,
            updatedAt: now
        });
        promoteWechatMemoryBucket(bucket, char);
    }

    saveWechatMemoryStore(store);
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

function editWechatMemoryEntry(id) {
    const store = getWechatMemoryStore();
    const found = findWechatMemoryEntry(store, id);
    if (!found) return;
    const modal = ensureWechatMemoryManager();
    modal.dataset.editId = id;
    const title = document.getElementById('wc-memory-title');
    const content = document.getElementById('wc-memory-content');
    const saveBtn = document.getElementById('wc-memory-save-btn');
    if (title) title.value = found.item.title || '';
    if (content) content.value = found.item.content || '';
    if (saveBtn) saveBtn.textContent = '更新记忆';
    content?.focus();
}

function toggleWechatMemoryEntry(id) {
    const store = getWechatMemoryStore();
    const found = findWechatMemoryEntry(store, id);
    if (!found) return;
    found.item.enabled = !found.item.enabled;
    found.item.updatedAt = Date.now();
    saveWechatMemoryStore(store);
    renderWechatMemoryManager();
}

function deleteWechatMemoryEntry(id) {
    const store = getWechatMemoryStore();
    const found = findWechatMemoryEntry(store, id);
    if (!found) return;
    if (!confirm(`确定删除「${found.item.title || '这条记忆'}」吗？`)) return;
    found.list.splice(found.index, 1);
    saveWechatMemoryStore(store);
    clearWechatMemoryEditor(false);
    renderWechatMemoryManager();
}

async function runWechatMemoryExtractionNow(evt) {
    const char = getCurrentChatChar();
    if (!char) return;
    const btn = evt && evt.currentTarget ? evt.currentTarget : null;
    const oldText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '整理中';
    }
    try {
        const memories = await requestWechatMemoryExtraction(char, 'manual');
        renderWechatMemoryManager();
        if (typeof showWechatToast === 'function') {
            showWechatToast(memories && memories.length ? `整理出 ${memories.length} 条记忆` : '最近没有值得新增的记忆');
        }
    } catch (e) {
        console.warn('manual memory extraction failed:', e);
        if (typeof showWechatToast === 'function') showWechatToast('记忆整理失败');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = oldText || '整理最近';
        }
    }
}

function ensureWechatComposerModal() {
    let modal = document.getElementById('wc-composer-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-composer-modal';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
    modal.innerHTML = `
        <div class="wc-compose-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i id="wc-compose-icon" class="ri-mic-line"></i><span id="wc-compose-title">发送消息</span></div>
                <i class="ri-close-line" onclick="closeWechatComposer()"></i>
            </div>
            <div class="wc-compose-body">
                <div id="wc-compose-fields"></div>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="closeWechatComposer()">取消</button>
                <button class="wc-compose-primary" id="wc-compose-submit" onclick="submitWechatComposer()">发送</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function composeField(type, msg) {
    const value = (key, fallback = '') => wcEscapeHtml(msg && msg[key] != null ? msg[key] : fallback);
    const char = getCurrentChatChar();
    const peerName = wcEscapeHtml((char && ((char.chatConfig && char.chatConfig.nickname) || char.name)) || '对方');
    const peerAvatar = wcEscapeHtml((char && char.avatar) || DEFAULT_AVATAR);
    if (type === 'voice') {
        const transcript = msg?.transcript || '';
        const duration = estimateWechatVoiceDuration(transcript);
        return `
            <div class="wc-voice-estimate">
                <div class="wc-voice-estimate-icon"><i class="ri-mic-fill"></i></div>
                <div>
                    <span>自动估算语音时长</span>
                    <strong id="wc-compose-duration-estimate">${duration}"</strong>
                </div>
            </div>
            <label class="wc-compose-field">
                <span>转文字内容</span>
                <textarea id="wc-compose-transcript" rows="3" placeholder="输入语音转文字内容" oninput="updateWechatVoiceDurationEstimate()">${value('transcript', '')}</textarea>
            </label>
        `;
    }
    if (type === 'transfer') {
        return `
            <div class="wc-transfer-pay">
                <div class="wc-transfer-peer">
                    <img src="${peerAvatar}" alt="">
                    <div>
                        <span>转账给</span>
                        <strong>${peerName}</strong>
                    </div>
                </div>
                <label class="wc-transfer-amount">
                    <span>¥</span>
                    <input id="wc-compose-amount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${value('amount', '')}" placeholder="0.00">
                </label>
                <label class="wc-compose-field">
                    <span>转账说明</span>
                    <input id="wc-compose-note" type="text" value="${value('note', '')}" placeholder="添加说明">
                </label>
                <div class="wc-transfer-method">
                    <span>付款方式</span>
                    <strong>零钱</strong>
                </div>
            </div>
        `;
    }
    if (type === 'redpacket') {
        return `
            <label class="wc-compose-field">
                <span>红包标题</span>
                <input id="wc-compose-title-input" type="text" value="${value('title', '恭喜发财，大吉大利')}" placeholder="恭喜发财，大吉大利">
            </label>
            <label class="wc-compose-field">
                <span>金额</span>
                <input id="wc-compose-amount" type="number" min="0.01" step="0.01" value="${value('amount', '')}" placeholder="可留空">
            </label>
        `;
    }
    if (type === 'poke') {
        return `
            <label class="wc-compose-field">
                <span>拍一拍内容</span>
                <input id="wc-compose-action-content" type="text" maxlength="80" value="${value('content', '你拍了拍对方')}" placeholder="例如：你拍了拍对方的肩膀">
            </label>
            <div class="wc-compose-hint">发送后会保留成一条拍一拍气泡，也会触发轻微提示。</div>
        `;
    }
    if (type === 'screen_shake') {
        return `
            <label class="wc-compose-field">
                <span>震动内容</span>
                <input id="wc-compose-action-content" type="text" maxlength="80" value="${value('content', '你震动了对方的屏幕')}" placeholder="例如：你震了震屏幕提醒对方">
            </label>
            <div class="wc-compose-hint">发送后会保留成一条屏幕震动气泡，并触发震动/晃动效果。</div>
        `;
    }
    if (type === 'music_card') {
        const existing = normalizeWechatMusicDraftTrack(msg?.music || msg || null);
        window._wechatMusicComposeSelected = existing && existing.audioUrl ? existing : null;
        window._wechatMusicComposeResults = existing && existing.audioUrl ? [existing] : [];
        const query = existing ? [existing.title, existing.artist].filter(Boolean).join(' ') : '';
        return `
            <div class="wc-music-compose-search">
                <label class="wc-compose-field">
                    <span>搜索音乐</span>
                    <div class="wc-music-search-row">
                        <input id="wc-compose-music-query" type="search" value="${wcEscapeHtml(query)}" placeholder="输入歌名 / 歌手，例如 周杰伦 晴天" onkeydown="if(event.key==='Enter'){event.preventDefault();searchWechatMusicForComposer();}">
                        <button type="button" onclick="searchWechatMusicForComposer()">搜索</button>
                    </div>
                </label>
                <div id="wc-compose-music-status" class="wc-compose-hint">${existing?.audioUrl ? '已选择：' + wcEscapeHtml(existing.title) : '搜索后选择一首歌再发送。'}</div>
                <div id="wc-compose-music-results" class="wc-music-result-list"></div>
            </div>
        `;
    }
    return `
        <label class="wc-compose-field">
            <span>通话状态</span>
            <select id="wc-compose-status">
                ${['已结束', '已取消', '未接通', '已拒绝'].map(status => `<option value="${status}" ${(msg && msg.status === status) ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
        </label>
        <label class="wc-compose-field">
            <span>通话时长</span>
            <input id="wc-compose-duration" type="number" min="1" max="5999" value="${value('duration', 60)}">
        </label>
    `;
}

function openWechatComposer(type, editIndex) {
    const config = WECHAT_COMPOSER_CONFIG[type];
    const char = getCurrentChatChar();
    if (!config || !char) return;
    closeChatToolbar();
    closeStickerPicker();

    const msg = Number.isInteger(editIndex) ? char.history?.[editIndex] : null;
    const modal = ensureWechatComposerModal();
    modal.dataset.type = type;
    modal.dataset.editIndex = Number.isInteger(editIndex) ? String(editIndex) : '';
    modal.querySelector('.wc-compose-card')?.classList.toggle('wc-transfer-compose-card', type === 'transfer');

    document.getElementById('wc-compose-icon').className = config.icon;
    document.getElementById('wc-compose-title').textContent = Number.isInteger(editIndex) ? `编辑${config.title.replace('发送', '')}` : config.title;
    document.getElementById('wc-compose-submit').textContent = Number.isInteger(editIndex) ? '保存修改' : config.primary;
    document.getElementById('wc-compose-fields').innerHTML = composeField(type, msg);
    modal.classList.remove('hidden');
}

function closeWechatComposer() {
    const modal = document.getElementById('wc-composer-modal');
    if (modal) modal.classList.add('hidden');
}

function buildWechatSpecialMessageFromComposer(type, existingMsg) {
    const msg = {
        type,
        isMe: existingMsg ? existingMsg.isMe : true,
        timestamp: existingMsg?.timestamp || createMessageTimestamp()
    };
    if (type === 'voice') {
        msg.transcript = (document.getElementById('wc-compose-transcript')?.value || '').trim();
        msg.duration = estimateWechatVoiceDuration(msg.transcript);
        msg.content = msg.transcript || `[语音 ${formatWechatDuration(msg.duration)}]`;
    } else if (type === 'transfer') {
        msg.amount = normalizeWechatAmount(document.getElementById('wc-compose-amount')?.value);
        msg.note = (document.getElementById('wc-compose-note')?.value || '').trim();
    } else if (type === 'redpacket') {
        msg.title = (document.getElementById('wc-compose-title-input')?.value || '').trim() || '恭喜发财，大吉大利';
        const amount = (document.getElementById('wc-compose-amount')?.value || '').trim();
        if (amount) msg.amount = normalizeWechatAmount(amount);
        msg.status = existingMsg?.status || '待收取';
    } else if (type === 'poke') {
        msg.content = (document.getElementById('wc-compose-action-content')?.value || '').trim() || '你拍了拍对方';
        msg.note = msg.content;
    } else if (type === 'screen_shake') {
        msg.content = (document.getElementById('wc-compose-action-content')?.value || '').trim() || '你震动了对方的屏幕';
        msg.note = msg.content;
    } else if (type === 'music_card') {
        const selected = window._wechatMusicComposeSelected;
        if (!selected || !selected.audioUrl) return null;
        const selectedSourceUrl = selected.sourceAudioUrl || selected.audioUrl;
        const selectedPlayableUrl = selected.playableUrl || selected.audioUrl;
        const selectedCardUrl = isWechatMusicProxyUrl(selectedSourceUrl) ? selectedSourceUrl : selectedPlayableUrl;
        msg.music = {
            title: selected.title,
            artist: selected.artist || '',
            audioUrl: selectedCardUrl,
            playableUrl: selectedPlayableUrl,
            sourceAudioUrl: selectedSourceUrl,
            url: selected.url || '',
            artwork: selected.artwork || '',
            sourceName: selected.sourceName || '',
            sourceMeta: selected.sourceMeta || ''
        };
        msg.title = selected.title;
        msg.artist = selected.artist || '';
        msg.audioUrl = selectedCardUrl;
        msg.playableUrl = selectedPlayableUrl;
        msg.sourceAudioUrl = selectedSourceUrl;
        msg.url = selected.url || '';
    } else if (type === 'voiceCall' || type === 'videoCall') {
        msg.status = document.getElementById('wc-compose-status')?.value || '已结束';
        msg.duration = normalizeWechatDuration(document.getElementById('wc-compose-duration')?.value, 60);
    }
    return syncWechatMessageDescription(msg);
}

function submitWechatComposer() {
    const modal = document.getElementById('wc-composer-modal');
    const type = modal?.dataset.type;
    const char = getCurrentChatChar();
    if (!modal || !type || !char) return;

    const editIndex = modal.dataset.editIndex === '' ? null : parseInt(modal.dataset.editIndex, 10);
    const existingMsg = Number.isInteger(editIndex) ? char.history?.[editIndex] : null;
    if (type === 'transfer' && parseWechatAmountNumber(document.getElementById('wc-compose-amount')?.value) == null) {
        alert('请输入转账金额');
        return;
    }
    const msg = buildWechatSpecialMessageFromComposer(type, existingMsg);
    if (!msg) {
        if (type === 'music_card') {
            if (typeof showWechatToast === 'function') showWechatToast('先搜索并选择一首可播放的音乐');
        }
        return;
    }
    if (type === 'music_card' && window._wechatMusicComposeSelected?.resolving) {
        if (typeof showWechatToast === 'function') showWechatToast('音乐地址还在解析，等一下再发送');
        return;
    }

    if (existingMsg) {
        char.history[editIndex] = { ...existingMsg, ...msg };
        saveCharactersToStorage();
        refreshChatView(char);
        renderChatList();
    } else {
        appendWechatMessage(msg);
        if (type === 'poke') triggerWechatScreenFeedback('poke');
        if (type === 'screen_shake') triggerWechatScreenFeedback('shake');
    }
    closeWechatComposer();
}

function ensureWechatTextEditModal() {
    let modal = document.getElementById('wc-text-edit-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-text-edit-modal';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
    modal.innerHTML = `
        <div class="wc-compose-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i class="ri-edit-line"></i><span>编辑消息</span></div>
                <i class="ri-close-line" onclick="closeWechatMessageEditor()"></i>
            </div>
            <div class="wc-compose-body">
                <div class="wc-edit-target-pill" id="wc-edit-target-pill"></div>
                <label class="wc-compose-field">
                    <span>消息内容</span>
                    <textarea id="wc-edit-content" rows="7"></textarea>
                </label>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="closeWechatMessageEditor()">取消</button>
                <button class="wc-compose-primary" onclick="submitWechatMessageEditor()">保存修改</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function selectWechatEditSide(side) {
    document.querySelectorAll('#wc-edit-side button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.side === side);
    });
}

function getWechatEditSide() {
    return document.querySelector('#wc-edit-side button.active')?.dataset.side || 'me';
}

function openWechatMessageEditor(msgIdx) {
    const char = getCurrentChatChar();
    if (!char || !char.history || msgIdx < 0 || msgIdx >= char.history.length) return;
    const msg = char.history[msgIdx];
    const modal = ensureWechatTextEditModal();
    modal.dataset.msgIdx = String(msgIdx);
    document.getElementById('wc-edit-content').value = msg.content || msg.dialogue || msg.description || '';
    const target = document.getElementById('wc-edit-target-pill');
    if (target) {
        const sender = getWechatMessageSenderName(msg, char);
        target.innerHTML = `<i class="ri-chat-1-line"></i><span>只编辑 ${wcEscapeHtml(sender)} 的这条消息</span>`;
        target.classList.toggle('is-char', msg.isMe === false);
    }
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('wc-edit-content')?.focus(), 30);
}

function closeWechatMessageEditor() {
    const modal = document.getElementById('wc-text-edit-modal');
    if (modal) modal.classList.add('hidden');
}

function submitWechatMessageEditor() {
    const modal = document.getElementById('wc-text-edit-modal');
    const char = getCurrentChatChar();
    if (!modal || !char || !char.history) return;
    const msgIdx = parseInt(modal.dataset.msgIdx, 10);
    const msg = char.history[msgIdx];
    if (!msg) return;
    msg.content = document.getElementById('wc-edit-content').value;
    msg.description = msg.type === 'image' ? msg.description : '';
    saveCharactersToStorage();
    refreshChatView(char);
    renderChatList();
    closeWechatMessageEditor();
}

// ========== 表情包系统 ==========

const WECHAT_BUILTIN_EMOJI_PACK_ID = 'pack_wechat_builtin_emoji';
const WECHAT_BUILTIN_EMOJI_BASE_URL = 'https://cdn.jsdelivr.net/gh/airinghost/wechat-emoji@main/web.wechat.com/compressed-tinypng/';
const WECHAT_BUILTIN_EMOJI_FILES = [
    '001_微笑.png',
    '002_撇嘴.png',
    '003_色.png',
    '004_发呆.png',
    '005_得意.png',
    '006_流泪.png',
    '007_害羞.png',
    '008_闭嘴.png',
    '009_睡.png',
    '010_大哭.png',
    '011_尴尬.png',
    '012_发怒.png',
    '013_调皮.png',
    '014_呲牙.png',
    '015_惊讶.png',
    '016_难过.png',
    '017_囧.png',
    '018_抓狂.png',
    '019_吐.png',
    '020_偷笑.png',
    '021_愉快.png',
    '022_白眼.png',
    '023_傲慢.png',
    '024_困.png',
    '025_惊恐.png',
    '026_憨笑.png',
    '027_悠闲.png',
    '028_咒骂.png',
    '029_疑问.png',
    '030_嘘.png',
    '031_晕.png',
    '032_衰.png',
    '033_骷髅.png',
    '034_敲打.png',
    '035_再见.png',
    '036_擦汗.png',
    '037_抠鼻.png',
    '038_鼓掌.png',
    '039_坏笑.png',
    '040_右哼哼.png',
    '041_鄙视.png',
    '042_委屈.png',
    '043_快哭了.png',
    '044_阴险.png',
    '045_亲亲.png',
    '046_可怜.png',
    '047_笑脸.png',
    '048_生病.png',
    '049_脸红.png',
    '050_破涕为笑.png',
    '051_恐惧.png',
    '052_失望.png',
    '053_无语.png',
    '054_嘿哈.png',
    '055_捂脸.png',
    '056_奸笑.png',
    '057_机智.png',
    '058_皱眉.png',
    '059_耶.png',
    '060_吃瓜.png',
    '061_加油.png',
    '062_汗.png',
    '063_天啊.png',
    '064_Emm.png',
    '065_社会社会.png',
    '066_旺柴.png',
    '067_好的.png',
    '068_打脸.png',
    '069_哇.png',
    '070_翻白眼.png',
    '071_666.png',
    '072_让我看看.png',
    '073_叹气.png',
    '074_苦涩.png',
    '075_裂开.png',
    '076_嘴唇.png',
    '077_爱心.png',
    '078_心碎.png',
    '079_拥抱.png',
    '080_强.png',
    '081_弱.png',
    '082_握手.png',
    '083_胜利.png',
    '084_抱拳.png',
    '085_勾引.png',
    '086_拳头.png',
    '087_OK.png',
    '088_合十.png',
    '089_啤酒.png',
    '090_咖啡.png',
    '091_蛋糕.png',
    '092_玫瑰.png',
    '093_凋谢.png',
    '094_菜刀.png',
    '095_炸弹.png',
    '096_便便.png',
    '097_月亮.png',
    '098_太阳.png',
    '099_庆祝.png',
    '100_礼物.png',
    '101_红包.png',
    '102_發.png',
    '103_福.png',
    '104_烟花.png',
    '105_爆竹.png',
    '106_猪头.png',
    '107_跳跳.png',
    '108_发抖.png',
    '109_转圈.png'
];

const QQ_BUILTIN_EMOJI_PACK_ID = 'pack_qq_builtin_emoji';
const QQ_BUILTIN_EMOJI_BASE_URL = 'https://cdn.jsdelivr.net/gh/qiuyinghua/wechat-emoticons@master/images/';
const QQ_BUILTIN_EMOJI_FILES = [
    'aaagh.png',
    'akward.png',
    'angry.png',
    'bah_l.png',
    'bah_r.png',
    'basketball.png',
    'beckon.png',
    'beer.png',
    'blowkiss.png',
    'blush.png',
    'bomb.png',
    'broken_heart.png',
    'cake.png',
    'chuckle.png',
    'clap.png',
    'cleaver.png',
    'coffee.png',
    'commando.png',
    'cool_guy.png',
    'cry.png',
    'dagger.png',
    'determined.png',
    'dizzy.png',
    'dramatic.png',
    'drool.png',
    'drowsy.png',
    'fight.png',
    'fist.png',
    'frown.png',
    'gift.png',
    'grimance.png',
    'grin.png',
    'hammer.png',
    'heart.png',
    'hooray.png',
    'hug.png',
    'hungry.png',
    'in_love.png',
    'joyful.png',
    'jump_rope.png',
    'kiss.png',
    'kotow.png',
    'lady_bug.png',
    'laugh.png',
    'lightning.png',
    'lips.png',
    'meditate.png',
    'moon.png',
    'nose_pick.png',
    'nuh_uh.png',
    'ok.png',
    'panic.png',
    'peace.png',
    'pig.png',
    'ping_pong copy.png',
    'ping_pong.png',
    'pinky.png',
    'pooh_pooh.png',
    'poop.png',
    'puke.png',
    'rice.png',
    'rock_on.png',
    'rose.png',
    'ruthless.png',
    'scold.png',
    'scowl.png',
    'scream.png',
    'shake.png',
    'shame.png',
    'shhh.png',
    'shocked.png',
    'shrunken.png',
    'shy.png',
    'silent.png',
    'skull.png',
    'sleep.png',
    'slight.png',
    'sly.png',
    'smile.png',
    'smooch.png',
    'smug.png',
    'sob.png',
    'soccer.png',
    'speechless.png',
    'sun.png',
    'surprise.png',
    'surrender.png',
    'sweat.png',
    'taichi_l.png',
    'taichi_r.png',
    'tearing_up.png',
    'thumbs_down.png',
    'thumbs_up.png',
    'toasted.png',
    'tongue.png',
    'tormented.png',
    'tremble.png',
    'trick.png',
    'twirl.png',
    'waddle.png',
    'watermelon.png',
    'wave.png',
    'whimper.png',
    'wilt.png',
    'wrath.png',
    'yawn.png'
];

const QQ_BUILTIN_EMOJI_NAME_MAP = {
    aaagh: '抓狂',
    akward: '尴尬',
    angry: '发怒',
    bah_l: '左哼哼',
    bah_r: '右哼哼',
    basketball: '篮球',
    beckon: '勾引',
    beer: '啤酒',
    blowkiss: '飞吻',
    blush: '脸红',
    bomb: '炸弹',
    broken_heart: '心碎',
    cake: '蛋糕',
    chuckle: '偷笑',
    clap: '鼓掌',
    cleaver: '菜刀',
    coffee: '咖啡',
    commando: '奋斗',
    cool_guy: '得意',
    cry: '大哭',
    dagger: '匕首',
    determined: '加油',
    dizzy: '晕',
    dramatic: '转圈',
    drool: '色',
    drowsy: '困',
    fight: '奋斗',
    fist: '拳头',
    frown: '难过',
    gift: '礼物',
    grimance: '撇嘴',
    grin: '呲牙',
    hammer: '敲打',
    heart: '爱心',
    hooray: '庆祝',
    hug: '拥抱',
    hungry: '饥饿',
    in_love: '爱你',
    joyful: '愉快',
    jump_rope: '跳绳',
    kiss: '亲亲',
    kotow: '磕头',
    lady_bug: '瓢虫',
    laugh: '憨笑',
    lightning: '闪电',
    lips: '嘴唇',
    meditate: '合十',
    moon: '月亮',
    nose_pick: '抠鼻',
    nuh_uh: '不',
    ok: 'OK',
    panic: '惊恐',
    peace: '胜利',
    pig: '猪头',
    ping_pong: '乒乓',
    pinky: '差劲',
    pooh_pooh: '傲慢',
    poop: '便便',
    puke: '吐',
    rice: '米饭',
    rock_on: '爱你',
    rose: '玫瑰',
    ruthless: '酷',
    scold: '咒骂',
    scowl: '发呆',
    scream: '抓狂',
    shake: '握手',
    shame: '流汗',
    shhh: '嘘',
    shocked: '疑问',
    shrunken: '委屈',
    shy: '害羞',
    silent: '闭嘴',
    skull: '骷髅',
    sleep: '睡',
    slight: '白眼',
    sly: '阴险',
    smile: '微笑',
    smooch: '亲亲',
    smug: '傲慢',
    sob: '流泪',
    soccer: '足球',
    speechless: '擦汗',
    sun: '太阳',
    surprise: '惊讶',
    surrender: '投降',
    sweat: '汗',
    taichi_l: '太极左',
    taichi_r: '太极右',
    tearing_up: '快哭了',
    thumbs_down: '弱',
    thumbs_up: '强',
    toasted: '衰',
    tongue: '调皮',
    tormented: '苦恼',
    tremble: '发抖',
    trick: '坏笑',
    twirl: '转圈',
    waddle: '跳跳',
    watermelon: '西瓜',
    wave: '再见',
    whimper: '可怜',
    wilt: '凋谢',
    wrath: '发怒',
    yawn: '哈欠'
};

const QQ_BUILTIN_EMOJI_ALIAS_MAP = {
    aaagh: ['啊', '崩溃', '抓狂'],
    akward: ['awkward', '尴尬', '囧'],
    angry: ['生气', '愤怒', '发火'],
    blush: ['害羞', '脸红', '羞'],
    chuckle: ['偷笑', '笑', '窃笑'],
    cool_guy: ['酷', '得意'],
    cry: ['哭', '大哭', '眼泪'],
    drool: ['色', '花痴', '喜欢'],
    frown: ['难过', '伤心', '委屈'],
    grimance: ['撇嘴', '嫌弃'],
    laugh: ['笑', '憨笑', '开心'],
    shrunken: ['委屈', '难过', '可怜'],
    sob: ['流泪', '哭', '眼泪'],
    tearing_up: ['快哭了', '委屈', '可怜'],
    whimper: ['可怜', '委屈', '撒娇'],
    silent: ['slient', '闭嘴', '沉默'],
    sly: ['阴险', '坏笑'],
    smile: ['微笑', '笑脸'],
    trick: ['坏笑', '调皮'],
    tongue: ['调皮', '吐舌'],
    wrath: ['生气', '发怒', '愤怒']
};

function getWechatBuiltinEmojiName(fileName) {
    return String(fileName || '').replace(/^\d+_/, '').replace(/\.[^.]+$/, '');
}

function getWechatBuiltinEmojiUrl(fileName) {
    return WECHAT_BUILTIN_EMOJI_BASE_URL + encodeURIComponent(fileName);
}

function getWechatBuiltinEmojiStickers() {
    return WECHAT_BUILTIN_EMOJI_FILES.map((fileName, index) => ({
        id: `wechat_emoji_${String(index + 1).padStart(3, '0')}`,
        name: getWechatBuiltinEmojiName(fileName),
        url: getWechatBuiltinEmojiUrl(fileName),
        packName: '微信 Emoji',
        source: 'wechatEmoji',
        emoji: true,
        builtin: true
    }));
}

function getWechatBuiltinEmojiPack() {
    return {
        id: WECHAT_BUILTIN_EMOJI_PACK_ID,
        name: '微信 Emoji',
        builtin: true,
        emoji: true,
        source: 'airinghost/wechat-emoji',
        stickers: getWechatBuiltinEmojiStickers()
    };
}

function getQqBuiltinEmojiKey(fileName) {
    return String(fileName || '')
        .replace(/\.[^.]+$/, '')
        .replace(/\s+copy$/i, '')
        .trim();
}

function getQqBuiltinEmojiName(fileName) {
    const key = getQqBuiltinEmojiKey(fileName);
    return QQ_BUILTIN_EMOJI_NAME_MAP[key] || key.replace(/_/g, ' ');
}

function getQqBuiltinEmojiAliases(fileName) {
    const raw = String(fileName || '').replace(/\.[^.]+$/, '');
    const key = getQqBuiltinEmojiKey(fileName);
    const label = getQqBuiltinEmojiName(fileName);
    const aliases = new Set([
        raw,
        raw.replace(/_/g, ' '),
        key,
        key.replace(/_/g, ' '),
        label,
        ...(QQ_BUILTIN_EMOJI_ALIAS_MAP[key] || [])
    ]);
    aliases.delete(label);
    return Array.from(aliases).filter(Boolean);
}

function getQqBuiltinEmojiUrl(fileName) {
    return QQ_BUILTIN_EMOJI_BASE_URL + encodeURIComponent(fileName);
}

function getQqBuiltinEmojiStickers() {
    return QQ_BUILTIN_EMOJI_FILES.map((fileName, index) => ({
        id: `qq_emoji_${String(index + 1).padStart(3, '0')}`,
        name: getQqBuiltinEmojiName(fileName),
        aliases: getQqBuiltinEmojiAliases(fileName),
        url: getQqBuiltinEmojiUrl(fileName),
        packName: 'QQ Emoji',
        source: 'qqEmoji',
        emoji: true,
        builtin: true
    }));
}

function getQqBuiltinEmojiPack() {
    return {
        id: QQ_BUILTIN_EMOJI_PACK_ID,
        name: 'QQ Emoji',
        builtin: true,
        emoji: true,
        source: 'qiuyinghua/wechat-emoticons',
        stickers: getQqBuiltinEmojiStickers()
    };
}

function isWechatBuiltinStickerPackId(packId) {
    return [WECHAT_BUILTIN_EMOJI_PACK_ID, QQ_BUILTIN_EMOJI_PACK_ID].includes(String(packId || ''));
}

function isWechatBuiltinEmojiUrl(url) {
    const value = String(url || '');
    return value.includes('/airinghost/wechat-emoji@main/web.wechat.com/compressed-tinypng/')
        || value.includes('/airinghost/wechat-emoji/main/web.wechat.com/compressed-tinypng/')
        || value.includes('/qiuyinghua/wechat-emoticons@master/images/')
        || value.includes('/qiuyinghua/wechat-emoticons/master/images/')
        || value.includes('raw.githubusercontent.com/qiuyinghua/wechat-emoticons/master/images/');
}

function shouldShowWechatBuiltinEmojiPack() {
    return getWechatUiThemeId() === 'wechat';
}

function shouldShowQqBuiltinEmojiPack() {
    return getWechatUiThemeId() === 'qq';
}

function getActiveWechatBuiltinEmojiPacks() {
    const packs = [];
    if (shouldShowWechatBuiltinEmojiPack()) packs.push(getWechatBuiltinEmojiPack());
    if (shouldShowQqBuiltinEmojiPack()) packs.push(getQqBuiltinEmojiPack());
    return packs;
}

function getActiveWechatBuiltinEmojiStickers() {
    return getActiveWechatBuiltinEmojiPacks().flatMap(pack => pack.stickers || []);
}

function stripWechatBuiltinStickerPacks(data) {
    data = data && typeof data === 'object' ? data : { packs: [] };
    data.packs = Array.isArray(data.packs)
        ? data.packs.filter(pack => pack && !pack.builtin && !isWechatBuiltinStickerPackId(pack.id))
        : [];
    return data;
}

function withWechatBuiltinEmojiPack(data) {
    data = stripWechatBuiltinStickerPacks(data);
    data.packs.unshift(...getActiveWechatBuiltinEmojiPacks());
    return data;
}

function getEditableStickerPacks(data) {
    return ((data && Array.isArray(data.packs)) ? data.packs : [])
        .filter(pack => pack && !pack.builtin && !isWechatBuiltinStickerPackId(pack.id));
}

const STICKER_STORAGE_KEY = 'my_sticker_packs';

function getStickerPacks() {
    try {
        const raw = localStorage.getItem(STICKER_STORAGE_KEY);
        if (raw) return withWechatBuiltinEmojiPack(ensureDefaultBoltpStickerPack(stripWechatBuiltinStickerPacks(JSON.parse(raw))));
    } catch (e) {}
    return withWechatBuiltinEmojiPack(ensureDefaultBoltpStickerPack({ packs: [] }));
}

function saveStickerPacks(data) {
    localStorage.setItem(STICKER_STORAGE_KEY, JSON.stringify(stripWechatBuiltinStickerPacks(data)));
}

function normalizeWechatStickerUrl(value) {
    const raw = String(value || '').trim().replace(/[，。；;、]+$/g, '');
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^[A-Za-z0-9_-]+\/[^\s<>"']+\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"']*)?$/i.test(raw)) {
        return `https://i.postimg.cc/${raw}`;
    }
    return '';
}

function getAllWechatStickers() {
    const data = getStickerPacks();
    return getEditableStickerPacks(data).flatMap(pack => {
        const stickers = Array.isArray(pack.stickers) ? pack.stickers : [];
        return stickers.map(sticker => ({
            id: sticker.id || '',
            name: sticker.name || '贴纸',
            url: sticker.url || '',
            packName: pack.name || '贴纸包',
            source: 'pack'
        }));
    }).filter(item => item.url);
}

function getWechatWorldBookStickerEntries(char) {
    const entries = Array.isArray(char?.worldBook) ? char.worldBook : [];
    const results = [];
    const lineRe = /([^：:\n]{1,36})[：:]\s*((?:https?:\/\/)?(?:i\.postimg\.cc\/)?[A-Za-z0-9_-]+\/[^\s<>"']+\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"']*)?)/ig;

    entries.forEach(entry => {
        const content = String(entry?.content || entry?.entry || entry?.value || entry?.comment || '').trim();
        if (!content) return;
        const entryName = String(entry?.name || entry?.title || entry?.key || entry?.keyword || '').trim();
        const directUrl = normalizeWechatStickerUrl(content);
        if (entryName && directUrl) {
            results.push({
                id: `wb_sticker_${results.length}`,
                name: entryName,
                url: directUrl,
                packName: '世界书',
                source: 'worldBook'
            });
        }
        let match;
        lineRe.lastIndex = 0;
        while ((match = lineRe.exec(content)) !== null) {
            const name = match[1].replace(/^[\s\-*•]+/, '').trim();
            const url = normalizeWechatStickerUrl(match[2]);
            if (name && url) {
                results.push({
                    id: `wb_sticker_${results.length}`,
                    name,
                    url,
                    packName: '世界书',
                    source: 'worldBook'
                });
            }
        }
    });

    return results;
}

function getWechatKnownStickerAliases() {
    return [
        {
            id: 'known_sticker_bad_puppy',
            name: '小狗能有什么坏心思',
            url: 'https://i.postimg.cc/xjXmPS01/Screenshot-20250706-172607-com-tencent-mm-edit-847742664116475.jpg',
            packName: '用户贴纸别名',
            source: 'knownAlias'
        },
        {
            id: 'known_sticker_scratch',
            name: '挠屁屁',
            url: 'https://i.postimg.cc/x1nqBrSH/Image-1751795552078.jpg',
            packName: '用户贴纸别名',
            source: 'knownAlias'
        }
    ];
}

function getWechatAvailableStickers(char) {
    const seen = new Set();
    return [...getAllWechatStickers(), ...getWechatWorldBookStickerEntries(char), ...getWechatKnownStickerAliases(), ...getActiveWechatBuiltinEmojiStickers()].filter(item => {
        const key = item.url || `${item.packName}:${item.name}`;
        if (!item.url || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function scoreWechatStickerMatch(sticker, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return 0;
    const queries = [q, ...getWechatStickerEmotionAliases(q)].filter(Boolean);
    const names = [
        sticker.name,
        ...(Array.isArray(sticker.aliases) ? sticker.aliases : [])
    ].map(item => String(item || '').toLowerCase()).filter(Boolean);
    const name = names.join(' ');
    const pack = String(sticker.packName || '').toLowerCase();
    let best = 0;
    queries.forEach(item => {
        if (!item) return;
        if (names.some(candidate => candidate === item)) best = Math.max(best, item === q ? 100 : 88);
        if (names.some(candidate => candidate.includes(item))) best = Math.max(best, item === q ? 80 : 64);
        if (names.some(candidate => item.includes(candidate) && candidate.length >= 2)) best = Math.max(best, item === q ? 68 : 54);
        if (pack.includes(item)) best = Math.max(best, item === q ? 42 : 28);
        const qChars = Array.from(new Set(item.replace(/\s+/g, '')));
        const overlap = qChars.filter(ch => name.includes(ch)).length;
        if (overlap) best = Math.max(best, Math.min(item === q ? 35 : 24, overlap * 7));
    });
    return best;
}

function getWechatStickerEmotionAliases(query) {
    const q = String(query || '').trim().toLowerCase();
    const groups = {
        '委屈': ['可怜', '难过', '哭', '眼泪', '撒娇', '小狗', '狗狗', '抱抱'],
        '可怜': ['委屈', '难过', '哭', '眼泪', '小狗', '狗狗'],
        '难过': ['委屈', '哭', '眼泪', '可怜'],
        '哭': ['委屈', '难过', '眼泪', '可怜'],
        '开心': ['笑', '快乐', '高兴', '喜欢'],
        '生气': ['怒', '气', '哼', '不满', '皱眉'],
        '害羞': ['脸红', '羞', '喜欢', '抱抱'],
        '撒娇': ['委屈', '可怜', '抱抱', '小狗'],
        '皱眉': ['无语', '沉默', '不满', '严肃', '生气', '烦', '嫌弃'],
        '无语': ['皱眉', '沉默', '嫌弃', '不满'],
        '沉默': ['皱眉', '无语', '严肃', '发呆'],
        '嫌弃': ['皱眉', '无语', '不满', '哼']
    };
    const aliases = new Set();
    Object.keys(groups).forEach(key => {
        if (q.includes(key) || groups[key].some(item => q.includes(item))) {
            aliases.add(key);
            groups[key].forEach(item => aliases.add(item));
        }
    });
    aliases.delete(q);
    return Array.from(aliases);
}

function hashWechatStickerQuery(value) {
    return Array.from(String(value || '')).reduce((sum, ch) => ((sum * 31) + ch.charCodeAt(0)) >>> 0, 7);
}

function findWechatStickerForAi(char, query, explicitUrl) {
    const url = normalizeWechatStickerUrl(explicitUrl);
    const name = String(query || '').trim() || '表情';
    if (url) return { name, url, source: 'directive' };

    const stickers = getWechatAvailableStickers(char);
    let best = null;
    let bestScore = 0;
    stickers.forEach(sticker => {
        const score = scoreWechatStickerMatch(sticker, name);
        if (score > bestScore) {
            best = sticker;
            bestScore = score;
        }
    });
    if (bestScore >= 14) return best;
    const aliases = getWechatStickerEmotionAliases(name);
    if (aliases.length && stickers.length) return stickers[hashWechatStickerQuery(name) % stickers.length];
    return stickers.length ? stickers[hashWechatStickerQuery(name) % stickers.length] : null;
}

function buildWechatStickerPrompt(char) {
    const stickers = getWechatAvailableStickers(char).slice(0, 40);
    if (!stickers.length) return '';
    const lines = stickers.map(item => {
        const source = item.source === 'worldBook' ? '世界书' : item.packName;
        return `- ${item.name}（${source}）`;
    });
    const omitted = getWechatAvailableStickers(char).length > stickers.length ? `\n- 另有更多贴纸未展开。` : '';
    return `【微信贴纸上下文】你可以发送这些用户贴纸包/世界书贴纸。需要发贴纸时，把它作为单独一段输出：[微信表情:贴纸名或情绪]；如果世界书给了 postimg 链接，也可以输出 [微信表情:贴纸名|图片URL]。\n${lines.join('\n')}${omitted}`;
}

function buildBoltpStickerList() {
    const share = window.BYND_BOLTP_STICKER_SHARE;
    const stickers = Array.isArray(share?.stickers) ? share.stickers : [];
    return stickers.map(item => ({
        id: 'stk_boltp_' + item.id,
        name: item.name || '\u8d34\u7eb8',
        url: item.url,
        remoteUrl: item.remoteUrl || ''
    })).filter(item => item.url);
}

function ensureDefaultBoltpStickerPack(data) {
    data = data && typeof data === 'object' ? data : { packs: [] };
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const share = window.BYND_BOLTP_STICKER_SHARE;
    const stickers = buildBoltpStickerList();
    if (!share || !stickers.length) return data;
    const packName = share.name || '图床贴纸包';
    let pack = data.packs.find(item => item.id === 'pack_boltp_26c3884813ed4f4999b78e49d448f2e6')
        || data.packs.find(item => item.name === packName);
    if (!pack) {
        pack = {
            id: 'pack_boltp_26c3884813ed4f4999b78e49d448f2e6',
            name: packName,
            total: Number(share.total) || stickers.length,
            stickers
        };
        data.packs.unshift(pack);
        saveStickerPacks(data);
        return data;
    }
    pack.stickers = Array.isArray(pack.stickers) ? pack.stickers : [];
    const stickerById = new Map(stickers.map(item => [String(item.id || ''), item]));
    const stickerByName = new Map(stickers.map(item => [String(item.name || ''), item]));
    const stickerByRemote = new Map(stickers.filter(item => item.remoteUrl).map(item => [String(item.remoteUrl), item]));
    let changed = false;
    pack.stickers = pack.stickers.map(item => {
        const next = stickerById.get(String(item.id || '')) || stickerByName.get(String(item.name || '')) || stickerByRemote.get(String(item.url || ''));
        if (next && item.url !== next.url) {
            changed = true;
            return { ...item, id: next.id, name: next.name, url: next.url, remoteUrl: next.remoteUrl || item.remoteUrl || '' };
        }
        return item;
    });
    const existingKeys = new Set();
    pack.stickers = pack.stickers.filter(item => {
        const key = String(item.id || item.url || item.name || '');
        if (!key || existingKeys.has(key)) {
            changed = true;
            return false;
        }
        existingKeys.add(key);
        return true;
    });
    const existing = new Set(pack.stickers.map(item => item.url));
    const fresh = stickers.filter(item => !existing.has(item.url));
    if (fresh.length) {
        pack.stickers.push(...fresh);
        changed = true;
    }
    if (changed) saveStickerPacks(data);
    pack.total = Math.max(Number(pack.total) || 0, Number(share.total) || stickers.length, pack.stickers.length);
    return data;
}

function isWechatStickerStoreOpen() {
    const screen = document.getElementById('wc-feature-screen');
    const title = document.getElementById('wc-feature-title')?.textContent || '';
    return !!screen && screen.classList.contains('active') && title === '表情';
}

function refreshStickerSurfaces() {
    const manager = document.getElementById('wc-sticker-manager');
    if (manager && !manager.classList.contains('hidden')) renderStickerPackList();

    const picker = document.getElementById('wc-sticker-picker');
    if (picker && !picker.classList.contains('hidden')) renderStickerPicker();

    if (isWechatStickerStoreOpen()) openWechatStickerStore();
}

// --- 表情选择器 ---
function openStickerPicker() {
    closeChatToolbar();
    const picker = document.getElementById('wc-sticker-picker');
    if (!picker) return;
    picker.classList.remove('hidden');
    renderStickerPicker();
}

function closeStickerPicker() {
    const picker = document.getElementById('wc-sticker-picker');
    if (picker) picker.classList.add('hidden');
}

function renderStickerPicker() {
    const data = getStickerPacks();
    const tabsEl = document.getElementById('wc-sticker-tabs');
    const gridEl = document.getElementById('wc-sticker-grid');
    if (!tabsEl || !gridEl) return;

    if (!data.packs || data.packs.length === 0) {
        tabsEl.innerHTML = '';
        gridEl.classList.remove('wc-emoji-grid');
        gridEl.innerHTML = '<div style="text-align:center;color:#999;padding:40px;grid-column:1/-1;font-size:13px;">还没有贴纸包哦～<br>点右上角设置添加</div>';
        return;
    }

    const activeId = data.packs.some(p => p.id === window._activeStickerPackId)
        ? window._activeStickerPackId
        : data.packs[0].id;
    window._activeStickerPackId = activeId;

    tabsEl.innerHTML = data.packs.map(p =>
        `<div class="wc-sticker-tab ${p.id === activeId ? 'active' : ''} ${p.emoji ? 'emoji' : ''}" onclick="switchStickerPack(${quoteWechatJsString(p.id)})">${escapeHtml(p.name)}</div>`
    ).join('');

    const pack = data.packs.find(p => p.id === activeId) || data.packs[0];
    const stickers = Array.isArray(pack?.stickers) ? pack.stickers : [];
    gridEl.classList.toggle('wc-emoji-grid', !!pack?.emoji);
    if (pack && stickers.length > 0) {
        gridEl.innerHTML = stickers.map(s =>
            `<img class="${pack.emoji || s.emoji ? 'wc-emoji-item' : ''}" src="${wcEscapeHtml(s.url)}" alt="${escapeHtml(s.name)}" title="${escapeHtml(s.name)}" onclick="sendSticker(${quoteWechatJsString(s.url)}, ${quoteWechatJsString(s.name)}, ${pack.emoji || s.emoji ? 'true' : 'false'})" loading="lazy" onerror="this.style.opacity='0.3'">`
        ).join('');
    } else {
        gridEl.innerHTML = '<div style="text-align:center;color:#999;padding:40px;grid-column:1/-1;font-size:13px;">这个包里还没有贴纸</div>';
    }
}

function switchStickerPack(packId) {
    window._activeStickerPackId = packId;
    renderStickerPicker();
}

function sendSticker(url, name, isWechatEmoji = false) {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;

    const msg = {
        type: 'sticker',
        isMe: true,
        content: url,
        stickerName: name || '',
        stickerKind: isWechatEmoji ? 'wechatEmoji' : 'sticker',
        emoji: !!isWechatEmoji,
        timestamp: createMessageTimestamp()
    };
    if (!char.history) char.history = [];
    char.history.push(msg);
    if (typeof recordWechatUserContact === 'function') recordWechatUserContact(char.id);

    refreshChatView(char);
    closeStickerPicker();
    saveCharactersToStorage();
}

// --- 贴纸包管理器 ---
function openStickerManager() {
    closeChatToolbar();
    closeStickerPicker();
    const manager = document.getElementById('wc-sticker-manager');
    if (!manager) return;
    const root = getWechatModalRoot();
    if (root && manager.parentElement !== root) root.appendChild(manager);
    manager.classList.add('wc-sticker-manager-overlay');
    manager.style.display = 'flex';
    manager.style.zIndex = '3600';
    manager.classList.remove('hidden');
    renderStickerPackList();
}

function closeStickerManager() {
    const manager = document.getElementById('wc-sticker-manager');
    if (!manager) return;
    manager.classList.add('hidden');
    manager.style.display = '';
}

function renderStickerPackList() {
    const data = getStickerPacks();
    const listEl = document.getElementById('sticker-pack-list');
    if (!listEl) return;

    if (!data.packs || data.packs.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;color:#999;padding:30px;font-size:13px;">还没有贴纸包<br>点下面按钮创建一个吧</div>';
        return;
    }

    listEl.innerHTML = data.packs.map(p => {
        const stickers = Array.isArray(p.stickers) ? p.stickers : [];
        const safeId = quoteWechatJsString(p.id);
        const actions = p.builtin || isWechatBuiltinStickerPackId(p.id)
            ? `<i class="ri-eye-line" onclick="openPackDetail(${safeId})" title="查看"></i>`
            : `<i class="ri-add-line" onclick="openBatchImport(${safeId})" title="导入"></i>
                <i class="ri-edit-line" onclick="openPackDetail(${safeId})" title="管理"></i>
                <i class="ri-delete-bin-6-line del-btn" onclick="deleteStickerPack(${safeId})" title="删除"></i>`;
        return `
        <div class="sticker-pack-item ${p.builtin ? 'builtin' : ''}">
            <div class="sticker-pack-info">
                ${stickers.length > 0 ? `<img class="sticker-pack-preview ${p.emoji ? 'emoji' : ''}" src="${wcEscapeHtml(stickers[0].url)}" onerror="this.style.opacity='0.3'">` : '<div class="sticker-pack-preview"></div>'}
                <div>
                    <div class="sticker-pack-name">${escapeHtml(p.name)}${p.builtin ? '<em>内置</em>' : ''}</div>
                    <div class="sticker-pack-count">${stickers.length} 张${p.emoji ? '表情' : '贴纸'}</div>
                </div>
            </div>
            <div class="sticker-pack-actions">${actions}</div>
        </div>`;
    }).join('');
}

function createStickerPack() {
    openStickerPackCreateModal();
}

function ensureStickerPackCreateModal() {
    let modal = document.getElementById('wc-sticker-pack-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-sticker-pack-modal';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
    modal.innerHTML = `
        <div class="wc-compose-card wc-sticker-create-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i class="ri-emotion-happy-line"></i><span>新建贴纸包</span></div>
                <i class="ri-close-line" onclick="closeStickerPackCreateModal()"></i>
            </div>
            <div class="wc-compose-body">
                <label class="wc-compose-field">
                    <span>贴纸包名称</span>
                    <input id="wc-sticker-pack-name" type="text" maxlength="24" placeholder="例如：猫猫、撒娇、摸鱼">
                </label>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="closeStickerPackCreateModal()">取消</button>
                <button class="wc-compose-primary" onclick="confirmCreateStickerPack()">创建</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function openStickerPackCreateModal() {
    const modal = ensureStickerPackCreateModal();
    const input = document.getElementById('wc-sticker-pack-name');
    if (input) input.value = '';
    modal.classList.add('wc-sticker-submodal');
    modal.style.zIndex = '3800';
    modal.classList.remove('hidden');
    setTimeout(() => input?.focus(), 30);
}

function closeStickerPackCreateModal() {
    const modal = document.getElementById('wc-sticker-pack-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmCreateStickerPack() {
    const input = document.getElementById('wc-sticker-pack-name');
    const name = input ? input.value.trim() : '';
    if (!name) {
        if (input) input.focus();
        return;
    }
    const data = getStickerPacks();
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const pack = { id: 'pack_' + Date.now(), name: name.trim(), stickers: [] };
    data.packs.push(pack);
    saveStickerPacks(data);
    window._wechatStickerImportPackId = pack.id;
    window._activeStickerPackId = pack.id;
    refreshStickerSurfaces();
    closeStickerPackCreateModal();
    if (typeof showWechatToast === 'function') showWechatToast('已新建贴纸包');
}

function deleteStickerPack(packId) {
    if (isWechatBuiltinStickerPackId(packId)) return;
    const data = getStickerPacks();
    const pack = getEditableStickerPacks(data).find(p => p.id === packId);
    if (!pack) return;
    if (!confirm(`确定删除「${pack.name}」吗？
共 ${pack.stickers.length} 张贴纸`)) return;
    data.packs = getEditableStickerPacks(data).filter(p => p.id !== packId);
    saveStickerPacks(data);
    const nextPack = getEditableStickerPacks(data)[0];
    if (window._wechatStickerImportPackId === packId) window._wechatStickerImportPackId = nextPack?.id || '';
    if (window._activeStickerPackId === packId) window._activeStickerPackId = WECHAT_BUILTIN_EMOJI_PACK_ID;
    refreshStickerSurfaces();
}

// --- 批量导入 ---
function openBatchImport(packId) {
    if (isWechatBuiltinStickerPackId(packId)) {
        if (typeof showWechatToast === 'function') showWechatToast('内置 Emoji 不能导入或删除');
        return;
    }
    window._importTargetPackId = packId;
    let modal = document.getElementById('wc-batch-import-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wc-batch-import-modal';
        modal.className = 'wc-modal-overlay hidden wc-sticker-submodal';
        modal.style.zIndex = '3800';
        modal.innerHTML = `
            <div class="wc-char-card" style="max-height:85%;display:flex;flex-direction:column;background:#fffcf8;border:1.5px solid rgba(248,164,184,0.25);border-radius:24px;">
                <div class="wc-card-header" style="border-bottom-color:rgba(248,164,184,0.15);">
                    <span style="color:#d4749a;font-weight:700;">批量导入贴纸</span>
                    <i class="ri-close-line" onclick="closeBatchImport()" style="color:#c9a0b5;cursor:pointer;"></i>
                </div>
                <div class="wc-card-body" style="overflow-y:auto;flex:1;align-items:stretch;gap:10px;">
                    <div class="wc-form-group">
                        <label style="font-size:12px;color:#888;">每行一个，支持多种格式</label>
                        <textarea id="sticker-import-text" class="sticker-import-textarea" rows="6"
                            placeholder="支持格式举例：&#10;开心：https://example.com/happy.png&#10;难过 https://example.com/sad.png&#10;https://example.com/plain.png&#10;名称——URL&#10;表情包：URL"></textarea>
                    </div>
                    <button onclick="previewBatchImport()" style="width:100%;height:36px;background:#f0ad4e;color:white;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">预览解析结果</button>
                    <div id="sticker-import-preview" class="sticker-import-preview"></div>
                    <div id="sticker-import-count" style="text-align:center;font-size:12px;color:#888;"></div>
                </div>
                <div style="padding:12px 16px;border-top:1px solid rgba(248,164,184,0.1);">
                    <button onclick="confirmBatchImport()" style="width:100%;height:40px;background:#07c160;color:white;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">确认导入</button>
                </div>
            </div>
        `;
        getWechatModalRoot().appendChild(modal);
    }
    document.getElementById('sticker-import-text').value = '';
    document.getElementById('sticker-import-preview').innerHTML = '';
    document.getElementById('sticker-import-count').textContent = '';
    window._parsedStickers = [];
    modal.classList.remove('hidden');
}

function closeBatchImport() {
    const modal = document.getElementById('wc-batch-import-modal');
    if (modal) modal.classList.add('hidden');
}

// 灵活格式解析器
function parseStickerBatchText(text) {
    const results = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;

    for (const line of lines) {
        const urls = line.match(urlRegex);
        if (!urls || urls.length === 0) continue;

        for (const url of urls) {
            let name = line.replace(url, '').trim();
            // 去除各种分隔符
            name = name
                .replace(/^[：:—\-–\s\t,，、|~～]+/, '')
                .replace(/[：:—\-–\s\t,，、|~～]+$/, '')
                .replace(/^表情(包)?[：:—\-–\s]*/, '')
                .replace(/[：:—\-–\s]*表情(包)?$/, '')
                .trim();

            if (!name) {
                const urlPath = url.split('/').pop().split('?')[0];
                name = urlPath.replace(/\.[^.]+$/, '') || '贴纸';
            }

            results.push({
                id: 'stk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                name: name,
                url: url
            });
        }
    }
    return results;
}

function previewBatchImport() {
    const text = document.getElementById('sticker-import-text').value;
    const parsed = parseStickerBatchText(text);
    window._parsedStickers = parsed;

    const previewEl = document.getElementById('sticker-import-preview');
    const countEl = document.getElementById('sticker-import-count');

    if (parsed.length === 0) {
        previewEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#f87171;font-size:13px;">未识别到有效 URL</div>';
        countEl.textContent = '';
        return;
    }

    previewEl.innerHTML = parsed.map(s =>
        `<img src="${s.url}" alt="${escapeHtml(s.name)}" title="${escapeHtml(s.name)}" loading="lazy" onerror="this.style.border='2px solid #f87171'">`
    ).join('');
    countEl.textContent = `识别到 ${parsed.length} 张贴纸`;
}

function confirmBatchImport() {
    const stickers = window._parsedStickers || [];
    if (stickers.length === 0) { alert('没有可导入的贴纸，请先粘贴链接并预览'); return; }

    const packId = window._importTargetPackId;
    const data = getStickerPacks();
    const pack = data.packs.find(p => p.id === packId);
    if (!pack) { alert('目标贴纸包不存在'); return; }

    pack.stickers.push(...stickers);
    saveStickerPacks(data);
    window._wechatStickerImportPackId = pack.id;
    window._activeStickerPackId = pack.id;
    closeBatchImport();
    refreshStickerSurfaces();
    alert(`成功导入 ${stickers.length} 张贴纸到「${pack.name}」`);
}

// --- 贴纸包详情（查看/批量删除） ---
function openPackDetail(packId) {
    const data = getStickerPacks();
    const pack = data.packs.find(p => p.id === packId);
    if (!pack) return;

    window._detailPackId = packId;
    const listEl = document.getElementById('sticker-pack-list');
    const stickers = Array.isArray(pack.stickers) ? pack.stickers : [];
    const canEdit = !pack.builtin && !isWechatBuiltinStickerPackId(pack.id);
    const builtinNote = pack.id === QQ_BUILTIN_EMOJI_PACK_ID
        ? '来自 qiuyinghua/wechat-emoticons 的 QQ Emoji，只能发送，不能删除。'
        : '来自 airinghost/wechat-emoji 的微信内置表情，只能发送，不能删除。';

    listEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <i class="ri-arrow-left-s-line" style="font-size:22px;cursor:pointer;" onclick="renderStickerPackList()"></i>
            <span style="font-size:16px;font-weight:600;">${escapeHtml(pack.name)}</span>
            <span style="color:#999;font-size:12px;">(${stickers.length})</span>
        </div>
        ${canEdit ? `
        <div style="display:flex;gap:6px;margin-bottom:12px;">
            <button onclick="openBatchImport(${quoteWechatJsString(packId)})" style="flex:1;height:36px;background:#07c160;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                <i class="ri-add-line"></i> 导入
            </button>
            <button onclick="toggleDeleteMode()" id="stk-del-mode-btn" style="flex:1;height:36px;background:#ff6b6b;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                <i class="ri-delete-bin-6-line"></i> 批量删除
            </button>
        </div>` : '<div class="wc-built-in-emoji-note">' + escapeHtml(builtinNote) + '</div>'}
        <div id="pack-sticker-grid" class="${pack.emoji ? 'wc-pack-emoji-grid' : ''}" style="display:grid;grid-template-columns:repeat(${pack.emoji ? 7 : 4},1fr);gap:8px;">
            ${stickers.map(s => `
                <div class="pack-sticker-cell ${pack.emoji || s.emoji ? 'wechat-emoji' : ''}" data-stk-id="${s.id}" ${canEdit ? 'onclick="toggleStickerSelect(this)"' : ''}>
                    <img src="${wcEscapeHtml(s.url)}" title="${escapeHtml(s.name)}" style="width:100%;aspect-ratio:1;object-fit:contain;border-radius:6px;background:#f5f5f5;" onerror="this.style.opacity='0.3'" loading="lazy">
                </div>
            `).join('')}
        </div>
        ${stickers.length === 0 ? '<div style="text-align:center;color:#999;padding:30px;font-size:13px;">还没有贴纸</div>' : ''}
        ${canEdit ? '<div id="stk-del-bar" class="hidden" style="margin-top:12px;text-align:center;"><button onclick="confirmDeleteStickers()" style="width:100%;height:36px;background:#ff3b30;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">删除选中的贴纸</button></div>' : ''}
    `;
}

function toggleStickerSelect(cell) {
    const bar = document.getElementById('stk-del-bar');
    if (bar && !bar.classList.contains('hidden')) {
        cell.classList.toggle('selected');
    }
}

function toggleDeleteMode() {
    const bar = document.getElementById('stk-del-bar');
    if (!bar) return;
    bar.classList.toggle('hidden');
    // 退出删除模式时清除选中
    if (bar.classList.contains('hidden')) {
        document.querySelectorAll('.pack-sticker-cell.selected').forEach(el => el.classList.remove('selected'));
    }
}

function confirmDeleteStickers() {
    if (isWechatBuiltinStickerPackId(window._detailPackId)) return;
    const selected = document.querySelectorAll('.pack-sticker-cell.selected');
    if (selected.length === 0) { alert('请先点击选择要删除的贴纸'); return; }
    if (!confirm(`确定删除 ${selected.length} 张贴纸吗？`)) return;

    const idsToDelete = new Set(Array.from(selected).map(el => el.dataset.stkId));
    const data = getStickerPacks();
    const pack = getEditableStickerPacks(data).find(p => p.id === window._detailPackId);
    if (pack) {
        pack.stickers = pack.stickers.filter(s => !idsToDelete.has(s.id));
        saveStickerPacks(data);
        window._wechatStickerImportPackId = pack.id;
        window._activeStickerPackId = pack.id;
        refreshStickerSurfaces();
    }
    openPackDetail(window._detailPackId);
}
