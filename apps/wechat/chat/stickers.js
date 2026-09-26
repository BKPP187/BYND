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

const WECHAT_INPUT_EMOJI_MAP = {
    '微笑': '🙂',
    '撇嘴': '😒',
    '色': '😍',
    '发呆': '😳',
    '得意': '😎',
    '流泪': '😢',
    '害羞': '😊',
    '闭嘴': '🤐',
    '睡': '😴',
    '大哭': '😭',
    '尴尬': '😅',
    '发怒': '😡',
    '调皮': '😜',
    '呲牙': '😁',
    '惊讶': '😮',
    '难过': '😞',
    '囧': '😓',
    '抓狂': '😫',
    '吐': '🤮',
    '偷笑': '🤭',
    '愉快': '😄',
    '白眼': '🙄',
    '傲慢': '😤',
    '困': '😪',
    '惊恐': '😱',
    '憨笑': '😆',
    '悠闲': '😌',
    '咒骂': '😠',
    '疑问': '🤔',
    '嘘': '🤫',
    '晕': '😵',
    '衰': '😩',
    '骷髅': '💀',
    '敲打': '🔨',
    '再见': '👋',
    '擦汗': '😅',
    '抠鼻': '🤧',
    '鼓掌': '👏',
    '坏笑': '😏',
    '鄙视': '😒',
    '委屈': '🥺',
    '快哭了': '🥹',
    '阴险': '😈',
    '亲亲': '😘',
    '可怜': '🥺',
    '笑脸': '😃',
    '生病': '🤒',
    '脸红': '☺️',
    '破涕为笑': '😂',
    '恐惧': '😨',
    '失望': '😞',
    '无语': '😑',
    '嘿哈': '😆',
    '捂脸': '🤦',
    '奸笑': '😏',
    '机智': '😉',
    '皱眉': '🙁',
    '耶': '✌️',
    '吃瓜': '🍉',
    '加油': '💪',
    '汗': '💦',
    '天啊': '😲',
    '爱心': '❤️',
    '心碎': '💔',
    '拥抱': '🤗',
    '强': '👍',
    '弱': '👎',
    '握手': '🤝',
    '胜利': '✌️',
    '抱拳': '🙏',
    '拳头': '👊',
    'OK': '👌',
    '合十': '🙏',
    '啤酒': '🍺',
    '咖啡': '☕',
    '蛋糕': '🎂',
    '玫瑰': '🌹',
    '凋谢': '🥀',
    '菜刀': '🔪',
    '炸弹': '💣',
    '便便': '💩',
    '月亮': '🌙',
    '太阳': '☀️',
    '庆祝': '🎉',
    '礼物': '🎁',
    '红包': '🧧',
    '福': '福',
    '烟花': '🎆',
    '爆竹': '🧨',
    '猪头': '🐷'
};

function getWechatBuiltinEmojiName(fileName) {
    return String(fileName || '').replace(/^\d+_/, '').replace(/\.[^.]+$/, '');
}

function getWechatBuiltinEmojiUrl(fileName) {
    return WECHAT_BUILTIN_EMOJI_BASE_URL + encodeURIComponent(fileName);
}

function getWechatBuiltinEmojiFileByName(name) {
    const target = getWechatBuiltinEmojiAliasName(name);
    if (!target) return '';
    return WECHAT_BUILTIN_EMOJI_FILES.find(fileName => getWechatBuiltinEmojiName(fileName) === target) || '';
}

function getWechatBuiltinEmojiUrlByName(name) {
    const fileName = getWechatBuiltinEmojiFileByName(name);
    return fileName ? getWechatBuiltinEmojiUrl(fileName) : '';
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

function getQqBuiltinEmojiFileByName(name) {
    const target = String(name || '').trim();
    if (!target) return '';
    return QQ_BUILTIN_EMOJI_FILES.find(fileName => {
        const raw = String(fileName || '').replace(/\.[^.]+$/, '');
        return getQqBuiltinEmojiName(fileName) === target
            || raw === target
            || getQqBuiltinEmojiKey(fileName) === target
            || getQqBuiltinEmojiAliases(fileName).includes(target);
    }) || '';
}

function getQqBuiltinEmojiUrlByName(name) {
    const fileName = getQqBuiltinEmojiFileByName(name);
    return fileName ? getQqBuiltinEmojiUrl(fileName) : '';
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

function getWechatBuiltinEmojiSourceFromUrl(url) {
    const value = String(url || '');
    if (value.includes('/qiuyinghua/wechat-emoticons@master/images/')
        || value.includes('/qiuyinghua/wechat-emoticons/master/images/')
        || value.includes('raw.githubusercontent.com/qiuyinghua/wechat-emoticons/master/images/')) {
        return 'qq';
    }
    if (value.includes('/airinghost/wechat-emoji@main/web.wechat.com/compressed-tinypng/')
        || value.includes('/airinghost/wechat-emoji/main/web.wechat.com/compressed-tinypng/')) {
        return 'wechat';
    }
    return getWechatActiveBuiltinEmojiSource();
}

function renderWechatBuiltinEmojiMarkersHtml(html) {
    return String(html || '').replace(/\[\[(WECHAT_EMOJI|QQ_EMOJI):([^:\]]+)(?::([^\]]+))?\]\]/g, (match) => {
        const parsed = parseWechatBuiltinEmojiMarker(match);
        if (!parsed || !parsed.name) return '';
        const url = parsed.url || (parsed.source === 'qq'
            ? getQqBuiltinEmojiUrlByName(parsed.name)
            : getWechatBuiltinEmojiUrlByName(parsed.name));
        if (!url) return '';
        const label = parsed.source === 'qq' ? parsed.name : getWechatBuiltinEmojiAliasName(parsed.name);
        return `<img class="wc-inline-wechat-emoji" src="${wcEscapeHtml(url)}" alt="[${wcEscapeHtml(label)}]" title="${wcEscapeHtml(label)}" loading="lazy" draggable="false">`;
    });
}

function renderWechatChatPreviewHtml(text) {
    return renderWechatBuiltinEmojiMarkersHtml(escapeHtml(text));
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
const WECHAT_GIPHY_PACK_ID = 'pack_giphy_proxy_trending';
const WECHAT_GIPHY_PROXY_URL = 'https://bynd.ccwu.cc/mcp/relay/giphy';
const WECHAT_GIPHY_FALLBACK_QUERIES = ['cute', 'happy', 'cat', 'love', 'dog', 'anime'];
const WECHAT_GIPHY_CN_QUERY_RULES = [
    { re: /可爱|萌|软萌|乖|奶|甜|治愈/, term: 'cute' },
    { re: /开心|高兴|快乐|笑|哈哈|嘻嘻|嘿嘿|乐|好耶/, term: 'happy' },
    { re: /难过|伤心|委屈|沮丧|失落|心碎|emo|破防|可怜/, term: 'sad' },
    { re: /哭|流泪|眼泪|泪|大哭/, term: 'crying' },
    { re: /生气|愤怒|怒|气死|炸毛|哼|不爽|烦/, term: 'angry' },
    { re: /害羞|脸红|羞|不好意思|心动/, term: 'shy' },
    { re: /爱|喜欢|恋爱|比心|爱心|心心|贴贴/, term: 'love' },
    { re: /亲|亲亲|啵|啵啵|吻/, term: 'kiss' },
    { re: /抱|抱抱|拥抱|安慰/, term: 'hug' },
    { re: /困|累|疲惫|睡|睡觉|晚安/, term: 'tired' },
    { re: /震惊|惊讶|惊|吓|害怕|恐惧/, term: 'shocked' },
    { re: /尴尬|无语|沉默|冷漠|嫌弃|白眼/, term: 'awkward' },
    { re: /加油|冲|努力|打气|鼓励/, term: 'cheer' },
    { re: /谢谢|感谢|感恩/, term: 'thank you' },
    { re: /早安|早上好/, term: 'good morning' },
    { re: /晚安|睡了/, term: 'good night' },
    { re: /拜拜|再见|溜了/, term: 'bye' },
    { re: /可以|好的|收到|ok|OK|嗯嗯/, term: 'ok' },
    { re: /吃瓜|看戏|围观/, term: 'popcorn' },
    { re: /喝茶|奶茶|咖啡/, term: 'tea' },
    { re: /跳舞|蹦迪|摇摆/, term: 'dancing' },
    { re: /鼓掌|拍手|厉害|棒/, term: 'clapping' },
    { re: /生日|蛋糕|庆祝/, term: 'birthday' },
    { re: /(^|[^熊])(?:猫|猫猫|小猫|喵|咪)/, term: 'cat' },
    { re: /狗|狗狗|小狗|汪|柴犬|修勾|小狗狗/, term: 'dog' },
    { re: /兔|兔子|小兔/, term: 'bunny' },
    { re: /熊猫|熊猫头/, term: 'panda' },
    { re: /小熊|熊(?!猫)/, term: 'bear' },
    { re: /青蛙|蛙/, term: 'frog' },
    { re: /鸭|鸭鸭|小鸭/, term: 'duck' },
    { re: /仓鼠|鼠鼠|老鼠/, term: 'hamster' },
    { re: /猪|小猪/, term: 'pig' },
    { re: /宝宝|宝贝|崽|小孩/, term: 'baby' },
    { re: /动漫|二次元|动画|番/, term: 'anime' },
    { re: /搞笑|好笑|沙雕|抽象|魔性|发疯/, term: 'funny' },
    { re: /表情包|梗|梗图|meme/, term: 'meme' }
];

function getStickerPacks() {
    try {
        const raw = localStorage.getItem(STICKER_STORAGE_KEY);
        if (raw) return withWechatBuiltinEmojiPack(ensureDefaultStickerPacks(stripWechatBuiltinStickerPacks(JSON.parse(raw))));
    } catch (e) {}
    return withWechatBuiltinEmojiPack(ensureDefaultStickerPacks({ packs: [] }));
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
            aliases: Array.isArray(sticker.aliases) ? sticker.aliases : [],
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

function normalizeWechatStickerLookupName(value) {
    return String(value || '')
        .trim()
        .replace(/^["'“”‘’「『《【\[]+|["'“”‘’」』》】\]]+$/g, '')
        .replace(/\.(?:png|jpe?g|gif|webp)$/i, '')
        .replace(/\s+/g, '')
        .toLowerCase();
}

function getWechatStickerUrlBasename(url) {
    try {
        const pathname = new URL(String(url || '')).pathname || '';
        return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
    } catch (_) {
        const raw = String(url || '').split('?')[0];
        return decodeURIComponent(raw.split('/').filter(Boolean).pop() || '');
    }
}

function findWechatExactStickerByName(char, query) {
    const normalized = normalizeWechatStickerLookupName(query);
    if (!normalized) return null;
    return getWechatAvailableStickers(char).find(sticker => {
        const names = [
            sticker.name,
            sticker.id,
            getWechatStickerUrlBasename(sticker.url),
            ...(Array.isArray(sticker.aliases) ? sticker.aliases : [])
        ];
        return names.some(name => normalizeWechatStickerLookupName(name) === normalized);
    }) || null;
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
    const all = getWechatAvailableStickers(char);
    // Sample every pack, then rank by the current conversation. A fixed first-40
    // slice starved later packs and never told the model what they contained.
    const recent = (char?.history || []).slice(-4).map(msg => String(msg.stickerName || msg.content || '').slice(0, 160)).join(' ');
    const ranked = all.map((item, index) => ({ item, index, score: scoreWechatStickerMatch(item, recent) }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
    const stickers = [];
    const add = item => { if (item && stickers.length < 40 && !stickers.includes(item)) stickers.push(item); };
    ranked.filter(entry => entry.score >= 14).slice(0, 16).forEach(entry => add(entry.item));
    const packs = new Map();
    all.forEach(item => { const key = item.packName || item.source || '贴纸'; if (!packs.has(key)) packs.set(key, []); packs.get(key).push(item); });
    const offset = hashWechatStickerQuery(`${char?.id || ''}:${recent}`);
    for (let round = 0; round < 40 && stickers.length < Math.min(40, all.length); round++) {
        packs.forEach(items => { if (round < items.length) add(items[(offset + round) % items.length]); });
    }
    if (!stickers.length) return '';
    const lines = stickers.map(item => {
        const source = item.source === 'worldBook' ? '世界书' : item.packName;
        return `- ${item.name}${item.aliases?.length ? ' / ' + item.aliases.slice(0, 3).join('、') : ''}（${source}）`;
    });
    const omitted = all.length > stickers.length ? `\n- 另有更多贴纸未展开，可以按情绪选择。` : '';
    return `【微信贴纸上下文】以下是可实际发送的内置、用户贴纸包和世界书贴纸。请按自己的人设和当前心情主动使用：接梗、撒娇、吃醋、安慰、回应用户表情时，可以配一张贴切的表情，不必等用户要求；严肃对话以文字为主，不强制每轮发送或连续刷同一张。发贴纸时作为独立消息段输出，例如：好，抱一下。|||[微信表情:抱抱]。使用格式 [微信表情:贴纸名或情绪]；不要只用文字描述“发了一个表情包”。如果世界书给了 postimg 链接，也可以输出 [微信表情:贴纸名|图片URL]。\n${lines.join('\n')}${omitted}`;
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

function buildLocalStickerList() {
    const share = window.BYND_LOCAL_STICKER_SHARE;
    const stickers = Array.isArray(share?.stickers) ? share.stickers : [];
    return stickers.map(item => ({
        id: 'stk_local_' + item.id,
        name: item.name || '本地表情',
        aliases: item.aliases || [],
        url: item.url
    })).filter(item => item.url);
}

function mergeStickerSharePack(data, options) {
    data = data && typeof data === 'object' ? data : { packs: [] };
    data.packs = Array.isArray(data.packs) ? data.packs : [];
    const stickers = Array.isArray(options?.stickers) ? options.stickers : [];
    const packId = options?.packId || '';
    const packName = options?.packName || '贴纸包';
    const replaceStickers = !!options?.replaceStickers;
    if (!packId || !stickers.length) return data;
    let pack = data.packs.find(item => item.id === packId) || data.packs.find(item => item.name === packName);
    if (!pack) {
        pack = {
            id: packId,
            name: packName,
            total: Number(options.total) || stickers.length,
            stickers
        };
        data.packs.unshift(pack);
        saveStickerPacks(data);
        return data;
    }
    pack.stickers = Array.isArray(pack.stickers) ? pack.stickers : [];
    if (replaceStickers) {
        let removedDuplicate = false;
        data.packs = data.packs.filter(item => {
            const keep = item === pack || (item.id !== packId && item.name !== packName);
            if (!keep) removedDuplicate = true;
            return keep;
        });
        const sameMeta = pack.name === packName && Number(pack.total) === (Number(options.total) || stickers.length);
        const sameStickers = pack.stickers.length === stickers.length && pack.stickers.every((item, index) => {
            const next = stickers[index];
            return item && next && item.id === next.id && item.name === next.name && item.url === next.url;
        });
        if (!sameMeta || !sameStickers || removedDuplicate) {
            pack.id = packId;
            pack.name = packName;
            pack.total = Number(options.total) || stickers.length;
            pack.stickers = stickers;
            saveStickerPacks(data);
        }
        return data;
    }
    const stickerById = new Map(stickers.map(item => [String(item.id || ''), item]));
    const stickerByName = new Map(stickers.map(item => [String(item.name || ''), item]));
    let changed = false;
    pack.stickers = pack.stickers.map(item => {
        const next = stickerById.get(String(item.id || '')) || stickerByName.get(String(item.name || ''));
        if (next && (item.url !== next.url || item.name !== next.name || item.id !== next.id || JSON.stringify(item.aliases || []) !== JSON.stringify(next.aliases || []))) {
            changed = true;
            return { ...item, ...next };
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
    const existingUrls = new Set(pack.stickers.map(item => item.url));
    const fresh = stickers.filter(item => !existingUrls.has(item.url));
    if (fresh.length) {
        pack.stickers.push(...fresh);
        changed = true;
    }
    pack.total = Math.max(Number(pack.total) || 0, Number(options.total) || stickers.length, pack.stickers.length);
    if (changed) saveStickerPacks(data);
    return data;
}

function ensureDefaultBoltpStickerPack(data) {
    const share = window.BYND_BOLTP_STICKER_SHARE;
    const stickers = buildBoltpStickerList();
    if (!share || !stickers.length) return data;
    return mergeStickerSharePack(data, {
        packId: 'pack_boltp_26c3884813ed4f4999b78e49d448f2e6',
        packName: share.name || '图床贴纸包',
        total: share.total,
        stickers
    });
}

function ensureDefaultLocalStickerPack(data) {
    const share = window.BYND_LOCAL_STICKER_SHARE;
    const stickers = buildLocalStickerList();
    if (!share || !stickers.length) return data;
    return mergeStickerSharePack(data, {
        packId: 'pack_local_biaoqingbao_20260530',
        packName: share.name || '表情包',
        total: share.total,
        stickers,
        replaceStickers: true
    });
}

function ensureDefaultStickerPacks(data) {
    return ensureDefaultLocalStickerPack(ensureDefaultBoltpStickerPack(data));
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

function getWechatGiphyState() {
    window._wechatGiphyState = window._wechatGiphyState || {
        query: '',
        translatedQuery: '',
        translationHint: '',
        items: [],
        loading: false,
        loaded: false,
        error: ''
    };
    return window._wechatGiphyState;
}

function hasWechatChineseText(value) {
    return /[\u3400-\u9fff]/.test(String(value || ''));
}

function buildWechatGiphySearchQuery(query = '') {
    const raw = String(query || '').trim();
    if (!raw) return { input: '', query: '', hint: '' };
    if (!hasWechatChineseText(raw)) return { input: raw, query: raw, hint: '' };

    const terms = [];
    const addTerm = (term) => {
        const clean = String(term || '').trim().toLowerCase();
        if (clean && !terms.includes(clean)) terms.push(clean);
    };
    WECHAT_GIPHY_CN_QUERY_RULES.forEach(rule => {
        if (rule.re.test(raw)) addTerm(rule.term);
    });
    const asciiWords = raw.match(/[A-Za-z0-9][A-Za-z0-9_-]{1,24}/g) || [];
    asciiWords.forEach(addTerm);
    if (!terms.length) addTerm('cute');
    if (terms.length === 1 && ['cat', 'dog', 'bunny', 'panda', 'bear', 'frog', 'duck', 'hamster', 'pig', 'baby'].includes(terms[0])) {
        terms.unshift('cute');
    }
    const searchQuery = terms.slice(0, 4).join(' ');
    return {
        input: raw,
        query: searchQuery,
        hint: searchQuery && searchQuery !== raw.toLowerCase() ? `已转英文搜索：${searchQuery}` : ''
    };
}

function normalizeWechatGiphyItems(items) {
    return (Array.isArray(items) ? items : []).map(item => ({
        id: String(item?.id || ''),
        name: String(item?.title || 'GIPHY Sticker').trim() || 'GIPHY Sticker',
        url: String(item?.url || item?.preview || ''),
        preview: String(item?.preview || item?.url || ''),
        source: 'giphy'
    })).filter(item => item.url);
}

async function requestWechatGiphyItems(query = '') {
    const q = String(query || '').trim();
    const endpoint = q ? '/stickers/search' : '/stickers/trending';
    const url = new URL(WECHAT_GIPHY_PROXY_URL + endpoint);
    url.searchParams.set('limit', '30');
    if (q) url.searchParams.set('q', q);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`GIPHY ${res.status}`);
    const data = await res.json();
    return normalizeWechatGiphyItems(data && data.items);
}

async function loadWechatGiphyStickers(query = '') {
    const state = getWechatGiphyState();
    const q = String(query || '').trim();
    const search = buildWechatGiphySearchQuery(q);
    state.query = q;
    state.translatedQuery = search.query;
    state.translationHint = search.hint;
    state.loading = true;
    state.loaded = true;
    state.error = '';
    renderWechatGiphyPicker();
    try {
        let items = await requestWechatGiphyItems(search.query);
        if (!q && !items.length) {
            for (const fallback of WECHAT_GIPHY_FALLBACK_QUERIES) {
                items = await requestWechatGiphyItems(fallback);
                if (items.length) break;
            }
        } else if (q && hasWechatChineseText(q) && !items.length && search.query !== 'cute') {
            items = await requestWechatGiphyItems('cute');
        }
        state.items = items;
        state.error = items.length ? '' : '暂时没有搜到表情包';
    } catch (e) {
        console.warn('GIPHY stickers failed:', e);
        state.items = [];
        state.error = 'GIPHY 表情加载失败，稍后再试';
    } finally {
        state.loading = false;
        renderWechatGiphyPicker();
    }
}

function renderWechatGiphyPicker() {
    const gridEl = document.getElementById('wc-sticker-grid');
    if (!gridEl || window._activeStickerPackId !== WECHAT_GIPHY_PACK_ID) return;
    const state = getWechatGiphyState();
    const chips = [
        { label: '热门', query: '' },
        { label: '可爱', query: 'cute' },
        { label: '猫猫', query: 'cat' },
        { label: '开心', query: 'happy' },
        { label: '狗狗', query: 'dog' },
        { label: '爱心', query: 'love' }
    ];
    const query = wcEscapeHtml(state.query || '');
    const translatedHint = state.translationHint
        ? `<div class="wc-giphy-query-hint">${wcEscapeHtml(state.translationHint)}</div>`
        : '';
    const body = state.loading || !state.loaded
        ? '<div class="wc-giphy-empty"><i class="ri-loader-4-line"></i><span>正在加载 GIPHY 表情...</span></div>'
        : state.error
            ? `<div class="wc-giphy-empty"><i class="ri-emotion-sad-line"></i><span>${wcEscapeHtml(state.error)}</span></div>`
            : `<div class="wc-giphy-results">
                ${state.items.map(item => `
                    <button type="button" class="wc-giphy-item" onclick="sendSticker(${quoteWechatJsString(item.url)}, ${quoteWechatJsString(item.name)}, false)">
                        <img src="${wcEscapeHtml(item.preview || item.url)}" alt="${wcEscapeHtml(item.name)}" loading="lazy" onerror="this.closest('.wc-giphy-item')?.classList.add('is-broken')">
                    </button>
                `).join('')}
            </div>`;
    gridEl.classList.remove('wc-emoji-grid');
    gridEl.classList.add('wc-giphy-panel');
    gridEl.innerHTML = `
        <div class="wc-giphy-search">
            <i class="ri-search-line"></i>
            <input id="wc-giphy-search-input" value="${query}" placeholder="输入中文也可以，比如委屈猫猫" onkeydown="if(event.key==='Enter') searchWechatGiphyFromInput()">
            <button type="button" onclick="searchWechatGiphyFromInput()">搜索</button>
        </div>
        ${translatedHint}
        <div class="wc-giphy-chip-row">
            ${chips.map(chip => `<button type="button" class="${state.query === chip.query ? 'active' : ''}" onclick="loadWechatGiphyStickers(${quoteWechatJsString(chip.query)})">${wcEscapeHtml(chip.label)}</button>`).join('')}
        </div>
        ${body}
        <div class="wc-giphy-attribution">Powered by GIPHY</div>
    `;
}

function searchWechatGiphyFromInput() {
    const input = document.getElementById('wc-giphy-search-input');
    loadWechatGiphyStickers(input ? input.value : '');
}

function renderStickerPicker() {
    const data = getStickerPacks();
    const tabsEl = document.getElementById('wc-sticker-tabs');
    const gridEl = document.getElementById('wc-sticker-grid');
    if (!tabsEl || !gridEl) return;

    const packs = Array.isArray(data.packs) ? data.packs : [];
    const pickerPacks = [...packs, { id: WECHAT_GIPHY_PACK_ID, name: 'GIPHY', giphy: true }];

    const activeId = pickerPacks.some(p => p.id === window._activeStickerPackId)
        ? window._activeStickerPackId
        : (packs[0]?.id || WECHAT_GIPHY_PACK_ID);
    window._activeStickerPackId = activeId;

    tabsEl.innerHTML = pickerPacks.map(p =>
        `<div class="wc-sticker-tab ${p.id === activeId ? 'active' : ''} ${p.emoji ? 'emoji' : ''} ${p.giphy ? 'giphy' : ''}" onclick="switchStickerPack(${quoteWechatJsString(p.id)})">${escapeHtml(p.name)}</div>`
    ).join('');

    const pack = pickerPacks.find(p => p.id === activeId) || pickerPacks[0];
    if (pack?.giphy) {
        renderWechatGiphyPicker();
        const state = getWechatGiphyState();
        if (!state.loaded && !state.loading) setTimeout(() => loadWechatGiphyStickers(''), 0);
        return;
    }

    const stickers = Array.isArray(pack?.stickers) ? pack.stickers : [];
    gridEl.classList.remove('wc-giphy-panel');
    gridEl.classList.toggle('wc-emoji-grid', !!pack?.emoji);
    if (pack && stickers.length > 0) {
        gridEl.innerHTML = stickers.map(s =>
            `<img class="${pack.emoji || s.emoji ? 'wc-emoji-item' : ''}" src="${wcEscapeHtml(s.url)}" alt="${escapeHtml(s.name)}" title="${escapeHtml(s.name)}" onclick="sendSticker(${quoteWechatJsString(s.url)}, ${quoteWechatJsString(s.name)}, ${pack.emoji || s.emoji ? 'true' : 'false'})" loading="lazy" onerror="this.remove()">`
        ).join('');
    } else {
        gridEl.innerHTML = '<div style="text-align:center;color:#999;padding:40px;grid-column:1/-1;font-size:13px;">这个包里还没有贴纸</div>';
    }
}

function switchStickerPack(packId) {
    window._activeStickerPackId = packId;
    renderStickerPicker();
}

function insertWechatEmojiToInput(name, url = '') {
    const inputEl = document.getElementById('wc-msg-input');
    if (!inputEl) return;
    const label = String(name || '').trim();
    if (!label) return;
    if (isWechatRichInputEnabled() && insertWechatRichInputEmoji(label, url)) {
        closeStickerPicker();
        return;
    }
    const token = getWechatUiThemeId() === 'wechat'
        ? getWechatInputEmojiDisplayToken(label)
        : `[${label}]`;
    const start = Number.isFinite(inputEl.selectionStart) ? inputEl.selectionStart : inputEl.value.length;
    const end = Number.isFinite(inputEl.selectionEnd) ? inputEl.selectionEnd : start;
    inputEl.value = inputEl.value.slice(0, start) + token + inputEl.value.slice(end);
    if (['wechat', 'qq'].includes(getWechatUiThemeId())) {
        rememberWechatInputEmojiDraftItem({ token, name: label, source: getWechatActiveBuiltinEmojiSource(), url });
    }
    const nextPos = start + token.length;
    inputEl.focus();
    try {
        inputEl.setSelectionRange(nextPos, nextPos);
    } catch (e) {}
    syncWechatDraftState();
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    closeStickerPicker();
}

function sendSticker(url, name, isWechatEmoji = false) {
    if (isWechatEmoji) {
        insertWechatEmojiToInput(name, url);
        return;
    }
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    if (isWechatQQGroupSpeechMuted(char)) {
        showWechatToast('当前群已开启全员禁言');
        return;
    }

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
                <i class="ri-eye-line" onclick="openPackDetail(${safeId})" title="管理"></i>
                <i class="ri-edit-line" onclick="openStickerPackRenameModal(${safeId})" title="重命名"></i>
                <i class="ri-delete-bin-6-line del-btn" onclick="deleteStickerPack(${safeId})" title="删除"></i>`;
        return `
        <div class="sticker-pack-item ${p.builtin ? 'builtin' : ''}">
            <div class="sticker-pack-info">
                ${stickers.length > 0 ? `<img class="sticker-pack-preview ${p.emoji ? 'emoji' : ''}" src="${wcEscapeHtml(stickers[0].url)}" onerror="this.remove()">` : '<div class="sticker-pack-preview"></div>'}
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

function ensureStickerPackRenameModal() {
    let modal = document.getElementById('wc-sticker-pack-rename-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-sticker-pack-rename-modal';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay';
    modal.innerHTML = `
        <div class="wc-compose-card wc-sticker-create-card">
            <div class="wc-compose-header">
                <div class="wc-compose-title"><i class="ri-edit-line"></i><span>重命名贴纸包</span></div>
                <i class="ri-close-line" onclick="closeStickerPackRenameModal()"></i>
            </div>
            <div class="wc-compose-body">
                <label class="wc-compose-field">
                    <span>贴纸包名称</span>
                    <input id="wc-sticker-pack-rename-name" type="text" maxlength="24" placeholder="输入新的贴纸包名称" onkeydown="if(event.key==='Enter'){event.preventDefault();confirmRenameStickerPack();}">
                </label>
            </div>
            <div class="wc-compose-footer">
                <button class="wc-compose-secondary" onclick="closeStickerPackRenameModal()">取消</button>
                <button class="wc-compose-primary" onclick="confirmRenameStickerPack()">保存</button>
            </div>
        </div>
    `;
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function openStickerPackRenameModal(packId) {
    if (isWechatBuiltinStickerPackId(packId)) {
        if (typeof showWechatToast === 'function') showWechatToast('内置贴纸包不能重命名');
        return;
    }
    const data = getStickerPacks();
    const pack = getEditableStickerPacks(data).find(p => p.id === packId);
    if (!pack) return;
    window._renameStickerPackId = packId;
    const modal = ensureStickerPackRenameModal();
    const input = document.getElementById('wc-sticker-pack-rename-name');
    if (input) {
        input.value = pack.name || '';
        input.select?.();
    }
    modal.classList.add('wc-sticker-submodal');
    modal.style.zIndex = '3800';
    modal.classList.remove('hidden');
    setTimeout(() => input?.focus(), 30);
}

function closeStickerPackRenameModal() {
    const modal = document.getElementById('wc-sticker-pack-rename-modal');
    if (modal) modal.classList.add('hidden');
    window._renameStickerPackId = '';
}

function confirmRenameStickerPack() {
    const packId = window._renameStickerPackId;
    if (!packId || isWechatBuiltinStickerPackId(packId)) return;
    const input = document.getElementById('wc-sticker-pack-rename-name');
    const name = input ? input.value.trim().slice(0, 24) : '';
    if (!name) {
        input?.focus();
        return;
    }
    const data = getStickerPacks();
    const pack = getEditableStickerPacks(data).find(p => p.id === packId);
    if (!pack) return;
    pack.name = name;
    saveStickerPacks(data);
    refreshStickerSurfaces();
    closeStickerPackRenameModal();
    if (window._detailPackId === packId) openPackDetail(packId);
    if (typeof showWechatToast === 'function') showWechatToast('已重命名贴纸包');
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
                    <img src="${wcEscapeHtml(s.url)}" title="${escapeHtml(s.name)}" style="width:100%;aspect-ratio:1;object-fit:contain;border-radius:6px;background:#f5f5f5;" onerror="this.closest('.pack-sticker-cell')?.remove()" loading="lazy">
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
