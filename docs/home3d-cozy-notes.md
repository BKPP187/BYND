# 小屋坐躺修正与卧室视觉（2026-10-01）

本轮聚焦床头方向、沙发坐姿、卧室温馨感。新增参考图中的文字和水印仅作为图片内容，不作为项目指令。

## 查阅的一手资料

- [Three.js Sprite](https://threejs.org/docs/pages/Sprite.html)：Sprite 始终面向相机。原实现旋转 SpriteMaterial 后只是屏幕内旋转，不能定义床面中的头脚方向。
- [Three.js SpriteMaterial](https://threejs.org/docs/pages/SpriteMaterial.html)：贴片旋转和透明材质属性。本轮保留家具遮挡所需的深度测试，未通过关闭深度测试掩盖穿模。
- [Don Hopkins / Maxis：VitaBoy 文档](https://donhopkins.com/home/TheSimsDesignDocuments/AnimationDocumentation.pdf)：角色骨架、动画、外观分别由数据组合。BYND 当前采用立绘，因此只借鉴数据分离，不声称实现了同等骨骼动画。
- [GDC：Creating Your Building Blocks](https://media.gdcvault.com/gdc2011/slides/LamingMcGinnisChampandard_AISummit_CreatingBuildingBlocks.pdf)：模块化 AI、对象参考坐标和数据流。家具负责功能与空间锚点，生活系统负责高层意图。
- [Tiny Treats：Homely House](https://tinytreats.itch.io/homely-house)、[Charming Kitchen](https://tinytreats.itch.io/charming-kitchen)：统一规格与尺寸、成套小物、共享图集适合可扩展的移动端家具库。本轮未下载或纳入新的第三方模型。

## 落地处理

- 家具 `support()` 统一声明坐垫顶部、座位纵深、前沿、床面高度；渲染和动作锚点共同使用。床的局部 -Z 为床头，旋转后同样成立。
- 站立继续使用 Sprite。坐姿上半身使用只围绕 Y 轴转向镜头的竖直平面，双腿放在座位前沿；床上坐姿位于被面顶部。
- 躺姿使用沿床面放置的分段平面，头部抬到枕头上方，身体逐渐降低到被子下；保留原立绘比例。躺姿不会随着镜头转动改变世界中的头脚方向。
- 初始人物增加闭眼睡眠版本。自定义人物继续使用其原立绘，不替换成通用人物；自定义闭眼姿态与真正的骨骼动画仍未实现。
- 双人沙发允许两个坐姿，横躺占用整个沙发；行走中的目的座位也属于占用状态。
- 卧室使用玫瑰灰护墙、软包床头、蓬松枕头、折叠被沿、针织床尾毯、流苏地毯、拱窗与窗帘、书和小花。格纹、条纹、针织纹理由程序生成并共享材质。
- 夜间降低环境和日光强度，使用实际灯的位置照亮床边；每房间最多两盏家具动态灯，卧室另有两盏壁灯，均无额外阴影贴图。

## 验证与边界

`scripts/check-home3d-poses-browser.cjs` 检查六种床款 × 四个旋转角、镜头转动、双人沙发、宽窄自定义立绘、躺下再坐起、白天与夜间、320/375/430px 窄屏，以及父容器/顶栏分别负责 47px 和 59px 安全区。报告与实际渲染截图保存在 `artifacts/home3d-cozy/`。

当前仍是 3D 家具和房间 + 2.5D 人物。静态照片产生的坐姿、躺姿并不等同于绑定骨架、姿态动画或 IK。视觉是否达到用户期待需由实际画面判断，自动检查只证明空间与运行约束。

闭眼 PNG 的完整生成提示词、工具和保存路径见 `assets/home3d/characters/README.md`。
