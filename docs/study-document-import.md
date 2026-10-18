# 学习资料导入单词

入口：学习 → 词本 → 导入资料。

词本首页采用封面书架：每份资料归为独立词本，已有 PDF／Word 词条按来源文件自动分组，无需改写原有词条或学习记录。对话收藏和旧的手动词条放在“随手词本”。点击封面进入纸张内页，每页 8 条，可翻页、搜索、编辑、朗读或练习当前词本。

可以新建空白词本、修改名称与封面颜色；新导入默认按文件归本，也可以在“保存到”中选择已有词本。再次导入同一文件会继续归入同一本。去重只作用于目标词本，同一个词可以同时存在于不同教材中。书架支持按名称或最近更新排序。布局参考 [Goodnotes 文稿库的网格浏览](https://support.goodnotes.com/hc/en-us/articles/15303674514191-Organize-folders-and-documents-in-Goodnotes)。

支持 PDF、旧版 DOC 和 DOCX。选择词条语言及识别范围后，先预览、编辑和勾选，再导入词本；保存时在同一本中按词条语言和内容去重。读取或保存失败会显示原因，保存失败保留预览以便重试。

- 文件上限 80MB，每次最多 30 页或段、500 条，默认读取前 20 页或段。
- PDF 使用随应用提供的 PDF.js 提取文字；中文、日文等字体资源同时保留在本地。
- DOC 使用 Word 二进制结构解析，DOCX 读取正文和表格。Word 没有稳定的显示页码，按约 40 行一段选择范围。
- 本地提取不调用聊天 API。没有文字层的 PDF 自动使用本地 OCR，支持中文、英文、日语和泰语。复杂排版或识别效果不佳时可以主动开启 AI 识别；PDF 将所选页的渲染图片及文字发送到已配置的聊天 API，Word 发送所选段落文字。AI 的 PDF 模式需要接口支持识图。
- 缺少释义时留空，不推测错列配对；预览会提示补充。仅含图片的 Word 请先另存为 PDF，再用 AI 识别。
- 加密、损坏、识别后没有词条和超出范围的文件不会被当作成功导入。扫描识别可能有错字，需要核对预览；大文件可以先选择 1–3 页，识别过程中支持取消。

## 验证

自动测试覆盖格式与范围检查、扫描页、AI 接口失败与返回格式错误、取消后迟到结果、表格配对、重复导入及存储失败。浏览器检查覆盖真实解析、DOCX 表格、手机 320/375px，以及父容器和顶栏分别预留 47/59px 安全区的组合。

```powershell
node tests/run.cjs
node scripts/check-study-import-browser.cjs
node scripts/check-study-books-browser.cjs
# 可在命令后追加本地样本文件路径；样本只读取，不复制进项目。
```

用户提供的《第1课-打招呼.doc》读出泰中句子；《词汇卡片.doc》读出泰文词条，原材料错位的释义保留为空；《新HSK(三级）词汇--（汉泰）.pdf》验证中文合并单元格与多条泰文释义配对。《泰语辅音字母书写.pdf》验证无文字提示、真实页面渲染和识图请求。识图 API 在测试中使用模拟返回，未消耗用户接口额度。

《新冠疫情中泰500词.pdf》的扫描件回归命令：

```powershell
node scripts/check-study-covid-browser.cjs <原始PDF路径>
```

该检查保留默认 1–20 页、不勾选 AI，使用真实 OCR，断言 `ไข้หวัดใหญ่ → 流感` 配对，并实际保存词本。预览与保存截图、结果列表写入 `artifacts/study-import/covid/`。

## 离线依赖

PDF.js 6.4.299 的 legacy 构建被转换为经典脚本，支持 Android `file://` 来源。预加载 worker handler，避免该来源的模块 worker 限制。CMap、标准字体和解码资源随应用保留，清单记录 SHA-256。没有 Base64 镜像副本。

Word 使用 word-extractor 1.0.4、Mammoth 1.13.0 及浏览器 Buffer/Stream 适配，均按需加载。仅处理提取出的文字，不把 Word HTML 插入页面。相关许可证在 vendor 目录中。

词本中的内容沿用 `bynd_study_cards_v1`，新卡片附带 `bookId`；旧卡片没有该字段时，按 `sourceFile` 派生稳定身份。空白词本和封面设置保存在 `bynd_study_books_v1`，使用单次存储写入，保存失败保留编辑状态。这两个键均在现有 `bynd_` 备份范围内。导入仍只写入一次卡片集合，避免额外写目录失败导致内容与词本归属不一致。

书架每本右侧的省略号、或内页右上角的设置都可以删除整本。确认后同时删除词句和目录。删除先保存 `bynd_study_book_delete_v1` 快照，两个存储键更新完成才提交；失败或中途退出时读原快照，下次写入前恢复，不能显示虚假的删除成功。空集合不会在重开后重新生成示例本。

学习卡点击“会读了”前进，点击“还不会读”保留本卡并重播；撤销回到被标记的卡。内页的每一语言各有一个行尾喇叭，分别传本行文字和对应语音代码。缺少语音包、播放错误都有明确提示；已有角色音色优先，失效后尝试系统语音。快速切换语言时，过期的音色请求不抢播。

本地扫描提示仅在导入预览整体显示，旧词卡的同名模板备注也不再重复出现。泰语自动参考音由本地词库生成，旧词条无需重新导入。编辑里的“泰语参考音”可以校正，修改泰文后不会沿用旧读音。词库来自 [FastThaiG2P](https://github.com/awslabs/FastThaiG2P/tree/c4759eef7df03e11fcbb9aa83efe8cf21709fd2f)，保留原 IPA，参考拼读保留实际声调、长音和 ɔ/o 区别，用 dt/bp 标记词首不送气音。每条只展开本词的原音标、声母/元音/尾音、实际声调，以及有可靠拼写对齐和一致规则依据时的本音节声调原因；“标二读三”等通用说明收在页面独立的帮助中，不在每词重复。读音资料不足时只提示校对当前词并提供编辑入口。`โรคติดต่อ` 为 `rôok dtìt dtɔ̀ɔ`，实际声调为 3降 / 2低 / 2低；不能把 ต 直接当送气拼音 t 或把写出的调号当实际调值。旧自动提示即使保存过，也可无损更新展示；用户不同于旧自动提示的手动标注保留。数据包含词典和生成条目，因此仅作辅助。未知或 OCR 错字整条不拼接猜音，显示待补充；AI 导入也要求保留声调、长音和送气区别，不确定则留空。词库来源、许可、变换和 SHA-256 在 `assets/vendor/study-thai/`，重建使用 `node scripts/prepare-study-readings.cjs`。只保留 JS 中的原 IPA 词库，没有 JSON/Base64 副本。

`node scripts/check-study-pronunciation-browser.cjs` 检查学习卡、三语逐行朗读、读音校正、整本删除及重开，并枚举真实 Edge 语音、记录各语言的 start/end/error 事件；测试桥接调用和真实语音报告分开。2026-10-17 本机仅装中文系统语音，中文收到 start/end；另外 14 种常用语言（包括意大利语）没有安装语音，不能视为实际播放通过。报告在 `artifacts/study-pronunciation/real-voice-report.json`。设备需安装相应语音包或配置支持该语言的角色音色。

`node scripts/check-study-language-quality-browser.cjs` 检查泰语新标注、原文朗读、六门语言的发音语法资料、意大利语课程，以及 320/375 窄屏和 47/59px 双安全区情况。语言核对的依据、具体范围和未覆盖项目见 [学习语言质量核对](study-language-quality-audit.md)。

扫描件使用 Tesseract.js 6.0.1 的固定 worker 协议及 Core 6.1.2，语言数据来自官方 tessdata_fast，清单记录来源修订和 SHA-256。运行时与模型按需加载；每次导入只创建一个可取消的 worker，结束、失败或取消都会释放。核心源码和 worker 合成一个 Blob，避免 `file://` 的跨 Blob 导入限制。模型通过消息直接传入，不访问 CDN。WASM 内嵌脚本和压缩模型脚本各保留一份，不额外打包原始二进制副本。中文在左、泰文在右的带序号表格按列分别识别，再按图像表格线配对，并过滤低置信度的声调噪声行。

重建脚本：`scripts/prepare-study-pdf.cjs`、`scripts/prepare-study-word.cjs`、`scripts/prepare-study-ocr.cjs`，参数见脚本头部。开发依赖放在临时工具目录，应用运行不依赖 npm 或 CDN。

API 依据：[PDF.js 官方示例](https://mozilla.github.io/pdf.js/examples/index.html)、[PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)、[Mammoth](https://github.com/mwilliamson/mammoth.js)、[word-extractor](https://github.com/morungos/node-word-extractor)、[Tesseract 本地资源配置](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md)、[Tessdata Fast](https://github.com/tesseract-ocr/tessdata_fast)。
