# Tripo 用户个人连接

设置 → 3D 人物提供 Tripo 开发者控制台链接、API 地址、遮蔽的个人密钥字段、保存、余额测试与清除。默认地址采用官方 v3：`https://openapi.tripo3d.ai/v3`。没有项目内置密钥。

连接配置存于当前设备的 `bynd_tripo_private_v1`，与聊天 API、角色资料和小屋存档分开。常规备份不导出它，导入备份也不能覆盖它。保存或清除失败会报告错误；读取损坏配置时保留原数据。测试使用填写中的配置，不自动保存；只调用 GET 余额接口，不触发模型任务。字段修改、清除或重新打开后，迟到的测试结果不会覆盖当前状态。错误信息不展示原始上游响应或密钥。

官方请求走现有 Worker 的固定转发路径 `/mcp/relay/tripo/v3/account/balance`，目标写死为 `https://openapi.tripo3d.ai/v3/account/balance`。只允许余额 GET 与预检，不允许任意地址或模型生成请求。转发不持久保存用户密钥。自定义 HTTPS v3 兼容地址直接收到用户填写的密钥；说明放在展开帮助中。

官方依据：[接口与认证](https://developers.tripo3d.ai/en/docs/account)、[API 计费](https://developers.tripo3d.ai/en/docs/billing)。网站会员、网站免费额度与开发者 API 额度不能混为一谈，本页以 API 控制台余额为准。

2026-10-01 本地版本 1.1.778。`node tests/run.cjs` 928 项通过；`node scripts/check-tripo-settings-browser.cjs` 覆盖保存与重载、默认空密钥、遮蔽、余额查询、失败、备份排除、清除、320/375px 与 47/59px 安全区的父容器和顶栏两种归属。截图在 `artifacts/tripo-settings/`。使用示例密钥和模拟余额响应，未使用真实账户。

2026-10-01 连接修复（本地版本 1.1.780）：线上旧 Worker 缺少 Tripo 路由，带 Authorization 的 CORS 预检返回 404，浏览器因此只显示网络错误。前端增加不携带密钥的缺失服务诊断，以及余额为 0 时的明确提示。完整测试 932 项通过，手机布局检查通过。

用户完成 Cloudflare OAuth 授权后，已部署固定余额路由。部署前下载服务器现有 Worker，并确认本次打包结果与其差异只有新增 Tripo 路由；原推送、MCP 与其他转发保留。部署版本 ID：`46fa0171-a739-47a9-b4ce-902cb6b10f16`。线上 OPTIONS 实测 204、允许 GET 和 Authorization、允许文件页面的 null Origin。使用用户临时授权密钥，在真实浏览器中完成余额请求，得到成功状态与 API 余额 0；临时密钥没有保存到项目文件或浏览器应用数据。真实检查结果见 `artifacts/tripo-settings/live-connection.json`。

设置与余额查询已可连接；人物生成、绑定和运行时模型加载仍未实现，参考 PNG 不会被当作真正 3D 人物接入。余额接口返回 0 时，还需在 Billing 核对免费钱包与有效期，不能直接判定没有试用积分。此阶段未构建 APK，未执行 git push。

2026-10-02：申请说明增加 [Billing 页面](https://platform.tripo3d.ai/billing) 和用户提供的手动入口「Add to credit balance」。按页面提示获取积分，具体是免费试用还是充值以实际页面为准。免费试用有效期为 14 天，到期时间以 Free Wallet 旁的 `valid until` 为准；不把所有账户的额度写成固定 300 或 600。用户截图显示 API Wallet 为 0、Free Wallet 为 600，这两个钱包应分别核对，v3 余额查询不能替代账户试用状态的确认。未实际创建模型任务来验证该账户的试用扣费。

同日继续核对官方 [Blender 教程](https://www.tripo3d.ai/blog/tripo-blender-plugin-tutorial)：免费试用的领取按钮是「Get your free wallet」，明确写明 600 积分、14 天。说明已区分这一领取入口与「Add to credit balance」添加积分入口；免费钱包已显示余额时，先核对到期时间，不宣称必须充值或转入另一个钱包才能试用。首个模型的开发工具与恢复检查已准备，实际提交仍需当前可用密钥。
