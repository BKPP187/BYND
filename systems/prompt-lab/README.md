# BYND Prompt Lab

入口：设置 → Prompt Lab。原生串行优化器遵循 [rebase-energy/hillclimb](https://github.com/rebase-energy/hillclimb) 的固定 verifier、预算、候选记录和保留最佳结果机制；没有启动它的 headless coding agents，也不需要安装 Python 包。优化调用使用 BYND 已配置的聊天 API。

## 完整流程

1. 配置被测、评分、优化模型，以及案例需要的 Jev 场景。建议评分模型与被测模型不同。保存或导入行为层草稿；空草稿代表原有 BYND 行为层。
2. 点击“评测并自动优化”：先评测开发和验证基线，再逐轮针对开发组失败选择一个模块或上下文参数。评分器、案例、角色卡与权限边界不属于可优化字段。
3. 候选在开发组有超出观察到的采样噪声的提升，且验证组不退步时保留。已有的硬问题可以逐步减少，但不能引入新的硬失败；不会因为其他尚未解决的问题丢弃一次有效修复。
4. 冻结最佳候选，最后评测基线与候选的留出组。优化器从未收到验证或留出组的回答、rubric 或失败详情。
5. 只有留出组提升、所有已测最佳版本的硬失败为零、无分类退步和调用错误时，才能“启用最佳版本”。手动草稿与导入的成绩不能直接启用。启用后改变聊天模型或当前预设会暂停行为补充；可停用或回滚。

默认 45 个合成案例，三组各 15 个；覆盖 OOC、越权、知识边界、错误工具调用、过度主动、遗漏主动、世界书、记忆、Jev、Reality Event。Jev 还覆盖 turn、toolGate、webSearch、forumReply、cycleCompanion、moment，包含 noul 与 choice 问题。默认 3 轮、每例 2 次采样、600 次逻辑请求上限、20 分钟。全流程最坏约 543 次请求；模型速度、失败、重复候选或早停会改变实际消耗。Jev 现有网络路由可能做连接回退，逻辑请求数不等于物理 HTTP 尝试数。时间、调用任一预算耗尽都停止，不能启用未完成结果。

“停止实验”保留已完成样本与候选，当前请求结束后停止；“继续实验”不重跑已有样本。累计调用和时间预算保留。模型、预设、案例、评分器、运行时或预算变化会拒绝续跑。预算耗尽或 API 错误需重新开始，错误样本不会靠重试变成成功。正常打开页面不会自动发起付费实验。

## 测量范围

- 浏览器独立 iframe 与 Node VM 使用同一生产 `buildMessages` / `buildSystemPrompt` / 核心角色锚点。iframe 通过消息通信工作，兼容 APK 的文件来源，不直接读取宿主窗口。
- 隔离环境固定日期，使用案例中的合成角色、历史、记忆与事件，不读取真实角色聊天或设备记录。浏览器会冻结当前 Prompt 预设和生产目标模型采样参数；评分、优化请求使用固定采样参数。CLI 使用无预设的生产默认温度 0.8，评分和优化温度 0。
- 世界书使用生产共享选择函数，两处聊天锚点及 Jev 人设上下文都接入它。记忆是对案例快照的选择测试，生产接入点是原有记忆召回后的补充过滤；它不等同于整个记忆抽取、图谱排名的端到端指标。
- Reality Event 用可见性快照测试角色知识隔离；不声称覆盖整个 Living World 的权限服务。已有 Living World 权限逻辑不被优化器修改。
- Jev 直接调用已配置的真实 typed-question 路径，记录原始 answers、usage 与解释后的值，不把聊天模型 fallback 计为 Jev 成功。实验决策不写入角色最近决策日志。未配置、低置信度或错误类型会导致失败。
- 工具只作为回复意图接受格式、授权与语义评测，不执行联系人删除、朋友圈发布、电话、图片生成等副作用。通过不代表外部工具实际执行成功。
- 硬断言检查秘密泄露、必需或禁止的指令、选择的条目 IDs、Jev 决策与不闭合指令。独立评审请求评估人设、知识和时机；失败判定必须引用回答原文。评分格式错误、空可见回答、网络错误、存储错误不会显示成功。

宏平均让十类指标等权。配对比较在同一案例的重复采样内估计噪声，按类别权重汇总标准误，以 `delta - 1.96 × SE > 0` 和至少 2% 的宏平均提升为保留门槛。它只是固定案例上的近似采样噪声估计，**不是对所有真实角色的泛化置信保证**；默认每组规模很小，零观察方差也不等于真实方差为零。真实使用应扩充独立角色、长历史、边界场景和人工校准样本。留出组只在一轮完整实验结束时使用；反复根据同一留出成绩调整草稿会损害它的独立性，应换新的留出案例。

## 模块与数据

- `engine.js`：冻结评分器、案例校验、预算、续跑、候选与 gate。
- `cases.js`：可扩展合成案例，不包含真实用户数据。
- `replay.js` / `sandbox.html`：生产 Prompt 的隔离回放适配器。
- `store.js`：重复长 Prompt 字符串去重、单次原子本地写入、导入导出、启用证据和回滚；导出仍还原为完整可读 JSON。
- `lab.js` / `lab.css`：设置界面、模型适配器和生产 opt-in hooks。
- `scripts/prompt-lab.cjs`：命令行真实模型实验及不收费的回放检查。

本地键 `bynd_prompt_lab_v1` 随 BYND 数据备份保存；专用 JSON 导出包含草稿、案例、实验记录和历史，不包含 API/Jev 配置或密钥。导入只接受案例与草稿，清除旧报告，保持当前启用版本不变。实验记录包含实际发送的 Prompt、回答、评分证据、模型、usage、延迟、候选和接受／拒绝原因；浏览器的 usage 字段区分接口实际返回值与本地估算。它可能包含当前自定义预设或用户自行添加的案例，分享前应检查内容。

## 命令行

无模型、无费用的运行时回放检查：

```powershell
node scripts/prompt-lab.cjs --check
```

真实实验从进程环境读取凭据，报告不写入这些环境变量。`BYND_EVAL_BASE_URL` 是 BYND 使用的 `/v1` 基础地址；`BYND_EVAL_MODEL`、`BYND_EVAL_API_KEY` 是被测 API。评分和优化可分别配置 `BYND_EVAL_JUDGE_BASE_URL/MODEL/API_KEY`、`BYND_EVAL_PROPOSER_BASE_URL/MODEL/API_KEY`；未配置时沿用被测 API。完整案例还需要 `BYND_EVAL_JEV_KEY`，可选 `BYND_EVAL_JEV_ENDPOINT`、`BYND_EVAL_JEV_THRESHOLD`。

```powershell
node scripts/prompt-lab.cjs --run --rounds 3 --repeats 2 --max-calls 600 --minutes 20
node scripts/prompt-lab.cjs --resume artifacts/prompt-lab/runs/<run>.json
```

可用 `--candidate policy.json`、`--cases cases.json`、`--out run.json`。`cases.json` 是案例数组。每例包括 `id/category/split/lane/character/input/rubric`，以及可选 `history/worldBook/memories/events/forbid/require/expectedSelection/expectedDecisions`；Jev 可指定 `jevScope/questions/proposedAction`。扩展后仍需保留 dev、validation、test 三组。上下文条目使用 `id/keys/content/charId/enabled/visibility/knownBy`。

输出运行报告、逐样本 `results.jsonl`、最佳策略 `best.json`。退出码 0 表示实验完整结束，不等于存在可启用改善；2 表示停止／预算／运行错误；1 表示配置或初始化失败。Node CLI 的 checkpoint 用临时文件后重命名保存。浏览器和 CLI 运行时指纹不同，不能直接相互续跑或把 CLI 成绩导入应用后启用。策略文件可以导入应用草稿并在应用里重新评测。

若以后使用原版 hillclimb 的 coding-agent 搜索，只应让 candidate 产出此处有限的策略 JSON，再由这个固定 harness 打分；不要授权它修改案例或评分器。当前应用中整个循环已由串行原生引擎完成。

## 验证

```powershell
node tests/run.cjs
node scripts/prompt-lab.cjs --check
node scripts/check-prompt-lab-browser.cjs
```

浏览器检查使用本地模拟 HTTP 响应，验证 320/375/430px、父容器 47px 安全区、文件模式回放、完整优化／启用／回滚链路、usage 和保存／导入／导出／网络／评分失败。它验证系统机制，**不产生真实模型质量提升的证据**。
