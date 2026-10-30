// --- B. PNG 解析器 ---
const CharacterCardParser = {
    decodeBase64ToUtf8: function(base64) {
        try {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) { return null; }
    },

    findField: function(obj, targets) {
        if (!obj || typeof obj !== 'object') return null;
        const keys = Object.keys(obj);
        for (let target of targets) {
            if (obj[target] !== undefined) return obj[target];
            const lowerTarget = target.toLowerCase();
            const foundKey = keys.find(k => k.toLowerCase() === lowerTarget);
            if (foundKey) return obj[foundKey];
        }
        return null;
    },

    stringifyField: function(value) {
        if (value == null) return '';
        if (Array.isArray(value)) return value.map(item => this.stringifyField(item)).filter(Boolean).join('\n');
        if (typeof value === 'object') {
            if (value.content || value.text || value.value || value.entry) {
                return String(value.content || value.text || value.value || value.entry || '').trim();
            }
            try { return JSON.stringify(value); } catch (_) { return ''; }
        }
        return String(value).trim();
    },

    buildDescription: function(data) {
        const fields = [
            ['description', '角色描述'],
            ['personality', '性格'],
            ['scenario', '场景'],
            ['mes_example', '对话样例'],
            ['system_prompt', '系统提示词'],
            ['post_history_instructions', '后置指令'],
            ['creator_notes', '作者备注'],
            ['character_note', '角色备注']
        ];
        const parts = [];
        fields.forEach(([key, label]) => {
            const value = this.stringifyField(this.findField(data, [key]));
            if (value) parts.push(`【${label}】\n${value}`);
        });
        return parts.join('\n\n') || this.stringifyField(this.findField(data, ['description']));
    },

    normalizeWorldBook: function(value) {
        const book = value && value.entries ? value.entries : value;
        if (!Array.isArray(book)) return [];
        return book.map(entry => {
            if (!entry || typeof entry !== 'object') return null;
            return {
                ...entry,
                key: entry.key || entry.keys || entry.name || entry.title || '',
                content: entry.content || entry.text || entry.entry || entry.value || entry.comment || ''
            };
        }).filter(entry => entry && entry.content);
    },

    // Shared by PNG tEXt cards and plain JSON cards (V1/V2/V3 and BYND exports).
    fromCardObject: function(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const d = raw.data || raw; 

        let searchTargets = [raw];
        if (raw.data) searchTargets.push(raw.data);
        searchTargets.forEach(target => {
            if (target.extensions && typeof target.extensions === 'string') {
                try { target.extensions = JSON.parse(target.extensions); } catch(e) {}
            }
        });

        let rawScripts = [];

        function findRegexArray(obj, depth = 0) {
            if (depth > 6 || !obj || typeof obj !== 'object') return null;
            const keys = Object.keys(obj);
            const scriptKey = keys.find(k => k.toLowerCase() === 'regex_scripts' || k.toLowerCase() === 'regexscripts');
            if (scriptKey && Array.isArray(obj[scriptKey])) return obj[scriptKey];

            for (let key in obj) {
                if (['character_book', 'history', 'story_string', 'alternate_greetings'].includes(key)) continue;
                const val = obj[key];
                if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
                    const firstKeys = Object.keys(val[0]).map(k => k.toLowerCase());
                    if (firstKeys.some(k => k.includes('regex') || k.includes('pattern'))) {
                        return val;
                    }
                } else if (typeof val === 'object') {
                    const found = findRegexArray(val, depth + 1);
                    if (found) return found;
                }
            }
            return null;
        }

        const found = findRegexArray(raw);
        if (found) rawScripts = found;

        const normalizedScripts = rawScripts.map((s, idx) => {
            const get = (arr) => this.findField(s, arr) || "";
            return {
                name: get(['scriptName', 'name', 'label']) || `Script #${idx+1}`,
                regex: get(['findRegex', 'regex', 'regex_pattern', 'regexPattern', 'pattern']), 
                replace: get(['replaceString', 'regexReplace', 'replace', 'replacement', 'substituteRegex']),
                placement: "Global"
            };
        }).filter(s => s.regex && s.regex.trim() !== "");

        const characterBook = this.findField(d, ['character_book', 'characterBook'])
            || this.findField(raw, ['character_book', 'characterBook']);
        const result = {
            name: d.name,
            description: this.buildDescription(d),
            first_mes: d.first_mes,
            alternates: d.alternate_greetings || [],
            avatar: "", 
            worldBook: this.normalizeWorldBook(characterBook),
            regex: normalizedScripts 
        };

        // Cards exported by BYND carry the original description and chat profile untouched.
        const bynd = d && d.extensions && d.extensions.bynd;
        if (bynd && typeof bynd === 'object') {
            if (typeof bynd.description === 'string' && bynd.description.trim()) result.description = bynd.description;
            if (bynd.chatConfig && typeof bynd.chatConfig === 'object' && !Array.isArray(bynd.chatConfig)) result.chatConfig = bynd.chatConfig;
            if (typeof bynd.first_mes === 'string') result.first_mes = bynd.first_mes;
        }
        return result.name || result.description ? result : null;
    },

    parseJsonText: function(text) {
        const raw = JSON.parse(String(text || '').trim());
        return this.fromCardObject(raw);
    },

    parse: function(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        if (dataView.getUint32(0) !== 0x89504E47) throw new Error("不是 PNG");

        let offset = 8;
        let charData = null;
        let decoder = new TextDecoder('utf-8');

        while (offset < arrayBuffer.byteLength) {
            const length = dataView.getUint32(offset);
            let type = '';
            for(let i=0; i<4; i++) type += String.fromCharCode(dataView.getUint8(offset + 4 + i));
            
            if (type === 'tEXt' || type === 'iTXt') {
                const contentBytes = new Uint8Array(arrayBuffer, offset + 8, length);
                let nullIndex = -1;
                for(let i=0; i<length; i++) { if(contentBytes[i]===0){ nullIndex=i; break; } }
                
                if (nullIndex > -1) {
                    const key = decoder.decode(contentBytes.slice(0, nullIndex));
                    if (key === 'chara') {
                        let jsonStr = null;
                        if (type === 'tEXt') {
                            const val = decoder.decode(contentBytes.slice(nullIndex + 1));
                            jsonStr = this.decodeBase64ToUtf8(val);
                        } else {
                            const raw = decoder.decode(contentBytes);
                            const idx = raw.indexOf('eyJ'); 
                            if (idx > -1) jsonStr = this.decodeBase64ToUtf8(raw.slice(idx));
                        }
                        
                        if (jsonStr) {
                            try { charData = this.fromCardObject(JSON.parse(jsonStr)); }
                            catch(e) { console.error("JSON解析失败", e); }
                        }
                    }
                }
            }
            if (charData) break;
            offset += 4 + 4 + length + 4;
        }
        return charData;
    }
};

function getWechatCharacterGreetingContent(char) {
    const raw = String(char.first_mes || '').trim();
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    return raw
        .replace(/\{\{char\}\}/gi, char.name || '')
        .replace(/\{\{user\}\}/gi, (profile && profile.name) || '我');
}

// Card text is authored content: split it without running AI directives or
// rewriting narration. Keep rich/regex cards intact for their own renderer.
function splitWechatCharacterGreeting(content, char) {
    const source = String(content || '').trim();
    if (!source) return [];
    if ((typeof isWechatStandaloneRichOrRegexSource === 'function' && isWechatStandaloneRichOrRegexSource(source, char))
        || (typeof getWechatRichCandidateRanges === 'function' && getWechatRichCandidateRanges(source).length)) {
        return [{ type: 'text', content: source }];
    }
    const sections = [];
    let rest = source;
    // Classify the whole parenthesized scene before splitting it, so subsequent
    // chunks and paragraphs retain the same narration type as the first one.
    while (/^[（(]/.test(rest)) {
        const closers = [];
        let end = -1;
        for (let i = 0; i < rest.length; i += 1) {
            if (rest[i] === '（') closers.push('）');
            else if (rest[i] === '(') closers.push(')');
            else if (rest[i] === closers[closers.length - 1]) closers.pop();
            if (!closers.length) { end = i + 1; break; }
        }
        if (end < 0) break;
        sections.push({ type: 'offline_narration', content: rest.slice(0, end) });
        rest = rest.slice(end).trim();
    }
    if (rest) sections.push({ type: 'text', content: rest });
    return sections.flatMap(section => {
        const segments = typeof splitWechatAiResponseSegments === 'function'
            ? splitWechatAiResponseSegments(section.content, char) : [section.content];
        return segments.flatMap(segment => segment.split(/\r?\n+/).flatMap(paragraph => {
            const chunks = typeof splitWechatSentenceChunks === 'function'
                ? splitWechatSentenceChunks(paragraph, 92) : [paragraph.trim()];
            return chunks.filter(Boolean).map(chunk => ({ type: section.type, content: chunk }));
        }));
    });
}

// 新角色的空聊天以角色卡的开场白开始，和角色卡生成器一致。
function seedWechatCharacterGreeting(char) {
    if (!char || char.isGroupChat || !Array.isArray(char.history) || char.history.length) return false;
    const content = getWechatCharacterGreetingContent(char);
    if (!content) return false;
    const timestamp = Date.now();
    const messages = splitWechatCharacterGreeting(content, char)
        .map(part => ({ ...part, isMe: false, timestamp }));
    if (!messages.length) return false;
    char.history.push(...messages);
    return true;
}
