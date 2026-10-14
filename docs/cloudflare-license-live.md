# Cloudflare 激活码后台：2026-10-13

按用户要求，授权服务已实际部署到 Cloudflare Workers，使用独立 D1 数据库 `bynd-license`，不是浏览器本地生成码。

- 后台表单：[https://bynd.ccwu.cc/license-admin.html](https://bynd.ccwu.cc/license-admin.html)。
- 管理令牌：本机 `.bynd-license-secrets/admin-token.txt`，复制到登录表单；不要使用 `.bynd-license-dev/admin-token.txt`，后者仅对应本机测试后台。
- Worker：`bynd-license`；D1 已追加0001–0004迁移。实际配置在Git忽略的 `workers/wrangler-license.toml`。
- 管理令牌、稳定发码秘密、签名私钥与独立账号秘密已写入Worker secrets，没有放进网页或APK。生产密钥只在 `.bynd-license-secrets/` 备份，保留并妥善备份，不能用本地测试密钥替换。

登录后填写购买记录编号、邮箱（均可选），点击“创建激活码”。后台生成的码保存在CF数据库；可查找、重新查看码、生成领取链接、禁用、恢复和换机解绑。管理会话令牌只保存在当前页面内存，退出或刷新需要重新输入；用户注册不能取得管理权限。

接口只接管授权相关路径、购买／注册／管理／领取页面及其独立网站资源，保留官网根页面和已有MCP、音乐及模型代理路由。`PUBLIC_ORIGIN` 为 `https://bynd.ccwu.cc`，领取链接使用这个官网来源。Workers静态资源设置 `html_handling = "none"`，保证 `.html` 页面不会307跳到没有绑定路由的地址，参见 [Cloudflare HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)。

当前 `SALES_ENABLED`、`LICENSE_ACTIVATION_ENABLED`、`ACCOUNTS_ENABLED`、`EMAIL_ENABLED` 均为false：可以在后台管理测试激活码，尚未开售，不强制用户激活，不发送真实邮件。注册与邮箱验证的完整流程仍在本机测试服务体验，注册表单新增“激活码（可选）”，验证时与账号创建一起保存。正式客户注册需配置发信域名后另行启用。线上R2和APK分发尚未启用，未把本机安装包发布到公网。没有推送GitHub或触发Android构建，源码版本1.1.898，现有校验APK仍为1.1.896。

验证证据：全量 `node tests/run.cjs` 1305通过、0失败、0跳过；本机账号浏览器7组和交付浏览器8组通过，workerd5组通过。`node scripts/check-license-cloud.cjs` 实测公网表单、未授权拒绝、CF D1创建／幂等重试、搜索、禁用／恢复、解绑重放、激活码恢复和领取；5组检查通过，测试授权最终停用。只保留标明CF-SMOKE的测试审计记录，没有真实客户数据。结果在 `artifacts/license-cloud-checks.json`。

`node scripts/check-license-cloud-browser.cjs` 也已通过：实际打开官网后台，输入本机生产管理令牌，使用表单创建激活码、禁用并核对CF D1状态，然后退出登录。令牌没有写入浏览器存储；320/390px及父容器／顶栏分别预留47/59px安全区检查通过。测试记录以CF-UI-SMOKE标明并保持停用。截图已查看，结果在 `artifacts/license-cloud-browser/`。生产密钥目录已设置Windows ACL，仅当前用户及SYSTEM访问。

以后更新服务：先测试并执行 `node scripts/prepare-distribution-web.cjs`，使用上述私有配置运行 `wrangler deploy --config workers/wrangler-license.toml`；有新迁移先应用到这个独立D1，保留旧迁移不修改。没有自动部署或定时发布流程。
