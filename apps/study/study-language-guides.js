// Curated learning guardrails, independently checked against the linked teaching/standards sources.
// These examples are not an automatic grammar checker or a grapheme-to-phoneme engine.
(() => {
    const guides = {
        en: {
            code: 'en-US', label: '英语',
            policy: '英语字母名不等于单词发音；读音用 IPA 并说明英美变体，保留重音和元音区别，不能用中文谐音代替。',
            pronunciation: [
                { text: 'ship / sheep', speech: 'ship. sheep.', reading: '/ʃɪp/ /ʃiːp/', note: '区别 /ɪ/ 与 /iː/，既有音质差别，也常有时长差别。' },
                { text: 'cats / bags / buses', speech: 'cats. bags. buses.', reading: '/kæts/ /bæɡz/ /ˈbʌsɪz/', note: '复数 -s 根据前一个音读 /s/、/z/ 或 /ɪz/，不能只看字母。' }
            ],
            grammar: [
                { text: 'She goes to school. / Does she go to school?', note: '一般现在时第三人称单数动词变形；用了 does 后，实义动词用原形。' },
                { text: 'I am learning English.', note: '现在进行时用 be + -ing；按时间语境区分一般现在时、过去时和进行时。' }
            ],
            sources: [
                ['British Council · Sounds Right', 'https://learnenglish.britishcouncil.org/apps/learnenglish-sounds-right'],
                ['British Council · Present simple', 'https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/present-simple'],
                ['Cambridge · Plurals', 'https://dictionary.cambridge.org/grammar/british-grammar/plurals']
            ]
        },
        ko: {
            code: 'ko-KR', label: '韩语',
            policy: '韩语罗马字不是逐字母拼接的音标；以标准发音为准，标注收音、连音、鼻音化、腭化、紧音化及敬语层级；字母 ㄱ、ㄷ、ㅂ 的位置会影响读音。',
            pronunciation: [
                { text: '같이', speech: '같이', reading: '[가치] · gachi', note: 'ㄷ/ㅌ 收音遇特定的 이 时会腭化，같이 按 [가치] 读。' },
                { text: '국물', speech: '국물', reading: '[궁물] · gungmul', note: '此处 ㄱ 收音遇 ㅁ 发生鼻音化，不能读成逐字拼接的 guk-mul。' },
                { text: '한국어', speech: '한국어', reading: '[한구거] · hangugeo', note: '收音 ㄱ 与后面的元音连读；eo 是一个元音的罗马字写法。' }
            ],
            grammar: [
                { text: '저는 사과를 먹어요.', note: '常见语序为主语—宾语—谓语。을/를 等助词的选择受前词是否有收音影响。' },
                { text: '한국어를 공부하고 있어요.', note: '-고 있어요 表示正在进行等语境；保持 해요体、합니다体等语体一致，不能把敬语差异一概判错。' }
            ],
            sources: [
                ['国立国语院 · 罗马字表记', 'https://www.korean.go.kr/front_eng/roman/roman_01.do'],
                ['国立国语院 · 标准发音规则', 'https://korean.go.kr/kornorms/regltn/regltnView.do?regltn_code=0002'],
                ['韩国语基础词典 · 같이', 'https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=22776']
            ]
        },
        it: {
            code: 'it-IT', label: '意大利语',
            policy: '意大利语保留词重音、双辅音和 e/o 的开闭音区别；c/g 在 e/i 前与 ch/gh 不同。不能把所有词一律倒数第二音节重读，也不能按英语字母规则读。',
            pronunciation: [
                { text: 'cibo / chilo · gelato / spaghetti', speech: 'cibo. chilo. gelato. spaghetti.', reading: '/ˈtʃibo/ /ˈkilo/ · /dʒeˈlato/ /spaˈɡetːi/', note: 'ch、gh 在 e/i 前保留硬音；用完整单词对照，避免把字母名当作词中发音。' },
                { text: 'pala / palla', speech: 'pala. palla.', reading: '/ˈpala/ /ˈpalːa/', note: '双辅音有区别词义的作用，不能省成一个短辅音。' },
                { text: 'caffè / perché', speech: 'caffè. perché.', reading: '/kafˈfɛ/ /perˈke/', note: '这两词都在末音节重读；è 与 é 同时说明此处 e 的开闭。' }
            ],
            grammar: [
                { text: 'la casa bianca / le case bianche', note: '冠词、名词、形容词需要性数配合；动词需按人称和时态变位。' },
                { text: "Sto imparando l'italiano.", note: 'stare + gerundio 可表示正在进行；一般陈述也可用 Imparo l’italiano，按语境判断。' }
            ],
            sources: [
                ['Treccani · Digramma', 'https://www.treccani.it/enciclopedia/digramma_(Enciclopedia-dell%27Italiano)/'],
                ['Treccani · 双辅音', 'https://www.treccani.it/enciclopedia/lettere-doppie_(Enciclopedia-dell%27Italiano)/'],
                ['Treccani · 重音符号', 'https://www.treccani.it/enciclopedia/accento-grafico_(Enciclopedia-dell%27Italiano)/'],
                ['Treccani · 性数配合', 'https://www.treccani.it/enciclopedia/concordanza_(La-grammatica-italiana)/']
            ]
        },
        fr: {
            code: 'fr-FR', label: '法语',
            policy: '法语按语境核对连音、联诵、鼻化元音及词尾静音；不能把所有词尾都读出，或把所有相邻词一律连诵。',
            pronunciation: [{ text: 'tu / tout', speech: 'tu. tout.', reading: '/ty/ /tu/', note: 'u 与 ou 的元音不同，不能都标成 u。' }],
            grammar: [{ text: 'une petite maison / de petites maisons', note: '核对冠词、性数配合和动词变位；此类复数前置形容词结构通常用 de。' }],
            sources: [['OQLF · 名词词组配合', 'https://www.oqlf.gouv.qc.ca/francisation/ordres_prof/capsules-grammaticales/accord-groupe-nominal.aspx']]
        },
        de: {
            code: 'de-DE', label: '德语',
            policy: '德语区别 ei 与 ie、变元音和长短元音；核对常规陈述主句动词第二位以及从句动词末位，第二位指句子成分而非第二个单词。',
            pronunciation: [{ text: 'ei / ie', speech: 'Ei. nie.', reading: '/aɪ̯/ /iː/', note: 'ei 如 Ei；ie 如 nie，拼写相近但发音不同。' }],
            grammar: [{ text: 'Heute lerne ich Deutsch.', note: 'Heute 占据第一句子成分，变位动词 lerne 仍在第二位；还需核对名词性、格与冠词。' }],
            sources: [['Goethe · Grammar', 'https://www.goethe.de/ins/de/de/m/prf/grm.html'], ['Goethe · Sounds', 'https://www.goethe.de/resources/files/pdf136/appendix-karla--kai-volume-1---final-17.10.2017.pdf']]
        },
        es: {
            code: 'es-ES', label: '西班牙语',
            policy: '西语保留重音和 r/rr 区别，注明 seseo、yeísmo 等地区变体，不把合法地区用法误判成错误；核对名词形容词性数配合和动词人称时态。',
            pronunciation: [{ text: 'pero / perro', speech: 'pero. perro.', reading: '/ˈpeɾo/ /ˈpero/', note: '两元音之间的单 r 与 rr 不同，区别闪音和颤音。' }],
            grammar: [{ text: 'los libros nuevos / las casas nuevas', note: '冠词、名词、形容词的性数要配合，动词按人称和时态变化。' }],
            sources: [['RAE · Concordancia', 'https://www.rae.es/dpd/concordancia'], ['FundéuRAE · doble erre', 'https://www.fundeu.es/dudas/palabra-clave/doble-erre/']]
        }
    };
    function get(language) {
        if (!language) return null;
        const id = typeof language === 'string' ? language : language.code?.toLowerCase().split('-')[0] || language.id;
        return guides[id] || null;
    }
    function prompt(languages) {
        return (languages || []).map(language => {
            const guide = get(language);
            return guide ? `【${guide.label}专项核对】${guide.policy}\n${guide.grammar.map(item => item.text + '：' + item.note).join('\n')}` : '';
        }).filter(Boolean).join('\n');
    }
    window.ByndStudyLanguageGuides = { get, prompt };
})();
