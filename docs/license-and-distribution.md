# BYND 授权与分发：开发准备阶段

本轮只准备本地代码，不开售、不接支付、不部署 Worker、不上传 APK。现有网页根入口不变；新购买页是 `shop.html`，奶油白／草绿色／手绘陪伴风格，明确显示尚未开售、价格待公布、下载准备中。没有收款表单、模拟支付或虚假的下载链接。

## 默认状态

| 开关 | 默认 | 影响 |
| --- | --- | --- |
| Worker `LICENSE_ACTIVATION_ENABLED` | `false` | 公众激活返回尚未开放；管理端仍可签发测试码 |
| Gradle `byndRequireLicense` | `false` | Android 照常进入应用，不读取或创建激活凭证 |
| Gradle `byndEnableUpdates` | `false` | 不自动联网检查更新，不显示新更新入口 |

三个开关独立。以后可以先启用更新，继续不要求用户激活。当前网页版、iOS 没有新增授权门槛。没有写入短期过期时间或强制联网续期。

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
| POST `/admin/v1/releases/android/stable` | 管理 Bearer token | 发布签名清单，versionCode 必须递增 |

管理接口没有开放 CORS，不在页面或 APK 中嵌入管理令牌。公众接口给原生客户端调用，也不需要浏览器 CORS。限流绑定缺失、签名失败、数据库写入失败都会返回失败，不伪装成成功。不记录激活码、密钥或数据库异常详情。

数据库：`licenses` 保存摘要、提示片段、状态、时间、一个设备指纹、修订号和可选人工购买记录；`challenges` 保存短期挑战；`audit_logs` 保存创建／激活／禁用／解绑；`releases` 保存已签名的稳定渠道清单。

激活码由稳定签发秘密和 UUID v4 的 HMAC 派生出 128 位值，不在数据库保存原码。重复签发请求可恢复相同激活码；`orderRef` 唯一，避免同一人工购买记录重复发码。`LICENSE_KEY_SECRET` 必须保留，不能随意替换；换它会导致旧码查询与恢复失败。

## 密钥与未来部署

暂时无需执行以下步骤。准备独立测试环境时再做：

1. `node scripts/license-admin.cjs keygen`，生成到 Git 忽略的 `.bynd-license-secrets/`；拒绝覆盖已有文件，不打印密钥。Windows 需自行限制文件权限并留加密备份。私钥绝不能放入网页、APK、聊天或仓库。
2. 复制 `workers/wrangler-license.toml.example` 为 `workers/wrangler-license.toml`，创建独立 D1 后填写数据库 ID。实际配置文件也已忽略。
3. 使用 Wrangler 分别配置 `ADMIN_TOKEN`、`LICENSE_KEY_SECRET`、`SIGNING_PRIVATE_JWK` 三个 secret，`SIGNING_KEY_ID` 对应生成的密钥编号。保留签发秘密与签名私钥的安全备份。
4. 本地应用迁移：`npx wrangler d1 migrations apply bynd-license --local --config workers/wrangler-license.toml`。远端测试环境另行应用迁移。数据库首次为空，没有现成正式 License。
5. 在准备好的独立测试环境启用公众激活与限流；再部署 Worker、配置路由。模板默认 `workers_dev = false`，未配置任何生效路由，文件本身不会发布服务。
6. 正式域名保持现有 `/mcp/*` 等 Worker 路由；只新增表中授权／更新／管理路径。根据实际 APK 存储来源，分别配置 Worker `APK_ALLOWED_HOSTS` 与 APK 的 `byndApkHosts`，两者必须一致。

维护签名密钥时在 APK 的公钥映射里保留旧密钥编号；删除旧公钥会令已有永久凭证失效。采用标准 RS256 compact JWS：签名算法 `SHA256withRSA`、header 的 `typ` 区分 `BYND-LICENSE` 和 `BYND-UPDATE`。采用 RSA 是为了兼容 Android 23+ 与 Worker，并避免 ECDSA DER/raw 编码差异。

## 人工管理

环境变量 `BYND_LICENSE_URL` 默认为 `https://bynd.ccwu.cc`。只有本机测试来源允许 HTTP，其他必须 HTTPS；管理调用不跟随重定向，避免令牌外泄。`BYND_LICENSE_ADMIN_TOKEN` 只在当前本机环境中设置，勿放进命令参数。

```text
node scripts/license-admin.cjs create <UUID-v4> [人工购买记录编号]
node scripts/license-admin.cjs inspect <License-ID>
node scripts/license-admin.cjs disable <License-ID>
node scripts/license-admin.cjs unbind <License-ID>
node scripts/license-admin.cjs publish <更新清单.json>
```

创建前生成 UUID v4，网络失败后使用同一个 UUID 和购买记录重试，避免重复发码。创建命令会显示激活码，由你安全地交付用户；没有自动邮件、支付 webhook、客户账号或可视化后台。禁用、解绑是明确的管理操作；网络结果不明时先用 inspect 核对状态，不盲目重新解绑刚激活的新设备。

## Android 激活

原生 `MainActivity` 在加载 WebView 前检查授权。要求激活时显示 `LicenseActivity`；后台陪伴服务也检查授权。Android Keystore 保存不可导出的 RSA 设备私钥，公钥 SPKI 的 SHA-256 为设备指纹。激活挑战由设备私钥签名，服务端验证证明，不能仅凭伪造 `device_id` 激活。

服务器凭证包含产品、License ID、设备指纹、永久授权、签发时间、修订号。APK 仅内置验证公钥；每次离线启动验证数字签名、产品／类型、设备匹配和本机私钥持有证明。凭证以 AtomicFile 写入 `getNoBackupFilesDir()`，写入后再次验证，失败保留重试入口。聊天导入导出、清缓存和系统备份均不携带激活凭证或设备私钥。

准备好的测试环境使用构建参数：

```text
-PbyndRequireLicense=true
-PbyndPublicKeysFile=../.bynd-license-secrets/public-keys.json
-PbyndServiceUrl=https://你的测试服务来源
```

`byndPublicKeysFile` 路径以 `android/` 为基准，文件内容是 `{ "密钥编号": "base64url-SPKI公钥" }`。启用激活或更新而未提供公钥时构建失败，防止发布无法验证授权的包。密钥文件是公钥映射，不能传私钥 JWK。

永久离线凭证不能立即撤销。禁用和解绑只影响未来服务端操作；旧设备离线时仍可使用原凭证。离线无法严格限制换机后旧机的使用，这与永久离线承诺一致。卸载、清数据、恢复出厂或密钥丢失需重新联网激活／人工恢复；普通覆盖升级应保留原密钥和数据。客户端可被修改，此方案不承诺绝对防破解。

## Android 更新

准备好的更新环境额外使用 `-PbyndEnableUpdates=true` 和 `-PbyndApkHosts=bynd.ccwu.cc`（按实际域名填写）。默认关闭。

开启后启动最多每 24 小时检查一次，检查失败不阻断应用；关于 BYND 新增手动检查按钮，手动失败显示错误。远程来信由原生 `UpdateActivity` 显示 NEW／IMPROVED／FIXED，与已有本地版本来信分别维护，不提前标记本地记录为已读。用户主动下载；系统来源安装权限未允许时提示授权，返回后再次点击。更新界面当前支持稍后关闭，下载已开始后在后台完成，不提供下载暂停／断点续传。

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

自动测试：`node --test tests/license-service.test.cjs`（实际 SQLite 执行生产 SQL）；全量：`node tests/run.cjs`。购买页：`node scripts/check-shop-browser.cjs`，覆盖 320／390／430／1280px 和 0／47／59px 顶部安全区，截图在 `artifacts/shop/`。

Android 使用本机工具链编译。上线前仍需真机验证：首次激活、飞行模式重启、凭证复制、保存失败恢复、卸载重装和换机；正式签名旧版本覆盖升级、安装权限拒绝、用户取消、坏 APK、断网与磁盘不足。当前没有连接 Android 真机；编译和服务器测试不等同真机验收。网页版与 iOS 的授权政策需另外决定。现有旧安装迁移、是否赠送测试者永久码、设备数和换机频率，正式开售前再定。

参考：Cloudflare [D1 batch 原子事务](https://developers.cloudflare.com/d1/worker-api/d1-database/)、[Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)、[Rate Limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)；Android [Keystore](https://developer.android.com/privacy-and-security/keystore)、[PackageInstaller](https://developer.android.com/reference/android/content/pm/PackageInstaller)。

## 页面插画

使用内置 imagegen 工具生成，参考用户提供的手绘纸张风格；原图完整复制到 `assets/website/bynd-companion.png`，保留透明背景，没有修改参考图。购买页及网站插画从 Android／iOS 的网页资源同步中排除，避免增加原生包体积。可用 `node scripts/preview-shop.cjs` 在本机 8992 端口预览；预览服务只提供购买页和两个配套资源，不暴露工作区文件。

最终提示词：

> Use case: illustration-story. Asset type: original website hero illustration for BYND, a companion app purchase/download page. Primary request: a charming hand-drawn puppy inside a little smartphone reaching a paw outside the screen, evoking companionship beyond the screen. Style/medium: Korean stationery-inspired wax crayon and colored pencil on paper, loose slightly wobbly dark charcoal outlines, friendly simplified shapes, matte scribbly texture. Subject: a cute cream-and-charcoal floppy-eared puppy peeking out of an upright chunky graphite smartphone, one paw over the lower bezel, tiny grass-green four-leaf clover and two pale yellow sparkles nearby. Composition: centered isolated illustration, complete phone and puppy visible, generous transparent margins, square format, no scene or ground. Color palette: warm cream, charcoal, muted grass green #64946b, a touch of soft yellow. Mood: affectionate and playful. Text: none. Constraints: original artwork, not a copy of any existing character; no logos, no lettering, no watermark; truly transparent background.
