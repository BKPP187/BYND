// Thai learner transcription retains dictionary tones and vowel length; it never infers tone from a written mark alone.
(() => {
    const cache = new Map();
    const tones = {
        '˧': { number: 1, label: '中平', mark: '' },
        '˨˩': { number: 2, label: '低', mark: '\u0300' },
        '˥˩': { number: 3, label: '降', mark: '\u0302' },
        '˦˥': { number: 4, label: '高', mark: '\u0301' },
        '˩˩˦': { number: 5, label: '升', mark: '\u030c' }
    };
    function soundParts(phonemes, tone) {
        const split = phonemes.match(/^([^aeiouɛɔɯɤ]*)([aeiouɛɔɯɤː]+)([^aeiouɛɔɯɤ]*)$/);
        if (!split) return null;
        const [, onset, vowel, coda] = split;
        const onsets = { t: '不送气，拼读写 dt，接近汉语拼音 d', p: '不送气，拼读写 bp', k: '不送气，拼读写 k', 'tʰ': '送气，拼读写 th', 'pʰ': '送气，拼读写 ph', 'kʰ': '送气，拼读写 kh', 'tɕ': '不送气塞擦音，拼读写 j', 'tɕʰ': '送气塞擦音，拼读写 ch', 'ʔ': '喉塞起音', r: '舌尖 r 音', l: '舌尖 l 音', d: '浊辅音 d', b: '浊辅音 b' };
        const codas = { k: '舌根收住，不爆破', t: '舌尖收住，不爆破', p: '双唇闭住，不爆破', 'ʔ': '短促喉塞收尾', m: '双唇鼻音收尾', n: '舌尖鼻音收尾', 'ŋ': '舌根鼻音收尾', j: '滑向 y 音，不另加元音', w: '滑向 w 音，不另加元音' };
        const vowelCount = vowel.replace(/ː/g, '').length;
        const vowelType = vowelCount > 1 ? '复合元音' : vowel.includes('ː') ? '长元音' : '短元音';
        const start = onset ? `声母 /${onset}/${onsets[onset] ? `（${onsets[onset]}）` : onset.length > 1 ? '，复辅音连在一起起音' : ''}` : '直接从元音起音';
        const middle = `${vowelType} /${vowel}/${vowelType === '长元音' ? '，拉长发出' : vowelType === '短元音' ? '，短读' : '，连成一个音节'}${vowel.includes('ɔ') ? '，ɔ 的开口比 o 大' : ''}`;
        const end = coda ? `尾音 /${coda}/${codas[coda] ? `，${codas[coda]}` : ''}` : '无尾辅音，不另加收尾音';
        const movement = { 1: '音高保持平稳', 2: '在低音位发音', 3: '音高由高向低下降', 4: '在高音位发音', 5: '音高由低向上升' };
        return { onset, vowel, coda, explanation: `${start}；${middle}；${end}；第 ${tone.number} 调（${tone.label}），${movement[tone.number]}。` };
    }
    function spellingToneReason(written, syllable) {
        const first = written.match(/[ก-ฮ]/)?.[0];
        const kind = 'กจฎฏดตบปอ'.includes(first) ? '中' : 'ขฃฉฐถผฝศษสห'.includes(first) ? '高' : 'คฅฆงชซฌญฑฒณทธนพฟภมยรลวฬฮ'.includes(first) ? '低' : '';
        if (!first || !kind || !syllable.parts) return '';
        const mark = written.match(/[่้๊๋]/)?.[0] || '';
        const { vowel, coda } = syllable.parts;
        const dead = ['p', 't', 'k', 'ʔ'].includes(coda);
        const long = vowel.includes('ː') ? true : vowel.length === 1 ? false : null;
        let predicted, condition;
        if (mark) {
            const rules = { 中: { '่': 2, '้': 3, '๊': 4, '๋': 5 }, 高: { '่': 2, '้': 3 }, 低: { '่': 3, '้': 4 } };
            predicted = rules[kind][mark]; condition = `带调号 ${mark}`;
        } else {
            if (!dead && !['', 'm', 'n', 'ŋ', 'j', 'w'].includes(coda)) return '';
            predicted = !dead ? (kind === '高' ? 5 : 1) : kind !== '低' ? 2 : long == null ? null : long ? 3 : 4;
            condition = `无调号，${dead ? `${long === true ? '长元音＋' : long === false ? '短元音＋' : ''}塞尾 /${coda}/` : '舒声音节'}`;
        }
        // Complex spellings or an unsupported rule must not manufacture a rationale for dictionary data.
        if (predicted !== syllable.tone) return '';
        return `起首字母 ${first}（${kind}辅音），${condition}，读第 ${syllable.tone} 调（${syllable.label}）。`;
    }
    function fromIpa(ipa) {
        if (typeof ipa !== 'string' || !/^\/[^/]+\/$/.test(ipa)) return null;
        const syllables = [];
        for (const source of ipa.slice(1, -1).split(/[.\s]+/)) {
            const tone = tones[source.match(/[˥˦˧˨˩]+$/)?.[0]];
            if (!tone) return null;
            const phonemes = source.replace(/[ˈˌ˥˦˧˨˩\u0361\u032f\u031a]/g, '');
            const parts = soundParts(phonemes, tone);
            // Some dictionary loanwords retain a final /s/ or /l/. Keep the source
            // sound, but reject arbitrary trailing strings masquerading as IPA.
            if (!parts || !['', 'k', 't', 'p', 'ʔ', 'm', 'n', 'ŋ', 'j', 'w', 's', 'l'].includes(parts.coda)) return null;
            // dt/bp are unaspirated onsets; final t/p stay t/p. th/ph/kh keep aspiration.
            let text = phonemes.replace(/j/g, 'y').replace(/^t(?![ɕʃʰ])/, 'dt').replace(/^p(?!ʰ)/, 'bp')
                .replace(/t[ɕʃ]ʰ/g, 'ch').replace(/t[ɕʃ]/g, 'j').replace(/ŋ/g, 'ng').replace(/ɲ/g, 'ny')
                .replace(/ʰ/g, 'h').replace(/([aeiouɛɔɯɤ])ː/g, '$1$1');
            if (!/^[a-zɛɔɯɤʔ]+$/.test(text) || !/[aeiouɛɔɯɤ]/.test(text)) return null;
            text = text.replace(/[aeiouɛɔɯɤ]/, vowel => vowel + tone.mark).normalize('NFC');
            syllables.push({ text, tone: tone.number, label: tone.label, ipa: source, parts: { onset: parts.onset, vowel: parts.vowel, coda: parts.coda }, explanation: parts.explanation });
        }
        return { text: syllables.map(item => item.text).join(' '), ipa, syllables };
    }
    function alignWrittenSyllables(run, syllables, dictionary) {
        const memo = new Map(), parsed = new Map();
        const keyOf = value => value.replace(/[ˈˌ\u0361\u032f\u031a]/g, '');
        function visit(offset, index) {
            if (offset === run.length) return index === syllables.length ? { score: 0, segments: [] } : null;
            if (index >= syllables.length) return null;
            const key = offset + ':' + index;
            if (memo.has(key)) return memo.get(key);
            let best = null;
            for (let end = offset + 1; end <= Math.min(run.length, offset + 60); end++) {
                const written = run.slice(offset, end), ipa = dictionary[written];
                if (!ipa) continue;
                if (!parsed.has(ipa)) parsed.set(ipa, fromIpa(ipa));
                const candidate = parsed.get(ipa), count = candidate?.syllables.length;
                if (!count || index + count > syllables.length || !candidate.syllables.every((item, part) => keyOf(item.ipa) === keyOf(syllables[index + part].ipa))) continue;
                const tail = visit(end, index + count);
                if (!tail) continue;
                const score = tail.score + (count === 1 ? 1 : 0);
                if (!best || score > best.score) best = { score, segments: [{ written, index, count }, ...tail.segments] };
            }
            memo.set(key, best); return best;
        }
        for (const segment of visit(0, 0)?.segments || []) {
            if (segment.count !== 1) continue;
            const syllable = syllables[segment.index];
            syllable.written = segment.written;
            syllable.toneReason = spellingToneReason(segment.written, syllable);
        }
    }
    function describeThai(text) {
        const input = String(text || '').normalize('NFC').replace(/\u0e4d([\u0e48-\u0e4b]?)\u0e32/g, '$1\u0e33').trim().slice(0, 300);
        const dictionary = window.ByndThaiLexicon;
        if (!dictionary || !/[ก-๛]/.test(input)) return null;
        const classroomReference = window.ByndThaiRules?.referenceReading(input);
        if (classroomReference) return classroomReference;
        if (cache.has(input)) return cache.get(input);
        let missing = false;
        const syllables = [], ipas = [];
        const result = input.replace(/[ก-๛]+/g, run => {
            let parts;
            if (dictionary[run] && fromIpa(dictionary[run])) parts = [dictionary[run]];
            else {
                const paths = new Array(run.length + 1); paths[run.length] = [];
                for (let start = run.length - 1; start >= 0; start--) {
                    for (let end = Math.min(run.length, start + 60); end > start; end--) {
                        const ipa = dictionary[run.slice(start, end)], tail = paths[end];
                        if (ipa && tail && fromIpa(ipa) && (!paths[start] || tail.length + 1 < paths[start].length)) paths[start] = [ipa, ...tail];
                    }
                }
                parts = paths[0];
            }
            const readings = parts?.map(fromIpa);
            if (!readings?.length || readings.some(item => !item)) { missing = true; return ''; }
            const runSyllables = readings.flatMap(item => item.syllables);
            alignWrittenSyllables(run, runSyllables, dictionary);
            syllables.push(...runSyllables);
            for (const item of readings) ipas.push(item.ipa.slice(1, -1));
            return readings.map(item => item.text).join(' ');
        });
        const reading = missing ? null : { text: result.replace(/\s+/g, ' ').trim(), ipa: '/' + ipas.join('.') + '/', syllables };
        if (cache.size >= 1000) cache.clear();
        cache.set(input, reading); return reading;
    }
    function thai(text) { return describeThai(text)?.text || ''; }
    let proofIndex, proofDictionary;
    const suggestionCache = new Map();
    // This lossy key is used ONLY for review suggestions, never for reading a
    // saved word. Shape confusions and missing tone marks can change meaning.
    const proofKey = text => text.replace(/[่้๊๋]/g, '').replace(/[ดตค]/g, 'ด').replace(/[บป]/g, 'บ').replace(/[ชซ]/g, 'ช');
    function editDistance(a, b) {
        let row = Array.from({ length: b.length + 1 }, (_, i) => i);
        for (let i = 0; i < a.length; i++) {
            const next = [i + 1];
            for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)));
            row = next;
        }
        return row[b.length];
    }
    function suggestThai(text) {
        const input = String(text || '').normalize('NFC').replace(/\u0e4d([\u0e48-\u0e4b]?)\u0e32/g, '$1\u0e33').trim();
        const dictionary = window.ByndThaiLexicon;
        if (!dictionary || !/[ก-๛]/.test(input) || input.length > 120 || describeThai(input)) return [];
        if (proofDictionary !== dictionary) {
            proofDictionary = dictionary; proofIndex = new Map(); suggestionCache.clear();
            for (const word of Object.keys(dictionary)) {
                const key = proofKey(word), list = proofIndex.get(key) || [];
                list.push(word); proofIndex.set(key, list);
            }
        }
        if (suggestionCache.has(input)) return suggestionCache.get(input);
        const best = list => {
            const seen = new Set();
            return list.sort((a, b) => a.cost - b.cost || a.parts - b.parts || a.term.localeCompare(b.term, 'th')).filter(item => !seen.has(item.term) && seen.add(item.term)).slice(0, 5);
        };
        let phrases = [{ term: '', cost: 0, parts: 0 }];
        for (const run of input.match(/[ก-๛]+|[^ก-๛]+/g) || []) {
            if (!/[ก-๛]/.test(run)) { phrases.forEach(item => { item.term += run; }); continue; }
            if (describeThai(run)) { phrases.forEach(item => { item.term += run; }); continue; }
            const paths = new Array(run.length + 1); paths[run.length] = [{ term: '', cost: 0, parts: 0 }];
            for (let start = run.length - 1; start >= 0; start--) {
                const options = [];
                for (let end = start + 1; end <= Math.min(run.length, start + 60); end++) {
                    if (!paths[end] || /[ะัาำิีึืุู็่้๊๋์]/.test(run[end] || '')) continue;
                    const original = run.slice(start, end);
                    for (const word of proofIndex.get(proofKey(original)) || []) {
                        if (!fromIpa(dictionary[word])) continue;
                        const cost = editDistance(original, word);
                        if (cost > 2 || (cost && proofKey(word).length < 3)) continue;
                        for (const tail of paths[end]) if (tail.cost + cost <= 4) options.push({ term: word + tail.term, cost: cost + tail.cost, parts: 1 + tail.parts });
                    }
                }
                if (options.length) paths[start] = best(options);
            }
            if (!paths[0]) { phrases = []; break; }
            phrases = best(phrases.flatMap(prefix => paths[0].filter(tail => prefix.cost + tail.cost <= 4).map(tail => ({ term: prefix.term + tail.term, cost: prefix.cost + tail.cost, parts: prefix.parts + tail.parts }))));
        }
        const result = phrases.filter(item => item.term !== input && item.cost > 0 && item.cost === phrases[0].cost).map(item => ({ term: item.term, reading: describeThai(item.term), changes: item.cost })).filter(item => item.reading).slice(0, 3);
        if (suggestionCache.size >= 500) suggestionCache.clear();
        suggestionCache.set(input, result); return result;
    }
    function legacyThai(text) {
        // Recognize automatic hints saved by v1 so they do not pin the lossy spelling forever.
        const ipa = describeThai(text)?.ipa;
        return ipa ? ipa.replace(/[\u0361\u032f]/g, '').replace(/t[ɕʃ]ʰ/g, 'ch').replace(/t[ɕʃ]/g, 'ch').replace(/ŋ/g, 'ng').replace(/ɲ/g, 'ny').replace(/ɯ/g, 'ue').replace(/ɤ/g, 'oe').replace(/ɛ/g, 'ae').replace(/[ɔɒ]/g, 'o').replace(/j/g, 'y').replace(/ʰ/g, 'h').replace(/[ʔːˑˈˌ˥˦˧˨˩\u031a\/]/g, '').replace(/ay/g, 'ai').replace(/aw/g, 'ao').replace(/[.\s]+/g, ' ').trim() : '';
    }
    window.ByndStudyReading = { thai, describeThai, fromIpa, legacyThai, suggestThai };
})();
