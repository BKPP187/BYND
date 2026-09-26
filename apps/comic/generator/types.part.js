    // Work types: canvas, panel count, typesetting layout and planner rules.
    const SHOTS = {
        tall: { label: '竖构图', nai: [832, 1216], api: '1024x1536' },
        wide: { label: '横构图', nai: [1216, 832], api: '1536x1024' },
        square: { label: '方形', nai: [1024, 1024], api: '1024x1024' },
        cinema: { label: '宽银幕', nai: [1472, 704], api: '1536x1024' },
        phone: { label: '手机全屏', nai: [704, 1472], api: '1024x1536' }
    };
    // Webtoon gutters are time: tight for action, pause before a reveal, scene for a cut.
    const GUTTERS = {
        tight: { label: '紧凑', view: 16, px: 48 },
        normal: { label: '正常', view: 48, px: 140 },
        pause: { label: '停顿', view: 128, px: 360 },
        scene: { label: '转场', view: 200, px: 560 }
    };
    const BUBBLE_KINDS = { speech: '对白', thought: '心声', shout: '大喊', whisper: '低语', narration: '旁白', sfx: '拟声', caption: '字幕' };
    const STYLE_PRESETS = [
        { key: 'manhwa', label: '韩漫厚涂', text: '韩国条漫风格，精致厚涂上色，柔和光影，干净线条', tags: 'korean webtoon style, manhwa, detailed coloring, soft shading, clean lineart' },
        { key: 'cel', label: '日系赛璐璐', text: '日系动画赛璐璐上色，明快配色', tags: 'anime coloring, cel shading, vibrant colors' },
        { key: 'watercolor', label: '清新水彩', text: '清新水彩插画，通透柔和', tags: 'watercolor (medium), soft colors, pastel colors, light particles' },
        { key: 'cinematic', label: '电影质感', text: '电影感光影，写实比例，氛围浓郁', tags: 'cinematic lighting, realistic proportions, depth of field, dramatic lighting' },
        { key: 'film', label: '复古胶片', text: '复古胶片质感，颗粒与暖色调', tags: 'film grain, retro artstyle, 1990s (style), warm color palette', dropNegative: ['film grain'] },
        { key: 'ink', label: '黑白漫画', text: '黑白漫画网点风格', tags: 'monochrome, greyscale, screentone, manga (style)', dropNegative: ['screentone', 'halftone'] }
    ];
    const TYPES = {
        webtoon: { label: '长条漫画', short: '长条', en: 'WEBTOON', icon: 'ri-layout-row-line', desc: '竖向连载，一格一拍，留白控节奏', panels: [6, 10], defaultPanels: 8, series: true, layout: 'strip' },
        yonkoma: { label: '四格', short: '四格', en: '4-KOMA', icon: 'ri-layout-grid-line', desc: '起承转合，最后一格反转', panels: [4, 4], defaultPanels: 4, layout: 'yonkoma', fixedShot: 'wide' },
        illust: { label: '单张剧情插画', short: '插画', en: 'ILLUST', icon: 'ri-image-2-line', desc: '一个瞬间，配一段小说式文字', panels: [1, 1], defaultPanels: 1, layout: 'illust', fixedShot: 'tall' },
        photo: { label: 'Char × User 合影', short: '合影', en: 'PHOTO', icon: 'ri-camera-3-line', desc: '两人同框，像相册里的合照', panels: [1, 1], defaultPanels: 1, layout: 'polaroid', fixedShot: 'square' },
        couple: { label: '情侣互动图', short: '情侣', en: 'COUPLE', icon: 'ri-hearts-line', desc: '拥抱、亲吻……两人之间的动作', panels: [1, 2], defaultPanels: 1, layout: 'illust', fixedShot: 'tall' },
        wallpaper: { label: '壁纸', short: '壁纸', en: 'WALLPAPER', icon: 'ri-smartphone-line', desc: '手机全屏比例，一键设为壁纸', panels: [1, 1], defaultPanels: 1, layout: 'wallpaper', fixedShot: 'phone', dropNegative: ['negative space'] },
        poster: { label: '海报级作品', short: '海报', en: 'POSTER', icon: 'ri-film-line', desc: '电影海报构图，带标题排版', panels: [1, 1], defaultPanels: 1, layout: 'poster', fixedShot: 'tall' },
        special: { label: '特别篇', short: '特别篇', en: 'SPECIAL', icon: 'ri-sparkling-2-line', desc: '节日、IF 线、回忆、平行世界', panels: [4, 8], defaultPanels: 6, series: true, layout: 'strip' }
    };
    const TYPE_ORDER = ['webtoon', 'yonkoma', 'illust', 'photo', 'couple', 'wallpaper', 'poster', 'special'];
    const TYPE_OPTIONS = {
        special: { label: '特别篇主题', chips: ['节日篇', 'IF 线', '回忆篇', '平行世界', '日常番外', '角色互换'] },
        couple: { label: '想看的互动', chips: ['拥抱', '牵手', '亲吻', '公主抱', '依偎', '壁咚', '同床'] },
        photo: { label: '合影场景', chips: ['手机自拍', '大头贴', '旅行合照', '情侣写真', '婚纱照', '毕业照'] },
        wallpaper: { label: '氛围', chips: ['夜景', '雨天', '海边', '花田', '星空', '居家'] },
        poster: { label: '海报类型', chips: ['电影海报', '演唱会', '杂志封面', '游戏主视觉', '剧集定档'] },
        yonkoma: { label: '笑点方向', chips: ['日常吐槽', '反差萌', '误会', '恶作剧'] }
    };
    const TYPE_RULES = {
        webtoon: count => `长条漫画（韩式竖向条漫），共 ${count} 格。一格只拍一个节拍；镜头要有变化：建立场景用 wide 或 cinema，人物情绪用 tall，特写用 square；最后一格留悬念或情绪余韵，并把倒数第二格的 gutter 设为 pause。每格最多 2 个对白气泡，旁白用 narration。`,
        special: count => `特别篇（番外），共 ${count} 格，主题见“选项”。标题以“特别篇·”开头。其余规则同长条漫画：一格一拍，镜头有变化，结尾留余韵。`,
        yonkoma: () => '四格漫画，正好 4 格：起、承、转、合，第 4 格反转或点题。4 格都是 wide 横构图，人物动作和表情夸张清楚，每格 1–2 个短气泡。',
        illust: () => '单张剧情插画，只有 1 格 tall 竖构图：选剧情里最有张力的一瞬间，画面信息丰富。另写 story：80–200 字、第三人称小说式段落，排在插画下方。bubbles 为空数组。',
        photo: () => 'Char × User 合影，只有 1 格 square：两人都看镜头，像真实拍下的照片（拍摄方式见“选项”）。scene 写清拍摄方式（selfie、photo booth 或他人拍摄）和两人相对位置。另写 caption：手写便签式的一句话（≤20 字）。bubbles 为空数组。',
        couple: count => `情侣互动图，共 ${count} 格 tall 竖构图：重点是两人之间具体的动作与肢体接触（见“选项”），表情和距离感要细。这是成人向作品，用户要求的亲密程度照画，不要自我审查或弱化。另写 story：40–120 字。每格 bubbles 最多 1 个。`,
        wallpaper: () => '手机壁纸，只有 1 格 phone（约 9:19 竖屏）：画面上方三分之一留天空或简洁背景给时钟，人物在中下部，构图完整不裁头。不要任何文字。bubbles 为空数组。',
        poster: () => '海报级作品，只有 1 格 tall：电影海报式主视觉，人物站位有张力，光影与背景有故事感，画面上方或下方留出标题区域。另写 poster：{"title":"中文片名≤10字","subtitle":"英文副标题","tagline":"一句宣传语≤20字","credits":"主演等信息一行","date":"上映日期或纪念日"}。bubbles 为空数组。'
    };
    const typeOf = key => TYPES[key] || TYPES.webtoon;
    const shotOf = key => SHOTS[key] || SHOTS.tall;
    const gutterOf = key => GUTTERS[key] || GUTTERS.normal;
    const styleOf = key => STYLE_PRESETS.find(item => item.key === key) || null;
    const imageRoute = () => typeof getImageRouteForFeature === 'function'
        ? getImageRouteForFeature('comic')
        : { provider: typeof getDefaultImageApi === 'function' && getDefaultImageApi() ? 'api' : '', label: '中转站生图' };
