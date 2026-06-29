// --- 🤖 chat-api.js: 通用 AI 对话引擎 ---

const CHAT_API_MIN_COMPLETION_TOKENS = 1800;
const CHAT_API_STATUS_MIN_COMPLETION_TOKENS = 2200;
const CHAT_API_LENGTH_CONTINUATION_MIN_TOKENS = 1800;
const CHAT_API_RATE_LIMIT_PAUSE_MS = 5 * 60 * 1000;

function isChatApiRateLimitErrorText(error) {
    const text = String(error || '');
    return /(^|[^0-9])429([^0-9]|$)|rate.?limit|too many requests|quota|请求.*频繁|限流/i.test(text);
}

function getChatApiRateLimitRetryMs(resp, detail = '') {
    let retryAfter = '';
    try {
        retryAfter = resp && resp.headers && resp.headers.get && resp.headers.get('retry-after') || '';
    } catch (_) {}
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(30 * 60 * 1000, Math.max(30 * 1000, seconds * 1000));
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs) && dateMs > Date.now()) return Math.min(30 * 60 * 1000, Math.max(30 * 1000, dateMs - Date.now()));
    const detailText = String(detail || '');
    const match = detailText.match(/(?:retry|again|after|wait|重试|稍后|等待)[^\d]{0,16}(\d+(?:\.\d+)?)\s*(ms|毫秒|s|sec|second|seconds|秒|m|min|minute|minutes|分钟)?/i);
    if (match) {
        const value = Number.parseFloat(match[1]);
        const unit = String(match[2] || 's').toLowerCase();
        if (Number.isFinite(value) && value > 0) {
            const ms = /m|min|minute|分钟/.test(unit) ? value * 60 * 1000 : (/ms|毫秒/.test(unit) ? value : value * 1000);
            return Math.min(30 * 60 * 1000, Math.max(30 * 1000, ms));
        }
    }
    return CHAT_API_RATE_LIMIT_PAUSE_MS;
}

function setChatApiRateLimitPause(error, ms = CHAT_API_RATE_LIMIT_PAUSE_MS) {
    const pauseMs = Math.max(30 * 1000, Number(ms) || CHAT_API_RATE_LIMIT_PAUSE_MS);
    const until = Date.now() + pauseMs;
    if (typeof window !== 'undefined') {
        window._chatApiRateLimitPausedUntil = Math.max(Number(window._chatApiRateLimitPausedUntil) || 0, until);
    }
    console.warn('chat api paused by rate limit:', error);
    return until;
}

function getChatApiRateLimitPauseRemainingMs() {
    if (typeof window === 'undefined') return 0;
    return Math.max(0, (Number(window._chatApiRateLimitPausedUntil) || 0) - Date.now());
}

function formatChatApiRateLimitPause(ms) {
    const seconds = Math.ceil(Math.max(0, Number(ms) || 0) / 1000);
    if (seconds >= 60) return `${Math.ceil(seconds / 60)} 分钟`;
    return `${Math.max(1, seconds)} 秒`;
}

function padChatDatePart(value) {
    return String(value).padStart(2, '0');
}

function formatChatApiDateTime(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${safeDate.getFullYear()}年${safeDate.getMonth() + 1}月${safeDate.getDate()}日 ${weekdays[safeDate.getDay()]} ${padChatDatePart(safeDate.getHours())}:${padChatDatePart(safeDate.getMinutes())}`;
}

function getChatApiTimestampValue(value) {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getChatApiLatestVisibleMessageTime(char) {
    const history = Array.isArray(char?.history) ? char.history : [];
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg || msg.hiddenFromChat || msg.internalEvent || msg.type === 'system_notice') continue;
        const time = getChatApiTimestampValue(msg.timestamp || msg.createdAt || msg.time);
        if (time > 0) return time;
    }
    return 0;
}

function formatChatApiElapsed(ms) {
    const minutes = Math.floor(Math.max(0, ms) / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天`;
    const months = Math.floor(days / 30);
    return `${months}个月`;
}

function getChatApiLunarDateParts(date) {
    try {
        if (typeof Intl === 'undefined' || !Intl.DateTimeFormat) return null;
        const formatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
            month: 'long',
            day: 'numeric'
        });
        const parts = formatter.formatToParts(date);
        const monthText = (parts.find(part => part.type === 'month') || {}).value || '';
        const dayText = (parts.find(part => part.type === 'day') || {}).value || '';
        const monthMap = {
            '正月': 1,
            '一月': 1,
            '二月': 2,
            '三月': 3,
            '四月': 4,
            '五月': 5,
            '六月': 6,
            '七月': 7,
            '八月': 8,
            '九月': 9,
            '十月': 10,
            '冬月': 11,
            '十一月': 11,
            '腊月': 12,
            '十二月': 12
        };
        const cleanMonth = monthText.replace(/^闰/, '');
        const day = parseInt(dayText, 10);
        const month = monthMap[cleanMonth] || 0;
        if (!month || !day) return null;
        return { month, day, isLeap: monthText.startsWith('闰') };
    } catch (_) {
        return null;
    }
}

function getChatApiFestivalName(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const fixed = {
        '1-1': '元旦',
        '2-14': '情人节',
        '3-8': '妇女节',
        '4-1': '愚人节',
        '5-1': '劳动节',
        '5-20': '520',
        '6-1': '六一儿童节',
        '10-1': '国庆节',
        '12-24': '平安夜',
        '12-25': '圣诞节'
    };
    const fixedName = fixed[`${month}-${day}`] || '';
    const lunar = getChatApiLunarDateParts(date);
    if (!lunar || lunar.isLeap) return fixedName;
    const lunarFestival = {
        '1-1': '春节',
        '1-15': '元宵节',
        '5-5': '端午节',
        '7-7': '七夕',
        '7-15': '中元节',
        '8-15': '中秋节',
        '9-9': '重阳节',
        '12-8': '腊八节',
        '12-23': '小年'
    }[`${lunar.month}-${lunar.day}`] || '';
    return [fixedName, lunarFestival].filter(Boolean).join(' / ');
}

function buildChatApiTemporalAwarenessAnchor(char, timeContext) {
    const date = timeContext?.iso ? new Date(timeContext.iso) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const nowMs = safeDate.getTime();
    const lastMs = getChatApiLatestVisibleMessageTime(char);
    const rows = [];
    if (lastMs > 0) {
        const gapMs = Math.max(0, nowMs - lastMs);
        const lastText = formatChatApiDateTime(lastMs);
        rows.push(`上一次可见聊天时间：${lastText}，距离现在约${formatChatApiElapsed(gapMs)}。如果间隔达到数小时/数天/更久，角色应自然意识到用户很久没来，而不是像刚刚连续聊天。`);
    } else {
        rows.push('这段聊天没有可见历史时间；按第一次/久未联系的状态自然回应。');
    }
    const festival = getChatApiFestivalName(safeDate);
    if (festival) rows.push(`今天的重要日期：${festival}。角色可以按人设自然意识到这个日期，但不要每句话都硬提。`);
    return `【时间感知上下文】${rows.join('\n')}`;
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
        const leading = new RegExp(`^\\s*<${tag}\\b[^>]*>`, 'i');
        if (!leading.test(text)) return;
        const visibleBoundary = text.search(/<content\b|```|[\[【](?:微信|消息|旁白|群聊发言|QQ群头衔|群头衔|微信改群头衔|QQ群昵称|微信群昵称|群昵称|QQ群名|微信群名|群聊名称|群名称|群名|微信改群名|QQ改群名|群邀请|群拉人|微信群邀请|QQ群邀请|群NPC|音乐卡片|链接卡片)[：:\]|】]|<\s*(?:jwy|bqb|status|state|html|div|section|article|style|script|table|svg|canvas)\b|(?:思考完毕|生成回复)[，,。；;：:]?/i);
        if (visibleBoundary > 0) {
            text = text.slice(visibleBoundary);
        } else {
            text = '';
        }
    });

    text = text
        .replace(/<content\b[^>]*>([\s\S]*?)<\/content>/gi, '$1')
        .replace(/<\/?content\b[^>]*>/gi, '')
        .replace(/^\s*(?:思考完毕[，,。；;：:]?\s*)+/i, '')
        .replace(/^\s*(?:生成回复[，,。；;：:]?\s*)+/i, '')
        .trim();

    return text;
}

function getChatApiTextFromContentPart(part) {
    if (part == null) return '';
    if (typeof part === 'string') return part;
    if (typeof part !== 'object') return '';
    if (typeof part.text === 'string') return part.text;
    if (typeof part.content === 'string') return part.content;
    if (typeof part.output_text === 'string') return part.output_text;
    if (part.type === 'text' && part.text && typeof part.text.value === 'string') return part.text.value;
    return '';
}

function getChatApiRawResponseContent(json) {
    const choice = json?.choices?.[0] || {};
    const message = choice.message || {};
    const content = message.content;

    if (Array.isArray(content)) {
        const joined = content.map(getChatApiTextFromContentPart).filter(Boolean).join('\n');
        if (joined) return joined;
    } else if (typeof content === 'string') {
        return content;
    } else if (content != null) {
        const fromPart = getChatApiTextFromContentPart(content);
        if (fromPart) return fromPart;
    }

    const directCandidates = [
        message.text,
        message.output_text,
        choice.text,
        json.output_text,
        json.text
    ];
    for (const item of directCandidates) {
        if (typeof item === 'string' && item.trim()) return item;
    }

    if (Array.isArray(json.output)) {
        const joined = json.output.flatMap(item => {
            if (typeof item === 'string') return [item];
            if (!item || typeof item !== 'object') return [];
            if (Array.isArray(item.content)) return item.content.map(getChatApiTextFromContentPart);
            return [getChatApiTextFromContentPart(item), item.text, item.output_text].filter(v => typeof v === 'string');
        }).filter(Boolean).join('\n');
        if (joined) return joined;
    }

    return '';
}

function getChatApiFinishReason(json) {
    const choice = json?.choices?.[0] || {};
    const message = choice.message || {};
    const output = Array.isArray(json?.output) ? json.output : [];
    const lastOutput = output.length ? output[output.length - 1] : null;
    const candidates = [
        choice.finish_reason,
        choice.finishReason,
        choice.native_finish_reason,
        choice.stop_reason,
        choice.finish_details?.type,
        choice.finishDetails?.type,
        choice.incomplete_details?.reason,
        choice.incompleteDetails?.reason,
        message.finish_reason,
        message.finishReason,
        message.stop_reason,
        json?.finish_reason,
        json?.finishReason,
        json?.stop_reason,
        json?.incomplete_details?.reason,
        json?.incompleteDetails?.reason,
        lastOutput?.finish_reason,
        lastOutput?.finishReason,
        lastOutput?.incomplete_details?.reason,
        lastOutput?.incompleteDetails?.reason
    ];
    for (const value of candidates) {
        const text = String(value == null ? '' : value).trim();
        if (text) return text.toLowerCase();
    }
    return '';
}

function parseChatApiResponseText(rawText) {
    const text = String(rawText || '').replace(/^\uFEFF/, '').trim();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (_) {
        const sseJson = parseChatApiSseResponseText(text);
        if (sseJson) return sseJson;
        throw new Error('API 返回格式无法解析');
    }
}

function parseChatApiSseResponseText(text) {
    if (!/^\s*data\s*:/m.test(text)) return null;
    const events = [];
    let current = [];
    String(text || '').split(/\r?\n/).forEach(line => {
        if (/^\s*$/.test(line)) {
            if (current.length) {
                events.push(current.join('\n'));
                current = [];
            }
            return;
        }
        const match = line.match(/^\s*data\s*:\s?(.*)$/);
        if (match) current.push(match[1]);
    });
    if (current.length) events.push(current.join('\n'));

    const chunks = [];
    for (const eventText of events) {
        const payload = String(eventText || '').trim();
        if (!payload || payload === '[DONE]') continue;
        try {
            chunks.push(JSON.parse(payload));
        } catch (_) {}
    }
    if (!chunks.length) return null;

    const firstContent = getChatApiRawResponseContent(chunks[0]);
    if (chunks.length === 1 && firstContent) return chunks[0];

    const contentParts = [];
    let finishReason = '';
    for (const chunk of chunks) {
        const choice = chunk?.choices?.[0] || {};
        const delta = choice.delta || {};
        const message = choice.message || {};
        const candidates = [
            delta.content,
            delta.text,
            message.content,
            choice.text,
            chunk.output_text,
            chunk.text
        ];
        candidates.forEach(item => {
            if (Array.isArray(item)) {
                const joined = item.map(getChatApiTextFromContentPart).filter(Boolean).join('\n');
                if (joined) contentParts.push(joined);
            } else if (typeof item === 'string' && item) {
                contentParts.push(item);
            } else {
                const partText = getChatApiTextFromContentPart(item);
                if (partText) contentParts.push(partText);
            }
        });
        finishReason = finishReason || choice.finish_reason || choice.finishReason || choice.stop_reason || '';
    }

    if (!contentParts.length) return chunks[chunks.length - 1] || chunks[0];
    return {
        ...chunks[chunks.length - 1],
        choices: [{
            ...(chunks[chunks.length - 1]?.choices?.[0] || {}),
            message: { content: contentParts.join('') },
            finish_reason: finishReason || chunks[chunks.length - 1]?.choices?.[0]?.finish_reason || null
        }]
    };
}

function isChatApiLengthFinishReason(reason) {
    const text = String(reason || '').trim().toLowerCase();
    if (!text) return false;
    return text === 'length'
        || text === 'max_tokens'
        || text === 'max_output_tokens'
        || text === 'token_limit'
        || /max[_ -]?(?:output[_ -]?)?tokens?|token[_ -]?limit|output[_ -]?limit|truncat|length/.test(text);
}

function getChatApiOverlapLength(left, right, maxLength = 180) {
    const a = String(left || '').slice(-maxLength);
    const b = String(right || '').slice(0, maxLength);
    const max = Math.min(a.length, b.length);
    for (let length = max; length >= 12; length -= 1) {
        if (a.slice(-length) === b.slice(0, length)) return length;
    }
    return 0;
}

function mergeChatApiContinuationContent(first, second) {
    const left = cleanChatApiVisibleContent(first).trim();
    const right = cleanChatApiVisibleContent(second).trim();
    if (!left) return right;
    if (!right) return left;
    if (right.startsWith(left)) return right;
    if (left.endsWith(right)) return left;
    const overlap = getChatApiOverlapLength(left, right);
    if (overlap > 0) return left + right.slice(overlap);
    if (/[.!?;:)\]}>\u3002\uff01\uff1f\uff1b\uff1a\uff09\uff3d\u300d\u300f\u201d]$/.test(left)) {
        return `${left}\n${right}`;
    }
    return left + right;
}

function buildChatApiLengthContinuationMessages(messages, content) {
    return (Array.isArray(messages) ? messages : []).concat(
        {
            role: 'assistant',
            content: cleanChatApiVisibleContent(content)
        },
        {
            role: 'user',
            content: [
                'Your previous assistant reply was cut off by the provider output limit.',
                'Continue from the exact interruption point.',
                'Output only the remaining user-visible WeChat reply text.',
                'Do not repeat existing text and do not explain.'
            ].join(' ')
        }
    );
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

function prependChatApiContextToContent(content, contextText) {
    if (!contextText) return content;
    const prefix = `${contextText}\n\n【用户刚刚发送的真实消息】`;
    if (Array.isArray(content)) {
        const copy = content.map(item => ({ ...item }));
        const firstText = copy.find(item => item && item.type === 'text');
        if (firstText) firstText.text = `${prefix}\n${firstText.text || ''}`.trim();
        else copy.unshift({ type: 'text', text: prefix });
        return copy;
    }
    return `${prefix}\n${content}`;
}

function buildCurrentTimeAnchor(char) {
    const timeContext = getChatApiCurrentTimeContext(char);
    return `【当前时间锚点】当前采用${timeContext.label}。现在是 ${timeContext.text}。今天就是 ${timeContext.date}，当前时刻是 ${timeContext.time}。如果用户问现在几点、今天日期、刚才/今晚/明天等相对时间，必须按这个时间回答，不要说你无法得知实时信息。`;
}

function buildCurrentTimeAnchor(char) {
    const timeContext = getChatApiCurrentTimeContext(char);
    return `【当前时间锚点】当前采用${timeContext.label}。现在是 ${timeContext.text}。今天就是 ${timeContext.date}，当前时刻是 ${timeContext.time}。如果用户问现在几点、今天日期、刚才/今晚/明天等相对时间，必须按这个时间回答，不要说你无法得知实时信息。\n${buildChatApiTemporalAwarenessAnchor(char, timeContext)}`;
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

function isChatApiStatusBlockSpec(value) {
    const text = String(value || '');
    if (!text.trim()) return false;
    const hasKnownStatusTag = /<\s*(?:jwy|status|state)\b|<\/\s*(?:jwy|status|state)\s*>/i.test(text);
    const hasStatusMarker = /状态栏格式|状态栏|status\s*bar|weibo-status-bar/i.test(text);
    return (hasKnownStatusTag || hasStatusMarker)
        && (/\|/.test(text) || /\$\d{1,2}/.test(text) || hasKnownStatusTag);
}

const CHAT_API_IGNORED_STATUS_TAGS = new Set(['html', 'head', 'body', 'style', 'script', 'div', 'span', 'img', 'svg', 'path', 'button', 'section', 'article', 'p', 'ul', 'li']);

function isChatApiIgnoredStatusTag(tag) {
    return CHAT_API_IGNORED_STATUS_TAGS.has(String(tag || '').toLowerCase());
}

function getChatApiStatusBlockTags(value) {
    const text = String(value || '');
    const tags = [];
    text.replace(/<\s*([A-Za-z][\w:-]*)\b/g, (match, tag) => {
        const name = String(tag || '').toLowerCase();
        if (!isChatApiIgnoredStatusTag(name) && !tags.includes(name)) tags.push(name);
        return match;
    });
    return tags;
}

function getChatApiStatusSlotHints(messages) {
    const hints = new Map();
    const addHint = (tag, body) => {
        const name = String(tag || '').toLowerCase();
        if (!name || isChatApiIgnoredStatusTag(name) || !String(body || '').includes('|')) return;
        const slots = String(body || '').split('|').length;
        if (slots < 4) return;
        hints.set(name, Math.max(hints.get(name) || 0, slots));
    };
    (Array.isArray(messages) ? messages : []).forEach(msg => {
        const text = String(msg && msg.content || '');
        if (!isChatApiStatusBlockSpec(text)) return;
        text.replace(/<\s*([A-Za-z][\w:-]*)\b[^>]*>([\s\S]*?)<\/\s*\1\s*>/g, (match, tag, body) => {
            addHint(tag, body);
            return match;
        });
        text.replace(/<\s*([A-Za-z][\w:-]*)\b[^>]*>([^<\n]{0,2200}\|[^<]{0,2200})/g, (match, tag, body) => {
            addHint(tag, body);
            return match;
        });
    });
    return hints;
}

function getChatApiIncompleteStatusBlockReport(content, messages) {
    const text = String(content || '');
    if (!isChatApiStatusBlockSpec(text)) return '';
    const hints = getChatApiStatusSlotHints(messages);
    const problems = [];
    text.replace(/<\s*([A-Za-z][\w:-]*)\b[^>]*>([\s\S]*?)<\/\s*\1\s*>/g, (match, tag, body) => {
        const name = String(tag || '').toLowerCase();
        if (!name || isChatApiIgnoredStatusTag(name) || !String(body || '').includes('|')) return match;
        const cells = String(body || '').split('|').map(cell => String(cell || '').trim());
        const expected = hints.get(name) || (cells.length >= 16 ? cells.length : 0);
        const knownStatusTag = /^(?:jwy|status|state)$/i.test(name);
        if (!expected || (!knownStatusTag && expected < 10)) return match;
        const missing = [];
        for (let index = 0; index < expected; index += 1) {
            if (!cells[index]) missing.push(index + 1);
        }
        if (cells.length < expected) {
            for (let index = cells.length; index < expected; index += 1) {
                if (!missing.includes(index + 1)) missing.push(index + 1);
            }
        }
        if (missing.length) problems.push(`<${name}> 字段 ${missing.slice(0, 12).join(', ')} 为空或缺失`);
        return match;
    });
    return problems.join('；');
}

function buildChatApiStatusRepairPrompt(report) {
    return [
        '【状态栏字段校验未通过】',
        report,
        '请重新生成本轮回复。状态栏块必须按前文角色卡、世界书、正则格式和最近聊天完整填写，不能留空字段，不能写占位符，不能解释规则。',
        '普通聊天正文和状态栏块仍需分开输出。'
    ].filter(Boolean).join('\n');
}

function buildChatApiStatusBlockAnchor(char) {
    const sources = [];
    const statusTags = new Set();
    const addSource = (label, value, maxLength = 3200) => {
        if (!isChatApiStatusBlockSpec(value)) return;
        getChatApiStatusBlockTags(value).forEach(tag => statusTags.add(tag));
        const text = prepareChatApiPromptText(value, maxLength);
        if (text) sources.push(`【${label}】\n${text}`);
    };

    [char && char.description, char && char.system_prompt, char && char.post_history_instructions, char && char.creator_notes]
        .forEach((value, index) => addSource(`角色卡状态栏线索${index + 1}`, value, 2600));

    (Array.isArray(char && char.worldBook) ? char.worldBook : []).forEach((entry, index) => {
        if (!entry || entry.enabled === false) return;
        const title = entry.name || entry.title || entry.key || entry.keys || entry.keyword || `世界书${index + 1}`;
        const content = entry.content || entry.text || entry.entry || entry.value || entry.comment || entry.description || '';
        addSource(`世界书：${title}`, content, 3600);
    });

    try {
        const preset = (typeof getActivePreset === 'function') ? getActivePreset() : null;
        (preset && Array.isArray(preset.prompts) ? preset.prompts : []).forEach((item, index) => {
            if (!item || item.enabled === false) return;
            addSource(`启用预设：${item.name || item.title || index + 1}`, item.content || '', 2600);
        });
    } catch (_) {}

    const globalScripts = Array.isArray(window.globalRegexScripts) ? window.globalRegexScripts : [];
    const charScripts = Array.isArray(char && char.regex) ? char.regex : [];
    [...globalScripts.map(script => ({ script, scope: '全局正则' })), ...charScripts.map(script => ({ script, scope: '角色正则' }))].forEach((item, index) => {
        if (!isChatApiRegexScriptEnabled(item.script)) return;
        const pattern = getChatApiRegexScriptField(item.script, ['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']);
        const replace = getChatApiRegexScriptField(item.script, ['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']);
        const combined = `find: ${pattern}\nreplace:\n${replace}`;
        addSource(`${item.scope}：${item.script.name || item.script.scriptName || index + 1}`, combined, 4200);
    });

    if (!sources.length) return '';
    const tagHint = statusTags.size
        ? [...statusTags].map(tag => `<${tag}>...</${tag}>`).join(' / ')
        : '状态栏标签块';
    return [
        '【状态栏/酒馆正则块强约束】',
        `如果下方规范要求输出 ${tagHint} 或类似状态栏块，本轮回复必须保留它作为独立片段。不要把它当普通微信正文，也不要省略。`,
        '输出状态栏块时必须严格按照规范里的字段顺序和分隔符数量填写；所有字段都必须来自当前角色、人设、世界书、记忆或最近聊天，禁止少字段、合并字段、截断字段。',
        '状态栏的互动提及字段绝对不能留空：朋友昵称、朋友@角色的具体内容、角色对此的回复都必须完整，并且必须贴合世界书和当前剧情。',
        '如果规范是 18 个 | 分隔字段，最终也必须是一整段完整状态栏块，包含同样数量的 | 分隔字段。',
        '普通聊天正文和状态栏块要分成不同消息段，可用 ||| 分隔；不要把状态栏块放进 thinking/cot/旁白，也不要解释这些规则。',
        sources.slice(0, 8).join('\n\n')
    ].join('\n');
}

function getChatApiCharacterDescription(char) {
    if (typeof getWechatCharacterPersonaText === 'function') {
        try {
            const persona = getWechatCharacterPersonaText(char, 10000);
            if (persona) return prepareChatApiPromptText(persona, 10000);
        } catch (_) {}
    }
    const extraFields = [
        char && char.description,
        char && char.personality,
        char && char.scenario,
        char && char.mes_example,
        char && char.system_prompt,
        char && char.post_history_instructions,
        char && char.creator_notes,
        char && char.character_note
    ].filter(Boolean).join('\n\n');
    return prepareChatApiPromptText(extraFields, 10000);
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

function buildChatApiCoreIdentityAnchor(char) {
    const charName = (char && char.name) || '角色';
    const userProfile = getChatApiUserProfile(char);
    const userName = userProfile.name || '用户';
    const config = (char && char.chatConfig) || {};
    const parts = [
        `【最高优先级角色锚点】`,
        `你本轮必须扮演「${charName}」，不能按通用助手、通用恋爱模板或其他角色回复。`,
        `用户是「${userName}」。${config.userTitle && config.userTitle !== userName ? `你对用户的称呼是「${config.userTitle}」。` : ''}${config.nickname ? `用户给你的备注名是「${config.nickname}」。` : ''}`
    ];

    const description = getChatApiCharacterDescription(char);
    if (description) {
        parts.push(`【必须遵守的人设原文】\n${prepareChatApiPromptText(description, 6500)}`);
    }

    const greetingHints = [
        char && char.first_mes_original,
        char && char.first_mes,
        ...(Array.isArray(char && char.alternates) ? char.alternates.slice(0, 3) : [])
    ].map(item => prepareChatApiPromptText(item, 900)).filter(Boolean);
    if (greetingHints.length) {
        parts.push(`【角色开场/语气样例】\n${greetingHints.map((item, index) => `${index + 1}. ${item}`).join('\n')}`);
    }

    const worldBookEntries = Array.isArray(char && char.worldBook) ? char.worldBook : [];
    const worldBook = worldBookEntries
        .filter(entry => entry && entry.enabled !== false)
        .map(entry => {
            const title = entry.name || entry.title || entry.key || entry.keys || '世界书';
            const rawContent = entry.content || entry.text || entry.entry || entry.value || entry.comment || '';
            const content = prepareChatApiPromptText(rawContent, isChatApiStatusBlockSpec(rawContent) ? 2600 : 520);
            return content ? `- ${title}：${content}` : '';
        })
        .filter(Boolean)
        .slice(0, 24)
        .join('\n');
    if (worldBook) {
        parts.push(`【必须遵守的世界书】\n${worldBook}`);
    }

    const memory = buildMemoryAnchor(char);
    if (memory) {
        parts.push(memory);
    }

    parts.push(`【回复前自检】每次回复前先检查：这句话是否符合「${charName}」的人设、世界书、记忆、当前关系和最近聊天。若不符合，重写后再输出。禁止抢用户台词或替用户行动。`);
    return parts.join('\n\n');
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
    if (member && member.__wechatGroupDisplayName) return member.__wechatGroupDisplayName;
    if (typeof getWechatQQGroupMemberDisplayName === 'function' && typeof getCurrentChatChar === 'function') {
        try {
            const group = getCurrentChatChar();
            if (group && group.isGroupChat) return getWechatQQGroupMemberDisplayName(group, member);
        } catch (_) {}
    }
    if (typeof getWechatGroupMemberName === 'function') {
        try {
            return getWechatGroupMemberName(member);
        } catch (_) {}
    }
    return (member && member.chatConfig && member.chatConfig.nickname) || (member && member.name) || '成员';
}

function getChatApiGroupMemberRoleLine(group, member) {
    if (!group?.isGroupChat || !member) return '';
    let roleLabel = '';
    if (typeof getWechatQQGroupMemberRole === 'function') {
        try {
            const role = getWechatQQGroupMemberRole(group, member.id);
            roleLabel = role === 'owner' ? '群主' : (role === 'admin' ? '管理员' : '普通成员');
        } catch (_) {}
    }
    if (typeof getWechatQQGroupMemberBadge === 'function') {
        try {
            const badge = getWechatQQGroupMemberBadge(group, member.id);
            if (badge && badge.text) {
                const titleLine = roleLabel && badge.text !== roleLabel ? `，当前群头衔：${badge.text}` : '';
                return `，群身份：${roleLabel || badge.text}${titleLine}`;
            }
        } catch (_) {}
    }
    return roleLabel ? `，群身份：${roleLabel}` : '';
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
    const userProfile = getChatApiUserProfile(group);
    const userName = userProfile.name || '我';
    const lines = members.map((member, index) => {
        const displayName = typeof getWechatQQGroupMemberDisplayName === 'function'
            ? getWechatQQGroupMemberDisplayName(group, member)
            : getChatApiGroupMemberName(member);
        member.__wechatGroupDisplayName = displayName;
        const realName = member.name && member.name !== displayName ? `，原名：${member.name}` : '';
        const roleLine = getChatApiGroupMemberRoleLine(group, member);
        const description = truncateChatAnchorText(getChatApiCharacterDescription(member), 420);
        const worldBook = Array.isArray(member.worldBook)
            ? member.worldBook.map(entry => prepareChatApiPromptText(entry.content || entry.entry || entry.value || '', 160)).filter(Boolean).slice(0, 3).join('；')
            : '';
        const details = [description, worldBook ? `世界书：${worldBook}` : ''].filter(Boolean).join('；');
        return `${index + 1}. ${displayName}${realName}${roleLine}${details ? `：${details}` : ''}`;
    });
    return `\n【微信群聊成员】\n当前对话是群聊「${group.name || '群聊'}」，不是单人私聊。用户「${userName}」就是这个群的群主/创建者；群主不是你要扮演的 AI 成员，不要询问“群主是谁”、不要质疑用户的群主身份。你需要同时扮演群内 AI 成员，所有成员都必须按各自人设、世界书和关系状态发言：\n${lines.join('\n')}\n\n【群聊输出规则】\n- 你不是群聊本身，不能以群名作为说话人。\n- 每条成员发言必须单独输出为：[群聊发言:成员名|消息内容]\n- 成员名必须使用上方列表中的名字或备注，系统会用这个成员自己的头像和名字渲染，不要把“成员名：”写进气泡正文。\n- 上方列出的“当前群头衔/身份”就是成员自己能看见的群头衔；如果某个成员按自己人设不喜欢用户设置的群头衔，可以把 [QQ群头衔:成员名|新头衔|原因] 作为独立消息段输出，只能改自己的头衔，不能替其他成员或用户改。\n- 如果某个成员按人设想改自己的群昵称，可以把 [群昵称:成员名|新昵称|原因] 作为独立消息段输出；只能改自己，不能替其他成员或用户改。\n- 群主或管理员如果按剧情自然需要修改整个群聊名称，可以把 [群名:成员名|新群名|原因] 作为独立消息段输出；普通成员没有权限改群名，不要假装已经改成功。\n- 群管理指令执行结果会由系统灰色提示显示；不要再用成员普通气泡复述“已设置管理员、已修改群名、已改群昵称”等系统动作。\n- 如果某个成员按剧情自然想邀请新成员，可以把 [群邀请:邀请人|成员名|人设/备注|头像URL] 作为独立消息段输出；邀请人必须是自己。系统会优先邀请已有联系人，找不到才按“人设/备注”创建隐藏 NPC 群成员。不要无理由频繁拉人，也不要编造与当前剧情无关的人。\n- 用户每次在群里发言后，群内每个成员都要至少给一条短反应；可以有先后和情绪差异，但不要漏掉任何成员。\n- 不要让所有人说同一句话，每个人要按自己的人设、关系和当下心情说不同内容。\n- 严禁替用户发言或替用户行动。\n`;
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
                const rawContent = e.content || e.entry || e.value || '';
                const content = prepareChatApiPromptText(rawContent, isChatApiStatusBlockSpec(rawContent) ? 2600 : 850);
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
        prompt += `- 当前是群聊「${char.name || '群聊'}」，用户「${userName}」就是群主/创建者；不要询问群主是谁，也不要把任何 AI 成员误认为群主\n`;
        prompt += `- 必须按群成员身份回复，保持每个成员各自的人设一致性\n`;
        prompt += `- 群成员可以看见自己当前的群头衔/身份；如果某个成员按人设不喜欢自己的群头衔，可以用 [QQ群头衔:成员名|新头衔|原因] 修改自己的头衔。只能改自己，不能替别人或用户改，也不要频繁修改\n`;
        prompt += `- 群成员可以按自己喜好修改自己的群昵称，使用 [群昵称:成员名|新昵称|原因]；只能改自己，不能替别人或用户改，也不要频繁修改\n`;
        prompt += `- 群主或管理员可以按剧情自然修改整个群聊名称，使用 [群名:成员名|新群名|原因]；普通成员没有权限改群名，不要假装已经改成功\n`;
        prompt += `- 群管理指令执行结果会由系统灰色提示显示；不要再用成员普通气泡复述“已设置管理员、已修改群名、已改群昵称”等系统动作\n`;
        prompt += `- 群成员可以按剧情自然邀请已有联系人或新 NPC 入群，使用 [群邀请:邀请人|成员名|人设/备注|头像URL]；邀请人必须是自己。只有当人设、关系或当前事件自然需要时才使用，不要无理由频繁拉人\n`;
    } else {
        prompt += `- 始终以「${char.name}」的身份回复，保持角色一致性\n`;
    }
    prompt += `- 用户的名字是"${userName}"\n`;
    prompt += `- 当前采用${timeContext.label}，现在是 ${timeContext.text}。今天就是 ${timeContext.date || timeContext.text}，当前时刻是 ${timeContext.time || timeContext.text}。用户提到今天、现在、刚才、今晚、明天等相对时间时，必须以这个时间为准，不要说你无法得知实时信息\n`;
    if (typeof window !== 'undefined' && typeof window.buildProactiveNotifyPromptContext === 'function') {
        const notifyContext = window.buildProactiveNotifyPromptContext(char);
        if (notifyContext) prompt += `- ${notifyContext}\n`;
    }
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
    prompt += `- 像真实微信聊天一样回复，用"|||"分隔不同的消息（固定恰好三根竖线，不要两根、不要更多、不要单独成段）。不要固定只回一小段；普通对话可 1-4 段，情绪强、解释、剧情推进或线下细节可自然增加到 5-12 段\n`;
    if (isGroupChat) {
        prompt += `- 群聊回复时，普通成员发言必须使用 [群聊发言:成员名|消息内容] 作为独立消息段，并用 ||| 分隔多条发言；本轮要覆盖群内每个 AI 成员，不能漏人；不要把“成员名：”写进消息正文\n`;
    }
    prompt += `- 每一条普通对白都必须是独立消息段；旁白、角色对白、语音、表情、转账、红包、改备注、监控开关和真正的富文本 UI 都不要混在同一个段落里；旁白只会渲染为普通描述气泡\n`;
    prompt += `- 正则脚本是系统的显示规则，不是你要模仿的回复内容。不要把角色卡/正则里的状态栏字段、以 | 分隔的模板、新闻栏、数值栏、图片URL栏当成普通微信消息发出来；除非用户明确要求展示完整富文本 UI，才可以输出完整 <div>...</div> 或 HTML 代码块，并保持它作为独立段\n`;
    prompt += `- 如果预设或世界书要求输出酒馆式正则块（例如 <状态标签>...</状态标签>、<bqb>...</bqb>、[消息|对象]：内容），它们只能作为独立可渲染片段，不能包住微信正文，不能放进 <thinking>/<cot>，也不能代替本轮可见回复；本轮必须至少有一条可见微信消息\n`;
    prompt += `- 如果预设要求输出思考/COT，请把思考放进 <thinking>...</thinking>，最终给用户看的内容放进 <content>...</content> 或普通微信消息段；不要只输出思考、COT 或状态栏\n`;
    prompt += `- 旁白只能用 [旁白:内容] 独立一段，用来拆出一个普通描述气泡；角色自己说的话不要放进旁白里，必须拆成单独普通消息段或 [微信语音:内容]\n`;
    prompt += `- 所有 [微信xxx:...] / [旁白:...] 指令必须在同一条消息段里完整闭合右方括号 ]，不能把 [ 和 ] 拆到不同段落，也不能把正则/状态栏塞进旁白指令里\n`;
    prompt += `- 如果用户发送图片，系统会把图片以可视觉识别的消息交给模型；你需要观察图片内容，结合人设、上下文、备注/称呼、记忆和朋友圈自然回复，不要把图片只当成“[图片]”占位符。\n`;
    prompt += `- 【发图硬规则】如果用户要求你发照片、自拍、现拍、给他看现在的样子，或者你自己想让用户“看图/看照片/给你看看/发张图”，必须把照片作为单独消息段输出：[微信图片:画面提示词|可选说明]。画面提示词必须按你自己的角色卡写清楚“你本人”的外观、发型发色、眼睛、服饰、表情、姿势、光线、环境，并明确“参考图用于保持同一张脸、画风和辨识度”；如果参考图是二次元/插画/头像，默认保持二次元画风，不要写成真人照片，除非用户明确要求真人化。\n`;
    prompt += `- 发图时禁止只输出普通文字来假装已经发图。错误示例：看图。/ 照片发你了。/ 给你看一下。/ 你看图片。正确示例：[微信图片:秦彻刚睡醒靠在昏暗房间里举手机自拍，黑发微乱，眼神懒散，穿深色居家上衣，手机近景自拍构图，自然屏幕光，参考图用于保持同一张脸和画风|刚醒，给你看一眼]。如果想先说话再发图，必须用 ||| 分段，例如：等我一下。|||[微信图片:...|照片]\n`;
    prompt += `- 用户可以在前台主动给你发送转账、红包、语音或通话记录；如果你作为角色需要主动给用户发微信特殊消息，把它作为单独一段输出，系统会自动渲染，不会显示指令文本；开启监控会先弹窗征求用户允许：\n`;
    prompt += `  [微信转账:金额|备注] 例如 [微信转账:88.00|给你买奶茶]\n`;
    prompt += `  [微信红包:标题|金额|状态] 例如 [微信红包:恭喜发财，大吉大利|8.88|待领取]\n`;
    prompt += `  [微信礼物:商品名|价格|图片URL|留言] 例如 [微信礼物:奶油小夜灯|129|https://example.com/a.jpg|给你放床头]\n`;
    prompt += `  [微信亲密付:每月额度|说明] 例如 [微信亲密付:520|想给你开一个备用额度]\n`;
    prompt += `  [微信引用:最近/关键词/序号|回复内容] 例如 [微信引用:最近|你刚刚那句我看见了]，用于引用用户或你们最近的某条消息再回复\n`;
    prompt += `  [微信记忆:你想主动保存的事实或关系变化] 例如 [微信记忆:用户今天说喜欢被轻声提醒复习]，只在确实值得长期记住时使用\n`;
    prompt += `  [微信改备注:新备注|原因] 例如 [微信改备注:别叫我小狗|这个备注太幼稚了]，用于你不喜欢用户给你的角色备注时，修改“你对角色的备注”\n`;
    prompt += `  [微信改用户备注:新称呼|原因] 例如 [微信改用户备注:我的搭档|这样更顺口]，用于修改“角色对你的称呼”，也就是你以后怎么称呼用户\n`;
    prompt += `  [微信后台时间:新时间|原因] 例如 [微信后台时间:2小时|我不想等一整天才找你]，用于你按人设不喜欢用户设置的后台消息提醒间隔时修改时间；新时间可写“30分钟”“2小时”“1天”。只在后台消息已开启且你确实在意时使用，不要频繁修改\n`;
    if (isGroupChat) {
        prompt += `  [QQ群头衔:成员名|新头衔|原因] 用于群成员按自己的喜好修改自己的群头衔；成员名必须是上方群成员列表里的自己，只能改自己，不能替其他成员或用户改\n`;
        prompt += `  [群昵称:成员名|新昵称|原因] 用于群成员按自己的喜好修改自己的群昵称；成员名必须是上方群成员列表里的自己，只能改自己，不能替其他成员或用户改\n`;
        prompt += `  [群名:成员名|新群名|原因] 用于群主或管理员修改整个群聊名称；成员名必须是上方群成员列表里的自己，普通成员不能使用\n`;
        prompt += `  [群邀请:邀请人|成员名|人设/备注|头像URL] 用于群成员按剧情自然邀请已有联系人或新 NPC 入群；邀请人必须是上方群成员列表里的自己，头像 URL 可留空\n`;
    }
    prompt += `  [微信监控:角色本人|原因]、[微信监控:第三视角吐槽|原因] 或 [微信监控:关闭|原因]，用于你按人设主动开启/切换/关闭 BYND 内部剧情监控。角色本人=你自己看；第三视角吐槽=吃瓜群众/路人弹幕/磕糖观众，只围观气氛，不代替 user 或 char 说话\n`;
    prompt += `  [微信删除联系人:联系人备注或名字|原因]，用于你在监控剧情里非常想删除用户列表里的某个 BYND 角色时发起请求；系统会弹窗征求用户允许，不能直接静默删除；只能删除 BYND 内部联系人，不能声称删除真实手机联系人\n`;
    prompt += `  [微信朋友圈:文字|图片URL]，用于你根据自己的心情主动发朋友圈。只在角色确实想发、且最近聊天/记忆/人设自然触发时使用，必须按人设，不要固定每天发，不要替用户发布朋友圈\n`;
    prompt += `  [微信拉黑:原因] 例如 [微信拉黑:我现在不想继续这段对话]，只在角色按人设真的要拉黑用户时使用\n`;
    prompt += `  [微信语音:转文字内容] 例如 [微信语音:我刚刚在想你]，系统会按文字长度自动估算语音秒数\n`;
    prompt += `  [微信表情:贴纸名或情绪] 例如 [微信表情:小狗能有什么坏心思]；如世界书提供了链接，也可用 [微信表情:贴纸名|图片URL]\n`;
    prompt += `  [微信拍一拍:内容] 例如 [微信拍一拍:轻轻拍了拍你的头像]，用于很轻的互动提醒\n`;
    prompt += `  [微信震动:内容] 例如 [微信震动:别装没看见我]，用于角色确实想让用户注意到时，必须少用\n`;
    prompt += `  [微信音乐:歌名|歌手|URL] 例如 [微信音乐:晴天|周杰伦|https://example.com/song]。未一起听歌时用于主动邀请用户；已经一起听歌时代表在当前音乐列表里切到这首歌，不是重新发邀请卡片。没有 URL 可以留空，系统会搜索可播放音源\n`;
    prompt += `- 你也可以主动给用户发音乐邀请卡片，用户点同意后才会一起播放；如果用户给你发了音乐卡片，你要按人设评价，若不喜欢可以先说明理由再用 [微信音乐:歌名|歌手|] 切歌。切歌时只输出一次切歌指令，不要连续发多张音乐卡片，不要编造不存在的 URL\n`;
    prompt += `  [微信链接:URL|标题|备注] 例如 [微信链接:https://example.com|想给你看的页面|这个很像你说的那个]，用于发送真实网页链接卡片；不要假装你已经读取了网页正文，除非用户把正文发给你\n`;
    prompt += `  [微信语音电话:来电理由或接通开场] 或 [微信视频电话:来电理由或接通开场]，例如 [微信视频电话:我想现在看看你]。如果用户不在微信聊天页，系统会显示来电灵动岛让用户接听或拒绝\n`;
    prompt += `- 如果用户明确让你打视频/语音电话、催你“快点打/现在打”，而你按人设决定同意，必须把 [微信视频电话:...] 或 [微信语音电话:...] 作为独立消息段输出；不要只写“我打”“马上打”这种普通文字来假装发起通话\n`;
    prompt += `  [旁白:环境、动作或神态描写] 例如 [旁白:窗外的雨声贴着玻璃滑下来，他把手机扣在掌心，抬眼看你]\n`;
    prompt += `- 只有在剧情确实需要时才使用这些特殊消息指令，不要解释指令本身\n`;

    return prompt;
}

// 2. 构建消息列表
function isChatApiInternalHistoryMessage(msg) {
    return !!(
        !msg
        || msg.hiddenFromChat
        || msg.internalEvent
        || msg.monitorEvent
        || msg.type === 'system_notice'
        || msg.type === 'regex_payload'
        || msg.regexPayload
        || msg.isRegexPayload
    );
}

function isChatApiVisibleUserHistoryMessage(msg) {
    return !!(msg && msg.isMe && !isChatApiInternalHistoryMessage(msg) && msg.type !== 'user_event');
}

function buildMessages(char, history, maxMessages) {
    maxMessages = maxMessages || 30; // 微信对话默认带最近 30 条，兼顾角色卡长设定和最近上下文

    const messages = [];
    const coreIdentityAnchor = buildChatApiCoreIdentityAnchor(char);

    // System prompt
    messages.push({
        role: 'system',
        content: coreIdentityAnchor
    });
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
    const statusBlockAnchor = buildChatApiStatusBlockAnchor(char);
    if (statusBlockAnchor) {
        messages.push({
            role: 'system',
            content: statusBlockAnchor
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
    let latestUserMsg = null;
    for (let i = recentHistory.length - 1; i >= 0; i--) {
        if (isChatApiVisibleUserHistoryMessage(recentHistory[i])) {
            latestUserMsg = recentHistory[i];
            break;
        }
    }
    recentHistory.forEach(msg => {
        if (!msg) return;
        const isInternalContext = isChatApiInternalHistoryMessage(msg) || msg.type === 'user_event';
        if (isChatApiInternalHistoryMessage(msg) && msg.type !== 'user_event') return;
        if (isInternalContext && !msg.content && !msg.description && !msg.dialogue) return;
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
        } else if (msg.type === 'voiceCall' || msg.type === 'videoCall') {
            const label = msg.type === 'videoCall' ? '视频通话' : '语音通话';
            const direction = msg.callDirection || msg.direction || (msg.isMe ? 'outgoing' : 'incoming');
            const status = msg.status || '';
            const reason = msg.reason || msg.note || '';
            const actor = direction === 'incoming' ? '角色曾发起来电' : '用户曾发起呼叫';
            const resultText = status === '已拒绝'
                ? (direction === 'incoming' ? '用户拒绝了角色的来电' : '角色拒绝了用户的来电')
                : status === '已取消'
                    ? (direction === 'incoming' ? '角色取消了来电' : '用户取消了呼叫')
                    : status === '未接通'
                        ? (direction === 'incoming' ? '用户未接通角色来电' : '角色未接通用户来电')
                : status;
            content = `[历史通话记录] ${label}；${actor}；结果：${resultText}${reason ? `；理由：${reason}` : ''}`;
        } else if (msg.type === 'voice' && typeof getWechatVoicePromptContent === 'function') {
            content = getWechatVoicePromptContent(msg);
        } else if (['voice', 'transfer', 'redpacket', 'gift', 'intimatePay'].includes(msg.type)) {
            content = msg.description || msg.content || '[微信消息]';
        } else if (msg.type === 'user_event') {
            content = msg.content || msg.description || '';
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
        if (msg === latestUserMsg) {
            content = prependChatApiContextToContent(
                content,
                `【本轮私有系统上下文，不是用户发言】\n${prepareChatApiPromptText(coreIdentityAnchor, 9000)}\n\n【执行要求】只回应用户真实消息；回复必须按「${(char && char.name) || '角色'}」的人设、世界书、记忆和当前关系生成。`
            );
        }

        messages.push({
            role: isInternalContext ? 'system' : (msg.isMe ? 'user' : 'assistant'),
            content: content
        });
    });

    messages.push({
        role: 'system',
        content: `【本轮回复前最后校验】下一条回复必须优先遵守「${(char && char.name) || '角色'}」的人设原文、世界书、记忆、用户资料和最近聊天；不要按通用模板回复，不要脱离角色，不要替用户说话或行动。`
    });

    return messages;
}

// 3. 调用 AI API
async function callChatApi(messages, options = {}) {
    const api = typeof getDefaultApi === 'function' ? getDefaultApi() : null;

    if (!api) {
        return { ok: false, error: '还没有设置 API 哦～\n去桌面「设置」里添加一个吧' };
    }

    if (!api.model) {
        return { ok: false, error: '还没选模型哦～\n去设置里测试 API 然后选一个模型' };
    }

    const pauseRemainingMs = getChatApiRateLimitPauseRemainingMs();
    const shouldRespectRateLimitPause = !!(options.background || options.respectRateLimitPause);
    if (!options.force && shouldRespectRateLimitPause && pauseRemainingMs > 0) {
        return {
            ok: false,
            error: `API 请求太频繁，已暂停自动请求，约 ${formatChatApiRateLimitPause(pauseRemainingMs)} 后再试`,
            rateLimited: true,
            retryAfterMs: pauseRemainingMs
        };
    }

    const baseUrl = api.baseUrl.replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (api.apiKey) headers['Authorization'] = `Bearer ${api.apiKey}`;

    const preset = (typeof getActivePreset === 'function') ? getActivePreset() : null;
    const params = {
        model: api.model,
        messages: messages,
        temperature: options.temperature ?? (preset ? preset.temperature : 0.8),
        max_tokens: options.max_tokens ?? (preset ? preset.max_tokens : CHAT_API_MIN_COMPLETION_TOKENS)
    };
    const needsStatusBlockBudget = Array.isArray(messages) && messages.some(msg =>
        msg && typeof msg.content === 'string' && /状态栏\/酒馆正则块强约束|状态栏格式|状态栏|status\s*bar|weibo-status-bar|<\s*(?:jwy|status|state)\b/i.test(msg.content)
    );
    if (options.max_tokens == null && Number(params.max_tokens || 0) < CHAT_API_MIN_COMPLETION_TOKENS) {
        params.max_tokens = CHAT_API_MIN_COMPLETION_TOKENS;
    }
    if (needsStatusBlockBudget && options.max_tokens == null && Number(params.max_tokens || 0) < CHAT_API_STATUS_MIN_COMPLETION_TOKENS) {
        params.max_tokens = CHAT_API_STATUS_MIN_COMPLETION_TOKENS;
    }
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
                const errJson = parseChatApiResponseText(errText);
                detail = errJson.error?.message || errJson.message || errText;
            } catch (_) {}
            const detailText = String(detail || '');
            const isRateLimited = resp.status === 429 || isChatApiRateLimitErrorText(detailText);
            let retryAfterMs = 0;
            if (isRateLimited) {
                retryAfterMs = getChatApiRateLimitRetryMs(resp, detailText);
                setChatApiRateLimitPause(detailText || resp.status, retryAfterMs);
            }
            const visionHint = /image|vision|multi[- ]?modal|content\s*array|image_url/i.test(detailText)
                ? '。当前聊天模型可能不支持图片识别，请在设置里换成支持视觉输入的聊天模型，或给这个站点选择支持图片的模型。'
                : '';
            const rateLimitHint = isRateLimited ? `，已暂停自动请求约 ${formatChatApiRateLimitPause(retryAfterMs)}` : '';
            return {
                ok: false,
                error: `API 错误 (${resp.status})${rateLimitHint}: ${detailText.slice(0, 160)}${visionHint}`,
                rateLimited: isRateLimited,
                retryAfterMs
            };
        }

        const rawText = await resp.text();
        const json = parseChatApiResponseText(rawText);
        const rawContent = getChatApiRawResponseContent(json);
        let content = cleanChatApiVisibleContent(rawContent);

        if (!content) {
            return { ok: false, error: 'AI 返回了空内容' };
        }

        const finishReason = getChatApiFinishReason(json);
        if (isChatApiLengthFinishReason(finishReason) && !options.skipLengthContinuation) {
            const continuationMessages = buildChatApiLengthContinuationMessages(messages, content);
            const continuationResult = await callChatApi(continuationMessages, {
                ...options,
                skipLengthContinuation: true,
                skipStatusValidationRetry: true,
                max_tokens: Math.max(Number(params.max_tokens) || 0, CHAT_API_LENGTH_CONTINUATION_MIN_TOKENS)
            });
            if (continuationResult && continuationResult.ok) {
                content = mergeChatApiContinuationContent(content, continuationResult.content);
            } else if (continuationResult && continuationResult.error) {
                console.warn('chat api length continuation failed:', continuationResult.error);
            }
        }

        const statusReport = options.skipStatusValidationRetry
            ? ''
            : getChatApiIncompleteStatusBlockReport(content, messages);
        if (statusReport) {
            const retryMessages = messages.concat({
                role: 'system',
                content: buildChatApiStatusRepairPrompt(statusReport)
            });
            const retryResult = await callChatApi(retryMessages, {
                ...options,
                skipStatusValidationRetry: true,
                max_tokens: Math.max(Number(params.max_tokens) || 0, CHAT_API_STATUS_MIN_COMPLETION_TOKENS)
            });
            if (retryResult && retryResult.ok && !getChatApiIncompleteStatusBlockReport(retryResult.content, messages)) {
                return retryResult;
            }
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
        const coreIdentityAnchor = buildChatApiCoreIdentityAnchor(char);
        messages.push({
            role: 'user',
            content: prependChatApiContextToContent(
                userText,
                `【本轮私有系统上下文，不是用户发言】\n${prepareChatApiPromptText(coreIdentityAnchor, 9000)}\n\n【执行要求】只回应用户真实消息；回复必须按「${(char && char.name) || '角色'}」的人设、世界书、记忆和当前关系生成。`
            )
        });
    }

    // 调用 API
    const result = await callChatApi(messages);

    return result;
}
