// --- 🟢 wechat.js: 核心数据源 & 微信 App 逻辑 ---

// 1. 全局数据中心 (所有 App 共用)
window.myCharacters = window.myCharacters || [];
window.TEMP_PARSED_DATA = null;
window.currentChatCharId = null;

const DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="100" fill="#f0f0f0"/><circle cx="100" cy="85" r="35" fill="#ccc"/><ellipse cx="100" cy="160" rx="50" ry="35" fill="#ccc"/></svg>');
window.DEFAULT_AVATAR = DEFAULT_AVATAR;

function isWechatRealAvatarSource(value) {
    if (typeof value !== 'string') return false;
    const src = value.trim();
    return !!src && src !== DEFAULT_AVATAR && src !== 'undefined' && src !== 'null';
}

function getWechatFirstRealAvatarSource(...sources) {
    for (const source of sources) {
        if (Array.isArray(source)) {
            const found = getWechatFirstRealAvatarSource(...source);
            if (isWechatRealAvatarSource(found)) return found;
        } else if (isWechatRealAvatarSource(source)) {
            return source.trim();
        }
    }
    return '';
}

function getWechatCharAvatarSource(char, fallback = DEFAULT_AVATAR) {
    if (!char) return fallback || DEFAULT_AVATAR;
    const config = char.chatConfig || {};
    const avatar = getWechatFirstRealAvatarSource(
        char.avatar,
        char._smallAvatar,
        char.avatarGallery,
        config.avatar,
        config.profileAvatar,
        config.imageReference
    );
    if (avatar) return avatar;
    if (char.isGroupChat && typeof buildWechatGroupAvatar === 'function') {
        return buildWechatGroupAvatar(char) || fallback || DEFAULT_AVATAR;
    }
    return fallback || DEFAULT_AVATAR;
}
window.getWechatCharAvatarSource = getWechatCharAvatarSource;

function normalizeWechatCharacterAvatarData(char) {
    if (!char || typeof char !== 'object') return char;
    if (Array.isArray(char.avatarGallery)) {
        char.avatarGallery = char.avatarGallery.filter(isWechatRealAvatarSource);
    } else {
        char.avatarGallery = [];
    }
    const avatar = getWechatCharAvatarSource(char, '');
    if (avatar) char.avatar = avatar;
    return char;
}

const WECHAT_QQ_GROUP_USER_ID = '__wechat_qq_group_user__';
window.WECHAT_QQ_GROUP_USER_ID = WECHAT_QQ_GROUP_USER_ID;
const WECHAT_AUTO_COLLAPSE_AFTER = 56;
const WECHAT_COLLAPSE_KEEP_RECENT = 32;
const WECHAT_MEMORY_STORAGE_KEY = 'wechat_memory_store';
const WECHAT_MEMORY_DEFAULTS = {
    segmentLimit: 8,
    longTermLimit: 8,
    keepRecent: 5,
    extractEvery: 4
};
const WECHAT_AI_STATUS_AUTO_REFRESH_COOLDOWN_MS = 3 * 60 * 1000;
const WECHAT_AI_STATUS_AUTO_RETRY_COOLDOWN_MS = 90 * 1000;
const WECHAT_HISTORY_REPAIR_SCHEMA_VERSION = '20260613-narration-regex-split1';
const WECHAT_MOMENTS_STORAGE_KEY = 'wechat_moments_store';
const WECHAT_CHAR_MOMENT_ACTIVITY_KEY = 'wechat_char_moment_activity_v1';
const WECHAT_VIDEO_STORAGE_KEY = 'wechat_video_state';
const WECHAT_LIVE_STORAGE_KEY = 'wechat_live_state';
const WECHAT_CHARACTERS_STORAGE_KEY = 'my_characters_data';
const WECHAT_CHARACTERS_META_KEY = 'my_characters_data_meta';
const WECHAT_CHARACTERS_DB_NAME = 'XuexiCharactersDB';
const WECHAT_CHARACTERS_DB_STORE = 'characters';
const WECHAT_CHARACTERS_DB_KEY = 'full';
const WECHAT_SHOP_STORAGE_KEY = 'wechat_shop_store';
const WECHAT_TAKEOUT_STORAGE_KEY = 'wechat_takeout_store';
const WECHAT_SHOP_AGGREGATE_SOURCE_ID = 'bynd-aggregate';
const WECHAT_SHOP_AGGREGATE_SOURCES = [
    { id: 'dummyjson', name: 'DummyJSON', url: 'https://dummyjson.com/products/search?q={q}&limit=24' },
    { id: 'fakestore', name: 'Fake Store', url: 'https://fakestoreapi.com/products' }
];
const WECHAT_FAVORITES_STORAGE_KEY = 'wechat_favorites_store';
// WeChat UI theme definitions are loaded from apps/wechat/ui/ui-theme.js.

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

