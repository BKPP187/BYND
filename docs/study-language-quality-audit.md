# 学习语言质量核对

核对日期：2026-10-17。用户能帮助核对日语、泰语；英语、韩语、意大利语等内容需要项目主动核对。质量分为资料事实、应用数据流、实际音频三个维度，各自报告，不能互相代替。

## 已发现并修复

- 泰语的旧转写删除声调、长短元音、ɔ/o 区别，且词首不送气 t/p 容易被读成拼音送气音。现在保留来源 IPA，学习提示使用 dt/bp、长音双写和实际声调附加符号；尾音 t/p/k 保持收住不爆破的说明。展示音节实际声调，而非套用字面调号。
- 韩语基本字母表中的 g/d/b 改为 g/k、d/t、b/p 的位置提示，并注明罗马字表记与标准实际发音的区别；加入音变案例。
- 意大利语原来只有自定义语音代码，没有入门课。现在有预设语言、21 个基本字母、常见组合、借词字母、基础词句。已有自定义意大利语 ID 沿用原词卡，按 it-IT 找到课程。
- AI 教学请求增加语言准确性要求：不随角色性格改变教学事实；区分错误、口语、地区变体和敬语，不强行改成唯一答案；不确定的读音留空。英、韩、意、法、德、西分别带入专项核对要求，AI 导入也采用相同要求。

## 已按资料核对的重点案例

|语言|发音核对|语法核对|依据|
|---|---|---|---|
|泰语|โรคติดต่อ → rôok dtìt dtɔ̀ɔ，实调 3/2/2；ต่อ 为不送气 /tɔː˨˩/；แม่ 降调、ม้า 高调；o/ɔ、长音和送气保留|当前内置“กำลังเรียนภาษาไทย”等入门句未发现明确语法错误；未扩展为完整泰语语法课程|[Thai Style 发音教材](https://learnthaistyle.com/wp-content/uploads/2020/05/3.-Pronunciation-Phonetic-Letters-Guide.pdf)、[低辅音与调号](https://learnthaiforfree.com/thai-alphabet/tone-marks)、原 IPA 来源见 vendor 清单|
|英语|ship/sheep 的音质与时长；cats/bags/buses 三类词尾；字母名不等于单词音|She goes… / Does she go…；I am learning English.；核对主谓、时态、冠词与可数性|[British Council 发音图](https://learnenglish.britishcouncil.org/apps/learnenglish-sounds-right)、[一般现在时](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/present-simple)、[Cambridge 复数](https://dictionary.cambridge.org/grammar/british-grammar/plurals)|
|韩语|같이 [가치] gachi；국물 [궁물] gungmul；한국어 [한구거] hangugeo；eo/eu 不是英语拼法|저는 사과를 먹어요.；한국어를 공부하고 있어요.；核对助词、语序及语体|[国立国语院罗马字规范](https://www.korean.go.kr/front_eng/roman/roman_01.do)、[标准发音规范](https://korean.go.kr/kornorms/regltn/regltnView.do?regltn_code=0002)、[같이 词条](https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=22776)|
|意大利语|cibo/chilo、gelato/spaghetti；pala/palla；caffè/perché 的重音与开闭元音|la casa bianca / le case bianche；Sto imparando l’italiano.；核对冠词、性数与动词人称时态|Treccani：[字母组合](https://www.treccani.it/enciclopedia/digramma_(Enciclopedia-dell%27Italiano)/)、[双辅音](https://www.treccani.it/enciclopedia/lettere-doppie_(Enciclopedia-dell%27Italiano)/)、[重音符号](https://www.treccani.it/enciclopedia/accento-grafico_(Enciclopedia-dell%27Italiano)/)、[配合](https://www.treccani.it/enciclopedia/concordanza_(La-grammatica-italiana)/)|
|法语|tu/tout 的 /y/ 与 /u/ 区别；连诵不能机械套用|冠词、名词形容词性数配合；前置形容词的复数 de|[OQLF 名词词组配合](https://www.oqlf.gouv.qc.ca/francisation/ordres_prof/capsules-grammaticales/accord-groupe-nominal.aspx)|
|德语|ei/ie 与长短元音；示例采用完整单词 Ei、nie，朗读不传 IPA|Heute lerne ich Deutsch.；常规陈述主句的 V2 指句子成分而非第二个词|[Goethe 语法](https://www.goethe.de/ins/de/de/m/prf/grm.html)、[Goethe 发音资料](https://www.goethe.de/resources/files/pdf136/appendix-karla--kai-volume-1---final-17.10.2017.pdf)|
|西班牙语|pero/perro 的闪音与颤音；承认地区变体|los libros nuevos / las casas nuevas 的性数配合和动词变化|[RAE 配合](https://www.rae.es/dpd/concordancia)、[FundéuRAE rr](https://www.fundeu.es/dudas/palabra-clave/doble-erre/)|
|日语|现有五十音、浊音、拗音表做基础检查；不添加未经词典核实的高低音编号|日本語を勉強しています。为当前入门句；没有声称覆盖全部助词、活用与敬语|[国际交流基金 假名表](https://www.irodori.jpf.go.jp/assets/data/Kana_all.pdf)、[发音与音调说明](https://www.irodori.jpf.go.jp/assets/data/wordlist_Z.pdf)|

## 自动化证据

- `tests/study-reading.test.cjs`：真实词库路径断言不送气/送气、长音、o/ɔ、五种实际声调、未知调值不编造、复合词与句子、资源摘要。
- `tests/study-app.test.cjs`：旧自动标注无损更新且保留手动修正；书本/卡片的声调展示；六语言专项要求只跟随已选语言；英韩意示例传原文及正确语言代码；旧意大利语 ID 兼容。
- `scripts/check-study-language-quality-browser.cjs`：真实页面点击泰语原文喇叭和六语言对照，桥接返回以测试替身记录；实际检查 320/375 窄屏截图及 47/59px 父容器/顶栏预留安全区。
- `scripts/check-study-pronunciation-browser.cjs`：在替换桥接之前使用真实 Edge SpeechSynthesis 枚举和播放。15 种语言仅中文本机语音有 start/end 事件，其他 14 种没有安装；它们不算真实音频通过。

截图和结构化报告：`artifacts/study-language-quality/`；真实系统语音事件：`artifacts/study-pronunciation/real-voice-report.json`。

## 明确未验证的范围

本轮是具体案例和已存在教学内容的资料核对、规则补强及应用回归，不是全部语言的全部发音/语法认证。没有对配置中的付费音色进行母语者听辨，也没有通过真实用户模型服务批量评估随机生成的对话。测试替身验证数据流，不证明模型能正确回答所有纠错题。俄语、阿拉伯语、葡萄牙语、印地语、越南语、印尼语本轮做了语音可用性检查，未把其完整语法列为已验收。

## 2026-10-18：逐词拼读说明修复

词条弹出的说明曾重复套用同一段通用例子，甚至“读音待补充”的词也显示该段落。现在通用规则只在页面独立的“泰语通用发音规则”中出现一次；单个词条只解释本词的各音节。

- 按当前词 IPA 拆分声母、元音、尾音及实际声调，结合本音节说明送气、长短音和收尾方式。
- 通过词库中拼写片段与本词音节 IPA 的一致性匹配对齐；只对可靠对齐的单音节说明起首字母类别、调号及声调条件。不根据读音臆造泰文字母分界。
- 规则预期声调必须与词典中的实际声调一致，才展示拼写原因；复杂拼写或不一致条目不强加原因。复合元音没有长度依据时不猜长短。
- `โรคติดต่อ` 展开后显示 โรค、ติด、ต่อ 三段各自的说明；`ขอบคุณ` 展开后显示它自己的送气音、鼻音/塞音收尾及声调，不引用无关词。
- `โรคติตต่ออันตราย` 这样的未匹配扫描文本显示本词缺少完整读音资料和“校对此词 / 补充读音”入口，不展示别的词的解释，不自动改写用户文字。

单元测试覆盖已匹配词、未匹配词、规则与数据冲突、手动标注保留及不写回原词本；浏览器检查多个不同词、完整复合词、编辑校对入口、320/375px 截图及安全区。新增截图：`artifacts/study-language-quality/word-*.png`。

## 2026-10-18：读音缺失与已导入词本校对

实测用户《新冠疫情中泰500词.pdf》前 20 页的 394 条 OCR 预览，207 条能完整匹配离线读音。缺失中有大量扫描错字，例如 `โรคติตต่ออันตราย`；没有通过把错字直接映射为另一个词的读音来填满界面。

- 新增“校对与读音”入口，按整本扫描缺失条目，6 条一页，保留原文与释义；按有限字形混淆、声调漏识别检索词库，并按最小编辑次数提供候选。当前样本另有 99 条能提供候选。这个数字只表示能提供候选，不表示已经确认词义正确。
- 本地候选不会自动选中；确认采用后一次保存，保留卡片 ID、来源、笔记和学习进度，并记录校对前文字。未知原文的拼读仍为空，直到用户采用校对结果。
- 可选“AI 校对与补音”按 12 条一批发送本书待检查的泰文与释义；只接收 ID 和原文对应的结果。优先使用已匹配词库的 IPA；词库未收录时，AI 音标必须包含实际声调和可解析音节。AI 结果先预览，可批量选中后应用，不在请求完成时直接写回。
- AI 音标有独立来源标识；只有 AI 音标、没有可核对拼写依据时，不生成辅音类别或调号导致声调变化的解释。格式校验不等于母语者确认其准确性。
- 保存前重新读取原词本，拒绝损坏数据、已经改变原文或释义的条目；写入失败保留预览，不报告成功。取消或关闭后忽略迟到结果并中止请求。
- 复合词词库条目无法解析时，允许退回到完整可解析的组成词；不因为无效的长词条挡住有效组成词。未知声调和不完整音节仍不猜测。

OCR 对照实验保存在 `artifacts/study-ocr-quality/`。实际比较了原 fast 模型与官方 best 泰语模型、二值化/原灰度、2400/3600px 和逐行裁切。前两页原方案 34 条中 15 条完整匹配读音；best + 更高分辨率 + 灰度仅到 17 条，且仍有相同错字。因此没有把大模型替换进产品或重复打包模型，也没有宣称 OCR 已完全修好。官方资料：[识别质量](https://github.com/tesseract-ocr/tessdoc/blob/main/ImproveQuality.md)、[模型差异](https://github.com/tesseract-ocr/tessdoc/blob/main/Data-Files.md)。

验证：`tests/study-app.test.cjs`、`tests/study-reading.test.cjs` 包含校对前只读、明确选择后保存、失败与损坏/并发修改保护、API 失败/取消、整本分批处理、音标声调校验、AI 来源及不臆造拼写规则；`scripts/check-study-proofreading-browser.cjs` 使用实际 OCR 预览验证候选、保存后刷新、320/375px 手机布局和 47/59px 两种安全区。AI 接口使用测试替身，仅验证流程，没有把它算作真实模型语言质量验收。

## 2026-10-18：实际扩充离线词库与词条旁校正

在原有 60,965 条参考读音上，合并 PyThaiNLP Thai G2P v4 的固定版本 `0b0cbe7c8aee9cdfef93371104478e412da668f6`。保留实际 IPA 的声调、长短音、送气和收尾信息；仅接收可完整解析的泰文条目。新增数据含专名、术语和由书面拼读自动转换的标音，不能按词条数理解为同数量的人工核准常用词。

最终保留 **149,140 条**：新增 88,175 条，修复原数据中 10 条不可解析的标音，过滤 881 条格式不完整/不符合字表条件的记录，以及 **22,438 条**与现有完整组成词读音冲突的新增记录。原始 CSV/JSON 只留在诊断目录，产品仅保留一份合并后的 readings.js。构建脚本在写入前校验两份原始数据 SHA-256，资源有来源、授权和输出摘要。

核对中发现借词 `เซลล์` 的原词典音标为 `/seːl˧/`，此前解析器拒绝 /l/ 尾音；新增自动转换资料又把它写成 /n/。现在保留 /l/ 原音，并拒绝包含此类冲突的整词覆盖。校对来源：[英文维基词典](https://en.wiktionary.org/wiki/เซลล์)、[泰文维基词典](https://th.wiktionary.org/wiki/เซลล์)。来源说明与授权见 assets/vendor/study-thai/README.md。

缺少读音时，若有字形校对候选，词条旁直接展示候选泰文、候选参考音和实际声调，可点“采用此词并补齐读音”；显示候选时不改原文、不把候选读音伪装成原文读音。应用时再次检查原文快照和词本归属，保存原笔记、进度及来源，并记录校正前文字；失败不显示成功。词库资源未加载另报加载错误，不再当成词条缺失。

实测原 PDF 的 394 条预览，209 条可完整匹配读音，另外 103 条有校对候选，仍有 82 条暂缺候选。不能把 103 条候选算作已经确认正确的词；词库扩充也不等同于扫描错字修复。原 PDF 重新导入仍为 394 条预览、去重保存 392 条。

验证包含词库实际条目数/摘要/授权、原参考音保留、冲突过滤、借词 /l/、词条旁只读预览、一键采用、存储失败及过期原文保护。浏览器实际点击候选并保存、刷新验证，检查 320/375px 窄屏和 47/59px 两种安全区，并验证新增术语在词本中的读音展示。截图：artifacts/study-language-quality/inline-candidate-*.png、expanded-readings-375.png；结构化覆盖报告：artifacts/study-ocr-quality/proofreading-report.json。
