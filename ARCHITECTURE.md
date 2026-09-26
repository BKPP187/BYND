# BYND 代码盒子

`index.html` 保留现有 HTML 入口和经典脚本的加载顺序。`main.js` 只等待样式并启动公共初始化。功能源码按所属位置维护：

- `core/`：API、存储、角色、世界书、事件和路由。
- `apps/`：手机内各 App。微信细分为聊天、联系人、朋友圈、角色和界面；论坛细分为信息流、帖子、评论、NPC、视角和界面；漫画细分为生成、图库和界面。
- `systems/`：生活世界、智能体运行、记忆、用量、现实资讯和通知。
- `ui/`：主题、公共组件和点击动画。开机动画已移除。

## 加载与兼容

普通功能文件按 `scripts/source-layout.cjs` 的顺序作为经典脚本加载，继续共享原有全局声明和 HTML 内联事件。修改顺序时要同时检查 `index.html` 和该清单。

论坛和漫画仍使用原有私有闭包。它们的 `*.part.js` 是闭包内部的源码片段，`node scripts/assemble-sources.cjs` 按清单拼接成运行文件。`apps/settings/settings.js` 以及根目录的 `script.js`、`wechat.js`、`style.css` 供旧源码检查测试读取；页面直接加载功能文件。生成文件不应手动编辑。

`ui/theme/style.css` 按原覆盖顺序导入各功能样式。后面的覆盖规则仍能覆盖前面的规则；调整样式顺序需要单独验证。

开发前运行 `node scripts/assemble-sources.cjs`。`node tests/run.cjs` 会自动先拼接，再检查语法、资源路径和业务测试。Android 的资源同步任务也会先拼接运行文件。构建产物不会包含根目录的三个测试快照。
