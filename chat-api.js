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

function getChatApiRegexScriptField(script, keys) {
    if (!script || typeof script !== 'object') return '';
    for (const key of keys) {
        if (script[key] != null && script[key] !== '') return String(script[key]);
    }
    return '';
}

function isChatApiRegexScriptEnabled(script) {
    if (!script || typeof script !== 'object') return false;
    if (script.enabled === false || script.disabled === true || script.isDisabled === true) return false;
    if (String(script.enabled).toLowerCase() === 'false') return false;
    if (String(script.disabled).toLowerCase() === 'true') return false;
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

    const lines = scripts.slice(0, 12).map((item, index) => {
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

// 1. 构建角色 System Prompt
function buildSystemPrompt(char) {
    let prompt = '';
    const timeContext = getChatApiCurrentTimeContext(char);
    const charDescription = getChatApiCharacterDescription(char);

    // 如果有活跃预设，用预设的 prompt 模板
    const preset = (typeof getActivePreset === 'function') ? getActivePreset() : null;
    if (preset && preset.prompts.length > 0) {
        const enabledPrompts = preset.prompts.filter(p => p.enabled);
        enabledPrompts.forEach(p => {
            let content = p.content;
            content = content.replace(/\{\{char\}\}/gi, char.name);
            const config = char.chatConfig || {};
            const userProfile = (typeof getUserProfile === 'function') ? getUserProfile() : { name: '我' };
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
        prompt += `你是「${char.name}」。\n`;
        if (charDescription) {
            prompt += `\n【角色设定】\n${charDescription}\n`;
        }
    }

    // 世界书条目（如果有）
    if (char.worldBook && char.worldBook.length > 0) {
        let totalWorldBookLength = 0;
        const entries = char.worldBook
            .map(e => {
                const key = e.key || e.keys || e.keyword || '';
                const content = prepareChatApiPromptText(e.content || e.entry || e.value || '', 1000);
                if (!content) return null;
                return key ? `[${key}] ${content}` : content;
            })
            .filter(Boolean);
        const compactEntries = [];
        for (const entry of entries) {
            if (compactEntries.length >= 8 || totalWorldBookLength + entry.length > 6000) break;
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
    const userProfile = (typeof getUserProfile === 'function') ? getUserProfile() : { name: '我' };
    const userName = userProfile.name || '我';
    const userTitle = config.userTitle || userName;

    prompt += `\n【行为规则】\n`;
    prompt += `- 始终以「${char.name}」的身份回复，保持角色一致性\n`;
    prompt += `- 用户的名字是"${userName}"\n`;
    prompt += `- 当前采用${timeContext.label}，现在是 ${timeContext.text}。今天就是 ${timeContext.date || timeContext.text}，当前时刻是 ${timeContext.time || timeContext.text}。用户提到今天、现在、刚才、今晚、明天等相对时间时，必须以这个时间为准，不要说你无法得知实时信息\n`;
    if (userTitle !== userName && userTitle !== '我') {
        prompt += `- 你称呼用户为"${userTitle}"\n`;
    }
    if (config.nickname) {
        prompt += `- 用户给你设置的备注名是"${config.nickname}"，你知道这个备注。如果你不喜欢这个备注，可以在回复中表达不满并建议用户改掉\n`;
    }
    if (userProfile.bio) {
        prompt += `- 关于用户：${userProfile.bio}\n`;
    }
    const avatarCount = (char.avatarGallery || []).length;
    if (avatarCount > 1) {
        prompt += `- 你有${avatarCount}个头像可以切换。如果你想换头像，在消息末尾加上 [换头像:序号]（序号从1开始）。只在情绪变化或特殊场景时切换\n`;
    }
    prompt += `- 用中文回复\n`;
    prompt += `- 不要在回复中提及你是 AI 或语言模型\n`;
    prompt += `- 像真实微信聊天一样回复，每条消息只说一两句话，用"|||"分隔不同的消息。例如："你好呀|||今天怎么样？|||我刚吃完饭~"\n`;
    prompt += `- 用户可以在前台主动给你发送转账、红包、语音或通话记录；如果你作为角色需要主动给用户发微信特殊消息，把它作为单独一段输出，系统会自动渲染，不会显示指令文本：\n`;
    prompt += `  [微信转账:金额|备注] 例如 [微信转账:88.00|给你买奶茶]\n`;
    prompt += `  [微信红包:标题|金额|状态] 例如 [微信红包:恭喜发财，大吉大利|8.88|已领取]\n`;
    prompt += `  [微信语音:转文字内容] 例如 [微信语音:我刚刚在想你]，系统会按文字长度自动估算语音秒数\n`;
    prompt += `  [微信语音电话:来电理由或接通开场] 或 [微信视频电话:来电理由或接通开场]，例如 [微信视频电话:我想现在看看你]。如果用户不在微信聊天页，系统会显示来电灵动岛让用户接听或拒绝\n`;
    prompt += `- 只有在剧情确实需要时才使用这些特殊消息指令，不要解释指令本身\n`;

    return prompt;
}

// 2. 构建消息列表
function buildMessages(char, history, maxMessages) {
    maxMessages = maxMessages || 8; // 微信对话默认只带最近 8 条，避免大角色卡请求超时

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

    // 历史消息（取最近的 N 条）
    const recentHistory = history.slice(-maxMessages);
    recentHistory.forEach(msg => {
        // 获取消息内容（处理不同消息类型）
        let content = msg.content || '';
        if (msg.type === 'image') {
            content = msg.description || '[图片]';
        } else if (msg.type === 'sticker') {
            content = '[发送了表情: ' + (msg.name || '贴纸') + ']';
        } else if (['voice', 'transfer', 'redpacket', 'voiceCall', 'videoCall'].includes(msg.type)) {
            content = msg.description || msg.content || '[微信消息]';
        } else if (msg.type === 'offline_text') {
            content = msg.dialogue || msg.description || '';
        }
        content = cleanChatApiVisibleContent(content);
        // 去掉 HTML 标签（给 API 的内容不需要 HTML）
        content = content.replace(/<[^>]+>/g, '').trim();
        content = truncateChatAnchorText(content, 650);
        if (!content) return;

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
            return { ok: false, error: `API 错误 (${resp.status}): ${String(detail).slice(0, 160)}` };
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
