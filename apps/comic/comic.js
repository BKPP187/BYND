/* BYND comics: webtoon-style studio. Work types, storyboards and typesetting live here; image providers are chosen in Settings. */
(() => {
    'use strict';
    const DB = 'bynd_comics_v1';
    const DB_VERSION = 2;
    const root = () => document.getElementById('comic-root');
    const state = {
        view: 'home', tab: 'home', typeFilter: 'all', charFilter: '', shelfSort: 'updated',
        seriesId: '', chapterId: '', busy: false, source: null, selectedHistory: new Set(), status: '', statusError: false,
        draft: null, job: null, barsHidden: false, episodeOrder: 'desc'
    };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const id = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const chars = () => (window.myCharacters || []).filter(char => char && char.id);
    const charById = charId => chars().find(char => String(char.id) === String(charId));
    const nameOf = char => typeof getWechatCharDisplayName === 'function' ? getWechatCharDisplayName(char) : (char?.name || '角色');
    const avatarOf = char => String(char?.avatar || '').trim();
    const date = time => time ? new Date(time).toLocaleDateString('zh-CN', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\//g, '.') : '—';
    const isRecent = time => Date.now() - Number(time || 0) < 3 * 86400000;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const say = (message, error = false) => {
        state.status = message;
        state.statusError = error;
        const el = root()?.querySelector('.ct-status');
        if (el) {
            el.textContent = message;
            el.classList.toggle('error', error);
            el.classList.toggle('hidden', !message);
        }
        if (message && (!root() || !document.getElementById('app-comic-window')?.classList.contains('active')) && typeof showWechatToast === 'function') showWechatToast(message, 2600);
    };
    function db() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) return reject(new Error('当前环境无法保存漫画：IndexedDB 不可用'));
            const request = indexedDB.open(DB, DB_VERSION);
            request.onupgradeneeded = () => {
                const database = request.result;
                for (const store of ['series', 'images', 'materials', 'profiles']) {
                    if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('漫画数据库打开失败'));
            request.onblocked = () => reject(new Error('漫画数据库正在被另一个页面占用，请关闭其他 BYND 页面后重试'));
        });
    }
    async function query(store, mode, action) {
        const database = await db();
        return new Promise((resolve, reject) => {
            let result;
            const tx = database.transaction(store, mode);
            const req = action(tx.objectStore(store));
            if (req) { req.onsuccess = () => { result = req.result; }; req.onerror = () => reject(req.error || new Error('数据库读写失败')); }
            tx.oncomplete = () => { database.close(); resolve(result); };
            tx.onerror = () => { database.close(); reject(tx.error || new Error('漫画保存失败')); };
            tx.onabort = () => { database.close(); reject(tx.error || new Error('漫画保存已中断')); };
        });
    }
    const all = store => query(store, 'readonly', object => object.getAll());
    const get = (store, key) => query(store, 'readonly', object => object.get(key));
    const put = (store, value) => query(store, 'readwrite', object => object.put(value));
    const remove = (store, key) => query(store, 'readwrite', object => object.delete(key));
    const series = async () => (await all('series')).map(upgradeBook).sort((a, b) => b.updatedAt - a.updatedAt);
    const current = async () => upgradeBook(await get('series', state.seriesId));
    const chapter = book => book?.chapters?.find(item => item.id === state.chapterId);
    const profile = char => typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : (typeof getUserProfile === 'function' ? getUserProfile() : {});
    const charReference = char => typeof getWechatImageReferenceForChar === 'function' ? getWechatImageReferenceForChar(char) : (char?.chatConfig?.imageReference || char?.avatar || '');
    // Version 1 books were always vertical strips with one dialogue line per panel.
    function upgradeBook(book) {
        if (!book || typeof book !== 'object') return book;
        book.type = book.type || 'webtoon';
        book.cast = book.cast && typeof book.cast === 'object' ? book.cast : { char: '', user: '' };
        book.chapters = Array.isArray(book.chapters) ? book.chapters : [];
        for (const part of book.chapters) {
            part.panels = Array.isArray(part.panels) ? part.panels : [];
            part.comments = Array.isArray(part.comments) ? part.comments : [];
            for (const panel of part.panels) {
                panel.beat = panel.beat || panel.description || '';
                panel.shot = panel.shot || 'tall';
                panel.gutter = panel.gutter || 'normal';
                panel.tone = panel.tone === 'dark' ? 'dark' : 'light';
                panel.chars = Array.isArray(panel.chars) ? panel.chars : [];
                if (!Array.isArray(panel.bubbles)) {
                    panel.bubbles = panel.dialogue ? [{ id: id('bubble'), who: 'narration', kind: 'caption', text: String(panel.dialogue) }] : [];
                }
            }
        }
        return book;
    }
    async function fileData(file) {
        if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error('请选择 PNG、JPG 或 WebP 图片');
        return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片读取失败')); reader.readAsDataURL(file); });
    }
    async function durableImage(source) {
        if (/^data:image\/(png|jpeg|webp);base64,/i.test(source)) return source;
        if (!/^https?:\/\//i.test(source)) throw new Error('图片地址无效');
        const response = await fetch(source);
        if (!response.ok) throw new Error(`图片下载失败 (${response.status})`);
        const blob = await response.blob();
        if (!/^image\/(png|jpeg|webp)$/i.test(blob.type)) throw new Error('生图服务返回了不支持的图片格式');
        return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片转存失败')); reader.readAsDataURL(blob); });
    }
    async function storeImage(source) { const key = id('img'); await put('images', { id: key, data: await durableImage(source) }); return key; }
    async function image(key) { return key ? (await get('images', key))?.data || '' : ''; }
    async function save(book) { book.updatedAt = Date.now(); await put('series', book); }
    async function run(fn) {
        if (state.busy) { say('上一个操作还没完成，请稍等'); return; }
        state.busy = true;
        try { await fn(); } catch (error) { console.error('漫画操作失败', error); say(error.message || '操作失败', true); } finally { state.busy = false; }
    }
    async function fillImages(scope = root()) {
        for (const box of scope?.querySelectorAll('[data-image]') || []) {
            const key = box.dataset.image;
            if (!key || box.dataset.loaded === key) continue;
            const src = await image(key);
            if (!src) continue;
            box.dataset.loaded = key;
            const img = box.querySelector('img.ct-img') || document.createElement('img');
            img.className = 'ct-img';
            img.alt = box.dataset.alt || '漫画图片';
            img.src = src;
            if (!img.parentNode) box.prepend(img);
            box.classList.add('has-image');
        }
    }
    // Appearance tags are saved per character / persona and provider (NovelAI tags
    // differ from natural-language descriptions) so later works draw the same people.
    const castKey = (who, key, provider) => `${who}:${key || 'default'}:${provider === 'novelai' ? 'novelai' : 'api'}`;
    async function castProfile(who, key, provider) { return (await get('profiles', castKey(who, key, provider)))?.text || ''; }
    async function saveCastProfile(who, key, provider, text) {
        const clean = String(text || '').trim().slice(0, 1200);
        if (!clean) return;
        await put('profiles', { id: castKey(who, key, provider), who, key: String(key || 'default'), provider: provider === 'novelai' ? 'novelai' : 'api', text: clean, updatedAt: Date.now() });
    }
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
    function historyRows(char) {
        return (char?.history || []).filter(row => row && (row.content || row.text) && !['image', 'image_stack'].includes(row.type)).slice(-40).map((row, index) => ({
            key: String(row.id || row.timestamp || index),
            speaker: row.isMe ? (profile(char).name || 'User') : nameOf(char),
            text: String(row.content || row.text).slice(0, 900)
        }));
    }
    function transcript(char, selectedOnly = false) {
        const rows = historyRows(char);
        const selected = rows.filter(row => state.selectedHistory.has(row.key));
        const picked = selected.length ? selected : (selectedOnly ? [] : rows.slice(-12));
        return picked.map(row => `${row.speaker}：${row.text}`).join('\n');
    }
    function parseJson(text) {
        const clean = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        try { return JSON.parse(clean); } catch (_) {
            const start = clean.indexOf('{'), end = clean.lastIndexOf('}');
            if (start >= 0 && end > start) {
                try { return JSON.parse(clean.slice(start, end + 1)); } catch (_) {}
            }
            throw new Error('分镜脚本不是有效 JSON，请重试或换一个聊天模型');
        }
    }
    const cut = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    function planSchema(key, provider) {
        const panel = provider === 'novelai'
            ? '{"beat":"中文：这一格发生什么","shot":"tall|wide|square|cinema|phone","gutter":"normal","tone":"light","scene":"English base tags","chars":[{"who":"char","tags":"English tags","x":0.35,"y":0.5}],"bubbles":[{"who":"char","kind":"speech","text":"中文台词"}]}'
            : '{"beat":"中文：这一格发生什么","shot":"tall|wide|square|cinema|phone","gutter":"normal","tone":"light","prompt":"中文完整画面描述","bubbles":[{"who":"char","kind":"speech","text":"中文台词"}]}';
        const extra = { illust: ',"story":"…"', couple: ',"story":"…"', photo: ',"caption":"…"', poster: ',"poster":{"title":"","subtitle":"","tagline":"","credits":"","date":""}' }[key] || '';
        const episode = typeOf(key).series ? ',"episodeTitle":"本话标题，不超过 12 字"' : '';
        return `{"title":"作品标题，不超过 16 字"${episode},"logline":"一句话简介","cast":{"char":"…","user":"…"},"panels":[${panel}],"authorNote":"…","comment":"…"${extra}}`;
    }
    function planSystemPrompt(key, count, provider) {
        const type = typeOf(key);
        const lines = [
            '你是 BYND 私人漫画工作室的编剧兼分镜导演，为 Char 与 User 创作作品。只返回一个 JSON 对象，不要解释，不要 markdown。',
            `作品类型：${type.label}。${TYPE_RULES[key](count)}`,
            '对白、旁白、标题、简介都用中文；对白要符合 Char 的人设、说话习惯和与 User 的关系，不能 OOC。',
            'bubbles 的 who 取 char / user / narration / sfx，kind 取 speech / thought / shout / whisper / narration / sfx，每条 text 不超过 30 字。文字由排版层叠加，画面本身不要出现任何文字。',
            'gutter 取 tight / normal / pause / scene，表示这一格与下一格之间的留白（动作连贯 / 正常 / 停顿蓄力 / 转场）；tone 取 light 或 dark（夜景或压抑情绪用 dark，留白变黑）。',
            'authorNote：用 Char 的口吻写“作者的话”，不超过 60 字。comment：Char 在评论区留的一句话，不超过 40 字。'
        ];
        if (provider === 'novelai') {
            lines.push(
                '画面一律用 NovelAI Diffusion 的英文 Danbooru 标签，逗号分隔：',
                'cast.char 与 cast.user：该人物的固定外观标签，以 boy、girl 或 other 开头（不带数字），写发色发型、瞳色、年龄感、体型、固定服装与配饰。若给了“外观档案”，必须原样沿用。',
                'panels[].scene：本格基础标签。先写人数标签（1boy, 1girl, 2boys, 2girls, solo 等），再写地点、时间、天气、光线、镜头与构图（close-up, upper body, cowboy shot, full body, from above, from below, dutch angle, pov 等）。',
                'panels[].chars：本格出镜的人，每人一项 {"who":"char 或 user","tags":"表情、动作、姿势、视线及临时变化（湿发、脸红、眼泪、衣着变化）","x":0.1 到 0.9,"y":0.1 到 0.9}；不要重复固定外观；两人互动在动作前加 source# / target# / mutual#（如一方 source#hug、另一方 target#hug，或双方 mutual#kiss）。不出镜的人不要放进 chars。',
                '不要写 text、speech bubble、watermark 这类标签。这是成人向作品：剧情需要时可以用露骨标签，不要自我审查。'
            );
        } else {
            lines.push(
                '画面用中文自然语言描述：',
                'cast.char 与 cast.user：该人物的固定外观（发型发色、瞳色、年龄感、体型、服装、配饰）。若给了“外观档案”，必须原样沿用。',
                'panels[].prompt：本格完整画面描述，写清出镜人物（外观按 cast）、动作、表情、场景、时间、光线、镜头与构图。每格独立写全，不依赖其他格，不要求画面出现文字。'
            );
        }
        lines.push(`JSON 结构：${planSchema(key, provider)}`);
        return lines.join('\n');
    }
    function planContext(book, part, extra = {}) {
        const char = charById(book.charId);
        const world = typeof getWechatCharacterPersonaText === 'function' && char ? getWechatCharacterPersonaText(char, 7000) : (char?.description || '');
        const earlier = book.chapters.filter(item => item.id !== part.id && item.panels.length).slice(-6)
            .map((item, index) => `${index + 1}. ${item.title}：${item.panels.map(panel => panel.beat).filter(Boolean).join(' / ').slice(0, 360)}`).join('\n');
        const source = {
            chat: `【聊天选段（按真实聊天改编）】\n${part.transcript || '（无）'}`,
            custom: `【用户想要的剧情】\n${part.plot || '（未填写，自由发挥但贴合人设）'}`,
            char: `【由 ${book.charName} 主动构思】根据人设和最近的真实聊天，提出 ${book.charName} 想和 ${book.userName} 一起经历的一段剧情；不能捏造已经发生过的共同经历。\n最近聊天：\n${part.transcript || '（暂无聊天）'}`,
            dream: `【梦境记录改编】\n${part.plot || ''}`,
            forum: `【论坛帖子改编】\n${part.plot || ''}`
        }[part.source] || `【剧情】\n${part.plot || ''}`;
        return [
            `【Char】${book.charName}`,
            `【Char 人设与世界书】\n${world || '（无）'}`,
            `【User】${book.userName}${book.userBio ? `\n【User 设定】${book.userBio}` : ''}`,
            extra.castChar || extra.castUser ? `【外观档案，必须沿用】\nchar：${extra.castChar || '（无，请根据人设新写）'}\nuser：${extra.castUser || '（无，请根据设定新写）'}` : '',
            `【画风】${book.style || '韩国条漫风格'}${extra.provider === 'novelai' && book.styleTags ? `\n画风标签（加进每格 scene 的末尾）：${book.styleTags}` : ''}`,
            book.option ? `【选项】${book.option}` : '',
            part.plot && part.source !== 'custom' && !['dream', 'forum'].includes(part.source) ? `【补充要求】${part.plot}` : '',
            earlier ? `【已完成章节】\n${earlier}` : '',
            source
        ].filter(Boolean).join('\n\n');
    }
    function normalizeBubble(item) {
        const who = ['char', 'user', 'narration', 'sfx', 'other'].includes(item?.who) ? item.who : 'char';
        let kind = BUBBLE_KINDS[item?.kind] ? item.kind : (who === 'narration' ? 'narration' : who === 'sfx' ? 'sfx' : 'speech');
        if (who === 'narration' && !['narration', 'caption'].includes(kind)) kind = 'narration';
        if (who === 'sfx') kind = 'sfx';
        const text = cut(item?.text, 80);
        const bubble = { id: id('bubble'), who, kind, text };
        if (Number.isFinite(Number(item?.x)) && Number.isFinite(Number(item?.y))) {
            bubble.x = clamp(Number(item.x), 0, 0.9);
            bubble.y = clamp(Number(item.y), 0, 0.95);
        }
        return bubble;
    }
    function validatePlan(raw, key = 'webtoon', provider = 'api') {
        const type = typeOf(key);
        if (!raw || !Array.isArray(raw.panels) || !raw.panels.length) throw new Error(`分镜需要 ${type.panels[0]} 到 ${type.panels[1]} 格，模型没有返回可用分镜`);
        const panels = raw.panels.slice(0, type.panels[1]).map(item => {
            const shot = type.fixedShot || (SHOTS[item?.shot] ? item.shot : 'tall');
            const panel = {
                id: id('panel'),
                beat: cut(item?.beat || item?.description, 300),
                shot,
                gutter: GUTTERS[item?.gutter] ? item.gutter : 'normal',
                tone: item?.tone === 'dark' ? 'dark' : 'light',
                scene: cut(item?.scene, 1200),
                chars: (Array.isArray(item?.chars) ? item.chars : []).slice(0, 4).map(person => ({
                    who: ['char', 'user', 'other'].includes(person?.who) ? person.who : 'other',
                    tags: cut(person?.tags, 700),
                    x: Number.isFinite(Number(person?.x)) ? clamp(Number(person.x), 0.1, 0.9) : 0.5,
                    y: Number.isFinite(Number(person?.y)) ? clamp(Number(person.y), 0.1, 0.9) : 0.5
                })).filter(person => person.tags || person.who !== 'other'),
                prompt: cut(item?.prompt, 1600),
                bubbles: (Array.isArray(item?.bubbles) ? item.bubbles : []).slice(0, 4).map(normalizeBubble).filter(bubble => bubble.text),
                imageKey: '', seed: null, error: ''
            };
            if (!panel.prompt && provider !== 'novelai') panel.prompt = panel.beat;
            return panel;
        }).filter(panel => panel.beat && (provider === 'novelai' ? (panel.scene || panel.chars.some(person => person.tags)) : panel.prompt));
        if (panels.length < type.panels[0]) throw new Error(`分镜需要 ${type.panels[0]} 到 ${type.panels[1]} 格，模型只给出了 ${panels.length} 格可用画面`);
        const poster = raw.poster && typeof raw.poster === 'object' ? raw.poster : {};
        return {
            title: cut(raw.title, 40),
            episodeTitle: cut(raw.episodeTitle, 30),
            logline: cut(raw.logline, 120),
            cast: { char: cut(raw.cast?.char, 1000), user: cut(raw.cast?.user, 1000) },
            panels,
            authorNote: cut(raw.authorNote, 120),
            comment: cut(raw.comment, 80),
            story: cut(raw.story, 600),
            caption: cut(raw.caption, 40),
            poster: { title: cut(poster.title, 20), subtitle: cut(poster.subtitle, 60), tagline: cut(poster.tagline, 40), credits: cut(poster.credits, 80), date: cut(poster.date, 30) }
        };
    }
    function autoPlaceBubbles(panel) {
        const people = panel.chars || [];
        let speech = 0;
        for (const bubble of panel.bubbles) {
            if (Number.isFinite(bubble.x) && Number.isFinite(bubble.y)) continue;
            if (bubble.kind === 'narration' || bubble.kind === 'caption') { bubble.x = 0.04; bubble.y = 0.03; continue; }
            if (bubble.kind === 'sfx') { bubble.x = 0.52; bubble.y = 0.46; continue; }
            const speaker = people.find(person => person.who === bubble.who);
            const right = speaker ? speaker.x >= 0.5 : speech % 2 === 1;
            bubble.x = right ? 0.5 : 0.05;
            bubble.y = clamp(0.05 + speech * 0.15, 0.03, 0.72);
            speech++;
        }
    }
    // The chat call can take a minute; the book is reloaded afterwards so edits made
    // meanwhile (title, other chapters) are not overwritten by a stale copy.
    async function generatePlan(bookId, chapterId, options = {}) {
        if (typeof callChatApi !== 'function') throw new Error('请先在设置里配置聊天 API（分镜由聊天模型编写）');
        const route = imageRoute();
        if (!route.provider) throw new Error('还没有可用的生图服务：设置 → API → 生图服务');
        const provider = route.provider;
        const draftBook = upgradeBook(await get('series', bookId));
        const draftPart = draftBook?.chapters.find(item => item.id === chapterId);
        if (!draftPart) throw new Error('找不到这一话');
        const type = typeOf(draftBook.type);
        const count = clamp(Number(options.panels || draftPart.panelTarget || type.defaultPanels), type.panels[0], type.panels[1]);
        const personaKey = draftBook.personaId || 'default';
        const castChar = draftBook.cast?.provider === provider && draftBook.cast.char ? draftBook.cast.char : await castProfile('char', draftBook.charId, provider);
        const castUser = draftBook.cast?.provider === provider && draftBook.cast.user ? draftBook.cast.user : await castProfile('user', personaKey, provider);
        say(`${draftBook.charName} 正在写分镜…`);
        const result = await callChatApi([
            { role: 'system', content: planSystemPrompt(draftBook.type, count, provider) },
            { role: 'user', content: planContext(draftBook, draftPart, { castChar, castUser, provider }) }
        ], { max_tokens: 6000, temperature: 0.8, usageFeature: 'comic', usageChar: charById(draftBook.charId) });
        if (!result?.ok) throw new Error(result?.error || '分镜生成失败');
        const plan = validatePlan(parseJson(result.content), draftBook.type, provider);
        plan.panels.forEach(autoPlaceBubbles);
        const book = upgradeBook(await get('series', bookId));
        const part = book?.chapters.find(item => item.id === chapterId);
        if (!part) throw new Error('这一话在写分镜时被删除了');
        book.cast = { provider, char: castChar || plan.cast.char, user: castUser || plan.cast.user };
        if (!castChar && plan.cast.char) await saveCastProfile('char', book.charId, provider, plan.cast.char);
        if (!castUser && plan.cast.user) await saveCastProfile('user', personaKey, provider, plan.cast.user);
        if (!book.titleLocked && plan.title && (!type.series || book.chapters.length <= 1)) book.title = plan.title;
        if (plan.logline && (!book.logline || !type.series)) book.logline = plan.logline;
        const oldKeys = part.panels.map(panel => panel.imageKey).filter(Boolean);
        if (!part.titleLocked) {
            part.title = type.series
                ? `第${book.chapters.indexOf(part) + 1}话${plan.episodeTitle ? ` ${plan.episodeTitle}` : ''}`
                : book.title;
        }
        part.panels = plan.panels;
        part.authorNote = plan.authorNote;
        part.story = plan.story;
        part.caption = plan.caption;
        part.poster = plan.poster;
        part.comments = plan.comment ? [{ id: id('comment'), who: 'char', text: plan.comment, at: Date.now() }] : [];
        part.provider = provider;
        part.state = 'planned';
        part.planError = '';
        part.updatedAt = Date.now();
        if (oldKeys.includes(book.coverKey)) book.coverKey = '';
        await save(book);
        for (const key of oldKeys) await remove('images', key).catch(console.warn);
        say(`分镜完成：${part.panels.length} 格。检查一下，然后点“开始生成”。`);
        return plan;
    }
    const joinTags = (...parts) => window.ByndNovelAi?.joinTags
        ? window.ByndNovelAi.joinTags(...parts)
        : parts.flat().map(part => String(part || '').trim()).filter(Boolean).join(', ');
    function naiInput(book, panel) {
        const type = typeOf(book.type);
        const style = styleOf(book.styleKey);
        const cast = book.cast || {};
        const [width, height] = shotOf(panel.shot).nai;
        const characters = (panel.chars || []).map(person => ({
            prompt: joinTags(person.who === 'char' ? cast.char : person.who === 'user' ? cast.user : '', person.tags),
            x: person.x,
            y: person.y
        })).filter(person => person.prompt);
        return {
            prompt: joinTags(panel.scene, book.styleTags || style?.tags || ''),
            characters,
            width,
            height,
            negative: book.negative || '',
            dropNegative: [...(type.dropNegative || []), ...(style?.dropNegative || [])],
            seed: Number.isInteger(panel.seed) ? panel.seed : undefined
        };
    }
    function apiPrompt(book, panel) {
        const type = typeOf(book.type);
        const cast = book.cast || {};
        const layout = {
            photo: '像真实拍下的合影照片，两人都看镜头。',
            wallpaper: '手机竖屏壁纸构图，上方留出简洁背景给时钟，没有任何文字。',
            poster: '电影海报式主视觉，留出标题区域，但画面里不要出现文字。'
        }[book.type] || '';
        return [
            `画风：${book.style || '韩国条漫风格，精致上色'}`,
            `人物外观（每格保持一致）：${book.charName}：${cast.char || '按参考图'}；${book.userName}：${cast.user || '按参考图'}`,
            `画面：${panel.prompt || panel.beat}`,
            layout,
            `这是${type.label}中的一格，只画这一格：不要分格、不要文字、不要对话气泡、不要水印。`
        ].filter(Boolean).join('\n');
    }
    // Reload before each write so edits made while pictures render are never overwritten.
    async function mutatePanel(bookId, chapterId, panelId, mutate) {
        const book = upgradeBook(await get('series', bookId));
        const part = book?.chapters.find(item => item.id === chapterId);
        const panel = part?.panels.find(item => item.id === panelId);
        if (!panel) return null;
        const result = await mutate(book, part, panel);
        part.updatedAt = Date.now();
        await save(book);
        return result;
    }
    async function renderPanel(bookId, chapterId, panelId, signal) {
        const book = upgradeBook(await get('series', bookId));
        const panel = book?.chapters.find(item => item.id === chapterId)?.panels.find(item => item.id === panelId);
        if (!panel) throw new Error('找不到这一格分镜，可能已被删除');
        const route = imageRoute();
        const char = charById(book.charId);
        let result;
        if (route.provider === 'novelai') {
            if (!panel.scene && !(panel.chars || []).some(person => person.tags)) throw new Error('这一格没有 NovelAI 标签，请先在编辑里补上或重新生成分镜');
            result = await callNovelAiImageGeneration(naiInput(book, panel), { settings: route.settings, signal, usageFeature: 'comic', usageChar: char, onProgress: say });
        } else if (route.provider === 'api') {
            const refs = [book.charRef, book.userRef, book.extraRef].filter(Boolean);
            result = await callWechatImageGenerationApi(apiPrompt(book, panel), { feature: 'comic', referenceImage: refs[0] || '', additionalReferences: refs.slice(1), size: shotOf(panel.shot).api, requireReference: false, usageChar: char });
        } else {
            throw new Error('还没有可用的生图服务：设置 → API → 生图服务');
        }
        if (result?.cancelled) return { ok: false, cancelled: true };
        if (!result?.ok || !result.url) {
            const error = result?.error || '生图服务没有返回图片';
            await mutatePanel(bookId, chapterId, panelId, (_, __, target) => { target.error = error; });
            return { ok: false, error };
        }
        const key = await storeImage(result.url);
        const oldKey = await mutatePanel(bookId, chapterId, panelId, (target, part, item) => {
            const previous = item.imageKey;
            item.imageKey = key;
            item.error = '';
            item.provider = route.provider;
            if (Number.isInteger(result.seed)) item.seed = result.seed;
            if (!target.coverKey || target.coverKey === previous) target.coverKey = part.panels[0]?.imageKey || key;
            return previous;
        });
        if (oldKey === null) {
            await remove('images', key).catch(console.warn);
            throw new Error('这一格在生成期间被删除，图片未保存');
        }
        const latest = await get('series', bookId);
        if (oldKey && oldKey !== latest?.coverKey) await remove('images', oldKey).catch(console.warn);
        return { ok: true };
    }
    // Long work (writing a storyboard, drawing pictures) runs as one background job so
    // navigation and small edits stay responsive; only one job runs at a time.
    async function withJob(kind, bookId, chapterId, fn) {
        if (state.job) throw new Error(state.job.kind === 'plan' ? '正在写另一个分镜，请稍等' : '正在生成另一组图片，请等它完成或先停止');
        const job = state.job = { kind, bookId, chapterId, controller: new AbortController(), total: 0, done: 0, current: '', error: '' };
        renderJob();
        try {
            return await fn(job);
        } finally {
            state.job = null;
            renderJob();
        }
    }
    function launch(task) {
        Promise.resolve().then(task).catch(error => { console.error('漫画任务失败', error); say(error.message || '操作失败', true); });
    }
    const watching = (bookId, chapterId) => state.seriesId === bookId && state.chapterId === chapterId;
    async function refreshIfWatching(bookId, chapterId) {
        if (watching(bookId, chapterId) && state.view === 'editor') await editor();
    }
    async function planChapter(bookId, chapterId, options = {}) {
        try {
            await withJob('plan', bookId, chapterId, async () => {
                await mutateChapter(bookId, chapterId, part => { part.state = 'planning'; part.planError = ''; });
                await refreshIfWatching(bookId, chapterId);
                await generatePlan(bookId, chapterId, options);
            });
        } catch (error) {
            await mutateChapter(bookId, chapterId, part => { if (!part.panels.length) part.state = 'failed'; part.planError = error.message || '分镜生成失败'; }).catch(() => {});
            throw error;
        } finally {
            await refreshIfWatching(bookId, chapterId);
        }
    }
    async function mutateChapter(bookId, chapterId, mutate) {
        const book = upgradeBook(await get('series', bookId));
        const part = book?.chapters.find(item => item.id === chapterId);
        if (!part) return null;
        const result = await mutate(part, book);
        part.updatedAt = Date.now();
        await save(book);
        return result;
    }
    async function startGeneration(bookId, chapterId, panelIds = null) {
        const book = upgradeBook(await get('series', bookId));
        const part = book?.chapters.find(item => item.id === chapterId);
        if (!part) throw new Error('找不到这一话');
        const targets = part.panels.filter(panel => panelIds ? panelIds.includes(panel.id) : !panel.imageKey).map(panel => panel.id);
        if (!targets.length) { say('这一话的图片都已经生成好了'); return; }
        let finishedJob = null;
        await withJob('render', bookId, chapterId, async job => {
            finishedJob = job;
            job.total = targets.length;
            await mutateChapter(bookId, chapterId, item => { item.state = 'generating'; });
            renderJob();
            for (const panelId of targets) {
                if (job.controller.signal.aborted) break;
                job.current = panelId;
                renderJob();
                refreshPanel(panelId);
                const outcome = await renderPanel(bookId, chapterId, panelId, job.controller.signal).catch(error => ({ ok: false, error: error.message }));
                if (outcome.cancelled) break;
                if (outcome.ok) job.done++;
                job.current = '';
                refreshPanel(panelId);
                renderJob();
                if (!outcome.ok) { job.error = outcome.error || '生成失败'; break; }
            }
        });
        const latest = upgradeBook(await get('series', bookId));
        const latestPart = latest?.chapters.find(item => item.id === chapterId);
        const complete = !!latestPart && latestPart.panels.length > 0 && latestPart.panels.every(panel => panel.imageKey);
        if (latestPart) {
            latestPart.state = complete ? 'done' : 'planned';
            if (complete && latest.status === 'draft') latest.status = typeOf(latest.type).series ? 'ongoing' : 'complete';
            await save(latest);
        }
        if (finishedJob?.error) say(finishedJob.error, true);
        else if (finishedJob?.controller.signal.aborted) say(`已停止，完成 ${finishedJob.done}/${finishedJob.total} 张`);
        else if (complete) say(`《${latest.title}》${typeOf(latest.type).series ? latestPart.title : ''}完成了`);
        if (watching(bookId, chapterId) && state.view === 'editor') {
            if (complete && !finishedJob?.error) await viewer();
            else await editor();
        }
    }
    function stopGeneration() {
        state.job?.controller.abort();
    }
    // Typesetting: the same bubble geometry drives the HTML reader and the canvas export.
    // Sizes are fractions of the panel width (CSS uses cqw on the panel container).
    const BUBBLE = { font: 0.0385, lineHeight: 1.42, padX: 0.034, padY: 0.022, maxWidth: 0.46, narrationWidth: 0.62, sfxFont: 0.085 };
    const panelRatio = panel => {
        const [w, h] = shotOf(panel.shot).nai;
        return `${w} / ${h}`;
    };
    function bubbleHtml(bubble) {
        const x = clamp(Number(bubble.x ?? 0.05), 0, 0.95) * 100;
        const y = clamp(Number(bubble.y ?? 0.05), 0, 0.97) * 100;
        const side = Number(bubble.x ?? 0) >= 0.45 ? 'tail-right' : 'tail-left';
        return `<div class="ct-bubble kind-${esc(bubble.kind)} who-${esc(bubble.who)} ${side}" data-bubble="${esc(bubble.id)}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%"><span>${esc(bubble.text)}</span></div>`;
    }
    function panelHtml(panel, options = {}) {
        const art = `<div class="ct-panel-art${panel.imageKey ? '' : ' empty'}" data-image="${esc(panel.imageKey || '')}" data-alt="${esc(panel.beat)}" style="aspect-ratio:${panelRatio(panel)}">${panel.imageKey ? '' : `<div class="ct-panel-missing"><i class="${panel.error ? 'ri-error-warning-line' : 'ri-image-line'}"></i><span>${esc(panel.error || '图片尚未生成')}</span></div>`}${(panel.bubbles || []).map(bubbleHtml).join('')}</div>`;
        return `<figure class="ct-panel shot-${esc(panel.shot)}${options.bordered ? ' bordered' : ''}" data-panel="${esc(panel.id)}">${art}</figure>`;
    }
    // Bubbles store their top-left corner; like the canvas export, keep them inside the panel.
    function fitBubbles(scope = root()) {
        scope?.querySelectorAll('.ct-panel-art').forEach(art => {
            const box = art.getBoundingClientRect();
            if (!box.width || !box.height) return;
            art.querySelectorAll('.ct-bubble').forEach(node => {
                const rect = node.getBoundingClientRect();
                if (rect.right > box.right - 2) node.style.left = `${Math.max(0, (box.width - rect.width - 4) / box.width * 100).toFixed(2)}%`;
                if (rect.bottom > box.bottom - 2) node.style.top = `${Math.max(0, (box.height - rect.height - 4) / box.height * 100).toFixed(2)}%`;
            });
        });
    }
    function gutterHtml(panel, last) {
        const height = last ? 0 : gutterOf(panel.gutter).view;
        return height ? `<div class="ct-gutter tone-${panel.tone === 'dark' ? 'dark' : 'light'}" style="height:${height}px"></div>` : '';
    }
    const stamp = time => { const d = new Date(time || Date.now()); return `'${String(d.getFullYear()).slice(2)} ${d.getMonth() + 1} ${d.getDate()}`; };
    function pieceHtml(book, part) {
        const type = typeOf(book.type);
        const panels = part.panels || [];
        if (type.layout === 'strip') {
            return `<div class="ct-strip">${panels.map((panel, index) => panelHtml(panel) + gutterHtml(panel, index === panels.length - 1)).join('')}</div>`;
        }
        if (type.layout === 'yonkoma') {
            return `<div class="ct-yonkoma"><header><strong>${esc(book.title)}</strong><span>${esc(book.charName)} × ${esc(book.userName)}</span></header>${panels.map(panel => panelHtml(panel, { bordered: true })).join('')}<footer>BYND COMICS · ${esc(date(part.updatedAt))}</footer></div>`;
        }
        if (type.layout === 'polaroid') {
            const panel = panels[0] || {};
            return `<div class="ct-polaroid"><div class="ct-polaroid-photo">${panels[0] ? panelHtml(panel) : ''}<time>${esc(stamp(part.createdAt))}</time></div><p>${esc(part.caption || `${book.charName} & ${book.userName}`)}</p></div>`;
        }
        if (type.layout === 'poster') {
            const poster = part.poster || {};
            return `<div class="ct-poster">${panels[0] ? panelHtml(panels[0]) : ''}<div class="ct-poster-type"><small>${esc(poster.subtitle || 'A BYND ORIGINAL')}</small><strong>${esc(poster.title || book.title)}</strong><em>${esc(poster.tagline || book.logline || '')}</em><span>${esc(poster.credits || `主演 ${book.charName} · ${book.userName}`)}</span><b>${esc(poster.date || date(part.createdAt))}</b></div></div>`;
        }
        if (type.layout === 'wallpaper') {
            const now = new Date();
            return `<div class="ct-wallpaper"><div class="ct-wallpaper-phone">${panels[0] ? panelHtml(panels[0]) : ''}<div class="ct-wallpaper-clock"><small>${esc(now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }))}</small><strong>${esc(now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }))}</strong></div></div></div>`;
        }
        return `<article class="ct-illust">${panels.map(panel => panelHtml(panel)).join('<div class="ct-gutter tone-light" style="height:14px"></div>')}<h2>${esc(book.title)}</h2>${part.story ? `<p>${esc(part.story).replace(/\n/g, '<br>')}</p>` : ''}<small>${esc(book.charName)} × ${esc(book.userName)} · ${esc(date(part.createdAt))}</small></article>`;
    }
    // ---- canvas export ----
    const FONT_SANS = '"PingFang SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif';
    const FONT_SERIF = '"Noto Serif SC","Songti SC","STSong",serif';
    function loadPicture(source) {
        return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('图片无法读取')); img.src = source; });
    }
    function wrapLines(ctx, text, maxWidth) {
        const lines = [];
        for (const paragraph of String(text || '').split('\n')) {
            let line = '';
            for (const char of paragraph) {
                if (line && ctx.measureText(line + char).width > maxWidth) { lines.push(line); line = char; }
                else line += char;
            }
            lines.push(line);
        }
        return lines.filter((line, index, list) => line || index < list.length - 1);
    }
    function roundRect(ctx, x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    }
    function drawBubble(ctx, bubble, box) {
        const unit = box.w;
        const kind = bubble.kind || 'speech';
        if (kind === 'sfx') {
            const size = Math.round(unit * BUBBLE.sfxFont);
            ctx.save();
            ctx.font = `900 ${size}px ${FONT_SANS}`;
            const x = box.x + clamp(Number(bubble.x ?? 0.5), 0, 0.9) * box.w;
            const y = box.y + clamp(Number(bubble.y ?? 0.45), 0, 0.95) * box.h + size;
            ctx.translate(x, y);
            ctx.rotate(-0.12);
            ctx.lineJoin = 'round';
            ctx.lineWidth = size * 0.16;
            ctx.strokeStyle = '#111';
            ctx.strokeText(bubble.text, 0, 0);
            ctx.fillStyle = '#fff';
            ctx.fillText(bubble.text, 0, 0);
            ctx.restore();
            return;
        }
        const narration = kind === 'narration' || kind === 'caption';
        const size = unit * BUBBLE.font * (kind === 'shout' ? 1.14 : 1);
        ctx.save();
        ctx.font = `${kind === 'shout' ? 800 : narration ? 500 : 600} ${size}px ${FONT_SANS}`;
        const padX = unit * BUBBLE.padX, padY = unit * BUBBLE.padY;
        const lines = wrapLines(ctx, bubble.text, unit * (narration ? BUBBLE.narrationWidth : BUBBLE.maxWidth) - padX * 2);
        const lineHeight = size * BUBBLE.lineHeight;
        const w = Math.max(...lines.map(line => ctx.measureText(line).width)) + padX * 2;
        const h = lines.length * lineHeight + padY * 2;
        const x = clamp(box.x + Number(bubble.x ?? 0.05) * box.w, box.x + 4, box.x + box.w - w - 4);
        const y = clamp(box.y + Number(bubble.y ?? 0.05) * box.h, box.y + 4, box.y + box.h - h - 4);
        const right = Number(bubble.x ?? 0) >= 0.45;
        if (narration) {
            ctx.fillStyle = kind === 'caption' ? 'rgba(255,255,255,0.94)' : '#15151a';
            ctx.fillRect(x, y, w, h);
            if (kind === 'caption') { ctx.strokeStyle = '#15151a'; ctx.lineWidth = unit * 0.004; ctx.strokeRect(x, y, w, h); }
            ctx.fillStyle = kind === 'caption' ? '#15151a' : '#fff';
        } else {
            const stroke = unit * (kind === 'shout' ? 0.007 : 0.0045);
            ctx.lineWidth = stroke;
            ctx.strokeStyle = '#15151a';
            ctx.fillStyle = '#fff';
            if (kind === 'thought' || kind === 'whisper') ctx.setLineDash([unit * 0.012, unit * 0.008]);
            roundRect(ctx, x, y, w, h, kind === 'shout' ? h * 0.18 : h / 2);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
            if (kind === 'thought') {
                for (const [dx, dy, r] of [[0.16, 0.2, 0.012], [0.08, 0.42, 0.008]]) {
                    ctx.beginPath();
                    ctx.arc(right ? x + w - unit * dx : x + unit * dx, y + h + unit * dy * 0.3, unit * r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            } else {
                const tailX = right ? x + w * 0.72 : x + w * 0.28;
                const tip = right ? tailX + unit * 0.03 : tailX - unit * 0.03;
                ctx.beginPath();
                ctx.moveTo(tailX - unit * 0.018, y + h - stroke);
                ctx.lineTo(tip, y + h + unit * 0.035);
                ctx.lineTo(tailX + unit * 0.018, y + h - stroke);
                ctx.fill();
                ctx.stroke();
                ctx.fillRect(tailX - unit * 0.016, y + h - stroke * 2.2, unit * 0.032, stroke * 2);
            }
            ctx.fillStyle = kind === 'whisper' ? '#5b5b66' : '#15151a';
        }
        ctx.textBaseline = 'middle';
        ctx.textAlign = narration ? 'left' : 'center';
        lines.forEach((line, index) => ctx.fillText(line, narration ? x + padX : x + w / 2, y + padY + lineHeight * (index + 0.5)));
        ctx.restore();
    }
    async function panelPicture(panel, index) {
        const source = await image(panel.imageKey);
        if (!source) throw new Error(`第 ${index + 1} 格还没有图片`);
        return loadPicture(source);
    }
    function drawPanel(ctx, picture, panel, box) {
        ctx.drawImage(picture, box.x, box.y, box.w, box.h);
        for (const bubble of panel.bubbles || []) drawBubble(ctx, bubble, box);
    }
    function textBlock(ctx, text, width, font, lineHeight) {
        ctx.font = font;
        return { lines: wrapLines(ctx, text, width), lineHeight };
    }
    async function composePiece(book, part) {
        const type = typeOf(book.type);
        const panels = part.panels || [];
        if (!panels.length) throw new Error('这一话还没有分镜');
        const pictures = [];
        for (let index = 0; index < panels.length; index++) pictures.push(await panelPicture(panels[index], index));
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const W = 1080;
        if (type.layout === 'wallpaper') {
            canvas.width = pictures[0].naturalWidth;
            canvas.height = pictures[0].naturalHeight;
            ctx.drawImage(pictures[0], 0, 0);
            return canvas;
        }
        if (type.layout === 'strip') {
            const heights = pictures.map(picture => Math.round(picture.naturalHeight * W / picture.naturalWidth));
            const gaps = panels.map((panel, index) => index === panels.length - 1 ? 0 : Math.round(gutterOf(panel.gutter).px * W / 800));
            const total = heights.reduce((sum, h) => sum + h, 0) + gaps.reduce((sum, g) => sum + g, 0);
            if (total > 30000) throw new Error('这一话太长，无法拼成一张长图；请改用“逐格 ZIP”导出');
            canvas.width = W; canvas.height = total;
            let y = 0;
            panels.forEach((panel, index) => {
                drawPanel(ctx, pictures[index], panel, { x: 0, y, w: W, h: heights[index] });
                y += heights[index];
                if (gaps[index]) { ctx.fillStyle = panel.tone === 'dark' ? '#0c0c0f' : '#ffffff'; ctx.fillRect(0, y, W, gaps[index]); y += gaps[index]; }
            });
            return canvas;
        }
        if (type.layout === 'yonkoma') {
            const margin = 64, gap = 30, head = 150, foot = 90, inner = W - margin * 2;
            const heights = pictures.map(picture => Math.round(picture.naturalHeight * inner / picture.naturalWidth));
            canvas.width = W; canvas.height = head + heights.reduce((sum, h) => sum + h, 0) + gap * (panels.length - 1) + foot;
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, canvas.height);
            ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.font = `800 46px ${FONT_SANS}`; ctx.fillText(book.title, W / 2, 84);
            ctx.font = `500 24px ${FONT_SANS}`; ctx.fillStyle = '#777'; ctx.fillText(`${book.charName} × ${book.userName}`, W / 2, 122);
            let y = head;
            panels.forEach((panel, index) => {
                const box = { x: margin, y, w: inner, h: heights[index] };
                drawPanel(ctx, pictures[index], panel, box);
                ctx.lineWidth = 5; ctx.strokeStyle = '#111'; ctx.strokeRect(box.x, box.y, box.w, box.h);
                y += heights[index] + gap;
            });
            ctx.font = `600 20px ${FONT_SANS}`; ctx.fillStyle = '#aaa'; ctx.textAlign = 'center';
            ctx.fillText(`BYND COMICS · ${date(part.updatedAt)}`, W / 2, canvas.height - 36);
            return canvas;
        }
        if (type.layout === 'polaroid') {
            const side = 70, photo = W - side * 2, bottom = 260;
            canvas.width = W; canvas.height = side + photo + bottom;
            ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, W, canvas.height);
            const box = { x: side, y: side, w: photo, h: photo };
            const picture = pictures[0];
            const crop = Math.min(picture.naturalWidth, picture.naturalHeight);
            ctx.drawImage(picture, (picture.naturalWidth - crop) / 2, (picture.naturalHeight - crop) / 2, crop, crop, box.x, box.y, box.w, box.h);
            for (const bubble of panels[0].bubbles || []) drawBubble(ctx, bubble, box);
            ctx.font = `700 34px "Courier New",monospace`; ctx.fillStyle = '#ff8a1f'; ctx.textAlign = 'right';
            ctx.shadowColor = 'rgba(255,120,0,0.6)'; ctx.shadowBlur = 8;
            ctx.fillText(stamp(part.createdAt), box.x + box.w - 30, box.y + box.h - 30);
            ctx.shadowBlur = 0;
            ctx.font = `500 46px "Kaiti SC","STKaiti","KaiTi",${FONT_SERIF}`; ctx.fillStyle = '#34302b'; ctx.textAlign = 'center';
            ctx.fillText(part.caption || `${book.charName} & ${book.userName}`, W / 2, side + photo + 140, W - side * 2);
            return canvas;
        }
        if (type.layout === 'poster') {
            const picture = pictures[0];
            const H = Math.round(picture.naturalHeight * W / picture.naturalWidth);
            canvas.width = W; canvas.height = H;
            drawPanel(ctx, picture, panels[0], { x: 0, y: 0, w: W, h: H });
            const shade = ctx.createLinearGradient(0, H * 0.52, 0, H);
            shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.82)');
            ctx.fillStyle = shade; ctx.fillRect(0, H * 0.52, W, H * 0.48);
            const poster = part.poster || {};
            ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
            ctx.font = `600 26px ${FONT_SANS}`; ctx.globalAlpha = 0.86;
            ctx.fillText((poster.subtitle || 'A BYND ORIGINAL').toUpperCase(), W / 2, H - 330, W - 120);
            ctx.globalAlpha = 1;
            ctx.font = `900 118px ${FONT_SERIF}`; ctx.fillText(poster.title || book.title, W / 2, H - 200, W - 100);
            ctx.font = `500 34px ${FONT_SANS}`; ctx.fillText(poster.tagline || book.logline || '', W / 2, H - 138, W - 140);
            ctx.font = `400 22px ${FONT_SANS}`; ctx.globalAlpha = 0.78;
            ctx.fillText(poster.credits || `主演 ${book.charName} · ${book.userName}`, W / 2, H - 84, W - 120);
            ctx.font = `800 26px ${FONT_SANS}`; ctx.globalAlpha = 1;
            ctx.fillText(poster.date || date(part.createdAt), W / 2, H - 42, W - 120);
            return canvas;
        }
        // illustration / couple: pictures stacked with a story block underneath.
        const pad = 70;
        const heights = pictures.map(picture => Math.round(picture.naturalHeight * W / picture.naturalWidth));
        const measure = document.createElement('canvas').getContext('2d');
        const title = textBlock(measure, book.title, W - pad * 2, `800 52px ${FONT_SERIF}`, 70);
        const story = textBlock(measure, part.story || '', W - pad * 2, `400 34px ${FONT_SERIF}`, 64);
        const textHeight = 90 + title.lines.length * title.lineHeight + (part.story ? 30 + story.lines.length * story.lineHeight : 0) + 110;
        canvas.width = W; canvas.height = heights.reduce((sum, h) => sum + h, 0) + 24 * (pictures.length - 1) + textHeight;
        ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, W, canvas.height);
        let y = 0;
        panels.forEach((panel, index) => { drawPanel(ctx, pictures[index], panel, { x: 0, y, w: W, h: heights[index] }); y += heights[index] + 24; });
        y += 66;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#1c1916';
        ctx.font = `800 52px ${FONT_SERIF}`;
        title.lines.forEach(line => { ctx.fillText(line, pad, y + 52); y += title.lineHeight; });
        if (part.story) {
            y += 30; ctx.font = `400 34px ${FONT_SERIF}`; ctx.fillStyle = '#3d3831';
            story.lines.forEach(line => { ctx.fillText(line, pad, y + 34); y += story.lineHeight; });
        }
        ctx.font = `500 24px ${FONT_SANS}`; ctx.fillStyle = '#a39b90';
        ctx.fillText(`${book.charName} × ${book.userName} · ${date(part.createdAt)}`, pad, canvas.height - 56);
        return canvas;
    }
    async function pieceBlob(book, part, format = 'image/png') {
        const canvas = await composePiece(book, part);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, format, 0.92));
        if (!blob) throw new Error('成品图导出失败，图片可能太大');
        return blob;
    }
    async function download(data, filename, type) {
        const blob = data instanceof Blob ? data : new Blob([data], { type });
        const bridge = window.ByndAndroid;
        if (bridge?.beginDocumentExport && bridge?.appendBackupExportChunk && bridge?.finishBackupExport) {
            return new Promise((resolve, reject) => {
                const token = id('comicexport');
                let done = false;
                const cleanup = () => {
                    window.removeEventListener('bynd:backup-export-ready', ready);
                    window.removeEventListener('bynd:backup-export', finished);
                    clearTimeout(timer);
                };
                const fail = error => {
                    if (done) return;
                    done = true; cleanup();
                    try { bridge.abortBackupExport(token); } catch (_) {}
                    reject(error instanceof Error ? error : new Error(String(error)));
                };
                const finished = event => {
                    if (event.detail?.id !== token || done) return;
                    if (!event.detail.ok) return fail(new Error(event.detail.message || '导出失败'));
                    done = true; cleanup(); resolve(event.detail.message || '文件已保存');
                };
                const ready = async event => {
                    if (event.detail?.id !== token || done) return;
                    try {
                        for (let offset = 0; offset < blob.size; offset += 192 * 1024) {
                            const chunk = blob.slice(offset, offset + 192 * 1024);
                            const base64 = await new Promise((resolveChunk, rejectChunk) => {
                                const reader = new FileReader();
                                reader.onload = () => resolveChunk(String(reader.result).split(',')[1] || '');
                                reader.onerror = () => rejectChunk(new Error('导出文件读取失败'));
                                reader.readAsDataURL(chunk);
                            });
                            if (done) return;
                            const accepted = bridge.appendBackupExportChunk(token, base64);
                            if (accepted !== true && accepted !== 'true') throw new Error('导出分段写入失败');
                            await new Promise(next => setTimeout(next, 0));
                        }
                        bridge.finishBackupExport(token);
                    } catch (error) { fail(error); }
                };
                const timer = setTimeout(() => fail(new Error('系统文件选择或写入超时')), 120000);
                window.addEventListener('bynd:backup-export-ready', ready);
                window.addEventListener('bynd:backup-export', finished);
                try { bridge.beginDocumentExport(token, filename, type); } catch (error) { fail(error); }
            });
        }
        const url = URL.createObjectURL(blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = filename; document.body.appendChild(anchor);
        anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    async function exportProject(book) {
        const keys = new Set([book.coverKey, ...book.chapters.flatMap(part => part.panels.map(panel => panel.imageKey))].filter(Boolean));
        const images = {};
        for (const key of keys) images[key] = await image(key);
        return download(JSON.stringify({ format: 'bynd-comic', version: 2, series: book, images }, null, 2), `${book.title}.bynd-comic.json`, 'application/json');
    }
    async function importProject(file) {
        let payload;
        try { payload = JSON.parse(await file.text()); } catch (_) { throw new Error('文件不是有效的漫画项目 JSON'); }
        if (payload?.format !== 'bynd-comic' || !payload.series || !Array.isArray(payload.series.chapters)) throw new Error('这不是有效的 BYND 漫画项目');
        const book = upgradeBook(structuredClone(payload.series));
        book.id = id('series'); book.createdAt = Date.now(); book.updatedAt = Date.now();
        const keys = [...new Set([book.coverKey, ...book.chapters.flatMap(part => part.panels.map(panel => panel.imageKey))].filter(Boolean))];
        for (const key of keys) if (!/^data:image\/(png|jpeg|webp);base64,/i.test(payload.images?.[key] || '')) throw new Error(`项目缺少有效图片 ${key}`);
        const remap = new Map();
        for (const key of keys) { const next = id('img'); await put('images', { id: next, data: payload.images[key] }); remap.set(key, next); }
        book.coverKey = remap.get(book.coverKey) || '';
        for (const part of book.chapters) for (const panel of part.panels) panel.imageKey = remap.get(panel.imageKey) || '';
        await save(book);
        return book;
    }
    function toBytes(dataUrl) { const [head, body] = dataUrl.split(','); const raw = atob(body); const bytes = Uint8Array.from(raw, char => char.charCodeAt(0)); return { bytes, mime: head.match(/data:([^;]+)/)?.[1] || 'image/png' }; }
    const safeName = text => String(text || 'BYND').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'BYND';
    async function savePiece(book, part) {
        const blob = await pieceBlob(book, part);
        const title = typeOf(book.type).series ? `${book.title} ${part.title}` : book.title;
        return download(blob, `${safeName(title)}.png`, 'image/png');
    }
    async function exportZip(book, part) {
        const files = [];
        for (let index = 0; index < part.panels.length; index++) {
            const source = await image(part.panels[index].imageKey);
            if (!source) throw new Error(`第 ${index + 1} 格还没有图片`);
            const decoded = toBytes(source);
            files.push({ name: `${String(index + 1).padStart(3, '0')}.${decoded.mime === 'image/jpeg' ? 'jpg' : decoded.mime === 'image/webp' ? 'webp' : 'png'}`, bytes: decoded.bytes });
        }
        if (!files.length) throw new Error('这一话还没有图片');
        return download(makeZip(files), `${safeName(`${book.title} ${part.title}`)}.zip`, 'application/zip');
    }
    async function exportPdf(book, part) {
        const pages = [];
        for (let index = 0; index < part.panels.length; index++) {
            const panel = part.panels[index];
            const picture = await panelPicture(panel, index);
            const canvas = document.createElement('canvas');
            canvas.width = picture.naturalWidth; canvas.height = picture.naturalHeight;
            drawPanel(canvas.getContext('2d'), picture, panel, { x: 0, y: 0, w: canvas.width, h: canvas.height });
            pages.push({ width: canvas.width, height: canvas.height, bytes: toBytes(canvas.toDataURL('image/jpeg', 0.9)).bytes });
        }
        if (!pages.length) throw new Error('这一话还没有图片');
        return download(makePdf(pages), `${safeName(`${book.title} ${part.title}`)}.pdf`, 'application/pdf');
    }
    // Wallpapers live in the theme data (localStorage), so they are re-encoded small enough to fit.
    async function setWallpaper(book, part, target) {
        const source = await image(part.panels[0]?.imageKey);
        if (!source) throw new Error('壁纸还没有生成图片');
        const picture = await loadPicture(source);
        const scale = Math.min(1, 1080 / picture.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(picture.naturalWidth * scale); canvas.height = Math.round(picture.naturalHeight * scale);
        canvas.getContext('2d').drawImage(picture, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        let theme = {};
        try { theme = JSON.parse(localStorage.getItem('my_theme_data') || '{}') || {}; } catch (_) {}
        const field = target === 'lock' ? 'wpLock' : 'wpHome';
        theme[field] = dataUrl;
        try { localStorage.setItem('my_theme_data', JSON.stringify(theme)); } catch (error) {
            throw new Error(error?.name === 'QuotaExceededError' ? '存储空间不足，壁纸没有保存；请先在“数据管理”里清理缓存' : `壁纸保存失败：${error.message}`);
        }
        const input = document.getElementById(target === 'lock' ? 'input-wp-lock' : 'input-wp-home');
        if (input) input.value = dataUrl;
        const screen = document.getElementById(target === 'lock' ? 'lock-screen' : 'home-screen');
        if (screen) { screen.style.backgroundImage = `url('${dataUrl}')`; screen.style.backgroundSize = 'cover'; }
        if (typeof checkImageBrightness === 'function') checkImageBrightness(dataUrl, target === 'lock' ? 'lock' : 'home');
        if (target === 'lock' && typeof applyLockscreenAdaptiveTheme === 'function') applyLockscreenAdaptiveTheme(dataUrl);
        if (target !== 'lock' && typeof applyByndAdaptiveTheme === 'function') applyByndAdaptiveTheme(dataUrl);
    }
    const crcTable = Array.from({ length: 256 }, (_, i) => { let c = i; for (let n = 0; n < 8; n++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    function makeZip(files) {
        const encoder = new TextEncoder(), chunks = [], directory = [];
        let offset = 0;
        const set16 = (view, at, value) => view.setUint16(at, value, true);
        const set32 = (view, at, value) => view.setUint32(at, value >>> 0, true);
        for (const file of files) {
            const name = encoder.encode(file.name), data = file.bytes;
            let crc = 0xffffffff;
            for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
            crc = (crc ^ 0xffffffff) >>> 0;
            const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
            set32(lv, 0, 0x04034b50); set16(lv, 4, 20);
            set32(lv, 14, crc); set32(lv, 18, data.length); set32(lv, 22, data.length);
            set16(lv, 26, name.length); local.set(name, 30);
            chunks.push(local, data);
            const entry = new Uint8Array(46 + name.length), ev = new DataView(entry.buffer);
            set32(ev, 0, 0x02014b50); set16(ev, 4, 20); set16(ev, 6, 20);
            set32(ev, 16, crc); set32(ev, 20, data.length); set32(ev, 24, data.length);
            set16(ev, 28, name.length); set32(ev, 42, offset); entry.set(name, 46);
            directory.push(entry); offset += local.length + data.length;
        }
        const size = directory.reduce((total, entry) => total + entry.length, 0);
        const footer = new Uint8Array(22), view = new DataView(footer.buffer);
        set32(view, 0, 0x06054b50); set16(view, 8, files.length); set16(view, 10, files.length);
        set32(view, 12, size); set32(view, 16, offset);
        return new Blob([...chunks, ...directory, footer], { type: 'application/zip' });
    }
    function makePdf(pages) { const enc=new TextEncoder(), parts=[], offsets=[0]; let length=0; const add=value=>{const bytes=typeof value==='string'?enc.encode(value):value; parts.push(bytes); length+=bytes.length;}; add('%PDF-1.4\n'); const objects=[]; const count=2+pages.length*3; objects[1]='<< /Type /Catalog /Pages 2 0 R >>'; objects[2]=`<< /Type /Pages /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] /Count ${pages.length} >>`; pages.forEach((page,i)=>{const base=3+i*3; objects[base]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Im${i} ${base+1} 0 R >> >> /Contents ${base+2} 0 R >>`; objects[base+1]=[`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,page.bytes,'\nendstream'];const stream=`q ${page.width} 0 0 ${page.height} 0 0 cm /Im${i} Do Q`;objects[base+2]=`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}\nendstream`;}); for(let i=1;i<=count;i++){offsets[i]=length;add(`${i} 0 obj\n`);const obj=objects[i]; if(Array.isArray(obj)) obj.forEach(add); else add(obj); add('\nendobj\n');} const xref=length;add(`xref\n0 ${count+1}\n0000000000 65535 f \n`);for(let i=1;i<=count;i++) add(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);add(`trailer\n<< /Size ${count+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);return new Blob(parts,{type:'application/pdf'}); }
    // ---- shell ----
    function frame({ body, title = '', back = 'home', right = '', tabs = false, className = '', brand = false }) {
        const host = root();
        if (!host) return;
        const head = brand
            ? `<header class="ct-header brand"><button type="button" class="ct-icon" data-action="close" aria-label="关闭"><i class="ri-arrow-left-s-line"></i></button><div class="ct-wordmark"><b>BYND</b><span>COMICS</span></div><div class="ct-header-right">${right}</div></header>`
            : `<header class="ct-header"><button type="button" class="ct-icon" data-action="back" data-view="${esc(back)}" aria-label="返回"><i class="ri-arrow-left-s-line"></i></button><strong class="ct-header-title">${esc(title)}</strong><div class="ct-header-right">${right}</div></header>`;
        const nav = tabs ? `<nav class="ct-tabs">${[['home', '首页'], ['shelf', '书架'], ['materials', '素材']].map(([key, label]) => `<button type="button" data-action="tab" data-id="${key}" class="${state.tab === key ? 'active' : ''}">${label}</button>`).join('')}</nav>` : '';
        host.innerHTML = `<div class="ct-shell ${esc(className)}">${head}${nav}<div class="ct-status${state.status ? '' : ' hidden'}${state.statusError ? ' error' : ''}">${esc(state.status)}</div><div class="ct-job-slot"></div><main class="ct-main">${body}</main></div>`;
        renderJob();
    }
    function renderJob() {
        const slot = root()?.querySelector('.ct-job-slot');
        if (!slot) return;
        const job = state.job;
        if (!job) { slot.innerHTML = ''; return; }
        if (job.kind === 'plan') {
            slot.innerHTML = '<div class="ct-job planning"><div class="ct-job-text"><i class="ri-quill-pen-line"></i><span>正在写分镜和台词…</span></div><div class="ct-job-bar indeterminate"><i></i></div></div>';
            return;
        }
        const percent = job.total ? Math.round(job.done / job.total * 100) : 0;
        slot.innerHTML = `<div class="ct-job"><div class="ct-job-text"><i class="ri-brush-3-line"></i><span>正在画第 ${Math.min(job.done + 1, job.total)} / ${job.total} 张</span></div><button type="button" data-action="stop-job">停止</button><div class="ct-job-bar"><i style="width:${percent}%"></i></div></div>`;
    }
    function typeBadge(key) {
        const type = typeOf(key);
        return `<span class="ct-type-badge type-${esc(key)}">${esc(type.short)}</span>`;
    }
    function coverHtml(book, className = 'ct-cover') {
        return `<div class="${className}" data-image="${esc(book.coverKey || '')}" data-alt="${esc(book.title)}"><div class="ct-cover-fallback type-${esc(book.type)}"><i class="${typeOf(book.type).icon}"></i><span>${esc(book.title)}</span></div></div>`;
    }
    const latestChapter = book => book.chapters.at(-1);
    const doneChapters = book => book.chapters.filter(part => part.panels.length && part.panels.every(panel => panel.imageKey));
    function posterCard(book) {
        const series = typeOf(book.type).series;
        const count = doneChapters(book).length;
        return `<button type="button" class="ct-poster-card" data-action="open-book" data-id="${esc(book.id)}">${coverHtml(book)}<div class="ct-poster-badges">${isRecent(book.updatedAt) ? '<em class="ct-up">UP</em>' : ''}${book.status === 'draft' ? '<em class="ct-draft">草稿</em>' : ''}</div><strong>${esc(book.title)}</strong><span>${esc(book.charName)} × ${esc(book.userName)}</span><small>${typeBadge(book.type)}${series ? `${count} 话` : esc(date(book.updatedAt))}</small></button>`;
    }
    // ---- home / shelf / materials ----
    function heroSlide(book) {
        const part = latestChapter(book);
        const series = typeOf(book.type).series;
        return `<button type="button" class="ct-hero-slide" data-action="open-book" data-id="${esc(book.id)}"><div class="ct-hero-art" data-image="${esc(book.coverKey)}" data-alt="${esc(book.title)}"></div><div class="ct-hero-text">${typeBadge(book.type)}<strong>${esc(book.title)}</strong>${book.logline ? `<em>${esc(book.logline)}</em>` : ''}<small>${esc(book.charName)} × ${esc(book.userName)}${series && part ? ` · ${esc(part.title)}` : ''}</small></div></button>`;
    }
    function charRow() {
        const list = chars();
        if (!list.length) return '';
        const item = (key, label, avatar) => `<button type="button" data-action="char-filter" data-id="${esc(key)}" class="${state.charFilter === key ? 'active' : ''}"><span class="ct-avatar">${avatar ? `<img src="${esc(avatar)}" alt="" onerror="this.remove()">` : ''}<i>${esc(label.slice(0, 1))}</i></span><em>${esc(label)}</em></button>`;
        return `<div class="ct-char-row">${item('', '全部', '')}${list.map(char => item(String(char.id), nameOf(char), avatarOf(char))).join('')}</div>`;
    }
    function typeTabs() {
        return `<div class="ct-type-tabs">${['all', ...TYPE_ORDER].map(key => `<button type="button" data-action="type-filter" data-id="${key}" class="${state.typeFilter === key ? 'active' : ''}">${key === 'all' ? '全部' : esc(typeOf(key).short)}</button>`).join('')}</div>`;
    }
    const importInput = '<input id="ct-import-file" type="file" accept="application/json,.json" hidden>';
    async function home() {
        state.view = 'home'; state.tab = 'home';
        const books = await series();
        const filtered = books.filter(book => (state.typeFilter === 'all' || book.type === state.typeFilter) && (!state.charFilter || String(book.charId) === state.charFilter));
        const featured = books.filter(book => book.coverKey).slice(0, 5);
        const hero = featured.length
            ? `<section class="ct-hero"><div class="ct-hero-track">${featured.map(heroSlide).join('')}</div><span class="ct-hero-count">1 / ${featured.length}</span></section>`
            : `<section class="ct-intro"><span>BYND ORIGINAL</span><h1>把你们的故事<br>画成连载</h1><p>选角色和作品类型，Char 写分镜，生图后自动排版进书架。</p><button type="button" data-action="create">开始创作</button></section>`;
        const empty = `<div class="ct-empty"><i class="ri-book-open-line"></i><strong>${books.length ? '这个分类还没有作品' : '书架还是空的'}</strong><p>${books.length ? '换个分类看看，或者画一部新的。' : '从一段聊天、一个设定，或者让 Char 自己来想。'}</p><button type="button" data-action="create">新作品</button></div>`;
        frame({
            brand: true,
            tabs: true,
            right: '<button type="button" class="ct-icon" data-action="import-project" aria-label="导入漫画项目"><i class="ri-folder-download-line"></i></button>',
            body: `${hero}${charRow()}${typeTabs()}<div class="ct-grid">${filtered.map(posterCard).join('') || empty}</div><button type="button" class="ct-fab" data-action="create"><i class="ri-quill-pen-fill"></i><span>创作</span></button>${importInput}`
        });
        const track = root().querySelector('.ct-hero-track');
        if (track) track.onscroll = () => {
            const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
            const counter = root().querySelector('.ct-hero-count');
            if (counter) counter.textContent = `${index + 1} / ${featured.length}`;
        };
        await fillImages();
    }
    async function shelf() {
        state.view = 'shelf'; state.tab = 'shelf';
        const books = await series();
        if (state.shelfSort === 'created') books.sort((a, b) => b.createdAt - a.createdAt);
        const row = book => {
            const read = book.chapters.find(part => part.id === book.lastReadId);
            return `<button type="button" class="ct-shelf-row" data-action="open-book" data-id="${esc(book.id)}"><div class="ct-shelf-thumb" data-image="${esc(book.coverKey || '')}"><i class="${typeOf(book.type).icon}"></i></div><div class="ct-shelf-info"><strong>${esc(book.title)}</strong><span>${typeBadge(book.type)}${esc(book.charName)} × ${esc(book.userName)}</span><small>${read ? `读到 ${esc(read.title)} · ` : ''}更新于 ${esc(date(book.updatedAt))}</small></div>${isRecent(book.updatedAt) ? '<em class="ct-up">UP</em>' : ''}</button>`;
        };
        frame({
            brand: true,
            tabs: true,
            right: '<button type="button" class="ct-icon" data-action="import-project" aria-label="导入漫画项目"><i class="ri-folder-download-line"></i></button>',
            body: `<div class="ct-shelf-tools"><strong>全部作品 <b>${books.length}</b></strong><div>${[['updated', '最近更新'], ['created', '最近创作']].map(([key, label]) => `<button type="button" data-action="shelf-sort" data-id="${key}" class="${state.shelfSort === key ? 'active' : ''}">${label}</button>`).join('')}</div></div><div class="ct-shelf-list">${books.map(row).join('') || '<div class="ct-empty"><i class="ri-bookmark-line"></i><strong>书架还是空的</strong><p>创作完成的作品会自动放进这里。</p></div>'}</div>${importInput}`
        });
        await fillImages();
    }
    async function materials() {
        state.view = 'materials'; state.tab = 'materials';
        const [items, profiles] = await Promise.all([all('materials'), all('profiles')]);
        const who = item => item.who === 'char' ? (nameOf(charById(item.key)) || '角色') : (item.key === 'default' ? '当前 User 人设' : ((typeof getWechatUserPersonaLibrary === 'function' ? getWechatUserPersonaLibrary() : []).find(persona => persona.id === item.key)?.title || 'User 人设'));
        frame({
            brand: true,
            tabs: true,
            body: `<section class="ct-section"><div class="ct-section-head"><strong>外观档案</strong><span>第一次画某个角色时自动记下，以后每部作品沿用，保证长相一致。</span></div>${profiles.map(item => `<div class="ct-profile-card"><div><b>${esc(who(item))}</b><em>${item.provider === 'novelai' ? 'NovelAI 标签' : '中转站描述'}</em></div><textarea data-profile="${esc(item.id)}" rows="3">${esc(item.text)}</textarea><button type="button" data-action="delete-profile" data-id="${esc(item.id)}">删除</button></div>`).join('') || '<p class="ct-muted">还没有档案，画完第一部作品就会出现。</p>'}</section><section class="ct-section"><div class="ct-section-head"><strong>参考素材</strong><span>中转站生图会用到的角色、服装、场景参考图。</span></div><form id="ct-material-form" class="ct-material-form"><input name="title" required maxlength="30" placeholder="素材名称"><select name="kind"><option value="char">Char 参考图</option><option value="user">User 参考图</option><option value="clothing">服装</option><option value="scene">场景</option><option value="style">画风</option></select><label class="ct-file"><i class="ri-image-add-line"></i><span>选择图片</span><input name="file" type="file" accept="image/png,image/jpeg,image/webp" required></label><button type="submit">保存素材</button></form><div class="ct-material-grid">${items.map(item => `<article><div data-image="${esc(item.imageKey)}"></div><strong>${esc(item.title)}</strong><small>${esc({ char: 'Char', user: 'User', clothing: '服装', scene: '场景', style: '画风' }[item.kind] || item.kind)}</small><button type="button" data-action="delete-material" data-id="${esc(item.id)}">删除</button></article>`).join('')}</div></section>`
        });
        await fillImages();
    }
    // ---- create ----
    function freshDraft(prefill = {}) {
        const source = state.source;
        const sourceChar = source && charById(source.charId);
        // A forum NPC post or user post has no character: ask instead of silently picking the first one.
        const needsChar = !!source && !sourceChar && !prefill.charId;
        const charId = needsChar ? '' : String(prefill.charId || sourceChar?.id || chars()[0]?.id || '');
        return {
            type: prefill.type || 'webtoon',
            charId,
            personaId: '',
            origin: source ? (source.kind === 'chat' ? 'chat' : source.kind) : 'chat',
            plot: prefill.plot || (source && source.kind !== 'chat' ? source.text || '' : ''),
            panels: typeOf(prefill.type || 'webtoon').defaultPanels,
            option: '',
            optionCustom: '',
            styleKey: 'manhwa',
            styleCustom: '',
            title: prefill.title || '',
            needsChar
        };
    }
    function typeCardArt(key) {
        const art = {
            webtoon: '<i></i><i></i><i></i>',
            yonkoma: '<i></i><i></i><i></i><i></i>',
            illust: '<i></i><b></b>',
            photo: '<i></i>',
            couple: '<i class="ri-hearts-fill"></i>',
            wallpaper: '<i></i><b>12:30</b>',
            poster: '<i></i><b></b><b></b>',
            special: '<i class="ri-sparkling-2-fill"></i><i></i>'
        }[key];
        return `<span class="ct-type-art art-${key}">${art}</span>`;
    }
    function createBody(draft) {
        const type = typeOf(draft.type);
        const char = charById(draft.charId);
        const personas = typeof getWechatUserPersonaLibrary === 'function' ? getWechatUserPersonaLibrary() : [];
        const user = profile(char);
        const route = imageRoute();
        const options = TYPE_OPTIONS[draft.type];
        const rows = draft.origin === 'chat' ? historyRows(char) : [];
        const origins = [['chat', '聊天选段'], ['custom', '自己写'], ['char', `交给 ${char ? nameOf(char) : 'Char'}`]];
        if (state.source && !['chat'].includes(state.source.kind)) origins.unshift([state.source.kind, state.source.kind === 'dream' ? '梦境记录' : '论坛帖子']);
        return `
            <section class="ct-form-section"><h3>作品类型</h3><div class="ct-type-grid">${TYPE_ORDER.map(key => `<button type="button" data-action="draft-type" data-id="${key}" class="${draft.type === key ? 'active' : ''}">${typeCardArt(key)}<strong>${esc(typeOf(key).label)}</strong><small>${esc(typeOf(key).desc)}</small></button>`).join('')}</div></section>
            <section class="ct-form-section"><h3>主角</h3>${chars().length ? `<div class="ct-pick-row">${chars().map(item => `<button type="button" data-action="draft-char" data-id="${esc(item.id)}" class="${String(item.id) === draft.charId ? 'active' : ''}"><span class="ct-avatar">${avatarOf(item) ? `<img src="${esc(avatarOf(item))}" alt="" onerror="this.remove()">` : ''}<i>${esc(nameOf(item).slice(0, 1))}</i></span><em>${esc(nameOf(item))}</em></button>`).join('')}</div>` : '<p class="ct-muted">请先在微信里创建角色。</p>'}${draft.needsChar ? '<p class="ct-warn">这段内容来自论坛或梦境，请选择要画的角色。</p>' : ''}
                <label class="ct-field"><span>User 人设</span><select data-draft="personaId"><option value="">当前人设 · ${esc(user.name || '我')}</option>${personas.map(item => `<option value="${esc(item.id)}" ${item.id === draft.personaId ? 'selected' : ''}>${esc(item.title || item.name || '人设')}</option>`).join('')}</select></label></section>
            <section class="ct-form-section"><h3>剧情</h3><div class="ct-segment">${origins.map(([key, label]) => `<button type="button" data-action="draft-origin" data-id="${esc(key)}" class="${draft.origin === key ? 'active' : ''}">${esc(label)}</button>`).join('')}</div>
                ${draft.origin === 'chat' ? `<div class="ct-history"><div class="ct-history-head"><strong>选择要改编的聊天</strong><small>不选则用最近 12 条</small></div><div class="ct-history-list">${rows.map(row => `<label><input type="checkbox" data-history="${esc(row.key)}" ${state.selectedHistory.has(row.key) ? 'checked' : ''}><span><b>${esc(row.speaker)}</b>${esc(row.text.slice(0, 120))}</span></label>`).join('') || '<p class="ct-muted">和这个角色还没有聊天记录，换成“自己写”试试。</p>'}</div></div>` : ''}
                <label class="ct-field"><span>${draft.origin === 'custom' ? '想看的剧情' : draft.origin === 'char' ? '给 Char 的提示（可选）' : ['dream', 'forum'].includes(draft.origin) ? '原文' : '补充要求（可选）'}</span><textarea data-draft="plot" rows="${draft.origin === 'custom' || ['dream', 'forum'].includes(draft.origin) ? 5 : 2}" placeholder="${draft.origin === 'custom' ? '比如：下雨的晚上，他来接我下班……' : '比如：结局甜一点、他吃醋、换成古风背景'}">${esc(draft.plot)}</textarea></label></section>
            ${options ? `<section class="ct-form-section"><h3>${esc(options.label)}</h3><div class="ct-chips">${options.chips.map(chip => `<button type="button" data-action="draft-option" data-id="${esc(chip)}" class="${draft.option === chip ? 'active' : ''}">${esc(chip)}</button>`).join('')}</div><input class="ct-input" data-draft="optionCustom" maxlength="60" placeholder="或者自己写" value="${esc(draft.optionCustom)}"></section>` : ''}
            ${type.panels[0] !== type.panels[1] ? `<section class="ct-form-section"><h3>格数 <b data-panel-count>${draft.panels}</b></h3><input class="ct-range" type="range" data-draft="panels" min="${type.panels[0]}" max="${type.panels[1]}" value="${draft.panels}"></section>` : ''}
            <section class="ct-form-section"><h3>画风</h3><div class="ct-chips">${STYLE_PRESETS.map(style => `<button type="button" data-action="draft-style" data-id="${style.key}" class="${draft.styleKey === style.key ? 'active' : ''}">${esc(style.label)}</button>`).join('')}<button type="button" data-action="draft-style" data-id="custom" class="${draft.styleKey === 'custom' ? 'active' : ''}">自定义</button></div>${draft.styleKey === 'custom' ? `<input class="ct-input" data-draft="styleCustom" maxlength="200" placeholder="${route.provider === 'novelai' ? '英文画风标签，例如 watercolor, pastel colors' : '描述你想要的画风'}" value="${esc(draft.styleCustom)}">` : ''}</section>
            ${type.series ? `<section class="ct-form-section"><h3>作品名（可选）</h3><input class="ct-input" data-draft="title" maxlength="30" placeholder="留空由 Char 起名" value="${esc(draft.title)}"></section>` : ''}
            <section class="ct-form-section ct-route"><div><span>生图服务</span><strong class="${route.provider ? '' : 'missing'}">${esc(route.provider ? route.label : '未配置生图服务')}</strong></div><button type="button" data-action="open-settings">设置</button></section>
            ${route.provider === 'api' ? `<section class="ct-form-section"><h3>参考图（可选）</h3><div class="ct-ref-grid"><label class="ct-file"><i class="ri-user-smile-line"></i><span>Char 参考图</span><input type="file" data-ref="charRef" accept="image/png,image/jpeg,image/webp"></label><label class="ct-file"><i class="ri-user-heart-line"></i><span>User 参考图</span><input type="file" data-ref="userRef" accept="image/png,image/jpeg,image/webp"></label></div><p class="ct-muted">不上传时使用角色头像和 User 人设头像。</p></section>` : ''}
            <div class="ct-cta"><button type="button" class="ct-primary" data-action="create-submit"${chars().length ? '' : ' disabled'}>生成分镜</button></div>`;
    }
    function createView() {
        state.view = 'create';
        if (!state.draft) state.draft = freshDraft();
        frame({ title: '新作品', back: 'home', body: createBody(state.draft), className: 'ct-create' });
    }
    function refreshCreate() {
        const main = root()?.querySelector('.ct-main');
        if (!main || state.view !== 'create') return;
        const top = main.scrollTop;
        main.innerHTML = createBody(state.draft);
        main.scrollTop = top;
    }
    async function createSubmit() {
        const draft = state.draft;
        const char = charById(draft.charId);
        if (!char) throw new Error('请先选择角色');
        const route = imageRoute();
        if (!route.provider) throw new Error('还没有可用的生图服务：设置 → API → 生图服务');
        if (draft.origin === 'custom' && !draft.plot.trim()) throw new Error('写一句想看的剧情吧');
        const persona = (typeof getWechatUserPersonaLibrary === 'function' ? getWechatUserPersonaLibrary() : []).find(item => item.id === draft.personaId);
        const user = persona || profile(char);
        const style = styleOf(draft.styleKey);
        const type = typeOf(draft.type);
        const history = draft.origin === 'chat' || draft.origin === 'char' ? transcript(char) : '';
        if (draft.origin === 'chat' && !history) throw new Error('这个角色还没有聊天记录，换成“自己写”或“交给 Char”吧');
        const now = Date.now();
        const book = upgradeBook({
            id: id('series'), type: draft.type, title: draft.title.trim() || '', titleLocked: !!draft.title.trim(), logline: '',
            charId: char.id, charName: nameOf(char), personaId: user.id || user.personaId || '', userName: user.name || 'User', userBio: user.bio || '',
            status: 'draft', source: draft.origin, styleKey: draft.styleKey,
            style: draft.styleKey === 'custom' ? draft.styleCustom.trim() : style?.text || '',
            styleTags: draft.styleKey === 'custom' ? (route.provider === 'novelai' ? draft.styleCustom.trim() : '') : style?.tags || '',
            option: [draft.option, draft.optionCustom.trim()].filter(Boolean).join('；'),
            charRef: draft.charRef || charReference(char), userRef: draft.userRef || user.avatar || profile(char).avatar || '',
            createdAt: now, updatedAt: now, coverKey: '', chapters: []
        });
        if (!book.title) book.title = `${book.charName}的${type.short}`;
        const part = { id: id('chapter'), title: type.series ? '第1话' : book.title, source: draft.origin, plot: draft.plot.trim(), transcript: history, panelTarget: draft.panels, createdAt: now, updatedAt: now, panels: [], comments: [], progress: 0, state: 'planning' };
        book.chapters.push(part);
        await save(book);
        state.seriesId = book.id; state.chapterId = part.id; state.source = null; state.draft = null; state.selectedHistory.clear();
        await editor();
        launch(() => planChapter(book.id, part.id, { panels: draft.panels }));
    }
    // ---- series home (작품홈) ----
    async function openBook(bookId) {
        state.seriesId = bookId;
        const book = await current();
        if (!book) return home();
        if (typeOf(book.type).series) return seriesView();
        state.chapterId = book.chapters[0]?.id || '';
        const part = book.chapters[0];
        if (part && part.panels.length && part.panels.every(panel => panel.imageKey)) return viewer();
        return editor();
    }
    async function seriesView() {
        state.view = 'series';
        const book = await current();
        if (!book) return home();
        const done = doneChapters(book);
        const chapters = book.chapters.map((part, index) => ({ part, index }));
        if (state.episodeOrder === 'desc') chapters.reverse();
        const resume = book.chapters.find(part => part.id === book.lastReadId) || done[0];
        const thumb = part => part.panels.find(panel => panel.imageKey)?.imageKey || '';
        const episode = ({ part }) => {
            const ready = part.panels.length && part.panels.every(panel => panel.imageKey);
            return `<div class="ct-episode"><button type="button" class="ct-episode-main" data-action="${ready ? 'read' : 'edit-chapter'}" data-id="${esc(part.id)}"><div class="ct-episode-thumb" data-image="${esc(thumb(part))}"><i class="ri-image-line"></i></div><div class="ct-episode-info"><strong>${esc(part.title)}</strong><small>${part.rating ? `<b>★ ${part.rating}.0</b>` : ''}${esc(date(part.createdAt))}${ready ? '' : ' · <em>未完成</em>'}</small></div>${isRecent(part.updatedAt) && ready ? '<span class="ct-up">UP</span>' : ''}</button><button type="button" class="ct-icon" data-action="edit-chapter" data-id="${esc(part.id)}" aria-label="编辑这一话"><i class="ri-edit-2-line"></i></button></div>`;
        };
        frame({
            title: book.title,
            back: 'home',
            className: 'ct-series-page',
            right: `<button type="button" class="ct-icon" data-action="book-menu" aria-label="更多"><i class="ri-more-2-fill"></i></button>`,
            body: `<section class="ct-series-hero"><div class="ct-series-bg" data-image="${esc(book.coverKey || '')}"></div><div class="ct-series-head">${coverHtml(book, 'ct-series-cover')}<div class="ct-series-meta"><div>${typeBadge(book.type)}<span class="ct-status-chip">${esc({ ongoing: '连载中', complete: '完结', draft: '草稿', private: '私密' }[book.status] || '连载中')}</span></div><h1>${esc(book.title)}</h1><p>${esc(book.charName)} × ${esc(book.userName)}</p><small>共 ${done.length} 话 · ${esc(date(book.updatedAt))} 更新</small></div></div></section>${book.logline ? `<p class="ct-series-desc">${esc(book.logline)}</p>` : ''}<div class="ct-series-actions">${done.length ? `<button type="button" class="ct-primary" data-action="read" data-id="${esc(done[0].id)}">第一话</button>${resume && resume.id !== done[0].id ? `<button type="button" class="ct-secondary" data-action="read" data-id="${esc(resume.id)}">继续看 · ${esc(resume.title)}</button>` : ''}` : `<button type="button" class="ct-primary" data-action="edit-chapter" data-id="${esc(book.chapters[0]?.id || '')}">继续创作第一话</button>`}</div><div class="ct-series-tools"><button type="button" data-action="next-chapter"><i class="ri-add-line"></i>生成下一话</button><button type="button" data-action="char-led"><i class="ri-quill-pen-line"></i>让 ${esc(book.charName)} 画一话</button><button type="button" data-action="toggle-auto" class="${book.autoCreate ? 'on' : ''}"><i class="ri-calendar-event-line"></i>每周连载${book.autoCreate ? '·开' : ''}</button></div><div class="ct-episode-head"><strong>共 ${book.chapters.length} 话</strong><button type="button" data-action="episode-order">${state.episodeOrder === 'desc' ? '最新一话在前' : '第一话在前'} <i class="ri-arrow-up-down-line"></i></button></div><div class="ct-episode-list">${chapters.map(episode).join('')}</div>${importInput}`
        });
        await fillImages();
    }
    async function bookMenu() {
        const book = await current();
        if (!book) return;
        const sheet = document.createElement('div');
        sheet.className = 'ct-sheet';
        sheet.innerHTML = `<div class="ct-sheet-panel"><strong>${esc(book.title)}</strong><label class="ct-field"><span>作品状态</span><select data-book-status>${[['ongoing', '连载中'], ['complete', '完结'], ['draft', '草稿'], ['private', '私密']].map(([key, label]) => `<option value="${key}" ${book.status === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="ct-field"><span>作品名</span><input data-book-title maxlength="30" value="${esc(book.title)}"></label><button type="button" data-action="export-project">导出项目备份</button><button type="button" data-action="delete-book" class="danger">删除作品</button><button type="button" data-action="close-sheet">完成</button></div>`;
        root().querySelector('.ct-shell').appendChild(sheet);
    }
    async function nextChapter(extra = {}) {
        const book = await current();
        if (!book) return;
        const char = charById(book.charId);
        if (!char) throw new Error('这个作品的角色已被删除');
        const plot = extra.plot ?? prompt(`「第${book.chapters.length + 1}话」想看什么？留空就按最近的聊天续写。`, '');
        if (plot === null) return;
        const history = transcript(char);
        const part = { id: id('chapter'), title: `第${book.chapters.length + 1}话`, source: extra.source || (plot.trim() ? 'custom' : 'chat'), plot: String(plot || '').trim(), transcript: history, createdAt: Date.now(), updatedAt: Date.now(), panels: [], comments: [], progress: 0, state: 'planning' };
        if (part.source === 'chat' && !history) part.source = 'char';
        book.chapters.push(part);
        await save(book);
        state.chapterId = part.id;
        await editor();
        launch(() => planChapter(book.id, part.id));
    }
    async function charLed(book, auto = false) {
        const char = charById(book.charId);
        if (!char) throw new Error('这个作品的角色已被删除');
        const history = transcript(char);
        if (!history && auto) return;
        const part = { id: id('chapter'), title: `第${book.chapters.length + 1}话`, source: 'char', plot: '', transcript: history, createdAt: Date.now(), updatedAt: Date.now(), panels: [], comments: [], progress: 0, state: 'planning' };
        book.chapters.push(part);
        book.lastProactiveAt = Date.now();
        await save(book);
        if (!auto) { state.seriesId = book.id; state.chapterId = part.id; await editor(); }
        launch(async () => {
            await planChapter(book.id, part.id);
            await startGeneration(book.id, part.id);
        });
    }
    async function maybeProactive() {
        const due = (await series()).find(book => book.autoCreate && typeOf(book.type).series && book.status !== 'complete' && Date.now() - (book.lastProactiveAt || book.createdAt) >= 7 * 86400000 && (charById(book.charId)?.history || []).some(row => Number(row.timestamp || 0) > (book.lastProactiveAt || book.createdAt)));
        if (!due || state.job) return;
        say(`${due.charName} 想画新的一话，正在准备…`);
        await charLed(due, true);
    }
    // ---- viewer (뷰어) ----
    function commentAvatar(book, who) {
        const char = charById(book.charId);
        const src = who === 'char' ? avatarOf(char) : (profile(char).avatar || '');
        const name = who === 'char' ? book.charName : book.userName;
        return `<span class="ct-avatar small">${src ? `<img src="${esc(src)}" alt="" onerror="this.remove()">` : ''}<i>${esc(String(name || '?').slice(0, 1))}</i></span>`;
    }
    function commentsHtml(book, part) {
        const list = part.comments || [];
        return `<section class="ct-comments"><div class="ct-comments-head"><strong>评论</strong><span>${list.length}</span></div>${list.map(item => `<div class="ct-comment ${item.who === 'char' ? 'author' : ''}${item.replyTo ? ' reply' : ''}">${commentAvatar(book, item.who)}<div><b>${esc(item.who === 'char' ? book.charName : book.userName)}${item.who === 'char' ? '<em>作者</em>' : ''}</b><p>${esc(item.text)}</p><small>${esc(date(item.at))}</small></div></div>`).join('') || '<p class="ct-muted">还没有评论。</p>'}<form id="ct-comment-form" class="ct-comment-form"><input name="text" maxlength="200" placeholder="写下你的评论，${esc(book.charName)} 会看到" autocomplete="off"><button type="submit">发布</button></form></section>`;
    }
    async function viewer() {
        const book = await current();
        if (!book) return home();
        const part = chapter(book) || book.chapters[0];
        if (!part) return openBook(book.id);
        state.view = 'viewer';
        state.chapterId = part.id;
        const type = typeOf(book.type);
        const index = book.chapters.indexOf(part);
        const prev = book.chapters.slice(0, index).reverse().find(item => item.panels.length);
        const next = book.chapters.slice(index + 1).find(item => item.panels.length);
        const missing = part.panels.filter(panel => !panel.imageKey).length;
        const unit = type.series ? '话' : '幅';
        const actions = [
            type.series ? (next ? `<button type="button" class="ct-primary" data-action="read" data-id="${esc(next.id)}">下一话 · ${esc(next.title)}</button>` : `<button type="button" class="ct-primary" data-action="next-chapter">生成下一话</button>`) : '',
            `<button type="button" class="ct-secondary" data-action="save-piece"><i class="ri-download-2-line"></i>保存成品图</button>`,
            type.layout === 'wallpaper' ? `<button type="button" class="ct-secondary" data-action="wallpaper" data-id="home"><i class="ri-smartphone-line"></i>设为桌面壁纸</button><button type="button" class="ct-secondary" data-action="wallpaper" data-id="lock"><i class="ri-lock-line"></i>设为锁屏壁纸</button>` : '',
            `<button type="button" class="ct-secondary" data-action="edit-chapter" data-id="${esc(part.id)}"><i class="ri-edit-2-line"></i>编辑分镜和台词</button>`
        ].join('');
        frame({
            title: type.series ? part.title : book.title,
            back: type.series ? 'series' : 'home',
            className: `ct-reading layout-${type.layout}`,
            right: `<button type="button" class="ct-icon${part.liked ? ' liked' : ''}" data-action="like" aria-label="喜欢"><i class="${part.liked ? 'ri-heart-3-fill' : 'ri-heart-3-line'}"></i></button>`,
            body: `<div class="ct-viewer" data-action="toggle-bars">${pieceHtml(book, part)}</div>${missing ? `<div class="ct-notice"><i class="ri-error-warning-line"></i><span>还有 ${missing} 格没有图片</span><button type="button" data-action="edit-chapter" data-id="${esc(part.id)}">去生成</button></div>` : ''}<section class="ct-episode-end">${type.series ? `<div class="ct-end-mark"><span>${esc(part.title)}</span><b>本话完</b></div>` : ''}${part.authorNote ? `<div class="ct-author-note">${commentAvatar(book, 'char')}<div><b>作者的话</b><p>${esc(part.authorNote)}</p><small>— ${esc(book.charName)}</small></div></div>` : ''}<div class="ct-rate"><span>给这${unit}打分</span><div>${[1, 2, 3, 4, 5].map(score => `<button type="button" data-action="rate" data-id="${score}" class="${Number(part.rating || 0) >= score ? 'on' : ''}" aria-label="${score} 星">★</button>`).join('')}</div></div><div class="ct-end-actions">${actions}<details class="ct-more-export"><summary>更多导出</summary><div><button type="button" data-action="export-zip">逐格原图 ZIP</button><button type="button" data-action="export-pdf">PDF</button><button type="button" data-action="export-project">项目备份</button></div></details></div>${commentsHtml(book, part)}</section>${type.series ? `<nav class="ct-viewer-bar"><button type="button" data-action="read" data-id="${esc(prev?.id || '')}" ${prev ? '' : 'disabled'}><i class="ri-arrow-left-s-line"></i>上一话</button><button type="button" data-action="back" data-view="series"><i class="ri-list-unordered"></i>目录</button><button type="button" data-action="read" data-id="${esc(next?.id || '')}" ${next ? '' : 'disabled'}>下一话<i class="ri-arrow-right-s-line"></i></button></nav>` : ''}`
        });
        fitBubbles();
        await fillImages();
        const main = root().querySelector('.ct-main');
        const shell = root().querySelector('.ct-shell');
        const panels = [...main.querySelectorAll('[data-panel]')];
        const startAt = book.lastReadId === part.id ? Math.min(part.progress || 0, panels.length - 1) : 0;
        if (startAt > 0 && panels[startAt]) requestAnimationFrame(() => panels[startAt].scrollIntoView({ block: 'start' }));
        let lastTop = 0;
        const rememberReading = () => window.ByndExperience?.checkpoint('comic', book.charId, `上次看《${book.title}》的「${part.title}」，停在第 ${(part.progress || 0) + 1} 格。`);
        rememberReading();
        main.onscroll = () => {
            const top = main.scrollTop;
            if (Math.abs(top - lastTop) > 8) shell.classList.toggle('bars-hidden', top > lastTop && top > 80);
            lastTop = top;
            let visible = 0;
            const limit = main.getBoundingClientRect().top + 90;
            panels.forEach((node, at) => { if (node.getBoundingClientRect().top < limit) visible = at; });
            if (visible !== part.progress || book.lastReadId !== part.id) {
                part.progress = visible;
                rememberReading();
                clearTimeout(state.progressTimer);
                state.progressTimer = setTimeout(() => mutateChapter(book.id, part.id, (item, target) => { item.progress = visible; target.lastReadId = part.id; }).catch(error => say(`阅读位置保存失败：${error.message}`, true)), 700);
            }
        };
        if (book.lastReadId !== part.id) mutateChapter(book.id, part.id, (item, target) => { target.lastReadId = part.id; }).catch(console.warn);
    }
    async function replyToComment(bookId, chapterId, comment) {
        const book = upgradeBook(await get('series', bookId));
        const part = book?.chapters.find(item => item.id === chapterId);
        const char = charById(book?.charId);
        if (!part || !char || typeof callChatApi !== 'function') return;
        const persona = typeof getWechatCharacterPersonaText === 'function' ? getWechatCharacterPersonaText(char, 3000) : (char.description || '');
        const result = await callChatApi([
            { role: 'system', content: `你是 ${book.charName}，也是漫画《${book.title}》的作者。${book.userName} 在这${typeOf(book.type).series ? '一话' : '幅作品'}下面留了评论。用你的人设和口吻回一句评论（不超过 40 字），只输出回复内容。\n\n${persona}` },
            { role: 'user', content: `作品内容：${part.panels.map(panel => panel.beat).join(' / ').slice(0, 800)}\n${book.userName} 的评论：${comment.text}` }
        ], { max_tokens: 300, temperature: 0.9, background: true, usageFeature: 'comic', usageChar: char });
        const text = cut(String(result?.content || '').replace(/^["“]|["”]$/g, ''), 120);
        if (!result?.ok || !text) return;
        await mutateChapter(bookId, chapterId, item => { item.comments.push({ id: id('comment'), who: 'char', text, replyTo: comment.id, at: Date.now() }); });
        if (state.view === 'viewer' && watching(bookId, chapterId)) {
            const section = root()?.querySelector('.ct-comments');
            const latest = upgradeBook(await get('series', bookId));
            const latestPart = latest?.chapters.find(item => item.id === chapterId);
            if (section && latestPart) section.outerHTML = commentsHtml(latest, latestPart);
        }
    }
    // ---- editor (storyboard, tags, dialogue) ----
    const WHO_LABEL = { char: 'Char', user: 'User', narration: '旁白', sfx: '拟声', other: '路人' };
    function option(list, selected) {
        return Object.entries(list).map(([key, label]) => `<option value="${esc(key)}" ${key === selected ? 'selected' : ''}>${esc(typeof label === 'string' ? label : label.label)}</option>`).join('');
    }
    function panelCard(book, part, panel, index, nai) {
        const type = typeOf(book.type);
        const drawing = state.job?.kind === 'render' && state.job.current === panel.id;
        const names = { char: book.charName, user: book.userName };
        return `<article class="ct-card${drawing ? ' drawing' : ''}" data-panel-card="${esc(panel.id)}">
            <header><b>${index + 1}</b>${type.fixedShot ? `<span class="ct-card-shot">${esc(shotOf(panel.shot).label)}</span>` : `<select data-panel-field="shot" aria-label="构图">${option(SHOTS, panel.shot)}</select>`}${type.layout === 'strip' ? `<select data-panel-field="gutter" aria-label="下方留白">${option(GUTTERS, panel.gutter)}</select><select data-panel-field="tone" aria-label="留白颜色">${option({ light: '白色留白', dark: '黑色留白' }, panel.tone)}</select>` : ''}<div class="ct-card-tools">${type.panels[1] > 1 ? `<button type="button" data-action="panel-up" data-id="${esc(panel.id)}" aria-label="上移"><i class="ri-arrow-up-s-line"></i></button><button type="button" data-action="panel-down" data-id="${esc(panel.id)}" aria-label="下移"><i class="ri-arrow-down-s-line"></i></button><button type="button" data-action="panel-delete" data-id="${esc(panel.id)}" aria-label="删除"><i class="ri-delete-bin-6-line"></i></button>` : ''}</div></header>
            <div class="ct-card-preview">${panelHtml(panel)}${drawing ? '<div class="ct-drawing"><i class="ri-brush-3-line"></i><span>正在画…</span></div>' : ''}</div>
            ${panel.error ? `<p class="ct-card-error"><i class="ri-error-warning-line"></i>${esc(panel.error)}</p>` : ''}
            <label class="ct-field"><span>剧情节拍</span><textarea data-panel-field="beat" rows="2">${esc(panel.beat)}</textarea></label>
            ${nai ? `<label class="ct-field"><span>场景标签 <em>NovelAI</em></span><textarea data-panel-field="scene" rows="2" spellcheck="false">${esc(panel.scene || '')}</textarea></label>${(panel.chars || []).map((person, at) => `<label class="ct-field ct-char-field"><span>${esc(names[person.who] || WHO_LABEL[person.who] || '人物')} 的动作表情<button type="button" data-action="char-remove" data-id="${esc(panel.id)}" data-index="${at}">移除</button></span><textarea data-char-field="${at}" rows="2" spellcheck="false">${esc(person.tags)}</textarea></label>`).join('')}<div class="ct-inline-actions"><button type="button" data-action="char-add" data-id="${esc(panel.id)}" data-who="char">＋ ${esc(book.charName)} 出镜</button><button type="button" data-action="char-add" data-id="${esc(panel.id)}" data-who="user">＋ ${esc(book.userName)} 出镜</button></div>` : `<label class="ct-field"><span>画面描述</span><textarea data-panel-field="prompt" rows="3">${esc(panel.prompt || '')}</textarea></label>`}
            <div class="ct-bubble-editor"><span class="ct-bubble-editor-title">台词气泡 <em>在上面的图里拖动位置</em></span>${(panel.bubbles || []).map(bubble => `<div class="ct-bubble-row" data-bubble-row="${esc(bubble.id)}"><select data-bubble-field="who">${option({ char: book.charName, user: book.userName, narration: '旁白', sfx: '拟声' }, bubble.who)}</select><select data-bubble-field="kind">${option(BUBBLE_KINDS, bubble.kind)}</select><input data-bubble-field="text" maxlength="80" value="${esc(bubble.text)}"><button type="button" data-action="bubble-remove" data-id="${esc(bubble.id)}" aria-label="删除气泡"><i class="ri-close-line"></i></button></div>`).join('')}<button type="button" class="ct-add-bubble" data-action="bubble-add" data-id="${esc(panel.id)}">＋ 气泡</button></div>
            <footer><button type="button" data-action="generate-panel" data-id="${esc(panel.id)}"><i class="ri-refresh-line"></i>${panel.imageKey ? '重画这一格' : '只画这一格'}</button><button type="button" data-action="upload-panel" data-id="${esc(panel.id)}"><i class="ri-upload-2-line"></i>用本地图片</button><input type="file" data-upload="${esc(panel.id)}" accept="image/png,image/jpeg,image/webp" hidden></footer>
        </article>`;
    }
    function extraFields(book, part) {
        const layout = typeOf(book.type).layout;
        const fields = [];
        if (['illust'].includes(layout)) fields.push(`<label class="ct-field"><span>配文</span><textarea data-edit="story" rows="4">${esc(part.story || '')}</textarea></label>`);
        if (layout === 'polaroid') fields.push(`<label class="ct-field"><span>手写便签</span><input data-edit="caption" maxlength="40" value="${esc(part.caption || '')}"></label>`);
        if (layout === 'poster') {
            const poster = part.poster || {};
            fields.push(`<div class="ct-field-grid">${[['title', '片名'], ['subtitle', '英文副标题'], ['tagline', '宣传语'], ['credits', '演职员'], ['date', '日期']].map(([key, label]) => `<label class="ct-field"><span>${label}</span><input data-edit="poster.${key}" maxlength="80" value="${esc(poster[key] || '')}"></label>`).join('')}</div>`);
        }
        fields.push(`<label class="ct-field"><span>作者的话</span><input data-edit="authorNote" maxlength="120" value="${esc(part.authorNote || '')}"></label>`);
        return fields.join('');
    }
    async function editor() {
        const book = await current();
        if (!book) return home();
        const part = chapter(book);
        if (!part) return openBook(book.id);
        state.view = 'editor';
        const type = typeOf(book.type);
        const route = imageRoute();
        const nai = (part.provider || route.provider) === 'novelai';
        const planning = state.job?.kind === 'plan' && state.job.chapterId === part.id;
        const missing = part.panels.filter(panel => !panel.imageKey).length;
        const rendering = state.job?.kind === 'render' && state.job.chapterId === part.id;
        let content;
        if (planning || (!part.panels.length && part.state === 'planning' && state.job)) {
            content = `<div class="ct-planning"><div class="ct-planning-pen"><i class="ri-quill-pen-line"></i></div><strong>${esc(book.charName)} 正在写分镜</strong><p>正在构思剧情、分格、台词和画面${nai ? '标签' : '描述'}，通常需要半分钟到一分钟。</p><div class="ct-skeleton">${Array.from({ length: Math.min(type.defaultPanels, 3) }, () => '<i></i>').join('')}</div></div>`;
        } else if (!part.panels.length) {
            content = `<div class="ct-planning failed"><i class="ri-draft-line"></i><strong>${part.planError ? '分镜没有写成' : '还没有分镜'}</strong>${part.planError ? `<p class="ct-card-error">${esc(part.planError)}</p>` : '<p>让 Char 根据剧情写分镜和台词。</p>'}<button type="button" class="ct-primary" data-action="replan">${part.planError ? '重新生成分镜' : '生成分镜'}</button></div>`;
        } else {
            content = `<details class="ct-cast"><summary><i class="ri-user-star-line"></i>角色外观${nai ? '标签' : ''}<em>每一格都会带上</em></summary><label class="ct-field"><span>${esc(book.charName)}</span><textarea data-edit="cast.char" rows="3" spellcheck="false">${esc(book.cast?.char || '')}</textarea></label><label class="ct-field"><span>${esc(book.userName)}</span><textarea data-edit="cast.user" rows="3" spellcheck="false">${esc(book.cast?.user || '')}</textarea></label><button type="button" data-action="save-cast">存为这两人的默认外观</button></details>${extraFields(book, part)}<div class="ct-board">${part.panels.map((panel, index) => panelCard(book, part, panel, index, nai)).join('')}</div><div class="ct-inline-actions board">${part.panels.length < type.panels[1] ? '<button type="button" data-action="panel-add">＋ 加一格</button>' : ''}<button type="button" data-action="replan">重写分镜</button></div>`;
        }
        const cta = part.panels.length && !planning
            ? (rendering ? '' : missing ? `<div class="ct-cta"><button type="button" class="ct-primary" data-action="generate">开始生成 ${missing} 张</button></div>` : `<div class="ct-cta"><button type="button" class="ct-primary" data-action="view">查看成品</button></div>`)
            : '';
        frame({
            title: type.series ? part.title : book.title,
            back: type.series ? 'series' : 'home',
            className: 'ct-editor',
            right: `<span class="ct-route-chip${route.provider ? '' : ' missing'}">${esc(route.provider === 'novelai' ? 'NovelAI' : route.provider === 'api' ? '中转站' : '未配置')}</span>`,
            body: `<div class="ct-editor-meta">${typeBadge(book.type)}<input class="ct-title-input" data-edit="title" maxlength="30" value="${esc(type.series ? part.title : book.title)}" aria-label="标题"></div>${content}${cta}`
        });
        fitBubbles();
        await fillImages();
    }
    async function refreshPanel(panelId) {
        if (state.view !== 'editor') return;
        const card = root()?.querySelector(`[data-panel-card="${CSS.escape(panelId)}"]`);
        if (!card) return;
        const book = await current();
        const part = chapter(book);
        const index = part?.panels.findIndex(panel => panel.id === panelId) ?? -1;
        if (index < 0) return;
        const nai = (part.provider || imageRoute().provider) === 'novelai';
        const holder = document.createElement('div');
        holder.innerHTML = panelCard(book, part, part.panels[index], index, nai);
        const fresh = holder.firstElementChild;
        card.replaceWith(fresh);
        fitBubbles(fresh);
        await fillImages(fresh);
    }
    // Bubbles are dragged inside the preview; positions are stored as fractions of the panel.
    function bindBubbleDrag(host) {
        host.addEventListener('pointerdown', event => {
            const bubble = event.target.closest('.ct-editor .ct-card-preview .ct-bubble');
            if (!bubble) return;
            const art = bubble.closest('.ct-panel-art');
            const card = bubble.closest('[data-panel-card]');
            if (!art || !card) return;
            event.preventDefault();
            const rect = art.getBoundingClientRect();
            const startX = event.clientX, startY = event.clientY;
            const originX = parseFloat(bubble.style.left) / 100, originY = parseFloat(bubble.style.top) / 100;
            bubble.setPointerCapture(event.pointerId);
            bubble.classList.add('dragging');
            let x = originX, y = originY;
            const move = moveEvent => {
                x = clamp(originX + (moveEvent.clientX - startX) / rect.width, 0, 0.92);
                y = clamp(originY + (moveEvent.clientY - startY) / rect.height, 0, 0.95);
                bubble.style.left = `${(x * 100).toFixed(2)}%`;
                bubble.style.top = `${(y * 100).toFixed(2)}%`;
                bubble.classList.toggle('tail-right', x >= 0.45);
                bubble.classList.toggle('tail-left', x < 0.45);
            };
            const end = () => {
                bubble.removeEventListener('pointermove', move);
                bubble.removeEventListener('pointerup', end);
                bubble.removeEventListener('pointercancel', end);
                bubble.classList.remove('dragging');
                if (Math.abs(x - originX) < 0.002 && Math.abs(y - originY) < 0.002) return;
                const bubbleId = bubble.dataset.bubble;
                mutatePanel(state.seriesId, state.chapterId, card.dataset.panelCard, (_, __, panel) => {
                    const target = panel.bubbles.find(item => item.id === bubbleId);
                    if (target) { target.x = Math.round(x * 1000) / 1000; target.y = Math.round(y * 1000) / 1000; }
                }).catch(error => say(`气泡位置保存失败：${error.message}`, true));
            };
            bubble.addEventListener('pointermove', move);
            bubble.addEventListener('pointerup', end);
            bubble.addEventListener('pointercancel', end);
        });
    }
    // ---- actions ----
    async function goBack(view) {
        if (view === 'series' && state.seriesId) return seriesView();
        state.seriesId = ''; state.chapterId = '';
        if (state.tab === 'shelf') return shelf();
        if (state.tab === 'materials') return materials();
        return home();
    }
    async function movePanel(key, type) {
        const book = await current(), part = chapter(book);
        const index = part?.panels.findIndex(item => item.id === key) ?? -1;
        if (index < 0) return;
        let removed = '';
        if (type === 'panel-delete') {
            if (!confirm('删除这一格？')) return;
            removed = part.panels[index].imageKey;
            part.panels.splice(index, 1);
            if (book.coverKey === removed) book.coverKey = part.panels.find(panel => panel.imageKey)?.imageKey || '';
        } else {
            const target = index + (type === 'panel-up' ? -1 : 1);
            if (target < 0 || target >= part.panels.length) return;
            [part.panels[index], part.panels[target]] = [part.panels[target], part.panels[index]];
        }
        part.updatedAt = Date.now();
        await save(book);
        if (removed && removed !== book.coverKey) await remove('images', removed).catch(console.warn);
        await editor();
    }
    async function action(button) {
        const type = button.dataset.action, key = button.dataset.id;
        const inJob = state.job && state.job.chapterId === state.chapterId;
        switch (type) {
            case 'close': closeApp('comic'); return;
            case 'back': return goBack(button.dataset.view);
            case 'tab': state.tab = key; state.seriesId = ''; return key === 'shelf' ? shelf() : key === 'materials' ? materials() : home();
            case 'type-filter': state.typeFilter = key; return home();
            case 'char-filter': state.charFilter = key; return home();
            case 'shelf-sort': state.shelfSort = key; return shelf();
            case 'create': state.source = null; state.draft = freshDraft(); state.selectedHistory.clear(); return createView();
            case 'open-book': return openBook(key);
            case 'import-project': root().querySelector('#ct-import-file')?.click(); return;
            case 'draft-type': state.draft.type = key; state.draft.panels = typeOf(key).defaultPanels; state.draft.option = ''; return refreshCreate();
            case 'draft-char': state.draft.charId = key; state.draft.needsChar = false; state.selectedHistory.clear(); return refreshCreate();
            case 'draft-origin': state.draft.origin = key; return refreshCreate();
            case 'draft-option': state.draft.option = state.draft.option === key ? '' : key; return refreshCreate();
            case 'draft-style': state.draft.styleKey = key; return refreshCreate();
            case 'create-submit': return createSubmit();
            case 'open-settings': openApp('settings'); window.openSettingsTab?.('api'); return;
            case 'read': if (!key) return; state.chapterId = key; return viewer();
            case 'edit-chapter': if (key) state.chapterId = key; return editor();
            case 'view': return viewer();
            case 'next-chapter': return nextChapter();
            case 'char-led': { const book = await current(); if (book) await charLed(book); return; }
            case 'toggle-auto': { const book = await current(); book.autoCreate = !book.autoCreate; await save(book); await seriesView(); say(book.autoCreate ? `已开启：有新聊天时，${book.charName} 每周会主动画一话` : '已关闭每周连载'); return; }
            case 'episode-order': state.episodeOrder = state.episodeOrder === 'desc' ? 'asc' : 'desc'; return seriesView();
            case 'book-menu': return bookMenu();
            case 'close-sheet': root().querySelector('.ct-sheet')?.remove(); return state.view === 'series' ? seriesView() : undefined;
            case 'delete-book': {
                const book = await current();
                if (!book || !confirm(`删除《${book.title}》和它的全部图片？此操作不能撤销。`)) return;
                if (state.job?.bookId === book.id) throw new Error('这部作品正在生成，先停止再删除');
                const keys = new Set([book.coverKey, ...book.chapters.flatMap(part => part.panels.map(panel => panel.imageKey))].filter(Boolean));
                await remove('series', book.id);
                for (const imageKey of keys) await remove('images', imageKey).catch(console.warn);
                say('作品已删除');
                return goBack('home');
            }
            case 'export-project': { const book = await current(); if (book) say(await exportProject(book) || '项目已导出'); return; }
            case 'save-piece': { const book = await current(); say(await savePiece(book, chapter(book)) || '成品图已保存'); return; }
            case 'export-zip': { const book = await current(); say(await exportZip(book, chapter(book)) || 'ZIP 已导出'); return; }
            case 'export-pdf': { const book = await current(); say(await exportPdf(book, chapter(book)) || 'PDF 已导出'); return; }
            case 'wallpaper': { const book = await current(); await setWallpaper(book, chapter(book), key); say(key === 'lock' ? '已设为锁屏壁纸' : '已设为桌面壁纸'); return; }
            case 'like': {
                const liked = await mutateChapter(state.seriesId, state.chapterId, part => (part.liked = !part.liked));
                button.classList.toggle('liked', !!liked);
                button.innerHTML = `<i class="${liked ? 'ri-heart-3-fill' : 'ri-heart-3-line'}"></i>`;
                return;
            }
            case 'rate': {
                const score = Number(key);
                await mutateChapter(state.seriesId, state.chapterId, part => { part.rating = score; });
                root().querySelectorAll('[data-action="rate"]').forEach(star => star.classList.toggle('on', Number(star.dataset.id) <= score));
                return;
            }
            case 'toggle-bars': root().querySelector('.ct-shell')?.classList.toggle('bars-hidden'); return;
            case 'stop-job': stopGeneration(); return;
            case 'generate': if (inJob) return; launch(() => startGeneration(state.seriesId, state.chapterId)); return editor();
            case 'generate-panel': if (inJob) return; launch(() => startGeneration(state.seriesId, state.chapterId, [key])); return;
            case 'upload-panel': root().querySelector(`[data-upload="${CSS.escape(key)}"]`)?.click(); return;
            case 'replan': {
                const part = chapter(await current());
                if (!part || inJob) return;
                if (part.panels.some(panel => panel.imageKey) && !confirm('重写分镜会替换现在的分镜和已生成的图片，继续吗？')) return;
                launch(() => planChapter(state.seriesId, state.chapterId));
                return;
            }
            case 'panel-add': {
                const book = await current(), part = chapter(book);
                const typeInfo = typeOf(book.type);
                if (part.panels.length >= typeInfo.panels[1]) throw new Error(`${typeInfo.label}最多 ${typeInfo.panels[1]} 格`);
                part.panels.push({ id: id('panel'), beat: '新的一格', shot: typeInfo.fixedShot || 'tall', gutter: 'normal', tone: 'light', scene: '', chars: [], prompt: '', bubbles: [], imageKey: '', seed: null, error: '' });
                await save(book);
                return editor();
            }
            case 'panel-up': case 'panel-down': case 'panel-delete': return movePanel(key, type);
            case 'char-add': {
                await mutatePanel(state.seriesId, state.chapterId, key, (_, __, panel) => { panel.chars.push({ who: button.dataset.who, tags: '', x: button.dataset.who === 'user' ? 0.65 : 0.35, y: 0.5 }); });
                return refreshPanel(key);
            }
            case 'char-remove': {
                await mutatePanel(state.seriesId, state.chapterId, key, (_, __, panel) => { panel.chars.splice(Number(button.dataset.index), 1); });
                return refreshPanel(key);
            }
            case 'bubble-add': {
                await mutatePanel(state.seriesId, state.chapterId, key, (_, __, panel) => { const bubble = { id: id('bubble'), who: 'char', kind: 'speech', text: '……' }; panel.bubbles.push(bubble); autoPlaceBubbles(panel); });
                return refreshPanel(key);
            }
            case 'bubble-remove': {
                const card = button.closest('[data-panel-card]');
                await mutatePanel(state.seriesId, state.chapterId, card.dataset.panelCard, (_, __, panel) => { panel.bubbles = panel.bubbles.filter(item => item.id !== key); });
                return refreshPanel(card.dataset.panelCard);
            }
            case 'save-cast': {
                const book = await current();
                const provider = book.cast?.provider || imageRoute().provider;
                await saveCastProfile('char', book.charId, provider, book.cast?.char);
                await saveCastProfile('user', book.personaId || 'default', provider, book.cast?.user);
                say('已保存：以后给这两人画的作品都会用这套外观');
                return;
            }
            case 'delete-profile': if (!confirm('删除这份外观档案？下次会重新生成。')) return; await remove('profiles', key); return materials();
            case 'delete-material': {
                const item = await get('materials', key);
                if (!item || !confirm('删除这个素材？')) return;
                await remove('materials', key); await remove('images', item.imageKey);
                return materials();
            }
            default:
        }
    }
    async function applyEdit(target) {
        if (target.dataset.edit) {
            const field = target.dataset.edit;
            const value = target.value;
            const book = await current(), part = chapter(book);
            if (!part) return;
            const series = typeOf(book.type).series;
            if (field === 'title') {
                const text = value.trim();
                if (!text) return;
                if (series) { part.title = text; part.titleLocked = true; } else { book.title = text; book.titleLocked = true; part.title = text; }
            } else if (field.startsWith('cast.')) {
                book.cast = { ...(book.cast || {}), provider: book.cast?.provider || imageRoute().provider, [field.slice(5)]: value.trim() };
            } else if (field.startsWith('poster.')) {
                part.poster = { ...(part.poster || {}), [field.slice(7)]: value.trim() };
            } else {
                part[field] = value;
            }
            part.updatedAt = Date.now();
            await save(book);
            return;
        }
        const card = target.closest('[data-panel-card]');
        if (card && (target.dataset.panelField || target.dataset.charField !== undefined || target.dataset.bubbleField)) {
            const panelId = card.dataset.panelCard;
            await mutatePanel(state.seriesId, state.chapterId, panelId, (_, __, panel) => {
                if (target.dataset.panelField) panel[target.dataset.panelField] = target.value;
                else if (target.dataset.charField !== undefined) { const person = panel.chars[Number(target.dataset.charField)]; if (person) person.tags = target.value.trim(); }
                else {
                    const bubble = panel.bubbles.find(item => item.id === target.closest('[data-bubble-row]')?.dataset.bubbleRow);
                    if (bubble) {
                        bubble[target.dataset.bubbleField] = target.dataset.bubbleField === 'text' ? target.value.trim() : target.value;
                        if (bubble.who === 'narration' && !['narration', 'caption'].includes(bubble.kind)) bubble.kind = 'narration';
                        if (bubble.who === 'sfx') bubble.kind = 'sfx';
                    }
                }
            });
            if (['shot', 'gutter', 'tone'].includes(target.dataset.panelField) || target.dataset.bubbleField) await refreshPanel(panelId);
        }
    }
    // ---- boot ----
    function bind() {
        const host = root();
        if (!host || host.dataset.bound) return;
        host.dataset.bound = '1';
        host.addEventListener('click', event => {
            const button = event.target.closest('[data-action]');
            if (!button || button.disabled) return;
            if (button.dataset.action === 'toggle-bars' && event.target.closest('button, a, input, textarea, select, .ct-bubble')) return;
            event.preventDefault();
            run(() => action(button));
        });
        host.addEventListener('submit', event => {
            event.preventDefault();
            const form = event.target;
            run(async () => {
                if (form.id === 'ct-material-form') {
                    const data = new FormData(form);
                    const imageKey = await storeImage(await fileData(data.get('file')));
                    await put('materials', { id: id('material'), title: String(data.get('title')).trim(), kind: String(data.get('kind')), imageKey, createdAt: Date.now() });
                    await materials();
                    say('素材已保存');
                }
                if (form.id === 'ct-comment-form') {
                    const text = String(new FormData(form).get('text') || '').trim();
                    if (!text) return;
                    const comment = { id: id('comment'), who: 'user', text: text.slice(0, 200), at: Date.now() };
                    const bookId = state.seriesId, chapterId = state.chapterId;
                    await mutateChapter(bookId, chapterId, part => { part.comments.push(comment); });
                    const book = await current();
                    const section = root().querySelector('.ct-comments');
                    if (section) section.outerHTML = commentsHtml(book, chapter(book));
                    replyToComment(bookId, chapterId, comment).catch(error => console.warn('作者回复失败', error));
                }
            });
        });
        host.addEventListener('input', event => {
            const target = event.target;
            if (target.dataset.draft && state.draft) {
                state.draft[target.dataset.draft] = target.type === 'range' ? Number(target.value) : target.value;
                if (target.type === 'range') { const label = root().querySelector('[data-panel-count]'); if (label) label.textContent = target.value; }
            }
        });
        host.addEventListener('change', event => {
            const target = event.target;
            if (target.dataset.draft) return;
            run(async () => {
                if (target.dataset.history) {
                    if (target.checked) state.selectedHistory.add(target.dataset.history);
                    else state.selectedHistory.delete(target.dataset.history);
                    return;
                }
                if (target.dataset.ref && target.files[0] && state.draft) {
                    state.draft[target.dataset.ref] = await fileData(target.files[0]);
                    target.closest('.ct-file')?.classList.add('picked');
                    return;
                }
                if (target.id === 'ct-import-file' && target.files[0]) {
                    const book = await importProject(target.files[0]);
                    target.value = '';
                    state.seriesId = book.id;
                    say('漫画项目已导入');
                    await openBook(book.id);
                    return;
                }
                if (target.dataset.upload && target.files[0]) {
                    const panelId = target.dataset.upload;
                    const imageKey = await storeImage(await fileData(target.files[0]));
                    const oldKey = await mutatePanel(state.seriesId, state.chapterId, panelId, (book, part, panel) => {
                        const previous = panel.imageKey;
                        panel.imageKey = imageKey; panel.error = '';
                        if (!book.coverKey || book.coverKey === previous) book.coverKey = part.panels[0]?.imageKey || imageKey;
                        return previous;
                    });
                    if (oldKey) await remove('images', oldKey).catch(console.warn);
                    await refreshPanel(panelId);
                    return;
                }
                if (target.dataset.profile) {
                    const item = await get('profiles', target.dataset.profile);
                    if (item) { item.text = target.value.trim(); item.updatedAt = Date.now(); await put('profiles', item); say('外观档案已保存'); }
                    return;
                }
                if (target.dataset.bookStatus !== undefined || target.dataset.bookTitle !== undefined) {
                    const book = await current();
                    if (target.dataset.bookStatus !== undefined) book.status = target.value;
                    if (target.dataset.bookTitle !== undefined && target.value.trim()) { book.title = target.value.trim(); book.titleLocked = true; }
                    await save(book);
                    say('已保存');
                    return;
                }
                await applyEdit(target);
            });
        });
        bindBubbleDrag(host);
    }
    async function open(source = null) {
        bind();
        state.source = source;
        if (source) {
            state.selectedHistory.clear();
            state.draft = freshDraft();
            createView();
            return;
        }
        if (state.view === 'viewer' || state.view === 'editor' || state.view === 'series') {
            await run(() => state.view === 'viewer' ? viewer() : state.view === 'editor' ? editor() : seriesView());
        } else {
            await run(() => state.tab === 'shelf' ? shelf() : state.tab === 'materials' ? materials() : home());
        }
        maybeProactive().catch(error => say(error.message || '每周连载生成失败', true));
    }
    window.ByndComic = {
        open,
        openBook,
        fromChat(charId) { window._comicPendingSource = { kind: 'chat', charId }; openApp('comic'); },
        fromSource(kind, charId, text) { window._comicPendingSource = { kind, charId, text }; openApp('comic'); },
        storage: { all, get, put, remove },
        _test: { validatePlan, durableImage, makeZip, makePdf, upgradeBook, planSystemPrompt, planContext, naiInput, apiPrompt, pieceHtml, autoPlaceBubbles, TYPES, SHOTS, GUTTERS }
    };
})();
