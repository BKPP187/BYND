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
                            try { 
                                const raw = JSON.parse(jsonStr);
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
                                charData = {
                                    name: d.name,
                                    description: this.buildDescription(d),
                                    first_mes: d.first_mes,
                                    alternates: d.alternate_greetings || [],
                                    avatar: "", 
                                    worldBook: this.normalizeWorldBook(characterBook),
                                    regex: normalizedScripts 
                                };
                            } catch(e) { console.error("JSON解析失败", e); }
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

