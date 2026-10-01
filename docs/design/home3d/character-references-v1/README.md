# 小屋人物建模参考

2026-10-01 使用内置 image_gen.imagegen，分别依据用户提供的两位人物参考图生成。原始生成 PNG 完整保留，没有裁切、改背景或修改图像。完整提示词和输入对应关系见 `prompts.json`。

- `silver-red-turnaround-v1.png`：银白短发、红眼、耳饰、黑外套与白衬衫。补全黑裤和黑靴。
- `silver-red-turnaround-v2.png`：按用户要求缩小男生头身比例、加宽肩部、拉长躯干和腿，改为更成熟修长的帅气外观；保留银发、红眼、耳饰与服装。使用内置 image_gen.imagegen 编辑，完整提示词见 `male-v2-prompt.json`，原图 v1 保留。
- `silver-red-turnaround-v3.png`：用户指出 v2 的成人比例显得太大，重新调整为约四头身的紧凑游戏人物，保留成熟五官、肩背、服装与银发红眼。完整提示词见 `male-v3-prompt.json`。图片中的身高不等于实际模型尺寸；人物模型尚未生成，坐躺时与家具的比例仍需在运行场景中校准，未声称完成入屋验证。
- `bunny-blue-turnaround-v1.png`：银白长发、紫粉眼睛、兔耳、蓝色蝴蝶结、蓝白衣裙与黑色束腰。补全裙摆、白色连袜和蓝色鞋。

两张图统一为柔和的立体娃娃风格，包含正面、侧面和背面全身视图。这是外观概念参考图片，不是实际 3D 网格、精确正交工程图、骨骼绑定结果或动作文件；不能直接当作 GLB 人物放进小屋。生成视图之间的细节一致性需要在建模时确认，背面及未见服装细节属于补全设计。

下一步先对一个角色生成模型，检查四周外观、模型结构和移动端资源规模，再进行骨骼绑定和站立、行走、坐下、睡眠验证。长发、兔耳、宽袖和裙摆需要检查变形与家具接触。生成出的静态模型不代表自动具备自然动作或无穿模保证。

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

2026-10-01 核对服务费用：Meshy 免费方案每月 100 积分，但官方帮助页写明不能下载新生成模型；Pro 标价 20 美元/月。[Meshy 方案说明](https://help.meshy.ai/en/articles/12062933-which-meshy-plan-is-right-for-you-free-vs-pro-vs-premium-vs-ultra)。Tripo 免费方案每月 200 积分、有限导出（当前表格标明 H2.5），仅非商用；付费计划和年付/月付需在购买时确认。[Tripo 价格页](https://www.tripo3d.ai/pricing)。尚未注册、购买、调用这些服务或生成真正的人物 GLB。
