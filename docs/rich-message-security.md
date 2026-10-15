# 富文本消息的权限边界

角色卡、正则替换和模型返回的 HTML 都是不可信输入。消息渲染器只把受控占位 iframe 放进主页面，再把 HTML 赋给其 srcdoc。iframe 使用 `sandbox="allow-scripts"`，不授予同源、顶层导航、弹窗或表单提交权限。普通 Markdown 的无属性格式标签继续显示在聊天气泡中；带属性的行内 HTML 同样进入隔离框架。

框架脚本不能读取主页面 DOM、localStorage、IndexedDB 或 API 配置。CSP 禁止网络接口调用、外部脚本、子框架、对象、base 和表单提交。HTTPS 图片、音视频以及字体仍可显示；卡片没有收到任何用户凭据。卡片的外部链接不导航。

唯一的 postMessage 协议是 `bynd-rich-size`。主页面同时检查不透明来源、实际 iframe 窗口、随机通道、有限数字，并将高度限制为 40–1200px。没有执行代码、发送消息、读取存储或代请求 API 的协议。移除的框架不能再更新页面。

Android 的 `addJavascriptInterface` 会暴露给子框架，因此 APK 使用更严格的 CSP：移除卡片脚本和事件属性，只允许带随机 nonce 的内置控制程序执行。展开 details、常见解密遮罩和卡片内弹层保留；依赖任意自定义 JavaScript 的 APK 卡片不再执行。网页版卡片的自定义脚本可以在自身隔离框架内运行，但不能调用主应用函数。参见 [Android 原生桥说明](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges) 与 [iframe sandbox 说明](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)。

Android 默认禁止外部明文 HTTP，仅为本机音乐和 MCP 服务保留 `127.0.0.1`、`localhost`。自动云备份和设备迁移排除应用私有数据；用户主动导出的备份流程不受此规则影响。

AI 代理 Worker 按 BYND、Worker 同源和 APK 的 `null` 来源返回明确的 CORS 头，并在转发前拒绝其他来源。`null` 不是可靠的身份标识，来源检查也不是鉴权；调用仍要求用户自己的 Bearer Key。这不是新增的服务端共享密钥授权机制。Worker 修改需要另行部署后才在线生效。

验证：`node scripts/check-rich-message-security-browser.cjs` 覆盖虚构密钥读取、事件处理、框架存储隔离、真实点击、展开、自适应高度、伪造消息和 APK 受控交互。`tests/security-config.test.cjs` 覆盖 Worker 拒绝路径及 Android 配置。`tests/home3d-rigging.test.cjs` 缺少可选校验工具时明确跳过；工具齐全时仍执行真实离线校验。

这次修复已确认的聊天入口及报告中的配置问题，不代表全仓库每处 innerHTML 都已完成安全审计。后续应按输入来源和实际 HTML 上下文逐点审查，不能仅靠统一转义函数或搜索数量判定安全。
