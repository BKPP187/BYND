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
