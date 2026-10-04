# 小屋人物建模参考

2026-10-03：女生已生成真正的静态 GLB，并接入小屋用户形象。单人输入为 `bunny-blue-front-v1.png`；生成任务 `adb140fb-a772-43a9-bdd9-27aab688f841` 扣费 30 积分，原始文件 45,516,828 字节、1,469,638 三角面，Khronos 校验 0 错误。先离线制作细节候选，再通过免费可绑骨检查，绑定任务 `3b07d336-3073-4a0b-8ce8-32e76b056302` 扣费 25 积分，返回 23 关节 Mixamo 骨骼。凭证只用于当前进程，没有写入项目或生成记录。此前文档的「女生尚未生成」描述是历史阶段。

运行资源为 `assets/home3d/characters/bunny-blue-v1/`；远／中／近景约 1.8 万／4.5 万／10 万面，色彩图 1K／2K／2K，保留骨骼权重、法线、UV 与 PBR。原始图集为 2K，没有把它放大成假 4K。两个人的离线资源回调按模型 ID 与档位分开。女生的真实测量关节用于动作，保留 Tripo 权重，舍弃会拉坏裙摆的几何分区临时绑定。设置能单独切换女生 3D／已有立绘，确认新立绘切回立绘模式。

复查截图位于 `artifacts/home3d-models/bunny-blue-v1/`，包含四周静态外观、手机入屋、面部、坐下、看书与睡姿。`scripts/check-home3d-female-browser.cjs` 检查实际模型、近景 LOD、形象切换与保存失败；`scripts/prepare-home3d-rigged-character.cjs` 只做本地 LOD，源哈希固定，保留官方绑定，不调用付费服务。表情闭眼、手指抓握、裙摆及长发的精细布料表现仍需继续调整；这不是成品动画资产或实体 Android 性能验收。

2026-10-02 最新进展：用户要求把已生成模型换进小屋后，银发男生已经接入应用运行时。下面各阶段的“尚未入屋”记录是当时状态。运行资源位于 `assets/home3d/characters/silver-red-v1`，离线准备脚本为 `scripts/prepare-home3d-runtime-character.cjs`；保留原始高清源，运行资源使用 1K/2K/4K 色彩贴图和 2.5万/7万/18万 三角面 LOD。`character-models.js` 添加模型专属基础骨骼和权重，支持基础走动、坐下、躺下，不把整个图片旋转作为 3D 动作。衣服变形、手指和表情仍需精修，没有声称最终外观或真机性能已验收。女生目前仍只有参考图，未生成网格；这次接入没有提交新的付费任务。

2026-10-01 使用内置 image_gen.imagegen，分别依据用户提供的两位人物参考图生成。原始生成 PNG 完整保留，没有裁切、改背景或修改图像。完整提示词和输入对应关系见 `prompts.json`。

- `silver-red-turnaround-v1.png`：银白短发、红眼、耳饰、黑外套与白衬衫。补全黑裤和黑靴。
- `silver-red-turnaround-v2.png`：按用户要求缩小男生头身比例、加宽肩部、拉长躯干和腿，改为更成熟修长的帅气外观；保留银发、红眼、耳饰与服装。使用内置 image_gen.imagegen 编辑，完整提示词见 `male-v2-prompt.json`，原图 v1 保留。
- `silver-red-turnaround-v3.png`：用户指出 v2 的成人比例显得太大，重新调整为约四头身的紧凑游戏人物，保留成熟五官、肩背、服装与银发红眼。完整提示词见 `male-v3-prompt.json`。图片中的身高不等于实际模型尺寸；人物模型尚未生成，坐躺时与家具的比例仍需在运行场景中校准，未声称完成入屋验证。
- `bunny-blue-turnaround-v1.png`：银白长发、紫粉眼睛、兔耳、蓝色蝴蝶结、蓝白衣裙与黑色束腰。补全裙摆、白色连袜和蓝色鞋。

两张图统一为柔和的立体娃娃风格，包含正面、侧面和背面全身视图。这是外观概念参考图片，不是实际 3D 网格、精确正交工程图、骨骼绑定结果或动作文件；不能直接当作 GLB 人物放进小屋。生成视图之间的细节一致性需要在建模时确认，背面及未见服装细节属于补全设计。

下一步先对一个角色生成模型，检查四周外观、模型结构和移动端资源规模，再进行骨骼绑定和站立、行走、坐下、睡眠验证。长发、兔耳、宽袖和裙摆需要检查变形与家具接触。生成出的静态模型不代表自动具备自然动作或无穿模保证。

## 首个静态模型生成

`scripts/generate-home3d-character.cjs` 使用官方 v3 的文件上传、图片生成模型与任务查询接口。密钥仅从当前进程环境变量 `TRIPO_API_KEY` 读取，不写入代码或任务记录。准备好有效密钥后可运行：

```powershell
node scripts/generate-home3d-character.cjs docs/design/home3d/character-references-v1/silver-red-front-v1.png artifacts/home3d-models/silver-red-v1
```

一次创建一个带贴图的 H 系列模型任务，按 Tripo 实际规则扣积分。输出目录的 `generation.json` 保存任务 ID；中断后使用同一命令会续查该任务，不会重复创建付费任务。创建请求的结果不明且未得到 ID 时会停止，需先核对 Tripo 控制台；已有或被改动的模型不会被覆盖。下载不携带 API 密钥，先通过 GLB 与 Khronos 校验，再保存 `character.glb`、`intake.json` 与实际扣费记录。只有静态模型的结构检查成功，不代表外观、绑定或入屋动作已经完成。

2026-10-02：用户确认临时密钥仍有效并授权试生成后，已创建一个真实男生模型任务。任务 `11320632-9dbc-489b-8da7-b8248162fe40` 成功，服务返回实际消耗 30 积分；中途查询网络中断后续查原任务，没有再次创建生成任务。模型保存在本地 `artifacts/home3d-models/silver-red-v1/character.glb`，同目录保留任务记录、结构校验与实际模型多角度预览。密钥没有写入任务记录或项目文件。

首轮静态模型通过 Khronos glTF 校验（0 个错误，1 个切线空间警告），包含内嵌贴图和完整立体网格；文件 42,600,364 字节，731,524 个顶点，1,397,535 个角色三角面，尚无骨骼或动作。实际模型以 +X 为正面，预览已据此校正视角标签。脸、衣服、手脚及背面已渲染核对；移动端接入前仍需减面、绑定和家具接触检查。此次只完成一个男生静态模型，没有提交女生、绑定或额外付费任务，也没有替换小屋内人物。

官方 [Blender 教程](https://www.tripo3d.ai/blog/tripo-blender-plugin-tutorial)明确提供「Get your free wallet」手动领取 600 积分、14 天 API 试用；账户的实际余额和有效期仍以 Billing 为准。

## 可放大的离线细节版本

2026-10-02：按「能放大看清角色在做什么」的要求，对首个男生模型进行了本地处理，没有调用额外付费任务。原始 GLB 的 SHA-256 和全部贴图保持不变。审查采用 `artifacts/home3d-models/silver-red-v1/lod-v2/`（v1 为首轮候选，保留以便比较）。

| 版本 | 三角面 | 文件大小 | 保护策略 |
| --- | ---: | ---: | --- |
| 近景 | 180,000 | 7,953,324 字节 | 保留 50,552 个脸及手部顶点的原始位置、法线、UV 数据，保留贴图接缝 |
| 中景 | 70,000 | 4,578,072 字节 | 保留 27,847 个脸部顶点的数据，保留贴图接缝 |
| 远景 | 25,000 | 3,264,020 字节 | 使用法线和 UV 误差约束，适用于人物较小的视角 |

减面使用 [meshoptimizer 官方算法](https://github.com/zeux/meshoptimizer/blob/master/js/README.md)的属性误差约束和顶点保护；该保护区域只适用于已核对的这个男生模型，不自动套用其他角色。所有版本独立从原始模型生成，不连续减面以累积误差。输出目录已存在时拒绝覆盖。

```powershell
node scripts/optimize-home3d-character.cjs artifacts/home3d-models/silver-red-v1/character.glb artifacts/home3d-models/silver-red-v1/new-lod-directory
node scripts/check-home3d-character-lod.cjs artifacts/home3d-models/silver-red-v1/character.glb artifacts/home3d-models/silver-red-v1/lod-v2
node scripts/preview-home3d-character-lod.cjs --check
node scripts/preview-home3d-character-lod.cjs
```

最后一条命令在 `http://127.0.0.1:8796/preview` 提供本地交互预览，可拖动旋转、滚轮／双指缩放、切换全身／脸／手、同视角对比原始模型。它默认按角色在画面中的 CSS 像素高度选档，支持正交相机变焦，并以 12% 回差避免档位反复跳动；远景到近景可以直接跨档。按需载入并保留至多两个模型，载入失败时保留当前画面，迟到的结果不能覆盖最新视角。

结构及保留数据检查在 `preservation-review.json`，各档文件检查在 `*-intake.json`，手机截图和浏览器证据在该目录。浏览器检查覆盖放大切档、原始对比、快速切换、下载失败，以及 320／375px 和 47／59px 安全区的自身预留／父容器预留情况。截图已经人工核对脸、发型和手；图像差异数字只作对比记录，不是质量评分或真机性能保证。

这里只完成了静态外观细节版本与预览。保护网格不等于已做好动画拓扑；尚需绑定、动作变形、家具接触及实体手机的帧率／内存测试。小屋现有两个人物尚未被这些模型替换。

### 近景清晰度复查

2026-10-02 用户指出放大后的脸模糊，原始与优化版本同视角截图均有此问题。原始 GLB 的全身 base-color、normal、metallic-roughness 贴图均为 2048×2048；减面过程完整保留了它们，因此保留原始数据并不代表原始外观已达到近景要求。按本角色正面脸部区域的 UV 三角形面积估算，脸部只占约 2.10% 贴图面积（约 8.82 万纹理像素，面积等效约 297×297，并非一张实际独立的 297px 图片）。原始五官纹理存在涂抹及细节丢失，继续增加三角面不能恢复这些纹理信息。

**近景外观未通过用户验收，暂停将此模型当作完成的人物接入小屋。** 结构校验、减面误差和原始数据保留检查不代替近景外观验收。下一轮必须检查正面／侧面的眼睛、嘴唇和皮肤，面部贴图修改须保持 UV 对齐、角色身份及衣服材质；候选图或清晰效果图也不能代替实际模型渲染证明。

首轮内置生图修改 UV 图集的候选已拒绝：眼睛更清楚，但实际 GLB 的发际线及侧脸出现明显接缝。候选保留在本地 `artifacts/home3d-models/silver-red-v1/texture-diagnosis/face-atlas-candidate-v1.png`，没有替换预览或运行时。该候选实际输出为 1254×1254，未达到请求的 4096 分辨率，也未保持严格的 UV 对齐。

下一步采用 [Tripo 官方重新贴图接口](https://developers.tripo3d.ai/zh/docs/models-texture)，对已有几何体重新传入同一张人物参考图。`scripts/retexture-home3d-character.cjs` 显式选择 `extreme`（官方定义为 8K）、几何对齐和去光照，官方 [价格](https://developers.tripo3d.ai/zh/pricing)为 30 积分。该命令只创建一次付费任务；保存提交状态后再发送 POST，断线续查原任务，结果不明时拒绝自动重试，下载失败可续查重新下载。已有模型与凭证不写入或覆盖输出。高清文件仍需要正脸、侧脸实际渲染检查，不能仅凭分辨率判定清晰。

```powershell
node scripts/retexture-home3d-character.cjs artifacts/home3d-models/silver-red-v1 docs/design/home3d/character-references-v1/silver-red-front-v1.png artifacts/home3d-models/silver-red-v1/hd-texture-v1
```

2026-10-02：高清任务 `bc25fbb0-6e37-4be7-9697-f7afc31a6988` 成功，实际扣费 30 积分；任务结束后账户返回可用 540、冻结 0。输出 `hd-texture-v1/character.glb` 为 58,594,152 字节，SHA-256 `a0165db1717342059d2bfc758e6c91241888544cf817e70cc94979fa49089d88`，包含真实 8192×8192 色彩贴图和两张 4096×4096 辅助贴图，校验 0 错误。源文件未改动。导出后的顶点、UV、索引顺序与原始文件不同，不能直接把新图集套到旧 LOD；本次从新文件分别生成各档，保持每档的 UV 和图集配对。新旧包围盒、顶点数与三角面数一致，这些检查不等于证明逐三角形几何完全相同。

本地预览现使用 `hd-texture-v1/review-lods-v3/`：近景 18 万面／16,232,904 字节，中景 7 万面／8,252,884 字节，远景 2.5 万面／3,541,456 字节。近景完整保留官方输出的 8K 色彩图；中远景仅做贴图尺寸与编码处理，辅助贴图按预览所需尺寸缩小。法线强度从 1 降为 0.3，实际模型同视角比较减少了嘴部被夸大的黑色凹槽。旧原始文件仍可同视角对比。眼睛比标准版清楚，但眼周与嘴唇还不能作为最终人物效果验收；此版明确标为候选，不用于入屋或绑定。8K 色彩图显存开销较大，近景包大小不等于运行时显存，本地桌面预览不证明手机性能。手机布局及下载失败保护的证据保存于候选目录 `browser-review.json` 和截图。

此目录仅保存设计参考，不接入应用运行时，避免将图片误作为已完成的 3D 角色。

## 单人建模输入与文件检查

`silver-red-front-v1.png` 和 `bunny-blue-front-v1.png` 分别是依据男生 v3、女生 v1 整理的单人正面全身参考。使用内置 image_gen.imagegen 生成，完整提示词见 `front-input-prompts.json`。保留三视图供外观核对；图生模型第一轮可使用单人图。它们依然是 PNG，不是模型。画布上占比不等于入屋尺寸。

模型下载后，先导出内嵌贴图的 GLB，再运行只读检查：

```powershell
npm install --prefix artifacts/home3d-tools gltf-validator@2.0.0-dev.3.10
node scripts/check-home3d-character-model.cjs 'C:\path\character.glb'
node scripts/check-home3d-character-model.cjs 'C:\path\character.glb' --require-rig --require-animations
```

工具使用 Khronos 官方 [glTF Validator](https://github.com/KhronosGroup/glTF-Validator)，验证文件结构和二进制数据，报告当前场景的网格、绑定骨骼与动作通道。静态模型可以通过第一轮文件检查，但加上 `--require-rig` 或 `--require-animations` 后缺少对应结构会失败。无效文件、外部资源和读取错误不会显示成功。工具不上传文件、不访问服务账号、不改模型或存档；不会自动安装依赖。

检查通过仅表示可以进入下一轮审查。网格是否有完整体积、角色是否相似、骨骼是否适合人体、动作是否自然、Idle/Walk/Sit/Sleep 的命名对应、移动端大小及坐躺接触都需要实际模型审查。工具不证明无穿模，也不将模型自动接入角色。

2026-10-01 核对网站套餐费用：Meshy 免费方案每月 100 积分，但官方帮助页写明不能下载新生成模型；Pro 标价 20 美元/月。[Meshy 方案说明](https://help.meshy.ai/en/articles/12062933-which-meshy-plan-is-right-for-you-free-vs-pro-vs-premium-vs-ultra)。Tripo 网站免费方案每月 200 积分、有限导出（当时表格标明 H2.5），仅非商用；网站套餐与开发者 API 试用额度分开，以各自控制台为准。付费计划和年付/月付需在购买时确认。[Tripo 价格页](https://www.tripo3d.ai/pricing)。2026-10-02 已使用用户授权的现有 Tripo API 账号生成上述首个男生静态 GLB；没有代用户注册或购买套餐。
