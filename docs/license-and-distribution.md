# BYND 授权、交付与分发：开发阶段

已完成人工确认收款后的本地交付流程：管理后台创建 License → 领取链接／可选邮件 → 用户复制或保存激活码 → 公开下载 APK → 首次联网绑定设备 → 本机离线验证 → 签名更新清单 → 系统覆盖安装。2026-10-13按用户要求将激活码后台实际部署到CF Workers与独立D1，入口是 `https://bynd.ccwu.cc/license-admin.html`，操作及线上范围见 [CF上线记录](cloudflare-license-live.md)。自动支付没有接入，正式售卖、公众激活、客户注册与真实邮件继续关闭，未推送GitHub；线上APK/R2分发尚未启用。本机测试服务仍可体验完整链路。购买页保留用户确认的奶油白／草绿色／手绘风格。

## 默认状态

| 开关 | 默认 | 影响 |
| --- | --- | --- |
| Worker `LICENSE_ACTIVATION_ENABLED` | `false` | 公众激活返回尚未开放；管理端仍可签发测试码 |
| Worker `SALES_ENABLED` | `false` | 填写购买地址或价格不会自动开售 |
| Worker `EMAIL_ENABLED` | `false` | 不调用真实邮件服务 |
| Worker `ACCOUNTS_ENABLED` | `false` | 正式注册／登录关闭，完成邮件配置后再启用；本机测试服务独立开启 |
| Gradle `byndRequireLicense` | `false` | Android 照常进入应用，不读取或创建激活凭证 |
| Gradle `byndEnableUpdates` | `false` | 不自动联网检查更新，不显示新更新入口 |

这些开关独立。以后可以先启用更新，继续不要求用户激活。当前网页版、iOS 没有新增授权门槛。没有写入短期过期时间或强制联网续期。

## 本机使用

`node scripts/license-dev-server.cjs` 启动 `http://127.0.0.1:8993`。服务只绑定回环地址，不提供任意工作区文件。`/shop.html` 是购买／下载页，`/account.html` 是用户注册／登录与我的授权，`/license-admin.html` 是管理后台，`/license-receipt.html#领取令牌` 是用户领取页。

首次启动生成独立的本地测试密钥与 SQLite 数据到 Git 忽略的 `.bynd-license-dev/`。管理令牌在 `.bynd-license-dev/admin-token.txt`，不打印到日志。它们不是正式签发密钥，不能拿本地测试授权当正式授权。测试服务开放设备激活用于自测，但售卖和邮件开关仍关闭。管理页令牌只在页面内存中保留，刷新、退出或闲置15分钟后需重新登录。

后台可以创建测试授权或填写已人工确认的购买记录，查找授权、查看码、生成领取链接、发送配置好的邮件、换机解绑、禁用／恢复、查看最近激活版本码，以及发布已校验的更新清单。邮箱和购买记录属于管理数据，不在公众状态接口返回。领取令牌只在同一标签页的 sessionStorage 保留以支持刷新；权限受限时保留原 URL 片段，不写入 localStorage。复制权限被拒绝时选中激活码并提示手动复制，也支持保存文本。

## 已实现的接口

服务入口：`workers/license/worker.mjs`。独立 D1，不复用推送 Worker 的 KV。

| 接口 | 权限 | 行为 |
| --- | --- | --- |
| GET `/license/v1/health` | 公开 | 读取公众激活开关 |
| POST `/license/v1/challenge` | 激活开关＋限流 | 领取绑定激活码摘要／设备指纹的五分钟挑战 |
| POST `/license/v1/activate` | 激活开关＋限流＋设备证明 | 验证激活码、原子绑定一台设备、签发凭证 |
| GET `/updates/v1/android/stable` | 公开 | 返回签名清单；没有正式版本时返回 204 |
| POST `/admin/v1/licenses` | 管理 Bearer token | 创建激活码，相同 requestId 重试返回相同码 |
| GET `/admin/v1/licenses/:id` | 管理 Bearer token | 查看状态和设备绑定，不返回激活码摘要或私密凭证 |
| POST `/admin/v1/licenses/:id/disable` | 管理 Bearer token | 禁止后续激活与重新签发 |
| POST `/admin/v1/licenses/:id/unbind` | 管理 Bearer token | 清除服务端设备绑定，允许换机；不会重新启用禁用码 |
| POST `/admin/v1/licenses/:id/enable` | 管理 Bearer token | 恢复后续激活资格 |
| POST `/admin/v1/releases/android/stable` | 管理 Bearer token | 发布签名清单，versionCode 必须递增 |
| GET `/admin/v1/licenses?q=&cursor=` | 管理 Bearer token | 搜索、分页，不返回激活码摘要 |
| POST `/admin/v1/licenses/:id/recover` | 管理 Bearer token | 重新查看有效授权的激活码 |
| POST `/admin/v1/licenses/:id/delivery` | 管理 Bearer token | 创建可重试的30天领取链接 |
| GET `/admin/v1/licenses/:id/deliveries` | 管理 Bearer token | 读取最近交付状态 |
| POST `/admin/v1/deliveries/:id/email` | 管理 Bearer token | 明确操作才发送；区分接受、失败和未确认 |
| GET `/distribution/v1/store` | 公开 | 实际售卖状态、价格文案和最新下载信息 |
| GET `/admin/v1/config` | 管理 Bearer token | 后台功能是否已配置，以及保存的页面地址 |
| POST `/admin/v1/store` | 管理 Bearer token | 保存价格和购买／联系地址，不改变售卖开关 |
| POST `/admin/v1/artifacts/:sha256` | 管理 Bearer token | 以 R2 校验摘要上传 APK，失败不标记可下载 |
| GET `/admin/v1/artifacts` | 管理 Bearer token | 已上传校验的安装包 |
| GET／HEAD `/downloads/:固定文件名` | 公开 | 支持完整文件、Range、ETag；元数据不符拒绝下载 |

管理接口没有开放 CORS，不在页面或 APK 中嵌入管理令牌。公众接口给原生客户端调用，也不需要浏览器 CORS。限流绑定缺失、签名失败、数据库写入失败都会返回失败，不伪装成成功。不记录激活码、密钥或数据库异常详情。

数据库迁移依次应用 `0001_license.sql` 和 `0002_distribution.sql`。除授权、挑战、审计、更新清单之外，新增领取记录、APK 元信息和购买页配置。激活记录保存实际 `versionCode`，不在每次启动联网收集使用信息。禁用、恢复和解绑接受稳定 `requestId` 及可选 `expectedRevision`；丢失响应后重试不会再次解绑，旧修订号不能误操作新绑定。

激活码由稳定签发秘密和 UUID v4 的 HMAC 派生出 128 位值，不在数据库保存原码。重复签发请求可恢复相同激活码；`orderRef` 唯一，避免同一人工购买记录重复发码。`LICENSE_KEY_SECRET` 必须保留，不能随意替换；换它会导致旧码查询与恢复失败。

## 密钥与未来部署

暂时无需执行以下步骤。准备独立测试环境时再做：

1. `node scripts/license-admin.cjs keygen`，生成到 Git 忽略的 `.bynd-license-secrets/`；拒绝覆盖已有文件，不打印密钥。Windows 需自行限制文件权限并留加密备份。私钥绝不能放入网页、APK、聊天或仓库。
2. 复制 `workers/wrangler-license.toml.example` 为 `workers/wrangler-license.toml`，创建独立 D1 后填写数据库 ID。实际配置文件也已忽略。
3. 使用 Wrangler 分别配置 `ADMIN_TOKEN`、`LICENSE_KEY_SECRET`、`SIGNING_PRIVATE_JWK` 三个 secret，`SIGNING_KEY_ID` 对应生成的密钥编号。保留签发秘密与签名私钥的安全备份。
4. 本地应用迁移：`npx wrangler d1 migrations apply bynd-license --local --config workers/wrangler-license.toml`。远端测试环境另行应用迁移。数据库首次为空，没有现成正式 License。
5. 在准备好的独立测试环境启用公众激活与限流；再部署 Worker、配置路由。模板默认 `workers_dev = false`，未配置任何生效路由，文件本身不会发布服务。
6. 创建独立 R2 桶并配置 `APK_BUCKET`，将经过 apksigner 验证的正式证书摘要填入 `APK_SIGNER_SHA256`。APK 存储来源对应 Worker `APK_ALLOWED_HOSTS` 与 APK 的 `byndApkHosts`，两者必须一致。
7. `node scripts/prepare-distribution-web.cjs` 生成 `.bynd-distribution-web/`，仅含三个网站页面和网站资源；`ASSETS` 不指向整个仓库。模板已包含 D1、R2、限流和静态资源绑定。正式域名保留现有根应用与 `/mcp/*` 等路由，只新增模板列出的精确页面和授权／更新／管理／下载路径。页面由 Worker 加入 CSP、no-store 与 no-referrer 响应头，不给现有 App 根页面加不兼容的 CSP。
8. 如需邮件，使用已验证发信域名的 Resend 账户配置 `RESEND_API_KEY`、`EMAIL_FROM`，最后才设 `EMAIL_ENABLED = true`。未配置时生成链接仍可交付，点击发送会明确失败。启用正式售卖、公众激活和客户端门槛是不同动作，准备售卖前分别确认。

维护签名密钥时在 APK 的公钥映射里保留旧密钥编号；删除旧公钥会令已有永久凭证失效。采用标准 RS256 compact JWS：签名算法 `SHA256withRSA`、header 的 `typ` 区分 `BYND-LICENSE` 和 `BYND-UPDATE`。采用 RSA 是为了兼容 Android 23+ 与 Worker，并避免 ECDSA DER/raw 编码差异。

## 人工管理

环境变量 `BYND_LICENSE_URL` 默认为 `https://bynd.ccwu.cc`。只有本机测试来源允许 HTTP，其他必须 HTTPS；管理调用不跟随重定向，避免令牌外泄。`BYND_LICENSE_ADMIN_TOKEN` 只在当前本机环境中设置，勿放进命令参数。

```text
node scripts/license-admin.cjs create <UUID-v4> [人工购买记录编号]
node scripts/license-admin.cjs inspect <License-ID>
node scripts/license-admin.cjs list [搜索内容]
node scripts/license-admin.cjs disable <License-ID> <稳定UUID-v4>
node scripts/license-admin.cjs enable <License-ID> <稳定UUID-v4>
node scripts/license-admin.cjs unbind <License-ID> <稳定UUID-v4>
node scripts/license-admin.cjs delivery <License-ID> <稳定UUID-v4> [邮箱]
node scripts/license-admin.cjs email <领取记录ID>
node scripts/license-admin.cjs publish <更新清单.json>
```

创建前生成 UUID v4，网络失败后使用同一个 UUID 和购买记录重试，避免重复发码。管理后台也保留请求编号以支持丢失响应后的重试。没有支付 webhook；客户可将已经持有的激活码保存到账号，人工交付既可用后台也可用命令。禁用、解绑是明确的管理操作；网络结果不明时先用 inspect 核对状态，不盲目重新解绑刚激活的新设备。

领取链接有效期30天；数据库仅保存令牌摘要，服务端可恢复相同请求的链接。永久激活码不因领取链接过期而失效。过期后由管理端生成新领取记录，禁用授权不能通过领取页取码。

邮件发送记录使用稳定幂等键，超时或响应不可确认时标记 unknown，不声称未发送，也不声称已送达；服务接受时标记 accepted，并保留提供者 ID。超过23小时的未确认邮件拒绝自动重试，需人工核对，避免越过提供者24小时幂等保留期后重复发送。更换发信账户前先处理未确认记录。参考 [Resend 幂等键](https://resend.com/docs/dashboard/emails/idempotency-keys) 与 [发送接口](https://resend.com/docs/api-reference/emails/send-email)。

## Android 激活

原生 `MainActivity` 在加载 WebView 前检查授权。要求激活时显示 `LicenseActivity`；后台陪伴服务也检查授权。Android Keystore 保存不可导出的 RSA 设备私钥，公钥 SPKI 的 SHA-256 为设备指纹。激活挑战由设备私钥签名，服务端验证证明，不能仅凭伪造 `device_id` 激活。

服务器凭证包含产品、License ID、设备指纹、永久授权、签发时间、修订号。APK 仅内置验证公钥；每次离线启动验证数字签名、产品／类型、设备匹配和本机私钥持有证明。凭证以 AtomicFile 写入 `getNoBackupFilesDir()`，写入后再次验证，失败保留重试入口。聊天导入导出、清缓存和系统备份均不携带激活凭证或设备私钥。

准备好的测试环境使用构建参数：

```text
-PbyndRequireLicense=true
-PbyndPublicKeysFile=../.bynd-license-secrets/public-keys.json
-PbyndServiceUrl=https://你的测试服务来源
```

`byndPublicKeysFile` 路径以 `android/` 为基准，文件内容是 `{ "密钥编号": "base64url-SPKI公钥" }`。构建会实际解析 RSA 公钥，拒绝私钥 JWK、无效 SPKI 与小于2048位的公钥。启用激活或更新而未提供公钥时构建失败，防止发布无法验证授权的包。Android 23～25 的激活页不调用26+的自动填充接口。

永久离线凭证不能立即撤销。禁用和解绑只影响未来服务端操作；旧设备离线时仍可使用原凭证。离线无法严格限制换机后旧机的使用，这与永久离线承诺一致。卸载、清数据、恢复出厂或密钥丢失需重新联网激活／人工恢复；普通覆盖升级应保留原密钥和数据。客户端可被修改，此方案不承诺绝对防破解。

## Android 更新

准备好的更新环境额外使用 `-PbyndEnableUpdates=true` 和 `-PbyndApkHosts=bynd.ccwu.cc`（按实际域名填写）。默认关闭。

开启后启动最多每 24 小时检查一次，检查失败不阻断应用；关于 BYND 新增手动检查按钮，手动失败显示错误。远程来信由原生 `UpdateActivity` 显示 NEW／IMPROVED／FIXED，与已有本地版本来信分别维护，不提前标记本地记录为已读。用户主动下载；系统来源安装权限未允许时提示授权，返回后再次点击。“稍后／取消下载”和返回会取消未交给系统的下载，坏文件会清理；不提供下载暂停／断点续传。已交给系统的安装记录持久保存，取消／失败显示真实状态。后台安装确认未显示时，可在更新页继续；进程重启丢失确认界面时可明确取消上次会话再准备安装，不永久卡住安装入口。

## APK 发布工具

```text
node scripts/license-release.cjs inspect <正式签名APK>
node scripts/license-release.cjs upload <正式签名APK> [更新内容.json]
```

工具先用 Android SDK 的 apksigner 验证 v2 签名、aapt 读取真实包名与版本，再检查 APK 内全部网页资源与本次打包目录及当前源文件一致，并验证模型／背景移除／头像资源去重。上传时使用 `BYND_LICENSE_URL`、`BYND_LICENSE_ADMIN_TOKEN`；公开来源 `BYND_PUBLIC_APK_ORIGIN` 默认为 `https://bynd.ccwu.cc`。上传不会自动发布，生成的清单放在 `artifacts/distribution/`，审核更新文案后在后台或管理命令发布。

服务器以 R2 的实际流摘要校验上传，文件大小、元信息或正式证书摘要不符时拒绝。必须先有 ready 安装包，才能发布本站 `/downloads/` 路径的清单。文件地址包含版本码与摘要片段，避免同一链接中途换包；下载文件名仍为 `BYND-v<版本>.apk`。旧在线版本可以保留给正在下载或升级的用户，本机工具 `downloads` 目录按项目约定只保留一个校验后的最新版。单次上传保守限制100,000,000字节；更大包需先配置适合实际 Cloudflare 计划的上传方案，不能假装已上传。参考 [Workers 请求体限制](https://developers.cloudflare.com/workers/platform/limits/) 与 [R2 put 校验](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)。

发布清单格式：

```json
{
  "versionCode": 1000,
  "versionName": "1.2.0",
  "apkUrl": "https://bynd.ccwu.cc/downloads/bynd-1000.apk",
  "size": 123456789,
  "sha256": "实际APK的64位小写十六进制SHA256",
  "changelog": { "new": [], "improved": [], "fixed": [] }
}
```

这是格式示例，不是已发布版本。正式文件须先构建、签名、核对资源与摘要，再上传，确认 HTTPS 下载可用后最后发布清单。使用固定版本文件地址，避免下载中途替换同名文件；官网以后可提供最新版入口。R2、域名和上传流程仍需要实际账户配置。

客户端验证清单签名及类型、版本递增、受信任 HTTPS 来源；下载不跟随跳转，按清单限制大小，并核对 SHA-256、包名、版本名／版本码、当前签名证书，然后交给 PackageInstaller 系统确认界面。下载中断、磁盘不足、摘要不符、证书不符和系统安装失败不会显示安装成功。只有系统成功回调报告成功。保持正式包名与签名；证书轮换暂不支持。不要用卸载解决升级问题。

## 验证与上线边界

自动测试：`node --test tests/license-service.test.cjs tests/license-distribution.test.cjs tests/license-native.test.cjs`；全量：`node tests/run.cjs`。测试对实际 SQLite 执行生产 SQL，覆盖双设备激活、重复发码／交付、领取过期、解绑重放／修订号冲突、上传失败／坏摘要／R2异常、邮件超时／重复／存储失败。原生 JVM 测试直接编译并调用生产下载校验及签名类，验证大小、摘要、网络中断、取消、文件写入失败和 Node Worker → Java 的离线 RSA 验签；没有依赖模拟的 JS 下载校验代码。

购买页：`node scripts/check-shop-browser.cjs`。完整浏览器链路：`node scripts/check-license-flow-browser.cjs`，在隔离临时 SQLite 和本机 HTTP 服务走后台、领取、文本保存、文件下载、禁用／恢复与保存失败。浏览器用的是明确的测试文件，不把它当作可安装 APK。覆盖 320／390／430／1280px，47／59px 顶部安全区由父容器或顶栏分别预留；截图和检查记录在 `artifacts/distribution-browser/`。所有邮件请求使用测试替身，没有向真实邮箱发送。

Android 使用本机工具链编译。上线前仍需真机验证：首次激活、飞行模式重启、凭证复制、保存失败恢复、卸载重装和换机；正式签名旧版本覆盖升级、安装权限拒绝、用户取消、坏 APK、断网与磁盘不足。当前没有连接 Android 真机；编译和服务器测试不等同真机验收。网页版与 iOS 的授权政策需另外决定。现有旧安装迁移、是否赠送测试者永久码、设备数和换机频率，正式开售前再定。

参考：Cloudflare [D1 batch 原子事务](https://developers.cloudflare.com/d1/worker-api/d1-database/)、[Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)、[Rate Limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)；Android [Keystore](https://developer.android.com/privacy-and-security/keystore)、[PackageInstaller](https://developer.android.com/reference/android/content/pm/PackageInstaller)。

## 页面插画

使用内置 imagegen 工具生成，参考用户提供的手绘纸张风格；原图完整复制到 `assets/website/bynd-companion.png`，保留透明背景，没有修改参考图。购买页及网站插画从 Android／iOS 的网页资源同步中排除，避免增加原生包体积。可用 `node scripts/preview-shop.cjs` 在本机 8992 端口预览；预览服务只提供购买页和两个配套资源，不暴露工作区文件。

最终提示词：

> Use case: illustration-story. Asset type: original website hero illustration for BYND, a companion app purchase/download page. Primary request: a charming hand-drawn puppy inside a little smartphone reaching a paw outside the screen, evoking companionship beyond the screen. Style/medium: Korean stationery-inspired wax crayon and colored pencil on paper, loose slightly wobbly dark charcoal outlines, friendly simplified shapes, matte scribbly texture. Subject: a cute cream-and-charcoal floppy-eared puppy peeking out of an upright chunky graphite smartphone, one paw over the lower bezel, tiny grass-green four-leaf clover and two pale yellow sparkles nearby. Composition: centered isolated illustration, complete phone and puppy visible, generous transparent margins, square format, no scene or ground. Color palette: warm cream, charcoal, muted grass green #64946b, a touch of soft yellow. Mood: affectionate and playful. Text: none. Constraints: original artwork, not a copy of any existing character; no logos, no lettering, no watermark; truly transparent background.
