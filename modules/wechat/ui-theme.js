// --- WeChat UI theme module: theme definitions, tab labels and themed chat headers ---
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
        id: 'claude',
        name: 'Claude 主题',
        tone: '暖白',
        desc: '参考 Claude iOS 的暖白底、墨色文字、细边卡片和克制圆角聊天体验。',
        accent: '#c15f3c',
        preview: ['#f7f1e8', '#fffaf2', '#2f261d'],
        searchPlaceholder: '搜索对话',
        tabs: {
            chat: { label: '聊天', title: 'Chats', icon: 'ri-chat-1-line' },
            contacts: { label: '角色', title: '角色', icon: 'ri-user-6-line' },
            discover: { label: '动态', title: '动态', icon: 'ri-sparkling-2-line' },
            me: { label: '我的', title: '我的', icon: 'ri-user-smile-line' }
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
        id: 'couple',
        name: '恋爱透明主题',
        tone: '透明恋爱',
        desc: '独立头像贴纸、透明聊天气泡、情侣头像顶栏和会随角色心情变化的颜文字。',
        accent: '#f4a7bd',
        preview: ['#fff4f7', 'rgba(255,255,255,0.36)', '#f4a7bd'],
        searchPlaceholder: '搜索聊天',
        tabs: {
            chat: { label: '聊天', title: '聊天', icon: 'ri-chat-heart-line' },
            contacts: { label: '联系人', title: '联系人', icon: 'ri-user-heart-line' },
            discover: { label: '动态', title: '动态', icon: 'ri-heart-pulse-line' },
            me: { label: '我的', title: '我的', icon: 'ri-user-smile-line' }
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

function applyWechatUiTheme(themeId = getWechatUiThemeId(), options = {}) {
    const root = document.getElementById('app-wechat-window');
    if (!root) return;
    const theme = getWechatUiTheme(themeId);
    const sameTheme = root.dataset.uiTheme === theme.id && root.classList.contains(`wc-ui-theme-${theme.id}`);
    if (!sameTheme) {
        WECHAT_UI_THEMES.forEach(item => root.classList.remove(`wc-ui-theme-${item.id}`));
        root.classList.add(`wc-ui-theme-${theme.id}`);
        root.dataset.uiTheme = theme.id;
    }
    if (options.update !== false) updateWechatUiThemeStructure(theme);
}

function getWechatThemeTabMeta(tabName, theme = getWechatUiTheme()) {
    const fallback = (getWechatUiTheme(WECHAT_UI_THEME_DEFAULT_ID).tabs || {})[tabName] || {};
    return (theme.tabs && theme.tabs[tabName]) || fallback || { label: tabName, title: tabName, icon: 'ri-circle-line' };
}

function getWechatThemeCharUnreadCount(char) {
    if (!char) return 0;
    if (typeof isWechatChatPageActive === 'function' && isWechatChatPageActive(char.id)) return 0;
    const explicit = Number(char.unreadCount ?? char.chatConfig?.unreadCount ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return Math.min(999, Math.floor(explicit));
    const history = Array.isArray(char.history) ? char.history : [];
    const lastReadAt = Number(char.chatConfig && char.chatConfig.lastReadAt) || 0;
    let count = 0;
    if (lastReadAt > 0) {
        history.forEach(msg => {
            if (!msg || msg.type === 'system_notice' || msg.isMe) return;
            if (typeof isWechatRegexPayloadMessage === 'function' && isWechatRegexPayloadMessage(msg, char)) return;
            if (getWechatMessageTimestampValue(msg) > lastReadAt) count += 1;
        });
        return Math.min(999, count);
    }
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.type === 'system_notice') continue;
        if (msg.isMe) break;
        if (typeof isWechatRegexPayloadMessage === 'function' && isWechatRegexPayloadMessage(msg, char)) continue;
        count += 1;
    }
    return Math.min(999, count);
}

function getWechatThemeChatUnreadTotal() {
    const chars = Array.isArray(window.myCharacters) ? window.myCharacters : [];
    const total = chars.reduce((sum, char) => sum + getWechatThemeCharUnreadCount(char), 0);
    return Math.max(0, Math.min(999, total));
}

function getWechatTelegramUserAvatarSrc() {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const raw = String((profile && profile.avatar) || '').trim();
    const fallback = typeof DEFAULT_AVATAR !== 'undefined' ? DEFAULT_AVATAR : '';
    if (!raw || raw === 'undefined' || raw === 'null') return fallback;
    return raw;
}

function syncWechatTelegramTabAvatar() {
    const img = document.querySelector('#app-wechat-window.wc-ui-theme-telegram .wc-telegram-tab-avatar img');
    if (!img) return;
    img.src = getWechatTelegramUserAvatarSrc();
}
window.syncWechatTelegramTabAvatar = syncWechatTelegramTabAvatar;

function getWechatThemeUnreadBadgeHtml(count) {
    if (!count) return '';
    const label = count > 99 ? '99+' : String(count);
    return `<b class="wc-wechat-tab-badge" aria-label="${label} 条未读消息">${label}</b>`;
}

function getWechatThemeTabIconHtml(key, meta, theme) {
    if (theme.id === 'qq') {
        const icons = {
            chat: `
                <svg class="wc-qq-tab-svg wc-qq-tab-chat-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                    <path d="M32 8C18.2 8 7 17.1 7 28.2c0 7.8 5.7 14.6 14 17.9l-1.1 8.1c-.2 1.4 1.5 2.3 2.6 1.4l8.4-6.9H32c13.8 0 25-9.1 25-20.5S45.8 8 32 8Z" fill="currentColor"/>
                    <circle cx="25.2" cy="28.8" r="3.2" fill="var(--wc-qq-tab-dot, #fff)"/>
                    <circle cx="38.8" cy="28.8" r="3.2" fill="var(--wc-qq-tab-dot, #fff)"/>
                </svg>
            `,
            contacts: `
                <svg class="wc-qq-tab-svg wc-qq-tab-contacts-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                    <path d="M32 32.5c7 0 12.2-5.5 12.2-12.5S39 8.5 32 8.5 19.8 13 19.8 20 25 32.5 32 32.5Z" stroke="currentColor" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M14.8 55.5c2.4-10.4 9.2-16.2 17.2-16.2s14.8 5.8 17.2 16.2" stroke="currentColor" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `,
            discover: `
                <svg class="wc-qq-tab-svg wc-qq-tab-channel-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                    <path d="M25 10.5 19.5 54" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>
                    <path d="M44.5 10.5 39 54" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>
                    <path d="M12.5 24.5h39.8" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>
                    <path d="M10.8 40.5h39.8" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>
                </svg>
            `,
            me: `
                <svg class="wc-qq-tab-svg wc-qq-tab-qzone-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                    <path d="M47.2 21.4A20 20 0 1 0 52 34.2" stroke="currentColor" stroke-width="5.2" stroke-linecap="round"/>
                    <path d="M49.2 7.5 51.9 14l7 1.1-5.1 4.7 1.3 6.9-5.9-3.4-6.1 3.4 1.4-6.9-5.1-4.7 7-1.1 2.8-6.5Z" fill="currentColor"/>
                </svg>
            `
        };
        return `<span class="wc-theme-tab-icon wc-qq-tab-icon wc-qq-tab-${key}">${icons[key] || icons.chat}</span>`;
    }
    if (theme.id === 'telegram') {
        const avatar = typeof wcEscapeAttr === 'function'
            ? wcEscapeAttr(getWechatTelegramUserAvatarSrc())
            : wcEscapeHtml(getWechatTelegramUserAvatarSrc());
        const fallback = typeof wcEscapeAttr === 'function'
            ? wcEscapeAttr(typeof DEFAULT_AVATAR !== 'undefined' ? DEFAULT_AVATAR : '')
            : wcEscapeHtml(typeof DEFAULT_AVATAR !== 'undefined' ? DEFAULT_AVATAR : '');
        const icons = {
            chat: `
                <svg class="wc-telegram-tab-svg wc-telegram-tab-chat-svg" viewBox="0 0 256 256" aria-hidden="true">
                    <path fill="currentColor" d="M120 128a16 16 0 1 1-16-16a16 16 0 0 1 16 16m32-16a16 16 0 1 0 16 16a16 16 0 0 0-16-16m84 16a108 108 0 0 1-157.23 96.15L46.34 235A20 20 0 0 1 21 209.66l10.81-32.43A108 108 0 1 1 236 128m-24 0a84 84 0 1 0-156.73 42.06a12 12 0 0 1 1 9.81l-9.93 29.79l29.79-9.93a12.1 12.1 0 0 1 3.8-.62a12 12 0 0 1 6 1.62A84 84 0 0 0 212 128"/>
                </svg>
            `,
            contacts: `
                <svg class="wc-telegram-tab-svg wc-telegram-tab-user-svg" viewBox="0 0 256 256" aria-hidden="true">
                    <path fill="currentColor" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24M74.08 197.5a64 64 0 0 1 107.84 0a87.83 87.83 0 0 1-107.84 0M96 120a32 32 0 1 1 32 32a32 32 0 0 1-32-32m97.76 66.41a79.66 79.66 0 0 0-36.06-28.75a48 48 0 1 0-59.4 0a79.66 79.66 0 0 0-36.06 28.75a88 88 0 1 1 131.52 0"/>
                </svg>
            `,
            discover: `
                <svg class="wc-telegram-tab-svg wc-telegram-tab-gear-svg" viewBox="0 0 256 256" aria-hidden="true">
                    <path fill="currentColor" d="M128 80a48 48 0 1 0 48 48a48.05 48.05 0 0 0-48-48m0 80a32 32 0 1 1 32-32a32 32 0 0 1-32 32m109.94-52.79a8 8 0 0 0-3.89-5.4l-29.83-17l-.12-33.62a8 8 0 0 0-2.83-6.08a111.9 111.9 0 0 0-36.72-20.67a8 8 0 0 0-6.46.59L128 41.85L97.88 25a8 8 0 0 0-6.47-.6a112.1 112.1 0 0 0-36.68 20.75a8 8 0 0 0-2.83 6.07l-.15 33.65l-29.83 17a8 8 0 0 0-3.89 5.4a106.5 106.5 0 0 0 0 41.56a8 8 0 0 0 3.89 5.4l29.83 17l.12 33.62a8 8 0 0 0 2.83 6.08a111.9 111.9 0 0 0 36.72 20.67a8 8 0 0 0 6.46-.59L128 214.15L158.12 231a7.9 7.9 0 0 0 3.9 1a8.1 8.1 0 0 0 2.57-.42a112.1 112.1 0 0 0 36.68-20.73a8 8 0 0 0 2.83-6.07l.15-33.65l29.83-17a8 8 0 0 0 3.89-5.4a106.5 106.5 0 0 0-.03-41.52m-15 34.91l-28.57 16.25a8 8 0 0 0-3 3c-.58 1-1.19 2.06-1.81 3.06a7.94 7.94 0 0 0-1.22 4.21l-.15 32.25a95.9 95.9 0 0 1-25.37 14.3L134 199.13a8 8 0 0 0-3.91-1h-3.83a8.1 8.1 0 0 0-4.1 1l-28.84 16.1A96 96 0 0 1 67.88 201l-.11-32.2a8 8 0 0 0-1.22-4.22c-.62-1-1.23-2-1.8-3.06a8.1 8.1 0 0 0-3-3.06l-28.6-16.29a90.5 90.5 0 0 1 0-28.26l28.52-16.28a8 8 0 0 0 3-3c.58-1 1.19-2.06 1.81-3.06a7.94 7.94 0 0 0 1.22-4.21l.15-32.25a95.9 95.9 0 0 1 25.37-14.3L122 56.87a8 8 0 0 0 4.1 1h3.64a8.1 8.1 0 0 0 4.1-1l28.84-16.1A96 96 0 0 1 188.12 55l.11 32.2a8 8 0 0 0 1.22 4.22c.62 1 1.23 2 1.8 3.06a8.1 8.1 0 0 0 3 3.06l28.6 16.29a90.5 90.5 0 0 1 .05 28.29Z"/>
                </svg>
            `,
            me: `
                <span class="wc-telegram-tab-avatar"><img src="${avatar}" onerror="this.onerror=null;this.src='${fallback}'" alt=""></span>
            `
        };
        return `<span class="wc-theme-tab-icon wc-telegram-tab-icon wc-telegram-tab-${key}">${icons[key] || icons.chat}</span>`;
    }
    if (theme.id !== 'wechat') {
        const iconClass = meta.icon || 'ri-circle-line';
        return `<i class="${iconClass} wc-theme-tab-icon"></i>`;
    }
    const unread = key === 'chat' ? getWechatThemeChatUnreadTotal() : 0;
    const badgeHtml = getWechatThemeUnreadBadgeHtml(unread);
    const icons = {
        chat: `
            <svg class="wc-wechat-tab-svg" viewBox="0 0 64 48" fill="none" aria-hidden="true">
                <path d="M31.5 4C17.2 4 5.8 12.7 5.8 23.5c0 6.4 4 12.1 10.2 15.6l-1.1 8.4 9.1-4.7c2.4.6 4.9.9 7.5.9 14.3 0 25.9-8.9 25.9-19.8C57.4 12.9 45.8 4 31.5 4Z" fill="currentColor"/>
            </svg>
        `,
        contacts: `
            <svg class="wc-wechat-tab-svg" viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 24.2c6.1 0 10.5-4.8 10.5-10.9C31.5 7.4 27.1 3 21 3S10.5 7.4 10.5 13.3c0 6.1 4.4 10.9 10.5 10.9Z"/>
                <path d="M4.8 44.4c2.1-9 8.5-14.5 16.2-14.5s14.1 5.5 16.2 14.5"/>
                <path d="M43 13h14"/>
                <path d="M43 24h11"/>
                <path d="M43 35h8"/>
            </svg>
        `,
        discover: `
            <svg class="wc-wechat-tab-svg" viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="32" cy="24" r="18"/>
                <path d="M41 14.4l-7.2 15.3-10.8 4 7.2-15.3 10.8-4Z"/>
            </svg>
        `,
        me: `
            <svg class="wc-wechat-tab-svg" viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M32 24.3c6.4 0 10.8-4.9 10.8-11S38.4 3 32 3 21.2 7.2 21.2 13.3s4.4 11 10.8 11Z"/>
                <path d="M14.5 44.4c2.2-9.2 9-14.6 17.5-14.6s15.3 5.4 17.5 14.6"/>
            </svg>
        `
    };
    return `<span class="wc-theme-tab-icon wc-wechat-tab-icon wc-wechat-tab-${key}">${icons[key] || icons.chat}${badgeHtml}</span>`;
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
    } else if (theme.id === 'claude') {
        if (headerLeftIcon) headerLeftIcon.className = 'ri-menu-line';
        if (headerLeftText) headerLeftText.textContent = '';
        if (headerRight) {
            headerRight.innerHTML = `
                <button type="button" class="wc-claude-header-compose" onclick="openWechatPlusMenu(event)" aria-label="New chat">
                    <i class="ri-add-line"></i>
                </button>
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
        const oldIcon = tab.querySelector('.wc-theme-tab-icon, svg');
        const iconHtml = getWechatThemeTabIconHtml(key, meta, theme);
        if (oldIcon) oldIcon.outerHTML = iconHtml;
        else tab.insertAdjacentHTML('afterbegin', iconHtml);
        const span = Array.from(tab.children).find(item => item.tagName === 'SPAN' && !item.classList.contains('wc-theme-tab-icon'));
        if (span) span.textContent = meta.label || key;
        const oldDouyinBadge = tab.querySelector('.wc-douyin-tab-unread');
        if (oldDouyinBadge) oldDouyinBadge.remove();
        if (theme.id === 'douyin' && key === 'discover') {
            const unread = getWechatThemeChatUnreadTotal();
            if (unread > 0) {
                const label = unread > 99 ? '99+' : String(unread);
                tab.insertAdjacentHTML('beforeend', `<b class="wc-douyin-tab-unread" aria-label="${label} unread messages">${label}</b>`);
            }
        }
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
    if (typeof syncWechatCoupleThemeHeader === 'function') syncWechatCoupleThemeHeader();
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
        <button type="button" onclick="closeApp('wechat')" aria-label="home"><i class="ri-arrow-left-line"></i></button>
        <button type="button" onclick="openWechatCurrentChatSearch()" aria-label="搜索消息"><i class="ri-search-line"></i></button>
        <button type="button" onclick="startWechatCall('voiceCall')" aria-label="通话"><i class="ri-phone-line"></i></button>
        <button type="button" onclick="openChatSettings()" aria-label="菜单"><i class="ri-menu-line"></i></button>
    `;
    header.classList.add('wc-line-room-header-ready');
}

function getWechatChatInputPlaceholder(themeId = getWechatUiThemeId()) {
    if (themeId === 'telegram') return '\u8f93\u5165\u6d88\u606f';
    if (themeId === 'claude') return 'Reply to Claude';
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
        .filter(char => char && !char.isGroupChat && !(typeof isWechatGroupNpcContact === 'function' && isWechatGroupNpcContact(char)))
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
            if (typeof isWechatRegexPayloadMessage === 'function' && isWechatRegexPayloadMessage(msg, char)) return;
            if (getWechatMessageTimestampValue(msg) > lastReadAt) count += 1;
        });
        return Math.min(99, count);
    }
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.type === 'system_notice') continue;
        if (msg.isMe) break;
        if (typeof isWechatRegexPayloadMessage === 'function' && isWechatRegexPayloadMessage(msg, char)) continue;
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
    const interactions = getWechatDouyinInteractions(1);
    return interactions[0] || null;
}

function getWechatDouyinInteractions(limit = 40) {
    const store = typeof getWechatMomentStore === 'function'
        ? getWechatMomentStore()
        : readWechatStore(WECHAT_MOMENTS_STORAGE_KEY, { posts: [] });
    const posts = Array.isArray(store.posts) ? store.posts : [];
    const interactions = [];
    const addInteraction = item => {
        if (!item || !item.createdAt) return;
        interactions.push(item);
    };
    posts.forEach(post => {
        const postText = stripWechatPromptText(post && post.text || '', 64) || ((post.images || []).length ? '[图片朋友圈]' : '朋友圈动态');
        (Array.isArray(post.comments) ? post.comments : []).forEach(comment => {
            if (!comment || comment.user) return;
            const createdAt = getWechatTimestampValue(comment.createdAt) || getWechatTimestampValue(post.createdAt) || Date.now();
            const name = comment.name || '好友';
            const text = stripWechatPromptText(comment.text || '', 42);
            addInteraction({
                id: comment.id || `comment_${post.id || createdAt}_${createdAt}`,
                postId: post.id || '',
                type: 'comment',
                createdAt,
                name,
                avatar: comment.avatar || DEFAULT_AVATAR,
                action: '评论了你的动态',
                text: text ? `${name}：${text}` : `${name} 评论了你的动态`,
                postText
            });
        });
        const likes = Array.isArray(post.likes) ? post.likes : (Array.isArray(post.reactions) ? post.reactions : []);
        likes.forEach(like => {
            if (!like || like.user) return;
            const createdAt = getWechatTimestampValue(like.createdAt || like.time) || getWechatTimestampValue(post.createdAt) || Date.now();
            const name = like.name || like.charName || '好友';
            addInteraction({
                id: like.id || `like_${post.id || createdAt}_${createdAt}`,
                postId: post.id || '',
                type: 'like',
                createdAt,
                name,
                avatar: like.avatar || DEFAULT_AVATAR,
                action: '赞了你的动态',
                text: `${name} 赞了你的动态`,
                postText
            });
        });
    });
    return interactions
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, Math.max(1, Number(limit) || 40));
}

function openWechatDouyinInteractions() {
    processWechatMomentQueue();
    const interactions = getWechatDouyinInteractions(80);
    openWechatFeatureScreen('互动消息', `
        <div class="wc-douyin-interaction-page">
            ${interactions.length ? interactions.map(item => `
                <button type="button" class="wc-douyin-interaction-row" onclick="openWechatMoments(${quoteWechatJsString(item.postId || '')})">
                    <img src="${wcEscapeHtml(item.avatar || DEFAULT_AVATAR)}" onerror="this.src='${DEFAULT_AVATAR}'">
                    <span>
                        <strong>${wcEscapeHtml(item.name || '好友')}</strong>
                        <em>${wcEscapeHtml(item.action || '互动了你的动态')}</em>
                        <small>${wcEscapeHtml(item.postText || '朋友圈动态')}</small>
                    </span>
                    <time>${formatMessageTime({ timestamp: item.createdAt })}</time>
                </button>
            `).join('') : '<div class="wc-discover-empty">还没有新的互动消息</div>'}
        </div>
    `);
}

function getWechatThemeHeroHtml(theme = getWechatUiTheme()) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const name = wcEscapeHtml(profile.name || '我');
    const avatar = wcEscapeHtml(profile.avatar || DEFAULT_AVATAR);
    const signatureText = String(profile.signature || '').trim();
    const signature = wcEscapeHtml(signatureText || '点击设置签名~');
    if (['rednote'].includes(theme.id)) return '';
    if (theme.id === 'qq') {
        return `
            <div class="wc-theme-hero-main">
                <button type="button" class="wc-theme-hero-back" onclick="closeApp('wechat')" aria-label="Back to desktop"><i class="ri-arrow-left-s-line"></i></button>
                <img class="wc-theme-hero-avatar" src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
                <button type="button" class="wc-theme-hero-user wc-theme-hero-edit" onclick="promptWechatMeField('signature')">
                    <strong>${name}</strong>
                    <span>♡ ${signature}</span>
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
                <div class="wc-theme-hero-user"><strong>消息</strong><span>${signatureText ? `${name} · ${signature}` : name}</span></div>
                <button type="button" class="wc-theme-hero-plus" onclick="openWechatPlusMenu(event)"><i class="ri-add-line"></i></button>
            </div>
            <div class="wc-theme-chip-row"><span>全部</span><span>评论</span><span>赞和收藏</span><span>新增关注</span></div>
        `;
    }
    if (theme.id === 'douyin') {
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
            <button type="button" class="wc-douyin-user-signature" onclick="promptWechatMeField('signature')">${signature}</button>
            <div class="wc-douyin-story-row">
                ${storyItems.map(item => `
                    <button type="button" class="wc-douyin-story">
                        <span><img src="${item.avatar}" onerror="this.src='${DEFAULT_AVATAR}'">${item.add ? '<b><i class="ri-add-line"></i></b>' : ''}</span>
                        <em>${item.label}</em>
                    </button>
                `).join('')}
            </div>
            ${interaction ? `<button type="button" class="wc-douyin-interaction-card" onclick="openWechatDouyinInteractions()">
                <div class="wc-douyin-interaction-icon"><i class="ri-messenger-fill"></i></div>
                <div>
                    <strong>互动消息</strong>
                    <span>${wcEscapeHtml(interaction.text || `${interaction.name} ${interaction.action}`)}</span>
                </div>
                <time>${formatMessageTime({ timestamp: interaction.createdAt })}</time>
            </button>` : ''}
        `;
    }
    if (theme.id === 'telegram') {
        return `
            <div class="wc-telegram-hero">
                <div class="wc-telegram-brand">
                    <div class="wc-telegram-title-row">
                        <button type="button" class="wc-telegram-desktop-back" onclick="closeApp('wechat')" aria-label="返回桌面"><i class="ri-arrow-left-s-line"></i></button>
                        <strong>Telegram</strong>
                    </div>
                    <button type="button" class="wc-telegram-more" onclick="openWechatPlusMenu(event)" aria-label="更多"><i class="ri-more-2-fill"></i></button>
                </div>
                <div class="wc-telegram-floating-actions">
                    <button type="button" class="wc-telegram-float-camera" onclick="triggerCamera()" aria-label="相机">
                        <svg class="wc-telegram-float-svg wc-telegram-float-camera-svg" viewBox="0 0 256 256" aria-hidden="true">
                            <path fill="currentColor" d="M208 56h-27.72l-13.63-20.44A8 8 0 0 0 160 32H96a8 8 0 0 0-6.65 3.56L75.71 56H48a24 24 0 0 0-24 24v112a24 24 0 0 0 24 24h160a24 24 0 0 0 24-24V80a24 24 0 0 0-24-24m8 136a8 8 0 0 1-8 8H48a8 8 0 0 1-8-8V80a8 8 0 0 1 8-8h32a8 8 0 0 0 6.66-3.56L100.28 48h55.43l13.63 20.44A8 8 0 0 0 176 72h32a8 8 0 0 1 8 8ZM128 88a44 44 0 1 0 44 44a44.05 44.05 0 0 0-44-44m0 72a28 28 0 1 1 28-28a28 28 0 0 1-28 28"/>
                        </svg>
                    </button>
                    <button type="button" class="wc-telegram-float-compose" onclick="openWechatPlusMenu(event)" aria-label="新聊天">
                        <svg class="wc-telegram-float-svg wc-telegram-float-message-add-svg" viewBox="0 0 64 64" aria-hidden="true">
                            <g transform="translate(32 32) scale(1.22) translate(-32 -32)">
                                <path class="wc-telegram-message-add-bubble" d="M32 10.5a21.5 21.5 0 0 0-12.1 39.3l-3.2 7.3c-.4.9.5 1.8 1.4 1.4l7.4-3.3A21.5 21.5 0 1 0 32 10.5Z"/>
                                <path class="wc-telegram-message-add-plus" d="M32 20.8v18.4M22.8 30h18.4"/>
                            </g>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
    if (theme.id === 'line') {
        const chars = getWechatGroupContacts({ includeGroupNpc: false });
        const unreadTotal = chars.reduce((sum, char) => sum + getTelegramChatUnreadCount(char), 0);
        const lineStatus = signatureText ? `${name} · ${signature}` : name;
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
                <span><strong>今天有 ${chars.length || 0} 位好友在列表中</strong><em>${unreadTotal > 0 ? `${unreadTotal} 条新消息等你查看` : lineStatus}</em></span>
                <b>LINE</b>
            </button>
        `;
    }
    if (theme.id === 'claude') return '';
    if (theme.id === 'hallowrok') {
        const hasInbox = getWechatGroupContacts({ includeGroupNpc: false }).length > 0 || (window.myCharacters || []).some(char => char && char.isGroupChat);
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
    if (typeof getCurrentChatChar === 'function' && typeof refreshChatView === 'function') {
        const currentChar = getCurrentChatChar();
        if (currentChar) refreshChatView(currentChar);
    }
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
