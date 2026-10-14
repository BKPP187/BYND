# BYND 用户账号（源码版本 1.1.898）

用户入口是 `/account.html`，购买页导航、管理页登录区和领取页都有链接。账号用于保管已经持有的授权，不会自动赠送 License，也不授予后台管理权限；Android 激活后的离线使用不需要保持网页登录。

## 本机完整体验

1. `node scripts/license-dev-server.cjs` 启动本机 8993 服务，打开 `/account.html`，填写称呼、邮箱、15–128 字符密码及确认密码；已有激活码可在新增的“激活码（可选）”一行填写。
2. 注册提交后先保存待验证请求，邮箱验证成功才创建账号。填写激活码时只保存校验后的License ID，验证时再次检查状态并在同一原子事务创建账号、保存授权，不提前占用激活码。无效、停用或其他账号已保存的码明确拒绝；并发验证只有一位所有者，保存失败整个注册事务回滚。本机不会向真实邮箱发信。
3. 打开 `/license-admin.html`，使用 Git 忽略的 `.bynd-license-dev/admin-token.txt` 登录。展开“本机测试信箱”，读取邮件并打开验证链接，点击确认。测试邮件仅管理员可查看，退出后台会清除页面内的链接。
4. 返回用户页面登录，在“保存已有激活码”中输入已经领取的完整激活码。以后可在“我的授权”查看、复制、保存文本和下载最新 APK。
5. 忘记密码时申请重设链接，在同一测试信箱查看。重设成功后所有旧登录立即失效，需要用新密码重新登录。

账号、授权和邮件存储在 `.bynd-license-dev/`；升级本机服务会追加 `0003_accounts.sql`，保留原来的发码密钥、APK 和数据库。测试账号不会上传。测试邮件最多保留最近30封，只用于开发；实际发信使用 Resend，不能把这个测试信箱挂到公网。

## 接口与边界

| 接口 | 用途 |
| --- | --- |
| POST `/account/v1/register` | 申请注册验证邮件，已有账号不会覆盖密码 |
| POST `/account/v1/verify` | 一次性验证邮箱并创建账号，不自动登录 |
| POST `/account/v1/login` | 校验密码，签发七天会话 Cookie |
| GET `/account/v1/me` | 当前账号或 null |
| POST `/account/v1/logout` | 撤销当前服务器会话；保存失败时不显示退出成功 |
| POST `/account/v1/forgot` | 申请一次性重设链接，公开响应不直接透露是否注册 |
| POST `/account/v1/reset` | 重设密码、增加密码修订号并撤销旧会话 |
| GET `/account/v1/licenses` | 只返回当前账号保存的授权元数据 |
| POST `/account/v1/claim` | 凭完整激活码保存授权，不绑定设备 |
| POST `/account/v1/licenses/:id/code` | 只允许所有者查看有效授权的码，核对稳定签发密钥 |
| GET `/admin/v1/account-mail` | 仅本机、仅管理令牌可读取开发测试邮件；HTTPS 正式来源不可用 |

邮箱统一去首尾空格并转小写。密码不裁剪、不存明文，使用独立 `ACCOUNT_SECRET` 进行 HMAC pepper，随机盐和 scrypt（N=16384、r=8、p=5，16 MiB）。`ACCOUNT_SECRET` 与发码密钥不同，必须备份并保持稳定；丢失后原密码不能正常校验。参考 [OWASP 密码存储参数](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) 与 [Workers node:crypto 支持](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/)。

会话 Cookie 在 HTTPS 使用 `__Host-` 前缀、Secure、HttpOnly、SameSite=Strict、Path=/，不写 localStorage/sessionStorage。服务只保存会话摘要。写操作同时要求严格匹配配置的 Origin 和自定义头，未开放跨站 CORS。IP 限流及 D1 邮箱／账号计数限制分布式猜测；密码重设与一次性链接消费使用 D1 原子 batch，并校验密码修订号。验证／重设链接20分钟有效，令牌只存摘要；浏览器片段在当前标签页暂存以支持刷新，验证完成或返回登录后清除。邮件提供者失败和重定向都会拒绝，不显示邮件已送达。

授权归属保存于独立的 `account_licenses` 表。不会根据后台填写的联系邮箱自动分配，也不会因改收件邮箱而转移所有权。必须持有完整激活码，同码重复保存幂等，同码归属其他账号则拒绝。注册、保存授权和设备激活是三个独立动作。所有权纠纷需支持人员核实后处理，不能通过注册一个同名邮箱夺取授权。

## 正式环境准备

`workers/wrangler-license.toml.example` 已包含 `nodejs_compat`、`ACCOUNT_RATE_LIMITER`、账号路由及网页路径。部署前追加迁移，设置独立的32字节以上随机 `ACCOUNT_SECRET` secret、准确的 `PUBLIC_ORIGIN`、已验证发信域名的 `EMAIL_FROM` 与 `RESEND_API_KEY`。确认邮件可接收后启用 `EMAIL_ENABLED`、`ACCOUNTS_ENABLED`；这些动作不启用 `SALES_ENABLED` 或 Android 强制激活。密码哈希需要足够的 Worker CPU 预算，模板采用1000ms，需按实际计划和并发压力测量，不能用削弱哈希参数解决配额不足。没有部署或发送真实验证邮件。

注册页面和相关网站资源排除在 Android／iOS 同步之外。当前源码版本为1.1.898，没有重新打包；现有可下载的校验 APK 仍是1.1.896。激活码管理后台已部署到CF，客户注册及真实邮件保持关闭，详见 [CF上线记录](cloudflare-license-live.md)。

## 验证

1.1.898新增注册激活码校验、并发归属和事务回滚验证，全量1305项通过；本机账号浏览器7组、workerd5组和CF公网5组检查通过。线上后台实际执行创建、查找、恢复激活码、禁用／恢复、解绑及领取，测试授权最后停用。下面保留上一版1.1.897的首次验证记录。

`node --test tests/license-accounts.test.cjs` 覆盖注册未验证、重复／过期链接、跨账号读取、设备绑定分离、密码重设和并发重放、旧会话失效、CSRF、Cookie、存储失败、邮件失败／重定向及限流。

`node scripts/check-account-browser.cjs` 在隔离的实际 SQLite/HTTP 服务测试注册、验证、后台测试信箱、登录、保存授权、文本保存、退出、找回密码和会话失效；覆盖320/390/430/1280px、47/59px顶部安全区由父容器或顶栏分别预留。截图与检查结果在 `artifacts/account-browser/`。测试令牌不打印，测试数据使用临时目录。

`scripts/check-account-worker.cjs` 使用 Cloudflare workerd/Miniflare 运行实际生产模块、D1、密码哈希、限流与重设事务；外部邮件全部截获，不发真实邮件。安装 Miniflare 后直接运行，或将 `BYND_MINIFLARE` 指向其本机模块目录；兼容新版本的选项转换。全量验证仍使用 `node tests/run.cjs`。

本次验证：全量1302项通过，0失败、0跳过；账号浏览器6组流程及原交付浏览器8组流程通过。workerd4组检查通过，注册墙钟时间184ms（仅本机单请求，不能替代正式并发／CPU验收）。Wrangler4.149.0用不含正式凭据的临时配置完成dry-run打包，账号页面与所有D1/R2/限流绑定可识别，没有部署。修正了同页面片段导航的验证界面切换，以及Worker邮件请求不支持`redirect: error`的问题；现在使用manual并拒绝3xx，不跟随携带凭据的跳转。实际查看320/390px注册、登录和我的授权截图，确认没有横向溢出、标题孤字或安全区重复间距。日志：`artifacts/account-all-tests.log`，浏览器与Worker检查：`artifacts/account-browser/`。
