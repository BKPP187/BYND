function getWechatChatPresenceMode(char) {
    const mode = char && char.chatConfig && char.chatConfig.chatPresenceMode;
    return ['online', 'offline'].includes(mode) ? mode : 'auto';
}

function looksLikeWechatRegexPayloadSource(text) {
    const source = String(text || '');
    return /\|\^&\^|\^&\^|!\^!\^|【REGEX】|<regex\b/i.test(source);
}

function escapeWechatRegexLiteral(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getWechatLeadingPipeStatusTagName(text) {
    const source = String(text || '').trim();
    const match = source.match(/^<\s*([A-Za-z][\w:-]*)\b[^>]*>/);
    if (!match) return '';
    const tag = String(match[1] || '').toLowerCase();
    const htmlTags = new Set([
        'html', 'head', 'body', 'style', 'script', 'div', 'section', 'article', 'main',
        'table', 'thead', 'tbody', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'p', 'span',
        'a', 'img', 'button', 'input', 'svg', 'canvas', 'video', 'audio'
    ]);
    return htmlTags.has(tag) ? '' : tag;
}

function getWechatPipeStatusPayloadBody(text) {
    const source = String(text || '').trim();
    const match = source.match(/^<\s*([A-Za-z][\w:-]*)\b[^>]*>/);
    const tag = getWechatLeadingPipeStatusTagName(source);
    if (!match || !tag) return source;
    const closeRe = new RegExp(`<\\s*\\/\\s*${escapeWechatRegexLiteral(tag)}\\s*>\\s*$`, 'i');
    return source.slice(match[0].length).replace(closeRe, '').trim() || source;
}

function looksLikeWechatPipeStatusPayloadSource(text) {
    const visible = cleanWechatVisibleContent(text).replace(/\|\|\|/g, '|');
    const source = getWechatPipeStatusPayloadBody(visible);
    if (!source || source.length > 1400) return false;
    if (hasWechatAiDirectiveSource(source) || hasWechatRichTag(source)) return false;
    const pipeCount = (source.match(/\|/g) || []).length;
    if (pipeCount < 3) return false;
    const firstPipe = source.indexOf('|');
    if (firstPipe > 0) {
        const firstCell = source.slice(0, firstPipe).trim();
        if (/[。！？!?；;\r\n]/.test(firstCell)) return false;
        if (!getWechatLeadingPipeStatusTagName(visible) && firstCell.length > 48) return false;
    }
    if (/https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?/i.test(source)) return true;
    if (/^\s*\|{2,}/.test(source) || /\|{2,}\s*$/.test(source)) return true;
    const cells = source.split('|').map(item => item.trim()).filter(Boolean);
    if (cells.length < 3) return false;
    const hasTemplateLikeCell = cells.some(cell => /https?:\/\/|@\S+|\d{1,3}%|^\d+(?:\.\d+)?$|^[\w-]{2,24}\.(?:png|jpe?g|gif|webp)$/i.test(cell));
    const shortCells = cells.filter(cell => cell.length <= 34).length;
    const newsCells = cells.filter(cell => /市|区|县|省|部|委|办|局|规划|文旅|交通|会议|上会|预警|调研|项目|方案|赛事|景点|限流/.test(cell)).length;
    return hasTemplateLikeCell || shortCells >= Math.max(2, Math.ceil(cells.length * 0.55)) || newsCells >= 2;
}

function normalizeWechatRegexPayloadSeparators(text) {
    const source = String(text || '');
    if (!source.includes('|||')) return source;
    const collapsed = source.replace(/\|\|\|/g, '|');
    return looksLikeWechatPipeStatusPayloadSource(collapsed) || looksLikeWechatRegexPayloadSource(source)
        ? collapsed
        : source;
}

function getWechatPipeStatusWrapperCandidates(char) {
    const scripts = [
        ...(window.globalRegexScripts || []),
        ...((char && Array.isArray(char.regex)) ? char.regex : [])
    ].filter(isWechatRegexScriptEnabled);
    const candidates = [];
    scripts.forEach(script => {
        const raw = getWechatRegexScriptField(script, ['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']);
        const replaceStr = getWechatRegexScriptField(script, ['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']);
        if (!raw || !isRichMessageContent(replaceStr)) return;
        const tagMatch = String(raw).match(/<\\?\s*([A-Za-z][\w:-]*)\b/);
        if (!tagMatch) return;
        const tag = String(tagMatch[1] || '').toLowerCase();
        if (!getWechatLeadingPipeStatusTagName(`<${tag}>`)) return;
        const pipeCount = (String(raw).match(/\\\|/g) || []).length;
        if (pipeCount < 3) return;
        const slots = pipeCount + 1;
        if (!candidates.some(item => item.tag === tag && item.slots === slots)) {
            candidates.push({ tag, slots });
        }
    });
    return candidates;
}

function padWechatPipeStatusPayloadBody(body, slots) {
    const source = String(body || '').trim();
    if (!source || !slots) return source;
    const cells = source.split('|');
    if (cells.length >= slots) return source;
    return cells.concat(Array(slots - cells.length).fill('')).join('|');
}

function cleanWechatStatusCell(value, maxLength = 120) {
    const text = String(value == null ? '' : value).replace(/[|<>]/g, ' ').replace(/\s+/g, ' ').trim();
    return text.slice(0, maxLength);
}

function getWechatStatusIdentityCells(char, expected) {
    const cells = Array(Math.max(Number(expected) || 0, 2)).fill('');
    cells[0] = cleanWechatStatusCell(getWechatDisplayCharName(char) || (char && (char.name || char.nickname || char.title)) || '');
    cells[1] = cleanWechatStatusCell(char && char.avatar, 1200);
    return cells;
}

function shouldRepairWechatFullStatusPayload(tag, slots, body) {
    const cellCount = String(body || '').split('|').length;
    if (Number(slots) >= 18 || cellCount >= 16) return true;
    return /^(?:jwy|status|state)$/i.test(String(tag || ''));
}

function repairWechatStatusPayloadBody(body, slots, char) {
    const expected = Math.max(Number(slots) || 18, 18);
    let cells = String(body || '').split('|');
    if (cells.length > expected) {
        cells = cells.slice(0, expected - 1).concat(cells.slice(expected - 1).join(' '));
    }
    while (cells.length < expected) cells.push('');
    const identity = getWechatStatusIdentityCells(char, expected);
    cells = cells.map((value, index) => {
        const cleaned = cleanWechatStatusCell(value, index === 1 ? 1200 : 120);
        return cleaned || (index <= 1 ? identity[index] : '');
    });
    cells[9] = cleanWechatStatusCell(String(cells[9] || '').match(/\d{1,3}/)?.[0] || cells[9]);
    return cells.slice(0, expected).join('|');
}

function normalizeWechatRegexPayloadWrappers(text, char) {
    const source = String(text || '').trim();
    const tag = getWechatLeadingPipeStatusTagName(source);
    if (!tag) {
        if (!looksLikeWechatPipeStatusPayloadSource(source)) return String(text || '');
        const candidates = getWechatPipeStatusWrapperCandidates(char);
        for (const item of candidates) {
            const fullStatus = shouldRepairWechatFullStatusPayload(item.tag, item.slots, source);
            const body = fullStatus
                ? repairWechatStatusPayloadBody(source, item.slots, char)
                : padWechatPipeStatusPayloadBody(source, item.slots);
            const candidate = `<${item.tag}>${body}</${item.tag}>`;
            if (willWechatRegexRenderRich(candidate, char)) return candidate;
        }
        return String(text || '');
    }
    const closeRe = new RegExp(`<\\s*\\/\\s*${escapeWechatRegexLiteral(tag)}\\s*>\\s*$`, 'i');
    if (!looksLikeWechatPipeStatusPayloadSource(source)) return String(text || '');
    const slotHint = getWechatPipeStatusWrapperCandidates(char).find(item => item.tag === tag);
    const body = getWechatPipeStatusPayloadBody(source);
    const open = source.match(/^<\s*[A-Za-z][\w:-]*\b[^>]*>/)?.[0] || `<${tag}>`;
    const slotCount = slotHint?.slots || (shouldRepairWechatFullStatusPayload(tag, 0, body) ? Math.max(body.split('|').length, 18) : 0);
    const fullStatus = shouldRepairWechatFullStatusPayload(tag, slotCount, body);
    if (closeRe.test(source) && !fullStatus && (!slotHint || willWechatRegexRenderRich(source, char))) return source;
    const fixedBody = fullStatus
        ? repairWechatStatusPayloadBody(body, slotCount, char)
        : padWechatPipeStatusPayloadBody(body, slotCount);
    const candidate = `${open}${fixedBody}</${tag}>`;
    if (fullStatus) return candidate;
    return willWechatRegexRenderRich(candidate, char) ? candidate : source;
}

function normalizeWechatRegexPayloadSource(text, char) {
    const source = normalizeWechatRegexPayloadSeparators(text);
    const direct = normalizeWechatRegexPayloadWrappers(source, char);
    if (direct !== source) return direct;
    let normalized = source;
    getWechatPipeStatusWrapperCandidates(char).forEach(item => {
        const tag = escapeWechatRegexLiteral(item.tag);
        const closedRe = new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`, 'gi');
        normalized = normalized.replace(closedRe, match => normalizeWechatRegexPayloadWrappers(match, char));
    });
    normalized = normalized.split(/(\r?\n{2,})/).map(part => {
        if (/^\r?\n+$/.test(part)) return part;
        if (getWechatLeadingPipeStatusTagName(part)) return part;
        return looksLikeWechatPipeStatusPayloadSource(part)
            ? normalizeWechatRegexPayloadWrappers(part, char)
            : part;
    }).join('');
    return normalized;
}

function willWechatRegexRenderRich(text, char) {
    const source = String(text || '');
    if (!source) return false;
    const scripts = [
        ...(window.globalRegexScripts || []),
        ...((char && Array.isArray(char.regex)) ? char.regex : [])
    ].filter(isWechatRegexScriptEnabled);
    return scripts.some(script => {
        try {
            const regexStr = getWechatRegexScriptField(script, ['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']);
            const replaceStr = getWechatRegexScriptField(script, ['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']);
            if (!regexStr) return false;
            let pattern = fillWechatRegexTemplate(regexStr, char);
            let flags = 'g';
            if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
                const lastSlash = pattern.lastIndexOf('/');
                flags = pattern.substring(lastSlash + 1).replace(/[^gimsuy]/g, '') || 'g';
                pattern = pattern.substring(1, lastSlash);
            }
            const re = new RegExp(pattern, flags);
            return re.test(source) && (isRichMessageContent(replaceStr) || looksLikeWechatRegexPayloadSource(source));
        } catch (_) {
            return false;
        }
    });
}

function looksLikeWechatRichOrRegexSource(text, char) {
    return /```[\s\S]*?```/.test(text)
        || /<\s*\/?\s*[A-Za-z][\w:-]*\b[^>]*>/.test(text)
        || isRichMessageContent(text)
        || looksLikeWechatRegexPayloadSource(text)
        || looksLikeWechatPipeStatusPayloadSource(text)
        || willWechatRegexRenderRich(text, char);
}

function hasWechatAiDirectiveSource(text) {
    const source = String(text || '');
    for (let i = 0; i < source.length; i += 1) {
        if (getWechatAiDirectiveStartAt(source, i)) return true;
    }
    return false;
}

const WECHAT_AI_DIRECTIVE_COMMANDS = [
    '微信语音电话', '微信视频电话', '微信送礼物', '微信改用户备注', '微信删除联系人',
    '微信后台消息时间', '微信后台时间',
    '微信亲密付', '微信拍一拍', '微信朋友圈', '微信转账', '微信红包', '微信礼物',
    '微信表情', '微信图片', '微信照片', '微信语音', '微信引用', '微信记忆', '微信改备注', '微信拉黑',
    '微信监控', '微信震动', '微信音乐', '微信链接', '微信旁白', '微信改群头衔', '微信改群昵称', '微信改群名',
    '音乐卡片', '链接卡片', 'QQ群头衔', '群头衔', 'QQ群昵称', '微信群昵称', '群昵称',
    'QQ群名', '微信群名', '群聊名称', '群名称', '群名', 'QQ改群名',
    '群邀请', '群拉人', '微信群邀请', 'QQ群邀请', '群NPC', '群npc',
    '后台消息时间', '后台提醒时间',
    '群聊发言', '微信群聊', '开启监控', '关闭监控',
    '震动屏幕', '拍一拍', '旁白'
];

function getWechatAiDirectiveStartAt(text, index) {
    const opener = text[index];
    if (opener !== '[' && opener !== '【') return null;
    const preferredCloser = opener === '【' ? '】' : ']';
    const rest = text.slice(index + 1);
    for (const command of WECHAT_AI_DIRECTIVE_COMMANDS) {
        if (!rest.startsWith(command)) continue;
        const sep = rest[command.length];
        if (sep === ':' || sep === '：') {
            return {
                command,
                argsStart: index + 1 + command.length + 1,
                opener,
                preferredCloser,
                standaloneNarration: false
            };
        }
        if ((sep === ']' || sep === '】') && (command === '旁白' || command === '微信旁白')) {
            return {
                command,
                argsStart: index + 1 + command.length + 1,
                opener,
                preferredCloser,
                standaloneNarration: true,
                end: index + 1 + command.length + 1
            };
        }
    }
    return null;
}

function readWechatAiDirectiveAt(text, index) {
    const start = getWechatAiDirectiveStartAt(text, index);
    if (!start) return null;
    if (start.standaloneNarration) {
        return {
            type: 'directive',
            start: index,
            end: start.end,
            command: start.command,
            args: '',
            standaloneNarration: true
        };
    }
    let depth = 1;
    for (let i = start.argsStart; i < text.length; i += 1) {
        if ((text[i] === '[' || text[i] === '【') && getWechatAiDirectiveStartAt(text, i)) {
            depth += 1;
            continue;
        }
        if (text[i] !== ']' && text[i] !== '】') continue;
        depth -= 1;
        if (depth === 0) {
            return {
                type: 'directive',
                start: index,
                end: i + 1,
                command: start.command,
                args: text.slice(start.argsStart, i),
                standaloneNarration: false
            };
        }
    }
    return {
        type: 'directive',
        start: index,
        end: text.length,
        command: start.command,
        args: text.slice(start.argsStart),
        standaloneNarration: false
    };
}

function hasWechatUnclosedDirectiveTail(text) {
    return /[\[【](?:微信转账|微信红包|微信礼物|微信送礼物|微信亲密付|微信表情|微信图片|微信照片|微信语音电话|微信视频电话|微信语音|微信引用|微信记忆|微信改用户备注|微信改备注|微信后台消息时间|微信后台时间|微信改群头衔|微信改群昵称|微信改群名|微信拉黑|微信监控|开启监控|关闭监控|微信拍一拍|拍一拍|微信震动|震动屏幕|微信音乐|音乐卡片|微信链接|链接卡片|微信朋友圈|微信删除联系人|后台消息时间|后台提醒时间|QQ群头衔|群头衔|QQ群昵称|微信群昵称|群昵称|QQ群名|微信群名|群聊名称|群名称|群名|QQ改群名|群邀请|群拉人|微信群邀请|QQ群邀请|群NPC|群npc|群聊发言|微信群聊|微信旁白|旁白)[：:][^\]】]*$/i.test(String(text || '').trim());
}

function isWechatStandaloneRichOrRegexSource(text, char) {
    const source = cleanWechatVisibleContent(text);
    if (!source || !looksLikeWechatRichOrRegexSource(source, char)) return false;
    if (/^```[\s\S]*?```\s*$/.test(source)) return true;
    if (/^<\s*([A-Za-z][\w:-]*)\b[\s\S]*<\/\s*\1\s*>\s*$/.test(source)) return true;
    if (/^<\s*(?:html|div|section|article|style|script|table|svg|canvas)\b[\s\S]*$/i.test(source)) return true;
    if (looksLikeWechatRegexPayloadSource(source) && !/[。！？!?]\s*\S{2,}/.test(source.replace(/\|\^&\^|\^&\^|!\^!\^|【REGEX】/g, ''))) return true;
    if (looksLikeWechatPipeStatusPayloadSource(source)) return true;
    const ranges = getWechatRichCandidateRanges(source);
    if (ranges.length && !(ranges.length === 1 && ranges[0].start === 0 && ranges[0].end === source.length)) return false;
    return willWechatRegexRenderRich(source, char) && !/\n{2,}/.test(source);
}

function addWechatMixedRange(ranges, start, end) {
    if (start == null || end == null || end <= start) return;
    ranges.push({ start, end });
}

function getWechatPipeStatusPayloadStartInLine(line) {
    const text = String(line || '');
    if (!text.trim()) return -1;
    if (looksLikeWechatPipeStatusPayloadSource(text)) return 0;

    const starts = new Set();
    const pushStart = index => {
        let start = Math.max(0, Number(index) || 0);
        while (start < text.length && /\s/.test(text[start])) start += 1;
        if (start > 0 && start < text.length) starts.add(start);
    };

    text.replace(/[。！？!?；;]\s*/g, (match, offset) => {
        pushStart(offset + match.length);
        return match;
    });
    text.replace(/<\/content>\s*/gi, (match, offset) => {
        pushStart(offset + match.length);
        return match;
    });

    for (let pipeIndex = text.indexOf('|'); pipeIndex >= 0; pipeIndex = text.indexOf('|', pipeIndex + 1)) {
        let start = pipeIndex;
        while (start > 0 && !/[\s\r\n。！？!?；;]/.test(text[start - 1])) start -= 1;
        pushStart(start);
    }

    return [...starts]
        .sort((a, b) => a - b)
        .find(start => looksLikeWechatPipeStatusPayloadSource(text.slice(start).trim())) ?? -1;
}

function getWechatRichCandidateRanges(source) {
    const text = String(source || '');
    const ranges = [];
    const collect = re => {
        let match;
        while ((match = re.exec(text)) !== null) {
            addWechatMixedRange(ranges, match.index, re.lastIndex);
        }
    };
    collect(/```(?:html|xml|markdown)?\s*[\s\S]*?```/gi);
    collect(/<\s*(jwy|status|state)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi);
    collect(/<\s*html\b[\s\S]*?<\/\s*html\s*>/gi);
    collect(/<\s*([A-Za-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi);

    let lineStart = 0;
    text.split(/\r?\n/).forEach(line => {
        const lineEnd = lineStart + line.length;
        if (looksLikeWechatRegexPayloadSource(line)) {
            addWechatMixedRange(ranges, lineStart, lineEnd);
        } else {
            const pipeStart = getWechatPipeStatusPayloadStartInLine(line);
            if (pipeStart >= 0) addWechatMixedRange(ranges, lineStart + pipeStart, lineEnd);
        }
        lineStart = lineEnd + 1;
    });

    return ranges
        .sort((a, b) => a.start - b.start || b.end - a.end)
        .reduce((merged, range) => {
            const last = merged[merged.length - 1];
            if (!last || range.start > last.end) {
                merged.push({ ...range });
            } else {
                if (range.end > last.end) last.end = range.end;
                if (range.start > last.start && looksLikeWechatPipeStatusPayloadSource(text.slice(range.start, range.end).trim())) {
                    last.start = range.start;
                }
            }
            return merged;
        }, []);
}

function appendWechatExpandedTextParts(target, content, char) {
    const source = cleanWechatVisibleContent(content);
    if (!source) return;
    const ranges = getWechatRichCandidateRanges(source);
    if (!ranges.length) {
        target.push(...splitWechatOfflinePlainText(source, char));
        return;
    }
    let cursor = 0;
    ranges.forEach(range => {
        const before = source.slice(cursor, range.start).trim();
        if (before) target.push(...splitWechatOfflinePlainText(before, char));
        const rich = normalizeWechatRegexPayloadSource(source.slice(range.start, range.end).trim(), char);
        if (rich && !shouldDropWechatAiPipeStatusPayload(rich, char)) target.push({ kind: 'text', content: rich });
        cursor = range.end;
    });
    const after = source.slice(cursor).trim();
    if (after) target.push(...splitWechatOfflinePlainText(after, char));
}

function parseWechatLegacyCallSummaryMessage(text) {
    const source = cleanWechatVisibleContent(text);
    const match = source.match(/^\s*\[(语音通话|视频通话)\]\s*([^\n]*)$/);
    if (!match) return null;
    if (/(?:角色发起，用户处理|用户发起，角色处理)；结果：/.test(match[2])) return null;
    const chunks = match[2].split('·').map(item => item.trim()).filter(Boolean);
    const status = chunks[0] || '已结束';
    let duration = 0;
    const reasonParts = [];
    chunks.slice(1).forEach(chunk => {
        if (!duration && /(?:\d+\s*(?:秒|分钟|分|s)|\d+:\d+)/i.test(chunk)) {
            duration = normalizeWechatDuration(chunk, 0);
        } else {
            reasonParts.push(chunk);
        }
    });
    return syncWechatMessageDescription({
        type: match[1] === '视频通话' ? 'videoCall' : 'voiceCall',
        isMe: false,
        status,
        duration,
        reason: reasonParts.join(' · '),
        timestamp: createMessageTimestamp()
    });
}

function isWechatLeakedCallHistorySummary(text) {
    const source = cleanWechatVisibleContent(text)
        .replace(/\s+/g, ' ')
        .trim();
    return /^\[(?:语音通话|视频通话)\]\s*(?:角色发起，用户处理|用户发起，角色处理)；结果：/i.test(source)
        || /^\[历史通话记录\]\s*(?:语音通话|视频通话)；/.test(source);
}

function parseWechatLegacyVoiceMessage(text) {
    const source = cleanWechatVisibleContent(text);
    const match = source.match(/^\s*[\[【]\s*(?:微信)?语音\s*(?:(\d+)\s*(?:秒|s|S)?|(\d+:\d+))?\s*[\]】]\s*([\s\S]*)$/);
    if (!match) return null;
    const transcript = cleanWechatVisibleContent(match[3] || '');
    const explicitDuration = normalizeWechatDuration(match[2] || match[1] || '', 0);
    const duration = explicitDuration > 0 ? explicitDuration : estimateWechatVoiceDuration(transcript);
    return syncWechatMessageDescription({
        type: 'voice',
        isMe: false,
        duration,
        transcript,
        content: transcript || `[语音 ${formatWechatDuration(duration)}]`,
        timestamp: createMessageTimestamp()
    });
}

function appendWechatPlainAiTextParts(target, content, char) {
    const source = normalizeWechatRegexPayloadSource(cleanWechatVisibleContent(content), char);
    if (!source) return;
    if (isWechatLeakedCallHistorySummary(source)) return;
    if (/^\]\s*$/.test(source)) return;
    if (isWechatStandaloneRichOrRegexSource(source, char)) {
        target.push({ kind: 'text', content: source });
        return;
    }
    if (shouldDropWechatAiPipeStatusPayload(source, char)) return;
    const legacyMsg = parseWechatLegacyCallSummaryMessage(source);
    if (legacyMsg) {
        target.push({ kind: 'special', msg: legacyMsg });
        return;
    }
    const legacyVoiceMsg = parseWechatLegacyVoiceMessage(source);
    if (legacyVoiceMsg) {
        target.push({ kind: 'special', msg: legacyVoiceMsg });
        return;
    }
    const autoImageMsg = buildWechatAutoImageMessageFromText(source, char);
    if (autoImageMsg) {
        target.push({ kind: 'special', msg: autoImageMsg });
        return;
    }
    appendWechatExpandedTextParts(target, source, char);
}

function shouldDropWechatAiPipeStatusPayload(text, char) {
    const source = cleanWechatVisibleContent(text);
    if (!looksLikeWechatPipeStatusPayloadSource(source)) return false;
    if (source.includes('|||')) return false;
    if (willWechatRegexRenderRich(source, char) || isRichMessageContent(source)) return false;
    return true;
}

function hasWechatRichTag(text) {
    return /<\s*\/?\s*[A-Za-z][\w:-]*\b[^>]*>/.test(String(text || ''));
}

function isWechatRichFragmentComplete(text) {
    const source = String(text || '');
    if (!hasWechatRichTag(source)) return true;
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    const stack = [];
    source.replace(/<\s*(\/?)([A-Za-z][\w:-]*)\b[^>]*?>/g, (full, slash, rawName) => {
        const name = String(rawName || '').toLowerCase();
        if (!name || voidTags.has(name) || /\/\s*>$/.test(full)) return full;
        if (slash) {
            const idx = stack.lastIndexOf(name);
            if (idx >= 0) stack.splice(idx, 1);
        } else {
            stack.push(name);
        }
        return full;
    });
    return stack.length === 0;
}

function normalizeWechatMergedRichContent(parts) {
    const raw = parts.map(item => String(item || '').trim()).filter(Boolean).join('\n');
    return cleanWechatVisibleContent(raw)
        .replace(/^[\s|｜，,。.;；:：、]+(?=<\s*[A-Za-z][\w:-]*\b)/, '')
        .trim();
}

function pushWechatSplitTextPart(target, kind, content) {
    const text = kind === 'narration'
        ? normalizeWechatOfflineNarrationText(content)
        : cleanWechatVisibleContent(content);
    if (!text) return;
    target.push({ kind: kind === 'narration' ? 'narration' : 'text', content: text });
}

function pushWechatNarrationPart(target, content) {
    const text = normalizeWechatOfflineNarrationText(content);
    if (!text) return;
    target.push({ kind: 'narration', content: text });
}

function normalizeWechatOfflineNarrationText(value) {
    const normalized = cleanWechatVisibleContent(value)
        .replace(/^\s*\[(?:微信旁白|旁白)\]\s*/i, '')
        .replace(/^\s*(?:微信旁白|旁白)\s*[：:]\s*/i, '')
        .replace(/^[\s，,。.;；:：、]+/, '')
        .trim();
    return stripWechatUserAgencyFromNarration(normalized);
}

function isWechatUserAgencySentence(text) {
    const source = String(text || '').trim();
    if (!source) return false;
    return /(?:^|[。！？!?；;\s])你(?:只来得及|来得及|下意识|本能地|不由|忍不住|意识到|发现|觉得|想起|想要|试图|刚想|终于|已经|还没|伸手|抬手|握住|抓住|拽住|推开|躲开|退开|靠近|站起|坐下|走近|跑开|开口|说|喊|叫|发出|回答|回复|沉默|呼吸|喘|心跳|视野|眼前|脑海|身体|指尖|手腕|肩膀|腰|腿|脚)/.test(source)
        || /(?:你的|你那|你自己|你整个人|你身体|你视野|你意识|你脑海|你心里|你下意识|你本能地)(?:[^。！？!?；;]{0,18})(?:想|觉得|意识到|发现|伸手|开口|说|喊|动|退|躲|靠|抓|握|呼吸|心跳|发软|僵住|颤|愣)/.test(source);
}

function stripWechatUserAgencyFromNarration(value) {
    const source = String(value || '').trim();
    if (!source) return '';
    const sentences = source.match(/[^。！？!?；;]+[。！？!?；;]?|[\s\S]+$/g) || [source];
    const kept = sentences
        .map(item => item.trim())
        .filter(item => item && !isWechatUserAgencySentence(item));
    return kept.join('').trim();
}

function buildWechatOfflineNarrationPart(content) {
    const text = normalizeWechatOfflineNarrationText(content);
    if (!text) return null;
    return { kind: 'narration', content: text };
}

function buildWechatHistoryMessageFromParsedPart(part, baseMsg, char) {
    if (!part) return null;
    const timestamp = baseMsg && baseMsg.timestamp ? baseMsg.timestamp : createMessageTimestamp();
    const base = { timestamp };
    if (baseMsg && baseMsg.replyTo) base.replyTo = baseMsg.replyTo;
    if (part.kind === 'special') {
        const msg = part.msg ? { ...part.msg } : null;
        if (!msg) return null;
        if (baseMsg && baseMsg.timestamp) msg.timestamp = timestamp;
        else if (!msg.timestamp) msg.timestamp = timestamp;
        return syncWechatMessageDescription(attachWechatGroupSpeaker(msg, char, 0));
    }
    const content = cleanWechatVisibleContent(part.content || '');
    if (!content) return null;
    if (shouldDropWechatAiPipeStatusPayload(content, char)) return null;
    if (part.kind === 'narration') {
        return {
            ...base,
            type: 'offline_narration',
            isMe: false,
            content: normalizeWechatOfflineNarrationText(content),
            description: ''
        };
    }
    const stickerMsg = buildWechatStickerMessageFromAiText(content, char);
    if (stickerMsg && stickerMsg.content) {
        return attachWechatGroupSpeaker({
            ...stickerMsg,
            timestamp: stickerMsg.timestamp || timestamp
        }, char, 0);
    }
    return attachWechatGroupSpeaker({
        ...base,
        type: 'text',
        isMe: false,
        content,
        description: ''
    }, char, 0);
}

function isWechatAutoImageNarrationText(text, char) {
    return !!buildWechatAutoImageMessageFromText(text, char);
}

function shouldRetryWechatImageDirectiveResponse(content, char) {
    const source = cleanWechatVisibleContent(content);
    if (!source || hasWechatAiDirectiveSource(source)) return false;
    return splitWechatAiResponseSegments(source, char).some(part => buildWechatAutoImageMessageFromText(part, char));
}

function shouldMigrateWechatMixedAiHistoryMessage(msg) {
    if (!msg || msg.isMe || msg.type === 'system_notice') return false;
    const type = msg.type || 'text';
    if (!['text', 'offline_narration'].includes(type)) return false;
    const raw = cleanWechatVisibleContent(msg.content || msg.description || '');
    if (!raw) return false;
    if (hasWechatUnclosedDirectiveTail(raw)) return true;
    if (hasWechatAiDirectiveSource(raw)) return true;
    if (/^\s*\]/.test(raw)) return true;
    if (/\[(?:语音通话|视频通话)\]/.test(raw)) return true;
    if (/[\[【](?:微信旁白|旁白)[\]】]/.test(raw)) return true;
    if (/[\[【](?:微信监控|开启监控|关闭监控|微信改备注|微信改用户备注|微信改群头衔|微信改群昵称|微信改群名|微信表情|微信图片|微信照片|微信语音|微信引用|微信转账|微信红包|微信礼物|微信亲密付|微信拍一拍|拍一拍|微信震动|震动屏幕|微信音乐|音乐卡片|微信链接|链接卡片|微信朋友圈|微信删除联系人|QQ群头衔|群头衔|QQ群昵称|微信群昵称|群昵称|QQ群名|微信群名|群聊名称|群名称|群名|QQ改群名|群邀请|群拉人|微信群邀请|QQ群邀请|群NPC|群npc|群聊发言|微信群聊)[：:]/.test(raw)) return true;
    if (isWechatAutoImageNarrationText(raw, null)) return true;
    return type === 'offline_narration' && looksLikeWechatRichOrRegexSource(raw, null);
}

function queueWechatPendingImageGeneration(char, msg) {
    if (!char || !msg || msg.type !== 'image' || !msg.imagePending || msg.imageResolving) return;
    msg.imageResolving = true;
    resolveWechatAiGeneratedImage(char, msg).catch(e => {
        msg.imageResolving = false;
        console.warn('ai image generation failed:', e);
    });
}

function migrateWechatMixedAiHistory(char) {
    if (!char || !Array.isArray(char.history)) return false;
    let changed = false;
    const nextHistory = [];
    let pending = null;

    const flushPending = () => {
        if (!pending) return;
        const combined = pending.parts.join('\n').trim();
        const parsedParts = parseWechatAiMessageParts(combined, char);
        if (parsedParts.length) {
            parsedParts.forEach(part => {
                const msg = buildWechatHistoryMessageFromParsedPart(part, pending.base, char);
                if (msg) nextHistory.push(msg);
            });
        } else {
            nextHistory.push({ ...pending.base, content: combined });
        }
        pending = null;
        changed = true;
    };

    char.history.forEach(msg => {
        if (!msg) return;

        if (pending) {
            if (!msg.isMe && (msg.type || 'text') === 'text' && /^\s*\]/.test(cleanWechatVisibleContent(msg.content || msg.description || ''))) {
                const raw = cleanWechatVisibleContent(msg.content || msg.description || '');
                pending.parts.push(raw.replace(/^\s*\]\s*/, ']'));
                flushPending();
                return;
            }
            flushPending();
        }

        if (!shouldMigrateWechatMixedAiHistoryMessage(msg)) {
            nextHistory.push(msg);
            return;
        }

        const raw = cleanWechatVisibleContent(msg.content || msg.description || '');
        if (hasWechatUnclosedDirectiveTail(raw)) {
            pending = { base: { ...msg, type: 'text', isMe: false, description: '' }, parts: [raw] };
            changed = true;
            return;
        }

        const parsedParts = parseWechatAiMessageParts(raw, char);
        const nextMsgs = parsedParts
            .map(part => buildWechatHistoryMessageFromParsedPart(part, msg, char))
            .filter(Boolean);
        if (!nextMsgs.length) {
            nextHistory.push(msg);
            return;
        }

        if (nextMsgs.length !== 1
            || nextMsgs[0].type !== msg.type
            || cleanWechatVisibleContent(nextMsgs[0].content || nextMsgs[0].description || '') !== raw) {
            changed = true;
        }
        nextHistory.push(...nextMsgs);
    });

    flushPending();
    if (changed) char.history = nextHistory;
    return changed;
}

// When the model echoed 【消息时间：…】 after every line, each line ended in 】 and the whole reply was
// saved as narration. Real offline replies always mix narration with dialogue, so a reply with several
// narration parts, no plain text and no narration-like part is that bug: restore its parts as text.
function repairWechatAllNarrationReplies(char) {
    const history = char.history;
    let changed = false;
    for (let start = 0; start < history.length;) {
        let end = start;
        while (end < history.length && history[end] && !history[end].isMe && history[end].type !== 'system_notice') end += 1;
        const run = history.slice(start, end);
        const narration = run.filter(msg => msg.type === 'offline_narration');
        const looksMisread = narration.length >= 2
            && !run.some(msg => (msg.type || 'text') === 'text')
            && narration.every(msg => !isWechatOfflineNarrationSentence(cleanWechatVisibleContent(msg.content || msg.description || '')));
        if (looksMisread) {
            for (let i = start; i < end; i += 1) {
                const msg = history[i];
                if (msg.type !== 'offline_narration') continue;
                history[i] = { ...msg, type: 'text', content: cleanWechatVisibleContent(msg.content || msg.description || ''), description: '' };
            }
            changed = true;
        }
        start = Math.max(end, start + 1);
    }
    return changed;
}

function migrateWechatNarrationHistory(char) {
    if (!char || !Array.isArray(char.history)) return false;
    let changed = repairWechatAllNarrationReplies(char);
    const nextHistory = [];
    let richBuffer = null;
    const flushRichBuffer = () => {
        if (!richBuffer) return;
        const content = normalizeWechatMergedRichContent(richBuffer.parts);
        if (content) {
            nextHistory.push({
                ...richBuffer.base,
                type: 'text',
                isMe: false,
                content,
                description: ''
            });
        }
        richBuffer = null;
        changed = true;
    };
    char.history.forEach(msg => {
        if (!msg) return;
        if (richBuffer) {
            if (!msg.isMe && ['offline_narration', 'text'].includes(msg.type || 'text')) {
                const piece = msg.content || msg.description || '';
                if (hasWechatRichTag(piece) || /^\s*[^<\n]{1,220}\|[^\n]*/.test(String(piece))) {
                    richBuffer.parts.push(piece);
                    if (isWechatRichFragmentComplete(richBuffer.parts.join('\n'))) flushRichBuffer();
                    return;
                }
            }
            flushRichBuffer();
        }
        if (msg.type === 'offline_narration') {
            const rawNarration = String(msg.content || msg.description || '');
            if (hasWechatRichTag(rawNarration)) {
                richBuffer = {
                    base: {
                        ...msg,
                        type: 'text',
                        description: ''
                    },
                    parts: [rawNarration]
                };
                if (isWechatRichFragmentComplete(rawNarration)) flushRichBuffer();
                changed = true;
                return;
            }
            // Dialogue that ended in an echoed 【消息时间：…】 label was misread as narration; restore it as text.
            if (/[【\[]\s*消息时间\s*[：:]/.test(rawNarration)) {
                const dialogue = cleanWechatVisibleContent(rawNarration);
                if (dialogue && !isWechatOfflineNarrationSentence(dialogue)) {
                    nextHistory.push({ ...msg, type: 'text', isMe: false, content: dialogue, description: '' });
                    changed = true;
                    return;
                }
            }
            const normalized = normalizeWechatOfflineNarrationText(rawNarration);
            if (!normalized) {
                changed = true;
                return;
            }
            nextHistory.push({
                ...msg,
                type: 'offline_narration',
                isMe: false,
                content: normalized,
                description: ''
            });
            changed = true;
            return;
        }
        if (!msg.isMe && (msg.type || 'text') === 'text') {
            const raw = cleanWechatVisibleContent(msg.content || '');
            if (/^\s*\[(?:微信旁白|旁白)\]\s*$/i.test(raw)) {
                changed = true;
                return;
            }
            if (/^\s*(?:\[(?:微信旁白|旁白)\]|(?:微信旁白|旁白)\s*[：:])/.test(raw)) {
                const normalized = normalizeWechatOfflineNarrationText(raw);
                if (!normalized) {
                    changed = true;
                    return;
                }
                msg = {
                    ...msg,
                    type: 'offline_narration',
                    isMe: false,
                    content: normalized,
                    description: ''
                };
                changed = true;
            }
        }
        nextHistory.push(msg);
    });
    flushRichBuffer();
    if (changed) char.history = nextHistory;
    return changed;
}

function splitWechatSentenceChunks(text, maxLength = 92) {
    const source = cleanWechatVisibleContent(text);
    if (!source) return [];
    const sentences = source.match(/[^。！？!?；;]+[。！？!?；;]?|[\s\S]+$/g) || [source];
    const chunks = [];
    let current = '';
    sentences.forEach(sentence => {
        const next = sentence.trim();
        if (!next) return;
        if ((current + next).length > maxLength && current) {
            chunks.push(current.trim());
            current = next;
        } else {
            current += next;
        }
    });
    if (current.trim()) chunks.push(current.trim());
    return chunks.length ? chunks : [source];
}

function isWechatOfflineNarrationSentence(text) {
    const source = String(text || '').trim();
    if (!source) return false;
    // Only a leading bracket marks narration; dialogue often ends with （笑） or 【…】.
    if (/^[*（(【\[]/.test(source)) return true;
    if (/^(旁白|动作|场景|镜头|环境)[：:]/.test(source)) return true;
    if (/[他她]|[A-Za-z\u4e00-\u9fa5]{1,12}/.test(source) && /(抬眼|垂眼|低头|靠近|退开|伸手|握住|松开|停下|走近|坐下|起身|笑了|皱眉|沉默|呼吸|窗外|灯光|雨声|房间|空气|指尖|视线|肩膀|衣角|门口)/.test(source)) return true;
    return false;
}

function splitWechatOfflinePlainText(content, char) {
    const source = normalizeWechatRegexPayloadSource(cleanWechatVisibleContent(content), char);
    if (!source) return [];
    if (isWechatStandaloneRichOrRegexSource(source, char)) return [{ kind: 'text', content: source }];
    const mode = getWechatChatPresenceMode(char);
    const shouldSplit = mode === 'offline'
        || source.length > 120
        || /\r?\n/.test(source)
        || (mode === 'auto' && (source.length > 90 || /[“「『][\s\S]+[”」』]/.test(source) || isWechatOfflineNarrationSentence(source)));
    if (!shouldSplit) return [{ kind: 'text', content: source }];

    const parts = [];
    const paragraphs = source.split(/\n{2,}|\r?\n/).map(item => item.trim()).filter(Boolean);
    const sources = paragraphs.length ? paragraphs : [source];
    sources.forEach(paragraph => {
        let cursor = 0;
        const quoteRe = /[“「『]([^”」』]{1,260})[”」』]/g;
        let match;
        let hadQuote = false;
        while ((match = quoteRe.exec(paragraph)) !== null) {
            hadQuote = true;
            const before = paragraph.slice(cursor, match.index).trim();
            splitWechatSentenceChunks(before).forEach(chunk => pushWechatSplitTextPart(parts, 'narration', chunk));
            splitWechatSentenceChunks(match[1]).forEach(chunk => pushWechatSplitTextPart(parts, 'text', chunk));
            cursor = quoteRe.lastIndex;
        }
        const rest = paragraph.slice(cursor).trim();
        if (hadQuote) {
            splitWechatSentenceChunks(rest).forEach(chunk => pushWechatSplitTextPart(parts, 'narration', chunk));
            return;
        }
        splitWechatSentenceChunks(paragraph, mode === 'offline' ? 82 : 118).forEach(chunk => {
            pushWechatSplitTextPart(parts, isWechatOfflineNarrationSentence(chunk) ? 'narration' : 'text', chunk);
        });
    });
    const output = parts.length ? parts : [{ kind: 'text', content: source }];
    if (!/\r?\n/.test(source)) return output;
    // A paragraph/newline can also become consecutive chat bubbles. Keep the
    // final full stop for the last bubble, but avoid book-like stops in the
    // middle of the same response.
    return output.map((part, index) => index === output.length - 1 || part.kind !== 'text'
        ? part
        : { ...part, content: String(part.content || '').replace(/。\s*$/, '') });
}

function buildWechatStickerDirectiveMessageFromText(text, char) {
    const source = cleanWechatVisibleContent(text);
    const match = source.match(/^\s*[\[【](?:微信表情|发送了表情)\s*[：:]\s*([\s\S]+?)[\]】]\s*$/);
    return match ? buildWechatMessageFromAiDirective('微信表情', match[1], char) : null;
}

function buildWechatLooseStickerDirectiveMessageFromText(text, char) {
    const source = cleanWechatVisibleContent(text);
    const match = source.match(/^\s*[\[【](?:微信表情|表情|发送了表情)\s*[：:]\s*([^\]】\r\n]{1,120})[\]】]?\s*$/);
    if (!match) return null;
    const query = String(match[1] || '').trim();
    if (!query) return null;
    return buildWechatMessageFromAiDirective('微信表情', query, char);
}

function buildWechatImplicitStickerMessageFromText(text, char) {
    const source = cleanWechatVisibleContent(text);
    if (!/^[^\s<>"'`|]{1,48}\.(?:png|jpe?g|gif|webp)$/i.test(source)) return null;
    const sticker = findWechatExactStickerByName(char, source);
    if (!sticker || !sticker.url) return null;
    const isEmoji = sticker.emoji || sticker.source === 'wechatEmoji' || sticker.source === 'qqEmoji' || isWechatBuiltinEmojiUrl(sticker.url);
    return {
        type: 'sticker',
        isMe: false,
        content: sticker.url,
        stickerName: sticker.name || source.replace(/\.(?:png|jpe?g|gif|webp)$/i, '') || '贴纸',
        stickerKind: isEmoji ? 'wechatEmoji' : 'sticker',
        emoji: !!isEmoji,
        timestamp: createMessageTimestamp()
    };
}

function buildWechatStickerMessageFromAiText(text, char) {
    return buildWechatStickerDirectiveMessageFromText(text, char)
        || buildWechatLooseStickerDirectiveMessageFromText(text, char)
        || buildWechatImplicitStickerMessageFromText(text, char);
}

function isWechatIndexInsideRanges(index, ranges) {
    return ranges.some(range => index >= range.start && index < range.end);
}

function getWechatAiParseEvents(source) {
    const text = String(source || '');
    const richRanges = getWechatRichCandidateRanges(text).map(range => ({
        type: 'rich',
        start: range.start,
        end: range.end
    }));
    const events = [...richRanges];
    for (let i = 0; i < text.length; i += 1) {
        if (isWechatIndexInsideRanges(i, richRanges)) continue;
        const event = readWechatAiDirectiveAt(text, i);
        if (!event) continue;
        events.push(event);
        i = Math.max(i, event.end - 1);
    }
    return events.sort((a, b) => a.start - b.start || (a.type === 'rich' ? -1 : 1));
}

function appendWechatNarrationContentParts(target, content, char) {
    const source = cleanWechatVisibleContent(content);
    if (!source) return;
    if (isWechatStandaloneRichOrRegexSource(source, char)) {
        target.push({ kind: 'text', content: source });
        return;
    }
    splitWechatSentenceChunks(normalizeWechatOfflineNarrationText(source), 92)
        .forEach(chunk => pushWechatNarrationPart(target, chunk));
}

function appendWechatDirectivePart(target, command, args, char) {
    if (command === '旁白' || command === '微信旁白') {
        const msg = buildWechatMessageFromAiDirective(command, args, char);
        if (!msg) return;
        if (msg.type === 'offline_narration') {
            pushWechatNarrationPart(target, msg.content || msg.description || '');
        } else {
            appendWechatPlainAiTextParts(target, msg.content || msg.description || '', char);
        }
        return;
    }
    if (command === '微信改备注') {
        const msg = applyWechatNicknameDirective(args, char);
        if (msg) target.push({ kind: 'special', msg });
        return;
    }
    if (isWechatProactiveNotifyIntervalDirectiveCommand(command)) {
        const msg = applyWechatProactiveNotifyIntervalDirective(args, char);
        if (msg) target.push({ kind: 'special', msg });
        return;
    }
    if (command === '微信监控' || command === '开启监控' || command === '关闭监控') {
        const msg = applyWechatMonitorDirective(command, args, char);
        if (msg) target.push({ kind: 'special', msg });
        return;
    }
    if (command === '微信朋友圈') {
        const msg = applyWechatCharMomentDirective(args, char);
        if (msg) target.push({ kind: 'special', msg });
        return;
    }
    if (command === '微信删除联系人') {
        const msg = applyWechatContactDeleteDirective(args, char);
        if (msg) target.push({ kind: 'special', msg });
        return;
    }
    const msg = buildWechatMessageFromAiDirective(command, args, char);
    if (msg) target.push({ kind: 'special', msg });
}

function migrateWechatStickerDirectiveHistory(char) {
    if (!char || !Array.isArray(char.history)) return false;
    let changed = false;
    const nextHistory = [];
    for (let i = 0; i < char.history.length; i += 1) {
        const msg = char.history[i];
        if (!msg || msg.isMe || msg.type !== 'text') {
            nextHistory.push(msg);
            continue;
        }
        const raw = cleanWechatVisibleContent(msg.content || msg.description || '');
        if (/^\]\s*$/.test(raw)) {
            changed = true;
            continue;
        }
        const stickerMsg = buildWechatStickerMessageFromAiText(raw, char);
        if (!stickerMsg || !stickerMsg.content) {
            const voiceMsg = parseWechatLegacyVoiceMessage(raw);
            if (voiceMsg) {
                nextHistory.push({
                    ...msg,
                    type: 'voice',
                    duration: voiceMsg.duration,
                    transcript: voiceMsg.transcript || '',
                    content: voiceMsg.content,
                    description: ''
                });
                changed = true;
                continue;
            }
            nextHistory.push(msg);
            continue;
        }
        const nextMsg = char.history[i + 1];
        const nextRaw = cleanWechatVisibleContent(nextMsg && !nextMsg.isMe && nextMsg.type === 'text' ? (nextMsg.content || nextMsg.description || '') : '');
        nextHistory.push({
            ...msg,
            type: 'sticker',
            content: stickerMsg.content,
            stickerName: stickerMsg.stickerName || msg.stickerName || msg.name || '贴纸',
            stickerKind: stickerMsg.stickerKind,
            emoji: !!stickerMsg.emoji,
            description: ''
        });
        if (/^\]\s*$/.test(nextRaw)) i += 1;
        changed = true;
    }
    if (changed) char.history = nextHistory;
    return changed;
}

function pruneWechatLeakedCallSummaryMessages(char) {
    if (!char || !Array.isArray(char.history)) return false;
    const before = char.history.length;
    char.history = char.history.filter(msg => {
        if (!msg || msg.isMe) return true;
        const text = cleanWechatVisibleContent(msg.content || msg.description || '');
        if (isWechatLeakedCallHistorySummary(text)) return false;
        if ((msg.type === 'voiceCall' || msg.type === 'videoCall') && /(?:角色发起，用户处理|用户发起，角色处理)|^\[历史通话记录\]/.test(text)) return false;
        return true;
    });
    return char.history.length !== before;
}

function repairWechatSplitPipeStatusHistory(char) {
    if (!char || !Array.isArray(char.history)) return false;
    let changed = false;
    const nextHistory = [];
    const textOf = msg => {
        if (!msg || msg.isMe || msg.type === 'system_notice') return '';
        if (!['text', 'offline_narration'].includes(msg.type || 'text')) return '';
        return cleanWechatVisibleContent(msg.content || msg.description || '');
    };
    const timeOf = msg => {
        const n = Number(msg && (msg.timestamp || msg.createdAt || msg.time));
        return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const speakerOf = msg => {
        if (!char.isGroupChat) return '';
        const member = getWechatGroupMessageSpeakerMember(char, msg);
        return member?.id || msg?.senderId || msg?.speakerId || msg?.senderName || msg?.speakerName || '';
    };

    for (let i = 0; i < char.history.length; i += 1) {
        const msg = char.history[i];
        const raw = textOf(msg);
        const tag = getWechatLeadingPipeStatusTagName(raw);
        const closeRe = tag ? new RegExp(`<\\s*\\/\\s*${escapeWechatRegexLiteral(tag)}\\s*>\\s*$`, 'i') : null;
        if (!tag || !looksLikeWechatPipeStatusPayloadSource(raw) || (closeRe && closeRe.test(raw) && willWechatRegexRenderRich(raw, char))) {
            nextHistory.push(msg);
            continue;
        }

        const parts = [raw];
        let lastMsg = msg;
        let cursor = i + 1;
        while (cursor < char.history.length && parts.length < 12) {
            const nextMsg = char.history[cursor];
            const nextRaw = textOf(nextMsg);
            const lastTime = timeOf(lastMsg);
            const nextTime = timeOf(nextMsg);
            if (!nextRaw || getWechatLeadingPipeStatusTagName(nextRaw)) break;
            if (char.isGroupChat && speakerOf(lastMsg) !== speakerOf(nextMsg)) break;
            if (lastTime && nextTime && Math.abs(nextTime - lastTime) > 5000) break;
            if (hasWechatAiDirectiveSource(nextRaw) && !/^\s*\]/.test(nextRaw)) break;
            parts.push(nextRaw);
            lastMsg = nextMsg;
            cursor += 1;
            const merged = normalizeWechatRegexPayloadSource(parts.join(''), char);
            if (willWechatRegexRenderRich(merged, char) || isWechatRichFragmentComplete(merged)) break;
        }

        const mergedContent = normalizeWechatRegexPayloadSource(parts.join(''), char);
        if (parts.length > 1 || mergedContent !== raw) {
            nextHistory.push({ ...msg, type: 'text', isMe: false, content: mergedContent, description: '' });
            i = cursor - 1;
            changed = true;
        } else {
            nextHistory.push(msg);
        }
    }

    if (changed) char.history = nextHistory;
    return changed;
}

function repairWechatQuoteDirectiveReplyHistory(char) {
    if (!char || !Array.isArray(char.history)) return false;
    let changed = false;
    char.history.forEach((msg, index) => {
        if (!msg || !msg.replyTo) return;
        const parsed = parseWechatAiQuoteDirectiveText(msg.replyTo.text || msg.replyTo.content || '');
        if (!parsed || !parsed.query) return;
        const target = findWechatMessageForAiQuote(char, parsed.query, {
            excludeIndex: index,
            excludeMessage: msg
        });
        const replyTo = target
            ? buildWechatReplySnapshot(target.msg, char, target.index)
            : buildWechatFallbackReplySnapshotFromAiQuote(parsed.query);
        if (!replyTo) return;
        msg.replyTo = replyTo;
        changed = true;
    });
    return changed;
}

function applyWechatNicknameDirective(rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const nextNickname = String(args[0] || '').trim().slice(0, 24);
    if (!nextNickname) return null;

    if (!char.chatConfig) char.chatConfig = {};
    const previous = char.chatConfig.nickname || char.name || '对方';
    if (previous === nextNickname) return null;

    char.chatConfig.nickname = nextNickname;
    updateWechatCurrentChatHeader(char);
    const reason = args.slice(1).join('|').trim();
    return {
        type: 'system_notice',
        isMe: false,
        content: reason
            ? `已修改：${char.name || '对方'}把备注改成了「${nextNickname}」：${reason}`
            : `已修改：${char.name || '对方'}把备注改成了「${nextNickname}」`,
        timestamp: createMessageTimestamp()
    };
}

function splitWechatAiResponseSegments(content, char) {
    let source = cleanWechatVisibleContent(content);
    if (!source) return [];
    // AI 偶发把 [旁白:] 写成 [旁-白:] / [旁 白:] 等变体，统一归一化再解析
    source = source.replace(/([\[【])\s*旁[\s\-‐–—·_]?白\s*([:：])/g, '$1旁白$2');
    // 判定独立卡片/算保护区前，把 2+ 连竖线替换成等长占位符（坐标不变）：
    // 分隔符连击会被误认成管子卡片字段——既不能让整串被当成独立卡片提前返回，
    // 也不能被圈进保护区导致拆分失效
    const sourceForRanges = source.replace(/\|{2,}/g, run => '\u0001'.repeat(run.length));
    if (isWechatStandaloneRichOrRegexSource(sourceForRanges, char) && !hasWechatAiDirectiveSource(source)) return [source];
    const richRanges = getWechatRichCandidateRanges(sourceForRanges);
    const isInsideRichRange = index => richRanges.some(range => index >= range.start && index < range.end);
    const segments = [];
    let buffer = '';
    let quote = null;
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        // 分隔符按"连续 2 根及以上竖线"识别：AI 常少打成 || 或狂打 ||||||，
        // 单根 | 保留（照片卡等格式用它做字段分隔）
        if (!quote && ch === '|' && source[i + 1] === '|' && !isInsideRichRange(i)) {
            let runEnd = i;
            while (source[runEnd] === '|') runEnd += 1;
            if (buffer.trim() && !isWechatAiMetaLeakContent(buffer)) segments.push(buffer.trim());
            buffer = '';
            i = runEnd - 1;
            continue;
        }
        if (!quote && source.slice(i, i + 3) === '```') {
            quote = '```';
            buffer += '```';
            i += 2;
            continue;
        }
        if (quote === '```' && source.slice(i, i + 3) === '```') {
            quote = null;
            buffer += '```';
            i += 2;
            continue;
        }
        if (!quote && (ch === '"' || ch === "'" || ch === '`')) {
            quote = ch;
        } else if (quote === ch) {
            quote = null;
        }
        buffer += ch;
    }
    if (buffer.trim() && !isWechatAiMetaLeakContent(buffer)) segments.push(buffer.trim());
    // 连续短气泡读起来不像书面段落：分隔符前的句号由模型常规补全，
    // 留在每一条气泡末尾会显得生硬。只移除非末条的中文句号；疑问、感叹
    // 和省略语气仍然是角色表达的一部分，必须原样保留。
    return segments.map((segment, index) => index === segments.length - 1
        ? segment
        : segment.replace(/。\s*$/, ''));
}

function getWechatLastAiBatchStartIndex(history, msgIdx) {
    if (!Array.isArray(history) || msgIdx < 0 || msgIdx >= history.length) return msgIdx;
    let start = msgIdx;
    for (let i = msgIdx - 1; i >= 0; i -= 1) {
        const msg = history[i];
        if (!msg || msg.isMe || msg.type === 'system_notice' || msg.monitorEvent) break;
        start = i;
    }
    return start;
}

function applyWechatUserTitleDirective(rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const nextTitle = String(args[0] || '').trim().slice(0, 24);
    if (!nextTitle) return null;
    char.chatConfig = char.chatConfig || {};
    const previous = char.chatConfig.userTitle || '我';
    if (previous === nextTitle) return null;
    char.chatConfig.userTitle = nextTitle;
    const reason = args.slice(1).join('|').trim();
    return {
        type: 'system_notice',
        isMe: false,
        content: reason
            ? `已修改：${getWechatCharDisplayName(char)}把对你的称呼改成了「${nextTitle}」：${reason}`
            : `已修改：${getWechatCharDisplayName(char)}把对你的称呼改成了「${nextTitle}」`,
        timestamp: createMessageTimestamp()
    };
}

function isWechatProactiveNotifyIntervalDirectiveCommand(command) {
    return command === '微信后台时间'
        || command === '微信后台消息时间'
        || command === '后台消息时间'
        || command === '后台提醒时间';
}

function applyWechatProactiveNotifyIntervalDirective(rawArgs, char) {
    if (!char || typeof window.applyProactiveNotifyIntervalByChar !== 'function') return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const intervalValue = args[0] || '';
    if (!intervalValue) return null;
    const reason = args.slice(1).join('|').trim();
    const result = window.applyProactiveNotifyIntervalByChar(char, intervalValue, reason);
    if (!result || !result.ok) return null;
    showWechatNotifyIntervalIsland(char, result.intervalLabel, result.reason || reason);
    return {
        type: 'system_notice',
        isMe: false,
        content: result.reason
            ? `${getWechatCharDisplayName(char)} 将后台消息时间改为「${result.intervalLabel}」：${result.reason}`
            : `${getWechatCharDisplayName(char)} 将后台消息时间改为「${result.intervalLabel}」`,
        timestamp: createMessageTimestamp()
    };
}

function normalizeWechatMonitorDirectiveMode(command, rawMode) {
    const commandText = String(command || '');
    const text = String(rawMode || '').trim().toLowerCase();
    if (/关闭/.test(commandText) || /^(关|关闭|off|false|0|disable|disabled)$/.test(text)) return { enabled: false, mode: 'persona' };
    if (/第三|上帝|磕糖|观众|吐槽|弹幕|observer|god|cp/.test(text)) return { enabled: true, mode: 'observer' };
    return { enabled: true, mode: 'persona' };
}

function applyWechatMonitorDirective(command, rawArgs, char) {
    if (!char) return null;
    const args = splitWechatDirectiveArgs(rawArgs);
    const state = normalizeWechatMonitorDirectiveMode(command, args[0] || '');
    const reason = args.slice(1).join('|').trim();
    char.chatConfig = char.chatConfig || {};
    const label = WECHAT_MONITOR_MODE_LABELS[state.mode] || WECHAT_MONITOR_MODE_LABELS.persona;

    if (!state.enabled) {
        char.chatConfig.monitorEnabled = false;
        char.chatConfig.monitorMode = state.mode;
        char.chatConfig.monitorChangedByCharAt = Date.now();
        if (reason) char.chatConfig.monitorReason = reason;
        if (typeof updateWechatChatSettings === 'function') updateWechatChatSettings(char);
        return {
            type: 'system_notice',
            isMe: false,
            content: reason ? `已修改：监控剧情已关闭：${reason}` : '已修改：监控剧情已关闭',
            timestamp: createMessageTimestamp()
        };
    }

    const request = {
        id: `monitor_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        enabled: true,
        mode: state.mode,
        reason,
        requestedAt: Date.now()
    };
    char.chatConfig.pendingMonitorRequest = request;
    if (window.currentChatCharId === char.id && typeof showWechatMonitorRequestModal === 'function') {
        setTimeout(() => showWechatMonitorRequestModal(char.id, request.id), 0);
    }
    return {
        type: 'system_notice',
        isMe: false,
        monitorRequestId: request.id,
        content: reason
            ? `${getWechatCharDisplayName(char)}想要开启监控（${label}）：${reason}`
            : `${getWechatCharDisplayName(char)}想要开启监控（${label}）`,
        timestamp: createMessageTimestamp()
    };
}

