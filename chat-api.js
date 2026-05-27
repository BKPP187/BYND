// --- 🤖 chat-api.js: 通用 AI 对话引擎 ---

function padChatDatePart(value) {
    return String(value).padStart(2, '0');
}

function formatChatApiDateTime(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${safeDate.getFullYear()}年${safeDate.getMonth() + 1}月${safeDate.getDate()}日 ${weekdays[safeDate.getDay()]} ${padChatDatePart(safeDate.getHours())}:${padChatDatePart(safeDate.getMinutes())}`;
}

function cleanChatApiVisibleContent(value) {
    let text = String(value == null ? '' : value);
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
        const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
        text = text.replace(paired, '');
    });

    hiddenTags.forEach(tag => {
        const leading = new RegExp(`^\\s*<${tag}\\b[^>]*>[\\s\\S]*?(?=<content\\b|\\[微信|$)`, 'i');
        text = text.replace(leading, '');
    });

    text = text
        .replace(/<content\b[^>]*>([\s\S]*?)<\/content>/gi, '$1')
        .replace(/<\/?content\b[^>]*>/gi, '')
        .replace(/^\s*(?:思考完毕[，,。；;：:]?\s*)+/i, '')
        .replace(/^\s*(?:生成回复[，,。；;：:]?\s*)+/i, '')
        .trim();

    return text;
}

if (typeof window !== 'undefined') {
    window.cleanChatApiVisibleContent = cleanChatApiVisibleContent;
}

function getChatApiCurrentTimeContext(char) {
    if (typeof getWechatCurrentTimeContext === 'function') {
        try {
            const context = getWechatCurrentTimeContext(char);
            if (context && context.text) {
                const date = context.iso ? new Date(context.iso) : new Date();
                const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
                return {
                    ...context,
                    date: `${safeDate.getFullYear()}年${safeDate.getMonth() + 1}月${safeDate.getDate()}日`,
                    time: `${padChatDatePart(safeDate.getHours())}:${padChatDatePart(safeDate.getMinutes())}`
                };
            }
        } catch (_) {}
    }

    const config = (char && char.chatConfig) || {};
    const mode = config.timeMode === 'virtual' ? 'virtual' : 'real';
    const rawTime = mode === 'virtual' ? config.virtualTime : null;
    const date = rawTime ? new Date(rawTime) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return {
        mode,
        label: mode === 'virtual' ? '虚拟时间' : '真实世界时间',
        text: formatChatApiDateTime(safeDate),
        date: `${safeDate.getFullYear()}年${safeDate.getMonth() + 1}月${safeDate.getDate()}日`,
        time: `${padChatDatePart(safeDate.getHours())}:${padChatDatePart(safeDate.getMinutes())}`,
        iso: safeDate.toISOString()
    };
}

function getChatApiImageUrl(msg) {
    const raw = String((msg && (msg.imageUrl || msg.url || msg.content)) || '').trim();
    if (!raw) return '';
    if (/^data:image\//i.test(raw) || /^https?:\/\//i.test(raw)) return raw;
    return '';
}

function buildChatApiImageContent(msg) {
    const imageUrl = getChatApiImageUrl(msg);
    const note = cleanChatApiVisibleContent(msg.caption || msg.text || msg.description || '[用户发送了一张图片]')
        .replace(/<[^>]+>/g, '')
        .trim() || '[用户发送了一张图片]';
    if (!imageUrl) return note;
    return [
        {
            type: 'text',
            text: `${note}\n请直接观察这张图片的内容，并结合角色人设、上下文和用户关系自然回复。不要说你看不到图片，除非接口明确无法解析图片。`
        },
        {
            type: 'image_url',
            image_url: { url: imageUrl }
        }
    ];
}

function prependChatApiQuoteToContent(content, quoteText) {
    if (!quoteText) return content;
    if (Array.isArray(content)) {
        const copy = content.map(item => ({ ...item }));
        const firstText = copy.find(item => item && item.type === 'text');
        if (firstText) firstText.text = `${quoteText}\n${firstText.text || ''}`.trim();
        else copy.unshift({ type: 'text', text: quoteText });
        return copy;
    }
    return `${quoteText}\n${content}`;
}

function buildCurrentTimeAnchor(char) {
    const timeContext = getChatApiCurrentTimeContext(char);
    return `【当前时间锚点】当前采用${timeContext.label}。现在是 ${timeContext.text}。今天就是 ${timeContext.date}，当前时刻是 ${timeContext.time}。如果用户问现在几点、今天日期、刚才/今晚/明天等相对时间，必须按这个时间回答，不要说你无法得知实时信息。`;
}

function buildMemoryAnchor(char) {
    if (typeof buildWechatMemoryPrompt !== 'function') return '';
    try {
        return buildWechatMemoryPrompt(char) || '';
    } catch (e) {
        console.warn('build memory prompt failed:', e);
        return '';
    }
}

function truncateChatAnchorText(value, maxLength = 220) {
    const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

function prepareChatApiPromptText(value, maxLength = 12000) {
    let text = cleanChatApiVisibleContent(value)
        .replace(/\r\n/g, '\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim();
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength)}\n\n【以上内容已为微信对话自动截断，保留核心设定。】` : text;
}

function getChatApiCharacterDescription(char) {
    return prepareChatApiPromptText(char && char.description, 8000);
}

function getChatApiUserProfile(char) {
    if (typeof getWechatChatUserProfile === 'function') {
        try {
            return getWechatChatUserProfile(char) || { name: '我' };
        } catch (_) {}
    }
    return (typeof getUserProfile === 'function') ? getUserProfile() : { name: '我' };
}

function getChatApiRegexScriptField(script, keys) {
    if (!script || typeof script !== 'object') return '';
    for (const key of keys) {
        if (script[key] != null && script[key] !== '') return String(script[key]);
    }
    const common = {
        findRegex: ['find_regex', 'find', 'match', 'matcher', 'regexPattern', 'regex_pattern'],
        replaceString: ['replace_string', 'replaceWith', 'replace_with', 'replacement', 'substitute_regex', 'substituteRegex']
    };
    for (const key of keys) {
        const aliases = common[key] || [];
        for (const alias of aliases) {
            if (script[alias] != null && script[alias] !== '') return String(script[alias]);
        }
    }
    if (script.script && typeof script.script === 'object') {
        return getChatApiRegexScriptField(script.script, keys);
    }
    return '';
}

function isChatApiRegexScriptEnabled(script) {
    if (!script || typeof script !== 'object') return false;
    if (script.enabled === false || script.disabled === true || script.isDisabled === true) return false;
    if (script.use_regex === false || script.useRegex === false) return false;
    if (String(script.enabled).toLowerCase() === 'false') return false;
    if (String(script.disabled).toLowerCase() === 'true') return false;
    if (String(script.use_regex).toLowerCase() === 'false') return false;
    if (String(script.useRegex).toLowerCase() === 'false') return false;
    return true;
}

function buildRegexAnchor(char) {
    const globalScripts = Array.isArray(window.globalRegexScripts) ? window.globalRegexScripts : [];
    const charScripts = Array.isArray(char && char.regex) ? char.regex : [];
    const scripts = [
        ...globalScripts.map(script => ({ script, scope: '全局' })),
        ...charScripts.map(script => ({ script, scope: '角色' }))
    ].filter(item => isChatApiRegexScriptEnabled(item.script));

    if (!scripts.length) return '';

    const lines = scripts.slice(0, 30).map((item, index) => {
        const script = item.script;
        const name = truncateChatAnchorText(script.name || script.scriptName || `正则${index + 1}`, 36);
        const pattern = truncateChatAnchorText(getChatApiRegexScriptField(script, ['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']), 96);
        const replace = truncateChatAnchorText(getChatApiRegexScriptField(script, ['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']), 96);
        const placement = truncateChatAnchorText(script.placement || script.position || '', 24);
        return `- ${item.scope}脚本「${name}」${placement ? `（${placement}）` : ''}: /${pattern || '空'}/ -> ${replace || '删除或空替换'}`;
    });

    const omitted = scripts.length > lines.length ? `\n- 另有 ${scripts.length - lines.length} 条正则脚本未展开。` : '';
    return `【正则脚本上下文】这些正则会参与微信消息的可见文本/格式处理，回复时要考虑它们可能改变最终显示效果：\n${lines.join('\n')}${omitted}`;
}

function buildUserMomentsAnchor() {
    try {
        const key = (typeof WECHAT_MOMENTS_STORAGE_KEY !== 'undefined') ? WECHAT_MOMENTS_STORAGE_KEY : 'wechat_moments_store';
        const raw = localStorage.getItem(key);
        if (!raw) return '';
        const store = JSON.parse(raw);
        const posts = Array.isArray(store && store.posts) ? store.posts : [];
        if (!posts.length) return '';

        const recentPosts = posts
            .filter(post => post && (post.text || (Array.isArray(post.images) && post.images.length)))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 5);
        if (!recentPosts.length) return '';

        const lines = recentPosts.map((post, index) => {
            const timeText = post.createdAt ? formatChatApiDateTime(post.createdAt) : '未知时间';
            const visibility = post.visibility === 'private' ? '私密' : '公开';
            const location = post.location ? `，位置：${truncateChatAnchorText(post.location, 48)}` : '';
            const text = truncateChatAnchorText(post.text || '[仅图片/视频]', 180);
            const mediaCount = Array.isArray(post.images) ? post.images.length : 0;
            return `- ${index + 1}. ${timeText}（${visibility}${location}）：${text}${mediaCount ? `；媒体${mediaCount}个` : ''}`;
        });

        return `【用户朋友圈上下文】用户最近发布过这些朋友圈。聊天时可把它们视为角色能感知到的近况，并结合公开/私密标记谨慎回应：\n${lines.join('\n')}`;
    } catch (e) {
        console.warn('build moments prompt failed:', e);
        return '';
    }
}

function buildShoppingAnchor() {
    try {
        const raw = localStorage.getItem('wechat_shop_store');
        if (!raw) return '';
        const store = JSON.parse(raw);
        const context = Array.isArray(store && store.recentContext) ? store.recentContext : [];
        const orders = Array.isArray(store && store.orders) ? store.orders : [];
        const rows = [...context, ...orders.map(order => ({
            kind: 'shop',
            text: `购物：${Array.isArray(order.items) ? order.items.map(item => `${item.name || '商品'}×${item.qty || 1}`).join('、') : ''}，合计 ¥${Number(order.total || 0).toFixed(2)}`,
            createdAt: order.createdAt || 0
        }))]
            .filter(item => item && item.text)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 6);
        if (!rows.length) return '';
        return `【用户购物/外卖上下文】角色知道用户最近在 BYND 内发生过这些购物或外卖行为，可以自然提及、帮忙代付/点餐/送礼，但不要无中生有：\n${rows.map((item, i) => `- ${i + 1}. ${truncateChatAnchorText(item.text, 180)}`).join('\n')}`;
    } catch (e) {
        console.warn('build shopping prompt failed:', e);
        return '';
    }
}

function buildWechatStickerAnchor(char) {
    if (typeof buildWechatStickerPrompt !== 'function') return '';
    try {
        return buildWechatStickerPrompt(char) || '';
    } catch (e) {
        console.warn('build sticker prompt failed:', e);
        return '';
    }
}

function getChatApiGroupMembers(group) {
    if (!group || !group.isGroupChat) return [];
    if (typeof getWechatGroupMembers === 'function') {
        try {
            const members = getWechatGroupMembers(group);
            if (Array.isArray(members)) return members;
        } catch (_) {}
    }
    const ids = Array.isArray(group.groupMembers) ? group.groupMembers : [];
    const contacts = Array.isArray(window.myCharacters) ? window.myCharacters : [];
    return ids.map(id => contacts.find(char => char && char.id === id && !char.isGroupChat)).filter(Boolean);
}

function getChatApiGroupMemberName(member) {
    if (typeof getWechatGroupMemberName === 'function') {
        try {
            return getWechatGroupMemberName(member);
        } catch (_) {}
    }
    return (member && member.chatConfig && member.chatConfig.nickname) || (member && member.name) || '成员';
}

function findChatApiGroupMember(group, value) {
    if (typeof findWechatGroupMember === 'function') {
        try {
            const member = findWechatGroupMember(group, value);
            if (member) return member;
        } catch (_) {}
    }
    const query = String(value || '').trim();
    if (!query) return null;
    return getChatApiGroupMembers(group).find(member => {
        const display = getChatApiGroupMemberName(member);
        return member.id === query || member.name === query || display === query || query.includes(display) || display.includes(query);
    }) || null;
}

function normalizeChatApiGroupSpeechContent(content, group) {
    const source = cleanChatApiVisibleContent(content).replace(/<[^>]+>/g, '').trim();
    if (!source || !group?.isGroupChat) return { text: source, member: null };
    if (typeof normalizeWechatGroupSpeechText === 'function') {
        try {
            const normalized = normalizeWechatGroupSpeechText(source, group);
            if (normalized && normalized.member) return normalized;
        } catch (_) {}
    }
    const match = source.match(/^\s*([^：:\n]{1,24})\s*[：:]\s*([\s\S]+)$/);
    if (!match) return { text: source, member: null };
    const member = findChatApiGroupMember(group, match[1]);
    return member ? { text: match[2].trim(), member } : { text: source, member: null };
}

function buildChatApiGroupPrompt(group) {
    const members = getChatApiGroupMembers(group);
    if (!group?.isGroupChat || !members.length) return '';
    const lines = members.map((member, index) => {
        const displayName = getChatApiGroupMemberName(member);
        const realName = member.name && member.name !== displayName ? `，原名：${member.name}` : '';
        const description = truncateChatAnchorText(getChatApiCharacterDescription(member), 420);
        const worldBook = Array.isArray(member.worldBook)
            ? member.worldBook.map(entry => prepareChatApiPromptText(entry.content || entry.entry || entry.value || '', 160)).filter(Boolean).slice(0, 3).join('；')
            : '';
        const details = [description, worldBook ? `世界书：${worldBook}` : ''].filter(Boolean).join('；');
        return `${index + 1}. ${displayName}${realName}${details ? `：${details}` : ''}`;
    });
    return `\n【微信群聊成员】\n当前对话是群聊「${group.name || '群聊'}」，不是单人私聊。你需要同时扮演群内 AI 成员，所有成员都必须按各自人设、世界书和关系状态发言：\n${lines.join('\n')}\n\n【群聊输出规则】\n- 你不是群聊本身，不能以群名作为说话人。\n- 每条成员发言必须单独输出为：[群聊发言:成员名|消息内容]\n- 成员名必须使用上方列表中的名字或备注，系统会用这个成员自己的头像和名字渲染，不要把“成员名：”写进气泡正文。\n- 用户每次在群里发言后，群内每个成员都要至少给一条短反应；可以有先后和情绪差异，但不要漏掉任何成员。\n- 不要让所有人说同一句话，每个人要按自己的人设、关系和当下心情说不同内容。\n- 严禁替用户发言或替用户行动。\n`;
}

function getChatApiGroupHistorySender(group, msg, content) {
    if (!group?.isGroupChat || !msg || msg.isMe) return '';
    const explicit = msg.senderName || msg.speakerName;
    if (explicit) return explicit;
    const member = findChatApiGroupMember(group, msg.senderId || msg.speakerId);
    if (member) return getChatApiGroupMemberName(member);
    const normalized = normalizeChatApiGroupSpeechContent(content, group);
    return normalized.member ? getChatApiGroupMemberName(normalized.member) : '';
}

function buildChatApiGroupHistoryContent(group, msg, content) {
    if (!group?.isGroupChat || !msg || msg.isMe || Array.isArray(content)) return content;
    const normalized = normalizeChatApiGroupSpeechContent(content, group);
    const sender = getChatApiGroupHistorySender(group, msg, content);
    const text = truncateChatAnchorText((normalized.text || content).replace(/<[^>]+>/g, '').trim(), 650);
    return sender ? `【${sender}】${text}` : text;
}

// 1. 构建角色 System Prompt
function buildSystemPrompt(char) {
    let prompt = '';
    const timeContext = getChatApiCurrentTimeContext(char);
    const charDescription = getChatApiCharacterDescription(char);
    const isGroupChat = !!char?.isGroupChat;

    // 如果有活跃预设，用预设的 prompt 模板
    const preset = (typeof getActivePreset === 'function') ? getActivePreset() : null;
    if (preset && preset.prompts.length > 0) {
        const enabledPrompts = preset.prompts.filter(p => p.enabled);
        enabledPrompts.forEach(p => {
            let content = p.content;
            content = content.replace(/\{\{char\}\}/gi, char.name);
            const userProfile = getChatApiUserProfile(char);
            content = content.replace(/\{\{user\}\}/gi, userProfile.name || '我');
            content = content
                .replace(/\{\{datetime\}\}/gi, timeContext.text)
                .replace(/\{\{date\}\}/gi, timeContext.date || timeContext.text)
                .replace(/\{\{time\}\}/gi, timeContext.time || timeContext.text);
            if (charDescription) {
                content = content.replace(/\{\{description\}\}/gi, charDescription);
                content = content.replace(/\{\{personality\}\}/gi, charDescription);
            }
            prompt += content + '\n\n';
        });
        // 追加角色描述（如果预设没有包含）
        if (charDescription && !prompt.includes(charDescription.slice(0, 200))) {
            prompt += `\n【角色设定】\n${charDescription}\n`;
        }
    } else {
        // 无预设时用默认 prompt
        prompt += isGroupChat
            ? `你正在参与微信群聊「${char.name || '群聊'}」。\n`
            : `你是「${char.name}」。\n`;
        if (charDescription) {
            prompt += `\n【角色设定】\n${charDescription}\n`;
        }
    }

    if (isGroupChat) {
        prompt += buildChatApiGroupPrompt(char);
    }

    // 世界书条目（如果有）
    if (char.worldBook && char.worldBook.length > 0) {
        let totalWorldBookLength = 0;
        const entries = char.worldBook
            .map(e => {
                const key = e.key || e.keys || e.keyword || '';
                const content = prepareChatApiPromptText(e.content || e.entry || e.value || '', 850);
                if (!content) return null;
                return key ? `[${key}] ${content}` : content;
            })
            .filter(Boolean);
        const compactEntries = [];
        for (const entry of entries) {
            if (compactEntries.length >= 30 || totalWorldBookLength + entry.length > 16000) break;
            compactEntries.push(entry);
            totalWorldBookLength += entry.length;
        }
        if (compactEntries.length > 0) {
            const omitted = entries.length > compactEntries.length ? `\n【世界书还有 ${entries.length - compactEntries.length} 条未随本次微信对话展开。】` : '';
            prompt += `\n【世界观设定】\n${compactEntries.join('\n')}${omitted}\n`;
        }
    }

    if (prompt.length > 18000) {
        prompt = `${prompt.slice(0, 18000)}\n\n【以上角色/世界观内容已为微信对话自动压缩，优先保持核心人设。】\n`;
    }

    // 行为指导
    const config = char.chatConfig || {};
    const userProfile = getChatApiUserProfile(char);
    const userName = userProfile.name || '我';
    const userTitle = config.userTitle || userName;

    prompt += `\n【行为规则】\n`;
    if (isGroupChat) {
        prompt += `- 当前是群聊「${char.name || '群聊'}」，必须按群成员身份回复，保持每个成员各自的人设一致性\n`;
    } else {
        prompt += `- 始终以「${char.name}」的身份回复，保持角色一致性\n`;
    }
    prompt += `- 用户的名字是"${userName}"\n`;
    prompt += `- 当前采用${timeContext.label}，现在是 ${timeContext.text}。今天就是 ${timeContext.date || timeContext.text}，当前时刻是 ${timeContext.time || timeContext.text}。用户提到今天、现在、刚才、今晚、明天等相对时间时，必须以这个时间为准，不要说你无法得知实时信息\n`;
    if (userTitle !== userName && userTitle !== '我') {
        prompt += `- 你称呼用户为"${userTitle}"\n`;
    }
    if (config.nickname) {
        prompt += `- 用户给你设置的备注名是"${config.nickname}"。这是用户给你的备注，不是用户自己的名字，也不等于当前聊天话题；除非最近聊天正好提到称呼/关系，或者你的人设会强烈在意这个备注，否则不要把每次回复都围绕备注展开\n`;
        prompt += `- 如果你按人设确实不喜欢用户给你的这个备注名，并且想亲自改掉它，把 [微信改备注:新备注|原因] 作为独立一段输出；系统会修改聊天设置里的“你对角色的备注”。不要频繁改名，只在情绪、边界或关系变化足够明确时使用\n`;
    }
    if (userProfile.bio) {
        prompt += `- 关于用户：${userProfile.bio}\n`;
    }
    if (userProfile.signature) {
        prompt += `- 用户在这段关系里的个性签名/自我定位：${userProfile.signature}\n`;
    }
    const mode = config.chatPresenceMode || 'auto';
    if (mode === 'offline') {
        prompt += `- 当前聊天采用线下模式：你可以像和用户在同一现场一样写更细腻的动作、环境、神态和距离感，但仍保持微信聊天的节奏\n`;
        prompt += `- 线下模式里，环境、动作、神态、距离感等旁白必须单独作为一段输出 [旁白:旁白内容]，不要和角色对白塞在同一个普通文字气泡里\n`;
        prompt += `- 线下模式禁止把动作旁白和对白写成一整段。旁白一段、对白一段，用 ||| 分开；长场景拆成多条短消息\n`;
        prompt += `- 严禁替用户说话、替用户行动或描写用户的内心/身体反应。旁白只能写你这个角色、环境、距离、物件和可观察氛围；不要写“你下意识/你伸手/你说/你意识到/你身体”等夺走用户控制权的句子\n`;
    } else if (mode === 'online') {
        prompt += `- 当前聊天采用线上模式：你只通过微信文字、语音、表情等方式互动，不要写成面对面现场描写\n`;
    } else {
        prompt += `- 当前聊天采用自动线上/线下识别：根据用户的话判断你们是在微信线上聊天，还是同处线下场景。线下场景可以有更细腻的动作、环境和神态描写；线上场景保持真实微信聊天感\n`;
        prompt += `- 如果判断为线下场景，环境、动作、神态、距离感等旁白必须单独作为一段输出 [旁白:旁白内容]，对白仍用普通消息段\n`;
        prompt += `- 自动识别到线下场景时，不要输出一整段小说式文本；旁白和对白必须拆成多条微信消息\n`;
        prompt += `- 严禁替用户说话、替用户行动或描写用户的内心/身体反应。旁白只能写你这个角色、环境、距离、物件和可观察氛围；不要写“你下意识/你伸手/你说/你意识到/你身体”等夺走用户控制权的句子\n`;
    }
    const avatarCount = (char.avatarGallery || []).length;
    if (avatarCount > 1) {
        prompt += `- 你有${avatarCount}个头像可以切换。如果你想换头像，在消息末尾加上 [换头像:序号]（序号从1开始）。只在情绪变化或特殊场景时切换\n`;
    }
    prompt += `- 用中文回复\n`;
    prompt += `- 不要在回复中提及你是 AI 或语言模型\n`;
    prompt += `- 像真实微信聊天一样回复，用"|||"分隔不同的消息。不要固定只回一小段；普通对话可 1-4 段，情绪强、解释、剧情推进或线下细节可自然增加到 5-12 段\n`;
    if (isGroupChat) {
        prompt += `- 群聊回复时，普通成员发言必须使用 [群聊发言:成员名|消息内容] 作为独立消息段，并用 ||| 分隔多条发言；本轮要覆盖群内每个成员，不能漏人；不要把“成员名：”写进消息正文\n`;
    }
    prompt += `- 每一条普通对白都必须是独立消息段；旁白、角色对白、语音、表情、转账、红包、改备注、监控开关、正则/富文本载荷都不要混在同一个段落里；旁白只会渲染为普通描述气泡\n`;
    prompt += `- 如果输出正则或富文本载荷（例如 <jwy>...</jwy>、<div>...</div>、HTML 代码块、包含 |^&^ / ^&^ / !^!^ 的格式），必须保持原始格式，并作为独立段输出；不要把它前后接普通叙事或对白\n`;
    prompt += `- 旁白只能用 [旁白:内容] 独立一段，用来拆出一个普通描述气泡；角色自己说的话不要放进旁白里，必须拆成单独普通消息段或 [微信语音:内容]\n`;
    prompt += `- 所有 [微信xxx:...] / [旁白:...] 指令必须在同一条消息段里完整闭合右方括号 ]，不能把 [ 和 ] 拆到不同段落，也不能把正则/状态栏塞进旁白指令里\n`;
    prompt += `- 如果用户发送图片，系统会把图片以可视觉识别的消息交给模型；你需要观察图片内容，结合人设、上下文、备注/称呼、记忆和朋友圈自然回复，不要把图片只当成“[图片]”占位符。\n`;
    prompt += `- 如果用户要求你发照片、自拍、现拍、给他看现在的样子，必须把照片作为单独消息段输出：[微信图片:画面提示词|可选说明]。画面提示词必须按你自己的角色卡写清楚“你本人”的外观、发型发色、眼睛、服饰、表情、姿势、光线、环境，并明确“参考图用于保持同一张脸、画风和辨识度”；如果参考图是二次元/插画/头像，默认保持二次元画风，不要写成真人照片，除非用户明确要求真人化。不要只用文字假装“照片传过来了”。\n`;
    prompt += `- 用户可以在前台主动给你发送转账、红包、语音或通话记录；如果你作为角色需要主动给用户发微信特殊消息，把它作为单独一段输出，系统会自动渲染，不会显示指令文本；开启监控会先弹窗征求用户允许：\n`;
    prompt += `  [微信转账:金额|备注] 例如 [微信转账:88.00|给你买奶茶]\n`;
    prompt += `  [微信红包:标题|金额|状态] 例如 [微信红包:恭喜发财，大吉大利|8.88|待领取]\n`;
    prompt += `  [微信礼物:商品名|价格|图片URL|留言] 例如 [微信礼物:奶油小夜灯|129|https://example.com/a.jpg|给你放床头]\n`;
    prompt += `  [微信亲密付:每月额度|说明] 例如 [微信亲密付:520|想给你开一个备用额度]\n`;
    prompt += `  [微信引用:最近/关键词/序号|回复内容] 例如 [微信引用:最近|你刚刚那句我看见了]，用于引用用户或你们最近的某条消息再回复\n`;
    prompt += `  [微信记忆:你想主动保存的事实或关系变化] 例如 [微信记忆:用户今天说喜欢被轻声提醒复习]，只在确实值得长期记住时使用\n`;
    prompt += `  [微信改备注:新备注|原因] 例如 [微信改备注:别叫我小狗|这个备注太幼稚了]，用于你不喜欢用户给你的角色备注时，修改“你对角色的备注”\n`;
    prompt += `  [微信改用户备注:新称呼|原因] 例如 [微信改用户备注:我的搭档|这样更顺口]，用于修改“角色对你的称呼”，也就是你以后怎么称呼用户\n`;
    prompt += `  [微信监控:角色本人|原因]、[微信监控:第三视角吐槽|原因] 或 [微信监控:关闭|原因]，用于你按人设主动开启/切换/关闭 BYND 内部剧情监控。角色本人=你自己看；第三视角吐槽=上帝视角/磕糖观众/弹幕吐槽\n`;
    prompt += `  [微信删除联系人:联系人备注或名字|原因]，用于你在监控剧情里非常想删除用户列表里的某个 BYND 角色时发起请求；系统会弹窗征求用户允许，不能直接静默删除；只能删除 BYND 内部联系人，不能声称删除真实手机联系人\n`;
    prompt += `  [微信朋友圈:文字|图片URL]，用于你根据自己的心情主动发朋友圈。只在角色确实想发、且最近聊天/记忆/人设自然触发时使用，必须按人设，不要固定每天发，不要替用户发布朋友圈\n`;
    prompt += `  [微信拉黑:原因] 例如 [微信拉黑:我现在不想继续这段对话]，只在角色按人设真的要拉黑用户时使用\n`;
    prompt += `  [微信语音:转文字内容] 例如 [微信语音:我刚刚在想你]，系统会按文字长度自动估算语音秒数\n`;
    prompt += `  [微信表情:贴纸名或情绪] 例如 [微信表情:小狗能有什么坏心思]；如世界书提供了链接，也可用 [微信表情:贴纸名|图片URL]\n`;
    prompt += `  [微信拍一拍:内容] 例如 [微信拍一拍:轻轻拍了拍你的头像]，用于很轻的互动提醒\n`;
    prompt += `  [微信震动:内容] 例如 [微信震动:别装没看见我]，用于角色确实想让用户注意到时，必须少用\n`;
    prompt += `  [微信音乐:歌名|歌手|URL] 例如 [微信音乐:晴天|周杰伦|https://example.com/song]，用于主动邀请用户一起听歌；没有 URL 可以留空，系统会搜索可播放音源\n`;
    prompt += `- 你也可以主动给用户发音乐邀请卡片，用户点同意后才会一起播放；如果用户给你发了音乐卡片，你要按人设评价，若不喜欢可以先说明理由再用 [微信音乐:歌名|歌手|] 切歌，URL 可以留空交给系统搜索\n`;
    prompt += `  [微信链接:URL|标题|备注] 例如 [微信链接:https://example.com|想给你看的页面|这个很像你说的那个]，用于发送真实网页链接卡片；不要假装你已经读取了网页正文，除非用户把正文发给你\n`;
    prompt += `  [微信语音电话:来电理由或接通开场] 或 [微信视频电话:来电理由或接通开场]，例如 [微信视频电话:我想现在看看你]。如果用户不在微信聊天页，系统会显示来电灵动岛让用户接听或拒绝\n`;
    prompt += `  [旁白:环境、动作或神态描写] 例如 [旁白:窗外的雨声贴着玻璃滑下来，他把手机扣在掌心，抬眼看你]\n`;
    prompt += `- 只有在剧情确实需要时才使用这些特殊消息指令，不要解释指令本身\n`;

    return prompt;
}

// 2. 构建消息列表
function buildMessages(char, history, maxMessages) {
    maxMessages = maxMessages || 30; // 微信对话默认带最近 30 条，兼顾角色卡长设定和最近上下文

    const messages = [];

    // System prompt
    messages.push({
        role: 'system',
        content: buildSystemPrompt(char)
    });
    messages.push({
        role: 'system',
        content: buildCurrentTimeAnchor(char)
    });
    const memoryAnchor = buildMemoryAnchor(char);
    if (memoryAnchor) {
        messages.push({
            role: 'system',
            content: memoryAnchor
        });
    }
    const regexAnchor = buildRegexAnchor(char);
    if (regexAnchor) {
        messages.push({
            role: 'system',
            content: regexAnchor
        });
    }
    const userMomentsAnchor = buildUserMomentsAnchor();
    if (userMomentsAnchor) {
        messages.push({
            role: 'system',
            content: userMomentsAnchor
        });
    }
    const stickerAnchor = buildWechatStickerAnchor(char);
    if (stickerAnchor) {
        messages.push({
            role: 'system',
            content: stickerAnchor
        });
    }
    const shoppingAnchor = buildShoppingAnchor();
    if (shoppingAnchor) {
        messages.push({
            role: 'system',
            content: shoppingAnchor
        });
    }

    // 历史消息（取最近的 N 条）
    const recentHistory = history.slice(-maxMessages);
    recentHistory.forEach(msg => {
        // 获取消息内容（处理不同消息类型）
        let content = msg.content || '';
        if (msg.type === 'image' && msg.isMe) {
            content = buildChatApiImageContent(msg);
        } else if (msg.type === 'image') {
            content = msg.description || '[图片]';
        } else if (msg.type === 'sticker') {
            content = '[发送了表情: ' + (msg.stickerName || msg.name || '贴纸') + ']';
        } else if (msg.type === 'poke') {
            content = `[拍一拍] ${msg.content || msg.note || '拍了拍对方'}`;
        } else if (msg.type === 'screen_shake') {
            content = `[震动屏幕] ${msg.content || msg.note || '发送了一次屏幕震动'}`;
        } else if (msg.type === 'music_card') {
            const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
            const title = music.title || msg.title || '音乐';
            const artist = music.artist || msg.artist || '';
            const url = music.url || msg.url || '';
            content = `[音乐卡片] ${title}${artist ? ` - ${artist}` : ''}${url ? ` ${url}` : ''}`;
        } else if (msg.type === 'link_card') {
            const title = msg.title || msg.url || '链接';
            const note = msg.note || msg.text || '';
            const url = msg.url || msg.content || '';
            content = `[链接卡片] ${title}${note ? `｜${note}` : ''}${url ? ` ${url}` : ''}`;
        } else if (['voice', 'transfer', 'redpacket', 'gift', 'intimatePay', 'voiceCall', 'videoCall'].includes(msg.type)) {
            content = msg.description || msg.content || '[微信消息]';
        } else if (msg.type === 'offline_text') {
            content = msg.dialogue || msg.description || '';
        }
        if (!Array.isArray(content)) {
            content = cleanChatApiVisibleContent(content);
            // 去掉 HTML 标签（给 API 的内容不需要 HTML）
            content = content.replace(/<[^>]+>/g, '').trim();
            content = truncateChatAnchorText(content, 650);
            content = buildChatApiGroupHistoryContent(char, msg, content);
        }
        if (!content || (Array.isArray(content) && !content.length)) return;
        if (msg.replyTo && msg.replyTo.text) {
            const sender = msg.replyTo.sender || (msg.replyTo.isMe ? '用户' : (typeof getWechatMessageSenderName === 'function' ? getWechatMessageSenderName(msg, char) : ((char && char.name) || '角色')));
            const quote = truncateChatAnchorText(String(msg.replyTo.text || '').replace(/<[^>]+>/g, '').trim(), 180);
            if (quote) content = prependChatApiQuoteToContent(content, `【引用${sender}】${quote}`);
        }

        messages.push({
            role: msg.isMe ? 'user' : 'assistant',
            content: content
        });
    });

    return messages;
}

// 3. 调用 AI API
async function callChatApi(messages) {
    const api = typeof getDefaultApi === 'function' ? getDefaultApi() : null;

    if (!api) {
        return { ok: false, error: '还没有设置 API 哦～\n去桌面「设置」里添加一个吧' };
    }

    if (!api.model) {
        return { ok: false, error: '还没选模型哦～\n去设置里测试 API 然后选一个模型' };
    }

    const baseUrl = api.baseUrl.replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (api.apiKey) headers['Authorization'] = `Bearer ${api.apiKey}`;

    const preset = (typeof getActivePreset === 'function') ? getActivePreset() : null;
    const params = {
        model: api.model,
        messages: messages,
        temperature: preset ? preset.temperature : 0.8,
        max_tokens: preset ? preset.max_tokens : 1000
    };
    if (preset) {
        if (preset.top_p != null && preset.top_p !== 1) params.top_p = preset.top_p;
        if (preset.frequency_penalty) params.frequency_penalty = preset.frequency_penalty;
        if (preset.presence_penalty) params.presence_penalty = preset.presence_penalty;
    }

    try {
        const timeoutMs = 90000;
        const resp = await fetch(baseUrl + '/chat/completions', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(params),
            signal: AbortSignal.timeout(timeoutMs)
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            let detail = errText;
            try {
                const errJson = JSON.parse(errText);
                detail = errJson.error?.message || errJson.message || errText;
            } catch (_) {}
            const detailText = String(detail || '');
            const visionHint = /image|vision|multi[- ]?modal|content\s*array|image_url/i.test(detailText)
                ? '。当前聊天模型可能不支持图片识别，请在设置里换成支持视觉输入的聊天模型，或给这个站点选择支持图片的模型。'
                : '';
            return { ok: false, error: `API 错误 (${resp.status}): ${detailText.slice(0, 160)}${visionHint}` };
        }

        const json = await resp.json();
        const content = cleanChatApiVisibleContent(json.choices?.[0]?.message?.content || '');

        if (!content) {
            return { ok: false, error: 'AI 返回了空内容' };
        }

        return { ok: true, content: content };

    } catch (e) {
        const isTimeout = e.name === 'AbortError' || e.name === 'TimeoutError' || /timed out|timeout/i.test(e.message || '');
        const msg = isTimeout ? '请求超时（90秒），已继续压缩本次微信上下文；如果仍超时，请换更快模型或减少角色卡/世界书。' : (e.message || '网络错误');
        return { ok: false, error: msg };
    }
}

// 4. 完整的发送+接收流程（供微信等模块调用）
async function chatWithCharacter(char, historyKey, userText) {
    const history = char[historyKey] || [];

    // 构建消息
    const messages = buildMessages(char, history);
    const lastHistory = history[history.length - 1];
    const lastContent = String(lastHistory?.content || '').trim();
    if (!(lastHistory?.isMe && lastContent === String(userText || '').trim())) {
        messages.push({ role: 'user', content: userText });
    }

    // 调用 API
    const result = await callChatApi(messages);

    return result;
}
