// The existing toolbar becomes a permanent, scrollable row in this theme.
// Keep its handlers and restore its original DOM position when leaving the theme.
const WECHAT_PIXEL_TOOL_ICONS = {
    'AI回复': 'ai', '表情': 'sticker', '语音': 'voice', '转账': 'transfer',
    '红包': 'redpacket', '视频通话': 'video', '语音通话': 'call', '拍照': 'camera',
    '图片': 'image', '拍一拍': 'poke', '震动': 'dinosaur', '音乐': 'player',
    '共享屏幕': 'screen', '贴纸管理': 'manager', '记忆': 'memory'
};
let wechatPixelToolbarHome = null;
const wechatPixelToolAccessibility = new WeakMap();

function syncWechatPixelTheme(theme) {
    const room = document.getElementById('wechat-chat-room');
    const footer = room?.querySelector('.wc-room-footer');
    const toolbar = document.getElementById('wc-chat-toolbar');
    if (!footer || !toolbar) return;
    const active = theme.id === 'pixel';
    if (active) {
        if (!wechatPixelToolbarHome) wechatPixelToolbarHome = { parent: toolbar.parentNode, next: toolbar.nextSibling };
        if (toolbar.parentNode !== footer) {
            toolbar.classList.add('hidden');
            footer.prepend(toolbar);
            room.classList.remove('wc-toolbar-open');
            footer.querySelector('.wc-add-btn')?.classList.remove('is-open');
        }
        toolbar.querySelectorAll('.wc-toolbar-item').forEach(item => {
            const label = item.querySelector('span')?.textContent.trim();
            const icon = WECHAT_PIXEL_TOOL_ICONS[label];
            if (icon && !item.querySelector('.wc-pixel-icon')) {
                const img = document.createElement('img');
                img.className = 'wc-pixel-icon';
                img.src = `assets/ui/pixel-chat/${icon}.svg`;
                img.alt = '';
                img.draggable = false;
                item.querySelector('.wc-toolbar-icon')?.append(img);
            }
            if (!wechatPixelToolAccessibility.has(item)) {
                wechatPixelToolAccessibility.set(item, {
                    role: item.getAttribute('role'), tabindex: item.getAttribute('tabindex'), label: item.getAttribute('aria-label')
                });
                item.addEventListener('keydown', event => {
                    if (document.getElementById('app-wechat-window')?.dataset.uiTheme !== 'pixel') return;
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.click(); }
                });
            }
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            item.setAttribute('aria-label', label);
        });
        let avatar = footer.querySelector('.wc-pixel-user-avatar');
        if (!avatar) {
            avatar = document.createElement('img');
            avatar.className = 'wc-pixel-user-avatar';
            avatar.alt = '';
            footer.append(avatar);
        }
        const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
        avatar.src = profile?.avatar || (typeof DEFAULT_AVATAR !== 'undefined' ? DEFAULT_AVATAR : '');
    } else {
        if (wechatPixelToolbarHome && toolbar.parentNode === footer) {
            wechatPixelToolbarHome.parent.insertBefore(toolbar, wechatPixelToolbarHome.next);
            toolbar.classList.add('hidden');
        }
        toolbar.querySelectorAll('.wc-toolbar-item').forEach(item => {
            const original = wechatPixelToolAccessibility.get(item);
            if (!original) return;
            for (const [key, value] of Object.entries({ role: original.role, tabindex: original.tabindex, 'aria-label': original.label })) {
                if (value === null) item.removeAttribute(key); else item.setAttribute(key, value);
            }
        });
    }
}

function getWechatPixelStickerPack() {
    return {
        id: 'pack_pixel_builtin', name: '像素兔', builtin: true,
        stickers: WECHAT_PIXEL_STICKERS.map(([id, name]) => ({
            id: `pixel_${id}`, name, url: `assets/ui/pixel-chat/stickers/${id}.svg`,
            builtin: true, packName: '像素兔'
        }))
    };
}

const WECHAT_PIXEL_STICKERS = [
    ['magic-wand', '魔法棒'], ['bunny-hello', '你好'], ['heart-cookie', '爱心饼干'], ['wing-right', '小翅膀'],
    ['bunny-playful', '调皮'], ['bunny-round', '乖巧'], ['angel-heart', '天使爱心'], ['bunny-wink', '眨眼'],
    ['sun-wand', '星光魔法'], ['bunny-cry', '哭哭'], ['broken-heart', '心碎'], ['bunny-shining', '星星眼'],
    ['heart-sparkles', '心动'], ['bunny-headphones', '听歌'], ['bunny-sleepy', '困困'], ['music-notes', '音乐'],
    ['bunny-mask', '口罩'], ['angry-marks', '生气'], ['bunny-bow', '鞠躬'], ['heart-arrow', '爱心箭'],
    ['bunny-shy', '害羞'], ['floating-hearts', '喜欢你'], ['bunny-cool', '酷酷'], ['lucky-cards', '好运'],
    ['bunny-tongue', '吐舌'], ['wing-left', '飞飞'], ['beer', '干杯'], ['bunny-dizzy', '晕晕'],
    ['diamonds', '闪闪'], ['bunny-scratched', '受伤'], ['three-dots', '省略号'], ['hug-circle', '抱抱'],
    ['bunny-propeller', '起飞'], ['heart-hug', '爱心抱抱'], ['little-cheer', '开心'], ['bunny-alert', '注意'],
    ['bunny-embarrassed', '脸红'], ['bunny-question', '怎么了'], ['double-exclamation', '惊叹'], ['double-question', '疑惑']
];
